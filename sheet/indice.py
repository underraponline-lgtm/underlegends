# -*- coding: utf-8 -*-
"""EL LOBBY DEL OFICIAL, COMO ÍNDICE DE LOS DATOS EN CRUDO.

    python sheet/indice.py            cómo quedaría (no toca nada)
    python sheet/indice.py --aplicar  rehace la hoja `Lobby`

🔴 EL SHEET YA NO ES LA VITRINA. Dlx, 24/09/2026: *«el hub será esta página
y principalmente nuestro servidor… el sheet es más que todo información raw
que cualquiera puede ver»*. El `Lobby` seguía siendo un afiche —66 celdas
combinadas, récords, «STATS LOCAS», la cuenta atrás, el Most Wanted de la
pre-temporada con la etiqueta «⚠️ de la PRE-TEMPORADA»— que `lobby.py`
rellenaba celda por celda cada media hora. Lo que el afiche mostraba ya lo
muestra `underlegends.pages.dev`, y mejor.

Así que el `Lobby` pasa a decir **qué hay en cada hoja**, cuántas filas, y
qué eventos de la T1 se procesaron. Sin combinar celdas: una tabla que se
lee de arriba abajo.

⚠️ LOS NÚMEROS SE LEEN, NO SE ESCRIBEN A MANO: las filas de cada ranking se
cuentan en la hoja, y los eventos salen de `Eventos Procesados`. Un índice
que dijera «86» a mano sería el `173` de la hoja AKAs otra vez.
"""
import os
import sys
import time

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

import requests                                          # noqa: E402

HOJA = 'Lobby'
TITULO = 'LIGA GLOBAL · T1 — los datos en crudo'
HUB = 'https://underlegends.pages.dev'
#: (hoja, qué hay). El orden es el de la planilla.
HOJAS = [
    ('Ranking Temporada', 'Cada rapero de la T1: puntos, eventos, win %, '
     'medallas y eventos por servidor. Ordenado por OVR.'),
    ('Ranking Competitivo', 'Score y rango. Aparece quien llega a 10 eventos.'),
    ('Ranking Podios', 'Quién subió al podio y cuántas veces.'),
    ('Ranking Duelos', 'Los duelos 1 contra 1: ganados y jugados.'),
    ('Ranking Mundial', 'Los países, por los puntos que hizo su gente.'),
]


