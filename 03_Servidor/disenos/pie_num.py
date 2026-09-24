"""Maneras de escribir los tres puestos del pie. Solo el pie.

Dlx: "quizas hayan mejores formas de hacer eso de # de lo de abajo? como
esta el competitivo quizas? no exactamente pero una idea".

⚠️ LO QUE HACE LA COMPETITIVA, y por que no se copia tal cual. Alla el
puesto es una PASTILLA colgada del borde en right:-11px, con el aro del
acento. Funciona porque tiene cuatro en columna y un marco metalico que las
sostiene. Aca son TRES EN FILA y adentro del pie, asi que la pastilla tiene
que entrar en el ancho, no colgarse.

Y hay algo que cambia el problema: son tres numeros del MISMO servidor que
miden cosas distintas. En la Competitiva el #1 esta solo y no necesita
explicarse; aca, si los tres se ven iguales, no hay forma de saber cual es
cual. Lo que se prueba no es el adorno: es QUE SEPARA A LOS TRES.
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
from comun import rangos as RG, pie as PIE, marco as MK
from los_nueve import defs
from paneles import borde
import avatares

W, MARGEN = PICO.w, emblema.MARGEN
DEFS = defs()
BASE_Y = DIV.Y_EXTREMOS * PICO.h
SUBE = DIV.RECORRIDO * PICO.w * 1.3
ALTO_FOTO = round(BASE_Y) + 4
ALTO = PICO.h + MARGEN + 20
PTS = [tuple(float(v) for v in p.split(','))
       for p in re.findall(r'(-?[\d.]+,-?[\d.]+)', PICO.d)]
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)
M_FOTO = ('linear-gradient(180deg,#000 0%,#000 84%,rgba(0,0,0,.55) 95%,'
          'transparent 100%)')
LAVADO = (13, 25, 43)
SV, RG_, CC, NOM_ = 'TFC', 'B', 'mx', 'MAKI'
PUESTOS = [(PIE.X_COMP, 27, 'COMPET.'), (PIE.X_TEMP, 25, 'TEMPOR.'),
           (PIE.X_SV, 26, 'SERVIDOR')]

# ⚠️ Dlx eligio la D pero vio que "los logos de pais y rango estan como
# alejados". Y tiene una causa: al agrupar los tres puestos en UNA pieza, el
# pie paso de cinco cosas repartidas a TRES BLOQUES —bandera, grupo, figura—
# y el aire que antes se repartia entre cinco quedo concentrado en dos
# huecos. El grupo no se movio: los otros dos se quedaron donde estaban.
#
# Asi que lo que se prueba es CUANTO se acercan, y si se acercan o se pegan.
# (etiqueta, x de la bandera, x de la figura, pegados a la pieza)
MODOS = [
    ('D · como estaba', 32, 268, False),
    ('D1 · mas cerca', 52, 248, False),
    ('D2 · bien cerca', 66, 234, False),
    ('D3 · adentro de la misma pieza', 0, 0, True),
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


def puestos(modo, B, A):
    if True:
        # ⚠️ agrupados: los tres comparten UNA pieza, asi que se leen como un
        # bloque de "donde estas" y no como tres datos sueltos. El separador
        # hace el trabajo que hacian tres etiquetas.
        _e, xb, xf, dentro = MODOS[modo]
        cel = ''.join(
            f'<span><b>{v}º</b><i>{lb}</i></span>'
            + ('<u></u>' if k < 2 else '')
            for k, (_x, v, lb) in enumerate(PUESTOS))
        ban = (f'<img class="bin" src="https://flagcdn.com/w80/{CC}.png">'
               if dentro else '')
        fig = (RG.svg(RG_, 22, 11, 11, 'g' + str(modo), clase='fin')
               if dentro else '')
        # ⚠️ cuando van adentro, el grupo se centra solo: no se le puede
        # fijar la x porque su ancho cambia con las piezas que entran
        pos = ('left:50%;transform:translateX(-50%)' if dentro
               else f'left:{PIE.X_COMP-32}px')
        return (f'<div class="grupo" style="{pos};'
                f'top:{y(PIE.Y_FILA)-15}px">{ban}{cel}{fig}</div>')



def carta(modo, sufijo):
    B, A, FONDO, EXTRA, _, _ = DEFS[SV]
    pts = camino()
    _, av = avatares.para(0)
    lado = W * 115 / 100
    a, b, c = LAVADO
    m = (f'linear-gradient(270deg,#000 0%,#000 {a}%,'
         f'rgba(0,0,0,.5) {b}%,transparent {c}%)')
    return f"""<div class="wrap">
  <svg class="d" width="0" height="0"><defs>
    <clipPath id="{sufijo}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
    {MK.defs_svg(A, B, sufijo)}
  </defs></svg>
  <div class="cu" style="clip-path:url(#{sufijo})">
    <div class="f" style="background:{FONDO}"></div>
    {f'<div class="f" style="{EXTRA}"></div>' if EXTRA else ''}
    <div class="foto" style="-webkit-mask-image:{M_FOTO};mask-image:{M_FOTO};
         clip-path:path('{DIV.arriba(pts, W, ALTO, dy=MARGEN)}')">
      <img src="{av}" style="width:{lado:.0f}px;left:{(W-lado)/2:.1f}px;
           top:{MARGEN-(lado-ALTO_FOTO)*.44:.1f}px"></div>
    <div class="wash" style="background:{PIE.lavado(A)};
         -webkit-mask-image:{m};mask-image:{m};
         clip-path:path('{DIV.arriba(pts, W, ALTO, dy=MARGEN)}')"></div>
    {BRI.arriba(A)}
    <div class="f" style="background:{FONDO};clip-path:path('{DIV.panel(pts, PTS, W, dy=MARGEN)}')"></div>
    <svg class="f" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
      <path d="{'M' + ' L'.join('%.2f,%.2f' % (x, y(v)) for x, v in pts)}"
            fill="none" stroke="{B}" stroke-width="1.9" opacity=".9"/>
    </svg>
  </div>
  <svg class="bo" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{sufijo})">
      <path d="{SIL}" fill="none" stroke="{MK.stroke(sufijo)}"
            stroke-width="9" opacity=".95"/></g>
  </svg>
  <div class="nom" style="font-size:{NOM.rem(NOM_, 1.6)}rem">{NOM_}</div>
  {'' if MODOS[modo][3] else f'''<img class="ban" src="https://flagcdn.com/w80/{CC}.png"
       style="left:{MODOS[modo][1]-PIE.LADO/2}px;top:{y(PIE.Y_FILA)-PIE.LADO*.36:.1f}px;
       width:{PIE.LADO}px;height:{PIE.LADO*.72:.1f}px">'''}
  {puestos(modo, B, A)}
  {'' if MODOS[modo][3] else RG.svg(RG_, PIE.LADO, MODOS[modo][2], y(PIE.Y_FILA), sufijo, clase='fig')}
  <img class="ul" src="{UL}">
  {emblema.pieza(SV, A, B, b64(os.path.join(BASE, 'comun', 'escudos_cuad',
                                            f'sv_{SV.lower()}.png')))}
