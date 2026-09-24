"""Las verticales del costado, con su ALTURA. Cual es marco y cual es panel.

⚠️ LA MEDICION ANTERIOR NO PODIA CONTESTAR ESTO Y YO LA DI POR BUENA.
Promediaba una sola franja de altura (15% a 60%) y devolvia solo la POSICION
de los picos. Con eso un filo de marco y un divisor interno se ven iguales:
los dos son una vertical fuerte en la mitad derecha.

Lo que los separa es HASTA DONDE LLEGAN:

    el filo del marco   corre casi todo el alto de la carta
    un divisor interno  arranca y termina adentro del campo

Dlx lo vio a ojo en la FINAL REFERENCIA —"tiene como una luz neon que separa
la parte del avatar y las estadisticas"— y tiene razon: en su recorte se ven
DOS verticales cian, no una.

COMO SE MIDE AHORA. Por cada columna se marca en que FILAS hay un borde
vertical fuerte, y de ahi sale el tramo que ocupa esa vertical. Una columna
con borde en el 90% de las filas es marco; una con borde en el 40% y
empezando por la mitad es un divisor.
"""
import os
import sys

import numpy as np
from PIL import Image

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
REF = os.path.join(BASE, '03_Servidor', 'referencia', 'estructura')

FUENTES = [
    ('FINAL REFERENCIA', 'FINAL REFERENCIA.png'),
    ('UCL_ICON_A4', 'backgrounds_21_UCL_ICON_A4.png'),
    ('TOTS_ICON_A4', 'backgrounds_21_TOTS_ICON_A4.png'),
    ('ICON_PRIME_5', 'backgrounds_22_ICON_PRIME_5.png'),
    ('TOTS23_EVENT', 'backgrounds_22_TOTS23_ICON_EVENT.png'),
    ('UCL23_ICON_5', 'backgrounds_22_UCL23_ICON_5.png'),
]


def caja(a):
    if a.shape[2] == 4 and (a[:, :, 3] < 250).mean() > .01:
        m = a[:, :, 3] > 40
    else:
        f = np.array(a[0, 0, :3], float)
        m = np.abs(a[:, :, :3].astype(float) - f).sum(2) > 30
    ys, xs = np.where(m)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def verticales(p, umbral=.32):
    a = np.array(Image.open(p).convert('RGBA'))
    x0, y0, x1, y1 = caja(a)
    rgb = np.array(Image.open(p).convert('RGB')).astype(float)[y0:y1, x0:x1]
    h, w = rgb.shape[:2]
    L = .2126 * rgb[:, :, 0] + .7152 * rgb[:, :, 1] + .0722 * rgb[:, :, 2]
    # borde vertical por pixel; se compara cada columna con la de al lado
    g = np.abs(np.diff(L, axis=1))
    if g.max() <= 0:
        return None
    g = g / g.max()
    fuerte = g > umbral                     # (h, w-1) booleano
    out = []
    for i in range(w - 1):
        col = fuerte[:, i]
        if col.sum() < h * .12:
            continue
        ys = np.where(col)[0]
        out.append({'x': 100 * (i + .5) / (w - 1),
                    'cob': 100 * col.sum() / h,
                    'y0': 100 * ys.min() / h, 'y1': 100 * ys.max() / h,
                    'f': g[:, i].mean()})
    # agrupar columnas pegadas: una linea de 2 px son dos columnas
    grupos = []
    for c in out:
        if grupos and c['x'] - grupos[-1][-1]['x'] < 2.2:
            grupos[-1].append(c)
        else:
            grupos.append([c])
    res = []
    for gr in grupos:
        b = max(gr, key=lambda c: c['cob'])
        res.append({'x': sum(c['x'] for c in gr) / len(gr), 'cob': b['cob'],
                    'y0': min(c['y0'] for c in gr),
                    'y1': max(c['y1'] for c in gr)})
    return w, h, res


def main():
    print('LAS VERTICALES DE CADA REFERENCIA, con su tramo')
    print('  x    = posicion en % del ancho')
    print('  cob  = en que % de las filas hay borde  ->  MARCO si es alto')
    print('  y0-y1= entre que alturas vive')
    print()
    for etq, f in FUENTES:
        p = os.path.join(REF, f)
        if not os.path.exists(p):
            continue
        r = verticales(p)
        if not r:
            continue
        w, h, vs = r
        print('  %s   (%dx%d)' % (etq, w, h))
        if not vs:
            print('     (ninguna)')
        for v in sorted(vs, key=lambda c: c['x']):
            tipo = ('MARCO' if v['cob'] > 55 else
                    'divisor' if v['cob'] > 20 else '.')
            lado = 'der' if v['x'] > 50 else 'izq'
            print('     x %5.1f%%  cob %4.1f%%   y %4.1f%%..%5.1f%%   %-8s %s'
                  % (v['x'], v['cob'], v['y0'], v['y1'], tipo, lado))
        print()

    print('  ' + '=' * 68)
    print("""
  LO QUE HAY QUE MIRAR: si en la mitad derecha aparecen DOS verticales, una
  con cobertura alta (el filo del marco, pegado al borde) y otra con
  cobertura media mas adentro, entonces SI hay un divisor interno y Dlx
  tiene razon. Si solo aparece una, era marco.
""")


if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    main()