def _hora_et():
    import datetime
    ahora = datetime.datetime.now(datetime.timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        return ahora.astimezone(ZoneInfo('America/New_York')).strftime(
            '%d/%m %I:%M %p ET')
    except Exception:                                    # noqa: BLE001
        return (ahora - datetime.timedelta(hours=4)).strftime('%d/%m %I:%M %p ET')


def armar():
    """(filas, ids) — lo que va en la hoja y los sheetId del Oficial."""
    from planillas import OFICIAL
    import rankings as R
    meta = R._api('GET', OFICIAL, '?fields=sheets.properties(sheetId,title,'
                  'gridProperties)')
    ids = {s['properties']['title']: s['properties']['sheetId']
           for s in meta['sheets']}
    ids['_grilla'] = {s['properties']['title']: s['properties'].get(
        'gridProperties', {}) for s in meta['sheets']}
    rangos = ["'%s'!A2:A" % h for h, _q in HOJAS if h in ids]
    rangos.append("'%s'!A1" % HOJA)
    v = R._api('GET', OFICIAL, '/values:batchGet?' + '&'.join(
        'ranges=' + requests.utils.quote(r) for r in rangos))
    cuenta = {}
    vr = v.get('valueRanges', [])
    for (h, _q), r in zip([x for x in HOJAS if x[0] in ids], vr):
        cuenta[h] = sum(1 for f in r.get('values', [])
                        if f and str(f[0]).strip())
    # ¿la hoja ya es el índice? Entonces alcanza con los números
    a1 = ((vr[-1].get('values') or [['']])[0] or [''])[0] if vr else ''
    ids['_ya_es'] = str(a1).strip() == TITULO
    from escribir import Hoja
    evs = []
    for f in Hoja('Eventos Procesados').filas():
        f = [str(x).strip() for x in list(f) + [''] * 7]
        if f[0].isdigit():
            evs.append(f[:6])
    evs.sort(key=lambda f: -int(f[0]))

    filas = [
        [TITULO, '', ''],
        ['Toda la información de la Liga, sin adornos, para quien quiera '
         'mirarla. Para verla bien: %s y el servidor de Discord.' % HUB, '', ''],
        ['Se actualiza solo cada media hora · %s' % _hora_et(), '', ''],
        ['', '', ''],
        ['HOJA', 'QUÉ HAY', 'FILAS'],
    ]
    for h, que in HOJAS:
        if h not in ids:
            continue
        n = cuenta.get(h, 0)
        if h == 'Ranking Competitivo' and not n:
            que += ' Todavía nadie.'
        filas.append(['=HYPERLINK("#gid=%d","%s")' % (ids[h], h), que, n])
    filas += [['', '', ''],
              ['EVENTOS DE LA T1 · %d' % len(evs), '', ''],
              ['#', 'Evento', 'Servidor', 'Fecha', 'Participantes', 'Escala']]
    filas += evs
    return filas, ids


def aplicar(filas, ids):
    """Deja la hoja en blanco —sin combinar, sin formato— y escribe."""
    from planillas import OFICIAL
    import rankings as R
    import json
    import io
    sid = ids[HOJA]
    g = ids['_grilla'].get(HOJA) or {}
    n_filas, n_cols = g.get('rowCount', 500), g.get('columnCount', 13)
    # ⚠️ SI YA ES EL ÍNDICE, SÓLO LOS NÚMEROS. Rehacerla entera cada media
    # hora —descombinar, borrar formato, respaldar— gastaría cuota y dejaría
    # un respaldo por corrida. La forma no cambia; cambian las cifras.
    if ids.get('_ya_es'):
        # ⚠️ TODO EL ANCHO, NO SÓLO A:F: si alguna vez corre el afiche viejo
        # —`lobby.py`— deja celdas hasta la M, y limpiar A:F las dejaría
        # colgando al lado del índice.
        ult = chr(ord('A') + min(n_cols, 26) - 1)
        R._api('POST', OFICIAL, '/values/%s:clear'
               % requests.utils.quote("'%s'!A1:%s%d" % (HOJA, ult, n_filas)))
        R._api('PUT', OFICIAL, '/values/%s?valueInputOption=USER_ENTERED'
               % requests.utils.quote("'%s'!A1" % HOJA), json={'values': filas})
        print('   ✅ `Lobby`: números al día')
        return
    # respaldo de lo que había, con fórmulas
    viejo = R._api('GET', OFICIAL, '/values/%s?valueRenderOption=FORMULA'
                   % requests.utils.quote("'%s'!A1:Z200" % HOJA))
    p = os.path.join(BASE, 'docs', 'sheet_respaldo',
                     'lobby_%s.json' % time.strftime('%Y%m%d_%H%M'))
    with io.open(p, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(viejo, f, ensure_ascii=False, indent=1)
    print('   respaldo -> %s' % os.path.relpath(p, BASE))
    # ⚠️ LA GRILLA REAL, NO UNA SUPUESTA: el Lobby mide 500x13 y un rango
    # más ancho es un 400 que tumba el batch entero.
    todo = {'sheetId': sid, 'startRowIndex': 0, 'endRowIndex': n_filas,
            'startColumnIndex': 0, 'endColumnIndex': n_cols}
    R._api('POST', OFICIAL, ':batchUpdate', json={'requests': [
        {'unmergeCells': {'range': todo}},
        # y las listas y notas viejas también: son de la celda, no del valor
        {'updateCells': {'range': todo, 'fields': 'userEnteredValue,'
                         'userEnteredFormat,dataValidation,note'}},
    ]})
    R._api('PUT', OFICIAL, '/values/%s?valueInputOption=USER_ENTERED'
           % requests.utils.quote("'%s'!A1" % HOJA), json={'values': filas})
    n_hojas = sum(1 for h, _q in HOJAS if h in ids)
    fila_ev = 5 + n_hojas + 2          # índice 0 de «#, Evento, …»
    reqs = [
        {'repeatCell': {'range': dict(todo, endRowIndex=1),
                        'cell': {'userEnteredFormat': {'textFormat': {
                            'bold': True, 'fontSize': 14}}},
                        'fields': 'userEnteredFormat.textFormat'}},
        {'repeatCell': {'range': dict(todo, startRowIndex=1, endRowIndex=3),
                        'cell': {'userEnteredFormat': {'textFormat': {
                            'foregroundColor': {'red': .35, 'green': .35,
                                                'blue': .35}}}},
                        'fields': 'userEnteredFormat.textFormat'}},
    ]
    for r in (4, fila_ev - 1, fila_ev):
        reqs.append({'repeatCell': {
            'range': dict(todo, startRowIndex=r, endRowIndex=r + 1),
            'cell': {'userEnteredFormat': {'textFormat': {'bold': True}}},
            'fields': 'userEnteredFormat.textFormat'}})
    for i, ancho in enumerate((230, 520, 90, 80, 110, 80)):
        reqs.append({'updateDimensionProperties': {
            'range': {'sheetId': sid, 'dimension': 'COLUMNS',
                      'startIndex': i, 'endIndex': i + 1},
            'properties': {'pixelSize': ancho}, 'fields': 'pixelSize'}})
    R._api('POST', OFICIAL, ':batchUpdate', json={'requests': reqs})
    print('   ✅ `Lobby`: índice de %d hoja(s) y %d evento(s)'
          % (n_hojas, len(filas) - fila_ev - 1))


def main():
    filas, ids = armar()
    print('\n══ EL LOBBY, COMO ÍNDICE ══\n')
    for f in filas:
        print('   ' + ' | '.join(str(x) for x in f if str(x) != '')[:140])
    if '--aplicar' not in sys.argv:
        print('\n   (simulacro: no escribí nada — corré con --aplicar)\n')
        return 0
    aplicar(filas, ids)
    return 0


if __name__ == '__main__':
    sys.exit(main())
