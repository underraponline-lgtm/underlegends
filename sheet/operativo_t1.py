# -*- coding: utf-8 -*-
"""EL OPERATIVO, DICIENDO LA VERDAD SOBRE SÍ MISMO.

    python sheet/operativo_t1.py            qué cambiaría (no toca nada)
    python sheet/operativo_t1.py --aplicar  lo escribe

🔴 VARIAS HOJAS DESCRIBÍAN EL PROCESO VIEJO COMO SI FUERA EL DE HOY. Medido
el 24/09/2026 recorriendo las trece pestañas:

    AKAs                «Para fusiones, cambia el dropdown a ✅… se agregan
                        automáticamente» — y la cola «❓ FUSIONES
                        PENDIENTES» que eso atendía no la lee nadie: era el
                        Apps Script viejo. Es el mismo callejón sin salida
                        que tenía `Pendientes`.
                        Y «📊 Total aliases: 173», escrito a mano, con 189.
    Eventos Procesados  «Total 348 · ✅ 332 · ❌ 16 · Cazados 4 · Bounty
                        45000»: la pre-temporada, pegada como valor. La T1
                        tiene 7. Y un «🔍 Filtrar · Servidor: Todos» que no
                        filtraba nada.
    Config              «Temporada actual: Pre-Temporada 1».

⚠️ NO SE TOCA LO QUE LEE ALGÚN PROCESO. Las tablas de puntos, los
modificadores, el contador `B27` y el registro de Most Wanted —que ya dice
«(cerrada · 16/06)»— quedan como están.

⚠️ Y SE OCULTAN LAS HOJAS QUE NADIE MIRA, no se borran: `Entrada` (la llena
y la vacía el ciclo), `Pendientes` (el registro de `✅ Decidir`),
`Anuncios` (los anuncios salen de Discord), `Log` y `MW Puntos` (nadie
escribe en ellas). Ocultar se deshace con un click; borrar no. Dlx: *«el
sheet es más que todo información raw que cualquiera puede ver»*.
"""
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

import requests                                          # noqa: E402

from escribir import _pedir                              # noqa: E402

#: lo que se escribe, como en la hoja: (rango, filas)
VALORES = [
    ('AKAs!I1:I4', [
        ['📖 Instrucciones'],
        ['1. Alias nuevo: en la primera fila vacía de A-C (alias · nombre real · bandera).'],
        ['2. Dos que NO son la misma persona: en E-G.'],
        ['3. El ciclo lo toma solo en menos de media hora. Las dudas de '
         'identidad se contestan en ✅ Decidir.'],
    ]),
    ('AKAs!I6:J6', [['📊 Total aliases', '=COUNTA(A2:A)']]),
    # ⚠️ `LEN(…)>0` Y NO `COUNT` NI `COUNTA`. El `#` viene como texto —así
    # lo escribe el ciclo—, y `COUNT` sólo cuenta números: daba 1 de 7. Y
    # `COUNTA` cuenta las celdas con `""` que dejaron escrituras viejas:
    # daba 258 cazados en una columna vacía. Medido al aplicarlo.
    ("'Eventos Procesados'!E3:G3", [['=SUMPRODUCT(--(LEN(A6:A)>0))',
                                     '=COUNTIF(G6:G,"✅")',
                                     '=COUNTIF(G6:G,"❌")']]),
    ("'Eventos Procesados'!I3:J3", [['=SUMPRODUCT(--(LEN(I6:I)>0))',
                                     '=SUM(K6:K)']]),
    ('Config!B29', [['T1']]),
]
#: lo que se vacía (valores y listas desplegables)
VACIAR = ['AKAs!I8:K60', "'Eventos Procesados'!B1:C3",
          "'Eventos Procesados'!K2:K3"]
OCULTAR = ['Entrada', 'Pendientes', 'Anuncios', 'Log', 'MW Puntos']


def _ids():
    d = _pedir('GET', '?fields=sheets.properties(sheetId,title,hidden)')
    return {s['properties']['title']: s['properties'] for s in d['sheets']}


def _rango(a1, ids):
    """`'Hoja'!B1:C3` -> GridRange."""
    import re
    hoja, celdas = a1.rsplit('!', 1)
    hoja = hoja.strip("'")

    def rc(x):
        m = re.match(r'([A-Z]+)(\d+)', x)
        c = 0
        for ch in m.group(1):
            c = c * 26 + ord(ch) - 64
        return int(m.group(2)) - 1, c - 1
    a, b = celdas.split(':')
    (r0, c0), (r1, c1) = rc(a), rc(b)
    return {'sheetId': ids[hoja]['sheetId'], 'startRowIndex': r0,
            'endRowIndex': r1 + 1, 'startColumnIndex': c0,
            'endColumnIndex': c1 + 1}


def main():
    aplicar = '--aplicar' in sys.argv
    print('\n══ EL OPERATIVO, AL DÍA ══\n')
    ids = _ids()
    for rng, filas in VALORES:
        print('   %-30s %s' % (rng, ' · '.join(str(x) for f in filas
                                               for x in f)[:90]))
    for rng in VACIAR:
        print('   %-30s (se vacía)' % rng)
    for t in OCULTAR:
        print('   %-30s %s' % (t, 'ya oculta' if ids.get(t, {}).get('hidden')
                               else 'se oculta'))
    if not aplicar:
        print('\n   (simulacro: no escribí nada — corré con --aplicar)\n')
        return 0
    for rng in VACIAR:
        _pedir('POST', '/values/%s:clear' % requests.utils.quote(rng))
    # ⚠️ USER_ENTERED: las fórmulas tienen que quedar como fórmulas. Y en
    # la forma de la API —inglés y `,`— aunque la planilla esté en español:
    # es como la API devuelve las que ya hay (`Log!B5` dice
    # `=COUNTIF(B2:B500,"Bot")`), y es como las lee al escribir.
    _pedir('POST', '/values:batchUpdate', json={
        'valueInputOption': 'USER_ENTERED',
        'data': [{'range': r, 'values': f} for r, f in VALORES]})
    reqs = [{'setDataValidation': {'range': _rango(r, ids)}} for r in VACIAR]
    reqs += [{'updateSheetProperties': {
        'properties': {'sheetId': ids[t]['sheetId'], 'hidden': True},
        'fields': 'hidden'}} for t in OCULTAR if t in ids]
    _pedir('POST', ':batchUpdate', json={'requests': reqs})
    print('\n   ✅ escrito, vaciado y ocultado\n')
    return 0


if __name__ == '__main__':
    sys.exit(main())
