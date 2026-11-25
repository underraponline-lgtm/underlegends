# -*- coding: utf-8 -*-
"""🎙️ ¿ULAYA GRABÓ CADA EVENTO? La auditoría de todos los días (Dlx, 25/11/2026: el #1 de la tanda que aprobó).

Cada llave que se jugó en un servidor de la Liga tendría que tener su grabación. El 25/11 se miró a mano y del 22/11 al
24/11 FFA tenía 8 de 8, y afuera de FFA faltaba casi la mitad: DANGER WORLD publica sus llaves en «「🥊」𝗕𝗥𝗔𝗖𝗞𝗘𝗧𝗦» y el
bot en vivo sólo leía canales llamados «llave» (arreglado ese día en `subir_datos._canales_llaves()`), el canal de UFLUC
entró tarde, el 24/11 de 3 a 7 PM ET el Durable Object estuvo caído (cupo de filas) y en FRZ aislaron a ULAYA. Nada de
eso avisó: se vio dos eventos después. Esto lo mira solo, una vez por día, y dice qué faltó y por qué (si se sabe).

🔑 DE DÓNDE SALE (todo es lectura):
  · las llaves: `datos/llaves_t1.json` y `datos/llaves_sin_sumar.json` (las de los servidores que no suman también se
    graban). La hora de una llave es la de su mensaje: el ID del link es un snowflake.
  · las grabaciones: el canal de Logs, donde ULAYA entrega «🎙️ **Grabación** · <servidor> · <#canal>» con la hora de
    arranque y lo que duró (`entregar()` de `grabador/index.js`), unos 20 min después de terminar (la mezcla).
  · las fallas: el mismo canal, «⚠️ **No pude entrar a grabar**» / «Me sacaron de la llamada» con su «Por qué:»
    (`textoFalla()` de `grabador/entrada.js`; se EDITA con cada intento, así que va de la creación a la edición).
  · el servidor de cada canal: `GET /channels/<id>`, guardado. ⚠️ NUNCA POR EL NOMBRE: los nombres son letras de
    fantasía («𝐖𝐎𝐑𝐋𝐃 𝐎𝐅 𝐅𝐑𝐄𝐄») y cambian.

🔑 GRABADA = mismo servidor y la llave publicada entre el arranque − 45 min y el final + 45 min. Una grabación cubre
varias llaves del mismo servidor (una noche con dos eventos seguidos).

🔑 LA CAUSA, SÓLO SI HAY CON QUÉ DECIRLA: el bot no está en el servidor · el canal de la llave no se leía en vivo ·
ULAYA aislada AHORA · un aviso de falla cerca de esa hora (con su «Por qué», citado) · una entrega vacía. Si no hay
nada: «sin causa conocida». ⚠️ No se inventa: la caída del Durable Object del 24/11 no deja rastro acá y sale así.

🔑 LOS QUE NO CUENTAN van aparte, como «el bot no está»: las llaves de un servidor que no es socio confirmado, o cuyo
servidor de Discord no tiene al bot. No son una falla de ULAYA.

📨 LA SALIDA: si al día anterior (hora del este) le faltó algo, UN mensaje al canal de Logs, una línea por evento,
una vez por día (desde las 12 PM ET, como los chats: el ciclo no corre de 3 a 11 AM). Y si el MISMO servidor perdió 2
o más en los últimos 3 días, un DM a Dlx con `alertar.alertar()` (que se calla 6 h). Nunca menciona a nadie.

⚠️ EL RECUERDO SOBREVIVE AL RUNNER: `datos/grabaciones_auditoria.json` está en el `ARCHIVOS` de `bot/ci/guardar.sh`.
Sin eso cada corrida arrancaría sin memoria y mandaría el resumen cada media hora (lo que le pasó a `avisar.py`).

⚠️ NUNCA HACE FALLAR AL CICLO: sin token, sin Discord o con un error, lo dice y sale bien. Lo corre el paso 2b8k.

Uso:
    python bot/auditar_grabaciones.py --auto              el self-check, sin red
    python bot/auditar_grabaciones.py --ver [--dia AAAA-MM-DD]   qué mandaría (lee Discord, no manda ni guarda nada)
    python bot/auditar_grabaciones.py --aplicar           lo del ciclo: si toca, audita, manda y anota
"""
import datetime as dt
import io
import json
import os
import re
import sys
import time

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
API = 'https://discord.com/api/v10'
ESTADO = os.path.join(BASE, 'datos', 'grabaciones_auditoria.json')
#: el canal de Logs de DRA: donde ULAYA entrega y avisa sus fallas, y donde va el resumen
LOGS = '1504110449535483924'
#: ULAYA (el mismo usuario que el bot del ciclo); si `/users/@me` no contesta, se usa éste
ULAYA = '1550026808404217926'
#: la grabación en TODOS los servidores arrancó el 22/11/2026: antes no hay qué auditar
DESDE = '2026-11-22'
#: cuánto antes del arranque y después del final de una grabación puede caer su llave
MARGEN_MIN = 45
#: una falla «cerca»: desde 1 h antes de su primer intento hasta 3 h después del último (el evento sigue sin ella)
FALLA_ANTES_MIN, FALLA_DESPUES_MIN = 60, 180
#: la entrega sale ~20 min después de terminar (la mezcla)
MEZCLA_MIN = 20
#: desde qué hora del este se audita el día anterior (las entregas de la madrugada ya llegaron)
DESDE_H = 12
#: la regla de «el canal donde ya hubo una llave se lee en vivo» (`_canales_de_llaves_cargadas()`) existe desde este día
REGLA_CARGADAS = '2026-11-25'
#: cuántos días mira la repetición y desde cuántos perdidos del mismo servidor se le avisa a Dlx
VENTANA_DIAS, REPITE = 3, 2


