# -*- coding: utf-8 -*-
"""🌍 FMS COMO FUENTE DEL RANKING GLOBAL: cada batalla de las ligas FMS, con jueces, réplica y puntos.

    python bot/global_fuente_fms.py --ver     lee en vivo: batallas por liga y jornada, unas de muestra, MVP y avisos
    python bot/global_fuente_fms.py --auto    self-check, sin red (con bot/global_casos/fms_*.html)

Tres pedidos por corrida, con un segundo entre uno y otro (corre una vez por semana):
  1. fms.tv/resultados — TODAS las batallas de la temporada, en una sola página.
  2. la API de MCs de fms.tv — el id numérico, el nombre, la liga y dónde nació cada oficial.
  3. la API de urbanroosters.news — los posts «Así fueron las votaciones…»: el nombre de los Extra Players y el MVP.

Lo que se midió el 20/11/2026 y explica el código:

⚠️ LA LIGA SÍ ESTÁ EN EL HTML: cada pestaña trae `data-league` (spain, argentina…). Lo que no la dice es el texto que
se ve, por eso parecía que había que adivinarla.

🔴 GANA QUIEN TIENE MÁS JUECES, NO MÁS PUNTOS. En 3 de las 66 batallas jugadas ganó el que sumó menos puntos (TOBI 3–1
Dyse con 144–146, Dybbuk 3–2 CTZ con 143–146, Urko 2–3 Visionario con 143–139), y urbanroosters da el mismo ganador.
`gana` es el que marca la página; los puntos van en `pts` y no deciden nada. Si vuelve a pasar, se avisa.

⚠️ `votos` SON JUECES A FAVOR, y un juez que empata no cuenta para nadie: por eso hay 4–0 y 3–1 con cinco jueces.

⚠️ LOS EXTRA PLAYERS NO TIENEN PERFIL PUBLICADO: su link es `?post_type=mcs&p=<id>` y la API no los devuelve, así que el
nombre sale de urbanroosters. Y el id 9083 (la foto «EXTRA-PLAYER») es un comodín: fue Lema, Pirry y el dúo del 2 contra
1. Un id con dos nombres no identifica a nadie, así que esa gente va con un id por nombre (`fms:nombre:<clave>`).

⚠️ URBANROOSTERS ESCRIBE A VECES LOS NOMBRES AL REVÉS DE LOS NÚMEROS («1Tobi vs Replik» con 127–135, que son de Replik y
1Tobi) y tiene erratas en los totales («143-239»). Se empareja por puntos —el total y la suma de los jueces— y se
orienta por los nombres que ya se conocen y por el ganador, nunca por el orden del título.

⚠️ NO VAN: la World Cup (país contra país: no hay a quién darle la batalla) y el 2 contra 1 (un lado son dos personas).
Se saltan y se avisa.

⚠️ EL PAÍS ES EL DE NACIMIENTO (`birth_place`), NO EL DE LA LIGA: Stuart es argentino y compite en Chile, Chuty es
español y compite en México.

🔑 SIN LA API DE MCs NO DEVUELVE NINGUNA BATALLA, a propósito: sin el id numérico la misma persona saldría con otro id y
el ranking le haría dos perfiles. Vacío, el ranking se queda con las batallas de la semana anterior y lo avisa.
"""
import collections
import datetime as dt
import html as _html
import io
import json
import os
import re
import sys
import time
import unicodedata
from html.parser import HTMLParser
from urllib.parse import parse_qs, unquote, urlparse

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from comun import claves  # noqa: E402

URL_RESULTADOS = 'https://fms.tv/resultados/'
URL_MCS = 'https://fms.tv/wp-json/wp/v2/mcs'
URL_UR = 'https://urbanroosters.news/wp-json/wp/v2/posts'
UA = 'Mozilla/5.0 (compatible; ranking-bot/1.0)'
TIMEOUT = 30
PAUSA = 1.1        # segundos entre pedidos: nunca dos en el mismo segundo
MAX_PAGINAS = 3    # de cada API; con la ventana de una temporada alcanza con una
CASOS = os.path.join(SCR, 'global_casos')

# `data-league` de fms.tv -> (código para los ids, país de la liga, número de temporada en la 2026/27).
# ⚠️ El número no está en la página de resultados: sale de fms.tv y de los títulos de urbanroosters (20/11/2026). Cada
# liga sube uno por año, así que la 2027/28 es este + 1. Sin número, el id lleva la temporada («fms-pe-2026-27-j1»).
LIGAS = {
    'spain': ('es', 'es', 9), 'argentina': ('ar', 'ar', 8), 'chile': ('cl', 'cl', 7),
    'mexico': ('mx', 'mx', 7), 'colombia': ('co', 'co', 5),
    'peru': ('pe', 'pe', None), 'brasil': ('br', 'br', None), 'caribe': ('caribe', None, None),
    'internacional': ('int', None, None), 'fmsws': ('ws', None, None), 'fswc': ('wc', None, None),
}
SELECCIONES = {'fswc'}  # la Freestyle World Cup: se anota país contra país

# Cómo nombra urbanroosters a cada liga en sus títulos. En orden: «FMS World Series – Jornada 4 Colombia» es World Series.
LIGAS_UR = (('world series', 'fmsws'), ('world cup', 'fswc'), ('internacional', 'internacional'),
            ('espana', 'spain'), ('argentina', 'argentina'), ('chile', 'chile'), ('mexico', 'mexico'),
            ('colombia', 'colombia'), ('peru', 'peru'), ('brasil', 'brasil'), ('caribe', 'caribe'))

PAISES = {'espana': 'es', 'argentina': 'ar', 'chile': 'cl', 'mexico': 'mx', 'colombia': 'co', 'peru': 'pe',
          'venezuela': 've', 'cuba': 'cu', 'republica dominicana': 'do', 'uruguay': 'uy', 'ecuador': 'ec',
          'bolivia': 'bo', 'paraguay': 'py', 'puerto rico': 'pr', 'panama': 'pa', 'costa rica': 'cr',
          'guatemala': 'gt', 'honduras': 'hn', 'el salvador': 'sv', 'nicaragua': 'ni', 'brasil': 'br', 'brazil': 'br',
          'estados unidos': 'us', 'eeuu': 'us', 'usa': 'us', 'portugal': 'pt', 'francia': 'fr', 'italia': 'it'}
# Lugares que la API escribe sin el país (Skone: «Málaga», Pandora: «Jamundi, Valle De Cauca», Sophia: «La Plata
# (Buenos Aires)»). Sólo los que no se confunden con otro país: «Santa Fe» o «Santiago» existen en varios y no van.
REGIONES = {'malaga': 'es', 'valle de cauca': 'co', 'valle del cauca': 'co', 'buenos aires': 'ar'}

# Nombres de foto que no dicen quién es: no sirven ni de pista.
_FOTO_SIN_NOMBRE = re.compile(r'^(image-?gen|firefly|img|dsc|screenshot|captura|team)', re.I)
_COMODIN = re.compile(r'extra.?player', re.I)
_DUO = re.compile(r'\s(?:y|&|\+)\s', re.I)


# ── Texto ────────────────────────────────────────────────────────────────────────────────────────────────────────────
def _sin_tildes(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s or '') if not unicodedata.combining(c))


def _palabras(s):
    """«Éxodo Lirical» -> «exodo lirical». Para buscar un nombre entero dentro de una frase."""
    return ' '.join(re.sub(r'[\W_]+', ' ', _sin_tildes(s).lower()).split())


