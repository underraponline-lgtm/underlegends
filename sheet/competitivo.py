# -*- coding: utf-8 -*-
"""EL SCORE COMPETITIVO Y SUS CINCO DIMENSIONES, desde `Resultados`.

    python sheet/competitivo.py            lo calcula y lo muestra
    python sheet/competitivo.py --escribir lo escribe en `Ranking Competitivo`
    python sheet/competitivo.py --auto     el self-check

🔴 ESTE CALCULO NO EXISTIA EN EL REPO Y ES LA REGLA CENTRAL DEL
PROYECTO. `CLAUDE.md`: *«el rango sale del Score competitivo. Siempre»*
— y el Score se leia del Sheet, que a su vez lo recibia pegado desde un
lugar que ya no existe. Resultado: con la T1 arrancada, **nadie tiene
rango**, y el rango es lo que aparece en las cuatro tarjetas.

LA FORMULA, VERIFICADA CONTRA 138 FILAS REALES
-----------------------------------------------
    Score = (0.30·E + 0.24·C + 0.21·Dm + 0.15·T + 0.10·V) × Confianza

Medido el 22/09/2026 contra el pool de la pre-temporada, el ultimo que
tuvo Scores de verdad: **las 138 cuadran**, con una diferencia maxima de
0.05 —redondeo—. Los pesos salen de la Guia del Sheet y de
`sheet/config_t1.py`.

CADA DIMENSION, Y QUE TAN VERIFICADA ESTA
------------------------------------------
La Guia dice que mide cada una; lo que la Guia NO dice es como se lleva
a 0-100. Eso se midio:

| dim | que mide (la Guia)                   | como se comprobo |
|-----|--------------------------------------|------------------|
| E   | puntos por evento                    | **exacta**: Tuca lidera con 4.971 pts/ev y E=100; Konan 4.488 y E=90, o sea un maximo implicito de 4.987 — 0,3 % de diferencia, que es la exclusion de MW |
| Dm  | gana el evento entero, solo 🥇       | **exacta**: 100·97·97·90 clavados |
| T   | rachas consecutivas en SF+           | **exacta**: 100·92·85·85 clavados |
| C   | que tan seguido llega a semis+       | **±2 puntos** en dos de las cuatro primeras |
| V   | distribucion entre servidores        | **inferida** — ver abajo |

🔴 LA NORMALIZACION ES «EL LIDER DEL POOL VALE 100», y eso tambien se
midio: en las 138 hay **exactamente una** persona con 100 en E, en C, en
Dm y en T. Es la regla que `CLAUDE.md` ya tenia escrita desde el otro
lado —*«solo se resalta el 100 en las stats: significa liderar esa
dimension en todo el pool»*— y da cuatro cartas con un 100, que es el
numero que ese mismo parrafo dice.

⚠️ **DIVERSIDAD ES LA UNICA INFERIDA, y se sabe por que.** Contar
servidores no alcanza: cuatro personas con 7 servidores sacaban 80, 85,
87 y 78. La Guia dice *«distribucion, no solo conteo»*, asi que se usa la
**entropia** de como se reparten los eventos — reparto parejo da mas que
concentrarse en uno. No se pudo comprobar contra los 138 porque el pool
viejo guarda `srv` (cuantos servidores) y no el desglose por servidor.

⚠️ **Y QUE NO REPRODUZCA LOS NUMEROS VIEJOS NO ES UN PROBLEMA.** El
Competitivo se reinicia por temporada —`CLAUDE.md`, y Dlx el 16/09— asi
que la T1 arranca de cero igual. Lo que hace falta es que el calculo
este **definido, documentado y reproducible**, no que empate con una
pre-temporada borrada.

⚠️ **LA CONFIANZA CASTIGA AL QUE JUGO POCO**, y es de la Guia: 0.80 a
los 8 eventos, rampa lineal hasta 1.00 a los 20. Por debajo de 8 el
Score existe igual; lo que decide si hay carta es
`comun/requisitos.py`, que pide 10.
"""
import io
import json
import math
import os
import sys
from collections import defaultdict

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

#: peso de cada dimension. Salen de la Guia y de `sheet/config_t1.py`.
#: ⚠️ SUMAN 100 y eso se comprueba en el self-check: si alguien toca uno
#: sin tocar otro, el Score deja de estar en 0-100 y nadie se entera.
PESOS = (('E', 0.30), ('C', 0.24), ('Dm', 0.21), ('T', 0.15), ('V', 0.10))

