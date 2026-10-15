# -*- coding: utf-8 -*-
"""LAS MISIONES DE LA SEMANA: tres por semana, para todos, que suman a la Temporada.

    python bot/misiones.py           cómo va la semana, con lo que leyó el último ciclo
    python bot/misiones.py --auto    el self-check, sin red ni archivos

Dlx, 27/09/2026: *«lo de pase viene con TAREAS no misiones… lo de misiones es para el ranking de temporada»*. Y el
04/10, a la propuesta (*«3. A»*): **tres misiones por semana, que se renuevan el lunes a las 11 AM ET con los
multiplicadores; cada una suma puntos de Temporada y completar las tres da un bono**. El 05/10: *«empezá ya»*.

LAS REGLAS (los números, acá arriba: van con el rebalanceo del final)
--------------------------------------------------------------------
- **Las mismas tres para todos**, una fácil, una media y una difícil (`CATALOGO`), sorteadas con la semana como
  semilla: se puede recalcular cuando sea y da lo mismo. Ninguna repite la de la semana anterior de su nivel.
- **Se cumplen jugando**, con lo que dicen las llaves: eventos, duelos, hasta dónde llegaste, en qué servidor. Nada que
  se reclame con un botón.
- **Cada una suma sus `PUNTOS` a la Temporada** y las tres, además, `BONO`. Al Competitivo, nunca (como el Most
  Wanted y el precio por cabeza: `rankings.sumar_misiones()`).
- **No repiten lo que la semana ya paga sola**: el Pasaporte (servidores distintos) y la Asistencia (días distintos) de
  `bot/multiplicadores.py`.

🆕 LAS FAMILIAS NUEVAS (Dlx, 14/10/2026, «todas»), DESDE LA SEMANA DEL LUNES 19/10 (`NUEVAS_DESDE`)
-----------------------------------------------------------------------------------------------
- **Ganale a alguien más fuerte**: media, un duelo ganado a alguien de rango MÁS ALTO; difícil, de DOS rangos arriba. El
  rango es el que cada uno tenía AL EMPEZAR LA SEMANA (`rangos_al()`: el Score con las filas de antes del lunes, por la
  misma cuenta que la vitrina), así una semana no se mueve porque el rival jugó el miércoles. Quien todavía no tiene
  letra (menos de 10 eventos) cuenta como la E (`SIN_LETRA`): le cuenta ganarle a una D o más, y «dos arriba» es de la
  C para arriba; al rival sí se le pide letra. Con menos de `ARRIBA_MIN` con letra no se sortea: no habría a quién.
- **Constancia**: media, jugá 4 eventos; media, llegá a cuartos en 2 eventos; difícil, hacé podio (1.º, 2.º o 3.º) en 2.
- **Mundo**: fácil, ganale un duelo a alguien de otro país; media, a raperos de 3 países distintos (que no sean el
  tuyo). El país es el del padrón; sin país de un lado, ese duelo no cuenta (como `clasificar_duelos()`).
- **Formatos**: fácil, jugá un evento que no sea 1 vs 1 (2 vs 2, pandillas, multiverse, 5 vidas, nave…). El formato de
  cada evento es el de `subir_web.formato_evento()`: un nombre por formato, el mismo que muestra la página.
- **Activate en un servidor chico**: media, «Jugá un evento de X». X sale entre los servidores que juegan POCO (los
  `chicos` del dorado, `multiplicadores.DORADO_CHICO`) con la semana como semilla, y no es el del dorado de esa semana:
  las dos empujan a la Liga hacia un servidor chico, cada una al suyo. Si ninguno es chico, no se sortea.
- ⚠️ **Y desde esa semana, una de cada FAMILIA** (`FAMILIA`): con 18 misiones salían «Ganá un duelo», «Ganale a alguien
  más fuerte» y «Ganá 5 duelos» juntas, y un solo duelo cumplía dos. Las semanas de antes no se tocan.

⚠️ LAS SEMANAS YA SORTEADAS NO CAMBIAN. `elegir()` sólo ve una misión desde su semana (el cuarto lugar de su fila en
`CATALOGO`): para la semana del 05/10 y la del 12/10 el catálogo es el mismo de antes, y la semilla da lo mismo. Es lo
que hacen `CAZA_DESDE` y `DORADO_DESDE`.

⚠️ SE RECALCULA ENTERO EN CADA CORRIDA, semana por semana desde `DESDE`, con las filas de `Resultados` y `1v1`: una
llave que se procesa tarde o se corrige cambia quién cumplió. Lo corre el paso 1c (`sheet/rankings.py`) y lo deja en
`datos/misiones.json` para la Temporada (una corrida atrás, como el precio por cabeza) y para la página.

⚠️ ARRANCAN EN CERO CON CADA TEMPORADA: las semanas de antes del arranque no cuentan.
"""
import datetime as dt
import io
import json
import os
import random
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

#: la primera semana con misiones: la que arranca el lunes 05/10/2026 a las 11 AM ET
DESDE = '2026-10-05'
#: 🆕 las familias nuevas (Dlx, 14/10/2026) entran al sorteo desde esta semana: la del 12/10 ya estaba sorteada
NUEVAS_DESDE = '2026-10-19'
#: `id: (texto, qué mide, meta[, desde qué semana])` por nivel. Lo que mide: `eventos`, `duelos` (ganados), `llego`
#: (hasta qué ronda: 4 = semifinal, 2 = final, 1 = campeón), `multi` (un evento del servidor con el multiplicador más
#: alto), `nuevo` (un servidor donde no jugaste antes en la temporada) y, desde `NUEVAS_DESDE`: `arriba1`/`arriba2`
#: (rivales con letra uno o dos rangos arriba de la tuya, a los que les ganaste un duelo), `cuartos` y `podios` (en
#: cuántos eventos llegaste a cuartos o al podio), `paises` (de cuántos países distintos al tuyo son los rivales a los
#: que les ganaste), `formato` (cuántos eventos jugaste que no fueron 1 vs 1) y `chico` (un evento del servidor chico
#: de la semana: el `%s` del texto)
CATALOGO = {
    'facil': {
        'eventos2': ('Jugá 2 eventos', 'eventos', 2),
        'duelo1': ('Ganá un duelo', 'duelos', 1),
        'multi': ('Jugá un evento del servidor con el multiplicador más alto', 'multi', 1),
        'mundo1': ('Ganale un duelo a alguien de otro país', 'paises', 1, NUEVAS_DESDE),
        'formato': ('Jugá un evento que no sea 1 vs 1: 2 vs 2, pandillas, multiverse, 5 vidas…', 'formato', 1,
                    NUEVAS_DESDE),
    },
    'media': {
        'duelos3': ('Ganá 3 duelos', 'duelos', 3),
        'semis': ('Llegá a una semifinal', 'llego', 4),
        'nuevo': ('Jugá en un servidor donde todavía no jugaste esta temporada', 'nuevo', 1),
        'arriba1': ('Ganale un duelo a alguien de rango más alto que el tuyo', 'arriba1', 1, NUEVAS_DESDE),
        'eventos4': ('Jugá 4 eventos', 'eventos', 4, NUEVAS_DESDE),
        'cuartos2': ('Llegá a cuartos de final en 2 eventos', 'cuartos', 2, NUEVAS_DESDE),
        'mundo3': ('Ganale a raperos de 3 países distintos al tuyo', 'paises', 3, NUEVAS_DESDE),
        'chico': ('Jugá un evento de %s', 'chico', 1, NUEVAS_DESDE),
    },
    'dificil': {
        'final': ('Llegá a una final', 'llego', 2),
        'duelos5': ('Ganá 5 duelos', 'duelos', 5),
        'campeon': ('Ganá un evento', 'llego', 1),
        'arriba2': ('Ganale un duelo a alguien dos rangos más arriba que vos', 'arriba2', 1, NUEVAS_DESDE),
        'podios2': ('Hacé podio en 2 eventos', 'podios', 2, NUEVAS_DESDE),
    },
}
NIVELES = ('facil', 'media', 'dificil')
#: 🆕 de qué FAMILIA es cada cosa que se mide: desde `NUEVAS_DESDE` no salen dos de la misma en una semana
FAMILIA = {'eventos': 'eventos', 'duelos': 'duelos', 'llego': 'ronda', 'cuartos': 'ronda', 'podios': 'ronda',
           'multi': 'servidor', 'nuevo': 'servidor', 'chico': 'servidor', 'arriba1': 'rival', 'arriba2': 'rival',
           'paises': 'mundo', 'formato': 'formato'}
