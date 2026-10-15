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
    'fmh-albiceleste': {'n': 'FMH Albiceleste', 'sv': 'URBF', 'fam': 'U', 'ver': '1511968616025952347',
                        'tabla': '1511968417412939897', 'an': '1511968150218866728', 'cc': 'AR'},
    'fmh-andes': {'n': 'FMH Andes', 'sv': 'URBF', 'fam': 'U', 'ver': '1511969253325017178',
                  'tabla': '1511969122961850448', 'an': '1511969014782365846', 'cc': 'CL'},
    'fmh-carimex': {'n': 'FMH Carimex', 'sv': 'URBF', 'fam': 'U', 'ver': '1511969585770004532',
                    'tabla': '1511969454794477598', 'an': '1511969434531528814', 'cc': 'MX'},
    'fmh-tricolor': {'n': 'FMH Tricolor', 'sv': 'URBF', 'fam': 'U', 'ver': '1511973074973626428',
                     'tabla': '1511972739215261917', 'an': '1511972607338221680', 'cc': 'CO'},
    'fmh-under': {'n': 'FMH Under', 'sv': 'URBF', 'fam': 'U', 'ver': '1527565480003637268',
                  'tabla': '1527565426622726236', 'an': '1527564677641404487', 'cc': 'VE'},
    'fmh-espana': {'n': 'FMH España', 'sv': 'URBF', 'fam': 'U', 'ver': '1511973539438399590',
                   'tabla': '1511973442033946644', 'an': '1512167830919839844', 'cc': 'ES'},
    'fms-titans': {'n': 'FMS Titans', 'sv': 'DDF', 'fam': 'D1', 'ver': '1551345471086272542',
                   'tabla': '1550947722385694871', 'an': '1551426096665337896', 'cc': 'PE'},
    'fms-peru': {'n': 'FMS Perú', 'sv': 'DDF', 'fam': 'D2', 'ver': '1556501721004376105',
                 'tabla': '1556501553609834557', 'an': '1556501776272724078', 'cc': 'PE'},
    'fms-tricolor': {'n': 'FMS Tricolor', 'sv': 'DDF', 'fam': 'D2', 'ver': '1557529352529387600',
                     'tabla': '1557528234885779587', 'an': '1557529416605761557', 'cc': 'CO'},
    'fms-world-series': {'n': 'FMS World Series', 'sv': 'DDF', 'fam': 'D2', 'ver': '1559218872547283096',
                         'tabla': '1559100558487584838', 'an': '1559219024947183726', 'cc': 'CO'},
    'snake-generations': {'n': 'Snake League Generations', 'sv': 'SR', 'fam': 'S', 'ver': '1167906700452446218',
                          'tabla': '1117080676416638977', 'emoji': 'snkliga', 'an': '1117081139702665236', 'cc': 'AR'},
    'snake-new-chapter': {'n': 'Snake New Chapter', 'sv': 'SR', 'fam': 'S', 'ver': '1167906700452446218',
                          'tabla': '1544074821506437140', 'emoji': 'newchapter', 'an': '1117081139702665236',
                          'cc': 'AR'},
    # 🔱 FRZ entró a la Liga el 14/10/2026 y Dlx decidió que su FZ LEAGUE va a Ligas, como las FMH. No tiene veredicto
    # por batalla: su canal «resultados» publica cada jornada entera ya cerrada («X VENCE DE MANERA DIRECTA A Y»), así
    # que `ver` es ese canal. `tit`: el encabezado de lo suyo (el mismo canal trae la FMS World Series de FRZ), y
    # `reemplaza`: se queda sólo la temporada más nueva, no se suma a lo guardado (cuando arranque la 17, la 16 se va)
    'fzl': {'n': 'FZ League', 'sv': 'FRZ', 'fam': 'F', 'ver': '961680549712396408', 'tabla': '845072946829721701',
            'an': '838599987280609300', 'cc': 'PE', 'tit': r'\bFZ\s+LEAGUE\b|\bFREESTYLE\s+ZONE\s+LEAGUE\b',
            'reemplaza': True},
}
#: 🗳️ la encuesta «¿quién gana la liga?» cierra a los tantos días sin batallas (y sin una fecha anunciada por delante):
#: es lo único que dice que una liga terminó. Ver `vota()`
CIERRA_DIAS = 21
#: la clave de KV que lee el Worker para validar cada voto (`validarVotoLiga()` en bot/avisos.js). Ver `para_kv()`
CLAVE_KV = 'ligas:votar'
#: 🖼️ el flyer re-alojado: a qué ancho se achica y con qué calidad (lo más grande que lo dibuja la página son ~520 px)
ANCHO_FLYER, CALIDAD_FLYER = 720, 82
#: cuántos mensajes del canal de anuncios se leen por corrida (uno solo pedido: el flyer y la fecha están arriba)
ANUNCIOS_LEER = 50
#: cuántas fechas (jornadas) de cada liga viajan a la página, las más nuevas
FECHAS_WEB = 8
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
    # «… - JORNADA 4» al final del título de FMH Under
    b = re.sub(r'\s*-\s*JORNADA\s*\d+.*$', '', b, flags=re.I)
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
            if PUNTAJE.search(sin):
                b['pts'] = True
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
                filas.append((limpio(mm.group(1)), int(mm.group(3)), '🎮' in l))
        if len(filas) != 2:
            continue
        (a, pa, ea), (b, pb, eb) = filas
        if not a or not b or {pa, pb} not in ({3, 0}, {2, 1}):
            continue
        gana = a if pa > pb else b
        bats.append({'id': m['id'], 't': m['t'], 'a': a, 'b': b, 'ea': ea, 'eb': eb, 'j': None,
                     'gana': gana, 'como': 'directa' if max(pa, pb) == 3 else 'replica'})
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


