"""El lado derecho, definido sobre LAS SEIS referencias. Y el nombre en 280.

⚠️ MEDIR UNA SOLA CARTA NO ALCANZA para saber si un rasgo es del sistema o
una casualidad de ese diseño. Se midieron las seis:

    archivo                  vertical (% del panel)   confianza
    FINAL REFERENCIA              34.4%               fuerte  x4.8
    UCL_ICON_A4                   32.2%               fuerte  x5.4
    ICON_PRIME_5                  30.1%               fuerte  x2.5
    TOTS_ICON_A4                  32.9%               debil   x1.6
    TOTS23_EVENT                   8.8%               x1.5 -> no tiene
    UCL23_ICON_5                  91.6%               x1.3 -> no tiene

CUATRO DE SEIS CAEN ENTRE 30.1% Y 34.4%. Promedio de las confiables: 32.4%.
Las dos que se van tienen confianza por debajo de 1.6, o sea que ahi no hay
vertical y el detector agarro cualquier cosa: no son contraejemplos, son
cartas sin ese rasgo.

Y las cuatro TERMINAN LA VERTICAL EN EL DIVISOR, arrancando cerca del 44%
del alto. Eso ya lo habia medido en una sola; ahora esta confirmado.

⚠️ La confianza se informa a proposito. Un pico de gradiente siempre existe:
lo que dice si es real es CUANTO GANA sobre el resto de la fila. Sin ese
numero, las dos ultimas parecerian medidas validas y arruinarian el
promedio.

Lo que queda por elegir no es la geometria sino el TRATAMIENTO, y esta vez
las variantes mueven algo que se ve.
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
COL_FRAC = 0.324                      # el promedio de las cuatro confiables
VERT_DESDE = 0.443 * PICO.h           # 179
NOM_Y = 280
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
U_XV = (XV - borde(BASE_Y, 'izq')) / (borde(BASE_Y, 'der') - borde(BASE_Y, 'izq'))
Y_FIN = BASE_Y - DIV.altura(U_XV) * SUBE


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
COLU = (f'<div class="num">81</div><div class="rng">S</div>'
        f'<img class="ban" src="{BAN}">'
        f'<div class="mini"><b>3º</b><u>EN TFC</u></div>'
        f'<div class="mini"><b>#2</b><u>COMP</u></div>')


def wash(hasta, fuerza=1.0):
    """hasta = donde termina de desvanecerse, en % del ancho."""
    a_ = hasta * .34
    b_ = hasta * .62
    return (f'linear-gradient(270deg,rgba(0,0,0,{fuerza}) 0%,'
            f'rgba(0,0,0,{fuerza}) {a_:.0f}%,'
            f'rgba(0,0,0,{fuerza*.5:.2f}) {b_:.0f}%,transparent {hasta:.0f}%)')


# (etiqueta, mascara del wash, opacidad del wash, neon, sombra)
CASOS = [
 ('1 · wash suave hasta 30% · sin neón', wash(30), .85, 0, 0),
 ('2 · wash ancho hasta 46% · más marcado', wash(46), 1.0, 0, 0),
 ('3 · sin wash · solo la vertical', None, 0, .9, 0),
 ('4 · wash + vertical con neón', wash(30), .85, .9, 0),
 ('5 · wash + neón + sombra hundida', wash(30), .85, .9, .6),
 ('6 · todo fuerte · wash ancho + neón + sombra', wash(46), 1.0, 1.0, .75),
]


def carta(i, etq, m_wash, op, neon, sombra):
    cid = f'd{i}'
    pts = camino()
    # ⚠️ un avatar DISTINTO por muestra. Con la misma foto en todas se juzga
    # como queda la carta CON ESA FOTO, no como queda el diseño.
    av_et, av_src = avatares.para(i)
    foto = (f'<div class="foto ini"><span>VA</span></div>' if av_src is None
            else f'<div class="foto" style="-webkit-mask-image:{M_FOTO};'
                 f'mask-image:{M_FOTO}"><img src="{av_src}">'
                 f'<div class="velo-ar"></div></div>')
    etq = f'{etq}<br><span class="av">avatar: {av_et}</span>'
    w = ('' if not m_wash else
         f'<div class="wash" style="background:{FONDO};opacity:{op};'
         f'-webkit-mask-image:{m_wash};mask-image:{m_wash}"></div>')
    s = ('' if not sombra else
         f'<div class="somb" style="left:{XV - 36:.0f}px;opacity:{sombra}"></div>')
    v = ('' if not neon else
         f'<line x1="{XV:.1f}" y1="{y(VERT_DESDE):.1f}" x2="{XV:.1f}" '
         f'y2="{y(Y_FIN):.1f}" stroke="{B}" stroke-width="1.7" '
         f'opacity="{neon}" filter="url(#gl{i})"/>')
    return f"""<div class="col"><div class="et">{etq}</div>
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})">
    <div class="fondo" style="background:{FONDO}"></div>
    {f'<div class="cap" style="{EXTRA}"></div>' if EXTRA else ''}
    {f'<div class="rem" style="{REMATE}"></div>' if REMATE else ''}
    {foto}
    {w}{s}
    <div class="pie-fondo" style="background:{FONDO};
         clip-path:path('{panel_pie(pts)}')"></div>
    <div class="pie-velo" style="background:{VELO};
         clip-path:path('{panel_pie(pts)}')"></div>
    <svg class="tra" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
      <defs><filter id="gl{i}" x="-400%" y="-20%" width="900%" height="140%">
        <feGaussianBlur stdDeviation="2.4" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="b"/>
        <feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <path d="{d_camino(pts)}" fill="none" stroke="{B}" stroke-width="1.9"
            opacity=".9" stroke-linejoin="round"/>{v}
    </svg>
    <div class="colu">{COLU}</div>
    <div class="nom">VALEN</div>
    <img class="ul" src="{UL}" style="top:{y(UL_Y) - UL_H/2:.1f}px;
         height:{UL_H}px">
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
      <path d="{SIL}" fill="none" stroke="{t(A,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  {emblema.estrellas(1, W, sufijo=f'd{i}')}
  {emblema.pieza(SV, A, B, ESC)}
