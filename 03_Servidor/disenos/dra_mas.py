"""DRA · sexta tanda. Antes de proponer, se mide donde esta el hueco.

Ya se probaron cinco tandas: texturas, estructuras rectas, cielo,
conceptos sueltos y curvas. Para no repetir por sexta vez, esta arranca
MIDIENDO las diez cartas y buscando el hueco, en vez de inventar.

Se mide una sola cosa: DE DONDE VIENE LA LUZ. Se compara el tercio de
arriba contra el de abajo en cada una de las diez. Si casi todas tienen la
luz arriba, invertirla es un lugar libre y no hace falta adivinarlo.

Lo demas de la tanda sale de gestos que ninguna carta usa: damero, medallon
de fondo, persiana fina, ondas concentricas, bloques apilados y el logo de
DRA como forma solida gigante en vez de como lineas de constelacion.
"""
import asyncio
import base64
import io
import os
import re
import sys

import numpy as np
from PIL import Image
from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun.siluetas import PICO
from comun import emblema
from los_nueve import defs, ORDEN

W, MARGEN = PICO.w, emblema.MARGEN
ALTO = PICO.h + MARGEN
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)
D9 = defs()


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


UL = b64(os.path.join(BASE, '02_Competitivo', 'ul_blanco.png'))
ESC = b64(os.path.join(BASE, 'comun', 'escudos_cuad', 'sv_dra.png'))
t = emblema.tono

A, B = '#3D5BFF', '#FFFFFF'
G = f'linear-gradient(166deg,{t(A,.40)} 0%,{A} 42%,{t(A,-.70)} 100%)'


def y(v):
    return v + MARGEN


CORONA = (f'M28,{y(310)} L62,{y(120)} L106,{y(228)} L150,{y(78)} '
          f'L194,{y(228)} L238,{y(120)} L272,{y(310)} Z')

CASOS = [
 ('1 · actual · óxido', G, '', ''),

 ('2 · luz invertida · claro abajo',
  f'linear-gradient(166deg,{t(A,-.72)} 0%,{t(A,-.14)} 52%,{t(A,.44)} 100%)',
  '', ''),

 ('3 · split vertical asimétrico',
  f'linear-gradient(90deg,{t(A,.24)} 0 38%,{t(A,-.38)} 38% 100%),' + G, '', ''),

 ('4 · damero',
  'repeating-conic-gradient(rgba(255,255,255,.07) 0% 25%,transparent 0% 50%)'
  ' 0 0/46px 46px,' + G, '', ''),

 ('5 · medallón de fondo',
  f'radial-gradient(circle 120px at 50% 44%,{t(A,.30)} 0 118px,'
  f'{B} 118px 120px,transparent 120px),' + G, '', ''),

 ('6 · persiana · rayas finas',
  f'repeating-linear-gradient(180deg,{t(A,.06)} 0 5px,{t(A,-.14)} 5px 10px),'
  + G, '', ''),

 ('7 · ondas concéntricas desde el pie', G,
  ''.join(f'<circle cx="150" cy="{y(420)}" r="{r}" fill="none" '
          f'stroke="#fff" stroke-width="2" opacity=".13"/>'
          for r in (110, 158, 208, 258, 310)), ''),

 ('8 · la corona del logo, gigante', G,
  f'<path d="{CORONA}" fill="{t(A,.26)}" opacity=".62"/>', ''),

 ('9 · bloques apilados',
  f'linear-gradient(180deg,transparent 0 22%,{t(A,-.30)} 22% 40%,'
  f'transparent 40% 52%,{t(A,.18)} 52% 63%,transparent 63% 76%,'
  f'{t(A,-.44)} 76% 100%),' + G, '', ''),

 ('10 · bicolor · azul a violeta',
  f'linear-gradient(166deg,{t(A,.34)} 0%,{A} 38%,#4A2FC8 74%,#25105E 100%)',
  '', ''),
]


