# -*- coding: utf-8 -*-
"""El mármol negro de la ACADEMIA: vetas finas sobre negro, para teñir de dorado en la carta.

    python 03_Servidor/disenos/marmol.py      -> texturas/marmol.png

🏛️ Dlx, 04/10/2026: *«colores amarillo y negro para la tarjeta»* y *«hazla con un diseño único como lo que
hiciste con DDF»*. La camiseta de la ACADEMIA es un templo de noche —el techo en punta de la carta hace de
frontón— y su material es MÁRMOL NEGRO CON VETAS DORADAS: ninguna de las otras once usa piedra.

⚠️ SE GENERA, NO SE BAJA: es ruido fractal (fBm) metido en un seno, la receta clásica del mármol, con la
semilla fija. Así sale igual cada vez y no hay que guardar de dónde vino. Las vetas son BLANCAS sobre negro
(modo L, como las otras texturas): el dorado lo pone la carta (`los_nueve.defs()`, con `multiply` y `screen`),
así el tono se cambia sin regenerar nada.

⚠️ LAS VETAS NO SON PAREJAS: una máscara de ruido grueso las apaga y las prende. Un mármol con la misma veta
en toda la carta se lee como papel tapiz.
"""
import os

import numpy as np
from PIL import Image

SCR = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.join(SCR, 'texturas', 'marmol.png')
ANCHO, ALTO = 600, 934      # el doble de la carta (300 × 467)
SEMILLA = 1204


def ruido(rng, w, h, celda):
    """Ruido de valor: una grilla al azar, agrandada con interpolación bicúbica."""
    gw, gh = w // celda + 3, h // celda + 3
    g = Image.fromarray((rng.random((gh, gw)) * 255).astype('uint8'), 'L')
    g = g.resize((gw * celda, gh * celda), Image.BICUBIC)
    return np.asarray(g, dtype=float)[:h, :w] / 255.0


def fbm(rng, w, h, celda=160, octavas=5):
    """Ruido fractal: cada octava, la mitad de grande y la mitad de fuerte."""
    t, amp, tot = np.zeros((h, w)), 1.0, 0.0
    for _ in range(octavas):
        t += ruido(rng, w, h, max(celda, 2)) * amp
        tot += amp
        amp *= 0.5
        celda //= 2
    return t / tot


def vetas(rng, w, h, ang, frec, turb, fino, celda):
    y, x = np.mgrid[0:h, 0:w].astype(float)
    eje = x * np.cos(ang) + y * np.sin(ang)
    m = np.sin(eje / w * frec * 2 * np.pi + fbm(rng, w, h, celda) * turb)
    return (1.0 - np.abs(m)) ** fino


def main():
    rng = np.random.default_rng(SEMILLA)
    w, h = ANCHO, ALTO
    # dos familias de vetas: las largas y marcadas, y las finas que las cruzan
    grandes = vetas(rng, w, h, ang=1.05, frec=2.2, turb=7.5, fino=34, celda=220)
    finas = vetas(rng, w, h, ang=-0.45, frec=3.6, turb=11.0, fino=55, celda=150) * 0.45
    mascara = np.clip((fbm(rng, w, h, 260, 3) - 0.38) * 3.2, 0, 1)
    cuerpo = fbm(rng, w, h, 300, 4) * 0.10           # la piedra, apenas nublada
    t = np.clip(np.maximum(grandes, finas) * (0.25 + 0.75 * mascara) + cuerpo, 0, 1)
    Image.fromarray((t * 255).astype('uint8'), 'L').save(SALIDA, optimize=True)
    print('-> %s  ·  %dx%d  ·  media %.3f' % (os.path.relpath(SALIDA, SCR), w, h, t.mean()))


if __name__ == '__main__':
    main()
