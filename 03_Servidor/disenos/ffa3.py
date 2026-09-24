"""FFA · sobre la base del 5 (estatica + filo), ocho cosas para sumarle.

Ideas del mundo del neon y la noche: linea de escaneo de TV, grilla en
perspectiva, tubos de neon, glitch, piso mojado, halftone.
"""
import asyncio, base64, os
from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(SCR, 'texturas')
ESCUDO = ('polygon(0% 3%, 3% 0%, 97% 0%, 100% 3%, 100% 79%, 97% 86%, 88% 92%, '
          '66% 97.5%, 50% 100%, 34% 97.5%, 12% 92%, 3% 86%, 0% 79%)')
AC = '#EC48DC'


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
ESC = b64(os.path.join(BASE, 'comun', 'escudos_cuad', 'sv_ffa.png'))
def tx(n): return b64(os.path.join(TEX, n + '.png'))

# la base del 5: negro casi puro + neon fuerte, con grano de estatica y filo
BASE5 = ('radial-gradient(ellipse 62% 32% at 50% 26%,rgba(236,72,220,.52),transparent 60%),'
         'linear-gradient(168deg,#190630 0%,#090315 100%)')
GRANO = (f'background-image:url({tx("estatica")});background-size:cover;'
         'mix-blend-mode:soft-light;opacity:.14')
FILO = 'box-shadow:inset 0 0 0 2px rgba(236,72,220,.80),inset 0 0 30px rgba(236,72,220,.24)'

CASOS = [
 ('1 · el 5 · como estaba', BASE5, GRANO, FILO),

 ('2 · + líneas de escaneo de TV',
  'repeating-linear-gradient(180deg,rgba(236,72,220,.10) 0 1px,transparent 1px 4px),' + BASE5,
  GRANO, FILO),

 ('3 · + grilla en perspectiva',
  'repeating-linear-gradient(90deg,rgba(236,72,220,.16) 0 1px,transparent 1px 26px) 0 74%/100% 26% no-repeat,'
  'repeating-linear-gradient(180deg,rgba(236,72,220,.20) 0 1px,transparent 1px 9px) 0 74%/100% 26% no-repeat,'
  + BASE5, GRANO, FILO),

 ('4 · + tubos de neón verticales',
  'linear-gradient(90deg,transparent 0 12%,rgba(236,72,220,.55) 12% 12.8%,transparent 12.8%),'
  'linear-gradient(90deg,transparent 0 87%,rgba(124,58,237,.55) 87% 87.8%,transparent 87.8%),'
  + BASE5, GRANO, FILO),

 ('5 · + barras de glitch',
  'linear-gradient(180deg,transparent 0 34%,rgba(236,72,220,.28) 34% 35.6%,transparent 35.6%),'
  'linear-gradient(180deg,transparent 0 61%,rgba(124,58,237,.30) 61% 63.4%,transparent 63.4%),'
  'linear-gradient(180deg,transparent 0 79%,rgba(236,72,220,.20) 79% 80%,transparent 80%),'
  + BASE5, GRANO, FILO),

 ('6 · + piso mojado · reflejo abajo',
  BASE5 + ',radial-gradient(ellipse 74% 22% at 50% 99%,rgba(236,72,220,.44),transparent 72%)',
  GRANO, FILO),

 ('7 · + halftone',
  'radial-gradient(circle at 1.5px 1.5px,rgba(236,72,220,.22) 1.1px,transparent 1.2px) 0 0/8px 8px,'
  + BASE5, GRANO, FILO),

 ('8 · + humo tenue + reflejo',
  BASE5 + ',radial-gradient(ellipse 70% 20% at 50% 99%,rgba(124,58,237,.40),transparent 72%)',
  f'background-image:url({tx("humo")});background-size:cover;'
  'mix-blend-mode:screen;opacity:.13', FILO),
]


