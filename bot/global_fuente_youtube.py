# -*- coding: utf-8 -*-
"""🎬 YOUTUBE COMO FUENTE DEL RANKING GLOBAL: de los títulos de los canales de batallas a resultados.

    python bot/global_fuente_youtube.py --ver     lee los canales en vivo y dice qué sale de cada uno
    python bot/global_fuente_youtube.py --auto    self-check sin red, con títulos reales (bot/global_casos/youtube_*.json)

Dlx, 20/11/2026: el ranking global junta a todos, de la Liga a los gigantes, y se arma solo una vez por semana. Los
canales y sus reglas están en `datos/global_canales.json`, que se edita a mano.

SIN CLAVE DE LA API: se lee la misma página pública que ve cualquiera, con las piezas de `bot/videos.py`. No se usa
`videos.canal()` tal cual porque tira la fecha de cada video, y sin fecha no se sabe qué entra en la ventana ni cuándo
dejar de pedir páginas. Las fechas exactas salen de la lista pública (`videos.nuevos()`, los 15 más nuevos) y, para el
video más viejo de cada evento, de una pregunta chica al reproductor (~17 KB). Lo demás queda aproximado («hace 1 mes»)
y se avisa.

⚠️ NINGÚN TÍTULO DICE QUIÉN GANÓ. Sale del cuadro: dentro del mismo evento, quien aparece en una ronda posterior ganó
la anterior. La final queda sin ganador salvo que otro título del canal nombre al campeón («MARITHEA Y SU CAMINO AL
TÍTULO»). Se devuelve igual: el ranking salta para los puntos lo que no tiene ganador.

⚠️ SÓLO 1 VS 1. Tríos, duplas, cuartetos, batallones, muerte súbita, exhibiciones, compilados y clips se saltan y se
cuentan en los avisos. Una dupla no siempre lo dice: «EL BARTO BTI» son dos que ya batallaron solos en otro video, y
eso también la delata.

⚠️ EN LA DUDA, DOS PERFILES (la regla de `global_ranking.py`): el id de cada rapero es su nombre, salvo que el mismo
nombre aparezca con dos banderas distintas — «ABEL 🇪🇨» y «ABEL» de un nacional argentino son dos personas.

⚠️ YOUTUBE NO DEJA SACAR MÉTRICAS DE SUS DATOS: no se lee ni se guarda ninguna vista ni like. Sólo quién, en qué
ronda, de qué evento, cuándo, y el id del video como prueba.
"""
import datetime as dt
import glob
import html
import io
import json
import os
import re
import sys
import time
import unicodedata
import zoneinfo

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import videos as V  # noqa: E402 — la lectura de YouTube ya vive ahí: no se escribe otra
from comun import claves  # noqa: E402

ET = zoneinfo.ZoneInfo('America/New_York')
CANALES = os.path.join(BASE, 'datos', 'global_canales.json')
CASOS = os.path.join(SCR, 'global_casos')
VER = 'https://www.youtube.com/watch?v='

PAUSA = 1.0         # ~1 pedido por segundo
MAX_PAGINAS = 12    # 30 videos por página: hasta ~390 por canal
MARGEN = 21         # se pagina 3 semanas más allá de `desde`: un evento que arrancó antes no entra a medias
MAX_EXACTAS = 6     # preguntas al reproductor por canal y corrida
JUNTOS = 30         # dos tandas con el mismo nombre a más de esto son dos ediciones

# ── el diccionario cerrado de rondas ─────────────────────────────────────────────────────────────────────────────────
RONDAS = {
    'final': ('gran final', 'la final', 'final internacional', 'final nacional', 'final'),
    'semifinal': ('semifinales', 'semifinal', 'semi final', 'semi-final', 'semis', 'semi'),
    'cuartos': ('cuartos de final', 'cuartos', '4tos de final', '4tos', '4to'),
    'octavos': ('octavos de final', 'octavos', '8vos de final', '8vos', '8vo', '8avos'),
    '16avos': ('dieciseisavos', '16avos de final', '16avos', '16vos'),
    '32avos': ('treintaidosavos', '32avos', '32vos'),
    'tercer': ('tercer lugar', 'tercer puesto', '3er lugar', '3er puesto'),
    'filtro': ('filtros', 'filtro'),
}
ORDEN = {'filtro': 0, '32avos': 1, '16avos': 2, 'octavos': 3, 'cuartos': 4, 'semifinal': 5, 'final': 6}
_DE_FRASE = {f: r for r, fs in RONDAS.items() for f in fs}
_RONDA_PAT = '(?:%s)(?![a-z0-9])' % '|'.join(re.escape(f) for f in sorted(_DE_FRASE, key=len, reverse=True))
_RONDA_RE = re.compile(_RONDA_PAT)

# ── lo que no es un 1 vs 1 (sobre el título sin tildes y en minúsculas) ──────────────────────────────────────────────
_NO_BATALLA = re.compile(r'\b(?:mejores rimas|mejores momentos|lo mejor de|rimas que|compilado|compilacion|'
                         r'recopilacion|resumen|reaccion\w*|reacciona\w*|highlights|full event|evento completo|'
                         r'previa|minutazo|minutos de presentacion|top \d+|entrevista|podcast|clip)\b'
                         r'|(?:^|\s)#shorts?\b')
_FORMATO = re.compile(r'\b(?:batallon|muerte subita|exhibicion|exhibition|face to face|cara a cara|contra todos|'
                      r'royal rumble|cypher|5 vidas)\b')
_EQUIPOS = re.compile(r'\b(?:duplas?|parejas?|equipos?|tag team|trios?|cuartetos?|[234] ?vs? ?[234])\b')
_CAMPEON = re.compile(r'\b(?:campeon|campeona|bicampeon|bicampeona|tricampeon|tricampeona|camino al titulo|'
                      r'se corona|se consagra|gano|ganador|ganadora)\b')
_ANIO = re.compile(r'\b(20\d\d)\b')
_BANDERA = re.compile('[\U0001F1E6-\U0001F1FF]{2}')
_UNA_BARRA = re.compile(r'(?<!/)/(?!/)')  # «Fusok/El Barto»: la barra sola junta a dos
_SEP = re.compile(r'\s*(?:\|\|?|│|┃|•)\s*|\s+[-–—]+\s*|\s*[-–—]+\s+|\s*:\s+|\s+:\s*|\s*[\[\]«»“”]\s*')

# «hace 3 sem.», «hace 1 m», «hace 2 meses»: la primera página viene abreviada y las siguientes no
_HACE = re.compile(r'hace\s+(\d+)\s*(segundos?|seg|minutos?|min|horas?|h|d[ií]as?|d|semanas?|sem|meses|mes|m|'
                   r'años?|a)(?![a-zñ])', re.I)
