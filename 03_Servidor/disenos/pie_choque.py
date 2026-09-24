"""¿La figura del rango choca con el color de la carta? Las 80 combinaciones.

Dlx: "el color de los emblemas que choca con el color de algunos servidores".

⚠️ ES UN PROBLEMA REAL Y ESTRUCTURAL, no de algunos casos. En esta carta hay
DOS SISTEMAS DE COLOR INDEPENDIENTES sobre la misma superficie:

    el color del SERVIDOR   dice de donde sos
    el color del RANGO      dice quien sos

y ninguno de los dos puede cambiar para no chocar con el otro, porque los
dos significan algo. El rango ademas es el MISMO en las tres cartas por
regla —"el rango es uno solo por persona"— asi que no se puede retocar solo
en esta.

Son 8 rangos por 10 servidores = 80 combinaciones, y a nadie se le asigna
una: te toca la que te toca. Si el zafiro cae sobre RZ, cae.

QUE SE MIDE. Por cada servidor se saca el color real del panel del pie en el
punto donde va la figura, y se compara contra el acento de los ocho rangos:

    dE     distancia de color. Debajo de 25 los dos se leen como uno.
    ratio  contraste WCAG. Debajo de 3 la figura no se despega del panel.

⚠️ OJO CON LO QUE ESTO NO DICE. La figura YA tiene contorno de dos tonos
—trazo negro por fuera con paint-order y filo blanco por dentro— asi que el
BORDE se ve igual. Lo que se mide aca es si el RELLENO se confunde con el
panel, que es otra cosa: una figura con borde nitido y relleno del mismo
color que el fondo se lee como un HUECO, no como una pieza.
"""
import asyncio
import base64
import os
import re
import sys

import numpy as np
from PIL import Image
from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun.siluetas import PICO
from comun import emblema, divisor as DIV, rangos as RG
from los_nueve import defs
from paneles import borde

W, MARGEN = PICO.w, emblema.MARGEN
DEFS = defs()
BASE_Y = DIV.Y_EXTREMOS * PICO.h
SUBE = DIV.RECORRIDO * PICO.w * 1.3
PTS = [tuple(float(v) for v in p.split(','))
       for p in re.findall(r'(-?[\d.]+,-?[\d.]+)', PICO.d)]
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)
ALTO = PICO.h + MARGEN
Y_FILA = 331          # donde va la fila del pie
VELO = 'linear-gradient(180deg,rgba(0,0,0,.30),rgba(0,0,0,.64))'
ORDEN = ['TFC', 'SR', 'FFA', 'TWR', 'FTN', 'FRZ', 'URBF', 'DRA', 'EFA', 'RZ']


def y(v):
    return v + MARGEN


def lab(rgb):
    c = [v / 255 for v in rgb]
    c = [(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4) for v in c]
    r, g, b = c
    x = (.4124 * r + .3576 * g + .1805 * b) / .95047
    yy = .2126 * r + .7152 * g + .0722 * b
    z = (.0193 * r + .1192 * g + .9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > .008856 else 7.787 * t + 16 / 116
    fx, fy, fz = f(x), f(yy), f(z)
    return np.array([116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)])


def lum(c):
    v = [x / 255 for x in c]
    v = [(x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4) for x in v]
    return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]


def ratio(a, b):
    l1, l2 = sorted((lum(a), lum(b)), reverse=True)
    return (l1 + .05) / (l2 + .05)


