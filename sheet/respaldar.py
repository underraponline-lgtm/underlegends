# -*- coding: utf-8 -*-
"""RESPALDO COMPLETO DE LAS DOS PLANILLAS. Antes de tocar nada.

    python sheet/respaldar.py            las dos, a docs/sheet_respaldo/
    python sheet/respaldar.py --ver      que hay respaldado y de cuando
    python sheet/respaldar.py --comparar  el Sheet de ahora contra el ultimo

🔴 POR QUE EXISTE, Y POR QUE AHORA. `docs/sheet_respaldo/` tenia **dos
archivos sueltos** —`Config` y `Lista de Raperos`— guardados a mano
cuando se iba a escribir sobre ellos. Todo lo demas no estaba: los
cuatro rankings del Oficial, los 348 eventos, los 188 AKAs, la Consola
con los IDs del bot.

⚠️ **UN RESPALDO PARCIAL SE PARECE MUCHO A UNO COMPLETO** hasta el dia
que hace falta. Dos archivos en una carpeta llamada `sheet_respaldo`
leen como «esta respaldado».

⚠️ **GUARDA LOS VALORES Y LAS FORMULAS.** Una celda con `=SUM(...)`
devuelve el numero por defecto, asi que un respaldo de valores
**restaura una planilla muerta**: el panel del padron, que se paso a
formulas el 20/09/2026, volveria como numeros fijos. Se pide
`valueRenderOption=FORMULA` ademas del valor.

⚠️ **Y LA ESTRUCTURA TAMBIEN**: cuantas filas y columnas tiene cada
hoja, y **que celdas estan combinadas**. `Config` tiene 34 merges y la
`Guia` 43; sin esa lista, restaurar deja el contenido en el lugar
correcto y la forma no, que es como se pierde media hoja en silencio.
"""
import io
import json
import os
import sys
from datetime import datetime

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

import requests                                          # noqa: E402

from escribir import token, API, id_operativo            # noqa: E402

# ⚠️ el ID vive en `planillas.py`: la T1 estrena planilla y una
# copia suelta lee la vieja sin fallar. Ver el encabezado de ese modulo.
from planillas import OFICIAL  # noqa: E402
DEST = os.path.join(BASE, 'docs', 'sheet_respaldo')


def _get(url, **par):
    r = requests.get(url, headers={'Authorization': 'Bearer ' + token()},
                     params=par, timeout=120)
    r.raise_for_status()
    return r.json()


def una(sid, etiqueta):
    """Baja una planilla entera: valores, formulas, merges y tamanio."""
    meta = _get('%s/%s' % (API, sid),
                fields='properties.title,sheets.properties,sheets.merges')
    titulo = meta['properties']['title']
    hojas = []
    for s in meta['sheets']:
        p = s['properties']
        g = p.get('gridProperties', {})
        nom = p['title']
        rng = "'%s'" % nom.replace("'", "''")
        val = _get('%s/%s/values/%s' % (API, sid, requests.utils.quote(rng)),
                   valueRenderOption='UNFORMATTED_VALUE').get('values', [])
        frm = _get('%s/%s/values/%s' % (API, sid, requests.utils.quote(rng)),
                   valueRenderOption='FORMULA').get('values', [])
        hojas.append({
            'nombre': nom, 'id': p.get('sheetId'),
            'filas': g.get('rowCount'), 'columnas': g.get('columnCount'),
            'merges': s.get('merges', []),
            'valores': val, 'formulas': frm,
        })
        print('      %-24s %4d filas · %3d merges'
              % (nom[:24], len(val), len(s.get('merges', []))))
    return {'id': sid, 'titulo': titulo, 'etiqueta': etiqueta,
            'cuando': datetime.now().isoformat(timespec='seconds'),
            'hojas': hojas}


def _sin_vacias(filas):
    """Sin las filas totalmente vacias.

    ⚠️ LA API LAS INVENTA Y LAS SACA. Pedir un rango devuelve hasta la
    ultima fila con algo, y escribir `''` en una celda la convierte en
    «tiene algo» para el largo aunque este vacia para todo lo demas.
    Comparar crudo marca diferencias que no son datos.
    """
    return [f for f in filas if any(str(c).strip() for c in f)]


