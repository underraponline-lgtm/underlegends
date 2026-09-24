"""RZ · electricidad y fuego azul.

Dlx pidio algo electronico, con electricidad o fuego azul. Sale del propio
logo: lobo y letras sobre llamas azules.

⚠️ EL PROBLEMA DE COLOR, medido y no supuesto. El azul de RZ da tono 230°,
que es EXACTAMENTE el de FTN (230°) y el de DRA (231°). Tres cartas en el
mismo tono.

Lo que salva a la paleta —y esto tampoco lo decidio nadie, salio asi— es que
LOS DIEZ SE SEPARAN POR LUZ Y NO POR TONO. URBF y FFA estan a 2° y se
distinguen porque una tiene luz 0.51 y la otra 0.11. TWR y TFC, a 8°, igual.

Asi que RZ entra en el hueco OSCURO del azul: 0.17 contra 0.34 de FTN y 0.62
de DRA. Funciona con una condicion: si DRA se va a cielo nocturno, DRA y RZ
quedan mismo tono Y misma luz. Las dos cosas no pueden pasar.

Por eso las dos ultimas de esta hoja son el mismo diseño en CIAN (200°), que
es el unico hueco de tono grande que queda —entre FRZ en 179 y FTN en 230— y
sirve para ver la salida B: RZ se corre y DRA se queda con el cielo.

⚠️ Y un choque que cause yo hoy: al pasar EFA al cobre de su logo quedo en
20°/0.40 y SR esta en 24°/0.40. Mismo tono y misma luz. Antes EFA era
#3A2412 con luz 0.15 y estaba bien separado. Hay que corregirlo aparte.
"""
import asyncio
import base64
import math
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
ESC = b64(os.path.join(BASE, 'comun', 'escudos_cuad', 'sv_rz.png'))
t = emblema.tono

AZUL = '#08145C'      # tono 232 · luz 0.20 · el hueco oscuro del azul
CIAN = '#064A6E'      # tono 201 · luz 0.23 · el hueco de tono que queda
AC = '#59C6FF'


def fondo(base):
    return (f'linear-gradient(170deg,{t(base,.30)} 0%,{t(base,-.16)} 44%,'
            f'#03050F 100%)')


def rayo(x0, y0, tramos, ancho=140, alto=250, semilla=3):
    """Un rayo quebrado: linea en zigzag con brillo."""
    r = random.Random(semilla)
    pts = [(x0, y0)]
    for i in range(1, tramos + 1):
        pts.append((x0 + r.uniform(-ancho / 2, ancho / 2) * (i / tramos * 1.4),
                    y0 + alto * i / tramos))
    d = 'M' + ' L'.join('%.0f,%.0f' % (x, y + MARGEN) for x, y in pts)
    return (f'<path d="{d}" fill="none" stroke="{AC}" stroke-width="7" '
            f'opacity=".16" stroke-linejoin="round" filter="url(#gl)"/>'
            f'<path d="{d}" fill="none" stroke="#EAF6FF" stroke-width="1.8" '
            f'opacity=".9" stroke-linejoin="round"/>')


def chispas(n=40, semilla=5):
    r = random.Random(semilla)
    return ''.join(
        f'<circle cx="{r.uniform(10, W-10):.0f}" '
        f'cy="{r.uniform(20, PICO.h-30) + MARGEN:.0f}" '
        f'r="{r.choice([0.8,1,1.3,1.7]):.1f}" fill="{AC}" '
        f'opacity="{r.uniform(.3,.95):.2f}"/>' for _ in range(n))


def circuito(paso=34, semilla=11):
    """Trazas ortogonales con nodos, como una placa."""
    r = random.Random(semilla)
    o = ''
    for i in range(7):
        x = 16 + i * paso + r.uniform(-6, 6)
        y0 = r.uniform(20, 120)
        y1 = y0 + r.uniform(90, 230)
        q = x + r.choice([-paso, paso])
        o += (f'<path d="M{x:.0f},{y0 + MARGEN:.0f} L{x:.0f},{y1 - 30 + MARGEN:.0f} '
              f'L{q:.0f},{y1 + MARGEN:.0f}" fill="none" stroke="{AC}" '
              f'stroke-width="1.1" opacity=".26"/>'
              f'<circle cx="{q:.0f}" cy="{y1 + MARGEN:.0f}" r="2.2" '
              f'fill="{AC}" opacity=".55"/>')
    return o


def descarga(n=14):
    o = ''
    for i in range(n):
        ang = math.radians(-90 + (i - (n - 1) / 2) * 13)
        x = W / 2 + 260 * math.cos(ang)
        y = MARGEN + 6 + 260 * math.sin(ang)
        o += (f'<line x1="{W/2}" y1="{MARGEN+6}" x2="{x:.0f}" y2="{y:.0f}" '
              f'stroke="{AC}" stroke-width="1.1" opacity=".13"/>')
    return o


