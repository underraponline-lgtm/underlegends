# -*- coding: utf-8 -*-
"""COMO SE VE UNA VITRINA. Un solo lugar para las cinco.

    python sheet/estilo.py            la paleta y lo que decide cada regla
    python sheet/estilo.py --auto     el self-check, sin red

🔴 EXISTE PORQUE «REDISEÑO» ERA UNA CABECERA OSCURA Y NADA MAS. Dlx,
23/09/2026: *«asegurate que el rediseño se note bastante»*. Y tenia
razon: `rehacer_hoja()` dejaba la cabecera en la fila 1, congelada,
negra y en negrita — correcto, necesario, y **exactamente igual que
cualquier tabla de Google**. Lo unico que se notaba era lo que se habia
sacado.

⚠️ LA DIFERENCIA ENTRE «LIMPIO» Y «DISEÑADO» ES QUE EL COLOR SIGNIFIQUE
ALGO. Pintar filas alternadas es cosmetica; pintar la celda de `Rango`
con el color de ESE rango es la misma informacion que la carta ya da,
en la vitrina. Por eso todo lo de este archivo sale de un dato:

    Rango        el color de `comun/rangos.py`, los mismos ocho
    #1 #2 #3     oro, plata y bronce — los mismos que las medallas
    Win%         escala de color, porque es la unica columna comparable
    🔥           llama cuando la racha esta viva

⚠️ Y NO SE DUPLICA NINGUN COLOR. Los ocho de rango se importan de
`comun/rangos.py`; si alguien mueve el amatista ahi, la vitrina lo
sigue. Era el error que este repo ya se comio con las crews y con el
divisor: *«la decision existia en un lugar y el codigo la leia de
otro»*.

⚠️ VIVE EN `sheet/` Y NO EN `comun/`. `comun/huella_codigo.py` cubre
`comun/` entera para las cuatro cartas, asi que un archivo nuevo ahi
cuesta un redibujo de 4 x N personas. Esto no dibuja ninguna carta.
"""
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE)

from comun.rangos import ACENTO as COLOR_RANGO, ORDEN as RANGOS  # noqa: E402


def hex_a_rgb(h):
    """`'#C77DFF'` -> `{'red': .78, 'green': .49, 'blue': 1.0}`."""
    h = str(h).lstrip('#')
    if len(h) == 3:
        h = ''.join(c * 2 for c in h)
    return {'red': int(h[0:2], 16) / 255.0,
            'green': int(h[2:4], 16) / 255.0,
            'blue': int(h[4:6], 16) / 255.0}


def _mezclar(h, con, cuanto):
    """`h` acercado a `con` en `cuanto` (0..1). Devuelve rgb de la API.

    ⚠️ EXISTE PARA QUE EL TEXTO SE LEA. El amatista del SSS a fondo
    pleno con letra negra da poco contraste y con letra blanca tampoco;
    mezclado al 18 % con el fondo oscuro queda como un **tinte** que se
    identifica de reojo y deja el texto en blanco puro.
    """
    a, b = hex_a_rgb(h), hex_a_rgb(con)
    return {k: b[k] + (a[k] - b[k]) * cuanto for k in ('red', 'green', 'blue')}


# ── la paleta de la vitrina ──────────────────────────────────────────────
#
# ⚠️ ES LA DE LAS CARTAS, no una nueva. `#0D0D14`, `#161622` y `#2A2A40`
# son los mismos tres tonos que el Apps Script del Oficial ya usa en su
# `:root`, y por eso la planilla y la web se ven de la misma familia.
FONDO = '#0D0D14'        # el fondo de la carta
CABECERA = '#161622'     # la banda de la cabecera
FILA_A = '#FFFFFF'       # las filas, alternadas
FILA_B = '#F1F3F9'
TEXTO = '#1C1C2E'
BORDE = '#C9CEDC'

#: Oro, plata y bronce del podio. Los mismos que `🥇🥈🥉` ya significan.
PODIO = ('#FFD24A', '#D8DEE8', '#C98A4B')


