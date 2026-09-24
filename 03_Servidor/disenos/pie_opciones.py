"""Que puede ir abajo en la Servidor: tres opciones, y el choque que las separa.

⚠️ ESTA NO ES LA VERSION FINAL. El pie esta a decidir y el LADO DERECHO
SIGUE SIN DECIDIRSE.


LO QUE LLEVAN ABAJO LAS OTRAS
-----------------------------
    Temporada     TAG chico a la izquierda · pastilla al centro · UL a la
                  DERECHA. Los tres EN LA MISMA LINEA, y=383..409.
    Competitiva   fila de circulos (bandera + servidor, con aro que mide y
                  el puesto adentro) y=357 · pastilla de TAG y=398 ·
                  UL AL CENTRO y=429. Un stack de tres pisos.
    REFERENCIA    el panel esta VACIO. Lo unico que lleva es una GEMA
                  hexagonal centrada SOBRE EL BORDE de abajo, apoyada en un
                  galon. y=462 de 485, o sea al 95%.


⚠️ EL CHOQUE: LA GEMA CAE JUSTO DONDE VA EL UL
-----------------------------------------------
La gema de la referencia esta al 95% del alto. Nuestras tres cartas ponen el
UL al 88-92%. En la Servidor el UL va en y=372..392.7 y la gema al 95% caeria
en y~385: ENCIMA. No entran los dos en el mismo lugar, y el UL no se mueve
porque es la marca.

Por eso las tres opciones se diferencian justamente ahi, y no en el adorno.


CUANTO LUGAR HAY, medido
------------------------
    divisor extremos     y 268.8
    nombre               y 265.6 .. 291.2
    LIBRE                y 291.2 .. 372.0   = 80.8 px, ~294 de ancho
    UL                   y 372.0 .. 392.7
    punta                y 392.7 .. 405     = 12.3 px, y se cierra a 0


⚠️ DOS COSAS QUE NO SE PUEDEN PROPONER
--------------------------------------
1. EL CIRCULO DEL SERVIDOR. La Competitiva lo lleva abajo con su aro. Aca el
   servidor YA ES EL EMBLEMA DE ARRIBA: repetirlo abajo es decirlo dos veces
   en la carta que existe para decirlo una vez bien.

2. RACHA Y DUELOS POR SERVIDOR. No existen: rch_act/rch_max son globales y
   duel_real esta en 4 de 138. No es que falten en el JSON, es que ese numero
   no esta calculado en ningun lado. Habria que construirlo en el builder.

Lo que SI existe y es propio de esta carta es pos_sv: que puesto ocupa dentro
de su servidor, 135 de 138.


⚠️ Y LA GEMA DECIDE PARTE DE LA DERECHA
---------------------------------------
La gema estaba descartada porque "el rango ya esta en la columna" — pero la
columna es lo que NO esta decidido. Si el rango baja a la gema, el lado
derecho NO puede volver a mostrarlo. Resolver el pie ya resuelve parte de la
derecha, y conviene saberlo antes de elegir.
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
from comun import emblema, divisor as DIV, nombre as NOM, brillo as BRI
from los_nueve import defs
from paneles import borde
import avatares

W, MARGEN = PICO.w, emblema.MARGEN
ALTO = PICO.h + MARGEN + 20
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)
DEFS = defs()
BASE_Y = DIV.Y_EXTREMOS * PICO.h
SUBE = DIV.RECORRIDO * PICO.w * 1.3
ALTO_FOTO = round(BASE_Y) + 14
PTS = [tuple(float(v) for v in p.split(','))
       for p in re.findall(r'(-?[\d.]+,-?[\d.]+)', PICO.d)]
ZOOM, POS = 115, 0.62
Y_NOMBRE = NOM.Y['servidor']
UL_Y, UL_H = 372, 20.7

# el acento de cada rango, de 02_Competitivo/v2/gencomp.py:19-26. EL RANGO
# SALE DEL SCORE COMPETITIVO Y ES UNO SOLO POR PERSONA: el mismo que muestra
# la Competitiva, no uno nuevo de esta carta.
RANGO = {'SSS': '#C77DFF', 'SS': '#8FE8FF', 'S': '#FFD24A', 'A': '#FF6B7A',
         'B': '#5CE6A5', 'C': '#6B8FE8', 'D': '#D8DEE8', 'E': '#C98A4B'}
_EST = json.load(open(os.path.join(BASE, 'datos', 'estrellas.json'),
                      encoding='utf-8'))['estrellas_por_servidor']

# (nombre, servidor, rango, cc del pais, puesto en el servidor, de cuantos)
GENTE = [('VALEN', 'TFC', 'A', 'ar', 3, 24), ('KONAN', 'TWR', 'SSS', 'ar', 1, 31),
         ('BAU', 'FRZ', 'S', 'cl', 2, 18), ('HUMILDAD', 'DRA', 'B', 'pe', 7, 12),
         ('METEORO', 'SR', 'SS', 'mx', 1, 27), ('KRTMAN', 'RZ', 'C', 'co', 5, 9)]


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


def gema(rg, lado, cy, sufijo, letra=True):
    """La figura del rango: hexagono, color del rango. Es figura Y color."""
    c = RANGO[rg]
    h = lado * 1.10
    return (
      f'<svg class="gema" width="{lado}" height="{h}" viewBox="0 0 100 110" '
      f'style="left:{W/2 - lado/2:.1f}px;top:{cy - h/2:.1f}px">'
      f'<defs><linearGradient id="g{sufijo}" x1="0.1" y1="0" x2="0.9" y2="1">'
      f'<stop offset="0" stop-color="{BRI.encender(c, .55)}"/>'
      f'<stop offset=".5" stop-color="{c}"/>'
      f'<stop offset="1" stop-color="{emblema.tono(c, -.55)}"/>'
      f'</linearGradient></defs>'
      f'<path d="M50 2 L94 27 L94 83 L50 108 L6 83 L6 27 Z" '
      f'fill="url(#g{sufijo})" stroke="rgba(0,0,0,.72)" stroke-width="7" '
      f'paint-order="stroke"/>'
      f'<path d="M50 2 L94 27 L94 83 L50 108 L6 83 L6 27 Z" fill="none" '
      f'stroke="rgba(255,255,255,.55)" stroke-width="3"/>'
      + (f'<text x="50" y="70" text-anchor="middle" font-size="46" '
         f'font-weight="900" font-family="Archivo,sans-serif" '
         f'fill="rgba(0,0,0,.80)">{rg}</text>' if letra else '')
      + '</svg>')


def bandera(cc, x, cy, lado=26):
    return (f'<img class="ban" src="https://flagcdn.com/w80/{cc}.png" '
            f'style="left:{x - lado/2:.1f}px;top:{cy - lado/2:.1f}px;'
            f'width:{lado}px;height:{lado}px">')


def puesto(p, tot, x, cy, acc):
    return (f'<div class="pst" style="left:{x - 30:.1f}px;top:{cy - 13:.1f}px;'
            f'--a:{acc}"><b>{p}º</b><span>de {tot}</span></div>')


def pie_A(i, sv, rg, cc, p, tot, B):
    """Fila de tres en la zona libre. El UL queda donde esta."""
    cy = 331
    return (bandera(cc, 88, cy) + gema(rg, 42, cy, f'a{i}')
            + puesto(p, tot, 212, cy, B))


def pie_B(i, sv, rg, cc, p, tot, B):
    """La gema al filo, como la referencia. Bandera y puesto arriba, UL entre medio."""
    return (bandera(cc, 104, 316) + puesto(p, tot, 196, 316, B)
            + gema(rg, 44, 386, f'b{i}', letra=False))


def pie_C(i, sv, rg, cc, p, tot, B):
    """Solo la gema, grande y centrada. El panel queda limpio como la referencia."""
    return gema(rg, 62, 330, f'c{i}')


PIES = [('A · fila de tres en la zona libre', pie_A,
         'bandera · gema · puesto. El UL queda en y=372. Es el lenguaje de la '
         'Competitiva: un stack de pisos.'),
        ('B · la gema al filo, como la referencia', pie_B,
         'la gema baja al borde y el UL sube a y=345. Es lo que hace la '
         'referencia, pero MUEVE EL UL.'),
        ('C · solo la gema, panel limpio', pie_C,
         'el panel queda vacío salvo la gema, como la referencia. País y '
         'puesto tendrían que ir al lado derecho.')]


def carta(i, opcion):
    etq, fn, _ = PIES[opcion]
    nom, sv, rg, cc, p, tot = GENTE[i]
    cid = f'p{opcion}{i}'
    B, A, FONDO, EXTRA, _, _ = DEFS[sv]
    pts = camino()
    _, av = avatares.para(i + opcion)
    lado = W * ZOOM / 100
    ul_y = 345 if opcion == 1 else UL_Y
    foto = (f'<div class="foto" style="-webkit-mask-image:{M_FOTO};'
            f'mask-image:{M_FOTO}"><img src="{av}" style="width:{lado:.0f}px;'
            f'left:{(W-lado)/2:.1f}px;top:{-(lado-ALTO_FOTO)*POS:.1f}px">'
            f'</div>') if av else ''
    return f"""<div class="col"><div class="et">{nom} · {sv} · rango {rg}</div>
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})">
    <div class="fondo" style="background:{FONDO}"></div>
    {f'<div class="cap" style="{EXTRA}"></div>' if EXTRA else ''}
    {foto}
    {BRI.arriba(A)}
    <div class="pie" style="background:{FONDO};clip-path:path('{panel_pie(pts)}')"></div>
    <div class="pie" style="background:{VELO};clip-path:path('{panel_pie(pts)}')"></div>
    <svg class="tra" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
      <path d="{'M' + ' L'.join('%.2f,%.2f' % (x, y(v)) for x, v in pts)}"
            fill="none" stroke="{B}" stroke-width="1.9" opacity=".9"
            stroke-linejoin="round"/>
    </svg>
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
    </g>
  </svg>
  <div class="nom" style="font-size:{NOM.rem(nom, 1.6)}rem">{nom}</div>
  <div class="zona">{fn(i, sv, rg, cc, p, tot, B)}</div>
  <img class="ul" src="{UL}" style="top:{y(ul_y):.1f}px">
  {emblema.estrellas(int(_EST.get(sv, 0)), W, sufijo=cid)}
  {emblema.pieza(sv, A, B, b64(os.path.join(BASE, 'comun', 'escudos_cuad',
                                            f'sv_{sv.lower()}.png')))}
