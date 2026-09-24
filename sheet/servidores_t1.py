# -*- coding: utf-8 -*-
"""LA TABLA DE SERVIDORES DEL SHEET, CON SU `guild_id`.

    python sheet/servidores_t1.py            dice que pondria, NO escribe
    python sheet/servidores_t1.py --aplicar  lo escribe

🔴 POR QUE: `guild_id` ES LO QUE HACE POSIBLE `/card`.

Dlx decidio que `/card` abra en la carta **del servidor donde escribiste**.
Para saber cual es, hay que traducir el ID del servidor de Discord a `DRA`,
`TWR`, etc. `docs/sheet_t1.md` lo pone como la columna que desbloquea el
comando, y dice: *«Hoy esa tabla no existe en ningun lado»*.

Existe, pero **en el repo** (`datos/servidores.json`), no en el Sheet. Y el
Sheet tiene su propia lista en `Config!J25:L33` con
`Sigla · Nombre completo · Estado` — **siete servidores, sin guild_id**.

O sea: dos listas, uña incompleta, y la buena vive donde el Sheet no la ve.
Es la forma que este repo documenta tres veces.

QUE HACE
--------
Completa el bloque del Sheet desde `datos/servidores.json`: agrega los dos
que faltan (FFA y EFA) y las columnas `guild_id`, `color` e `invitacion`.

⚠️ LA FUENTE SIGUE SIENDO EL JSON. Esto **publica** la tabla en el Sheet
para que se pueda mirar y para que el dia que el Sheet mande, este; no la
parte en dos. Si se editan las dos, la que vale es el JSON — y el script lo
dice en la propia hoja, en una columna.
"""
import io
import json
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

HOJA = 'Config'
FILA_TIT = 25          # «🌐 SERVIDORES OFICIALES»
FILA_CAB = 26
COL0 = 'J'             # J..N
CABECERA = ['Sigla', 'Nombre completo', 'Estado', 'guild_id', 'Color']


def servidores():
    p = os.path.join(BASE, 'datos', 'servidores.json')
    with io.open(p, encoding='utf-8') as f:
        d = json.load(f)
    return d['servidores'], d


def main():
    aplicar = '--aplicar' in sys.argv
    sv, todo = servidores()

    hh = {'Authorization': 'Bearer ' + token()}
    act = requests.get('%s/%s/values/%s'
                       % (API, id_operativo(),
                          requests.utils.quote('%s!J25:N36' % HOJA)),
                       headers=hh, timeout=60).json().get('values', [])
    print('\n══ SERVIDORES EN EL SHEET ══\n')
    print('   como está:')
    for f in act:
        s = ' | '.join('%-22s' % str(c)[:22] for c in f)
        if s.strip(' |'):
            print('      %s' % s.rstrip())

    # 🔴 LOS NOMBRES NO COINCIDEN, Y NINGUNA LISTA GANA ENTERA. Medido:
    #
    #   sigla   el Sheet                  datos/servidores.json
    #   TWR     The World Rap             The Warren Rap        ← el repo
    #   SR      Sin Reglas                Snake Rap             ← el repo
    #   FRZ     Freezer                   Freestyle Zone        ← el repo
    #   TFC     The Freestyle Community   TFC                   ← el Sheet
    #   URBF    Urban Freestyle Battle    URBF                  ← el Sheet
    #
    # Tres del Sheet son otra expansion de la sigla —CLAUDE.md respalda las
    # del repo— y dos del repo son la sigla pelada, donde el Sheet tiene el
    # nombre de verdad. Pisar en cualquiera de las dos direcciones pierde
    # informacion.
    #
    # ⚠️ La regla es: **si el repo solo tiene la sigla, se conserva lo del
    # Sheet**. En el resto manda el repo, que es el que usa el bot. Los
    # choques se listan al final; resolverlos es de Dlx.
    nombre_sheet = {}
    for f in act:
        if len(f) >= 2 and str(f[0]).strip() in sv:
            nombre_sheet[str(f[0]).strip()] = str(f[1]).strip()

    choques = []
    filas = [CABECERA]
    for cod in sorted(sv, key=lambda c: (not sv[c].get('en_el_sheet'), c)):
        d = sv[cod]
        nom_repo = d.get('nombre', '')
        nom_hoja = nombre_sheet.get(cod, '')
        if nom_hoja and nom_repo == cod:
            nom = nom_hoja                      # el repo solo tiene la sigla
        else:
            nom = nom_repo
        if nom_hoja and nom_repo and nom_hoja != nom_repo:
            choques.append((cod, nom_hoja, nom_repo, nom))
        d = dict(d, nombre=nom)
        filas.append([cod, d.get('nombre', ''),
                      'Activo' if d.get('en_el_sheet') else 'Sin columna',
                      # ⚠️ SIN EL APOSTROFO DE «esto es texto». Lo puse y
                      # quedo LITERAL en la celda: `'841017460341604382`.
                      # Ese prefijo lo interpreta `USER_ENTERED`, no `RAW`
                      # — y con RAW una cadena ya se guarda como cadena,
                      # asi que no hay riesgo de que Sheets redondee el
                      # snowflake de 18 digitos. El apostrofo sobraba y
                      # ademas ensuciaba el dato.
                      str(d.get('guild_id', '')),
                      d.get('color', '')])

    print('\n   como queda: %d servidores' % (len(filas) - 1))
    for f in filas[1:]:
        print('      %-6s %-24s %-12s %s' % (f[0], f[1][:24], f[2], f[3]))

    faltan = [c for c in sv if not sv[c].get('guild_id')]
    if faltan:
        print('\n   🔴 sin guild_id: %s' % ', '.join(faltan))

    if choques:
        print('\n   🔴 %d nombres no coinciden entre el Sheet y el repo:'
              % len(choques))
        for cod, hoja, repo, elegido in choques:
            quien = 'el Sheet' if elegido == hoja else 'el repo'
            print('      %-6s Sheet «%s» · repo «%s»  → queda el de %s'
                  % (cod, hoja[:24], repo[:24], quien))
        print('      (la regla: si el repo sólo tiene la sigla, gana el '
              'Sheet; si no, gana el repo)')

    if not aplicar:
        print('\n   (simulacro: no escribí nada — corré con --aplicar)\n')
        return 0

    fin = chr(ord(COL0) + len(CABECERA) - 1)
    rng = '%s!%s%d:%s%d' % (HOJA, COL0, FILA_CAB, fin,
                            FILA_CAB + len(filas) - 1)
    poner(rng, filas)
    print('\n   ✅ %s escrito' % rng)

    # de dónde sale, escrito en la propia hoja
    nota = [['⚠️ La fuente es datos/servidores.json del repo. '
             'Si se editan los dos, vale el JSON.']]
    poner('%s!%s%d' % (HOJA, COL0, FILA_CAB + len(filas)), nota)
    print('   ✅ nota de procedencia')
    print('')
    return 0


if __name__ == '__main__':
    sys.exit(main())
