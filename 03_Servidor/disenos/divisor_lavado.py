"""POR QUE EL DEGRADE SE VE LAVADO EN UNOS Y HERMOSO EN OTROS.

Dlx: "no me gusta que el blanco este en el degradado de todos... el degrade
mas hermoso es el de Freestyle Zone... mira el de Fontana, esta algo raro...
quizas si hacemos mas fuerte el degradado o menos se veria mejor?".

⚠️ LA RESPUESTA NO ES "MAS" NI "MENOS": ES QUE HOY ES EL MISMO PARA TODOS.
El medio sube una FRACCION FIJA hacia el blanco —45%— y esa fraccion cae
distinto segun de donde parte. FRZ arranca de #0E5F5E, que es muy oscuro:
subirlo 45% lo deja en un verde agua que todavia tiene color. FTN arranca de
#2A3982, bastante mas claro: el mismo 45% lo empuja mucho mas cerca del
blanco y ahi se lava.

Este script mide las dos formas:
    FIJO      el mismo 45% para los diez            <- lo de hoy
    OBJETIVO  el que haga falta para separarse      <- lo propuesto
"""
import os
import sys

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun.emblema import tono
from los_nueve import defs

FIJO = 0.45
# ⚠️ EL OBJETIVO NO LO ELIJO YO: SALE DE FRZ. Dlx dijo cual le gusta, asi que
# el numero correcto es el que FRZ ya tiene con el 45% fijo —2.81— y el resto
# se lleva ahi. Poner 2.1 "porque nadie empeora" habria bajado tambien al que
# funciona, que es justo lo que no hay que tocar.
OBJETIVO = 2.81


def _lum(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= .03928 else ((x + .055) / 1.055) ** 2.4 for x in c]
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]


def contraste(a, b):
    la, lb = _lum(a), _lum(b)
    return (max(la, lb) + .05) / (min(la, lb) + .05)


def croma(h):
    h = h.lstrip('#')
    v = [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    return max(v) - min(v)


def cuanto(propio, objetivo=OBJETIVO):
    """El minimo que hay que subir para separarse. Busqueda binaria."""
    lo, hi = 0.0, 0.95
    for _ in range(40):
        m = (lo + hi) / 2
        if contraste(tono(propio, m), propio) < objetivo:
            lo = m
        else:
            hi = m
    return round(hi, 3)


def main():
    D = defs()
    print('   %-6s %-9s | %-9s %5s %5s | %-9s %5s %5s %5s'
          % ('sv', 'propio', 'FIJO .45', 'cont', 'croma',
             'OBJETIVO', 'x', 'cont', 'croma'))
    print('   ' + '-' * 78)
    for sv in D:
        pr = D[sv][1]
        f = tono(pr, FIJO)
        x = cuanto(pr)
        o = tono(pr, x)
        marca = ''
        if sv in ('FRZ', 'FTN'):
            marca = '  <- ' + ('el que gusta' if sv == 'FRZ' else 'el raro')
        print('   %-6s %-9s | %-9s %5.2f %5d | %-9s %5.2f %5.2f %5d%s'
              % (sv, pr, f, contraste(f, pr), croma(f),
                 o, x, contraste(o, pr), croma(o), marca))
    print('   ' + '-' * 78)
    print("""
   ⚠️ NO ERA EL CROMA, Y YO LO HABIA SUPUESTO MAL. FRZ —el que gusta— tiene
   croma 45 y FTN —el raro— tiene 49: practicamente iguales. Lo que los separa
   es el CONTRASTE: 2.81 contra 3.43. FTN esta levantado un 22% mas.

   Y el motivo es que subir una fraccion FIJA hacia el blanco mueve mucho mas,
   en luz, a un color oscuro que a uno claro. Los cuatro mas levantados son
   los cuatro propios mas oscuros: FFA 4.41, RZ 4.16, TFC 3.62, FTN 3.43.
   Por eso "mas fuerte" o "mas suave" no arregla nada: el problema no es el
   nivel, es que el mismo nivel les cae distinto.

   Con el objetivo anclado en FRZ, los diez quedan donde esta el que gusta.
   Y ademas les queda MAS croma a casi todos, porque suben menos.""")


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
