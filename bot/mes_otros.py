# -*- coding: utf-8 -*-
"""🏆 LAS DEMÁS NOMINACIONES DE LOS MES AWARDS: dieciséis categorías más, detrás de «Ver las demás nominaciones».

    python bot/mes_otros.py           cómo va el mes en las doce, sin escribir nada
    python bot/mes_otros.py --auto    el self-check, sin red ni archivos

Dlx, 16/10/2026: *«también deberíamos agregar más nominaciones a lo del mes… pero tampoco rellenar todo de eso, sino
como el botón que dirá ver las demás nominaciones. Incluyendo organizador del mes, etc.»*. A las preguntas eligió las
doce (`OTRAS`) y, para el ganador de una de éstas, *«Insignia + 1.000 PdT»*; los de grupos —crew, país y liga—, como el
Servidor del mes: *«Salón y publicación»*.

Lo usa `bot/mes_awards.py`: los nominados, la votación, el cierre y los premios son los mismos que los de las cuatro
principales. Acá sólo salen LOS NÚMEROS de cada una (`numeros()`), cada nominado con lo que la página muestra:
`{op, n, d, q?, quien, sv?, cc?, vid?, img?}` —`d` es la línea de abajo; `q`, la persona cuya cara va; `quien`, a quién
le toca el premio—.

DE DÓNDE SALE CADA UNA (todo en hora del este, del mes que se mide)
  · ORGANIZADOR: los eventos jugados que organizó (el anuncio, cruzado con su llave: `llaves_web.cruzar()`) y la gente
    que juntaron, de `MIN_GENTE` o más, como el organizador de la semana (`multiplicadores.ranking_org()`).
  · STAFF: los eventos jugados en que fue jurado, host o DJ (el anuncio: `anuncios.staff_de()`).
  · DUELISTA: los duelos 1v1 que ganó (`llaves_web.duelos()`, la regla de la hoja `1v1`).
  · CAZADOR: las cabezas que cazó: el Most Wanted y el precio por cabeza.
  · BATACAZO: el duelo ganado contra quien estaba más arriba en el ranking de Temporada (el puesto de hoy de los dos),
    medido en veces: ganarle al #3 desde el #30 es más que al #10 desde el #40. Uno por persona: su mejor batacazo.
  · IMPARABLE: los duelos ganados seguidos, sin perder en el medio.
  · EVENTO: el que más gente juntó. El premio es de quien lo organizó.
  · PROMO: entre TODAS las del mes —las compartidas en los canales de promoción y lo que sube cada uno (sus plazas,
    su YouTube), no sólo las que están en la página esa semana: Dlx, *«hay promociones que puedes usar»*—, la que más
    gente abrió en la página (`/avisos/promos-vistas`); a igual, la más nueva. El premio es de quien la comparte. Las
    batallas de los socios no: ésas son la Batalla del mes.
  · PUBLICACIÓN: la más felicitada del muro (`/avisos/aplausos`). El premio es de quien es la publicación.
    ⚠️ Las dos últimas se cuentan DE A POCO (`vistas()`, en cada corrida): el objeto borra lo de hace más de 30 días, y
    el día 1 ya se habría ido lo de los primeros días del mes.
  · HINCHA: quien más participó en la página —votar, felicitar, mirar en vivo, abrir promos—, con la misma XP del nivel
    y sus topes (`/avisos/hinchas`, con la clave del ciclo: trae Discord IDs). Cualquiera con Discord, compita o no;
    Dlx no (`verificados.DUENO`: prueba todo).
  · CLÁSICO: los dos que más veces se cruzaron en duelos (dos o más). El premio, para los dos.
  · SOBREVIVIENTE: las veces que sobrevivió al Most Wanted sin que lo cazaran.
  · CONSTANTE: los podios del mes —campeón, subcampeón y tercero, los de `rankings.POS`—, y a igual los títulos.
  · CREW, PAÍS: los puntos de Temporada del mes de su gente (los mismos que el Rapero del mes).
  · LIGA: las batallas que jugó en el mes y la gente que movió (`datos/ligas.json`).
⚠️ Quien juega fuera de concurso no se nomina en lo que mide jugar (duelista, cazador, batacazo, imparable, clásico,
sobreviviente, constante): como en las cuatro.
"""
import datetime as dt
import io
import json
import os
import re
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

WORKER = 'https://liga-global-bot.liga-global-ul.workers.dev'
MURO = 'https://underlegends.pages.dev/api/muro'
#: (clave, nombre, de qué, 'persona' o 'grupo'), en el orden de la página
OTRAS = (
    ('organizador', 'Organizador del mes', 'los eventos que organizó y la gente que juntaron', 'persona'),
    ('staff', 'Staff del mes', 'los eventos en que fue jurado, host o DJ', 'persona'),
    ('duelista', 'Duelista del mes', 'los duelos 1v1 que ganó', 'persona'),
    ('cazador', 'Cazador del mes', 'las cabezas que cazó (Most Wanted y precio por cabeza)', 'persona'),
    ('batacazo', 'Batacazo del mes', 'la victoria contra alguien más arriba en el ranking', 'persona'),
    ('imparable', 'Imparable del mes', 'los duelos ganados seguidos', 'persona'),
    ('evento', 'Evento del mes', 'la gente que juntó (el premio es de quien lo organizó)', 'persona'),
    ('promo', 'Promo del mes', 'cuánta gente la abrió en la página', 'persona'),
    ('publicacion', 'Publicación del mes', 'las felicitaciones que recibió', 'persona'),
    # 🏆 «Y más» (Dlx, 16/10/2026, a las cuatro que le propuse: las cuatro)
    ('hincha', 'Hincha del mes', 'lo que participó en la página: votar, felicitar, mirar en vivo, abrir promos', 'persona'),
    ('clasico', 'Clásico del mes', 'las veces que se cruzaron en duelos (el premio, para los dos)', 'persona'),
    ('sobreviviente', 'Sobreviviente del mes', 'las veces que sobrevivió al Most Wanted', 'persona'),
    ('constante', 'Constante del mes', 'los podios del mes', 'persona'),
    ('crew', 'Crew del mes', 'los puntos de Temporada de su gente', 'grupo'),
    ('pais', 'País del mes', 'los puntos de Temporada de su gente', 'grupo'),
    ('liga', 'Liga del mes', 'las batallas que jugó y la gente que movió', 'grupo'),
)
GRUPOS = frozenset(c for c, _n, _d, t in OTRAS if t == 'grupo')
#: los Puntos de Tienda del ganador de una de éstas (Dlx: «Insignia + 1.000 PdT»), a cada persona del premio
PREMIO_OTRA = 1000
#: un evento cuenta para el organizador desde esta gente (la del organizador de la semana)
MIN_GENTE = 8


