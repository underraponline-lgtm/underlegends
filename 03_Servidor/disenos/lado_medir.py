"""Que hace de verdad la referencia en el costado, y que hacen nuestras cartas.

⚠️ ESTO CORRIGE UNA NOTA VIEJA. En ESTADO.md quedo escrito que la vertical
del costado estaba "al 32.4% del panel" y que "repinta el material de la
carta y se desvanece hacia el centro". Mirando la FINAL REFERENCIA con zoom
7x, lo que hay en el costado NO es un panel de contenido: es EL FILO INTERNO
DEL MARCO. Adentro de esa linea el campo esta vacio.

Asi que la pregunta "que ponemos en el panel del costado" puede estar mal
planteada, y por eso se vuelve a medir en vez de seguir la nota.

COMO SE MIDE. Por cada referencia:

  1. se recorta la caja de la carta (lo que no es fondo)
  2. se toma SOLO la franja del campo —del 15% al 60% del alto— para no
     mezclar el marco de arriba ni el panel del pie
  3. por columna, la fuerza de borde vertical: |dL/dx| promedio
  4. se reportan los picos, en % del ANCHO de la carta

⚠️ Con la CONFIANZA de cada pico, que es lo que hace usable la tabla: un
pico de gradiente siempre existe; lo que dice si es real es cuanto le gana
al resto. Sin eso, cualquier ruido pasa por medida.
"""
import os
import sys

import numpy as np
from PIL import Image

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
REF = os.path.join(BASE, '03_Servidor', 'referencia', 'estructura')

FUENTES = [
    ('FINAL REFERENCIA', 'FINAL REFERENCIA.png'),
    ('UCL_ICON_A4', 'backgrounds_21_UCL_ICON_A4.png'),
    ('TOTS_ICON_A4', 'backgrounds_21_TOTS_ICON_A4.png'),
    ('ICON_PRIME_5', 'backgrounds_22_ICON_PRIME_5.png'),
    ('TOTS23_EVENT', 'backgrounds_22_TOTS23_ICON_EVENT.png'),
    ('UCL23_ICON_5', 'backgrounds_22_UCL23_ICON_5.png'),
    ('UCL23_T1_5', 'backgrounds_22_UCL23_T1_5.png'),
]


def caja(im):
    """La caja de la carta: alfa si la hay, si no el color de las esquinas."""
    a = np.array(im)
    if a.shape[2] == 4 and (a[:, :, 3] < 250).mean() > .01:
        m = a[:, :, 3] > 40
    else:
        esq = [tuple(a[0, 0, :3]), tuple(a[0, -1, :3]),
               tuple(a[-1, 0, :3]), tuple(a[-1, -1, :3])]
        f = np.array(esq[0], float)
        m = np.abs(a[:, :, :3].astype(float) - f).sum(2) > 30
    ys, xs = np.where(m)
    if not len(ys):
        return None
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def picos(im):
    b = caja(im)
    if b is None:
        return None
    x0, y0, x1, y1 = b
    a = np.array(im.convert('RGB')).astype(float)[y0:y1, x0:x1]
    h, w = a.shape[:2]
    L = .2126 * a[:, :, 0] + .7152 * a[:, :, 1] + .0722 * a[:, :, 2]
    # ⚠️ solo la franja del CAMPO: sin el marco de arriba ni el pie
    fr = L[int(h * .15):int(h * .60)]
    g = np.abs(np.diff(fr, axis=1)).mean(0)
    if g.max() <= 0:
        return None
    # suavizado corto para no contar el mismo borde dos veces
    k = np.ones(3) / 3
    gs = np.convolve(g, k, 'same')
    base = np.median(gs)
    out = []
    gg = gs.copy()
    for _ in range(4):
        i = int(gg.argmax())
        conf = gs[i] / base if base > 0 else 0
        out.append((100 * (i + .5) / (w - 1), conf))
        gg[max(0, i - int(w * .05)):i + int(w * .05)] = 0
    return w, h, out


def main():
    print('DONDE ESTA LA VERTICAL DEL COSTADO, en % del ANCHO de la carta')
    print('  (0% = borde izquierdo, 100% = borde derecho)')
    print('  conf = cuanto le gana el pico a la mediana. Debajo de ~2 no es real.\n')
    print('  %-20s %9s   %s' % ('referencia', 'tamaño', 'picos (x%  conf)'))
    print('  ' + '-' * 74)
    todos = []
    for etq, f in FUENTES:
        p = os.path.join(REF, f)
        if not os.path.exists(p):
            print('  %-20s   (falta)' % etq)
            continue
        r = picos(Image.open(p).convert('RGBA'))
        if r is None:
            continue
        w, h, ps = r
        cel = '  '.join('%5.1f%% x%.1f' % (x, c) for x, c in ps)
        print('  %-20s %4dx%-4d   %s' % (etq, w, h, cel))
        der = [(x, c) for x, c in ps if x > 55 and c >= 2.0]
        if der:
            todos.append((etq, max(der, key=lambda t: t[1])))

    print('\n  LOS PICOS DE LA MITAD DERECHA con confianza >= 2:')
    for etq, (x, c) in todos:
        print('     %-20s %5.1f%%   x%.1f' % (etq, x, c))
    if todos:
        v = [x for _, (x, _) in todos]
        print('\n     promedio %.1f%%   ·   rango %.1f%% a %.1f%%'
              % (sum(v) / len(v), min(v), max(v)))
        print("""
  ⚠️ SI ESE PROMEDIO CAE CERCA DEL 80%, NO ES UN PANEL DE CONTENIDO: es el
  FILO INTERNO DEL MARCO. Un panel de datos como el de FC Mobile vive mas
  adentro, cerca del 65-70%. La diferencia decide todo: contra el filo del
  marco no se pone nada, porque no hay lugar entre el filo y el borde.
""")

    print('  ' + '=' * 72)
    print('  Y NUESTRAS CARTAS, QUE HACEN EN EL COSTADO DERECHO')
    print('  ' + '=' * 72)
    print("""
  Temporada     NADA. Un solo numero arriba a la derecha (#11, el puesto).
                No hay panel, ni linea, ni columna.
                01_Temporada/normal_v3.css

  Competitiva   CUATRO PASTILLAS colgadas del borde, en right:-11px, o sea
                SOBRESALIENDO de la silueta: #1 (puesto), 71.0 WR, 0/0 D,
                3/12 R. No es un panel: son piezas sueltas sobre el filo.
                02_Competitivo/v2/card.css  .tr .mr .chip

  Servidor      todavia nada.

  ⚠️ O sea que NINGUNA de las dos tiene panel lateral. La Competitiva usa el
  BORDE como perchero y la Temporada no usa el costado. Si la Servidor
  estrena un panel de contenido, estrena un lenguaje que no existe en el
  juego de cartas, y ademas lo estrena en la unica carta que va a vivir en
  servidores ajenos.
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
