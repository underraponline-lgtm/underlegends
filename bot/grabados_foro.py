# -*- coding: utf-8 -*-
"""🔴 EL FORO «『🔴』eventos-grabados» DE DRA: UN POST POR SERVIDOR, CON TODOS SUS EVENTOS (28/11/2026).

Dlx, 28/11: «no vamos a crear un post para cada uno, me parecería algo tonto… en uno alcanzaría todo, simplemente
tendríamos que poner la info necesaria y separadores, o sea FEBRERO, luego fechas, nombre del evento, o sea ser
específicos», «ahí pon el link del video de YouTube completo del evento» y «crea diferentes categorías y diferentes tags
para filtrar mejor».

LO QUE ARMA (`mensajes()`), en Components V2 —imagen y cajas, el estilo de los carteles de DRA, no un texto suelto—:
  · un post por servidor socio con eventos grabados: «[SIGLA] Nombre — eventos grabados», con su banner
    (`bot/paginas/banners/<sv>.jpg`, el de eventos-hoy) o, si no tiene, su logo; la caja con el color de su marca
  · adentro, los MESES como separadores (**NOVIEMBRE 2026**, el más nuevo arriba) y una línea por evento: el día y la hora
    (ET), el nombre exacto, el video entero de YouTube, la llave en la página (donde suenan las batallas) y cuántas batallas
  · si no entra en un mensaje (Discord: 4.000 caracteres de texto y 40 piezas por mensaje con V2), sigue en el siguiente del
    mismo hilo; los ids de cada uno quedan guardados (`grab_foro` del objeto)
  · un post fijado «📌 Cómo funciona» (`guia()`)
  · ETIQUETAS para filtrar (`etiquetas()`): el Tier de cada servidor, el tipo de evento cuando el nombre lo dice
    (Competencia, Liga, Cypher, Evento de nuevos) y «DRA». Discord deja 20 en el foro y 5 por post

🔁 SE EDITA, NUNCA SE VUELVE A POSTEAR: cada post guarda la huella de lo publicado; si cambia (un evento nuevo, el video de
YouTube que llegó), se editan sus mensajes —primero se desarchiva el hilo— y se suman los que falten. Un mensaje que ya no
hace falta no se borra (los borra Dlx): queda con un «·».

DE DÓNDE SALE: los eventos, de la historia del objeto (`POST /grabados/foro-datos`, clave del ciclo: bot/grabados.js
`historia()`, que no se poda con los audios); los servidores, de `datos/servidores.json`, `bot/tiers.py` y
`datos/colores_sv_marca.json`. ⚠️ Nada de nadie: el foro lista eventos, no personas.

⚠️ PRENDIDO SÓLO CON `cfg.foro` (`python bot/grabados.py --config foro=true`): `--aplicar` con el foro apagado no hace nada.
Lo corre `shorts.yml` cada media hora (sólo edita lo que cambió).

Uso:
    python bot/grabados_foro.py --auto                 el self-check, sin red
    python bot/grabados_foro.py --vista [--muestra]    arma todo sin tocar Discord: json + html + png en la carpeta de vista
                                                        (--muestra: con las llaves reales de datos/llaves_t1.json, sin el objeto)
    python bot/grabados_foro.py --aplicar              publica / edita (sólo si cfg.foro está prendido)
"""
import datetime as dt
import hashlib
import html
import io
import json
import os
import re
import sys
import time

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
FORO = '1575848965503721523'
HUB = 'https://underlegends.pages.dev'
API = 'https://discord.com/api/v10'
V2 = 1 << 15
FIJADO = 2
#: lo que entra en un mensaje (Discord: 4.000 de texto y 40 piezas con V2), con margen
LIM_TEXTO, LIM_PIEZAS = 3600, 36
TAGS_MAX, TAGS_POST = 20, 5
MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
#: el tipo de evento, cuando el nombre lo dice (si no, «Competencia»: lo que se graba es una llave). En orden: gana el primero
#: ⚠️ «nuevos» en plural: «COMPE CHOP NUEVO CEO» (CYH) no es el evento de los que juegan por primera vez
TIPOS = [('Evento de nuevos', r'\bnuevos\b|primer evento'), ('Cypher', r'\bcypher'), ('Liga', r'\bliga\b|\bjornada\b|\bfecha \d')]
TIPO_BASE = 'Competencia'
GUIA = '_guia'
VISTA = os.environ.get('GRABADOS_VISTA') or os.path.join(os.environ.get('TEMP', '/tmp'), 'grabados_foro')


# ── LOS SERVIDORES ───────────────────────────────────────────────────────────────────────────────────────────────────
def _version(ruta):
    with open(ruta, 'rb') as f:
        return hashlib.sha1(f.read()).hexdigest()[:8]


