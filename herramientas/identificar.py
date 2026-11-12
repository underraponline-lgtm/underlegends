# -*- coding: utf-8 -*-
"""🔎 BUSCAR DE FRENTE, EN TODOS LOS SERVIDORES, LA CUENTA DE DISCORD DE QUIEN JUGÓ SIN ID.

    python herramientas/identificar.py --bajar [--env=<.env>]   baja miembros y mensajes (SÓLO LEE Discord)
    python herramientas/identificar.py                          cruza lo bajado: candidatos + prueba con los conocidos
    python herramientas/identificar.py --auto                   el self-check, sin red

Dlx, 12/11/2026: *«Quiero que hagas una autoidentificación de usuarios en general… al identificar usuarios quiero que
te tomes tu tiempo»*, y al plan: *«como tiene permisos de bot en la mayoría de servidores haz que busques tú también
usuarios así de frente»*.

⚠️ ESTO ES LA FASE 1: NO ESCRIBE NADA. Ni la Lista, ni KV, ni un rol. Baja a `.cache/identificar/` (gitignoreado: son
nombres de Discord y mensajes de otros servidores, nunca al repo) y deja ahí un informe privado. Poner un ID equivocado
es peor que no tenerlo: el bot le muestra a alguien la carta de otro (`herramientas/ids_cruzados.py`).

POR QUÉ HACÍA FALTA (medido el 12/11/2026, antes de escribir esto)
------------------------------------------------------------------
De 743 que jugaron la T1, 207 no tienen Discord ID. El ciclo baja cada media hora los miembros de 17 servidores y NO
le pone ID a nadie (`bot/autoverificar.py`: «los IDs por nombre siguen a mano»). Y una sola pista no alcanza:
nombre exacto en los servidores 11 de 207 (varios dudosos), inscripción propia 8, menciones en llaves 0.

O sea que esto JUNTA PRUEBAS, y cada prueba sola vale poco:

    insc      la cuenta escribió ese nombre sola, en un canal de ese servidor (inscripciones o el de la llave)
    menc      un renglón con ese nombre y UNA mención: el host diciendo «este es este»
    usuario   el usuario de Discord es ese nombre (es único en Discord)
    apodo     el apodo del servidor o el nombre visible es ese nombre (no es único: cualquiera se lo pone)
    parecido  una variante: sin números al final, sin letras repetidas, leet, o contenido (5+ letras)
    bandera   la bandera de su rol o de su apodo coincide con la del padrón (+) o es OTRA (veta)
    está      la cuenta está HOY en el servidor donde jugó (sin esto no hay «seguro»)

LAS GUARDAS, QUE SON LAS QUE YA COSTARON SANGRE
-----------------------------------------------
· Quien anota a otros (3+ personas distintas escritas por la misma cuenta) no prueba nada: el staff de un servidor
  anotó a dos personas distintas y la Lista tenía su ID en una de ellas (29/09/2026).
· Una pareja («A + B», «A y B», «A vs B») no es una inscripción de nadie.
· Un ID que ya es de otra fila de la Lista no se propone nunca (así se coló «Lord» con el de «Lord Viruzz»).
· Banderas distintas: nunca ([[bandera-no-siempre-decoracion]]).
· Nombres de menos de 4 letras: sólo con inscripción o mención, nunca por nombre.
· Una cuenta que es la mejor para DOS personas no es de ninguna hasta que alguien decida.
· `identidades.json`: `no_verificar` no se toca; `no_fusionar` y `ambiguos_preguntar` van a revisión.

🧪 Y LA REGLA SE PRUEBA CON LOS QUE YA SABEMOS: a los que jugaron la T1 y TIENEN ID se los corre como si no lo
tuvieran, y se cuenta cuántas veces el «seguro» elige la misma cuenta. ⚠️ Con un sesgo que hay que decir: muchos de
esos IDs salieron justamente por nombre exacto (`cruzar_miembros.py`), así que la prueba favorece al nombre.
"""
import collections
import datetime
import io
import json
import os
import re
import sys
import threading
import time
import unicodedata

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (os.path.join(BASE, 'sheet'), os.path.join(BASE, 'bot'), BASE):
    if _p not in sys.path:
        sys.path.insert(0, _p)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

API = 'https://discord.com/api/v10'
DIR = os.path.join(BASE, '.cache', 'identificar')
MIEMBROS = os.path.join(DIR, 'miembros.json')
MENSAJES = os.path.join(DIR, 'mensajes.json')
INFORME = os.path.join(DIR, 'informe.json')
INFORME_MD = os.path.join(DIR, 'informe.md')

#: desde cuándo se leen los canales: el arranque de la T1, con un día antes para las inscripciones del primero
DESDE = '2026-09-21T00:00:00+00:00'
#: cuántos mensajes como mucho por canal (un chat que se usa de inscripciones puede tener miles)
TOPE_CANAL = 30000

BANDERA = re.compile('[\U0001F1E6-\U0001F1FF]{2}')
MENCION = re.compile(r'<@!?(\d{15,21})>')
PAREJA = re.compile(r'\+|&|\s(?:y|vs|v/s|x)\s', re.I)
LEET = str.maketrans('0134578@$', 'oieastbas')

PUNTOS = {'insc': 2.0, 'insc2': 3.0, 'menc': 2.0, 'usuario': 2.0, 'apodo': 1.5, 'parecido': 0.5, 'bandera': 1.0}


# ── normalizar ──────────────────────────────────────────────────────────────────────────────────────────────────────
def norm(s):
    """La de `construir_padron.norm()` (NFKD: las letras decoradas cruzan), sin banderas, alfanumérico y minúsculas."""
    s = BANDERA.sub('', str(s or '')).replace('❓', '')
    # NFKD ANTES de minúsculas: `'𝐋'.lower()` sigue siendo `𝐋` (la negrita matemática no tiene minúscula)
    s = unicodedata.normalize('NFKD', s.strip()).lower()
    return ''.join(c for c in s if c.isalnum())


