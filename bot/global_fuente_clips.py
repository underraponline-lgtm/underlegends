# -*- coding: utf-8 -*-
"""🎞️ LOS VIDEOS HORIZONTALES CORTOS DE LOS CANALES DE BATALLAS, PARA LA COLUMNA IZQUIERDA DE REELS EN LA COMPU.

    python bot/global_fuente_clips.py --ver       lee los canales en vivo y dice cuántos clips trae cada uno, sin escribir
    python bot/global_fuente_clips.py --aplicar   lee y guarda datos/global_clips.json
    python bot/global_fuente_clips.py --auto      self-check sin red

Dlx, 25/11/2026, mirando Reels en la compu (la columna izquierda era una lista larga de gente y se veía vacía): *«podríamos
poner otras cosas a la izquierda, como videos horizontales»* y *«no todos los videos de YouTube son verticales; hay también
videos que podríamos poner aquí que no duren bastante»*. Decidido con él: se reproducen EN EL CENTRO (el reproductor pasa a
16:9 mientras corre y vuelve a vertical con el short siguiente), y entran **hasta 5 minutos**.

De dónde: los mismos canales del Ranking global (`datos/global_canales.json`), la pestaña pública «Videos»
(`/channel/<id>/videos`), como `global_fuente_youtube.bajar()`: sin clave de la API, ~1 pedido por segundo, la primera página
y una continuación (~60 videos por canal). La duración sale del sello de la miniatura («6:44», `thumbnailBadgeViewModel` en
el `lockupViewModel` de hoy, o `lengthText` en el `videoRenderer` de antes). Entra de 20 s a 5:00: menos es un corte o un
anuncio, más ya no es «que no dure bastante». Un directo o un estreno no traen hora en el sello y no entran.

⚠️ MUCHAS BATALLAS ENTERAS DURAN MENOS DE 5 MINUTOS (Red Bull, octavos de México 2026: 4:20 a 4:51). Entran igual: son
videos horizontales cortos, que es lo que se pidió. NO SUMAN PUNTOS: los puntos los saca `global_fuente_youtube.py` de los
mismos títulos; esto es sólo qué mostrar.

⚠️ SE ATAN CON `global_fuente_shorts.atar()`, la misma regla: un clip va a quien nombra su título (nombre entero, una sola
persona con ese nombre, nada de palabras comunes, más de tres = compilado = a nadie). Un clip que no nombra a nadie de la
tabla no viaja a la página: la columna muestra GENTE de la Liga y del Ranking, que es el valor propio que pide YouTube.

⚠️ YOUTUBE NO DEJA SACAR MÉTRICAS DE SUS DATOS (ver el encabezado de global_fuente_youtube.py): se guarda el id, el título,
el canal, cuánto dura y el día en que lo vimos. Ni vistas ni likes, y «hace 3 semanas» tampoco: esa fila trae las vistas.
"""
import datetime as dt
import io
import json
import os
import re
import sys
import time
import zoneinfo

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE):
    if _p not in sys.path:
        sys.path.insert(0, _p)

CANALES = os.path.join(BASE, 'datos', 'global_canales.json')
SALIDA = os.path.join(BASE, 'datos', 'global_clips.json')
WEB = os.path.join(BASE, 'bot', 'paginas', 'global_clips.json')
ET = zoneinfo.ZoneInfo('America/New_York')
PAUSA = 1.0          # ~1 pedido por segundo, como global_fuente_youtube.py
PAGINAS = 2          # la primera y una continuación: ~60 videos por canal
MIN_SEG = 20         # menos es un corte suelto o un anuncio
MAX_SEG = 5 * 60     # Dlx, 25/11/2026: «5 minutos»
GUARDAR = 3000       # cuántos se guardan como mucho (los más nuevos)
EN_LA_WEB = 400      # cuántos viajan a la página (los más nuevos que nombran a alguien)
_HORA = re.compile(r'^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$')
#: «JUASMIO X ZIGNOS VS RIDOR X ZOO»: la x suelta junta a dos del mismo lado
_JUNTA = re.compile(r'(?:^| )x(?: |$)')


def segundos(txt):
    """«6:44» → 404, «1:02:03» → 3723; lo que no es una hora («EN VIVO», «PRÓXIMAMENTE», «SHORTS») → None"""
    m = _HORA.match(str(txt or '').strip())
    if not m:
        return None
    h, mi, s = int(m.group(1) or 0), int(m.group(2)), int(m.group(3))
    return None if s >= 60 or (m.group(1) and mi >= 60) else h * 3600 + mi * 60 + s


