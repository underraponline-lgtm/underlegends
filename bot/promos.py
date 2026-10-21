# -*- coding: utf-8 -*-
"""📣 LAS PROMOCIONES DE LOS SERVIDORES: lo que los raperos comparten en el canal de promoción de cada socio, en la web.

    python bot/promos.py            qué leería, sin escribir nada
    python bot/promos.py --aplicar  y lo deja en datos/promos.json (el ciclo, paso 2b8c)
    python bot/promos.py --auto     el self-check, sin red ni archivos

Dlx, 16/10/2026: *«hacer uso de las promociones en los diferentes canales de promoción de cada servidor para que
nosotros lo promocionemos también, como parte de la Liga Global»*. Y a las preguntas: en Publicaciones (una pestaña) y
en el perfil de cada uno, en la página de cada servidor y en un círculo de las historias; y entran *«raperos de la
Lista, sólo música y video»*.

LAS REGLAS
  1. EL CANAL SE BUSCA POR NOMBRE —«promocion», «promocionate», «spam-promocion»—, como los de anuncios
     (`anuncios.canales()`): una lista de IDs escrita a mano envejece sola. Nunca uno de una categoría de staff.
  2. SÓLO DE ALGUIEN DE LA LISTA: la cuenta que lo publica tiene que estar en el padrón con su Discord ID. Así cada promo
     es de un perfil, y nadie de afuera usa a la Liga de vidriera.
  3. SÓLO MÚSICA Y VIDEO: YouTube, Spotify, SoundCloud, Instagram y TikTok (`PLATAFORMAS`). Nada de invitaciones a
     otros Discord, ni links sueltos.
  4. DEL MENSAJE SE GUARDA EL LINK, NO EL TEXTO: el título y la imagen salen de la plataforma (su oEmbed público), no de
     lo que escribió la persona. Instagram no tiene oEmbed abierto: va el link solo.
  5. UNA SEMANA EN LA PÁGINA (`SEMANA`), y como mucho `POR_PERSONA` por persona en el muro: el que publica diez veces
     por semana no tapa al resto. Dlx, 16/10/2026: *«las promociones en la página web duran una semana, a menos que sea
     solicitado manualmente en la tienda»* —y a la pregunta, *«1 semana más: 2.500 PdT»*—: la alargada la cobra el
     objeto (`promoExtender()` en bot/avisos.js) y acá se lee hasta cuándo va (`extras()`). Se guardan `DIAS` días.

📣 Y LA LIGA TAMBIÉN PROMOCIONA (Dlx, 16/10/2026: *«cuando hayan promociones ahí, nosotros promocionar los videos de
nuestros participantes de Discord, o donde rapean en plazas»*, y de dónde: las batallas de los socios, lo que cada uno
sumó a su perfil —las plazas de Makma, las de Liberia—, su YouTube de «Mis redes» y los canales de plazas). Ver
`de_la_liga()`: van con `o: 'liga'` y las mismas reglas de la semana.

🔵 EL CÍRCULO DE LAS HISTORIAS ESTÁ SIEMPRE (*«que siempre esté ahí, con las promociones recientes que han habido»*): si
en la semana hay menos de `MIN_CIRCULO`, entran las más nuevas que haya, por `RESPALDO_H` horas.

Lo lee el muro (`bot/muro.py`, tipo `promo`): de ahí a Publicaciones, a cada perfil, a cada servidor y a las historias.
"""
import datetime as dt
import io
import json
import os
import re
import sys
import unicodedata

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE):
    if _p not in sys.path:
        sys.path.insert(0, _p)

