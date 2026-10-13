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
#: las separa el emoji del título del PTB OFICIAL
LIGAS = {
    'fmh-albiceleste': {'n': 'FMH Albiceleste', 'sv': 'URBF', 'fam': 'U', 'ver': '1511968616025952347',
                        'tabla': '1511968417412939897'},
    'fmh-andes': {'n': 'FMH Andes', 'sv': 'URBF', 'fam': 'U', 'ver': '1511969253325017178',
                  'tabla': '1511969122961850448'},
    'fmh-carimex': {'n': 'FMH Carimex', 'sv': 'URBF', 'fam': 'U', 'ver': '1511969585770004532',
                    'tabla': '1511969454794477598'},
    'fmh-tricolor': {'n': 'FMH Tricolor', 'sv': 'URBF', 'fam': 'U', 'ver': '1511973074973626428',
                     'tabla': '1511972739215261917'},
    'fmh-under': {'n': 'FMH Under', 'sv': 'URBF', 'fam': 'U', 'ver': '1527565480003637268',
                  'tabla': '1527565426622726236'},
    'fmh-espana': {'n': 'FMH España', 'sv': 'URBF', 'fam': 'U', 'ver': '1511973539438399590',
                   'tabla': '1511973442033946644'},
    'fms-titans': {'n': 'FMS Titans', 'sv': 'DDF', 'fam': 'D1', 'ver': '1551345471086272542',
                   'tabla': '1550947722385694871'},
    'fms-peru': {'n': 'FMS Perú', 'sv': 'DDF', 'fam': 'D2', 'ver': '1556501721004376105',
                 'tabla': '1556501553609834557'},
    'fms-tricolor': {'n': 'FMS Tricolor', 'sv': 'DDF', 'fam': 'D2', 'ver': '1557529352529387600',
                     'tabla': '1557528234885779587'},
    'fms-world-series': {'n': 'FMS World Series', 'sv': 'DDF', 'fam': 'D2', 'ver': '1559218872547283096',
                         'tabla': '1559100558487584838'},
    'snake-generations': {'n': 'Snake League Generations', 'sv': 'SR', 'fam': 'S', 'ver': '1167906700452446218',
                          'tabla': '1117080676416638977', 'emoji': 'snkliga'},
    'snake-new-chapter': {'n': 'Snake New Chapter', 'sv': 'SR', 'fam': 'S', 'ver': '1167906700452446218',
                          'tabla': '1544074821506437140', 'emoji': 'newchapter'},
}
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


def leer_liga(lid, msgs):
    """Las batallas de una liga, de sus mensajes en orden: `[[id, iso, jornada, a, b, gana, como, extras]]`.

    `msgs`: `[{id, t (iso), content}]`, del más viejo al más nuevo. `extras`: `''`, `'a'`, `'b'` o `'ab'`."""
    L = LIGAS[lid]
    f = L['fam']
    bats = _u(msgs) if f == 'U' else _d1(msgs) if f == 'D1' else _d2(msgs) if f == 'D2' else _s(msgs, L['emoji'])
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


# ── Discord ───────────────────────────────────────────────────────────────
def _mensajes(s, canal, paginas):
    """Los mensajes de un canal, del más viejo al más nuevo: `[{id, t, content}]`. Sólo lo que hace falta."""
    out, antes = [], None
    for _ in range(paginas):
        url = 'https://discord.com/api/v10/channels/%s/messages?limit=100%s' % (canal, '&before=' + antes if antes else '')
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
            out.append({'id': str(m['id']), 't': str(m.get('timestamp') or '')[:19] + 'Z', 'content': m.get('content') or ''})
        antes = str(ms[-1]['id'])
        if len(ms) < 100:
            break
        time.sleep(0.3)
    return sorted(out, key=lambda m: int(m['id']))


def leer(ruta=None):
    try:
        with io.open(ruta or SALIDA, encoding='utf-8') as f:
            return json.load(f) or {}
    except (OSError, ValueError):
        return {}


