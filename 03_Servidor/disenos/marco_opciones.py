"""EL MARCO DE LA SERVIDOR: cinco tratamientos sobre un solo servidor.

Falta desde el principio y es lo ultimo visual que queda.

⚠️ DOS REGLAS QUE YA ESTABAN FIJADAS Y ORDENAN ESTO:

  1. NO VA METALICO. Ese lenguaje es de la Competitiva —su marco tiene brillo
     especular, filo claro y sombra interior— y repetirlo borraria la
     diferencia entre las dos cartas.
  2. UN MARCO POR VEZ. Hacer los nueve de una vuelta fue lo que los hizo
     salir parecidos. Aca se prueba sobre TFC y despues se lleva al resto.

⚠️ Y HAY UN TERCERO QUE SALE DEL CONCEPTO: la carta se trata como CAMISETA DE
SELECCION. Eso da el vocabulario del marco sin tener que inventarlo — un
borde de camiseta es un VIVO, una COSTURA o un RIBETE, no una moldura. Las
cinco opciones salen de ahi.

Lo que hay hoy es un solo trazo de 9 px con degradé, recortado a la silueta
—o sea que se le ve la mitad, 4.5—. Eso es un borde, no un marco: no tiene
estructura ni espesor.
"""
import asyncio
import base64
import os
import re
import sys

from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun.siluetas import PICO
from comun import marco as MK
from comun.emblema import MARGEN
from los_nueve import defs

SV = 'TFC'
ESC = 3

# (clave, nombre, nota, capas SVG extra que se dibujan DESPUES del trazo base)
# Cada capa es (dash, ancho, color, opacidad, desplazamiento hacia adentro)
OPS = [
    ('A', 'lo de hoy', 'un solo trazo de 9, recortado. Es un borde, no un marco',
     []),
    ('B', 'vivo interior',
     'una linea clara pegada por dentro, como el vivo de una camiseta',
     [(None, 1.6, 'claro', .95, 7.5)]),
    ('C', 'doble vivo',
     'dos lineas finas separadas: el ribete de puño de camiseta',
     [(None, 1.4, 'claro', .95, 7.0), (None, 1.0, 'claro', .55, 11.5)]),
    ('D', 'costura',
     'linea punteada por dentro. Textil literal, no decorativo',
     [('3 4', 1.5, 'claro', .8, 8.5)]),
    ('E', 'vivo + sombra',
     'el vivo con una linea oscura por fuera: le da espesor sin brillo',
     [(None, 2.2, 'oscuro', .8, 5.0), (None, 1.6, 'claro', .95, 8.0)]),
]


def encoge(d, px):
    """El mismo camino, movido px hacia adentro.

    ⚠️ NO ES UN ESCALADO. Escalar el path desde el centro achica mas los
    tramos lejanos que los cercanos, asi que la linea interior quedaria
    despareja: pegada arriba y suelta abajo. Se mueve cada vertice hacia el
    centro por su propia normal aproximada, que es lo que da un contorno
    paralelo.
    """
    pts = [tuple(float(v) for v in p.split(','))
           for p in re.findall(r'(-?[\d.]+,-?[\d.]+)', d)]
    cx = PICO.w / 2
    cy = PICO.h / 2
    out = []
    for x, y in pts:
        dx, dy = x - cx, y - cy
        n = (dx * dx + dy * dy) ** .5 or 1
        out.append((x - dx / n * px, y - dy / n * px))
    return 'M' + ' L'.join('%.2f,%.2f' % p for p in out) + ' Z'


def b64(p):
    return ('data:image/png;base64,'
            + base64.b64encode(open(p, 'rb').read()).decode())


