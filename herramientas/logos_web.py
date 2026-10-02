# -*- coding: utf-8 -*-
"""LOS LOGOS DE LOS SERVIDORES Y DE LAS CREWS PARA EL HUB.

    python herramientas/logos_web.py     rehace bot/paginas/logos/ y logos/crews/

Dlx, 25/09/2026: *«en el mundo deberías agregar DRA, Snake Rap también,
pero con sus nombres completos e incluso sus logos y cantidad de
miembros»*.

⚠️ SALEN DE `comun/logos_color/`, los íconos a color de cada servidor —los
que la gente reconoce de Discord—, y NO de `comun/escudos_cuad/`: ésos
traen sólo la tinta porque el fondo lo pone la carta, y sueltos en una
página se ven como una silueta sin su color.

⚠️ LA LISTA ES LA DE `datos/servidores.json`, la misma que usan el bot y
las cartas. Un servidor sin logo no rompe nada: la página pone su sigla.

🔑 A 512 Y NO A 128, DESDE EL 01/10/2026. Dlx: *«que las imágenes o
logotipos en todos los lugares estén en máxima calidad»*. El escenario del
Inicio dibuja el logo a más de 300 px, y a 128 se veía borroso. ⚠️ SIN
AGRANDAR: SR viene de 338 y TWR y FFS de 256 —en toda la carpeta no hay una
versión a color más grande—, y estirarlos no le agrega un solo píxel: quedan
de su tamaño. Cuadrados: URBF y EFA no lo son y se centran sobre
transparente en vez de estirarse.

⚠️ LAS CREWS SALEN DE `comun/logos_crew/` (las de las cartas, 512, hechas
por `herramientas/logos_crew.py` desde los originales a color). Los
`*_icon.png` de 1024 y 2048 de `herramientas/logos_originales/` son el ícono
de Discord en blanco y negro: otro logo, no uno más grande.
"""
import io
import json
import os
import sys

from PIL import Image

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUENTE = os.path.join(BASE, 'comun', 'logos_color')
CREWS = os.path.join(BASE, 'comun', 'logos_crew')
SALIDA = os.path.join(BASE, 'bot', 'paginas', 'logos')
LADO = 512


def servidores():
    with io.open(os.path.join(BASE, 'datos', 'servidores.json'), encoding='utf-8') as f:
        return list(json.load(f)['servidores'])


def fuente(sv):
    for ext in ('png', 'jpg', 'webp'):
        p = os.path.join(FUENTE, '%s.%s' % (sv.lower(), ext))
        if os.path.exists(p):
            return p
    return None


def cuadrado(p):
    """El logo en un cuadrado de hasta `LADO`: achicado si es más grande, nunca agrandado."""
    im = Image.open(p).convert('RGBA')
    im.thumbnail((LADO, LADO), Image.LANCZOS)
    lado = max(im.size)
    lienzo = Image.new('RGBA', (lado, lado), (0, 0, 0, 0))
    lienzo.alpha_composite(im, ((lado - im.size[0]) // 2, (lado - im.size[1]) // 2))
    return lienzo


def guardar(im, dest):
    im.save(dest, 'WEBP', quality=90, method=6)
    return '%dx%d  %d bytes' % (im.size[0], im.size[1], os.path.getsize(dest))


def main():
    os.makedirs(SALIDA, exist_ok=True)
    for sv in servidores():
        p = fuente(sv)
        if not p:
            print('  %-9s sin logo en comun/logos_color/: la página pone la sigla' % sv)
            continue
        dest = os.path.join(SALIDA, sv.lower() + '.webp')
        print('  %-9s %-14s -> %-12s %s' % (sv, os.path.basename(p), os.path.basename(dest), guardar(cuadrado(p), dest)))
    os.makedirs(os.path.join(SALIDA, 'crews'), exist_ok=True)
    for f in sorted(os.listdir(CREWS)):
        if not f.lower().endswith('.png'):
            continue
        dest = os.path.join(SALIDA, 'crews', os.path.splitext(f)[0] + '.webp')
        print('  %-9s %-14s -> %-12s %s' % ('crew', f, 'crews/' + os.path.basename(dest),
                                           guardar(cuadrado(os.path.join(CREWS, f)), dest)))


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    main()
