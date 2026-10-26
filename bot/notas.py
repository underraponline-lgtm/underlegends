# -*- coding: utf-8 -*-
"""⭐ LA NOTA DE CADA RAPERO EN CADA EVENTO, DEL 1 AL 10, Y EL MVP.

    python bot/notas.py            calcula y escribe datos/notas_eventos.json
    python bot/notas.py --ver 351  la nota de cada uno en ese evento, con el porqué
    python bot/notas.py --auto     self-check

Dlx, 26/10/2026: *«basado en los veredictos, basado en los batacazos, sorpresas, o MVPS o lo que sea, que al final la
competencia pues esté el ganador pero también un puntaje de cada rapero así como lo hace al final el partido de fútbol»*,
y a «arrancar por la nota y el MVP», *«con todo»*.

🔑 COMO EN EL FÚTBOL, EL 6 ES «JUGÓ». Se arranca de 6.0 y cada cosa que pasó en el cuadro suma o resta, con la razón
anotada (`--ver`): una nota sin porqué es un número que nadie discute y nadie entiende.

    batalla ganada          +0.4, y más en las rondas finales (`PESO_RONDA`)
    batalla perdida         −0.4
    🔥 batacazo             ganarle a alguien bastante mejor rankeado: +0.3 a +0.9 según la distancia
    😬 tropiezo             perder con alguien bastante peor rankeado: −0.2 a −0.5 (salvo que ese día llegó a semis)
    🏆 el puesto            campeón +0.8, subcampeón +0.4, tercero +0.2
    🗳️ los veredictos       (cuando se puedan leer por jurado: `veredictos_hist` del objeto, desde el 26/10/2026)

⚠️ EL RANKING ES EL DE HOY, NO EL DE ESE DÍA. «Mejor rankeado» sale del pool de Temporada de ahora: para un evento de hace
un mes, alguien que subió mucho después cuenta como fuerte desde antes. Es la versión 1; cuando haya historia de puestos por
semana se mide contra la de esa semana.

⚠️ LO QUE NO SE PELEÓ NO SUMA: un walk-in, un pase libre o un tercer puesto «sin batalla en la llave» no es una batalla
ganada (la nota del lado de la llave lo dice: `walk-in`, `sin batalla`).

🏅 EL MVP es la nota más alta del evento; a igual nota, el que llegó más lejos.
"""
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path[:0] = [SCR, os.path.join(BASE, 'sheet')]

SALIDA = os.path.join(BASE, 'datos', 'notas_eventos.json')
BASE_NOTA = 6.0
GANA, PIERDE = 0.4, -0.4
#: lo que suma de más ganar en las rondas finales
PESO_RONDA = {'Cuartos': 0.1, 'Semifinales': 0.2, 'Semifinal': 0.2, 'Final': 0.3}
PUESTO = {'Campeón': 0.8, 'Subcampeón': 0.4, 'Tercero': 0.2}
#: perder con alguien que llegó hasta acá no es un tropiezo, aunque esté abajo en el ranking: ese día era de los mejores
LLEGO_LEJOS = ('Campeón', 'Subcampeón', 'Tercero', 'Cuarto', 'Semifinal', 'Semifinales')
#: desde cuántos puestos de distancia en el ranking es un batacazo, y el tope de lo que suma
BATACAZO_DESDE, BATACAZO_TOPE = 15, 0.9
TROPIEZO_DESDE, TROPIEZO_TOPE = 30, -0.5
#: lo que no fue una batalla de verdad, por la nota de la llave
NO_PELEO = ('walk-in', 'sin batalla', 'pase libre', 'bye', 'no se presentó', 'no se presento')


def _norm(s):
    import construir_padron as PAD
    return PAD.norm(s)


def es_equipo(lado):
    from equipos import es_equipo as _e
    return _e(lado)


def personas(lado):
    """Quiénes son un lado: el equipo partido en sus integrantes (`sheet/equipos.py`), o la persona sola."""
    if not es_equipo(lado):
        return [lado]
    from equipos import integrantes
    return [x for x in integrantes(lado)[0] if x]


def puestos():
    """`{nombre normalizado: puesto en la Temporada}` del pool de hoy (1 = el mejor)."""
    try:
        with io.open(os.path.join(BASE, 'datos', 'temporada_pool.json'), encoding='utf-8') as f:
            pool = json.load(f)
    except (OSError, ValueError):
        return {}
    orden = sorted(pool, key=lambda x: -(x.get('pts') or 0))
    return {_norm(x.get('raw') or ''): i + 1 for i, x in enumerate(orden) if x.get('raw')}


def _distancia(pg, pp):
    """Cuántos puestos más arriba estaba el que perdió (positivo = batacazo). `None` si no se sabe de alguno."""
    return None if pg is None or pp is None else pg - pp