# ── horas ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
def _tz():
    from zoneinfo import ZoneInfo
    return ZoneInfo('America/New_York')


def _ahora():
    return dt.datetime.now(dt.timezone.utc)


def hora_de_id(i):
    """La hora (UTC) de un snowflake de Discord."""
    return dt.datetime.fromtimestamp(((int(i) >> 22) + 1420070400000) / 1000, tz=dt.timezone.utc)


def hora_et(t):
    """«9:47 PM ET»."""
    return t.astimezone(_tz()).strftime('%I:%M %p').lstrip('0') + ' ET'


def dia_et(t):
    return t.astimezone(_tz()).strftime('%Y-%m-%d')


def _iso(s):
    if not s:
        return None
    x = dt.datetime.fromisoformat(str(s).replace('Z', '+00:00'))
    return x if x.tzinfo else x.replace(tzinfo=dt.timezone.utc)


def _ddmm(dia):
    return '%s/%s' % (dia[8:10], dia[5:7])


# ── leer lo que ULAYA dejó en Logs (puro) ──────────────────────────────────────────────────────────────────────────────
RE_ENC = re.compile(r'^🎙 \*\*Grabación\*\* · .* · <#(\d+)>')
RE_HORA = re.compile(r'(\d{1,2}):(\d{2}) (AM|PM) ET · (?:(\d+) h )?(\d+|NaN) min · (\d+) voces')
RE_SALIO = re.compile(r'salió porque ([^\n]*?)\.?(?:\n|$)')
RE_FALLA = re.compile(r'^⚠ \*\*(No pude entrar a grabar|Me sacaron de la llamada)\*\* · .* · <#(\d+)>')
RE_PORQUE = re.compile(r'^Por qué: (.*)$', re.M)


def _arranque(hh, mm, ampm, t_msg, dur_min):
    """La hora de arranque (UTC) que dice el encabezado («9:47 PM ET», sin fecha): la de ese reloj más cercana a
    `t_msg − duración − la mezcla`, nunca después del mensaje."""
    h = int(hh) % 12 + (12 if ampm == 'PM' else 0)
    aprox = (t_msg - dt.timedelta(minutes=dur_min + MEZCLA_MIN)).astimezone(_tz())
    mejor = None
    for d in (-1, 0, 1):
        dd = (aprox + dt.timedelta(days=d)).date()
        c = dt.datetime(dd.year, dd.month, dd.day, h, int(mm), tzinfo=_tz()).astimezone(dt.timezone.utc)
        if c > t_msg:
            continue
        if mejor is None or abs((c - aprox).total_seconds()) < abs((mejor - aprox).total_seconds()):
            mejor = c
    return mejor


def leer_logs(mensajes, autor, guild_de):
    """`(grabaciones, fallas)` de los mensajes del canal de Logs (`[{id, author, content, timestamp, edited_timestamp}]`).

    grabación: `{guild, canal, ini, fin, voces, salio}` · falla: `{guild, canal, desde, hasta, titulo, porque}`.
    Una entrega vacía («NaN min · 0 voces», «No habló nadie») no es una grabación: es una falla, con su «salió porque».
    `guild_de`: `{canal: guild}` (sale de Discord); un canal que no está ahí queda con `guild` None.
    """
    grabs, fallas = [], []
    for m in mensajes or []:
        if str((m.get('author') or {}).get('id')) != str(autor):
            continue
        txt = (m.get('content') or '').replace('\ufe0f', '')
        t_msg = _iso(m.get('timestamp')) or hora_de_id(m['id'])
        e = RE_ENC.match(txt)
        if e:
            canal = e.group(1)
            h = RE_HORA.search(txt)
            sm = RE_SALIO.search(txt)
            salio = sm.group(1) if sm else ''
            if not h:
                continue
            dur = None if h.group(5) == 'NaN' else int(h.group(4) or 0) * 60 + int(h.group(5))
            voces = int(h.group(6))
            ini = _arranque(h.group(1), h.group(2), h.group(3), t_msg, dur or 0)
            if ini is None:
                continue
            if not dur or not voces or 'No habló nadie' in txt:
                fallas.append({'guild': guild_de.get(canal), 'canal': canal, 'desde': ini, 'hasta': t_msg,
                               'titulo': 'entrega vacía', 'porque': 'entró a las %s y salió porque %s' % (hora_et(ini), salio or '?')})
                continue
            grabs.append({'guild': guild_de.get(canal), 'canal': canal, 'ini': ini,
                          'fin': ini + dt.timedelta(minutes=dur), 'voces': voces, 'salio': salio})
            continue
        f = RE_FALLA.match(txt)
        if f:
            canal = f.group(2)
            p = RE_PORQUE.search(txt)
            porque = (p.group(1).strip().rstrip('.') if p else '').replace('**', '')
            fallas.append({'guild': guild_de.get(canal), 'canal': canal, 'desde': t_msg,
                           'hasta': _iso(m.get('edited_timestamp')) or t_msg, 'titulo': f.group(1), 'porque': porque})
    return grabs, fallas