def _norm(s):
    """«Facu HDR» y «FACU HDR» -> «facuhdr». Vacío si no hay letras (nunca «sinnombre»: dos vacíos no son el mismo)."""
    return _palabras(s).replace(' ', '')


def _guiones(s):
    return re.sub('[‐-―−]', '-', s or '')


def _int(s):
    s = (s or '').strip()
    return int(s) if re.fullmatch(r'\d{1,4}', s) else None


def _todo_mayus(s):
    return bool(s) and s == s.upper() and any(c.isalpha() for c in s)


def _err(e):
    return '%s: %s' % (type(e).__name__, str(e)[:120])


def _pais(origen):
    """El país ISO de «Nezahualcoyotl (México)». Lo que está entre paréntesis manda; si no, el último que aparece."""
    todo = ' %s ' % _palabras(origen)
    if not todo.strip():
        return None
    paren = ' %s ' % ' '.join(_palabras(x) for x in re.findall(r'\(([^)]*)\)', origen or ''))
    for donde in (paren, todo):
        mejor = None
        for nombre, cc in list(PAISES.items()) + list(REGIONES.items()):
            i = donde.rfind(' %s ' % nombre)
            if i >= 0 and (mejor is None or i > mejor[0]):
                mejor = (i, cc)
        if mejor:
            return mejor[1]
    return None


def _foto(url):
    """(pista de nombre, ¿es la foto genérica de Extra Player?) del archivo de la foto: «CTZ-1.png» -> «CTZ»."""
    if not url:
        return '', False
    s = unquote(urlparse(url).path.rsplit('/', 1)[-1])
    s = re.sub(r'\.[a-z0-9]{2,4}$', '', s, flags=re.I)
    if _COMODIN.search(s):
        return '', True
    s = re.sub(r'[-_]\d{1,2}$', '', s)
    if '_' in s:  # «Compo_Distributiva_mister-ego»: el nombre va al final
        s = s.rsplit('_', 1)[-1]
    if _FOTO_SIN_NOMBRE.match(s) or not re.search(r'[^\W\d_]', s):
        return '', False
    return s, False


def _parecido(candidatos, nombre):
    """1 si es el mismo nombre, 0,6 si uno contiene al otro («1Tobi» y «TOBI»), 0 si no."""
    b = _norm(nombre)
    mejor = 0.0
    for c in candidatos:
        a = _norm(c)
        if not a or not b:
            continue
        if a == b:
            return 1.0
        corto, largo = sorted((a, b), key=len)
        if len(corto) >= 3 and corto in largo:
            mejor = max(mejor, 0.6)
    return mejor


def _mas_comun(nombres):
    """El nombre más repetido; entre sus formas, la que no está toda en mayúsculas («Facu HDR» antes que «FACU HDR»)."""
    nombres = [n for n in nombres if _norm(n)]
    if not nombres:
        return None
    k = collections.Counter(_norm(n) for n in nombres).most_common(1)[0][0]
    formas = collections.Counter(n for n in nombres if _norm(n) == k)
    return sorted(formas, key=lambda n: (_todo_mayus(n), -formas[n]))[0]


# ── Un árbol mínimo con html.parser (no hay BeautifulSoup) ───────────────────────────────────────────────────────────
_VACIOS = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}


class _Nodo(object):
    __slots__ = ('tag', 'attrs', 'hijos', 'padre')

    def __init__(self, tag, attrs, padre):
        self.tag, self.attrs, self.hijos, self.padre = tag, attrs, [], padre

    def clases(self):
        return (self.attrs.get('class') or '').split()

    def tiene(self, clase):
        return clase in self.clases()

    def todos(self):
        pila = list(reversed(self.hijos))
        while pila:
            n = pila.pop()
            if isinstance(n, _Nodo):
                yield n
                pila.extend(reversed(n.hijos))

    def buscar(self, clase):
        return [n for n in self.todos() if n.tiene(clase)]

    def uno(self, clase):
        return next((n for n in self.todos() if n.tiene(clase)), None)

    def ancestro(self, clase):
        n = self.padre
        while n is not None and not n.tiene(clase):
            n = n.padre
        return n

    def texto(self):
        partes, pila = [], [self]
        while pila:
            n = pila.pop()
            if isinstance(n, _Nodo):
                pila.extend(reversed(n.hijos))
            else:
                partes.append(n)
        return ' '.join(''.join(partes).split())


class _Arbol(HTMLParser):
    def __init__(self):
        HTMLParser.__init__(self, convert_charrefs=True)
        self.raiz = _Nodo('#raiz', {}, None)
        self.actual = self.raiz

    def handle_starttag(self, tag, attrs):
        n = _Nodo(tag, {k: (v or '') for k, v in attrs}, self.actual)
        self.actual.hijos.append(n)
        if tag not in _VACIOS:
            self.actual = n

    def handle_startendtag(self, tag, attrs):
        self.actual.hijos.append(_Nodo(tag, {k: (v or '') for k, v in attrs}, self.actual))

    def handle_endtag(self, tag):
        n = self.actual
        while n is not None and n.tag != tag:
            n = n.padre
        if n is not None and n.padre is not None:  # un cierre suelto, sin su apertura, se ignora
            self.actual = n.padre

    def handle_data(self, data):
        self.actual.hijos.append(data)


def _arbol(txt):
    p = _Arbol()
    p.feed(txt)
    p.close()
    return p.raiz


class _Lineas(HTMLParser):
    """El texto de un post, una línea por párrafo o ítem: así se lee «Resultado general: 155 – 119»."""
    BLOQUES = {'p', 'li', 'ul', 'ol', 'div', 'hr', 'br', 'tr', 'table', 'blockquote', 'figure',
               'h1', 'h2', 'h3', 'h4', 'h5', 'h6'}

    def __init__(self):
        HTMLParser.__init__(self, convert_charrefs=True)
        self.partes = []

    def handle_starttag(self, tag, attrs):
        if tag in self.BLOQUES:
            self.partes.append('\n')

    handle_endtag = handle_startendtag = lambda self, tag, *a: self.handle_starttag(tag, ())

    def handle_data(self, data):
        self.partes.append(data)


def _lineas(txt):
    p = _Lineas()
    p.feed(txt or '')
    p.close()
    return [x for x in (' '.join(l.split()) for l in ''.join(p.partes).split('\n')) if x]


# ── La red ───────────────────────────────────────────────────────────────────────────────────────────────────────────
class _Red(object):
    """Un pedido por vez, y nunca dos en el mismo segundo."""

    def __init__(self):
        import requests
        self.s = requests.Session()
        self.s.headers['User-Agent'] = UA
        self.t, self.n = 0.0, 0

    def get(self, url, params=None):
        falta = PAUSA - (time.monotonic() - self.t)
        if self.n and falta > 0:
            time.sleep(falta)
        try:
            r = self.s.get(url, params=params, timeout=TIMEOUT)
        finally:
            self.t, self.n = time.monotonic(), self.n + 1
        r.raise_for_status()
        return r


