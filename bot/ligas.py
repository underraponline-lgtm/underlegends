# -*- coding: utf-8 -*-
"""LAS LIGAS DE LOS SERVIDORES: cada batalla, como duelo, y la tabla de cada liga.

    python bot/ligas.py            qué leyó de Discord, sin escribir nada
    python bot/ligas.py --aplicar  y lo deja en datos/ligas.json (lo corre el ciclo)
    python bot/ligas.py --auto     el self-check, sin red ni archivos

Dlx, 12/10/2026, a «¿qué hacemos con tantas ligas?»: *«1. A»* —las batallas de liga cuentan como DUELOS: el Ranking
Duelos y el Win%, y el Score no— y *«2. Me gusta»* —la pestaña «Ligas» del Ranking, con la tabla de cada una—. Y a la
Copa de Campeones, que no: *«cada liga tiene su inicio y su fin aleatoriamente… no podemos controlar eso»*. Por eso
acá no hay calendario de ligas: se lee lo que cada una publica, cuando lo publica.

DIEZ LIGAS EN TRES SERVIDORES, Y CADA SERVIDOR ESCRIBE A SU MANERA (relevado el 12/10/2026 leyendo sus canales):

    U   Urban Freestyle, las seis FMH   un título `# A VS B`, los votos de cada jurado y un cierre del host
    D1  DDF, FMS TITANS                 título, `# 👈 a - b` y `# GANADOR [REPLICA] X`
    D2  DDF, FMS PERU (y las dos nuevas) título, `**a PTB - b PTB**` y una mano: 🫲/👈 la izquierda, 🫱/👉 la derecha
    S   Snake Rap, Generations y New Chapter, en el mismo canal: el `PTB OFICIAL` es la batalla entera
    F   FRZ, la FZ LEAGUE                cada jornada cerrada en un mensaje: «X VENCE DE MANERA DIRECTA A Y»
    FD  FDS, Perú y México (20/10/2026)  un mensaje por batalla: el título, los puntos de cada patrón, el `Total:` y el
                                        PTB del cierre (+500 directo, +300 y +100 con réplica); o «## Gana X» a secas.
                                        «por df» (no se presentó) no es una batalla. Tier 3: no cuentan como duelos
    K   LKR, Champions League y FMS     el título `# A vs B`, los puntos en otro mensaje y «GANADOR X» en otro más;
        Plaza Underground (21/10/2026)  «GANADOR Replica» o «Replica» abre la réplica. Tier 3: no cuentan como duelos

🔴 SÓLO CUENTA UNA BATALLA CON UN CIERRE QUE NO DEJA DUDAS. Los jurados deforman los nombres, votan con «# X» en la
misma conversación en que se discute, hay réplicas de réplicas y un cierre puede llegar horas después como respuesta a
un voto viejo (Carimex, 04/10). Lo que se puede leer sin adivinar es el CIERRE: el «X GANA DIRECTO / EN REPLICA» del
host, el `+3` / `+2` del PTB TOTAL, «X Por N Puntos» con N ≥ 2 sin réplica, el `GANADOR` de DDF, la mano de FMS PERU y
el `PTB OFICIAL` de Snake. Una batalla sin eso queda PENDIENTE: no suma ni resta. Un duelo inventado ensucia el Win%
de dos personas y no falla en ningún lado.

⚠️ EL REPO ES PÚBLICO: no se guardan los mensajes —traen la charla de los jurados—, sólo cada batalla: quiénes, quién
ganó, cómo, en qué jornada y de qué mensaje sale. Como `datos/veredictos.json`.

⚠️ Y ESTOS CANALES NO SON DE EVENTOS: sus categorías están en `categorias_fuera` (`datos/servidores.json`), así el
lector de llaves no arma eventos con ellos. Se lo comía: una «RÉPLICA FINAL» de Carimex quedó como la llave «FINAL MCO
🆚 FORCE». Si se suma una liga acá, su categoría va allá.

🏟️ CADA LIGA COMO UN TORNEO (Dlx, 14/10/2026: «Rework de la página de Ligas», «Flyers en Publicaciones e Historias»,
«Encuesta ¿quién gana la liga?» y «Ligas en el Inicio»). Además de los veredictos se lee el canal de ANUNCIOS de cada
liga (`an`), y de ahí salen dos cosas:

    el FLYER         la última imagen que publicó (el afiche de su batalla o de su jornada), re-alojada en R2
                     (`subir_flyer()`): el link de Discord vence a las horas, así que una página que lo usara mostraría
                     una imagen rota al día siguiente. Sin la copia en R2 no hay flyer —«sin dato no hay pieza»—
    la PRÓXIMA FECHA lo que el anuncio DICE: «nos vemos este Domingo 18 de Octubre» (FMH España), «HOY la sede…»
                     (FMH Andes) o la marca de Discord `<t:…>`. Con hora SÓLO si es la marca o una hora con bandera,
                     como en `cuando.py`; si no, el día solo. «Tienen plazo HASTA el 24» no es una fecha: es un límite

Y la ENCUESTA «¿quién gana la liga?»: las opciones son la tabla y cierra cuando la liga termina (`vota()`). Cuándo
termina una liga no lo dice nadie —cada servidor la arranca y la cierra cuando quiere—, así que se toma como terminada
a las `CIERRA_DIAS` sin batallas, salvo que haya una próxima fecha anunciada.
"""
import datetime as dt
import difflib
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

SALIDA = os.path.join(BASE, 'datos', 'ligas.json')

#: cada liga: nombre, servidor, familia de formato y sus canales. `emoji`: en Snake Rap las dos ligas comparten canal y
#: las separa el emoji del título del PTB OFICIAL (y del afiche).
#: 📢 `an`: el canal donde anuncia (de ahí, el flyer y la próxima fecha) y `cc`: el país cuya hora vale para «hoy» o «el
#: domingo». Relevado el 14/10/2026: las FMH publican un afiche por batalla en «Anuncios-<liga>» (1080×1350); DDF anuncia
#: en «Noticias» (World Series con afiche; Titans y Perú, sólo texto: sin flyer); Snake Rap, en «enfrentamientos»
LIGAS = {
    'fmh-albiceleste': {'n': 'FMH Albiceleste', 'sv': 'URBF', 'fam': 'U', 'vre': r'(?:FMH|MASTER\s+HONGO).*ALBICELESTE|ALBICELESTE.*(?:FMH|MASTER\s+HONGO)', 'ver': '1511968616025952347',
                        'tabla': '1511968417412939897', 'an': '1511968150218866728', 'cc': 'AR'},
    'fmh-andes': {'n': 'FMH Andes', 'sv': 'URBF', 'fam': 'U', 'vre': r'(?:FMH|MASTER\s+HONGO).*ANDES|ANDES.*(?:FMH|MASTER\s+HONGO)', 'ver': '1511969253325017178',
                  'tabla': '1511969122961850448', 'an': '1511969014782365846', 'cc': 'CL'},
    'fmh-carimex': {'n': 'FMH Carimex', 'sv': 'URBF', 'fam': 'U', 'vre': r'(?:FMH|MASTER\s+HONGO).*CARIMEX|CARIMEX.*(?:FMH|MASTER\s+HONGO)', 'ver': '1511969585770004532',
                    'tabla': '1511969454794477598', 'an': '1511969434531528814', 'cc': 'MX'},
    'fmh-tricolor': {'n': 'FMH Tricolor', 'sv': 'URBF', 'fam': 'U', 'vre': r'(?:FMH|MASTER\s+HONGO).*TRICOLOR|TRICOLOR.*(?:FMH|MASTER\s+HONGO)', 'ver': '1511973074973626428',
                     'tabla': '1511972739215261917', 'an': '1511972607338221680', 'cc': 'CO'},
    'fmh-under': {'n': 'FMH Under', 'sv': 'URBF', 'fam': 'U', 'vre': r'(?:FMH|MASTER\s+HONGO).*UNDER|UNDER.*(?:FMH|MASTER\s+HONGO)', 'ver': '1527565480003637268',
                  'tabla': '1527565426622726236', 'an': '1527564677641404487', 'cc': 'VE'},
    'fmh-espana': {'n': 'FMH España', 'sv': 'URBF', 'fam': 'U', 'vre': r'(?:FMH|MASTER\s+HONGO).*ESPA[NÑ]A|ESPA[NÑ]A.*(?:FMH|MASTER\s+HONGO)', 'ver': '1511973539438399590',
                   'tabla': '1511973442033946644', 'an': '1512167830919839844', 'cc': 'ES'},
    'fms-titans': {'n': 'FMS Titans', 'sv': 'DDF', 'fam': 'D1', 'vre': r'TITANS', 'ver': '1551345471086272542',
                   'tabla': '1550947722385694871', 'an': '1551426096665337896', 'cc': 'PE'},
    'fms-peru': {'n': 'FMS Perú', 'sv': 'DDF', 'fam': 'D2', 'vre': r'FMS\s+PER[UÚ]', 'ver': '1556501721004376105',
                 'tabla': '1556501553609834557', 'an': '1556501776272724078', 'cc': 'PE'},
    'fms-tricolor': {'n': 'FMS Tricolor', 'sv': 'DDF', 'fam': 'D2', 'vre': r'FMS\s+TRICOLOR', 'ver': '1557529352529387600',
                     'tabla': '1557528234885779587', 'an': '1557529416605761557', 'cc': 'CO'},
    'fms-world-series': {'n': 'FMS World Series', 'sv': 'DDF', 'fam': 'D2', 'vre': r'FMS\s+WORLD\s+SERIES', 'ver': '1559218872547283096',
                         'tabla': '1559100558487584838', 'an': '1559219024947183726', 'cc': 'CO'},
    'snake-generations': {'n': 'Snake League Generations', 'sv': 'SR', 'fam': 'S', 'vre': r'SNAKE\s+LEAGUE', 'ver': '1167906700452446218',
                          'tabla': '1117080676416638977', 'emoji': 'snkliga', 'an': '1117081139702665236', 'cc': 'AR'},
    'snake-new-chapter': {'n': 'Snake New Chapter', 'sv': 'SR', 'fam': 'S', 'vre': r'NEW\s+CHAPTER', 'ver': '1167906700452446218',
                          'tabla': '1544074821506437140', 'emoji': 'newchapter', 'an': '1117081139702665236',
                          'cc': 'AR'},
    # 🔱 FRZ entró a la Liga el 14/10/2026 y Dlx decidió que su FZ LEAGUE va a Ligas, como las FMH. No tiene veredicto
    # por batalla: su canal «resultados» publica cada jornada entera ya cerrada («X VENCE DE MANERA DIRECTA A Y»), así
    # que `ver` es ese canal. `tit`: el encabezado de lo suyo (el mismo canal trae la FMS World Series de FRZ), y
    # `reemplaza`: se queda sólo la temporada más nueva, no se suma a lo guardado (cuando arranque la 17, la 16 se va)
    'fzl': {'n': 'FZ League', 'sv': 'FRZ', 'fam': 'F', 'vre': r'FZ\s*LEAGUE|\bFZL\b', 'ver': '961680549712396408', 'tabla': '845072946829721701',
            'an': '838599987280609300', 'cc': 'PE', 'tit': r'\bFZ\s+LEAGUE\b|\bFREESTYLE\s+ZONE\s+LEAGUE\b',
            'reemplaza': True},
    # 🎙️ FDS entró el 20/10/2026 como Tier 3 (Dlx: «crea su página del servidor y añade sus ligas, pero no cuentes para la
    # Liga Global nada aún»): sus dos ligas van acá y NO cuentan como duelos (`duelos()` salta a los bajados). Cada una
    # tiene su categoría —anuncios, fechas, resultados y tabla—: `ver` es «resultados» (un mensaje por batalla, cerrado
    # con el PTB), `an` es «fechas» (la jornada con sede, la marca de Discord y el afiche) y `tabla` es una imagen
    'fds-peru': {'n': 'FDS Perú', 'sv': 'FDS', 'fam': 'FD', 'vre': r'FDS\s*PER[UÚ]', 'ver': '1540179968879890452',
                 'tabla': '1540180092058210414', 'an': '1540179843017080845', 'cc': 'PE'},
    'fds-mexico': {'n': 'FDS México', 'sv': 'FDS', 'fam': 'FD', 'vre': r'FDS\s*M[EÉ]XICO', 'ver': '1558967211820065239',
                   'tabla': '1558967354946363513', 'an': '1558967030777126922', 'cc': 'MX'},
    # 👑 LKR, dado de alta desde el Dashboard el 21/10/2026 (Tier 3): sus dos ligas, con la familia K. `ver` es su canal de
    # veredictos; `an`, el de anuncios (la Champions) o el de batallas confirmadas (la FMS, que publica ahí)
    'lkr-champions': {'n': 'Champions League LKR', 'sv': 'LKR', 'fam': 'K', 'vre': r'CHAMPI?ONS?\s*LE(A)?GUE',
                      'ver': '1560753316768653343', 'tabla': '1559772874183540786', 'an': '1559772764704084128', 'cc': 'MX'},
    'lkr-fms-plaza': {'n': 'FMS Plaza Underground', 'sv': 'LKR', 'fam': 'K', 'vre': r'PLAZA\s*U[BN]DERGROUND',
                      'ver': '1561974380341497867', 'tabla': '', 'an': '1561974281041092638', 'cc': 'MX'},
}
#: 🗳️ la encuesta «¿quién gana la liga?» cierra a los tantos días sin batallas (y sin una fecha anunciada por delante):
#: es lo único que dice que una liga terminó. Ver `vota()`
CIERRA_DIAS = 21
#: la clave de KV que lee el Worker para validar cada voto (`validarVotoLiga()` en bot/avisos.js). Ver `para_kv()`
CLAVE_KV = 'ligas:votar'
#: 🖼️ el flyer re-alojado: a qué ancho se achica y con qué calidad (lo más grande que lo dibuja la página son ~520 px)
ANCHO_FLYER, CALIDAD_FLYER = 720, 82
#: cuántos mensajes del canal de anuncios se leen por corrida (un solo pedido: los flyers, la fecha y quién organiza)
ANUNCIOS_LEER = 100
#: cuántas fechas (jornadas) de cada liga viajan a la página, las más nuevas (van en el detalle, no en el lobby)
FECHAS_WEB = 40
#: 🖼️ cuántos afiches de cada liga viajan a la galería, y cuántos nuevos se suben a R2 por corrida (la primera vez son
#: muchos: así entran de a poco y la corrida no se alarga)
FLYERS_WEB, FLYERS_SUBIR = 12, 4
#: 🧑‍⚖️ cuántos del staff de cada liga, y cuántos días sigue alguien en la lista sin publicar en sus canales
STAFF_WEB, STAFF_DIAS = 12, 60
#: 🔔 cuánto dura una novedad para «Seguir la liga» (lo que lee el vigía de `bot/avisos.js`)
NOV_HORAS = 48
#: los puntos de la tabla: directa 3 y 0; réplica 2 y 1 (así puntúan las FMH y Snake: «+3 directo; en réplica +2 el
#: ganador y +1 el perdedor»)
PUNTOS = {'directa': (3, 0), 'replica': (2, 1)}
#: cuántos mensajes se leen de cada canal por corrida, y cuántos la primera vez (la temporada entera)
PAGINAS, PAGINAS_PRIMERA = 2, 8

EMOJI = re.compile(r'<a?:(\w+):\d+>')
BANDERA = re.compile('[\U0001F1E6-\U0001F1FF]')
#: el separador de los dos lados: ` VS `, 🆚, `<:VSAzul:…>`, `<:vs:…>`, `<:versus_:…>`, `<:VS8:…>`
SEP = re.compile(r'\s(?:vs\.?|v/s|versus)\s|🆚|<a?:\w*(?:vs|versus)\w*:\d+>', re.I)
JORNADA = re.compile(r'\bJORNADA\s*-?\s*(\d{1,2})\b|\bBATALLA\s+J\s*(\d{1,2})\b', re.I)
REPLICA = re.compile(r'\bR[EÉ]PLICA\b', re.I)


def _letras(t):
    """El texto con las letras de fantasía en latinas (`escuchar.plano()`: `𝙺𝚁𝚃 𝚅𝚂` es `KRT VS`), con sus tildes."""
    import escuchar as E
    return unicodedata.normalize('NFC', E.plano(str(t or '')))


def _plano(t):
    """`_letras()` y además en NFKD sin tildes: para buscar y comparar, no para mostrar."""
    t = unicodedata.normalize('NFKD', _letras(t))
    return ''.join(c for c in t if not unicodedata.combining(c))


def clave(nombre):
    """Para comparar dos nombres: sin emojis, banderas ni nada que no sea letra o número."""
    t = EMOJI.sub(' ', _plano(nombre))
    return re.sub(r'[^a-z0-9]', '', t.lower())


def limpio(nombre):
    """El nombre como se muestra: sin emojis propios, banderas, 🎮, negritas ni lo que va entre paréntesis."""
    t = EMOJI.sub(' ', _letras(nombre))
    t = BANDERA.sub(' ', t)
    t = re.sub(r'\([^)]*\)', ' ', t)
    t = ''.join(c for c in t if unicodedata.category(c)[0] in 'LNZ' or c in ".'-_")
    return re.sub(r'\s+', ' ', t).strip(' .-_')