#: lo que se muestra como «llevás N de M» (el resto es de sí o no)
CUENTA = ('eventos', 'duelos', 'paises', 'cuartos', 'podios', 'formato', 'arriba1', 'arriba2')
#: «Ganale a alguien más fuerte» no se sortea con menos gente que esto con letra al empezar la semana (el arranque de
#: una temporada: nadie tiene 10 eventos)
ARRIBA_MIN = 8
#: el servidor chico de la semana: cuántos días antes mira (como `multiplicadores.chicos()`)
CHICO_DIAS = 14
#: el podio: los tres primeros puestos de `Resultados`
PODIO = ('campeon', 'subcampeon', 'tercero')
#: el formato que NO cumple «Formatos» (el nombre de `subir_web.formato_evento()`)
UNO_VS_UNO = '1 vs 1'
#: para «más fuerte», quien todavía no tiene letra cuenta como la E (la de abajo de todo): ganarle a una E no es
#: ganarle a alguien más fuerte —de quien no tiene letra todavía no se sabe dónde está, y puede tener nueve eventos y
#: buen Score—. Medido el 14/10 sobre las llaves de la semana: con -1 («antes de la E») la cumplían 14 y 13; así, 13 y 11
SIN_LETRA = 0
#: puntos de Temporada por misión cumplida, y el bono por las tres
PUNTOS = {'facil': 300, 'media': 600, 'dificil': 1000}
BONO = 1000
#: 🎯 LA CACERÍA: la cuarta misión, «ganale un duelo a X» (Dlx, 08/10/2026: *«en misiones agregar una misión que
#: diga caza a X persona (asegúrate que la persona sea activa)»*; a «¿un buscado diario o esta misión?», *«el que
#: consideres»*). X es la misma para todos y sale de los más activos: los `CAZA_TOP` con más eventos en los
#: `CAZA_DIAS` días antes de la semana —con dos o más, y alguno en la última semana—, sorteada con la semana como
#: semilla. Va aparte del bono, que sigue siendo por las tres de siempre. Desde la semana del lunes 12/10, con el Most
#: Wanted semanal: empezarla a mitad de una semana la daba por cumplida a gente que no sabía que existía
CAZA_DESDE = '2026-10-12'
PUNTOS_CAZA = 800
CAZA_TOP, CAZA_DIAS = 8, 14
#: ✨ EL EVENTO DORADO, UNA MISIÓN MÁS (Dlx, 12/10/2026: «4. Dale», a «el dorado sólo entre los servidores con pocos
#: eventos, y una de las misiones sea “Jugá el evento dorado”»). La idea es que toda la Liga empuje a UN evento chico
#: por semana en vez de repartirse: el organizador de un servidor con dos eventos por semana ve veinte personas en vez
#: de nueve. Se cumple jugando el evento dorado de la semana —el que `multiplicadores` anota como `dorado.n` cuando se
#: juega—, va aparte del bono como la cacería, y arranca la semana del lunes 19/10: ésta ya estaba sorteada
DORADO_DESDE = '2026-10-19'
PUNTOS_DORADO = 600
#: ✍️ EL WRITING CHALLENGE DE FFA, OTRA MISIÓN MÁS (Dlx, 14/10/2026: *«cuenta para la Liga»… «y quizás misión de la
#: semana también»*). «Participá del Writing Challenge», SÓLO las semanas en que FFA anuncia una fecha (la semana del
#: anuncio: `writing.semanas()`), y se cumple sumando en esa fecha (con 0 puntos, la rima con ❌, no). Va aparte del
#: bono, como la cacería y el dorado, y NO toca el sorteo: `elegir()` sigue sorteando las tres de siempre con la misma
#: semilla, y ésta se agrega después. Desde la semana del lunes 19/10 (la del 12 ya estaba sorteada); `None` la apaga
WRITING_DESDE = '2026-10-19'
PUNTOS_WRITING = 300
#: las que van aparte del bono (el bono es por las tres sorteadas)
APARTE = ('caza', 'dorado', 'writing')
#: hasta qué ronda llegó cada puesto de `Resultados` (como `rankings.LLEGO`)
LLEGO = {'campeon': 1, 'subcampeon': 2, 'tercero': 4, 'cuarto': 4, 'semifinal': 4, 'cuartos': 8,
         'octavos': 16, 'r32': 32, 'dieciseisavos': 32, 'r64': 64}

SALIDA = os.path.join(BASE, 'datos', 'misiones.json')


def _norm(s):
    import unicodedata
    s = unicodedata.normalize('NFD', str(s or '').lower())
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn').strip()


def _nombre_sv(sv):
    """El nombre de un servidor para leer («Snake Rap»), o su sigla si no se encuentra."""
    try:
        with io.open(os.path.join(BASE, 'datos', 'servidores.json'), encoding='utf-8') as f:
            x = (json.load(f).get('servidores') or {}).get(sv) or {}
        return x.get('nombre') or sv
    except (OSError, ValueError):
        return sv


def _desde_de(niv, i):
    """Desde qué semana se sortea la misión `i` (`''`: desde siempre)."""
    x = CATALOGO[niv][i]
    return x[3] if len(x) > 3 else ''


def _familia(i):
    return FAMILIA.get(_que(i), _que(i) or i)


def elegir(sem, anterior=None, no=()):
    """Las tres de la semana `sem` (su id, `2026-10-05`): `[[id, texto, nivel, meta, puntos], …]`, una por nivel.

    ⚠️ CON LA SEMANA COMO SEMILLA: la misma semana da siempre las mismas, en cualquier corrida y en cualquier máquina.
    `anterior` son los ids de la semana de antes: ninguna se repite seguida. `no` son las que esa semana no se pueden
    jugar (sin rivales con letra, sin servidor chico): salen del sorteo.

    ⚠️ UNA MISIÓN ENTRA DESDE SU SEMANA (el cuarto lugar de su fila en `CATALOGO`): las semanas de antes ven el mismo
    catálogo que cuando se sortearon, y con la misma semilla dan lo mismo. Y desde `NUEVAS_DESDE`, una por familia."""
    rnd = random.Random('misiones:' + str(sem))
    libres = {}
    for niv in NIVELES:
        ops = sorted(i for i in CATALOGO[niv] if _desde_de(niv, i) <= str(sem) and i not in no) or sorted(CATALOGO[niv])
        libres[niv] = [x for x in ops if x not in (anterior or ())] or ops
    if str(sem) >= NUEVAS_DESDE:
        # 🆕 LAS TRES JUNTAS, una por familia: elegir nivel por nivel a veces dejaba a la difícil sin ninguna libre de
        # otra familia (la de la semana pasada era la única), y ahí había que repetir familia o repetir misión.
        # Entre todos los tríos posibles no pasa nunca con este catálogo; si pasara, se repite familia, nunca misión
        trios = [t for t in ((f, m, d) for f in libres['facil'] for m in libres['media'] for d in libres['dificil'])
                 if len({_familia(i) for i in t}) == len(NIVELES)]
        if trios:
            elegidas = trios[rnd.randrange(len(trios))]
        else:
            elegidas = tuple(libres[niv][rnd.randrange(len(libres[niv]))] for niv in NIVELES)
    else:
        elegidas = tuple(libres[niv][rnd.randrange(len(libres[niv]))] for niv in NIVELES)
    out = []
    for niv, i in zip(NIVELES, elegidas):
        texto, _q, meta = CATALOGO[niv][i][:3]
        out.append([i, texto, niv, meta, PUNTOS[niv]])
    return out


