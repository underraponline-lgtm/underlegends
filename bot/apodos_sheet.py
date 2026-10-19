# -*- coding: utf-8 -*-
"""📇 LOS NOMBRES DE DISCORD DE LA GENTE DE LA LISTA, GUARDADOS EN EL OPERATIVO.

    python bot/apodos_sheet.py --guardar   después del paso 1b: los de la Lista, a la hoja «Apodos Discord» (si cambió)
    python bot/apodos_sheet.py --traer     antes del paso 0b: si falta el caché, lo arma desde esa hoja
    python bot/apodos_sheet.py --auto      el self-check (sin red)

🔴 POR QUÉ EXISTE (pasada de errores del 19/10/2026; Dlx, a «¿guardo usuario → ID para el organizador de la semana?»:
*«a, guardarlo quizás en el sheet»*). El reconocimiento de nombres (`bot/nombres.py`) usa el nombre de Discord de cada
persona —el usuario siempre; el apodo y el visible si dicen algo—, y ese dato llega recién en el paso 1b, a
`.cache/apodos_discord.json`, que el runner pierde al terminar. El organizador de la semana se calcula en el 0b
(`bot/multiplicadores.py`), ANTES, así que quien sólo se reconoce por su usuario de Discord no salía nunca. Los pasos
no se pueden dar vuelta: el 0b va antes de las vitrinas (1c), que multiplican con lo que deja.

⚠️ SÓLO LA GENTE DE LA LISTA, y en el Operativo, que es privado: el caché tiene ~12.000 cuentas de cuatro servidores y
las listas de otro servidor no son nuestras (`herramientas/servidores_de.py`). El reconocedor sólo usa las cuentas que
están en la Lista, así que no se pierde nada. Nunca al repo, nunca a la página; y este script no imprime nombres.

⚠️ EL USUARIO VA APARTE Y AL FINAL. Es el único único en Discord y el reconocedor lo trata distinto (vale siempre); los
otros nombres son de cualquiera. La hoja lo tiene en su columna, y al traerlo vuelve a quedar último.
"""
import io
import json
import os
import re
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, os.path.join(BASE, 'sheet'), BASE):
    if _p not in sys.path:
        sys.path.insert(0, _p)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

HOJA = 'Apodos Discord'
CAB = ['Discord ID', 'Usuario', 'Otros nombres (apodo y nombre visible)']
SEP = ' · '
APODOS = os.path.join(BASE, '.cache', 'apodos_discord.json')


def filas(nombres, dids):
    """`[[id, usuario, otros]]` de los `dids` (los de la Lista), ordenados. `nombres`: `{id: [nombres…, usuario]}`."""
    out = []
    for did in sorted({str(d) for d in dids if re.fullmatch(r'\d{5,25}', str(d))}, key=int):
        ns = [str(n).strip() for n in (nombres.get(did) or []) if str(n or '').strip()]
        if ns:
            out.append([did, ns[-1], SEP.join(ns[:-1])])
    return out


def nombres_de(fs):
    """Lo contrario de `filas()`: `{id: [otros…, usuario]}`. Lo que no tiene forma se saltea."""
    out = {}
    for f in fs or []:
        if len(f) < 2:
            continue
        did, usuario = str(f[0]).strip(), str(f[1]).strip()
        if not re.fullmatch(r'\d{5,25}', did) or not usuario:
            continue
        otros = [x.strip() for x in str(f[2] if len(f) > 2 else '').split(SEP.strip()) if x.strip()]
        out[did] = [x for x in otros if x != usuario] + [usuario]
    return out