def _sello(o):
    """el texto de los sellos de una miniatura (`thumbnailBadgeViewModel`), el primero que es una hora"""
    pila = [o]
    while pila:
        x = pila.pop()
        if isinstance(x, dict):
            b = x.get('thumbnailBadgeViewModel')
            if isinstance(b, dict) and segundos(b.get('text')) is not None:
                return segundos(b.get('text'))
            pila.extend(x.values())
        elif isinstance(x, list):
            pila.extend(x)
    return None


def _clips_de(o, out):
    """`[(id, título, segundos)]` de una página de la pestaña «Videos» (la inicial o una continuación). Como
    `global_fuente_youtube._con_fecha()`, sin la fila de metadatos (trae las vistas: no se mira)"""
    if isinstance(o, dict):
        lv = o.get('lockupViewModel')
        if isinstance(lv, dict) and lv.get('contentId'):
            if lv.get('contentType') in (None, 'LOCKUP_CONTENT_TYPE_VIDEO'):
                md = ((lv.get('metadata') or {}).get('lockupMetadataViewModel') or {})
                out.append((lv['contentId'], ((md.get('title') or {}).get('content')) or '', _sello(lv.get('contentImage'))))
            return
        vr = o.get('videoRenderer') or o.get('gridVideoRenderer')
        if isinstance(vr, dict) and vr.get('videoId'):
            tit = ''.join(r.get('text', '') for r in (vr.get('title') or {}).get('runs') or []) or \
                (vr.get('title') or {}).get('simpleText') or ''
            seg = segundos((vr.get('lengthText') or {}).get('simpleText'))
            if seg is None:
                seg = _sello(vr.get('thumbnailOverlays'))
            out.append((vr['videoId'], tit, seg))
            return
        for v in o.values():
            _clips_de(v, out)
    elif isinstance(o, list):
        for v in o:
            _clips_de(v, out)


def _unicos(xs):
    vistos, out = set(), []
    for vid, t, seg in xs:
        if re.match(r'^[A-Za-z0-9_-]{11}$', vid or '') and vid not in vistos and t:
            vistos.add(vid)
            out.append((vid, t, seg))
    return out


def cortos(xs):
    """los que duran de `MIN_SEG` a `MAX_SEG`"""
    return [x for x in xs if x[2] is not None and MIN_SEG <= x[2] <= MAX_SEG]


def leer_canal(cid):
    """`[(id, título, segundos)]` de la pestaña «Videos» de un canal: la primera página y `PAGINAS - 1` continuaciones"""
    import requests
    import videos as V
    from global_fuente_youtube import _cliente
    s = requests.Session()
    r = s.get('https://www.youtube.com/channel/%s/videos' % cid, headers=V.H, cookies=V.CK, timeout=30)
    if r.status_code != 200:
        raise RuntimeError('HTTP %s' % r.status_code)
    txt = r.content.decode('utf-8', 'replace')
    d = V._json_tras(txt, 'ytInitialData')
    if not d:
        raise RuntimeError('la pestaña no trajo datos')
    out = []
    _clips_de(d, out)
    key = re.search(r'"INNERTUBE_API_KEY":"([^"]+)"', txt)
    ver = re.search(r'"INNERTUBE_CLIENT_VERSION":"([^"]+)"', txt)
    tok, pags = V._cont(d), 1
    while tok and key and pags < PAGINAS:
        time.sleep(PAUSA)
        j = s.post('https://www.youtube.com/youtubei/v1/browse?key=' + key.group(1), headers=V.H, timeout=30,
                   json={'context': _cliente(ver.group(1) if ver else None), 'continuation': tok}).json()
        pags += 1
        antes = len(out)
        _clips_de(j, out)
        tok = V._cont(j)
        if len(out) == antes:
            break
    return _unicos(out)


