# -*- coding: utf-8 -*-
"""Saca las capturas de las 12 maquetas (`maquetas.py`) a 360 px de ancho.

    python docs/remake/maquetas_capturas.py <carpeta_con_los_html>

Deja un `.webp` por página y **verifica que las fuentes hayan cargado**: una
maqueta con la fuente de respaldo compara estilos que no existen. Si alguna
familia no cargó, lo dice y sale con error.
"""
import os
import sys

from PIL import Image
from playwright.sync_api import sync_playwright

FAMILIAS = {
    'barda': ['Bungee', 'Atkinson Hyperlegible Next'],
    'fanzine': ['Anybody', 'IBM Plex Mono'],
    'tvpirata': ['VT323', 'Space Grotesk'],
    'diario': ['DM Serif Display', 'Inter Tight'],
}


def main():
    carpeta = sys.argv[1]
    mal = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        pg = b.new_page(viewport={'width': 360, 'height': 800}, device_scale_factor=2)
        for f in sorted(os.listdir(carpeta)):
            if not f.endswith('.html'):
                continue
            estilo = f.split('_')[0]
            pg.goto('file:///' + os.path.join(carpeta, f).replace('\\', '/'))
            pg.wait_for_load_state('networkidle')
            pg.evaluate('document.fonts.ready')
            # la carta de ejemplo (y sus dos fuentes) sólo aparece en el Perfil:
            # el navegador no baja una fuente que la página no usa
            carta = ['Archivo', 'Barlow Condensed'] if f.endswith('_perfil.html') else []
            for fam in FAMILIAS[estilo] + carta:
                ok = pg.evaluate('(f) => document.fonts.check("16px \\"" + f + "\\"")', fam)
                cargada = pg.evaluate('(f) => [...document.fonts].some(x => x.family.replace(/"/g, "") === f && x.status === "loaded")', fam)
                if not (ok and cargada):
                    mal.append((f, fam))
            png = os.path.join(carpeta, f[:-5] + '.png')
            pg.locator('.app').screenshot(path=png)
            im = Image.open(png)
            im.save(png[:-4] + '.webp', 'WEBP', quality=82, method=6)
            os.remove(png)
            print('%-22s %4d x %4d  %4d KB' % (f[:-5], im.width, im.height, os.path.getsize(png[:-4] + '.webp') // 1024))
        b.close()
    if mal:
        print('FUENTES QUE NO CARGARON:', mal)
        sys.exit(1)
    print('ok: todas las fuentes cargaron')


if __name__ == '__main__':
    main()
