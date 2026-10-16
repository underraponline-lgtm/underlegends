# -*- coding: utf-8 -*-
"""🎬 LAS BATALLAS QUE SUMA CADA UNO: un link o un canal entero, con las restricciones que pidió Dlx.

    python bot/videos_propios.py            lo que haría con los pedidos, sin escribir nada
    python bot/videos_propios.py --aplicar  y lo deja en datos/videos_propios.json, y le avisa al objeto (el ciclo)
    python bot/videos_propios.py --auto     el self-check, sin red ni archivos

Dlx, 12/10/2026, con lo que pidió Makma («¿puedo poner mías de plaza manualmente yo?»): *«sería una muy buena idea que
los usuarios pongan sus batallas también, pero tampoco que puedan poner cualquier video o cosas que no tengan nada que
ver»*; a «A: pegar el link · B: sugerir un canal», *«las 2, pero asegurate que haya restricciones porque hay gente que
se puede poner aka chuty en Discord, y chuty es famoso… y quizás haya personas con bastantes akas parecidos… piensa
muy bien cómo harás esto»*.

LAS RESTRICCIONES, UNA POR CADA FORMA DE COLAR UN VIDEO
  1. Sólo VERIFICADOS (el Miembro de DRA: `d:` en KV) —lo controla el Worker—, y con tope: `POR_DIA` pedidos por día,
     `MAX_VIDEOS` videos y `MAX_CANALES` canales por persona.
  2. EL TÍTULO TIENE QUE SER UNA BATALLA («A vs B», `videos.lados()`) Y UNO DE LOS LADOS TIENE QUE SER ÉL: su nombre de
     la Lista o un alias suyo, ENTERO (`comun.claves.clave()` igual), nunca «se parece». El nombre de la Lista no lo
     elige nadie: sale de las llaves. Ponerse «Chuty» de apodo en Discord no cambia nada acá.
  3. CON BANDERA EN EL TÍTULO, LA DE SU PAÍS: «Carlos 🇲🇽» no es el Carlos chileno.
  4. EL CANAL GRANDE NO ENTRA SOLO: `GRANDE` suscriptores o más (Red Bull Batalla, FMS, Urban Roosters, God Level) es
     donde están los famosos, y el famoso no está en la Liga. Va a revisión.
  5. EL NOMBRE FAMOSO TAMPOCO, NI UNO PARECIDO (`FAMOSOS`, con `PARECIDO` de parecido): «Chuty», «Chutyy», «Chuti».
     Va a revisión aunque el canal sea chico: una resubida en un canal de fans es chica.
  6. DOS DE LA LISTA CON EL MISMO NOMBRE y sin bandera que los separe: a revisión. No se adivina.
  7. Y LO QUE YA ENTRÓ SE PUEDE SACAR: cada uno los suyos, y con `REPORTES` reportes distintos («esto no es suyo») se
     oculta y va a revisión.
  «Revisión» es el Dashboard de Dlx: aprobar o no. Es lo raro; lo normal entra solo.
  8. 🎬 SI TU NOMBRE NO ESTÁ EN EL TÍTULO, SE TE PREGUNTA (Dlx, 16/10/2026, con Liberia: en las plazas es «SEBA», y en
     los videos de equipos su nombre ni aparece): el pedido queda en `preguntar` y la página le pide con qué nombre
     aparece, cómo se lo reconoce y en qué minuto. Con eso va a revisión, con el link en ese minuto: Dlx lo mira y
     decide. Nunca entra solo —es justo lo que no se puede verificar desde el título—.

DE UN CANAL ENTERO se suman sólo los videos donde ÉL es uno de los lados, con las mismas reglas: un canal no le da a
nadie los videos de otro que se llame parecido. Y se vuelve a mirar una vez por semana, por si subieron más.
"""
import datetime as dt
import difflib
import io
import json
import os
import re
import sys
import clave_ciclo as CC  # noqa: E402  la clave del ciclo, en un solo lugar

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

