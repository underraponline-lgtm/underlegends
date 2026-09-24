"""El puesto competitivo en la Servidor: donde, y por que no como la Competitiva.

Dlx: "no crees que el lado competitivo deberia estar en el servidor tambien
en alguna parte? me refiero al puesto... nos podemos basar en como la
tarjeta competitiva hizo todo esto pero no hacerlo igual".

POR QUE SI, Y NO ES REDUNDANTE CON LA FIGURA DEL RANGO:

    el RANGO es una BANDA     27 personas comparten "A", 36 comparten "C"
    el PUESTO es EXACTO       sos el 12 de 138, y no hay otro 12

Dos personas con la misma figura pueden estar a 30 puestos de distancia. La
figura dice de que material sos; el puesto dice cuantos hay delante.


⚠️ Y ORDENA LA CARTA EN DOS ZONAS CON DOS ALCANCES, que hasta ahora estaban
mezcladas:

    la COLUMNA (derecha)   TODO lo del servidor
                           OVR sv · puesto sv · campeonatos · racha
    el PIE                 TODO lo de la Liga
                           pais · rango competitivo · puesto competitivo

Asi la carta se lee de un vistazo: a la derecha lo que hiciste ACA, abajo
quien sos EN LA LIGA. Antes el OVR del servidor estaba abajo y el rango
tambien: las dos zonas decian de las dos cosas.


COMO LO HACE LA COMPETITIVA, y por que aca no
---------------------------------------------
La Competitiva lo pone en una PASTILLA colgada del borde, en right:-11px,
sobresaliendo de la silueta (card.css .tr .chip). Eso funciona alla porque
es su lenguaje: tiene cuatro pastillas en columna y el marco metalico las
sostiene.

Aca no, por dos motivos que no son de gusto:

  1. El costado derecho ya lo ocupa la COLUMNA. Una pastilla colgada ahi
     chocaria con el lavado y con el numero.
  2. Lo que sobresale de esta carta ya esta decidido y medido: el emblema y
     las estrellas. Agregar una tercera cosa que sobresale por otro lado
     complica la exportacion, que ya necesita calcular la union.

Asi que va ADENTRO del pie, y las variantes de abajo son sobre COMO se
escribe, no sobre donde.
"""
import asyncio
import base64
import json
import os
import re
import sys

from PIL import Image
from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun.siluetas import PICO
from comun import emblema, divisor as DIV, brillo as BRI, nombre as NOM
from comun import rangos as RG
from comun import pie as PIE
from los_nueve import defs
from paneles import borde
import avatares

RG.verificar()
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

# las posiciones viven en comun/pie.py: ya se movieron tres veces y
# estaban escritas en dos archivos
LADO, Y_FILA = PIE.LADO, PIE.Y_FILA
X_BAN, X_PST, X_FIG = PIE.X_BAN, PIE.X_PST, PIE.X_FIG
RECORTE = (0, 250, W, ALTO)      # solo el pie, que es lo que estamos viendo


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


def puesto(modo, p, tot, B, rg):
    """Las maneras de escribir el puesto competitivo."""
    if modo == 0:      # como la Competitiva: pastilla. Para ver por que no.
        return (f'<div class="chip" style="left:{X_PST-30}px;'
                f'top:{y(Y_FILA)-11}px;--a:{B}">#{p}</div>')
    if modo == 1:      # numero grande + de cuantos
        return (f'<div class="pst" style="left:{X_PST-34}px;'
                f'top:{y(Y_FILA)-15}px"><b>{p}º</b><span>DE {tot}</span></div>')
    if modo == 2:      # ordinal, mas hablado
        return (f'<div class="pst" style="left:{X_PST-34}px;'
                f'top:{y(Y_FILA)-15}px"><b>{p}º</b>'
                f'<span>COMPETITIVO</span></div>')
    # pegado a la figura: el rango y el puesto como una sola cosa
    return (f'<div class="pst jun" style="left:{X_FIG+6}px;'
            f'top:{y(Y_FILA)-13}px"><b>#{p}</b></div>')


MODOS = [
    ('0 · pastilla, como la Competitiva', 0,
     'es su lenguaje, no el de esta carta'),
    ('1 · el elegido, con la figura a la derecha', 1, 'el puesto DENTRO DEL SERVIDOR: 27º de 79'),
    ('2 · ordinal', 2, '12º · COMPETITIVO'),
    ('3 · pegado a la figura', 3, 'el rango y el puesto como una sola pieza'),
]

