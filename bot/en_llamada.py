# -*- coding: utf-8 -*-
"""QUIÉN ESTÁ EN LA LLAMADA, SÓLO MIENTRAS UN SERVIDOR TIENE UN EVENTO EN VIVO.

    python bot/en_llamada.py            qué servidores están en vivo (no se conecta)
    python bot/en_llamada.py --foto     se conecta y dice cuántos hay (no guarda)
    python bot/en_llamada.py --aplicar  la foto, guardada en KV (lo que hace el ciclo)
    python bot/en_llamada.py --auto     el self-check (sin red)
    python bot/en_llamada.py --probar DRA   la foto de ese servidor aunque no esté
                                        en vivo (no guarda): que el Gateway anda

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

    print('\n   %s' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return 1 if mal else 0


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        return _self_check()
    probar = sys.argv[sys.argv.index('--probar') + 1] if '--probar' in sys.argv[:-1] else ''
    return correr(aplicar='--aplicar' in sys.argv, foto_sola='--foto' in sys.argv, probar=probar)


if __name__ == '__main__':
    sys.exit(main())
