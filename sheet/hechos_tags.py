# -*- coding: utf-8 -*-
"""LOS HECHOS DE LOS TAGS — lo que cada TAG necesita y NO está en tu fila.

    python sheet/hechos_tags.py            el self-check: casos armados, sin red ni Sheet
    python sheet/hechos_tags.py --contar   cuántos ven cada TAG hoy, sobre `datos/`

Dlx, 14/10/2026: *«crear más tags —esas cosas de abajo— para cada tarjeta y los títulos de arriba como novato,
leyenda etc… crea muchísimos más y combinaciones para cada tarjeta ahora que tenemos más información»*. Las cascadas
viven en cada carta (`01_Temporada/normal_v3.tag()`, `02_Competitivo/v2/gencomp.TAG()`, `comun/titulos.elegir()` y
`04_Pais/maqueta.tag()`); esto junta lo que esas cascadas miran y vive AFUERA de la fila de cada uno: el Most Wanted,
las misiones, el precio por cabeza, las llaves, los duelos, las divisiones y el ranking del lunes.

🔴 POR QUÉ SE CALCULA ACÁ Y NO EN LA CARTA. El sello del ciclo hashea los campos de TU fila (`bot/que_cambio.py`):
un TAG que el generador sacara de `mw.json` o de las llaves cambiaría sin que tu fila cambie, y la carta se quedaría
vieja en silencio — es *«y tampoco ve lo que depende de otros»* de `CLAUDE.md`. Por eso los builders dejan esto como
campos de la fila, y el sello los ve como a cualquier otro:

    temporada_pool.json     `tg_t`   lo de la Temporada              (construir_pool_temporada.py)
    competitivo_pool.json   `tg_c`   lo de la Competitiva            (construir_pool_competitivo.py)
                            `tg_p`   lo de la de País                (idem)
    por_servidor.json       `tg`     adentro de cada servidor        (rankings.escribir_todas, paso 1c)

⚠️ SÓLO LO QUE VALE ALGO: un dict sin ceros ni `False`. Que falte una clave es «no», y así un pool de antes de esto
dibuja igual (sin los TAGs nuevos) en vez de reventar.

⚠️ LO QUE SE MUEVE CON LO QUE HACEN OTROS VA COMO SÍ/NO, NUNCA COMO NÚMERO. Cuántos puestos subiste desde el lunes,
qué parte de los eventos de tu servidor jugaste o a quién le ganaste según SU rango cambian cada vez que juega otro:
guardados como número redibujarían la carta de medio pool en cada corrida. Como sí/no, sólo cuando cruzan el umbral.

⚠️ VA UNA CORRIDA ATRÁS EN LO QUE EL CICLO ESCRIBE DESPUÉS DE LOS POOLS (el Most Wanted, el precio por cabeza, las
misiones), igual que `caz`, `czd` y `mis`: se lee lo que dejó la corrida anterior.
"""
import collections
import datetime as dt
import io
import json
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _p in (RAIZ, os.path.join(RAIZ, 'bot'), os.path.dirname(os.path.abspath(__file__))):
    if _p not in sys.path:
        sys.path.insert(0, _p)
from comun.claves import clave as K  # noqa: E402

#: el podio de la Liga: las tres medallas (`pod` = 🥇+🥈+🥉; la semifinal y el cuarto no son podio)
PODIO = ('Campeón', 'Subcampeón', 'Tercero')
#: llegar a la final
FINAL = ('Campeón', 'Subcampeón')
#: 🆕 DEBUTANTE y 🌱 PROMESA: debutó en la temporada hace a lo sumo esto
RECIENTE_DIAS = 14
#: 🌱 RECIÉN LLEGADO (Servidor): su primer evento EN ESE servidor fue hace a lo sumo esto
LLEGADO_DIAS = 7
#: 🚀 COHETE: puestos subidos desde el lunes
COHETE = 20
#: los ocho tramos del rango, de abajo para arriba (🗡️ MATAGIGANTES mide «dos tramos arriba»)
TRAMOS = ['E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS']
#: ⚡ RELÁMPAGO: eventos ganados en la misma semana (19/10/2026, los TAGs que aprobó Dlx)
RELAMPAGO = 2
#: 🗳️ FAVORITO DEL PÚBLICO: veces que el público lo votó como ganador en el bot en vivo
FAVORITO = 5
#: INTERNACIONAL (la de País): países distintos de los rivales que venció
INTERNACIONAL = 5
#: los ids de la Servidor que chocan con un TAG de otra carta (ver `svtag()`)
CHOCA_T = ('campeon', 'llamas')
CHOCA_C = ('duelista',)


def _j(nombre, defecto=None):
    try:
        with io.open(os.path.join(RAIZ, 'datos', nombre), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return defecto


def hoy_et():
    """La fecha de hoy en hora del este, como `'2026-10-14'`."""
    try:
        from zoneinfo import ZoneInfo
        return dt.datetime.now(ZoneInfo('America/New_York')).date().isoformat()
    except Exception:                                    # noqa: BLE001
        return (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=4)).date().isoformat()


def _menos(dia, dias):
    return (dt.date.fromisoformat(dia) - dt.timedelta(days=dias)).isoformat()


def _semana(dia):
    return tuple(dt.date.fromisoformat(dia).isocalendar()[:2])


def _limpio(d):
    """El dict sin lo que no vale nada, con las claves en orden (el sello compara su `repr`)."""
    return {k: d[k] for k in sorted(d) if d[k]}