def _de_iso(s):
    try:
        t = dt.datetime.fromisoformat(str(s).replace('Z', '+00:00'))
    except ValueError:
        return None
    return t if t.tzinfo else t.replace(tzinfo=dt.timezone.utc)


def _iso(t):
    return t.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def _plural(n, uno, varios):
    return '%d %s' % (n, uno if n == 1 else varios)


def _mil(n):
    return '{:,}'.format(int(n)).replace(',', '.')


# ── los números de un mes ───────────────────────────────────────────────────────────────────────────────────────────
def numeros(ini, fin, D, raperos=()):
    """`{cat: [nominado, …]}` de mejor a peor, sin cortar. `D` es lo de `datos()`; `raperos`, los puntos del mes de cada
    uno (`[{op, pts}]`, los del Rapero del mes), para la crew y el país."""
    D = D or {}
    k = D.get('clave') or (lambda n: str(n or '').lower())
    raw = D.get('raw') or (lambda n: n)
    fuera = set(D.get('fuera') or ())
    en = lambda t: bool(t) and ini <= t < fin  # noqa: E731
    out = {}

    # 🎤 ORGANIZADOR y 🎪 EVENTO, 🎧 STAFF: los eventos jugados del mes, con su anuncio
    org, staff, evs = {}, {}, []
    for n, sv, t, tabla, nombre in D.get('eventos') or []:
        if not en(t):
            continue
        gente = len({k(f[0]) for f in tabla or [] if f and f[0]})
        a = (D.get('anuncio_de') or {}).get(n) or {}
        orgs = []
        for o in a.get('orgs') or []:
            r = raw(o.get('n'), o.get('id'))
            if r and r not in orgs:
                orgs.append(r)
        if not orgs and a.get('organizador'):
            r = raw(a['organizador'], '')
            if r:
                orgs.append(r)
        if gente >= MIN_GENTE:
            evs.append({'op': str(n), 'n': nombre or ('#%d' % n), 'sv': sv,
                        'd': '%s · %s%s' % (_plural(gente, 'rapero', 'raperos'), sv,
                                            (' · organiza ' + ' y '.join(orgs[:3])) if orgs else ''),
                        'quien': orgs[:3], '_g': gente, '_t': _iso(t)})
            for r in orgs:
                x = org.setdefault(k(r), {'op': r, 'n': r, 'q': r, 'quien': [r], '_ev': 0, '_g': 0})
                x['_ev'] += 1
                x['_g'] += gente
        en_staff = []
        for _rol, ns in (a.get('staff') or {}).items():
            for s in ns or []:
                r = raw(s, '')
                if r and r not in en_staff:
                    en_staff.append(r)
        for r in en_staff:
            x = staff.setdefault(k(r), {'op': r, 'n': r, 'q': r, 'quien': [r], '_ev': 0})
            x['_ev'] += 1
    for x in org.values():
        x['d'] = '%s · %s' % (_plural(x['_ev'], 'evento', 'eventos'), _plural(x['_g'], 'rapero', 'raperos'))
    out['organizador'] = sorted(org.values(), key=lambda x: (-x['_g'], -x['_ev'], x['n'].lower()))
    for x in staff.values():
        x['d'] = _plural(x['_ev'], 'evento', 'eventos') + ' de jurado, host o DJ'
    out['staff'] = sorted(staff.values(), key=lambda x: (-x['_ev'], x['n'].lower()))
    out['evento'] = sorted(evs, key=lambda x: (-x['_g'], x['_t']))

    # ⚔️ DUELISTA, 💥 BATACAZO, 🔥 IMPARABLE: los duelos del mes, del más viejo al más nuevo
    pos = D.get('pos') or {}
    gan, jug, racha, mejor, bata = {}, {}, {}, {}, {}
    for t, n, a, b, g, ev in D.get('duelos') or []:
        if not en(t) or not g:
            continue
        ka, kb, kg = k(a), k(b), k(g)
        for q, kq in ((a, ka), (b, kb)):
            if kq in fuera:
                continue
            jug[kq] = jug.get(kq, 0) + 1
            if kq == kg:
                gan[kq] = gan.get(kq, 0) + 1
                racha[kq] = racha.get(kq, 0) + 1
                if racha[kq] > mejor.get(kq, (0, ''))[0]:
                    mejor[kq] = (racha[kq], q)
            else:
                racha[kq] = 0
        perd, kp = (b, kb) if kg == ka else (a, ka)
        if kg in fuera or kp in fuera or kg not in pos or kp not in pos:
            continue
        # 💥 cuánto más arriba estaba el otro: por cuántas veces, no por cuántos puestos (ganarle al #3 desde el #30 es
        # más que ganarle al #10 desde el #40)
        dif = pos[kg] / pos[kp] if pos[kp] else 0
        if dif > 1 and dif > bata.get(kg, {}).get('_dif', 0):
            bata[kg] = {'op': ('%s:%s' % (n, g))[:80], 'n': g, 'q': g, 'quien': [g], '_dif': dif, '_pl': pos[kp],
                        'd': 'le ganó a %s (#%d) siendo #%d · %s' % (perd, pos[kp], pos[kg], ev or '#%s' % n)}
    nom = D.get('nombre') or (lambda kq: kq)
    # 🤝 CLÁSICO: los dos que más se cruzaron en duelos ese mes
    par = {}
    for t, n, a, b, g, ev in D.get('duelos') or []:
        ka, kb = k(a), k(b)
        if not en(t) or not g or ka in fuera or kb in fuera or ka == kb:
            continue
        x = par.setdefault(tuple(sorted((ka, kb))), {'_n': 0, '_g': {}})
        x['_n'] += 1
        x['_g'][k(g)] = x['_g'].get(k(g), 0) + 1
    cl = []
    for (ka, kb), x in par.items():
        if x['_n'] >= 2:
            na, nb = nom(ka), nom(kb)
            cl.append({'op': ('%s vs %s' % (na, nb))[:80], 'n': '%s vs %s' % (na, nb), 'q': na, 'quien': [na, nb],
                       '_n': x['_n'], 'd': '%d duelos · %s %d, %s %d' % (x['_n'], na, x['_g'].get(ka, 0), nb,
                                                                       x['_g'].get(kb, 0))})
    out['clasico'] = sorted(cl, key=lambda x: (-x['_n'], x['n'].lower()))
    out['duelista'] = sorted(({'op': nom(kq), 'n': nom(kq), 'q': nom(kq), 'quien': [nom(kq)], '_g': g, '_j': jug[kq],
                               'd': '%d de %s ganados' % (g, _plural(jug[kq], 'duelo', 'duelos'))}
                              for kq, g in gan.items()), key=lambda x: (-x['_g'], -x['_g'] / x['_j'], x['n'].lower()))
    out['batacazo'] = sorted(bata.values(), key=lambda x: (-x['_dif'], x['_pl'], x['n'].lower()))
    out['imparable'] = sorted(({'op': q, 'n': q, 'q': q, 'quien': [q], '_r': r,
                                'd': '%d duelos ganados seguidos' % r} for _kq, (r, q) in mejor.items() if r >= 2),
                              key=lambda x: (-x['_r'], x['n'].lower()))

    # 🎯 CAZADOR
    caz = {}
    for t, ns in D.get('cazas') or []:
        if not en(t):
            continue
        for q in ns:
            if k(q) in fuera:
                continue
            x = caz.setdefault(k(q), {'op': q, 'n': q, 'q': q, 'quien': [q], '_c': 0})
            x['_c'] += 1
    for x in caz.values():
        x['d'] = _plural(x['_c'], 'cabeza cazada', 'cabezas cazadas')
    out['cazador'] = sorted(caz.values(), key=lambda x: (-x['_c'], x['n'].lower()))

    # 🪖 SOBREVIVIENTE: las veces que el Most Wanted no lo cazó
    sob = {}
    for t, q in D.get('sobrevivio') or []:
        if not en(t) or k(q) in fuera:
            continue
        x = sob.setdefault(k(q), {'op': q, 'n': q, 'q': q, 'quien': [q], '_s': 0})
        x['_s'] += 1
    for x in sob.values():
        x['d'] = 'sobrevivió ' + _plural(x['_s'], 'vez', 'veces')
    out['sobreviviente'] = sorted(sob.values(), key=lambda x: (-x['_s'], x['n'].lower()))

    # 📈 CONSTANTE: los podios del mes
    podio = {'campeón': 0, 'subcampeón': 1, 'tercero': 2}
    con = {}
    for n, sv, t, tabla, nombre in D.get('eventos') or []:
        if not en(t):
            continue
        for f in tabla or []:
            if not f or len(f) < 2 or k(f[0]) in fuera:
                continue
            i = podio.get(str(f[1]).strip().lower())
            if i is None:
                continue
            x = con.setdefault(k(f[0]), {'op': f[0], 'n': f[0], 'q': f[0], 'quien': [f[0]], '_m': [0, 0, 0]})
            x['_m'][i] += 1
    for x in con.values():
        x['d'] = '%s · %s' % (_plural(sum(x['_m']), 'podio', 'podios'),
                              ' '.join('%s%d' % (e, c) for e, c in zip(('🥇', '🥈', '🥉'), x['_m']) if c))
    out['constante'] = sorted(con.values(), key=lambda x: (-sum(x['_m']), -x['_m'][0], -x['_m'][1], x['n'].lower()))

    # 🙌 HINCHA: quien más participó en la página (la XP del nivel, del objeto)
    mes = (ini + dt.timedelta(hours=12)).strftime('%Y-%m')
    hi = []
    for did, xp in (D.get('hinchas') or {}).get(mes) or []:
        q = (D.get('nombre_did') or {}).get(str(did))
        if q and str(did) != str(D.get('dueno') or ''):
            hi.append({'op': q[:80], 'n': q, 'q': q, 'quien': [q], 'did': str(did), '_x': xp,
                       'd': '%s de participación en la página' % _plural(int(xp), 'punto', 'puntos')})
    out['hincha'] = sorted(hi, key=lambda x: (-x['_x'], x['n'].lower()))

    # 📣 PROMO y 👏 PUBLICACIÓN: lo contado de a poco (`vistas()`), de lo publicado ese mes
    vs = D.get('vistas') or {}
    pr = []
    for pid, v in (vs.get('promo') or {}).items():
        tp = _de_iso(v[5] if len(v) > 5 else '')
        if en(tp):
            qs = [q for q in v[1] if q]
            dia = tp.astimezone(dt.timezone(dt.timedelta(hours=-4))).strftime('%d/%m')
            x = {'op': pid[:80], 'n': (v[2] or 'su promo')[:80], 'q': qs[0] if qs else '', 'quien': qs[:2], '_v': v[0],
                 '_t': v[5], 'd': '%s · %s' % (' y '.join(qs[:2]) or 'alguien', (
                     _plural(v[0], 'persona la abrió', 'la abrieron') if v[0] else 'la compartió el ' + dia))}
            if len(v) > 3 and v[3]:
                x['vid'] = v[3]
            elif len(v) > 4 and v[4]:
                x['img'] = v[4]
            pr.append(x)
    pr.sort(key=lambda x: x['_t'], reverse=True)
    out['promo'] = sorted(pr, key=lambda x: -x['_v'])
    pu = []
    for iid, v in (vs.get('pub') or {}).items():
        if v[0] and en(_de_iso(v[3] if len(v) > 3 else '')):
            qs = [q for q in v[1] if q]
            pu.append({'op': iid[:80], 'n': (v[2] or 'Una publicación')[:90], 'q': qs[0] if qs else '', 'quien': qs[:4],
                       '_a': v[0], 'd': _plural(v[0], 'felicitación', 'felicitaciones')})
    out['publicacion'] = sorted(pu, key=lambda x: (-x['_a'], x['op']))

    # 👥 CREW y 🌎 PAÍS: los puntos del mes de su gente
    crew_de, pais_de = D.get('crew') or {}, D.get('pais') or {}
    cr, pa = {}, {}
    for f in raperos or []:
        kq = k(f.get('op'))
        c = crew_de.get(kq)
        if c:
            x = cr.setdefault(c, {'op': c, 'n': c, 'quien': [], '_p': 0, '_g': 0})
            x['_p'] += int(f.get('pts') or 0)
            x['_g'] += 1
        p = pais_de.get(kq)
        if p and p[0]:
            x = pa.setdefault(p[0], {'op': p[0], 'n': p[0], 'cc': p[1] or '', 'quien': [], '_p': 0, '_g': 0})
            x['_p'] += int(f.get('pts') or 0)
            x['_g'] += 1
    for x in list(cr.values()) + list(pa.values()):
        x['d'] = '%s pts · %s' % (_mil(x['_p']), _plural(x['_g'], 'jugó', 'jugaron'))
    out['crew'] = sorted(cr.values(), key=lambda x: (-x['_p'], x['n'].lower()))
    out['pais'] = sorted(pa.values(), key=lambda x: (-x['_p'], x['n'].lower()))

    # 🏟️ LIGA: las batallas jugadas del mes y la gente
    lg = []
    for lid, x in (D.get('ligas') or {}).items():
        bats = [b for b in x.get('batallas') or [] if len(b) > 5 and b[5] and en(_de_iso(b[1]))]
        if bats:
            gente = {k(n) for b in bats for n in b[3:5] if n}
            lg.append({'op': str(lid)[:80], 'n': x.get('n') or lid, 'sv': x.get('sv') or '', '_b': len(bats),
                       '_g': len(gente), 'd': '%s · %s' % (_plural(len(bats), 'batalla', 'batallas'),
                                                           _plural(len(gente), 'rapero', 'raperos'))})
    out['liga'] = sorted(lg, key=lambda x: (-x['_b'], -x['_g'], x['n'].lower()))
    # lo que empieza con «_» es para ordenar: no viaja
    return {c: [{a: b for a, b in x.items() if not a.startswith('_')} for x in xs] for c, xs in out.items()}


