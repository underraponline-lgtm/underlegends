# -*- coding: utf-8 -*-
"""LOS ROLE ID DE RANGO EN `Consola`: de seis a ocho.

    python sheet/consola_t1.py            dice que pondria, NO escribe
    python sheet/consola_t1.py --aplicar  lo escribe

🔴 EL ULTIMO DE LOS CINCO LUGARES DONDE VIVE EL RANGO.

`CLAUDE.md` los tiene contados: `comun/rangos.py` (8), la columna del Sheet
(ya en 8), la Guia, el `Index.html` del Apps Script (6) y **los roles de
Discord**. De esos, el de los roles era *«el caro y el unico irreversible
de cara al publico»*.

✅ **Y RESULTA QUE LOS OCHO ROLES YA EXISTEN.** Verificado el 20/09/2026
contra la API de Discord, pidiendo los roles del guild de DRA:

    SSS  1550996501868584990   ◢◤👑◥◣ 𝐑𝐚𝐧𝐠𝐨 𝐒𝐒𝐒 ◢◤👑◥◣
    SS   1550996520067928106   ◢◤⚡◥◣ 𝐑𝐚𝐧𝐠𝐨 𝐒𝐒 ◢◤⚡◥◣
    S    1502241224910700574   ◢◤🐉◥◣ 𝐑𝐚𝐧𝐠𝐨 𝐒 ◢◤🐉◥◣
    ... y los cinco restantes

Los dos nuevos se crearon al revivir `sync.py`. O sea que la parte
irreversible **ya esta hecha**: lo que faltaba era que el Sheet lo supiera.
`Consola!D4:E10` seguia listando seis.

⚠️ LOS IDs NO SE ESCRIBEN ACA: SE VERIFICAN CONTRA DISCORD. El script pide
los roles del servidor y **corta si alguno no existe**. Un role ID
equivocado en esta hoja no falla: `sync.py` intenta asignar un rol que no
esta y la persona se queda sin ninguno.
"""
import io
import os
import sys

import requests

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

from escribir import poner, id_operativo, API, token     # noqa: E402
from comun.rangos import ORDEN                           # noqa: E402

HOJA = 'Consola'
FILA_CAB = 4
COL = 'D'          # D = Rango, E = Role ID

# ⚠️ EL ORDEN SALE DE `comun/rangos.py`, no de aca. Si manana entra un
# rango, este script lo pide y avisa que falta su rol.
ROLES = {
    'SSS': '1550996501868584990',
    'SS': '1550996520067928106',
    'S': '1502241224910700574',
    'A': '1502241261493682207',
    'B': '1502241301066678362',
    'C': '1502241353663250472',
    'D': '1502241394318770347',
    'E': '1502241424094003293',
}


def env(clave):
    p = os.path.join(BASE, '.env')
    for l in io.open(p, encoding='utf-8'):
        if l.strip().startswith(clave + '='):
            return l.split('=', 1)[1].strip().strip('"\'')
    sys.exit('falta %s en .env' % clave)


def guild_dra():
    import json
    p = os.path.join(BASE, 'datos', 'servidores.json')
    with io.open(p, encoding='utf-8') as f:
        return json.load(f)['servidores']['DRA']['guild_id']


def verificar():
    """Que los ocho roles existan de verdad. Devuelve {rango: nombre}."""
    r = requests.get('https://discord.com/api/v10/guilds/%s/roles' % guild_dra(),
                     headers={'Authorization': 'Bot ' + env('DISCORD_TOKEN')},
                     timeout=40)
    if not r.ok:
        sys.exit('no pude pedir los roles: %s %s' % (r.status_code, r.text[:140]))
    vivos = {x['id']: x['name'] for x in r.json()}
    out, faltan = {}, []
    for rg in ORDEN:
        rid = ROLES.get(rg)
        if not rid:
            faltan.append('%s (sin ID)' % rg)
        elif rid not in vivos:
            faltan.append('%s (%s no existe)' % (rg, rid))
        else:
            out[rg] = vivos[rid]
    if faltan:
        sys.exit('🔴 no escribo nada: %s' % ', '.join(faltan))
    return out


def main():
    aplicar = '--aplicar' in sys.argv
    nombres = verificar()

    hh = {'Authorization': 'Bearer ' + token()}
    act = requests.get('%s/%s/values/%s'
                       % (API, id_operativo(),
                          requests.utils.quote('%s!D4:E14' % HOJA)),
                       headers=hh, timeout=60).json().get('values', [])
    print('\n══ LOS ROLE ID DE RANGO ══\n')
    print('   como está:')
    for f in act:
        if f and str(f[0]).strip():
            print('      %-6s %s' % (f[0], f[1] if len(f) > 1 else ''))

    filas = [['Rango', 'Role ID']]
    for rg in ORDEN:
        filas.append([rg, ROLES[rg]])

    print('\n   como queda: %d rangos (todos verificados en Discord)'
          % (len(filas) - 1))
    for rg in ORDEN:
        print('      %-4s %-20s %s' % (rg, ROLES[rg], nombres[rg]))

    if not aplicar:
        print('\n   (simulacro: no escribí nada — corré con --aplicar)\n')
        return 0

    rng = '%s!%s%d:E%d' % (HOJA, COL, FILA_CAB, FILA_CAB + len(filas) - 1)
    poner(rng, filas)
    print('\n   ✅ %s escrito' % rng)
    print('')
    return 0


if __name__ == '__main__':
    sys.exit(main())
