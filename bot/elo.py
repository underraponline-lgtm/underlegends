# -*- coding: utf-8 -*-
"""📈 EL ELO: EL NIVEL DE CADA UNO, SACADO DE QUIÉN LE GANA A QUIÉN.

    python bot/elo.py              la tabla de hoy
    python bot/elo.py --ver Snow   el ELO de esa persona y sus últimas batallas
    python bot/elo.py --auto       self-check

Dlx, 26/10/2026: *«la tarjeta ELO… la idea es que ahí sólo se enfrenten gente de su propio nivel»*, y a qué batallas
cuentan: *«todos, pero que estén en su mismo rango, al menos algo cerca»*. Y a usarlo en las Competencias: *«siii»*.

🔑 POR QUÉ ELO Y NO EL RANGO. El rango sale del Score y pide 10 eventos: al 26/10 lo tenían 79 de 531. El ELO arranca en
`INI` para todos desde la primera batalla y se mueve con cada 1v1: ganarle a alguien mejor suma mucho, ganarle a alguien
mucho peor casi nada. Medido sobre los 1.116 1v1 de la T1: arriba coincide con el rango (Oasis y Liberia SS, Agus y
Panchok S) y además encuentra a quien el rango no ve —Walker, Deluxe y Juasmio, sin 10 eventos—.

⚠️ «ALGO CERCA» YA LO HACE LA CUENTA. Un SS que le gana a un E suma ~3 y uno que le gana a alguien de su nivel suma 16.
Se probó además no contar los cruces de más de 200 puntos de distancia: eran 7 de 1.116. No hace falta un corte.

⚠️ NO ES UN RANGO Y NO LLEVA LETRA. El rango es uno solo por persona y sale de `comun/rangos.py`; el ELO es un número para
armar cruces parejos. Si algún día se muestra, va como número.

⚠️ CON MENOS DE `PROVISIONAL` BATALLAS ES PROVISIONAL: el número todavía no dice mucho (232 de 363 al 26/10).

⚠️ SE CALCULA HASTA UN MOMENTO (`hasta`). Las Competencias lo piden al arranque de la semana: si se recalculara con cada
vuelta del ciclo, los grupos de la Rapid y las simulaciones cambiarían a mitad de semana.
"""
import datetime as dt
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

#: con lo que arranca cualquiera
INI = 1000.0
#: cuánto se mueve por batalla: con 32, una batalla pareja da ±16
K = 32.0
#: la escala de siempre: con 400 puntos de diferencia, 10 a 1
ESCALA = 400.0
#: menos batallas que esto: provisional
PROVISIONAL = 5


def esperado(ea, eb):
    """La probabilidad de que gane el de ELO `ea`."""
    return 1.0 / (1.0 + 10 ** ((eb - ea) / ESCALA))


def correr(cruces):
    """`cruces`: `[(ganador, perdedor, …)]` del más viejo al más nuevo -> `{k: {'elo', 'n'}}`."""
    elo, n = {}, {}
    for c in cruces:
        g, p = c[0], c[1]
        eg, ep = elo.get(g, INI), elo.get(p, INI)
        d = K * (1 - esperado(eg, ep))
        elo[g], elo[p] = eg + d, ep - d
        n[g], n[p] = n.get(g, 0) + 1, n.get(p, 0) + 1
    return {k: {'elo': round(v), 'n': n[k]} for k, v in elo.items()}


def calcular(llaves, hasta=None):
    """El ELO de todos con los 1v1 de `llaves` anteriores a `hasta` (todos si es `None`). Los 1v1 son los mismos que
    cuentan en las Competencias (`competencias.cruces`): sin equipos, sin walk-in, sin lo que no se peleó."""
    import competencias as CO
    desde = dt.datetime(2000, 1, 1, tzinfo=dt.timezone.utc)
    return correr(CO.cruces(llaves, desde, hasta or dt.datetime(2100, 1, 1, tzinfo=dt.timezone.utc)))


def _llaves():
    try:
        with io.open(os.path.join(BASE, 'datos', 'llaves_t1.json'), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def _self_check():
    mal = 0

    def ok(c, t):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '🔴', t))

    print('\n══ EL ELO ══\n')
    ok(abs(esperado(1000, 1000) - 0.5) < 1e-9 and abs(esperado(1400, 1000) - 10 / 11.0) < 1e-9,
       'parejos 50 %, con 400 de diferencia 10 a 1')
    e = correr([('a', 'b')])
    ok(e['a']['elo'] == 1016 and e['b']['elo'] == 984 and e['a']['n'] == 1, 'una batalla pareja: +16 y −16')
    ok(K * (1 - esperado(1400, 1000)) < 3.5,
       'ganarle a alguien 400 abajo suma menos de 3.5 («algo cerca» lo hace la cuenta)')
    ok(K * (1 - esperado(1000, 1400)) > 28, 'y ganarle a alguien 400 arriba suma más de 28')
    tot = correr([('a', 'b'), ('c', 'a'), ('b', 'c'), ('a', 'c')])
    ok(abs(sum(v['elo'] for v in tot.values()) - 3 * INI) <= 2, 'lo que uno gana lo pierde el otro: el total no se mueve')
    print('\n   %s' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return 1 if mal else 0


def main():
    a = sys.argv[1:]
    if '--auto' in a:
        sys.exit(_self_check())
    import competencias as CO
    E = calcular(_llaves())
    if '--ver' in a and a.index('--ver') + 1 < len(a):
        k = CO.norm(a[a.index('--ver') + 1])
        x = E.get(k)
        print('%s: %s' % (k, '%d (%d batallas%s)' % (x['elo'], x['n'], ', provisional' if x['n'] < PROVISIONAL else '')
                          if x else 'sin batallas 1v1, arranca en %d' % INI))
        return
    filas = sorted(E.items(), key=lambda kv: -kv[1]['elo'])
    print('📈 %d personas con ELO, %d provisionales' % (len(filas), sum(1 for _k, v in filas if v['n'] < PROVISIONAL)))
    for i, (k, v) in enumerate(filas[:25], 1):
        print('  %2d. %-20s %5d  %3d batallas%s' % (i, k, v['elo'], v['n'], '  (provisional)' if v['n'] < PROVISIONAL else ''))


if __name__ == '__main__':
    main()
