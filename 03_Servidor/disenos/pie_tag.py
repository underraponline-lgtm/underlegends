"""¿DONDE ENTRA EL TAG EN EL PIE? Medido sobre el render, no sobre el path.

Dlx: "simplemente ajustar la posicion de todo lo demas... tambien agregar el
tag encima de UL como lo tenemos en el competitivo".

⚠️ EL PROBLEMA NO ES EL HUECO VERTICAL, ES EL ANCHO. El pie de esta carta es
un PICO que se cierra: abajo no solo hay poco alto, hay poca carta. Un TAG de
~100 px de ancho necesita que la carta mida 110 ahi, y eso deja de ser cierto
antes de lo que parece.

Se mide el ALFA del PNG ya capturado —ancho real de la carta fila por fila— y
se le resta el marco, que se pinta 4.5 px hacia adentro.
"""
import os
import sys

import numpy as np
from PIL import Image

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun.siluetas import PICO
from comun import pie as PIE, nombre as NOM
from comun.emblema import MARGEN

ESC = 3                 # device_scale_factor de todos_sv.py
MARCO = 9.0             # stroke del borde: pinta 4.5 hacia adentro
AIRE = 2.0

# lo que hay que acomodar, de arriba a abajo
ALTO_TAG = 17.4         # .tagbot de la Competitiva: .54rem + padding 3/4
ANCHO_TAG = 104.0       # "🏆 CAMPEON DE TFC" a ese cuerpo, con su padding


def anchos():
    """Ancho util de la carta por fila, en coordenadas de silueta."""
    f = os.path.join(SCR, '_todos', '0.png')
    a = np.array(Image.open(f).convert('RGBA'))[:, :, 3]
    alto = a.shape[0]
    out = {}
    for yy in range(int(PICO.h) + 1):
        r = int((yy + MARGEN) * ESC)
        if r >= alto:
            out[yy] = 0.0
            continue
        x = np.where(a[r] > 12)[0]
        out[yy] = 0.0 if not len(x) else (x[-1] - x[0] + 1) / ESC - MARCO - 2 * AIRE
    return out


def an(A, v):
    return A.get(max(0, min(int(v), int(PICO.h))), 0.0)


def main():
    A = anchos()
    fin_nom = NOM.Y['servidor'] + 9.6        # la tinta del nombre, aprox
    print('ancho util de la carta en el pie (ya descontado el marco):\n')
    for yy in range(300, 405, 5):
        marca = ''
        if abs(yy - PIE.Y_FILA) < 3:
            marca = '  <- la fila'
        if abs(yy - PIE.UL_Y) < 3:
            marca = '  <- el UL'
        print('   y %3d   %6.1f px%s' % (yy, an(A, yy), marca))

    print('\nlo que hay hoy:')
    fila = (PIE.Y_FILA - PIE.LADO / 2, PIE.Y_FILA + PIE.LADO / 2)
    ul = (PIE.UL_Y, PIE.UL_Y + PIE.UL_H)
    print('   nombre  hasta %.1f' % fin_nom)
    print('   fila    %.1f .. %.1f' % fila)
    print('   UL      %.1f .. %.1f' % ul)
    print('   punta   %.1f .. %.1f' % (ul[1], PICO.h))
    print('   hueco fila->UL  %.1f px' % (ul[0] - fila[1]))

    print('\n⚠️ EL TAG NECESITA %.0f px DE ANCHO. Donde lo hay:' % ANCHO_TAG)
    ok = [yy for yy in range(300, 405) if an(A, yy) >= ANCHO_TAG]
    print('   la carta aguanta ese ancho hasta y=%d' % (max(ok) if ok else -1))
    print('   o sea que el TAG entero tiene que terminar antes de ahi')

    print('\nel presupuesto, de %.1f a %.1f = %.1f px:'
          % (fin_nom, PICO.h, PICO.h - fin_nom))
    print('   fila %.0f + TAG %.1f + UL %.1f = %.1f de piezas'
          % (PIE.LADO, ALTO_TAG, PIE.UL_H, PIE.LADO + ALTO_TAG + PIE.UL_H))
    libre = PICO.h - fin_nom - (PIE.LADO + ALTO_TAG + PIE.UL_H)
    print('   quedan %.1f px para CUATRO huecos + la punta' % libre)

    # propuesta: repartir dejando la punta tranquila
    print('\nPROPUESTA (la punta se queda con lo suyo, el resto se reparte):')
    punta = 18.0
    huecos = (libre - punta) / 3
    y = fin_nom + huecos
    plan = []
    for nom_p, alto in (('fila', PIE.LADO), ('TAG', ALTO_TAG), ('UL', PIE.UL_H)):
        plan.append((nom_p, y, y + alto))
        y += alto + huecos
    for nom_p, a0, a1 in plan:
        anc = min(an(A, a0), an(A, a1))
        aviso = ''
        if nom_p == 'TAG' and anc < ANCHO_TAG:
            aviso = '   <- NO ENTRA DE ANCHO'
        print('   %-5s %6.1f .. %6.1f   (ancho ahi %.0f)%s'
              % (nom_p, a0, a1, anc, aviso))
    print('   huecos de %.1f px, punta %.1f' % (huecos, PICO.h - plan[-1][2]))
    print('\n   centro de la fila  y=%.0f   (hoy %d)' % (
        (plan[0][1] + plan[0][2]) / 2, PIE.Y_FILA))
    print('   tope del TAG       y=%.0f' % plan[1][1])
    print('   tope del UL        y=%.0f   (hoy %d)' % (plan[2][1], PIE.UL_Y))


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
