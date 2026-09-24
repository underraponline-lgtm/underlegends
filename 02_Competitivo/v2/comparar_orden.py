"""LA COMPETITIVA CON LOS CIRCULOS Y LOS NUMEROS INTERCAMBIADOS.

Dlx: "podrias intercambiar la linea de los circulos y la linea de los numeros
en la tarjeta competitiva y mostrarme como se ve en 3 diferentes personas".

⚠️ NO SE INTERCAMBIAN LOS `top` A SECAS, y conviene saber por que: las dos
filas NO miden lo mismo. Las stats son DOS renglones —etiquetas de 0.76rem
sobre numeros de 1.9rem, unos 42 px— y los circulos son UNO solo de 27. Poner
cada una donde estaba la otra dejaria un hueco de 15 px en un lado y las
apretaria en el otro.

Asi que se recolocan: los circulos suben a donde arrancaban las stats, y las
stats bajan a lo que queda debajo de ellos.

⚠️ Y NO SE TOCA card.css. La prueba inyecta un bloque de CSS al final del HTML
generado, que por cascada gana. Asi la carta que ya funciona no corre riesgo
mientras se mira una alternativa.
"""
import asyncio
import os
import re
import sys

from playwright.async_api import async_playwright

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(os.path.dirname(SCR))
sys.path.insert(0, BASE)

# los valores vigentes, leidos de card.css (ultimo override de cada uno)
NOMBRE, STATS, CHEM = 54.2, 61.7, 73.61
H = 485.0
ALTO_CHEM = 27 / H * 100          # el circulo mide 27 px
HUECO = 2.2                        # aire entre las dos filas, en % del alto

# los circulos suben a donde arrancaban las stats; las stats van debajo
CHEM_NUEVO = STATS
STATS_NUEVO = STATS + ALTO_CHEM + HUECO

SWAP = f"""
<style>
/* ⚠️ SOLO PARA LA PRUEBA. Va al final para ganar por cascada; card.css no se
   toca. Si esta version se elige, los numeros se llevan alla. */
.chem{{ top:{CHEM_NUEVO:.2f}% !important }}
.stats{{ top:{STATS_NUEVO:.2f}% !important }}
</style>
"""

QUIENES = 3          # cuantas personas se muestran


async def main():
    html_src = os.path.join(SCR, 'salida', 'tarjeta_competitiva.html')
    if not os.path.exists(html_src):
        html_src = os.path.join(BASE, '02_Competitivo', 'salida',
                                'tarjeta_competitiva.html')
    if not os.path.exists(html_src):
        print('falta el HTML generado: correr gencomp.py primero')
        print('  buscado en:', html_src)
        return
    src = open(html_src, encoding='utf-8').read()

    p_swap = os.path.join(SCR, '_swap.html')
    open(p_swap, 'w', encoding='utf-8').write(src + SWAP)

    filas = []
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        pg = await b.new_page(viewport={'width': 1500, 'height': 900},
                              device_scale_factor=2)
        for etiqueta, ruta in (('ahora', html_src), ('cambiado', p_swap)):
            await pg.goto('file:///' + os.path.abspath(ruta).replace('\\', '/'))
            await pg.wait_for_timeout(1200)
            tarjetas = await pg.query_selector_all('.card')
            for i in range(min(QUIENES, len(tarjetas))):
                f = os.path.join(SCR, '_cmp_%s_%d.png' % (etiqueta, i))
                await tarjetas[i].screenshot(path=f)
                filas.append((etiqueta, i, f))
        await b.close()

        # la hoja comparadora
        import base64

        def b64(p):
            return ('data:image/png;base64,'
                    + base64.b64encode(open(p, 'rb').read()).decode())

        bloques = ''
        for et, tit in (('ahora', 'AHORA — números arriba, círculos abajo'),
                        ('cambiado',
                         'CAMBIADO — círculos arriba, números abajo')):
            cel = ''.join(
                '<div class="g"><img src="%s"></div>'
                % b64(os.path.join(SCR, '_cmp_%s_%d.png' % (et, i)))
                for i in range(QUIENES))
            bloques += '<h2>%s</h2><div class="fila">%s</div>' % (tit, cel)

        hoja = """<meta charset="utf-8"><style>
body{background:#0A0A10;margin:0;padding:24px;font-family:system-ui,sans-serif}
h1{color:#EDEDF5;font-size:15px;letter-spacing:1.2px;margin:0 0 6px}
h2{color:#EDEDF5;font-size:12.5px;letter-spacing:1.4px;margin:22px 0 10px}
p{color:#8A8AA0;font-size:12.5px;max-width:1150px;line-height:1.55;margin:0}
b{color:#C98A4B}
.fila{display:flex;gap:16px}
img{height:560px;display:block}
</style>
<h1>LA COMPETITIVA — CÍRCULOS Y NÚMEROS INTERCAMBIADOS</h1>
<p><b>&#9888;</b> No se intercambiaron los <b>top</b> a secas: las dos filas
no miden lo mismo. Las stats son <b>dos renglones</b> —etiquetas sobre
números, ~42 px— y los círculos <b>uno</b> de 27. Cambiarlos de lugar tal cual
dejaba un hueco de 15 px de un lado y apretaba del otro. Los círculos suben a
donde arrancaban las stats, y las stats bajan a lo que queda debajo.</p>
""" + bloques
        p_hoja = os.path.join(SCR, '_cmp.html')
        open(p_hoja, 'w', encoding='utf-8').write(hoja)

        b2 = await pw.chromium.launch()
        pg2 = await b2.new_page(viewport={'width': 1300, 'height': 900},
                                device_scale_factor=2)
        await pg2.goto('file:///' + os.path.abspath(p_hoja).replace('\\', '/'))
        await pg2.wait_for_timeout(700)
        await pg2.screenshot(path=os.path.join(SCR, 'comparar_orden.png'),
                             full_page=True)
        await b2.close()
    print('  comparar_orden.png')
    return filas


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    asyncio.run(main())