def lados(linea):
    """`(a, b, extra_a, extra_b)` de un título `# A VS B`, o `None`. `extra`: el 🎮 del ExtraPlayer (un invitado)."""
    l = _letras(linea).strip()
    if not l.startswith('#'):
        return None
    l = l.lstrip('#').strip()
    if re.search(r'EXHIBICI[OÓ]N', _plano(l), re.I) or re.search(r'PTB|TABLA', _plano(l), re.I):
        return None
    # el logo de la liga y los fuegos que envuelven el título no son de nadie: se va todo emoji propio que no sea el VS
    partes = SEP.split(l)
    if len(partes) != 2:
        return None
    a, b = partes
    # «… - JORNADA 4» al final del título de FMH Under, y «…| Jornada 2» en el de FDS
    b = re.sub(r'\s*[-|]\s*JORNADA\s*\d+.*$', '', b, flags=re.I)
    ea, eb = '🎮' in a, '🎮' in b
    a, b = limpio(a), limpio(b)
    # en DDF Titans el título lleva «(REMPLAZO)»: `limpio()` ya lo saca
    if not (re.search(r'[A-Za-z]', a) and re.search(r'[A-Za-z]', b)) or len(a) > 40 or len(b) > 40:
        return None
    return a, b, ea, eb


def _quien(texto, a, b):
    """¿El texto nombra a `a` o a `b`? `'a'`, `'b'` o `None` (los dos o ninguno)."""
    t = clave(texto)
    ka, kb = clave(a), clave(b)
    ha = bool(ka) and ka in t
    hb = bool(kb) and kb in t
    if ha and hb:
        # el más largo gana si uno contiene al otro («SOL» y «SOLITARIO»)
        if ka in kb:
            return 'b'
        if kb in ka:
            return 'a'
        return None
    return 'a' if ha else 'b' if hb else None


def marca_replica(linea):
    """¿El renglón ES la marca de réplica (`# ⚔️ RÉPLICA ⚔️`, `**REPLICA DIRECTA**`, `# RÉPLICA FINAL`)? Que un jurado
    escriba «casi remonta para la réplica» no lo es: Force vs Campoy (Carimex, 05/10) fue directa y quedaba pendiente."""
    t = re.sub(r'[^a-z0-9]', '', EMOJI.sub(' ', _plano(linea)).lower())
    return bool(re.fullmatch(r'replica(\d|final|directa)?', t))


# ── familia U: Urban Freestyle ────────────────────────────────────────────
GANA = re.compile(r'^\W*(.+?)\s+GANA\s+(DIRECTO|DIRECTA|EN\s+(?:LA\s+)?R[EÉ]PLICA)', re.I)
POR_PUNTOS = re.compile(r'^#+\s*(.+?)\s+POR\s+([\d]+(?:[.,]\d+)?)\s+PUNTOS?\b', re.I)
PTB_LINEA = re.compile(r'^\W*(.+?)\s*:\s*(\d+(?:[.,]\d+)?)\s*(?:\(\s*[\d.,]+\s*\))?\s*\**\s*(\+\s*[0-3])?', re.I)
#: 📊 el PTB de un lado: «ZIGNOS 🇩🇴 : 36.5 (109.5)» (el total entre paréntesis, si está) o «CINEXFILO 🇻🇪: 117 +2»
PTB_PAR = re.compile(r'^\W*(.+?)\s*:\s*(\d+(?:[.,]\d+)?)\s*(?:\(\s*(\d+(?:[.,]\d+)?)\s*\))?', re.I)


def _num(x):
    return float(str(x).replace(',', '.'))


def _u(msgs):
    """Las batallas de un canal de FMH: `[{id, t, a, b, ea, eb, j, gana, como}]` (`gana` vacío: pendiente)."""
    bats, j = [], None
    for m in msgs:
        texto = m.get('content') or ''
        for l in texto.splitlines():
            p = _plano(l)
            lj = JORNADA.search(p)
            ls = lados(l)
            if lj and not ls:
                j = int(lj.group(1) or lj.group(2))
                continue
            if ls:
                bats.append({'id': m['id'], 't': m['t'], 'a': ls[0], 'b': ls[1], 'ea': ls[2], 'eb': ls[3], 'j': j,
                             'gana': '', 'como': '', 'rep': False, 'df': False, 'por': None, 'ptb': None})
        if not bats:
            continue
        _u_cierre(texto, bats)
    for b in bats:
        if not b['gana'] and b['ptb'] and not b['rep']:
            # el PTB TOTAL sin marcas y sin réplica: gana el de más PTB si la diferencia es de victoria directa
            (pa, pb, x3) = b['ptb']
            dif = abs(pa - pb)
            if dif >= (6 if x3 else 2):
                b['gana'], b['como'] = (b['a'] if pa > pb else b['b']), 'directa'
        if not b['gana'] and b['por'] and not b['rep'] and b['por'][1] >= 2:
            b['gana'], b['como'] = b['por'][0], 'directa'
    return bats


def _u_cierre(texto, bats):
    """Lo que dice un mensaje de FMH sobre la batalla que nombra (la última que tenga a esos dos)."""
    p = _plano(texto)
    lineas = [l for l in texto.splitlines() if l.strip()]

    def batalla(*nombres):
        for b in reversed(bats[-8:]):
            if all(_quien(n, b['a'], b['b']) for n in nombres if n):
                return b
        return None
    # 📊 el PTB de cada lado, si el mensaje lo dice (para los números de la liga: el MVP de cada jornada, la mejor
    # batalla). No decide nada: quién ganó sale de los cierres de abajo.
    # ⚠️ EN LA ESCALA DEL PROMEDIO DE LOS JURADOS: «ZIGNOS: 36.5 (109.5)» es 36.5 —el promedio; entre paréntesis, la
    # suma de los tres—, y el «PTB TOTAL» es la suma, así que va dividido 3. Mezclar las dos escalas ponía a una batalla
    # de 183 «PTB» arriba de todas en Números (FMH España, 17/10/2026)
    pares = []
    total = bool(re.search(r'PTB\s+TOTAL', p, re.I))
    for l in lineas:
        mm = PTB_PAR.match(EMOJI.sub(' ', _plano(l)).replace('**', ''))
        if mm and not re.search(r'PTB|GANA|TOTAL|JORNADA', mm.group(1), re.I) and len(clave(mm.group(1))) >= 2:
            v = _num(mm.group(2))
            pares.append((mm.group(1), round(v / 3, 1) if total and not mm.group(3) else v))
    if len(pares) >= 2:
        b0 = batalla(pares[0][0], pares[1][0])
        if b0 and not b0.get('ptbv'):
            l0, l1 = _quien(pares[0][0], b0['a'], b0['b']), _quien(pares[1][0], b0['a'], b0['b'])
            if l0 and l1 and l0 != l1:
                b0['ptbv'] = (pares[0][1], pares[1][1]) if l0 == 'a' else (pares[1][1], pares[0][1])
    if re.search(r'\bDF\b', p) and len(lineas) <= 6:
        b = bats[-1]
        if _quien(texto, b['a'], b['b']) or re.search(r'\bDF\b', p):
            b['df'] = True
        return
    if any(marca_replica(l) for l in lineas):
        bats[-1]['rep'] = True
    for l in lineas:
        # «# GANA ALUVIÓN 🇨🇱» (Carimex, 04/10): el verbo adelante, y sólo vale después de la marca de réplica —antes es
        # el voto de un jurado—
        g2 = re.match(r'^\W*GANA\s+(.+)$', _plano(l), re.I)
        if g2 and not GANA.match(_plano(l)):
            b = batalla(g2.group(1))
            if b and b['rep'] and not b['gana']:
                lado = _quien(g2.group(1), b['a'], b['b'])
                if lado:
                    b['gana'], b['como'] = b[lado], 'replica'
            continue
        g = GANA.match(_plano(l))
        if g:
            b = batalla(g.group(1))
            if b:
                lado = _quien(g.group(1), b['a'], b['b'])
                if lado:
                    b['gana'] = b[lado]
                    b['como'] = 'directa' if g.group(2).upper().startswith('DIRECT') else 'replica'
            return
    # el PTB TOTAL (o un cierre de la forma «NOMBRE: 36.5 (109.5)»): dos renglones «NOMBRE: número [+N]»
    if re.search(r'PTB\s+TOTAL', p, re.I):
        pares = []
        for l in lineas:
            mm = PTB_LINEA.match(EMOJI.sub(' ', _plano(l)).replace('**', ''))
            if mm and not re.search(r'PTB\s+TOTAL', mm.group(1), re.I):
                pares.append((mm.group(1), float(mm.group(2).replace(',', '.')),
                              int(re.sub(r'\D', '', mm.group(3))) if mm.group(3) else None))
        if len(pares) >= 2:
            b = batalla(pares[0][0], pares[1][0])
            if b:
                x3 = bool(re.search(r'X\s*3', p, re.I))
                (na, pa, ma), (nb, pb, mb) = pares[:2]
                if _quien(na, b['a'], b['b']) == 'b':
                    (na, pa, ma), (nb, pb, mb) = (nb, pb, mb), (na, pa, ma)
                if ma in (2, 3) and mb not in (2, 3):
                    b['gana'], b['como'] = b['a'], 'directa' if ma == 3 else 'replica'
                elif mb in (2, 3) and ma not in (2, 3):
                    b['gana'], b['como'] = b['b'], 'directa' if mb == 3 else 'replica'
                else:
                    b['ptb'] = (pa, pb, x3)
        return
    for l in lineas:
        mm = POR_PUNTOS.match(_plano(l))
        if mm:
            b = batalla(mm.group(1))
            if b:
                lado = _quien(mm.group(1), b['a'], b['b'])
                if lado:
                    b['por'] = (b[lado], float(mm.group(2).replace(',', '.')))


# ── familia D1: FMS TITANS ────────────────────────────────────────────────
GANADOR = re.compile(r'^#*\s*GANADOR\s*(REPLICA\s*)?:?\s*(.*)$', re.I)
FLECHA_IZQ, FLECHA_DER = re.compile('👈|🫲'), re.compile('👉|🫱')


def _d1(msgs):
    bats, j = [], None
    for m in msgs:
        for l in (m.get('content') or '').splitlines():
            p = _plano(l)
            lj = JORNADA.search(p)
            ls = lados(l)
            if lj and not ls:
                j = int(lj.group(1) or lj.group(2))
                continue
            if ls:
                bats.append({'id': m['id'], 't': m['t'], 'a': ls[0], 'b': ls[1], 'ea': ls[2], 'eb': ls[3], 'j': j,
                             'gana': '', 'como': '', 'flecha': None, 'rep': False})
                continue
            if not bats:
                continue
            b = bats[-1]
            sin = EMOJI.sub(' ', p).strip()
            g = GANADOR.match(sin.lstrip('# '))
            if g:
                if re.match(r'\s*(DEFAULT|NADIE)', g.group(2) or '', re.I):
                    b['gana'] = ''
                    b['nulo'] = True
                    continue
                lado = _quien(g.group(2) or '', b['a'], b['b'])
                if not lado and b['flecha']:
                    lado = b['flecha']
                if lado:
                    b['gana'], b['como'] = b[lado], 'replica' if (g.group(1) or b['rep']) else 'directa'
                continue
            if re.match(r'^#?\s*X\b', sin) or REPLICA.search(sin):
                b['rep'] = True
            mp = PUNTAJE.search(sin)
            if mp and not b.get('ptbv'):
                b['ptbv'] = (_num(mp.group(1)), _num(mp.group(2)))
            iz, de = bool(FLECHA_IZQ.search(l)), bool(FLECHA_DER.search(l))
            if iz != de:
                # la flecha de la réplica nombra a alguien («# 👈 CRONOX»): manda el nombre
                b['flecha'] = _quien(sin, b['a'], b['b']) or ('a' if iz else 'b')
    return bats


# ── familia D2: FMS PERU ──────────────────────────────────────────────────
PUNTAJE = re.compile(r'(\d+(?:[.,]\d+)?)\s*(?:PTB)?\s*-\s*(\d+(?:[.,]\d+)?)', re.I)


def _d2(msgs):
    bats, j = [], None
    for m in msgs:
        for l in (m.get('content') or '').splitlines():
            p = _plano(l)
            lj = JORNADA.search(p)
            ls = lados(l)
            if lj and not ls:
                j = int(lj.group(1) or lj.group(2))
                continue
            if ls:
                bats.append({'id': m['id'], 't': m['t'], 'a': ls[0], 'b': ls[1], 'ea': ls[2], 'eb': ls[3], 'j': j,
                             'gana': '', 'como': '', 'rep': False, 'pts': False})
                continue
            if not bats or bats[-1]['gana']:
                continue
            b = bats[-1]
            sin = EMOJI.sub(' ', p).replace('*', '').strip()
            if re.match(r'^#\s*-{3,}', l.strip()):
                continue
            iz, de = bool(FLECHA_IZQ.search(l)), bool(FLECHA_DER.search(l))
            replica = (iz and de) or bool(re.search('❌|❎|⚔', l)) or bool(REPLICA.search(sin) and not (iz or de))
            mp = PUNTAJE.search(sin)
            if mp:
                b['pts'] = True
                if not b.get('ptbv'):
                    b['ptbv'] = (_num(mp.group(1)), _num(mp.group(2)))
            if replica:
                b['rep'] = True
                continue
            if iz != de and (b['pts'] or b['rep']):
                b['gana'], b['como'] = b['a' if iz else 'b'], 'replica' if b['rep'] else 'directa'
                continue
            # la réplica resuelta con el nombre solo: `# 🇵🇪SOL🇵🇪`
            if b['rep'] and l.strip().startswith('#'):
                lado = _quien(sin, b['a'], b['b'])
                if lado and len(clave(sin)) <= len(clave(b[lado])) + 2:
                    b['gana'], b['como'] = b[lado], 'replica'
    return bats


# ── familia S: Snake Rap ──────────────────────────────────────────────────
PTB_SNAKE = re.compile(r'^\W*(.+?)\s*-\s*(\d+(?:[.,]\d+)?)\s*<a?:(\d)pts?:\d+>', re.I)


def _s(msgs, emoji):
    """Los `PTB OFICIAL` de la liga cuyo título lleva `emoji` (en minúsculas, sin `<:` ni el id)."""
    bats = []
    for m in msgs:
        texto = m.get('content') or ''
        if not re.search(r'PTB\s+OFICIAL', _plano(texto), re.I):
            continue
        prim = texto.strip().splitlines()[0] if texto.strip() else ''
        if not any(x.lower() == emoji for x in EMOJI.findall(prim)):
            continue
        filas = []
        for l in texto.splitlines()[1:]:
            mm = PTB_SNAKE.match(_plano(l).replace('*', ''))
            if mm:
                filas.append((limpio(mm.group(1)), int(mm.group(3)), '🎮' in l, _num(mm.group(2))))
        if len(filas) != 2:
            continue
        (a, pa, ea, ta), (b, pb, eb, tb) = filas
        if not a or not b or {pa, pb} not in ({3, 0}, {2, 1}):
            continue
        gana = a if pa > pb else b
        bats.append({'id': m['id'], 't': m['t'], 'a': a, 'b': b, 'ea': ea, 'eb': eb, 'j': None,
                     'gana': gana, 'como': 'directa' if max(pa, pb) == 3 else 'replica', 'ptbv': (ta, tb)})
    return bats


# ── familia F: FRZ, la FZ LEAGUE ──────────────────────────────────────────
#: «CEKO 🇦🇷 VENCE DE MANERA DIRECTA A BM 🇦🇷» y «CEIM 🇨🇱 VENCE TRAS RÉPLICA A BM 🇦🇷» (su canal «resultados»), y el
#: orden de su canal «tabla»: «CEKO 🇦🇷 VENCE A BM 🇦🇷 DE MANERA DIRECTA». Sobre el texto sin tildes (`_plano()`)
VENCE = re.compile(r'^[\W_]*(.+?)\s+VENCE\s+(?:(?:DE\s+MANERA\s+)?(DIRECTA|TRAS\s+REPLICA|EN\s+REPLICA)\s+A\s+(.+?)'
                   r'|A\s+(.+?)\s+(?:DE\s+MANERA\s+)?(DIRECTA|TRAS\s+REPLICA|EN\s+REPLICA))[\W_]*$', re.I)
TEMPORADA = re.compile(r'\bTEMPORADA\s+(\d{1,3})\b', re.I)


def _f(msgs, titulo):
    """Las batallas de la temporada MÁS NUEVA de una liga que publica cada jornada cerrada en un mensaje: el encabezado
    («FZ LEAGUE - TEMPORADA 16 JORNADA 9», que tiene que cumplir `titulo`) y un renglón por batalla.

    ⚠️ «SOL & VENUS DIVIDEN PUNTOS» no es un duelo con ganador: no entra (ni a la tabla ni a los duelos). La tabla
    oficial le da puntos a los dos; la de acá no los inventa —el link a la suya lo aclara—."""
    filas = []
    for m in msgs:
        texto = m.get('content') or ''
        p = _plano(texto)
        t, j = TEMPORADA.search(p), JORNADA.search(p)
        if not (t and j and re.search(titulo, p, re.I)):
            continue
        bats = []
        for l in texto.splitlines():
            mm = VENCE.match(EMOJI.sub(' ', _plano(l)).replace('*', ''))
            if not mm:
                continue
            a, b = limpio(mm.group(1)), limpio(mm.group(3) or mm.group(4))
            # la temporada vieja traía menciones (`<@123>`) en vez de nombres: sin letras no es un nombre
            if not (re.search(r'[A-Za-z]', a) and re.search(r'[A-Za-z]', b)) or len(a) > 40 or len(b) > 40:
                continue
            como = 'directa' if (mm.group(2) or mm.group(5) or '').upper().startswith('DIRECT') else 'replica'
            bats.append((a, b, como))
        if bats:
            filas.append((int(t.group(1)), m, int(j.group(1) or j.group(2)), bats))
    if not filas:
        return []
    ult = max(f[0] for f in filas)
    out = []
    for temp, m, jor, bats in filas:
        if temp != ult:
            continue
        for i, (a, b, como) in enumerate(bats):
            # varias batallas por mensaje: cada una con su id (`<mensaje>-<orden>`), si no se pisarían al guardarlas
            out.append({'id': '%s-%d' % (m['id'], i), 't': m['t'], 'a': a, 'b': b, 'ea': False, 'eb': False, 'j': jor,
                        'gana': a, 'como': como})
    return out


