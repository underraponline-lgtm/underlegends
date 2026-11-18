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
    📈 contra lo esperado   en un 1v1, lo que decía el ELO de ANTES de esa batalla: ganar con poca chance suma hasta
                            +0.5 y perder siendo muy favorito resta lo mismo (`SORPRESA` × (0,5 − la chance)); que
                            gane el favorito es lo esperado y no mueve nada
    🏆 el puesto            campeón +0.8, subcampeón +0.4, tercero +0.2
    🏟️ el nivel del evento  lo ganado y el puesto valen más en un evento fuerte y menos en uno flojo: ×0,7 a ×1,3 según
                            el ELO promedio de los que jugaron, al empezar el evento
    🗳️ los veredictos       con 2 jurados o más (`datos/jurados.json`): ganar unánime +0.2 y el que no se llevó ni un
                            voto −0.1; ganar dividido no suma nada, y el que perdió con votos +0.2 («por la mínima»)

🗳️ LOS VOTOS DE CADA JURADO (Dlx, 27/10/2026: «que los votos del jurado entren en las notas de cada batalla»). Un 3–0 y
un 2–1 no son la misma batalla: el que pierde 2–1 estuvo ahí. El voto se cruza con la batalla de la llave por los
NOMBRES de los lados (normalizados) y la FECHA (de un día antes a dos después del evento): `datos/jurados.json` no sabe
de qué evento es cada batalla. Las de 3 a 5 MCs (FFA) cuentan igual, y desde esta versión también suman como batalla
ganada o perdida (antes se salteaban).

📈 EL ELO DE ESE MOMENTO, NO EL RANKING DE HOY (Dlx, 17/11/2026: *«basado en el nivel competitivo de la competencia…
imagínate si uno de rango F le gana a uno S debería sumar algo en su final score»* y *«también vs la expectativa»*). Hasta
acá el batacazo comparaba los puestos del pool de HOY: alguien que subió mucho después contaba como fuerte desde antes, y
la nota de un evento viejo cambiaba sola en cada corrida (este archivo se reescribía cada media hora). Ahora sale de
`bot/elo.py` —el mismo ELO de las Competencias, con los mismos 1v1 (`competencias.cruces()`)— recorrido en orden: cada
batalla con el ELO que tenían los dos JUSTO ANTES. La nota de un evento queda quieta una vez jugado (sólo la mueve una
corrección de una llave anterior). El rango no sirve para esto: pide 10 eventos y casi nadie lo tiene; el ELO arranca
con la primera batalla. ⚠️ Los inscritos no entran al nivel: sólo 1 de cada 5 llaves tiene sus inscripciones y por el
nombre escrito aparece el 61 % de los que jugaron; cuentan los que jugaron.

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
#: 📈 cuánto pesa la sorpresa: × (0,5 − la chance de ganar que tenía). Un 10 % que gana suma 0,4; el 90 % que perdió, −0,4
SORPRESA = 1.0
#: 🏟️ el nivel del evento: (ELO promedio − el de arranque) / esto, con un tope de ±`NIVEL_TOPE`
NIVEL_ESCALA, NIVEL_TOPE = 250.0, 0.3
#: lo que no fue una batalla de verdad, por la nota de la llave
NO_PELEO = ('walk-in', 'sin batalla', 'pase libre', 'bye', 'no se presentó', 'no se presento')
#: 🗳️ los veredictos: desde cuántos jurados cuentan, y lo que suman
VOTOS_MIN = 2
UNANIME, SIN_VOTOS, POR_LA_MINIMA = 0.2, -0.1, 0.2
#: la ventana para cruzar un voto con un evento, en días desde el día del evento (ET)
VOTO_ANTES, VOTO_DESPUES = 1, 2
#: 🔥 EL BATACAZO DE LA NOCHE (Dlx, 18/11/2026, «Dos premios»): el 🔥 más grande de un evento lleva su propio sello si
#: llega a esto —ganar con 35 % de chance o menos—. En la T1, 49 de 280 eventos tienen uno. El MVP sigue siendo la nota
#: más alta: con un MVP «por calidad» Marcos salía MVP con 6,6 y Mats con 8,9 (#649), y Dlx preguntó por qué
PISO_BATACAZO = 0.15
#: 🌙 lo nuevo del 18/11/2026 —la imagen «La noche de…» del aviso de ganadores, sus botones y el 🔥 en la llave—, SÓLO
#: DESDE ESTE EVENTO (Dlx: «sólo necesitamos hacer que los próximos eventos tengan eso. NO los actuales y pasados»): el
#: #660 era el último procesado cuando se subió
NOCHE_DESDE = 661