def correr(aplicar=False):
    import escuchar as E
    s = E.sesion()
    viejo = leer().get('ligas') or {}
    por_canal = {}
    out = {}
    for lid, L in LIGAS.items():
        guardadas = {b[0]: b for b in (viejo.get(lid) or {}).get('batallas') or []}
        if L['ver'] not in por_canal:
            por_canal[L['ver']] = _mensajes(s, L['ver'], PAGINAS if guardadas else PAGINAS_PRIMERA)
            time.sleep(0.3)
        for b in leer_liga(lid, por_canal[L['ver']]):
            # la que se vuelve a leer reemplaza a la guardada: pudo cerrarse después
            guardadas[b[0]] = b
        bats = [guardadas[k] for k in sorted(guardadas, key=int)]
        js = [b[2] for b in bats if b[2]]
        out[lid] = {'n': L['n'], 'sv': L['sv'], 'jornada': max(js) if js else None,
                    'batallas': bats, 'tabla': tabla(bats)}
        con = sum(1 for b in bats if b[5])
        print('   %-26s %3d batalla(s), %3d con resultado%s' % (L['n'], len(bats), con,
                                                               (' · jornada %d' % max(js)) if js else ''))
    d = {'_leeme': 'Las ligas de los servidores: cada batalla y su resultado, y la tabla que sale de eso. Lo arma '
                   'bot/ligas.py en cada corrida; las reglas viven ahí. Sin los mensajes: el repo es público. '
                   '`batallas`: [id del mensaje, instante, jornada, a, b, ganador (vacío: pendiente), directa|replica, '
                   'extras]. Las batallas con resultado cuentan como duelos (Ranking Duelos y Win%; el Score no).',
         't': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'ligas': out}
    if aplicar:
        with io.open(SALIDA, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(d, f, ensure_ascii=False, indent=1)
            f.write('\n')
    return d


def para_web(d=None):
    """Lo de la pestaña «Ligas»: `{t, ligas: [{id, n, sv, j, bat, pend, tabla, ult, link}]}`, o `None` sin nada.

    `tabla`: `[[nombre, jugadas, ganadas, puntos]]` (los diez primeros); `ult`: las seis últimas con resultado,
    `[a, b, ganador, directa|replica, jornada]`. Los nombres van por el padrón, así la página los lleva al perfil.
    ⚠️ Una liga sin batallas no va: ninguna sección se dibuja vacía."""
    d = d if d is not None else leer()
    ls = d.get('ligas') or {}
    if not ls:
        return None
    try:
        import motor as _MO
        r, _n = _MO._resolvedor()
    except Exception:                                    # noqa: BLE001
        r = lambda x: x                                  # noqa: E731
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
        g = (svs.get(x.get('sv')) or {}).get('guild_id')
        out.append({'id': lid, 'n': x.get('n'), 'sv': x.get('sv'), 'j': x.get('jornada'), 'bat': len(con),
                    'pend': len(bats) - len(con), 'ult_t': con[-1][1],
                    'tabla': tabla(bats, r)[:10],
                    'ult': [[r(b[3]), r(b[4]), r(b[5]), b[6], b[2]] for b in con[-6:][::-1]],
                    'link': 'https://discord.com/channels/%s/%s' % (g, L.get('tabla')) if g and L.get('tabla') else ''})
    out.sort(key=lambda x: x['ult_t'], reverse=True)
    return {'t': d.get('t'), 'ligas': out} if out else None


def duelos(desde=None, ruta=None):
    """Para `rankings.agregar()`: `[(instante, a, b, ganador)]` de todas las ligas, con resultado y desde `desde`."""
    out = []
    for x in (leer(ruta).get('ligas') or {}).values():
        for _id, t, _j, a, b, gana, como, _ex in x.get('batallas') or []:
            if not gana or (desde and t < desde):
                continue
            try:
                ti = dt.datetime.fromisoformat(t.replace('Z', '+00:00'))
            except ValueError:
                continue
            out.append((ti, a, b, gana))
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