def _orden(k):
    """Para ordenar las batallas por su id: el del mensaje y, si el mensaje trae varias (`<mensaje>-<orden>`), el orden."""
    p = str(k).split('-')
    return int(p[0]), int(p[1]) if len(p) > 1 and p[1].isdigit() else 0


# ── familia FD: Freestyle Discord Series (FDS Perú y FDS México, 20/10/2026) ──────────────────────────────────────
# Un mensaje por batalla en «resultados»: el título `# 🏅 A <:vs:> B | Jornada N 🏅`, los puntos de cada patrón (Easy,
# Hard, Temática, Rand, Minuto ida y vuelta, Deluxe), el `Total:` de cada lado y el PTB del cierre: `+500` al que gana
# directo (`-250` al otro), `+300` y `+100` cuando hubo réplica. Y los cierres cortos: `## Gana X`, `## Gana X por df`
# (el rival no se presentó: NO es una batalla, como el «dividen puntos» de FZL), `# GANADOR POR LA MINIMA Cine` en el
# mensaje de la réplica, y `# Gana : A 66 - B 60` sin título.
# ⚠️ AL CERRAR APODAN («Cine» y «Cinefilox» por CINEXFILO, «MC arepa» por MC AREPA): `_cual()` acepta el principio del
# nombre o un parecido claro de una palabra, siempre que el otro lado no se parezca. Y un «RESULTADOS 92 CINE - 87
# MCarepa» seguido de «REPLICA» no cierra nada: la réplica viene en el mensaje siguiente, con el mismo título.
GANA_FD = re.compile(r'^\W*GANA\s*:?\s*(.+?)\s*$', re.I)
MARCADOR_FD = re.compile(r'^\W*GANA\s*:?\s*(.+?)\s+(\d+(?:[.,]\d+)?)\s*-\s*(.+?)\s+(\d+(?:[.,]\d+)?)\s*$', re.I)
#: el PTB del cierre, un lado por renglón: «SOL: (+100)», «Cinexfilo: (-250)», «MC arepa +100»
PTB_FD = re.compile(r'^\W*(.+?)\s*:?\s*\(?\s*([+-])\s*(\d+)\s*\)?\s*$')
#: el total de un lado, sólo debajo de «Total:»: «SOL: (44.5)», «SOUL B : (36.5) -> +3 PTS»
TOTAL_FD = re.compile(r'^\W*(.+?)\s*:\s*\(\s*(\d+(?:[.,]\d+)?)\s*\)')


def _cual(texto, a, b):
    """Como `_quien()`, y si el texto no trae el nombre entero, por el principio o un parecido claro de alguna palabra
    (o de dos seguidas): «Cine» → Cinexfilo, «Cinefilox» → Cinexfilo, «MC arepa» → MC AREPA. `None` si no está claro."""
    r = _quien(texto, a, b)
    if r:
        return r
    ws = re.findall(r'[a-z0-9]+', EMOJI.sub(' ', _plano(texto)).lower())
    cands = [w for w in ws if len(w) >= 3] + [ws[i] + ws[i + 1] for i in range(len(ws) - 1)]

    def punt(k):
        best = 0.0
        for c in cands:
            if len(k) < 3:
                continue
            if c == k:
                v = 1.0
            elif len(c) >= 4 and k.startswith(c):
                v = 0.9
            else:
                v = difflib.SequenceMatcher(None, c, k).ratio()
            best = max(best, v)
        return best
    pa, pb = punt(clave(a)), punt(clave(b))
    if max(pa, pb) < 0.75 or abs(pa - pb) < 0.2:
        return None
    return 'a' if pa > pb else 'b'


def _fd(msgs):
    """Las batallas de una liga de FDS: `[{id, t, a, b, ea, eb, j, gana, como, df, ptbv}]`."""
    bats, j = [], None
    for m in msgs:
        texto = m.get('content') or ''
        lineas = [l for l in texto.splitlines() if l.strip()]
        for l in lineas:
            pl = _plano(l)
            ls = lados(l)
            lj = JORNADA.search(pl)
            if lj and not ls and l.lstrip().startswith('#'):
                j = int(lj.group(1) or lj.group(2))
                continue
            if ls:
                bats.append({'id': m['id'], 't': m['t'], 'a': ls[0], 'b': ls[1], 'ea': ls[2], 'eb': ls[3],
                             'j': int(lj.group(1) or lj.group(2)) if lj else j, 'gana': '', 'como': '', 'rep': False,
                             'df': False})
                continue
            mm = MARCADOR_FD.match(EMOJI.sub(' ', pl).replace('*', '').strip())
            if mm:
                a, b = limpio(mm.group(1)), limpio(mm.group(3))
                if re.search(r'[A-Za-z]', a) and re.search(r'[A-Za-z]', b) and len(a) <= 40 and len(b) <= 40:
                    bats.append({'id': m['id'], 't': m['t'], 'a': a, 'b': b, 'ea': False, 'eb': False, 'j': j,
                                 'gana': a, 'como': 'directa', 'rep': False, 'df': False})
        if not bats:
            continue
        # el cierre habla de la última batalla: FDS cierra cada una en su mensaje o en el siguiente (la réplica)
        b = bats[-1]
        if b['gana'] or b['df']:
            continue
        if any(marca_replica(l) for l in lineas):
            b['rep'] = True
        pares, totales, en_total = [], [], False
        for l in lineas:
            pl = EMOJI.sub(' ', _plano(l)).replace('*', '').strip()
            if re.match(r'^\W*TOTAL\b', pl, re.I):
                en_total = True
                continue
            if en_total:
                mt = TOTAL_FD.match(pl)
                if mt and len(totales) < 2:
                    totales.append((mt.group(1), _num(mt.group(2))))
                if len(totales) >= 2 or re.match(r'^\W*(PTB|PBT|R[EÉ]PLICA)\b', pl, re.I):
                    en_total = False
            mp = PTB_FD.match(pl)
            if mp and not lados(l):
                pares.append((mp.group(1), int(mp.group(3)) * (-1 if mp.group(2) == '-' else 1)))
                continue
            g = GANA_FD.match(pl)
            if g and re.search(r'\bDF\b', pl, re.I):
                b['df'] = True
                break
            gd = GANADOR.match(pl)
            quien = gd.group(2) if gd else (g.group(1) if g and not MARCADOR_FD.match(pl) else '')
            if quien and not b['gana']:
                lado = _cual(quien, b['a'], b['b'])
                if lado:
                    b['gana'], b['como'] = b[lado], 'replica' if b['rep'] else 'directa'
        if b['df']:
            continue
        if len(totales) == 2 and not b.get('ptbv'):
            la, lb = _cual(totales[0][0], b['a'], b['b']), _cual(totales[1][0], b['a'], b['b'])
            if la and lb and la != lb:
                b['ptbv'] = (totales[0][1], totales[1][1]) if la == 'a' else (totales[1][1], totales[0][1])
        if not b['gana'] and len(pares) >= 2 and pares[0][1] != pares[1][1]:
            la, lb = _cual(pares[0][0], b['a'], b['b']), _cual(pares[1][0], b['a'], b['b'])
            if la and lb and la != lb:
                b['gana'] = b[la if pares[0][1] > pares[1][1] else lb]
                b['como'] = 'replica' if (b['rep'] or max(pares[0][1], pares[1][1]) == 300) else 'directa'
    return bats


# ── familia K: LKR, la Champions League y la FMS Plaza Underground (21/10/2026) ───────────────────────────────────
# Cada batalla en varios mensajes de su canal de veredictos: el título `# Shadow 🇨🇴 vs Mc_Glock 🇲🇽`, los puntos de cada
# jurado («Shadow - X - I - X: 3.5», «Matthias🇻🇪 : 4») y el cierre, «GANADOR GLOCK» o «Ganador Matthias 🇻🇪». «Replica»
# solo, o «GANADOR Replica», abre la réplica, que se cierra con otro «GANADOR». Y al cierre también le dicen por el apodo
# («GLOCK» por Mc_Glock, «SOUL» por Soul B): lo resuelve `_cual()`, como en FDS. Sin cierre, la batalla queda pendiente.
def _lk(msgs):
    """Las batallas de una liga de LKR: `[{id, t, a, b, ea, eb, j, gana, como}]`."""
    bats = []
    for m in msgs:
        for l in (m.get('content') or '').splitlines():
            if not l.strip():
                continue
            ls = lados(l)
            if ls:
                bats.append({'id': m['id'], 't': m['t'], 'a': ls[0], 'b': ls[1], 'ea': ls[2], 'eb': ls[3], 'j': None,
                             'gana': '', 'como': '', 'rep': False})
                continue
            if not bats or bats[-1]['gana']:
                continue
            b = bats[-1]
            pl = EMOJI.sub(' ', _plano(l)).replace('*', '').strip()
            if marca_replica(l):
                b['rep'] = True
                continue
            g = GANADOR.match(pl)
            if g:
                quien = (g.group(2) or '').strip()
                if g.group(1) or re.fullmatch(r'r[eé]plica', quien, re.I):
                    b['rep'] = True
                    if not quien or re.fullmatch(r'r[eé]plica', quien, re.I):
                        continue
                lado = _cual(quien, b['a'], b['b'])
                if lado:
                    b['gana'], b['como'] = b[lado], 'replica' if b['rep'] else 'directa'
                continue
            # el cierre con el nombre solo, como en su canal de eventos: `# SOUL B 🇨🇱`
            if l.strip().startswith('#'):
                lado = _quien(pl, b['a'], b['b'])
                if lado and len(clave(pl)) <= len(clave(b[lado])) + 2:
                    b['gana'], b['como'] = b[lado], 'replica' if b['rep'] else 'directa'
    return bats


def leer_liga(lid, msgs, ptb=None):
    """Las batallas de una liga, de sus mensajes en orden: `[[id, iso, jornada, a, b, gana, como, extras]]`.

    `msgs`: `[{id, t (iso), content}]`, del más viejo al más nuevo. `extras`: `''`, `'a'`, `'b'` o `'ab'`.
    `ptb`: un dict donde dejar el PTB de cada batalla que lo dijo, `{id: [a, b]}` (17/10/2026). Va aparte y no en la
    batalla: varias partes la desarman por posición (`tabla()`, `duelos()`), y un campo más las rompía."""
    L = LIGAS[lid]
    f = L['fam']
    bats = _u(msgs) if f == 'U' else _d1(msgs) if f == 'D1' else _d2(msgs) if f == 'D2' else \
        _f(msgs, L['tit']) if f == 'F' else _fd(msgs) if f == 'FD' else _lk(msgs) if f == 'K' else _s(msgs, L['emoji'])
    out = []
    for i, b in enumerate(bats):
        if b.get('df') or b.get('nulo'):
            continue
        # el mismo título publicado dos veces (Faso vs MTZ, Albiceleste): cuenta el de después, que es el que se cerró
        par = {clave(b['a']), clave(b['b'])}
        if not b.get('gana') and any({clave(x['a']), clave(x['b'])} == par for x in bats[i + 1:i + 4]):
            continue
        out.append([b['id'], b['t'], b.get('j'), b['a'], b['b'], b.get('gana') or '', b.get('como') or '',
                    ('a' if b.get('ea') else '') + ('b' if b.get('eb') else '')])
        if ptb is not None and b.get('ptbv'):
            ptb[b['id']] = [round(b['ptbv'][0], 1), round(b['ptbv'][1], 1)]
    return out


def tabla(bats, r=None):
    """`[[nombre, jugadas, ganadas, puntos]]` de las batallas con resultado, sin los ExtraPlayers (son invitados).
    `r`: nombre → el de la Lista, para que «CRIZJ» y «CRISZJ» sean la misma fila (FMS PERU, 12/10/2026)."""
    r = r or (lambda x: x)
    t = {}
    for _id, _t, _j, a, b, gana, como, ex in bats:
        if not gana or como not in PUNTOS:
            continue
        a, b, gana = r(a), r(b), r(gana)
        pg, pp = PUNTOS[como]
        for lado, nom in (('a', a), ('b', b)):
            if lado in ex:
                continue
            x = t.setdefault(clave(nom), [nom, 0, 0, 0])
            x[1] += 1
            x[2] += 1 if nom == gana else 0
            x[3] += pg if nom == gana else pp
    return sorted(t.values(), key=lambda x: (-x[3], -x[2], x[1], x[0].lower()))


# ── el canal de anuncios: el flyer y la próxima fecha ─────────────────────
def es_flyer(a):
    """¿Ese adjunto es un afiche? Una imagen de verdad: ni la línea que separa los mensajes (1400×200), ni un banner
    (2172×238), ni un gif animado. Relevado el 14/10/2026: los afiches son 1080×1350, 1173×1341, 1179×1474…"""
    tipo = str(a.get('ct') or '').lower()
    w, h = int(a.get('w') or 0), int(a.get('h') or 0)
    return tipo.startswith('image/') and 'gif' not in tipo and w >= 400 and h >= 0.6 * w


def _de_la_liga(L, texto):
    """En un canal compartido (Snake Rap: las dos ligas en «enfrentamientos») el mensaje es de la liga si su primer
    renglón lleva su emoji. Las demás tienen el canal para ellas solas."""
    if not L.get('emoji'):
        return True
    prim = texto.strip().splitlines()[0] if texto.strip() else ''
    return any(x.lower() == L['emoji'] for x in EMOJI.findall(prim))


def titulo_flyer(texto):
    """De qué es el afiche, del primer renglón de su mensaje: «STORMED vs JOSELIYO» si es una batalla; si no, el renglón
    sin emojis propios, menciones ni marcas («ONCEAVA BATALLA CONFIRMADA 🇻🇪 VS 🇦🇷»). `''` si no dice nada."""
    prim = next((l for l in str(texto or '').splitlines() if l.strip()), '')
    # las menciones y el @everyone no son de nadie: sin esto, «… 🇻🇪 VS 🇦🇷 <@12> @everyone» era la batalla de «12 everyone»
    prim = re.sub(r'<[@#][!&]?\d+>|@everyone|@here|https?://\S+', ' ', prim)
    ls = lados(prim if prim.lstrip().startswith('#') else '# ' + prim)
    if ls:
        return '%s vs %s' % (ls[0], ls[1])
    t = EMOJI.sub(' ', _letras(prim))
    t = re.sub(r'[#*_|`>~=]+', ' ', t)
    return re.sub(r'\s+', ' ', t).strip(' .-:')[:90]


def flyer_de(L, msgs):
    """El último afiche de la liga en su canal de anuncios: `{id, t, w, h, tit, src}` o `None`. `src` es el link de
    Discord, que VENCE: sirve para bajarlo ahora (`subir_flyer()`), nunca se guarda ni se muestra."""
    for m in reversed(msgs):
        if not _de_la_liga(L, m.get('content') or ''):
            continue
        for a in m.get('adj') or []:
            if es_flyer(a) and a.get('u'):
                return {'id': m['id'], 't': m['t'], 'w': int(a['w']), 'h': int(a['h']),
                        'tit': titulo_flyer(m.get('content')), 'src': a['u']}
    return None


def flyers_de(L, msgs, desde='', tope=FLYERS_WEB):
    """🖼️ Los afiches de la liga en su canal de anuncios, el más nuevo primero: `[{id, msg, t, w, h, tit, src}]`. Un
    mensaje con dos afiches da dos (`<mensaje>-1`). `desde`: los de la temporada (lo de antes es otra)."""
    out = []
    for m in reversed(msgs or []):
        if not _de_la_liga(L, m.get('content') or '') or (desde and str(m.get('t') or '') < desde):
            continue
        for i, a in enumerate([a for a in m.get('adj') or [] if es_flyer(a) and a.get('u')]):
            out.append({'id': m['id'] + ('-%d' % i if i else ''), 'msg': m['id'], 't': m['t'], 'w': int(a['w']),
                        'h': int(a['h']), 'tit': titulo_flyer(m.get('content')), 'src': a['u']})
            if len(out) >= tope:
                return out
    return out


def _flyers_nuevos(lid, lista, viejos, aplicar):
    """La galería que queda guardada: lo que ya está en R2 se reusa, y de lo nuevo se suben hasta `FLYERS_SUBIR` por
    corrida. Lo de R2 que ya salió de la ventana de lectura se queda hasta el tope: no se pierde un afiche por viejo."""
    vie = {f['id']: f for f in viejos or [] if f and f.get('url')}
    out, subidos = [], 0
    for fl in lista:
        if fl['id'] in vie:
            out.append(vie[fl['id']])
            continue
        if not aplicar or subidos >= FLYERS_SUBIR:
            continue
        subidos += 1
        r = subir_flyer(lid, fl)
        if r:
            out.append({'id': fl['id'], 'msg': fl['msg'], 't': fl['t'], 'tit': fl.get('tit') or '', 'url': r[0],
                        'w': r[1], 'h': r[2]})
    ya = {f['id'] for f in out}
    for f in sorted(vie.values(), key=lambda f: f.get('t') or '', reverse=True):
        if f['id'] not in ya:
            out.append(f)
    out.sort(key=lambda f: f.get('t') or '', reverse=True)
    return out[:FLYERS_WEB]


