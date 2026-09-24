# -*- coding: utf-8 -*-
"""EL SHEET OPERATIVO: que hojas tiene, que cabeceras y cuantas filas.

    python sheet/explorar_operativo.py            el mapa
    python sheet/explorar_operativo.py Resultados las primeras filas de una hoja

🔴 POR QUE IMPORTA: ES LA CAPA DE DATOS QUE `docs/sheet_t1.md` DA POR
INEXISTENTE.

Ese documento dice —midiendolo— que el Sheet **no calcula nada** y que **no
hay ninguna hoja de datos crudos**: «ni eventos, ni brackets, ni combates».
Y es cierto... **del Oficial**. El Operativo es otro archivo, y su Apps
Script nombra once hojas, entre ellas `Resultados`, `1v1`, `Lista de
Raperos` y `Config`.

O sea que las cuatro hojas que `sheet_t1.md` pide crear de cero
—`datos_resultados`, `datos_duelos`, `datos_raperos`, `config`— **ya
existen**, con otro nombre y en otro archivo. Antes de construir nada nuevo
hay que mirar esto: rehacer lo que ya esta es la forma mas cara de
equivocarse.

⚠️ SOLO LEE. No escribe una celda.

⚠️ EL ID NO SE ESCRIBIO A MANO: sale del `parentId` del proyecto de Apps
Script, que es donde Google guarda a que planilla esta atado. Un ID a mano
que exista apunta a otra planilla y no avisa.
"""
import io
import json
import os
import sys

import requests

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

SCRIPT_OPERATIVO = '1feyyQOBLptt7HEsfA9uXhL29bv_WNrN3U4B0IB5lktPR4hC-Bijhr7v5'
CREDS = os.path.join(BASE, 'creds.json')
API = 'https://sheets.googleapis.com/v4/spreadsheets'


def token(escritura=False):
    from google.oauth2 import service_account
    from google.auth.transport.requests import Request
    sc = ['https://www.googleapis.com/auth/spreadsheets'
          if escritura else
          'https://www.googleapis.com/auth/spreadsheets.readonly']
    cr = service_account.Credentials.from_service_account_file(CREDS, scopes=sc)
    cr.refresh(Request())
    return cr.token


_ID = [None]
# Lo que se resolvio alguna vez, en disco. Ver `id_operativo()`.
_ID_CACHE = os.path.join(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__))), 'datos', 'id_operativo.txt')


def id_operativo():
    """El ID de la planilla, sacado del proyecto de Apps Script.

    🔴 SE CACHEA, Y NO ES POR VELOCIDAD. Esto lo llaman **19 lugares** y
    antes pegaba a la API de Apps Script **en cada llamada**: una sola
    limpieza de un evento la invoca seis veces. El 20/09/2026 esa API
    contesto `500 Internal Server Error` en el medio de una y la dejo a
    mitad de camino — el contador y la hoja `Entrada` quedaron con datos
    de prueba y hubo que terminar a mano.

    ⚠️ **EN UN JOB DESATENDIDO ESO ES EL CASO MALO**, no una molestia:
    una dependencia que se consulta seis veces por operacion multiplica
    por seis la chance de que una corrida se corte por la mitad, y la
    mitad de una escritura en una planilla no se deshace sola.

    ⚠️ **Y EL ID NO CAMBIA.** Es a que planilla esta atado el proyecto de
    Apps Script; que eso cambie es un evento de una vez en la vida del
    proyecto. Preguntarlo seis veces por operacion era pagar un riesgo
    por un dato constante.

    Se guarda en `datos/id_operativo.txt` para que sobreviva entre
    corridas. Si la API no contesta pero el archivo esta, se usa el
    archivo y se avisa; si no esta ninguno, ahi si no se puede seguir.
    """
    if _ID[0]:
        return _ID[0]
    guardado = None
    if os.path.exists(_ID_CACHE):
        with io.open(_ID_CACHE, encoding='utf-8') as f:
            guardado = f.read().strip() or None
    try:
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request
        cr = service_account.Credentials.from_service_account_file(
            CREDS, scopes=['https://www.googleapis.com/auth/script.projects'])
        cr.refresh(Request())
        r = requests.get('https://script.googleapis.com/v1/projects/%s'
                         % SCRIPT_OPERATIVO,
                         headers={'Authorization': 'Bearer ' + cr.token},
                         timeout=30)
        r.raise_for_status()
        p = r.json().get('parentId')
        if not p:
            sys.exit('el proyecto de Apps Script no declara `parentId`: '
                     'no esta atado a una planilla')
    except Exception as e:                               # noqa: BLE001
        if not guardado:
            raise
        print('   ⚠️ Apps Script no contestó (%s): uso el ID guardado'
              % str(e)[:60])
        _ID[0] = guardado
        return guardado
    # ⚠️ SI CAMBIO, SE AVISA. Un ID distinto al guardado significa que el
    # proyecto se ato a OTRA planilla, y eso no puede pasar en silencio:
    # todo lo que escribe este repo iria a otro lado sin fallar.
    if guardado and guardado != p:
        print('   ⚠️ el ID del Operativo cambió: %s -> %s' % (guardado, p))
    try:
        with io.open(_ID_CACHE, 'w', encoding='utf-8') as f:
            f.write(p)
    except OSError:
        pass
    _ID[0] = p
    return p


def mapa(sid, tok):
    r = requests.get('%s/%s?fields=properties.title,sheets.properties'
                     % (API, sid),
                     headers={'Authorization': 'Bearer ' + tok}, timeout=40)
    if r.status_code != 200:
        sys.exit('%s: %s' % (r.status_code,
                             (r.json().get('error', {}).get('message')
                              or r.text)[:200]))
    return r.json()


def filas(sid, tok, hoja, cuantas=6):
    r = requests.get('%s/%s/values/%s!A1:Z%d'
                     % (API, sid, requests.utils.quote(hoja), cuantas),
                     headers={'Authorization': 'Bearer ' + tok}, timeout=40)
    if r.status_code != 200:
        return None
    return r.json().get('values', [])


def main():
    sid = id_operativo()
    tok = token()
    d = mapa(sid, tok)
    print('\n══ %s ══' % d['properties']['title'])
    print('   %s\n' % sid)

    quiere = [a for a in sys.argv[1:] if not a.startswith('--')]
    hojas = d['sheets']
    print('   %-26s %7s %7s  %s' % ('hoja', 'filas', 'cols', 'oculta'))
    for s in hojas:
        p = s['properties']
        g = p.get('gridProperties', {})
        print('   %-26s %7s %7s  %s'
              % (p['title'], g.get('rowCount', '?'), g.get('columnCount', '?'),
                 '👁️‍🗨️ oculta' if p.get('hidden') else ''))

    objetivo = quiere or [s['properties']['title'] for s in hojas]
    print('\n══ LAS PRIMERAS FILAS ══')
    for h in objetivo:
        v = filas(sid, tok, h)
        print('\n   ── %s' % h)
        if not v:
            print('      (vacia o no se pudo leer)')
            continue
        for i, fila in enumerate(v[:4], 1):
            txt = ' | '.join(str(c)[:16] for c in fila[:9])
            print('      %d: %s' % (i, txt[:150]))
    print('')


if __name__ == '__main__':
    main()
