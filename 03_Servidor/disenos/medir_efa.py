"""EFA: es el color, la iluminacion o la textura?

Son tres arreglos distintos y no se pueden decidir mirando, porque los tres
producen la misma sensacion de "embarrado". Se miden los nueve fondos y se
ve en cual EFA es el raro.

    saturacion     si es el COLOR, EFA va a estar muy por debajo
    recorrido      si es la ILUMINACION, va a tener poco rango de luz
    grano          si es la TEXTURA, va a tener mas variacion local que el
                   resto a igual recorrido

El grano se mide como la desviacion de cada pixel contra el promedio de su
vecindario: eso separa la textura del degrade. Un degrade tiene recorrido
grande y grano cero; una textura tiene grano aunque el fondo sea plano.
"""
import asyncio
import base64
import os
import sys

import numpy as np
from PIL import Image
from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(SCR, 'texturas')
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from los_nueve import defs, ORDEN

D9 = defs()


async def main():
    filas = ''.join(
        f'<div class="c" id="{sv}"><div class="f" style="background:{D9[sv][2]}"></div>'
        + (f'<div class="x" style="{D9[sv][3]}"></div>' if D9[sv][3] else '')
        + (f'<div class="x" style="{D9[sv][4]}"></div>' if D9[sv][4] else '')
        + '</div>' for sv in ORDEN)
    pag = ('<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
           'body{margin:0;background:#000;display:flex;flex-wrap:wrap}'
           '.c{position:relative;width:300px;height:405px}'
           '.f,.x{position:absolute;inset:0;background-repeat:repeat}'
           '</style></head><body>' + filas + '</body></html>')
    out = os.path.join(SCR, '_medir_efa.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 900, 'height': 1300})
        await pg.goto('file://' + out); await pg.wait_for_timeout(2200)
        crops = {}
        for sv in ORDEN:
            el = await pg.query_selector('#' + sv)
            crops[sv] = await el.screenshot()
        await b.close()

    print('%-6s %-7s %-7s %-9s %s' % ('sv', 'satur', 'luz', 'recorrido', 'grano'))
    print('-' * 46)
    res = {}
    for sv in ORDEN:
        import io
        a = np.array(Image.open(io.BytesIO(crops[sv])).convert('RGB')).astype(float)
        mx, mn = a.max(axis=2), a.min(axis=2)
        sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0).mean()
        lum = (0.2126*a[:, :, 0] + 0.7152*a[:, :, 1] + 0.0722*a[:, :, 2])
        rec = np.percentile(lum, 97) - np.percentile(lum, 3)
        # grano: desvio contra el promedio de un vecindario de 9x9
        k = 9
        pad = np.pad(lum, k // 2, mode='edge')
        acum = np.cumsum(np.cumsum(pad, 0), 1)
        acum = np.pad(acum, ((1, 0), (1, 0)))
        s = (acum[k:, k:] - acum[:-k, k:] - acum[k:, :-k] + acum[:-k, :-k]) / (k*k)
        grano = np.abs(lum - s[:lum.shape[0], :lum.shape[1]]).mean()
        res[sv] = (sat, lum.mean(), rec, grano)
        print('%-6s %-7.3f %-7.1f %-9.1f %.2f' % (sv, sat, lum.mean(), rec, grano))

    print()
    for i, (n, idx) in enumerate((('saturacion', 0), ('luz media', 1),
                                  ('recorrido', 2), ('grano', 3))):
        orden = sorted(res, key=lambda s: res[s][idx])
        pos = orden.index('EFA') + 1
        print('%-11s EFA sale %d de 9  ·  de menos a mas: %s'
              % (n, pos, ' '.join(orden)))

asyncio.run(main())
