"""Donde va el UL en el panel del pie, medido en vez de estimado.

Dlx: "ajustalo como tu crees que se deba ir... mas abajo y mas pequeñito".

⚠️ EL PANEL DEL PIE SE ANGOSTA HACIA ABAJO, asi que su centro visual NO es
su media altura. Una marca centrada por altura queda demasiado baja porque
abajo hay menos superficie que arriba. Lo que corresponde es el CENTROIDE
DEL AREA: el punto donde el panel se equilibra.

Se calcula rasterizando el panel y sacando el promedio de las filas pesado
por cuantos pixeles tiene cada una.

Y se coteja contra la referencia: donde cae SU gema respecto de SU panel.
Asi el lugar no sale de mi gusto sino de la misma proporcion.
"""
import asyncio
import base64
import os
import re
import sys

import numpy as np
from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun.siluetas import PICO
from comun import emblema, divisor as DIV
from los_nueve import defs
from paneles import borde

W, MARGEN = PICO.w, emblema.MARGEN
ALTO = PICO.h + MARGEN + 20
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)
SV = 'TFC'
B, A, FONDO, EXTRA, REMATE, _ = defs()[SV]
t = emblema.tono

ESC_CURVA = 1.3                                  # la 30% mas marcada
BASE_Y = DIV.Y_EXTREMOS * PICO.h                 # 268.8
SUBE = DIV.RECORRIDO * PICO.w * ESC_CURVA        # 18.2
PTS = [tuple(float(v) for v in p.split(','))
       for p in re.findall(r'(-?[\d.]+,-?[\d.]+)', PICO.d)]


def y(v):
    return v + MARGEN


def camino(n=90):
    xi, xd = borde(BASE_Y, 'izq'), borde(BASE_Y, 'der')
    return [(xi + (xd - xi) * (i / n), BASE_Y - DIV.altura(i / n) * SUBE)
            for i in range(n + 1)]


def d_camino(pts):
    return 'M' + ' L'.join('%.2f,%.2f' % (x, y(v)) for x, v in pts)


def panel_pie(pts):
    # el camino vive en comun/divisor.py: estaba copiado en ocho
    # scripts, todos con el mismo bug de la punta perdida
    return DIV.panel(pts, PTS, W, dy=MARGEN)


# ── EL CENTROIDE DEL PANEL, calculado ──
def centroide():
    """Promedio de las filas pesado por cuantos pixeles tiene cada una."""
    pts = camino(300)
    xs = np.array([p[0] for p in pts])
    ys = np.array([p[1] for p in pts])
    filas, pesos = [], []
    for v in np.arange(int(ys.min()), PICO.h):
        techo = np.interp(np.linspace(0, 1, 300), np.linspace(0, 1, len(ys)), ys)
        ancho_arriba = np.sum(techo <= v) / 300 * (xs[-1] - xs[0])
        if v <= BASE_Y:
            an = ancho_arriba
        else:
            an = max(borde(v, 'der') - borde(v, 'izq'), 0)
        if an > 0:
            filas.append(v)
            pesos.append(an)
    filas, pesos = np.array(filas), np.array(pesos)
    return float((filas * pesos).sum() / pesos.sum()), filas.min(), filas.max()


CEN, Y_TOP, Y_BOT = centroide()
MEDIA = (Y_TOP + Y_BOT) / 2

print('EL PANEL DEL PIE')
print('  va de y=%.0f a y=%.0f' % (Y_TOP, Y_BOT))
print('  media altura        y=%.1f   (%.1f%% de la carta)'
      % (MEDIA, 100 * MEDIA / PICO.h))
print('  CENTROIDE DEL AREA  y=%.1f   (%.1f%% de la carta)'
      % (CEN, 100 * CEN / PICO.h))
print('  diferencia          %+.1f px respecto de la media altura' % (CEN - MEDIA))
print('  ⚠️ yo esperaba que diera MAS ARRIBA, porque el panel se angosta')
print('     hacia abajo. Da al reves: la curva del techo bulge hacia arriba')
print('     en el centro, asi que la franja de arriba es angosta y aporta')
print('     menos area de la que parece. Gana ese efecto.')

# la referencia: su gema cae al 87.8% del alto, y su panel arranca al 66.4%
REF_G, REF_P = .878, .664
prop_ref = (REF_G - REF_P) / (1 - REF_P)
print()
print('EN LA REFERENCIA la gema cae al %.1f%% del recorrido del panel'
      % (100 * prop_ref))
