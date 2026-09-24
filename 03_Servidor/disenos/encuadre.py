"""El encuadre del avatar: donde cae la imagen dentro de la carta.

⚠️ MEDIDO ANTES DE TOCAR, y cambia el planteo:

La zona de la foto es 300 x 283 y los avatares de Discord son CUADRADOS. Con
object-fit:cover, la imagen escalada queda 300x300 y solo se recortan 17 px
en vertical. O sea que object-position tiene un recorrido total de 17 px:
moverlo de 12% a 50% corre la imagen 6.5 px. NO ALCANZA para centrar nada.

Para tener recorrido hay que ACERCAR la imagen. Con zoom 120% la imagen pasa
a 360x360 y el recorrido sube a 77 px, que ya permite elegir que parte se ve.

Y hay una segunda razon para acercarla: la zona visible NO es la zona de la
foto. Arriba la tapa el emblema y abajo se disuelve contra el panel. Medido:

    la foto ocupa            y   0 .. 283   centro en 141
    el emblema baja hasta    y  44
    el divisor arranca en    y 269
    la zona que se VE        y  44 .. 269   centro en 156

O sea que el centro de lo que se ve esta 15 px MAS ABAJO que el centro de la
foto. Una imagen centrada en su caja queda descentrada en la carta.
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
from comun import emblema, divisor as DIV, nombre as NOM
from los_nueve import defs
from paneles import borde
import avatares

W, MARGEN = PICO.w, emblema.MARGEN
ALTO = PICO.h + MARGEN + 20
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)
SV = 'TFC'
B, A, FONDO, EXTRA, REMATE, _ = defs()[SV]
t = emblema.tono
BASE_Y = DIV.Y_EXTREMOS * PICO.h
SUBE = DIV.RECORRIDO * PICO.w * 1.3
ALTO_FOTO = round(BASE_Y) + 14
PTS = [tuple(float(v) for v in p.split(','))
       for p in re.findall(r'(-?[\d.]+,-?[\d.]+)', PICO.d)]


def y(v):
    return v + MARGEN


def camino(n=90):
    xi, xd = borde(BASE_Y, 'izq'), borde(BASE_Y, 'der')
    return [(xi + (xd - xi) * (i / n), BASE_Y - DIV.altura(i / n) * SUBE)
            for i in range(n + 1)]


def panel_pie(pts):
    # el camino vive en comun/divisor.py: estaba copiado en ocho
    # scripts, todos con el mismo bug de la punta perdida
    return DIV.panel(pts, PTS, W, dy=MARGEN)


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


ESC = b64(os.path.join(BASE, 'comun', 'escudos_cuad', f'sv_{SV.lower()}.png'))
M_FOTO = ('linear-gradient(180deg,#000 0%,#000 72%,rgba(0,0,0,.5) 92%,'
          'transparent 100%)')
VELO = 'linear-gradient(180deg,rgba(0,0,0,.30),rgba(0,0,0,.64))'
NOMBRE = 'VALEN'

# (etiqueta, zoom en %, cuanto se corre hacia arriba en % de la imagen)
CASOS = [
 ('1 · como está · 100%, arriba', 100, 0.0),
 ('2 · 100%, centrado en su caja', 100, 0.5),
 ('3 · zoom 115%, centrado', 115, 0.5),
 ('4 · zoom 115%, centrado en lo VISIBLE', 115, 0.62),
 ('5 · zoom 130%, centrado en lo visible', 130, 0.62),
 ('6 · zoom 130%, un poco más arriba', 130, 0.45),
]


def carta(i, etq, zoom, pos):
    cid = f'e{i}'
    pts = camino()
    _, av = avatares.para(i)
    # la imagen mide `zoom`% del ancho; el sobrante vertical se reparte
    # segun `pos`: 0 = pegada arriba, 1 = pegada abajo
    lado = W * zoom / 100
    izq = (W - lado) / 2
    arriba = -(lado - ALTO_FOTO) * pos
    return f"""<div class="col"><div class="et">{etq}</div>
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})">
    <div class="fondo" style="background:{FONDO}"></div>
    {f'<div class="cap" style="{EXTRA}"></div>' if EXTRA else ''}
    <div class="foto" style="-webkit-mask-image:{M_FOTO};mask-image:{M_FOTO}">
      <img src="{av}" style="width:{lado:.0f}px;left:{izq:.1f}px;
           top:{arriba:.1f}px"></div>
    <div class="pie" style="background:{FONDO};clip-path:path('{panel_pie(pts)}')"></div>
    <div class="pie" style="background:{VELO};clip-path:path('{panel_pie(pts)}')"></div>
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
    </g>
  </svg>
  <div class="nom" style="font-size:{NOM.rem(NOMBRE, 1.6)}rem">{NOMBRE}</div>
  {emblema.estrellas(1, W, sufijo=cid)}
  {emblema.pieza(SV, A, B, ESC)}
