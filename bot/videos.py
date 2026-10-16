# -*- coding: utf-8 -*-
"""🎬 LAS BATALLAS EN VIDEO DE CADA RAPERO, desde los canales de YouTube de los socios.

    python bot/videos.py              lee los canales y dice a quién encontró, sin escribir nada
    python bot/videos.py --aplicar    escribe datos/videos.json (lo lleva el perfil: `subir_web._perfiles()`)
    python bot/videos.py --auto       el self-check

Dlx, 12/10/2026, a «▶ ver la batalla»: *«creo que mejor sería que tú pudieses detectarlos tú mismo desde las cuentas y
redes sociales de nuestros socios»*, y *«tú estás en todos los servidores… tómate tu tiempo»*. Los canales salieron de
recorrer los servidores y de lo que pasó Dlx (el de FVS): están en `datos/videos_canales.json`.

SIN TOKEN: la lista de videos de un canal es la misma página pública que ve cualquiera (`canal()`), y las siguientes
páginas se piden por la misma vía que usa esa página. TikTok y Twitch piden clave: quedan para cuando se puedan crear
tokens (Dlx: no se crean hasta el final).

CÓMO SE RECONOCE A ALGUIEN EN UN TÍTULO
  · el título trae «A 🆚 B», «A Vs B» o «A V.S B»; cada lado puede ser un equipo («A, B», «A (B)», «A + B»);
  · el nombre tiene que ser el de alguien de la Lista o uno de sus alias (`motor._resolvedor()`);
  · con bandera, la bandera tiene que ser la de su país: «Carlos 🇲🇽» no es el Carlos chileno;
  · sin bandera, tiene que haber jugado en el servidor de ese canal o ser miembro: un «Carlos» de FVS no se le da a
    cualquier Carlos;
  · y dos de la Lista con el mismo nombre sin bandera que los separe: no se adivina.
"""
import datetime as dt
import io
import json
import os
import re
import sys
import time

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path[:0] = [SCR, os.path.join(BASE, 'sheet'), BASE]

CANALES = os.path.join(BASE, 'datos', 'videos_canales.json')
SALIDA = os.path.join(BASE, 'datos', 'videos.json')
#: cuántos videos por persona viajan al perfil
POR_PERSONA = 12
#: la lectura entera de cada canal, una vez por día; en las demás corridas, sólo su lista pública (los 15 más nuevos)
TODO_H = 20
H = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
     'Accept-Language': 'es-419,es;q=0.9'}
CK = {'CONSENT': 'YES+cb', 'SOCS': 'CAISEwgDEgk0ODE3Nzk3MjQaAmVzIAEaBgiA_LyaBg'}

_VS = re.compile(r'\s*🆚\s*|\s+(?:vs\.?|v\.s\.?)\s+', re.I)
# 🎬 y la barra sola, «Makma vs Moosby/Cuartos/Liga del volcán» (Makma, 12/10/2026): sin ella el rival se llevaba
# «Cuartos Liga del volcán» pegado al nombre. La doble no corta: «Juancito//MCO» es un nombre
_TRAMO = re.compile(r'\s*(?:\|\||\||│|┃|\s-\s|\s–\s|\[|\]|«|»|“|”|(?<!/)/(?!/))\s*')
_BANDERA = re.compile('[\U0001F1E6-\U0001F1FF]{2}')
_MIEMBROS = re.compile(r'\s*(?:,|&|\+|\s+y\s+|\(|\))\s*', re.I)


# ── leer un canal ────────────────────────────────────────────────────────────────────────────────────────────────────
def _json_tras(txt, marca):
    i = txt.find(marca)
    if i < 0:
        return None
    i = txt.find('{', i)
    try:
        return json.JSONDecoder().raw_decode(txt[i:])[0]
    except ValueError:
        return None


def _videos(o, out):
    if isinstance(o, dict):
        lv = o.get('lockupViewModel')
        if lv and lv.get('contentId'):
            md = ((lv.get('metadata') or {}).get('lockupMetadataViewModel') or {})
            out.append((lv['contentId'], ((md.get('title') or {}).get('content')) or ''))
        vr = o.get('videoRenderer') or o.get('gridVideoRenderer')
        if vr and vr.get('videoId'):
            out.append((vr['videoId'], ''.join(r.get('text', '') for r in (vr.get('title') or {}).get('runs') or [])))
        for v in o.values():
            _videos(v, out)
    elif isinstance(o, list):
        for v in o:
            _videos(v, out)


def _cont(o):
    if isinstance(o, dict):
        c = o.get('continuationCommand')
        if c and c.get('token'):
            return c['token']
        for v in o.values():
            r = _cont(v)
            if r:
                return r
    elif isinstance(o, list):
        for v in o:
            r = _cont(v)
            if r:
                return r
    return None


