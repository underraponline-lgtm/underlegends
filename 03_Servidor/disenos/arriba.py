"""LA PIEZA ARRIBA: bajarla y poner las estrellas encima.

Decidido que va arriba. Lo que se prueba aca es cuanto se baja y donde caen
las estrellas.

POR QUE BAJARLA HACE QUE LAS ESTRELLAS ENTREN
---------------------------------------------
El pico es achatado: 41 px planos entre x=129.2 y x=170.8, y de ahi cae a
los hombros en y=30.4. Medido sobre ese borde:

    a y= 6  la carta mide  91 px de ancho
    a y=10                124 px
    a y=16                174 px

Tres estrellas de 15 px con 3 de aire son 51 px. Entran desde y=6, o sea
que con la pieza bajada las estrellas caen ADENTRO de la carta y no
flotando. Con la pieza pegada al pico no habia lugar y por eso antes
quedaban debajo.

La contra de bajarla: deja de sobresalir. Las ocho de abajo recorren ese
compromiso, de asomada a metida.

⚠️ La 6 CAMBIA LA SILUETA TRAZADA: le abre una muesca al pico para que la
pieza se encaje. Es la unica que toca el contorno medido; las otras siete lo
respetan.
"""
import asyncio
import base64
import os
import sys

from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
from comun.siluetas import PICO

W, H = PICO.w, PICO.h
D = PICO.d

# la 6 le abre una muesca al pico: semicirculo de r=34 entre x=116 y x=184
D_MUESCA = ('M116,4.2 A34,34 0 0 0 184,4.2 L296.7,30.4 L300,356.5 L292,365.4 '
            'L281.5,369.4 L150,405 L18.5,369.4 L8,365.4 L0,356.5 L3.3,30.4 Z')


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


ESC = b64(os.path.join(BASE, 'comun', 'escudos_cuad', 'sv_tfc.png'))

A, AC = '#600816', '#F2E9E9'
FONDO = f'repeating-linear-gradient(180deg,{A} 0 30px,#3F050E 30px 60px)'
HEX = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
EST = ('M12 2 L14.9 8.9 L22.4 9.5 L16.7 14.4 L18.4 21.7 L12 17.8 '
       'L5.6 21.7 L7.3 14.4 L1.6 9.5 L9.1 8.9 Z')

N = 1   # TFC tiene 1 estrella de verdad

CASOS = [
 dict(et='1 · círculo bajado · estrellas encima',
      forma=None, cy=58, lado=64, est='fila', ey=8, el=15),

 dict(et='2 · hexágono bajado · estrellas encima',
      forma=HEX, cy=58, lado=66, est='fila', ey=8, el=15),

 dict(et='3 · más bajo · estrellas más grandes',
      forma=None, cy=74, lado=64, est='fila', ey=12, el=20),

 dict(et='4 · asomando · estrellas a los costados',
      forma=None, cy=34, lado=64, est='costados', ey=30, el=16),

 dict(et='5 · asomando · estrellas sobre el aro',
      forma=None, cy=40, lado=68, est='arco', ey=0, el=14),

 dict(et='6 · muesca en el pico · encajada',
      forma=None, cy=22, lado=62, est='fila', ey=-26, el=14, path=D_MUESCA),

 dict(et='7 · hexágono bajado · estrellas en pastilla',
      forma=HEX, cy=62, lado=66, est='pastilla', ey=6, el=13),

 dict(et='8 · círculo bajado · aro doble',
      forma=None, cy=58, lado=64, est='fila', ey=8, el=15, doble=True),
]


