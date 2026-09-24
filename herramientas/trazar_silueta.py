"""TRAZAR UNA SILUETA DESDE UN PNG.

    python herramientas/trazar_silueta.py imagen.png [--alto 455] [--tol 0.4]

Saca el contorno exterior de una carta y lo escribe como path SVG listo para
usar en `clip-path: path(...)`.

POR QUE EXISTE
--------------
La silueta de la Competitiva NO se dibujo a ojo: se trazo del alfa del PNG
real. Su shield.py lo dice y aclara que los intentos previos a mano fallaron
durante horas. Pero shield.py solo LEE los .txt ya trazados: el script que
los genero no quedo en el repo. Asi que la primera vez que hizo falta trazar
otra silueta, se volvio a dibujar a ojo y volvio a salir mal. Este archivo
existe para que eso no pase una tercera vez.

COMO SACA LA MASCARA
--------------------
Dos casos, decididos midiendo y no por parametro:

  · si el PNG tiene alfa con al menos un 1% de pixeles transparentes,
    la mascara es el alfa;
  · si no, la carta viene sobre fondo plano. Se toma el color de las cuatro
    esquinas, se verifica que las cuatro coincidan, y se descarta todo lo
    que este cerca de ese color.

Si las esquinas NO coinciden entre si, frena: significa que el fondo no es
plano y recortar por color va a comerse pedazos de la carta.

EL CONTORNO ES LA ENVOLVENTE POR FILA
-------------------------------------
Para cada fila se toma el pixel de tinta mas a la izquierda y el mas a la
derecha. El contorno es el perfil derecho bajando mas el izquierdo subiendo.

Esto es a proposito y tiene un limite que conviene saber: si una carta
tuviera un hueco INTERIOR (una ventana calada), la envolvente lo ignora. Para
una silueta de recorte eso es lo correcto —lo que se quiere es el borde de
afuera— pero no sirve para trazar caladuras.

En cambio SI toma bien todo lo que sobresale: alas en las esquinas, una gema
colgando del borde de abajo, una punta. Esas filas siguen teniendo un solo
tramo de tinta, o si tienen varios, el minimo y el maximo son justo los
extremos que interesan.

LA SIMPLIFICACION
-----------------
Douglas-Peucker. La tolerancia esta en PIXELES DE LA IMAGEN ORIGINAL, no del
viewBox de salida: si la imagen viene a 1000px y se exporta a 300, una
tolerancia de 0.4 son 0.12 en el destino. Subirla suaviza y baja la cantidad
de puntos; bajarla copia hasta el ruido del antialias.
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image


# ─────────────────────────── mascara ───────────────────────────

def mascara(img, tol_color=34):
    """Devuelve un array bool: True donde hay carta."""
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    a = np.array(img)
    alfa = a[:, :, 3]

    transparentes = float((alfa < 128).mean())
    if transparentes >= 0.01:
        return alfa >= 128, 'alfa (%.1f%% transparente)' % (transparentes * 100)

    # fondo plano: las cuatro esquinas tienen que coincidir
    h, w = alfa.shape
    esquinas = np.array([a[0, 0, :3], a[0, w - 1, :3],
                         a[h - 1, 0, :3], a[h - 1, w - 1, :3]], dtype=int)
    disp = int(np.abs(esquinas - esquinas.mean(axis=0)).max())
    if disp > tol_color:
        raise SystemExit(
            'Las cuatro esquinas no coinciden (se separan %d niveles).\n'
            'El fondo no es plano, asi que recortar por color se comeria\n'
            'pedazos de la carta. Guarda el PNG con fondo transparente\n'
            'o sobre un color liso.' % disp)

    fondo = esquinas.mean(axis=0)
    dist = np.abs(a[:, :, :3].astype(int) - fondo).max(axis=2)
    return dist > tol_color, 'fondo plano rgb(%d,%d,%d)' % tuple(fondo.astype(int))


def mayor_componente(m):
    """Se queda con la mancha mas grande: descarta firmas y basura suelta."""
    try:
        from scipy import ndimage
    except ImportError:
        return m
    et, n = ndimage.label(m)
    if n <= 1:
        return m
    tam = ndimage.sum(m, et, range(1, n + 1))
    return et == (int(np.argmax(tam)) + 1)


# ─────────────────────────── contorno ───────────────────────────

def envolvente(m):
    """Perfil derecho bajando + perfil izquierdo subiendo."""
    filas = np.where(m.any(axis=1))[0]
    if not len(filas):
        raise SystemExit('La mascara salio vacia: no se detecto ninguna carta.')
    der, izq = [], []
    for y in filas:
        xs = np.where(m[y])[0]
        izq.append((float(xs[0]), float(y)))
        der.append((float(xs[-1] + 1), float(y)))
    return der + izq[::-1]


def _dist(p, a, b):
    (px, py), (ax, ay), (bx, by) = p, a, b
    dx, dy = bx - ax, by - ay
    n = dx * dx + dy * dy
    if n == 0:
        return ((px - ax) ** 2 + (py - ay) ** 2) ** .5
    return abs(dy * px - dx * py + bx * ay - by * ax) / n ** .5


def douglas_peucker(pts, tol):
    if len(pts) < 3:
        return pts
    pila, guardar = [(0, len(pts) - 1)], {0, len(pts) - 1}
    while pila:
        i, j = pila.pop()
        if j <= i + 1:
            continue
        peor, d_peor = -1, 0.0
        for k in range(i + 1, j):
            d = _dist(pts[k], pts[i], pts[j])
            if d > d_peor:
                peor, d_peor = k, d
        if d_peor > tol:
            guardar.add(peor)
            pila.append((i, peor))
            pila.append((peor, j))
    return [pts[i] for i in sorted(guardar)]


# ─────────────────────────── salida ───────────────────────────

def a_path(pts, esc, ox, oy, dec=1):
    d = 'M' + ' L'.join(
        '%.*f,%.*f' % (dec, (x - ox) * esc, dec, (y - oy) * esc) for x, y in pts)
    return d + ' Z'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('imagen')
    ap.add_argument('--ancho', type=int, default=300,
                    help='ancho del viewBox de salida (default 300)')
    ap.add_argument('--alto', type=int, default=0,
                    help='alto del viewBox; 0 = el que salga por proporcion')
    ap.add_argument('--tol', type=float, default=0.4,
                    help='tolerancia Douglas-Peucker EN PIXELES DE LA IMAGEN')
    ap.add_argument('--salida', default='')
    a = ap.parse_args()

    if not os.path.exists(a.imagen):
        raise SystemExit('No existe: %s' % a.imagen)

    img = Image.open(a.imagen)
    m, como = mascara(img)
    m = mayor_componente(m)

    ys, xs = np.where(m)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    an, al = x1 - x0, y1 - y0

    crudo = envolvente(m)
    pts = douglas_peucker(crudo, a.tol)

    esc = a.ancho / an
    alto = a.alto or round(al * esc)
    d = a_path(pts, esc, x0, y0)

    print('imagen      : %s  (%dx%d)' % (os.path.basename(a.imagen), *img.size))
    print('mascara     : %s' % como)
    print('caja tinta  : %dx%d px  en (%d,%d)' % (an, al, x0, y0))
    print('proporcion  : %.3f  (ancho/alto)' % (an / al))
    print('contorno    : %d puntos -> %d con tol %.2f' % (len(crudo), len(pts), a.tol))
    print('viewBox     : %d x %d' % (a.ancho, alto))
    print()
    print(d)

    if a.salida:
        open(a.salida, 'w', encoding='utf-8').write(d + '\n')
        print('\n-> %s' % a.salida)


if __name__ == '__main__':
    main()
