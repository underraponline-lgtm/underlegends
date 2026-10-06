# -*- coding: utf-8 -*-
"""EL MURO DE PUBLICACIONES: lo que pasa en la Liga, contado solo, y los anuncios de los servidores.

    python bot/muro.py --auto     el self-check, sin red ni archivos

Lo corre `bot/subir_web.py --aplicar` (paso 2c del ciclo), porque necesita la
tabla que arma ahí: `publicar(payload)` anota lo nuevo en `datos/muro.json` y
sube el muro a KV (`web:muro`), sólo si cambió. La página lo pide al abrir
Publicaciones (`/api/muro`): no viaja en el lobby.

Dlx, 28/09/2026, a «¿qué va en Publicaciones?»: *«sí un muro automático, pero
anuncios de todos los servidores también»*. El muro automático es la idea del
27/09: lo arma la Liga con lo que el ciclo ya calcula, no le pide nada a
nadie y cuenta los hechos en tercera persona («X ganó…»), nunca «en nombre
de» alguien.

LO QUE ENTRA
- 🏆 los campeones de cada evento procesado (las llaves);
- ⬆️ quien sube de rango, y 🎖️ quien consigue su primer rango;
- 🃏 quien desbloquea una tarjeta;
- 🎯 las cazas del Most Wanted, 🛡️ quien sobrevive y 🗳️ El Elegido;
- 💰 los precios por cabeza cobrados;
- 🎟️ quien llega a un nivel del Pase de rapero que se publica, y quien lo
  completa (Dlx, 06/10/2026: «5. c»), de `datos/pase_niveles.json`;
- 🥇 los premios de la semana;
- 📢 los anuncios de eventos de todos los servidores (`datos/anuncios.json`),
  y 📰 las novedades de la Liga en DRA.

⚠️ SUBIR DE RANGO Y DESBLOQUEAR NO SE PUEDEN RECALCULAR: son un cambio entre
dos corridas. Por eso se anotan en `datos/muro.json` (con cómo estaba cada uno)
y el resto se vuelve a armar en cada corrida desde su fuente. La primera vez
que se ve a alguien sólo se anota cómo está: si no, el muro arrancaría con
cien «desbloqueó» que no pasaron hoy.

⚠️ LO DE LA PRUEBA NO ENTRA EN LA TEMPORADA: desde el arranque, lo de antes
no se muestra (Dlx, 25/09/2026: lo jugado en la prueba *«se borra»*).
"""
import datetime as dt
import hashlib
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

SALIDA = os.path.join(BASE, 'datos', 'muro.json')
#: la clave de KV que lee la página (por el Worker, `/muro`)
CLAVE = 'web:muro'
#: cuántas publicaciones viajan, y cuántos cambios (rango, tarjeta) se guardan
VIAJAN, GUARDA = 80, 400
#: los anuncios y lo demás, de hasta cuántos días atrás
DIAS = 21
#: los nombres de las tarjetas, como los dice la página
TARJETA = {'temporada': 'Temporada', 'competitivo': 'Competitiva', 'servidor': 'Servidor', 'pais': 'País'}


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
    # ⚠️ los anuncios guardan la hora de Discord sin zona: es UTC
    return t if t.tzinfo else t.replace(tzinfo=dt.timezone.utc)


