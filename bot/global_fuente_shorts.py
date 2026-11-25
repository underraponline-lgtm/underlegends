# -*- coding: utf-8 -*-
"""📱 LOS SHORTS DE LOS CANALES DE BATALLAS, PARA LOS VIDEOS VERTICALES DE CADA PERFIL DEL RANKING GLOBAL.

    python bot/global_fuente_shorts.py --ver       lee los canales en vivo y dice cuántos shorts trae cada uno, sin escribir
    python bot/global_fuente_shorts.py --aplicar   lee y guarda datos/global_shorts.json
    python bot/global_fuente_shorts.py --auto      self-check sin red

Dlx, 24/11/2026: *«suma una fuente de shorts para los verticales»* (los cuadrados de videos del perfil de cada uno, «tanto
horizontales y verticales»: la 8.07 trajo los horizontales, que son las batallas). Los canales son los mismos del Ranking
global (`datos/global_canales.json`), y de cada uno se lee la pestaña pública «Shorts» (`/channel/<id>/shorts`), igual
que `global_fuente_youtube.py` lee la de videos: sin clave de la API, con las piezas de `bot/videos.py`.

⚠️ UN SHORT NO ES UNA BATALLA Y NO SUMA PUNTOS. Es un momento («MINUTAZO DE MECHA CONTRA GAZIR», «FAT TONY ES BICAMPEÓN»):
va a la pestaña «Videos» de quien nombra, nada más. Lo ata `atar()` desde `bot/global_ranking.py`, con la tabla ya armada.

⚠️ EN LA DUDA, A NADIE (la regla de siempre: unir de más es el error caro). Un short va a una persona sólo si su nombre
entero aparece en el título como palabra suelta, ese nombre lo tiene UNA sola persona de la tabla, tiene 4 letras o más
—o es de un pro— y no es una palabra común («ONCE» es un rapero y también un número: se queda afuera). Si el título nombra
a más de tres, es un compilado y no va a nadie. Y los hashtags no cuentan: los canales etiquetan nombres famosos que no
salen en el video.

⚠️ YOUTUBE NO DEJA SACAR MÉTRICAS DE SUS DATOS: sólo el id del video, su título (para atarlo) y de qué canal es.
"""
import datetime as dt
import io
import json
import os
import re
import sys
import time
import unicodedata

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE):
    if _p not in sys.path:
        sys.path.insert(0, _p)

CANALES = os.path.join(BASE, 'datos', 'global_canales.json')
SALIDA = os.path.join(BASE, 'datos', 'global_shorts.json')
PAUSA = 1.0          # ~1 pedido por segundo, como global_fuente_youtube.py
GUARDAR = 4000       # cuántos shorts se guardan como mucho (los más nuevos)
POR_PERSONA = 12     # cuántos viajan en el perfil de cada uno
MAX_NOMBRADOS = 3    # un título que nombra a más es un compilado
#: palabras que también son nombres de raperos y aparecen en títulos sin hablar de ellos
COMUNES = {'once', 'todos', 'todo', 'rimas', 'rima', 'historia', 'mejor', 'mejores', 'campeon', 'campeona', 'batalla',
           'batallas', 'final', 'finales', 'nada', 'nadie', 'menor', 'mayor', 'grande', 'leyenda', 'rey', 'reina', 'king',
           'flow', 'free', 'freestyle', 'shorts', 'short', 'mundo', 'mundial', 'nacional', 'internacional', 'fecha',
           'jornada', 'liga', 'red', 'bull', 'fms', 'god', 'level', 'contra', 'vuelta', 'fuego', 'humor', 'tiempo', 'rap',
           'barras', 'barra', 'punch', 'punchline', 'replica', 'minuto', 'minutazo', 'temas', 'tema', 'calle', 'plaza',
           'piezas', 'flash', 'reyes', 'sombra', 'dios', 'diablo', 'luna', 'sol',
           # 25/11/2026: «Algunos vuelven al under», «El Sur es Hardcore»: los dos son raperos de la Liga y los cinco
           # shorts que tenían atados no eran de ellos
           'under', 'underground', 'hardcore'}


def norm(s):
    s = unicodedata.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()


def _shorts_de(d):
    """`[(id, título)]` de la `ytInitialData` de una pestaña «Shorts» (`shortsLockupViewModel` o el viejo `reelItemRenderer`)"""
    out = []

    def rec(o):
        if isinstance(o, dict):
            m = o.get('shortsLockupViewModel')
            if isinstance(m, dict):
                vid = (((m.get('onTap') or {}).get('innertubeCommand') or {}).get('reelWatchEndpoint') or {}).get('videoId')
                t = ((m.get('overlayMetadata') or {}).get('primaryText') or {}).get('content')
                if vid and t:
                    out.append((vid, t))
            r = o.get('reelItemRenderer')
            if isinstance(r, dict) and r.get('videoId'):
                t = ''.join(x.get('text', '') for x in ((r.get('headline') or {}).get('runs') or [])) or (r.get('headline') or {}).get('simpleText') or ''
                if t:
                    out.append((r['videoId'], t))
            for v in o.values():
                rec(v)
        elif isinstance(o, list):
            for v in o:
                rec(v)
    rec(d)
    vistos, unicos = set(), []
    for vid, t in out:
        if re.match(r'^[A-Za-z0-9_-]{11}$', vid) and vid not in vistos:
            vistos.add(vid)
            unicos.append((vid, t))
    return unicos


