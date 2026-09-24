"""DRA · otra tanda, cambiando ESTRUCTURA y no solo textura.

La tanda anterior era el mismo degrade con nueve texturas encima. Salio
pareja porque era una receta con variantes, que es justo el error que ya
costo una vuelta entera con los nueve fondos.

QUE ESTA TOMADO POR LAS OTRAS OCHO, para no pisarlas:

    bandas horizontales      TFC
    corte diagonal           SR, FRZ, URBF
    franjas al sesgo         TWR
    banda diagonal ancha     FTN
    fantasma del logo        TWR
    halftone / puntos        FFA
    textura de material      EFA (cuero), y DRA venia de ahi

QUE QUEDA LIBRE, y de ahi sale esta tanda:

    vertical · radial · chevron · malla · corte horizontal

Las tres lineas al pie no se tocan: son lo aprobado de DRA y funcionan como
el puño de una manga.

⚠️ La medida de MANCHA se informa igual, pero OJO: capta variacion de escala
grande y no distingue un gesto buscado de una suciedad. Una carta con
franjas anchas mide alto y esta limpia. Sirve para comparar texturas entre
si; para comparar estructuras, no.
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
from dra_limpio import medir

W, MARGEN = PICO.w, emblema.MARGEN
ALTO = PICO.h + MARGEN
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


UL = b64(os.path.join(BASE, '02_Competitivo', 'ul_blanco.png'))
ESC = b64(os.path.join(BASE, 'comun', 'escudos_cuad', 'sv_dra.png'))
def tx(n): return b64(os.path.join(TEX, n + '.png'))
t = emblema.tono

A, B = '#3D5BFF', '#FFFFFF'
G = f'linear-gradient(166deg,{t(A,.40)} 0%,{A} 42%,{t(A,-.70)} 100%)'
LINEAS = ('background:linear-gradient(180deg,transparent 0 70%,'
          'rgba(255,255,255,.90) 70% 71.4%,transparent 71.4% 73%,'
          'rgba(255,255,255,.90) 73% 74.4%,transparent 74.4% 76%,'
          'rgba(255,255,255,.90) 76% 77.4%,transparent 77.4%)')
FIBRA = (f'background-image:url({tx("fibra")});background-size:190px;'
         'background-repeat:repeat;mix-blend-mode:soft-light;opacity:.26')

CASOS = [
 ('1 · actual · óxido', G,
  f'background-image:url({tx("oxido")});background-size:cover;'
  'mix-blend-mode:overlay;opacity:.38'),

 ('2 · columnas anchas',
  f'repeating-linear-gradient(90deg,{t(A,.12)} 0 36px,{t(A,-.22)} 36px 72px),' + G, ''),

 ('3 · columnas finas de camiseta',
  f'repeating-linear-gradient(90deg,{t(A,.08)} 0 13px,{t(A,-.16)} 13px 26px),' + G,
  FIBRA),

 ('4 · chevrón · la corona del logo',
  'linear-gradient(150deg,transparent 0 46%,rgba(255,255,255,.16) 46% 52%,transparent 52%),'
  'linear-gradient(210deg,transparent 0 46%,rgba(255,255,255,.16) 46% 52%,transparent 52%),'
  + G, ''),

 ('5 · rayos desde la punta',
  'repeating-conic-gradient(from 180deg at 50% -6%,'
  f'{t(A,.14)} 0 5deg,transparent 5deg 11deg),' + G, ''),

 ('6 · malla fina',
  'repeating-linear-gradient(90deg,rgba(255,255,255,.10) 0 1px,transparent 1px 15px),'
  'repeating-linear-gradient(0deg,rgba(255,255,255,.10) 0 1px,transparent 1px 15px),'
  + G, ''),

 ('7 · corte horizontal · dos azules',
  f'linear-gradient(180deg,{t(A,.30)} 0 43%,{t(A,-.02)} 43% 44.6%,'
  f'{t(A,-.52)} 44.6% 100%)', FIBRA),

 ('8 · foco desde el emblema',
  f'radial-gradient(ellipse 78% 44% at 50% 0%,{t(A,.52)},transparent 62%),' + G, FIBRA),

 ('9 · columnas anchas + foco',
  f'radial-gradient(ellipse 86% 40% at 50% 0%,rgba(255,255,255,.22),transparent 60%),'
  f'repeating-linear-gradient(90deg,{t(A,.12)} 0 36px,{t(A,-.22)} 36px 72px),' + G, ''),
]


def carta(i, etq, fondo, capa, med=None):
    cid = f'q{i}'
    c = f'<div class="cap" style="{capa}"></div>' if capa else ''
    nota = (f'<div class="nu">mancha <b>{med[1]:.2f}</b> · grano {med[0]:.2f}</div>'
            if med else '')
    return f"""<div class="col"><div class="et">{etq}</div>{nota}
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})" id="m{i}">
    <div class="fondo" style="background:{fondo}"></div>{c}
    <div class="rem" style="{LINEAS}"></div>
    <img class="ul" src="{UL}">
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
      <path d="{SIL}" fill="none" stroke="{t(A,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  {emblema.estrellas(1, W, sufijo=f'q{i}')}
  {emblema.pieza('DRA', A, B, ESC)}
