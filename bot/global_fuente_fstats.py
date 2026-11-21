# -*- coding: utf-8 -*-
"""🌍 FREESTYLESTATS: LAS LLAVES DE RED BULL Y DE LOS TORNEOS INDEPENDIENTES, PARA EL RANKING GLOBAL.

    python bot/global_fuente_fstats.py --ver     lee en vivo y muestra un resumen (eventos, batallas, avisos)
    python bot/global_fuente_fstats.py --auto    el self-check, sin red: sólo con los casos de bot/global_casos/
    python bot/global_fuente_fstats.py --casos   vuelve a bajar los casos y los recorta (cuando cambie el sitio)

`leer(desde, hasta, red)` devuelve `{'batallas': [...], 'mvp': [], 'avisos': [...]}` con las batallas fechadas
dentro de [desde, hasta]. Cubre las finales nacionales y regionales de Red Bull Batalla, el Torneo de Plazas,
Supremacía MC, Combate Mortal, FU y cualquier otra competencia que el sitio liste en la ventana.

🔑 FMS NO SE LEE ACÁ. Lo trae su propio lector desde fms.tv; si las leyéramos también, cada batalla de FMS contaría
dos veces. Se saltan sin pedirlas (`SALTAR_FMS`) y quedan nombradas en los avisos.

🔑 LO QUE EL SITIO NO DICE, NO SE INVENTA. Freestylestats marca al ganador (negrita y una barra ámbar) y el
marcador de jueces (3-0, 2-1) cuando lo tiene; la «R» es «Tras réplica». Si falta el ganador y la llave muestra quién
pasó de ronda, se deduce y se avisa. Si tampoco, `gana` queda en None y se avisa.

⚠️ EL SITIO TIENE ERRORES A LA VISTA (una batalla sin rival, un podio que contradice la final). Por eso cada llave se
revisa: que los que ganan una ronda sean los que juegan la siguiente, y que el podio coincida con la final. Lo que no
cierra va a los avisos; nada se descarta en silencio.

⚠️ CÓMO LEE LA PÁGINA. Es Next.js: el HTML trae, en los `self.__next_f.push(...)`, el árbol de React serializado
(«flight»). Se lee ese árbol y no el HTML pintado, porque ahí están el `key` de cada batalla (su ID de 24 caracteres),
los perfiles con su `username` (el slug, que no siempre sale del nombre: Exe es `exebb`) y el país de cada uno.

🤝 SE LO PIDE CON CALMA. El dueño aprobó leerlo; igual se pide lo mínimo: el calendario del sitio (su propia
`/api/calendar`, en tramos de 42 días como hace su página) y una página por jornada ya jugada. Nada de FMS, nada de
exhibiciones, nada del futuro. Una pausa de `PAUSA` segundos entre pedido y pedido.
"""
import datetime as dt
import json
import os
import re
import sys
import time
import unicodedata

SCR = os.path.dirname(os.path.abspath(__file__))
CASOS = os.path.join(SCR, 'global_casos')

SITIO = 'https://freestylestats.com'
CABECERAS = {'User-Agent': 'Mozilla/5.0 (compatible; ranking-bot/1.0)'}
PAUSA = 2.5          # segundos entre pedidos: el pedido es «como mucho uno cada 2 s», se deja margen
ESPERA = 30          # timeout de cada pedido
TRAMO = 42           # días por pedido al calendario: es lo que pide su propia página; un rango largo da 400

#: competencias que lee otro lector (fms.tv): se saltan sin pedirlas, para no contar FMS dos veces
SALTAR_FMS = ('fms-',)
#: de Urban Roosters pero no FMS: se leen, y se avisa por si el lector de fms.tv también las trae
TAMBIEN_EN_FMS = ('freestyle-world-cup',)
#: exhibiciones de Red Bull que no son torneo: «Gazir contra todos» son 200 batallas de una sola persona
EXHIBICIONES = ('red-bull-batalla/', 'red-bull-batalla-5-vidas/')
EXHIBICION_NOMBRE = re.compile(r'contra todos|exhibici', re.I)
#: qué tan parecido tiene que ser un nombre de la llave al de un perfil de la jornada para asociarlo (0 a 1)
PARECIDO = 0.85

RONDAS = ('filtro', '32avos', '16avos', 'octavos', 'cuartos', 'semifinal', 'tercer', 'final')
_RONDA_DE = {
    'final': 'final', 'gran final': 'final',
    'tercer y cuarto': 'tercer', 'tercer puesto': 'tercer', 'tercer lugar': 'tercer', '3er puesto': 'tercer',
    'semifinales': 'semifinal', 'semifinal': 'semifinal', 'semis': 'semifinal',
    'cuartos': 'cuartos', 'cuartos de final': 'cuartos',
    'octavos': 'octavos', 'octavos de final': 'octavos',
    '16avos': '16avos', 'dieciseisavos': '16avos', 'dieciseisavos de final': '16avos',
    '32avos': '32avos', 'treintaidosavos': '32avos', 'treintaidosavos de final': '32avos',
    'filtro': 'filtro', 'filtros': 'filtro', 'preliminares': 'filtro', 'preliminar': 'filtro',
    'clasificatoria': 'filtro', 'clasificatorias': 'filtro', 'repechaje': 'filtro',
}
#: textos de la tarjeta de una batalla que no son nombres
_NO_NOMBRE = {'vs', 'VS', 'Vs', '-', '–', '—', 'R', 'Tras réplica', '#'}