SALIDA = os.path.join(BASE, 'datos', 'promos.json')
API = 'https://discord.com/api/v10'
#: el canal de promoción, por su nombre (sin adornos ni tildes)
CANAL = re.compile(r'promo', re.I)
#: nunca uno de una categoría de staff (la misma regla que los anuncios)
STAFF = re.compile(r'staff|moderat|admin|organiz', re.I)
#: cuánto se guarda una promo, cuántas se guardan y cuántas de cada uno van al muro
DIAS, GUARDA, POR_PERSONA, AL_MURO = 30, 400, 2, 24
#: cuántos días está en la página (Dlx: «duran una semana»); las de la Liga que van al muro; el mínimo del círculo y por
#: cuántas horas entran las de respaldo
SEMANA, LIGA_TOPE, MIN_CIRCULO, RESPALDO_H = 7, 12, 4, 12
WORKER = 'https://liga-global-bot.liga-global-ul.workers.dev'
YT_CANAL = re.compile(r'youtube\.com/channel/(UC[A-Za-z0-9_-]{22})')
#: cada cuánto se vuelven a buscar los canales (un servidor puede crear o renombrar el suyo)
HORAS_CANALES = 24
#: las plataformas: (clave, nombre, dominios)
PLATAFORMAS = (
    ('yt', 'YouTube', ('youtube.com', 'youtu.be', 'music.youtube.com')),
    ('sp', 'Spotify', ('open.spotify.com', 'spotify.link')),
    ('sc', 'SoundCloud', ('soundcloud.com', 'on.soundcloud.com')),
    ('ig', 'Instagram', ('instagram.com',)),
    ('tt', 'TikTok', ('tiktok.com', 'vm.tiktok.com')),
)
URL = re.compile(r'https?://[^\s<>()\[\]|"]+', re.I)
YT_ID = re.compile(r'(?:youtu\.be/|[?&]v=|/shorts/|/live/|/embed/)([A-Za-z0-9_-]{11})')
#: el oEmbed público de cada una (Instagram lo pide con token: no va)
OEMBED = {'yt': 'https://www.youtube.com/oembed?format=json&url=%s', 'sp': 'https://open.spotify.com/oembed?url=%s',
          'sc': 'https://soundcloud.com/oembed?format=json&url=%s', 'tt': 'https://www.tiktok.com/oembed?url=%s'}
#: de quién son las imágenes que se pueden mostrar (las de TikTok vencen en horas: esa va sin imagen)
IMG_OK = ('https://i.ytimg.com/', 'https://i.scdn.co/', 'https://i1.sndcdn.com/')


def _plano(s):
    return ''.join(c for c in unicodedata.normalize('NFKD', str(s or '')) if not unicodedata.combining(c))


def plataforma(url):
    """`'yt'`, `'sp'`… o `''` si el link no es de música ni de video."""
    m = re.match(r'https?://([^/?#]+)', url or '', re.I)
    if not m:
        return ''
    h = m.group(1).lower()
    h = h[4:] if h.startswith('www.') else h[2:] if h.startswith('m.') else h
    for k, _n, doms in PLATAFORMAS:
        if any(h == d or h.endswith('.' + d) for d in doms):
            return k
    return ''


def links(texto, tope=2):
    """Los links de música y video de un mensaje: `[(url, plataforma)]`, sin repetir y como mucho `tope`."""
    out, vistos = [], set()
    for u in URL.findall(texto or ''):
        u = u.rstrip('.,;:!?*_~')
        p = plataforma(u)
        if p and u not in vistos:
            vistos.add(u)
            out.append((u, p))
    return out[:tope]


def es_canal(c, categorias):
    """¿Ese canal es el de promoción? De texto o de anuncios, con «promo» en el nombre, y no de staff."""
    if c.get('type') not in (0, 5):
        return False
    if STAFF.search(_plano(categorias.get(str(c.get('parent_id') or ''), ''))):
        return False
    return bool(CANAL.search(_plano(c.get('name'))))


def promo_de(m, sv, padron_ids):
    """Las promos de un mensaje: `[{id, t, sv, quien, url, plat, vid}]`, o `[]` si no entra (bot, no está en la Lista,
    sin links de música ni video). `padron_ids`: `{discord_id: nombre de la Lista}`."""
    a = m.get('author') or {}
    if a.get('bot') or str(a.get('id')) not in padron_ids:
        return []
    out = []
    for i, (u, p) in enumerate(links(m.get('content'))):
        x = {'id': '%s-%d' % (m['id'], i), 't': str(m.get('timestamp') or '')[:19] + 'Z', 'sv': sv,
             'quien': padron_ids[str(a['id'])], 'url': u, 'plat': p}
        if p == 'yt':
            v = YT_ID.search(u)
            if v:
                x['vid'] = v.group(1)
        out.append(x)
    return out


def _sesion():
    import requests
    import fotos as F
    s = requests.Session()
    s.headers['Authorization'] = 'Bot ' + F.env('DISCORD_TOKEN')
    return s


def leer(ruta=None):
    try:
        with io.open(ruta or SALIDA, encoding='utf-8') as f:
            return json.load(f) or {}
    except (OSError, ValueError):
        return {}


def _padron_ids():
    with io.open(os.path.join(BASE, 'datos', 'padron.json'), encoding='utf-8') as f:
        padron = json.load(f) or []
    out = {}
    for x in padron:
        n = x.get('raw') or x.get('full')
        for did in [x.get('discord_id')] + list(x.get('otras_cuentas') or []):
            if did and n:
                out[str(did)] = n
    return out


