"""Cuanto lugar hay AFUERA de la carta para el marco, y quien ya lo ocupa.

El marco va por fuera de la silueta. Antes de dibujar ninguno hace falta
saber contra que se dibuja, porque hoy el lienzo esta lleno:

    la silueta va de x=0 a x=300 sobre un lienzo de 300
    o sea que NO SOBRA UN PIXEL a los costados

Un marco exterior obliga a agrandar el lienzo. Cuanto se agrande es una
decision de diseño, pero el numero hay que tenerlo antes y no despues.

Y arriba ya hay dos piezas afuera del recorte:

    el escudo      68 px de diametro, sobresale 24 px sobre la punta
    las estrellas  21 px, apoyadas encima de el, enteras afuera

Cualquier marco que suba por el tope se cruza con esas dos. Esta hoja las
dibuja en el mapa para que la decision se tome viendolas.

Se prueban tres anchos de banda para que el ancho se elija con la carta
delante y no de memoria.
"""
import asyncio
import base64
import json
import os
import re
import sys

from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun.siluetas import PICO
from comun import emblema
from los_nueve import defs

D9 = defs()
EST = json.load(open(os.path.join(BASE, 'datos', 'estrellas.json'),
                     encoding='utf-8'))['estrellas_por_servidor']


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


UL = b64(os.path.join(BASE, '02_Competitivo', 'ul_blanco.png'))
def esc(sv): return b64(os.path.join(BASE, 'comun', 'escudos_cuad', f'sv_{sv.lower()}.png'))
t = emblema.tono


def mover(d, dx, dy):
    return re.sub(r'(-?[\d.]+),(-?[\d.]+)',
                  lambda m: '%g,%g' % (float(m.group(1)) + dx,
                                       float(m.group(2)) + dy), d)


def hoja(banda, sv='SR'):
    """Una carta con `banda` px de lienzo libre alrededor."""
    W = PICO.w + banda * 2
    ALTO = PICO.h + emblema.MARGEN + banda
    sil = mover(PICO.d, banda, emblema.MARGEN)
    B, A, fondo, extra, remate, _ = D9[sv]
    cid = f'g{banda}'
    cap = f'<div class="cap" style="{extra}"></div>' if extra else ''
    rem = f'<div class="rem" style="{remate}"></div>' if remate else ''
    return f"""<div class="col">
<div class="et">banda de {banda} px · lienzo {W} × {ALTO}</div>
<div class="wrap" style="width:{W}px;height:{ALTO}px">
  <div class="libre"></div>
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{sil}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})">
    <div class="fondo" style="background:{fondo}"></div>{cap}{rem}
    <img class="ul" src="{UL}" style="left:{W/2}px">
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{sil}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
      <path d="{sil}" fill="none" stroke="{t(A,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  <div class="ocupa" style="left:{W/2 - 34}px;top:{emblema.CY - 34}px;
       width:68px;height:68px"></div>
  <div class="ocupa" style="left:{W/2 - 40}px;top:8px;width:80px;height:32px"></div>
  <div class="pz">{emblema.pieza(sv, A, B, esc(sv))}
    {emblema.estrellas(EST[sv], W, sufijo=f'b{banda}')}</div>
</div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:44px;flex-wrap:wrap;align-items:flex-start}}
.col{{text-align:center;margin-bottom:24px}}
.et{{color:#EDEDF5;font-size:12.5px;font-weight:800;letter-spacing:1.1px;
  margin-bottom:16px}}
.rot{{color:#EDEDF5;font-size:16px;font-weight:700;letter-spacing:1.4px;margin:6px 0 8px}}
.rot span{{color:#8A8AA0;font-weight:400;letter-spacing:0;font-size:13px}}
.aviso{{color:#FF9BB5;font-size:12.5px;margin:0 0 22px;max-width:980px;line-height:1.5}}
.wrap{{position:relative}}
/* la banda libre: es TODO el lienzo, y la carta se recorta encima */
.libre{{position:absolute;inset:0;background:
  repeating-linear-gradient(45deg,rgba(255,255,255,.07) 0 6px,transparent 6px 12px);
  outline:1px dashed rgba(255,255,255,.28)}}
.defs{{position:absolute}}
.cuerpo{{position:absolute;inset:0}}
.borde{{position:absolute;inset:0;pointer-events:none}}
.fondo{{position:absolute;inset:0}}
.cap{{position:absolute;inset:0;background-repeat:repeat}}
.rem{{position:absolute;inset:0}}
.ul{{position:absolute;top:{424 + emblema.MARGEN - 62}px;transform:translateX(-50%);
  z-index:6;height:20.7px;width:auto;opacity:.94}}
/* lo que YA esta ocupado afuera del recorte */
.ocupa{{position:absolute;z-index:12;border:1.5px dashed #FF6B8A;border-radius:6px;
  background:rgba(255,107,138,.10)}}
/* ancho COMPLETO: emblema.pieza se centra con left:50%, asi que si este
   contenedor midiera cero el desplazamiento se aplicaria dos veces. */
.pz{{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    cuerpo = ''.join(hoja(b) for b in (0, 14, 22, 30))
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">EL LIENZO PARA EL MARCO '
           '<span>— la trama rayada es el espacio libre; el punteado rosa es lo '
           'que ya está ocupado afuera del recorte</span></div>'
           '<div class="aviso">Con banda 0, que es lo que hay hoy, la silueta '
           'va de x=0 a x=300 sobre un lienzo de 300: no sobra un píxel a los '
           'costados. Un marco por fuera obliga a agrandar el lienzo.</div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'espacio_marco.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1560, 'height': 700},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2400)
        await pg.screenshot(path=os.path.join(SCR, 'espacio_marco.png'),
                            full_page=True)
        await b.close()

    print('LO QUE HAY HOY')
    print('  silueta        x 0..300 sobre un lienzo de 300  ->  0 px de margen')
    print('  alto           %d + %d de aire arriba = %d'
          % (PICO.h, emblema.MARGEN, PICO.h + emblema.MARGEN))
    print()
    print('YA OCUPADO AFUERA DEL RECORTE, arriba y al centro')
    print('  escudo         68 px, sobresale %d px sobre la punta'
          % (emblema.MARGEN - (emblema.CY - emblema.LADO / 2)))
    print('  estrellas      %d px, apoyadas encima, enteras afuera' % emblema.E)
    print('  ocupan         x %d..%d de 300'
          % (150 - emblema.LADO / 2, 150 + emblema.LADO / 2))
    print()
    print('CON BANDA, cuanto crece el lienzo')
    for b in (14, 22, 30):
        print('  %2d px  ->  %d x %d' % (b, PICO.w + 2 * b,
                                         PICO.h + emblema.MARGEN + b))
    print('\n-> espacio_marco.png')

asyncio.run(main())