async def main():
    D = defs()
    acento, propio, fondo, extra = D[SV][0], D[SV][1], D[SV][2], D[SV][3]
    claro, oscuro = MK.claro(propio), MK.oscuro(propio)
    sil = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
                 lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN),
                 PICO.d)
    alto = PICO.h + MARGEN

    cel = ''
    for k, nom, nota, capas in OPS:
        extras = ''
        for dash, w, col, op, dentro in capas:
            c = claro if col == 'claro' else oscuro
            d2 = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
                        lambda m: '%s,%g' % (m.group(1),
                                             float(m.group(2)) + MARGEN),
                        encoge(PICO.d, dentro))
            extras += (f'<path d="{d2}" fill="none" stroke="{c}" '
                       f'stroke-width="{w}" opacity="{op}"'
                       + (f' stroke-dasharray="{dash}"' if dash else '')
                       + '/>')
        cel += f"""<div class="g"><div class="gl">{k} · {nom}</div>
  <div class="cw">
    <svg class="d" width="0" height="0"><defs>
      <clipPath id="c{k}" clipPathUnits="userSpaceOnUse"><path d="{sil}"/></clipPath>
      {MK.defs_svg(propio, acento, k)}
    </defs></svg>
    <div class="cu" style="clip-path:url(#c{k})">
      <div class="f" style="background:{fondo}"></div>
      {f'<div class="f" style="{extra}"></div>' if extra else ''}
    </div>
    <svg class="bo" viewBox="0 0 {PICO.w} {alto}" width="{PICO.w}" height="{alto}">
      <g clip-path="url(#c{k})">
        <path d="{sil}" fill="none" stroke="{MK.stroke(k)}"
              stroke-width="9" opacity=".95"/>
      </g>
      {extras}
    </svg>
  </div><div class="gs">{nota}</div></div>"""

    html = f"""<meta charset="utf-8"><style>
body{{background:#0A0A10;margin:0;padding:24px;font-family:system-ui,sans-serif}}
h1{{color:#EDEDF5;font-size:15px;letter-spacing:1.2px;margin:0 0 6px}}
p{{color:#8A8AA0;font-size:12.5px;max-width:1180px;line-height:1.55;margin:0 0 6px}}
em{{color:#C98A4B;font-style:normal;font-weight:700}}
.fila{{display:flex;gap:14px;flex-wrap:wrap;margin-top:14px}}
.g{{width:{PICO.w}px}}
.gl{{color:#EDEDF5;font-size:11.5px;font-weight:800;letter-spacing:.8px;
     margin-bottom:6px}}
.gs{{color:#7A7A90;font-size:11px;margin-top:6px;line-height:1.45}}
.cw{{position:relative;width:{PICO.w}px;height:{alto}px}}
.cu,.bo{{position:absolute;inset:0}}
.f{{position:absolute;inset:0;background-repeat:repeat}}
.d{{position:absolute}}
</style>
<h1>EL MARCO DE LA SERVIDOR — CINCO TRATAMIENTOS · {SV}</h1>
<p><em>&#9888;</em> <em>No va metálico</em>: ese lenguaje es de la Competitiva
y repetirlo borraría la diferencia entre las dos cartas.</p>
<p>El vocabulario sale del concepto que ya estaba fijado — la carta se trata
como <em>camiseta de selección</em>—, así que el borde es un <em>vivo</em>,
una <em>costura</em> o un <em>ribete</em>, no una moldura.</p>
<p>Lo de hoy es un solo trazo de 9 recortado a la silueta, o sea 4.5 visibles:
es un <em>borde</em>, no un marco — no tiene estructura ni espesor.</p>
<div class="fila">{cel}</div>"""
    p = os.path.join(SCR, '_marco.html')
    open(p, 'w', encoding='utf-8').write(html)

    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        pg = await b.new_page(viewport={'width': 1620, 'height': 700},
                              device_scale_factor=2)
        await pg.goto('file:///' + p.replace('\\', '/'))
        await pg.wait_for_timeout(600)
        await pg.screenshot(path=os.path.join(SCR, 'marco_opciones.png'),
                            full_page=True)
        await b.close()
    print('marco_opciones.png')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    asyncio.run(main())