def cc_de(texto):
    """Los códigos de país de las banderas del texto."""
    return {''.join(chr(ord(c) - 0x1F1E6 + 97) for c in m) for m in BANDERA.findall(str(texto or ''))}


def segmentos(nombre):
    """Un apodo de servidor trae etiquetas: «🐉 | Liberia», «[FFA] Benji», «Benji ~ staff». El nombre entero y cada
    pedazo entre separadores, normalizados."""
    out = {norm(nombre)}
    for p in re.split(r'[|\]\[()\-~·•:/\\]+', str(nombre or '')):
        if len(norm(p)) >= 3:
            out.add(norm(p))
    out.discard('')
    return out


def variantes(n):
    """Las formas «parecidas» de un nombre normalizado: sin números al final, sin letras repetidas, leet."""
    out = set()
    a = re.sub(r'\d+$', '', n)
    if len(a) >= 4:
        out.add(a)
    b = re.sub(r'(.)\1+', r'\1', n)
    if len(b) >= 4:
        out.add(b)
    c = n.translate(LEET)
    if len(c) >= 4:
        out.add(c)
    d = re.sub(r'(.)\1+', r'\1', re.sub(r'\d+$', '', n.translate(LEET)))
    if len(d) >= 4:
        out.add(d)
    out.discard(n)
    return out


def nombre_de_mensaje(txt):
    """El nombre que alguien escribió para anotarse, o `''` si eso no es anotarse: sin menciones ni banderas, sin lo
    de entre paréntesis (el pokémon), sin pregunta, sin pareja, hasta 40 letras."""
    t = MENCION.sub(' ', str(txt or '')).strip()
    if not t or '?' in t or '\n' in t.strip() or len(t) > 60:
        return ''
    t = re.sub(r'\([^)]*\)', ' ', t)
    if PAREJA.search(' %s ' % t):
        return ''
    n = norm(t)
    return n if 2 <= len(n) <= 40 else ''


def renglones_con_mencion(txt):
    """`[(nombre normalizado, id)]` de los renglones con UNA sola mención y un nombre: «Benji <@123>»,
    «1. Benji 🇦🇷 @…», «Batalla 2: Benji <@123>». Dos menciones en un renglón no dicen cuál es cuál."""
    out = []
    for l in str(txt or '').splitlines():
        ids = MENCION.findall(l)
        if len(set(ids)) != 1:
            continue
        resto = MENCION.sub(' ', l)
        resto = re.sub(r'^\W*\d+\s*[.)\-:]\s*', '', resto.strip())
        resto = resto.split(':')[-1]
        if PAREJA.search(' %s ' % resto):
            continue
        n = norm(re.sub(r'\([^)]*\)', ' ', resto))
        if 2 <= len(n) <= 40:
            out.append((n, ids[0]))
    return out


def ms_de(snowflake):
    return (int(snowflake) >> 22) + 1420070400000


def snowflake_de(iso):
    t = datetime.datetime.fromisoformat(iso).timestamp() * 1000
    return str((int(t) - 1420070400000) << 22)


def fecha_et(ms):
    from zoneinfo import ZoneInfo
    return datetime.datetime.fromtimestamp(ms / 1000, ZoneInfo('America/New_York')).strftime('%d/%m %I:%M %p')


# ── bajar (sólo leer Discord) ───────────────────────────────────────────────────────────────────────────────────────
def _token():
    ruta = next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--env=')), os.path.join(BASE, '.env'))
    for l in io.open(ruta, encoding='utf-8'):
        if l.strip().startswith('DISCORD_TOKEN='):
            return l.split('=', 1)[1].strip().strip('"\'')
    sys.exit('falta DISCORD_TOKEN en %s' % ruta)


def _get(s, ruta, params=None):
    for _ in range(8):
        try:
            r = s.get(API + ruta, params=params, timeout=40)
        except Exception:                                                     # noqa: BLE001
            time.sleep(3)
            continue
        if r.status_code == 429:
            try:
                ra = float(r.json().get('retry_after', 1))
            except Exception:                                                 # noqa: BLE001
                ra = 2
            time.sleep(ra + .3)
            continue
        if r.status_code != 200:
            return r.status_code, None
        return 200, r.json()
    return 0, None


def _sesion(token):
    import requests
    s = requests.Session()
    s.headers['Authorization'] = 'Bot ' + token
    return s


def bajar_miembros(s):
    """`{guild: {nombre, roles_cc: {rol: cc}, ms: {id: [usuario, visible, apodo, [roles]]}}}` de TODOS los servidores
    donde está el bot, no sólo los del catálogo: los de «sólo identidad» (LIVONIA, CONFED…) existen para esto."""
    _, gs = _get(s, '/users/@me/guilds', {'limit': 200})
    out = {}
    for g in gs or []:
        gid = g['id']
        _, roles = _get(s, '/guilds/%s/roles' % gid)
        rc = {x['id']: sorted(cc_de(x.get('name')))[0] for x in (roles or []) if cc_de(x.get('name'))}
        ms, after = {}, '0'
        while True:
            st, lote = _get(s, '/guilds/%s/members' % gid, {'limit': 1000, 'after': after})
            if st != 200 or not lote:
                if st != 200:
                    print('   ⚠️ %s: no pude listar los miembros (%s)' % (g.get('name', gid)[:30], st))
                break
            for m in lote:
                u = m.get('user') or {}
                if u.get('bot'):
                    continue
                ms[u['id']] = [u.get('username') or '', u.get('global_name') or '', m.get('nick') or '',
                               m.get('roles') or [], m.get('joined_at') or '']
            # `key=int`: los snowflakes de 17, 18 y 19 dígitos no se comparan como texto (ver cruzar_miembros.py)
            after = max(((x.get('user') or {}).get('id', '0') for x in lote), key=int)
            if len(lote) < 1000:
                break
        out[gid] = {'nombre': g.get('name', ''), 'roles_cc': rc, 'ms': ms}
        print('   %-34s %6d miembros' % (g.get('name', '')[:34], len(ms)))
    return out