#: la rampa de confianza: (eventos, factor). Entre medio, lineal.
CONF_DESDE, CONF_HASTA = (8, 0.80), (20, 1.00)

#: que posiciones cuentan como «semifinal o mejor», para C y para T.
SF_O_MEJOR = ('🥇', '🥈', '🥉', '🎖️')


#: la rampa de abajo: 0.30 con 1 evento, empalmando en 0.80 a los 8.
#: Cambio A2 del rework, aplicado el 23/09/2026 con el sí de Dlx.
CONF_PISO = 0.30


def confianza(ev):
    """El factor por cantidad de eventos. 0.30 al 1, 0.80 al 8, 1.00 al 20.

    🔴 SON DOS RAMPAS, Y LA DE ABAJO ES MUCHO MAS EMPINADA. El tramo
    8→20 no se toca —es el de la Guia y el de los que ya tenian Score—;
    lo que cambia es de 1 a 8, que antes extendia la misma recta hacia
    abajo y daba **0.68 con un solo evento**.

    ⚠️ POR QUE SE CAMBIO, Y NO ES SOLO «ERA GENEROSA». Con las anclas
    fijas del A1, el que gana su unico evento **satura tres dimensiones**
    —10.000 pts/ev contra un ancla de 6.000, 1 oro de 1 evento contra
    0.50— asi que su raw es 76 de un techo de ~100. Antes de las anclas,
    el maximo del pool amortiguaba eso solo: si habia un veterano con
    mejores tasas, el novato sacaba menos. **El A1 sacó ese amortiguador
    y la confianza quedó siendo el único.** Por eso el rework agrupa 1,
    2, 3 y 9 en un solo pase.

    Medido antes de cambiarla, con las anclas ya puestas:

        el que gana su UNICO evento           raw 76.2
          con la curva vieja                  52.0   ← rango A
          con esta                            22.8

        cuantos eventos necesita alguien BUENO para superarlo
        —semis siempre, gana la mitad, 3.000 pts/ev—
          con la vieja                        7 eventos
          con esta                            2 eventos

    ⚠️ Y LA VIEJA NO DABA MOTIVO PARA VOLVER, que era el argumento a
    favor de dejarla: de 1 a 2 eventos sumaba **+2.4 %**, y de 1 a 8
    apenas +17 %. Con esta, de 1 a 2 son **+23.8 %** y de 1 a 8
    **+167 %**. La retención es el problema conocido del proyecto —42 %
    jugó una sola vez— y la curva generosa le daba a ese 42 % casi todo
    lo que hay sin pedirle que vuelva.

    ⚠️ LO QUE LA CURVA ESTRICTA NO CUESTA: el rework la queria para que
    el Score **existiera** —sin ella, con el reset nadie tenia Score y
    las cartas salian grises—. Eso hoy se resuelve por otro lado: el
    rango no se muestra debajo de 10 eventos, asi que el novato no ve
    una letra fea, ve ninguna. Son cosas distintas.
    """
    e0, f0 = CONF_DESDE
    e1, f1 = CONF_HASTA
    try:
        ev = float(ev or 0)
    except (TypeError, ValueError):
        return 0.0
    if ev >= e1:
        return f1
    if ev <= 0:
        return 0.0
    if ev >= e0:
        return f0 + (ev - e0) * (f1 - f0) / (e1 - e0)
    # ⚠️ EMPALMA EXACTO EN `e0`: con ev=8 esta recta da `f0`, la misma
    # que la de arriba. Sin eso habria un escalon justo en el numero que
    # mas mira la gente.
    return CONF_PISO + (f0 - CONF_PISO) * (ev - 1) / (e0 - 1)


#: Las dos columnas de puntos de `Resultados`, por índice.
#: 7 = `Puntos` (lo que suma la Temporada) · 9 = `Puntos sin MW`.
COL_PUNTOS, COL_BASE = 7, 9


