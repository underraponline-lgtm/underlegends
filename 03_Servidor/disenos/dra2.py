"""DRA · seis fondos NUEVOS.

Sigue el mundo de la corona, pero por otros caminos. Y dos son refinados del
2 y del 4, que eran los que iban ganando:
  · los rayos, contenidos arriba para que no crucen las stats
  · los rombos, mas grandes y corridos fuera de la zona de texto
"""
import asyncio, base64, os
from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
ESCUDO = ('polygon(0% 3%, 3% 0%, 97% 0%, 100% 3%, 100% 79%, 97% 86%, 88% 92%, '
          '66% 97.5%, 50% 100%, 34% 97.5%, 12% 92%, 3% 86%, 0% 79%)')
A, AC = '#3D5BFF', '#FFFFFF'


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


UL = b64(os.path.join(BASE, '02_Competitivo', 'ul_blanco.png'))
ESC = b64(os.path.join(BASE, 'comun', 'escudos_cuad', 'sv_dra.png'))
# av_valen.png si esta, y un cartel que DICE «MUESTRA» si no.
# Antes era `b64(os.path.join(SCR, 'av_valen.png'))` en 44 archivos,
# y al importar cualquiera de ellos se leia del disco la foto de una
# persona. Ver 03_Servidor/disenos/_muestra.py.
from _muestra import cara_muestra
FOTO = cara_muestra()


def t(c, f):
    h = c.lstrip('#'); r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    if f >= 0: r, g, b = (int(x + (255-x)*f) for x in (r, g, b))
    else:      r, g, b = (int(x*(1+f)) for x in (r, g, b))
    return '#%02X%02X%02X' % (r, g, b)


o, c = t(A, -.62), t(A, .22)
FUERTE = f'linear-gradient(166deg,{t(A,.40)} 0%,{A} 42%,{t(A,-.70)} 100%)'

FONDOS = [
 ('7 · rayos contenidos arriba',
  'repeating-conic-gradient(from 202deg at 50% -6%,'
  'rgba(255,255,255,.16) 0deg 4deg,transparent 4deg 11deg) 0 0/100% 52% no-repeat,'
  f'radial-gradient(ellipse 90% 44% at 50% -2%,{t(A,.44)},transparent 70%),'
  + FUERTE),

 ('8 · rombos grandes, fuera del texto',
  'linear-gradient(45deg,rgba(255,255,255,.12) 0 2px,transparent 2px 46px) 0 0/100% 40% no-repeat,'
  'linear-gradient(-45deg,rgba(255,255,255,.12) 0 2px,transparent 2px 46px) 0 0/100% 40% no-repeat,'
  'linear-gradient(45deg,rgba(255,255,255,.09) 0 2px,transparent 2px 46px) 0 100%/100% 22% no-repeat,'
  'linear-gradient(-45deg,rgba(255,255,255,.09) 0 2px,transparent 2px 46px) 0 100%/100% 22% no-repeat,'
  + FUERTE),

 ('9 · arcos concéntricos',
  'radial-gradient(circle at 50% -6%,transparent 0 30%,rgba(255,255,255,.13) 30% 32%,transparent 32%),'
  'radial-gradient(circle at 50% -6%,transparent 0 48%,rgba(255,255,255,.11) 48% 50%,transparent 50%),'
  'radial-gradient(circle at 50% -6%,transparent 0 66%,rgba(255,255,255,.09) 66% 68%,transparent 68%),'
  + FUERTE),

 ('10 · foco central · manto de terciopelo',
  f'radial-gradient(ellipse 76% 46% at 50% 30%,{t(A,.46)} 0%,{A} 48%,{t(A,-.72)} 100%)'),

 ('11 · V grande de realeza',
  'linear-gradient(150deg,transparent 0 44%,rgba(255,255,255,.16) 44% 49%,transparent 49%),'
  'linear-gradient(210deg,transparent 0 44%,rgba(255,255,255,.16) 44% 49%,transparent 49%),'
  + FUERTE),

 ('12 · bandas verticales anchas',
  f'linear-gradient(90deg,{t(A,.16)} 0 26%,{t(A,-.20)} 26% 50%,'
  f'{t(A,.06)} 50% 74%,{t(A,-.32)} 74% 100%),'
  'linear-gradient(180deg,rgba(255,255,255,.14) 0 22%,transparent 52%),'
  'linear-gradient(180deg,transparent 0 68%,rgba(0,0,0,.34) 100%)'),
]


