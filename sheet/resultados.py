# -*- coding: utf-8 -*-
"""GUARDAR UN EVENTO EN `Resultados` Y `1v1`. Lo que el bot va a llamar.

    from sheet.resultados import guardar
    guardar({
        'num': 349, 'fecha': '20/09', 'servidor': 'DRA', 'escala': '16+',
        'resultados': [{'rapero': 'Konan', 'posicion': 'Campeón',
                        'puntos': 10000}],
        'duelos': [{'ronda': 'Final', 'a': 'Konan', 'b': 'Axinu',
                    'ganador': 'Konan'}],
    }, dry=True)

    python sheet/resultados.py --estado      que hay en las dos hojas
    python sheet/resultados.py --probar      un evento de prueba, en simulacro

🔴 POR QUE ESTA PIEZA, Y NO ARREGLAR `procesarEvento`.

El motor del Apps Script **ya tiene** `escribirLogs()`, que hace justo
esto. Pero el `Log` del Operativo dice `Total entradas 0`: **nunca se
ejecuto**, y los 348 eventos de `Eventos Procesados` entraron por otro
camino. Dlx, 20/09: *«todo es automatico, lo del sheet es viejo»* — la
idea es que el bot lleve el registro.

⚠️ Y «automatico» NO era «el bot detecta solo»: Dlx lo aclaro el mismo
dia —*«mayormente los usuarios pondran las llaves y anunciaran los
eventos manualmente»*—, asi que lo legado es **el menu de la planilla**
y no la carga a mano. Quien llama a esto es
`sheet/procesar_entrada.py`, que lee lo que una persona pego en
`Entrada` y frena si un nombre no esta en el padron.

O sea que el camino que importa es este: Python, llamable desde GitHub
Actions o desde donde sea, sin depender del menu de la planilla.

LAS DOS HOJAS ESTAN VACIAS Y ESO CUESTA CARO
----------------------------------------------
`duel_t` y `duel_v` son **obligatorios en tres de las cuatro tarjetas** y
hoy son reales en **4 de 138**: el resto muestra `0/0`. Salen de `1v1` en
cuanto tenga filas. Y cruzando el ganador con el pais del padron salen
tambien `DNA` y `DIN`, las dos que la carta Pais dibuja como `—`.

⚠️ NO SE SIEMBRAN LAS VIEJAS. `datos/eventos.json` tiene los cinco eventos
insignia con sus participantes, y sembrarlos daria 72 filas de datos
reales... de **5 de 348 eventos**. Cualquier cuenta sobre eso —podios,
duelos, win rate— saldria mal **sin fallar**, que es peor que la hoja
vacia. La hoja vacia dice la verdad: todavia no hay registro.
"""
import os
import re
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

from escribir import (Hoja, poner, id_operativo, API, token,   # noqa: E402
                      _pedir)

# ⚠️ EL ORDEN ES EL DE LA HOJA, no uno nuevo. Se verifica contra la
# cabecera antes de escribir: mandar de menos NO falla, entra corrido.
COLS_RES = ['Evento #', 'Fecha', 'Servidor', 'Escala', 'Rapero', 'País',
            'Posición', 'Puntos', 'MW pts', 'Puntos sin MW', 'Notas']
COLS_UNO = ['Evento #', 'Fecha', 'Servidor', 'Ronda', 'Rapero A', 'Rapero B',
            'Ganador', 'Perdedor', 'Notas']


def _pais_de():
    """{clave: iso} desde el padrón. Vacío si no responde."""
    try:
        from padron import seguro
        from comun.claves import clave
        return {k: d['cc'] for k, d in seguro().items() if d.get('cc')}, clave
    except Exception:                                # noqa: BLE001
        return {}, (lambda s: str(s).strip().lower())


def _filas_res(ev, paises, clave):
    out = []
    for r in ev.get('resultados', []):
        nom = str(r.get('rapero', '')).strip()
        if not nom:
            continue
        pts = r.get('puntos', 0) or 0
        mw = r.get('mw_pts', 0) or 0
        out.append([ev['num'], ev['fecha'], ev['servidor'], ev.get('escala', ''),
                    nom, paises.get(clave(nom), ''), r.get('posicion', ''),
                    pts, mw or '', pts - mw, str(r.get('notas', '')).strip()])
    return out


