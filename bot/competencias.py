# -*- coding: utf-8 -*-
"""🏆 LAS COMPETENCIAS: las ligas por niveles con la Élite en paralelo, la Copa por grupos, las Rapid de la semana, los
mini eventos que rotan, el equipo de la semana y la ficha de cada jurado.

    python bot/competencias.py            calcula y escribe datos/competencias.json
    python bot/competencias.py --ver      cómo va la semana
    python bot/competencias.py --auto     self-check

Dlx, 26/10/2026: *«que hayan mini eventos pero que se note… podemos hacer una copa, para diferentes grupos… donde sea
se enfrenten, en cualquier servidor o evento, que eso cuente… EN CASO de que estos 2 no se peleen, se haría una
simulación»*, *«una liga con 10 personas»*, *«RAPID BATTLES»*, *«no todos ojo, evita incluir inactivos»*. Y mirando la
maqueta B: *«como Top Eleven… que tiene elite league, gold league, osea hay divisiones»*, *«tú puedes ser parte de la
league normal pero también de la elite league»*, *«todos [los mini eventos] pero agregar más que vayan rotando»*, *«un
score de cada jurado, basado en lo que ellos votan»*. Lo decidido: niveles Oro · Plata · Bronce · Ascenso con la Élite
paralela; temporadas de ligas de 3 semanas con cierre lunes, miércoles y viernes; Rapid de una semana con una ventana por
ronda; ficha de jurado pública.

LAS REGLAS
----------
- **La semana es la de las divisiones** (lunes a lunes, 11 AM ET: `multiplicadores.periodo()`).
- **Sólo activos**: jugó al menos un evento en los `ACTIVO_DIAS` días antes de arrancar. Quien no juega no ocupa un
  lugar que se simularía entero.
- **Cualquier 1v1 de cualquier evento de cualquier servidor cuenta** si los dos estaban cruzados en esa ventana (el
  último, si fueron varios). Si al cerrar la ventana no se cruzaron, se **simula**. Ganar da 3 puntos.
- **🥇 Las ligas**: una temporada son `JORNADAS` jornadas en `TEMP_SEMANAS` semanas (cierres lunes, miércoles y
  viernes). Niveles `NIVELES` con su `CUPO`; Ascenso se abre en las ligas que hagan falta. Al terminar, suben los
  `SUBEN` primeros de cada liga y bajan los `BAJAN` últimos; quien entra nuevo arranca en Ascenso.
- **⭐ La Élite**, en paralelo y con el mismo calendario: los 10 mejores del Competitivo activos al arrancar la
  temporada, y con la carta Competitiva (sin ella no se entra). Quien está en la Élite juega también su liga.
- **🏆 La Copa**: cada lunes, llaves de `COPA` a eliminación por división y fuerza: octavos, cuartos, semis y final.
- **⚡ Las Rapid**: cada lunes, todos los activos sorteados en llaves de `RAPID`; cuartos hasta el jueves, semis hasta el
  sábado, final hasta el lunes.
- **🎲 Mini eventos**: `MINI` por semana, sorteados del `CATALOGO` con la semana de semilla.
- **⚖️ Jurados**: la ficha de cada uno sale de quién votó a quién (`datos/jurados.json`), y en las simuladas se sortean
  tres que votan según su ficha (`jurado_sim()`).

⚖️ LA SIMULACIÓN ES REPETIBLE Y EXPLICABLE. La fuerza de cada uno es su ELO (`bot/elo.py`) AL ARRANQUE de la semana
—el de la temporada de ligas, para las ligas—, así no cambia a mitad de semana. La probabilidad de que A le gane a B es
logística en la diferencia (`ESCALA`), y la moneda sale de un SHA-256 de la semilla y el cruce: lo mismo da siempre lo
mismo, y cualquiera puede rehacer la cuenta. Nunca se inventa un resultado real.

📈 POR QUÉ EL ELO (Dlx, 26/10/2026: *«la idea es que ahí sólo se enfrenten gente de su propio nivel»*, *«siii»*). Era el
Score competitivo, que pide 10 eventos y dejaba al resto en un piso según su puesto en la Temporada: Walker, Deluxe y
Juasmio están en el top 12 del ELO sin rango. Y las Rapid eran un sorteo entre todos los activos; ahora son grupos de
ELO parecido (`rapids()`).
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
#: cuántos puntos de fuerza son «10 a 1». Con el Score era 50 (25 daba 98 % a Oasis contra Makmah: en el freestyle los
#: batacazos pasan); con el ELO es la escala de siempre, 400 (26/10/2026). En la T1 el ELO va de ~890 a ~1240, así que
#: el cruce más disparejo queda en ~88 %, lo mismo que con el Score
ESCALA = 400.0
#: quien no tiene ni un 1v1 todavía: con lo que arranca cualquiera
SIN_ELO = 1000.0
#: las 8 de una Rapid: el 1 contra el 8, el 4 contra el 5…, así los dos mejores sólo se cruzan en la final
SIEMBRA8 = (0, 7, 3, 4, 2, 5, 1, 6)
LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
#: la Copa: llaves de 16, y el orden de siembra (el 1 contra el 16, el 8 contra el 9…), así los dos mejores sólo se
#: cruzan en la final
COPA = 16
SIEMBRA = (0, 15, 7, 8, 4, 11, 3, 12, 2, 13, 5, 10, 6, 9, 1, 14)
#: los niveles de las ligas, de arriba abajo, y cuánta gente entra en cada uno (Ascenso: todo el resto)
NIVELES = ('oro', 'plata', 'bronce', 'ascenso')
CUPO = {'oro': 10, 'plata': 20, 'bronce': 40}
SUBEN = BAJAN = 2
JORNADAS = 9
TEMP_SEMANAS = 3
#: los cierres de cada semana, en días desde el lunes: miércoles, viernes y el lunes siguiente
CORTES = (2, 4, 7)
#: cuántos mini eventos abiertos por semana
MINI = 4
#: desde cuántos votos un jurado tiene nota
JURADO_MIN = 5


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


def fuerzas(llaves, hasta):
    """`{norm: fuerza}`: el ELO de cada uno con los 1v1 de antes de `hasta` (`bot/elo.py`). Quien no está, `SIN_ELO`."""
    import elo as EL
    return {k: float(v['elo']) for k, v in EL.calcular(llaves, hasta).items()}


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
    fa, fb = fz.get(a, SIN_ELO), fz.get(b, SIN_ELO)
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


def partir(orden, maximo):
    """`orden` en grupos de hasta `maximo`, PAREJOS: 300 en grupos de 8 son 34 de 8 y 4 de 7, no 37 de 8 y uno de 4
    (que era lo que daba cortar de a `ceil(300 / 38)`: el último grupo, con la mitad de pases libres)."""
    if not orden:
        return []
    n = math.ceil(len(orden) / float(maximo))
    base, sobra = divmod(len(orden), n)
    out, i = [], 0
    for j in range(n):
        t = base + (1 if j < sobra else 0)
        out.append(orden[i:i + t])
        i += t
    return out


def armadas(viejo, sem, que):
    """Las llaves de `que` ('copa' | 'rapid') que esta semana YA tiene armadas: `[[lugares]]`, sacados de la primera
    ronda (con los pases libres como ''). Una llave publicada no se rearma a mitad de semana aunque cambie la fuerza
    —el ELO, o la regla para armarla—: se rearma el lunes siguiente."""
    if str((viejo or {}).get('sem')) != str(sem):
        return None
    out = []
    for r in viejo.get(que) or []:
        ps = ((r.get('rondas') or [{}])[0]).get('partidos') or []
        out.append([x for m in ps for x in (m.get('a') or '', m.get('b') or '')])
    return out or None


def copa(activos, niveles, fz, ini, fin, llaves, ahora, sem, fijas=None):
    """🏆 LA COPA DE LA SEMANA, A ELIMINACIÓN (Dlx, 26/10/2026: «la copa es un torneo de octavos»): los activos, por su
    división y su fuerza, en llaves de `COPA` (octavos, cuartos, semis y final, una ventana cada una). Las llaves salen
    parejas en tamaño; las que no llegan a 16 llevan pases libres para los mejores sembrados, como en cualquier copa."""
    if fijas:
        todas = fijas
    else:
        orden = sorted(activos, key=lambda k: (niveles.get(k, 5), -fz.get(k, SIN_ELO), k))
        todas = []
        for g in partir(orden, COPA):
            g = sorted(g, key=lambda k: (-fz.get(k, SIN_ELO), k))
            todas.append([g[s_] if s_ < len(g) else '' for s_ in SIEMBRA])
    lims = [ini, dias_despues(ini, 2), dias_despues(ini, 4), dias_despues(ini, 6), fin]
    out = []
    for i, slots in enumerate(todas):
        g = [k for k in slots if k]
        r = llave(slots, lims, ('Octavos', 'Cuartos', 'Semifinal', 'Final'), llaves, fz, ahora, sem, 'copa', i)
        r.update(id=LETRAS[i % 26] + ('' if i < 26 else str(i // 26)), div=min(niveles.get(k, 5) for k in g))
        out.append(r)
    return out


# ── el calendario en hora del este ────────────────────────────────────────────────────────────────────────────────

def _et():
    from zoneinfo import ZoneInfo
    return ZoneInfo('America/New_York')


def dias_despues(t, dias):
    """`t` + `dias` días a las 11 AM ET (el corte de la semana), aunque en el medio cambie el horario de verano."""
    loc = t.astimezone(_et()) + dt.timedelta(days=dias)
    return loc.replace(hour=11, minute=0, second=0, microsecond=0).astimezone(dt.timezone.utc)


def cierres(desde):
    """Los `JORNADAS` cierres de una temporada de ligas: lunes, miércoles y viernes a las 11 AM ET, tres semanas."""
    return [dias_despues(desde, 7 * w + d) for w in range(TEMP_SEMANAS) for d in CORTES][:JORNADAS]


def ventanas(desde):
    """`[(ini, fin)]` de cada jornada: lo que se cruce adentro cuenta para esa jornada."""
    cs = cierres(desde)
    return list(zip([desde] + cs[:-1], cs))


# ── las ligas por niveles y la Élite ──────────────────────────────────────────────────────────────────────────────

def calendario(n):
    """El todos contra todos de `n`: `n-1` jornadas de `n/2` cruces (método del círculo). Con `n` impar entra un `None`
    —el que le toca descansa— y son `n` jornadas."""
    xs = list(range(n)) + ([None] if n % 2 else [])
    m = len(xs)
    out = []
    for _r in range(m - 1):
        out.append([(xs[i], xs[m - 1 - i]) for i in range(m // 2)])
        xs = [xs[0]] + [xs[-1]] + xs[1:-1]
    return out


def jugar_liga(gente, desde, llaves, fz, ahora, *semilla):
    """`(jornadas, tabla)` de una liga: una jornada por ventana, real si se cruzaron adentro, simulada al cerrar."""
    cal = calendario(len(gente))
    jornadas, todos = [], []
    for j, (ini, fin) in enumerate(ventanas(desde)):
        if j >= len(cal):
            break
        reales = cruces(llaves, ini, fin)
        cerrada = ahora >= fin
        ps = [resolver(gente[a], gente[b], reales, cerrada, fz, *semilla, j) for a, b in cal[j] if a is not None and b is not None]
        jornadas.append({'n': j + 1, 'fin': fin.isoformat(), 'partidos': ps})
        todos += ps
    return jornadas, tabla(gente, todos, fz)


def repartir(gente, n):
    """`gente` (de mejor a peor) en `n` ligas parejas, en serpiente: 1-2-3-3-2-1…"""
    ls = [[] for _ in range(max(1, n))]
    for i, k in enumerate(gente):
        r, c = divmod(i, len(ls))
        ls[c if r % 2 == 0 else len(ls) - 1 - c].append(k)
    return [x for x in ls if x]


def armar_grupos(orden):
    """`orden`: todos, del primero al último (ya con subidas y bajadas). Llena Oro, Plata y Bronce hasta su `CUPO` y el
    resto va a Ascenso, todos en ligas de ~`LIGA`."""
    out, i = [], 0
    for nv in NIVELES:
        cupo = CUPO.get(nv)
        xs = orden[i:i + cupo] if cupo else orden[i:]
        i += len(xs)
        if not xs:
            continue
        for j, g in enumerate(repartir(xs, max(1, math.ceil(len(xs) / LIGA)) if not cupo else max(1, cupo // LIGA))):
            out.append({'id': '%s-%d' % (nv, j + 1), 'nivel': nv, 'gente': g})
    return out


def mover(grupos, tablas, activos, fz):
    """El orden de la temporada que viene: suben los `SUBEN` primeros de cada liga, bajan los `BAJAN` últimos, y quien
    entra nuevo arranca en Ascenso. Quien ya no está activo sale."""
    clave = {}
    for g in grupos:
        i = NIVELES.index(g['nivel'])
        t = tablas.get(g['id']) or []
        n = len(t)
        for pos, fila in enumerate(t, 1):
            k = fila[0]
            obj = i
            if pos <= SUBEN and i > 0:
                obj = i - 1
            elif n >= 6 and pos > n - BAJAN and i < len(NIVELES) - 1:
                obj = i + 1
            clave[k] = (obj, pos, -fila[3], -fz.get(k, SIN_ELO))
    for k in activos:
        clave.setdefault(k, (len(NIVELES) - 1, 99, 0, -fz.get(k, SIN_ELO)))
    return [k for k in sorted(clave, key=lambda k: (clave[k], k)) if k in activos]


def elite_de(activos):
    """⭐ La Élite: los `LIGA` mejores del Competitivo, activos y CON LA CARTA COMPETITIVA (Dlx, 26/10/2026: «para liga
    élite uno tiene que tener la tarjeta competitiva sí o sí para participar»). La carta se mira en el inventario de R2
    (`datos/cartas_r2.json`); sin inventario —un runner sin datos— no se filtra, antes que dejar la Élite vacía."""
    from comun.claves import clave
    r2 = _j('datos', 'cartas_r2.json', defecto={}) or {}
    con = {k for k, cs in r2.items() if isinstance(cs, dict) and 'competitivo' in cs}
    comp = sorted(((norm(c['raw']), float(c.get('score') or 0), clave(c['raw']))
                   for c in (_j('datos', 'competitivo_pool.json', defecto=[]) or [])
                   if c.get('raw') and (c.get('ev') or 0) >= 10), key=lambda x: -x[1])
    return [k for k, _s, kr in comp if k in activos and (not con or kr in con)][:LIGA]


def ligas(viejo, llaves, ahora):
    """La temporada de ligas: las ligas por niveles y la Élite en paralelo. Las arma la primera vez (por fuerza) y al
    terminar cada temporada (con las subidas y bajadas de la anterior); en el medio, la gente queda fija. La fuerza es
    el ELO al arranque de ESA temporada: con el de la semana, una jornada simulada ya cerrada podía cambiar de ganador."""
    import multiplicadores as MU
    v = viejo or {}
    if v.get('desde') and v.get('grupos'):
        desde = dt.datetime.fromisoformat(v['desde'])
        grupos, elite, temp = v['grupos'], v.get('elite') or [], int(v.get('temp') or 1)
        fz = fuerzas(llaves, desde)
    else:
        # la primera: con la semana en curso si arrancó hace menos de un día, si no con la que viene
        _s, ini, fin = MU.periodo(ahora)
        desde = ini if ahora - ini < dt.timedelta(days=1) else fin
        act = set(jugaron(llaves, desde - dt.timedelta(days=ACTIVO_DIAS), desde))
        fz = fuerzas(llaves, desde)
        grupos = armar_grupos(sorted(act, key=lambda k: (-fz.get(k, SIN_ELO), k)))
        elite, temp = elite_de(act), 1
    while ahora >= dias_despues(desde, 7 * TEMP_SEMANAS):
        tablas = {g['id']: jugar_liga(g['gente'], desde, llaves, fz, desde + dt.timedelta(days=99), 'liga', temp, g['id'])[1]
                  for g in grupos}
        desde = dias_despues(desde, 7 * TEMP_SEMANAS)
        act = set(jugaron(llaves, desde - dt.timedelta(days=ACTIVO_DIAS), desde))
        grupos = armar_grupos(mover(grupos, tablas, act, fz))
        elite, temp = elite_de(act), temp + 1
        fz = fuerzas(llaves, desde)
    out = {'temp': temp, 'desde': desde.isoformat(), 'hasta': dias_despues(desde, 7 * TEMP_SEMANAS).isoformat(),
           'cierres': [c.isoformat() for c in cierres(desde)],
           'jornada': min(JORNADAS, 1 + sum(1 for c in cierres(desde) if ahora >= c)),
           'grupos': [], 'elite': elite}
    for g in grupos:
        js, t = jugar_liga(g['gente'], desde, llaves, fz, ahora, 'liga', temp, g['id'])
        out['grupos'].append(dict(g, jornadas=js, tabla=t))
    if len(elite) >= 4:
        js, t = jugar_liga(elite, desde, llaves, fz, ahora, 'elite', temp)
        out['liga_elite'] = {'gente': elite, 'jornadas': js, 'tabla': t}
    return out


# ── la Rapid de la semana ─────────────────────────────────────────────────────────────────────────────────────────

def llave(gente, lims, nombres, llaves, fz, ahora, *semilla):
    """Una llave a eliminación con una ventana por ronda (`lims`: el arranque y el cierre de cada una). `gente` son los
    lugares en orden; un lugar vacío es un pase libre (`como: 'pase'`)."""
    rondas, vivos = [], list(gente)
    for r, nombre in enumerate(nombres):
        a0, a1 = lims[r], lims[r + 1]
        reales = cruces(llaves, a0, a1)
        ps = []
        for i in range(0, len(vivos), 2):
            a, b = vivos[i], vivos[i + 1]
            if r == 0 and (not a or not b):
                ps.append({'a': a, 'b': b, 'g': a or b, 'como': 'pase', 'p': 1.0 if a else 0.0})
            elif not a or not b:
                ps.append({'a': a, 'b': b, 'g': '', 'como': 'pend', 'p': 0.5})
            else:
                ps.append(resolver(a, b, reales, ahora >= a1, fz, *semilla, nombre))
        rondas.append({'r': nombre, 'hasta': a1.isoformat(), 'partidos': ps})
        vivos = [m['g'] for m in ps]
    return {'gente': [k for k in gente if k], 'rondas': rondas, 'campeon': vivos[0] if vivos and vivos[0] else ''}


def llave8(gente, ini, fin, llaves, fz, ahora, *semilla):
    """Una llave de 8 de la semana: cuartos hasta el jueves, semis hasta el sábado, final hasta el lunes."""
    lims = [ini, dias_despues(ini, 3), dias_despues(ini, 5), fin]
    return llave(gente, lims, ('Cuartos', 'Semifinal', 'Final'), llaves, fz, ahora, *semilla)


def rapids(activos, ini, fin, llaves, fz, ahora, sid, fijas=None):
    """Las Rapid de la semana, EN GRUPOS DE NIVEL (Dlx, 26/10/2026: *«que ahí sólo se enfrenten gente de su propio
    nivel»*): los activos por ELO, de a `RAPID` parecidos, sembrados para que los dos mejores del grupo sólo se crucen en
    la final. Los grupos salen parejos en tamaño y el que no llega a 8 lleva pases libres para los mejores sembrados:
    antes era un sorteo entre todos, un E podía caer contra un SS, y los que sobraban esperaban a la semana siguiente."""
    if fijas:
        todas = fijas
    else:
        orden = sorted(activos, key=lambda k: (-fz.get(k, SIN_ELO), k))
        todas = [[g[s_] if s_ < len(g) else '' for s_ in SIEMBRA8] for g in partir(orden, RAPID)] if len(orden) >= 2 else []
    out = []
    for i, slots in enumerate(todas):
        r = llave8(slots, ini, fin, llaves, fz, ahora, sid, 'rapid', i)
        r['id'] = 'R%d' % (i + 1)
        out.append(r)
    return out


# ── los mini eventos que rotan ────────────────────────────────────────────────────────────────────────────────────

#: el catálogo; `None` en la función es «pronto» (todavía no se puede calcular solo)
CATALOGO = [('derbi', '⚔️', 'Guerra de servidores'), ('paises', '🌎', 'Guerra de países'), ('meta', '🤝', 'Meta de la Liga'),
            ('supercopa', '🏆', 'Supercopa'),
            ('duos', '👯', 'Dúos'), ('pandillas', '👥', 'Pandillas'), ('rey', '👑', 'Rey de la colina'),
            ('revancha', '🔁', 'Revancha'), ('racha', '🔥', 'Racha'), ('novatos', '🌱', 'Copa de novatos'),
            ('escalera', '🪜', 'La Escalera'), ('fantasy', '🎯', 'Fantasy'), ('crews', '🛡️', 'Torneo de crews')]
PRONTO = ('escalera', 'fantasy', 'crews')


def puntos_semana(llaves, ini, fin):
    """`{norm: puntos de Temporada}` de los eventos de la semana."""
    out = {}
    for ev in llaves.values():
        t = _dia_utc(ev.get('dia'))
        if t is None or not (ini <= t < fin):
            continue
        for nombre, _p, pts in ev.get('tabla') or []:
            ps = personas(nombre)
            for p in ps:
                out[norm(p)] = out.get(norm(p), 0) + int((pts or 0) / max(1, len(ps)))
    return out


def mini_eventos(sid, ini, fin, activos, llaves, fz, ahora, L):
    """Los `MINI` de esta semana, sorteados del catálogo con la semana de semilla; cada uno con lo que muestra."""
    reales = cruces(llaves, ini, fin)
    cerrada = ahora >= fin
    pts = puntos_semana(llaves, ini, fin)
    pool = _j('datos', 'temporada_pool.json', defecto=[]) or []
    sv_de = {norm(x['raw']): x.get('sv') or '' for x in pool if x.get('raw')}
    cc_de = {norm(x['raw']): str(x.get('cc') or '').lower() for x in pool if x.get('raw')}

    def guerra(de, id_):
        """⚔️ Dos bandos (servidores o países) sorteados entre los que tienen 5 activos: sus 5 mejores, uno contra uno.
        Dlx, 26/10/2026: «eso de guerra de servidores está bueno… guerra de países también»."""
        por = {}
        for k in activos:
            if de.get(k):
                por.setdefault(de[k], []).append(k)
        lados = sorted((s for s, xs in por.items() if len(xs) >= 5), key=lambda s: moneda(id_, sid, s))[:2]
        if len(lados) < 2:
            return None
        a, b = [sorted(por[s], key=lambda k: -fz.get(k, SIN_ELO))[:5] for s in lados]
        ps = [resolver(x, y, reales, cerrada, fz, sid, id_, i) for i, (x, y) in enumerate(zip(a, b))]
        return {'svs': lados, 'partidos': ps, 'score': [sum(m['g'] == m['a'] for m in ps), sum(m['g'] == m['b'] for m in ps)]}

    def derbi():
        return guerra(sv_de, 'derbi')

    def paises():
        return guerra(cc_de, 'paises')

    def meta():
        antes = len(cruces(llaves, ini - dt.timedelta(days=7), ini))
        return {'n': len(reales), 'objetivo': max(50, int(math.ceil(antes * 1.1 / 10.0)) * 10)}

    def supercopa():
        e = (L.get('liga_elite') or {}).get('tabla') or []
        oro = next((g['tabla'] for g in L.get('grupos') or [] if g['nivel'] == 'oro'), [])
        a = e[0][0] if e else ''
        b = next((x[0] for x in oro if x[0] != a), '')
        if not a or not b:
            return None
        return {'partido': resolver(a, b, reales, cerrada, fz, sid, 'supercopa')}

    def equipos(n):
        orden = sorted(activos, key=lambda k: moneda('eq', n, sid, k))
        gs = [orden[i:i + n] for i in range(0, len(orden) - n + 1, n)]
        t = sorted(([g, sum(pts.get(k, 0) for k in g)] for g in gs), key=lambda x: (-x[1], x[0]))
        return {'tabla': t[:10], 'n': len(gs)}

    def rey():
        r = max(activos, key=lambda k: (fz.get(k, SIN_ELO), k)) if activos else ''
        defensas, hist = 0, [r]
        for g, p, _n, _d in reales:
            if p == r:
                r, defensas = g, 0
                hist.append(r)
            elif g == r:
                defensas += 1
        return {'rey': r, 'defensas': defensas, 'reyes': hist[-6:]} if r else None

    def revancha():
        previos = cruces(llaves, ini - dt.timedelta(days=60), ini)
        ultima = {}
        for g, p, _n, _d in previos:
            ultima[p] = g
        hechas = sorted({(g, p) for g, p, _n, _d in reales if ultima.get(g) == p})
        return {'hechas': [list(x) for x in hechas], 'pendientes': sum(1 for k in activos if k in ultima)}

    def racha():
        cur, mejor = {}, {}
        for g, p, _n, _d in reales:
            cur[g] = cur.get(g, 0) + 1
            cur[p] = 0
            mejor[g] = max(mejor.get(g, 0), cur[g])
        return {'tabla': sorted(([k, n] for k, n in mejor.items()), key=lambda x: (-x[1], x[0]))[:5]}

    def novatos():
        eventos = {}
        for ev in llaves.values():
            for nombre, _p, _x in ev.get('tabla') or []:
                for p in personas(nombre):
                    eventos[norm(p)] = eventos.get(norm(p), 0) + 1
        nov = sorted((k for k in activos if eventos.get(k, 0) < 5), key=lambda k: moneda('novatos', sid, k))
        if len(nov) < RAPID:
            return None
        return llave8(nov[:RAPID], ini, fin, llaves, fz, ahora, sid, 'novatos')

    hacer = {'derbi': derbi, 'paises': paises, 'meta': meta, 'supercopa': supercopa, 'duos': lambda: equipos(2), 'pandillas': lambda: equipos(5),
             'rey': rey, 'revancha': revancha, 'racha': racha, 'novatos': novatos}
    out = []
    for id_, ic, nombre in sorted(CATALOGO, key=lambda c: moneda('mini', sid, c[0])):
        if id_ in PRONTO or len(out) >= MINI:
            continue
        x = hacer[id_]()
        if x:
            out.append(dict(x, id=id_, ic=ic, nombre=nombre))
    return out, [[i, ic, n] for i, ic, n in CATALOGO if i in PRONTO]


def proxima_semana(sid_prox, hoy):
    """⏳ Los que abren la semana que viene (Dlx, 26/10/2026: «para lo que dice pronto, crear un countdown… abre en X»):
    el mismo sorteo con la semilla de la semana que viene, sin los que ya están abiertos esta."""
    ya = {x['id'] for x in hoy}
    orden = [c for c in sorted(CATALOGO, key=lambda c: moneda('mini', sid_prox, c[0])) if c[0] not in PRONTO]
    return [[i, ic, n] for i, ic, n in orden if i not in ya][:MINI]


# ── el equipo de la semana y los jurados ──────────────────────────────────────────────────────────────────────────

def equipo_semana(llaves, notas, ini, fin):
    """Las 5 mejores notas promedio de la semana (reales), la primera es el MVP."""
    xs = {}
    for n, ev in llaves.items():
        t = _dia_utc(ev.get('dia'))
        if t is None or not (ini <= t < fin):
            continue
        for nombre, nota in ((notas.get(str(n)) or {}).get('notas') or {}).items():
            xs.setdefault(norm(nombre), []).append(nota)
    t = sorted(([k, round(sum(v) / len(v), 1), len(v)] for k, v in xs.items()), key=lambda x: (-x[1], -x[2], x[0]))
    return t[:5]


def jurados(fz):
    """⚖️ LA FICHA DE CADA JURADO, PÚBLICA (Dlx, 26/10/2026: «un score de cada jurado, basado en lo que ellos votan… a
    quién votan más, menos», y «sí, que sea para el público»), de `datos/jurados.json` (`escuchar.votos_jurados()`):
    `{jurado: {n, votos, coincide, favorito, propio, mas, menos, nota}}`. `coincide`: cuántas veces votó lo mismo que la
    mayoría; `favorito`: cuántas veces al de más fuerza; `propio`: cuántas a la gente de su servidor, cuando había uno
    solo; `nota` 1–10, desde `JURADO_MIN` votos (antes no hay con qué)."""
    J = _j('datos', 'jurados.json', defecto={}) or {}
    sv_de = {norm(x['raw']): x.get('sv') or '' for x in (_j('datos', 'temporada_pool.json', defecto=[]) or []) if x.get('raw')}
    st = {}
    for b in (J.get('votos') or {}).values():
        # ⚖️ una batalla es `a`/`b` con votos 'a'|'b', o —las de 3 a 5 MCs de FFA, `escuchar.votos_en_vivo()`— `lados`
        # con el nombre votado. Todo se lleva al nombre: así las dos se cuentan igual
        lados = b.get('lados') or [b.get('a') or '', b.get('b') or '']
        v = {q: (lados[0] if x == 'a' else lados[1] if x == 'b' else x) for q, x in (b.get('v') or {}).items()}
        cuenta = {}
        for x in v.values():
            cuenta[x] = cuenta.get(x, 0) + 1
        top = sorted(cuenta.items(), key=lambda kv: -kv[1])
        may = top[0][0] if top and (len(top) == 1 or top[0][1] > top[1][1]) else ''
        fs = [fz.get(norm(x)) for x in lados]
        fav = lados[fs.index(max(fs))] if None not in fs and fs.count(max(fs)) == 1 else ''
        casa_de = [x for x in lados if sv_de.get(norm(x)) == b.get('sv')]
        casa = casa_de[0] if len(casa_de) == 1 else ''
        for quien, lado in v.items():
            s = st.setdefault(quien, {'votos': 0, 'may': [0, 0], 'fav': [0, 0], 'casa': [0, 0], 'por': {}, 'contra': {}})
            s['votos'] += 1
            if may:
                s['may'][1] += 1
                s['may'][0] += lado == may
            if fav:
                s['fav'][1] += 1
                s['fav'][0] += lado == fav
            if casa:
                s['casa'][1] += 1
                s['casa'][0] += lado == casa
            s['por'][lado] = s['por'].get(lado, 0) + 1
            for no in lados:
                if no != lado:
                    s['contra'][no] = s['contra'].get(no, 0) + 1
    out = {}
    nombres = J.get('nombres') or {}
    for quien, s in st.items():
        r = lambda x: round(x[0] / x[1], 3) if x[1] else None   # noqa: E731
        co = r(s['may'])
        top = lambda d: list(max(d.items(), key=lambda kv: (kv[1], kv[0]))) if d else None   # noqa: E731
        out[quien] = {'n': nombres.get(quien, ''), 'votos': s['votos'], 'coincide': co, 'favorito': r(s['fav']),
                      'propio': r(s['casa']), 'mas': top(s['por']), 'menos': top(s['contra']),
                      'nota': round(1 + 9 * co, 1) if co is not None and s['votos'] >= JURADO_MIN else None}
    return out


def jurado_sim(m, jueces, J, *semilla):
    """⚖️ El jurado de una batalla SIMULADA (Dlx, 26/10/2026: «seleccionar el staff de la batalla a lo random así
    también simulamos el staff»): tres jueces sorteados de los que tienen ficha. Cuanto más pareja, más probable el 2–1;
    y el que vota en contra es el que menos coincide con la mayoría en su ficha. Repetible, como todo."""
    if m.get('como') != 'sim' or len(jueces) < 3:
        return m
    tres = sorted(jueces, key=lambda q: moneda('jurado', *semilla, m['a'], m['b'], q))[:3]
    g = 'a' if m['g'] == m['a'] else 'b'
    otro = 'b' if g == 'a' else 'a'
    dividido = moneda('split', *semilla, m['a'], m['b']) < 1 - abs(m['p'] - 0.5) * 2
    contra = min(tres, key=lambda q: ((J.get(q) or {}).get('coincide') or 0, q)) if dividido else None
    return dict(m, j=[[q, otro if q == contra else g] for q in tres])


# ── todo junto ────────────────────────────────────────────────────────────────────────────────────────────────────

_SIMS = ('copa', 'grupos', 'elite', 'rapid', 'mini')


def _con_jurado(res, jueces, J):
    """Le pone su jurado sorteado a cada batalla simulada del resultado (ver `jurado_sim()`)."""
    def pasar(ps, *sem):
        return [jurado_sim(m, jueces, J, *sem) for m in ps]
    L = res['ligas']
    for g in L['grupos'] + ([L['liga_elite']] if L.get('liga_elite') else []):
        for j in g['jornadas']:
            j['partidos'] = pasar(j['partidos'], L['temp'], g.get('id', 'elite'), j['n'])
    for r in res['copa'] + res['rapid'] + [x for x in res['mini'] if x['id'] == 'novatos']:
        for rd in r['rondas']:
            rd['partidos'] = pasar(rd['partidos'], res['sem'], r.get('id', 'novatos'), rd['r'])
    for x in res['mini']:
        if x.get('partidos'):
            x['partidos'] = pasar(x['partidos'], res['sem'], x['id'])
        if x.get('partido'):
            x['partido'] = pasar([x['partido']], res['sem'], x['id'])[0]
    return res


def calcular(ahora=None, llaves=None, notas=None, viejo=None):
    import multiplicadores as MU
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    llaves = llaves if llaves is not None else (_j('datos', 'llaves_t1.json', defecto={}) or {})
    notas = notas if notas is not None else (_j('datos', 'notas_eventos.json', defecto={}) or {})
    viejo = viejo if viejo is not None else (_j('datos', 'competencias.json', defecto={}) or {})
    sid, ini, fin = MU.periodo(ahora)
    sid = str(sid)
    fz = fuerzas(llaves, ini)
    activos = set(jugaron(llaves, ini - dt.timedelta(days=ACTIVO_DIAS), ini))
    niveles = {norm(k): v for k, v in ((_j('datos', 'divisiones.json', defecto={}) or {}).get('nivel') or {}).items()}
    reales = cruces(llaves, ini, fin)
    L = ligas(viejo.get('ligas'), llaves, ahora)
    mini, pronto = mini_eventos(sid, ini, fin, activos, llaves, fz, ahora, L)
    J = jurados(fz)
    jueces = sorted(q for q, s in J.items() if s['votos'] >= 3)
    nombres = {}
    for ev in llaves.values():
        for nombre, _p, _x in ev.get('tabla') or []:
            for p in personas(nombre):
                nombres.setdefault(norm(p), p)
    res = {
        '_leeme': 'Las competencias: las arma bot/competencias.py. Las reglas viven en ese archivo.',
        'sem': sid, 'ini': ini.isoformat(), 'fin': fin.isoformat(),
        'dia': min(7, max(1, int((ahora - ini).total_seconds() // 86400) + 1)),
        'activos': len(activos),
        'copa': copa(activos, niveles, fz, ini, fin, llaves, ahora, sid, armadas(viejo, sid, 'copa')),
        'ligas': L,
        'rapid': rapids(activos, ini, fin, llaves, fz, ahora, sid, armadas(viejo, sid, 'rapid')),
        'mini': mini, 'pronto': pronto,
        'proxima': proxima_semana(str(MU.periodo(fin + dt.timedelta(hours=1))[0]), mini),
        'equipo': equipo_semana(llaves, notas, ini, fin),
        'jurados': J,
    }
    _con_jurado(res, jueces, J)
    usados = set(activos) | {k for g in L['grupos'] for k in g['gente']} | set(L.get('elite') or [])
    res['nombres'] = {k: nombres.get(k, k) for k in usados | {k for k, *_x in res['equipo']}}
    return res


def _self_check():
    mal = 0

    def ok(c, t):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '🔴', t))

    print('\n══ LAS COMPETENCIAS ══\n')
    fz = {'a': 70, 'b': 40, 'c': 55, 'd': 30}
    ok(abs(prob(1000, 1000) - 0.5) < 1e-9 and 0.75 < prob(1200, 1000) < 0.77, 'la probabilidad: pareja 50 %, 200 de ELO de diferencia ~76 %')
    s1 = simular('a', 'b', 1240, 1000, 'sem', 'x')
    ok(s1 == simular('a', 'b', 1240, 1000, 'sem', 'x') and s1[0] in ('a', 'b'), 'simular es repetible: la misma semilla, el mismo resultado')
    gana_a = sum(simular('a', 'b', 1240, 1000, 'sem', i)[0] == 'a' for i in range(400))
    ok(285 < gana_a < 355, 'y respeta la probabilidad: el fuerte gana ~80 %% de 400 (%d)' % gana_a)
    reales = [('b', 'a', '500', '2026-10-20')]
    m = resolver('a', 'b', reales, False, fz, 's')
    ok(m['g'] == 'b' and m['como'] == 'real', 'si se cruzaron en cualquier evento, cuenta lo real (aunque el débil ganara)')
    ok(resolver('a', 'c', reales, False, fz, 's')['como'] == 'pend', 'sin cruzarse y con la ventana abierta: pendiente')
    ok(resolver('a', 'c', reales, True, fz, 's')['como'] == 'sim', 'sin cruzarse y con la ventana cerrada: simulado')
    lunes0 = dt.datetime(2026, 10, 26, 15, 0, tzinfo=dt.timezone.utc)
    gente = {'p%02d' % i for i in range(20)}
    gs = copa(gente, {}, {k: 100 - int(k[1:]) for k in gente}, lunes0, dias_despues(lunes0, 7), {}, lunes0 + dt.timedelta(days=8), 's')
    ok(len(gs) == 2 and sorted(len(g['gente']) for g in gs) == [10, 10] and [x['r'] for x in gs[0]['rondas']] == ['Octavos', 'Cuartos', 'Semifinal', 'Final'],
       'la Copa: 20 activos, dos llaves parejas de 10, de octavos a la final')
    ok(sum(1 for m in gs[0]['rondas'][0]['partidos'] if m['como'] == 'pase') == 6 and all(g['campeon'] for g in gs),
       'con pases libres para los mejores sembrados, y cada llave con su campeón al cerrar')
    cal = calendario(10)
    ok(len(cal) == 9 and all(len(j) == 5 for j in cal) and len({tuple(sorted(p)) for j in cal for p in j}) == 45,
       'una liga de 10: 9 jornadas de 5, los 45 cruces una vez')
    c9 = calendario(9)
    ok(len(c9) == 9 and sum(1 for j in c9 for a, b in j if a is not None and b is not None) == 36,
       'una de 9: 9 jornadas, uno descansa en cada una, los 36 cruces')
    lunes = dt.datetime(2026, 10, 26, 15, 0, tzinfo=dt.timezone.utc)
    cs = cierres(lunes)
    ok(len(cs) == 9 and cs[0].strftime('%a') == 'Wed' and cs[1].strftime('%a') == 'Fri' and cs[2].strftime('%a') == 'Mon',
       'la temporada de ligas: 9 cierres, miércoles · viernes · lunes')
    ok(cs[-1].astimezone(_et()).hour == 11 and cs[0].astimezone(_et()).hour == 11,
       'y siempre a las 11 AM ET, también después del cambio de horario (%s)' % cs[-1].isoformat())
    gr = armar_grupos(['p%02d' % i for i in range(95)])
    ok([g['nivel'] for g in gr].count('oro') == 1 and [g['nivel'] for g in gr].count('plata') == 2
       and [g['nivel'] for g in gr].count('bronce') == 4 and all(len(g['gente']) <= 10 for g in gr)
       and sum(len(g['gente']) for g in gr) == 95, '95 personas: 1 de Oro, 2 de Plata, 4 de Bronce y el resto en Ascenso')
    t_oro = [['o%d' % i, 9, 9 - i, 27 - 3 * i] for i in range(10)]
    t_pla = [['p%d' % i, 9, 9 - i, 27 - 3 * i] for i in range(10)]
    grs = [{'id': 'oro-1', 'nivel': 'oro', 'gente': [x[0] for x in t_oro]}, {'id': 'plata-1', 'nivel': 'plata', 'gente': [x[0] for x in t_pla]}]
    nuevo = mover(grs, {'oro-1': t_oro, 'plata-1': t_pla}, {x[0] for x in t_oro + t_pla} | {'nuevo'}, {})
    ok('p0' in nuevo[:10] and 'p1' in nuevo[:10] and 'o9' not in nuevo[:10] and 'o8' not in nuevo[:10] and nuevo[-1] == 'nuevo',
       'al cerrar: suben los 2 primeros de Plata, bajan los 2 últimos de Oro, el nuevo arranca abajo')
    r = llave8(list('abcdefgh'), lunes, dias_despues(lunes, 7), {}, fz, lunes + dt.timedelta(days=8), 's')
    ok(r['campeon'] in 'abcdefgh' and [x['r'] for x in r['rondas']] == ['Cuartos', 'Semifinal', 'Final'],
       'una Rapid de la semana, toda cerrada: tres rondas y un campeón')
    r2 = llave8(list('abcdefgh'), lunes, dias_despues(lunes, 7), {}, fz, lunes + dt.timedelta(days=1), 's')
    ok(all(m['como'] == 'pend' for m in r2['rondas'][0]['partidos']) and not r2['campeon'],
       'y el martes, con los cuartos abiertos: todo pendiente, sin campeón')
    ok([len(g) for g in partir(list(range(300)), 8)] == [8] * 34 + [7] * 4 and [len(g) for g in partir(list(range(20)), 8)] == [7, 7, 6],
       'partir sale parejo: 300 en grupos de 8 son 34 de 8 y 4 de 7 (no 37 de 8 y uno de 4)')
    elo20 = {'p%02d' % i: 1200 - 10 * i for i in range(20)}
    rs = rapids(set(elo20), lunes, dias_despues(lunes, 7), {}, elo20, lunes + dt.timedelta(days=8), 's')
    ok(len(rs) == 3 and sorted(len(x['gente']) for x in rs) == [6, 7, 7] and all(x['campeon'] for x in rs),
       'las Rapid: 20 activos, tres grupos parejos (7, 7 y 6), nadie se queda afuera')
    ok(set(rs[0]['gente']) == {'p%02d' % i for i in range(7)} and set(rs[-1]['gente']) == {'p%02d' % i for i in range(14, 20)},
       'y por nivel: el primer grupo son los 7 de más ELO, el último los 6 de menos')
    q = rs[0]['rondas'][0]['partidos']
    ok({q[0]['a'], q[0]['b']} == {'p00', ''} and {q[1]['a'], q[1]['b']} == {'p03', 'p04'},
       'sembrados: el 1 contra el 8 (acá un pase libre), el 4 contra el 5')
    fij = armadas({'sem': 's', 'rapid': rs}, 's', 'rapid')
    rs2 = rapids(set(elo20), lunes, dias_despues(lunes, 7), {}, {k: -v for k, v in elo20.items()}, lunes + dt.timedelta(days=8), 's', fij)
    ok([x['gente'] for x in rs2] == [x['gente'] for x in rs] and armadas({'sem': 'otra', 'rapid': rs}, 's', 'rapid') is None,
       'una semana ya armada no se rearma aunque cambie la fuerza; la semana siguiente sí')
    J = {'x': {'coincide': 0.9}, 'y': {'coincide': 0.4}, 'z': {'coincide': 0.7}}
    mm = jurado_sim({'a': 'a', 'b': 'b', 'g': 'a', 'como': 'sim', 'p': 0.5}, ['x', 'y', 'z'], J, 's')
    ok(len(mm['j']) == 3 and sum(1 for _q, v in mm['j'] if v == 'a') >= 2, 'el jurado simulado: tres jueces y el ganador con la mayoría')
    ok(jurado_sim({'a': 'a', 'b': 'b', 'g': 'a', 'como': 'real', 'p': 0.5}, ['x', 'y', 'z'], J, 's').get('j') is None,
       'y una batalla real no lleva jurado inventado')
    print('\n   %s' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return 1 if mal else 0


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if '--auto' in sys.argv:
        return _self_check()
    res = calcular()
    n = res['nombres']
    L = res['ligas']
    if '--ver' in sys.argv:
        print('Semana %s · día %d/7 · %d activos' % (res['sem'], res['dia'], res['activos']))
        print('\n🥇 Ligas, temporada %d (jornada %d de %d): %s' % (L['temp'], L['jornada'], JORNADAS,
              ', '.join('%s %d' % (nv, sum(1 for g in L['grupos'] if g['nivel'] == nv)) for nv in NIVELES)))
        print('⭐ Élite: %s' % ', '.join(n.get(k, k) for k in L.get('elite') or []))
        print('🏆 Copa: %d llaves · ⚡ Rapid: %d llaves' % (len(res['copa']), len(res['rapid'])))
        print('🎲 Mini: %s' % ', '.join(x['nombre'] for x in res['mini']))
        print('⚖️ Jurados con ficha: %d' % len(res['jurados']))
        return 0
    with io.open(SALIDA, 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
    print('🏆 semana %s, día %d/7: %d activos · %d ligas (temporada %d, jornada %d) · %d llaves de Copa · %d Rapid · mini: %s · %d jurados' % (
        res['sem'], res['dia'], res['activos'], len(L['grupos']), L['temp'], L['jornada'], len(res['copa']), len(res['rapid']),
        ', '.join(x['id'] for x in res['mini']), len(res['jurados'])))
    return 0


if __name__ == '__main__':
    sys.exit(main())
