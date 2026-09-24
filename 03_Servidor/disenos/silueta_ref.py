"""LA SILUETA MEDIDA de ref1, aplicada a la Servidor.

No esta dibujada a ojo: sale de `herramientas/trazar_silueta.py` corrido
sobre 03_Servidor/referencia/ref1.png, que es la unica de las diez que viene
con fondo plano y sin adornos encima.

Medido:
    caja de tinta   454 x 613 px
    proporcion      0.741   ->  300 x 405
    contorno        1226 puntos -> 11 con tolerancia 1.5
    error contra el contorno crudo   medio 0.54 px   maximo 1.44 px

Ese error es sobre la imagen de 454 de ancho, asi que al escalar a 300 queda
en 0.36 px medio. Subir a 35 o 55 puntos baja el numero pero solo copia el
escalonado del antialias: no aparece ninguna curva nueva.

SIMETRIZADO A MANO despues de medir. El trazo crudo daba el centro en 150.3
y los hombros en 30.4 de un lado y 30.4 del otro, o sea que la asimetria era
de decimas de pixel: ruido del recorte, no forma. Se promedio contra x=150.

LA FORMA, EN CRIOLLO
    · arriba un pico ANCHO Y BAJO, con la punta achatada (41 px planos)
    · los laterales casi verticales, se abren 3 px en todo el recorrido
    · abajo las esquinas cortadas y dos diagonales largas que cierran en
      punta al centro

Lo que NO es: no es el escudo de la Competitiva (aquel tiene TRES picos y
proporcion 0.619) ni el biselado que teniamos (0.685, tope plano).
"""
import asyncio
import base64
import os

from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
W, H = 300, 405

# La silueta medida, simetrizada. NO redibujar a ojo: correr el trazador.
SILUETA = ('M129.2,0 L170.8,0 L296.7,30.4 L300,356.5 L292,365.4 L281.5,369.4 '
           'L150,405 L18.5,369.4 L8,365.4 L0,356.5 L3.3,30.4 Z')


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


UL = b64(os.path.join(BASE, '02_Competitivo', 'ul_blanco.png'))
# av_valen.png si esta, y un cartel que DICE «MUESTRA» si no.
# Antes era `b64(os.path.join(SCR, 'av_valen.png'))` en 44 archivos,
# y al importar cualquiera de ellos se leia del disco la foto de una
# persona. Ver 03_Servidor/disenos/_muestra.py.
from _muestra import cara_muestra
FOTO = cara_muestra()
def esc(sv): return b64(os.path.join(BASE, 'comun', 'escudos_cuad', f'sv_{sv.lower()}.png'))


def t(c, f):
    h = c.lstrip('#'); r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    if f >= 0: r, g, b = (int(x + (255-x)*f) for x in (r, g, b))
    else:      r, g, b = (int(x*(1+f)) for x in (r, g, b))
    return '#%02X%02X%02X' % (r, g, b)


# tres de los nueve fondos ya cerrados, para verla con material real
CASOS = [
 ('TFC', '#600816', '#F2E9E9',
  'repeating-linear-gradient(180deg,#600816 0 30px,#3F050E 30px 60px)'),
 ('SR', '#C2540A', '#FFB03A',
  'linear-gradient(146deg,#CB6A2C 0 54%,#FFB03A 54% 58%,#1C1408 58% 100%)'),
 ('FRZ', '#0E5F5E', '#8FE8E0',
  'linear-gradient(214deg,#3E7F7E 0 26%,#8FE8E0 26% 27.2%,transparent 27.2%),'
  'linear-gradient(214deg,transparent 0 72%,#8FE8E0 72% 73.2%,#093E3E 73.2% 100%),'
  'linear-gradient(168deg,#37817F 0%,#083737 48%,#031313 100%)'),
]


