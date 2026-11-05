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
- **🏆 La Copa**: cada lunes, llaves de `COPA` a eliminación por división y fuerza: 32vos, octavos, cuartos, semis y final.
- **⚡ Las Rapid**: cada lunes, todos los activos sorteados en llaves de `RAPID`; cuartos hasta el jueves, semis hasta el
  sábado, final hasta el lunes.
- **🎲 Mini eventos**: `MINI` por semana, sorteados del `CATALOGO` con la semana de semilla.
- **⚖️ Jurados**: la ficha de cada uno sale de lo que vio el vigía (`datos/jurados.json`, `fichas()`), y en las simuladas
  se sortean tres de verdad, que votan como suelen votar (`jurado_sim()`).
- **⚖️ El PTB de las ligas** (Dlx, 04/11/2026: *«para la próxima que muestre un PTB basado en los jurados»*, y a si
  desempata, *«sí… pero deberíamos tener mucho cuidado con esta función»*), desde la temporada `PTB_DESDE`: los votos de
  jurado que cada uno fue sumando, `PTB_BATALLA` en juego por batalla (`ptb_de()`). A igual de puntos manda el PTB, después
  los ganados de verdad y después la fuerza.
- **💰 Premios** (Dlx, 27/10/2026, a las cuatro preguntas: «Moderado», «Poco, sólo el campeón»): en Puntos de Tienda. Las
  ligas, a los tres primeros de cada una al cerrar la temporada (`PREMIO_LIGA`); la Copa al campeón y al finalista, la
  Rapid y cada mini evento al campeón, al cerrar la semana. **Sólo cobra quien jugó al menos 1 evento en ese tiempo**: la
  temporada de ligas, o la semana. Hasta el 04/11/2026 pedía una batalla de verdad EN ESA COMPETENCIA, y medido eran 0 de
  600 cruces en las ligas y 1 de 153 en la Copa: no cobraba casi nadie (Dlx, a la opción A: *«me gusta la A»*).

💰 EL LIBRO DE PREMIOS NO SE PIERDE. `competencias.json` se rehace entero en cada corrida y sólo tiene la semana en curso,
así que lo que se cobra va a `premios` (`{clave: [quien, monto, motivo, ms]}`), que cada corrida copia de la anterior y
nunca borra. La semana que terminó se cierra UNA vez, en la primera corrida de la siguiente, rehaciendo sus llaves con
`ahora` = su cierre (`cerrar_semana()`, con las llaves que ya estaban armadas); la temporada de ligas, en el mismo paso
en que `ligas()` arma la que viene. La clave dice qué se pagó (`liga:1:oro-1:1`, `copa:2026-11-02:A:1`), así que volver
a cerrar lo mismo no paga dos veces. Lo manda al objeto `precios.py` (`tienda()`), con el prefijo `comp:`.

⚖️ EL JURADO DE LAS SIMULADAS APRENDE DE LOS DE VERDAD. Ver `aprender()`: quién gana sigue saliendo del nivel, y el jurado
dice por cuánto y quién se aparta. Lo ya votado no cambia aunque el jurado siga aprendiendo (`congelados()`): si no, el
PTB de una jornada de hace dos semanas se movería con los votos de anoche.

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
#: la Copa: llaves de 32 (Dlx, 04/11/2026: «que la COPA sea de 32vos para la próxima») y el orden de siembra (el 1 contra
#: el 32, el 16 contra el 17…), así los dos mejores sólo se cruzan en la final. Hasta `COPA32_DESDE` eran de 16: la de esa
#: semana ya estaba publicada, y una llave publicada no se rearma (`armadas()`)
COPA = 32
COPA_ANTES = 16
COPA32_DESDE = '2026-11-09'
SIEMBRA16 = (0, 15, 7, 8, 4, 11, 3, 12, 2, 13, 5, 10, 6, 9, 1, 14)
SIEMBRA = tuple(x for s in SIEMBRA16 for x in (s, COPA - 1 - s))
#: los niveles de las ligas, de arriba abajo, y cuánta gente entra en cada uno (Ascenso: todo el resto)
NIVELES = ('oro', 'plata', 'bronce', 'ascenso')
CUPO = {'oro': 10, 'plata': 20, 'bronce': 40}
SUBEN = BAJAN = 2
JORNADAS = 9
TEMP_SEMANAS = 3
#: 💰 los premios en Puntos de Tienda (Dlx, 27/10/2026): las ligas, 1.º · 2.º · 3.º de cada una al cerrar la temporada
PREMIO_LIGA = {'elite': (2500, 1500, 1000), 'oro': (1500, 1000, 600), 'plata': (1000, 600, 400),
               'bronce': (700, 400, 250), 'ascenso': (500, 300, 150)}
#: la Copa (campeón, finalista), la Rapid y cada mini evento (el campeón), al cerrar la semana
PREMIO_COPA = (500, 250)
PREMIO_RAPID = 300
PREMIO_MINI = 300
#: los cierres de cada semana, en días desde el lunes: miércoles, viernes y el lunes siguiente
CORTES = (2, 4, 7)
#: cuántos mini eventos abiertos por semana
MINI = 4
#: los cinco mini eventos del 04/11/2026 (Dlx: «cualquier idea es válida») entran al sorteo desde esta semana: la que está
#: en curso ya tiene los suyos publicados, y sumarlos al catálogo le cambiaría el sorteo
MINI_NUEVOS = ('maraton', 'trotamundos', 'podios', 'batacazo', 'jurado')
MINI_NUEVOS_DESDE = '2026-11-09'
#: lo mínimo para cobrar cada uno de esos (el batacazo: la chance máxima que tenía quien ganó)
MINI_MINIMO = {'maraton': 3, 'trotamundos': 2, 'podios': 1, 'jurado': 3, 'batacazo': 0.4}
#: desde cuántos votos un jurado entra a los sorteos de las simuladas, y desde cuántos resultados conocidos tiene nota
JURADO_MIN = 5
#: ⚖️ al aprender de un jurado se le suman estos votos «promedio»: con pocos votos se parece al jurado promedio, y con
#: muchos, a sí mismo
JURADO_PRIOR = 6
#: cuánto le pesa el nivel al jurado promedio. Medido el 04/11/2026 sobre 98 votos con resultado: vota al que ganó el 74 %
#: si tenía entre 35 y 50 % de chances, el 83 % entre 50 y 65, y el 85 % de ahí para arriba
JURADO_NIVEL = 0.7
#: cuánto pesa lo que ya votó a cada uno. Medido: con historial distinto entre los dos, votó al que venía mejor 102 de 148
JURADO_HISTORIAL = 0.5
#: el tope de todo eso junto, en log-odds: 3 es un 95 %. Con pocos datos, un jurado no puede votar «siempre» a nadie
JURADO_TOPE = 3.0
#: ⚖️ el PTB de las ligas sale con esta temporada (Dlx: «para la próxima»), y lo que reparte cada batalla: los tres votos
#: del jurado de una simulada
PTB_DESDE = 2
PTB_BATALLA = 3


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


def tabla(gente, partidos, fz, ptb=None):
    """`[[norm, pj, g, pts]]`, ordenada: puntos, ganados de verdad, fuerza. Con `ptb` (lo que reparte cada batalla, ver
    `ptb_de()`) va una quinta columna, y a igual de puntos manda él."""
    t = {k: [k, 0, 0, 0, 0, 0] for k in gente}
    for m in partidos:
        if not m['g']:
            continue
        for k in (m['a'], m['b']):
            t[k][1] += 1
        t[m['g']][2] += 1
        t[m['g']][3] += 3
        if m['como'] == 'real':
            t[m['g']][4] += 1
        if ptb:
            pa, pb = ptb(m)
            t[m['a']][5] += pa
            t[m['b']][5] += pb
    orden = sorted(t.values(), key=lambda x: (-x[3], -x[5], -x[4], -fz.get(x[0], 0), x[0]))
    return [x[:4] + [x[5]] if ptb else x[:4] for x in orden]


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