SALIDA = os.path.join(BASE, 'datos', 'videos_propios.json')
WORKER = 'https://liga-global-bot.liga-global-ul.workers.dev'
#: los topes por persona (el Worker frena los pedidos; acá se frenan los videos)
POR_DIA, MAX_VIDEOS, MAX_CANALES = 5, 30, 3
#: un canal desde aquí es «grande»: no entra solo
GRANDE = 100000
#: cuántos reportes distintos ocultan un video
REPORTES = 2
#: qué tan parecido a un famoso ya es «famoso» (difflib, sobre el nombre en minúsculas y sin símbolos)
PARECIDO = 0.84
#: cada cuánto se vuelve a mirar un canal sugerido
CANAL_DIAS = 7
#: los nombres de la élite del freestyle: el que se llame así o parecido no entra solo. ⚠️ Sin los de la Liga que se
#: llaman como alguien conocido —Force, de FVS (`fvs-freestyle-versus`)—: ésos tienen su nombre en la Lista
FAMOSOS = (
    'chuty', 'aczino', 'skone', 'bnet', 'gazir', 'mnak', 'jaze', 'wos', 'trueno', 'dtoke', 'papo', 'zasko', 'arkano',
    'vallest', 'rapder', 'lokillo', 'teorema', 'kaiser', 'hander', 'stigma', 'nitro', 'blon', 'yartzi', 'kodigo',
    'larrix', 'elekipo', 'sweetpain', 'mecha', 'tirpa', 'exodolirical', 'jota', 'bta', 'choque', 'kensuke',
    'sarasocas', 'gold', 'klan', 'titomc', 'basek', 'dozer', 'chang', 'replik', 'reverse', 'loboestepario', 'nekro',
    'pepegrillo', 'tata', 'joqer', 'cayro', 'ghost', 'litzen', 'jonybeltran', 'cacha', 'strike', 'raptor', 'tom crowley',
    'invert', 'letra', 'acertijo', 'fat n', 'mkd', 'jony', 'babi', 'rc', 'yoiker', 'el tanque', 'misionero',
)


def _k(s):
    from comun.claves import clave
    return clave(str(s or ''))


def _plano(s):
    return re.sub(r'[^a-z0-9]', '', str(s or '').lower())


def famoso(nombre):
    """¿El nombre es de la élite del freestyle, o se le parece? (`FAMOSOS`, `PARECIDO`)."""
    n = _plano(nombre)
    if not n:
        return False
    for f in FAMOSOS:
        f = _plano(f)
        if n == f or (len(n) >= 3 and difflib.SequenceMatcher(None, n, f).ratio() >= PARECIDO):
            return True
        # «Chuti» por «Chuty»: una letra cambiada en un nombre de cuatro o más, que el parecido no ve
        if len(n) >= 4 and len(n) == len(f) and sum(1 for x, y in zip(n, f) if x != y) == 1:
            return True
    return False


def suscriptores(texto):
    """«7.47 M de suscriptores» → 7470000; «476 suscriptores» → 476; «12,3 mil» → 12300. `None` si no dice."""
    m = re.search(r'([\d][\d.,]*)\s*(K|M|mil|millones?)?\b', str(texto or ''), re.I)
    if not m:
        return None
    n, suf = m.group(1), (m.group(2) or '').lower()
    if suf:
        n = float(n.replace(',', '.'))
    else:
        n = float(n.replace('.', '').replace(',', ''))
    mult = 1000 if suf in ('k', 'mil') else 1000000 if suf.startswith('m') and suf != 'mil' else 1
    return int(round(n * mult))


# ── YouTube, sin clave ────────────────────────────────────────────────────
def id_video(url):
    m = re.search(r'(?:youtu\.be/|[?&]v=|/shorts/|/live/|/embed/)([\w-]{11})', str(url or ''))
    return m.group(1) if m else None


def es_canal(url):
    return bool(re.match(r'^https?://(?:www\.|m\.)?youtube\.com/(?:@[\w.-]+|channel/UC[\w-]{22}|c/[\w.-]+|user/[\w.-]+)',
                         str(url or ''), re.I))


def video(vid):
    """`(título, url del canal)` de un video, por oEmbed (público); `None` si no existe o es privado."""
    import requests
    r = requests.get('https://www.youtube.com/oembed', params={'url': 'https://www.youtube.com/watch?v=' + vid,
                                                                 'format': 'json'}, timeout=20)
    if r.status_code != 200:
        return None
    j = r.json()
    return j.get('title') or '', j.get('author_url') or '', j.get('author_name') or ''