def presa(sid, ini, evs, desde=None):
    """A quién se caza la semana `sid` (que empieza en `ini`): uno de los más activos de antes, o `None`.

    `evs` son las filas de `filas_de()`: `(num, sv, instante, quién, puesto)`. Activo es dos eventos o más en los
    `CAZA_DIAS` días antes y alguno en los últimos siete: alguien a quien de verdad se lo puede cruzar esta semana."""
    if sid < CAZA_DESDE:
        return None
    hace = ini - dt.timedelta(days=CAZA_DIAS)
    reciente = ini - dt.timedelta(days=7)
    cuantos, ult = {}, {}
    for e in evs:
        if e[2] is None or (desde and e[2] < desde) or not (hace <= e[2] < ini):
            continue
        cuantos.setdefault(e[3], set()).add(e[0])
        ult[e[3]] = max(ult.get(e[3], e[2]), e[2])
    act = sorted((q for q, ns in cuantos.items() if len(ns) >= 2 and ult[q] >= reciente),
                 key=lambda q: (-len(cuantos[q]), q))[:CAZA_TOP]
    if not act:
        return None
    return random.Random('caza:' + str(sid)).choice(act)


def servidor_chico(sid, ini, evs, desde=None, evitar=()):
    """🆕 El servidor de «Jugá un evento de X» de la semana `sid` (que empieza en `ini`), o `None`.

    Entre los que jugaron algún evento en los `CHICO_DIAS` días antes y tuvieron menos de `multiplicadores.DORADO_CHICO`
    (los mismos «chicos» que el dorado), sin los de `evitar` —el del dorado de esa semana— si queda otro. Sorteado con
    la semana como semilla. ⚠️ Si ninguno es chico, ninguno: «activate en FFA» no activa nada (Dlx, 12/10/2026, el
    porqué del dorado entre los chicos)."""
    import multiplicadores as MU
    hace = ini - dt.timedelta(days=CHICO_DIAS)
    n = {}
    for e in evs:
        if not e[1] or e[2] is None or (desde and e[2] < desde) or not (hace <= e[2] < ini):
            continue
        n.setdefault(e[1], set()).add(e[0])
    chicos = sorted(sv for sv, ns in n.items() if len(ns) < MU.DORADO_CHICO)
    ops = [sv for sv in chicos if sv not in (evitar or ())] or chicos
    return random.Random('chico:' + str(sid)).choice(ops) if ops else None


def _que(i):
    for niv in NIVELES:
        if i in CATALOGO[niv]:
            return CATALOGO[niv][i][1]
    return ''


def valor(i, ev, du, svs_antes, top):
    """Cuánto lleva alguien de la misión `i` en una semana: `ev` son sus filas de esa semana `(num, sv, t, puesto)`,
    `du` cuántos duelos ganó, `svs_antes` dónde jugó antes en la temporada y `top` los servidores del multiplicador
    más alto. Para lo que se cumple o no, 0 o 1; `llego` devuelve la mejor ronda (menor es mejor)."""
    q = _que(i)
    if q == 'eventos':
        return len({e[0] for e in ev})
    if q == 'duelos':
        return du
    if q == 'multi':
        # `top` es el conjunto de la semana o, desde el 05/10/2026, una función del instante (ver `calcular()`)
        en = top if callable(top) else (lambda _t: top)
        return int(any(e[1] in en(e[2]) for e in ev))
    if q == 'nuevo':
        return int(any(e[1] and e[1] not in svs_antes for e in ev))
    if q == 'llego':
        return min([LLEGO.get(e[3], 99) for e in ev] or [99])
    return 0


def cumplida(i, v, meta):
    return v <= meta if _que(i) == 'llego' else v >= meta


def avance(x, quien, s):
    """Cuánto lleva `quien` de la misión `x` (una fila de `lista`) en una semana: `s` es lo que arma `calcular()` —
    `ev` (sus eventos `(num, sv, t, puesto)`), `du` (duelos ganados), `contra` (a quiénes les ganó), `antes` (dónde
    jugó antes en la temporada), `top` (el multiplicador más alto), `rg` (`{nombre: nivel}` al empezar la semana),
    `pais` (`f(nombre) -> país`) y `formato` (`{num: formato}`)."""
    i, q = x[0], _que(x[0])
    ev = s['ev'].get(quien, [])
    gano = s['contra'].get(quien, set())
    if i == 'caza':
        return int(x[5] in gano)
    if i == 'dorado':
        return int(x[5] is not None and any(e[0] == x[5] for e in ev))
    if i == 'writing':
        return int(quien in (s.get('wr_q') or set()))
    if q == 'chico':
        return int(len(x) > 5 and bool(x[5]) and any(e[1] == x[5] for e in ev))
    if q == 'cuartos':
        return len({e[0] for e in ev if LLEGO.get(e[3], 99) <= 8})
    if q == 'podios':
        return len({e[0] for e in ev if e[3] in PODIO})
    if q == 'formato':
        fo = s.get('formato') or {}
        return len({e[0] for e in ev if fo.get(e[0]) not in (None, '', UNO_VS_UNO)})
    if q in ('arriba1', 'arriba2'):
        # ⚠️ al rival se le pide letra; a vos no: sin letra contás como la E (`SIN_LETRA`)
        rg, k = s.get('rg') or {}, 1 if q == 'arriba1' else 2
        yo = rg.get(quien, SIN_LETRA)
        return len({r for r in gano if r in rg and rg[r] - yo >= k})
    if q == 'paises':
        pais = s.get('pais') or (lambda _n: '')
        mio = pais(quien)
        if not mio:
            return 0
        return len({p for p in (pais(r) for r in gano) if p and p != mio})
    return valor(i, ev, s['du'].get(quien, 0), s['antes'].get(quien, set()), s['top'])


def filas_de(res, uno, instantes=None, canon=None, es_troll=None):
    """Las filas de `Resultados` y `1v1` como las piden las misiones: `(eventos, duelos)`, con
    `eventos = [(num, sv, instante, quién, puesto)]` y `duelos = [(num, instante, ganador)]`. Los nombres, canónicos
    (el mapa de AKAs) y sin los troll, como en las vitrinas."""
    import llaves_web as LW
    if instantes is None:
        try:
            instantes = LW.instantes()
        except Exception:                                # noqa: BLE001
            instantes = {}
    canon = canon or (lambda x: x)
    es_troll = es_troll or (lambda x: False)

    def cuando(num, fecha):
        ms = instantes.get(num) or LW.ms_de_fecha(str(fecha).strip())
        return dt.datetime.fromtimestamp(ms / 1000, dt.timezone.utc) if ms else None

    def _n(x):
        try:
            return int(float(str(x).strip() or 0))
        except ValueError:
            return 0
    evs = []
    for f in res or []:
        f = list(f) + [''] * 11
        quien = str(f[4]).strip()
        if not quien:
            continue
        quien = canon(quien)
        if es_troll(quien):
            continue
        num = _n(f[0])
        evs.append((num, str(f[2]).strip(), cuando(num, f[1]), quien, _norm(f[6])))
    dus = []
    for f in uno or []:
        f = list(f) + [''] * 9
        gan = str(f[6]).strip()
        if not gan or not str(f[4]).strip() or not str(f[5]).strip():
            continue
        gan = canon(gan)
        if es_troll(gan):
            continue
        num = _n(f[0])
        # y a quién le ganó: la cacería pide ganarle un duelo a alguien en particular
        perd = next((str(x).strip() for x in (f[4], f[5]) if str(x).strip() and canon(str(x).strip()) != gan), '')
        dus.append((num, cuando(num, f[1]), gan, canon(perd) if perd else ''))
    return evs, dus


