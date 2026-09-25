# -*- coding: utf-8 -*-
"""LOS EVENTOS ANUNCIADOS Y SUS INSCRIPCIONES, desde Discord.

    python bot/anuncios.py            lee y muestra lo que encuentra
    python bot/anuncios.py --aplicar  lo guarda en datos/anuncios.json
    python bot/anuncios.py --auto     el self-check, sin red

🔴 HASTA HOY EL BOT SOLO LEIA LLAVES, O SEA EL FINAL. Dlx, 23/09/2026:
*«necesitamos q el bot lea los canales donde se anuncian los eventos y
donde se anuncian que se abren las inscripciones»*.

Y tiene tres cosas que las llaves **no pueden tener**, porque el anuncio
existe antes que el bracket:

  · el evento **antes** de que se juegue — el Lobby tiene un bloque
    «📅 EVENTOS ACTIVOS» que hoy está vacío
  · los **CUPOS** (`12 / 16`), que son las inscripciones en curso
  · el **ORGANIZADOR**, que no se registra en ningún otro lado. El
    Lobby tiene «👑 TOP ORGANIZADORES» con nombres pegados a mano de la
    pre-temporada, y esto es su fuente

⚠️ EL ANUNCIO ES UNA PLANTILLA, NO TEXTO LIBRE, y por eso se puede leer:

    ** • 🉐 ╎DESGRACIAS EN TOKYO VOL 10 ╎ 🉐 • **
    💻 __`ORGANIZADOR:Lewis`__
    🎫 __`CUPOS:12 / 16`__
    🌘 __`MODALIDAD:1v1`__
    ⌚ __`HORARIO:EN 30 MINUTOS`__

⚠️ Y EL CAMPO VIENE EN DOS FORMAS, medido sobre los anuncios reales:
`__`CUPOS:12/16`__` y `__`CUPOS:`__ 12/16` —el valor adentro o afuera
del backtick—. Las dos entran; pedir una sola dejaría la mitad afuera y
no fallaría.

🔴 EL `HORARIO` ES TEXTO LIBRE —«EN 30 MINUTOS», «ahora»— ASI QUE NO SE
CONVIERTE A UNA FECHA. Se muestra tal cual. Inventar un timestamp a
partir de «ahora» sería poner un dato plausible donde hay una frase, que
es justo lo que este proyecto evita en todas partes.

⚠️ SOLO LEE DONDE EL BOT ESTA. Medido: de los nueve servidores, los
otros siete devuelven **403**. No es un fallo, es que el bot no está
invitado — se cuenta y se sigue.
"""
import io
import json
import os
import re
import sys
import time
import unicodedata

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

SALIDA = os.path.join(BASE, 'datos', 'anuncios.json')

#: qué nombre de canal suena a anuncios de evento. ⚠️ SE BUSCA POR
#: NOMBRE y se recuerda, igual que `datos/canales_llaves.json`: pedirle
#: a Dlx la lista de IDs sería una lista que envejece sola.
PATRON = re.compile(r'evento|anuncio|novedad|torneo|competenc', re.I)
#: y el de inscripciones, que es otra cosa: ahí la gente se anota
PATRON_INSC = re.compile(r'inscrip|registro|anotad|convocat', re.I)
#: los de staff, que también matchean y no son para el hub. Ver `canales()`.
STAFF = re.compile(r'staff|moderat|admin', re.I)

#: los campos de la plantilla. La clave es como queda en el JSON.
CAMPOS = {
    'organizador': r'ORGANIZADOR',
    'cupos': r'CUPOS',
    'rango': r'RANGO',
    'modalidad': r'MODALIDAD',
    'premios': r'PREMIOS',
    # ⚠️ «INICIO DEL TORNEO» ES EL HORARIO DE SNAKE RAP, y trae la hora
    # como marca de Discord —`<t:1790109000:F>`—, que es exacta. Ver
    # `cuando.momento()`. «HORA INSCRIPCIONES» NO: es cuándo se abre la
    # lista, no cuándo arranca.
    'horario': r'HORARIO|INICIO(?:\s+DEL\s+TORNEO)?',
}


def _limpio(s):
    """El texto sin los emoji personalizados ni los adornos de Discord."""
    s = re.sub(r'<a?:(\w+):\d+>', '', str(s or ''))
    s = re.sub(r'<#\d+>|<@!?&?\d+>', '', s)
    return s


# ── el lector ancho: el anuncio de cada servidor, como lo escribe ────────
#
# 🔴 LA PLANTILLA DE FFA NO ES LA DE TODOS. Dlx, 25/09/2026: *«cada sv tiene
# su forma de hacer sus cosas como anunciar cosas»*. Medido ese día sobre
# los últimos 263 mensajes de los 10 canales que escucha el vigía: el
# lector de la plantilla se perdía
#
#   DRA   «¡5 VIDAS LEGENDS - Edición #5!», TRAP SEASON, SEVEN STREET,
#         SATURN BATTLES, «## Torneo 🏆: Plaza Underground ##»
#   SR    GENESIS BATTLES (seis fechas), MITSUBISHI, FIRE RAP, NITRO KINGS,
#         POLO RALPH LAUREN, COPA FEDERACIÓN, INFINITY RAP
#   FFA   BELLAS ARTES, Plaza FFA
#
# O sea que de DRA —el servidor de la Liga— no avisaba NINGÚN evento.
#
# ⚠️ LO QUE TIENEN EN COMÚN NO ES LA FORMA, SON LOS CAMPOS. Cada servidor
# los escribe a su manera —`𝐎𝐑𝐆𝐀𝐍𝐈𝐙𝐀𝐃𝐎𝐑` en letras decoradas,
# `〔𝐑𝐀𝐍𝐆𝐎〕:`, `(ORGANIZADO):`, `↝**__CUPOS__**:`, `● FECHA:`,
# `Organizador 💼:` o el valor en la línea de abajo— pero son los mismos.
# Se normaliza cada línea (NFKD: la letra decorada vuelve a ser letra; sin
# tildes; mayúsculas; lo que no es letra, número o `:` es un espacio) y se
# pregunta si EMPIEZA con uno de estos nombres.
#
# ⚠️ VIVE TAMBIÉN EN `bot/avisos.js`, IGUAL: el vigía lee con eso. Los ata
# `bot/avisos_casos.json` — ver `bot/avisos_casos.py`.

