"""LA ESTRUCTURA SOLA, sin contenido. Y con el divisor CURVO.

Dlx: "right now do not see any stat or picture... we are still building up
the card structure". Tiene razon: meter stats y foto mientras se discute la
estructura confunde las dos cosas. Aca va la carta VACIA.

MEDIDO sobre las seis referencias de EA que paso:

    columna              11.7% a 19.2% del ancho, media ~16%
    arranque del pie     78-79% del alto, en cinco de seis
    direccion de la curva  NO SALE: el signo se invierte segun la carta,
                         porque la deteccion agarra a veces la gema y a
                         veces el arco. Se toma de la imagen, no del numero.

⚠️ Esos porcentajes estan medidos sobre el asset ENTERO, que incluye alas y
laureles que sobresalen. El panel interior es mas angosto, asi que el 16%
aplicado a nuestra carta da una columna proporcionalmente mas ancha de lo
que parece. No es un traslado directo.

LO QUE SI SE CONFIRMA, y es lo que yo venia dibujando mal: EL DIVISOR ENTRE
LA FOTO Y LA BANDA DEL PIE ES UNA CURVA, no una recta. En las seis.

⚠️ Y sobre los archivos: son assets de EA. La ESTRUCTURA —una columna, un
divisor curvo, una banda al pie— se puede estudiar y usar. El arte de ellos
—los laureles, el dorado, las alas— no se copia a un producto nuestro. De
aca salen proporciones y geometria, no dibujo.
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
ALTO = PICO.h + MARGEN
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)
SV = 'TFC'
B, A, FONDO, EXTRA, REMATE, _ = defs()[SV]
t = emblema.tono

PIE = round(PICO.h * .78)      # 78% del alto, como en las referencias
COL = round(PICO.w * .22)      # la franja, un poco mas que el 16% medido
ARR = 32


def y(v):
    return v + MARGEN


def divisor(flecha):
    """La curva que separa la foto de la banda. flecha>0 sube en el centro."""
    xi, xd = borde(PIE, 'izq'), borde(PIE, 'der')
    cx = (xi + xd) / 2
    return ('M%.1f,%.1f Q%.1f,%.1f %.1f,%.1f'
            % (xi, y(PIE), cx, y(PIE - flecha * 2), xd, y(PIE)))


def panel_pie(flecha):
    """El panel del pie: arriba la curva, el resto el contorno de la carta."""
    xi, xd = borde(PIE, 'izq'), borde(PIE, 'der')
    cx = (xi + xd) / 2
    d = ['M%.1f,%.1f' % (xi, y(PIE)),
         'Q%.1f,%.1f %.1f,%.1f' % (cx, y(PIE - flecha * 2), xd, y(PIE))]
    pts = [tuple(float(v) for v in p.split(','))
           for p in re.findall(r'(-?[\d.]+,-?[\d.]+)', PICO.d)]
    for x, v in sorted([p for p in pts if p[0] > 150 and p[1] > PIE],
                       key=lambda p: p[1]):
        d.append('L%.1f,%.1f' % (x, y(v)))
    for x, v in sorted([p for p in pts if p[0] < 150 and p[1] > PIE],
                       key=lambda p: p[1], reverse=True):
        d.append('L%.1f,%.1f' % (x, y(v)))
    return ' '.join(d) + ' Z'


def marco_foto(flecha):
    """El panel de la foto: baja hasta la curva y deja la franja afuera."""
    xi_a, xi_b = borde(ARR, 'izq') + 8, borde(PIE, 'izq') + 8
    xd = borde(ARR, 'der') - COL
    cx = (xi_b + xd) / 2
    return ('M%.1f,%.1f L%.1f,%.1f L%.1f,%.1f Q%.1f,%.1f %.1f,%.1f Z'
            % (xi_a, y(ARR), xd, y(ARR), xd, y(PIE - 3),
               cx, y(PIE - 3 - flecha * 1.7), xi_b, y(PIE - 3)))


WASH = ('linear-gradient(270deg,#000 0%,#000 13%,rgba(0,0,0,0.5) 25%,'
        'transparent 43%)')
VELO = 'linear-gradient(180deg,rgba(0,0,0,.28),rgba(0,0,0,.62))'

CASOS = [
 ('1 · divisor recto · lo que venía haciendo', 0, True),
 ('2 · curva suave · sube 10 px', 10, True),
 ('3 · curva media · sube 18 px', 18, True),
 ('4 · curva marcada · sube 28 px', 28, True),
 ('5 · curva invertida · baja 16 px', -16, True),
 ('6 · curva media, sin contornos', 18, False),
]


def carta(i, etq, flecha, con_trazo):
    cid = f'c{i}'
    dpie, dfoto = panel_pie(flecha), marco_foto(flecha)
    tr = ''
    if con_trazo:
        tr = (f'<path d="{dfoto}" fill="none" stroke="{B}" stroke-width="1.6" '
              f'opacity=".72"/>'
              f'<path d="{divisor(flecha)}" fill="none" stroke="{B}" '
              f'stroke-width="1.8" opacity=".85"/>')
    return f"""<div class="col"><div class="et">{etq}</div>
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})">
    <div class="fondo" style="background:{FONDO}"></div>
    {f'<div class="cap" style="{EXTRA}"></div>' if EXTRA else ''}
    {f'<div class="rem" style="{REMATE}"></div>' if REMATE else ''}
    <div class="wash" style="background:{FONDO};
         -webkit-mask-image:{WASH};mask-image:{WASH}"></div>
    <div class="pie-fondo" style="background:{FONDO};clip-path:path('{dpie}')"></div>
    <div class="pie-velo" style="background:{VELO};clip-path:path('{dpie}')"></div>
    <svg class="tra" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">{tr}</svg>
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
      <path d="{SIL}" fill="none" stroke="{t(A,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  {emblema.estrellas(1, W, sufijo=f'c{i}')}
  {emblema.pieza(SV, A, B, ESC)}
