# -*- coding: utf-8 -*-
"""🤖 LA PORTADA DEL BOT EN CADA SERVIDOR (Dlx, 24/11/2026: «asegúrate de poner la foto de portada a las cuentas también,
quizás usa sus generadas que ya tienen»).

    python herramientas/banners_bot.py           las dibuja todas (las que tienen su escena)
    python herramientas/banners_bot.py DDF URBF  sólo ésas
    python herramientas/banners_bot.py --hoja    además, una hoja con todas para mirarlas (scratch, no se sube)
    python herramientas/banners_bot.py --auto    el self-check (CI): cada escena tiene su portada y mide lo que tiene que medir

El bot de la Liga toma en cada servidor Tier 1 su perfil (`aplicarPerfilBot()` en bot/avisos.js). La portada de siempre
es el banner del Discord del servidor, y la mayoría NO tiene: Discord lo da desde el nivel 2 de boosts (DDF y URBF, el
24/11, quedaban sin portada). Entonces va ésta.

🌆 SALE DE LA ESCENA DE SU BANNER DE EVENTOS (`bot/eventos_fondos/<sv>.jpg`, hecha con IA para cada servidor; ver
`herramientas/banners_eventos.py`), NO del banner terminado: ése lleva el nombre, la cinta, el logo y los chips, que en una
portada de 17:6 quedaban cortados y, abajo a la izquierda, tapados por la foto del bot. La escena va limpia.

📐 1360 × 480 (17:6, el doble de lo que dibuja Discord: 680 × 240), JPG 86, recorte al centro algo alto (`ALTO`): el
micrófono y el horizonte de cada escena están en el tercio de arriba. Va en `bot/paginas/banners/bot/<sv>.jpg` y lo sirve
Pages, como los banners de eventos: el Worker pregunta si existe (`perfilPortada()`) y, si no, el bot va sin portada.
⚠️ Sin escena no hay portada (sin dato no hay pieza): no se inventa otra.
"""
import os
import sys

from PIL import Image

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ESCENAS = os.path.join(BASE, 'bot', 'eventos_fondos')
SALIDA = os.path.join(BASE, 'bot', 'paginas', 'banners', 'bot')
AN, AL = 1360, 480
#: dónde cae el recorte: 0 arriba del todo, 1 abajo del todo. Medido mirando la hoja de las trece (24/11/2026)
ALTO = 0.35


def escenas():
    return sorted(f[:-4] for f in os.listdir(ESCENAS) if f.endswith('.jpg'))


def portada(sv):
    im = Image.open(os.path.join(ESCENAS, sv + '.jpg')).convert('RGB')
    w, h = im.size
    alto = round(w * AL / AN)
    if alto > h:                                   # una escena más apaisada que 17:6: se recorta a lo ancho
        ancho = round(h * AN / AL)
        x = (w - ancho) // 2
        im = im.crop((x, 0, x + ancho, h))
    else:
        y = round((h - alto) * ALTO)
        im = im.crop((0, y, w, y + alto))
    return im.resize((AN, AL), Image.LANCZOS)


def main(args):
    os.makedirs(SALIDA, exist_ok=True)
    pedidas = [a.lower() for a in args if not a.startswith('--')]
    hechas = []
    for sv in escenas():
        if pedidas and sv not in pedidas:
            continue
        p = portada(sv)
        p.save(os.path.join(SALIDA, sv + '.jpg'), quality=86, optimize=True, progressive=True)
        hechas.append(sv)
        print('   ✅ %s  %s KB' % (sv.upper(), os.path.getsize(os.path.join(SALIDA, sv + '.jpg')) // 1024))
    if '--hoja' in args and hechas:
        hoja = Image.new('RGB', (AN // 2, (AL // 2 + 8) * len(hechas)), (10, 10, 12))
        for i, sv in enumerate(hechas):
            hoja.paste(Image.open(os.path.join(SALIDA, sv + '.jpg')).resize((AN // 2, AL // 2)), (0, i * (AL // 2 + 8)))
        ruta = os.path.join(BASE, 'salida_banners_bot.png')
        hoja.save(ruta)
        print('   📄 la hoja: %s' % ruta)


def auto():
    mal = []
    for sv in escenas():
        f = os.path.join(SALIDA, sv + '.jpg')
        if not os.path.exists(f):
            mal.append('%s sin portada (correr herramientas/banners_bot.py %s)' % (sv.upper(), sv.upper()))
            continue
        with Image.open(f) as im:
            if im.size != (AN, AL) or im.format != 'JPEG':
                mal.append('%s mide %s %s' % (sv.upper(), im.size, im.format))
        if os.path.getsize(f) > 900 * 1024:
            mal.append('%s pesa %d KB' % (sv.upper(), os.path.getsize(f) // 1024))
    print('   %s cada escena de eventos tiene su portada del bot, de %d × %d en JPG' % ('🔴' if mal else '✅', AN, AL))
    for m in mal:
        print('      · ' + m)
    return not mal


if __name__ == '__main__':
    if '--auto' in sys.argv:
        sys.exit(0 if auto() else 1)
    main(sys.argv[1:])
