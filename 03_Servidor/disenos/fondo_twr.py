"""FONDO DE TWR — seis variantes, de a una.

Metodo nuevo: se trabaja UN fondo por vez. Todo lo demas queda identico para
que la comparacion sea limpia. El marco NO es metalico: ese lenguaje es de la
Competitiva.

TWR es grafiti: su logo es un wordmark pintado, rosa sobre oscuro con tags
alrededor. Las seis variantes salen de ahi, no de una receta generica.
"""
import asyncio, base64, json, os
from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
ESCUDO = ('polygon(0% 3%, 3% 0%, 97% 0%, 100% 3%, 100% 79%, 97% 86%, 88% 92%, '
          '66% 97.5%, 50% 100%, 34% 97.5%, 12% 92%, 3% 86%, 0% 79%)')

A, AC = '#C40E45', '#FF5C8A'      # TWR: rosa oscuro + rosa vivo


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


UL = b64(os.path.join(BASE, '02_Competitivo', 'ul_blanco.png'))
SIL = b64(os.path.join(BASE, 'comun', 'logos_sv', 'sv_twr.png'))
ESC = b64(os.path.join(BASE, 'comun', 'escudos_cuad', 'sv_twr.png'))
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


o, c, m = t(A, -.52), t(A, .18), t(A, -.22)

FONDOS = {
 '1 · sangrado diagonal (el actual)':
    f'background:linear-gradient(126deg,{o} 0 30%,{A} 30% 46%,{t(AC,-.15)} 46% 72%,{t(A,-.4)} 72% 100%)',

 '2 · muro de spray':
    ('background:'
     'radial-gradient(ellipse 60% 40% at 22% 18%,rgba(255,255,255,.10),transparent 70%),'
     'radial-gradient(ellipse 50% 34% at 78% 66%,rgba(0,0,0,.34),transparent 72%),'
     'repeating-linear-gradient(94deg,rgba(0,0,0,.10) 0 1px,transparent 1px 5px),'
     'repeating-linear-gradient(4deg,rgba(255,255,255,.05) 0 1px,transparent 1px 7px),'
     f'linear-gradient(168deg,{c},{o})'),

 '3 · persiana metalica':
    ('background:'
     f'repeating-linear-gradient(90deg,{A} 0 13px,{t(A,-.30)} 13px 15px,{t(A,-.46)} 15px 17px,{t(A,-.12)} 17px 19px),'
     'linear-gradient(180deg,rgba(255,255,255,.14) 0 8%,transparent 34%)'),

 '4 · salpicadura':
    ('background:'
     'radial-gradient(circle at 18% 22%,rgba(255,92,138,.55) 0 6%,transparent 7%),'
     'radial-gradient(circle at 76% 14%,rgba(255,92,138,.40) 0 4%,transparent 5%),'
     'radial-gradient(circle at 86% 52%,rgba(255,255,255,.20) 0 3%,transparent 4%),'
     'radial-gradient(circle at 28% 74%,rgba(255,92,138,.34) 0 5%,transparent 6%),'
     'radial-gradient(circle at 60% 88%,rgba(0,0,0,.40) 0 7%,transparent 8%),'
     'radial-gradient(circle at 44% 40%,rgba(255,255,255,.10) 0 12%,transparent 13%),'
     f'linear-gradient(168deg,{c},{o})'),

 '5 · afiches rotos':
    ('background:'
     f'linear-gradient(96deg,{t(A,.10)} 0 34%,transparent 34%),'
     f'linear-gradient(-84deg,{t(A,-.44)} 0 28%,transparent 28%),'
     'linear-gradient(92deg,rgba(0,0,0,.30) 0 52%,transparent 52%),'
     'linear-gradient(180deg,transparent 0 62%,rgba(255,255,255,.09) 62% 66%,transparent 66%),'
     f'linear-gradient(168deg,{c},{o})'),

 '6 · trama de puntos':
    ('background:'
     'radial-gradient(circle at 1.5px 1.5px,rgba(0,0,0,.34) 1.2px,transparent 1.3px) 0 0/7px 7px,'
     'radial-gradient(circle at 2px 2px,rgba(255,255,255,.14) 1px,transparent 1.1px) 3px 3px/9px 9px,'
     f'linear-gradient(168deg,{t(AC,-.10)} 0%,{A} 46%,{o} 100%)'),
}


