# -*- coding: utf-8 -*-
"""EL OVR DE TEMPORADA. Un solo lugar, igual que el Score.

    from ovr import calcular, PESOS, UMBRAL_COLOR
    ovrs = calcular([(pts, ev, win, pod, caz), ...])   # una por persona

🔴 EXISTE PORQUE EL `#` DE LA VITRINA Y EL DE LA CARTA MEDIAN COSAS
DISTINTAS. Hasta el 24/09/2026 `Ranking Temporada` se ordenaba por
**Puntos** y el pool —o sea la carta, la pastilla y el hub— por **OVR**.
Medido ese dia: CJ salia **#1 en el Sheet** con 12.500 puntos de 1 evento
y **#6 en la web**, porque su OVR es 74 contra el 86 de Hassan.

Dlx, 24/09/2026: *«OVR... porque en si el OVR va a variar en mas factores
que puntos y MW»*. Manda el OVR en los dos lados.

⚠️ Y NO ES COSMETICA, ES LA REGLA CENTRAL DEL PROYECTO. `CLAUDE.md` dice
*«el numero de cada carta mide lo que esa carta mide»* y *«el rango es uno
solo por persona y tiene que dar igual en todas sus cartas»*. Un `#` que
dice una cosa en la planilla y otra en la carta es la misma incoherencia
que la letra del rango en cinco lugares, en la columna de al lado.

🔑 VIVE EN `sheet/` Y NO EN `comun/`, A PROPOSITO. El OVR es un **dato**:
se calcula una vez y queda en `datos/temporada_pool.json`; las cartas solo
imprimen `d['ovr']`. Lo que vive en `comun/` es lo que **dibuja**, y
`comun/huella_codigo.py` hashea esa carpeta entera para decidir si hay que
redibujar — meter esto ahi costaria 552 cartas cada vez que se toca una
coma de un comentario, sin mover un pixel. Es el mismo criterio por el que
el Score vive en `sheet/competitivo.py`.

⚠️ SE NORMALIZA CONTRA EL MAXIMO DEL GRUPO QUE SE LE PASA, asi que el OVR
de una persona **depende de quienes esten adentro**. Verificado el
24/09/2026 antes de mover nada: con las 74 filas de la vitrina y con las
70 del pool los cinco topes dan **identicos** y el OVR coincide persona por
persona con el que ya tenia el pool. Si algun dia no coincidieran, el que
manda es el del pool, porque es el que la carta imprime.

⚠️ LAS RAICES NO SON ADORNO. `pts`, `ev` y `pod` entran con `sqrt` y
`win%` y `caz` lineales: sin la raiz, el que junta muchos puntos en un
evento tapa a todo el resto, que es justo lo que hacia el orden por
Puntos.
"""
import math

#: pts · ev · win% · podios · cazador
PESOS = (0.36, 0.20, 0.16, 0.16, 0.12)

#: el color de la carta de Temporada sale de aca, y NO es el rango.
#: La letra sale del Score (`comun/rangos.py`); esto es el tono del fondo.
UMBRAL_COLOR = [('SSS', 88), ('SS', 82), ('S', 74), ('A', 67),
                ('B', 61), ('C', 56), ('D', 52)]


def num(x):
    """`'1.234'`, `'85.7%'`, `''` -> float. Nunca revienta."""
    try:
        return float(str(x).replace(',', '').replace('%', '').strip() or 0)
    except (TypeError, ValueError):
        return 0.0


def calcular(componentes):
    """`[(pts, ev, win, pod, caz), ...]` -> `[ovr, ...]`, mismo orden.

    ⚠️ CON LA LISTA VACIA DEVUELVE UNA LISTA VACIA. El pool recien
    arrancado tiene cero personas —es un ESTADO, no un error, y este repo
    ya lo documenta cuatro veces— y `max()` sobre vacio es un `ValueError`
    que no dice nada de lo que pasa.
    """
    qs = [tuple(num(v) for v in c) for c in componentes]
    if not qs:
        return []
    return con_topes(qs, topes(qs))


def topes(componentes):
    """El máximo de cada componente en el pool: contra eso se mide cada uno.

    ⚠️ `or 1` EN CADA TOPE: con nadie que haya ganado un podio, el tope
    de esa componente es 0 y la division revienta. Un cero ahi significa
    «esta dimension todavia no existe», no «error».
    """
    qs = [tuple(num(v) for v in c) for c in componentes]
    return [max(x) or 1 for x in zip(*qs)] if qs else [1] * len(PESOS)


def con_topes(componentes, tope):
    """El OVR de cada uno contra topes DADOS. `calcular()` usa los del propio pool.

    🔑 EL OVR DE UN SERVIDOR (03/10/2026, Dlx: «la info de cada servidor en sus tarjetas tiene que ser diferente»):
    lo que hiciste EN ESE SERVIDOR, contra los topes de la temporada entera —la (b) de `03_Servidor/disenos/ESTADO.md`,
    la única que cumple la regla del número de cada carta—. Así un 80 de un servidor chico y uno de uno grande dicen
    lo mismo, y nadie saca 100 por ser el único de su servidor.
    """
    out = []
    for c in componentes:
        q = tuple(num(v) for v in c)
        r = [min(1.0, q[i] / (tope[i] or 1)) for i in range(len(PESOS))]
        n = [math.sqrt(r[0]), math.sqrt(r[1]), r[2], math.sqrt(r[3]), r[4]]
        out.append(round(40 + sum(w * x for w, x in zip(PESOS, n)) * 59))
    return out


def color(o):
    """El tono de la carta para ese OVR. `'E'` si no llega a ninguno."""
    return next((k for k, u in UMBRAL_COLOR if o >= u), 'E')


def _self_check():
    """Que la formula siga dando lo mismo que el pool guardado."""
    import io
    import json
    import os
    p = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                     'datos', 'temporada_pool.json')
    try:
        with io.open(p, encoding='utf-8') as f:
            pool = json.load(f)
    except (OSError, ValueError):
        print('   (no hay datos/temporada_pool.json con que comparar)')
        return 0
    if not pool:
        # el pool vacio es un ESTADO
        print('   el pool esta en 0: no hay con que medir')
        print('   calcular([]) -> %r  ok' % (calcular([]),))
        return 0
    comp = [(d.get('pts'), d.get('ev'), d.get('wr'), d.get('pod'),
             d.get('caz')) for d in pool]
    mal = [(d['raw'], d.get('ovr'), o)
           for d, o in zip(pool, calcular(comp)) if d.get('ovr') != o]
    print('   %d persona(s) en el pool' % len(pool))
    if mal:
        print('   🔴 %d no coinciden con su `ovr` guardado:' % len(mal))
        for n, a, b in mal[:6]:
            print('      %-20s pool=%s  formula=%s' % (n, a, b))
        return 1
    print('   ✅ el OVR de los %d sale igual que el guardado' % len(pool))
    return 0


if __name__ == '__main__':
    import sys
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    sys.exit(_self_check())