</div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:32px;flex-wrap:wrap;align-items:flex-start}}
.col{{text-align:center;width:{W}px;margin-bottom:30px}}
.et{{color:#EDEDF5;font-size:12.5px;font-weight:800;letter-spacing:1.1px;min-height:30px}}
.nu{{color:#8A8AA0;font-size:11px;margin:3px 0 14px}}
.rot{{color:#EDEDF5;font-size:16px;font-weight:700;letter-spacing:1.4px;margin:6px 0 8px}}
.rot span{{color:#8A8AA0;font-weight:400;letter-spacing:0;font-size:13px}}
.aviso{{color:#8A8AA0;font-size:12.5px;margin:0 0 22px;max-width:1000px;line-height:1.55}}
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

    def pagina(med=None):
        cuerpo = ''.join(carta(i, *c, med[i] if med else None)
                         for i, c in enumerate(CASOS))
        return ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
                + fuentes + CSS + '</style></head><body>'
                '<div class="rot">DRA · OTRA TANDA, POR ESTRUCTURA '
                '<span>— la anterior era el mismo degradé con nueve texturas '
                'encima</span></div>'
                '<div class="aviso">Lo que ya está tomado por las otras ocho: '
                'bandas horizontales (TFC), corte diagonal (SR, FRZ, URBF), franjas '
                'al sesgo (TWR), banda diagonal (FTN), fantasma del logo (TWR), '
                'halftone (FFA), textura de material (EFA). Queda libre lo '
                '<b>vertical</b>, lo <b>radial</b>, el <b>chevrón</b>, la '
                '<b>malla</b> y el <b>corte horizontal</b>: de ahí salen estas.'
                '<br><br>La medida de mancha va igual, pero <b>no compara '
                'estructuras</b>: capta variación de escala grande y no distingue '
                'un gesto buscado de una suciedad. Una carta con franjas anchas '
                'mide alto y está limpia.</div>'
                '<div class="fila">' + cuerpo + '</div></body></html>')

    out = os.path.join(SCR, 'dra_estructura.html')
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1060, 'height': 1200},
                              device_scale_factor=2)
        open(out, 'w', encoding='utf-8').write(pagina())
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        med = {}
        for i in range(len(CASOS)):
            el = await pg.query_selector(f'#m{i}')
            med[i] = medir(Image.open(io.BytesIO(await el.screenshot())))
            print('%-38s mancha %5.2f   grano %5.2f'
                  % (CASOS[i][0], med[i][1], med[i][0]))
        open(out, 'w', encoding='utf-8').write(pagina(med))
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'dra_estructura.png'),
                            full_page=True)
        await b.close()
    print('\n-> dra_estructura.png')

asyncio.run(main())
