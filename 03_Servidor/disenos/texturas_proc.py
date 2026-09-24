"""HASTA DONDE LLEGO YO SIN UN MODELO DE IMAGEN: texturas por codigo.

Dlx pregunto si puedo hacer fondos como los que le paso Drako, hechos con
ChatGPT. La respuesta honesta tiene dos mitades y conviene verlas, no
creerlas.

LO QUE NO PUEDO
---------------
Arte ilustrado. No tengo un modelo de imagen, asi que no hay forma de que
salga de mi un tag de graffiti dibujado a mano, una corona pintada con
aerosol, un collage de diario o una tipografia tratada como ilustracion. Esas
seis de las doce que paso Dlx estan fuera de mi alcance y no hay vuelta.

LO QUE SI PUEDO
---------------
Todo lo que sea PROCEDURAL, o sea generable con una regla matematica: ruido,
grano, semitono, tramas geometricas, salpicaduras, humo, desgaste. De las
doce referencias, cuatro caen de este lado —el semitono, el tejido de
alambre, la salpicadura y el humo— y se pueden hacer con numpy y PIL sin
depender de nadie.

⚠️ Y HAY UNA DIFERENCIA QUE IMPORTA MAS QUE LA CALIDAD: lo procedural se
PARAMETRIZA. Si el humo quedo muy denso se cambia un numero y sale de nuevo;
si el semitono se empasta en Discord se agranda el punto. Una imagen generada
por un modelo hay que volver a pedirla entera y sale distinta. Para nueve
fondos que tienen que convivir entre si, eso no es un detalle.

Este script genera cuatro y las escribe como PNG para mirarlas al tamaño real.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SCR = os.path.dirname(os.path.abspath(__file__))
W, H = 300, 405
ESC = 3                     # se dibuja a 3x y se baja, para que no aliase

AZUL = (61, 91, 255)
CLARO = (138, 156, 255)
OSCURO = (18, 27, 76)


def base():
    """El degradé de DRA, que es la cama de todas."""
    y = np.linspace(0, 1, H * ESC)[:, None]
    c = np.zeros((H * ESC, W * ESC, 3))
    for i in range(3):
        # claro -> azul en el primer 42%, azul -> oscuro en el resto
        t1 = np.clip(y / .42, 0, 1)
        t2 = np.clip((y - .42) / .58, 0, 1)
        arriba = CLARO[i] + (AZUL[i] - CLARO[i]) * t1
        abajo = AZUL[i] + (OSCURO[i] - AZUL[i]) * t2
        c[:, :, i] = np.where(y < .42, arriba, abajo)
    return c


def ruido(oct_=4, semilla=7):
    """Ruido fractal: varias octavas de ruido suavizado, sumadas.

    ⚠️ NO es ruido blanco. El ruido blanco a este tamaño se ve como grano de
    television y desaparece al bajar a 77% en Discord. Sumar octavas da
    manchas GRANDES, que son las que sobreviven.
    """
    rng = np.random.default_rng(semilla)
    out = np.zeros((H * ESC, W * ESC))
    amp = 1.0
    for o in range(oct_):
        n = 2 ** (o + 2)
        chico = rng.random((n, n))
        im = Image.fromarray((chico * 255).astype(np.uint8)).resize(
            (W * ESC, H * ESC), Image.BICUBIC)
        out += np.asarray(im) / 255 * amp
        amp *= .5
    return (out - out.min()) / (out.max() - out.min())


def humo():
    """Humo: ruido fractal empujado hacia abajo y aclarado."""
    c = base()
    n = ruido(5, 11)
    # el humo se concentra en el tercio de abajo, que es lo unico que se ve
    y = np.linspace(0, 1, H * ESC)[:, None]
    peso = np.clip((y - .45) / .55, 0, 1) ** 1.4
    m = (n ** 2.2) * peso * .55
    for i in range(3):
        c[:, :, i] = c[:, :, i] + (CLARO[i] - c[:, :, i]) * m
    return c


def semitono():
    """Puntos que crecen hacia abajo. El clasico del comic.

    ⚠️ EL PUNTO NO BAJA DE 3 px EN LA CARTA. Medido: Discord la muestra al
    77%, asi que un punto de 2 px cae a 1.5 y se empasta con su vecino. Se
    dibuja a 3x y el paso es de 9, o sea 3 en la carta.
    """
    c = base()
    paso = 9
    cap = np.zeros((H * ESC, W * ESC))
    im = Image.new('L', (W * ESC, H * ESC), 0)
    d = ImageDraw.Draw(im)
    for yy in range(0, H * ESC, paso):
        f = yy / (H * ESC)
        r = paso * .48 * (0.25 + f * .95)      # crece hacia abajo
        for xx in range(0, W * ESC, paso):
            off = (paso // 2) if (yy // paso) % 2 else 0
            d.ellipse([xx + off - r, yy - r, xx + off + r, yy + r], fill=255)
    cap = np.asarray(im.filter(ImageFilter.GaussianBlur(.8))) / 255 * .30
    for i in range(3):
        c[:, :, i] = c[:, :, i] + (OSCURO[i] - c[:, :, i]) * cap
    return c


def salpicadura():
    """Manchas de aerosol: circulos de radio aleatorio con caida suave."""
    c = base()
    rng = np.random.default_rng(3)
    im = Image.new('L', (W * ESC, H * ESC), 0)
    d = ImageDraw.Draw(im)
    for _ in range(260):
        x = rng.random() * W * ESC
        # concentradas abajo, que es donde se ve
        y = (rng.random() ** .55) * H * ESC
        r = rng.random() ** 3 * 26 * ESC + 1.2 * ESC
        d.ellipse([x - r, y - r, x + r, y + r], fill=int(60 + rng.random() * 195))
    cap = np.asarray(im.filter(ImageFilter.GaussianBlur(2.2 * ESC))) / 255 * .42
    for i in range(3):
        c[:, :, i] = c[:, :, i] + (OSCURO[i] - c[:, :, i]) * cap
    return c


def alambre():
    """Tejido romboidal, como el de un alambrado."""
    c = base()
    im = Image.new('L', (W * ESC, H * ESC), 0)
    d = ImageDraw.Draw(im)
    paso = 26 * ESC
    gr = max(2, int(1.4 * ESC))
    for k in range(-H * ESC, W * ESC + H * ESC, paso):
        d.line([(k, 0), (k + H * ESC, H * ESC)], fill=255, width=gr)
        d.line([(k, H * ESC), (k + H * ESC, 0)], fill=255, width=gr)
    y = np.linspace(0, 1, H * ESC)[:, None]
    # se desvanece hacia abajo para no pelear con el nombre
    peso = np.clip(1 - (y - .35) / .5, 0, 1)
    cap = np.asarray(im.filter(ImageFilter.GaussianBlur(.9))) / 255 * .22 * peso
    for i in range(3):
        c[:, :, i] = c[:, :, i] + (CLARO[i] - c[:, :, i]) * cap
    return c


def guardar(nombre, arr):
    a = np.clip(arr, 0, 255).astype(np.uint8)
    im = Image.fromarray(a).resize((W, H), Image.LANCZOS)
    p = os.path.join(SCR, '_tex_%s.png' % nombre)
    im.save(p)
    return p


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    for n, f in (('humo', humo), ('semitono', semitono),
                 ('salpicadura', salpicadura), ('alambre', alambre)):
        print(' ', guardar(n, f()))
