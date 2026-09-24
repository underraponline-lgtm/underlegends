"""Donde va el nombre, y que entra de verdad en la columna.

⚠️ DOS DE LOS CUATRO DATOS QUE PIDIO DLX NO EXISTEN HOY. Verificado en el
pool, no supuesto:

    puesto en el servidor   pos_sv        135 de 138   EXISTE
    racha en el servidor    NO EXISTE. Hay racha global —rch_max en 118 de
                            138— pero rch_act solo en 42, y ninguna esta
                            partida por servidor.
    duelos en el servidor   NO EXISTE. duel_real esta en 4 de 138, y
                            tambien es global.

Las dos habria que calcularlas en el builder desde el Sheet, y los duelos ni
siquiera existen globalmente para 134 personas. Puestos hoy, serian celdas
vacias en casi todas las cartas. Por eso la columna de esta hoja lleva lo
que SI existe.

⚠️ Y EL NOMBRE NO SE PUEDE MEDIR DE LA REFERENCIA. Los seis archivos de
estructura son FONDOS SIN TEXTO: no hay nombre que trazar. Lo unico medible
es el panel donde iria. Asi que aca no hay un numero sacado del original,
hay opciones sobre la geometria que si esta medida:

    el panel del pie   de y=251 a y=404
    su centroide       y=329.9
    el UL              y=372, alto 20.7
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

W, MARGEN = PICO.w, emblema.MARGEN
ALTO = PICO.h + MARGEN + 20
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)
SV = 'TFC'
B, A, FONDO, EXTRA, REMATE, _ = defs()[SV]
t = emblema.tono

BASE_Y = DIV.Y_EXTREMOS * PICO.h
SUBE = DIV.RECORRIDO * PICO.w * 1.3
COL_FRAC, VERT_DESDE = 0.344, 0.440 * PICO.h
UL_Y, UL_H = 372, 20.7
PTS = [tuple(float(v) for v in p.split(','))
       for p in re.findall(r'(-?[\d.]+,-?[\d.]+)', PICO.d)]


def y(v):
    return v + MARGEN


def camino(n=90):
    xi, xd = borde(BASE_Y, 'izq'), borde(BASE_Y, 'der')
    return [(xi + (xd - xi) * (i / n), BASE_Y - DIV.altura(i / n) * SUBE)
            for i in range(n + 1)]


def d_camino(pts):
    return 'M' + ' L'.join('%.2f,%.2f' % (x, y(v)) for x, v in pts)


def panel_pie(pts):
    # el camino vive en comun/divisor.py: estaba copiado en ocho
    # scripts, todos con el mismo bug de la punta perdida
    return DIV.panel(pts, PTS, W, dy=MARGEN)


XV = borde(BASE_Y, 'der') - COL_FRAC * (borde(BASE_Y, 'der') - borde(BASE_Y, 'izq'))


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


UL = b64(os.path.join(BASE, '02_Competitivo', 'ul_blanco.png'))
FOTO = b64(os.path.join(SCR, 'av_valen.png'))
ESC = b64(os.path.join(BASE, 'comun', 'escudos_cuad', f'sv_{SV.lower()}.png'))
BAN = 'https://flagcdn.com/w80/ar.png'
VELO = 'linear-gradient(180deg,rgba(0,0,0,.30),rgba(0,0,0,.64))'
M_FOTO = ('linear-gradient(180deg,#000 0%,#000 72%,rgba(0,0,0,.5) 92%,'
          'transparent 100%)')
WASH = ('linear-gradient(270deg,#000 0%,#000 10%,rgba(0,0,0,0.5) 19%,'
        'transparent 30%)')

# lo que SI existe, para la columna
COLU = (f'<div class="num">81</div><div class="rng">S</div>'
        f'<img class="ban" src="{BAN}">'
        f'<div class="mini"><b>3º</b><u>EN TFC</u></div>'
        f'<div class="mini"><b>#2</b><u>COMP</u></div>')

# (etiqueta, y del nombre, tamaño, alineacion)
CASOS = [
 ('1 · justo debajo de la curva · y=272', 272, 1.5, 'centro'),
 ('2 · centroide del panel · y=306', 306, 1.6, 'centro'),
 ('3 · más abajo, sobre el UL · y=336', 336, 1.5, 'centro'),
 ('4 · debajo de la curva, más grande · y=276', 276, 1.9, 'centro'),
 ('5 · alineado a la izquierda · y=280', 280, 1.6, 'izq'),
 ('6 · arriba de la curva, sobre la foto · y=246', 246, 1.6, 'centro'),
]


def carta(i, etq, ny, tam, ali):
    cid = f'n{i}'
    pts = camino()
    est = (f'top:{y(ny) - tam*10:.0f}px;font-size:{tam}rem;'
           + ('left:26px;right:auto;text-align:left'
              if ali == 'izq' else 'left:0;right:0;text-align:center'))
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
    <div class="somb" style="left:{XV - 34:.0f}px"></div>
    <div class="pie-fondo" style="background:{FONDO};
         clip-path:path('{panel_pie(pts)}')"></div>
    <div class="pie-velo" style="background:{VELO};
         clip-path:path('{panel_pie(pts)}')"></div>
    <svg class="tra" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
      <path d="{d_camino(pts)}" fill="none" stroke="{B}" stroke-width="1.9"
            opacity=".9" stroke-linejoin="round"/>
      <line x1="{XV:.1f}" y1="{y(VERT_DESDE):.1f}" x2="{XV:.1f}"
            y2="{y(BASE_Y - SUBE*0.55):.1f}" stroke="{B}" stroke-width="1.7"
            opacity=".8"/>
    </svg>
    <div class="colu">{COLU}</div>
    <div class="nom" style="{est}">VALEN</div>
    <img class="ul" src="{UL}" style="top:{y(UL_Y) - UL_H/2:.1f}px;
         height:{UL_H}px">
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
      <path d="{SIL}" fill="none" stroke="{t(A,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  {emblema.estrellas(1, W, sufijo=f'n{i}')}
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
.foto{{position:absolute;top:{MARGEN}px;left:0;right:0;height:{round(BASE_Y)+14}px;
  z-index:3;overflow:hidden}}
.foto img{{width:100%;height:100%;object-fit:cover;object-position:center 12%}}
.velo-ar{{position:absolute;inset:0;background:linear-gradient(180deg,
  rgba(0,0,0,.40) 0%,rgba(0,0,0,.12) 22%,transparent 42%)}}
.wash{{position:absolute;top:{MARGEN}px;left:0;right:0;height:{round(BASE_Y)}px;
  z-index:4;pointer-events:none;background-repeat:repeat}}
.somb{{position:absolute;top:{MARGEN+round(VERT_DESDE)}px;width:34px;
  height:{round(BASE_Y-VERT_DESDE)}px;z-index:5;pointer-events:none;opacity:.55;
  background:linear-gradient(270deg,rgba(0,0,0,.72),transparent)}}
.pie-fondo,.pie-velo{{position:absolute;inset:0;z-index:6;
  pointer-events:none;background-repeat:repeat}}
.pie-velo{{z-index:7}}
.tra{{position:absolute;inset:0;z-index:8;pointer-events:none}}
.colu{{position:absolute;top:{MARGEN+28}px;right:14px;width:70px;z-index:9;
  display:flex;flex-direction:column;align-items:center;gap:6px}}
.num{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:2.2rem;font-weight:900;
  color:#fff;line-height:.9;text-shadow:0 2px 6px rgba(0,0,0,.85)}}
.rng{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:.84rem;font-weight:900;
  color:{B};line-height:1;text-shadow:0 1px 3px rgba(0,0,0,.85)}}
.ban{{width:27px;height:20px;border-radius:3px;object-fit:cover;margin-top:4px;
  box-shadow:0 2px 5px rgba(0,0,0,.7),0 0 0 1.5px rgba(255,255,255,.7)}}
.mini{{display:flex;flex-direction:column;align-items:center;line-height:1}}
.mini b{{font-family:'Barlow Condensed','LigaEmoji',sans-serif;font-size:.94rem;
  font-weight:700;color:#fff;text-shadow:0 2px 4px rgba(0,0,0,.85)}}
.mini u{{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-size:.29rem;
  font-weight:900;letter-spacing:.6px;color:#fff;opacity:.74}}
.nom{{position:absolute;z-index:9;font-family:'Archivo','LigaEmoji',sans-serif;
  font-weight:900;color:#fff;line-height:1;
  text-shadow:0 2px 6px rgba(0,0,0,.85)}}
.ul{{position:absolute;left:50%;transform:translateX(-50%);z-index:9;
  width:auto;opacity:.94;filter:drop-shadow(0 2px 5px rgba(0,0,0,.95))}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    cuerpo = ''.join(carta(i, *c) for i, c in enumerate(CASOS))
    med = ('VERIFICADO EN EL POOL, no supuesto:\n\n'
           '  puesto en el servidor   pos_sv       135 de 138   EXISTE\n'
           '  racha en el servidor    NO EXISTE\n'
           '     hay racha global: rch_max 118 de 138, rch_act solo 42\n'
           '  duelos en el servidor   NO EXISTE\n'
           '     duel_real esta en 4 de 138, y tambien es global')
    aviso = (
        '⚠️ <b>Dos de los cuatro datos que pediste no existen hoy.</b> Habría que '
        'calcularlos en el builder desde el Sheet, y los duelos ni siquiera '
        'existen globalmente para 134 personas. Puestos ahora serían celdas '
        'vacías en casi todas las cartas, así que la columna lleva lo que sí '
        'hay: número, rango, bandera, puesto en el servidor y #COMP.<br><br>'
        '⚠️ <b>Y el nombre no se puede medir de la referencia:</b> los seis '
        'archivos de estructura son <b>fondos sin texto</b>. Lo único medible es '
        'el panel donde iría —de y=251 a y=404, centroide en 329.9— así que acá '
        'no hay un número sacado del original: hay opciones sobre esa geometría. '
        'La 6 lo pone <b>arriba</b> de la curva, sobre la foto, que es lo que '
        'hacía la carta vieja.')
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">DÓNDE VA EL NOMBRE · Y QUÉ ENTRA EN LA COLUMNA</div>'
           '<div class="med">' + med + '</div>'
           '<div class="aviso">' + aviso + '</div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'nombre_columna.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1060, 'height': 1000},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'nombre_columna.png'),
                            full_page=True)
        await b.close()
    print('-> nombre_columna.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