def servidores():
    """`{SV: {sigla, nombre, tier, color, banner, logo}}`: lo que el post muestra de cada servidor. Las imágenes, de la
    página (Pages las sirve: no hay nada que subir), con `?v=` del contenido para que Discord no se quede con una vieja."""
    S = json.load(io.open(os.path.join(BASE, 'datos', 'servidores.json'), encoding='utf-8'))['servidores']
    try:
        C = json.load(io.open(os.path.join(BASE, 'datos', 'colores_sv_marca.json'), encoding='utf-8')).get('usar') or {}
    except (OSError, ValueError):
        C = {}
    try:
        import tiers
        T = tiers.niveles(S) or {}
    except Exception:
        T = {}
    out = {}
    for sv, x in S.items():
        ban = os.path.join(BASE, 'bot', 'paginas', 'banners', sv.lower() + '.jpg')
        logo = os.path.join(BASE, 'bot', 'paginas', 'logos_sv', 'sv_' + sv.lower() + '.webp')
        col = str(C.get(sv) or '#E41373').lstrip('#')
        out[sv] = {'sigla': x.get('sigla') or sv, 'nombre': x.get('nombre') or sv,
                   'tier': int(T.get(x.get('sigla') or sv) or T.get(sv) or x.get('tier') or 1),
                   'color': int(col, 16) if re.fullmatch(r'[0-9A-Fa-f]{6}', col) else 0xE41373,
                   'banner': '%s/banners/%s.jpg?v=%s' % (HUB, sv.lower(), _version(ban)) if os.path.exists(ban) else '',
                   'logo': '%s/logos_sv/sv_%s.webp?v=%s' % (HUB, sv.lower(), _version(logo)) if os.path.exists(logo) else ''}
    return out


def tipo_de(nombre):
    n = str(nombre or '').lower()
    for t, rx in TIPOS:
        if re.search(rx, n):
            return t
    return TIPO_BASE


def etiquetas_post(sv, eventos, S):
    """Las etiquetas de un post: su Tier, los tipos de sus eventos y «DRA» (Discord: 5 por post)."""
    x = S.get(sv) or {}
    out = (['DRA'] if sv == 'DRA' else []) + ['Tier %d' % x.get('tier', 1)]
    for t in [t for t, _ in TIPOS] + [TIPO_BASE]:
        if any(tipo_de(e.get('nombre')) == t for e in eventos) and t not in out:
            out.append(t)
    return out[:TAGS_POST]


def etiquetas(por_sv, S):
    """Todas las que el foro necesita (máx. 20), en un orden fijo: DRA, los Tiers, los tipos, «Cómo funciona»."""
    usadas = {t for sv, evs in por_sv.items() for t in etiquetas_post(sv, evs, S)}
    orden = ['DRA', 'Tier 1', 'Tier 2', 'Tier 3', TIPO_BASE] + [t for t, _ in TIPOS]
    return [t for t in orden if t in usadas][:TAGS_MAX - 1] + ['Cómo funciona']


# ── EL POST ──────────────────────────────────────────────────────────────────────────────────────────────────────────
def _hora(ini):
    if not ini:
        return ''
    try:
        import zoneinfo
        t = dt.datetime.fromtimestamp(int(ini) / 1000, zoneinfo.ZoneInfo('America/New_York'))
    except Exception:
        return ''
    return '%d:%02d %s' % ((t.hour % 12) or 12, t.minute, 'AM' if t.hour < 12 else 'PM')


def _limpio(s, n=90):
    s = re.sub(r'[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]', '', str(s or ''))
    s = re.sub(r'\s+', ' ', s).strip()
    # sin markdown que rompa la línea ni menciones
    return re.sub(r'([*_`~|>\[\]])', r'\\\1', s).replace('@', '@\u200b')[:n] or 'Evento'


def linea(e):
    """Un evento: «**27/11** · 9:20 PM ET · **NOMBRE**» y abajo el video entero, la llave y cuántas batallas."""
    d = str(e.get('dia') or '')
    fecha = '%s/%s' % (d[8:10], d[5:7]) if re.fullmatch(r'\d{4}-\d{2}-\d{2}', d) else ''
    h = _hora(e.get('ini'))
    cab = ' · '.join(x for x in ('**%s**' % fecha if fecha else '', (h + ' ET') if h else '', '**%s**' % _limpio(e.get('nombre'))) if x)
    yt = str(e.get('yt') or '')
    partes = ['▶️ [El evento entero en YouTube](https://youtu.be/%s)' % yt if re.fullmatch(r'[A-Za-z0-9_-]{11}', yt) else '▶️ YouTube: pronto']
    if re.fullmatch(r'\d{1,9}', str(e.get('ll') or '')):
        partes.append('🎧 [Las batallas en la página](%s/freestyle-rap/llave/%s)' % (HUB, e['ll']))
    n = int(e.get('n') or 0)
    if n:
        partes.append('%d %s' % (n, 'batalla' if n == 1 else 'batallas'))
    return cab + '\n' + ' · '.join(partes)


