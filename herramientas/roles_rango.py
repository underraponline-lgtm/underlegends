# -*- coding: utf-8 -*-
"""LOS ROLES DE RANGO DE DISCORD CONTRA EL RANGO DE LA CARTA.

    python herramientas/roles_rango.py            mide y no toca nada
    python herramientas/roles_rango.py --crear    crea los roles que faltan
    python herramientas/roles_rango.py --aplicar  reasigna los roles
    python herramientas/roles_rango.py --vaciar   mide a quién se le sacaría
    python herramientas/roles_rango.py --vaciar --aplicar   se los saca

🔴 ESTE ES EL PENDIENTE CARO Y EL ÚNICO IRREVERSIBLE DE CARA AL PÚBLICO, y
`CLAUDE.md` ya lo decía: *«la gente ya lleva su rol puesto. Va ANTES de que
arranque la T1, no a mitad — a mitad son 26 personas viendo cómo les cambia la
letra sin haber competido»*.

El rango vive en CINCO lugares y sólo dos se arreglan solos:

    comun/rangos.py            8 tramos   es la fuente
    la columna Rango del Sheet 6          sola, con el Sheet nuevo
    la Guía                    6          sola, se reescribe
    Index.html del Apps Script 6          a mano
    los roles de Discord       6          A MANO: dos roles nuevos y reasignar

⚠️ LOS ROLES SE BUSCAN NORMALIZANDO CON **NFKD**, y eso no es un detalle: en
DRA se llaman «◢◤🐉◥◣ 𝐑𝐚𝐧𝐠𝐨 𝐒 ◢◤🐉◥◣», con negrita MATEMÁTICA (el bloque
U+1D400). Buscando «rango» con `re.I` no aparece ninguno — los 127 roles pasan
de largo y el script diría que el servidor no tiene roles de rango. Es
exactamente el mismo tropiezo que ya costó una vuelta con los roles de país en
FFA, y por eso acá se normaliza desde el principio.

⚠️ NO CREA NI REASIGNA SIN QUE SE LO PIDAN. Sin banderas sólo mide. Crear un
rol y repartirlo a 138 personas lo ve todo el servidor y no hay «deshacer».
"""
import io
import json
import os
import re
import sys
import time
import unicodedata

import requests

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, BASE)
sys.path.insert(0, os.path.join(BASE, 'sheet'))

from comun.rangos import UMBRAL, de_score  # noqa: E402

API = 'https://discord.com/api/v10'
GUILDS = (('DRA', '841017460341604382'), ('FFA', '1468472442925092958'))
TRAMOS = ['SSS', 'SS', 'S', 'A', 'B', 'C', 'D', 'E']

# ⚠️ EL COLOR Y EL EMOJI DE LOS DOS NUEVOS SALEN DE LA SERIE QUE YA EXISTE:
# S 🐉 · A 🏆 · B 🗡️ · C 🔥 · D 🏹 · E ⚓. SS y SSS van ARRIBA de S, así que se
# eligen dos que se lean como «más que un dragón» sin repetir ninguno.
NUEVOS = {
    'SSS': ('👑', 0xFFD700),
    'SS': ('⚡', 0xE5484D),
}


def env(clave):
    for l in io.open(os.path.join(BASE, '.env'), encoding='utf-8'):
        if l.strip().startswith(clave + '='):
            return l.split('=', 1)[1].strip().strip('"\'')
    sys.exit('falta %s en .env' % clave)


def plano(s):
    """Sin adornos ni negrita matemática. NFKD o no se ve nada — ver arriba."""
    s = unicodedata.normalize('NFKD', s or '')
    return ''.join(c for c in s if c.isalnum() or c.isspace()).upper().strip()


RANGO_ROL = re.compile(r'\bRANGO\s+(SSS|SS|S|A|B|C|D|E)\b')


def roles_de_rango(rs):
    """{tramo: rol} de los roles que son de rango, sea como se llamen."""
    out = {}
    for r in rs:
        m = RANGO_ROL.search(plano(r['name']))
        if m:
            out[m.group(1)] = r
    return out


