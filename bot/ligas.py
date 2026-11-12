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

🏆 DESDE EL 11/11/2026 HAY TEMPORADAS, Y LAS LIGAS NUEVAS ENTRAN SOLAS (Dlx: «Sí, del 1 al 3», y «asegúrate de que el bot
detecte una nueva liga… y cuando una liga acabe que siga en un álbum especial como LIGAS COMPLETADAS»):

    el campeón     lo que su servidor ANUNCIA cierra la temporada (`campeon_en()`); lo que no anuncia nadie se le
                   pregunta a Dlx en ✅ Decidir, como antes, y la liga que se queda sin canales se pregunta ya
    la temporada   `temporadas()` parte las batallas en cada cierre: la siguiente arranca de cero, y la que terminó va
                   entera a «Ligas completadas» (`para_web()`, `completadas`) con sus cartas, que ya no cambian
    las nuevas     `descubrir()` mira las categorías de los servidores: la que tiene forma de liga, un lector que la
                   entiende y se está jugando entra a `LIGAS` sola (`datos/ligas.json`, `nuevas`), y su categoría sale
                   de los eventos (`marcar_fuera()`)
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
                   'tabla': '1550947722385694871', 'an': '1566583195304992808', 'cc': 'PE'},
    'fms-peru': {'n': 'FMS Perú', 'sv': 'DDF', 'fam': 'D2', 'vre': r'FMS\s+PER[UÚ]', 'ver': '1556501721004376105',
                 'tabla': '1556501553609834557', 'an': '1556501776272724078', 'cc': 'PE'},
    'fms-tricolor': {'n': 'FMS Tricolor', 'sv': 'DDF', 'fam': 'D2', 'vre': r'FMS\s+TRICOLOR', 'ver': '1557529352529387600',
                     'tabla': '1557528234885779587', 'an': '1557529416605761557', 'cc': 'CO'},
    # 🔴 DDF rehízo sus canales el 01/11/2026: los de antes dan 404 y `_mensajes()` se callaba. Ver `ubicar()`
    'fms-world-series': {'n': 'FMS World Series', 'sv': 'DDF', 'fam': 'D2', 'vre': r'FMS\s+WORLD\s+SERIES', 'ver': '1566514198584889344',
                         'tabla': '1566513665081868450', 'an': '1566583919388795021', 'cc': 'CO'},
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
    # 🏟️ las tres que LKR abrió a fines de octubre (encontradas el 04/11/2026 mirando sus llamadas). Las escribe a su
    # manera: «# MAKMA +3PTO», «# TOKIO+3», «# TEITO X LA MINIMA». FMS Tricolor publica en «Resultados», no en «Veredicto»
    'lkr-fms-tricolor': {'n': 'FMS Tricolor LKR', 'sv': 'LKR', 'fam': 'K', 'vre': r'FMS\s+TRICOLOR',
                         'ver': '1565416431745634374', 'tabla': '1565416907409064057', 'an': '1565416157463191634', 'cc': 'CO'},
    'lkr-fms-latam': {'n': 'FMS LATAM', 'sv': 'LKR', 'fam': 'K', 'vre': r'FMS\s+LATAM',
                      'ver': '1566520848591093781', 'tabla': '1566520642529001683', 'an': '1566520559087521832', 'cc': 'MX'},
    'lkr-fms-espana': {'n': 'FMS España', 'sv': 'LKR', 'fam': 'K', 'vre': r'FMS\s+ESPANA',
                       'ver': '1566535333254795466', 'tabla': '1566535121224343632', 'an': '1566534624165892157', 'cc': 'ES'},
}
#: 🏟️ la clave de KV con los canales de cada liga, para el vigía de las batallas (`ligasRonda()` en bot/avisos.js)
CLAVE_VIGIA = 'ligas:vigia'
#: las familias que el vigía sabe leer mientras pasan (`bot/ligas_vivo.js`). Las FMH publican el título al arrancar; LKR,
#: casi con el cierre: ahí sólo sale el resultado rápido. Snake, DDF, FRZ y FDS publican al final: el ciclo les alcanza
FAM_VIGIA = ('U', 'K')
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
#: 🏳️ y pegado a una bandera: «# MARTÍNEZ🇺🇾VS DEUX🇨🇱» (FMH Andes, J1) no se leía y la batalla no existía (29/10/2026)
SEP = re.compile(r'(?:\s|(?<=[\U0001F1E6-\U0001F1FF]))(?:vs\.?|v/s|versus)(?:\s|(?=[\U0001F1E6-\U0001F1FF]))|🆚|'
                 r'<a?:\w*(?:vs|versus)\w*:\d+>', re.I)
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
    # 🔁 y «- RECUPERATIVA» (FMH España, 05/11/2026): «EFE - RECUPERATIVA» salía como si fuera su nombre, también en el chat
    b = re.sub(r'\s*[-|]\s*(?:JORNADA\s*\d+|RECUPERATIVA\b).*$', '', b, flags=re.I)
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
#: «DEUXS GANA DESPUÉS DE DOS RÉPLICA» (FMH Andes, 23/10/2026) también es en réplica
GANA = re.compile(r'^\W*(.+?)\s+GANA\s+(DIRECTO|DIRECTA|EN\s+(?:LA\s+)?R[EÉ]PLICA|DESPU[EÉ]S\s+DE\s+\w+\s+R[EÉ]PLICAS?)', re.I)
#: «# X POR 5 PUNTOS» y, en las primeras jornadas de FMH Andes, «# 🎖️ GANADOR 🎖️ · ** ZETRYKO 🇨🇱 X 9 pts **»: el que
#: gana y por cuánto (la victoria contra OEP de Zetryko quedaba pendiente, 29/10/2026)
POR_PUNTOS = re.compile(r'^[#*\s]*(.+?)\s+(?:POR|X)\s+([\d]+(?:[.,]\d+)?)\s*(?:PUNTOS?|PTS?|PTOS?)\b', re.I)
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


#: 📋 el «RESUMEN DE RESULTADOS» que el host de FMH publica con la tabla: «- ZETRYCO 🇨🇱🌟 LE GANA A PANCHOK 🇨🇱 EN REPLICA.»
LE_GANA = re.compile(r'^\W*(.+?)\s+LE\s+GANA\s+A\s+(.+?)\s+(DIRECT[OA]|EN\s+(?:LA\s+)?R[EÉ]PLICA)\b', re.I)


def _lado_parecido(n, a, b):
    """`_quien()` y, si no alcanza, la grafía parecida: el resumen escribe «MARTINEZ» y el título «MARTYNEZ». Sólo
    entre los DOS de una batalla, así que no confunde a nadie más: el umbral es el de una letra cambiada."""
    q = _quien(n, a, b)
    if q:
        return q
    k = clave(n)
    ra, rb = (difflib.SequenceMatcher(None, k, clave(x)).ratio() for x in (a, b))
    if max(ra, rb) >= 0.8 and abs(ra - rb) >= 0.15:
        return 'a' if ra > rb else 'b'
    return None


def u_resumen(msgs, bats):
    """Completa con el RESUMEN del canal de la tabla las batallas que quedaron PENDIENTES. Es el cierre oficial del host
    y no deja dudas: «MARTINEZ 🇺🇾 LE GANA A FORZA 🇻🇪🎮 DIRECTO» cerró Martynez vs Forza, cuyo veredicto era un
    «# MARTYNEZ 🇺🇾» suelto (FMH Andes, 29/10/2026). Nunca pisa un resultado ya leído. Devuelve cuántas completó.
    `bats`: las listas de `leer_liga()`; se tocan en su lugar. Gana la batalla MÁS NUEVA con esos dos nombres."""
    n = 0
    for m in msgs:
        for l in (m.get('content') or '').splitlines():
            g = LE_GANA.match(EMOJI.sub(' ', _plano(l)))
            if not g:
                continue
            ga, pe, como = g.group(1), g.group(2), g.group(3)
            for b in sorted(bats, key=lambda x: x[1], reverse=True):
                la, lb = _lado_parecido(ga, b[3], b[4]), _lado_parecido(pe, b[3], b[4])
                if la and lb and la != lb:
                    if not b[5]:
                        b[5] = b[3] if la == 'a' else b[4]
                        b[6] = 'directa' if como.upper().startswith('DIRECT') else 'replica'
                        n += 1
                    break
    return n


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
#: «# MAKMA +3PTO», «# TOKIO+3»: quien suma 3 ganó directo; quien suma 2, en réplica (el +1 es del que perdió)
MAS_PUNTOS = re.compile(r'^#*\s*(.+?)\s*\+\s*([23])\s*(?:PTOS?|PTS?|PUNTOS?)?\s*$', re.I)
#: «# TEITO X LA MINIMA»
X_MINIMA = re.compile(r'^#*\s*(.+?)\s+X\s+LA\s+MINIMA\b', re.I)
CON_NUMERO = re.compile(r':\s*\d')


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
                # ⚠️ el mismo orden en `lineaK()` de bot/ligas_vivo.js: los casos de bot/ligas_vivo_casos.json los atan
                pt = re.sub(r'\s+', ' ', BANDERA.sub(' ', re.sub(r'^#+\s*', '', pl))).strip()
                mas = MAS_PUNTOS.match(pt)
                if mas:
                    lado = _quien(mas.group(1), b['a'], b['b'])
                    if lado:
                        b['gana'], b['como'] = b[lado], 'directa' if mas.group(2) == '3' else 'replica'
                    continue
                xm = X_MINIMA.match(pt)
                if xm:
                    lado = _quien(xm.group(1), b['a'], b['b'])
                    if lado:
                        b['gana'], b['como'] = b[lado], 'replica' if b['rep'] else 'directa'
                    continue
                # 🔴 «# MAKMA :28» es su puntaje, no que ganó: «# A :25 / # B :28» le daba la batalla al de arriba
                if CON_NUMERO.search(pt):
                    continue
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
#: 🔎 cómo se llama cada canal de una liga, para encontrarlo si se movió (y para sus vecinos)
NOMBRE_CANAL = {'ver': r'VEREDICT|RESULTADO', 'an': r'ANUNCIO|AVISOS|NOTICIA', 'tabla': r'TABLA'}


def ubicar(L, lst):
    """🔴 DÓNDE ESTÁ CADA CANAL DE UNA LIGA, de la lista de canales de su servidor (`GET /guilds/{g}/channels`).
    `{ver, an, tabla, vis, beat, voz, faltan, movidos}`.

    DDF rehízo sus canales el 01/11/2026 y sus 4 ligas se quedaron con ids muertos. `_mensajes()` contesta `[]` a un 404,
    lo guardado sigue ahí y la página se ve bien: **nada avisa**. Lo encontré cuatro días después, y por casualidad. Ahora:
    si un canal ya no está, se busca en la categoría de esa liga (`vre`) uno que se llame igual —lo resoluble se resuelve
    solo—, y si no aparece queda en `faltan`, que va al canal de Logs (`_avisar_canales()`).

    `vis`, `beat` y `voz` son sus vecinos, los de la misma categoría: no se escriben a mano, así no vuelven a quedar
    viejos. Son las señales del vigía (`bot/ligas_vivo.js`)."""
    por = {str(c.get('id')): c for c in lst}
    out = {'ver': L.get('ver') or '', 'an': L.get('an') or '', 'tabla': L.get('tabla') or ''}
    faltan = [q for q in ('ver', 'an', 'tabla') if out[q] and out[q] not in por]
    movidos = {}
    if faltan and L.get('vre'):
        cat = next((str(c['id']) for c in lst if c.get('type') == 4 and re.search(L['vre'], _plano(c.get('name')), re.I)), '')
        hijos = [c for c in lst if cat and str(c.get('parent_id') or '') == cat and c.get('type') in (0, 5)]
        for q in list(faltan):
            c = next((x for x in hijos if re.search(NOMBRE_CANAL[q], _plano(x.get('name')), re.I)), None)
            if c:
                out[q] = movidos[q] = str(c['id'])
                faltan.remove(q)
    ver = por.get(out['ver'])
    cat = str((ver or {}).get('parent_id') or '')
    herm = [c for c in lst if cat and str(c.get('parent_id') or '') == cat]

    def vecino(rx):
        return next((str(c['id']) for c in herm if c.get('type') in (0, 5) and re.search(rx, _plano(c.get('name')), re.I)), '')
    out['vis'], out['beat'] = vecino(r'VISUAL'), vecino(r'BEAT')
    out['voz'] = next((str(c['id']) for c in herm if c.get('type') in (2, 13)), '')
    out['faltan'], out['movidos'] = faltan, movidos
    return out


