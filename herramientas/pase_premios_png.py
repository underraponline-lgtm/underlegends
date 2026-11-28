# -*- coding: utf-8 -*-
"""🎫 LOS PREMIOS DEL PASE COMO IMAGEN, PARA LOS BOTONES DEL PASE EN DISCORD (28/11/2026).

Dlx: *«En pase rapero debería ser más interactuable, incluso la opción de ver en qué track estás ahora y recompensas
cercanas»*. Los botones del cartel de 〢🎫〉pase-rapero (`bot/pase_dc.js`) muestran los premios que vienen con su
imagen: la MISMA pegatina de la página (`web/src/pase_objetos.jsx`), sacada con `pase_premios_svg.mjs` y pasada a PNG
transparente de 256×256.

    python herramientas/pase_premios_png.py          las dibuja en bot/paginas/discord/pase/
    python herramientas/pase_premios_png.py --auto   el self-check: no dibuja, mira que estén todas y livianas

⚠️ VIVEN EN PAGES, NO EN R2 (como las portadas, `herramientas/portadas_discord.py`): `bot/paginas/` se despliega solo al
pushear y no toca el presupuesto del Worker. ⚠️ Discord guarda las imágenes POR DIRECCIÓN: si se redibujan, se sube
`IMG_V` en `bot/pase_dc.js` o seguirá mostrando las de antes.
⚠️ LAS CLAVES SALEN DE `CLAVES_IMG` DE bot/pase_dc.js: una clave que el bot pida y no esté acá sería una imagen rota
—y Discord no avisa—. `--auto` revisa justo eso.
"""
import json
import os
import re
import subprocess
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(AQUI)
SALIDA = os.path.join(BASE, 'bot', 'paginas', 'discord', 'pase')
PASE_DC = os.path.join(BASE, 'bot', 'pase_dc.js')
LADO = 256
TOPE_KB = 40
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass


def claves():
    """Las claves que pide el bot: `CLAVES_IMG` de bot/pase_dc.js."""
    s = open(PASE_DC, encoding='utf-8').read()
    m = re.search(r'export const CLAVES_IMG = \[(.*?)\];', s, re.S)
    if not m:
        sys.exit('no encuentro CLAVES_IMG en bot/pase_dc.js')
    return re.findall(r"'([a-z-]+)'", m.group(1))


def svgs():
    r = subprocess.run(['node', os.path.join(AQUI, 'pase_premios_svg.mjs')], capture_output=True, text=True,
                       encoding='utf-8', cwd=BASE)
    if r.returncode:
        sys.exit('no salieron los SVG:\n' + (r.stderr or r.stdout)[-800:])
    return json.loads(r.stdout)


def dibujar():
    from playwright.sync_api import sync_playwright
    d = svgs()
    falta = [k for k in claves() if k not in d]
    if falta:
        sys.exit('🔴 el bot pide %s y la página no los dibuja' % ', '.join(falta))
    os.makedirs(SALIDA, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        try:
            pg = b.new_page(viewport={'width': LADO, 'height': LADO}, device_scale_factor=1)
            for k in claves():
                pg.set_content('<!doctype html><html><head><style>*{margin:0}html,body{background:transparent}'
                               'svg{display:block}</style></head><body>%s</body></html>' % d[k])
                ruta = os.path.join(SALIDA, k + '.png')
                pg.screenshot(path=ruta, omit_background=True, clip={'x': 0, 'y': 0, 'width': LADO, 'height': LADO})
                print('  %-18s %s (%d KB)' % (k, os.path.relpath(ruta, BASE), os.path.getsize(ruta) // 1024))
        finally:
            b.close()
    return 0


def self_check():
    mal = []
    for k in claves():
        ruta = os.path.join(SALIDA, k + '.png')
        if not os.path.exists(ruta):
            mal.append('falta %s.png' % k)
            continue
        with open(ruta, 'rb') as f:
            cab = f.read(24)
        import struct
        w, h = struct.unpack('>II', cab[16:24])
        if (w, h) != (LADO, LADO):
            mal.append('%s.png es de %dx%d' % (k, w, h))
        if os.path.getsize(ruta) > TOPE_KB * 1024:
            mal.append('%s.png pesa %d KB' % (k, os.path.getsize(ruta) // 1024))
    sobran = sorted(set(f[:-4] for f in os.listdir(SALIDA) if f.endswith('.png')) - set(claves())) if os.path.isdir(SALIDA) else []
    if sobran:
        mal.append('sobran (nadie las pide): %s' % ', '.join(sobran))
    for m in mal:
        print('🔴 ' + m)
    if not mal:
        print('✅ las %d imágenes de los premios del Pase están, de %dx%d y livianas' % (len(claves()), LADO, LADO))
    return 1 if mal else 0


if __name__ == '__main__':
    sys.exit(self_check() if '--auto' in sys.argv else dibujar())