</div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:34px;flex-wrap:wrap;align-items:flex-start}}
.col{{text-align:center;width:{W}px;margin-bottom:28px}}
.et{{color:#EDEDF5;font-size:12.5px;font-weight:800;letter-spacing:1.1px;
  margin-bottom:16px;min-height:44px}}
.av{{color:#7A7A92;font-weight:400;letter-spacing:0;font-size:11px}}
.foto.ini{{display:flex;align-items:center;justify-content:flex-start;
  padding-left:24px}}
.foto.ini span{{font-family:'Archivo','LigaEmoji',sans-serif;font-weight:900;font-size:5rem;
  color:rgba(255,255,255,.13);letter-spacing:-6px}}
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
.somb{{position:absolute;top:{MARGEN+round(VERT_DESDE)}px;width:36px;
  height:{round(BASE_Y-VERT_DESDE)}px;z-index:5;pointer-events:none;
  background:linear-gradient(270deg,rgba(0,0,0,.78),transparent)}}
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
.nom{{position:absolute;left:0;right:0;top:{y(NOM_Y)-16}px;text-align:center;
  z-index:9;font-family:'Archivo','LigaEmoji',sans-serif;font-size:1.6rem;font-weight:900;
  color:#fff;line-height:1;text-shadow:0 2px 6px rgba(0,0,0,.85)}}
.ul{{position:absolute;left:50%;transform:translateX(-50%);z-index:9;
  width:auto;opacity:.94;filter:drop-shadow(0 2px 5px rgba(0,0,0,.95))}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    cuerpo = ''.join(carta(i, *c) for i, c in enumerate(CASOS))
    med = ('LA VERTICAL EN LAS SEIS REFERENCIAS  (% del ancho del panel)\n\n'
           '  FINAL REFERENCIA        34.4%    fuerte  x4.8\n'
           '  UCL_ICON_A4             32.2%    fuerte  x5.4\n'
           '  ICON_PRIME_5            30.1%    fuerte  x2.5\n'
           '  TOTS_ICON_A4            32.9%    debil   x1.6\n'
           '  TOTS23_EVENT             8.8%    x1.5  -> no tiene vertical\n'
           '  UCL23_ICON_5            91.6%    x1.3  -> no tiene vertical\n\n'
           '  promedio de las confiables  32.4%\n'
           '  las cuatro TERMINAN la vertical en el divisor, desde ~44%')
    aviso = (
        'Cuatro de seis caen entre <b>30.1% y 34.4%</b>, así que es una regla del '
        'sistema y no una casualidad de una carta. Las dos que se van tienen '
        'confianza por debajo de 1.6: ahí <b>no hay vertical</b> y el detector '
        'agarró cualquier cosa. No son contraejemplos, son cartas sin ese '
        'rasgo.<br><br>'
        '⚠️ Por eso se informa la <b>confianza</b>. Un pico de gradiente siempre '
        'existe; lo que dice si es real es <b>cuánto gana sobre el resto</b>. Sin '
        'ese número, las dos últimas parecerían medidas válidas y arruinarían el '
        'promedio.<br><br>'
        'La geometría queda entonces cerrada: vertical al <b>32.4% del panel</b>, '
        'desde el <b>44% del alto</b> hasta morir en el divisor. Lo que queda por '
        'elegir es el <b>tratamiento</b>, y esta vez las variantes mueven algo que '
        'se ve. El nombre va en <b>y=280</b>.')
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">EL LADO DERECHO, DEFINIDO SOBRE LAS SEIS</div>'
           '<div class="med">' + med + '</div>'
           '<div class="aviso">' + aviso + '</div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'derecha_final.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1060, 'height': 1000},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'derecha_final.png'),
                            full_page=True)
        await b.close()
    print('-> derecha_final.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
