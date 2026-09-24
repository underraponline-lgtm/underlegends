"""ARREGLAR EL DEGRADE DE LA LINEA: subir su parada del medio.

Dlx eligio el degrade y marco donde falla: TWR y SR. Y tiene razon en que
tiene arreglo — el problema es UNA parada, no el degrade.

EL DIAGNOSTICO
--------------
El degrade del marco es acento -> A -> acento, con A = encender(propio, .30).
Medido, ese A es casi el propio: en DRA es IDENTICO. En una linea horizontal
esa parada cae en el CENTRO, que es la parte mas vista, asi que la linea
queda ahi del mismo color que el panel de abajo.

⚠️ Y HAY UN MOTIVO DE FONDO QUE NO SE VE MIRANDO: `encender()` multiplica por
k = 1 + (255/max(r,g,b) - 1) * f. Si el color YA TIENE UN CANAL EN 255, ese
max es 255, k vale 1 y la funcion NO HACE NADA por mas que se suba f. Le pasa
a DRA (#3D5BFF, azul en 255). O sea que subir f arregla TWR y SR pero NUNCA
va a mover a DRA: son dos problemas distintos con la misma cara.

Este script mide las dos salidas:
    encender(propio, f)   sube hacia el color encendido, conserva croma
    tono(propio, +x)      sube hacia el BLANCO, pierde croma
"""
import os
import sys

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun.brillo import encender
from comun.emblema import tono
from los_nueve import defs

OBJETIVO = 1.8      # contraste minimo del medio contra el panel. No es 4.5:
                    # eso es para texto; una linea gruesa se separa con menos.


def _lum(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= .03928 else ((x + .055) / 1.055) ** 2.4 for x in c]
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]


def contraste(a, b):
    la, lb = _lum(a), _lum(b)
    return (max(la, lb) + .05) / (min(la, lb) + .05)


def main():
    D = defs()
    print('=' * 66)
    print('EL TECHO DE encender(): que servidores NO se pueden aclarar asi')
    print('=' * 66)
    print('   %-6s %-9s %6s   %s' % ('sv', 'propio', 'max', 'techo'))
    print('   ' + '-' * 46)
    topados = []
    for sv in D:
        pr = D[sv][1]
        h = pr.lstrip('#')
        mx = max(int(h[i:i + 2], 16) for i in (0, 2, 4))
        tope = 255 / mx
        if mx >= 250:
            topados.append(sv)
        print('   %-6s %-9s %6d   x%.2f%s'
              % (sv, pr, mx, tope, '   <- NO SE MUEVE' if mx >= 250 else ''))
    print('   ' + '-' * 46)
    print('   sin margen: %s' % (', '.join(topados) or 'ninguno'))

    print('\n' + '=' * 66)
    print('CONTRASTE DEL MEDIO CONTRA EL PANEL, por f')
    print('=' * 66)
    fs = (.30, .55, .80, 1.00)
    print('   %-6s %s' % ('sv', '  '.join('f=%.2f' % f for f in fs)))
    print('   ' + '-' * 46)
    for sv in D:
        pr = D[sv][1]
        vs = [contraste(encender(pr, f), pr) for f in fs]
        aviso = '' if vs[-1] >= OBJETIVO else '   <- no llega'
        print('   %-6s %s%s'
              % (sv, '  '.join('%5.2f' % v for v in vs), aviso))

    print('\n' + '=' * 66)
    print('LA OTRA SALIDA: subir hacia el blanco (tono)')
    print('=' * 66)
    xs = (.25, .40, .55)
    print('   %-6s %s' % ('sv', '  '.join('x=%.2f' % x for x in xs)))
    print('   ' + '-' * 46)
    peor = {x: 99.0 for x in xs}
    for sv in D:
        pr = D[sv][1]
        vs = [contraste(tono(pr, x), pr) for x in xs]
        for x, v in zip(xs, vs):
            peor[x] = min(peor[x], v)
        print('   %-6s %s' % (sv, '  '.join('%5.2f' % v for v in vs)))
    print('   ' + '-' * 46)
    print('   peor  %s' % '  '.join('%5.2f' % peor[x] for x in xs))
    print("""
   ⚠️ ESTA SI MUEVE A LOS DIEZ, incluido DRA, porque no depende del canal
   maximo. El costo es que pierde croma: el medio de la linea tira a blanco.
   Pero las PUNTAS siguen siendo el acento, asi que la linea sigue diciendo
   de que servidor es —que era lo unico que el blanco pleno perdia—.""")


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
