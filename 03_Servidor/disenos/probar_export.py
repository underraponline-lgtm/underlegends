"""Probar que el escudo y las estrellas SI salen en el PNG.

⚠️ LA PRIMERA CORRIDA DE ESTE TEST ME CORRIGIO, y vale mas que el test:

Con la estructura de las hojas de diseño NO SOBRESALE NADA. El lienzo ya
incluye los 62 px de margen de arriba, asi que el escudo y las estrellas
estan DENTRO de la caja del elemento. Sobresalen de LA SILUETA, no del
ELEMENTO, y son dos cosas distintas que yo venia mezclando.

O sea que el riesgo no es el que yo describia. El riesgo real es que el
generador arme la carta con el elemento del tamaño de la silueta —300x405
sin margen— y ahi si las piezas caen afuera y se pierden.

Este test reproduce ESE caso: el `.wrap` sin margen y las piezas colgando con
top negativo. Es el modo de falla de verdad.

    A · como se hacia antes   capturando solo el elemento
    B · con la union          sumando lo que cuelga por fuera

⚠️ No se puede verificar mirando: un PNG recortado se ve como un PNG valido.
Por eso se MIDE cuantos pixeles opacos hay arriba del borde de la carta.
"""
import asyncio
import base64
import io
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
from comun import emblema, divisor as DIV
from los_nueve import defs
from paneles import borde
import avatares

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

W, MARGEN = PICO.w, emblema.MARGEN
ALTO = PICO.h + MARGEN + 20
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)
SV = 'TFC'
B, A, FONDO, EXTRA, REMATE, _ = defs()[SV]
t = emblema.tono
BASE_Y = DIV.Y_EXTREMOS * PICO.h
SUBE = DIV.RECORRIDO * PICO.w * 1.3
PTS = [tuple(float(v) for v in p.split(','))
       for p in re.findall(r'(-?[\d.]+,-?[\d.]+)', PICO.d)]

# la misma regla que quedo en exportar_png.py
SALTAR = ("n => !!n.closest('.clip, .cuerpo, .c-photo') "
          "|| n.ownerSVGElement !== null")


def y(v):
    return v + MARGEN


def camino(n=90):
    xi, xd = borde(BASE_Y, 'izq'), borde(BASE_Y, 'der')
    return [(xi + (xd - xi) * (i / n), BASE_Y - DIV.altura(i / n) * SUBE)
            for i in range(n + 1)]


def panel_pie(pts):
    # el camino vive en comun/divisor.py: estaba copiado en ocho
    # scripts, todos con el mismo bug de la punta perdida
    return DIV.panel(pts, PTS, W, dy=MARGEN)


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


ESC = b64(os.path.join(BASE, 'comun', 'escudos_cuad', f'sv_{SV.lower()}.png'))
_, AV = avatares.para(0)


def html():
    pts = camino()
    # ⚠️ EL MODO DE FALLA: el elemento mide lo que la SILUETA, sin margen.
    # Todo lo que en las hojas de diseño vive en los 62 px de arriba, aca cae
    # con top negativo, o sea AFUERA de la caja del elemento.
    sil0 = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
                  lambda m: '%s,%g' % (m.group(1), float(m.group(2))), PICO.d)
    return f"""<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{{margin:0;padding:80px;background:transparent}}
.wrap{{position:relative;width:{W}px;height:{PICO.h}px}}
.cuerpo{{position:absolute;inset:0}}
.fondo{{position:absolute;inset:0;background:{FONDO}}}
.foto{{position:absolute;top:0;left:0;right:0;height:{round(BASE_Y)+14}px;
  overflow:hidden}}
.foto img{{width:100%;height:100%;object-fit:cover}}
.borde{{position:absolute;inset:0}}
{emblema.CSS}
</style></head><body>
<div class="wrap">
  <svg width="0" height="0"><defs><clipPath id="c" clipPathUnits="userSpaceOnUse">
    <path d="{sil0}"/></clipPath></defs></svg>
  <div class="cuerpo" style="clip-path:url(#c)">
    <div class="fondo"></div>
    <div class="foto"><img src="{AV}"></div>
  </div>
  <svg class="borde" viewBox="0 0 {W} {PICO.h}" width="{W}" height="{PICO.h}">
    <g clip-path="url(#c)">
      <path d="{sil0}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
    </g>
  </svg>
  <div class="pieza" style="top:{emblema.BAJA - emblema.LADO/2}px;
       width:{emblema.LADO}px;height:{emblema.LADO}px;
       box-shadow:0 4px 14px rgba(0,0,0,.85),0 0 0 3px {B};
       background:{t(A,-.62)}"><img src="{ESC}"></div>
  {''.join(f'<svg class="est" viewBox="0 0 24 24" width="{emblema.E}" '
           f'height="{emblema.E}" style="left:{150 - 44 + k*32}px;'
           f'top:{emblema.BAJA - emblema.LADO/2 - emblema.E - 3.8}px">'
           f'<path d="{emblema.ESTRELLA}" fill="#fff" stroke="rgba(0,0,0,.66)" '
           f'stroke-width="1.6" paint-order="stroke"/></svg>' for k in range(3))}
</div></body></html>"""


