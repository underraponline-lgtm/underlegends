# -*- coding: utf-8 -*-
"""QUIEN CUMPLE EL REQUISITO PARA TENER CARTA: ID + VERIFICADO EN DRA.

    python herramientas/en_dra.py             los del pool con carta
    python herramientas/en_dra.py --todos     las 870 del padron

Dlx, 19/09/2026: *«para q el bot funcione osea las tarjetas se necesita el ID y
tener el rol de 1101257512273055745 en DRA»*. Ese rol es **«Miembro»**, el que
se da al verificarse. O sea que la carta pide DOS cosas, y las dos se pueden
preguntar de a una desde afuera:

  1. tener el Discord ID cargado (si no, no hay a quien preguntarle a Discord)
  2. tener el rol Miembro en DRA (estar verificado)

⚠️ SE PREGUNTA UNO POR UNO A PROPOSITO. `GET /guilds/{id}/members` (la lista
entera) y la busqueda por rol piden el intent privilegiado: los dos dan 403.
`GET /guilds/{id}/members/{user}` —una persona— trae sus roles y NO pide nada.
Por eso el padron sigue siendo la lista y a Discord se le confirma de a uno.

⚠️ TENER EL ROL IMPLICA ESTAR ADENTRO, asi que este chequeo reemplaza al de
«esta en DRA» que habia antes: era un proxy mas debil de lo mismo.

⚠️ EL ROL VIVE EN datos/servidores.json (canales.DRA.verificacion_rol), no
como numero suelto. Si DRA lo cambia, se toca ahi.
"""
import io
import json
import os
import sys
import time

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, os.path.join(BASE, 'sheet'))

API = 'https://discord.com/api/v10'
DRA = '841017460341604382'


def _rol():
    """El rol de verificado, de la tabla. Sin numero magico."""
    p = os.path.join(BASE, 'datos', 'servidores.json')
    try:
        d = json.load(io.open(p, encoding='utf-8'))
        return ((d.get('canales') or {}).get('DRA') or {}).get('verificacion_rol') or ''
    except Exception:
        return ''


def env(clave):
    for l in io.open(os.path.join(BASE, '.env'), encoding='utf-8'):
        if l.strip().startswith(clave + '='):
            return l.split('=', 1)[1].strip().strip('"\'')
    sys.exit('falta %s en .env' % clave)


def estado(s, gid, rol, did):
    """('listo' | 'sin_verificar' | 'fuera' | None, apodo).

    'listo'        = esta en DRA y tiene el rol -> cumple para carta
    'sin_verificar'= esta en DRA pero sin el rol -> le falta verificarse
    'fuera'        = no esta en DRA (404/403)
    None           = Discord contesto algo raro; no se cuenta como nada
    """
    for _ in range(4):
        r = s.get('%s/guilds/%s/members/%s' % (API, gid, did), timeout=20)
        if r.status_code == 429:
            time.sleep(float(r.json().get('retry_after', 1)) + .2)
            continue
        if r.status_code == 200:
            j = r.json() or {}
            nick = j.get('nick') or ''
            tiene = rol in (j.get('roles') or [])
            return ('listo' if tiene else 'sin_verificar'), nick
        if r.status_code in (404, 403):
            return 'fuera', ''
        return None, ''
    return None, ''


def main():
    import requests
    import construir_padron as PAD

    rol = _rol()
    if not rol:
        sys.exit('falta canales.DRA.verificacion_rol en datos/servidores.json')

    padron = PAD.cargar()
    if not padron:
        sys.exit('falta datos/padron.json:  python sheet/construir_padron.py')
    idx = PAD.por_nombre(padron)

    # ⚠️ EL ID PUEDE ESTAR EN LA FILA DEL ALIAS, y sin esto el conteo miente.
    # `Luzzano` figura sin Discord ID y lo tiene: esta cargado en `Lzz`, que es
    # el mismo. El pipeline busca por el nombre real y ahi no hay nada. No se
    # unen las filas aca —eso es una correccion del Sheet, de Dlx—; solo se lee
    # de costado el id que falta.
    akas = {}
    try:
        import construir_akas as AK
        d = AK.cargar()
        porreal = {}
        for a, r in (d.get('pares') or []):
            porreal.setdefault(PAD.norm(r), []).append(PAD.norm(a))
        for real, aliases in porreal.items():
            for al in aliases:
                did = (idx.get(al) or {}).get('discord_id')
                if did:
                    akas[real] = did
                    break
    except Exception:
        pass

    def id_de(nombre):
        n = PAD.norm(nombre)
        return (idx.get(n) or {}).get('discord_id') or akas.get(n)

    if '--todos' in sys.argv:
        gente = [(p['raw'], id_de(p['raw'])) for p in padron]
        de = 'el padron entero'
    else:
        with io.open(os.path.join(BASE, 'datos', 'competitivo_pool.json'),
                     encoding='utf-8') as f:
            pool = json.load(f)
        gente = [(x['raw'], id_de(x['raw'])) for x in pool]
        de = 'los que HOY tienen carta en el pool'

    s = requests.Session()
    s.headers['Authorization'] = 'Bot ' + env('DISCORD_TOKEN')

    listo, sin_ver, fuera, sin_id, raros = [], [], [], [], []
    for quien, did in gente:
        if not did:
            sin_id.append(quien)
            continue
        e, _ = estado(s, DRA, rol, did)
        if e == 'listo':
            listo.append(quien)
        elif e == 'sin_verificar':
            sin_ver.append(quien)
        elif e == 'fuera':
            fuera.append(quien)
        else:
            raros.append(quien)

    n = len(gente)
    pc = lambda x: 100. * len(x) / max(n, 1)
    print('\n%d persona(s), %s' % (n, de))
    print('   requisito para carta: Discord ID + rol Miembro en DRA\n')
    print('  ✅ LISTOS (ID + verificado) %4d   %5.1f%%' % (len(listo), pc(listo)))
    print('  ⏳ SIN VERIFICAR (en DRA)   %4d   %5.1f%%   <- les falta el rol' % (len(sin_ver), pc(sin_ver)))
    print('  🚪 FUERA DE DRA             %4d   %5.1f%%   <- tienen que entrar' % (len(fuera), pc(fuera)))
    print('  ❔ SIN DISCORD ID           %4d   %5.1f%%   <- ni se puede preguntar' % (len(sin_id), pc(sin_id)))
    if raros:
        print('  sin respuesta              %4d          %s' % (len(raros), ', '.join(raros[:6])))

    # Las listas enteras: son a quien hay que escribirle, no una muestra.
    if sin_ver:
        print('\n  SIN VERIFICAR (%d):\n     %s' % (len(sin_ver), ', '.join(sorted(sin_ver))))
    if fuera:
        print('\n  FUERA DE DRA (%d):\n     %s' % (len(fuera), ', '.join(sorted(fuera))))
    if sin_id:
        print('\n  SIN DISCORD ID (%d):\n     %s' % (len(sin_id), ', '.join(sorted(sin_id))))
    print('')
    return 0


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    sys.exit(main())