def meses(eventos):
    """`[(clave, «NOVIEMBRE 2026», [eventos])]`, el mes más nuevo primero y, adentro, el evento más nuevo primero."""
    g = {}
    for e in eventos:
        d = str(e.get('dia') or '')
        k = d[:7] if re.fullmatch(r'\d{4}-\d{2}-\d{2}', d) else '0000-00'
        g.setdefault(k, []).append(e)
    out = []
    for k in sorted(g, reverse=True):
        nom = '%s %s' % (MESES[int(k[5:7]) - 1], k[:4]) if k != '0000-00' else 'SIN FECHA'
        out.append((k, nom, sorted(g[k], key=lambda e: (str(e.get('dia') or ''), int(e.get('ini') or 0)), reverse=True)))
    return out


def titulo(sv, S):
    x = S.get(sv) or {}
    return ('[%s] %s — eventos grabados' % (x.get('sigla') or sv, x.get('nombre') or sv))[:100]


def _cabecera(sv, S, eventos):
    x = S.get(sv) or {}
    n = len(eventos)
    # sin repetir el título: Discord ya lo muestra arriba del post
    intro = ('**%s** · Tier %d · %d %s grabado%s\nCada evento entero en YouTube y sus batallas en la página: con tu Pase, todas enteras.'
             % (_limpio(x.get('nombre') or sv, 80), x.get('tier', 1), n, 'evento' if n == 1 else 'eventos', '' if n == 1 else 's'))
    if x.get('banner'):
        return [{'type': 12, 'items': [{'media': {'url': x['banner']}, 'description': 'Banner de %s' % (x.get('nombre') or sv)}]},
                {'type': 10, 'content': intro}]
    if x.get('logo'):
        return [{'type': 9, 'components': [{'type': 10, 'content': intro}],
                 'accessory': {'type': 11, 'media': {'url': x['logo']}, 'description': 'Logo de %s' % (x.get('nombre') or sv)}}]
    return [{'type': 10, 'content': intro}]


def _piezas(c):
    return 1 + sum(_piezas(x) for x in c.get('components') or []) + (1 if c.get('accessory') else 0) + len(c.get('items') or [])


def _texto(c):
    return len(c.get('content') or '') + sum(_texto(x) for x in c.get('components') or [])


def _mensaje(color, dentro):
    return {'flags': V2, 'allowed_mentions': {'parse': []}, 'components': [{'type': 17, 'accent_color': color, 'components': dentro}]}


def mensajes(sv, eventos, S):
    """Los mensajes del post de `sv`: el primero con la imagen y la cabecera, y los meses con sus eventos; lo que no entra
    sigue en otro mensaje (con «· sigue» en el mes partido). Cada uno entra en los topes de Discord."""
    color = (S.get(sv) or {}).get('color', 0xE41373)
    out, dentro = [], list(_cabecera(sv, S, eventos))

    def cerrar():
        nonlocal dentro
        out.append(_mensaje(color, dentro))
        dentro = []

    def poner(texto):
        # el separador va entre meses, nunca arriba de todo en un mensaje que sigue
        dentro.extend(([{'type': 14, 'divider': True, 'spacing': 2}] if dentro else []) + [{'type': 10, 'content': texto}])

    def lugar(extra_txt, extra_piezas):
        c = {'components': dentro}
        return _texto(c) + extra_txt <= LIM_TEXTO and _piezas(c) + 2 + extra_piezas <= LIM_PIEZAS

    for _k, nom, evs in meses(eventos):
        bloque, sigue = [], False
        for e in evs:
            ln = linea(e)
            tit = '**%s**%s' % (nom, ' · sigue' if sigue else '')
            prueba = '\n\n'.join([tit] + bloque + [ln])
            if not lugar(len(prueba), 2):
                if bloque:
                    poner('\n\n'.join([tit] + bloque))
                    sigue = True
                cerrar()
                bloque = []
            bloque.append(ln)
        if bloque:
            tit = '**%s**%s' % (nom, ' · sigue' if sigue else '')
            if not lugar(len('\n\n'.join([tit] + bloque)), 2):
                cerrar()
            poner('\n\n'.join([tit] + bloque))
    if dentro:
        cerrar()
    return out


def guia():
    """📌 El post fijado: qué hay acá y qué da el Pase."""
    t = ('## 📌 Cómo funciona\n'
         'Acá está cada evento grabado de la Liga, un post por servidor y un mes debajo del otro.\n\n'
         '**Con el Pase T** escuchas en la página todas las batallas enteras y la grabación completa de cada evento, y acá '
         'tienes el video entero de YouTube.\n\n'
         '**Sin el Pase**, en la página de cada evento escuchas 30 segundos de cada batalla. Si rapeaste en ese evento, tu '
         'batalla suena entera, gratis: entra con Discord.\n\n'
         '🏷️ Filtra con las etiquetas: el Tier del servidor y el tipo de evento.\n'
         '💎 [Hazte Premium](%s/freestyle-rap/pase/premium) · 📅 [Los eventos de la Liga](%s/freestyle-rap/eventos)' % (HUB, HUB))
    return [_mensaje(0xE41373, [{'type': 10, 'content': t}])]


