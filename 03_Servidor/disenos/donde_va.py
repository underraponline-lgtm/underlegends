"""DONDE VA LA PIEZA del logo: abajo como FIFA, o arriba en el pico.

La carta va VACIA a proposito. Con el avatar, el numero y las stats puestos,
la pieza se juzga contra ellos y no contra la forma. Primero se decide donde
vive; el contenido despues se acomoda alrededor.

La silueta es la medida de ref1 (300x405), de comun/siluetas.py.

Las estrellas van del lado de ADENTRO de la pieza, que es el unico lugar
donde entran: si la pieza esta arriba y las estrellas van encima, quedan
flotando fuera del recorte, sin carta atras que las sostenga.
"""
import asyncio
import base64
import os
import sys

from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
from comun.siluetas import PICO

W, H = PICO.w, PICO.h
D = PICO.d


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


ESC = b64(os.path.join(BASE, 'comun', 'escudos_cuad', 'sv_tfc.png'))

A, AC = '#600816', '#F2E9E9'
FONDO = f'repeating-linear-gradient(180deg,{A} 0 30px,#3F050E 30px 60px)'

HEX = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
ROMBO = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)'
ESTRELLA = ('M12 2 L14.9 8.9 L22.4 9.5 L16.7 14.4 L18.4 21.7 L12 17.8 '
            'L5.6 21.7 L7.3 14.4 L1.6 9.5 L9.1 8.9 Z')

# (etiqueta, forma, cy, lado, y de las estrellas, lado estrella)
#   cy es el centro de la pieza en el sistema de la carta:
#   0 = la punta de arriba, 405 = la punta de abajo
CASOS = [
 ('1 · hexágono abajo · como FIFA', HEX,   405, 62, 352, 15),
 ('2 · círculo abajo',              None,  405, 62, 352, 15),
 ('3 · hexágono abajo · adentro',   HEX,   372, 58, 320, 15),
 ('4 · rombo abajo',                ROMBO, 405, 66, 348, 15),

 ('5 · hexágono arriba · en el pico', HEX,   0,  62, 46, 15),
 ('6 · círculo arriba · en el pico',  None,  0,  62, 46, 15),
 ('7 · círculo arriba · adentro',     None, 40,  62, 88, 15),
 ('8 · círculo arriba · sobresale más', None, -12, 70, 44, 15),
]


def estrellas(n, y, lado):
    paso = lado + 3
    x0 = W / 2 - (n * paso - 3) / 2
    return ''.join(
        f'<svg class="est" viewBox="0 0 24 24" width="{lado}" height="{lado}" '
        f'style="left:{x0 + i*paso:.1f}px;top:{y}px"><path d="{ESTRELLA}"/></svg>'
        for i in range(n))


def carta(i, etq, forma, cy, lado, y_est, lado_est):
    cid = f'w{i}'
    recorte = f'clip-path:{forma};border-radius:0' if forma else 'border-radius:50%'
    # el aro va como pseudo-elemento solo si es circulo; en las formas
    # recortadas un box-shadow se recorta junto con la forma y no se ve
    aro = ('box-shadow:0 4px 14px rgba(0,0,0,.9),0 0 0 3px ' + AC) if not forma else ''
    marco = ('' if not forma else
             f'<div class="pieza-marco" style="{recorte};top:{cy - lado/2 - 3}px;'
             f'width:{lado + 6}px;height:{lado + 6}px;background:{AC}"></div>')
    return f"""<div class="col"><div class="et">{etq}</div>
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{D}"/></clipPath>
  </defs></svg>

  <div class="cuerpo" style="clip-path:url(#{cid})">
    <div class="fondo"></div>
  </div>

  <svg class="borde" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
    <g clip-path="url(#{cid})">
      <path d="{D}" fill="none" stroke="{AC}" stroke-width="9" opacity=".9"/>
      <path d="{D}" fill="none" stroke="#2A0308" stroke-width="3"/>
    </g>
  </svg>

  {estrellas(1, y_est, lado_est)}
  {marco}
  <div class="pieza" style="{recorte};{aro};top:{cy - lado/2}px;
       width:{lado}px;height:{lado}px"><img src="{ESC}"></div>
</div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:40px;flex-wrap:wrap}}
.col{{text-align:center;width:{W}px;margin-bottom:34px}}
/* 58px de aire: la pieza mas saliente (la 8) sube 47px sobre el borde */
.et{{color:#EDEDF5;font-size:12.5px;font-weight:800;letter-spacing:1.2px;
  margin-bottom:58px;min-height:16px}}
.rot{{color:#EDEDF5;font-size:16px;font-weight:700;letter-spacing:1.4px;margin:6px 0 22px}}
.rot span{{color:#8A8AA0;font-weight:400;letter-spacing:0}}
.wrap{{position:relative;width:{W}px;height:{H}px}}
.defs{{position:absolute}}
.cuerpo{{position:absolute;inset:0;filter:drop-shadow(0 12px 26px rgba(0,0,0,.7))}}
.borde{{position:absolute;inset:0;pointer-events:none}}
.fondo{{position:absolute;inset:0;background:{FONDO}}}
.est{{position:absolute;left:0;z-index:9;fill:{AC};
  filter:drop-shadow(0 1px 3px rgba(0,0,0,.95))}}
.pieza-marco{{position:absolute;left:50%;transform:translateX(-50%);z-index:9;
  filter:drop-shadow(0 4px 12px rgba(0,0,0,.9))}}
.pieza{{position:absolute;left:50%;transform:translateX(-50%);z-index:10;
  overflow:hidden;background:#12060A}}
.pieza img{{width:100%;height:100%;display:block;object-fit:cover}}
"""


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    cuerpo = ''.join(carta(i, *c) for i, c in enumerate(CASOS))
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">DÓNDE VA LA PIEZA <span>— la carta va vacía a '
           'propósito: primero se decide dónde vive, el contenido se acomoda '
           'después</span></div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'donde_va.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1420, 'height': 1080},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2200)
        await pg.screenshot(path=os.path.join(SCR, 'donde_va.png'), full_page=True)
        await b.close()
    print('-> donde_va.png')

asyncio.run(main())
