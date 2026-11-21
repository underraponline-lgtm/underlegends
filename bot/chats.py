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
Tanda 2 (17/11/2026; *«Todo sale solo»* y *«Ambos»*):
  · CÓMO SE HABLA, de una LISTA CERRADA (`JERGA`, `RISAS_RX`, `SANOS`): qué palabras de la jerga usa cuánta gente, cómo
    se ríen y qué emoji ponen. Lo que no está en esas listas no se cuenta nunca: ni nombres, ni insultos, ni frases
  · LA VOZ de cada uno (`voz`), SÓLO de quien dijo que sí a los comentarios con su cara (`cm:permisos`): las mismas
    tres cosas y si escribe en minúscula o gritando. De los demás, nada
  · LOS DÍAS FUERTES (`momentos()`): el chat que explotó (el doble de un día normal), el nombre del día (lo mencionó
    mucha gente) y la polémica. Salen solos a las historias de su servidor (`svchat` en bot/muro.py); nunca con lo que
    alguien escribió, nunca con un nombre en una polémica, y nada el día de un raid o una estafa
  · la jerga, la risa, los emoji y la voz los usa bot/comentarios_sim.py (desde su `V3_DESDE`)
Tanda 3 (21/11/2026; Dlx: *«quiero que seas más directo con los chats… que publiques cosas que están pasando. No sólo
que mucha gente está escribiendo. Sino como algo dramático, como noticias sin ser noticias»*):
  · LO QUE ESTÁ PASANDO, con nombre (`hechos()`, de frases CERRADAS como la jerga): quién le pide batalla a quién, a
    quién felicita medio chat, el favorito de la noche, quién anuncia que vuelve o que se retira, y dos que no paran de
    contestarse. Se guarda quién y a quién (claves de la Lista) y cuántos, NUNCA lo que escribió
  · salen como titulares en las historias de su servidor (`momentos()`: hasta `POR_DIA` por servidor y día, lo más
    dramático primero, `ORDEN_QUE`). ⚠️ El día que alguien denuncia un evento falso o un fraude, NINGUNA lleva nombre:
    el de la historia podría ser el acusado. Y el día de un raid, nada

⚠️ El chat general se elige con la MISMA regla que el vigía (`chatGeneralDe()` en bot/avisos.js): si se toca una, la otra.
⚠️ Apagado en el panel del socio (`cfg:<guild>.leer_chat === false`) = no se lee NADA de ese servidor. Si no se puede
   saber (sin Cloudflare), no se lee ninguno: callar es lo seguro.

    python bot/chats.py                # qué haría hoy, sin leer
    python bot/chats.py --aplicar      # lee si toca (una vez por día, desde las 12 PM ET) y guarda
    python bot/chats.py --aplicar --ya # lee aunque ya haya leído hoy
    python bot/chats.py --auto         # self-check, sin red
    python bot/chats.py --probar DRA   # lee las últimas 24 h de un servidor y dice qué saldría, sin guardar ni mandar
    python bot/chats.py --probar DRA --dias 5   # lo mismo con los últimos 5 días
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
#: cuántos días de números se guardan. ⚠️ 40 y no menos: un comentario simulado usa la jerga de los días D-15 a D-2 de
#: su publicación, y la publicación está 21 días en el muro (`muro.DIAS`); si el día se borra antes, el comentario cambia
DIAS = 40
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


# ── lo que está pasando (tanda 3, 21/11/2026) ───────────────────────────────────────────────────────────────────────────
#: 🗞️ LOS HECHOS DE UN MENSAJE, DE FRASES CERRADAS (como la jerga): lo que no encaja no cuenta, y del mensaje se guarda
#: sólo quién y a quién (por mención o porque le contesta). ⚠️ Frases largas a propósito: «me retiro» solo es «me voy a
#: dormir», y «1v1» solo es cualquier charla de un evento
HECHOS = [
    ('reto', re.compile(r'\b(revancha|te reto|los reto|te desafio|batalla conmigo|quiero (una )?batalla (con|contra) vos|'
                        r'quiero (una )?batalla (con|contra) (el|ella|ti)|quiero un 1 ?v ?1|un 1 ?v ?1 (conmigo|contra mi)|cuando quieras|'
                        r'te espero en (la llave|el evento|la final)|tiraera)\b')),
    ('elogio', re.compile(r'\b(gg|felicidades|felicitaciones|te felicito|crack|bestia|monstruo|maquina|la rompi(o|ste)|'
                          r'lo mat(o|aste)|que nivel|nivelazo|merecid(o|isimo)|idolo|humill(o|aste)|god)\b')),
    ('favorito', re.compile(r'\b(va a ganar|gana (hoy|seguro|la final)|mi favorito|es el favorito|apuesto por|le gana a|'
                            r'se lleva (la|el)|no pierde|candidato)\b')),
    ('regreso', re.compile(r'\b((volvi|vuelvo|regrese|regreso) (al freestyle|a rapear|a competir|a los eventos|a la liga|a las batallas)|'
                           r'estoy de vuelta)\b')),
    ('retiro', re.compile(r'\b(me retiro (del freestyle|de las batallas|de la liga|de los eventos|del rap|de competir)|'
                          r'dejo el freestyle|deje el freestyle|mi ultimo evento|mi ultima batalla|'
                          r'me despido de (la liga|las batallas|los eventos))\b')),
]