def huella(*xs):
    return hashlib.sha1(json.dumps(xs, sort_keys=True, ensure_ascii=False).encode('utf-8')).hexdigest()[:16]


def plan(eventos, S):
    """Todo lo que el foro tendría que mostrar: `{sv: {titulo, tags, mensajes, huella}}` + la guía, y la lista de etiquetas."""
    por = {}
    for e in eventos:
        sv = str(e.get('sv') or '').upper()
        if sv in S:
            por.setdefault(sv, []).append(e)
    posts = {}
    for sv, evs in sorted(por.items()):
        ms = mensajes(sv, evs, S)
        tg = etiquetas_post(sv, evs, S)
        posts[sv] = {'titulo': titulo(sv, S), 'tags': tg, 'mensajes': ms, 'huella': huella(titulo(sv, S), tg, ms)}
    g = guia()
    posts[GUIA] = {'titulo': '📌 Cómo funciona', 'tags': ['Cómo funciona'], 'mensajes': g, 'huella': huella('guia', g), 'fijado': True}
    return posts, etiquetas(por, S)


# ── DISCORD ──────────────────────────────────────────────────────────────────────────────────────────────────────────
def _token():
    import grabados
    return grabados._env('DISCORD_TOKEN')


def _dc(metodo, ruta, cuerpo=None):
    import requests
    for _ in range(4):
        r = requests.request(metodo, API + ruta, json=cuerpo, timeout=30,
                             headers={'Authorization': 'Bot ' + _token(), 'User-Agent': 'DiscordBot (https://underlegends.pages.dev, 1)'})
        if r.status_code == 429:
            time.sleep(float((r.json() or {}).get('retry_after', 2)) + 0.5)
            continue
        return r
    return r


def sincronizar_tags(necesarias):
    """Suma al foro las etiquetas que faltan (sin tocar las que ya hay) y devuelve `{nombre: id}`. Un PATCH del canal."""
    r = _dc('GET', '/channels/' + FORO)
    r.raise_for_status()
    hay = r.json().get('available_tags') or []
    nombres = {t['name'] for t in hay}
    faltan = [n for n in necesarias if n not in nombres]
    if faltan:
        lista = [{'id': t['id'], 'name': t['name'], 'moderated': t.get('moderated', False),
                  'emoji_id': t.get('emoji_id'), 'emoji_name': t.get('emoji_name')} for t in hay]
        lista += [{'name': n[:20], 'moderated': n == 'Cómo funciona'} for n in faltan][:max(0, TAGS_MAX - len(lista))]
        r = _dc('PATCH', '/channels/' + FORO, {'available_tags': lista})
        r.raise_for_status()
        hay = r.json().get('available_tags') or []
        print('foro: etiquetas nuevas: %s' % ', '.join(faltan))
    return {t['name']: t['id'] for t in hay}


def _al_worker(ruta, cuerpo):
    import grabados
    return grabados._al_worker(ruta, cuerpo)


def madrugada(ahora=None):
    """🌙 de 3 a 11 AM ET no se le manda nada a Discord (la regla de siempre: el ciclo duerme y de madrugada no suena nada)"""
    import zoneinfo
    t = ahora or dt.datetime.now(zoneinfo.ZoneInfo('America/New_York'))
    return 3 <= t.hour < 11


