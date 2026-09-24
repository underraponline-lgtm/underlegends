"""PNG suelto de una carta de País, con fondo transparente.

    python 04_Pais/exportar_png.py Konan
    python 04_Pais/exportar_png.py Konan Axinu Am
    python 04_Pais/exportar_png.py --todas        las 137 que tienen país

Sale en `04_Pais/salida/pais_<nombre>.png`, recortado a la silueta y listo
para Discord.

LAS CUATRO TRAMPAS
------------------

1. ⚠️ **LAS FUENTES.** Chromium aislado no llega a Google Fonts, y el CSS de
   la maqueta trae `@import url(...Archivo...)`. Abierto en un navegador con
   internet se ve bien y renderizado acá saldría con la fuente del sistema —
   sin error, sin aviso, con otro ancho de texto. Por eso el exportador saca
   el `@import` e inyecta `comun/fonts/embed.css`, y **después pregunta si
   cargó**:
   `document.fonts.check()` es lo único que distingue «cargó Archivo» de
   «cayó en la de sistema», porque las dos dibujan letras.

2. ⚠️ **LA UNIÓN CON LO QUE CUELGA.** Hoy la carta de País no saca nada del
   recorte, así que la unión ES la caja — pero eso **se mide, no se supone**.
   La Servidor tenía escrito lo contrario en su propio docstring hasta que el
   escudo se mudó a la punta y las estrellas quedaron enteras afuera: si se
   captura el elemento, el PNG sale válido y sin ellas.

   Y lo mismo la espera a esta carta el día que se enciendan los chips de
   duelos: viven en `right:-11px` a propósito.

   Qué se saltea al sumar cajas: lo que está dentro de un `<svg>` —un `<path>`
   con `stroke-width` tiene una caja más grande que lo que pinta— pero **no el
   `<svg>` raíz**, cuya caja sí es honesta.

3. ⚠️ **NADA DE SOMBRA EN `.card`.** Un `filter` distinto de `none` pinta la
   caja entera y el PNG sale rectangular en vez de con la silueta. Hoy `.card`
   no la tiene, pero se apaga igual y se verifica al final que las cuatro
   esquinas estén transparentes: esa es la prueba de que la silueta llegó.

4. ⚠️ **LAS IMÁGENES YA VIENEN EMBEBIDAS**, y eso es de esta carta: banderas,
   escudos, el UL y las fotos entran como base64 desde `maqueta.py`. No hay
   ninguna URL remota que pueda dar 404 en silencio, que es lo que las otras
   dos cartas sí tienen que vigilar.
"""
import argparse
import asyncio
import os
import re
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)

import generar as G
import maqueta as MQ

MARGEN = 4


def _fuentes(html):
    """Fuera el @import remoto, adentro las nueve woff2 en base64."""
    html = re.sub(r"@import url\([^)]*\);", '', html)
    ruta = os.path.join(BASE, 'comun', 'fonts', 'embed.css')
    with open(ruta, encoding='utf-8') as f:
        return html.replace('<style>', '<style>' + f.read(), 1)


# ⚠️ SE SALTEA LO QUE ESTA DENTRO DE UN <svg>, NO LO QUE ES UN <svg>. La
# distincion es `ownerSVGElement`: vale null en el <svg> raiz —cuya caja es su
# viewport, o sea honesta— y no-null en cada <path>, <feGaussianBlur> y demas,
# que declaran regiones enormes sin pintar ahi.
SALTAR = "n => n.ownerSVGElement !== null"


# ⚠️ DE A TANDAS, Y NO POR PROLIJIDAD. Chromium tira cartas en blanco cuando la
# hoja pasa cierto tamaño —medido: a escala 3 con las 137 en grilla salieron 96
# y las otras 41 quedaron vacías, sin ningún error—. Acá se recorta cada carta
# por separado, así que el problema entraría como un PNG transparente y válido.
# Con tandas de 24 la hoja nunca llega a ese tamaño; `revisar()` lo comprueba
# igual, porque una tanda chica no es una garantía, es una precaución.
TANDA = 24