#: 🔤 LOS NOMBRES DE LA LISTA EN EL TEXTO: un elogio casi nunca menciona con @ («gg mats», «flash la rompió»), así que
#: además de las menciones y las respuestas se busca el nombre escrito. Sólo nombres de `NOMBRE_MIN` letras o más que no
#: son palabras de todos los días (`NO_NOMBRE` y la jerga): «Fuego» sumaría cada «fuego» del chat
NOMBRE_MIN = 4
NO_NOMBRE = {'hola', 'bien', 'todo', 'todos', 'nada', 'nadie', 'game', 'king', 'real', 'dios', 'papa', 'mama', 'final', 'gana', 'gano',
             'liga', 'chat', 'evento', 'batalla', 'rima', 'rimas', 'barra', 'freestyle', 'jaja', 'jajaja', 'noche', 'hoy', 'gracias',
             'campeon', 'rey', 'reina', 'mejor', 'malo', 'bueno', 'buena', 'grande', 'nivel', 'puntos', 'ranking', 'server', 'staff',
             'hermano', 'amigo', 'amiga', 'leyenda', 'demonio', 'diablo', 'angel', 'sombra', 'fantasma', 'lobo', 'tigre', 'leon',
             'ninja', 'master', 'goat', 'zero', 'cero', 'nose', 'claro', 'ahora', 'ayer', 'semana', 'tarjeta', 'carta',
             # 🔎 los de la Lista que también son palabras de todos los días (revisados a mano el 21/11/2026, de los 718 cortos)
             'alone', 'blood', 'blue', 'byte', 'cajita', 'char', 'chase', 'choco', 'compare', 'crash', 'cult', 'dash', 'dead', 'delta',
             'deluxe', 'delux', 'fatiga', 'fear', 'fecha', 'flama', 'flex', 'focus', 'frost', 'ghost', 'glad', 'guess', 'heat', 'icon',
             'ironia', 'karma', 'last', 'lazy', 'lover', 'luck', 'lucky', 'magic', 'magma', 'mate', 'matriz', 'metro', 'milagro', 'mini',
             'minis', 'molusco', 'navidad', 'nene', 'nova', 'number', 'omega', 'onfire', 'over', 'painter', 'perdido', 'player', 'polenta',
             'prodigy', 'queen', 'raven', 'refran', 'relic', 'respawn', 'road', 'sexo', 'shadow', 'silaba', 'snake', 'snow', 'soft',
             'solar', 'status', 'tema', 'tenor', 'tier', 'umbral', 'under', 'venus', 'vices', 'young', 'pibe', 'pipe', 'colo', 'mazo',
             'villa', 'reyes', 'santos', 'cruz', 'flores', 'enigma', 'astral', 'astro', 'argent', 'liberia', 'icono', 'fenix', 'lyric',
             'noone', 'arts', 'rich', 'lokk', 'kako', 'mosaic', 'brutal', 'crack', 'bestia'}


def _palabras_de_eventos():
    """Las palabras de los nombres de los servidores y de los eventos (las siglas, «CHOP», «GRISELDA»): un nombre de la Lista
    que también es el de un evento («chop» de CHOP ES CEO) contaría cada vez que alguien habla del evento."""
    out = set()
    for sv, x in ((_j(os.path.join(BASE, 'datos', 'servidores.json'), {}) or {}).get('servidores') or {}).items():
        out |= set(_norm(sv).split()) | set(_norm((x or {}).get('nombre')).split())
    cuenta = {}
    for v in (_j(os.path.join(BASE, 'datos', 'llaves_t1.json'), {}) or {}).values():
        for w in set(_norm((v or {}).get('nombre')).split()):
            cuenta[w] = cuenta.get(w, 0) + 1
    return out | {w for w, n in cuenta.items() if n >= 2}


def por_nombre():
    """`(regex, {nombre escrito: clave})` de la Lista (`datos/padron.json`), para encontrar a alguien nombrado en el texto."""
    from comun.claves import clave
    fuera = _palabras_de_eventos()
    m = {}
    for p in _j(os.path.join(BASE, 'datos', 'padron.json'), []) or []:
        raw = str((p or {}).get('raw') or '').strip()
        n = _norm(re.sub('[\U0001F1E6-\U0001F1FF\ufe0f]', '', raw))
        if (raw and len(n.replace(' ', '')) >= NOMBRE_MIN and not n.replace(' ', '').isdigit() and n not in NO_NOMBRE and n not in JERGA
                and n not in fuera):
            m.setdefault(n, clave(raw))
    if not m:
        return None, {}
    return re.compile(r'(?<![a-z0-9])(%s)(?![a-z0-9])' % '|'.join(re.escape(n) for n in sorted(m, key=len, reverse=True))), m


def hechos(texto):
    """Los hechos de un mensaje, de las frases cerradas de `HECHOS`: `{'reto', 'elogio', …}`."""
    t = ' ' + re.sub(r'\s+', ' ', _norm(texto)) + ' '
    return {h for h, rx in HECHOS if rx.search(t)}


