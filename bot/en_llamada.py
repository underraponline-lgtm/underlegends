# -*- coding: utf-8 -*-
"""QUIÉN ESTÁ EN LA LLAMADA, SÓLO MIENTRAS UN SERVIDOR TIENE UN EVENTO EN VIVO.

    python bot/en_llamada.py            qué servidores están en vivo (no se conecta)
    python bot/en_llamada.py --foto     se conecta y dice cuántos hay (no guarda)
    python bot/en_llamada.py --aplicar  la foto, guardada en KV (lo que hace el ciclo)
    python bot/en_llamada.py --auto     el self-check (sin red)
    python bot/en_llamada.py --probar DRA   la foto de ese servidor aunque no esté
                                        en vivo (no guarda): que el Gateway anda
    python bot/en_llamada.py --seguir   la llamada minuto a minuto mientras haya
                                        algo en vivo (lo corre `llamada.yml`; ver
                                        «4 · la llamada, minuto a minuto»)
    python bot/en_llamada.py --seguir --minutos 3 --simulacro   probarlo a mano

Dlx, 29/09/2026: *«quizás para facilitar el proceso podrías chequear quiénes
están en la llamada?»* — para el nombre raro de una llave: un suplente, o
alguien que jugó sin anotarse. Y a «¿lo armo?»: *«Si pero fíjate muy bien
para no gastar recursos y solo cuando en vivo seria rentable»*.

🔑 DISCORD SÓLO LO DICE POR EL GATEWAY. No hay ruta REST que liste quién
está en un canal de voz, y el bot es de interacciones por HTTP: no tiene una
conexión abierta. Así que se conecta un instante, recibe el estado de cada
servidor —que trae sus canales de voz con la gente adentro— y se va. No se
queda, no late, no aparece conectado más que esos segundos.

⚠️ SÓLO CON UN EVENTO EN VIVO, con la ventana del vigía (`svsEnVivo()` en
`bot/avisos.js`): de 15 minutos antes del arranque a 5 horas después, o una
llave publicada en las últimas 3 horas (`/avisos/vivo`). Sin eso, nada: ni
conexión ni escritura. Con eso, una conexión por corrida (cada 30 minutos)
para todos los servidores en vivo juntos.

⚠️ PIDE LO MÍNIMO: `GUILDS` y `GUILD_VOICE_STATES`, ninguno privilegiado.
Sin el de presencias, el estado de cada servidor trae como miembros sólo
al bot y a quien está en un canal de voz: justo lo que hace falta, y nada
de la lista entera.

🔒 SON IDS DE GENTE: VAN A KV, NUNCA AL REPO NI AL LOG. El repo es público
y los logs de Actions también: el log dice cuántos, nunca quién. En KV,
`voz:<SV>` guarda de cada cuenta sus nombres, los canales y **cuándo se la
vio** (una marca por foto), y vence a los 3 días, como las inscripciones
del vigía. Por hora y no por fecha: un evento de las 11:50 PM con la llave
de las 12:05 AM cae en dos días, y lo que importa es quién estaba cuando
se jugó esa llave.

Lo usa ✅ Decidir (`sheet/decidir.py`, `_en_llamada()`) como pista del
«¿quién es X?». ⚠️ ES UNA PISTA, NO UNA RESPUESTA: la identidad no se
interpreta, se pregunta.
"""
import datetime
import io
import json
import os
import sys
import time

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)

GATEWAY = 'wss://gateway.discord.gg/?v=10&encoding=json'
#: GUILDS (1 << 0) y GUILD_VOICE_STATES (1 << 7): ninguno privilegiado
INTENTS = (1 << 0) | (1 << 7)
#: la ventana del vigía: de 15 min antes del arranque a 5 h después…
ANTES_MIN = 15
DESPUES_H = 5
#: …o una llave publicada (o editada) en las últimas 3 horas
LLAVE_H = 3
#: cuánto se espera el estado de los servidores antes de irse
ESPERA_S = 20
#: lo que se guarda vence a los 3 días, como las inscripciones del vigía
VENCE_S = 3 * 24 * 3600
VIGIA = 'https://liga-global-bot.liga-global-ul.workers.dev'
CLAVE = 'voz:%s'


