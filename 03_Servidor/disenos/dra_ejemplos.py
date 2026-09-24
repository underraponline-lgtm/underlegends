"""DRA · doce ejemplos, sin dar por fijas las lineas al pie.

Las tres lineas venian de la tanda del oxido y las estaba arrastrando a
todas las pruebas como si fueran intocables. No lo son: eran el remate de un
fondo que ya se descarto. Aca la mayoria va SIN ellas y una sola las lleva,
para poder comparar con y sin.

Se cambia el CONCEPTO en cada una, no los parametros de uno solo. Las dos
tandas anteriores fallaron por eso: nueve texturas sobre el mismo degrade, y
despues nueve estructuras sobre el mismo cielo.

⚠️ La regla que no se toca: el fondo va con PUNTOS REDONDOS. La estrella de
cinco puntas es la medalla del Interserver y tiene que seguir siendo la
unica. Si el fondo lleva estrellas de cinco puntas, deja de significar.
"""
import asyncio
import base64
import io
import math
import os
import random
import re
import sys

from PIL import Image
from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun.siluetas import PICO
from comun import emblema
from dra_limpio import medir

W, MARGEN = PICO.w, emblema.MARGEN
ALTO = PICO.h + MARGEN
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


UL = b64(os.path.join(BASE, '02_Competitivo', 'ul_blanco.png'))
ESC = b64(os.path.join(BASE, 'comun', 'escudos_cuad', 'sv_dra.png'))
t = emblema.tono

A, B = '#3D5BFF', '#FFFFFF'
CIELO = f'linear-gradient(172deg,{t(A,-.42)} 0%,{t(A,-.70)} 46%,#04040E 100%)'
HONDO = f'linear-gradient(172deg,{t(A,-.56)} 0%,#0A0C2A 52%,#03030C 100%)'
LINEAS = ('background:linear-gradient(180deg,transparent 0 70%,'
          'rgba(255,255,255,.90) 70% 71.4%,transparent 71.4% 73%,'
          'rgba(255,255,255,.90) 73% 74.4%,transparent 74.4% 76%,'
          'rgba(255,255,255,.90) 76% 77.4%,transparent 77.4%)')

CORONA = [(82, 236), (98, 172), (118, 208), (150, 156), (182, 208),
          (202, 172), (218, 236)]
CORONA_G = [(24, 300), (52, 176), (88, 246), (150, 132), (212, 246),
            (248, 176), (276, 300)]


def polvo(n=140, semilla=7, brillo=1.0, hasta=None):
    r = random.Random(semilla)
    lim = hasta if hasta else PICO.h - 20
    p = []
    for _ in range(n):
        x = r.uniform(4, W - 4)
        y = r.uniform(6, lim) + MARGEN
        rad = r.choice([0.7, 0.7, 0.9, 0.9, 1.1, 1.4, 1.8])
        op = r.uniform(.28, .95) * brillo * (0.6 if rad < 1 else 1)
        p.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{rad}" fill="#fff" '
                 f'opacity="{op:.2f}"/>')
    return ''.join(p)


def constel(pts, r=2.6, op=.55):
    d = 'M' + ' L'.join('%g,%g' % (x, y + MARGEN) for x, y in pts)
    nodos = ''.join(f'<circle cx="{x}" cy="{y + MARGEN}" r="{r}" fill="#fff" '
                    f'opacity=".92"/>' for x, y in pts)
    return (f'<path d="{d}" fill="none" stroke="#fff" stroke-width="1.2" '
            f'opacity="{op}" stroke-linejoin="round"/>' + nodos)


def fugaz(x0, y0, largo=120, ang=28):
    x1 = x0 + largo * math.cos(math.radians(ang))
    y1 = y0 + largo * math.sin(math.radians(ang))
    return (f'<defs><linearGradient id="fg" x1="0" y1="0" x2="1" y2="1">'
            f'<stop offset="0" stop-color="#fff" stop-opacity="0"/>'
            f'<stop offset="1" stop-color="#fff" stop-opacity=".85"/>'
            f'</linearGradient></defs>'
            f'<line x1="{x0}" y1="{y0 + MARGEN}" x2="{x1:.0f}" y2="{y1 + MARGEN:.0f}" '
            f'stroke="url(#fg)" stroke-width="1.6"/>'
            f'<circle cx="{x1:.0f}" cy="{y1 + MARGEN:.0f}" r="2.4" fill="#fff"/>')


def orbitas():
    o = ''
    for r in (74, 112, 152, 194):
        o += (f'<circle cx="{W/2}" cy="{MARGEN + 4}" r="{r}" fill="none" '
              f'stroke="#fff" stroke-width="1" opacity=".13"/>')
    return o