def actualizar(aplicar=True):
    """Lee todos los canales y junta lo nuevo con lo guardado (lo nuevo arriba). Un canal que falla no tumba a los demás:
    sus clips guardados quedan. Devuelve `(clips, avisos)`; cada clip es `[id, título, canal, segundos, visto]`"""
    cfg = json.load(io.open(CANALES, encoding='utf-8'))
    viejo = guardados()
    hoy = dt.datetime.now(ET).date().isoformat()
    nuevos, avisos = [], []
    for c in cfg.get('canales') or []:
        try:
            xs = cortos(leer_canal(c['id']))
        except Exception as e:                           # noqa: BLE001
            avisos.append('%s: no pude leer sus videos (%s)' % (c['nombre'], str(e)[:80]))
            continue
        nuevos += [[vid, t, c['slug'], seg, hoy] for vid, t, seg in xs]
        time.sleep(PAUSA)
    ya = {x[0]: x for x in viejo}
    # el día en que lo vimos es el PRIMERO: releerlo la semana siguiente no lo vuelve «nuevo»
    for x in nuevos:
        if x[0] in ya:
            x[4] = ya[x[0]][4] if len(ya[x[0]]) > 4 else x[4]
    nids = {x[0] for x in nuevos}
    todo = sorted(nuevos, key=lambda x: x[4], reverse=True) + [x for x in viejo if x[0] not in nids]
    todo = todo[:GUARDAR]
    if aplicar:
        with io.open(SALIDA, 'w', encoding='utf-8', newline='\n') as f:
            json.dump({'_leeme': 'Los videos horizontales de 20 s a 5 min de los canales del Ranking global '
                       '(bot/global_fuente_clips.py): [id, título, canal, segundos, el día que lo vimos]. No suman puntos: '
                       'van a la columna izquierda de Reels, atados a quien nombran.', 'c': todo},
                      f, ensure_ascii=False, separators=(',', ':'))
    return todo, avisos


def guardados():
    try:
        return json.load(io.open(SALIDA, encoding='utf-8')).get('c') or []
    except (OSError, ValueError):
        return []


def para_la_web(clips, gente, canales, n=EN_LA_WEB):
    """`{cs: [nombres de canal], c: [[id, i del canal, [claves que nombra], título, segundos]]}` para
    `bot/paginas/global_clips.json`, con los más nuevos que nombran a alguien de la tabla (`atar()` de los shorts, la misma
    regla). `gente`: las filas de la tabla (`{k, n, esc}`); `canales`: `{slug: nombre}`"""
    import global_fuente_shorts as GS
    from global_fuente_youtube import _EQUIPOS, _plano
    # ⚠️ DUPLAS Y EQUIPOS AFUERA: «SOPHIA PARKER vs COSEN EZE | DEM DUPLAS» le daba el clip a Sophia y a Parker como si
    # fueran dos personas sueltas. La regla del lector de batallas: el título dice dupla o equipo, o junta con « x »
    clips = [x for x in clips if not _EQUIPOS.search(_plano(x[1])) and not _JUNTA.search(_plano(x[1]))]
    quien = {}
    for k, xs in GS.atar([[x[0], x[1], x[2]] for x in clips], gente).items():
        for vid, _canal, otros, *_ in xs:
            quien.setdefault(vid, [k] + [o for o in otros if o != k])
    cs, ci, out = [], {}, []
    for vid, t, canal, seg, *_ in clips:
        ks = quien.get(vid)
        if not ks:
            continue
        if canal not in ci:
            ci[canal] = len(cs)
            cs.append(canales.get(canal, canal))
        out.append([vid, ci[canal], ks, GS.titulo_web(t), seg])
        if len(out) >= n:
            break
    return {'v': 1, 'cs': cs, 'c': out}


