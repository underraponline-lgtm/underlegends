"""DRA · otra tanda mas, evitando todo lo que ya se probo.

LO QUE YA SE PROBO EN DRA, en cuatro tandas:

    texturas     oxido, fibra, tela, trama, rayones, papel
    estructuras  columnas anchas y finas, chevron, rayos, malla, corte
                 horizontal, foco desde el emblema
    cielo        polvo, constelacion de la corona, microfonos, reticula,
                 via lactea, aurora, nebulosa, horizonte, fugaz, halo,
                 orbitas, corte vertical de luz

LO QUE NADIE TIENE EN LAS DIEZ, y de ahi sale esta tanda:

  ⚠️ NO HAY UNA SOLA CURVA EN TODO EL SET. Las diez usan gestos rectos:
     bandas, cortes al sesgo, franjas, columnas, halftone. Una curva grande
     es lo unico que ninguna carta puede reclamar, y ademas es lo que hace
     una costura de camiseta de verdad, que es el concepto que veniamos
     siguiendo.

  · faceteado de poligonos
  · degrade escalonado, en escalones planos en vez de suave
  · malla de camiseta, el material real
  · luz entrando por una esquina, no por arriba

Las tres lineas al pie no van: ya se solto esa idea.
"""
import asyncio
import base64
import os
import random
import re
import sys

from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun.siluetas import PICO
from comun import emblema

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
G = f'linear-gradient(166deg,{t(A,.40)} 0%,{A} 42%,{t(A,-.70)} 100%)'


def curva(d, relleno, op='1'):
    return f'<path d="{d}" fill="{relleno}" opacity="{op}"/>'


def y(v):
    return v + MARGEN


# ── una costura curva, como el panel de una camiseta ──
COSTURA = (f'M0,{y(150)} C90,{y(96)} 210,{y(196)} 300,{y(132)} '
           f'L300,{y(405)} L0,{y(405)} Z')
COSTURA_ALTA = (f'M0,{y(96)} C86,{y(46)} 214,{y(150)} 300,{y(84)} '
                f'L300,{y(405)} L0,{y(405)} Z')
HOMBRO = (f'M0,{y(0)} C110,{y(70)} 190,{y(70)} 300,{y(0)} L300,{y(0)} L0,{y(0)} Z')
BARRIDO = (f'M300,{y(30)} C170,{y(120)} 130,{y(250)} 300,{y(340)} Z')


def facetas(semilla=5, n=13):
    """Poligonos de tono apenas distinto: faceteado, no manchas."""
    r = random.Random(semilla)
    pts = [(r.uniform(-30, 330), r.uniform(-20, PICO.h + 20)) for _ in range(n)]
    o = ''
    for i in range(len(pts) - 2):
        a1, b1, c1 = pts[i], pts[i + 1], pts[i + 2]
        f = r.uniform(-.16, .18)
        o += (f'<polygon points="{a1[0]:.0f},{y(a1[1]):.0f} '
              f'{b1[0]:.0f},{y(b1[1]):.0f} {c1[0]:.0f},{y(c1[1]):.0f}" '
              f'fill="{t(A, f)}" opacity=".55"/>')
    return o


MALLA = ('background-image:'
         'repeating-linear-gradient(60deg,rgba(255,255,255,.055) 0 1px,transparent 1px 7px),'
         'repeating-linear-gradient(-60deg,rgba(255,255,255,.055) 0 1px,transparent 1px 7px)')

ESCALONES = (f'linear-gradient(178deg,{t(A,.46)} 0 15%,{t(A,.26)} 15% 30%,'
             f'{t(A,.04)} 30% 46%,{t(A,-.20)} 46% 62%,{t(A,-.44)} 62% 79%,'
             f'{t(A,-.70)} 79% 100%)')

ESQUINA = (f'radial-gradient(ellipse 120% 90% at 4% 2%,{t(A,.54)},transparent 62%),'
           f'linear-gradient(166deg,{t(A,.06)} 0%,{t(A,-.34)} 46%,{t(A,-.78)} 100%)')

CASOS = [
 ('1 · actual · óxido', G, '', ''),

 ('2 · costura curva · la única curva del set', G,
  curva(COSTURA, t(A, -.44)), ''),

 ('3 · costura alta + filo blanco', G,
  curva(COSTURA_ALTA, t(A, -.46)) +
  f'<path d="M0,{y(96)} C86,{y(46)} 214,{y(150)} 300,{y(84)}" fill="none" '
  f'stroke="{B}" stroke-width="2.6" opacity=".9"/>', ''),

 ('4 · barrido curvo lateral', G, curva(BARRIDO, t(A, .30), '.5'), ''),

 ('5 · hombro curvo, como una camiseta', G,
  curva(HOMBRO, t(A, .34), '.75'), ''),

 ('6 · faceteado de polígonos', G, facetas(), ''),

 ('7 · degradé escalonado, no suave', ESCALONES, '', ''),

 ('8 · malla de camiseta', G, '', MALLA),

 ('9 · luz por la esquina, no por arriba', ESQUINA, '', ''),

 ('10 · costura curva + malla', G, curva(COSTURA, t(A, -.44)), MALLA),
]


def carta(i, etq, fondo, svg, capa):
    cid = f'o{i}'
    c = f'<div class="cap" style="{capa}"></div>' if capa else ''
    return f"""<div class="col"><div class="et">{etq}</div>
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})">
    <div class="fondo" style="background:{fondo}"></div>
    <svg class="dib" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">{svg}</svg>
    {c}<img class="ul" src="{UL}">
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
      <path d="{SIL}" fill="none" stroke="{t(A,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  {emblema.estrellas(1, W, sufijo=f'o{i}')}
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


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    cuerpo = ''.join(carta(i, *c) for i, c in enumerate(CASOS))
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">DRA · OTRA TANDA, POR LO QUE NADIE TIENE</div>'
           '<div class="aviso">Ya se probó en DRA: texturas (óxido, fibra, tela, '
           'trama, rayones, papel), estructuras (columnas, chevrón, rayos, malla, '
           'corte horizontal, foco) y cielo (polvo, constelación, aurora, nebulosa, '
           'horizonte, fugaz, halo, órbitas, vía láctea).<br><br>'
           '<b>Lo que nadie tiene en las diez: una curva.</b> Las diez usan gestos '
           'rectos —bandas, cortes al sesgo, franjas, columnas, halftone—, así que '
           'una costura curva es lo único que ninguna otra carta puede reclamar. Y '
           'encima es lo que hace un panel de camiseta de verdad, que era el '
           'concepto. Se suman faceteado, degradé escalonado, malla de camiseta y '
           'luz entrando por una esquina.</div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'dra_otras.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1400, 'height': 1200},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2800)
        await pg.screenshot(path=os.path.join(SCR, 'dra_otras.png'), full_page=True)
        await b.close()
    print('-> dra_otras.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
