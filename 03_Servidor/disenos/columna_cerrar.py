"""La columna sola, en grande, para cerrarla.

Dlx: "primero veamos y terminemos con el panel derecho para ver como hacemos
el resto".

QUE QUEDA ABIERTO DE LA COLUMNA. Todo lo demas ya se decidio y esta medido:
el lavado es la B (13/25/43, contra la D compraba 6.1% mas de avatar tapado
por contraste que ya sobraba), las cinco filas entran sin desbordar (50 px
el par mas ancho contra 56 disponibles) y el texto va en blanco.

Lo unico sin decidir es COMO SE PARA EL NUMERO. Se agrando a 3rem y se le
puso filo, pero su posicion nunca se eligio: quedo donde estaba cuando media
2.05rem, y una pieza que crece un 46% no se queda bien en el mismo lugar.

⚠️ SE MUESTRA LA COLUMNA RECORTADA Y AL DOBLE. A tamaño de carta, mover el
numero 6 px es invisible al lado del avatar y del pie; recortada, la
diferencia se ve. Es el mismo problema que ya tuvo una tanda de muestras
—seis variantes cuya diferencia era una linea de 1.7 px— y la solucion es la
misma: mostrar solo lo que se esta decidiendo, al tamaño en que se decide.
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
from comun import emblema, divisor as DIV, brillo as BRI
from comun import pie as PIE, iconos as ICO, marco as MK
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
SV = 'TFC'
FILAS = [('campeonatos', 1), ('podios', 4), ('racha', '6/10'),
         ('duelos', '5/9'), ('eventos', 22)]
RECORTE = (W - 118, MARGEN - 12, W, MARGEN + 285)

# (etiqueta, y del numero, rem, y de la primera fila, paso, linea separadora)
MODOS = [
    ('A · como está', 46, 3.0, 118, 27, False),
    ('B · más abajo, más aire arriba', 62, 3.0, 128, 26, False),
    ('C · más grande y arriba', 38, 3.4, 116, 27, False),
    ('D · con línea que lo separa', 46, 3.0, 124, 26, True),
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


def carta(modo, sufijo):
    _e, y_ovr, rem, y0, paso, linea = MODOS[modo]
    B, A, FONDO, EXTRA, _, _ = DEFS[SV]
    pts = camino()
    _, av = avatares.para(1)
    lado = W * 115 / 100
    a, b, c = LAVADO
    m = (f'linear-gradient(270deg,#000 0%,#000 {a}%,'
         f'rgba(0,0,0,.5) {b}%,transparent {c}%)')
    minis = ''.join(
        f'<div class="mini" style="top:{y(y0 + k * paso) - 9:.0f}px">'
        f'<div class="lin">{ICO.svg(ic, 15)}<b>{v}</b></div>'
        f'<span>{ICO.ETIQUETA[ic]}</span></div>'
        for k, (ic, v) in enumerate(FILAS))
    # ⚠️ la linea NO va del color del acento: en tres de diez el acento es
    # blanco y ahi la linea desapareceria. Va del degrade del borde, que es
    # el unico color que tiene croma en los diez.
    sep = (f'<div class="sep" style="top:{y(y0 - 14):.0f}px;'
           f'background:linear-gradient(90deg,transparent,'
           f'{MK.paradas(A, B)[0]},transparent)"></div>' if linea else '')
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
            fill="none" stroke="{B}" stroke-width="1.9" opacity=".9"/></svg>
  </div>
  <svg class="bo" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{sufijo})">
      <path d="{SIL}" fill="none" stroke="{MK.stroke(sufijo)}"
            stroke-width="9" opacity=".95"/></g>
  </svg>
  <div class="ovr" style="top:{y(y_ovr)}px;font-size:{rem}rem">66</div>
  {sep}{minis}
</div>"""


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
.ovr{{position:absolute;right:{PIE.COL_DER}px;width:{PIE.COL_ANCHO}px;
  text-align:center;z-index:9;font-family:'Archivo','LigaEmoji',sans-serif;color:#fff;
  font-weight:900;line-height:.92;
  -webkit-text-stroke:1.1px rgba(0,0,0,.62);paint-order:stroke fill;
  text-shadow:0 3px 10px rgba(0,0,0,.9)}}