def buscar_canales(s, svs):
    """`{sv: [id del canal]}` de los servidores confirmados."""
    out = {}
    for sv, d in svs.items():
        g = d.get('guild_id')
        if not g or not d.get('confirmado'):
            continue
        r = s.get('%s/guilds/%s/channels' % (API, g), timeout=25)
        if r.status_code != 200:
            continue
        cs = r.json()
        cats = {str(c['id']): c.get('name') or '' for c in cs if c.get('type') == 4}
        ids = [str(c['id']) for c in cs if es_canal(c, cats)]
        if ids:
            out[sv] = ids
    return out


def oembed(s, x, cache):
    """El título y la imagen de la plataforma (`cache` por link). Sin oEmbed (Instagram) o si falla, nada."""
    u = x['url']
    if u in cache:
        return cache[u]
    tpl = OEMBED.get(x['plat'])
    res = {}
    if tpl:
        import urllib.parse
        try:
            r = s.get(tpl % urllib.parse.quote(u, safe=''), timeout=15, headers={'Authorization': ''})
            if r.status_code == 200:
                j = r.json()
                res = {'tit': str(j.get('title') or '')[:120], 'de': str(j.get('author_name') or '')[:60]}
                img = str(j.get('thumbnail_url') or '')
                if img.startswith(IMG_OK):
                    res['img'] = img
        except Exception:                                # noqa: BLE001
            res = {}
    cache[u] = res
    return res


def _iso(t):
    return t.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def _de_iso(s):
    try:
        t = dt.datetime.fromisoformat(str(s).replace('Z', '+00:00'))
    except ValueError:
        return None
    return t if t.tzinfo else t.replace(tzinfo=dt.timezone.utc)


def extras():
    """`{pid: 'AAAA-MM-DDTHH:MM:SSZ'}`: hasta cuándo va cada promo alargada en la Tienda (`/avisos/promos-extra`, que
    nunca dice quién pagó). `None` si el Worker no contesta: se queda lo de la corrida anterior."""
    import requests
    try:
        r = requests.get(WORKER + '/avisos/promos-extra', timeout=20)
        if r.status_code != 200:
            return None
        ex = (r.json() or {}).get('extra') or {}
        return {str(k): _iso(dt.datetime.fromtimestamp(int(v) / 1000, dt.timezone.utc)) for k, v in ex.items()
                if str(v).isdigit()}
    except Exception:                                    # noqa: BLE001
        return None


# ── ✋ A MANO, DESDE EL DASHBOARD (Dlx, 20/10/2026: «yo debería tener la opción de agregar y qué cosas añadir o borrar
# manualmente en PROMO») ──────────────────────────────────────────────────────────────────────────────────────────
# Dos ajustes: `promos_mano` (las que Dlx agrega: `[{u, quien, sv, dias, t}]`) y `promos_quitar` (los links que saca, de
# donde sea que vengan: un canal de promoción, la Liga o las suyas). Las suyas van primero y sin el tope por persona,
# como las alargadas en la Tienda, y duran los días que eligió. Si el Dashboard no contesta, queda lo de la corrida
# anterior (un Worker caído no es «Dlx las sacó»).
def _clave_url(u):
    """El link sin lo que cambia entre copias (`?si=`, `utm_`, la barra final): para que «sacar» encuentre la promo."""
    u = re.sub(r'[?&](si|igsh|utm_[a-z]+|feature|share_id)=[^&#]*', '', str(u or '').strip())
    return u.rstrip('/?&').lower()


def a_mano(lista, ahora, cache=None, s=None):
    """Las promos que agregó Dlx, con la forma de las demás (`o: 'mano'`, `hasta`).

    🔓 CUALQUIER LINK, SÓLO A MANO (Dlx, 20/10/2026: «que pueda ser servidores de Discord, cualquier link… OJO, esto sólo
    si es manual, o sea por mí»): la regla de «sólo música y video» sigue para lo que se lee de los canales de promoción;
    lo que agrega Dlx puede ser una invitación de Discord (`dc`) o cualquier página (`web`)."""
    import hashlib
    out = []
    for x in lista or []:
        u = str((x or {}).get('u') or '').strip()
        if not re.match(r'^https://\S{6,300}$', u):
            continue
        p = plataforma(u) or ('dc' if re.match(r'https://(www\.)?(discord\.gg|discord\.com/invite)/', u, re.I) else 'web')
        t = _de_iso(x.get('t')) or ahora
        dias = x.get('dias') if isinstance(x.get('dias'), int) and 1 <= x.get('dias') <= 30 else SEMANA
        y = {'id': 'm-' + hashlib.sha1(u.encode('utf-8')).hexdigest()[:12], 'o': 'mano', 'por': 'Dlx', 't': _iso(t),
             'hasta': _iso(t + dt.timedelta(days=dias)), 'sv': str(x.get('sv') or ''),
             'quien': [q for q in [str(x.get('quien') or '').strip()] if q], 'url': u, 'plat': p}
        if p == 'yt':
            v = YT_ID.search(u)
            if v:
                y['vid'] = v.group(1)
                y['img'] = 'https://i.ytimg.com/vi/%s/hqdefault.jpg' % v.group(1)
        if s is not None and cache is not None:
            y.update({k: v for k, v in oembed(s, y, cache).items() if v})
        out.append(y)
    return out