def color_rango(rg):
    """El tinte de fondo para una celda de `Rango`. `None` si no es uno.

    ⚠️ ACEPTA SUBRANGOS. En la vitrina el rango puede venir `A+` o `B−`
    —`comun/rangos.py` parte A, B, C y D en tercios— y el color es el
    del tramo, no el del signo: *«el signo cambia la pastilla, no el
    color»*. Sin esto, las cuatro letras mas pobladas se quedaban
    blancas, que es justo el 80 % de la gente.
    """
    if not rg:
        return None
    letra = str(rg).strip().rstrip('+-−—').strip()
    h = COLOR_RANGO.get(letra.upper())
    return _mezclar(h, FILA_A, 0.55) if h else None


def _uno(hid, fila, col, rgb, negrita=False):
    """Un `repeatCell` de fondo (y opcionalmente negrita) en una celda."""
    fmt = {'backgroundColorStyle': {'rgbColor': rgb}}
    campos = 'userEnteredFormat.backgroundColorStyle'
    if negrita:
        fmt['textFormat'] = {'bold': True}
        campos += ',userEnteredFormat.textFormat.bold'
    return {'repeatCell': {
        'range': {'sheetId': hid, 'startRowIndex': fila, 'endRowIndex': fila + 1,
                  'startColumnIndex': col, 'endColumnIndex': col + 1},
        'cell': {'userEnteredFormat': fmt}, 'fields': campos}}


#: Cuanto mide cada columna. Lo que no esta acá va en `ANCHO_NUM`.
#:
#: ⚠️ LOS ANCHOS SON LA MITAD DEL REDISEÑO Y NO SE VEN EN NINGUN COLOR.
#: Con el ancho por defecto (100 px) una vitrina de 27 columnas mide
#: 2.700 px: hay que arrastrar la barra para llegar a los servidores y el
#: nombre —lo unico que se busca— queda perdido entre numeros del mismo
#: tamaño. Con esto entra en una pantalla.
ANCHO = {'#': 44, 'Rapero': 168, 'País': 140, 'Sv': 56, 'Rango': 64,
         'Puntos': 72, 'Win%': 62, 'Último Resultado': 150,
         'Vs Ranking Temporada': 92, 'Vs Ranking Competitivo': 92,
         'Mejor': 130, 'Pts del mejor': 92, 'Raperos': 70, 'Duelos': 62,
         'Ganados': 68, 'Perdidos': 70, 'Pts Podio': 74, 'Score': 64,
         'Conf': 56, 'Eventos': 66}
ANCHO_NUM = 46


def ancho_de(c):
    """Cuánto mide esa columna. Nunca menos que su propio título.

    🔴 UNA COLUMNA MAS ANGOSTA QUE SU TITULO LO CORTA, y con
    `wrapStrategy: CLIP` lo corta **sin puntos suspensivos**: en
    `Ranking Competitivo` la cabecera decía `onfianz`, `onsiste`,
    `Dominan` y `TechDiversin` — o sea que las cinco dimensiones, que
    son de lo que esa hoja trata, no se podían leer.

    ⚠️ ES UNA REGLA Y NO UNA LISTA A MANO. `ANCHO` tiene las que quiero
    fijar; cualquier columna nueva —una dimensión más, un servidor que
    entre— se acomoda sola. Una lista a mano habría dejado el mismo bug
    esperando a la próxima columna de nombre largo.

    ⚠️ 7 px POR CARACTER más 14 de aire, medido sobre Inter a 10 px: con
    6 se cortaba `Consistencia` y con 8 la tabla se iba de pantalla.
    """
    fijo = ANCHO.get(c)
    if fijo:
        return fijo
    return max(ANCHO_NUM, len(str(c or '')) * 7 + 14)

#: Las que llevan texto a la izquierda. El resto va centrado.
#:
#: ⚠️ CENTRAR NUMEROS Y ALINEAR NOMBRES A LA IZQUIERDA no es gusto: una
#: columna de nombres centrada no tiene borde comun por donde leer, y una
#: de numeros a la izquierda separa el 9 del 10.
IZQUIERDA = ('Rapero', 'País', 'Último Resultado', 'Mejor', 'Crew')