def hexr(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def camino(n=90):
    xi, xd = borde(BASE_Y, 'izq'), borde(BASE_Y, 'der')
    return [(xi + (xd - xi) * (i / n), BASE_Y - DIV.altura(i / n) * SUBE)
            for i in range(n + 1)]


def panel_pie(pts):
    # el camino vive en comun/divisor.py: estaba copiado en ocho
    # scripts, todos con el mismo bug de la punta perdida
    return DIV.panel(pts, PTS, W, dy=MARGEN)


def pagina(sv):
    """El pie SIN la figura, para sacar el color real del panel donde va."""
    B, A, FONDO, EXTRA, _, _ = DEFS[sv]
    pts = camino()
    return f"""<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{{margin:0;background:transparent}}
.w{{position:relative;width:{W}px;height:{ALTO}px;clip-path:url(#c)}}
.f{{position:absolute;inset:0;background-repeat:repeat}}
</style></head><body>
<svg width="0" height="0"><defs><clipPath id="c" clipPathUnits="userSpaceOnUse">
<path d="{SIL}"/></clipPath></defs></svg>
<div class="w">
  <div class="f" style="background:{FONDO}"></div>
  {f'<div class="f" style="{EXTRA}"></div>' if EXTRA else ''}
  <div class="f" style="background:{FONDO};clip-path:path('{panel_pie(pts)}')"></div>
  <div class="f" style="background:{VELO};clip-path:path('{panel_pie(pts)}')"></div>
</div></body></html>"""


async def main():
    tmp = os.path.join(SCR, '_choque')
    os.makedirs(tmp, exist_ok=True)
    panel = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': W, 'height': ALTO})
        for sv in ORDEN:
            h = os.path.join(tmp, f'{sv}.html')
            open(h, 'w', encoding='utf-8').write(pagina(sv))
            await pg.goto('file://' + h)
            await pg.wait_for_timeout(160)
            png = os.path.join(tmp, f'{sv}.png')
            await pg.screenshot(path=png, omit_background=True)
            a = np.array(Image.open(png).convert('RGBA')).astype(float)
            # el cuadrado de 30x30 centrado donde va la figura
            cy = int(y(Y_FILA))
            reg = a[cy - 15:cy + 15, 135:165]
            m = reg[:, :, 3] > 250
            panel[sv] = tuple(reg[:, :, i][m].mean() for i in range(3))
        await b.close()

    print('EL RELLENO DE LA FIGURA CONTRA EL PANEL DONDE SE APOYA')
    print('  dE  <25  los dos colores se leen como uno')
    print('  x   <3   la figura no se despega del panel\n')
    print('  %-6s %-16s' % ('sv', 'panel') + ''.join('%9s' % r for r in RG.ORDEN))
    print('  ' + '-' * 96)
    malos = []
    for sv in ORDEN:
        pc = panel[sv]
        cel = []
        for r in RG.ORDEN:
            rc = hexr(RG.ACENTO[r])
            d = float(np.linalg.norm(lab(rc) - lab(pc)))
            x = ratio(rc, pc)
            cel.append('%5.0f/%.1f' % (d, x))
            if d < 25 or x < 3:
                malos.append((d, x, sv, r))
        print('  %-6s #%02X%02X%02X        ' % (sv, *[int(v) for v in pc])
              + ''.join('%9s' % c for c in cel))
    print('\n  (cada celda es  dE/contraste)')

    print('\n  CUANTAS DE LAS 80 ESTAN EN PROBLEMAS: %d' % len(malos))
    if malos:
        print('  las peores:')
        for d, x, sv, r in sorted(malos)[:10]:
            print('     %-4s sobre %-5s   dE %5.1f   contraste %.2f'
                  % (r, sv, d, x))

    # el reparto real: cuanta gente caeria en una combinacion mala
    import collections
    import json
    pool = json.load(open(os.path.join(BASE, 'datos', 'competitivo_pool.json'),
                          encoding='utf-8'))
    par = collections.Counter((p['sv'], p['rango']) for p in pool)
    mal = {(sv, r) for _, _, sv, r in malos}
    n = sum(v for k, v in par.items() if k in mal)
    print('\n  ⚠️ Y EL REPARTO: de las 138 personas de hoy, %d caerian en una'
          % n)
    print('     combinacion en problemas (%.0f%%).' % (100 * n / len(pool)))
    top = [(v, k) for k, v in par.items() if k in mal]
    for v, k in sorted(top, reverse=True)[:6]:
        print('       %-5s rango %-4s  %3d personas' % (k[0], k[1], v))

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