def cargar():
    """Todo lo de afuera de la fila, de `datos/`. Lo que falte queda vacío: nunca revienta."""
    return {
        'llaves': _j('llaves_t1.json', {}) or {},
        'rivales': (_j('rivales.json', {}) or {}).get('duelos') or [],
        'mw': _j('mw.json', {}) or {},
        'precios': (_j('precios.json', {}) or {}).get('precios') or [],
        'misiones': _j('misiones.json', {}) or {},
        'divisiones': _j('divisiones.json', {}) or {},
        'semana': _j('ranking_semana.json', {}) or {},
        'ps': (_j('por_servidor.json', {}) or {}).get('gente') or {},
        # 🗳️ cuántas veces el público votó a cada uno como ganador en el bot en vivo (`bot/hechos_vivo.py`, del objeto)
        'favoritos': (_j('favoritos.json', {}) or {}).get('n') or {},
        # 👥 las crews (lo público del objeto, `bot/crews_vivas.py`) y su tier (`bot/crews_tiers.py`)
        'crews': _j('crews_vivas.json', {}) or {},
        'tiers': (_j('crews_tiers.json', {}) or {}).get('tier') or {},
    }


# ══ LO QUE SE ARMA UNA VEZ ══════════════════════════════════════════════════

def eventos(L):
    """`{clave: [(dia, n, sv, puesto), …]}` en orden, de la tabla de cada llave."""
    out = collections.defaultdict(list)
    for n, e in (L or {}).items():
        try:
            num = int(n)
        except ValueError:
            continue
        for fila in e.get('tabla') or []:
            if fila and fila[0]:
                out[K(fila[0])].append((e.get('dia') or '', num, e.get('sv') or '', fila[1] if len(fila) > 1 else ''))
    return {k: sorted(v) for k, v in out.items()}


def duelos(R):
    """`{clave: [(instante, n, rival, ganó), …]}` en orden, de la temporada de ahora.

    ⚠️ LA TEMPORADA ES LA DEL DUELO MÁS NUEVO, no un nombre escrito acá: «prueba» es el nombre interno de la T1 y
    `multiplicadores.temporada_actual()` puede contestar otro según el arranque. Con todos los duelos de la misma
    temporada, la del más nuevo es la de ahora.
    """
    R = [d for d in (R or []) if len(d) >= 6]
    if not R:
        return {}
    ahora = max(R, key=lambda d: (str(d[1]), d[0]))[5]
    out = collections.defaultdict(list)
    for n, t, a, b, g, tp in R:
        if tp != ahora or not a or not b:
            continue
        ka, kb, kg = K(a), K(b), K(g)
        out[ka].append((str(t), n, kb, kg == ka))
        out[kb].append((str(t), n, ka, kg == kb))
    return {k: sorted(v) for k, v in out.items()}


def finales(L):
    """`{clave: [ganadas, perdidas]}` de las finales 1 contra 1 (las de equipo o triples no cuentan)."""
    out = collections.defaultdict(lambda: [0, 0])
    for e in (L or {}).values():
        for r in e.get('rondas') or []:
            if r.get('r') != 'Final':
                continue
            for b in r.get('b') or []:
                lados, gan = (b[0] if b else []), (b[1] if len(b) > 1 else '')
                if len(lados) != 2 or not gan or any(',' in str(x) for x in lados):
                    continue
                out[K(gan)][0] += 1
                for x in lados:
                    if K(x) != K(gan):
                        out[K(x)][1] += 1
    return dict(out)


def _notas(L):
    """Revividos, triples ganados y los revividos que llegaron a la final de ESE evento."""
    rev, trios, fenix = collections.Counter(), collections.Counter(), collections.Counter()
    for n, e in (L or {}).items():
        puesto = {K(f[0]): (f[1] if len(f) > 1 else '') for f in e.get('tabla') or [] if f}
        for r in e.get('rondas') or []:
            for b in r.get('b') or []:
                nota = (b[2] if len(b) > 2 else '') or ''
                gan = b[1] if len(b) > 1 else ''
                for m in re.finditer(r'Revivido: ([^;]+)', nota):
                    k = K(m.group(1))
                    rev[k] += 1
                    if puesto.get(k) in FINAL:
                        fenix[k] += 1
                # ⚠️ el triple de una persona, no el de un equipo: «A, B, C» no es nadie
                if 'triple' in nota and gan and ',' not in gan:
                    trios[K(gan)] += 1
    return rev, trios, fenix


def crews_hechos(vivas, tiers):
    """`(fundadores, elite)`: quién es Líder de una crew que armó él y ya pasó su primera semana (las de la Liga no
    cuentan: ésas las armó Dlx), y quién está en una crew de Diamante o más —el tier que desbloquea la tarjeta de crew—.
    ⚠️ Quien está sin verificarse (el cuarto lugar de `gente`, `crewVerificar()` de bot/crews.js) no cuenta."""
    try:
        from crews_tiers import TARJETA as diamante
    except Exception:                                    # noqa: BLE001
        diamante = 4
    fund, elite = set(), set()
    for c in (vivas or {}).get('crews') or []:
        gente = [g for g in c.get('gente') or [] if g and not (len(g) > 3 and g[3])]
        lider = next((g[0] for g in gente if len(g) > 1 and g[1] == 'lider'), '')
        if lider and not c.get('oficial') and not c.get('vence') and c.get('fund') == lider:
            fund.add(lider)
        if int((tiers or {}).get(c.get('id'), 0) or 0) >= diamante:
            elite |= {g[0] for g in gente}
    return fund, elite


def _cc_de(*pools):
    out = {}
    for pool in pools:
        for x in pool or []:
            if x.get('cc') and K(x.get('raw')) not in out:
                out[K(x['raw'])] = x['cc']
    return out


# ══ TEMPORADA ═══════════════════════════════════════════════════════════════