def calcular(evs, dus, ahora, desde=None, mult=None, writing=None, ctx=None):
    """Semana por semana desde `DESDE` (y desde `desde`, el arranque de la temporada): las misiones, quién cumplió
    qué y cuánto suma cada uno. `mult` es `multiplicadores.leer()` (para «el servidor con el multiplicador más alto»).
    `writing` es `writing.semanas()`: `[(instante del anuncio, fecha, {quiénes sumaron})]`.
    `ctx`, lo que piden las familias nuevas (ver `contexto()`): `rangos` (`f(inicio) -> {nombre: nivel}`), `pais`
    (`f(nombre) -> país`) y `formato` (`{num: formato}`). Sin `ctx`, nadie las cumple —y las de rango no se sortean—.
    """
    ctx = ctx or {}
    import multiplicadores as MU
    sem_hoy, ini_hoy, fin_hoy = MU.periodo(ahora)
    semanas = {}
    for e in evs:
        if e[2] is None or (desde and e[2] < desde):
            continue
        sid, ini, fin = MU.periodo(e[2])
        if sid >= DESDE:
            semanas.setdefault(sid, (ini, fin))
    if sem_hoy >= DESDE:
        semanas.setdefault(sem_hoy, (ini_hoy, fin_hoy))
    # ✍️ las semanas con una fecha del Writing: `{semana: ([fechas], {quiénes sumaron})}`
    wr_sem = {}
    for t, n, quienes in writing or []:
        if t is None or (desde and t < desde) or not WRITING_DESDE:
            continue
        sid, ini, fin = MU.periodo(t)
        if sid >= WRITING_DESDE and sid >= DESDE:
            semanas.setdefault(sid, (ini, fin))
            w = wr_sem.setdefault(sid, ([], set()))
            w[0].append(n)
            w[1].update(quienes or ())
    # 🔴 EL SERVIDOR DEL MULTIPLICADOR MÁS ALTO EN EL MOMENTO DE CADA EVENTO (revisión del 05/10/2026), no el de la
    # semana entera: con un cambio a mano desde el Dashboard a mitad de semana (`tramos`), los eventos de antes se
    # volvían a medir contra el nuevo y alguien ganaba o perdía la misión —y sus puntos— para atrás. Es lo mismo que
    # hace `multiplicadores.factor_de()` con los puntos: el sorteo, y cada tramo desde su `desde`
    def _top(sv):
        if not sv:
            return set()
        m = max(sv.values())
        return {k for k, v in sv.items() if v == m}
    tops = {}
    # ✨ el dorado de cada semana: `{id: (servidor, número del evento si ya se jugó)}`
    dorados = {str(s.get('id') or ''): ((s.get('dorado') or {}).get('sv') or '', (s.get('dorado') or {}).get('n'))
               for s in (mult or {}).get('semanas') or [] if s.get('dorado')}
    for s in (mult or {}).get('semanas') or []:
        base = s.get('sv_sorteo') or s.get('sv') or {}
        tramos = []
        for t in s.get('tramos') or []:
            try:
                tramos.append((MU._de_iso(t['desde']), t.get('sv') or {}))
            except (KeyError, TypeError, ValueError):
                continue
        tramos.sort(key=lambda x: x[0])

        def en(t, base=base, tramos=tramos):
            sv = base
            for desde, sv2 in tramos:
                if t is not None and desde <= t:
                    sv = sv2
            return _top(sv)
        tops[str(s.get('id') or '')] = en
    out_sem, suma, anterior = {}, {}, None
    for sid in sorted(semanas):
        ini, fin = semanas[sid]
        # 🆕 lo que esa semana no se puede jugar sale del sorteo: sin gente con letra al empezar, «más fuerte» no
        # tiene a quién; sin servidor chico, «activate en X» tampoco. Sólo desde `NUEVAS_DESDE`: antes no existían
        no, rg, sv_chico = set(), {}, None
        if sid >= NUEVAS_DESDE:
            rg = ctx['rangos'](ini) if ctx.get('rangos') else {}
            if len(rg) < ARRIBA_MIN:
                no |= {'arriba1', 'arriba2'}
            sv_chico = servidor_chico(sid, ini, evs, desde, evitar=(dorados.get(sid, ('', None))[0],))
            if not sv_chico:
                no.add('chico')
        lista = elegir(sid, anterior, no)
        anterior = [x[0] for x in lista]
        for x in lista:
            if x[0] == 'chico':
                x[1] = x[1] % _nombre_sv(sv_chico)
                x.append(sv_chico)
        x_caza = presa(sid, ini, evs, desde)
        if x_caza:
            lista.append(['caza', 'Ganale un duelo a %s' % x_caza, 'caza', 1, PUNTOS_CAZA, x_caza])
        if sid >= DORADO_DESDE and sid in dorados:
            sv_d, n_d = dorados[sid]
            # 🆕 con su servidor al final (`x[6]`): la página pone su escudo
            lista.append(['dorado', 'Jugá el evento dorado de %s' % _nombre_sv(sv_d), 'dorado', 1, PUNTOS_DORADO,
                          n_d, sv_d])
        wr_f, wr_q = wr_sem.get(sid) or ([], set())
        if wr_f:
            lista.append(['writing', 'Participá del Writing Challenge de FFA', 'writing', 1, PUNTOS_WRITING,
                          sorted(wr_f)])
        ev_s, svs_antes = {}, {}
        for e in evs:
            if e[2] is None or (desde and e[2] < desde):
                continue
            if ini <= e[2] < fin:
                ev_s.setdefault(e[3], []).append((e[0], e[1], e[2], e[4]))
            elif e[2] < ini:
                svs_antes.setdefault(e[3], set()).add(e[1])
        du_s, contra = {}, {}
        for d in dus:
            if d[1] is not None and ini <= d[1] < fin and not (desde and d[1] < desde):
                du_s[d[2]] = du_s.get(d[2], 0) + 1
                if len(d) > 3 and d[3]:
                    contra.setdefault(d[2], set()).add(d[3])
        s = {'ev': ev_s, 'du': du_s, 'contra': contra, 'antes': svs_antes, 'top': tops.get(sid, set()), 'rg': rg,
             'pais': ctx.get('pais'), 'formato': ctx.get('formato') or {}}
        prog, pts = {}, {}
        s['wr_q'] = wr_q if wr_f else set()
        # ✍️ quien sólo escribió esa semana también tiene su fila: la misión del Writing no pide jugar un evento
        for quien in sorted(set(ev_s) | set(du_s) | s['wr_q']):
            vs = [avance(x, quien, s) for x in lista]
            hechas = [cumplida(x[0], v, x[3]) for x, v in zip(lista, vs)]
            # ⚠️ el bono es por las tres de siempre: la cacería, el dorado y el Writing van aparte
            p = sum(x[4] for x, h in zip(lista, hechas) if h) + (
                BONO if all(h for x, h in zip(lista, hechas) if x[0] not in APARTE) else 0)
            prog[quien] = vs
            if p:
                pts[quien] = p
                suma[quien] = suma.get(quien, 0) + p
        out_sem[sid] = {'lista': lista, 'prog': prog, 'pts': pts,
                        'fin': fin.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}
    return {'sem': sem_hoy, 'semanas': out_sem, 'suma': suma}


