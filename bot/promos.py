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
  5. LO DE LOS ÚLTIMOS `DIAS` DÍAS, y como mucho `POR_PERSONA` por persona en el muro: el que publica diez veces por
     semana no tapa al resto.

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
#: cuánto vive una promo, cuántas se guardan y cuántas de cada uno van al muro
DIAS, GUARDA, POR_PERSONA, AL_MURO = 30, 400, 2, 24
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
    desde = (ahora - dt.timedelta(days=DIAS)).strftime('%Y-%m-%dT%H:%M:%S')
    lista = sorted((x for x in items.values() if x['t'] >= desde), key=lambda x: x['t'], reverse=True)[:GUARDA]
    usados = {x['url'] for x in lista}
    cache = {u: v for u, v in cache.items() if u in usados}
    print('   📣 promos: %d canal(es) de %d servidor(es) · %d nueva(s) · %d guardada(s)'
          % (sum(len(v) for v in canales.values()), len(canales), nuevas, len(lista)))
    if aplicar:
        with io.open(SALIDA, 'w', encoding='utf-8', newline='\n') as f:
            json.dump({'_leeme': 'Las promociones de los canales de promoción de cada servidor: el link y de quién es, '
                                 'nunca el texto. Lo escribe bot/promos.py (paso 2b8c); lo lee bot/muro.py.',
                       'canales': canales, 'canales_t': t_can, 'ult': ult, 'items': lista, 'oembed': cache},
                      f, ensure_ascii=False, indent=0)
    return lista


def para_muro(d, ahora=None, por_persona=POR_PERSONA, tope=AL_MURO):
    """🧱 Las promos que van al muro: las de los últimos `DIAS` días, como mucho `por_persona` por persona y `tope`
    en total, la más nueva primero: `[{tipo: 'promo', t, sv, quien, url, plat, vid?, tit?, de?, img?}]`. El perfil de
    cada uno pide más por persona (`muro.de_cada_uno()`)."""
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    desde = (ahora - dt.timedelta(days=DIAS)).strftime('%Y-%m-%dT%H:%M:%S')
    por, out = {}, []
    for x in sorted((d or {}).get('items') or [], key=lambda x: x.get('t') or '', reverse=True):
        if (x.get('t') or '') < desde:
            continue
        q = x.get('quien') or ''
        if por.get(q, 0) >= por_persona:
            continue
        por[q] = por.get(q, 0) + 1
        y = {'tipo': 'promo', 't': x['t'], 'sv': x.get('sv') or '', 'quien': [q], 'url': x['url'], 'plat': x['plat'],
             'pid': x['id']}
        for k in ('vid', 'tit', 'de', 'img'):
            if x.get(k):
                y[k] = x[k]
        out.append(y)
        if len(out) >= tope:
            break
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
    ok([x['quien'][0] for x in pm] == ['Ana', 'Ana', 'Bea', 'Bea'] and all(x['tipo'] == 'promo' for x in pm),
       'al muro: las del último mes, dos por persona como mucho (la que publica diez no tapa al resto)', str(pm))
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