def mapa_canales(s, sin=()):
    """`{sv: {g, lst}}`, una lista de canales por servidor. Sin respuesta, ese servidor no está: no se avisa de nada.

    🆕 Los de las ligas y además los confirmados de la Liga: una liga nueva puede aparecer en un servidor que todavía no
    tiene ninguna (`descubrir()`). `sin`: los que tienen el beneficio de ligas apagado en el Dashboard."""
    try:
        with io.open(os.path.join(BASE, 'datos', 'servidores.json'), encoding='utf-8') as f:
            svs = json.load(f).get('servidores') or {}
    except (OSError, ValueError):
        return {}
    out = {}
    todos = {L['sv'] for L in LIGAS.values()} | {k for k, v in svs.items() if v.get('confirmado') and v.get('guild_id')}
    for sv in sorted(todos - set(sin or ())):
        g = str((svs.get(sv) or {}).get('guild_id') or '')
        if not g:
            continue
        try:
            r = s.get('https://discord.com/api/v10/guilds/%s/channels' % g, timeout=30)
            if r.status_code == 200:
                out[sv] = {'g': g, 'lst': r.json()}
        except Exception:                                # noqa: BLE001
            pass
        time.sleep(0.3)
    return out


def _avisar_canales(viejos, ubicados):
    """🔔 Al canal de Logs, una vez: los canales que se fueron y los que se encontraron solos. `viejos`: lo ya avisado."""
    lineas = []
    for lid, u in ubicados.items():
        n = LIGAS[lid]['n']
        nuevos = [q for q in u['faltan'] if q not in (viejos.get(lid) or [])]
        que = {'ver': 'los veredictos', 'an': 'los anuncios', 'tabla': 'la tabla'}
        if nuevos:
            lineas.append('🔴 **%s** · ya no existe el canal de %s' % (n, ' ni '.join(que[q] for q in nuevos)))
        if u.get('movidos'):
            lineas.append('✅ **%s** · se movió %s y lo encontré solo: `%s`' % (
                n, ' y '.join(que[q] for q in u['movidos']), ' '.join(u['movidos'].values())))
    if not lineas:
        return False
    try:
        import avisar
        return avisar.mandar('🏟️ Las ligas: cambiaron sus canales', lineas[:12])
    except Exception:                                    # noqa: BLE001
        return False


# ── 🆕 LAS LIGAS NUEVAS, SOLAS ──────────────────────────────────────────────────────────────────────────────────────
# Dlx, 11/11/2026: «asegúrate de que el bot detecte una nueva liga y la agregue automáticamente a la colección de ligas».
# Hasta ese día cada liga se escribía a mano en `LIGAS`, y la «𝑫𝑰𝑴𝑬𝑵𝑺𝑰𝑶𝑵 𝑾𝑶𝑹𝑫 𝑺𝑬𝑹𝑰𝑬𝑺 𝟐𝟔» de DDF arrancó sin que
# nadie la viera. Ahora `descubrir()` mira las categorías de cada servidor y la que tiene forma de liga entra sola.

#: 🔴 UNA CATEGORÍA ES UNA LIGA si tiene veredictos (o resultados), algo de liga (tabla, jornadas, line-up) y nada de
#: torneo con llave, y además su nombre dice liga —o tiene tabla Y jornadas—. Medido el 11/11/2026 sobre los seis
#: servidores con ligas: pasa sólo la de DDF; «FMS INTERNACIONAL» de FRZ es un torneo con llaves y «Torneos y Eventos» de
#: Urban, eventos
NUEVA_NOMBRE = re.compile(r'\b(?:LIGA|LEAGUE|FMS|FMH|SERIES|CHAMPIONS|DIVISION|CONFERENCE)\b', re.I)
NUEVA_VER = re.compile(r'VEREDICT|RESULTADO', re.I)
NUEVA_LIGA = re.compile(r'TABLA|JORNADA|LINE.?UP|ROSTER|FECHAS', re.I)
NUEVA_NO = re.compile(r'LLAVE|INSCRIPCI', re.I)
#: el canal de anuncios, en este orden: de ahí salen el flyer, la próxima fecha y el campeón
NUEVA_AN = ('ANUNCIO', 'NOTICIA', 'AVISO', 'INFO', 'FECHA')
#: cuántas batallas cerradas tiene que entender un lector para que la liga entre: con una sola puede ser casualidad
NUEVA_MIN = 2
#: 🌎 el país de una liga por su nombre, cuando no trae bandera: la hora de «hoy» y «el domingo» de sus anuncios
PAIS_DE = {'ESPANA': 'ES', 'PERU': 'PE', 'MEXICO': 'MX', 'TRICOLOR': 'CO', 'COLOMBIA': 'CO', 'ANDES': 'CL', 'CHILE': 'CL',
           'ALBICELESTE': 'AR', 'ARGENTINA': 'AR', 'VENEZUELA': 'VE', 'ECUADOR': 'EC', 'BOLIVIA': 'BO', 'URUGUAY': 'UY'}
_CONECTORES = {'de', 'del', 'la', 'las', 'los', 'el', 'y', 'en'}


def _lectores():
    """🧪 Los lectores que se prueban con una liga nueva: los que no piden más que los mensajes. Snake y FRZ comparten
    canal entre ligas y piden su emoji o su título, así que una de ésas se suma a mano."""
    return {'U': _u, 'D1': _d1, 'D2': _d2, 'FD': _fd, 'K': _lk}


def nombre_liga(cat):
    """El nombre de una categoría para mostrar: sin emojis ni adornos, con las letras de fantasía pasadas a normales y
    las siglas en mayúscula. «𝑫𝑰𝑴𝑬𝑵𝑺𝑰𝑶𝑵 𝑾𝑶𝑹𝑫 𝑺𝑬𝑹𝑰𝑬𝑺 𝟐𝟔 🌌» → «Dimension Word Series 26», como lo escribe DDF."""
    t = EMOJI.sub(' ', _letras(cat or ''))
    pal = [p for p in re.split(r'[^0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+', t) if p]
    out = []
    for i, p in enumerate(pal):
        if i and p.lower() in _CONECTORES:
            out.append(p.lower())
        elif len(p) <= 3 and p.isalpha():
            out.append(p.upper())
        else:
            out.append(p[:1].upper() + p[1:].lower())
    return ' '.join(out)[:40]


def _vre_de(n):
    """Un patrón para reconocer la liga por su nombre: su categoría si se mueve y el título de sus videos."""
    pal = [re.escape(p) for p in _plano(n).upper().split() if len(p) >= 3 and not p.isdigit()][:3]
    return r'\s+'.join(pal) or re.escape(_plano(n).upper())


def cc_de(nombre, sv, conocidas=None):
    """El país de una liga: la primera bandera de su categoría, si no su nombre (`PAIS_DE`), y si no el de la última liga
    de su servidor. `''` si no hay nada."""
    m = re.search('[\U0001F1E6-\U0001F1FF]{2}', nombre or '')
    if m:
        return ''.join(chr(ord(c) - 0x1F1E6 + 65) for c in m.group(0))
    p = _plano(nombre).upper()
    for k, v in PAIS_DE.items():
        if re.search(r'\b%s\b' % k, p):
            return v
    return next((L.get('cc') or '' for L in reversed(list((conocidas or LIGAS).values())) if L.get('sv') == sv), '')


def candidatas(sv, lst, conocidas=None):
    """🔎 Las categorías de un servidor con forma de liga que ninguna liga conocida usa: `[{cat, n, ver, an, tabla, cc}]`.
    `lst`: `GET /guilds/{g}/channels`. Ver `NUEVA_NOMBRE` para la regla."""
    conocidas = LIGAS if conocidas is None else conocidas
    usados = {str(L.get(q)) for L in conocidas.values() if L.get('sv') == sv for q in ('ver', 'an', 'tabla') if L.get(q)}
    cats = {str(L.get('cat')) for L in conocidas.values() if L.get('cat')}
    hijos = {}
    for c in lst or []:
        if c.get('type') in (0, 5) and c.get('parent_id'):
            hijos.setdefault(str(c['parent_id']), []).append(c)
    out = []
    for c in lst or []:
        cid = str(c.get('id'))
        if c.get('type') != 4 or cid in cats:
            continue
        hs = sorted(hijos.get(cid) or [], key=lambda x: x.get('position') or 0)
        if not hs or any(str(h['id']) in usados for h in hs):
            continue
        nom = [(h, _plano(h.get('name'))) for h in hs]
        ver = next((h for h, n in nom if NUEVA_VER.search(n)), None)
        if not ver or not any(NUEVA_LIGA.search(n) for _h, n in nom) or any(NUEVA_NO.search(n) for _h, n in nom):
            continue
        tb = next((h for h, n in nom if re.search('TABLA', n, re.I)), None)
        if not NUEVA_NOMBRE.search(_plano(c.get('name'))) and not (tb and any(re.search('JORNADA', n, re.I) for _h, n in nom)):
            continue
        an = next((h for rx in NUEVA_AN for h, n in nom if re.search(rx, n, re.I)), None)
        out.append({'cat': cid, 'n': nombre_liga(c.get('name')), 'ver': str(ver['id']), 'an': str(an['id']) if an else '',
                    'tabla': str(tb['id']) if tb else '', 'cc': cc_de(c.get('name'), sv, conocidas)})
    return out


def elegir_lector(msgs, preferida=''):
    """🧪 Qué lector entiende los veredictos de una liga nueva: `({familia: batallas cerradas}, la elegida o '')`. Gana el
    que cierra más, y con menos de `NUEVA_MIN` no gana ninguno: se vuelve a probar en la corrida siguiente.

    ⚠️ NO SE ADIVINA POR EL SERVIDOR. Medido el 11/11/2026 con la de DDF: el lector de LKR cerró 2 de 2 batallas, el de
    las otras ligas de DDF 1 y el de Titans 0. Cada liga escribe como quiere su host, no como su servidor."""
    n = {}
    for fam, f in _lectores().items():
        try:
            n[fam] = sum(1 for b in f(msgs or []) if b.get('gana') and not b.get('df') and not b.get('nulo'))
        except Exception:                                # noqa: BLE001
            n[fam] = 0
    mejor = max(n.values()) if n else 0
    if mejor < NUEVA_MIN:
        return n, ''
    cand = [f for f in n if n[f] == mejor]
    return n, (preferida if preferida in cand else cand[0])


def _id_nueva(sv, n, usados):
    base = '%s-%s' % (sv.lower(), re.sub(r'[^a-z0-9]+', '-', _plano(n).lower()).strip('-')[:32])
    lid, i = base, 2
    while lid in usados:
        lid, i = '%s-%d' % (base, i), i + 1
    return lid


