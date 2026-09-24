"""EL RANKING MUNDIAL -> datos/mundial.json

⚠️ NO ES UNA TABLA: SON TRES BLOQUES EN UNA HOJA, uno debajo del otro, con
cabeceras distintas y filas vacias en el medio. Por eso no se puede leer con
`get_all_records()` como las otras cuatro hojas — hay que ubicar cada bloque
por su titulo y parsear a mano.

    LAS SELECCIONES        4 paises, capitan + 4 representantes
    RANKING DE PAISES     25 paises, suma de puntos de TODOS sus raperos
    PAISES MAS COMPETITIVOS 17 paises, promedio del Score de sus mejores 5

── LO QUE DICE LA HOJA DE SI MISMA ──────────────────────────────────────

    "SE ACTIVA EN TEMPORADA 2 (desde 19 jul 2026) — la pre-temporada es muy
     corta para selecciones"
    "Cada pais arma una seleccion: 1 capitan + 4 representantes elegidos por
     el. Los capitanes los define la Directiva."
    "Ranking pasivo: suma los puntos de Temporada de los 5 representantes."
    "Actualizado: 10/07/2026"

⚠️ ESA FECHA DE ACTIVACION NO SE PUEDE TOMAR AL PIE DE LA LETRA. La hoja se
actualizo el 10/07/2026 y dice que la T2 arranca el 19/07, pero Dlx dice que
la T1 todavia no empezo: el Sheet quedo congelado en la pre-temporada mientras
se hacia el rework. La hoja describe un PLAN, no el estado.

── LAS TRAMPAS ──────────────────────────────────────────────────────────

⚠️ LOS PAISES VIENEN COMO EMOJI DE BANDERA, no como codigo. Son dos simbolos
indicadores regionales (U+1F1E6..U+1F1FF) que hay que traducir a las dos
letras. Y hay uno que NO es una bandera: ❓, que es "sin pais" — y no es un
caso raro, son 145 raperos, mas que cualquier pais menos Argentina.

⚠️ LOS CUPOS VACIOS DICEN "🔓 Cupo libre" Y CUENTAN COMO CERO. De las 4
selecciones armadas, solo Colombia y Argentina estan completas: Chile y
Mexico tienen 4 cupos libres cada una, asi que su Score Seleccion esta
dividido por 5 igual. No es que sean malos: es que no eligieron.

⚠️ LOS NUMEROS TRAEN COMA DE MILES Y " pts" PEGADO. "1,042,089 pts" no es un
numero hasta que se le saca las dos cosas.

    python sheet/construir_pool_mundial.py      # solo lee
"""
import json
import os
import re
import sys

import gspread
from google.oauth2.service_account import Credentials

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# ⚠️ EL ID VIVE EN `sheet/planillas.py`, NO ACA. Estaba copiado en
# cinco archivos: hoy coinciden y por eso no se nota, pero **la T1
# estrena planilla nueva** y ese dia el que se olvide de actualizar su
# copia lee la planilla vieja y devuelve datos validos de la temporada
# equivocada. No falla: miente.
from planillas import OFICIAL as SHEET  # noqa: E402
HOJA = 'Ranking Mundial'
SALIDA = os.path.join(RAIZ, 'datos', 'mundial.json')

SIN_PAIS = '??'         # el ❓ de la hoja: 145 raperos sin bandera


def cc(txt):
    """El codigo de dos letras de un emoji de bandera. ❓ -> '??'."""
    t = (txt or '').strip()
    ind = [c for c in t if 0x1F1E6 <= ord(c) <= 0x1F1FF]
    if len(ind) >= 2:
        return ''.join(chr(ord(c) - 0x1F1E6 + ord('a')) for c in ind[:2])
    return SIN_PAIS if t else ''


def num(txt):
    """1,042,089 pts -> 1042089 · 72.8 -> 72.8 · vacio -> 0"""
    t = re.sub(r'[^\d.,-]', '', (txt or '')).replace(',', '')
    try:
        return float(t) if '.' in t else int(t or 0)
    except ValueError:
        return 0


def fila_de(v, texto):
    for i, r in enumerate(v):
        if r and texto in (r[0] or ''):
            return i
    return None


