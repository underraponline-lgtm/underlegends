# -*- coding: utf-8 -*-
"""LO QUE PUBLICAN SOLOS LOS SERVIDORES Y LA GENTE, en el muro de Publicaciones (`bot/muro.py`).

Dlx, 15/11/2026: *«me gustaría que también los sv publiquen cosas de forma automática así como lo hace la liga, y quizás
los usuarios también sus cosas como subí de tarjeta»*. A la propuesta: *«1. B»* (en primera persona, firmada por quien la
protagoniza: la voz la pone la página), *«2. dale»* (cada uno apaga las suyas en Tu cuenta) y *«3. TODO»*.

    python bot/muro_solos.py --auto     el self-check, sin red ni archivos

LO QUE PUBLICA CADA SERVIDOR (tipos `sv…`: la página los firma con su logo)
- svlunes    el lunes, cuando se sortea la semana: su ×N, su meta, contra quién es su guerra y si tiene el evento dorado
- svsemana   al cerrar la semana: eventos, participaciones, sus campeones, si cumplió la meta y si ganó la guerra
- svmeta     la meta de la semana cumplida, en el momento (un cambio: se anota)
- svtop      su nuevo #1, el primero de los suyos en el Ranking Temporada (un cambio)
- svrecord   el evento con más gente de su temporada (desde su 4.º evento y con `RECORD_MIN` o más)
- svnuevo · svtier   entra a la Liga, o cambia de tier (un cambio)

LO DE CADA UNO (la página lo firma con su cara)
- podio      su primer podio de la temporada, si no fue un título (el primer título lo marca el campeón: `primeros()`)
- top10      entra al top 10 del Ranking Temporada o del Competitivo (un cambio; una vez por semana por ranking)
- subio      el lunes, los que más puestos subieron la semana anterior (desde `SUBIO_MIN`, hasta `SUBIO_TOPE`)
- racha      llega a 5, 10, 15, 20 o 30 eventos seguidos (un cambio; 3 pasa todas las semanas y llenaba el muro)
- crewunion  entra a una crew · crewnueva, la crea (de `datos/crews_vivas.json`, con su fecha)

⚠️ LO QUE ES UN CAMBIO SE ANOTA (`extra` en datos/muro.json), como los rangos de `muro.cambios()`: la primera vez sólo
se anota cómo está, o el muro arrancaría con cien «entré al top 10» que no pasaron hoy.
⚠️ QUIEN LAS APAGA EN TU CUENTA NO SALE (`apagados()`, KV `muro:no`, la escribe el objeto: `muroMio()` en
bot/avisos.js). Se saca toda publicación cuya gente es TODA de quienes las apagaron: un título en dupla sigue saliendo
si el otro no las apagó.
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

#: 🙈 quién apagó sus publicaciones: la clave de KV y la copia local (gitignoreada: es un dato de cada persona)
CLAVE_KV = 'muro:no'
COPIA = os.path.join(BASE, 'comun', 'fotos', 'muro_no.json')
#: los puestos que son podio
PODIO = ('Campeón', 'Subcampeón', 'Tercero')
#: 🏟️ un récord de participación: desde el evento número `RECORD_DESDE` del servidor y con `RECORD_MIN` raperos o más
RECORD_DESDE, RECORD_MIN = 4, 8
#: 📈 «subí N puestos»: desde cuántos puestos, y cuántos por semana
SUBIO_MIN, SUBIO_TOPE = 10, 5
#: 🔥 las rachas que se publican
RACHAS = (5, 10, 15, 20, 30)
#: 🔝 cuántos días tiene que pasar para volver a publicar que alguien entró al mismo top 10 (entrar y salir es un vaivén)
TOP10_DIAS = 7
#: 👥 un miembro que entró a la crew en el mismo minuto que se creó es de su arranque (la siembra del 19/10, o el líder)
CREW_ARRANQUE_MS = 60 * 1000
#: 📊 un servidor con menos de 3 personas no tiene un «#1» que valga (CLAUDE.md: «ser 1 de 1 no dice nada»)
TOP_MIN = 3
#: 🏟️ cuántos campeones de la semana viajan en «svsemana»
SEMANA_CAMPS = 3


def _iso(t):
    return t.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def _de_iso(s):
    s = str(s or '').strip()
    if not s:
        return None
    try:
        t = dt.datetime.fromisoformat(s.replace('Z', '+00:00'))
    except ValueError:
        return None
    return t if t.tzinfo else t.replace(tzinfo=dt.timezone.utc)


def _norm(s):
    import unicodedata
    return ''.join(c for c in unicodedata.normalize('NFKD', str(s or '')).lower() if c.isalnum())


def _et():
    import zoneinfo
    return zoneinfo.ZoneInfo('America/New_York')


# ── 🙈 quién las apagó ──────────────────────────────────────────────────
def apagados(s=None):
    """`set(claves)` de quienes apagaron sus publicaciones. Con `s` (una sesión de Cloudflare) lee KV y guarda la
    copia; sin `s`, la copia. ⚠️ Sin KV y sin copia, nadie: es lo que había antes de que existiera el botón."""
    d = None
    if s is not None:
        try:
            import subir_datos as SD
            r = s.get('%s/values/%s' % (SD.API, CLAVE_KV), timeout=30)
            if r.status_code == 404:
                d = {}
            elif r.status_code == 200:
                d = r.json() or {}
            if d is not None:
                os.makedirs(os.path.dirname(COPIA), exist_ok=True)
                with io.open(COPIA, 'w', encoding='utf-8') as f:
                    # 🙈 y las publicaciones que ocultó el staff de su servidor (16/11/2026, `ocultos()`), en la misma copia
                    json.dump({'no': sorted(str(k) for k in d.get('no') or []),
                               'ocultos': sorted(str(k) for k in d.get('ocultos') or []),
                               # 📌 y la fijada arriba con Mods (20/11/2026, `fijo()`)
                               'fijo': d.get('fijo') if isinstance(d.get('fijo'), dict) else None}, f)
        except Exception:                                # noqa: BLE001
            d = None
    if d is None:
        try:
            with io.open(COPIA, encoding='utf-8') as f:
                d = json.load(f) or {}
        except (OSError, ValueError):
            d = {}
    return {str(k) for k in d.get('no') or []}


def ocultos():
    """🙈 `set(ids)` de las publicaciones que ocultó el staff de su servidor (Dlx, 16/11/2026: «me gustan todas las
    ideas», a «ocultar publicaciones de su servidor en el muro»; `socioStaff()` de bot/avisos.js, `que: 'muro'`). Viajan
    en `muro:no` con lo apagado por cada uno, así que salen de la copia que deja `apagados(s)`. Sin copia, ninguna."""
    try:
        with io.open(COPIA, encoding='utf-8') as f:
            return {str(k) for k in (json.load(f) or {}).get('ocultos') or []}
    except (OSError, ValueError):
        return set()


def fijo(ahora_ms=None):
    """📌 El `id` de la publicación fijada arriba con Mods (20/11/2026, `modsFijar()` de bot/avisos.js), o `''` si no hay
    o ya venció (`hasta`, en ms). Viaja en `muro:no`, así que sale de la copia que deja `apagados(s)`."""
    import time
    try:
        with io.open(COPIA, encoding='utf-8') as f:
            x = (json.load(f) or {}).get('fijo') or {}
    except (OSError, ValueError):
        return ''
    ahora = int(time.time() * 1000) if ahora_ms is None else ahora_ms
    i = str(x.get('id') or '') if isinstance(x, dict) else ''
    try:
        vence = int(x.get('hasta') or 0)
    except (TypeError, ValueError):
        vence = 0
    return i if i and vence > ahora else ''


def sin_apagados(items, no):
    """Saca las publicaciones cuya gente (`ks`) es TODA de quienes las apagaron."""
    if not no:
        return items
    out = []
    for x in items:
        ks = x.get('ks')
        ks = [k for k in (ks.values() if isinstance(ks, dict) else ks or []) if k]
        if ks and all(k in no for k in ks):
            continue
        out.append(x)
    return out


# ── lo que sale de las llaves ────────────────────────────────────────────
def _cuando(n, L, instantes):
    ms = (instantes or {}).get(int(n))
    if ms:
        return dt.datetime.fromtimestamp(ms / 1000, dt.timezone.utc)
    return _de_iso((L.get('dia') or '') + 'T23:00:00')


def _ordenadas(regs, instantes, desde):
    """`[(t, n, llave)]` de la temporada, de la más vieja a la más nueva."""
    out = []
    for n, L in (regs or {}).items():
        if not str(n).isdigit() or not isinstance(L, dict):
            continue
        t = _cuando(n, L, instantes)
        if t and (not desde or t >= desde):
            out.append((t, int(n), L))
    return sorted(out, key=lambda x: (x[0], x[1]))


def de_llaves(regs, instantes, desde):
    """`(publicaciones, primeros)`: el primer podio de cada uno y los récords de participación de cada servidor;
    `primeros` es `{número de llave: [nombres]}` de quienes ganaron ahí su primer título (lo marca `muro.campeones()`)."""
    out, primeros = [], {}
    titulo, podio = set(), set()
    por_sv = {}
    for t, n, L in _ordenadas(regs, instantes, desde):
        sv, ev = L.get('sv') or '', L.get('nombre') or ''
        for r in L.get('tabla') or []:
            if len(r) < 2 or r[1] not in PODIO:
                continue
            q = _norm(r[0])
            if not q:
                continue
            if r[1] == 'Campeón' and q not in titulo:
                titulo.add(q)
                primeros.setdefault(n, []).append(r[0])
            elif r[1] != 'Campeón' and q not in podio and q not in titulo:
                out.append({'tipo': 'podio', 't': _iso(t), 'quien': [r[0]], 'puesto': r[1], 'ev': ev, 'sv': sv, 'll': n})
            podio.add(q)
        part = L.get('participantes') or 0
        if sv:
            antes = por_sv.setdefault(sv, [])
            if len(antes) + 1 >= RECORD_DESDE and part >= RECORD_MIN and part > max(antes):
                out.append({'tipo': 'svrecord', 't': _iso(t), 'sv': sv, 'ev': ev, 'll': n, 'part': part, 'antes': max(antes)})
            antes.append(part)
    return out, primeros


# ── lo que sale de la semana (datos/multiplicadores.json) ───────────────
def _par(sem, sv):
    for p in ((sem.get('guerra') or {}).get('pares') or []):
        if sv in p and len(p) == 2:
            return p[1] if p[0] == sv else p[0]
    return ''


def de_semanas(mult, regs, instantes, svs, ahora):
    """🗓️ el lunes de cada servidor (`svlunes`) y el cierre de cada semana que ya terminó (`svsemana`)."""
    out = []
    liga = set(svs or [])
    llaves = _ordenadas(regs, instantes, None)
    for sem in (mult or {}).get('semanas') or []:
        ini, fin = _de_iso(sem.get('inicio')), _de_iso(sem.get('fin'))
        if not ini or not fin:
            continue
        sorteo = _de_iso(sem.get('sorteado')) or ini
        mults, metas, va = sem.get('sv') or {}, sem.get('metas') or {}, sem.get('meta_va') or {}
        dorado = sem.get('dorado') or {}
        for sv, x in mults.items():
            if liga and sv not in liga:
                continue
            y = {'tipo': 'svlunes', 't': _iso(sorteo), 'sv': sv, 'sem': sem.get('id') or '', 'x': x}
            if metas.get(sv):
                y['meta'] = metas[sv]
            if _par(sem, sv):
                y['contra'] = _par(sem, sv)
            if dorado.get('sv') == sv and dorado.get('nombre'):
                y['dorado'] = dorado['nombre']
            out.append(y)
        if fin > ahora:
            continue
        premios = sem.get('premios') or {}
        evs = {}
        for t, _n, L in llaves:
            if ini <= t < fin and L.get('sv'):
                evs.setdefault(L['sv'], []).append(L)
        for sv, ls in evs.items():
            if liga and sv not in liga:
                continue
            camps = []
            for L in reversed(ls):
                q = [r[0] for r in L.get('tabla') or [] if len(r) > 1 and r[1] == 'Campeón']
                if q and len(camps) < SEMANA_CAMPS:
                    camps.append([L.get('nombre') or '', q])
            y = {'tipo': 'svsemana', 't': _iso(fin), 'sv': sv, 'sem': sem.get('id') or '', 'eventos': len(ls),
                 'part': sum(L.get('participantes') or 0 for L in ls), 'camps': camps}
            if metas.get(sv):
                y['meta'] = [va.get(sv) or 0, metas[sv]]
            if _par(sem, sv):
                y['contra'] = _par(sem, sv)
                y['guerra'] = 'guerra' in (premios.get(sv) or [])
            out.append(y)
    return out


# ── lo que sale de las crews (datos/crews_vivas.json) ────────────────────
def de_crews(cv, tabla):
    """👥 quién entró a cada crew y quién creó la suya, con la fecha que guarda la crew. Sin perfil, nada."""
    nombres = {f['k']: f['n'] for f in tabla or [] if f.get('k') and f.get('n')}
    out = []
    for c in (cv or {}).get('crews') or []:
        creada = c.get('creada') or 0
        for g in c.get('gente') or []:
            if not isinstance(g, list) or len(g) < 3 or g[0] not in nombres or not isinstance(g[2], (int, float)):
                continue
            base = {'t': _iso(dt.datetime.fromtimestamp(g[2] / 1000, dt.timezone.utc)), 'quien': [nombres[g[0]]], 'ks': [g[0]],
                    'crew': c.get('id') or '', 'nombre': c.get('nombre') or '', 'sigla': c.get('sigla') or ''}
            if g[2] - creada > CREW_ARRANQUE_MS:
                out.append(dict(base, tipo='crewunion'))
            elif g[1] == 'lider' and not c.get('oficial'):
                out.append(dict(base, tipo='crewnueva'))
    return out


# ── lo que es un cambio entre corridas: se anota ─────────────────────────
def _semana_de(ahora):
    """El lunes (ET) de la semana de `ahora`, como texto: cambia una vez por semana."""
    d = ahora.astimezone(_et()).date()
    return (d - dt.timedelta(days=d.weekday())).isoformat()


def _sem_actual(mult, ahora):
    for sem in reversed((mult or {}).get('semanas') or []):
        ini, fin = _de_iso(sem.get('inicio')), _de_iso(sem.get('fin'))
        if ini and fin and ini <= ahora < fin:
            return sem
    return None


def _tops(tabla):
    """`{'temporada': [(k, n, puesto)], 'competitivo': [...]}`: los diez primeros de cada uno."""
    tem = sorted((f for f in tabla or [] if f.get('k') and f.get('pos')), key=lambda f: f['pos'])[:10]
    com = sorted((f for f in tabla or [] if f.get('k') and f.get('rg') and isinstance(f.get('sc'), (int, float))),
                 key=lambda f: -f['sc'])[:10]
    return {'temporada': [(f['k'], f['n'], f['pos']) for f in tem],
            'competitivo': [(f['k'], f['n'], i + 1) for i, f in enumerate(com)]}


def anotar(extra, p, mult, ahora):
    """`(publicaciones, extra nuevo)`: lo que cambió desde la corrida anterior. `extra` es lo que se guardó la vez pasada
    (`{}` la primera: sólo se anota). `p` es el payload del lobby (`tabla`, `svs`)."""
    extra = dict(extra or {})
    nuevo, pubs = {}, []
    t = _iso(ahora)
    tabla = p.get('tabla') or []
    svs = [s for s in p.get('svs') or [] if isinstance(s, dict) and s.get('sv')]

    # 📊 el #1 de cada servidor: el primero de los suyos en el Ranking Temporada
    por_sv = {}
    for f in sorted((f for f in tabla if f.get('k') and f.get('sv') and f.get('pos')), key=lambda f: f['pos']):
        por_sv.setdefault(f['sv'], []).append(f)
    top = {sv: fs[0]['k'] for sv, fs in por_sv.items() if len(fs) >= TOP_MIN}
    antes = extra.get('top')
    if isinstance(antes, dict):
        for sv, k in top.items():
            if antes.get(sv) and antes[sv] != k:
                f = por_sv[sv][0]
                pubs.append({'tipo': 'svtop', 't': t, 'sv': sv, 'quien': [f['n']], 'ks': [k], 'pts': f.get('pts') or 0})
    nuevo['top'] = dict(antes or {}, **top) if isinstance(antes, dict) else top

    # 🏷️ los socios y su tier
    tiers = {s['sv']: s.get('tier') or 0 for s in svs}
    antes = extra.get('tier')
    if isinstance(antes, dict) and antes:
        for sv, n in tiers.items():
            if sv not in antes:
                pubs.append({'tipo': 'svnuevo', 't': t, 'sv': sv, 'tier': n})
            elif n and antes[sv] and n != antes[sv]:
                pubs.append({'tipo': 'svtier', 't': t, 'sv': sv, 'de': antes[sv], 'a': n})
    nuevo['tier'] = dict(antes or {}, **tiers) if isinstance(antes, dict) else tiers

    # 🎯 la meta de la semana, cumplida
    sem = _sem_actual(mult, ahora)
    if sem:
        metas, va = sem.get('metas') or {}, sem.get('meta_va') or {}
        hechas = sorted(sv for sv, m in metas.items() if m and (va.get(sv) or 0) >= m)
        antes = extra.get('meta')
        if isinstance(antes, list) and len(antes) == 2 and antes[0] == sem.get('id'):
            for sv in hechas:
                if sv not in antes[1]:
                    pubs.append({'tipo': 'svmeta', 't': t, 'sv': sv, 'sem': sem.get('id') or '', 'meta': [va.get(sv) or 0, metas[sv]]})
        elif isinstance(antes, list) and len(antes) == 2:
            # una semana nueva: lo que ya se cumplió desde que arrancó también es noticia (la corrida anterior era de otra)
            for sv in hechas:
                pubs.append({'tipo': 'svmeta', 't': t, 'sv': sv, 'sem': sem.get('id') or '', 'meta': [va.get(sv) or 0, metas[sv]]})
        nuevo['meta'] = [sem.get('id'), hechas]
    elif 'meta' in extra:
        nuevo['meta'] = extra['meta']

    # 🔝 entrar al top 10, una vez por semana por ranking
    tops = _tops(tabla)
    antes = extra.get('top10')
    vistos = dict(extra.get('top10_t') or {})
    for rk, filas in tops.items():
        ya = set((antes or {}).get(rk) or []) if isinstance(antes, dict) else None
        for k, n, pos in filas:
            clave = rk + ':' + k
            hace = _de_iso(vistos.get(clave))
            if ya is not None and rk in (antes or {}) and k not in ya and not (hace and ahora - hace < dt.timedelta(days=TOP10_DIAS)):
                pubs.append({'tipo': 'top10', 't': t, 'quien': [n], 'ks': [k], 'rk': rk, 'pos': pos})
                vistos[clave] = t
    nuevo['top10'] = {rk: [k for k, _n, _p in filas] for rk, filas in tops.items()}
    nuevo['top10_t'] = {c: v for c, v in vistos.items() if (_de_iso(v) or ahora) > ahora - dt.timedelta(days=TOP10_DIAS)}

    # 🔥 las rachas
    antes = extra.get('racha')
    rachas = {}
    for f in tabla:
        r = f.get('rch')
        if f.get('k') and isinstance(r, list) and r and isinstance(r[0], int):
            rachas[f['k']] = r[0]
            a = (antes or {}).get(f['k']) if isinstance(antes, dict) else None
            if isinstance(a, int):
                cruzadas = [h for h in RACHAS if a < h <= r[0]]
                if cruzadas:
                    pubs.append({'tipo': 'racha', 't': t, 'quien': [f['n']], 'ks': [f['k']], 'racha': cruzadas[-1]})
    nuevo['racha'] = dict(antes or {}, **rachas) if isinstance(antes, dict) else rachas

    # 📈 los que más subieron la semana pasada: el puesto de cada uno se guarda el primer lunes que se lo ve
    semana = _semana_de(ahora)
    pos = {f['k']: f['pos'] for f in tabla if f.get('k') and f.get('pos')}
    antes = extra.get('sem')
    if isinstance(antes, dict) and antes.get('id') and antes.get('id') != semana:
        viejo = antes.get('pos') or {}
        gan = sorted(((viejo[k] - pos[k], k) for k in pos if k in viejo and viejo[k] - pos[k] >= SUBIO_MIN), reverse=True)
        nombres = {f['k']: f['n'] for f in tabla if f.get('k')}
        for d, k in gan[:SUBIO_TOPE]:
            pubs.append({'tipo': 'subio', 't': t, 'quien': [nombres[k]], 'ks': [k], 'de': viejo[k], 'a': pos[k], 'sem': antes['id']})
        nuevo['sem'] = {'id': semana, 'pos': pos}
    elif isinstance(antes, dict) and antes.get('id') == semana:
        nuevo['sem'] = antes
    else:
        nuevo['sem'] = {'id': semana, 'pos': pos}
    return pubs, nuevo


# ── self-check ───────────────────────────────────────────────────────────
def _self_check():
    print('\n══ LO QUE PUBLICAN SOLOS LOS SERVIDORES Y LA GENTE ══\n')
    mal = 0

    def ok(c, que):
        nonlocal mal
        print(('  ✅ ' if c else '  ❌ ') + que)
        if not c:
            mal += 1

    U = dt.timezone.utc
    a = dt.datetime(2026, 11, 1, tzinfo=U)
    L = lambda dia, sv, part, tabla, nombre='COPA': {'dia': dia, 'sv': sv, 'participantes': part, 'tabla': tabla, 'nombre': nombre}  # noqa: E731
    regs = {'1': L('2026-10-30', 'FFA', 50, [['Ana', 'Campeón']]),                       # antes del arranque: no cuenta
            '2': L('2026-11-02', 'FFA', 10, [['Ana', 'Subcampeón'], ['Bea', 'Campeón']]),
            '3': L('2026-11-03', 'FFA', 9, [['Ana', 'Campeón'], ['Bea', 'Subcampeón']]),
            '4': L('2026-11-04', 'FFA', 12, [['Cris', 'Tercero']]),
            '5': L('2026-11-05', 'FFA', 20, [['Ana', 'Campeón']], 'GRANDE'),
            '6': L('2026-11-06', 'FFA', 25, [['Ana', 'Campeón'], ['Dani', 'Campeón']]),
            'x': {'nombre': 'no es una llave'}}
    ps, prim = de_llaves(regs, {}, a)
    pod = [(x['quien'][0], x['ll']) for x in ps if x['tipo'] == 'podio']
    ok(pod == [('Ana', 2), ('Cris', 4)], 'el primer podio de cada uno, sin el que ya ganó un título  %s' % pod)
    ok(prim == {2: ['Bea'], 3: ['Ana'], 6: ['Dani']}, 'el primer título, por llave (lo de antes del arranque no cuenta)  %s' % prim)
    rec = [(x['ll'], x['antes']) for x in ps if x['tipo'] == 'svrecord']
    ok(rec == [(5, 12), (6, 20)], 'el récord desde el 4.º evento, contra el máximo de antes  %s' % rec)

    mult = {'semanas': [
        {'id': '2026-11-02', 'inicio': '2026-11-02T16:00:00Z', 'fin': '2026-11-09T16:00:00Z', 'sorteado': '2026-11-02T16:20:00Z',
         'sv': {'FFA': 2, 'SR': 1, 'XX': 3}, 'metas': {'FFA': 40}, 'meta_va': {'FFA': 56}, 'guerra': {'pares': [['FFA', 'SR']]},
         'premios': {'FFA': ['guerra']}, 'dorado': {'sv': 'SR', 'nombre': 'DORADA'}},
        {'id': '2026-11-09', 'inicio': '2026-11-09T16:00:00Z', 'fin': '2026-11-16T16:00:00Z',
         'sv': {'FFA': 1}, 'metas': {'FFA': 10}, 'meta_va': {'FFA': 3}}]}
    ahora = dt.datetime(2026, 11, 12, 20, tzinfo=U)
    ss = de_semanas(mult, regs, {}, ['FFA', 'SR'], ahora)
    lun = [(x['sv'], x['x'], x.get('contra'), x.get('dorado')) for x in ss if x['tipo'] == 'svlunes']
    ok(lun == [('FFA', 2, 'SR', None), ('SR', 1, 'FFA', 'DORADA'), ('FFA', 1, None, None)],
       'el lunes de cada socio (XX no es socio): ×N, guerra y dorado  %s' % lun)
    sem = [x for x in ss if x['tipo'] == 'svsemana']
    ok(len(sem) == 1 and sem[0]['eventos'] == 5 and sem[0]['part'] == 76 and sem[0]['meta'] == [56, 40] and sem[0]['guerra'] is True
       and sem[0]['camps'][0] == ['COPA', ['Ana', 'Dani']] and len(sem[0]['camps']) == SEMANA_CAMPS,
       'el cierre: sólo la semana terminada, con eventos, gente, meta, guerra y los últimos campeones')

    cv = {'crews': [{'id': 'X', 'nombre': 'Equis', 'sigla': 'EQ', 'creada': 1000, 'oficial': False,
                     'gente': [['ana', 'lider', 1000], ['bea', 'miembro', 1000 + 5 * 60 * 1000], ['nadie', 'miembro', 9e9]]},
                    {'id': 'O', 'nombre': 'Oficial', 'creada': 1000, 'oficial': True, 'gente': [['cris', 'lider', 1000]]}]}
    tabla = [{'k': 'ana', 'n': 'Ana'}, {'k': 'bea', 'n': 'Bea'}, {'k': 'cris', 'n': 'Cris'}]
    cr = sorted((x['tipo'], x['ks'][0]) for x in de_crews(cv, tabla))
    ok(cr == [('crewnueva', 'ana'), ('crewunion', 'bea')], 'crea la suya y entra a otra; la siembra y quien no tiene perfil, nada  %s' % cr)

    def fila(k, pos, sv='FFA', sc=None, rg='', rch=None):
        return {'k': k, 'n': k.upper(), 'pos': pos, 'sv': sv, 'sc': sc, 'rg': rg, 'rch': rch or [0, 0]}
    t1 = [fila('a', 1, rch=[2, 2]), fila('b', 2, sc=50.0, rg='A'), fila('c', 3)] + [fila('z%d' % i, 4 + i) for i in range(8)] + [fila('q', 30)]
    p1 = {'tabla': t1, 'svs': [{'sv': 'FFA', 'tier': 1}]}
    pubs, e1 = anotar({}, p1, mult, ahora)
    ok(not pubs and e1['top'] == {'FFA': 'a'} and e1['tier'] == {'FFA': 1}, 'la primera vez sólo se anota')
    t2 = [fila('q', 1, rch=[5, 5]), fila('a', 2, rch=[3, 3]), fila('b', 3, sc=50.0, rg='A')] + [fila('z%d' % i, 4 + i) for i in range(8)]
    mult2 = json.loads(json.dumps(mult))
    mult2['semanas'][1]['meta_va']['FFA'] = 11
    p2 = {'tabla': t2, 'svs': [{'sv': 'FFA', 'tier': 2}, {'sv': 'SR', 'tier': 3}]}
    pubs, e2 = anotar(e1, p2, mult2, ahora + dt.timedelta(hours=1))
    tipos = sorted((x['tipo'], x.get('sv') or x['ks'][0]) for x in pubs)
    ok(tipos == [('racha', 'q'), ('svmeta', 'FFA'), ('svnuevo', 'SR'), ('svtier', 'FFA'), ('svtop', 'FFA'), ('top10', 'q')],
       'el nuevo #1, el socio nuevo, el tier, la meta, el top 10 y la racha  %s' % tipos)
    ok(sorted((x['ks'][0], x['racha']) for x in pubs if x['tipo'] == 'racha') == [('q', 5)],
       'de 2 a 3 no publica (empieza en 5); de 0 a 5, el 5')
    pubs, e3 = anotar(e2, p2, mult2, ahora + dt.timedelta(hours=2))
    ok(not pubs, 'lo mismo dos veces no se repite')
    t3 = [fila('a', 1)] + [fila('z%d' % i, 2 + i) for i in range(8)] + [fila('b', 10, sc=50.0, rg='A'), fila('q', 11)]
    pubs, e4 = anotar(e3, {'tabla': t3, 'svs': p2['svs']}, mult2, ahora + dt.timedelta(hours=3))
    t4 = [fila('q', 1)] + [fila('z%d' % i, 2 + i) for i in range(8)] + [fila('b', 10, sc=50.0, rg='A'), fila('a', 11)]
    pubs, e5 = anotar(e4, {'tabla': t4, 'svs': p2['svs']}, mult2, ahora + dt.timedelta(hours=4))
    ok('q' not in [x['ks'][0] for x in pubs if x['tipo'] == 'top10'], 'salir y volver al top 10 en la misma semana no se publica dos veces')
    lunes = dt.datetime(2026, 11, 16, 17, tzinfo=U)
    t5 = [fila('a', 1), fila('q', 2)] + [fila('z%d' % i, 3 + i) for i in range(8)]
    e5['sem'] = {'id': '2026-11-09', 'pos': {'q': 30, 'a': 1, 'z0': 4}}
    pubs, e6 = anotar(e5, {'tabla': t5, 'svs': p2['svs']}, mult2, lunes)
    sub = [(x['ks'][0], x['de'], x['a']) for x in pubs if x['tipo'] == 'subio']
    ok(sub == [('q', 30, 2)] and e6['sem']['id'] == '2026-11-16', 'el lunes: quien subió 10 o más la semana pasada  %s' % sub)

    items = [{'tipo': 'rango', 'ks': ['ana']}, {'tipo': 'campeon', 'ks': ['ana', 'bea']}, {'tipo': 'anuncio'},
             {'tipo': 'premios', 'ks': {'figura': 'ana'}}]
    q = sin_apagados(items, {'ana'})
    ok([x['tipo'] for x in q] == ['campeon', 'anuncio'], 'quien las apagó no sale; la dupla y lo de nadie, sí  %s' % [x['tipo'] for x in q])
    ok(sin_apagados(items, set()) == items, 'sin nadie que las apagó, todo igual')
    print('\n' + ('✅ todo bien' if not mal else '❌ %d mal' % mal))
    return mal


if __name__ == '__main__':
    if '--auto' in sys.argv:
        sys.exit(1 if _self_check() else 0)
    print(__doc__)