def formato(hid, cab, n_filas, top=3):
    """Las peticiones de formato para una vitrina ya escrita.

    `hid` es el `sheetId`, `cab` la cabecera y `n_filas` cuántas filas de
    datos hay **sin contar la cabecera**.

    Devuelve una lista de `requests` para `:batchUpdate`. No pide nada a
    la red: se puede probar sin credenciales, y el self-check lo hace.
    """
    ancho = max(len(cab), 1)
    fin = n_filas + 1
    idx = {c: i for i, c in enumerate(cab)}
    pet = []

    # ── la cabecera: alta, oscura, centrada, congelada ───────────────
    pet.append({'repeatCell': {
        'range': {'sheetId': hid, 'startRowIndex': 0, 'endRowIndex': 1,
                  'startColumnIndex': 0, 'endColumnIndex': ancho},
        'cell': {'userEnteredFormat': {
            'backgroundColorStyle': {'rgbColor': hex_a_rgb(CABECERA)},
            'textFormat': {'bold': True, 'fontSize': 10,
                           'fontFamily': 'Inter',
                           'foregroundColorStyle': {
                               'rgbColor': hex_a_rgb('#FFFFFF')}},
            'horizontalAlignment': 'CENTER',
            'verticalAlignment': 'MIDDLE',
            'wrapStrategy': 'CLIP',
        }},
        'fields': 'userEnteredFormat(backgroundColorStyle,textFormat,'
                  'horizontalAlignment,verticalAlignment,wrapStrategy)'}})
    pet.append({'updateDimensionProperties': {
        'range': {'sheetId': hid, 'dimension': 'ROWS',
                  'startIndex': 0, 'endIndex': 1},
        'properties': {'pixelSize': 34}, 'fields': 'pixelSize'}})
    # 🔴 Y LAS FILAS DE DATOS, TODAS IGUALES. Las hojas viejas traen
    # alturas a mano de su maqueta anterior —medido en `Ranking
    # Competitivo`: la fila 5 medía el doble que la 4— y eso sobrevive a
    # `updateCells`, que limpia valores y formato pero **no la
    # dimensión**. Una tabla con filas de distinto alto se lee como si
    # alguna estuviera seleccionada.
    if n_filas:
        pet.append({'updateDimensionProperties': {
            'range': {'sheetId': hid, 'dimension': 'ROWS',
                      'startIndex': 1, 'endIndex': fin},
            'properties': {'pixelSize': 24}, 'fields': 'pixelSize'}})

    # 🔴 SE CONGELAN DOS COLUMNAS, NO UNA. `Ranking Temporada` tiene 29
    # columnas: al llegar a los servidores el nombre ya se fue de
    # pantalla y la fila deja de decir de quien es. Congelar `#` y
    # `Rapero` es lo que hace usable una tabla ancha.
    pet.append({'updateSheetProperties': {
        'properties': {'sheetId': hid,
                       'gridProperties': {'frozenRowCount': 1,
                                          'frozenColumnCount': 2}},
        'fields': 'gridProperties(frozenRowCount,frozenColumnCount)'}})

    if not n_filas:
        return pet

    # ── el cuerpo: tipografia y alineacion ───────────────────────────
    pet.append({'repeatCell': {
        'range': {'sheetId': hid, 'startRowIndex': 1, 'endRowIndex': fin,
                  'startColumnIndex': 0, 'endColumnIndex': ancho},
        'cell': {'userEnteredFormat': {
            'textFormat': {'fontSize': 10, 'fontFamily': 'Inter',
                           'foregroundColorStyle': {
                               'rgbColor': hex_a_rgb(TEXTO)}},
            'horizontalAlignment': 'CENTER',
            'verticalAlignment': 'MIDDLE',
        }},
        'fields': 'userEnteredFormat(textFormat,horizontalAlignment,'
                  'verticalAlignment)'}})
    for c in IZQUIERDA:
        if c in idx:
            pet.append({'repeatCell': {
                'range': {'sheetId': hid, 'startRowIndex': 1, 'endRowIndex': fin,
                          'startColumnIndex': idx[c], 'endColumnIndex': idx[c] + 1},
                'cell': {'userEnteredFormat': {'horizontalAlignment': 'LEFT'}},
                'fields': 'userEnteredFormat.horizontalAlignment'}})
    # el nombre, en negrita: es la columna que se busca
    if 'Rapero' in idx or 'País' in idx:
        c = idx.get('Rapero', idx.get('País'))
        pet.append({'repeatCell': {
            'range': {'sheetId': hid, 'startRowIndex': 1, 'endRowIndex': fin,
                      'startColumnIndex': c, 'endColumnIndex': c + 1},
            'cell': {'userEnteredFormat': {'textFormat': {'bold': True}}},
            'fields': 'userEnteredFormat.textFormat.bold'}})

    # ── las bandas ───────────────────────────────────────────────────
    #
    # ⚠️ BANDAS DE VERDAD (`addBanding`) Y NO UNA FILA SI Y UNA NO
    # PINTADA A MANO. Pintar 300 filas son 300 peticiones y se pierde al
    # ordenar; el banding es **una** y Sheets lo recalcula solo cuando
    # alguien ordena la tabla, que es lo que Dlx va a hacer.
    pet.append({'addBanding': {'bandedRange': {
        'range': {'sheetId': hid, 'startRowIndex': 0, 'endRowIndex': fin,
                  'startColumnIndex': 0, 'endColumnIndex': ancho},
        'rowProperties': {
            'headerColorStyle': {'rgbColor': hex_a_rgb(CABECERA)},
            'firstBandColorStyle': {'rgbColor': hex_a_rgb(FILA_A)},
            'secondBandColorStyle': {'rgbColor': hex_a_rgb(FILA_B)}}}}})

    # ── los anchos ───────────────────────────────────────────────────
    for i, c in enumerate(cab):
        pet.append({'updateDimensionProperties': {
            'range': {'sheetId': hid, 'dimension': 'COLUMNS',
                      'startIndex': i, 'endIndex': i + 1},
            'properties': {'pixelSize': ancho_de(c)}, 'fields': 'pixelSize'}})

    # ── el podio ─────────────────────────────────────────────────────
    #
    # ⚠️ SOLO LA CELDA DEL `#`, NO LA FILA ENTERA. Una fila dorada
    # entera pelea con el color del rango y con la escala del Win%, que
    # son los dos que dicen algo. El `#` es donde el ojo ya busca el
    # puesto.
    if '#' in idx:
        for i in range(min(top, n_filas)):
            pet.append(_uno(hid, 1 + i, idx['#'], hex_a_rgb(PODIO[i]),
                            negrita=True))

    return pet


