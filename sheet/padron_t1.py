# -*- coding: utf-8 -*-
"""COMPLETA `Lista de Raperos` CON LO QUE LAS TARJETAS NECESITAN.

    python sheet/padron_t1.py            dice que pondria, NO escribe
    python sheet/padron_t1.py --aplicar  lo escribe

QUE LE FALTA AL PADRON
-----------------------
Medido el 20/09/2026 sobre sus 875 filas. Tiene
`Rapero · Bandera · SV · Verificado · Discord ID · Avatar · Notas`, y las
tarjetas piden tres cosas que no estan:

1. 🔴 **EL NOMBRE LIMPIO.** `Rapero` guarda `Ivan 🇨🇴` y `Benju ❓`: el nombre
   con la bandera pegada. Todo el pipeline lo limpia con un regex cada vez
   que lo lee, y `cc` —que **las cuatro tarjetas piden obligatorio**— sale
   de detectar ese emoji adentro del texto. Funciona hasta que alguien
   escriba el nombre sin bandera, o con dos.

2. 🔴 **EL PAIS EN ISO.** `Bandera` guarda el nombre en castellano
   (`Colombia`), y las tarjetas piden el codigo (`co`) porque asi se llaman
   los archivos de `04_Pais/banderas/`.

3. **LA CREW.** No esta en ninguna hoja. Vive en `comun/crews.py`, que es
   una lista que paso Dlx a mano el 20/08.

EL MAPA DE PAISES NO SE ESCRIBIO A MANO
----------------------------------------
16 de los 24 nombres salieron **cruzando los datos**: las personas del pool
tienen su `cc` y estan en el padron con su `Bandera`, asi que cada
coincidencia da un par. Los 7 que faltaban no estan en el pool y son ISO
3166-1 sin ambiguedad.

🔴 Y EL CRUCE ENCONTRO SEIS CONTRADICCIONES. En seis personas el pais del
padron **no coincide con la bandera pegada a su nombre** en el Oficial:
dos «Argentina» con emoji de Bolivia, dos «Estados Unidos» con emoji de
Mexico, dos «Peru» con emoji de Ecuador. Es exactamente el motivo por el
que esto tiene que ser una columna y no un emoji adentro de un texto: con
dos fuentes, una miente y nadie se entera.

⚠️ Este script **no las resuelve**: las lista. Cual de las dos vale lo
decide Dlx, no un desempate automatico.
"""
import io
import json
import os
import re
import sys
from collections import Counter

import requests

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

from escribir import Hoja, poner, id_operativo, API, token   # noqa: E402
from comun.claves import clave                               # noqa: E402
from comun.crews import DE_CADA_UNO                          # noqa: E402

HOJA = 'Lista de Raperos'
NUEVAS = ['Nombre', 'País', 'Crew']

# ⚠️ LOS 16 PRIMEROS SALIERON DE CRUZAR EL POOL CON EL PADRON, no de
# escribirlos. Los 7 de abajo no tienen a nadie en el pool, asi que no hay
# con que cruzarlos: son ISO 3166-1 alpha-2, que no es una opinion.
PAIS_ISO = {
    'Argentina': 'ar', 'Bolivia': 'bo', 'Chile': 'cl', 'Colombia': 'co',
    'Ecuador': 'ec', 'España': 'es', 'Estados Unidos': 'us',
    'Guatemala': 'gt', 'Honduras': 'hn', 'México': 'mx', 'Panamá': 'pa',
    'Perú': 'pe', 'Puerto Rico': 'pr', 'República Dominicana': 'do',
    'Uruguay': 'uy', 'Venezuela': 've',
    # sin nadie en el pool con quien cruzar
    'El Salvador': 'sv', 'Costa Rica': 'cr', 'Paraguay': 'py',
    'Emiratos': 'ae', 'Brasil': 'br', 'Cuba': 'cu', 'Nicaragua': 'ni',
}

# los indicadores regionales: 🇦🇷 son dos, U+1F1E6..U+1F1FF
_BANDERA = re.compile('[\U0001F1E6-\U0001F1FF]')


def limpiar(nombre):
    """El nombre sin la bandera ni el `❓`. La misma regla del pipeline."""
    return _BANDERA.sub('', str(nombre)).replace('❓', '').strip()


def col_letra(i):
    return chr(ord('A') + i)


_GID = [None]


def _gid():
    """El sheetId numerico de la hoja, que es lo que pide batchUpdate."""
    if _GID[0] is None:
        r = requests.get('%s/%s?fields=sheets(properties(title,sheetId))'
                         % (API, id_operativo()),
                         headers={'Authorization': 'Bearer ' + token()},
                         timeout=60)
        r.raise_for_status()
        _GID[0] = next(x['properties']['sheetId'] for x in r.json()['sheets']
                       if x['properties']['title'] == HOJA)
    return _GID[0]


