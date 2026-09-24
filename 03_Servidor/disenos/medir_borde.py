"""El borde de color, y si el fondo se esta lavando.

Dlx: "los fondos estan malos, los bordes de colores desaparecieron, tienen
que seguir el color del servidor".

⚠️ EL BORDE ES EL MISMO PROBLEMA QUE YA MEDIMOS EN EL BRILLO, Y NO LO VI.
El marco usa stroke={B}, que es EL ACENTO del servidor. Y en brillo.py ya
esta escrito que el acento NO TIENE COLOR en tres de diez:

    TFC  #F2E9E9  croma   9
    URBF #FFFFFF  croma   0
    DRA  #FFFFFF  croma   0

O sea que en esos tres el borde es blanco, y un borde blanco no "sigue el
color del servidor": no sigue ninguno. Cuando resolvi el brillo cambie SOLO
el brillo, sin mirar que el borde tenia la misma falla. La leccion es que
cuando una causa aparece, hay que buscar TODOS los lugares donde pega, no
arreglar el que se estaba mirando.

Este script mide dos cosas:

  1. el CROMA del borde de cada carta, tal como se dibuja hoy
  2. cuanto se aleja el fondo RENDERIZADO del FONDO canonico de defs(),
     que es la otra queja: si el lavado y el brillo lo estan lavando, se
     tiene que ver como una diferencia contra el original
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
from comun import emblema, divisor as DIV, brillo as BRI
from los_nueve import defs

W, MARGEN = PICO.w, emblema.MARGEN
DEFS = defs()
BASE_Y = DIV.Y_EXTREMOS * PICO.h
ALTO = PICO.h + MARGEN
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)
ORDEN = ['TFC', 'SR', 'FFA', 'TWR', 'FTN', 'FRZ', 'URBF', 'DRA', 'EFA', 'RZ']
LAVADO = (13, 25, 43)


def croma(c):
    h = c.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return max(r, g, b) - min(r, g, b)


def pagina(sv, con_capas):
    """La carta sin foto. `con_capas` prende el lavado y el brillo."""
    B, A, FONDO, EXTRA, _, _ = DEFS[sv]
    a, b, c = LAVADO
    m = (f'linear-gradient(270deg,#000 0%,#000 {a}%,'
         f'rgba(0,0,0,.5) {b}%,transparent {c}%)')
    capas = ((f'<div class="wash" style="background:{FONDO};'
              f'-webkit-mask-image:{m};mask-image:{m}"></div>'
              + BRI.arriba(A)) if con_capas else '')
    return f"""<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{{margin:0;background:transparent}}
.w{{position:relative;width:{W}px;height:{ALTO}px}}
.c{{position:absolute;inset:0;clip-path:url(#c)}}
.f{{position:absolute;inset:0;background-repeat:repeat}}
.wash{{position:absolute;top:{MARGEN}px;left:0;right:0;height:{BASE_Y:.0f}px}}
{BRI.css('luz', MARGEN, PICO.h)}
</style></head><body>
<svg width="0" height="0"><defs><clipPath id="c" clipPathUnits="userSpaceOnUse">
<path d="{SIL}"/></clipPath></defs></svg>
<div class="w"><div class="c">
  <div class="f" style="background:{FONDO}"></div>
  {f'<div class="f" style="{EXTRA}"></div>' if EXTRA else ''}
  {capas}
</div>
<svg style="position:absolute;inset:0" viewBox="0 0 {W} {ALTO}"
     width="{W}" height="{ALTO}"><g clip-path="url(#c)">
  <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
</g></svg></div></body></html>"""


def medir(png):
    """El croma del borde y el color medio del campo."""
    a = np.array(Image.open(png).convert('RGBA')).astype(float)
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    op = a[:, :, 3] > 250
    # el borde: los 5 px de adentro del contorno, a media altura
    banda = op & (yy > MARGEN + 90) & (yy < MARGEN + 200)
    izq = np.zeros_like(banda)
    for r in range(banda.shape[0]):
        c = np.where(banda[r])[0]
        if len(c) > 30:
            izq[r, c[0]:c[0] + 5] = True
            izq[r, c[-1] - 4:c[-1] + 1] = True
    if izq.sum() < 40:
        return None
    bc = [a[:, :, i][izq].mean() for i in range(3)]
    # el campo: el centro, lejos del borde y del lavado
    campo = op & (yy > MARGEN + 90) & (yy < MARGEN + 200) & (xx > 60) & (xx < 150)
    fc = [a[:, :, i][campo].mean() for i in range(3)]
    cr = max(bc) - min(bc)
    return cr, bc, fc


async def main():
    tmp = os.path.join(SCR, '_bor')
    os.makedirs(tmp, exist_ok=True)
    res = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': W, 'height': ALTO})
        for sv in ORDEN:
            for cap in (False, True):
                h = os.path.join(tmp, f'{sv}_{int(cap)}.html')
                open(h, 'w', encoding='utf-8').write(pagina(sv, cap))
                await pg.goto('file://' + h)
                await pg.wait_for_timeout(170)
                f = os.path.join(tmp, f'{sv}_{int(cap)}.png')
                await pg.screenshot(path=f, omit_background=True)
                res[(sv, cap)] = medir(f)
        await b.close()

    print('1. EL BORDE: cuanto color tiene, tal como se dibuja hoy')
    print('   (usa el ACENTO, que es lo mismo que fallaba en el brillo)\n')
    print('   %-6s %-9s %6s   %-9s %6s   %s'
          % ('sv', 'acento', 'croma', 'propio', 'croma', 'el borde'))
    print('   ' + '-' * 62)
    ciegos = []
    for sv in ORDEN:
        B, A = DEFS[sv][0], DEFS[sv][1]
        cb, ca = croma(B), croma(A)
        mal = ' <- SIN COLOR' if cb < 20 else ''
        if cb < 20:
            ciegos.append(sv)
        print('   %-6s %-9s %6d   %-9s %6d   %.0f%s'
              % (sv, B, cb, A, ca, res[(sv, True)][0], mal))
    print('\n   ⚠️ %d de 10 tienen el borde SIN COLOR: %s'
          % (len(ciegos), ', '.join(ciegos)))
    print('   El propio de esos tres si tiene croma: %s'
          % ', '.join('%s %d' % (s, croma(DEFS[s][1])) for s in ciegos))

    print('\n\n2. EL FONDO: cuanto lo mueven el lavado y el brillo')
    print('   (color medio del campo, sin capas contra con capas)\n')
    print('   %-6s %14s %14s %8s' % ('sv', 'sin capas', 'con capas', 'delta'))
    print('   ' + '-' * 48)
    for sv in ORDEN:
        f0 = res[(sv, False)][2]
        f1 = res[(sv, True)][2]
        d = sum((f1[i] - f0[i]) ** 2 for i in range(3)) ** .5
        mal = '  <- se lava' if d > 25 else ''
        print('   %-6s  #%02X%02X%02X       #%02X%02X%02X    %6.1f%s'
              % (sv, *[int(v) for v in f0], *[int(v) for v in f1], d, mal))
    print("""
   ⚠️ Si el delta es chico, el fondo NO se esta lavando y lo que se ve
   distinto es otra cosa —la foto, o el recorte de la hoja—. Si es grande,
   el lavado o el brillo lo estan pisando y hay que bajarlos.
""")


if __name__ == '__main__':
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    asyncio.run(main())