def opacos_arriba(png, borde_y):
    """Cuantos pixeles opacos hay por ENCIMA del borde de la carta."""
    a = np.array(Image.open(io.BytesIO(png)).convert('RGBA'))
    return int((a[:borde_y, :, 3] > 40).sum()), a.shape


async def main():
    out = os.path.join(SCR, '_prueba_export.html')
    open(out, 'w', encoding='utf-8').write(html())
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 700, 'height': 700},
                              device_scale_factor=2)
        await pg.goto('file://' + out)
        await pg.wait_for_timeout(1500)

        el = await pg.query_selector('.wrap')
        cb = await el.bounding_box()

        # A · como se hacia antes
        a_png = await el.screenshot(omit_background=True)

        # B · con la union
        x0, y0 = cb['x'], cb['y']
        x1, y1 = cb['x'] + cb['width'], cb['y'] + cb['height']
        for e in await el.query_selector_all('*'):
            if await e.evaluate(SALTAR):
                continue
            k = await e.bounding_box()
            if not k or k['width'] == 0:
                continue
            x0 = min(x0, k['x']); y0 = min(y0, k['y'])
            x1 = max(x1, k['x'] + k['width'])
            y1 = max(y1, k['y'] + k['height'])
        m = 4
        b_png = await pg.screenshot(
            omit_background=True,
            clip={'x': x0-m, 'y': y0-m, 'width': x1-x0+2*m, 'height': y1-y0+2*m})
        await b.close()

    # el borde de arriba de la carta en cada captura, a escala x2.
    # En A la carta empieza en 0; en B empieza donde termina lo que sobresale.
    borde_a = 2
    borde_b = int((cb['y'] - y0 + m) * 2)

    na, sa = opacos_arriba(a_png, borde_a)
    nb, sb = opacos_arriba(b_png, borde_b)

    print('SOBRESALE   izq %.0f   der %.0f   ARRIBA %.0f   abajo %.0f  (px)'
          % (cb['x'] - x0, x1 - (cb['x'] + cb['width']),
             cb['y'] - y0, y1 - (cb['y'] + cb['height'])))
    print()
    print('%-42s %-14s %s' % ('', 'tamaño', 'pixeles opacos arriba del borde'))
    print('-' * 84)
    print('%-42s %-14s %d' % ('A · capturando solo el elemento',
                              '%dx%d' % (sa[1], sa[0]), na))
    print('%-42s %-14s %d' % ('B · con la union', '%dx%d' % (sb[1], sb[0]), nb))
    print()
    if na == 0 and nb > 0:
        print('✔ A PERDIO el escudo y las estrellas: cero pixeles arriba.')
        print('  B los conserva: %d pixeles opacos donde A no tiene nada.' % nb)
        print('  Ese es exactamente el bug que arregla la union.')
    elif nb > na:
        print('B conserva %d pixeles mas que A' % (nb - na))
    else:
        print('⚠️ la union NO recupero nada: revisar la regla de SALTAR')

    for n, d in (('_prueba_A.png', a_png), ('_prueba_B.png', b_png)):
        open(os.path.join(SCR, n), 'wb').write(d)
    print('\n-> _prueba_A.png  y  _prueba_B.png')

asyncio.run(main())