def misiones(M):
    """`{clave: semanas perfectas}`: las tres de siempre cumplidas (la cacería y el dorado van aparte, como el bono)."""
    try:
        import misiones as _M
    except Exception:                                    # noqa: BLE001
        return {}
    out = collections.Counter()
    for s in ((M or {}).get('semanas') or {}).values():
        lista = s.get('lista') or []
        for quien, vs in (s.get('prog') or {}).items():
            base = [_M.cumplida(m[0], vs[i], m[3]) for i, m in enumerate(lista)
                    if i < len(vs or []) and len(m) > 3 and m[0] not in ('caza', 'dorado')]
            if base and all(base):
                out[K(quien)] += 1
    return dict(out)


def most_wanted(mw):
    """De `mw.json`: veces buscado, cazas sin ayuda, si cazó a El Rey, si está suelto esta semana y de qué servidor
    fue «El Dueño de Casa»."""
    actual = (mw or {}).get('actual') or {}
    per = ([actual] if actual else []) + list((mw or {}).get('historial') or [])
    out = collections.defaultdict(lambda: {'busc': 0, 'solo': 0, 'rey': False, 'suelto': False, 'casa': set()})
    try:
        from rankings import cod as _cod
    except Exception:                                    # noqa: BLE001
        _cod = (lambda x: x)
    for p in per:
        for b in p.get('buscados') or []:
            k = K(b.get('n'))
            out[k]['busc'] += 1
            if b.get('cn') == 'El Dueño de Casa':
                m = re.search(r'el mejor de (\S+)', b.get('motivo') or '')
                if m:
                    out[k]['casa'].add(_cod(m.group(1)))
            if p is actual and b.get('estado') == 'suelto':
                out[k]['suelto'] = True
            por = (b.get('caza') or {}).get('por') or []
            for y in por:
                ky = K(y.get('n'))
                if b.get('cn') == 'El Rey':
                    out[ky]['rey'] = True
                if len(por) == 1:
                    out[ky]['solo'] += 1
    return dict(out)


def precios(P):
    """De `precios.json`: `({clave: veces con precio}, {clave: precios cobrados})`."""
    cab, cobro = collections.Counter(), collections.Counter()
    for x in P or []:
        cab[K(x.get('cabeza'))] += 1
        for y in x.get('por') or []:
            if y:
                cobro[K(y[0])] += 1
    return dict(cab), dict(cobro)


def temporada(filas, D=None, hoy=None, comp=None):
    """`{clave: hechos}` de la Temporada. `filas` es el pool de temporada YA con `pos` y `fc` puestos.

    Claves: `rey` cazó a El Rey · `busc` veces buscado · `solo` cazas sin ayuda · `suelto` buscado esta semana ·
    `cab` veces con precio · `cobro` precios cobrados · `perf` semanas perfectas · `svc` servidores donde salió campeón ·
    `dcor` ganó su primer evento · `fenix` revivido que llegó a la final · `podsem` podio en cada semana ·
    `cohete` subió 20 o más desde el lunes · `dobles` días con dos eventos o más · `trios` triples ganados ·
    `reciente` debutó hace 14 días o menos · `rev` revividos · `sube` subió de división · `infalt` jugó cada semana ·
    `svtag` el TAG de su Servidor cuando choca con uno de esta carta (ver `svtag()`).

    Y desde el 19/10/2026 (los que aprobó Dlx): `relampago` ganó 2 eventos o más en la misma semana · `fcrew` es Líder
    de la crew que armó y ya pasó su primera semana · `elite` está en una crew de Diamante o más · `fav` el público lo
    votó como ganador 5 veces o más en el bot en vivo. Los cuatro como sí/no: los de crews se mueven con lo que hacen
    otros, y el de los votos, con cada voto.
    """
    D = D or cargar()
    hoy = hoy or hoy_et()
    L = D['llaves']
    ev = eventos(L)
    rev, trios, fenix = _notas(L)
    perf = misiones(D['misiones'])
    mw = most_wanted(D['mw'])
    cab, cobro = precios(D['precios'])
    dv = D['divisiones'] or {}
    sube = {K(x) for x in (dv.get('ult') or {}).get('sube') or []}
    lunes = {K(n): v for n, v in ((D['semana'] or {}).get('pos') or {}).items()}
    # ⚠️ LAS SEMANAS QUE YA TERMINARON, no la de hoy: con la de hoy adentro, el lunes a la medianoche todos perderían
    # 📅 INFALTABLE y 📆 PODIO CADA SEMANA hasta volver a jugar. Con menos de dos semanas no hay constancia que medir
    sem_hoy = _semana(hoy)
    pasadas = {_semana(e['dia']) for e in L.values() if e.get('dia')} - {sem_hoy}
    pasadas = {s for s in pasadas if s < sem_hoy}
    comp = {K(x['raw']): x for x in (comp if comp is not None else (_j('competitivo_pool.json', []) or []))}
    fav = collections.Counter()
    for n, c in (D.get('favoritos') or {}).items():
        try:
            fav[K(n)] += int(c or 0)
        except (TypeError, ValueError):
            continue
    fund, elite = crews_hechos(D.get('crews'), D.get('tiers'))
    out = {}
    for f in filas:
        k = K(f.get('raw'))
        evs = ev.get(k, [])
        semanas = {_semana(e[0]) for e in evs if e[0]}
        con_podio = {_semana(e[0]) for e in evs if e[0] and e[3] in PODIO}
        dias = collections.Counter(e[0] for e in evs if e[0])
        m = mw.get(k) or {}
        pl = lunes.get(k)
        h = {
            'rey': m.get('rey', False), 'busc': m.get('busc', 0), 'solo': m.get('solo', 0),
            'suelto': m.get('suelto', False),
            'cab': cab.get(k, 0), 'cobro': cobro.get(k, 0), 'perf': perf.get(k, 0),
            'svc': len({e[2] for e in evs if e[3] == 'Campeón'}),
            'dcor': bool(evs) and evs[0][3] == 'Campeón',
            'fenix': fenix.get(k, 0),
            'podsem': len(pasadas) >= 2 and pasadas <= con_podio,
            'cohete': bool(pl and f.get('pos') and not f.get('fc') and pl - f['pos'] >= COHETE),
            'dobles': sum(1 for n in dias.values() if n >= 2),
            'trios': trios.get(k, 0),
            'reciente': bool(evs) and evs[0][0] >= _menos(hoy, RECIENTE_DIAS),
            'rev': rev.get(k, 0),
            'sube': k in sube,
            'infalt': len(pasadas) >= 2 and pasadas <= semanas,
            'relampago': max(list(collections.Counter(_semana(e[0]) for e in evs if e[0] and e[3] == 'Campeón').values())
                             or [0]) >= RELAMPAGO,
            'fcrew': k in fund,
            'elite': k in elite,
            'fav': fav.get(k, 0) >= FAVORITO,
        }
        st = svtag(f.get('raw'), comp.get(k), D['ps'])
        h['svtag'] = st if st in CHOCA_T else ''
        out[k] = _limpio(h)
    return out