def rondas_copa(lugares, ini, fin):
    """`(nombres, ventanas)` de una llave de la Copa, según sus lugares. La de 32: 32vos hasta el miércoles, una ronda por
    día hasta el sábado y la final hasta el lunes. Una de 16 (una semana armada antes de `COPA32_DESDE`, o una Copa con muy
    poca gente): una ronda cada dos días."""
    if lugares > COPA_ANTES:
        return ('32vos', 'Octavos', 'Cuartos', 'Semifinal', 'Final'), [ini] + [dias_despues(ini, d) for d in (2, 3, 4, 5)] + [fin]
    return ('Octavos', 'Cuartos', 'Semifinal', 'Final'), [ini] + [dias_despues(ini, d) for d in (2, 4, 6)] + [fin]


def copa(activos, niveles, fz, ini, fin, llaves, ahora, sem, fijas=None):
    """🏆 LA COPA DE LA SEMANA, A ELIMINACIÓN (Dlx, 26/10/2026: «la copa es un torneo»; 04/11/2026: «de 32vos»): los
    activos, por su división y su fuerza, en llaves de `COPA`, con una ventana por ronda (`rondas_copa()`). Las llaves salen
    parejas en tamaño; las que no llegan a llenarse llevan pases libres para los mejores sembrados, como en cualquier copa.
    Lo que manda en una llave ya armada son sus lugares: la semana del cambio sigue de 16 hasta el lunes."""
    if fijas:
        todas = fijas
    else:
        grande = str(sem) >= COPA32_DESDE
        orden = sorted(activos, key=lambda k: (niveles.get(k, 5), -fz.get(k, SIN_ELO), k))
        todas = []
        for g in partir(orden, COPA if grande else COPA_ANTES):
            g = sorted(g, key=lambda k: (-fz.get(k, SIN_ELO), k))
            # ⚠️ con 16 o menos, la de 16: en una de 32 quedarían cruces sin nadie, que no tienen ganador
            siembra = SIEMBRA if len(g) > COPA_ANTES else SIEMBRA16
            todas.append([g[s_] if s_ < len(g) else '' for s_ in siembra])
    out = []
    for i, slots in enumerate(todas):
        g = [k for k in slots if k]
        nombres, lims = rondas_copa(len(slots), ini, fin)
        r = llave(slots, lims, nombres, llaves, fz, ahora, sem, 'copa', i)
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


def jugar_liga(gente, desde, llaves, fz, ahora, *semilla, jurado=None):
    """`(jornadas, tabla)` de una liga: una jornada por ventana, real si se cruzaron adentro, simulada al cerrar. `jurado`
    es `(M, temporada, liga)`: el jurado se sortea acá y no al final, porque desde `PTB_DESDE` sus votos ordenan la tabla,
    y la tabla decide quién sube, quién baja y quién cobra."""
    cal = calendario(len(gente))
    jornadas, todos = [], []
    M, temp, gid = jurado or (None, 0, '')
    for j, (ini, fin) in enumerate(ventanas(desde)):
        if j >= len(cal):
            break
        reales = cruces(llaves, ini, fin)
        cerrada = ahora >= fin
        ps = [resolver(gente[a], gente[b], reales, cerrada, fz, *semilla, j) for a, b in cal[j] if a is not None and b is not None]
        if M:
            for m in ps:
                jurado_sim(m, M, temp, gid, j + 1)
        jornadas.append({'n': j + 1, 'fin': fin.isoformat(), 'partidos': ps})
        todos += ps
    return jornadas, tabla(gente, todos, fz, (lambda m: ptb_de(m, M['votos'], llaves)) if M and temp >= PTB_DESDE else None)


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


def ligas(viejo, llaves, ahora, M=None):
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
    cerradas = []
    while ahora >= dias_despues(desde, 7 * TEMP_SEMANAS):
        final = desde + dt.timedelta(days=99)
        jugadas = {g['id']: jugar_liga(g['gente'], desde, llaves, fz, final, 'liga', temp, g['id'], jurado=(M, temp, g['id']) if M else None) for g in grupos}
        tablas = {k: v[1] for k, v in jugadas.items()}
        # 💰 la tabla final de la temporada que termina y quién jugó en ella, para los premios (`premios_liga()`)
        c = {'temp': temp, 'fin': dias_despues(desde, 7 * TEMP_SEMANAS).isoformat(),
             'jugaron': sorted(jugaron(llaves, desde, dias_despues(desde, 7 * TEMP_SEMANAS))),
             'grupos': [dict(id=g['id'], nivel=g['nivel'], jornadas=jugadas[g['id']][0], tabla=tablas[g['id']]) for g in grupos]}
        if len(elite) >= 4:
            js, t = jugar_liga(elite, desde, llaves, fz, final, 'elite', temp, jurado=(M, temp, 'elite') if M else None)
            c['elite'] = {'jornadas': js, 'tabla': t}
        cerradas.append(c)
        desde = dias_despues(desde, 7 * TEMP_SEMANAS)
        act = set(jugaron(llaves, desde - dt.timedelta(days=ACTIVO_DIAS), desde))
        grupos = armar_grupos(mover(grupos, tablas, act, fz))
        elite, temp = elite_de(act), temp + 1
        fz = fuerzas(llaves, desde)
    out = {'temp': temp, 'desde': desde.isoformat(), 'hasta': dias_despues(desde, 7 * TEMP_SEMANAS).isoformat(),
           'cierres': [c.isoformat() for c in cierres(desde)],
           'jornada': min(JORNADAS, 1 + sum(1 for c in cierres(desde) if ahora >= c)),
           'grupos': [], 'elite': elite}
    if cerradas:
        out['cerradas'] = cerradas
    for g in grupos:
        js, t = jugar_liga(g['gente'], desde, llaves, fz, ahora, 'liga', temp, g['id'], jurado=(M, temp, g['id']) if M else None)
        out['grupos'].append(dict(g, jornadas=js, tabla=t))
    if len(elite) >= 4:
        js, t = jugar_liga(elite, desde, llaves, fz, ahora, 'elite', temp, jurado=(M, temp, 'elite') if M else None)
        out['liga_elite'] = {'gente': elite, 'jornadas': js, 'tabla': t}
    return out


# ── la Rapid de la semana ─────────────────────────────────────────────────────────────────────────────────────────

def llave(gente, lims, nombres, llaves, fz, ahora, *semilla):
    """Una llave a eliminación con una ventana por ronda (`lims`: el arranque y el cierre de cada una). `gente` son los
    lugares en orden; un lugar vacío es un pase libre (`como: 'pase'`). `None` es que en ese lugar no hay nadie ni lo va a
    haber, y '' que todavía no se sabe quién: con muy poca gente, un cruce sin nadie deja un lugar vacío en la ronda de
    después, y sin separarlos ese cruce esperaba para siempre y la llave nunca tenía campeón."""
    rondas, vivos = [], [k or None for k in gente]
    for r, nombre in enumerate(nombres):
        a0, a1 = lims[r], lims[r + 1]
        reales = cruces(llaves, a0, a1)
        ps = []
        for i in range(0, len(vivos), 2):
            a, b = vivos[i], vivos[i + 1]
            if (a is None and b != '') or (b is None and a != ''):
                ps.append({'a': a or '', 'b': b or '', 'g': a or b or '', 'como': 'pase', 'p': 1.0 if a else 0.0})
            elif not a or not b:
                ps.append({'a': a or '', 'b': b or '', 'g': '', 'como': 'pend', 'p': 0.5})
            else:
                ps.append(resolver(a, b, reales, ahora >= a1, fz, *semilla, nombre))
        rondas.append({'r': nombre, 'hasta': a1.isoformat(), 'partidos': ps})
        vivos = [None if m['como'] == 'pase' and not m['g'] else m['g'] for m in ps]
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
            ('maraton', '🏃', 'Maratón'), ('trotamundos', '🧳', 'Trotamundos'), ('podios', '🏅', 'Cazador de podios'),
            ('batacazo', '💥', 'Batacazo'), ('jurado', '⚖️', 'Favorito del jurado'),
            ('escalera', '🪜', 'La Escalera'), ('fantasy', '🎯', 'Fantasy'), ('crews', '🛡️', 'Torneo de crews')]
PRONTO = ('escalera', 'fantasy', 'crews')


def catalogo_de(sid):
    """El catálogo con el que se sortea la semana `sid`: sin los que todavía no entraban."""
    return [c for c in CATALOGO if c[0] not in MINI_NUEVOS or str(sid) >= MINI_NUEVOS_DESDE]


