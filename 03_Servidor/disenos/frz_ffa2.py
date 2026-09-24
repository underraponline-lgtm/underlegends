"""FRZ = mezcla del 5 y el 6.  FFA = el 2 con cosas agregadas."""
import asyncio, base64, os
from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(SCR, 'texturas')
ESCUDO = ('polygon(0% 3%, 3% 0%, 97% 0%, 100% 3%, 100% 79%, 97% 86%, 88% 92%, '
          '66% 97.5%, 50% 100%, 34% 97.5%, 12% 92%, 3% 86%, 0% 79%)')


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
def tx(n): return b64(os.path.join(TEX, n + '.png'))


def t(c, f):
    h = c.lstrip('#'); r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    if f >= 0: r, g, b = (int(x + (255-x)*f) for x in (r, g, b))
    else:      r, g, b = (int(x*(1+f)) for x in (r, g, b))
    return '#%02X%02X%02X' % (r, g, b)


FA, FB = '#0E5F5E', '#8FE8E0'
ESM = (f'background-image:url({tx("esmerilado")});background-size:cover;'
       'mix-blend-mode:soft-light;opacity:OP')


def tempano(corte, ancho=2):
    """El corte espejado del 6, a distinta altura."""
    return (f'linear-gradient(214deg,{t(FB,-.24)} 0 {corte}%,'
            f'{t(FA,-.80)} {corte}% {corte+ancho}%,transparent {corte+ancho}%),')


FRZ = [
 ('A · corte al 30% + esmerilado suave',
  tempano(30) + f'linear-gradient(168deg,{t(FA,.06)} 0%,{t(FA,-.50)} 52%,{t(FA,-.84)} 100%)',
  ESM.replace('OP', '.40')),

 ('B · corte al 30% + esmerilado fuerte',
  tempano(30) + f'linear-gradient(168deg,{t(FA,.06)} 0%,{t(FA,-.50)} 52%,{t(FA,-.84)} 100%)',
  ESM.replace('OP', '.62')),

 ('C · corte más alto, al 22%',
  tempano(22) + f'linear-gradient(168deg,{t(FA,.14)} 0%,{t(FA,-.46)} 50%,{t(FA,-.84)} 100%)',
  ESM.replace('OP', '.55')),

 ('D · corte al 30% + faceta clara arriba',
  'linear-gradient(122deg,rgba(255,255,255,.14) 0 24%,transparent 24%),'
  + tempano(30) + f'linear-gradient(168deg,{t(FA,.06)} 0%,{t(FA,-.50)} 52%,{t(FA,-.84)} 100%)',
  ESM.replace('OP', '.55')),
]

# FFA: el 2 mas cosas
BASE2 = ('radial-gradient(ellipse 62% 32% at 50% 26%,rgba(236,72,220,.52),transparent 60%),'
         'linear-gradient(168deg,#1C0736 0%,#0B0418 54%,#050209 100%)')

FFA = [
 ('1 · el 2 · como estaba', BASE2, '', ''),

 ('2 · + filo de neón al borde', BASE2, '',
  'box-shadow:inset 0 0 0 2px rgba(236,72,220,.85),inset 0 0 30px rgba(236,72,220,.30)'),

 ('3 · + humo', BASE2,
  f'background-image:url({tx("humo")});background-size:cover;'
  'mix-blend-mode:screen;opacity:.18', ''),

 ('4 · + filo + humo + resplandor bajo',
  BASE2 + ',radial-gradient(ellipse 60% 26% at 50% 96%,rgba(124,58,237,.42),transparent 70%)',
  f'background-image:url({tx("humo")});background-size:cover;'
  'mix-blend-mode:screen;opacity:.16',
  'box-shadow:inset 0 0 0 2px rgba(236,72,220,.80),inset 0 0 34px rgba(236,72,220,.26)'),

 ('5 · + grano de estática + filo', BASE2,
  f'background-image:url({tx("estatica")});background-size:cover;'
  'mix-blend-mode:soft-light;opacity:.14',
  'box-shadow:inset 0 0 0 2px rgba(236,72,220,.80),inset 0 0 30px rgba(236,72,220,.24)'),

 ('6 · todo: filo, humo, resplandor y grano',
  BASE2 + ',radial-gradient(ellipse 60% 26% at 50% 96%,rgba(124,58,237,.40),transparent 70%)',
  f'background-image:url({tx("humo")}),url({tx("estatica")});'
  'background-size:cover,cover;mix-blend-mode:screen;opacity:.16',
  'box-shadow:inset 0 0 0 2px rgba(236,72,220,.82),inset 0 0 34px rgba(236,72,220,.28)'),
]


