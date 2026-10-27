# -*- coding: utf-8 -*-
"""🏟️ El PNG transparente de la carta de liga.

    python 05_Liga/exportar.py fms-titans               # la liga entera, a 05_Liga/salida/
    python 05_Liga/exportar.py fms-titans:0 fzl:3       # esas cartas (liga:puesto desde 0)
    python 05_Liga/exportar.py --hoja                   # una hoja con todas, para mirar (salida/hoja.html)

UN Chromium para todas, y cada PNG se VERIFICA, no el proceso (como el de País): las cuatro esquinas transparentes —si
una está opaca se capturó una caja y no la carta— y tinta adentro. Los dos errores que este formato admite sin quejarse
son el rectángulo y el vacío.

Las fuentes van embebidas: `comun/fonts/embed.css` (Archivo) y `05_Liga/fuentes.css` (Anton y Barlow Condensed 800, que
embed.css no trae y que no se agregan ahí: tocar comun/ redibuja las otras cuatro cartas).
"""
import io
import os
import pathlib
import sys
import time

AQUI = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(AQUI)
sys.path.insert(0, AQUI)
sys.path.insert(0, BASE)
import carta as C  # noqa: E402
import datos as D  # noqa: E402

SALIDA = os.path.join(AQUI, 'salida')
MARGEN = 24          # lo que sobresale del escenario de 340 × 470: la corona del 1.º, las cintas
ESCALA = 2           # 680 px de ancho, como las otras cartas a 2×


def fuentes():
    with io.open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'), encoding='utf-8') as f:
        a = f.read()
    with io.open(os.path.join(AQUI, 'fuentes.css'), encoding='utf-8') as f:
        return a + '\n' + f.read()


def pagina(pares, hoja=False):
    """El HTML con las cartas `[(liga, i)]`, cada una en su caja `#c<k>`."""
    ligas = sorted({l for l, _i in pares})
    duos = ''.join(C.duo(l, D.COLOR.get(D.POR[l]['sv'], '#E41373')) for l in ligas)
    cajas = ''.join("<div class='w' id='c%d'>%s</div>" % (k, C.carta(l, i)) for k, (l, i) in enumerate(pares))
    fondo = '#0B0B0D' if hoja else 'transparent'
    return ("<!doctype html><meta charset='utf-8'><style>%s\n%s\nhtml,body{background:%s!important;margin:0}"
            ".w{display:inline-block;padding:%dpx;vertical-align:top}</style>%s%s") % (
        fuentes(), C.armar_css(), fondo, MARGEN, C.DEFS.replace('DUOS', duos), cajas)


def revisar(png):
    """'' si está bien; si no, qué tiene."""
    from PIL import Image
    im = Image.open(png).convert('RGBA')
    w, h = im.size
    if any(im.getpixel(p)[3] > 8 for p in ((1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2))):
        return 'una esquina opaca: se capturó una caja'
    a = im.getchannel('A')
    if sum(1 for v in a.getdata() if v > 200) < w * h * .25:
        return 'casi sin tinta'
    return ''


def nombre_png(lid, clave):
    return 'liga-%s_%s.png' % (lid, clave)


def dibujar(trabajos, salida=SALIDA):
    """`trabajos`: `[(liga, i, clave)]`. Devuelve `({(liga, clave): ruta}, [(liga, clave, por qué)])`."""
    from playwright.sync_api import sync_playwright
    os.makedirs(salida, exist_ok=True)
    pares = [(l, i) for l, i, _k in trabajos]
    tmp = os.path.join(salida, '_cartas.html')
    with io.open(tmp, 'w', encoding='utf-8') as f:
        f.write(pagina(pares))
    hechos, malos = {}, []
    t0 = time.time()
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=['--no-sandbox'])
        pg = b.new_page(viewport={'width': 400, 'height': 540}, device_scale_factor=ESCALA)
        pg.goto(pathlib.Path(tmp).as_uri(), wait_until='load')
        pg.evaluate('document.fonts.ready')
        pg.wait_for_timeout(600)
        for k, (l, i, clave) in enumerate(trabajos):
            ruta = os.path.join(salida, nombre_png(l, clave))
            try:
                pg.query_selector('#c%d' % k).screenshot(path=ruta, omit_background=True, animations='disabled')
                mal = revisar(ruta)
            except Exception as e:                       # noqa: BLE001
                mal = str(e)[:80]
            if mal:
                malos.append((l, clave, mal))
            else:
                hechos[(l, clave)] = ruta
        b.close()
    os.remove(tmp)
    print('      🏟️ %d carta(s) de liga en %.0f s%s' % (len(hechos), time.time() - t0, ' · %d mal' % len(malos) if malos else ''))
    return hechos, malos


def main():
    D.cargar()
    args = [a for a in sys.argv[1:] if not a.startswith('-')]
    pares = []
    for a in args or list(D.POR):
        lid, _, i = a.partition(':')
        if lid not in D.POR:
            sys.exit('no conozco la liga %s (hay: %s)' % (lid, ', '.join(sorted(D.POR))))
        pares += [(lid, int(i))] if i else [(lid, k) for k in range(len(D.POR[lid]['tabla']))]
    if '--hoja' in sys.argv:
        os.makedirs(SALIDA, exist_ok=True)
        p = os.path.join(SALIDA, 'hoja.html')
        io.open(p, 'w', encoding='utf-8').write(pagina(pares, hoja=True))
        print('hoja con %d cartas: %s' % (len(pares), p))
        return
    trabajos = [(l, i, D.POR[l]['ks'].get(D.POR[l]['tabla'][i][0]) or 'sin-clave-%d' % i) for l, i in pares]
    _h, malos = dibujar(trabajos)
    for l, k, m in malos:
        print('   ⚠️ %s · %s: %s' % (l, k, m))


if __name__ == '__main__':
    main()