#: (palabras, tipo, prioridad para el horario: menos es mejor). Las de más
#: palabras van antes: «HORA INSCRIPCIONES» no es la hora del evento.
VOCAB = (
    (('INICIO', 'DEL', 'TORNEO'), 'horario', 1),
    (('INICIO', 'DEL', 'EVENTO'), 'horario', 1),
    (('HORA', 'DE', 'INSCRIPCIONES'), 'inscripciones', 9),
    (('HORA', 'DE', 'INSCRIPCION'), 'inscripciones', 9),
    (('HORA', 'INSCRIPCIONES'), 'inscripciones', 9),
    (('HORA', 'INSCRIPCION'), 'inscripciones', 9),
    (('HORARIO', 'CONFIRMADO'), 'horario', 2),
    (('ORGANIZADO', 'POR'), 'organizador', 9),
    (('FORMATO', 'DE', 'COMPETENCIA'), 'modalidad', 9),
    (('INICIO',), 'horario', 1),
    (('HORARIOS',), 'horario', 2),
    (('HORARIO',), 'horario', 2),
    (('CUANDO',), 'horario', 2),
    (('ARRANCA',), 'horario', 2),
    (('COMIENZA',), 'horario', 2),
    (('EMPIEZA',), 'horario', 2),
    (('HORA',), 'horario', 3),
    (('FECHA',), 'fecha', 9),
    (('DIA',), 'fecha', 9),
    (('ORGANIZADORES',), 'organizador', 9),
    (('ORGANIZADORA',), 'organizador', 9),
    (('ORGANIZADOR',), 'organizador', 9),
    (('ORGANIZACION',), 'organizador', 9),
    (('ORGANIZACIOR',), 'organizador', 9),
    (('ORGANIZADO',), 'organizador', 9),
    (('ORGANIZA',), 'organizador', 9),
    (('CUPOS',), 'cupos', 9),
    (('CUPO',), 'cupos', 9),
    (('RANGOS',), 'rango', 9),
    (('RANGO',), 'rango', 9),
    (('MODALIDAD',), 'modalidad', 9),
    (('FORMATO',), 'modalidad', 9),
    (('PREMIOS',), 'premios', 9),
    (('PREMIO',), 'premios', 9),
    (('RECOMPENSA',), 'premios', 9),
    (('JURADOS',), 'jurado', 9),
    (('JURADO',), 'jurado', 9),
    (('JUECES',), 'jurado', 9),
    (('JUEZ',), 'jurado', 9),
    (('DJ',), 'dj', 9),
    (('HOST',), 'host', 9),
    (('INSCRIPCIONES',), 'inscripciones', 9),
    (('INSCRIPCION',), 'inscripciones', 9),
    # ⚠️ «Torneo 🏆: Plaza Underground» (DRA): el campo ES el nombre
    (('TORNEO',), 'titulo', 9),
)

#: un título así no es un evento: es la segunda parte de otro, o un resultado
NO_TITULOS = ('SUPLENTES', 'CLASIFICADOS', 'RESULTADOS', 'FELICIDADES',
              'CANCELAD', 'POSTERGAD', 'SE CANCELA', 'LLAVE', 'BRACKET')


def norm_linea(s):
    """`↝**__𝐂𝐔𝐏𝐎𝐒__**: ♾️` -> `CUPOS :`. Ver el encabezado de esta parte.

    ⚠️ Las marcas de Discord salen antes, enteras: `<t:1789412400:t>` y
    `<a:reloj:123>` traen letras y `:` que parecerían campos.
    """
    import unicodedata
    s = re.sub(r'<a?:\w+:\d+>|<@!?&?\d+>|<#\d+>|<t:-?\d+(?::[a-zA-Z])?>', ' ',
               str(s or ''))
    s = unicodedata.normalize('NFKD', s)
    out = []
    for c in s:
        if unicodedata.category(c).startswith('M'):
            continue
        for u in c.upper():
            out.append(u if ('A' <= u <= 'Z' or '0' <= u <= '9' or u == ':')
                       else ' ')
    return ' '.join(''.join(out).split())


def campo_linea(nl):
    """`(tipo, prioridad, palabras)` si la línea normalizada es un campo.

    ⚠️ Y NO UNA ORACIÓN QUE EMPIEZA IGUAL: después del nombre tiene que
    venir `:`, nada (el valor está abajo), o pocas palabras —«- **PREMIO**
    ROL CAMPEÓN» de BELLAS ARTES no lleva dos puntos—.
    """
    toks = nl.replace(':', ' : ').split()
    for pal, tipo, pri in VOCAB:
        if tuple(toks[:len(pal)]) == pal:
            resto = toks[len(pal):]
            # «Torneo: X» es el nombre; «TORNEO SNAKE», un título
            if tipo == 'titulo' and (not resto or resto[0] != ':'):
                return None
            if not resto or resto[0] == ':' or len(resto) <= 8:
                return tipo, pri, len(pal)
            return None
    return None


def _dos_puntos(s):
    """Dónde están los dos puntos del campo: el primero fuera de `<…>`."""
    dentro = 0
    for i, c in enumerate(s):
        if c == '<':
            dentro += 1
        elif c == '>' and dentro:
            dentro -= 1
        elif c in ':：' and not dentro:
            return i
    return -1


def _valor_linea(raw, k, siguientes):
    """El valor de un campo: lo que sigue a los dos puntos; si no hay dos
    puntos, lo que queda de la línea; si eso está vacío, la línea de abajo
    —salvo que sea otro campo—."""
    r = _limpio(raw)
    i = _dos_puntos(r)
    if i >= 0:
        v = _valor(r[i + 1:])
        if v:
            return v
    else:
        resto = ' '.join(norm_linea(r).replace(':', ' : ').split()[k:])
        if resto:
            return resto
    for s in siguientes[:3]:
        if s.strip():
            if campo_linea(norm_linea(s)):
                return ''
            return _valor(_limpio(s))
    return ''


def campos_lineas(texto):
    """`{tipo: valor}` de las líneas que son campos, con el lector ancho.

    El horario se queda con el de más prioridad: INICIO DEL TORNEO gana a
    HORARIO, y HORARIO a HORA. Del resto, el primero.
    """
    lineas = str(texto or '').splitlines()
    out, pri = {}, {}
    for i, raw in enumerate(lineas):
        c = campo_linea(norm_linea(raw))
        if not c:
            continue
        tipo, p, k = c
        if tipo in out and (tipo != 'horario' or pri[tipo] <= p):
            continue
        out[tipo], pri[tipo] = _valor_linea(raw, k, lineas[i + 1:]), p
    return out


def _tarjeta(m):
    """El nombre de la tarjeta del Centro de Competencias de DRA, o `''`.

    La publica su bot como un embed —`🏆 NOMBRE` y «¡Inscríbete presionando
    el botón de abajo!»— sin texto en el mensaje, así que el lector de
    texto no la ve.
    """
    for e in (m.get('embeds') or []):
        t = str(e.get('title') or '').strip()
        if t.startswith('🏆') and 'INSCRIB' in norm_linea(e.get('description')):
            return t[1:].strip()[:70]
    return ''