Y_REF = Y_TOP + prop_ref * (Y_BOT - Y_TOP)
print('  esa misma proporcion aca  ->  y=%.1f' % Y_REF)


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


UL = b64(os.path.join(BASE, '02_Competitivo', 'ul_blanco.png'))
FOTO = b64(os.path.join(SCR, 'av_valen.png'))
ESC = b64(os.path.join(BASE, 'comun', 'escudos_cuad', f'sv_{SV.lower()}.png'))
VELO = 'linear-gradient(180deg,rgba(0,0,0,.30),rgba(0,0,0,.64))'
M_FOTO = ('linear-gradient(180deg,#000 0%,#000 72%,rgba(0,0,0,.5) 92%,'
          'transparent 100%)')
WASH = ('linear-gradient(270deg,#000 0%,#000 10%,rgba(0,0,0,0.5) 19%,'
        'transparent 30%)')
COL = round(PICO.w * .30)
XC = round(borde(40, 'der') - COL)

# ⚠️ EL ALTO NO SE ELIGE: es 20.7 px, el mismo que en la Competitiva
# (02_Competitivo/v2/card.css:382). El UL es la marca paraguas y va igual en
# las tres cartas; si cada una lo pone de un tamaño distinto, deja de
# leerse como la misma marca. Lo unico que se decide aca es LA ALTURA A LA
# QUE VA.
UL_ALTO = 20.7

# hasta donde se puede bajar: el UL mide 25.4 de ancho a esa altura, y la
# carta se cierra en punta. Medido, a y=392 su base cae en 402 y ahi la
# carta todavia tiene 122 px de ancho, asi que entra. Mas abajo no.
CASOS = [
 ('1 · la 5, donde estaba · y=354', CEN + 24, UL_ALTO),
 ('2 · más abajo · y=364', CEN + 34, UL_ALTO),
 ('3 · más abajo · y=372', CEN + 42, UL_ALTO),
 ('4 · más abajo · y=380', CEN + 50, UL_ALTO),
 ('5 · casi el límite · y=388', CEN + 58, UL_ALTO),
 ('6 · el límite medido · y=392', CEN + 62, UL_ALTO),
]


