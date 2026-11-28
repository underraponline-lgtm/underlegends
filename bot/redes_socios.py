# -*- coding: utf-8 -*-
"""📲 LAS REDES DE LOS SOCIOS, EN PUBLICACIONES: lo que cada servidor socio sube a YouTube e Instagram, en el muro.

    python bot/redes_socios.py           qué saldría hoy en el muro (cuántos por red, sin nombres), sin escribir nada
    python bot/redes_socios.py --leer    lo mismo, leyendo antes Instagram (si el token deja) y los interruptores de KV
    python bot/redes_socios.py --auto    el self-check, sin red ni archivos (Instagram con respuestas simuladas)

Dlx, 28/11/2026: *«las redes de socios se pongan en publicaciones»*. Cada video o post nuevo de un socio es una
publicación del tipo `svred`, firmada por su servidor (su logo, su sigla y su color salen del payload, nunca de acá), con
su red, su título, su miniatura, su link y su fecha. Lo junta `bot/muro.py` (`redes_muro()`), que lo corre
`bot/subir_web.py` en el paso 2c.

DE DÓNDE SALE
- ▶️ YOUTUBE, sin clave y sin red en este paso: `bot/videos.py` (paso 2b8, antes de la web) ya lee los canales de
  `datos/videos_canales.json` y deja en `datos/videos.json` cada video (`crudos`) con su fecha (`meta`). Acá sólo se mira.
- 📸 INSTAGRAM, con la Business Discovery de Meta: una pregunta por socio cada `IG_CADA_H` horas (la copia queda en
  `datos/redes_socios.json`, que guarda el ciclo). Pide que el token (`INSTAGRAM_TOKEN`, el de la cuenta de Under Legends)
  tenga `instagram_manage_insights`: **sin ese permiso no lee nada, y se prende solo el día que lo tenga** (se vuelve a
  probar con UNA pregunta cada `IG_CADA_H`). Sólo se leen cuentas de empresa o de creador: una personal contesta «no
  existe» y se vuelve a probar a los `PERSONAL_DIAS` días.
- 🎵 TIKTOK no tiene API para leer cuentas ajenas: no va. La forma de la publicación es la misma para cualquier red
  (`red`, `tit`, `url`, `img`, `vid` sólo si es de YouTube), así que el día que haya otra fuente entra igual.

LO QUE NO SE HACE, A PROPÓSITO
- ⚠️ SÓLO SOCIOS: `confirmado` y no `en_la_liga: false` en `datos/servidores.json`. Y no la Liga misma: el canal de Under
  Legends (DRA) sube los shorts de la Liga, que ya salen en el muro como `short` (`muro.shorts_muro()`).
- ⚠️ SÓLO LO NUEVO: de los últimos `DIAS` días, y nunca más de `POR_DIA` por servidor por día (hora del este) ni `POR_SV`
  por servidor en todo el muro: FRZ sube varias batallas por día y taparía a los demás.
- ⚠️ EL SOCIO LO APAGA en su panel (`redes_en_muro` de su `cfg:<guild>`, prendido salvo `false`), como `leer_chat` y
  `ahora_mismo`. Apagado, no sale nada suyo.
- ⚠️ LOS REGISTROS DEL CICLO SON PÚBLICOS: acá se imprimen sólo números, nunca una cuenta ni un nombre.
- ⚠️ EL PAYLOAD, CHICO: la miniatura va como link (de YouTube la arma la página con el `vid`), nunca la imagen. Y el link
  firmado de Instagram se conserva mientras no esté por vencer, así el muro no cambia —y no gasta una escritura de KV—
  cada vez que se vuelve a preguntar.
"""
import datetime as dt
import io
import json
import os
import re
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE):
    if _p not in sys.path:
        sys.path.insert(0, _p)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

