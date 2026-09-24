"""El NEON de la referencia: no es una vertical suelta, es una U.

⚠️ ME EQUIVOQUE DOS VECES ANTES Y LAS DOS POR LO MISMO: buscar el borde mas
fuerte en vez de buscar LA LINEA QUE DLX SEÑALA. El gradiente mas fuerte de
la imagen es el marco, y el segundo es el dibujo del fondo. La luz neon es
mas fina que los dos y por eso nunca aparecia primera.

Dlx: "tiene como una luz neon que separa la parte del avatar y las
estadisticas".

LA CLAVE ES BUSCARLA POR COLOR, NO POR CONTRASTE. El neon es cian brillante
y saturado; el marco es magenta y violeta; el campo es azul oscuro. Un filtro
por tono y saturacion la aisla, y ahi si se puede medir donde esta.

⚠️ Y LO QUE APARECE CAMBIA EL PLANTEO: el neon NO es una vertical del
costado. Es una U que rodea la zona del avatar —baja por dentro del borde
izquierdo, cruza por abajo, y sube por dentro del derecho—. La curva de
abajo de esa U ES NUESTRO DIVISOR: ya la dibujamos. Lo que falta son sus dos
lados.

O sea que el divisor y el "panel del costado" son LA MISMA PIEZA, y nosotros
dibujamos solo el fondo de ella.
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


def neon(p):
    """La mascara del neon: lo mas CLARO Y SATURADO de la carta."""
    a = np.array(Image.open(p).convert('RGBA'))
    x0, y0, x1, y1 = caja(a)
    rgb = np.array(Image.open(p).convert('RGB')).astype(float)[y0:y1, x0:x1]
    h, w = rgb.shape[:2]
    mx = rgb.max(2)
    mn = rgb.min(2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    L = .2126 * rgb[:, :, 0] + .7152 * rgb[:, :, 1] + .0722 * rgb[:, :, 2]
    # el neon es lo mas brillante: se toma el 6% mas claro con saturacion
    corte = np.percentile(L, 94)
    m = (L >= corte) & (sat > .30)
    return w, h, m, rgb


def main():
    print('EL NEON, buscado POR COLOR y no por contraste\n')
    print('  (columnas donde el neon ocupa mas altura, en % del ancho)')
    print('  cob = en que % de las filas del CAMPO hay neon en esa columna\n')
    for etq, f in FUENTES:
        p = os.path.join(REF, f)
        if not os.path.exists(p):
            continue
        w, h, m, rgb = neon(p)
        # el campo: del 8% al 72% del alto, o sea sin el marco de arriba ni
        # el pie. Ahi es donde vive la U.
        campo = m[int(h * .08):int(h * .72)]
        cob = 100 * campo.mean(0)
        # picos de la mitad izquierda y de la derecha
        izq = cob[:int(w * .45)]
        der = cob[int(w * .55):]
        xi = int(izq.argmax())
        xd = int(der.argmax()) + int(w * .55)
        # y hasta donde llega cada uno
        ys_i = np.where(m[:, xi])[0]
        ys_d = np.where(m[:, xd])[0]
        print('  %-20s %4dx%-4d' % (etq, w, h))
        print('     izq  x %5.1f%%  cob %4.1f%%   y %4.1f%%..%5.1f%%'
              % (100 * xi / w, cob[xi], 100 * ys_i.min() / h,
                 100 * ys_i.max() / h) if len(ys_i) else '     izq  -')
        print('     der  x %5.1f%%  cob %4.1f%%   y %4.1f%%..%5.1f%%'
              % (100 * xd / w, cob[xd], 100 * ys_d.min() / h,
                 100 * ys_d.max() / h) if len(ys_d) else '     der  -')
        # ¿hay neon tambien en una franja horizontal abajo? (el divisor)
        fila = 100 * m[:, int(w * .3):int(w * .7)].mean(1)
        j = int(np.argmax(fila[int(h * .55):int(h * .80)])) + int(h * .55)
        print('     abajo   la fila con mas neon del tramo 55-80%% esta en '
              'y %.1f%%  (cob %.1f%%)' % (100 * j / h, fila[j]))
        sim = abs((100 - 100 * xd / w) - 100 * xi / w)
        print('     simetria: izq %.1f%% vs der %.1f%% del borde  ->  %s\n'
              % (100 * xi / w, 100 - 100 * xd / w,
                 'ESPEJADAS' if sim < 4 else 'no espejadas'))

    print('  ' + '=' * 68)
    print("""
  ⚠️ SI LAS DOS VERTICALES ESTAN ESPEJADAS Y ADEMAS HAY UNA FILA DE NEON
  ABAJO, entonces no son dos verticales y un divisor: son UNA SOLA PIEZA en
  U que rodea la zona del avatar. Y nuestra carta ya dibuja el fondo de esa
  U —el divisor— pero no sus lados.
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