def _ms(iso):
    """Un ISO (UTC si no dice zona) a milisegundos, o `None`."""
    try:
        t = datetime.datetime.fromisoformat(str(iso).replace('Z', '+00:00'))
    except (TypeError, ValueError):
        return None
    if t.tzinfo is None:
        t = t.replace(tzinfo=datetime.timezone.utc)
    return int(t.timestamp() * 1000)


# ── 1 · quién está en vivo ───────────────────────────────────────────────────

def en_vivo(anuncios, llaves_vivo, ahora_ms):
    """`{guild_id: sv}` de los servidores con un evento en vivo ahora.

    `anuncios` son los de `datos/anuncios.json`; `llaves_vivo`, las de
    `/avisos/vivo` (`{sv, g, ed}`). Un anuncio sin hora legible arranca
    cuando se publicó, como en «Lo que pasó» (`subir_web._ini`).
    """
    import cuando as CU
    out = {}
    for a in anuncios or ():
        g, sv = str(a.get('guild_id') or ''), a.get('servidor') or ''
        ini = _ms(CU.momento(a) or a.get('cuando'))
        if g and sv and ini is not None and \
                ini - ANTES_MIN * 60000 <= ahora_ms <= ini + DESPUES_H * 3600000:
            out[g] = sv
    for ll in llaves_vivo or ():
        g, sv, ed = str(ll.get('g') or ''), ll.get('sv') or '', ll.get('ed') or ll.get('pub')
        if g and sv and isinstance(ed, (int, float)) and ahora_ms - ed <= LLAVE_H * 3600000:
            out.setdefault(g, sv)
    return out


def llaves_del_vigia():
    """Las llaves en vivo del vigía (público, sin clave), o `[]`."""
    try:
        import requests
        r = requests.get(VIGIA + '/avisos/vivo', timeout=15)
        return (r.json() or {}).get('llaves') or [] if r.status_code == 200 else []
    except Exception:                                    # noqa: BLE001
        return []


# ── 2 · la foto ──────────────────────────────────────────────────────────────

def de_guild(g):
    """`[{id, n: [nombres], c: canal}]` de un GUILD_CREATE: quién está en voz.

    Los bots no cuentan (el de música también está en la llamada).
    """
    canales = {c.get('id'): c.get('name') or '' for c in g.get('channels') or ()}
    miembros, bots = {}, set()
    for m in g.get('members') or ():
        u = m.get('user') or {}
        if not u.get('id'):
            continue
        if u.get('bot'):
            bots.add(u['id'])
        miembros[u['id']] = [x for x in (m.get('nick'), u.get('global_name'), u.get('username')) if x]
    out = []
    for v in g.get('voice_states') or ():
        uid, cid = v.get('user_id'), v.get('channel_id')
        if not uid or not cid or uid in bots:
            continue
        m = v.get('member') or {}
        u = m.get('user') or {}
        nombres = miembros.get(uid) or [x for x in (m.get('nick'), u.get('global_name'),
                                                     u.get('username')) if x]
        out.append({'id': str(uid), 'n': nombres, 'c': canales.get(cid, '')})
    return out


def foto(guilds, token, espera=ESPERA_S):
    """`({sv: [gente]}, [svs sin respuesta])`: una conexión, y se va.

    Identifica con lo mínimo, junta el GUILD_CREATE de los servidores
    pedidos (llegan todos al conectar) y cierra con 1000, que termina la
    sesión: no queda nada abierto ni para retomar.
    """
    import websocket
    ws = websocket.create_connection(GATEWAY, timeout=15)
    try:
        hola = json.loads(ws.recv())
        if hola.get('op') != 10:
            raise RuntimeError('el Gateway no saludó (op %s)' % hola.get('op'))
        ws.send(json.dumps({'op': 2, 'd': {
            'token': token, 'intents': INTENTS,
            'properties': {'os': 'linux', 'browser': 'liga-global', 'device': 'liga-global'}}}))
        faltan, out = set(guilds), {}
        fin = time.time() + espera
        while faltan and time.time() < fin:
            ws.settimeout(max(1.0, fin - time.time()))
            try:
                m = json.loads(ws.recv())
            except websocket.WebSocketTimeoutException:
                break
            op, t, d = m.get('op'), m.get('t'), m.get('d') or {}
            if op in (7, 9):
                # que reconecte o sesión inválida: no se insiste, es una foto
                break
            if op == 0 and t == 'GUILD_CREATE' and str(d.get('id')) in faltan:
                gid = str(d['id'])
                faltan.discard(gid)
                out[guilds[gid]] = de_guild(d)
        return out, sorted(guilds[g] for g in faltan)
    finally:
        try:
            ws.close()
        except Exception:                                # noqa: BLE001
            pass