def canales_de(mensajes, autor):
    """Los canales que nombran las entregas y fallas de ULAYA (para pedirle a Discord de qué servidor es cada uno)."""
    out = set()
    for m in mensajes or []:
        if str((m.get('author') or {}).get('id')) != str(autor):
            continue
        txt = (m.get('content') or '').replace('\ufe0f', '')
        x = RE_ENC.match(txt) or RE_FALLA.match(txt)
        if x:
            out.add(x.groups()[-1])
    return out


# ── las llaves (puro) ──────────────────────────────────────────────────────────────────────────────────────────────────
RE_LINK = re.compile(r'/channels/(\d{15,22})/(\d{15,22})/(\d{15,22})')


def llaves_de(t1, sin_sumar, dias):
    """`[{k, sv, dia, nombre, guild, canal, ts}]` de las llaves de esos días (las dos fuentes, sin repetir: la misma
    llave puede estar en las dos, con el mismo link). `ts`: la hora de cada mensaje de la llave."""
    out, vistos = [], set()
    for fuente in (t1 or {}, sin_sumar or {}):
        for k, v in fuente.items():
            if not isinstance(v, dict) or str(v.get('dia') or '') not in dias:
                continue
            ls = v.get('links') or []
            ls = ls if isinstance(ls, list) else [ls]
            ms = [RE_LINK.search(str(l)) for l in ls]
            ms = [x for x in ms if x]
            if not ms:
                continue
            ids = tuple(sorted(x.group(3) for x in ms))
            if ids in vistos:
                continue
            vistos.add(ids)
            out.append({'k': str(k), 'sv': str(v.get('sv') or '?'), 'dia': v['dia'], 'nombre': str(v.get('nombre') or '(sin título)'),
                        'guild': ms[0].group(1), 'canal': ms[0].group(2), 'ts': sorted(hora_de_id(x.group(3)) for x in ms)})
    return sorted(out, key=lambda x: x['ts'][0])


# ── la auditoría (pura) ────────────────────────────────────────────────────────────────────────────────────────────────
def auditar(llaves, grabs, fallas, svs, bot_guilds=None, vivo=None, aisladas=None, margen=MARGEN_MIN):
    """`{'grabadas': [...], 'faltan': [...], 'sin_bot': [...]}`.

    `svs`: `servidores` de `datos/servidores.json` · `bot_guilds`: los servidores donde está el bot (None = no se
    sabe) · `vivo`: `{k: True/False}` si el canal de esa llave se leía en vivo (sin la clave = no se sabe) ·
    `aisladas`: `{guild: hasta (UTC)}`. Cada falta trae `causas`, nunca vacía.
    """
    vivo, aisladas = vivo or {}, aisladas or {}
    m = dt.timedelta(minutes=margen)
    res = {'grabadas': [], 'faltan': [], 'sin_bot': []}
    for ll in llaves:
        conf = (svs or {}).get(ll['sv']) or {}
        if not conf.get('confirmado'):
            res['sin_bot'].append(dict(ll, por='no es socio confirmado'))
            continue
        if bot_guilds is not None and ll['guild'] not in bot_guilds:
            res['sin_bot'].append(dict(ll, por='el bot no está en el servidor'))
            continue
        g = next((g for g in grabs if g['guild'] == ll['guild']
                  and any(g['ini'] - m <= t <= g['fin'] + m for t in ll['ts'])), None)
        if g:
            res['grabadas'].append(dict(ll, grabacion=g))
            continue
        causas = []
        if vivo.get(ll['k']) is False:
            causas.append('el canal de la llave no se leía en vivo (<#%s>)' % ll['canal'])
        if ll['guild'] in aisladas:
            h = aisladas[ll['guild']]
            causas.append('ULAYA está aislada (timeout) ahí ahora, hasta el %s a las %s' % (_ddmm(dia_et(h)), hora_et(h)))
        for f in fallas:
            if f['guild'] != ll['guild']:
                continue
            if any(f['desde'] - dt.timedelta(minutes=FALLA_ANTES_MIN) <= t <= f['hasta'] + dt.timedelta(minutes=FALLA_DESPUES_MIN)
                   for t in ll['ts']):
                causas.append('%s: «%s»' % (f['titulo'].lower(), (f['porque'] or '?')[:160]))
        res['faltan'].append(dict(ll, causas=causas or ['sin causa conocida']))
    return res


