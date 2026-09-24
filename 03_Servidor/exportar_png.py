"""
PNG SUELTO DE UNA TARJETA SERVIDOR, con fondo transparente
===========================================================

    python3 exportar_png.py Bloody
    python3 exportar_png.py Bloody salida.png
    python3 exportar_png.py --lista        # ver quien esta en normal_datos.json

Corre normal_gen.py, busca la carta pedida en el HTML resultante y la captura.

TRES TRAMPAS, las mismas que en las otras dos cartas
----------------------------------------------------
1. `.card` tiene `filter: drop-shadow(0 16px 34px)` en la MISMA regla que el
   clip-path. Si no se apaga, la sombra pinta toda la caja y el PNG sale
   rectangular en vez de con la silueta del escudo biselado.

2. Chromium no llega al CDN de Discord ni a Google Fonts desde un entorno
   aislado. El CSS trae `@import` de Google Fonts, que anda al abrir el HTML
   en un navegador con internet pero NO al renderizar aca. Por eso se saca el
   @import y se inyecta `comun/fonts/embed.css`, que trae las 9 woff2 en
   base64. ⚠️ VIVE EN comun/ Y NO ACA: habia una copia identica por carta,
   cuatro archivos de 543 KB con el mismo md5.
   Python si tiene salida a internet, por eso los avatares se bajan desde aca.

3. Si una imagen no responde 200, se avisa al final en vez de dejar `src=""`
   en silencio. Los avatares del pool son URLs con hash que CADUCAN, y las
   banderas fallan cuando el rapero no tiene pais: la URL queda
   `flagcdn.com/w80/.png` y el navegador dibuja el icono de imagen rota.

4. ⚠️ HAY QUE CALCULAR LA UNION CON LO QUE CUELGA POR FUERA.

   Esto ANTES no hacia falta y el docstring decia lo contrario: mientras el
   clip-path de `.card` recortaba a todos sus hijos, alcanzaba con capturar
   el elemento. Dejo de ser cierto cuando el escudo del servidor paso a la
   punta de arriba SOBRESALIENDO del recorte, con las estrellas apoyadas
   encima y ENTERAS afuera.

   Si se captura solo el elemento, el PNG sale SIN ESCUDO Y SIN ESTRELLAS, y
   no avisa: sale un PNG valido, nada mas que incompleto. Las estrellas son
   ademas el argumento de venta de esta carta (ver CLAUDE.bot.md), asi que
   perderlas en silencio es el peor de los casos.

   QUE SE SALTEA AL SUMAR CAJAS, y por que:

   · lo que vive DENTRO del recorte. Su caja puede salirse muchisimo aunque
     el clip-path no lo deje pintar ahi. En la Competitiva `.rays` tiene
     inset:-22% y se sale 66px a cada lado sin pintar un pixel afuera.

   · lo que esta DENTRO de un <svg>. Un <path> con stroke-width 9 tiene una
     caja que se sale 4.5px de la silueta, y los <feGaussianBlur> declaran
     regiones enormes. Ninguno de esos numeros dice donde se pinta.

   ⚠️ PERO EL <svg> RAIZ SI CUENTA. La regla de la Competitiva saltea todo
   lo que no sea del namespace HTML, y aca eso borraria LAS ESTRELLAS, que
   son <svg> sueltos posicionados. La distincion correcta es
   `ownerSVGElement`: vale null en el <svg> raiz —cuya caja es su viewport,
   o sea honesta— y no-null en todo lo de adentro.
"""
import asyncio
import base64
import json
import os
import re
import subprocess
import sys

import requests
from playwright.async_api import async_playwright

RAIZ = os.path.dirname(os.path.abspath(__file__))
UA = {'User-Agent': 'Mozilla/5.0'}
_cache = {}
_fallaron = []


sys.path.insert(0, os.path.dirname(RAIZ))
from comun import respaldo


def _r(*p):
    return os.path.join(RAIZ, *p)


def embeber(html):
    """Baja cada imagen y la mete en base64. Registra las que fallan."""
    def emb(m):
        u = m.group(1)
        if u not in _cache:
            try:
                r = requests.get(u, headers=UA, timeout=30)
                if r.status_code != 200:
                    # ⚠️ LA COPIA DEL REPO ANTES DE RENDIRSE. Medido en la
                    # carta de Juasmio: fallaban SEIS imagenes, cinco avatares
                    # y el escudo de SR, y la mitad estaban en disco. Ver
                    # comun/respaldo.py.
                    x = respaldo.para(u)
                    if x:
                        _cache[u] = x
                        return 'src="%s"' % x
                    _fallaron.append((r.status_code, u))
                    return 'src=""'
                mime = r.headers.get('content-type', 'image/png').split(';')[0]
                _cache[u] = 'data:%s;base64,%s' % (mime, base64.b64encode(r.content).decode())
            except Exception as e:
                x = respaldo.para(u)
                if x:
                    _cache[u] = x
                    return 'src="%s"' % x
                _fallaron.append((str(e)[:40], u))
                return 'src=""'
        return 'src="%s"' % _cache[u]
    return re.sub(r'src="(https?://[^"]+)"', emb, html)


