"""SILUETA NUEVA de la Servidor · segunda vuelta de la punta.

Que estaba mal en punta.py:

  · EL CIERRE DE ABAJO. Use un solo cubico que bajaba recto antes de cerrar,
    y la carta salia con forma de capsula. El biselado original cierra ANCHO
    Y BAJO: sus vertices son 97%/86, 88%/92, 66%/97.5, 50%/100. Aca esos
    mismos vertices se redondean con cuadraticas en vez de unirse con rectas,
    que es lo unico que se pedia cambiar.

  · LA PUNTA ERA MUY FLACA. El escudo terminaba DEBAJO del pico en vez de
    adentro. En la Competitiva el "PRE" vive en el bolsillo del pico, no
    colgando abajo. Ahora cada pico es lo bastante ancho a la altura del
    escudo para contenerlo.

  · 470 de alto dejaba un hueco muerto entre las stats y el UL. Baja a 455.

El borde sigue siendo un stroke recortado por su propia curva (metodo de
02_Competitivo/v2/shield.py). Todavia NO es el marco: es una linea al solo
efecto de que se vea la silueta.
"""
import asyncio, base64, json, os
from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
W, H = 300, 455


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
ESC = b64(os.path.join(BASE, 'comun', 'escudos_cuad', 'sv_tfc.png'))
ESTRELLAS = json.load(open(os.path.join(BASE, 'datos', 'estrellas.json'),
                           encoding='utf-8'))['estrellas_por_servidor']

A, AC = '#600816', '#F2E9E9'
FONDO = f'repeating-linear-gradient(180deg,{A} 0 30px,#3F050E 30px 60px)'

# El cierre de abajo, COMPARTIDO: son los vertices del biselado, redondeados.
#   97%/86  ->  (291,391)     88%/92  ->  (264,419)
#   66%/97.5 -> (198,444)     50%/100 -> (150,455)
BOT = 'L292,359 Q292,384 264,419 Q232,447 150,455 Q68,447 36,419 Q8,384 8,359'

# (etiqueta, tope, y estrellas, lado estrella, cy escudo, lado escudo)
VARIANTES = [
 ('1 · punta ancha',
  'M8,124 Q8,88 54,54 Q102,14 150,4 Q198,14 246,54 Q292,88 292,124',
  24, 15, 82, 58),

 ('2 · corona trapecio',
  'M8,106 Q8,76 34,76 L94,76 L118,18 Q124,4 150,4 Q176,4 182,18 L206,76 '
  'L266,76 Q292,76 292,106',
  16, 13, 56, 50),

 ('3 · meseta',
  'M8,108 Q8,78 34,78 L92,78 L106,26 Q109,12 123,12 L177,12 Q191,12 194,26 '
  'L208,78 L266,78 Q292,78 292,108',
  17, 14, 62, 50),

 ('4 · ojiva',
  'M8,132 C8,76 58,28 142,5 Q150,3 158,5 C242,28 292,76 292,132',
  26, 15, 88, 60),

 ('5 · cúpula',
  'M8,130 C8,54 68,4 150,4 C232,4 292,54 292,130',
  26, 15, 86, 60),

 ('6 · punta con valles',
  'M8,112 Q8,84 44,72 Q86,58 106,68 Q120,75 128,44 Q136,10 150,4 '
  'Q164,10 172,44 Q180,75 194,68 Q214,58 256,72 Q292,84 292,112',
  22, 14, 76, 52),
]

ESTRELLA = ('M12 2 L14.9 8.9 L22.4 9.5 L16.7 14.4 L18.4 21.7 L12 17.8 '
            'L5.6 21.7 L7.3 14.4 L1.6 9.5 L9.1 8.9 Z')


def fila_estrellas(n, y, lado):
    if not n:
        return ''
    paso = lado + 3
    x0 = W / 2 - (n * paso - 3) / 2
    return ''.join(
        f'<svg class="est" viewBox="0 0 24 24" width="{lado}" height="{lado}" '
        f'style="left:{x0 + i*paso:.1f}px;top:{y}px"><path d="{ESTRELLA}"/></svg>'
        for i in range(n))