async def exportar(gente):
    if len(gente) > TANDA:
        out = []
        for k in range(0, len(gente), TANDA):
            out += await exportar(gente[k:k + TANDA])
        return out
    from playwright.async_api import async_playwright

    html, alto, ancho = G.montar(gente, cols=min(len(gente), 6))
    html = _fuentes(html)
    tmp = os.path.join(SCR, '_export.html')
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(html)
    os.makedirs(G.SALIDA, exist_ok=True)

    hechos = []
    async with async_playwright() as pw:
        br = await pw.chromium.launch(args=['--no-sandbox'])
        pg = await br.new_page(viewport={'width': min(ancho, 4000),
                                         'height': min(alto, 4000)},
                               device_scale_factor=MQ.ESCALA)
        await pg.goto('file://' + tmp.replace(os.sep, '/'))
        await pg.wait_for_timeout(1200)

        # ── 1 · ¿cargó Archivo, o caímos en la del sistema? ──
        # ⚠️ SE PREGUNTAN LOS PESOS QUE LA CARTA USA, NO LOS QUE PIDE EL CSS.
        # El `@import` de la maqueta pide `Archivo:wght@600;800;900`, pero el
        # 600 es de los títulos de las HOJAS COMPARATIVAS y no entra en
        # ninguna carta; `embed.css` —que comparten las cuatro— trae 500, 700,
        # 800 y 900 y **no trae 600**. Preguntar por 600 daba un falso NO.
        #
        # Medido sobre el DOM, contando sólo los nodos de texto propios: la
        # carta usa exactamente **800** (las etiquetas y las siglas) y **900**
        # (el OVR, el nombre, los números). Los dos están embebidos.
        #
        # Y se leen del DOM en vez de escribirlos acá a propósito: si mañana
        # la carta empieza a usar un peso que no está en embed.css, este
        # chequeo lo encuentra solo en vez de dejarlo pasar sintetizado.
        pesos = await pg.evaluate("""() => {
          const u = new Set();
          for (const el of document.querySelectorAll('.card, .card *')) {
            let propio = '';
            for (const n of el.childNodes)
              if (n.nodeType === 3) propio += n.textContent;
            if (propio.trim()) u.add(getComputedStyle(el).fontWeight);
          }
          return [...u].sort();
        }""")
        faltan = [w for w in pesos if not await pg.evaluate(
            "w => document.fonts.check(w + ' 16px Archivo')", w)]
        if faltan:
            await br.close()
            raise SystemExit(
                'la carta usa Archivo %s y embed.css no lo trae: el PNG\n'
                'saldria con un peso sintetizado y sin avisar.\n'
                'Hay que agregarlo a comun/fonts/embed.css.'
                % ', '.join(faltan))

        # ── 2 · sin sombra y sin fondo de pagina ──
        await pg.add_style_tag(content='.card{filter:none!important}'
                                       'body{background:transparent!important}')
        await pg.wait_for_timeout(250)

        cartas = await pg.query_selector_all('.card')
        if len(cartas) != len(gente):
            await br.close()
            raise SystemExit('el HTML tiene %d cartas y la lista %d'
                             % (len(cartas), len(gente)))

        for p, c in zip(gente, cartas):
            cb = await c.bounding_box()
            x0, y0 = cb['x'], cb['y']
            x1, y1 = cb['x'] + cb['width'], cb['y'] + cb['height']
            for e in await c.query_selector_all('*'):
                if await e.evaluate(SALTAR):
                    continue
                k = await e.bounding_box()
                if not k or not k['width'] or not k['height']:
                    continue
                x0 = min(x0, k['x']); y0 = min(y0, k['y'])
                x1 = max(x1, k['x'] + k['width'])
                y1 = max(y1, k['y'] + k['height'])
            sale = (cb['x'] - x0, x1 - (cb['x'] + cb['width']),
                    cb['y'] - y0, y1 - (cb['y'] + cb['height']))

            nombre = 'pais_%s.png' % G.norm(p['nombre'])
            await pg.screenshot(
                path=os.path.join(G.SALIDA, nombre), omit_background=True,
                clip={'x': x0 - MARGEN, 'y': y0 - MARGEN,
                      'width': x1 - x0 + 2 * MARGEN,
                      'height': y1 - y0 + 2 * MARGEN})
            hechos.append((p['nombre'], nombre, sale))
        await br.close()
    os.remove(tmp)
    return hechos


# ══ VERIFICAR EL PNG, NO EL PROCESO ══
# ⚠️ UN PNG VALIDO NO ES UN PNG BUENO. Los dos errores que este formato admite
# sin quejarse son el rectangulo —si una sombra pinta la caja, la silueta se
# pierde y el archivo sale igual de valido— y el vacio. Se miran los dos:
#
#   esquinas   las cuatro tienen que estar TRANSPARENTES. Si alguna esta
#              opaca, lo que se capturo es una caja y no la silueta.
#   tinta      tiene que haber pixeles opacos. Un PNG entero transparente
#              pesa poco y abre bien.
def revisar(png):
    from PIL import Image
    import numpy as np
    a = np.asarray(Image.open(png).convert('RGBA'))
    al = a[..., 3]
    h, w = al.shape
    e = max(3, min(h, w) // 40)
    esquinas = [al[:e, :e].max(), al[:e, -e:].max(),
                al[-e:, :e].max(), al[-e:, -e:].max()]
    tinta = float((al > 8).mean())
    return {'px': (w, h), 'esquinas_opacas': int(max(esquinas)),
            'tinta': tinta}


def main():
    ap = argparse.ArgumentParser(description='PNG transparente de la carta')
    ap.add_argument('quien', nargs='*')
    ap.add_argument('--todas', action='store_true')
    a = ap.parse_args()

    gente = G.cargar()
    if a.todas:
        elegidos = [p for p in gente if p['cc']]
    elif a.quien:
        por = {G.norm(p['nombre']): p for p in gente}
        elegidos, faltan = [], []
        for q in a.quien:
            p = por.get(G.norm(q))
            (elegidos if p else faltan).append(p or q)
        if faltan:
            raise SystemExit('no estan en el pool: %s' % ', '.join(faltan))
        sin = [p['nombre'] for p in elegidos if not p['cc']]
        if sin:
            raise SystemExit('sin pais, no se les emite carta: %s'
                             % ', '.join(sin))
    else:
        ap.error('decime a quien, o --todas')

    hechos = asyncio.run(exportar(elegidos))
    malos = 0
    for nombre, arch, sale in hechos:
        r = revisar(os.path.join(G.SALIDA, arch))
        aviso = ''
        if r['esquinas_opacas'] > 8:
            aviso = '  ⚠️ esquina OPACA: salio rectangular'
            malos += 1
        elif r['tinta'] < .3:
            aviso = '  ⚠️ casi vacio'
            malos += 1
        if any(v > .5 for v in sale):
            aviso += ('  sobresale izq %.0f der %.0f arr %.0f ab %.0f'
                      % sale)
        print('   %-14s %-26s %dx%d  tinta %4.1f%%%s'
              % (nombre, arch, r['px'][0], r['px'][1], r['tinta'] * 100, aviso))
    print('\n%d PNG en %s%s' % (len(hechos), os.path.relpath(G.SALIDA, BASE),
                                '' if not malos else '   %d con problemas'
                                % malos))
    if malos:
        raise SystemExit(1)


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
