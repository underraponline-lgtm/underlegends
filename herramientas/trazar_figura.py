# -*- coding: utf-8 -*-
"""TRAZAR UNA FIGURA DESDE UN PNG: el path SVG, con sus huecos.

    python herramientas/trazar_figura.py figura.png [--tol 0.4]

Imprime el `viewBox` (cuadrado, con la figura centrada) y el `d` del path, para
pegarlos en `comun/sin_foto.py` o donde haga falta una figura en negro.

⚠️ NO ES `trazar_silueta.py`. Ése saca la ENVOLVENTE por fila —el borde de
afuera de una carta— y a propósito ignora los huecos. Una figura tiene huecos
que son la mitad del dibujo: en la silueta de rapero (Dlx, 03/10/2026, «la
segunda»), el aire entre el brazo levantado y el micrófono. Con la envolvente
ese triángulo se rellena y el brazo se pega a la cara.

Cómo lo hace, y por qué así (medido el 04/10/2026 sobre silhouette-3391415 de
Pixabay, contra el PNG original):

- **Se rellena el borde antes de buscar contornos.** La figura toca el borde
  de abajo (y el de arriba): sin relleno, esos contornos salen ABIERTOS y al
  cerrarlos se cruzan en diagonal por la figura — 99 % de píxeles mal.
- **Un desenfoque de 1,2 px antes de cortar en 0,5**, para que el contorno
  sub-píxel salga liso y no copie los escalones del antialias.
- **Tramos rectos, NO un spline.** Con Catmull-Rom las esquinas filosas (la
  axila, los dedos) hacían rulos chiquitos que se cruzaban, y con `evenodd`
  cada rulo es un pelo blanco. Con tolerancia 0,4 px y rectas: 264 puntos,
  3 KB, y el 0,27 % de píxeles distintos (todo antialias).
- **`fill-rule="evenodd"`** para los huecos: el contorno del hueco viene en
  el sentido contrario.
"""
import argparse
import sys

import numpy as np
from PIL import Image, ImageFilter


def trazar(ruta, tol=0.4, desenfoque=1.2, pad=3):
    """`(viewBox, d)` de la figura del alfa de `ruta`."""
    from skimage import measure
    im = Image.open(ruta).convert('RGBA')
    a = Image.fromarray(np.array(im)[:, :, 3])
    af = np.array(a.filter(ImageFilter.GaussianBlur(desenfoque))).astype(float) / 255.0
    af = np.pad(af, pad)
    cs = [c - pad for c in measure.find_contours(af, 0.5) if len(c) > 40]
    trozos = []
    for c in cs:
        s = measure.approximate_polygon(c, tolerance=tol)[:-1]
        trozos.append('M' + ' '.join('%.1f,%.1f' % (x, y) for y, x in s) + 'Z')
    w, h = im.size
    lado = max(w, h)
    return '%g %g %d %d' % (-(lado - w) / 2.0, -(lado - h) / 2.0, lado, lado), ''.join(trozos)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('png')
    ap.add_argument('--tol', type=float, default=0.4)
    a = ap.parse_args()
    vb, d = trazar(a.png, a.tol)
    print('viewBox="%s"' % vb)
    print('d="%s"' % d)
    print('\n%d caracteres' % len(d), file=sys.stderr)


if __name__ == '__main__':
    main()
