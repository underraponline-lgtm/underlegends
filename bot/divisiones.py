# -*- coding: utf-8 -*-
"""LAS DIVISIONES: una tabla por semana, de a 30, como las ligas de Duolingo.

    python bot/divisiones.py           cómo va la semana, con el último cálculo del ciclo
    python bot/divisiones.py --auto    el self-check, sin red ni archivos

Dlx, 29/09/2026, a la idea 7 del research (divisiones semanales de ~30): *«como otro tipo de eventos semanales»*,
*«A»*. Y el 04/10/2026, a las preguntas: *«1. A»* —se sube por los puntos de Temporada de esa semana— y *«2. C,
subir a una división mejor y más competitiva supongo?»* —el que sube gana Puntos de Tienda y una insignia—.

LAS REGLAS (los números, acá arriba)
------------------------------------
- **Seis divisiones**, de Sexta a Primera (`NOMBRES`). Quien juega por primera vez entra en Sexta.
- **Estás en la tabla de una semana si jugaste un evento esa semana** (de lunes a lunes a las 11 AM ET, la de los
  multiplicadores: `multiplicadores.periodo()`). Quien no juega no está en la tabla y se queda en su división.
- **Cada división se parte en grupos de hasta `TAM`**, en el orden en que cada uno jugó su primer evento de la
  semana: el que llega después no le cambia el grupo a nadie.
- **Cuentan los puntos de Temporada de esa semana**: los de cada evento con su multiplicador y los bonos de la
  semana (Pasaporte y Asistencia). El Most Wanted y el precio por cabeza no: no son de una semana.
- **Al cerrar la semana, en cada grupo suben los `ZONA` primeros y bajan los `ZONA` últimos** (en un grupo chico,
  un tercio). Desempate: más eventos, y después quien jugó primero.
- **Subir paga `PREMIO` Puntos de Tienda** (por `precios:resolucion`, como el Most Wanted) **y da insignia**: la de
  «Ascenso» la primera vez y la de «Primera División» al llegar (`bot/insignias.py`).

⚠️ SE RECALCULA ENTERO EN CADA CORRIDA, semana por semana desde el arranque, con las filas de `Resultados`: una llave
que se procesa tarde o se corrige cambia la tabla, y nada se arrastra. Lo calcula el paso 1c
(`sheet/rankings.py --escribir`), que ya tiene esas filas, y lo deja en `datos/divisiones.json` para la página, la
Tienda y las insignias.

⚠️ ARRANCAN EN CERO CON LA TEMPORADA: las filas de antes del arranque no cuentan.

📈 DESDE LA SEMANA DEL 02/11/2026 SON EL RANKING ELO (Dlx, 26/10/2026: *«divisiones ahora serían Ranking ELO»*, y a
cómo, *«por tramos de ELO»*). Lo de arriba vale para las semanas de ANTES de `CORTE_ELO`, que se siguen calculando
igual —ahí se cobraron subidas e insignias, y como todo se recalcula entero, cambiarles la regla se las borraría—.
Desde `CORTE_ELO`:

- **Tu división es el tramo de tu ELO** (`bot/elo.py`) al cierre de cada semana: `TRAMOS`, de Primera a Quinta; abajo
  de todo, Sexta. Se mira el lunes a las 11 AM, como antes: en el medio la tabla muestra tu ELO en vivo y si subirías.
- **Con menos de `elo.PROVISIONAL` batallas tu ELO es provisional y no te mueve**: te quedas donde estabas (o en
  Sexta si entras nuevo). Un número con dos batallas no es un nivel.
- **Subir paga `PREMIO` y la insignia, pero sólo la PRIMERA VEZ que llegas a cada división en la temporada** (`mejor`).
  Con tramos fijos, alguien parado justo en un corte podía bajar y subir cada semana y cobrar 500 cada dos; con los
  grupos de 30 eso pedía terminar entre los cinco primeros.
- **La tabla de cada división es una sola**, todos los que están en ella ordenados por ELO: ya no hay grupos de 30.
"""
import datetime as dt
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE):
    if _p not in sys.path:
        sys.path.insert(0, _p)