def aplicar(forzar=False):
    if madrugada() and not forzar:
        print('foro: de madrugada no se toca Discord')
        return 0
    st, D = _al_worker('/grabados/foro-datos', {})
    if st != 200:
        print('foro: el Worker dijo %d' % st)
        return 1
    if not (D.get('cfg') or {}).get('foro') and not forzar:
        print('foro: apagado (python bot/grabados.py --config foro=true)')
        return 0
    S = servidores()
    posts, tags = plan(D.get('eventos') or [], S)
    ids = sincronizar_tags(tags)
    viejos = {p['sv']: p for p in D.get('posts') or []}
    hechos = 0
    for sv, P in posts.items():
        V = viejos.get(sv)
        if V and V.get('huella') == P['huella']:
            continue
        tags_id = [ids[t] for t in P['tags'] if t in ids][:TAGS_POST]
        if not V or not V.get('hilo'):
            r = _dc('POST', '/channels/%s/threads' % FORO, {'name': P['titulo'], 'applied_tags': tags_id, 'message': P['mensajes'][0]})
            if not r.ok:
                print('foro: %s no se pudo crear (%d)' % (sv, r.status_code))
                continue
            hilo = r.json()['id']
            msgs = [hilo]
            if P.get('fijado'):
                _dc('PATCH', '/channels/' + hilo, {'flags': FIJADO})
        else:
            hilo, msgs = V['hilo'], list(V.get('mensajes') or [V['hilo']])
            _dc('PATCH', '/channels/' + hilo, {'archived': False, 'name': P['titulo'], 'applied_tags': tags_id})
            r = _dc('PATCH', '/channels/%s/messages/%s' % (hilo, msgs[0]), P['mensajes'][0])
            if not r.ok:
                print('foro: %s no se pudo editar (%d)' % (sv, r.status_code))
                continue
        for i, m in enumerate(P['mensajes'][1:], 1):
            if i < len(msgs):
                _dc('PATCH', '/channels/%s/messages/%s' % (hilo, msgs[i]), m)
            else:
                r = _dc('POST', '/channels/%s/messages' % hilo, m)
                if r.ok:
                    msgs.append(r.json()['id'])
        # 🙅 lo que sobra no se borra (eso lo hace Dlx): queda con un punto
        for mid in msgs[len(P['mensajes']):]:
            _dc('PATCH', '/channels/%s/messages/%s' % (hilo, mid), {'flags': V2, 'components': [{'type': 10, 'content': '·'}]})
        _al_worker('/grabados/foro-guardar', {'sv': sv, 'hilo': hilo, 'mensajes': msgs, 'huella': P['huella']})
        hechos += 1
        time.sleep(0.5)
    print('foro: %d posts al día, %d editados o nuevos' % (len(posts), hechos))
    return 0


# ── LA VISTA ─────────────────────────────────────────────────────────────────────────────────────────────────────────
def muestra():
    """Eventos de mentira con datos de verdad: las últimas llaves de datos/llaves_t1.json (nombre, servidor, día, batallas)."""
    L = json.load(io.open(os.path.join(BASE, 'datos', 'llaves_t1.json'), encoding='utf-8'))
    out = []
    for n in sorted(L, key=lambda k: int(k) if k.isdigit() else 0)[-90:]:
        x = L[n]
        d = str(x.get('dia') or x.get('fecha') or '')[:10]
        nb = sum(len(R.get('b') or []) for R in x.get('rondas') or [])
        yt = hashlib.sha1(n.encode()).hexdigest()[:11] if int(n) % 3 else ''
        ini = int(dt.datetime.fromisoformat(d + 'T21:00:00+00:00').timestamp() * 1000) + (int(n) % 5) * 1800000 if d else 0
        out.append({'ev': 'm-' + n, 'll': n, 'sv': x.get('sv') or '', 'nombre': x.get('nombre') or '', 'dia': d, 'ini': ini, 'n': nb, 'yt': yt})
    return out


def _md(t):
    t = html.escape(t)
    t = re.sub(r'\\([*_`~|>\[\]])', r'\1', t)
    t = re.sub(r'\[([^\]]+)\]\((https?://[^)]+)\)', r'<a href="\2">\1</a>', t)
    t = re.sub(r'^## (.*)$', r'<h2>\1</h2>', t, flags=re.M)
    t = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', t)
    return t.replace('\n', '<br>')


def _html(c):
    ty = c.get('type')
    if ty == 17:
        return '<div class="cont" style="border-left-color:#%06x">%s</div>' % (c.get('accent_color') or 0, ''.join(_html(x) for x in c['components']))
    if ty == 10:
        return '<div class="txt">%s</div>' % _md(c['content'])
    if ty == 14:
        return '<hr>'
    if ty == 12:
        return ''.join('<img class="gal" src="%s">' % html.escape(i['media']['url']) for i in c['items'])
    if ty == 9:
        return '<div class="sec"><div>%s</div><img class="th" src="%s"></div>' % (''.join(_html(x) for x in c['components']), html.escape(c['accessory']['media']['url']))
    return ''


CSS = ('body{margin:0;background:#313338;color:#dbdee1;font:15px/1.45 "gg sans","Segoe UI",sans-serif;padding:16px}'
       '.post{max-width:640px;margin:0 auto 28px}.titulo{font:700 20px/1.2 sans-serif;color:#f2f3f5;margin-bottom:6px}'
       '.tags span{display:inline-block;margin:0 6px 8px 0;padding:2px 8px;border-radius:10px;background:#404249;font-size:12px}'
       '.msg{margin:6px 0 14px}.msgn{font-size:11px;color:#949ba4;margin:10px 0 4px}'
       '.cont{background:#2b2d31;border-left:4px solid;border-radius:8px;padding:12px 14px}.txt{margin:6px 0}'
       '.txt h2{font-size:20px;margin:4px 0 6px;color:#f2f3f5}a{color:#00a8fc;text-decoration:none}b{color:#f2f3f5}'
       'hr{border:0;border-top:1px solid #3f4147;margin:12px 0}.gal{width:100%;border-radius:6px;display:block}'
       '.sec{display:flex;gap:12px;align-items:flex-start;justify-content:space-between}.th{width:84px;height:84px;border-radius:6px;object-fit:cover}')