def canal(cid, maximo=1500):
    """`[(video_id, título)]` de un canal, del más nuevo al más viejo: la pestaña «Videos» y sus páginas siguientes."""
    import requests
    s = requests.Session()
    r = s.get('https://www.youtube.com/channel/%s/videos' % cid, headers=H, cookies=CK, timeout=30)
    d = _json_tras(r.text, 'ytInitialData')
    key = re.search(r'"INNERTUBE_API_KEY":"([^"]+)"', r.text)
    ver = re.search(r'"INNERTUBE_CLIENT_VERSION":"([^"]+)"', r.text)
    out = []
    _videos(d, out)
    tok, n = _cont(d), 0
    while tok and key and len(out) < maximo and n < 80:
        n += 1
        j = s.post('https://www.youtube.com/youtubei/v1/browse?key=' + key.group(1), headers=H, timeout=30,
                   json={'context': {'client': {'clientName': 'WEB',
                                                'clientVersion': ver.group(1) if ver else '2.20241001'}},
                         'continuation': tok}).json()
        antes = len(out)
        _videos(j, out)
        tok = _cont(j)
        if len(out) == antes:
            break
        time.sleep(0.2)
    return list(dict.fromkeys(out))


#: 🏆 cuándo se publicó cada video y cuántas vistas tenía, de la lista pública: `{video: (iso, vistas)}`. Lo llena
#: `nuevos()` y lo guarda `correr()` en `meta`, para la Batalla del mes de los MES AWARDS (`bot/mes_awards.py`)
_META = {}


def nuevos(cid):
    """`[(video_id, título)]`: los 15 más nuevos del canal, de su lista pública (una sola pregunta). De paso anota en
    `_META` cuándo se publicó cada uno y sus vistas (la lista pública las trae; la pestaña «Videos» no)."""
    import html
    import requests
    r = requests.get('https://www.youtube.com/feeds/videos.xml?channel_id=' + cid, headers=H, timeout=20)
    for e in re.findall(r'<entry>(.*?)</entry>', r.text, re.S):
        v = re.search(r'<yt:videoId>([\w-]{11})</yt:videoId>', e)
        p = re.search(r'<published>([^<]+)</published>', e)
        n = re.search(r'views="(\d+)"', e)
        if v and p:
            _META[v.group(1)] = (p.group(1)[:19] + 'Z', int(n.group(1)) if n else 0)
    return [(v, html.unescape(t)) for v, t in
            re.findall(r'<yt:videoId>([\w-]{11})</yt:videoId>.*?<title>(.*?)</title>', r.text, re.S)]


# ── leer un título ───────────────────────────────────────────────────────────────────────────────────────────────────
def lados(titulo):
    """Los lados de la batalla de un título, cada uno una lista de `(nombre, iso de su bandera o '')`; o `[]`."""
    t = re.sub(r'#\w+', ' ', str(titulo or ''))
    for tramo in _TRAMO.split(t):
        partes = [p for p in _VS.split(tramo) if p.strip()]
        if len(partes) < 2:
            continue
        out = []
        for p in partes:
            ms = []
            for m in _MIEMBROS.split(p):
                fl = _BANDERA.findall(m)
                nom = re.sub(r'[^\w.\- ]+', ' ', _BANDERA.sub(' ', m), flags=re.U)
                nom = re.sub(r'\s+', ' ', nom).strip(' .-')
                if nom:
                    iso = ''.join(chr(ord(c) - 0x1F1E6 + 97) for c in fl[0]) if fl else ''
                    ms.append((nom, iso))
            if ms:
                out.append(ms)
        if len(out) >= 2:
            return out
    return []


# ── a quién de la Lista ──────────────────────────────────────────────────────────────────────────────────────────────
def indice(padron, alias_de, servidores_de, jugo_en):
    """Lo que hace falta para reconocer: `{clave: [(raw, iso)]}` de la Lista con sus alias, y dónde juega cada uno."""
    from comun.claves import clave
    try:
        from padron_t1 import PAIS_ISO
    except Exception:                                    # noqa: BLE001
        PAIS_ISO = {}
    por_raw = {}
    idx = {}
    for p in padron:
        raw = p.get('raw')
        if not raw:
            continue
        iso = PAIS_ISO.get(p.get('pais') or '', '')
        por_raw[raw] = (iso, str(p.get('discord_id') or ''))
        idx.setdefault(clave(raw), []).append((raw, iso))
    for a, real in (alias_de or {}).items():
        if real in por_raw and clave(a) not in idx:
            idx.setdefault(clave(a), []).append((real, por_raw[real][0]))

    def svs(raw):
        did = por_raw.get(raw, ('', ''))[1]
        return set(servidores_de.get(did) or []) | set(jugo_en.get(raw) or [])
    return idx, svs


