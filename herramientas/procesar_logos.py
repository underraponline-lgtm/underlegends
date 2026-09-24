"""
CONVERSOR DE LOGOS A SILUETA — para los rombos de la Competitiva
================================================================

El rombo NO muestra la imagen: la usa como `mask-image`. Solo le importa el
canal alfa. Donde la imagen es opaca, pinta blanco. Por eso todo logo tiene
que convertirse a silueta antes de entrar.

DOS COSAS QUE HAY QUE RESOLVER EN CADA LOGO
-------------------------------------------

1 · DE DONDE SALE LA SILUETA. Depende de como venga el archivo:

   'alfa'     el archivo ya trae transparencia util -> se usa tal cual
   'fondo'    fondo plano de un color -> alfa = cuanto se aleja del fondo
   'oscuro'   dibujo OSCURO sobre claro -> alfa = lo oscuro
              (URBF es una pegatina: su alfa propio marca el contorno blanco
               entero y sale una mancha. Lo que vale son las letras negras)
   'vivo'     dibujo saturado sobre fondo del mismo tono pero apagado
              (TWR: fondo negro con tags rosa apagado y el TWR en rosa vivo.
               Quitar el fondo por color se traia la textura entera: 47%)

2 · CUANTO OCUPA. Meter cada logo en un cuadrado no alcanza: uno ancho queda
   con aire arriba y abajo y el rombo, al escalar ese cuadrado, lo muestra
   chico. Se normaliza por TINTA, no por caja: el lienzo se calcula para que
   todos los logos cubran una fraccion parecida del rombo.
"""
import os as _osruta
RAIZ = _osruta.path.dirname(_osruta.path.abspath(__file__))
def _r(*p): return _osruta.path.join(RAIZ, *p)
import numpy as np
from PIL import Image
from scipy import ndimage

TINTA_OBJETIVO = 0.30      # fraccion del lienzo que deberia ocupar el dibujo
MARGEN_MINIMO  = 1.02      # el lienzo nunca puede ser menor que la caja del dibujo
MARGEN_MAXIMO  = 1.70      # ni tan grande que el logo quede perdido

MODOS = {
    'twr' : ('TWR.png',     'vivo'),
    'tfc' : ('TFC.png',     'alfa'),
    'sr'  : ('SR.png',      'alfa'),
    'dra' : ('DRA.png',     'fondo'),
    'urbf': ('URBF.png',    'oscuro'),
    'ftn' : ('FTN.png',     'alfa'),
    'efa' : ('EFA.jpg',     'fondo'),
    'frz' : ('FRZ_orig.png','fondo'),
}


def _alfa_cruda(a, modo):
    """Devuelve la mascara 0-255 antes de recortar y normalizar."""
    rgb = a[:, :, :3]
    if modo == 'alfa':
        return a[:, :, 3].copy()

    if modo == 'fondo':
        esq = np.array([a[0, 0, :3], a[0, -1, :3], a[-1, 0, :3], a[-1, -1, :3]])
        fondo = np.median(esq, axis=0)
        d = np.sqrt(((rgb - fondo) ** 2).sum(axis=2))
        return np.clip(d / max(d.max(), 1) * 255 * 1.6, 0, 255)

    if modo == 'oscuro':
        # solo lo que es opaco Y oscuro: las letras, no el borde blanco
        lum = rgb.mean(axis=2)
        op = a[:, :, 3] > 200
        return np.where(op, np.clip((150 - lum) / 90, 0, 1) * 255, 0)

    if modo == 'vivo':
        val = rgb.max(axis=2) / 255
        mn = rgb.min(axis=2) / 255
        sat = np.where(val > 0, (val - mn) / np.maximum(val, 1e-6), 0)
        return np.clip((val - 0.45) / 0.25, 0, 1) * np.clip((sat - 0.45) / 0.2, 0, 1) * 255

    raise ValueError('modo desconocido: %s' % modo)


def _sin_basura(m, limite=0.02):
    """Borra manchitas chicas pegadas al borde: marcas de agua y esquinas
       redondeadas. Sin esto la caja del dibujo se estira hasta el borde y el
       logo queda descentrado. El archivo de DRA traia un destello de 756px
       en la esquina que corria el centro de x=512 a x=603."""
    b = m > 25
    lab, n = ndimage.label(b)
    if n < 2:
        return m
    tot = b.sum()
    H, W = b.shape
    fuera = np.zeros_like(b)
    for i in range(1, n + 1):
        c = lab == i
        px = c.sum()
        if px / tot >= limite:
            continue
        ys, xs = np.where(c)
        toca = xs.min() <= 2 or ys.min() <= 2 or xs.max() >= W - 3 or ys.max() >= H - 3
        if toca:
            fuera |= c
    return np.where(fuera, 0, m)


def silueta(ruta, salida, modo):
    a = np.array(Image.open(ruta).convert('RGBA')).astype(float)
    m = _alfa_cruda(a, modo)

    m = _sin_basura(m)

    ys, xs = np.where(m > 25)
    if not len(ys):
        raise ValueError('no quedo nada visible en %s con modo %s' % (ruta, modo))
    m = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = m.shape

    # el lienzo sale de la TINTA, no de la caja: asi un logo ancho y uno
    # cuadrado terminan pesando parecido dentro del rombo
    tinta = (m > 25).sum()
    lado = int(np.clip(np.sqrt(tinta / TINTA_OBJETIVO),
                       max(h, w) * MARGEN_MINIMO, max(h, w) * MARGEN_MAXIMO))

    L = np.zeros((lado, lado))
    oy, ox = (lado - h) // 2, (lado - w) // 2
    L[oy:oy + h, ox:ox + w] = m

    out = np.zeros((lado, lado, 4), dtype=np.uint8)
    out[:, :, :3] = 255
    out[:, :, 3] = L.astype(np.uint8)
    Image.fromarray(out, 'RGBA').resize((256, 256), Image.LANCZOS).save(salida)
    return 100.0 * (L > 25).mean(), w / max(h, 1)


if __name__ == '__main__':
    # Entra por logos_originales/ y sale a comun/logos_sv/, que es de donde
    # las tres cartas leen las siluetas. Antes apuntaba a herramientas/logos_sv/,
    # que no existe: los originales estaban en logos_originales/ y las siluetas
    # triplicadas en cada carpeta de carta, asi que regenerar no llegaba a
    # ninguna de las tres.
    _ORIG = _r('logos_originales')
    _DEST = _osruta.path.join(_osruta.path.dirname(RAIZ), 'comun', 'logos_sv')
    _osruta.makedirs(_DEST, exist_ok=True)
    print('origen : %s' % _ORIG)
    print('destino: %s\n' % _DEST)
    print('%-6s %-8s %10s %8s' % ('logo', 'modo', 'proporcion', 'tinta'))
    print('-' * 38)
    for clave, (arch, modo) in MODOS.items():
        t, p = silueta(_osruta.path.join(_ORIG, arch),
                       _osruta.path.join(_DEST, 'sv_%s.png' % clave), modo)
        print('%-6s %-8s %10.2f %7.1f%%' % (clave.upper(), modo, p, t))