def por_fila(hid, cab, filas):
    """Lo que depende del VALOR de cada fila: el color del rango.

    ⚠️ VA APARTE DE `formato()` A PROPOSITO. Todo lo de allá se decide
    con la cabecera y la cantidad de filas; esto necesita leer los datos.
    Separarlos es lo que deja probar el 90 % del estilo sin datos.
    """
    idx = {c: i for i, c in enumerate(cab)}
    if 'Rango' not in idx:
        return []
    col = idx['Rango']
    pet = []
    for i, f in enumerate(filas):
        rgb = color_rango(f[col] if col < len(f) else '')
        if rgb:
            pet.append(_uno(hid, 1 + i, col, rgb, negrita=True))
    return pet


def condicionales(hid, cab, n_filas):
    """Las reglas que Sheets recalcula solo: Win% y la racha.

    ⚠️ CONDICIONAL Y NO PINTADO: si Dlx edita una celda a mano, o el
    ciclo escribe un valor nuevo, el color se corrige solo. Un color
    pintado se queda con el numero de ayer — que es el mismo error que
    la Bloqueada tenia con su contador.
    """
    idx = {c: i for i, c in enumerate(cab)}
    fin = n_filas + 1
    pet = []
    if 'Win%' in idx and n_filas:
        c = idx['Win%']
        col = _col_letra(c)
        # 🔴 EL GRADIENTE NO FUNCIONABA, Y EL MOTIVO ES QUE `Win%` ES
        # TEXTO. La primera version pedia un `gradientRule` con MIN y
        # MAX — correcto para una columna de numeros, y esta guarda
        # `"66.7%"` como **cadena**: `escribir_vitrina()` escribe con
        # `valueInputOption=RAW`, asi que el `%` la vuelve texto. Un
        # gradiente sobre texto no interpola nada y no da ningun error:
        # la columna sale sin pintar y parece que la regla no se aplico.
        # Medido leyendo la hoja: `Puntos` y `Ev` vuelven `numberValue`
        # y `Win%` vuelve `stringValue`.
        #
        # ⚠️ Y NO SE CAMBIA EL DATO A NUMERO, aunque seria mas prolijo:
        # `construir_pool_temporada.py` y `construir_pool_competitivo.py`
        # lo leen con `.strip()`, o sea contando con que es texto.
        # Cambiar el tipo para ganar un color es arriesgar los dos pools
        # por un adorno.
        #
        # ⚠️ POR ESO SON TRES REGLAS DE FORMULA Y NO UNA ESCALA. La
        # formula sirve para las dos formas —`ISTEXT` decide— asi que el
        # dia que la columna pase a numero el color sigue andando.
        def _n(v):
            return ('IFERROR(IF(ISTEXT({c}2),VALUE(SUBSTITUTE({c}2,"%","")),'
                    '{c}2*100),-1)>={v}'.format(c='$' + col, v=v))
        for i, (desde, tono) in enumerate(((60, '#BFE9CD'),
                                           (35, '#FBEFB8'),
                                           (0, '#F6CFCF'))):
            pet.append({'addConditionalFormatRule': {'rule': {
                'ranges': [{'sheetId': hid, 'startRowIndex': 1,
                            'endRowIndex': fin,
                            'startColumnIndex': c, 'endColumnIndex': c + 1}],
                'booleanRule': {
                    'condition': {'type': 'CUSTOM_FORMULA', 'values': [
                        {'userEnteredValue':
                         '=AND(%s2<>"",%s)' % ('$' + col, _n(desde))}]},
                    'format': {'backgroundColorStyle': {
                        'rgbColor': hex_a_rgb(tono)}}}},
                # ⚠️ EL ORDEN IMPORTA: gana la primera que da verdadero,
                # asi que van de mas exigente a menos. Al reves, todo lo
                # que sea >= 0 se pintaria rojo y las otras dos no se
                # verian nunca.
                'index': i}})
    if '🔥' in idx and n_filas:
        c = idx['🔥']
        # ⚠️ LA RACHA ES TEXTO `actual/maxima`, NO UN NUMERO — es una de
        # las tres trampas del Sheet que CLAUDE.md ya lista. Una racha
        # viva es la que NO empieza en `0/`.
        #
        # 🔴 PERO «NO CONTIENE 0/» ES CIERTO PARA UNA CELDA VACIA, y por
        # eso la primera version pinto de naranja a NUEVE personas sin
        # racha. Se vio en la captura: la columna entera encendida,
        # incluidas las filas en blanco. Es la forma de siempre —una
        # condicion que parece la correcta y contesta que si donde no hay
        # nada— y la unica manera de cazarla fue mirar la hoja.
        #
        # ⚠️ POR ESO VA `CUSTOM_FORMULA` Y NO UN `TEXT_*`: hay que poder
        # pedir DOS cosas, que haya dato y que no arranque en cero.
        col = _col_letra(c)
        pet.append({'addConditionalFormatRule': {'rule': {
            'ranges': [{'sheetId': hid, 'startRowIndex': 1,
                        'endRowIndex': fin,
                        'startColumnIndex': c, 'endColumnIndex': c + 1}],
            'booleanRule': {
                'condition': {'type': 'CUSTOM_FORMULA', 'values': [
                    {'userEnteredValue':
                     '=AND(${c}2<>"",LEFT(TO_TEXT(${c}2),2)<>"0/")'.format(c=col)}]},
                'format': {
                    'backgroundColorStyle': {'rgbColor': hex_a_rgb('#FFD5A8')},
                    'textFormat': {'bold': True}}}},
            'index': 0}})
    return pet


