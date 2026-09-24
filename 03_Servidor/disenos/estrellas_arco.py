"""Las estrellas sobre el arco del escudo, con cuanta curvatura.

⚠️ ESTA HOJA ES SOLO POR LAS ESTRELLAS. El lado derecho NO esta decidido:
lo que se ve ahi es provisional y no hay que leerlo como cerrado.

EL FACTOR DE ARCO, y por que es un factor y no un si/no:

Siguiendo la curva EXACTA del escudo, tres estrellas de 21 px sobre un radio
de 46 abren unos 78 grados. Las de los costados bajan casi hasta la mitad
del escudo y el conjunto queda mas de COLLAR que de CORONA. Por eso se toma
una fraccion de esa curvatura.

Cada estrella ademas GIRA con el arco, perpendicular al radio. Sin ese giro
las estrellas siguen la curva pero miran todas para arriba, que es lo que
delata que estan puestas sobre un arco en vez de pertenecerle.

Se muestran con 1, 2 y 3 estrellas: hoy cuatro servidores tienen UNA sola, y
con una sola el arco no se ve. La decision tiene que aguantar los tres casos.
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

CASOS = [
 ('arco 0.0 · fila recta', 0.0),
 ('arco 0.35', 0.35),
 ('arco 0.5', 0.5),
 ('arco 0.7', 0.7),
 ('arco 1.0 · la curva exacta', 1.0),
]


def carta(i, etq, arco, n_est):
    cid = f'a{i}_{n_est}'
    pts = camino()
    _, av = avatares.para(i)
    return f"""<div class="col"><div class="et">{etq}<br>
<span class="av">{n_est} estrella{'s' if n_est > 1 else ''}</span></div>
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})">
    <div class="fondo" style="background:{FONDO}"></div>
    {f'<div class="cap" style="{EXTRA}"></div>' if EXTRA else ''}
    <div class="foto" style="-webkit-mask-image:{M_FOTO};mask-image:{M_FOTO}">
      <img src="{av}"></div>
    <div class="pie" style="background:{FONDO};clip-path:path('{panel_pie(pts)}')"></div>
    <div class="pie" style="background:{VELO};clip-path:path('{panel_pie(pts)}')"></div>
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
    </g>
  </svg>
  {emblema.estrellas(n_est, W, sufijo=cid, arco=arco)}
  {emblema.pieza(SV, A, B, ESC)}
</div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:26px;flex-wrap:wrap;align-items:flex-start}}
.col{{text-align:center;width:{W}px;margin-bottom:24px}}
.et{{color:#EDEDF5;font-size:12.5px;font-weight:800;letter-spacing:1.1px;
  margin-bottom:14px;min-height:38px}}
.av{{color:#7A7A92;font-weight:400;letter-spacing:0;font-size:11px}}
.rot{{color:#EDEDF5;font-size:16px;font-weight:700;letter-spacing:1.4px;margin:14px 0 8px}}
.aviso{{color:#8A8AA0;font-size:12.5px;margin:0 0 20px;max-width:1010px;line-height:1.55}}
.wrap{{position:relative;width:{W}px;height:{ALTO}px}}
.defs{{position:absolute}}
.cuerpo{{position:absolute;inset:0;filter:drop-shadow(0 12px 26px rgba(0,0,0,.72))}}
.borde{{position:absolute;inset:0;pointer-events:none}}
.fondo{{position:absolute;inset:0}}
.cap{{position:absolute;inset:0;background-repeat:repeat}}
.foto{{position:absolute;top:{MARGEN}px;left:0;right:0;height:{round(BASE_Y)+14}px;
  overflow:hidden}}
.foto img{{width:100%;height:100%;object-fit:cover;object-position:center 12%}}
.pie{{position:absolute;inset:0;background-repeat:repeat}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    bloques = []
    for n in (3, 2, 1):
        cuerpo = ''.join(carta(i, e, a, n) for i, (e, a) in enumerate(CASOS))
        bloques.append(f'<div class="rot">CON {n} '
                       f'ESTRELLA{"S" if n > 1 else ""}</div>'
                       f'<div class="fila">{cuerpo}</div>')
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">LAS ESTRELLAS SOBRE EL ARCO DEL ESCUDO</div>'
           '<div class="aviso">Cada estrella <b>gira</b> con el arco, '
           'perpendicular al radio. Sin ese giro seguirían la curva pero '
           'mirarían todas para arriba, y eso delata que están <i>puestas</i> '
           'sobre un arco en vez de pertenecerle.<br><br>'
           '⚠️ El arco va por <b>factor</b> y no por sí/no: siguiendo la curva '
           'exacta, tres estrellas de 21 px sobre un radio de 46 abren unos '
           '<b>78°</b>, y las de los costados bajan casi hasta la mitad del '
           'escudo — queda más de collar que de corona.<br><br>'
           'Van con 3, 2 y 1 estrella porque <b>hoy cuatro servidores tienen '
           'una sola</b>, y con una el arco no se ve. La decisión tiene que '
           'aguantar los tres casos.<br><br>'
           '⚠️ <b>El lado derecho no está decidido</b>: lo que se ve acá es '
           'provisional.</div>'
           + ''.join(bloques) + '</body></html>')
    out = os.path.join(SCR, 'estrellas_arco.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1720, 'height': 1000},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'estrellas_arco.png'),
                            full_page=True)
        await b.close()
    print('-> estrellas_arco.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
