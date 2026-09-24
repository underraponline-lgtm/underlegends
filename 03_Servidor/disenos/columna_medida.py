"""La columna derecha, medida de FINAL REFERENCIA.

MEDIDO con gradiente horizontal promediado por columna:

    la vertical interna     x = 39.0% del ancho   fuerza 16.1
                            el siguiente candidato tiene 3.4, o sea que
                            esta es unica y real, no ruido
    va de                   y = 44.0%  a  y = 62.4% del alto
    el panel interior       de 15.7% a 83.4%  =  67.7% del ancho

⚠️ LA VERTICAL NO CRUZA EL PANEL DE ARRIBA ABAJO. Solo mide 18.4% de la
altura y TERMINA EN EL DIVISOR: su final, 62.4%, coincide con la cima de la
curva, 62.2%. Yo la venia dibujando entera, del tope al pie.

Eso cambia lo que la linea SIGNIFICA. Una linea entera parte la carta en dos
columnas. Una linea corta que nace a media altura y muere en la curva no
divide nada: SEPARA SOLO DONDE HAY QUE SEPARAR, o sea abajo, donde la
columna tiene contenido y la foto sigue. Arriba no hace falta porque ahi
manda el numero.

Respecto del panel, la vertical cae al 34.4% de su ancho. Espejada a la
derecha, eso deja la columna a 34.4% del panel desde el borde derecho.
"""
import asyncio
import base64
import os
import re
import sys

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

ESC_CURVA = 1.3
BASE_Y = DIV.Y_EXTREMOS * PICO.h
SUBE = DIV.RECORRIDO * PICO.w * ESC_CURVA
PTS = [tuple(float(v) for v in p.split(','))
       for p in re.findall(r'(-?[\d.]+,-?[\d.]+)', PICO.d)]

# ── lo medido, llevado a nuestra carta ──
COL_FRAC = 0.344                  # del ancho del panel, desde el borde
VERT_DESDE = 0.440 * PICO.h       # 178
UL_Y, UL_H = 372, 20.7


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


def x_columna(yv):
    """El x de la vertical a la altura yv, siguiendo el borde de la carta."""
    return borde(yv, 'der') - COL_FRAC * (borde(yv, 'der') - borde(yv, 'izq'))


def y_divisor(xv):
    """A que altura cae el divisor en ese x, para que la vertical muera ahi."""
    xi, xd = borde(BASE_Y, 'izq'), borde(BASE_Y, 'der')
    u = (xv - xi) / (xd - xi)
    return BASE_Y - DIV.altura(u) * SUBE


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

# (etiqueta, desde donde arranca la vertical, neon, sombra)
CASOS = [
 ('1 · LA MEDIDA · vertical corta, de 44% al divisor', VERT_DESDE, .85, .55),
 ('2 · la misma, sin sombra', VERT_DESDE, .85, 0),
 ('3 · la misma, sin neón', VERT_DESDE, 0, .55),
 ('4 · arranca más arriba · desde 30%', .30 * PICO.h, .85, .55),
 ('5 · entera · lo que yo venía haciendo', 34, .85, .55),
 ('6 · sin vertical · solo el wash', None, 0, .55),
]


def carta(i, etq, desde, neon, sombra):
    cid = f'q{i}'
    pts = camino()
    xv = x_columna(BASE_Y)
    vert = ''
    if desde is not None:
        y_fin = y_divisor(xv)
        vert = (f'<line x1="{xv:.1f}" y1="{y(desde):.1f}" x2="{xv:.1f}" '
                f'y2="{y(y_fin):.1f}" stroke="{B}" stroke-width="1.7" '
                f'opacity="{max(neon, .55)}"'
                + (f' filter="url(#gl{i})"' if neon else '') + '/>')
    somb = ''
    if sombra:
        somb = (f'<div class="somb" style="left:{xv - 34:.0f}px;'
                f'opacity:{sombra}"></div>')
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
    {somb}
    <div class="pie-fondo" style="background:{FONDO};
         clip-path:path('{panel_pie(pts)}')"></div>
    <div class="pie-velo" style="background:{VELO};
         clip-path:path('{panel_pie(pts)}')"></div>
    <svg class="tra" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
      <defs><filter id="gl{i}" x="-300%" y="-50%" width="700%" height="200%">
        <feGaussianBlur stdDeviation="2.6" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="b"/>
        <feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <path d="{d_camino(pts)}" fill="none" stroke="{B}" stroke-width="1.9"
            opacity=".9" stroke-linejoin="round"/>{vert}
    </svg>
    <img class="ul" src="{UL}" style="top:{y(UL_Y) - UL_H/2:.1f}px;
         height:{UL_H}px">
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
      <path d="{SIL}" fill="none" stroke="{t(A,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  {emblema.estrellas(1, W, sufijo=f'q{i}')}
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
.somb{{position:absolute;top:{MARGEN+round(VERT_DESDE)}px;width:34px;
  height:{round(BASE_Y-VERT_DESDE)}px;z-index:5;pointer-events:none;
  background:linear-gradient(270deg,rgba(0,0,0,.72),transparent)}}
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
    med = ('la vertical interna   x = 39.0% del ancho   fuerza 16.1\n'
           '                      el siguiente candidato tiene 3.4\n'
           'va de                 y = 44.0%  a  62.4% del alto\n'
           'el panel interior     de 15.7% a 83.4%  =  67.7% del ancho\n'
           'la vertical, respecto del panel   34.4% de su ancho')
    aviso = (
        '⚠️ <b>La vertical no cruza el panel de arriba abajo.</b> Mide solo '
        '18.4% de la altura y <b>termina en el divisor</b>: su final, 62.4%, '
        'coincide con la cima de la curva, 62.2%. Yo la venía dibujando entera. '
        'La 5 es como la tenía, para comparar.<br><br>'
        'Y eso cambia lo que la línea <b>significa</b>. Una línea entera parte la '
        'carta en dos columnas. Una línea corta que nace a media altura y muere '
        'en la curva no divide nada: <b>separa solo donde hay que separar</b> — '
        'abajo, donde la columna tiene contenido y la foto sigue. Arriba no hace '
        'falta porque ahí manda el número.')
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">LA COLUMNA DERECHA, MEDIDA</div>'
           '<div class="med">' + med + '</div>'
           '<div class="aviso">' + aviso + '</div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'columna_medida.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1060, 'height': 1000},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'columna_medida.png'),
                            full_page=True)
        await b.close()
    print('-> columna_medida.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