</div></div>"""


ESC = base64.b64encode(open(os.path.join(
    BASE, 'comun', 'escudos_cuad', f'sv_{SV.lower()}.png'), 'rb').read()).decode()
ESC = 'data:image/png;base64,' + ESC

CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:34px;flex-wrap:wrap;align-items:flex-start}}
.col{{text-align:center;width:{W}px;margin-bottom:28px}}
.et{{color:#EDEDF5;font-size:12.5px;font-weight:800;letter-spacing:1.1px;
  margin-bottom:16px;min-height:30px}}
.rot{{color:#EDEDF5;font-size:16px;font-weight:700;letter-spacing:1.4px;margin:6px 0 8px}}
.aviso{{color:#8A8AA0;font-size:12.5px;margin:0 0 22px;max-width:1010px;line-height:1.55}}
.med{{color:#8A8AA0;font-size:12px;font-family:ui-monospace,monospace;
  white-space:pre;line-height:1.5;margin:0 0 22px}}
.wrap{{position:relative;width:{W}px;height:{ALTO}px}}
.defs{{position:absolute}}
.cuerpo{{position:absolute;inset:0;filter:drop-shadow(0 12px 26px rgba(0,0,0,.72))}}
.borde{{position:absolute;inset:0;pointer-events:none}}
.fondo{{position:absolute;inset:0;z-index:0}}
.cap{{position:absolute;inset:0;z-index:1;background-repeat:repeat}}
.rem{{position:absolute;inset:0;z-index:2}}
.wash{{position:absolute;top:{MARGEN}px;left:0;right:0;height:{PIE}px;
  z-index:4;pointer-events:none;background-repeat:repeat}}
.pie-fondo,.pie-velo{{position:absolute;inset:0;z-index:4;
  pointer-events:none;background-repeat:repeat}}
.pie-velo{{z-index:5}}
.tra{{position:absolute;inset:0;z-index:6;pointer-events:none}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    cuerpo = ''.join(carta(i, *c) for i, c in enumerate(CASOS))
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">LA ESTRUCTURA SOLA · CON EL DIVISOR CURVO</div>'
           '<div class="aviso">Carta vacía a propósito: con stats y foto encima se '
           'juzgan dos cosas a la vez.<br><br>Medido sobre tus seis referencias:'
           '</div>'
           '<div class="med">columna             11.7% a 19.2% del ancho · media ~16%\n'
           'arranque del pie    78-79% del alto · en cinco de seis\n'
           'curvatura           NO SALE: el signo se invierte segun la carta,\n'
           '                    porque la deteccion agarra a veces la gema y a\n'
           '                    veces el arco. Se toma de la imagen.</div>'
           '<div class="aviso">⚠️ Esos porcentajes son sobre el asset entero, que '
           'incluye alas y laureles que sobresalen; el panel interior es más '
           'angosto, así que no es un traslado directo.<br><br>'
           '<b>Lo que sí se confirma en las seis, y es lo que yo venía dibujando '
           'mal: el divisor entre la foto y la banda del pie es una CURVA, no una '
           'recta.</b> La 1 es la recta, para comparar.</div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'estructura_curva.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1060, 'height': 1000},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'estructura_curva.png'),
                            full_page=True)
        await b.close()
    print('-> estructura_curva.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