def staff_de(L, ms_ver, ms_an, viejo=None, ahora=None):
    """🧑‍⚖️ Quiénes llevan la liga: los que publican en su canal de anuncios (organizan) y en el de veredictos (jurados y
    hosts), sin bots. `[[discord_id, nombre, anuncios, veredictos, último iso]]`, los que más publican primero.

    De la ventana que se lee en cada corrida; quien no aparece en ella se queda `STAFF_DIAS` desde su último mensaje.
    En un canal compartido (Snake Rap) cuenta sólo lo que es de esta liga (`_de_la_liga()`)."""
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    st = {}
    for i, ms in ((2, ms_an), (3, ms_ver)):
        for m in ms or []:
            if m.get('bot') or not m.get('au') or not _de_la_liga(L, m.get('content') or ''):
                continue
            x = st.setdefault(m['au'], [m['au'], m.get('aun') or '', 0, 0, ''])
            x[i] += 1
            x[4] = max(x[4], str(m.get('t') or ''))
            if m.get('aun'):
                x[1] = m['aun']
    corte = (ahora - dt.timedelta(days=STAFF_DIAS)).strftime('%Y-%m-%dT%H:%M:%SZ')
    for x in viejo or []:
        if len(x) == 5 and x[0] not in st and str(x[4]) >= corte:
            st[x[0]] = list(x)
    return sorted(st.values(), key=lambda x: (-(x[2] + x[3]), x[1].lower()))[:STAFF_WEB]


def novedades(lid, antes, bats, prox_antes, prox, viejas, ahora=None):
    """🔔 Lo nuevo de una liga en esta corrida, para «Seguir la liga»: `[{id, t, que, ids | d, j}]`, más las de antes que
    todavía no vencieron (`NOV_HORAS`). Uno por corrida y por liga con todos los resultados nuevos juntos —una jornada
    de cinco batallas es UN aviso, no cinco— y uno por cada fecha anunciada.

    ⚠️ Sólo si ya se conocía la liga (`antes`): la primera lectura trae la temporada entera, y no es una novedad."""
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    t = ahora.strftime('%Y-%m-%dT%H:%M:%SZ')
    corte = (ahora - dt.timedelta(hours=NOV_HORAS)).strftime('%Y-%m-%dT%H:%M:%SZ')
    out = [n for n in viejas or [] if str(n.get('t') or '') >= corte]
    if antes is None:
        return out
    ya = {n['id'] for n in out}
    nuevas = [b[0] for b in bats if b[5] and not (antes.get(b[0]) or [''] * 6)[5]]
    if nuevas:
        nid = 'r:%s:%s' % (lid, nuevas[-1])
        if nid not in ya:
            out.append({'id': nid, 't': t, 'que': 'res', 'ids': nuevas[-6:]})
    if prox and prox.get('d') and (not prox_antes or prox_antes.get('d') != prox['d']):
        nid = 'f:%s:%s' % (lid, prox['d'])
        if nid not in ya:
            out.append({'id': nid, 't': t, 'que': 'fecha', 'd': prox['d'], 'j': prox.get('j')})
    return out


def subir_flyer(lid, fl):
    """🖼️ El afiche, re-alojado en R2 como `ligas/<liga>/<mensaje>.webp` y achicado a `ANCHO_FLYER`: `(url, w, h)` o
    `None`. Igual que las imágenes del kit (`kit.subir()`): el link de Discord trae `?ex=` y vence a las horas.

    ⚠️ Uno por afiche nuevo, nunca se pisa (el nombre es el del mensaje): una página vieja en caché sigue mostrando el
    suyo. Los viejos quedan en R2 —unos 60 KB cada uno, un par por semana—."""
    import requests
    from PIL import Image
    try:
        r = requests.get(fl['src'], timeout=30)
        if r.status_code != 200 or len(r.content) > 15 * 1024 * 1024:
            print('      ⚠️ el flyer de %s no se pudo bajar (%s)' % (lid, r.status_code))
            return None
        im = Image.open(io.BytesIO(r.content))
        im.load()
        if im.mode in ('RGBA', 'LA', 'P'):
            im = im.convert('RGBA')
            fondo = Image.new('RGB', im.size, (3, 3, 4))
            fondo.paste(im, mask=im.split()[-1])
            im = fondo
        else:
            im = im.convert('RGB')
        if im.width > ANCHO_FLYER:
            im = im.resize((ANCHO_FLYER, round(im.height * ANCHO_FLYER / im.width)), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, 'WEBP', quality=CALIDAD_FLYER, method=4)
        import subir_cartas as SC
        clave_r2 = 'ligas/%s/%s.webp' % (lid, fl['id'])
        rr = SC.sesion().put('%s/objects/%s' % (SC.API, clave_r2), data=buf.getvalue(),
                             headers={'Content-Type': 'image/webp'}, timeout=60)
        if SC._ok(rr, clave_r2) is None:
            return None
        return '%s/%s' % (SC.PUBLICA, clave_r2), im.width, im.height
    except Exception as e:                               # noqa: BLE001
        print('      ⚠️ el flyer de %s: %s' % (lid, str(e)[:120]))
        return None


MESES = ('enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre',
         'noviembre', 'diciembre')
DIAS_SEM = ('lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo')
#: sobre el texto en minúsculas y sin tildes (`_bajo()`): «18 de octubre», «este domingo», «hoy»
_FECHA = re.compile(r'\b(\d{1,2})\s+de\s+(%s)\b' % '|'.join(MESES))
_DIA_SEM = re.compile(r'\b(?:este|el|proximo|nos vemos el|los esperamos el)\s+(%s)\b(?!\s+pasado)' % '|'.join(DIAS_SEM))
_HOY = re.compile(r'\bhoy\b')
#: «hoy» sólo cuenta si el anuncio habla de la fecha («HOY la sede de la jornada…»): «hoy puedo después de las 6» es
#: alguien diciendo cuándo puede
_DE_FECHA = re.compile(r'\b(jornada|fecha|batallas?|sede|cede)\b')
#: lo que viene antes de una fecha que NO es la fecha: «tienen plazo HASTA el 24», «la jornada TERMINA el jueves»
_NO_ES = re.compile(r'(plazo|hasta|termina|terminan|cierra|cierran|vence|vencen|limite)\W+(?:\S+\W+){0,3}$')
_MARCA = re.compile(r'<t:(\d{9,11})(?::[a-zA-Z])?>')


def _bajo(t):
    """Para buscar fechas: sin emojis propios, sin tildes y en minúsculas."""
    return _plano(EMOJI.sub(' ', str(t or ''))).lower()


def _zona(cc):
    from zoneinfo import ZoneInfo
    import cuando as C
    try:
        return ZoneInfo(C.ZONA_BANDERA.get(str(cc or '').upper()) or 'America/New_York')
    except Exception:                                    # noqa: BLE001
        return dt.timezone(dt.timedelta(hours=-4))


def _instante(s):
    try:
        t = dt.datetime.fromisoformat(str(s).replace('Z', '+00:00'))
    except ValueError:
        return None
    return t if t.tzinfo else t.replace(tzinfo=dt.timezone.utc)


def _hora_bandera(texto, d):
    """«22:00 🇨🇱» (o «22 HS CHILE») en el mismo anuncio que la fecha `d`: el instante en ISO UTC, o `''`. Sin bandera
    ni país escrito no hay hora: «a las 21» no dice de dónde (la regla de `cuando.py`)."""
    import cuando as C
    from zoneinfo import ZoneInfo
    t = EMOJI.sub(' ', str(texto or ''))
    hm = C._hora_de(t)
    b = C._BANDERA.search(t)
    cc = (chr(ord(b.group(1)) - 0x1F1E6 + 65) + chr(ord(b.group(2)) - 0x1F1E6 + 65)) if b else C._pais_escrito(t)
    zona = C.ZONA_BANDERA.get(cc or '')
    if not hm or not zona:
        return ''
    loc = dt.datetime(d.year, d.month, d.day, hm[0], hm[1], tzinfo=ZoneInfo(zona))
    return loc.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def proxima_de(L, msgs, ahora=None):
    """🗓️ La próxima fecha que ANUNCIÓ la liga, o `None`: `{d: 'AAAA-MM-DD', t: ISO UTC o '', j, id}`.

    Del anuncio más nuevo que dice una fecha: la marca de Discord `<t:…>` (el instante exacto), «18 de octubre», «este
    domingo» o «HOY» con la jornada. `d` es el día en el país de la liga (`cc`); `t`, el instante, SÓLO con la marca o
    con una hora con bandera (`_hora_bandera()`): el día solo no alcanza para una cuenta atrás al segundo.

    ⚠️ Si la más nueva que dice una fecha ya pasó, no hay próxima: una más vieja que todavía no llegó sería una fecha
    que se movió. Y «plazo hasta el 24» no es una fecha (`_NO_ES`)."""
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    z = _zona(L.get('cc'))
    hoy = ahora.astimezone(z).date()
    for m in reversed(msgs):
        texto = m.get('content') or ''
        pub = _instante(m.get('t'))
        if not texto.strip() or pub is None or not _de_la_liga(L, texto) or ahora - pub > dt.timedelta(days=45):
            continue
        loc = pub.astimezone(z)
        b = _bajo(texto)
        d, t_iso = None, ''
        mm = _MARCA.search(texto)
        if mm:
            ins = dt.datetime.fromtimestamp(int(mm.group(1)), dt.timezone.utc)
            d, t_iso = ins.astimezone(z).date(), ins.strftime('%Y-%m-%dT%H:%M:%SZ')
        if d is None:
            for f in _FECHA.finditer(b):
                if _NO_ES.search(b[max(0, f.start() - 40):f.start()]):
                    continue
                mes, dia = MESES.index(f.group(2)) + 1, int(f.group(1))
                try:
                    c = dt.date(loc.year, mes, dia)
                    # «3 de enero» escrito en diciembre es del año que viene
                    if c < loc.date() - dt.timedelta(days=60):
                        c = dt.date(loc.year + 1, mes, dia)
                except ValueError:
                    continue
                d = c
                break
        if d is None:
            s = _DIA_SEM.search(b)
            if s and not _NO_ES.search(b[max(0, s.start() - 40):s.start()]):
                d = loc.date() + dt.timedelta(days=(DIAS_SEM.index(s.group(1)) - loc.weekday()) % 7)
        if d is None:
            h = _HOY.search(b)
            if h and _DE_FECHA.search(b) and not _NO_ES.search(b[max(0, h.start() - 40):h.start()]):
                d = loc.date()
        if d is None:
            continue
        if d < hoy:
            return None
        js = JORNADA.search(_plano(texto))
        return {'d': d.isoformat(), 't': t_iso or _hora_bandera(texto, d), 'j': int(js.group(1) or js.group(2)) if js else None,
                'id': m['id']}
    return None


# ── Discord ───────────────────────────────────────────────────────────────
def _mensajes(s, canal, paginas, limite=100):
    """Los mensajes de un canal, del más viejo al más nuevo: `[{id, t, content, adj}]`. Sólo lo que hace falta: de los
    adjuntos, las imágenes (`adj`: `[{u, w, h, ct}]`, el link de Discord vence y no se guarda)."""
    out, antes = [], None
    for _ in range(paginas):
        url = 'https://discord.com/api/v10/channels/%s/messages?limit=%d%s' % (canal, limite, '&before=' + antes if antes else '')
        r = s.get(url, timeout=30)
        if r.status_code == 429:
            time.sleep(float((r.json() or {}).get('retry_after') or 2) + 0.5)
            r = s.get(url, timeout=30)
        if r.status_code != 200:
            break
        ms = r.json()
        if not ms:
            break
        for m in ms:
            adj = [{'u': a.get('url') or '', 'w': a.get('width') or 0, 'h': a.get('height') or 0,
                    'ct': a.get('content_type') or ''}
                   for a in m.get('attachments') or [] if str(a.get('content_type') or '').startswith('image/')]
            au = m.get('author') or {}
            # 🧑‍⚖️ quién lo escribió: para el staff de la liga (`staff_de()`). El mensaje no se guarda
            out.append({'id': str(m['id']), 't': str(m.get('timestamp') or '')[:19] + 'Z', 'content': m.get('content') or '',
                        'adj': adj, 'au': str(au.get('id') or ''), 'aun': au.get('global_name') or au.get('username') or '',
                        'bot': bool(au.get('bot'))})
        antes = str(ms[-1]['id'])
        if len(ms) < limite:
            break
        time.sleep(0.3)
    return sorted(out, key=lambda m: int(m['id']))


def leer(ruta=None):
    try:
        with io.open(ruta or SALIDA, encoding='utf-8') as f:
            return json.load(f) or {}
    except (OSError, ValueError):
        return {}


def _flyer_nuevo(lid, fl, viejo_fl, aplicar):
    """El flyer que queda guardado: el de antes si es el mismo afiche (ya está en R2), el nuevo re-alojado (con
    `--aplicar`), o el de antes si el nuevo no se pudo subir. Sin copia en R2 no se guarda: el link de Discord vence."""
    viejo_fl = viejo_fl or {}
    if not fl:
        return viejo_fl or None
    if fl['id'] == viejo_fl.get('id') and viejo_fl.get('url'):
        return viejo_fl
    if not aplicar:
        print('      🖼️ flyer nuevo de %s (%s): se sube con --aplicar' % (lid, fl.get('tit') or fl['id']))
        return viejo_fl or None
    r = subir_flyer(lid, fl)
    if not r:
        return viejo_fl or None
    print('      🖼️ flyer nuevo de %s, en R2: %s' % (lid, r[0]))
    return {'id': fl['id'], 't': fl['t'], 'tit': fl.get('tit') or '', 'url': r[0], 'w': r[1], 'h': r[2]}