def canales_a_leer(s):
    """`{canal: (sv, guild, tipo)}`: los de inscripciones y eventos de cada servidor del catálogo (la misma regla que el
    lector de anuncios, sin los de staff) y el canal de cada llave de la T1 (sus links)."""
    import anuncios as AN
    out = {}
    for cid, _n, cod, tipo, gid, _cat in AN.canales(s):
        out[str(cid)] = (cod, str(gid), tipo)
    with io.open(os.path.join(BASE, 'datos', 'llaves_t1.json'), encoding='utf-8') as f:
        ll = json.load(f)
    for v in ll.values():
        for link in v.get('links') or []:
            m = re.search(r'channels/(\d+)/(\d+)/', link)
            if m and m.group(2) not in out:
                out[m.group(2)] = (v.get('sv', ''), m.group(1), 'llave')
    return out


def bajar_canal(token, cid, desde, tope=TOPE_CANAL):
    """Los mensajes del canal desde `desde`, de a 100 y hacia adelante. Compactos: [id, autor, usuario, visible, es
    bot, texto]. Nada más: ni adjuntos, ni reacciones."""
    s = _sesion(token)
    out, after = [], snowflake_de(desde)
    while len(out) < tope:
        st, lote = _get(s, '/channels/%s/messages' % cid, {'limit': 100, 'after': after})
        if st != 200 or not lote:
            return out, st
        for m in sorted(lote, key=lambda x: int(x['id'])):
            a = m.get('author') or {}
            out.append([m['id'], a.get('id', ''), a.get('username', ''), a.get('global_name') or '',
                        bool(a.get('bot')), m.get('content') or ''])
        after = max((x['id'] for x in lote), key=int)
        if len(lote) < 100:
            break
    return out, 200


INSCR_GIT = os.path.join(DIR, 'inscripciones_git.json')


def inscripciones_de_git():
    """🔴 LOS ORGANIZADORES VACÍAN EL CANAL DE INSCRIPCIONES DESPUÉS DE CADA EVENTO. Medido el 12/11/2026: de las 4.000
    que guardaba `datos/anuncios.json`, en Discord quedaban 813. Lo único que se acuerda de las demás es el HISTORIAL
    del repo: cada corrida guardó las últimas 4.000 (`anuncios.TOPE_INSCR`), así que una versión por día las junta
    todas desde el 24/09 (el primer commit del repo público). Sin red: `git show`."""
    import subprocess
    if os.path.exists(INSCR_GIT) and '--historia' not in sys.argv:
        with io.open(INSCR_GIT, encoding='utf-8') as f:
            return json.load(f)
    log = subprocess.run(['git', 'log', '--format=%H %cs', '--', 'datos/anuncios.json'], cwd=BASE,
                         capture_output=True, text=True, check=True).stdout.split('\n')
    vistos, dias = {}, set()
    for l in log:
        if not l.strip():
            continue
        h, dia = l.split()
        if dia in dias:
            continue
        dias.add(dia)
        crudo = subprocess.run(['git', 'show', '%s:datos/anuncios.json' % h], cwd=BASE, capture_output=True,
                               check=True).stdout.decode('utf-8')
        try:
            for i in json.loads(crudo).get('inscripciones') or []:
                if i.get('msg_id') and i.get('discord_id'):
                    vistos.setdefault(i['msg_id'], i)
        except ValueError:
            continue
    out = sorted(vistos.values(), key=lambda i: int(i['msg_id']))
    os.makedirs(DIR, exist_ok=True)
    with io.open(INSCR_GIT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False)
    print('   %d inscripciones del historial (%d versiones, una por día)' % (len(out), len(dias)))
    return out


def bajar():
    from concurrent.futures import ThreadPoolExecutor
    token = _token()
    s = _sesion(token)
    os.makedirs(DIR, exist_ok=True)
    print('\n1. los miembros de todos los servidores donde está el bot')
    mi = bajar_miembros(s)
    with io.open(MIEMBROS, 'w', encoding='utf-8') as f:
        json.dump(mi, f, ensure_ascii=False)
    print('   total: %d cuentas en %d servidores' % (len({d for g in mi.values() for d in g['ms']}), len(mi)))

    print('\n2. los canales de inscripciones, de eventos y de cada llave, desde %s' % DESDE[:10])
    cs = canales_a_leer(s)
    print('   %d canales' % len(cs))
    res, lock, hechos = {}, threading.Lock(), [0]

    def uno(cid):
        ms, st = bajar_canal(token, cid, DESDE)
        with lock:
            hechos[0] += 1
            res[cid] = {'sv': cs[cid][0], 'guild': cs[cid][1], 'tipo': cs[cid][2], 'st': st, 'ms': ms}
            if hechos[0] % 20 == 0 or len(ms) >= TOPE_CANAL:
                print('   %d/%d canales…%s' % (hechos[0], len(cs), ' (uno llegó al tope)' if len(ms) >= TOPE_CANAL else ''))

    with ThreadPoolExecutor(6) as ex:
        list(ex.map(uno, list(cs)))
    with io.open(MENSAJES, 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False)
    print('   %d mensajes; %d canales sin acceso' % (sum(len(v['ms']) for v in res.values()),
                                                   sum(1 for v in res.values() if v['st'] != 200)))


# ── cruzar ──────────────────────────────────────────────────────────────────────────────────────────────────────────
def _json(rel):
    with io.open(os.path.join(BASE, rel), encoding='utf-8') as f:
        return json.load(f)