# ── 3 · lo guardado ──────────────────────────────────────────────────────────

def fusionar(viejo, gente, ahora_ms):
    """Suma una foto a lo guardado: nombres y canales sin repetir, la marca
    de esta foto, y fuera lo que tiene más de `VENCE_S`."""
    out = {'v': 1, 'gente': {}}
    desde = ahora_ms - VENCE_S * 1000
    for did, e in ((viejo or {}).get('gente') or {}).items():
        vistos = [t for t in e.get('t') or () if t >= desde]
        if vistos:
            out['gente'][did] = dict(e, t=vistos)
    for p in gente:
        e = out['gente'].setdefault(p['id'], {'n': [], 'c': [], 't': []})
        e['n'] = list(dict.fromkeys(list(e['n']) + list(p.get('n') or [])))[:6]
        if p.get('c') and p['c'] not in e['c']:
            e['c'] = (e['c'] + [p['c']])[-4:]
        if ahora_ms not in e['t']:
            e['t'] = e['t'] + [ahora_ms]
    return out


def _kv():
    """`(sesión, api)` de Cloudflare, o `(None, None)` sin token."""
    try:
        import requests
        import subir_datos as SD
        tok = ''
        for l in io.open(os.path.join(BASE, '.env'), encoding='utf-8'):
            if l.strip().startswith('CLOUDFLARE_API_TOKEN='):
                tok = l.split('=', 1)[1].strip().strip('"\'')
        if not tok:
            return None, None
        s = requests.Session()
        s.headers['Authorization'] = 'Bearer ' + tok
        return s, SD.API
    except (OSError, ImportError):
        return None, None


def leer(sv, _cache={}):                                  # noqa: B006
    """Lo guardado de un servidor (`{'gente': {id: {n, c, t}}}`), o `{}`."""
    if sv in _cache:
        return _cache[sv]
    s, api = _kv()
    out = {}
    if s:
        try:
            r = s.get('%s/values/%s' % (api, CLAVE % sv), timeout=30)
            out = r.json() if r.status_code == 200 else {}
        except (ValueError, OSError):
            out = {}
    _cache[sv] = out if isinstance(out, dict) else {}
    return _cache[sv]


def guardar(sv, gente, ahora_ms):
    """Suma la foto a KV. `True`, `False` si no pudo, `None` sin gente."""
    if not gente:
        return None
    s, api = _kv()
    if not s:
        return False
    nuevo = fusionar(leer(sv), gente, ahora_ms)
    r = s.put('%s/values/%s' % (api, CLAVE % sv), params={'expiration_ttl': VENCE_S},
              files={'value': (None, json.dumps(nuevo, ensure_ascii=False)), 'metadata': (None, '{}')},
              timeout=60)
    return r.status_code == 200


def en_la_ventana(e, desde_ms, hasta_ms):
    """¿A esa cuenta se la vio en la llamada entre esas dos horas?"""
    return any(desde_ms <= t <= hasta_ms for t in e.get('t') or ())


