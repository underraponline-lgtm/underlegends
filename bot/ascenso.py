# -*- coding: utf-8 -*-
"""📈 EL RANKING DE ASCENSO DE CADA SERVIDOR, AL DÍA: su tabla oficial más lo que todavía no contó.

    python bot/ascenso.py            cómo queda cada tabla, sin escribir ni publicar nada
    python bot/ascenso.py --aplicar  deja datos/ascenso.json y, en los servidores que lo prendieron en `/settings`,
                                     edita su mensaje (lo corre el ciclo, paso 2b9b)
    python bot/ascenso.py --auto     el self-check, sin red

Dlx, 17/10/2026: *«la idea es ayudar a los demás servidores… crear un ascenso actualizado para cada servidor para sus
ligas. Que sea opción y se ponga en /settings»*, *«y también que esté en la página, obvio»*; a las preguntas: en
Discord, *«la tabla al día»*; lo que no se sabe, *«ahí le preguntaré a cada servidor: que me digas qué no sabes»*.

🔑 NO SE RECALCULA DESDE CERO: SE PARTE DE SU TABLA OFICIAL. Relevado ese día (las notas, en el artifact privado): las
tablas de ascenso de los servidores se actualizan a mano y quedan atrás —la de Snake Rap sin tres torneos de
octubre, la de Urban Freestyle quieta desde el 22/09—, y tienen puntos que no salen de ninguna regla escrita (Snake
Rap: 350, 450, 1.250…). Recalcular todo sería contradecirlos en lo que no sabemos. Así que la base es SU tabla tal
cual, y encima se suma sólo lo que vino DESPUÉS de su última actualización, con SU escala (`datos/ascenso_reglas.json`).

⚠️ CADA SERVIDOR CUENTA DISTINTO, y la regla es la suya:
  · Snake Rap: las compes de su #llaves; el rango está escrito en la llave («[Rango 2️⃣]», «RANGO 4», un emoji
    `3snake`). Sin rango, no suma: así cuenta Snake Rap (un torneo sin rango es «Chill»).
  · Urban Freestyle: sólo las compes que publicaron su podio en #Podios (lo dice su canal). El rango no está en el
    podio: sale de `rangos`, y la mayoría no lo publicó nunca → no suma y va a las PREGUNTAS.
  · En los dos, quien ya juega una de sus ligas no suma: su requisito es no estar en ninguna (`fuera`).
⚠️ LO QUE NO SE SABE NO SE INVENTA: un rango desconocido o una instancia en `dudas` (dos semifinalistas sin partido
por el 3º) no suman y quedan en `pendiente`, que es la lista que Dlx les pregunta a los servidores.
⚠️ EN DISCORD, SÓLO DONDE LO PIDIERON: el canal sale de `/settings` (`cfg:<guild>.ascenso`, KV). Un solo mensaje que
se EDITA —nunca uno nuevo por corrida—, sin mencionar a nadie, y sólo cuando cambió algo. Lo que se publicó queda en
`datos/ascenso_msgs.json`, que commitea `bot/ci/guardar.sh`: un runner nuevo no tiene memoria.
"""
import datetime as dt
import hashlib
import io
import json
import os
import re
import sys
import unicodedata

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

REGLAS = os.path.join(BASE, 'datos', 'ascenso_reglas.json')
SALIDA = os.path.join(BASE, 'datos', 'ascenso.json')
MSGS = os.path.join(BASE, 'datos', 'ascenso_msgs.json')
API = 'https://discord.com/api/v10'
HUB = 'https://underlegends.pages.dev'
#: cuántas filas entran en el mensaje de Discord (el resto, en la página)
EN_DISCORD = 40

_BANDERA = re.compile('[\U0001F1E6-\U0001F1FF]{2}')
_EMOJI_DC = re.compile(r'<a?:\w+:\d+>')
_SOBRA = re.compile('[\U0001F300-\U0001FAFF☀-➿️‍\U0001F3F3\U0001F3F4]')