def cargar_liga():
    """Lo nuestro: la Lista (padrón), quién jugó qué y dónde, los alias y las reglas de identidad."""
    import construir_akas as AK
    pad = _json('datos/padron.json')
    srv = _json('datos/servidores.json')
    gid_de = {k: v.get('guild_id') for k, v in srv['servidores'].items()}
    res = _json('datos/t1_resultados.json')['filas']
    jugo = collections.defaultdict(lambda: {'sv': collections.Counter(), 'ev': set(), 'cc': set()})
    for f in res:
        j = jugo[norm(f[4])]
        j['sv'][f[2]] += 1
        j['ev'].add(f[0])
        if f[5]:
            j['cc'].add(str(f[5]).lower())
    ak = AK.cargar() or {}
    alias = collections.defaultdict(set)
    for k, v in (ak.get('alias') or {}).items():
        alias[norm(v)].add(norm(k))
    for a, r in ak.get('pares') or []:
        alias[norm(r)].add(norm(a))
    ident = _json('datos/identidades.json')
    return {'pad': pad, 'gid_de': gid_de, 'jugo': jugo, 'alias': alias, 'ident': ident,
            'sv_de_gid': {v: k for k, v in gid_de.items()}}


def cc_padron(p, jugo):
    out = set(cc_de(p.get('full')))
    try:
        import padron_t1 as PT
        c = (PT.PAIS_ISO.get(p.get('pais') or '') or '').lower()
        if c:
            out.add(c)
    except Exception:                                                         # noqa: BLE001
        pass
    return out | (jugo.get(norm(p['raw']), {}).get('cc') or set())


def indices(mi, msj, liga):
    """Lo que se pregunta mil veces, armado una sola: forma -> cuentas, y las pruebas de los mensajes."""
    por_usuario, por_apodo, por_variante = (collections.defaultdict(set) for _ in range(3))
    cuenta = {}                       # id -> {'u', 'g', 'apodos': {gid: apodo}, 'cc', 'en': set(gid)}
    for gid, g in mi.items():
        rc = g['roles_cc']
        for did, (u, gl, nick, roles, _j) in g['ms'].items():
            c = cuenta.setdefault(did, {'u': u, 'g': gl, 'apodos': {}, 'cc': set(), 'en': set()})
            c['en'].add(gid)
            if nick:
                c['apodos'][gid] = nick
            c['cc'] |= {rc[r] for r in roles if r in rc} | cc_de(nick) | cc_de(gl)
            por_usuario[norm(u)].add(did)
            for x in (gl, nick):
                for sgm in segmentos(x):
                    por_apodo[sgm].add(did)
            for x in (u, gl, nick):
                for sgm in segmentos(x):
                    for v in variantes(sgm):
                        por_variante[v].add(did)
    # las inscripciones: quién escribió qué nombre, en qué servidor (con el link)
    escrito = collections.defaultdict(list)        # (forma, autor) -> [(sv, ms, link)]
    autores_de = collections.defaultdict(set)      # autor -> formas que escribió
    menciones = collections.defaultdict(list)      # (forma, id) -> [(sv, ms, link)]
    for cid, c in msj.items():
        for mid, autor, _u, _g, es_bot, txt in c['ms']:
            link = 'https://discord.com/channels/%s/%s/%s' % (c['guild'], cid, mid)
            if not es_bot:
                n = nombre_de_mensaje(txt)
                if n:
                    escrito[(n, autor)].append((c['sv'], ms_de(mid), link))
                    autores_de[autor].add(n)
            for n, did in renglones_con_mencion(txt):
                menciones[(n, did)].append((c['sv'], ms_de(mid), link))
    # y las que el canal ya borró, del historial del repo (las que siguen en Discord no se cuentan dos veces)
    leidos = {m[0] for c in msj.values() for m in c['ms']}
    guild_de = liga['gid_de']
    for i in liga.get('inscr_git') or []:
        if i['msg_id'] in leidos:
            continue
        n = nombre_de_mensaje(i.get('texto'))
        if n:
            link = 'borrado:%s' % i.get('canal', '')
            escrito[(n, i['discord_id'])].append((i.get('servidor', ''), ms_de(i['msg_id']), link))
            autores_de[i['discord_id']].add(n)
    largos = collections.defaultdict(set)
    for did, c in cuenta.items():
        for x in [c['u'], c['g']] + list(c['apodos'].values()):
            for sg in segmentos(x):
                if len(sg) >= 5:
                    largos[sg].add(did)
    return {'usuario': por_usuario, 'apodo': por_apodo, 'variante': por_variante, 'cuenta': cuenta,
            'segmentos_largos': list(largos.items()),
            'escrito': escrito, 'autores_de': autores_de, 'menciones': menciones}


def anotadores(ix, personas_formas):
    """Las cuentas que escribieron 3+ PERSONAS distintas de la Liga: anotan a otros, no se anotan."""
    persona_de = {}
    for raw, fs in personas_formas.items():
        for f in fs:
            persona_de.setdefault(f, set()).add(raw)
    out = set()
    for autor, fs in ix['autores_de'].items():
        gente = set()
        for f in fs:
            gente |= persona_de.get(f, set())
        if len(gente) >= 3:
            out.add(autor)
    return out


def pruebas(raw, formas, ix, anot, gids_jugo):
    """`{cuenta: {tipo: [detalle]}}` para una persona."""
    out = collections.defaultdict(lambda: collections.defaultdict(list))
    largas = {f for f in formas if len(f) >= 4}
    for f in formas:
        for autor in ix['por_forma_autor'].get(f, ()):
            if autor in anot:
                continue
            for x in ix['escrito'][(f, autor)]:
                out[autor]['insc'].append(x)
        for did in ix['por_forma_mencion'].get(f, ()):
            for x in ix['menciones'][(f, did)]:
                out[did]['menc'].append(x)
    for f in largas:
        for did in ix['usuario'].get(f, ()):
            out[did]['usuario'].append(f)
        for did in ix['apodo'].get(f, ()):
            out[did]['apodo'].append(f)
        for v in {f} | variantes(f):
            for did in ix['variante'].get(v, ()):
                if did not in out or not (out[did].get('usuario') or out[did].get('apodo')):
                    out[did]['parecido'].append(v)
    # contenido (5+ letras), sólo entre los miembros de donde jugó: «lautarolasinceridad» ⊃ «lautaro» no, al revés sí
    miembros = None
    for f in (x for x in largas if len(x) >= 5):
        for sg, dids in ix['segmentos_largos']:
            if sg == f or (f not in sg and sg not in f):
                continue
            if miembros is None:
                miembros = ix['miembros_de'](gids_jugo)
            for did in dids & miembros:
                if not (out[did].get('usuario') or out[did].get('apodo')):
                    out[did]['parecido'].append('~' + f)
    return out