_AGO = re.compile(r'(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago', re.I)


# ── texto ────────────────────────────────────────────────────────────────────────────────────────────────────────────
def _plano(s):
    """Sin tildes y en minúsculas, CON EL MISMO LARGO: un corte hallado acá vale igual en el título original."""
    out = []
    for c in str(s or ''):
        b = unicodedata.normalize('NFD', c)[0]
        lo = b.lower()
        out.append(lo[0] if len(lo) == 1 else b)
    return ''.join(out)


def _fichas(s, sin_anio=False):
    fs = re.findall(r'[a-z0-9]+', _plano(s))
    return tuple(f for f in fs if not (sin_anio and _ANIO.fullmatch(f)))


def _iso(bandera):
    return ''.join(chr(ord(c) - 0x1F1E6 + 97) for c in bandera)


def _limpio(s):
    """El nombre de un evento para mostrar: sin hashtags, emojis ni banderas."""
    s = re.sub(r'#\w+', ' ', s).replace('@', '')
    s = ''.join(c if (c.isalnum() or c in " .'&()-,/+!¡¿?") else ' ' for c in s)
    s = re.sub(r'\(\s*\)', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip(' .-,')
    if s.startswith('(') and s.endswith(')') and s.count('(') == 1:
        s = s[1:-1].strip()
    return s


def _ronda(pl):
    """La ronda con la que EMPIEZA un tramo («Semifinal Regional Coquimbo»), y dónde termina la palabra."""
    i = 0
    while i < len(pl) and not pl[i].isalnum():
        i += 1
    m = _RONDA_RE.match(pl, i)
    return (_DE_FRASE[m.group(0)], m.end()) if m else (None, None)


def _tramos(t):
    """El título partido en sus tramos (`|`, ` - `, `: `…), cada uno como `(original, plano)`."""
    p = _plano(t)
    # la ronda metida entre paréntesis o tras una coma también es un tramo: «Ajabaraja vs Balam (octavos rumbo a…)»,
    # «Certa vs K eme, Semifinal…». Un paréntesis sin ronda se queda: «ABYSSUS (FULLYLO4DED)» es una dupla
    cambia = set()
    for m in re.finditer(r'\((?=\s*%s)' % _RONDA_PAT, p):
        cambia.add(m.start())
        j = p.find(')', m.start())
        if j > 0:
            cambia.add(j)
    for m in re.finditer(r',(?=\s*%s)' % _RONDA_PAT, p):
        cambia.add(m.start())
    if cambia:
        t = ''.join('|' if i in cambia else c for i, c in enumerate(t))
        p = ''.join('|' if i in cambia else c for i, c in enumerate(p))
    out, i = [], 0
    for m in _SEP.finditer(p):
        out.append((t[i:m.start()], p[i:m.start()]))
        i = m.end()
    out.append((t[i:], p[i:]))
    return [(a.strip(), b.strip()) for a, b in out if a.strip()]


def _partes_vs(s):
    return [x for x in V._VS.split(s) if x.strip()]


def leer_titulo(t, canal=None):
    """Lo que dice un título: lados, ronda y evento. `motivo` dice por qué no cuenta, o None si es un 1 vs 1 con ronda."""
    for a, b in ((canal or {}).get('renombra') or {}).items():
        t = re.sub(re.escape(a), b, t, flags=re.I)
    p = _plano(t)
    x = {'titulo': t, 'motivo': None, 'ronda': None, 'evento': '', 'banderas': [], 'lados': [], 'sueltos': [],
         'aparece': False}
    if _NO_BATALLA.search(p):
        x['motivo'] = 'no_batalla'
        return x
    tr = _tramos(t)
    i = next((k for k, (o, _) in enumerate(tr) if len(_partes_vs(o)) >= 2), None)
    if i is None:
        x['motivo'] = 'no_batalla'
        return x
    pelea = re.sub(r'^\s*\([^)]*\)\s*', '', tr[i][0])  # «(BATALLÓN) A vs B»: el formato no es parte del nombre
    ronda, j, resto = None, None, ''
    for k, (o, pl) in enumerate(tr):
        if k != i:
            r, fin = _ronda(pl)
            if r:
                ronda, j, resto = r, k, o[fin:]
                break
    # el evento: lo que viene después de la batalla, más lo que sobra del tramo de la ronda («Regional Coquimbo»)
    partes = [o for k, (o, _) in enumerate(tr) if k > i and k != j] + ([resto] if resto.strip() else [])
    if not any(_limpio(s) for s in partes):
        # «| FECHA 11 | PERROS DE TRABA | 2026 | A vs B | SEMIFINAL |»: sin nada detrás de la batalla, el evento va
        # delante. Sin esto todas las fechas del canal se juntaban en una sola, con el nombre del canal
        partes = [o for k, (o, _) in enumerate(tr) if k < i and k != j]
    x['evento'] = ' · '.join(s for s in (_limpio(s) for s in partes) if s)
    x['banderas'] = sorted({_iso(b) for s in partes for b in _BANDERA.findall(s)})
    x['ronda'] = ronda
    lados = V.lados(pelea)
    x['lados'] = lados
    n = len(_partes_vs(pelea))
    equipo = len(lados) < 2 or any(len(lado) > 1 for lado in lados) or bool(_UNA_BARRA.search(pelea))
    if _FORMATO.search(p):
        x['motivo'] = 'formato'
    elif _EQUIPOS.search(p):
        x['motivo'] = 'equipos'
    elif n > 2:
        x['motivo'] = 'varios'
    elif equipo:
        x['motivo'] = 'equipos'
    elif not ronda:
        x['motivo'] = 'sin_ronda'
    # los nombres que son de UNA persona: sirven para reconocer duplas en otros títulos y para seguir el cuadro
    if x['motivo'] == 'equipos':
        x['sueltos'] = [m[0] for lado in lados if len(lado) > 1 for m in lado]
    else:
        x['sueltos'] = [lado[0][0] for lado in lados if len(lado) == 1]
        x['aparece'] = bool(ronda) and x['motivo'] in (None, 'formato', 'varios')
    return x


# ── fechas ───────────────────────────────────────────────────────────────────────────────────────────────────────────
def _dia(s):
    if isinstance(s, dt.date):
        return s
    try:
        return dt.date.fromisoformat(str(s)[:10])
    except (TypeError, ValueError):
        return None


def _dia_et(iso):
    """«2026-10-18T07:09:18-07:00» o «…Z» → el día en hora del este."""
    if not iso:
        return None
    try:
        d = dt.datetime.fromisoformat(str(iso).replace('Z', '+00:00'))
    except ValueError:
        return _dia(iso)
    return d.astimezone(ET).date() if d.tzinfo else d.date()


def rango(rel, hoy):
    """«hace 3 sem.» → `(desde, hasta)`: los días en que se pudo haber publicado. YouTube redondea para abajo."""
    m = _HACE.search(rel or '')
    if m:
        n, u = int(m.group(1)), _plano(m.group(2))
    else:
        m = _AGO.search(rel or '')
        if not m:
            return None
        n, u = int(m.group(1)), {'second': 's', 'minute': 'min', 'hour': 'h', 'day': 'd', 'week': 'sem',
                                 'month': 'mes', 'year': 'a'}[m.group(2).lower()]
    if u.startswith(('s', 'mi', 'h')) and not u.startswith('sem'):
        a, b = 0, 1
    elif u.startswith('d'):
        a, b = n, n + 1
    elif u.startswith('sem'):
        a, b = 7 * n, 7 * n + 6
    elif u.startswith('m'):
        a, b = 28 * n, 31 * (n + 1) + 2   # ⚠️ el mes de YouTube no es fijo: mejor ancho que equivocado
    else:
        a, b = 365 * n - 7, 365 * (n + 1) + 7
    return hoy - dt.timedelta(days=b), hoy - dt.timedelta(days=a)


# ── leer un canal ────────────────────────────────────────────────────────────────────────────────────────────────────
def _con_fecha(o, out):
    """Como `videos._videos()`, pero se queda también con «hace 3 semanas». La otra parte de esa fila son las vistas:
    no se mira."""
    if isinstance(o, dict):
        lv = o.get('lockupViewModel')
        if lv and lv.get('contentId'):
            md = ((lv.get('metadata') or {}).get('lockupMetadataViewModel') or {})
            rel = None
            filas = (((md.get('metadata') or {}).get('contentMetadataViewModel') or {}).get('metadataRows')) or []
            for fila in filas:
                for parte in fila.get('metadataParts') or []:
                    txt = ((parte.get('text') or {}).get('content')) or ''
                    if _HACE.search(txt) or _AGO.search(txt):
                        rel = txt
            out.append((lv['contentId'], ((md.get('title') or {}).get('content')) or '', rel))
        vr = o.get('videoRenderer') or o.get('gridVideoRenderer')
        if vr and vr.get('videoId'):
            tit = ''.join(r.get('text', '') for r in (vr.get('title') or {}).get('runs') or [])
            out.append((vr['videoId'], tit, (vr.get('publishedTimeText') or {}).get('simpleText')))
        for v in o.values():
            _con_fecha(v, out)
    elif isinstance(o, list):
        for v in o:
            _con_fecha(v, out)


def _cliente(ver):
    # ⚠️ sin `hl` las páginas siguientes llegan en inglés («1 month ago»): se lee igual, pero así es una sola lengua
    return {'client': {'clientName': 'WEB', 'clientVersion': ver or '2.20241001', 'hl': 'es-419'}}


def bajar(cid, desde, hoy):
    """`(videos, ctx)`: la pestaña «Videos» del más nuevo al más viejo, hasta pasar `desde` (con margen)."""
    import requests
    s = requests.Session()
    d, txt = None, ''
    for intento in range(2):  # a veces la primera respuesta llega vacía: una segunda vuelta la trae
        r = s.get('https://www.youtube.com/channel/%s/videos' % cid, headers=V.H, cookies=V.CK, timeout=30)
        txt = r.content.decode('utf-8', 'replace')
        d = V._json_tras(txt, 'ytInitialData') if r.status_code == 200 else None
        out = []
        _con_fecha(d, out)
        if out:
            break
        time.sleep(3)
    if not d or not out:
        raise RuntimeError('la pestaña de videos no trajo nada (HTTP %s)' % r.status_code)
    key = re.search(r'"INNERTUBE_API_KEY":"([^"]+)"', txt)
    ver = re.search(r'"INNERTUBE_CLIENT_VERSION":"([^"]+)"', txt)
    nom = re.search(r'<meta property="og:title" content="([^"]*)"', txt)
    ctx = {'s': s, 'key': key.group(1) if key else None, 'ver': ver.group(1) if ver else None, 'pags': 1,
           'nombre': html.unescape(nom.group(1)) if nom else ''}
    tok = V._cont(d)
    while tok and ctx['key'] and ctx['pags'] < MAX_PAGINAS:
        ult = next((rango(x[2], hoy) for x in reversed(out) if x[2]), None)
        if ult and ult[1] < desde - dt.timedelta(days=MARGEN):
            break
        time.sleep(PAUSA)
        j = s.post('https://www.youtube.com/youtubei/v1/browse?key=' + ctx['key'], headers=V.H, timeout=30,
                   json={'context': _cliente(ctx['ver']), 'continuation': tok}).json()
        ctx['pags'] += 1
        antes = len(out)
        _con_fecha(j, out)
        tok = V._cont(j)
        if len(out) == antes:
            break
    # 🗓️ la lista pública da la fecha exacta de los 15 más nuevos (y nada más se toma de ahí)
    time.sleep(PAUSA)
    exactas = {}
    try:
        V.nuevos(cid)
        for v, x in list(V._META.items()):
            exactas[v] = _dia_et(x[0])
    except Exception:  # noqa: BLE001 — sin la lista pública quedan las fechas aproximadas
        pass
    vistos, videos = set(), []
    for v, t, rel in out:
        if v not in vistos:
            vistos.add(v)
            videos.append({'v': v, 't': t, 'rel': rel, 'ex': exactas.get(v)})
    return videos, ctx


def publicada(ctx, vid):
    """El día exacto en que se publicó un video: el reproductor lo dice en ~17 KB (la página entera pesa 1,4 MB)."""
    if not ctx.get('key'):
        return None
    time.sleep(PAUSA)
    j = ctx['s'].post('https://www.youtube.com/youtubei/v1/player?key=' + ctx['key'], headers=V.H, timeout=30,
                      json={'context': _cliente(ctx['ver']), 'videoId': vid}).json()
    return _dia_et((((j.get('microformat') or {}).get('playerMicroformatRenderer') or {}).get('publishDate')))


# ── de títulos a eventos ─────────────────────────────────────────────────────────────────────────────────────────────
def _fechas(videos, hoy):
    """Cada video con `lo`/`hi` (el rango posible) y `ex` (exacta). Sin fecha, la de sus vecinos: la lista va en orden."""
    for v in videos:
        r = (v['ex'], v['ex']) if v.get('ex') else rango(v.get('rel'), hoy)
        v['lo'], v['hi'] = r if r else (None, None)
    prev_hi = hoy
    for v in videos:
        if v['hi'] is None:
            v['hi'] = prev_hi
        prev_hi = v['hi']
    next_lo = None
    for v in reversed(videos):
        if v['lo'] is None:
            v['lo'] = next_lo or (v['hi'] - dt.timedelta(days=60))
            v['sin_fecha'] = True
        next_lo = v['lo']


def _punto(v):
    if v.get('ex'):
        return v['ex']
    return v['lo'] + (v['hi'] - v['lo']) // 2


def _partible(fs, conocidos):
    """¿Se parte en dos o más nombres que ya batallaron solos? «EL BARTO BTI» = «EL BARTO» + «BTI»."""
    n = len(fs)
    if n < 2:
        return False
    ok = [True] + [False] * n
    for i in range(n):
        if ok[i]:
            for j in range(i + 1, n + 1):
                if (i, j) != (0, n) and fs[i:j] in conocidos:
                    ok[j] = True
    return ok[n]


def _medio_conocido(fs, conocidos):
    """Empieza o termina con alguien que batalló solo («BASEK RAPTOR»): una pista de dupla, no una prueba.
    ⚠️ Un nombre de una sola letra no es pista: con «G» (Costa Rica) conocido, «G DICHT» y «ORIGINAL G» (Chile)
    pasaban por duplas y se caía el evento entero de Gladiadores del Puerto."""
    for k in range(1, len(fs)):
        if any(p in conocidos and len(''.join(p)) > 1 for p in (fs[:k], fs[k:])):
            return True
    return False


def _tiene(fs, nombre):
    k = len(nombre)
    return k > 0 and any(fs[i:i + k] == nombre for i in range(len(fs) - k + 1))


def _tipo(canal, ev):
    """`(tipo, pais, pais_sin_bandera)` de un evento: las reglas del canal, en orden, sobre su nombre."""
    pl = ' '.join(_fichas(ev['nombre']))
    tipo = pais = psb = None
    t_ok = p_ok = s_ok = False
    for r in canal.get('reglas') or []:
        if not any(' '.join(_fichas(w)) and re.search(r'\b%s\b' % re.escape(' '.join(_fichas(w))), pl)
                   for w in r.get('si') or []):
            continue
        if not t_ok and 'tipo' in r:
            tipo, t_ok = r['tipo'], True
        if not p_ok and 'pais' in r:
            pais, p_ok = r['pais'], True
        if not s_ok and 'pais_sin_bandera' in r:
            psb, s_ok = bool(r['pais_sin_bandera']), True
    if not t_ok:
        tipo = canal.get('tipo')
    if not p_ok:
        # la bandera del nombre del evento manda sobre la del canal; con dos banderas es binacional
        bs = ev['banderas']
        pais = bs[0] if len(bs) == 1 else None if len(bs) > 1 else canal.get('pais')
        if len(bs) > 1:
            psb, s_ok = False, True
    if not s_ok:
        psb = bool(canal.get('pais_sin_bandera'))
    return tipo, (pais or None), psb


def _campeon(fin, titulos, ev_fs):
    """El campeón, si otro título del canal lo nombra junto al evento («MECHA Y SU CAMINO AL TÍTULO | Argentina…»)."""
    na, nb = _fichas(fin['a']['nombre']), _fichas(fin['b']['nombre'])
    for t in titulos:
        p = _plano(t)
        if not _CAMPEON.search(p) or V._VS.search(t):
            continue
        fs = _fichas(t)
        if not set(ev_fs) <= set(fs):
            continue
        a, b = _tiene(fs, na), _tiene(fs, nb)
        if a != b:
            return ('a' if a else 'b'), t
    return None, None


def _canal(canal, videos, exacta, hoy, desde, hasta, conocidos):
    """Las batallas de un canal y su resumen. `exacta(video)` pregunta el día exacto de publicación."""
    _fechas(videos, hoy)
    res = {'eventos': [], 'saltadas': {}, 'avisos': [], 'exactas': 0, 'aprox': []}
    salta = res['saltadas']

    def contar(m, n=1):
        salta[m] = salta.get(m, 0) + n

    def en_ventana(v):
        return not (v['hi'] < desde or v['lo'] > hasta)

    titulos = [v['t'] for v in videos]
    grupos = {}
    for v in videos:
        x = v['x']
        if x['motivo'] == 'no_batalla' and not x['lados']:
            if en_ventana(v):
                contar('no_batalla')
            continue
        fs = _fichas(x['evento'] or canal['nombre'], sin_anio=True)
        grupos.setdefault(''.join(fs), {'fs': fs, 'v': []})['v'].append(v)

    # 🗓️ el día exacto del video más viejo de cada evento: decide si el evento entra en la ventana
    def a_refinar():
        cola = []
        for g in grupos.values():
            # sólo los eventos que pueden aportar algo: preguntar por un clip o una exhibición es gastar un pedido
            if not any(v['x']['motivo'] is None for v in g['v']) or all(v.get('ex') for v in g['v']):
                continue
            viejo = min(g['v'], key=lambda v: (v['hi'], v['lo']))
            if viejo.get('ex') or viejo['hi'] < desde or viejo['lo'] > hasta:
                continue
            duda = viejo['lo'] < desde <= viejo['hi'] or viejo['lo'] <= hasta < viejo['hi']
            cola.append((0 if duda else 1, -viejo['hi'].toordinal(), viejo, g))
        cola.sort(key=lambda c: c[:2])
        return cola
    hechas = set()
    while res['exactas'] < MAX_EXACTAS:
        cola = [c for c in a_refinar() if c[2]['v'] not in hechas]
        if not cola:
            break
        _, _, v, g = cola[0]
        hechas.add(v['v'])
        try:
            d = exacta(v['v'])
        except Exception:  # noqa: BLE001 — sin el reproductor queda la fecha aproximada
            d = None
        res['exactas'] += 1
        if not d:
            continue
        # los videos del mismo evento con la misma fecha relativa se subieron juntos: toman ese día. Se compara el
        # rango y no el texto: «hace 1 m» (primera página) y «hace 1 mes» (las siguientes) son lo mismo
        caja = (v['lo'], v['hi'])
        for w in g['v']:
            if w is v or (not w.get('ex') and (w['lo'], w['hi']) == caja):
                w['ex'], w['lo'], w['hi'] = d, d, d
                w['derivada'] = w is not v

    # dos ediciones con el mismo nombre («Golden Age») se separan por la fecha
    eventos = []
    for g in grupos.values():
        vs = sorted(g['v'], key=_punto)
        tanda = [vs[0]]
        for v in vs[1:]:
            if (_punto(v) - _punto(tanda[-1])).days > JUNTOS:
                eventos.append((g['fs'], tanda))
                tanda = []
            tanda.append(v)
        eventos.append((g['fs'], tanda))
    vistos_slug = {}

    # una dupla que no dice serlo: «DEM ROOKIES» cuando el canal tiene «DEM ROOKIES DUPLAS»
    con_equipos = [fs for fs, _t in eventos if _EQUIPOS.search(' '.join(fs))]

    batallas = []
    for fs, vs in eventos:
        viejo = min(vs, key=_punto)
        fecha = _punto(viejo)
        nombre = max((v['x']['evento'] for v in vs), key=len) or canal['nombre']
        ev = {'nombre': nombre, 'banderas': sorted({b for v in vs for b in v['x']['banderas']})}
        anios = {int(a) for v in vs for a in _ANIO.findall(_plano(v['x']['evento']))}
        con_vs = [v for v in vs if v['x']['lados']]
        if fecha < desde or fecha > hasta or (anios and max(anios) < desde.year) or (anios and min(anios) > hasta.year):
            contar('fuera', len(con_vs))
            continue
        tipo, pais, psb = _tipo(canal, ev)
        pl = ' '.join(fs)
        equipo = bool(_EQUIPOS.search(_plano(nombre))) or any(
            re.search(r'\b%s\b' % re.escape(' '.join(_fichas(w))), pl) for w in canal.get('equipos') or [])
        equipo = equipo or any(set(fs) < set(f2) and all(_EQUIPOS.fullmatch(z) for z in set(f2) - set(fs))
                               for f2 in con_equipos)
        # la pista de dupla, sumada en todo el evento: con un 40 % de batallas así, el evento es de equipos
        pistas = sum(1 for v in con_vs if v['x']['motivo'] == 'equipos' or any(
            _medio_conocido(_fichas(lado[0][0]), conocidos) for lado in v['x']['lados'] if len(lado) == 1))
        equipo = equipo or (pistas >= 3 and pistas >= 0.4 * len(con_vs))
        cuenta = {}
        suyos = []
        for v in con_vs:
            x = v['x']
            m = x['motivo']
            if m is None and (equipo or any(_partible(_fichas(lado[0][0]), conocidos) for lado in x['lados'])):
                m = 'equipos'
            if m is None and tipo is None:
                m = 'sin_tipo'
            if m:
                cuenta[m] = cuenta.get(m, 0) + 1
                continue
            suyos.append(v)
        for m, n in cuenta.items():
            contar(m, n)
        # quién siguió en carrera: también los batallones y los de a tres con ronda, que son de a uno
        aparece = {}
        if not equipo:
            for v in con_vs:
                if v['x']['aparece'] and not any(_partible(_fichas(n), conocidos) for n in v['x']['sueltos']):
                    for n in v['x']['sueltos']:
                        aparece.setdefault(v['x']['ronda'], set()).add(claves.clave(n))
        slug = re.sub(r'[^a-z0-9]+', '-', _plano(nombre)).strip('-')[:60] or 'evento'
        vistos_slug[slug] = vistos_slug.get(slug, 0) + 1
        if vistos_slug[slug] > 1:
            slug += '-' + fecha.isoformat()[:7]
        info = {'nombre': nombre, 'tipo': tipo, 'pais': pais, 'fecha': fecha.isoformat(),
                'aprox': not (viejo.get('ex')), 'batallas': 0, 'ganadores': 0, 'final': None}
        if not suyos:
            if tipo is None and cuenta.get('sin_tipo'):
                res['avisos'].append('%s: «%s» no tiene tipo (ninguna regla lo reconoce): %d batalla(s) afuera'
                                     % (canal['nombre'], nombre, cuenta['sin_tipo']))
            continue
        if info['aprox']:
            res['aprox'].append('%s (~%s, de «%s»)' % (nombre, info['fecha'], viejo.get('rel') or 'sin fecha'))
        visto_par = set()
        for v in sorted(suyos, key=lambda v: ORDEN.get(v['x']['ronda'], 9)):
            x = v['x']
            (na, ia), (nb, ib) = x['lados'][0][0], x['lados'][1][0]
            ka, kb = claves.clave(na), claves.clave(nb)
            if ka == kb or (frozenset((ka, kb)), x['ronda']) in visto_par:
                contar('repetida')
                continue
            visto_par.add((frozenset((ka, kb)), x['ronda']))
            r = x['ronda']
            gana = None
            if r in ORDEN and r != 'final':
                despues = set()
                for rr, s in aparece.items():
                    if rr in ORDEN and ORDEN[rr] > ORDEN[r]:
                        despues |= s
                a_in, b_in = ka in despues, kb in despues
                if a_in != b_in:
                    gana = 'a' if a_in else 'b'
                elif not a_in and r == 'semifinal' and aparece.get('tercer'):
                    # quien juega por el tercer puesto perdió la semi
                    ta, tb = ka in aparece['tercer'], kb in aparece['tercer']
                    if ta != tb:
                        gana = 'b' if ta else 'a'
                elif a_in and b_in:
                    res['avisos'].append('%s · %s: %s y %s siguen los dos después de %s, sin ganador'
                                         % (canal['nombre'], nombre, na, nb, r))

            def persona(n, iso):
                return {'nombre': n, 'id': 'yt:' + claves.clave(n), 'pais': iso or (pais if psb else None)}
            b = {'id': 'yt:' + v['v'], 'fuente': 'youtube', 'url': VER + v['v'],
                 'evento': {'id': 'yt-%s-%s' % (canal['slug'], slug), 'nombre': nombre, 'tipo': tipo,
                            'pais': pais, 'fecha': info['fecha']},
                 'ronda': r, 'a': persona(na, ia), 'b': persona(nb, ib), 'gana': gana,
                 'replica': None, 'votos': None, 'pts': None}
            if r == 'final':
                g, de = _campeon(b, titulos, fs)
                if g:
                    b['gana'] = g
                    info['final'] = 'campeón %s, según «%s»' % (b[g]['nombre'], de)
                else:
                    info['final'] = 'sin ganador: ningún título dice quién fue campeón (%s vs %s)' % (na, nb)
            batallas.append(b)
            info['batallas'] += 1
            info['ganadores'] += b['gana'] is not None
        res['eventos'].append(info)
    return batallas, res


# ── todo junto ───────────────────────────────────────────────────────────────────────────────────────────────────────
def _config():
    with io.open(CANALES, encoding='utf-8') as f:
        cfg = json.load(f)
    for c in cfg.get('canales') or []:
        c.setdefault('slug', re.sub(r'[^a-z0-9]+', '-', _plano(c.get('nombre') or c['id'])).strip('-'))
        c.setdefault('nombre', c['id'])
    return cfg


def _casos():
    out = {}
    for ruta in sorted(glob.glob(os.path.join(CASOS, 'youtube_*.json'))):
        with io.open(ruta, encoding='utf-8') as f:
            c = json.load(f)
        out[c['canal']] = c
    return out


def correr(desde='2026-09-22', hasta='2026-12-31', red=True, solo=None):
    """`(resultado, resumen)`. `resumen` es por canal, para `--ver`; `leer()` devuelve sólo el resultado."""
    d0, d1 = _dia(desde), _dia(hasta)
    if d0 is None or d1 is None:
        from comun import temporada
        a, b = temporada.FECHAS[temporada.ACTUAL]
        d0, d1 = d0 or _dia(a), d1 or _dia(b)
    cfg = _config()
    casos = {} if red else _casos()
    avisos, resumen, leidos = [], {}, []
    for c in cfg.get('canales') or []:
        if solo and c['slug'] not in solo:
            continue
        resumen[c['slug']] = {'nombre': c['nombre'], 'pais': c.get('pais'), 'error': None}
        if red:
            hoy = dt.datetime.now(ET).date()
            try:
                vs, ctx = bajar(c['id'], d0, hoy)
            except Exception as e:  # noqa: BLE001 — un canal caído no tumba a los demás
                resumen[c['slug']]['error'] = '%s: %s' % (type(e).__name__, str(e)[:120])
                avisos.append('%s: no pude leerlo (%s)' % (c['nombre'], resumen[c['slug']]['error']))
                continue
            resumen[c['slug']].update(yt=ctx.get('nombre'), pags=ctx.get('pags'), videos=len(vs))
            leidos.append((c, vs, (lambda vid, ctx=ctx: publicada(ctx, vid)), hoy))
            time.sleep(PAUSA)
        else:
            caso = casos.get(c['id'])
            if not caso:
                del resumen[c['slug']]
                continue
            hoy = _dia(caso['hoy'])
            vs = [{'v': v[0], 't': v[1], 'rel': v[2], 'ex': _dia(v[3]) if len(v) > 3 else None}
                  for v in caso['videos']]
            rep = {k: _dia(x) for k, x in (caso.get('reproductor') or {}).items()}
            resumen[c['slug']].update(yt=caso.get('nombre_yt'), pags=0, videos=len(vs))
            leidos.append((c, vs, (lambda vid, rep=rep: rep.get(vid)), hoy))

    # los nombres que batallaron solos, en todos los canales: con ellos se reconoce una dupla que no lo dice
    conocidos = set()
    for c, vs, _, _ in leidos:
        for v in vs:
            v['x'] = leer_titulo(v['t'], c)
            conocidos |= {_fichas(n) for n in v['x']['sueltos'] if _fichas(n)}

    batallas, finales, detalles, de_canal = [], [], [], {}
    for c, vs, exacta, hoy in leidos:
        bs, r = _canal(c, vs, exacta, hoy, d0, d1, conocidos)
        resumen[c['slug']].update(r)
        for b in bs:
            de_canal[b['id']] = c['slug']
        batallas.extend(bs)
        detalles.extend(r['avisos'])
        for e in r['eventos']:
            if e['final']:
                finales.append('%s · %s: la final, %s' % (c['nombre'], e['nombre'], e['final']))

    # la misma batalla subida por dos canales cuenta una vez (se queda la del canal que va primero en la lista)
    unicas, ya = [], {}
    for b in batallas:
        k = (frozenset((claves.clave(b['a']['nombre']), claves.clave(b['b']['nombre']))), b['ronda'])
        d = _dia(b['evento']['fecha'])
        if any(abs((d - d2).days) <= 3 for d2 in ya.get(k, [])):
            sal = resumen[de_canal[b['id']]]['saltadas']
            sal['repetida'] = sal.get('repetida', 0) + 1
            continue
        ya.setdefault(k, []).append(d)
        unicas.append(b)
    for s in resumen.values():
        s.update(n=0, g=0, ev=set())
    for b in unicas:
        s = resumen[de_canal[b['id']]]
        s['n'] += 1
        s['g'] += b['gana'] is not None
        s['ev'].add(b['evento']['id'])

    # ⚠️ en la duda, dos perfiles: el mismo nombre con dos países distintos son dos personas
    paises = {}
    for b in unicas:
        for lado in ('a', 'b'):
            p = b[lado]
            paises.setdefault(claves.clave(p['nombre']), set()).add(p['pais'])
    for b in unicas:
        for lado in ('a', 'b'):
            p = b[lado]
            k = claves.clave(p['nombre'])
            if len(paises[k] - {None}) > 1 and p['pais']:
                p['id'] = 'yt:%s-%s' % (k, p['pais'])
    dobles = sorted(k for k, ps in paises.items() if len(ps - {None}) > 1)

    lineas = []
    for slug, s in resumen.items():
        if s.get('error'):
            continue
        sal = s.get('saltadas') or {}
        lineas.append('%s: %d batalla(s) en %d evento(s), %d con ganador · saltadas: %s' % (
            s['nombre'], s['n'], len(s['ev']), s['g'],
            ', '.join('%s %d' % (_MOTIVO.get(m, m), n) for m, n in sorted(sal.items(), key=lambda kv: -kv[1]))
            or 'nada'))
        if s.get('aprox'):
            lineas.append('%s: fecha aproximada (sólo la de la pestaña, sin la exacta): %s'
                          % (s['nombre'], '; '.join(s['aprox'])))
    if dobles:
        avisos.append('mismo nombre con dos países, van como dos personas: ' + ', '.join(dobles[:12]))
    avisos = avisos + lineas + finales + detalles
    return {'batallas': unicas, 'mvp': [], 'avisos': avisos}, resumen


_MOTIVO = {'no_batalla': 'no son batallas (clips, compilados, shorts)', 'equipos': 'de equipos',
           'varios': 'de a tres o más', 'formato': 'batallón/muerte súbita/exhibición', 'sin_ronda': 'sin ronda',
           'sin_tipo': 'sin tipo', 'fuera': 'fuera de la ventana', 'repetida': 'repetidas'}


def leer(desde='2026-09-22', hasta='2026-12-31', red=True):
    """Returns {'batallas': [...], 'mvp': [], 'avisos': [...]} for battles dated within [desde, hasta]."""
    return correr(desde, hasta, red)[0]


# ── self-check ───────────────────────────────────────────────────────────────────────────────────────────────────────
def _self_check():
    mal = []

    def ok(cond, que):
        if not cond:
            mal.append(que)

    # las piezas
    ok(_ronda(_plano('🥇GRAN FINAL'))[0] == 'final', 'la ronda con un emoji adelante')
    ok(_ronda(_plano('Semifinal Regional Coquimbo'))[0] == 'semifinal', 'la ronda con el evento pegado')
    ok(_ronda(_plano('CUARTOS DE FINAL DEM DUPLAS 2026'))[0] == 'cuartos', '«cuartos de final» no es «final»')
    ok(_ronda(_plano('8vos de Final Torneo De Plazas'))[0] == 'octavos', '«8vos de final»')
    ok(_ronda(_plano('Finalistas del año'))[0] is None, '«finalistas» no es una ronda')
    hoy = dt.date(2026, 11, 20)
    ok(rango('hace 3 sem.', hoy) == (dt.date(2026, 10, 24), dt.date(2026, 10, 30)), 'hace 3 sem.')
    ok(rango('hace 1 m', hoy)[0] <= dt.date(2026, 9, 22) <= rango('hace 1 m', hoy)[1], '«hace 1 m» es un mes')
    ok(rango('2 weeks ago', hoy) == rango('hace 2 semanas', hoy), 'en inglés también')
    x = leer_titulo('NIZER vs. NAZION: Semifinal - DEM Puerto Varas 2026')
    ok(x['motivo'] is None and x['ronda'] == 'semifinal' and x['evento'] == 'DEM Puerto Varas 2026'
       and [l[0][0] for l in x['lados']] == ['NIZER', 'NAZION'], 'el formato de DEM: %r' % x)
    x = leer_titulo('JOTAKA vs ARIES - Semifinal Regional Coquimbo | Red Bull Batalla 2026')
    ok(x['evento'] == 'Red Bull Batalla 2026 · Regional Coquimbo', 'el evento junta lo que sobra de la ronda: %r'
       % x['evento'])
    x = leer_titulo('🥇GRAN FINAL: REYES vs MZETA - Liga Inmortal cupo a @esurbanofree 🇨🇱')
    ok(x['ronda'] == 'final' and x['banderas'] == ['cl'] and x['evento'] == 'Liga Inmortal cupo a esurbanofree',
       'la ronda antes de la batalla: %r' % x)
    x = leer_titulo('Ajabaraja vs Balam (octavos rumbo a FMS under)')
    ok(x['ronda'] == 'octavos' and x['lados'][1][0][0] == 'Balam', 'la ronda entre paréntesis: %r' % x)
    x = leer_titulo('| FECHA 11 | PERROS DE TRABA FREESTYLE-RAP | 2026 | WHITE vs ABC | SEMIFINAL |')
    ok(x['motivo'] is None and x['ronda'] == 'semifinal'
       and x['evento'] == 'FECHA 11 · PERROS DE TRABA FREESTYLE-RAP · 2026', 'el evento delante de la batalla: %r' % x)
    x = leer_titulo('KG 🇵🇪 VS NAHUAL DEXO 🇲🇽 - FINAL INTERNACIONAL | Supremacía Mc Internacional 2026')
    ok(x['ronda'] == 'final' and x['evento'] == 'Supremacía Mc Internacional 2026'
       and x['lados'] == [[('KG', 'pe')], [('NAHUAL DEXO', 'mx')]], 'Supremacía: %r' % x)
    for t, m in (('DESTELLO + Fusok/El Barto vs. NAZION + Tenaz/Nizer: LA FINAL 🏆 - DEM PUERTO VARAS 2026', 'equipos'),
                 ('GASPER y JOTA SHOY vs NEKROOS y ALMENDRADES | Exhibición | Red Bull Batalla', 'formato'),
                 ('XPLAIN vs ENMA 🇦🇷 vs JC SNAKE: 8vos: DEM Perú 🇵🇪 x LZ - Fecha 8', 'varios'),
                 ('SOPHIA PARKER vs ABEL PAL PISO | FINAL DEM DUPLAS 2026', 'equipos'),
                 ('ARI CARRILLO 🇲🇽 VS FLAMA 🇨🇴 - Muerte Súbita | Supremacía Mc Internacional 2026', 'formato'),
                 ('(BATALLÓN) MZETA vs LETRAO: Semifinal - Liga Inmortal Cupo a @esurbanofree  🇨🇱', 'formato'),
                 ('GAZIR vs ACZINO - GAZIR CONTRA TODOS | Red Bull Batalla', 'formato'),
                 ('LAS MEJORES RIMAS DE LAS REGIONALES CHILE 2026 | Red Bull Batalla', 'no_batalla'),
                 ('NECIA PAPICHA vs STICK KATACRIST: Semis: DEM Perú 🇵🇪 2vs2 Ayacucho x Raptablo', 'equipos'),
                 ('DONCKAN  🇧🇴 VS ARI CARRILLO 🇲🇽 - Prueba de cobardía | Supremacía Mc Internacional 2026', 'sin_ronda'),
                 ('Tenaz vs Kaitos - Exhibición - Golden Age', 'formato')):
        ok(leer_titulo(t)['motivo'] == m, '«%s» tendría que ser %s y es %s' % (t[:50], m, leer_titulo(t)['motivo']))
    ok(leer_titulo('(BATALLÓN) MZETA vs LETRAO: Semifinal - Liga Inmortal')['aparece'], 'un batallón sigue el cuadro')
    ok(_partible(('el', 'barto', 'bti'), {('el', 'barto'), ('bti',)}) and not _partible(('bti',), {('bti',)}),
       'una dupla que no lo dice')
    ok(_medio_conocido(('basek', 'raptor'), {('basek',)}) and not _medio_conocido(('g', 'dicht'), {('g',)}),
       'un nombre de una letra no es pista de dupla')

    # los casos reales
    r, resumen = correr('2026-09-22', '2026-12-31', red=False)
    bs = r['batallas']
    ok(set(r) == {'batallas', 'mvp', 'avisos'} and r['mvp'] == [], 'la forma de la respuesta')
    for b in bs:
        ok(b['ronda'] in ('filtro', '32avos', '16avos', 'octavos', 'cuartos', 'semifinal', 'tercer', 'final'),
           'ronda fuera del diccionario: %r' % b['ronda'])
        ok(b['id'] == 'yt:' + b['url'].split('=')[1] and b['fuente'] == 'youtube', 'el id es el del video')
        ok(b['a']['id'].startswith('yt:') and b['gana'] in ('a', 'b', None), 'los lados')
        ok('2026-09-22' <= b['evento']['fecha'] <= '2026-12-31', 'fuera de la ventana: %r' % b['evento'])
        ok(set(b) == {'id', 'fuente', 'url', 'evento', 'ronda', 'a', 'b', 'gana', 'replica', 'votos', 'pts'},
           'campos de una batalla')

    def una(a, b_, ronda=None):
        for b in bs:
            if {b['a']['nombre'], b['b']['nombre']} == {a, b_} and (ronda is None or b['ronda'] == ronda):
                return b
        return None

    def ganador(b):
        return b and b['gana'] and b[b['gana']]['nombre']
    if 'supremacia' in resumen:
        f = una('KG', 'NAHUAL DEXO', 'final')
        ok(f and f['gana'] is None and f['evento']['tipo'] == 'independiente' and f['a']['pais'] == 'pe',
           'Supremacía: la final sin campeón dicho queda sin ganador: %r' % f)
        ok(ganador(una('KG', 'LOZZ', 'semifinal')) == 'KG', 'quien llega a la final ganó la semi')
        ok(ganador(una('VITI', 'KG', 'cuartos')) == 'KG', 'y los cuartos')
        ok(ganador(una('FLAMA', 'KG', 'octavos')) == 'KG', 'y los octavos, saltando rondas')
        ok(ganador(una('EROS', 'LOZZ', 'cuartos')) == 'LOZZ', 'EROS sin bandera también es EROS')
        ok(not una('ARI CARRILLO', 'FLAMA'), 'la muerte súbita no entra')
        ok(not any('2024' in b['evento']['nombre'] for b in bs), 'lo de 2024 queda afuera')
        ok(f and f['evento']['pais'] is None, 'el internacional no es de un país')
    if 'redbull' in resumen:
        f = una('MARITHEA', 'HORUS', 'final')
        ok(f and ganador(f) == 'MARITHEA' and f['evento']['tipo'] == 'rb_nacional' and f['evento']['pais'] == 'co'
           and f['a']['pais'] == 'co', 'Red Bull Colombia: campeona por «SU CAMINO AL TÍTULO»: %r' % f)
        s = una('VUSCOOH', 'AFAX', 'semifinal')
        ok(ganador(s) == 'VUSCOOH' and s['evento']['tipo'] == 'rb_regional', 'la regional y su semi: %r' % s)
        t = una('ARIES', 'AFAX', 'tercer')
        ok(t and t['gana'] is None, 'el tercer puesto queda sin ganador')
        ok(not any('GAZIR' in (b['a']['nombre'], b['b']['nombre']) for b in bs if 'contra' in b['evento']['nombre'].lower()),
           'Gazir contra todos no es un torneo')
        ok(ganador(una('1TOBI', 'MECHA', 'final')) == 'MECHA', 'Red Bull Argentina: campeón por su título')
        ok(s and s['evento']['pais'] == 'cl' and s['a']['pais'] == 'cl', 'la regional de Coquimbo es de Chile')
        # «hace 2 meses» cae a los dos lados del 22/09: el reproductor dice que fue antes, y queda afuera
        ok(not any('Perú' in b['evento']['nombre'] or 'Plazas' in b['evento']['nombre'] for b in bs
                   if b['evento']['id'].startswith('yt-redbull-')), 'el nacional de Perú fue antes de la ventana')
        ok(resumen['redbull']['exactas'] <= MAX_EXACTAS, 'no pide más fechas exactas que el tope')
    if 'dem-peru' in resumen:
        ok(not any('Halloween' in b['evento']['nombre'] for b in bs), 'el Halloween de DEM Perú es de equipos')
        s = una('GINO', 'PIER CDH', 'semifinal')
        ok(ganador(s) == 'GINO' and s['a']['pais'] == 'pe', 'DEM Perú x LZ: la semi y el país sin bandera: %r' % s)
        f = una('GINO', 'ERREKA', 'final')
        ok(f and f['b']['pais'] == 'cl', 'la bandera manda sobre el país del canal')
        # sus videos dicen «hace 1 m» (del 17/09 al 23/10): el reproductor dice 25/09, y entra
        ok(f and f['evento']['fecha'] == '2026-09-25', 'la fecha exacta del borde de la ventana: %r' % (f and f['evento']))
    if 'inmortal' in resumen:
        ok(not any('Multiverse' in b['evento']['nombre'] for b in bs), 'el Multiverse es de equipos')
        f = una('ERREKA', 'AXIOMA', 'final')
        ok(f and f['evento']['pais'] is None and f['a']['pais'] is None, 'un evento con dos banderas es binacional')
        ok(ganador(una('MZETA', 'STEREO', 'cuartos')) == 'MZETA', 'el batallón de la semi también sigue el cuadro')
    if 'dem' in resumen:
        ok(not any('Secret Wars' in b['evento']['nombre'] or 'ROOKIES' in b['evento']['nombre'].upper() for b in bs),
           'Secret Wars y Rookies son de duplas')
    sal = {}
    for s in resumen.values():
        for m, n in (s.get('saltadas') or {}).items():
            sal[m] = sal.get(m, 0) + n
    ok(sal.get('formato') and sal.get('equipos') and sal.get('varios') and sal.get('fuera'),
       'cuenta lo que salta: %r' % sal)
    ok(any('saltadas' in a for a in r['avisos']), 'los avisos dicen qué se saltó')
    # en la duda, dos perfiles
    abel = {b[l]['id'] for b in bs for l in 'ab' if claves.clave(b[l]['nombre']) == 'abel'}
    if len({b[l]['pais'] for b in bs for l in 'ab' if claves.clave(b[l]['nombre']) == 'abel'} - {None}) > 1:
        ok(len(abel) > 1, 'dos ABEL de países distintos son dos ids: %r' % abel)
    for m in mal:
        print('🔴', m)
    print('✅ global_fuente_youtube: bien (%d batallas de %d canales de prueba)' % (len(bs), len(resumen))
          if not mal else '🔴 global_fuente_youtube: %d problemas' % len(mal))
    return 1 if mal else 0


def _ver():
    from comun import temporada
    d0, d1 = temporada.FECHAS[temporada.ACTUAL]
    solo = [a for a in sys.argv[1:] if not a.startswith('--')] or None
    r, resumen = correr(d0, d1, red=True, solo=solo)
    print('🎬 YouTube · ventana %s → %s\n' % (d0, d1))
    for slug, s in resumen.items():
        if s.get('error'):
            print('🔴 %-28s no pude leerlo: %s' % (s['nombre'], s['error']))
            continue
        print('%-30s [%s] en YouTube «%s» · %s pág, %s videos, %d fechas exactas pedidas'
              % (s['nombre'], s.get('pais') or '--', s.get('yt') or '?', s.get('pags'), s.get('videos'),
                 s.get('exactas', 0)))
        print('   %d evento(s), %d batalla(s), %d con ganador · saltadas: %s' % (
            len(s['ev']), s['n'], s['g'],
            ', '.join('%s %d' % (m, n) for m, n in sorted((s.get('saltadas') or {}).items(), key=lambda kv: -kv[1]))
            or 'nada'))
        for e in s.get('eventos') or []:
            print('   · %-52s %-16s %s %s%s  %2d batallas, %2d con ganador' % (
                e['nombre'][:52], e['tipo'], e['pais'] or '--', e['fecha'], '~' if e['aprox'] else ' ',
                e['batallas'], e['ganadores']))
        print()
    print('avisos:')
    for a in r['avisos']:
        print('  ⚠️', a)
    return 0


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if '--auto' in sys.argv:
        sys.exit(_self_check())
    if '--ver' in sys.argv:
        sys.exit(_ver())
    print(__doc__)