# ── 4 · la llamada, minuto a minuto, mientras dure lo en vivo ────────────────
#
# 🔑 Dlx, 01/10/2026 (respuesta 5): *«yo pensé que ya hacía eso… y cada minuto
# de hecho si es posible, así como se actualizan las llaves, pero como veas
# necesario»*. La foto del ciclo era una cada media hora: el que entró a pelear
# y se fue entre dos fotos no quedaba en ningún lado.
#
# ⚠️ UNA CONEXIÓN Y NO UNA POR MINUTO. Discord deja 1.000 IDENTIFY por día y, si
# se pasa, RESETEA EL TOKEN DEL BOT (los tokens nuevos, al final: Dlx). Así que
# un trabajo de Actions (`.github/workflows/llamada.yml`, lo larga el vigía del
# Worker cuando hay algo en vivo) se conecta UNA vez, late, y sigue cada entrada
# y salida (`VOICE_STATE_UPDATE`). Cada minuto anota quién está en la llamada de
# los servidores en vivo; cada 10, lo suma a KV (`voz:<SV>`, el mismo formato
# que la foto, con una marca por minuto). Termina solo: 15 minutos sin nada en
# vivo, o a las 5 h 50 (el tope de un trabajo de Actions es 6 h; si sigue en
# vivo, el vigía larga otro).
#
# ⚠️ GUARDA TODO LO DE LA SESIÓN Y LO VUELVE A SUMAR EN CADA GUARDADO: la foto
# del ciclo también escribe `voz:<SV>`, y si las dos leen y escriben a la vez una
# pisa a la otra. Las marcas son un conjunto, así que sumar de nuevo no duplica
# y la próxima vuelta repara lo que se haya pisado.
#
# 🔑 Y DA LOS MINUTOS DE CADA UNO: una marca por minuto es lo que pide la idea
# de la tarea del Pase («escuchá 10 minutos de batallas en vivo»).

#: cada cuánto se suma a KV lo de la sesión
GUARDAR_CADA_S = 10 * 60
#: cuánto se espera sin nada en vivo antes de irse
QUIETO_S = 15 * 60
#: el tope: un trabajo de Actions dura hasta 6 h
TOPE_S = 5 * 3600 + 50 * 60
#: cuántas veces se reconecta antes de rendirse (cada una es un IDENTIFY)
RECONEXIONES = 5
RAW = 'https://raw.githubusercontent.com/underraponline-lgtm/underlegends/main/datos/anuncios.json'


def nueva_voz():
    """El estado de voz de un servidor: quién está en qué canal, sus nombres y los canales."""
    return {'voz': {}, 'nombres': {}, 'canales': {}, 'bots': set()}


def evento_gateway(estados, t, d):
    """Aplica un evento del Gateway a `estados` (`{guild_id: nueva_voz()}`).

    `GUILD_CREATE` trae la foto inicial (canales, los miembros en voz y sus
    `voice_states`); `VOICE_STATE_UPDATE`, cada entrada, salida o cambio de
    canal; `CHANNEL_CREATE`/`UPDATE`, el nombre de un canal.
    """
    d = d or {}
    if t == 'GUILD_CREATE' and d.get('id'):
        e = estados[str(d['id'])] = nueva_voz()
        e['canales'] = {c.get('id'): c.get('name') or '' for c in d.get('channels') or ()}
        for m in d.get('members') or ():
            u = m.get('user') or {}
            if u.get('id'):
                if u.get('bot'):
                    e['bots'].add(u['id'])
                e['nombres'][u['id']] = [x for x in (m.get('nick'), u.get('global_name'), u.get('username')) if x]
        for v in d.get('voice_states') or ():
            if v.get('user_id') and v.get('channel_id'):
                e['voz'][str(v['user_id'])] = v['channel_id']
    elif t == 'VOICE_STATE_UPDATE' and d.get('guild_id'):
        e = estados.setdefault(str(d['guild_id']), nueva_voz())
        uid = str(d.get('user_id') or '')
        if not uid:
            return
        m = d.get('member') or {}
        u = m.get('user') or {}
        if u.get('bot'):
            e['bots'].add(uid)
        ns = [x for x in (m.get('nick'), u.get('global_name'), u.get('username')) if x]
        if ns:
            e['nombres'][uid] = ns
        if d.get('channel_id'):
            e['voz'][uid] = d['channel_id']
        else:
            e['voz'].pop(uid, None)
    elif t in ('CHANNEL_CREATE', 'CHANNEL_UPDATE') and d.get('guild_id') and d.get('id'):
        estados.setdefault(str(d['guild_id']), nueva_voz())['canales'][d['id']] = d.get('name') or ''