FUEGO_PIE = ('radial-gradient(ellipse 80% 26% at 50% 100%,rgba(89,198,255,.62),'
             'transparent 66%),'
             'radial-gradient(ellipse 40% 16% at 26% 100%,rgba(140,220,255,.44),'
             'transparent 70%),'
             'radial-gradient(ellipse 40% 18% at 74% 100%,rgba(60,150,255,.44),'
             'transparent 70%)')
FILO = ('box-shadow:inset 0 0 0 2px rgba(89,198,255,.85),'
        'inset 0 0 34px rgba(89,198,255,.34)')

CASOS = [
 ('1 · rayo quebrado', AZUL, rayo(150, 40, 5), '', ''),
 ('2 · rayo + chispas', AZUL, rayo(126, 30, 6, semilla=9) + chispas(), '', ''),
 ('3 · fuego azul al pie', AZUL, '', FUEGO_PIE, ''),
 ('4 · fuego al pie + filo encendido', AZUL, chispas(28), FUEGO_PIE, FILO),
 ('5 · circuito · trazas de placa', AZUL, circuito(), '', ''),
 ('6 · malla eléctrica con nodos', AZUL, circuito(46, 4),
  'repeating-linear-gradient(90deg,rgba(89,198,255,.10) 0 1px,transparent 1px 24px),'
  'repeating-linear-gradient(0deg,rgba(89,198,255,.10) 0 1px,transparent 1px 24px)', ''),
 ('7 · descarga desde el emblema', AZUL, descarga() + chispas(30), '', ''),
 ('8 · plasma · el fuego envolviendo', AZUL, chispas(24),
  'radial-gradient(ellipse 54% 30% at 10% 24%,rgba(89,198,255,.34),transparent 68%),'
  'radial-gradient(ellipse 54% 30% at 92% 62%,rgba(60,150,255,.32),transparent 68%),'
  + FUEGO_PIE, ''),
 ('9 · rayo + fuego al pie', AZUL, rayo(150, 36, 5, semilla=21) + chispas(26),
  FUEGO_PIE, ''),
 ('10 · CIAN · fuego al pie + filo', CIAN, chispas(28), FUEGO_PIE, FILO),
 ('11 · CIAN · rayo + fuego', CIAN, rayo(150, 36, 5, semilla=21) + chispas(26),
  FUEGO_PIE, ''),
]


def carta(i, etq, base, svg, capa, remate):
    cid = f'z{i}'
    c = f'<div class="cap" style="background:{capa}"></div>' if capa else ''
    r = f'<div class="rem" style="{remate}"></div>' if remate else ''
    return f"""<div class="col"><div class="et">{etq}</div>
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
    <filter id="gl"><feGaussianBlur stdDeviation="4"/></filter>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})">
    <div class="fondo" style="background:{fondo(base)}"></div>{c}
    <svg class="cielo" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
      <defs><filter id="gl"><feGaussianBlur stdDeviation="4"/></filter></defs>
      {svg}</svg>
    {r}<img class="ul" src="{UL}">
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{AC}" stroke-width="9" opacity=".9"/>
      <path d="{SIL}" fill="none" stroke="{t(base,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  {emblema.pieza('RZ', base, AC, ESC)}
</div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:30px;flex-wrap:wrap;align-items:flex-start}}
.col{{text-align:center;width:{W}px;margin-bottom:28px}}
.et{{color:#EDEDF5;font-size:12.5px;font-weight:800;letter-spacing:1.1px;
  margin-bottom:16px;min-height:30px}}
.rot{{color:#EDEDF5;font-size:16px;font-weight:700;letter-spacing:1.4px;margin:6px 0 8px}}
.rot span{{color:#8A8AA0;font-weight:400;letter-spacing:0;font-size:13px}}
.aviso{{color:#8A8AA0;font-size:12.5px;margin:0 0 22px;max-width:1010px;line-height:1.55}}
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
    cuerpo = ''.join(carta(i, *c) for i, c in enumerate(CASOS))
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">RAP ZONE · ELECTRICIDAD Y FUEGO AZUL</div>'
           '<div class="aviso">El azul de RZ da tono <b>230°</b>, que es exactamente '
           'el de FTN (230°) y el de DRA (231°). Lo que salva a la paleta es que '
           '<b>los diez se separan por luz y no por tono</b> —URBF y FFA están a 2° '
           'y se distinguen 0.51 contra 0.11—, así que RZ entra en el hueco oscuro '
           'del azul con luz 0.17.<br><br>'
           'Eso funciona <b>con una condición</b>: si DRA se va a cielo nocturno, '
           'DRA y RZ quedan mismo tono y misma luz. Por eso las dos últimas son el '
           'mismo diseño en <b>cian (201°)</b>, el único hueco de tono grande que '
           'queda entre FRZ y FTN: sirven para ver la salida en la que RZ se corre '
           'y DRA se queda con el cielo.</div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'rz_electrico.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1400, 'height': 1200},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2800)
        await pg.screenshot(path=os.path.join(SCR, 'rz_electrico.png'), full_page=True)
        await b.close()
    print('-> rz_electrico.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
