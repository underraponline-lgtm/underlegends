"""Por que Snake Rap se ve mejor que las ultimas? Medirlo, no opinarlo.

Hipotesis: SR tiene DOS VALORES muy distintos -- naranja brillante contra
casi negro -- con un borde duro entre los dos. Las ultimas son variaciones
del MISMO valor: azul claro a azul oscuro, violeta claro a violeta oscuro.

Se mide la luminancia de cada fondo aprobado y se compara el recorrido.
"""
import asyncio, os
import numpy as np
from PIL import Image
from playwright.async_api import async_playwright

SCR = os.path.dirname(os.path.abspath(__file__))


def t(c, f):
    h = c.lstrip('#'); r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    if f >= 0: r, g, b = (int(x + (255-x)*f) for x in (r, g, b))
    else:      r, g, b = (int(x*(1+f)) for x in (r, g, b))
    return '#%02X%02X%02X' % (r, g, b)


# los fondos elegidos, tal cual
SR_A = '#C2540A'; SR_B = '#FFB03A'
TFC_A = '#600816'
TWR_A = '#C40E45'; TWR_B = '#FF5C8A'
FTN_A = '#2A3982'; FTN_B = '#E8C86A'
FRZ_A = '#178C88'; FRZ_B = '#CFFAF4'
URBF_A = '#7B44BF'
DRA_A = '#3D5BFF'

FONDOS = {
 'SR · diagonal (el mejor)':
   f'linear-gradient(146deg,{t(SR_A,.14)} 0 54%,{SR_B} 54% 58%,#1C1408 58% 100%)',
 'TFC · bandas':
   f'repeating-linear-gradient(180deg,{TFC_A} 0 30px,{t(TFC_A,-.34)} 30px 60px)',
 'TWR · diagonal + fantasma':
   f'linear-gradient(126deg,{t(TWR_A,-.52)} 0 30%,{TWR_A} 30% 46%,'
   f'{t(TWR_B,-.15)} 46% 72%,{t(TWR_A,-.4)} 72% 100%)',
 'FTN · banda dorada (6b)':
   f'linear-gradient(122deg,transparent 0 46%,rgba(232,200,106,.90) 46% 51%,'
   f'rgba(232,200,106,.26) 51% 66%,transparent 66%),'
   f'linear-gradient(166deg,{t(FTN_A,.22)} 0%,{FTN_A} 44%,{t(FTN_A,-.58)} 100%)',
 'FRZ · hibrido (3e)':
   'linear-gradient(122deg,rgba(255,255,255,.24) 0 26%,transparent 26%),'
   'linear-gradient(-138deg,rgba(0,0,0,.26) 0 30%,transparent 30%),'
   f'linear-gradient(196deg,{t(FRZ_B,-.10)} 0 38%,{t(FRZ_A,-.72)} 38% 40%,transparent 40%),'
   f'linear-gradient(166deg,{t(FRZ_A,.12)} 0%,{t(FRZ_A,-.60)} 100%)',
 'URBF · tres capas (2c)':
   f'linear-gradient(100deg,{t(URBF_A,-.56)} 0 22%,transparent 22%),'
   f'linear-gradient(-80deg,{t(URBF_A,.34)} 0 20%,transparent 20%),'
   f'linear-gradient(188deg,transparent 0 78%,{t(URBF_A,-.44)} 78% 100%),'
   f'linear-gradient(166deg,{t(URBF_A,.46)} 0%,{URBF_A} 40%,{t(URBF_A,-.72)} 100%)',
 'DRA · rayos (2)':
   'repeating-conic-gradient(from 200deg at 50% -8%,'
   'rgba(255,255,255,.14) 0deg 4deg,transparent 4deg 11deg),'
   f'radial-gradient(ellipse 90% 50% at 50% -4%,{t(DRA_A,.42)},transparent 68%),'
   f'linear-gradient(166deg,{t(DRA_A,.40)} 0%,{DRA_A} 42%,{t(DRA_A,-.70)} 100%)',
}


async def main():
    cuerpo = ''.join(
        f'<div class="m" id="m{i}" style="background:{v}"></div>'
        for i, v in enumerate(FONDOS.values()))
    pag = ('<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
           'body{margin:0;background:#000}.m{width:300px;height:438px}'
           '</style></head><body>' + cuerpo + '</body></html>')
    out = os.path.join(SCR, '_medir.html')
    open(out, 'w', encoding='utf-8').write(pag)

    print('%-30s %-8s %-8s %-9s %s' % ('fondo', 'L min', 'L max', 'recorrido', 'lectura'))
    print('-' * 78)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 340, 'height': 500}, device_scale_factor=1)
        await pg.goto('file://' + out); await pg.wait_for_timeout(900)
        import io
        for i, nombre in enumerate(FONDOS):
            el = await pg.query_selector(f'#m{i}')
            png = await el.screenshot()
            a = np.array(Image.open(io.BytesIO(png)).convert('RGB')).astype(float)
            # luminancia percibida
            L = 0.2126*a[:, :, 0] + 0.7152*a[:, :, 1] + 0.0722*a[:, :, 2]
            lo, hi = np.percentile(L, [3, 97])
            rec = hi - lo
            if rec > 110:   lect = 'DOS VALORES · alto contraste'
            elif rec > 70:  lect = 'contraste medio'
            else:           lect = 'un solo valor · plano'
            print('%-30s %6.1f %8.1f %8.1f    %s' % (nombre, lo, hi, rec, lect))
        await b.close()

asyncio.run(main())