def puntaje(pr, c, cc_p, gids_jugo):
    """`(puntos, tipos distintos, está, veto)` de una cuenta para una persona."""
    p, tipos = 0.0, set()
    insc = pr.get('insc') or []
    if insc:
        p += PUNTOS['insc2'] if len({x[1] for x in insc}) >= 2 else PUNTOS['insc']
        tipos.add('insc')
    if pr.get('menc'):
        p += PUNTOS['menc']
        tipos.add('menc')
    if pr.get('usuario'):
        p += PUNTOS['usuario']
        tipos.add('nombre')
    elif pr.get('apodo'):
        p += PUNTOS['apodo']
        tipos.add('nombre')
    elif pr.get('parecido'):
        p += PUNTOS['parecido']
    veto = ''
    if c is not None and cc_p and c['cc']:
        if c['cc'] & cc_p:
            p += PUNTOS['bandera']
            tipos.add('bandera')
        else:
            veto = 'bandera distinta (%s contra %s)' % ('/'.join(sorted(c['cc'])), '/'.join(sorted(cc_p)))
    esta = bool(c is not None and c['en'] & gids_jugo)
    return p, tipos, esta, veto


def nivel(p, tipos, esta, veto, nombre_corto):
    if veto:
        return 'no'
    fuertes = tipos & {'insc', 'menc', 'nombre'}
    if nombre_corto and not (tipos & {'insc', 'menc'}):
        return 'no'
    if esta and p >= 3 and len(tipos) >= 2 and fuertes:
        return 'seguro'
    if p >= 1.5 and fuertes:
        return 'probable'
    return 'no'


def evaluar(liga, ix, gente, ids_ocupados):
    """Para cada persona de `gente` (`[(raw, fila del padrón o None)]`): la mejor cuenta, su nivel y sus pruebas."""
    anot = ix['anotadores']
    res = {}
    for raw, p in gente:
        k = norm(raw)
        formas = {k} | liga['alias'].get(k, set())
        j = liga['jugo'].get(k) or {'sv': {}, 'ev': set(), 'cc': set()}
        gids = {liga['gid_de'].get(sv) for sv in j['sv']} - {None}
        cc_p = cc_padron(p, liga['jugo']) if p else set(j['cc'])
        pr = pruebas(raw, formas, ix, anot, gids)
        filas = []
        ocupados = ids_ocupados.get(k, set())
        for did, prd in pr.items():
            if did in ocupados:
                continue
            c = ix['cuenta'].get(did)
            pts, tipos, esta, veto = puntaje(prd, c, cc_p, gids)
            if c is None and not (prd.get('insc') or prd.get('menc')):
                continue
            filas.append({'id': did, 'pts': pts, 'tipos': sorted(tipos), 'esta': esta, 'veto': veto,
                          'pr': {t: v for t, v in prd.items()},
                          'nivel': nivel(pts, tipos, esta, veto, len(k) < 4)})
        filas.sort(key=lambda x: (-(x['nivel'] == 'seguro'), -x['pts']))
        mejor = filas[0] if filas else None
        if mejor and len(filas) > 1 and filas[1]['nivel'] != 'no' and filas[1]['pts'] > mejor['pts'] - 1.5:
            mejor = dict(mejor, nivel='empate' if mejor['nivel'] != 'no' else 'no')
        res[raw] = {'mejor': mejor, 'otros': filas[1:4], 'jugo': dict(j['sv']), 'ev': len(j['ev']), 'cc': sorted(cc_p),
                    'disfraz': disfraces(formas, j, ix, liga, ocupados)}
    return res


def se_llama(ix, did, formas):
    """¿Algún nombre de esa cuenta (usuario, visible, apodos) es ese nombre, una variante, o lo contiene (5+)?"""
    c = ix['cuenta'].get(did)
    if not c:
        return False
    fs = set(formas)
    for f in list(fs):
        fs |= variantes(f)
    for x in [c['u'], c['g']] + list(c['apodos'].values()):
        for sg in segmentos(x):
            if sg in fs or {sg} & set().union(*[variantes(sg)]) & fs:
                return True
            if any(len(f) >= 5 and len(sg) >= 5 and (f in sg or sg in f) for f in formas):
                return True
    return False


def disfraces(formas, j, ix, liga, ocupados):
    """🎭 ¿ES OTRO NOMBRE DE ALGUIEN QUE YA ESTÁ EN LA LISTA? Medido el 12/11/2026: muchos «sin ID» de FFA no son gente
    nueva, son nombres de broma anotados por la cuenta de alguien con fila (48 de 201 ese día).
    Pero la misma cuenta puede estar anotando a un amigo, así que esto NO une: junta lo que hace falta para decidir.

    · `juntos`: en cuántos eventos jugaron LOS DOS nombres. Si es más de 0 no son la misma persona: se descarta.
    · `nombres`: cuántos nombres distintos escribió esa cuenta. Uno o dos es alguien con un disfraz; muchos es staff.
    · `veces`: cuántas veces escribió ESTE nombre."""
    out = []
    for f in formas:
        for autor in ix['por_forma_autor'].get(f, ()):
            if autor not in ocupados:
                continue
            for r in sorted(ix['dueno_de'].get(autor, ())):
                jr = liga['jugo'].get(norm(r)) or {'ev': set()}
                out.append({'de': r, 'id': autor, 'veces': len(ix['escrito'][(f, autor)]),
                            'nombres': len(ix['autores_de'].get(autor, ())),
                            'juntos': len(j['ev'] & jr['ev']),
                            'donde': sorted({x[0] for x in ix['escrito'][(f, autor)]})})
    return sorted(out, key=lambda d: (d['juntos'] > 0, d['nombres'], -d['veces']))