def en_voz(e):
    """`[{id, n, c}]` de quien está ahora en un canal de voz de ese servidor, sin los bots."""
    return [{'id': uid, 'n': e['nombres'].get(uid) or [], 'c': e['canales'].get(cid, '')}
            for uid, cid in sorted(e['voz'].items()) if uid not in e['bots']]


def anotar_minuto(sesion, sv, gente, minuto_ms):
    """Suma a `sesion` (`{sv: {id: {n, c, t}}}`) la marca de este minuto de cada uno de `gente`."""
    s = sesion.setdefault(sv, {})
    for p in gente:
        e = s.setdefault(p['id'], {'n': [], 'c': [], 't': []})
        e['n'] = list(dict.fromkeys(list(e['n']) + list(p.get('n') or [])))[:6]
        if p.get('c') and p['c'] not in e['c']:
            e['c'] = (e['c'] + [p['c']])[-4:]
        if minuto_ms not in e['t']:
            e['t'].append(minuto_ms)


def fusionar_sesion(viejo, de_sv, ahora_ms):
    """Lo guardado en KV más todo lo de la sesión de ese servidor (`{id: {n, c, t}}`).
    Las marcas son un conjunto: sumar dos veces lo mismo no cambia nada."""
    out = fusionar(viejo, [], ahora_ms)
    for did, p in (de_sv or {}).items():
        e = out['gente'].setdefault(did, {'n': [], 'c': [], 't': []})
        e['n'] = list(dict.fromkeys(list(e['n']) + list(p.get('n') or [])))[:6]
        for c in p.get('c') or ():
            if c not in e['c']:
                e['c'] = (e['c'] + [c])[-4:]
        e['t'] = sorted(set(e['t']) | set(p.get('t') or ()))
    return out


def anuncios_frescos():
    """Los anuncios del repo: los de GitHub (el ciclo los escribe cada media hora) o los del checkout."""
    try:
        import requests
        r = requests.get(RAW, timeout=15)
        if r.status_code == 200:
            return (r.json() or {}).get('anuncios') or []
    except Exception:                                    # noqa: BLE001
        pass
    try:
        with io.open(os.path.join(BASE, 'datos', 'anuncios.json'), encoding='utf-8') as f:
            return (json.load(f) or {}).get('anuncios') or []
    except (OSError, ValueError):
        return []


def guardar_sesion(sesion, svs):
    """Suma a KV lo de la sesión de cada servidor de `svs`. `{sv: True/False}`."""
    s, api = _kv()
    out = {}
    if not s:
        return {sv: False for sv in svs}
    ahora = int(time.time() * 1000)
    for sv in svs:
        try:
            r = s.get('%s/values/%s' % (api, CLAVE % sv), timeout=30)
            viejo = r.json() if r.status_code == 200 else {}
        except (ValueError, OSError):
            viejo = {}
        nuevo = fusionar_sesion(viejo if isinstance(viejo, dict) else {}, sesion.get(sv), ahora)
        r = s.put('%s/values/%s' % (api, CLAVE % sv), params={'expiration_ttl': VENCE_S},
                  files={'value': (None, json.dumps(nuevo, ensure_ascii=False)), 'metadata': (None, '{}')},
                  timeout=60)
        out[sv] = r.status_code == 200
    return out