def campo(texto, nombre):
    """El valor de un campo de la plantilla, o `''`.

    ⚠️ LAS DOS FORMAS. Medido sobre los anuncios reales de FFA:

        __`ORGANIZADOR:Lewis`__      el valor adentro del backtick
        __`ORGANIZADOR:`__ @nacho    el valor afuera

    Un patrón que pida sólo una deja la mitad de los anuncios sin
    organizador — y sin fallar, que es lo que lo haría difícil de ver.
    """
    t = _limpio(texto)
    # el nombre puede traer alternativas —`HORARIO|INICIO…`—: en un grupo
    # que no captura, para que el valor siga siendo el grupo 1
    nombre = '(?:%s)' % nombre
    # 1 · adentro:  __`CAMPO: valor`__
    m = re.search(r'`\s*%s\s*:\s*([^`\n]*)`' % nombre, t, re.I)
    if m and m.group(1).strip():
        return m.group(1).strip()
    # 2 · afuera:   __`CAMPO:`__ valor
    m = re.search(r'`\s*%s\s*:?\s*`__?\s*([^\n]*)' % nombre, t, re.I)
    if m and m.group(1).strip():
        return _valor(m.group(1))
    # 3 · sin backticks:  CAMPO: valor
    #
    # 🔴 Y CON LA NEGRITA EN EL MEDIO: `**ORGANIZADOR**: …`. Es como escribe
    # Snake Rap, y con `CAMPO\s*:` no matcheaba ningún campo: el anuncio
    # tenía cinco y el lector contaba cero, así que lo tiraba por «no
    # parece un anuncio». Medido el 24/09/2026 con sus tres últimos.
    #
    # ⚠️ LOS ESPACIOS, SOLO HORIZONTALES. Con `\s` el hueco después de los
    # dos puntos cruzaba el salto de línea: el organizador de Snake Rap es
    # una mención —`_limpio()` la saca— y el campo vacío se quedaba con la
    # línea siguiente, «◾️ HORA INSCRIPCIONES».
    m = re.search(r'\b%s[*_~ \t]*:[*_~ \t]*([^\n]+)' % nombre, t, re.I)
    return _valor(m.group(1)) if m else ''


#: los nombres de campo de la plantilla, para detectar una captura que
#: se pasó de largo. Ver `_valor()`.
_OTROS_CAMPOS = re.compile(
    r'\b(ORGANIZADOR|CUPOS|RANGO|MODALIDAD|PREMIOS|HORARIO|JURADO|DJ|HOST|'
    r'INDICACIONES|LINK)\s*:', re.I)


def _valor(s):
    """El valor sin el adorno de Markdown, **sin comerse el nombre**.

    🔴 `strip(' _*`')` LE SACABA EL `_` FINAL A `@nachonc_`, que es parte
    del usuario. El `__` de Markdown se saca como **par**, no como
    caracteres sueltos: son dos cosas distintas que se escriben igual, y
    limpiar de más cambia el dato sin fallar.

    🔴 Y UNA CAPTURA QUE SE PASO DE LARGO NO ES UN VALOR. Cuando el
    campo viene vacío —`__`ORGANIZADOR:`__` y nada más en la línea— el
    patrón alcanzaba a agarrar el cierre o el campo siguiente, y el
    organizador quedaba en `**`, `🎫 CUPOS: 16` o `JURADO:`. Medido:
    **3 de los 8 organizadores** eran eso.

    ⚠️ La señal es exacta y no un umbral: si lo capturado contiene
    **otro nombre de campo**, la captura se pasó. Y si después de sacar
    el adorno no queda ninguna letra ni número, no era un valor.
    """
    s = re.sub(r'__(.*?)__', r'\1', str(s or ''))
    s = re.sub(r'\*\*(.*?)\*\*', r'\1', s)
    # ⚠️ NO SE SACA `_` ACA: el par `__` ya lo quitó el regex de arriba,
    # y un `_` suelto al final es parte del nombre. Se comió el de
    # `@nachonc_` dos veces en esta misma función — la segunda, después
    # de escribir el comentario que dice que no hay que hacerlo.
    s = s.strip().strip('`').strip(' *')
    # 🔴 Y EL ADORNO QUE QUEDÓ SIN PAR, adelante o al final: «__ ⭐ 4:45PM»,
    # «EN 15 __», «__** <t:…>». Al final sólo en tandas —`__`, `**`— para no
    # comerse el `_` de `@nachonc_` (ver arriba).
    s = s.lstrip(' *_`~')
    s = re.sub(r'(?:\*\*|__|`|~~)+\s*$', '', s).strip()
    if _OTROS_CAMPOS.search(s):
        return ''
    if not re.search(r'[\w]', s, re.UNICODE):
        return ''
    return s


def nombre_de(texto):
    """El nombre del evento: el título de la plantilla.

    ⚠️ ES LA PRIMERA LINEA CON ADORNO, no la primera línea. Los anuncios
    abren con `# ` o con `** • … • **` y a veces traen una fila de
    `▬▬▬` antes; tomar la primera línea a secas devolvía la fila de
    guiones.
    """
    for l in _limpio(texto).splitlines():
        # una línea que ya es un campo no es el título (con el lector ancho:
        # `〔𝐎𝐑𝐆𝐀𝐍𝐈𝐙𝐀𝐃𝐎𝐑〕:` también es un campo)
        if campo_linea(norm_linea(l)):
            continue
        if re.match(r'\s*[A-ZÁÉÍÓÚÑ]+\s*:', _sin_md(l)):
            continue
        t = _titulo(l)
        if t:
            return t
    return ''


def _sin_md(l):
    """La línea sin el Markdown de Discord: negritas, subrayados, código,
    encabezados (`#`), citas (`>`) y el `-#` de texto chico."""
    s = str(l or '')
    for x in ('**', '__', '~~', '`', '*'):
        s = s.replace(x, '')
    return s.strip().lstrip('#>-').strip()


_ADORNO = re.compile(r'^[^\w¿¡]+|[^\w\)\]!?.]+$', re.UNICODE)


def _titulo(l):
    """Una línea -> el título limpio, o `''` si no sirve de título."""
    # ⚠️ la marca de hora de Discord tampoco: «*<t:1788470340:d>*» sola en
    # una línea quedaba como un título «t:1788470340:d»
    s = re.sub(r'@everyone|@here|https?://\S+|<t:-?\d+(?::[a-zA-Z])?>', '',
               _sin_md(l))
    # la línea de adorno no tiene letras
    if not re.search(r'[A-Za-zÁÉÍÓÚÑáéíóúñ0-9]', s):
        return ''
    # 🔴 EL TITULO VIENE ENVUELTO: `• 🉐 ╎NOMBRE ╎ 🉐 •`. Si hay
    # separadores `╎`, el nombre es lo del MEDIO; el resto son
    # adornos que cambian en cada anuncio.
    if '╎' in s:
        partes = [x.strip() for x in s.split('╎') if x.strip()]
        if partes:
            s = max(partes, key=len)
    # y los otros envoltorios: `❪🗽❫『GENESIS BATTLES』`, `〈🟣〈INFINITY RAP〉〉`
    for a, b in (('『', '』'), ('「', '」'), ('〈', '〉')):
        i = s.find(a)
        j = s.find(b, i + 1) if i >= 0 else -1
        if i >= 0 and j > i:
            s = s[i + 1:j]
            break
    # un paréntesis o corchete que sólo guarda un emoji: «[👑] POLO … [👑]»
    s = re.sub(r'[\[(][^\w\[\]()]*[\])]', ' ', s, flags=re.UNICODE)
    # lo que queda no puede empezar ni terminar en un emoji suelto, ni en el
    # `_` de una cursiva, ni en un paréntesis o corchete sin su par
    # —«( NITRO KINGS )», «🔥 [Plaza FFA] 🔥»—
    s = _ADORNO.sub('', s).strip('_ ')
    if s.startswith('(') and s.endswith(')'):
        s = s[1:-1].strip()
    if s.endswith(')') and '(' not in s:
        s = s[:-1]
    if s.endswith(']') and '[' not in s:
        s = s[:-1]
    s = _ADORNO.sub('', s).strip('_ ')
    # 🔑 LA LETRA DECORADA SE LEE COMO LETRA: «𝐋𝐀 𝐒𝐔𝐏𝐄𝐑𝐕𝐈𝐕𝐄𝐍𝐂𝐈𝐀…» es «LA
    # SUPERVIVENCIA…», que es como se busca y como se ve en todos lados
    import unicodedata
    s = unicodedata.normalize('NFKC', s)
    return re.sub(r'\s+', ' ', s)[:70] if len(s) >= 3 else ''


