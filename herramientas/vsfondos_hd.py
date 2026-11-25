# -*- coding: utf-8 -*-
"""🌆 LOS FONDOS DEL VS, EN GRANDE, PARA LA PÁGINA (Dlx, 25/11/2026: «estaría bien si usamos el VS ese de nuestros fondos o
dependiendo del servidor esos»). El reproductor de cada batalla (`Escenario` en web/src/video.jsx) dibuja el VS sobre el fondo
de su servidor, como el VS del bot (`_fondo_vs()` en bot/kit.py): el que subió el servidor, el aprobado que eligió en su panel
(`repo:vs:<x>` o `repo:ev:<x>`) o el suyo de `bot/vs_fondos/`.

`bot/paginas/vsfondos/` sólo tenía miniaturas de 480 px (para elegir en el panel): esto deja al lado, en `hd/`, una de 1200 px
en webp (~75 KB) de cada escena de `bot/vs_fondos/` (`vs-<x>.webp`) y de `bot/eventos_fondos/` (`ev-<x>.webp`). Sólo rehace
la que cambió.
    python herramientas/vsfondos_hd.py          arma lo que falta o cambió
    python herramientas/vsfondos_hd.py --auto   el self-check: cada escena tiene su hd
"""
import io
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUENTES = (('vs', os.path.join(BASE, 'bot', 'vs_fondos')), ('ev', os.path.join(BASE, 'bot', 'eventos_fondos')))
SALIDA = os.path.join(BASE, 'bot', 'paginas', 'vsfondos', 'hd')
ANCHO, CALIDAD = 1200, 72


def escenas():
    for pre, d in FUENTES:
        for f in sorted(os.listdir(d)) if os.path.isdir(d) else []:
            if f.lower().endswith('.jpg'):
                yield os.path.join(d, f), os.path.join(SALIDA, '%s-%s.webp' % (pre, f[:-4].lower()))


def armar():
    from PIL import Image
    os.makedirs(SALIDA, exist_ok=True)
    hechas = 0
    for src, dst in escenas():
        if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
            continue
        im = Image.open(src).convert('RGB')
        if im.size[0] > ANCHO:
            im = im.resize((ANCHO, round(ANCHO * im.size[1] / im.size[0])), Image.LANCZOS)
        im.save(dst, 'WEBP', quality=CALIDAD, method=6)
        hechas += 1
    return hechas


def _auto():
    faltan = [os.path.basename(d) for _s, d in escenas() if not os.path.exists(d)]
    print('   %s cada escena del VS tiene su versión grande para la página%s'
          % ('✅' if not faltan else '❌', '' if not faltan else ' (faltan: %s; correr herramientas/vsfondos_hd.py)' % ', '.join(faltan)))
    return 1 if faltan else 0


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    if '--auto' in sys.argv:
        raise SystemExit(_auto())
    n = armar()
    print('🌆 %d fondos grandes armados en bot/paginas/vsfondos/hd/' % n)