def _puntos_base(f):
    """Los puntos que cuentan para el Competitivo. Sin Most Wanted.

    🔴 EL COMPETITIVO LEIA `Puntos`, QUE INCLUYE MW. La hoja
    `Resultados` ya trae `Puntos sin MW` en la columna de al lado
    —existe exactamente para esto— y nadie la usaba. El rework lo dice
    en su Parte H: *«MW se sigue EXCLUYENDO del Competitivo»*, y explica
    por qué es estructural: la eficiencia es `puntos ÷ eventos` y **una
    caza suma puntos sin sumar eventos**, así que contarla infla a quien
    cazó y, por el máximo del pool, bajaba a todos los demás.

    ⚠️ HOY NO CAMBIA NINGUN NUMERO, y por eso se puede hacer tranquilo:
    `MW pts` está vacía para todos, así que las dos columnas son
    iguales. Lo que se cierra es el día que deje de estarlo — ahí el
    Competitivo habría empezado a contar cacerías sin avisar.

    ⚠️ Y ES EL «ENCHUFE» DEL CAMBIO A6, con la misma forma: leer la
    columna base y **caer a `Puntos` si no está**. El día que existan
    `pts_base`/`pts_final` por los multiplicadores de servidor, se
    agrega su índice acá y nada más se entera.
    """
    def _n(i):
        try:
            return int(float(str(f[i]).replace(',', '').strip() or 0))
        except (ValueError, IndexError):
            return None
    base = _n(COL_BASE)
    return base if base is not None else (_n(COL_PUNTOS) or 0)


def _entropia(cuentas):
    """0..1. Cuán repartida está una distribución. 1 = perfectamente pareja.

    ⚠️ SE NORMALIZA POR `log(n)` Y NO POR `log(total)`: lo que se mide es
    cuán repartido está entre **los servidores que usó**, escalado por
    cuántos usó. Sin el segundo factor, alguien que juega 5 y 5 en dos
    servidores empata con alguien que juega 5 en cada uno de siete.
    """
    tot = float(sum(cuentas))
    if tot <= 0 or len(cuentas) <= 1:
        return 0.0
    h = -sum((c / tot) * math.log(c / tot) for c in cuentas if c > 0)
    # `h` va de 0 a log(len). Se lleva a 0..1 contra el reparto perfecto
    # entre TODOS los servidores posibles, no entre los que uso: usar dos
    # parejo no puede valer lo mismo que usar siete parejo.
    return h / math.log(len(cuentas)) if len(cuentas) > 1 else 0.0


def crudo(filas_res, filas_uno=(), servidores=None):
    """`{quien: {'E':…, 'C':…, 'Dm':…, 'T':…, 'V':…, 'ev':…}}` SIN normalizar.

    Toma las filas de `Resultados` tal cual, igual que `rankings.agregar()`.
    """
    from rankings import SERVIDORES, POS, _norm
    servidores = servidores or SERVIDORES

    pts = defaultdict(int)
    evs = defaultdict(set)
    oro = defaultdict(int)
    sf = defaultdict(int)
    porsv = defaultdict(lambda: defaultdict(int))
    # (num_evento, llego_a_sf) por persona, para la racha
    linea = defaultdict(list)

    for f in filas_res:
        f = list(f) + [''] * 11
        num, sv, quien = str(f[0]).strip(), str(f[2]).strip(), str(f[4]).strip()
        if not quien:
            continue
        pos = POS.get(_norm(f[6]), '')
        p = _puntos_base(f)
        pts[quien] += p
        evs[quien].add(num)
        if sv in servidores:
            # 🔴 PUNTOS Y NO EVENTOS. Rework del 23/09/2026, cambio A4:
            # contar apariciones mide **dónde apareciste**, no dónde
            # ganaste. Su caso: 20 eventos en TFC y 20 en SR, ganás todo
            # en TFC y en SR te vas en octavos → Diversidad **1.00**, la
            # máxima. Es lo contrario de lo que la dimensión promete.
            #
            # ⚠️ EL REWORK LO DABA POR BLOQUEADO —*«requiere dato nuevo:
            # 7 columnas de PUNTOS por server… el histórico no se puede
            # reconstruir»*— y acá **no hace falta ninguna columna**:
            # `Resultados` guarda cada fila con su servidor y sus
            # puntos, así que el desglose sale solo y hacia atrás. Es la
            # ventaja de guardar el dato crudo en vez del agregado.
            porsv[quien][sv] += p
        if pos == '🥇':
            oro[quien] += 1
        if pos in SF_O_MEJOR:
            sf[quien] += 1
        try:
            n = int(float(num or 0))
        except ValueError:
            n = 0
        linea[quien].append((n, pos in SF_O_MEJOR))

    out = {}
    for quien in evs:
        ev = len(evs[quien]) or 1
        # 🔴 LA RACHA DE TECHO ES DE EVENTOS, NO DE DUELOS. `rankings`
        # calcula `🔥` sobre duelos ganados; la Guia define el Techo como
        # «rachas consecutivas en SF+», que es otra cosa. Usar la de
        # duelos daria un numero plausible midiendo lo que no es.
        seq = [b for _n, b in sorted(linea[quien], key=lambda x: x[0])]
        mejor = act = 0
        for b in seq:
            act = act + 1 if b else 0
            mejor = max(mejor, act)
        cuentas = [porsv[quien].get(s, 0) for s in servidores]
        out[quien] = {
            'E': pts[quien] / float(ev),
            'C': sf[quien] / float(ev),
            'Dm': oro[quien] / float(ev),
            'T': float(mejor),
            'V': _entropia(cuentas),
            'ev': ev, 'pts': pts[quien],
        }
    return out


