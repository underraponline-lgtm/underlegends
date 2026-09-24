"""La COLUMNA del costado, como la del diseño que quedó para País.

Dlx: "me refiero al lado como lo que esta la tarjeta de pais que vamos a
hacer, que hay un panel al costado".

⚠️ ESTABA IMPLEMENTADO Y YO LO BUSQUE EN EL LUGAR EQUIVOCADO. Las tres
mediciones anteriores fueron sobre las REFERENCIAS de FC Mobile, buscando
una linea. Pero la pieza que Dlx pedia ya existe en este repo, escrita, en
03_Servidor/normal_card.css:250 — el diseño viejo de la Servidor, el que
quedo reservado para Pais. Su propio comentario lo explica:

    "Repinta el degradado propio de la carta sobre la franja izquierda y lo
     desvanece hacia la derecha. Asi el numero queda sobre el material de la
     carta, no sobre el avatar — que es como funciona la carta de FIFA."

QUE ES, ENTONCES. No es una linea ni una caja: es un LAVADO. Se vuelve a
pintar el degradado de la carta encima de la foto en una franja, y esa
franja se desvanece hacia el centro. Lo que gana no es decoracion: es que
los datos caigan sobre EL MATERIAL DE LA CARTA y no sobre una foto que no
controlamos.

    mask original   linear-gradient(90deg, #000 0%, #000 13%,
                                    rgba(0,0,0,.5) 25%, transparent 43%)
    alto            58% de la carta

⚠️ VA ESPEJADO A LA DERECHA, que ya lo habia pedido Dlx antes: "the left
thing could we move it to the right instead? so it looks different than
other ones". El diseño viejo lo tiene a la IZQUIERDA y ese diseño es el de
Pais: si la Servidor lo copia igual, las dos cartas se confunden.

⚠️ Y HAY UN CHOQUE QUE HAY QUE DECIR ANTES DE DIBUJAR. Si la columna lleva
el numero y el rango —que es lo que lleva en el layout FIFA— entonces el pie
que ya se eligio se queda sin dos de sus tres piezas. No se puede tener las
dos cosas: o el rango vive abajo en su figura, o vive en la columna.
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
from comun import emblema, divisor as DIV, brillo as BRI, nombre as NOM
from comun import rangos as RG
from los_nueve import defs
from paneles import borde
import avatares

W, MARGEN = PICO.w, emblema.MARGEN
DEFS = defs()
BASE_Y = DIV.Y_EXTREMOS * PICO.h
SUBE = DIV.RECORRIDO * PICO.w * 1.3
ALTO_FOTO = round(BASE_Y) + 14
ALTO = PICO.h + MARGEN + 20
PTS = [tuple(float(v) for v in p.split(','))
       for p in re.findall(r'(-?[\d.]+,-?[\d.]+)', PICO.d)]
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)
VELO = 'linear-gradient(180deg,rgba(0,0,0,.30),rgba(0,0,0,.64))'
M_FOTO = ('linear-gradient(180deg,#000 0%,#000 72%,rgba(0,0,0,.5) 92%,'
          'transparent 100%)')
_EST = json.load(open(os.path.join(BASE, 'datos', 'estrellas.json'),
                      encoding='utf-8'))['estrellas_por_servidor']

# (etiqueta, paradas del lavado en % desde la DERECHA, nota)
CASOS = [
 ('A · sin columna', None, 'la carta como está hoy'),
 ('B · el lavado original, espejado', (13, 25, 43),
  'las mismas paradas de <code>normal_card.css:253</code>, invertidas'),
 ('C · más angosto', (10, 18, 32), 'la columna ocupa menos y deja más foto'),
 ('D · más ancho', (17, 31, 54), 'más material y menos foto'),
]


def y(v):
    return v + MARGEN


def b64(p):
    return ('data:image/png;base64,'
            + base64.b64encode(open(p, 'rb').read()).decode())


def camino(n=90):
    xi, xd = borde(BASE_Y, 'izq'), borde(BASE_Y, 'der')
    return [(xi + (xd - xi) * (i / n), BASE_Y - DIV.altura(i / n) * SUBE)
            for i in range(n + 1)]


def panel_pie(pts):
    # el camino vive en comun/divisor.py: estaba copiado en ocho
    # scripts, todos con el mismo bug de la punta perdida
    return DIV.panel(pts, PTS, W, dy=MARGEN)


def lavado(FONDO, par):
    """El lavado: repinta el material de la carta y se desvanece al centro.

    ⚠️ 270deg y no 90: va de la DERECHA hacia el centro. El diseño viejo lo
    tiene a la izquierda y ese diseño es el de Pais.
    """
    if not par:
        return ''
    a, b, c = par
    m = (f'linear-gradient(270deg,#000 0%,#000 {a}%,'
         f'rgba(0,0,0,.5) {b}%,transparent {c}%)')
    return (f'<div class="wash" style="background:{FONDO};'
            f'-webkit-mask-image:{m};mask-image:{m}"></div>')


def columna(sv, rg, ovr, sufijo, par):
    """Lo que va en la columna: el numero y la figura del rango, como FIFA."""
    if not par:
        return ''
    cx = W - 40
    return (f'<div class="col" style="right:12px">'
            f'<div class="num">{ovr}</div>'
            f'<div class="lab">OVR SV</div></div>'
            + RG.svg(rg, 30, cx, y(150), 'c' + sufijo, clase='rfig'))


def carta(i, etq, par, sv, rg, ovr, nom, sufijo):
    B, A, FONDO, EXTRA, _, _ = DEFS[sv]
    pts = camino()
    _, av = avatares.para(i)
    lado = W * 115 / 100
    foto = (f'<div class="foto" style="-webkit-mask-image:{M_FOTO};'
            f'mask-image:{M_FOTO}"><img src="{av}" style="width:{lado:.0f}px;'
            f'left:{(W-lado)/2:.1f}px;top:{-(lado-ALTO_FOTO)*.44:.1f}px">'
            f'</div>') if av else ''
    return f"""<div class="g"><div class="gl">{etq}</div>