def repetidos(faltan, repite=REPITE):
    """`{sv: [faltas]}` de los servidores que perdieron `repite` o más."""
    por = {}
    for x in faltan:
        por.setdefault(x['sv'], []).append(x)
    return {sv: xs for sv, xs in por.items() if len(xs) >= repite}


def texto(dia, res):
    """El resumen para el canal de Logs, o '' si no hay nada que decir."""
    falta = res['faltan']
    sin = [x for x in res['sin_bot'] if x['por'] != 'no es socio confirmado']
    if not falta and not sin:
        return ''
    total = len(res['grabadas']) + len(falta)
    ls = ['🎙️ **Auditoría de grabaciones** · %s' % _ddmm(dia),
          'ULAYA grabó %d de %d eventos de los socios.%s' % (len(res['grabadas']), total, ' No grabó:' if falta else '')]
    for x in falta:
        ls.append('· **%s** · %s · %s — %s' % (x['sv'], x['nombre'][:60], hora_et(x['ts'][0]), '; '.join(x['causas'])))
    if sin:
        ls.append('El bot no está (no cuentan):')
        for x in sin:
            ls.append('· **%s** · %s · %s — %s' % (x['sv'], x['nombre'][:60], hora_et(x['ts'][0]), x['por']))
    return '\n'.join(ls)


def texto_alerta(sv, xs, desde, hasta):
    return ('ULAYA no grabó %d eventos de %s entre el %s y el %s:\n%s\nEl detalle está en el canal de Logs.'
            % (len(xs), sv, _ddmm(desde), _ddmm(hasta),
               '\n'.join('· %s %s · %s — %s' % (_ddmm(x['dia']), hora_et(x['ts'][0]), x['nombre'][:50], '; '.join(x['causas']))
                         for x in xs)))


def toca(estado, ahora=None):
    """Una vez por día, desde las `DESDE_H` del este."""
    a = (ahora or _ahora()).astimezone(_tz())
    return a.hour >= DESDE_H and (estado or {}).get('auditado') != a.strftime('%Y-%m-%d')


def dias_atras(hoy, n):
    """Los `n` días antes de `hoy` (AAAA-MM-DD), del más viejo al más nuevo, sin pasar de `DESDE`."""
    d = dt.date.fromisoformat(hoy)
    xs = [(d - dt.timedelta(days=i)).isoformat() for i in range(n, 0, -1)]
    return [x for x in xs if x >= DESDE]


# ── Discord (lectura) ──────────────────────────────────────────────────────────────────────────────────────────────────
def _sesion():
    import requests
    import avisar
    t = avisar._token()
    if not t:
        return None
    s = requests.Session()
    s.headers.update({'Authorization': 'Bot ' + t, 'User-Agent': 'LigaGlobalBot (grabaciones, 1.0)'})
    return s


def _get(s, url, **kw):
    import requests
    for intento in range(3):
        try:
            r = s.get(url, timeout=30, **kw)
        except requests.RequestException:
            time.sleep(2 + intento * 3)
            continue
        if r.status_code == 429:
            try:
                espera = float((r.json() or {}).get('retry_after') or 2)
            except ValueError:
                espera = 2
            time.sleep(min(espera, 30) + 0.5)
            continue
        return r
    return None


def leer_canal(s, hasta, tope_paginas=15):
    """Los mensajes de Logs desde ahora hacia atrás hasta `hasta` (UTC)."""
    out, antes = [], None
    for _ in range(tope_paginas):
        r = _get(s, '%s/channels/%s/messages' % (API, LOGS), params=dict({'limit': 100}, **({'before': antes} if antes else {})))
        if r is None or r.status_code != 200:
            raise RuntimeError('Logs contestó %s' % (r.status_code if r is not None else 'nada'))
        xs = r.json() or []
        out += xs
        if not xs or _iso(xs[-1]['timestamp']) < hasta:
            break
        antes = xs[-1]['id']
    return out