</div></div>"""


M_FOTO = ('linear-gradient(180deg,#000 0%,#000 72%,rgba(0,0,0,.5) 92%,'
          'transparent 100%)')
VELO = 'linear-gradient(180deg,rgba(0,0,0,.30),rgba(0,0,0,.64))'
UL = b64(os.path.join(BASE, '01_Temporada', 'ul_blanco.png'))

CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:30px;flex-wrap:wrap;align-items:flex-start;margin-bottom:8px}}
.col{{text-align:center;width:{W}px}}
.et{{color:#EDEDF5;font-size:12px;font-weight:800;letter-spacing:1px;
  margin-bottom:12px}}
.rot{{color:#EDEDF5;font-size:16px;font-weight:700;letter-spacing:1.4px;margin:6px 0 8px}}
.op{{color:#FFF;font-size:14.5px;font-weight:800;letter-spacing:.8px;
  margin:26px 0 4px;border-top:1px solid #23232E;padding-top:18px}}
.opd{{color:#8A8AA0;font-size:12.5px;margin:0 0 16px;line-height:1.5}}
.aviso{{color:#8A8AA0;font-size:12.5px;margin:0 0 14px;max-width:1290px;line-height:1.55}}
.med{{color:#8A8AA0;font-size:12px;font-family:ui-monospace,monospace;
  white-space:pre;line-height:1.5;margin:0 0 10px}}
.wrap{{position:relative;width:{W}px;height:{ALTO}px}}
.defs{{position:absolute}}
.cuerpo{{position:absolute;inset:0;filter:drop-shadow(0 12px 26px rgba(0,0,0,.72))}}
.borde{{position:absolute;inset:0;pointer-events:none}}
.fondo{{position:absolute;inset:0}}
.cap{{position:absolute;inset:0;background-repeat:repeat}}
.foto{{position:absolute;top:{MARGEN}px;left:0;width:{W}px;height:{ALTO_FOTO}px;
  overflow:hidden}}
.foto img{{position:absolute;height:auto;display:block}}
{BRI.css('luz', MARGEN, PICO.h)}
.pie{{position:absolute;inset:0;background-repeat:repeat}}
.tra{{position:absolute;inset:0;pointer-events:none}}
.nom{{position:absolute;left:0;right:0;top:{y(Y_NOMBRE)-16}px;text-align:center;
  z-index:9;font-family:'Archivo','LigaEmoji',sans-serif;font-weight:900;color:#fff;
  line-height:1;text-shadow:0 2px 6px rgba(0,0,0,.85)}}
.zona{{position:absolute;left:0;top:{MARGEN}px;width:{W}px;height:{PICO.h}px;z-index:9}}
.gema{{position:absolute;filter:drop-shadow(0 3px 8px rgba(0,0,0,.8))}}
.ban{{position:absolute;border-radius:50%;object-fit:cover;z-index:9;
  box-shadow:0 2px 7px rgba(0,0,0,.8),0 0 0 1.5px rgba(255,255,255,.45)}}
.pst{{position:absolute;width:60px;text-align:center;color:#fff;
  font-family:'Archivo','LigaEmoji',sans-serif;line-height:1;
  text-shadow:0 2px 5px rgba(0,0,0,.9)}}
.pst b{{display:block;font-size:1.06rem;font-weight:900;color:var(--a)}}
.pst span{{display:block;font-size:.50rem;font-weight:700;letter-spacing:.7px;
  opacity:.78;margin-top:3px}}
.ul{{position:absolute;left:50%;transform:translateX(-50%);height:{UL_H}px;
  width:auto;z-index:9}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    med = ('LO QUE LLEVA ABAJO CADA CARTA\n'
           '  Temporada     TAG izq · pastilla centro · UL DERECHA   '
           'los tres en la MISMA LINEA, y=383..409\n'
           '  Competitiva   circulos y=357 · pastilla y=398 · UL CENTRO y=429'
           '   un stack de tres pisos\n'
           '  REFERENCIA    panel VACIO. Solo una GEMA hexagonal sobre el '
           'BORDE, y=462 de 485 (95%)\n\n'
           'LA SERVIDOR, CUANTO LUGAR HAY\n'
           '  nombre        y 265.6 .. 291.2\n'
           '  LIBRE         y 291.2 .. 372.0   = 80.8 px, ~294 de ancho\n'
           '  UL            y 372.0 .. 392.7\n'
           '  punta         y 392.7 .. 405     = 12.3 px, y se cierra a 0')
    aviso = (
        '⚠️ <b>El choque: la gema de la referencia cae justo donde va el UL.</b> '
        'La referencia la pone al <b>95%</b> del alto; nuestras tres cartas '
        'ponen el UL al <b>88–92%</b>. En la Servidor el UL va en y=372..392.7 '
        'y la gema al 95% caería en y≈385: <b>encima</b>. Por eso las tres '
        'opciones se diferencian ahí y no en el adorno.<br><br>'
        '⚠️ <b>Dos cosas no se pueden proponer.</b> <b>(1)</b> El círculo del '
        '<b>servidor</b>: la Competitiva lo lleva abajo con su aro, pero acá el '
        'servidor <b>ya es el emblema de arriba</b> — repetirlo es decirlo dos '
        'veces en la carta que existe para decirlo una vez bien. <b>(2)</b> '
        '<b>Racha y duelos por servidor no existen</b>: <code>rch_act</code> y '
        '<code>rch_max</code> son globales y <code>duel_real</code> está en '
        '<b>4 de 138</b>. No faltan en el JSON: ese número <b>no está calculado '
        'en ningún lado</b>.<br><br>'
        'Lo que sí existe y es propio de esta carta es <b>pos_sv</b> — qué '
        'puesto ocupa dentro de su servidor, <b>135 de 138</b>. Por eso va en '
        'las tres opciones.<br><br>'
        '⚠️ <b>Y la gema decide parte de la derecha.</b> Estaba descartada '
        'porque «el rango ya está en la columna», pero la columna es lo que '
        '<b>no está decidido</b>. Si el rango baja a la gema, el lado derecho '
        '<b>no puede volver a mostrarlo</b>. Resolver el pie ya resuelve parte '
        'de la derecha.<br><br>'
        'El color de la gema es el <b>mismo acento de rango de la '
        'Competitiva</b>, no uno nuevo: el rango sale del Score y es <b>uno '
        'solo por persona</b> en todas sus cartas.')
    partes = []
    for o, (etq, _fn, desc) in enumerate(PIES):
        cuerpo = ''.join(carta(i, o) for i in range(o * 2, o * 2 + 2))
        partes.append(f'<div class="op">{etq}</div>'
                      f'<div class="opd">{desc}</div>'
                      f'<div class="fila">{cuerpo}</div>')
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">QUÉ PUEDE IR ABAJO EN LA SERVIDOR</div>'
           '<div class="aviso">' + aviso + '</div>'
           '<div class="med">' + med + '</div>'
           + ''.join(partes) + '</body></html>')
    out = os.path.join(SCR, 'pie_opciones.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1000, 'height': 1000},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(3000)
        await pg.screenshot(path=os.path.join(SCR, 'pie_opciones.png'),
                            full_page=True)
        await b.close()
    print('-> pie_opciones.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
