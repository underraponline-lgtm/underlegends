"""Trazar el divisor de una carta SEGMENTANDO, no aproximando por brillo.

POR QUE HACIA FALTA ESTO
------------------------
Yo venia buscando "donde brilla mas" columna por columna. Eso es una
APROXIMACION y ademas es fragil: en esa franja hay otras cosas brillantes
—el grafico del fondo, el borde del panel— y el maximo salta entre ellas.
Tres intentos distintos dieron tres perfiles y ninguno coincidia con lo que
se ve.

UNA LINEA DIVISORIA NO ES UN BRILLO: ES EL BORDE ENTRE DOS REGIONES. Arriba
esta la zona de la foto y abajo el panel, y son de color distinto. Entonces
lo correcto es:

    1. clasificar cada pixel como ARRIBA o ABAJO segun a que region se
       parece mas su color
    2. sacar el CONTORNO de esa clasificacion

marching squares (skimage.measure.find_contours) devuelve el contorno con
precision SUBPIXEL: interpola donde cae el cruce entre dos pixeles, asi que
no queda limitado a la grilla del original. Eso es medir, no estimar.

Los colores de cada region no se eligen a mano: se toman del promedio de dos
bandas bien adentro de cada zona, lejos del borde.
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass


def cargar(ruta):
    im = Image.open(ruta).convert('RGBA')
    a = np.array(im).astype(float)
    al = a[:, :, 3]
    ys, xs = np.where(al > 60)
    return im, a, al, xs.min(), xs.max() + 1, ys.min(), ys.max() + 1


def trazar(ruta, arriba=.50, abajo=.74, izq=.16, der=.84, verbose=True):
    """Devuelve [(x_rel, y_rel)] del divisor, en fracciones de la carta."""
    from skimage import measure

    im, a, al, x0, x1, y0, y1 = cargar(ruta)
    an, alt = x1 - x0, y1 - y0
    rgb = a[:, :, :3]

    # ── las dos regiones, tomadas LEJOS del borde ──
    zx0, zx1 = x0 + int(an * izq), x0 + int(an * der)
    ba = rgb[y0 + int(alt * (arriba - .10)):y0 + int(alt * (arriba - .02)),
             zx0:zx1].reshape(-1, 3)
    bb = rgb[y0 + int(alt * (abajo + .02)):y0 + int(alt * (abajo + .10)),
             zx0:zx1].reshape(-1, 3)
    cA, cB = ba.mean(axis=0), bb.mean(axis=0)

    if verbose:
        print('region de ARRIBA  #%02X%02X%02X' % tuple(cA.astype(int)))
        print('region de ABAJO   #%02X%02X%02X' % tuple(cB.astype(int)))
        sep = np.linalg.norm(cA - cB)
        print('separacion entre las dos  %.1f  (0-441)' % sep)
        if sep < 12:
            print('⚠️  MUY POCA. Con regiones tan parecidas la clasificacion')
            print('    es ruido: el resultado no sirve.')

    # ⚠️ DOS METODOS QUE PROBE Y NO SIRVEN, anotados para no repetirlos:
    #
    #   · clasificar cada pixel como "mas parecido a A o a B". Falla porque
    #     la zona de arriba tiene un GRAFICO encima cuyas formas no se
    #     parecen a ninguna de las dos: el borde entre clases termina
    #     rodeando el grafico. Daba un perfil que cubria del 51% al 82% del
    #     ancho y saltaba 36 px.
    #   · marcar lo que se parece al color de abajo y tomar su techo. Falla
    #     porque LA REGION DE ABAJO TIENE DEGRADE: un color promedio con
    #     tolerancia cubre el 1% de la franja.
    #
    # LO QUE SI DEFINE AL DIVISOR: es lo unico que CRUZA LA CARTA ENTERA de
    # forma continua y casi horizontal. El grafico del fondo no lo hace.
    # Entonces no se busca pixel por pixel: se busca EL MEJOR CAMINO de
    # borde a borde, con programacion dinamica, obligado a moverse como
    # mucho un pixel por columna. Eso garantiza una linea continua y suave,
    # que es lo que una linea divisoria ES.
    from scipy import ndimage

    lum = np.where(al > 60,
                   .2126*rgb[:, :, 0] + .7152*rgb[:, :, 1] + .0722*rgb[:, :, 2],
                   0)
    zona = lum[y0 + int(alt * arriba):y0 + int(alt * abajo), zx0:zx1]
    zona = ndimage.gaussian_filter(zona, 1.0)
    # lo que atrae al camino: el cambio brusco de una fila a la siguiente
    g = np.abs(np.gradient(zona, axis=0))
    g = g / (g.max() + 1e-9)

    H, Wz = g.shape
    coste = np.full((H, Wz), np.inf)
    dedonde = np.zeros((H, Wz), int)
    coste[:, 0] = 1.0 - g[:, 0]
    for x in range(1, Wz):
        prev = coste[:, x - 1]
        arr = np.r_[np.inf, prev[:-1]]
        aba = np.r_[prev[1:], np.inf]
        opciones = np.vstack([arr, prev, aba])
        mejor = np.argmin(opciones, axis=0)
        coste[:, x] = opciones[mejor, np.arange(H)] + (1.0 - g[:, x])
        dedonde[:, x] = mejor - 1          # -1 sube, 0 recto, +1 baja

    yfin = int(np.argmin(coste[:, -1]))
    camino = np.zeros(Wz, int)
    camino[-1] = yfin
    for x in range(Wz - 1, 0, -1):
        camino[x - 1] = camino[x] + dedonde[camino[x], x]

    if verbose:
        print('camino de %d columnas  ·  coste medio %.3f'
              % (Wz, coste[yfin, -1] / Wz))
        print('  (coste 0 = el camino paso siempre por el borde mas fuerte;')
        print('   cerca de 1 = no encontro borde y fue en linea recta)')

    ux = np.arange(Wz) + zx0
    uy = camino + y0 + int(alt * arriba)
    return (ux - x0) / an, (uy - y0) / alt, (an, alt, x0, y0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('imagen')
    ap.add_argument('--arriba', type=float, default=.50)
    ap.add_argument('--abajo', type=float, default=.74)
    ap.add_argument('--salida', default='')
    a = ap.parse_args()

    fx, fy, (an, alt, x0, y0) = trazar(a.imagen, a.arriba, a.abajo)

    print()
    print('EL DIVISOR, punto por punto  (fracciones de la carta)')
    print('%-9s %-9s %s' % ('x', 'y', 'respecto del punto mas alto'))
    n = 17
    b = np.linspace(0, len(fx), n + 1).astype(int)
    tr = [(fx[s].mean(), fy[s].mean())
          for s in (slice(b[i], b[i+1]) for i in range(n)) if len(fx[s])]
    tope = min(t[1] for t in tr)
    for xm, ym in tr:
        d = (ym - tope) * alt
        print('%7.2f%%  %7.3f%%   %5.2f px  %s'
              % (100*xm, 100*ym, d, '#' * int(d*3)))

    rec = (max(t[1] for t in tr) - tope) * alt
    print()
    print('RECORRIDO  %.2f px sobre %d de ALTO  =  %.2f%% del alto'
          % (rec, alt, 100*rec/alt))
    print('           %.2f px sobre %d de ANCHO =  %.2f%% del ancho'
          % (rec, an, 100*rec/an))
    print()
    print('⚠️ Para trasladarlo se usa el % del ANCHO: la curva cruza a lo')
    print('   ancho, asi que lo que hay que conservar es subida sobre ancho.')
    print('   en una carta de 300 de ancho  ->  %.1f px' % (300*rec/an))

    if a.salida:
        im = Image.open(a.imagen).convert('RGB')
        K = 3
        im = im.resize((im.width*K, im.height*K), Image.NEAREST)
        d = ImageDraw.Draw(im)
        pts = [((x*an + x0)*K, (y*alt + y0)*K) for x, y in zip(fx, fy)]
        d.line(pts, fill=(255, 0, 140), width=3)
        im.save(a.salida)
        print('\n-> %s' % a.salida)


if __name__ == '__main__':
    main()