def correr(aplicar=False):
    import escuchar as E
    s = E.sesion()
    viejo = leer().get('ligas') or {}
    por_canal, por_an = {}, {}
    out = {}
    # 🎛️ las de un servidor con el beneficio `ligas` apagado en el Dashboard no se leen ni se muestran (`bot/tiers.py`)
    try:
        import tiers as _TI
        sin_ligas = _TI.sin('ligas')
    except Exception:                                    # noqa: BLE001
        sin_ligas = set()
    for lid, L in LIGAS.items():
        if L['sv'] in sin_ligas:
            continue
        guardadas = {b[0]: b for b in (viejo.get(lid) or {}).get('batallas') or []}
        if L['ver'] not in por_canal:
            # la primera vez con el PTB (17/10/2026) se lee la temporada entera, como la primera vez de todas: sin eso
            # las jornadas viejas no tendrían MVP
            primera = not guardadas or 'ptb' not in (viejo.get(lid) or {})
            por_canal[L['ver']] = _mensajes(s, L['ver'], PAGINAS_PRIMERA if primera else PAGINAS)
            time.sleep(0.3)
        v = viejo.get(lid) or {}
        antes = dict(guardadas) if lid in viejo else None
        ptb = dict(v.get('ptb') or {})
        nuevas = leer_liga(lid, por_canal[L['ver']], ptb)
        if L.get('reemplaza') and nuevas:
            # 🔱 la temporada más nueva entera, sin lo guardado de la anterior (ver `_f()`)
            guardadas = {}
        for b in nuevas:
            # la que se vuelve a leer reemplaza a la guardada: pudo cerrarse después
            guardadas[b[0]] = b
        bats = [guardadas[k] for k in sorted(guardadas, key=_orden)]
        js = [b[2] for b in bats if b[2]]
        # 📢 el canal de anuncios: el flyer y la próxima fecha (un pedido por canal; Snake Rap comparte el suyo)
        an = L.get('an')
        if an and an not in por_an:
            por_an[an] = _mensajes(s, an, 1, limite=ANUNCIOS_LEER)
            time.sleep(0.3)
        ms_an = por_an.get(an) or []
        flyer = _flyer_nuevo(lid, flyer_de(L, ms_an), v.get('flyer'), aplicar)
        # sin el canal (Discord no contestó) queda la de antes; `para_web()` no muestra una que ya pasó
        prox = proxima_de(L, ms_an) if ms_an else v.get('prox')
        out[lid] = {'n': L['n'], 'sv': L['sv'], 'jornada': max(js) if js else None,
                    'batallas': bats, 'tabla': tabla(bats)}
        if flyer:
            out[lid]['flyer'] = flyer
        if prox:
            out[lid]['prox'] = prox
        # 📊 el PTB de las batallas que lo dijeron, sólo de las que siguen guardadas
        ids = {b[0] for b in bats}
        out[lid]['ptb'] = {k: x for k, x in ptb.items() if k in ids}
        # 🖼️ la galería: los afiches de la temporada (desde 30 días antes de su primera batalla), el último incluido
        desde = ''
        if bats:
            t0 = _instante(bats[0][1])
            desde = (t0 - dt.timedelta(days=30)).strftime('%Y-%m-%dT%H:%M:%SZ') if t0 else ''
        viejos = list(v.get('flyers') or []) + ([flyer] if flyer and flyer.get('url') else [])
        fls = _flyers_nuevos(lid, flyers_de(L, ms_an, desde) if ms_an else [], viejos, aplicar)
        if fls:
            out[lid]['flyers'] = fls
        # 🧑‍⚖️ quién la lleva: lo que se leyó ahora, y si Discord no contestó, lo de antes
        stf = staff_de(L, por_canal.get(L['ver']) or [], ms_an, v.get('staff')) \
            if (por_canal.get(L['ver']) or ms_an) else (v.get('staff') or [])
        if stf:
            out[lid]['staff'] = stf
        # 🔔 lo nuevo, para quien la sigue (`novedades()`)
        nov = novedades(lid, antes, bats, v.get('prox'), prox, v.get('nov'))
        if nov:
            out[lid]['nov'] = nov
        con = sum(1 for b in bats if b[5])
        print('   %-26s %3d batalla(s), %3d con resultado%s%s' % (
            L['n'], len(bats), con, (' · jornada %d' % max(js)) if js else '',
            (' · próxima: %s%s' % (prox['d'], ' ' + prox['t'][11:16] + ' UTC' if prox.get('t') else '')) if prox else ''))
    d = {'_leeme': 'Las ligas de los servidores: cada batalla y su resultado, y la tabla que sale de eso. Lo arma '
                   'bot/ligas.py en cada corrida; las reglas viven ahí. Sin los mensajes: el repo es público. '
                   '`batallas`: [id del mensaje, instante, jornada, a, b, ganador (vacío: pendiente), directa|replica, '
                   'extras]. Las batallas con resultado cuentan como duelos (Ranking Duelos y Win%; el Score no). '
                   '`flyer`: el último afiche de su canal de anuncios, re-alojado en R2 (`url`); `prox`: la próxima '
                   'fecha que anunció (`d` el día, `t` el instante si lo dijo). Desde el 17/10/2026: `ptb` {id de la '
                   'batalla: [PTB de a, de b]}, `flyers` (la galería, en R2), `staff` [[discord_id, nombre, mensajes en '
                   'anuncios, en veredictos, último]] y `nov` (lo nuevo de las últimas horas, para «Seguir la liga»).',
         't': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'ligas': out}
    if aplicar:
        with io.open(SALIDA, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(d, f, ensure_ascii=False, indent=1)
            f.write('\n')
    return d


def por_servidor(ruta=None):
    """`{sv: {clave del nombre: persona}}`: el nombre que EN ESE SERVIDOR es otra persona que la de la Lista
    (`datos/akas_a_mano.json`, `por_servidor`), igual que `llaves_a_entrada.otro_en_servidor()` en las llaves.

    🔑 ForceGP, 14/10/2026, mirando FMH Carimex: *«le pico donde dice FORCE y no me lleva a nada»* y *«es un Agustín
    chileno, no el arg»*. Las ligas resolvían cada nombre con el AKA de TODA la Liga, así que en Urban «Agustín» caía en
    Agus 🇦🇷 —el AKA global— y no en AGUSTÍN51K 🇨🇱, que es el de ese servidor. `{}` si no hay archivo."""
    try:
        with io.open(ruta or os.path.join(BASE, 'datos', 'akas_a_mano.json'), encoding='utf-8') as f:
            ps = (json.load(f) or {}).get('por_servidor') or {}
    except (OSError, ValueError):
        return {}
    return {sv: {clave(a): p for a, p in (m or {}).items() if clave(a)} for sv, m in ps.items()}


def _de_servidor(sv, r, ps):
    """nombre -> la persona: primero la de ESE servidor (`por_servidor()`), después la de toda la Liga (`r`)."""
    m = ps.get(sv) or {}
    return lambda x: m.get(clave(x)) or r(x)


def vota(bats, prox=None):
    """🗳️ Hasta cuándo se vota «¿quién gana la liga?»: `CIERRA_DIAS` después de su última batalla —o de su próxima fecha
    anunciada, si es más tarde—, en ISO UTC. Una liga que lleva tres semanas sin batallas y sin fecha terminó (o se
    paró: para la encuesta es lo mismo). `''` sin batallas."""
    ts = [b[1] for b in bats or [] if b[1]]
    if prox and prox.get('d'):
        ts.append(prox['d'] + 'T23:59:59Z')
    if not ts:
        return ''
    t = _instante(max(ts))
    return (t + dt.timedelta(days=CIERRA_DIAS)).strftime('%Y-%m-%dT%H:%M:%SZ') if t else ''


def _fechas(bats, rc, z, tope=FECHAS_WEB, ptb=None, vids=None):
    """Las batallas por FECHA, la más nueva primero: `[{j, d, s, t, b: [[a, b, ganador o '', directa|replica|'', PTB a,
    PTB b, mensaje, video, invitados]]}]` (`invitados`: `'a'`, `'b'` o `'ab'`, los 🎮 ExtraPlayers).

    La fecha es la jornada si el veredicto la dice; si no (Albiceleste, Carimex, Snake Rap no la escriben), la SEMANA en
    que se cerró (`s`, su lunes), en la hora de la liga: Dlx, 17/10/2026, «las fechas, mejor… sin días sueltos». No se
    inventa una jornada que nadie escribió. Las que no tienen cierre van con el ganador vacío: «sin cierre todavía».
    `ptb`: `{id: [a, b]}`; `vids`: `{par de claves: video}` (el video de esa batalla, si un canal de los socios la subió)."""
    grupos, por = [], {}
    ptb, vids = ptb or {}, vids or {}
    for b in bats:
        ins = _instante(b[1])
        loc = ins.astimezone(z).date() if ins else None
        dia = loc.isoformat() if loc else ''
        lunes = (loc - dt.timedelta(days=loc.weekday())).isoformat() if loc else ''
        k = ('j', b[2]) if b[2] else ('s', lunes)
        g = por.get(k)
        if g is None:
            g = por[k] = {'j': b[2], 'd': dia, 's': '' if b[2] else lunes, 'd0': dia, 't': b[1], 'b': []}
            grupos.append(g)
        g['d'], g['t'] = max(g['d'], dia), max(g['t'], b[1])
        g['d0'] = min(g['d0'], dia) if g['d0'] and dia else (g['d0'] or dia)
        pa, pb = (ptb.get(b[0]) or ['', ''])[:2]
        par = frozenset((clave(b[3]), clave(b[4])))
        g['b'].append([rc(b[3]), rc(b[4]), rc(b[5]) if b[5] else '', b[6] if b[5] else '', pa, pb,
                       str(b[0]).split('-')[0], vids.get(par, ''), b[7] if len(b) > 7 else ''])
    for g in grupos:
        # una semana con un solo día de batallas es ese día (y entonces no hace falta decir «la semana»)
        if g['s'] and g['d0'] == g['d']:
            g['s'] = ''
        g.pop('d0', None)
    grupos.sort(key=lambda g: g['t'], reverse=True)
    return grupos[:tope]


def _videos(L, bats, vj):
    """🎬 Los videos de una liga, de los canales de los socios (`datos/videos.json`, `bot/videos.py`): los del servidor
    de la liga cuyo título la nombra (`vre`) o nombra a los dos de una de sus batallas. `([[video, título]], {par de
    claves: video})`."""
    vs = (vj or {}).get('videos') or {}
    pares = {frozenset((clave(b[3]), clave(b[4]))) for b in bats}
    lista, por_par = [], {}
    for vid, x in vs.items():
        if not isinstance(x, list) or len(x) < 2 or x[1] != L.get('sv'):
            continue
        tit = str(x[0] or '')
        lados_ = [clave(p) for p in re.split(r'\s*(?:🆚|\bvs\.?\b|\bv\.s\.?)\s*', re.sub(r'[|│].*$', '', tit), flags=re.I)[:2]]
        par = frozenset(lados_) if len(lados_) == 2 and all(lados_) else None
        es_batalla = par in pares if par else False
        if es_batalla or (L.get('vre') and re.search(L['vre'], _plano(tit), re.I)):
            lista.append([vid, tit])
            if es_batalla:
                por_par.setdefault(par, vid)
    return lista[:30], por_par


_INFO = {}


def info_de(lid):
    """📖 «Cómo funciona» y el historial de una liga (`datos/ligas_info.json`, lo que publicó cada servidor), o `None`."""
    if 'd' not in _INFO:
        try:
            with io.open(os.path.join(BASE, 'datos', 'ligas_info.json'), encoding='utf-8') as f:
                _INFO['d'] = json.load(f) or {}
        except (OSError, ValueError):
            _INFO['d'] = {}
    return _INFO['d'].get(lid)


# ── 🏅 EL RECONOCIMIENTO DE LAS LIGAS (Dlx, 16/10/2026) ───────────────────────────────────────────────────────────────
# *«asegúrate de incluir todo lo que podamos exprimir de ligas… reconocimiento a estos participantes»*, y de las cuatro
# formas, las cuatro: las insignias (`bot/insignias.py`), las publicaciones solas (`bot/muro.py`), lo mejor de las ligas
# (la página) y el SALÓN DE CAMPEONES. Lo que sale de las batallas se recalcula en cada corrida —no hay estado que se
# pierda—; lo único que no se puede calcular es quién GANÓ una liga, y eso lo dice Dlx en ✅ Decidir.
#: 5 ganadas sin perder ninguna: la insignia «Invicto» y su publicación
INVICTO = 5
#: «tomó la punta» recién cuando el primero ya jugó tantas: en la primera fecha la punta cambia en cada batalla
PUNTA_DESDE = 3
#: la sección de `datos/decisiones.json` con cada liga terminada, y la de las que Dlx dijo que siguen
FIN, SIGUE = 'ligas_fin', 'ligas_sigue'


def _desde():
    """⚠️ LO DE ANTES DE LA TEMPORADA NO SE RECONOCE: el arranque de la T1 (`comun/temporada.py`, el 22/09), en ISO
    para comparar. FZ League jugó su temporada 16 del 1 al 10 de septiembre, antes de la T1 y antes de que FRZ entrara a
    la Liga: su tabla se ve en Ligas, pero no da insignias, ni publicaciones, ni entra al Salón. `''` si no se sabe."""
    try:
        from comun.temporada import INICIO
        return str(INICIO or '')[:19]
    except Exception:                                    # noqa: BLE001
        return ''


def ultima(bats):
    """El día (AAAA-MM-DD, UTC) de la última batalla con resultado: identifica CADA VEZ que una liga para. Si después
    juega otra temporada y vuelve a parar, es otro día y se vuelve a preguntar."""
    con = [b[1] for b in bats or () if len(b) > 5 and b[5] and b[1]]
    return max(con)[:10] if con else ''


def _decis(decis=None):
    if decis is not None:
        return decis
    try:
        with io.open(os.path.join(BASE, 'datos', 'decisiones.json'), encoding='utf-8') as f:
            return json.load(f) or {}
    except (OSError, ValueError):
        return {}


def fin_de(decis, lid, ult):
    """Lo que Dlx decidió de esa liga cuando paró ese día (`{campeon, podio, …}`), o `None`."""
    for x in (decis or {}).get(FIN) or []:
        if x.get('liga') == lid and x.get('ult') == ult:
            return x
    return None


def sigue_de(decis, lid, ult):
    """¿Dlx dijo que esa liga, parada desde ese día, todavía no terminó?"""
    return ((decis or {}).get(SIGUE) or {}).get(lid, {}).get('ult') == ult


def podio(nombres, campeon):
    """El podio de una liga terminada: el campeón y los dos primeros de la tabla que no son él. Si el campeón salió de
    una final (una liga con playoffs), el 2º y el 3º son los que siguen en la tabla."""
    return [campeon] + [n for n in nombres if clave(n) != clave(campeon)][:2]


def terminadas(web, decis=None, ahora=None, desde=None):
    """Las ligas que PARARON y de las que nadie dijo todavía si terminaron: `[(liga de para_web(), día)]`.

    «Paró» es lo mismo que cierra la encuesta (`vota()`: `CIERRA_DIAS` sin batallas ni una fecha anunciada). No se da
    por terminada sola: una liga puede volver después de un parón, y el campeón puede salir de una final que no es la
    tabla. Por eso es una pregunta (`decidir.ligas_terminadas()`)."""
    decis = _decis(decis)
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    desde = _desde() if desde is None else desde
    out = []
    for L in (web or {}).get('ligas') or []:
        v = _instante(L.get('vota')) if L.get('vota') else None
        if not v or v > ahora or L.get('prox'):
            continue
        ult = str(L.get('ult_t') or '')[:10]
        # una liga que paró antes de que arrancara la temporada no es de esta temporada (`_desde()`)
        if desde and str(L.get('ult_t') or '')[:19] < desde:
            continue
        if ult and not fin_de(decis, L['id'], ult) and not sigue_de(decis, L['id'], ult):
            out.append((L, ult))
    return out


def salon(decis=None, claves=None):
    """🏆 EL SALÓN DE CAMPEONES, para la página: `[{id, n, sv, temp, ult, c, p, ks}]`, el más nuevo primero. `p`: el
    podio entero (el campeón primero); `ks`: el perfil de cada nombre que lo tiene."""
    claves = {clave(k): v for k, v in (claves or {}).items() if clave(k)}
    out = []
    for x in (_decis(decis).get(FIN) or []):
        if not x.get('campeon'):
            continue
        p = x.get('podio') or [x['campeon']]
        out.append({'id': x.get('liga'), 'n': x.get('n') or x.get('liga'), 'sv': x.get('sv') or '',
                    'temp': x.get('temporada') or '', 'ult': x.get('ult') or '', 'c': x['campeon'], 'p': p,
                    'ks': {n: claves[clave(n)] for n in p if claves.get(clave(n))}})
    out.sort(key=lambda x: x['ult'], reverse=True)
    return out


def _resolvedor_de(resolver=None):
    if resolver is not None:
        return resolver
    try:
        import motor as _MO
        return _MO._resolvedor()[0]
    except Exception:                                    # noqa: BLE001
        return lambda x: x


def hitos(d=None, resolver=None, ps=None, desde=None):
    """📣 Lo que el muro publica solo de cada liga, rehaciendo sus batallas EN ORDEN: `[{tipo, que, t, quien, liga, ln,
    sv, …}]`.

    · `invicto`: la batalla en que alguien llega a `INVICTO` ganadas sin perder ninguna (una vez por liga).
    · `punta`: quién queda primero al cerrar cada día de batallas, solo —sin empate en puntos— y con `PUNTA_DESDE`
      jugadas; se publica cuando cambia. En la primera fecha la punta cambia en cada batalla: por eso las dos reglas.
    Los nombres, los de la tabla (`para_web()`): el del padrón, y el de ESE servidor si ahí es otra persona.
    ⚠️ La tabla se rehace con TODAS las batallas —la punta tiene que ser la de la tabla que se ve—, pero sólo sale lo
    que pasó desde el arranque de la temporada (`_desde()`)."""
    d = d if d is not None else leer()
    desde = _desde() if desde is None else desde
    r0 = _resolvedor_de(resolver)
    ps = por_servidor() if ps is None else ps
    out = []
    for lid, x in (d.get('ligas') or {}).items():
        bats = sorted((b for b in x.get('batallas') or [] if len(b) > 6 and b[5] and b[6] in PUNTOS and b[1]),
                      key=lambda b: b[1])
        if not bats:
            continue
        r = _de_servidor(x.get('sv'), r0, ps)
        canon = {}
        for f in tabla(bats, r):
            canon.setdefault(clave(f[0]), f[0])
        rc = lambda n: canon.get(clave(r(n)), r(n))  # noqa: E731
        base = {'tipo': 'ligahito', 'liga': lid, 'ln': x.get('n') or (LIGAS.get(lid) or {}).get('n') or lid,
                'sv': x.get('sv') or (LIGAS.get(lid) or {}).get('sv') or ''}
        st, invictos, dias = {}, set(), []
        for b in bats:
            a, bb, g = rc(b[3]), rc(b[4]), rc(b[5])
            pg, pp = PUNTOS[b[6]]
            for lado, nom in (('a', a), ('b', bb)):
                if lado in (b[7] if len(b) > 7 else ''):
                    continue
                s = st.setdefault(clave(nom), [nom, 0, 0, 0, 0])
                s[1] += 1
                if clave(nom) == clave(g):
                    s[2] += 1
                    s[3] += pg
                else:
                    s[3] += pp
                    s[4] += 1
                if clave(nom) == clave(g) and s[2] == INVICTO and not s[4] and clave(nom) not in invictos:
                    invictos.add(clave(nom))
                    out.append(dict(base, que='invicto', t=b[1], quien=[nom], pg=INVICTO))
            orden = sorted(st.values(), key=lambda s: (-s[3], -s[2], s[1]))
            solo = orden[0] if orden and (len(orden) == 1 or orden[0][3] > orden[1][3]) and orden[0][1] >= PUNTA_DESDE else None
            dia = b[1][:10]
            if dias and dias[-1][0] == dia:
                dias[-1] = (dia, solo and (clave(solo[0]), solo[0], solo[3]), b[1])
            else:
                dias.append((dia, solo and (clave(solo[0]), solo[0], solo[3]), b[1]))
        antes = None
        for _dia, lider, t in dias:
            if lider and lider[0] != antes:
                out.append(dict(base, que='punta', t=t, quien=[lider[1]], pts=lider[2]))
            if lider:
                antes = lider[0]
    return [h for h in out if not desde or str(h.get('t') or '')[:19] >= desde]


def tablas(d=None, resolver=None, ps=None, desde=''):
    """`{liga: [nombre, …]}`: la tabla ENTERA de cada liga (`para_web()` la corta en 30), con los nombres como ahí.
    Para el podio de la que terminó (`decidir.aplicar()`) y para la insignia «De liga» (`bot/insignias.py`).
    `desde`: sólo las batallas desde ese instante (ISO): la insignia es de lo jugado en la temporada."""
    d = d if d is not None else leer()
    r0 = _resolvedor_de(resolver)
    ps = por_servidor() if ps is None else ps
    return {lid: [f[0] for f in tabla([b for b in x.get('batallas') or [] if not desde or str(b[1] or '')[:19] >= desde],
                                     _de_servidor(x.get('sv'), r0, ps))]
            for lid, x in (d.get('ligas') or {}).items()}


def campeones_hitos(decis=None):
    """📣 Y el campeón de cada liga terminada, cuando Dlx lo confirmó: la publicación del Salón."""
    out = []
    for x in (_decis(decis).get(FIN) or []):
        if x.get('campeon') and x.get('t'):
            out.append({'tipo': 'ligahito', 'que': 'campeon', 't': x['t'], 'quien': [x['campeon']],
                        'liga': x.get('liga'), 'ln': x.get('n') or x.get('liga'), 'sv': x.get('sv') or '',
                        'podio': x.get('podio') or [x['campeon']]})
    return out


def para_web(d=None, claves=None, ps=None, ahora=None, resolver=None, decis=None):
    """Lo de la sección Ligas de la web (`#/ligas` y el perfil de cada una, `#/ligas/<id>`; hasta el 16/10/2026 una
    pestaña del Ranking): `{t, ligas: [{id, n, sv, j, bat, pend, tabla, ult, fechas, ks, link, flyer, prox,
    vota}]}`, o `None` sin nada.

    `tabla`: `[[nombre, jugadas, ganadas, puntos]]` (hasta 30); `ult`: las seis últimas con resultado,
    `[a, b, ganador, directa|replica, jornada]`; `fechas`: todas las batallas por jornada (`_fechas()`). Los nombres van
    por el padrón —y por el AKA de ESE servidor—, así la página los lleva al perfil. `ks`: `{nombre: clave del perfil}`
    de los que tienen perfil (`claves`: nombre de la Lista → clave), también del staff que no está en la tabla del
    lobby: sin eso la página no los encontraba (ForceGP).
    🏟️ Y desde el 14/10/2026: `flyer` `{u, w, h, t, tit, link}` (sólo el que está en R2), `prox` `{d, t, j, link}` (sólo
    si no pasó) y `vota` (hasta cuándo se vota quién gana; `''` si no hay tabla para votar).
    🏆 Y desde el 16/10/2026: `fin` `{c, p}` si Dlx dijo quién la ganó cuando paró (el campeón y el podio), y arriba de
    todo `salon`, el Salón de campeones (`salon()`). `decis`: `datos/decisiones.json`, para el self-check.
    ⚠️ Una liga sin batallas no va: ninguna sección se dibuja vacía."""
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    d = d if d is not None else leer()
    ls = d.get('ligas') or {}
    if not ls:
        return None
    r0 = resolver
    if r0 is None:
        try:
            import motor as _MO
            r0, _n = _MO._resolvedor()
        except Exception:                                # noqa: BLE001
            r0 = lambda x: x                             # noqa: E731
    ps = por_servidor() if ps is None else ps
    claves = {clave(k): v for k, v in (claves or {}).items() if clave(k)}
    try:
        with io.open(os.path.join(BASE, 'datos', 'servidores.json'), encoding='utf-8') as f:
            svs = json.load(f).get('servidores') or {}
    except (OSError, ValueError):
        svs = {}
    out = []
    decis = _decis(decis)
    try:
        with io.open(os.path.join(BASE, 'datos', 'videos.json'), encoding='utf-8') as f:
            vj = json.load(f) or {}
    except (OSError, ValueError):
        vj = {}
    try:
        with io.open(os.path.join(BASE, 'datos', 'padron.json'), encoding='utf-8') as f:
            raw_de_id = {str(p['discord_id']): p['raw'] for p in json.load(f) or [] if p.get('discord_id') and p.get('raw')}
    except (OSError, ValueError):
        raw_de_id = {}
    nov_web = []
    for lid, x in ls.items():
        bats = x.get('batallas') or []
        con = [b for b in bats if b[5]]
        if not con:
            continue
        L = LIGAS.get(lid) or {}
        r = _de_servidor(x.get('sv'), r0, ps)
        g = (svs.get(x.get('sv')) or {}).get('guild_id')
        tb = tabla(bats, r)[:30]
        # 🔤 y en los últimos resultados, el mismo nombre que la tabla (ForceGP, 14/10/2026: «está repetido»): quien no
        # está en la Lista se escribe «Aluvion», «Aluvión» y «ALUVIÓN» según el jurado; la tabla ya era una fila
        canon = {}
        for f in tb:
            canon.setdefault(clave(f[0]), f[0])
        rc = lambda x: canon.get(clave(r(x)), r(x)) if x else x  # noqa: E731
        ult = [[rc(b[3]), rc(b[4]), rc(b[5]), b[6], b[2]] for b in con[-6:][::-1]]
        z = _zona(L.get('cc'))
        vids, por_par = _videos(L, bats, vj)
        fechas = _fechas(bats, rc, z, ptb=x.get('ptb'), vids=por_par)
        nombres = {f[0] for f in tb} | {n for u in ult for n in u[:3] if n} | \
            {n for fe in fechas for y in fe['b'] for n in y[:3] if n}
        ks = {n: claves[clave(n)] for n in sorted(nombres) if claves.get(clave(n))}
        y = {'id': lid, 'n': x.get('n'), 'sv': x.get('sv'), 'j': x.get('jornada'), 'bat': len(con),
             'pend': len(bats) - len(con), 'ult_t': con[-1][1],
             'tabla': tb, 'ult': ult, 'fechas': fechas, 'ks': ks,
             'link': 'https://discord.com/channels/%s/%s' % (g, L.get('tabla')) if g and L.get('tabla') else ''}
        # 🖼️ el flyer, sólo si está en R2 (el de Discord vence) y con el link a su mensaje
        fl = x.get('flyer') or {}
        if fl.get('url'):
            y['flyer'] = {'u': fl['url'], 'w': fl.get('w') or 0, 'h': fl.get('h') or 0, 't': fl.get('t') or '',
                          'tit': fl.get('tit') or '',
                          'link': 'https://discord.com/channels/%s/%s/%s' % (g, L['an'], fl['id']) if g and L.get('an') else ''}
        # 🗓️ la próxima fecha, si todavía no pasó (en el día de la liga)
        pr = x.get('prox') or {}
        if pr.get('d') and pr['d'] >= ahora.astimezone(z).date().isoformat():
            y['prox'] = {'d': pr['d'], 't': pr.get('t') or '', 'j': pr.get('j'),
                         'link': 'https://discord.com/channels/%s/%s/%s' % (g, L['an'], pr['id'])
                         if g and L.get('an') and pr.get('id') else ''}
        # 🗳️ hasta cuándo se vota quién gana: hace falta una tabla de dos o más para elegir
        y['vota'] = vota(bats, pr if pr.get('d') else None) if len(tb) >= 2 else ''
        # 🏆 terminó y Dlx dijo quién la ganó (en esta parada: si después vuelve a jugar, es otra)
        fn = fin_de(decis, lid, ultima(bats))
        if fn:
            y['fin'] = {'c': fn['campeon'], 'p': fn.get('podio') or [fn['campeon']]}
        # 📜 el link al veredicto de cada batalla: el canal, y la página le suma el mensaje
        if g and L.get('ver'):
            y['vlink'] = 'https://discord.com/channels/%s/%s/' % (g, L['ver'])
        # 🖼️ la galería, sólo lo que está en R2
        fls = [{'u': f['url'], 'w': f.get('w') or 0, 'h': f.get('h') or 0, 't': f.get('t') or '', 'tit': f.get('tit') or '',
                'link': 'https://discord.com/channels/%s/%s/%s' % (g, L['an'], f.get('msg') or f['id'].split('-')[0])
                if g and L.get('an') else ''} for f in x.get('flyers') or [] if f.get('url')]
        if fls:
            y['flyers'] = fls
        # 🧑‍⚖️ el staff: el nombre de la Lista y su perfil si está; si no, el de Discord
        # ⚠️ quien JUEGA esta liga y no publica anuncios no es staff: comenta sus batallas en el canal de veredictos
        # (Guty en FMH Under, Forza en Carimex). Y con pocos mensajes, tampoco: hace falta haber organizado (2 anuncios)
        # o juzgado (3 veredictos)
        juegan = {clave(f[0]) for f in tabla(bats, r)}
        stf = []
        for did, nom, n_an, n_ver, _u in x.get('staff') or []:
            raw = raw_de_id.get(str(did)) or ''
            if n_an < 2 and n_ver < 3:
                continue
            if not n_an and (clave(r(raw)) in juegan if raw else clave(nom) in juegan):
                continue
            k = claves.get(clave(raw)) if raw else ''
            stf.append([limpio(raw) if raw else (limpio(nom) or nom), k or '', n_an, n_ver])
        if stf:
            y['staff'] = stf
        if vids:
            y['vids'] = vids
        inf = info_de(lid)
        if inf:
            y['info'] = inf
        # 🔔 lo nuevo, con su texto, para el vigía (`ligasSeguidas()` en bot/avisos.js)
        por_id = {b[0]: b for b in bats}
        for n in x.get('nov') or []:
            if n.get('que') == 'res':
                bs = [por_id[i] for i in n.get('ids') or [] if i in por_id and por_id[i][5]]
                if not bs:
                    continue
                frases = ['%s le ganó a %s' % (rc(b[5]), rc(b[4] if clave(b[5]) == clave(b[3]) else b[3])) for b in bs]
                tit = '⚔️ %s: %s' % (x.get('n'), frases[-1] if len(frases) == 1 else '%d resultados nuevos' % len(frases))
                cuerpo = (' · '.join(frases) if len(frases) > 1 else 'Mira cómo quedó la tabla.')[:180]
            else:
                tit = '📅 %s: %s, el %s' % (x.get('n'), ('jornada %s' % n['j']) if n.get('j') else 'nueva fecha',
                                           '%s/%s' % (n['d'][8:10], n['d'][5:7]))
                cuerpo = 'Ya está anunciada: mira los cruces y la tabla.'
            nov_web.append({'id': n['id'], 'liga': lid, 't': n['t'], 'titulo': tit, 'cuerpo': cuerpo,
                            'url': 'https://underlegends.pages.dev/freestyle-rap/ligas/' + lid})
        out.append(y)
    out.sort(key=lambda x: x['ult_t'], reverse=True)
    if not out:
        return None
    res = {'t': d.get('t'), 'ligas': out, 'nov': sorted(nov_web, key=lambda n: n['t'])}
    sl = salon(decis, claves)
    if sl:
        res['salon'] = sl
    return res


#: la clave de KV del detalle de cada liga (las fechas y el flyer entero), que la página pide al abrir Ligas (`/api/ligas`)
CLAVE_WEB = 'web:ligas'


def separar(web):
    """`(lo del lobby, el detalle)`: el lobby viaja en CADA visita y ya está al tope de lo que pesa (el self-check de
    `subir_web.py`: 45 KB comprimido), así que las fechas —todas las batallas— y el flyer entero van aparte, a
    `CLAVE_WEB`, y la página los pide al abrir Ligas (como el muro y las llaves viejas). En el lobby queda lo que el
    Inicio necesita: la tabla (para votar), `fl` (la imagen del flyer, para el escenario), `prox`, `vota` y `f0`, el
    resumen de la última fecha (`{j, t, n}`: su jornada, cuándo se cerró la última batalla y cuántas tienen veredicto).
    `ks` del lobby: sólo los nombres de la tabla y de `ult`; el detalle trae los de todas las fechas."""
    if not web:
        return None, None
    lobby, det = [], {}
    SOLO_DET = ('fechas', 'flyer', 'ks', 'flyers', 'staff', 'vids', 'info', 'vlink')
    for L in web.get('ligas') or []:
        y = {k: v for k, v in L.items() if k not in SOLO_DET}
        nombres = {f[0] for f in L.get('tabla') or []} | {n for u in L.get('ult') or [] for n in u[:3] if n}
        y['ks'] = {n: k for n, k in (L.get('ks') or {}).items() if n in nombres}
        if L.get('flyer'):
            y['fl'] = L['flyer']['u']
        f0 = (L.get('fechas') or [None])[0]
        if f0:
            y['f0'] = {'j': f0['j'], 't': f0['t'], 'n': sum(1 for b in f0['b'] if b[2])}
        lobby.append(y)
        det[L['id']] = {k: L[k] for k in SOLO_DET if L.get(k)}
    lob = {'t': web.get('t'), 'ligas': lobby}
    # 🏆 el Salón de campeones viaja en el lobby: es corto (una fila por liga terminada) y la portada lo muestra al abrir
    if web.get('salon'):
        lob['salon'] = web['salon']
    det_out = {'t': web.get('t'), 'ligas': det}
    # 🔔 lo nuevo para «Seguir la liga» no es de la página: `subir_web.py` lo saca de acá y lo sube aparte (`para_nov()`)
    if web.get('nov') is not None:
        det_out['_nov'] = web['nov']
    return lob, det_out


#: la clave de KV con lo nuevo de cada liga, para «Seguir la liga» (la lee el vigía: `ligasSeguidas()` en avisos.js)
CLAVE_NOV = 'ligas:nov'


def para_nov(web):
    """🔔 Lo que lee el vigía para avisarle a quien sigue cada liga: `{items: [{id, liga, t, titulo, cuerpo, url}]}`.
    Cambia sólo cuando entra algo nuevo: la escritura de KV es una por novedad, no una por corrida."""
    return {'items': (web or {}).get('nov') or []}


def para_kv(web):
    """🗳️ Lo que lee el Worker para validar un voto de «¿quién gana la liga?» (`validarVotoLiga()` en bot/avisos.js):
    `{lista: [{id, hasta, op}]}` con las mismas opciones que la página (la tabla de `para_web()`). Va también lo cerrado,
    así el Worker contesta «cerrada» y no «no existe». Sin Discord IDs: a diferencia de `encuestas`, nadie queda afuera
    de votar a nadie (un rapero puede votarse)."""
    lista = []
    for L in (web or {}).get('ligas') or []:
        if L.get('vota') and len(L.get('tabla') or []) >= 2:
            lista.append({'id': L['id'], 'hasta': L['vota'], 'op': [f[0] for f in L['tabla']]})
    return {'lista': lista}


def duelos(desde=None, ruta=None, ps=None):
    """Para `rankings.agregar()`: `[(instante, a, b, ganador)]` de todas las ligas, con resultado y desde `desde`. Con
    el nombre de ESE servidor (`por_servidor()`): el «FORCE» de Urban es ForceGP y cuenta en sus duelos."""
    out = []
    ps = por_servidor() if ps is None else ps
    # 🤝 las ligas de un servidor que no suma no cuentan como duelos (`bot/tiers.py`: «el Tier 2 no suma»; desde el
    # 20/10/2026, el beneficio `duelos` de cada servidor)
    try:
        import tiers as _TI
        bajos = _TI.sin('duelos')
    except Exception:                                    # noqa: BLE001
        bajos = set()
    for x in (leer(ruta).get('ligas') or {}).values():
        if x.get('sv') in bajos:
            continue
        sv_m = ps.get(x.get('sv')) or {}
        de = lambda n: sv_m.get(clave(n)) or n           # noqa: E731
        for _id, t, _j, a, b, gana, como, _ex in x.get('batallas') or []:
            if not gana or (desde and t < desde):
                continue
            try:
                ti = dt.datetime.fromisoformat(t.replace('Z', '+00:00'))
            except ValueError:
                continue
            out.append((ti, de(a), de(b), de(gana)))
    return out


def _self_check():
    print('\n══ LAS LIGAS ══\n')
    mal = 0

    def ok(c, q, extra=''):
        nonlocal mal
        mal += not c
        print('   %s %s%s' % ('✅' if c else '🔴', q, ('  ' + extra) if extra and not c else ''))

    def ms(*textos):
        return [{'id': str(1000 + i), 't': '2026-10-0%dT20:00:00Z' % (1 + i % 9), 'content': x} for i, x in enumerate(textos)]
    # FMH: «GANA DIRECTO» del host
    u = leer_liga('fmh-albiceleste', ms(
        '# ==== <:FMH_Albiceleste:1> JORNADA 3 - SALTA ====',
        '# <:FMH_Albiceleste:1> ZIGNOS 🇩🇴 <:VSAzul:2> BENJIXO 🇺🇾 <:FMH_Albiceleste:1>',
        '# BENJIXO 🇺🇾 (muy bueno)',
        '**ZIGNOS 🇩🇴 :  36.5 (109.5)**\nBENJIXO 🇺🇾 : 27 (81)\n**ZIGNOS 🇩🇴 GANA DIRECTO, POR 9.5 PTS! +3**'))
    ok(u and u[0][3:7] == ['ZIGNOS', 'BENJIXO', 'ZIGNOS', 'directa'] and u[0][2] == 3,
       'FMH: el «GANA DIRECTO» del host decide, no el voto de un jurado; y la jornada sale del separador', str(u))
    # FMH: el PTB TOTAL con +2 y +1 (réplica) y la negrita que NO es el ganador
    u = leer_liga('fmh-under', ms(
        '# <:FMH_UNDER:1> CINEXFILO 🇻🇪 VS MAKMA 🇻🇪 🎮 <:FMH_UNDER:1> - JORNADA 4',
        '# <:FMH_UNDER:1> ⚔️ RÉPLICA ⚔️ <:FMH_UNDER:1>',
        '# PTB TOTAL\n**CINEXFILO 🇻🇪: 117** +2\nMAKMA 🇻🇪: 121.5 +1'))
    ok(u and u[0][5:8] == ['CINEXFILO', 'replica', 'b'],
       'FMH: el +2 del PTB TOTAL gana aunque tenga menos PTB, y el 🎮 marca al ExtraPlayer', str(u))
    # FMH: réplica sin cierre claro → pendiente (no se adivina)
    u = leer_liga('fmh-carimex', ms(
        '# <:FMH_Carimex:1> AGUSTÍN🇨🇱🇵🇪 VS KASAAXT🇩🇴<:FMH_Carimex:1>',
        '# Kasaatx:29.5\nAgustín:27', '# <:FMH_Carimex:1> REPLICA<:FMH_Carimex:1>', '# AGUSTIN', '# KASAATX X LA MÍNIMA'))
    ok(u and u[0][5] == '', 'FMH: una réplica con votos sueltos y sin cierre queda pendiente', str(u))
    # FMH: PTB TOTAL X3 sin marcas y sin réplica, con diferencia de directa
    u = leer_liga('fmh-espana', ms(
        '# <:FMHESP:1> TROT<a:Bandera_espana:2> <:vs:3> DIEGO<a:Bandera_ECUADOR:4>🎮 <:FMHESP:1>',
        '# <:FMHESP:1> PTB TOTAL X3 <:FMHESP:1>\n**TROT<a:Bandera_espana:2>: 106.5**\nDIEGO<a:Bandera_ECUADOR:4>: 100.5'))
    ok(u and u[0][5:7] == ['TROT', 'directa'], 'FMH: PTB TOTAL ×3 sin réplica y 6 de diferencia es directa', str(u))
    # DDF Titans: GANADOR con nombre, y la réplica con la flecha y la bandera sola
    d1 = leer_liga('fms-titans', ms(
        '# <:FDSPeru:1>ᗷᗩTᗩᒪᒪᗩՏ ᗪᗴ ᒍOᖇᑎᗩᗪᗩ1<:FDSPeru:1>',
        '# <a:chile:1>𝙺𝚁𝚃 𝚅𝚂 𝙳𝙾𝙼𝙸𝙽𝙸𝙲𝙺<a:Per:2>', '# 👈 22.5 - 18.5', '# GANADOR KRT<a:CL:3>',
        '# <a:bolivia:1>𝙴𝚅𝙰𝙽𝙶𝙴𝙻𝙸𝙽𝙴 𝚅𝚂 𝙳𝙾𝙼𝙸𝙽𝙸𝙲𝙺<a:Per:2>', '# X 23 - 24', '# REPLICA:<a:bolivia:1><a:Per:2>',
        '# 👈EVANGELINE<a:bolivia:1>', '# GANADOR REPLICA <a:bolivia:1>'))
    ok(len(d1) == 2 and d1[0][5:7] == ['KRT', 'directa'] and d1[1][5:7] == ['EVANGELINE', 'replica'] and d1[0][2] == 1,
       'FMS TITANS: GANADOR con nombre; con la bandera sola, la flecha de la réplica; la jornada en sílabas', str(d1))
    # DDF Perú: la mano
    d2 = leer_liga('fms-peru', ms(
        '# JORNADA 1', '# 🇵🇪DREXX <:versus_:1> SOL🇵🇪\n**24 PTB - 29.5 PTB**\n🫱',
        '# 🇵🇪NEXUS <:versus_:1> SILENCE🇵🇪\n👈👉**29 - 29.5 PTB**\n**REPLICA:** 👉',
        '# 🇵🇪SOL <:versus_:1> LSD🇵🇪\n**27 PTB - 27 PTB**\n        ❎️\n# 🇵🇪SOL🇵🇪'))
    ok([x[5:7] for x in d2] == [['SOL', 'directa'], ['SILENCE', 'replica'], ['SOL', 'replica']],
       'FMS PERU: la mano dice quién; la réplica, con flecha o con el nombre solo', str([x[3:7] for x in d2]))
    # Snake: el PTB OFICIAL, y la liga por su emoji
    sn = ms('<:snkLIGA:1> __**PTB OFICIAL**__ <:snkLIGA:1>\n🇦🇷 RUBIK - 125 <:1pt:2>\n🇦🇷 MCO - 127,5 <:2pts:3>',
            '<:NewChapter:1> __**PTB OFICIAL**__ <:NewChapter:1>\n🇩🇴 ZIGNOS - 113 <:3pts:4>\n🇦🇷 DELUXE - 112,5 <:0pts:5>')
    g, nc = leer_liga('snake-generations', sn), leer_liga('snake-new-chapter', sn)
    ok(len(g) == 1 and g[0][5:7] == ['MCO', 'replica'] and len(nc) == 1 and nc[0][5:7] == ['ZIGNOS', 'directa'],
       'Snake: cada liga por el emoji de su título; 2 y 1 es réplica, 3 y 0 directa', str(g) + str(nc))
    t = tabla(d2)
    ok(t[0][0] == 'SOL' and t[0][1:] == [2, 2, 5], 'la tabla: directa 3, réplica 2 y 1', str(t))
    ok(lados('# <:FMH_UNDER:1> MTZ 🇲🇽 VS NEISMC 🇦🇷 (EXHIBICION)') is None and lados('# PTB TOTAL X3') is None,
       'una exhibición o un PTB TOTAL no abren una batalla')

    # 🔱 FRZ, la FZ LEAGUE: cada jornada cerrada en un mensaje, sólo la temporada más nueva
    fz = leer_liga('fzl', [
        {'id': '10', 't': '2026-02-01T20:00:00Z', 'content': '**FREESTYLE ZONE LEAGUE <:FZL:1> - TEMPORADA 15 JORNADA 2\n'
                                                              'VIEJO 🇦🇷 VENCE DE MANERA DIRECTA A OTRO 🇨🇱**'},
        {'id': '20', 't': '2026-04-17T20:00:00Z', 'content': '**FMS WORLD SERIES 2026 <:W:1> - TEMPORADA 2 JORNADA 4\n'
                                                              'RAGNA 🇨🇱 VENCE DE MANERA DIRECTA A CEKO 🇦🇷**'},
        {'id': '30', 't': '2026-08-25T20:00:00Z', 'content': '**FZ LEAGUE <:FZL:1> - TEMPORADA 16 JORNADA 4\n\n'
                                                              'JUASMIO 🇨🇴 VENCE TRAS RÉPLICA A CEIM 🇨🇱\n'
                                                              'CEKO 🇦🇷 VENCE DE MANERA DIRECTA A VENUS 🇨🇱\n'
                                                              'SOL 🇵🇪 & TOKIO 🇦🇷 DIVIDEN PUNTOS\n<@1> 🇨🇴 VENCE TRAS '
                                                              'RÉPLICA A <@2> 🇨🇱\n**\n||@everyone||'}])
    ok([x[2:7] for x in fz] == [[4, 'JUASMIO', 'CEIM', 'JUASMIO', 'replica'], [4, 'CEKO', 'VENUS', 'CEKO', 'directa']]
       and [x[0] for x in fz] == ['30-0', '30-1'],
       'FZ LEAGUE: «VENCE DE MANERA DIRECTA» y «TRAS RÉPLICA» de la temporada más nueva; ni la World Series, ni el '
       'empate («dividen puntos»), ni las menciones; y un id por batalla aunque compartan mensaje', str(fz))
    ok(sorted(['30-1', '9', '30-0', '29'], key=_orden) == ['9', '29', '30-0', '30-1'], 'los ids se ordenan por mensaje y orden')
    u2 = VENCE.match(_plano('CEKO 🇦🇷 VENCE A BM 🇦🇷 DE MANERA DIRECTA'))
    ok(u2 and u2.group(4) and u2.group(5).upper() == 'DIRECTA', 'y el orden de su canal «tabla» («VENCE A X DE MANERA DIRECTA»)')

    # 🎙️ FDS (20/10/2026): un mensaje por batalla; el PTB del cierre decide; los cierres cortos; el df no es batalla
    pfd = {}
    fd = leer_liga('fds-peru', ms(
        '# <:FDSPERU:1> JORNADA 1 <:FDSPERU:1>',
        '# __ MC AREPA <:vs:2>  CINEXFILO __\n\nEasy mode\n\nMC Arepa: (2) (2) (2) (3) (1) (1)  11\nCinexfilo: (2) (2) (2) (2) (3) (2) 13\n'
        'RESULTADOS 92 CINE - 87 MCarepa\nREPLICA',
        '# __ MC AREPA <:vs:2>  CINEXFILO __\n# REPLICA\nMC Arepa (2) (1) (2) (1)  6\nCinexfilo (2) (1) (3) (1)  7\n'
        '# GANADOR POR LA MINIMA Cine\n# <:alerta:3>  Resultados <:alerta:3>\nMC arepa +100\nCinefilox +300',
        '# <:FDSPERU:1> Artezzy <:vs:2> Cronox <:FDSPERU:1>\n\n##  Gana Artezzy por df el rival no se presentó.',
        '# Gana : Pepe Mujica 66 - Giansito 60',
        '# <:FDSPERU:1> JORNADA 2 <:FDSPERU:1>',
        '# <:FDSPERU:1> SIN LIMITES <:vs:2> SOL| Jornada 2 <:FDSPERU:1>\n\nEasy mode\nSOL: (0) (0.) (1) (1) (0.) (0) = 4\n'
        'SIN LIMITES: (1) (0.) (2) (0) (0.) (0) = 4\n\nTotal:\n\nSOL: (44.5)\nSIN LIMITES: (46)\n\nRéplica:\n\n'
        'SIN LIMITES: (1) (0.) (2) (0.) (1) (0) (3) (1) = 9\nSOL: (2) (1) (0) (1) (0) (0.) (1) (2) =  7.5\n\nPTB:\n \nSOL: (+100)\nSIN LIMITES: (+300)',
        '# <:FDSPERU:1> Pepe Mujica <:vs:2> Cinexfilo | Jornada 2 <:FDSPERU:1>\n\nTotal:\n\nPepe Mujica: (44.5)\nCinexfilo: (37)\n\n'
        'PTB:\n \nPepe Mujica: (+500)\nCinexfilo: (-250)',
        '# <:FDSPERU:1>  Giansito  <:vs:2> Telmex <:FDSPERU:1>\n\n##  Gana Giansito',
        '1 ROUND EASY MODE\n\nMato\n\nReplica\n\nPoxe 0 0 0 0:0\nMato 0 0 0 0:0'), pfd)
    ok([x[2:7] for x in fd] == [[1, 'MC AREPA', 'CINEXFILO', 'CINEXFILO', 'replica'], [1, 'Pepe Mujica', 'Giansito', 'Pepe Mujica', 'directa'],
                                [2, 'SIN LIMITES', 'SOL', 'SIN LIMITES', 'replica'], [2, 'Pepe Mujica', 'Cinexfilo', 'Pepe Mujica', 'directa'],
                                [2, 'Giansito', 'Telmex', 'Giansito', 'directa']],
       'FDS: la réplica cierra en el mensaje siguiente («GANADOR POR LA MINIMA Cine»), el PTB +300/+100 es réplica y +500/-250 '
       'directa, «Gana : A 66 - B 60» y «Gana X» a secas; el «por df» no es batalla, y una planilla sin título no reabre nada',
       str([x[2:7] for x in fd]))
    ok(pfd.get('1006') == [46.0, 44.5] and pfd.get('1007') == [44.5, 37.0] and '1008' not in pfd,
       'FDS: el total de cada lado, en el orden del título, sólo cuando lo dijo', str(pfd))
    ok(_cual('POR LA MINIMA Cine', 'MC AREPA', 'CINEXFILO') == 'b' and _cual('Cinefilox', 'MC AREPA', 'CINEXFILO') == 'b'
       and _cual('MC arepa', 'MC AREPA', 'CINEXFILO') == 'a' and _cual('Sol', 'SIN LIMITES', 'SOL') == 'b'
       and _cual('ganador', 'MC AREPA', 'CINEXFILO') is None and _cual('C', 'CAMPOY', 'CEKO') is None,
       'los apodos del cierre: el principio del nombre o un parecido claro, nunca con los dos lados parecidos')
    ok(lados('# <:FDSPERU:1> SIN LIMITES <:vs:2> SOL| Jornada 2 <:FDSPERU:1>')[:2] == ('SIN LIMITES', 'SOL'),
       'el «| Jornada 2» del título de FDS no es parte del nombre')

    # 👑 LKR (21/10/2026): el título, los puntos y el «GANADOR» en mensajes separados; la réplica, y los apodos del cierre
    lk = leer_liga('lkr-champions', ms(
        '# Shadow 🇨🇴 vs Mc_Glock 🇲🇽', 'Shadow - X - I - X - X - I - I.5: 3.5\nGlock - 0.5 - 0.5 - I.5 - 0.5 - X - 0.5: 3.5\n\nReplica',
        'Glock - 0.5 - X - I: 1.5\nShadow - X - 0.5 - X: 0.5\n\nGANADOR GLOCK',
        '# Monet🇲🇽 vs Matthias🇻🇪', 'Matthias🇻🇪 : 4\nMonet🇲🇽 : 2.5\nGanador Matthias 🇻🇪',
        '# Soul B 🇨🇱 vs Dios 🇲🇽', 'Soul - 1.5 - 1 - 1.5: 4\nDios - 1 - 1.5 - 1: 3.5\n\nGANADOR Replica',
        'Dios - I - X - 0.5: 1.5\nSoul - 0.5 - I - I: 2.5\n\nGANADOR SOUL',
        '# SHADOW<a:Colombia:1> VS KUSOH<a:mexico:2>', 'SHADOW<a:COLOMBIA:3>\n.5 - .5 - .5= 1.5\n\nKUSOH<a:MEXICO:4>\n1 - 1 - .5 =2.5\nGANADOR: KUSOH<a:MEXICO:4>',
        '# Last🇺🇾 VS KUDE🇦🇷', 'Last🇺🇾 = 3\nKude🇦🇷 = 4'))
    ok([x[3:7] for x in lk] == [['Shadow', 'Mc_Glock', 'Mc_Glock', 'replica'], ['Monet', 'Matthias', 'Matthias', 'directa'],
                                ['Soul B', 'Dios', 'Soul B', 'replica'], ['SHADOW', 'KUSOH', 'KUSOH', 'directa'],
                                ['Last', 'KUDE', '', '']],
       'LKR: «GANADOR X» en otro mensaje, «Replica» y «GANADOR Replica» abren la réplica, el apodo del cierre (GLOCK, '
       'SOUL) y sin cierre queda pendiente', str([x[3:7] for x in lk]))

    # 🖼️ el flyer: un afiche, no un separador
    ok(es_flyer({'ct': 'image/jpeg', 'w': 1080, 'h': 1350}) and not es_flyer({'ct': 'image/jpeg', 'w': 1400, 'h': 200})
       and not es_flyer({'ct': 'image/png', 'w': 2172, 'h': 238}) and not es_flyer({'ct': 'image/gif', 'w': 500, 'h': 500}),
       'el flyer es un afiche: ni la línea separadora, ni un banner, ni un gif')
    ok(titulo_flyer('# <:FMHESP:1> STORMED<a:Bandera_espana:2> <:vs:3> JOSELIYO<a:Bandera_espana:2> <:FMHESP:1>\nUltima')
       == 'STORMED vs JOSELIYO' and titulo_flyer('# ONCEAVA BATALLA CONFIRMADA 🇻🇪 VS 🇦🇷 <@12> @everyone')
       == 'ONCEAVA BATALLA CONFIRMADA 🇻🇪 VS 🇦🇷', 'de qué es el flyer: la batalla, o el renglón sin menciones')
    sr = [{'id': '1', 't': '2026-10-11T21:57:00Z', 'content': '# <:snkLIGA:1> SNAKE LEAGUE GENERATIONS',
           'adj': [{'u': 'https://cdn/x.jpg', 'w': 1080, 'h': 1350, 'ct': 'image/jpeg'}]},
          {'id': '2', 't': '2026-10-11T21:58:00Z', 'content': '', 'adj': [{'u': 'https://cdn/s.jpg', 'w': 1400, 'h': 200,
                                                                            'ct': 'image/jpeg'}]}]
    fg, fn = flyer_de(LIGAS['snake-generations'], sr), flyer_de(LIGAS['snake-new-chapter'], sr)
    ok(fg and fg['id'] == '1' and fg['w'] == 1080 and fn is None,
       'en el canal compartido de Snake Rap, el afiche va a la liga de su emoji; el separador no es afiche', str(fg))
    ok(_flyer_nuevo('x', {'id': '1', 't': 'a', 'src': 'https://cdn/x'}, {'id': '1', 'url': 'https://r2/1.webp'}, False)
       == {'id': '1', 'url': 'https://r2/1.webp'} and _flyer_nuevo('x', {'id': '2', 'src': 's'}, None, False) is None,
       'el mismo afiche no se vuelve a subir, y sin la copia en R2 no se guarda (el de Discord vence)')

    # 🗓️ la próxima fecha: lo que el anuncio DICE
    ahora = dt.datetime(2026, 10, 14, 23, 0, tzinfo=dt.timezone.utc)

    def px(lid, *textos, t='2026-10-14T17:53:00Z'):
        return proxima_de(LIGAS[lid], [{'id': str(9 + i), 't': t, 'content': x} for i, x in enumerate(textos)], ahora)
    p = px('fmh-espana', '# <:FMHESP:1> STORMED <:vs:3> JOSELIYO\nUltima Batalla de la Jornada 6 en Barcelona, '
                         'Nos vemos este Domingo 18 de Octubre!')
    ok(p == {'d': '2026-10-18', 't': '', 'j': 6, 'id': '9'}, '«nos vemos este Domingo 18 de Octubre»: el día, sin hora', str(p))
    p = px('fmh-espana', 'la jornada 6 se juega el 18 de octubre a las 21:00 🇪🇸')
    ok(p and p['t'] == '2026-10-18T19:00:00Z', 'con hora y bandera, el instante (21:00 de Madrid son las 19 UTC)', str(p))
    ok(px('fmh-carimex', '# YA PUEDEN HACER SUS BATALLAS,TIENEN PLAZO HASTA EL 24 DE OCTUBRE … JORNADA 8') is None,
       '«plazo hasta el 24» no es una fecha: es un límite')
    ok(px('fmh-tricolor', 'Tercera Batalla de la Jornada 4, nos vemos este 10 de Octubre!') is None,
       'una fecha que ya pasó no es la próxima')
    p = px('fmh-andes', '# JORNADA 4\n**CONTINUAMOS CON EL TOUR Y HOY LA SEDE ES LIMA**', t='2026-10-14T13:21:00Z')
    ok(p and p['d'] == '2026-10-14' and p['j'] == 4, '«HOY la sede…» con la jornada: hoy, en la hora de la liga', str(p))
    ok(px('fms-world-series', '# HOY PUEDO DESPUÉS DE LAS 6pm COLOMBIA 🇨🇴 O YA', '# LA JORNADA TERMINA EL JUEVES') is None,
       '«hoy puedo…» no habla de la fecha, y «termina el jueves» es un límite')
    p = px('snake-generations', '<:snkLIGA:1> JORNADA 5 <t:1792000000:F>')
    ok(p and p['t'] == dt.datetime.fromtimestamp(1792000000, dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
       'la marca de Discord <t:…> es el instante exacto', str(p))

    # 🏟️ lo que viaja: las fechas, el flyer, la próxima y la encuesta
    dd = {'t': 'x', 'ligas': {'fms-peru': {'n': 'FMS Perú', 'sv': 'DDF', 'jornada': 2, 'batallas': [
        ['1', '2026-10-06T18:00:00Z', 1, 'SOL', 'LSD', 'SOL', 'directa', ''],
        ['2', '2026-10-07T18:00:00Z', 1, 'NEXUS', 'PIPAS', 'PIPAS', 'replica', ''],
        ['3', '2026-10-13T18:00:00Z', 2, 'SOL', 'PIPAS', '', '', ''],
        ['4', '2026-10-14T03:00:00Z', None, 'LSD', 'NEXUS', 'LSD', 'directa', '']],
        'flyer': {'id': '77', 't': '2026-10-13T00:00:00Z', 'tit': 'SOL vs PIPAS'},
        'prox': {'d': '2026-10-18', 't': '', 'j': 2, 'id': '78'}},
        'fmh-andes': {'n': 'FMH Andes', 'sv': 'URBF', 'batallas': [['5', '2026-09-01T00:00:00Z', 1, 'A', 'B', 'A', 'directa', '']],
                      'flyer': {'id': '79', 't': '2026-09-01T00:00:00Z', 'tit': '', 'url': 'https://r2/ligas/x.webp', 'w': 720,
                                'h': 900}, 'prox': {'d': '2026-10-01', 't': '', 'j': None, 'id': '80'}}}}
    w = para_web(dd, claves={}, ps={}, ahora=ahora, resolver=lambda x: x)
    lp = [x for x in w['ligas'] if x['id'] == 'fms-peru'][0]
    la = [x for x in w['ligas'] if x['id'] == 'fmh-andes'][0]
    ok([(f['j'], f['d'], len(f['b'])) for f in lp['fechas']] == [(None, '2026-10-13', 1), (2, '2026-10-13', 1), (1, '2026-10-07', 2)]
       and [x[:4] for x in lp['fechas'][1]['b']] == [['SOL', 'PIPAS', '', '']],
       'las fechas: por jornada, o por el día en que se cerró (en Lima, el 14/10 03:00 UTC es el 13), la más nueva primero; '
       'la que no tiene cierre va sin ganador', str(lp['fechas']))
    ok('flyer' not in lp and la['flyer']['u'] == 'https://r2/ligas/x.webp' and la['flyer']['link'].endswith('/79'),
       'el flyer viaja sólo si está en R2, con el link a su mensaje')
    ok(lp['prox']['d'] == '2026-10-18' and lp['prox']['link'].endswith('/78') and 'prox' not in la,
       'la próxima fecha viaja si no pasó')
    ok(lp['vota'] == '2026-11-08T23:59:59Z' and la['vota'] == '2026-10-22T23:59:59Z',
       'la encuesta cierra 21 días después de la última fecha de la liga: la próxima anunciada o la última batalla',
       str((lp['vota'], la['vota'])))
    ok(vota([['1', '2026-09-01T00:00:00Z']]) == '2026-09-22T00:00:00Z' and vota([]) == '',
       'sin fecha anunciada, 21 días después de la última batalla; sin batallas, no hay encuesta')
    kv = para_kv(w)
    ok(kv['lista'][0] == {'id': 'fms-peru', 'hasta': '2026-11-08T23:59:59Z', 'op': [f[0] for f in lp['tabla']]}
       and kv['lista'][0]['op'] == ['SOL', 'LSD', 'PIPAS', 'NEXUS'] and len(kv['lista']) == 2,
       'lo que valida el Worker: las mismas opciones que la tabla de la página', str(kv))
    lob, det = separar(w)
    lo = {x['id']: x for x in lob['ligas']}
    ok('fechas' not in lo['fms-peru'] and 'flyer' not in lo['fmh-andes'] and lo['fmh-andes']['fl'] == 'https://r2/ligas/x.webp'
       and lo['fms-peru']['f0'] == {'j': None, 't': '2026-10-14T03:00:00Z', 'n': 1} and lo['fms-peru']['vota']
       and det['ligas']['fms-peru']['fechas'] == lp['fechas'] and det['ligas']['fmh-andes']['flyer'] == la['flyer']
       and para_kv(lob) == kv,
       'el lobby lleva lo del Inicio (la tabla, `fl`, `f0`, `vota`); las fechas y el flyer entero van aparte', str(lo['fms-peru']))

    # 🏆 el Salón de campeones y lo que publica el muro (16/10/2026)
    t9 = dt.datetime(2026, 10, 16, 12, tzinfo=dt.timezone.utc)
    dz = {'ligas': {'fzl': {'n': 'FZ League', 'sv': 'FRZ', 'batallas': [
        ['%d' % i, '2026-09-%02dT20:00:00Z' % (1 + i), i, 'CEKO', 'R%d' % i, 'CEKO', 'directa', ''] for i in range(1, 6)] + [
        ['9', '2026-09-08T20:00:00Z', 6, 'JUAS', 'R9', 'JUAS', 'replica', '']]}}}
    wz = para_web(dz, claves={'CEKO': 'ceko'}, ps={}, ahora=t9, resolver=lambda x: x, decis={})
    ok(ultima(dz['ligas']['fzl']['batallas']) == '2026-09-08'
       and [(L['id'], u) for L, u in terminadas(wz, {}, t9, desde='')] == [('fzl', '2026-09-08')]
       and not terminadas(wz, {}, t9, desde='2026-09-22T00:00:00'),
       'una liga parada hace más de tres semanas, sin fecha anunciada, se pregunta (una vez por cada parada); si paró '
       'antes del arranque de la temporada, no')
    dfin = {FIN: [{'liga': 'fzl', 'n': 'FZ League', 'sv': 'FRZ', 'ult': '2026-09-08', 'temporada': 'prueba',
                   'campeon': 'CEKO', 'podio': podio(['CEKO', 'JUAS', 'R1'], 'CEKO'), 't': '2026-10-16T12:00:00Z'}]}
    wf = para_web(dz, claves={'CEKO': 'ceko'}, ps={}, ahora=t9, resolver=lambda x: x, decis=dfin)
    ok(not terminadas(wf, dfin, t9, desde='') and wf['ligas'][0]['fin'] == {'c': 'CEKO', 'p': ['CEKO', 'JUAS', 'R1']}
       and wf['salon'][0]['c'] == 'CEKO' and wf['salon'][0]['ks'] == {'CEKO': 'ceko'}
       and separar(wf)[0]['salon'] == wf['salon'],
       'con el campeón confirmado: no se vuelve a preguntar, la liga lo lleva (`fin`) y entra al Salón, que viaja en el lobby')
    ok(not terminadas(wz, {SIGUE: {'fzl': {'ult': '2026-09-08'}}}, t9, desde=''),
       '«todavía no terminó» no se vuelve a preguntar mientras no juegue y pare otra vez')
    ok(podio(['A', 'B', 'C', 'D'], 'C') == ['C', 'A', 'B'], 'el podio: el campeón y los dos primeros de la tabla que no son él')
    hz = hitos(dz, resolver=lambda x: x, ps={}, desde='')
    ok(not hitos(dz, resolver=lambda x: x, ps={}, desde='2026-09-22T00:00:00'),
       'lo que pasó antes del arranque de la temporada no se publica')
    inv = [h for h in hz if h['que'] == 'invicto']
    pun = [h for h in hz if h['que'] == 'punta']
    ok(len(inv) == 1 and inv[0]['quien'] == ['CEKO'] and inv[0]['t'] == '2026-09-06T20:00:00Z',
       'invicto: una vez, en la batalla de su quinta ganada sin perder', str(inv))
    ok([(h['quien'], h['t'][:10]) for h in pun] == [(['CEKO'], '2026-09-04')],
       'la punta: recién con 3 jugadas, sola, y se publica cuando cambia (no en cada fecha)', str(pun))
    ok(campeones_hitos(dfin)[0]['que'] == 'campeon' and campeones_hitos({}) == [],
       'el campeón confirmado también se publica')
    _self_check_pagina(ok)
    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


def _self_check_pagina(ok):
    """📊 Lo de la página completa de cada liga (17/10/2026): el PTB, el staff, la galería, las fechas por semana, los
    videos y las novedades para «Seguir la liga»."""
    def ms(*textos):
        return [{'id': str(2000 + i), 't': '2026-10-0%dT20:00:00Z' % (1 + i % 9), 'content': x} for i, x in enumerate(textos)]
    pt = {}
    u = leer_liga('fmh-albiceleste', ms(
        '# <:FMH_Albiceleste:1> ZIGNOS 🇩🇴 <:VSAzul:2> BENJIXO 🇺🇾 <:FMH_Albiceleste:1>',
        '**ZIGNOS 🇩🇴 :  36.5 (109.5)**\nBENJIXO 🇺🇾 : 27 (81)\n**ZIGNOS 🇩🇴 GANA DIRECTO, POR 9.5 PTS! +3**'), pt)
    pt2 = {}
    leer_liga('fmh-under', ms(
        '# <:FMH_UNDER:1> CINEXFILO 🇻🇪 VS MAKMA 🇻🇪 🎮 <:FMH_UNDER:1> - JORNADA 4',
        '# <:FMH_UNDER:1> ⚔️ RÉPLICA ⚔️ <:FMH_UNDER:1>',
        '# PTB TOTAL\n**MAKMA 🇻🇪: 121.5** +1\nCINEXFILO 🇻🇪: 117 +2'), pt2)
    ok(u and pt.get(u[0][0]) == [36.5, 27.0] and list(pt2.values()) == [[39.0, 40.5]],
       'el PTB de FMH, en la escala del promedio: el número (no la suma entre paréntesis), y el PTB TOTAL dividido 3; de '
       'cada lado aunque vengan al revés', [pt, pt2])
    pt3 = {}
    leer_liga('fms-titans', ms('# 🇵🇪CRIZJ VS NEXUS🇵🇪\n# 👉 19.5 - 22\n# GANADOR NEXUS🇵🇪'), pt3)
    pt4 = {}
    leer_liga('fms-peru', ms('# 🇵🇪DREXX <:versus_:1> SOL🇵🇪\n**24 PTB - 29.5 PTB**\n🫱'), pt4)
    pt5 = {}
    leer_liga('snake-generations', ms('<:snkLIGA:1> __**PTB OFICIAL**__ <:snkLIGA:1>\n🇦🇷 RUBIK - 125 <:1pt:2>\n'
                                      '🇦🇷 MCO - 127,5 <:2pts:3>'), pt5)
    ok(list(pt3.values()) == [[19.5, 22.0]] and list(pt4.values()) == [[24.0, 29.5]] and list(pt5.values()) == [[125.0, 127.5]],
       'el PTB de DDF (la flecha y «a PTB - b PTB») y el PTB OFICIAL de Snake', [pt3, pt4, pt5])
    L = LIGAS['snake-generations']
    ver = [{'id': '1', 't': '2026-10-10T00:00:00Z', 'content': '<:snkLIGA:1> PTB OFICIAL', 'au': '11', 'aun': 'Juez'},
           {'id': '2', 't': '2026-10-11T00:00:00Z', 'content': '<:NewChapter:1> PTB OFICIAL', 'au': '22', 'aun': 'Otro'},
           {'id': '3', 't': '2026-10-12T00:00:00Z', 'content': '<:snkLIGA:1> x', 'au': '33', 'aun': 'Bot', 'bot': True}]
    an = [{'id': '4', 't': '2026-10-09T00:00:00Z', 'content': '<:snkLIGA:1> JORNADA 3', 'au': '44', 'aun': 'Orga'},
          {'id': '5', 't': '2026-10-13T00:00:00Z', 'content': '<:snkLIGA:1> JORNADA 4', 'au': '44', 'aun': 'Orga'}]
    ahora = dt.datetime(2026, 10, 17, tzinfo=dt.timezone.utc)
    st = staff_de(L, ver, an, viejo=[['99', 'Viejo', 1, 0, '2026-09-30T00:00:00Z'], ['98', 'Ido', 1, 0, '2026-07-01T00:00:00Z']],
                  ahora=ahora)
    ok([x[:4] for x in st] == [['44', 'Orga', 2, 0], ['11', 'Juez', 0, 1], ['99', 'Viejo', 1, 0]],
       'el staff: quién publica en anuncios y en veredictos de ESA liga (no la otra del canal), sin bots; el de antes '
       'se queda 60 días', st)
    an2 = [{'id': '6', 't': '2026-10-01T00:00:00Z', 'content': '<:snkLIGA:1> afiche',
            'adj': [{'u': 'https://x/a.png', 'w': 1080, 'h': 1350, 'ct': 'image/png'}, {'u': 'https://x/b.png', 'w': 1080,
                    'h': 1350, 'ct': 'image/png'}]},
           {'id': '7', 't': '2026-10-05T00:00:00Z', 'content': '<:snkLIGA:1> otro',
            'adj': [{'u': 'https://x/c.png', 'w': 1400, 'h': 200, 'ct': 'image/png'}]},
           {'id': '8', 't': '2026-06-01T00:00:00Z', 'content': '<:snkLIGA:1> viejo',
            'adj': [{'u': 'https://x/d.png', 'w': 1080, 'h': 1350, 'ct': 'image/png'}]}]
    fl = flyers_de(L, sorted(an2, key=lambda m: m['id']), desde='2026-09-01')
    gal = _flyers_nuevos('x', fl, [{'id': '6', 'url': 'https://r2/6.webp', 't': '2026-10-01T00:00:00Z'},
                                   {'id': '5', 'url': 'https://r2/5.webp', 't': '2026-09-20T00:00:00Z'}], aplicar=False)
    ok([f['id'] for f in fl] == ['6', '6-1'] and [f['id'] for f in gal] == ['6', '5'],
       'la galería: dos afiches de un mensaje son dos, el banner no, lo de antes de la temporada no; sin --aplicar no '
       'sube nada y lo que ya estaba en R2 se queda', [fl, gal])
    z = dt.timezone(dt.timedelta(hours=-5))
    bats = [['1', '2026-09-21T20:00:00Z', None, 'A', 'B', 'A', 'directa', ''],
            ['2', '2026-09-23T20:00:00Z', None, 'C', 'D', 'D', 'replica', ''],
            ['3', '2026-09-29T20:00:00Z', None, 'A', 'C', '', '', ''],
            ['4', '2026-10-03T20:00:00Z', 2, 'B', 'D', 'B', 'directa', '']]
    fs = _fechas(bats, lambda x: x, z, ptb={'1': [30, 25]}, vids={frozenset(('c', 'd')): 'vidCD'})
    ok([(f['j'], f['s'], f['d'], len(f['b'])) for f in fs] == [(2, '', '2026-10-03', 1), (None, '', '2026-09-29', 1),
                                                                (None, '2026-09-21', '2026-09-23', 2)]
       and fs[2]['b'][0][4:7] == [30, 25, '1'] and fs[2]['b'][1][7] == 'vidCD',
       'las fechas: sin jornada, por semana (y un día solo es ese día); con el PTB, el veredicto y el video', fs)
    vj = {'videos': {'v1': ['SIX 🆚 DTR || Jornada #1 - Snake League VI', 'SR', ['Six']],
                     'v2': ['A 🆚 B || Copa X', 'SR', []], 'v3': ['RUBIK VS ZETA | Final', 'URBF', []],
                     'v4': ['Algo sin cruce', 'SR', []]}}
    lista, porp = _videos(L, [['1', '', 1, 'A', 'B', 'A', 'directa', '']], vj)
    ok(sorted(v[0] for v in lista) == ['v1', 'v2'] and porp == {frozenset(('a', 'b')): 'v2'},
       'los videos de la liga: los que la nombran y los de una de sus batallas, sólo de su servidor', [lista, porp])
    antes = {'1': ['1', 't', 1, 'A', 'B', '', '', '']}
    ahora2 = dt.datetime(2026, 10, 17, 12, tzinfo=dt.timezone.utc)
    n1 = novedades('lg', antes, [['1', 't', 1, 'A', 'B', 'A', 'directa', ''], ['2', 't', 1, 'C', 'D', 'C', 'directa', '']],
                   {'d': '2026-10-10'}, {'d': '2026-10-18', 'j': 6}, [], ahora=ahora2)
    n2 = novedades('lg', None, [['1', 't', 1, 'A', 'B', 'A', 'directa', '']], None, {'d': '2026-10-18'}, [], ahora=ahora2)
    n3 = novedades('lg', antes, [['1', 't', 1, 'A', 'B', '', '', '']], {'d': '2026-10-18'}, {'d': '2026-10-18'},
                   n1 + [{'id': 'r:viejo', 't': '2026-10-10T00:00:00Z'}], ahora=ahora2)
    ok([(n['que'], n.get('ids') or n.get('d')) for n in n1] == [('res', ['1', '2']), ('fecha', '2026-10-18')]
       and n2 == [] and [n['id'] for n in n3] == [n['id'] for n in n1],
       'lo nuevo para quien sigue la liga: los resultados juntos en uno, la fecha anunciada; la primera lectura no '
       'es novedad, y lo de hace más de 48 horas vence', [n1, n2, n3])


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        return _self_check()
    print('\n══ LAS LIGAS ══\n')
    correr(aplicar='--aplicar' in sys.argv)
    return 0


if __name__ == '__main__':
    sys.exit(main())