# ── cómo se habla (tanda 2) ────────────────────────────────────────────────────────────────────────────────────────────
#: 🗣️ LA JERGA QUE SE CUENTA: una lista CERRADA, sin tildes. Lo que no está acá no se cuenta nunca: ni nombres, ni
#: insultos, ni nada de nadie. Cada una con dónde puede ir en un comentario: 'a' adelante («bro, …»), 'd' atrás
#: («… papu»), 's' sola, como festejo («buenardo»). ⚠️ Nada de palabras que también son otra cosa («mano», «causa»):
#: contarían de más
JERGA = {'bro': 'ad', 'brother': 'a', 'bruh': 'a', 'papu': 'd', 'manito': 'a', 'hermano': 'ad', 'pana': 'd', 'parce': 'ad',
         'chamo': 'a', 'loco': 'ad', 'compa': 'd', 'mi rey': 'd', 'wey': 'ad', 'che': 'a', 'uff': 'a', 'uy': 'a', 'wow': 'a',
         'sheesh': 'as', 'epa': 'a', 'asu': 'a', 'ombe': 'a', 'oe': 'a', 'chale': 'a', 'orale': 'a', 'pucha': 'a', 'nah': 'a',
         'god': 's', 'buenardo': 's', 'basado': 's', 'fuego': 's', 'tremendo': 's', 'brutal': 's', 'bestial': 's', 'crack': 's',
         'nashe': 's', 'epico': 's', 'insano': 's', 'facha': 's', 'bacan': 's', 'chevere': 's', 'chido': 's', 'temazo': 's',
         'barras': 's', 'flow': 's', 'goat': 's',
         # 🎤 la jerga del freestyle (21/11/2026): las reacciones a una batalla
         'que barra': 's', 'rimon': 's', 'la rompio': 's', 'lo mato': 's', 'humillo': 's', 'nivelazo': 's', 'que nivel': 's',
         'bestia': 's', 'maquina': 's', 'mamalon': 's', 'que flow': 's'}
#: cómo se escribe cada una en un comentario
MOSTRAR = {'orale': 'órale', 'epico': 'épico', 'bacan': 'bacán', 'chevere': 'chévere', 'que barra': 'qué barra', 'rimon': 'qué rimón',
           'la rompio': 'la rompió', 'lo mato': 'lo mató', 'humillo': 'humilló', 'que nivel': 'qué nivel', 'maquina': 'máquina',
           'mamalon': 'mamalón', 'que flow': 'qué flow'}
JERGA_RX = re.compile(r'(?<![a-z0-9])(%s)(?![a-z0-9])' % '|'.join(re.escape(j) for j in sorted(JERGA, key=len, reverse=True)))
#: 😂 cómo se ríe: la familia de cada palabra (la primera que encaja). Mayúsculas, aparte: «JAJAJA» no es «jaja»
RISAS_RX = [('jsjs', re.compile(r'(?:js)+j?|jsj[sj]*')), ('jajsj', re.compile(r'(?=[jas]*s)(?=[jas]*a)j[jas]{4,}')),
            ('jaja', re.compile(r'(?:ja)+j?|ja+j+a[ja]*')), ('jeje', re.compile(r'(?:je)+j?')), ('jiji', re.compile(r'(?:ji)+j?')),
            ('xd', re.compile(r'x+d+')), ('lol', re.compile(r'lol|lmao|lmfao')), ('kkk', re.compile(r'k{3,}'))]
#: los emoji que se cuentan: sólo de reacción. ⚠️ Lista cerrada a propósito: los que no están (los groseros) no salen
#: nunca en un comentario
SANOS = set('😂🤣💀🔥👏🙌💪😎🥶😳👀😮😱🤯💯🎤🏆👑🎯😭🫡🤝✨⚡😤🥵🙏😏🤙👌🐐😈🥳🎉🤩😍🫶')
EMOJI_RX = re.compile('[\U0001F300-\U0001FAFF\u2600-\u27BF]')


def _risa(tok):
    t = tok.lower()
    if len(t) < 2:
        return ''
    for fam, rx in RISAS_RX:
        if rx.fullmatch(t) and (len(t) >= 4 or fam in ('xd', 'lol')):
            return fam.upper() if fam in ('jaja', 'jsjs') and tok.isupper() and len(tok) >= 4 else fam
    return ''


def como_habla(texto):
    """`(jerga, risas, emoji, en minúscula, gritando)` de un mensaje, sólo con lo de las listas cerradas."""
    t = re.sub(r'<a?:\w+:\d+>|<[@#&!]+\d+>|https?://\S+', ' ', str(texto or ''))
    jer = set(JERGA_RX.findall(_norm(t)))
    toks = re.findall(r'[^\W\d_]+', t)
    risas = {r for r in (_risa(x) for x in toks) if r}
    emo = {e for e in EMOJI_RX.findall(t.replace('\ufe0f', '')) if e in SANOS}
    letras = ''.join(x for x in toks if not _risa(x))
    return jer, risas, emo, bool(letras) and letras == letras.lower(), len(letras) >= 4 and letras == letras.upper()


# ── los números ────────────────────────────────────────────────────────────────────────────────────────────────────────
MENCION = re.compile(r'<@!?(\d{5,25})>')


def _ms(snowflake):
    return (int(snowflake) >> 22) + 1420070400000


def _snow(ms):
    return str((int(ms) - 1420070400000) << 22)