def contexto(mi, msj, inscr, menciones_extra=()):
    """Todo lo que la búsqueda necesita, armado una vez. Lo usan esta herramienta y el paso del ciclo
    (`bot/autoidentificar.py`), que le pasa `msj={}` y las inscripciones guardadas para siempre."""
    liga = cargar_liga()
    liga['inscr_git'] = inscr
    pad = liga['pad']
    pool_filas = _json('datos/temporada_pool.json')
    pool = {norm(t['raw']) for t in pool_filas}
    # 👥 una persona puede tener DOS cuentas: la de la Lista y las de `akas_a_mano.json` → `cuentas` (Erian, Rodas…)
    extra = _json('datos/akas_a_mano.json').get('cuentas') or {}
    ids_de = collections.defaultdict(set)
    ix_dueno = collections.defaultdict(set)
    for p in pad:
        for did in ([p['discord_id']] if p.get('discord_id') else []) + list(extra.get(p['raw']) or []):
            ids_de[did].add(norm(p['raw']))
            ix_dueno[did].add(p['raw'])
    ix = indices(mi, msj, liga)
    for n, did, sv, ms in menciones_extra:
        ix['menciones'][(n, did)].append((sv, ms, 'llave'))
    ix['dueno_de'] = ix_dueno
    ix['por_forma_autor'] = collections.defaultdict(set)
    for (n, autor) in ix['escrito']:
        ix['por_forma_autor'][n].add(autor)
    ix['por_forma_mencion'] = collections.defaultdict(set)
    for (n, did) in ix['menciones']:
        ix['por_forma_mencion'][n].add(did)
    miembros_gid = {gid: set(g['ms']) for gid, g in mi.items()}
    ix['miembros_de'] = lambda gids: set().union(*[miembros_gid.get(g, set()) for g in gids]) if gids else set()
    # quién anota a otros se cuenta contra TODA la gente que juega, no sólo la de la Lista
    formas_de = {norm(p['raw']): {norm(p['raw'])} | liga['alias'].get(norm(p['raw']), set()) for p in pad}
    for t in pool_filas:
        formas_de.setdefault(norm(t['raw']), {norm(t['raw'])})
    ix['anotadores'] = anotadores(ix, formas_de)

    # 🚫 un ID que ya es de OTRA fila no se le propone a nadie: el conjunto de «ocupados» es por persona
    todos_ids = set(ids_de)

    class Ocupados(dict):
        def get(self, k, d=None):                                             # noqa: D401
            return {i for i in todos_ids if k not in ids_de[i]}

    jugaron = [p for p in pad if norm(p['raw']) in pool]
    sin = [(p['raw'], p) for p in jugaron if not p.get('discord_id')]
    # ⚠️ Y LOS QUE JUGARON SIN ESTAR EN LA LISTA: medido el 12/11/2026, 182 de los 743 del pool. No tienen fila, así
    # que no tienen ni ID ni bandera del padrón: la bandera sale de sus resultados.
    # «POXE» y «Poxe», «Ragna» y «Ragna 🇨🇱»: dos filas del pool con la misma clave son una búsqueda, no dos
    vistos = {norm(p['raw']) for p in pad}
    for t in pool_filas:
        if norm(t['raw']) not in vistos:
            vistos.add(norm(t['raw']))
            sin.append((t['raw'], None))
    con = [(p['raw'], p) for p in jugaron if p.get('discord_id')]
    no_tocar = {norm(x) for x in (liga['ident'].get('no_verificar') or {})}
    revisar = {norm(x) for x in (liga['ident'].get('ambiguos_preguntar') or [])}
    for a, b in liga['ident'].get('no_fusionar') or []:
        revisar |= {norm(a), norm(b)}
    return {'liga': liga, 'ix': ix, 'pad': pad, 'sin': sin, 'con': con, 'ocup': Ocupados(), 'extra': extra,
            'no_tocar': no_tocar, 'revisar': revisar, 'mi': mi, 'msj': msj}


def automatico(r, raw):
    """🤖 LA REGLA QUE ESCRIBE SOLA, más estricta que «seguro». Además de «seguro» pide una prueba DIRECTA de que esa
    cuenta usó ese nombre en la Liga —se anotó con él o el host la mencionó con él— y que no sea lo único: con el
    nombre de Discord igual, o anotada dos veces. Los dos errores de verdad de la prueba del 12/11/2026 (una mención
    sola + la bandera, una inscripción sola + la bandera) no la pasan."""
    m = r.get('mejor')
    if not m or r.get('nivel') != 'seguro' or m.get('veto'):
        return False
    tipos = set(m['tipos'])
    if not tipos & {'insc', 'menc'}:
        return False
    insc = len({x[1] for x in (m["pr"].get("insc") or [])})
    if 'nombre' not in tipos and insc < 2:
        return False
    if len(norm(raw)) < 3:
        return False
    return True


def buscar(ctx, gente=None):
    """`{raw: resultado}` para la gente sin ID (o la que se pase), con las guardas de grupo: una cuenta que sale para
    dos personas no es de ninguna, y `identidades.json` manda."""
    liga, ix = ctx['liga'], ctx['ix']
    sinr = evaluar(liga, ix, ctx['sin'] if gente is None else gente, ctx['ocup'])
    duenos = collections.defaultdict(list)
    for raw, r in sinr.items():
        if r['mejor'] and r['mejor']['nivel'] in ('seguro', 'probable'):
            duenos[r['mejor']['id']].append(raw)
    for did, raws in duenos.items():
        if len(raws) > 1:
            for raw in raws:
                sinr[raw]['mejor'] = dict(sinr[raw]['mejor'], nivel='empate', veto='la misma cuenta sale para %s'
                                          % ', '.join(x for x in raws if x != raw))
    for raw in sinr:
        k = norm(raw)
        m = sinr[raw]['mejor']
        if m and k in ctx['no_tocar']:
            sinr[raw]['mejor'] = dict(m, nivel='no', veto='identidades.json: no_verificar')
        elif m and k in ctx['revisar'] and m['nivel'] == 'seguro':
            sinr[raw]['mejor'] = dict(m, nivel='probable', veto='identidades.json: se pregunta')
    for raw, r in sinr.items():
        r['nivel'] = (r['mejor'] or {}).get('nivel', 'nada')
        if r['nivel'] not in ('seguro', 'probable') and any(d['juntos'] == 0 for d in r['disfraz']):
            r['nivel'] = 'disfraz'
        r['auto'] = automatico(r, raw)
    return sinr