#: 🆕 cada cuántas horas se vuelve a probar una liga encontrada que todavía no se lee: sus veredictos no cambian de
#: formato de una vuelta a la otra, y son pedidos a Discord
NUEVA_PROBAR_H = 6


def _desde_el_hueco(bats, dias=CIERRA_DIAS):
    """Las batallas desde el último parón de más de `dias` sin ninguna: la temporada que se está jugando. Para la primera
    lectura de una liga nueva —DDS canceló su temporada el 12/10 y anunció la vuelta: lo de antes no es de la que arranca—."""
    bs = sorted((b for b in bats or [] if b[1]), key=lambda b: b[1])
    corte = 0
    for i in range(1, len(bs)):
        a, b = _instante(bs[i - 1][1]), _instante(bs[i][1])
        if a and b and (b - a).days > dias:
            corte = i
    return bs[corte:]


def descubrir(s, mapa, viejas, ahora=None):
    """🆕 Las ligas nuevas: `{id: liga}` con las de antes. Una recién vista se guarda con `fam: ''` hasta que un lector la
    entienda (`elegir_lector()`) Y se esté jugando —algún resultado en las últimas `CIERRA_DIAS`—; ahí entra a `LIGAS` y
    se lee como las demás. La que no, se vuelve a probar cada `NUEVA_PROBAR_H`. `s`: la sesión de Discord (para leer sus
    veredictos), o `None` para no leer nada.

    ⚠️ Medido el 11/11/2026 en los 13 servidores: diez categorías con forma de liga que no estaban. Dos se leen —la de
    DDF, que arrancó esa semana, y la de DDS, cancelada el 12/10— y las ocho de FFS y FVS no las entiende ningún lector.
    Sin la regla de «se está jugando», la de DDS entraba con la temporada cancelada."""
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    ahora_s = ahora.strftime('%Y-%m-%dT%H:%M:%SZ')
    out = {k: dict(v) for k, v in (viejas or {}).items()}
    # 🧹 la que nunca se pudo leer y cuya categoría ya no está, se va: no era una liga, o se borró antes de jugarse
    for lid in list(out):
        m = (mapa or {}).get(out[lid].get('sv'))
        if m and not out[lid].get('fam') and str(out[lid].get('ver')) not in {str(c.get('id')) for c in m.get('lst') or []}:
            del out[lid]
    for sv, m in sorted((mapa or {}).items()):
        for c in candidatas(sv, m.get('lst'), dict(LIGAS, **out)):
            lid = _id_nueva(sv, c['n'], set(LIGAS) | set(out))
            out[lid] = dict(c, sv=sv, fam='', vre=_vre_de(c['n']), auto=True, visto=ahora.strftime('%Y-%m-%dT%H:%M:%SZ'))
            print('   🆕 liga nueva en %s: %s (categoría %s)' % (sv, c['n'], c['cat']))
    corte = (ahora - dt.timedelta(days=CIERRA_DIAS)).strftime('%Y-%m-%dT%H:%M:%SZ')
    otra_vez = (ahora - dt.timedelta(hours=NUEVA_PROBAR_H)).strftime('%Y-%m-%dT%H:%M:%SZ')
    for lid, L in out.items():
        if L.get('fam') or s is None or str(L.get('probado') or '') > otra_vez:
            continue
        pref = next((x.get('fam') for x in reversed(list(LIGAS.values())) if x.get('sv') == L['sv']), '')
        try:
            ms = _mensajes(s, L['ver'], 1)
            prueba, fam = elegir_lector(ms, pref)
        except Exception as e:                           # noqa: BLE001
            print('   ⚠️ no pude leer los veredictos de %s (%s)' % (L['n'], str(e)[:60]))
            continue
        L['prueba'], L['probado'] = prueba, ahora_s
        # 🎤 y que se esté jugando: lo último que cerró, de las últimas tres semanas
        ult = max((b['t'] for b in _lectores()[fam](ms) if b.get('gana') and b.get('t')), default='') if fam else ''
        L['quieta'] = bool(fam) and ult < corte
        if fam and ult >= corte:
            L['fam'], L['desde'] = fam, ahora_s
            L.pop('quieta', None)
            print('   🆕 %s se lee con el lector %s (%s)' % (L['n'], fam, prueba))
        elif fam:
            print('   💤 %s se lee con el lector %s, pero no se juega desde el %s: entra cuando vuelva' % (L['n'], fam, ult[:10]))
    return out


