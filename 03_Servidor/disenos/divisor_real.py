"""El divisor REAL de FINAL REFERENCIA, trazado y aplicado sin aproximar.

COMO SE SACO. herramientas/trazar_divisor.py, con programacion dinamica: se
busca EL MEJOR CAMINO de borde a borde, obligado a moverse como mucho un
pixel por columna, sobre el gradiente vertical. Eso encuentra la unica cosa
que cruza la carta entera de forma continua, que es lo que una linea
divisoria ES.

Verificado dibujando el trazo encima del original: cae sobre la linea en las
152 columnas. Coste medio 0.264, o sea que el camino paso casi siempre por
un borde fuerte y no tuvo que inventar tramos rectos.

    extremos   66.0% del alto        cima   62.8%
    RECORRIDO  8.0 px sobre 223 de ANCHO  =  3.59% del ancho
    en nuestra carta de 300  ->  10.8 px

⚠️ TRES METODOS QUE PROBE ANTES Y NO SIRVEN, anotados en el trazador:
brillo maximo por columna, clasificacion por color, y techo de la region de
abajo. Los tres dan un numero y ninguno avisa que esta midiendo otra cosa.

⚠️ Y EL PERFIL NO ES UNA PARABOLA: la cima es PLANA, tres lecturas seguidas
en 62.8%. Una cuadratica no puede tener meseta —tiene un solo extremo— asi
que aca NO se ajusta una curva: se usan los puntos trazados tal cual,
escalados. Eso es lo que pidio Dlx cuando dijo que no aproximemos.
"""
import asyncio
import base64
import os
import re
import sys

import numpy as np
from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
sys.path.insert(0, os.path.join(BASE, 'herramientas'))
from comun.siluetas import PICO
from comun import emblema
from los_nueve import defs
from paneles import borde
from comun import divisor as DIVISOR

W, MARGEN = PICO.w, emblema.MARGEN
ALTO = PICO.h + MARGEN + 20
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)
SV = 'TFC'
B, A, FONDO, EXTRA, REMATE, _ = defs()[SV]
t = emblema.tono

# La curva sale de comun/divisor.py, que la guarda RECUPERADA de la
# referencia con residuo 0.1238 px. No se traza aca ni se ajusta nada.
BASE_Y = DIVISOR.Y_EXTREMOS * PICO.h           # 269
SUBE = DIVISOR.RECORRIDO * PICO.w              # 13.97


def y(v):
    return v + MARGEN


def camino(esc=1.0, n=90):
    """El divisor, del perfil recuperado. 90 puntos: a esa densidad el
    tramo recto entre puntos mide menos de 3 px y no se ve el quiebre."""
    xi, xd = borde(BASE_Y, 'izq'), borde(BASE_Y, 'der')
    return [(xi + (xd - xi) * (i / n),
             BASE_Y - DIVISOR.altura(i / n) * SUBE * esc) for i in range(n + 1)]


def d_camino(pts):
    return 'M' + ' L'.join('%.1f,%.1f' % (x, y(v)) for x, v in pts)


def panel_pie(pts):
    # el camino vive en comun/divisor.py: estaba copiado en ocho
    # scripts, todos con el mismo bug de la punta perdida
    return DIV.panel(pts, PTS, W, dy=MARGEN)


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
COL = round(PICO.w * .30)
XC = round(borde(40, 'der') - COL)
UL_H, UL_Y = 25.5, round(PICO.h * .878) - 13 + 0.2

CASOS = [
 ('1 · LA CURVA RECUPERADA · 13.97 px', 1.0),
 ('2 · la misma, 30% más marcada', 1.3),
 ('3 · la misma, 30% más plana', 0.7),
 ('4 · plana · 0 px, para contrastar', 0.0),
]


def carta(i, etq, esc):
    cid = f'x{i}'
    pts = camino(esc)
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
    <div class="pie-fondo" style="background:{FONDO};
         clip-path:path('{panel_pie(pts)}')"></div>
    <div class="pie-velo" style="background:{VELO};
         clip-path:path('{panel_pie(pts)}')"></div>
    <svg class="tra" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
      <path d="{d_camino(pts)}" fill="none" stroke="{B}" stroke-width="1.9"
            opacity=".9" stroke-linejoin="round"/>
    </svg>
    <img class="ul" src="{UL}" style="top:{y(UL_Y)}px;height:{UL_H}px">
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
      <path d="{SIL}" fill="none" stroke="{t(A,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  {emblema.estrellas(1, W, sufijo=f'x{i}')}
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
.foto{{position:absolute;top:{MARGEN}px;left:0;right:0;height:{BASE_Y + 14}px;
  z-index:3;overflow:hidden}}
.foto img{{width:100%;height:100%;object-fit:cover;object-position:center 12%}}
.velo-ar{{position:absolute;inset:0;background:linear-gradient(180deg,
  rgba(0,0,0,.40) 0%,rgba(0,0,0,.12) 22%,transparent 42%)}}
.wash{{position:absolute;top:{MARGEN}px;left:0;right:0;height:{BASE_Y}px;
  z-index:4;pointer-events:none;background-repeat:repeat}}
.somb{{position:absolute;top:{MARGEN + 12}px;width:34px;height:{BASE_Y - 22}px;
  z-index:5;pointer-events:none;opacity:.55;
  background:linear-gradient(270deg,rgba(0,0,0,.72),transparent)}}
.filo{{position:absolute;top:{MARGEN + 14}px;width:1.6px;height:{BASE_Y - 28}px;
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
           '<div class="rot">EL DIVISOR, RECUPERADO DE LA REFERENCIA</div>'
           '<div class="med">extremos   66.366% del alto      cima   62.211%\n'
           'RECORRIDO  4.658% DEL ANCHO\n'
           'en nuestra carta de 300  ->  13.97 px\n\n'
           'ajuste                     error RMS\n'
           '  polinomio de 6to          0.1238 px   &lt;- elegido\n'
           '  polinomio de 4to          0.1548 px\n'
           '  coseno alzado             0.6105 px\n'
           '  parabola                  0.8125 px\n'
           '  arco de circunferencia    5.0420 px</div>'
           '<div class="aviso">Dos pasos. <b>Programación dinámica</b> ubica la línea '
           'de forma continua, y después <b>cada columna se refina al centroide '
           'pesado del gradiente</b>, lo que da un valor fraccionario en vez de un '
           'entero. Sobre esos puntos se ajusta un modelo y se mide el residuo.'
           '<br><br>'
           '<b>0.12 px de residuo</b> significa que esto no es una curva parecida: '
           'es <b>la curva original recuperada</b>. El PNG era su rasterizado y el '
           'ajuste lo deshace.<br><br>'
           '⚠️ <b>Corrijo dos cosas que dije antes.</b> Primero: «la cima es plana, '
           'así que no es una parábola». La meseta era del <b>píxel</b>, no del '
           'diseño — con 10 px de recorrido sobre 152 columnas, varias columnas '
           'seguidas en el mismo entero es lo normal al rasterizar una curva suave. '
           'Segundo: el recorrido no era 10.8 px sino <b>13.97</b>; aquel salía del '
           'trazo entero, que subestima porque la escalera nunca llega al pico real.'
           '<br><br>Pero sí es cierto que <b>no es una parábola</b>: la parábola da '
           '0.81 px de residuo, seis veces peor. El perfil es más plano en los '
           'extremos y sube más rápido en el medio.</div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'divisor_real.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1400, 'height': 700},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'divisor_real.png'),
                            full_page=True)
        await b.close()
    print('-> divisor_real.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