# ── lo contado de a poco: las promos abiertas y las publicaciones felicitadas ──────────────────────────────────────
def vistas(viejas, ahora, mes_de, traer=None, promos=None):
    """`{mes: {'promo': {pid: [abiertas, quien, título, vid, img, t]}, 'pub': {id: [aplausos, quien, qué, t]}}}`, con lo
    de esta corrida sumado a lo de antes (se queda el máximo: el objeto borra lo de hace más de 30 días). Sólo lo
    publicado este mes y el anterior. `traer()` devuelve `(muro, promos abiertas, aplausos)` o `None` sin red; `promos`
    es `datos/promos.json` (`bot/promos.py`): TODAS las del mes entran, aunque nadie las haya abierto todavía."""
    out = {m: {'promo': dict((v or {}).get('promo') or {}), 'pub': dict((v or {}).get('pub') or {})}
           for m, v in (viejas or {}).items()}
    este = mes_de(ahora)
    deje = {este, mes_de(ahora - dt.timedelta(days=32))}
    t = traer() if traer else _traer()
    muro, abiertas, aplausos = t if t else ([], {}, {})
    # 📣 las promos del mes, todas (Dlx: «hay promociones que puedes usar»): las de los canales y lo que sube cada uno;
    # no las batallas de los socios, que son la Batalla del mes
    for x in _promos(promos):
        ti = _de_iso(x.get('t'))
        if not ti or mes_de(ti) not in deje:
            continue
        m, pid = mes_de(ti), str(x['id'])
        ya = out.setdefault(m, {'promo': {}, 'pub': {}})['promo'].get(pid)
        n = int(abiertas.get(pid) or 0)
        q = x.get('quien')
        out[m]['promo'][pid] = [max(n, ya[0] if ya else 0), ([q] if isinstance(q, str) else list(q or []))[:4],
                                str(x.get('tit') or '')[:80], x.get('vid') or '', x.get('img') or '', x.get('t')]
    for it in muro or []:
        ti = _de_iso(it.get('t'))
        if not ti:
            continue
        m = mes_de(ti)
        if m not in deje:
            continue
        quien = [q for q in it.get('quien') or [] if q][:4]
        n = int(aplausos.get(str(it.get('id'))) or 0)
        ya = out.setdefault(m, {'promo': {}, 'pub': {}})['pub'].get(str(it.get('id')))
        if n or ya:
            out[m]['pub'][str(it['id'])] = [max(n, ya[0] if ya else 0), quien, que_es(it), it.get('t')]
    return {m: v for m, v in out.items() if m in deje or m >= min(deje)}