# ══ COMPETITIVO ═════════════════════════════════════════════════════════════

def _tramo(letra):
    return TRAMOS.index(letra) if letra in TRAMOS else None


def competitivo(filas_c, D=None):
    """`{clave: hechos}` de la Competitiva.

    Claves: `fg`/`fp` finales ganadas/perdidas · `mata` duelos ganados a alguien dos tramos de rango arriba ·
    `bestia` le ganó tantas veces al mismo rival sin perder nunca · `vengo` revanchas (perdió con X y después le
    ganó) · `clasico` cruces con el mismo rival · `dg` duelos ganados · `venc` rivales distintos vencidos ·
    `riv` rivales distintos enfrentados · `svtag` (ver `svtag()`).

    ⚠️ EL RANGO DEL RIVAL ES EL DE HOY, no el del día del duelo: el pool no guarda la historia de las letras.
    """
    D = D or cargar()
    du = duelos(D['rivales'])
    fin = finales(D['llaves'])
    letra = {K(x['raw']): x.get('rango') or '' for x in filas_c}
    out = {}
    for f in filas_c:
        k = K(f.get('raw'))
        d = du.get(k, [])
        vs = collections.defaultdict(lambda: [0, 0])
        perdio_con, rev = set(), 0
        for _t, _n, otro, gano in d:
            vs[otro][0 if gano else 1] += 1
            if gano and otro in perdio_con:
                rev += 1
                perdio_con.discard(otro)
            elif not gano:
                perdio_con.add(otro)
        mio = _tramo(letra.get(k))
        mata = 0
        if mio is not None:
            for _t, _n, otro, gano in d:
                su = _tramo(letra.get(otro))
                if gano and su is not None and su - mio >= 2:
                    mata += 1
        fg, fp = fin.get(k, (0, 0))
        h = {'fg': fg, 'fp': fp, 'mata': mata,
             'bestia': max([a for a, b in vs.values() if b == 0] or [0]),
             'vengo': rev,
             'clasico': max([a + b for a, b in vs.values()] or [0]),
             'dg': sum(1 for x in d if x[3]),
             'venc': sum(1 for a, _b in vs.values() if a),
             'riv': len(vs)}
        st = svtag(f.get('raw'), f, D['ps'])
        h['svtag'] = st if st in CHOCA_C else ''
        out[k] = _limpio(h)
    return out


# ══ PAÍS ════════════════════════════════════════════════════════════════════

def pais(filas_c, filas_t=None, D=None):
    """`{clave: hechos}` de la de País.

    Claves: `paises` países distintos de los rivales que enfrentó · `paisesg` los de los que venció (19/10/2026) · `pionero` el primero de su país en debutar en la
    temporada · `primer` el primero de su país en salir campeón · `unico` el único campeón de su país. Las tres de
    país, sólo en países con 3 o más personas que jugaron: «el primero de 1» no dice nada (la regla de los puestos).
    """
    D = D or cargar()
    filas_t = filas_t if filas_t is not None else (_j('temporada_pool.json', []) or [])
    cc = _cc_de(filas_c, filas_t)
    ev = eventos(D['llaves'])
    du = duelos(D['rivales'])
    por_pais = collections.defaultdict(list)
    for k, evs in ev.items():
        if cc.get(k) and evs:
            por_pais[cc[k]].append(k)
    pionero, primer, unico = set(), set(), set()
    for _c, ks in por_pais.items():
        if len(ks) < 3:
            continue
        d0 = min(ev[k][0][:2] for k in ks)
        pionero |= {k for k in ks if ev[k][0][:2] == d0}
        camps = {k: min(e[:2] for e in ev[k] if e[3] == 'Campeón') for k in ks
                 if any(e[3] == 'Campeón' for e in ev[k])}
        if camps:
            c0 = min(camps.values())
            primer |= {k for k, v in camps.items() if v == c0}
        if len(camps) == 1:
            unico |= set(camps)
    out = {}
    for f in filas_c:
        k = K(f.get('raw'))
        out[k] = _limpio({'paises': len({cc[x[2]] for x in du.get(k, []) if cc.get(x[2])}),
                          'paisesg': len({cc[x[2]] for x in du.get(k, []) if x[3] and cc.get(x[2])}),
                          'pionero': k in pionero, 'primer': k in primer, 'unico': k in unico})
    return out