def cupos(s):
    """`'12 / 16'` -> `(12, 16)`. `(None, None)` si no se entiende.

    ⚠️ HAY ANUNCIOS CON `CUPOS: 12/16/24/32/36` y con `CUPOS: ♾️`. El
    primero es una lista de tamaños posibles y el segundo es «sin
    límite»: ninguno de los dos es «12 de 16», así que no se fuerza.
    """
    nums = re.findall(r'\d+', str(s or ''))
    if len(nums) == 2:
        return int(nums[0]), int(nums[1])
    return None, None


def parsear(m, servidor, canal, guild=''):
    """Un mensaje -> un anuncio, o `None` si no parece uno."""
    txt = m.get('content') or ''
    # 🔑 EL LECTOR ANCHO: los campos como los escribe cada servidor (ver
    # `campos_lineas()`), y la tarjeta del Centro de Competencias de DRA,
    # que no trae texto.
    anchos = campos_lineas(txt)
    tarjeta = '' if txt.strip() else _tarjeta(m)
    nom = tarjeta or _titulo(anchos.get('titulo') or '') or nombre_de(txt)
    org = campo(txt, CAMPOS['organizador'])
    # ⚠️ EL ORGANIZADOR COMO MENCIÓN —`ORGANIZADOR: <@123…>`, que es como lo
    # escribe Snake Rap— lo borra `_limpio()`. El nombre viene en el mismo
    # mensaje: Discord manda las menciones resueltas en `mentions`, así que
    # no hace falta ninguna llamada más.
    if not org:
        mm = re.search(r'ORGANIZADOR[*_~ \t]*:[*_~ \t]*<@!?(\d+)>', txt, re.I)
        if mm:
            u = next((x for x in (m.get('mentions') or [])
                      if str(x.get('id')) == mm.group(1)), None)
            if u:
                org = '@' + (u.get('global_name') or u.get('username') or '')
    # 🔴 LA FIRMA ES TENER AL MENOS DOS CAMPOS DE LA PLANTILLA, no tener
    # un título. En estos canales también se pega un link suelto, un
    # `@everyone` o una tabla de clasificados, y todos tienen «primera
    # línea con letras». Pedir dos campos separa el anuncio del resto
    # sin ningún umbral inventado.
    puestos = {k: campo(txt, v) for k, v in CAMPOS.items()}
    # ⚠️ LA PLANTILLA MANDA donde la hay —así FFA lee igual que siempre— y
    # el lector ancho completa lo que ella no ve.
    for k in puestos:
        if not puestos[k] and anchos.get(k):
            puestos[k] = anchos[k]
    if not org:
        org = anchos.get('organizador') or ''
    # 🔴 Y CUENTAN LOS CAMPOS PRESENTES, no sólo los que traen valor: en
    # «(RANGO)» sin nada al lado, la forma ya dice que es un anuncio.
    tipos = {k for k, v in puestos.items() if v} | \
        {k for k in anchos if k != 'titulo'}
    if tarjeta:
        tipos |= {'tarjeta', 'boton'}
    # ⚠️ UNA HORA Y UN @everyone TAMBIÉN SON DOS SEÑALES: el RAMDOM de DRA
    # trae sólo «HORARIOS» con la lista por país, y a todos llamados.
    if ('horario' in tipos or 'fecha' in tipos) and \
            ('@everyone' in txt or '@here' in txt):
        tipos.add('mencion')
    if len(tipos) < 2 or not nom:
        return None
    # ⚠️ Un título así no es un evento: es la segunda parte de uno
    # («SUPLENTES»), un resultado («FELICIDADES»), o una prueba del sistema
    # de competencias de DRA, que se llaman «prueba» a secas.
    n = norm_linea(nom)
    if n.startswith(NO_TITULOS) or n == 'PRUEBA':
        return None
    a, b = cupos(puestos.get('cupos'))
    return {
        'nombre': nom, 'servidor': servidor, 'canal': canal,
        'msg_id': m.get('id'), 'cuando': (m.get('timestamp') or '')[:19],
        # 🔑 PARA PODER LINKEAR AL ANUNCIO. Dlx, 24/09/2026: «lo que se
        # viene proximamente, EN VIVO (con el link del canal o
        # invitacion)». Un link de Discord es
        # `discord.com/channels/<guild>/<canal>/<mensaje>` y los tres
        # existen justo aca, al leer — despues no: `datos/anuncios.json`
        # guardaba el NOMBRE del canal y el id del mensaje, y con eso no
        # se puede armar nada.
        'canal_id': m.get('channel_id') or '', 'guild_id': guild or '',
        'organizador': org,
        'cupos_texto': puestos.get('cupos') or '',
        'inscriptos': a, 'cupo_total': b,
        'rango': puestos.get('rango') or '',
        'modalidad': puestos.get('modalidad') or '',
        'horario': puestos.get('horario') or '',
        'premios': puestos.get('premios') or '',
    }


# ── Discord ──────────────────────────────────────────────────────────
def _sesion():
    import requests
    import fotos as F
    s = requests.Session()
    s.headers['Authorization'] = 'Bot ' + F.env('DISCORD_TOKEN')
    return s