def carta(i, sv, A, AC, fondo):
    cid = f's{i}'
    return f"""<div class="col"><div class="et">{sv}</div>
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{SILUETA}"/></clipPath>
  </defs></svg>

  <div class="cuerpo" style="clip-path:url(#{cid})">
    <div class="fondo" style="background:{fondo}"></div>
    <div class="foto" style="border-color:{AC}"><img src="{FOTO}"></div>
    <div class="izq"><div class="num">81</div><div class="rng" style="color:{AC}">S</div>
      <img class="ban" src="https://flagcdn.com/w80/ar.png">
      <div class="rk"><span><b>#2</b><u>COMP</u></span><span><b>#4</b><u>TEMP</u></span></div>
    </div>
    <div class="nom">VALEN</div>
    <div class="stats">
      <div><b>11</b><u>RCH</u></div><div><b>305K</b><u>PTS</u></div>
      <div><b>57.3</b><u>WR%</u></div><div><b>18</b><u>DUE</u></div>
      <div><b>35</b><u>POD</u></div><div><b>80</b><u>EVT</u></div>
    </div>
    <img class="ul" src="{UL}">
  </div>

  <svg class="borde" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
    <g clip-path="url(#{cid})">
      <path d="{SILUETA}" fill="none" stroke="{AC}" stroke-width="9" opacity=".9"/>
      <path d="{SILUETA}" fill="none" stroke="{t(A,-.72)}" stroke-width="3"/>
    </g>
  </svg>
</div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:38px;flex-wrap:wrap;align-items:flex-start}}
.col{{text-align:center;width:{W}px}}
.et{{color:#EDEDF5;font-size:13px;font-weight:800;letter-spacing:1.5px;margin-bottom:14px}}
.rot{{color:#EDEDF5;font-size:16px;font-weight:700;letter-spacing:1.4px;margin:6px 0 22px}}
.rot span{{color:#8A8AA0;font-weight:400;letter-spacing:0}}
.wrap{{position:relative;width:{W}px;height:{H}px;
  filter:drop-shadow(0 12px 26px rgba(0,0,0,.72))}}
.defs{{position:absolute}}
.cuerpo{{position:absolute;inset:0}}
.borde{{position:absolute;inset:0;pointer-events:none}}
.fondo{{position:absolute;inset:0}}
.foto{{position:absolute;top:60px;left:50%;transform:translateX(-50%);width:104px;height:96px;
  border-radius:13px;overflow:hidden;z-index:4;border:2.5px solid #fff;
  box-shadow:0 6px 18px rgba(0,0,0,.82)}}
.foto img{{width:100%;height:100%;object-fit:cover;object-position:center 16%}}
.izq{{position:absolute;top:66px;left:26px;z-index:5;display:flex;flex-direction:column;align-items:flex-start}}
.num{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:2rem;font-weight:900;color:#fff;line-height:.82;
  text-shadow:0 2px 5px rgba(0,0,0,.95)}}
.rng{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:.76rem;font-weight:900;line-height:1;
  margin-top:2px;text-shadow:0 1px 3px rgba(0,0,0,.95)}}
.ban{{width:22px;height:16px;border-radius:3px;object-fit:cover;margin-top:5px;
  box-shadow:0 2px 5px rgba(0,0,0,.8),0 0 0 1.5px rgba(255,255,255,.75)}}
.rk{{display:flex;flex-direction:column;gap:3px;margin-top:5px}}
.rk span{{display:flex;align-items:baseline;gap:3px;background:rgba(0,0,0,.48);
  border:1px solid rgba(255,255,255,.28);border-radius:5px;padding:1px 5px 2px}}
.rk b{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:.58rem;font-weight:900;color:#fff}}
.rk u{{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-size:.24rem;font-weight:900;
  letter-spacing:.6px;opacity:.62;color:#fff}}
.nom{{position:absolute;top:166px;left:0;right:0;text-align:center;z-index:5;
  font-family:'Archivo','LigaEmoji',sans-serif;font-size:1.34rem;font-weight:900;color:#fff;
  text-shadow:0 2px 4px rgba(0,0,0,.95),0 4px 16px rgba(0,0,0,.78)}}
.stats{{position:absolute;top:202px;left:34px;right:34px;z-index:5;
  display:grid;grid-template-columns:1fr 1fr;row-gap:6px;column-gap:8px}}
.stats div{{display:flex;align-items:baseline;gap:4px;justify-content:center}}
.stats b{{font-family:'Barlow Condensed','LigaEmoji',sans-serif;font-size:1.12rem;font-weight:700;color:#fff;
  text-shadow:0 2px 4px rgba(0,0,0,.95)}}
.stats u{{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-size:.35rem;font-weight:900;
  letter-spacing:.7px;color:#fff;opacity:.72}}
.ul{{position:absolute;left:50%;top:318px;transform:translateX(-50%);width:32px;z-index:8;
  opacity:.92;filter:drop-shadow(0 2px 4px rgba(0,0,0,.95))}}
"""


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    cuerpo = ''.join(carta(i, *c) for i, c in enumerate(CASOS))
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">LA SILUETA MEDIDA DE ref1 <span>— 300 × 405, trazada '
           'del PNG y simetrizada. Todavía sin círculo y sin marco</span></div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'silueta_ref.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1080, 'height': 560},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2200)
        await pg.screenshot(path=os.path.join(SCR, 'silueta_ref.png'), full_page=True)
        await b.close()
    print('-> silueta_ref.png')

asyncio.run(main())
