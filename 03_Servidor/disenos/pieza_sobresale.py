"""LA PIEZA SOBRESALIENDO por la punta, con la estrella afuera.

La pieza va centrada en la punta pero corrida un poco hacia abajo, lo justo
para que la estrella apoye encima de ella y sobresalga de la carta. La
estrella NO va contenida en nada: la sostiene la pieza, no el recorte.

    margen arriba   62 px   (el aire donde viven la pieza y la estrella)
    pieza           68 px, centro 10 px por debajo del pico
                    -> sobresale 24 px de la carta
    estrella        26 px, apoyada sobre la pieza, entera afuera

DOS CONSECUENCIAS QUE NO SE VEN EN LA HOJA
------------------------------------------
1. LA EXPORTACION CAMBIA. Hasta hoy la Servidor era el caso facil: su
   clip-path recortaba a todos los hijos, asi que alcanzaba con capturar el
   elemento. Con la pieza y la estrella FUERA del recorte eso deja de valer,
   y pasa a necesitar el calculo de union con lo que sobresale, que era
   exclusivo de la Competitiva. Esta escrito al reves en CLAUDE.md.

2. EL FONDO NO SE CONTROLA. La carta se exporta en PNG transparente y cae
   en Discord sobre fondos que no elegimos. Lo que sobresale ya no tiene
   carta atras que lo sostenga: se apoya en lo que haya. Por eso al final
   de la hoja van los mismos nueve sobre BLANCO, que es el caso peor.
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
from los_nueve import defs, ORDEN

W = PICO.w
MARGEN = 62                 # aire arriba para la pieza y la estrella
ALTO = PICO.h + MARGEN


def mover(d, dy):
    """Baja un path sumandole dy a cada Y. Todos los pares vienen 'x,y'."""
    return re.sub(r'(-?[\d.]+),(-?[\d.]+)',
                  lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + dy), d)


# ⚠️ El path se mueve UNA sola vez y se usa igual en el recorte y en el
# borde. Antes el desplazamiento estaba puesto dos veces —transform en el
# <clipPath> y otro transform en el <g> del borde— y eso no resuelve igual
# en los dos lados: el clip-path de un <g> se evalua en el espacio que deja
# su propio transform, asi que el recorte terminaba corrido respecto del
# trazo y el borde salia cortado a los costados. Con el path ya movido no
# queda ningun transform y no hay nada que interpretar.
D = mover(PICO.d, MARGEN)

LADO = 68                   # la pieza
BAJA = 10                   # cuanto se corre por debajo del pico
CY = MARGEN + BAJA          # centro de la pieza en el lienzo
E = 26                      # la estrella, grande

D9 = defs()
EST = json.load(open(os.path.join(BASE, 'datos', 'estrellas.json'),
                     encoding='utf-8'))['estrellas_por_servidor']


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


UL = b64(os.path.join(BASE, '02_Competitivo', 'ul_blanco.png'))


def esc(sv): return b64(os.path.join(BASE, 'comun', 'escudos_cuad',
                                     f'sv_{sv.lower()}.png'))


def t(c, f):
    h = c.lstrip('#'); r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    if f >= 0: r, g, b = (int(x + (255-x)*f) for x in (r, g, b))
    else:      r, g, b = (int(x*(1+f)) for x in (r, g, b))
    return '#%02X%02X%02X' % (r, g, b)


ESTRELLA = ('M12 2 L14.9 8.9 L22.4 9.5 L16.7 14.4 L18.4 21.7 L12 17.8 '
            'L5.6 21.7 L7.3 14.4 L1.6 9.5 L9.1 8.9 Z')


def estrellas(n, color):
    """Apoyadas sobre la tapa de la pieza, enteras fuera de la carta."""
    if not n:
        return ''
    y = CY - LADO / 2 - E - 3
    paso = E + 4
    x0 = W / 2 - (n * paso - 4) / 2
    # ⚠️ La estrella lleva CONTORNO, no solo sombra. El acento de TFC es
    # #F2E9E9 y el de DRA #FFFFFF: contra blanco dan 1.19:1 y 1.00:1, o sea
    # que desaparecen. Y URBF, que tambien es blanco, desapareceria el dia
    # que gane un Interserver. La sombra no alcanzaba porque es un
    # desplazamiento hacia abajo y deja el contorno de arriba sin nada.
    # paint-order=stroke manda el trazo detras del relleno para que no
    # coma la punta de la estrella.
    return ''.join(
        f'<svg class="est" viewBox="0 0 24 24" width="{E}" height="{E}" '
        f'style="left:{x0 + i*paso:.1f}px;top:{y:.1f}px;fill:{color}">'
        f'<path d="{ESTRELLA}" stroke="rgba(0,0,0,.62)" stroke-width="1.7" '
        f'stroke-linejoin="round" paint-order="stroke"/></svg>'
        for i in range(n))


def carta(i, sv, claro=False):
    B, A, fondo, extra, remate, _ = D9[sv]
    n = EST[sv]
    cid = f'p{i}'
    cap = f'<div class="cap" style="{extra}"></div>' if extra else ''
    rem = f'<div class="rem" style="{remate}"></div>' if remate else ''
    return f"""<div class="col{' claro' if claro else ''}">
