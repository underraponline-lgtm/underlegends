"""LA LINEA DE ABAJO, bien medida. Dos errores mios corregidos.

Dlx: "estos 2 no se parecen a nada... tomate tu tiempo para trazar LA LINEA
DE ABAJO". La lectura cruda, sin promediar ni suavizar, en cinco columnas de
FINAL REFERENCIA:

    x=22%  ->  y=66.0%
    x=32%  ->  y=64.0%
    x=50%  ->  y=62.0%   <- el pico
    x=68%  ->  y=64.0%
    x=78%  ->  y=66.0%

Tres metodos distintos dieron lo mismo, asi que la MEDICION estaba bien. Lo
que estaba mal era como la usaba, en dos cosas:

⚠️ 1. LA SEGUNDA LINEA NO EXISTE. Cuando busque "filas brillantes a lo
ancho" me salieron dos, a 62.4% y 66.4%, y las tome por un divisor doble.
SON LA MISMA LINEA: 62% en el centro y 66% en los bordes. Una linea curva
deja huella en dos filas distintas, y un detector que mira fila por fila la
cuenta dos veces. Invente una segunda linea a partir de mi propio metodo.

⚠️ 2. LA CURVA SE ESCALA POR EL ANCHO, NO POR EL ALTO. Sube 10 px sobre una
carta de 223 DE ANCHO, o sea 4.5% del ancho. Yo lo pase como fraccion del
ALTO, y como nuestra carta es mas angosta en proporcion —0.741 contra
0.892— salio un tercio mas empinada. Una curva cruza a lo ancho: su pendiente
es subida sobre ANCHO, y por eso es lo que hay que conservar.

    referencia   10 px sobre 223 de ancho  =  4.5%
    nuestra      4.5% de 300               =  13.4 px

Los extremos de la linea caen al 66% del alto y el pico al 62%.
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
from comun import emblema
from los_nueve import defs
from paneles import borde

W, MARGEN = PICO.w, emblema.MARGEN
ALTO = PICO.h + MARGEN + 20
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)
SV = 'TFC'
B, A, FONDO, EXTRA, REMATE, _ = defs()[SV]
t = emblema.tono

DIV = round(PICO.h * .660)              # 267 · los EXTREMOS de la linea
FLECHA = round(PICO.w * .045)           # 13 · escalada por el ANCHO
COL = round(PICO.w * .30)
UL_H, UL_Y = 25.5, round(PICO.h * .878) - 13 + 0.2
PTS = [tuple(float(v) for v in p.split(','))
       for p in re.findall(r'(-?[\d.]+,-?[\d.]+)', PICO.d)]


def y(v):
    return v + MARGEN


def curva(yc, f):
    xi, xd = borde(yc, 'izq'), borde(yc, 'der')
    cx = (xi + xd) / 2
    return ('M%.1f,%.1f Q%.1f,%.1f %.1f,%.1f'
            % (xi, y(yc), cx, y(yc - f * 2), xd, y(yc)))


def panel_pie(yc, f):
    xi, xd = borde(yc, 'izq'), borde(yc, 'der')
    cx = (xi + xd) / 2
    d = ['M%.1f,%.1f' % (xi, y(yc)),
         'Q%.1f,%.1f %.1f,%.1f' % (cx, y(yc - f * 2), xd, y(yc))]
    for x, v in sorted([p for p in PTS if p[0] > 150 and p[1] > yc],
                       key=lambda p: p[1]):
        d.append('L%.1f,%.1f' % (x, y(v)))
    for x, v in sorted([p for p in PTS if p[0] < 150 and p[1] > yc],
                       key=lambda p: p[1], reverse=True):
        d.append('L%.1f,%.1f' % (x, y(v)))
    return ' '.join(d) + ' Z'


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
XC = round(borde(40, 'der') - COL)

# (etiqueta, flecha, doble linea)
CASOS = [
 ('1 · la medida · 13 px, UNA línea', FLECHA, False),
 ('2 · un poco menos · 10 px', 10, False),
 ('3 · un poco más · 16 px', 16, False),
 ('4 · plana · 0 px', 0, False),
 ('5 · con la doble línea que inventé', FLECHA, True),
 ('6 · lo anterior · 18 px y doble línea', 18, True),
]


def carta(i, etq, f, doble):
    cid = f'l{i}'
    dpie = panel_pie(DIV, f)
    segunda = ''
    if doble:
        segunda = (f'<path d="{curva(DIV + 16, f * .8)}" fill="none" '
                   f'stroke="{B}" stroke-width="1.1" opacity=".44"/>')
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
    <div class="pie-fondo" style="background:{FONDO};clip-path:path('{dpie}')"></div>
    <div class="pie-velo" style="background:{VELO};clip-path:path('{dpie}')"></div>
    <svg class="tra" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
      <path d="{curva(DIV, f)}" fill="none" stroke="{B}" stroke-width="1.9"
            opacity=".9"/>{segunda}
    </svg>
    <img class="ul" src="{UL}" style="top:{y(UL_Y)}px;height:{UL_H}px">
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
      <path d="{SIL}" fill="none" stroke="{t(A,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  {emblema.estrellas(1, W, sufijo=f'l{i}')}
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
.foto{{position:absolute;top:{MARGEN}px;left:0;right:0;height:{DIV + 14}px;
  z-index:3;overflow:hidden}}
.foto img{{width:100%;height:100%;object-fit:cover;object-position:center 12%}}
.velo-ar{{position:absolute;inset:0;background:linear-gradient(180deg,
  rgba(0,0,0,.40) 0%,rgba(0,0,0,.12) 22%,transparent 42%)}}
.wash{{position:absolute;top:{MARGEN}px;left:0;right:0;height:{DIV}px;
  z-index:4;pointer-events:none;background-repeat:repeat}}
.somb{{position:absolute;top:{MARGEN + 12}px;width:34px;height:{DIV - 22}px;
  z-index:5;pointer-events:none;opacity:.55;
  background:linear-gradient(270deg,rgba(0,0,0,.72),transparent)}}
.filo{{position:absolute;top:{MARGEN + 14}px;width:1.6px;height:{DIV - 28}px;
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
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">LA LÍNEA DE ABAJO, BIEN MEDIDA</div>'
           '<div class="med">lectura cruda, sin promediar ni suavizar:\n\n'
           '  x=22%  ->  y=66.0%\n'
           '  x=32%  ->  y=64.0%\n'
           '  x=50%  ->  y=62.0%   &lt;- el pico\n'
           '  x=68%  ->  y=64.0%\n'
           '  x=78%  ->  y=66.0%</div>'
           '<div class="aviso">Tres métodos dieron lo mismo, así que la medición '
           'estaba bien. Lo que estaba mal era <b>cómo la usaba</b>, en dos cosas:'
           '<br><br>'
           '⚠️ <b>1. La segunda línea no existe.</b> Cuando busqué «filas brillantes '
           'a lo ancho» me salieron dos, a 62.4% y 66.4%, y las tomé por un divisor '
           'doble. <b>Son la misma línea</b>: 62% en el centro y 66% en los bordes. '
           'Una línea curva deja huella en dos filas distintas, y un detector que '
           'mira fila por fila la cuenta dos veces.<br><br>'
           '⚠️ <b>2. La curva se escala por el ANCHO, no por el alto.</b> Sube 10 px '
           'sobre una carta de <b>223 de ancho</b> = 4.5%. Yo lo pasé como fracción '
           'del alto, y como nuestra carta es más angosta en proporción —0.741 contra '
           '0.892— salió un tercio más empinada. Una curva cruza a lo ancho: su '
           'pendiente es subida sobre <b>ancho</b>.<br><br>'
           'La 5 y la 6 tienen los dos errores puestos, para ver la diferencia.</div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'linea_final.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1060, 'height': 1000},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'linea_final.png'), full_page=True)
        await b.close()
    print('-> linea_final.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
