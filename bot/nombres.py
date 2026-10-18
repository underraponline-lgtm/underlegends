# -*- coding: utf-8 -*-
"""👤 EL RECONOCIMIENTO DE NOMBRES, EN UN SOLO LUGAR.

    python bot/nombres.py "TöKīØ" "l3wito"   a quién reconoce cada uno, y por qué camino
    python bot/nombres.py --auto             el self-check, sin red

Dlx, 18/10/2026: *«asegurate de integrar ese sistema de reconocimiento de nombres en general, no sólo para esos 2
casos»*, y después: *«eso de reconocimiento de palabras como ø creo que lo tiene llaves… ¿por qué no en general?… si
sabés que el texto es algo general, ¿por qué no lo implementás? Asegurate de haber pensado 3 escalones por encima»*.

LO QUE HABÍA: cuatro maneras de reconocer a alguien por lo que está escrito, y cada una sabía una parte:
  · el lector de llaves (`escuchar.plano()`): las letras de fantasía y de otros alfabetos, pero sólo para leer llaves;
  · `rankings.canon()`: los alias de la Lista, con una clave que no pliega la «ø»: «TöKīØ» y «TøKīØ🦠🧠» eran dos;
  · los MES AWARDS (`mes_otros`): la cuenta, el nombre de Discord, partir «LEWITO  FLENNZS»;
  · el organizador de la semana (`multiplicadores`) y la página (`subir_web._orgs()`): cada uno lo suyo.

LOS TRES ESCALONES (cada uno usa el de abajo):
  1 · LA LETRA (`plano`, `plegar`, `clave`). Cualquier forma de escribir la misma letra es la misma letra: negritas
      matemáticas (𝐋𝐄𝐖𝐈𝐓𝐎), ancho completo (ＬＥＷＩＴＯ), cuadraditos y circulitos (🄻🄴🅆🄸🅃🄾), versalitas (ʟᴇᴡɪᴛᴏ), cheroqui, el
      cirílico y el griego que imitan latinas, el tachado que se pega, las tildes, y las letras que NFKD no desarma
      (ø, đ, ł, ß, æ, œ, ı, þ, ð, ħ, ŧ). `clave()` es la identidad de un texto: la usan todos.
  2 · EL NOMBRE (`limpio`, `partir`, `es_nombre`). Lo que se lee como nombre —sin banderas, emojis, menciones, el tema
      del apodo entre corchetes ni la numeración de la plantilla— y de a uno: «A / B», «A, B», «A + B», «A & B»,
      «A y B», «A  B» (las banderas que separaban). Y lo que NO es una persona: «yo» sin su cuenta, «staff», «todos»,
      «CUPOS: 16», un número suelto, el nombre del mismo evento.
  3 · LA PERSONA (`Reconocer`). De lo escrito (y su cuenta, si se sabe) al nombre de la Lista, por este orden y
      diciendo por qué: la CUENTA (el padrón) · el nombre EXACTO de la Lista · su ALIAS (`datos/akas.json`, lo que
      decidió Dlx) · su nombre de DISCORD (usuario, visible o apodo, de `.cache/apodos_discord.json`, que deja el paso 1b)
      · y al final los NÚMEROS LEÍDOS COMO LETRAS («l3wito» → «lewito»), sólo si da UNA persona.

Y LO QUE VIENE, que es por qué está armado así: un servidor nuevo con otra fuente de letras entra por el escalón 1 sin
tocar nada más (y si es un alfabeto que no está, se suma a `PARECIDAS` y lo toman las llaves, la página y todo esto);
alguien que se cambia el apodo sigue siendo él por su cuenta; dos personas con el mismo nombre no se juntan por un
parecido —sin cuenta, el último paso exige una sola persona—.

⚠️ NO INTERPRETA IDENTIDADES (CLAUDE.md: «la identidad no se interpreta»). Reconoce lo DECLARADO —la cuenta, la Lista,
los alias de Dlx, el nombre de Discord de esa cuenta— y la MISMA escritura. Nada de parecidos: «Joel» no es «Joe».
"""
import io
import json
import os
import re
import sys
import unicodedata

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)

# ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
# 1 · LA LETRA
# ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
#: 🌲 LAS LETRAS PARECIDAS DE OTROS ALFABETOS, pasadas a las latinas que imitan: pares «rara → latina» en una sola
#: cadena. ⚠️ LA MISMA CADENA vive en `bot/paginas/llave_vivo.js` y en `bot/avisos.js` (`PARECIDAS`), y el self-check
#: se pone rojo si alguna difiere. Ver `plano()`.
PARECIDAS = 'ᎠDᎡRᎢTᎥiᎩYᎪAᎫJᎬEᎯAᎳWᎶGᎷMᎸFᎻHᎾOᏀGᏁNᏂhᏃZᏆIᏌUᏏbᏒRᏔWᏕSᏙVᏚSᏞLᏟCᏢPᏦKᏫOᏳGᏴBᏵGᴀAʙBᴄCᴅDᴇEꜰFɢGʜHɪIᴊJᴋKʟLᴍMɴNᴏOᴘPǫQʀRꜱSᴛTᴜUᴠVᴡWʏYᴢZᗩAᗅAᗷBᑕCᗪDᗞDᗴEᖴFᕼHᒍJᒪLᗰMᑎNᑭPᑫQᖇRᔕSᑌUᐯVᗯW᙭XᘔZꓐBꓑPꓓDꓔTꓖGꓗKꓙJꓚCꓜZꓝFꓟMꓠNꓡLꓢSꓣRꓦVꓧHꓪWꓫXꓬYꓮAꓰEꓲIꓳOꓴUАAВBСCЕEЁEНHІIЈJКKМMОOРPЅSТTХXУYҮYИNЯRШWДAЭEаaеeоoрpсcуyхxіiјjѕsԁdԛqԝwӄkиnяrΑAΒBΕEΖZΗHΙIΚKΜMΝNΟOΡPΤTΥYΧXΛAΔAΣEΞEΘOϴOοoνvαaιiκkτtυuϲcϳjβBεeηnρpωwօoսuռnցgզqքpաwհhոnՈUՕOԼLƈcɖdɛeʄfɠgɦhɨiʝjʍmʊuʋvʐzȶt'
_PARECIDAS = {PARECIDAS[i]: PARECIDAS[i + 1] for i in range(0, len(PARECIDAS), 2)}
#: las letras «negativas» (🅾🅲🆃) de a DOS o más: una sola es un emoji (🅰️, 🅱️)
_NEGATIVAS = re.compile('[\U0001F150-\U0001F169\U0001F170-\U0001F189](?:\ufe0f?[\U0001F150-\U0001F169\U0001F170-\U0001F189])+')
#: el tachado, el subrayado y la barra que se le pegan a cada letra («O̶C̶T̶A̶V̶O̶S̶»)
_ADORNOS = re.compile('[\u0305\u0332-\u0338\u033f]')


def _negativas(m):
    return ''.join(chr(0x41 + ord(c) - (0x1F170 if ord(c) >= 0x1F170 else 0x1F150))
                   for c in m.group(0) if c != '\ufe0f')


def _letra(c):
    o = ord(c)
    if 0x1D400 <= o <= 0x1D7FF or 0xFF01 <= o <= 0xFF5E or 0x1F130 <= o <= 0x1F149 or 0x24B6 <= o <= 0x24E9:
        return unicodedata.normalize('NFKD', c)
    if 0xAB70 <= o <= 0xABBF or 0x13F8 <= o <= 0x13FD:
        c = c.upper()
    return _PARECIDAS.get(c, c)