<div class="et">{sv}</div>
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{D}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})">
    <div class="fondo" style="background:{fondo}"></div>{cap}{rem}
    <img class="ul" src="{UL}">
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{D}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
      <path d="{D}" fill="none" stroke="{t(A,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  {estrellas(n, B)}
  <div class="pieza" style="top:{CY - LADO/2}px;width:{LADO}px;height:{LADO}px;
       box-shadow:0 4px 14px rgba(0,0,0,.85),0 0 0 3px {B};
       background:{t(A,-.62)}"><img src="{esc(sv)}"></div>
</div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:40px;flex-wrap:wrap;align-items:flex-start}}
.col{{text-align:center;width:{W}px;margin-bottom:38px;padding-top:8px}}
.col.claro{{background:#FFFFFF;border-radius:10px;padding:8px 0 14px}}
.et{{color:#EDEDF5;font-size:13px;font-weight:800;letter-spacing:1.4px;
  margin-bottom:14px}}
.claro .et{{color:#1A1A22}}
.rot{{color:#EDEDF5;font-size:16px;font-weight:700;letter-spacing:1.4px;margin:6px 0 22px}}
.rot span{{color:#8A8AA0;font-weight:400;letter-spacing:0}}
.wrap{{position:relative;width:{W}px;height:{ALTO}px}}
.defs{{position:absolute}}
.cuerpo{{position:absolute;inset:0;filter:drop-shadow(0 12px 26px rgba(0,0,0,.7))}}
.claro .cuerpo{{filter:drop-shadow(0 10px 22px rgba(0,0,0,.34))}}
.borde{{position:absolute;inset:0;pointer-events:none}}
.fondo{{position:absolute;inset:0}}
.cap{{position:absolute;inset:0;background-repeat:no-repeat}}
.rem{{position:absolute;inset:0}}
.est{{position:absolute;z-index:11;
  filter:drop-shadow(0 2px 4px rgba(0,0,0,.85))}}
.pieza{{position:absolute;left:50%;transform:translateX(-50%);z-index:10;
  border-radius:50%;overflow:hidden}}
.pieza img{{width:100%;height:100%;display:block;object-fit:cover}}
/* El UL va DENTRO del recorte, en el pie. Es la marca paraguas y ocupa el
   mismo lugar en las tres cartas; el que se mudo arriba fue el escudo del
   servidor. Centrado en y=436 del lienzo, o sea 374 de la carta: entrado en
   la merma de abajo pero con 193 px de ancho todavia disponibles. */
.ul{{position:absolute;left:50%;top:421px;transform:translateX(-50%);z-index:6;
  width:40px;opacity:.94;filter:drop-shadow(0 2px 5px rgba(0,0,0,.95))}}
"""


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    oscuro = ''.join(carta(i, sv) for i, sv in enumerate(ORDEN))
    # los cuatro que TIENEN estrella, sobre blanco: es el caso peor del PNG
    con_est = [sv for sv in ORDEN if EST[sv]]
    claro = ''.join(carta(50 + i, sv, True) for i, sv in enumerate(con_est))
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">LA PIEZA SOBRESALIENDO <span>— corrida 10 px por '
           'debajo del pico, con la estrella apoyada encima y entera fuera de '
           'la carta</span></div>'
           '<div class="fila">' + oscuro + '</div>'
           '<div class="rot">LOS CUATRO QUE TIENEN ESTRELLA, SOBRE BLANCO '
           '<span>— el PNG cae en Discord sobre fondos que no elegimos, y lo '
           'que sobresale ya no tiene carta atrás</span></div>'
           '<div class="fila">' + claro + '</div></body></html>')
    out = os.path.join(SCR, 'pieza_sobresale.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1420, 'height': 1200},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'pieza_sobresale.png'),
                            full_page=True)
        await b.close()
    print('-> pieza_sobresale.png')

asyncio.run(main())
