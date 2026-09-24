"""CUANTAS COMBINACIONES DE TITULO HAY, Y CUANTAS SE ALCANZAN DE VERDAD.

Dlx pregunto cuantas combinaciones hay, acordandose de las escaleras de roles
que paso, que tenian 20 y 40 escalones.

⚠️ HAY DOS COSAS DISTINTAS Y CONVIENE NO MEZCLARLAS, porque una es el numero
que el se acuerda y la otra es lo que la carta lleva hoy:

    EL TITULO   la pastilla debajo del numero. Sale del OVR. 5 escalones.
    EL TAG      la pastilla arriba del UL. Sale de COMBINACIONES. 9 textos.

Son dos piezas separadas y una carta muestra las dos, asi que lo que se ve es
el PAR. De ahi sale el total.

⚠️ Y EL TOTAL NOMINAL NO ES EL QUE IMPORTA. Multiplicar da un numero grande y
enseguida; lo que decide si el sistema sirve es cuantos pares ALCANZA GENTE de
verdad. Este script cuenta las dos cosas y las separa.
"""
import itertools
import os
import sys

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun import titulos as TIT


def main():
    import todos_sv as T
    esc = [n for _u, n in T.ESCALERA]
    print('=' * 68)
    print('LAS DOS PIEZAS')
    print('=' * 68)
    print('\n   EL TITULO — debajo del numero, sale del OVR')
    for u, n in T.ESCALERA:
        print('      %-9s  desde OVR %d' % (n, u))
    print('      %d escalones' % len(esc))

    # los textos del TAG: se recorre la cascada con casos que la disparan
    casos = [
        dict(pos_sv=1, total_sv=79),
        dict(pos_sv=12, total_sv=79, titulos=4),
        dict(pos_sv=5, total_sv=79),
        dict(pos_sv=30, total_sv=79, racha='6/9'),
        dict(pos_sv=30, total_sv=79, duelos='9/12'),
        dict(pos_sv=30, total_sv=79, podios=11),
        dict(pos_sv=30, total_sv=79, eventos=24),
        dict(pos_sv=40, total_sv=79, titulos=1),
        dict(pos_sv=60, total_sv=79, podios=4),
        dict(pos_sv=70, total_sv=79),
    ]
    tags = []
    for d in casos:
        t, k = TIT.cascada(d)
        if t not in [x[0] for x in tags]:
            tags.append((t, k))
    print('\n   EL TAG — arriba del UL, sale de combinaciones')
    for t, k in tags:
        print('      %-24s nivel %s' % (t, k))
    print('      %d textos distintos, en %d niveles'
          % (len(tags), len(set(k for _t, k in tags))))

    print('\n' + '=' * 68)
    print('EL TOTAL')
    print('=' * 68)
    n_esc, n_tag = len(esc), len(tags)
    print("""
   Una carta muestra LAS DOS, asi que lo que se ve es el par:

       %d titulos  x  %d TAGs  =  %d combinaciones nominales
""" % (n_esc, n_tag, n_esc * n_tag))

    # cuales son imposibles
    print('   ⚠️ PERO NO TODAS SE PUEDEN DAR, y conviene saber cuales no:\n')
    imposibles = []
    for e in esc:
        for t, _k in tags:
            # el titulo sale del OVR, que son PUNTOS en ese servidor;
            # el TAG de logros. Un NOVATO —OVR bajo— dificilmente sea
            # DUEÑO DE CASA, que es ser 1º del servidor.
            if e == 'NOVATO' and t.endswith('DUEÑO DE CASA'):
                imposibles.append((e, t, 'ser 1º con el OVR mas bajo'))
            if e == 'LEYENDA' and t.endswith('DE LA CASA'):
                imposibles.append((e, t, 'el OVR mas alto sin ningun logro'))
    for e, t, por in imposibles:
        print('      %-9s + %-22s  %s' % (e, t, por))
    print('\n      quedan %d pares posibles' % (n_esc * n_tag - len(imposibles)))

    print("""
   ⚠️ Y ACA ESTA LO QUE DE VERDAD IMPORTA: que un par sea POSIBLE no quiere
   decir que le toque a alguien. El titulo y el TAG NO son independientes —
   los dos suben con lo mismo, que es hacer cosas en el servidor— asi que la
   gente se agolpa en la diagonal: OVR alto con TAG alto, OVR bajo con TAG
   bajo. Las esquinas cruzadas quedan casi vacias.

   No se puede contar cuanta gente cae en cada par hasta que existan los
   datos por servidor. Hoy los cinco numeros de la columna estan inventados,
   asi que ese conteo seria inventado tambien.
""")
    print('=' * 68)
    print('CONTRA LO QUE DLX SE ACUERDA')
    print('=' * 68)
    print("""
   Las escaleras de roles que paso tenian 20 y 40 escalones. Este sistema
   tiene 5 y 9, y la diferencia es a proposito:

   · una escalera de 20 se lleno con AÑOS de un servidor. La Liga arranca la
     T1: medido sobre los campeonatos globales, 53 de 138 tienen CERO, asi
     que con 20 escalones el 38%% quedaria en el primero y los de arriba
     vacios.
   · aca no hay UNA escalera larga sino DOS cortas cruzadas, que es otra
     forma de llegar a variedad: %d pares con 14 palabras en total, contra
     20 palabras para 20 escalones.
""" % (n_esc * n_tag - len(imposibles)))


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