#: de arriba para abajo; se entra por la última
NOMBRES = ('Primera', 'Segunda', 'Tercera', 'Cuarta', 'Quinta', 'Sexta')
ENTRADA = len(NOMBRES) - 1
#: personas por grupo
TAM = 30
#: los que suben y los que bajan en cada grupo
ZONA = 5
#: Puntos de Tienda por subir
PREMIO = 500
#: 📈 la primera semana que se arma por ELO (el id de `multiplicadores.periodo()`): las de antes, con la regla vieja
CORTE_ELO = '2026-11-02'
#: el ELO mínimo de Primera, Segunda, Tercera, Cuarta y Quinta; menos que el último, Sexta. Medidos el 26/10/2026 sobre
#: los 131 con 5 batallas o más: 6 · 7 · 24 · 33 · 46, y 15 en Sexta
TRAMOS = (1150, 1100, 1050, 1000, 950)

SALIDA = os.path.join(BASE, 'datos', 'divisiones.json')


def zona(n):
    """Cuántos suben y cuántos bajan en un grupo de `n`: `ZONA`, o un tercio si el grupo es chico."""
    return min(ZONA, n // 3)


def puntos_por_semana(filas, factor=None, bonos=None, periodo=None, desde=None):
    """`{semana: {rapero: [puntos, eventos, primer instante]}}` con las filas de `rankings.agregar.filas`.

    Cada fila es `(evento, servidor, instante, rapero, puntos crudos)`. `factor(sv, instante, evento, rapero)` es el
    multiplicador (`multiplicadores.factor_de()`); `bonos` lo de `multiplicadores.bonos()`; `periodo(instante)` da
    `(semana, inicio, fin)`.
    """
    if periodo is None:
        import multiplicadores as MU
        periodo = MU.periodo
    out = {}
    evs = {}
    for f in filas or []:
        ev, sv, t, quien, pts = f[0], f[1], f[2], f[3], f[4]
        if not t or not quien or (desde and t < desde):
            continue
        sem = periodo(t)[0]
        x = out.setdefault(sem, {}).setdefault(quien, [0.0, 0, t])
        x[0] += (pts or 0) * (factor(sv, t, ev, quien) if factor else 1)
        if (sem, quien, ev) not in evs:
            evs[(sem, quien, ev)] = 1
            x[1] += 1
        if t < x[2]:
            x[2] = t
    for quien, b in (bonos or {}).items():
        for sem, _regla, pts in b.get('por') or []:
            if sem in out and quien in out[sem]:
                out[sem][quien][0] += pts
    return out


def _grupos(gente, nivel):
    """`{división: [[rapero, …], …]}`: los de esa semana, por división, en grupos de `TAM` por orden de llegada.

    ⚠️ UN ÚLTIMO GRUPO DE MENOS DE `TAM // 3` SE SUMA AL ANTERIOR: medido con la semana del 28/09, Sexta quedaba
    30·30·30·30·30·3, y en un grupo de tres sube uno con casi nada.
    """
    por = {}
    for quien, (_p, _e, t) in sorted(gente.items(), key=lambda x: (x[1][2], x[0])):
        por.setdefault(nivel.get(quien, ENTRADA), []).append(quien)
    out = {}
    for d, xs in por.items():
        gs = [xs[i:i + TAM] for i in range(0, len(xs), TAM)]
        if len(gs) > 1 and len(gs[-1]) < TAM // 3:
            # ⚠️ el pop ANTES: `gs[-2] = gs[-2] + gs.pop()` asigna al índice de después del pop y duplica un grupo
            ultimo = gs.pop()
            gs[-1] = gs[-1] + ultimo
        out[d] = gs
    return out


def _orden(grupo, gente):
    return sorted(grupo, key=lambda q: (-round(gente[q][0], 2), -gente[q][1], gente[q][2], q))


def tramo(elo):
    """La división de un ELO: 0 es Primera, `ENTRADA` es Sexta."""
    for i, c in enumerate(TRAMOS):
        if elo >= c:
            return i
    return ENTRADA


def calcular(semanas, actual, elo_al=None, raw_de=None):
    """Recorre las semanas cerradas en orden y arma la de ahora.

    `semanas` es lo de `puntos_por_semana()`; `actual`, el id de la semana en curso. Devuelve
    `{nivel, divs, ult, subidas}`: la división de cada uno para esta semana, las tablas de esta semana
    (`[división][grupo] = [[rapero, puntos, eventos], …]`), cómo cerró la última y cada subida
    (`[semana, rapero, división nueva]`).

    📈 Desde `CORTE_ELO`, `elo_al(semana)` da el ELO al CIERRE de esa semana (`{norm: {'elo', 'n'}}`; `None` = ahora,
    para la tabla en vivo) y `raw_de` pasa de esa clave al nombre de las filas. Ver `_semana_elo()`.
    """
    nivel, subidas, ult, mejor = {}, [], None, {}
    cerradas = sorted(s for s in semanas if s < actual)
    if elo_al is not None:
        cerradas = sorted(set(cerradas) | {s for s in _lunes_desde(CORTE_ELO, actual)})
    for sem in cerradas:
        if elo_al is not None and sem >= CORTE_ELO:
            ult = _semana_elo(sem, elo_al(sem), raw_de or {}, nivel, mejor, subidas, pagar=sem != CORTE_ELO)
            continue
        gente = semanas.get(sem) or {}
        mov = {}
        sube, baja = [], []
        for d, gs in _grupos(gente, nivel).items():
            for g in gs:
                o = _orden(g, gente)
                z = zona(len(o))
                if not z:
                    continue
                if d > 0:
                    for q in o[:z]:
                        mov[q] = d - 1
                        sube.append(q)
                if d < ENTRADA:
                    for q in o[-z:]:
                        mov[q] = d + 1
                        baja.append(q)
        for q in gente:
            nivel.setdefault(q, ENTRADA)
        for q, d in mov.items():
            nivel[q] = d
            if q in sube:
                subidas.append([sem, q, d])
        for q, d in nivel.items():
            mejor[q] = min(d, mejor.get(q, ENTRADA))
        ult = {'sem': sem, 'sube': sorted(sube), 'baja': sorted(baja)}
    if elo_al is not None and actual >= CORTE_ELO:
        return {'nivel': nivel, 'divs': _tablas_elo(elo_al(None), raw_de or {}, nivel), 'ult': ult, 'subidas': subidas}
    gente = semanas.get(actual) or {}
    divs = [[] for _ in NOMBRES]
    for d, gs in sorted(_grupos(gente, nivel).items()):
        for g in gs:
            divs[d].append([[q, round(gente[q][0]), gente[q][1]] for q in _orden(g, gente)])
    return {'nivel': nivel, 'divs': divs, 'ult': ult, 'subidas': subidas}


def _lunes_desde(desde, hasta):
    """Los ids de semana (lunes, `AAAA-MM-DD`) desde `desde` hasta antes de `hasta`: con el ELO, una semana sin
    ningún evento también cierra (el ELO no se movió, pero quien estaba provisional puede haber dejado de estarlo)."""
    try:
        d, h = dt.date.fromisoformat(desde), dt.date.fromisoformat(hasta)
    except (TypeError, ValueError):
        return []
    out = []
    while d < h:
        out.append(d.isoformat())
        d += dt.timedelta(days=7)
    return out


def _semana_elo(sem, elos, raw_de, nivel, mejor, subidas, pagar=True):
    """📈 Cierra una semana por ELO: cada uno al tramo de su ELO —salvo los provisionales, que se quedan—, y anota
    como subida (que paga) sólo la primera vez que alguien llega a una división en la temporada.

    ⚠️ LA PRIMERA SEMANA POR ELO NO PAGA (`pagar=False`): es una reubicación, no una subida. Medido el 26/10/2026, con
    el ELO de ese día, cobrarían 75 personas a la vez —37.500 Puntos de Tienda— sólo por cambiar la regla. Cuenta igual
    para `mejor`: quien quedó en Tercera cobra recién al llegar a Segunda."""
    import elo as EL
    sube, baja = [], []
    for k, e in sorted(elos.items()):
        q = raw_de.get(k)
        if not q or e['n'] < EL.PROVISIONAL:
            continue
        antes = nivel.get(q, ENTRADA)
        d = tramo(e['elo'])
        nivel[q] = d
        if d < antes:
            sube.append(q)
            if pagar and d < mejor.get(q, ENTRADA):
                subidas.append([sem, q, d])
        elif d > antes:
            baja.append(q)
        mejor[q] = min(d, mejor.get(q, ENTRADA))
    return {'sem': sem, 'sube': sorted(sube), 'baja': sorted(baja)}


def _tablas_elo(elos, raw_de, nivel):
    """📈 Las tablas de ahora: una por división, con todos los que están en ella por ELO en vivo. Cada fila es
    `[rapero, elo, batallas, división si cerrara ahora]`; la última es para «subirías» / «bajarías», y para un
    provisional es la suya (no se mueve)."""
    import elo as EL
    divs = [[] for _ in NOMBRES]
    filas = {}
    for k, e in elos.items():
        q = raw_de.get(k)
        if not q:
            continue
        d = nivel.get(q, ENTRADA)
        a = tramo(e['elo']) if e['n'] >= EL.PROVISIONAL else d
        filas.setdefault(d, []).append([q, e['elo'], e['n'], a])
    for d, xs in filas.items():
        divs[d] = [sorted(xs, key=lambda f: (-f[1], -f[2], f[0]))]
    return divs


def correr(filas, ahora=None, aplicar=False):
    """Lo de esta semana desde las filas del paso 1c; con `aplicar`, a `datos/divisiones.json`."""
    import multiplicadores as MU
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    # ⚠️ EL ARRANQUE CORTA SÓLO CUANDO YA PASÓ: `MU._arranque()` lo da aunque sea del futuro, y en la prueba eso dejaba
    # afuera todas las filas (lo mismo que `precios._arranque()`)
    desde = MU._arranque()
    if desde and desde > ahora:
        desde = None
    sem, ini, fin = MU.periodo(ahora)
    semanas = puntos_por_semana(filas, MU.factor_de(filas=filas), MU.bonos(filas), MU.periodo, desde)
    elo_al = raw_de = None
    if sem >= CORTE_ELO:
        elo_al, raw_de = _elo_de(filas, ahora)
    c = calcular(semanas, sem, elo_al, raw_de)
    out = {'_leeme': 'Las divisiones de la semana: las arma bot/divisiones.py en el paso 1c, enteras en cada corrida. '
                     'Las reglas y los números viven en ese archivo.',
           'sem': sem, 'fin': fin.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
           'nombres': list(NOMBRES), 'zona': ZONA, 'premio': PREMIO,
           'divs': c['divs'], 'ult': c['ult'], 'subidas': c['subidas'], 'nivel': c['nivel']}
    if elo_al is not None:
        import elo as EL
        out.update(modo='elo', tramos=list(TRAMOS), prov=EL.PROVISIONAL)
    if aplicar:
        with io.open(SALIDA, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(out, f, ensure_ascii=False, indent=1, sort_keys=True)
            f.write('\n')
    return out


def _elo_de(filas, ahora):
    """`(elo_al, raw_de)` para `calcular()`: el ELO al cierre de cada semana (con las llaves de `datos/llaves_t1.json`) y
    de la clave del ELO al nombre que traen las filas."""
    import competencias as CO
    import elo as EL
    import multiplicadores as MU
    try:
        with io.open(os.path.join(BASE, 'datos', 'llaves_t1.json'), encoding='utf-8') as f:
            llaves = json.load(f) or {}
    except (OSError, ValueError):
        llaves = {}
    raw_de = {}
    for f in filas or []:
        if f[3]:
            raw_de.setdefault(CO.norm(f[3]), f[3])
    cache = {}

    def elo_al(sem):
        if sem not in cache:
            hasta = ahora if sem is None else MU.periodo(dt.datetime.fromisoformat(sem).replace(hour=17, tzinfo=dt.timezone.utc))[2]
            cache[sem] = EL.calcular(llaves, hasta)
        return cache[sem]
    return elo_al, raw_de


def leer(ruta=None):
    """`datos/divisiones.json`, o `{}`."""
    try:
        with io.open(ruta or SALIDA, encoding='utf-8') as f:
            return json.load(f) or {}
    except (OSError, ValueError):
        return {}


def tienda(d, dids):
    """`{id: [discord_id, puntos, ms]}`: lo que paga cada subida, para el objeto (como `precios.tienda_mw()`).

    Se manda entero en cada corrida y el objeto lo reemplaza entero: una llave corregida cambia quién subió.
    """
    import multiplicadores as MU
    out = {}
    for sem, quien, div in (d or {}).get('subidas') or []:
        did = dids.get(quien)
        if not did or not PREMIO:
            continue
        try:
            # ⚠️ 17 UTC Y NO 12 (revisión del 05/10/2026): la semana cambia el lunes a las 11 AM ET, que son las 15 UTC
            # en verano y las 16 en invierno; las 12 caían en la semana ANTERIOR y el pago quedaba fechado una antes
            ini = dt.datetime.fromisoformat(sem).replace(hour=17, tzinfo=dt.timezone.utc)
        except ValueError:
            continue
        fin = MU.periodo(ini)[2]
        out['%s:%s' % (sem, quien)] = [did, PREMIO, int(fin.timestamp() * 1000)]
    return out


def para_web(d):
    """Lo que viaja en el lobby: la semana, cuándo cierra, las tablas de ahora, cómo cerró la anterior y en qué
    división está cada uno (`v`).

    🔴 UNA SEMANA RECIÉN EMPEZADA NO ES «NO HAY DIVISIONES». Devolvía `None` si nadie había jugado todavía, así que
    cada lunes a las 11 AM las divisiones desaparecían de la página —la pestaña del Ranking y la previa del Inicio—
    hasta que se procesara el primer evento (05/10/2026, la primera semana nueva). Ahora viajan igual, vacías, con cómo
    cerró la anterior y la división de cada uno; `None` sólo si nunca hubo nada."""
    if not d or not (any(d.get('divs') or []) or d.get('ult') or d.get('nivel')):
        return None
    out = {'sem': d.get('sem'), 'fin': d.get('fin'), 'n': d.get('nombres') or list(NOMBRES), 'z': d.get('zona', ZONA),
           'p': d.get('premio', PREMIO), 'd': d.get('divs'), 'u': d.get('ult'), 'v': d.get('nivel') or {}}
    if d.get('modo') == 'elo':
        out.update(m='elo', t=d.get('tramos') or list(TRAMOS), pv=d.get('prov'))
    return out


# ── self-check ───────────────────────────────────────────────────────────
def _self_check():
    fallas = []

    def ok(c, que):
        print('  %s %s' % ('✅' if c else '❌', que))
        if not c:
            fallas.append(que)

    utc = dt.timezone.utc
    l0 = dt.datetime(2026, 10, 5, 15, 0, tzinfo=utc)          # lunes 11 AM ET

    def periodo(t):
        k = int((t - l0).total_seconds() // (7 * 86400))
        ini = l0 + dt.timedelta(days=7 * k)
        return ini.strftime('%Y-%m-%d'), ini, ini + dt.timedelta(days=7)

    # semana 1: 40 personas → Sexta en dos grupos (30 y 10)
    filas = []
    for i in range(40):
        t = l0 + dt.timedelta(hours=1 + i)
        filas.append((100 + i, 'FFA', t, 'p%02d' % i, 1000 - i * 10))
    s = puntos_por_semana(filas, periodo=periodo)
    c = calcular(s, periodo(l0 + dt.timedelta(days=8))[0])
    ok(c['nivel']['p00'] == ENTRADA - 1 and c['nivel']['p04'] == ENTRADA - 1 and c['nivel']['p05'] == ENTRADA,
       'en el grupo de 30 suben los 5 primeros')
    ok(c['nivel']['p30'] == ENTRADA - 1 and c['nivel']['p32'] == ENTRADA - 1 and c['nivel']['p33'] == ENTRADA,
       'en el de 10 suben 3 (un tercio), y en Sexta nadie baja')
    ok(len(c['subidas']) == 8 and c['ult']['baja'] == [], 'las ocho subidas, para la Tienda y las insignias')
    # semana 2: los que subieron juegan en Quinta; uno de Quinta saca 0 y otro no juega
    l1 = l0 + dt.timedelta(days=7)
    filas2 = filas + [(200 + i, 'FFA', l1 + dt.timedelta(hours=1 + i), q, 500 + i) for i, q in
                      enumerate(['p00', 'p01', 'p02', 'p03', 'p04', 'p30', 'p31', 'p10'])]
    s2 = puntos_por_semana(filas2, periodo=periodo)
    act = periodo(l1 + dt.timedelta(days=1))[0]
    c2 = calcular(s2, act)
    quinta = c2['divs'][ENTRADA - 1]
    ok(len(quinta) == 1 and [x[0] for x in quinta[0]][:2] == ['p31', 'p30'] and len(quinta[0]) == 7,
       'esta semana: Quinta con los siete que jugaron, ordenados por puntos')
    ok([x[0] for x in c2['divs'][ENTRADA][0]] == ['p10'], 'y el de Sexta que jugó, solo en su grupo')
    ok(c2['nivel'].get('p32') == ENTRADA - 1, 'quien no jugó esta semana se queda en su división')
    # el multiplicador y los bonos cuentan
    s3 = puntos_por_semana([(1, 'FFA', l0 + dt.timedelta(hours=1), 'a', 100)], factor=lambda *a: 2,
                           bonos={'a': {'pts': 50, 'por': [[periodo(l0)[0], 'pasaporte', 50]]}}, periodo=periodo)
    ok(s3[periodo(l0)[0]]['a'][0] == 250, 'el multiplicador y los bonos de la semana suman')
    ok(zona(30) == 5 and zona(10) == 3 and zona(2) == 0, 'cuántos suben y bajan según el tamaño del grupo')
    # 153 en Sexta: 30·30·30·30·30·3 -> el de tres se suma al último, y nadie queda dos veces
    g153 = {'q%03d' % i: [1, 1, l0 + dt.timedelta(minutes=i)] for i in range(153)}
    gs = _grupos(g153, {})[ENTRADA]
    ok([len(g) for g in gs] == [30, 30, 30, 30, 33] and len({q for g in gs for q in g}) == 153,
       'un último grupo chico se suma al anterior, sin repetir a nadie')
    t = tienda({'subidas': [['2026-10-05', 'p00', 4], ['2026-10-05', 'nadie', 4]]}, {'p00': '111'})
    ok(list(t) == ['2026-10-05:p00'] and t['2026-10-05:p00'][:2] == ['111', PREMIO], 'subir paga, a quien tiene Discord')
    # 📈 por ELO: dos semanas cerradas y la de ahora
    ok(tramo(1200) == 0 and tramo(1150) == 0 and tramo(1149) == 1 and tramo(999) == 4 and tramo(800) == ENTRADA,
       'el tramo: 1150 es Primera, 1149 Segunda, 999 Quinta, menos de 950 Sexta')
    ELOS = {'2026-11-02': {'a': {'elo': 1160, 'n': 9}, 'b': {'elo': 1040, 'n': 9}, 'c': {'elo': 1200, 'n': 2}},
            '2026-11-09': {'a': {'elo': 1090, 'n': 12}, 'b': {'elo': 1101, 'n': 12}, 'c': {'elo': 1200, 'n': 6}},
            '2026-11-16': {'a': {'elo': 1155, 'n': 14}, 'b': {'elo': 1101, 'n': 12}, 'c': {'elo': 1190, 'n': 7}},
            None: {'a': {'elo': 1155, 'n': 14}, 'b': {'elo': 1101, 'n': 12}, 'c': {'elo': 1190, 'n': 7}}}
    raw = {'a': 'A', 'b': 'B', 'c': 'C'}
    ce = calcular({'2026-10-26': {}}, '2026-11-23', ELOS.get, raw)
    ok(ce['nivel'] == {'A': 0, 'B': 1, 'C': 0}, 'cada uno en el tramo de su ELO al último cierre')
    pagas = [(x[0], x[1], x[2]) for x in ce['subidas']]
    ok(not any(x[0] == CORTE_ELO for x in ce['subidas']) and ce['nivel']['A'] == 0,
       'la primera semana por ELO reubica y no paga (A queda en Primera sin cobrar)')
    ok(('2026-11-09', 'B', 1) in pagas and ('2026-11-16', 'A', 0) not in pagas,
       'subir paga la primera vez que llegas (B a Segunda); volver a una a la que ya llegaste, no (A)')
    ok(('2026-11-09', 'C', 0) in pagas,
       'con 2 batallas es provisional y no se mueve; con 6 sube, y cobra')
    ok(ce['ult']['sem'] == '2026-11-16' and ce['ult']['sube'] == ['A'], 'cómo cerró la última semana')
    ok([f[0] for f in ce['divs'][0][0]] == ['C', 'A'] and ce['divs'][1][0][0][:3] == ['B', 1101, 12],
       'la tabla de ahora: una por división, por ELO')
    print('\n  %s' % ('todo ok' if not fallas else '%d fallaron' % len(fallas)))
    return not fallas


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        print('\n══ LAS DIVISIONES ══')
        return 0 if _self_check() else 1
    d = leer()
    if not d:
        print('   todavía no hay divisiones: las arma el paso 1c del ciclo (sheet/rankings.py --escribir)')
        return 0
    print('   semana del %s · cierra %s' % (d.get('sem'), d.get('fin')))
    for i, gs in enumerate(d.get('divs') or []):
        if gs:
            print('   %-8s %d grupo(s) · %d jugando' % (NOMBRES[i], len(gs), sum(len(g) for g in gs)))
    if d.get('ult'):
        print('   la semana del %s: subieron %d y bajaron %d' % (d['ult']['sem'], len(d['ult']['sube']),
                                                              len(d['ult']['baja'])))
    return 0


if __name__ == '__main__':
    sys.exit(main())