def seguir(token, aplicar=True, tope_s=TOPE_S):
    """El trabajo de la llamada: una conexión mientras haya algo en vivo. Ver arriba."""
    import random
    import websocket
    inicio = time.time()
    estados, sesion = {}, {}
    anuncios, anuncios_t = anuncios_frescos(), time.time()
    vivos, ultimo_vivo = {}, time.time()
    guardado_t, minuto_t = time.time(), 0.0
    reconectado = 0
    sucios = set()

    def _guardar(motivo):
        nonlocal guardado_t
        guardado_t = time.time()
        if not sucios:
            return
        if aplicar:
            r = guardar_sesion(sesion, sorted(sucios))
            print('   💾 %s: %s' % (motivo, ', '.join('%s %s' % (sv, 'ok' if ok else '⚠️') for sv, ok in sorted(r.items()))))
        else:
            print('   (simulacro) %s: no guardo %s' % (motivo, ', '.join(sorted(sucios))))
        sucios.clear()

    while True:
        ws = websocket.create_connection(GATEWAY, timeout=15)
        try:
            hola = json.loads(ws.recv())
            if hola.get('op') != 10:
                raise RuntimeError('el Gateway no saludó (op %s)' % hola.get('op'))
            latido = (hola.get('d') or {}).get('heartbeat_interval', 41250) / 1000.0
            ws.send(json.dumps({'op': 2, 'd': {
                'token': token, 'intents': INTENTS,
                'properties': {'os': 'linux', 'browser': 'liga-global', 'device': 'liga-global'}}}))
            seq, proximo_latido, ack = None, time.time() + latido * random.random(), True
            while True:
                ahora = time.time()
                if ahora >= proximo_latido:
                    if not ack:
                        raise RuntimeError('el Gateway no contestó el latido')
                    ws.send(json.dumps({'op': 1, 'd': seq}))
                    ack, proximo_latido = False, ahora + latido
                if ahora - minuto_t >= 60:
                    minuto_t = ahora
                    if ahora - anuncios_t > 10 * 60:
                        anuncios, anuncios_t = anuncios_frescos(), ahora
                    vivos = en_vivo(anuncios, llaves_del_vigia(), int(ahora * 1000))
                    if vivos:
                        ultimo_vivo = ahora
                    marca = int(ahora // 60) * 60000
                    cuantos = []
                    for gid, sv in sorted(vivos.items()):
                        gente = en_voz(estados[gid]) if gid in estados else []
                        if gente:
                            anotar_minuto(sesion, sv, gente, marca)
                            sucios.add(sv)
                        cuantos.append('%s %d' % (sv, len(gente)))
                    # 🔒 cuántos, nunca quién: el log de Actions es público
                    print('   %s · %s' % (time.strftime('%H:%M'), ', '.join(cuantos) or 'nada en vivo'))
                    if ahora - guardado_t >= GUARDAR_CADA_S:
                        _guardar('cada 10 minutos')
                    if ahora - ultimo_vivo >= QUIETO_S or ahora - inicio >= tope_s:
                        _guardar('fin')
                        print('   🎙️ termino: %s' % ('15 minutos sin nada en vivo' if ahora - ultimo_vivo >= QUIETO_S
                                                    else 'el tope de tiempo'))
                        return 0
                ws.settimeout(1.0)
                try:
                    m = json.loads(ws.recv())
                except websocket.WebSocketTimeoutException:
                    continue
                op = m.get('op')
                if m.get('s') is not None:
                    seq = m['s']
                if op == 11:
                    ack = True
                elif op == 1:
                    ws.send(json.dumps({'op': 1, 'd': seq}))
                elif op in (7, 9):
                    raise RuntimeError('el Gateway pidió reconectar (op %s)' % op)
                elif op == 0:
                    evento_gateway(estados, m.get('t'), m.get('d'))
        except Exception as e:                               # noqa: BLE001
            reconectado += 1
            print('   ⚠️ se cortó la conexión (%s); reconexión %d de %d' % (str(e)[:70], reconectado, RECONEXIONES))
            if reconectado > RECONEXIONES:
                _guardar('fin, sin conexión')
                return 1
            time.sleep(5)
        finally:
            try:
                ws.close()
            except Exception:                                # noqa: BLE001
                pass


# ── el paso del ciclo ────────────────────────────────────────────────────────

def correr(aplicar=True, foto_sola=False, probar=''):
    ahora = int(time.time() * 1000)
    try:
        with io.open(os.path.join(BASE, 'datos', 'anuncios.json'), encoding='utf-8') as f:
            anuncios = (json.load(f) or {}).get('anuncios') or []
    except (OSError, ValueError):
        anuncios = []
    if probar:
        # 🧪 `--probar SV`: la foto de ese servidor aunque no esté en vivo,
        # para ver que el Gateway anda. Nunca guarda.
        with io.open(os.path.join(BASE, 'datos', 'servidores.json'), encoding='utf-8') as f:
            g = (((json.load(f) or {}).get('servidores') or {}).get(probar) or {}).get('guild_id')
        vivos, aplicar, foto_sola = ({str(g): probar} if g else {}), False, True
    else:
        vivos = en_vivo(anuncios, llaves_del_vigia(), ahora)
    if not vivos:
        print('   🎙️ ningún servidor en vivo: no me conecto')
        return 0
    print('   🎙️ en vivo: %s' % ', '.join(sorted(set(vivos.values()))))
    if not (aplicar or foto_sola):
        print('      (simulacro: no me conecto — agregá `--foto` o `--aplicar`)')
        return 0
    import escuchar as E
    tok = E._env('DISCORD_TOKEN')
    try:
        fotos, sin = foto(vivos, tok)
    except Exception as e:                               # noqa: BLE001
        # ⚠️ una foto que no sale no tumba el ciclo: es una pista
        print('      ⚠️ no pude sacar la foto: %s' % str(e)[:80])
        return 0
    for sv in sorted(fotos):
        g = fotos[sv]
        canales = sorted({p['c'] for p in g if p['c']})
        # 🔒 cuántos y en qué canal, NUNCA quién: el log de Actions es público
        print('      %-5s %2d en la llamada%s' % (sv, len(g), (' · ' + ', '.join(canales)[:60]) if canales else ''))
        if aplicar and g:
            ok = guardar(sv, g, ahora)
            print('            %s' % ('guardado en KV (vence en 3 días)' if ok else '⚠️ no pude guardarlo'))
    for sv in sin:
        print('      %-5s ⚠️ Discord no mandó su estado' % sv)
    return 0


def _self_check():
    print('\n  en_llamada.py — self-check\n')
    mal = 0

    def ok(c, que):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('ok' if c else '🔴', que))

    # el anuncio de las 03:30 «EN 30 MINUTOS» arranca a las 04:00
    ahora = _ms('2026-09-29T03:50:00')
    an = [{'guild_id': '1', 'servidor': 'FFA', 'cuando': '2026-09-29T03:30:44', 'horario': 'EN 30 MINUTOS'},
          {'guild_id': '2', 'servidor': 'SR', 'cuando': '2026-09-28T20:00:00', 'horario': 'EN 30 MINUTOS'},
          {'guild_id': '3', 'servidor': 'URBF', 'cuando': '2026-09-29T05:00:00', 'horario': 'EN 30 MINUTOS'}]
    v = en_vivo(an, [], ahora)
    ok(v == {'1': 'FFA'}, 'en vivo: el que arranca en 10 min sí; el de hace 7 h y el de más tarde no  %s' % v)
    ok(en_vivo(an[:1], [], _ms('2026-09-29T03:40:00')) == {},
       'a 20 min del arranque todavía no (la ventana abre 15 antes, como el vigía)')
    ok(en_vivo(an[1:], [{'g': '2', 'sv': 'SR', 'ed': ahora - 3600000}], ahora) == {'2': 'SR'},
       'y una llave editada hace 1 h lo pone en vivo aunque el anuncio sea viejo')
    ok(en_vivo(an[1:], [{'g': '2', 'sv': 'SR', 'ed': ahora - 4 * 3600000}], ahora) == {},
       'la de hace 4 h, no')

    gc = {'id': '1', 'channels': [{'id': '10', 'name': '🎤 Escenario'}, {'id': '11', 'name': 'Chill'}],
          'members': [{'user': {'id': '100', 'username': 'nachonc_', 'global_name': 'NC'}, 'nick': 'NC 🇦🇷'},
                      {'user': {'id': '101', 'username': 'jockie', 'bot': True}},
                      {'user': {'id': '102', 'username': 'rove_21'}}],
          'voice_states': [{'user_id': '100', 'channel_id': '10'}, {'user_id': '101', 'channel_id': '10'},
                           {'user_id': '102', 'channel_id': '11'}, {'user_id': '103', 'channel_id': None}]}
    g = de_guild(gc)
    ok([p['id'] for p in g] == ['100', '102'], 'de la foto: los que están en voz, sin el bot ni el que salió')
    ok(g[0] == {'id': '100', 'n': ['NC 🇦🇷', 'NC', 'nachonc_'], 'c': '🎤 Escenario'},
       'con su apodo, su nombre y su usuario, y el canal')

    f1 = fusionar({}, g, 1000)
    f2 = fusionar(f1, [{'id': '100', 'n': ['NC'], 'c': 'Chill'}], 2000)
    e = f2['gente']['100']
    ok(e['t'] == [1000, 2000] and e['c'] == ['🎤 Escenario', 'Chill'] and e['n'] == ['NC 🇦🇷', 'NC', 'nachonc_'],
       'dos fotos: las dos marcas, los dos canales, los nombres sin repetir')
    viejo = {'gente': {'9': {'n': ['X'], 'c': [], 't': [1]}}}
    ok('9' not in fusionar(viejo, [], 1 + VENCE_S * 1000 + 1)['gente'], 'lo de hace más de 3 días se va')
    ok(en_la_ventana(e, 1500, 2500) and not en_la_ventana(e, 2500, 3000), 'se la vio entre tal y tal hora')
    ok(INTENTS == 129, 'pide sólo GUILDS y GUILD_VOICE_STATES (129), ninguno privilegiado')

    # 4 · minuto a minuto: el estado sigue cada entrada y salida
    est = {}
    evento_gateway(est, 'GUILD_CREATE', gc)
    evento_gateway(est, 'VOICE_STATE_UPDATE', {'guild_id': '1', 'user_id': '104', 'channel_id': '10',
                                               'member': {'user': {'id': '104', 'username': 'abyssus'}}})
    evento_gateway(est, 'VOICE_STATE_UPDATE', {'guild_id': '1', 'user_id': '102', 'channel_id': None})
    ok([p['id'] for p in en_voz(est['1'])] == ['100', '104'],
       'el que entró está, el que salió no, y el bot nunca')
    ses = {}
    anotar_minuto(ses, 'FFA', en_voz(est['1']), 60000)
    anotar_minuto(ses, 'FFA', en_voz(est['1']), 120000)
    anotar_minuto(ses, 'FFA', en_voz(est['1']), 120000)
    ok(ses['FFA']['104']['t'] == [60000, 120000] and ses['FFA']['104']['n'] == ['abyssus'],
       'una marca por minuto, sin repetir: dos minutos, dos marcas')
    kv = fusionar_sesion({'gente': {'104': {'n': ['Abyssus'], 'c': [], 't': [30000]}}}, ses['FFA'], 130000)
    ok(kv['gente']['104']['t'] == [30000, 60000, 120000] and kv['gente']['100']['c'] == ['🎤 Escenario'],
       'lo de la sesión se suma a lo de KV, en orden y sin perder la foto del ciclo')
    ok(fusionar_sesion(kv, ses['FFA'], 130000) == kv, 'y sumarlo dos veces no cambia nada (se repara lo que se pisó)')

    print('\n   %s' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return 1 if mal else 0


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        return _self_check()
    if '--seguir' in sys.argv:
        # el trabajo de `.github/workflows/llamada.yml`. `--minutos N` lo corta antes (para probarlo a mano) y
        # `--simulacro` no guarda nada
        import escuchar as E
        mins = int(sys.argv[sys.argv.index('--minutos') + 1]) if '--minutos' in sys.argv[:-1] else 0
        print('   🎙️ sigo la llamada mientras haya algo en vivo%s' % (' (%d min)' % mins if mins else ''))
        return seguir(E._env('DISCORD_TOKEN'), aplicar='--simulacro' not in sys.argv,
                      tope_s=mins * 60 if mins else TOPE_S)
    probar = sys.argv[sys.argv.index('--probar') + 1] if '--probar' in sys.argv[:-1] else ''
    return correr(aplicar='--aplicar' in sys.argv, foto_sola='--foto' in sys.argv, probar=probar)


if __name__ == '__main__':
    sys.exit(main())
