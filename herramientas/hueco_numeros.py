"""Cuanto aire hay entre la TINTA de cada icono del panel de Pais y su numero.

    python 04_Pais/maqueta.py           # primero, para que exista el html
    python herramientas/hueco_numeros.py

De aca salen los cuatro numeros de TINTA_DER en 04_Pais/maqueta.py, y sin este
script no se pueden volver a deducir: hay que correrlo.

⚠️ NO SIRVE MEDIR CAJA CONTRA CAJA. Los cinco .ic miden 26x26 y van centrados,
asi que la caja termina siempre en 50 — pero el trofeo ocupa x=4..20 de un
viewBox de 24 y la bandera llena el suyo entero. Alineados por caja, los cuatro
numeros daban -0.2, 1.0, 4.2 y 7.5 de hueco real: parejos en el codigo y
disparejos en la carta.

La tinta se saca como manda el proyecto — renderizando con y sin el elemento y
restando las dos imagenes. Buscar el color del icono no serviria: el escudo de
TWR tiene fondo oscuro como el panel, y el numero es blanco como la bandera.
"""
import asyncio, pathlib, sys, numpy as np
from PIL import Image
from playwright.async_api import async_playwright

import os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = pathlib.Path(os.path.join(BASE, '04_Pais', '_maqueta.html'))
E = 4

JS_BOXES = """() => {
  const c = document.querySelector('.card'), cb = c.getBoundingClientRect();
  const out = [];
  c.querySelectorAll('.cas').forEach(e => {
    const b = e.querySelector('.x'); if (!b) return;
    const ic = e.querySelector('.ic'), rb = b.getBoundingClientRect(),
          ri = ic.getBoundingClientRect(),
          et = [...e.querySelectorAll('i')].pop();
    out.push({et: et ? et.textContent.trim() : '', txt: b.textContent.trim(),
      bx: rb.left - cb.left, bx2: rb.right - cb.left,
      by: rb.top - cb.top, by2: rb.bottom - cb.top,
      ix: ri.left - cb.left, ix2: ri.right - cb.left,
      iy: ri.top - cb.top, iy2: ri.bottom - cb.top});
  });
  return out;
}"""

JS_HIDE = """() => document.querySelectorAll('.ic').forEach(ic =>
  [...ic.children].forEach(ch => {
    if (!ch.classList.contains('x')) ch.style.visibility = 'hidden'; }))"""


async def main():
    async with async_playwright() as pw:
        br = await pw.chromium.launch()
        pg = await br.new_page(viewport={'width': 700, 'height': 800},
                               device_scale_factor=E)
        await pg.goto(HTML.as_uri())
        await pg.wait_for_timeout(600)
        # ⚠️ ESTE MEDIDOR SOLO VALE EN EL MODO 'tinta'. Ahi el numero se pega
        # a la tinta de cada icono y por eso hay cuatro TINTA_DER distintos.
        # En las variantes con contenedor se pega AL CONTENEDOR, que es igual
        # para todos, asi que los huecos que saldrian no significan nada — y
        # saldrian igual, sin avisar. Desde que el default de maqueta.py es
        # combo-rango, correr los dos scripts seguidos caia justo en eso.
        # ⚠️ EL PANEL SE APLANA ANTES DE MEDIR. La textura esta en las DOS
        # capturas y deberia cancelarse sola, pero no del todo: el .ic lleva
        # un drop-shadow translucido, y esa sombra cayendo sobre los puntos
        # cambia mas pixeles que cayendo sobre un color plano. El resultado es
        # que el borde de tinta detectado se corre hacia afuera — con 'puntos'
        # la bandera pasaba de 55.5 a 57.0 y TWR de 51.0 a 51.8, y el medidor
        # denunciaba huecos distintos que no eran de los iconos sino del
        # fondo. Lo que se mide aca es la tinta del ICONO.
        await pg.evaluate(
            "() => document.querySelectorAll('.panel').forEach("
            "e => e.style.background = 'rgba(6,8,16,.90)')")
        modo = await pg.evaluate(
            "() => [...document.querySelector('.lane').classList]"
            ".find(x => x !== 'lane' && x !== 'colgado') || 'tinta'")
        if modo != 'tinta':
            print('  _maqueta.html esta en modo %s, no en tinta.' % modo)
            print('  Volve a generarlo con:  python 04_Pais/maqueta.py '
                  '--num tinta')
            await br.close()
            return
        cajas = await pg.evaluate(JS_BOXES)
        el = await pg.query_selector('.card')
        a = Image.open(__import__('io').BytesIO(await el.screenshot(omit_background=True)))
        await pg.evaluate(JS_HIDE)
        await pg.wait_for_timeout(250)
        b = Image.open(__import__('io').BytesIO(await el.screenshot(omit_background=True)))
        await br.close()
    A = np.array(a.convert('RGBA')).astype(int)
    B = np.array(b.convert('RGBA')).astype(int)
    tinta = np.abs(A - B).sum(axis=2) > 24      # solo el dibujo del icono
    print('  casillero    num    tinta acaba   el num empieza    HUECO')
    hs = []
    for c in cajas:
        y0, y1 = int(c['iy'] * E), int(c['iy2'] * E)
        cols = np.where(tinta[y0:y1].any(axis=0))[0]
        if not len(cols):
            print('  %-12s %-5s   (sin tinta)' % (c['et'], c['txt'])); continue
        # la banda de filas del icono puede tocar tinta de otro casillero: se
        # recorta a la mitad izquierda, donde solo esta este icono
        cols = cols[cols < c['bx2'] * E]
        der = (cols.max() + 1) / E
        h = c['bx'] - der
        hs.append(round(h, 1))
        print('  %-12s %-5s %8.1f %13.1f %11.1f' % (c['et'], c['txt'], der,
                                                    c['bx'], h))
    print()
    # ⚠️ LA TOLERANCIA ES DE MEDIO PIXEL, y no es holgazaneria. Se captura a
    # escala 4, o sea que la propia medicion tiene 0.25 px de grano, y el
    # borde de tinta se decide por umbral sobre pixeles con antialiasing.
    # Exigiendo igualdad exacta el script denunciaba un desajuste de 0.2 px
    # —el escudo del servidor daba -2.2 contra -2.5 de los otros tres— que no
    # se puede ni dibujar. Un medidor que grita por debajo de su propia
    # precision deja de servir para avisar cuando algo se rompe de verdad.
    sep = max(hs) - min(hs)
    print('  huecos: %s  ->  %s' % (sorted(set(hs)),
          'IGUALES' if sep <= .5 else 'DISTINTOS por %.1f px' % sep))

asyncio.run(main())