def _promos(promos=None):
    """Las promos guardadas (`datos/promos.json`): las de los canales y las de la Liga que son de cada uno (su YouTube,
    lo que sumó a su perfil), sin las batallas de los socios."""
    if promos is None:
        try:
            import promos as PR
            promos = PR.leer()
        except Exception:                                # noqa: BLE001
            promos = {}
    return list((promos or {}).get('items') or []) + [x for x in (promos or {}).get('liga') or [] if x.get('por') != 'socio']


def que_es(it):
    """Una publicación en pocas palabras, para la lista de nominados."""
    q = ' y '.join([x for x in it.get('quien') or [] if x][:2]) or 'Alguien'
    t = it.get('tipo')
    return ({'campeon': '%s, campeón de %s' % (q, it.get('ev') or 'un evento'),
             'rango': '%s subió a %s' % (q, it.get('rg') or 'otro rango'),
             'caza': '%s cazó a %s' % (q, it.get('a') or 'un buscado'),
             'sobrevivio': '%s sobrevivió al Most Wanted' % q,
             'elegido': '%s, El Elegido' % q,
             'precio': '%s cobró por la cabeza de %s' % (q, it.get('a') or 'alguien'),
             'pase': '%s llegó al nivel %s del Pase' % (q, it.get('nivel') or ''),
             'tarjeta': '%s desbloqueó su tarjeta' % q,
             'ligahito': '%s en %s' % (q, it.get('ln') or 'su liga'),
             'mesaward': '%s, MES AWARDS' % q,
             'promo': '%s comparte %s' % (q, it.get('tit') or 'algo')}.get(t) or '%s · %s' % (q, t or 'publicación'))[:90]