def _api(red, url, params, avisos, nombre):
    """Las páginas de una API de WordPress, juntas. `r.json()`: nunca adivinar el charset con `r.text`."""
    todo = []
    for pag in range(1, MAX_PAGINAS + 1):
        r = red.get(url, dict(params, page=pag))
        d = r.json()
        if not isinstance(d, list):
            raise ValueError('%s no devolvió una lista' % nombre)
        todo.extend(d)
        total = _int(r.headers.get('X-WP-TotalPages')) or 1
        if pag >= total:
            break
        if pag == MAX_PAGINAS:
            avisos.append('%s tiene %d páginas y leí %d: puede faltar algo' % (nombre, total, MAX_PAGINAS))
    return todo


def _bajar(desde, hasta, avisos):
    crudo = {'resultados': None, 'mcs': None, 'ur': None}
    red = _Red()
    try:
        crudo['resultados'] = red.get(URL_RESULTADOS).content.decode('utf-8')
    except Exception as e:  # noqa: BLE001 — se avisa y el ranking se queda con lo de la semana anterior
        avisos.append('fms.tv/resultados no contestó (%s)' % _err(e))
        return crudo
    try:
        crudo['mcs'] = _api(red, URL_MCS, {'per_page': 100, '_fields': 'id,slug,title,link,acf.league,acf.birth_place,acf.grid_image'},
                            avisos, 'la API de MCs de fms.tv')
    except Exception as e:  # noqa: BLE001
        avisos.append('la API de MCs de fms.tv no contestó (%s)' % _err(e))
        return crudo
    try:
        # Los posts salen 1 o 2 días después de la jornada: un mes de margen al final de la ventana.
        tope = (dt.date.fromisoformat(hasta) + dt.timedelta(days=31)).isoformat()
        crudo['ur'] = _api(red, URL_UR, {'search': 'votaciones', 'after': desde + 'T00:00:00',
                                         'before': tope + 'T23:59:59', 'per_page': 100,
                                         '_fields': 'id,slug,date,link,title,content'}, avisos, 'urbanroosters')
    except Exception as e:  # noqa: BLE001
        avisos.append('urbanroosters no contestó (%s)' % _err(e))
    return crudo


def _json_de_html(txt):
    m = re.search(r'<script[^>]*application/json[^>]*>(.*?)</script>', txt or '', re.S)
    return json.loads(m.group(1)) if m else None


def _casos(avisos):
    """Lo mismo que `_bajar`, pero de bot/global_casos/: así el self-check corre el mismo código que la semana."""
    crudo = {}
    for clave, archivo, es_json in (('resultados', 'fms_resultados.html', False), ('mcs', 'fms_mcs.html', True),
                                    ('ur', 'fms_urbanroosters.html', True)):
        try:
            with io.open(os.path.join(CASOS, archivo), encoding='utf-8') as f:
                txt = f.read()
            crudo[clave] = _json_de_html(txt) if es_json else txt
        except (OSError, ValueError) as e:
            avisos.append('no pude leer el caso %s (%s)' % (archivo, _err(e)))
            crudo[clave] = None
    return crudo


# ── fms.tv/resultados ────────────────────────────────────────────────────────────────────────────────────────────────
def _ref_mc(href):
    """('slug', 'mecha') de «/mcs/mecha/»; ('p', 13392) de «?post_type=mcs&p=13392» (perfil sin publicar)."""
    if not href:
        return None
    u = urlparse(href)
    p = (parse_qs(u.query).get('p') or [''])[0]
    if p.isdigit():
        return ('p', int(p))
    m = re.search(r'/mcs/([^/?#]+)/?$', u.path)
    return ('slug', unquote(m.group(1)).lower()) if m else None


def _batalla_html(w):
    lados = []
    for k in ('mc1', 'mc2'):
        caja = next((n for n in w.todos() if n.tiene('battle-result-box__mcs__mc') and n.tiene(k)), None)
        nodos = list(caja.todos()) if caja else []
        a = next((n for n in nodos if n.tag == 'a' and n.attrs.get('href')), None)
        img = next((n for n in nodos if n.tag == 'img' and n.attrs.get('src')), None)
        lados.append({'ref': _ref_mc(a.attrs['href']) if a else None, 'img': img.attrs['src'] if img else '',
                      # el MVP de la jornada lleva una insignia en su foto, en cada batalla que hizo
                      'mvp': any(n.tiene('mpv-badge') or n.tiene('mvp-badge') for n in nodos)})
    res = w.buscar('battle-result-box__mcs__mc-result__result')[:2]
    votos = [_int(n.texto()) for n in res]
    notas = w.buscar('battle__details__box__notes__note')[:2]
    pts = [_int(n.texto()) for n in notas]
    rep = w.uno('battle__details__box__notes__replies')
    det = next((n for n in w.todos() if n.tiene('battle__details')), None)
    clase = next((int(c[-1]) for c in (det.clases() if det else []) if re.fullmatch(r'winner-[12]', c)), None)
    return {'lados': lados,
            'votos': votos if len(votos) == 2 and None not in votos else None,
            'win': [n.tiene('win') for n in res] if len(res) == 2 else [False, False],
            'pts': pts if len(pts) == 2 and None not in pts else None,
            'rep': rep.texto() if rep else '', 'clase': clase}


def _parsear_resultados(txt):
    raiz = _arbol(txt)
    etiquetas = {n.attrs.get('data-country'): n.texto() for n in raiz.buscar('country-selector__li')}
    secciones = []
    for tab in raiz.buscar('results-tabs__tab'):
        liga = tab.attrs.get('data-league') or next((c for c in tab.clases() if c != 'results-tabs__tab'), '')
        for g in tab.buscar('results__group'):
            t, gr = g.uno('results__group__title__jornada'), g.uno('results__group__title__group')
            bats = [_batalla_html(w) for w in g.buscar('battle__summary__wrapper') if w.ancestro('results__group') is g]
            secciones.append({'liga': liga, 'titulo': t.texto() if t else '', 'grupo': gr.texto() if gr else '',
                              'batallas': bats})
    return etiquetas, secciones


def _replica(txt):
    t = _palabras(txt)
    if not t:
        return None
    if t.startswith('sin '):
        return False
    return True if 'replica' in t else None


def _inicio_temporada(fecha):
    """Una temporada FMS va de agosto a julio: el 14/11/2026 es de la 2026/27 y el 20/02/2027 también."""
    d = dt.date.fromisoformat(fecha)
    return d.year if d.month >= 7 else d.year - 1


def _evento(liga, k, fecha, etiquetas):
    cod, pais, base = LIGAS.get(liga, (liga, None, None))
    ini = _inicio_temporada(fecha)
    n = base + (ini - 2026) if base and base + (ini - 2026) >= 1 else None
    t = 't%d' % n if n else '%d-%02d' % (ini, (ini + 1) % 100)
    nombre = 'FMS %s %d/%02d · Jornada %d' % (etiquetas.get(liga) or liga.title(), ini, (ini + 1) % 100, k)
    tipo = 'fms_internacional' if liga == 'internacional' else 'fms_jornada'
    return {'id': 'fms-%s-%s-j%d' % (cod, t, k), 'nombre': nombre, 'tipo': tipo, 'pais': pais, 'fecha': fecha}, n