def leer(v):
    out = {'selecciones': {}, 'paises': [], 'competitivos': {}}

    # ── LAS SELECCIONES ─────────────────────────────────────────────────
    # cada pais abre con su bandera en la col 0 y sus puntos en la col 4;
    # las cinco filas siguientes son el capitan y los representantes
    i = fila_de(v, 'LA SELECCIÓN')
    fin = fila_de(v, 'RANKING DE PAÍSES')
    while i is not None and i < (fin or len(v)):
        c = cc(v[i][0]) if v[i] else ''
        if c and c != SIN_PAIS and 'pts' in (v[i][4] if len(v[i]) > 4 else ''):
            equipo, top = [], []
            for k in range(1, 6):
                if i + k >= len(v):
                    break
                r = v[i + k]
                nom = re.sub(r'^[\d.\s👑]+', '', (r[0] or '').strip())
                libre = 'Cupo libre' in nom
                equipo.append(None if libre else nom)
                # el panel de la derecha: puesto, nombre y puntos del pais
                if len(r) > 11 and (r[8] or '').strip():
                    top.append({'rapero': r[8].strip(), 'pts': num(r[11])})
            out['selecciones'][c] = {
                'capitan': equipo[0] if equipo else None,
                'representantes': equipo[1:],
                'libres': sum(1 for x in equipo if x is None),
                'pts': num(v[i][4]),
                'top5': top,
            }
        i += 1

    # ── RANKING DE PAISES ───────────────────────────────────────────────
    i = fila_de(v, 'RANKING DE PAÍSES')
    j = fila_de(v, 'PAÍSES MÁS COMPETITIVOS')
    for r in v[(i or 0) + 3:(j or len(v))]:
        if not r or not (r[0] or '').strip().isdigit():
            continue
        out['paises'].append({'puesto': int(r[0]), 'cc': cc(r[1]),
                              'raperos': num(r[3]), 'pts': num(r[7]),
                              'oros': num(r[11])})

    # ── PAISES MAS COMPETITIVOS ─────────────────────────────────────────
    for r in v[(j or 0) + 3:]:
        if not r or not (r[0] or '').strip().isdigit():
            continue
        m = re.match(r'(.+?)\s*\(([\d.]+)\)', (r[11] or '').strip())
        out['competitivos'][cc(r[1])] = {
            'puesto': int(r[0]),
            'clasificados': num(r[3]),
            # "4  ⚠️ faltan 1" -> el aviso se guarda aparte, no se pierde
            'faltan': num(re.search(r'faltan\s*(\d+)', r[3] or '').group(1))
                      if 'faltan' in (r[3] or '') else 0,
            'score_seleccion': num(r[7]),
            'mejor': m.group(1) if m else None,
            'mejor_score': float(m.group(2)) if m else 0,
        }
    return out


def main():
    creds = os.path.join(RAIZ, 'creds.json')
    if not os.path.exists(creds):
        print('falta creds.json en la raiz del proyecto')
        return
    sc = ['https://www.googleapis.com/auth/spreadsheets.readonly']
    gc = gspread.authorize(Credentials.from_service_account_file(creds, scopes=sc))
    v = gc.open_by_key(SHEET).worksheet(HOJA).get_all_values()
    d = leer(v)
    d['_hoja'] = HOJA
    d['_nota'] = ('Tres bloques en una hoja, no una tabla. El ❓ de la hoja es '
                  '"sin pais" y se guarda como "??": son 145 raperos.')
    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    json.dump(d, open(SALIDA, 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)

    print('SELECCIONES (%d)' % len(d['selecciones']))
    for c, s in d['selecciones'].items():
        print('  %-3s cap %-10s  %d libres  %s pts'
              % (c, s['capitan'], s['libres'], '{:,}'.format(s['pts'])))
    print()
    print('RANKING DE PAISES (%d) — suma de TODOS sus raperos' % len(d['paises']))
    for p in d['paises'][:6]:
        print('  %2d %-3s %4d raperos  %11s pts  %3d oros'
              % (p['puesto'], p['cc'], p['raperos'],
                 '{:,}'.format(p['pts']), p['oros']))
    print('  ...')
    print()
    print('MAS COMPETITIVOS (%d) — promedio del Score de los mejores 5'
          % len(d['competitivos']))
    for c, x in list(d['competitivos'].items())[:6]:
        av = '  ⚠️ faltan %d' % x['faltan'] if x['faltan'] else ''
        print('  %2d %-3s %3d clasificados  score %5.1f  mejor %s (%.1f)%s'
              % (x['puesto'], c, x['clasificados'], x['score_seleccion'],
                 x['mejor'], x['mejor_score'], av))
    print()
    print('-> %s' % SALIDA)


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
