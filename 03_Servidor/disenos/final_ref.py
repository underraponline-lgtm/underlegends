"""La estructura de FINAL REFERENCIA, medida y aplicada. Con gema y sin gema.

MEDIDO sobre 03_Servidor/referencia/estructura/FINAL REFERENCIA.png:

    tapa del panel interior     6.0% del alto
    divisor foto / pie         62.4%  y una SEGUNDA linea a 66.4%
    gema                        centro 87.8%, alto 12.4%
    columna                     ~38% del ancho

⚠️ EL DIVISOR ES DOBLE. Dos lineas paralelas a 62.4% y 66.4%, o sea
separadas un 4% del alto. Yo venia dibujando una sola. Es lo que le da el
aire de placa: no es un corte, es un canto con espesor.

⚠️ Y CORRIJO UNA MEDICION MIA. Antes reporte que el pie arrancaba al 78%.
Aquel metodo buscaba el pixel mas brillante POR COLUMNA en la franja de
abajo, y agarraba la gema, no el divisor. Este busca FILAS brillantes a lo
ancho, que es lo que efectivamente es una linea divisoria. El bueno es
62.4%; el 78% estaba midiendo otra cosa.

⚠️ La columna al 38% es mucho para nosotros. La referencia tiene proporcion
0.892 y la nuestra 0.741: la misma fraccion sobre una carta mas angosta se
come mas. Van dos anchos para elegir viendo.

LA PREGUNTA DE LA TANDA: con gema o sin gema. Mi voto es SIN, porque el
rango ya esta en la columna y el color por rango es el lenguaje de la
Competitiva —el mismo motivo por el que el marco no va metalico—, pero se
decide viendolo.
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
EXTRA_AB = 30
ALTO = PICO.h + MARGEN + EXTRA_AB
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)
SV = 'TFC'
B, A, FONDO, EXTRA, REMATE, _ = defs()[SV]
t = emblema.tono

# ── la geometria medida, en fracciones de la carta ──
TAPA = round(PICO.h * .060)          # 24
DIV1 = round(PICO.h * .624)          # 253
DIV2 = round(PICO.h * .664)          # 269
GEMA_CY = round(PICO.h * .878)       # 356
GEMA_H = round(PICO.h * .124)        # 50
FLECHA = 28
PTS = [tuple(float(v) for v in p.split(','))
       for p in re.findall(r'(-?[\d.]+,-?[\d.]+)', PICO.d)]


def y(v):
    return v + MARGEN


def curva(yc, flecha):
    xi, xd = borde(yc, 'izq'), borde(yc, 'der')
    cx = (xi + xd) / 2
    return ('M%.1f,%.1f Q%.1f,%.1f %.1f,%.1f'
            % (xi, y(yc), cx, y(yc - flecha * 2), xd, y(yc)))


def panel_pie(yc, flecha):
    xi, xd = borde(yc, 'izq'), borde(yc, 'der')
    cx = (xi + xd) / 2
    d = ['M%.1f,%.1f' % (xi, y(yc)),
         'Q%.1f,%.1f %.1f,%.1f' % (cx, y(yc - flecha * 2), xd, y(yc))]
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
M_FOTO = ('linear-gradient(180deg,#000 0%,#000 68%,rgba(0,0,0,.5) 88%,'
          'transparent 100%)')
HEX = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'


def wash(frac):
    p = round(frac * 100)
    return (f'linear-gradient(270deg,#000 0%,#000 {p*.34:.0f}%,'
            f'rgba(0,0,0,0.5) {p*.62:.0f}%,transparent {p}%)')


CASOS = [
 ('1 · CON gema · columna 38%, como la referencia', .38, True),
 ('2 · SIN gema · columna 38%', .38, False),
 ('3 · CON gema · columna 30%', .30, True),
 ('4 · SIN gema · columna 30%', .30, False),
]


def carta(i, etq, col, con_gema):
    cid = f'r{i}'
    dpie = panel_pie(DIV1, FLECHA)
    gema = ''
    ul = ''
    if con_gema:
        cy = y(GEMA_CY)
        gema = (f'<div class="gema-aro" style="width:{GEMA_H+5}px;'
                f'height:{GEMA_H+5}px;top:{cy-(GEMA_H+5)/2}px;'
                f'clip-path:{HEX};background:{B}"></div>'
                f'<div class="gema" style="width:{GEMA_H}px;height:{GEMA_H}px;'
                f'top:{cy-GEMA_H/2}px;clip-path:{HEX};'
                f'background:linear-gradient(158deg,{t(A,.24)},{t(A,-.66)})"></div>')
    else:
        ul = (f'<img class="ul" src="{UL}" style="left:50%;'
              f'top:{y(GEMA_CY) - 13}px;transform:translateX(-50%);height:26px">')
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
         -webkit-mask-image:{wash(col)};mask-image:{wash(col)}"></div>
    <div class="pie-fondo" style="background:{FONDO};clip-path:path('{dpie}')"></div>
    <div class="pie-velo" style="background:{VELO};clip-path:path('{dpie}')"></div>
    <svg class="tra" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
      <path d="{curva(DIV1, FLECHA)}" fill="none" stroke="{B}"
            stroke-width="1.9" opacity=".88"/>
      <path d="{curva(DIV2, FLECHA * .82)}" fill="none" stroke="{B}"
            stroke-width="1.1" opacity=".46"/>
    </svg>
    {ul}
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
      <path d="{SIL}" fill="none" stroke="{t(A,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  {gema}
  {emblema.estrellas(1, W, sufijo=f'r{i}')}
  {emblema.pieza(SV, A, B, ESC)}
</div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:34px;flex-wrap:wrap;align-items:flex-start}}
.col{{text-align:center;width:{W}px;margin-bottom:28px}}
.et{{color:#EDEDF5;font-size:12.5px;font-weight:800;letter-spacing:1.1px;
  margin-bottom:16px;min-height:30px}}
.rot{{color:#EDEDF5;font-size:16px;font-weight:700;letter-spacing:1.4px;margin:6px 0 8px}}
.aviso{{color:#8A8AA0;font-size:12.5px;margin:0 0 22px;max-width:1010px;line-height:1.55}}
.med{{color:#8A8AA0;font-size:12px;font-family:ui-monospace,monospace;
  white-space:pre;line-height:1.5;margin:0 0 20px}}
.wrap{{position:relative;width:{W}px;height:{ALTO}px}}
.defs{{position:absolute}}
.cuerpo{{position:absolute;inset:0;filter:drop-shadow(0 12px 26px rgba(0,0,0,.72))}}
.borde{{position:absolute;inset:0;pointer-events:none}}
.fondo{{position:absolute;inset:0;z-index:0}}
.cap{{position:absolute;inset:0;z-index:1;background-repeat:repeat}}
.rem{{position:absolute;inset:0;z-index:2}}
.foto{{position:absolute;top:{MARGEN}px;left:0;right:0;height:{DIV1 + 12}px;
  z-index:3;overflow:hidden}}
.foto img{{width:100%;height:100%;object-fit:cover;object-position:center 12%}}
.velo-ar{{position:absolute;inset:0;background:linear-gradient(180deg,
  rgba(0,0,0,.40) 0%,rgba(0,0,0,.12) 22%,transparent 42%)}}
.wash{{position:absolute;top:{MARGEN}px;left:0;right:0;height:{DIV1}px;
  z-index:4;pointer-events:none;background-repeat:repeat}}
.pie-fondo,.pie-velo{{position:absolute;inset:0;z-index:4;
  pointer-events:none;background-repeat:repeat}}
.pie-velo{{z-index:5}}
.tra{{position:absolute;inset:0;z-index:6;pointer-events:none}}
.ul{{position:absolute;z-index:7;width:auto;opacity:.94;
  filter:drop-shadow(0 2px 5px rgba(0,0,0,.95))}}
.gema-aro{{position:absolute;left:50%;transform:translateX(-50%);z-index:8;
  filter:drop-shadow(0 4px 12px rgba(0,0,0,.85))}}
.gema{{position:absolute;left:50%;transform:translateX(-50%);z-index:9}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    cuerpo = ''.join(carta(i, *c) for i, c in enumerate(CASOS))
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">FINAL REFERENCIA, MEDIDA · CON GEMA Y SIN GEMA</div>'
           '<div class="med">tapa del panel interior    6.0% del alto   -> 24 px\n'
           'divisor foto / pie        62.4%           -> 253 px\n'
           'SEGUNDA linea del divisor 66.4%           -> 269 px\n'
           'gema                      centro 87.8%, alto 12.4%\n'
           'columna                   ~38% del ancho</div>'
           '<div class="aviso">⚠️ <b>El divisor es DOBLE</b>: dos líneas paralelas '
           'separadas un 4% del alto. Yo venía dibujando una sola. Eso es lo que le '
           'da aire de placa — no es un corte, es un canto con espesor.<br><br>'
           '⚠️ <b>Y corrijo una medición mía.</b> Antes dije que el pie arrancaba al '
           '78%. Aquel método buscaba el píxel más brillante <i>por columna</i> y '
           'agarraba la gema, no el divisor. Este busca <i>filas</i> brillantes a lo '
           'ancho, que es lo que efectivamente es una línea. El bueno es '
           '<b>62.4%</b>.<br><br>'
           '⚠️ La columna al 38% es mucho para nosotros: la referencia tiene '
           'proporción 0.892 y la nuestra 0.741, así que la misma fracción sobre una '
           'carta más angosta se come más. Van dos anchos.</div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'final_ref.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1400, 'height': 800},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'final_ref.png'), full_page=True)
        await b.close()
    print('-> final_ref.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