def _jornadas(secciones, etiquetas, desde, hasta, avisos):
    jornadas, en_pagina, selecciones, nuevas = collections.OrderedDict(), set(), [0, 0], set()
    for s in secciones:
        liga = s['liga']
        m = re.search(r'jornada\s*(\d+)', s['titulo'], re.I)
        f = re.search(r'(\d{1,2})/(\d{1,2})/(\d{4})', s['titulo'])
        try:
            fecha = dt.date(int(f.group(3)), int(f.group(2)), int(f.group(1))).isoformat() if f else None
        except ValueError:
            fecha = None
        if not m or not fecha:
            if s['batallas']:
                avisos.append('fms.tv: no sé leer la sección «%s» de %s (%d batallas): la salto'
                              % (s['titulo'], liga, len(s['batallas'])))
            continue
        k = int(m.group(1))
        en_pagina.add((liga, k))
        if not (desde <= fecha <= hasta):
            continue
        if liga in SELECCIONES:
            selecciones[0] += len(s['batallas'])
            selecciones[1] += sum(1 for b in s['batallas'] if b['votos'])
            continue
        if liga not in LIGAS and liga not in nuevas:
            nuevas.add(liga)
            avisos.append('fms.tv tiene una liga nueva, «%s»: la leo sin país ni número de temporada (sumarla a LIGAS)'
                          % liga)
        j = jornadas.get((liga, k))
        if j is None:
            ev, n = _evento(liga, k, fecha, etiquetas)
            j = jornadas[(liga, k)] = {'liga': liga, 'k': k, 'n': n, 'evento': ev, 'batallas': [], 'ur': []}
        elif fecha != j['evento']['fecha']:
            avisos.append('%s tiene secciones en dos fechas (%s y %s): uso la primera'
                          % (j['evento']['nombre'], j['evento']['fecha'], fecha))
        j['batallas'].extend(s['batallas'])
    if selecciones[0]:
        avisos.append('Freestyle World Cup: %d cruces país contra país (%d con resultado) no van: una selección no es '
                      'una persona' % tuple(selecciones))
    return jornadas, en_pagina


# ── urbanroosters ────────────────────────────────────────────────────────────────────────────────────────────────────
def _dos_nombres(t):
    t = re.sub(r'\([^)]*\)', ' ', t or '')  # «(Vida o Muerte)», «(Extra Player)», «(Liga)»
    partes = re.split(r'\s+vs\.?\s+', ' '.join(t.split()), flags=re.I)
    return [p.strip(' .:-') for p in partes] if len(partes) == 2 and all(p.strip(' .:-') for p in partes) else None


def _batallas_ur(cuerpo):
    intro, bats, u, jueces = [], [], None, False
    for l in _lineas(cuerpo):
        l = _guiones(l)
        m = re.match(r'^batalla\s*(\d+)\s*[:.\-]?\s*(.+)$', l, re.I)
        if m:
            u = {'titulo': m.group(2).strip(), 'nombres': _dos_nombres(m.group(2)), 'votos': None, 'pts': None,
                 'ganador': None, 'jueces': []}
            bats.append(u)
            jueces = False
            continue
        if u is None:
            intro.append(l)
            continue
        m = re.match(r'^resultado\s+general\s*:?\s*(\d+)\s*-\s*(\d+)', l, re.I)
        if m:
            u['pts'] = [int(m.group(1)), int(m.group(2))]
            continue
        m = re.match(r'^resultado\s*:?\s*(\d+)\s*-\s*(\d+)', l, re.I)
        if m:
            u['votos'] = [int(m.group(1)), int(m.group(2))]
            continue
        m = re.match(r'^ganador[a]?\s*:?\s*(.+)$', l, re.I)
        if m:
            u['ganador'] = m.group(1).strip()
            continue
        if re.match(r'^votaci', l, re.I):
            jueces = True
            continue
        m = re.match(r'^(.{1,40}?)\s*:\s*(\d{1,3})\s*-\s*(\d{1,3})\s*$', l)
        if jueces and m:
            u['jueces'].append((m.group(1).strip(), int(m.group(2)), int(m.group(3))))
    return ' '.join(intro), bats


def _posts_ur(lista):
    posts = []
    for p in lista or []:
        titulo = _html.unescape(((p.get('title') or {}).get('rendered')) or '')
        clave_t = _palabras((p.get('slug') or '').replace('-', ' ') + ' ' + titulo)
        palabras = clave_t.split()
        if not ({'votaciones', 'puntuaciones'} & set(palabras)) or 'fms' not in palabras:
            continue  # otra nota que nombra las votaciones
        liga = next((k for w, k in LIGAS_UR if (' %s ' % w) in (' %s ' % clave_t)), None)
        m = re.search(r'\bjornada (\d+)\b', clave_t) or re.search(r'\bj(\d+)\b', clave_t)
        k = int(m.group(1)) if m else (1 if 'primera jornada' in clave_t else None)
        mt = re.search(r'\btemporada (\d{1,2})\b', clave_t)
        intro, bats = _batallas_ur(((p.get('content') or {}).get('rendered')) or '')
        posts.append({'liga': liga, 'k': k, 'temporada': int(mt.group(1)) if mt else None,
                      'fecha': (p.get('date') or '')[:10], 'url': p.get('link'), 'titulo': titulo,
                      'intro': intro, 'batallas': bats})
    return posts


def _cruzar_ur(jornadas, en_pagina, posts, desde, avisos):
    for p in posts:
        if not p['fecha'] or p['fecha'] < desde:
            continue
        if not p['liga'] or not p['k']:
            avisos.append('urbanroosters: no sé de qué liga o jornada es «%s»: no lo uso' % p['titulo'])
            continue
        j = jornadas.get((p['liga'], p['k']))
        dias = (dt.date.fromisoformat(p['fecha']) - dt.date.fromisoformat(j['evento']['fecha'])).days if j else None
        if j and -1 <= dias <= 31:
            j['ur'].append(p)
            if p['temporada'] and j['n'] and p['temporada'] != j['n']:
                avisos.append('%s: urbanroosters dice temporada %d y LIGAS dice %d' % (j['evento']['nombre'],
                                                                                     p['temporada'], j['n']))
        elif p['liga'] not in SELECCIONES and (p['liga'], p['k']) not in en_pagina:
            avisos.append('urbanroosters publicó «%s» (%s) y fms.tv no tiene esa jornada: no la cargo'
                          % (p['titulo'], p['fecha']))


def _pistas(lado, mcs):
    """Los nombres que ya se saben de un lado de fms.tv: el de la API, el slug y el archivo de la foto."""
    mc = _mc(lado, mcs)
    out = [mc['nombre'], re.sub(r'-\d+$', '', mc['slug'] or '')] if mc else []
    if lado['ref'] and lado['ref'][0] == 'slug':
        out.append(re.sub(r'-\d+$', '', lado['ref'][1]))
    out.append(_foto(lado['img'])[0])
    return [x for x in out if x]


def _lado_ganador(f):
    w = f['win']
    return 0 if w[0] and not w[1] else 1 if w[1] and not w[0] else None


def _orientar(f, u, mcs):
    """[nombre de urbanroosters del lado 1, del lado 2]. El título no siempre va en el orden de fms.tv."""
    n1, n2 = u['nombres']
    c1, c2 = _pistas(f['lados'][0], mcs), _pistas(f['lados'][1], mcs)
    igual = _parecido(c1, n1) + _parecido(c2, n2)
    cruz = _parecido(c1, n2) + _parecido(c2, n1)
    if abs(igual - cruz) >= 0.5:
        return [n1, n2] if igual > cruz else [n2, n1]
    g, lg = _norm(u['ganador']), _lado_ganador(f)  # sin nombres conocidos, el ganador dice quién es quién
    if g and lg is not None and _norm(n1) != _norm(n2):
        if g == _norm(n1):
            return [n1, n2] if lg == 0 else [n2, n1]
        if g == _norm(n2):
            return [n2, n1] if lg == 0 else [n1, n2]
    return None


