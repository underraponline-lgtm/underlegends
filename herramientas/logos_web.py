# -*- coding: utf-8 -*-
"""LOS LOGOS DE LOS SERVIDORES PARA EL HUB.

    python herramientas/logos_web.py     rehace bot/paginas/logos/

Dlx, 25/09/2026: *«en el mundo deberías agregar DRA, Snake Rap también,
pero con sus nombres completos e incluso sus logos y cantidad de
miembros»*.

⚠️ SALEN DE `comun/logos_color/`, los íconos a color de cada servidor —los
que la gente reconoce de Discord—, y NO de `comun/escudos_cuad/`: ésos
traen sólo la tinta porque el fondo lo pone la carta, y sueltos en una
página se ven como una silueta sin su color.

⚠️ LA LISTA ES LA DE `datos/servidores.json`, la misma que usan el bot y
las cartas. Un servidor sin logo no rompe nada: la página pone su sigla.

⚠️ 128×128 EN WEBP, cuadrados. Dos logos no son cuadrados —URBF y EFA— y
se centran sobre transparente en vez de estirarse.
"""
import io
import json
import os
import sys

from PIL import Image

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUENTE = os.path.join(BASE, 'comun', 'logos_color')
SALIDA = os.path.join(BASE, 'bot', 'paginas', 'logos')
LADO = 128


def servidores():
    with io.open(os.path.join(BASE, 'datos', 'servidores.json'), encoding='utf-8') as f:
        return list(json.load(f)['servidores'])


def fuente(sv):
    for ext in ('png', 'jpg', 'webp'):
        p = os.path.join(FUENTE, '%s.%s' % (sv.lower(), ext))
        if os.path.exists(p):
            return p
    return None


def main():
    os.makedirs(SALIDA, exist_ok=True)
    for sv in servidores():
        p = fuente(sv)
        if not p:
            print('  %-5s sin logo en comun/logos_color/: la página pone la sigla' % sv)
            continue
        im = Image.open(p).convert('RGBA')
        im.thumbnail((LADO, LADO), Image.LANCZOS)
        lienzo = Image.new('RGBA', (LADO, LADO), (0, 0, 0, 0))
        lienzo.alpha_composite(im, ((LADO - im.size[0]) // 2, (LADO - im.size[1]) // 2))
        dest = os.path.join(SALIDA, sv.lower() + '.webp')
        lienzo.save(dest, 'WEBP', quality=88, method=6)
        print('  %-5s %s -> %s  %d bytes' % (sv, os.path.basename(p),
                                            os.path.basename(dest), os.path.getsize(dest)))


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    main()