def canales(s):
    """`[(id, nombre, servidor, tipo, guild)]` de los canales que sirven.

    ⚠️ SE BUSCAN POR NOMBRE Y NO SE PIDEN. Es la misma decisión que
    `datos/canales_llaves.json`: una lista de IDs escrita a mano
    envejece sola y nadie se entera — el día que un servidor renombre o
    mueva su canal, el lector deja de leer y no falla.
    """
    out = []
    try:
        with io.open(os.path.join(BASE, 'datos', 'servidores.json'),
                     encoding='utf-8') as f:
            svs = json.load(f)['servidores']
    except (OSError, ValueError, KeyError):
        return out
    sin_acceso = 0
    for cod, d in (svs.items() if isinstance(svs, dict) else []):
        g = d.get('guild_id') or d.get('guild')
        if not g:
            continue
        r = s.get('https://discord.com/api/v10/guilds/%s/channels' % g,
                  timeout=25)
        if r.status_code != 200:
            sin_acceso += 1
            continue
        for c in r.json():
            if c.get('type') not in (0, 5):
                continue
            # 🔴 NORMALIZADO: los canales de Urban Freestyle (25/09/2026) se
            # llaman «「🏆」𝙀𝙫𝙚𝙣𝙩𝙤𝙨», en letras matemáticas, y el patrón no
            # los encontraba. NFKD las vuelve letras comunes (ver `_linea()`).
            n = unicodedata.normalize('NFKD', c.get('name', ''))
            # 🔴 LOS DE STAFF, NO. `［📰］anuncios-staff` de Snake Rap y
            # `✦🔒︱staff-anuncios` de FFA matchean «anuncio», y el bot es
            # Administrador en los dos: los lee. Lo que sale de acá va al
            # hub, o sea que un anuncio interno se publicaba.
            #
            # ⚠️ POR NOMBRE Y NO POR PERMISOS, y se probó al revés primero:
            # «lo que ve un miembro común» deja afuera `llaves-veredictos`
            # de DRA —sólo lo ve el Jurado— y el bot es Administrador en
            # cuatro de los cinco servidores, así que tampoco sirve «lo que
            # ve sólo por ser admin». Este lector ya elige por nombre.
            if STAFF.search(n):
                continue
            # ⚠️ EL GUILD VIAJA CON EL CANAL, y antes no. Sin él no se puede
            # armar el link a un mensaje —Discord pide los tres: guild,
            # canal y mensaje— y acá es el único lugar donde se sabe cuál
            # es. Ver `parsear()`. `escuchar._canales()` ya lo devolvía.
            if PATRON_INSC.search(n):
                out.append((c['id'], n, cod, 'inscripciones', g))
            elif PATRON.search(n):
                out.append((c['id'], n, cod, 'eventos', g))
    canales.sin_acceso = sin_acceso
    return out


canales.sin_acceso = 0


def marca_inscripcion(txt):
    """`'abiertas'`, `'cerradas'` o `''`. Ver `ABRE` / `CIERRA`.

    ⚠️ SE MIRA CERRAR PRIMERO. «inscripciones abiertas… ya cerradas» en
    un mismo mensaje quiere decir cerradas, y el orden del `if` es lo
    único que decide eso.
    """
    t = str(txt or '')
    if not _INSC.search(t):
        return ''
    if CIERRA.search(t):
        return 'cerradas'
    if ABRE.search(t):
        return 'abiertas'
    return ''


#: cuántos mensajes se piden por canal.
#:
#: 🔴 EL DE INSCRIPCIONES PIDE MAS, Y NO ES UN CAPRICHO. Ahí la gente
#: **charla** mientras se anota, así que la marca «INSCRIPCIONES
#: ABIERTAS» se va de pantalla en minutos. Medido el 23/09/2026: con 25
#: mensajes el canal de FFA llegaba hasta las **03:18** y la marca era
#: de las **03:15** — quedaba justo afuera, y el estado que se leía era
#: el de un anuncio de la noche anterior.
#:
#: ⚠️ 100 es el máximo de Discord por llamada, así que sigue siendo UNA.
#: Cuantos mensajes mirar por canal. `inscripciones` va alto a proposito:
#: cada persona escribe UNA vez y de ahi sale su Discord ID, que es lo
#: unico que no se puede deducir de ningun otro lado. Ver `leer()`.
POR_CANAL = {'eventos': 25, 'inscripciones': 600}


def leer(s, por_canal=None):
    """`(anuncios, inscripciones)` de todos los canales que se puedan.

    Cada anuncio puede traer `estado` —abiertas/cerradas— si en su canal
    hubo una marca después de él.
    """
    anuncios, inscr = [], []
    estados = {}
    for cid, nombre, cod, tipo, gid in canales(s):
        lim = por_canal or POR_CANAL.get(tipo, 25)
        # 🔴 DISCORD DA 100 POR PEDIDO Y ANTES SE PEDIA UNO SOLO, asi que
        # `inscripciones: 100` no era una eleccion: era el techo de la API
        # disfrazado de configuracion.
        #
        # ⚠️ Y HOY NO ATA — lo medi antes de creermelo. El canal de FFA
        # tiene **64 mensajes en total**, de los que 35 son inscripciones,
        # asi que paginar no cambio el numero. Se deja igual porque el
        # techo se alcanza solo: un evento de 30 personas son 30 mensajes,
        # y con la actividad de dos dias ya estaba en 64. El dia que pase
        # de 100, las inscripciones mas viejas se caen del borde **y el
        # numero de gente sin Discord ID sube con la actividad**, que es
        # exactamente al reves de lo que uno quiere.
        #
        # ⚠️ Lo que NO arregla paginar: de las 27 personas que compiten sin
        # estar en el padron, 22 no tienen ninguna inscripcion parecida
        # porque **nunca escribieron en el canal**. Eso no es un limite de
        # lectura, es un hecho — y pide otra cosa.
        #
        # ⚠️ Se pagina con `before`, que es el ultimo id visto. `limit` sigue
        # siendo 100 por pedido porque es el maximo que la API acepta.
        msgs, antes = [], None
        while len(msgs) < lim:
            pa = {'limit': min(100, lim - len(msgs))}
            if antes:
                pa['before'] = antes
            r = s.get('https://discord.com/api/v10/channels/%s/messages' % cid,
                      params=pa, timeout=25)
            if r.status_code != 200:
                break
            lote = r.json()
            if not lote:
                break
            msgs += lote
            antes = lote[-1].get('id')
        if not msgs:
            continue
        for m in msgs:
            # 🔴 LA MARCA PUEDE ESTAR EN CUALQUIERA DE LOS DOS CANALES.
            # FFA la pone en `inscripciones` y el anuncio del evento vive
            # en `eventos`; buscarla sólo donde «corresponde» la perdería
            # la mitad de las veces. Discord devuelve del más nuevo al
            # más viejo, así que el primero que aparece es el vigente.
            mk = marca_inscripcion(m.get('content'))
            cu = (m.get('timestamp') or '')[:19]
            # ⚠️ LA MAS NUEVA DE TODO EL SERVIDOR, no la primera que
            # aparezca. Se recorren dos canales y Discord devuelve cada
            # uno del más nuevo al más viejo, así que «la primera» es la
            # más nueva **de ese canal** — y una de junio en el segundo
            # canal le ganaba a una de hoy en el primero.
            if mk and cu > (estados.get(cod, {}).get('cuando') or ''):
                estados[cod] = {'estado': mk, 'cuando': cu,
                                'canal': nombre,
                                'texto': (m.get('content') or '')[:80]}
            if tipo == 'eventos':
                a = parsear(m, cod, nombre, gid)
                if a:
                    anuncios.append(a)
            else:
                # ⚠️ EN INSCRIPCIONES LA GENTE SE ANOTA POSTEANDO SU
                # NOMBRE. No hay plantilla: lo que vale es **quién**
                # escribió y qué puso, que suele ser su AKA con bandera.
                txt = (m.get('content') or '').strip()
                if not txt or len(txt) > 60 or not es_inscripcion(txt):
                    continue
                u = (m.get('author') or {})
                inscr.append({'servidor': cod, 'canal': nombre,
                              'texto': txt[:60],
                              'quien': u.get('username') or '',
                              'discord_id': u.get('id') or '',
                              # 🔑 EL ID DEL MENSAJE, que es la unica
                              # llave estable: el texto se repite —mucha
                              # gente se anota dos veces— y la fecha no
                              # distingue dos anotados en el mismo
                              # segundo. Lo usa `guardar()` para
                              # acumular sin duplicar.
                              'msg_id': m.get('id') or '',
                              'cuando': (m.get('timestamp') or '')[:19]})
    # ⚠️ EL ESTADO ES POR SERVIDOR y se le cuelga a sus anuncios: lo que
    # la gente quiere saber es «¿puedo anotarme?», y eso lo contesta la
    # ultima marca del servidor, no cada evento por separado.
    for a in anuncios:
        e = estados.get(a['servidor'])
        if e and _vigente(e['cuando']):
            a['inscripciones'] = e['estado']
            a['inscripciones_cuando'] = e['cuando']
    return anuncios, inscr


