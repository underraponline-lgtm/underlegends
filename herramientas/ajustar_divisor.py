"""Recuperar LA CURVA ORIGINAL del divisor, no su rasterizado.

EL PROBLEMA DE FONDO, que recien ahora veo:

El trazo por programacion dinamica esta BIEN pero devuelve ENTEROS: el
camino se mueve de a un pixel, asi que el resultado es una escalera. Al
escalarla a nuestra carta esa escalera se agranda y se ve temblorosa. No es
que la medicion este mal: es que estoy copiando el RASTERIZADO en vez de la
curva que lo genero.

⚠️ Y ESO INVALIDA UNA CONCLUSION MIA. Dije que "la cima es plana, tres
lecturas seguidas en 62.8%, asi que no es una parabola". Con 8 px de
recorrido sobre 152 columnas, la pendiente cerca de la cima es casi cero:
varias columnas seguidas en el mismo entero es EXACTAMENTE lo que se ve al
rasterizar una curva suave. La meseta era del pixel, no del diseño.

QUE HACE ESTE ARCHIVO, en dos pasos:

  1. LOCALIZACION SUBPIXEL. Para cada columna se toma el gradiente en una
     ventana chica alrededor del camino y se calcula su CENTROIDE pesado.
     Eso da un y fraccionario: donde de verdad esta el borde, no en que
     pixel cae.

  2. AJUSTE DE MODELO. La referencia es arte vectorial: su divisor es una
     curva matematica, y el PNG es su rasterizado. Ajustar el modelo NO es
     aproximar: es DESHACER el rasterizado. Se prueban varios y se informa
     el error de cada uno en pixeles, para elegir con el numero.

Si el residuo del mejor modelo queda por debajo de medio pixel, ese modelo
ES la curva original recuperada, no una version parecida.
"""
import argparse
import os

import numpy as np
from PIL import Image, ImageDraw


def perfil_subpixel(ruta, arriba=.54, abajo=.76, izq=.16, der=.84, vent=4):
    from scipy import ndimage

    im = Image.open(ruta).convert('RGBA')
    a = np.array(im).astype(float)
    al = a[:, :, 3]
    ys, xs = np.where(al > 60)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    an, alt = x1 - x0, y1 - y0
    lum = np.where(al > 60, .2126*a[:, :, 0] + .7152*a[:, :, 1] + .0722*a[:, :, 2], 0)

    zx0, zx1 = x0 + int(an * izq), x0 + int(an * der)
    zy0, zy1 = y0 + int(alt * arriba), y0 + int(alt * abajo)
    zona = ndimage.gaussian_filter(lum[zy0:zy1, zx0:zx1], 1.0)
    g = np.abs(np.gradient(zona, axis=0))
    g = g / (g.max() + 1e-9)

    # ── paso 1: camino entero por programacion dinamica ──
    H, Wz = g.shape
    coste = np.full((H, Wz), np.inf)
    dedonde = np.zeros((H, Wz), int)
    coste[:, 0] = 1.0 - g[:, 0]
    for x in range(1, Wz):
        prev = coste[:, x - 1]
        op = np.vstack([np.r_[np.inf, prev[:-1]], prev, np.r_[prev[1:], np.inf]])
        m = np.argmin(op, axis=0)
        coste[:, x] = op[m, np.arange(H)] + (1.0 - g[:, x])
        dedonde[:, x] = m - 1
    yf = int(np.argmin(coste[:, -1]))
    cam = np.zeros(Wz, int)
    cam[-1] = yf
    for x in range(Wz - 1, 0, -1):
        cam[x - 1] = cam[x] + dedonde[cam[x], x]

    # ── paso 2: refinar cada columna al CENTROIDE del gradiente ──
    sub = np.empty(Wz)
    for x in range(Wz):
        lo = max(0, cam[x] - vent)
        hi = min(H, cam[x] + vent + 1)
        w = g[lo:hi, x]
        if w.sum() < 1e-6:
            sub[x] = cam[x]
        else:
            sub[x] = lo + (w * np.arange(len(w))).sum() / w.sum()

    return (np.arange(Wz) + zx0, sub + zy0, an, alt, x0, y0, im)