def vista(eventos, carpeta):
    os.makedirs(carpeta, exist_ok=True)
    S = servidores()
    posts, tags = plan(eventos, S)
    hojas = []
    for sv, P in posts.items():
        with io.open(os.path.join(carpeta, '%s.json' % sv.strip('_')), 'w', encoding='utf-8') as f:
            json.dump({'titulo': P['titulo'], 'tags': P['tags'], 'mensajes': P['mensajes']}, f, ensure_ascii=False, indent=1)
        cuerpo = ''.join('<div class="msgn">mensaje %d de %d · %d caracteres</div><div class="msg">%s</div>' % (
            i + 1, len(P['mensajes']), sum(_texto(c) for c in m['components']), ''.join(_html(c) for c in m['components']))
            for i, m in enumerate(P['mensajes']))
        hojas.append((sv, '<div class="post"><div class="titulo">%s</div><div class="tags">%s</div>%s</div>' % (
            html.escape(P['titulo']), ''.join('<span>%s</span>' % html.escape(t) for t in P['tags']), cuerpo)))
    for sv, h in hojas:
        with io.open(os.path.join(carpeta, '%s.html' % sv.strip('_')), 'w', encoding='utf-8') as f:
            f.write('<!doctype html><meta charset="utf-8"><style>%s</style>%s' % (CSS, h))
    with io.open(os.path.join(carpeta, 'tags.json'), 'w', encoding='utf-8') as f:
        json.dump(tags, f, ensure_ascii=False)
    print('vista: %d posts, %d etiquetas (%s) en %s' % (len(posts), len(tags), ', '.join(tags), carpeta))
    for sv, P in posts.items():
        print('   %-6s %-55s %d mensaje(s) · %s' % (sv, P['titulo'][:55], len(P['mensajes']), ', '.join(P['tags'])))
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as pw:
            b = pw.chromium.launch()
            pg = b.new_page(viewport={'width': 700, 'height': 900})
            for sv, _h in hojas:
                pg.goto('file:///' + os.path.join(carpeta, '%s.html' % sv.strip('_')).replace('\\', '/'))
                pg.wait_for_timeout(600)
                pg.screenshot(path=os.path.join(carpeta, '%s.png' % sv.strip('_')), full_page=True)
            b.close()
    except Exception as e:
        print('vista: sin capturas (%s)' % type(e).__name__)
    return posts, tags