def votos_de_la_semana(J, ini, fin):
    """`{norm: votos de jurado a favor}` entre `ini` y `fin`, de lo que vio el vigía (`datos/jurados.json`)."""
    out = {}
    d0, d1 = ini.timestamp() * 1000, fin.timestamp() * 1000
    for b in ((J or {}).get('votos') or {}).values():
        if not d0 <= int(b.get('pub') or 0) < d1:
            continue
        lados = b.get('lados') or [b.get('a') or '', b.get('b') or '']
        for x in (b.get('v') or {}).values():
            k = norm(lados[0] if x == 'a' else lados[1] if x == 'b' else x)
            if k:
                out[k] = out.get(k, 0) + 1
    return out


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


def mini_eventos(sid, ini, fin, activos, llaves, fz, ahora, L, cuantos=MINI):
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

    def de_la_semana():
        """Los eventos jugados esta semana, con su gente: `[(evento, [(norm, puesto)])]`."""
        out = []
        for ev in llaves.values():
            t = _dia_utc(ev.get('dia'))
            if t is not None and ini <= t < fin:
                out.append((ev, [(norm(p), puesto) for nombre, puesto, _x in ev.get('tabla') or [] for p in personas(nombre)]))
        return out

    def top(n_de, *mas):
        """Los 5 primeros de `{norm: número}`. A igual número, los puntos de la semana: con el orden alfabético, el
        premio de un empate se lo llevaba quien tuviera el nombre más arriba."""
        orden = sorted(n_de, key=lambda k: (-n_de[k], tuple(-x.get(k, 0) for x in mas), -pts.get(k, 0), k))
        return {'tabla': [[k, n_de[k]] for k in orden[:5]]}

    def maraton():
        """🏃 Quién juega más eventos en la semana."""
        n = {}
        for _ev, gente in de_la_semana():
            for k in {k for k, _p in gente}:
                n[k] = n.get(k, 0) + 1
        return top(n)

    def trotamundos():
        """🧳 Quién juega en más servidores distintos en la semana."""
        svs = {}
        for ev, gente in de_la_semana():
            for k, _p in gente:
                svs.setdefault(k, set()).add(ev.get('sv') or '')
        return top({k: len(v) for k, v in svs.items()})

    def podios():
        """🏅 Quién sube más al podio en la semana: las tres medallas, como `pod` del Ranking."""
        n, oros = {}, {}
        for _ev, gente in de_la_semana():
            for k, puesto in gente:
                if puesto in ('Campeón', 'Subcampeón', 'Tercero'):
                    n[k] = n.get(k, 0) + 1
                    oros[k] = oros.get(k, 0) + (puesto == 'Campeón')
        return top(n, oros)

    def batacazo():
        """💥 Las mayores sorpresas de la semana: `[ganador, perdedor, chance que tenía el ganador, evento]`."""
        xs = [[g, p, round(prob(fz.get(g, SIN_ELO), fz.get(p, SIN_ELO)), 3), n] for g, p, n, _d in reales]
        return {'tabla': sorted(xs, key=lambda x: (x[2], x[3], x[0]))[:5]}

    def jurado():
        """⚖️ Quién se lleva más votos de los jurados en la semana, de lo que vio el vigía."""
        return top(votos_de_la_semana(_j('datos', 'jurados.json', defecto={}), ini, fin))

    hacer = {'derbi': derbi, 'paises': paises, 'meta': meta, 'supercopa': supercopa, 'duos': lambda: equipos(2), 'pandillas': lambda: equipos(5),
             'rey': rey, 'revancha': revancha, 'racha': racha, 'novatos': novatos, 'maraton': maraton, 'trotamundos': trotamundos,
             'podios': podios, 'batacazo': batacazo, 'jurado': jurado}
    out = []
    for id_, ic, nombre in sorted(catalogo_de(sid), key=lambda c: moneda('mini', sid, c[0])):
        if id_ in PRONTO or len(out) >= cuantos:
            continue
        x = hacer[id_]()
        if x:
            out.append(dict(x, id=id_, ic=ic, nombre=nombre))
    return out, [[i, ic, n] for i, ic, n in CATALOGO if i in PRONTO]


def proxima_semana(sid_prox, hoy):
    """⏳ Los que abren la semana que viene (Dlx, 26/10/2026: «para lo que dice pronto, crear un countdown… abre en X»):
    el mismo sorteo con la semilla de la semana que viene, sin los que ya están abiertos esta."""
    ya = {x['id'] for x in hoy}
    orden = [c for c in sorted(catalogo_de(sid_prox), key=lambda c: moneda('mini', sid_prox, c[0])) if c[0] not in PRONTO]
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


def _logit(p):
    p = min(0.98, max(0.02, p))
    return math.log(p / (1 - p))


def _suave(par, base):
    """Una tasa aprendida de `par` (`[a favor, total]`), con `JURADO_PRIOR` votos promedio sumados."""
    return (par[0] + JURADO_PRIOR * base) / float(par[1] + JURADO_PRIOR)


def servidor_de_los_votos():
    """`{nombre del servidor en Discord: código}`: cada voto guarda el nombre que tenía el servidor, y el pool habla en
    códigos. Por eso la ficha de cada jurado decía «—» en «con gente de su servidor»: comparaba «FFA» con «[FFA] Freestyle
    For All 👾», y no daba nunca. `datos/canales_llaves.json` sabe el nombre y el guild, y `datos/servidores.json` el código."""
    s = (_j('datos', 'servidores.json', defecto={}) or {}).get('servidores') or {}
    por_guild = {x.get('guild_id'): k for k, x in s.items() if isinstance(x, dict) and x.get('guild_id')}
    c = _j('datos', 'canales_llaves.json', defecto={}) or {}
    return {x.get('servidor'): por_guild[x['guild']] for d in (c.get('canales') or {}, c.get('veredictos') or {})
            for x in d.values() if isinstance(x, dict) and x.get('guild') in por_guild}