COPIA = os.path.join(BASE, 'datos', 'redes_socios.json')
#: lo de cuántos días atrás entra
DIAS = 14
#: por servidor: cuántas por día (hora del este) y cuántas en todo el muro
POR_DIA, POR_SV = 2, 4
#: el título, hasta tantas letras
TIT_MAX = 120
#: 📸 cada cuántas horas se le vuelve a preguntar a Instagram por una cuenta, y cuántos posts por pregunta
IG_CADA_H, IG_POSTS = 3, 6
#: 📸 una cuenta personal (Business Discovery no la ve) se vuelve a probar a los tantos días
PERSONAL_DIAS = 7
#: 📸 un link firmado de Instagram se cambia por el nuevo cuando le quedan menos de tantas horas
IMG_RENOVAR_H = 24
API = 'https://graph.facebook.com/v23.0'
#: la cuenta de Instagram de Under Legends, desde la que se pregunta (el número no es secreto)
IG_YO = '17841468054234812'
#: el servidor de la Liga: sus redes son las de Under Legends, y sus shorts ya están en el muro como `short`
LA_LIGA = 'DRA'
_HANDLE = re.compile(r'instagram\.com/([A-Za-z0-9._]{1,30})/?(?:[?#].*)?$', re.I)
_VID = re.compile(r'^[\w-]{11}$')