def _norm(s):
    import construir_padron as PAD
    return PAD.norm(s)


def es_equipo(lado):
    from equipos import es_equipo as _e
    return _e(lado)


def personas(lado):
    """Quiénes son un lado: el equipo partido en sus integrantes (`sheet/equipos.py`), o la persona sola. ⚠️ La sola
    también pasa por `integrantes()`: «@j.nibbana, <:logocypherhood:…>» (#636) es UNA persona, y salía con el emoji y todo
    como nombre (17/11/2026)."""
    from equipos import integrantes
    xs = [x for x in integrantes(lado)[0] if x]
    return xs if xs else [lado]


def fuerzas(llaves):
    """📈 `{n: {'nivel': x, 'pre': {(norm ganador, norm perdedor): [(elo g, elo p), …]}}}`: el ELO de cada 1v1 JUSTO ANTES de
    pelearse y el promedio de los que jugaron cada evento al empezarlo. Con `bot/elo.py` (`INI`, `K`, `esperado`) sobre los
    mismos 1v1 que cuentan en las Competencias (`competencias.cruces()`, ya en orden de fecha y número)."""
    import datetime as dt
    import competencias as CO
    import elo as EL
    cr = CO.cruces(llaves, dt.datetime(2000, 1, 1, tzinfo=dt.timezone.utc), dt.datetime(2100, 1, 1, tzinfo=dt.timezone.utc))
    por_ev = {}
    for c in cr:
        por_ev.setdefault(c[2], []).append(c)
    orden = sorted(llaves, key=lambda n: (str((llaves[n] or {}).get('dia') or ''), int(n) if str(n).isdigit() else 0))
    elo, out = {}, {}
    for n in orden:
        ev = llaves[n] or {}
        gente = {CO.norm(p) for nombre, _pu, _x in ev.get('tabla') or [] for p in personas(nombre)}
        gente.discard('')
        nivel = sum(elo.get(k, EL.INI) for k in gente) / len(gente) if gente else None
        pre = {}
        for g, pe, _n, _d in por_ev.get(str(n), ()):
            eg, ep = elo.get(g, EL.INI), elo.get(pe, EL.INI)
            pre.setdefault((g, pe), []).append((eg, ep))
            d = EL.K * (1 - EL.esperado(eg, ep))
            elo[g], elo[pe] = eg + d, ep - d
        out[str(n)] = {'nivel': nivel, 'pre': pre}
    return out


def _mult_nivel(nivel):
    """×0,7 a ×1,3: lo que valen lo ganado y el puesto en un evento de ese nivel (`None`: ×1)."""
    import elo as EL
    if nivel is None:
        return 1.0
    return 1.0 + max(-NIVEL_TOPE, min(NIVEL_TOPE, (nivel - EL.INI) / NIVEL_ESCALA))


def indice_votos(J=None):
    """🗳️ `{frozenset(lados normalizados): [(día ET, {lado normalizado: votos})]}` de `datos/jurados.json`."""
    import datetime as dt
    if J is None:
        try:
            with io.open(os.path.join(BASE, 'datos', 'jurados.json'), encoding='utf-8') as f:
                J = json.load(f)
        except (OSError, ValueError):
            return {}
    out = {}
    for b in (J.get('votos') or {}).values():
        lados = b.get('lados') or [b.get('a') or '', b.get('b') or '']
        ns = [_norm(x) for x in lados]
        if len(ns) < 2 or not all(ns) or len(set(ns)) != len(ns):
            continue
        cuenta = {}
        for x in (b.get('v') or {}).values():
            n = ns[0] if x == 'a' else ns[1] if x == 'b' else _norm(x)
            if n in ns:
                cuenta[n] = cuenta.get(n, 0) + 1
        try:
            # el día en el este (UTC−4/−5): con −4 alcanza, la ventana es de días
            dia = (dt.datetime.fromtimestamp(int(b['pub']) / 1000, dt.timezone.utc) - dt.timedelta(hours=4)).date()
        except (KeyError, TypeError, ValueError, OSError):
            continue
        if cuenta:
            out.setdefault(frozenset(ns), []).append((dia, cuenta))
    return out


def veredicto(votos, lados, dia):
    """`{lado normalizado: votos}` de esa batalla, o `None` si no hay votos de jurado que se le puedan atribuir."""
    import datetime as dt
    if not votos or not dia:
        return None
    try:
        d0 = dt.date.fromisoformat(dia)
    except ValueError:
        return None
    cand = [c for d, c in votos.get(frozenset(_norm(x) for x in lados)) or ()
            if -VOTO_ANTES <= (d - d0).days <= VOTO_DESPUES]
    return cand[-1] if cand else None