def plano(texto):
    """El texto con las letras «de fantasía» pasadas a letras comunes.

    🔴 `𝐕𝐒` NO ES `VS` PARA UNA REGEX. Los organizadores decoran con el
    bloque de símbolos alfanuméricos matemáticos (U+1D400…U+1D7FF) —el
    ejemplo de la propia guía, §9.4, trae `𝐕𝐒`— y con letras de ancho
    completo. Sin esto una llave escrita así no tiene separadores ni
    encabezados: no se detecta, y no falla nada.

    ⚠️ SÓLO ESOS BLOQUES. NFKD sobre todo el texto también desarmaría
    tildes y banderas, que el resto del lector sabe leer tal como vienen.
    Es la misma trampa que los roles `𝐑𝐚𝐧𝐠𝐨 𝐒𝐒𝐒` de Discord (ver CLAUDE.md).

    🏛️ Y LAS LETRAS EN CUADRADITOS Y EN CIRCULITOS (la ACADEMIA, 04/10/2026): la RED
    BULL CREW CHILE escribe sus rondas `🄾🄲🅃🄰🅅🄾🅂` (U+1F130…U+1F149) y sin esto la
    llave no tenía ni una ronda. Los «negativos» (`🅰`, `🅾`) sólo de a dos o más (`🅾🅲🆃`): uno solo es un emoji.

    🌲 Y LAS LETRAS PARECIDAS DE OTROS ALFABETOS (EL BOSQUE DE ARTEMISA, Snake Rap, 12/10/2026). GP escribió sus
    rondas en letras CHEROQUI —`ᎾᏟᎢᎪᏙᎾᏚ`, `ᏟᏌᎪᎡᎢᎾᏚ`, `ᏚᎬᎷᏆᎸᏆᏁᎪᏞ`, `ᎸᏆᏁᎪᏞ`—, que NFKD no toca porque no son
    variantes de las latinas: son otro alfabeto que se les parece. La llave no tenía ninguna ronda, así que no era
    una llave: ni la página en vivo, ni el ciclo, ni el aviso de «no pude leer una llave» la vieron, con 25 anotados
    jugando. Dlx: *«asegurate de prevenir este tipo de cosas para el futuro»*. Por eso no es sólo el cheroqui:
    `PARECIDAS` trae los alfabetos que usan los generadores de letras de fantasía —cheroqui, versalitas (`ᴏᴄᴛᴀᴠᴏs`),
    sílabas canadienses (`ᗩᗷᑕᗪ`), lisu, y el cirílico, el griego y el armenio que se usan como latinos (`ΛИЯ`)—, y
    el tachado o subrayado que se le pega a cada letra se va. ⚠️ Sólo letras que IMITAN una latina: las que no se
    parecen a ninguna quedan como vinieron. Y la segunda red, por si mañana es otra cosa: `_rondas_por_forma()`.
    """
    if not texto:
        return texto or ''
    texto = _ADORNOS.sub('', _NEGATIVAS.sub(_negativas, texto))
    return ''.join(_letra(c) for c in texto)

#: 🔤 LAS LETRAS QUE NFKD NO DESARMA: no son una latina con un adorno sino otra letra, así que «TöKīØ» (con ö) y
#: «TøKīØ» (con ø) daban claves distintas siendo la misma persona (medido el 18/10/2026 en el organizador de la semana)
PLEGAR = {'ø': 'o', 'Ø': 'O', 'đ': 'd', 'Đ': 'D', 'ł': 'l', 'Ł': 'L', 'ß': 'ss', 'ẞ': 'SS', 'æ': 'ae', 'Æ': 'AE',
          'œ': 'oe', 'Œ': 'OE', 'ı': 'i', 'þ': 'th', 'Þ': 'TH', 'ð': 'd', 'Ð': 'D', 'ħ': 'h', 'Ħ': 'H', 'ŧ': 't',
          'Ŧ': 'T', 'ŀ': 'l', 'Ŀ': 'L', 'ĸ': 'k', 'ƒ': 'f'}
_PLEGAR = str.maketrans(PLEGAR)
_EMOJI_DC = re.compile(r'<a?:\w+:\d+>')
_MENCION = re.compile(r'<[@#][!&]?\d+>|@everyone|@here')
_BANDERAS = re.compile('[\U0001F1E6-\U0001F1FF]')
#: los números leídos como letras, sólo para el último paso (`Reconocer`)
_LEET = str.maketrans('013457', 'oieast')


def plegar(s):
    """Las letras que NFKD no desarma, a la latina que son («ø» → «o»)."""
    return str(s or '').translate(_PLEGAR)


def clave(s):
    """🔑 LA IDENTIDAD DE UN TEXTO: la misma para todas sus formas de escribirse. Letras y números en minúscula, sin
    tildes, sin fantasía, sin emojis de Discord ni menciones. «𝐓ö𝐊ī𝐎» → «tokio», «TøKīØ🦠🧠» → «tokio»."""
    s = _MENCION.sub('', _EMOJI_DC.sub('', str(s or '')))
    s = unicodedata.normalize('NFKD', plegar(plano(s)))
    return ''.join(c for c in s if c.isalnum() and not unicodedata.combining(c)).lower()


def leet(k):
    """Una clave con los números leídos como letras («l3wito» → «lewito»): sólo para el último paso de `Reconocer`."""
    return str(k or '').translate(_LEET)


# ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
# 2 · EL NOMBRE
# ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
#: lo que se escribe donde va un nombre y no es una persona
NO_ES = frozenset(('yo', 'nosotros', 'staff', 'admin', 'admins', 'mods', 'moderadores', 'ustedes', 'todos', 'todas',
                   'publico', 'el publico', 'chat', 'el chat', 'votacion', 'la gente', 'nadie', 'tbd', 'por confirmar',
                   'a confirmar', 'invitados', 'invitado', 'everyone', 'here', 'organizador', 'organizadores', 'jurado',
                   'jurados', 'host', 'dj', 'vos', 'tu', 'equipo', 'directiva', 'la directiva'))