def carta(i, etq, tope, y_est, lado_est, cy_esc, lado, n_est):
    cid = f'q{i}'
    d = f'{tope} {BOT} Z'
    return f"""<div class="col"><div class="et">{etq}</div>
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{d}"/></clipPath>
  </defs></svg>

  <div class="cuerpo" style="clip-path:url(#{cid})">
    <div class="fondo"></div>
    <div class="foto"><img src="{FOTO}"></div>
    <div class="izq"><div class="num">81</div><div class="rng">S</div>
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
      <path d="{d}" fill="none" stroke="{AC}" stroke-width="10" opacity=".92"/>
      <path d="{d}" fill="none" stroke="#2A0308" stroke-width="3.5"/>
    </g>
  </svg>

  {fila_estrellas(n_est, y_est, lado_est)}
  <div class="esc" style="top:{cy_esc - lado/2}px;width:{lado}px;height:{lado}px">
    <img src="{ESC}"></div>
</div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:34px;flex-wrap:wrap}}
.col{{text-align:center;width:{W}px}}
.et{{color:#EDEDF5;font-size:13px;font-weight:800;letter-spacing:1.5px;margin-bottom:14px}}
.rot{{color:#EDEDF5;font-size:16px;font-weight:700;letter-spacing:1.4px;margin:6px 0 22px}}
.rot span{{color:#8A8AA0;font-weight:400;letter-spacing:0}}
.wrap{{position:relative;width:{W}px;height:{H}px;
  filter:drop-shadow(0 12px 26px rgba(0,0,0,.72))}}
.defs{{position:absolute}}
.cuerpo{{position:absolute;inset:0}}
.borde{{position:absolute;inset:0;pointer-events:none}}
.fondo{{position:absolute;inset:0;background:{FONDO}}}
.est{{position:absolute;z-index:9;fill:{AC};
  filter:drop-shadow(0 1px 2px rgba(0,0,0,.95))}}
.esc{{position:absolute;left:50%;transform:translateX(-50%);z-index:9;
  border-radius:10px;overflow:hidden;
  box-shadow:0 4px 12px rgba(0,0,0,.9),0 0 0 2px {AC}}}
.esc img{{width:100%;height:100%;display:block}}
.foto{{position:absolute;top:146px;left:50%;transform:translateX(-50%);width:104px;height:96px;
  border-radius:13px;overflow:hidden;z-index:4;border:2.5px solid {AC};
  box-shadow:0 6px 18px rgba(0,0,0,.82)}}
.foto img{{width:100%;height:100%;object-fit:cover;object-position:center 16%}}
.izq{{position:absolute;top:152px;left:26px;z-index:5;display:flex;flex-direction:column;align-items:flex-start}}
.num{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:2rem;font-weight:900;color:#fff;line-height:.82;
  text-shadow:0 2px 5px rgba(0,0,0,.95)}}
.rng{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:.76rem;font-weight:900;color:{AC};line-height:1;
  margin-top:2px;text-shadow:0 1px 3px rgba(0,0,0,.95)}}
.ban{{width:22px;height:16px;border-radius:3px;object-fit:cover;margin-top:5px;
  box-shadow:0 2px 5px rgba(0,0,0,.8),0 0 0 1.5px rgba(255,255,255,.75)}}
.rk{{display:flex;flex-direction:column;gap:3px;margin-top:5px}}
.rk span{{display:flex;align-items:baseline;gap:3px;background:rgba(0,0,0,.48);
  border:1px solid rgba(255,255,255,.28);border-radius:5px;padding:1px 5px 2px}}
.rk b{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:.58rem;font-weight:900;color:#fff}}
.rk u{{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-size:.24rem;font-weight:900;
  letter-spacing:.6px;opacity:.62;color:#fff}}
.nom{{position:absolute;top:254px;left:0;right:0;text-align:center;z-index:5;
  font-family:'Archivo','LigaEmoji',sans-serif;font-size:1.34rem;font-weight:900;color:#fff;
  text-shadow:0 2px 4px rgba(0,0,0,.95),0 4px 16px rgba(0,0,0,.78)}}
.stats{{position:absolute;top:290px;left:34px;right:34px;z-index:5;
  display:grid;grid-template-columns:1fr 1fr;row-gap:6px;column-gap:8px}}
.stats div{{display:flex;align-items:baseline;gap:4px;justify-content:center}}
.stats b{{font-family:'Barlow Condensed','LigaEmoji',sans-serif;font-size:1.12rem;font-weight:700;color:#fff;
  text-shadow:0 2px 4px rgba(0,0,0,.95)}}
.stats u{{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-size:.35rem;font-weight:900;
  letter-spacing:.7px;color:#fff;opacity:.72}}
.ul{{position:absolute;left:50%;top:396px;transform:translateX(-50%);width:34px;z-index:8;
  opacity:.92;filter:drop-shadow(0 2px 4px rgba(0,0,0,.95))}}
"""


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'), encoding='utf-8').read()
    n = ESTRELLAS['TFC']
    cuerpo = ''.join(carta(i, *v, n) for i, v in enumerate(VARIANTES))
    prueba = ''.join(carta(90 + i, VARIANTES[i][0] + ' · con 3 estrellas',
                           *VARIANTES[i][1:], 3) for i in (1, 2))
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">LA PUNTA · SEGUNDA VUELTA <span>— el cierre de abajo '
           'vuelve a ser el del biselado (ancho y bajo), solo que redondeado. '
           'TFC tiene 1 estrella de verdad; las dos últimas son la prueba con 3, '
           'que es el máximo histórico</span></div>'
           '<div class="fila">' + cuerpo + prueba + '</div></body></html>')
    out = os.path.join(SCR, 'punta2.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1100, 'height': 1200}, device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2400)
        await pg.screenshot(path=os.path.join(SCR, 'punta2.png'), full_page=True)
        await b.close()
    print('-> punta2.png')

asyncio.run(main())