def guild_de_canales(s, canales, cache, guilds=()):
    """`{canal: guild}`. Primero `GET /channels/<id>`; el que contesta 403 (una llamada que ULAYA ya no ve: FRZ, 25/11)
    se busca en la lista de canales de los servidores que tienen llaves (`GET /guilds/<g>/channels`, que sí contesta).
    Sólo se guarda lo que se encontró: un canal sin servidor se vuelve a preguntar."""
    out = dict(cache or {})
    faltan = []
    for c in sorted(canales):
        if out.get(c):
            continue
        r = _get(s, '%s/channels/%s' % (API, c))
        if r is not None and r.status_code == 200 and (r.json() or {}).get('guild_id'):
            out[c] = str(r.json()['guild_id'])
        else:
            faltan.append(c)
    for g in sorted(guilds):
        if not faltan:
            break
        r = _get(s, '%s/guilds/%s/channels' % (API, g))
        if r is None or r.status_code != 200:
            continue
        ids = {str(x.get('id')) for x in r.json() or []}
        for c in [c for c in faltan if c in ids]:
            out[c] = str(g)
            faltan.remove(c)
    return out


def guilds_del_bot(s):
    out, despues = set(), None
    for _ in range(5):
        r = _get(s, '%s/users/@me/guilds' % API, params=dict({'limit': 200}, **({'after': despues} if despues else {})))
        if r is None or r.status_code != 200:
            return None
        xs = r.json() or []
        out |= {str(g['id']) for g in xs}
        if len(xs) < 200:
            return out
        despues = xs[-1]['id']
    return out


def aislada_hasta(s, guild, yo):
    r = _get(s, '%s/guilds/%s/members/%s' % (API, guild, yo))
    if r is None or r.status_code != 200:
        return None
    t = _iso((r.json() or {}).get('communication_disabled_until'))
    return t if t and t > _ahora() else None


def leido_en_vivo(ll, t1):
    """¿El canal de esta llave estaba entre los que lee el bot en vivo (`subir_datos._canales_llaves()`)?

    ⚠️ CON LO QUE HABÍA ANTES DE ESA LLAVE: desde el 25/11 un canal donde ya hubo una llave cargada se lee, así que la
    llave misma —o una posterior— lo haría parecer leído. Cuentan sólo las publicadas más de 1 h antes, y antes del
    25/11 esa regla no existía. La memoria de canales y el /setup son los de hoy (no hay historia de eso)."""
    import subir_datos as SD
    orig = SD._canales_de_llaves_cargadas
    corte = ll['ts'][0] - dt.timedelta(hours=1)
    if ll['dia'] < REGLA_CARGADAS:
        prev = {}
    else:
        prev = {}
        for k, v in (t1 or {}).items():
            if not isinstance(v, dict):
                continue
            ls = v.get('links') or []
            ids = [x.group(3) for x in (RE_LINK.search(str(l)) for l in (ls if isinstance(ls, list) else [ls])) if x]
            if ids and min(hora_de_id(i) for i in ids) < corte:
                prev[k] = v
    hoy = dt.date.fromisoformat(ll['dia'])
    SD._canales_de_llaves_cargadas = lambda *a, **kw: orig(hoy=hoy, llaves=prev)
    try:
        return ll['canal'] in {c['id'] for c in SD._canales_llaves()}
    finally:
        SD._canales_de_llaves_cargadas = orig