def _vacio():
    return {'msgs': 0, 'gente': 0, 'hora': [0] * 24, 'habla': {}, 'menciona': {}, 'mencionan': {}, 'jerga': {}, 'risa': {},
            'emoji': {}, 'motivos': {}, 'retos': {}, 'elogios': {}, 'favoritos': {}, 'regresos': {}, 'retiros': {}, 'responde': {}}


def _mas(d, k, n=1):
    d[k] = d.get(k, 0) + n


def contar(mensajes, por_id, dias=None, si=(), nombres=None):
    """`{dia ET: {msgs, gente, hora: [24], habla, menciona, mencionan, jerga, risa, emoji, motivos, voz?}}` de una lista de
    mensajes de un canal (`[{id, autor, bot, texto, menciona?}]`). Los bots no cuentan; las claves, sólo de gente de la
    Lista. `mencionan` y `jerga` cuentan PERSONAS distintas (uno que repite no infla nada); `voz`, sólo de las claves de
    `si` (dijeron que sí a los comentarios con su cara). `nombres`, lo de `por_nombre()` (tanda 3: quién está nombrado)."""
    rx_n, por_n = nombres if nombres else (None, {})
    out = dias if dias is not None else {}
    si = set(si or ())
    gente, sets = {}, {}
    for m in mensajes:
        if m.get('bot'):
            continue
        d = dt.datetime.fromtimestamp(_ms(m['id']) / 1000, dt.timezone.utc).astimezone(_et())
        dia = d.strftime('%Y-%m-%d')
        x = out.setdefault(dia, _vacio())
        for c, v in _vacio().items():
            x.setdefault(c, v)
        x['msgs'] += 1
        x['hora'][d.hour] += 1
        a = str(m.get('autor'))
        gente.setdefault(dia, set()).add(a)
        s = sets.setdefault(dia, {'mencionan': {}, 'jerga': {}, 'elogios': {}, 'favoritos': {}})
        k = por_id.get(a)
        if k:
            _mas(x['habla'], k)
        objetivos = set()
        # 🔤 tanda 3: el nombre escrito también es una mención («todo el chat habla de…» casi nunca usa @)
        escritos = {por_n.get(n) for n in rx_n.findall(_norm(m.get('texto')))} if rx_n else set()
        ids = set(m.get('menciona') or MENCION.findall(m.get('texto') or ''))
        for km in {por_id.get(str(i)) for i in ids} | escritos:
            if km and km != k:
                _mas(x['menciona'], km)
                s['mencionan'].setdefault(km, set()).add(a)
                objetivos.add(km)
        # 🗞️ tanda 3: a quién le contesta y qué pasa (claves y números, nunca el texto)
        kr = por_id.get(str(m.get('ref') or ''))
        if kr and kr != k:
            objetivos.add(kr)
            if k:
                _mas(x['responde'], k + '>' + kr)
        hs = hechos(m.get('texto'))
        for b in objetivos:
            if 'reto' in hs and k:
                _mas(x['retos'], k + '>' + b)
            for h, c in (('elogio', 'elogios'), ('favorito', 'favoritos')):
                if h in hs:
                    s[c].setdefault(b, set()).add(a)
        for h, c in (('regreso', 'regresos'), ('retiro', 'retiros')):
            if k and h in hs:
                x[c][k] = 1
        jer, ris, emo, mi, ma = como_habla(m.get('texto'))
        for j in jer:
            s['jerga'].setdefault(j, set()).add(a)
        for r in ris:
            _mas(x['risa'], r)
        for e in emo:
            _mas(x['emoji'], e)
        mot = importante(m.get('texto'))
        if mot:
            _mas(x['motivos'], mot)
        if k and k in si:
            v = x.setdefault('voz', {}).setdefault(k, {'m': 0, 'mi': 0, 'ma': 0, 'j': {}, 'r': {}, 'e': {}})
            v['m'] += 1
            v['mi'] += 1 if mi else 0
            v['ma'] += 1 if ma else 0
            for j in jer:
                _mas(v['j'], j)
            for r in ris:
                _mas(v['r'], r)
            for e in emo:
                _mas(v['e'], e)
    for dia, g in gente.items():
        out[dia]['gente'] = max(out[dia].get('gente', 0), len(g))
        for c, d_ in sets[dia].items():
            for k, quienes in d_.items():
                out[dia][c][k] = max(out[dia][c].get(k, 0), len(quienes))
    return out


def _sumar(y, x):
    """Suma un día de una lectura (`x`) al que ya estaba (`y`): los mensajes se suman; la gente, quiénes mencionan y la
    jerga (que cuentan personas) se quedan con el mayor, para no contar dos veces a la misma persona."""
    for c, v in _vacio().items():
        y.setdefault(c, v)
    y['msgs'] += x.get('msgs', 0)
    y['gente'] = max(y['gente'], x.get('gente', 0))
    y['hora'] = [a + b for a, b in zip(y['hora'] or [0] * 24, x.get('hora') or [0] * 24)]
    for c in ('habla', 'menciona', 'risa', 'emoji', 'motivos', 'retos', 'responde'):
        for k, n in (x.get(c) or {}).items():
            _mas(y[c], k, n)
    for c in ('mencionan', 'jerga', 'elogios', 'favoritos', 'regresos', 'retiros'):
        for k, n in (x.get(c) or {}).items():
            y[c][k] = max(y[c].get(k, 0), n)
    for k, v in (x.get('voz') or {}).items():
        w = y.setdefault('voz', {}).setdefault(k, {'m': 0, 'mi': 0, 'ma': 0, 'j': {}, 'r': {}, 'e': {}})
        for c in ('m', 'mi', 'ma'):
            w[c] += v.get(c, 0)
        for c in ('j', 'r', 'e'):
            for kk, n in (v.get(c) or {}).items():
                _mas(w[c], kk, n)
    return _recortar(y)


