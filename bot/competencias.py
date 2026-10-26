# -*- coding: utf-8 -*-
"""🏆 LAS COMPETENCIAS DE LA SEMANA: la Copa por grupos, la Liga de 10 y las Rapid Battles.

    python bot/competencias.py            calcula y escribe datos/competencias.json
    python bot/competencias.py --ver      cómo va la semana
    python bot/competencias.py --auto     self-check

Dlx, 26/10/2026: *«que hayan mini eventos pero que se note… que haya siempre esto y no solo 1… podemos hacer una copa,
para diferentes grupos… donde sea se enfrenten, en cualquier servidor o evento, que eso cuente para su batalla del
evento… EN CASO de que estos 2 no se peleen, se haría una simulación»*, *«podríamos hacer la LIGA, … una liga con 10
personas»*, *«RAPID BATTLES, donde se simula básicamente todo»*, y después *«que hayan diferentes grupos, no solo 1…
para que la mayoría juegue algo (no todos ojo, evita incluir inactivos)»*.

LAS REGLAS
----------
- **La semana es la de las divisiones y los multiplicadores** (lunes a lunes, 11 AM ET: `multiplicadores.periodo()`).
- **Sólo activos**: jugó al menos un evento en los `ACTIVO_DIAS` días antes de que arranque la semana. Quien no juega
  no ocupa un lugar que se simularía entero.
- **🏆 La Copa**: los activos, ordenados por su división (`datos/divisiones.json`) y su fuerza, se parten en **grupos de
  `GRUPO`**. Todos contra todos dentro del grupo. **Si dos se cruzan en un 1v1 de cualquier evento de cualquier servidor
  durante la semana, cuenta ese resultado** (el último, si fueron varios). Si al cerrar la semana no se cruzaron, se
  **simula**. Ganar da 3 puntos; gana el grupo el primero.
- **🥇 La Liga de 10**: los 10 mejores del Competitivo que están activos al arrancar. Una jornada por semana (cinco
  cruces, el calendario de todos contra todos), con la misma regla: real si se cruzaron esa semana, simulado si no. La
  tabla se acumula; los diez quedan fijos en `datos/competencias.json` desde la semana en que arrancó.
- **⚡ Rapid Battles**: cada día, 8 activos sorteados y una llave entera simulada, de una.

⚖️ LA SIMULACIÓN ES REPETIBLE Y EXPLICABLE. La fuerza de cada uno es su Score competitivo (o, sin Score, un piso según
su puesto en la Temporada), más su forma (el promedio de sus últimas `FORMA` notas, `bot/notas.py`). La probabilidad de
que A le gane a B es logística en la diferencia (`ESCALA`), y la moneda sale de un SHA-256 de la semana y el cruce: la
misma semana da siempre el mismo resultado, y cualquiera puede rehacer la cuenta. Nunca se inventa un resultado real.
"""
import datetime as dt
import hashlib
import io
import json
import math
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

SALIDA = os.path.join(BASE, 'datos', 'competencias.json')
ACTIVO_DIAS = 14
GRUPO = 4
LIGA = 10
RAPID = 8
FORMA = 5
#: cuántos puntos de fuerza son «10 a 1». Era 25 y daba 98 % a Oasis (80) contra Makmah (38): en el freestyle los
#: batacazos pasan, así que 50 —el mismo cruce, ~88 %— (26/10/2026)
ESCALA = 50.0
#: sin Score competitivo, la fuerza sale del puesto en la Temporada: del primero al último, de PISO_ALTO a PISO_BAJO
PISO_ALTO, PISO_BAJO = 55.0, 20.0
LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'