def _traer():
    """`(muro, {pid: abiertas}, {id: aplausos})` de la página y del objeto, o `None` si alguno no contesta."""
    import requests
    try:
        h = {'accept': 'application/json', 'user-agent': 'liga-global-ciclo'}
        m = requests.get(MURO, headers=h, timeout=25)
        a = requests.get(WORKER + '/avisos/promos-vistas', headers=h, timeout=20)
        p = requests.get(WORKER + '/avisos/aplausos', headers=h, timeout=20)
        if m.status_code != 200 or a.status_code != 200 or p.status_code != 200:
            return None
        return (m.json() or {}).get('items') or [], (a.json() or {}).get('n') or {}, (p.json() or {}).get('n') or {}
    except Exception:                                    # noqa: BLE001
        return None


# ── los datos ───────────────────────────────────────────────────────────────────────────────────────────────────────
def datos(vistas_guardadas=None):
    """Lo que pide `numeros()`, de `datos/`."""
    import llaves_web as LW
    import multiplicadores as MU
    import most_wanted as MW

    def j(*p):
        try:
            with io.open(os.path.join(BASE, *p), encoding='utf-8') as f:
                return json.load(f)
        except (OSError, ValueError):
            return None
    regs = LW.leer()
    evs = MU.eventos_de(regs)
    nombre_ev = {e[0]: e[4] for e in evs}
    inst = LW.instantes(regs)
    duelos = []
    for n, a, b, g in LW.duelos(regs):
        ms = inst.get(int(n))
        t = dt.datetime.fromtimestamp(ms / 1000, dt.timezone.utc) if ms else None
        duelos.append((t, n, a, b, g, nombre_ev.get(int(n)) or ''))
    pool = j('datos', 'temporada_pool.json') or []
    padron = j('datos', 'padron.json') or []
    k = MU._clave_persona
    canon, did_raw, pais = {}, {}, {}
    for p in padron:
        r = p.get('raw')
        if not r:
            continue
        canon.setdefault(k(r), r)
        for did in [p.get('discord_id')] + list(p.get('otras_cuentas') or []):
            if did:
                did_raw[str(did)] = r
        bands = re.findall('[\U0001F1E6-\U0001F1FF]', str(p.get('full') or ''))
        cc = ''.join(chr(ord(c) - 0x1F1E6 + ord('a')) for c in bands[:2]) if len(bands) >= 2 else ''
        if p.get('pais'):
            pais[k(r)] = (p['pais'], cc)
    for p in pool:
        if p.get('raw'):
            canon[k(p['raw'])] = p['raw']

    def raw(nombre, did=''):
        """El nombre de la Lista de alguien del anuncio: por su cuenta si la dice, si no por su nombre."""
        if did and str(did) in did_raw:
            return did_raw[str(did)]
        # sin la numeración de la plantilla: «1 | Adriagner», «2- Velatz»
        x = re.sub(r'^\s*\d{1,2}\s*[|\-–.)]\s*', '', MU._org(nombre)).strip()
        return canon.get(k(x)) or (x if len(x) >= 2 else '')
    fuera = {k(p.get('raw')) for p in pool if p.get('fc') and p.get('raw')}
    pos = {k(p['raw']): int(p['pos']) for p in pool if p.get('raw') and str(p.get('pos') or '').isdigit() and not p.get('fc')}
    # 🎯 las cazas: Most Wanted y precio por cabeza
    cazas = []
    for per in MW.periodos(MW.leer()):
        for b in per.get('buscados') or []:
            c = b.get('caza')
            if c:
                cazas.append((_de_iso(c.get('t') or per.get('fin') or ''), [y['n'] for y in c.get('por') or [] if y.get('n')]))
    for x in (j('datos', 'precios.json') or {}).get('precios') or []:
        if x.get('e') == 'cazado' and x.get('ev'):
            cazas.append((_de_iso((x['ev'] or {}).get('t') or x.get('t')), [y[0] for y in x.get('por') or [] if y]))
    # 🪖 los que sobrevivieron al Most Wanted
    sobrevivio = []
    for per in MW.periodos(MW.leer()):
        for b in per.get('buscados') or []:
            if b.get('estado') == 'sobrevivio' and per.get('fin') and b.get('n'):
                sobrevivio.append((_de_iso(per['fin']), b['n']))
    # 🙌 los hinchas: del objeto, con la clave del ciclo; el nombre, el de la Lista o el de su Discord
    hinchas, nombre_did, dueno = _hinchas(), {}, ''
    try:
        import verificados as VE
        dueno = VE.DUENO
    except Exception:                                    # noqa: BLE001
        dueno = ''
    ids = {str(x[0]) for v in (hinchas or {}).values() for x in v[:10]}
    for did in ids:
        if did in did_raw:
            nombre_did[did] = did_raw[did]
    nombre_did.update(_nombres_discord(ids - set(nombre_did)))
    # 📋 el anuncio de cada llave: el mismo cruce de «Lo que pasó»
    anuncio_de = {}
    try:
        import cuando as CU
        ann = (j('datos', 'anuncios.json') or {}).get('anuncios') or []
        pas = [{'nombre': x.get('nombre'), 'sv': x.get('servidor') or '', 'cuando': CU.momento(x) or x.get('cuando'), '_a': x}
               for x in ann if x.get('nombre')]
        LW.cruzar(pas, regs)
        anuncio_de = {int(p['llave']): p['_a'] for p in pas if str(p.get('llave') or '').isdigit()}
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ MES AWARDS sin los anuncios (%s)' % str(e)[:60])
    try:
        from comun.crews import DE_CADA_UNO, norm as crew_norm
        crew = {k(n): c for n, c in ((m, c) for c, ms in __import__('comun.crews', fromlist=['CREWS']).CREWS.items()
                                      for m in ms)}
        del DE_CADA_UNO, crew_norm
    except Exception:                                    # noqa: BLE001
        crew = {}
    return {'eventos': evs, 'duelos': duelos, 'pos': pos, 'fuera': fuera, 'cazas': cazas, 'anuncio_de': anuncio_de,
            'sobrevivio': sobrevivio, 'hinchas': hinchas or {}, 'nombre_did': nombre_did, 'dueno': dueno,
            'clave': k, 'raw': raw, 'nombre': lambda kq: canon.get(kq, kq), 'pais': pais, 'crew': crew,
            'ligas': (j('datos', 'ligas.json') or {}).get('ligas') or {}, 'vistas': plano(vistas_guardadas)}