def _emparejar(j, post, mcs, avisos):
    """Cada batalla del post, con la suya de fms.tv: por puntos (el total o la suma de los jueces) y, si no, por nombres."""
    fb, libres = j['batallas'], set(range(len(j['batallas'])))
    for u in post['batallas']:
        if not u['nombres']:
            avisos.append('urbanroosters, %s: no entiendo «%s»' % (j['evento']['nombre'], u['titulo']))
            continue
        claves_p = {tuple(u['pts'])} if u['pts'] else set()
        if len(u['jueces']) >= 3:
            claves_p.add((sum(x[1] for x in u['jueces']), sum(x[2] for x in u['jueces'])))

        def por_pts(i):
            p = fb[i]['pts']
            return None if not p else 'igual' if tuple(p) in claves_p else 'cruz' if tuple(p[::-1]) in claves_p else None

        cands = sorted(i for i in libres if por_pts(i))
        elegido = cands[0] if len(cands) == 1 else None
        if elegido is None:
            puntos = sorted(((max(_parecido(_pistas(fb[i]['lados'][0], mcs), u['nombres'][0]) +
                                  _parecido(_pistas(fb[i]['lados'][1], mcs), u['nombres'][1]),
                                  _parecido(_pistas(fb[i]['lados'][0], mcs), u['nombres'][1]) +
                                  _parecido(_pistas(fb[i]['lados'][1], mcs), u['nombres'][0])), i)
                             for i in (cands or sorted(libres))), reverse=True)
            if puntos and puntos[0][0] >= 1.0 and (len(puntos) == 1 or puntos[0][0] > puntos[1][0]):
                elegido = puntos[0][1]
        if elegido is None:
            avisos.append('urbanroosters, %s: no encontré en fms.tv «%s»' % (j['evento']['nombre'], u['titulo']))
            continue
        libres.discard(elegido)
        f = fb[elegido]
        f['ur'], f['ur_nombres'] = u, _orientar(f, u, mcs)
        _controlar(f, u, por_pts(elegido), j, avisos)


def _controlar(f, u, orden, j, avisos):
    """Avisa si NINGÚN número de urbanroosters respalda el marcador o los puntos de fms.tv (manda fms.tv igual).

    ⚠️ Basta con que uno coincida porque urbanroosters se equivoca solo: en la J1 de Colombia sus votos juez por juez
    dan 2–1 y su propio «Resultado» dice 4–1, igual que fms.tv. Avisar de eso repetiría su errata todas las semanas.
    """
    if not orden:
        return

    def girar(par):
        return list(par) if orden == 'igual' else [par[1], par[0]]
    js = [girar((a, b)) for _, a, b in u['jueces']] if len(u['jueces']) >= 3 else []
    votos = [[sum(1 for a, b in js if a > b), sum(1 for a, b in js if b > a)]] if js else []
    pts = [[sum(a for a, _ in js), sum(b for _, b in js)]] if js else []
    votos += [girar(u['votos'])] if u['votos'] else []
    pts += [girar(u['pts'])] if u['pts'] else []
    for que, fms, ur in (('el marcador', f['votos'], votos), ('los puntos', f['pts'], pts)):
        if fms and ur and fms not in ur:
            avisos.append('%s, «%s»: %s de fms.tv (%d–%d) no coincide con nada de urbanroosters (%s); uso fms.tv'
                          % (j['evento']['nombre'], u['titulo'], que, fms[0], fms[1],
                             ', '.join('%d–%d' % tuple(x) for x in ur)))


def _mvp_ur(intro, nombres):
    """El nombre más cerca de «MVP» en la entrada del post: «Con Puppy consagrándose como el MVP de la velada…»."""
    t = ' %s ' % _palabras(intro)
    i = t.find(' mvp ')
    if i < 0:
        return None
    mejor = None
    for n in nombres:
        w = _palabras(n)
        if len(w) < 3:
            continue
        for m in re.finditer(re.escape(' %s ' % w), t):
            d = abs(m.start() - i)
            if mejor is None or d < mejor[0]:
                mejor = (d, n)
    return mejor[1] if mejor else None


# ── Quién es quién ───────────────────────────────────────────────────────────────────────────────────────────────────
def _indice_mcs(lista):
    por_id, por_slug = {}, {}
    for x in lista or []:
        try:
            i = int(x.get('id'))
        except (TypeError, ValueError):
            continue
        acf = x.get('acf') if isinstance(x.get('acf'), dict) else {}
        origen = acf.get('birth_place') or ''
        mc = {'id': i, 'slug': (x.get('slug') or '').lower(),
              'nombre': ' '.join(_html.unescape(((x.get('title') or {}).get('rendered')) or '').split()),
              'ligas': [str(l) for l in (acf.get('league') or [])], 'origen': origen, 'pais': _pais(origen),
              # 📸 la foto oficial (un recorte con fondo transparente): la usa el ranking global (global_fotos.py)
              'foto': acf.get('grid_image') if isinstance(acf.get('grid_image'), str) else ''}
        por_id[i] = mc
        if mc['slug']:
            por_slug[mc['slug']] = mc
    return {'id': por_id, 'slug': por_slug}


def _mc(lado, mcs):
    r = lado['ref']
    if not r:
        return None
    return mcs['id'].get(r[1]) if r[0] == 'p' else mcs['slug'].get(r[1])


def _quien(f, mcs):
    """«TOBI vs DYSE» para un aviso, con lo que se sepa."""
    out = []
    for i, lado in enumerate(f['lados']):
        n = (f.get('ur_nombres') or [None, None])[i] or (_pistas(lado, mcs) or ['?'])[0]
        out.append(n)
    return ' vs '.join(out)