CASOS = [
 ('1 · cielo + corona · sin líneas', CIELO, polvo(130) + constel(CORONA), '', ''),
 ('2 · cielo limpio · solo polvo', CIELO, polvo(150), '', ''),
 ('3 · aurora · bandas verticales de luz', CIELO, polvo(110),
  'linear-gradient(90deg,transparent 0 14%,rgba(120,170,255,.22) 22%,'
  'transparent 34%,transparent 52%,rgba(150,120,255,.20) 64%,transparent 78%)', ''),
 ('4 · nebulosa contenida arriba', HONDO, polvo(150),
  'radial-gradient(ellipse 74% 30% at 42% 14%,rgba(110,140,255,.34),transparent 70%),'
  'radial-gradient(ellipse 56% 22% at 68% 26%,rgba(170,120,255,.26),transparent 70%)', ''),
 ('5 · horizonte · cielo arriba, tierra abajo',
  f'linear-gradient(180deg,{t(A,-.36)} 0 54%,#0A0E30 54% 55.4%,#05060F 55.4% 100%)',
  polvo(120, hasta=200), '', ''),
 ('6 · la corona ocupando la carta', CIELO, polvo(120) + constel(CORONA_G, 3.2, .5),
  '', ''),
 ('7 · estrella fugaz', CIELO, polvo(140) + fugaz(60, 96), '', ''),
 ('8 · halo detrás del emblema', HONDO, polvo(140),
  'radial-gradient(circle 120px at 50% 4%,rgba(150,180,255,.40),transparent 72%)', ''),
 ('9 · órbitas desde el emblema', HONDO, orbitas() + polvo(120), '', ''),
 ('10 · corte vertical de luz', CIELO, polvo(120),
  f'linear-gradient(90deg,transparent 0 47%,rgba(255,255,255,.34) 47% 48.6%,'
  f'rgba(120,160,255,.14) 48.6% 62%,transparent 62%)', ''),
 ('11 · vía láctea al sesgo', HONDO, polvo(160),
  'linear-gradient(122deg,transparent 0 34%,rgba(150,175,255,.26) 44%,'
  'rgba(190,170,255,.16) 54%,transparent 66%)', ''),
 ('12 · cielo + corona + las líneas, para comparar', CIELO,
  polvo(130) + constel(CORONA), '', LINEAS),
]


def carta(i, etq, fondo, svg, capa, remate, med=None):
    cid = f'j{i}'
    c = f'<div class="cap" style="background:{capa}"></div>' if capa else ''
    r = f'<div class="rem" style="{remate}"></div>' if remate else ''
    nota = (f'<div class="nu">mancha {med[1]:.2f} · luz {med[2]:.1f}</div>'
            if med else '')
    return f"""<div class="col"><div class="et">{etq}</div>{nota}
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})" id="m{i}">
    <div class="fondo" style="background:{fondo}"></div>{c}
    <svg class="cielo" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">{svg}</svg>
    {r}<img class="ul" src="{UL}">
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
      <path d="{SIL}" fill="none" stroke="{t(A,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  {emblema.estrellas(1, W, sufijo=f'j{i}')}
  {emblema.pieza('DRA', A, B, ESC)}
</div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:30px;flex-wrap:wrap;align-items:flex-start}}
.col{{text-align:center;width:{W}px;margin-bottom:28px}}
.et{{color:#EDEDF5;font-size:12.5px;font-weight:800;letter-spacing:1.1px;min-height:30px}}
.nu{{color:#8A8AA0;font-size:11px;margin:3px 0 14px}}
.rot{{color:#EDEDF5;font-size:16px;font-weight:700;letter-spacing:1.4px;margin:6px 0 8px}}
.rot span{{color:#8A8AA0;font-weight:400;letter-spacing:0;font-size:13px}}
.aviso{{color:#8A8AA0;font-size:12.5px;margin:0 0 22px;max-width:1000px;line-height:1.55}}
.wrap{{position:relative;width:{W}px;height:{ALTO}px}}
.defs{{position:absolute}}
.cuerpo{{position:absolute;inset:0;filter:drop-shadow(0 12px 26px rgba(0,0,0,.72))}}
.borde{{position:absolute;inset:0;pointer-events:none}}
.fondo{{position:absolute;inset:0;z-index:0}}
.cap{{position:absolute;inset:0;z-index:1}}
.cielo{{position:absolute;inset:0;z-index:2}}
.rem{{position:absolute;inset:0;z-index:3}}
.ul{{position:absolute;left:50%;top:424px;transform:translateX(-50%);z-index:6;
  height:20.7px;width:auto;opacity:.94;filter:drop-shadow(0 2px 5px rgba(0,0,0,.95))}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()

    def pagina(med=None):
        cuerpo = ''.join(carta(i, *c, med[i] if med else None)
                         for i, c in enumerate(CASOS))
        return ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
                + fuentes + CSS + '</style></head><body>'
                '<div class="rot">DRA · DOCE EJEMPLOS '
                '<span>— sin dar por fijas las líneas del pie</span></div>'
                '<div class="aviso">Las tres líneas venían del fondo con óxido, que '
                'ya se descartó, y las estaba arrastrando a todas las pruebas como si '
                'fueran intocables. Acá van sin ellas, salvo la 12 que las lleva para '
                'poder comparar con y sin.<br><br>'
                'Lo que sí no se toca: el fondo va con <b>puntos redondos</b>. La '
                'estrella de cinco puntas es la medalla del Interserver y tiene que '
                'seguir siendo la única.</div>'
                '<div class="fila">' + cuerpo + '</div></body></html>')

    out = os.path.join(SCR, 'dra_ejemplos.html')
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1400, 'height': 1200},
                              device_scale_factor=2)
        open(out, 'w', encoding='utf-8').write(pagina())
        await pg.goto('file://' + out); await pg.wait_for_timeout(2800)
        med = {}
        for i in range(len(CASOS)):
            el = await pg.query_selector(f'#m{i}')
            im = Image.open(io.BytesIO(await el.screenshot()))
            g, mn = medir(im)
            import numpy as np
            a = np.array(im.convert('RGB')).astype(float)
            luz = (.2126*a[:, :, 0] + .7152*a[:, :, 1] + .0722*a[:, :, 2]).mean()
            med[i] = (g, mn, luz)
        open(out, 'w', encoding='utf-8').write(pagina(med))
        await pg.goto('file://' + out); await pg.wait_for_timeout(2800)
        await pg.screenshot(path=os.path.join(SCR, 'dra_ejemplos.png'), full_page=True)
        await b.close()
    print('-> dra_ejemplos.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