def _json(ruta, defecto):
    try:
        with io.open(ruta, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return defecto


def _guardar(ruta, d):
    with io.open(ruta, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(d, f, ensure_ascii=False, indent=1)
        f.write('\n')


def reglas():
    """`{sv: regla}` de `datos/ascenso_reglas.json`, sin las claves `_…`."""
    return {k: v for k, v in (_json(REGLAS, {}) or {}).items() if not k.startswith('_') and isinstance(v, dict)}


def clave(s):
    from comun.claves import clave as _c
    return _c(s)


def cc_de(txt):
    """El código de país de la primera bandera del texto (`'co'`), o `''`."""
    m = _BANDERA.search(str(txt or ''))
    return ''.join(chr(ord(c) - 0x1F1E6 + 97) for c in m.group(0)) if m else ''


def bandera(cc):
    cc = str(cc or '').lower()
    return ''.join(chr(0x1F1E6 + ord(c) - 97) for c in cc) if re.match(r'^[a-z]{2}$', cc) else ''


def limpio(txt):
    """El nombre sin banderas, emojis de Discord ni adornos: «COLESITO🇨🇴» → «COLESITO»."""
    t = _EMOJI_DC.sub(' ', str(txt or ''))
    t = _BANDERA.sub(' ', t)
    t = _SOBRA.sub(' ', t)
    return re.sub(r'\s+', ' ', t.replace('*', '')).strip(' .:-|')


def numero(s):
    """«7.100», «2,250», «6.000pts» → 7100, 2250, 6000. Los dos separan miles: ninguna tabla usa decimales."""
    d = re.sub(r'[^\d]', '', str(s or ''))
    return int(d) if d else 0


def miles(n):
    return '{:,}'.format(int(n)).replace(',', '.')


def plano(s):
    s = unicodedata.normalize('NFKD', str(s or '').lower())
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()


# ── las tablas oficiales ──────────────────────────────────────────────────────────────────────────────────────────
def leer_sr(texto):
    """La tabla de Snake Rap: `{filas: [[nombre, cc, pts, '']], nota, desde}`. `## 🏅 JUASMIO 🇨🇴 7500` es el primero y
    `- ABYSSUS 🇵🇦 7100` los demás; el pie `♻️ ASCENSO ACTUALIZADO 29/09/2026 ♻️ TRAS … 2/8` dice hasta dónde contó."""
    filas, nota, desde = [], '', ''
    for l in str(texto or '').splitlines():
        l = l.strip()
        if 'ACTUALIZADO' in l.upper() or 'CERRADO' in l.upper():
            nota = limpio(l)
            m = re.search(r'(\d{1,2})/(\d{1,2})/(\d{4})', l)
            if m:
                desde = '%s-%02d-%02d' % (m.group(3), int(m.group(2)), int(m.group(1)))
            continue
        m = re.match(r'^(?:#+\s*🏅|-)\s*(.+?)\s+(\d[\d.,]*)\s*(?:pts)?$', l, re.I) or \
            re.match(r'^(?:#+\s*🏅|-)\s*(.+?[^\d\s])(\d[\d.,]*)\s*(?:pts)?$', l, re.I)
        if not m:
            continue
        n = limpio(m.group(1))
        if n:
            filas.append([n, cc_de(m.group(1)), numero(m.group(2)), ''])
    return {'filas': filas, 'nota': nota, 'desde': desde}


_URBF_FILA = re.compile(r'^(?:#\s*)?(?:(\d+)\.|(?:<a?:\w+:\d+>)+\s*\.)\s*(?:<@!?(\d+)>|\*\*(.+?)\*\*)\s*(\S*)\s*([\d.,]+)\s*pts',
                        re.I)


def leer_urbf(texto):
    """La tabla de Urban Freestyle: `{filas: [[nombre, cc, pts, discord_id]], nota, desde}`. Los dos primeros no llevan
    número (llevan el emoji de «sube»), el resto `N.`; la persona es una mención o `**NOMBRE**`."""
    filas = []
    for l in str(texto or '').splitlines():
        m = _URBF_FILA.match(l.strip())
        if m:
            filas.append([limpio(m.group(3) or ''), cc_de(m.group(4)), numero(m.group(5)), m.group(2) or ''])
    return {'filas': filas, 'nota': '', 'desde': ''}


LECTORES = {'sr': leer_sr, 'urbf': leer_urbf}


def rango_de_llave(texto):
    """El rango que Snake Rap escribe en la llave: «RANGO 4», «[Rango 2️⃣]», «[RANGO 2]», «RANGO <:3snake:…>»,
    «[Rango Insignia]» → `'4'`, `'2'`, `'3'`, `'insignia'`; `''` si no dice (un torneo sin rango no suma)."""
    for m in re.finditer(r'rango\s*[:\-]?\s*(\S+)', str(texto or ''), re.I):
        x = m.group(1)
        if x.lower().startswith('insignia'):
            return 'insignia'
        d = re.match(r'<a?:([1-4])', x) or re.match('([1-4])(?:️?⃣)?(?![0-9])', x)
        if d:
            return d.group(1)
    return ''


def serie(titulo):
    """El nombre de la serie de una compe, sin su número: «FF Freestyle: Clasico VOL.1» → «ff freestyle clasico»,
    «CCFF V.2» → «ccff». Es la clave de `rangos`: el rango es de la serie, no de cada edición."""
    t = plano(limpio(titulo))
    t = re.sub(r'\b(?:vol|v|ed|edicion|t|temp|temporada|n)\s*\d+\b', ' ', t)
    t = re.sub(r'\b\d+\b', ' ', t)
    return re.sub(r'\s+', ' ', t).strip()


# ── quién juega las ligas de ese servidor ─────────────────────────────────────────────────────────────────────────
def miembros(ligas_json, ids):
    """Los nombres (como los escriben) de quienes JUEGAN esas ligas: con `min(2, el máximo)` batallas sin ser el 🎮
    invitado. El invitado no es de la liga, y el play-off que la liga leyó como batalla tampoco hace a nadie miembro
    (Six–Deluxe, Snake, 07/09: Deluxe perdió y no entró)."""
    out = set()
    L = (ligas_json or {}).get('ligas') or {}
    for lid in ids or []:
        c = {}
        for b in (L.get(lid) or {}).get('batallas') or []:
            ex = (b[7] if len(b) > 7 else '') or ''
            for lado, n in (('a', b[3]), ('b', b[4])):
                if n and lado not in ex:
                    c[n] = c.get(n, 0) + 1
        tope = min(2, max(c.values()) if c else 0)
        out |= {n for n, k in c.items() if k >= tope}
    return out


# ── el cálculo ────────────────────────────────────────────────────────────────────────────────────────────────────
def calcular(R, oficial, compes, canon, fuera):
    """La tabla al día. Pura.

    `oficial`: lo que leyó `LECTORES`. `compes`: `[{n, nombre, dia, rango, filas: [[nombre, instancia, did]]}]`, ya
    filtradas (lo que vino después de la oficial). `canon(nombre, did) -> (clave, raw, nombre a mostrar, cc)`: quién es
    cada uno (el padrón y los AKAs). `fuera`: las claves de quienes juegan sus ligas.

    Devuelve `{filas: [[nombre, cc, pts, suma, raw]], sumado, pendiente}`: `suma` es lo que se le agregó a la oficial."""
    filas, orden = {}, []
    for i, (n, cc, pts, did) in enumerate(oficial.get('filas') or []):
        k, raw, ver, cc2 = canon(n, did)
        if k in filas:
            filas[k]['pts'] += pts
            continue
        filas[k] = {'n': n or ver, 'cc': cc or cc2, 'pts': pts, 'suma': 0, 'raw': raw, 'o': i}
        orden.append(k)
    sumado, pendiente = [], []
    escala = R.get('escala') or {}
    dudas = R.get('dudas') or {}
    for c in compes:
        if not c.get('rango'):
            pendiente.append({'que': 'rango', 'compe': c.get('serie') or c['nombre'], 'evento': c['nombre'], 'dia': c['dia']})
            continue
        esc = escala.get(c['rango'])
        if esc is None:
            pendiente.append({'que': 'rango', 'compe': c.get('serie') or c['nombre'], 'evento': c['nombre'], 'dia': c['dia'],
                              'detalle': 'rango «%s» fuera de su tabla' % c['rango']})
            continue
        puntos, sin, dud = [], [], []
        for n, inst, did in c.get('filas') or []:
            k, raw, ver, cc = canon(n, did)
            if inst in dudas and inst not in esc:
                dud.append(ver or n)
                continue
            p = esc.get(inst) or 0
            if not p:
                continue
            if k in fuera:
                sin.append(ver or n)
                continue
            if k not in filas:
                filas[k] = {'n': (ver or n).upper() if R.get('tabla', {}).get('formato') == 'sr' else (ver or n), 'cc': cc,
                            'pts': 0, 'suma': 0, 'raw': raw, 'o': 10 ** 6 + len(orden)}
                orden.append(k)
            filas[k]['pts'] += p
            filas[k]['suma'] += p
            puntos.append([ver or n, inst, p])
        if dud:
            pendiente.append({'que': 'duda', 'evento': c['nombre'], 'dia': c['dia'], 'gente': dud,
                              'detalle': next(iter(dudas.values()))})
        sumado.append({'n': c.get('n'), 'evento': c['nombre'], 'dia': c['dia'], 'rango': c['rango'], 'puntos': puntos,
                       'fuera': sin})
    lista = sorted(filas.values(), key=lambda x: (-x['pts'], x['o']))
    return {'filas': [[x['n'], x['cc'], x['pts'], x['suma'], x['raw']] for x in lista if x['pts'] > 0],
            'sumado': sumado, 'pendiente': pendiente}


def despues(eventos, sv, desde_dia, nota):
    """Los eventos nuestros de ese servidor que su tabla oficial todavía no contó: los posteriores al que nombra su pie
    («TRAS RAP EXHIBITION 2/8»), o, si no se encuentra, los posteriores al día de su última actualización."""
    evs = sorted([(v.get('dia') or '', int(v.get('n') or 0), v) for v in (eventos or {}).values() if v.get('sv') == sv],
                 key=lambda x: (x[0], x[1]))
    ancla = None
    pn = plano(nota)
    for d, n, v in evs:
        nm = plano(v.get('nombre'))
        if nm and len(nm) >= 6 and nm in pn:
            ancla = (d, n)
    if ancla:
        return [v for d, n, v in evs if (d, n) > ancla]
    return [v for d, n, v in evs if desde_dia and d > desde_dia]


_PUESTO = (('Campeón', r'campe[oó]n'), ('Subcampeón', r'sub\W*campe[oó]n'), ('Tercero', r'terc(?:er|ero)\W*(?:puesto|lugar)?'),
           ('Cuarto', r'cuart[oa]\W*(?:puesto|lugar)'))


def leer_podio(texto):
    """Un podio de #Podios (Urban Freestyle): `{titulo, filas: [[nombre, instancia, did]]}` o `None`. El formato es
    semi-libre: `# CCFF V.2` / `Campeon: <@id>` / `Subcampeon: BETEL`, o `𝄆 CAMPEÓN: Motera🇪🇸`."""
    lineas = [l.strip() for l in str(texto or '').splitlines() if l.strip()]
    if not lineas:
        return None
    titulo = limpio(re.sub(r'^#+', '', lineas[0]))
    filas = []
    for l in lineas[1:]:
        lp = unicodedata.normalize('NFKC', l)
        for inst, pat in (_PUESTO[1], _PUESTO[0], _PUESTO[2], _PUESTO[3]):
            m = re.search(pat + r'\W*[:=]\s*(.+)$', lp, re.I)
            if m:
                quien = m.group(1)
                did = (re.search(r'<@!?(\d+)>', quien) or [None, ''])[1]
                filas.append([limpio(re.sub(r'<@!?\d+>', '', quien)), inst, did])
                break
    return {'titulo': titulo, 'filas': filas} if titulo and filas else None


# ── Discord ───────────────────────────────────────────────────────────────────────────────────────────────────────
def embed(sv, R, A, color):
    """El mensaje que el bot mantiene en el canal que eligió el servidor. Sin hora de armado adentro: el hash decide si
    se edita, y una hora lo cambiaría en cada corrida."""
    suben, po = int(R.get('suben') or 0), int(R.get('playoff') or 0)
    lineas = []
    for i, (n, cc, pts, suma, _raw) in enumerate(A['filas'][:EN_DISCORD]):
        marca = '⬆️ ' if i < suben else ('🔁 ' if i < suben + po else '')
        nuevo = ' `+%s`' % miles(suma) if suma else ''
        lineas.append('%s**%d.** %s %s · **%s**%s' % (marca, i + 1, n, bandera(cc), miles(pts), nuevo))
    resto = len(A['filas']) - EN_DISCORD
    desc = '\n'.join(lineas) + ('\n… y %d más en la página.' % resto if resto > 0 else '')
    campos = []
    if A['sumado']:
        campos.append({'name': '🆕 Lo que se sumó a la tabla oficial', 'inline': False,
                       'value': '\n'.join('· %s (%s) · rango %s' % (c['evento'], c['dia'][8:10] + '/' + c['dia'][5:7],
                                                                  c['rango'].upper()) for c in A['sumado'])[:1000]})
    if A['pendiente']:
        campos.append({'name': '⏳ Todavía no suma', 'inline': False,
                       'value': '\n'.join('· %s: %s' % (p['evento'], 'falta saber su rango' if p['que'] == 'rango'
                                                         else p.get('detalle') or 'falta confirmar')
                                          for p in A['pendiente'])[:1000]})
    oficial = A.get('oficial') or {}
    base = ('Base: su tabla oficial' + (' del ' + oficial['dia'][8:10] + '/' + oficial['dia'][5:7] if oficial.get('dia') else ''))
    leyenda = ('⬆️ sube' + (' · 🔁 play-off' if po else '') + ' · `+N` lo que se sumó')
    return {
        'title': '📈 Ascenso a la %s · al día' % R.get('n', ''),
        'url': HUB + '/freestyle-rap/ligas/' + R.get('destino', ''),
        'description': desc[:4000],
        'color': color,
        'fields': campos,
        'footer': {'text': '%s · %s. Lo arma el bot de la Liga Global con las reglas de %s; lo oficial lo decide su staff.'
                   % (leyenda, base, sv)},
    }


def _publicar(s, gid, canal, cuerpo, estado):
    """Edita el mensaje de ese servidor, o lo publica si no hay (o lo borraron, o cambió el canal). `estado` se
    actualiza en el lugar. Devuelve qué pasó."""
    h = hashlib.sha1(json.dumps(cuerpo, sort_keys=True, ensure_ascii=False).encode('utf-8')).hexdigest()[:16]
    st = estado.get(gid) or {}
    datos = {'embeds': [cuerpo], 'allowed_mentions': {'parse': []}}
    if st.get('canal') == canal and st.get('msg'):
        if st.get('h') == h:
            return 'igual'
        r = s.patch('%s/channels/%s/messages/%s' % (API, canal, st['msg']), json=datos, timeout=20)
        if r.ok:
            st['h'] = h
            estado[gid] = st
            return 'editado'
        if r.status_code != 404:
            return 'no pude editar (%s)' % r.status_code
    r = s.post('%s/channels/%s/messages' % (API, canal), json=datos, timeout=20)
    if not r.ok:
        return 'no pude publicar (%s%s)' % (r.status_code, ': el bot no tiene permiso en ese canal' if r.status_code == 403 else '')
    estado[gid] = {'canal': canal, 'msg': r.json().get('id'), 'h': h}
    return 'publicado'


# ── la corrida ────────────────────────────────────────────────────────────────────────────────────────────────────
def _canonizador():
    """`canon(nombre, did) -> (clave, raw del padrón o '', nombre a mostrar, cc)`. El ID manda (el padrón); si no, los
    AKAs (`motor._resolvedor()`); si nada, el nombre como está escrito."""
    padron = _json(os.path.join(BASE, 'datos', 'padron.json'), []) or []
    por_id = {str(p['discord_id']): p['raw'] for p in padron if p.get('discord_id') and p.get('raw')}
    por_k = {clave(p['raw']): p['raw'] for p in padron if p.get('raw')}
    pool = {clave(p['raw']): (p.get('cc') or '') for p in (_json(os.path.join(BASE, 'datos', 'temporada_pool.json'), [])
                                                           or []) if p.get('raw')}
    # la bandera de quien no jugó la Temporada: la del país de la Lista
    try:
        import subir_datos as _SD
        for p in padron:
            if p.get('raw') and not pool.get(clave(p['raw'])) and p.get('pais'):
                pool[clave(p['raw'])] = _SD._cc_de(p['pais'])
    except Exception:                                    # noqa: BLE001
        pass
    try:
        import motor
        res, _n = motor._resolvedor()
    except Exception:                                    # noqa: BLE001
        res = None

    def canon(nombre, did=''):
        raw = por_id.get(str(did or ''))
        if not raw:
            r = res(nombre) if res and nombre else nombre
            raw = por_k.get(clave(r)) or por_k.get(clave(nombre)) or ''
        # 🔴 UNA CUENTA QUE NO ESTÁ EN LA LISTA SE IDENTIFICA POR SU ID, NO POR SU NOMBRE: si Discord no contesta su
        # nombre, varias quedan con el mismo («una cuenta de Discord») y se sumaban en una sola fila (17/10/2026: tres
        # menciones de Urban dieron un «6.000» que no era de nadie)
        k = clave(raw) if raw else ('id' + str(did) if did else clave(nombre))
        return k, raw, limpio(raw) if raw else limpio(nombre), pool.get(k, '')
    return canon


def _nombre_dc(s, did, cache):
    """El nombre de una cuenta que no está en la Lista (para las menciones de Urban Freestyle): el de Discord."""
    if cache.get(did):
        return cache[did]
    n = ''
    try:
        r = s.get('%s/users/%s' % (API, did), timeout=15)
        if r.status_code == 429:               # Discord frena: se espera lo que pide (hasta 5 s) y una vez más
            import time
            time.sleep(min(5.0, float((r.json() or {}).get('retry_after') or 1)))
            r = s.get('%s/users/%s' % (API, did), timeout=15)
        if r.ok:
            u = r.json()
            n = u.get('global_name') or u.get('username') or ''
            if re.match(r'(?i)^deleted[ _]user', n):
                n = 'Cuenta borrada'
    except (OSError, ValueError):
        pass
    if n:                                  # lo que no contestó no se guarda: se vuelve a pedir en la corrida siguiente
        cache[did] = n
    return n


def correr(aplicar=False):
    import requests
    import fotos as F
    tok = F.env('DISCORD_TOKEN', obligatorio=False)
    if not tok:
        print('   ⚠️ sin DISCORD_TOKEN: no leo las tablas')
        return 0
    s = requests.Session()
    s.headers['Authorization'] = 'Bot ' + tok
    RR = reglas()
    viejo = _json(SALIDA, {}) or {}
    rangos_cache = dict(viejo.get('rangos_llave') or {})
    nombres_cache = dict(viejo.get('nombres') or {})
    eventos = _json(os.path.join(BASE, 'datos', 'llaves_t1.json'), {}) or {}
    ligas_json = _json(os.path.join(BASE, 'datos', 'ligas.json'), {}) or {}
    canon = _canonizador()
    out = {'_leeme': 'El ranking de ascenso de cada servidor, al día (bot/ascenso.py): su tabla oficial más lo que vino '
                     'después, con sus reglas (datos/ascenso_reglas.json). `filas`: [nombre, cc, pts, lo sumado, raw]. '
                     '`pendiente`: lo que no se sabe y no suma (las preguntas de Dlx a cada servidor).',
           't': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'sv': {},
           'rangos_llave': rangos_cache, 'nombres': nombres_cache}
    for _d0 in [d for d, n in nombres_cache.items() if not n]:
        del nombres_cache[_d0]
    for sv, R in RR.items():
        T = R.get('tabla') or {}
        try:
            r = s.get('%s/channels/%s/messages/%s' % (API, T['canal'], T['msg']), timeout=20)
        except OSError as e:
            print('   ⚠️ %s: su tabla no contestó (%s)' % (sv, str(e)[:60]))
            continue
        if not r.ok:
            print('   ⚠️ %s: no pude leer su tabla (%s)' % (sv, r.status_code))
            continue
        m = r.json()
        of = LECTORES[T.get('formato', 'sr')](m.get('content') or '')
        editada = (m.get('edited_timestamp') or m.get('timestamp') or '')[:19]
        if not of['filas']:
            print('   ⚠️ %s: su tabla no se pudo leer (¿cambió el formato?)' % sv)
            continue
        # las menciones que no están en la Lista, con su nombre de Discord
        for f in of['filas']:
            if f[3] and not f[0]:
                k, raw, ver, _cc = canon('', f[3])
                f[0] = ver if raw else _nombre_dc(s, f[3], nombres_cache) or 'una cuenta de Discord'
        fuera = {canon(n, '')[0] for n in miembros(ligas_json, R.get('fuera'))}
        compes = []
        if R.get('compes') == 'llaves':
            for v in despues(eventos, sv, of['desde'] or editada[:10], of['nota']):
                n = str(v.get('n'))
                rg = rangos_cache.get(n)
                if not rg:
                    link = (v.get('links') or [''])[0]
                    mm = re.search(r'channels/\d+/(\d+)/(\d+)', link)
                    rg = ''
                    if mm:
                        try:
                            rl = s.get('%s/channels/%s/messages/%s' % (API, mm.group(1), mm.group(2)), timeout=20)
                            rg = rango_de_llave(rl.json().get('content') or '') if rl.ok else ''
                        except (OSError, ValueError):
                            rg = ''
                    if rg:
                        rangos_cache[n] = rg
                if not rg:
                    continue                   # sin rango no suma: así cuenta Snake Rap
                compes.append({'n': v.get('n'), 'nombre': limpio(v.get('nombre')), 'dia': v.get('dia'), 'rango': rg,
                               'filas': [[t[0], t[1], ''] for t in v.get('tabla') or []]})
        elif R.get('compes') == 'podios':
            try:
                rp = s.get('%s/channels/%s/messages?limit=50' % (API, R['podios']), timeout=20)
                ms = rp.json() if rp.ok else []
            except (OSError, ValueError):
                ms = []
            for pm in sorted(ms, key=lambda x: x.get('timestamp') or ''):
                if (pm.get('timestamp') or '')[:19] <= editada:
                    continue
                po = leer_podio(pm.get('content') or '')
                if not po:
                    continue
                dia = _dia_et(pm['timestamp'])
                ser = serie(po['titulo'])
                rg = (R.get('rangos') or {}).get(ser, '')
                # la llave nuestra de esa compe trae TODAS las instancias (Urban cuenta hasta octavos): el mismo día o el
                # anterior, con el mismo campeón
                camp = next((f for f in po['filas'] if f[1] == 'Campeón'), None)
                ev = None
                if camp:
                    kc = canon(camp[0], camp[2])[0]
                    for v in eventos.values():
                        if v.get('sv') != sv or abs((_d(v.get('dia')) - _d(dia)).days) > 1:
                            continue
                        c0 = next((t for t in v.get('tabla') or [] if t[1] == 'Campeón'), None)
                        if c0 and canon(c0[0], '')[0] == kc:
                            ev = v
                filas = [[t[0], t[1], ''] for t in ev['tabla']] if ev else po['filas']
                compes.append({'n': ev.get('n') if ev else None, 'nombre': po['titulo'], 'dia': dia, 'rango': rg,
                               'serie': ser, 'filas': filas})
        A = calcular(R, of, compes, canon, fuera)
        A['oficial'] = {'dia': _dia_et(editada + 'Z') if editada else '', 'nota': of['nota'], 'filas': len(of['filas'])}
        A.update({'n': R.get('n'), 'destino': R.get('destino'), 'suben': R.get('suben', 0), 'playoff': R.get('playoff', 0)})
        out['sv'][sv] = A
        top = ', '.join('%s %s' % (f[0], miles(f[2])) for f in A['filas'][:3])
        print('   📈 %s: %d en la oficial, +%d compe(s) sumada(s), %d pendiente(s) · arriba: %s'
              % (sv, len(of['filas']), len(A['sumado']), len(A['pendiente']), top))
        for p in A['pendiente']:
            print('      ⏳ %s (%s): %s' % (p['evento'], p['dia'], 'falta saber su rango' if p['que'] == 'rango'
                                           else '%s — %s' % (p.get('detalle'), ', '.join(p.get('gente') or []))))
    if not aplicar:
        return len(out['sv'])
    _guardar(SALIDA, out)
    _discord(s, RR, out)
    return len(out['sv'])


def _d(dia):
    try:
        return dt.date.fromisoformat(str(dia)[:10])
    except ValueError:
        return dt.date(2000, 1, 1)


def _dia_et(iso):
    """El día en hora del este de un instante de Discord (UTC)."""
    try:
        t = dt.datetime.fromisoformat(str(iso).replace('Z', '+00:00')[:25])
        if t.tzinfo is None:
            t = t.replace(tzinfo=dt.timezone.utc)
        return (t - dt.timedelta(hours=4)).strftime('%Y-%m-%d')
    except ValueError:
        return str(iso)[:10]


def _discord(s, RR, out):
    """En los servidores que lo prendieron en `/settings` (`cfg:<guild>.ascenso`), el mensaje al día."""
    try:
        import subir_datos as SD
        kv = SD.sesion()
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ sin Cloudflare: no sé qué servidores lo prendieron (%s)' % str(e)[:60])
        return
    svs = (_json(os.path.join(BASE, 'datos', 'servidores.json'), {}) or {}).get('servidores') or {}
    colores = ((_json(os.path.join(BASE, 'datos', 'colores_sv_marca.json'), {}) or {}).get('usar') or {})
    estado = _json(MSGS, {}) or {}
    antes = json.dumps(estado, sort_keys=True)
    for sv, A in (out.get('sv') or {}).items():
        gid = str((svs.get(sv) or {}).get('guild_id') or '')
        if not gid:
            continue
        try:
            rc = kv.get('%s/values/cfg:%s' % (SD.API, gid), timeout=20)
            cfg = rc.json() if rc.status_code == 200 else {}
        except (OSError, ValueError):
            continue
        canal = str((cfg or {}).get('ascenso') or '')
        if not canal:
            continue
        color = int(str(colores.get(sv, '#E41373')).lstrip('#'), 16)
        que = _publicar(s, gid, canal, embed(sv, RR[sv], A, color), estado)
        print('   📈 %s en su canal: %s' % (sv, que))
    if json.dumps(estado, sort_keys=True) != antes:
        _guardar(MSGS, estado)


# ── self-check ────────────────────────────────────────────────────────────────────────────────────────────────────
def _self_check():
    print('\n══ EL ASCENSO DE CADA SERVIDOR ══\n')
    mal = 0

    def ok(c, q, extra=''):
        nonlocal mal
        mal += not c
        print('   %s %s%s' % ('✅' if c else '🔴', q, ('  ' + str(extra)) if extra and not c else ''))

    sr = leer_sr('# 📈 TABLA DE ASCENSO A LA SNAKE LEAGUE 📈 <:snkLIGA:1126248508266123436>\n## 🏅 JUASMIO 🇨🇴 7500\n'
                 '---------------------------\n\n- ABYSSUS 🇵🇦 7100\n\n- COLESITO🇨🇴 6000\n- 7 🇨🇴 1350\n'
                 '- VLADEINK🇨🇴 2.250\n- GIAN 🏳️ 1500\n- POLLO SPORT 🇦🇷  4500\n'
                 '♻️ ASCENSO ACTUALIZADO 29/09/2026 ♻️ TRAS🎙️🥷🏼 RAP EXHIBITION  🥷🏼🎙️ 2/8')
    ok([f[:3] for f in sr['filas']] == [['JUASMIO', 'co', 7500], ['ABYSSUS', 'pa', 7100], ['COLESITO', 'co', 6000],
                                         ['7', 'co', 1350], ['VLADEINK', 'co', 2250], ['GIAN', '', 1500],
                                         ['POLLO SPORT', 'ar', 4500]]
       and sr['desde'] == '2026-09-29' and 'RAP EXHIBITION' in sr['nota'],
       'la tabla de Snake Rap: el primero con 🏅, los demás con guion, sin espacio antes de la bandera, «2.250», 🏳️',
       sr)
    ur = leer_urbf('# <:ps_Up:613040731510013963><:TrofeoLaureles:1471547797869301887> . <@1405241805733105704> 🇦🇷 6.000pts\n'
                   '# 3. <@1538896358679908437> 🇲🇽 4.000pts\n8. **DXG** 🇲🇽 2.000pts\n'
                   '10. <@585582594142371841> 🇨🇴 2.000pts \n19. <@456226577798135808> 🇻🇪 500pts')
    ok([f[1:] for f in ur['filas']] == [['ar', 6000, '1405241805733105704'], ['mx', 4000, '1538896358679908437'],
                                         ['mx', 2000, ''], ['co', 2000, '585582594142371841'],
                                         ['ve', 500, '456226577798135808']] and ur['filas'][2][0] == 'DXG',
       'la tabla de Urban: los dos que suben sin número, las menciones y **NOMBRE**', ur)
    ok([rango_de_llave(t) for t in ('RANGO 4', '[Rango 2️⃣]', '[RANGO 2]', 'RANGO <:3snake:1266108850793222244>',
                                    '[Rango Insignia]', 'RANGOS Y PUNTAJES', 'sin nada', 'RANGO 10')]
       == ['4', '2', '2', '3', 'insignia', '', '', ''],
       'el rango de una llave de Snake: número, keycap, emoji propio e Insignia; sin rango, nada')
    ok(serie('FF Freestyle: Clasico <:gudako:230175075804905474> VOL.1') == 'ff freestyle clasico'
       and serie('CCFF V.2') == 'ccff' and serie('RED BULL NACIONAL ESPAÑA T.5') == 'red bull nacional espana',
       'la serie de una compe, sin su número: el rango es de la serie')
    pd = leer_podio('# CCFF V.2\nCampeon: <@1357796427191029932> \nSubcampeon: BETEL\n@here')
    pf = leer_podio('# FF Freestyle: Clasico <:gudako:230175075804905474> VOL.1 \n<a:Trofeob:1> :  𝄆 CAMPEÓN: Motera<a:Bandera_espana:1>\n'
                    '🥈 𝄆 SUB-CAMPEÓN: Vacile<a:Bandera_espana:1>\n🥉 𝄆 TERCER-PUESTO: Ortiz<a:B:1>')
    ok(pd and pd['filas'] == [['', 'Campeón', '1357796427191029932'], ['BETEL', 'Subcampeón', '']]
       and pf and [f[:2] for f in pf['filas']] == [['Motera', 'Campeón'], ['Vacile', 'Subcampeón'], ['Ortiz', 'Tercero']],
       'los podios de Urban: con mención o con nombre, «SUB-CAMPEÓN» no es campeón', [pd, pf])
    lj = {'ligas': {'g': {'batallas': [['1', '', None, 'SIX', 'DELUXE', 'SIX', 'directa', ''],
                                       ['2', '', 1, 'SIX', 'MCO', 'SIX', 'directa', ''],
                                       ['3', '', 1, 'MCO', 'UKNOW', 'MCO', 'directa', 'b'],
                                       ['4', '', 2, 'MCO', 'SIX', 'MCO', 'directa', ''],
                                       ['5', '', 2, 'FAZER', 'UKNOW', 'FAZER', 'directa', 'b'],
                                       ['6', '', 3, 'FAZER', 'ROAD', 'ROAD', 'directa', '']]}}}
    ok(miembros(lj, ['g']) == {'SIX', 'MCO', 'FAZER'},
       'quién juega la liga: dos batallas o más, sin el 🎮 invitado ni quien jugó una sola (el play-off)',
       miembros(lj, ['g']))
    ev = {'1': {'n': 372, 'sv': 'SR', 'dia': '2026-09-29', 'nombre': 'RAP EXHIBITION 2 8'},
          '2': {'n': 430, 'sv': 'SR', 'dia': '2026-10-08', 'nombre': 'SNAKE INSIGNIA 4 8'},
          '3': {'n': 365, 'sv': 'SR', 'dia': '2026-09-27', 'nombre': 'SNAKE ARENA VOL. 2'},
          '4': {'n': 431, 'sv': 'FFA', 'dia': '2026-10-09', 'nombre': 'X'}}
    ok([v['n'] for v in despues(ev, 'SR', '2026-10-01', sr['nota'])] == [430]
       and [v['n'] for v in despues(ev, 'SR', '2026-09-28', 'algo que no está')] == [372, 430],
       'lo que la tabla no contó: lo posterior al evento que nombra su pie; si no lo nombra, a su fecha')
    R = {'escala': {'2': {'Campeón': 6000, 'Subcampeón': 4500, 'Tercero': 3000},
                    '3': {'Campeón': 3000, 'Subcampeón': 2250, 'Tercero': 1500}},
         'dudas': {'Semifinal': 'sin partido por el 3º'}, 'tabla': {'formato': 'sr'}, 'suben': 2, 'playoff': 1, 'n': 'Snake League'}

    def canon(n, did=''):
        alias = {'over': 'Mr Still Ballin', 'polosport': 'Pollo Sport', 'pollosport': 'Pollo Sport'}
        k = clave(n)
        raw = alias.get(k, '')
        return clave(raw or n), raw, raw or n, ''
    of = {'filas': [['JUASMIO', 'co', 7500, ''], ['OVER', 'uy', 3000, ''], ['POLLO SPORT', 'ar', 4500, '']]}
    compes = [{'n': 430, 'nombre': 'SNAKE INSIGNIA 4', 'dia': '2026-10-08', 'rango': '2',
               'filas': [['MCO', 'Campeón', ''], ['Global Hustler', 'Subcampeón', ''], ['Fazer', 'Tercero', ''],
                         ['PichulaMc', 'Cuarto', '']]},
              {'n': 460, 'nombre': 'GODZ', 'dia': '2026-10-12', 'rango': '3',
               'filas': [['Prosu', 'Campeón', ''], ['Polosport', 'Subcampeón', ''], ['Velatz', 'Semifinal', ''],
                         ['Zignos', 'Semifinal', '']]},
              {'n': 478, 'nombre': 'SNAKE INSIGNIA 5', 'dia': '2026-10-16', 'rango': '2',
               'filas': [['Over', 'Campeón', '']]},
              {'n': None, 'nombre': 'CCFF V.2', 'dia': '2026-09-28', 'rango': '', 'serie': 'ccff', 'filas': []}]
    A = calcular(R, of, compes, canon, {clave('MCO'), clave('Fazer')})
    top = [(f[0], f[2], f[3]) for f in A['filas']]
    ok(top[0] == ('OVER', 9000, 6000) and top[1] == ('JUASMIO', 7500, 0) and ('POLLO SPORT', 6750, 2250) in top
       and ('GLOBAL HUSTLER', 4500, 4500) in top and ('PROSU', 3000, 3000) in top
       and not any(f[0] in ('MCO', 'FAZER', 'PICHULAMC') for f in A['filas']),
       'al día: la oficial más lo que vino después; Over es Mr Still Ballin, quien juega la liga no suma, el 4º de '
       'rango 2 no suma', top)
    ok(any(p['que'] == 'duda' and p['gente'] == ['Velatz', 'Zignos'] for p in A['pendiente'])
       and any(p['que'] == 'rango' and p['compe'] == 'ccff' for p in A['pendiente'])
       and A['sumado'][0]['fuera'] == ['MCO', 'Fazer'],
       'lo que no se sabe no suma y va a las preguntas: dos semifinalistas sin 3º, y una compe sin rango', A['pendiente'])
    # 🏙️ URBAN, SIN PARTIDO POR EL 3º: los dos semifinalistas se llevan los puntos de semifinal (Valen, de URBF, por Dlx
    # el 18/10/2026: «si el evento no hay 3er puesto, en Urban, simplemente los 2 se llevan los puntos de semifinales»).
    # Su escala ya tiene «Semifinal» y no tiene `dudas`: no es la pregunta abierta de Snake Rap
    RU = json.loads(json.dumps(reglas().get('URBF') or {}))
    AU = calcular(RU, {'filas': []}, [{'n': 1, 'nombre': 'X', 'dia': '2026-10-20', 'rango': 'plata',
                                       'filas': [['Ana', 'Campeón', ''], ['Bea', 'Subcampeón', ''], ['Cid', 'Semifinal', ''],
                                                 ['Dan', 'Semifinal', '']]}], canon, set())
    ok(not RU.get('dudas') and [(f[0], f[2]) for f in AU['filas']] == [('Ana', 2000), ('Bea', 1000), ('Cid', 250), ('Dan', 250)]
       and not AU['pendiente'],
       'Urban sin partido por el 3º: los dos semifinalistas suman su «Semifinal» (Valen, 18/10), sin pregunta pendiente',
       AU['filas'])
    e = embed('SR', R, dict(A, oficial={'dia': '2026-10-01'}), 0xE0670B)
    ok(e['description'].startswith('⬆️ **1.** OVER 🇺🇾 · **9.000** `+6.000`') and '🔁 **3.**' in e['description']
       and 'rango 2' in e['fields'][0]['value'].lower() and '⏳' in e['fields'][1]['name'] and '01/10' in e['footer']['text']
       and '<@' not in json.dumps(e),
       'el mensaje: los que suben y el play-off marcados, lo sumado y lo que falta, sin hora adentro ni menciones',
       e['description'][:200])

    class _R:
        def __init__(self, st, js=None):
            self.status_code, self._js, self.ok = st, js or {}, 200 <= st < 300

        def json(self):
            return self._js

    class _S:
        def __init__(self):
            self.hechos = []

        def patch(self, url, json=None, timeout=0):
            self.hechos.append(('PATCH', url))
            return _R(404 if url.endswith('/borrado') else 200)

        def post(self, url, json=None, timeout=0):
            self.hechos.append(('POST', url))
            return _R(200, {'id': 'nuevo'})
    S, est = _S(), {}
    r1 = _publicar(S, 'g', 'c1', e, est)
    r2 = _publicar(S, 'g', 'c1', e, est)
    r3 = _publicar(S, 'g', 'c1', dict(e, description='otra'), est)
    est['g']['msg'] = 'borrado'
    r4 = _publicar(S, 'g', 'c1', dict(e, description='otra más'), est)
    r5 = _publicar(S, 'g', 'c2', dict(e, description='otra más'), est)
    ok([r1, r2, r3, r4, r5] == ['publicado', 'igual', 'editado', 'publicado', 'publicado']
       and [h[0] for h in S.hechos] == ['POST', 'PATCH', 'PATCH', 'POST', 'POST'],
       'un solo mensaje: se publica una vez, igual no se toca, cambiado se edita; borrado o en otro canal, uno nuevo',
       [r1, r2, r3, r4, r5])
    of2 = {'filas': [['', 'mx', 2000, '111'], ['', 'co', 2000, '222'], ['DXG', 'mx', 2000, '']]}

    def canon2(n, did=''):
        return ('id' + did if did else clave(n)), '', n or 'una cuenta de Discord', ''
    B = calcular(R, of2, [], canon2, set())
    ok([f[2] for f in B['filas']] == [2000, 2000, 2000],
       'dos cuentas que no están en la Lista y de las que Discord no dio el nombre NO se juntan: van por su ID',
       B['filas'])
    RR = reglas()
    ok({'SR', 'URBF'} <= set(RR) and all(R2.get('tabla', {}).get('formato') in LECTORES for R2 in RR.values()),
       'las reglas: Snake Rap y Urban Freestyle, cada una con un lector')
    print('\n   %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return mal


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        return 1 if _self_check() else 0
    print('\n══ EL ASCENSO DE CADA SERVIDOR ══\n')
    correr(aplicar='--aplicar' in sys.argv)
    if '--aplicar' not in sys.argv:
        print('   (simulacro: no escribí ni publiqué nada — `--aplicar`)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