</div>"""


UL = b64(os.path.join(BASE, '01_Temporada', 'ul_blanco.png'))

CSS = f"""
body{{margin:0;background:transparent}}
.wrap{{position:relative;width:{W}px;height:{ALTO}px}}
.d{{position:absolute}} .cu{{position:absolute;inset:0}}
.bo{{position:absolute;inset:0;pointer-events:none}}
.f{{position:absolute;inset:0;background-repeat:repeat}}
.foto{{position:absolute;top:0;left:0;width:{W}px;height:{ALTO}px;
  overflow:hidden}}
.foto img{{position:absolute;height:auto;display:block}}
/* ⚠️ EL LAVADO VA EN LA MISMA CAJA QUE EL FONDO, no en una propia.
   Antes era top:MARGEN con height:BASE_Y, o sea una caja de 300x269 contra
   la de 300x487 del fondo. Las dos pintan el MISMO degrade a 158 grados, y
   un degrade se reparte sobre la diagonal de SU caja: 402.8 px contra 572.0.
   O sea que el lavado mostraba el degrade de la carta COMPRIMIDO UN 30% y
   corrido, y donde la foto se desvanece se veian los dos a la vez.
   Dlx: "el panel derecho tiene como una reflexion media rara". No era un
   reflejo: era el degrade de la carta duplicado y desalineado.
   Ahora comparte la caja y se limita con un RECORTE, que no toca el
   degrade. Y se repinta tambien la capa EXTRA, por lo mismo. */