# ── estado ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
def _json(ruta, defecto):
    try:
        with io.open(ruta, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return defecto


def _guardar(d):
    with io.open(ESTADO, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(d, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write('\n')


LEEME = ('La auditoría diaria de las grabaciones de ULAYA (bot/auditar_grabaciones.py, paso 2b8k): qué día ET ya se '
         'auditó (una vez por día), cómo dio y de qué servidor es cada canal que nombra ULAYA. Lo guarda guardar.sh.')


# ── correr ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
def correr(ver=False, dia=None):
    estado = _json(ESTADO, {}) or {}
    ahora = _ahora()
    hoy = dia_et(ahora)
    if not ver and not toca(estado, ahora):
        print('🎙️ la auditoría de grabaciones: hoy ya se hizo, o todavía no son las %d ET' % DESDE_H)
        return 0
    ayer = dia or (dt.date.fromisoformat(hoy) - dt.timedelta(days=1)).isoformat()
    if ayer < DESDE:
        print('🎙️ antes del %s no se grababa en todos los servidores: no hay qué auditar' % _ddmm(DESDE))
        return 0
    dias = [d for d in dias_atras((dt.date.fromisoformat(ayer) + dt.timedelta(days=1)).isoformat(), VENTANA_DIAS)]
    s = _sesion()
    if not s:
        print('⚠️ sin DISCORD_TOKEN: no puedo leer las entregas de ULAYA')
        return 0
    r = _get(s, '%s/users/@me' % API)
    yo = str((r.json() or {}).get('id')) if r is not None and r.status_code == 200 else ULAYA
    d0 = dt.date.fromisoformat(dias[0])
    desde_utc = dt.datetime(d0.year, d0.month, d0.day, tzinfo=_tz()).astimezone(dt.timezone.utc) - dt.timedelta(hours=6)
    ms = leer_canal(s, desde_utc)
    t1 = _json(os.path.join(BASE, 'datos', 'llaves_t1.json'), {}) or {}
    ss = _json(os.path.join(BASE, 'datos', 'llaves_sin_sumar.json'), {}) or {}
    svs = (_json(os.path.join(BASE, 'datos', 'servidores.json'), {}) or {}).get('servidores') or {}
    llaves = llaves_de(t1, ss, set(dias))
    bot_guilds = guilds_del_bot(s)
    guild_de = guild_de_canales(s, canales_de(ms, yo), estado.get('canales'),
                                {x['guild'] for x in llaves} & (bot_guilds or set()))
    grabs, fallas = leer_logs(ms, yo, guild_de)
    sin_guild = sorted({g['canal'] for g in grabs + fallas if not g['guild']})
    if sin_guild:
        print('⚠️ %d canales de ULAYA sin servidor conocido: lo de ahí no cuenta como grabado' % len(sin_guild))
    base = auditar(llaves, grabs, fallas, svs, bot_guilds)       # primero sin causas: a quién hay que preguntarle
    vivo = {}
    for x in base['faltan']:
        try:
            vivo[x['k']] = leido_en_vivo(x, t1)
        except Exception as e:                                   # noqa: BLE001
            print('⚠️ no pude saber si el canal de %s se leía en vivo (%s)' % (x['sv'], type(e).__name__))
    aisladas = {}
    for g in sorted({x['guild'] for x in base['faltan']}):
        h = aislada_hasta(s, g, yo)
        if h:
            aisladas[g] = h
    res = auditar(llaves, grabs, fallas, svs, bot_guilds, vivo, aisladas)
    del_dia = {k: [x for x in v if x['dia'] == ayer] for k, v in res.items()}
    print('🎙️ %d grabaciones y %d fallas en Logs; %d llaves del %s → %d grabadas, %d sin grabar, %d sin el bot'
          % (len(grabs), len(fallas), sum(len(v) for v in del_dia.values()), _ddmm(ayer),
             len(del_dia['grabadas']), len(del_dia['faltan']), len(del_dia['sin_bot'])))
    msg = texto(ayer, del_dia)
    rep = repetidos(res['faltan']) if ayer in {x['dia'] for x in res['faltan']} else {}
    # sólo avisa un servidor que perdió algo AYER: lo de antes ya se avisó el día que pasó
    rep = {sv: xs for sv, xs in rep.items() if any(x['dia'] == ayer for x in xs)}
    if ver:
        print('\n── lo que mandaría al canal de Logs ──')
        print(msg or '(nada: no faltó ninguna grabación)')
        for sv, xs in rep.items():
            print('\n── el DM que le mandaría a Dlx (clave grabaciones:%s) ──' % sv)
            print('🔴 ' + texto_alerta(sv, xs, dias[0], ayer))
        if del_dia['grabadas']:
            print('\n── grabadas ──')
            for x in del_dia['grabadas']:
                print('· %s · %s · %s (grabación de las %s)' % (x['sv'], x['nombre'][:50], hora_et(x['ts'][0]), hora_et(x['grabacion']['ini'])))
        print('\n(--ver: no mandé ni guardé nada)')
        return 0
    ok = True
    if msg:
        import alertar
        ok = alertar.normal(msg)
        print('🎙️ 📨 el resumen de grabaciones al canal de Logs' if ok else '⚠️ el resumen no salió: se reintenta en la próxima corrida')
        if ok:
            for sv, xs in rep.items():
                alertar.alertar('grabaciones:' + sv, texto_alerta(sv, xs, dias[0], ayer))
    if ok:
        estado.update({'_leeme': LEEME, 'auditado': hoy, 'canales': guild_de,
                       'ultimo': {'dia': ayer, 'grabadas': len(del_dia['grabadas']), 'faltan': len(del_dia['faltan']),
                                  'sin_bot': len(del_dia['sin_bot'])}})
        _guardar(estado)
    return 0


# ── self-check ─────────────────────────────────────────────────────────────────────────────────────────────────────────
def _self_check():
    malos = []

    def ok(c, que):
        print(('  ok  ' if c else '  MAL ') + que)
        if not c:
            malos.append(que)

    U = dt.timezone.utc

    def t(h, m=0, d=24):
        return dt.datetime(2026, 11, d, h, m, tzinfo=U)

    def snow(x):
        return str((int(x.timestamp() * 1000) - 1420070400000) << 22)

    # 1 · el encabezado: «9:47 PM ET» de una entrega de las 05:31 UTC del 22 (12:31 AM ET) es el 21 a las 9:47 PM ET
    ini = _arranque('9', '47', 'PM', t(5, 31, 22), 127)
    ok(ini == dt.datetime(2026, 11, 22, 2, 47, tzinfo=U), 'la hora sin fecha del encabezado cae el día correcto (antes de medianoche)')
    ms = [
        {'id': snow(t(5, 31, 22)), 'author': {'id': 'U'}, 'timestamp': t(5, 31, 22).isoformat(),
         'content': '🎙️ **Grabación** · [FFA] Freestyle 👾 · <#100000000000000000>\n9:47 PM ET · 2 h 7 min · 36 voces + la música\n'
                    'Entró porque había 11 personas; salió porque se vació la llamada.\nLewito'},
        {'id': snow(t(4, 17, 25)), 'author': {'id': 'U'}, 'timestamp': t(4, 17, 25).isoformat(),
         'content': '🎙️ **Grabación** · 𝐅𝐫𝐞𝐞𝐬𝐭𝐲𝐥𝐞 · <#200000000000000000>\n11:17 PM ET · NaN min · 0 voces\n'
                    'Entró porque había 6 personas; salió porque se reinició el grabador.\nNo habló nadie: no hay audio.'},
        {'id': snow(t(1, 0, 25)), 'author': {'id': 'U'}, 'timestamp': t(1, 0, 25).isoformat(), 'edited_timestamp': t(2, 30, 25).isoformat(),
         'content': '⚠️ **No pude entrar a grabar** · FRZ · <#200000000000000000>\nIba a grabar porque había 7 personas. 3 intentos, el último a las 9:30 PM ET.\n'
                    'Por qué: ULAYA está **aislada (timeout)** en ese servidor hasta las 11:00 PM ET: alguien del staff.\nVuelvo a probar a las 11:00 PM ET.'},
        {'id': snow(t(3)), 'author': {'id': 'OTRO'}, 'timestamp': t(3).isoformat(),
         'content': '🎙️ **Grabación** · x · <#100000000000000000>\n1:00 PM ET · 1 h 0 min · 3 voces'},
    ]
    grabs, fallas = leer_logs(ms, 'U', {'100000000000000000': '111111111111111111', '200000000000000000': '222222222222222222'})
    ok(len(grabs) == 1 and grabs[0]['guild'] == '111111111111111111' and grabs[0]['fin'] - grabs[0]['ini'] == dt.timedelta(minutes=127),
       'una entrega es una grabación, con su servidor por el canal y lo que duró (y otro autor no cuenta)')
    ok(len(fallas) == 2 and {f['titulo'] for f in fallas} == {'entrega vacía', 'No pude entrar a grabar'}
       and 'aislada (timeout)' in next(f['porque'] for f in fallas if f['titulo'] != 'entrega vacía'),
       'la entrega vacía y el «No pude entrar» son fallas, con su por qué')
    ok(canales_de(ms, 'U') == {'100000000000000000', '200000000000000000'}, 'los canales a preguntar salen de las entregas y fallas')

    # 2 · las llaves: el link da servidor, canal y hora; la misma llave en las dos fuentes va una vez
    link = lambda g, c, x: 'https://discord.com/channels/%s/%s/%s' % (g, c, snow(x))
    t1 = {'1': {'sv': 'FFA', 'dia': '2026-11-21', 'nombre': 'A', 'links': [link('111111111111111111', '100000000000000000', t(3, 0, 22))]},
          '2': {'sv': 'FFA', 'dia': '2026-11-21', 'nombre': 'B', 'links': [link('111111111111111111', '101000000000000000', t(4, 40, 22))]},
          '3': {'sv': 'FRZ', 'dia': '2026-11-24', 'nombre': 'DEM', 'links': [link('222222222222222222', '200000000000000000', t(3, 30, 25))]},
          '4': {'sv': 'DW', 'dia': '2026-11-24', 'nombre': 'INICIO', 'links': [link('333333333333333333', '300000000000000000', t(1, 0, 25))]},
          '5': {'sv': 'CH', 'dia': '2026-11-24', 'nombre': 'VIEJO', 'links': [link('444444444444444444', '400000000000000000', t(1, 1, 25))]},
          '6': {'sv': 'SGR', 'dia': '2026-11-24', 'nombre': 'SIN BOT', 'links': [link('555555555555555555', '500000000000000000', t(1, 2, 25))]},
          '_leeme': 'texto'}
    ss = {'99': dict(t1['4'])}
    ls = llaves_de(t1, ss, {'2026-11-21', '2026-11-24'})
    ok(len(ls) == 6 and ls[0]['guild'] == '111111111111111111' and ls[0]['canal'] == '100000000000000000' and ls[0]['ts'][0] == t(3, 0, 22),
       'las llaves de los días pedidos, sin repetir la que está en las dos fuentes')
    svs = {'FFA': {'confirmado': True}, 'FRZ': {'confirmado': True}, 'DW': {'confirmado': True},
           'CH': {'confirmado': False}, 'SGR': {'confirmado': True}}
    res = auditar(ls, grabs, fallas, svs, bot_guilds={'111111111111111111', '222222222222222222', '333333333333333333', '444444444444444444'}, vivo={'4': False},
                  aisladas={'222222222222222222': t(4, 0, 25)})
    k = lambda xs: sorted(x['k'] for x in xs)
    ok(k(res['grabadas']) == ['1', '2'], 'una grabación cubre dos llaves del mismo servidor dentro del margen')
    ok(k(res['faltan']) == ['3', '4'] and k(res['sin_bot']) == ['5', '6'], 'faltan las de FRZ y DW; CH (no socio) y SGR (sin bot) van aparte')
    frz = next(x for x in res['faltan'] if x['k'] == '3')
    dw = next(x for x in res['faltan'] if x['k'] == '4')
    ok(any('aislada (timeout) ahí ahora' in c for c in frz['causas']) and any('no pude entrar' in c and 'aislada' in c for c in frz['causas'])
       and any('entrega vacía' in c for c in frz['causas']), 'FRZ: aislada ahora, el aviso de falla citado y la entrega vacía')
    ok(dw['causas'] == ['el canal de la llave no se leía en vivo (<#300000000000000000>)'], 'DW: el canal de la llave no se leía en vivo')
    res2 = auditar(ls, grabs, [], svs, bot_guilds=None)
    ok(next(x for x in res2['faltan'] if x['k'] == '4')['causas'] == ['sin causa conocida']
       and k(res2['sin_bot']) == ['5'], 'sin nada con qué decirlo: «sin causa conocida» (no se inventa); sin la lista del bot, nadie es «sin bot» por eso')
    # el margen: una llave 50 min después del final no es de esa grabación
    tarde = [{'k': 'x', 'sv': 'FFA', 'dia': '2026-11-21', 'nombre': 'T', 'guild': '111111111111111111', 'canal': '100000000000000000',
              'ts': [grabs[0]['fin'] + dt.timedelta(minutes=50)]}]
    ok(auditar(tarde, grabs, [], svs)['faltan'] and not auditar(tarde, grabs, [], svs, margen=60)['faltan'],
       'el margen de 45 min corta: a los 50 min del final ya no es de esa grabación')

    # 3 · el texto y la repetición
    msg = texto('2026-11-24', {k2: [x for x in v if x['dia'] == '2026-11-24'] for k2, v in res.items()})
    ok(msg.startswith('🎙️ **Auditoría de grabaciones** · 24/11') and '**FRZ** · DEM' in msg and '**DW** · INICIO' in msg
       and 'SIN BOT' in msg and 'VIEJO' not in msg and '@' not in msg,
       'el resumen: una línea por falta, el sin bot aparte, los no socios no; sin mencionar a nadie')
    ok(texto('2026-11-24', {'grabadas': [1], 'faltan': [], 'sin_bot': [dict(ls[4], por='no es socio confirmado')]}) == '',
       'si no faltó nada (y sólo hay no socios), no se manda nada')
    dos = [dict(frz, dia='2026-11-23'), frz, dw]
    ok(list(repetidos(dos)) == ['FRZ'], 'dos perdidos del mismo servidor en la ventana: se le avisa a Dlx; uno solo no')
    ok('ULAYA no grabó 2 eventos de FRZ' in texto_alerta('FRZ', repetidos(dos)['FRZ'], '2026-11-22', '2026-11-24'), 'el texto del DM')

    # 4 · cuándo toca
    ok(not toca({}, t(16)) and toca({}, t(17)) and not toca({'auditado': '2026-11-24'}, t(20)),
       'una vez por día, desde las 12 PM ET (11 AM ET no; 12 PM ET sí; ya hecho hoy, no)')
    ok(dias_atras('2026-11-23', 3) == ['2026-11-22'] and dias_atras('2026-11-26', 3) == ['2026-11-23', '2026-11-24', '2026-11-25'],
       'la ventana no pasa del 22/11, cuando arrancó la grabación en todos')
    ok(hora_de_id('1575009267331637330').strftime('%Y-%m-%d') == '2026-11-25', 'la hora de un snowflake')
    print('\n%s' % ('🔴 %d mal' % len(malos) if malos else '✅ auditar_grabaciones: todo bien'))
    return 1 if malos else 0


if __name__ == '__main__':
    if '--auto' in sys.argv:
        sys.exit(_self_check())
    dia = sys.argv[sys.argv.index('--dia') + 1] if '--dia' in sys.argv else None
    if '--ver' not in sys.argv and '--aplicar' not in sys.argv:
        print(__doc__)
        sys.exit(0)
    try:
        sys.exit(correr(ver='--ver' in sys.argv, dia=dia))
    except Exception as e:                                       # noqa: BLE001
        print('⚠️ la auditoría de grabaciones falló (%s: %s): se intenta en la próxima corrida' % (type(e).__name__, str(e)[:120]))
        sys.exit(0)