def _j(*p):
    try:
        with io.open(os.path.join(BASE, *p), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def _base(rg):
    """«A+» -> «A»: el tramo, sin el signo del subrango."""
    return str(rg or '').rstrip('+-−').strip()


def _nivel(rg):
    """Más es mejor: E es 1, SSS es 8. Sin rango, 0."""
    from comun.rangos import ORDEN
    b = _base(rg)
    return len(ORDEN) - ORDEN.index(b) if b in ORDEN else 0


# ── lo que se vuelve a armar en cada corrida ─────────────────────────────
def campeones(llaves, instantes):
    """🏆 el campeón (o el equipo) de cada evento procesado."""
    out = []
    for n, L in (llaves or {}).items():
        if not str(n).isdigit():
            continue
        ms = instantes.get(int(n)) if instantes else None
        t = dt.datetime.fromtimestamp(ms / 1000, dt.timezone.utc) if ms else _de_iso((L.get('dia') or '') + 'T23:00:00')
        camp = [r[0] for r in L.get('tabla') or [] if len(r) > 1 and r[1] == 'Campeón']
        if camp and t:
            out.append({'tipo': 'campeon', 't': _iso(t), 'quien': camp, 'ev': L.get('nombre') or '',
                        'sv': L.get('sv') or '', 'll': int(n), 'part': L.get('participantes') or 0})
    return out


def most_wanted(mw):
    """🎯 las cazas, 🛡️ quien sobrevivió y 🗳️ El Elegido, de la temporada del período de ahora."""
    import most_wanted as MW
    out = []
    for per in MW.periodos(mw or {}):
        for b in per.get('buscados') or []:
            if b.get('cat') == 'elegido' and per.get('elegido'):
                out.append({'tipo': 'elegido', 't': per['elegido'], 'quien': [b['n']],
                            'votos': b.get('votos') or 0, 'de': b.get('de') or 0})
            if b.get('caza'):
                c = b['caza']
                por = c.get('por') or []
                out.append({'tipo': 'caza', 't': c.get('t') or per.get('fin') or '', 'quien': [y['n'] for y in por],
                            'a': b['n'], 'cat': b.get('cn') or '', 'ev': c.get('evento') or '',
                            'sv': c.get('sv') or '', 'pts': sum(y.get('cobra') or 0 for y in por)})
            elif b.get('estado') == 'sobrevivio' and per.get('fin'):
                out.append({'tipo': 'sobrevivio', 't': per['fin'], 'quien': [b['n']], 'cat': b.get('cn') or '',
                            'pts': b.get('paga') or 0})
    return out


def precios_cobrados(pr):
    """💰 los precios por cabeza que alguien cobró."""
    out = []
    for x in (pr or {}).get('precios') or []:
        if x.get('e') == 'cazado' and x.get('ev'):
            out.append({'tipo': 'precio', 't': x['ev'].get('t') or '', 'quien': [y[0] for y in x.get('por') or []],
                        'a': x.get('cabeza') or '', 'ev': x['ev'].get('nombre') or '', 'sv': x['ev'].get('sv') or '',
                        'pts': x.get('monto') or 0})
    return out


def pase(niv, tabla):
    """🎟️ quien llegó a un nivel del Pase que se publica (`pase.PUBLICAR`), con
    su hora, de los hitos que trae `bot/pase.py` del objeto.

    ⚠️ SÓLO QUIEN TIENE PERFIL: el hito trae la clave (no el nombre: el objeto
    no los tiene) y el nombre sale de la tabla. Sin perfil no hay publicación
    —«sin dato no hay pieza»—: no se inventa cómo se llama.
    """
    import pase as PA
    nombres = {f['k']: f['n'] for f in tabla or [] if f.get('k') and f.get('n')}
    out = []
    for h in (niv or {}).get('hitos') or []:
        if not isinstance(h, list) or len(h) < 4 or not isinstance(h[1], int) or not isinstance(h[2], int):
            continue
        k = str(h[3] or '')
        if k not in nombres:
            continue
        t = dt.datetime.fromtimestamp(h[2] / 1000, dt.timezone.utc)
        tipo, valor = PA.ESPECIALES.get(h[1], ('', ''))
        x = {'tipo': 'pase', 't': _iso(t), 'quien': [nombres[k]], 'ks': [k], 'nivel': h[1],
             'temp': str(niv.get('temp') or ''), 'completo': h[1] >= PA.NIVELES}
        if tipo in ('titulo', 'insignia') and not x['completo']:
            x['premio'] = valor
        out.append(x)
    return out


def premios(mult):
    """🥇 los premios de cada semana que cerró."""
    out = []
    for s in (mult or {}).get('semanas') or []:
        ps = s.get('premios_semana')
        if ps and s.get('fin'):
            x = {'tipo': 'premios', 't': s['fin']}
            for k in ('figura', 'revelacion', 'cazador', 'servidor'):
                if ps.get(k):
                    x[k] = ps[k]
            out.append(x)
    return out


def anuncios(an):
    """📢 los anuncios de eventos de todos los servidores."""
    out = []
    for a in (an or {}).get('anuncios') or []:
        t = _de_iso(a.get('cuando'))
        if not t or not a.get('nombre'):
            continue
        x = {'tipo': 'anuncio', 't': _iso(t), 'ev': a['nombre'], 'sv': a.get('servidor') or ''}
        if a.get('guild_id') and a.get('canal_id') and a.get('msg_id'):
            x['link'] = 'https://discord.com/channels/%s/%s/%s' % (a['guild_id'], a['canal_id'], a['msg_id'])
        for k, c in (('modalidad', 'mod'), ('premios', 'pre')):
            if a.get(k):
                x[c] = str(a[k])[:80]
        # ⚠️ EL ORGANIZADOR, LIMPIO: el «Organiza:» a veces dice «yo» o «staff»,
        # que no es nadie (la misma regla que la Copa de la Liga)
        org = _org(a.get('organizador'))
        if org:
            x['org'] = org[:60]
        out.append(x)
    return out


def _org(s):
    try:
        import multiplicadores as MU
        return MU._org(s or '')
    except Exception:                                    # noqa: BLE001
        return str(s or '').strip()


def novedades(nov):
    """📰 lo que anunció la Liga en DRA (lo mismo que el Inicio, `_novedades()`)."""
    return [{'tipo': 'liga', 't': x['t'], 'tit': x.get('tit') or '', 'tx': x.get('tx') or '',
             'link': x.get('link') or ''} for x in nov or [] if x.get('t')]


# ── lo que se anota: los cambios entre corridas ──────────────────────────
def cambios(estado, tabla, ahora):
    """`(publicaciones, estado nuevo)`: quién subió de rango y quién desbloqueó una tarjeta.

    `estado` es `{clave: {rg, c}}` de la corrida anterior. ⚠️ A QUIEN NO
    ESTABA SE LO ANOTA SIN PUBLICAR NADA: la primera vez no hay «antes».
    """
    t = _iso(ahora)
    nuevo, pubs = {}, []
    for f in tabla or []:
        k = f.get('k')
        if not k:
            continue
        rg, cs = f.get('rg') or '', sorted(f.get('c') or [])
        nuevo[k] = {'rg': rg, 'c': cs}
        antes = (estado or {}).get(k)
        if antes is None:
            continue
        if _nivel(rg) > _nivel(antes.get('rg')):
            pubs.append({'tipo': 'rango', 't': t, 'quien': [f['n']], 'rg': _base(rg),
                         'primero': not _nivel(antes.get('rg'))})
        for c in cs:
            if c not in (antes.get('c') or []) and c in TARJETA:
                pubs.append({'tipo': 'tarjeta', 't': t, 'quien': [f['n']], 'carta': c})
    # quien no vino esta vez (salió del ranking) conserva lo último que se supo
    for k, v in (estado or {}).items():
        nuevo.setdefault(k, v)
    return pubs, nuevo


# ── la identidad de cada publicación: para 👏 Felicitar ──────────────────
def id_de(x):
    """12 letras hex, las mismas en cada corrida. Las usa 👏 Felicitar (`validarAplauso()` en `bot/avisos.js`).

    ⚠️ SALE DE LO QUE HACE A ESA PUBLICACIÓN, NO DEL JSON ENTERO: la llave del
    campeón, la cabeza de la caza, el cambio y cuándo se anotó. Un nombre
    corregido o una caza con otro cazador sigue siendo la misma publicación,
    y no pierde los aplausos que ya tenía.
    """
    tipo = x.get('tipo') or ''
    if tipo == 'campeon' and x.get('ll'):
        partes = [tipo, str(x['ll'])]
    elif tipo in ('caza', 'precio'):
        partes = [tipo, x.get('a') or '', x.get('t') or '']
    elif tipo in ('anuncio', 'liga') and x.get('link'):
        partes = [tipo, x['link']]
    elif tipo == 'pase':
        # 🎟️ de quién (su perfil), de qué temporada y qué nivel: llega una sola vez
        partes = [tipo, x.get('temp') or '', str(x.get('nivel') or ''), (x.get('ks') or [''])[0] or '|'.join(x.get('quien') or [])]
    else:
        partes = [tipo, x.get('t') or '', '|'.join(x.get('quien') or []), x.get('rg') or '', x.get('carta') or '',
                  x.get('ev') or '', x.get('tit') or '']
    return hashlib.sha1('\x1f'.join(partes).encode('utf-8')).hexdigest()[:12]


def con_ids(items):
    """Cada publicación con su `id`; la misma identidad dos veces es una sola (queda la primera: la más nueva)."""
    out, vistos = [], set()
    for x in items:
        i = id_de(x)
        if i in vistos:
            continue
        vistos.add(i)
        out.append(dict(x, id=i))
    return out


# ── de quién es cada publicación: para los seguidores ────────────────────
#: las publicaciones que son de alguien. Los anuncios y las novedades no son de nadie
DE_ALGUIEN = ('campeon', 'rango', 'tarjeta', 'caza', 'sobrevivio', 'elegido', 'precio', 'premios', 'pase')
#: los premios de la semana que son de una persona (el de servidor no)
PREMIOS = ('figura', 'revelacion', 'cazador')


def _norm(s):
    """El nombre para comparar: lo mismo que `normNombre()` de la página."""
    import unicodedata
    return ''.join(c for c in unicodedata.normalize('NFKD', str(s or '')).lower() if c.isalnum())


def _banderas(s):
    """Los países de las banderas de un nombre («Ana 🇦🇷» -> ['ar']), como `banderasDe()`."""
    out, par = [], ''
    for ch in str(s or ''):
        c = ord(ch)
        if 0x1F1E6 <= c <= 0x1F1FF:
            par += chr(c - 0x1F1E6 + 97)
            if len(par) == 2:
                out.append(par)
                par = ''
    return out


def k_de(n, tabla):
    """La clave del perfil de ese nombre, igual que `kDe()` de la página; `''` si no es seguro."""
    exacto = [f for f in tabla or [] if f.get('k') and f.get('n') == n]
    if exacto:
        return exacto[0]['k']
    c = [f for f in tabla or [] if f.get('k') and _norm(f.get('n')) == _norm(n)]
    if len(c) == 1:
        return c[0]['k']
    ccs = _banderas(n)
    m = [f for f in c if str(f.get('cc') or '').lower() in ccs]
    return m[0]['k'] if len(m) == 1 else ''


def con_claves(items, tabla):
    """Cada publicación que es de alguien, con la clave de su perfil (`ks`).

    🔑 PARA LOS SEGUIDORES (Dlx, 28/09/2026: *«sí, hay que hacer eso»*). El
    Durable Object lee este muro y le avisa a quien sigue a esa persona
    (`seguidos()` en `bot/avisos.js`). Allá no hay tabla para pasar de un
    nombre a un perfil; acá sí. Y así no hace falta otra clave de KV: el muro
    ya se escribe sólo si cambió.

    ⚠️ `ks` VA ALINEADO CON `quien` —una clave por nombre, `''` si no se
    sabe—; en los premios es `{figura|revelacion|cazador: clave}`. Son las
    claves de los links `#/r/<clave>`: públicas, como el muro. Ningún
    Discord ID.
    """
    out = []
    for x in items:
        # ⚠️ la que ya trae su clave (las del Pase: salen de la clave, no del nombre) no se vuelve a buscar
        if x.get('tipo') not in DE_ALGUIEN or x.get('ks'):
            out.append(x)
            continue
        y = dict(x)
        if x['tipo'] == 'premios':
            ks = {r: k_de(x[r][0], tabla) for r in PREMIOS if x.get(r)}
            ks = {r: k for r, k in ks.items() if k}
        else:
            ks = [k_de(n, tabla) for n in x.get('quien') or []]
            ks = ks if any(ks) else None
        if ks:
            y['ks'] = ks
        out.append(y)
    return out


def armar(p, guardado=None, ahora=None, fuentes=None):
    """`(muro para la página, lo que se guarda)` con el payload del lobby `p`.

    `fuentes` es para el self-check: `{llaves, instantes, mw, precios, mult, anuncios}`.
    """
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    guardado = guardado if guardado is not None else (_j('datos', 'muro.json') or {})
    if fuentes is None:
        import llaves_web as LW
        regs = LW.leer()
        fuentes = {'llaves': regs, 'instantes': LW.instantes(regs), 'mw': _j('datos', 'mw.json'),
                   'precios': _j('datos', 'precios.json'), 'mult': _j('datos', 'multiplicadores.json'),
                   'anuncios': _j('datos', 'anuncios.json'), 'pase': _j('datos', 'pase_niveles.json')}
    pubs, estado = cambios(guardado.get('estado'), p.get('tabla'), ahora)
    anotados = (guardado.get('cambios') or []) + pubs
    anotados = anotados[-GUARDA:]
    todo = (anotados + campeones(fuentes.get('llaves'), fuentes.get('instantes'))
            + most_wanted(fuentes.get('mw')) + precios_cobrados(fuentes.get('precios'))
            + premios(fuentes.get('mult')) + anuncios(fuentes.get('anuncios'))
            + pase(fuentes.get('pase'), p.get('tabla')) + novedades(p.get('novedades')))
    # desde cuándo: lo de los últimos días, y nunca lo de antes del arranque
    desde = ahora - dt.timedelta(days=DIAS)
    try:
        from comun.temporada import arranque
        a = arranque()
        a = dt.datetime.fromisoformat(a) if a else None
        if a and a <= ahora and a > desde:
            desde = a
    except Exception:                                    # noqa: BLE001
        pass
    visto, lista = set(), []
    for x in todo:
        t = _de_iso(x.get('t'))
        if not t or t < desde or t > ahora + dt.timedelta(hours=1):
            continue
        clave = json.dumps(x, sort_keys=True, ensure_ascii=False)
        if clave in visto:
            continue
        visto.add(clave)
        lista.append(x)
    lista.sort(key=lambda x: x['t'], reverse=True)
    muro = {'_leeme': 'El muro de Publicaciones: lo arma bot/muro.py desde bot/subir_web.py (paso 2c).',
            'items': con_claves(con_ids(lista)[:VIAJAN], p.get('tabla'))}
    guardar = {'_leeme': 'El muro de Publicaciones: cómo estaba cada uno (rango y tarjetas) y los cambios '
                         'que se anotaron. Lo escribe bot/muro.py; lo demás del muro se arma en cada corrida.',
               'estado': estado, 'cambios': anotados}
    return muro, guardar


def publicar(p, subir=None):
    """Arma el muro, lo guarda y lo sube a KV. `subir` es `subir_web.subir`."""
    muro, guardar = armar(p)
    with io.open(SALIDA, 'w', encoding='utf-8') as f:
        json.dump(guardar, f, ensure_ascii=False, indent=0)
    ok = subir(muro, solo_si_cambio=True, clave=CLAVE) if subir else None
    return ok, len(muro['items'])


# ── self-check ───────────────────────────────────────────────────────────
def _self_check():
    print('\n══ EL MURO DE PUBLICACIONES ══\n')
    mal = 0

    def ok(c, que):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '🔴', que))

    ahora = dt.datetime(2026, 10, 14, 15, tzinfo=dt.timezone.utc)
    ms = lambda d, h: int(dt.datetime(2026, 10, d, h, tzinfo=dt.timezone.utc).timestamp() * 1000)
    tabla = [{'k': 'ana', 'n': 'Ana', 'rg': 'B+', 'c': ['temporada', 'competitivo']},
             {'k': 'bea', 'n': 'Bea', 'rg': 'C', 'c': ['temporada']},
             {'k': 'cid', 'n': 'Cid', 'rg': '', 'c': ['temporada']}]
    antes = {'ana': {'rg': 'C+', 'c': ['temporada']}, 'bea': {'rg': 'C-', 'c': ['temporada']},
             'dan': {'rg': 'A', 'c': []}}
    pubs, est = cambios(antes, tabla, ahora)
    tipos = sorted((x['tipo'], x['quien'][0], x.get('rg') or x.get('carta')) for x in pubs)
    ok(tipos == [('rango', 'Ana', 'B'), ('tarjeta', 'Ana', 'competitivo')],
       'Ana subió de C a B y desbloqueó la Competitiva; Bea sólo cambió el signo  %s' % tipos)
    ok('cid' in est and not [x for x in pubs if x['quien'] == ['Cid']],
       'a quien no estaba se lo anota sin publicar nada (la primera vez no hay antes)')
    ok(est.get('dan') == {'rg': 'A', 'c': []}, 'y quien no vino conserva lo último que se supo')
    p2, _e = cambios({'bea': {'rg': '', 'c': ['temporada']}}, tabla, ahora)
    ok([x['primero'] for x in p2 if x['tipo'] == 'rango'] == [True], 'el primer rango se marca como primero')
    fuentes = {
        'llaves': {'7': {'nombre': 'COPA', 'sv': 'SR', 'dia': '2026-10-13', 'participantes': 16,
                         'tabla': [['Ana', 'Campeón', 5000], ['Bea', 'Subcampeón', 3750]]},
                   '1': {'nombre': 'VIEJO', 'sv': 'FFA', 'dia': '2026-09-01',
                         'tabla': [['Zoe', 'Campeón', 5000]]}},
        'instantes': {7: ms(13, 22), 1: ms(1, 22) - 30 * 86400000},
        'mw': {'actual': {'id': 'x', 'temporada': 't1', 'fin': '2026-10-19T15:00:00Z', 'elegido': '2026-10-12T15:22:00Z',
                          'buscados': [{'n': 'Bea', 'cat': 'rey', 'cn': 'El Rey', 'estado': 'cazado',
                                        'caza': {'t': '2026-10-13T22:00:00Z', 'evento': 'COPA', 'sv': 'SR',
                                                 'por': [{'n': 'Ana', 'cobra': 9500}]}},
                                       {'n': 'Cid', 'cat': 'elegido', 'cn': 'El Elegido', 'votos': 5, 'de': 9}]}},
        'precios': {'precios': [{'e': 'cazado', 'cabeza': 'Bea', 'monto': 3000, 'por': [['Ana', 3000]],
                                 'ev': {'nombre': 'COPA', 'sv': 'SR', 't': '2026-10-13T22:00:00Z'}},
                                {'e': 'activo', 'cabeza': 'Cid', 'monto': 500}]},
        'mult': {'semanas': [{'fin': '2026-10-12T15:00:00Z', 'premios_semana': {'figura': ['Ana', 12000]}}]},
        'anuncios': {'anuncios': [{'nombre': 'SNAKE ARENA', 'servidor': 'SR', 'cuando': '2026-10-14T12:00:00',
                                   'guild_id': '1', 'canal_id': '2', 'msg_id': '3', 'organizador': 'Nacho'}]},
        'pase': {'temp': 't1', 'hitos': [['111', 10, ms(13, 20), 'ana'], ['222', 30, ms(13, 21), 'nadie'],
                                         ['333', 10, ms(13, 22), '']]}}
    muro, guardar = armar({'tabla': tabla, 'novedades': [{'t': '2026-10-14T13:00:00Z', 'tit': 'Hola',
                                                          'tx': 'la Liga', 'link': 'x'}]},
                          guardado={'estado': antes, 'cambios': []}, ahora=ahora, fuentes=fuentes)
    ts = [x['tipo'] for x in muro['items']]
    ok(set(ts) == {'rango', 'tarjeta', 'campeon', 'caza', 'elegido', 'precio', 'premios', 'anuncio', 'liga', 'pase'},
       'entra todo: rango, tarjeta, campeón, caza, El Elegido, precio, premios, anuncio, novedades y el Pase  %s'
       % sorted(set(ts)))
    pa = [x for x in muro['items'] if x['tipo'] == 'pase']
    ok(len(pa) == 1 and pa[0]['quien'] == ['Ana'] and pa[0]['ks'] == ['ana'] and pa[0]['nivel'] == 10
       and pa[0]['premio'] == 'De la casa' and pa[0]['completo'] is False and pa[0]['t'] == '2026-10-13T20:00:00Z',
       '🎟️ el Pase: Ana llegó al 10 («De la casa»); quien no tiene perfil (o no está en la tabla) no sale  %s' % pa)
    ok(id_de(dict(pa[0], quien=['Ana 🇦🇷'], t='otra')) == pa[0]['id'],
       'y su id sale de su perfil, la temporada y el nivel: un nombre corregido no le borra los aplausos')
    ok([x['t'] for x in muro['items']] == sorted((x['t'] for x in muro['items']), reverse=True),
       'lo más nuevo arriba')
    ok(not [x for x in muro['items'] if x.get('ev') == 'VIEJO'], 'lo de hace más de %d días no entra' % DIAS)
    an = [x for x in muro['items'] if x['tipo'] == 'anuncio'][0]
    ok(an['t'] == '2026-10-14T12:00:00Z' and an['link'] == 'https://discord.com/channels/1/2/3' and an['org'] == 'Nacho',
       'el anuncio, con su link a Discord y la hora de Discord leída como UTC')
    ok(len(guardar['cambios']) == 2 and guardar['estado']['ana']['rg'] == 'B+',
       'se guardan los cambios y cómo quedó cada uno, para la próxima')
    m2, _g2 = armar({'tabla': tabla}, guardado=guardar, ahora=ahora + dt.timedelta(minutes=30), fuentes={})
    ok(sorted(x['tipo'] for x in m2['items']) == ['rango', 'tarjeta'],
       'en la corrida siguiente los cambios siguen ahí y no se repiten')
    ok(json.dumps(muro) and 'discord_id' not in json.dumps(muro), 'y ningún Discord ID viaja')
    # 🔑 las claves, para los seguidores
    por = {x['tipo']: x for x in muro['items']}
    ok(por['campeon'].get('ks') == ['ana'] and por['caza'].get('ks') == ['ana'] and por['rango'].get('ks') == ['ana'],
       'cada publicación de alguien lleva la clave de su perfil, alineada con los nombres')
    ok(por['premios'].get('ks') == {'figura': 'ana'} and 'ks' not in por['anuncio'] and 'ks' not in por['liga'],
       'los premios, por premio; los anuncios y las novedades no son de nadie')
    # 👏 el id de cada publicación, para Felicitar
    ids = [x.get('id') or '' for x in muro['items']]
    ok(all(len(i) == 12 and all(c in '0123456789abcdef' for c in i) for i in ids) and len(set(ids)) == len(ids),
       'cada publicación lleva su id (12 hex) y no se repite  %s' % ids[:3])
    rid = lambda m, tipo: [x['id'] for x in m['items'] if x['tipo'] == tipo]
    ok(rid(m2, 'rango') == rid(muro, 'rango') and rid(m2, 'tarjeta') == rid(muro, 'tarjeta'),
       'y es el mismo en la corrida siguiente (los aplausos no se pierden)')
    caza = [x for x in muro['items'] if x['tipo'] == 'caza'][0]
    ok(id_de(dict(caza, quien=['Otro'], pts=1)) == caza['id'] and
       id_de({'tipo': 'campeon', 'll': 7, 'quien': ['Ana'], 't': 'x'}) == id_de({'tipo': 'campeon', 'll': 7, 'quien': ['Bea']}),
       'una caza con otro cazador, o un campeón con el nombre corregido, sigue siendo la misma publicación')
    dos = con_ids([{'tipo': 'campeon', 'll': 7, 't': '2', 'quien': ['Ana']}, {'tipo': 'campeon', 'll': 7, 't': '1', 'quien': ['Ana ']}])
    ok(len(dos) == 1 and dos[0]['t'] == '2', 'la misma publicación dos veces es una: queda la más nueva')
    t2 = [{'k': 'volk', 'n': 'Volk', 'cc': 'mx'}, {'k': 'volk-co', 'n': 'volk', 'cc': 'co'},
          {'k': 'lazaro', 'n': 'Lázaro', 'cc': 'cu'}]
    ok([k_de(n, t2) for n in ('Volk', 'volk', 'VOLK 🇨🇴', 'VOLK', 'lazaro 🇨🇺', 'Nadie')]
       == ['volk', 'volk-co', 'volk-co', '', 'lazaro', ''],
       'el nombre se lleva a la clave como en la página: exacto, sin tildes ni banderas, y la bandera desempata')
    print('\n   %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return mal


def main():
    if '--auto' in sys.argv[1:]:
        return 1 if _self_check() else 0
    print(__doc__.split('\n\n')[0])
    return 0


if __name__ == '__main__':
    raise SystemExit(main() or 0)
