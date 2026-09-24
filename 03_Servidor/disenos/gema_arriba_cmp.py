"""CON LA GEMA AL LADO DEL NUMERO CONTRA SIN ELLA.

Dlx: "haz una comparativa de lo ultimo que te dije vs sin lo ultimo que te
dije, que seria al costado del numero grande de OVR arriba a la derecha".

⚠️ LAS DOS LLEVAN LA GEMA DE ABAJO. Lo que se compara es SOLO la de arriba: la
de abajo ya esta decidida —circulo con el puesto dentro del rango— y ponerla en
un solo lado invalidaria la comparacion.

⚠️ Y EL NUMERO NO MIDE LO MISMO EN LAS DOS. Con la gema al lado baja de 3rem a
2.6, porque a 3 no entra sin pisarla. O sea que la comparacion no es "una pieza
mas o menos": es una pieza mas A CAMBIO de 13% menos de numero.
"""
import asyncio
import base64
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
MUESTRA = [(0, 'TFC · rango B'), (2, 'TWR · rango A'), (8, 'EFA · rango SS')]


def b64(p):
    return ('data:image/png;base64,'
            + base64.b64encode(open(p, 'rb').read()).decode())


async def main():
    filas = ''
    for carp, tit in (('_todos_dF', 'CON la gema al lado del número · OVR 2.6rem'),
                      ('_todos_dF_sg', 'SIN ella · OVR 3rem, como estaba')):
        cel = ''
        for i, nom in MUESTRA:
            f = os.path.join(SCR, carp, '%d.png' % i)
            cel += (f'<div class="g"><div class="gl">{nom}</div>'
                    f'<img src="{b64(f)}"></div>')
        filas += f'<h2>{tit}</h2><div class="fila">{cel}</div>'

    html = """<meta charset="utf-8"><style>
body{background:#0A0A10;margin:0;padding:24px;font-family:system-ui,sans-serif}
h1{color:#EDEDF5;font-size:15px;letter-spacing:1.2px;margin:0 0 6px}
h2{color:#EDEDF5;font-size:12.5px;letter-spacing:1.3px;margin:22px 0 10px}
p{color:#8A8AA0;font-size:12.5px;max-width:1140px;line-height:1.55;margin:0 0 4px}
em{color:#C98A4B;font-style:normal;font-weight:700}
.fila{display:flex;gap:16px}
.g{text-align:center;width:300px}
.gl{color:#8A8AA0;font-size:10.5px;font-weight:800;letter-spacing:1.2px;
    margin-bottom:6px}
img{width:300px;display:block}
</style>
<h1>LA GEMA AL LADO DEL NÚMERO — CON Y SIN</h1>
<p><em>&#9888;</em> Las dos llevan la gema de <em>abajo</em>: esa ya está
decidida —círculo con el puesto dentro del rango— y ponerla en un solo lado
invalidaría la comparación.</p>
<p><em>&#9888;</em> Y el número <em>no mide lo mismo</em> en las dos: con la
gema al lado baja de 3rem a 2.6, porque a 3 no entra sin pisarla. No es «una
pieza más o menos» — es una pieza más <em>a cambio de 13% menos de número</em>.</p>
""" + filas
    p = os.path.join(SCR, '_gcmp.html')
    open(p, 'w', encoding='utf-8').write(html)
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        pg = await b.new_page(viewport={'width': 1000, 'height': 900},
                              device_scale_factor=2)
        await pg.goto('file:///' + p.replace(chr(92), '/'))
        await pg.wait_for_timeout(600)
        await pg.screenshot(path=os.path.join(SCR, 'gema_arriba_cmp.png'),
                            full_page=True)
        await b.close()
    print('gema_arriba_cmp.png')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    asyncio.run(main())
