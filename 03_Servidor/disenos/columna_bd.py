"""B contra D: cuanto material gana la columna, y cuanta foto cuesta.

Dlx: "estoy entre la B y la D".

⚠️ NO SE ELIGE POR GUSTO PORQUE HAY UN NUMERO QUE LO DECIDE. El lavado
existe para UNA cosa, y esta escrito en normal_card.css:249: "asi el numero
queda sobre el material de la carta, no sobre el avatar". Entonces la
pregunta no es cual se ve mejor: es CUANTO DEL NUMERO CAE SOBRE MATERIAL en
cada una, y cuanta foto cuesta.

TRES MEDIDAS, y las tres hacen falta:

  cobertura   que fraccion de la caja del numero cae sobre material repintado
              -> es lo que el lavado viene a comprar
  foto        que fraccion del area de la foto queda tapada
              -> es lo que cuesta
  contraste   contraste del numero blanco contra lo que tenga detras, SOBRE
              LA FOTO MAS CLARA que existe
              -> es el caso que decide, porque el numero es blanco

⚠️ LA TERCERA ES LA QUE MANDA. La cobertura y la foto son geometria y salen
iguales para todos; el contraste depende de la foto, y una foto casi blanca
es lo unico que puede hundir un numero blanco. Elegir por las dos primeras
seria elegir por el caso facil.
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
import avatares

W, MARGEN = PICO.w, emblema.MARGEN
DEFS = defs()
BASE_Y = DIV.Y_EXTREMOS * PICO.h
ALTO_FOTO = round(BASE_Y) + 14
ALTO = PICO.h + MARGEN
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)

# la caja del numero: .col esta en right:12px, ancho 56, top y(96), alto ~46
CAJA = (W - 12 - 56, MARGEN + 96, W - 12, MARGEN + 96 + 46)

CASOS = {'A · sin lavado': None,
         'B · original': (13, 25, 43),
         'D · más ancho': (17, 31, 54)}


def pagina(sv, par, av):
    B, A, FONDO, EXTRA, _, _ = DEFS[sv]
    lado = W * 115 / 100
    wash = ''
    if par:
        a, b, c = par
        m = (f'linear-gradient(270deg,#000 0%,#000 {a}%,'
             f'rgba(0,0,0,.5) {b}%,transparent {c}%)')
        wash = (f'<div class="wash" style="background:{FONDO};'
                f'-webkit-mask-image:{m};mask-image:{m}"></div>')
    foto = (f'<div class="ft"><img src="{av}" style="width:{lado:.0f}px;'
            f'left:{(W-lado)/2:.1f}px;top:{-(lado-ALTO_FOTO)*.44:.1f}px">'
            f'</div>') if av else ''
    return f"""<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{{margin:0;background:transparent}}
.w{{position:relative;width:{W}px;height:{ALTO}px;clip-path:url(#c)}}
.f{{position:absolute;inset:0;background-repeat:repeat}}
.ft{{position:absolute;top:{MARGEN}px;left:0;width:{W}px;height:{ALTO_FOTO}px;
  overflow:hidden}}
.ft img{{position:absolute;height:auto;display:block}}
.wash{{position:absolute;top:{MARGEN}px;left:0;right:0;height:{BASE_Y:.0f}px}}
{BRI.css('luz', MARGEN, PICO.h)}
</style></head><body>
<svg width="0" height="0"><defs><clipPath id="c" clipPathUnits="userSpaceOnUse">
<path d="{SIL}"/></clipPath></defs></svg>
<div class="w">
  <div class="f" style="background:{FONDO}"></div>
  {f'<div class="f" style="{EXTRA}"></div>' if EXTRA else ''}
  {foto}{wash}{BRI.arriba(A)}
</div></body></html>"""


def lum(c):
    v = [x / 255 for x in c]
    v = [(x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4) for x in v]
    return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]


def contra(a, b):
    l1, l2 = sorted((lum(a), lum(b)), reverse=True)
    return (l1 + .05) / (l2 + .05)


def arr(p):
    return np.array(Image.open(p).convert('RGB')).astype(float)


async def main():
    tmp = os.path.join(SCR, '_bd')
    os.makedirs(tmp, exist_ok=True)
    sv = 'TFC'
    clara = avatares._b64(avatares._prueba('clara', 11))
    real = avatares.para(1)[1]
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': W, 'height': ALTO})

        async def cap(nom, par, av):
            h = os.path.join(tmp, nom + '.html')
            open(h, 'w', encoding='utf-8').write(pagina(sv, par, av))
            await pg.goto('file://' + h)
            await pg.wait_for_timeout(180)
            f = os.path.join(tmp, nom + '.png')
            await pg.screenshot(path=f)
            return f

        sin_foto = arr(await cap('mat', None, None))     # el material puro
        res = {}
        for etq, par in CASOS.items():
            k = etq.split()[0]
            res[etq] = {
                'clara': arr(await cap(f'{k}_clara', par, clara)),
                'real': arr(await cap(f'{k}_real', par, real)),
                'sinw': arr(await cap(f'{k}_sinw', None, clara)),
            }
        await b.close()

    x0, y0, x1, y1 = [int(v) for v in CAJA]
    print('B CONTRA D, y por que no se elige por gusto\n')
    print('  la caja del numero es x %d..%d, y %d..%d\n' % (x0, x1, y0, y1))
    print('  %-16s %10s %10s %12s' % ('', 'cobertura', 'foto tapada',
                                      'contraste'))
    print('  %-16s %10s %10s %12s' % ('', 'del numero', 'del total',
                                      'sobre foto clara'))
    print('  ' + '-' * 54)
    for etq in CASOS:
        d = res[etq]
        cj = d['clara'][y0:y1, x0:x1]
        mt = sin_foto[y0:y1, x0:x1]
        sw = d['sinw'][y0:y1, x0:x1]
        # cuanto se parece lo que hay a MATERIAL en vez de a FOTO
        dm = np.abs(cj - mt).mean(2)
        df = np.abs(cj - sw).mean(2)
        cob = 100 * (df / np.maximum(dm + df, 1e-6)).mean()
        # cuanta foto se tapa, en toda la zona de la foto
        za = d['clara'][MARGEN:MARGEN + ALTO_FOTO]
        zs = d['sinw'][MARGEN:MARGEN + ALTO_FOTO]
        zm = sin_foto[MARGEN:MARGEN + ALTO_FOTO]
        dm2 = np.abs(za - zm).mean(2)
        df2 = np.abs(za - zs).mean(2)
        tap = 100 * (df2 / np.maximum(dm2 + df2, 1e-6)).mean()
        # contraste del blanco contra el fondo de la caja
        fondo = [cj[:, :, i].mean() for i in range(3)]
        c = contra((255, 255, 255), fondo)
        print('  %-16s %9.1f%% %9.1f%% %11.2f:1' % (etq, cob, tap, c))

    print("""
  como leer esto
    cobertura   cuanto de la caja del numero cae sobre material repintado
    foto tapada cuanto del area de la foto pierde el avatar
    contraste   del numero blanco contra lo que quede detras, sobre la foto
                mas clara que existe. Debajo de 3:1 el numero se hunde.
""")


if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
