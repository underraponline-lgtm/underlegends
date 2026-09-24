"""DRA · la pared partida, sobre la referencia 3 de Drako.

La 3 de su hoja es un muro con una GRIETA IRREGULAR que lo cruza, con el
filo claro, y el muro corrido de un lado al otro del corte. No es un corte
diagonal: es una rotura.

⚠️ ESO ES JUSTO LO QUE LA SEPARA DE LAS QUE YA ESTAN. FRZ tiene "dos cortes
al sesgo con filos encendidos" y URBF "corte blanco duro": las dos son
RECTAS. Una grieta es quebrada y con el muro desplazado, asi que se lee como
rotura y no como corte. Si la grieta sale demasiado prolija, se convierte en
FRZ en azul.

La grieta se genera con un camino al azar de borde a borde, no dibujada: una
sucesion de tramos con desvio aleatorio, que es lo que le da el quiebre
irregular. Con puntos a mano saldria simetrica y regular, que es lo que hay
que evitar.

El muro sale de las texturas que ya estan: concreto y grietas.
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
ESC = b64(os.path.join(BASE, 'comun', 'escudos_cuad', 'sv_dra.png'))
def tx(n): return b64(os.path.join(TEX, n + '.png'))
t = emblema.tono

A, B = '#3D5BFF', '#FFFFFF'
MURO = f'linear-gradient(168deg,{t(A,-.10)} 0%,{t(A,-.42)} 50%,{t(A,-.76)} 100%)'


def y(v):
    return v + MARGEN


def grieta(y0, y1, semilla=3, tramos=11, desvio=26):
    """Un camino quebrado de borde a borde. Al azar, no a mano.

    Puesto a mano sale simetrico y regular, y ahi deja de ser una rotura y
    pasa a ser un corte, que es lo que ya tienen FRZ y URBF.
    """
    r = random.Random(semilla)
    pts = []
    for i in range(tramos + 1):
        x = -12 + (324 * i / tramos)
        base = y0 + (y1 - y0) * i / tramos
        pts.append((x, base + r.uniform(-desvio, desvio)))
    return pts


def camino(pts):
    return 'M' + ' L'.join('%.0f,%.0f' % (x, y(v)) for x, v in pts)


def partida(pts, arriba, abajo, filo=B, grosor=2.4, sombra=True):
    """Los dos lados del muro, con distinto tono, y el filo de la rotura."""
    p = camino(pts)
    poli_ar = p + f' L312,{y(-20)} L-12,{y(-20)} Z'
    poli_ab = p + f' L312,{y(430)} L-12,{y(430)} Z'
    s = (f'<path d="{p}" fill="none" stroke="#050A28" stroke-width="{grosor+3}" '
         f'opacity=".55" transform="translate(0,3)"/>') if sombra else ''
    return (f'<path d="{poli_ar}" fill="{arriba}"/>'
            f'<path d="{poli_ab}" fill="{abajo}"/>' + s +
            f'<path d="{p}" fill="none" stroke="{filo}" stroke-width="{grosor}" '
            f'stroke-linejoin="round" opacity=".92"/>')


def cap(tex, tam, mez, op):
    return (f'background-image:url({tx(tex)});background-size:{tam};'
            f'background-repeat:repeat;background-position:center;'
            f'mix-blend-mode:{mez};opacity:{op}')


CONCRETO = cap('concreto', '190px', 'overlay', '.30')
GRIETAS = cap('grietas', '150%', 'overlay', '.26')

G1 = grieta(118, 168, 3)
G2 = grieta(268, 232, 8, 9, 20)
G3 = grieta(96, 210, 15, 14, 34)

CASOS = [
 ('1 · una grieta · el muro corrido',
  partida(G1, t(A, -.02), t(A, -.46)), CONCRETO),

 ('2 · dos grietas, como la referencia',
  partida(G1, t(A, -.02), t(A, -.44)) +
  partida(G2, 'none', t(A, -.66), grosor=1.8), CONCRETO),

 ('3 · grieta más quebrada',
  partida(G3, t(A, .04), t(A, -.52), grosor=2.8), CONCRETO),

 ('4 · con textura de grietas encima',
  partida(G1, t(A, -.02), t(A, -.46)), GRIETAS),

 ('5 · filo fino, rotura sutil',
  partida(G1, t(A, -.14), t(A, -.40), grosor=1.4), CONCRETO),

 ('6 · sin filo blanco · solo el desnivel',
  partida(G1, t(A, .02), t(A, -.56), filo=t(A, -.80), grosor=2.2,
          sombra=False), CONCRETO),

 ('7 · la grieta arriba, el muro entero abajo',
  partida(grieta(78, 104, 21, 13, 18), t(A, .16), t(A, -.40)), CONCRETO),

 ('8 · dos grietas + concreto fuerte',
  partida(G1, t(A, -.02), t(A, -.44)) +
  partida(G2, 'none', t(A, -.70), grosor=1.8),
  cap('concreto', '150px', 'overlay', '.48')),

 ('9 · tres franjas rotas',
  partida(grieta(108, 132, 5, 12, 22), t(A, .08), t(A, -.38)) +
  partida(grieta(216, 244, 9, 11, 20), 'none', t(A, -.60), grosor=2.0) +
  partida(grieta(318, 300, 12, 9, 14), 'none', t(A, -.78), grosor=1.6),
  CONCRETO),
]


def carta(i, etq, svg, capa):
    cid = f'gr{i}'
    return f"""<div class="col"><div class="et">{etq}</div>
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})">
    <div class="fondo" style="background:{MURO}"></div>
    <svg class="dib" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">{svg}</svg>
    <div class="cap" style="{capa}"></div>
    <img class="ul" src="{UL}">
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
      <path d="{SIL}" fill="none" stroke="{t(A,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  {emblema.estrellas(1, W, sufijo=f'gr{i}')}
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
.cap{{position:absolute;inset:0;z-index:2}}
.ul{{position:absolute;left:50%;top:424px;transform:translateX(-50%);z-index:6;
  height:20.7px;width:auto;opacity:.94;filter:drop-shadow(0 2px 5px rgba(0,0,0,.95))}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    cuerpo = ''.join(carta(i, *c) for i, c in enumerate(CASOS))
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">DRA · LA PARED PARTIDA</div>'
           '<div class="aviso">Sobre la 3 de la hoja de Drako: un muro con una '
           '<b>grieta irregular</b> que lo cruza, con el filo claro y el muro '
           'corrido de un lado al otro. No es un corte, es una rotura.<br><br>'
           'Eso es justo lo que la separa de las que ya están: FRZ tiene «dos '
           'cortes al sesgo con filos encendidos» y URBF «corte blanco duro», y las '
           'dos son <b>rectas</b>. Si la grieta sale prolija, se convierte en FRZ en '
           'azul. Por eso el camino se genera <b>al azar</b>, tramo por tramo: '
           'puesta a mano sale simétrica y deja de leerse como rotura.</div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'dra_grieta.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1060, 'height': 1200},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2800)
        await pg.screenshot(path=os.path.join(SCR, 'dra_grieta.png'), full_page=True)
        await b.close()
    print('-> dra_grieta.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