# ══ SERVIDOR ════════════════════════════════════════════════════════════════

def duenos(filas_c):
    """`{sv: clave}` del #1 de cada servidor con 3 o más (el mismo umbral que dibuja la carta)."""
    out = {}
    for x in filas_c or []:
        a, _s, b = str(x.get('pos_sv') or '').partition('/')
        if a == '1' and b.isdigit() and int(b) >= 3 and x.get('sv'):
            out[x['sv']] = K(x['raw'])
    return out


def servidor(ps, filas_c=None, D=None, hoy=None):
    """`{rapero: {sv: hechos}}` de cada servidor donde jugó, para su carta de Servidor (la propia y las camisetas).

    Claves: `dv` le ganó un duelo al #1 de ese servidor · `fin` finales ahí · `fund` jugó el primer evento de la
    temporada de ese servidor · `llave` jugó la mitad o más de los eventos de ese servidor (con 4 o más) · `bcasa` fue
    «El Dueño de Casa» de ese servidor en el Most Wanted · `nuevo` su primer evento ahí fue hace 7 días o menos.
    """
    D = D or cargar()
    hoy = hoy or hoy_et()
    filas_c = filas_c if filas_c is not None else (_j('competitivo_pool.json', []) or [])
    L = D['llaves']
    ev = eventos(L)
    du = duelos(D['rivales'])
    mw = most_wanted(D['mw'])
    dn = duenos(filas_c)
    del_sv = collections.defaultdict(list)
    for e in L.values():
        if e.get('sv'):
            del_sv[e['sv']].append((e.get('dia') or '', int(e.get('n') or 0)))
    primero = {sv: min(v) for sv, v in del_sv.items()}
    gente_primero = collections.defaultdict(set)
    for n, e in L.items():
        sv = e.get('sv')
        if sv and (e.get('dia') or '', int(e.get('n') or 0)) == primero.get(sv):
            gente_primero[sv] |= {K(f[0]) for f in e.get('tabla') or [] if f}
    out = {}
    for q, svs in (ps or {}).items():
        k = K(q)
        mios = ev.get(k, [])
        venci = {x[2] for x in du.get(k, []) if x[3]}
        casa = (mw.get(k) or {}).get('casa') or set()
        for sv in svs:
            ahi = [e for e in mios if e[2] == sv]
            tot = len(del_sv.get(sv, []))
            h = {'dv': bool(dn.get(sv)) and dn[sv] != k and dn[sv] in venci,
                 'fin': sum(1 for e in ahi if e[3] in FINAL),
                 'fund': k in gente_primero.get(sv, ()),
                 'llave': tot >= 4 and len(ahi) * 2 >= tot,
                 'bcasa': sv in casa,
                 'nuevo': bool(ahi) and ahi[0][0] >= _menos(hoy, LLEGADO_DIAS)}
            h = _limpio(h)
            if h:
                out.setdefault(q, {})[sv] = h
    return out


def con_hechos(ps, filas_c=None, D=None, hoy=None):
    """`ps` (`rankings.por_servidor()`) con los hechos adentro de cada servidor, en `tg`. No toca el original."""
    hs = servidor(ps, filas_c, D, hoy)
    nuevo = {}
    for q, svs in (ps or {}).items():
        nuevo[q] = {}
        for sv, v in svs.items():
            v = dict(v)
            v.pop('tg', None)
            if (hs.get(q) or {}).get(sv):
                v['tg'] = hs[q][sv]
            nuevo[q][sv] = v
    return nuevo


def svtag(nombre, fila_c, ps):
    """El id del TAG de la carta de Servidor PROPIA de `nombre`, o `''`.

    🔑 «CADA HECHO EN UNA SOLA CARTA» (catálogo, 3.4): si la Servidor de esa persona ya dice 🏆 CAMPEÓN, 🔥 EN LLAMAS o
    ⚔️ DUELISTA, la Temporada o la Competitiva no lo repiten y caen al siguiente — manda la carta donde es más angosto.
    Se calcula con la misma cascada que dibuja la Servidor (`comun/titulos.elegir()`), con lo de su servidor.
    """
    if not fila_c or not fila_c.get('sv'):
        return ''
    x = ((ps or {}).get(nombre) or {}).get(fila_c['sv'])
    if not x:
        return ''
    a, _s, b = str(fila_c.get('pos_sv') or '').partition('/')
    try:
        from comun import titulos as _TIT
        return _TIT.elegir(dict(pos_sv=int(a) if a.isdigit() else 0, total_sv=int(b) if b.isdigit() else 0,
                                titulos=x.get('oro', 0), podios=x.get('pod', 0), racha=x.get('racha') or '0/0',
                                duelos=x.get('duelos') or '0/0', eventos=x.get('ev', 0),
                                hechos=x.get('tg') or {}, casa=True))[0]
    except Exception:                                    # noqa: BLE001
        return ''


# ══ EL SELF-CHECK ═══════════════════════════════════════════════════════════