def _armar(crudo, desde, hasta, avisos):
    """De lo bajado (o de los casos) al formato del ranking. No pide red: el self-check prueba lo mismo que corre."""
    salida = {'batallas': [], 'mvp': [], 'avisos': avisos}
    if not crudo.get('resultados'):
        avisos.append('sin la página de resultados de fms.tv no hay batallas de FMS esta vez')
        return salida
    try:
        etiquetas, secciones = _parsear_resultados(crudo['resultados'])
    except Exception as e:  # noqa: BLE001
        avisos.append('no pude leer la página de resultados (%s)' % _err(e))
        return salida
    if not any(s['batallas'] for s in secciones):
        avisos.append('la página de resultados no tiene ninguna batalla que yo sepa leer: ¿cambió el diseño? (es BETA)')
        return salida
    if crudo.get('mcs') is None:
        avisos.append('sin la API de MCs no hay ids estables: no devuelvo batallas de FMS (quedan las de la vez anterior)')
        return salida
    mcs = _indice_mcs(crudo['mcs'])
    # El plantel de cada liga FMS que lista fms.tv: son PRO en el ranking aunque todavía no hayan jugado en la T1
    # (Dlx, 21/11/2026: «asegúrate a quién metes en cada tag»). El generico «Extra Player» no es nadie.
    salida['plantel'] = [{'id': 'fms:%d' % m['id'], 'nombre': m['nombre'], 'pais': m['pais'], 'ligas': m['ligas'],
                          'foto': m.get('foto') or ''}
                         for m in mcs['id'].values() if m['nombre'] and m['ligas'] and m['id'] != 9083]
    jornadas, en_pagina = _jornadas(secciones, etiquetas, desde, hasta, avisos)
    if crudo.get('ur') is None:
        avisos.append('sin urbanroosters: los Extra Players sin perfil quedan sin nombre y el MVP sale sólo de fms.tv')
    _cruzar_ur(jornadas, en_pagina, _posts_ur(crudo.get('ur')), desde, avisos)
    for j in jornadas.values():
        for p in j['ur']:
            _emparejar(j, p, mcs, avisos)

    # Los perfiles sin publicar: qué nombres les dio urbanroosters, y cuáles son comodines.
    nombres_p, foto_p, alias_api = collections.defaultdict(list), {}, collections.defaultdict(list)
    for j in jornadas.values():
        for f in j['batallas']:
            for i, lado in enumerate(f['lados']):
                n = (f.get('ur_nombres') or [None, None])[i]
                mc = _mc(lado, mcs)
                if mc and n:
                    alias_api[mc['id']].append(n)
                elif not mc and lado['ref'] and lado['ref'][0] == 'p':
                    foto_p.setdefault(lado['ref'][1], _foto(lado['img']))
                    if n:
                        nombres_p[lado['ref'][1]].append(n)
    comodines = set()
    for i, (pista, generica) in foto_p.items():
        ns = sorted({_norm(n) for n in nombres_p.get(i, []) if _norm(n)}, key=len)
        # Dos formas de escribir a la misma persona («Metalingüística», «Metalinguistica») no son dos personas.
        if generica or (len(ns) > 1 and not all(ns[0] in x for x in ns[1:])):
            comodines.add(i)

    provisorios, sin_slug, contra, sin_pais = [], set(), [], set()
    vistos = collections.Counter()
    for j in sorted(jornadas.values(), key=lambda x: (x['evento']['fecha'], x['liga'], x['k'])):
        ev = j['evento']
        alias_j, mvp_fms, sin_res = {}, collections.OrderedDict(), 0
        for f in j['batallas']:
            if f['votos'] is None and f['pts'] is None and not any(f['win']):
                sin_res += 1
                continue
            ps, motivo = [], None
            for i, lado in enumerate(f['lados']):
                n_ur = (f.get('ur_nombres') or [None, None])[i]
                mc = _mc(lado, mcs)
                if mc and ('fswc' in mc['ligas'] or mc['slug'].startswith('team-')):
                    motivo = '%s es una selección, no una persona' % mc['nombre']
                elif mc:
                    nombre = mc['nombre']
                    if _todo_mayus(nombre):  # «FACU HDR» -> «Facu HDR», si urbanroosters lo escribe igual
                        mejor = _mas_comun([a for a in alias_api[mc['id']] if _norm(a) == _norm(nombre)])
                        nombre = mejor if mejor and not _todo_mayus(mejor) else nombre
                    ps.append({'nombre': nombre, 'id': 'fms:%d' % mc['id'], 'pais': mc['pais'],
                               'foto': mc.get('foto') or (lado['img'] if not _foto(lado['img'])[1] else '')})
                    if not mc['pais']:
                        sin_pais.add(nombre)
                elif not lado['ref']:
                    motivo = 'un lado no tiene link a ningún MC'
                elif lado['ref'][0] == 'slug':
                    s = lado['ref'][1]
                    if s not in sin_slug:
                        sin_slug.add(s)
                        avisos.append('«%s» no está en la API de MCs: va con su slug como id (fms:%s)' % (s, s))
                    ps.append({'nombre': n_ur or s.replace('-', ' ').upper(), 'id': 'fms:%s' % s, 'pais': None})
                elif n_ur and _DUO.search(n_ur):
                    motivo = '2 contra 1: «%s» son dos personas' % n_ur
                elif lado['ref'][1] in comodines:
                    if not n_ur:
                        motivo = 'Extra Player sin nombre todavía (sale de urbanroosters)'
                    else:
                        ps.append({'nombre': n_ur, 'id': 'fms:nombre:%s' % claves.clave(n_ur), 'pais': None})
                else:
                    i_p = lado['ref'][1]
                    nombre = _mas_comun(nombres_p.get(i_p, []))
                    if not nombre and foto_p.get(i_p, ('', False))[0]:
                        nombre = re.sub(r'[-_]+', ' ', foto_p[i_p][0]).upper()
                        if i_p not in provisorios:
                            provisorios.append(i_p)
                            avisos.append('%s: el MC %d no tiene perfil ni post de urbanroosters; nombre provisional '
                                          '«%s», sacado de su foto' % (ev['nombre'], i_p, nombre))
                    if nombre:
                        ps.append({'nombre': nombre, 'id': 'fms:%d' % i_p, 'pais': None,
                                   'foto': lado['img'] if lado['img'] and not foto_p.get(i_p, ('', True))[1] else ''})
                    else:
                        motivo = 'el MC %d no tiene perfil ni nombre en urbanroosters' % i_p
                if motivo:
                    break
            if not motivo and ps[0]['id'] == ps[1]['id']:
                motivo = 'los dos lados son la misma persona'
            if motivo:
                avisos.append('%s: salto «%s» (%s)' % (ev['nombre'], _quien(f, mcs), motivo))
                continue

            v = f['votos']
            mayoria = None if not v else 'a' if v[0] > v[1] else 'b' if v[1] > v[0] else None
            lg = _lado_ganador(f)
            gana = 'ab'[lg] if lg is not None else None
            if gana is None and v:
                # Sin la marca «win»: la clase winner-N sólo vale con marcador (las batallas vacías traen winner-2).
                gana = 'ab'[f['clase'] - 1] if f['clase'] else mayoria
                avisos.append('%s, %s: la página no marca ganador; uso %s' % (
                    ev['nombre'], _quien(f, mcs), 'su clase winner-N' if f['clase'] else 'la mayoría de jueces'))
            elif gana and mayoria and gana != mayoria:
                avisos.append('%s, %s: fms.tv da ganador al que tiene menos jueces (%d–%d)'
                              % (ev['nombre'], _quien(f, mcs), v[0], v[1]))
            p = f['pts']
            if gana and p and p[0] != p[1] and (p[0] > p[1]) != (gana == 'a'):
                contra.append('%s %s–%s %s (%d–%d pts)' % (ps[0]['nombre'], v[0] if v else '?', v[1] if v else '?',
                                                            ps[1]['nombre'], p[0], p[1]))
            u = f.get('ur')
            if u and u.get('ganador') and gana and f.get('ur_nombres'):
                g = _norm(u['ganador'])
                gn, pn = _norm(f['ur_nombres'][0 if gana == 'a' else 1]), _norm(f['ur_nombres'][1 if gana == 'a' else 0])
                if g == pn and g != gn:
                    avisos.append('%s, %s: urbanroosters da ganador a %s y fms.tv al otro (uso fms.tv)'
                                  % (ev['nombre'], _quien(f, mcs), u['ganador']))
            rep = _replica(f['rep'])
            if rep is None and f['rep']:
                avisos.append('%s, %s: no entiendo la réplica «%s»' % (ev['nombre'], _quien(f, mcs), f['rep']))
            elif rep is False and v and mayoria is None:
                avisos.append('%s, %s: empate de jueces %d–%d y dice «sin réplica»' % (ev['nombre'], _quien(f, mcs),
                                                                                      v[0], v[1]))

            base = 'fms:%s:%s' % (ev['id'][4:], '+'.join(sorted(x['id'][4:] for x in ps)))
            vistos[base] += 1
            bid = base if vistos[base] == 1 else '%s#%d' % (base, vistos[base])
            if vistos[base] > 1:
                avisos.append('%s: %s se cruzaron dos veces; la segunda va como %s' % (ev['nombre'], _quien(f, mcs), bid))
            salida['batallas'].append({'id': bid, 'fuente': 'fms', 'url': URL_RESULTADOS, 'evento': dict(ev),
                                       'ronda': 'jornada', 'a': ps[0], 'b': ps[1], 'gana': gana, 'replica': rep,
                                       'votos': list(v) if v else None, 'pts': list(p) if p else None})
            for i, x in enumerate(ps):
                alias_j.setdefault(_norm(x['nombre']), x)
                n_ur = (f.get('ur_nombres') or [None, None])[i]
                if n_ur:
                    alias_j.setdefault(_norm(n_ur), x)
                if f['lados'][i]['mvp']:
                    mvp_fms[x['id']] = x
        if sin_res:
            avisos.append('%s: %d batallas todavía sin resultado' % (ev['nombre'], sin_res))
        _mvps(j, alias_j, mvp_fms, salida, avisos)

    if contra:
        avisos.append('en %d batallas fms.tv da ganador a quien sumó menos puntos (decide la mayoría de jueces, no los '
                      'puntos): %s' % (len(contra), '; '.join(contra[:6])))
    if sin_pais:
        avisos.append('sin país (la API no dice dónde nacieron): %s' % ', '.join(sorted(sin_pais)))
    return salida