def nombre_como_los_otros(modelo, tramo, emoji):
    """El nombre del rol nuevo, copiando la forma del que ya existe.

    ⚠️ SE COPIA EL MOLDE, NO SE INVENTA. Si el rol de S se llama
    «◢◤🐉◥◣ 𝐑𝐚𝐧𝐠𝐨 𝐒 ◢◤🐉◥◣», el de SS tiene que verse igual o va a cantar
    en la lista de roles. Se reemplaza el emoji y la letra del modelo.
    """
    n = modelo['name']
    # la letra en negrita matemática: U+1D400 es 'A'
    def negrita(t):
        return ''.join(chr(0x1D400 + ord(c) - 65) for c in t)
    viejo = None
    for t in TRAMOS:
        if negrita(t) in n:
            viejo = negrita(t)
            break
    if not viejo:
        return '%s Rango %s %s' % (emoji, tramo, emoji)
    n = n.replace(viejo, negrita(tramo))
    # el emoji del modelo, sea cual sea
    for c in modelo['name']:
        if unicodedata.category(c) == 'So' and c not in '◢◤◥◣':
            n = n.replace(c, emoji)
            break
    return n


def rango_de_cada_uno():
    """{discord_id: tramo} segun el Score de hoy."""
    import construir_padron as PAD
    idx = PAD.por_nombre()
    out = {}
    with io.open(os.path.join(BASE, 'datos', 'competitivo_pool.json'),
                 encoding='utf-8') as f:
        for x in json.load(f):
            sc = x.get('score')
            if sc is None:
                continue
            did = (idx.get(PAD.norm(x['raw'])) or {}).get('discord_id')
            if did:
                out[did] = (de_score(float(sc)), x['raw'])
    return out


def _rol(s, metodo, gid, uid, rid):
    """Poner o sacar un rol, respetando el freno de Discord.

    🔴 SIN ESTO SE PIERDE LA MITAD DE LA TANDA Y NO SE NOTA. La primera corrida
    aplicó 11 de 23: el resto devolvió **429** y el script los contó como
    fallos y siguió. Discord no es que rechace el cambio — está diciendo
    «esperá», y `retry_after` dice cuánto. Tratar un 429 como un error es
    tirar trabajo que estaba a 200 ms de salir bien.
    """
    u = '%s/guilds/%s/members/%s/roles/%s' % (API, gid, uid, rid)
    for _ in range(6):
        r = s.request(metodo, u, timeout=20,
                      headers={'X-Audit-Log-Reason': 'Liga Global: rango'})
        if r.status_code == 429:
            try:
                espera = float(r.json().get('retry_after', 1))
            except Exception:
                espera = 1.0
            time.sleep(espera + 0.3)
            continue
        time.sleep(0.35)
        return r.status_code in (200, 201, 204, 404)
    return False


def miembros(s, gid):
    out, after = {}, '0'
    while True:
        r = s.get('%s/guilds/%s/members' % (API, gid),
                  params={'limit': 1000, 'after': after}, timeout=40)
        if r.status_code == 429:
            time.sleep(float(r.json().get('retry_after', 1)) + .3)
            continue
        if r.status_code != 200:
            sys.exit('no pude listar %s: %s' % (gid, r.status_code))
        lote = r.json()
        if not lote:
            break
        for m in lote:
            did = (m.get('user') or {}).get('id')
            if did:
                out[did] = m
        # 🔴 `key=int` NO ES COSMETICO. Los snowflakes tienen 17, 18 y 19
        # digitos, y `max()` sobre cadenas compara alfabeticamente: asi
        # '999999999999999999' le gana a '1000000000000000000', que es
        # mayor de verdad, y el cursor RETROCEDE. Medido en DRA: 4 paginas
        # y 3.069 filas para 2.707 personas — 362 pedidas dos veces. El
        # conjunto salia bien de casualidad (los `set` deduplican), pero
        # combinado con `break` en una pagina corta puede cortar antes de
        # llegar al final.
        after = max(((m.get('user') or {}).get('id', '0') for m in lote), key=int)
        if len(lote) < 1000:
            break
        time.sleep(0.25)
    return out


FOTO = os.path.join(BASE, 'datos', 'roles_rango_antes.json')


