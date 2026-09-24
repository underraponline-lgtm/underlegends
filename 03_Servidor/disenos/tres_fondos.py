"""URBF, EFA y FFA: mejorar los tres fondos que quedaron flojos.

Se hacen JUNTOS pero NO con la misma receta. La regla del proyecto es que
hacer los nueve de una vuelta los sacaba parecidos, y eso pasaba porque era
una receta con variantes. Aca cada servidor tiene su propia lista, salida de
su propio problema:

  URBF  es un campo violeta grande y plano. Sus "tres capas de pegatina" son
        tres degrades encimados, o sea mas de lo mismo. Le falta MATERIAL:
        es el unico de los nueve sin textura ni gesto duro.

  EFA   tiene el problema opuesto: sobra textura. El cuero va con
        background-size:cover, asi que el mosaico de 512 se estira a 300x405
        y sus manchas quedan ENORMES. A ese tamaño no se lee como cuero: se
        lee como camuflaje. La sospecha es que casi todo se arregla con el
        tamaño del mosaico, no cambiando de textura.

  FFA   la luz fosforescente esta, pero puesta arriba al centro, que es
        justo donde va el emblema. Queda tapada. Las variantes prueban
        moverla a donde se vea.

La primera de cada tanda es la ACTUAL, de referencia.
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
TEX = os.path.join(SCR, 'texturas')
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun.siluetas import PICO
from comun import emblema
from los_nueve import defs

W, MARGEN = PICO.w, emblema.MARGEN
ALTO = PICO.h + MARGEN


def mover(d, dy):
    return re.sub(r'(-?[\d.]+),(-?[\d.]+)',
                  lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + dy), d)


SIL = mover(PICO.d, MARGEN)
D9 = defs()
EST = json.load(open(os.path.join(BASE, 'datos', 'estrellas.json'),
                     encoding='utf-8'))['estrellas_por_servidor']


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


UL = b64(os.path.join(BASE, '02_Competitivo', 'ul_blanco.png'))
def esc(sv): return b64(os.path.join(BASE, 'comun', 'escudos_cuad', f'sv_{sv.lower()}.png'))
def tx(n): return b64(os.path.join(TEX, n + '.png'))
t = emblema.tono


def cap(tex, tam, mezcla, op, extra=''):
    return (f'background-image:url({tx(tex)});background-size:{tam};'
            f'background-position:center;mix-blend-mode:{mezcla};'
            f'opacity:{op};{extra}')


# ════════════════════════ URBF ════════════════════════
U, UB = '#7B44BF', '#FFFFFF'
U_BASE = (f'linear-gradient(166deg,{t(U,.46)} 0%,{U} 40%,{t(U,-.72)} 100%)')

URBF = [
 ('1 · actual', *D9['URBF'][2:5]),

 ('2 · concreto · la pared',
  f'linear-gradient(188deg,transparent 0 78%,{t(U,-.44)} 78% 100%),' + U_BASE,
  cap('concreto', 'cover', 'overlay', '.30'), ''),

 ('3 · spray · aerosol sobre el violeta',
  U_BASE, cap('spray', '150%', 'screen', '.16'), ''),

 ('4 · franjas verticales anchas',
  f'repeating-linear-gradient(90deg,{t(U,.10)} 0 34px,{t(U,-.26)} 34px 68px),'
  + U_BASE, cap('concreto', 'cover', 'overlay', '.22'), ''),

 ('5 · corte blanco duro · pegatina de verdad',
  f'linear-gradient(200deg,transparent 0 52%,{UB} 52% 55%,'
  f'{t(U,-.62)} 55% 100%),' + U_BASE,
  cap('rayones', '180%', 'overlay', '.20'), ''),

 ('6 · salpicadura + banda al pie',
  U_BASE, cap('salpicadura', '140%', 'screen', '.14'),
  'background:linear-gradient(180deg,transparent 0 76%,'
  f'{UB} 76% 78.5%,transparent 78.5%)'),
]

# ════════════════════════ EFA ════════════════════════
E_, EB = '#3A2412', '#E8A144'
E_BASE = f'linear-gradient(166deg,{t(E_,.30)} 0%,{E_} 44%,{t(E_,-.55)} 100%)'
E_REM = 'box-shadow:inset 0 0 0 4px #E8A144,inset 0 0 0 6px rgba(0,0,0,.55)'

EFA = [
 ('1 · actual · el mosaico estirado', *D9['EFA'][2:5]),

 ('2 · el mismo cuero, mosaico chico',
  E_BASE, cap('cuero', '150px', 'soft-light', '.55'), E_REM),

 ('3 · mosaico chico y mas tenue',
  E_BASE, cap('cuero', '120px', 'soft-light', '.34'), E_REM),

 ('4 · cuero chico + fibra encima',
  E_BASE,
  cap('cuero', '140px', 'soft-light', '.40'), E_REM),

 ('5 · vetas de madera en vez de cuero',
  E_BASE, cap('vetas', '200%', 'soft-light', '.42'), E_REM),

 ('6 · cuero chico + banda cobre al sesgo',
  f'linear-gradient(122deg,transparent 0 54%,{EB} 54% 58%,'
  f'rgba(232,161,68,.20) 58% 70%,transparent 70%),' + E_BASE,
  cap('cuero', '150px', 'soft-light', '.45'), E_REM),
]

# ════════════════════════ FFA ════════════════════════
F, FB = '#190630', '#EC48DC'
F_TRAMA = ('radial-gradient(circle at 1.5px 1.5px,rgba(236,72,220,.22) 1.1px,'
           'transparent 1.2px) 0 0/8px 8px,')
F_FONDO = 'linear-gradient(168deg,#190630 0%,#090315 100%)'
F_GRANO = cap('estatica', 'cover', 'soft-light', '.14')
F_FILO = ('box-shadow:inset 0 0 0 2px rgba(236,72,220,.80),'
          'inset 0 0 30px rgba(236,72,220,.24)')

FFA = [
 ('1 · actual · la luz arriba, tapada por el emblema', *D9['FFA'][2:5]),

 ('2 · la luz baja al centro',
  F_TRAMA + 'radial-gradient(ellipse 70% 34% at 50% 52%,rgba(236,72,220,.50),'
  'transparent 62%),' + F_FONDO, F_GRANO, F_FILO),

 ('3 · la luz sube desde el pie',
  F_TRAMA + 'radial-gradient(ellipse 82% 30% at 50% 100%,rgba(236,72,220,.58),'
  'transparent 66%),' + F_FONDO, F_GRANO, F_FILO),

 ('4 · dos luces · arriba y rebote abajo',
  F_TRAMA + 'radial-gradient(ellipse 58% 22% at 50% 16%,rgba(236,72,220,.44),'
  'transparent 60%),'
  'radial-gradient(ellipse 76% 24% at 50% 98%,rgba(124,58,237,.46),'
  'transparent 66%),' + F_FONDO, F_GRANO, F_FILO),

 ('5 · luz lateral · entra por la izquierda',
  F_TRAMA + 'radial-gradient(ellipse 46% 62% at 4% 44%,rgba(236,72,220,.50),'
  'transparent 66%),' + F_FONDO, F_GRANO, F_FILO),

 ('6 · fosforescente al borde, no al centro',
  F_TRAMA + F_FONDO, F_GRANO,
  'box-shadow:inset 0 0 0 2px rgba(236,72,220,.92),'
  'inset 0 0 46px rgba(236,72,220,.42),inset 0 0 96px rgba(124,58,237,.26)'),
]


def carta(i, sv, etq, fondo, extra, remate):
    B, A = D9[sv][0], D9[sv][1]
    cid = f'x{i}'
    c = f'<div class="cap" style="{extra}"></div>' if extra else ''
    r = f'<div class="rem" style="{remate}"></div>' if remate else ''
    return f"""<div class="col"><div class="et">{etq}</div>
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})">
    <div class="fondo" style="background:{fondo}"></div>{c}{r}
    <img class="ul" src="{UL}">
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
      <path d="{SIL}" fill="none" stroke="{t(A,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  {emblema.estrellas(EST[sv], W, sufijo=f'{i}_')}
  {emblema.pieza(sv, A, B, esc(sv))}