def main():
    aplicar = '--aplicar' in sys.argv
    h = Hoja(HOJA, ojo='Rapero')
    ix = {n: i for i, n in enumerate(h.cabecera)}

    def g(f, n):
        return str(f[ix[n]]).strip() if n in ix and ix[n] < len(f) else ''

    filas = h.filas()
    print('\n══ %s  (%d filas, cabecera en la %d) ══\n' % (HOJA, len(filas), h.fila_cab))

    ya = [c for c in NUEVAS if c in ix]
    if ya:
        print('   ya tiene: %s' % ', '.join(ya))

    # ── lo que se va a escribir ──
    nuevas_filas, sin_iso, sin_crew = [], Counter(), 0
    for f in filas:
        nom = limpiar(g(f, 'Rapero'))
        ban = g(f, 'Bandera')
        iso = PAIS_ISO.get(ban, '')
        if ban and ban != '❓' and not iso:
            sin_iso[ban] += 1
        crew = DE_CADA_UNO.get(clave(nom), '')
        if not crew:
            sin_crew += 1
        nuevas_filas.append([nom, iso, crew])

    con_iso = sum(1 for x in nuevas_filas if x[1])
    con_crew = sum(1 for x in nuevas_filas if x[2])
    cambia_nombre = sum(1 for f, x in zip(filas, nuevas_filas)
                        if g(f, 'Rapero') != x[0])
    print('   %-28s %4d   %5.1f %%' % ('Nombre (limpio)', len(nuevas_filas), 100.0))
    print('      de esos, distintos de `Rapero`: %d' % cambia_nombre)
    print('   %-28s %4d   %5.1f %%' % ('País (ISO)', con_iso,
                                       100.0 * con_iso / len(filas)))
    print('   %-28s %4d   %5.1f %%' % ('Crew', con_crew,
                                       100.0 * con_crew / len(filas)))
    if sin_iso:
        print('\n   🔴 sin ISO: %s'
              % ', '.join('%s (%d)' % (k, v) for k, v in sin_iso.most_common()))

    # ── las contradicciones con la bandera del nombre ──
    # ⚠️ SE LISTAN, NO SE RESUELVEN. Cual de las dos vale lo decide Dlx.
    choques = []
    pool = []
    for arch in ('competitivo_pool.json', 'temporada_pool.json'):
        p = os.path.join(BASE, 'datos', arch)
        if os.path.exists(p):
            pool += json.load(io.open(p, encoding='utf-8'))
    cc_pool = {clave(x['raw']): x['cc'] for x in pool if x.get('cc')}
    for f, x in zip(filas, nuevas_filas):
        k = clave(x[0])
        otro = cc_pool.get(k)
        if otro and x[1] and otro != x[1]:
            choques.append((x[0], x[1], otro))
    if choques:
        print('\n   🔴 %d personas: el padrón dice un país y su nombre trae '
              'otra bandera' % len(choques))
        for n, a, b in choques:
            print('      %-18s padrón %s · bandera del nombre %s' % (n[:18], a, b))

    if not aplicar:
        print('\n   (simulacro: no escribí nada — corré con --aplicar)\n')
        return 0

    # ── escribir ──
    # 🔴 HAY QUE INSERTAR COLUMNAS: NO HAY TRES LIBRES SEGUIDAS. A la
    # derecha de `Notas` viven dos paneles —`📊 Totales` en I-J y
    # `❓ Por verificar` en L-N— y las unicas columnas vacias sueltas son H,
    # K y O. Escribir en esas tres dejaria `Nombre`, `País` y `Crew`
    # separadas por paneles en el medio.
    #
    # ⚠️ INSERTAR ES SEGURO ACA, Y SE VERIFICO. El motor lee esta hoja en
    # `A5:A500` (`leerRaperos`) y `A10:B500` (`construirMapaPais`): **solo
    # las columnas A y B**. Insertar en la 8 no mueve ninguna de las dos, y
    # las formulas de los paneles se reajustan solas.
    if all(c in ix for c in NUEVAS):
        print('\n   las tres columnas ya estaban: solo actualizo los valores')
        inicio = ix[NUEVAS[0]]
    else:
        inicio = h.ancho                      # justo despues de `Notas`
        req = {'requests': [{'insertDimension': {
            'range': {'sheetId': _gid(), 'dimension': 'COLUMNS',
                      'startIndex': inicio, 'endIndex': inicio + len(NUEVAS)},
            'inheritFromBefore': False}}]}
        r = requests.post('%s/%s:batchUpdate' % (API, id_operativo()),
                          headers={'Authorization': 'Bearer ' + token()},
                          json=req, timeout=60)
        if r.status_code >= 300:
            raise RuntimeError('no pude insertar columnas: %s %s'
                               % (r.status_code, r.text[:200]))
        print('\n   ✅ %d columnas insertadas en la %s'
              % (len(NUEVAS), col_letra(inicio)))

    rng = '%s!%s%d:%s%d' % (HOJA, col_letra(inicio), h.fila_cab,
                            col_letra(inicio + len(NUEVAS) - 1),
                            h.fila_cab + len(filas))
    poner(rng, [NUEVAS] + nuevas_filas)
    print('   ✅ %s escrito (%d filas + cabecera)' % (rng, len(nuevas_filas)))
    print('')
    return 0


if __name__ == '__main__':
    sys.exit(main())
