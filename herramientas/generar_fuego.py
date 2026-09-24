"""Generar FUEGO de verdad, no un degradado que ilumina.

Un radial-gradient no es fuego: no tiene lengua, ni borde recortado, ni
variacion a lo ancho. Ilumina desde abajo y nada mas. Se nota enseguida.

EL ALGORITMO es el clasico de propagacion, el de las demos viejas:

  1. la fila de abajo se pone caliente, con puntos calientes separados en
     vez de pareja: de ahi salen las LENGUAS
  2. cada fila de arriba toma el promedio de sus vecinas de abajo y se
     enfria un poco al azar
  3. cada fila se corre al azar un pixel a un lado: eso es el titileo, y es
     lo que hace que la llama serpentee en vez de subir recta

El resultado tiene forma de fuego porque se COMPORTA como fuego: el calor
sube, se difunde a los lados y se apaga. No esta dibujado.

Sale en escala de grises con alfa, para que la carta le ponga el color. Asi
el mismo fuego sirve azul para RZ o naranja para quien lo necesite.

    python herramientas/generar_fuego.py
        -> 03_Servidor/disenos/texturas/fuego.png        lenguas altas
        -> 03_Servidor/disenos/texturas/fuego_bajo.png   lenguas cortas
        -> 03_Servidor/disenos/texturas/fuego_lado.png   para el borde, rotado
"""
import os

import numpy as np
from PIL import Image, ImageFilter

SAL = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   '..', '03_Servidor', 'disenos', 'texturas')
SAL = os.path.abspath(SAL)


def fuego(w=320, h=440, focos=13, enfria=3.1, semilla=4, alto=1.0):
    r = np.random.default_rng(semilla)
    f = np.zeros((h, w))

    # LA BASE: puntos calientes separados, no una linea pareja. Una linea
    # pareja da una pared de fuego; los focos dan lenguas.
    base = np.zeros(w)
    for c in r.integers(0, w, focos):
        ancho = r.integers(8, 26)
        x = np.arange(w)
        base += np.exp(-((x - c) ** 2) / (2 * ancho ** 2)) * r.uniform(.7, 1.0)
    base = np.clip(base, 0, 1) * 255
    f[-1] = base
    f[-2] = base * .96

    # Cada columna se enfria distinto, con un perfil suave: por eso unas
    # lenguas llegan mas alto que otras. Con un enfriamiento parejo todas
    # mueren a la misma altura y el fuego queda con la punta plana.
    perfil = r.random(w)
    for _ in range(6):
        perfil = (np.roll(perfil, 1) + perfil * 2 + np.roll(perfil, -1)) / 4
    perfil = .55 + 1.5 * (perfil - perfil.min()) / (np.ptp(perfil) + 1e-9)

    x = np.arange(w)
    for y in range(h - 3, -1, -1):
        ab = f[y + 1]
        # ⚠️ EL DIVISOR TIENE QUE SER MAYOR QUE LA SUMA DE LOS PESOS.
        # Los cuatro terminos pesan 1+2+1+1 = 5. Con 4.02 el promedio daba
        # 1.24 veces la fila de abajo, o sea que el fuego SE AMPLIFICABA y
        # llegaba entero hasta arriba: medido, tinta 100% y llama al 100%
        # de alto. Con 5.02 cada fila sale apenas mas fria que la anterior,
        # que es lo que hace que la llama termine.
        prom = (np.roll(ab, 1) + ab * 2 + np.roll(ab, -1) + f[y + 2]) / (5.02 / alto)
        nueva = np.clip(prom - r.random(w) * enfria * perfil, 0, 255)
        # ⚠️ EL TITILEO VA PIXEL POR PIXEL, no fila por fila. Corriendo la
        # fila entera junta, las columnas suben paralelas y el fuego sale
        # con la punta PLANA, como bloques. Con el corrimiento por pixel
        # cada lengua serpentea por su cuenta y se afina al subir.
        f[y] = nueva[(x + r.integers(-1, 2, w)) % w]

    im = Image.fromarray(f.astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.1))
    a = np.array(im).astype(float)
    a = np.clip((a - 14) * 1.35, 0, 255)          # limpia la bruma de arriba
    gris = a.astype(np.uint8)
    return Image.merge('RGBA', [Image.fromarray(gris)] * 3 + [Image.fromarray(gris)])


if __name__ == '__main__':
    os.makedirs(SAL, exist_ok=True)
    for nombre, kw in (
            ('fuego',      dict(alto=1.0, enfria=1.55, focos=10, semilla=4)),
            ('fuego_bajo', dict(alto=1.0, enfria=4.2, focos=17, semilla=11)),
            ('fuego_lado', dict(alto=1.0, enfria=3.4, focos=9, semilla=7,
                                w=440, h=320)),
    ):
        im = fuego(**kw)
        if nombre == 'fuego_lado':
            im = im.rotate(90, expand=True)
        im = im.resize((im.width * 2, im.height * 2), Image.LANCZOS)
        im.save(os.path.join(SAL, nombre + '.png'))
        a = np.array(im)[:, :, 3]
        print('%-12s %dx%d   tinta %.0f%%   alto medio de la llama %.0f%%'
              % (nombre, im.width, im.height, 100 * (a > 24).mean(),
                 100 * (1 - np.argmax((a > 40).any(axis=1)) / im.height)))
    print('\n-> %s' % SAL)
