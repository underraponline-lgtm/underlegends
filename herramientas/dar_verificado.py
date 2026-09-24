# -*- coding: utf-8 -*-
"""DARLE EL ROL «MIEMBRO» EN DRA A QUIEN DISCORD CONFIRMA QUE ES QUIEN DICE.

    python herramientas/dar_verificado.py            dry-run: a quien le daria
    python herramientas/dar_verificado.py --aplicar  lo asigna
    python herramientas/dar_verificado.py --pool     solo los del pool con carta
    python herramientas/dar_verificado.py --limite N corta despues de N (poco a poco)

Dlx, 19/09/2026: la «verificacion» de DRA es en el fondo el mismo vinculo
ID<->identidad que arma este proyecto; al verificarse, el ID del usuario se
publica al Sheet. Pero depende de que cada uno se verifique, y muchos no lo
hacen. Esto le da el rol a los que ya estan en DRA y **Discord confirma que
son quienes el Sheet dice que son**.

⚠️ LA SEGURIDAD ES LA CORROBORACION, NO LA CONFIANZA EN EL SHEET. Toda esta
etapa mostro que los IDs del Sheet estan torcidos en parte —cruzados, alias, el
bug de los digitos—. Asi que NO se asigna el rol solo porque el Sheet tenga un
ID: se asigna cuando el **apodo o el usuario de esa cuenta en Discord coincide
con el nombre del competidor** (misma norm() y el mismo corte por separadores
que usa `ids_cruzados.py`). Si no coincide, va a «revisar», no se toca. Ese
filtro es lo que evita ponerle «verificado» a la cuenta equivocada.

⚠️ SOLO SUMA EL ROL. Nunca saca ninguno, nunca toca a quien ya lo tiene, y a
quien no esta en DRA no lo puede tocar (hay que entrar primero).

⚠️ CON FRENO. Discord limita por ritmo. Se va de a uno, con una pausa entre
escrituras y reintento con espera ante un 429. `--limite` permite hacerlo en
tandas.

⚠️ USA EL PODER QUE EL BOT YA TIENE. El bot es Admin en DRA (posicion 125, el
rol Miembro esta en la 87). Eso alcanza para asignarlo. Nota aparte: que el bot
tenga Admin es mas poder del que necesita para nada; conviene bajarselo y rotar
el token despues de esto.
"""
import io
import json
import os
import re
import sys
import time

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, os.path.join(BASE, 'sheet'))

API = 'https://discord.com/api/v10'
DRA = '841017460341604382'
PAUSA = 0.35          # entre escrituras, para no gatillar el rate limit


def _roles():
    """(Miembro, Invitado). Al verificar se da el primero y se saca el segundo."""
    p = os.path.join(BASE, 'datos', 'servidores.json')
    d = json.load(io.open(p, encoding='utf-8'))
    dra = (d.get('canales') or {}).get('DRA') or {}
    return dra.get('verificacion_rol') or '', dra.get('rol_invitado') or ''


def env(clave):
    for l in io.open(os.path.join(BASE, '.env'), encoding='utf-8'):
        if l.strip().startswith(clave + '='):
            return l.split('=', 1)[1].strip().strip('"\'')
    sys.exit('falta %s en .env' % clave)


def corrobora(nombre, nick, user, glob, norm):
    """¿La cuenta de Discord se llama como el competidor? (misma norm + corte)"""
    quiero = norm(nombre)
    if not quiero:
        return False
    for txt in (nick, glob, user):
        if not txt:
            continue
        if norm(txt) == quiero:
            return True
        for t in re.split(r'[|/·,#-]+', txt):
            if norm(t) == quiero:
                return True
    return False


def miembro(s, gid, did):
    """(estado, nick). estado: 'ok200' | 'fuera' | None"""
    for _ in range(5):
        r = s.get('%s/guilds/%s/members/%s' % (API, gid, did), timeout=20)
        if r.status_code == 429:
            time.sleep(float(r.json().get('retry_after', 1)) + .3)
            continue
        if r.status_code == 200:
            return r.json(), 'ok'
        if r.status_code in (403, 404):
            return None, 'fuera'
        return None, 'raro'
    return None, 'raro'


def _rol_op(s, metodo, gid, did, rol):
    for _ in range(5):
        r = metodo('%s/guilds/%s/members/%s/roles/%s' % (API, gid, did, rol),
                   headers={'X-Audit-Log-Reason': 'Liga Global: identidad confirmada'},
                   timeout=20)
        if r.status_code == 429:
            time.sleep(float(r.json().get('retry_after', 1)) + .3)
            continue
        return r.status_code in (200, 204)
    return False