def marcar_fuera(nuevas, ruta=None):
    """🔴 La categoría de cada liga nueva, a `categorias_fuera` de su servidor (`datos/servidores.json`): de ahí leen el
    lector de eventos, el de anuncios y el vigía. Sin esto, sus veredictos se leerían como llaves de eventos —ya le pasó a
    Carimex con una «RÉPLICA FINAL»—. Sólo las que ya tienen lector: una que no es liga no le saca nada a los eventos.
    Devuelve las que agregó."""
    ruta = ruta or os.path.join(BASE, 'datos', 'servidores.json')
    try:
        with io.open(ruta, encoding='utf-8') as f:
            todo = json.load(f)
    except (OSError, ValueError):
        return []
    svs = todo.get('servidores') or {}
    puestas = []
    for lid, L in (nuevas or {}).items():
        x = svs.get(L.get('sv'))
        if not L.get('fam') or not L.get('cat') or x is None:
            continue
        cf = x.setdefault('categorias_fuera', {})
        ids = cf.setdefault('ids', [])
        if str(L['cat']) not in [str(i) for i in ids]:
            ids.append(str(L['cat']))
            puestas.append(lid)
    if puestas:
        with io.open(ruta, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(todo, f, ensure_ascii=False, indent=1)
            f.write('\n')
    return puestas


def _sumar_nuevas(ligas=None, d=None):
    """Las ligas nuevas que ya tienen lector, a `LIGAS`: las de arriba mandan si el id choca."""
    ligas = LIGAS if ligas is None else ligas
    nuevas = (d if d is not None else leer()).get('nuevas') or {}
    for lid, L in nuevas.items():
        if lid not in ligas and L.get('fam') in _lectores() and L.get('ver'):
            ligas[lid] = dict(L)
    return ligas


# ── 🏆 LAS TEMPORADAS DE CADA LIGA ──────────────────────────────────────────────────────────────────────────────────
# Dlx, 11/11/2026, a «temporadas de verdad» y «campeón sin preguntarte cuando el servidor lo anuncia»: «Sí, del 1 al 3».
# Hasta ese día cada liga era una sola lista de batallas: la T6 de FMH España se habría sumado a la tabla de la T5, y el
# «💍 ORTIZ CAMPEÓN DE FMH ESPAÑA T.5» de su servidor no lo leía nadie. Ahora una temporada se cierra cuando:
#   · su servidor anuncia el campeón (`campeon_en()`), en los veredictos o en los anuncios
#   · Dlx contesta quién ganó en ✅ Decidir, para el parón sin anuncio (`ligas_fin` de `datos/decisiones.json`)
#   · su servidor borra los canales de la liga (`ubicar()`): ahí también se pregunta quién ganó
# y la siguiente arranca con la primera batalla después del cierre.

CAMPEON = re.compile(r'\bCAMPEONA?\b', re.I)
#: 🔴 «CAMPEÓN» no alcanza. El día antes del de Ortiz, FMH España publicó «¿QUÉ NECESITA ORTIZ PARA SER CAMPEÓN…?», y al
#: arrancar la temporada «el actual campeón nacional viene a defender su título» y «CAMPEÓN ARGENTINO Y CAMPEÓN MUNDIAL».
#: Lo de FZ League es «EL HEPTACAMPEÓN DE LA FZ LEAGUE… ESTARÁ EN LA WORLD SERIES»: `\b` ya lo deja afuera
NO_CAMPEON = re.compile(r'[?¿]|\bPARA\s+SER\b|\bSER\b|\bSERA\b|\bSERIA\b|\bQUIEN\b|\bQUIER|\bNECESITA|\bBUSCA|\bDEFEND|'
                        r'\bACTUAL\b|\bVIGENTE\b|\bREINANTE\b|\bANTERIOR\b|\bPASAD[AO]\b|\bDEBUT|\bCANDIDAT|\bFAVORIT|'
                        r'\bEX\b|\bCONFIRMAD|\bPODRIA|\bPUEDE\b|\bSI\s+GANA|\bJORNADA\b|\bFECHA\b|\bDEL\s+DIA\b|'
                        r'\bNACIONAL\b|\bMUNDIAL\b|\bDEL\s+MUNDO\b|\bINTERNACIONAL\b', re.I)
TEMP_NUM = re.compile(r'\bT\s*\.?\s*(\d{1,2})\b|\bTEMPORADA\s*#?\s*(\d{1,2})\b|\bSEASON\s*(\d{1,2})\b', re.I)
#: ⏳ una batalla que se cierra después del anuncio del campeón —el veredicto que llega tarde, la fecha que faltaba— sigue
#: siendo de esa temporada si es de los días siguientes y entre dos de su tabla
GRACIA_DIAS = 7
#: 🏆 cuántas batallas con resultado tiene que llevar una temporada para que un «CAMPEÓN» la cierre: una que recién
#: arranca no tiene campeón, y quien ganó la anterior suele estar arriba de la nueva
CAMPEON_MIN = 6
#: cuántos caracteres puede haber entre «CAMPEÓN» y el nombre de la liga: «ORTIZ CAMPEÓN DE FMH ESPAÑA T.5» sí;
#: «ORTIZ, CAMPEÓN DE LA RED BULL, JUEGA HOY EN FMH ESPAÑA» no
CAMPEON_CERCA = 28


def _sin_marcas(t):
    """Un renglón para buscar: sin emojis propios, menciones ni markdown, en `_plano()` y en mayúsculas."""
    t = re.sub(r'<[@#][!&]?\d+>|https?://\S+', ' ', EMOJI.sub(' ', str(t or '')))
    return re.sub(r'[#*_~|`>]+', ' ', _plano(t)).upper()


def num_temporada(texto):
    """El número de temporada que dice un renglón («T.5», «TEMPORADA # 5», «SEASON 2»), o `None`."""
    m = TEMP_NUM.search(_sin_marcas(texto))
    return int(next(g for g in m.groups() if g)) if m else None


def _nombra(texto, nombre):
    """¿El texto nombra a esa persona? Por palabras enteras —«AL» no está en «FINAL»—, y juntando hasta cuatro seguidas:
    «MC KAN» es «MCKAN»."""
    k = clave(nombre)
    if not k:
        return False
    toks = [x for x in (clave(p) for p in EMOJI.sub(' ', _plano(texto)).split()) if x]
    for i in range(len(toks)):
        acc = ''
        for j in range(i, min(len(toks), i + 4)):
            acc += toks[j]
            if acc == k:
                return True
            if len(acc) >= len(k):
                break
    return False


def campeon_en(L, msgs, nombres, desde='', tn=None):
    """🏆 El campeón que anunció su servidor: `{t, msg, c, n, fuente}` o `None`. `msgs`: los mensajes de la liga
    (veredictos y anuncios, cada uno con su `canal`); `nombres`: los tres primeros de su tabla, que es entre quienes puede
    estar; `desde`: el arranque de la temporada (un anuncio de antes es de otra); `tn`: su número, si se sabe.

    Un renglón cuenta si dice CAMPEÓN sin ser pregunta ni otro título (`NO_CAMPEON`), si nombra a la liga pegado a esa
    palabra (`CAMPEON_CERCA`) —o es un renglón corto en su propio canal de anuncios—, si no es de otra temporada (el
    número) y si el nombre que trae es uno de esos tres. Gana el más nuevo.

    ⚠️ En el canal de veredictos sólo vale con el nombre de la liga: ahí escriben los jurados, y un «ORTIZ CAMPEÓN» de
    aliento a mitad de temporada la cerraría."""
    nombres = [n for n in nombres or [] if clave(n)]
    if not nombres:
        return None
    vre = L.get('vre') or ''
    for m in sorted(msgs or [], key=lambda m: int(m.get('id') or 0), reverse=True):
        if desde and str(m.get('t') or '') < desde:
            break
        if not _de_la_liga(L, m.get('content') or ''):
            continue
        for linea in str(m.get('content') or '').splitlines():
            t = _sin_marcas(linea)
            mc = CAMPEON.search(t)
            if not mc or NO_CAMPEON.search(t):
                continue
            cerca = any(0 <= mv.start() - mc.end() <= CAMPEON_CERCA or 0 <= mc.start() - mv.end() <= CAMPEON_CERCA
                        for mv in re.finditer(vre, t, re.I)) if vre else False
            propio = bool(L.get('an')) and m.get('canal') == L['an'] and not L.get('tit') and len(t.strip()) <= 90
            if not cerca and not propio:
                continue
            n = num_temporada(linea)
            if n and tn and n != tn:
                continue
            # el nombre va antes de «CAMPEÓN» («ORTIZ CAMPEÓN DE…») o después («CAMPEÓN: ORTIZ», «… ES EL CAMPEÓN»)
            antes, despues = t[:mc.start()], t[mc.end():]
            for trozo in (antes, despues):
                # el más largo primero: si están «SOL» y «SOL MC», gana «SOL MC»
                c = next((x for x in sorted(nombres, key=lambda x: -len(clave(x))) if _nombra(trozo, x)), None)
                if c:
                    return {'t': str(m.get('t') or ''), 'msg': str(m.get('id') or ''), 'canal': str(m.get('canal') or ''),
                            'c': c, 'n': n, 'fuente': 'anuncio'}
    return None


def num_actual(L, msgs, desde=''):
    """El número de la temporada que juega, el más alto que nombran sus mensajes desde `desde` («FMH ESPAÑA T.5 - TOLEDO
    J2»), o `None`. Sólo renglones que nombran a la liga: el canal de anuncios de FZ League habla de las 14 anteriores."""
    vre = L.get('vre') or ''
    ns = []
    for m in msgs or []:
        if desde and str(m.get('t') or '') < desde:
            continue
        for linea in str(m.get('content') or '').splitlines()[:3]:
            t = _sin_marcas(linea)
            if vre and re.search(vre, t, re.I):
                n = num_temporada(linea)
                if n and n < 60:
                    ns.append(n)
    return max(ns) if ns else None


def cierres_de(lid, x, decis=None):
    """Los cierres de temporada de una liga, del más viejo al más nuevo: `[{t, c, fuente, n, msg, p}]`. Los anunciados
    (`temps` de `datos/ligas.json`), los que Dlx contestó (`ligas_fin`, al final del día de su última batalla) y el de
    los canales borrados (`cerrada`)."""
    out = [dict(c) for c in (x or {}).get('temps') or [] if c.get('t')]
    for f in (_decis(decis).get(FIN) or []):
        if f.get('liga') == lid and f.get('ult'):
            out.append({'t': f['ult'] + 'T23:59:59Z', 'c': f.get('campeon') or '', 'p': f.get('podio') or [],
                        'fuente': 'dlx', 'n': None, 'msg': ''})
    cer = (x or {}).get('cerrada')
    if cer and cer.get('t'):
        out.append({'t': cer['t'], 'c': '', 'fuente': 'canales', 'n': None, 'msg': ''})
    return sorted(out, key=lambda c: c['t'])


def _temp(bats, c):
    c = c or {}
    return {'bats': bats, 'desde': bats[0][1] if bats else '', 'hasta': c.get('t') or '', 'c': c.get('c') or '',
            'p': c.get('p') or [], 'fuente': c.get('fuente') or '', 'n': c.get('n'), 'msg': c.get('msg') or ''}


def temporadas(bats, cierres):
    """Las batallas partidas por temporada, de la más vieja a la más nueva: `[{bats, desde, hasta, c, p, fuente, n}]`. La
    última no tiene `hasta` si sigue abierta. Un cierre sin batallas después (dos cierres seguidos: el de los canales y
    el que contestó Dlx) no arma una temporada vacía: la que cerró se queda con el que trae campeón, y si los dos lo
    traen, con el de Dlx —lo que contestó él manda sobre lo que se leyó—."""
    bs = sorted((b for b in bats or [] if b[1]), key=lambda b: b[1])
    cs = sorted((c for c in cierres or [] if c.get('t')), key=lambda c: c['t'])
    out, cur, i = [], [], 0

    def otro_cierre(c):
        if out and c.get('c') and (not out[-1]['c'] or (c.get('fuente') == 'dlx' and out[-1]['fuente'] != 'dlx')):
            out[-1].update({k: v for k, v in _temp(out[-1]['bats'], c).items() if k != 'bats'})
    for b in bs:
        while i < len(cs) and b[1] > cs[i]['t']:
            gr = _instante(cs[i]['t'])
            nombres = {clave(x) for y in cur for x in (y[3], y[4])}
            if cur and gr and _instante(b[1]) <= gr + dt.timedelta(days=GRACIA_DIAS) and \
                    clave(b[3]) in nombres and clave(b[4]) in nombres:
                break
            if cur:
                out.append(_temp(cur, cs[i]))
            else:
                otro_cierre(cs[i])
            cur, i = [], i + 1
        cur.append(b)
    while i < len(cs):
        if cur:
            out.append(_temp(cur, cs[i]))
            cur = []
        else:
            otro_cierre(cs[i])
        i += 1
    if cur:
        out.append(_temp(cur, None))
    return out


def actual_de(temps):
    """La temporada que se muestra: la última con algún resultado. Una que arrancó y todavía no tiene ninguno deja ver la
    que terminó, con su campeón, hasta su primer veredicto."""
    con = [t for t in temps or [] if any(b[5] for b in t['bats'])]
    return con[-1] if con else None


def _temporada_liga_global():
    try:
        import multiplicadores as MU
        return MU.temporada_actual()
    except Exception:                                    # noqa: BLE001
        return ''


def campeones(decis=None, d=None, resolver=None, ps=None, desde=None):
    """🏆 Las temporadas terminadas con campeón, para el Salón, las insignias y la publicación del campeón: las que Dlx
    contestó (`ligas_fin`) y las que anunció su servidor. `[{liga, n, sv, ult, temporada, lt, campeon, podio, t, fuente}]`.

    Si Dlx contestó la misma parada que después anunció el servidor, vale lo de Dlx: una sola fila por temporada. Y una
    temporada anunciada cuyas batallas ya no están (FZ League se queda sólo con la más nueva: `reemplaza`) sale con el
    podio que se guardó al anunciarse. ⚠️ La que terminó antes del arranque de la temporada de la Liga Global (`_desde()`)
    no entra: se ve en su liga, pero no da insignias ni va al Salón —lo mismo que ya no se le pregunta a Dlx—."""
    decis = _decis(decis)
    desde = (_desde() if desde is None else desde)[:10]
    out = [dict(x, fuente='dlx') for x in (decis.get(FIN) or []) if x.get('campeon')]
    ya = {(x.get('liga'), x.get('ult')) for x in out}
    d = d if d is not None else leer()
    r0 = None
    for lid, x in (d.get('ligas') or {}).items():
        anunc = [c for c in x.get('temps') or [] if c.get('c') and c.get('t')]
        if not anunc:
            continue
        if r0 is None:
            r0 = _resolvedor_de(resolver)
            ps = por_servidor() if ps is None else ps
        r = _de_servidor(x.get('sv'), r0, ps)
        L = LIGAS.get(lid) or {}
        vistos = set()
        base = {'liga': lid, 'n': x.get('n') or L.get('n') or lid, 'sv': x.get('sv') or L.get('sv') or '',
                'temporada': _temporada_liga_global(), 'fuente': 'anuncio'}
        for t in temporadas(x.get('batallas') or [], cierres_de(lid, x, decis)):
            if t['fuente'] != 'anuncio' or not t['c']:
                continue
            vistos.add(t['msg'])
            ult = ultima(t['bats'])
            if (lid, ult) in ya or (desde and ult < desde):
                continue
            tb = tabla(t['bats'], r)
            c = next((f[0] for f in tb if clave(f[0]) == clave(r(t['c']))), r(t['c']))
            out.append(dict(base, ult=ult, lt=t['n'], campeon=c, podio=podio([f[0] for f in tb], c), t=t['hasta']))
        for c in anunc:
            # sólo la que se quedó sin batallas: si las tiene, ya la armó `temporadas()` (con el de Dlx, si contestó)
            if c.get('msg') in vistos or (lid, c.get('ult')) in ya or (desde and (c.get('ult') or c['t'][:10]) < desde) or \
                    any(str(c.get('desde') or '') <= str(b[1] or '') <= c['t'] for b in x.get('batallas') or [] if b[1]):
                continue
            p = [r(n) for n in c.get('p') or [c['c']]]
            out.append(dict(base, ult=c.get('ult') or c['t'][:10], lt=c.get('n'), campeon=r(c['c']), podio=p, t=c['t']))
    return out


def para_vigia(d=None):
    """🏟️ Lo que lee el vigía para ver qué se mueve en cada liga: `{lista: [{id, n, sv, g, fam, ver, vis, beat, voz}]}`.
    Cambia sólo si una liga cambia de canales: una escritura de KV por cambio, no una por corrida."""
    return {'lista': ((leer() if d is None else d).get('vigia') or [])}


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
    viejo0 = leer()
    viejo = viejo0.get('ligas') or {}
    por_canal, por_an, por_tabla = {}, {}, {}
    ahora = dt.datetime.now(dt.timezone.utc)
    ahora_s = ahora.strftime('%Y-%m-%dT%H:%M:%SZ')
    # 🎛️ las de un servidor con el beneficio `ligas` apagado en el Dashboard no se leen ni se muestran (`bot/tiers.py`)
    try:
        import tiers as _TI
        sin_ligas = _TI.sin('ligas')
    except Exception:                                    # noqa: BLE001
        sin_ligas = set()
    # 🔴 dónde está cada canal hoy (`ubicar()`). Sin la lista, como están escritos, y sin avisar de nada
    mapa = mapa_canales(s, sin=sin_ligas)
    # 🆕 las ligas nuevas: las categorías con forma de liga (`descubrir()`), y la que ya tiene lector entra a `LIGAS` y se
    # lee abajo como las demás. Sin la lista de canales, las de antes
    ligas_nuevas = descubrir(s, mapa, viejo0.get('nuevas'), ahora) if mapa else \
        {k: dict(v) for k, v in (viejo0.get('nuevas') or {}).items()}
    _sumar_nuevas(LIGAS, {'nuevas': ligas_nuevas})
    decis = _decis()
    ubicados, vigia, anuncios_campeon = {}, [], []
    out = {}
    for lid, L in LIGAS.items():
        if L['sv'] in sin_ligas:
            continue
        m_sv = mapa.get(L['sv'])
        muerto = set()
        v = viejo.get(lid) or {}
        u = None
        if m_sv:
            u = ubicados[lid] = ubicar(L, m_sv['lst'])
            L = dict(L, ver=u['ver'], an=u['an'], tabla=u['tabla'])
            muerto = {L.get(q) for q in u['faltan']}
            if L['fam'] in FAM_VIGIA and 'ver' not in u['faltan']:
                vigia.append({'id': lid, 'n': L['n'], 'sv': L['sv'], 'g': m_sv['g'], 'fam': L['fam'], 'ver': u['ver'], 'vis': u['vis'],
                              'beat': u['beat'], 'voz': u['voz']})
        # 🔚 SUS CANALES YA NO ESTÁN: la temporada terminó (`cierres_de()`). Se anota la primera vez que se ve y se va si
        # vuelven. Sin la lista de canales, lo de antes
        if u is None:
            cer = v.get('cerrada')
        elif 'ver' in u['faltan']:
            cer = v.get('cerrada') or {'t': ahora_s, 'fuente': 'canales'}
        else:
            cer = None
        guardadas = {b[0]: b for b in v.get('batallas') or []}
        if L['ver'] in muerto:
            por_canal.setdefault(L['ver'], [])
        if L['ver'] not in por_canal:
            # la primera vez con el PTB (17/10/2026) se lee la temporada entera, como la primera vez de todas: sin eso
            # las jornadas viejas no tendrían MVP
            primera = not guardadas or 'ptb' not in v
            por_canal[L['ver']] = _mensajes(s, L['ver'], PAGINAS_PRIMERA if primera else PAGINAS)
            time.sleep(0.3)
        antes = dict(guardadas) if lid in viejo else None
        ptb = dict(v.get('ptb') or {})
        nuevas = leer_liga(lid, por_canal[L['ver']], ptb)
        # 🆕 la primera lectura de una liga que se encontró sola: sólo la temporada que se juega (`_desde_el_hueco()`)
        if L.get('auto') and not guardadas:
            nuevas = _desde_el_hueco(nuevas)
        if L.get('reemplaza') and nuevas:
            # 🔱 la temporada más nueva entera, sin lo guardado de la anterior (ver `_f()`)
            guardadas = {}
        for b in nuevas:
            # la que se vuelve a leer reemplaza a la guardada: pudo cerrarse después
            guardadas[b[0]] = b
        bats = [guardadas[k] for k in sorted(guardadas, key=_orden)]
        # 📋 las FMH publican un RESUMEN con su tabla: cierra lo que el canal de veredictos dejó pendiente (`u_resumen()`)
        if L['fam'] == 'U' and L.get('tabla') and L['tabla'] not in muerto and any(not b[5] for b in bats):
            if L['tabla'] not in por_tabla:
                por_tabla[L['tabla']] = _mensajes(s, L['tabla'], 1, limite=30)
                time.sleep(0.3)
            u_resumen(por_tabla[L['tabla']], bats)
        js = [b[2] for b in bats if b[2]]
        # 📢 el canal de anuncios: el flyer y la próxima fecha (un pedido por canal; Snake Rap comparte el suyo)
        an = L.get('an')
        if an and an not in por_an and an not in muerto:
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
        # 🏆 LAS TEMPORADAS (`temporadas()`): la abierta se cierra sola cuando su servidor anuncia el campeón
        # (`campeon_en()`), en los veredictos o en los anuncios. Lo anunciado se guarda: el mensaje sale de la ventana
        # que se lee, y la temporada tiene que seguir cerrada
        temps = [dict(c) for c in v.get('temps') or []]
        msgs = [dict(m, canal=L['ver']) for m in por_canal.get(L['ver']) or []] + [dict(m, canal=an) for m in ms_an]
        ts = temporadas(bats, cierres_de(lid, {'temps': temps, 'cerrada': cer}, decis))
        abierta = ts[-1] if ts and not ts[-1]['hasta'] else None
        tn = v.get('tn')
        if abierta:
            tn = num_actual(L, msgs, abierta['desde']) or (tn if str(v.get('tn_desde') or '') == abierta['desde'] else None)
            tb_a = tabla(abierta['bats'])
            camp = None
            if not cer and sum(1 for b in abierta['bats'] if b[5]) >= CAMPEON_MIN:
                camp = campeon_en(L, msgs, [f[0] for f in tb_a[:3]], abierta['desde'], tn)
            if camp:
                c = dict(camp, n=camp.get('n') or tn, p=podio([f[0] for f in tb_a], camp['c']),
                         ult=ultima(abierta['bats']), desde=abierta['desde'])
                temps.append(c)
                anuncios_campeon.append((lid, L, c))
                print('   🏆 %s: %s campeón%s, lo anunció su servidor (%s)' % (
                    L['n'], c['c'], (' de la T%s' % c['n']) if c.get('n') else '', c['t'][:16]))
        if temps:
            out[lid]['temps'] = temps
        if tn:
            out[lid]['tn'], out[lid]['tn_desde'] = tn, abierta['desde'] if abierta else v.get('tn_desde') or ''
        if cer:
            out[lid]['cerrada'] = cer
        con = sum(1 for b in bats if b[5])
        print('   %-26s %3d batalla(s), %3d con resultado%s%s%s' % (
            L['n'], len(bats), con, (' · jornada %d' % max(js)) if js else '',
            (' · próxima: %s%s' % (prox['d'], ' ' + prox['t'][11:16] + ' UTC' if prox.get('t') else '')) if prox else '',
            ' · 🔚 sin canales' if cer else ''))
    d = {'_leeme': 'Las ligas de los servidores: cada batalla y su resultado, y la tabla que sale de eso. Lo arma '
                   'bot/ligas.py en cada corrida; las reglas viven ahí. Sin los mensajes: el repo es público. '
                   '`batallas`: [id del mensaje, instante, jornada, a, b, ganador (vacío: pendiente), directa|replica, '
                   'extras]. Las batallas con resultado cuentan como duelos (Ranking Duelos y Win%; el Score no). '
                   '`flyer`: el último afiche de su canal de anuncios, re-alojado en R2 (`url`); `prox`: la próxima '
                   'fecha que anunció (`d` el día, `t` el instante si lo dijo). Desde el 17/10/2026: `ptb` {id de la '
                   'batalla: [PTB de a, de b]}, `flyers` (la galería, en R2), `staff` [[discord_id, nombre, mensajes en '
                   'anuncios, en veredictos, último]] y `nov` (lo nuevo de las últimas horas, para «Seguir la liga»). '
                   'Desde el 11/11/2026: `temps` [{t, c, n, msg, p, ult, desde}] (cada campeón que anunció su servidor: '
                   'cierra esa temporada), `tn` (el número de la temporada que juega, si lo dice), `cerrada` {t} (sus '
                   'canales ya no están) y, arriba, `nuevas` (las ligas que el bot encontró solo: `fam` vacío hasta que '
                   'un lector entienda sus veredictos).',
         't': ahora_s, 'ligas': out}
    # 🆕 las ligas que se encontraron solas: las que todavía no se leen también, así no se vuelven a anunciar
    if ligas_nuevas:
        d['nuevas'] = ligas_nuevas
    # 🏟️ y lo del vigía de las batallas. Sin la lista de canales queda lo de antes: una lectura que falló no lo apaga
    d['vigia'] = vigia if mapa else (viejo0.get('vigia') or [])
    # 🔴 los canales que ya no están: en el archivo —es la memoria de lo avisado, sobrevive al runner—, y a Logs una vez
    viejos_f = viejo0.get('faltan') or {}
    d['faltan'] = {lid: u['faltan'] for lid, u in ubicados.items() if u['faltan']} if mapa else viejos_f
    for lid, u in ubicados.items():
        if u['faltan'] or u['movidos']:
            print('   🔴 %-24s sin %s%s' % (LIGAS[lid]['n'], ', '.join(u['faltan']) or '—', ' · movidos: %s' % u['movidos'] if u['movidos'] else ''))
    if aplicar and ubicados:
        _avisar_canales(viejos_f, ubicados)
    if aplicar:
        # 🔴 la categoría de cada liga nueva, afuera de los eventos (`marcar_fuera()`), y lo nuevo a Logs, una vez
        puestas = marcar_fuera(ligas_nuevas)
        if puestas:
            print('   🆕 afuera de los eventos: %s' % ', '.join(puestas))
        _avisar_novedades(ligas_nuevas, viejo0.get('nuevas') or {}, anuncios_campeon, mapa)
        with io.open(SALIDA, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(d, f, ensure_ascii=False, indent=1)
            f.write('\n')
    return d


def _avisar_novedades(nuevas, viejas, campeones_, mapa=None):
    """🔔 Al canal de Logs, una vez: las ligas que se encontraron solas (al verlas y cuando empiezan a leerse) y los
    campeones que anunció cada servidor, con el link al mensaje. Lo de antes está en `datos/ligas.json`, así que una
    corrida nueva no lo repite: una liga se avisa cuando cambia su `fam`, y un campeón, la corrida en que se lee."""
    lineas, no_entran = [], []
    for lid, L in sorted((nuevas or {}).items()):
        antes = viejas.get(lid)
        if L.get('fam') and not (antes or {}).get('fam'):
            lineas.append('🆕 **%s** (%s) · %sya se lee: sale en Ligas, con su tabla y sus cartas' % (
                L['n'], L['sv'], 'la encontré sola y ' if antes is None else ''))
        elif antes is None:
            no_entran.append('%s (%s%s)' % (L['n'], L['sv'], ', parada' if L.get('quieta') else ''))
    if no_entran:
        lineas.append('🔎 Vi %d más con forma de liga que todavía no entran: %s. Las paradas entran solas cuando vuelvan a '
                      'jugar; las otras, cuando sepa leer sus veredictos' % (len(no_entran), ', '.join(no_entran)))
    for lid, L, c in campeones_ or []:
        g = ((mapa or {}).get(L['sv']) or {}).get('g') or ''
        link = ' · https://discord.com/channels/%s/%s/%s' % (g, c.get('canal') or L.get('ver'), c['msg']) if g and c.get('msg') else ''
        lineas.append('🏆 **%s** · %s campeón%s, lo anunció su servidor: cierra la temporada%s' % (
            L['n'], c['c'], (' de la T%s' % c['n']) if c.get('n') else '', link))
    if not lineas:
        return False
    try:
        import avisar
        return avisar.mandar('🏟️ Las ligas: lo nuevo', lineas[:12])
    except Exception:                                    # noqa: BLE001
        return False


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
    tabla. Por eso es una pregunta (`decidir.ligas_terminadas()`).

    🏆 Desde el 11/11/2026, dos excepciones: la que tiene campeón porque lo anunció su servidor (`fin`) no se pregunta, y
    la que se quedó sin canales (`cerrada`) se pregunta ya, sin esperar las tres semanas: no va a volver por ahí."""
    decis = _decis(decis)
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    desde = _desde() if desde is None else desde
    out = []
    for L in (web or {}).get('ligas') or []:
        if L.get('fin'):
            continue
        v = _instante(L.get('vota')) if L.get('vota') else None
        if not L.get('cerrada') and (not v or v > ahora or L.get('prox')):
            continue
        ult = str(L.get('ult_t') or '')[:10]
        # una liga que paró antes de que arrancara la temporada no es de esta temporada (`_desde()`)
        if desde and str(L.get('ult_t') or '')[:19] < desde:
            continue
        if ult and not fin_de(decis, L['id'], ult) and not sigue_de(decis, L['id'], ult):
            out.append((L, ult))
    return out


def salon(decis=None, claves=None, d=None, resolver=None, ps=None, cps=None):
    """🏆 EL SALÓN DE CAMPEONES, para la página: `[{id, n, sv, temp, ult, c, p, ks, lt}]`, el más nuevo primero. `p`: el
    podio entero (el campeón primero); `ks`: el perfil de cada nombre que lo tiene; `lt`: el número de esa temporada de
    la liga, si se sabe. Los que contestó Dlx y, desde el 11/11/2026, los que anunció su servidor (`campeones()`)."""
    claves = {clave(k): v for k, v in (claves or {}).items() if clave(k)}
    out = []
    for x in (cps if cps is not None else campeones(decis, d, resolver, ps)):
        if not x.get('campeon'):
            continue
        p = x.get('podio') or [x['campeon']]
        y = {'id': x.get('liga'), 'n': x.get('n') or x.get('liga'), 'sv': x.get('sv') or '',
             'temp': x.get('temporada') or '', 'ult': x.get('ult') or '', 'c': x['campeon'], 'p': p,
             'ks': {n: claves[clave(n)] for n in p if claves.get(clave(n))}}
        if x.get('lt'):
            y['lt'] = x['lt']
        out.append(y)
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


def hitos(d=None, resolver=None, ps=None, desde=None, decis=None):
    """📣 Lo que el muro publica solo de cada liga, rehaciendo sus batallas EN ORDEN: `[{tipo, que, t, quien, liga, ln,
    sv, …}]`.

    · `invicto`: la batalla en que alguien llega a `INVICTO` ganadas sin perder ninguna (una vez por temporada).
    · `punta`: quién queda primero al cerrar cada día de batallas, solo —sin empate en puntos— y con `PUNTA_DESDE`
      jugadas; se publica cuando cambia. En la primera fecha la punta cambia en cada batalla: por eso las dos reglas.
    Los nombres, los de la tabla (`para_web()`): el del padrón, y el de ESE servidor si ahí es otra persona.
    ⚠️ La tabla se rehace con TODAS las batallas de esa temporada de la liga (`temporadas()`: la que arranca después de
    un campeón empieza de cero) —la punta tiene que ser la de la tabla que se ve—, pero sólo sale lo que pasó desde el
    arranque de la temporada de la Liga Global (`_desde()`)."""
    d = d if d is not None else leer()
    desde = _desde() if desde is None else desde
    r0 = _resolvedor_de(resolver)
    ps = por_servidor() if ps is None else ps
    decis = _decis(decis)
    out = []
    for lid, x in (d.get('ligas') or {}).items():
        todas = sorted((b for b in x.get('batallas') or [] if len(b) > 6 and b[5] and b[6] in PUNTOS and b[1]),
                       key=lambda b: b[1])
        if not todas:
            continue
        r = _de_servidor(x.get('sv'), r0, ps)
        base = {'tipo': 'ligahito', 'liga': lid, 'ln': x.get('n') or (LIGAS.get(lid) or {}).get('n') or lid,
                'sv': x.get('sv') or (LIGAS.get(lid) or {}).get('sv') or ''}
        for temp in temporadas(todas, cierres_de(lid, x, decis)):
            out += _hitos_de(temp['bats'], r, base)
    return [h for h in out if not desde or str(h.get('t') or '')[:19] >= desde]


def _hitos_de(bats, r, base):
    """Los hitos de UNA temporada de una liga (`hitos()`), con sus batallas en orden."""
    out = []
    canon = {}
    for f in tabla(bats, r):
        canon.setdefault(clave(f[0]), f[0])
    rc = lambda n: canon.get(clave(r(n)), r(n))  # noqa: E731
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
    return out


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


def tabla_temporada(lid, ult, d=None, resolver=None, ps=None, decis=None):
    """`[nombre, …]`: la tabla de la temporada de esa liga cuya última batalla fue el día `ult` (AAAA-MM-DD), con los
    nombres como en la página. Para el podio de la que Dlx da por terminada (`decidir._guardar_ligas()`): sin esto, la
    T6 de una liga que se volvió a parar se llevaría también los puntos de la T5. `[]` si no hay ninguna así; la tabla
    de la última temporada con resultados si no se dice `ult`."""
    d = d if d is not None else leer()
    x = (d.get('ligas') or {}).get(lid)
    if not x:
        return []
    r = _de_servidor(x.get('sv'), _resolvedor_de(resolver), por_servidor() if ps is None else ps)
    ts = [t for t in temporadas(x.get('batallas') or [], cierres_de(lid, x, decis)) if any(b[5] for b in t['bats'])]
    t = next((t for t in reversed(ts) if ultima(t['bats']) == ult), None) if ult else (ts[-1] if ts else None)
    return [f[0] for f in tabla(t['bats'], r)] if t else []


def campeones_hitos(decis=None, d=None, resolver=None, ps=None):
    """📣 Y el campeón de cada liga terminada, cuando Dlx lo confirmó o lo anunció su servidor: la publicación del Salón."""
    out = []
    for x in campeones(decis, d, resolver, ps):
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
    🏆 Y desde el 11/11/2026, POR TEMPORADA (`temporadas()`): cada liga muestra la última con resultados —con `lt`, su
    número si lo dijo; `fin` `{c, p, f}` también si el campeón lo anunció su servidor (`f`: anuncio | dlx), y `cerrada`
    si sus canales ya no están— y `temps` [{id, lt, c, d, h}], las de antes. Esas van enteras, como una liga más, en
    `completadas` (id `<liga>~<día de su primera batalla>`, con `liga`, `desde`, `hasta` y `fl`): el álbum «Ligas
    completadas» de la página y sus cartas, que ya no cambian.
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
    nov_web, comp = [], []

    def _una(lid, x, L, r, g, bats, temp, cid=''):
        """Una temporada de una liga, como la ve la página. `temp`: la de `temporadas()`; `cid`: el id de una temporada
        TERMINADA que no es la que se muestra (`<liga>~<día de su primera batalla>`), para «Ligas completadas»."""
        con = [b for b in bats if b[5]]
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
        js = [b[2] for b in bats if b[2]]
        y = {'id': cid or lid, 'n': x.get('n'), 'sv': x.get('sv'), 'j': max(js) if js else None, 'bat': len(con),
             'pend': len(bats) - len(con), 'ult_t': con[-1][1],
             'tabla': tb, 'ult': ult, 'fechas': fechas, 'ks': ks,
             'link': 'https://discord.com/channels/%s/%s' % (g, L.get('tabla')) if g and L.get('tabla') else ''}
        # 🔢 el número de esa temporada de la liga, si lo dijo: el del cierre, o el que se leyó mientras se jugaba
        lt = (temp or {}).get('n') or (x.get('tn') if temp and str(x.get('tn_desde') or '') == temp['desde'] else None)
        if lt:
            y['lt'] = lt
        # 🏆 terminada: el campeón y el podio —lo anunció su servidor o lo contestó Dlx—, o sólo que terminó (sus canales ya
        # no están: el campeón se le pregunta a Dlx)
        if temp and temp['hasta']:
            if temp['c']:
                c = rc(temp['c'])
                p = [rc(n) for n in temp['p']] if temp['p'] else podio([f[0] for f in tb], c)
                y['fin'] = {'c': c, 'p': p[:3], 'f': temp['fuente']}
            else:
                y['cerrada'] = temp['hasta']
        # 🔚 y si sus canales ya no están, sus links a Discord tampoco: un link que da «canal desconocido» no se muestra
        if x.get('cerrada'):
            y['link'] = ''
        if cid:
            y.update({'liga': lid, 'desde': temp['desde'], 'hasta': temp['hasta']})
            # 🖼️ su flyer: el último de la galería que es de esa temporada
            t0 = _instante(temp['desde'])
            d0 = (t0 - dt.timedelta(days=30)).strftime('%Y-%m-%dT%H:%M:%SZ') if t0 else ''
            fl = next((f for f in sorted(x.get('flyers') or [], key=lambda f: f.get('t') or '', reverse=True)
                       if f.get('url') and d0 <= str(f.get('t') or '') <= temp['hasta']), None)
            if fl:
                y['fl'] = fl['url']
            return y
        # 🖼️ el flyer, sólo si está en R2 (el de Discord vence) y con el link a su mensaje
        fl = x.get('flyer') or {}
        if fl.get('url'):
            y['flyer'] = {'u': fl['url'], 'w': fl.get('w') or 0, 'h': fl.get('h') or 0, 't': fl.get('t') or '',
                          'tit': fl.get('tit') or '',
                          'link': 'https://discord.com/channels/%s/%s/%s' % (g, L['an'], fl['id']) if g and L.get('an') and not x.get('cerrada') else ''}
        # 🗓️ la próxima fecha, si todavía no pasó (en el día de la liga)
        pr = x.get('prox') or {}
        if pr.get('d') and pr['d'] >= ahora.astimezone(z).date().isoformat():
            y['prox'] = {'d': pr['d'], 't': pr.get('t') or '', 'j': pr.get('j'),
                         'link': 'https://discord.com/channels/%s/%s/%s' % (g, L['an'], pr['id'])
                         if g and L.get('an') and not x.get('cerrada') and pr.get('id') else ''}
        # 🗳️ hasta cuándo se vota quién gana: hace falta una tabla de dos o más para elegir. La que terminó cierra al
        # terminar, y no se borra: la página sigue mostrando cómo votó la gente, y el Worker contesta «cerrada»
        y['vota'] = vota(bats, pr if pr.get('d') else None) if len(tb) >= 2 else ''
        if y['vota'] and temp and temp['hasta']:
            y['vota'] = min(y['vota'], temp['hasta'])
        # 📜 el link al veredicto de cada batalla: el canal, y la página le suma el mensaje
        if g and L.get('ver') and not x.get('cerrada'):
            y['vlink'] = 'https://discord.com/channels/%s/%s/' % (g, L['ver'])
        # 🖼️ la galería, sólo lo que está en R2
        fls = [{'u': f['url'], 'w': f.get('w') or 0, 'h': f.get('h') or 0, 't': f.get('t') or '', 'tit': f.get('tit') or '',
                'link': 'https://discord.com/channels/%s/%s/%s' % (g, L['an'], f.get('msg') or f['id'].split('-')[0])
                if g and L.get('an') and not x.get('cerrada') else ''} for f in x.get('flyers') or [] if f.get('url')]
        if fls:
            y['flyers'] = fls
        # 🧑‍⚖️ el staff: el nombre de la Lista y su perfil si está; si no, el de Discord
        # ⚠️ quien JUEGA esta liga y no publica anuncios no es staff: comenta sus batallas en el canal de veredictos
        # (Guty en FMH Under, Forza en Carimex). Y con pocos mensajes, tampoco: hace falta haber organizado (2 anuncios)
        # o juzgado (3 veredictos)
        juegan = {clave(f[0]) for f in tabla(x.get('batallas') or [], r)}
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
        por_id = {b[0]: b for b in x.get('batallas') or []}
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
        return y

    for lid, x in ls.items():
        todas = x.get('batallas') or []
        if not any(b[5] for b in todas):
            continue
        L = LIGAS.get(lid) or {}
        r = _de_servidor(x.get('sv'), r0, ps)
        g = (svs.get(x.get('sv')) or {}).get('guild_id')
        # 🏆 LAS TEMPORADAS (11/11/2026): se muestra la última con resultados —la que terminó se sigue viendo, con su
        # campeón, hasta el primer veredicto de la siguiente— y las de antes van a «Ligas completadas»
        ts = [t for t in temporadas(todas, cierres_de(lid, x, decis)) if any(b[5] for b in t['bats'])]
        act = ts[-1] if ts else None
        y = _una(lid, x, L, r, g, act['bats'] if act else todas, act)
        viejas = []
        for t in ts[:-1]:
            if not t['hasta']:
                continue
            c = _una(lid, x, L, r, g, t['bats'], t, cid='%s~%s' % (lid, t['desde'][:10]))
            comp.append(c)
            viejas.append({k: v for k, v in (('id', c['id']), ('lt', c.get('lt')), ('c', (c.get('fin') or {}).get('c')),
                                             ('d', t['desde'][:10]), ('h', t['hasta'][:10])) if v})
        if viejas:
            y['temps'] = viejas
        out.append(y)
    out.sort(key=lambda x: x['ult_t'], reverse=True)
    if not out:
        return None
    res = {'t': d.get('t'), 'ligas': out, 'nov': sorted(nov_web, key=lambda n: n['t'])}
    if comp:
        res['completadas'] = sorted(comp, key=lambda c: c['hasta'], reverse=True)
    sl = salon(decis, claves, d, r0, ps)
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
    SOLO_DET = ('fechas', 'flyer', 'ks', 'flyers', 'staff', 'vids', 'info', 'vlink', 'temps')
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
    # 🏆 las temporadas terminadas, enteras (`completadas`): sólo en el detalle, que la página pide al abrir Ligas
    if web.get('completadas'):
        det_out['comp'] = {c['id']: c for c in web['completadas']}
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
    # 🏔️ FMH Andes, 29/10/2026 (Zetryko: «que no me detecta… y aparte los puntos»): tres cierres que no se leían
    ok(lados('# MARTÍNEZ🇺🇾VS DEUX🇨🇱')[:2] == ('MARTÍNEZ', 'DEUX'), 'el VS pegado a la bandera abre la batalla')
    _an = _u([{'id': '1', 't': 't1', 'content': '# OEP 🇨🇴 VS ZETRYKO 🇨🇱'},
              {'id': '2', 't': 't2', 'content': '** OEP 🇨🇴 ** 20.5\n** ZETRYKO 🇨🇱 ** 29.5\n\n# 🎖️ GANADOR 🎖️ \n** ZETRYKO 🇨🇱 X 9 pts **'},
              {'id': '3', 't': 't3', 'content': '# DEUXS 🇨🇱 <:VSAzul:1> MAKMA 🇻🇪'},
              {'id': '4', 't': 't4', 'content': '# ⚔️ RÉPLICA ⚔️'},
              {'id': '5', 't': 't5', 'content': '**DEUXS 🇨🇱 : 🟢 +2**\nMAKMA 🇻🇪 : 🔴 +1\n**DEUXS 🇨🇱 GANA DESPUES DE DOS REPLICA.**'}])
    ok([(b['gana'], b['como']) for b in _an] == [('ZETRYKO', 'directa'), ('DEUXS', 'replica')],
       '«GANADOR · ZETRYKO X 9 pts» es directa y «GANA DESPUÉS DE DOS RÉPLICA» es en réplica', _an)
    _bs = [['9', '2026-09-16T02:27:51Z', 3, 'MARTYNEZ', 'FORZA', '', '', 'b'],
           ['8', '2026-10-21T23:13:57Z', 3, 'ZETRYCO', 'MCO', 'ZETRYCO', 'replica', 'b']]
    _n = u_resumen([{'content': '- MARTINEZ 🇺🇾 LE GANA A FORZA 🇻🇪🎮 DIRECTO.\n- MCO 🇦🇷 LE GANA A ZETRYCO 🇨🇱 DIRECTO.'}], _bs)
    ok(_n == 1 and _bs[0][5:7] == ['MARTYNEZ', 'directa'] and _bs[1][5] == 'ZETRYCO',
       'el RESUMEN del host cierra lo pendiente («MARTINEZ» es el «MARTYNEZ» del título) y nunca pisa lo leído', _bs)

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
    ok(not terminadas(wf, dfin, t9, desde='') and wf['ligas'][0]['fin'] == {'c': 'CEKO', 'p': ['CEKO', 'JUAS', 'R1'], 'f': 'dlx'}
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
    _self_check_temporadas(ok)
    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


def _self_check_temporadas(ok):
    """🏆 Las temporadas, el campeón que anuncia cada servidor y las ligas que el bot encuentra solo (11/11/2026)."""
    import tempfile
    L = dict(LIGAS['fmh-espana'])
    an, ver = L['an'], L['ver']
    nom = ['ORTIZ', 'CARLOSMO', 'JOSELIYO']
    t0 = '2026-08-28T00:00:00Z'

    def m(i, t, txt, canal):
        return {'id': str(i), 't': t, 'content': txt, 'canal': canal}
    # los dos renglones de verdad (11/11/2026)
    c1 = campeon_en(L, [m(10, '2026-11-11T14:57:31Z', '# <a:fuego_rojo:1>💍<:FMHESP:2> ORTIZ🇪🇸 CAMPEÓN<a:Trofeob:3>', an)],
                    nom, t0, 5)
    c2 = campeon_en(L, [m(11, '2026-11-11T12:04:24Z', '# <a:fuego_rojo:1>💍ORTIZ🇪🇸  CAMPEÓN DE FMH ESPAÑA<:FMHESP:2> T.5 2026💍',
                          ver)], nom, t0, 5)
    ok(bool(c1) and c1['c'] == 'ORTIZ' and c1['canal'] == an and bool(c2) and c2['c'] == 'ORTIZ' and c2['n'] == 5,
       'el campeón que anuncia su servidor: «ORTIZ CAMPEÓN» en sus anuncios, «ORTIZ CAMPEÓN DE FMH ESPAÑA T.5» en los '
       'veredictos', [c1, c2])
    trampas = [('# ¿QUE NECESITA ORTIZ PARA SER CAMPEÓN DE FMH ESPAÑA 🤔💍?', an),
               ('<@1>, el actual campeón nacional viene a defender su título de **FMH España**', an),
               ('ORTIZ, CAMPEÓN DE LA RED BULL CABRANA, JUEGA HOY EN FMH ESPAÑA', ver),
               ('ORTIZ CAMPEÓN', ver),
               ('Primera Batalla de la Jornada 7 en Segovia, ORTIZ el campeón de FMH España', an),
               ('ORTIZ CAMPEÓN DE FMH ESPAÑA T.4', ver),
               ('MATEO CAMPEÓN DE FMH ESPAÑA', ver),
               ('ORTIZ VA A SER CAMPEÓN DE FMH ESPAÑA', ver)]
    malas = [t for t, c in trampas if campeon_en(L, [m(20, '2026-11-10T00:00:00Z', t, c)], nom, t0, 5)]
    ok(not malas, 'y no lo es: una pregunta, «el actual campeón», otro título, el aliento de un jurado, una jornada, otra '
       'temporada, alguien que no está arriba, un «va a ser»', malas)
    ok(campeon_en(L, [m(30, '2026-08-20T00:00:00Z', '# ORTIZ CAMPEÓN DE FMH ESPAÑA', ver)], nom, t0) is None,
       'un anuncio de antes del arranque de esa temporada es de otra')
    ok(_nombra('LA FINAL DE HOY', 'AL') is False and _nombra('CAMPEÓN: MC KAN', 'MCKAN') and _nombra('ORTIZ🇪🇸 GANA', 'Ortiz'),
       'el nombre, por palabras enteras: «AL» no está en «FINAL», y «MC KAN» es «MCKAN»')
    ok(num_temporada('FMH ESPAÑA T.5 - TOLEDO J2') == 5 and num_temporada('TEMPORADA # 3') == 3
       and num_temporada('SEASON 2') == 2 and num_temporada('JORNADA 4') is None,
       'el número de la temporada: «T.5», «TEMPORADA # 3», «SEASON 2»; una jornada no')

    # 🏆 las temporadas: el campeón cierra la suya, el veredicto que llega tarde sigue en ella y la siguiente arranca de cero
    def b(i, dia, a, bb, g='', como='directa'):
        return [str(i), '2026-%sT20:00:00Z' % dia, None, a, bb, g, como if g else '', '']
    bs = [b(1, '10-01', 'A', 'B', 'A'), b(2, '10-02', 'C', 'D', 'C'), b(3, '10-03', 'A', 'C', 'A'),
          b(4, '10-06', 'B', 'D', 'B'), b(5, '10-20', 'E', 'F', 'E'), b(6, '10-21', 'A', 'E', '')]
    anuncio = {'t': '2026-10-05T12:00:00Z', 'c': 'A', 'p': ['A', 'B', 'C'], 'fuente': 'anuncio', 'n': 5, 'msg': '9',
               'ult': '2026-10-06', 'desde': bs[0][1]}
    ts = temporadas(bs, [anuncio])
    ok([[x[0] for x in t['bats']] for t in ts] == [['1', '2', '3', '4'], ['5', '6']] and ts[0]['c'] == 'A'
       and ts[0]['n'] == 5 and not ts[1]['hasta'],
       'las temporadas: el campeón cierra la suya; el veredicto que llega tarde entre dos de su tabla sigue en ella, y la '
       'siguiente arranca de cero', [[x[0] for x in t['bats']] for t in ts])
    ts2 = temporadas(bs[:4], [{'t': '2026-10-05T12:00:00Z', 'c': '', 'fuente': 'canales'},
                              {'t': '2026-10-06T23:59:59Z', 'c': 'B', 'p': ['B'], 'fuente': 'dlx'}])
    ts3 = temporadas(bs[:4], [anuncio, {'t': '2026-10-06T23:59:59Z', 'c': 'B', 'p': ['B'], 'fuente': 'dlx'}])
    ok(len(ts2) == 1 and ts2[0]['c'] == 'B' and len(ts3) == 1 and ts3[0]['c'] == 'B' and ts3[0]['fuente'] == 'dlx',
       'dos cierres seguidos no arman una temporada vacía: queda el que trae campeón, y si los dos, el de Dlx',
       [(t['c'], t['fuente']) for t in ts2 + ts3])
    ok(actual_de(temporadas(bs[:4] + [b(7, '10-20', 'E', 'F')], [anuncio]))['c'] == 'A',
       'la que terminó se sigue viendo hasta el primer resultado de la siguiente')

    # 🖥️ la página: la de ahora, y la que terminó en «Ligas completadas», con sus cartas aparte
    ahora = dt.datetime(2026, 10, 22, tzinfo=dt.timezone.utc)
    d1 = {'ligas': {'fmh-espana': {'n': 'FMH España', 'sv': 'URBF', 'batallas': bs, 'temps': [anuncio], 'tn': 6,
                                   'tn_desde': bs[4][1]}}}
    w = para_web(d1, claves={}, ps={}, ahora=ahora, resolver=lambda x: x, decis={})
    y, cid = w['ligas'][0], 'fmh-espana~2026-10-01'
    ok(y['id'] == 'fmh-espana' and y['bat'] == 1 and y['lt'] == 6 and 'fin' not in y
       and y['temps'] == [{'id': cid, 'lt': 5, 'c': 'A', 'd': '2026-10-01', 'h': '2026-10-05'}]
       and [(c['id'], c['fin']['c'], c['bat'], c['liga']) for c in w['completadas']] == [(cid, 'A', 4, 'fmh-espana')]
       and w['salon'][0]['c'] == 'A' and w['salon'][0].get('lt') == 5,
       'en la página, la temporada de ahora (`lt`), las de antes en `temps` y enteras en `completadas`, y su campeón en el '
       'Salón', str((y.get('temps'), w.get('completadas', [{}])[0].get('id'), w.get('salon'))))
    lob, det = separar(w)
    ok(det['comp'][cid]['tabla'][0][0] == 'A' and det['ligas']['fmh-espana']['temps'] and 'temps' not in lob['ligas'][0],
       'las terminadas y la lista de temporadas viajan en el detalle, no en el lobby')
    d2 = {'ligas': {'fmh-espana': {'n': 'FMH España', 'sv': 'URBF', 'batallas': bs[:4], 'temps': [anuncio], 'tn': 5,
                                   'tn_desde': bs[0][1]}}}
    a2 = dt.datetime(2026, 10, 8, tzinfo=dt.timezone.utc)
    w2 = para_web(d2, claves={}, ps={}, ahora=a2, resolver=lambda x: x, decis={})
    y2 = w2['ligas'][0]
    ok(y2['fin'] == {'c': 'A', 'p': ['A', 'B', 'C'], 'f': 'anuncio'} and y2['vota'] == '2026-10-05T12:00:00Z'
       and y2.get('lt') == 5 and 'completadas' not in w2 and not terminadas(w2, {}, a2, desde=''),
       'la que acaba de terminar se ve con su campeón y su podio, la encuesta cerró al terminar (y se sigue viendo) y no se '
       'le pregunta a Dlx', str(y2.get('fin')))
    d3 = {'ligas': {'fms-titans': {'n': 'FMS Titans', 'sv': 'DDF', 'batallas': bs[:4],
                                   'cerrada': {'t': '2026-10-08T00:00:00Z', 'fuente': 'canales'}}}}
    a3 = dt.datetime(2026, 10, 9, tzinfo=dt.timezone.utc)
    w3 = para_web(d3, claves={}, ps={}, ahora=a3, resolver=lambda x: x, decis={})
    ok(w3['ligas'][0]['cerrada'] == '2026-10-08T00:00:00Z' and 'fin' not in w3['ligas'][0]
       and [(x['id'], u) for x, u in terminadas(w3, {}, a3, desde='')] == [('fms-titans', '2026-10-06')],
       'sin canales: terminó, y se le pregunta a Dlx quién la ganó ya, sin esperar las tres semanas')
    dfin = {FIN: [{'liga': 'fmh-espana', 'n': 'FMH España', 'sv': 'URBF', 'ult': '2026-10-06', 'campeon': 'B',
                   'podio': ['B', 'A', 'C'], 't': '2026-10-09T00:00:00Z'}]}
    cp = campeones(dfin, d2, lambda x: x, {}, desde='')
    ok(len(cp) == 1 and cp[0]['campeon'] == 'B' and cp[0]['fuente'] == 'dlx',
       'si Dlx contestó la misma parada que anunció su servidor, una sola fila: la de Dlx', cp)
    ok(not campeones({}, d2, lambda x: x, {}, desde='2026-11-01T00:00:00')
       and campeones({}, {'ligas': {'fzl': {'n': 'FZ League', 'sv': 'FRZ', 'batallas': [], 'temps': [dict(anuncio, c='CEKO')]}}},
                     lambda x: x, {}, desde='')[0]['podio'] == ['A', 'B', 'C'],
       'lo que terminó antes del arranque de la Liga Global no da insignias; la anunciada que se quedó sin batallas (FZ '
       'League reemplaza la temporada) sale con el podio guardado')
    ok(tabla_temporada('fmh-espana', '2026-10-06', d=d1, resolver=lambda x: x, ps={}, decis={})[:2] == ['A', 'B']
       and tabla_temporada('fmh-espana', '2026-10-20', d=d1, resolver=lambda x: x, ps={}, decis={}) == ['E', 'F'],
       'el podio que pregunta ✅ Decidir sale de la tabla de ESA temporada')

    # 🆕 las ligas nuevas: qué categoría es una liga, quién la lee y qué entra
    lst = [{'id': '100', 'type': 4, 'name': '𝑫𝑰𝑴𝑬𝑵𝑺𝑰𝑶𝑵 𝑾𝑶𝑹𝑫 𝑺𝑬𝑹𝑰𝑬𝑺 𝟐𝟔 🌌'},
           {'id': '101', 'type': 0, 'parent_id': '100', 'name': '📢・noticias', 'position': 1},
           {'id': '102', 'type': 0, 'parent_id': '100', 'name': '⚖️・veredictos', 'position': 2},
           {'id': '103', 'type': 0, 'parent_id': '100', 'name': '🗓️・jornadas', 'position': 3},
           {'id': '200', 'type': 4, 'name': 'FMS INTERNACIONAL'},
           {'id': '201', 'type': 0, 'parent_id': '200', 'name': 'veredictos'},
           {'id': '202', 'type': 0, 'parent_id': '200', 'name': 'llaves'},
           {'id': '203', 'type': 0, 'parent_id': '200', 'name': 'tabla'},
           {'id': '300', 'type': 4, 'name': 'Torneos y Eventos'},
           {'id': '301', 'type': 0, 'parent_id': '300', 'name': 'resultados'},
           {'id': '302', 'type': 0, 'parent_id': '300', 'name': 'fechas'},
           {'id': '400', 'type': 4, 'name': 'LIGA VACÍA'},
           {'id': '500', 'type': 4, 'name': 'FMS TITANS'},
           {'id': '501', 'type': 0, 'parent_id': '500', 'name': 'veredictos'},
           {'id': '502', 'type': 0, 'parent_id': '500', 'name': 'tabla'}]
    conocidas = {'x': {'sv': 'DDF', 'ver': '501', 'cc': 'PE'}}
    cs = candidatas('DDF', lst, conocidas)
    ok([(c['cat'], c['n'], c['ver'], c['an'], c['tabla'], c['cc']) for c in cs] == [('100', 'Dimension Word Series 26', '102',
                                                                                    '101', '', 'PE')],
       'una liga nueva: veredictos, algo de liga y su nombre (en letras de fantasía); un torneo con llaves no, unos '
       '«Torneos y Eventos» no, una categoría vacía no, y la de una liga que ya está tampoco', cs)
    km = [{'id': str(3000 + i), 't': '2026-11-0%dT20:00:00Z' % (1 + i), 'content': x} for i, x in
          enumerate(['# ANA vs BETO', 'ANA 28 - BETO 25', 'GANADOR ANA', '# CARLA vs DANI', 'GANADOR DANI'])]
    n_k, fam = elegir_lector(km, 'K')
    ok(fam == 'K' and n_k['K'] == 2 and elegir_lector(km[:3], 'K')[1] == '',
       'el lector de una liga nueva es el que cierra más batallas; con una sola no alcanza', n_k)
    hb = [b(1, '09-01', 'A', 'B', 'A'), b(2, '09-05', 'C', 'D', 'C'), b(3, '10-20', 'E', 'F', 'E'), b(4, '10-22', 'G', 'H')]
    ok([x[0] for x in _desde_el_hueco(hb)] == ['3', '4'] and len(_desde_el_hueco(hb[:2])) == 2,
       'la primera lectura de una liga nueva empieza después de su último parón de más de tres semanas')
    a4 = dt.datetime(2026, 11, 11, tzinfo=dt.timezone.utc)
    nv = descubrir(None, {'DDF': {'g': '1', 'lst': lst}}, {'vieja': {'sv': 'DDF', 'ver': '999', 'fam': ''},
                                                          'leida': {'sv': 'DDF', 'ver': '998', 'fam': 'K'}}, a4)
    nueva = [v for v in nv.values() if v.get('cat') == '100']
    ok(len(nueva) == 1 and nueva[0]['fam'] == '' and nueva[0]['auto'] and nueva[0]['n'] == 'Dimension Word Series 26'
       and 'vieja' not in nv and 'leida' in nv,
       'lo que se encuentra se guarda sin lector hasta probarlo; la que nunca se leyó y ya no está, se va', sorted(nv))
    lg = {'x': {'n': 'X', 'sv': 'DDF', 'fam': 'K', 'ver': '1'}}
    _sumar_nuevas(lg, {'nuevas': {'x': {'fam': 'K', 'ver': '9'}, 'n1': {'n': 'N', 'sv': 'DDF', 'fam': 'K', 'ver': '2'},
                                  'n2': {'n': 'M', 'sv': 'DDF', 'fam': '', 'ver': '3'}}})
    ok(set(lg) == {'x', 'n1'} and lg['x']['ver'] == '1', 'a `LIGAS` entran las nuevas que ya se leen; las de arriba mandan')
    with tempfile.TemporaryDirectory() as tmp:
        ruta = os.path.join(tmp, 'servidores.json')
        with io.open(ruta, 'w', encoding='utf-8') as f:
            json.dump({'servidores': {'DDF': {'categorias_fuera': {'ids': ['1']}}}}, f)
        p1 = marcar_fuera({'a': {'sv': 'DDF', 'cat': '100', 'fam': 'K'}, 'b': {'sv': 'DDF', 'cat': '200', 'fam': ''}}, ruta)
        p2 = marcar_fuera({'a': {'sv': 'DDF', 'cat': '100', 'fam': 'K'}}, ruta)
        with io.open(ruta, encoding='utf-8') as f:
            ids = json.load(f)['servidores']['DDF']['categorias_fuera']['ids']
    ok(p1 == ['a'] and p2 == [] and ids == ['1', '100'],
       'la categoría de la liga nueva sale de los eventos: sólo la que ya se lee, y una vez', ids)


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
    # 🏟️ los mismos casos que el lector en vivo (`bot/ligas_vivo_prueba.mjs`): si un cierre se lee distinto, falla acá o allá
    with io.open(os.path.join(SCR, 'ligas_vivo_casos.json'), encoding='utf-8') as f:
        casos = json.load(f)['casos']
    LIGAS['_u'], LIGAS['_k'] = {'fam': 'U', 'n': 'U', 'sv': ''}, {'fam': 'K', 'n': 'K', 'sv': ''}
    for c in casos:
        ms = [{'id': str(i + 1), 't': '2026-11-04T00:00:%02dZ' % i, 'content': x} for i, x in enumerate(c['msgs'])]
        res = [[b[3], b[4], b[5], b[6]] for b in leer_liga('_u' if c['fam'] == 'U' else '_k', ms)]
        ok(res == c['res'], 'el mismo que el lector en vivo: ' + c['n'], res)
    del LIGAS['_u'], LIGAS['_k']
    # 🔴 un canal que se fue (`ubicar()`)
    lst = [{'id': '1', 'type': 4, 'name': '🌠 𝗙𝗠𝗦 WORLD SERIES T1'}, {'id': '2', 'type': 0, 'parent_id': '1', 'name': '『⚔️』𝘝𝘦𝘳𝘦𝘥𝘪𝘤𝘵𝘰𝘴'},
           {'id': '3', 'type': 0, 'parent_id': '1', 'name': '『📌』ANUNCIOS'}, {'id': '4', 'type': 0, 'parent_id': '1', 'name': '「👀」Visuales'},
           {'id': '5', 'type': 2, 'parent_id': '1', 'name': 'la llamada'}, {'id': '6', 'type': 0, 'parent_id': '1', 'name': '「💽」BEATS'}]
    L0 = {'vre': r'FMS\s+WORLD\s+SERIES', 'ver': '99', 'an': '98', 'tabla': '97'}
    u = ubicar(L0, lst)
    ok(u['ver'] == '2' and u['an'] == '3' and u['faltan'] == ['tabla'] and u['movidos'] == {'ver': '2', 'an': '3'}
       and (u['vis'], u['beat'], u['voz']) == ('4', '6', '5'),
       'un canal que se fue se busca en la categoría de su liga, aunque el nombre venga en letras de fantasía; lo que no '
       'aparece queda en `faltan`, y sus vecinos salen solos', u)
    u2 = ubicar({'vre': 'NADA', 'ver': '2', 'an': '', 'tabla': ''}, lst)
    u3 = ubicar({'vre': 'NADA', 'ver': '99', 'an': '', 'tabla': ''}, lst)
    ok(u2['faltan'] == [] and u2['movidos'] == {} and u3['faltan'] == ['ver'] and u3['vis'] == '',
       'si el canal está no se toca; sin su categoría, falta, y sin canal no hay vecinos', [u2, u3])


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


# 🆕 las ligas que el bot encontró solo (`descubrir()`), a `LIGAS`, para todo el que importa este módulo: la página, las
# cartas de liga, el muro y ✅ Decidir las ven igual que las escritas arriba
try:
    _sumar_nuevas()
except Exception:                                        # noqa: BLE001
    pass

if __name__ == '__main__':
    sys.exit(main())
