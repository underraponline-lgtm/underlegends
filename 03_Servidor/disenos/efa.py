"""EFA · el actual + ocho caminos, varios con cuero.

EFA es bronce y laurel sobre negro: medalla, premio, condecoracion. El cuero
es un buen maridaje -- el estuche de una medalla, un cinturon de campeon, un
libro encuadernado.
"""
import asyncio, base64, os
from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(SCR, 'texturas')
ESCUDO = ('polygon(0% 3%, 3% 0%, 97% 0%, 100% 3%, 100% 79%, 97% 86%, 88% 92%, '
          '66% 97.5%, 50% 100%, 34% 97.5%, 12% 92%, 3% 86%, 0% 79%)')
A, AC = '#3A2412', '#E8A144'      # cuero oscuro + cobre


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


UL = b64(os.path.join(BASE, '02_Competitivo', 'ul_blanco.png'))
ESC = b64(os.path.join(BASE, 'comun', 'escudos_cuad', 'sv_efa.png'))
# av_valen.png si esta, y un cartel que DICE «MUESTRA» si no.
# Antes era `b64(os.path.join(SCR, 'av_valen.png'))` en 44 archivos,
# y al importar cualquiera de ellos se leia del disco la foto de una
# persona. Ver 03_Servidor/disenos/_muestra.py.
from _muestra import cara_muestra
FOTO = cara_muestra()
def tx(n): return b64(os.path.join(TEX, n + '.png'))


def t(c, f):
    h = c.lstrip('#'); r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    if f >= 0: r, g, b = (int(x + (255-x)*f) for x in (r, g, b))
    else:      r, g, b = (int(x*(1+f)) for x in (r, g, b))
    return '#%02X%02X%02X' % (r, g, b)


RADIAL = (f'repeating-conic-gradient(from 0deg at 50% 30%,rgba(232,161,68,.22) 0deg 4deg,'
          f'transparent 4deg 9deg),'
          f'radial-gradient(circle at 50% 30%,{t(AC,-.15)} 0%,{t(A,.18)} 26%,{t(A,-.50)} 100%)')
CUERO_BASE = f'linear-gradient(166deg,{t(A,.30)} 0%,{A} 44%,{t(A,-.55)} 100%)'

# (etiqueta, fondo, textura, modo, opacidad, capa extra)
CASOS = [
 ('1 · el actual · radial de medalla', RADIAL, None, '', 0, ''),

 ('2 · cuero puro', CUERO_BASE, 'cuero', 'soft-light', .55, ''),

 ('3 · cuero + radial de medalla', RADIAL, 'cuero', 'soft-light', .50, ''),

 ('4 · cuero + vivo cobre al borde', CUERO_BASE, 'cuero', 'soft-light', .55,
  f'box-shadow:inset 0 0 0 4px {AC},inset 0 0 0 6px rgba(0,0,0,.55)'),

 ('5 · cuero + tres líneas al pie', CUERO_BASE, 'cuero', 'soft-light', .55,
  f'background:linear-gradient(180deg,transparent 0 70%,{AC} 70% 71.4%,transparent 71.4% 73%,'
  f'{AC} 73% 74.4%,transparent 74.4% 76%,{AC} 76% 77.4%,transparent 77.4%)'),

 ('6 · cuero envejecido · + óxido', CUERO_BASE, 'cuero', 'soft-light', .48,
  f'background-image:url({tx("oxido")});background-size:cover;'
  'mix-blend-mode:overlay;opacity:.30'),

 ('7 · cuero craquelado', CUERO_BASE, 'cuero', 'soft-light', .45,
  f'background-image:url({tx("craquelado")});background-size:cover;'
  'mix-blend-mode:multiply;opacity:.22'),

 ('8 · cuero + destello de medalla', CUERO_BASE, 'cuero', 'soft-light', .52,
  'background:radial-gradient(ellipse 70% 34% at 50% 24%,rgba(232,161,68,.42),transparent 66%)'),

 ('9 · negro con cobre · sin cuero',
  f'linear-gradient(166deg,{t(A,-.10)} 0%,#120C06 52%,#0A0603 100%)', None, '', 0,
  f'background:linear-gradient(180deg,transparent 0 43%,{AC} 43% 45.4%,transparent 45.4%)'),
]