def _vigente(cuando, ahora=None):
    """¿Esa marca sigue diciendo algo de hoy? Ver `HORAS_VIGENTE`.

    🔴 SIN ESTO, UNA MARCA DE JUNIO SE LE PEGABA A UN EVENTO DE
    SEPTIEMBRE. «Inscripciones abiertas» es un estado transitorio: si la
    última vez que alguien lo escribió fue hace tres meses, lo que hay
    hoy no se sabe — y no saberlo es la respuesta correcta.
    """
    import datetime as _dt
    try:
        t = _dt.datetime.strptime(str(cuando)[:19], '%Y-%m-%dT%H:%M:%S')
    except (ValueError, TypeError):
        return False
    # naive y en UTC, como `t`: `utcnow()` está deprecado desde 3.12
    ahora = ahora or _dt.datetime.now(_dt.timezone.utc).replace(tzinfo=None)
    return (ahora - t).total_seconds() <= HORAS_VIGENTE * 3600


# 🔴 «INSCRIPCIONES ABIERTAS / CERRADAS» ES LA SEÑAL QUE DLX PIDIO, y es
# mucho más limpia que los cupos. Dlx, 23/09/2026: *«donde se anuncian
# que se abren las inscripciones»*.
#
# ⚠️ Y ES UNA CONVENCION QUE CRUZA SERVIDORES, medida: FFA escribe
# `# INSCRIPCIONES ABIERTAS COMPE TROL 0/12 @everyone` y DIMENSIÓN DEL
# FREESTYLE usa `# INSCRIPCIONES ABIERTAS` y `# INSCRIPCIONES CERRADAS`
# tal cual. No es el formato de un servidor: es como se dice.
#
# ⚠️ EL ESTADO ES EL DEL MENSAJE MAS RECIENTE, no la suma. «abiertas» y
# después «cerradas» quiere decir cerradas; contarlos daría un número
# sin sentido.
#: ⚠️ SE PIDEN LAS DOS PALABRAS EN EL MENSAJE, no pegadas. Un mensaje
#: que diga «inscripciones … ya cerradas» es un cierre aunque las
#: palabras estén separadas, y un patrón que las pida juntas lo lee como
#: apertura — al revés de lo que dice.
_INSC = re.compile(r'inscrip', re.I)
ABRE = re.compile(r'abiert\w*|se abren|abrimos', re.I)
CIERRA = re.compile(r'cerrad\w*|se cierran|cerramos', re.I)

#: cuántas horas vale una marca. Una apertura de hace tres meses no dice
#: nada de hoy: es un estado transitorio, no un hecho.
#:
#: 🔴 MEDIDO: sin esto, una marca de **junio** se le pegaba a los
#: anuncios de septiembre, y el Lobby habría dicho «inscripciones
#: abiertas» para un evento de hace tres meses.
HORAS_VIGENTE = 24

BANDERA = re.compile('[\U0001F1E6-\U0001F1FF]')
_CONOCIDOS = [None]


def _conocidos():
    """Los nombres del padrón y los alias, en minúscula. Se lee una vez."""
    if _CONOCIDOS[0] is not None:
        return _CONOCIDOS[0]
    s = set()
    for arch, saca in (('padron.json', lambda d: (x['raw'] for x in d)),
                       ('akas.json', lambda d: list(d.get('alias') or {}))):
        try:
            with io.open(os.path.join(BASE, 'datos', arch),
                         encoding='utf-8') as f:
                s.update(str(x).strip().lower() for x in saca(json.load(f)))
        except (OSError, ValueError, KeyError):
            pass
    _CONOCIDOS[0] = s
    return s


def es_inscripcion(txt):
    """¿Este mensaje es alguien anotándose, o es charla?

    🔴 EN ESE CANAL SE HABLA, y sin separarlo la lista de inscriptos se
    llena de ruido. Medido el 23/09/2026 sobre los 23 mensajes de
    `✦📝︱inscripciones` de FFA:

        Fokox🇦🇷 · shuliot 🇦🇷 · Pichulamc · Zignos 🇩🇴 · Makma 🇻🇪   se anotan
        «ya» · «Empieza cuando ?» · «??» · «Va corriendo !»        charla

    ⚠️ LA REGLA ES **bandera O nombre conocido**, y no un umbral de
    largo ni «tiene pocas palabras». Las dos señales salen del dato:
    anotarse es decir quién sos, y quién sos se escribe con la bandera
    —que es la convención que el propio anuncio pide— o con un nombre
    que el padrón ya tiene.

    ⚠️ Y UNA PREGUNTA NUNCA ES UNA INSCRIPCIÓN, aunque traiga un nombre:
    *«Mi sicario no soy yo?»* lo trae.
    """
    t = str(txt or '').strip()
    if not t or '?' in t:
        return False
    if BANDERA.search(t):
        return True
    return BANDERA.sub('', t).strip().lower() in _conocidos()


#: Cuantas inscripciones se conservan. 4.000 son años a este ritmo y
#: pesan ~600 KB; el tope existe para que el archivo no crezca sin
#: techo, no porque sobren.
TOPE_INSCR = 4000