def _mvps(j, alias_j, mvp_fms, salida, avisos):
    """El MVP de la jornada: la insignia de fms.tv manda; urbanroosters confirma o, si fms.tv no la tiene, lo da."""
    ev = j['evento']
    ur, url_ur = None, None
    for p in j['ur']:
        nombres = [n for u in p['batallas'] for n in (u['nombres'] or [])] + [x['nombre'] for x in alias_j.values()]
        ur = _mvp_ur(p['intro'], nombres)
        if ur:
            url_ur = p['url']
            break
    quien_ur = alias_j.get(_norm(ur)) if ur else None
    for x in mvp_fms.values():
        salida['mvp'].append({'evento': dict(ev), 'quien': dict(x), 'fuente': 'fms', 'url': URL_RESULTADOS})
    if mvp_fms:
        if ur and (quien_ur is None or quien_ur['id'] not in mvp_fms):
            avisos.append('%s: el MVP de fms.tv es %s y urbanroosters dice %s (uso fms.tv)'
                          % (ev['nombre'], ' y '.join(x['nombre'] for x in mvp_fms.values()), ur))
    elif quien_ur:
        salida['mvp'].append({'evento': dict(ev), 'quien': dict(quien_ur), 'fuente': 'urbanroosters', 'url': url_ur})
    elif ur:
        avisos.append('%s: urbanroosters da el MVP a «%s» y no sé quién es en fms.tv' % (ev['nombre'], ur))
    elif any(b['evento']['id'] == ev['id'] for b in salida['batallas']):
        avisos.append('%s: sin MVP (ni insignia en fms.tv ni post de urbanroosters todavía)' % ev['nombre'])


def leer(desde='2026-09-22', hasta='2026-12-31', red=True):
    """Returns {'batallas': [...], 'mvp': [...], 'avisos': [...]} for battles dated within [desde, hasta]."""
    avisos = []
    crudo = _bajar(desde, hasta, avisos) if red else _casos(avisos)
    return _armar(crudo, desde, hasta, avisos)