# ⚠️ DATOS REALES, y el puesto es pos_sv: la posicion competitiva DENTRO DEL
# SERVIDOR, que es lo que pidio Dlx —"entre todos los que estan en el
# competitivo dentro del servidor"— y lo mismo que ya hace el circulo del
# pais en la Competitiva. Se calcula POR SCORE, como manda CLAUDE.md, y ya
# existe en el pool: 135 de 138.
GENTE = [('KONAN', 'TWR', 'SSS', 'ar', 1, 18), ('AXINU', 'TFC', 'SS', 'co', 1, 79),
         ('MAKI', 'TFC', 'B', 'mx', 27, 79), ('BENJA', 'TFC', 'E', 'cl', 77, 79)]


def carta(i, modo, sufijo):
    nom, sv, rg, cc, p, tot = GENTE[i]
    B, A, FONDO, EXTRA, _, _ = DEFS[sv]
    pts = camino()
    _, av = avatares.para(i)
    lado = W * 115 / 100
    foto = (f'<div class="foto" style="-webkit-mask-image:{M_FOTO};'
            f'mask-image:{M_FOTO}"><img src="{av}" style="width:{lado:.0f}px;'
            f'left:{(W-lado)/2:.1f}px;top:{-(lado-ALTO_FOTO)*.44:.1f}px">'
            f'</div>') if av else ''
    ban = (f'<img class="ban" src="https://flagcdn.com/w80/{cc}.png" '
           f'style="left:{X_BAN-LADO/2}px;top:{y(Y_FILA)-LADO*.36:.1f}px;'
           f'width:{LADO}px;height:{LADO*.72:.1f}px">')
    return f"""<div class="wrap">
  <svg class="d" width="0" height="0"><defs>
    <clipPath id="{sufijo}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cu" style="clip-path:url(#{sufijo})">
    <div class="f" style="background:{FONDO}"></div>
    {f'<div class="f" style="{EXTRA}"></div>' if EXTRA else ''}
    {foto}{BRI.arriba(A)}
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
  <div class="nom" style="font-size:{NOM.rem(nom, 1.6)}rem">{nom}</div>
  {ban}{RG.svg(rg, LADO, X_FIG, y(Y_FILA), sufijo, clase='fig')}
  {puesto(modo, p, tot, B, rg)}
  <img class="ul" src="{UL}">
</div>"""


UL = b64(os.path.join(BASE, '01_Temporada', 'ul_blanco.png'))

CSS = f"""
body{{margin:0;background:transparent}}
.wrap{{position:relative;width:{W}px;height:{ALTO}px}}
.d{{position:absolute}}
.cu{{position:absolute;inset:0}}
.bo{{position:absolute;inset:0;pointer-events:none}}
.f{{position:absolute;inset:0;background-repeat:repeat}}
.foto{{position:absolute;top:{MARGEN}px;left:0;width:{W}px;height:{ALTO_FOTO}px;
  overflow:hidden}}
.foto img{{position:absolute;height:auto;display:block}}
{BRI.css('luz', MARGEN, PICO.h)}
.nom{{position:absolute;left:0;right:0;top:{y(NOM.Y['servidor'])-16}px;
  text-align:center;z-index:9;font-family:'Archivo','LigaEmoji',sans-serif;font-weight:900;
  color:#fff;line-height:1;text-shadow:0 2px 6px rgba(0,0,0,.85)}}
.fig{{position:absolute;z-index:9;filter:drop-shadow(0 2px 6px rgba(0,0,0,.75))}}
.ban{{position:absolute;border-radius:2.5px;object-fit:cover;z-index:9;
  box-shadow:0 2px 6px rgba(0,0,0,.8),0 0 0 1.3px rgba(255,255,255,.5)}}
.pst{{position:absolute;width:68px;text-align:center;color:#fff;z-index:9;
  font-family:'Archivo','LigaEmoji',sans-serif;line-height:1}}
.pst b{{display:block;font-size:1.16rem;font-weight:900;
  text-shadow:0 2px 5px rgba(0,0,0,.9)}}
.pst span{{display:block;font-size:.42rem;font-weight:800;letter-spacing:1.1px;
  opacity:.72;margin-top:3px}}
.pst.jun{{width:44px;text-align:left}}
.pst.jun b{{font-size:1.0rem}}
.chip{{position:absolute;z-index:9;font-family:'Archivo','LigaEmoji',sans-serif;
  font-weight:900;font-size:.72rem;color:#fff;padding:4px 11px 5px;
  border-radius:20px;background:rgba(8,8,14,.62);
  border:1.4px solid color-mix(in srgb,var(--a) 62%,transparent);
  box-shadow:0 3px 10px rgba(0,0,0,.55)}}
.ul{{position:absolute;left:50%;transform:translateX(-50%);height:{PIE.UL_H}px;
  width:auto;z-index:9;top:{y(PIE.UL_Y)}px}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    tmp = os.path.join(SCR, '_pst')
    os.makedirs(tmp, exist_ok=True)
    x0, y0, x1, y1 = RECORTE
    hechos = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': W, 'height': ALTO},
                              device_scale_factor=3)
        for mi, (etq, modo, _n) in enumerate(MODOS):
            fila = []
            for i in range(len(GENTE)):
                h = os.path.join(tmp, f'{mi}_{i}.html')
                open(h, 'w', encoding='utf-8').write(
                    '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
                    + fuentes + CSS + '</style></head><body>'
                    + carta(i, modo, f'p{mi}{i}') + '</body></html>')
                await pg.goto('file://' + h)
                await pg.wait_for_timeout(220)
                f = os.path.join(tmp, f'{mi}_{i}.png')
                await pg.screenshot(path=f, clip={'x': x0, 'y': y0,
                                                  'width': x1 - x0,
                                                  'height': y1 - y0})
                fila.append(f)
            hechos.append((etq, fila))
        await b.close()

    def uri(p):
        return ('data:image/png;base64,'
                + base64.b64encode(open(p, 'rb').read()).decode())

    bloques = ''.join(
        f'<div class="rot">{etq.upper()}</div>'
        f'<div class="d2">{MODOS[i][2]}</div>'
        f'<div class="fila">'
        + ''.join(f'<img class="pie" src="{uri(f)}">' for f in fila)
        + '</div>' for i, (etq, fila) in enumerate(hechos))

    hoja = f"""<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