#: La vara de cada dimensión. `None` = no tiene ancla, se normaliza
#: contra el pool.
#:
#: 🔴 ANCLAS FIJAS EN VEZ DE MAXIMOS DEL POOL. Es el cambio A1 del
#: rework del 23/09/2026, y su problema medido: *«si el líder de una
#: dimensión juega y le baja el promedio, a TODOS les cambia el número
#: sin haber hecho nada. Al meter los 40.000 pts MW de Road, 131
#: tarjetas cambiaron de número, incluidas las de gente con CERO puntos
#: MW»*.
#:
#: ⚠️ Y HACE QUE EL 100 SEA UNA META REAL. Con el máximo del pool hay
#: **siempre** cuatro personas en 100 —una por dimensión— sólo por ser
#: las mejores del momento. Con una vara fija, el 100 hay que ganarlo.
#:
#: ⚠️ LOS VALORES SON LOS DEL REWORK, y están elegidos **por encima** de
#: los máximos de la pre-temporada a propósito: Eficiencia 6.000 contra
#: los 4.971 de Tuca, Dominancia 0.50 contra los 0.460 de Konan. El
#: mejor de aquel pool quedaba en 83 y 92, no en 100.
#:
#: 🔴 LA RACHA ES LA UNICA QUE ES CONTEO CRUDO, no una tasa, así que
#: **depende de cuánto dure la temporada**. El rework lo dice: *«ancla
#: 13 provisoria; recalibrar cuando se sepa cuánto dura T1»*. El 13
#: sale de que 7 personas pasaron las 10 seguidas en la pre —Agus 13,
#: Konan 12, cuatro en 11, Axinu 10— así que con ancla en 10 esas siete
#: saturaban y **empataban todas arriba**.
#:
#: ⚠️ Y LA DIVERSIDAD NO LLEVA ANCLA porque ya es absoluta: la entropía
#: sale normalizada de 0 a 1 por construcción.
ANCLAS = {
    'E': 6000.0,     # ⚡ Eficiencia — puntos por evento
    'C': 0.85,       # 🎯 Consistencia — tasa de SF+ por evento
    'Dm': 0.50,      # 👑 Dominancia — oros por evento
    'T': 13.0,       # 🔥 Racha — eventos seguidos en SF+ (provisoria)
    'V': None,       # 🌍 Diversidad — ya viene en 0..1
}