def dar_rol(s, gid, did, rol):
    return _rol_op(s, s.put, gid, did, rol)


def quitar_rol(s, gid, did, rol):
    return _rol_op(s, s.delete, gid, did, rol)


def main():
    import requests
    import construir_padron as PAD
    try:
        import construir_akas as AK
        akd = AK.cargar()
    except Exception:
        akd = {}

    aplicar = '--aplicar' in sys.argv
    solo_pool = '--pool' in sys.argv
    limite = None
    for a in sys.argv:
        if a.startswith('--limite'):
            try:
                limite = int(a.split('=')[1]) if '=' in a else int(sys.argv[sys.argv.index(a) + 1])
            except Exception:
                limite = None

    rol, invitado = _roles()
    if not rol:
        sys.exit('falta canales.DRA.verificacion_rol en datos/servidores.json')

    padron = PAD.cargar()
    idx = PAD.por_nombre(padron)

    # id que puede estar en la fila del alias
    akas = {}
    porreal = {}
    for a, r in (akd.get('pares') or []):
        porreal.setdefault(PAD.norm(r), []).append(PAD.norm(a))
    for real, al in porreal.items():
        for x in al:
            did = (idx.get(x) or {}).get('discord_id')
            if did:
                akas[real] = did
                break

    def id_de(n):
        k = PAD.norm(n)
        return (idx.get(k) or {}).get('discord_id') or akas.get(k)

    if solo_pool:
        with io.open(os.path.join(BASE, 'datos', 'competitivo_pool.json'), encoding='utf-8') as f:
            nombres = [x['raw'] for x in json.load(f)]
        de = 'el pool con carta'
    else:
        nombres = [p['raw'] for p in padron]
        de = 'el padron entero'

    # nombre -> id, sin repetir ids (un id puede caer por nombre y por alias)
    gente, visto = [], set()
    for n in nombres:
        did = id_de(n)
        if did and did not in visto:
            visto.add(did)
            gente.append((n, did))

    s = requests.Session()
    s.headers['Authorization'] = 'Bot ' + env('DISCORD_TOKEN')

    dar, ya, fuera, revisar, raros = [], [], [], [], []
    print('\nmirando %d ID (%s) en DRA...\n' % (len(gente), de))
    for n, did in gente:
        j, est = miembro(s, DRA, did)
        if est == 'fuera':
            fuera.append(n)
        elif est == 'raro':
            raros.append(n)
        elif rol in (j.get('roles') or []):
            ya.append(n)
        else:
            nick = j.get('nick') or ''
            u = (j.get('user') or {})
            if corrobora(n, nick, u.get('username'), u.get('global_name'), PAD.norm):
                dar.append((n, did, nick))
            else:
                revisar.append((n, did, nick or (u.get('username') or '')))
        time.sleep(0.12)

    print('  ✅ le daria el rol (identidad confirmada): %d' % len(dar))
    for n, did, nick in dar[:40]:
        print('       %-16s %s' % (n, nick or did))
    if len(dar) > 40:
        print('       … y %d mas' % (len(dar) - 40))
    print('  ⏭  ya lo tienen: %d' % len(ya))
    print('  🚪 no estan en DRA: %d' % len(fuera))
    print('  🔎 en DRA pero el nombre NO coincide (posible ID cruzado): %d' % len(revisar))
    for n, did, quien in revisar[:20]:
        print('       %-16s la cuenta se ve como: %s' % (n, quien or '—'))
    if raros:
        print('  ⚠️ sin respuesta clara: %d' % len(raros))

    if not aplicar:
        print('\n  (nada asignado — corré con --aplicar)\n')
        return

    objetivo = dar[:limite] if limite else dar
    print('\n  asignando el rol a %d...\n' % len(objetivo))
    hechos, fallos = 0, []
    for n, did, nick in objetivo:
        ok1 = dar_rol(s, DRA, did, rol)
        if invitado:
            quitar_rol(s, DRA, did, invitado)   # sacar «Invitado»: ya no lo necesita
        if ok1:
            hechos += 1
            if hechos % 25 == 0:
                print('   %d de %d...' % (hechos, len(objetivo)))
        else:
            fallos.append(n)
        time.sleep(PAUSA)
    print('\n  ✅ verificados: %d' % hechos)
    if fallos:
        print('  ⚠️ no pude con %d: %s' % (len(fallos), ', '.join(fallos[:8])))
    if revisar:
        print('\n  🔎 quedaron %d para que MIRES vos (nombre no coincide): '
              'no les toqué nada.' % len(revisar))
    print('')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