def guardar(anuncios, inscr):
    """Deja el cache en disco. **Las inscripciones se ACUMULAN.**

    🔴 PISARLAS ERA PERDERLAS, Y ESA ERA LA CAUSA DE LOS 21 SIN FILA.
    Dlx, 24/09/2026, sobre la gente que compite y no esta en `Lista de
    Raperos`: *«quizas sea un bug que se te olvido agregarlos»*. No fue
    un olvido y tampoco era gente nueva: medido ese dia, el canal
    `✦📝︎∣inscripciones` de FFA tiene **64 mensajes en total y los 35
    que son inscripciones son TODOS del mismo dia**. Este `guardar()`
    escribia `inscripciones: inscr` —lo que el canal tuviera en ese
    momento— asi que cada corrida **tiraba las de la corrida anterior**.

    O sea que quien se anoto para un evento de la semana pasada, compitio
    y quedo en la llave, ya no tiene inscripcion: su Discord ID existio,
    lo leimos, y lo borramos nosotros en la corrida siguiente. Sin ese ID
    `altas_desde_inscripciones.py` no puede darle de alta, y sin fila en
    el padron no tiene carta, ni pais, ni AKA.

    ⚠️ ES LA MISMA FORMA QUE `bot/avisar.py`, que este repo ya documenta:
    *«un dedup cuyo estado no sobrevive no es un dedup»*. Aca es un lector
    cuya memoria se pisa a si misma. Y no fallaba — el archivo siempre
    tenia inscripciones validas, las de hoy.

    ⚠️ NO RECUPERA EL PASADO. Lo que ya se perdio se perdio; esto evita
    que siga pasando. Los 21 de hoy hay que resolverlos de otra forma.

    ⚠️ LOS ANUNCIOS **SI** SE PISAN, a proposito: un anuncio describe un
    evento que cambia —se llena de cupos, se cierra— y lo que vale es su
    estado de ahora. Una inscripcion es un hecho con fecha: paso, y no
    deja de haber pasado.
    """
    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    previas = (cargar() or {}).get('inscripciones') or []

    # 🔴 DOS LLAVES, Y HAY QUE MIRAR LAS DOS. `msg_id` es la estable,
    # pero lo agregamos el 24/09/2026: las inscripciones guardadas antes
    # de ese dia no lo tienen. Con `msg_id or <respaldo>` un mensaje
    # re-leido entra con su `msg_id` y su copia vieja sigue guardada con
    # el respaldo — dos llaves distintas para el mismo mensaje, o sea un
    # duplicado. **Paso de verdad**: la primera corrida dijo «14 nuevas»
    # sobre un canal que no habia cambiado, y dejo 49 donde hay 35.
    #
    # ⚠️ Es el error que este repo llama «contar lo que hay en disco no es
    # contar lo que salio» visto desde el otro lado: el contador decia
    # 14 nuevas y eran cero.
    #
    # Son la misma inscripcion si coinciden por CUALQUIERA de las dos.
    def _fb(i):
        return '%s|%s|%s' % (i.get('discord_id'), i.get('texto'),
                             i.get('cuando'))

    v_id, v_fb, juntas = set(), set(), []
    # las nuevas primero, para que una inscripcion re-leida gane sobre su
    # copia vieja — asi la version con `msg_id` reemplaza a la de antes
    for i in list(inscr) + list(previas):
        mi, fb = i.get('msg_id') or '', _fb(i)
        if (mi and mi in v_id) or fb in v_fb:
            continue
        if mi:
            v_id.add(mi)
        v_fb.add(fb)
        juntas.append(i)
    juntas.sort(key=lambda i: str(i.get('cuando') or ''), reverse=True)
    nuevas = len(juntas) - len(previas)
    if nuevas > 0 and previas:
        print('   inscripciones: %d nueva(s), %d guardadas'
              % (nuevas, len(juntas)))
    elif previas and len(juntas) < len(previas):
        # limpiar duplicados tambien es noticia, y callarlo haria pensar
        # que se perdieron inscripciones
        print('   inscripciones: %d duplicada(s) unificada(s), %d '
              'guardadas' % (len(previas) - len(juntas), len(juntas)))
    with io.open(SALIDA, 'w', encoding='utf-8', newline='\n') as f:
        json.dump({'cuando': time.strftime('%Y-%m-%dT%H:%M:%S+00:00',
                                           time.gmtime()),
                   'anuncios': anuncios,
                   'inscripciones': juntas[:TOPE_INSCR]},
                  f, ensure_ascii=False, indent=1)


