# -*- coding: utf-8 -*-
"""LAS INSIGNIAS: lo que cada uno se ganó, para siempre.

    python bot/insignias.py            quién ganaría qué, sin escribir nada
    python bot/insignias.py --aplicar  anota las nuevas en datos/insignias.json (paso 2d0)
    python bot/insignias.py --auto     el self-check, sin red ni archivos

Dlx, 27/09/2026, a las ideas para enganchar: *«me gustan todas»* — entre
ellas, *«insignias en el perfil: primer podio, 10 eventos, cazó al Rey, jugó
en 4 servidores… se coleccionan, salen solas de datos que ya tenemos y
quedan para siempre»*.

⚠️ QUEDAN PARA SIEMPRE. Una vez ganada no se pierde, aunque la temporada
arranque de cero: por eso viven en su propio archivo, que el reset no toca.

⚠️ LAS DE LA FASE DE PRUEBA SE GUARDAN, PERO NO SE MUESTRAN desde el
arranque de la temporada: lo jugado en la prueba *«se borra»* (Dlx, 25/09).
Cada una guarda en qué temporada se ganó.

⚠️ TODO SALE DE LO QUE YA ESTÁ: el pool de Temporada (eventos, podios,
servidores, racha), los duelos de las llaves (`llaves_web.duelos()`, la
misma regla que la hoja `1v1`), el Most Wanted (`most_wanted.suma()`) y los
Clásicos (`multiplicadores.clasicos()`).
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
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

SALIDA = os.path.join(BASE, 'datos', 'insignias.json')

#: (id, emoji, nombre, cómo se gana). El orden es el de la página.
CATALOGO = (
    ('debut', '🎤', 'Debut', 'Jugó su primer evento en la Liga'),
    ('ev10', '🔟', 'Constante', 'Jugó 10 eventos en una temporada'),
    ('ev25', '📅', 'Infaltable', 'Jugó 25 eventos en una temporada'),
    ('podio', '🥉', 'Al podio', 'Terminó en el podio de un evento'),
    ('campeon', '🏆', 'Campeón', 'Ganó un evento'),
    ('tricampeon', '👑', 'Tricampeón', 'Ganó 3 eventos en una temporada'),
    ('trotamundos', '🌍', 'Trotamundos', 'Jugó en 3 servidores distintos'),
    ('racha', '🔥', 'En llamas', 'Llegó arriba de la llave en 3 eventos seguidos'),
    ('duelista', '⚔️', 'Duelista', 'Ganó 10 duelos en una temporada'),
    ('clasico', '🤜', 'Clásico', 'Ganó un Clásico: su tercer cruce, o más, con el mismo rival'),
    ('figura', '🌟', 'Figura', 'Fue la figura de una semana: el que más puntos hizo'),
    ('revelacion', '✨', 'Revelación', 'Fue la revelación de la semana en que debutó'),
    ('cazador', '🎯', 'Cazador', 'Cazó a un buscado del Most Wanted'),
    ('regicida', '💀', 'Regicida', 'Cazó a El Rey del Most Wanted'),
    ('sobreviviente', '🛡️', 'Sobreviviente', 'Sobrevivió siendo buscado'),
    # 🏟️ las divisiones (04/10/2026, Dlx: «2. C»): subir da Puntos de Tienda y estas. Ver `bot/divisiones.py`
    ('ascenso', '⬆️', 'Ascenso', 'Subió de división al cerrar una semana'),
    ('primera', '🏟️', 'Primera División', 'Llegó a la Primera División'),
    # ✍️ el Writing Challenge de FFA (14/10/2026, Dlx: «cuenta para la Liga… y insignia»). Ver `bot/writing.py`
    ('pluma_oro', '✍️', 'Pluma de oro', 'Ganó una fecha del Writing Challenge'),
    ('pluma', '🖋️', 'Pluma', 'Sumó en 3 fechas del Writing Challenge'),
    # 🏟️ las ligas de los servidores (16/10/2026, Dlx: «reconocimiento a estos participantes de las ligas»). Ver
    # `bot/ligas.py`: el invicto sale de rehacer sus batallas en orden; el podio y el campeón, del Salón (✅ Decidir)
    ('liga', '📋', 'De liga', 'Jugó una liga de los servidores'),
    ('invicto', '💎', 'Invicto', 'Llegó a 5 ganadas sin perder ninguna en una liga'),
    ('liga_podio', '🎖️', 'Podio de liga', 'Terminó entre los tres primeros de una liga'),
    ('liga_campeon', '🏅', 'Campeón de liga', 'Ganó una liga de los servidores'),
    # 🏆 los MES AWARDS (16/10/2026, Dlx: «como el Balón de Oro pero cada mes»). Ver `bot/mes_awards.py`
    ('mes_rapero', '🏆', 'Rapero del mes', 'Ganó el Rapero del mes de los MES AWARDS'),
    ('mes_revelacion', '🌠', 'Revelación del mes', 'Ganó la Revelación del mes de los MES AWARDS'),
    ('mes_batalla', '🎬', 'Batalla del mes', 'Su batalla ganó la Batalla del mes de los MES AWARDS'),
    # 🏆 y las de «Ver las demás nominaciones» (16/10/2026, `bot/mes_otros.py`). Las de grupos —crew, país, liga— no tienen
    ('mes_organizador', '🎤', 'Organizador del mes', 'Ganó el Organizador del mes de los MES AWARDS'),
    ('mes_staff', '🎧', 'Staff del mes', 'Ganó el Staff del mes de los MES AWARDS: jurado, host o DJ'),
    ('mes_duelista', '⚔️', 'Duelista del mes', 'Ganó el Duelista del mes de los MES AWARDS'),
    ('mes_cazador', '🎯', 'Cazador del mes', 'Ganó el Cazador del mes de los MES AWARDS'),
    ('mes_batacazo', '💥', 'Batacazo del mes', 'Su victoria fue el Batacazo del mes de los MES AWARDS'),
    ('mes_imparable', '🔥', 'Imparable del mes', 'Ganó el Imparable del mes de los MES AWARDS'),
    ('mes_evento', '🎪', 'Evento del mes', 'Organizó el Evento del mes de los MES AWARDS'),
    ('mes_promo', '📣', 'Promo del mes', 'Su promo fue la Promo del mes de los MES AWARDS'),
    ('mes_publicacion', '👏', 'Publicación del mes', 'Su publicación fue la Publicación del mes de los MES AWARDS'),
)
IDS = [c[0] for c in CATALOGO]


def _n(x):
    try:
        return float(str(x or 0).replace(',', ''))
    except ValueError:
        return 0.0


def cumple(pool, mw=None, reyes=None, duelos_g=None, clasicos_g=None, figuras=None, revelaciones=None,
           subieron=None, primera=None, plumas_oro=None, plumas=None, ligas=None):
    """`{raw: {ids}}`: lo que cada uno cumple HOY con los datos de la temporada.

    `mw` es `{raw: {'caz', 'czd', 'sob'}}` (`most_wanted.suma()`), `reyes` el
    conjunto de quienes cazaron a El Rey, y `duelos_g` y `clasicos_g`
    `{raw: cuántos ganó}`. `subieron` y `primera`, de las divisiones: quién
    subió alguna vez y quién llegó a Primera. Todo por el nombre del pool (`raw`).

    ✍️ `plumas_oro` (quién ganó una fecha del Writing Challenge) y `plumas` (`{raw: en cuántas fechas sumó}`), de
    `writing.plumas()`. ⚠️ ESTAS DOS NO PIDEN ESTAR EN EL POOL: el Writing no es un evento, y quien escribe y nunca
    jugó también se la gana (con su nombre de la Lista).

    🏟️ `ligas`: `{raw: {ids}}` de las cuatro de liga (`_ligas()`). Tampoco piden el pool: hay quien juega ligas y no
    eventos (el staff, ForceGP).
    """
    plumas_oro, plumas = plumas_oro or set(), plumas or {}
    subieron, primera = subieron or set(), primera or set()
    mw, reyes = mw or {}, reyes or set()
    figuras, revelaciones = figuras or set(), revelaciones or set()
    duelos_g, clasicos_g = duelos_g or {}, clasicos_g or {}
    out = {}
    for p in pool:
        raw = p.get('raw')
        if not raw:
            continue
        ev, oro = _n(p.get('ev')), _n(p.get('oro'))
        pod = oro + _n(p.get('seg')) + _n(p.get('ter'))
        m = mw.get(raw) or {}
        reglas = {
            'debut': ev >= 1, 'ev10': ev >= 10, 'ev25': ev >= 25,
            'podio': pod >= 1, 'campeon': oro >= 1, 'tricampeon': oro >= 3,
            'trotamundos': _n(p.get('srv')) >= 3, 'racha': _n(p.get('racha')) >= 3,
            'duelista': duelos_g.get(raw, 0) >= 10, 'clasico': clasicos_g.get(raw, 0) >= 1,
            'cazador': m.get('caz', 0) >= 1, 'regicida': raw in reyes, 'sobreviviente': m.get('sob', 0) >= 1,
            'figura': raw in figuras, 'revelacion': raw in revelaciones,
            'ascenso': raw in subieron, 'primera': raw in primera,
        }
        ya = {k for k, v in reglas.items() if v}
        if ya:
            out[raw] = ya
    from writing import PLUMA_FECHAS
    for raw in set(plumas_oro) | set(plumas):
        ya = ({'pluma_oro'} if raw in plumas_oro else set()) | (
            {'pluma'} if plumas.get(raw, 0) >= PLUMA_FECHAS else set())
        if raw and ya:
            out.setdefault(raw, set()).update(ya)
    for raw, ya in (ligas or {}).items():
        ya = set(ya) & ({'liga', 'invicto', 'liga_podio', 'liga_campeon'} | {i for i in IDS if i.startswith('mes_')})
        if raw and ya:
            out.setdefault(raw, set()).update(ya)
    return out


def anotar(registro, cumplen, ahora, temporada):
    """Suma al registro lo que se ganó y todavía no tenía. Devuelve cuántas."""
    nuevas = 0
    for raw, ids in cumplen.items():
        tiene = registro.setdefault(raw, {})
        for i in sorted(ids):
            if i not in tiene:
                tiene[i] = [ahora.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), temporada]
                nuevas += 1
    return nuevas


def visibles(registro, temporada_actual):
    """`{raw: [[id, cuándo], …]}` para la página: las de la prueba, sólo durante la prueba."""
    out = {}
    for raw, tiene in (registro or {}).items():
        xs = [[i, v[0]] for i, v in tiene.items()
              if i in IDS and (temporada_actual == 'prueba' or v[1] != 'prueba')]
        if xs:
            out[raw] = sorted(xs, key=lambda x: IDS.index(x[0]))
    return out


def leer(ruta=None):
    """`datos/insignias.json` -> `{raw: {id: [cuándo, temporada]}}`, o `{}`."""
    try:
        with io.open(ruta or SALIDA, encoding='utf-8') as f:
            return (json.load(f) or {}).get('insignias') or {}
    except (OSError, ValueError):
        return {}


def _datos():
    """Lo que las reglas necesitan, desde `datos/`: `(pool, mw, reyes, duelos_g, clasicos_g,
    figuras, revelaciones)`."""
    import llaves_web as LW
    import most_wanted as MW
    import multiplicadores as MU
    with io.open(os.path.join(BASE, 'datos', 'temporada_pool.json'), encoding='utf-8') as f:
        pool = json.load(f) or []
    idx = {MU._clave_persona(p.get('raw')): p.get('raw') for p in pool if p.get('raw')}
    raw_de = lambda nombre: idx.get(MU._clave_persona(nombre))
    mw = MW.suma()[0]
    reyes = set()
    for per in MW.periodos(MW.leer()):
        for b in per.get('buscados') or []:
            if b.get('cat') == 'rey' and b.get('caza'):
                reyes.update(y['n'] for y in b['caza'].get('por') or [])
    duelos_g = {}
    for _n_, _a, _b, g in LW.duelos():
        r = raw_de(g)
        if r:
            duelos_g[r] = duelos_g.get(r, 0) + 1
    clasicos_g = {}
    temp = MU.temporada_actual()
    for c in MU.clasicos():
        if c['temporada'] == temp:
            r = raw_de(c['g'])
            if r:
                clasicos_g[r] = clasicos_g.get(r, 0) + 1
    # los premios de las semanas cerradas de esta temporada
    figuras, revelaciones = set(), set()
    for sem in MU.leer().get('semanas') or []:
        if sem.get('temporada', 'prueba') != temp:
            continue
        ps = sem.get('premios_semana') or {}
        for clave, dest in (('figura', figuras), ('revelacion', revelaciones)):
            r = raw_de((ps.get(clave) or [''])[0])
            if r:
                dest.add(r)
    # 🏟️ las divisiones: quién subió alguna vez y quién llegó a Primera (`bot/divisiones.py`)
    import divisiones as DV
    subieron, primera = set(), set()
    for _sem, q, div in DV.leer().get('subidas') or []:
        r = raw_de(q)
        if r:
            subieron.add(r)
            if div == 0:
                primera.add(r)
    # ✍️ el Writing Challenge (`bot/writing.py`): por el nombre del pool si está; si no, el de la Lista
    import writing as WR
    oro_w, cuenta_w = WR.plumas()
    plumas_oro = {raw_de(q) or q for q in oro_w}
    plumas = {}
    for q, n in cuenta_w.items():
        r = raw_de(q) or q
        plumas[r] = plumas.get(r, 0) + n
    return (pool, mw, reyes, duelos_g, clasicos_g, figuras, revelaciones, subieron, primera, plumas_oro, plumas,
            _ligas(raw_de))


def _ligas(raw_de):
    """🏟️ `{raw: {ids}}` de las insignias de liga: quién jugó alguna, quién llegó invicto a 5 (`ligas.hitos()`) y el
    podio y el campeón de las que terminaron (el Salón, `datos/decisiones.json`). Por el nombre del pool si está; si no,
    el de la Lista. Si algo falla, ninguna: nunca frena a las demás."""
    out = {}
    try:
        import ligas as LG
        d = LG.leer()

        def poner(n, i):
            if n:
                out.setdefault(raw_de(n) or n, set()).add(i)
        for nombres in LG.tablas(d, desde=LG._desde()).values():
            for n in nombres:
                poner(n, 'liga')
        for h in LG.hitos(d):
            if h.get('que') == 'invicto':
                poner((h.get('quien') or [''])[0], 'invicto')
        for x in (LG._decis().get(LG.FIN) or []):
            for i, n in enumerate(x.get('podio') or []):
                poner(n, 'liga_campeon' if i == 0 else 'liga_podio')
                if i == 0:
                    poner(n, 'liga_podio')
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ sin las insignias de liga (%s)' % str(e)[:80])
    # 🏆 y las de los MES AWARDS (`bot/mes_awards.py`): los ganadores, por el mismo camino (no piden el pool)
    try:
        import mes_awards as MA
        for n, ids in MA.insignias().items():
            out.setdefault(raw_de(n) or n, set()).update(ids)
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ sin las insignias de los MES AWARDS (%s)' % str(e)[:80])
    return out


#: 🧹 LOS QUE NO SON PERSONAS (07/10/2026): equipos que una llave mal leída cargó como uno solo —el #425, PRITTY FREE,
#: tomado de #votaciones, donde los equipos van sin separar— y que se ganaron el debut. Las insignias no se borran
#: solas (son para siempre), así que se sacan en cada corrida: no importa en cuál se arregló, ni que haya otra en curso
NO_SON_PERSONAS = frozenset({'CRONOX XCLUSIVO', 'NEMI PRESAGIO DELUX', 'Nemi x presagio x dantedelux',
                             'PRESAGIO DELUX NEMI', 'SIX MAILEN'})


def correr(ahora=None, aplicar=False):
    import multiplicadores as MU
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    registro = leer()
    for k in NO_SON_PERSONAS:
        registro.pop(k, None)
    c = cumple(*_datos())
    nuevas = anotar(registro, c, ahora, MU.temporada_actual(ahora))
    if aplicar:
        with io.open(SALIDA, 'w', encoding='utf-8') as f:
            json.dump({'_leeme': 'Las insignias de cada uno: {id: [cuándo, temporada]}. Las anota '
                                 'bot/insignias.py (paso 2d0) y NO se borran con la temporada.',
                       'insignias': dict(sorted(registro.items()))}, f, ensure_ascii=False, indent=0)
    return registro, nuevas


# ── self-check ───────────────────────────────────────────────────────────
def _self_check():
    print('\n══ INSIGNIAS ══\n')
    mal = 0

    def ok(c, que):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '🔴', que))

    pool = [{'raw': 'Ana', 'ev': 12, 'oro': 3, 'seg': 1, 'ter': 0, 'srv': 3, 'racha': 3},
            {'raw': 'Bea', 'ev': 1, 'oro': 0, 'seg': 0, 'ter': 0, 'srv': 1, 'racha': 0},
            {'raw': 'Cid', 'ev': 0}]
    c = cumple(pool, mw={'Bea': {'caz': 1, 'sob': 0}}, reyes={'Bea'}, duelos_g={'Ana': 10},
               clasicos_g={'Ana': 1}, revelaciones={'Bea'})
    ok(c['Ana'] == {'debut', 'ev10', 'podio', 'campeon', 'tricampeon', 'trotamundos', 'racha',
                    'duelista', 'clasico'},
       'Ana: 12 eventos, 3 oros, 3 servidores, racha de 3, 10 duelos y un Clásico')
    ok(c['Bea'] == {'debut', 'cazador', 'regicida', 'revelacion'} and 'Cid' not in c,
       'Bea: su debut, cazó a El Rey y fue la revelación de su semana; Cid, que no jugó, nada')
    reg = {}
    t0 = dt.datetime(2026, 9, 27, 18, tzinfo=dt.timezone.utc)
    ok(anotar(reg, c, t0, 'prueba') == 13 and anotar(reg, c, t0, 'prueba') == 0,
       'se anotan una vez: la segunda corrida no suma nada')
    c2 = cumple([{'raw': 'Ana', 'ev': 2, 'oro': 0}])
    anotar(reg, c2, t0, 't1')
    ok('tricampeon' in reg['Ana'], 'quedan para siempre: en la T1 Ana tiene 2 eventos y sigue siendo Tricampeona')
    anotar(reg, {'Dan': {'debut'}}, t0, 't1')
    v_prueba, v_t1 = visibles(reg, 'prueba'), visibles(reg, 't1')
    ok(len(v_prueba['Ana']) == 9 and 'Ana' not in v_t1 and v_t1.get('Dan') == [['debut', '2026-09-27T18:00:00Z']],
       'las de la prueba se ven durante la prueba; desde la T1, sólo las de la T1')
    ok(len(IDS) == len(set(IDS)) and all(len(x) == 4 for x in CATALOGO), 'el catálogo: ids únicos, cuatro campos')
    # ✍️ el Writing Challenge: la pluma de oro por ganar una fecha, la pluma por sumar en 3; sin pedir estar en el pool
    cw = cumple(pool, plumas_oro={'Ana', 'Dlx'}, plumas={'Ana': 3, 'Bea': 2, 'Dlx': 1})
    ok({'pluma_oro', 'pluma'} <= cw['Ana'] and not ({'pluma_oro', 'pluma'} & cw['Bea'])
       and cw.get('Dlx') == {'pluma_oro'},
       'la Pluma de oro a quien ganó una fecha, la Pluma con 3 fechas; quien no está en el pool también (Dlx)')
    # 🏟️ las de liga: sin pedir el pool, y sólo las cuatro suyas
    cl = cumple(pool, ligas={'Ana': {'liga', 'invicto'}, 'Staff': {'liga', 'liga_podio', 'liga_campeon', 'ev25'}})
    ok({'liga', 'invicto'} <= cl['Ana'] and cl.get('Staff') == {'liga', 'liga_podio', 'liga_campeon'},
       'las de liga: también a quien no juega eventos (el staff), y de ahí no entra otra insignia')
    print('\n   %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return mal


def main():
    a = sys.argv[1:]
    if '--auto' in a:
        return 1 if _self_check() else 0
    registro, nuevas = correr(aplicar='--aplicar' in a)
    print('\n══ LAS INSIGNIAS ══\n')
    cuenta = {}
    for tiene in registro.values():
        for i in tiene:
            cuenta[i] = cuenta.get(i, 0) + 1
    for i, emo, nom, _como in CATALOGO:
        print('   %s %-14s %3d' % (emo, nom, cuenta.get(i, 0)))
    print('\n   %d persona(s) con alguna · %d nueva(s) en esta corrida' % (len(registro), nuevas))
    if '--aplicar' not in a:
        print('   (simulacro: no escribí nada — `--aplicar`)')
    print()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