def carta(i, etq, fondo, svg, capa):
    cid = f'm{i}'
    c = f'<div class="cap" style="{capa}"></div>' if capa else ''
    s = (f'<svg class="dib" viewBox="0 0 {W} {ALTO}" width="{W}" '
         f'height="{ALTO}">{svg}</svg>') if svg else ''
    return f"""<div class="col"><div class="et">{etq}</div>
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})" id="q{i}">
    <div class="fondo" style="background:{fondo}"></div>{s}{c}
    <img class="ul" src="{UL}">
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
      <path d="{SIL}" fill="none" stroke="{t(A,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  {emblema.estrellas(1, W, sufijo=f'm{i}')}
  {emblema.pieza('DRA', A, B, ESC)}
</div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:30px;flex-wrap:wrap;align-items:flex-start}}
.col{{text-align:center;width:{W}px;margin-bottom:28px}}
.et{{color:#EDEDF5;font-size:12.5px;font-weight:800;letter-spacing:1.1px;
  margin-bottom:16px;min-height:30px}}
.rot{{color:#EDEDF5;font-size:16px;font-weight:700;letter-spacing:1.4px;margin:6px 0 8px}}
.aviso{{color:#8A8AA0;font-size:12.5px;margin:0 0 22px;max-width:1010px;line-height:1.55}}
.med{{color:#8A8AA0;font-size:12px;margin:0 0 22px;font-family:ui-monospace,monospace;
  white-space:pre;line-height:1.5}}
.wrap{{position:relative;width:{W}px;height:{ALTO}px}}
.defs{{position:absolute}}
.cuerpo{{position:absolute;inset:0;filter:drop-shadow(0 12px 26px rgba(0,0,0,.72))}}
.borde{{position:absolute;inset:0;pointer-events:none}}
.fondo{{position:absolute;inset:0;z-index:0}}
.dib{{position:absolute;inset:0;z-index:1}}
.cap{{position:absolute;inset:0;z-index:2;background-repeat:repeat}}
.ul{{position:absolute;left:50%;top:424px;transform:translateX(-50%);z-index:6;
  height:20.7px;width:auto;opacity:.94;filter:drop-shadow(0 2px 5px rgba(0,0,0,.95))}}
""" + emblema.CSS


async def medir_las_diez(pg, fuentes):
    """De donde viene la luz en cada una de las diez cartas."""
    cel = ''.join(
        f'<div class="c" id="{sv}" style="position:relative;width:300px;'
        f'height:405px"><div style="position:absolute;inset:0;'
        f'background:{D9[sv][2]}"></div>'
        + (f'<div style="position:absolute;inset:0;{D9[sv][3]}"></div>'
           if D9[sv][3] else '')
        + (f'<div style="position:absolute;inset:0;{D9[sv][4]}"></div>'
           if D9[sv][4] else '') + '</div>' for sv in ORDEN)
    pag = ('<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
           'body{margin:0;background:#000;display:flex;flex-wrap:wrap}'
           '</style></head><body>' + cel + '</body></html>')
    out = os.path.join(SCR, '_luz.html')
    open(out, 'w', encoding='utf-8').write(pag)
    await pg.goto('file://' + out); await pg.wait_for_timeout(2000)
    r = []
    for sv in ORDEN:
        el = await pg.query_selector('#' + sv)
        a = np.array(Image.open(io.BytesIO(await el.screenshot()))
                     .convert('RGB')).astype(float)
        lum = .2126*a[:, :, 0] + .7152*a[:, :, 1] + .0722*a[:, :, 2]
        h = lum.shape[0]
        r.append((sv, lum[:h//3].mean(), lum[-h//3:].mean()))
    return r


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1000, 'height': 900})
        luz = await medir_las_diez(pg, fuentes)
        await pg.close()

        lineas = ['%-6s %8s %8s   %s' % ('sv', 'arriba', 'abajo', 'la luz esta')]
        arriba = 0
        for sv, ar, ab in luz:
            d = 'ARRIBA' if ar > ab else 'abajo'
            arriba += ar > ab
            lineas.append('%-6s %8.1f %8.1f   %s' % (sv, ar, ab, d))
        lineas.append('')
        lineas.append('%d de %d tienen la luz arriba' % (arriba, len(luz)))
        medida = '\n'.join(lineas)
        print(medida)

        cuerpo = ''.join(carta(i, *c) for i, c in enumerate(CASOS))
        pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
               + fuentes + CSS + '</style></head><body>'
               '<div class="rot">DRA · SEXTA TANDA, BUSCANDO EL HUECO</div>'
               '<div class="aviso">Ya van cinco tandas: texturas, estructuras '
               'rectas, cielo, conceptos sueltos y curvas. Para no repetir, esta '
               'arranca <b>midiendo</b> las diez cartas en vez de inventar. Se mide '
               'de dónde viene la luz, comparando el tercio de arriba contra el de '
               'abajo:</div>'
               f'<div class="med">{medida}</div>'
               '<div class="aviso">El resto sale de gestos que ninguna carta usa: '
               'damero, medallón de fondo, persiana fina, ondas concéntricas, '
               'bloques apilados, y el logo de DRA como <b>forma sólida gigante</b> '
               'en vez de como líneas de constelación.</div>'
               '<div class="fila">' + cuerpo + '</div></body></html>')
        out = os.path.join(SCR, 'dra_mas.html')
        open(out, 'w', encoding='utf-8').write(pag)
        pg = await b.new_page(viewport={'width': 1400, 'height': 1200},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2800)
        await pg.screenshot(path=os.path.join(SCR, 'dra_mas.png'), full_page=True)
        await b.close()
    print('\n-> dra_mas.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