def canal(url):
    """`(id del canal, nombre, suscriptores)` de la página pública del canal; `None` si no se lee."""
    import requests
    import videos as V
    r = requests.get(url.rstrip('/'), headers=V.H, cookies=V.CK, timeout=25)
    if r.status_code != 200:
        return None
    cid = re.search(r'"(?:channelId|externalId)":"(UC[\w-]{22})"', r.text)
    nom = re.search(r'<meta property="og:title" content="([^"]*)"', r.text)
    sub = re.search(r'"([\d][\d.,]*\s*(?:K|M|mil|millones?)?(?:\s*de)?\s*(?:subscribers|suscriptores))"', r.text, re.I)
    if not cid:
        return None
    return cid.group(1), (nom.group(1) if nom else ''), suscriptores(sub.group(1)) if sub else None


# ── la regla ──────────────────────────────────────────────────────────────
#: el motivo de «no está tu nombre», que dispara las preguntas (regla 8)
NO_NOMBRE = 'tu nombre no está en el título'
#: lo que ve quien pidió el video mientras no contestó
PREGUNTA = 'tu nombre no está en el título: contanos cómo aparecés y lo revisa Dlx'


def respuestas(p):
    """Lo que contestó quien pidió el video (`resp` del objeto): `{nombre, como, minuto}`, o `None`."""
    try:
        r = json.loads(p.get('resp') or '{}') or {}
    except (TypeError, ValueError):
        return None
    if not isinstance(r, dict) or not r.get('nombre') or not r.get('como') or not r.get('minuto'):
        return None
    return {'nombre': str(r['nombre'])[:60], 'como': str(r['como'])[:160], 'minuto': str(r['minuto'])[:10]}


def en_minuto(url, minuto):
    """El link del video, abriendo en ese minuto («4:35» → `t=275`)."""
    try:
        partes = [int(x) for x in str(minuto).split(':')]
    except ValueError:
        return url
    seg = 0
    for x in partes:
        seg = seg * 60 + x
    vid = id_video(url)
    return 'https://www.youtube.com/watch?v=%s&t=%d' % (vid, seg) if vid else url


def decidir(titulo, raw, iso, nombres, homonimos, subs):
    """`(estado, motivo)` para un video de `raw`: `ok`, `revisar` o `no`. Ver el docstring del módulo.

    `nombres`: las claves de su nombre y sus alias. `homonimos`: `{clave: cuántos de la Lista se llaman así}`."""
    import videos as V
    lados = V.lados(titulo)
    if not lados:
        return 'no', 'el título no es una batalla («A vs B»)'
    suyo = None
    for lado in lados:
        for nom, fl in lado:
            if _k(nom) in nombres:
                suyo = (nom, fl)
                break
        if suyo:
            break
    if not suyo:
        return 'no', NO_NOMBRE
    nom, fl = suyo
    if fl and iso and fl != iso:
        return 'no', 'la bandera del título no es la de tu país'
    if famoso(nom):
        return 'revisar', 'el nombre es el de alguien conocido: lo revisa Dlx'
    if subs is not None and subs >= GRANDE:
        return 'revisar', 'es de un canal grande: lo revisa Dlx'
    if homonimos.get(_k(nom), 0) > 1 and not fl:
        return 'revisar', 'hay otro en la Liga con ese nombre: lo revisa Dlx'
    return 'ok', ''


def _gente():
    """`(por_clave, alias_de, homonimos)`: el padrón por la clave del perfil, los alias de cada uno y cuántos comparten
    cada nombre."""
    import motor
    padron = json.load(io.open(os.path.join(BASE, 'datos', 'padron.json'), encoding='utf-8'))
    try:
        from padron_t1 import PAIS_ISO
    except Exception:                                    # noqa: BLE001
        PAIS_ISO = {}
    r, _n = motor._resolvedor()
    por, hom = {}, {}
    for p in padron:
        raw = p.get('raw')
        if not raw:
            continue
        por[_k(raw)] = (raw, PAIS_ISO.get(p.get('pais') or '', ''))
        hom[_k(raw)] = hom.get(_k(raw), 0) + 1
    alias = {}
    for a, real in (getattr(r, 'padron', None) or {}).items():
        alias.setdefault(real, set()).add(_k(a))
    return por, alias, hom


def leer(ruta=None):
    try:
        with io.open(ruta or SALIDA, encoding='utf-8') as f:
            return json.load(f) or {}
    except (OSError, ValueError):
        return {}


