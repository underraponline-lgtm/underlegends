# -*- coding: utf-8 -*-
"""LAS BANDERAS DEL HUB, COMO IMAGEN Y NO COMO EMOJI.

    python herramientas/banderas_web.py     rehace bot/paginas/banderas/ (y g/)

🔴 EN WINDOWS NO HAY FUENTE DE BANDERAS. El emoji 🇦🇷 son dos letras
especiales que el sistema dibuja como bandera sólo si tiene con qué: en
Windows —la mitad de quien mira el hub en una compu— caen a «AR», «CO».
Dlx, 25/09/2026: *«esto es una website, puedes poner literalmente una
imagen pequeña de las banderas en vez de depender de los emojis no?»*.

⚠️ LA LISTA DE PAISES ES LA DEL HUB, no una nueva. Sale de `PAIS` en
`bot/paginas/app.js`, que es con lo que la página pone el nombre de cada
país: si mañana entra uno, se agrega ahí y esto lo toma.

⚠️ LA FUENTE ES EL REPO: `04_Pais/banderas/`, las oficiales 3:2 que ya
usan las cartas. Sólo las que falten se bajan de flagcdn —el mismo lugar
de donde salieron esas— y quedan versionadas: la página no depende de
ningún CDN para mostrar una bandera.

⚠️ 60×40 Y 3:2 PARA TODAS, recortadas al centro. En 20 px de ancho una
bandera de proporción 19:10 al lado de una 3:2 se ve como un error de
alineación, no como fidelidad.

🔑 Y UNA GRANDE, 240×160, EN `g/` (25/09/2026): el podio de países del
Inicio las muestra a ~120 px, y la de 60 agrandada al doble se ve
borrosa. Mismas fuentes y mismo recorte, así las dos dicen lo mismo.
"""
import io
import os
import re
import sys

from PIL import Image

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(BASE, 'bot', 'paginas', 'banderas')
FUENTE = os.path.join(BASE, '04_Pais', 'banderas')
ANCHO, ALTO = 60, 40
GRANDE = (240, 160)


def paises_del_hub():
    with io.open(os.path.join(BASE, 'bot', 'paginas', 'app.js'), encoding='utf-8') as f:
        js = f.read()
    m = re.search(r'var PAIS = \{(.*?)\};', js, re.S)
    if not m:
        sys.exit('no encontré `var PAIS = {…}` en bot/paginas/app.js')
    return sorted(set(re.findall(r'\b([a-z]{2}):\s*\'', m.group(1))))


def origen(cc):
    p = os.path.join(FUENTE, cc + '.png')
    if os.path.exists(p):
        return Image.open(p), 'repo'
    import requests
    r = requests.get('https://flagcdn.com/w320/%s.png' % cc, timeout=30)
    r.raise_for_status()
    return Image.open(io.BytesIO(r.content)), 'flagcdn'


def recortar(im, tam=(ANCHO, ALTO)):
    """Llenar 3:2 recortando al centro, sin deformar."""
    im = im.convert('RGBA')
    w, h = im.size
    if w / h > ANCHO / ALTO:
        nw = int(h * ANCHO / ALTO)
        im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:
        nh = int(w * ALTO / ANCHO)
        im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    return im.resize(tam, Image.LANCZOS)


def main():
    os.makedirs(os.path.join(SALIDA, 'g'), exist_ok=True)
    total = 0
    for cc in paises_del_hub():
        im, de = origen(cc)
        dest = os.path.join(SALIDA, cc + '.png')
        recortar(im).save(dest, optimize=True)
        total += os.path.getsize(dest)
        recortar(im, GRANDE).save(os.path.join(SALIDA, 'g', cc + '.webp'), 'WEBP',
                                  quality=90, method=6)
        print('  %s  %-7s %5d bytes' % (cc, de, os.path.getsize(dest)))
    print('%d banderas · %.1f KB en %s' % (len(paises_del_hub()), total / 1024,
                                        os.path.relpath(SALIDA, BASE)))


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    main()