# ── los modelos ────────────────────────────────────────────────────────
def ajustar(u, v):
    """u,v normalizados a [-1,1] y pixeles. Devuelve [(nombre, f, rms, k)]."""
    out = []

    for grado, nombre in ((2, 'parabola'), (4, 'polinomio de 4to'),
                          (6, 'polinomio de 6to')):
        c = np.polyfit(u, v, grado)
        f = np.poly1d(c)
        out.append((nombre, f, float(np.sqrt(((f(u) - v) ** 2).mean())),
                    grado + 1))

    # arco de circunferencia: (u-a)^2 + (v-b)^2 = r^2, resuelto en lineal
    Amat = np.c_[u, v, np.ones(len(u))]
    bvec = u ** 2 + v ** 2
    sol, *_ = np.linalg.lstsq(Amat, bvec, rcond=None)
    ac, bc = sol[0] / 2, sol[1] / 2
    rc = np.sqrt(sol[2] + ac ** 2 + bc ** 2)

    def arco(uu, ac=ac, bc=bc, rc=rc):
        d = np.maximum(rc ** 2 - (uu - ac) ** 2, 0)
        return bc - np.sqrt(d) if bc > np.mean(v) else bc + np.sqrt(d)

    out.append(('arco de circunferencia', arco,
                float(np.sqrt(((arco(u) - v) ** 2).mean())), 3))

    # coseno alzado: v = a - h*cos(pi*u/2)... equivale a un arco simetrico
    base = np.c_[np.cos(np.pi * u / 2), np.ones(len(u))]
    cf, *_ = np.linalg.lstsq(base, v, rcond=None)

    def cos_alz(uu, cf=cf):
        return cf[0] * np.cos(np.pi * uu / 2) + cf[1]

    out.append(('coseno alzado', cos_alz,
                float(np.sqrt(((cos_alz(u) - v) ** 2).mean())), 2))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('imagen')
    ap.add_argument('--arriba', type=float, default=.54)
    ap.add_argument('--abajo', type=float, default=.76)
    ap.add_argument('--salida', default='')
    a = ap.parse_args()

    px, py, an, alt, x0, y0, im = perfil_subpixel(a.imagen, a.arriba, a.abajo)
    print('%d columnas  ·  carta %dx%d' % (len(px), an, alt))
    print('el trazo entero se movia de a 1 px; el refinado da fracciones:')
    print('  ', '  '.join('%.2f' % v for v in py[:8]), '...')
    print()

    u = 2 * (px - px.mean()) / np.ptp(px)      # -1 .. 1
    modelos = ajustar(u, py)

    print('%-26s %-9s %s' % ('modelo', 'params', 'error RMS en pixeles'))
    print('-' * 62)
    for nombre, f, rms, k in sorted(modelos, key=lambda m: m[2]):
        aviso = '  <= por debajo de medio pixel' if rms < .5 else ''
        print('%-26s %-9d %.4f px%s' % (nombre, k, rms, aviso))

    mejor = min(modelos, key=lambda m: m[2] + .015 * m[3])
    print()
    print('ELEGIDO: %s  (RMS %.4f px con %d parametros)'
          % (mejor[0], mejor[2], mejor[3]))
    print('  se penaliza tener mas parametros: un polinomio de 6to siempre')
    print('  ajusta mejor, pero si el de menos grado ya baja del pixel, el')
    print('  resto solo esta copiando el ruido del rasterizado.')

    f = mejor[1]
    ext = (f(-1.0) + f(1.0)) / 2
    cima = f(0.0)
    rec = ext - cima
    print()
    print('LA CURVA RECUPERADA')
    print('  extremos   %.3f%% del alto' % (100 * (ext - y0) / alt))
    print('  cima       %.3f%% del alto' % (100 * (cima - y0) / alt))
    print('  RECORRIDO  %.3f px sobre %d de ANCHO  =  %.3f%% del ancho'
          % (rec, an, 100 * rec / an))
    print('  en una carta de 300 de ancho  ->  %.2f px' % (300 * rec / an))
    print()
    print('  el perfil, en 11 puntos de -1 a 1 (0 = extremos, 1 = cima):')
    uu = np.linspace(-1, 1, 11)
    hh = (ext - f(uu)) / rec
    print('  ', '  '.join('%.3f' % h for h in hh))

    if a.salida:
        K = 3
        vis = im.convert('RGB').resize((im.width*K, im.height*K), Image.NEAREST)
        d = ImageDraw.Draw(vis)
        uu = np.linspace(-1, 1, 400)
        xx = px.mean() + uu * np.ptp(px) / 2
        d.line([(float(x*K), float(f(v)*K)) for x, v in zip(xx, uu)],
               fill=(255, 0, 140), width=3)
        vis.save(a.salida)
        print('\n-> %s' % a.salida)


if __name__ == '__main__':
    main()