def _yt(vid, t, quien, tit, de, sv, por):
    return {'id': 'v-' + vid, 'o': 'liga', 'por': por, 't': t, 'sv': sv or '', 'quien': [q for q in quien if q],
            'url': 'https://www.youtube.com/watch?v=' + vid, 'plat': 'yt', 'vid': vid, 'tit': str(tit or '')[:120],
            'de': str(de or '')[:60], 'img': 'https://i.ytimg.com/vi/%s/hqdefault.jpg' % vid}


def de_la_liga(ahora, videos=None, propios=None, redes=None, nombres=None, yt=None):
    """📣 Los videos de nuestros participantes que promociona la Liga, de los últimos `DIAS` días, el más nuevo primero:

      · `socio`: las batallas de los canales de los socios con alguien de la Lista (`datos/videos.json`, `bot/videos.py`),
        por su fecha de publicación;
      · `perfil`: lo que cada uno sumó a su perfil —plazas y otras ligas— (`datos/videos_propios.json`), desde que entró;
      · `canal`: lo que sube cada uno a su YouTube de «Mis redes» (`redes`, `{clave: [[tipo, url, n]]}`; `nombres`,
        `{clave: nombre de la Lista}`; `yt(canal)`, sus últimos videos). Es SU canal: Discord lo conectó, no lo escribió.
    Un video, una vez (gana el primero de esa lista)."""
    desde = _iso(ahora - dt.timedelta(days=DIAS))
    out, ya = [], set()

    def sumar(x):
        if x['vid'] not in ya and x['t'] >= desde and x['quien']:
            ya.add(x['vid'])
            out.append(x)
    vj = videos or {}
    meta = vj.get('meta') or {}
    for vid, x in (vj.get('videos') or {}).items():
        m = meta.get(vid)
        if m and len(x) > 2 and x[2]:
            sumar(_yt(vid, str(m[0]), list(x[2]), x[0], '', x[1], 'socio'))
    pj = propios or {}
    ocultos = set(pj.get('ocultos') or [])
    for raw, vs in (pj.get('por') or {}).items():
        for v in vs or []:
            if len(v) > 3 and v[0] not in ocultos:
                sumar(_yt(v[0], str(v[3]), [raw], v[1], v[2], '', 'perfil'))
    for cl, rr in (redes or {}).items():
        raw = (nombres or {}).get(cl)
        if not raw or not yt:
            continue
        for tipo, url, _n in rr or []:
            m = YT_CANAL.search(str(url or '')) if tipo == 'youtube' else None
            if not m:
                continue
            for v in yt(m.group(1)) or []:
                sumar(_yt(v['vid'], v['t'], [raw], v.get('tit'), v.get('canal'), '', 'canal'))
    out.sort(key=lambda x: x['t'], reverse=True)
    return out


def _liga_fuentes():
    """Lo que pide `de_la_liga()`, de `datos/` y de KV (las redes). Sin red, sin las redes."""
    def j(n):
        try:
            with io.open(os.path.join(BASE, 'datos', n), encoding='utf-8') as f:
                return json.load(f) or {}
        except (OSError, ValueError):
            return {}
    redes, nombres, yt = {}, {}, None
    try:
        import subir_web as SW
        redes = SW.redes_kv() or {}
        if redes:
            for x in j('padron.json') or []:
                if x.get('raw'):
                    nombres.setdefault(SW._clave(x), x['raw'])
            yt = lambda c: SW._youtube(c, tope=5)  # noqa: E731
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ promos de la Liga sin «Mis redes» (%s)' % str(e)[:60])
    return j('videos.json'), j('videos_propios.json'), redes, nombres, yt


