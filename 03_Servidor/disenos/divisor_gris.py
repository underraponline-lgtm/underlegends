"""EL GRIS QUE APARECE EN EL MEDIO DEL CAMINO. Medido a lo largo de la linea.

Dlx: "el degrade deberia ser quizas un poco menos en el de fontana porque crea
un color digamos medio gris entre el azul y amarillo... el de ffa estaba bien
antes tmb".

⚠️ NO ES UN PROBLEMA DEL MEDIO, ES DEL CAMINO. Hasta ahora se midio SOLO la
parada del medio, y por eso no aparecia: el medio de FTN tiene croma 55, que
esta bien. El gris no esta en las paradas, esta ENTRE ellas.

El motivo: el acento de FTN es amarillo y su propio es azul, o sea casi
complementarios. Interpolar en RGB entre dos colores opuestos pasa por el eje
neutro, y ahi el croma se desploma. Subir el medio hacia el blanco lo empuja
todavia mas cerca de ese eje.

Este script recorre el degrade entero de punta a punta y busca el PEOR croma
del camino, no el de las paradas.

⚠️ Y ESO EXPLICA POR QUE FFA NO NECESITABA EL AJUSTE: su acento y su propio
no son opuestos, asi que su camino nunca se acerca al eje. Lo habia bajado por
una regla que miraba otra cosa.
"""
import os
import sys

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun.emblema import tono
from los_nueve import defs

PASOS = 60
MIN_CROMA = 34      # el piso. Debajo de esto el tramo se lee gris.


def rgb(h):
    h = h.lstrip('#')
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


def croma(c):
    return max(c) - min(c)


def peor_croma(a, b, medio):
    """El croma mas bajo recorriendo a -> medio -> b."""
    A, M, B = rgb(a), rgb(medio), rgb(b)
    peor, donde = 999, 0.0
    for i in range(PASOS + 1):
        t = i / PASOS
        if t <= .5:
            u = t / .5
            c = [x + (yy - x) * u for x, yy in zip(A, M)]
        else:
            u = (t - .5) / .5
            c = [x + (yy - x) * u for x, yy in zip(M, B)]
        v = croma(c)
        if v < peor:
            peor, donde = v, t
    return peor, donde


def main():
    import todos_sv as T
    D = defs()
    print('   %-6s %-9s %-9s | %6s %6s | %6s %6s'
          % ('sv', 'propio', 'acento', 'medio', 'croma', 'PEOR', 'donde'))
    print('   ' + '-' * 66)
    for sv in D:
        ac, pr = D[sv][0], D[sv][1]
        x = T.medio_divisor(pr)
        m = tono(pr, x)
        p, d = peor_croma(ac, ac, m)
        marca = '   <- se agrisa' if p < MIN_CROMA else ''
        print('   %-6s %-9s %-9s | %6s %6d | %6.0f %5.0f%%%s'
              % (sv, pr, ac, m, croma(rgb(m)), p, d * 100, marca))
    print('   ' + '-' * 66)
    print("""
   ⚠️ EL CROMA DE LA PARADA NO AVISA. Mirando solo la columna 'croma' —la de
   la parada del medio— FTN parece sano. El gris esta en el trayecto, y solo
   aparece si se recorre.

   Es el mismo error que ya costo caro dos veces en este proyecto: medir el
   punto en vez del recorrido. Paso con el anillo de 2 px que "tenia huecos"
   —era el muestreo— y con el TAG que se veia apretado —se media el texto y
   no su halo—.""")
    print('\n   CUANTO HAY QUE BAJAR PARA QUE NO SE AGRISE:')
    for sv in D:
        ac, pr = D[sv][0], D[sv][1]
        x0 = T.medio_divisor(pr)
        p0, _ = peor_croma(ac, ac, tono(pr, x0))
        if p0 >= MIN_CROMA:
            continue
        x = x0
        while x > 0 and peor_croma(ac, ac, tono(pr, x))[0] < MIN_CROMA:
            x -= .01
        p1, _ = peor_croma(ac, ac, tono(pr, max(x, 0)))
        print('      %-6s  %.2f -> %.2f   peor croma %.0f -> %.0f'
              % (sv, x0, max(x, 0), p0, p1))


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
