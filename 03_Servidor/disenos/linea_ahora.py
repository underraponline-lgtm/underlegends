"""LA LINEA COMO QUEDO, en los diez, ampliada lo suficiente para verla.

⚠️ POR QUE ESTE ARCHIVO EXISTE. Le estuve mandando a Dlx la hoja de las diez
cartas enteras para mostrarle cambios en una linea de 4.5 px. A ese tamaño no
se ve nada, y con razon dijo que no habia cambiado nada. Es exactamente el
error que el CLAUDE.md ya tiene anotado dos veces: cuando lo que mirás es mas
chico que la resolucion con la que lo mirás, el resultado no sirve. Vale para
medir Y para mostrar.

Recorta la banda de la curva y la amplia al doble, con FRZ marcado porque es
la referencia que Dlx eligio.
"""
import base64
import io
import os
import sys

from PIL import Image

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun import divisor as DIV
from comun.siluetas import PICO
from comun.emblema import MARGEN, tono
from los_nueve import defs

ESC = 3
Y0 = int(DIV.Y_EXTREMOS * PICO.h) - 30
ALTO = 62
CARP = '_todos_dF'
# el orden en que todos_sv.py arma GENTE
SV = ['TFC', 'SR', 'TWR', 'FTN', 'FRZ', 'URBF', 'DRA', 'FFA', 'EFA', 'RZ']


def b64(im):
    b = io.BytesIO()
    im.save(b, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def main():
    import todos_sv as T
    D = defs()
    cel = ''
    for i, sv in enumerate(SV):
        f = os.path.join(SCR, CARP, '%d.png' % i)
        if not os.path.exists(f):
            continue
        im = Image.open(f).convert('RGBA')
        c = im.crop((0, (Y0 + MARGEN) * ESC, im.width, (Y0 + MARGEN + ALTO) * ESC))
        # ⚠️ LAS PUNTAS SE LEEN DEL MARCO, NO SE RECALCULAN. Este pie estaba
        # imprimiendo tono(propio,-.12), que era el valor fijo de antes del
        # empalme: seguia mostrando numeros que la carta ya no usaba.
        ac, pr = D[sv][0], D[sv][1]
        pts = T.camino()
        xi, vi = pts[0]
        osc = T.color_marco_en(xi, T.y(vi), pr, ac)
        cla = T.MK.claro(pr)
        ref = ' ref' if sv == 'FRZ' else ''
        cel += (f'<div class="g{ref}"><div class="gl">{sv}'
                f'{" — LA REFERENCIA" if sv == "FRZ" else ""}</div>'
                f'<img src="{b64(c)}">'
                f'<div class="gs"><i style="background:{osc}"></i>{osc}'
                f' &rarr; <i style="background:{cla}"></i>{cla}</div></div>')

    html = f"""<meta charset="utf-8"><style>
body{{background:#0A0A10;margin:0;padding:24px;font-family:system-ui,sans-serif}}
h1{{color:#EDEDF5;font-size:15px;letter-spacing:1.3px;margin:0 0 6px}}
p{{color:#8A8AA0;font-size:12.5px;max-width:1240px;line-height:1.55;margin:0 0 14px}}
b{{color:#C98A4B}}
.fila{{display:flex;gap:14px;flex-wrap:wrap}}
.g{{width:600px}}
.g.ref{{outline:2px solid #8FE8E0;outline-offset:5px;border-radius:3px}}
.gl{{color:#EDEDF5;font-size:11px;font-weight:800;letter-spacing:1.3px;
     margin-bottom:6px}}
.g.ref .gl{{color:#8FE8E0}}
.gs{{color:#7A7A90;font-size:11px;margin-top:5px;font-family:monospace}}
.gs i{{display:inline-block;width:10px;height:10px;border-radius:2px;
      margin-right:4px;vertical-align:-1px}}
img{{width:600px;display:block;border-radius:3px;image-rendering:auto}}
</style>
<h1>LA LINEA DEL DIVISOR — COMO QUEDO, AL DOBLE</h1>
<p>Cada tira es la banda de la curva de una carta, <b>ampliada al doble</b>.
Las hojas de diez cartas que venia mandando no servian para esto: a ese tamaño
una linea de 4.5 px no se ve.</p>
<p>El degrade ahora sale <b>solo del color del logo</b>: oscuro en las puntas,
claro en el medio, un solo tono. <b>FRZ va marcado</b> porque es la referencia
que elegiste — y funcionaba porque su acento y su propio ya eran el mismo
teal. Ahora los diez son asi.</p>
<div class="fila">{cel}</div>"""
    p = os.path.join(SCR, '_linea_ahora.html')
    open(p, 'w', encoding='utf-8').write(html)

    import asyncio
    from playwright.async_api import async_playwright

    async def go():
        async with async_playwright() as pw:
            b = await pw.chromium.launch()
            pg = await b.new_page(viewport={'width': 1300, 'height': 900},
                                  device_scale_factor=2)
            await pg.goto('file:///' + p.replace('\\', '/'))
            await pg.wait_for_timeout(500)
            await pg.screenshot(path=os.path.join(SCR, 'linea_ahora.png'),
                                full_page=True)
            await b.close()
    asyncio.run(go())
    print('linea_ahora.png')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