def vaciar(s, aplicar=False):
    """Le saca el rol de rango a TODO el que tenga uno. Empezar de cero.

    🔴 DLX, 22/09/2026: *«eso de los rangos va empezar de 0. Necesito que
    vacíes esos»*. La T1 arranca sin rango y cada uno se lo gana
    compitiendo — que es la regla del proyecto: *el rango sale del Score
    competitivo, siempre*, y en una temporada que no empezó no hay Score.

    🔴 SE GUARDA LA FOTO ANTES, Y SIN FOTO NO SE VACÍA. Discord no tiene
    deshacer: sacado el rol, quién lo tenía **no existe en ningún lado**.
    La foto (`datos/roles_rango_antes.json`) es lo único que permite
    volver atrás, y por eso es una precondición y no un extra.

    ⚠️ Y SE MIRA A TODO EL SERVIDOR, NO AL POOL. Medido el 22/09: el
    reporte de arriba decía «84 ya correctos» porque cruza contra las
    112 personas con Score y Discord ID — pero los que **portan** un rol
    de rango en DRA son **147**. Los 63 de diferencia son gente que
    quedó fuera del pool y conservó la insignia. Vaciar mirando el pool
    habría dejado justo a los que ya estaban mal.
    """
    gid = dict(GUILDS)['DRA']
    mapa = roles_de_rango(s.get('%s/guilds/%s/roles' % (API, gid),
                                timeout=30).json())
    ids = {v['id']: k for k, v in mapa.items()}
    ms = miembros(s, gid)
    tiene = []
    for m in ms.values():
        u = m.get('user') or {}
        for r in m.get('roles', []):
            if r in ids:
                tiene.append((u.get('id'), u.get('username'), ids[r], r))

    from collections import Counter
    c = Counter(t for _i, _u, t, _r in tiene)
    print('\n══ VACIAR LOS ROLES DE RANGO (DRA) ══\n')
    print('   %d miembros · %d con rol de rango' % (len(ms), len(tiene)))
    print('   %s' % '  '.join('%s=%d' % (t, c[t]) for t in TRAMOS if c[t]))

    with io.open(FOTO, 'w', encoding='utf-8') as f:
        json.dump({'guild': gid,
                   'roles': {k: v['id'] for k, v in mapa.items()},
                   'gente': [{'id': i, 'usuario': u, 'tramo': t}
                             for i, u, t, _r in tiene]},
                  f, ensure_ascii=False, indent=1)
    print('\n   foto guardada: %s' % os.path.relpath(FOTO, BASE))

    if not aplicar:
        print('\n   (no toqué nada — `--vaciar --aplicar` lo hace)\n')
        return 0

    hechos = fallos = 0
    for i, (uid, usr, tramo, rid) in enumerate(tiene, 1):
        if _rol(s, 'DELETE', gid, uid, rid):
            hechos += 1
        else:
            fallos += 1
            print('   🔴 no pude sacarle %s a %s' % (tramo, usr))
        if i % 25 == 0:
            print('   %d de %d…' % (i, len(tiene)))

    # 🔴 SE VERIFICA VOLVIENDO A PREGUNTAR. Un 204 dice que Discord
    # aceptó el pedido; lo que importa es que el servidor haya quedado
    # sin nadie con rol de rango. Es la misma regla que el exportador de
    # PNG y `escribir.poner()`: mirar el resultado, no el proceso.
    quedan = sum(1 for m in miembros(s, gid).values()
                 for r in m.get('roles', []) if r in ids)
    print('\n   %d sacados · %d fallaron' % (hechos, fallos))
    print('   %s quedan %d con rol de rango'
          % ('✅' if not quedan else '🔴', quedan))
    print('   (para volver atrás: %s)\n' % os.path.relpath(FOTO, BASE))
    return 0 if not quedan and not fallos else 1