def lista():
    d = json.load(open(_r('normal_datos.json'), encoding='utf-8'))
    print('en normal_datos.json (%d):' % len(d))
    for x in d:
        print('   %-12s %-5s rango %s' % (x['raw'], x.get('sv', '—'), x.get('rango', '—')))


async def main(quien, salida):
    datos = json.load(open(_r('normal_datos.json'), encoding='utf-8'))
    nombres = [d['raw'] for d in datos]
    if quien not in nombres:
        print('%s no esta en normal_datos.json. Hay: %s' % (quien, ', '.join(nombres)))
        return

    r = subprocess.run([sys.executable, _r('normal_gen.py')],
                       capture_output=True, text=True, cwd=RAIZ)
    if r.returncode != 0:
        print('normal_gen.py fallo:\n', r.stderr[-600:])
        return

    h = open(_r('salida', 'tarjeta_servidor.html'), encoding='utf-8').read()
    h = re.sub(r"@import url\([^)]*\);", '', h)          # fuera el @import remoto
    # ⚠️ comun/fonts/, no 03_Servidor/fonts/. Ver el docstring.
    fuentes = open(_r('..', 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    h = h.replace('<style>', '<style>' + fuentes, 1)
    h = embeber(h)
    tmp = _r('_tmp_export.html')
    open(tmp, 'w', encoding='utf-8').write(h)

    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1400, 'height': 900},
                              device_scale_factor=3)
        await pg.goto('file://' + tmp)
        await pg.wait_for_timeout(1200)
        # sin la sombra: si no, el PNG sale rectangular
        await pg.add_style_tag(content='.card{filter:none!important}'
                                       'body{background:transparent!important}')
        await pg.wait_for_timeout(300)

        elegida = None
        for c in await pg.query_selector_all('.card'):
            n = await c.query_selector('.c-name')
            if n and (await n.inner_text()).strip().upper() == quien.upper():
                elegida = c
                break
        if elegida is None:
            print('no encontre la carta de %s en el HTML' % quien)
            await b.close()
            return
        # ── la union con todo lo que cuelga por fuera ──
        cb = await elegida.bounding_box()
        x0, y0 = cb['x'], cb['y']
        x1, y1 = cb['x'] + cb['width'], cb['y'] + cb['height']
        SALTAR = ("n => !!n.closest('.clip, .cuerpo, .c-photo') "
                  "|| n.ownerSVGElement !== null")
        for e in await elegida.query_selector_all('*'):
            if await e.evaluate(SALTAR):
                continue
            k = await e.bounding_box()
            if not k or k['width'] == 0 or k['height'] == 0:
                continue
            x0 = min(x0, k['x']); y0 = min(y0, k['y'])
            x1 = max(x1, k['x'] + k['width'])
            y1 = max(y1, k['y'] + k['height'])

        sale = (cb['x'] - x0, x1 - (cb['x'] + cb['width']),
                cb['y'] - y0, y1 - (cb['y'] + cb['height']))
        if any(v > 0.5 for v in sale):
            print('sobresale  izq %.0f  der %.0f  arriba %.0f  abajo %.0f  (px)'
                  % sale)
        else:
            print('no sobresale nada: la union es la caja de la carta')

        m = 4
        await pg.screenshot(path=_r(salida), omit_background=True,
                            clip={'x': x0 - m, 'y': y0 - m,
                                  'width': x1 - x0 + 2 * m,
                                  'height': y1 - y0 + 2 * m})
        await b.close()
    os.remove(tmp)

    print('->', _r(salida))
    if _fallaron:
        print('\nimagenes que NO cargaron (%d):' % len(_fallaron))
        for cod, u in _fallaron:
            print('   %s  %s' % (cod, u[:88]))
        print('   ojo: esas quedan vacias o con el icono de imagen rota.')


# ⚠️ ESTE EXPORTADOR SACA EL LAYOUT VIEJO, Y POR ESO YA NO ES EL CAMINO POR
# DEFECTO. `normal_gen.py` + `normal_card.css` son la Normal vieja —lo dice
# NOTAS.md: "todo lo del color por servidor y el logo grande se probo en
# scripts sueltos y no esta aplicado a estos archivos todavia"— asi que lo que
# salia de aca era una carta que ya nadie estaba diseñando: sin escudo en la
# punta, sin fondo del servidor y sin la columna.
#
# El diseño vigente lo arma `03_Servidor/generar.py`, que ademas sale ya
# recortado y transparente: no necesita este exportador.
#
# Se deja `--viejo` porque la carta vieja sigue siendo la unica que lee
# normal_datos.json, y ese archivo es la muestra con la que se trabajo meses.
if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--lista':
        lista()
    elif len(sys.argv) > 1 and sys.argv[1] == '--viejo':
        q = sys.argv[2] if len(sys.argv) > 2 else 'Valen'
        s = sys.argv[3] if len(sys.argv) > 3 else '%s_servidor_viejo.png' % q
        asyncio.run(main(q, s))
    else:
        import subprocess
        gen = os.path.join(os.path.dirname(RAIZ), '03_Servidor', 'generar.py')
        print('-> el diseño vigente lo hace generar.py; '
              'para el layout viejo, --viejo\n')
        sys.exit(subprocess.run([sys.executable, gen] + sys.argv[1:]).returncode)