#: el nivel de cada letra para «más fuerte»: E 0 … SSS 7 (sin letra, `SIN_LETRA`)
def _niveles_rango():
    from comun.rangos import ORDEN
    return {r: len(ORDEN) - 1 - i for i, r in enumerate(ORDEN)}


def rangos_al(res, evs, desde=None, canon=None):
    """🆕 `f(inicio) -> {nombre: nivel}`: el rango que cada uno tenía AL EMPEZAR una semana, de las filas de
    `Resultados` jugadas antes (el instante de cada evento, el de `evs`).

    ⚠️ LA MISMA CUENTA QUE LA VITRINA (`rankings.rangos_estricto()`: el Score de `sheet/competitivo.py`, la puerta de 10
    eventos y `comun/rangos.de_score()`), pero que SÍ levanta si algo falla: `rangos_de()` contesta `{}` y eso sería
    «nadie tiene letra», que saca a «más fuerte» del sorteo y cambia las misiones de toda la semana. Mejor que esa
    corrida no escriba (`rankings._semanales()` lo ataja) y quede lo de la anterior."""
    import rankings as RK
    canon = canon or RK.canon
    niv = _niveles_rango()
    t_de = {}
    for e in evs:
        if e[2] is not None:
            t_de.setdefault(e[0], e[2])
    memo = {}

    def _n(x):
        try:
            return int(float(str(x).strip() or 0))
        except ValueError:
            return 0

    def f(ini):
        k = ini.isoformat()
        if k not in memo:
            filas = []
            for r in res or []:
                t = t_de.get(_n((list(r) or [''])[0]))
                if t is not None and t < ini and not (desde and t < desde):
                    filas.append(r)
            out = {}
            for q, letra in (RK.rangos_estricto(filas) if filas else {}).items():
                c = canon(str(q).strip())
                out[c] = max(out.get(c, -1), niv.get(letra, -1))
            memo[k] = out
        return memo[k]
    return f


def pais_de():
    """🆕 `f(nombre) -> país` del padrón (`datos/padron.json`), o `''`. Primero el nombre tal cual; si no, normalizado
    (sin banderas ni tildes), salvo que ese normalizado sea de dos personas con distinto país: no se adivina."""
    import construir_padron as PAD
    exacto, por, dobles = {}, {}, set()
    for x in PAD.cargar() or []:
        raw, p = str(x.get('raw') or '').strip(), str(x.get('pais') or '').strip()
        if not raw or not p:
            continue
        exacto.setdefault(raw, p)
        n = PAD.norm(raw)
        if n in por and por[n] != p:
            dobles.add(n)
        por.setdefault(n, p)
    for n in dobles:
        por.pop(n, None)
    return lambda nombre: exacto.get(str(nombre or '').strip()) or por.get(PAD.norm(nombre or '')) or ''


def formatos(regs=None):
    """🆕 `{num: formato}` de los eventos de `datos/llaves_t1.json`, con el nombre de `subir_web.formato_evento()` (el
    mismo que muestra la página en «Cómo se juega»: la forma de la llave, el anuncio y el título)."""
    import subir_web as SW
    if regs is None:
        try:
            with io.open(os.path.join(BASE, 'datos', 'llaves_t1.json'), encoding='utf-8') as f:
                regs = json.load(f) or {}
        except (OSError, ValueError):
            regs = {}
    try:
        with io.open(os.path.join(BASE, 'datos', 'formatos_llaves.json'), encoding='utf-8') as f:
            an = (json.load(f) or {}).get('eventos') or {}
    except (OSError, ValueError):
        an = {}
    out = {}
    for n, v in (regs or {}).items():
        if str(n).isdigit() and isinstance(v, dict):
            clave = '|'.join((v.get('nombre') or '', v.get('sv') or '', v.get('fecha') or ''))
            out[int(n)] = SW.formato_evento(v, an.get(clave, ''))
    return out


def contexto(res, evs, desde=None, canon=None):
    """🆕 Lo que piden las familias nuevas (`calcular(ctx=…)`): el rango al empezar cada semana, el país y el formato."""
    return {'rangos': rangos_al(res, evs, desde, canon), 'pais': pais_de(), 'formato': formatos()}