def _filas_uno(ev):
    out = []
    for b in ev.get('duelos', []):
        a, c = str(b.get('a', '')).strip(), str(b.get('b', '')).strip()
        g = str(b.get('ganador', '')).strip()
        if not (a and c and g):
            continue
        # ⚠️ SOLO 1v1 LIMPIOS. Un lado con coma es un equipo y una nota con
        # «triple» es otra cosa: mezclarlos con los duelos individuales
        # ensucia el win rate de las tarjetas. Es la misma regla que ya
        # tenia `escribirLogs` en el Apps Script.
        #
        # ✅ Y ES LA DEFINICION, NO UNA PERDIDA. Dlx, 21/09/2026:
        # *«que eso sea duelos individuales nada mas. No grupales. Solo
        # vale cuando el formato es 1v1, no 1v3 o 2v2»*.
        #
        # Lo habia anotado como un costo: medido sobre la llave de
        # prueba, Am peleo 2 y gano 1, pero como su derrota fue contra un
        # duo le queda **1/1 = 100 %**. Eso parecia inflado.
        #
        # ⚠️ NO LO ES, PORQUE `duel_t` NO ES «batallas»: es **duelos**, y
        # un 1v2 no es un duelo. Am tiene un duelo y lo gano. La misma
        # cifra que parecia un error es la respuesta correcta a la
        # pregunta que la columna hace.
        #
        # Queda escrito porque la lectura equivocada es facil de repetir:
        # el numero se ve raro si uno cree que cuenta batallas.
        # 🔴 Y ESTO MIRABA SOLO LA COMA, ASI QUE NO FILTRABA NADA. La
        # regla estaba bien escrita y el dato viene con `+`: el primer
        # evento por equipos de la T1 —#349, un 3v3— metio sus **4
        # batallas** en `1v1` como si fueran duelos individuales, entre
        # entidades como `sosa+papa+ bna🇯🇴` que no son personas.
        #
        # El separador vive ahora en `sheet/equipos.py`, junto con el que
        # usa `motor.equipo()` para repartir los puntos. Eran las dos
        # mitades de la misma regla de Dlx y las dos miraban la coma.
        from equipos import cuenta_como_duelo
        if not cuenta_como_duelo(a, c):
            continue
        if 'triple' in str(b.get('notas', '')).lower():
            continue
        # el tercer puesto que sale del PODIO no se peleó en la llave: ver
        # `escuchar._tercero_del_podio()`. Paga puesto, no suma duelo.
        if 'podio' in str(b.get('notas', '')).lower():
            continue
        # 🔴 NI LA DEL POKEMON: aparece en la llave y no peleó (guía, Parte
        # 2, §10.2). Un 1v1 donde un lado no estaba no es un duelo, y
        # contarlo le regala una victoria al otro.
        if re.search(r'pokemon\s*:', str(b.get('notas', '')), re.I):
            continue
        out.append([ev['num'], ev['fecha'], ev['servidor'], b.get('ronda', ''),
                    a, c, g, (c if g == a else a),
                    str(b.get('notas', '')).strip()])
    return out


def _filas_crudas(h):
    """Las filas de la tabla con su valor de verdad: los números, números.

    🔴 `Hoja.filas()` DEVUELVE LO QUE SE VE, Y REESCRIBIRLO LO VUELVE TEXTO.
    El borrado de antes leía así y reescribía las filas que quedaban: cada
    evento reprocesado convertía los puntos y el `#` de todos los demás en
    texto. Por eso `Eventos Procesados` tenía el `#` como texto en seis de
    siete filas —la séptima, recién agregada, era número— y un `COUNT`
    daba 1. Medido el 24/09/2026.
    """
    import requests
    ult = chr(ord('A') + h.ancho - 1)
    d = _pedir('GET', '/values/%s!A%d:%s?valueRenderOption=UNFORMATTED_VALUE'
               % (requests.utils.quote(h.nombre), h.fila_datos, ult))
    return [f for f in d.get('values', []) if any(str(c).strip() for c in f)]