def _col_letra(i):
    """0 -> A, 25 -> Z, 26 -> AA. Para las fórmulas condicionales."""
    s, i = '', i + 1
    while i:
        i, r = divmod(i - 1, 26)
        s = chr(65 + r) + s
    return s


def limpiar(hid):
    """Saca bandas y condicionales viejas. Va ANTES de volver a poner.

    🔴 SIN ESTO SE APILAN. `addBanding` sobre una hoja que ya tiene una
    banda da `400: You can't add a banded range that overlaps` y se cae
    el batch entero — o sea que la segunda corrida del ciclo rompe lo
    que la primera dejo bien. Las condicionales no fallan: se **suman**,
    y a la decima corrida la hoja tiene diez reglas iguales.
    """
    return [{'deleteBanding': {'bandedRangeId': None}},        # se completa fuera
            {'deleteConditionalFormatRule': {'sheetId': hid, 'index': 0}}]


def _self_check():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:                                    # noqa: BLE001
        pass
    print('\n  estilo.py — self-check\n')
    mal = 0

    def ok(cond, que):
        nonlocal mal
        mal += not cond
        print('   %s %s' % ('ok' if cond else '🔴', que))

    ok(hex_a_rgb('#FFFFFF') == {'red': 1.0, 'green': 1.0, 'blue': 1.0},
       'el blanco da 1,1,1')
    ok(hex_a_rgb('#000') == {'red': 0.0, 'green': 0.0, 'blue': 0.0},
       'acepta el formato corto')

    # 🔴 LOS OCHO RANGOS TIENEN COLOR, Y LOS SUBRANGOS TAMBIEN. Si
    # `color_rango` no pelara el signo, A+, A− y sus pares de B, C y D
    # —el 80 % de la gente— se quedarian sin tinte y el rediseño se
    # notaria justo en nadie.
    faltan = [r for r in RANGOS if color_rango(r) is None]
    ok(not faltan, 'los ocho rangos tienen color (faltan: %s)' % (faltan or '—'))
    ok(color_rango('A+') == color_rango('A') == color_rango('A−'),
       'el subrango NO cambia el color, solo la pastilla')
    ok(color_rango('') is None and color_rango(None) is None,
       'sin rango no se pinta nada')

    cab = ['#', 'Rapero', 'Sv', 'Rango', 'Puntos', 'Win%', '🔥']
    pet = formato(1234, cab, 10)
    tipos = [list(p)[0] for p in pet]
    ok('addBanding' in tipos, 'pide las bandas')
    ok(tipos.count('updateDimensionProperties') >= len(cab),
       'le da ancho a cada columna')
    # 🔴 Y NINGUNA MAS ANGOSTA QUE SU TITULO. `Consistencia` en 46 px
    # salia como `onsiste`: la cabecera va con CLIP, asi que corta sin
    # avisar. Las cinco dimensiones del Competitivo eran ilegibles.
    largas = ['Confianza', 'Eficiencia', 'Consistencia', 'Dominancia',
              'Diversidad']
    flacas = [c for c in largas if ancho_de(c) < len(c) * 7]
    ok(not flacas, 'ninguna columna es mas angosta que su titulo (%s)'
       % (flacas or '—'))
    ok(ancho_de('Rapero') == ANCHO['Rapero'],
       'y las fijadas a mano mandan sobre la regla')

    # el podio: tres celdas, y solo la del `#`
    # ⚠️ UNA CELDA, no «empieza en la columna 0»: el formato del cuerpo
    # tambien arranca ahi y se colaba en la cuenta. Medir la cosa
    # equivocada se parece mucho a medir bien.
    def _una_celda(p):
        r = p.get('repeatCell', {}).get('range', {})
        return (r.get('endRowIndex', 0) - r.get('startRowIndex', 0) == 1
                and r.get('endColumnIndex', 0) - r.get('startColumnIndex', 0) == 1
                and r.get('startRowIndex') in (1, 2, 3)
                and r.get('startColumnIndex') == 0)
    podio = [p for p in pet if _una_celda(p)]
    ok(len(podio) == 3, 'el podio pinta 3 celdas (dio %d)' % len(podio))

    # 🔴 CON LA TABLA VACIA NO PUEDE PEDIR BANDAS NI PODIO. Un pool
    # recien arrancado tiene 0 filas —es un ESTADO, no un error— y
    # `addBanding` sobre un rango de altura 0 es un 400 que tumba el
    # batch entero. Es el mismo caso que ya rompio cuatro piezas el
    # 22/09.
    v = formato(1234, cab, 0)
    tv = [list(p)[0] for p in v]
    ok('addBanding' not in tv, 'con 0 filas NO pide bandas')
    ok(all(p['repeatCell']['range'].get('startRowIndex', 0) == 0
           for p in v if list(p)[0] == 'repeatCell'),
       'con 0 filas no pinta ninguna fila de datos')

    # por_fila
    filas = [[1, 'Konan', 'DRA', 'SSS', 100, 80, '3/5'],
             [2, 'Axinu', 'TFC', 'A+', 90, 50, '0/2'],
             [3, 'Nadie', 'FFA', '', 10, 0, '0/0']]
    pf = por_fila(1234, cab, filas)
    ok(len(pf) == 2, 'pinta el rango de quien lo tiene (2 de 3): dio %d' % len(pf))
    ok(all(p['repeatCell']['range']['startColumnIndex'] == 3 for p in pf),
       'y lo pinta en la columna Rango')
    ok(not por_fila(1234, ['#', 'País'], [[1, 'AR']]),
       'una vitrina sin Rango no pide nada')

    cond = condicionales(1234, cab, 10)
    # 3 para Win% (verde/amarillo/rojo) + 1 para la racha
    ok(len(cond) == 4, 'Win%% y racha tienen sus reglas (dio %d)' % len(cond))
    # 🔴 EL ORDEN DE LAS TRES DE Win% ES LO QUE LAS HACE FUNCIONAR: gana
    # la primera que da verdadero, asi que la de >=60 tiene que estar
    # antes que la de >=0. Al reves, todo saldria rojo.
    ind = [p['addConditionalFormatRule']['index'] for p in cond]
    ok(ind[:3] == [0, 1, 2], 'las tres de Win%% van en orden (dio %s)' % ind[:3])
    ok(all('CUSTOM_FORMULA' in str(p) for p in cond),
       'todas son de formula: andan con la columna en texto Y en numero')
    ok(not condicionales(1234, cab, 0), 'con 0 filas tampoco hay condicionales')

    # ⚠️ que todo lo que sale sea serializable: un `set` o un `Decimal`
    # perdido revienta recien contra la API, con un error que no dice
    # cual de las 60 peticiones fue.
    import json as _j
    try:
        _j.dumps(pet + pf + cond)
        ok(True, 'todo lo que sale es JSON')
    except (TypeError, ValueError) as e:
        ok(False, 'todo lo que sale es JSON: %s' % str(e)[:60])

    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


def main():
    if '--auto' in sys.argv:
        return _self_check()
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:                                    # noqa: BLE001
        pass
    print('\n  la paleta de las vitrinas\n')
    print('  fondo %s · cabecera %s · filas %s / %s'
          % (FONDO, CABECERA, FILA_A, FILA_B))
    print('\n  el color de cada rango (de comun/rangos.py):')
    for r in RANGOS:
        c = color_rango(r)
        print('   %-4s %-9s -> tinte rgb(%.2f, %.2f, %.2f)'
              % (r, COLOR_RANGO[r], c['red'], c['green'], c['blue']))
    print('\n  el podio: 🥇 %s  🥈 %s  🥉 %s' % PODIO)
    print('\n  --auto   el self-check\n')
    return 0


if __name__ == '__main__':
    raise SystemExit(main() or 0)