def _hinchas():
    """`{mes: [[discord_id, xp], …]}` del objeto (`/avisos/hinchas`, con la clave del ciclo), o `{}`."""
    import requests
    try:
        import clave_ciclo as CC
        import fotos as F
        tok = F.env('DISCORD_TOKEN', obligatorio=False)
        if not tok:
            return {}
        r = requests.get(WORKER + '/avisos/hinchas', headers={'x-lg-ciclo': CC.clave(tok)}, timeout=25)
        return (r.json() or {}).get('meses') or {} if r.ok else {}
    except Exception:                                    # noqa: BLE001
        return {}


def _nombres_discord(ids):
    """`{discord_id: nombre}` de quien no está en la Lista: el que muestra Discord (el bot lo puede leer)."""
    out = {}
    if not ids:
        return out
    try:
        import requests
        import fotos as F
        tok = F.env('DISCORD_TOKEN', obligatorio=False)
        if not tok:
            return out
        for did in sorted(ids)[:20]:
            r = requests.get('https://discord.com/api/v10/users/%s' % did, headers={'Authorization': 'Bot ' + tok}, timeout=15)
            if r.ok:
                u = r.json() or {}
                n = (u.get('global_name') or u.get('username') or '').strip()
                if n:
                    out[did] = n[:40]
    except Exception:                                    # noqa: BLE001
        pass
    return out


def plano(vs):
    """`{'promo': {…}, 'pub': {…}}` de lo contado de todos los meses (`vistas()` lo guarda por mes; `numeros()` ya
    filtra por la fecha de cada publicación)."""
    out = {'promo': {}, 'pub': {}}
    for v in (vs or {}).values():
        for c in out:
            out[c].update((v or {}).get(c) or {})
    return out