def comparar():
    """El Sheet de ahora contra el ultimo respaldo completo.

    🔴 ES LA PREGUNTA QUE HAY QUE PODER HACER DESPUES DE ESCRIBIR EN
    PRODUCCION: **¿quedo algo?** El 20/09/2026 se hicieron ocho ciclos de
    escribir-y-deshacer sobre el Operativo en vivo —cargar un evento de
    prueba, verificar, borrarlo— y «lo verifique cada vez» no es lo mismo
    que «no quedo nada»: cada verificacion miraba lo que esa prueba
    habia tocado, no el resto.

    Corrido ese dia: **11 de 12 hojas identicas**, y la doceava difiere
    solo en filas vacias — 18 filas de contenido antes y despues.
    """
    import glob as _glob
    out = []
    for etq, sid in (('oficial', OFICIAL), ('operativo', id_operativo())):
        hay = sorted(_glob.glob(os.path.join(DEST, 'COMPLETO_%s_*.json' % etq)))
        if not hay:
            out.append((etq, None, []))
            continue
        with io.open(hay[-1], encoding='utf-8') as f:
            d = json.load(f)
        difs = []
        for hoja in d['hojas']:
            rng = "'%s'" % hoja['nombre'].replace("'", "''")
            v = _get('%s/%s/values/%s' % (API, sid, requests.utils.quote(rng)),
                     valueRenderOption='UNFORMATTED_VALUE').get('values', [])
            a, b = _sin_vacias(hoja['valores']), _sin_vacias(v)
            if a != b:
                difs.append((hoja['nombre'], len(a), len(b)))
        out.append((etq, os.path.basename(hay[-1]), difs))
    return out


def main():
    if not os.path.isdir(DEST):
        os.makedirs(DEST)

    if '--comparar' in sys.argv:
        print('\n══ EL SHEET DE AHORA CONTRA EL ÚLTIMO RESPALDO ══\n')
        malas = 0
        for etq, arch, difs in comparar():
            if arch is None:
                print('   %-10s (no hay respaldo completo todavía)' % etq)
                continue
            print('   %-10s contra %s' % (etq, arch))
            if not difs:
                print('              ✅ todas las hojas iguales')
            for nom, na, nb in difs:
                malas += 1
                print('              ⚠️ %-22s %d -> %d filas' % (nom, na, nb))
        print('\n   (se ignoran las filas totalmente vacías: la API las')
        print('    inventa y las saca, y no son datos)\n')
        return 1 if malas else 0

    if '--ver' in sys.argv:
        print('\n══ QUÉ HAY RESPALDADO ══\n')
        hay = sorted(os.listdir(DEST))
        if not hay:
            print('   (nada)\n')
            return 1
        for f in hay:
            p = os.path.join(DEST, f)
            kb = os.path.getsize(p) / 1024.0
            print('   %-42s %8.1f KB' % (f, kb))
        print('')
        return 0

    sello = datetime.now().strftime('%Y%m%d_%H%M')
    print('\n══ RESPALDO COMPLETO ══\n')
    total = 0
    for sid, etq in ((OFICIAL, 'oficial'), (id_operativo(), 'operativo')):
        print('   %s  (%s)' % (etq, sid[:14] + '…'))
        d = una(sid, etq)
        p = os.path.join(DEST, 'COMPLETO_%s_%s.json' % (etq, sello))
        with io.open(p, 'w', encoding='utf-8') as f:
            json.dump(d, f, ensure_ascii=False)
        kb = os.path.getsize(p) / 1024.0
        total += kb
        print('   -> %s   %.1f KB\n' % (os.path.relpath(p, BASE), kb))
    print('   %.1f KB en total. Restaurar: los valores y las fórmulas están'
          % total)
    print('   los dos, y los merges de cada hoja también.\n')
    return 0


if __name__ == '__main__':
    sys.exit(main())