def quien(nombre, iso, sv, idx, svs):
    """El `raw` de la Lista para un nombre de un título de ese servidor, o `None`. Ver el docstring del módulo."""
    from comun.claves import clave
    cs = list(dict.fromkeys(idx.get(clave(nombre)) or []))
    if not cs:
        return None
    if iso:
        cs = [c for c in cs if not c[1] or c[1] == iso]
        return cs[0][0] if len({c[0] for c in cs}) == 1 else None
    if len({c[0] for c in cs}) != 1:
        return None
    raw = cs[0][0]
    return raw if sv in svs(raw) else None


def reconocer(videos_de, idx, svs):
    """`{video_id: [título, sv, [raws]]}` de los videos donde se reconoce a alguien. `videos_de` = `{sv: [(id, título)]}`."""
    out = {}
    for sv, vs in videos_de.items():
        for vid, tit in vs:
            gente = []
            for lado in lados(tit):
                for nom, iso in lado:
                    q = quien(nom, iso, sv, idx, svs)
                    if q and q not in gente:
                        gente.append(q)
            if gente:
                out[vid] = [tit, sv, gente]
    return out


def correr(aplicar=False):
    import motor
    cfg = json.load(io.open(CANALES, encoding='utf-8'))
    padron = json.load(io.open(os.path.join(BASE, 'datos', 'padron.json'), encoding='utf-8'))
    try:
        svde = json.load(io.open(os.path.join(BASE, 'datos', 'servidores_de.json'), encoding='utf-8'))
    except (OSError, ValueError):
        svde = {}
    r, _n = motor._resolvedor()
    # los alias: lo que el resolvedor sabe y no es un nombre de la Lista
    from comun.claves import clave
    nombres = {clave(p.get('raw')) for p in padron if p.get('raw')}
    alias_de = {k: v for k, v in (getattr(r, 'padron', None) or {}).items() if k not in nombres}
    # dónde jugó cada uno, de las llaves cargadas
    jugo = {}
    try:
        ll = json.load(io.open(os.path.join(BASE, 'datos', 'llaves_t1.json'), encoding='utf-8'))
        for x in ll.values():
            if isinstance(x, dict):
                for fila in x.get('tabla') or []:
                    q = r(fila[0]) if fila else None
                    if q:
                        jugo.setdefault(q, set()).add(x.get('sv'))
    except (OSError, ValueError):
        pass
    idx, svs = indice(padron, alias_de, svde, jugo)
    # 🔁 los títulos de antes se conservan: una persona o un alias nuevo también se reconoce en los videos viejos
    try:
        prev = json.load(io.open(SALIDA, encoding='utf-8'))
    except (OSError, ValueError):
        prev = {}
    crudos = {c: [tuple(x) for x in vs] for c, vs in (prev.get('crudos') or {}).items()}
    ahora = dt.datetime.now(dt.timezone.utc)
    try:
        todo_t = dt.datetime.fromisoformat(prev.get('todo') or '')
    except ValueError:
        todo_t = None
    entero = '--todo' in sys.argv or todo_t is None or (ahora - todo_t).total_seconds() > TODO_H * 3600
    for c in cfg.get('canales') or []:
        try:
            vs = canal(c['id']) if entero else nuevos(c['id'])
            # 🏆 la lectura entera no trae la fecha ni las vistas: la lista pública sí, y es una pregunta más
            if entero:
                nuevos(c['id'])
        except Exception as e:                           # noqa: BLE001
            print('   ⚠️ %s (%s): no pude leerlo (%s)' % (c.get('nombre'), c['sv'], str(e)[:60]))
            continue
        # lo nuevo arriba, sin repetir; lo que ya estaba se queda (un video que sale de la lista de 15 no se borra)
        crudos[c['id']] = list(dict.fromkeys(vs + [x for x in crudos.get(c['id'], []) if x[0] not in {v for v, _t in vs}]))
        print('   %-26s %-5s %4d videos%s' % (c.get('nombre', '')[:26], c['sv'], len(crudos[c['id']]),
                                            '' if entero else ' (%d en su lista)' % len(vs)))
    videos_de = {}
    for c in cfg.get('canales') or []:
        videos_de.setdefault(c['sv'], []).extend(crudos.get(c['id']) or [])
    hallados = reconocer(videos_de, idx, svs)
    por = {}
    for vid, (tit, sv, gente) in hallados.items():
        for q in gente:
            por.setdefault(q, []).append(vid)
    print('\n   🎬 %d video(s) con alguien de la Lista · %d persona(s)' % (len(hallados), len(por)))
    for q, vs in sorted(por.items(), key=lambda kv: -len(kv[1]))[:15]:
        print('      %-18s %3d  %s' % (q[:18], len(vs), hallados[vs[0]][0][:60]))
    if aplicar:
        out = {'_leeme': 'Las batallas en video de cada rapero, de los canales de YouTube de los socios (bot/videos.py). '
                         'Dlx, 12/10/2026.',
               'visto': ahora.isoformat(timespec='seconds'),
               'todo': (ahora if entero else todo_t).isoformat(timespec='seconds'),
               'videos': hallados, 'por': {q: vs[:POR_PERSONA] for q, vs in por.items()},
               'crudos': {c: [list(x) for x in vs] for c, vs in crudos.items()},
               # 🏆 cuándo se publicó y cuántas vistas: lo de antes se queda, las vistas se actualizan
               'meta': dict(prev.get('meta') or {}, **{v: list(x) for v, x in _META.items()})}
        with io.open(SALIDA, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(out, f, ensure_ascii=False, indent=1, sort_keys=True)
            f.write('\n')
        print('   ✅ datos/videos.json')
    return 0


def _self_check():
    mal = 0
    idx = {'oasis': [('Oasis', 'cl')], 'snow': [('Snow', 'co')], 'carlos': [('Carlos', 'mx')],
           'fully': [('Oasis', 'cl')], 'volk': [('Volk', 'mx'), ('volk', 'co')], 'deuxs': [('Deuxs', 'cl')]}
    svs = lambda raw: {'Oasis': {'FFA', 'FVS'}, 'Snow': {'FFA'}, 'Carlos': {'FFA'}, 'Deuxs': {'FVS'}}.get(raw, set())  # noqa
    casos = [
        ('el título con 🆚, ronda y torneo', lados('ZETA 🆚 RUBIK || FINAL MATANZA DE DIOSES - C16')
         == [[('ZETA', '')], [('RUBIK', '')]]),
        ('banderas, «Vs» y equipos con paréntesis',
         lados('ORIGINAL GANG DUPLAS FINAL - ABYSSUS🇵🇦  (FULLYLO4DED🇨🇱) VS RESPAWN🇭🇳 (KMINANT🇦🇷)')
         == [[('ABYSSUS', 'pa'), ('FULLYLO4DED', 'cl')], [('RESPAWN', 'hn'), ('KMINANT', 'ar')]]),
        ('el lado de la batalla aunque haya otro tramo antes',
         lados('MINUTOS DE PRESENTACION | Anbeck, BneDto vs Jose, BlueStyles | Under Level #1')
         == [[('Anbeck', ''), ('BneDto', '')], [('Jose', ''), ('BlueStyles', '')]]),
        ('sin «vs» no hay batalla', lados('MINUTAZO DE PANCHOK EN OCTAVOS DE LA NACIONAL ANDES') == []),
        ('la barra corta como el «|»: «Manu vs Makma/Liga del volcán»',
         lados('Manu vs Makma/Liga del volcán Face To Face') == [[('Manu', '')], [('Makma', '')]]
         and lados('Makma vs Moosby/Cuartos/Liga del volcán') == [[('Makma', '')], [('Moosby', '')]]
         and lados('Juancito//MCO vs Erian') == [[('Juancito MCO', '')], [('Erian', '')]]),
        ('con bandera: la de su país', quien('Carlos', 'cl', 'FVS', idx, svs) is None
         and quien('Carlos', 'mx', 'DRA', idx, svs) == 'Carlos'),
        ('sin bandera: sólo si juega en ese servidor', quien('Carlos', '', 'FVS', idx, svs) is None
         and quien('Deuxs', '', 'FVS', idx, svs) == 'Deuxs'),
        ('los alias cuentan', quien('FULLY', '', 'FFA', idx, svs) == 'Oasis'),
        ('dos con el mismo nombre: la bandera decide, y sin bandera no se adivina',
         quien('Volk', 'co', 'X', idx, svs) == 'volk' and quien('Volk', '', 'X', idx, svs) is None),
        ('en un video, a todos los que reconoce',
         reconocer({'FFA': [('v1', 'Oasis 🆚 Snow | Final')]}, idx, svs) == {'v1': ['Oasis 🆚 Snow | Final', 'FFA',
                                                                                    ['Oasis', 'Snow']]}),
    ]
    for que, ok in casos:
        mal += not ok
        print('   %s %s' % ('✅' if ok else '🔴', que))
    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        sys.exit(_self_check())
    sys.exit(correr(aplicar='--aplicar' in sys.argv))
