"""Cuanto se ve el brillo de arriba, sobre foto clara y sobre foto oscura.

POR QUE MEDIR ESTO. La primera tanda salio con mix-blend-mode:screen y en la
hoja NO SE VEIA. Mirando no se sabe si esta apagado o si el metodo no sirve;
son dos arreglos opuestos —subirle la intensidad o cambiar el modo— y elegir
mal cuesta otra tanda.

QUE MIDE. La franja del hombro: y = 70..112 del lienzo, sacando el disco del
escudo y lo transparente. Ahi es donde hay aire detras del escudo.

DOS NUMEROS, no uno:

    luz    cuanto sube el brillo medio
    color  cuanto sube la saturacion media

⚠️ Hacen falta los dos. Sobre una foto casi blanca NO SE PUEDE agregar luz:
screen satura y el resultado es el mismo blanco. Lo unico que todavia entra
ahi es COLOR. Un brillo que solo suba `luz` funciona en las fotos oscuras y
desaparece en las claras, y las claras existen.

El rig NO dibuja el marco: es constante entre variantes, asi que en la resta
se cancela, pero mete pixeles del acento en la franja y ensucia el promedio.
"""
import asyncio
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
import avatares

W, MARGEN = PICO.w, emblema.MARGEN
ALTO = PICO.h + MARGEN + 20
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)
SV = 'TFC'
B, A, FONDO, EXTRA, _, _ = defs()[SV]
BASE_Y = DIV.Y_EXTREMOS * PICO.h
ALTO_FOTO = round(BASE_Y) + 14
ZOOM, POS = 115, 0.62

FRANJA = (70, 112)          # la franja del hombro, en y del lienzo
R_ESC = emblema.LADO / 2 + 4


def rgba(hexc, a):
    h = hexc.lstrip('#')
    return 'rgba(%d,%d,%d,%.3f)' % (int(h[0:2], 16), int(h[2:4], 16),
                                    int(h[4:6], 16), a)


def croma(c):
    """Cuanto color tiene, 0..255, y cuanta luz."""
    h = c.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return max(r, g, b) - min(r, g, b), 0.2126 * r + 0.7152 * g + 0.0722 * b


def encender(c, f=.42):
    """Sube un color hacia su version encendida SIN lavarlo.

    ⚠️ Aclarar hacia el blanco —que es lo que hace tono()— le saca el croma
    justo cuando el croma es lo unico que se ve sobre una foto clara. Aca se
    sube el canal mas alto hasta el tope y los otros en proporcion, asi que
    la luz sube y el color se mantiene.
    """
    h = c.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    mx = max(r, g, b, 1)
    k = 1 + (255 / mx - 1) * f
    return '#%02X%02X%02X' % tuple(min(255, int(x * k)) for x in (r, g, b))


LUZ_B = B                  # el acento
LUZ_A = encender(A)        # el color propio del servidor, encendido


def capa(col, modo, inten, hasta, velo, centro):
    """El fondo del div de luz. `modo` es el blend; `velo` oscurece primero."""
    if not inten and not velo:
        return None
    caps = []
    if inten:
        if centro:
            caps.append(f'radial-gradient(ellipse 62% {hasta}% at 50% 0%,'
                        f'{rgba(col, inten)} 0%,{rgba(col, inten * .34)} 45%,'
                        f'transparent 76%)')
        else:
            caps.append(f'linear-gradient(180deg,{rgba(col, inten)} 0%,'
                        f'{rgba(col, inten * .30)} {hasta * .45:.0f}%,'
                        f'transparent {hasta}%)')
    if velo:
        caps.append(f'linear-gradient(180deg,rgba(0,0,0,{velo:.3f}) 0%,'
                    f'transparent {hasta}%)')
    return (','.join(caps), modo)


# (etiqueta, color, blend, intensidad, hasta %, velo, concentrado)
CASOS = [
    ('sin brillo',            LUZ_B, 'normal', 0,   0,  0,    False),
    ('acento screen .40',     LUZ_B, 'screen', .40, 16, 0,    False),
    ('acento velo+tinte .34', LUZ_B, 'normal', .34, 20, .30,  True),
    ('propio screen .40',     LUZ_A, 'screen', .40, 20, 0,    True),
    ('propio velo+tinte .40', LUZ_A, 'normal', .40, 22, .30,  True),
    ('propio velo+tinte .55', LUZ_A, 'normal', .55, 24, .34,  True),
]

FOTOS = (('clara', 'clara'), ('oscura', 'oscura'))