def _leer(ruta, defecto):
    try:
        with io.open(ruta, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return defecto


def _dids_lista():
    pad = _leer(os.path.join(BASE, 'datos', 'padron.json'), []) or []
    return {str(p.get('discord_id')) for p in pad if isinstance(p, dict) and p.get('discord_id')}


def _hoja(crear):
    """El `sheetId` de la hoja, o `None`; con `crear`, la crea (con la cabecera fija)."""
    from escribir import _pedir
    d = _pedir('GET', '?fields=sheets.properties(sheetId,title)')
    for s in d.get('sheets') or []:
        if s['properties']['title'] == HOJA:
            return s['properties']['sheetId']
    if not crear:
        return None
    r = _pedir('POST', ':batchUpdate', json={'requests': [{'addSheet': {'properties': {
        'title': HOJA, 'gridProperties': {'frozenRowCount': 1, 'columnCount': 3}}}}]})
    return r['replies'][0]['addSheet']['properties']['sheetId']


def _rango(a1):
    import requests
    return requests.utils.quote("'%s'!%s" % (HOJA, a1))


def guardar():
    """Los de la Lista, a la hoja, sólo si cambió. Devuelve cuántas filas quedaron (o -1 si no había caché)."""
    from escribir import _pedir
    cache = _leer(APODOS, None)
    if not cache or not cache.get('nombres'):
        print('   (sin el caché de apodos de esta corrida: no hay nada que guardar)')
        return -1
    nuevas = filas(cache['nombres'], _dids_lista())
    _hoja(crear=True)
    hay = _pedir('GET', '/values/%s' % _rango('A2:C')).get('values', [])
    if [list(map(str, f)) + [''] * (3 - len(f)) for f in hay] == nuevas:
        print('   %d personas de la Lista, igual que lo guardado: no se escribe' % len(nuevas))
        return len(nuevas)
    _pedir('POST', '/values/%s:clear' % _rango('A:C'), json={})
    _pedir('PUT', '/values/%s?valueInputOption=RAW' % _rango('A1'), json={'values': [CAB] + nuevas})
    # comprobar leyendo (ver `escribir.poner()`): el 200 no dice que quedó
    leidas = _pedir('GET', '/values/%s' % _rango('A2:C')).get('values', [])
    if len(leidas) != len(nuevas) or any(str(a[0]) != b[0] for a, b in zip(leidas, nuevas)):
        raise RuntimeError('la hoja «%s» no quedó como se mandó (%d filas de %d)' % (HOJA, len(leidas), len(nuevas)))
    print('   %d personas de la Lista guardadas en «%s»' % (len(nuevas), HOJA))
    return len(nuevas)


def traer():
    """Si falta el caché (el runner arranca limpio), lo arma con lo guardado. Devuelve cuántas cuentas trajo."""
    from escribir import _pedir
    if os.path.exists(APODOS):
        print('   el caché de apodos ya está: no hace falta traerlo')
        return 0
    if _hoja(crear=False) is None:
        print('   todavía no hay hoja «%s»: el paso 1b la crea' % HOJA)
        return 0
    n = nombres_de(_pedir('GET', '/values/%s' % _rango('A2:C')).get('values', []))
    os.makedirs(os.path.dirname(APODOS), exist_ok=True)
    with io.open(APODOS, 'w', encoding='utf-8') as f:
        json.dump({'_leeme': 'Los nombres de Discord de la gente de la Lista, traídos de la hoja «%s» del Operativo para '
                             'los pasos de antes del 1b (que lo rehace entero). NO SE COMMITEA.' % HOJA,
                   'nombres': n, 'servidores': {}, 'de': 'sheet'}, f, ensure_ascii=False)
    print('   %d cuentas de la Lista traídas de «%s» (el 1b las rehace)' % (len(n), HOJA))
    return len(n)


def _self_check():
    print('\n══ LOS NOMBRES DE DISCORD, EN EL OPERATIVO ══\n')
    mal = 0

    def ok(c, q, extra=''):
        nonlocal mal
        mal += not c
        print('   %s %s%s' % ('✅' if c else '🔴', q, ('  ' + extra) if extra and not c else ''))

    nombres = {'300000000000000003': ['Lewis ⛩️', 'Lewito', 'l3wito'], '200000000000000002': ['dnk.x'],
               '100000000000000001': ['de otro servidor'], '400000000000000004': []}
    fs = filas(nombres, {'300000000000000003', '200000000000000002', '400000000000000004', 'no-es-id'})
    ok(fs == [['200000000000000002', 'dnk.x', ''], ['300000000000000003', 'l3wito', 'Lewis ⛩️ · Lewito']],
       'sólo los de la Lista, por ID, con el usuario aparte y el resto junto (quien no está en la Lista no va)', str(fs))
    vuelta = nombres_de(fs)
    ok(vuelta == {'200000000000000002': ['dnk.x'], '300000000000000003': ['Lewis ⛩️', 'Lewito', 'l3wito']},
       'y vuelve igual: el usuario, último (el reconocedor lo trata distinto)', str(vuelta))
    ok(nombres_de([['x', 'a'], ['123456', ''], ['123456']]) == {}, 'lo que no tiene forma se saltea')
    import nombres as NB
    R = NB.Reconocer(padron=[{'raw': 'LEWITO', 'discord_id': '300000000000000003'}], discord=vuelta)
    ok(R.quien('l3wito')[0] == 'LEWITO' and R.quien('Lewis')[0] == '',
       'traído de la hoja, el reconocedor encuentra por el usuario (y «Lewis», corto, no alcanza)')
    print('\n   %s\n' % ('todo bien' if not mal else '%d mal' % mal))
    return mal


if __name__ == '__main__':
    if '--auto' in sys.argv:
        sys.exit(1 if _self_check() else 0)
    if '--guardar' in sys.argv:
        guardar()
    elif '--traer' in sys.argv:
        traer()
    else:
        print(__doc__)