def _grilla(h):
    """Cuántas filas tiene la hoja: un rango más largo es un 400."""
    d = _pedir('GET', '?fields=sheets.properties(title,sheetId,gridProperties)')
    for s_ in d.get('sheets') or []:
        if s_['properties']['title'] == h.nombre:
            return (s_['properties']['sheetId'],
                    s_['properties']['gridProperties'].get('rowCount', 0))
    return None, 0


def reescribir(h, nums, nuevas):
    """La tabla sin las filas de `nums` y con `nuevas` al final. Cuántas saca.

    🔴 UNA LECTURA Y UNA ESCRITURA POR HOJA, SEA CUAL SEA LA CANTIDAD DE
    EVENTOS. Esto era, por evento: leer la hoja para borrar, reescribirla,
    y leerla otra vez para saber dónde agregar —`Hoja.agregar()` cuenta las
    filas antes de escribir—. Tres hojas por evento: ~8 lecturas cada uno,
    y el ciclo reprocesa TODOS los eventos de la temporada. Con siete ya
    pasaba las 60 lecturas por minuto: el 24/09/2026 a las 11:52 AM ET
    `procesar_entrada.py` murió con un 429 a la mitad del #355. Con veinte
    eventos habría muerto en todas las corridas.

    🔴 Y EL BORRADO NO MIRABA SI HABÍA FUNCIONADO: era un `requests.put`
    sin fijarse la respuesta. Con un 429 las filas viejas quedaban, se
    contaban como borradas, y después se agregaban las nuevas: **el evento
    duplicado, o sea el doble de puntos**, sin un error. Ahora todo pasa
    por `escribir._pedir()`, que reintenta y levanta.

    ⚠️ El orden DENTRO de cada evento se conserva —`rankings.py` lee la
    racha en ese orden—; el evento reescrito queda al final, como antes.
    ⚠️ Lo que sobra abajo se BORRA, no se llena de `""`: una celda con
    `""` cuenta para `COUNTA` y aparenta datos.
    """
    import requests
    viejas = _filas_crudas(h)
    nums = {str(n).strip() for n in nums}
    quedan = [list(f) + [''] * (h.ancho - len(f)) for f in viejas
              if str(f[0]).strip() not in nums]
    total = quedan + [list(f) for f in nuevas]
    malas = [f for f in total if len(f) != h.ancho]
    if malas:
        raise RuntimeError(
            '%s tiene %d columnas y %d fila(s) traen otra cantidad. Mandar de '
            'menos NO falla: entra corrida.' % (h.nombre, h.ancho, len(malas)))
    # 🔴 SI QUEDA IGUAL, NO SE ESCRIBE. El ciclo relee las llaves en cada
    # corrida a propósito y reprocesa todos los eventos de la temporada, así
    # que esto reescribía la tabla entera sin que cambiara nada: 167 filas
    # por corrida el 25/09/2026, con 0 llaves nuevas (lo vio la lectura de
    # los logs de ese día). Se compara con el valor de verdad
    # (`_filas_crudas()`): un número que hoy es texto en la hoja NO da igual
    # y se reescribe, que es lo que tiene que pasar.
    if total == [list(f) + [''] * (h.ancho - len(f)) for f in viejas]:
        return 0
    ult = chr(ord('A') + h.ancho - 1)
    hasta = h.fila_datos + len(total) - 1
    if total:
        # la grilla sólo se pregunta si la tabla CRECE: si entra lo que
        # había, entra lo de ahora. Una lectura menos por hoja y corrida.
        sid, filas_grilla = (_grilla(h) if len(total) > len(viejas)
                             else (None, hasta))
        if hasta > filas_grilla and sid is not None:
            _pedir('POST', ':batchUpdate', json={'requests': [{'appendDimension': {
                'sheetId': sid, 'dimension': 'ROWS',
                'length': hasta - filas_grilla + 50}}]})
        _pedir('PUT', '/values/%s?valueInputOption=RAW' % requests.utils.quote(
            '%s!A%d:%s%d' % (h.nombre, h.fila_datos, ult, hasta)),
            json={'values': total})
    if len(viejas) > len(total):
        _pedir('POST', '/values/%s:clear' % requests.utils.quote(
            '%s!A%d:%s%d' % (h.nombre, hasta + 1, ult,
                             h.fila_datos + len(viejas) - 1)))
    return len(viejas) - len(quedan)