_ID = re.compile(r'[0-9a-f]{24}')
_UUID = re.compile(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
_EMPUJE = re.compile(r'self\.__next_f\.push\((\[.*?\])\)</script>', re.S)
#: dónde empieza el segundo stream que Next mete en la misma página: repite filas con otros números
_SEGUNDO = re.compile(r'\n[0-9a-f]+:o[0-9a-f]*,')
_FILA = re.compile(r'([0-9a-f]+):')
_REF = re.compile(r'\$[L@]?([0-9a-f]+)$')
_RUTA = re.compile(r'/competition/([^/?#]+)/([^/?#]+)/([^/?#]+)')


# ─────────────────────────────── la red ───────────────────────────────

class _Red:
    """Un pedido por vez, con pausa entre uno y otro, y un solo reintento si el sitio tropieza."""

    def __init__(self):
        import requests
        self.s = requests.Session()
        self.s.headers.update(CABECERAS)
        self.ultimo = 0.0
        self.pedidos = 0

    def get(self, ruta):
        for intento in (1, 2):
            falta = PAUSA * intento - (time.monotonic() - self.ultimo)
            if falta > 0:
                time.sleep(falta)
            self.pedidos += 1
            try:
                r = self.s.get(SITIO + ruta, timeout=ESPERA)
                codigo, cuerpo = r.status_code, r.content.decode('utf-8', 'replace')
            except Exception as e:  # noqa: BLE001  la red falla de muchas formas; todas se reintentan una vez
                codigo, cuerpo = None, str(e)
            self.ultimo = time.monotonic()
            if codigo == 200:
                return 200, cuerpo
            if codigo not in (None, 429, 500, 502, 503, 504):
                break
        return codigo, cuerpo


# ─────────────────────────────── el árbol de Next ───────────────────────────────

def _vuelo(pagina):
    """El texto del flight de la página, sólo el primer stream (el segundo reusa los números de fila)."""
    partes = []
    for crudo in _EMPUJE.findall(pagina):
        try:
            a = json.loads(crudo)
        except ValueError:
            continue
        if len(a) > 1 and isinstance(a[1], str):
            partes.append(a[1])
    texto = ''.join(partes)
    m = _SEGUNDO.search(texto)
    return texto[:m.start()] if m else texto


def _filas(texto):
    """`id:valor` por línea. Las filas T traen su largo en bytes; el resto es JSON o una marca suelta."""
    filas, pos, n = {}, 0, len(texto)
    dec = json.JSONDecoder()
    while pos < n:
        m = _FILA.match(texto, pos)
        if not m:
            fin = texto.find('\n', pos)
            if fin < 0:
                break
            pos = fin + 1
            continue
        rid, p = m.group(1), m.end()
        mt = re.match(r'T([0-9a-f]+),', texto[p:p + 16])
        if mt:
            largo, ini = int(mt.group(1), 16), p + mt.end()
            s = texto[ini:ini + largo].encode('utf-8')[:largo].decode('utf-8', 'ignore')
            filas.setdefault(rid, s)
            pos = ini + len(s)
            continue
        if texto[p:p + 1] in '[{"-0123456789tfn':
            try:
                v, fin = dec.raw_decode(texto, p)
                filas.setdefault(rid, v)
                pos = fin
                continue
            except ValueError:
                pass
        fin = texto.find('\n', p)
        filas.setdefault(rid, texto[p:fin if fin >= 0 else n])
        pos = fin + 1 if fin >= 0 else n
    return filas


def _deref(v, filas):
    for _ in range(50):
        if not isinstance(v, str):
            return v
        m = _REF.match(v)
        if not m or m.group(1) not in filas:
            return v
        v = filas[m.group(1)]
    return v


def _es_el(v):
    return isinstance(v, list) and len(v) == 4 and v[0] == '$' and isinstance(v[3], dict)


def _hijos(ch):
    """Los hijos directos. Ojo: un hijo único que es elemento también es una lista (`['$', 'div', …]`)."""
    if ch is None:
        return []
    return ch if isinstance(ch, list) and not _es_el(ch) else [ch]


def _recorrer(raiz, filas):
    """Cada elemento con sus ancestros, en orden de documento. Con pila: el árbol es hondo."""
    pila = [(raiz, ())]
    while pila:
        v, anc = pila.pop()
        v = _deref(v, filas)
        if len(anc) > 400:
            continue
        if _es_el(v):
            yield v, anc
            hijos = [x for k, x in v[3].items() if k != 'icon' and isinstance(x, (list, str))]
            for x in reversed(hijos):
                pila.append((x, anc + (v,)))
        elif isinstance(v, list):
            for x in reversed(v):
                pila.append((x, anc))
        elif isinstance(v, dict):
            for x in reversed(list(v.values())):
                if isinstance(x, (list, dict, str)):
                    pila.append((x, anc))


def _textos(v, filas):
    out = []
    for e, _ in _recorrer(v, filas):
        ch = e[3].get('children')
        for t in _hijos(ch):
            t = _deref(t, filas)
            if isinstance(t, bool) or t is None:
                continue
            if isinstance(t, int) or (isinstance(t, str) and t.strip() and not t.startswith('$')):
                out.append(t.strip() if isinstance(t, str) else t)
    return out


def _datos(v, que, out):
    """Recorre JSON crudo (sin seguir referencias) buscando dicts que cumplan `que`."""
    pila = [v]
    while pila:
        x = pila.pop()
        if isinstance(x, dict):
            if que(x):
                out.append(x)
            pila.extend(y for y in x.values() if isinstance(y, (dict, list)))
        elif isinstance(x, list):
            pila.extend(y for y in x if isinstance(y, (dict, list)))
    return out


# ─────────────────────────────── utilidades ───────────────────────────────

def _norm(s):
    t = unicodedata.normalize('NFKD', str(s or '').lower())
    return ''.join(c for c in t if c.isalnum() and not unicodedata.combining(c))


def _pais(emoji):
    """🇦🇷 → 'ar'. Las banderas son dos «letras regionales»; cualquier otra cosa es None."""
    letras = [ord(c) - 0x1F1E6 for c in str(emoji or '') if 0x1F1E6 <= ord(c) <= 0x1F1FF]
    return ''.join(chr(97 + x) for x in letras) if len(letras) == 2 else None


def _es_bandera(s):
    return bool(s) and all(0x1F1E6 <= ord(c) <= 0x1F1FF for c in s.strip())


def _fecha_local(iso, zona):
    """La fecha del lugar: el sitio guarda UTC, y una final de las 18 h en México ya es «mañana» en UTC."""
    try:
        t = dt.datetime.fromisoformat(str(iso).replace('Z', '+00:00'))
    except ValueError:
        return None
    try:
        import zoneinfo
        t = t.astimezone(zoneinfo.ZoneInfo(zona))
    except Exception:  # noqa: BLE001  sin base de zonas (Windows sin tzdata): queda en UTC
        pass
    return t.date().isoformat()


_MENORES = {'de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'o', 'u', 'en', 'a', 'por', 'contra', 'con', 'vs'}


def _titulo(s):
    pal = str(s or '').split(' ')
    return ' '.join(p if (i and p.lower() in _MENORES) or not p else p[0].upper() + p[1:] for i, p in enumerate(pal))


def _temporada(s):
    """«2026 / 2027» → «2026/27»; «2026» queda igual."""
    m = re.match(r'\s*(\d{4})\s*[/-]\s*(\d{2})(\d{2})\s*$', str(s or ''))
    return '%s/%s' % (m.group(1), m.group(3)) if m else str(s or '').strip()


def _ronda(etiqueta):
    return _RONDA_DE.get(re.sub(r'\s+', ' ', str(etiqueta or '').strip().lower()))


# ─────────────────────────────── una jornada ───────────────────────────────

def _meta(filas):
    for v in filas.values():
        for d in _datos(v, lambda x: isinstance(x.get('matchday'), dict) and 'season' in x['matchday']
                        and 'slug' in x['matchday'], []):
            return d['matchday']
    return None


def _perfiles(filas):
    """Los perfiles de la página: por foto y por nombre. Los de la lista de freestylers (con historial) mandan."""
    por_foto, por_nombre, freestylers = {}, {}, {}
    vistos = _datos(list(filas.values()), lambda x: isinstance(x.get('username'), str) and 'name' in x, [])
    for p in sorted(vistos, key=lambda x: ('matchdays' not in x, 'birth_country' not in x)):
        per = {'slug': p['username'], 'nombre': p.get('name') or p['username'],
               'pais': _pais(((p.get('birth_country') or {}).get('emoji')))}
        if 'matchdays' in p:
            freestylers.setdefault(per['slug'], per)
        foto = (p.get('picture') or {}).get('id') if isinstance(p.get('picture'), dict) else None
        if foto:
            per['foto'] = foto
            por_foto.setdefault(foto, per)
        por_nombre.setdefault(_norm(per['nombre']), [])
        if all(x['slug'] != per['slug'] for x in por_nombre[_norm(per['nombre'])]):
            por_nombre[_norm(per['nombre'])].append(per)
        elif per['pais']:
            for x in por_nombre[_norm(per['nombre'])]:
                if x['slug'] == per['slug'] and not x['pais']:
                    x['pais'] = per['pais']
    return por_foto, por_nombre, list(freestylers.values())


def _es_frag(e, filas):
    return _deref(e[1], filas) == '$Sreact.fragment'


def _clase(e):
    c = e[3].get('className')
    return c if isinstance(c, str) else ''


def _lado(sub, filas):
    """Un lado de la batalla: nombres, fotos, números (jueces) y si el sitio lo marca como ganador."""
    lado = {'nombres': [], 'fotos': [], 'votos': [], 'marca': False}
    for e, anc in _recorrer(sub, filas):
        p, cls = e[3], _clase(e)
        if isinstance(p.get('src'), str):
            m = _UUID.search(p['src'])
            if m:
                lado['fotos'].append(m.group(0))
        if any('rounded-full' in _clase(a) for a in anc + (e,)):
            continue                       # el avatar: sin foto pinta la inicial («M»), que no es un nombre
        if 'bg-amber' in cls and 'absolute' in cls:
            lado['marca'] = True           # la barrita ámbar de la llave
        for t in _hijos(p.get('children')):
            t = _deref(t, filas)
            if isinstance(t, bool) or t is None:
                continue
            if isinstance(t, int):
                lado['votos'].append(t)
            elif isinstance(t, str) and t.strip() and not t.startswith('$') and t.strip() not in _NO_NOMBRE \
                    and not _es_bandera(t):
                lado['nombres'].append(t.strip())
                if 'font-semibold' in cls or 'decoration-amber' in cls:
                    lado['marca'] = True   # el nombre del ganador va en negrita
    return lado


def _lados(e, filas):
    """La vista de lista arma cada lado como un fragmento; la llave, como una fila de una grilla `divide-y`."""
    frags = [x for x, anc in _recorrer(e[3].get('children'), filas)
             if _es_frag(x, filas) and not any(_es_frag(a, filas) for a in anc)]
    if len(frags) >= 2:
        return [_lado(f, filas) for f in frags]
    for x, _ in _recorrer(e[3].get('children'), filas):
        if 'divide-y' in _clase(x) and 'grid' in _clase(x):
            hijos = [h for h in (_deref(c, filas) for c in _hijos(x[3].get('children'))) if _es_el(h)]
            return [_lado(h, filas) for h in hijos]
    return None


def _etapa(anc, filas):
    """La ronda: el ancestro más cercano con `key` propio cuyo primer hijo es un rótulo («Octavos»)."""
    for a in reversed(anc):
        k = a[2]
        if a[1] in ('li', 'div') and isinstance(k, str) and k and not _ID.fullmatch(k):
            ch = _hijos(_deref(a[3].get('children'), filas))
            primero = _deref(ch[0], filas) if ch else None
            if _es_el(primero):
                t = [x for x in _textos(primero, filas) if isinstance(x, str)]
                if t:
                    return t[0]
    return None


def _batallas_crudas(filas):
    """{id: [(etapa, lados, réplica), …]}: cada batalla aparece en la llave y en la lista; se juntan después."""
    usadas = set()
    for v in filas.values():
        if isinstance(v, (list, dict)):
            usadas.update(re.findall(r'"\$[L@]?([0-9a-f]+)"', json.dumps(v)))
    raices = [rid for rid, v in filas.items() if rid not in usadas and isinstance(v, (list, dict))]
    out = {}
    for rid in raices:
        for e, anc in _recorrer(filas[rid], filas):
            k = e[2]
            if e[1] not in ('li', 'div') or not isinstance(k, str) or not _ID.fullmatch(k):
                continue
            if any(isinstance(a[2], str) and _ID.fullmatch(a[2]) for a in anc):
                continue
            todo = _textos(e, filas)
            replica = 'Tras réplica' in todo or any(x[3].get('title') == 'Tras réplica' for x, _ in _recorrer(e, filas))
            out.setdefault(k, []).append((_etapa(anc, filas), e[1], _lados(e, filas), replica))
    return out


def _url_foto(i):
    """📸 La foto de perfil de Freestylestats (su servidor de archivos la recorta y achica: global_fotos.py)."""
    return 'https://assets.freestylestats.com/assets/' + i if i and re.match(r'^[0-9a-f-]{20,}$', str(i)) else ''


def _quien(lado, perfiles, avisos, donde):
    """El perfil de un lado: por la foto, si no por el nombre, y si no por parecido con los de la jornada."""
    por_foto, por_nombre, freestylers = perfiles
    nombre = lado['nombres'][0]
    for f in lado['fotos']:
        if f in por_foto:
            p = por_foto[f]
            return {'nombre': p['nombre'], 'id': 'fstats:' + p['slug'], 'pais': p['pais'], 'foto': _url_foto(f)}
    cand = por_nombre.get(_norm(nombre)) or []
    if len(cand) == 1:
        p = cand[0]
        return {'nombre': p['nombre'], 'id': 'fstats:' + p['slug'], 'pais': p['pais'], 'foto': _url_foto(p.get('foto'))}
    if not cand and freestylers:
        # la llave puede escribir el nombre distinto que el perfil (Maniak / Maniack): sin foto, queda el parecido
        import difflib
        notas = sorted(((difflib.SequenceMatcher(None, _norm(nombre), _norm(p['nombre'])).ratio(), p['slug'], p)
                        for p in freestylers), key=lambda x: (-x[0], x[1]))
        if notas and notas[0][0] >= PARECIDO and (len(notas) == 1 or notas[1][0] < notas[0][0]):
            p = notas[0][2]
            avisos.append('%s: «%s» no tiene perfil con ese nombre; lo asocio a «%s» (%s) por parecido' % (
                donde, nombre, p['nombre'], p['slug']))
            return {'nombre': p['nombre'], 'id': 'fstats:' + p['slug'], 'pais': p['pais'], 'foto': _url_foto(p.get('foto'))}
    avisos.append('%s: «%s» %s; le pongo un id provisorio' % (
        donde, nombre, 'tiene %d perfiles con ese nombre' % len(cand) if cand else 'no tiene perfil en la página'))
    return {'nombre': nombre, 'id': 'fstats:?' + (_norm(nombre) or 'sin-nombre'), 'pais': None}


def _tipo(comp, padre, partido, nombre_fase):
    """El tipo del evento, con lo que el sitio dice de sí mismo (`type`, `scope`) y el slug."""
    es_rb = (padre or comp).startswith('red-bull-batalla')
    if not es_rb:
        return 'independiente'
    if 'torneo-de-plazas' in comp:
        return 'plazas_final' if _norm(nombre_fase) in ('final', 'granfinal') else 'plaza'
    if comp.endswith('-internacional'):
        return 'rb_internacional'
    if partido.get('type') == 'regional' or partido.get('scope') == 'regional' or 'regional' in nombre_fase.lower():
        return 'rb_regional'
    if 'equipos' in comp:
        return 'independiente'
    return 'rb_nacional'


def _evento(md, url, fecha=None):
    m = _RUTA.search(url or '')
    temp = md.get('season') or {}
    comp_d = temp.get('competition') or {}
    padre = comp_d.get('parent') or {}
    comp = m.group(1) if m else comp_d.get('slug') or ''
    edicion = m.group(2) if m else ''
    fase = m.group(3) if m else ''
    nombre_comp = ' '.join(x for x in (padre.get('name'), comp_d.get('name')) if x) or comp
    pais = _pais((md.get('country') or {}).get('emoji'))
    tipo = _tipo(comp, padre.get('slug') or '', md, md.get('name') or fase)
    fecha_md = _fecha_local(md.get('start_datetime'), (md.get('location') or {}).get('timezone') or 'UTC')
    return {
        'id': 'fstats-%s-%s-%s' % (comp, edicion, fase),
        'nombre': '%s %s · %s' % (nombre_comp, _temporada(temp.get('name')), _titulo(md.get('name') or fase)),
        'tipo': tipo,
        # el país de un torneo internacional es sólo la sede: no dice nada del nivel del torneo
        'pais': pais if (md.get('scope') in ('national', 'regional', 'local') or tipo in ('rb_nacional', 'rb_regional', 'plaza')) else None,
        'fecha': fecha or fecha_md,
    }, fecha_md


def jornada(pagina, url, fecha=None):
    """Una página de jornada → (evento, batallas, avisos). Sin red: sirve igual para los casos guardados."""
    avisos = []
    filas = _filas(_vuelo(pagina))
    md = _meta(filas)
    if not md:
        return None, [], ['%s: no encontré los datos de la jornada en la página (¿cambió el sitio?)' % url]
    ev, fecha_md = _evento(md, url, fecha)
    nom = ev['nombre']
    if fecha and fecha_md and fecha != fecha_md:
        avisos.append('%s: el calendario dice %s y la página %s; uso la del calendario' % (nom, fecha, fecha_md))
    perfiles = _perfiles(filas)
    crudas = _batallas_crudas(filas)
    llave = bool(md.get('single_elimination_tournament'))
    podio = {x.get('position'): (x.get('freestyler') or {}).get('username') for x in md.get('leaderboard') or []}

    # lo de cada batalla va aparte: si la jornada entera no tiene resultados, sólo se dice eso
    bats, raras, sin_res, av_bat, saltadas = [], {}, 0, [], {}
    for bid, variantes in crudas.items():
        etapa = next((v[0] for v in variantes if v[0]), None)
        buenas = [v for v in variantes if v[2] and len(v[2]) == 2 and all(len(x['nombres']) == 1 for x in v[2])]
        if not buenas:
            saltadas[_ronda(etapa)] = saltadas.get(_ronda(etapa), 0) + 1
            v = max(variantes, key=lambda v: len(v[2] or []))
            lados = v[2] or []
            con_nombre = [x for x in lados if x['nombres']]
            if len(con_nombre) < 2 and len(lados) <= 2:
                av_bat.append('%s: la batalla %s (%s) no tiene rival cargado; la salto' % (
                    nom, bid, ' / '.join(x['nombres'][0] for x in con_nombre) or 'sin nombres'))
            else:
                forma = ' vs '.join('+'.join(x['nombres']) for x in lados)
                raras.setdefault('que no son 1 contra 1', []).append(forma)
            continue
        lista = next((v for v in buenas if v[1] == 'li'), buenas[0])
        a, b = lista[2]
        marca = [a['marca'], b['marca']]
        votos = [a['votos'][0] if len(a['votos']) == 1 else None, b['votos'][0] if len(b['votos']) == 1 else None]
        for otra in buenas:     # lo que falte en una vista puede estar en la otra (la llave pinta la barra)
            if otra is lista:
                continue
            orden = [0, 1] if _norm(otra[2][0]['nombres'][0]) == _norm(a['nombres'][0]) else [1, 0]
            for i, j in enumerate(orden):
                marca[i] = marca[i] or otra[2][j]['marca']
                if votos[i] is None and len(otra[2][j]['votos']) == 1:
                    votos[i] = otra[2][j]['votos'][0]
        replica = any(v[3] for v in variantes)
        donde = '%s, %s' % (nom, bid)
        ra = _ronda(etapa)
        if etapa and not ra:
            raras.setdefault('batalla(s) con una ronda que no conozco', []).append(etapa)
        elif not etapa:
            raras.setdefault('batalla(s) sin ronda', []).append(bid)
        rec = {'id': 'fstats:' + bid, 'fuente': 'fstats', 'url': SITIO + '/battle/' + bid, 'evento': ev,
               'ronda': ra, 'a': _quien(a, perfiles, av_bat, donde),
               'b': _quien(b, perfiles, av_bat, donde), 'gana': None, 'replica': None,
               'votos': votos if None not in votos and votos != [0, 0] else None, 'pts': None}
        gana_marca = ('a' if marca[0] else 'b') if marca[0] != marca[1] else None
        gana_votos = None
        if rec['votos'] and rec['votos'][0] != rec['votos'][1]:
            gana_votos = 'a' if rec['votos'][0] > rec['votos'][1] else 'b'
        if gana_marca and gana_votos and gana_marca != gana_votos:
            av_bat.append('%s: marca ganador a %s pero el marcador %d-%d dice otra cosa; no le creo a ninguno%s' % (
                donde, rec[gana_marca]['nombre'], rec['votos'][0], rec['votos'][1],
                ' y lo resuelve la llave si puede' if llave else ''))
        else:
            rec['gana'] = gana_marca or gana_votos
        if rec['gana']:
            rec['replica'] = replica
        elif replica:
            rec['replica'] = True
        if not rec['gana'] and not rec['votos'] and not replica:
            sin_res += 1
        bats.append(rec)

    if raras.get('que no son 1 contra 1'):
        c = raras.pop('que no son 1 contra 1')
        avisos.append('%s: %d batalla(s) que no son 1 contra 1, las salto: %s' % (nom, len(c), ', '.join(c[:6])))
    if bats and sin_res == len(bats):
        avisos.append('%s: ninguna de sus %d batallas tiene resultado cargado (ni ganador ni marcador); no cuento ninguna'
                      % (nom, len(bats)))
        return ev, [], avisos
    for que, cuales in raras.items():
        av_bat.append('%s: %d %s (`ronda` queda en None): %s' % (
            nom, len(cuales), que, ', '.join(sorted(set(map(str, cuales)))[:6])))
    avisos += av_bat
    if llave:
        _cerrar_llave(bats, podio, nom, avisos, saltadas)
    sin = [b for b in bats if not b['gana']]
    if sin:
        avisos.append('%s: %d batalla(s) quedan sin ganador: %s' % (
            nom, len(sin), ', '.join('%s vs %s' % (b['a']['nombre'], b['b']['nombre']) for b in sin[:6])))
    return ev, bats, avisos


def _clave(lado):
    return lado['id']


def _cerrar_llave(bats, podio, nom, avisos, saltadas=None):
    """Deduce lo que falta con la llave y revisa que cierre: cada ronda alimenta a la siguiente y el podio a la final."""
    principales = [r for r in RONDAS if r != 'tercer']
    por = {}
    for b in bats:
        por.setdefault(b['ronda'], []).append(b)
    presentes = [r for r in principales if r in por]

    def siguen(ronda):
        later = presentes[presentes.index(ronda) + 1:] if ronda in presentes else []
        return {_clave(b[x]) for r in later for b in por[r] for x in 'ab'}

    podio_id = {k: 'fstats:' + v for k, v in podio.items() if v}
    for b in bats:
        if b['gana']:
            continue
        ganador = None
        if b['ronda'] == 'final' and podio_id.get(1):
            ganador = next((x for x in 'ab' if b[x]['id'] == podio_id[1]), None)
            como = 'el podio'
        elif b['ronda'] == 'tercer' and podio_id.get(3):
            ganador = next((x for x in 'ab' if b[x]['id'] == podio_id[3]), None)
            como = 'el podio'
        elif b['ronda'] in presentes:
            s = siguen(b['ronda'])
            en = [x for x in 'ab' if _clave(b[x]) in s]
            ganador = en[0] if len(en) == 1 else None
            como = 'quién pasó de ronda'
        if ganador:
            b['gana'] = ganador
            avisos.append('%s: %s vs %s no tiene ganador marcado; lo deduje por %s: %s' % (
                nom, b['a']['nombre'], b['b']['nombre'], como, b[ganador]['nombre']))

    for r1, r2 in zip(presentes, presentes[1:]):
        if any(not b['gana'] for b in por[r1]):
            continue
        ganaron = {_clave(b[b['gana']]): b[b['gana']]['nombre'] for b in por[r1]}
        juegan = {_clave(b[x]): b[x]['nombre'] for b in por[r2] for x in 'ab'}
        # si la ronda anterior no alcanza para llenar la siguiente, hay cabezas de serie (un filtro que suma a
        # los ya clasificados): ahí sólo se pregunta si los que ganaron siguen
        cupo = len(por[r1]) + (saltadas or {}).get(r1, 0)
        de_mas = [n for k, n in juegan.items() if k not in ganaron] if cupo >= len(juegan) else []
        de_menos = [n for k, n in ganaron.items() if k not in juegan]
        if de_mas or de_menos:
            avisos.append('%s: la llave no cierra entre %s y %s%s%s' % (
                nom, r1, r2, ('; juegan sin haber ganado: ' + ', '.join(de_mas)) if de_mas else '',
                ('; ganaron y no siguen: ' + ', '.join(de_menos)) if de_menos else ''))
    for b in por.get('final', [])[:1]:
        if b['gana'] and podio_id.get(1) and b[b['gana']]['id'] != podio_id[1]:
            avisos.append('%s: la final la gana %s pero el podio pone primero a %s' % (
                nom, b[b['gana']]['nombre'], podio[1]))
        perdio = 'b' if b['gana'] == 'a' else 'a'
        if b['gana'] and podio_id.get(2) and b[perdio]['id'] != podio_id[2]:
            avisos.append('%s: la final la pierde %s pero el podio pone segundo a %s' % (
                nom, b[perdio]['nombre'], podio[2]))
    for b in por.get('tercer', [])[:1]:
        if b['gana'] and podio_id.get(3) and b[b['gana']]['id'] != podio_id[3]:
            avisos.append('%s: el tercer puesto lo gana %s pero el podio pone tercero a %s' % (
                nom, b[b['gana']]['nombre'], podio[3]))


# ─────────────────────────────── el calendario ───────────────────────────────

def _eventos_api(cuerpo):
    try:
        datos = json.loads(cuerpo)
    except ValueError:
        return None
    return datos if isinstance(datos, list) else None


def _eventos_pagina(pagina):
    """Plan B: la página /calendar?date=AAAA-MM trae los mismos eventos en `initialEvents`."""
    texto = _vuelo(pagina)
    m = re.search(r'"initialEvents":\s*', texto)
    if not m:
        return None
    try:
        v, _ = json.JSONDecoder().raw_decode(texto, m.end())
    except ValueError:
        return None
    return v if isinstance(v, list) else None


def _filtrar(eventos, desde, hasta, hoy, avisos):
    """De lo que lista el calendario, lo que hay que pedir: en la ventana, ya jugado, ni FMS ni exhibición."""
    pedir, fms, exh, pospuestos, vistos = [], [], [], [], set()
    for e in eventos:
        url, fecha = e.get('url') or '', str(e.get('start') or '')[:10]
        if not _RUTA.search(url) or url in vistos or not (desde <= fecha <= hasta):
            continue
        vistos.add(url)
        nombre = e.get('title') or url
        comp = _RUTA.search(url).group(1)
        if comp.startswith(SALTAR_FMS):
            fms.append(nombre)
        elif any(('/competition/' + x) in url for x in EXHIBICIONES) or EXHIBICION_NOMBRE.search(nombre):
            exh.append(nombre)
        elif (e.get('extendedProps') or {}).get('postponed'):
            pospuestos.append(nombre)
        elif fecha > hoy:
            continue
        else:
            pedir.append({'url': url, 'fecha': fecha, 'nombre': nombre})
    if fms:
        avisos.append('salto %d jornada(s) de FMS, las trae el lector de fms.tv: %s' % (len(fms), ', '.join(fms)))
    if exh:
        avisos.append('salto %d exhibición(es), no son torneo: %s' % (len(exh), ', '.join(exh)))
    if pospuestos:
        avisos.append('%d jornada(s) postergadas, no las leo: %s' % (len(pospuestos), ', '.join(pospuestos)))
    dobles = [e['nombre'] for e in pedir if _RUTA.search(e['url']).group(1).startswith(TAMBIEN_EN_FMS)]
    if dobles:
        avisos.append('leo %s, que también publica fms.tv: si el lector de FMS la trae, hay que deduplicar '
                      '(mismo día y mismos MCs)' % ', '.join(dobles))
    return sorted(pedir, key=lambda x: (x['fecha'], x['url']))


def _calendario(red, desde, hasta, avisos):
    eventos, d = [], dt.date.fromisoformat(desde)
    fin = dt.date.fromisoformat(hasta) + dt.timedelta(days=1)
    while d < fin:
        h = min(d + dt.timedelta(days=TRAMO), fin)
        codigo, cuerpo = red.get('/api/calendar?start=%s&end=%s' % (d.isoformat(), h.isoformat()))
        lote = _eventos_api(cuerpo) if codigo == 200 else None
        if lote is None:
            # el plan B es la página del mes, que el sitio sí publica; se piden los meses del tramo
            avisos.append('el calendario (/api/calendar) respondió %s para %s → %s; uso la página del mes' % (
                codigo, d, h))
            lote = []
            mes = d.replace(day=1)
            while mes < h:
                c2, pag = red.get('/calendar?date=%04d-%02d' % (mes.year, mes.month))
                ev = _eventos_pagina(pag) if c2 == 200 else None
                if ev is None:
                    avisos.append('🔴 tampoco pude leer /calendar?date=%04d-%02d (%s)' % (mes.year, mes.month, c2))
                lote += ev or []
                mes = (mes + dt.timedelta(days=32)).replace(day=1)
        eventos += lote
        d = h
    return eventos


# ─────────────────────────────── lo que se llama de afuera ───────────────────────────────

def _casos_guardados():
    if not os.path.isdir(CASOS):
        return []
    return sorted(os.path.join(CASOS, f) for f in os.listdir(CASOS) if f.startswith('fstats_') and f.endswith('.html'))


def _url_del_caso(pagina):
    m = re.search(r'<link rel="canonical" href="(https://freestylestats\.com/competition/[^"]+)"', pagina)
    if m:
        return m.group(1)
    m = re.search(r'https://freestylestats\.com/competition/[^"\s\\]+', pagina)
    return m.group(0) if m else ''


#: cuántos pedidos hizo la última lectura en vivo (lo muestra --ver)
ULTIMA = {'pedidos': 0}


def _hoy():
    """El día en hora del este, como todo el proyecto. El runner de GitHub está en UTC."""
    try:
        import zoneinfo
        return dt.datetime.now(zoneinfo.ZoneInfo('America/New_York')).date().isoformat()
    except Exception:  # noqa: BLE001
        return dt.date.today().isoformat()


def leer(desde='2026-09-22', hasta='2026-12-31', red=True):
    """Returns {'batallas': [...], 'mvp': [], 'avisos': [...]} for battles dated within [desde, hasta]."""
    avisos, batallas, eventos = [], [], []
    hoy = _hoy()
    if red:
        try:
            r = _Red()
        except ImportError:
            return {'batallas': [], 'mvp': [], 'avisos': ['🔴 falta `requests`: no puedo leer freestylestats.com']}
        lista = _filtrar(_calendario(r, desde, min(hasta, hoy), avisos), desde, hasta, hoy, avisos)
        for e in lista:
            codigo, pagina = r.get(e['url'])
            if codigo != 200:
                avisos.append('🔴 %s: la página respondió %s; no la leo' % (e['nombre'], codigo))
                continue
            eventos.append((pagina, SITIO + e['url'], e['fecha']))
        ULTIMA['pedidos'] = r.pedidos
    else:
        for f in _casos_guardados():
            with open(f, 'rb') as fh:
                pagina = fh.read().decode('utf-8')
            if 'initialEvents' in pagina:
                continue      # el caso del calendario: lo prueba el self-check aparte
            url = _url_del_caso(pagina)
            m = _RUTA.search(url)
            if m and (m.group(1).startswith(SALTAR_FMS) or any(('/competition/' + x) in url for x in EXHIBICIONES)):
                continue
            eventos.append((pagina, url, None))
    for pagina, url, fecha in eventos:
        ev, bats, av = jornada(pagina, url, fecha)
        if ev and not (desde <= (ev['fecha'] or '') <= hasta):
            continue      # sólo pasa sin red: en vivo el calendario ya filtró por fecha
        avisos += av
        batallas += bats
    if red and not eventos and not any(a.startswith('🔴') for a in avisos):
        avisos.append('no hay jornadas jugadas entre %s y %s (fuera de FMS y exhibiciones)' % (desde, min(hasta, hoy)))
    return {'batallas': batallas, 'mvp': [], 'avisos': avisos}


# ─────────────────────────────── los casos (fixtures) ───────────────────────────────

def _compacto(v):
    return json.dumps(v, ensure_ascii=False, separators=(',', ':'))


_CLASES = ('font-semibold', 'bg-amber-200', 'absolute', 'decoration-amber-200', 'divide-y', 'grid', 'rounded-full')


def _podar(v, filas, prof=0):
    """Copia un subárbol con las referencias resueltas y sólo lo que el lector mira. Es lo que va a los casos."""
    v = _deref(v, filas)
    if prof > 300:
        return None
    if _es_el(v):
        p = v[3]
        tipo = _deref(v[1], filas)
        if isinstance(tipo, str) and tipo.startswith('I['):
            tipo = 'Image' if 'src' in p else 'Link'
        nuevo = {}
        for k in ('href', 'src', 'alt', 'title'):
            if isinstance(p.get(k), str):
                nuevo[k] = p[k].split('?')[0] if k == 'src' else p[k]
        cls = ' '.join(c for c in _clase(v).split() if c in _CLASES)
        if cls:
            nuevo['className'] = cls
        if 'children' in p:
            nuevo['children'] = _podar(p['children'], filas, prof + 1)
        return ['$', tipo, v[2], nuevo]
    if isinstance(v, list):
        return [x for x in (_podar(x, filas, prof + 1) for x in v) if x is not None]
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return v
    if isinstance(v, str):
        return None if v.startswith('$') and v != '$Sreact.fragment' else v
    return None


def recortar(pagina):
    """Una página de jornada → un HTML chico con lo mismo que el lector necesita (meta, perfiles y batallas)."""
    filas = _filas(_vuelo(pagina))
    md = dict(_meta(filas) or {})
    for k in ('videos', 'posters'):
        md.pop(k, None)
    perfiles = _datos(list(filas.values()), lambda x: isinstance(x.get('username'), str) and 'name' in x, [])
    gente = {}
    for p in perfiles:
        q = {k: p[k] for k in ('id', 'username', 'name', 'picture', 'birth_country') if k in p}
        if isinstance(q.get('birth_country'), dict):
            q['birth_country'] = {'emoji': q['birth_country'].get('emoji')}
        if 'matchdays' in p:
            q['matchdays'] = []
        if p['username'] not in gente or 'matchdays' in q:
            gente[p['username']] = q
    contenedores, vistos = [], set()
    usadas = set()
    for v in filas.values():
        if isinstance(v, (list, dict)):
            usadas.update(re.findall(r'"\$[L@]?([0-9a-f]+)"', json.dumps(v)))
    for rid in [r for r, v in filas.items() if r not in usadas and isinstance(v, (list, dict))]:
        for e, anc in _recorrer(filas[rid], filas):
            k = e[2]
            if e[1] in ('li', 'div') and isinstance(k, str) and _ID.fullmatch(k) \
                    and not any(isinstance(a[2], str) and _ID.fullmatch(a[2]) for a in anc):
                cont = next((a for a in reversed(anc) if isinstance(a[2], str) and a[2] and not _ID.fullmatch(a[2])
                             and a[1] in ('li', 'div')), e)
                if id(cont) not in vistos:
                    vistos.add(id(cont))
                    contenedores.append(_podar(cont, filas))
    lineas = ['1:' + _compacto(['$', 'div', None, {'matchday': md}]),
              '2:' + _compacto(['$', 'div', None, {'participants': list(gente.values())}])]
    for i, c in enumerate(contenedores):
        lineas.append('%x:%s' % (16 + i, _compacto(['$', 'section', 's%d' % i, {'children': [c]}])))
    canon = re.search(r'<link rel="canonical" href="[^"]+"/>', pagina)
    return ('<!DOCTYPE html><html lang="es"><head><meta charSet="utf-8"/>%s</head><body>'
            '<script>self.__next_f.push(%s)</script></body></html>\n') % (
        canon.group(0) if canon else '', _compacto([1, '\n'.join(lineas) + '\n']))


def recortar_calendario(pagina):
    eventos = _eventos_pagina(pagina) or []
    texto = '9:' + _compacto(['$', 'div', None, {'initialEvents': eventos}]) + '\n'
    return ('<!DOCTYPE html><html lang="es"><head><meta charSet="utf-8"/></head><body>'
            '<script>self.__next_f.push(%s)</script></body></html>\n') % _compacto([1, texto])


#: los casos que baja `--casos`: (archivo, ruta). El «armado» no se baja: se arma a mano sobre el de Combate Mortal.
CASOS_VIVOS = (
    ('fstats_rb_argentina.html', '/competition/red-bull-batalla-argentina/2026-2027/final-nacional'),
    ('fstats_rb_chile_sur.html', '/competition/red-bull-batalla-chile/2026-2027/regional-sur'),
    ('fstats_plazas_final.html', '/competition/red-bull-batalla-torneo-de-plazas/2026-2027/final'),
    ('fstats_combate_mortal.html', '/competition/combate-mortal-freestyle-internacional/2026/final'),
    ('fstats_fu_fecha5.html', '/competition/fu/2026/fecha-5'),
    ('fstats_calendario.html', '/calendar?date=2026-10'),
)


def _bajar_casos():
    r = _Red()
    os.makedirs(CASOS, exist_ok=True)
    for nombre, ruta in CASOS_VIVOS:
        codigo, pagina = r.get(ruta)
        if codigo != 200:
            print('🔴 %s respondió %s' % (ruta, codigo))
            return 1
        chico = recortar_calendario(pagina) if ruta.startswith('/calendar') else recortar(pagina)
        with open(os.path.join(CASOS, nombre), 'w', encoding='utf-8', newline='\n') as fh:
            fh.write(chico)
        print('✅ %-28s %7d → %6d bytes' % (nombre, len(pagina.encode('utf-8')), len(chico.encode('utf-8'))))
    return 0


# ─────────────────────────────── --ver y --auto ───────────────────────────────

def _ver():
    t0 = time.monotonic()
    ULTIMA['pedidos'] = 0
    res = leer()
    por = {}
    for b in res['batallas']:
        por.setdefault(b['evento']['id'], []).append(b)
    print('\n══ FREESTYLESTATS, EN VIVO (%d pedidos, %.0f s) ══\n' % (ULTIMA['pedidos'], time.monotonic() - t0))
    for eid, bs in sorted(por.items(), key=lambda kv: kv[1][0]['evento']['fecha']):
        ev = bs[0]['evento']
        con = sum(1 for b in bs if b['gana'])
        print('  %s  %-58s %-15s %-3s %2d batallas (%d con ganador)' % (
            ev['fecha'], ev['nombre'][:58], ev['tipo'], ev['pais'] or '—', len(bs), con))
    print('\n  ejemplos:')
    for bs in list(por.values())[:6]:
        for b in bs[:2]:
            g = b[b['gana']]['nombre'] if b['gana'] else '¿?'
            print('    %-10s %-18s vs %-18s → %-14s %s%s' % (
                b['ronda'], b['a']['nombre'], b['b']['nombre'], g,
                '%d-%d' % tuple(b['votos']) if b['votos'] else '', ' R' if b['replica'] else ''))
    print('\n  avisos (%d):' % len(res['avisos']))
    for a in res['avisos']:
        print('    · ' + a)
    print('\n  %d batallas en %d eventos\n' % (len(res['batallas']), len(por)))
    return 0 if res['batallas'] or not any(a.startswith('🔴') for a in res['avisos']) else 1


def _self_check():
    print('\n══ FREESTYLESTATS ══\n')
    mal = 0

    def ok(c, q, extra=''):
        nonlocal mal
        mal += not c
        print('   %s %s%s' % ('✅' if c else '🔴', q, ('  ' + str(extra)[:300]) if extra and not c else ''))

    def caso(nombre):
        with open(os.path.join(CASOS, nombre), 'rb') as fh:
            return fh.read().decode('utf-8')

    falta = [n for n, _ in CASOS_VIVOS if not os.path.exists(os.path.join(CASOS, n))]
    ok(not falta, 'están los casos guardados', falta)
    if falta:
        print('\n  🔴 sin casos no hay prueba\n')
        return 1

    # la forma, exacta: es lo que el orquestador lee
    ev, bats, av = jornada(caso('fstats_rb_argentina.html'),
                           SITIO + '/competition/red-bull-batalla-argentina/2026-2027/final-nacional')
    claves = {'id', 'fuente', 'url', 'evento', 'ronda', 'a', 'b', 'gana', 'replica', 'votos', 'pts'}
    ok(bats and all(set(b) == claves for b in bats), 'cada batalla trae exactamente las claves pedidas',
       bats and set(bats[0]) ^ claves)
    ok(ev == {'id': 'fstats-red-bull-batalla-argentina-2026-2027-final-nacional',
              'nombre': 'Red Bull Batalla Argentina 2026/27 · Final Nacional', 'tipo': 'rb_nacional', 'pais': 'ar',
              'fecha': '2026-10-02'}, 'el evento: id, nombre, tipo rb_nacional, país y fecha local', ev)
    ok(len(bats) == 15 and not av, 'Argentina: las 15 batallas, la llave cierra y el podio coincide', (len(bats), av))
    fin = next((b for b in bats if b['ronda'] == 'final'), None)
    ok(fin and fin['id'] == 'fstats:6ac045895d3779841b073f02' and fin['b']['nombre'] == 'Mecha'
       and fin['b']['id'] == 'fstats:mecha' and fin['a']['id'] == 'fstats:tobi' and fin['gana'] == 'b'
       and fin['votos'] == [0, 3] and fin['replica'] is False and fin['a']['pais'] == 'ar',
       'la final: Mecha le gana 3-0 a 1Tobi (slug «tobi»), sin réplica', fin)
    semi = next((b for b in bats if b['id'] == 'fstats:6ac03cc55d3779841b073f00'), None)
    ok(semi and semi['ronda'] == 'semifinal' and semi['gana'] == 'b' and semi['replica'] is True
       and semi['votos'] == [1, 2], 'la «R»: 1Tobi le gana a Dybbuk 2-1 tras réplica', semi)
    exe = [b for b in bats if 'Exe' in (b['a']['nombre'], b['b']['nombre'])]
    ok(exe and 'fstats:exebb' in (exe[0]['a']['id'], exe[0]['b']['id']),
       'el slug sale del perfil, no del nombre: Exe es «exebb»', exe[:1])
    ok(sorted({b['ronda'] for b in bats}) == ['cuartos', 'final', 'octavos', 'semifinal'], 'las rondas, en el vocabulario pedido')
    ok(all(b['url'] == SITIO + '/battle/' + b['id'][7:] and b['pts'] is None for b in bats),
       'la url es la de la batalla y `pts` va en None')

    ev, bats, av = jornada(caso('fstats_rb_chile_sur.html'), SITIO + '/competition/red-bull-batalla-chile/2026-2027/regional-sur')
    ok(ev['tipo'] == 'rb_regional' and ev['pais'] == 'cl' and ev['fecha'] == '2026-10-24',
       'Chile Regional Sur: rb_regional, cl, 24/10 (la fecha del lugar)', ev)
    t = next((b for b in bats if b['ronda'] == 'tercer'), None)
    f = next((b for b in bats if b['ronda'] == 'final'), None)
    ok(len(bats) == 16 and t and t['gana'] and t[t['gana']]['id'] == 'fstats:erreka'
       and f and f['gana'] and f[f['gana']]['id'] == 'fstats:draker',
       'con tercer puesto: 16 batallas, Draker campeón y Erreka tercero, como el podio', (len(bats), t, av))
    mani = next((b for b in bats if b['id'] == 'fstats:6add705b55d4e1fa126563c6'), None)
    ok(mani and mani['b']['id'] == 'fstats:maniack' and av == [a for a in av if 'por parecido' in a] and len(av) == 1,
       'la llave dice «Maniak» y el perfil «Maniack», sin foto: se asocia por parecido y se avisa', (mani, av))
    ok(all(len(x['nombre']) > 1 for b in bats for x in (b['a'], b['b'])),
       'la inicial del avatar vacío («M») no se toma por un nombre')

    ev, bats, av = jornada(caso('fstats_plazas_final.html'), SITIO + '/competition/red-bull-batalla-torneo-de-plazas/2026-2027/final')
    ok(ev['tipo'] == 'plazas_final' and ev['fecha'] == '2026-09-19', 'la final del Torneo de Plazas es plazas_final', ev)
    ok(sum(1 for b in bats if b['gana']) == 15, 'Plazas: las 15 con ganador', av)

    ev, bats, av = jornada(caso('fstats_combate_mortal.html'),
                           SITIO + '/competition/combate-mortal-freestyle-internacional/2026/final')
    ok(ev['tipo'] == 'independiente' and ev['pais'] is None and ev['fecha'] == '2026-10-31',
       'Combate Mortal: independiente, sin país (la sede no es el nivel), 31/10 aunque en UTC ya era 01/11', ev)
    ok(len(bats) == 16 and all(b['gana'] for b in bats) and all(b['votos'] is None for b in bats) and not av,
       'sin marcador cargado: el ganador sale de la marca del sitio y `votos` queda en None', av)

    # el caso armado: la misma llave con un rival borrado y dos ganadores sin marcar
    armado = caso('fstats_combate_mortal.html')
    pagina = armado
    for bid in ('6aee9c27847b3aaf1e26f4b0', '6aee9c27847b3aaf1e26f4bf'):   # octavos Numenosis-Fat N, y la final
        pagina = _sin_marca(pagina, bid)
    pagina = _sin_rival(pagina, '6aee9c27847b3aaf1e26f4b5')                 # octavos Teorema-R16
    ev, bats, av = jornada(pagina, SITIO + '/competition/combate-mortal-freestyle-internacional/2026/final')
    o1 = next((b for b in bats if b['id'] == 'fstats:6aee9c27847b3aaf1e26f4b0'), None)
    ok(o1 and o1['gana'] and o1[o1['gana']]['nombre'] == 'Fat N' and o1['replica'] is None
       and any('lo deduje por quién pasó de ronda: Fat N' in a for a in av),
       'sin marca: el ganador se deduce de quién pasó de ronda, y se avisa', av)
    f = next((b for b in bats if b['ronda'] == 'final'), None)
    ok(f and f[f['gana']]['nombre'] == 'Mecha' and any('lo deduje por el podio' in a for a in av),
       'la final sin marca: la decide el podio, y se avisa', av)
    ok(len(bats) == 15 and any('no tiene rival cargado' in a and 'Teorema' in a for a in av)
       and any('la llave no cierra entre octavos y cuartos' in a and 'Teorema' in a for a in av),
       'una batalla sin rival: se salta, se avisa, y la llave avisa que no cierra', av)

    ev, bats, av = jornada(caso('fstats_fu_fecha5.html'), SITIO + '/competition/fu/2026/fecha-5')
    ok(ev['tipo'] == 'independiente' and not bats, 'FU Fecha 5: sin resultados cargados, no cuenta ninguna', bats[:1])
    ok(any('no son 1 contra 1' in a and 'Calles' in a for a in av) and any('ninguna de sus' in a for a in av),
       'FU: los 1 contra 2 y los de a tres se nombran, y la falta de resultados se avisa', av)

    eventos = _eventos_pagina(caso('fstats_calendario.html'))
    av = []
    lista = _filtrar(eventos or [], '2026-09-22', '2026-12-31', '2026-11-20', av)
    urls = [e['url'] for e in lista]
    ok(eventos and urls and not any('/fms-' in u for u in urls) and any('salto' in a and 'FMS' in a for a in av),
       'el calendario: FMS se salta sin pedirlo, y se avisa', (urls, av))
    ok('/competition/red-bull-batalla-argentina/2026-2027/final-nacional' in urls
       and not any('gazir' in u for u in urls),
       'el calendario: las jornadas jugadas entran; las exhibiciones no', urls)
    av = []
    ok(not _filtrar(eventos or [], '2026-09-22', '2026-12-31', '2026-09-30', av),
       'lo que todavía no se jugó no se pide')

    res = leer(red=False)
    ok(set(res) == {'batallas', 'mvp', 'avisos'} and res['mvp'] == [], 'leer(red=False): la forma de la respuesta')
    ok(res['batallas'] and all('2026-09-22' <= b['evento']['fecha'] <= '2026-12-31' for b in res['batallas'])
       and not any(b['evento']['tipo'] == 'plazas_final' for b in res['batallas']),
       'leer(red=False): sólo la ventana (la final de Plazas del 19/09 queda afuera)')
    res = leer('2026-09-01', '2026-12-31', red=False)
    ok(any(b['evento']['tipo'] == 'plazas_final' for b in res['batallas']), 'con la ventana más ancha, entra')
    ok(_pais('🇦🇷') == 'ar' and _pais('') is None and _temporada('2026 / 2027') == '2026/27'
       and _ronda('Tercer y cuarto') == 'tercer' and _ronda('Semifinales') == 'semifinal',
       'las piezas chicas: bandera → país, temporada, rondas')
    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


def _mutar(pagina, cambio):
    """Para el caso armado: abre el flight del caso, aplica `cambio` a cada batalla y lo vuelve a cerrar."""
    m = _EMPUJE.search(pagina)
    a = json.loads(m.group(1))
    lineas = []
    for linea in a[1].split('\n'):
        rid, _, resto = linea.partition(':')
        if resto.startswith('['):
            v = json.loads(resto)
            cambio(v)
            linea = rid + ':' + json.dumps(v, ensure_ascii=False)
        lineas.append(linea)
    a[1] = '\n'.join(lineas)
    return pagina[:m.start(1)] + json.dumps(a, ensure_ascii=False) + pagina[m.end(1):]


def _cada_batalla(v, bid, f):
    pila = [v]
    while pila:
        x = pila.pop()
        if _es_el(x) and x[2] == bid:
            f(x)
        elif _es_el(x):
            pila.append(x[3].get('children'))
        elif isinstance(x, list):
            pila.extend(x)


def _sin_marca(pagina, bid):
    def quitar(e):
        pila = [e]
        while pila:
            x = pila.pop()
            if _es_el(x):
                c = x[3].get('className')
                if isinstance(c, str):
                    x[3]['className'] = ' '.join(k for k in c.split() if k not in ('font-semibold', 'bg-amber-200',
                                                                                    'decoration-amber-200'))
                pila.append(x[3].get('children'))
            elif isinstance(x, list):
                pila.extend(x)
    return _mutar(pagina, lambda v: _cada_batalla(v, bid, quitar))


def _sin_rival(pagina, bid):
    def borrar(e):
        # el segundo lado: el segundo fragmento de la lista, o la segunda fila de la grilla de la llave
        pila = [e]
        while pila:
            x = pila.pop()
            if _es_el(x):
                ch = x[3].get('children')
                if isinstance(ch, list):
                    lados = [i for i, h in enumerate(ch) if _es_el(h) and (h[1] == '$Sreact.fragment'
                                                                           or 'divide-y' in _clase(x))]
                    if len(lados) >= 2:
                        ch[lados[1]] = None
                        return
                pila.append(ch)
            elif isinstance(x, list):
                pila.extend(x)
    return _mutar(pagina, lambda v: _cada_batalla(v, bid, borrar))


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        sys.exit(_self_check())
    if '--casos' in sys.argv:
        sys.exit(_bajar_casos())
    sys.exit(_ver())