def carta(etq, fondo, cap, rem):
    return f"""<div class="col"><div class="et">{etq}</div>
<div class="wrap"><div class="marco"><div class="panel">
  <div class="fondo" style="background:{fondo}"></div>
  <div class="cap" style="{cap}"></div>
  <div class="rem" style="{rem}"></div>
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
</div></div>
<img class="ul" src="{UL}"><div class="gema"><img src="{ESC}"></div>
</div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:30px;flex-wrap:wrap}}
.col{{text-align:center}}
.et{{color:#B0B0C4;font-size:11.5px;letter-spacing:1.2px;margin-bottom:13px;text-transform:uppercase}}
.rot{{color:#EDEDF5;font-size:15px;font-weight:700;letter-spacing:1.3px;margin:6px 0 20px}}
.rot span{{color:#8A8AA0;font-weight:400;letter-spacing:0;text-transform:none}}
.wrap{{position:relative;width:300px;height:438px}}
.marco{{position:absolute;inset:0;clip-path:{ESCUDO};background:#12061F;
  filter:drop-shadow(0 12px 26px rgba(0,0,0,.8))}}
.panel{{position:absolute;inset:4px;clip-path:{ESCUDO};overflow:hidden}}
.fondo{{position:absolute;inset:0;z-index:0}}
.cap{{position:absolute;inset:0;z-index:1}}
.rem{{position:absolute;inset:0;z-index:2;clip-path:{ESCUDO}}}
.foto{{position:absolute;top:12.5%;left:50%;transform:translateX(-50%);width:36%;height:23%;
  border-radius:13px;overflow:hidden;z-index:4;border:2.5px solid {AC};
  box-shadow:0 6px 18px rgba(0,0,0,.9),0 0 18px rgba(236,72,220,.35)}}
.foto img{{width:100%;height:100%;object-fit:cover;object-position:center 16%}}
.izq{{position:absolute;top:6.5%;left:8%;z-index:5;display:flex;flex-direction:column;align-items:flex-start}}
.num{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:2rem;font-weight:900;color:#fff;line-height:.82;
  text-shadow:0 2px 5px rgba(0,0,0,.95)}}
.rng{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:.76rem;font-weight:900;color:{AC};line-height:1;
  margin-top:2px;text-shadow:0 1px 3px rgba(0,0,0,.95)}}
.ban{{width:22px;height:16px;border-radius:3px;object-fit:cover;margin-top:5px;
  box-shadow:0 2px 5px rgba(0,0,0,.85),0 0 0 1.5px rgba(255,255,255,.7)}}
.rk{{display:flex;flex-direction:column;gap:3px;margin-top:5px}}
.rk span{{display:flex;align-items:baseline;gap:3px;background:rgba(0,0,0,.55);
  border:1px solid rgba(236,72,220,.34);border-radius:5px;padding:1px 5px 2px}}
.rk b{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:.58rem;font-weight:900;color:#fff}}
.rk u{{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-size:.24rem;font-weight:900;
  letter-spacing:.6px;opacity:.62;color:#fff}}
.nom{{position:absolute;top:38.4%;left:0;right:0;text-align:center;z-index:5;
  font-family:'Archivo','LigaEmoji',sans-serif;font-size:1.34rem;font-weight:900;color:#fff;
  text-shadow:0 2px 4px rgba(0,0,0,.95),0 0 18px rgba(236,72,220,.30)}}
.stats{{position:absolute;top:49%;left:10%;right:10%;z-index:5;
  display:grid;grid-template-columns:1fr 1fr;row-gap:5px;column-gap:8px}}
.stats div{{display:flex;align-items:baseline;gap:4px;justify-content:center}}
.stats b{{font-family:'Barlow Condensed','LigaEmoji',sans-serif;font-size:1.12rem;font-weight:700;color:#fff;
  text-shadow:0 2px 4px rgba(0,0,0,.95)}}
.stats u{{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-size:.35rem;font-weight:900;
  letter-spacing:.7px;color:{AC};opacity:.85}}
.ul{{position:absolute;left:50%;top:1.4%;transform:translateX(-50%);width:11%;z-index:8;
  opacity:.92;filter:drop-shadow(0 2px 4px rgba(0,0,0,.95))}}
.gema{{position:absolute;left:50%;bottom:1%;transform:translateX(-50%) rotate(45deg);
  width:19%;height:19%;z-index:8;border-radius:6px;background:#150726;
  box-shadow:0 5px 15px rgba(0,0,0,.95),inset 0 0 0 2px {AC},0 0 16px rgba(236,72,220,.4);
  display:flex;align-items:center;justify-content:center;overflow:hidden}}
.gema img{{width:74%;transform:rotate(-45deg);border-radius:4px}}
"""


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'), encoding='utf-8').read()
    cuerpo = ''.join(carta(*c) for c in CASOS)
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">FFA · SOBRE LA BASE DEL 5 <span>— líneas de escaneo, grilla, '
           'tubos de neón, glitch, piso mojado, halftone</span></div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'ffa3.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1400, 'height': 1100}, device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2400)
        await pg.screenshot(path=os.path.join(SCR, 'ffa3.png'), full_page=True)
        await b.close()
    print('-> ffa3.png')

asyncio.run(main())