def _j(*p, defecto=None):
    try:
        with io.open(os.path.join(BASE, *p), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return defecto


def norm(s):
    import construir_padron as PAD
    return PAD.norm(s)


def personas(lado):
    from notas import personas as _p
    return _p(lado)


def _dia_utc(dia):
    """`2026-10-25` (el día ET del evento) -> el mediodía UTC de ese día, para compararlo con la semana."""
    try:
        return dt.datetime.strptime(dia, '%Y-%m-%d').replace(hour=16, tzinfo=dt.timezone.utc)
    except (TypeError, ValueError):
        return None


# ── los datos ─────────────────────────────────────────────────────────────────────────────────────────────────────

def jugaron(llaves, desde, hasta):
    """`{norm: nombre}` de quienes jugaron un evento entre `desde` y `hasta`."""
    out = {}
    for ev in llaves.values():
        t = _dia_utc(ev.get('dia'))
        if t is None or not (desde <= t < hasta):
            continue
        for nombre, _p, _x in ev.get('tabla') or []:
            for p in personas(nombre):
                out.setdefault(norm(p), p)
    return out


def cruces(llaves, desde, hasta):
    """Los 1v1 de verdad entre `desde` y `hasta`: `[(norm ganador, norm perdedor, n, dia)]`, del más viejo al más nuevo.
    Los equipos, los walk-in y lo «sin batalla» no son un cruce."""
    from notas import NO_PELEO, es_equipo
    out = []
    for n, ev in llaves.items():
        t = _dia_utc(ev.get('dia'))
        if t is None or not (desde <= t < hasta):
            continue
        for rd in ev.get('rondas') or []:
            for b in rd.get('b') or []:
                try:
                    lados, gana, nota = b[0], b[1], str(b[2] or '').lower()
                except (IndexError, TypeError):
                    continue
                if not gana or not isinstance(lados, list) or len(lados) != 2 or any(x in nota for x in NO_PELEO):
                    continue
                pierde = lados[1] if lados[0] == gana else lados[0]
                if not pierde or pierde == gana or es_equipo(gana) or es_equipo(pierde):
                    continue
                out.append((norm(gana), norm(pierde), str(n), ev.get('dia') or ''))
    out.sort(key=lambda x: (x[3], int(x[2]) if x[2].isdigit() else 0))
    return out


def fuerzas(llaves, notas):
    """`{norm: fuerza}`: el Score competitivo, o el piso por su puesto en la Temporada; más su forma."""
    comp = {norm(c['raw']): float(c.get('score') or 0) for c in (_j('datos', 'competitivo_pool.json', defecto=[]) or [])
            if c.get('raw') and (c.get('ev') or 0) >= 10}
    temp = sorted(_j('datos', 'temporada_pool.json', defecto=[]) or [], key=lambda x: -(x.get('pts') or 0))
    n = max(1, len(temp) - 1)
    base = {}
    for i, x in enumerate(temp):
        if x.get('raw'):
            base[norm(x['raw'])] = PISO_ALTO - (PISO_ALTO - PISO_BAJO) * i / n
    base.update(comp)
    # la forma: el promedio de sus últimas notas, contra el 6 («jugó»)
    hist = {}
    for k in sorted(llaves, key=lambda k: (llaves[k].get('dia') or '', int(k) if str(k).isdigit() else 0)):
        for nombre, nota in ((notas.get(str(k)) or {}).get('notas') or {}).items():
            hist.setdefault(norm(nombre), []).append(nota)
    out = {}
    for k, f in base.items():
        xs = hist.get(k, [])[-FORMA:]
        out[k] = round(f + (sum(xs) / len(xs) - 6.0) * 3 if xs else f, 1)
    return out


def prob(fa, fb):
    """La probabilidad de que gane el de fuerza `fa`."""
    return 1.0 / (1.0 + 10 ** ((fb - fa) / ESCALA))


def moneda(*partes):
    """Un número entre 0 y 1 que sale siempre igual para las mismas partes (SHA-256)."""
    h = hashlib.sha256('|'.join(str(p) for p in partes).encode('utf-8')).hexdigest()
    return int(h[:12], 16) / float(16 ** 12)


def simular(a, b, fa, fb, *semilla):
    """`(ganador, prob de a)`: el cruce simulado, repetible. La moneda se tira siempre en el mismo orden (alfabético),
    así el resultado no depende de quién se nombró primero."""
    x, y = sorted((a, b))
    fx, fy = (fa, fb) if x == a else (fb, fa)
    g = x if moneda(*semilla, x, y) < prob(fx, fy) else y
    return g, round(prob(fa, fb), 3)


# ── las tres ──────────────────────────────────────────────────────────────────────────────────────────────────────

def resolver(a, b, reales, cerrada, fz, *semilla):
    """Un cruce: `{'a','b','g' (ganador o ''),'como' ('real'|'sim'|'pend'),'p' (prob de a),'ev'}`."""
    fa, fb = fz.get(a, PISO_BAJO), fz.get(b, PISO_BAJO)
    real = [x for x in reales if {x[0], x[1]} == {a, b}]
    if real:
        g, _pe, n, _d = real[-1]
        return {'a': a, 'b': b, 'g': g, 'como': 'real', 'p': round(prob(fa, fb), 3), 'ev': n}
    if cerrada:
        g, p = simular(a, b, fa, fb, *semilla)
        return {'a': a, 'b': b, 'g': g, 'como': 'sim', 'p': p}
    return {'a': a, 'b': b, 'g': '', 'como': 'pend', 'p': round(prob(fa, fb), 3)}


def tabla(gente, partidos, fz):
    """`[[norm, pj, g, pts]]`, ordenada: puntos, ganados de verdad, fuerza."""
    t = {k: [k, 0, 0, 0, 0] for k in gente}
    for m in partidos:
        if not m['g']:
            continue
        for k in (m['a'], m['b']):
            t[k][1] += 1
        t[m['g']][2] += 1
        t[m['g']][3] += 3
        if m['como'] == 'real':
            t[m['g']][4] += 1
    return [x[:4] for x in sorted(t.values(), key=lambda x: (-x[3], -x[4], -fz.get(x[0], 0), x[0]))]


def copa(activos, niveles, fz, reales, cerrada, sem):
    """Los grupos de la semana."""
    orden = sorted(activos, key=lambda k: (niveles.get(k, 5), -fz.get(k, PISO_BAJO), k))
    grupos = [orden[i:i + GRUPO] for i in range(0, len(orden), GRUPO)]
    # un grupo de uno o dos no es un grupo: se reparte en los de arriba
    while len(grupos) > 1 and len(grupos[-1]) < 3:
        sobra = grupos.pop()
        for i, k in enumerate(sobra):
            grupos[-1 - (i % len(grupos))].append(k)
    out = []
    for i, g in enumerate(grupos):
        ps = [resolver(a, b, reales, cerrada, fz, sem, 'copa', i) for j, a in enumerate(g) for b in g[j + 1:]]
        out.append({'id': LETRAS[i % 26] + ('' if i < 26 else str(i // 26)), 'div': min(niveles.get(k, 5) for k in g),
                    'gente': g, 'partidos': ps, 'tabla': tabla(g, ps, fz)})
    return out


def calendario(n):
    """El todos contra todos de `n` (par): `n-1` jornadas de `n/2` cruces, por el método del círculo."""
    xs = list(range(n))
    out = []
    for _r in range(n - 1):
        out.append([(xs[i], xs[n - 1 - i]) for i in range(n // 2)])
        xs = [xs[0]] + [xs[-1]] + xs[1:-1]
    return out


def liga(viejo, activos, fz, llaves, semanas, ahora):
    """La Liga de 10: fija sus diez la primera semana; cada semana, una jornada."""
    comp = sorted(((norm(c['raw']), float(c.get('score') or 0)) for c in (_j('datos', 'competitivo_pool.json', defecto=[]) or [])
                   if c.get('raw') and (c.get('ev') or 0) >= 10), key=lambda x: -x[1])
    miembros = (viejo or {}).get('miembros') or [k for k, _s in comp if k in activos][:LIGA]
    desde = (viejo or {}).get('desde') or semanas[0][0]
    if len(miembros) < LIGA:
        return {'miembros': miembros, 'desde': desde, 'jornadas': [], 'tabla': [], 'falta': LIGA - len(miembros)}
    cal = calendario(LIGA)
    jornadas = []
    for j, (sid, ini, fin) in enumerate([s for s in semanas if s[0] >= desde][:LIGA - 1]):
        reales = cruces(llaves, ini, fin)
        cerrada = ahora >= fin
        ps = [resolver(miembros[a], miembros[b], reales, cerrada, fz, sid, 'liga') for a, b in cal[j]]
        jornadas.append({'n': j + 1, 'sem': sid, 'partidos': ps})
    todos = [m for jj in jornadas for m in jj['partidos']]
    return {'miembros': miembros, 'desde': desde, 'jornadas': jornadas, 'tabla': tabla(miembros, todos, fz)}


def rapid(activos, fz, dia):
    """La Rapid del día: 8 activos sorteados (con la fecha de semilla) y la llave entera simulada."""
    if len(activos) < RAPID:
        return None
    gente = sorted(activos, key=lambda k: moneda('rapid', dia, k))[:RAPID]
    rondas, vivos = [], gente
    for r in ('Cuartos', 'Semifinal', 'Final'):
        ps = []
        for i in range(0, len(vivos), 2):
            a, b = vivos[i], vivos[i + 1]
            g, p = simular(a, b, fz.get(a, PISO_BAJO), fz.get(b, PISO_BAJO), 'rapid', dia, r)
            ps.append({'a': a, 'b': b, 'g': g, 'como': 'sim', 'p': p})
        rondas.append({'r': r, 'partidos': ps})
        vivos = [m['g'] for m in ps]
    return {'dia': dia, 'gente': gente, 'rondas': rondas, 'campeon': vivos[0]}


def calcular(ahora=None, llaves=None, notas=None, viejo=None):
    import multiplicadores as MU
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    llaves = llaves if llaves is not None else (_j('datos', 'llaves_t1.json', defecto={}) or {})
    notas = notas if notas is not None else (_j('datos', 'notas_eventos.json', defecto={}) or {})
    viejo = viejo if viejo is not None else (_j('datos', 'competencias.json', defecto={}) or {})
    sid, ini, fin = MU.periodo(ahora)
    sid = str(sid)
    fz = fuerzas(llaves, notas)
    activos = set(jugaron(llaves, ini - dt.timedelta(days=ACTIVO_DIAS), ini))
    niveles = {norm(k): v for k, v in ((_j('datos', 'divisiones.json', defecto={}) or {}).get('nivel') or {}).items()}
    reales = cruces(llaves, ini, fin)
    # las semanas desde que arrancó la liga (o ésta), para sus jornadas
    semanas, t = [], ini
    desde_liga = ((viejo.get('liga') or {}).get('desde')) or sid
    while True:
        s = MU.periodo(t)
        if str(s[0]) < desde_liga:
            break
        semanas.insert(0, (str(s[0]), s[1], s[2]))
        t = s[1] - dt.timedelta(hours=1)
        if len(semanas) > LIGA:
            break
    dia_et = (ahora - dt.timedelta(hours=4)).strftime('%Y-%m-%d')
    nombres = {}
    for ev in llaves.values():
        for nombre, _p, _x in ev.get('tabla') or []:
            for p in personas(nombre):
                nombres.setdefault(norm(p), p)
    return {
        '_leeme': 'Las competencias de la semana: las arma bot/competencias.py. Las reglas viven en ese archivo.',
        'sem': sid, 'ini': ini.isoformat(), 'fin': fin.isoformat(),
        'dia': min(7, max(1, int((ahora - ini).total_seconds() // 86400) + 1)),
        'activos': len(activos),
        'copa': copa(activos, niveles, fz, reales, ahora >= fin, sid),
        'liga': liga(viejo.get('liga'), activos, fz, llaves, semanas, ahora),
        'rapid': rapid(activos, fz, dia_et),
        'nombres': {k: nombres.get(k, k) for k in activos | set((viejo.get('liga') or {}).get('miembros') or [])},
    }


def _self_check():
    mal = 0

    def ok(c, t):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '🔴', t))

    print('\n══ LAS COMPETENCIAS DE LA SEMANA ══\n')
    fz = {'a': 70, 'b': 40, 'c': 55, 'd': 30}
    ok(abs(prob(50, 50) - 0.5) < 1e-9 and 0.75 < prob(75, 50) < 0.77, 'la probabilidad: pareja 50 %, 25 puntos de diferencia ~76 %')
    s1 = simular('a', 'b', 70, 40, 'sem', 'x')
    ok(s1 == simular('a', 'b', 70, 40, 'sem', 'x') and s1[0] in ('a', 'b'), 'simular es repetible: la misma semilla, el mismo resultado')
    gana_a = sum(simular('a', 'b', 70, 40, 'sem', i)[0] == 'a' for i in range(400))
    ok(285 < gana_a < 355, 'y respeta la probabilidad: el fuerte gana ~80 %% de 400 (%d)' % gana_a)
    reales = [('b', 'a', '500', '2026-10-20')]
    m = resolver('a', 'b', reales, False, fz, 's')
    ok(m['g'] == 'b' and m['como'] == 'real', 'si se cruzaron en cualquier evento, cuenta lo real (aunque el débil ganara)')
    ok(resolver('a', 'c', reales, False, fz, 's')['como'] == 'pend', 'sin cruzarse y con la semana abierta: pendiente')
    ok(resolver('a', 'c', reales, True, fz, 's')['como'] == 'sim', 'sin cruzarse y con la semana cerrada: simulado')
    gs = copa({'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'}, {}, fz, [], False, 's')
    ok(len(gs) == 2 and sorted(len(g['gente']) for g in gs) == [4, 5] and all(len(g['partidos']) == len(g['gente']) * (len(g['gente']) - 1) // 2 for g in gs),
       'nueve activos: dos grupos (4 y 5, sin grupos de uno), todos contra todos')
    cal = calendario(10)
    pares = {tuple(sorted(p)) for j in cal for p in j}
    ok(len(cal) == 9 and all(len(j) == 5 for j in cal) and len(pares) == 45, 'la liga de 10: 9 jornadas de 5, los 45 cruces una vez')
    r = rapid({'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'}, fz, '2026-10-26')
    ok(r and len(r['gente']) == 8 and r['campeon'] in r['gente'] and r == rapid({'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'}, fz, '2026-10-26'),
       'la Rapid del día: 8 sorteados, un campeón, y el mismo día da lo mismo')
    print('\n   %s' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return 1 if mal else 0


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if '--auto' in sys.argv:
        return _self_check()
    res = calcular()
    if '--ver' in sys.argv:
        n = res['nombres']
        print('Semana %s · día %d/7 · %d activos' % (res['sem'], res['dia'], res['activos']))
        print('\n🏆 Copa: %d grupos' % len(res['copa']))
        for g in res['copa'][:3]:
            print('  Grupo %s (división %d): %s' % (g['id'], g['div'] + 1, ', '.join('%s %d pts' % (n.get(x[0], x[0]), x[3]) for x in g['tabla'])))
        L = res['liga']
        print('\n🥇 Liga de 10: %s' % (', '.join(n.get(k, k) for k in L['miembros']) or 'faltan %s' % L.get('falta')))
        if res['rapid']:
            print('\n⚡ Rapid de hoy: campeón %s' % n.get(res['rapid']['campeon'], res['rapid']['campeon']))
        return 0
    with io.open(SALIDA, 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
    print('🏆 semana %s, día %d/7: %d activos · %d grupos de Copa · Liga de %d · Rapid %s' % (
        res['sem'], res['dia'], res['activos'], len(res['copa']), len(res['liga']['miembros']),
        'sí' if res['rapid'] else 'no'))
    return 0


if __name__ == '__main__':
    sys.exit(main())