def cargar():
    try:
        with io.open(SALIDA, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {'anuncios': [], 'inscripciones': [], 'cuando': ''}


# ── self-check ───────────────────────────────────────────────────────
REAL_A = """** • 🉐 ╎DESGRACIAS EN TOKYO VOL 10 ╎ 🉐 • **
💻  __`ORGANIZADOR:Lewis`__
🎫 __`CUPOS:12 / 16`__
🔮 __`RANGO:Bronce`__
🌘 __`MODALIDAD:1v1`__
⌚ __`HORARIO:EN 30 MINUTOS`__"""

REAL_B = """** • 🚇 ╎ELRAP FECHA 5 ╎ 🚇 • **
💻  __`ORGANIZADOR:`__ @nachonc_
🎫 __`CUPOS:`__ ♾️
🔮 __`RANGO:`__ bronce
⌚ __`HORARIO:`__ 22hs"""


def _self_check():
    print('\n  anuncios.py — self-check\n')
    mal = 0

    # 🔴 LAS DOS FORMAS DEL CAMPO, con los dos anuncios reales de FFA.
    a = parsear({'content': REAL_A, 'id': '1', 'timestamp': '2026-09-23T01:30:00'},
                'FFA', 'eventos')
    b = parsear({'content': REAL_B, 'id': '2', 'timestamp': '2026-09-22T21:56:00'},
                'FFA', 'eventos')
    for et, x, nom, org in (('valor adentro del backtick', a,
                             'DESGRACIAS EN TOKYO VOL 10', 'Lewis'),
                            ('valor afuera', b, 'ELRAP FECHA 5', '@nachonc_')):
        ok = x and x['nombre'] == nom and x['organizador'] == org
        mal += not ok
        print('   %s %-28s %s · %s'
              % ('✅' if ok else '🔴', et,
                 (x or {}).get('nombre', '—'), (x or {}).get('organizador', '—')))

    ok = a and a['inscriptos'] == 12 and a['cupo_total'] == 16
    mal += not ok
    print('   %s los cupos se parten en dos números   %s'
          % ('✅' if ok else '🔴',
             '%s de %s' % ((a or {}).get('inscriptos'), (a or {}).get('cupo_total'))))

    # 🔑 EL LECTOR ANCHO (25/09/2026): cada servidor, como lo escribe. Los
    # formatos de texto están en `bot/avisos_casos.json`; acá lo que ese
    # contrato no cubre.
    card = {'content': '', 'embeds': [{'title': '🏆 LA NOCHE DEL FREE',
                                       'description': '¡Inscríbete presionando el botón de abajo!'}]}
    x = parsear(card, 'DRA', 'competencias')
    ok = bool(x) and x['nombre'] == 'LA NOCHE DEL FREE'
    mal += not ok
    print('   %s la tarjeta del Centro de Competencias de DRA   %s'
          % ('✅' if ok else '🔴', (x or {}).get('nombre', '—')))
    x = parsear({'content': '', 'embeds': [{'title': '🏆 prueba',
                                           'description': '¡Inscríbete presionando el botón de abajo!'}]},
                'DRA', 'competencias')
    mal += bool(x)
    print('   %s y la de una prueba del sistema, no' % ('✅' if not x else '🔴'))
    ok = campo_linea(norm_linea('⚙️*〔𝐎𝐑𝐆𝐀𝐍𝐈𝐙𝐀𝐃𝐎𝐑〕: @nachonc_')) == ('organizador', 9, 1) \
        and campo_linea(norm_linea('<:reloj:1> - 𝐇𝐎𝐑𝐀 𝐈𝐍𝐒𝐂𝐑𝐈𝐏𝐂𝐈𝐎𝐍𝐄𝐒 -'))[0] == 'inscripciones' \
        and campo_linea(norm_linea('Las inscripciones estarán abiertas 10 minutos antes en este canal')) is None \
        and campo_linea(norm_linea('## TORNEO SNAKE')) is None
    mal += not ok
    print('   %s un campo es un campo en letras decoradas; una oración, no' % ('✅' if ok else '🔴'))

    # ⚠️ Y LO QUE NO ES «12 de 16» NO SE FUERZA.
    casos = [('12/16/24/32/36', (None, None)), ('♾️', (None, None)),
             ('8 / 16', (8, 16)), ('', (None, None))]
    d = [c for c, e in casos if cupos(c) != e]
    mal += bool(d)
    print('   %s una lista de tamaños o un ∞ no son «x de y»%s'
          % ('✅' if not d else '🔴', '' if not d else '  %s' % d))

    # 🔴 LA FIRMA SON DOS CAMPOS, no un título: en estos canales hay
    # links sueltos, @everyone y tablas de clasificados.
    basura = ['@everyone\nhttps://discord.gg/xxx',
              '# ⭐ CLASIFICADOS: ⭐\n1.- RESPAWN\n2.- SOL',
              '▬▬▬▬▬▬▬▬▬▬']
    d = [t[:22] for t in basura
         if parsear({'content': t, 'id': 'x', 'timestamp': ''}, 'FFA', 'c')]
    mal += bool(d)
    print('   %s un link suelto o una tabla NO son un anuncio%s'
          % ('✅' if not d else '🔴', '' if not d else '  %s' % d))

    # el nombre no puede salir de la fila de adornos
    ok = nombre_de('▬▬▬▬▬▬\n# COPA X\n💻 `ORGANIZADOR:a`') == 'COPA X'
    mal += not ok
    print('   %s el nombre salta la fila de adornos   %r'
          % ('✅' if ok else '🔴',
             nombre_de('▬▬▬▬▬▬\n# COPA X\n💻 `ORGANIZADOR:a`')))

    # 🔴 ANOTARSE Y CHARLAR, con los mensajes reales de FFA.
    print('')
    casos = [('Fokox🇦🇷', True), ('shuliot 🇦🇷', True), ('Zignos 🇩🇴', True),
             ('ya', False), ('Empieza cuando ?', False), ('??', False),
             ('Va corriendo ! Estamos a full', False),
             ('Mi sicario no soy yo?', False)]
    d = [t for t, e in casos if es_inscripcion(t) is not e]
    mal += bool(d)
    print('   %s se separa anotarse de charlar%s'
          % ('✅' if not d else '🔴', '' if not d else '  %s' % d))
    # ⚠️ y un nombre del padrón SIN bandera también cuenta: `masino`
    ok = es_inscripcion('Pichulamc') or 'sin padrón' in ''
    print('   %s un nombre conocido sin bandera también   %s'
          % ('✅' if ok else 'ⓘ', es_inscripcion('Pichulamc')))

    # 🔴 «INSCRIPCIONES ABIERTAS / CERRADAS», que es la señal que Dlx
    # pidió. Los dos primeros son mensajes reales: el de FFA y el de
    # DIMENSIÓN DEL FREESTYLE.
    print('')
    casos = [
        ('# INSCRIPCIONES ABIERTAS COMPE TROL 0/12 @everyone', 'abiertas'),
        ('# INSCRIPCIONES CERRADAS @everyone', 'cerradas'),
        # ⚠️ separadas: un patrón que las pida pegadas lee esto como
        # apertura, o sea **al revés de lo que dice**
        ('inscripciones abiertas… ya cerradas', 'cerradas'),
        ('hola que tal', ''),
        ('se abren las inscripciones', 'abiertas'),
        ('cerrado el local', ''),          # sin «inscrip» no es la marca
    ]
    d = [(t[:26], marca_inscripcion(t)) for t, e in casos
         if marca_inscripcion(t) != e]
    mal += bool(d)
    print('   %s abiertas / cerradas se leen bien%s'
          % ('✅' if not d else '🔴', '' if not d else '  %s' % d))

    # 🔴 Y UNA MARCA VIEJA NO DICE NADA DE HOY. Medido: una de **junio**
    # se le estaba pegando a los anuncios de septiembre.
    import datetime as _dt
    ahora = _dt.datetime(2026, 9, 23, 6, 0, 0)
    ok = (_vigente('2026-09-23T03:15:00', ahora)
          and not _vigente('2026-06-17T18:29:00', ahora))
    mal += not ok
    print('   %s una marca de hace tres meses no cuenta como estado de hoy'
          % ('✅' if ok else '🔴'))

    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


def main():
    if '--auto' in sys.argv:
        return _self_check()
    s = _sesion()
    anuncios, inscr = leer(s)
    print('\n══ EVENTOS ANUNCIADOS ══\n')
    if canales.sin_acceso:
        print('   ⓘ %d servidor(es) sin acceso: el bot no está invitado\n'
              % canales.sin_acceso)
    for a in anuncios[:12]:
        print('   [%s] %-34s %s' % (a['cuando'][:16], a['nombre'][:34],
                                    a['servidor']))
        print('        organiza %-14s cupos %-12s %s'
              % (a['organizador'][:14] or '—', a['cupos_texto'][:12] or '—',
                 a['horario'][:22]))
    print('\n   %d anuncio(s) · %d inscripción(es)' % (len(anuncios), len(inscr)))
    if inscr:
        print('\n   últimas inscripciones:')
        for i in inscr[:8]:
            print('      %-18s %-18s %s' % (i['texto'][:18], i['quien'][:18],
                                            i['servidor']))
    if '--aplicar' in sys.argv:
        guardar(anuncios, inscr)
        print('\n   -> %s' % os.path.relpath(SALIDA, BASE))
    else:
        print('\n   (no guardé nada — corré con --aplicar)')
    print('')
    return 0


if __name__ == '__main__':
    raise SystemExit(main() or 0)