def limpio(s):
    """Un nombre como se lee: sin banderas ni emojis ni adornos, con las letras de fantasía pasadas a comunes
    («l3wito🇦🇷» → «l3wito», «💿 𝐋𝐄𝐖𝐈𝐓𝐎» → «LEWITO», «Flennzs | ⛩️» → «Flennzs», «17 | Velatz» → «Velatz»,
    «Natsuki [Uma Cryu]» → «Natsuki»). `''` si no queda nada que se lea, o si es algo de `NO_ES`."""
    s = _MENCION.sub(' ', _EMOJI_DC.sub(' ', str(s or '')))
    s = plano(s)
    # lo de entre corchetes es el tema del apodo («Natsuki [Uma Cryu]»)
    while '[' in s and ']' in s.split('[', 1)[1]:
        a, b = s.split('[', 1)
        s = a + ' ' + b.split(']', 1)[1]
    # sólo letras latinas y números: lo de otros alfabetos que no imita una latina es adorno («ཐ NeisMCཋ»)
    out = ''.join(c if ((c.isalnum() and (c.isascii() or unicodedata.name(c, '').startswith('LATIN')))
                        or c in " .'_-") else ' ' for c in s)
    out = ' '.join(out.split()).strip(' .-_')
    # la numeración de la plantilla adelante («17 Velatz», «1. Ana»)
    p = out.split(' ', 1)
    if len(p) == 2 and p[0].isdigit() and len(p[0]) <= 3:
        out = p[1]
    out = '' if out.lower() in NO_ES else out
    return out if sum(c.isalnum() for c in out) >= 2 else ''


#: lo que separa dos nombres en un mismo renglón
_SEP = re.compile(r'\s{2,}|\s*[,/|&+;]\s*|\s+(?:y|e|and)\s+', re.I)


def partir(s):
    """Los nombres de un renglón, de a uno: «A / B», «A, B», «A + B», «A & B», «A y B», y «A  B» (al sacar las
    banderas que los separaban: «LEWITO 🇨🇱 FLENNZS 🇨🇱» salía nominado como UNA persona, 18/10/2026)."""
    s = _BANDERAS.sub('  ', _EMOJI_DC.sub('  ', str(s or '')))
    return [x.strip() for x in _SEP.split(s) if x and x.strip()]


def es_nombre(texto):
    """¿Lo escrito puede ser una persona? No si es «CUPOS: 16» (un campo del anuncio), una mención rota, sólo números o
    algo de `NO_ES`."""
    t = str(texto or '')
    if ':' in _EMOJI_DC.sub('', t) or '>' in _MENCION.sub('', _EMOJI_DC.sub('', t)) or 'ORGANIZ' in t.upper():
        return False
    n = limpio(t)
    return bool(n) and any(c.isalpha() for c in n)


def del_evento(texto, evento):
    """¿Es el nombre del evento y no una persona? («COPA LIGA» en el anuncio de la «COPA LIGA VOL 2»)"""
    k, e = clave(texto), clave(evento)
    return bool(k and e) and (k == e or (len(k) >= 8 and k in e))


# ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
# 3 · LA PERSONA
# ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
def _leer(*p):
    try:
        with io.open(os.path.join(BASE, *p), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


class Reconocer:
    """De lo escrito (y su cuenta) al nombre de la Lista. `quien()` dice a quién y por qué; `nombre()` lo mismo, o el
    nombre limpio si no es nadie de la Lista; `de_anuncio()`, los organizadores de un anuncio, de a uno.

    Se arma con `Reconocer.desde_datos()` (el padrón, los alias y los nombres de Discord del paso 1b) o a mano, para
    las pruebas: `Reconocer(padron=[{raw, discord_id}], alias={alias: nombre}, discord={id: [nombres]})`."""

    def __init__(self, padron=None, alias=None, discord=None):
        self.did = {}
        self.lista = {}
        multi = set()
        for p in padron or []:
            raw = p.get('raw') or p.get('Rapero') or p.get('Nombre')
            if not raw:
                continue
            if p.get('discord_id'):
                self.did[str(p['discord_id'])] = raw
            for n in (p.get('raw'), p.get('Rapero'), p.get('Nombre')):
                k = clave(n)
                if k:
                    if k in self.lista and self.lista[k] != raw:
                        multi.add(k)
                    self.lista.setdefault(k, raw)
        # una escritura que es de DOS personas de la Lista no es de ninguna (sin cuenta, no se elige)
        for k in multi:
            self.lista.pop(k, None)
        self.alias = {clave(a): b for a, b in (alias or {}).items() if clave(a) and b}
        self.dc = {}
        for did, ns in (discord or {}).items():
            raw = self.did.get(str(did))
            if not raw:
                continue
            for n in ns or []:
                k = clave(n)
                if len(k) >= 3:
                    self.dc.setdefault(k, set()).add(raw)
        self.leets = {}
        for k, raw in self.lista.items():
            self.leets.setdefault(leet(k), set()).add(raw)

    @classmethod
    def desde_datos(cls):
        pad = _leer('datos', 'padron.json') or []
        ak = (_leer('datos', 'akas.json') or {}).get('alias') or {}
        dc = (_leer('.cache', 'apodos_discord.json') or {}).get('nombres') or {}
        return cls(pad if isinstance(pad, list) else [], ak, dc)

    def _por_alias(self, k):
        vis = set()
        while k in self.alias and k not in vis:
            vis.add(k)
            k = clave(self.alias[k])
        return self.lista.get(k) if vis else None

    def quien(self, texto, did='', evento=''):
        """`(nombre de la Lista, por qué)` —por qué: 'cuenta', 'lista', 'alias', 'discord', 'numeros'— o `('', '')`."""
        if did and str(did) in self.did:
            return self.did[str(did)], 'cuenta'
        if not es_nombre(texto) or (evento and del_evento(texto, evento)):
            return '', ''
        k = clave(limpio(texto))
        if not k:
            return '', ''
        if k in self.lista:
            return self.lista[k], 'lista'
        a = self._por_alias(k)
        if a:
            return a, 'alias'
        d = self.dc.get(k) or set()
        if len(d) == 1:
            return next(iter(d)), 'discord'
        lt = self.leets.get(leet(k)) or set()
        if len(lt) == 1:
            return next(iter(lt)), 'numeros'
        return '', ''

    def nombre(self, texto, did='', evento=''):
        """El nombre de la Lista, o el limpio si no es nadie de la Lista; `''` si no es una persona."""
        q, _por = self.quien(texto, did, evento)
        if q:
            return q
        if not es_nombre(texto) or (evento and del_evento(texto, evento)):
            return ''
        return limpio(texto)

    def de_anuncio(self, a):
        """Los organizadores de un anuncio, de a uno y con su nombre de la Lista (`orgs` con su cuenta si el anuncio la
        trae, ver `anuncios.organizadores()`; si no, el texto de `organizador` partido). Sin repetir."""
        crudos = [(o.get('n'), o.get('id')) for o in (a.get('orgs') or []) if isinstance(o, dict)]
        if not crudos:
            crudos = [(x, '') for x in partir(a.get('organizador'))]
        out = []
        for n, did in crudos:
            x = self.nombre(n, did, a.get('nombre') or '')
            if x and clave(x) not in {clave(y) for y in out}:
                out.append(x)
        return out


_UNO = None


def reconocer():
    """El de `desde_datos()`, armado una vez por corrida."""
    global _UNO
    if _UNO is None:
        _UNO = Reconocer.desde_datos()
    return _UNO


# ── self-check ───────────────────────────────────────────────────────────────────────────────────────────────────────
def _self_check():
    print('\n══ EL RECONOCIMIENTO DE NOMBRES ══\n')
    mal = 0

    def ok(c, q, extra=''):
        nonlocal mal
        mal += not c
        print('   %s %s%s' % ('✅' if c else '🔴', q, ('  ' + extra) if extra and not c else ''))

    # 1 · la letra
    formas = ['TöKīØ', 'TøKīØ🦠🧠', 'tokio', '𝐓𝐨𝐊𝐢𝐎', 'ＴＯＫＩＯ', 'ᴛᴏᴋɪᴏ']
    ok(len({clave(x) for x in formas}) == 1 and clave('TöKīØ') == 'tokio',
       'la misma persona escrita de seis maneras da UNA clave (ö y ø, fantasía, ancho completo, versalitas)',
       str([clave(x) for x in formas]))
    ok(clave('LEWITO <:ar:12> <@99>') == 'lewito' and clave('Ñandú') == 'nandu' and clave('Łukasz') == 'lukasz',
       'sin emojis de Discord ni menciones; las tildes y la ñ se pliegan, la ł también')
    ok(leet(clave('l3wito')) == clave('lewito') and leet('h4ck') == 'hack', 'los números leídos como letras, para el último paso')
    # 2 · el nombre
    ok(limpio('💿 𝐋𝐄𝐖𝐈𝐓𝐎') == 'LEWITO' and limpio('17 | Velatz') == 'Velatz' and limpio('Natsuki [Uma Cryu]') == 'Natsuki'
       and limpio('ཐ NeisMCཋ') == 'NeisMC' and limpio('yo') == '' and limpio('⛩️') == '',
       'el nombre limpio: sin adornos, sin numeración, sin el tema del apodo; «yo» y un emoji no son nadie')
    ok(partir('Lewis/Kravitz/TöKīØ') == ['Lewis', 'Kravitz', 'TöKīØ'] and partir('Elsoolar y tokio') == ['Elsoolar', 'tokio']
       and partir('LEWITO 🇨🇱 FLENNZS 🇨🇱') == ['LEWITO', 'FLENNZS'] and partir('A + B, C & D') == ['A', 'B', 'C', 'D'],
       'de a uno: «/», « y », las banderas que separan, «+», «,» y «&»', str(partir('LEWITO 🇨🇱 FLENNZS 🇨🇱')))
    ok(not es_nombre('CUPOS: 16') and not es_nombre('19') and not es_nombre('<@1> ORGANIZADOR') and es_nombre('Drexx')
       and del_evento('LA COPA DE ORO', 'LA COPA DE ORO VOL 2') and not del_evento('Drexx', 'PROYECTO X'),
       'no son personas: un campo del anuncio, un número, una mención rota, el nombre del evento')
    # 3 · la persona
    R = Reconocer(padron=[{'raw': 'LEWITO', 'discord_id': '1'}, {'raw': 'TøKīØ🦠🧠', 'discord_id': '2'},
                          {'raw': 'Drexx', 'discord_id': '3'}, {'raw': 'Ana', 'discord_id': '4'}, {'raw': 'ANA', 'discord_id': '5'},
                          {'raw': 'Joe', 'discord_id': '6'}],
                  alias={'lewis': 'LEWITO', 'la noche nunca perdona': 'Drexx'},
                  discord={'1': ['l3wito', 'Lewis ⛩️'], '3': ['manuxxx0789_78781']})
    ok(R.quien('x', '3') == ('Drexx', 'cuenta') and R.quien('TöKīØ') == ('TøKīØ🦠🧠', 'lista')
       and R.quien('Lewis') == ('LEWITO', 'alias') and R.quien('l3wito') == ('LEWITO', 'discord')
       and R.quien('LA NOCHE NUNCA PERDONA🇬🇵') == ('Drexx', 'alias') and R.quien('manuxxx0789_78781') == ('Drexx', 'discord'),
       'por la cuenta, la Lista, el alias o el nombre de Discord, y dice por qué', str(R.quien('l3wito')))
    ok(R.quien('L3W1T0') == ('LEWITO', 'numeros') and R.quien('ana') == ('', '') and R.quien('Joel') == ('', '')
       and R.quien('yo') == ('', '') and R.quien('Drexx', evento='DREXX') == ('', ''),
       'los números como letras sólo si da una persona; «ana» es de dos (sin cuenta, nadie); «Joel» no es «Joe»')
    ok(R.de_anuncio({'organizador': 'Lewis/Kravitz/TöKīØ', 'nombre': 'X'}) == ['LEWITO', 'Kravitz', 'TøKīØ🦠🧠']
       and R.de_anuncio({'organizador': 'tokio y TöKīØ', 'nombre': 'X'}) == ['TøKīØ🦠🧠']
       and R.de_anuncio({'orgs': [{'n': 'yo', 'id': '3'}], 'organizador': 'yo'}) == ['Drexx']
       and R.de_anuncio({'organizador': 'CUPOS: 16', 'nombre': 'X'}) == [],
       'los organizadores de un anuncio: de a uno, con su nombre de la Lista, sin repetir; «yo» es quien publicó')
    print('\n   %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return mal == 0


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        return 0 if _self_check() else 1
    R = reconocer()
    for t in [a for a in sys.argv[1:] if not a.startswith('--')]:
        q, por = R.quien(t)
        print('   %-28s → %s' % (t, ('%s  (%s)' % (q, por)) if q else '— nadie de la Lista (%s)' % (limpio(t) or 'no es un nombre')))
    return 0


if __name__ == '__main__':
    sys.exit(main())