def carta(sv, ac, etq, fondo, cap, rem):
    c1 = f'<div class="cap" style="{cap}"></div>' if cap else ''
    c2 = f'<div class="rem" style="{rem}"></div>' if rem else ''
    return f"""<div class="col"><div class="et">{etq}</div>
<div class="wrap"><div class="marco" style="background:{t(ac,-.74)}"><div class="panel">
  <div class="fondo" style="background:{fondo}"></div>{c1}{c2}
  <div class="foto" style="border-color:{ac}"><img src="{FOTO}"></div>
  <div class="izq"><div class="num">81</div><div class="rng" style="color:{ac}">S</div>
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
<img class="ul" src="{UL}">
<div class="gema" style="box-shadow:0 5px 15px rgba(0,0,0,.9),inset 0 0 0 2px {ac}">
  <img src="{esc(sv)}"></div>
</div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:30px;flex-wrap:wrap;margin-bottom:16px}}
.col{{text-align:center}}
.et{{color:#B0B0C4;font-size:11.5px;letter-spacing:1.2px;margin-bottom:13px;text-transform:uppercase}}
.rot{{color:#EDEDF5;font-size:15px;font-weight:700;letter-spacing:1.3px;margin:14px 0 18px}}
.rot span{{color:#8A8AA0;font-weight:400;letter-spacing:0;text-transform:none}}
.wrap{{position:relative;width:300px;height:438px}}
.marco{{position:absolute;inset:0;clip-path:{ESCUDO};
  filter:drop-shadow(0 12px 26px rgba(0,0,0,.75))}}
.panel{{position:absolute;inset:4px;clip-path:{ESCUDO};overflow:hidden;
  box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.20)}}
.fondo{{position:absolute;inset:0;z-index:0}}
.cap{{position:absolute;inset:0;z-index:1}}
.rem{{position:absolute;inset:0;z-index:2;clip-path:{ESCUDO}}}
.foto{{position:absolute;top:12.5%;left:50%;transform:translateX(-50%);width:36%;height:23%;
  border-radius:13px;overflow:hidden;z-index:4;border:2.5px solid #fff;
  box-shadow:0 6px 18px rgba(0,0,0,.85)}}
.foto img{{width:100%;height:100%;object-fit:cover;object-position:center 16%}}
.izq{{position:absolute;top:6.5%;left:8%;z-index:5;display:flex;flex-direction:column;align-items:flex-start}}
.num{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:2rem;font-weight:900;color:#fff;line-height:.82;
  text-shadow:0 2px 5px rgba(0,0,0,.95)}}
.rng{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:.76rem;font-weight:900;line-height:1;
  margin-top:2px;text-shadow:0 1px 3px rgba(0,0,0,.95)}}
.ban{{width:22px;height:16px;border-radius:3px;object-fit:cover;margin-top:5px;
  box-shadow:0 2px 5px rgba(0,0,0,.8),0 0 0 1.5px rgba(255,255,255,.75)}}
.rk{{display:flex;flex-direction:column;gap:3px;margin-top:5px}}
.rk span{{display:flex;align-items:baseline;gap:3px;background:rgba(0,0,0,.5);
  border:1px solid rgba(255,255,255,.26);border-radius:5px;padding:1px 5px 2px}}
.rk b{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:.58rem;font-weight:900;color:#fff}}
.rk u{{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-size:.24rem;font-weight:900;
  letter-spacing:.6px;opacity:.62;color:#fff}}
.nom{{position:absolute;top:38.4%;left:0;right:0;text-align:center;z-index:5;
  font-family:'Archivo','LigaEmoji',sans-serif;font-size:1.34rem;font-weight:900;color:#fff;
  text-shadow:0 2px 4px rgba(0,0,0,.95),0 4px 16px rgba(0,0,0,.8)}}
.stats{{position:absolute;top:49%;left:10%;right:10%;z-index:5;
  display:grid;grid-template-columns:1fr 1fr;row-gap:5px;column-gap:8px}}
.stats div{{display:flex;align-items:baseline;gap:4px;justify-content:center}}
.stats b{{font-family:'Barlow Condensed','LigaEmoji',sans-serif;font-size:1.12rem;font-weight:700;color:#fff;
  text-shadow:0 2px 4px rgba(0,0,0,.95)}}
.stats u{{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-size:.35rem;font-weight:900;
  letter-spacing:.7px;color:#fff;opacity:.72}}
.ul{{position:absolute;left:50%;top:1.4%;transform:translateX(-50%);width:11%;z-index:8;
  opacity:.92;filter:drop-shadow(0 2px 4px rgba(0,0,0,.95))}}
.gema{{position:absolute;left:50%;bottom:1%;transform:translateX(-50%) rotate(45deg);
  width:19%;height:19%;z-index:8;border-radius:6px;background:#14141C;
  display:flex;align-items:center;justify-content:center;overflow:hidden}}
.gema img{{width:74%;transform:rotate(-45deg);border-radius:4px}}
"""


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'), encoding='utf-8').read()
    f1 = ''.join(carta('FRZ', '#8FE8E0', e, f, c, '') for e, f, c in FRZ)
    f2 = ''.join(carta('FFA', '#EC48DC', *c) for c in FFA)
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">FRZ · LA MEZCLA DEL 5 Y EL 6 <span>— corte espejado de témpano '
           '+ textura de vidrio esmerilado</span></div><div class="fila">' + f1 + '</div>'
           '<div class="rot">FFA · EL 2 CON COSAS AGREGADAS <span>— filo de neón, humo, '
           'resplandor bajo, grano</span></div><div class="fila">' + f2 + '</div></body></html>')
    out = os.path.join(SCR, 'frz_ffa2.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1400, 'height': 1200}, device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'frz_ffa2.png'), full_page=True)
        await b.close()
    print('-> frz_ffa2.png')

asyncio.run(main())
