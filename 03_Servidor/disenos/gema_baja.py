"""La gema espejando al emblema, y adonde se muda el UL.

DOS CAMBIOS:

1. LA GEMA BAJA HASTA LA PUNTA. Antes la puse dentro del panel del pie, como
   un adorno mas. Va como el emblema de arriba: apoyada en la punta, mitad
   adentro y mitad afuera. Medido para que sea el mismo gesto:

       emblema   centro 10 px por DENTRO del pico, sobresale 24 px arriba
       gema      centro 10 px por DENTRO de la punta, sobresale abajo

   ⚠️ La diferencia es que arriba el pico es ACHATADO —41.6 px planos— y
   abajo la carta cierra en VERTICE. Asi que la gema apoya sobre casi nada:
   su mitad de arriba pisa la merma y el resto cuelga. Por eso se prueban
   tres alturas en vez de calcular una sola: el espejo exacto no da lo mismo
   cuando las dos puntas no son iguales.

2. LA GEMA VA VACIA. Su contenido esta por definirse y NO es el UL.

3. ENTONCES HAY QUE MUDAR EL UL. Es la marca paraguas y va en las tres
   cartas, asi que no se puede sacar: hay que darle otro lugar. Las tres
   ultimas prueban tres.

⚠️ Y ahora la carta tiene DOS piezas colgando fuera del recorte, arriba y
abajo. Eso vuelve a agrandar el calculo de union al exportar el PNG, que ya
estaba pendiente desde que el escudo se fue a la punta.
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
EXTRA_AB = 34                       # aire abajo, para que la gema no se corte
ALTO = PICO.h + MARGEN + EXTRA_AB
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)
SV = 'TFC'
B, A, FONDO, EXTRA, REMATE, _ = defs()[SV]
t = emblema.tono

PIE = round(PICO.h * .78)
COL = round(PICO.w * .22)
FLECHA = 28
PTS = [tuple(float(v) for v in p.split(','))
       for p in re.findall(r'(-?[\d.]+,-?[\d.]+)', PICO.d)]
PUNTA = MARGEN + PICO.h             # la punta de abajo, en el lienzo


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
M_FOTO = ('linear-gradient(180deg,#000 0%,#000 66%,rgba(0,0,0,.5) 86%,'
          'transparent 100%)')
HEX = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'

# (etiqueta, lado de la gema, cuanto sobresale abajo, donde va el UL)
CASOS = [
 ('1 · gema apoyada · sobresale 18 px', 48, 18, None),
 ('2 · gema apoyada · sobresale 24 px, como el emblema', 48, 24, None),
 ('3 · gema más grande · sobresale 24 px', 58, 24, None),
 ('4 · UL sobre la curva, centrado', 48, 24, 'curva'),
 ('5 · UL al pie de la columna', 48, 24, 'columna'),
 ('6 · UL chico a la izquierda del panel', 48, 24, 'izq'),
]

UBIC = {
 'curva': f'left:50%;top:{y(PIE) - 34}px;transform:translateX(-50%);height:17px',
 'columna': f'right:26px;top:{y(PIE) - 44}px;height:19px',
 'izq': f'left:26px;top:{y(PIE) + 16}px;height:18px',
}


def carta(i, etq, lado, sale, ul_donde):
    cid = f'b{i}'
    cy = PUNTA + sale - lado / 2
    ul = (f'<img class="ul" src="{UL}" style="{UBIC[ul_donde]}">'
          if ul_donde else '')
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
    {ul}
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
      <path d="{SIL}" fill="none" stroke="{t(A,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  <div class="gema-aro" style="width:{lado+5}px;height:{lado+5}px;
       top:{cy - (lado+5)/2}px;clip-path:{HEX};background:{B}"></div>
  <div class="gema" style="width:{lado}px;height:{lado}px;top:{cy - lado/2}px;
       clip-path:{HEX};background:linear-gradient(158deg,{t(A,.24)},
       {t(A,-.66)})"></div>
  {emblema.estrellas(1, W, sufijo=f'b{i}')}
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
.foto{{position:absolute;top:{MARGEN}px;left:0;right:0;height:{PIE + 10}px;
  z-index:3;overflow:hidden}}
.foto img{{width:100%;height:100%;object-fit:cover;object-position:center 12%}}
.velo-ar{{position:absolute;inset:0;background:linear-gradient(180deg,
  rgba(0,0,0,.40) 0%,rgba(0,0,0,.12) 22%,transparent 42%)}}
.wash{{position:absolute;top:{MARGEN}px;left:0;right:0;height:{PIE}px;
  z-index:4;pointer-events:none;background-repeat:repeat}}
.pie-fondo,.pie-velo{{position:absolute;inset:0;z-index:4;
  pointer-events:none;background-repeat:repeat}}
.pie-velo{{z-index:5}}
.tra{{position:absolute;inset:0;z-index:6;pointer-events:none}}
.ul{{position:absolute;z-index:7;width:auto;opacity:.94;
  filter:drop-shadow(0 2px 5px rgba(0,0,0,.95))}}
.gema-aro{{position:absolute;left:50%;transform:translateX(-50%);z-index:8;
  filter:drop-shadow(0 4px 12px rgba(0,0,0,.85))}}
.gema{{position:absolute;left:50%;transform:translateX(-50%);z-index:9}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    cuerpo = ''.join(carta(i, *c) for i, c in enumerate(CASOS))
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">LA GEMA EN LA PUNTA · Y ADÓNDE SE MUDA EL UL</div>'
           '<div class="aviso"><b>La gema baja hasta la punta</b>, apoyada como el '
           'emblema de arriba: mitad adentro, mitad afuera.<br><br>'
           '⚠️ Pero el espejo exacto no da lo mismo, porque <b>las dos puntas no son '
           'iguales</b>: arriba el pico es achatado —41.6 px planos— y abajo la '
           'carta cierra en vértice. La gema apoya sobre casi nada. Por eso van tres '
           'alturas en vez de un número calculado.<br><br>'
           '<b>La gema va vacía</b>: su contenido está por definirse y no es el UL.'
           '<br><br><b>Entonces hay que mudar el UL.</b> Es la marca paraguas y va '
           'en las tres cartas, así que no se puede sacar. Las tres últimas prueban '
           'tres lugares.<br><br>'
           '⚠️ Y ahora la carta tiene <b>dos piezas colgando fuera del recorte</b>, '
           'arriba y abajo. Eso vuelve a agrandar el cálculo de unión al exportar el '
           'PNG, que ya estaba pendiente.</div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'gema_baja.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1060, 'height': 1000},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'gema_baja.png'), full_page=True)
        await b.close()
    print('-> gema_baja.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
