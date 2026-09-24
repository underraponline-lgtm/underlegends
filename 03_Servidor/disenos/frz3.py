"""FRZ · el 3 refinado, y un hibrido con el 2.

El problema del 3: las facetas cruzaban la franja de las stats y ensuciaban
los numeros. Cuatro formas de resolverlo sin perder el facetado.
"""
import asyncio, base64, os
from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
ESCUDO = ('polygon(0% 3%, 3% 0%, 97% 0%, 100% 3%, 100% 79%, 97% 86%, 88% 92%, '
          '66% 97.5%, 50% 100%, 34% 97.5%, 12% 92%, 3% 86%, 0% 79%)')
A, AC = '#178C88', '#CFFAF4'


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


UL = b64(os.path.join(BASE, '02_Competitivo', 'ul_blanco.png'))
ESC = b64(os.path.join(BASE, 'comun', 'escudos_cuad', 'sv_frz.png'))
FOTO = b64(os.path.join(SCR, 'av_valen.png'))


def t(c, f):
    h = c.lstrip('#'); r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    if f >= 0: r, g, b = (int(x + (255-x)*f) for x in (r, g, b))
    else:      r, g, b = (int(x*(1+f)) for x in (r, g, b))
    return '#%02X%02X%02X' % (r, g, b)


o, c = t(A, -.60), t(A, .26)
BASE_G = f'linear-gradient(166deg,{c} 0%,{o} 100%)'

FONDOS = [
 ('2 · témpano · de referencia',
  f'linear-gradient(196deg,{t(AC,-.06)} 0 38%,{t(A,-.70)} 38% 40%,transparent 40%),'
  f'linear-gradient(166deg,{t(A,.10)} 0%,{o} 100%)'),

 ('3a · facetas · como estaba',
  'linear-gradient(122deg,rgba(255,255,255,.26) 0 26%,transparent 26%),'
  'linear-gradient(-138deg,rgba(0,0,0,.30) 0 30%,transparent 30%),'
  'linear-gradient(154deg,transparent 0 54%,rgba(255,255,255,.16) 54% 70%,transparent 70%),'
  + BASE_G),

 ('3b · facetas solo arriba',
  'linear-gradient(122deg,rgba(255,255,255,.30) 0 24%,transparent 24%),'
  'linear-gradient(-138deg,rgba(0,0,0,.32) 0 26%,transparent 26%),'
  'linear-gradient(180deg,transparent 0 44%,rgba(0,0,0,.30) 52% 100%),'
  + BASE_G),

 ('3c · facetas + base oscura para las stats',
  'linear-gradient(122deg,rgba(255,255,255,.28) 0 26%,transparent 26%),'
  'linear-gradient(-138deg,rgba(0,0,0,.30) 0 30%,transparent 30%),'
  'linear-gradient(154deg,transparent 0 54%,rgba(255,255,255,.18) 54% 70%,transparent 70%),'
  f'linear-gradient(180deg,transparent 0 46%,rgba(4,30,32,.55) 56% 100%),'
  + BASE_G),

 ('3d · facetas más grandes y pocas',
  'linear-gradient(112deg,rgba(255,255,255,.30) 0 34%,transparent 34%),'
  'linear-gradient(-150deg,rgba(0,0,0,.34) 0 40%,transparent 40%),'
  f'linear-gradient(180deg,transparent 0 48%,rgba(4,30,32,.48) 60% 100%),'
  + BASE_G),

 ('3e · híbrido · témpano + facetas',
  'linear-gradient(122deg,rgba(255,255,255,.24) 0 26%,transparent 26%),'
  'linear-gradient(-138deg,rgba(0,0,0,.26) 0 30%,transparent 30%),'
  f'linear-gradient(196deg,{t(AC,-.10)} 0 38%,{t(A,-.72)} 38% 40%,transparent 40%),'
  f'linear-gradient(166deg,{t(A,.12)} 0%,{o} 100%)'),
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
.et{{color:#B0B0C4;font-size:12px;letter-spacing:1.3px;margin-bottom:14px;text-transform:uppercase}}
.rot{{color:#EDEDF5;font-size:15px;font-weight:700;letter-spacing:1.3px;margin:6px 0 20px}}
.rot span{{color:#8A8AA0;font-weight:400;letter-spacing:0;text-transform:none}}
.wrap{{position:relative;width:300px;height:438px}}
.marco{{position:absolute;inset:0;clip-path:{ESCUDO};background:{t(A,-.66)};
  filter:drop-shadow(0 12px 26px rgba(0,0,0,.7))}}
.panel{{position:absolute;inset:4px;clip-path:{ESCUDO};overflow:hidden;
  box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.24)}}
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
           '<div class="rot">FRZ · EL 3 REFINADO <span>— el problema era que las facetas '
           'cruzaban las stats. Cuatro formas de resolverlo, más un híbrido con el 2.</span></div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'frz3.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1120, 'height': 1100}, device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2200)
        await pg.screenshot(path=os.path.join(SCR, 'frz3.png'), full_page=True)
        await b.close()
    print('-> frz3.png')

asyncio.run(main())
