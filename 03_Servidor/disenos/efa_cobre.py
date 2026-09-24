"""EFA: acercarle el fondo al cobre de su logo.

Dlx lo vio antes que la medicion: "el logo tiene cosas naranjas pero la
mayor parte del fondo es marron". Confirmado.

    datos/colores_sv_marca.json dice   EFA = #A95225  ·  "del logo · cobre"
    la carta usaba                     #3A2412

Son 57.9 puntos de luz de diferencia. Y la regla del proyecto es que EL
COLOR SALE DEL LOGO, no de otro lado: ese JSON existe justamente por eso.

Cotejados los nueve contra el JSON, solo dos se apartan de verdad:

    FRZ   -70.4   pero es una decision tomada y anotada: era la unica carta
                  clara de las nueve y se oscurecio a proposito
    EFA   -57.9   esto no se decidio, quedo asi

Medido sobre la tinta del logo, sus colores dominantes son #A84800, #601800,
#A87830 y #C09048 —naranja y cobre— y el promedio de lo cromatico da
#6B3D1F. El #3A2412 no aparece en ningun lado.

La textura queda como quedo: cuero a 150px y baja opacidad, que fue lo que
Dlx eligio de la tanda del grano. Lo unico que se mueve aca es el color.
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

W, MARGEN = PICO.w, emblema.MARGEN
ALTO = PICO.h + MARGEN
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


UL = b64(os.path.join(BASE, '02_Competitivo', 'ul_blanco.png'))
ESC = b64(os.path.join(BASE, 'comun', 'escudos_cuad', 'sv_efa.png'))
CUERO = b64(os.path.join(TEX, 'cuero.png'))
t = emblema.tono

ACENTO = '#E8A144'
CUE = (f'background-image:url({CUERO});background-size:150px;'
       'background-position:center;mix-blend-mode:soft-light;opacity:.30')
REM = 'box-shadow:inset 0 0 0 4px #E8A144,inset 0 0 0 6px rgba(0,0,0,.55)'


def degrade(c, arriba=.30, medio=.0, abajo=-.55):
    return (f'linear-gradient(166deg,{t(c, arriba)} 0%,{t(c, medio)} 44%,'
            f'{t(c, abajo)} 100%)')


CASOS = [
 ('1 · actual · #3A2412', '#3A2412', degrade('#3A2412')),
 ('2 · el coñac que elegiste · #4A2A0E', '#4A2A0E', degrade('#4A2A0E')),
 ('3 · promedio vivo del logo · #6B3D1F', '#6B3D1F', degrade('#6B3D1F')),
 ('4 · intermedio · #8A4420', '#8A4420', degrade('#8A4420')),
 ('5 · el del json · #A95225', '#A95225', degrade('#A95225')),
 ('6 · el del json, degradé más cerrado', '#A95225',
  degrade('#A95225', .16, -.18, -.72)),
]


def carta(i, etq, base, fondo):
    cid = f'k{i}'
    return f"""<div class="col"><div class="et">{etq}</div>
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})">
    <div class="fondo" style="background:{fondo}"></div>
    <div class="cap" style="{CUE}"></div>
    <div class="rem" style="{REM}"></div>
    <img class="ul" src="{UL}">
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{ACENTO}" stroke-width="9" opacity=".9"/>
      <path d="{SIL}" fill="none" stroke="{t(base,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  {emblema.pieza('EFA', base, ACENTO, ESC)}
</div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:32px;flex-wrap:wrap;align-items:flex-start}}
.col{{text-align:center;width:{W}px;margin-bottom:30px}}
.et{{color:#EDEDF5;font-size:12.5px;font-weight:800;letter-spacing:1.1px;
  margin-bottom:16px;min-height:30px}}
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
    cuerpo = ''.join(carta(i, *c) for i, c in enumerate(CASOS))
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">EFA · DEL MARRÓN AL COBRE DE SU LOGO '
           '<span>— el JSON del proyecto ya decía #A95225 «del logo · cobre» y '
           'la carta usaba #3A2412: 57.9 puntos de luz de diferencia</span></div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'efa_cobre.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1060, 'height': 1100},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'efa_cobre.png'), full_page=True)
        await b.close()
    print('-> efa_cobre.png')

asyncio.run(main())