def normalizar(cr, anclas=None):
    """Cada dimensión a 0-100, contra su ancla fija. Ver `ANCLAS`.

    🔴 ANTES ERA CONTRA EL MAXIMO DEL POOL, y eso tenía dos costos que
    el rework midió: el número de todos se movía cuando entraba alguien
    mejor —131 tarjetas por una sola carga— y **siempre** había cuatro
    personas en 100, una por dimensión, sólo por ser las mejores de ese
    momento.

    ⚠️ SE TOPEA EN 100. Con una vara fija, superarla es posible; lo que
    no puede es dar 140, porque los pesos suman 1 y el Score dejaría su
    rango.

    ⚠️ LA QUE NO TIENE ANCLA SIGUE CONTRA EL POOL. Hoy es sólo la
    Diversidad, que ya viene en 0..1 — o sea que su «pool» es la
    definición misma de la entropía, no la gente que haya.
    """
    anclas = ANCLAS if anclas is None else anclas
    out = {}
    tops = {}
    for k, _p in PESOS:
        vara = anclas.get(k)
        if vara:
            tops[k] = float(vara)
        elif k == 'V':
            # la entropía ya es 0..1: su vara es el 1, no el mejor de hoy
            tops[k] = 1.0
        else:
            vals = [v[k] for v in cr.values()]
            tops[k] = max(vals) if vals else 0
    for quien, v in cr.items():
        d = {'ev': v['ev'], 'pts': v['pts']}
        for k, _p in PESOS:
            bruto = (100.0 * v[k] / tops[k]) if tops[k] else 0
            d[k] = int(round(min(bruto, 100.0)))
        d['conf'] = round(confianza(v['ev']), 2)
        d['score'] = round(sum(p * d[k] for k, p in PESOS) * d['conf'], 1)
        out[quien] = d
    return out


def calcular(filas_res, filas_uno=()):
    """Las filas crudas -> `{quien: {dimensiones, conf, score}}`."""
    return normalizar(crudo(filas_res, filas_uno))