def _top(d, n):
    return dict(sorted((d or {}).items(), key=lambda kv: (-kv[1], kv[0]))[:n])


def _recortar(x, n=15):
    """Sólo lo de arriba de cada cosa: el archivo no crece con todo el chat."""
    for c in ('habla', 'menciona', 'mencionan'):
        if c in x or c in ('habla', 'menciona'):
            x[c] = _top(x.get(c), n)
    for c, tope in (('jerga', 40), ('emoji', 12), ('risa', 9), ('retos', 10), ('responde', 15), ('elogios', 10), ('favoritos', 10),
                    ('regresos', 10), ('retiros', 10)):
        if c in x:
            x[c] = _top(x[c], tope)
    for v in (x.get('voz') or {}).values():
        v['j'], v['r'], v['e'] = _top(v.get('j'), 10), _top(v.get('r'), 4), _top(v.get('e'), 6)
    return x


# ── los días fuertes, para las historias (tanda 2) ─────────────────────────────────────────────────────────────────────
#: 📈 el chat que explotó: al menos `PICO_MIN` mensajes, y el doble (y `PICO_MAS` más) que un día normal de ese servidor
#: (la mediana de sus 7 días de antes). Sin 3 días de antes todavía, sólo un día de `PICO_SOLO`
PICO_MIN, PICO_X, PICO_MAS, PICO_SOLO = 120, 2.0, 80, 400
#: 🗣️ el nombre del día: lo mencionaron al menos tantas personas distintas
TEMA_GENTE = 6
#: 🔥 polémica: el chat que explotó, con al menos tantos mensajes que importan de estos motivos
POLEMICA, MOTIVOS_POLEMICA = 2, ('evento falso', 'fraude', 'queja de la liga')
#: 🗞️ tanda 3: cuánto hace falta para cada historia con nombre. Un reto, dos mensajes (o uno de cada lado: «se tienen
#: ganas»); felicitar y dar favorito, gente DISTINTA; cara a cara, tantas respuestas de cada uno al otro
RETO_MIN, ELOGIO_MIN, FAVORITO_MIN, CARA_MIN = 2, 5, 4, 4
#: cuántas historias del chat por servidor y día, como mucho, y cuál va primero
POR_DIA = 2
ORDEN_QUE = ('reto', 'cara', 'retiro', 'regreso', 'elogio', 'favorito', 'polemica', 'pico', 'tema')


def _dia_et(s):
    try:
        t = dt.datetime.fromisoformat(str(s).replace('Z', '+00:00'))
    except ValueError:
        return ''
    return t.astimezone(_et()).strftime('%Y-%m-%d')


def _nombres():
    """`{clave: nombre}` de la Lista (`datos/padron.json`), sin la bandera: para los titulares y los comentarios."""
    from comun.claves import clave
    out = {}
    for p in _j(os.path.join(BASE, 'datos', 'padron.json'), []) or []:
        raw = str((p or {}).get('raw') or '').strip()
        if raw:
            out.setdefault(clave(raw), re.sub('[\U0001F1E6-\U0001F1FF\ufe0f]', '', raw).strip())
    return out


def hechos_del_dia(x):
    """🗞️ Las historias con nombre de un día de un servidor: `[{que, ks, n?, mutuo?}]`. Pura."""
    out = []
    retos = x.get('retos') or {}
    mejor = None
    for ab, n in sorted(retos.items()):
        a, _, b = ab.partition('>')
        vuelta = retos.get(b + '>' + a, 0)
        if a and b and (n >= RETO_MIN or vuelta):
            fuerza = (1 if vuelta else 0, n + vuelta)
            if not mejor or fuerza > mejor[0]:
                mejor = (fuerza, a, b, bool(vuelta), n + vuelta)
    if mejor:
        out.append({'que': 'reto', 'ks': [mejor[1], mejor[2]], 'mutuo': mejor[3], 'n': mejor[4]})
    resp = x.get('responde') or {}
    caras = []
    for ab, n in resp.items():
        a, _, b = ab.partition('>')
        if a and b and a < b and n >= CARA_MIN and resp.get(b + '>' + a, 0) >= CARA_MIN:
            caras.append((n + resp[b + '>' + a], a, b))
    if caras:
        n, a, b = max(caras)
        if not (mejor and {a, b} == {mejor[1], mejor[2]}):
            out.append({'que': 'cara', 'ks': [a, b], 'n': n})
    habla = x.get('habla') or {}
    for que, campo in (('retiro', 'retiros'), ('regreso', 'regresos')):
        ks = sorted(x.get(campo) or {}, key=lambda k: (-habla.get(k, 0), k))
        if ks:
            out.append({'que': que, 'ks': ks[:1]})
    for que, campo, minimo in (('elogio', 'elogios', ELOGIO_MIN), ('favorito', 'favoritos', FAVORITO_MIN)):
        d = x.get(campo) or {}
        k = max(sorted(d), key=lambda k: d[k]) if d else None
        if k and d[k] >= minimo:
            out.append({'que': que, 'ks': [k], 'n': d[k]})
    return out


