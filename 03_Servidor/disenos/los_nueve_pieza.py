"""LA PIEZA TOCANDO EL BORDE, en los nueve servidores.

Los fondos NO se copian: se importan de los_nueve.py, que es la definicion
canonica. Las estrellas salen de datos/estrellas.json.

LO QUE LA GEOMETRIA NO DEJA HACER
---------------------------------
Que la pieza toque el borde de arriba Y que las estrellas vayan encima de
ella DENTRO de la carta son incompatibles. No es una opinion:

El pico es achatado, 41.6 px planos entre x=129.2 y x=170.8, y de ahi cae a
los hombros. El ancho de la carta a la altura y vale  41.6 + 8.28*y.

Una pieza de 68 px que toca el borde tiene su tapa en y=5 (el filo interno
del trazo). Arriba de eso quedan 5 px de carta. Una estrella grande mide 22.
No entra, y no hay como acomodarla: el unico lugar por encima de la pieza es
fuera del recorte.

Asi que las salidas son tres, y las tres estan dibujadas:

  A · la pieza toca el borde y las estrellas van DEBAJO      (los nueve)
  B · la pieza toca el borde y las estrellas FLOTAN afuera   (TFC, control)
  C · el pico crece una cresta que las sostiene              (TFC, control)

La B tiene un problema que no se ve en esta hoja: la carta se exporta a PNG
con fondo transparente para Discord. Ahi las estrellas quedan como pixeles
sueltos arriba de la carta, sin nada que las una. Sobre este fondo oscuro
parecen bien; sobre transparencia, no.

La C cambia la silueta trazada: le agrega 26 px de cresta y la carta pasa a
300x431. Es la unica de las tres que toca el contorno medido de ref1.
"""
import asyncio
import base64
import json
import os
import sys

from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun.siluetas import PICO
from los_nueve import defs, ORDEN

W, H = PICO.w, PICO.h
D = PICO.d

# C: la misma silueta corrida 26 px con una cresta encima que sostiene
# las estrellas. Ancho de la cresta 76 px, esquinas matadas.
HC = H + 26
D_CRESTA = ('M118,0 L182,0 L188,7 L188,26 L170.8,26 L296.7,56.4 L300,382.5 '
            'L292,391.4 L281.5,395.4 L150,431 L18.5,395.4 L8,391.4 L0,382.5 '
            'L3.3,56.4 L129.2,26 L112,26 L112,7 Z')

D9 = defs()
EST = json.load(open(os.path.join(BASE, 'datos', 'estrellas.json'),
                     encoding='utf-8'))['estrellas_por_servidor']


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


def esc(sv): return b64(os.path.join(BASE, 'comun', 'escudos_cuad',
                                     f'sv_{sv.lower()}.png'))


def t(c, f):
    h = c.lstrip('#'); r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    if f >= 0: r, g, b = (int(x + (255-x)*f) for x in (r, g, b))
    else:      r, g, b = (int(x*(1+f)) for x in (r, g, b))
    return '#%02X%02X%02X' % (r, g, b)


ESTRELLA = ('M12 2 L14.9 8.9 L22.4 9.5 L16.7 14.4 L18.4 21.7 L12 17.8 '
            'L5.6 21.7 L7.3 14.4 L1.6 9.5 L9.1 8.9 Z')

LADO = 68                 # la pieza
TAPA = 5                  # filo interno del trazo: donde apoya
CY = TAPA + LADO / 2      # centro de la pieza -> 39
E = 22                    # estrella grande


def estrellas(n, y, color, lado=E):
    if not n:
        return ''
    paso = lado + 4
    x0 = W / 2 - (n * paso - 4) / 2
    return ''.join(
        f'<svg class="est" viewBox="0 0 24 24" width="{lado}" height="{lado}" '
        f'style="left:{x0 + i*paso:.1f}px;top:{y}px;fill:{color}">'
        f'<path d="{ESTRELLA}"/></svg>' for i in range(n))


def carta(i, sv, modo='A'):
    B, A, fondo, extra, remate, _ = D9[sv]
    n = EST[sv]
    cid = f'n{i}'
    d, alto, cy = D, H, CY
    if modo == 'C':
        d, alto, cy = D_CRESTA, HC, CY + 26

    if modo == 'A':                       # estrellas debajo de la pieza
        ey, et = cy + LADO / 2 + 9, 'A · estrellas debajo'
    elif modo == 'B':                     # flotando arriba, fuera del recorte
        ey, et = cy - LADO / 2 - E - 6, 'B · estrellas flotando afuera'
    else:                                 # en la cresta
        ey, et = 2, 'C · el pico crece una cresta'

    cap = f'<div class="cap" style="{extra}"></div>' if extra else ''
    rem = f'<div class="rem" style="{remate}"></div>' if remate else ''
    etq = sv if modo == 'A' else f'{sv} · {et}'
    return f"""<div class="col"><div class="et">{etq}</div>
<div class="wrap" style="height:{alto}px">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{d}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})">
    <div class="fondo" style="background:{fondo}"></div>{cap}{rem}
  </div>
  <svg class="borde" viewBox="0 0 {W} {alto}" width="{W}" height="{alto}">
    <g clip-path="url(#{cid})">
      <path d="{d}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
      <path d="{d}" fill="none" stroke="{t(A,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  {estrellas(n, ey, B)}
  <div class="pieza" style="top:{cy - LADO/2}px;width:{LADO}px;height:{LADO}px;
       box-shadow:0 4px 14px rgba(0,0,0,.9),0 0 0 3px {B};
       background:{t(A,-.62)}"><img src="{esc(sv)}"></div>
</div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:40px;flex-wrap:wrap;align-items:flex-start}}
.col{{text-align:center;width:{W}px;margin-bottom:38px}}
.et{{color:#EDEDF5;font-size:13px;font-weight:800;letter-spacing:1.4px;
  margin-bottom:44px;min-height:16px}}
.rot{{color:#EDEDF5;font-size:16px;font-weight:700;letter-spacing:1.4px;margin:6px 0 22px}}
.rot span{{color:#8A8AA0;font-weight:400;letter-spacing:0}}
.wrap{{position:relative;width:{W}px}}
.defs{{position:absolute}}
.cuerpo{{position:absolute;inset:0;filter:drop-shadow(0 12px 26px rgba(0,0,0,.7))}}
.borde{{position:absolute;inset:0;pointer-events:none}}
.fondo{{position:absolute;inset:0}}
.cap{{position:absolute;inset:0;background-repeat:no-repeat}}
.rem{{position:absolute;inset:0}}
.est{{position:absolute;z-index:11;filter:drop-shadow(0 1px 3px rgba(0,0,0,.95))}}
.pieza{{position:absolute;left:50%;transform:translateX(-50%);z-index:10;
  border-radius:50%;overflow:hidden}}
.pieza img{{width:100%;height:100%;display:block;object-fit:cover}}
"""


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    cuerpo = ''.join(carta(i, sv) for i, sv in enumerate(ORDEN))
    ctrl = carta(90, 'TFC', 'B') + carta(91, 'TFC', 'C')
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">LA PIEZA TOCANDO EL BORDE <span>— los nueve con las '
           'estrellas debajo, que es lo único que entra. Las dos últimas son las '
           'salidas para ponerlas arriba</span></div>'
           '<div class="fila">' + cuerpo + ctrl + '</div></body></html>')
    out = os.path.join(SCR, 'los_nueve_pieza.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1420, 'height': 1200},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'los_nueve_pieza.png'),
                            full_page=True)
        await b.close()
    print('-> los_nueve_pieza.png')

asyncio.run(main())