# ── self-check ───────────────────────────────────────────────────────────────────────────────────────────────────────
def _self_check():
    print('\n══ LAS DEMÁS NOMINACIONES ══\n')
    mal = 0

    def ok(c, q, extra=''):
        nonlocal mal
        mal += not c
        print('   %s %s%s' % ('✅' if c else '🔴', q, ('  ' + extra) if extra and not c else ''))

    utc = dt.timezone.utc
    ini, fin = dt.datetime(2026, 10, 1, 4, tzinfo=utc), dt.datetime(2026, 11, 1, 4, tzinfo=utc)
    t = lambda d, h=20: dt.datetime(2026, 10, d, h, tzinfo=utc)  # noqa: E731
    gente = [['P%d' % i, 'Octavos', 100] for i in range(8)]
    D = {
        'eventos': [(1, 'FFA', t(5), gente, 'COPA'), (2, 'SR', t(9), gente[:5], 'CHICA'),
                    (3, 'SR', dt.datetime(2026, 9, 9, tzinfo=utc), gente, 'VIEJA')],
        'anuncio_de': {1: {'orgs': [{'n': 'Velatz', 'id': ''}], 'staff': {'jurado': ['Velatz', 'Jota'], 'dj': ['Jota']}},
                       2: {'orgs': [{'n': 'Velatz', 'id': ''}], 'staff': {'host': ['Jota']}}},
        'raw': lambda n, did='': str(n or ''),
        'clave': lambda n: str(n or '').lower(),
        'duelos': [(t(5, 1), 1, 'Ana', 'Bea', 'Ana', 'COPA'), (t(5, 2), 1, 'Ana', 'Cid', 'Ana', 'COPA'),
                   (t(5, 3), 1, 'Ana', 'Dan', 'Dan', 'COPA'), (t(9, 1), 2, 'Ana', 'Bea', 'Ana', 'CHICA'),
                   (t(9, 2), 2, 'Cid', 'Bea', 'Cid', 'CHICA'), (t(9, 3), 2, 'Fu', 'Bea', 'Fu', 'CHICA')],
        'pos': {'ana': 3, 'bea': 10, 'cid': 40, 'dan': 30},
        'fuera': {'fu'},
        'nombre': lambda kq: kq.capitalize(),
        'cazas': [(t(6), ['Bea']), (t(7), ['Bea', 'Cid']), (dt.datetime(2026, 9, 1, tzinfo=utc), ['Cid'])],
        'vistas': {'promo': {'p1': [7, ['Ana'], 'mi tema', 'aaaaaaaaaaa', '', '2026-10-03T00:00:00Z'],
                             'p3': [0, ['Cid'], 'otro tema', '', '', '2026-10-12T00:00:00Z'],
                             'p2': [9, ['Bea'], 'viejo', '', '', '2026-09-03T00:00:00Z']},
                   'pub': {'x1': [4, ['Cid'], 'Cid, campeón de COPA', '2026-10-05T00:00:00Z']}},
        'crew': {'ana': 'LOS DE ARRIBA', 'bea': 'LOS DE ARRIBA', 'cid': 'OTRA'},
        'pais': {'ana': ('Chile', 'cl'), 'bea': ('Perú', 'pe'), 'cid': ('Chile', 'cl')},
        'sobrevivio': [(t(12), 'Bea'), (t(19), 'Bea'), (t(19), 'Ana'), (dt.datetime(2026, 9, 2, tzinfo=utc), 'Ana')],
        'hinchas': {'2026-10': [['111', 300], ['999', 900], ['222', 40]], '2026-09': [['222', 5000]]},
        'nombre_did': {'111': 'Hugo', '222': 'Ana', '999': 'Dlx'}, 'dueno': '999',
        'ligas': {'l1': {'n': 'LIGA UNO', 'sv': 'URBF', 'batallas': [['1', '2026-10-02T00:00:00Z', None, 'A', 'B', 'A'],
                                                                      ['2', '2026-10-03T00:00:00Z', None, 'C', 'D', ''],
                                                                      ['3', '2026-09-03T00:00:00Z', None, 'C', 'D', 'C']]}},
    }
    nums = numeros(ini, fin, D, [{'op': 'Ana', 'pts': 500}, {'op': 'Bea', 'pts': 300}, {'op': 'Cid', 'pts': 900}])
    ok(set(nums) == {c for c, _n, _d, _t in OTRAS} and len(OTRAS) == 16, 'las dieciséis categorías (las doce y las de «Y más»)')
    ok([(x['n'], x['did']) for x in nums['hincha']] == [('Hugo', '111'), ('Ana', '222')],
       'hincha: la participación del mes (la de septiembre no), con su Discord para cobrar; Dlx no', str(nums['hincha']))
    ok([(x['n'], x['d']) for x in nums['clasico']] == [('Ana vs Bea', '2 duelos · Ana 2, Bea 0')],
       'clásico: los dos que más se cruzaron (dos o más), con cómo quedaron', str(nums['clasico']))
    ok([(x['n'], x['d']) for x in nums['sobreviviente']] == [('Bea', 'sobrevivió 2 veces'), ('Ana', 'sobrevivió 1 vez')],
       'sobreviviente: las veces del mes', str(nums['sobreviviente']))
    D2 = dict(D, eventos=[(5, 'FFA', t(3), [['Ana', 'Campeón', 1], ['Bea', 'Subcampeón', 1], ['Cid', 'Tercero', 1],
                                             ['Dan', 'Semifinal', 1]], 'A'),
                          (6, 'FFA', t(4), [['Bea', 'Campeón', 1], ['Ana', 'Subcampeón', 1]], 'B'),
                          (7, 'FFA', t(5), [['Cid', 'Campeón', 1], ['Fu', 'Subcampeón', 1]], 'C')])
    cs = numeros(ini, fin, D2)['constante']
    ok([(x['n'], x['d']) for x in cs] == [('Ana', '2 podios · 🥇1 🥈1'), ('Bea', '2 podios · 🥇1 🥈1'), ('Cid', '2 podios · 🥇1 🥉1')]
       and not numeros(ini, fin, D)['constante'],
       'constante: campeón, subcampeón y tercero (la semifinal no es podio); a igual, más títulos', str(cs))
    o = nums['organizador']
    ok([x['op'] for x in o] == ['Velatz'] and o[0]['d'] == '1 evento · 8 raperos' and o[0]['quien'] == ['Velatz'],
       'organizador: sólo los eventos de %d o más del mes (la de 5 y la de septiembre no)' % MIN_GENTE, str(o))
    ok([(x['op'], x['d']) for x in nums['staff']][:2] == [('Jota', '2 eventos de jurado, host o DJ'),
                                                         ('Velatz', '1 evento de jurado, host o DJ')],
       'staff: un evento cuenta una vez aunque haga dos cosas (Jota, jurado y DJ en el mismo)', str(nums['staff']))
    ok([x['op'] for x in nums['evento']] == ['1'] and nums['evento'][0]['quien'] == ['Velatz'],
       'evento: el que más gente juntó, con el premio para quien lo organizó')
    ok([(x['op'], x['d']) for x in nums['duelista']][:1] == [('Ana', '3 de 4 duelos ganados')]
       and 'Fu' not in [x['op'] for x in nums['duelista']],
       'duelista: los duelos ganados del mes; quien juega fuera de concurso, no', str(nums['duelista']))
    ok([x['n'] for x in nums['batacazo']] == ['Dan', 'Cid'] and nums['batacazo'][0]['d'].startswith('le ganó a Ana (#3) siendo #30'),
       'batacazo: el que le ganó a alguien más arriba, el más grande primero (uno por persona)', str(nums['batacazo']))
    ok([(x['n'], x['d']) for x in nums['imparable']] == [('Ana', '2 duelos ganados seguidos')],
       'imparable: la racha más larga sin perder en el medio (la de Ana se corta con Dan)', str(nums['imparable']))
    ok([(x['op'], x['d']) for x in nums['cazador']] == [('Bea', '2 cabezas cazadas'), ('Cid', '1 cabeza cazada')],
       'cazador: las cabezas del mes (la de septiembre no)')
    ok([x['op'] for x in nums['promo']] == ['p1', 'p3'] and nums['promo'][0]['vid'] == 'aaaaaaaaaaa'
       and nums['promo'][1]['d'] == 'Cid · la compartió el 11/10' and [x['op'] for x in nums['publicacion']] == ['x1'],
       'promo y publicación: lo publicado ese mes —toda promo, aunque nadie la haya abierto—, con lo contado de a poco',
       str(nums['promo']))
    ok([(x['n'], x['d']) for x in nums['crew']] == [('OTRA', '900 pts · 1 jugó'), ('LOS DE ARRIBA', '800 pts · 2 jugaron')]
       and [(x['n'], x['cc']) for x in nums['pais']] == [('Chile', 'cl'), ('Perú', 'pe')],
       'crew y país: los puntos del mes de su gente', str(nums['crew']))
    ok([(x['n'], x['d']) for x in nums['liga']] == [('LIGA UNO', '1 batalla · 2 raperos')],
       'liga: las batallas jugadas del mes (con resultado)')
    ok(not [x for xs in nums.values() for x in xs if any(a.startswith('_') for a in x)], 'lo de ordenar no viaja')
    # lo contado de a poco
    mes_de = lambda tt: tt.strftime('%Y-%m')  # noqa: E731
    muro = [{'id': 'x1', 'tipo': 'campeon', 'quien': ['Cid'], 'ev': 'COPA', 't': '2026-10-05T00:00:00Z'},
            {'id': 'x2', 'tipo': 'promo', 'pid': 'p9', 'quien': ['Ana'], 'tit': 'tema', 't': '2026-10-06T00:00:00Z'}]
    pj = {'items': [{'id': 'p9', 'quien': 'Ana', 'tit': 'tema', 't': '2026-10-06T00:00:00Z'},
                    {'id': 'p8', 'quien': 'Bea', 'tit': 'nadie', 't': '2026-10-07T00:00:00Z'}],
          'liga': [{'id': 'v-a', 'quien': ['Cid'], 'por': 'perfil', 't': '2026-10-08T00:00:00Z'},
                   {'id': 'v-b', 'quien': ['Dan', 'Eva'], 'por': 'socio', 't': '2026-10-08T00:00:00Z'}]}
    v = vistas({'2026-10': {'pub': {'x1': [6, ['Cid'], 'c', '2026-10-05T00:00:00Z']}}}, t(20), mes_de,
               lambda: (muro, {'p9': 3}, {'x1': 2, 'x2': 1}), pj)
    ok(v['2026-10']['pub']['x1'][0] == 6 and v['2026-10']['promo']['p9'][0] == 3 and v['2026-10']['pub']['x2'][0] == 1,
       'lo contado de a poco se queda con el máximo (el objeto borra lo de hace 30 días)', str(v))
    ok(sorted(v['2026-10']['promo']) == ['p8', 'p9', 'v-a'],
       'toda promo del mes entra, abierta o no; la batalla de un socio no (es la Batalla del mes)', str(v['2026-10']['promo']))
    ok(vistas({'2026-10': {}}, t(20), mes_de, lambda: None, {}) == {'2026-10': {'promo': {}, 'pub': {}}},
       'sin red, queda lo de antes')
    print('\n   %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return mal


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        return 1 if _self_check() else 0
    import mes_awards as MA
    ahora = dt.datetime.now(dt.timezone.utc)
    mes = MA.mes_de(ahora)
    ini, fin = MA.periodo(mes)
    D = datos(MA.leer().get('vistas'))
    nums = numeros(ini, fin, D)
    print('\n══ LAS DEMÁS NOMINACIONES · %s ══\n' % MA.nombre_mes(mes))
    for c, n, _d, _t in OTRAS:
        print('   %-20s %s' % (n, ' · '.join('%s (%s)' % (x['n'][:22], x['d'][:40]) for x in nums.get(c, [])[:3]) or '—'))
    return 0


if __name__ == '__main__':
    sys.exit(main())