def correr(aplicar=False, ahora=None):
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    viejo = leer()
    with io.open(os.path.join(BASE, 'datos', 'servidores.json'), encoding='utf-8') as f:
        svs = (json.load(f) or {}).get('servidores') or {}
    s = _sesion()
    canales, t_can = viejo.get('canales') or {}, viejo.get('canales_t') or ''
    if not canales or not t_can or (ahora - dt.datetime.fromisoformat(t_can.replace('Z', '+00:00'))).total_seconds() > HORAS_CANALES * 3600:
        canales, t_can = buscar_canales(s, svs), ahora.strftime('%Y-%m-%dT%H:%M:%SZ')
    ids = _padron_ids()
    ult = dict(viejo.get('ult') or {})
    items = {x['id']: x for x in viejo.get('items') or []}
    cache = dict(viejo.get('oembed') or {})
    nuevas = 0
    for sv, cids in canales.items():
        for cid in cids:
            q = '%s/channels/%s/messages?limit=100' % (API, cid) + ('&after=%s' % ult[cid] if ult.get(cid) else '')
            r = s.get(q, timeout=25)
            if r.status_code != 200:
                print('   ⚠️ %s: no puedo leer su canal de promoción (%d)' % (sv, r.status_code))
                continue
            ms = r.json() or []
            if ms:
                ult[cid] = max(ms, key=lambda m: int(m['id']))['id']
            for m in ms:
                for x in promo_de(m, sv, ids):
                    if x['id'] not in items:
                        x.update(oembed(s, x, cache))
                        items[x['id']] = x
                        nuevas += 1
    # 💳 hasta cuándo va cada promo alargada en la Tienda (si el Worker no contesta, lo de la corrida anterior)
    ex = extras()
    extra = ex if ex is not None else dict(viejo.get('extra') or {})
    ahora_s = _iso(ahora)
    vale = lambda x: x['t'] >= desde or (extra.get(x['id']) or '') > ahora_s  # noqa: E731
    desde = (ahora - dt.timedelta(days=DIAS)).strftime('%Y-%m-%dT%H:%M:%S')
    lista = sorted((x for x in items.values() if vale(x)), key=lambda x: x['t'], reverse=True)[:GUARDA]
    usados = {x['url'] for x in lista}
    cache = {u: v for u, v in cache.items() if u in usados}
    # 📣 y lo que promociona la Liga: los videos de nuestros participantes. Lo alargado se queda aunque sea viejo
    liga = de_la_liga(ahora, *_liga_fuentes())
    ya = {x['id'] for x in liga}
    liga += [x for x in viejo.get('liga') or [] if x['id'] not in ya and (extra.get(x['id']) or '') > ahora_s]
    liga = liga[:GUARDA]
    # ✋ lo de Dlx (ver `a_mano()`): las suyas y lo que sacó; sin el Dashboard, lo de la corrida anterior
    try:
        import multiplicadores as MU
        aj = MU.ajustes_dueno()
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ promos a mano: no leí los ajustes (%s)' % str(e)[:60])
        aj = None
    if aj is None:
        mano, quitar = viejo.get('mano') or [], viejo.get('quitar') or []
    else:
        mano = a_mano(aj.get('promos_mano') or [], ahora, cache, s)
        quitar = sorted({_clave_url(u) for u in aj.get('promos_quitar') or [] if u})
    mano = [x for x in mano if x.get('hasta', '') > ahora_s]
    print('   📣 promos: %d canal(es) de %d servidor(es) · %d nueva(s) · %d guardada(s) · %d de la Liga · %d alargada(s)'
          % (sum(len(v) for v in canales.values()), len(canales), nuevas, len(lista), len(liga),
             sum(1 for v in extra.values() if v > ahora_s)))
    if mano or quitar:
        print('   ✋ promos a mano: %d agregada(s) · %d sacada(s)' % (len(mano), len(quitar)))
    if aplicar:
        with io.open(SALIDA, 'w', encoding='utf-8', newline='\n') as f:
            json.dump({'_leeme': 'Las promociones de los canales de promoción de cada servidor: el link y de quién es, '
                                 'nunca el texto; los videos de nuestros participantes que promociona la Liga (`liga`), '
                                 'y hasta cuándo va cada una alargada en la Tienda (`extra`). Lo escribe bot/promos.py '
                                 '(paso 2b8c); lo lee bot/muro.py.',
                       'canales': canales, 'canales_t': t_can, 'ult': ult, 'items': lista, 'liga': liga, 'extra': extra,
                       'mano': mano, 'quitar': quitar,
                       'oembed': cache},
                      f, ensure_ascii=False, indent=0)
    return lista