# ── EL SELF-CHECK ────────────────────────────────────────────────────────────────────────────────────────────────────
def _auto():
    fallas = []
    S = {'FFA': {'sigla': 'FFA', 'nombre': 'Freestyle For All', 'tier': 1, 'color': 0x26045B, 'banner': HUB + '/banners/ffa.jpg', 'logo': ''},
         'WOF': {'sigla': 'WOF', 'nombre': 'World Of Freestyle', 'tier': 3, 'color': 0xD20608, 'banner': '', 'logo': HUB + '/logos_sv/sv_wof.webp'},
         'DRA': {'sigla': 'DRA', 'nombre': 'Discord Rap Español', 'tier': 1, 'color': 0x5964E0, 'banner': '', 'logo': ''}}
    if [tipo_de(x) for x in ('DESGRACIAS EN TOKYO VOL 40', 'Cypher de los jueves', 'LIGA FMH JORNADA 3', 'Evento de Nuevos', 'Primer evento', 'COMPE CHOP NUEVO CEO')] != \
            ['Competencia', 'Cypher', 'Liga', 'Evento de nuevos', 'Evento de nuevos', 'Competencia']:
        fallas.append('tipo_de()')
    evs = [{'ev': 'a', 'll': '701', 'sv': 'FFA', 'nombre': 'VOL 40', 'dia': '2026-11-27', 'ini': 1764291600000, 'n': 9, 'yt': 'abcdefghijk'},
           {'ev': 'b', 'll': '650', 'sv': 'FFA', 'nombre': 'Cypher **raro** @everyone', 'dia': '2026-10-02', 'ini': 0, 'n': 4, 'yt': ''},
           {'ev': 'c', 'll': '702', 'sv': 'FFA', 'nombre': 'VOL 41', 'dia': '2026-11-28', 'ini': 0, 'n': 7, 'yt': ''}]
    M = meses(evs)
    if [m[1] for m in M] != ['NOVIEMBRE 2026', 'OCTUBRE 2026'] or [e['ev'] for e in M[0][2]] != ['c', 'a']:
        fallas.append('meses(): el mes más nuevo arriba y el evento más nuevo primero: %r' % [(m[1], [e['ev'] for e in m[2]]) for m in M])
    l0 = linea(evs[0])
    if not (l0.startswith('**27/11** · ') and 'ET' in l0 and 'https://youtu.be/abcdefghijk' in l0 and '/freestyle-rap/llave/701' in l0 and '9 batallas' in l0):
        fallas.append('linea(): %s' % l0)
    l1 = linea(evs[1])
    if 'YouTube: pronto' not in l1 or '@everyone' in l1 or '**raro**' in l1:
        fallas.append('linea() sin video, sin menciones ni markdown del nombre: %s' % l1)
    ms = mensajes('FFA', evs, S)
    txt = json.dumps(ms, ensure_ascii=False)
    if len(ms) != 1 or ms[0]['flags'] != V2 or ms[0]['components'][0]['type'] != 17 or ms[0]['components'][0]['components'][0]['type'] != 12:
        fallas.append('mensajes(): uno, V2, en una caja con el banner arriba')
    if txt.index('NOVIEMBRE 2026') > txt.index('OCTUBRE 2026') or '"type": 14' not in txt:
        fallas.append('mensajes(): los meses con separador, noviembre antes que octubre')
    if mensajes('WOF', evs[:1], S)[0]['components'][0]['components'][0].get('accessory', {}).get('type') != 11:
        fallas.append('mensajes(): sin banner, el logo al costado')
    # 🧱 muchos eventos: se parte en varios mensajes, cada uno en los topes, y el mes partido dice «sigue»
    muchos = [{'ev': 'x%d' % i, 'll': str(800 + i), 'sv': 'FFA', 'nombre': 'DESGRACIAS EN TOKYO VOLUMEN ESPECIAL NÚMERO %d' % i,
               'dia': '2026-%02d-%02d' % (9 + i % 3, 1 + i % 28), 'ini': 1764291600000, 'n': 8, 'yt': 'abcdefghijk'} for i in range(90)]
    mm = mensajes('FFA', muchos, S)
    tot = sum(_texto(c) for m in mm for c in m['components'])
    if len(mm) < 3 or any(sum(_texto(c) for c in m['components']) > 4000 or sum(_piezas(c) for c in m['components']) > 40 for m in mm):
        fallas.append('mensajes(): con 90 eventos, varios mensajes y cada uno en los topes (%d mensajes)' % len(mm))
    if any(m['components'][0]['components'][0]['type'] != 10 for m in mm[1:]):
        fallas.append('mensajes(): un mensaje que sigue arranca con el mes, no con un separador')
    if 'sigue' not in json.dumps(mm, ensure_ascii=False) or sum(json.dumps(m, ensure_ascii=False).count('youtu.be') for m in mm) != 90 or tot < 1000:
        fallas.append('mensajes(): los 90 eventos están, una sola vez, y el mes partido dice «sigue»')
    tg = etiquetas_post('DRA', [evs[1], evs[0]], S)
    if tg != ['DRA', 'Tier 1', 'Cypher', 'Competencia'] or etiquetas_post('WOF', evs[:1], S) != ['Tier 3', 'Competencia']:
        fallas.append('etiquetas_post(): %r' % tg)
    todas = etiquetas({'FFA': evs, 'WOF': evs[:1], 'DRA': evs[:1]}, S)
    if todas != ['DRA', 'Tier 1', 'Tier 3', 'Competencia', 'Cypher', 'Cómo funciona'] or len(todas) > TAGS_MAX:
        fallas.append('etiquetas(): %r' % todas)
    posts, _t = plan(evs + [dict(evs[0], ev='z', sv='NOEXISTE')], S)
    if set(posts) != {'FFA', GUIA} or posts['FFA']['titulo'] != '[FFA] Freestyle For All — eventos grabados' or not posts[GUIA].get('fijado'):
        fallas.append('plan(): un post por servidor conocido, más la guía fijada')
    if posts['FFA']['huella'] != plan(evs, S)[0]['FFA']['huella'] or posts['FFA']['huella'] == plan(evs[:2], S)[0]['FFA']['huella']:
        fallas.append('huella(): igual con lo mismo, distinta si entra un evento')
    if 'Pase T' not in json.dumps(guia(), ensure_ascii=False) or '30 segundos' not in json.dumps(guia(), ensure_ascii=False):
        fallas.append('guia(): qué da el Pase T y los 30 s')
    fallas += _auto_aplicar(S, evs, muchos)
    for f in fallas:
        print('🔴 ' + f)
    print('todo ok · grabados_foro' if not fallas else '%d fallas' % len(fallas))
    return 1 if fallas else 0