def probar(ctx):
    """🧪 Los que SÍ tienen ID, como si no lo tuvieran: (tabla por nivel, errores, tabla de la regla automática)."""
    liga, ix, extra = ctx['liga'], ctx['ix'], ctx['extra']
    prueba = buscar(ctx, ctx['con'])
    tabla, auto = collections.Counter(), collections.Counter()
    errores = []
    for raw, p in ctx['con']:
        r = prueba[raw]
        m = r['mejor']
        nv = m['nivel'] if m else 'nada'
        ok = bool(m) and (m['id'] == p['discord_id'] or m['id'] in (extra.get(raw) or []))
        tabla[(nv, ok)] += 1
        clase = 'acierta' if ok else ''
        if m and not ok:
            fs = {norm(raw)} | liga['alias'].get(norm(raw), set())
            a, b = se_llama(ix, p['discord_id'], fs), se_llama(ix, m['id'], fs)
            # 🔍 no todo «error» es de la regla: la misma persona con dos cuentas, o un ID de la Lista mal puesto
            clase = ('dos cuentas' if a and b else 'la Lista puede estar mal' if b and not a else 'error de la regla')
            if nv in ('seguro', 'probable'):
                errores.append((raw, nv, dict(m, lista=p['discord_id'], clase=clase, auto=r['auto'])))
        if r['auto']:
            auto[clase] += 1
    return tabla, errores, auto


def cruzar():
    mi = _json('.cache/identificar/miembros.json')
    msj = _json('.cache/identificar/mensajes.json')
    ctx = contexto(mi, msj, inscripciones_de_git())
    ix = ctx['ix']
    print('\nla Lista: %d · sin ID (de la Lista o fuera de ella): %d · con ID (para la prueba): %d'
          % (len(ctx['pad']), len(ctx['sin']), len(ctx['con'])))
    print('Discord: %d cuentas en %d servidores · %d mensajes de %d canales · %d cuentas que anotan a otros'
          % (len(ix['cuenta']), len(mi), sum(len(c['ms']) for c in msj.values()), len(msj), len(ix['anotadores'])))

    tabla, errores, auto = probar(ctx)
    print('\n🧪 LA PRUEBA, con los %d que ya tienen ID (como si no lo tuvieran):' % len(ctx['con']))
    for nv in ('seguro', 'probable', 'empate', 'no', 'nada'):
        b, m_ = tabla[(nv, True)], tabla[(nv, False)]
        if b + m_:
            print('   %-9s %4d   acierta %4d · se equivoca %3d%s'
                  % (nv, b + m_, b, m_, ('   (%.1f %% de acierto)' % (100.0 * b / (b + m_)))
                     if nv in ('seguro', 'probable') else ''))
    print('   🤖 la regla que escribe sola: %d · %s' % (sum(auto.values()), ' · '.join(
        '%s %d' % (k, v) for k, v in sorted(auto.items(), key=lambda x: -x[1]))))

    sinr = buscar(ctx)
    cuenta = collections.Counter(r['nivel'] for r in sinr.values())
    print('\n🔎 LOS %d SIN ID:' % len(ctx['sin']))
    for nv in ('seguro', 'probable', 'disfraz', 'empate', 'no', 'nada'):
        if cuenta[nv]:
            print('   %-9s %4d%s' % (nv, cuenta[nv], '   (otro nombre de alguien de la Lista: se decide, no se une)'
                                    if nv == 'disfraz' else ''))
    print('   🤖 los escribiría solos: %d' % sum(1 for r in sinr.values() if r['auto']))

    os.makedirs(DIR, exist_ok=True)
    with io.open(INFORME, 'w', encoding='utf-8') as f:
        json.dump({'cuando': datetime.datetime.now().isoformat(timespec='minutes'), 'prueba': {
            '%s|%s' % k: v for k, v in tabla.items()}, 'auto': dict(auto), 'errores': errores, 'sin_id': sinr}, f,
            ensure_ascii=False, indent=1, default=list)
    escribir_md(sinr, tabla, errores, ix)
    print('\n   informe: %s (privado, no se commitea)' % INFORME_MD)


def _cuenta_txt(ix, did):
    c = ix['cuenta'].get(did)
    if not c:
        return '`%s` (no está en ningún servidor del bot)' % did
    ap = sorted(set(c['apodos'].values()))[:3]
    return '@%s · «%s»%s · `%s`' % (c['u'], c['g'] or '—', (' · apodos: ' + ', '.join(ap)) if ap else '', did)


def _pruebas_txt(pr):
    out = []
    for t in ('insc', 'menc'):
        for sv, ms, link in sorted(pr.get(t) or [], key=lambda x: x[1])[:3]:
            donde = ('ya borrado de #%s' % link[8:]) if link.startswith('borrado:') else '[mensaje](%s)' % link
            out.append('%s en %s, %s ET (%s)' % ('se anotó' if t == 'insc' else 'mencionado', sv, fecha_et(ms), donde))
    for t, d in (('usuario', 'usuario de Discord'), ('apodo', 'apodo o nombre visible'), ('parecido', 'nombre parecido')):
        if pr.get(t):
            out.append('%s: %s' % (d, ', '.join(sorted(set(pr[t]))[:3])))
    return out