def carta(etq, fondo, textura, modo, op, extra):
    tex = (f'<div class="tex" style="background-image:url({tx(textura)});'
           f'mix-blend-mode:{modo};opacity:{op}"></div>') if textura else ''
    ex = f'<div class="extra" style="{extra}"></div>' if extra else ''
    return f"""<div class="col"><div class="et">{etq}</div>
<div class="wrap"><div class="marco"><div class="panel">
  <div class="fondo" style="background:{fondo}"></div>
  {tex}{ex}
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
.marco{{position:absolute;inset:0;clip-path:{ESCUDO};background:{t(A,-.60)};
  filter:drop-shadow(0 12px 26px rgba(0,0,0,.75))}}
.panel{{position:absolute;inset:4px;clip-path:{ESCUDO};overflow:hidden;
  box-shadow:inset 0 0 0 1.5px rgba(232,161,68,.30)}}
.fondo{{position:absolute;inset:0;z-index:0}}
.tex{{position:absolute;inset:0;z-index:1;background-size:cover;background-position:center}}
.extra{{position:absolute;inset:0;z-index:2;clip-path:{ESCUDO};background-repeat:no-repeat}}
.foto{{position:absolute;top:12.5%;left:50%;transform:translateX(-50%);width:36%;height:23%;
  border-radius:13px;overflow:hidden;z-index:4;border:2.5px solid {AC};
  box-shadow:0 6px 18px rgba(0,0,0,.85)}}
.foto img{{width:100%;height:100%;object-fit:cover;object-position:center 16%}}
.izq{{position:absolute;top:6.5%;left:8%;z-index:5;display:flex;flex-direction:column;align-items:flex-start}}
.num{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:2rem;font-weight:900;color:#fff;line-height:.82;
  text-shadow:0 2px 5px rgba(0,0,0,.95)}}
.rng{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:.76rem;font-weight:900;color:{AC};line-height:1;
  margin-top:2px;text-shadow:0 1px 3px rgba(0,0,0,.95)}}
.ban{{width:22px;height:16px;border-radius:3px;object-fit:cover;margin-top:5px;
  box-shadow:0 2px 5px rgba(0,0,0,.8),0 0 0 1.5px rgba(255,255,255,.7)}}
.rk{{display:flex;flex-direction:column;gap:3px;margin-top:5px}}
.rk span{{display:flex;align-items:baseline;gap:3px;background:rgba(0,0,0,.52);
  border:1px solid rgba(232,161,68,.34);border-radius:5px;padding:1px 5px 2px}}
.rk b{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:.58rem;font-weight:900;color:#fff}}
.rk u{{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-size:.24rem;font-weight:900;
  letter-spacing:.6px;opacity:.62;color:#fff}}
.nom{{position:absolute;top:38.4%;left:0;right:0;text-align:center;z-index:5;
  font-family:'Archivo','LigaEmoji',sans-serif;font-size:1.34rem;font-weight:900;color:#fff;
  text-shadow:0 2px 4px rgba(0,0,0,.95),0 4px 16px rgba(0,0,0,.75)}}
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
  width:19%;height:19%;z-index:8;border-radius:6px;background:{t(A,-.45)};
  box-shadow:0 5px 15px rgba(0,0,0,.95),inset 0 0 0 2px {AC};
  display:flex;align-items:center;justify-content:center;overflow:hidden}}
.gema img{{width:74%;transform:rotate(-45deg);border-radius:4px}}
"""


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'), encoding='utf-8').read()
    cuerpo = ''.join(carta(*c) for c in CASOS)
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">EFA · EL ACTUAL Y OCHO CAMINOS <span>— cuero y bronce: '
           'el estuche de una medalla, un cinturón de campeón</span></div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'efa.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1400, 'height': 1200}, device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2400)
        await pg.screenshot(path=os.path.join(SCR, 'efa.png'), full_page=True)
        await b.close()
    print('-> efa.png')

asyncio.run(main())