def leer_liga(lid, msgs):
    """Las batallas de una liga, de sus mensajes en orden: `[[id, iso, jornada, a, b, gana, como, extras]]`.

    `msgs`: `[{id, t (iso), content}]`, del más viejo al más nuevo. `extras`: `''`, `'a'`, `'b'` o `'ab'`."""
    L = LIGAS[lid]
    f = L['fam']
    bats = _u(msgs) if f == 'U' else _d1(msgs) if f == 'D1' else _d2(msgs) if f == 'D2' else \
        _f(msgs, L['tit']) if f == 'F' else _s(msgs, L['emoji'])
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
            out.append({'id': str(m['id']), 't': str(m.get('timestamp') or '')[:19] + 'Z', 'content': m.get('content') or '',
                        'adj': adj})
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
    for lid, L in LIGAS.items():
        guardadas = {b[0]: b for b in (viejo.get(lid) or {}).get('batallas') or []}
        if L['ver'] not in por_canal:
            por_canal[L['ver']] = _mensajes(s, L['ver'], PAGINAS if guardadas else PAGINAS_PRIMERA)
            time.sleep(0.3)
        nuevas = leer_liga(lid, por_canal[L['ver']])
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
        v = viejo.get(lid) or {}
        flyer = _flyer_nuevo(lid, flyer_de(L, ms_an), v.get('flyer'), aplicar)
        # sin el canal (Discord no contestó) queda la de antes; `para_web()` no muestra una que ya pasó
        prox = proxima_de(L, ms_an) if ms_an else v.get('prox')
        out[lid] = {'n': L['n'], 'sv': L['sv'], 'jornada': max(js) if js else None,
                    'batallas': bats, 'tabla': tabla(bats)}
        if flyer:
            out[lid]['flyer'] = flyer
        if prox:
            out[lid]['prox'] = prox
        con = sum(1 for b in bats if b[5])
        print('   %-26s %3d batalla(s), %3d con resultado%s%s' % (
            L['n'], len(bats), con, (' · jornada %d' % max(js)) if js else '',
            (' · próxima: %s%s' % (prox['d'], ' ' + prox['t'][11:16] + ' UTC' if prox.get('t') else '')) if prox else ''))
    d = {'_leeme': 'Las ligas de los servidores: cada batalla y su resultado, y la tabla que sale de eso. Lo arma '
                   'bot/ligas.py en cada corrida; las reglas viven ahí. Sin los mensajes: el repo es público. '
                   '`batallas`: [id del mensaje, instante, jornada, a, b, ganador (vacío: pendiente), directa|replica, '
                   'extras]. Las batallas con resultado cuentan como duelos (Ranking Duelos y Win%; el Score no). '
                   '`flyer`: el último afiche de su canal de anuncios, re-alojado en R2 (`url`); `prox`: la próxima '
                   'fecha que anunció (`d` el día, `t` el instante si lo dijo).',
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


def _fechas(bats, rc, z, tope=FECHAS_WEB):
    """Las batallas por FECHA, la más nueva primero: `[{j, d, t, b: [[a, b, ganador o '', directa|replica|'']]}]`.

    La fecha es la jornada si el veredicto la dice; si no (Albiceleste, Carimex, Snake Rap no la escriben), el día en
    que se cerró, en la hora de la liga. Las que no tienen cierre van con el ganador vacío: «sin cierre todavía»."""
    grupos, por = [], {}
    for b in bats:
        ins = _instante(b[1])
        dia = ins.astimezone(z).date().isoformat() if ins else ''
        k = ('j', b[2]) if b[2] else ('d', dia)
        g = por.get(k)
        if g is None:
            g = por[k] = {'j': b[2], 'd': dia, 't': b[1], 'b': []}
            grupos.append(g)
        g['d'], g['t'] = max(g['d'], dia), max(g['t'], b[1])
        g['b'].append([rc(b[3]), rc(b[4]), rc(b[5]) if b[5] else '', b[6] if b[5] else ''])
    grupos.sort(key=lambda g: g['t'], reverse=True)
    return grupos[:tope]


def para_web(d=None, claves=None, ps=None, ahora=None, resolver=None):
    """Lo de la pestaña «Ligas»: `{t, ligas: [{id, n, sv, j, bat, pend, tabla, ult, fechas, ks, link, flyer, prox,
    vota}]}`, o `None` sin nada.

    `tabla`: `[[nombre, jugadas, ganadas, puntos]]` (hasta 30); `ult`: las seis últimas con resultado,
    `[a, b, ganador, directa|replica, jornada]`; `fechas`: todas las batallas por jornada (`_fechas()`). Los nombres van
    por el padrón —y por el AKA de ESE servidor—, así la página los lleva al perfil. `ks`: `{nombre: clave del perfil}`
    de los que tienen perfil (`claves`: nombre de la Lista → clave), también del staff que no está en la tabla del
    lobby: sin eso la página no los encontraba (ForceGP).
    🏟️ Y desde el 14/10/2026: `flyer` `{u, w, h, t, tit, link}` (sólo el que está en R2), `prox` `{d, t, j, link}` (sólo
    si no pasó) y `vota` (hasta cuándo se vota quién gana; `''` si no hay tabla para votar).
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
        fechas = _fechas(bats, rc, z)
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
        out.append(y)
    out.sort(key=lambda x: x['ult_t'], reverse=True)
    return {'t': d.get('t'), 'ligas': out} if out else None


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
    for x in (leer(ruta).get('ligas') or {}).values():
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
       and lp['fechas'][1]['b'] == [['SOL', 'PIPAS', '', '']],
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
    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


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