def leer_canal(cid):
    """Los shorts de la pestaña pública de un canal (la primera página: los ~48 más nuevos)"""
    import requests
    import videos as V
    r = requests.get('https://www.youtube.com/channel/%s/shorts' % cid, headers=V.H, cookies=V.CK, timeout=30)
    if r.status_code != 200:
        raise RuntimeError('HTTP %s' % r.status_code)
    d = V._json_tras(r.content.decode('utf-8', 'replace'), 'ytInitialData')
    if not d:
        raise RuntimeError('la pestaña no trajo datos')
    return _shorts_de(d)


def actualizar(aplicar=True):
    """Lee los shorts de todos los canales y los junta con los guardados (los nuevos arriba). Un canal que falla no
    tumba a los demás: sus shorts guardados quedan. Devuelve `(shorts, avisos)`"""
    cfg = json.load(io.open(CANALES, encoding='utf-8'))
    try:
        viejo = json.load(io.open(SALIDA, encoding='utf-8')).get('s') or []
    except (OSError, ValueError):
        viejo = []
    hoy = dt.date.today().isoformat()
    nuevos, avisos = [], []
    for c in cfg.get('canales') or []:
        try:
            xs = leer_canal(c['id'])
        except Exception as e:                           # noqa: BLE001
            avisos.append('%s: no pude leer sus shorts (%s)' % (c['nombre'], str(e)[:80]))
            continue
        nuevos += [[vid, t, c['slug'], hoy] for vid, t in xs]
        time.sleep(PAUSA)
    ya = {x[0] for x in nuevos}
    todo = (nuevos + [x for x in viejo if x[0] not in ya])[:GUARDAR]
    if aplicar:
        with io.open(SALIDA, 'w', encoding='utf-8', newline='\n') as f:
            json.dump({'_leeme': 'Los shorts de los canales del Ranking global (bot/global_fuente_shorts.py): [id, título, canal, '
                       'cuándo se vio]. No suman puntos: van a los videos verticales del perfil de quien nombran.', 's': todo},
                      f, ensure_ascii=False, separators=(',', ':'))
    return todo, avisos


def guardados():
    try:
        return json.load(io.open(SALIDA, encoding='utf-8')).get('s') or []
    except (OSError, ValueError):
        return []


def titulo_web(titulo):
    """el título para la página de Reels (24/11/2026): sin hashtags, sin emojis y sin espacios de más, hasta 100 letras"""
    t = re.sub(r'#\S+', ' ', str(titulo or ''))
    t = re.sub(r'[\U0001F000-\U0001FAFF\u2600-\u27BF\uFE0F\u200D]', '', t)
    t = re.sub(r'\s+', ' ', t).strip(' -|·')
    return t if len(t) <= 100 else t[:99].rstrip() + '…'


def atar(shorts, gente):
    """`{clave: [[id, canal, [otros que nombra], título]…]}`: cada short, a quienes nombra (ver arriba). `gente`: las filas
    de la tabla (`{k, n, esc}`). El título va limpio (`titulo_web`), para la página de Reels"""
    por_nombre = {}
    for g in gente:
        n = norm(g.get('n'))
        if n:
            por_nombre.setdefault(n, []).append(g)
    validos = {}
    for n, gs in por_nombre.items():
        if len(gs) != 1:                                 # dos con el mismo nombre: no se sabe cuál
            continue
        g = gs[0]
        if n in COMUNES or (len(n.replace(' ', '')) < 4 and g.get('esc') != 'pro') or len(n) < 3:
            continue
        validos[n] = g['k']
    # los nombres de varias palabras primero, así «fat tony» no se lee también como «tony»
    orden = sorted(validos, key=lambda n: -len(n))
    pats = [(n, re.compile(r'(?:^| )' + re.escape(n) + r'(?: |$)')) for n in orden]
    out = {}
    for vid, titulo, canal, *_ in shorts:
        # ⚠️ SIN LOS HASHTAGS (24/11/2026): los canales etiquetan nombres famosos para que los encuentren —«Stewart😎
        # #chuty», «MOMENTOS YELL vs MILA #rapder #chuty»— y el short le aparecía a quien no sale. Cuenta sólo el título
        t = ' ' + norm(re.sub(r'#\S+', ' ', str(titulo or ''))) + ' '
        ks = []
        for n, p in pats:
            if p.search(t):
                ks.append(validos[n])
                t = t.replace(' ' + n + ' ', ' · ')
        ks = list(dict.fromkeys(ks))
        if not ks or len(ks) > MAX_NOMBRADOS:
            continue
        for k in ks:
            xs = out.setdefault(k, [])
            if len(xs) < POR_PERSONA:
                xs.append([vid, canal, [x for x in ks if x != k], titulo_web(titulo)])
    return out