def para_muro(d, ahora=None, por_persona=POR_PERSONA, tope=AL_MURO, respaldo=True):
    """🧱 Las promos que van al muro: las de la última semana (`SEMANA`) y las alargadas en la Tienda, como mucho
    `por_persona` por persona —en las de los servidores y las de la Liga juntas— y `tope` de los servidores más
    `LIGA_TOPE` de la Liga, la alargada y la más nueva primero:
    `[{tipo: 'promo', t, hasta, sv, quien, url, plat, pid, o?, vid?, tit?, de?, img?}]`. `hasta` es cuándo sale de la
    página. Con `respaldo`, si quedan menos de `MIN_CIRCULO`, entran las más nuevas que haya por `RESPALDO_H` horas (el
    círculo de las historias está siempre). El perfil de cada uno pide más por persona y sin respaldo
    (`muro.de_cada_uno()`)."""
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    d = d or {}
    extra = d.get('extra') or {}
    # ✋ lo que Dlx sacó no sale, venga de donde venga; lo que agregó va con el resto (ver `a_mano()`)
    fuera = set(d.get('quitar') or [])
    todas = [dict(x, quien=[x.get('quien') or ''] if isinstance(x.get('quien'), str) else list(x.get('quien') or []))
             for x in (d.get('mano') or []) + (d.get('items') or []) + (d.get('liga') or [])
             if _clave_url(x.get('url')) not in fuera]

    def vence(x):
        if x.get('o') == 'mano' and _de_iso(x.get('hasta')):
            return _de_iso(x['hasta'])
        t = _de_iso(x.get('t'))
        v = (t + dt.timedelta(days=SEMANA)) if t else None
        e = _de_iso(extra.get(x['id'])) if extra.get(x['id']) else None
        return max([y for y in (v, e) if y] or [ahora])
    por, out, n_sv, n_lg = {}, [], 0, 0

    def poner(x, hasta):
        y = {'tipo': 'promo', 't': x['t'], 'hasta': _iso(hasta), 'sv': x.get('sv') or '', 'quien': x['quien'],
             'url': x['url'], 'plat': x['plat'], 'pid': x['id']}
        for k in ('o', 'vid', 'tit', 'de', 'img'):
            if x.get(k):
                y[k] = x[k]
        if extra.get(x['id']) and _de_iso(extra[x['id']]) and _de_iso(extra[x['id']]) > ahora:
            y['alargada'] = True
        out.append(y)
        for q in x['quien']:
            por[q] = por.get(q, 0) + 1
    activas = [(x, vence(x)) for x in todas if vence(x) > ahora]
    # la alargada primero (pagó por estar), después la más nueva
    activas.sort(key=lambda p: p[0].get('t') or '', reverse=True)
    activas.sort(key=lambda p: not ((extra.get(p[0]['id']) or '') > _iso(ahora) or p[0].get('o') == 'mano'))
    for x, hasta in activas:
        # las de Dlx, como las pagadas: primero y sin el tope por persona
        pago = (extra.get(x['id']) or '') > _iso(ahora) or x.get('o') == 'mano'
        es_liga = x.get('o') == 'liga'
        if not pago:
            if any(por.get(q, 0) >= por_persona for q in x['quien']):
                continue
            if (n_lg >= LIGA_TOPE and respaldo) if es_liga else n_sv >= tope:
                continue
        poner(x, hasta)
        n_lg += es_liga
        n_sv += not es_liga
    if respaldo and len(out) < MIN_CIRCULO:
        ya = {y['pid'] for y in out}
        for x in sorted(todas, key=lambda x: x.get('t') or '', reverse=True):
            if len(out) >= MIN_CIRCULO:
                break
            if x['id'] not in ya:
                poner(x, ahora + dt.timedelta(hours=RESPALDO_H))
    out.sort(key=lambda y: y['t'], reverse=True)
    return out