def _objeto(metodo, cuerpo=None):
    """El Durable Object, con la clave del ciclo: `GET /avisos/videos-ciclo` y `POST /avisos/videos-estados`."""
    import requests
    import fotos as F
    tok = F.env('DISCORD_TOKEN', obligatorio=False)
    if not tok:
        return None
    k = CC.clave(tok)
    if metodo == 'GET':
        r = requests.get(WORKER + '/avisos/videos-ciclo', headers={'x-lg-ciclo': k}, timeout=30)
    else:
        r = requests.post(WORKER + '/avisos/videos-estados', data=json.dumps(cuerpo, ensure_ascii=False).encode('utf-8'),
                          headers={'x-lg-ciclo': k, 'content-type': 'application/json'}, timeout=30)
    return r.json() if r.ok else None


def correr(aplicar=False):
    import videos as V
    d = _objeto('GET')
    if d is None:
        print('   ⚠️ el objeto no contestó: nada que hacer')
        return 0
    prev = leer()
    por_raw = {k: [list(x) for x in vs] for k, vs in (prev.get('por') or {}).items()}
    canales = {k: list(vs) for k, vs in (prev.get('canales') or {}).items()}
    revisar = {str(x['id']): x for x in prev.get('revisar') or []}
    estados = {}
    por, alias, hom = _gente()
    ahora = dt.datetime.now(dt.timezone.utc)
    hoy = ahora.strftime('%Y-%m-%dT%H:%M:%SZ')

    def suma(raw, vid, tit, cn, origen):
        vs = por_raw.setdefault(raw, [])
        if vid in {x[0] for x in vs}:
            return False
        if len(vs) >= MAX_VIDEOS:
            return False
        vs.insert(0, [vid, tit, cn, hoy, origen])
        return True
    # 1 · los pedidos nuevos
    for p in d.get('pedidos') or []:
        x = por.get(str(p.get('clave') or ''))
        if not x:
            estados[str(p['id'])] = ['no', 'tu perfil no está en la Lista todavía']
            continue
        raw, iso = x
        nombres = {_k(raw)} | alias.get(raw, set())
        url = str(p.get('url') or '')
        try:
            if p.get('tipo') == 'canal' and es_canal(url):
                if len(canales.get(raw, [])) >= MAX_CANALES:
                    estados[str(p['id'])] = ['no', 'ya tenés %d canales' % MAX_CANALES]
                    continue
                c = canal(url)
                if not c:
                    estados[str(p['id'])] = ['no', 'no pude leer ese canal']
                    continue
                cid, cn, subs = c
                if subs is not None and subs >= GRANDE:
                    revisar[str(p['id'])] = {'id': p['id'], 'raw': raw, 'tipo': 'canal', 'url': url, 'cn': cn, 'subs': subs,
                                        'motivo': 'canal grande'}
                    estados[str(p['id'])] = ['revisar', 'es un canal grande: lo revisa Dlx']
                    continue
                n = 0
                for vid, tit in V.canal(cid, maximo=800):
                    est, _m = decidir(tit, raw, iso, nombres, hom, subs)
                    if est == 'ok' and suma(raw, vid, tit, cn, 'canal'):
                        n += 1
                canales.setdefault(raw, [])
                if cid not in [c[0] for c in canales[raw]]:
                    canales[raw].append([cid, cn, hoy])
                estados[str(p['id'])] = ['ok', '%d batalla(s) tuya(s) en %s' % (n, cn or 'el canal')] if n else \
                    ['no', 'en ese canal no encontré batallas con tu nombre']
            elif id_video(url):
                vid = id_video(url)
                v = video(vid)
                if not v:
                    estados[str(p['id'])] = ['no', 'el video no existe o es privado']
                    continue
                tit, curl, cn = v
                c = canal(curl) if curl else None
                subs = c[2] if c else None
                est, mot = decidir(tit, raw, iso, nombres, hom, subs)
                # 🎬 sin su nombre en el título: se le pregunta, y con lo que contestó, lo revisa Dlx (regla 8)
                if est == 'no' and mot == NO_NOMBRE:
                    resp = respuestas(p)
                    if not resp:
                        estados[str(p['id'])] = ['preguntar', PREGUNTA]
                        continue
                    est, mot = 'revisar', 'su nombre no está en el título: contestó cómo aparece'
                    revisar[str(p['id'])] = {'id': p['id'], 'raw': raw, 'tipo': 'link', 'url': en_minuto(url, resp['minuto']),
                                             'vid': vid, 'tit': tit, 'cn': cn, 'subs': subs, 'motivo': mot, 'resp': resp}
                    estados[str(p['id'])] = [est, 'lo revisa Dlx con lo que contaste']
                    continue
                if est == 'ok':
                    suma(raw, vid, tit, cn, 'link')
                elif est == 'revisar':
                    revisar[str(p['id'])] = {'id': p['id'], 'raw': raw, 'tipo': 'link', 'url': url, 'vid': vid, 'tit': tit,
                                        'cn': cn, 'subs': subs, 'motivo': mot}
                estados[str(p['id'])] = [est, mot or 'sumado a tu perfil']
            else:
                estados[str(p['id'])] = ['no', 'no es un video ni un canal de YouTube']
        except Exception as e:                           # noqa: BLE001
            print('   ⚠️ pedido %s: %s' % (p.get('id'), str(e)[:80]))
    # 2 · lo que Dlx aprobó o no desde el Dashboard
    for rid, si in (d.get('decididos') or {}).items():
        x = revisar.pop(str(rid), None)
        if not x:
            continue
        if si and x.get('tipo') == 'link':
            suma(x['raw'], x['vid'], x.get('tit') or '', x.get('cn') or '', 'link')
        elif si and x.get('tipo') == 'canal':
            # el canal grande que Dlx aprobó: sus videos con él, con las demás reglas (el famoso sigue sin entrar solo)
            c = canal(x['url'])
            px = por.get(_k(x['raw']))
            if c and px:
                for vid, tit in V.canal(c[0], maximo=800):
                    if decidir(tit, x['raw'], px[1], {_k(x['raw'])} | alias.get(x['raw'], set()), hom, None)[0] == 'ok':
                        suma(x['raw'], vid, tit, c[1], 'canal')
                canales.setdefault(x['raw'], []).append([c[0], c[1], hoy])
        estados[str(rid)] = ['ok', 'Dlx lo aprobó'] if si else ['no', 'Dlx no lo aprobó']
    # 3 · los quitados por su dueño y los reportados
    quitados = {(q['clave'], q['vid']) for q in d.get('quitados') or []}
    ocultos = set(prev.get('ocultos') or [])
    for vid, n in (d.get('reportes') or {}).items():
        if n >= REPORTES:
            ocultos.add(vid)
    for raw in list(por_raw):
        k = _k(raw)
        por_raw[raw] = [x for x in por_raw[raw] if (k, x[0]) not in quitados]
    # 4 · los canales sugeridos, una vez por semana
    for raw, cs in canales.items():
        x = por.get(_k(raw))
        if not x:
            continue
        for c in cs:
            try:
                visto = dt.datetime.fromisoformat(c[2].replace('Z', '+00:00'))
            except (ValueError, IndexError):
                visto = None
            if visto and (ahora - visto).days < CANAL_DIAS:
                continue
            for vid, tit in V.nuevos(c[0]):
                if decidir(tit, raw, x[1], {_k(raw)} | alias.get(raw, set()), hom, None)[0] == 'ok':
                    suma(raw, vid, tit, c[1], 'canal')
            c[2] = hoy
    out = {'_leeme': 'Las batallas que sumó cada uno (bot/videos_propios.py): `por` {raw: [[video, título, canal, '
                     'cuándo, link|canal]]}, los canales que sugirió, lo que espera a Dlx y lo oculto por reportes.',
           't': hoy, 'por': por_raw, 'canales': canales, 'revisar': list(revisar.values()), 'ocultos': sorted(ocultos)}
    print('   🎬 %d pedido(s) · %d persona(s) con videos · %d para revisar · %d oculto(s)'
          % (len(d.get('pedidos') or []), sum(1 for v in por_raw.values() if v), len(revisar), len(ocultos)))
    if aplicar:
        with io.open(SALIDA, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(out, f, ensure_ascii=False, indent=1, sort_keys=True)
            f.write('\n')
        _objeto('POST', {'estados': estados, 'revisar': [[x['id'], x['raw'], x.get('tit') or x.get('cn') or '',
                                                          x.get('url'), x.get('motivo'), x.get('resp') or None]
                                                         for x in revisar.values()]})
    return 0


def para_perfil(raw, ruta=None, d=None):
    """Los videos que sumó `raw`, para su perfil: `[[video, título, canal]]`, sin los ocultos."""
    d = d if d is not None else leer(ruta)
    ocultos = set(d.get('ocultos') or [])
    return [[x[0], x[1], x[2]] for x in (d.get('por') or {}).get(raw) or [] if x[0] not in ocultos]


def _self_check():
    print('\n══ LOS VIDEOS QUE SUMA CADA UNO ══\n')
    mal = 0

    def ok(c, q, extra=''):
        nonlocal mal
        mal += not c
        print('   %s %s%s' % ('✅' if c else '🔴', q, ('  ' + extra) if extra and not c else ''))
    noms = {_k('Makmah'), _k('Makma')}
    hom = {_k('Makmah'): 1, _k('Sol'): 2}
    ok(decidir('MAKMA VS CHETOS - BDM PANDILLAS COLIMA - OCTAVOS', 'Makmah', 've', noms, hom, 476) == ('ok', ''),
       'su batalla de plaza, con su alias, en un canal chico: entra sola')
    # 🎬 regla 8 (16/10/2026): sin su nombre en el título se le pregunta, y con lo que contestó, lo revisa Dlx
    ok(decidir('BUITRES MEDUSA vs EL COMBO LOCO - Octavos | 5vs5', 'Liberia', 'ar', {_k('Liberia')}, {}, 900) == ('no', NO_NOMBRE)
       and respuestas({'resp': '{"nombre": "SEBA", "como": "lentes", "minuto": "4:35"}'})['nombre'] == 'SEBA'
       and respuestas({'resp': ''}) is None and respuestas({'resp': '{"nombre": "SEBA"}'}) is None
       and en_minuto('https://youtu.be/hR4EH1DvwKA?si=x', '4:35') == 'https://www.youtube.com/watch?v=hR4EH1DvwKA&t=275'
       and en_minuto('https://youtu.be/hR4EH1DvwKA', '1:02:03').endswith('&t=3723'),
       'sin su nombre en el título: se le pregunta (no entra solo); lo que contestó abre el video en ese minuto')
    ok(decidir('Makma 🇲🇽 vs Pepe | Final', 'Makmah', 've', noms, hom, 500)[0] == 'no',
       'con la bandera de otro país: no')
    ok(decidir('Chetos vs Kuzko | Octavos', 'Makmah', 've', noms, hom, 500)[0] == 'no', 'si no está él: no')
    ok(decidir('Makma, el documental', 'Makmah', 've', noms, hom, 500)[0] == 'no', 'si no es una batalla: no')
    ch = {_k('Chuty')}
    ok(decidir('CHUTY vs ACZINO | FMS', 'Chuty', 'es', ch, {}, 500)[0] == 'revisar',
       'el que se llama «Chuty» en la Lista: aunque el canal sea chico, a revisión')
    ok(decidir('CHUTYY vs Pepe', 'Chutyy', 'ar', {_k('Chutyy')}, {}, 50)[0] == 'revisar' and famoso('Chuti'),
       'y uno parecido a un famoso, también')
    ok(decidir('MAKMA VS ZETA | Red Bull', 'Makmah', 've', noms, hom, 7470000)[0] == 'revisar',
       'en un canal grande (7,47 M), a revisión')
    ok(decidir('SOL vs Pepe', 'Sol', 'pe', {_k('Sol')}, hom, 300)[0] == 'revisar'
       and decidir('SOL 🇵🇪 vs Pepe', 'Sol', 'pe', {_k('Sol')}, hom, 300)[0] == 'ok',
       'dos «Sol» en la Lista: sin bandera a revisión, con la suya entra')
    ok(not famoso('Makmah') and not famoso('Force') and not famoso('Six'), 'los de la Liga no son «famosos»')
    ok(suscriptores('7.47\xa0M de suscriptores') == 7470000 and suscriptores('476 suscriptores') == 476
       and suscriptores('12,3 mil suscriptores') == 12300, 'los suscriptores, como los escribe YouTube')
    ok(id_video('https://youtu.be/kiyYaiFqTzw?si=x') == 'kiyYaiFqTzw' and id_video('https://www.youtube.com/watch?v=kiyYaiFqTzw')
       == 'kiyYaiFqTzw' and es_canal('https://www.youtube.com/@FalconMusic33/videos') and not es_canal('https://x.com/a'),
       'links de video y de canal')
    d = {'por': {'Makmah': [['v1', 'A vs B', 'C', 't', 'link'], ['v2', 'A vs C', 'C', 't', 'canal']]}, 'ocultos': ['v2']}
    ok(para_perfil('Makmah', d=d) == [['v1', 'A vs B', 'C']], 'el reportado no se muestra')
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