.sep{{position:absolute;right:{PIE.COL_DER}px;width:{PIE.COL_ANCHO}px;
  height:1.3px;z-index:9;opacity:.8}}
.mini{{position:absolute;right:{PIE.COL_DER}px;width:{PIE.COL_ANCHO}px;
  z-index:9;color:#fff;font-family:'Archivo','LigaEmoji',sans-serif;text-align:center;
  text-shadow:0 2px 6px rgba(0,0,0,.9)}}
.lin{{display:flex;align-items:center;justify-content:center;gap:4px;
  white-space:nowrap}}
.lin svg{{flex:none}}
.lin b{{font-size:.9rem;font-weight:900;line-height:1}}
.mini span{{display:block;font-size:.38rem;font-weight:800;letter-spacing:.9px;
  opacity:.68;margin-top:2px}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    tmp = os.path.join(SCR, '_cc'); os.makedirs(tmp, exist_ok=True)
    x0, y0, x1, y1 = RECORTE
    fs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': W, 'height': ALTO},
                              device_scale_factor=4)
        for i in range(len(MODOS)):
            h = os.path.join(tmp, f'{i}.html')
            open(h, 'w', encoding='utf-8').write(
                '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
                + fuentes + CSS + '</style></head><body>'
                + carta(i, f'c{i}') + '</body></html>')
            await pg.goto('file://' + h); await pg.wait_for_timeout(280)
            f = os.path.join(tmp, f'{i}.png')
            await pg.screenshot(path=f, clip={'x': x0, 'y': y0,
                                              'width': x1 - x0,
                                              'height': y1 - y0})
            fs.append(f)
        await b.close()

    cel = ''.join(f'<div class="g"><div class="gl">{MODOS[i][0]}</div>'
                  f'<img class="z" src="{b64(f)}"></div>'
                  for i, f in enumerate(fs))
    hoja = f"""<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
body{{background:#0A0A10;margin:0;padding:30px;font-family:system-ui,sans-serif}}
.rot{{color:#EDEDF5;font-size:15px;font-weight:800;letter-spacing:1.3px;margin:0 0 8px}}
.d1{{color:#8A8AA0;font-size:12.5px;margin:0 0 20px;max-width:1150px;line-height:1.55}}
.fila{{display:flex;gap:26px;flex-wrap:wrap}}
.g{{text-align:center}}
.gl{{color:#EDEDF5;font-size:11.5px;font-weight:800;letter-spacing:1px;margin-bottom:9px}}
.z{{display:block;width:236px;border-radius:8px}}
</style></head><body>
<div class="rot">LA COLUMNA, PARA CERRARLA</div>
<div class="d1">Todo lo demás de la columna ya está decidido y medido: el
<b>lavado es la B</b> (13/25/43 — contra la D compraba 6.1% más de avatar
tapado por contraste que ya sobraba), las <b>cinco filas entran sin
desbordar</b> (50 px el par más ancho contra 56 disponibles) y el <b>texto va
en blanco</b>.<br><br>
Lo único sin decidir es <b>cómo se para el número</b>. Se agrandó a 3rem y se
le puso filo, pero <b>su posición nunca se eligió</b>: quedó donde estaba
cuando medía 2.05rem, y una pieza que crece un 46% no se queda bien en el
mismo lugar.<br><br>
⚠️ <b>Va recortada y al doble.</b> A tamaño de carta, mover el número 6 px es
invisible al lado del avatar y del pie. Es el mismo problema de una tanda
anterior —seis variantes cuya diferencia era una línea de 1.7 px— y la
solución es la misma: mostrar solo lo que se está decidiendo, al tamaño en
que se decide.</div>
<div class="fila">{cel}</div></body></html>"""
    out = os.path.join(SCR, 'columna_cerrar.html')
    open(out, 'w', encoding='utf-8').write(hoja)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1180, 'height': 800},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(1800)
        await pg.screenshot(path=os.path.join(SCR, 'columna_cerrar.png'),
                            full_page=True)
        await b.close()
    print('-> columna_cerrar.png')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    asyncio.run(main())