def escribir_md(sinr, tabla, errores, ix):
    L = ['# Identificar a los que jugaron sin ID — informe (privado)', '',
         'Generado por `herramientas/identificar.py`. No escribe nada: es para mirar.', '', '## La prueba con los que ya tienen ID', '']
    for nv in ('seguro', 'probable', 'empate', 'no', 'nada'):
        b, m = tabla[(nv, True)], tabla[(nv, False)]
        if b + m:
            L.append('- **%s**: %d · acierta %d · se equivoca %d' % (nv, b + m, b, m))
    if errores:
        L += ['', '### Dónde se equivocó', '']
        for clase in ('error de la regla', 'la Lista puede estar mal', 'dos cuentas'):
            es = [e for e in errores if e[2].get('clase') == clase]
            if not es:
                continue
            L += ['', '**%s** (%d)' % (clase, len(es)), '']
            for raw, nv, m in es[:40]:
                L.append('- **%s** (%s, %.1f pts, %s): eligió %s · la Lista tiene %s' % (
                    raw, nv, m['pts'], '+'.join(m['tipos']), _cuenta_txt(ix, m['id']), _cuenta_txt(ix, m['lista'])))
    dis = [(raw, r) for raw, r in sinr.items() if r.get('nivel') == 'disfraz']
    if dis:
        L += ['', '## ¿Otro nombre de alguien de la Lista? (%d)' % len(dis), '',
              'La cuenta que anotó ese nombre ya es de otra fila. **No se une solo**: puede estar anotando a un amigo. '
              '«nombres» = cuántos nombres distintos escribió esa cuenta (muchos = staff); «juntos» = eventos que '
              'jugaron los dos (más de 0 = son dos personas).', '']
        for raw, r in sorted(dis, key=lambda x: min(d['nombres'] for d in x[1]['disfraz'] if d['juntos'] == 0)):
            for d in [d for d in r['disfraz'] if d['juntos'] == 0][:2]:
                L.append('- **%s** (jugó en %s, %d ev.) ← lo anotó la cuenta de **%s** %d vez/veces en %s · esa cuenta '
                         'escribió %d nombres' % (raw, ', '.join(r['jugo']), r['ev'], d['de'], d['veces'],
                                                  ', '.join(d['donde']), d['nombres']))
    for nv, tit in (('seguro', 'Seguros'), ('probable', 'Probables'), ('empate', 'Con dos candidatos')):
        filas = [(raw, r) for raw, r in sinr.items() if r.get('nivel') == nv]
        if not filas:
            continue
        L += ['', '## %s (%d)' % (tit, len(filas)), '']
        for raw, r in sorted(filas, key=lambda x: -x[1]['mejor']['pts']):
            m = r['mejor']
            L.append('- **%s** %s — jugó en %s (%d ev.) → %s · %.1f pts%s%s' % (
                raw, ''.join(chr(0x1F1E6 + ord(c[0]) - 97) + chr(0x1F1E6 + ord(c[1]) - 97) for c in r['cc'] if len(c) == 2),
                ', '.join(r['jugo']), r['ev'], _cuenta_txt(ix, m['id']), m['pts'],
                '' if m['esta'] else ' · ⚠️ no está en el servidor donde jugó', (' · ' + m['veto']) if m['veto'] else ''))
            for x in _pruebas_txt(m['pr']):
                L.append('  - ' + x)
            for o in r['otros'][:2]:
                if o['nivel'] != 'no':
                    L.append('  - otro candidato: %s · %.1f pts' % (_cuenta_txt(ix, o['id']), o['pts']))
    with io.open(INFORME_MD, 'w', encoding='utf-8') as f:
        f.write('\n'.join(L) + '\n')


# ── self-check ──────────────────────────────────────────────────────────────────────────────────────────────────────
def _auto():
    assert norm('𝐋𝐢𝐥 𝐃𝐫𝐚𝐤𝐨 🇦🇷') == 'lildrako'
    assert cc_de('Benji 🇦🇷') == {'ar'}
    assert segmentos('🐉 | Liberia') >= {'liberia'}
    assert 'benji' in segmentos('[FFA] Benji')
    assert 'zignos' in variantes('zignoss') and 'benji' in variantes('benji12') and 'leo' not in variantes('le0')
    assert nombre_de_mensaje('Pichulamc 🇦🇷') == 'pichulamc'
    assert nombre_de_mensaje('Presagio🇦🇷(SIX)') == 'presagio'
    assert nombre_de_mensaje('fleivaman🇨🇦 + belleza🇮🇨') == ''
    assert nombre_de_mensaje('¿Empieza cuando?') == ''
    assert nombre_de_mensaje('Juan y Pedro') == ''
    assert renglones_con_mencion('1. Benji 🇦🇷 <@123456789012345678>\n<@1> vs <@2>') == [('benji', '123456789012345678')]
    assert renglones_con_mencion('Batalla 2: Mco <@123456789012345678>') == [('mco', '123456789012345678')]
    assert ms_de(snowflake_de('2026-09-21T00:00:00+00:00')) // 1000 == int(
        datetime.datetime.fromisoformat('2026-09-21T00:00:00+00:00').timestamp())
    # el nivel
    assert nivel(4.0, {'insc', 'bandera'}, True, '', False) == 'seguro'
    assert nivel(4.0, {'insc', 'bandera'}, False, '', False) == 'probable'          # no está donde jugó
    assert nivel(5.0, {'insc', 'nombre'}, True, 'bandera distinta', False) == 'no'
    assert nivel(2.0, {'nombre'}, True, '', True) == 'no'                            # nombre corto sin inscripción
    assert nivel(1.0, {'bandera'}, True, '', False) == 'no'                          # la bandera sola no
    c = {'cc': {'ar'}, 'en': {'g1'}}
    assert puntaje({'usuario': ['x']}, c, {'ar'}, {'g1'})[:3] == (3.0, {'nombre', 'bandera'}, True)
    assert puntaje({'usuario': ['x']}, c, {'cl'}, {'g1'})[3].startswith('bandera distinta')
    print('identificar: self-check ok')


if __name__ == '__main__':
    if '--auto' in sys.argv:
        _auto()
    elif '--bajar' in sys.argv:
        bajar()
    else:
        cruzar()