def nota_evento(ev, pos):
    """`{nombre: {'nota': x, 'por': [(razón, delta), …]}}` y el MVP de un evento de `llaves_t1.json`."""
    out = {}

    def anotar(n, razon, d):
        e = out.setdefault(n, {'por': []})
        e['por'].append((razon, round(d, 2)))

    # 👥 EN LOS EVENTOS POR EQUIPOS, CADA INTEGRANTE SE LLEVA LA NOTA DE SU EQUIPO: la pareja campeona son dos campeones.
    # Los batacazos, sólo entre personas (el ranking es de personas, no de parejas)
    lejos_hoy = {p for nombre, puesto, _pts in ev.get('tabla') or [] if puesto in LLEGO_LEJOS for p in personas(nombre)}
    for nombre, puesto, _pts in ev.get('tabla') or []:
        for p in personas(nombre):
            out.setdefault(p, {'por': []})
            if puesto in PUESTO:
                anotar(p, puesto.lower(), PUESTO[puesto])
    for rd in ev.get('rondas') or []:
        extra = PESO_RONDA.get(rd.get('r') or '', 0.0)
        for b in rd.get('b') or []:
            try:
                lados, gana, nota = b[0], b[1], str(b[2] or '').lower()
            except (IndexError, TypeError):
                continue
            if not gana or not isinstance(lados, list) or len(lados) != 2 or any(x in nota for x in NO_PELEO):
                continue
            pierde = lados[1] if lados[0] == gana else lados[0]
            if not pierde or pierde == gana:
                continue
            for p in personas(gana):
                anotar(p, 'ganó en %s' % (rd.get('r') or 'la llave'), GANA + extra)
            for p in personas(pierde):
                anotar(p, 'perdió en %s' % (rd.get('r') or 'la llave'), PIERDE)
            if es_equipo(gana) or es_equipo(pierde):
                continue
            dist = _distancia(pos.get(_norm(gana)), pos.get(_norm(pierde)))
            if dist is not None and dist >= BATACAZO_DESDE:
                anotar(gana, '🔥 batacazo a %s' % pierde, min(BATACAZO_TOPE, 0.3 + (dist - BATACAZO_DESDE) / 100))
            elif dist is not None and -dist >= TROPIEZO_DESDE and gana not in lejos_hoy:
                anotar(pierde, '😬 perdió con %s' % gana, max(TROPIEZO_TOPE, -0.2 - (-dist - TROPIEZO_DESDE) / 150))
    lejos = {p: i for i, (n, _p, _x) in enumerate(ev.get('tabla') or []) for p in personas(n)}
    for n, e in out.items():
        e['nota'] = round(max(1.0, min(10.0, BASE_NOTA + sum(d for _r, d in e['por']))), 1)
    mvp = min(out, key=lambda n: (-out[n]['nota'], lejos.get(n, 999))) if out else ''
    return out, mvp


def calcular(llaves=None, pos=None):
    """`{n: {'mvp': nombre, 'notas': {nombre: nota}}}` de todos los eventos."""
    if llaves is None:
        with io.open(os.path.join(BASE, 'datos', 'llaves_t1.json'), encoding='utf-8') as f:
            llaves = json.load(f)
    pos = puestos() if pos is None else pos
    res = {}
    for n, ev in llaves.items():
        notas, mvp = nota_evento(ev, pos)
        if notas:
            res[str(n)] = {'mvp': mvp, 'notas': {k: v['nota'] for k, v in notas.items()}}
    return res


def _self_check():
    mal = 0

    def ok(c, t):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '🔴', t))

    print('\n══ LA NOTA DE CADA RAPERO ══\n')
    ev = {'tabla': [['A', 'Campeón', 0], ['B', 'Subcampeón', 0], ['C', 'Tercero', 0], ['D', 'Cuarto', 0]],
          'rondas': [{'r': 'Semifinales', 'b': [[['A', 'C'], 'A', ''], [['B', 'D'], 'B', '']]},
                     {'r': 'Tercer puesto', 'b': [[['C', 'D'], 'C', 'podio: tercer puesto sin batalla en la llave']]},
                     {'r': 'Final', 'b': [[['A', 'B'], 'A', '']]}]}
    pos = {'a': 40, 'b': 2, 'c': 3, 'd': 90}
    notas, mvp = nota_evento(ev, pos)
    ok(notas['A']['nota'] > notas['B']['nota'] > notas['D']['nota'] and mvp == 'A',
       'el campeón saca más que el subcampeón, el que perdió en semis menos, y el MVP es el campeón')
    ok(any('batacazo' in r for r, _d in notas['A']['por']) and not any('batacazo' in r for r, _d in notas['B']['por']),
       'A (puesto 40) le ganó a B (puesto 2) en la final: batacazo; B, que le ganó al 90, no')
    ok(not any('Tercer' in r for r, _d in notas['C']['por']),
       'un tercer puesto «sin batalla en la llave» no cuenta como batalla ganada')
    ok(all(1.0 <= e['nota'] <= 10.0 for e in notas.values()), 'todas entre 1 y 10')
    eq, mvp_eq = nota_evento({'tabla': [['a, b', 'Campeón', 0], ['c + d', 'Subcampeón', 0]],
                              'rondas': [{'r': 'Final', 'b': [[['a, b', 'c + d'], 'a, b', '']]}]}, {'a': 90, 'c': 1})
    ok(set(eq) == {'a', 'b', 'c', 'd'} and eq['a']['nota'] == eq['b']['nota'] > eq['c']['nota'] and mvp_eq in ('a', 'b')
       and not any('batacazo' in r for r, _d in eq['a']['por']),
       'por equipos: cada integrante con la nota de su equipo, la pareja campeona arriba y sin batacazos entre parejas')
    print('\n   %s' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return 1 if mal else 0


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if '--auto' in sys.argv:
        return _self_check()
    if '--ver' in sys.argv:
        n = sys.argv[sys.argv.index('--ver') + 1]
        with io.open(os.path.join(BASE, 'datos', 'llaves_t1.json'), encoding='utf-8') as f:
            ev = json.load(f).get(n)
        if not ev:
            print('no hay evento #%s' % n)
            return 1
        notas, mvp = nota_evento(ev, puestos())
        print('#%s %s · MVP: %s\n' % (n, ev.get('nombre', ''), mvp))
        for k, e in sorted(notas.items(), key=lambda x: -x[1]['nota']):
            print('  %4.1f  %-22s %s' % (e['nota'], k, ' · '.join('%s %+.1f' % (r, d) for r, d in e['por'])))
        return 0
    res = calcular()
    with io.open(SALIDA, 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
    print('⭐ notas de %d eventos -> %s' % (len(res), os.path.relpath(SALIDA, BASE)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