</div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:32px;flex-wrap:wrap;align-items:flex-start}}
.col{{text-align:center;width:{W}px;margin-bottom:30px}}
.et{{color:#EDEDF5;font-size:12px;font-weight:800;letter-spacing:1.1px;
  margin-bottom:16px;min-height:30px}}
.rot{{color:#EDEDF5;font-size:16px;font-weight:700;letter-spacing:1.4px;margin:14px 0 20px}}
.rot span{{color:#8A8AA0;font-weight:400;letter-spacing:0;font-size:13px}}
.wrap{{position:relative;width:{W}px;height:{ALTO}px}}
.defs{{position:absolute}}
.cuerpo{{position:absolute;inset:0;filter:drop-shadow(0 12px 26px rgba(0,0,0,.72))}}
.borde{{position:absolute;inset:0;pointer-events:none}}
.fondo{{position:absolute;inset:0;z-index:0}}
.cap{{position:absolute;inset:0;z-index:1;background-repeat:repeat}}
.rem{{position:absolute;inset:0;z-index:2}}
.ul{{position:absolute;left:50%;top:424px;transform:translateX(-50%);z-index:6;
  height:20.7px;width:auto;opacity:.94;
  filter:drop-shadow(0 2px 5px rgba(0,0,0,.95))}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    partes = []
    for sv, lista, titulo in (('URBF', URBF, 'le falta material'),
                              ('EFA', EFA, 'le sobra textura'),
                              ('FFA', FFA, 'la luz está donde no se ve')):
        cuerpo = ''.join(carta(i, sv, *v)
                         for i, v in enumerate(lista, start=hash(sv) % 40))
        partes.append(f'<div class="rot">{sv} <span>— {titulo}</span></div>'
                      f'<div class="fila">{cuerpo}</div>')
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>' + ''.join(partes)
           + '</body></html>')
    out = os.path.join(SCR, 'tres_fondos.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1060, 'height': 1200},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2800)
        await pg.screenshot(path=os.path.join(SCR, 'tres_fondos.png'),
                            full_page=True)
        await b.close()
    print('-> tres_fondos.png')

asyncio.run(main())