def nota_evento(ev, fuerza=None, votos=None):
    """`{nombre: {'nota': x, 'por': [(razón, delta), …]}}` y el MVP de un evento de `llaves_t1.json`. `fuerza`: la de ese
    evento en `fuerzas()` (sin ella, ni sorpresa ni nivel). `votos`, el índice de `indice_votos()`: sin él, sin veredictos."""
    import competencias as CO
    import elo as EL
    out = {}
    fuerza = fuerza or {}
    pre = {k: list(v) for k, v in (fuerza.get('pre') or {}).items()}
    mult = _mult_nivel(fuerza.get('nivel'))

    # 👤 UNA PERSONA, UNA NOTA, con el nombre de la tabla (17/11/2026): la llave escribe a veces distinto la misma persona
    # —«Doble J» y «DOBLE J» en la #636, «Eldinoco🇨🇩» en cuartos y «Eldinoco🇦🇷» en semis de la #544— y salían dos notas,
    # una con el puesto y otra con las batallas. Sólo si la tabla tiene UNA persona con esa clave: con dos, son dos
    tab = {}
    for nombre, _pu, _x in ev.get('tabla') or []:
        for p in personas(nombre):
            tab.setdefault(_norm(p), set()).add(p)
    canon = {k: next(iter(v)) for k, v in tab.items() if len(v) == 1}

    def anotar(n, razon, d):
        e = out.setdefault(canon.get(_norm(n), n), {'por': []})
        e['por'].append((razon, round(d, 2)))

    # 👥 EN LOS EVENTOS POR EQUIPOS, CADA INTEGRANTE SE LLEVA LA NOTA DE SU EQUIPO: la pareja campeona son dos campeones.
    # Los batacazos, sólo entre personas (el ranking es de personas, no de parejas)
    nv = '' if mult == 1.0 else ' · evento ×%.2f' % mult
    for nombre, puesto, _pts in ev.get('tabla') or []:
        for p in personas(nombre):
            out.setdefault(p, {'por': []})
            if puesto in PUESTO:
                anotar(p, puesto.lower() + nv, PUESTO[puesto] * mult)
    for rd in ev.get('rondas') or []:
        extra = PESO_RONDA.get(rd.get('r') or '', 0.0)
        for b in rd.get('b') or []:
            try:
                lados, gana, nota = b[0], b[1], str(b[2] or '').lower()
            except (IndexError, TypeError):
                continue
            if not gana or not isinstance(lados, list) or len(lados) < 2 or gana not in lados \
                    or any(x in nota for x in NO_PELEO):
                continue
            pierden = [x for x in lados if x and x != gana]
            if not pierden:
                continue
            for p in personas(gana):
                anotar(p, 'ganó en %s%s' % (rd.get('r') or 'la llave', nv), (GANA + extra) * mult)
            for x in pierden:
                for p in personas(x):
                    anotar(p, 'perdió en %s' % (rd.get('r') or 'la llave'), PIERDE)
            # 🗳️ cómo votó el jurado
            vs = veredicto(votos, lados, ev.get('dia'))
            if vs and sum(vs.values()) >= VOTOS_MIN and vs.get(_norm(gana), 0) * 2 > sum(vs.values()):
                tot, vg = sum(vs.values()), vs.get(_norm(gana), 0)
                if vg == tot:
                    for p in personas(gana):
                        anotar(p, '🗳️ unánime %d–0' % tot, UNANIME)
                for x in pierden:
                    vx = vs.get(_norm(x), 0)
                    for p in personas(x):
                        if vx:
                            anotar(p, '🗳️ perdió %d–%d%s' % (vg, vx, ', por la mínima' if vg - vx == 1 else ''),
                                   POR_LA_MINIMA)
                        elif vg == tot:
                            anotar(p, '🗳️ ningún voto', SIN_VOTOS)
            if len(lados) != 2:
                continue
            pierde = pierden[0]
            if es_equipo(gana) or es_equipo(pierde):
                continue
            # 📈 contra lo esperado: el ELO de los dos JUSTO ANTES de esta batalla (`fuerzas()`)
            par = pre.get((CO.norm(gana), CO.norm(pierde)))
            if not par:
                continue
            eg, ep = par.pop(0)
            ch = EL.esperado(eg, ep)
            # ⚠️ SÓLO LA SORPRESA: que el favorito gane es lo esperado y no resta (simétrico, el subcampeón que les ganó a
            # todos los de abajo quedaba igual que uno que perdió en semis)
            s = SORPRESA * (0.5 - ch)
            if s >= 0.05:
                anotar(gana, '🔥 le ganó a %s con %d %% de chance' % (pierde, round(100 * ch)), s)
                anotar(pierde, '😬 perdió con %s siendo favorito (%d %%)' % (gana, round(100 * (1 - ch))), -s)
    lejos = {p: i for i, (n, _p, _x) in enumerate(ev.get('tabla') or []) for p in personas(n)}
    for n, e in out.items():
        e['nota'] = round(max(1.0, min(10.0, BASE_NOTA + sum(d for _r, d in e['por']))), 1)
    mvp = min(out, key=lambda n: (-out[n]['nota'], lejos.get(n, 999))) if out else ''
    return out, mvp