def momentos(chats, camps=None, nombres=None):
    """💬 Los días fuertes del chat general de cada servidor, como publicaciones `svchat` del muro:
    `{tipo, t, sv, dia, que: 'pico'|'tema'|'polemica', msgs, gente, h, en_h, x?, hablan?, ev?, ll?}`.

    Sólo días que ya terminaron (antes del de la última lectura). Uno por servidor y día. ⚠️ Lo que NO sale nunca: lo
    que alguien escribió (sólo números), un nombre en una polémica (ni el día que alguien denunció un evento falso o un
    fraude: el nombre del día podría ser el acusado), el evento de esa noche en una polémica (se leería como que el
    evento es el falso) y nada del día de un raid o una estafa (el chat explotó, pero por eso). `camps`, los campeones
    del muro: el evento de esa noche en ese servidor.

    🗞️ Tanda 3 (21/11/2026): también las historias CON NOMBRE de `hechos_del_dia()` (`que`: reto, cara, retiro, regreso,
    elogio, favorito; con `ks` y `quien`), hasta `POR_DIA` por servidor y día, en el orden de `ORDEN_QUE`. Nunca el día
    de una denuncia (cualquier mensaje de evento falso, fraude o queja: el nombre podría ser el acusado), ni el de un raid.
    `nombres`, `{clave: nombre}` (sin él, el padrón)."""
    dias = (chats or {}).get('dias') or {}
    nombres = _nombres() if nombres is None else nombres
    leido = str((chats or {}).get('leido') or '')
    orden = sorted(dias)
    out = []
    for i, d in enumerate(orden):
        if not leido or d >= leido:
            continue
        for sv, x in sorted((dias[d] or {}).items()):
            mot = x.get('motivos') or {}
            if mot.get('seguridad'):
                continue
            msgs = int(x.get('msgs') or 0)
            antes = [int(dias[e][sv].get('msgs') or 0) for e in orden[max(0, i - 7):i] if sv in (dias[e] or {})]
            base = sorted(antes)[len(antes) // 2] if len(antes) >= 3 else None
            if base is None:
                pico = msgs >= PICO_SOLO
            else:
                pico = msgs >= PICO_MIN and msgs >= PICO_X * max(base, 1) and msgs - base >= PICO_MAS
            fuerte = sum(int(mot.get(m) or 0) for m in MOTIVOS_POLEMICA)
            polemica = pico and fuerte >= POLEMICA
            hablan = [] if fuerte else [k for k, n in sorted((x.get('mencionan') or {}).items(), key=lambda kv: (-kv[1], kv[0]))
                                        if n >= TEMA_GENTE][:3]
            cands = [] if fuerte else hechos_del_dia(x)
            if polemica:
                cands.append({'que': 'polemica'})
            elif pico:
                cands.append({'que': 'pico'})
            elif hablan:
                cands.append({'que': 'tema'})
            if not cands:
                continue
            hora = (x.get('hora') or [0] * 24)[:24]
            h = max(range(24), key=lambda j: (hora[j], -j))
            y, mo, dd = (int(p) for p in d.split('-'))
            t = dt.datetime(y, mo, dd, h, 30, tzinfo=_et()).astimezone(dt.timezone.utc)
            evs = [c for c in camps or [] if c.get('sv') == sv and _dia_et(c.get('t')) == d]
            ev = max(evs, key=lambda c: str(c.get('t') or '')) if evs else None
            for c in sorted(cands, key=lambda c: ORDEN_QUE.index(c['que']))[:POR_DIA]:
                z = {'tipo': 'svchat', 't': t.strftime('%Y-%m-%dT%H:%M:%SZ'), 'sv': sv, 'dia': d,
                     'msgs': msgs, 'gente': int(x.get('gente') or 0), 'h': h, 'en_h': int(hora[h]), 'hs': [int(n) for n in hora]}
                z.update(c)
                if pico and base:
                    z['x'] = round(msgs / max(base, 1), 1)
                if hablan and not polemica and c['que'] in ('pico', 'tema'):
                    z['hablan'] = hablan
                if c.get('ks'):
                    z['quien'] = [nombres.get(k) or k for k in c['ks']]
                if not polemica and ev:
                    z['ev'], z['ll'] = ev.get('ev') or '', ev.get('ll')
                out.append(z)
    return out


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
                        'texto': m.get('content') or '', 'menciona': [str(u.get('id')) for u in m.get('mentions') or []],
                        # 💬 a quién le contesta (tanda 3): de ahí salen «cara a cara» y el destinatario de un reto
                        'ref': str((((m.get('referenced_message') or {}).get('author')) or {}).get('id') or '')})
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