def _self_check():
    mal = 0

    def ok(cond, que):
        nonlocal mal
        mal += not cond
        print('   %s %s' % ('✅' if cond else '🔴', que))

    print('\n══ LOS HECHOS DE LOS TAGS, con casos armados ══\n')
    L = {
        '1': {'n': 1, 'dia': '2026-09-22', 'sv': 'FFA', 'tabla': [['Ana', 'Campeón', 1], ['Beto', 'Subcampeón', 1],
                                                                   ['Cyn', 'Tercero', 1], ['Dan', 'Octavos', 1]],
              'rondas': [{'r': 'Final', 'b': [[['Ana', 'Beto'], 'Ana', '']]},
                         {'r': 'Semifinales', 'b': [[['Beto', 'Cyn'], 'Beto', 'Revivido: Beto']]}]},
        '2': {'n': 2, 'dia': '2026-09-30', 'sv': 'SR', 'tabla': [['Ana', 'Campeón', 1], ['Beto', 'Subcampeón', 1],
                                                                  ['Eva', 'Octavos', 1]],
              'rondas': [{'r': 'Final', 'b': [[['Ana', 'Beto'], 'Ana', '']]},
                         {'r': 'Cuartos', 'b': [[['Ana', 'Eva', 'Dan'], 'Ana', 'triple (3 bandas)']]}]},
        '3': {'n': 3, 'dia': '2026-10-07', 'sv': 'FFA', 'tabla': [['Ana', 'Subcampeón', 1], ['Beto', 'Campeón', 1],
                                                                   ['Eva', 'Tercero', 1]],
              'rondas': [{'r': 'Final', 'b': [[['Ana', 'Beto'], 'Beto', '']]},
                         {'r': 'Final', 'b': [[['Ana, Eva', 'Beto, Cyn'], 'Ana, Eva', '']]}]},
        '4': {'n': 4, 'dia': '2026-10-07', 'sv': 'FFA', 'tabla': [['Ana', 'Octavos', 1]], 'rondas': []},
    }
    R = [[1, '2026-09-22T20:00:00Z', 'Ana', 'Beto', 'Ana', 'prueba'],
         [1, '2026-09-22T21:00:00Z', 'Beto', 'Cyn', 'Beto', 'prueba'],
         [2, '2026-09-30T20:00:00Z', 'Ana', 'Beto', 'Beto', 'prueba'],
         [2, '2026-09-30T21:00:00Z', 'Ana', 'Beto', 'Ana', 'prueba'],
         [3, '2026-10-07T20:00:00Z', 'Eva', 'Ana', 'Eva', 'prueba'],
         [0, '2025-01-01T00:00:00Z', 'Ana', 'Dan', 'Dan', 'pre']]
    mw = {'actual': {'buscados': [{'n': 'Beto', 'cn': 'El Rey', 'estado': 'suelto'},
                                  {'n': 'Dan', 'cn': 'El Dueño de Casa', 'motivo': 'el mejor de FFA',
                                   'estado': 'cazado', 'caza': {'por': [{'n': 'Ana'}]}}]},
          'historial': [{'buscados': [{'n': 'Cyn', 'cn': 'El Rey', 'estado': 'cazado',
                                       'caza': {'por': [{'n': 'Ana'}, {'n': 'Eva'}]}},
                                      {'n': 'Beto', 'cn': 'El Veterano', 'estado': 'escondio'}]}]}
    D = {'llaves': L, 'rivales': R, 'mw': mw,
         'precios': [{'cabeza': 'Beto', 'por': [['Ana', 1000]]}, {'cabeza': 'Beto', 'por': []}],
         'misiones': {}, 'divisiones': {'ult': {'sube': ['Eva']}},
         'semana': {'pos': {'Eva': 40, 'Ana': 2}}, 'ps': {}}
    T = [{'raw': 'Ana', 'pos': 1}, {'raw': 'Beto', 'pos': 2}, {'raw': 'Eva', 'pos': 15}, {'raw': 'Dan', 'pos': 9}]
    C = [{'raw': 'Ana', 'rango': 'E', 'sv': 'FFA', 'pos_sv': '2/4', 'cc': 'ar'},
         {'raw': 'Beto', 'rango': 'B', 'sv': 'FFA', 'pos_sv': '1/4', 'cc': 'ar'},
         {'raw': 'Cyn', 'rango': 'C', 'sv': 'FFA', 'pos_sv': '3/4', 'cc': 'cl'},
         {'raw': 'Eva', 'rango': 'D', 'sv': 'FFA', 'pos_sv': '4/4', 'cc': 'ar'},
         {'raw': 'Dan', 'rango': '', 'sv': 'SR', 'pos_sv': '', 'cc': 'mx'}]
    t = temporada(T, D, hoy='2026-10-14', comp=C)
    a, b, e = t['ana'], t['beto'], t['eva']
    ok(a.get('svc') == 2 and a.get('dcor'), 'Ana: campeona en dos servidores y ganó su primer evento')
    ok(a.get('rey') and a.get('solo') == 1, 'Ana cazó a El Rey (de a dos) y a uno sola: la caza sola cuenta una')
    ok(b.get('suelto') and b.get('busc') == 2 and b.get('cab') == 2, 'Beto: suelto esta semana, buscado 2 veces, '
       'con precio 2 veces')
    ok(a.get('cobro') == 1 and not b.get('cobro'), 'el precio cobrado es de quien cazó, no de la cabeza')
    ok(b.get('fenix') == 1 and b.get('rev') == 1, 'Beto, revivido en el #1, llegó a la final de ESE evento: fénix')
    ok(not a.get('fenix'), 'y quien no fue revivido no es fénix aunque llegue a la final')
    ok(e.get('cohete') and e.get('sube') and not a.get('cohete'), 'Eva subió 25 desde el lunes y de división; '
       'Ana subió 1')
    ok(a.get('trios') == 1 and a.get('dobles') == 1, 'Ana ganó un triple y jugó dos eventos el 07/10')
    ok(a.get('infalt') and a.get('podsem'), 'Ana jugó e hizo podio en las tres semanas que ya terminaron')
    ok(not t['dan'].get('infalt'), 'Dan jugó una sola semana: no es infaltable')
    ok(e.get('reciente') and not a.get('reciente'), 'Eva debutó el 30/09 (14 días): reciente; Ana el 22/09, no')
    ok(not [k for k, v in t.items() for x in v.values() if not x], 'sólo lo que vale algo: ni ceros ni False')
    # la semana de hoy no cuenta: si Ana no hubiera jugado esta semana seguiría siendo infaltable
    t2 = temporada(T, dict(D, llaves=dict(L, **{'5': {'n': 5, 'dia': '2026-10-13', 'sv': 'FFA',
                                                       'tabla': [['Eva', 'Octavos', 1]], 'rondas': []}})),
                   hoy='2026-10-14', comp=C)
    ok(t2['ana'].get('infalt'), 'el lunes no le saca a nadie el 📅 INFALTABLE: la semana de hoy no se exige')
    # ⚡ 👥 💎 🗳️ los del 19/10/2026
    D6 = dict(D, llaves=dict(L, **{'6': {'n': 6, 'dia': '2026-10-08', 'sv': 'SR', 'tabla': [['Beto', 'Campeón', 1]],
                                         'rondas': []}}),
              favoritos={'Ana': 5, 'Beto': 4},
              crews={'crews': [{'id': 'Los Pibes', 'oficial': False, 'vence': 0, 'fund': 'ana',
                                'gente': [['ana', 'lider', 1], ['beto', 'miembro', 2], ['eva', 'miembro', 3, 99]]},
                               {'id': 'Nueva', 'oficial': False, 'vence': 5, 'fund': 'cyn', 'gente': [['cyn', 'lider', 1]]},
                               {'id': 'Liga', 'oficial': True, 'vence': 0, 'gente': [['dan', 'lider', 1]]}]},
              tiers={'Los Pibes': 4, 'Liga': 3})
    t6 = temporada(T + [{'raw': 'Cyn', 'pos': 20}], D6, hoy='2026-10-14', comp=C)
    ok(t6['beto'].get('relampago') and not t6['ana'].get('relampago'),
       'relámpago: Beto ganó el 07/10 y el 08/10 (la misma semana); Ana ganó en dos semanas distintas')
    ok(t6['ana'].get('fcrew') and not t6['cyn'].get('fcrew') and not t6['dan'].get('fcrew'),
       'fundador de crew: Ana armó la suya y pasó la semana; Cyn todavía no, y la de Dan es de la Liga')
    ok(t6['ana'].get('elite') and t6['beto'].get('elite') and not t6['eva'].get('elite') and not t6['dan'].get('elite'),
       'crew de élite: Ana y Beto en una de Diamante; Eva está sin verificarse y Dan en una de Platino')
    ok(t6['ana'].get('fav') and not t6['beto'].get('fav'), 'favorito del público: Ana 5 veces, Beto 4')
    c = competitivo(C, D)
    ok(c['ana'].get('fg') == 2 and c['ana'].get('fp') == 1 and c['beto'].get('fp') == 2,
       'finales 1 contra 1: Ana 2-1, Beto 1-2 (la de equipos no cuenta)')
    ok(c['ana'].get('vengo') == 1, 'Ana perdió con Beto y después le ganó: una revancha')
    ok(c['ana'].get('mata') == 2 and not c['eva'].get('mata'), 'Ana (E) le ganó dos veces a Beto (B): '
       'matagigantes; Eva (D) a Ana (E): no')
    ok(c['beto'].get('bestia') == 1 and c['beto'].get('riv') == 2 and c['ana'].get('riv') == 2,
       'Beto le ganó a Cyn sin perder; el duelo de otra temporada no cuenta (Ana: Beto y Eva)')
    p = pais(C, T, D)
    ok(p['ana'].get('pionero') and p['beto'].get('pionero') and not p['eva'].get('pionero'),
       'Argentina: Ana y Beto debutaron en el primer evento, Eva después')
    ok(p['ana'].get('primer') and not p['beto'].get('primer') and not p['ana'].get('unico'),
       'Ana fue la primera campeona argentina; Beto también ganó, así que no hay único')
    ok(not p['cyn'].get('pionero'), 'Chile tiene 1 persona: sin pionero (el umbral de 3)')
    ok(p['beto'].get('paisesg') == 2 and p['ana'].get('paisesg') == 1 and not p['dan'].get('paisesg'),
       'países vencidos: Beto le ganó a un argentino y a una chilena (2), Ana sólo a argentinos (1)')
    ok(p['ana'].get('paises') == 1 and p['beto'].get('paises') == 2,
       'países enfrentados: Ana sólo argentinos (1), Beto argentina y chileno (2)')
    ps = {'Ana': {'FFA': {'ev': 3}, 'SR': {'ev': 1}}, 'Beto': {'FFA': {'ev': 2}}, 'Eva': {'FFA': {'ev': 2}},
          'Dan': {'FFA': {'ev': 1}}}
    s = servidor(ps, C, D, hoy='2026-10-14')
    ok(s['Ana']['FFA'].get('dv') and not (s.get('Beto') or {}).get('FFA', {}).get('dv'),
       'Ana le ganó al dueño de FFA (Beto); el dueño no es su propio verdugo')
    ok(s['Ana']['FFA'].get('fund') and s['Ana']['FFA'].get('fin') == 2 and s['Dan']['FFA'].get('fund'),
       'Ana y Dan jugaron el primer evento de FFA; Ana hizo dos finales ahí')
    ok(not s['Ana']['FFA'].get('llave'), 'FFA tiene 3 eventos: sin 🔑 LLAVE DE LA CASA (pide 4)')
    ok(s['Dan']['FFA'].get('bcasa') and not s['Ana']['FFA'].get('bcasa'),
       'el Dueño de Casa del MW es de quien lo fue (Dan), no de quien lo cazó (Ana)')
    ok(s['Eva']['FFA'].get('nuevo') and not s['Ana'].get('SR', {}).get('nuevo'),
       'Eva llegó a FFA el 07/10 (hace 7 días): recién llegada; Ana a SR el 30/09, no')
    D5 = dict(D, llaves=dict(L, **{'5': {'n': 5, 'dia': '2026-10-13', 'sv': 'FFA',
                                         'tabla': [['Eva', 'Octavos', 1]], 'rondas': []}}))
    s5 = servidor(ps, C, D5, hoy='2026-10-14')
    ok(s5['Ana']['FFA'].get('llave') and s5['Eva']['FFA'].get('llave') and not s5['Dan'].get('FFA', {}).get('llave'),
       'con 4 eventos en FFA: Ana jugó 3 y Eva 2 (la mitad), Dan 1')
    nuevo = con_hechos(ps, C, D, hoy='2026-10-14')
    ok('tg' in nuevo['Ana']['FFA'] and 'tg' not in ps['Ana']['FFA'], 'con_hechos() no toca el original')
    print('')
    return mal


