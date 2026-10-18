# -*- coding: utf-8 -*-
"""🏆 LOS MES AWARDS: lo mejor de cada mes de la Liga Global, votado por la gente, como un Balón de Oro mensual.

    python bot/mes_awards.py            cómo va el mes y qué haría, sin escribir nada
    python bot/mes_awards.py --aplicar  y lo deja en datos/mes_awards.json y en KV `web:salon` (el ciclo, paso 2b8d)
    python bot/mes_awards.py --auto     el self-check, sin red ni archivos

Dlx, 16/10/2026: *«estaba pensando en construir un MES AWARDS, donde se vota a lo mejor de lo mejor como el Balón de
Oro pero cada mes»*; a la propuesta corta, *«de momento empecemos con tu propuesta corta, ahí luego expandiremos»*, y a
las preguntas: las cuatro categorías, vota cualquiera con Discord, los nominados salen solos de los números y el
ganador se lleva insignia, Puntos de Tienda y su lugar en el Salón de la fama.

CÓMO VA
  1. EL 1º DE CADA MES, desde las 11 AM ET (la primera corrida del día), salen los nominados del mes que terminó: los
     `NOMINADOS` mejores de cada categoría, de los números (`numeros()`). Hasta las 6 PM (`ABRE_H`) Dlx puede sacar a
     alguno desde el Dashboard (`mes_sacar`) y entra el siguiente.
  2. A LAS 6 PM ABRE LA VOTACIÓN y dura `DIAS_VOTO` días: una encuesta por categoría (`encuestas()`), con las mismas
     reglas que El Elegido y el ×2 —un voto por cuenta de Discord, se cambia hasta que cierra, las cuentas de menos de
     30 días no votan—. Los votos los guarda el objeto (`bot/avisos.js`, tabla `votos`).
  3. AL CERRAR, el más votado gana. Con menos de `encuestas.MIN_VOTOS` votos gana el primero de los números, y se dice.
     El ganador: la insignia de su categoría (`bot/insignias.py`), Puntos de Tienda (`tienda()`, por `bot/precios.py`),
     la publicación en el muro y su lugar en el Salón de la fama, para siempre.

LAS CATEGORÍAS (los números del mes, en hora del este)
  · RAPERO DEL MES: los puntos de Temporada del mes, con todo lo que multiplica (como la figura de la semana:
    `multiplicadores.factor_de()`). Al lado, sus títulos y sus eventos del mes.
  · REVELACIÓN DEL MES: lo mismo, entre los que jugaron su primer evento en la Liga ese mes (`datos/vistos.json`).
  · BATALLA DEL MES: los videos de batallas de los canales de los socios publicados ese mes, con alguien de la Lista
    (`datos/videos.json`, `meta`), por vistas. La insignia es de los dos lados.
  · SERVIDOR DEL MES: el que más gente movió en el mes (y, a igual gente, más eventos). No lleva insignia ni Tienda:
    se lleva el Salón y la publicación.
⚠️ Quien juega FUERA DE CONCURSO no se nomina, como en la Superliga y la Clausura: no tiene número en los rankings.
⚠️ El primero es OCTUBRE de 2026 (`DESDE`): se vota del 1 al 4 de noviembre.

🏆 Y DIECISÉIS MÁS, DETRÁS DE «VER LAS DEMÁS NOMINACIONES» (Dlx, 16/10/2026: *«más nominaciones… pero tampoco rellenar todo
de eso, sino como el botón que dirá ver las demás nominaciones»*): organizador, staff, duelista, cazador, batacazo,
imparable, evento, promo, publicación, crew, país y liga, y las cuatro de «Y más» —hincha, clásico, sobreviviente y
constante—. Sus números salen de `bot/mes_otros.py`; lo demás —nominar,
sacar, votar, cerrar— es igual. El ganador se lleva su insignia y `mes_otros.PREMIO_OTRA` Puntos de Tienda (*«Insignia
+ 1.000 PdT»*); los de grupos —crew, país y liga—, el Salón y la publicación, como el Servidor del mes. Sus ganadores
salen en UNA publicación por mes, no dieciséis (`muro()`).
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

SALIDA = os.path.join(BASE, 'datos', 'mes_awards.json')
#: la clave de KV que lee la página (por el Worker, `/salon`)
CLAVE_WEB = 'web:salon'
#: el primer mes que se premia
DESDE = '2026-10'
#: cuántos nominados por categoría
NOMINADOS = 5
#: a qué hora (ET) del día 1 salen los nominados, y a qué hora abre la votación; cuántos días dura
NOMINA_H, ABRE_H, DIAS_VOTO = 11, 18, 3
#: (clave, nombre, de qué) en el orden de la página
CATS = (('rapero', 'Rapero del mes', 'los puntos de Temporada del mes'),
        ('revelacion', 'Revelación del mes', 'los puntos del mes de los que debutaron ese mes'),
        ('batalla', 'Batalla del mes', 'las vistas de los videos de batallas de los socios publicados ese mes'),
        ('servidor', 'Servidor del mes', 'cuánta gente movió en el mes'))
#: los Puntos de Tienda de cada ganador (la batalla, a cada lado). El servidor no cobra: no es una persona
PREMIO = {'rapero': 3000, 'revelacion': 2000, 'batalla': 1500}
#: 🏆 las diecinueve de «Ver las demás nominaciones» y del staff (`bot/mes_otros.py`), y las veintitrés juntas
import mes_otros as MO  # noqa: E402
OTRAS = tuple((c, n, de) for c, n, de, _t in MO.OTRAS)
TODAS = CATS + OTRAS
MESES = ('enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre',
         'noviembre', 'diciembre')


# ── el tiempo, en hora del este ─────────────────────────────────────────────────────────────────────────────────────
def _et():
    try:
        from zoneinfo import ZoneInfo
        return ZoneInfo('America/New_York')
    except Exception:                                    # noqa: BLE001
        return dt.timezone(dt.timedelta(hours=-4))


def mes_de(t):
    """`'2026-10'`: el mes de ese instante, en hora del este."""
    return t.astimezone(_et()).strftime('%Y-%m')


def siguiente(mes):
    y, m = int(mes[:4]), int(mes[5:7])
    return '%04d-%02d' % (y + (m == 12), 1 if m == 12 else m + 1)


def anterior(mes):
    y, m = int(mes[:4]), int(mes[5:7])
    return '%04d-%02d' % (y - (m == 1), 12 if m == 1 else m - 1)


def en_et(mes, dia=1, hora=0):
    """El instante (UTC) de ese día y hora del este del mes."""
    y, m = int(mes[:4]), int(mes[5:7])
    return dt.datetime(y, m, dia, hora, tzinfo=_et()).astimezone(dt.timezone.utc)


def periodo(mes):
    """`(inicio, fin)` del mes en UTC: del 1 a las 00:00 ET al 1 del siguiente."""
    return en_et(mes), en_et(siguiente(mes))


def nombre_mes(mes):
    return MESES[int(mes[5:7]) - 1]


def _iso(t):
    return t.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def _de_iso(s):
    try:
        t = dt.datetime.fromisoformat(str(s).replace('Z', '+00:00'))
    except ValueError:
        return None
    return t if t.tzinfo else t.replace(tzinfo=dt.timezone.utc)


# ── los números de un mes ───────────────────────────────────────────────────────────────────────────────────────────
def numeros(mes, eventos, fx, vistos, fuera, videos, svs, clave, otros=None):
    """`{cat: [opción, …]}` ordenadas de mejor a peor, sin cortar. Cada opción `{op, n, …}`.

    `eventos`: `[(n, sv, instante, tabla, nombre)]` (`multiplicadores.eventos_de()`); `fx`: el factor de cada evento
    (`factor_de()`); `vistos`: `{persona: [primer evento, sv]}`; `fuera`: las personas fuera de concurso; `videos`:
    `{video: [título, sv, gente, publicado, vistas]}`; `svs`: `{sigla: nombre}`; `clave`: nombre -> persona. Con
    `otros` (`mes_otros.datos()`), también las doce de «Ver las demás nominaciones»."""
    ini, fin = periodo(mes)
    pts, nombre, oro, ev = {}, {}, {}, {}
    gente_sv, ev_sv = {}, {}
    for n, sv, t, tabla, _nom in eventos:
        if not t or not (ini <= t < fin):
            continue
        ev_sv[sv] = ev_sv.get(sv, 0) + 1
        for f in tabla or []:
            if not f or len(f) < 3 or not f[0]:
                continue
            k = clave(f[0])
            if not k:
                continue
            gente_sv.setdefault(sv, set()).add(k)
            try:
                p = float(str(f[2]).replace(',', '') or 0)
            except ValueError:
                p = 0.0
            pts[k] = pts.get(k, 0) + p * fx(sv, t, n, f[0])
            nombre.setdefault(k, f[0])
            ev[k] = ev.get(k, 0) + 1
            if str(f[1]).lower().startswith('campe'):
                oro[k] = oro.get(k, 0) + 1
    gente = [k for k in pts if k not in fuera and pts[k] > 0]
    gente.sort(key=lambda k: (-pts[k], -oro.get(k, 0), nombre[k].lower()))
    fila = lambda k: {'op': nombre[k], 'n': nombre[k], 'pts': int(round(pts[k])), 'oro': oro.get(k, 0), 'ev': ev[k]}  # noqa: E731
    debut = {k for k, v in (vistos or {}).items() if v and _de_iso(v[0]) and ini <= _de_iso(v[0]) < fin}
    bats = []
    for vid, x in (videos or {}).items():
        t = _de_iso(x[3]) if len(x) > 3 else None
        if t and ini <= t < fin and x[2]:
            bats.append({'op': vid, 'n': x[0], 'sv': x[1], 'gente': list(x[2]), 'vistas': int(x[4] or 0)})
    bats.sort(key=lambda b: (-b['vistas'], b['op']))
    sv_l = sorted(gente_sv, key=lambda s: (-len(gente_sv[s]), -ev_sv.get(s, 0), s))
    out = {'rapero': [fila(k) for k in gente],
           'revelacion': [fila(k) for k in gente if k in debut],
           'batalla': bats,
           'servidor': [{'op': s, 'n': svs.get(s) or s, 'gente': len(gente_sv[s]), 'ev': ev_sv.get(s, 0)} for s in sv_l]}
    if otros is not None:
        out.update(MO.numeros(ini, fin, otros, out['rapero']))
    return out


def nominados(nums, sacar=()):
    """Los `NOMINADOS` primeros de cada categoría, sin los que sacó Dlx (`'cat:op'`): entra el que sigue."""
    sacar = set(sacar or ())
    return {c: [x for x in nums.get(c) or [] if '%s:%s' % (c, x['op']) not in sacar][:NOMINADOS] for c, _n, _d in TODAS}


def _datos(vistas=None):
    """Lo que piden los números, de `datos/`. `vistas` es lo contado de a poco (`mes_otros.vistas()`)."""
    import multiplicadores as MU
    pool = []
    try:
        with io.open(os.path.join(BASE, 'datos', 'temporada_pool.json'), encoding='utf-8') as f:
            pool = json.load(f) or []
    except (OSError, ValueError):
        pass
    fuera = {MU._clave_persona(p.get('raw')) for p in pool if p.get('fc') and p.get('raw')}
    evs = MU.eventos_de()
    d = MU.leer()
    filas = [(e[0], e[1], e[2], f[0], MU._num(f[2])) for e in evs if e[2] for f in (e[3] or []) if f and len(f) >= 3]
    fx = MU.factor_de(d, filas, rivales=[])
    vistos = MU.leer_vistos()
    videos = {}
    try:
        with io.open(os.path.join(BASE, 'datos', 'videos.json'), encoding='utf-8') as f:
            vj = json.load(f) or {}
        meta = vj.get('meta') or {}
        for vid, x in (vj.get('videos') or {}).items():
            m = meta.get(vid)
            if m:
                videos[vid] = [x[0], x[1], x[2], m[0], m[1]]
    except (OSError, ValueError):
        pass
    svs = {}
    try:
        with io.open(os.path.join(BASE, 'datos', 'servidores.json'), encoding='utf-8') as f:
            svs = {k: v.get('nombre') or k for k, v in ((json.load(f) or {}).get('servidores') or {}).items()}
    except (OSError, ValueError):
        pass
    try:
        otros = MO.datos(vistas)
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ MES AWARDS sin las demás nominaciones (%s)' % str(e)[:80])
        otros = None
    return evs, fx, vistos, fuera, videos, svs, MU._clave_persona, otros


def leer(ruta=None):
    try:
        with io.open(ruta or SALIDA, encoding='utf-8') as f:
            return json.load(f) or {}
    except (OSError, ValueError):
        return {}


# ── qué se vota ─────────────────────────────────────────────────────────────────────────────────────────────────────
def encuestas(ahora=None, d=None):
    """Las encuestas de los MES AWARDS que se pueden votar ahora, con la forma de `bot/encuestas.py`: una por categoría
    con dos nominados o más, `{id: 'mes:2026-10:rapero', tipo: 'mes', cat, hasta, min, op}`."""
    import encuestas as EN
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    d = leer() if d is None else d
    out = []
    for mes, m in sorted((d.get('meses') or {}).items()):
        a, c = _de_iso(m.get('abre')), _de_iso(m.get('cierra'))
        if not a or not c or not (a <= ahora < c) or m.get('cerrado'):
            continue
        for cat, _n, _de in TODAS:
            nom = (m.get('cats') or {}).get(cat, {}).get('nom') or []
            if len(nom) >= 2:
                out.append({'id': 'mes:%s:%s' % (mes, cat), 'tipo': 'mes', 'cat': cat, 'hasta': m['cierra'],
                            'min': EN.MIN_VOTOS, 'op': [x['op'] for x in nom]})
    return out


def cerrar(mes, m, votos, ahora):
    """Quién ganó cada categoría: el más votado (`encuestas.ganador()`), o con pocos votos el primero de los números.
    Devuelve el mes cerrado."""
    import encuestas as EN
    m = dict(m)
    cats = {}
    for cat, x in (m.get('cats') or {}).items():
        x = dict(x)
        nom = x.get('nom') or []
        if nom:
            ops = [y['op'] for y in nom]
            g = EN.ganador((votos or {}).get('mes:%s:%s' % (mes, cat)) or {}, validas=ops, semilla='mes:%s:%s' % (mes, cat))
            if g:
                x['gana'], x['votos'], x['total'], x['por'] = g[0], g[1], g[2], 'votos'
            else:
                x['gana'], x['por'] = ops[0], 'numeros'
                x['total'] = sum(int(v) for v in ((votos or {}).get('mes:%s:%s' % (mes, cat)) or {}).values()
                                 if str(v).isdigit())
        cats[cat] = x
    m['cats'] = cats
    m['cerrado'] = _iso(ahora)
    return m


def correr(aplicar=False, ahora=None, datos=None, votos=None, ajustes=None):
    """Una vuelta: «así va» el mes en curso, los nominados del que terminó (si es el día), lo que Dlx sacó, y el cierre.
    Devuelve lo que se guarda. `datos`, `votos` y `ajustes` son para el self-check."""
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    d = leer()
    meses = dict(d.get('meses') or {})
    # 📣👏 lo contado de a poco para la Promo y la Publicación del mes (no en el self-check, que trae sus `datos`)
    vistas = d.get('vistas') or {}
    if datos is None:
        try:
            vistas = MO.vistas(vistas, ahora, mes_de)
        except Exception as e:                           # noqa: BLE001
            print('   ⚠️ MES AWARDS: no pude contar promos y felicitaciones (%s)' % str(e)[:60])
        datos = _datos(vistas)
    actual = mes_de(ahora)
    # 📈 así va el mes en curso (para la página: «si el mes terminara hoy»)
    vivo = {'mes': actual, 'cats': nominados(numeros(actual, *datos))} if actual >= DESDE else None
    # 🗳️ los nominados del mes que terminó, el día 1 desde las 11 AM ET, y hasta que abre se rehacen con lo que sacó Dlx
    prev = anterior(actual)
    if ajustes is None:
        try:
            import multiplicadores as MU
            ajustes = MU.ajustes_dueno()
        except Exception:                                # noqa: BLE001
            ajustes = None
    sacar = []
    ms = (ajustes or {}).get('mes_sacar') or {}
    if ms.get('mes') == prev:
        sacar = [str(x) for x in ms.get('quitar') or []]
    if prev >= DESDE and ahora >= en_et(actual, 1, NOMINA_H):
        m = meses.get(prev)
        abre, cierra = en_et(actual, 1, ABRE_H), en_et(actual, 1 + DIAS_VOTO, ABRE_H)
        if m is None or (ahora < _de_iso(m['abre']) and m.get('sacar') != sacar):
            noms = nominados(numeros(prev, *datos), sacar)
            meses[prev] = {'nominado': (m or {}).get('nominado') or _iso(ahora), 'abre': _iso(abre), 'cierra': _iso(cierra),
                           'sacar': sacar, 'cats': {c: {'nom': noms[c]} for c, _n, _d in TODAS}}
            print('   🏆 MES AWARDS de %s: nominados (%s)' % (nombre_mes(prev), ', '.join(
                '%s %d' % (c, len(noms[c])) for c, _n, _d in TODAS)))
    # 🏁 el cierre
    for mes, m in sorted(meses.items()):
        c = _de_iso(m.get('cierra'))
        if c and ahora >= c and not m.get('cerrado'):
            if votos is None:
                import encuestas as EN
                votos = EN.leer_votos()
            if votos is None:
                print('   ⚠️ MES AWARDS de %s: no pude leer los votos; se cierra en la corrida siguiente' % nombre_mes(mes))
                continue
            meses[mes] = cerrar(mes, m, votos, ahora)
            print('   🏆 MES AWARDS de %s: cerrado (%s)' % (nombre_mes(mes), ', '.join(
                '%s %s' % (c2, x.get('gana')) for c2, x in meses[mes]['cats'].items() if x.get('gana'))))
    out = {'_leeme': 'Los MES AWARDS: los nominados, los votos al cierre y los ganadores de cada mes. Los escribe '
                     'bot/mes_awards.py (paso 2b8d); los votos los guarda el objeto (bot/avisos.js). `vistas`: las promos '
                     'abiertas y las felicitaciones, contadas de a poco (bot/mes_otros.py).',
           'meses': meses, 'vivo': vivo, 'vistas': vistas}
    if aplicar:
        with io.open(SALIDA, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(out, f, ensure_ascii=False, indent=1)
            f.write('\n')
    return out


# ── lo que sale de los ganadores ────────────────────────────────────────────────────────────────────────────────────
def ganadores(d=None):
    """`[(mes, cat, opción, la fila del nominado)]` de los meses cerrados."""
    d = leer() if d is None else d
    out = []
    for mes, m in sorted((d.get('meses') or {}).items()):
        if not m.get('cerrado'):
            continue
        for cat, _n, _de in TODAS:
            x = (m.get('cats') or {}).get(cat) or {}
            fila = next((y for y in x.get('nom') or [] if y['op'] == x.get('gana')), None)
            if fila:
                out.append((mes, cat, x['gana'], fila))
    return out


def personas(cat, fila):
    """Las personas que se llevan el premio: el rapero, o los dos lados de la batalla. El servidor, nadie. De las doce
    de `mes_otros`, las que dice su `quien` —el organizador del evento, quien comparte la promo…—; los grupos, nadie."""
    if cat in ('rapero', 'revelacion'):
        return [fila['op']]
    if cat == 'batalla':
        return list(fila.get('gente') or [])
    if cat in dict((c, 1) for c, _n, _d in OTRAS) and cat not in MO.GRUPOS:
        return [q for q in fila.get('quien') or [] if q]
    return []


def insignias(d=None):
    """`{persona: {ids}}` para `bot/insignias.py`: `mes_rapero`, `mes_revelacion`, `mes_batalla` y las de las doce
    (`mes_organizador`, `mes_staff`…)."""
    out = {}
    for _mes, cat, _op, fila in ganadores(d):
        for q in personas(cat, fila):
            out.setdefault(q, set()).add('mes_' + cat)
    return out


def tienda(d, dids):
    """`{id: [discord_id, puntos, ms]}`: lo que paga cada premio, para el objeto (como `divisiones.tienda()`)."""
    d = leer() if d is None else d
    # 👥 también los del padrón: el organizador o el jurado que no compite no está en el pool, y cobra igual
    dd = dict(_dids_padron())
    dd.update(dids or {})
    out = {}
    for mes, cat, _op, fila in ganadores(d):
        t = _de_iso(((d.get('meses') or {}).get(mes) or {}).get('cerrado'))
        paga = PREMIO.get(cat) or (MO.PREMIO_OTRA if cat in dict((c, 1) for c, _n, _d in OTRAS) else 0)
        for q in personas(cat, fila):
            # 🙌 el Hincha puede no estar en la Lista: trae su Discord
            did = dd.get(q) or (fila.get('did') if q == fila.get('n') else None)
            if did and paga and t:
                out['%s:%s:%s' % (mes, cat, q)] = [did, paga, int(t.timestamp() * 1000)]
    return out


def _dids_padron():
    """`{nombre de la Lista: discord_id}` del padrón."""
    try:
        with io.open(os.path.join(BASE, 'datos', 'padron.json'), encoding='utf-8') as f:
            return {x['raw']: str(x['discord_id']) for x in json.load(f) or []
                    if x.get('raw') and str(x.get('discord_id') or '').isdigit()}
    except (OSError, ValueError):
        return {}


def muro(d=None):
    """📣 Las publicaciones: un ganador por categoría, cuando cerró: `{tipo: 'mesaward', t, mes, cat, quien, …}`."""
    d = leer() if d is None else d
    out = []
    otras = dict((c, n) for c, n, _d in OTRAS)
    juntas = {}
    for mes, cat, op, fila in ganadores(d):
        x = ((d.get('meses') or {}).get(mes) or {}).get('cats', {}).get(cat) or {}
        # 🏆 las doce, en UNA publicación por mes: doce seguidas taparían todo el muro
        if cat in otras:
            j = juntas.setdefault(mes, {'tipo': 'mesaward', 't': ((d.get('meses') or {}).get(mes) or {}).get('cerrado'),
                                        'mes': mes, 'cat': 'otras', 'quien': [], 'lista': []})
            j['lista'].append([cat, otras[cat], fila.get('n') or op])
            for q in personas(cat, fila):
                if q not in j['quien']:
                    j['quien'].append(q)
            continue
        y = {'tipo': 'mesaward', 't': ((d.get('meses') or {}).get(mes) or {}).get('cerrado'), 'mes': mes, 'cat': cat,
             'quien': personas(cat, fila) or [fila.get('n') or op], 'n': fila.get('n') or op, 'votos': x.get('votos') or 0,
             'por': x.get('por') or ''}
        if cat == 'servidor':
            y['sv'] = op
        if cat == 'batalla':
            y['vid'], y['sv'] = op, fila.get('sv') or ''
        out.append(y)
    for j in juntas.values():
        j['quien'] = j['quien'][:12]
        j['n'] = '%d ganadores' % len(j['lista'])
        out.append(j)
    return out


def _sin_did(m):
    """El mes sin los Discord IDs de los nominados (los del Hincha): a la página no van."""
    return dict(m, cats={c: dict(x, nom=[{a: b for a, b in y.items() if a != 'did'} for y in x.get('nom') or []])
                         for c, x in (m.get('cats') or {}).items()})


def para_web(d=None, ahora=None):
    """Lo que lee la página en el Salón de la fama (`/api/salon`): las categorías, el mes que se vota o se nomina, cómo
    va el mes en curso y los ganadores de antes."""
    d = leer() if d is None else d
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    meses = d.get('meses') or {}
    abierto = None
    for mes, m in sorted(meses.items()):
        if not m.get('cerrado'):
            abierto = dict(_sin_did(m), mes=mes, nombre=nombre_mes(mes), votando=bool(_de_iso(m['abre']) and _de_iso(m['abre']) <= ahora))
    hist = [dict(_sin_did(m), mes=mes, nombre=nombre_mes(mes)) for mes, m in sorted(meses.items(), reverse=True) if m.get('cerrado')]
    viv = d.get('vivo')
    if viv:
        viv = dict(viv, cats={c: [{a: b for a, b in x.items() if a != 'did'} for x in xs] for c, xs in (viv.get('cats') or {}).items()},
                   nombre=nombre_mes(viv['mes']), vota=_iso(en_et(siguiente(viv['mes']), 1, ABRE_H)))
    # `cats`: [clave, nombre, de qué, 0 a la vista · 1 detrás de «Ver las demás nominaciones» · 2 en el bloque del staff]
    return {'t': _iso(ahora), 'cats': [list(c) + [0] for c in CATS] + [list(c) + [2 if c[0] in MO.STAFF else 1] for c in OTRAS],
            'premio': dict(PREMIO, otra=MO.PREMIO_OTRA), 'abierto': abierto, 'vivo': viv, 'hist': hist[:24]}


# ── self-check ───────────────────────────────────────────────────────────────────────────────────────────────────────
def _self_check():
    print('\n══ LOS MES AWARDS ══\n')
    mal = 0

    def ok(c, q, extra=''):
        nonlocal mal
        mal += not c
        print('   %s %s%s' % ('✅' if c else '🔴', q, ('  ' + extra) if extra and not c else ''))

    utc = dt.timezone.utc
    ok(periodo('2026-10') == (dt.datetime(2026, 10, 1, 4, tzinfo=utc), dt.datetime(2026, 11, 1, 4, tzinfo=utc))
       and mes_de(dt.datetime(2026, 11, 1, 3, 59, tzinfo=utc)) == '2026-10' and siguiente('2026-12') == '2027-01'
       and anterior('2027-01') == '2026-12',
       'el mes va en hora del este: el 1/11 a las 3:59 UTC todavía es octubre')
    ev = [(1, 'FFA', dt.datetime(2026, 10, 5, 20, tzinfo=utc), [['Ana', 'Campeón', 10000], ['Bea', 'Subcampeón', 7500],
                                                              ['Fuera', 'Semifinal', 5000]], 'COPA'),
          (2, 'SR', dt.datetime(2026, 10, 20, 20, tzinfo=utc), [['Bea', 'Campeón', 10000], ['Cid', 'Cuartos', 2500]], 'X'),
          (3, 'SR', dt.datetime(2026, 9, 20, 20, tzinfo=utc), [['Cid', 'Campeón', 99999]], 'VIEJO')]
    fx = lambda sv, t, n, q: 2 if n == 2 else 1  # noqa: E731
    vistos = {'cid': ['2026-10-20T20:00:00Z', 'SR'], 'ana': ['2026-09-01T00:00:00Z', 'FFA']}
    vids = {'v1': ['ANA vs BEA', 'FFA', ['Ana', 'Bea'], '2026-10-06T00:00:00Z', 300],
            'v2': ['CID vs X', 'SR', ['Cid'], '2026-10-21T00:00:00Z', 900], 'v3': ['viejo', 'SR', ['Cid'], '2026-09-01T00:00:00Z', 5000]}
    nums = numeros('2026-10', ev, fx, vistos, {'fuera'}, vids, {'FFA': 'Freestyle For All', 'SR': 'Snake Rap'},
                   lambda n: n.lower())
    ok([x['op'] for x in nums['rapero']] == ['Bea', 'Ana', 'Cid'] and nums['rapero'][0]['pts'] == 27500
       and nums['rapero'][0]['oro'] == 1,
       'rapero del mes: los puntos del mes con lo que multiplica (Bea 7.500 + 10.000 ×2), sin lo de septiembre ni al de '
       'fuera de concurso', str(nums['rapero']))
    ok([x['op'] for x in nums['revelacion']] == ['Cid'], 'revelación: sólo los que debutaron ese mes')
    ok([x['op'] for x in nums['batalla']] == ['v2', 'v1'], 'batalla: los videos del mes, por vistas')
    ok([x['op'] for x in nums['servidor']] == ['FFA', 'SR'] and nums['servidor'][0]['gente'] == 3,
       'servidor: el que más gente movió')
    ok([x['op'] for x in nominados(nums, ['rapero:Bea'])['rapero']] == ['Ana', 'Cid'],
       'lo que saca Dlx no entra, y entra el que sigue')
    datos = (ev, fx, vistos, {'fuera'}, vids, {}, lambda n: n.lower())
    t1 = dt.datetime(2026, 11, 1, 14, tzinfo=utc)          # 10 AM ET: todavía no
    import tempfile
    global SALIDA
    viejo, SALIDA = SALIDA, os.path.join(tempfile.mkdtemp(), 'mes.json')
    try:
        r = correr(aplicar=True, ahora=t1, datos=datos, votos={}, ajustes={})
        ok('2026-10' not in r['meses'] and r['vivo']['mes'] == '2026-11', 'antes de las 11 AM ET del día 1 no hay nominados')
        t2 = dt.datetime(2026, 11, 1, 16, tzinfo=utc)      # 11 AM ET
        r = correr(aplicar=True, ahora=t2, datos=datos, votos={}, ajustes={'mes_sacar': {'mes': '2026-10', 'quitar': ['rapero:Cid']}})
        m = r['meses']['2026-10']
        ok([x['op'] for x in m['cats']['rapero']['nom']] == ['Bea', 'Ana'] and m['abre'] == '2026-11-01T23:00:00Z'
           and m['cierra'] == '2026-11-04T23:00:00Z',
           'a las 11 AM ET salen los nominados (sin el que sacó Dlx); abre a las 6 PM y cierra a los tres días (el 1/11 '
           'ya es horario de invierno: 6 PM ET son las 23 UTC)', str((m['abre'], m['cierra'])))
        ok(not encuestas(t2, r) and [e['id'] for e in encuestas(dt.datetime(2026, 11, 2, tzinfo=utc), r)]
           == ['mes:2026-10:rapero', 'mes:2026-10:batalla', 'mes:2026-10:servidor'],
           'se vota desde que abre, y sólo lo que tiene dos nominados o más (la revelación tiene uno)')
        t3 = dt.datetime(2026, 11, 5, tzinfo=utc)
        r = correr(aplicar=True, ahora=t3, datos=datos, votos={'mes:2026-10:rapero': {'Ana': 5, 'Bea': 2}}, ajustes={})
        c = r['meses']['2026-10']['cats']
        ok(c['rapero']['gana'] == 'Ana' and c['rapero']['por'] == 'votos' and c['batalla']['gana'] == 'v2'
           and c['batalla']['por'] == 'numeros',
           'al cierre gana el más votado; con menos de 3 votos, el primero de los números')
        ok(insignias(r) == {'Ana': {'mes_rapero'}, 'Cid': {'mes_revelacion', 'mes_batalla'}},
           'las insignias: el rapero, la revelación y los dos lados de la batalla (el servidor no)', str(insignias(r)))
        tt = tienda(r, {'Ana': '111', 'Cid': '222'})
        ok(tt.get('2026-10:rapero:Ana', [0, 0])[:2] == ['111', 3000] and tt.get('2026-10:batalla:Cid', [0, 0])[1] == 1500
           and len(tt) == 3, 'la Tienda: cada premio una vez, a quien tiene su Discord', str(tt))
        w = para_web(r, t3)
        ok(not w['abierto'] and w['hist'][0]['mes'] == '2026-10' and len(muro(r)) == 4, 'cerrado: va al historial y al muro')
        ok(len(w['cats']) == 4 + len(OTRAS) == 23 and w['cats'][4][3] == 1 and w['cats'][0][3] == 0 and w['premio']['otra'] == 1000
           and [c[0] for c in w['cats'] if c[3] == 2] == ['jurado', 'host', 'dj'],
           'la página recibe las veintitrés: cuáles van detrás del botón y cuáles en el bloque del staff')
        # 🏆 una de las doce: el organizador gana, cobra 1.000 y sale en UNA publicación con las demás
        r2 = dict(r)
        r2['meses'] = {'2026-10': dict(r['meses']['2026-10'])}
        r2['meses']['2026-10']['cats'] = dict(r2['meses']['2026-10']['cats'],
                                              organizador={'nom': [{'op': 'Velatz', 'n': 'Velatz', 'quien': ['Velatz']}], 'gana': 'Velatz'},
                                              crew={'nom': [{'op': 'LDA', 'n': 'LDA', 'quien': []}], 'gana': 'LDA'})
        tt2 = tienda(r2, {'Velatz': '333'})
        mm = [x for x in muro(r2) if x.get('cat') == 'otras']
        ok(tt2.get('2026-10:organizador:Velatz', [0, 0])[1] == 1000 and 'mes_organizador' in insignias(r2).get('Velatz', set())
           and not [k for k in tt2 if ':crew:' in k],
           'el ganador de una de las doce: insignia y 1.000 PdT; el de un grupo, nada (como el servidor)', str(tt2))
        ok(len(mm) == 1 and [y[0] for y in mm[0]['lista']] == ['organizador', 'crew'] and mm[0]['quien'] == ['Velatz'],
           'las doce salen en una sola publicación del mes', str(mm))
    finally:
        SALIDA = viejo
    print('\n   %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return mal


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        return 1 if _self_check() else 0
    print('\n══ LOS MES AWARDS ══\n')
    r = correr(aplicar='--aplicar' in sys.argv)
    v = r.get('vivo')
    if v:
        print('   📈 así va %s:' % nombre_mes(v['mes']))
        for c, n, _de in CATS:
            print('      %-18s %s' % (n, ', '.join(str(x.get('n'))[:24] for x in v['cats'].get(c) or [])))
    if '--aplicar' in sys.argv:
        try:
            import subir_web as SW
            ok = SW.subir(para_web(r), solo_si_cambio=True, clave=CLAVE_WEB)
            print('   %s' % ('✓ el Salón: igual' if ok is None else '✅ el Salón: subido (%s)' % CLAVE_WEB if ok else '⚠️ el Salón no se pudo subir'))
        except Exception as e:                           # noqa: BLE001
            print('   ⚠️ el Salón no se pudo subir: %s' % str(e)[:80])
    else:
        print('   (simulacro: no escribí nada — `--aplicar`)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
