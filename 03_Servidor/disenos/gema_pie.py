"""La curva marcada, la foto sin contorno, y la gema del pie.

TRES COSAS DE ESTA VUELTA:

1. CURVA MARCADA, la 4: sube 28 px en el centro.

2. LA FOTO NO LLEVA CONTORNO y ademas SUBE HASTA EL TOPE, para pasar por
   DEBAJO del emblema. Antes arrancaba en y=32 y el emblema quedaba flotando
   sobre el fondo; ahora la foto llega al borde de arriba y el emblema se
   apoya sobre ella. Es lo mismo que hace la referencia con su gema y su
   escudo: las piezas se apoyan sobre la imagen, no al lado.

   ⚠️ Ojo con el orden: la foto tiene que ir DEBAJO del wash de la columna,
   porque si no, el numero queda sobre el avatar en vez de sobre el material
   de la carta, que es justo lo que .c-colwash vino a resolver.

3. LA GEMA DEL PIE, que es lo que tienen abajo las seis referencias: un
   hexagono centrado, apoyado en el borde, mitad adentro y mitad afuera.

   Aca lleva el UL adentro. El UL ya vivia en el pie, asi que la gema no
   agrega una pieza nueva: le da forma a la que ya estaba. Si en cambio se
   pusieran las dos —gema Y UL suelto— serian dos remates peleando por el
   mismo lugar, que es lo que ya paso con las tres lineas de DRA.
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

PIE = round(PICO.h * .78)      # 316
COL = round(PICO.w * .22)      # 66
FLECHA = 28                    # la curva marcada
PTS = [tuple(float(v) for v in p.split(','))
       for p in re.findall(r'(-?[\d.]+,-?[\d.]+)', PICO.d)]


def y(v):
    return v + MARGEN


def panel_pie():
    xi, xd = borde(PIE, 'izq'), borde(PIE, 'der')
    cx = (xi + xd) / 2
    d = ['M%.1f,%.1f' % (xi, y(PIE)),
         'Q%.1f,%.1f %.1f,%.1f' % (cx, y(PIE - FLECHA * 2), xd, y(PIE))]
    for x, v in sorted([p for p in PTS if p[0] > 150 and p[1] > PIE],
                       key=lambda p: p[1]):
        d.append('L%.1f,%.1f' % (x, y(v)))
    for x, v in sorted([p for p in PTS if p[0] < 150 and p[1] > PIE],
                       key=lambda p: p[1], reverse=True):
        d.append('L%.1f,%.1f' % (x, y(v)))
    return ' '.join(d) + ' Z'


def divisor():
    xi, xd = borde(PIE, 'izq'), borde(PIE, 'der')
    cx = (xi + xd) / 2
    return ('M%.1f,%.1f Q%.1f,%.1f %.1f,%.1f'
            % (xi, y(PIE), cx, y(PIE - FLECHA * 2), xd, y(PIE)))


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


UL = b64(os.path.join(BASE, '02_Competitivo', 'ul_blanco.png'))
FOTO = b64(os.path.join(SCR, 'av_valen.png'))
ESC = b64(os.path.join(BASE, 'comun', 'escudos_cuad', f'sv_{SV.lower()}.png'))

WASH = ('linear-gradient(270deg,#000 0%,#000 13%,rgba(0,0,0,0.5) 25%,'
        'transparent 43%)')
VELO = 'linear-gradient(180deg,rgba(0,0,0,.28),rgba(0,0,0,.62))'
# la foto se apaga contra la curva
M_FOTO = ('linear-gradient(180deg,#000 0%,#000 66%,rgba(0,0,0,.5) 86%,'
          'transparent 100%)')
HEX = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'

# (etiqueta, lado de la gema, cy de la gema, con UL adentro)
CASOS = [
 ('1 · sin gema · para comparar', 0, 0, False),
 ('2 · gema chica en el borde de abajo', 38, 372, True),
 ('3 · gema media', 46, 368, True),
 ('4 · gema grande', 54, 364, True),
 ('5 · gema media, más metida', 46, 356, True),
 ('6 · gema media, vacía · el UL suelto abajo', 46, 368, False),
]


def carta(i, etq, lado, cy, con_ul):
    cid = f'g{i}'
    gema = ''
    if lado:
        dentro = (f'<img src="{UL}">' if con_ul else '')
        gema = (f'<div class="gema" style="width:{lado}px;height:{lado}px;'
                f'top:{y(cy) - lado/2}px;clip-path:{HEX};'
                f'background:{t(A,-.60)}">{dentro}</div>'
                f'<div class="gema-aro" style="width:{lado+5}px;height:{lado+5}px;'
                f'top:{y(cy) - (lado+5)/2}px;clip-path:{HEX};background:{B}"></div>')
    ul_suelto = (f'<img class="ul" src="{UL}">'
                 if (not lado or not con_ul) else '')
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
    <div class="pie-fondo" style="background:{FONDO};
         clip-path:path('{panel_pie()}')"></div>
    <div class="pie-velo" style="background:{VELO};
         clip-path:path('{panel_pie()}')"></div>
    <svg class="tra" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
      <path d="{divisor()}" fill="none" stroke="{B}" stroke-width="1.8"
            opacity=".85"/>
    </svg>
    {ul_suelto}
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
      <path d="{SIL}" fill="none" stroke="{t(A,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  {gema}
  {emblema.estrellas(1, W, sufijo=f'g{i}')}
  {emblema.pieza(SV, A, B, ESC)}
</div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:34px;flex-wrap:wrap;align-items:flex-start}}
.col{{text-align:center;width:{W}px;margin-bottom:28px}}
.et{{color:#EDEDF5;font-size:12.5px;font-weight:800;letter-spacing:1.1px;
  margin-bottom:16px;min-height:30px}}
.rot{{color:#EDEDF5;font-size:16px;font-weight:700;letter-spacing:1.4px;margin:6px 0 8px}}
.aviso{{color:#8A8AA0;font-size:12.5px;margin:0 0 22px;max-width:1010px;line-height:1.55}}
.wrap{{position:relative;width:{W}px;height:{ALTO}px}}
.defs{{position:absolute}}
.cuerpo{{position:absolute;inset:0;filter:drop-shadow(0 12px 26px rgba(0,0,0,.72))}}
.borde{{position:absolute;inset:0;pointer-events:none}}
.fondo{{position:absolute;inset:0;z-index:0}}
.cap{{position:absolute;inset:0;z-index:1;background-repeat:repeat}}
.rem{{position:absolute;inset:0;z-index:2}}
/* LA FOTO SUBE HASTA EL TOPE, para pasar por debajo del emblema */
.foto{{position:absolute;top:{MARGEN}px;left:0;right:0;height:{PIE + 10}px;
  z-index:3;overflow:hidden}}
.foto img{{width:100%;height:100%;object-fit:cover;object-position:center 12%}}
.velo-ar{{position:absolute;inset:0;background:linear-gradient(180deg,
  rgba(0,0,0,.40) 0%,rgba(0,0,0,.12) 22%,transparent 42%)}}
/* el wash va ENCIMA de la foto: el numero sobre el material, no sobre el avatar */
.wash{{position:absolute;top:{MARGEN}px;left:0;right:0;height:{PIE}px;
  z-index:4;pointer-events:none;background-repeat:repeat}}
.pie-fondo,.pie-velo{{position:absolute;inset:0;z-index:4;
  pointer-events:none;background-repeat:repeat}}
.pie-velo{{z-index:5}}
.tra{{position:absolute;inset:0;z-index:6;pointer-events:none}}
.ul{{position:absolute;left:50%;top:{y(352)}px;transform:translateX(-50%);
  z-index:7;height:20.7px;width:auto;opacity:.94;
  filter:drop-shadow(0 2px 5px rgba(0,0,0,.95))}}
/* LA GEMA DEL PIE: apoyada en el borde, mitad adentro y mitad afuera */
.gema-aro{{position:absolute;left:50%;transform:translateX(-50%);z-index:8;
  filter:drop-shadow(0 4px 12px rgba(0,0,0,.85))}}
.gema{{position:absolute;left:50%;transform:translateX(-50%);z-index:9;
  display:flex;align-items:center;justify-content:center}}
.gema img{{width:52%;height:auto;opacity:.96}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    cuerpo = ''.join(carta(i, *c) for i, c in enumerate(CASOS))
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">CURVA MARCADA · FOTO SIN CONTORNO · GEMA AL PIE</div>'
           '<div class="aviso"><b>La foto ya no lleva contorno</b> y <b>sube hasta '
           'el tope</b>, así que pasa por debajo del emblema: antes el emblema '
           'flotaba sobre el fondo, ahora se apoya sobre la imagen.<br><br>'
           '⚠️ Va debajo del wash de la columna a propósito. Si fuera al revés, el '
           'número quedaría sobre el avatar en vez de sobre el material de la carta '
           '— que es justo lo que <code>.c-colwash</code> vino a resolver.<br><br>'
           '<b>Y la gema del pie</b>, que es lo que tienen abajo las seis '
           'referencias: un hexágono centrado, apoyado en el borde, mitad adentro y '
           'mitad afuera. Lleva el <b>UL adentro</b>: el UL ya vivía en el pie, así '
           'que la gema no agrega una pieza, le da forma a la que ya estaba. Poner '
           'las dos serían dos remates peleando por el mismo lugar. La 6 las tiene '
           'separadas para que se vea.</div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'gema_pie.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1060, 'height': 1000},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'gema_pie.png'), full_page=True)
        await b.close()
    print('-> gema_pie.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