def escribir_web(datos):
    with io.open(WEB, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(datos, f, ensure_ascii=False, separators=(',', ':'))


def _self_check():
    ok = True

    def chk(c, msg):
        nonlocal ok
        print(('  ✅ ' if c else '  ❌ ') + msg)
        ok = ok and c
    chk(segundos('6:44') == 404 and segundos('1:02:03') == 3723 and segundos('0:20') == 20,
        'la hora del sello: minutos:segundos y horas:minutos:segundos')
    chk(segundos('EN VIVO') is None and segundos('SHORTS') is None and segundos('4:75') is None and segundos('') is None,
        'lo que no es una hora no es una duración («EN VIVO», «SHORTS», 4:75)')

    def lock(vid, t, sello, tipo='LOCKUP_CONTENT_TYPE_VIDEO'):
        return {'lockupViewModel': {'contentId': vid, 'contentType': tipo,
                'contentImage': {'thumbnailViewModel': {'overlays': [{'thumbnailBottomOverlayViewModel': {'badges': [
                    {'thumbnailBadgeViewModel': {'text': sello}}]}}]}},
                'metadata': {'lockupMetadataViewModel': {'title': {'content': t}}}}}
    d = {'contents': [lock('pubVQ23XOAg', 'CABRERA vs RC - Octavos | Red Bull Batalla México 2026', '4:51'),
                      lock('U13rprGAuN0', 'CABRERA vs FAT TONY - Final | Red Bull Batalla México 2026', '9:56'),
                      lock('aaaaaaaaaaa', 'EN VIVO: la final', 'EN VIVO'),
                      lock('bbbbbbbbbbb', 'una lista', '12 videos', 'LOCKUP_CONTENT_TYPE_PLAYLIST'),
                      {'videoRenderer': {'videoId': 'ccccccccccc', 'title': {'runs': [{'text': 'MECHA vs GAZIR'}]},
                                         'lengthText': {'simpleText': '3:10'}}},
                      {'videoRenderer': {'videoId': 'ddddddddddd', 'title': {'runs': [{'text': 'un corte'}]},
                                         'lengthText': {'simpleText': '0:12'}}},
                      lock('pubVQ23XOAg', 'repetido', '4:51'), lock('malo', 'x', '1:00')]}
    xs = []
    _clips_de(d, xs)
    xs = _unicos(xs)
    chk([x[0] for x in xs] == ['pubVQ23XOAg', 'U13rprGAuN0', 'aaaaaaaaaaa', 'ccccccccccc', 'ddddddddddd'],
        'la pestaña: los dos formatos, cada video una vez, sin listas y nada que no sea un id de YouTube')
    chk(dict((x[0], x[2]) for x in xs) == {'pubVQ23XOAg': 291, 'U13rprGAuN0': 596, 'aaaaaaaaaaa': None,
                                           'ccccccccccc': 190, 'ddddddddddd': 12},
        'la duración del sello nuevo y del `lengthText` viejo; un directo no tiene')
    chk([x[0] for x in cortos(xs)] == ['pubVQ23XOAg', 'ccccccccccc'],
        'entran de 20 s a 5:00: la final de 9:56, el directo y el corte de 12 s se quedan afuera')
    gente = [{'k': 'cabrera', 'n': 'Cabrera', 'esc': 'pro'}, {'k': 'garces', 'n': 'Garces', 'esc': 'pro'},
             {'k': 'mecha', 'n': 'Mecha', 'esc': 'pro'}, {'k': 'gazir', 'n': 'Gazir', 'esc': 'pro'}]
    clips = [['It3bmWEXZHY', 'CABRERA vs GARCES - Semifinal | Red Bull Batalla México 2026 🔥', 'redbull', 291, '2026-11-25'],
             ['ccccccccccc', 'MECHA vs GAZIR', 'fms', 190, '2026-11-24'],
             ['eeeeeeeeeee', 'LAS MEJORES RIMAS', 'redbull', 200, '2026-11-24'],
             ['fffffffffff', 'CABRERA GARCES vs MECHA GAZIR | DEM DUPLAS 2026', 'dem', 200, '2026-11-24'],
             ['ggggggggggg', 'Mecha X Gazir VS Cabrera X Garces', 'cmf', 200, '2026-11-24']]
    W = para_la_web(clips, gente, {'redbull': 'Red Bull Batalla', 'fms': 'FMS'})
    chk(W['cs'] == ['Red Bull Batalla', 'FMS'] and [c[0] for c in W['c']] == ['It3bmWEXZHY', 'ccccccccccc'],
        'a la página van sólo los que nombran a alguien, con el canal por su lugar')
    chk(W['c'][0][2] == ['cabrera', 'garces'] and W['c'][1][2] == ['mecha', 'gazir'] and W['c'][0][4] == 291,
        'cada clip con todos los que nombra y sus segundos')
    chk('🔥' not in W['c'][0][3], 'el título va limpio (sin emojis), como el de los shorts')
    chk(not any(c[0] in ('fffffffffff', 'ggggggggggg') for c in W['c']),
        'las duplas y los equipos no van: «duplas» o « x » en el título')
    chk(not any(isinstance(v, str) and re.search(r'vistas|views', v, re.I) for c in W['c'] for v in c),
        'nada de vistas ni likes (políticas de YouTube)')
    print('✅ todo bien' if ok else '❌ algo falló')
    return ok


if __name__ == '__main__':
    if '--auto' in sys.argv:
        sys.exit(0 if _self_check() else 1)
    cl, av = actualizar(aplicar='--aplicar' in sys.argv)
    for a in av:
        print('⚠️', a)
    print('🎞️ %d clips guardados%s' % (len(cl), '' if '--aplicar' in sys.argv else ' (sin escribir: --aplicar)'))
