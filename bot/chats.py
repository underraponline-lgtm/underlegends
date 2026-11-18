# -*- coding: utf-8 -*-
"""💬 LOS CHATS GENERALES DE CADA SERVIDOR, UNA VEZ POR DÍA (17/11/2026).

Dlx: *«que cada día se lean los mensajes que hubo en cada chat general de cada servidor… hacemos los comentarios más
realistas y vemos el comportamiento de cada uno… saber cosas que pasan en eventos, ver personas, actividad en la liga,
más estadísticas, e incluso si pasan cosas dramáticas ponerlas en las historias»*. A las preguntas: *«Todos, avisando»*
(cada servidor lo apaga en su panel), y de qué se guarda, *«los 2, pero sólo los mensajes importantes que signifiquen
algo, por ejemplo que uno está falsificando eventos»*. Esto REEMPLAZA a «3. C» del 27/09 (nada de rumores del chat).

Lo que hace (tanda 1):
  · lee el chat general de cada socio de la Liga donde está el bot, desde donde quedó (`datos/chats_cursor.json`; la
    primera vez, las últimas 24 h), con un tope por canal
  · `datos/chats_dia.json` (el repo es PÚBLICO): sólo NÚMEROS por día (hora del este) y servidor: mensajes, cuánta
    gente, por hora, quién habló y a quién se mencionó (por clave de perfil, sólo gente de la Lista)
  · los mensajes que IMPORTAN (`importante()`: eventos falsos o trucados, fraude, raids y estafas, quejas sobre la
    Liga) van al objeto (`/avisos/chats-ciclo`) y se ven sólo en el Dashboard, con el link al mensaje
  · el resto de los mensajes se lee y se tira: no se guarda en ningún lado
Tanda 2 (pendiente): los momentos fuertes a las historias, y la jerga y el estilo para los comentarios simulados.

⚠️ El chat general se elige con la MISMA regla que el vigía (`chatGeneralDe()` en bot/avisos.js): si se toca una, la otra.
⚠️ Apagado en el panel del socio (`cfg:<guild>.leer_chat === false`) = no se lee NADA de ese servidor. Si no se puede
   saber (sin Cloudflare), no se lee ninguno: callar es lo seguro.

    python bot/chats.py                # qué haría hoy, sin leer
    python bot/chats.py --aplicar      # lee si toca (una vez por día, desde las 12 PM ET) y guarda
    python bot/chats.py --aplicar --ya # lee aunque ya haya leído hoy
    python bot/chats.py --auto         # self-check, sin red
    python bot/chats.py --probar DRA   # lee las últimas 24 h de un servidor y dice qué saldría, sin guardar ni mandar
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
for _p in (SCR, BASE, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

API = 'https://discord.com/api/v10'
DIA = os.path.join(BASE, 'datos', 'chats_dia.json')
CURSOR = os.path.join(BASE, 'datos', 'chats_cursor.json')
#: desde qué hora (del este) se lee: después de la madrugada sin ciclo, con el día anterior entero adentro
DESDE_H = 12
#: tope de mensajes por canal y por lectura (un chat muy movido no puede comerse la corrida)
TOPE = 3000
#: cuántos días de números se guardan
DIAS = 35
#: lo importante: como mucho por servidor y en total, por lectura
MAX_SV, MAX_TOTAL = 10, 40
ET = None


def _et():
    global ET
    if ET is None:
        from zoneinfo import ZoneInfo
        ET = ZoneInfo('America/New_York')
    return ET


def _j(p, d):
    try:
        with io.open(p, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return d


def _guardar(p, x):
    with io.open(p, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(x, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write('\n')


# ── el chat general: la regla de `chatGeneralDe()` (bot/avisos.js) ───────────────────────────────────────────────────
STAFF = re.compile(r'staff|moderat|admin|organiz', re.I)
NO_CHAT = re.compile(r'\bbots?\b|comando|clip|meme|media|beat')


def _norm(s):
    return re.sub(r'[^a-z0-9]+', ' ', unicodedata.normalize('NFKD', str(s or '')).lower()).strip()


def chat_general(canales, fuera=()):
    """El id del chat general entre los canales de un servidor, o '': «general» antes que «chat» y que «charla» o
    «central», sólo de texto y nunca del staff (ni de las categorías `fuera`)."""
    fuera = {str(x) for x in fuera or ()}
    mejor, puntos = '', 0
    for c in canales or []:
        if c.get('type') != 0 or str(c.get('parent_id') or '') in fuera:
            continue
        n = _norm(c.get('name'))
        if STAFF.search(n) or NO_CHAT.search(n):
            continue
        p = 3 if re.search(r'\bgeneral\b', n) else 2 if re.search(r'\bchat\b', n) else 1 if re.search(r'\bcharla\b|\bcentral\b', n) else 0
        if p > puntos:
            mejor, puntos = str(c.get('id')), p
    return mejor


# ── lo que importa ─────────────────────────────────────────────────────────────────────────────────────────────────────
#: [(motivo, regex)], en orden: el primero que encaja es el motivo. Sobre el texto sin tildes y en minúsculas
IMPORTA = [
    ('evento falso', re.compile(r'evento(s)? (falso|fake|trucho|inventado|armado|arreglado)|llave (falsa|fake|trucha|inventada|arreglada)'
                                r'|(falsific|invent|fing)\w* (un |el |los |la |las )?(evento|llave|resultado|podio|veredicto)'
                                r'|no se jugo|nunca se jugo|no existio (el|ese) evento|resultado(s)? (falso|inventado|arreglado)')),
    ('fraude', re.compile(r'\b(fraude|amanad[oa]s?|tramposo|hizo trampa|hace trampa|multicuenta|doble cuenta|cuenta falsa|smurf|'
                          r'se cambio el nombre para|votos? (falsos|comprados)|bots? de votos|compro (los )?votos)\b')),
    ('seguridad', re.compile(r'\b(raid|raidear|raideo|hackearon|hackeo|me hackearon|phishing|token grabber|nitro gratis|free nitro|'
                             r'estafa|estafador|scam)\b')),
    ('queja de la liga', re.compile(r'(liga global|underlegends|el ranking|la pagina|/card|mi carta|mi tarjeta|los puntos)\W'
                                    r'(?:\w+\W+){0,6}?(no (me )?(aparece|sale|cuenta|suma|carga|anda)|esta mal|bug|robo|injust)')),
]


def importante(texto):
    """El motivo por el que un mensaje importa, o ''. Sólo con palabras: lo que no encaja se tira."""
    t = _norm(texto) + ' '
    t = re.sub(r'\s+', ' ', t)
    for motivo, rx in IMPORTA:
        if rx.search(t):
            return motivo
    return ''


# ── los números ────────────────────────────────────────────────────────────────────────────────────────────────────────
MENCION = re.compile(r'<@!?(\d{5,25})>')


def _ms(snowflake):
    return (int(snowflake) >> 22) + 1420070400000


def _snow(ms):
    return str((int(ms) - 1420070400000) << 22)


def contar(mensajes, por_id, dias=None):
    """`{dia ET: {msgs, gente, hora: [24], habla: {clave: n}, menciona: {clave: n}}}` de una lista de mensajes de un
    canal (`[{id, autor, bot, texto, menciona?}]`). Los bots no cuentan; las claves, sólo de gente de la Lista."""
    out = dias if dias is not None else {}
    gente = {}
    for m in mensajes:
        if m.get('bot'):
            continue
        d = dt.datetime.fromtimestamp(_ms(m['id']) / 1000, dt.timezone.utc).astimezone(_et())
        dia = d.strftime('%Y-%m-%d')
        x = out.setdefault(dia, {'msgs': 0, 'gente': 0, 'hora': [0] * 24, 'habla': {}, 'menciona': {}})
        x['msgs'] += 1
        x['hora'][d.hour] += 1
        gente.setdefault(dia, set()).add(str(m.get('autor')))
        k = por_id.get(str(m.get('autor')))
        if k:
            x['habla'][k] = x['habla'].get(k, 0) + 1
        for i in set(m.get('menciona') or MENCION.findall(m.get('texto') or '')):
            km = por_id.get(str(i))
            if km and km != k:
                x['menciona'][km] = x['menciona'].get(km, 0) + 1
    for dia, g in gente.items():
        out[dia]['gente'] = max(out[dia].get('gente', 0), len(g))
    return out


def _recortar(x, n=15):
    """Sólo los n de arriba de quién habla y a quién mencionan: el archivo no crece con todo el chat."""
    for c in ('habla', 'menciona'):
        x[c] = dict(sorted(x.get(c, {}).items(), key=lambda kv: (-kv[1], kv[0]))[:n])
    return x


# ── quién es quién ─────────────────────────────────────────────────────────────────────────────────────────────────────
def por_id():
    """`{discord_id: clave}` de la Lista (`datos/padron.json`)."""
    from comun.claves import clave
    out = {}
    for p in _j(os.path.join(BASE, 'datos', 'padron.json'), []) or []:
        did = str((p or {}).get('discord_id') or '').strip()
        if did and p.get('raw'):
            out[did] = clave(p['raw'])
    return out


# ── cuándo toca ────────────────────────────────────────────────────────────────────────────────────────────────────────
def toca(estado, ahora=None):
    """Una vez por día, desde las `DESDE_H` del este."""
    a = (ahora or dt.datetime.now(dt.timezone.utc)).astimezone(_et())
    return a.hour >= DESDE_H and (estado or {}).get('leido') != a.strftime('%Y-%m-%d')


# ── Discord ────────────────────────────────────────────────────────────────────────────────────────────────────────────
def _sesion():
    import requests
    import avisar
    t = avisar._token()
    if not t:
        return None
    s = requests.Session()
    s.headers.update({'Authorization': 'Bot ' + t, 'User-Agent': 'LigaGlobalBot (chats, 1.0)'})
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
            time.sleep(espera + 0.5)
            continue
        return r
    return None


def leer(s, canal, desde_id, tope=TOPE):
    """Los mensajes del canal después de `desde_id`, del más viejo al más nuevo (`[{id, autor, bot, texto, menciona}]`),
    hasta `tope`. Pagina hacia atrás desde el más nuevo, como `leer_veredictos()` de escuchar.py."""
    out, antes = [], None
    while len(out) < tope:
        params = {'limit': 100}
        if antes:
            params['before'] = antes
        r = _get(s, '%s/channels/%s/messages' % (API, canal), params=params)
        if r is None or r.status_code != 200:
            break
        pag = r.json() or []
        listo = False
        for m in pag:
            if int(m['id']) <= int(desde_id):
                listo = True
                break
            a = m.get('author') or {}
            out.append({'id': m['id'], 'autor': str(a.get('id') or ''), 'bot': bool(a.get('bot')), 'nombre': a.get('global_name') or a.get('username') or '',
                        'texto': m.get('content') or '', 'menciona': [str(u.get('id')) for u in m.get('mentions') or []]})
        if listo or len(pag) < 100:
            break
        antes = pag[-1]['id']
        time.sleep(0.3)
    out.reverse()
    return out[-tope:]


def _apagado(gid):
    """True si ese servidor lo apagó en su panel, None si no se puede saber."""
    try:
        import subir_datos as SD
        kv = SD.sesion()
        r = kv.get('%s/values/cfg:%s' % (SD.API, gid), timeout=20)
    except Exception:                                    # noqa: BLE001
        return None
    if r.status_code == 404:
        return False
    if r.status_code != 200:
        return None
    try:
        return (r.json() or {}).get('leer_chat') is False
    except ValueError:
        return None


def servidores():
    """`[(sigla, guild_id)]`: los socios de la Liga donde está el bot."""
    import tiers
    svs = (_j(os.path.join(BASE, 'datos', 'servidores.json'), {}) or {}).get('servidores') or {}
    en = set(_j(os.path.join(BASE, 'datos', 'bot_en.json'), []) or [])
    return [(sv, str(svs[sv].get('guild_id'))) for sv in sorted(tiers.niveles(svs)) if sv in en and svs.get(sv, {}).get('guild_id')]


def _mandar(x):
    import requests
    import clave_ciclo as CC
    import avisar
    from alertar import WORKER
    tok = avisar._token()
    if not tok:
        return False
    try:
        r = requests.post(WORKER + '/avisos/chats-ciclo', headers={'x-lg-ciclo': CC.clave(tok), 'content-type': 'application/json'},
                          data=json.dumps(x, ensure_ascii=False).encode('utf-8'), timeout=25)
    except requests.RequestException:
        return False
    if r.status_code != 200:
        print('   ⚠️ lo importante no llegó al Dashboard (%s)' % r.status_code)
    return r.status_code == 200


def correr(aplicar=False, ya=False):
    estado = _j(DIA, {}) or {}
    if not ya and not toca(estado):
        print('   💬 los chats generales: hoy ya se leyeron, o todavía no son las %d ET' % DESDE_H)
        return 0
    svs = servidores()
    if not aplicar:
        print('   💬 los chats generales: tocaría leer %d servidores (%s)' % (len(svs), ', '.join(s for s, _ in svs)))
        return 0
    s = _sesion()
    if not s:
        print('   ⚠️ sin DISCORD_TOKEN: no se leen los chats')
        return 0
    import escuchar
    cursor = _j(CURSOR, {}) or {}
    pid = por_id()
    dias = estado.get('dias') or {}
    marcados, por_sv, leidos = [], {}, []
    hace24 = _snow(int(time.time() * 1000) - 24 * 3600 * 1000)
    for sv, gid in svs:
        ap = _apagado(gid)
        if ap is None:
            print('   ⚠️ %s: no sé si lo apagaron (sin Cloudflare): no se lee' % sv)
            continue
        if ap:
            print('   💬 %s: apagado en su panel' % sv)
            continue
        r = _get(s, '%s/guilds/%s/channels' % (API, gid))
        if r is None or r.status_code != 200:
            print('   ⚠️ %s: no pude ver sus canales' % sv)
            continue
        cs = r.json() or []
        canal = chat_general(cs, escuchar.categorias_staff(cs) | escuchar.categorias_fuera(gid))
        if not canal:
            print('   💬 %s: sin chat general' % sv)
            continue
        ms = leer(s, canal, cursor.get(canal) or hace24)
        if ms:
            cursor[canal] = ms[-1]['id']
        nuevos = contar(ms, pid)
        for dia, x in nuevos.items():
            y = dias.setdefault(dia, {}).setdefault(sv, {'msgs': 0, 'gente': 0, 'hora': [0] * 24, 'habla': {}, 'menciona': {}})
            y['msgs'] += x['msgs']
            y['gente'] = max(y.get('gente', 0), x['gente'])
            y['hora'] = [a + b for a, b in zip(y.get('hora') or [0] * 24, x['hora'])]
            for c in ('habla', 'menciona'):
                for k, n in x[c].items():
                    y[c][k] = y[c].get(k, 0) + n
            _recortar(y)
        imp = []
        for m in ms:
            mot = '' if m['bot'] else importante(m['texto'])
            if mot:
                imp.append({'sv': sv, 'g': gid, 'c': canal, 'id': m['id'], 'autor': m['autor'], 'n': m['nombre'][:40],
                            'k': pid.get(m['autor'], ''), 't': _ms(m['id']), 'texto': m['texto'][:400], 'motivo': mot})
        marcados += imp[-MAX_SV:]
        por_sv[sv] = {'msgs': len([m for m in ms if not m['bot']]), 'marcados': len(imp)}
        leidos.append(sv)
        print('   💬 %s: %d mensajes, %d que importan' % (sv, por_sv[sv]['msgs'], len(imp)))
    marcados = sorted(marcados, key=lambda m: m['t'])[-MAX_TOTAL:]
    hoy = dt.datetime.now(dt.timezone.utc).astimezone(_et()).strftime('%Y-%m-%d')
    corte = (dt.datetime.now(dt.timezone.utc).astimezone(_et()) - dt.timedelta(days=DIAS)).strftime('%Y-%m-%d')
    estado = {'leido': hoy, 'servidores': leidos, 'dias': {d: v for d, v in sorted(dias.items()) if d >= corte}}
    _guardar(DIA, estado)
    _guardar(CURSOR, cursor)
    if leidos:
        _mandar({'dia': hoy, 'por_sv': por_sv, 'marcados': marcados})
    print('   💬 los chats generales: %d servidores leídos, %d mensajes que importan' % (len(leidos), len(marcados)))
    return 0


def _self_check():
    malos = 0

    def ok(c, que):
        nonlocal malos
        print('  %s %s' % ('✅' if c else '❌', que))
        if not c:
            malos += 1
    cs = [{'id': '1', 'type': 4, 'name': '🛡️ STAFF'}, {'id': '2', 'type': 0, 'name': 'general-staff', 'parent_id': '1'},
          {'id': '3', 'type': 0, 'name': '「💬」chat'}, {'id': '4', 'type': 0, 'name': '𝐆𝐄𝐍𝐄𝐑𝐀𝐋'}, {'id': '5', 'type': 2, 'name': 'general'},
          {'id': '6', 'type': 0, 'name': 'bots-general'}]
    ok(chat_general(cs) == '4' and chat_general(cs[:3]) == '3' and chat_general([{'id': '9', 'type': 0, 'name': '「🌏」CENTRAL-FFS'}]) == '9'
       and chat_general([{'id': '7', 'type': 0, 'name': 'general', 'parent_id': '8'}], {'8'}) == '' and chat_general([]) == '',
       'el chat general: «general» antes que «chat» y que «central», en negrita matemática también, nunca del staff ni de bots')
    ok(importante('ese evento es falso, nunca se jugo') == 'evento falso' and importante('Falsificó los resultados del podio') == 'evento falso'
       and importante('tiene multicuenta para votar') == 'fraude' and importante('NITRO GRATIS click aca') == 'seguridad'
       and importante('en la liga global no me aparece mi carta') == 'queja de la liga'
       and importante('qué buena batalla, falso el que no la vio') == '' and importante('jaja que trampa la vida') == ''
       and importante('tramposo, hizo trampa en la final') == 'fraude' and importante('hola gente') == '' and importante('') == '',
       'lo que importa: eventos falsos, fraude, seguridad y quejas de la Liga; lo demás se tira')
    base = int(dt.datetime(2026, 11, 17, 18, 0, tzinfo=dt.timezone.utc).timestamp() * 1000)
    ms = [{'id': _snow(base), 'autor': '11111', 'texto': 'hola <@22222>'}, {'id': _snow(base + 60000), 'autor': '22222', 'texto': 'hola'},
          {'id': _snow(base + 120000), 'autor': '99999', 'bot': True, 'texto': 'soy un bot'},
          {'id': _snow(base + 180000), 'autor': '33333', 'texto': 'x', 'menciona': ['11111', '11111']}]
    c = contar(ms, {'11111': 'ana', '22222': 'bea'})
    x = c.get('2026-11-17') or {}
    ok(x.get('msgs') == 3 and x.get('gente') == 3 and x['hora'][13] == 3 and x['habla'] == {'ana': 1, 'bea': 1}
       and x['menciona'] == {'bea': 1, 'ana': 1},
       'los números: los bots no cuentan, la hora es del este, sólo claves de la Lista, cada mención una vez por mensaje')
    ok(len(_recortar({'habla': {str(i): i for i in range(30)}, 'menciona': {}})['habla']) == 15, 'sólo los 15 de arriba viajan al repo')
    t11 = dt.datetime(2026, 11, 17, 16, 30, tzinfo=dt.timezone.utc)   # 11:30 AM ET
    t13 = dt.datetime(2026, 11, 17, 18, 0, tzinfo=dt.timezone.utc)    # 1 PM ET
    ok(not toca({}, t11) and toca({}, t13) and not toca({'leido': '2026-11-17'}, t13) and toca({'leido': '2026-11-16'}, t13),
       'una vez por día, desde las 12 del este')
    ok(_ms(_snow(base)) == base, 'el snowflake ida y vuelta')
    with io.open(os.path.join(BASE, 'bot', 'ci', 'guardar.sh'), encoding='utf-8') as f:
        g = f.read()
    ok('datos/chats_dia.json' in g and 'datos/chats_cursor.json' in g, 'los dos archivos van en ARCHIVOS de guardar.sh (si no, cada corrida lee de nuevo)')
    with io.open(os.path.join(BASE, 'bot', 'avisos.js'), encoding='utf-8') as f:
        js = f.read()
    ok("bots?\\b|comando|clip|meme|media|beat" in js and 'charla\\b|\\bcentral' in js,
       'la regla del chat general es la misma que la de chatGeneralDe() en avisos.js')
    print('\n%s' % ('✅ los chats generales' if not malos else '❌ %d falla(s)' % malos))
    return 1 if malos else 0


def probar(sv):
    """Lee las últimas 24 h de UN servidor y muestra los números y cuántos importan (con su motivo, sin el texto). No
    guarda ni manda nada."""
    import escuchar
    s = _sesion()
    gid = dict(servidores()).get(sv.upper())
    if not s or not gid:
        print('   sin token o %s no es un socio con el bot' % sv)
        return 1
    print('   apagado en su panel: %s' % _apagado(gid))
    cs = (_get(s, '%s/guilds/%s/channels' % (API, gid)).json() or [])
    canal = chat_general(cs, escuchar.categorias_staff(cs) | escuchar.categorias_fuera(gid))
    nombre = next((c.get('name') for c in cs if str(c.get('id')) == canal), '')
    print('   chat general: #%s' % nombre)
    ms = leer(s, canal, _snow(int(time.time() * 1000) - 24 * 3600 * 1000))
    for dia, x in sorted(contar(ms, por_id()).items()):
        _recortar(x, 5)
        print('   %s: %d mensajes, %d personas, hablan %s' % (dia, x['msgs'], x['gente'], x['habla']))
    mot = {}
    for m in ms:
        k = '' if m['bot'] else importante(m['texto'])
        if k:
            mot[k] = mot.get(k, 0) + 1
    print('   que importan: %s' % (mot or 'ninguno'))
    return 0


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:                                    # noqa: BLE001
        pass
    a = sys.argv[1:]
    if '--auto' in a:
        return _self_check()
    if '--probar' in a:
        i = a.index('--probar')
        return probar(a[i + 1] if i + 1 < len(a) else 'DRA')
    return correr(aplicar='--aplicar' in a, ya='--ya' in a)


if __name__ == '__main__':
    sys.exit(main())