def _auto_aplicar(S, evs, muchos):
    """`aplicar()` contra un Discord y un Worker de mentira: crea, no repite, edita, se parte, no borra, etiquetas."""
    g = globals()
    antes = {k: g[k] for k in ('_dc', '_al_worker', 'servidores', 'madrugada')}
    fallas, pedidos, estado = [], [], {'posts': {}, 'eventos': list(evs), 'foro': True, 'tags': [{'id': '9', 'name': 'Destacado'}]}

    class R:
        def __init__(self, j, st=200):
            self.j, self.status_code, self.ok = j, st, st < 400

        def json(self):
            return self.j

        def raise_for_status(self):
            pass

    n = [1590000000000000000]

    def dc(metodo, ruta, cuerpo=None):
        pedidos.append((metodo, ruta, cuerpo))
        if ruta == '/channels/' + FORO and metodo == 'GET':
            return R({'available_tags': estado['tags']})
        if ruta == '/channels/' + FORO and metodo == 'PATCH':
            estado['tags'] = [dict(t, id=t.get('id') or str(100 + i)) for i, t in enumerate(cuerpo['available_tags'])]
            return R({'available_tags': estado['tags']})
        if metodo == 'POST':
            n[0] += 1
            return R({'id': str(n[0])})
        return R({})

    def worker(ruta, cuerpo):
        if ruta == '/grabados/foro-datos':
            return 200, {'cfg': {'foro': estado['foro']}, 'eventos': estado['eventos'], 'posts': list(estado['posts'].values())}
        if ruta == '/grabados/foro-guardar':
            estado['posts'][cuerpo['sv']] = dict(cuerpo)
        return 200, {'ok': True}

    g.update(_dc=dc, _al_worker=worker, servidores=lambda: S, madrugada=lambda ahora=None: False)
    try:
        estado['foro'] = False
        aplicar()
        if pedidos:
            fallas.append('aplicar(): con el foro apagado no toca Discord')
        estado['foro'] = True
        aplicar()
        hilos = [p for p in pedidos if p[0] == 'POST' and p[1].endswith('/threads')]
        if len(hilos) != 2 or not all(p[2]['message']['flags'] == V2 and p[2]['applied_tags'] for p in hilos):
            fallas.append('aplicar(): un hilo por servidor + la guía, en V2 y con etiquetas: %d' % len(hilos))
        if not any(p[0] == 'PATCH' and p[1] == '/channels/' + FORO and any(t['name'] == 'Destacado' for t in p[2]['available_tags']) for p in pedidos):
            fallas.append('aplicar(): las etiquetas nuevas se suman sin borrar las que ya había')
        if not any(p == ('PATCH', '/channels/%s' % estado['posts'][GUIA]['hilo'], {'flags': FIJADO}) for p in pedidos):
            fallas.append('aplicar(): la guía queda fijada')
        pedidos.clear()
        aplicar()
        if [p for p in pedidos if p[0] in ('POST', 'PATCH') and p[1] != '/channels/' + FORO]:
            fallas.append('aplicar(): sin cambios no edita nada')
        # entran 90 eventos: el mismo hilo se edita y suma mensajes; nunca otro hilo
        estado['eventos'] = list(evs) + muchos
        pedidos.clear()
        aplicar()
        if any(p[1].endswith('/threads') for p in pedidos) or not any(p[0] == 'PATCH' and p[2] and p[2].get('archived') is False for p in pedidos):
            fallas.append('aplicar(): un evento nuevo EDITA el post (desarchivado), no crea otro')
        ms = estado['posts']['FFA']['mensajes']
        if len(ms) < 3:
            fallas.append('aplicar(): el post partido guarda los ids de cada mensaje: %r' % ms)
        # y si vuelve a entrar en menos mensajes, lo que sobra queda con un punto (no se borra)
        estado['eventos'] = list(evs)
        pedidos.clear()
        aplicar()
        if any(p[0] == 'DELETE' for p in pedidos) or not any(p[0] == 'PATCH' and p[2] and '·' in json.dumps(p[2], ensure_ascii=False) and p[1].endswith(ms[-1]) for p in pedidos):
            fallas.append('aplicar(): lo que sobra queda con «·» y no se borra')
    finally:
        g.update(antes)
    return fallas


def main():
    a = sys.argv[1:]
    if '--auto' in a:
        return _auto()
    if '--vista' in a:
        if '--muestra' in a:
            evs = muestra()
        else:
            try:
                st, D = _al_worker('/grabados/foro-datos', {})
            except Exception:
                st, D = 0, {}
            evs = (D or {}).get('eventos') or []
            if st != 200 or not evs:
                print('vista: el objeto no tiene eventos (%d): uso la muestra' % st)
                evs = muestra()
        i = a.index('--vista')
        carpeta = a[i + 1] if i + 1 < len(a) and not a[i + 1].startswith('--') else VISTA
        vista(evs, carpeta)
        return 0
    if '--aplicar' in a:
        return aplicar('--forzar' in a)
    print(__doc__)
    return 0


if __name__ == '__main__':
    sys.exit(main())
