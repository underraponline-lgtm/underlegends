"""FTN con los TRATAMIENTOS que funcionaron en TWR, no con patrones nuevos.

D y F eran etiquetas de TWR. Se toman como tratamiento:
   limpio          = D
   grano sutil     = F
   fantasma bajo   = E, el que se eligio para TWR

Se agrega el guilloche muy bajado, por si la trama sirve pero estaba fuerte.
"""
import asyncio, base64, os
from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
ESCUDO = ('polygon(0% 3%, 3% 0%, 97% 0%, 100% 3%, 100% 79%, 97% 86%, 88% 92%, '
          '66% 97.5%, 50% 100%, 34% 97.5%, 12% 92%, 3% 86%, 0% 79%)')
A, AC = '#2A3982', '#E8C86A'


def t(c, f):
    h = c.lstrip('#'); r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    if f >= 0: r, g, b = (int(x + (255-x)*f) for x in (r, g, b))
    else:      r, g, b = (int(x*(1+f)) for x in (r, g, b))
    return '#%02X%02X%02X' % (r, g, b)


SIL = 'data:image/png;base64,' + base64.b64encode(
    open(os.path.join(BASE, 'comun', 'logos_sv', 'sv_ftn.png'), 'rb').read()).decode()

o, c = t(A, -.55), t(A, .16)
# el fondo base: un degrade con mas cuerpo que el liso, sin patron
BASEBG = f'linear-gradient(166deg,{t(A,.20)} 0%,{A} 44%,{o} 100%)'

CASOS = [
 ('limpio · como el D de TWR', BASEBG, 'display:none'),

 ('grano sutil · como el F', BASEBG,
  f'background-image:url({SIL});background-size:26px;opacity:.09;mix-blend-mode:soft-light'),

 ('fantasma bajo · como el E que elegiste', BASEBG,
  f'background-image:url({SIL});background-size:126%;background-position:center 74%;'
  'background-repeat:no-repeat;opacity:.22;mix-blend-mode:overlay'),

 ('guilloché bajado a la mitad',
  'repeating-linear-gradient(52deg,rgba(232,200,106,.07) 0 1px,transparent 1px 11px),'
  'repeating-linear-gradient(-52deg,rgba(232,200,106,.07) 0 1px,transparent 1px 11px),'
  + BASEBG, 'display:none'),
]


async def main():
    cuerpo = ''
    for etq, fondo, cap in CASOS:
        cuerpo += (f'<div class="col"><div class="et">{etq}</div>'
                   f'<div class="wrap"><div class="marco"><div class="panel">'
                   f'<div class="fondo" style="background:{fondo}"></div>'
                   f'<div class="cap" style="{cap}"></div></div></div></div></div>')
    css = f"""
body{{background:#0A0A10;margin:0;padding:34px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:40px;flex-wrap:wrap}}
.col{{text-align:center}}
.et{{color:#B0B0C4;font-size:12.5px;letter-spacing:1.4px;margin-bottom:16px;text-transform:uppercase}}
.rot{{color:#EDEDF5;font-size:15px;font-weight:700;letter-spacing:1.4px;margin:6px 0 22px}}
.rot span{{color:#8A8AA0;font-weight:400;letter-spacing:0;text-transform:none}}
.wrap{{position:relative;width:344px;height:502px}}
.marco{{position:absolute;inset:0;clip-path:{ESCUDO};background:{t(A,-.62)};
  filter:drop-shadow(0 14px 30px rgba(0,0,0,.72))}}
.panel{{position:absolute;inset:5px;clip-path:{ESCUDO};overflow:hidden;
  box-shadow:inset 0 0 0 2px rgba(255,255,255,.20)}}
.fondo{{position:absolute;inset:0}}
.cap{{position:absolute;inset:0}}
"""
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + css + '</style></head><body>'
           '<div class="rot">FTN · LOS MISMOS TRATAMIENTOS QUE TWR '
           '<span>— solo el fondo, para ver si el sistema cierra entre servidores</span></div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'ftn_trat.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1600, 'height': 700}, device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(1700)
        await pg.screenshot(path=os.path.join(SCR, 'ftn_trat.png'), full_page=True)
        await b.close()
    print('-> ftn_trat.png')

asyncio.run(main())