def guardar_varios(evs, dry=True):
    """Escribe varios eventos en las dos hojas. `{num: (resultados, duelos)}`.

    Idempotente por `num`: reescribir un evento reemplaza sus filas.
    """
    paises, clave = _pais_de()
    res, uno, cuentas = [], [], {}
    for ev in evs:
        for c in ('num', 'fecha', 'servidor'):
            if c not in ev:
                raise ValueError('al evento le falta %r' % c)
        r, u = _filas_res(ev, paises, clave), _filas_uno(ev)
        res += r
        uno += u
        cuentas[ev['num']] = (len(r), len(u))

    hr, hu = Hoja('Resultados'), Hoja('1v1')
    for h, cols in ((hr, COLS_RES), (hu, COLS_UNO)):
        if h.cabecera[:len(cols)] != cols:
            raise RuntimeError(
                '%s no tiene las columnas esperadas.\n  hoja: %s\n  '
                'esperaba: %s' % (h.nombre, h.cabecera, cols))

    if dry:
        for ev in evs:
            n1, n2 = cuentas[ev['num']]
            print('   [dry] #%s %s %s → %d resultado(s) y %d duelo(s)'
                  % (ev['num'], ev['servidor'], ev['fecha'], n1, n2))
        sin_pais = [r[4] for r in res if not r[5]]
        if sin_pais:
            print('         ⚠️ %d sin país en el padrón: %s'
                  % (len(sin_pais), ', '.join(sin_pais[:6])))
        return {n: (0, 0) for n in cuentas}

    nums = [ev['num'] for ev in evs]
    borradas = reescribir(hr, nums, res) + reescribir(hu, nums, uno)
    if borradas:
        print('   (reescribiendo: saqué %d fila(s) viejas de %d evento(s))'
              % (borradas, len(evs)))
    return cuentas


def guardar(ev, dry=True):
    """Escribe un evento. Ver `guardar_varios()`, que es lo que hay que usar."""
    return guardar_varios([ev], dry=dry)[ev['num']]


def estado():
    for n in ('Resultados', '1v1'):
        h = Hoja(n)
        fs = h.filas()
        evs = sorted({str(f[0]).strip() for f in fs if f and str(f[0]).strip()})
        print('   %-12s %4d filas · %d evento(s)%s'
              % (n, len(fs), len(evs),
                 '  (#%s … #%s)' % (evs[0], evs[-1]) if evs else ''))


def main():
    print('\n══ EL REGISTRO CRUDO ══\n')
    estado()
    if '--probar' not in sys.argv:
        print('')
        return 0
    print('\n   un evento de prueba, en simulacro:')
    guardar({
        'num': 9999, 'fecha': '20/09', 'servidor': 'DRA', 'escala': '16+',
        'resultados': [
            {'rapero': 'Konan', 'posicion': 'Campeón', 'puntos': 10000},
            {'rapero': 'Axinu', 'posicion': 'Subcampeón', 'puntos': 7500},
            {'rapero': 'NoExisteNadie', 'posicion': 'Cuartos', 'puntos': 2500},
        ],
        'duelos': [
            {'ronda': 'Final', 'a': 'Konan', 'b': 'Axinu', 'ganador': 'Konan'},
            {'ronda': 'SF', 'a': 'Konan, Bloody', 'b': 'Val', 'ganador': 'Val'},
        ],
    }, dry=True)
    print('\n   ⚠️ el duelo con coma es un EQUIPO y queda afuera a propósito:')
    print('      mezclarlo con los 1v1 ensucia el win rate de las tarjetas.')
    print('')
    return 0


if __name__ == '__main__':
    sys.exit(main())