def _self_check():
    print('\n══ EL SCORE COMPETITIVO ══\n')
    mal = 0

    # los pesos tienen que sumar 1
    s = sum(p for _k, p in PESOS)
    ok = abs(s - 1.0) < 1e-9
    mal += not ok
    print('   %s los cinco pesos suman 1   (%.2f)' % ('✅' if ok else '🔴', s))

    # la rampa de confianza
    casos = [(8, 0.80), (20, 1.00), (14, 0.90), (30, 1.00)]
    d = [(e, confianza(e)) for e, f in casos if abs(confianza(e) - f) > 1e-9]
    mal += bool(d)
    print('   %s la confianza va de 0.80 a los 8 hasta 1.00 a los 20%s'
          % ('✅' if not d else '🔴', '' if not d else '  %s' % d))

    # 🔴 Y LA RAMPA DE ABAJO ES LA DEL REWORK, CLAVADA EN SUS SEIS
    # PUNTOS. Antes extendía la misma recta hacia abajo y daba 0.68 con
    # un solo evento; con las anclas fijas eso dejaba a un campeón de un
    # evento en rango A. Ver el docstring de `confianza()`.
    abajo = [(1, 0.30), (3, 0.44), (5, 0.59), (7, 0.73)]
    d2 = [(e, round(confianza(e), 2)) for e, f in abajo
          if abs(confianza(e) - f) > 0.005]
    mal += bool(d2)
    print('   %s la rampa de 1 a 8 es la del rework (0.30 → 0.80)%s'
          % ('✅' if not d2 else '🔴', '' if not d2 else '  %s' % d2))

    # ⚠️ Y EMPALMA SIN ESCALON en el 8, que es el número que más se
    # mira: las dos rectas tienen que dar lo mismo ahí.
    ok = abs(confianza(7.999) - confianza(8.0)) < 0.001
    mal += not ok
    print('   %s las dos rampas empalman en 8 sin escalón' % ('✅' if ok else '🔴'))

    # 🔴 LA PROPIEDAD QUE JUSTIFICA EL CAMBIO: volver a competir tiene
    # que pagar. Con la curva vieja, de 1 a 2 eventos sumaba 2.4 %.
    salto = confianza(2) / confianza(1) - 1
    ok = salto > 0.15
    mal += not ok
    print('   %s competir una segunda vez suma %+.0f%% (la vieja: +2%%)'
          % ('✅' if ok else '🔴', salto * 100))

    # 🔴 LA FORMULA, CONTRA LAS 138 FILAS REALES DE LA PRE. Es la unica
    # comprobacion que puede decir que esto no se invento: si la suma
    # ponderada por la confianza no da el Score que el Sheet tenia, la
    # formula esta mal.
    try:
        import subprocess
        t = subprocess.run(['git', 'show',
                            'b71af1e~1:datos/competitivo_pool.json'],
                           capture_output=True, text=True,
                           encoding='utf-8', cwd=BASE).stdout
        viejo = json.loads(t)
        peor, cuantas = 0.0, 0
        for y in viejo:
            try:
                esp = sum(p * float(y[k]) for k, p in PESOS) * float(y['conf'])
            except (KeyError, TypeError, ValueError):
                continue
            cuantas += 1
            peor = max(peor, abs(esp - float(y['score'])))
        ok = cuantas > 100 and peor < 0.2
        mal += not ok
        print('   %s la fórmula cuadra con las %d filas reales de la pre '
              '(peor diferencia %.3f)'
              % ('✅' if ok else '🔴', cuantas, peor))
    except Exception as e:                               # noqa: BLE001
        print('   ⓘ no pude comparar contra la pre (%s)' % str(e)[:50])

    # el cálculo entero, con una llave armada
    res = [
        [1, '22/09', 'FFA', '16+', 'Ana', 'ar', 'Campeón', 10000, '', 10000, ''],
        [1, '22/09', 'FFA', '16+', 'Bea', 've', 'Semifinal', 5250, '', 5250, ''],
        [2, '23/09', 'DRA', '16+', 'Ana', 'ar', 'Campeón', 10000, '', 10000, ''],
        [2, '23/09', 'DRA', '16+', 'Bea', 've', 'Cuartos', 2500, '', 2500, ''],
        [3, '24/09', 'TWR', '16+', 'Ana', 'ar', 'Subcampeón', 7500, '', 7500, ''],
    ]
    c = calcular(res)
    ok = c['Ana']['Dm'] == 100 and c['Bea']['Dm'] == 0
    mal += not ok
    print('   %s Dominancia: Ana gana 2 de 3, Bea ninguno   Ana %d · Bea %d'
          % ('✅' if ok else '🔴', c['Ana']['Dm'], c['Bea']['Dm']))
    # Ana: 3 eventos, los 3 en SF+ -> racha 3. Bea: SF, cuartos -> racha 1
    ok = c['Ana']['T'] > c['Bea']['T'] > 0
    mal += not ok
    print('   %s Racha: la de SF+ es de EVENTOS, y Ana tiene más   %d · %d'
          % ('✅' if ok else '🔴', c['Ana']['T'], c['Bea']['T']))
    # Ana juega en 3 servidores, Bea en 2 -> más diversa Ana
    ok = c['Ana']['V'] > c['Bea']['V']
    mal += not ok
    print('   %s Diversidad: 3 servidores > 2   Ana %d · Bea %d'
          % ('✅' if ok else '🔴', c['Ana']['V'], c['Bea']['V']))

    # ── las anclas fijas (rework A1) ─────────────────────────────────
    #
    # 🔴 ACA ANTES SE AFIRMABA «el líder de cada dimensión vale 100», y
    # eso era la firma de normalizar contra el pool — justo lo que el
    # A1 viene a sacar. Con vara fija, el 100 hay que **ganarlo**: el
    # mejor de la pre quedaba en 83 en Eficiencia y en 92 en Dominancia.
    ok = all(x[k] <= 100 for x in c.values() for k, _p in PESOS)
    mal += not ok
    print('   %s nadie pasa de 100, aunque supere el ancla'
          % ('✅' if ok else '🔴'))

    # 🔴 Y LA PROPIEDAD QUE JUSTIFICA TODO EL CAMBIO: que entre alguien
    # nuevo **no mueve el número de los que ya estaban**. Es el problema
    # que el rework midió — *«al meter los 40.000 pts MW de Road, 131
    # tarjetas cambiaron de número, incluidas las de gente con CERO
    # puntos MW»*. Con máximos del pool, agregar un líder los bajaba a
    # todos.
    res2 = list(res) + [
        [9, '25/09', 'FFA', '16+', 'Nueva', 'ar', 'Campeón', 99000, '', 99000, ''],
    ]
    c2 = calcular(res2)
    movidos = [q for q in c
               if any(c[q][k] != c2[q][k] for k, _p in PESOS)]
    ok = not movidos
    mal += not ok
    print('   %s entra alguien con 99.000 pts y NADIE cambia de número  %s'
          % ('✅' if ok else '🔴 se movieron: %s' % movidos[:4],
             '' if ok else ''))

    # y llegar justo al ancla da exactamente 100
    justo = [[1, '01/01', 'FFA', '16+', 'Tope', 'ar', 'Campeón',
              int(ANCLAS['E']), '', int(ANCLAS['E']), '']]
    ok = calcular(justo)['Tope']['E'] == 100
    mal += not ok
    print('   %s tocar el ancla de Eficiencia (%d pts/ev) da exactamente 100'
          % ('✅' if ok else '🔴', ANCLAS['E']))

    # 🔴 MW NO CUENTA PARA EL COMPETITIVO. La hoja trae `Puntos sin MW`
    # al lado de `Puntos` y el calculo leia la equivocada. Es
    # estructural: la eficiencia es puntos/eventos y **una caza suma
    # puntos sin sumar eventos**.
    F = lambda p, mw, base: ['1','01/01','FFA','16+','Q','ar','Campeon',
                             p,mw,base,'']   # noqa: E731
    ok = _puntos_base(F(50000, 40000, 10000)) == 10000
    mal += not ok
    print('   %s usa `Puntos sin MW` y no `Puntos`   %s'
          % ('ok' if ok else '🔴', _puntos_base(F(50000, 40000, 10000))))
    # ⚠️ y si esa columna no esta, cae a `Puntos` — es el enchufe del A6
    ok = _puntos_base(['1','01/01','FFA','16+','Q','ar','Campeon',7500]) == 7500
    mal += not ok
    print('   %s sin la columna base, cae a `Puntos` (enchufe del A6)'
          % ('ok' if ok else '🔴'))

    # 🔴 LA ENTROPIA TIENE QUE PREMIAR EL REPARTO, no el conteo. Es lo
    # unico que separa la Diversidad de `srv`: medido sobre la pre,
    # cuatro personas con SIETE servidores sacaban 80, 85, 87 y 78.
    pareja = _entropia([5, 5, 5, 5])
    torcida = _entropia([17, 1, 1, 1])
    ok = pareja > torcida
    mal += not ok
    print('   %s repartido parejo vale más que concentrado   %.2f > %.2f'
          % ('✅' if ok else '🔴', pareja, torcida))

    # 🔴 Y MIDE DONDE GANASTE, NO DONDE APARECISTE. Es el cambio A4 del
    # rework, con su caso exacto: *«20 eventos en TFC y 20 en SR, ganás
    # todo en TFC y en SR te vas en octavos → Diversidad 1.00, la
    # máxima. Lo contrario de lo que la dimensión promete»*.
    #
    # ⚠️ Los dos van en el MISMO pool a propósito: `calcular()` devuelve
    # la dimensión ya normalizada contra el líder, así que una persona
    # sola siempre da 100 y no probaría nada.
    filas, n = [], 1
    for _ in range(20):
        filas.append([n, '01/01', 'TFC', '16+', 'Uno', 'ar', 'Campeón',
                      10000, '', 10000, '']); n += 1
    for _ in range(20):
        filas.append([n, '01/01', 'SR', '16+', 'Uno', 'ar', 'Octavos',
                      1250, '', 1250, '']); n += 1
    for sv in ('TFC', 'SR'):
        for _ in range(20):
            filas.append([n, '01/01', sv, '16+', 'Dos', 'ar', 'Campeón',
                          10000, '', 10000, '']); n += 1
    r = calcular(filas)
    ok = r['Uno']['V'] < r['Dos']['V'] * 0.8
    mal += not ok
    print('   %s el que gana en UN servidor tiene menos Diversidad que el '
          'que gana en dos   %.0f vs %.0f'
          % ('✅' if ok else '🔴', r['Uno']['V'], r['Dos']['V']))

    print('\n   %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


def main():
    if '--auto' in sys.argv:
        return _self_check()

    from escribir import Hoja
    res = Hoja('Resultados').filas()
    if not res:
        print('\n   `Resultados` está vacía: no hay de dónde calcular.\n')
        return 0
    c = calcular(res)
    print('\n══ SCORE COMPETITIVO ══\n')
    print('   %-14s %-6s %-4s %-5s %-5s %-5s %-5s %-5s %s'
          % ('quien', 'Score', 'Ev', 'conf', 'E', 'C', 'Dm', 'T', 'V'))
    for quien, v in sorted(c.items(), key=lambda kv: -kv[1]['score'])[:20]:
        print('   %-14s %-6s %-4s %-5s %-5s %-5s %-5s %-5s %s'
              % (quien[:14], v['score'], v['ev'], v['conf'],
                 v['E'], v['C'], v['Dm'], v['T'], v['V']))
    print('\n   %d persona(s)\n' % len(c))
    return 0


if __name__ == '__main__':
    raise SystemExit(main() or 0)