body{{background:#0A0A10;margin:0;padding:30px;font-family:system-ui,sans-serif}}
.rot{{color:#EDEDF5;font-size:14px;font-weight:800;letter-spacing:1.2px;
  margin:24px 0 3px;border-top:1px solid #23232E;padding-top:15px}}
.rot:first-of-type{{border:0;margin-top:0;padding-top:0}}
.d1{{color:#8A8AA0;font-size:12.5px;margin:0 0 12px;max-width:1180px;line-height:1.55}}
.d2{{color:#7A7A90;font-size:11.5px;margin:0 0 10px}}
.fila{{display:flex;gap:18px;flex-wrap:wrap}}
.pie{{display:block;width:{W}px;border-radius:0 0 8px 8px}}
</style></head><body>
<div class="d1">Solo el <b>pie</b>, que es lo que estamos mirando.<br><br>
<b>Sí va, y no es redundante con la figura:</b> el <b>rango es una banda</b>
—27 personas comparten «A», 36 comparten «C»— y el <b>puesto es exacto</b>.
Dos personas con la misma figura pueden estar a 30 puestos. La figura dice
<b>de qué material sos</b>; el puesto, <b>cuántos hay delante</b>.<br><br>
⚠️ <b>Y ordena la carta en dos zonas con dos alcances</b>, que hasta ahora
estaban mezcladas: la <b>columna</b> pasa a ser <b>todo lo del servidor</b>
—OVR sv, puesto sv, campeonatos, racha— y el <b>pie</b> pasa a ser <b>todo lo
de la Liga</b> —país, rango, puesto competitivo—. Antes el OVR del servidor
estaba abajo y el rango también: las dos zonas hablaban de las dos cosas.
<br><br>
⚠️ <b>Por qué no como la Competitiva.</b> Allá es una pastilla colgada del
borde en <code>right:-11px</code>, y eso funciona porque tiene cuatro en
columna y un marco que las sostiene. Acá no, por dos motivos que no son de
gusto: <b>(1)</b> el costado derecho ya lo ocupa la columna y chocaría con el
lavado; <b>(2)</b> lo que sobresale de esta carta ya está decidido y medido
—el emblema y las estrellas— y una tercera cosa que sobresale complica la
exportación, que ya necesita calcular la unión.</div>
{bloques}
</body></html>"""
    out = os.path.join(SCR, 'pie_puesto.html')
    open(out, 'w', encoding='utf-8').write(hoja)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1350, 'height': 1000},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2000)
        await pg.screenshot(path=os.path.join(SCR, 'pie_puesto.png'),
                            full_page=True)
        await b.close()
    print('-> pie_puesto.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
