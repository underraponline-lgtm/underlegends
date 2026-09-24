"""RZ · el fuego DEL LOGO, extraido y llevado a la carta.

Dlx: "analiza el logo mas, ahi hay como una estetica de fuego". El fuego que
vale es el que ya trae la marca. El simulado daba lenguas de fogata; el del
logo es otra cosa: VETAS Y REMOLINOS, humo encendido, sin punta.

Medida la rampa del fuego del logo, de lo mas frio a lo mas caliente:

    p5   #000323   luz   2.4
    p50  #000740        11.2
    p75  #0014A1        27.4
    p95  #0657F6        81.4
    p99  #3A96F2       137.2

⚠️ NUNCA LLEGA AL BLANCO. Su punto mas caliente es #3A96F2, que sigue
siendo azul. Mi fuego simulado iba de blanco en la base a azul en la punta,
que es como se comporta el fuego naranja, y por eso no se parecia. Por eso
aca la textura entra CON SU PROPIO COLOR y no como mascara teñida.

Extraido con herramientas/extraer_fuego_rz.py. Dos cosas que hubo que
corregir ahi y estan anotadas en ese archivo: el halo del logo se colaba, y
al dilatarlo para restarlo cada chispa suelta se volvia un cuadrado.
"""
import asyncio
import base64
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

AZUL, AC = '#08145C', '#3A96F2'      # el acento es el punto mas caliente medido
FONDO = f'linear-gradient(170deg,#0B1550 0%,#070B2E 48%,#03050F 100%)'
FUEGO = tx('fuego_rz')


def capa(tam='115%', pos='center', op='1', mez='screen', extra=''):
    return (f'background-image:url({FUEGO});background-size:{tam};'
            f'background-position:{pos};background-repeat:no-repeat;'
            f'mix-blend-mode:{mez};opacity:{op};{extra}')


EST = (f'background-image:url({tx("estatica")});background-size:cover;'
       'background-repeat:repeat;mix-blend-mode:overlay;opacity:.34;'
       '-webkit-mask-image:linear-gradient(180deg,transparent 0 34%,#000 92%);'
       'mask-image:linear-gradient(180deg,transparent 0 34%,#000 92%)')
FILO = ('box-shadow:inset 0 0 0 2px rgba(58,150,242,.85),'
        'inset 0 0 34px rgba(58,150,242,.30)')
ESPEJO = 'transform:scaleY(-1)'

CASOS = [
 ('1 · el fuego del logo, tal cual', [capa('118%', 'center')], ''),
 ('2 · más grande · envuelve la carta', [capa('160%', 'center')], ''),
 ('3 · solo la mitad de abajo, ampliada',
  [capa('190%', 'center 76%')], ''),
 ('4 · abajo + espejado arriba',
  [capa('150%', 'center 88%'), capa('150%', 'center 88%', '.6', extra=ESPEJO)], ''),
 ('5 · el del logo + estática donde arde', [capa('130%'), EST], ''),
 ('6 · el del logo + filo encendido', [capa('130%')], FILO),
 ('7 · tenue · brasas lejanas', [capa('140%', 'center', '.55')], ''),
 ('8 · fuerte · dos capas encimadas',
  [capa('150%'), capa('108%', 'center 60%', '.8')], FILO),
 ('9 · abajo ampliado + estática + filo',
  [capa('190%', 'center 78%'), EST], FILO),
]


def carta(i, etq, capas, remate):
    cid = f'g{i}'
    cs = ''.join(f'<div class="cap" style="{c}"></div>' for c in capas)
    r = f'<div class="rem" style="{remate}"></div>' if remate else ''
    return f"""<div class="col"><div class="et">{etq}</div>
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})">
    <div class="fondo" style="background:{FONDO}"></div>{cs}{r}
    <img class="ul" src="{UL}">
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
           '<div class="rot">RAP ZONE · EL FUEGO DE SU PROPIO LOGO</div>'
           '<div class="aviso">El fuego del logo no son lenguas de fogata: son '
           '<b>vetas y remolinos</b>, humo encendido, sin punta. Por eso el simulado '
           'no se parecía.<br><br>'
           'Medida su rampa: <code>#000323 → #000740 → #0014A1 → #0657F6 → '
           '#3A96F2</code>. <b>Nunca llega al blanco</b> — su punto más caliente '
           'sigue siendo azul. Mi fuego anterior iba de blanco a azul, que es como '
           'se comporta el fuego naranja. Acá la textura entra con <b>su propio '
           'color</b>, no como máscara teñida.</div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'rz_fuego_logo.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1060, 'height': 1200},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2800)
        await pg.screenshot(path=os.path.join(SCR, 'rz_fuego_logo.png'), full_page=True)
        await b.close()
    print('-> rz_fuego_logo.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
