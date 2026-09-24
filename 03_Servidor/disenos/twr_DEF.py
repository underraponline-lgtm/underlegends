"""TWR · D vs E vs F — SOLO EL FONDO.

Sin foto, sin numero, sin stats, sin nombre, sin escudo, sin UL. Nada.
Solo la silueta con el fondo, para decidir el fondo y nada mas.
"""
import asyncio, base64, os
from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
ESCUDO = ('polygon(0% 3%, 3% 0%, 97% 0%, 100% 3%, 100% 79%, 97% 86%, 88% 92%, '
          '66% 97.5%, 50% 100%, 34% 97.5%, 12% 92%, 3% 86%, 0% 79%)')
A, AC = '#C40E45', '#FF5C8A'

SIL = 'data:image/png;base64,' + base64.b64encode(
    open(os.path.join(BASE, 'comun', 'logos_sv', 'sv_twr.png'), 'rb').read()).decode()


def t(c, f):
    h = c.lstrip('#'); r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    if f >= 0: r, g, b = (int(x + (255-x)*f) for x in (r, g, b))
    else:      r, g, b = (int(x*(1+f)) for x in (r, g, b))
    return '#%02X%02X%02X' % (r, g, b)


o = t(A, -.52)
FONDO = (f'linear-gradient(126deg,{o} 0 30%,{A} 30% 46%,'
         f'{t(AC,-.15)} 46% 72%,{t(A,-.4)} 72% 100%)')

CASOS = [
 ('D · limpio', 'display:none'),
 ('E · fantasma grande y bajo',
  f'background-image:url({SIL});background-size:128%;background-position:center 74%;'
  'background-repeat:no-repeat;opacity:.26;mix-blend-mode:overlay'),
 ('F · grano muy sutil',
  f'background-image:url({SIL});background-size:26px;opacity:.10;mix-blend-mode:soft-light'),
]


def bloque(etq, cap):
    return f"""<div class="col"><div class="et">{etq}</div>
  <div class="wrap"><div class="marco"><div class="panel">
    <div class="fondo"></div><div class="cap" style="{cap}"></div>
  </div></div></div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:36px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:46px}}
.col{{text-align:center}}
.et{{color:#B0B0C4;font-size:13px;letter-spacing:1.6px;margin-bottom:18px;text-transform:uppercase}}
.rot{{color:#EDEDF5;font-size:15px;font-weight:700;letter-spacing:1.4px;margin:6px 0 22px}}
.rot span{{color:#8A8AA0;font-weight:400;letter-spacing:0;text-transform:none}}
.wrap{{position:relative;width:396px;height:578px}}
.marco{{position:absolute;inset:0;clip-path:{ESCUDO};background:{t(A,-.62)};
  filter:drop-shadow(0 14px 30px rgba(0,0,0,.72))}}
.panel{{position:absolute;inset:5px;clip-path:{ESCUDO};overflow:hidden;
  box-shadow:inset 0 0 0 2px rgba(255,255,255,.22)}}
.fondo{{position:absolute;inset:0;background:{FONDO}}}
.cap{{position:absolute;inset:0}}
"""


async def main():
    cuerpo = ''.join(bloque(*c) for c in CASOS)
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + CSS + '</style></head><body>'
           '<div class="rot">TWR · SOLO EL FONDO <span>— sin foto, número, stats, '
           'nombre, escudo ni UL</span></div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'twr_DEF.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1420, 'height': 760}, device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(1600)
        await pg.screenshot(path=os.path.join(SCR, 'twr_DEF.png'), full_page=True)
        await b.close()
    print('-> twr_DEF.png')

asyncio.run(main())