</div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:32px;flex-wrap:wrap;align-items:flex-start}}
.col{{text-align:center;width:{W}px;margin-bottom:26px}}
.et{{color:#EDEDF5;font-size:12.5px;font-weight:800;letter-spacing:1.1px;
  margin-bottom:14px;min-height:30px}}
.rot{{color:#EDEDF5;font-size:16px;font-weight:700;letter-spacing:1.4px;margin:6px 0 8px}}
.aviso{{color:#8A8AA0;font-size:12.5px;margin:0 0 18px;max-width:1010px;line-height:1.55}}
.med{{color:#8A8AA0;font-size:12px;font-family:ui-monospace,monospace;
  white-space:pre;line-height:1.5;margin:0 0 18px}}
.wrap{{position:relative;width:{W}px;height:{ALTO}px}}
.defs{{position:absolute}}
.cuerpo{{position:absolute;inset:0;filter:drop-shadow(0 12px 26px rgba(0,0,0,.72))}}
.borde{{position:absolute;inset:0;pointer-events:none}}
.fondo{{position:absolute;inset:0}}
.cap{{position:absolute;inset:0;background-repeat:repeat}}
.foto{{position:absolute;top:{MARGEN}px;left:0;width:{W}px;height:{ALTO_FOTO}px;
  overflow:hidden}}
.foto img{{position:absolute;height:auto;display:block}}
.pie{{position:absolute;inset:0;background-repeat:repeat}}
.nom{{position:absolute;left:0;right:0;top:{y(280)-16}px;text-align:center;
  z-index:9;font-family:'Archivo','LigaEmoji',sans-serif;font-weight:900;color:#fff;
  line-height:1;text-shadow:0 2px 6px rgba(0,0,0,.85)}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    cuerpo = ''.join(carta(i, *c) for i, c in enumerate(CASOS))
    med = ('la foto ocupa            y   0 .. 283   centro en 141\n'
           'el emblema baja hasta    y  44\n'
           'el divisor arranca en    y 269\n'
           'LA ZONA QUE SE VE        y  44 .. 269   centro en 156')
    aviso = (
        '⚠️ <b>object-position casi no sirve acá.</b> Los avatares son '
        'cuadrados y la zona mide 300×283, así que con <code>cover</code> la '
        'imagen queda 300×300 y solo se recortan <b>17 px</b>: moverlo de 12% a '
        '50% la corre 6.5 px. Para tener recorrido hay que <b>acercar</b> la '
        'imagen — con zoom 130% pasa a 390×390 y el recorrido sube a 107 px.'
        '<br><br>'
        '⚠️ Y hay una segunda razón: <b>la zona visible no es la zona de la '
        'foto</b>. Arriba la tapa el emblema y abajo se disuelve contra el '
        'panel. El centro de lo que se ve está <b>15 px más abajo</b> que el '
        'centro de la caja, así que una imagen centrada en su caja queda '
        'descentrada en la carta. Eso es lo que separa la 3 de la 4.<br><br>'
        '⚠️ El lado derecho sigue sin decidirse; acá no está puesto para no '
        'mezclar decisiones.')
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">EL ENCUADRE DEL AVATAR</div>'
           '<div class="med">' + med + '</div>'
           '<div class="aviso">' + aviso + '</div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'encuadre.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1060, 'height': 1000},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'encuadre.png'), full_page=True)
        await b.close()
    print('-> encuadre.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
