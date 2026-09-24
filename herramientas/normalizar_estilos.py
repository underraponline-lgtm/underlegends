"""Recorta cada SVG de estilo a su propio dibujo.

   Los 16 vienen con viewBox 0 0 100 100 pero el dibujo adentro ocupa
   distinto en cada uno: punchline usa el 40% del ancho y cazafla el 96%.
   Si el rombo los escala a un tamano fijo, unos salen enormes y otros
   invisibles. Se mide la tinta real y se reescribe el viewBox a esa caja,
   asi todos quedan encuadrados igual y el rombo los trata parejo.
"""
import os as _osruta
RAIZ = _osruta.path.dirname(_osruta.path.abspath(__file__))
def _r(*p): return _osruta.path.join(RAIZ, *p)
import asyncio, io, os, re, glob
import numpy as np
from PIL import Image
from playwright.async_api import async_playwright

N = 400   # resolucion de medicion

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': N, 'height': N})
        print('%-14s %-16s %s' % ('estilo', 'viewBox nuevo', 'ocupaba'))
        for f in sorted(glob.glob(_r('v2/estilos/*.svg'))):
            svg = open(f, encoding='utf-8').read()
            if 'data-norm' in svg:
                continue
            await pg.set_content('<body style="margin:0;background:#000">'
                                 '<div style="width:%dpx;height:%dpx">%s</div></body>'
                                 % (N, N, svg.replace('#000', '#fff')))
            await pg.wait_for_timeout(120)
            a = np.array(Image.open(io.BytesIO(await pg.screenshot())).convert('L'))
            ys, xs = np.where(a > 40)
            if not len(xs):
                print('  %-12s vacio' % os.path.basename(f)); continue
            # de pixeles a unidades del viewBox original
            vb = re.search(r"viewBox='([^']+)'", svg) or re.search(r'viewBox="([^"]+)"', svg)
            x0v, y0v, wv, hv = [float(v) for v in vb.group(1).split()]
            x0 = x0v + xs.min() / N * wv
            x1 = x0v + xs.max() / N * wv
            y0 = y0v + ys.min() / N * hv
            y1 = y0v + ys.max() / N * hv
            lado = max(x1 - x0, y1 - y0) * 1.04          # margen chico
            cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
            nuevo = '%.2f %.2f %.2f %.2f' % (cx - lado / 2, cy - lado / 2, lado, lado)
            out = re.sub(r"viewBox=['\"][^'\"]+['\"]", "viewBox='%s' data-norm='1'" % nuevo, svg, 1)
            open(f, 'w', encoding='utf-8').write(out)
            print('  %-12s %-16s %.0f%% del viewBox viejo'
                  % (os.path.basename(f)[:-4], nuevo, 100 * max(x1 - x0, y1 - y0) / wv))
        await b.close()

asyncio.run(main())