# ── Self-check, sin red ──────────────────────────────────────────────────────────────────────────────────────────────
def _self_check():
    mal = []

    def ok(cond, que):
        print(('  ✅ ' if cond else '  🔴 ') + que)
        if not cond:
            mal.append(que)

    global _bajar
    bajar_de_verdad = _bajar

    def _sin_red(*a, **k):
        raise AssertionError('red=False no puede salir a la red')
    _bajar = _sin_red
    try:
        r = leer(red=False)
        r2 = leer(red=False)
        r_nov = leer('2026-11-01', '2026-12-31', red=False)
    finally:
        _bajar = bajar_de_verdad
    bs, av = r['batallas'], r['avisos']
    por_ev = collections.Counter(b['evento']['id'] for b in bs)
    print('\n  las batallas, de los casos')
    ok(dict(por_ev) == {'fms-co-t5-j1': 11, 'fms-ar-t8-j1': 11, 'fms-cl-t7-j1': 11, 'fms-es-t9-j1': 11,
                        'fms-co-t5-j2': 10}, 'once por jornada, y diez en la J2 de Colombia (sin el 2 contra 1): %s'
       % dict(por_ev))
    ok([b['id'] for b in bs] == [b['id'] for b in r2['batallas']], 'los ids no cambian de una corrida a otra')
    ok(len({b['id'] for b in bs}) == len(bs), 'no hay dos batallas con el mismo id')
    claves_b = {'id', 'fuente', 'url', 'evento', 'ronda', 'a', 'b', 'gana', 'replica', 'votos', 'pts'}
    ok(all(set(b) == claves_b and set(b['evento']) == {'id', 'nombre', 'tipo', 'pais', 'fecha'}
           and all({'nombre', 'id', 'pais'} <= set(b[x]) <= {'nombre', 'id', 'pais', 'foto'} for x in 'ab') for b in bs),
       'cada batalla tiene la forma pedida (la foto es opcional)')
    ok(all(b['gana'] in ('a', 'b') and b['replica'] is False and len(b['votos']) == 2 for b in bs),
       'todas con ganador, «sin réplica» y marcador')

    def una(a, b):
        return next((x for x in bs if {x['a']['nombre'], x['b']['nombre']} == {a, b}), None)

    t = una('TOBI', 'Dyse')
    ok(t and t['a']['id'] == 'fms:12603' and t['b']['id'] == 'fms:13392' and t['gana'] == 'a' and t['votos'] == [3, 1]
       and t['pts'] == [144, 146] and t['a']['pais'] == 'ar',
       'TOBI 3–1 Dyse con 144–146: gana TOBI (manda la mayoría de jueces) y Dyse sale de urbanroosters: %r' % t)
    ok(t and t['evento'] == {'id': 'fms-ar-t8-j1', 'nombre': 'FMS Argentina 2026/27 · Jornada 1', 'tipo': 'fms_jornada',
                             'pais': 'ar', 'fecha': '2026-10-18'}, 'el evento de la J1 de Argentina: %r'
       % (t and t['evento']))
    t = una('Replik', 'TOBI')
    ok(t and t['a']['nombre'] == 'Replik' and t['gana'] == 'b',
       '«1Tobi vs Replik» con los números al revés: igual gana TOBI, del lado b')
    t = una('Dima', 'Lema')
    ok(t and t['b']['id'] == 'fms:nombre:lema' and t['gana'] == 'b',
       'el comodín 9083 es Lema en Colombia: va con id por nombre: %r' % (t and t['b']))
    t = una('Ibán', 'Pirry')
    ok(t and t['b']['id'] == 'fms:nombre:pirry', '…y Pirry en España')
    ok(any('2 contra 1' in a and 'Felpa Divo' in a for a in av), 'el 2 contra 1 de Filósofo se salta y se avisa')
    t = una('URKO', 'Visionario')
    ok(t and t['a']['id'] == 'fms:13349' and t['gana'] == 'b' and t['pts'] == [143, 139],
       'Urko se encuentra aunque urbanroosters escribió 143-239 (la suma de los jueces da 143–139)')
    t = una('Animus', 'Adesong')
    ok(t and t['a']['nombre'] == 'Animus' and t['a']['id'] == 'fms:12654' and t['gana'] == 'a',
       'dos sin perfil (Animus y Adesong) quedan cada uno de su lado')
    meta = [b for b in bs if 'fms:1658' in (b['a']['id'], b['b']['id'])]
    ok(len(meta) == 2 and all('Metalingüística' in (b['a']['nombre'], b['b']['nombre']) for b in meta),
       'Metalingüística (1658) es la misma en sus dos batallas')
    t = una('Facu HDR', 'Larrix')
    ok(bool(t), 'la API dice «FACU HDR» y urbanroosters «Facu HDR»: se queda la segunda')
    t = una('Aczino', 'Pandora')
    ok(t and t['a']['pais'] == 'mx' and t['evento']['pais'] == 'co',
       'Aczino es mexicano aunque compita en FMS Colombia')
    print('\n  lo que no va, y los avisos')
    ok(any('World Cup' in a for a in av), 'la World Cup se salta y se avisa')
    ok(any('FMS MÉXICO' in a and 'no tiene esa jornada' in a for a in av),
       'un post de urbanroosters sin jornada en fms.tv se avisa')
    ok(any('menos puntos' in a and 'TOBI' in a and 'Dybbuk' in a and 'URKO' in a for a in av),
       'se avisa de las 3 batallas que ganó quien sumó menos puntos')
    ok(not any('urbanroosters da ganador' in a or 'no coincide con nada' in a for a in av),
       'urbanroosters respalda cada ganador, marcador y puntos de fms.tv (sus erratas internas no se avisan)')
    j_falso = {'evento': {'nombre': 'J'}}
    u_falso = {'titulo': 'X vs Y', 'votos': [5, 0], 'pts': [150, 140], 'jueces': [('j', 30, 28)] * 5}
    av_c = []
    _controlar({'votos': [5, 0], 'pts': [150, 140]}, u_falso, 'igual', j_falso, av_c)
    _controlar({'votos': [0, 5], 'pts': [140, 150]}, u_falso, 'cruz', j_falso, av_c)
    ok(not av_c, 'lo que coincide (también con los números al revés) no avisa')
    _controlar({'votos': [3, 2], 'pts': [150, 140]}, u_falso, 'igual', j_falso, av_c)
    ok(len(av_c) == 1 and 'el marcador' in av_c[0], 'un marcador de fms.tv que nada respalda, sí: %s' % av_c)
    print('\n  los MVP')
    mv = {m['evento']['id']: (m['quien']['nombre'], m['fuente']) for m in r['mvp']}
    ok(mv == {'fms-co-t5-j1': ('Aczino', 'fms'), 'fms-ar-t8-j1': ('Larrix', 'fms'), 'fms-cl-t7-j1': ('Teorema', 'fms'),
              'fms-es-t9-j1': ('Gazir', 'fms'), 'fms-co-t5-j2': ('Puppy', 'fms')}, 'uno por jornada: %s' % mv)
    ok(not any('MVP' in a for a in av), 'y urbanroosters dice los mismos cinco')
    print('\n  la ventana')
    ok(collections.Counter(b['evento']['id'] for b in r_nov['batallas']) == {'fms-co-t5-j2': 10, 'fms-es-t9-j1': 11},
       'desde el 01/11 quedan la J2 de Colombia y la J1 de España')
    print('\n  sin una de las fuentes')
    crudo = _casos([])
    av2 = []
    r3 = _armar(dict(crudo, mcs=None), '2026-09-22', '2026-12-31', av2)
    ok(not r3['batallas'] and any('API de MCs' in a for a in av2), 'sin la API de MCs, ninguna batalla y un aviso')
    av3 = []
    r4 = _armar(dict(crudo, ur=None), '2026-09-22', '2026-12-31', av3)
    ok(len(r4['batallas']) == 52 and len(r4['mvp']) == 5 and any('provisional' in a for a in av3),
       'sin urbanroosters: %d batallas (salen Lema, Pirry y el 2 contra 1), nombres provisionales de la foto y los 5 '
       'MVP de las insignias' % len(r4['batallas']))
    print('\n  piezas sueltas')
    ok(_replica('Sin réplica') is False and _replica('Con réplica') is True and _replica('') is None,
       '«Sin réplica» es False, «Con réplica» True y nada es None')
    casos_pais = {'Nezahualcoyotl (México)': 'mx', 'Málaga': 'es', ' Jamundi, Valle De Cauca': 'co', '': None,
                  'San Pedro de Macoris (República Dominicana)': 'do', 'Santa Fe (Argentina)': 'ar',
                  'Estado de México, Naucalpan': 'mx', 'Ñuñoa, Chile': 'cl', 'Santa Fe': None}
    ok(all(_pais(k) == v for k, v in casos_pais.items()),
       'el país sale del lugar de nacimiento: %s' % {k: _pais(k) for k in casos_pais})
    ok(_foto('https://x/2023/06/CTZ-1.png') == ('CTZ', False) and _foto('https://x/EXTRA-PLAYER.png') == ('', True)
       and _foto('https://x/image-gen-104.png') == ('', False)
       and _foto('https://x/Compo_Distributiva_mister-ego.png')[0] == 'mister-ego', 'el nombre de la foto, como pista')
    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % len(mal)))
    return 1 if mal else 0


def _ver():
    t0 = time.monotonic()
    r = leer()
    bs = r['batallas']
    print('\n  FMS en vivo: %d batallas · %d MVP · %d avisos · %.1f s\n' % (len(bs), len(r['mvp']), len(r['avisos']),
                                                                        time.monotonic() - t0))
    evs = collections.OrderedDict()
    for b in bs:
        evs.setdefault(b['evento']['id'], [b['evento'], 0])[1] += 1
    mvp = {m['evento']['id']: '%s (%s)' % (m['quien']['nombre'], m['fuente']) for m in r['mvp']}
    for k, (e, n) in evs.items():
        print('   %-40s %s  %2d batallas   MVP %s' % (e['nombre'], e['fecha'], n, mvp.get(k, '—')))
    print('\n  unas de muestra:\n')
    for b in bs[:: max(1, len(bs) // 6)][:6]:
        print('   %s  %-14s %s %s–%s %s  (%s pts)  gana %s · %s  [%s]' % (
            b['evento']['fecha'], b['evento']['id'], b['a']['nombre'], *(b['votos'] or ['?', '?']), b['b']['nombre'],
            '–'.join(map(str, b['pts'] or [])) or '?', b[b['gana']]['nombre'] if b['gana'] else '?',
            'con réplica' if b['replica'] else 'sin réplica', b['id']))
    if r['avisos']:
        print('\n  avisos:\n')
        for a in r['avisos']:
            print('   ⚠️ ', a)
    print('')
    return 0


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:  # noqa: BLE001
        pass
    if '--auto' in sys.argv:
        return _self_check()
    if '--ver' in sys.argv:
        return _ver()
    print(__doc__.split('\n\n')[1])
    return 0


if __name__ == '__main__':
    raise SystemExit(main() or 0)