<div class="wrap">
  <svg class="d" width="0" height="0"><defs>
    <clipPath id="{sufijo}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cu" style="clip-path:url(#{sufijo})">
    <div class="f" style="background:{FONDO}"></div>
    {f'<div class="f" style="{EXTRA}"></div>' if EXTRA else ''}
    {foto}
    {lavado(FONDO, par)}
    {BRI.arriba(A)}
    <div class="f" style="background:{FONDO};clip-path:path('{panel_pie(pts)}')"></div>
    <div class="f" style="background:{VELO};clip-path:path('{panel_pie(pts)}')"></div>
    <svg class="f" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
      <path d="{'M' + ' L'.join('%.2f,%.2f' % (x, y(v)) for x, v in pts)}"
            fill="none" stroke="{B}" stroke-width="1.9" opacity=".9"/>
    </svg>
  </div>
  <svg class="bo" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{sufijo})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
    </g>
  </svg>
  {columna(sv, rg, ovr, sufijo, par)}
  <div class="nom" style="font-size:{NOM.rem(nom, 1.6)}rem">{nom}</div>
  {emblema.estrellas(int(_EST.get(sv, 0)), W, sufijo=sufijo)}
  {emblema.pieza(sv, A, B, b64(os.path.join(BASE, 'comun', 'escudos_cuad',
                                            f'sv_{sv.lower()}.png')))}