def correr(res=None, uno=None, ahora=None, aplicar=False):
    """Lo de esta temporada desde `Resultados` y `1v1` (si no vienen, se leen); con `aplicar`, a `datos/misiones.json`."""
    import multiplicadores as MU
    import rankings as RK
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    if res is None or uno is None:
        from escribir import Hoja
        res = Hoja('Resultados').filas() if res is None else res
        uno = Hoja('1v1').filas() if uno is None else uno
    # ⚠️ EL ARRANQUE CORTA SÓLO CUANDO YA PASÓ, como en las divisiones (ver `divisiones.correr()`)
    desde = MU._arranque()
    if desde and desde > ahora:
        desde = None
    evs, dus = filas_de(res, uno, canon=RK.canon, es_troll=RK._trolls())
    # ✍️ las fechas del Writing Challenge (`bot/writing.py`), con los nombres canónicos como las llaves. Sin archivo,
    # no hay misión del Writing esa vez: nunca frena las demás
    try:
        import writing as WR
        wr = WR.semanas(canon=RK.canon, es_troll=RK._trolls())
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ el Writing Challenge no entra a las misiones: %s' % str(e)[:80])
        wr = None
    c = calcular(evs, dus, ahora, desde, MU.leer(), wr, contexto(res, evs, desde, RK.canon))
    out = {'_leeme': 'Las misiones de la semana: las arma bot/misiones.py en el paso 1c, enteras en cada corrida. '
                     'Las reglas y los números viven en ese archivo. `suma` es lo que cada uno lleva sumado a la '
                     'Temporada; `semanas`, qué tocó cada semana y quién cumplió.',
           'sem': c['sem'], 'bono': BONO, 'semanas': c['semanas'], 'suma': c['suma'],
           # 🔴 de qué temporada es (revisión del 05/10/2026): `rankings.sumar_misiones()` suma lo de la corrida
           # anterior, y el día que arranca la T1 eso era lo de la prueba —hasta 2.900 por persona— sumado a la T1
           'temp': MU.temporada_actual(ahora)}
    if aplicar:
        with io.open(SALIDA, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(out, f, ensure_ascii=False, indent=1, sort_keys=True)
            f.write('\n')
    return out


def leer(ruta=None):
    """`datos/misiones.json`, o `{}`."""
    try:
        with io.open(ruta or SALIDA, encoding='utf-8') as f:
            return json.load(f) or {}
    except (OSError, ValueError):
        return {}


def para_web(d):
    """Lo de la semana para la página: `{sem, fin, lista, bono, prog, pts, total}`, o `None` si todavía no hay.

    ⚠️ EL PROGRESO VA LISTO PARA MOSTRAR: «cuánto llevás de cuánto», con la meta `m` de cada misión. Las de llegar a
    una ronda o de jugar en un servidor son de sí o no (`m` = 1), y `llego` (la mejor ronda, menor es mejor) no se
    entiende en una barra."""
    d = d or {}
    s = (d.get('semanas') or {}).get(d.get('sem') or '')
    if not s:
        return None
    lista = s.get('lista') or []
    metas = [x[3] if _que(x[0]) in CUENTA else 1 for x in lista]

    def mostrar(vs):
        out = []
        for x, m, v in zip(lista, metas, vs):
            out.append(min(v, m) if _que(x[0]) in CUENTA else int(cumplida(x[0], v, x[3])))
        return out

    def fila(x, m):
        # 🆕 `q`: qué mide, para que la página diga en palabras lo que falta. `x`: la presa de la cacería (su cara y su
        # carta) o el servidor chico; `sv`: el servidor de la misión, para su escudo (el chico y el dorado)
        out = {'id': x[0], 't': x[1], 'n': x[2], 'm': m, 'p': x[4], 'q': _que(x[0]) or x[0]}
        if x[0] in ('caza', 'chico') and len(x) > 5 and x[5]:
            out['x'] = x[5]
        if x[0] == 'chico' and len(x) > 5 and x[5]:
            out['sv'] = x[5]
        if x[0] == 'dorado' and len(x) > 6 and x[6]:
            out['sv'] = x[6]
        return out
    return {'sem': d['sem'], 'fin': s.get('fin'), 'bono': d.get('bono', BONO),
            'lista': [fila(x, m) for x, m in zip(lista, metas)],
            'prog': {q: mostrar(vs) for q, vs in (s.get('prog') or {}).items()},
            'pts': s.get('pts') or {}, 'total': d.get('suma') or {}}


def _self_check_nuevas(ok):
    """🆕 Las familias nuevas (14/10/2026): cada tipo con filas inventadas, el sorteo y lo que no se mueve."""
    print('\n   — las familias nuevas, desde la semana del %s —' % NUEVAS_DESDE)
    U = dt.timezone.utc
    # ⚠️ LO YA SORTEADO NO SE MUEVE: las dos semanas que ya se jugaron, como salieron (datos/misiones.json)
    a = elegir('2026-10-05')
    b = elegir('2026-10-12', [x[0] for x in a])
    ok([x[0] for x in a] == ['multi', 'duelos3', 'final'] and [x[0] for x in b] == ['eventos2', 'semis', 'campeon'],
       'las semanas del 05/10 y del 12/10 siguen dando lo que dieron  %s %s' % ([x[0] for x in a], [x[0] for x in b]))
    nuevas = {i for niv in NIVELES for i in CATALOGO[niv] if _desde_de(niv, i)}
    antes, ant = [], None
    d = dt.date(2026, 9, 28)
    while d.isoformat() < NUEVAS_DESDE:
        lst = elegir(d.isoformat(), ant)
        ant = [x[0] for x in lst]
        antes += ant
        d += dt.timedelta(days=7)
    ok(not set(antes) & nuevas, 'antes del %s no sale ninguna nueva' % NUEVAS_DESDE)
    vistas, mala, ant = set(), [], None
    for k in range(52):
        sid = (dt.date(2026, 10, 19) + dt.timedelta(days=7 * k)).isoformat()
        lst = elegir(sid, ant)
        fams = [_familia(x[0]) for x in lst]
        if len(set(fams)) != len(fams) or (ant and any(x[0] == y for x, y in zip(lst, ant))):
            mala.append(sid)
        ant = [x[0] for x in lst]
        vistas |= set(ant)
    ok(not mala and nuevas <= vistas,
       'desde el 19/10: una por familia, ninguna repetida en su nivel, y en un año salen todas las nuevas  %s'
       % (mala or sorted(nuevas - vistas)))
    sin = [x[0] for k in range(52) for x in elegir((dt.date(2026, 10, 19) + dt.timedelta(days=7 * k)).isoformat(),
                                                   None, {'arriba1', 'arriba2', 'chico'})]
    ok(not {'arriba1', 'arriba2', 'chico'} & set(sin), 'lo que no se puede jugar esa semana no se sortea')
    # cada tipo, con una semana armada a mano
    tA = dt.datetime(2026, 10, 21, 1, 0, tzinfo=U)
    paises = {'Ana': 'Argentina', 'Bea': 'Argentina', 'Cid': 'Chile', 'Dan': 'Colombia', 'Eva': 'Perú',
              'Fer': 'Argentina'}
    s = {'ev': {'Ana': [(60, 'FFA', tA, 'cuartos'), (61, 'SR', tA, 'tercero'), (62, 'FFA', tA, 'campeon'),
                        (63, 'FFA', tA, 'cuarto')],
                'Bea': [(61, 'SR', tA, 'octavos')]},
         'du': {'Ana': 4, 'Bea': 2}, 'antes': {}, 'top': set(),
         'contra': {'Ana': {'Bea', 'Cid', 'Dan', 'Eva'}, 'Bea': {'Ana', 'Fer'}},
         # Ana es E, Cid y Fer D, Dan B; Bea y Eva todavía no tienen letra
         'rg': {'Ana': 0, 'Cid': 1, 'Fer': 1, 'Dan': 3},
         'pais': lambda n: paises.get(n, ''),
         'formato': {60: '2 vs 2', 61: UNO_VS_UNO, 62: UNO_VS_UNO}}

    def fila(i, extra=None):
        for niv in NIVELES:
            if i in CATALOGO[niv]:
                t, _q, m = CATALOGO[niv][i][:3]
                return [i, t, niv, m, PUNTOS[niv]] + ([extra] if extra else [])
    hecha = lambda i, q, extra=None: cumplida(i, avance(fila(i, extra), q, s), fila(i)[3])    # noqa: E731
    ok(hecha('eventos4', 'Ana') and not hecha('eventos4', 'Bea'), 'Constancia: Ana jugó 4 eventos; Bea, uno')
    ok(avance(fila('cuartos2'), 'Ana', s) == 4 and hecha('cuartos2', 'Ana') and not hecha('cuartos2', 'Bea'),
       'Constancia: llegar a cuartos cuenta también llegar más lejos (Ana, en los 4); Bea se fue en octavos')
    ok(avance(fila('podios2'), 'Ana', s) == 2 and hecha('podios2', 'Ana'),
       'Constancia: podio es 1.º, 2.º o 3.º: el cuarto puesto no es podio (Ana, 2 de 4)')
    ok(hecha('formato', 'Ana') and not hecha('formato', 'Bea'),
       'Formatos: Ana jugó un 2 vs 2; Bea sólo un 1 vs 1, y un evento sin formato conocido no cuenta')
    ok(avance(fila('mundo3'), 'Ana', s) == 3 and hecha('mundo3', 'Ana') and hecha('mundo1', 'Ana')
       and not hecha('mundo1', 'Bea'),
       'Mundo: Ana (AR) le ganó a Chile, Colombia y Perú —a Bea, de su país, no cuenta—; Bea sólo a argentinos')
    ok(avance(fila('arriba1'), 'Ana', s) == 2 and hecha('arriba2', 'Ana') and avance(fila('arriba1'), 'Bea', s) == 1
       and not hecha('arriba2', 'Bea') and not hecha('arriba1', 'Cid'),
       'Más fuerte: Ana (E) le ganó a una D y a una B (dos arriba); Bea, sin letra, cuenta como E: ganarle a Ana (E) '
       'no, a Fer (D) sí (uno arriba, no dos); y ganarle a quien no tiene letra no cuenta')
    ok(hecha('chico', 'Ana', 'SR') and not hecha('chico', 'Bea', 'URBF') and not hecha('chico', 'Ana', None),
       'Activate: jugar un evento de ESE servidor')
    # el servidor chico: entre los que juegan poco, no el del dorado, y si ninguno es chico, ninguno
    ini = dt.datetime(2026, 10, 19, 15, 0, tzinfo=U)
    evc = [(100 + j, 'FFA', ini - dt.timedelta(days=1 + j % 10), 'x', '') for j in range(10)] + \
        [(200, 'SR', ini - dt.timedelta(days=2), 'x', ''), (201, 'SR', ini - dt.timedelta(days=3), 'x', ''),
         (202, 'URBF', ini - dt.timedelta(days=5), 'x', ''), (203, 'ACAD', ini - dt.timedelta(days=20), 'x', '')]
    c1 = servidor_chico('2026-10-19', ini, evc, evitar=('SR',))
    ok(c1 == 'URBF' and servidor_chico('2026-10-19', ini, evc) in ('SR', 'URBF')
       and servidor_chico('2026-10-19', ini, evc[:10]) is None,
       'el chico sale entre los que juegan poco (no FFA, con 10; no ACAD, que no jugó en 14 días), no es el del dorado '
       '(SR), y si sólo juega uno grande, no hay misión')
    # la cuenta entera: ocho semanas desde el 19/10, con y sin rangos
    gente = ['P%02d' % j for j in range(12)]
    evw, duw = [], []
    for k in range(-2, 8):
        t = dt.datetime(2026, 10, 21, 1, 0, tzinfo=U) + dt.timedelta(days=7 * k)
        for j, q in enumerate(gente):
            evw.append((300 + k * 10 + j % 3, ('FFA', 'SR', 'URBF')[j % 3], t, q,
                        ('campeon', 'subcampeon', 'tercero', 'cuartos', 'octavos')[j % 5]))
        for j in range(0, 12, 2):
            duw.append((300 + k * 10, t, gente[j], gente[(j + 5) % 12]))
    rgs = {q: j % 8 for j, q in enumerate(gente)}
    ctx = {'rangos': lambda _i: rgs, 'pais': lambda n: ('Argentina', 'Chile', 'Perú')[int(n[1:]) % 3],
           'formato': {300 + k * 10: '2 vs 2' for k in range(8)}}
    rw = calcular(evw, duw, dt.datetime(2026, 12, 15, 12, 0, tzinfo=U), None, None, ctx=ctx)
    sems = [x for x in sorted(rw['semanas']) if x >= NUEVAS_DESDE]
    cuenta_bien = True
    for sid in sems:
        sx = rw['semanas'][sid]
        for q, vs in sx['prog'].items():
            h = [cumplida(x[0], v, x[3]) for x, v in zip(sx['lista'], vs)]
            p = sum(x[4] for x, y in zip(sx['lista'], h) if y)
            p += BONO if all(y for x, y in zip(sx['lista'], h) if x[0] not in ('caza', 'dorado')) else 0
            cuenta_bien &= (sx['pts'].get(q, 0) == p)
    salen = {x[0] for sid in sems for x in rw['semanas'][sid]['lista']}
    ok(len(sems) >= 8 and cuenta_bien and salen & nuevas
       and [x[0] for x in rw['semanas']['2026-10-05']['lista']] == ['multi', 'duelos3', 'final'],
       'la cuenta entera: lo de cada uno es lo de sus cumplidas más el bono, salen nuevas, y la semana del 05/10 no '
       'cambió  %s' % sorted(salen & nuevas))
    chicas = [x for sid in sems for x in rw['semanas'][sid]['lista'] if x[0] == 'chico']
    ok(all('%s' not in x[1] and len(x) > 5 and x[5] for x in chicas),
       '«Jugá un evento de X» lleva el servidor en el texto y en la fila  %s' % [x[1] for x in chicas][:2])
    r0 = calcular(evw, duw, dt.datetime(2026, 12, 15, 12, 0, tzinfo=U), None, None, ctx={})
    ok(not [x for sid in r0['semanas'] for x in r0['semanas'][sid]['lista'] if x[0] in ('arriba1', 'arriba2')],
       'sin nadie con letra al empezar la semana, «más fuerte» no se sortea')
    # el rango AL EMPEZAR la semana: sólo las filas de antes del lunes
    import rankings as RK
    real, vio = RK.rangos_estricto, []
    RK.rangos_estricto = lambda filas: (vio.append(len(filas)), {str(f[4]): 'A' for f in filas})[1]
    try:
        res = [[70, '', 'FFA', '', 'Ana'], [71, '', 'FFA', '', 'Bea']]
        ev_r = [(70, 'FFA', ini - dt.timedelta(days=1), 'Ana', ''), (71, 'FFA', ini + dt.timedelta(days=1), 'Bea', '')]
        f = rangos_al(res, ev_r, None, canon=lambda x: x)
        g = f(ini)
        ok(g == {'Ana': _niveles_rango()['A']} and f(ini) is g and vio == [1],
           'el rango es el de antes del lunes: lo que Bea jugó el martes no cuenta, y se calcula una vez por semana')
    finally:
        RK.rangos_estricto = real
    # el país del padrón: exacto primero; normalizado sólo si no es de dos personas con distinto país
    import construir_padron as PAD
    real = PAD.cargar
    PAD.cargar = lambda: [{'raw': 'Volk', 'pais': 'México'}, {'raw': 'volk', 'pais': 'Colombia'},
                          {'raw': 'SOL', 'pais': 'Perú'}, {'raw': 'SOL🇵🇪', 'pais': 'Perú'}]
    try:
        p = pais_de()
        ok(p('Volk') == 'México' and p('volk') == 'Colombia' and p('VOLK') == '' and p('sol') == 'Perú' and p('X') == '',
           'el país: el nombre exacto; «VOLK» no se adivina (dos personas), «sol» sí (las dos filas son de Perú)')
    finally:
        PAD.cargar = real
    fo = formatos({'60': {'nombre': 'DESGRACIAS EN TOKYO VOL 18 2VS2', 'rondas': []},
                   '61': {'nombre': 'COPA', 'rondas': []}, 'x': {}})
    ok(fo == {60: '2 vs 2', 61: UNO_VS_UNO}, 'el formato de cada evento sale de subir_web.formato_evento()  %s' % fo)
    w = para_web({'sem': '2026-10-19', 'suma': {}, 'semanas': {'2026-10-19': {
        'fin': '2026-10-26T15:00:00Z', 'pts': {},
        'lista': [fila('mundo1'), fila('chico', 'SR'), fila('mundo3'), ['caza', 'Ganale un duelo a Dan', 'caza', 1,
                                                                        PUNTOS_CAZA, 'Dan'],
                  ['dorado', 'Jugá el evento dorado de Urban', 'dorado', 1, PUNTOS_DORADO, None, 'URBF']],
        'prog': {'Ana': [1, 0, 2, 1, 0]}}}})
    L = w['lista']
    ok([x['q'] for x in L] == ['paises', 'chico', 'paises', 'caza', 'dorado'] and L[1]['sv'] == 'SR' == L[1]['x']
       and L[3]['x'] == 'Dan' and L[4]['sv'] == 'URBF' and L[2]['m'] == 3 and w['prog']['Ana'] == [1, 0, 2, 1, 0],
       'la página recibe qué mide cada una, la presa, el servidor y «2 de 3 países»')


def _self_check():
    print('\n══ LAS MISIONES DE LA SEMANA ══\n')
    mal = 0

    def ok(c, q):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '🔴', q))
    a, b = elegir('2026-10-05'), elegir('2026-10-05')
    ok(a == b and [x[2] for x in a] == list(NIVELES), 'la misma semana da las mismas tres: una de cada nivel')
    c = elegir('2026-10-12', [x[0] for x in a])
    ok(all(x[0] != y[0] for x, y in zip(a, c)), 'y la semana siguiente ninguna se repite en su nivel')
    U = dt.timezone.utc
    t1 = dt.datetime(2026, 10, 6, 1, 0, tzinfo=U)       # lunes 5/10, 9 PM ET: ya es la semana del 5
    t0 = dt.datetime(2026, 10, 1, 1, 0, tzinfo=U)       # la semana de antes
    evs = [(10, 'FFA', t0, 'Ana', 'octavos'),
           (20, 'FFA', t1, 'Ana', 'campeon'), (21, 'DRA', t1, 'Ana', 'cuartos'),
           (20, 'FFA', t1, 'Bea', 'subcampeon')]
    dus = [(20, t1, 'Ana'), (20, t1, 'Ana'), (20, t1, 'Ana'), (21, t1, 'Ana'), (21, t1, 'Ana'), (20, t1, 'Bea')]
    ahora = dt.datetime(2026, 10, 7, 12, 0, tzinfo=U)
    r = calcular(evs, dus, ahora, None, {'semanas': [{'id': '2026-10-05', 'sv': {'DRA': 2, 'FFA': 1}}]})
    s = r['semanas'].get('2026-10-05') or {}
    lista = s.get('lista') or []
    ok(r['sem'] == '2026-10-05' and '2026-09-28' not in r['semanas'], 'las misiones arrancan la semana del 5/10')
    ok(r['suma'].get('Ana') == sum(PUNTOS.values()) + BONO,
       'Ana cumple las tres (2 eventos, 5 duelos, campeona, en DRA y en un servidor nuevo): las tres y el bono '
       '(%s)' % [x[0] for x in lista])
    ok(0 < r['suma'].get('Bea', 0) < sum(PUNTOS.values()), 'Bea cumple algunas: suma sólo las suyas, sin el bono')
    ok(valor('nuevo', [(21, 'DRA', t1, 'cuartos')], 0, {'FFA'}, set()) == 1
       and valor('nuevo', [(20, 'FFA', t1, 'campeon')], 0, {'FFA'}, set()) == 0,
       '«un servidor nuevo» mira dónde jugaste antes en la temporada')
    ok(cumplida('final', 1, 2) and not cumplida('final', 4, 2) and cumplida('semis', 2, 4),
       'llegar más lejos también cumple: campeón cumple «llegá a una final»')
    w = para_web({'sem': '2026-10-05', 'semanas': {'2026-10-05': s}, 'suma': r['suma']})
    ok(w and len(w['lista']) == 3 and w['total'] == r['suma'], 'la página recibe las tres, el progreso y lo sumado')
    ok(para_web({}) is None, 'sin semana, nada para la página')
    # 🎯 la cacería: la presa es de los activos, la misma para todos, y se cumple ganándole un duelo
    t2 = dt.datetime(2026, 10, 13, 1, 0, tzinfo=U)       # lunes 12/10, 9 PM ET: la semana del 12
    tv = dt.datetime(2026, 10, 8, 1, 0, tzinfo=U)
    evs2 = evs + [(30, 'FFA', tv, 'Ana', 'octavos'), (31, 'FFA', tv, 'Ana', 'cuartos'), (30, 'FFA', tv, 'Cid', 'r32'),
                  (40, 'FFA', t2, 'Bea', 'campeon'), (40, 'FFA', t2, 'Ana', 'subcampeon')]
    dus2 = dus + [(40, t2, 'Bea', 'Ana')]
    r2 = calcular(evs2, dus2, dt.datetime(2026, 10, 14, 12, 0, tzinfo=U))
    s2 = r2['semanas'].get('2026-10-12') or {}
    cz = [x for x in s2.get('lista') or [] if x[0] == 'caza']
    ok(not [x for x in lista if x[0] == 'caza'] and len(cz) == 1 and cz[0][5] == 'Ana',
       'la cacería arranca la semana del 12/10, y la presa es la activa (Ana: 3 eventos), no Cid (1)')
    ok((s2.get('pts') or {}).get('Bea', 0) >= PUNTOS_CAZA and (s2['prog']['Bea'][-1] == 1),
       'Bea le ganó un duelo a Ana: cumple la cacería y suma sus %d' % PUNTOS_CAZA)
    ok(presa('2026-10-12', t2, evs2) == presa('2026-10-12', t2, evs2) and presa('2026-10-05', t1, evs2) is None,
       'la misma semana, la misma presa; y antes del 12/10, ninguna')
    # ✨ el evento dorado: una misión más desde la semana del 19/10, que se cumple jugando ESE evento
    t3 = dt.datetime(2026, 10, 21, 1, 0, tzinfo=U)       # martes 20/10, 9 PM ET: la semana del 19
    evs3 = evs2 + [(50, 'SR', t3, 'Cid', 'octavos'), (51, 'FFA', t3, 'Bea', 'campeon')]
    m3 = {'semanas': [{'id': '2026-10-12', 'sv': {}, 'dorado': {'sv': 'SR', 'desde': '2026-10-14T04:00:00Z', 'n': 40}},
                      {'id': '2026-10-19', 'sv': {}, 'dorado': {'sv': 'SR', 'desde': '2026-10-20T04:00:00Z', 'n': 50}}]}
    r3 = calcular(evs3, dus2, dt.datetime(2026, 10, 22, 12, 0, tzinfo=U), None, m3)
    s3 = r3['semanas'].get('2026-10-19') or {}
    do = [x for x in s3.get('lista') or [] if x[0] == 'dorado']
    ok(len(do) == 1 and do[0][5] == 50 and not [x for x in r3['semanas']['2026-10-12']['lista'] if x[0] == 'dorado'],
       'el dorado es misión desde la semana del 19/10 (la del 12 ya estaba sorteada)')
    ok(s3['prog']['Cid'][-1] == 1 and s3['prog']['Bea'][-1] == 0 and (s3['pts'].get('Cid') or 0) >= PUNTOS_DORADO,
       'Cid jugó el dorado (#50) y la cumple; Bea ganó otro evento y no')
    # ✍️ el Writing Challenge: una misión más SÓLO la semana de una fecha, sin tocar el sorteo ni el bono
    tw = dt.datetime(2026, 10, 20, 19, 0, tzinfo=U)       # martes 20/10: FFA anuncia la fecha 3
    wr = [(dt.datetime(2026, 10, 14, 19, 0, tzinfo=U), 2, {'Ana'}), (tw, 3, {'Cid', 'Dan'})]
    r4 = calcular(evs3, dus2, dt.datetime(2026, 10, 22, 12, 0, tzinfo=U), None, m3, wr)
    s4, s4b = r4['semanas'].get('2026-10-19') or {}, r4['semanas'].get('2026-10-12') or {}
    w4 = [x for x in s4.get('lista') or [] if x[0] == 'writing']
    ok(len(w4) == 1 and w4[0][5] == [3] and not [x for x in s4b.get('lista') or [] if x[0] == 'writing']
       and s4['lista'][:3] == s3['lista'][:3] and s4b['lista'] == r3['semanas']['2026-10-12']['lista'],
       'el Writing es misión la semana de su fecha (19/10) y no antes de WRITING_DESDE; el sorteo queda igual')
    ok(s4['prog']['Cid'][-1] == 1 and s4['prog']['Bea'][-1] == 0 and s4['pts'].get('Dan') == PUNTOS_WRITING
       and s4['pts'].get('Cid', 0) - (s3['pts'].get('Cid') or 0) == PUNTOS_WRITING,
       'Cid sumó en la fecha y la cumple (+%d, aparte del bono); Dan sólo escribió y también; Bea no  %s'
       % (PUNTOS_WRITING, s4.get('pts')))
    ok(calcular(evs3, dus2, dt.datetime(2026, 10, 22, 12, 0, tzinfo=U), None, m3, [])['semanas'] == r3['semanas'],
       'sin fechas del Writing, todo como antes')
    _self_check_nuevas(ok)
    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        return _self_check()
    d = leer()
    w = para_web(d)
    if not w:
        print('\n   todavía no hay misiones (arrancan la semana del %s)\n' % DESDE)
        return 0
    print('\n══ LAS MISIONES DE LA SEMANA DEL %s ══\n' % w['sem'])
    for x in w['lista']:
        print('   %-8s %-60s +%d' % (x['n'], x['t'][:60], x['p']))
    print('   y +%d por las tres\n' % w['bono'])
    top = sorted(w['pts'].items(), key=lambda kv: -kv[1])[:10]
    for q, p in top:
        print('   %-20s +%d' % (q[:20], p))
    print('')
    return 0


if __name__ == '__main__':
    raise SystemExit(main() or 0)