# ── self-check ───────────────────────────────────────────────────────────
def _self_check():
    print('\n══ LAS PROMOCIONES ══\n')
    mal = 0

    def ok(c, q, extra=''):
        nonlocal mal
        mal += not c
        print('   %s %s%s' % ('✅' if c else '🔴', q, ('  ' + extra) if extra and not c else ''))

    ok([p for _u, p in links('mi tema https://youtu.be/abcdefghijk y https://open.spotify.com/track/x '
                             'https://discord.gg/abc https://www.instagram.com/p/x/ https://vm.tiktok.com/x '
                             'https://soundcloud.com/a/b https://m.youtube.com/watch?v=abcdefghijk', tope=9)]
       == ['yt', 'sp', 'ig', 'tt', 'sc', 'yt'],
       'sólo música y video: YouTube, Spotify, Instagram, TikTok y SoundCloud; la invitación a otro Discord, no')
    ok(len(links('https://youtu.be/a1 https://youtu.be/a2 https://youtu.be/a3')) == 2, 'como mucho dos links por mensaje')
    # ✋ a mano: agregar y sacar
    t0 = dt.datetime(2026, 10, 20, 20, tzinfo=dt.timezone.utc)
    mm = a_mano([{'u': 'https://youtu.be/abcdefghijk', 'quien': 'SOL', 'dias': 3, 't': '2026-10-20T20:00:00Z'},
                 {'u': 'https://discord.gg/x'}], t0)
    ok(len(mm) == 2 and mm[0]['o'] == 'mano' and mm[0]['hasta'] == '2026-10-23T20:00:00Z' and mm[0]['vid'] == 'abcdefghijk'
       and mm[1]['plat'] == 'dc' and a_mano([{'u': 'https://ejemplo.com/x'}], t0)[0]['plat'] == 'web' and not links('https://discord.gg/x'),
       'a mano: entra con sus días, y cualquier link (Discord, una página); de los canales, sigue sólo música y video', str(mm))
    dd = {'mano': mm, 'quitar': [_clave_url('https://youtu.be/zzzzzzzzzzz?si=abc')],
          'items': [{'id': 'a', 't': '2026-10-20T10:00:00Z', 'sv': 'FFA', 'quien': 'SOL', 'url': 'https://youtu.be/zzzzzzzzzzz', 'plat': 'yt'},
                    {'id': 'b', 't': '2026-10-20T11:00:00Z', 'sv': 'FFA', 'quien': 'SOL', 'url': 'https://youtu.be/yyyyyyyyyyy', 'plat': 'yt'},
                    {'id': 'c', 't': '2026-10-20T12:00:00Z', 'sv': 'FFA', 'quien': 'SOL', 'url': 'https://youtu.be/xxxxxxxxxxx', 'plat': 'yt'}]}
    dd['mano'] = mm[:1]
    pm = para_muro(dd, t0, respaldo=False)
    ok([y['pid'] for y in pm][:1] == [mm[0]['id']] and 'a' not in [y['pid'] for y in pm] and len(pm) == 2,
       'la de Dlx entra primera (y cuenta en el tope de dos de esa persona); la sacada no sale aunque su link traiga ?si=', str([y['pid'] for y in pm]))
    cats = {'1': '「⚙」STAFF', '2': '🌐〘General FVS〙🌐'}
    ok(es_canal({'type': 0, 'name': '「📱」Spam-Promocion', 'parent_id': '2'}, cats)
       and es_canal({'type': 0, 'name': '[🌠]ᴘʀᴏᴍᴏᴄɪᴏɴ'.replace('ᴘʀᴏᴍᴏᴄɪᴏɴ', 'promocion'), 'parent_id': ''}, cats)
       and not es_canal({'type': 0, 'name': 'promo-staff', 'parent_id': '1'}, cats)
       and not es_canal({'type': 2, 'name': 'promocion', 'parent_id': ''}, cats)
       and not es_canal({'type': 0, 'name': 'redes', 'parent_id': ''}, cats),
       'el canal: con «promo» en el nombre, de texto, y nunca de una categoría de staff')
    ids = {'111': 'Ana'}
    m = {'id': '9', 'timestamp': '2026-10-15T20:00:00.000000+00:00', 'author': {'id': '111'},
         'content': 'nuevo tema!! https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3 escúchenlo'}
    p = promo_de(m, 'DRA', ids)
    ok(p == [{'id': '9-0', 't': '2026-10-15T20:00:00Z', 'sv': 'DRA', 'quien': 'Ana',
              'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3', 'plat': 'yt', 'vid': 'dQw4w9WgXcQ'}],
       'una promo: el link, de quién (su nombre de la Lista) y el id del video; el texto del mensaje no', str(p))
    ok(not promo_de(dict(m, author={'id': '222'}), 'DRA', ids) and not promo_de(dict(m, author={'id': '111', 'bot': True}), 'DRA', ids)
       and not promo_de(dict(m, content='entren a mi server https://discord.gg/x'), 'DRA', ids),
       'no entra: quien no está en la Lista, un bot, ni un mensaje sin música ni video')
    t0 = dt.datetime(2026, 10, 16, 12, tzinfo=dt.timezone.utc)
    d = {'items': [{'id': str(i), 't': '2026-10-%02dT10:00:00Z' % (15 - i), 'sv': 'SR', 'quien': 'Ana' if i < 4 else 'Bea',
                    'url': 'https://youtu.be/%011d' % i, 'plat': 'yt'} for i in range(6)]
         + [{'id': 'v', 't': '2026-08-01T10:00:00Z', 'sv': 'SR', 'quien': 'Cid', 'url': 'https://youtu.be/x', 'plat': 'yt'}]}
    pm = para_muro(d, t0)
    ok([x['quien'][0] for x in pm] == ['Ana', 'Ana', 'Bea', 'Bea'] and all(x['tipo'] == 'promo' for x in pm)
       and pm[0]['hasta'] == '2026-10-22T10:00:00Z',
       'al muro: las de la semana, dos por persona como mucho (la que publica diez no tapa al resto), con cuándo vence',
       str(pm))
    # 💳 una semana más: la de Cid, de agosto, alargada en la Tienda hasta el 20/10, entra primero y sin contar tope
    d2 = dict(d, extra={'v': '2026-10-20T00:00:00Z'})
    pm2 = para_muro(d2, t0)
    ok(pm2[-1]['quien'] == ['Cid'] and pm2[-1].get('alargada') and pm2[-1]['hasta'] == '2026-10-20T00:00:00Z'
       and len(pm2) == 5, 'la alargada en la Tienda sigue en la página hasta cuando pagó', str(pm2[-1]))
    # 🔵 el círculo, siempre: sin nada en la semana, las más nuevas por unas horas
    t9 = dt.datetime(2026, 11, 30, 12, tzinfo=dt.timezone.utc)
    pm3 = para_muro(d, t9)
    ok(len(pm3) == MIN_CIRCULO and pm3[0]['hasta'] == '2026-12-01T00:00:00Z' and not para_muro(d, t9, respaldo=False),
       'sin promos en la semana, el círculo sigue con las más nuevas (por %d horas); el perfil, no' % RESPALDO_H)
    # 📣 lo que promociona la Liga: los videos de nuestros participantes, una vez cada uno
    vj = {'videos': {'aaaaaaaaaaa': ['ANA vs BEA | Octavos', 'SR', ['Ana', 'Bea']], 'bbbbbbbbbbb': ['sin gente', 'SR', []]},
          'meta': {'aaaaaaaaaaa': ['2026-10-15T00:00:00Z', 9], 'bbbbbbbbbbb': ['2026-10-15T00:00:00Z', 9]}}
    pj = {'por': {'Cid': [['ccccccccccc', 'CID VS X | plaza', 'Plaza Norte', '2026-10-14T00:00:00Z', 'canal'],
                          ['aaaaaaaaaaa', 'ANA vs BEA', 'x', '2026-10-14T00:00:00Z', 'dlx']]}, 'ocultos': []}
    lg = de_la_liga(t0, vj, pj, {'dan': [['youtube', 'https://www.youtube.com/channel/UC' + 'x' * 22, 'Dan']]},
                    {'dan': 'Dan'}, lambda c: [{'vid': 'ddddddddddd', 't': '2026-10-16T01:00:00Z', 'tit': 'mi tema',
                                                'canal': 'Dan TV'}])
    ok([(x['vid'][0], x['por'], x['quien']) for x in lg] == [('d', 'canal', ['Dan']), ('a', 'socio', ['Ana', 'Bea']),
                                                             ('c', 'perfil', ['Cid'])]
       and all(x['o'] == 'liga' for x in lg),
       'la Liga promociona: su YouTube de «Mis redes», las batallas de los socios y lo que sumó cada uno (una vez cada video)',
       str([(x['vid'], x['por']) for x in lg]))
    pm4 = para_muro({'items': [], 'liga': lg}, t0)
    ok([x['quien'] for x in pm4] == [['Dan'], ['Ana', 'Bea'], ['Cid']] and pm4[0]['o'] == 'liga',
       'y van al muro como cualquier promo, con `o: liga`')
    print('\n   %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return mal


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        return 1 if _self_check() else 0
    print('\n══ LAS PROMOCIONES ══\n')
    lista = correr(aplicar='--aplicar' in sys.argv)
    if '--aplicar' not in sys.argv:
        for x in lista[:8]:
            print('      %s · %s · %s · %s' % (x['t'][:10], x['sv'], x['plat'], (x.get('tit') or '')[:50]))
        print('   (simulacro: no escribí nada — `--aplicar`)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