def carta(etq, fondo):
    return f"""<div class="col"><div class="et">{etq}</div>
<div class="wrap">
  <div class="marco">
    <div class="panel">
      <div class="fondo" style="{fondo}"></div>
      <div class="grano"></div>
      <div class="fantasma"></div>
      <div class="foto"><img src="{FOTO}"></div>
      <div class="izq">
        <div class="num">81</div><div class="rng">S</div>
        <img class="ban" src="https://flagcdn.com/w80/ar.png">
        <div class="rk"><span><b>#2</b><u>COMP</u></span><span><b>#4</b><u>TEMP</u></span></div>
      </div>
      <div class="nom">VALEN</div>
      <div class="regla"></div>
      <div class="stats">
        <div><b>11</b><u>RCH</u></div><div><b>305K</b><u>PTS</u></div>
        <div><b>57.3</b><u>WR%</u></div><div><b>18</b><u>DUE</u></div>
        <div><b>35</b><u>POD</u></div><div><b>80</b><u>EVT</u></div>
      </div>
    </div>
  </div>
  <img class="ul" src="{UL}">
  <div class="gema"><img src="{ESC}"></div>
</div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:34px;flex-wrap:wrap}}
.col{{text-align:center}}
.et{{color:#9A9AB0;font-size:12px;letter-spacing:1.3px;margin-bottom:14px;text-transform:uppercase}}
.rot{{color:#EDEDF5;font-size:15px;font-weight:700;letter-spacing:1.3px;margin:6px 0 18px}}
.rot span{{color:#8A8AA0;font-weight:400;letter-spacing:0;text-transform:none}}
.wrap{{position:relative;width:300px;height:438px}}
/* marco SIN metal: un canto liso del color del servidor, nada de 6 paradas */
.marco{{position:absolute;inset:0;clip-path:{ESCUDO};background:{t(A,-.62)};
  filter:drop-shadow(0 12px 26px rgba(0,0,0,.7))}}
.panel{{position:absolute;inset:4px;clip-path:{ESCUDO};overflow:hidden;
  box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.22)}}
.fondo{{position:absolute;inset:0;z-index:0}}
.grano{{position:absolute;inset:0;z-index:1;background-image:url({SIL});background-size:34px;
  opacity:.20;mix-blend-mode:soft-light}}
.fantasma{{position:absolute;inset:0;z-index:1;background-image:url({SIL});background-size:106%;
  background-position:center 40%;background-repeat:no-repeat;opacity:.16;mix-blend-mode:overlay}}
.foto{{position:absolute;top:12.5%;left:50%;transform:translateX(-50%);width:36%;height:23%;
  border-radius:13px;overflow:hidden;z-index:4;border:2.5px solid {AC};
  box-shadow:0 6px 18px rgba(0,0,0,.8)}}
.foto img{{width:100%;height:100%;object-fit:cover;object-position:center 16%}}
.izq{{position:absolute;top:6%;left:7%;z-index:5;display:flex;flex-direction:column;align-items:flex-start}}
.num{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:2rem;font-weight:900;color:#fff;line-height:.82;
  text-shadow:0 2px 5px rgba(0,0,0,.9)}}
.rng{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:.76rem;font-weight:900;color:{AC};line-height:1;margin-top:2px;
  text-shadow:0 1px 3px rgba(0,0,0,.9)}}
.ban{{width:22px;height:16px;border-radius:3px;object-fit:cover;margin-top:5px;
  box-shadow:0 2px 5px rgba(0,0,0,.7),0 0 0 1.5px rgba(255,255,255,.7)}}
.rk{{display:flex;flex-direction:column;gap:3px;margin-top:5px}}
.rk span{{display:flex;align-items:baseline;gap:3px;background:rgba(0,0,0,.46);
  border:1px solid rgba(255,255,255,.26);border-radius:5px;padding:1px 5px 2px}}
.rk b{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:.58rem;font-weight:900;color:#fff}}
.rk u{{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-size:.24rem;font-weight:900;
  letter-spacing:.6px;opacity:.62;color:#fff}}
.nom{{position:absolute;top:39%;left:0;right:0;text-align:center;z-index:5;
  font-family:'Archivo','LigaEmoji',sans-serif;font-size:1.34rem;font-weight:900;color:#fff;
  text-shadow:0 2px 4px rgba(0,0,0,.85),0 4px 16px rgba(0,0,0,.6)}}
.regla{{position:absolute;top:46%;left:14%;right:14%;height:1.5px;z-index:5;opacity:.65;
  background:linear-gradient(90deg,transparent,{AC},transparent)}}
.stats{{position:absolute;top:49.5%;left:9%;right:9%;z-index:5;
  display:grid;grid-template-columns:1fr 1fr;row-gap:5px;column-gap:8px}}
.stats div{{display:flex;align-items:baseline;gap:4px;justify-content:center}}
.stats b{{font-family:'Barlow Condensed','LigaEmoji',sans-serif;font-size:1.12rem;font-weight:700;color:#fff;
  text-shadow:0 2px 4px rgba(0,0,0,.85)}}
.stats u{{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-size:.35rem;font-weight:900;
  letter-spacing:.7px;color:#fff;opacity:.68}}
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
    cuerpo = ''.join(carta(k, v) for k, v in FONDOS.items())
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">FONDO DE TWR · SEIS VARIANTES '
           '<span>— todo lo demás idéntico. Marco liso, sin metal.</span></div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'fondo_twr.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1120, 'height': 1100}, device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2200)
        await pg.screenshot(path=os.path.join(SCR, 'fondo_twr.png'), full_page=True)
        await b.close()
    print('-> fondo_twr.png')

asyncio.run(main())