def batacazo(notas):
    """🔥 `(nombre, razón, delta)` del batacazo de la noche —el 🔥 más grande que llega a `PISO_BATACAZO`—, o `None`."""
    mejor = None
    for n, e in (notas or {}).items():
        for r, d in e.get('por') or []:
            if str(r).startswith('🔥') and d >= PISO_BATACAZO and (mejor is None or d > mejor[2]):
                mejor = (n, r, d)
    return mejor


def lleva_noche(n):
    """🌙 ¿El evento `n` es de los que llevan lo del 18/11 (la imagen, sus botones, el 🔥 en la llave)?"""
    return str(n).isdigit() and int(n) >= NOCHE_DESDE


def calcular(llaves=None, votos=None):
    """`{n: {'mvp': nombre, 'notas': {nombre: nota}, 'bat': nombre}}` de todos los eventos (`bat`, el del batacazo de la
    noche, sólo desde `NOCHE_DESDE` y si lo hubo)."""
    if llaves is None:
        with io.open(os.path.join(BASE, 'datos', 'llaves_t1.json'), encoding='utf-8') as f:
            llaves = json.load(f)
    fz = fuerzas(llaves)
    votos = indice_votos() if votos is None else votos
    res = {}
    for n, ev in llaves.items():
        notas, mvp = nota_evento(ev, fz.get(str(n)), votos)
        if notas:
            res[str(n)] = {'mvp': mvp, 'notas': {k: v['nota'] for k, v in notas.items()}}
            b = batacazo(notas) if lleva_noche(n) else None
            if b:
                res[str(n)]['bat'] = b[0]
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
    # A (900) le gana a C (1000) y en la final a B (1200): sorpresas; B, que le gana a D (800), era favorito
    fz = {'nivel': 975.0, 'pre': {('a', 'c'): [(900.0, 1000.0)], ('b', 'd'): [(1200.0, 800.0)], ('a', 'b'): [(900.0, 1200.0)]}}
    notas, mvp = nota_evento(ev, fz)
    ok(notas['A']['nota'] > notas['B']['nota'] > notas['D']['nota'] and mvp == 'A',
       'el campeón saca más que el subcampeón, el que perdió en semis menos, y el MVP es el campeón')
    b = batacazo(notas)
    ok(b and b[0] == 'A' and 'B' in b[1] and b[2] >= PISO_BATACAZO,
       '🔥 el batacazo de la noche: el más grande (A le ganó a B, de 1200, en la final), no el chico contra C')
    ok(batacazo({'X': {'por': [('🔥 le ganó a Y con 40 % de chance', 0.10)]}}) is None,
       '🔥 ganar con 40 % de chance no es batacazo: hace falta 35 % o menos')
    ok(not lleva_noche('660') and lleva_noche(str(NOCHE_DESDE)) and not lleva_noche('abc'),
       '🌙 lo del 18/11 sólo desde NOCHE_DESDE (Dlx: «NO los actuales y pasados»)')
    ok(any('chance' in r for r, _d in notas['A']['por']) and not any('chance' in r for r, _d in notas['B']['por'])
       and any('favorito' in r for r, d in notas['B']['por'] if d < 0) and not any('D' in r for r, _d in notas['B']['por'] if 'favorito' in r),
       'A (900) le ganó a B (1200): suma contra lo esperado y B, que era favorito, resta; que B le gane a D (800) no mueve nada')
    fuerte = nota_evento(ev, dict(fz, nivel=1100.0))[0]
    flojo = nota_evento(ev, dict(fz, nivel=850.0))[0]
    ok(fuerte['A']['nota'] > notas['A']['nota'] > flojo['A']['nota'] and fuerte['D']['nota'] == flojo['D']['nota'],
       'el mismo campeón saca más en un evento fuerte y menos en uno flojo; quien no ganó nada, igual en los dos')
    import elo as EL
    _ll = {'1': {'dia': '2026-10-01', 'tabla': [['X', 'Campeón', 0], ['Y', 'Subcampeón', 0]],
                 'rondas': [{'r': 'Final', 'b': [[['X', 'Y'], 'X', '']]}]},
           '2': {'dia': '2026-10-02', 'tabla': [['Y', 'Campeón', 0], ['X', 'Subcampeón', 0]],
                 'rondas': [{'r': 'Final', 'b': [[['X', 'Y'], 'Y', '']]}]}}
    _fz = fuerzas(_ll)
    ok(_fz['1']['pre'][('x', 'y')] == [(EL.INI, EL.INI)] and _fz['2']['pre'][('y', 'x')][0][1] > EL.INI > _fz['2']['pre'][('y', 'x')][0][0],
       'fuerzas(): cada batalla con el ELO de JUSTO ANTES, en orden (la revancha de Y llega con X arriba)')
    ok(not any('Tercer' in r for r, _d in notas['C']['por']),
       'un tercer puesto «sin batalla en la llave» no cuenta como batalla ganada')
    ok(all(1.0 <= e['nota'] <= 10.0 for e in notas.values()), 'todas entre 1 y 10')
    eq, mvp_eq = nota_evento({'tabla': [['a, b', 'Campeón', 0], ['c + d', 'Subcampeón', 0]],
                              'rondas': [{'r': 'Final', 'b': [[['a, b', 'c + d'], 'a, b', '']]}]})
    ok(set(eq) == {'a', 'b', 'c', 'd'} and eq['a']['nota'] == eq['b']['nota'] > eq['c']['nota'] and mvp_eq in ('a', 'b')
       and not any('chance' in r for r, _d in eq['a']['por']),
       'por equipos: cada integrante con la nota de su equipo, la pareja campeona arriba y sin batacazos entre parejas')
    # 🗳️ los veredictos: 3–0, 2–1 y una de tres MCs
    J = {'votos': {'1': {'a': 'A 🇦🇷', 'b': 'B', 'pub': 1792900000000, 'v': {'j1': 'a', 'j2': 'a', 'j3': 'a'}},
                   '2': {'a': 'C', 'b': 'D', 'pub': 1792900000000, 'v': {'j1': 'a', 'j2': 'b', 'j3': 'a'}},
                   '3:0': {'lados': ['E', 'F', 'G'], 'g': 'E', 'pub': 1792900000000,
                           'v': {'j1': 'E', 'j2': 'G', 'j3': 'E'}}}}
    vi = indice_votos(J)
    import datetime as dt
    dia = (dt.datetime.fromtimestamp(1792900000, dt.timezone.utc) - dt.timedelta(hours=4)).date().isoformat()
    ev = {'dia': dia, 'tabla': [], 'rondas': [{'r': 'Octavos', 'b': [[['A', 'B'], 'A', ''], [['C', 'D'], 'C', ''],
                                                                   [['E', 'F', 'G'], 'E', 'triple (3 bandas)']]}]}
    nv, _m = nota_evento(ev, None, vi)
    sin, _m = nota_evento(ev, None)
    ok(nv['A']['nota'] > sin['A']['nota'] and nv['B']['nota'] < sin['B']['nota'],
       '3–0: el ganador suma por unánime y el que no se llevó ningún voto resta')
    ok(nv['D']['nota'] > sin['D']['nota'] and nv['C']['nota'] == sin['C']['nota'],
       '2–1: el que perdió con un voto suma («por la mínima»), el ganador no suma por eso')
    ok(nv['G']['nota'] > nv['F']['nota'] and 'E' in sin and sin['F']['nota'] < 6.0,
       'la de tres MCs cuenta como batalla, y G (con un voto) queda arriba de F (sin votos)')
    lejos = dict(ev, dia='2026-01-01')
    ok(nota_evento(lejos, None, vi)[0]['A']['nota'] == sin['A']['nota'], 'un voto de otra fecha no se cruza con el evento')
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
        with io.open(os.path.join(BASE, 'datos', 'llaves_t1.json'), encoding='utf-8') as f:
            todas = json.load(f)
        fz = fuerzas(todas).get(str(n)) or {}
        notas, mvp = nota_evento(ev, fz, indice_votos())
        if fz.get('nivel') is not None:
            print('ELO promedio de los que jugaron, al empezar: %d · lo ganado y el puesto valen ×%.2f'
                  % (fz['nivel'], _mult_nivel(fz['nivel'])))
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
