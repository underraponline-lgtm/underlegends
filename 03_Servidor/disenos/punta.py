"""SILUETA NUEVA de la Servidor: la punta de arriba.

Se cambia la FIGURA, todavia no el marco.

Que cambia respecto de la biselada de 300x438:
  · sube a 300x470 y el tope termina en PUNTA
  · en la punta van las ESTRELLAS y abajo de ellas el ESCUDO del servidor
    (el lugar equivalente al "PRE" de la Competitiva)
  · el UL baja al pie
  · las esquinas y el cierre de abajo pasan a ser CURVAS

Ojo: polygon() solo une puntos con rectas, por eso la forma pasa a ser un
path SVG. El borde se dibuja como un stroke RECORTADO POR SU PROPIA CURVA,
que es el metodo de 02_Competitivo/v2/shield.py: si en cambio se desplazara
el contorno por su normal, en los valles de la punta las normales se cruzan
y sale un artefacto con forma de bigote.

Las seis variantes comparten el FONDO DE ABAJO a proposito. Lo unico que se
esta eligiendo es la punta.
"""
import asyncio, base64, json, os
from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
W, H = 300, 470


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

A, AC = '#600816', '#F2E9E9'          # TFC, el fondo aprobado
FONDO = f'repeating-linear-gradient(180deg,{A} 0 30px,#3F050E 30px 60px)'

# El cierre de abajo es COMPARTIDO: solo se esta eligiendo la punta.
BOT = 'L292,332 C292,398 236,438 150,468 C64,438 8,398 8,332'

# (etiqueta, tope del path, y de las estrellas, cy del escudo, lado del escudo)
VARIANTES = [
 ('1 · punta ancha',
  'M8,112 Q8,84 50,52 Q100,14 150,3 Q200,14 250,52 Q292,84 292,112',
  24, 80, 54),

 ('2 · banderín',
  'M8,92 Q8,68 30,68 L98,68 Q109,68 113,57 L124,20 Q131,3 150,3 '
  'Q169,3 176,20 L187,57 Q191,68 202,68 L270,68 Q292,68 292,92',
  22, 74, 50),

 ('3 · cúpula',
  'M8,128 C8,56 70,3 150,3 C230,3 292,56 292,128',
  26, 84, 58),

 ('4 · hombros rectos',
  'M8,90 Q8,62 30,62 L100,62 L145,6 Q150,0 155,6 L200,62 L270,62 Q292,62 292,90',
  22, 78, 48),

 ('5 · ojiva',
  'M8,130 C8,72 62,26 143,4 Q150,2 157,4 C238,26 292,72 292,130',
  26, 86, 56),

 ('6 · punta con valles',
  'M8,106 Q8,80 40,68 Q78,54 100,62 Q116,68 124,46 Q133,16 150,3 '
  'Q167,16 176,46 Q184,68 200,62 Q222,54 260,68 Q292,80 292,106',
  24, 80, 52),
]

ESTRELLA = ('M12 2 L14.9 8.9 L22.4 9.5 L16.7 14.4 L18.4 21.7 L12 17.8 '
            'L5.6 21.7 L7.3 14.4 L1.6 9.5 L9.1 8.9 Z')


def fila_estrellas(n, y, lado=15):
    if not n:
        return ''
    paso = lado + 3
    x0 = W / 2 - (n * paso - 3) / 2
    ss = ''.join(
        f'<svg class="est" viewBox="0 0 24 24" width="{lado}" height="{lado}" '
        f'style="left:{x0 + i*paso:.1f}px;top:{y}px"><path d="{ESTRELLA}"/></svg>'
        for i in range(n))
    return ss


def carta(i, etq, tope, y_est, cy_esc, lado, n_est):
    cid = f'p{i}'
    d = f'{tope} {BOT} Z'
    esc_top = cy_esc - lado / 2
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
      <path d="{d}" fill="none" stroke="{AC}" stroke-width="11" opacity=".9"/>
      <path d="{d}" fill="none" stroke="#2A0308" stroke-width="4"/>
    </g>
  </svg>

  {fila_estrellas(n_est, y_est)}
  <div class="esc" style="top:{esc_top}px;width:{lado}px;height:{lado}px">
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
  filter:drop-shadow(0 1px 2px rgba(0,0,0,.9))}}
.esc{{position:absolute;left:50%;transform:translateX(-50%);z-index:9;
  border-radius:9px;overflow:hidden;
  box-shadow:0 4px 12px rgba(0,0,0,.9),0 0 0 2px {AC}}}
.esc img{{width:100%;height:100%;display:block}}
.foto{{position:absolute;top:120px;left:50%;transform:translateX(-50%);width:104px;height:96px;
  border-radius:13px;overflow:hidden;z-index:4;border:2.5px solid {AC};
  box-shadow:0 6px 18px rgba(0,0,0,.82)}}
.foto img{{width:100%;height:100%;object-fit:cover;object-position:center 16%}}
.izq{{position:absolute;top:126px;left:26px;z-index:5;display:flex;flex-direction:column;align-items:flex-start}}
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
.nom{{position:absolute;top:230px;left:0;right:0;text-align:center;z-index:5;
  font-family:'Archivo','LigaEmoji',sans-serif;font-size:1.34rem;font-weight:900;color:#fff;
  text-shadow:0 2px 4px rgba(0,0,0,.95),0 4px 16px rgba(0,0,0,.78)}}
.stats{{position:absolute;top:266px;left:34px;right:34px;z-index:5;
  display:grid;grid-template-columns:1fr 1fr;row-gap:6px;column-gap:8px}}
.stats div{{display:flex;align-items:baseline;gap:4px;justify-content:center}}
.stats b{{font-family:'Barlow Condensed','LigaEmoji',sans-serif;font-size:1.12rem;font-weight:700;color:#fff;
  text-shadow:0 2px 4px rgba(0,0,0,.95)}}
.stats u{{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-size:.35rem;font-weight:900;
  letter-spacing:.7px;color:#fff;opacity:.72}}
.ul{{position:absolute;left:50%;bottom:52px;transform:translateX(-50%);width:34px;z-index:8;
  opacity:.92;filter:drop-shadow(0 2px 4px rgba(0,0,0,.95))}}
"""


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'), encoding='utf-8').read()
    n = ESTRELLAS['TFC']
    cuerpo = ''.join(carta(i, *v, n) for i, v in enumerate(VARIANTES))
    # control: la misma punta 1 con 3 estrellas, que es el maximo historico (EDF)
    prueba = carta(99, '1 · prueba con 3 estrellas (el máximo, el de EDF)',
                   *VARIANTES[0][1:], 3)
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">LA PUNTA <span>— escudo del servidor arriba con sus '
           'estrellas, UL al pie, curvas en vez de biseles. TFC tiene 1 estrella '
           'de verdad</span></div>'
           '<div class="fila">' + cuerpo + prueba + '</div></body></html>')
    out = os.path.join(SCR, 'punta.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1100, 'height': 1200}, device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2400)
        await pg.screenshot(path=os.path.join(SCR, 'punta.png'), full_page=True)
        await b.close()
    print('-> punta.png')

asyncio.run(main())