</div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:30px;font-family:system-ui,sans-serif}}
.rot{{color:#EDEDF5;font-size:15px;font-weight:800;letter-spacing:1.3px;
  margin:26px 0 6px;border-top:1px solid #23232E;padding-top:16px}}
.rot:first-child{{border:0;margin-top:0;padding-top:0}}
.d1{{color:#8A8AA0;font-size:12.5px;margin:0 0 16px;max-width:1200px;line-height:1.55}}
.fila{{display:flex;gap:22px;flex-wrap:wrap;align-items:flex-start}}
.g{{text-align:center}}
.gl{{color:#EDEDF5;font-size:11.5px;font-weight:800;letter-spacing:1px;
  margin-bottom:8px;max-width:300px}}
.gs{{color:#7A7A90;font-size:10.5px;margin-top:7px;max-width:300px;line-height:1.4}}
.rec{{border-radius:8px;overflow:hidden;background:#15151E}}
.rec img{{display:block;height:400px;width:auto}}
.wrap{{position:relative;width:{W}px;height:{ALTO}px}}
.d{{position:absolute}}
.cu{{position:absolute;inset:0;filter:drop-shadow(0 12px 26px rgba(0,0,0,.72))}}
.bo{{position:absolute;inset:0;pointer-events:none}}
.f{{position:absolute;inset:0;background-repeat:repeat}}
.foto{{position:absolute;top:{MARGEN}px;left:0;width:{W}px;height:{ALTO_FOTO}px;
  overflow:hidden}}
.foto img{{position:absolute;height:auto;display:block}}
/* el lavado va ENCIMA de la foto y DEBAJO de la luz de arriba */
.wash{{position:absolute;top:{MARGEN}px;left:0;right:0;height:{BASE_Y:.0f}px;
  pointer-events:none}}
{BRI.css('luz', MARGEN, PICO.h)}
.col{{position:absolute;top:{y(96)}px;z-index:9;text-align:center;width:56px;
  font-family:'Archivo','LigaEmoji',sans-serif;color:#fff}}
.num{{font-size:2.0rem;font-weight:900;line-height:1;
  text-shadow:0 2px 8px rgba(0,0,0,.9)}}
.lab{{font-size:.44rem;font-weight:800;letter-spacing:1.1px;opacity:.75;
  margin-top:4px}}
.rfig{{position:absolute;z-index:9;filter:drop-shadow(0 2px 6px rgba(0,0,0,.8))}}
.nom{{position:absolute;left:0;right:0;top:{y(NOM.Y['servidor'])-16}px;
  text-align:center;z-index:9;font-family:'Archivo','LigaEmoji',sans-serif;font-weight:900;
  color:#fff;line-height:1;text-shadow:0 2px 6px rgba(0,0,0,.85)}}
""" + emblema.CSS

GENTE = [('TFC', 'A', 72, 'VALEN'), ('SR', 'SS', 88, 'METEORO'),
         ('FRZ', 'S', 81, 'BAU'), ('DRA', 'B', 64, 'MARK')]


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    viejo = os.path.join(SCR, '_viejo_a.png')
    ref = ''
    if os.path.exists(viejo):
        ref = (f'<div class="g"><div class="gl">EL DISEÑO QUE QUEDÓ PARA PAÍS'
               f'</div><div class="rec"><img src="{b64(viejo)}"></div>'
               f'<div class="gs">la columna a la <b>izquierda</b>: OVR, rango, '
               f'bandera y escudo, todos sobre el material de la carta</div>'
               f'</div>')
    cuerpo = ''.join(
        carta(i, etq, par, *GENTE[i], f'k{i}')
        for i, (etq, par, _n) in enumerate(CASOS))
    notas = ''.join(f'<div class="g" style="width:300px"><div class="gs">'
                    f'{n}</div></div>' for _e, _p, n in CASOS)

    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">LA COLUMNA DEL COSTADO</div>'
           '<div class="d1">⚠️ <b>Esto ya estaba implementado y yo lo busqué '
           'en el lugar equivocado.</b> Mis tres mediciones anteriores fueron '
           'sobre las referencias de FC Mobile, buscando una línea. La pieza '
           'que pedías <b>ya existe en el repo</b>, en '
           '<code>03_Servidor/normal_card.css:250</code> — el diseño viejo de '
           'la Servidor, el que quedó para País. Su comentario lo dice: '
           '«<i>repinta el degradado propio de la carta sobre la franja '
           'izquierda y lo desvanece hacia la derecha. Así el número queda '
           'sobre el material de la carta, no sobre el avatar — que es como '
           'funciona la carta de FIFA</i>».<br><br>'
           '<b>No es una línea ni una caja: es un lavado.</b> Se repinta el '
           'degradado de la carta encima de la foto y se desvanece hacia el '
           'centro. Lo que gana no es decoración: es que <b>los datos caigan '
           'sobre el material de la carta y no sobre una foto que no '
           'controlamos</b>.<br><br>'
           '⚠️ <b>Va espejado a la derecha</b>, que ya lo habías pedido: «the '
           'left thing could we move it to the right instead? so it looks '
           'different than other ones». El diseño viejo lo tiene a la '
           'izquierda <b>y ese diseño es el de País</b>: si la Servidor lo '
           'copia igual, las dos se confunden.<br><br>'
           '⚠️ <b>Y hay un choque que conviene decir antes de seguir.</b> Si '
           'la columna lleva el número y el rango —que es lo que lleva en el '
           'layout FIFA— entonces <b>el pie que ya elegiste se queda sin dos '
           'de sus tres piezas</b>. No se pueden tener las dos: o el rango '
           'vive abajo en su figura, o vive en la columna.</div>'
           + (f'<div class="fila">{ref}</div>' if ref else '')
           + '<div class="rot">ESPEJADA A LA DERECHA, EN LA SERVIDOR</div>'
           '<div class="fila">' + cuerpo + '</div>'
           '<div class="fila">' + notas + '</div>'
           '</body></html>')
    out = os.path.join(SCR, 'columna.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1420, 'height': 1000},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2800)
        await pg.screenshot(path=os.path.join(SCR, 'columna.png'),
                            full_page=True)
        await b.close()
    print('-> columna.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