# ══ CUÁNTOS VEN CADA TAG ════════════════════════════════════════════════════

def contar():
    """Corre las cuatro cascadas de verdad sobre `datos/` con los hechos de hoy, y cuenta qué ve cada uno.

    ⚠️ SOBRE EL POOL, NO SOBRE QUIEN TIENE CARTA: quién tiene cada carta lo decide el portón
    (`verificados.puede()`), que pide Discord. Lo que esto mide es la forma de la cascada: cuánto se lleva el piso.
    """
    import importlib.util
    D = cargar()
    T = _j('temporada_pool.json', []) or []
    C = _j('competitivo_pool.json', []) or []
    if not T:
        print('   el pool de temporada está vacío: no hay a quién contar')
        return 0
    ht, hc, hp = temporada(T, D, comp=C), competitivo(C, D), pais(C, T, D)

    def _mod(carpeta, archivo, nombre):
        antes = os.getcwd()
        os.chdir(os.path.join(RAIZ, carpeta))
        try:
            spec = importlib.util.spec_from_file_location(nombre, os.path.join(RAIZ, carpeta, archivo))
            m = importlib.util.module_from_spec(spec)
            _so = sys.stdout
            sys.stdout = io.StringIO()
            try:
                spec.loader.exec_module(m)
            finally:
                sys.stdout = _so
            return m
        finally:
            os.chdir(antes)

    def _tabla(titulo, cuenta, n):
        print('\n   %s (n=%d)' % (titulo, n))
        for (txt, niv), c in sorted(cuenta.items(), key=lambda x: (x[0][1], -x[1])):
            print('      %-3s %-28s %4d' % (niv, txt, c))

    nv3 = _mod('01_Temporada', 'normal_v3.py', '_nv3')
    cu = collections.Counter()
    for f in T:
        if f.get('ev'):
            x = dict(f, tg_t=ht.get(K(f['raw']), {}))
            t, nivel = nv3.tag(x)
            cu[(re.sub(r'x\d+$', 'xN', t), nivel)] += 1
    _tabla('TEMPORADA — los que jugaron', cu, sum(cu.values()))
    gc = _mod(os.path.join('02_Competitivo', 'v2'), 'gencomp.py', '_gc')
    cu = collections.Counter()
    for f in C:
        if f.get('rango'):
            cu[gc.TAG(dict(f, tg_c=hc.get(K(f['raw']), {})))] += 1
    _tabla('COMPETITIVO — los que tienen letra', cu, sum(cu.values()))
    from comun import titulos as TIT
    ps = con_hechos(D['ps'], C, D)
    cu = collections.Counter()
    for f in C:
        x = (ps.get(f['raw']) or {}).get(f.get('sv'))
        if not x:
            continue
        a, _s, b = str(f.get('pos_sv') or '').partition('/')
        _i, t, nivel = TIT.elegir(dict(pos_sv=int(a) if a.isdigit() else 0, total_sv=int(b) if b.isdigit() else 0,
                                       titulos=x.get('oro', 0), podios=x.get('pod', 0), racha=x.get('racha') or '0/0',
                                       duelos=x.get('duelos') or '0/0', eventos=x.get('ev', 0),
                                       hechos=x.get('tg') or {}, casa=True))
        cu[(t, nivel)] += 1
    _tabla('SERVIDOR — la propia, de los que jugaron ahí', cu, sum(cu.values()))
    from comun.requisitos import falta
    mq = _mod('04_Pais', 'maqueta.py', '_mq')
    tt = {x['raw']: x for x in T}
    cu = collections.Counter()
    for f in C:
        if falta('pais', f) is not None:
            continue
        t = tt.get(f['raw'], {})
        h = dict(hp.get(K(f['raw']), {}), srv=t.get('srv', 0))
        txt, nivel = mq.tag(f.get('pos_pais') or '', 0, 0, t.get('ev', f.get('ev', 0)), t.get('pod', 0),
                            f.get('wr') or '0%', f.get('rch_max', 0), '%d/%d' % (f.get('dna_v', 0), f.get('dna_t', 0)),
                            '%d/%d' % (f.get('din_v', 0), f.get('din_t', 0)), h)
        cu[(re.sub(r'\d+', 'N', txt), nivel)] += 1
    _tabla('PAÍS — los que pasan el requisito', cu, sum(cu.values()))
    print('')
    return 0


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:                                    # noqa: BLE001
        pass
    if '--contar' in sys.argv:
        sys.exit(contar())
    sys.exit(1 if _self_check() else 0)
