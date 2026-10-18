# -*- coding: utf-8 -*-
"""🏆 LAS DEMÁS NOMINACIONES DE LOS MES AWARDS: diecinueve categorías más, detrás de «Ver las demás nominaciones» y de
«Ver las del staff».

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
  · STAFF: las fechas en que fue jurado, host o DJ de un evento jugado (el anuncio: `anuncios.staff_de()`) o publicó los
    veredictos de su servidor (con un rol de staff ahí). Dlx, 18/10/2026: *«detecta bien todos, porque la mayoría es
    staff de FFA… intenta identificar otros staff»*. Medido ese día sobre octubre: de los anuncios sólo se contaban los
    que seguían en `datos/anuncios.json` —los últimos ~20 por canal: de FFA, 20 para 52 eventos— y SR, la Academia, FRZ
    y FVS casi no escriben el staff en el anuncio; quien publica sus veredictos, sí es su staff (y casi todos tienen a la
    vez rol de jurado, host y DJ, así que de ahí no sale QUÉ hizo: sólo cuenta para el Staff general). Por eso las dos
    cosas se cuentan DE A POCO (`vistas()`: `an` y `ver`), como las promos.
  · JURADO, HOST, DJ: lo mismo, por rol (`STAFF`). Dlx, 18/10/2026: *«en nominaciones agrega staff por separado y también
    en general, o sea como está ahora»*: el Staff del mes se queda entre las demás, y las tres van en su bloque, detrás de
    su botón. Son las tres que los FMS AWARDS premian todos los años (host, DJ y jurado). Un evento cuenta una vez por
    rol: quien es jurado y DJ en el mismo suma en los dos.
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
import random
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
    ('staff', 'Staff del mes', 'las fechas en que fue jurado, host o DJ, o publicó los veredictos', 'persona'),
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
    # 🎲 las de carácter de los FMS AWARDS 2026, al azar «de momento» (Dlx, 18/10/2026: «que sea random de momento»)
    ('villano', 'Villano del mes', 'de momento, al azar entre los que compitieron este mes', 'persona'),
    ('showman', 'Showman del mes', 'de momento, al azar entre los que compitieron este mes', 'persona'),
    ('momento', 'Momento del mes', 'de momento, una batalla del mes al azar (el premio, para los dos)', 'persona'),
    ('crew', 'Crew del mes', 'los puntos de Temporada de su gente', 'grupo'),
    ('pais', 'País del mes', 'los puntos de Temporada de su gente', 'grupo'),
    ('liga', 'Liga del mes', 'las batallas que jugó y la gente que movió', 'grupo'),
    # 🎧 el staff por rol (Dlx, 18/10/2026: «agrega staff por separado»): su bloque en la página (`STAFF`)
    ('jurado', 'Jurado del mes', 'los eventos en que fue jurado', 'persona'),
    ('host', 'Host del mes', 'los eventos que presentó', 'persona'),
    ('dj', 'DJ del mes', 'los eventos en que puso la música', 'persona'),
)
GRUPOS = frozenset(c for c, _n, _d, t in OTRAS if t == 'grupo')
#: las que van en el bloque del staff, detrás de su propio botón: el rol tal como lo dice el anuncio (`anuncios.staff_de()`)
STAFF = ('jurado', 'host', 'dj')
_DE_ROL = {'jurado': 'de jurado', 'host': 'de host', 'dj': 'de DJ'}
#: los Puntos de Tienda del ganador de una de éstas (Dlx: «Insignia + 1.000 PdT»), a cada persona del premio
PREMIO_OTRA = 1000
#: un evento cuenta para el organizador desde esta gente (la del organizador de la semana)
MIN_GENTE = 8
#: cuántos nominados se ven por categoría (`mes_awards.NOMINADOS`): el Showman no repite a los que ya salen de Villano
VISIBLES = 5


def _de_iso(s):
    try:
        t = dt.datetime.fromisoformat(str(s).replace('Z', '+00:00'))
    except ValueError:
        return None
    return t if t.tzinfo else t.replace(tzinfo=dt.timezone.utc)


def _iso(t):
    return t.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def _nombres_staff(ver, ann, did_raw, canon, k):
    """`({discord_id: nombre}, {clave de cualquiera de sus nombres: nombre})` de quien publicó veredictos. Gana el de la
    Lista si su cuenta está; si no, de sus tres nombres —apodo del servidor, nombre visible, usuario— el que ya aparece
    como staff u organizador en algún anuncio o en la Lista; si ninguno, el visible. Y los tres apuntan al elegido: así
    el anuncio que lo menciona con su nombre de Discord suma a la misma persona."""
    conocidos = set(canon)
    for a in ann or []:
        for ns in list((a.get('staff') or {}).values()) + [[o.get('n') for o in a.get('orgs') or []], [a.get('organizador')]]:
            for x in ns or []:
                for y in _partir(x):
                    if nombre_staff(y):
                        conocidos.add(k(nombre_staff(y)))
    cands = {}
    for ps in (ver or {}).values():
        for uid, ns in (ps or {}).items():
            ns = ns if isinstance(ns, list) else [ns]
            cands.setdefault(uid, [nombre_staff(x) for x in (list(ns) + ['', '', ''])[:3]])
    elegido, alias = {}, {}
    for uid, (nick, vis, usu) in cands.items():
        e = did_raw.get(uid) or next((x for x in (nick, vis, usu) if x and k(x) in conocidos), '') or vis or nick or usu
        if not e:
            continue
        elegido[uid] = e
        for x in (nick, vis, usu):
            if x and k(x) != k(e):
                alias.setdefault(k(x), e)
    return elegido, alias


#: lo que el anuncio pone en el lugar del staff y no es nadie: el público que vota, «todos», «a confirmar»
NO_ES_STAFF = frozenset(('ustedes', 'todos', 'todas', 'publico', 'el publico', 'chat', 'el chat', 'votacion', 'la gente',
                         'nadie', 'tbd', 'por confirmar', 'a confirmar', 'invitados', 'everyone', 'here'))


def nombre_staff(s):
    """Un nombre de staff como se lee: sin banderas ni emojis ni adornos («l3wito🇦🇷» → «l3wito», «💿 LEWITO» → «LEWITO»,
    «Flennzs | ⛩️» → «Flennzs»). `''` si no queda nada que se lea —un nombre que es sólo «⛩️»—."""
    import unicodedata
    s = ''.join(unicodedata.normalize('NFKC', c) if 0x1D400 <= ord(c) <= 0x1D7FF else c for c in str(s or ''))
    # lo de entre corchetes es el tema del apodo («Natsuki [Uma Cryu]»), y el número de adelante la plantilla («17 | X»)
    while '[' in s and ']' in s.split('[', 1)[1]:
        a, b = s.split('[', 1)
        s = a + ' ' + b.split(']', 1)[1]
    # sólo letras latinas y números: las de otros alfabetos son adorno («ཐ NeisMCཋ»)
    out = ''.join(c if ((c.isalnum() and (c.isascii() or unicodedata.name(c, '').startswith('LATIN')))
                        or c in " .'_-") else ' ' for c in s)
    out = ' '.join(out.split()).strip(' .-_')
    p = out.split(' ', 1)
    if len(p) == 2 and p[0].isdigit() and len(p[0]) <= 3:
        out = p[1]
    out = '' if out.lower() in NO_ES_STAFF else out
    return out if sum(c.isalnum() for c in out) >= 2 else ''


def _partir(s):
    """Los nombres de un renglón del staff del anuncio. Cuando se escriben varios con su bandera —«LEWITO 🇨🇱 FLENNZS 🇨🇱»—,
    al sacar las banderas quedan pegados con doble espacio, y «LEWITO  FLENNZS» salía nominado a Host como si fuera uno
    (18/10/2026). Se parte también por coma, barra y «&»."""
    return [x.strip() for x in re.split(r'\s{2,}|\s*[,/|&]\s*', str(s or '')) if x.strip()]


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
    por_rol = {r: {} for r in STAFF}
    al_st = D.get('alias_staff') or {}

    def quien_staff(s, did=''):
        """El nombre de alguien del staff: el de la Lista si está —por su cuenta, si el anuncio la trae—, sin
        banderas ni emojis, y el apodo del servidor en vez de su nombre de Discord (`alias_staff`)."""
        r = raw(s, did) or ''
        r = r if k(r) in (D.get('canon') or ()) else (nombre_staff(r) or '')
        return al_st.get(k(r), r) if r and r.lower() not in NO_ES_STAFF else ''
    for n, sv, t, tabla, nombre in D.get('eventos') or []:
        if not en(t):
            continue
        gente = len({k(f[0]) for f in tabla or [] if f and f[0]})
        a = (D.get('anuncio_de') or {}).get(n) or {}
        orgs = []
        for o in (a.get('orgs') or []) or ([{'n': a['organizador'], 'id': ''}] if a.get('organizador') else []):
            # 🧹 lo que no es una persona sino un pedazo del anuncio: «CUPOS: 16», «<@…> ORGANIZADOR», el nombre del
            # evento («LA NOCHE NUNCA PERDONA», 18/10/2026)
            crudo = str(o.get('n') or '')
            if ':' in crudo or '>' in crudo or 'ORGANIZ' in crudo.upper() \
                    or (nombre and k(crudo) and (k(crudo) == k(nombre) or (len(k(crudo)) >= 8 and k(crudo) in k(nombre)))):
                continue
            r = quien_staff(crudo, o.get('id') or '')
            if r and r not in orgs:
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
        cu = a.get('staff_cuentas') or a.get('cuentas') or {}
        for _rol, ns in (a.get('staff') or {}).items():
            en_rol = []
            for x0, s in [(x, y) for x in ns or [] for y in _partir(x)]:
                r = quien_staff(s, cu.get(x0) or cu.get(s) or '')
                if r and r not in en_staff:
                    en_staff.append(r)
                if r and r not in en_rol:
                    en_rol.append(r)
            for r in en_rol if _rol in por_rol else ():
                x = por_rol[_rol].setdefault(k(r), {'op': r, 'n': r, 'q': r, 'quien': [r], '_ev': 0})
                x['_ev'] += 1
        for r in en_staff:
            x = staff.setdefault(k(r), {'op': r, 'n': r, 'q': r, 'quien': [r], '_f': set()})
            x['_f'].add((sv, _fecha_et(t)))
    for x in org.values():
        x['d'] = '%s · %s' % (_plural(x['_ev'], 'evento', 'eventos'), _plural(x['_g'], 'rapero', 'raperos'))
    out['organizador'] = sorted(org.values(), key=lambda x: (-x['_g'], -x['_ev'], x['n'].lower()))
    # 🎧 y quién publicó los veredictos (con rol de staff en ese servidor): una fecha por servidor y día, la misma que
    # si el anuncio lo hubiera dicho
    d0, d1 = _fecha_et(ini), _fecha_et(fin)
    for kd, ns in (D.get('ver') or {}).items():
        sv, _, dia = kd.partition('|')
        if not (d0 <= dia < d1):
            continue
        for s in ns or []:
            r = quien_staff(s)
            if r:
                x = staff.setdefault(k(r), {'op': r, 'n': r, 'q': r, 'quien': [r], '_f': set()})
                x['_f'].add((sv, dia))
    for x in staff.values():
        x['_ev'] = len(x.pop('_f'))
        x['d'] = _plural(x['_ev'], 'fecha', 'fechas') + ' de staff'
    out['staff'] = sorted(staff.values(), key=lambda x: (-x['_ev'], x['n'].lower()))
    for rol, xs in por_rol.items():
        for x in xs.values():
            x['d'] = _plural(x['_ev'], 'evento', 'eventos') + ' ' + _DE_ROL[rol]
        out[rol] = sorted(xs.values(), key=lambda x: (-x['_ev'], x['n'].lower()))
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

    # 🎲 VILLANO, SHOWMAN y MOMENTO, AL AZAR «de momento» (Dlx, 18/10/2026: «que sea random de momento»). Son las de
    # carácter de los FMS AWARDS 2026 y no hay número que las mida. ⚠️ EL AZAR VA SEMBRADO CON EL MES: el ciclo arma los
    # nominados cada media hora, y si cambiaran en cada vuelta nadie podría votarlos. El mismo mes da siempre el mismo
    # orden, y si la directiva saca a uno entra el que sigue en ese orden
    mes = ini.strftime('%Y-%m') if hasattr(ini, 'strftime') else str(ini)[:7]
    pool = sorted({f.get('op') for f in raperos or [] if f.get('op') and k(f.get('op')) not in fuera}, key=lambda x: x.lower())
    vil = list(pool)
    random.Random('villano:' + mes).shuffle(vil)
    sho = [q for q in pool if q not in vil[:VISIBLES]]
    random.Random('showman:' + mes).shuffle(sho)
    azar = 'al azar entre los que compitieron este mes'
    out['villano'] = [{'op': q[:80], 'n': q, 'q': q, 'quien': [q], 'd': azar} for q in vil]
    out['showman'] = [{'op': q[:80], 'n': q, 'q': q, 'quien': [q], 'd': azar} for q in sho]
    mom = {}
    for t, n, a, b, g, ev in D.get('duelos') or []:
        ka, kb = k(a), k(b)
        if en(t) and ka and kb and ka != kb and ka not in fuera and kb not in fuera:
            na, nb = nom(ka), nom(kb)
            op = ('%s:%s vs %s' % (n, na, nb))[:80]
            mom[op] = {'op': op, 'n': '%s vs %s' % (na, nb), 'q': na, 'quien': [na, nb],
                       'd': '%s%s · al azar' % (ev or '#%s' % n, (' · ganó ' + nom(k(g))) if g else '')}
    mom = [mom[op] for op in sorted(mom)]
    random.Random('momento:' + mes).shuffle(mom)
    out['momento'] = mom

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
def vistas(viejas, ahora, mes_de, traer=None, promos=None, staff=None):
    """`{mes: {'promo': {pid: [abiertas, quien, título, vid, img, t]}, 'pub': {id: [aplausos, quien, qué, t]}}}`, con lo
    de esta corrida sumado a lo de antes (se queda el máximo: el objeto borra lo de hace más de 30 días). Sólo lo
    publicado este mes y el anterior. `traer()` devuelve `(muro, promos abiertas, aplausos)` o `None` sin red; `promos`
    es `datos/promos.json` (`bot/promos.py`): TODAS las del mes entran, aunque nadie las haya abierto todavía."""
    out = {m: {'promo': dict((v or {}).get('promo') or {}), 'pub': dict((v or {}).get('pub') or {}),
               'an': dict((v or {}).get('an') or {}), 'ver': {k2: dict(x) for k2, x in ((v or {}).get('ver') or {}).items()}}
           for m, v in (viejas or {}).items()}
    este = mes_de(ahora)
    deje = {este, mes_de(ahora - dt.timedelta(days=32))}
    # 🎧 el staff, de a poco: los anuncios que lo dicen (rotan en `datos/anuncios.json`) y quién publicó los veredictos.
    # Sólo en la corrida de verdad (`traer` lo pasa el self-check)
    st = staff() if staff else (None if traer else _traer_staff(min(deje) + '-01T00:00:00'))
    for a in (st or ([], []))[0] or []:
        mo = a.get('_mo') or _momento(a)
        ti = _de_iso(mo)
        mid = str(a.get('msg_id') or '')
        if not ti or not mid or mes_de(ti) not in deje or not (a.get('staff') or a.get('orgs') or a.get('organizador')):
            continue
        lugar = out.setdefault(mes_de(ti), {'promo': {}, 'pub': {}, 'an': {}, 'ver': {}}).setdefault('an', {})
        # ⚠️ las cuentas que ya tenía no se pierden si la versión de ahora no las trae (una leída antes de guardarlas)
        lugar[mid] = {
            'sv': a.get('servidor') or a.get('sv') or '', 'nombre': str(a.get('nombre') or '')[:80], 'mo': _iso(ti),
            'staff': a.get('staff') or {}, 'orgs': a.get('orgs') or [], 'organizador': a.get('organizador') or '',
            'cuentas': a.get('staff_cuentas') or a.get('cuentas') or (lugar.get(mid) or {}).get('cuentas') or {}}
    for sv, ts, uid, nom in (st or ([], []))[1] or []:
        ti = _de_iso(ts)
        if not ti or mes_de(ti) not in deje or not uid:
            continue
        clave_dia = '%s|%s' % (sv, _fecha_et(ti))
        out.setdefault(mes_de(ti), {'promo': {}, 'pub': {}, 'an': {}, 'ver': {}}).setdefault('ver', {}) \
            .setdefault(clave_dia, {})[str(uid)] = [str(x or '')[:40] for x in (nom if isinstance(nom, list) else [nom])]
    t = traer() if traer else _traer()
    muro, abiertas, aplausos = t if t else ([], {}, {})
    # 📣 las promos del mes, todas (Dlx: «hay promociones que puedes usar»): las de los canales y lo que sube cada uno;
    # no las batallas de los socios, que son la Batalla del mes
    for x in _promos(promos):
        ti = _de_iso(x.get('t'))
        if not ti or mes_de(ti) not in deje:
            continue
        m, pid = mes_de(ti), str(x['id'])
        ya = out.setdefault(m, {'promo': {}, 'pub': {}, 'an': {}, 'ver': {}})['promo'].get(pid)
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
        ya = out.setdefault(m, {'promo': {}, 'pub': {}, 'an': {}, 'ver': {}})['pub'].get(str(it.get('id')))
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


def _fecha_et(t):
    """El día, en hora del este, de un instante UTC."""
    import zoneinfo
    return t.astimezone(zoneinfo.ZoneInfo('America/New_York')).strftime('%Y-%m-%d')


def _momento(a):
    """Cuándo arranca un anuncio (`cuando.momento()`), o cuándo se publicó."""
    try:
        import cuando as CU
        return CU.momento(a) or a.get('cuando')
    except Exception:                                    # noqa: BLE001
        return a.get('cuando')


#: los roles que dicen «staff» en un servidor: jurado, host, DJ, organización y administración (no los «MEJOR …» de premio)
_ROL_STAFF = ('jurad', 'juez', 'jueces', 'host', 'presentad', 'dj', 'staff', 'organiz', 'admin', 'moderad')
#: las páginas de cada canal de veredictos que se miran por corrida (100 mensajes cada una)
VER_PAGINAS = 6


def _nombres_lista(s, guilds):
    """`{clave: nombre de la Lista}` con los nombres de Discord de cada uno —usuario, visible y apodo en cada servidor de
    la Liga—. Un anuncio que escribe «zaik0009» o «l3wito» a mano, sin mencionar, es Zaik y LEWITO (Dlx, 18/10/2026:
    «asegurate que tengas los nombres de todos bien»). ⚠️ SÓLO EN MEMORIA: no va al repo, que es público."""
    import time
    import multiplicadores as MU
    with io.open(os.path.join(BASE, 'datos', 'padron.json'), encoding='utf-8') as f:
        did_raw = {str(p['discord_id']): p['raw'] for p in json.load(f) or [] if p.get('raw') and p.get('discord_id')}
    out = {}
    for gid in sorted(guilds):
        after = '0'
        for _pag in range(12):
            r = s.get('https://discord.com/api/v10/guilds/%s/members' % gid, params={'limit': 1000, 'after': after}, timeout=40)
            if r.status_code == 429:
                time.sleep(float(r.json().get('retry_after', 1)) + .3)
                continue
            if r.status_code != 200:
                break
            lote = r.json() or []
            for m in lote:
                u = m.get('user') or {}
                real = did_raw.get(str(u.get('id') or ''))
                if not real:
                    continue
                for x in (u.get('username'), u.get('global_name'), m.get('nick')):
                    c = nombre_staff(x)
                    if c:
                        out.setdefault(MU._clave_persona(c), real)
            if len(lote) < 1000:
                break
            after = max((str((m.get('user') or {}).get('id', '0')) for m in lote), key=int)
    return out


def _traer_staff(desde):
    """`(anuncios, publicaciones)`: los anuncios de `datos/anuncios.json` y quién publicó en cada canal de veredictos
    desde `desde` —`(sv, cuándo, discord_id, nombre)`, sólo quien tiene un rol de staff en ese servidor—. `None` sin red."""
    import unicodedata

    def j(*p):
        try:
            with io.open(os.path.join(BASE, *p), encoding='utf-8') as f:
                return json.load(f)
        except (OSError, ValueError):
            return None
    ann = (j('datos', 'anuncios.json') or {}).get('anuncios') or []
    try:
        import anuncios as AN
        s = AN._sesion()
    except (Exception, SystemExit):                      # noqa: BLE001 — sin token, `fotos.env()` hace sys.exit
        return ann, []
    sv_de = {str(x.get('guild_id')): c for c, x in ((j('datos', 'servidores.json') or {}).get('servidores') or {}).items()
             if x.get('guild_id')}
    canales = {}
    for x in ((j('datos', 'veredictos.json') or {}).get('batallas') or {}).values():
        if x.get('canal') and str(x.get('g') or '') in sv_de:
            canales[str(x['canal'])] = str(x['g'])
    API = 'https://discord.com/api/v10'
    roles, miembros, posts = {}, {}, []
    try:
        _traer_staff.nombres = _nombres_lista(s, set(sv_de))
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ MES AWARDS: no leí los nombres de Discord de la Lista (%s)' % str(e)[:60])

    def es_staff(gid, uid):
        if gid not in roles:
            r = s.get('%s/guilds/%s/roles' % (API, gid), timeout=20)
            roles[gid] = {y['id'] for y in (r.json() if r.status_code == 200 else [])
                          if any(p in unicodedata.normalize('NFKD', y.get('name') or '').lower() for p in _ROL_STAFF)
                          and 'mejor' not in unicodedata.normalize('NFKD', y.get('name') or '').lower()}
        if (gid, uid) not in miembros:
            r = s.get('%s/guilds/%s/members/%s' % (API, gid, uid), timeout=20)
            mm = (r.json() or {}) if r.status_code == 200 else {}
            miembros[(gid, uid)] = (bool(set(mm.get('roles') or []) & roles[gid]), mm.get('nick') or '')
        return miembros[(gid, uid)]
    try:
        for cid, gid in canales.items():
            antes = None
            for _pag in range(VER_PAGINAS):
                pa = {'limit': 100}
                if antes:
                    pa['before'] = antes
                r = s.get('%s/channels/%s/messages' % (API, cid), params=pa, timeout=20)
                if r.status_code != 200:
                    break
                lote = r.json() or []
                viejo = False
                for m in lote:
                    ts = (m.get('timestamp') or '')[:19]
                    if ts < desde:
                        viejo = True
                        break
                    u = m.get('author') or {}
                    if u.get('bot') or not u.get('id'):
                        continue
                    es, nick = es_staff(gid, u['id'])
                    if not es:
                        continue
                    # 🔑 LOS TRES NOMBRES DE LA CUENTA —su apodo en ese servidor, su nombre visible y su usuario—: cuál
                    # se usa lo decide `datos()`, que sabe cómo lo escriben los anuncios. Con uno solo, la misma
                    # persona salía dos o tres veces («LEWITO», «l3wito»), y en URBF el apodo es del tema del
                    # servidor («Fuji Kiseki [Uma Cryu]»), no el de rapero
                    posts.append((sv_de[gid], ts, u['id'], [nick or '', u.get('global_name') or '', u.get('username') or '']))
                if viejo or len(lote) < 100:
                    break
                antes = lote[-1].get('id')
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ MES AWARDS: no pude leer los veredictos (%s)' % str(e)[:60])
        return ann, None
    return ann, posts


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

    nombres_dc = getattr(_traer_staff, 'nombres', None) or {}

    def raw(nombre, did=''):
        """El nombre de la Lista de alguien del anuncio: por su cuenta si la dice, si no por su nombre."""
        if did and str(did) in did_raw:
            return did_raw[str(did)]
        # sin la numeración de la plantilla: «1 | Adriagner», «2- Velatz»
        x = re.sub(r'^\s*\d{1,2}\s*[|\-–.)]\s*', '', MU._org(nombre)).strip()
        # 👤 y por su nombre de Discord (usuario, visible o apodo): «zaik0009» es Zaik (`_nombres_lista()`)
        return canon.get(k(x)) or nombres_dc.get(k(x)) or nombres_dc.get(k(nombre_staff(x))) or (x if len(x) >= 2 else '')
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
    pl = plano(vistas_guardadas)
    try:
        import cuando as CU
        ann = (j('datos', 'anuncios.json') or {}).get('anuncios') or []
        # 🎧 y los que ya rotaron de `anuncios.json`, contados de a poco (`vistas()`): sin ellos, de FFA quedaban 20 de 52
        ya = {str(x.get('msg_id') or '') for x in ann}
        # las cuentas del staff que el anuncio de hoy no trae (uno leído antes de que se guardaran) salen de lo acumulado
        acc = pl.get('an') or {}
        ann = [dict(x, staff_cuentas=(acc.get(str(x.get('msg_id') or '')) or {}).get('cuentas'))
               if not x.get('staff_cuentas') and (acc.get(str(x.get('msg_id') or '')) or {}).get('cuentas') else x for x in ann]
        ann = list(ann) + [dict(v, servidor=v.get('sv'), _mo=v.get('mo')) for mid, v in (pl.get('an') or {}).items()
                           if mid not in ya]
        pas = [{'nombre': x.get('nombre'), 'sv': x.get('servidor') or '',
                'cuando': x.get('_mo') or CU.momento(x) or x.get('cuando'), '_a': x}
               for x in ann if x.get('nombre')]
        LW.cruzar(pas, regs)
        anuncio_de = {int(p['llave']): p['_a'] for p in pas if str(p.get('llave') or '').isdigit()}
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ MES AWARDS sin los anuncios (%s)' % str(e)[:60])
    elegido, alias_staff = _nombres_staff(pl.get('ver') or {}, ann, did_raw, set(canon), k)
    try:
        from comun.crews import DE_CADA_UNO, norm as crew_norm
        crew = {k(n): c for n, c in ((m, c) for c, ms in __import__('comun.crews', fromlist=['CREWS']).CREWS.items()
                                      for m in ms)}
        del DE_CADA_UNO, crew_norm
    except Exception:                                    # noqa: BLE001
        crew = {}
    return {'eventos': evs, 'duelos': duelos, 'pos': pos, 'fuera': fuera, 'cazas': cazas, 'anuncio_de': anuncio_de,
            'sobrevivio': sobrevivio, 'hinchas': hinchas or {}, 'nombre_did': nombre_did, 'dueno': dueno,
            'clave': k, 'raw': raw, 'nombre': lambda kq: canon.get(kq, kq), 'canon': set(canon), 'pais': pais, 'crew': crew,
            'ligas': (j('datos', 'ligas.json') or {}).get('ligas') or {}, 'vistas': pl,
            # 🎧 quién publicó los veredictos cada día, con UN nombre por cuenta (`_nombres_staff()`)
            'ver': {kd: sorted({elegido[uid] for uid in ps if elegido.get(uid)}) for kd, ps in (pl.get('ver') or {}).items()},
            'alias_staff': alias_staff}


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
    out = {'promo': {}, 'pub': {}, 'an': {}, 'ver': {}}
    for v in (vs or {}).values():
        for c in ('promo', 'pub', 'an'):
            out[c].update((v or {}).get(c) or {})
        for kd, ps in ((v or {}).get('ver') or {}).items():
            out['ver'].setdefault(kd, {}).update(ps or {})
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
        'ver': {'SR|2026-10-09': ['Jota', 'Zed'], 'SR|2026-09-20': ['Viejo']},
        'ligas': {'l1': {'n': 'LIGA UNO', 'sv': 'URBF', 'batallas': [['1', '2026-10-02T00:00:00Z', None, 'A', 'B', 'A'],
                                                                      ['2', '2026-10-03T00:00:00Z', None, 'C', 'D', ''],
                                                                      ['3', '2026-09-03T00:00:00Z', None, 'C', 'D', 'C']]}},
    }
    nums = numeros(ini, fin, D, [{'op': 'Ana', 'pts': 500}, {'op': 'Bea', 'pts': 300}, {'op': 'Cid', 'pts': 900}])
    # 🎲 al azar, pero el mismo mes da siempre lo mismo
    muchos = [{'op': 'R%02d' % i, 'pts': 10} for i in range(12)] + [{'op': 'Fu', 'pts': 9}]
    az1, az2 = numeros(ini, fin, D, muchos), numeros(ini, fin, D, list(reversed(muchos)))
    nov = numeros(fin, fin + dt.timedelta(days=30), D, muchos)
    ok(az1['villano'] == az2['villano'] and az1['showman'] == az2['showman'] and az1['momento'] == az2['momento']
       and len(az1['villano']) == 12 and 'Fu' not in [x['n'] for x in az1['villano']]
       and [x['n'] for x in nov['villano']] != [x['n'] for x in az1['villano']],
       'Villano, Showman y Momento: al azar, el mismo mes siempre igual (aunque cambie el orden), otro mes otro orden, sin los fuera de concurso')
    ok(not {x['n'] for x in az1['villano'][:5]} & {x['n'] for x in az1['showman'][:5]} and len(az1['showman']) == 7,
       'el Showman no repite a los cinco que ya salen de Villano')
    ok(len(az1['momento']) == 5 and all(len(x['quien']) == 2 for x in az1['momento'])
       and all('Fu' not in x['quien'] for x in az1['momento']), 'Momento: las batallas del mes (sin fuera de concurso), el premio para los dos')
    ok(set(nums) == {c for c, _n, _d, _t in OTRAS} and len(OTRAS) == 22,
       'las veintidós categorías (las doce, las de «Y más», las tres al azar y las tres del staff)')
    ok([(x['op'], x['d']) for x in nums['jurado']] == [('Jota', '1 evento de jurado'), ('Velatz', '1 evento de jurado')]
       and [(x['op'], x['d']) for x in nums['host']] == [('Jota', '1 evento de host')]
       and [(x['op'], x['d']) for x in nums['dj']] == [('Jota', '1 evento de DJ')],
       'jurado, host y DJ por separado: cada rol cuenta sus eventos (Jota suma en los tres)',
       str({r: nums[r] for r in STAFF}))
    ok(set(STAFF) <= {c for c, _n, _d, _t in OTRAS}, 'las del bloque del staff son de las demás (premio, insignia, publicación)')
    ok(nombre_staff('l3wito🇦🇷') == 'l3wito' and nombre_staff('💿 LEWITO') == 'LEWITO' and nombre_staff('⛩️') == ''
       and nombre_staff('Flennzs | ⛩️') == 'Flennzs' and nombre_staff('𝐉𝐨𝐭𝐚') == 'Jota' and nombre_staff('John pork') == 'John pork',
       'el nombre del staff, sin banderas, emojis ni letras de fantasía; un emoji solo no es un nombre')
    ok(nombre_staff('Natsuki [Uma Cryu]') == 'Natsuki' and nombre_staff('17 | Velatz') == 'Velatz'
       and nombre_staff('Ustedes') == '' and nombre_staff('DSM-5 (MTZ)') == 'DSM-5 MTZ',
       'sin lo de entre corchetes (el tema del apodo) ni el número de la plantilla; «Ustedes» no es nadie')
    el, al = _nombres_staff({'SR|2026-10-09': {'1': ['Fuji Kiseki [Uma Cryu]', 'ཐ NeisMCཋ', 'portano12'],
                                               '2': ['LEWITO', 'l3wito🇦🇷', 'l3wito'], '3': ['x', 'Ana', 'ana99']}},
                            [{'staff': {'jurado': ['NeisMC'], 'host': ['LEWITO']}}], {'3': 'Ana Lista'}, {'ana lista'},
                            lambda n: n.lower())
    ok(el == {'1': 'NeisMC', '2': 'LEWITO', '3': 'Ana Lista'} and al.get('l3wito') == 'LEWITO'
       and al.get('portano12') == 'NeisMC',
       'el nombre de cada cuenta: la Lista primero; si no, el que ya usan los anuncios; si no, el visible', str((el, al)))
    nu = numeros(ini, fin, dict(D, anuncio_de={1: {'staff': {'host': ['l3wito🇦🇷'], 'dj': ['💿 LEWITO']}}},
                               ver={'SR|2026-10-09': ['LEWITO']}, alias_staff={'l3wito': 'LEWITO'}))
    ok([(x['op'], x['d']) for x in nu['staff']] == [('LEWITO', '2 fechas de staff')]
       and [x['op'] for x in nu['host']] == ['LEWITO'] and [x['op'] for x in nu['dj']] == ['LEWITO'],
       'la misma persona con su nombre de Discord y su apodo del servidor es UNA (l3wito = LEWITO)', str(nu['staff']))
    nc = numeros(ini, fin, dict(D, anuncio_de={1: {'staff': {'host': ['John pork']}, 'staff_cuentas': {'John pork': '77'}}},
                               raw=lambda n, did='': 'Adriagner' if did == '77' else str(n or ''), canon={'adriagner'}))
    ok([x['op'] for x in nc['host']] == ['Adriagner'],
       'con la cuenta del anuncio, «John pork» es Adriagner (el nombre de la Lista)', str(nc['host']))
    no = numeros(ini, fin, dict(D, anuncio_de={1: {'orgs': [{'n': 'CUPOS: 16', 'id': ''}, {'n': '<@1> ORGANIZADOR', 'id': ''},
                                                            {'n': 'COPA', 'id': ''}, {'n': 'Velatz', 'id': ''}]}}))
    ok([x['op'] for x in no['organizador']] == ['Velatz'],
       'organizador: «CUPOS: 16», una mención rota y el nombre del evento no son personas', str(no['organizador']))
    ok(_partir('LEWITO  FLENNZS') == ['LEWITO', 'FLENNZS'] and _partir('Ana, Bea / Cid') == ['Ana', 'Bea', 'Cid']
       and _partir('John pork') == ['John pork'],
       'un renglón del staff con varios (sin sus banderas quedan con doble espacio) se parte; un nombre con espacio, no')
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
    ok([(x['op'], x['d']) for x in nums['staff']] == [('Jota', '2 fechas de staff'), ('Velatz', '1 fecha de staff'),
                                                      ('Zed', '1 fecha de staff')],
       'staff: una fecha por servidor y día —Jota, jurado y DJ el 5 y veredictos el 9 en SR, son 2—, y quien sólo publicó '
       'veredictos (Zed) también; los de septiembre no', str(nums['staff']))
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
    ok(vistas({'2026-10': {}}, t(20), mes_de, lambda: None, {}) == {'2026-10': {'promo': {}, 'pub': {}, 'an': {}, 'ver': {}}},
       'sin red, queda lo de antes')
    # 🎧 el staff de a poco: el anuncio queda aunque rote, y quién publicó veredictos, por servidor y día (hora del este)
    an = [{'msg_id': 'm1', 'servidor': 'FFA', 'nombre': 'COPA', '_mo': '2026-10-05T23:00:00Z',
           'staff': {'jurado': ['Jota']}, 'orgs': [{'n': 'Velatz', 'id': ''}]},
          {'msg_id': 'm0', 'servidor': 'FFA', 'nombre': 'VIEJA', '_mo': '2026-08-05T23:00:00Z', 'staff': {'host': ['X']}},
          {'msg_id': 'm2', 'servidor': 'FFA', 'nombre': 'SIN STAFF', '_mo': '2026-10-06T23:00:00Z'}]
    vs = [('SR', '2026-10-10T02:30:00', '42', 'gx'), ('SR', '2026-10-10T05:00:00', '43', 'je')]
    v2 = vistas({'2026-10': {'an': {'mx': {'sv': 'DDF'}}}}, t(20), mes_de, lambda: None, {}, staff=lambda: (an, vs))
    ok(sorted(v2['2026-10']['an']) == ['m1', 'mx'] and v2['2026-10']['an']['m1']['staff'] == {'jurado': ['Jota']}
       and v2['2026-10']['ver'] == {'SR|2026-10-09': {'42': ['gx']}, 'SR|2026-10-10': {'43': ['je']}},
       'el staff de a poco: queda lo de antes, entra el anuncio que lo dice (no el de agosto ni el que no dice nada), y '
       'los veredictos por día en hora del este (las 2:30 UTC del 10 son el 9)', str(v2['2026-10']))
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