def _j(*p):
    try:
        with io.open(os.path.join(BASE, *p), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def _iso(t):
    return t.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def _de_iso(s):
    s = str(s or '').strip()
    if not s:
        return None
    # 📸 Instagram escribe «+0000»; fromisoformat quiere «+00:00»
    s = re.sub(r'([+-]\d{2})(\d{2})$', r'\1:\2', s.replace('Z', '+00:00'))
    try:
        t = dt.datetime.fromisoformat(s)
    except ValueError:
        return None
    return t if t.tzinfo else t.replace(tzinfo=dt.timezone.utc)


def _dia_et(t):
    import zoneinfo
    return t.astimezone(zoneinfo.ZoneInfo('America/New_York')).date().isoformat()


def _tit(s):
    s = ' '.join(str(s or '').split())
    return s if len(s) <= TIT_MAX else s[:TIT_MAX - 1].rstrip() + '…'


# ── quiénes ───────────────────────────────────────────────────────────────
def socios(svs):
    """`{sv: fila}`: los socios de la Liga (confirmados y en la Liga), sin la Liga misma."""
    if not isinstance(svs, dict):
        return {}
    return {sv: x for sv, x in svs.items()
            if isinstance(x, dict) and x.get('confirmado') and x.get('en_la_liga') is not False and sv != LA_LIGA}


def handle_ig(x):
    """El usuario de Instagram de un servidor, de sus `redes` (`[[red, url], …]`); '' si no tiene."""
    for r in (x or {}).get('redes') or []:
        if isinstance(r, (list, tuple)) and len(r) > 1 and r[0] == 'instagram':
            m = _HANDLE.search(str(r[1]).strip())
            if m and m.group(1).lower() not in ('p', 'reel', 'reels', 'stories', 'explore'):
                return m.group(1)
    return ''


# ── ▶️ YouTube, de lo que ya leyó bot/videos.py ───────────────────────────
def de_youtube(videos, canales, socios_, ahora):
    """Los videos de los canales de los socios de los últimos `DIAS` días, desde `datos/videos.json`."""
    if not isinstance(videos, dict):
        return []
    meta = videos.get('meta') or {}
    crudos = videos.get('crudos') or {}
    # 📲 los que la lista pública de YouTube marca como short (`cortos`, de `videos.nuevos()`); si no, el título
    cortos = set(videos.get('cortos') or [])
    desde = ahora - dt.timedelta(days=DIAS)
    out = []
    for c in (canales.get('canales') if isinstance(canales, dict) else None) or []:
        sv = c.get('sv') if isinstance(c, dict) else None
        if sv not in socios_:
            continue
        for x in crudos.get(c.get('id')) or []:
            if not isinstance(x, (list, tuple)) or len(x) < 2 or not _VID.match(str(x[0])):
                continue
            m = meta.get(x[0])
            t = _de_iso(m[0]) if isinstance(m, (list, tuple)) and m else None
            if not t or t < desde or t > ahora + dt.timedelta(hours=1):
                continue
            corto = x[0] in cortos or '#short' in str(x[1]).lower()
            out.append({'tipo': 'svred', 't': _iso(t), 'sv': sv, 'red': 'yt', 'vid': x[0], 'tit': _tit(x[1]),
                        'url': ('https://www.youtube.com/shorts/' if corto else 'https://www.youtube.com/watch?v=') + x[0],
                        'corto': corto})
    return out


# ── 📸 Instagram, por la Business Discovery ───────────────────────────────
def _token():
    t = (os.environ.get('INSTAGRAM_TOKEN') or '').strip()
    if not t:
        try:
            import fotos as FT
            t = (FT.env('INSTAGRAM_TOKEN', obligatorio=False) or '').strip()
        except Exception:                                # noqa: BLE001
            t = ''
    return t


def _vence(url):
    """Cuándo vence un link firmado de Instagram (`oe=` en hexa, segundos); None si no dice."""
    m = re.search(r'[?&]oe=([0-9A-Fa-f]{6,10})', str(url or ''))
    try:
        return dt.datetime.fromtimestamp(int(m.group(1), 16), dt.timezone.utc) if m else None
    except (ValueError, OverflowError, OSError):
        return None


def _que_error(e):
    """`'personal'` (no es de empresa ni de creador, o no existe), `'permiso'` (el token no deja) o `'error'`."""
    e = e or {}
    code, sub = e.get('code'), e.get('error_subcode')
    msg = str(e.get('message') or '').lower()
    if code == 110 or sub == 2207013 or 'cannot be found' in msg or 'not found' in msg:
        return 'personal'
    if code in (10, 200, 190, 3) or 'permission' in msg or 'business_discovery' in msg:
        return 'permiso'
    return 'error'


def pedir_ig(handle, token, get=None):
    """`(estado, posts)` de una cuenta: UNA pregunta. `get` es para el self-check (por defecto, `requests.get`)."""
    if get is None:
        import requests
        get = requests.get
    campos = ('business_discovery.username(%s){media.limit(%d){id,caption,media_type,media_product_type,permalink,'
              'timestamp,thumbnail_url,media_url}}' % (handle, IG_POSTS))
    try:
        r = get('%s/%s' % (API, IG_YO), params={'fields': campos, 'access_token': token}, timeout=30)
        d = r.json()
    except Exception:                                    # noqa: BLE001 — sin red o sin JSON: lo de antes se queda
        return 'error', []
    if not isinstance(d, dict):
        return 'error', []
    if d.get('error'):
        return _que_error(d['error']), []
    media = (((d.get('business_discovery') or {}).get('media') or {}).get('data')) or []
    return 'ok', [m for m in media if isinstance(m, dict) and m.get('id') and m.get('permalink')]


def de_post(sv, m):
    """Un post de Instagram, como publicación del muro."""
    t = _de_iso(m.get('timestamp'))
    if not t:
        return None
    video = m.get('media_type') == 'VIDEO'
    img = (m.get('thumbnail_url') if video else m.get('media_url')) or m.get('thumbnail_url') or ''
    cap = str(m.get('caption') or '').strip().split('\n')[0]
    x = {'tipo': 'svred', 't': _iso(t), 'sv': sv, 'red': 'ig', 'pid': str(m['id']), 'tit': _tit(cap),
         'url': str(m['permalink']), 'corto': m.get('media_product_type') == 'REELS'}
    if str(img).startswith('https://'):
        x['img'] = img
    return x


def leer_ig(copia, socios_, ahora, token=None, get=None):
    """Pregunta por las cuentas que tocan y devuelve `(copia nueva, cuántas por estado)`. Nunca falla."""
    token = _token() if token is None else token
    ig = dict((copia or {}).get('ig') or {})
    cuenta = {'ok': 0, 'personal': 0, 'permiso': 0, 'error': 0, 'esperan': 0}
    if not token:
        return dict(copia or {}, ig=ig), cuenta
    # 🔑 sin el permiso, UNA pregunta cada `IG_CADA_H` para ver si ya lo tiene: no una por socio
    sp = _de_iso((copia or {}).get('sin_permiso'))
    if sp and ahora - sp < dt.timedelta(hours=IG_CADA_H):
        cuenta['permiso'] = 1
        return dict(copia or {}, ig=ig), cuenta
    sin_permiso = None
    for sv, x in sorted(socios_.items()):
        h = handle_ig(x)
        if not h:
            continue
        viejo = ig.get(sv) or {}
        visto = _de_iso(viejo.get('visto'))
        espera = dt.timedelta(days=PERSONAL_DIAS) if viejo.get('estado') == 'personal' else dt.timedelta(hours=IG_CADA_H)
        if visto and viejo.get('h') == h and ahora - visto < espera:
            cuenta['esperan'] += 1
            continue
        estado, media = pedir_ig(h, token, get)
        cuenta[estado] += 1
        if estado == 'permiso':
            sin_permiso = _iso(ahora)
            break
        if estado == 'error':
            # lo de antes se queda; se vuelve a probar en la próxima corrida
            continue
        antes = {p.get('pid'): p for p in viejo.get('posts') or []}
        posts = []
        for m in media:
            p = de_post(sv, m)
            if not p:
                continue
            # 🖼️ el link firmado de antes, si todavía no vence: el muro no cambia por un link nuevo
            a = antes.get(p['pid']) or {}
            v = _vence(a.get('img'))
            if a.get('img') and v and v - ahora > dt.timedelta(hours=IMG_RENOVAR_H):
                p['img'] = a['img']
            posts.append(p)
        ig[sv] = {'h': h, 'visto': _iso(ahora), 'estado': estado, 'posts': posts}
    out = dict(copia or {}, ig=ig)
    out['sin_permiso'] = sin_permiso
    return out, cuenta


# ── 🔘 el interruptor del socio ───────────────────────────────────────────
def leer_apagados(s, socios_, copia):
    """`[sv]` de los socios que apagaron `redes_en_muro` en su panel (`cfg:<guild>` de KV, una lectura por socio). Con
    `s` (sesión de Cloudflare) lee KV; lo que no se pudo leer conserva lo de la copia."""
    antes = set((copia or {}).get('apagados') or [])
    if s is None:
        return sorted(antes)
    import subir_datos as SD
    out = set()
    for sv, x in socios_.items():
        g = str(x.get('guild_id') or '')
        if not g:
            continue
        try:
            r = s.get('%s/values/cfg:%s' % (SD.API, g), timeout=20)
            if r.status_code == 404:
                continue
            if r.status_code != 200:
                raise ValueError(r.status_code)
            if (r.json() or {}).get('redes_en_muro') is False:
                out.add(sv)
        except Exception:                                # noqa: BLE001
            if sv in antes:
                out.add(sv)
    return sorted(out)


def refrescar(s=None, ahora=None, token=None, get=None):
    """📡 Lo que pide red, una vez por corrida (lo llama `muro.publicar()`): los interruptores de KV y lo que toca de
    Instagram. Deja la copia en `datos/redes_socios.json` y dice sólo números. Nunca frena el muro."""
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    try:
        copia = _j('datos', 'redes_socios.json') or {}
        so = socios(((_j('datos', 'servidores.json') or {}).get('servidores')) or {})
        copia, cuenta = leer_ig(copia, so, ahora, token=token, get=get)
        copia['apagados'] = leer_apagados(s, so, copia)
        copia['_leeme'] = ('Las redes de los socios para Publicaciones (bot/redes_socios.py): lo último leído de '
                           'Instagram de cada uno y quién lo apagó en su panel. Lo de YouTube sale de datos/videos.json.')
        with io.open(COPIA, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(copia, f, ensure_ascii=False, indent=1, sort_keys=True)
            f.write('\n')
        n_ig = sum(len((v or {}).get('posts') or []) for v in (copia.get('ig') or {}).values())
        print('   📲 redes de los socios: Instagram %d leídas · %d esperan · %d no se pueden leer (personales) · '
              '%d sin permiso · %d con error · %d posts guardados · %d socios lo apagaron'
              % (cuenta['ok'], cuenta['esperan'], cuenta['personal'], cuenta['permiso'], cuenta['error'], n_ig,
                 len(copia['apagados'])))
        return copia
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ las redes de los socios: %s' % type(e).__name__)
        return None


# ── al muro ──────────────────────────────────────────────────────────────
def fuente():
    """Lo que lee `redes_muro()`: sin red (todo de `datos/`)."""
    return {'videos': _j('datos', 'videos.json'), 'canales': _j('datos', 'videos_canales.json'),
            'svs': ((_j('datos', 'servidores.json') or {}).get('servidores')) or {}, 'copia': _j('datos', 'redes_socios.json')}


def para_muro(f, ahora):
    """Las publicaciones `svred` de los socios: nuevas, sin repetir, sin los apagados y con los topes por servidor."""
    if not isinstance(f, dict):
        return []
    so = socios(f.get('svs'))
    copia = f.get('copia') if isinstance(f.get('copia'), dict) else {}
    no = set(copia.get('apagados') or [])
    so = {sv: x for sv, x in so.items() if sv not in no}
    todo = de_youtube(f.get('videos'), f.get('canales'), so, ahora)
    desde = ahora - dt.timedelta(days=DIAS)
    ig = copia.get('ig') if isinstance(copia.get('ig'), dict) else {}
    for sv, v in ig.items():
        if sv not in so or not isinstance(v, dict):
            continue
        for p in v.get('posts') or []:
            if not isinstance(p, dict) or p.get('red') != 'ig' or not p.get('url'):
                continue
            t = _de_iso(p.get('t'))
            if t and desde <= t <= ahora + dt.timedelta(hours=1):
                todo.append(dict(p, tipo='svred', sv=sv))
    todo.sort(key=lambda x: x['t'], reverse=True)
    visto, por_dia, por_sv, out = set(), {}, {}, []
    for x in todo:
        clave = (x['red'], x.get('vid') or x.get('pid') or x.get('url'))
        if clave in visto:
            continue
        visto.add(clave)
        d = (x['sv'], _dia_et(_de_iso(x['t'])))
        if por_dia.get(d, 0) >= POR_DIA or por_sv.get(x['sv'], 0) >= POR_SV:
            continue
        por_dia[d] = por_dia.get(d, 0) + 1
        por_sv[x['sv']] = por_sv.get(x['sv'], 0) + 1
        out.append(x)
    return out


# ── self-check ───────────────────────────────────────────────────────────
class _Resp:
    def __init__(self, d):
        self._d = d

    def json(self):
        if isinstance(self._d, Exception):
            raise self._d
        return self._d


def _self_check():
    print('\n══ LAS REDES DE LOS SOCIOS, EN PUBLICACIONES ══\n')
    mal = 0

    def ok(c, que):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '🔴', que))

    ahora = dt.datetime(2026, 11, 28, 18, tzinfo=dt.timezone.utc)
    hace = lambda h: _iso(ahora - dt.timedelta(hours=h))  # noqa: E731
    svs = {'DRA': {'confirmado': True, 'guild_id': '1', 'redes': [['instagram', 'https://www.instagram.com/underlegendsoficial/']]},
           'FRZ': {'confirmado': True, 'guild_id': '2', 'redes': [['instagram', 'https://www.instagram.com/fzdiscord/'],
                                                                   ['youtube', 'https://www.youtube.com/@x']]},
           'SR': {'confirmado': True, 'guild_id': '3', 'redes': [['instagram', 'https://www.instagram.com/snakerap_freestyle/?hl=es']]},
           'CEU': {'confirmado': True, 'guild_id': '4'},
           'TFC': {'confirmado': True, 'en_la_liga': False, 'guild_id': '5'},
           'TWR': {'confirmado': False, 'guild_id': '6'}}
    so = socios(svs)
    ok(sorted(so) == ['CEU', 'FRZ', 'SR'], 'sólo socios: confirmados, en la Liga y no la Liga misma (DRA ya tiene sus shorts)')
    ok(handle_ig(svs['FRZ']) == 'fzdiscord' and handle_ig(svs['SR']) == 'snakerap_freestyle' and handle_ig(svs['CEU']) == ''
       and handle_ig({'redes': [['instagram', 'https://www.instagram.com/p/ABC123/']]}) == '',
       'el usuario de Instagram sale de sus redes, sin parámetros; un link a un post no es una cuenta')
    # ▶️ YouTube, desde lo que dejó bot/videos.py
    vids = ['IlbdqMaNp%02d' % i for i in range(8)]
    videos = {'crudos': {'UCfrz': [[v, 'BATALLA %d | FMS DISCORD' % i] for i, v in enumerate(vids)] + [['nnnnnnnnnnn', 'vieja']],
                         'UCdra': [['ddddddddddd', 'un short de la Liga #shorts']],
                         'UCceu': [['ccccccccccc', 'EL FLOW DE X Vs Y #shorts']]},
              'meta': dict({v: [hace(i * 3), 10] for i, v in enumerate(vids)},
                           nnnnnnnnnnn=[hace(24 * 20), 5], ddddddddddd=[hace(1), 1], ccccccccccc=[hace(30), 1])}
    canales = {'canales': [{'sv': 'FRZ', 'id': 'UCfrz'}, {'sv': 'DRA', 'id': 'UCdra'}, {'sv': 'CEU', 'id': 'UCceu'}]}
    yt = de_youtube(videos, canales, so, ahora)
    ok(len(yt) == 9 and not any(x['sv'] == 'DRA' for x in yt) and 'nnnnnnnnnnn' not in [x['vid'] for x in yt],
       'YouTube: los de los últimos %d días de los socios; ni lo viejo ni el canal de la Liga' % DIAS)
    ce = [x for x in yt if x['sv'] == 'CEU'][0]
    ok(ce['corto'] and ce['url'].endswith('/shorts/ccccccccccc') and ce['red'] == 'yt' and 'img' not in ce,
       'un short va con su link de short; la miniatura de YouTube la arma la página con el `vid` (el payload, chico)')
    ok([x['corto'] for x in de_youtube(dict(videos, cortos=[vids[1]]), canales, so, ahora) if x['vid'] in vids[:2]] == [False, True],
       'y lo es también sin «#shorts» en el título, si la lista pública de YouTube lo marca (`cortos`, de bot/videos.py)')
    f = {'videos': videos, 'canales': canales, 'svs': svs, 'copia': {}}
    m = para_muro(f, ahora)
    frz = [x for x in m if x['sv'] == 'FRZ']
    dias = {}
    for x in frz:
        dias[_dia_et(_de_iso(x['t']))] = dias.get(_dia_et(_de_iso(x['t'])), 0) + 1
    ok(len(frz) == POR_SV and max(dias.values()) <= POR_DIA,
       'FRZ sube ocho en un día y medio: entran %d, y nunca más de %d por día (hora del este)' % (POR_SV, POR_DIA))
    ok(frz[0]['t'] == hace(0), 'entran los más nuevos')
    ok(para_muro(dict(f, copia={'apagados': ['FRZ']}), ahora) == [x for x in m if x['sv'] != 'FRZ'],
       'el socio que apagó `redes_en_muro` en su panel no sale')
    ok(para_muro(None, ahora) == [] and para_muro({'videos': 'roto', 'canales': None, 'svs': svs}, ahora) == [],
       'sin archivos, o rotos: nada (nunca frena el muro)')
    # 📸 Instagram, con respuestas simuladas
    llamadas = []

    def get_(respuestas):
        def g(url, params=None, timeout=None):
            h = re.search(r'username\(([^)]+)\)', params['fields']).group(1)
            llamadas.append(h)
            return _Resp(respuestas[h])
        return g
    post = lambda i, h, tipo='IMAGE', prod='FEED': {  # noqa: E731
        'id': '1790%d' % i, 'caption': 'Jornada %d de la liga\n#freestyle' % i, 'media_type': tipo, 'media_product_type': prod,
        'permalink': 'https://www.instagram.com/p/X%d/' % i, 'timestamp': (ahora - dt.timedelta(hours=h)).strftime('%Y-%m-%dT%H:%M:%S+0000'),
        'media_url': 'https://scontent.cdninstagram.com/m%d.jpg?oe=%X' % (i, int((ahora + dt.timedelta(days=5)).timestamp())),
        'thumbnail_url': 'https://scontent.cdninstagram.com/t%d.jpg?oe=%X' % (i, int((ahora + dt.timedelta(days=5)).timestamp()))}
    bien = {'fzdiscord': {'business_discovery': {'media': {'data': [post(1, 2), post(2, 5, 'VIDEO', 'REELS')]}}},
            'snakerap_freestyle': {'error': {'code': 110, 'error_subcode': 2207013,
                                             'message': 'The user with username: snakerap_freestyle cannot be found.'}}}
    c1, n1 = leer_ig({}, so, ahora, token='t', get=get_(bien))
    ok(sorted(llamadas) == ['fzdiscord', 'snakerap_freestyle'] and n1['ok'] == 1 and n1['personal'] == 1,
       'una pregunta por socio con Instagram: la cuenta de empresa se lee, la personal se anota como «personal»')
    ps = c1['ig']['FRZ']['posts']
    ok(len(ps) == 2 and ps[0]['tit'] == 'Jornada 1 de la liga' and ps[1]['corto'] and ps[1]['img'].startswith('https://scontent')
       and '/t2.jpg' in ps[1]['img'] and ps[0]['t'] == hace(2),
       'el post: la primera línea del texto, el reel como corto, la miniatura del video y la hora en UTC')
    llamadas.clear()
    c2, n2 = leer_ig(c1, so, ahora + dt.timedelta(hours=1), token='t', get=get_(bien))
    ok(llamadas == [] and n2['esperan'] == 2, 'una hora después no pregunta: la copia vale %d horas' % IG_CADA_H)
    llamadas.clear()
    nuevo = dict(bien, fzdiscord={'business_discovery': {'media': {'data': [dict(post(1, 2), media_url='https://scontent.cdninstagram.com/m1.jpg?oe=%X'
                                                                                      % int((ahora + dt.timedelta(days=6)).timestamp()))]}}})
    c3, _n3 = leer_ig(c1, so, ahora + dt.timedelta(hours=IG_CADA_H + 1), token='t', get=get_(nuevo))
    ok(llamadas == ['fzdiscord'] and c3['ig']['FRZ']['posts'][0]['img'] == ps[0]['img'],
       'a las %d horas vuelve a preguntar (la personal espera %d días) y el link firmado que no vence se conserva'
       % (IG_CADA_H, PERSONAL_DIAS))
    llamadas.clear()
    sinp = {'fzdiscord': {'error': {'code': 10, 'message': 'Application does not have permission for this action'}},
            'snakerap_freestyle': {'error': {'code': 10, 'message': 'x'}}}
    c4, n4 = leer_ig({}, so, ahora, token='t', get=get_(sinp))
    ok(len(llamadas) == 1 and n4['permiso'] == 1 and c4.get('sin_permiso') == _iso(ahora),
       'sin el permiso: UNA pregunta y para; no una por socio')
    llamadas.clear()
    c5, _n5 = leer_ig(c4, so, ahora + dt.timedelta(hours=1), token='t', get=get_(bien))
    ok(llamadas == [], 'y no vuelve a probar hasta las %d horas' % IG_CADA_H)
    c6, n6 = leer_ig(c4, so, ahora + dt.timedelta(hours=IG_CADA_H + 1), token='t', get=get_(bien))
    ok(n6['ok'] == 1 and c6['ig']['FRZ']['posts'] and not c6.get('sin_permiso'),
       'el día que el token tiene el permiso, se prende solo')
    llamadas.clear()
    _c7, n7 = leer_ig({}, so, ahora, token='', get=get_(bien))
    ok(llamadas == [] and not any(n7.values()), 'sin token, ni una pregunta')
    roto = {'fzdiscord': ValueError('no es JSON'), 'snakerap_freestyle': {'raro': 1}}
    c8, n8 = leer_ig(c1, so, ahora + dt.timedelta(days=PERSONAL_DIAS + 1), token='t', get=get_(roto))
    ok(n8['error'] == 1 and c8['ig']['FRZ']['posts'] == c1['ig']['FRZ']['posts'],
       'si Instagram contesta cualquier cosa, lo de antes se queda')
    # y al muro: Instagram y YouTube juntos, con los mismos topes
    m2 = para_muro(dict(f, copia=c1), ahora)
    igs = [x for x in m2 if x['red'] == 'ig']
    ok([x['pid'] for x in igs] == ['17901'] and len([x for x in m2 if x['sv'] == 'FRZ']) == POR_SV
       and all(x['tipo'] == 'svred' for x in m2),
       'Instagram entra al muro con YouTube y compite por los mismos topes: el reel de hace 5 h ya no entra en su día')
    ok(all(len(json.dumps(x, ensure_ascii=False)) < 600 for x in m2), 'cada publicación pesa menos de 600 bytes')
    ok(_que_error({'code': 190}) == 'permiso' and _que_error({'code': 1}) == 'error' and _que_error({'code': 110}) == 'personal',
       'los errores de Meta: token o permiso, cuenta personal, y lo demás')
    print('\n   %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return mal


def main():
    a = sys.argv[1:]
    if '--auto' in a:
        return 1 if _self_check() else 0
    ahora = dt.datetime.now(dt.timezone.utc)
    if '--leer' in a:
        s = None
        try:
            import subir_datos as SD
            s = SD.sesion()
        except BaseException:                            # noqa: BLE001 — sin Cloudflare, la copia de los interruptores
            s = None
        refrescar(s, ahora)
    xs = para_muro(fuente(), ahora)
    por = {}
    for x in xs:
        por[x['red']] = por.get(x['red'], 0) + 1
    print('   📲 al muro: %d publicaciones de las redes de los socios (%s)'
          % (len(xs), ', '.join('%s %d' % kv for kv in sorted(por.items())) or 'ninguna'))
    return 0


if __name__ == '__main__':
    raise SystemExit(main() or 0)