def _si():
    """Las claves de quienes dijeron que sí a los comentarios con su cara (`cm:permisos`); sin Cloudflare, nadie."""
    try:
        import subir_datos as SD
        import comentarios_sim as CS
        return CS.permisos(SD.sesion())['si']
    except Exception:                                    # noqa: BLE001
        return set()


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
    pnom = por_nombre()
    si = _si()
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
        nuevos = contar(ms, pid, si=si, nombres=pnom)
        for dia, x in nuevos.items():
            _sumar(dias.setdefault(dia, {}).setdefault(sv, _vacio()), x)
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
    # 🗣️ tanda 2: cómo se habla, de las listas cerradas
    j, r, e, mi, ma = como_habla('JAJAJA bro qué final 🔥🔥 🖕 <@12345> https://x.y/bro')
    ok(j == {'bro'} and r == {'JAJA'} and e == {'🔥'} and mi and not ma,
       'la jerga, la risa y el emoji de la lista; el emoji grosero, las menciones y los links no cuentan; la risa no hace gritar')
    ok(como_habla('nashe jsjsjs, mi rey')[:2] == ({'nashe', 'mi rey'}, {'jsjs'}) and como_habla('jajsjsjajs xd')[1] == {'jajsj', 'xd'}
       and como_habla('jajaja')[1] == {'jaja'} and como_habla('hola mano, a causa de eso')[0] == set()
       and como_habla('ESO ES TODO')[4] and como_habla('eso es todo')[3] and como_habla('')[0] == set(),
       'cada risa en su familia, y lo que no está en la lista (ni «mano» ni «causa») no se cuenta')
    ms2 = [{'id': _snow(base + i * 1000), 'autor': a, 'texto': t} for i, (a, t) in enumerate(
        [('11111', 'bro qué final jaja'), ('11111', 'bro bro bro'), ('22222', 'bro 🔥'), ('33333', 'evento falso, nunca se jugo'),
         ('22222', 'hola <@11111>'), ('33333', '<@11111> grande')])]
    y2 = contar(ms2, {'11111': 'ana', '22222': 'bea', '33333': 'cami'}, si={'bea'})['2026-11-17']
    ok(y2['jerga'] == {'bro': 2} and y2['mencionan'] == {'ana': 2} and y2['menciona'] == {'ana': 2} and y2['motivos'] == {'evento falso': 1}
       and list(y2['voz']) == ['bea'] and y2['voz']['bea']['j'] == {'bro': 1} and y2['voz']['bea']['e'] == {'🔥': 1},
       'la jerga y quién menciona cuentan PERSONAS (Ana dijo «bro» cuatro veces: una); la voz, sólo de quien dijo que sí')
    z = _sumar(contar(ms2[:3], {'11111': 'ana', '22222': 'bea'})['2026-11-17'], contar(ms2[3:], {'11111': 'ana', '22222': 'bea'})['2026-11-17'])
    ok(z['msgs'] == 6 and z['jerga'] == {'bro': 2} and z['menciona'] == {'ana': 2},
       'dos lecturas del mismo día se suman sin contar dos veces a la misma persona')
    # 📈 los días fuertes
    def dia(m, **kw):
        x = dict(_vacio(), msgs=m, gente=kw.pop('g', 30))
        x['hora'] = [0] * 24
        x['hora'][kw.pop('h', 22)] = m
        x.update(kw)
        return x
    normal = {'2026-11-%02d' % d: {'DRA': dia(100), 'FFA': dia(50)} for d in range(1, 8)}
    ch = {'leido': '2026-11-12', 'dias': dict(normal, **{
        '2026-11-08': {'DRA': dia(420, mencionan={'konan': 9, 'bea': 2}), 'FFA': dia(60)},
        '2026-11-09': {'DRA': dia(500, motivos={'evento falso': 2}, mencionan={'konan': 12}), 'FFA': dia(300, motivos={'seguridad': 1})},
        '2026-11-10': {'DRA': dia(110, mencionan={'tam': 7})},
        '2026-11-12': {'DRA': dia(900)}})}
    mo = momentos(ch, [{'tipo': 'campeon', 'sv': 'DRA', 't': '2026-11-09T02:30:00Z', 'ev': 'COPA', 'll': 7}])
    por = {(m['dia'], m['sv']): m for m in mo}
    p8 = por.get(('2026-11-08', 'DRA')) or {}
    ok(p8.get('que') == 'pico' and p8.get('x') == 4.2 and p8.get('hablan') == ['konan'] and p8.get('ev') == 'COPA' and p8.get('t') == '2026-11-09T03:30:00Z',
       'el chat que explotó: cuántas veces un día normal, de quién se habló y el evento de esa noche (las 10 PM ET de ese día)')
    p9 = por.get(('2026-11-09', 'DRA')) or {}
    ok(p9.get('que') == 'polemica' and 'hablan' not in p9 and 'ev' not in p9,
       'la polémica: sin nombres y sin el evento')
    ok(('2026-11-09', 'FFA') not in por and ('2026-11-12', 'DRA') not in por and por.get(('2026-11-10', 'DRA'), {}).get('que') == 'tema'
       and not any(k[1] == 'FFA' and k[0] < '2026-11-09' for k in por),
       'nada el día de un raid, nada del día que todavía no terminó, el nombre del día sin pico, y un día normal no sale')
    ok(momentos({'leido': '2026-11-03', 'dias': {'2026-11-02': {'DRA': dia(390)}}}) == []
       and len(momentos({'leido': '2026-11-03', 'dias': {'2026-11-02': {'DRA': dia(400)}}})) == 1,
       'sin días de antes, sólo un día enorme')
    # 🗞️ tanda 3: los hechos, con nombre
    ok(hechos('<@1> te reto a una revancha') == {'reto'} and hechos('GG crack, la rompiste') == {'elogio'}
       and hechos('va a ganar hoy seguro') == {'favorito'} and hechos('vuelvo a los eventos este finde') == {'regreso'}
       and hechos('me retiro del freestyle, gracias a todos') == {'retiro'} and hechos('me retiro a dormir jaja') == set()
       and hechos('hoy hay 1v1 en la llave') == set() and hechos('hola gente') == set(),
       'los hechos, de frases cerradas: «me retiro a dormir» y «hay 1v1» no son nada')
    pid = {'11111': 'ana', '22222': 'bea', '33333': 'cami', '44444': 'dani', '55555': 'eli', '66666': 'fede', '77777': 'gabi'}
    ms3 = [{'id': _snow(base + i * 1000), 'autor': a, 'texto': t, 'ref': r} for i, (a, t, r) in enumerate(
        [('11111', '<@22222> te reto, revancha ya', ''), ('11111', 'cuando quieras', '22222')]
        + [(p, 'gg crack <@22222>', '') for p in ('33333', '44444', '55555', '66666', '77777')]
        + [('33333', 'me retiro del freestyle', '')]
        + [(a, 'y?', b) for a, b in (('44444', '55555'), ('55555', '44444')) * 4])]
    y3 = contar(ms3, pid)['2026-11-17']
    ok(y3['retos'] == {'ana>bea': 2} and y3['elogios'] == {'bea': 5} and y3['retiros'] == {'cami': 1}
       and y3['responde'].get('dani>eli') == 4 and y3['responde'].get('eli>dani') == 4 and y3['responde'].get('ana>bea') == 1,
       'contar los hechos: claves y cuántos (a quién por mención o porque le contesta), sin guardar ningún texto')
    nm = (__import__('re').compile(r'(?<![a-z0-9])(bea|rodri lp)(?![a-z0-9])'), {'bea': 'bea', 'rodri lp': 'rodrilp'})
    y5 = contar([{'id': _snow(base + i * 1000), 'autor': a, 'texto': t} for i, (a, t) in enumerate(
        [('33333', 'gg bea, la rompiste'), ('44444', 'rodri lp crack'), ('55555', 'bea nada que ver jaja')])], pid, nombres=nm)['2026-11-17']
    ok(y5['elogios'] == {'bea': 1, 'rodrilp': 1}, 'el nombre escrito también cuenta (sólo si el mensaje es un elogio) %s' % y5['elogios'])
    hd = hechos_del_dia(y3)
    ok([h['que'] for h in hd] == ['reto', 'cara', 'retiro', 'elogio'] and hd[0]['ks'] == ['ana', 'bea'] and not hd[0]['mutuo']
       and hd[1]['ks'] == ['dani', 'eli'] and hd[3] == {'que': 'elogio', 'ks': ['bea'], 'n': 5},
       'las historias con nombre del día: el reto, cara a cara, el retiro y a quién felicitó medio chat')
    ch3 = {'leido': '2026-11-18', 'dias': {'2026-11-17': {'DRA': dict(y3)}}}
    m3 = momentos(ch3, [], {'ana': 'Ana', 'bea': 'Bea'})
    ok([m['que'] for m in m3] == ['reto', 'cara'] and m3[0]['quien'] == ['Ana', 'Bea'] and m3[1]['quien'] == ['dani', 'eli'],
       'como mucho dos por servidor y día, lo más dramático primero, con el nombre de la Lista')
    ch4 = {'leido': '2026-11-18', 'dias': {'2026-11-17': {'DRA': dict(y3, motivos={'fraude': 1})}}}
    ok(momentos(ch4, [], {}) == [], 'el día de una denuncia, ninguna historia con nombre (podría ser el acusado)')
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