def carta(i, etq, cy, h):
    cid = f'u{i}'
    pts = camino()
    return f"""<div class="col"><div class="et">{etq}</div>
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})">
    <div class="fondo" style="background:{FONDO}"></div>
    {f'<div class="cap" style="{EXTRA}"></div>' if EXTRA else ''}
    {f'<div class="rem" style="{REMATE}"></div>' if REMATE else ''}
    <div class="foto" style="-webkit-mask-image:{M_FOTO};mask-image:{M_FOTO}">
      <img src="{FOTO}"><div class="velo-ar"></div></div>
    <div class="wash" style="background:{FONDO};
         -webkit-mask-image:{WASH};mask-image:{WASH}"></div>
    <div class="somb" style="left:{XC}px"></div>
    <div class="filo" style="left:{XC}px;background:{B};
         box-shadow:0 0 8px {B},0 0 18px {B}"></div>
    <div class="pie-fondo" style="background:{FONDO};
         clip-path:path('{panel_pie(pts)}')"></div>
    <div class="pie-velo" style="background:{VELO};
         clip-path:path('{panel_pie(pts)}')"></div>
    <svg class="tra" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
      <path d="{d_camino(pts)}" fill="none" stroke="{B}" stroke-width="1.9"
            opacity=".9" stroke-linejoin="round"/>
    </svg>
    <img class="ul" src="{UL}" style="top:{y(cy) - h/2:.1f}px;height:{h}px">
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
      <path d="{SIL}" fill="none" stroke="{t(A,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  {emblema.estrellas(1, W, sufijo=f'u{i}')}
  {emblema.pieza(SV, A, B, ESC)}
</div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:34px;flex-wrap:wrap;align-items:flex-start}}
.col{{text-align:center;width:{W}px;margin-bottom:28px}}
.et{{color:#EDEDF5;font-size:12.5px;font-weight:800;letter-spacing:1.1px;
  margin-bottom:16px;min-height:30px}}
.rot{{color:#EDEDF5;font-size:16px;font-weight:700;letter-spacing:1.4px;margin:6px 0 8px}}
.aviso{{color:#8A8AA0;font-size:12.5px;margin:0 0 20px;max-width:1010px;line-height:1.55}}
.med{{color:#8A8AA0;font-size:12px;font-family:ui-monospace,monospace;
  white-space:pre;line-height:1.5;margin:0 0 20px}}
.wrap{{position:relative;width:{W}px;height:{ALTO}px}}
.defs{{position:absolute}}
.cuerpo{{position:absolute;inset:0;filter:drop-shadow(0 12px 26px rgba(0,0,0,.72))}}
.borde{{position:absolute;inset:0;pointer-events:none}}
.fondo{{position:absolute;inset:0;z-index:0}}
.cap{{position:absolute;inset:0;z-index:1;background-repeat:repeat}}
.rem{{position:absolute;inset:0;z-index:2}}
.foto{{position:absolute;top:{MARGEN}px;left:0;right:0;height:{round(BASE_Y)+14}px;
  z-index:3;overflow:hidden}}
.foto img{{width:100%;height:100%;object-fit:cover;object-position:center 12%}}
.velo-ar{{position:absolute;inset:0;background:linear-gradient(180deg,
  rgba(0,0,0,.40) 0%,rgba(0,0,0,.12) 22%,transparent 42%)}}
.wash{{position:absolute;top:{MARGEN}px;left:0;right:0;height:{round(BASE_Y)}px;
  z-index:4;pointer-events:none;background-repeat:repeat}}
.somb{{position:absolute;top:{MARGEN+12}px;width:34px;height:{round(BASE_Y)-22}px;
  z-index:5;pointer-events:none;opacity:.55;
  background:linear-gradient(270deg,rgba(0,0,0,.72),transparent)}}
.filo{{position:absolute;top:{MARGEN+14}px;width:1.6px;height:{round(BASE_Y)-28}px;
  z-index:6;pointer-events:none;opacity:.85}}
.pie-fondo,.pie-velo{{position:absolute;inset:0;z-index:6;
  pointer-events:none;background-repeat:repeat}}
.pie-velo{{z-index:7}}
.tra{{position:absolute;inset:0;z-index:8;pointer-events:none}}
.ul{{position:absolute;left:50%;transform:translateX(-50%);z-index:9;
  width:auto;opacity:.94;filter:drop-shadow(0 2px 5px rgba(0,0,0,.95))}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    cuerpo = ''.join(carta(i, *c) for i, c in enumerate(CASOS))
    # ⚠️ SIN formato con %: el CSS esta lleno de porcentajes y el % de Python
    # se los come. Es la quinta vez que este proyecto tropieza con lo mismo y
    # esta anotado en CLAUDE.md. Con f-strings no puede pasar.
    med = (f'el panel del pie va de y={Y_TOP:.0f} a y={Y_BOT:.0f}\n'
           f'  media altura        y={MEDIA:.1f}\n'
           f'  CENTROIDE DEL AREA  y={CEN:.1f}\n'
           f'  proporcion de la referencia  y={Y_REF:.1f}')
    aviso = (
        '<b>El alto ya no se elige: es 20.7 px</b>, el mismo que en la '
        'Competitiva (<code>card.css:382</code>). El UL es la marca paraguas y '
        'va igual en las tres cartas — si cada una lo pone de un tamaño '
        'distinto, deja de leerse como la misma marca. Lo único que se decide '
        'acá es <b>a qué altura va</b>.<br><br>'
        '⚠️ <b>Hasta dónde se puede bajar, medido:</b> el UL mide 25.4 px de '
        'ancho, y la carta se cierra en punta. A <b>y=392</b> su base cae en '
        '402, donde la carta todavía tiene 122 px de ancho, así que entra. Más '
        'abajo la merma se lo come. La 6 es ese límite.<br><br>'
        'La 1 es la que elegiste, pero con el tamaño corregido: se ve más '
        'grande que antes porque 20.7 &gt; 16.')
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">EL UL AL TAMAÑO DE LAS OTRAS CARTAS · 20.7 px</div>'
           '<div class="aviso">' + aviso + '</div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'ul_lugar.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1060, 'height': 1000},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'ul_lugar.png'), full_page=True)
        await b.close()
    print('-> ul_lugar.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