def estrellas(modo, n, y, lado, cy, pieza):
    """Devuelve el HTML de las estrellas segun el modo."""
    def sv(x, yy, l, extra=''):
        return (f'<svg class="est" viewBox="0 0 24 24" width="{l}" height="{l}" '
                f'style="left:{x:.1f}px;top:{yy:.1f}px;{extra}">'
                f'<path d="{EST}"/></svg>')

    if modo == 'costados':
        # flanqueando la pieza, apoyadas en los hombros del pico.
        # ⚠️ Este modo NO puede ser simetrico con numeros impares, y hoy
        # cuatro servidores tienen exactamente 1 estrella. Se reparte
        # izquierda primero y la asimetria se ve, que es el punto: si el
        # modo no aguanta el dato real, mejor que se note ahora.
        d = pieza / 2 + 16
        izq, der = (n + 1) // 2, n // 2
        out = ''
        for i in range(izq):
            out += sv(W / 2 - d - lado * (i + 1) - 3 * i, y, lado)
        for i in range(der):
            out += sv(W / 2 + d + lado * i + 3 * i, y, lado)
        return out

    if modo == 'arco':
        # montadas sobre el borde de arriba de la pieza, siguiendo su curva
        import math
        r = pieza / 2 + lado * .58
        out = ''
        span = 42 if n > 1 else 0
        for i in range(n):
            ang = math.radians(-90 + (i - (n - 1) / 2) * span)
            out += sv(W / 2 + r * math.cos(ang) - lado / 2,
                      cy + r * math.sin(ang) - lado / 2, lado)
        return out

    paso = lado + 3
    x0 = W / 2 - (n * paso - 3) / 2
    fila = ''.join(sv(x0 + i * paso, y, lado) for i in range(n))

    if modo == 'pastilla':
        an = n * paso + 15
        return (f'<div class="past" style="top:{y - 5}px;width:{an}px;'
                f'height:{lado + 10}px"></div>' + fila)
    return fila


def carta(i, c):
    cid = f'a{i}'
    d = c.get('path', D)
    forma, cy, lado = c['forma'], c['cy'], c['lado']
    recorte = f'clip-path:{forma}' if forma else 'border-radius:50%'
    aro = '' if forma else (
        f'box-shadow:0 4px 14px rgba(0,0,0,.9),0 0 0 3px {AC}'
        + (f',0 0 0 7px {A},0 0 0 9px {AC}' if c.get('doble') else ''))
    marco = ('' if not forma else
             f'<div class="pieza-marco" style="clip-path:{forma};'
             f'top:{cy - lado/2 - 3}px;width:{lado + 6}px;height:{lado + 6}px;'
             f'background:{AC}"></div>')
    return f"""<div class="col"><div class="et">{c['et']}</div>
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{d}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})"><div class="fondo"></div></div>
  <svg class="borde" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
    <g clip-path="url(#{cid})">
      <path d="{d}" fill="none" stroke="{AC}" stroke-width="9" opacity=".9"/>
      <path d="{d}" fill="none" stroke="#2A0308" stroke-width="3"/>
    </g>
  </svg>
  {estrellas(c['est'], N, c['ey'], c['el'], cy, lado)}
  {marco}
  <div class="pieza" style="{recorte};{aro};top:{cy - lado/2}px;
       width:{lado}px;height:{lado}px"><img src="{ESC}"></div>
</div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:40px;flex-wrap:wrap}}
.col{{text-align:center;width:{W}px;margin-bottom:34px}}
.et{{color:#EDEDF5;font-size:12.5px;font-weight:800;letter-spacing:1.2px;
  margin-bottom:56px;min-height:16px}}
.rot{{color:#EDEDF5;font-size:16px;font-weight:700;letter-spacing:1.4px;margin:6px 0 22px}}
.rot span{{color:#8A8AA0;font-weight:400;letter-spacing:0}}
.wrap{{position:relative;width:{W}px;height:{H}px}}
.defs{{position:absolute}}
.cuerpo{{position:absolute;inset:0;filter:drop-shadow(0 12px 26px rgba(0,0,0,.7))}}
.borde{{position:absolute;inset:0;pointer-events:none}}
.fondo{{position:absolute;inset:0;background:{FONDO}}}
.est{{position:absolute;z-index:11;fill:{AC};
  filter:drop-shadow(0 1px 3px rgba(0,0,0,.95))}}
.past{{position:absolute;left:50%;transform:translateX(-50%);z-index:10;
  background:rgba(0,0,0,.42);border:1.5px solid {AC};border-radius:20px}}
.pieza-marco{{position:absolute;left:50%;transform:translateX(-50%);z-index:9;
  filter:drop-shadow(0 4px 12px rgba(0,0,0,.9))}}
.pieza{{position:absolute;left:50%;transform:translateX(-50%);z-index:10;
  overflow:hidden;background:#12060A}}
.pieza img{{width:100%;height:100%;display:block;object-fit:cover}}
"""


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    cuerpo = ''.join(carta(i, c) for i, c in enumerate(CASOS))
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">LA PIEZA ARRIBA <span>— bajada, con las estrellas '
           'encima. La 6 es la única que le toca la silueta</span></div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'arriba.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1420, 'height': 1080},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2200)
        await pg.screenshot(path=os.path.join(SCR, 'arriba.png'), full_page=True)
        await b.close()
    print('-> arriba.png')

asyncio.run(main())