def main():
    s = requests.Session()
    s.headers['Authorization'] = 'Bot ' + env('DISCORD_TOKEN')
    crear = '--crear' in sys.argv
    aplicar = '--aplicar' in sys.argv

    if '--vaciar' in sys.argv:
        return vaciar(s, aplicar)

    deberia = rango_de_cada_uno()
    print('\n%d personas con Score y Discord ID' % len(deberia))
    from collections import Counter
    c = Counter(r for r, _ in deberia.values())
    print('   por rango: %s' % '  '.join('%s=%d' % (t, c.get(t, 0)) for t in TRAMOS))

    for nom, gid in GUILDS:
        print('\n══════ %s ══════' % nom)
        rs = s.get('%s/guilds/%s/roles' % (API, gid), timeout=30).json()
        tengo = roles_de_rango(rs)
        print('  roles de rango encontrados: %d  (%s)'
              % (len(tengo), ' '.join(sorted(tengo, key=TRAMOS.index)) or '—'))
        if not tengo:
            print('  🔵 este servidor no usa roles de rango: no hay nada que hacer')
            continue
        faltan = [t for t in TRAMOS if t not in tengo]
        if faltan:
            print('  ⚠️ FALTAN: %s' % ' '.join(faltan))
            modelo = tengo.get('S') or list(tengo.values())[0]
            for t in faltan:
                emoji, color = NUEVOS.get(t, ('🎖️', 0x99AAB5))
                propuesto = nombre_como_los_otros(modelo, t, emoji)
                print('     %-4s -> %-36s color #%06X' % (t, propuesto, color))
                if crear:
                    # ⚠️ EL ROL NUEVO VA JUSTO ARRIBA DEL DE S, no al fondo.
                    # Un rol de rango debajo de «Miembro» no se ve en la lista
                    # y el color no gana: Discord pinta el del rol mas alto.
                    r = s.post('%s/guilds/%s/roles' % (API, gid),
                               json={'name': propuesto, 'color': color,
                                     'hoist': modelo.get('hoist', False),
                                     'mentionable': modelo.get('mentionable', False),
                                     'permissions': '0'},
                               headers={'X-Audit-Log-Reason': 'Liga Global: rangos SS y SSS'},
                               timeout=30)
                    if r.ok:
                        nuevo = r.json()
                        tengo[t] = nuevo
                        s.patch('%s/guilds/%s/roles' % (API, gid),
                                json=[{'id': nuevo['id'],
                                       'position': modelo['position'] + 1}], timeout=30)
                        print('        ✅ creado  %s' % nuevo['id'])
                        time.sleep(0.5)
                    else:
                        print('        ❌ %d %s' % (r.status_code, r.text[:110]))

        ids_rango = {r['id'] for r in tengo.values()}
        ms = miembros(s, gid)
        plan, ok, sin_rol = [], 0, 0
        for did, m in ms.items():
            par = deberia.get(did)
            if not par:
                continue                       # no compite: no se le toca nada
            quiere, nombre = par
            tiene = [r for r in (m.get('roles') or []) if r in ids_rango]
            destino = tengo.get(quiere)
            if not destino:
                sin_rol += 1
                continue
            if tiene == [destino['id']]:
                ok += 1
                continue
            plan.append({'id': did, 'n': nombre, 'quiere': quiere,
                         'poner': destino['id'],
                         'sacar': [r for r in tiene if r != destino['id']],
                         'antes': [t for t, r in tengo.items() if r['id'] in tiene]})

        print('  ya correctos: %d   ·   A CAMBIAR: %d   ·   sin rol para su rango: %d'
              % (ok, len(plan), sin_rol))
        for p in sorted(plan, key=lambda x: TRAMOS.index(x['quiere']))[:40]:
            print('     %-18s %-14s -> %s' % (p['n'][:18],
                                              '+'.join(p['antes']) or '(ninguno)',
                                              p['quiere']))
        if len(plan) > 40:
            print('     … y %d más' % (len(plan) - 40))

        if not aplicar:
            continue
        resp = os.path.join(BASE, 'docs', 'roles_%s_%s.json'
                            % (nom, time.strftime('%Y%m%d_%H%M')))
        json.dump(plan, io.open(resp, 'w', encoding='utf-8', newline='\n'),
                  ensure_ascii=False, indent=1)
        print('  respaldo -> %s' % os.path.relpath(resp, BASE))
        hechos = 0
        for p in plan:
            bien = all(_rol(s, 'DELETE', gid, p['id'], rid) for rid in p['sacar'])
            bien = _rol(s, 'PUT', gid, p['id'], p['poner']) and bien
            hechos += 1 if bien else 0
            if not bien:
                print('     ⚠️ no pude con %s' % p['n'])
        print('  ✅ %d de %d' % (hechos, len(plan)))

    if not (crear or aplicar):
        print('\n  (no toqué nada — --crear hace los roles, --aplicar los reparte)\n')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