.wash{{position:absolute;inset:0;background-repeat:repeat}}
{BRI.css('luz', MARGEN, PICO.h)}
.nom{{position:absolute;left:0;right:0;top:{y(NOM.Y['servidor'])-16}px;
  text-align:center;z-index:9;font-family:'Archivo','LigaEmoji',sans-serif;font-weight:900;
  color:#fff;line-height:1;text-shadow:0 2px 6px rgba(0,0,0,.85)}}
.fig{{position:absolute;z-index:9;filter:drop-shadow(0 2px 6px rgba(0,0,0,.75))}}
.ban{{position:absolute;border-radius:2.5px;object-fit:cover;z-index:9;
  box-shadow:0 2px 6px rgba(0,0,0,.8),0 0 0 1.3px rgba(255,255,255,.5)}}
.pst{{position:absolute;width:60px;text-align:center;color:#fff;z-index:9;
  font-family:'Archivo','LigaEmoji',sans-serif;line-height:1}}
.pst b{{display:block;font-size:1.02rem;font-weight:900;
  text-shadow:0 2px 5px rgba(0,0,0,.9)}}
.pst span{{display:block;font-size:.34rem;font-weight:800;letter-spacing:.6px;
  opacity:.72;margin-top:3px}}
.chip{{position:absolute;width:54px;text-align:center;z-index:9;
  font-family:'Archivo','LigaEmoji',sans-serif;color:#fff;padding:3px 0 4px;
  border-radius:14px;background:rgba(8,8,14,.5);
  border:1.2px solid color-mix(in srgb,var(--a) 60%,transparent)}}
.chip b{{display:block;font-size:.86rem;font-weight:900;line-height:1}}
.chip span{{display:block;font-size:.3rem;font-weight:800;letter-spacing:.5px;
  opacity:.75;margin-top:2px}}
.grupo{{position:absolute;z-index:9;display:flex;align-items:center;
  font-family:'Archivo','LigaEmoji',sans-serif;color:#fff;gap:7px;
  background:rgba(8,8,14,.42);border-radius:13px;padding:4px 11px 5px}}
.grupo span{{text-align:center;min-width:40px}}
.grupo b{{display:block;font-size:.94rem;font-weight:900;line-height:1}}
.grupo i{{display:block;font-size:.3rem;font-style:normal;font-weight:800;
  letter-spacing:.5px;opacity:.7;margin-top:2px}}
.grupo u{{width:1px;height:19px;background:rgba(255,255,255,.24)}}
.bin{{width:22px;height:16px;border-radius:2px;object-fit:cover;flex:none;
  box-shadow:0 0 0 1.1px rgba(255,255,255,.45)}}
.fin{{position:relative!important;flex:none;
  filter:drop-shadow(0 2px 5px rgba(0,0,0,.75))}}
.ul{{position:absolute;left:50%;transform:translateX(-50%);height:{PIE.UL_H}px;
  width:auto;z-index:9;top:{y(PIE.UL_Y)}px}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    tmp = os.path.join(SCR, '_num'); os.makedirs(tmp, exist_ok=True)
    fs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': W, 'height': ALTO},
                              device_scale_factor=3)
        for i in range(len(MODOS)):
            h = os.path.join(tmp, f'{i}.html')
            open(h, 'w', encoding='utf-8').write(
                '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
                + fuentes + CSS + '</style></head><body>'
                + carta(i, f'n{i}') + '</body></html>')
            await pg.goto('file://' + h); await pg.wait_for_timeout(280)
            f = os.path.join(tmp, f'{i}.png')
            await pg.screenshot(path=f, clip={'x': 0, 'y': MARGEN + 230,
                                              'width': W, 'height': 170},
                                omit_background=True)
            fs.append(f)
        await b.close()

    cel = ''.join(f'<div class="g"><div class="gl">{MODOS[i][0]}</div>'
                  f'<img class="z" src="{b64(f)}">'
                  f'<div class="gs">{MODOS[i][1]}</div></div>'
                  for i, f in enumerate(fs))
    hoja = f"""<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
body{{background:#0A0A10;margin:0;padding:30px;font-family:system-ui,sans-serif}}
.rot{{color:#EDEDF5;font-size:15px;font-weight:800;letter-spacing:1.3px;margin:0 0 8px}}
.d1{{color:#8A8AA0;font-size:12.5px;margin:0 0 18px;max-width:1200px;line-height:1.55}}
.fila{{display:flex;gap:18px;flex-wrap:wrap}}
.g{{text-align:center}}
.gl{{color:#EDEDF5;font-size:11px;font-weight:800;letter-spacing:1px;margin-bottom:7px}}
.gs{{color:#7A7A90;font-size:10.5px;margin-top:6px}}
.z{{display:block;width:{W}px;background:#12121A;border-radius:8px}}
</style></head><body>
<div class="rot">LOS TRES PUESTOS DEL PIE</div>
<div class="d1">⚠️ <b>La Competitiva no se puede copiar tal cual.</b> Allá el
puesto es una <b>pastilla colgada del borde</b> en <code>right:-11px</code>, y
funciona porque tiene cuatro en columna y un marco que las sostiene. Acá son
<b>tres en fila y adentro del pie</b>: la pastilla tiene que entrar en el
ancho, no colgarse.<br><br>
Y hay algo que cambia el problema: son <b>tres números del mismo servidor</b>
que miden cosas distintas. En la Competitiva el <code>#1</code> está solo y no
necesita explicarse; acá, <b>si los tres se ven iguales no hay forma de saber
cuál es cuál</b>. Así que lo que se prueba no es el adorno: es <b>qué separa a
los tres</b>.</div>
<div class="fila">{cel}</div></body></html>"""
    out = os.path.join(SCR, 'pie_num.html')
    open(out, 'w', encoding='utf-8').write(hoja)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1340, 'height': 700},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(1800)
        await pg.screenshot(path=os.path.join(SCR, 'pie_num.png'), full_page=True)
        await b.close()
    print('-> pie_num.png')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    asyncio.run(main())