def probar(sv, dias=1):
    """Lee las últimas 24 h (o `dias` días) de UN servidor y muestra los números y cuántos importan (con su motivo, sin el texto). No
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
    ms = leer(s, canal, _snow(int(time.time() * 1000) - dias * 24 * 3600 * 1000), tope=TOPE * dias)
    for dia, x in sorted(contar(ms, por_id(), nombres=por_nombre()).items()):
        _recortar(x, 5)
        print('   %s: %d mensajes, %d personas, hablan %s · los nombran %s' % (dia, x['msgs'], x['gente'], x['habla'], _top(x['mencionan'], 4)))
    mot = {}
    for m in ms:
        k = '' if m['bot'] else importante(m['texto'])
        if k:
            mot[k] = mot.get(k, 0) + 1
    print('   que importan: %s' % (mot or 'ninguno'))
    # 🗞️ tanda 3: qué historias con nombre saldrían (claves, nunca el texto)
    for dia, x in sorted(contar(ms, por_id(), nombres=por_nombre()).items()):
        print('   %s: retos %s · elogios %s · favoritos %s · regresos %s · retiros %s' % (
            dia, _top(x['retos'], 5), _top(x['elogios'], 5), _top(x['favoritos'], 5), list(x['regresos']), list(x['retiros'])))
        print('      historias: %s' % ([(h['que'], h['ks'], h.get('n')) for h in hechos_del_dia(x)] or 'ninguna'))
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
        return probar(a[i + 1] if i + 1 < len(a) else 'DRA', int(a[a.index('--dias') + 1]) if '--dias' in a else 1)
    return correr(aplicar='--aplicar' in a, ya='--ya' in a)


if __name__ == '__main__':
    sys.exit(main())
