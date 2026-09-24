"""EFA: bajarle el grano, que es lo unico que lo saca de escala.

Medido sobre los nueve fondos (medir_efa.py):

    grano   EFA 10.58   ·   9 de 9, el mas alto de todos
            el segundo es DRA con 8.23 y el resto vive entre 0.69 y 4.89

    saturacion  2 de 9, pero FTN tiene menos (0.503) y esta aprobado
    luz media   3 de 9, pero FFA y TFC son mas oscuros y estan aprobados

O sea que ni el color ni la iluminacion lo explican: hay cartas aprobadas
mas apagadas y mas oscuras que EFA. En grano es el unico fuera de escala.

De donde salia: el cuero iba con background-size:cover, asi que el mosaico
de 512 se estiraba a 300x405 y sus manchas quedaban enormes. A ese tamaño
no se lee como cuero sino como camuflaje.

Cada variante se MIDE y el numero va en el rotulo, para elegir con el dato y
no con la impresion. El objetivo es meterse en la banda de 2 a 5, que es
donde viven FRZ, FFA y FTN.
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
TEX = os.path.join(SCR, 'texturas')
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun.siluetas import PICO
from comun import emblema
from los_nueve import defs

W, MARGEN = PICO.w, emblema.MARGEN
ALTO = PICO.h + MARGEN
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)
D9 = defs()


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


UL = b64(os.path.join(BASE, '02_Competitivo', 'ul_blanco.png'))
ESC = b64(os.path.join(BASE, 'comun', 'escudos_cuad', 'sv_efa.png'))
def tx(n): return b64(os.path.join(TEX, n + '.png'))
t = emblema.tono

A, B = '#3A2412', '#E8A144'
# variante de color: mismo tono pero mas saturado y mas caliente, coñac en
# vez de barro. Se prueba aparte para separar color de textura.
A2 = '#4A2A0E'
BASE_G = f'linear-gradient(166deg,{t(A,.30)} 0%,{A} 44%,{t(A,-.55)} 100%)'
BASE_C = f'linear-gradient(166deg,{t(A2,.34)} 0%,{A2} 44%,{t(A2,-.52)} 100%)'
REM = 'box-shadow:inset 0 0 0 4px #E8A144,inset 0 0 0 6px rgba(0,0,0,.55)'


def cu(tam, op, tex='cuero', mez='soft-light'):
    return (f'background-image:url({tx(tex)});background-size:{tam};'
            f'background-position:center;mix-blend-mode:{mez};opacity:{op}')


CASOS = [
 ('1 · actual', BASE_G, cu('cover', '.55'), REM),
 ('2 · mosaico 150px', BASE_G, cu('150px', '.55'), REM),
 ('3 · mosaico 150px al 34%', BASE_G, cu('150px', '.34'), REM),
 ('4 · mosaico 150px al 20%', BASE_G, cu('150px', '.20'), REM),
 ('5 · mancha grande pero tenue', BASE_G, cu('cover', '.22'), REM),
 ('6 · sin cuero · fibra fina', BASE_G, cu('200px', '.30', 'fibra'), REM),
 ('7 · sin textura · solo el degradé', BASE_G, '', REM),
 ('8 · coñac · color más caliente, cuero al 30%', BASE_C, cu('150px', '.30'), REM),
]


def grano(img):
    a = np.array(img.convert('RGB')).astype(float)
    lum = 0.2126*a[:, :, 0] + 0.7152*a[:, :, 1] + 0.0722*a[:, :, 2]
    k = 9
    pad = np.pad(lum, k//2, mode='edge')
    ac = np.pad(np.cumsum(np.cumsum(pad, 0), 1), ((1, 0), (1, 0)))
    s = (ac[k:, k:] - ac[:-k, k:] - ac[k:, :-k] + ac[:-k, :-k]) / (k*k)
    return np.abs(lum - s[:lum.shape[0], :lum.shape[1]]).mean()


def carta(i, etq, fondo, cap, rem, medida=None):
    cid = f'e{i}'
    c = f'<div class="cap" style="{cap}"></div>' if cap else ''
    r = f'<div class="rem" style="{rem}"></div>' if rem else ''
    nota = f'<div class="nu">grano {medida:.2f}</div>' if medida is not None else ''
    return f"""<div class="col"><div class="et">{etq}</div>{nota}
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})" id="m{i}">
    <div class="fondo" style="background:{fondo}"></div>{c}{r}
    <img class="ul" src="{UL}">
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
      <path d="{SIL}" fill="none" stroke="{t(A,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  {emblema.pieza('EFA', A, B, ESC)}
</div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:32px;flex-wrap:wrap;align-items:flex-start}}
.col{{text-align:center;width:{W}px;margin-bottom:30px}}
.et{{color:#EDEDF5;font-size:12.5px;font-weight:800;letter-spacing:1.1px}}
.nu{{color:#8A8AA0;font-size:11px;margin:3px 0 14px}}
.rot{{color:#EDEDF5;font-size:16px;font-weight:700;letter-spacing:1.4px;margin:6px 0 20px}}
.rot span{{color:#8A8AA0;font-weight:400;letter-spacing:0;font-size:13px}}
.wrap{{position:relative;width:{W}px;height:{ALTO}px}}
.defs{{position:absolute}}
.cuerpo{{position:absolute;inset:0;filter:drop-shadow(0 12px 26px rgba(0,0,0,.72))}}
.borde{{position:absolute;inset:0;pointer-events:none}}
.fondo{{position:absolute;inset:0;z-index:0}}
.cap{{position:absolute;inset:0;z-index:1;background-repeat:repeat}}
.rem{{position:absolute;inset:0;z-index:2}}
.ul{{position:absolute;left:50%;top:424px;transform:translateX(-50%);z-index:6;
  height:20.7px;width:auto;opacity:.94;filter:drop-shadow(0 2px 5px rgba(0,0,0,.95))}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()

    def pagina(medidas=None):
        cuerpo = ''.join(carta(i, *c, medidas[i] if medidas else None)
                         for i, c in enumerate(CASOS))
        return ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
                + fuentes + CSS + '</style></head><body>'
                '<div class="rot">EFA · BAJARLE EL GRANO <span>— era 10.58, el más '
                'alto de los nueve. Las aprobadas viven entre 0.7 y 5</span></div>'
                '<div class="fila">' + cuerpo + '</div></body></html>')

    out = os.path.join(SCR, 'efa_grano.html')
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1060, 'height': 1200},
                              device_scale_factor=2)
        open(out, 'w', encoding='utf-8').write(pagina())
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        med = {}
        for i in range(len(CASOS)):
            el = await pg.query_selector(f'#m{i}')
            med[i] = grano(Image.open(io.BytesIO(await el.screenshot())))
            print('%-42s grano %5.2f' % (CASOS[i][0], med[i]))
        open(out, 'w', encoding='utf-8').write(pagina(med))
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'efa_grano.png'), full_page=True)
        await b.close()
    print('\n-> efa_grano.png')

asyncio.run(main())