def carta(etq, fondo):
    return f"""<div class="col"><div class="et">{etq}</div>
<div class="wrap"><div class="marco"><div class="panel">
  <div class="fondo" style="background:{fondo}"></div>
  <div class="foto"><img src="{FOTO}"></div>
  <div class="izq"><div class="num">81</div><div class="rng">S</div>
    <img class="ban" src="https://flagcdn.com/w80/ar.png">
    <div class="rk"><span><b>#2</b><u>COMP</u></span><span><b>#4</b><u>TEMP</u></span></div>
  </div>
  <div class="nom">VALEN</div><div class="regla"></div>
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
.fila{{display:flex;gap:34px;flex-wrap:wrap}}
.col{{text-align:center}}
.et{{color:#B0B0C4;font-size:12px;letter-spacing:1.2px;margin-bottom:14px;text-transform:uppercase}}
.rot{{color:#EDEDF5;font-size:15px;font-weight:700;letter-spacing:1.3px;margin:6px 0 20px}}
.rot span{{color:#8A8AA0;font-weight:400;letter-spacing:0;text-transform:none}}
.wrap{{position:relative;width:300px;height:438px}}
.marco{{position:absolute;inset:0;clip-path:{ESCUDO};background:{t(A,-.68)};
  filter:drop-shadow(0 12px 26px rgba(0,0,0,.7))}}
.panel{{position:absolute;inset:4px;clip-path:{ESCUDO};overflow:hidden;
  box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.26)}}
.fondo{{position:absolute;inset:0;z-index:0}}
.foto{{position:absolute;top:12.5%;left:50%;transform:translateX(-50%);width:36%;height:23%;
  border-radius:13px;overflow:hidden;z-index:4;border:2.5px solid #fff;
  box-shadow:0 6px 18px rgba(0,0,0,.8)}}
.foto img{{width:100%;height:100%;object-fit:cover;object-position:center 16%}}
.izq{{position:absolute;top:6%;left:7%;z-index:5;display:flex;flex-direction:column;align-items:flex-start}}
.num{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:2rem;font-weight:900;color:#fff;line-height:.82;
  text-shadow:0 2px 5px rgba(0,0,0,.9)}}
.rng{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:.76rem;font-weight:900;color:#fff;line-height:1;
  margin-top:2px;text-shadow:0 1px 3px rgba(0,0,0,.9)}}
.ban{{width:22px;height:16px;border-radius:3px;object-fit:cover;margin-top:5px;
  box-shadow:0 2px 5px rgba(0,0,0,.7),0 0 0 1.5px rgba(255,255,255,.8)}}
.rk{{display:flex;flex-direction:column;gap:3px;margin-top:5px}}
.rk span{{display:flex;align-items:baseline;gap:3px;background:rgba(0,0,0,.46);
  border:1px solid rgba(255,255,255,.30);border-radius:5px;padding:1px 5px 2px}}
.rk b{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:.58rem;font-weight:900;color:#fff}}
.rk u{{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-size:.24rem;font-weight:900;
  letter-spacing:.6px;opacity:.62;color:#fff}}
.nom{{position:absolute;top:39%;left:0;right:0;text-align:center;z-index:5;
  font-family:'Archivo','LigaEmoji',sans-serif;font-size:1.34rem;font-weight:900;color:#fff;
  text-shadow:0 2px 4px rgba(0,0,0,.9),0 4px 16px rgba(0,0,0,.7)}}
.regla{{position:absolute;top:46%;left:14%;right:14%;height:1.5px;z-index:5;opacity:.7;
  background:linear-gradient(90deg,transparent,#fff,transparent)}}
.stats{{position:absolute;top:49.5%;left:9%;right:9%;z-index:5;
  display:grid;grid-template-columns:1fr 1fr;row-gap:5px;column-gap:8px}}
.stats div{{display:flex;align-items:baseline;gap:4px;justify-content:center}}
.stats b{{font-family:'Barlow Condensed','LigaEmoji',sans-serif;font-size:1.12rem;font-weight:700;color:#fff;
  text-shadow:0 2px 4px rgba(0,0,0,.9)}}
.stats u{{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-size:.35rem;font-weight:900;
  letter-spacing:.7px;color:#fff;opacity:.7}}
.ul{{position:absolute;left:50%;top:1.4%;transform:translateX(-50%);width:11%;z-index:8;
  opacity:.92;filter:drop-shadow(0 2px 4px rgba(0,0,0,.92))}}
.gema{{position:absolute;left:50%;bottom:1%;transform:translateX(-50%) rotate(45deg);
  width:19%;height:19%;z-index:8;border-radius:6px;background:{t(A,-.5)};
  box-shadow:0 5px 15px rgba(0,0,0,.9),inset 0 0 0 2px {AC};
  display:flex;align-items:center;justify-content:center;overflow:hidden}}
.gema img{{width:74%;transform:rotate(-45deg);border-radius:4px}}
"""


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'), encoding='utf-8').read()
    cuerpo = ''.join(carta(e, f) for e, f in FONDOS)
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">DRA · SEIS NUEVOS <span>— el 7 y el 8 son el 2 y el 4 refinados '
           'para que no crucen las stats</span></div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'dra2.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1120, 'height': 1100}, device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2200)
        await pg.screenshot(path=os.path.join(SCR, 'dra2.png'), full_page=True)
        await b.close()
    print('-> dra2.png')

asyncio.run(main())