def _self_check():
    ok = True

    def chk(c, msg):
        nonlocal ok
        print(('  ✅ ' if c else '  ❌ ') + msg)
        ok = ok and c
    d = {'a': [{'shortsLockupViewModel': {'onTap': {'innertubeCommand': {'reelWatchEndpoint': {'videoId': 'CJH793pyv7o'}}},
                                         'overlayMetadata': {'primaryText': {'content': 'MINUTAZO DE MECHA CONTRA GAZIR 🔥 #shorts'}}}},
               {'reelItemRenderer': {'videoId': '5IgaVbXuQ7U', 'headline': {'simpleText': 'FAT TONY ES BICAMPEÓN'}}},
               {'shortsLockupViewModel': {'onTap': {'innertubeCommand': {'reelWatchEndpoint': {'videoId': 'malo'}}},
                                          'overlayMetadata': {'primaryText': {'content': 'x'}}}}]}
    xs = _shorts_de(d)
    chk(xs == [('CJH793pyv7o', 'MINUTAZO DE MECHA CONTRA GAZIR 🔥 #shorts'), ('5IgaVbXuQ7U', 'FAT TONY ES BICAMPEÓN')],
        'la pestaña: id y título de los dos formatos, y nada que no sea un id de YouTube')
    gente = [{'k': 'mecha', 'n': 'Mecha', 'esc': 'pro'}, {'k': 'gazir', 'n': 'Gazir', 'esc': 'pro'},
             {'k': 'fattony', 'n': 'Fat Tony', 'esc': 'pro'}, {'k': 'tony', 'n': 'Tony', 'esc': 'plaza'},
             {'k': 'once', 'n': 'Once', 'esc': 'plaza'}, {'k': 'abel', 'n': 'Abel', 'esc': 'pro'},
             {'k': 'abel-ec', 'n': 'Abel', 'esc': 'plaza'}, {'k': 'l', 'n': 'L', 'esc': 'plaza'},
             {'k': 'l-under', 'n': 'Under', 'esc': 'liga'}]
    sh = [['CJH793pyv7o', 'MINUTAZO DE MECHA CONTRA GAZIR 🔥 #shorts', 'redbull'],
          ['5IgaVbXuQ7U', 'FAT TONY ES BICAMPEÓN DE RED BULL', 'redbull'],
          ['Fnw0G7ZyoM8', 'AZUKY Y ONCE DIERON UNA BATALLA INCREÍBLE', 'redbull'],
          ['aaaaaaaaaaa', 'ABEL L HACE HISTORIA', 'redbull'],
          ['bbbbbbbbbbb', 'MECHA GAZIR FAT TONY Y TONY EN UNA NOCHE', 'redbull'],
          ['ccccccccccc', 'Stewart😎 #gazir #freestyle', 'cmf'],
          ['ddddddddddd', 'Algunos vuelven al under', 'bau']]
    A = atar(sh, gente)
    chk(A.get('mecha') == [['CJH793pyv7o', 'redbull', ['gazir'], 'MINUTAZO DE MECHA CONTRA GAZIR']]
        and A.get('gazir') == [['CJH793pyv7o', 'redbull', ['mecha'], 'MINUTAZO DE MECHA CONTRA GAZIR']],
        'un short que nombra a dos va a los dos, cada uno con el otro, y con su título sin emojis ni hashtags')
    chk(A.get('fattony') == [['5IgaVbXuQ7U', 'redbull', [], 'FAT TONY ES BICAMPEÓN DE RED BULL']] and 'tony' not in A,
        '«FAT TONY» es Fat Tony y no también Tony')
    chk('once' not in A and 'abel' not in A and 'abel-ec' not in A and 'l' not in A,
        'en la duda, a nadie: una palabra común, un nombre con dos dueños o una sola letra')
    chk(not any(x[0] == 'bbbbbbbbbbb' for xs in A.values() for x in xs), 'un título que nombra a más de tres es un compilado')
    chk(not any(x[0] == 'ccccccccccc' for xs in A.values() for x in xs), 'un nombre que sólo está en un hashtag no cuenta')
    chk('l-under' not in A, '«el under» es la escena, no Under de la Liga')
    print('✅ todo bien' if ok else '❌ algo falló')
    return ok


if __name__ == '__main__':
    if '--auto' in sys.argv:
        sys.exit(0 if _self_check() else 1)
    sh, av = actualizar(aplicar='--aplicar' in sys.argv)
    for a in av:
        print('⚠️', a)
    print('📱 %d shorts guardados%s' % (len(sh), '' if '--aplicar' in sys.argv else ' (sin escribir: --aplicar)'))