def pagina(av_uri, cap):
    luz = ''
    if cap:
        bg, modo = cap
        luz = (f'<div style="position:absolute;top:{MARGEN}px;left:0;right:0;'
               f'height:{PICO.h}px;background:{bg};mix-blend-mode:{modo}">'
               f'</div>')
    lado = W * ZOOM / 100
    return f"""<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{{margin:0;background:transparent}}
.w{{position:relative;width:{W}px;height:{ALTO}px}}
.c{{position:absolute;inset:0;clip-path:url(#c)}}
.f{{position:absolute;inset:0}}
.ft{{position:absolute;top:{MARGEN}px;left:0;width:{W}px;height:{ALTO_FOTO}px;
  overflow:hidden}}
.ft img{{position:absolute;height:auto;display:block}}
</style></head><body><div class="w">
<svg width="0" height="0"><defs><clipPath id="c" clipPathUnits="userSpaceOnUse">
<path d="{SIL}"/></clipPath></defs></svg>
<div class="c">
  <div class="f" style="background:{FONDO}"></div>
  {f'<div class="f" style="{EXTRA}"></div>' if EXTRA else ''}
  <div class="ft"><img src="{av_uri}" style="width:{lado:.0f}px;
       left:{(W-lado)/2:.1f}px;top:{-(lado-ALTO_FOTO)*POS:.1f}px"></div>
  {luz}
</div></div></body></html>"""


def stats(png):
    a = np.array(Image.open(png).convert('RGBA')).astype(float)
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    dentro = a[:, :, 3] > 250
    franja = (yy >= FRANJA[0]) & (yy < FRANJA[1])
    fuera_esc = ((xx - W / 2) ** 2 + (yy - emblema.CY) ** 2) > R_ESC ** 2
    m = dentro & franja & fuera_esc
    if m.sum() == 0:
        return 0.0, 0.0, 0
    r, g, b = a[:, :, 0][m], a[:, :, 1][m], a[:, :, 2][m]
    luz = (0.2126 * r + 0.7152 * g + 0.0722 * b).mean()
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    return luz, (mx - mn).mean(), int(m.sum())


async def main():
    tmp = os.path.join(SCR, '_medir')
    os.makedirs(tmp, exist_ok=True)
    uris = {k: avatares._b64(avatares._prueba(c, 11 if c == 'clara' else 3))
            for k, c in FOTOS}
    res = {}
    async with async_playwright() as p:
        br = await p.chromium.launch(args=['--no-sandbox'])
        pg = await br.new_page(viewport={'width': W, 'height': ALTO})
        for foto, uri in uris.items():
            for i, (etq, col, modo, inten, hasta, velo, centro) in enumerate(CASOS):
                h = os.path.join(tmp, f'{foto}_{i}.html')
                open(h, 'w', encoding='utf-8').write(
                    pagina(uri, capa(col, modo, inten, hasta, velo, centro)))
                await pg.goto('file://' + h)
                await pg.wait_for_timeout(220)
                png = os.path.join(tmp, f'{foto}_{i}.png')
                await pg.screenshot(path=png, omit_background=True)
                res[(foto, i)] = stats(png)
        await br.close()

    print('LA PALETA: cuanto COLOR tiene cada uno de los dos')
    print('%-6s %-9s %5s %5s   %-9s %5s %5s' %
          ('sv', 'acento', 'crom', 'luz', 'propio', 'crom', 'luz'))
    print('-' * 54)
    for sv, d in defs().items():
        cb, ca = croma(d[0]), croma(d[1])
        print('%-6s %-9s %5.0f %5.0f   %-9s %5.0f %5.0f'
              % (sv, d[0], cb[0], cb[1], d[1], ca[0], ca[1]))
    print('\nTFC:  acento %s -> encendido no sirve, ya es casi blanco'
          '\n      propio %s -> encendido %s\n' % (B, A, LUZ_A))

    print('EL BRILLO DE ARRIBA, EN LA FRANJA DEL HOMBRO  y=%d..%d' % FRANJA)
    print('  %d px medidos, sacando el escudo y lo transparente\n'
          % res[('clara', 0)][2])
    print('%-24s %18s %18s' % ('', 'FOTO CLARA', 'FOTO OSCURA'))
    print('%-24s %8s %9s %8s %9s' % ('variante', 'luz', 'color',
                                     'luz', 'color'))
    print('-' * 62)
    for i, c in enumerate(CASOS):
        f = []
        for foto, _ in FOTOS:
            l, s, _n = res[(foto, i)]
            l0, s0, _ = res[(foto, 0)]
            f += ['%+7.1f' % (l - l0) if i else '%7.1f' % l,
                  '%+8.1f' % (s - s0) if i else '%8.1f' % s]
        print('%-24s %s %s   %s %s' % (c[0], f[0], f[1], f[2], f[3]))
    print('\n(la fila 1 son valores absolutos; las demas, cambio contra ella)')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
