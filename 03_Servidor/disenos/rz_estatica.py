"""RZ · estatica con fuego azul.

La idea de Dlx: juntar interferencia y fuego. Funciona porque no son dos
adornos sino causa y efecto — el fuego es la fuente y la estatica es lo que
provoca. Eso es mas que las dos cosas por separado.

⚠️ FFA YA USA ESTATICA, al 14% con soft-light, como grano de fondo. Si RZ la
usa igual, son primas. La salida es que en RZ sea PROTAGONISTA y no apoyo:
mas fuerte, y sobre todo REPARTIDA A PROPOSITO en vez de pareja. Varias de
estas la concentran donde arde el fuego y dejan limpio el resto, que es lo
que hace el calor de verdad y ademas la separa de FFA por estructura y no
solo por cantidad.

La estatica se aplica con un degradado de mascara para poder concentrarla.
mask-image no hereda del padre, asi que cada capa la lleva propia.
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
TEX = os.path.join(SCR, 'texturas')
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
def tx(n): return b64(os.path.join(TEX, n + '.png'))
t = emblema.tono

AZUL, AC = '#08145C', '#59C6FF'
FONDO = (f'linear-gradient(170deg,{t(AZUL,.30)} 0%,{t(AZUL,-.16)} 44%,'
         f'#03050F 100%)')

FUEGO = ('radial-gradient(ellipse 80% 26% at 50% 100%,rgba(89,198,255,.62),'
         'transparent 66%),'
         'radial-gradient(ellipse 40% 16% at 26% 100%,rgba(140,220,255,.44),'
         'transparent 70%),'
         'radial-gradient(ellipse 40% 18% at 74% 100%,rgba(60,150,255,.44),'
         'transparent 70%)')
FUEGO_BORDE = ('radial-gradient(ellipse 30% 60% at 0% 60%,rgba(89,198,255,.44),transparent 68%),'
               'radial-gradient(ellipse 30% 60% at 100% 46%,rgba(60,150,255,.42),transparent 68%),'
               + FUEGO)
FILO = ('box-shadow:inset 0 0 0 2px rgba(89,198,255,.85),'
        'inset 0 0 34px rgba(89,198,255,.34)')


def est(op, mez='soft-light', tam='cover', mascara=None):
    """La estatica. `mascara` la concentra donde interesa."""
    s = (f'background-image:url({tx("estatica")});background-size:{tam};'
         f'background-repeat:repeat;mix-blend-mode:{mez};opacity:{op}')
    if mascara:
        s += f';-webkit-mask-image:{mascara};mask-image:{mascara}'
    return s


ABAJO = 'linear-gradient(180deg,transparent 0%,transparent 34%,#000 88%)'
ARRIBA = 'linear-gradient(180deg,#000 0%,transparent 56%)'
BORDES = ('radial-gradient(ellipse 62% 58% at 50% 50%,transparent 40%,#000 100%)')


def chispas(n=30, semilla=5):
    r = random.Random(semilla)
    return ''.join(
        f'<circle cx="{r.uniform(10, W-10):.0f}" '
        f'cy="{r.uniform(20, PICO.h-30) + MARGEN:.0f}" '
        f'r="{r.choice([0.8,1,1.3,1.7]):.1f}" fill="{AC}" '
        f'opacity="{r.uniform(.3,.95):.2f}"/>' for _ in range(n))


ESCANEO = ('repeating-linear-gradient(180deg,rgba(89,198,255,.10) 0 1px,'
           'transparent 1px 4px)')
GLITCH = ('linear-gradient(180deg,transparent 0 31%,rgba(89,198,255,.22) 31% 33%,'
          'transparent 33% 58%,rgba(140,220,255,.16) 58% 59.4%,transparent 59.4% 74%,'
          'rgba(89,198,255,.14) 74% 75%,transparent 75%)')

CASOS = [
 ('1 · estática pareja + fuego al pie', FUEGO, est('.26'), '', ''),
 ('2 · estática fuerte · interferencia', FUEGO, est('.46', 'overlay'), '', ''),
 ('3 · estática concentrada donde arde', FUEGO, est('.60', 'overlay', mascara=ABAJO), '', ''),
 ('4 · al revés · limpia abajo, ruido arriba', FUEGO, est('.50', 'overlay', mascara=ARRIBA), '', ''),
 ('5 · ruido en los bordes, centro limpio', FUEGO_BORDE,
  est('.55', 'overlay', mascara=BORDES), '', ''),
 ('6 · estática + líneas de escaneo', FUEGO, est('.30'), ESCANEO, ''),
 ('7 · estática + bandas de glitch', FUEGO, est('.34', 'overlay'), GLITCH, ''),
 ('8 · donde arde + filo encendido', FUEGO,
  est('.60', 'overlay', mascara=ABAJO), '', FILO),
 ('9 · fuego envolvente + ruido en bordes', FUEGO_BORDE,
  est('.48', 'overlay', mascara=BORDES), '', FILO),
]


def carta(i, etq, fuego, estatica, capa, remate):
    cid = f'e{i}'
    e = f'<div class="cap" style="{estatica}"></div>' if estatica else ''
    c = f'<div class="cap" style="background:{capa}"></div>' if capa else ''
    r = f'<div class="rem" style="{remate}"></div>' if remate else ''
    return f"""<div class="col"><div class="et">{etq}</div>
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})">
    <div class="fondo" style="background:{fuego},{FONDO}"></div>
    {e}{c}
    <svg class="cielo" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
      {chispas(26, i + 3)}</svg>
    {r}<img class="ul" src="{UL}">
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{AC}" stroke-width="9" opacity=".9"/>
      <path d="{SIL}" fill="none" stroke="{t(AZUL,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  {emblema.pieza('RZ', AZUL, AC, ESC)}
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
           '<div class="rot">RAP ZONE · ESTÁTICA CON FUEGO</div>'
           '<div class="aviso">Funciona porque no son dos adornos sino <b>causa y '
           'efecto</b>: el fuego es la fuente y la estática es lo que provoca.'
           '<br><br><b>FFA ya usa estática</b>, al 14% como grano de fondo. Para que '
           'RZ no sea su prima, acá es protagonista y sobre todo va <b>repartida a '
           'propósito</b> en vez de pareja: varias la concentran donde arde y dejan '
           'limpio el resto, que es lo que hace el calor de verdad y las separa de '
           'FFA por estructura y no solo por cantidad.</div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'rz_estatica.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1060, 'height': 1200},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2800)
        await pg.screenshot(path=os.path.join(SCR, 'rz_estatica.png'), full_page=True)
        await b.close()
    print('-> rz_estatica.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
