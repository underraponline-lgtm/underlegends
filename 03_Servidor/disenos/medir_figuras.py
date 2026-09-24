"""¿Se distinguen las ocho figuras de rango a 26 px, SIN color?

⚠️ Es la pregunta que importa y no se contesta mirando. El color ya sabemos
que separa —cero pares por debajo de dE 20, medido en medir_ovr_sv.py—; lo
que falta saber es si LA FIGURA AGUANTA SOLA, que es lo que pasa en
miniatura, sobre un fondo cualquiera y con daltonismo.

COMO. Dos figuras se parecen si TAPAN LA MISMA AREA. Se rasteriza cada una
al tamaño real con el mismo Chromium que dibuja la carta —no con otro
rasterizador, para que el antialias sea el de verdad— y se cruzan de a pares
con IoU: interseccion sobre union.

    IoU 1.00  la misma figura
    IoU 0.85  se confunden
    IoU 0.75  limite
    IoU 0.60  se separan bien

⚠️ Se comparan CENTRADAS Y AL AREA QUE LES TOCA, con la ESCALA de
comun/rangos.py aplicada. Comparar las cajas sin escalar mide otra cosa: un
triangulo y un circulo con la misma caja tapan areas muy distintas y saldria
un IoU bajo por el tamaño, no por la forma.
"""
import asyncio
import os
import sys

import numpy as np
from PIL import Image
from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
from comun import rangos as RG

LADO = 26
ESC = 8            # se rasteriza x8 para que el IoU no lo decida el antialias


def pagina():
    piezas = []
    for i, r in enumerate(RG.ORDEN):
        L = LADO * RG.ESCALA[r] * ESC
        caja = LADO * 1.35 * ESC
        piezas.append(
            f'<div class="c"><svg width="{L:.1f}" height="{L:.1f}" '
            f'viewBox="0 0 100 100" style="left:{(caja-L)/2:.1f}px;'
            f'top:{(caja-L)/2:.1f}px"><path d="{RG.FIGURA[r]}" fill="#fff"/>'
            f'</svg></div>')
    caja = LADO * 1.35 * ESC
    return (f'<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
            f'body{{margin:0;background:#000;display:flex}}'
            f'.c{{position:relative;width:{caja:.0f}px;height:{caja:.0f}px}}'
            f'.c svg{{position:absolute}}</style></head><body>'
            + ''.join(piezas) + '</body></html>')


async def main():
    out = os.path.join(SCR, '_figuras.html')
    open(out, 'w', encoding='utf-8').write(pagina())
    png = os.path.join(SCR, '_figuras.png')
    caja = int(LADO * 1.35 * ESC)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': caja * len(RG.ORDEN),
                                        'height': caja})
        await pg.goto('file://' + out)
        await pg.wait_for_timeout(400)
        await pg.screenshot(path=png)
        await b.close()

    a = np.array(Image.open(png).convert('L')).astype(float) / 255
    M = {}
    for i, r in enumerate(RG.ORDEN):
        m = a[:, i * caja:(i + 1) * caja]
        M[r] = m

    print('LAS OCHO FIGURAS A %d PX, SIN COLOR' % LADO)
    print('  rasterizadas x%d con el mismo Chromium de la carta\n' % ESC)
    print('  %-4s  %6s' % ('', 'area'))
    for r in RG.ORDEN:
        print('  %-4s  %5.1f%%   (escala %.2f)'
              % (r, 100 * M[r].mean(), RG.ESCALA[r]))

    pares = []
    for i, x in enumerate(RG.ORDEN):
        for yy in RG.ORDEN[i + 1:]:
            inter = np.minimum(M[x], M[yy]).sum()
            union = np.maximum(M[x], M[yy]).sum()
            pares.append((inter / union if union else 0, x, yy))
    pares.sort(reverse=True)

    print('\n  LOS PARES MAS PARECIDOS de los %d:' % len(pares))
    for v, x, yy in pares[:8]:
        aviso = ('   <- SE CONFUNDEN' if v >= .85 else
                 '   <- al limite' if v >= .75 else '')
        print('     %-4s vs %-4s   IoU %.3f%s' % (x, yy, v, aviso))
    print('\n  el par mas distinto:  %s vs %s   IoU %.3f'
          % (pares[-1][1], pares[-1][2], pares[-1][0]))

    malos = [(v, x, yy) for v, x, yy in pares if v >= .75]
    print('\n  pares por encima de 0.75: %d de %d' % (len(malos), len(pares)))

    # ── y lo que de verdad importa: los cuatro del medio ─────────────────
    # A, B, C y D son 114 de 138 (83%). Son los que mas se van a ver.
    print('\n  ⚠️ LOS CUATRO DEL MEDIO (A B C D = 114 de 138, el 83%):')
    medio = [(v, x, yy) for v, x, yy in pares
             if x in 'ABCD' and yy in 'ABCD' and len(x) == 1 and len(yy) == 1]
    for v, x, yy in sorted(medio, reverse=True):
        aviso = ('   <- SE CONFUNDEN' if v >= .85 else
                 '   <- al limite' if v >= .75 else '   ok')
        print('     %-4s vs %-4s   IoU %.3f%s' % (x, yy, v, aviso))
    peor = max(medio)
    print('\n  el peor del medio es %s vs %s con %.3f' % (peor[1], peor[2], peor[0]))


if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