def fichas(llaves, J=None):
    """⚖️ LO QUE SE SABE DE CADA JURADO, de cada voto que vio el vigía (`datos/jurados.json`, `escuchar.votos_jurados()` y
    `votos_en_vivo()`): `{jurado: {votos, res, fav, casa, sv, por, contra, nom}}`.

    `res`: `[votos al que ganó, votos con resultado conocido]`. El resultado es el que dijo la ronda (FFA), o el de la llave
    si se jugó a ~36 h del voto, o la mayoría si votaron dos o más. Un voto suelto sin llave no se cuenta: comparado consigo
    mismo daría siempre 100 %, y por eso 10 de las 20 notas salían de 10,0.
    `fav`: lo mismo con el de más ELO ESE DÍA. `casa`: con la gente del servidor donde votó, cuando hay uno solo de ahí.
    `por` / `contra`: `{rapero: veces}`. `sv`: donde más votó."""
    J = J if J is not None else (_j('datos', 'jurados.json', defecto={}) or {})
    sv_nom = servidor_de_los_votos()
    sv_de = {norm(x['raw']): x.get('sv') or '' for x in (_j('datos', 'temporada_pool.json', defecto=[]) or []) if x.get('raw')}
    siempre = (dt.datetime(2000, 1, 1, tzinfo=dt.timezone.utc), dt.datetime(2100, 1, 1, tzinfo=dt.timezone.utc))
    ganaron = {}
    for g, p, _n, d in cruces(llaves, *siempre):
        ganaron.setdefault(frozenset((g, p)), []).append((_dia_utc(d), g))
    elos, st = {}, {}
    for b in (J.get('votos') or {}).values():
        lados = b.get('lados') or [b.get('a') or '', b.get('b') or '']
        ln = [norm(x) for x in lados]
        v = {q: (lados[0] if x == 'a' else lados[1] if x == 'b' else x) for q, x in (b.get('v') or {}).items()}
        ms = int(b.get('pub') or 0)
        gano = norm(b.get('g') or '')
        if not gano and len(ln) == 2:
            for t, g in ganaron.get(frozenset(ln)) or ():
                if abs(t.timestamp() - ms / 1000.0) <= 36 * 3600:
                    gano = g
        if not gano and len(v) >= 2:
            cuenta = sorted(_contar(norm(x) for x in v.values()).items(), key=lambda kv: -kv[1])
            gano = cuenta[0][0] if len(cuenta) == 1 or cuenta[0][1] > cuenta[1][1] else ''
        dia = dt.datetime.fromtimestamp(ms / 1000.0, dt.timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        if dia not in elos:
            elos[dia] = fuerzas(llaves, dia)
        fs = [elos[dia].get(k) for k in ln]
        fav = ln[fs.index(max(fs))] if None not in fs and fs.count(max(fs)) == 1 else ''
        sv = sv_nom.get(b.get('sv')) or ''
        de_aca = [k for k in ln if sv and sv_de.get(k) == sv]
        casa = de_aca[0] if len(de_aca) == 1 else ''
        for quien, lado in v.items():
            x = norm(lado)
            s = st.setdefault(quien, {'votos': 0, 'res': [0, 0], 'fav': [0, 0], 'casa': [0, 0], 'svs': {}, 'por': {}, 'contra': {}, 'nom': {}})
            s['votos'] += 1
            for campo, quien_es in (('res', gano), ('fav', fav), ('casa', casa)):
                if quien_es:
                    s[campo][1] += 1
                    s[campo][0] += x == quien_es
            if sv:
                s['svs'][sv] = s['svs'].get(sv, 0) + 1
            s['por'][x] = s['por'].get(x, 0) + 1
            s['nom'][x] = lado
            for no, crudo in zip(ln, lados):
                if no != x:
                    s['contra'][no] = s['contra'].get(no, 0) + 1
                    s['nom'][no] = crudo
    for s in st.values():
        s['sv'] = max(sorted(s['svs']), key=lambda k: s['svs'][k]) if s['svs'] else ''
    return st


def _contar(xs):
    out = {}
    for x in xs:
        out[x] = out.get(x, 0) + 1
    return out


def jurados(M):
    """⚖️ LA FICHA DE CADA JURADO, PÚBLICA (Dlx, 26/10/2026: «un score de cada jurado, basado en lo que ellos votan… a
    quién votan más, menos», y «sí, que sea para el público»): `{jurado: {n, votos, coincide, favorito, propio, mas, menos,
    nota}}`. `coincide`: cuántas veces votó al que ganó; `favorito`: al de más fuerza; `propio`: a la gente de su servidor,
    cuando había uno solo; `nota` 1–10, desde `JURADO_MIN` resultados conocidos (antes no hay con qué)."""
    nombres = (_j('datos', 'jurados.json', defecto={}) or {}).get('nombres') or {}
    out = {}
    for quien, s in M['fichas'].items():
        r = lambda x: round(x[0] / float(x[1]), 3) if x[1] else None   # noqa: E731
        co = r(s['res'])
        top = lambda d: [s['nom'].get(max(d.items(), key=lambda kv: (kv[1], kv[0]))[0]), max(d.values())] if d else None   # noqa: E731
        out[quien] = {'n': nombres.get(quien, ''), 'votos': s['votos'], 'coincide': co, 'favorito': r(s['fav']),
                      'propio': r(s['casa']), 'mas': top(s['por']), 'menos': top(s['contra']),
                      'nota': round(1 + 9 * co, 1) if co is not None and s['res'][1] >= JURADO_MIN else None}
    return out


def _batallas(res):
    """Cada tanda de batallas de un resultado, con la semilla de su jurado: `(semilla, [batallas])`."""
    L = res.get('ligas') or {}
    for g in (L.get('grupos') or []) + ([L['liga_elite']] if L.get('liga_elite') else []):
        for j in g.get('jornadas') or []:
            yield (L.get('temp'), g.get('id', 'elite'), j['n']), j.get('partidos') or []
    for r in (res.get('copa') or []) + (res.get('rapid') or []) + [x for x in res.get('mini') or [] if x.get('id') == 'novatos']:
        for rd in r.get('rondas') or []:
            yield (res.get('sem'), r.get('id', 'novatos'), rd['r']), rd.get('partidos') or []
    for x in res.get('mini') or []:
        if x.get('partidos'):
            yield (res.get('sem'), x['id']), x['partidos']
        if x.get('partido'):
            yield (res.get('sem'), x['id']), [x['partido']]


def _clave_sim(semilla, m):
    return '|'.join(str(x) for x in tuple(semilla) + (m.get('a'), m.get('b')))


def congelados(viejo):
    """`{batalla: votos}` de lo que la corrida anterior ya votó. El jurado sigue aprendiendo y lo ya votado no se mueve: si
    no, los votos de anoche le cambiarían el PTB a una jornada de hace dos semanas, y con eso quién subió."""
    out = {}
    for sem, ps in _batallas(viejo or {}):
        for m in ps:
            if m.get('j'):
                out[_clave_sim(sem, m)] = m['j']
    return out


def aprender(llaves, viejo=None, J=None):
    """⚖️ EL JURADO QUE APRENDE (Dlx, 04/11/2026: *«que sea basado en lo que el vigía haya visto de las votaciones del
    jurado… que de eso aprenda y… intente replicar la actitud de un jurado específico»*, y *«deberíamos tener mucho
    cuidado con esta función»*).

    De cada jurado se aprende lo que se puede medir (`fichas()`): si suele votar al que termina ganando, si se va con el
    favorito o con el de abajo, si tira para la gente de su servidor y a quién le viene votando. Cada corrida aprende de
    todo lo que hay, así que mejora sola con cada votación que ve el vigía.

    El cuidado:
    - **Quién gana no lo deciden ellos**: sigue saliendo del nivel (`simular()`). Eso le da a los votos sólo por cuánto
      (3–0 o 2–1) y quién se aparta, o sea el desempate, y nunca cambia un resultado.
    - **Con pocos votos, un jurado se parece al promedio** (`JURADO_PRIOR`), y con menos de `JURADO_MIN` no se lo sortea.
    - **Lo ya votado no cambia** (`congelados()`).
    - **Nadie juzga su propia batalla** (`yo`): hay jurados que además compiten.
    - **Su peso está acotado** (`JURADO_TOPE`): ningún jurado vota con más de un 95 % de seguridad."""
    F = fichas(llaves, J)
    base = {}
    for campo, defecto in (('res', 0.8), ('fav', 0.55), ('casa', 0.5)):
        x, n = sum(s[campo][0] for s in F.values()), sum(s[campo][1] for s in F.values())
        base[campo] = (x + JURADO_PRIOR * defecto) / float(n + JURADO_PRIOR)
    return {'fichas': F, 'base': base, 'jueces': sorted(q for q, s in F.items() if s['votos'] >= JURADO_MIN),
            'yo': {str(x.get('discord_id')): norm(x.get('raw')) for x in (_j('datos', 'padron.json', defecto=[]) or [])
                   if x.get('discord_id') and x.get('raw')},
            'sv': {norm(x['raw']): x.get('sv') or '' for x in (_j('datos', 'temporada_pool.json', defecto=[]) or []) if x.get('raw')},
            'votos': votos_por_cruce(), 'frio': congelados(viejo)}


def voto_al_ganador(q, g, l, pg, M):
    """La chance de que `q` le vote a `g`, que le ganó a `l` teniendo `pg` de chances. Se suma en log-odds: lo que suele
    votar al que gana, cuánto le pesa el nivel a él, si tira para los suyos más que el promedio y su historial con los dos."""
    s = M['fichas'].get(q) or {'res': [0, 0], 'fav': [0, 0], 'casa': [0, 0], 'sv': '', 'por': {}, 'contra': {}}
    b = M['base']
    x = _logit(_suave(s['res'], b['res']))
    x += (JURADO_NIVEL + _logit(_suave(s['fav'], b['fav'])) - _logit(b['fav'])) * _logit(pg)
    gc, lc = M['sv'].get(g) == s['sv'], M['sv'].get(l) == s['sv']
    if s['sv'] and gc != lc:
        lean = _logit(_suave(s['casa'], b['casa'])) - _logit(b['casa'])
        x += lean if gc else -lean
    af = lambda k: math.log((s['por'].get(k, 0) + 1.0) / (s['contra'].get(k, 0) + 1.0))   # noqa: E731
    x += JURADO_HISTORIAL * (af(g) - af(l))
    return 1.0 / (1.0 + math.exp(-max(-JURADO_TOPE, min(JURADO_TOPE, x))))


def jurado_sim(m, M, *semilla):
    """⚖️ El jurado de una batalla SIMULADA (Dlx, 26/10/2026: «seleccionar el staff de la batalla a lo random así también
    simulamos el staff»): tres jueces de verdad sorteados, y cada uno vota como suele votar (ver `aprender()`). El que ganó
    siempre tiene la mayoría: si los votos no se la dan, se la da el juez que más chance tenía de votarlo. Repetible, como
    todo, y lo ya votado se queda."""
    if m.get('como') != 'sim' or m.get('j'):
        return m
    lado = 'a' if m['g'] == m['a'] else 'b'
    ya = M['frio'].get(_clave_sim(semilla, m))
    if ya and 2 * sum(1 for _q, v in ya if v == lado) > len(ya):
        m['j'] = ya
        return m
    jueces = [q for q in M['jueces'] if M['yo'].get(q) not in (m['a'], m['b'])]
    if len(jueces) < 3:
        return m
    tres = sorted(jueces, key=lambda q: moneda('jurado', *semilla, m['a'], m['b'], q))[:3]
    l = m['b'] if lado == 'a' else m['a']
    pg = m['p'] if lado == 'a' else 1 - m['p']
    chance = {q: voto_al_ganador(q, m['g'], l, pg, M) for q in tres}
    con = {q for q in tres if moneda('voto', *semilla, m['a'], m['b'], q) < chance[q]}
    for q in sorted(tres, key=lambda q: (-chance[q], q)):
        if len(con) >= 2:
            break
        con.add(q)
    otro = 'b' if lado == 'a' else 'a'
    m['j'] = [[q, lado if q in con else otro] for q in tres]
    return m


# ── ⚖️ el PTB de las ligas ────────────────────────────────────────────────────────────────────────────────────────

def votos_por_cruce():
    """`{(norm, norm): [(ms, {norm: votos})]}`: los votos de cada batalla de dos de `datos/jurados.json`, por sus dos
    nombres ordenados. Las de 3 a 5 MCs (`lados`) no son un cruce."""
    out = {}
    for b in ((_j('datos', 'jurados.json', defecto={}) or {}).get('votos') or {}).values():
        if b.get('lados') or not b.get('a') or not b.get('b'):
            continue
        a, c = norm(b['a']), norm(b['b'])
        v = list((b.get('v') or {}).values())
        out.setdefault(tuple(sorted((a, c))), []).append((int(b.get('pub') or 0), {a: v.count('a'), c: v.count('b')}))
    return out


def ptb_de(m, votos, llaves):
    """`(de a, de b)`: lo que reparte una batalla resuelta, `PTB_BATALLA` en juego. Una simulada, los votos de su jurado
    sorteado. Una real, los votos que quedaron en esa batalla (a ~36 h de su evento) llevados a tres, y como ganó ella el
    que ganó se lleva dos o más: un solo jurado es 3–0. Sin votos anotados, los tres al que ganó: el voto suelto de un
    servidor no puede valer menos que un jurado inventado, o jugar de verdad daría menos PTB que no jugar."""
    a, b, g = m.get('a'), m.get('b'), m.get('g')
    if not g or not a or not b:
        return 0, 0
    if m.get('como') == 'sim' and m.get('j'):
        va = sum(1 for _q, v in m['j'] if v == 'a')
        return va, len(m['j']) - va
    de_g = PTB_BATALLA
    t = _dia_utc((llaves.get(str(m.get('ev'))) or {}).get('dia')) if m.get('como') == 'real' else None
    if t is not None:
        cerca = [(abs(ms / 1000.0 - t.timestamp()), x) for ms, x in votos.get(tuple(sorted((a, b)))) or []]
        cerca = [c for c in cerca if c[0] <= 36 * 3600]
        if cerca:
            x = min(cerca, key=lambda c: c[0])[1]
            hay = sum(x.values())
            if hay:
                de_g = max(PTB_BATALLA - PTB_BATALLA // 2, int(PTB_BATALLA * x.get(g, 0) / float(hay) + 0.5))
    return (de_g, PTB_BATALLA - de_g) if g == a else (PTB_BATALLA - de_g, de_g)


# ── 💰 los premios ────────────────────────────────────────────────────────────────────────────────────────────────

def _ms(iso):
    return int(dt.datetime.fromisoformat(iso).timestamp() * 1000)


def premios_liga(c):
    """`{clave: [quien, monto, motivo, ms]}` de una temporada de ligas cerrada (`ligas()['cerradas']`): los tres
    primeros de cada liga y de la Élite, si jugaron al menos un evento en esa temporada."""
    out = {}
    jugo = set(c.get('jugaron') or ())
    grupos = [(g['id'], g['nivel'], g['jornadas'], g['tabla']) for g in c.get('grupos') or []]
    if c.get('elite'):
        grupos.append(('elite', 'elite', c['elite']['jornadas'], c['elite']['tabla']))
    nombre = {'elite': 'Élite', 'oro': 'Oro', 'plata': 'Plata', 'bronce': 'Bronce', 'ascenso': 'Ascenso'}
    for gid, nivel, js, t in grupos:
        for pos, fila in enumerate(t[:3], 1):
            monto = (PREMIO_LIGA.get(nivel) or (0, 0, 0))[pos - 1]
            if monto and fila[3] > 0 and fila[0] in jugo:
                out['liga:%s:%s:%d' % (c['temp'], gid, pos)] = [fila[0], monto, 'Liga %s · %d.º' % (nombre[nivel], pos),
                                                               _ms(c['fin'])]
    return out


def premios_semana(sid, fin, copas, rapids_, minis, jugo=()):
    """`{clave: [quien, monto, motivo, ms]}` de una semana cerrada: la Copa (campeón y finalista), la Rapid y los mini
    eventos (el campeón), cada uno sólo si jugó al menos un evento esa semana (`jugo`). También en Dúos y Pandillas: el que
    no jugó no cobra por su equipo."""
    out, ms = {}, _ms(fin)
    jugo = set(jugo)

    def poner(clave, quien, monto, motivo):
        if quien and monto:
            out[clave] = [quien, monto, motivo, ms]
    for i, r in enumerate(copas or []):
        fin_ = (r['rondas'][-1]['partidos'] or [{}])[0] if r.get('rondas') else {}
        g = r.get('campeon') or ''
        segundo = next((x for x in (fin_.get('a'), fin_.get('b')) if x and x != g), '') if g else ''
        for pos, q in ((1, g), (2, segundo)):
            if q and q in jugo:
                poner('copa:%s:%s:%d' % (sid, r.get('id', i), pos), q, PREMIO_COPA[pos - 1],
                      'Copa %s · %s' % (r.get('id', ''), 'campeón' if pos == 1 else 'finalista'))
    for r in rapids_ or []:
        g = r.get('campeon') or ''
        if g and g in jugo:
            poner('rapid:%s:%s' % (sid, r.get('id')), g, PREMIO_RAPID, 'Rapid %s · campeón' % r.get('id'))
    for x in minis or []:
        i, nom = x.get('id'), x.get('nombre') or x.get('id')
        if i in ('derbi', 'paises') and x.get('score') and x['score'][0] != x['score'][1]:
            lado = 'a' if x['score'][0] > x['score'][1] else 'b'
            for m in x.get('partidos') or []:
                if m[lado] in jugo:
                    poner('mini:%s:%s:%s' % (sid, i, m[lado]), m[lado], PREMIO_MINI, '%s · ganó su bando' % nom)
        elif i == 'supercopa' and (x.get('partido') or {}).get('g') in jugo:
            g = x['partido'].get('g')
            poner('mini:%s:%s:%s' % (sid, i, g), g, PREMIO_MINI, '%s · campeón' % nom)
        elif i in ('duos', 'pandillas') and x.get('tabla') and x['tabla'][0][1] > 0:
            for q in x['tabla'][0][0]:
                if q in jugo:
                    poner('mini:%s:%s:%s' % (sid, i, q), q, PREMIO_MINI, '%s · ganó su equipo' % nom)
        elif i == 'rey' and x.get('rey') and (len(x.get('reyes') or []) > 1 or x.get('defensas')):
            poner('mini:%s:%s:%s' % (sid, i, x['rey']), x['rey'], PREMIO_MINI, '%s · terminó la semana con la corona' % nom)
        elif i == 'revancha':
            for g, _p in x.get('hechas') or []:
                poner('mini:%s:%s:%s' % (sid, i, g), g, PREMIO_MINI, '%s · se cobró la revancha' % nom)
        elif i == 'racha' and x.get('tabla') and x['tabla'][0][1] >= 2:
            q = x['tabla'][0][0]
            poner('mini:%s:%s:%s' % (sid, i, q), q, PREMIO_MINI, '%s · la mejor racha' % nom)
        elif i == 'novatos' and x.get('campeon') in jugo:
            g = x['campeon']
            poner('mini:%s:%s:%s' % (sid, i, g), g, PREMIO_MINI, '%s · campeón' % nom)
        elif i in ('maraton', 'trotamundos', 'podios', 'jurado') and x.get('tabla') and x['tabla'][0][1] >= MINI_MINIMO[i]:
            q = x['tabla'][0][0]
            poner('mini:%s:%s:%s' % (sid, i, q), q, PREMIO_MINI, '%s · el primero de la semana' % nom)
        elif i == 'batacazo' and x.get('tabla') and x['tabla'][0][2] <= MINI_MINIMO[i]:
            q = x['tabla'][0][0]
            poner('mini:%s:%s:%s' % (sid, i, q), q, PREMIO_MINI, '%s · la mayor sorpresa de la semana' % nom)
    return out


def cerrar_semana(viejo, llaves):
    """💰 Los premios de la semana de `viejo` (el `competencias.json` de la corrida anterior), con todas sus ventanas
    cerradas: se rehacen sus llaves con `ahora` = su cierre, sobre las que ya estaban armadas (`armadas()`), así lo que
    se paga es lo mismo que se vio."""
    sid = str(viejo.get('sem') or '')
    try:
        ini, fin = dt.datetime.fromisoformat(viejo['ini']), dt.datetime.fromisoformat(viejo['fin'])
    except (KeyError, TypeError, ValueError):
        return {}
    ahora = fin + dt.timedelta(seconds=1)
    fz = fuerzas(llaves, ini)
    activos = set(jugaron(llaves, ini - dt.timedelta(days=ACTIVO_DIAS), ini))
    cp = copa(activos, {}, fz, ini, fin, llaves, ahora, sid, armadas(viejo, sid, 'copa'))
    rp = rapids(activos, ini, fin, llaves, fz, ahora, sid, armadas(viejo, sid, 'rapid'))
    mini, _p = mini_eventos(sid, ini, fin, activos, llaves, fz, ahora, viejo.get('ligas') or {})
    return premios_semana(sid, viejo['fin'], cp, rp, mini, jugaron(llaves, ini, fin))


def leer():
    """`datos/competencias.json`, o `{}`."""
    return _j('datos', 'competencias.json', defecto={}) or {}


def tienda(d, dids):
    """`{clave: [discord_id, puntos, ms]}` del libro de premios, para el objeto (como `divisiones.tienda()`): entero en
    cada corrida, y el objeto lo REEMPLAZA (`comp:`). `dids` es `{rapero: discord_id}` (`precios.discords()`); quien no
    tiene Discord todavía no va: le llega cuando se sepa."""
    por = {norm(r): did for r, did in (dids or {}).items()}
    out = {}
    for k, x in ((d or {}).get('premios') or {}).items():
        did = por.get(x[0])
        if did and x[1] > 0:
            out[k] = [did, int(x[1]), int(x[3])]
    return out


# ── todo junto ────────────────────────────────────────────────────────────────────────────────────────────────────

def _con_jurado(res, M):
    """Le pone su jurado a cada batalla simulada que todavía no lo tenga (las ligas ya lo traen: `jugar_liga()`)."""
    for sem, ps in _batallas(res):
        for m in ps:
            jurado_sim(m, M, *sem)
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
    M = aprender(llaves, viejo)
    L = ligas(viejo.get('ligas'), llaves, ahora, M)
    # 💰 el libro de premios: lo de antes, más la temporada de ligas y la semana que se acaban de cerrar
    premios = dict(viejo.get('premios') or {})
    for c in L.pop('cerradas', None) or []:
        premios.update(premios_liga(c))
    if viejo.get('sem') and str(viejo.get('sem')) < sid:
        premios.update(cerrar_semana(viejo, llaves))
    mini, pronto = mini_eventos(sid, ini, fin, activos, llaves, fz, ahora, L)
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
        'jurados': jurados(M),
        'premios': premios,
        'montos': {'liga': PREMIO_LIGA, 'copa': list(PREMIO_COPA), 'rapid': PREMIO_RAPID, 'mini': PREMIO_MINI, 'minimo': MINI_MINIMO},
    }
    _con_jurado(res, M)
    # 🔒 quienes ya cumplieron para el lunes que viene, para que la página no le pida un evento a quien ya lo jugó
    res['entran'] = sorted(jugaron(llaves, fin - dt.timedelta(days=ACTIVO_DIAS), fin))
    usados = set(activos) | {k for g in L['grupos'] for k in g['gente']} | set(L.get('elite') or [])
    res['nombres'] = {k: nombres.get(k, k) for k in usados | {k for k, *_x in res['equipo']}}
    return res


def _self_check_premios(ok):
    real = lambda a, b, g: {'a': a, 'b': b, 'g': g, 'como': 'real', 'p': .5}   # noqa: E731
    sim = lambda a, b, g: {'a': a, 'b': b, 'g': g, 'como': 'sim', 'p': .5}     # noqa: E731
    c = {'temp': 1, 'fin': '2026-11-16T16:00:00+00:00', 'jugaron': ['a', 'b', 'x'],
         'grupos': [{'id': 'oro-1', 'nivel': 'oro', 'jornadas': [{'partidos': [real('a', 'b', 'a'), sim('c', 'd', 'c')]}],
                     'tabla': [['a', 1, 1, 3], ['c', 1, 1, 3], ['b', 1, 0, 0], ['d', 1, 0, 0]]}]}
    pl = premios_liga(c)
    ok(pl.get('liga:1:oro-1:1', [0, 0])[:2] == ['a', PREMIO_LIGA['oro'][0]] and 'liga:1:oro-1:2' not in pl
       and 'liga:1:oro-1:3' not in pl,
       'ligas: cobra el 1.º de Oro (jugó un evento); el 2.º no (no jugó en toda la temporada) ni el 3.º (sin puntos)')
    c2 = dict(c, jugaron=['c', 'b'], grupos=[dict(c['grupos'][0], tabla=[['c', 1, 1, 3], ['b', 1, 0, 0]])])
    ok('liga:1:oro-1:1' in premios_liga(c2), 'y con todo simulado también cobra, si jugó algún evento (Dlx, 04/11: «me gusta la A»)')
    copa_ = {'id': 'A', 'campeon': 'a', 'rondas': [{'partidos': [real('a', 'c', 'a'), sim('b', 'd', 'b')]},
                                                   {'partidos': [sim('a', 'b', 'a')]}]}
    ps = premios_semana('s', '2026-11-02T16:00:00+00:00', [copa_], [], [
        {'id': 'pandillas', 'nombre': 'Pandillas', 'tabla': [[['a', 'z'], 900]]}], jugo={'a'})
    ok(ps.get('copa:s:A:1', [0, 0])[1] == PREMIO_COPA[0] and 'copa:s:A:2' not in ps,
       'Copa: el campeón cobra (jugó esa semana), el finalista que no jugó no')
    ok('mini:s:pandillas:a' in ps and 'mini:s:pandillas:z' not in ps,
       'Pandillas: cobra el integrante que jugó esa semana, no el que no jugó')
    pn = premios_semana('s', '2026-11-02T16:00:00+00:00', [], [], [
        {'id': 'maraton', 'nombre': 'Maratón', 'tabla': [['a', 3]]}, {'id': 'trotamundos', 'nombre': 'T', 'tabla': [['a', 1]]},
        {'id': 'batacazo', 'nombre': 'B', 'tabla': [['b', 'c', 0.3, '9']]}, {'id': 'jurado', 'nombre': 'J', 'tabla': [['d', 2]]},
        {'id': 'podios', 'nombre': 'P', 'tabla': []}], jugo={'a', 'b', 'c', 'd'})
    ok(sorted(pn) == ['mini:s:batacazo:b', 'mini:s:maraton:a'],
       'los mini eventos nuevos pagan al primero, si llegó a lo mínimo: 1 servidor y 2 votos no alcanzan', pn)
    ok(tienda({'premios': ps}, {'A 🇦🇷': '123456'}).get('copa:s:A:1', [0])[0] == '123456',
       'al objeto, con el Discord de cada uno')


def _self_check():
    mal = 0

    def ok(c, t, extra=None):
        nonlocal mal
        mal += not c
        print('   %s %s%s' % ('✅' if c else '🔴', t, '' if c or extra is None else '  → %s' % (extra,)))

    print('\n══ LAS COMPETENCIAS ══\n')
    _self_check_premios(ok)
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
    fz20 = {k: 100 - int(k[1:]) for k in gente}
    gs = copa(gente, {}, fz20, lunes0, dias_despues(lunes0, 7), {}, lunes0 + dt.timedelta(days=8), '2026-10-26')
    ok(len(gs) == 2 and sorted(len(g['gente']) for g in gs) == [10, 10] and [x['r'] for x in gs[0]['rondas']] == ['Octavos', 'Cuartos', 'Semifinal', 'Final'],
       'la Copa de antes: 20 activos, dos llaves parejas de 10, de octavos a la final')
    ok(sum(1 for m in gs[0]['rondas'][0]['partidos'] if m['como'] == 'pase') == 6 and all(g['campeon'] for g in gs),
       'con pases libres para los mejores sembrados, y cada llave con su campeón al cerrar')
    ok(len(set(SIEMBRA)) == COPA and [SIEMBRA[i] + SIEMBRA[i + 1] for i in range(0, COPA, 2)] == [COPA - 1] * (COPA // 2)
       and SIEMBRA[::2] == SIEMBRA16,
       'la siembra de 32: cada cruce suma 33 (el 1 contra el 32) y sus ganadores dan la siembra de 16')
    lunes1 = dt.datetime(2026, 11, 9, 16, 0, tzinfo=dt.timezone.utc)
    g32 = copa(gente, {}, fz20, lunes1, dias_despues(lunes1, 7), {}, lunes1 + dt.timedelta(days=8), COPA32_DESDE)
    ok(len(g32) == 1 and len(g32[0]['gente']) == 20 and [x['r'] for x in g32[0]['rondas']] == ['32vos', 'Octavos', 'Cuartos', 'Semifinal', 'Final']
       and len(g32[0]['rondas'][0]['partidos']) == 16 and sum(1 for m in g32[0]['rondas'][0]['partidos'] if m['como'] == 'pase') == 12 and g32[0]['campeon'],
       'la Copa desde el 09/11: 20 activos son una llave de 32, con 12 pases libres, de 32vos a la final')
    gente64 = {'p%02d' % i for i in range(64)}
    fz64 = {k: 200 - int(k[1:]) for k in gente64}
    g64 = copa(gente64, {}, fz64, lunes1, dias_despues(lunes1, 7), {}, lunes1 + dt.timedelta(days=1), COPA32_DESDE)
    p0 = g64[0]['rondas'][0]['partidos']
    ok(len(g64) == 2 and all(len(g['gente']) == 32 for g in g64) and {p0[0]['a'], p0[0]['b']} == {'p00', 'p31'} and {p0[1]['a'], p0[1]['b']} == {'p15', 'p16'},
       '64 activos son dos de 32: el mejor contra el 32.º, el 16.º contra el 17.º')
    ok([x['hasta'][:10] for x in g64[0]['rondas']] == ['2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-16'],
       'con 32vos hasta el miércoles, una ronda por día y la final hasta el lunes')
    g5 = copa({'p%02d' % i for i in range(5)}, {}, fz20, lunes1, dias_despues(lunes1, 7), {}, lunes1 + dt.timedelta(days=8), COPA32_DESDE)
    ok(len(g5) == 1 and g5[0]['campeon'] and len(g5[0]['rondas']) == 4, 'con poca gente sale una de 16, y tiene campeón: una de 32 tendría cruces sin nadie')
    fij16 = armadas({'sem': COPA32_DESDE, 'copa': gs}, COPA32_DESDE, 'copa')
    g16 = copa(gente, {}, fz20, lunes1, dias_despues(lunes1, 7), {}, lunes1 + dt.timedelta(days=1), COPA32_DESDE, fij16)
    ok(len(g16) == 2 and [x['r'] for x in g16[0]['rondas']] == ['Octavos', 'Cuartos', 'Semifinal', 'Final'],
       'una llave de 16 ya armada sigue de 16 aunque la semana diga 32: manda lo publicado')
    sim_ = lambda g, va: {'a': 'x', 'b': 'y', 'g': g, 'como': 'sim', 'p': .5, 'j': [['q%d' % i, 'a' if i < va else 'b'] for i in range(3)]}   # noqa: E731
    ok(ptb_de(sim_('x', 3), {}, {}) == (3, 0) and ptb_de(sim_('y', 1), {}, {}) == (1, 2), 'el PTB de una simulada: los votos de su jurado, 3–0 o 2–1')
    ev = {'7': {'dia': '2026-11-20'}}
    real_ = lambda g: {'a': 'x', 'b': 'y', 'g': g, 'como': 'real', 'p': .5, 'ev': '7'}   # noqa: E731
    ms = int(_dia_utc('2026-11-20').timestamp() * 1000)
    ok(ptb_de(real_('y'), {}, ev) == (0, 3), 'el de una real sin votos anotados: los tres al que ganó')
    ok(ptb_de(real_('x'), {('x', 'y'): [(ms, {'x': 1, 'y': 0})]}, ev) == (3, 0) and ptb_de(real_('x'), {('x', 'y'): [(ms, {'x': 2, 'y': 1})]}, ev) == (2, 1),
       'con votos, llevados a tres: un solo jurado es 3–0 y un 2–1 es 2–1')
    ok(ptb_de(real_('x'), {('x', 'y'): [(ms, {'x': 0, 'y': 3})]}, ev) == (2, 1), 'el que ganó se lleva dos o más, aunque los votos anotados digan otra cosa')
    ok(ptb_de(real_('x'), {('x', 'y'): [(ms - 10 * 86400000, {'x': 2, 'y': 1})]}, ev) == (3, 0), 'y los votos de otra batalla entre los mismos, días antes, no cuentan')
    ok(ptb_de({'a': 'x', 'b': 'y', 'g': '', 'como': 'pend', 'p': .5}, {}, {}) == (0, 0), 'lo que no se jugó no reparte nada')
    # ⚖️ el desempate, con cuidado
    par = [sim_('x', 3), sim_('y', 1)]
    ptb_f = lambda m: ptb_de(m, {}, {})   # noqa: E731
    ok(tabla(['x', 'y'], par, {'x': 10, 'y': 900}, ptb_f) == [['x', 2, 1, 3, 4], ['y', 2, 1, 3, 2]],
       'a igual de puntos manda el PTB, aunque el otro tenga más nivel')
    ok(tabla(['x', 'y'], par, {'x': 10, 'y': 900}) == [['y', 2, 1, 3], ['x', 2, 1, 3]], 'y sin PTB, como siempre: 4 columnas y manda el nivel')
    ok(tabla(['x', 'y'], [sim_('x', 3), sim_('x', 2)], {}, ptb_f)[0][:4] == ['x', 2, 2, 6], 'el PTB nunca le gana a los puntos')
    ms_ok = lambda **kw: dict({'res': [0, 0], 'fav': [0, 0], 'casa': [0, 0], 'sv': '', 'por': {}, 'contra': {}, 'votos': 40}, **kw)   # noqa: E731
    F_ = {'siempre': ms_ok(res=[40, 40], fav=[39, 40]), 'contra': ms_ok(res=[20, 40], fav=[2, 40]), 'nuevo': ms_ok(votos=5),
          'amigo': ms_ok(res=[30, 40], fav=[20, 40], por={'x': 9}), 'local': ms_ok(res=[30, 40], fav=[20, 40], casa=[20, 20], sv='FFA'),
          'p1': ms_ok(), 'p2': ms_ok(), 'y': ms_ok()}
    M_ = {'fichas': F_, 'base': {'res': .8, 'fav': .55, 'casa': .5}, 'jueces': sorted(F_), 'yo': {'y': 'y'}, 'sv': {'x': 'FFA', 'z': 'DDF'}, 'votos': {}, 'frio': {}}
    v_ = lambda q, g='x', l='z', pg=.7: voto_al_ganador(q, g, l, pg, M_)   # noqa: E731
    ok(abs(v_('p1', pg=.5) - .8) < .001, 'un jurado sin votos, en una batalla pareja, es el promedio')
    ok(v_('siempre') > v_('p1') > v_('contra'), 'quien suele votar al que gana y al favorito se le va más a ese que el promedio, y el que no, menos',
       (v_('siempre'), v_('p1'), v_('contra')))
    ok(v_('contra', pg=.2) > v_('contra', pg=.8), 'al que vota al de abajo le gusta más la sorpresa: vota más al que ganó sin ser favorito',
       (v_('contra', pg=.2), v_('contra', pg=.8)))
    ok(v_('p1', pg=.8) > v_('p1', pg=.2), 'y al promedio le pasa lo contrario')
    ok(v_('amigo', 'x', 'z', .5) > v_('amigo', 'z', 'x', .5), 'su historial pesa: quien le votó 9 veces a x se le va a x')
    ok(v_('local', 'x', 'z', .5) > v_('local', 'z', 'x', .5), 'y el que tira para su servidor, tira para su servidor')
    ok(.04 < v_('contra', 'z', 'x', .02) < .96 and .04 < v_('siempre', 'x', 'z', .98) < .96, 'ningún jurado vota siempre igual: el tope es 95 %',
       (v_('contra', 'z', 'x', .02), v_('siempre', 'x', 'z', .98)))
    for sem_ in range(60):
        mz = jurado_sim({'a': 'x', 'b': 'y', 'g': 'y', 'como': 'sim', 'p': .4}, M_, 'prueba', sem_)
        if sum(1 for _q, v in mz['j'] if v == 'b') < 2 or 'y' in [q for q, _v in mz['j']] or len(mz['j']) != 3:
            ok(False, 'el jurado: tres, sin el que pelea, y el que ganó con la mayoría', mz)
            break
    else:
        ok(True, 'el jurado: tres, nunca uno de los que pelea, y el que ganó siempre con la mayoría (60 batallas)')
    m1 = jurado_sim({'a': 'x', 'b': 'z', 'g': 'x', 'como': 'sim', 'p': .6}, M_, 's', 1)
    ok(m1['j'] == jurado_sim({'a': 'x', 'b': 'z', 'g': 'x', 'como': 'sim', 'p': .6}, M_, 's', 1)['j'], 'lo mismo da siempre lo mismo')
    clave_ = _clave_sim(('s', 1), m1)
    ya_ = [['p1', 'a'], ['p2', 'a'], ['nuevo', 'b']]
    M2 = dict(M_, frio={clave_: ya_})
    ok(jurado_sim({'a': 'x', 'b': 'z', 'g': 'x', 'como': 'sim', 'p': .6}, M2, 's', 1)['j'] == ya_, 'lo ya votado se queda, aunque el jurado haya aprendido')
    ok(jurado_sim({'a': 'x', 'b': 'z', 'g': 'z', 'como': 'sim', 'p': .6}, M2, 's', 1)['j'] != ya_, 'salvo que ya no le dé la mayoría al que ganó: ahí se vuelve a votar')
    ok(jurado_sim({'a': 'x', 'b': 'z', 'g': 'x', 'como': 'real', 'p': .6}, M_, 's').get('j') is None, 'una batalla real no lleva jurado inventado')
    ok(jurado_sim({'a': 'x', 'b': 'z', 'g': '', 'como': 'pend', 'p': .6}, M_, 's').get('j') is None, 'y una por jugar, tampoco')
    ok(jurado_sim({'a': 'x', 'b': 'z', 'g': 'x', 'como': 'sim', 'p': .6}, dict(M_, jueces=['p1', 'p2']), 's').get('j') is None, 'sin tres jueces no hay jurado, y reparte como sin votos')
    rs_ = {'ligas': {'temp': 2, 'grupos': [{'id': 'oro-1', 'jornadas': [{'n': 1, 'partidos': [dict(m1)]}]}]}}
    ok(congelados(rs_).get(_clave_sim((2, 'oro-1', 1), m1)) == m1['j'], 'y lo que la corrida anterior votó se encuentra por su batalla')
    J_ = {'votos': {'1': {'a': 'X 🇦🇷', 'b': 'Z', 'pub': int(_dia_utc('2026-10-27').timestamp() * 1000), 'sv': '?', 'v': {'q1': 'a', 'q2': 'a', 'q3': 'b'}},
                    '2': {'a': 'X', 'b': 'Y', 'pub': int(_dia_utc('2026-10-28').timestamp() * 1000), 'sv': '?', 'v': {'q1': 'b'}},
                    '3': {'lados': ['X', 'Y', 'Z'], 'g': 'Y', 'pub': int(_dia_utc('2026-10-29').timestamp() * 1000), 'sv': '?', 'v': {'q1': 'Y', 'q3': 'Z'}}}}
    Fx = fichas({}, J_)
    ok(Fx['q1']['res'] == [2, 2] and Fx['q3']['res'] == [0, 2], 'la ficha: compara con el resultado, y el voto suelto sin llave no cuenta', Fx.get('q1'))
    ok(Fx['q1']['por'] == {'x': 1, 'y': 2} and Fx['q1']['votos'] == 3 and Fx['q1']['contra'].get('z') == 2, 'y anota a quién le vota y contra quién, por su nombre normalizado', Fx.get('q1'))
    ok(aprender({}, None, {'votos': {}})['jueces'] == [], 'sin votos no se rompe: no hay a quién sortear')
    # 🎲 los mini eventos nuevos
    d_ = dt.datetime(2026, 11, 9, 16, 0, tzinfo=dt.timezone.utc)
    ll_ = {'1': {'dia': '2026-11-10', 'sv': 'FFA', 'tabla': [['A', 'Campeón', 500], ['B', 'Subcampeón', 300]], 'rondas': [{'b': [[['A', 'B'], 'A', '']]}]},
           '2': {'dia': '2026-11-11', 'sv': 'DDF', 'tabla': [['A', 'Tercero', 100], ['C', 'Campeón', 900]], 'rondas': [{'b': [[['C', 'A'], 'C', '']]}]},
           '3': {'dia': '2026-11-12', 'sv': 'FFA', 'tabla': [['A', 'Cuartos', 50], ['B', 'Campeón', 600]], 'rondas': [{'b': [[['B', 'A'], 'B', '']]}]},
           '9': {'dia': '2026-10-01', 'sv': 'SR', 'tabla': [['B', 'Campeón', 900]], 'rondas': []}}
    ok(len(catalogo_de('2026-11-02')) == len(CATALOGO) - len(MINI_NUEVOS) and len(catalogo_de(MINI_NUEVOS_DESDE)) == len(CATALOGO),
       'los nuevos entran al sorteo desde el 09/11: la semana en curso no cambia sus mini eventos')
    viejos_ = [c[0] for c in sorted(catalogo_de('2026-11-02'), key=lambda c: moneda('mini', '2026-11-02', c[0])) if c[0] not in PRONTO][:MINI]
    ok(viejos_ == ['racha', 'meta', 'pandillas', 'duos'], 'y los de esta semana siguen siendo los publicados', viejos_)
    mx, _pr = mini_eventos(MINI_NUEVOS_DESDE, d_, dias_despues(d_, 7), {'a', 'b', 'c'}, ll_, {'a': 1300, 'b': 1000, 'c': 800}, d_ + dt.timedelta(days=4), {}, cuantos=len(CATALOGO))
    de_ = {x['id']: x for x in mx}
    ok(de_['maraton']['tabla'][0] == ['a', 3], 'Maratón: A jugó 3 eventos esta semana', de_['maraton'])
    ok(de_['trotamundos']['tabla'][0] == ['a', 2], 'Trotamundos: A jugó en 2 servidores', de_['trotamundos'])
    ok(de_['podios']['tabla'][0] == ['b', 2], 'Podios: B tiene 2 esta semana (el de octubre no cuenta), y A sólo 2 si contara el cuartos', de_['podios'])
    ok(de_['batacazo']['tabla'][0][:2] == ['c', 'a'] and de_['batacazo']['tabla'][0][2] < .1, 'Batacazo: C, con mucho menos nivel, le ganó a A', de_['batacazo'])
    ok(votos_de_la_semana({'votos': {'1': {'a': 'X', 'b': 'Y', 'pub': int(d_.timestamp() * 1000) + 1000, 'v': {'q': 'a', 'r': 'a', 's': 'b'}},
                                     '2': {'a': 'X', 'b': 'Y', 'pub': 1000, 'v': {'q': 'a'}}}}, d_, dias_despues(d_, 7)) == {'x': 2, 'y': 1},
       'Favorito del jurado: cuenta los votos de esta semana y nada más')
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
