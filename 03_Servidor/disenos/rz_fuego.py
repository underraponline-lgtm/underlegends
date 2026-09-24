"""RZ · FUEGO de verdad, no iluminacion.

Lo anterior era un radial-gradient: ilumina desde abajo y nada mas. No tiene
lengua, ni borde recortado, ni variacion a lo ancho. Dlx lo marco enseguida.

El fuego de esta hoja sale de herramientas/generar_fuego.py, que no lo
DIBUJA sino que lo SIMULA: fila caliente abajo con focos separados, cada
fila de arriba promedia a sus vecinas de abajo y se enfria un poco al azar,
y cada pixel se corre uno al costado. Tiene forma de fuego porque se
comporta como fuego.

Dos errores que hubo que corregir midiendo, no mirando:

  · el divisor del promedio era 4.02 y los pesos sumaban 5, asi que el fuego
    se AMPLIFICABA en vez de enfriarse: tinta 100% y llama llegando al tope.
    Con 5.02 cada fila sale mas fria que la anterior y la llama termina.
  · el titileo lo aplicaba a la fila entera, asi que las columnas subian
    paralelas y el fuego salia con la PUNTA PLANA, como bloques. Va pixel
    por pixel: ahi cada lengua serpentea y se afina al subir.

La textura sale en gris con alfa. El color lo pone la carta, asi que el
mismo fuego sirve azul para RZ y naranja para quien haga falta.
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
FONDO = (f'linear-gradient(170deg,{t(AZUL,.28)} 0%,{t(AZUL,-.20)} 46%,'
         f'#03050F 100%)')


def llama(cual='fuego', alto='58%', pos='bottom', op='.95', color=None,
          ancho='100%'):
    """El fuego como MASCARA: la forma la da la textura, el color la carta.

    Va como mask y no como imagen de fondo porque asi el fuego puede llevar
    un degrade —blanco en la base, azul en las puntas— igual que el fuego de
    verdad, que es mas claro donde esta mas caliente.
    """
    c = color or (f'linear-gradient(0deg,#DDF2FF 0%,{AC} 26%,'
                  f'#2A6FE0 62%,rgba(20,60,180,0) 100%)')
    u = tx(cual)
    return (f'background:{c};'
            f'-webkit-mask-image:url({u});mask-image:url({u});'
            f'-webkit-mask-size:{ancho} {alto};mask-size:{ancho} {alto};'
            f'-webkit-mask-position:{pos};mask-position:{pos};'
            f'-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;'
            f'opacity:{op}')


def chispas(n=26, semilla=5, arriba=200):
    r = random.Random(semilla)
    return ''.join(
        f'<circle cx="{r.uniform(12, W-12):.0f}" '
        f'cy="{r.uniform(arriba, PICO.h-40) + MARGEN:.0f}" '
        f'r="{r.choice([0.8,1,1.3,1.7]):.1f}" fill="{AC}" '
        f'opacity="{r.uniform(.35,.95):.2f}"/>' for _ in range(n))


EST = (f'background-image:url({tx("estatica")});background-size:cover;'
       'background-repeat:repeat;mix-blend-mode:overlay;opacity:.42;'
       '-webkit-mask-image:linear-gradient(180deg,transparent 0 30%,#000 88%);'
       'mask-image:linear-gradient(180deg,transparent 0 30%,#000 88%)')
FILO = ('box-shadow:inset 0 0 0 2px rgba(89,198,255,.85),'
        'inset 0 0 34px rgba(89,198,255,.30)')

CASOS = [
 ('1 · fuego al pie', [llama('fuego', '52%')], ''),
 ('2 · fuego bajo · brasas', [llama('fuego_bajo', '30%')], ''),
 ('3 · fuego alto · llega a media carta', [llama('fuego', '74%')], ''),
 ('4 · fuego + estática donde arde', [llama('fuego', '54%'), EST], ''),
 ('5 · fuego + filo encendido', [llama('fuego', '52%')], FILO),
 ('6 · fuego por los tres bordes',
  [llama('fuego', '46%'),
   llama('fuego_lado', '100%', 'left', '.72', ancho='30%'),
   llama('fuego_lado', '100%', 'right', '.72', ancho='30%')], ''),
 ('7 · fuego frío · más azul, menos blanco',
  [llama('fuego', '56%', color=f'linear-gradient(0deg,{AC} 0%,#2A6FE0 40%,'
         'rgba(20,60,180,0) 100%)')], ''),
 ('8 · fuego + estática + filo', [llama('fuego', '56%'), EST], FILO),
 ('9 · brasas + estática', [llama('fuego_bajo', '34%'), EST], FILO),
]


def carta(i, etq, capas, remate):
    cid = f'f{i}'
    cs = ''.join(f'<div class="cap" style="{c}"></div>' for c in capas)
    r = f'<div class="rem" style="{remate}"></div>' if remate else ''
    return f"""<div class="col"><div class="et">{etq}</div>
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})">
    <div class="fondo" style="background:{FONDO}"></div>{cs}
    <svg class="cielo" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
      {chispas(24, i + 3)}</svg>
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
           '<div class="rot">RAP ZONE · FUEGO DE VERDAD</div>'
           '<div class="aviso">Lo anterior era un degradado: ilumina desde abajo y '
           'nada más, sin lengua ni borde. Este fuego no está dibujado, está '
           '<b>simulado</b> —fila caliente abajo, cada fila de arriba promedia a sus '
           'vecinas y se enfría al azar, cada píxel se corre uno al costado— así que '
           'tiene forma de fuego porque se comporta como fuego.<br><br>'
           'Va como <b>máscara</b> y no como imagen: la forma la da la simulación y '
           'el color lo pone la carta, con un degradé que va de blanco en la base a '
           'azul en las puntas, igual que el fuego real, que es más claro donde está '
           'más caliente.</div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'rz_fuego.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1060, 'height': 1200},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2800)
        await pg.screenshot(path=os.path.join(SCR, 'rz_fuego.png'), full_page=True)
        await b.close()
    print('-> rz_fuego.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
