# -*- coding: utf-8 -*-
"""✅ DECIDIR — LA HOJA QUE UNA PERSONA USA. La rehace el ciclo.

    python sheet/decidir.py             qué hay para decidir (no toca nada)
    python sheet/decidir.py --aplicar   aplica las respuestas y rehace la hoja
    python sheet/decidir.py --auto      self-check, sin tocar el Sheet

🔴 `Pendientes` NO SE USABA, Y TENÍA RAZONES. Dlx, 24/09/2026: *«es muy
confusa… por eso no la he usado»*. Medido ese día:

    76 abiertas, de las que 55 eran distintas (21 repetidas: un 429 se
    leía como «cola vacía» y la duda se volvía a escribir)
    42 resueltas mezcladas con las abiertas
    el panel de instrucciones partido en dos —pasos 1-3 en la fila 31,
    4-6 en la 123—, porque cada fila nueva se INSERTABA y lo empujaba
    las `alta` del bot pegadas debajo del panel, en otra tabla

Y lo principal: **contestar no hacía nada**. Su paso 6 decía «Alias → se
agrega a AKAs» y ningún proceso leía la columna `Resolución`. Una cola donde
contestar no cambia nada no se usa, y con razón.

ESTA HOJA ES LA OTRA MITAD
--------------------------
Una fila por pregunta, dicha en palabras; la respuesta se elige de una
lista; y el ciclo la **aplica**:

    «Es X»                 el nombre pasa a ser alias de X en la hoja AKAs
                           (o, si vino del bot, su Discord ID va a la fila
                           de X en la Lista de Raperos)
    «Es alguien nuevo»     se cierra: queda con su nombre
    «Sí cuenta» / «No»     la decisión sobre un evento queda en
                           `datos/decisiones.json` y el lector la respeta
    lo demás               se cierra con esa respuesta

⚠️ `Pendientes` QUEDA COMO REGISTRO. La escriben tres procesos —este repo,
el backfill del repo de sync y `registrar_ids.py`— y cambiarle la forma
rompería a los otros dos. `✅ Decidir` se rehace desde ella en cada corrida,
y lo que se decide acá vuelve a ella como `Resuelto`, con quién y qué.
"""
import collections
import datetime
import difflib
import hashlib
import io
import json
import os
import re
import sys
import unicodedata

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

HOJA = '✅ Decidir'
#: las filas de arriba son el título y cómo se usa; la tabla empieza abajo
FILA_CAB = 5
# 🔑 OCHO COLUMNAS Y NO NUEVE (28/09/2026): «Dónde apareció» pasó a ser el
# título de cada sección —el evento— y «Sugerencia» se volvió «Pistas», que
# junta lo que se sugiere con lo que se sabe de esa persona en la llave.
COLS = ['#', 'Tipo', 'Qué hay que decidir', 'Pistas',
        '✍️ RESPUESTA', '📝 NOTA', 'Estado', 'id']
# 🔴 LA COLUMNA DE NOTAS EXISTE PORQUE DLX ESCRIBIÓ EN «Sugerencia». El
# 24/09/2026, al usarla por primera vez: *«Existe elsolar y solar. Son
# personas diferentes. Solar es de Chile y su ID es 1155972121848201256»*,
# en la columna que el ciclo rehace cada media hora. Se perdía. Ahora lo
# que se escribe en 📝 NOTA se conserva de una corrida a la otra, y lo que
# se escriba igual en otra columna se rescata a la nota.
#
# ⚠️ LAS COLUMNAS SE BUSCAN POR SU NOMBRE AL LEER, no por posición: agregar
# ésta corrió `Estado` e `id`, y leer por número habría tomado las
# respuestas ya escritas como vacías — y la hoja rehecha las habría borrado.
C_RESP, C_NOTA, C_ESTADO, C_ID = 4, 5, 6, 7
POR = 'Dlx (✅ Decidir)'
DECISIONES = os.path.join(BASE, 'datos', 'decisiones.json')

#: cómo se muestra cada tipo de `Pendientes`, y en qué orden. Primero lo que
#: mueve puntos de un evento entero; después los nombres; al final identidad.
GRUPO = {
    # ❤️ el 5 vidas que el ciclo cargó solo desde #veredictos (Dlx, 28/09/2026:
    # «A y b»): se confirma o se saca. Va primero: ya suma puntos.
    'Vidas cargado': (0, '❤️ Vidas'),
    # 👯 el mismo evento cargado dos veces con dos números (Dlx, 07/10/2026): ya suma doble. Ver `duplicados_corrida()`
    'Evento duplicado': (0, '🏆 Evento'),
    'Batalla sin ganador': (0, '⚔️ Batalla'),
    'Bracket incompleto': (0, '🏆 Evento'),
    'Evento dudoso': (0, '🏆 Evento'),
    'Llave sin resolver': (0, '🏆 Evento'),
    # 📣 alguien avisó desde la página que algo de esa llave está mal (Dlx,
    # 28/09/2026: «ok»). Va con su evento. Ver `bot/reportes.py`.
    'Reporte': (0, '📣 Reporte'),
    'Nombre desconocido': (1, '👤 Nombre'),
    'alta': (2, '🪪 Identidad'),
    'ambiguo': (2, '🪪 Identidad'),
    'conflicto': (2, '🪪 Identidad'),
    'Alias posible': (2, '🪪 Identidad'),
    'MW pendiente': (3, '🎯 MW'),
}

#: 🔎 CUÁNTO PESA CADA PREGUNTA, para el filtro del Dashboard (Dlx, 13/10/2026: «filtros… nivel de importancia»).
#: alta: decide los puntos de un evento entero (si cuenta, si está dos veces, sin final, las vidas que ya suman);
#: media: una batalla o un nombre; baja: quién es quién y el Most Wanted, que no cambian cuántos puntos hay
IMPORTANCIA = {
    'Vidas cargado': 'alta', 'Evento duplicado': 'alta', 'Bracket incompleto': 'alta', 'Evento dudoso': 'alta',
    'Llave sin resolver': 'alta',
    'Batalla sin ganador': 'media', 'Nombre desconocido': 'media',
    'alta': 'baja', 'ambiguo': 'baja', 'conflicto': 'baja', 'Alias posible': 'baja', 'MW pendiente': 'baja',
}

NUEVO = 'Es alguien nuevo'
#: la batalla que no se peleó (un walkover sin nadie que pase, una anulada)
NO_SE_JUGO = 'No se jugó'
#: 🔑 LA BATALLA SE JUGÓ PERO NADIE SIGUIÓ (Dlx, 07/10/2026, la DEM UZBEKISTAN FECHA 1: *«Saz reemplazó a alguien, no
#: sé si RT o Jupiter ganó»*). En cuartos entraron Saz y Za de reemplazo, así que de tres octavos no pasó nadie y no se
#: sabe quién ganó. «No se jugó» los dejaba SIN el evento —jugaron—; esto los carga cobrando la ronda, como el que ganó y
#: no siguió (`cobra:`, Geoka, 02/10), y sin duelo: no se sabe quién ganó. Se guarda como ganador `NADIE`
NADIE_SIGUIO = 'Nadie siguió (cobran la ronda)'
NADIE = '(nadie siguió)'
#: entre los lados de una batalla, en el detalle de `Pendientes`
SEP_LADOS = ' 🆚 '
#: un nombre de broma que no es nadie: no entra a ningún ranking. Ver
#: `no_rankear()`.
TROLL = 'Es un troll (no cuenta)'
_BANDERA = re.compile('[\U0001F1E6-\U0001F1FF]{2}')


def norm(s):
    """Sólo letras y números, sin tildes: la clave de identidad del repo."""
    s = unicodedata.normalize('NFKD', str(s or ''))
    return ''.join(c for c in s if c.isalnum()).lower()


def clave(tipo, detalle):
    """El id estable de una pregunta: el mismo que deduplica la cola."""
    return hashlib.sha1(('%s|%s' % (tipo, str(detalle).strip()))
                        .encode('utf-8')).hexdigest()[:10]


def _sin_bandera(s):
    return re.sub(r'\s+', ' ', _BANDERA.sub('', str(s or ''))).strip()


def lado_limpio(x):
    """Un lado como lo escribe una pregunta, sin el rótulo de ronda que se le pegó: «⚔️ Semifinales: OASIS, LETRAO» es
    «OASIS, LETRAO» (LA REDENCION VOL.3, FFA, 10/10/2026). ⚠️ SÓLO UN RÓTULO DE RONDA: «tnr :Espana:» (FFA, 11/10)
    trae dos puntos y es un nombre."""
    t = str(x or '')
    m = list(_RONDA_EN_TEXTO.finditer(t))
    return (t[m[-1].end():] if m else t).strip()


def clave_lado(x):
    """La clave para comparar dos lados: sin rótulo, sin bandera, sólo letras y números."""
    return norm(_sin_bandera(lado_limpio(x)))


def banderas_de(x):
    """Las banderas de un nombre, ordenadas: «Volk 🇲🇽» → «🇲🇽»; sin bandera, `''`."""
    return ''.join(sorted(_BANDERA.findall(str(x or ''))))


def mismo_lado(a, b):
    """¿`a` y `b` son el mismo lado? La misma clave y, si los DOS traen bandera, la misma: «Volk 🇲🇽» no es «volk 🇨🇴»
    —dos raperos—, y «Volk» sin bandera es cualquiera de los dos (lo decide quien tenga una sola opción)."""
    if not clave_lado(a) or clave_lado(a) != clave_lado(b):
        return False
    fa, fb = banderas_de(a), banderas_de(b)
    return not (fa and fb) or fa == fb


#: las rondas de una llave, de la primera a la última (para «la última ronda»)
ORDEN_RONDAS = ['filtros', 'r32', 'octavos', 'cuartos', 'semifinal', 'final']


def ronda_canon(r):
    """«SEMIFINALES», «Semi-final», «⚔️ Semifinales» → `semifinal`; «Gran final» → `final`; lo que no reconoce, como
    venga (normalizado)."""
    k = norm(r)
    if 'semi' in k:
        return 'semifinal'
    if 'final' in k:
        return 'final'
    for pre, can in (('cuart', 'cuartos'), ('octav', 'octavos'), ('dieciseis', 'r32'), ('r32', 'r32'),
                     ('filtro', 'filtros')):
        if k.startswith(pre):
            return can
    return k


_RONDA_EN_TEXTO = re.compile(r'(?i)(gran\s+final|semi\s*-?\s*finales?|final|cuartos(?:\s+de\s+final)?|'
                             r'octavos(?:\s+de\s+final)?|dieciseisavos|filtros)\s*:')


def segmentos_llave(match):
    """`[(ronda, [lados], pasó)]` de las batallas que trae el «Posible match» de un «Bracket incompleto»
    («… | cuartos: A vs B | semifinales: C vs D · pasó C»). Si el texto trae su propio rótulo de ronda («cuartos: ⚔️
    Semifinales: OASIS, LETRAO vs Verc»), manda ése. `pasó`: el que ganó esa batalla según la llave, o `None`."""
    out = []
    for seg in [x.strip() for x in str(match or '').split(' | ')[1:] if x.strip()]:
        seg = re.sub(r'\s*·\s*https?://\S+\s*$', '', seg)
        m = re.match(r'([^:]+):\s*(.*)$', seg)
        if not m:
            continue
        ronda, txt = m.group(1).strip(), m.group(2)
        paso = None
        mp = re.search(r'\s*·\s*pas[oó]\s+(.+)$', txt)
        if mp:
            paso, txt = mp.group(1).strip(), txt[:mp.start()]
        emb = list(_RONDA_EN_TEXTO.finditer(txt))
        if emb:
            ronda = emb[-1].group(1)
        lados = [lado_limpio(x) for x in re.split(r'\s+vs\.?\s+', txt, flags=re.I) if lado_limpio(x)]
        if len(lados) >= 2:
            out.append((ronda_canon(ronda), lados, paso))
    return out


def ultima_ronda(match):
    """`(ronda, [(ronda, [lados], pasó)])`: la ÚLTIMA ronda que trae la pregunta y sus batallas, o `(None, [])`."""
    segs = [x for x in segmentos_llave(match) if x[0] in ORDEN_RONDAS]
    if not segs:
        return None, []
    ult = max((x[0] for x in segs), key=ORDEN_RONDAS.index)
    return ult, [x for x in segs if x[0] == ult]


def _candidatos_campeon(match):
    """Quiénes pueden haber salido campeones, de la última ronda: todos los lados de las batallas sin ganador y, de las
    que tienen, sólo el que pasó. Sin repetir, como los muestra la pregunta."""
    _ult, bats = ultima_ronda(match)
    out = []
    # ⚠️ CON SU BANDERA: «volk 🇨🇴» y «Volk 🇲🇽» son dos opciones, no una (`mismo_lado()`)
    for _r, lados, paso in bats:
        for x in ([paso] if paso else lados):
            if clave_lado(x) and not any(clave_lado(x) == clave_lado(y) and banderas_de(x) == banderas_de(y)
                                         for y in out):
                out.append(x)
    return out


#: cómo se dice cada ronda en la pregunta
_RONDA_DICHA = {'final': 'la final', 'semifinal': 'las semifinales', 'cuartos': 'los cuartos',
                'octavos': 'los octavos', 'r32': 'la primera ronda', 'filtros': 'los filtros'}


def como_cobra(ult):
    """🏆 Qué cobra cada uno si Dlx elige al campeón de un «Bracket incompleto» cuya última ronda es `ult`. Lo dicen la
    pregunta y la nota de la decisión, y lo hace `llaves_a_entrada.con_campeon()`: ⚠️ LOS TRES DICEN LO MISMO."""
    if ult == 'final':
        return 'cobra campeón y el otro, subcampeón'
    if ult == 'semifinal':
        return ('cobra campeón; el que ganó la otra semifinal, si la llave lo dice, cobra subcampeón, y los demás de las '
                'semifinales cobran esa ronda. Si la llave no dice quién llegó a la final del otro lado, ese lugar no lo '
                'cobra nadie')
    return ('cobra campeón, y todos los demás de %s cobran esa ronda, también los que ganaron su batalla (no se sabe '
            'hasta dónde siguieron). Las rondas que faltan después no las cobra nadie' % _RONDA_DICHA.get(ult, ult))


# ── la batalla sin ganador ──────────────────────────────────────────────
# 🔑 Dlx, 28/09/2026, sobre MARRUECOS EN VENTA —ocho batallas de octavos que
# el lector no pudo resolver—: «lo resuelvo yo… pero mejora esa página de
# decidir». Hasta acá una batalla sin ganador iba a `Pendientes` como «No
# pude leer estas batallas», con «La corrijo en Discord» y «Dejala así» de
# respuestas —o sea que no se podía resolver desde la hoja—, y encima se
# cerraba sola en cuanto el evento tenía campeón. Los que perdieron esas
# batallas no cobraban su ronda y nadie lo volvía a preguntar.
#
# ⚠️ LA CLAVE NO LLEVA BANDERAS NI MAYÚSCULAS, y los lados van ordenados:
# «Mau Kc 🇨🇴» y «MAU KC» son la misma batalla escrita dos veces.

def detalle_batalla(ev, sv, fecha, ronda, lados):
    """«EVENTO · SV · 26/09 · octavos · A 🆚 B»: cómo va en `Pendientes`."""
    return ' · '.join([str(ev or '').strip(), str(sv or ''), str(fecha or ''),
                       str(ronda or '').strip().lower(),
                       SEP_LADOS.join(str(x).strip() for x in lados)])


def partes_batalla(det):
    """`(evento, servidor, fecha, ronda, [lados])` de ese detalle, o None."""
    p = str(det or '').rsplit(' · ', 4)
    if len(p) != 5:
        return None
    lados = [x.strip() for x in p[4].split(SEP_LADOS.strip()) if x.strip()]
    return p[0].strip(), p[1].strip(), p[2].strip(), p[3].strip(), lados


def clave_batalla(det):
    """La clave de una batalla en `datos/decisiones.json`."""
    x = partes_batalla(det)
    if not x:
        return norm(det)
    ev, sv, fecha, ronda, lados = x
    return '|'.join([norm(ev), sv.upper(), fecha, norm(ronda)]
                    + sorted(norm(_sin_bandera(l)) for l in lados))


def decision_batalla(det):
    """Quién ganó según ✅ Decidir: un lado del detalle, `''` si no se jugó,
    `None` si todavía no se decidió. Lo lee `llaves_a_entrada.py`."""
    d = (_decisiones().get('batallas') or {}).get(clave_batalla(det))
    return None if d is None else (d.get('ganador') or '')


# ── las preguntas ───────────────────────────────────────────────────────

_LLAVES = []


def _link_llave(origen, match):
    """(link a la llave en Discord, el match sin el link).

    🔑 Dos fuentes: si la pregunta es de un evento ya procesado
    (`evento #350`), el link sale de `datos/llaves_t1.json`; si viene del
    lector (`llaves de Discord`), lo trae el «Posible match» al final.
    """
    t = str(match or '')
    i = t.find('https://discord.com/channels/')
    if i >= 0:
        j = i
        while j < len(t) and not t[j].isspace() and t[j] not in '|,':
            j += 1
        link = t[i:j]
        resto = (t[:i] + t[j:]).strip()
        if resto.endswith('·'):
            resto = resto[:-1].strip()
        return link, resto
    m = re.match(r'evento\s*#\s*(\d+)', origen or '', re.I)
    if m:
        if not _LLAVES:
            try:
                with io.open(os.path.join(BASE, 'datos', 'llaves_t1.json'),
                             encoding='utf-8') as f:
                    _LLAVES.append(json.load(f))
            except (OSError, ValueError):
                _LLAVES.append({})
        ls = (_LLAVES[0].get(m.group(1)) or {}).get('links') or []
        if ls:
            return ls[-1], t
    return '', t


def _donde(origen, detalle, eventos):
    """«Dónde apareció», en palabras."""
    m = re.match(r'evento\s*#\s*(\d+)', origen or '', re.I)
    if m:
        ev = eventos.get(m.group(1))
        if ev:
            return '#%s · %s (%s, %s)' % (m.group(1), ev[0], ev[1], ev[2])
        return 'evento #%s' % m.group(1)
    if ' · ' in (detalle or '') and 'llaves' in (origen or '').lower():
        partes = [x.strip() for x in detalle.split(' · ')]
        if len(partes) == 3:
            return '%s (%s, %s)' % tuple(partes)
    if (origen or '').strip() == 'bot /card':
        return 'usó /card en Discord'
    if (origen or '').strip() == 'backfill':
        return 'el sync de Discord con la Lista de Raperos'
    return origen or '—'


def armar(abiertas, eventos=None):
    """`[pregunta]` desde las filas abiertas de `Pendientes`, sin repetir.

    `abiertas` es `[(n_fila, {columna: valor})]`. Cada pregunta junta todas
    las filas con el mismo (tipo, detalle): contestarla una vez las cierra
    a todas.
    """
    eventos = eventos or {}
    # para las pistas que necesitan el servidor y la fecha del evento
    _DATOS['eventos'] = eventos
    por = collections.OrderedDict()
    grupo_de = {}
    for n, f in abiertas:
        tipo, det = f.get('Tipo', '').strip(), f.get('Detalle', '').strip()
        if not tipo or not det:
            continue
        k = clave(tipo, det)
        # 🔴 LA MISMA PERSONA ESCRITA DISTINTO ES UNA SOLA PREGUNTA. Dlx vio
        # «MAU KC 🇨🇴» y «Mau Kc 🇨🇴», «DENIK» y «Denik», tres «money maker»:
        # contestar uno dejaba los otros. Se juntan por el nombre sin
        # adornos Y LA MISMA BANDERA: «Volk 🇲🇽» y «volk 🇨🇴» siguen aparte,
        # porque la bandera separa a desconocidos con el mismo nombre.
        # ⚠️ El id es el de la PRIMERA grafía: así una respuesta ya escrita
        # sigue encontrando su pregunta.
        # ⚠️ Los fragmentos de equipo NO se juntan: «kc)» con «kc» cerraba
        # la pregunta de verdad junto con la basura.
        if tipo == 'Nombre desconocido' and not es_fragmento(det):
            g = (norm(_sin_bandera(det)), ''.join(sorted(_BANDERA.findall(det))))
            if g in grupo_de and grupo_de[g] in por:
                q = por[grupo_de[g]]
                q['filas'].append(n)
                q['origenes'].append(f.get('Origen', '').strip())
                if det not in q['variantes']:
                    q['variantes'].append(det)
                continue
            grupo_de[g] = k
        if k in por:
            por[k]['filas'].append(n)
            por[k]['origenes'].append(f.get('Origen', '').strip())
            continue
        origen, match = f.get('Origen', '').strip(), f.get('Posible match', '').strip()
        link, match = _link_llave(origen, match)
        # 🔑 `origenes`: los eventos de TODAS sus filas, no sólo el de la primera. Ver `_nums()`.
        p = {'id': k, 'tipo': tipo, 'detalle': det, 'origen': origen, 'origenes': [origen],
             'match': match, 'filas': [n], 'variantes': [det], 'link': link,
             'grupo': GRUPO.get(tipo, (4, tipo)),
             'donde': _donde(origen, det, eventos)}
        por[k] = p
    for p in por.values():
        p['que'], p['sug'], p['opciones'] = _pregunta(p)
        p['pistas'] = _pistas(p)
        p['seccion'] = _seccion(p)
    return sorted(por.values(), key=lambda p: (p['grupo'][0], p['filas'][0]))


# ── las pistas y la sección de cada pregunta ────────────────────────────
_LLAVES_T1 = []


def _llaves_t1():
    if not _LLAVES_T1:
        try:
            with io.open(os.path.join(BASE, 'datos', 'llaves_t1.json'),
                         encoding='utf-8') as f:
                _LLAVES_T1.append(json.load(f) or {})
        except (OSError, ValueError):
            _LLAVES_T1.append({})
    return _LLAVES_T1[0]


def _num_evento(p):
    m = re.match(r'evento\s*#\s*(\d+)', p.get('origen') or '', re.I)
    if m:
        return m.group(1)
    m = re.match(r'#(\d+)', p.get('donde') or '')
    return m.group(1) if m else ''


def _nums(p):
    """Los números de TODOS los eventos de una pregunta, en orden y sin repetir.

    🔴 UN NOMBRE QUE JUGÓ DOS EVENTOS SE BUSCABA SÓLO EN EL PRIMERO. La pregunta junta las filas del mismo nombre
    (`armar()`), pero las pistas —la inscripción, el podio, la llamada— se miraban en el evento de la primera fila:
    si el nombre volvía a jugar y esa noche se anotó o estaba en la llamada, la pista estaba y no se usaba.
    """
    out = []
    for o in p.get('origenes') or [p.get('origen') or '']:
        m = re.match(r'evento\s*#\s*(\d+)', o or '', re.I)
        if m and m.group(1) not in out:
            out.append(m.group(1))
    return out or ([_num_evento(p)] if _num_evento(p) else [])


def _clave_ev(ev):
    """`'evento normalizado|sv|dd/mm'`: la clave de `podio_menciones.json` y de `identidad_llaves.json`."""
    return '%s|%s|%s' % (norm(ev[0]), ev[1], ev[2]) if ev and len(ev) > 2 else ''


def _identidad(ev=None):
    """Lo que la llave de ese evento dice de quién es quién —`{menciones, crece}`, de
    `llaves_a_entrada.identidad_de_grupo()`—; sin `ev`, todos los eventos."""
    if 'identidad' not in _DATOS:
        try:
            with io.open(os.path.join(BASE, 'datos', 'identidad_llaves.json'), encoding='utf-8') as f:
                _DATOS['identidad'] = (json.load(f) or {}).get('eventos') or {}
        except (OSError, ValueError):
            _DATOS['identidad'] = {}
    return _DATOS['identidad'] if ev is None else (_DATOS['identidad'].get(_clave_ev(ev)) or {})


def _limpio(ev):
    """«__ RAP EXHIBITION 1 8 __» -> «RAP EXHIBITION 1 8»: sin el subrayado
    de Discord, para leer. ⚠️ Sólo para mostrar: el nombre de verdad sigue
    siendo el de `Eventos Procesados`."""
    return re.sub(r'^[_\s]+|[_\s]+$', '', str(ev or '')) or str(ev or '')


def _seccion(p):
    """`(clave, título)` de la sección donde va la pregunta: su EVENTO, o el
    grupo si no es de un evento (identidad, MW)."""
    t, det = p['tipo'], p['detalle']
    ev = sv = fecha = num = ''
    if t == 'Batalla sin ganador':
        x = partes_batalla(det)
        if x:
            ev, sv, fecha = x[0], x[1], x[2]
    elif t in ('Bracket incompleto', 'Evento dudoso', 'Llave sin resolver',
               'Vidas cargado') and ' · ' in det:
        partes = [x.strip() for x in det.split(' · ')]
        if len(partes) == 3:
            ev, sv, fecha = partes
    if not ev:
        m = re.match(r'#(\d+) · (.+) \((\w+), ([\d/]+)\)$', p.get('donde') or '')
        if m:
            num, ev, sv, fecha = m.groups()
    if not ev:
        return ('grupo:' + p['grupo'][1], p['grupo'][1])
    if not num:
        for n, L in _llaves_t1().items():
            if norm(_limpio(L.get('nombre'))) == norm(_limpio(ev)) and L.get('fecha') == fecha:
                num = n
                break
    tit = '%s · %s · %s%s' % (_limpio(ev), sv, fecha, ' · #%s' % num if num else '')
    return ('ev:%s|%s|%s' % (norm(_limpio(ev)), sv, fecha), tit)


def _peleas(nombre, num):
    """Lo que hizo esa persona en ese evento, de la llave: «Cuartos: perdió
    con X». Ayuda a saber quién es sin abrir Discord."""
    L = _llaves_t1().get(str(num)) or {}
    k = norm(_sin_bandera(nombre))
    out = []
    for R in L.get('rondas') or []:
        for b in R.get('b') or []:
            lados = b[0] if b else []
            mio = [x for x in lados if k and any(norm(_sin_bandera(m)) == k
                                                 for m in str(x).split(','))]
            if not mio:
                continue
            otros = [_sin_bandera(x) for x in lados if x not in mio]
            gano = b[1] and (b[1] in mio or any(norm(_sin_bandera(m)) == k
                                                for m in str(b[1]).split(',')))
            if otros:
                # ⚠️ EN UNA BATALLA DE SIETE, DOS NOMBRES Y «N MÁS»
                quien = (' y '.join(otros) if len(otros) <= 2
                         else '%s, %s y %d más' % (otros[0], otros[1], len(otros) - 2))
                out.append('%s: %s %s' % (R.get('r') or '', 'le ganó a' if gano else 'perdió con', quien))
    return out[:2]


def _termino(nombre, num):
    """«Terminó Subcampeón (3.750 pts)»: su fila en la tabla de esa llave."""
    k = norm(_sin_bandera(nombre))
    for r in (_llaves_t1().get(str(num)) or {}).get('tabla') or []:
        if k and norm(_sin_bandera(r[0])) == k:
            return 'Terminó %s (%s pts)' % (r[1], '{:,}'.format(int(r[2] or 0)).replace(',', '.'))
    return ''


_DATOS = {}


def _datos(nombre):
    """Un json de `datos/`, leído una vez. Vacío si no está."""
    if nombre not in _DATOS:
        try:
            with io.open(os.path.join(BASE, 'datos', nombre + '.json'),
                         encoding='utf-8') as f:
                _DATOS[nombre] = json.load(f)
        except (OSError, ValueError):
            _DATOS[nombre] = {}
    return _DATOS[nombre]


def _y(cosas):
    cosas = [str(x) for x in cosas if x]
    return ' y '.join(cosas) if len(cosas) <= 2 else '%s y %s' % (', '.join(cosas[:-1]), cosas[-1])


def _cuenta(did):
    """Lo que se sabe de una cuenta de Discord, en una línea: «en DRA y FFA ·
    Miembro de DRA · en la Lista como Shadow · 3 eventos en la T1».

    🔑 PARA CONTESTAR «¿ES LA MISMA PERSONA?» SIN ABRIR DISCORD. La pregunta
    traía dos links y nada más: había que abrir los dos perfiles para ver
    que uno está en tres servidores de la Liga y el otro en ninguno —que es
    casi siempre la respuesta—. Sale de lo que el ciclo ya guarda:
    `servidores_de`, `verificados`, `padron` y el pool de Temporada.
    """
    did = str(did or '').strip()
    if not did.isdigit():
        return ''
    svs = (_datos('servidores_de') or {}).get(did) or []
    out = ['en %s' % _y(svs) if svs else 'no está en ningún servidor de la Liga']
    if 'dra' not in _DATOS:
        _DATOS['dra'] = set((_datos('verificados') or {}).get('ids') or [])
    if did in _DATOS['dra']:
        out.append('Miembro de DRA')
    fila = next((r for r in _datos('padron') or []
                 if str(r.get('discord_id') or '') == did), None)
    if fila:
        out.append('en la Lista como %s' % (fila.get('raw') or fila.get('full')))
    t1 = next((r for r in _datos('temporada_pool') or []
               if str(r.get('discord_id') or '') == did), None)
    if t1 and t1.get('ev'):
        out.append('%d evento%s en la T1' % (t1['ev'], '' if t1['ev'] == 1 else 's'))
    return ' · '.join(out)


#: los nombres de Discord de cada cuenta, del paso 1b. Ver `_en_discord()`.
APODOS = os.path.join(BASE, '.cache', 'apodos_discord.json')


def _apodos():
    """`{nombre normalizado: {discord_id}}` de `APODOS`, o `{}` si no está."""
    if 'apodos' not in _DATOS:
        idx, donde = {}, {}
        try:
            with io.open(APODOS, encoding='utf-8') as f:
                crudo = json.load(f) or {}
            for did, ns in (crudo.get('nombres') or {}).items():
                for n in ns or []:
                    k = norm(_sin_bandera(n))
                    if len(k) >= 3:
                        idx.setdefault(k, set()).add(str(did))
            donde = {str(d): list(s or []) for d, s in (crudo.get('servidores') or {}).items()}
        except (OSError, ValueError):
            pass
        _DATOS['apodos'] = idx
        _DATOS['donde'] = donde
    return _DATOS['apodos']


def _servidores_de(did, svs):
    """En qué servidores de la Liga está esa cuenta hoy.

    🔴 `datos/servidores_de.json` SOLO NO ALCANZA. De Snake Rap y Urban
    Freestyle guarda sólo a quien ya está en la Lista —el repo es público y
    esas listas no son nuestras—, y un «¿quién es X?» es por definición de
    alguien que todavía no está. `por_discord()` daba a esas cuentas por idas
    de la Liga: medido el 28/09/2026, 10 de 50 nombres desconocidos, seis de
    ellos anotados con ese mismo nombre en las inscripciones del evento.
    El caché de apodos (sólo en el runner, nunca en git) trae a todos.
    """
    _apodos()
    return list(svs.get(did) or []) or list(_DATOS.get('donde', {}).get(str(did)) or [])


#: los separadores de una inscripción de varios: «snow🇨🇴 + nc»
_SEP_INSC = re.compile(r'\s*(?:\+|&|,|/|\by\b|\be\b)\s*', re.I)
#: 🔴 Y LA BANDERA ENTRE DOS NOMBRES TAMBIÉN SEPARA. «27 🇺🇸 Piyi 🇲🇽» (FFA,
#: 28/09/2026) es una PAREJA —la llave de la VOL 16 2VS2 la escribió después
#: «[27 🇺🇸 + PIYI 🇲🇽]»— anotada desde la cuenta de Eliot, y sin esto era «un
#: solo nombre»: `por_discord()` dio de alta a «27 Piyi» en la Lista con la
#: cuenta de Eliot. La bandera del final no separa («Prrr🇦🇴», «TEAM VENECIA 🇲🇦
#: 🇻🇪»): sólo la que tiene un nombre a cada lado.
_ENTRE_BANDERAS = re.compile('(?:[\U0001F1E6-\U0001F1FF]{2}\\s*)+(?=[^\\s\U0001F1E6-\U0001F1FF])')


_UNA_BANDERA = re.compile('[\U0001F1E6-\U0001F1FF]{2}')
#: cuántas veces una cuenta se anotó con SÓLO esa bandera para que sea «la suya»
VECES_BANDERA_PROPIA = 2


def suyos_de_pareja(inscripciones):
    """`[(discord_id, servidor, nombre normalizado)]`: en una inscripción de varios, el que es la cuenta que la
    escribió, por su bandera. Pura.

    🔑 Dlx, 08/10/2026: *«Belleza es provenza, si ves el canal de inscripciones podrías saber quiénes se
    inscribieron»*. La cuenta de Provenza (`provenzaaznevorp`) anotó «fleivaman🇨🇦 + belleza🇮🇨» en FFA, y esa misma
    cuenta se anota sola escribiendo SÓLO «🇮🇨» —tres veces, y otras cuatro «🇺🇸»—. Una inscripción que es nada más
    una bandera la escribe la persona para sí misma: ésa es SU bandera. En la pareja, el único con esa bandera es esa cuenta.

    ⚠️ Pide las tres cosas: la bandera sola `VECES_BANDERA_PROPIA` veces o más desde esa cuenta, UN solo integrante
    con una de esas banderas, y la inscripción sin nota entre paréntesis («(me pidieron…)» es para otro). Si los dos
    llevan la bandera de la cuenta, no se elige. Y no pasa por la regla de «una cuenta, un nombre» de
    `indice_inscritos()`: esa cuenta se anota con un nombre distinto cada vez, y lo que la prueba acá es la bandera.
    """
    propias = collections.defaultdict(collections.Counter)
    for x in inscripciones or []:
        did, t = str(x.get('discord_id') or ''), str(x.get('texto') or '').strip()
        if did.isdigit() and _UNA_BANDERA.fullmatch(t):
            propias[did][t] += 1
    out = []
    for x in inscripciones or []:
        did, t = str(x.get('discord_id') or ''), str(x.get('texto') or '')
        mias = {b for b, k in (propias.get(did) or {}).items() if k >= VECES_BANDERA_PROPIA}
        if not mias or '(' in t:
            continue
        partes = [p for p in _SEP_INSC.split(t) if len(norm(_sin_bandera(p))) >= 2]
        if len(partes) < 2:
            continue
        suyos = [p for p in partes if set(_UNA_BANDERA.findall(p)) & mias]
        if len(suyos) != 1 or len([q for q in _ENTRE_BANDERAS.split(suyos[0]) if len(norm(_sin_bandera(q))) >= 2]) != 1:
            continue
        out.append((did, x.get('servidor') or '', norm(_sin_bandera(suyos[0]))))
    # 🔑 Y EL QUE TIENE EL NOMBRE DE LA CUENTA (Dlx, 12/10/2026: «cuando el evento ha abierto inscripciones mirá bien
    # quiénes se han inscrito… mejorar en ese aspecto»). «Metorito🇲🇽 + DXG🇲🇽» la escribió `metorito0807`: en la
    # pareja, Metorito es esa cuenta. Medido sobre las 2.151 inscripciones guardadas: 48 de las 181 de varios nombres
    # tienen UNO SOLO que es el usuario de quien la escribió (Molusco, Cronox, Makmah, Bloody, Eclipse, DXG, Snow…).
    # El compañero sigue sin cuenta: eso no lo dice la inscripción.
    ya = {(o[0], o[1]) for o in out}
    for x in inscripciones or []:
        did, t = str(x.get('discord_id') or ''), str(x.get('texto') or '')
        if not did.isdigit() or '(' in t or (did, x.get('servidor') or '') in ya:
            continue
        ns = _nombres_insc(t)
        if len(ns) < 2:
            continue
        de_cuenta = [n for n in ns if es_su_usuario(n, x.get('quien'))]
        if len(de_cuenta) == 1:
            out.append((did, x.get('servidor') or '', de_cuenta[0]))
    return out


def es_su_usuario(nombre, usuario):
    """¿`nombre` (normalizado) es el usuario de Discord `usuario`, sin los números del final? Igual, uno el principio
    del otro desde 4 letras, o parecido a 0,85: «metorito» y `metorito0807`, «molusco» y `moluscoanvriento_79058`."""
    a, b = norm(_sin_bandera(nombre)), re.sub(r'\d+$', '', norm(usuario or ''))
    if not a or not b:
        return False
    if len(a) < 4 or len(b) < 4:
        return a == b
    return a == b or a.startswith(b) or b.startswith(a) or difflib.SequenceMatcher(None, a, b).ratio() >= 0.85


def _nombres_insc(texto):
    """Los nombres de una inscripción, normalizados y sin la nota entre paréntesis."""
    t = re.sub(r'\(.*?\)|\(.*$', ' ', str(texto or ''))
    partes = [q for p in _SEP_INSC.split(t) for q in _ENTRE_BANDERAS.split(p)]
    return [x for x in (norm(_sin_bandera(p)) for p in partes) if len(x) >= 2]


def _inscritos():
    """`{servidor: {nombre normalizado: {discord_id}}}`: quién se anotó SOLO, y con qué nombre.

    🔑 Dlx, 28/09/2026, con la DESGRACIAS EN TOKYO VOL 16 2VS2 en juego: *«en
    el canal de inscripciones puedes observar los inscritos y combinar con sus
    IDs porque hay personas nuevas o con nombres trolls»*. Una inscripción la
    escribe la propia persona, así que el autor es su cuenta, firmada por
    Discord (ver `bot/inscripciones.py`): «Prrr🇦🇴» desde la cuenta *ndfue* es
    PRRR, aunque el nombre sea de broma.

    ⚠️ SÓLO LAS DE UN NOMBRE. «PARIA SIN REMEDIO + PRRR» la escribió uno de
    los dos —o un tercero: «(me pidieron…)»—, y no dice quién es quién.
    ⚠️ Y NO LAS DE QUIEN ANOTA A OTROS: una cuenta que se anotó sola con dos
    nombres distintos («Player» y «Steven», desde la del organizador) está
    anotando gente, no a sí misma. Dos grafías del mismo («prr» y «prrr»,
    «guty» y «guty campeón…») sí valen. Medido el 28/09/2026 sobre 249
    inscripciones: 140 de un nombre, de 126 cuentas; 14 con más de un nombre,
    y de ésas 6 eran el mismo escrito distinto.
    """
    if 'inscritos' not in _DATOS:
        try:
            with io.open(os.path.join(BASE, 'datos', 'anuncios.json'), encoding='utf-8') as f:
                _DATOS['inscritos'] = indice_inscritos((json.load(f) or {}).get('inscripciones') or [])
        except (OSError, ValueError):
            _DATOS['inscritos'] = {}
    return _DATOS['inscritos']


def indice_inscritos(inscripciones):
    """El índice de `_inscritos()`, de la lista cruda de `datos/anuncios.json`. Pura."""
    solos = collections.defaultdict(list)
    for x in inscripciones or []:
        ns, did = _nombres_insc(x.get('texto')), str(x.get('discord_id') or '')
        if len(ns) == 1 and did.isdigit():
            solos[did].append((x.get('servidor') or '', ns[0]))
    idx = {}
    for did, xs in solos.items():
        corto = min((n for _s, n in xs), key=len)
        if all(corto in n for _s, n in xs):
            for sv, n in xs:
                idx.setdefault(sv, {}).setdefault(n, set()).add(did)
    # 🔑 y el de la pareja que lleva la bandera de la cuenta: «belleza🇮🇨» es Provenza (`suyos_de_pareja()`)
    for did, sv, n in suyos_de_pareja(inscripciones):
        idx.setdefault(sv, {}).setdefault(n, set()).add(did)
    return idx


def _cuenta_de(p, eventos):
    """`([discord_id…], fuente)` de un «¿quién es X?», mirando TODOS sus eventos (`_nums()`).

    ⚠️ SI DOS EVENTOS DAN DOS CUENTAS DISTINTAS, SALEN LAS DOS: no se elige.
    """
    nums = _nums(p)
    if len(nums) <= 1:
        return _cuenta_de_uno(p, eventos)
    hallados = []
    for n in nums:
        ids, fuente = _cuenta_de_uno(dict(p, origen='evento #%s' % n), eventos, sin_apodo=True)
        if ids:
            hallados.append((ids, fuente))
    if hallados:
        todos = sorted({i for ids, _f in hallados for i in ids})
        return todos, hallados[0][1]
    return _cuenta_de_uno(p, eventos)


def _cuenta_de_uno(p, eventos, sin_apodo=False):
    """`([discord_id…], fuente)` de un «¿quién es X?» en el evento de `p`: primero la inscripción, después el podio,
    lo que dice la llave, la llamada y al final el apodo (`sin_apodo`: hasta la llamada, que es lo del evento).

    ⚠️ LA INSCRIPCIÓN MANDA: la escribió esa persona en el servidor del
    evento. Si ahí hay más de una cuenta con ese nombre, no se adivina con el
    apodo: se pregunta.
    """
    k = norm(_sin_bandera(p['detalle']))
    ev = eventos.get(_num_evento(p)) or ()
    ins = sorted(((_inscritos().get(ev[1]) or {}).get(k) or set()) if len(ev) > 1 else set())
    if ins:
        return ins, 'inscripción'
    # 🔑 EL PODIO CON MENCIÓN (Dlx, 28/09/2026: «A · sí, como las
    # inscripciones»): «1ER PUESTO: @alguien» y el campeón de la final es este
    # nombre. Lo arma `llaves_a_entrada.podio_de_grupo()`.
    if len(ev) > 2:
        did = (_podio().get('%s|%s|%s' % (norm(ev[0]), ev[1], ev[2])) or {}).get(k)
        if did:
            return [str(did)], 'podio'
        # 🔑 Y LO DEMÁS QUE LA LLAVE DICE (01/10/2026): `NOMBRE <@id>` en el MVP o en un podio de dos, y la mención que
        # pasó de ronda con este nombre —SHULIOT, en MARRUECOS—. Lo escribió el organizador, como el podio. Ver
        # `llaves_a_entrada.identidad_de_grupo()`.
        did = (_identidad(ev).get('menciones') or {}).get(k)
        if did:
            return [str(did)], 'llave'
    # 🎙️ LA LLAMADA (Dlx, 29/09/2026, «1. A»): UNA sola persona que estaba en
    # la llamada de ese servidor mientras se jugaba esa llave, con EXACTAMENTE
    # ese nombre, y que ya está en la Lista. Va antes que el nombre suelto:
    # cuando «Sol» es de cinco cuentas, la que estaba ahí es la que jugó.
    # (Hasta el 01/10/2026 sólo hacía alias de alguien de la Lista: ver abajo.)
    #
    # 🔑 Y DESDE EL 01/10/2026, ESTÉ O NO EN LA LISTA. Dlx, con los nombres troll de la DESGRACIAS EN TOKYO VOL 20:
    # *«que el BOT haga la mayoría de las cosas por su propia cuenta… hasta el máximo. Si el bot no puede después de
    # haber intentado todo, ahí sí en Decidir»*. «TITO CALDERON» era UNA cuenta de la llamada con ese nombre exacto,
    # en DRA y FFA, y fuera de la Lista: es quien jugó, y entra (`por_discord()` pide que esté en el servidor).
    if len(k) >= 3:
        _ev, exactos, parecidos = _de_la_llamada(p['detalle'], _num_evento(p), eventos)
        if len(exactos) == 1:
            return [exactos[0][0]], 'llamada'
        # 🔑 Y EL PARECIDO DE UNA SOLA PERSONA DE LA LISTA QUE ESTABA EN LA LLAMADA: «ELSOLAR» era Elsoolar —en la
        # llamada mientras se jugaba—, y no Solar, que no estaba. Se compara su nombre de Discord y su nombre en
        # la Lista; con dos candidatos no se elige.
        if not exactos and len(k) > CORTO:
            cand = _parecidos_de_lista(k, _num_evento(p), eventos, parecidos)
            if len(cand) == 1:
                return cand, 'llamada_parecido'
    if sin_apodo:
        return [], 'Discord'
    return sorted(_apodos().get(k) or set()) if len(k) >= 3 else [], 'Discord'


def _crecio_de(p, eventos, padron, akas):
    """El nombre en la Lista de quien la llave escribe así de una ronda a otra, o None.

    🔑 «PARIA SIN REMEDIO 🇦🇷» pasó de octavos a cuartos en el lugar de «PARIA 🇦🇷», con el mismo compañero y la
    misma bandera (VOL 18 2VS2): el lector lo ve (`escuchar._crecio()`) y lo deja en `identidad_llaves.json`. Si la
    otra forma ya es alguien de la Lista, éste es su alias. Exacto: la forma de la llave, no un parecido.
    """
    k = norm(_sin_bandera(p['detalle']))
    for n in _nums(p):
        for antes, despues in _identidad(eventos.get(n)).get('crece') or ():
            otra = despues if norm(_sin_bandera(antes)) == k else antes if norm(_sin_bandera(despues)) == k else None
            x = _persona(otra, padron, akas) if otra else None
            if x and norm(_sin_bandera(x.get('raw') or x.get('full'))) != k:
                return x.get('raw') or x.get('full')
    return None


def _se_anoto_como(did, padron):
    """El nombre en la Lista con el que esa cuenta se anotó SOLA, si es uno y esa fila no tiene otra cuenta; o None.

    🔑 «PARIA SIN REMEDIO» es el apodo de UNA cuenta de FFA que no está en la Lista, y `por_discord()` no la daba de
    alta porque Paria se llama parecido —podía ser él sin su cuenta cargada—. Era él: esa misma cuenta se anotó dos
    veces como «Paria🇦🇷» en las inscripciones. La cuenta firmó las dos cosas.
    """
    nombres = {n for sv, por_n in _inscritos().items() for n, ids in por_n.items() if str(did) in ids}
    if not nombres:
        return None
    filas = [r for r in padron if norm(_sin_bandera(r.get('raw') or r.get('full') or '')) in nombres
             and str(r.get('discord_id') or '') in ('', str(did))]
    reales = {r.get('raw') or r.get('full') for r in filas}
    return next(iter(reales)) if len(reales) == 1 else None


def _parecidos_de_lista(k, num, eventos, parecidos):
    """Las cuentas de la Lista que estaban en la llamada del evento con un nombre parecido a `k` (normalizado):
    por su nombre de Discord (`parecidos`, de `_de_la_llamada()`) o por su nombre en la Lista. Si en la llamada hay
    además alguien parecido FUERA de la Lista, no se puede elegir: vacío."""
    por_id = _lista_por_id()
    if any(d not in por_id for d, _e in parecidos):
        return []
    cand = {d for d, _e in parecidos}
    ev, desde, hasta = _ventana(num, eventos)
    if desde is not None:
        for d, e in _llamada(ev[1]).items():
            n = norm(_sin_bandera(por_id.get(d) or ''))
            if d in cand or len(n) <= CORTO or not any(desde <= t <= hasta for t in e.get('t') or ()):
                continue
            if k in n or n in k or difflib.SequenceMatcher(None, k, n).ratio() >= 0.8:
                cand.add(d)
    return sorted(cand)


def _podio():
    """`{'evento|sv|fecha': {nombre: id}}` de `datos/podio_menciones.json`."""
    if 'podio' not in _DATOS:
        try:
            with io.open(os.path.join(BASE, 'datos', 'podio_menciones.json'), encoding='utf-8') as f:
                _DATOS['podio'] = (json.load(f) or {}).get('eventos') or {}
        except (OSError, ValueError):
            _DATOS['podio'] = {}
    return _DATOS['podio']


def _en_discord(nombre):
    """`(pista, [nombres de la Lista])` de un nombre desconocido: si es el
    apodo, el nombre visible o el usuario de alguna cuenta de los servidores
    de la Liga, y si esa cuenta ya está en la Lista con OTRO nombre.

    🔑 «¿QUIÉN ES KULRW?» SE CONTESTABA ABRIENDO DISCORD. Medido el
    28/09/2026: 24 de 53 nombres desconocidos son el nombre de alguien en
    los servidores de la Liga, y 4 son cuentas que ya están en la Lista
    como otra persona —KULRW es Jult, nacioenmilan es Deuxs, ADACCHI es
    Nobu—. ⚠️ ES UNA PISTA, NO UNA RESPUESTA: la identidad no se interpreta,
    se pregunta; esto sólo pone la respuesta probable al alcance de un click.
    """
    k = norm(_sin_bandera(nombre))
    ids = sorted((_apodos().get(k) or set()) if len(k) >= 3 else set())
    if not ids:
        return '', []
    por_id = _lista_por_id()
    en_lista = [por_id[d] for d in ids if d in por_id]
    fuera = len(ids) - len(en_lista)
    if len(ids) == 1:
        pista = ('En Discord es la cuenta de «%s» en la Lista' % en_lista[0] if en_lista
                 else 'En Discord hay una cuenta con ese nombre, que no está en la Lista')
    else:
        pista = 'En Discord hay %d cuentas con ese nombre%s' % (len(ids), (
            ': %s en la Lista%s' % (_y(['«%s»' % x for x in en_lista]),
                                     ' y %d que no' % fuera if fuera else '')
            if en_lista else ', ninguna en la Lista'))
    return pista, en_lista


def _cuentas_posibles(nombre):
    """`[{id, nombre, usuario, sv}]` de `datos/cuentas_posibles.json` para ese nombre (sin bandera)."""
    if 'posibles' not in _DATOS:
        try:
            with io.open(os.path.join(BASE, 'datos', 'cuentas_posibles.json'), encoding='utf-8') as f:
                _DATOS['posibles'] = (json.load(f) or {}).get('nombres') or {}
        except (OSError, ValueError):
            _DATOS['posibles'] = {}
    # sin mayúsculas: la llave escribe «kc» y la búsqueda se hizo como «KC»
    k = norm(_sin_bandera(nombre))
    return next((v for n, v in _DATOS['posibles'].items() if norm(n) == k), [])


#: 🔎 la respuesta que elige una de esas cuentas: «Es la cuenta @usuario»
CUENTA_RE = re.compile(r'^Es la cuenta @(\S+)$')


def _posibles(nombre):
    """🔎 LAS CUENTAS QUE SE BUSCARON PARA ESE NOMBRE, con usuario y servidores: «En Discord hay 2 cuentas» no dice
    cuáles, y con un nombre de una o dos letras (L, KC, GS, 27) `_en_discord()` no dice nada. Dlx, 04/10/2026 («4. Ok»):
    los dudosos se contestan acá «con las cuentas al lado». Salen de `datos/cuentas_posibles.json`."""
    cs = _cuentas_posibles(nombre)
    if not cs:
        return ''
    return 'Cuentas con ese nombre: ' + ' · '.join(
        '«%s» @%s (%s)' % (c.get('nombre') or '?', c.get('usuario') or '?', ', '.join(c.get('sv') or [])) for c in cs)


def _lista_por_id():
    """`{discord_id: nombre en la Lista}`, del padrón."""
    if 'lista_por_id' not in _DATOS:
        _DATOS['lista_por_id'] = {str(r.get('discord_id')): (r.get('raw') or r.get('full'))
                                  for r in _datos('padron') or [] if r.get('discord_id')}
    return _DATOS['lista_por_id']


#: 🎙️ estar en la llamada cuenta desde 1 hora antes de publicada la llave
#: hasta 5 después: la llave sale al arrancar y un evento dura hasta 3 o 4 h
LLAMADA_H = (1, 5)
#: el self-check no sale a la red: sin foto cargada a mano, no hay llamada
SIN_RED = False


def _llamada(sv):
    """`{discord_id: {n, c, t}}`: quién se vio en la llamada de ese servidor
    en los últimos 3 días (`bot/en_llamada.py`, en KV), o `{}`."""
    c = _DATOS.setdefault('llamada', {})
    if sv not in c:
        c[sv] = {}
        if not SIN_RED:
            try:
                sys.path.append(os.path.join(BASE, 'bot'))
                import en_llamada as LL
                c[sv] = (LL.leer(sv) or {}).get('gente') or {}
            except Exception as e:                       # noqa: BLE001
                print('   ⚠️ no pude leer la llamada de %s: %s' % (sv, str(e)[:60]))
    return c[sv]


def _ventana(num, eventos=None):
    """`(evento, desde, hasta)`: el evento de ese número y cuándo se jugaba su llave, en ms —de 1 hora antes de
    publicada a 5 después (`LLAMADA_H`); sin el link de la llave, el día entero (hora del este)—. Sin evento o sin
    fecha, `desde` y `hasta` son `None`."""
    ev = (eventos if eventos is not None else (_DATOS.get('eventos') or {})).get(str(num or ''))
    if not ev:
        return ev, None, None
    import llaves_web as LW
    ms = LW._primero((_llaves_t1().get(str(num)) or {}).get('links'))
    if ms is not None:
        return ev, ms - LLAMADA_H[0] * 3600000, ms + LLAMADA_H[1] * 3600000
    ms = LW.ms_de_fecha(ev[2])
    if ms is None:
        return ev, None, None
    return ev, ms - 12 * 3600000, ms + 12 * 3600000


def _de_la_llamada(nombre, num, eventos=None):
    """`(evento, exactos, parecidos)`: quién estaba en la llamada de ese
    servidor mientras se jugaba esa llave, con ese nombre (`exactos`) o uno
    parecido. Cada uno es `(discord_id, {n, c, t})`. Sin foto, listas vacías.
    """
    ev, desde, hasta = _ventana(num, eventos)
    k = norm(_sin_bandera(nombre))
    if not ev or len(k) < 3 or desde is None:
        return ev, [], []
    exactos, parecidos = [], []
    for did, e in _llamada(ev[1]).items():
        if not any(desde <= t <= hasta for t in e.get('t') or ()):
            continue
        ks = {norm(_sin_bandera(x)) for x in e.get('n') or ()} - {''}
        if k in ks:
            exactos.append((did, e))
        elif any(len(x) >= CORTO and (k in x or x in k or difflib.SequenceMatcher(None, k, x).ratio() >= 0.8)
                 for x in ks):
            parecidos.append((did, e))
    return ev, exactos, parecidos


def _en_llamada(nombre, num):
    """`(pista, [nombres de la Lista])`: si el nombre desconocido es el de
    alguien que estaba en la llamada de ese servidor mientras se jugaba esa
    llave. La foto la saca el ciclo sólo con un evento en vivo; sin foto,
    no hay pista.

    🔑 Dlx, 29/09/2026: *«quizás para facilitar el proceso podrías chequear
    quiénes están en la llamada?»* — el suplente, o el que jugó sin
    anotarse. ⚠️ UN NOMBRE PARECIDO ES SÓLO PISTA: en la llamada también hay
    público. El nombre EXACTO de una sola persona que ya está en la Lista se
    resuelve solo (`_cuenta_de()`, «1. A» del 29/09).
    """
    ev, exactos, parecidos = _de_la_llamada(nombre, num)
    cuales = exactos or parecidos
    if not cuales:
        return '', []
    por_id = _lista_por_id()
    quienes = ['«%s»%s' % ((e.get('n') or ['?'])[0], ' (en la Lista: %s)' % por_id[d] if d in por_id else '')
               for d, e in cuales[:3]]
    pista = '🎙️ En la llamada de %s, mientras se jugaba, %s %s' % (
        ev[1], 'estaba' if exactos else ('había alguien parecido:' if len(cuales) == 1
                                         else 'había %d parecidos:' % len(cuales)), _y(quienes))
    return pista, [por_id[d] for d, _ in cuales if d in por_id]


#: un nombre de hasta tantas letras es «corto»: se parece a demasiada gente
CORTO = 4
#: cuántos se resuelven solos por corrida, como mucho
TOPE_DISCORD = 30
#: quién figura en `Pendientes` como que lo resolvió
POR_DISCORD = 'el ciclo (su cuenta de Discord)'


def _iso(bandera):
    """`🇻🇪` -> `'ve'`."""
    return ''.join(chr(ord(c) - 0x1F1E6 + 97) for c in bandera)


def por_discord(preguntas, respuestas, eventos, dry=True):
    """🔑 «¿QUIÉN ES X?» SE CONTESTA SOLO CUANDO X TIENE UNA SOLA CUENTA.

    Dlx, 28/09/2026: *«tú que tienes acceso a los 5 servidores puedes buscar
    los nombres de los MCs que necesitas saber»*, y a «¿lo agrego a la Lista
    con esa cuenta?», *«A»*. Hasta ese día `_en_discord()` era una pista y la
    respuesta la escribía él.

    Sólo las preguntas sin contestar, y sólo si el nombre es el de UNA cuenta
    de los servidores de la Liga (apodo, nombre visible o usuario):

        la cuenta ya está en la Lista   alias de esa persona (hoja AKAs)
        no está                         fila nueva en la Lista, con esa cuenta
                                        y la bandera del nombre de la llave

    🎙️ Y LA LLAMADA (Dlx, 29/09/2026, «1. A»): el nombre EXACTO de una sola
    persona que estaba en la llamada mientras se jugaba esa llave es esa
    persona aunque el nombre sea de varias cuentas: alias si está en la Lista, y
    desde el 01/10/2026 alta si no está (Dlx: «hasta el máximo»). Y un nombre
    PARECIDO al de una sola persona de la Lista que estaba en la llamada, alias
    suyo. Ver `_cuenta_de()`.

    ⚠️ LA CUENTA QUE SALE SÓLO POR EL NOMBRE, SÓLO SI ESTÁ EN EL SERVIDOR DEL
    EVENTO: «MHS» se parece a demasiada gente, y quien jugó un evento de FFA
    está en FFA. Era sólo para los cortos hasta que Snake Rap entró entero a la
    cuenta (28/09/2026): ahí «Isaias» también es demasiada gente.
    ⚠️ Y NUNCA CONTRA UN PAR DECLARADO DISTINTO en AKAs, ni con un troll.
    Las tarjetas siguen pidiendo lo de siempre: Miembro de DRA y país.

    Devuelve los ids de las preguntas que resolvió (o resolvería, en seco).
    """
    import construir_akas as AK
    akas = AK.cargar() or {}
    fuera = no_rankear()
    por_id = {str(r.get('discord_id')): (r.get('raw') or r.get('full'))
              for r in _datos('padron') or [] if r.get('discord_id')}
    svs = _datos('servidores_de') or {}
    en_lista_n = {norm(_sin_bandera(r.get('raw') or r.get('full') or ''))
                  for r in _datos('padron') or []}
    # 🔴 LA BANDERA DE LA LLAVE, SÓLO SI ES UNA Y ES DE LA LIGA. La misma
    # cuenta aparece como «LAST 🇬🇶» y «Last 🇺🇾», y hay banderas de broma
    # (🇯🇲, 🇦🇸): sin esto, Last entraba como de Guinea Ecuatorial. Si hay dudas
    # entra sin país, y lo completa `bot/autoverificar.py` con sus roles —la
    # regla del país que ya decidió Dlx (25/09)—.
    try:
        from padron_t1 import PAIS_ISO
        liga = set(PAIS_ISO.values())
    except Exception:                                    # noqa: BLE001
        liga = set()
    banderas_de = {}
    for p in preguntas:
        if p['tipo'] != 'Nombre desconocido':
            continue
        ids, _f = _cuenta_de(p, eventos)
        if len(ids) == 1:
            for v in p.get('variantes') or [p['detalle']]:
                banderas_de.setdefault(next(iter(ids)), set()).update(
                    _iso(b) for b in _BANDERA.findall(v))
    pares, nuevos, hechas = [], [], []
    padron_l = _datos('padron') or []
    no = deshechas()
    for p in preguntas:
        if p['tipo'] != 'Nombre desconocido' or p['id'] in respuestas or p['id'] in no:
            continue
        det = p['detalle']
        k = norm(_sin_bandera(det))
        if len(k) < 3 or k in fuera or es_fragmento(det):
            continue
        # 🔴 UN LADO QUE SON DOS NOMBRES NO ES UNA CUENTA: «27 🇺🇸 Piyi 🇲🇽» es
        # una pareja escrita sin «+», y resolverla dio de alta a «27 Piyi»
        # con la cuenta de quien los anotó (28/09/2026). Ver `_ENTRE_BANDERAS`.
        if len(_nombres_insc(det)) > 1:
            continue
        # 🔑 EL NOMBRE QUE CRECE EN LA LLAVE (01/10/2026): la otra forma ya es alguien de la Lista. Ver `_crecio_de()`
        real_c = _crecio_de(p, eventos, padron_l, akas)
        if real_c and not AK.son_distintos(det, real_c, akas):
            pares.append([_sin_bandera(det), real_c, ''.join(_BANDERA.findall(det))])
            hechas.append((p, 'alias de %s: la llave lo escribe así de una ronda a otra' % real_c,
                           ('Es %s' % real_c, {'alias': [_sin_bandera(det), real_c]})))
            continue
        # 🔑 LA CUENTA: la que se anotó con ese nombre en el servidor del
        # evento, o si no, la única de la Liga con ese apodo. Ver `_cuenta_de()`
        ids, fuente = _cuenta_de(p, eventos)
        if len(ids) != 1:
            continue
        did = ids[0]
        # ⚠️ UNA CUENTA QUE HOY NO ESTÁ EN NINGÚN SERVIDOR DE LA LIGA NO SIRVE:
        # «pollo» (EL RAP FECHA 5) daba la de «Rorromeo», y casi seguro es
        # Pollo Sport. Medido el 28/09/2026. ⚠️ Con `_servidores_de()`, que
        # también mira Snake Rap y Urban Freestyle enteros.
        donde = _servidores_de(did, svs)
        if not donde:
            continue
        # la cuenta que sale sólo por el nombre, en el servidor del evento: la
        # inscripción ya lo es (se anotó ahí). 🔴 ERA SÓLO PARA LOS CORTOS, y
        # con Snake Rap entero en la cuenta (7.297 personas) un nombre común
        # alcanza para dar con otro: «ISAIAS» jugó un evento de FFA y la única
        # cuenta «Isaias» está sólo en Snake Rap (28/09/2026).
        # ⚠️ el podio con mención tampoco: lo escribió el organizador del evento.
        # Ni lo demás que dice la llave (`llave`): `NOMBRE <@id>`, la mención que pasó de ronda
        if fuente not in ('inscripción', 'podio', 'llave'):
            ev = eventos.get(_num_evento(p)) or ()
            if len(ev) < 2 or ev[1] not in donde:
                continue
        porque = {'inscripción': 'se anotó así en inscripciones',
                  'podio': 'el podio de la llave lo menciona',
                  'llave': 'la llave lo escribe con su mención',
                  'llamada': 'estaba en la llamada del evento con ese nombre',
                  'llamada_parecido': 'estaba en la llamada del evento con un nombre parecido'}.get(fuente, 'la misma cuenta de Discord')
        real = por_id.get(did)
        # 🔑 Y SI LA CUENTA NO ESTÁ EN LA LISTA PERO SE ANOTÓ CON EL NOMBRE DE ALGUIEN QUE SÍ (y sin cuenta cargada): es
        # esa persona. Antes que darla de alta: eso partiría a Paria en dos. Ver `_se_anoto_como()`.
        real_i = None if real else _se_anoto_como(did, padron_l)
        if real:
            if AK.son_distintos(det, real, akas):
                continue
            pares.append([_sin_bandera(det), real, ''.join(_BANDERA.findall(det))])
            hechas.append((p, 'alias de %s: %s' % (real, porque), ('Es %s' % real, {'alias': [_sin_bandera(det), real]})))
        elif real_i:
            if AK.son_distintos(det, real_i, akas):
                continue
            pares.append([_sin_bandera(det), real_i, ''.join(_BANDERA.findall(det))])
            hechas.append((p, 'alias de %s: %s, y esa cuenta se anotó como «%s»' % (real_i, porque, real_i),
                           ('Es %s' % real_i, {'alias': [_sin_bandera(det), real_i]})))
        elif fuente == 'llamada_parecido':
            # el parecido sólo hace alias de alguien de la Lista (ver `_cuenta_de()`): nunca da de alta
            continue
        elif len(k) > CORTO and any(k in c or c in k for c in en_lista_n if len(c) > CORTO):
            # ⚠️ ALGUIEN DE LA LISTA SE LLAMA PARECIDO («pollo» y Pollo Sport):
            # puede ser la misma persona sin su cuenta cargada. Eso lo decide
            # Dlx; agregar a otro sería partir a una persona en dos.
            continue
        elif len(nuevos) < TOPE_DISCORD and did not in {x[3] for x in nuevos}:
            # ⚠️ UNA FILA POR CUENTA: la otra grafía («Arez» y «AREZ») queda
            # abierta y la corrida siguiente la resuelve como alias, porque
            # su cuenta ya va a estar en la Lista
            cc = banderas_de.get(did) or set()
            nuevos.append((p, _sin_bandera(det).strip(),
                           next(iter(cc)) if len(cc) == 1 and cc <= liga else '', did, fuente))
    # ⚠️ EL MISMO ALIAS POR DOS PREGUNTAS —el mismo nombre con dos banderas, «PARIA SIN REMEDIO 🇦🇷» y «🇧🇲»— va UNA
    # vez a la hoja AKAs; las dos preguntas se cierran igual (`hechas`)
    _vp, _pu = set(), []
    for a, b, f in pares:
        if (norm(a), norm(b)) not in _vp:
            _vp.add((norm(a), norm(b)))
            _pu.append([a, b, f])
    pares = _pu
    if not (pares or nuevos):
        return set()
    print('\n   🔎 resueltos con Discord y las inscripciones: %d alias · %d nuevo(s) a la Lista'
          % (len(pares), len(nuevos)))
    for a, b, _f in pares:
        print('      alias: %s -> %s' % (a, b))
    for _p, n, cc, did, fu in nuevos:
        print('      nuevo: %s %s (Discord %s, por %s)' % (n, cc or '(sin bandera)', did, fu))
    if dry:
        for p, res, (r, esc) in hechas:
            resolver_solo(p, r, 'Discord', res, por=POR_DISCORD, escribio=esc)
        for p, n, cc, did, fu in nuevos:
            resolver_solo(p, '%s: alta con su cuenta %s' % (NUEVO, did), 'Discord', 'entraría a la Lista con la cuenta '
                          '%s (%s)' % (did, fu), por=POR_DISCORD, escribio={'alta': [n, did]})
        return {p['id'] for p, *_ in hechas} | {p['id'] for p, *_ in nuevos}
    import lista_raperos as LR
    # 📝 TODO ANOTADO ANTES DE ESCRIBIR AFUERA (`anotar_pendientes()`), y lo que no se pudo escribir se retira. La fila de
    # `Pendientes` la cierra `flush_solas()` al final, con la regla y la prueba (Dlx, 13/10/2026)
    for p, res, (r, esc) in hechas:
        resolver_solo(p, r, 'Discord', res, por=POR_DISCORD, escribio=esc)
    ids_alias = {p['id'] for p, *_ in hechas}
    de_alta = {}
    for p, n, cc, did, fu in nuevos:
        if resolver_solo(p, '%s: alta con su cuenta %s' % (NUEVO, did), 'Discord', 'nuevo: entró a la Lista con %s (%s)' % (
                {'inscripción': 'la cuenta con que se anotó', 'podio': 'la cuenta que menciona el podio',
                 'llave': 'la cuenta que la llave menciona con ese nombre',
                 'llamada': 'la cuenta que estaba en la llamada con ese nombre'}
                .get(fu, 'su Discord'), did), por=POR_DISCORD, escribio={'alta': [n, did]}):
            de_alta[p['id']] = did
    anotar_pendientes(ids_alias | set(de_alta), dry=False)
    try:
        entraron = LR.agregar_varios(
            [(n, cc, did, 'alta automática · %s · %s' % ({'inscripción': 'se anotó así en inscripciones',
                                                         'podio': 'el podio de la llave lo menciona',
                                                         'llave': 'la llave lo escribe con su mención',
                                                         'llamada': 'estaba en la llamada del evento con ese nombre'}
                                                        .get(fu, 'su nombre en Discord'), _ahora_et()))
             for _p, n, cc, did, fu in nuevos], aplicar=True) if nuevos else {}
    except Exception:
        retirar_pendientes(ids_alias | set(de_alta), dry=False)
        raise
    retirar_pendientes({i for i, did in de_alta.items() if did not in (entraron or {})}, dry=False)
    if pares:
        try:
            poner_filas_aka(ids_alias, _agregar_akas(pares, []), dry=False)
        except Exception:
            retirar_pendientes(ids_alias, dry=False)
            raise
    return ids_alias | {i for i, did in de_alta.items() if did in (entraron or {})}


# ── 👥 una cuenta, dos nombres ──────────────────────────────────────────

#: la pregunta de `una_cuenta_dos_nombres()` (tipo `Alias posible`): el detalle se vuelve a leer con esto
_DOS_RE = re.compile(r'^DOS NOMBRES: «(.+?)» → «(.+?)» · cuenta (\d+)')
DOS_ORIGEN = 'el ciclo · una cuenta, dos nombres'
#: cuántas pruebas firmadas por Discord (inscripciones de su cuenta, menciones del organizador) para hacerlo solo
DOS_PRUEBAS = 2
#: cuánto hace sola una corrida de cada cosa: lo que pasa de esto se pregunta
TOPE_DOS = 10


#: un nombre de equipo: «Crack and Krank», «Ana y Bea», «Ana & Bea». Nunca se une ni se engancha solo
_EQUIPO_RE = re.compile(r'(?i)\s(?:and|y|&|\+|x|vs\.?)\s')


def _se_parecen(a, b):
    """¿Un nombre contiene al otro, o se parecen mucho? «Emi» y «EmiZor» sí; «Steven» y «Player» no."""
    a, b = norm(_sin_bandera(a)), norm(_sin_bandera(b))
    return bool(a and b and (a in b or b in a or difflib.SequenceMatcher(None, a, b).ratio() >= 0.6))


def dos_nombres(inscripciones, menciones, lista, con_puntos, juegan, real_de,
                son_distintos=lambda a, b: False, fuera=(), en_la_liga=lambda did: True,
                preguntados=(), liga=None, es_equipo=lambda n: False, con_rol=None, iso_de=None,
                cuentas_con_nombre=lambda k: set()):
    """👥 UNA CUENTA, DOS NOMBRES: `{'unir': […], 'enganchar': […], 'preguntar': […]}`. Pura.

    🔑 Dlx, 06/10/2026, después de Velatz y Shisui (*«revisa que otros usuarios no tengan ese error»*), a «¿querés
    que el ciclo lo haga solo?»: *«sí»*. El bot ya sabía de quién es cada inscripción, pero a una cuenta que se anota
    con dos nombres distintos la daba por alguien que anota a otros (`indice_inscritos()`) y no unía ninguno, y una
    fila de la Lista sin cuenta («Shisui», «Kude») juntaba puntos sin que nadie preguntara. Velatz figuraba #12 y
    era #3.

    Las pruebas son las que firma Discord: la cuenta que escribió una inscripción de UN nombre —sin nota entre
    paréntesis: «Jr (me pidió que lo inscriba)» es para otro— y la que el organizador etiquetó con ese nombre.

    - **unir** (`[alias, real]` a la hoja AKAs): la cuenta tiene UNA fila en la Lista, usa UN solo nombre además del
      suyo y ese nombre suma aparte, con `DOS_PRUEBAS` o más; ninguna otra cuenta lo usó, nunca jugaron el mismo
      evento, no están marcados distintos ni preguntados, no es un nombre de equipo, y la cuenta juega con su nombre
      o el otro se le parece («Kude» y «Mr.Kude»).
    - **enganchar** (su cuenta a esa fila, o una fila nueva): la cuenta no está en la Lista y ése es el ÚNICO nombre
      que usa, con `DOS_PRUEBAS` o más, y está en la Liga (como `por_discord()`). Como RT y Alonso (Dlx, 06/10, «1. A»).
    - **preguntar** («¿es la misma persona?» en ✅ Decidir): lo que sería unir pero no alcanza, con dos pruebas o con
      nombres que se parecen («Emi» y «EmiZor»). Una inscripción suelta con otro nombre es casi siempre alguien
      anotando a un amigo —Player a Steven— y no se pregunta.
    - 🔑 **R2** (Dlx, 13/10/2026, «Sí», con `con_rol`): **une también si la cuenta usa VARIOS nombres** —BNA se anota
      Ckl, Armando Faso, Hinjkybesuk, Trrr—, cuando hay `DOS_PRUEBAS` inscripciones de ese nombre con la bandera de su
      dueño, la que usa sola (una inscripción que es sólo esa bandera) o ninguna; su dueño no jugó esos eventos con su
      nombre; nadie más usa ese nombre —ni otra inscripción ni otra cuenta de Discord (`cuentas_con_nombre`)—; y el
      dueño **no es organizador, staff, host ni socio** en esos servidores (el staff anota a otros: Player a Steven), y
      el nombre tiene 3 letras o más. Y si el par ya estaba preguntado, lo contesta (`preguntado`). Va con `regla: 'R2'`
      y `si_no`: lo que se hacía antes de R2, para cuando R2 no puede actuar (ver `una_cuenta_dos_nombres()`).

    🔴 LA REVISIÓN DE ESA NOCHE (dos revisores, 06/10/2026) encontró cuatro agujeros en la primera versión, y los
    cuatro unían o enganchaban de más:
      · «el único otro nombre» miraba sólo los nombres CON PUNTOS: la cuenta de un organizador que anota a Juan dos
        veces y a Pedro, Luis y Mario una se tomaba por Juan. Ahora cuentan TODOS los que usa.
      · si la cuenta jugaba, se le unía cualquier nombre con dos inscripciones: Player, el día que anotara a Steven
        otra vez, se lo quedaba. Ahora también pide que sea el único otro.
      · las pruebas se contaban por mensaje: la misma llave guardada dos veces (#366 y #409, 27/09) daba dos. Ahora
        cuentan por servidor y día.
      · la bandera de una fila nueva salía de la inscripción sin mirar si es de la Liga («Shisui 🇯🇵»). Ahora sólo
        una bandera de la Liga (`liga`), como en `por_discord()`; si no, entra sin país y lo completa autoverificar.
    """
    fila_de = collections.defaultdict(set)        # cuenta -> nombres reales de su fila
    cuenta_de, como_figura, sin_cuenta, pais_de = {}, {}, set(), {}
    for r in lista or ():
        k = real_de(r.get('raw') or r.get('full') or '')
        if not k:
            continue
        como_figura.setdefault(k, r.get('raw') or r.get('full'))
        did = str(r.get('discord_id') or '').strip()
        if did:
            fila_de[did].add(k)
            cuenta_de.setdefault(k, did)
            pais_de.setdefault(did, r.get('pais') or '')
        else:
            sin_cuenta.add(k)
    # 🔑 R2: cada inscripción con su bandera, y la bandera que cada cuenta escribe SOLA (la suya)
    flags_i = collections.defaultdict(list)                                  # (cuenta, nombre) -> [(sv, día, {iso})]
    solas_b = collections.defaultdict(set)                                   # cuenta -> {iso}
    for x in inscripciones or ():
        did, t = str(x.get('discord_id') or ''), str(x.get('texto') or '').strip()
        if did.isdigit() and _UNA_BANDERA.fullmatch(t):
            solas_b[did].add(_iso(t))
    sin_cuenta -= set(cuenta_de)
    pruebas = collections.defaultdict(lambda: collections.defaultdict(set))   # cuenta -> nombre -> {(tipo, sv, día)}
    como = collections.defaultdict(lambda: collections.defaultdict(set))      # cuenta -> nombre -> {cómo lo escribió}
    banderas = collections.defaultdict(set)                                   # (cuenta, nombre) -> {iso}
    usado = collections.defaultdict(set)                                      # nombre -> {cuentas}
    for x in inscripciones or ():
        did, t = str(x.get('discord_id') or ''), str(x.get('texto') or '')
        if not did.isdigit() or '(' in t:
            continue
        ns = _nombres_insc(t)
        if len(ns) != 1:
            continue
        k = real_de(ns[0])
        if len(k) < 2:
            continue
        pruebas[did][k].add(('i', str(x.get('servidor') or ''), str(x.get('cuando') or '')[:10]))
        flags_i[(did, k)].append((str(x.get('servidor') or ''), str(x.get('cuando') or '')[:10],
                                  {_iso(b) for b in _BANDERA.findall(t)}))
        como[did][k].add(_sin_bandera(t).strip()[:40])
        usado[k].add(did)
        banderas[(did, k)].update(_iso(b) for b in _BANDERA.findall(t))
    for ev, n, did in menciones or ():
        k, did = real_de(n), str(did or '')
        if len(k) < 2 or not did.isdigit():
            continue
        # la clave del evento es «nombre|SV|DD/MM»: la misma llave guardada con dos nombres cuenta una vez
        partes = str(ev).split('|')
        pruebas[did][k].add(('m', partes[1] if len(partes) > 2 else '', partes[-1]))
        como[did][k].add(_sin_bandera(n).strip()[:40])
        usado[k].add(did)
    # ⚠️ POR PERSONA: «¿Ckl es Hinjkybesuk?» ya pregunta «¿Ckl es BNA?» si Hinjkybesuk es BNA (14/10/2026)
    ya = {frozenset((real_de(a), real_de(b))) for a, b in preguntados or ()}
    out = {'unir': [], 'enganchar': [], 'preguntar': []}
    for did in sorted(pruebas):
        por = pruebas[did]
        propios = fila_de.get(did, set())
        otros = {k for k in por if k not in propios}         # TODOS los nombres que usa además del suyo
        for k in sorted(otros):
            if k not in con_puntos or k in fuera:
                continue                                     # sin puntos aparte no hay nada partido
            if cuenta_de.get(k) not in (None, did) or usado[k] - {did}:
                continue                                     # es la fila de otra cuenta, o lo usó otra
            n, a = len(por[k]), con_puntos[k]
            visto = sorted(como[did][k])
            equipo = bool(_EQUIPO_RE.search(a)) or es_equipo(a)
            unico = otros == {k}
            if propios:
                real = sorted(propios)[0]
                b = como_figura.get(real, real)
                if son_distintos(a, b) or any(juegan.get(k, set()) & juegan.get(r, set()) for r in propios):
                    continue                                 # marcados distintos, o jugaron el mismo evento
                par = frozenset((real_de(a), real_de(b)))
                juega = any(r in con_puntos or juegan.get(r) for r in propios)
                x = {'alias': a, 'real': b, 'did': did, 'pruebas': n, 'como': visto}
                # 🔑 R2: varios nombres, pero cada prueba firmada por su cuenta y con su bandera, y sin rol de staff
                r2 = None
                # ⚠️ 3 LETRAS O MÁS: «nadie más usa ese nombre» sale de los apodos de Discord, que sólo guardan de 3
                # (`_apodos()`), así que con 2 daba siempre «nadie»
                if con_rol is not None and not equipo and len(propios) == 1 and len(k) >= 3:
                    deja = {(iso_de or (lambda _p: ''))(pais_de.get(did))} | solas_b.get(did, set())
                    validas = {(sv_, d_) for sv_, d_, fl in flags_i.get((did, k), []) if fl <= deja}
                    svs_v = sorted({sv_ for sv_, _d in validas})
                    if (len(validas) >= DOS_PRUEBAS and not any(con_rol(did, sv_) for sv_ in svs_v)
                            and not (set(cuentas_con_nombre(k) or ()) - {did})):
                        r2 = dict(x, regla='R2', pruebas=len(validas), svs=svs_v, preguntado=par in ya)
                if par in ya:
                    if r2:
                        out['unir'].append(r2)               # R2 contesta la pregunta que ya estaba
                    continue                                 # ya está preguntado: lo contesta Dlx
                if (n >= DOS_PRUEBAS and unico and not equipo and len(propios) == 1
                        and (juega or _se_parecen(a, b))):
                    out['unir'].append(x)
                elif r2:
                    # `si_no`: lo que se hacía antes de R2, si R2 no puede actuar (`una_cuenta_dos_nombres()`)
                    out['unir'].append(dict(r2, si_no='preguntar' if n >= DOS_PRUEBAS or _se_parecen(a, b) else None))
                elif n >= DOS_PRUEBAS or _se_parecen(a, b):
                    out['preguntar'].append(x)
            elif n >= DOS_PRUEBAS and unico and not equipo and en_la_liga(did):
                cc = {c for c in banderas.get((did, k)) or () if liga is None or c in liga}
                out['enganchar'].append({'nombre': como_figura.get(k) or a, 'did': did, 'pruebas': n,
                                         'fila': k in sin_cuenta, 'como': visto,
                                         'cc': next(iter(cc)) if len(cc) == 1 else ''})
    return out


def _dos_datos():
    """`(real_de, con_puntos, juegan, akas)` de esta corrida, para `una_cuenta_dos_nombres()` y `cierres_solos()`."""
    import construir_akas as AK
    akas = AK.cargar() or {}
    alias = {norm(_sin_bandera(a)): norm(_sin_bandera(b)) for a, b in (akas.get('alias') or {}).items()}
    # 🔑 y los que R2 unió en esta corrida: la hoja AKAs se rearma después, y sin esto «¿Ckl es Hinjkybesuk?» esperaba
    # una corrida más aunque «Ckl» ya fuera BNA
    alias.update(_ALIAS_EXTRA)

    def real_de(n):
        k, vistos = norm(_sin_bandera(n)), set()
        while k in alias and k not in vistos:
            vistos.add(k)
            k = alias[k]
        return k

    con_puntos = {}
    for r in _datos('temporada_pool') or []:
        if (r.get('pts') or 0) > 0 and r.get('raw'):
            con_puntos.setdefault(real_de(r['raw']), r['raw'])
    juegan = {}
    ll = _datos('llaves_t1') or {}
    for x in (ll.values() if isinstance(ll, dict) else ll):
        if isinstance(x, dict):
            for f in x.get('tabla') or ():
                juegan.setdefault(real_de(f[0]), set()).add(x.get('n'))
    return real_de, con_puntos, juegan, akas


def _persona_de(real_de):
    """`f(nombre) -> la persona`, normalizada: `real_de` si lo hay; si no, el nombre normalizado."""
    return (lambda n: real_de(n) or norm(_sin_bandera(n))) if real_de else (lambda n: norm(_sin_bandera(n)))


def filtrar_r2(unir, preguntas, resp, no, no_pares, dlx_nombres, dlx_pares, real_de=None):
    """🔑 R2: `(unir, de_vuelta, rel)`. Pura. De lo que `dos_nombres()` quiere unir, las de R2 se quedan sólo si tienen
    alguna pregunta ABIERTA y SIN CONTESTAR que contestar (`rel[id(x)]`) y nada las frena: una respuesta de Dlx sin
    aplicar (`resp`) a cualquier pregunta de ese nombre o ese par, una fila que él ya resolvió (`dlx_nombres`,
    `dlx_pares`), una pregunta deshecha (`no`) o el par deshecho alguna vez (`no_pares`). Las que no, `de_vuelta` si
    antes de R2 se preguntaban (`si_no`). Las que no son de R2 pasan tal cual.

    🔴 POR PERSONA, NO POR NOMBRE (la tercera revisión, 14/10/2026): en el Sheet están «Ckl → BNA» y «Ckl →
    Hinjkybesuk», y AKAs dice Hinjkybesuk → BNA. Un «Es otra persona» de Dlx a la de Hinjkybesuk es un «Ckl no es BNA»,
    y comparando los nombres escritos R2 igual escribía Ckl → BNA. Los dos lados pasan por `real_de`."""
    per = _persona_de(real_de)
    no_per = {frozenset((per(a), per(b))) for a, b in no_pares or ()}
    rel, sigue, de_vuelta = {}, [], []
    for x in unir:
        if x.get('regla') != 'R2':
            sigue.append(x)
            continue
        ka, kr = norm(_sin_bandera(x['alias'])), norm(_sin_bandera(x['real']))
        par = frozenset((per(x['alias']), per(x['real'])))
        todas = _preguntas_de_alias(preguntas, x['alias'], x['real'], real_de)
        frena = ((ka, kr) in no_pares or par in no_per or ka in dlx_nombres or per(x['alias']) in dlx_nombres
                 or par in dlx_pares or any(q['id'] in no or q['id'] in resp for q in todas))
        abiertas = [q for q in todas if q['id'] not in no and q['id'] not in resp]
        if frena or not abiertas:
            if x.get('si_no') == 'preguntar':
                de_vuelta.append(x)
            continue
        rel[id(x)] = abiertas
        sigue.append(x)
    return sigue, de_vuelta, rel


def una_cuenta_dos_nombres(dry=True, preguntas=(), respuestas=None, hechas=()):
    """👥 `dos_nombres()` con los datos de la corrida, y lo hace: los alias, las cuentas y las preguntas.

    `preguntas` son las abiertas de ✅ Decidir, contestadas o no: un par que ya está preguntado no se une solo aunque
    lleguen más pruebas —la respuesta es de Dlx—. `respuestas`: lo que Dlx contestó y todavía no se aplicó; `hechas`:
    las filas de `Pendientes` que ya resolvió él (`_abiertas_de_pendientes()`).

    🔑 R2 SÓLO CONTESTA PREGUNTAS ABIERTAS Y SIN CONTESTAR, siempre por `resolver_solo()` —se ve en el Dashboard y se
    puede deshacer— y escribiendo el alias ANTES de cerrarlas. No actúa si Dlx ya dijo algo de ese nombre o ese par
    (una respuesta sin aplicar, una fila que resolvió él) ni si deshizo esa unión alguna vez (`pares_deshechos()`, para
    siempre). Sin pregunta abierta, o frenada, hace lo de antes de R2 (`si_no`: preguntar «¿X es Y?»), y esa pregunta la
    contesta R2 en la corrida siguiente. (La revisión del 14/10/2026: R2 unía pisando un «Es otra persona» de Dlx sin
    aplicar, y lo que unía sin pregunta no se veía ni se podía deshacer.)"""
    import construir_akas as AK
    real_de, con_puntos, juegan, akas = _dos_datos()
    ident = (_datos('identidad_llaves') or {}).get('eventos') or {}
    menciones = [(ev, n, d) for ev, v in ident.items() for n, d in ((v or {}).get('menciones') or {}).items()]
    svs = _datos('servidores_de') or {}
    try:
        from padron_t1 import PAIS_ISO
        liga = set(PAIS_ISO.values())
    except Exception:                                    # noqa: BLE001
        liga = set()
    try:
        import pendientes as _PE
        es_equipo = _PE._es_equipo_con_nombre
    except Exception:                                    # noqa: BLE001
        es_equipo = lambda n: False                      # noqa: E731
    preguntados = [_DOS_RE.match(p['detalle']).groups()[:2] for p in preguntas or ()
                   if p.get('tipo') == 'Alias posible' and _DOS_RE.match(p.get('detalle') or '')]
    # 🔑 R2: el rol de staff (`llaves_a_entrada.con_rol()`, el mismo de las llaves de broma), el país de la Lista y las
    # cuentas de Discord que se llaman así
    try:
        if os.path.join(BASE, 'bot') not in sys.path:
            sys.path.append(os.path.join(BASE, 'bot'))
        import llaves_a_entrada as _LAE
        _rol = lambda did, sv: _LAE.con_rol(did, sv)    # noqa: E731
    except Exception:                                    # noqa: BLE001
        _rol = None
    try:
        from padron_t1 import PAIS_ISO as _PI
    except Exception:                                    # noqa: BLE001
        _PI = {}
    # ⚠️ R2 (14/10/2026): SIN EL CACHÉ DE APODOS NO SE SABE SI OTRA CUENTA SE LLAMA ASÍ, y «nadie más usa ese nombre»
    # daba siempre que no. Sin él, R2 no corre
    r2_ok = _rol is not None and os.path.exists(APODOS)
    # ⚠️ «otra persona» POR PERSONA (`_distintos_persona()`): «Ckl no es Hinjkybesuk» frena también Ckl → BNA
    r = dos_nombres((_datos('anuncios') or {}).get('inscripciones') or [], menciones, _datos('padron') or [],
                    con_puntos, juegan, real_de,
                    son_distintos=lambda a, b: AK.son_distintos(a, b, akas) or _distintos_persona(a, b, akas, real_de),
                    fuera=no_rankear(), en_la_liga=lambda did: bool(_servidores_de(did, svs)),
                    preguntados=preguntados, liga=liga or None, es_equipo=es_equipo,
                    con_rol=_rol if r2_ok else None, iso_de=lambda pais: _PI.get(pais) or '',
                    cuentas_con_nombre=lambda k: set(_apodos().get(k) or ()))
    # 🔑 R2: QUÉ LA FRENA y a qué pregunta contesta. Lo que no puede contestar vuelve a lo de antes (`si_no`)
    resp = respuestas or {}
    r['unir'], de_vuelta, rel = filtrar_r2(r['unir'], preguntas, resp, deshechas(), pares_deshechos(),
                                           *_lo_que_dlx_contesto(preguntas, resp, hechas, real_de), real_de=real_de)
    r['preguntar'] = r['preguntar'] + de_vuelta
    # lo que pasa del tope no se hace solo: se pregunta
    unir, eng = r['unir'][:TOPE_DOS], r['enganchar'][:TOPE_DOS]
    preg = r['preguntar'] + r['unir'][TOPE_DOS:]
    if not (unir or eng or preg):
        return r
    print('\n   👥 una cuenta, dos nombres: %d se unen · %d con su cuenta · %d a ✅ Decidir'
          % (len(unir), len(eng), len(preg)))
    for x in unir:
        print('      unir: %s -> %s (%d prueba(s))%s' % (x['alias'], x['real'], x['pruebas'],
                                                        ' [R2]' if x.get('regla') == 'R2' else ''))
    for x in eng:
        print('      cuenta: %s <- %s (%d prueba(s)%s)' % (x['nombre'], x['did'], x['pruebas'],
                                                        '' if x['fila'] else ', fila nueva'))
    for x in preg:
        print('      pregunta: ¿%s es %s? (%d prueba(s))' % (x['alias'], x['real'], x['pruebas']))

    r2s = [x for x in unir if x.get('regla') == 'R2' and rel.get(id(x))]

    def contestar_r2():
        # 🤖 R2: las preguntas que ya estaban («¿Ckl es BNA?», «¿quién es JB?») se contestan, con la prueba. ⚠️ TODAS
        # llevan el alias que se escribió: «Deshacer» cualquiera de ellas lo saca y reabre las otras (`deshacer()`)
        ids = set()
        for x in r2s:
            porque = ('«%s» se anotó %d vez/veces sola desde la cuenta de %s (%s, en %s) y %s no jugó esos eventos con '
                      'su nombre; nadie más usa ese nombre y %s no es organizador, staff, host ni socio ahí'
                      % (x['alias'], x['pruebas'], x['real'], ', '.join('«%s»' % c for c in x['como'][:3]),
                         ', '.join(x.get('svs') or []), x['real'], x['real']))
            for q in rel[id(x)]:
                if resolver_solo(q, MISMA if q['tipo'] == 'Alias posible' else 'Es %s' % x['real'], 'R2', porque,
                                 escribio={'alias': [x['alias'], x['real']]}):
                    ids.add(q['id'])
        return ids

    def unidos(filas):
        # recién con el alias escrito: el resto de la corrida ya lo ve (`_dos_datos()`), y lo que `cierres_solos()`
        # cierre gracias a él queda atado a esta unión (`_UNION_DE`)
        for x in r2s:
            k = (norm(_sin_bandera(x['alias'])), norm(_sin_bandera(x['real'])))
            _ALIAS_EXTRA[k[0]] = k[1]
            _UNION_DE[k[0]] = dict({'alias': [x['alias'], x['real']]},
                                   **({'filas': sorted(set(filas[k]))} if (filas or {}).get(k) else {}))
    ids = contestar_r2()
    if dry:
        unidos({})
        return r
    # 🔴 PRIMERO SE ESCRIBE, DESPUÉS SE CIERRA (como `por_discord()` y `tipeos()`): si la hoja AKAs falla, las
    # preguntas quedan abiertas en vez de cerradas sin alias. 📝 Y ANTES DE ESCRIBIR, ANOTADO (`anotar_pendientes()`)
    anotar_pendientes(ids, dry=False)
    filas = {}
    if unir:
        try:
            filas = _agregar_akas([[x['alias'], x['real'], ''] for x in unir], [])
        except Exception:
            retirar_pendientes(ids, dry=False)
            raise
        poner_filas_aka(ids, filas, dry=False)
    unidos(filas)
    con_fila = [(x['nombre'], x['did']) for x in eng if x['fila']]
    if con_fila:
        for did, err in (_poner_ids(con_fila) or {}).items():
            print('      ⚠️ %s: %s' % (did, err))
    nuevas = [(x['nombre'], x['cc'], x['did'], 'alta automática · una cuenta, dos nombres · %d prueba(s) · %s'
               % (x['pruebas'], _ahora_et())) for x in eng if not x['fila']]
    if nuevas:
        import lista_raperos as LR
        LR.agregar_varios(nuevas, aplicar=True)
    if preg:
        import pendientes as PE
        # 🔎 cómo se anotó de verdad: la cuenta de Pcyka escribió «CyK», que en el ranking es «Crack and Krank»
        PE.anotar_varios([('Alias posible', DOS_ORIGEN,
                           'DOS NOMBRES: «%s» → «%s» · cuenta %s' % (x['alias'], x['real'], x['did']),
                           '%d prueba(s) · se anotó como %s' % (x['pruebas'], ', '.join('«%s»' % c for c in x['como'][:3])))
                          for x in preg])
    return r


# ── 👥 dos cuentas, una persona ─────────────────────────────────────────

#: la pregunta de `dos_cuentas()` (tipo `Alias posible`): alias → real, la cuenta del alias y la del real
_DOS_C_RE = re.compile(r'^DOS CUENTAS: «(.+?)» → «(.+?)» · cuentas (\d+) y (\d+)')
DOS_C_ORIGEN = 'el ciclo · dos cuentas, una persona'
#: la pregunta de `duplicados_corrida()`: el que entró después, su nombre, servidor y fecha, el original y su nombre
_DUP_RE = re.compile(r'^DUPLICADO: #(\d+) «(.*?)» · (\S+) · (\S+) = #(\d+) «(.*?)» · (\d+) de (\d+)')
DUP_ORIGEN = 'el ciclo · el mismo evento, dos veces'
SACAR_DUP = 'Sí, es el mismo: sacar el #'
NO_DUP = 'No, son eventos distintos'


def dos_cuentas(lista, con_puntos, juegan, real_de, son_distintos=lambda a, b: False, preguntados=()):
    """👥 DOS CUENTAS, UNA PERSONA: `[{alias, real, did_alias, did_real}]` para preguntar en ✅ Decidir. Pura.

    🔑 Dlx, 07/10/2026: *«riferian es erian… el bot no detectó que erian se inscribió así o que le inscribieron
    así… asegurate que el bot detecte bien las cosas»*, y de la cuenta, *«sí, esa es su otra cuenta»*. Riferian
    tenía su propia fila con su propia cuenta (@_5thofnovember, «Riferian (uma cryu)» en Urban), así que
    `dos_nombres()` —que busca UNA cuenta con dos nombres— no podía verlo: eran dos cuentas.

    Se pregunta, NUNCA se une solo: dos cuentas las decide Dlx (`lista_raperos.py` tampoco fusiona dos IDs). Pide todo:
    las dos filas con cuenta, cuentas distintas, el MISMO país, un nombre dentro del otro (el corto de 4 letras o
    más: «Erian» en «Riferian») o casi iguales, los dos con puntos —si no, no hay nada partido— y que NUNCA hayan
    jugado el mismo evento. Ni marcados distintos ni ya preguntados. El alias es el que tiene menos eventos.
    """
    filas = []
    for r in lista or ():
        did = str(r.get('discord_id') or '').strip()
        k = real_de(r.get('raw') or r.get('full') or '')
        if did.isdigit() and k and k in con_puntos and juegan.get(k):
            filas.append((k, did, norm(_sin_bandera(str(r.get('pais') or ''))), r.get('raw') or r.get('full')))
    ya = {frozenset((norm(_sin_bandera(a)), norm(_sin_bandera(b)))) for a, b in preguntados or ()}
    out, vistos = [], set()
    for i, (ka, da, pa, na) in enumerate(filas):
        for kb, db, pb, nb in filas[i + 1:]:
            if ka == kb or da == db or not pa or pa != pb:
                continue
            corto, largo = sorted((ka, kb), key=len)
            if not ((len(corto) >= 4 and corto in largo)
                    or difflib.SequenceMatcher(None, ka, kb).ratio() >= 0.85):
                continue
            if juegan.get(ka, set()) & juegan.get(kb, set()):
                continue                                     # jugaron el mismo evento: son dos
            if son_distintos(na, nb) or frozenset((ka, kb)) in ya or frozenset((ka, kb)) in vistos:
                continue
            vistos.add(frozenset((ka, kb)))
            (al, dal), (re_, dre) = sorted(((na, da), (nb, db)), key=lambda x: len(juegan.get(real_de(x[0]), ())))
            out.append({'alias': al, 'real': re_, 'did_alias': dal, 'did_real': dre})
    return out


def dos_cuentas_corrida(dry=True, preguntas=()):
    """👥 `dos_cuentas()` con los datos de la corrida: lo que encuentra va a ✅ Decidir, nada más."""
    import construir_akas as AK
    real_de, con_puntos, juegan, akas = _dos_datos()
    preguntados = [_DOS_C_RE.match(p['detalle']).groups()[:2] for p in preguntas or ()
                   if p.get('tipo') == 'Alias posible' and _DOS_C_RE.match(p.get('detalle') or '')]
    r = dos_cuentas(_datos('padron') or [], con_puntos, juegan, real_de,
                    son_distintos=lambda a, b: AK.son_distintos(a, b, akas), preguntados=preguntados)
    if not r:
        return r
    print('\n   👥 dos cuentas, una persona: %d a ✅ Decidir' % len(r))
    for x in r:
        print('      pregunta: ¿%s es otra cuenta de %s?' % (x['alias'], x['real']))
    if not dry:
        import pendientes as PE
        PE.anotar_varios([('Alias posible', DOS_C_ORIGEN,
                           'DOS CUENTAS: «%s» → «%s» · cuentas %s y %s' % (x['alias'], x['real'], x['did_alias'],
                                                                        x['did_real']),
                           'el mismo país, nombres parecidos y nunca jugaron el mismo evento') for x in r])
    return r


def numeros_a_sacar():
    """Los números de evento que Dlx dijo que son OTRO evento contado dos veces (`sacar` de decisiones.json).
    `procesar_entrada.sacar_descartados()` los saca de las tres hojas y del hub."""
    out = set()
    for k in (_decisiones().get('sacar') or {}):
        try:
            out.add(int(k))
        except ValueError:
            pass
    return out


def duplicados_corrida(dry=True, preguntas=()):
    """👯 EL MISMO EVENTO CARGADO DOS VECES, a ✅ Decidir. Nunca saca nada solo.

    🔑 Dlx, 07/10/2026 (las mejoras, «dale, haz todo»): el #358 y el #409 llevaban dos semanas y un día sumando
    doble, y los encontró un jugador que se quejaba de otra cosa. `llaves_a_entrada.duplicados_cargados()` los busca
    en cada corrida —las mismas batallas, del mismo servidor, el mismo día o el siguiente— y acá se preguntan.
    Ni lo ya preguntado, ni lo que Dlx dijo que son distintos, ni lo que ya se va a sacar.
    """
    if os.path.join(BASE, 'bot') not in sys.path:
        sys.path.append(os.path.join(BASE, 'bot'))
    import llaves_a_entrada as LAE
    d = _decisiones()
    ya = {(int(m.group(1)), int(m.group(5))) for m in (_DUP_RE.match(p.get('detalle') or '') for p in preguntas or ()
                                                       if p.get('tipo') == 'Evento duplicado') if m}
    ya |= {tuple(x) for x in d.get('no_duplicados') or []}
    sacar = numeros_a_sacar()
    por_n = {}
    for x in LAE._cargadas():
        try:
            por_n[int(x.get('n'))] = x
        except (TypeError, ValueError):
            pass
    nuevos = [(dup, orig, c, t) for dup, orig, c, t in LAE.duplicados_cargados()
              if (dup, orig) not in ya and dup not in sacar and orig not in sacar]
    if not nuevos:
        return nuevos
    print('\n   👯 el mismo evento dos veces: %d a ✅ Decidir' % len(nuevos))
    filas = []
    for dup, orig, c, t in nuevos:
        a, b = por_n.get(dup) or {}, por_n.get(orig) or {}
        print('      pregunta: ¿el #%d «%s» es el #%d «%s»? (%d de %d batallas)'
              % (dup, a.get('nombre', ''), orig, b.get('nombre', ''), c, t))
        filas.append(('Evento duplicado', DUP_ORIGEN,
                      'DUPLICADO: #%d «%s» · %s · %s = #%d «%s» · %d de %d batallas'
                      % (dup, a.get('nombre', ''), a.get('sv', ''), a.get('fecha', ''), orig, b.get('nombre', ''), c, t),
                      'las mismas batallas, del mismo servidor y el mismo día: suma dos veces'))
    if not dry:
        import pendientes as PE
        PE.anotar_varios(filas)
    return nuevos


def _agregar_cuenta(real, did):
    """La cuenta `did` como OTRA cuenta de `real` (`cuentas` de `datos/akas_a_mano.json`: abre sus cartas)."""
    p = os.path.join(BASE, 'datos', 'akas_a_mano.json')
    with io.open(p, encoding='utf-8', newline='') as f:
        crudo = f.read()
    nl = '\r\n' if '\r\n' in crudo else '\n'
    d = json.loads(crudo)
    ids = d.setdefault('cuentas', {}).setdefault(real, [])
    if did not in ids:
        ids.append(did)
        with io.open(p, 'w', encoding='utf-8', newline='') as f:
            f.write(json.dumps(d, ensure_ascii=False, indent=1).replace('\n', nl) + (nl if crudo.endswith(nl) else ''))


def _sacar_id(nombre, did):
    """Le saca a la fila `nombre` de la Lista su Discord ID, si es `did`: pasa a ser la otra cuenta de alguien."""
    import lista_raperos as LR
    v = LR.leer()
    _i, col = LR.mapa(v)
    fs = LR.filas_de(v, nombre)
    if len(fs) != 1 or LR._celda(fs[0][1], col['Discord ID']) != did:
        return False
    letra = chr(ord('A') + col['Discord ID'])
    LR.respaldar(v, 'id')
    LR._E().poner(LR._rango(LR.HOJA, '%s%d' % (letra, fs[0][0])), [['']])
    return True


#: las dos formas de «Alias posible» que escribe el backfill del repo de sync
_ALIAS_TIENE = re.compile(r"AKA '(.+?)' \(fila (\d+)\) ya tiene ID (\d+), el log trae (\d+)")
_ALIAS_ID = re.compile(r"ID (\d+) ya pertenece a fila (\d+) \((.+?)\); no se asignó a '(.+?)'")


def _norm_lig(s):
    """`norm()` con las ligaduras abiertas: «xervœ» es «xervoe»."""
    s = str(s or '')
    for a, b in (('œ', 'oe'), ('Œ', 'OE'), ('æ', 'ae'), ('Æ', 'AE'), ('ß', 'ss')):
        s = s.replace(a, b)
    return norm(_sin_bandera(s))


def _nombres_en_resultados():
    """`{nombre normalizado sin bandera: {números de evento}}` de lo que hoy tiene alguna fila en `Resultados`; `None`
    si no se pudo leer. Una lectura por corrida (la usan `cierres_solos()` y `reglas()`)."""
    if 'resultados' in _DATOS:
        return _DATOS['resultados']
    try:
        from escribir import Hoja
        out, con_b = {}, set()
        for f in Hoja('Resultados').filas():
            f = [str(x).strip() for x in list(f) + [''] * 5]
            k = norm(_sin_bandera(f[4]))
            if k:
                out.setdefault(k, set()).add(f[0])
                con_b.add((k, ''.join(sorted(_BANDERA.findall(f[4])))))
        _DATOS['resultados'] = out
        # el nombre con sus banderas, como agrupa `armar()`: para R11 (`cierres_solos()`)
        _DATOS['resultados_b'] = con_b
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ no pude leer Resultados: %s' % str(e)[:60])
        _DATOS['resultados'] = None
    return _DATOS['resultados']


def cierres_solos(preguntas, dry=True):
    """`{id: motivo}` de lo que no hace falta preguntar, y lo cierra (en seco, sólo lo dice).

    🔑 Dlx, 01/10/2026: *«no pongas cualquier cosa sencilla que puedas hacer tú mismo en Decidir»*. Dos cosas que
    tienen respuesta segura y se le preguntaban igual:

      · «¿es la misma persona?» (`Alias posible`, del backfill), cuando la respuesta se lee sola: el AKA es el
        mismo nombre de la fila con una ligadura —«xervœ» y «Xervoe»—, o la otra cuenta ya es OTRA persona de la
        Lista —la de «o.e.p» es la de MILICA—, o ya no está en ningún servidor de la Liga. Las dos respuestas
        cierran igual (la Lista se queda con la cuenta que tiene): se cierra diciendo cuál y por qué. Los que
        siguen abiertos son los de verdad: dos cuentas de la Liga para un mismo nombre.
      · «¿quién es X?» cuando X ya no está en ningún resultado: el lector lo lee distinto (`SIX 🇦🇷 R` ahora es
        `SIX 🇦🇷`) o ya es alias de alguien. ⚠️ Sólo con `Resultados` leído: si no se pudo, no se cierra nada.
    """
    por_id = _lista_por_id()
    svs = _datos('servidores_de') or {}
    _apodos()
    hay_donde = bool(_DATOS.get('donde'))
    out, nombres, dos, regla_de, esc_de = {}, False, None, {}, {}
    no = deshechas()
    for p in preguntas:
        if p['id'] in no:
            continue
        det = p['detalle']
        # 👥 «¿X es Y?» de `una_cuenta_dos_nombres()` que ya no hace falta: X ya es alias de Y (lo unió otro camino,
        # como `por_discord()` en la misma corrida), o X ya no suma aparte
        m = (_DOS_RE.match(det) or _DOS_C_RE.match(det)) if p['tipo'] == 'Alias posible' else None
        if m:
            if dos is None:
                try:
                    dos = _dos_datos()
                except Exception:                        # noqa: BLE001
                    dos = False
            if dos:
                real_de, con_puntos = dos[0], dos[1]
                if real_de(m.group(1)) == real_de(m.group(2)):
                    out[p['id']] = 'la misma persona: «%s» ya es alias de %s' % (m.group(1), m.group(2))
                    # 🔗 si es gracias al alias que R2 escribió en esta corrida, va atada a esa unión: «Deshacer» la
                    # unión la reabre también (`_UNION_DE`, `deshacer()`)
                    u = next((_UNION_DE[norm(_sin_bandera(n))] for n in (m.group(1), m.group(2))
                              if norm(_sin_bandera(n)) in _UNION_DE), None)
                    if u:
                        esc_de[p['id']] = dict(u)
                elif real_de(m.group(1)) not in con_puntos:
                    out[p['id']] = 'ya no hace falta: «%s» ya no suma aparte en el ranking' % m.group(1)
            continue
        if p['tipo'] == 'Alias posible':
            m = _ALIAS_ID.search(det)
            if m and _norm_lig(m.group(3)) == _norm_lig(m.group(4)):
                out[p['id']] = 'la misma persona: «%s» es «%s» escrito distinto' % (
                    m.group(4), _sin_bandera(m.group(3)).strip())
                continue
            m = _ALIAS_TIENE.search(det)
            if m:
                quien = por_id.get(m.group(4))
                if quien and _norm_lig(quien) != _norm_lig(m.group(1)):
                    out[p['id']] = 'otra persona: la cuenta del log es la de «%s» en la Lista' % quien
                elif not quien and hay_donde and not _servidores_de(m.group(4), svs):
                    out[p['id']] = ('otra cuenta: la del log ya no está en ningún servidor de la Liga, y la Lista se '
                                    'queda con la que tiene')
        elif p['tipo'] == 'Nombre desconocido' and _nums(p):
            if nombres is False:
                nombres = _nombres_en_resultados()
            ks = [norm(_sin_bandera(v)) for v in p.get('variantes') or [det]]
            if nombres and not any(k in nombres for k in ks):
                out[p['id']] = 'ya no está en ningún resultado: el lector lo lee distinto, o ya es alias de alguien'
            # 🔑 R11 (13/10/2026): Y SI ESTÁ, QUE SEA EN SU EVENTO. G8 (#425) se preguntaba porque «g8» seguía en el #354 y
            # el #381, pero en el #425 ya no estaba: ahí la cuenta de Gocho se había anotado «Akutagawa🇹🇼»
            # ⚠️ Y QUE ESE MISMO NOMBRE, CON SUS BANDERAS, NO SIGA EN OTRO EVENTO: la fila de `Pendientes` es UNA por
            # nombre —no se vuelve a anotar en el evento siguiente—, así que «Volk 🇲🇽» del #352 es también el que sigue
            # sin resolver en el #353 y el #354. Cerrarla lo escondía
            # 🔴 Y CON `Resultados` LEÍDO Y CON ALGO: `{}` es un dict, y con la hoja vacía (o recién borrada) cerraba todo
            elif (nombres and isinstance(nombres, dict) and not any(nombres.get(k, set()) & set(_nums(p)) for k in ks)
                  and not any((norm(_sin_bandera(v)), ''.join(sorted(_BANDERA.findall(v))))
                              in (_DATOS.get('resultados_b') or set()) for v in p.get('variantes') or [det])):
                out[p['id']] = ('ya no está en su evento (#%s): el lector lo lee distinto, o ya es alias de alguien'
                                % ', #'.join(_nums(p)))
                regla_de[p['id']] = 'R11'
    if out:
        print('\n   🧹 se cierran solas %d pregunta(s):' % len(out))
        for p in preguntas:
            if p['id'] in out:
                print('      %s — %s' % (p['detalle'][:60], out[p['id']]))
    # 🤖 la fila de `Pendientes` la cierra `flush_solas()`, con la regla y la prueba
    for p in preguntas:
        if p['id'] in out:
            r = out[p['id']]
            resolver_solo(p, MISMA if r.startswith('la misma persona') else
                          OTRA if r.startswith(('otra persona', 'otra cuenta')) else YA_NO, regla_de.get(p['id'], 'cierre'), r,
                          escribio=esc_de.get(p['id']))
    return out


# ── 🤖 lo que se resolvió solo ──────────────────────────────────────────
# 🔑 Dlx, 13/10/2026: lo que el ciclo cierra o contesta solo tiene que verse en el Dashboard, con la regla, la prueba y
# un «Deshacer». TODO pasa por `resolver_solo()`: las reglas viejas (`por_discord()`, `tipeos()`, `cierres_solos()`) y
# las que Dlx aprobó ese día (`reglas()` y R2 en `una_cuenta_dos_nombres()`). `flush_solas()` cierra las filas de
# `Pendientes` en UNA escritura y las anota en `SOLAS`, que viaja al Dashboard (`publicar_web()`, clave `solas`). Lo
# que Dlx deshace vuelve a ✅ Decidir y la regla no se le aplica más (`deshacer()`, `deshechas()`).

SOLAS = os.path.join(BASE, 'datos', 'decidir_solas.json')
#: cuántos días se muestra (y se puede deshacer) lo resuelto solo
SOLAS_DIAS = 14
#: la respuesta de lo que sólo se cierra: no hay nada que decidir
YA_NO = 'Ya no hace falta'
#: qué hace cada regla, en palabras: va con cada pregunta que cerró o contestó
REGLAS = {
    'Discord': 'su cuenta de Discord: la inscripción, el podio, la llave o la llamada',
    'tipeo': 'el nombre de alguien de la Lista con una letra de diferencia',
    'cierre': 'ya no hacía falta preguntarlo',
    'R1': 'lo que ya no existe: un evento sacado, un 5 vidas ya decidido, un duplicado ya sacado',
    'R2': 'una cuenta de la Lista que se anota con otro nombre donde su dueño no jugó',
    'R3': 'un alta que no hace falta: el bot, o una cuenta que buscó otro y no jugó',
    'R4': 'una batalla que es copia de otra ya cargada',
    'R5': 'una llave «de broma» que ya se cargó o que se borró',
    'R6': '«nadie siguió», como contestaron todas las demás de esa ronda',
    'R11': 'el nombre ya no está en su evento',
    'R12': 'un bracket incompleto que es un pedazo de un evento ya cargado',
    'R16': 'Dlx dijo que no es esa persona, y no hay otra cuenta con ese nombre',
    'R19': 'la ronda que la escala 8-15 no tenía ahora paga 625',
}
#: lo resuelto solo en esta corrida, hasta `flush_solas()`
_SOLAS = []
_SOLAS_D = {}
#: 🔑 los alias que R2 unió en esta corrida (`_dos_datos()` los suma): `{alias normalizado: real normalizado}`
_ALIAS_EXTRA = {}
#: 🔗 y lo que escribió cada unión, `{alias normalizado: {'alias': [a, b], 'filas': [n]}}`: lo que `cierres_solos()` cierra
#: gracias a ese alias va atado a ella, y «Deshacer» la unión lo reabre también (la tercera revisión, 14/10/2026)
_UNION_DE = {}


def _solas_d():
    """`{'solas': [...], 'deshechas': [ids]}` de `SOLAS`, leído una vez."""
    if 'd' not in _SOLAS_D:
        try:
            with io.open(SOLAS, encoding='utf-8') as f:
                d = json.load(f) or {}
        except (OSError, ValueError):
            d = {}
        d.setdefault('solas', [])
        d.setdefault('deshechas', [])
        _SOLAS_D['d'] = d
    return _SOLAS_D['d']


def deshechas():
    """Los ids que Dlx deshizo: ninguna regla los vuelve a cerrar ni a contestar."""
    return set(_solas_d().get('deshechas') or [])


def pares_deshechos():
    """`{(alias, real)}` normalizados de las uniones que Dlx deshizo: R2 no las vuelve a hacer NUNCA, haya pregunta
    abierta o no (la revisión del 14/10/2026: deshacer y después contestar «Es alguien nuevo» dejaba que R2 volviera
    a unir en la corrida siguiente)."""
    return {tuple(x) for x in _solas_d().get('pares_deshechos') or [] if len(x) == 2}


def resolver_solo(p, respuesta, regla, porque, por='el ciclo', escribio=None):
    """🤖 LA ÚNICA PUERTA de lo que el ciclo cierra o contesta solo. Anota la pregunta con la respuesta, la regla y la
    prueba en una línea; la fila de `Pendientes` la cierra `flush_solas()`. `escribio`: lo que la regla escribió y
    «Deshacer» tiene que sacar —`{'alias': [a, b]}`, `{'batalla': detalle}` o `{'alta': [nombre, id]}`—.

    ⚠️ Lo que Dlx deshizo no pasa (`deshechas()`), y una pregunta se resuelve una vez por corrida. Devuelve si la anotó.
    """
    if p['id'] in deshechas() or any(x['p']['id'] == p['id'] for x in _SOLAS):
        return False
    _SOLAS.append({'p': p, 'r': str(respuesta), 'regla': regla, 'porque': str(porque), 'por': por,
                   'escribio': escribio or {}})
    return True


def _ahora_ms():
    """Ahora, en milisegundos desde 1970 (UTC): así lo lee el Dashboard (`Number(x.t)`, `bot/avisos.js`)."""
    return int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)


def _t_ms(t):
    """`t` de una entrada de `SOLAS` en ms. Las primeras se guardaron como texto ISO: se convierten."""
    if isinstance(t, (int, float)):
        return int(t)
    return _ms_iso(str(t or '').replace('Z', '')) or 0


def _regla_dicha(regla):
    return '%s · %s' % (regla, REGLAS[regla]) if regla in REGLAS else str(regla)


def _guardar_solas(d):
    """`SOLAS`, sin lo de más de `SOLAS_DIAS` días. Lo deshecho no se poda: sus filas, su alias y su id sirven para que
    ninguna regla lo vuelva a tocar NUNCA (`deshechas()`, `pares_deshechos()`, `pendientes.barrer()`)."""
    corte = _ahora_ms() - SOLAS_DIAS * 86400000
    d['solas'] = [x for x in d.get('solas') or [] if x.get('deshecha') or _t_ms(x.get('t')) >= corte]
    d['_leeme'] = ('Lo que ✅ Decidir cerró o contestó solo, con la regla y la prueba (sheet/decidir.py, '
                   'resolver_solo()), para «Lo que se resolvió solo» del Dashboard y su «Deshacer». '
                   '«deshechas»: lo que Dlx deshizo; ninguna regla lo vuelve a tocar. Dlx, 13/10/2026.')
    with io.open(SOLAS, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(d, f, ensure_ascii=False, indent=1)
        f.write('\n')


def flush_solas(dry=True):
    """🤖 Cierra en `Pendientes`, en UNA escritura, todo lo anotado con `resolver_solo()`, y lo suma a `SOLAS`.
    En seco sólo lo dice. Devuelve los ids."""
    if not _SOLAS:
        return set()
    ids = {x['p']['id'] for x in _SOLAS}
    print('\n   🤖 se resolvieron solas %d pregunta(s):' % len(_SOLAS))
    for x in _SOLAS:
        print('      [%s] %s → %s · %s' % (x['regla'], x['p']['detalle'][:48], x['r'][:40], x['porque'][:110]))
    if dry:
        _SOLAS[:] = []
        return ids
    from escribir import _pedir
    _pedir('POST', '/values:batchUpdate', json={
        'valueInputOption': 'RAW',
        'data': [{'range': 'Pendientes!F%d:H%d' % (n, n),
                  'values': [['Resuelto', ('%s — %s' % (x['r'], x['porque']))[:480],
                              '%s (%s)' % (x['por'], x['regla'])]]}
                 for x in _SOLAS for n in x['p']['filas']]})
    d, t = _solas_d(), _ahora_ms()
    # ✅ lo que estaba anotado como «pendiente» (`anotar_pendientes()`) se confirma: la entrada se reemplaza
    d['solas'] = [y for y in d['solas'] if not (y.get('pendiente') and y.get('id') in ids)]
    for x in _SOLAS:
        d['solas'].append(_entrada_sola(x, t))
    try:
        _guardar_solas(d)
    except OSError as e:
        print('   ⚠️ no pude guardar lo resuelto solo (%s)' % str(e)[:60])
    _SOLAS[:] = []
    return ids


def _entrada_sola(x, t, pendiente=False):
    """La entrada de `SOLAS` de algo anotado con `resolver_solo()`. `rk`, `por` y `variantes`: con qué se escribió
    cada fila, para que «Deshacer» reabra sólo si sigue así. `pendiente`: anotado ANTES de escribir afuera."""
    q = x['p']
    e = {'id': q['id'], 'tipo': q['tipo'], 'sec': str((q.get('seccion') or ('', ''))[1])[:120],
         'que': str(q.get('que') or q['detalle'])[:400], 'r': x['r'][:160],
         'regla': _regla_dicha(x['regla']), 'rk': x['regla'], 'por': x['por'],
         'porque': x['porque'][:600], 't': t, 'filas': q['filas'],
         'variantes': list(q.get('variantes') or [q['detalle']]), 'escribio': x['escribio']}
    if pendiente:
        e['pendiente'] = True
    return e


def anotar_pendientes(ids, dry=True):
    """📝 LO QUE SE VA A ESCRIBIR AFUERA QUEDA ANOTADO ANTES (la tercera revisión, 14/10/2026). Un alias, una batalla o
    un alta se escriben y la fila de `Pendientes` la cierra `flush_solas()` al final: si la corrida se caía entre las
    dos cosas, lo escrito quedaba sin registro y no se podía deshacer. Ahora va a `SOLAS` como «pendiente» antes de
    escribir; `flush_solas()` lo confirma, `retirar_pendientes()` lo saca si la escritura falla, y
    `recuperar_pendientes()` lo termina en la corrida siguiente si quedó a medias. En seco no hace nada."""
    if dry or not ids:
        return
    d, t = _solas_d(), _ahora_ms()
    d['solas'] = [y for y in d['solas'] if not (y.get('pendiente') and y.get('id') in ids)]
    d['solas'] += [_entrada_sola(x, t, pendiente=True) for x in _SOLAS if x['p']['id'] in ids]
    _guardar_solas(d)


def retirar_pendientes(ids, dry=True):
    """Lo anotado como pendiente cuya escritura falló: sale de `SOLAS` y de lo que se cierra en esta corrida."""
    if not ids:
        return
    _SOLAS[:] = [x for x in _SOLAS if x['p']['id'] not in ids]
    if dry:
        return
    d = _solas_d()
    d['solas'] = [y for y in d['solas'] if not (y.get('pendiente') and y.get('id') in ids)]
    _guardar_solas(d)


def poner_filas_aka(ids, filas, dry=True):
    """Las filas de AKAs donde quedó cada alias (`_agregar_akas()`), en lo anotado: «Deshacer» borra ESAS filas y sólo
    si siguen diciendo eso (`_sacar_akas()`). ⚠️ Y SE VUELVE A GUARDAR LO PENDIENTE APENAS SE CONOCEN (la cuarta
    revisión, 14/10/2026): si no, lo anotado antes de escribir quedaba sin fila, y al recuperarlo se le podía atribuir
    a la regla una fila que escribió otro."""
    con = set()
    for x in _SOLAS:
        a = (x.get('escribio') or {}).get('alias')
        if x['p']['id'] in ids and a and len(a) >= 2:
            f = (filas or {}).get((norm(_sin_bandera(a[0])), norm(_sin_bandera(a[1]))))
            if f:
                x['escribio'] = dict(x['escribio'], filas=sorted(set(f)))
                con.add(x['p']['id'])
    anotar_pendientes(con, dry=dry)


def filas_escritas(esc):
    """Las filas de AKAs que escribió una regla, de su `escribio` (`filas`; `fila`, de antes)."""
    esc = esc or {}
    return list(esc.get('filas') or ([esc['fila']] if esc.get('fila') else []))


def _escrito_existe(e, aka_filas):
    """¿Lo que escribió una entrada pendiente está escrito de verdad? `aka_filas`: las filas A:C de AKAs."""
    esc = e.get('escribio') or {}
    if esc.get('alias'):
        k = (norm(_sin_bandera(esc['alias'][0])), norm(_sin_bandera(esc['alias'][1])))
        filas = [i for i, f in enumerate(aka_filas, 1)
                 if len(f) >= 2 and (norm(_sin_bandera(f[0])), norm(_sin_bandera(f[1]))) == k]
        # ⚠️ sin las filas que escribió la regla, NO SE ATRIBUYE: el par puede estar en una fila de otro (la cuarta
        # revisión, 14/10/2026). Se retira sin cerrar
        return bool(filas_escritas(esc)) and any(f in filas for f in filas_escritas(esc))
    if esc.get('batalla'):
        v = (_decisiones().get('batallas') or {}).get(clave_batalla(esc['batalla'])) or {}
        return str(v.get('por') or '').startswith('el ciclo')
    if esc.get('alta'):
        return str(esc['alta'][1]) in _lista_por_id()
    return True


def recuperar_pendientes(preguntas, dry=True, respuestas=None, hechas=()):
    """♻️ Lo que una corrida anotó como pendiente y no llegó a confirmar (`anotar_pendientes()`). Ids que se cierran.

      · si lo escrito NO está (o no se sabe en qué fila: no se atribuye), la entrada se borra y la pregunta sigue abierta;
      · si está y la pregunta ya no está abierta, queda confirmado (el registro sirve para «Deshacer»);
      · si está y la pregunta sigue abierta, se vuelve a anotar y `flush_solas()` la cierra… SALVO QUE DLX HAYA DICHO OTRA
        COSA (la cuarta revisión, 14/10/2026): una respuesta suya a esa pregunta (`respuestas`), o un freno de R2 sobre
        ese alias —lo que contestó de ese nombre o ese par (`hechas`), lo que deshizo, un `no_confundir`, POR PERSONA—.
        Entonces lo que escribió la regla es lo que Dlx no quiso: se saca (`retirar_lo_escrito()`) y la entrada se borra,
        y su respuesta la aplica `aplicar()` en esta misma corrida. Lo que no se puede sacar solo —un alias sin fila
        conocida, un alta en la Lista— queda en el Dashboard con un aviso, para que lo saque él.
    """
    d = _solas_d()
    pend = [y for y in d.get('solas') or [] if y.get('pendiente') and not y.get('deshecha')]
    if not pend:
        return set()
    aka = []
    con_alias = any((y.get('escribio') or {}).get('alias') for y in pend)
    if con_alias:
        import requests
        from escribir import _pedir
        aka = _pedir('GET', '/values/%s' % requests.utils.quote('AKAs!A1:C800')).get('values', [])
    resp = respuestas or {}
    # los frenos de R2, por persona: los datos de esta corrida (sin el alias pendiente, que justo es lo que se discute)
    real_de, akas = None, {}
    if con_alias:
        try:
            _rd, _cp, _jg, akas = _dos_datos()
            # ⚠️ el alias pendiente YA ESTÁ en AKAs: con él, «Ckl» ya sería BNA y el par Ckl–BNA se volvía una sola
            # persona. La persona de cada nombre se mira como si ese alias no estuviera
            _pa = {norm(_sin_bandera((y.get('escribio') or {})['alias'][0])) for y in pend
                   if (y.get('escribio') or {}).get('alias')}

            def real_de(n, _rd=_rd, _pa=_pa):
                k = norm(_sin_bandera(n))
                return k if k in _pa else _rd(n)
        except Exception:                                # noqa: BLE001
            real_de, akas = None, {}
    dlx_n, dlx_p = _lo_que_dlx_contesto(preguntas, resp, hechas, real_de)
    per = _persona_de(real_de)
    no_p = {frozenset((per(a), per(b))) for a, b in pares_deshechos()}
    abiertas = {p['id']: p for p in preguntas or ()}
    vuelven, sacar, contra = set(), set(), []
    for y in pend:
        esc = y.get('escribio') or {}
        if not _escrito_existe(y, aka):
            sacar.add(y['id'])
            continue
        if frena_pendiente(y, resp, dlx_n, dlx_p, no_p, akas, real_de):
            contra.append(y)
        elif y['id'] in abiertas:
            _SOLAS.append({'p': abiertas[y['id']], 'r': y.get('r') or '', 'regla': y.get('rk') or '',
                           'porque': y.get('porque') or '', 'por': y.get('por') or 'el ciclo', 'escribio': esc})
            vuelven.add(y['id'])
        else:
            y.pop('pendiente', None)
    print('\n   ♻️ lo que quedó a medias en otra corrida: %d se cierran ahora · %d sin lo escrito, se borran · %d con '
          'otra respuesta de Dlx, se saca lo escrito' % (len(vuelven), len(sacar), len(contra)))
    for y in contra:
        print('      %s — Dlx dijo otra cosa: %s' % (str(y.get('que') or y.get('id'))[:60], y.get('escribio')))
    if dry:
        return vuelven
    quedan = retirar_lo_escrito(contra, aka)
    for y in contra:
        if y['id'] in quedan:
            # ⚠️ lo que no se pudo sacar solo queda a la vista, con el aviso: «Deshacer» lo intenta de nuevo
            y.pop('pendiente', None)
            y['r'] = '⚠️ Dlx contestó otra cosa'
            y['porque'] = ('%s · ⚠️ Dlx contestó otra cosa antes de que se cerrara, y lo que escribió la regla (%s) no se '
                           'pudo sacar solo: sacalo con «Deshacer»' % (y.get('porque') or '', quedan[y['id']]))[:600]
        else:
            sacar.add(y['id'])
    d['solas'] = [y for y in d['solas'] if not (y.get('pendiente') and y.get('id') in sacar)]
    _guardar_solas(d)
    return vuelven


def frena_pendiente(y, resp, dlx_n, dlx_p, no_p, akas, real_de=None):
    """¿Dlx dijo otra cosa sobre lo que una entrada pendiente escribió? Pura. Una respuesta suya a esa pregunta
    (`resp`), y si escribió un alias, los frenos de R2 POR PERSONA: lo que contestó de ese nombre o ese par
    (`dlx_n`, `dlx_p`), una unión deshecha (`no_p`, pares de personas) o un `no_confundir` (`akas`)."""
    if y.get('id') in (resp or {}):
        return True
    a = (y.get('escribio') or {}).get('alias')
    if not a or len(a) < 2:
        return False
    per = _persona_de(real_de)
    par = frozenset((per(a[0]), per(a[1])))
    return bool(par in no_p or par in dlx_p or norm(_sin_bandera(a[0])) in dlx_n
                or _distintos_persona(a[0], a[1], akas, real_de))


def retirar_lo_escrito(entradas, aka):
    """Saca lo que escribieron unas entradas de `SOLAS` a las que Dlx les contestó otra cosa: el alias, de las filas que
    escribió la regla y si siguen diciendo eso (`filas_aka_a_sacar()`); la decisión de batalla, si es del ciclo.
    `{id: qué quedó}`: lo que no se pudo sacar solo (un alias sin fila conocida, un alta en la Lista)."""
    quedan, escritos = {}, []
    for y in entradas:
        esc = y.get('escribio') or {}
        if esc.get('alias'):
            fs = filas_escritas(esc)
            if fs:
                escritos += [(esc['alias'][0], esc['alias'][1], f) for f in fs]
            else:
                quedan[y['id']] = 'el alias «%s → %s»' % (esc['alias'][0], esc['alias'][1])
        if esc.get('alta'):
            quedan[y['id']] = 'el alta de %s con %s' % tuple(esc['alta'][:2])
    if escritos:
        import requests
        from escribir import _pedir
        filas, avisos = filas_aka_a_sacar(escritos, aka)
        for x in avisos:
            print('      ⚠️ %s' % x)
        if filas:
            _pedir('POST', '/values:batchUpdate', json={'valueInputOption': 'RAW', 'data': [
                {'range': 'AKAs!A%d:C%d' % (i, i), 'values': [['', '', '']]} for i in filas]})
    bats = [(y.get('escribio') or {}).get('batalla') for y in entradas if (y.get('escribio') or {}).get('batalla')]
    if bats:
        dd = _decisiones()
        for det in bats:
            v = (dd.get('batallas') or {}).get(clave_batalla(det))
            if v and str(v.get('por') or '').startswith('el ciclo'):
                dd['batallas'].pop(clave_batalla(det), None)
        with io.open(DECISIONES, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(dd, f, ensure_ascii=False, indent=1)
            f.write('\n')
    return quedan


def solas_web():
    """`[{id, tipo, sec, que, r, regla, porque, t}]`: lo resuelto solo en los últimos `SOLAS_DIAS` días y no deshecho,
    lo más nuevo primero. Va al Dashboard en `publicar_web()`. `t` en milisegundos (un número)."""
    corte = _ahora_ms() - SOLAS_DIAS * 86400000
    out = [dict({k: x.get(k) for k in ('id', 'tipo', 'sec', 'que', 'r', 'regla', 'porque')}, t=_t_ms(x.get('t')))
           for x in _solas_d().get('solas') or []
           if not x.get('deshecha') and not x.get('pendiente') and _t_ms(x.get('t')) >= corte]
    return sorted(out, key=lambda x: x['t'], reverse=True)[:300]


def filas_aka_a_sacar(escritos, v):
    """`(filas, avisos)`: las filas de AKAs que «Deshacer» borra. Pura. `escritos`: `[(alias, real, fila o None)]`;
    `v`: las filas A:C de la hoja.

    🔴 SÓLO LA QUE ESCRIBIÓ LA REGLA (la tercera revisión, 14/10/2026). «La última del par» no alcanzaba: si deshacer se
    caía después de borrar, el reintento borraba la ANTERIOR, que podía ser de Dlx. Con la fila anotada
    (`_agregar_akas()`), se borra ésa y sólo si sigue diciendo eso; sin fila (lo de antes de esto), sólo si el par está
    UNA vez. Si no, no se toca y se avisa."""
    filas, avisos = [], []
    for a, b, fila in escritos:
        k = (norm(_sin_bandera(a)), norm(_sin_bandera(b)))
        hay = [i for i, f in enumerate(v, 1) if len(f) >= 2 and (norm(_sin_bandera(f[0])), norm(_sin_bandera(f[1]))) == k]
        if fila:
            if fila in hay:
                filas.append(fila)
            else:
                avisos.append('la fila %d de AKAs ya no dice «%s → %s»: no se toca' % (fila, a, b))
        elif len(hay) == 1:
            filas.append(hay[0])
        elif hay:
            avisos.append('«%s → %s» está %d veces en AKAs y no sé cuál escribió la regla: no se toca' % (a, b, len(hay)))
    return sorted(set(filas)), avisos


def _sacar_akas(escritos):
    """Borra de la hoja AKAs las filas `alias -> real` que escribió una regla (Deshacer): ver `filas_aka_a_sacar()`."""
    import requests
    from escribir import _pedir
    v = _pedir('GET', '/values/%s' % requests.utils.quote('AKAs!A1:C800')).get('values', [])
    filas, avisos = filas_aka_a_sacar(escritos, v)
    for x in avisos:
        print('      ⚠️ %s' % x)
    datos = [{'range': 'AKAs!A%d:C%d' % (i, i), 'values': [['', '', '']]} for i in filas]
    if datos:
        _pedir('POST', '/values:batchUpdate', json={'valueInputOption': 'RAW', 'data': datos})
    return len(datos)


def _par_escrito(x):
    """El alias que escribió una entrada de `SOLAS`, normalizado: `(alias, real)`, o `None`."""
    a = (x.get('escribio') or {}).get('alias')
    return (norm(_sin_bandera(a[0])), norm(_sin_bandera(a[1]))) if a and len(a) >= 2 else None


def filas_a_reabrir(hay, filas):
    """`(reabrir, no)`: las filas de `Pendientes` de lo deshecho que SIGUEN SIENDO las que cerró la regla —el mismo tipo,
    el mismo nombre, `Resuelto` y con esa regla en «Resuelto por»— y las que no (se tocaron después: no se pisan). Pura:
    `filas` es `{n: {columna: valor}}`.

    ⚠️ Y LA QUE CERRÓ `pendientes.barrer()` («el ciclo» a secas, la cuarta revisión del 14/10/2026): lo recuperado de
    una corrida a medias pudo cerrarse ahí —el nombre ya resolvía con el alias de la regla—, y Deshacer sacaba el alias
    sin reabrir la pregunta: quedaba un nombre sin pregunta."""
    si, no = [], []
    for x in hay:
        vs = {norm(_sin_bandera(v)) for v in x.get('variantes') or []}
        por = '%s (%s)' % (x.get('por') or 'el ciclo', x['rk']) if x.get('rk') else None
        for n in x.get('filas') or []:
            f = filas.get(n) or {}
            ok = (f.get('Tipo') == x.get('tipo') and str(f.get('Estado') or '').lower() == 'resuelto'
                  and (not vs or norm(_sin_bandera(f.get('Detalle'))) in vs)
                  and (f.get('Resuelto por') in (por, 'el ciclo') if por
                       else str(f.get('Resuelto por') or '').startswith('el ciclo')))
            (si if ok else no).append(n)
    return si, no


def deshacer(ids, dry=True):
    """↩️ LO QUE DLX DESHIZO EN EL DASHBOARD («Lo que se resolvió solo» → Deshacer): vuelve a ✅ Decidir y la regla
    no se le aplica más.

    Saca lo que la regla escribió —el alias de la hoja AKAs, la batalla de `decisiones.json` (sólo si la escribió el
    ciclo)— y reabre sus filas de `Pendientes`. ⚠️ UNA FILA NUEVA DE LA LISTA (un alta) NO SE BORRA SOLA: se avisa, y la
    saca una persona —borrar a alguien de la Lista es identidad—. Devuelve los ids que deshizo."""
    nuevas = set(ids or ()) - deshechas()
    if not nuevas:
        return []
    d = _solas_d()
    hay = [x for x in d.get('solas') or [] if x.get('id') in nuevas and not x.get('deshecha')]
    # 🔑 UNA UNIÓN ES UNA: deshacer «¿quién es Ckl?» deshace también «¿Ckl es BNA?», que R2 cerró con el mismo alias.
    # Si no, el alias se iba y la otra quedaba cerrada diciendo que eran la misma persona
    pares = {_par_escrito(x) for x in hay} - {None}
    hay += [x for x in d.get('solas') or [] if not x.get('deshecha') and x not in hay and _par_escrito(x) in pares]
    nuevas |= {x['id'] for x in hay}
    print('\n   ↩️ Dlx deshizo %d desde el Dashboard%s' % (len(nuevas), '' if hay else ' (ninguna la había cerrado una regla)'))
    for x in hay:
        print('      %s — %s · %s' % (x['id'], x.get('r'), (x.get('escribio') or {}) or 'no escribió nada'))
    if dry:
        return sorted(nuevas)
    from escribir import _pedir
    # ⚠️ TODAS las filas que la regla escribió para cada par (el mismo par dos veces en una corrida son dos filas); sin
    # ninguna conocida, una entrada sin fila (`filas_aka_a_sacar()` decide)
    akas, sin_fila = {}, {}
    for x in hay:
        if _par_escrito(x):
            a = x['escribio']['alias']
            fs = filas_escritas(x['escribio'])
            if fs:
                akas.setdefault(_par_escrito(x), set()).update((a[0], a[1], f) for f in fs)
            else:
                sin_fila.setdefault(_par_escrito(x), (a[0], a[1], None))
    escritos = [t for v in akas.values() for t in sorted(v)] + [v for k, v in sin_fila.items() if k not in akas]
    if escritos:
        print('      alias que se sacan de AKAs: %d' % _sacar_akas(escritos))
    bats = [x['escribio']['batalla'] for x in hay if (x.get('escribio') or {}).get('batalla')]
    if bats:
        dd = _decisiones()
        for det in bats:
            v = (dd.get('batallas') or {}).get(clave_batalla(det))
            if v and str(v.get('por') or '').startswith('el ciclo'):
                dd['batallas'].pop(clave_batalla(det), None)
        with io.open(DECISIONES, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(dd, f, ensure_ascii=False, indent=1)
            f.write('\n')
    for x in hay:
        if (x.get('escribio') or {}).get('alta'):
            print('      ⚠️ %s entró a la Lista con %s: esa fila queda (sacala a mano si no va)'
                  % tuple(x['escribio']['alta']))
    # ⚠️ SÓLO LA FILA QUE SIGUE SIENDO LA QUE SE CERRÓ: hasta 14 días después, alguien pudo haberla tocado
    filas = []
    if any(x.get('filas') for x in hay):
        import pendientes as _PE
        hoja = {n: {c: str((list(f) + [''] * _PE.ANCHO)[i]).strip() for i, c in enumerate(_PE.COLS)}
                for n, f in _PE._filas_con_n(_PE._hoja())}
        filas, otras = filas_a_reabrir(hay, hoja)
        for n in otras:
            print('      ⚠️ la fila %d de Pendientes ya no es la que cerró la regla: no se toca' % n)
    if filas:
        _pedir('POST', '/values:batchUpdate', json={
            'valueInputOption': 'RAW',
            'data': [{'range': 'Pendientes!F%d:H%d' % (n, n), 'values': [['Pendiente', '', '']]} for n in filas]})
    t = _ahora_ms()
    for x in hay:
        x['deshecha'] = t
        # ↩️ las que de verdad se reabrieron: sólo ésas las saltea `pendientes.barrer()` (las que no se tocaron, no)
        x['reabiertas'] = [n for n in x.get('filas') or [] if n in set(filas)]
    d['deshechas'] = sorted(deshechas() | nuevas)
    # 🔑 y el par, para siempre: R2 no lo vuelve a unir aunque no haya pregunta (`pares_deshechos()`)
    d['pares_deshechos'] = sorted({tuple(x) for x in d.get('pares_deshechos') or [] if len(x) == 2}
                                  | {_par_escrito(x) for x in hay if _par_escrito(x)})
    _guardar_solas(d)
    return sorted(nuevas)


def _por_otro(match):
    """¿Un alta que buscó OTRA persona con /card (`por: 'otro'`)? Lo dice `registrar_ids.match_alta()`; las filas de
    antes sólo traían «sv FFA» —el camino propio siempre agrega el motivo—."""
    m = str(match or '').strip()
    return bool(re.match(r'^sv \S+$', m)) or 'lo buscó otra persona' in m


_AKAS = []


def _son_distintos_de(det, svs=()):
    """`f(nombre) -> bool`: si ese nombre está marcado como OTRA persona que `det` en AKAs (`no_confundir`), con la
    bandera y el servidor de esta pregunta (`distintos_aca()`): lo del Force 🇲🇽 de FVS no vale para el Force de URBF."""
    try:
        import construir_akas as AK
        if not _AKAS:
            _AKAS.append(AK.cargar() or {})
        sig = _siglas()
        return lambda y: distintos_aca(det, y, _AKAS[0], svs, sig)
    except Exception:                                    # noqa: BLE001
        return lambda y: False


def _ms_iso(x):
    """`'2026-10-12T20:14:31'` (UTC, como lo guarda `bot/anuncios.py`) → ms, o `None`."""
    try:
        t = datetime.datetime.fromisoformat(str(x or '').replace('Z', ''))
        return int(t.replace(tzinfo=datetime.timezone.utc).timestamp() * 1000)
    except ValueError:
        return None


def _cuentas_insc(p):
    """🔎 R17: `[{id, usuario, nombre, sv, real}]` de las cuentas que se anotaron CON ESE NOMBRE para el evento de la
    pregunta: en su servidor, desde 12 h antes de la llave hasta que terminó (`_ventana()`), sola o como la de la
    pareja que lleva su usuario (`es_su_usuario()`). `real`: su nombre en la Lista, si está.

    🔑 «TRRR 🇦🇷» (#462) lo escribió la cuenta de BNA a las 4:14 PM ET y la llave salió a las 8:26 PM; las opciones eran
    Hassan, nuevo o troll. ⚠️ Es una opción, no una respuesta: el staff anota a otros (Player a Steven)."""
    k = norm(_sin_bandera(p.get('detalle')))
    if len(k) < 2 or p.get('tipo') != 'Nombre desconocido':
        return []
    ins = (_datos('anuncios') or {}).get('inscripciones') or []
    por_id = _lista_por_id()
    out, vistos = [], set()
    for n in _nums(p):
        try:
            ev, desde, hasta = _ventana(n)
        except Exception:                                # noqa: BLE001
            continue
        if not ev or desde is None:
            continue
        for x in ins:
            did = str(x.get('discord_id') or '')
            if x.get('servidor') != ev[1] or not did.isdigit() or did in vistos:
                continue
            t = _ms_iso(x.get('cuando'))
            if t is None or not (desde - 12 * 3600000 <= t <= hasta):
                continue
            ns = _nombres_insc(x.get('texto'))
            if not ((len(ns) == 1 and ns[0] == k) or (len(ns) > 1 and k in ns and es_su_usuario(k, x.get('quien')))):
                continue
            vistos.add(did)
            out.append({'id': did, 'usuario': str(x.get('quien') or ''), 'nombre': str(x.get('texto') or '')[:40],
                        'sv': [ev[1]], 'real': por_id.get(did), 'rol': _con_rol_en(did, ev[1])})
    return out


def _con_rol_en(did, sv):
    """¿Esa cuenta es organizadora, staff o host en ese servidor? (`llaves_a_entrada.con_rol()`). Sin saberlo, no."""
    try:
        if os.path.join(BASE, 'bot') not in sys.path:
            sys.path.append(os.path.join(BASE, 'bot'))
        import llaves_a_entrada as _LAE
        return _LAE.con_rol(did, sv)
    except Exception:                                    # noqa: BLE001
        return False


def _preguntas_de_alias(preguntas, alias, real, real_de=None):
    """Las preguntas abiertas que contesta «`alias` es `real`»: el «¿es la misma persona?» de ese par —POR PERSONA:
    «¿Ckl es Hinjkybesuk?» también, si Hinjkybesuk ya es BNA (`real_de`)— y el «¿quién es `alias`?». Para R2."""
    per = _persona_de(real_de)
    ka, quiero = norm(_sin_bandera(alias)), {per(alias), per(real)}
    out = []
    for q in preguntas or ():
        m = _DOS_RE.match(q.get('detalle') or '') if q.get('tipo') == 'Alias posible' else None
        if m and {per(m.group(1)), per(m.group(2))} == quiero:
            out.append(q)
        elif q.get('tipo') == 'Nombre desconocido' and norm(_sin_bandera(q.get('detalle'))) == ka:
            out.append(q)
    return out


def _distintos_persona(a, b, akas, real_de=None):
    """¿Un `no_confundir` de AKAs dice que `a` no es `b`? POR PERSONA (`real_de`): «Ckl no es Hinjkybesuk» es también
    «Ckl no es BNA» si Hinjkybesuk ya es BNA. Para `dos_nombres()`, donde antes se comparaban los nombres escritos."""
    per = _persona_de(real_de)
    pa, pb = per(a), per(b)
    na, nb = norm(_sin_bandera(a)), norm(_sin_bandera(b))
    for x in (akas or {}).get('no_confundir') or []:
        if len(x) < 2:
            continue
        if ({per(x[0]), per(x[1])} == {pa, pb}
                or {norm(_sin_bandera(x[0])), norm(_sin_bandera(x[1]))} == {na, nb}):
            return True
    return False


def _lo_que_dlx_contesto(preguntas, respuestas, hechas, real_de=None):
    """`({nombres}, {frozenset(par)})` normalizados sobre los que Dlx ya dijo algo: lo contestado sin aplicar
    (`respuestas`) y las filas de `Pendientes` que resolvió él (`hechas`). Frenan a R2. Los pares, POR PERSONA
    (`real_de`): «¿Ckl es Hinjkybesuk?» contestado es también «¿Ckl es BNA?»."""
    per = _persona_de(real_de)
    nombres, pares = set(), set()

    def sumar(tipo, det, variantes=()):
        if tipo == 'Nombre desconocido':
            nombres.update(norm(_sin_bandera(v)) for v in list(variantes or ()) + [det] if v)
        m = (_DOS_RE.match(det or '') or _DOS_C_RE.match(det or '')) if tipo == 'Alias posible' else None
        if m:
            pares.add(frozenset((per(m.group(1)), per(m.group(2)))))
    for p in preguntas or ():
        if p['id'] in (respuestas or {}):
            sumar(p['tipo'], p['detalle'], p.get('variantes'))
    for _n, d in hechas or ():
        sumar(str(d.get('Tipo') or ''), str(d.get('Detalle') or ''))
    nombres.discard('')
    return nombres, pares


def _por_servidor(sv):
    """`{nombre normalizado: real}` de lo que en ESE servidor es otra persona (`akas_a_mano.json`, `por_servidor`)."""
    ps = ((_datos('akas_a_mano') or {}).get('por_servidor') or {}).get(sv) or {}
    return {norm(_sin_bandera(a)): b for a, b in ps.items()}


def _canon(real_de, sv):
    """`f(lado) -> clave`: un lado como lo dice la Lista —el alias del servidor, después los AKAs—, normalizado."""
    ps = _por_servidor(sv)

    def f(x):
        x0 = _sin_bandera(lado_limpio(x)).strip()
        return real_de(ps.get(norm(x0), x0))
    return f


def _personas(lado):
    """Los integrantes de un lado: «Oasis, Letrao🇨🇱» son dos."""
    return [x for x in re.split(r'\s*(?:,|\+|&)\s*', str(lado or '')) if x.strip()]


def _evento_llave(ev, sv, fecha, ll=None):
    """`(número, llave)` del evento cargado con ese nombre, servidor y fecha (`datos/llaves_t1.json`), o `(None, None)`."""
    for n, L in (ll if ll is not None else _llaves_t1()).items():
        if (norm(_limpio(L.get('nombre'))) == norm(_limpio(ev)) and L.get('fecha') == fecha
                and (not L.get('sv') or L.get('sv') == sv)):
            return n, L
    return None, None


def copia_de(det, ll, canon):
    """🔑 R4: `(número, [lados], ganador)` de la batalla YA RESUELTA de la que `det` (una «Batalla sin ganador») es copia
    —el mismo evento, la misma ronda y los mismos lados por AKAs—, o `None`. Pura.

    FVS UNDER (#461) se leyó de dos mensajes: el segundo, con las semis y la final vacías, volvió a meter los cuatro
    cuartos con los nombres crudos («Rfran🇪🇸 vs Ricard🇪🇨»), y cada uno quedó «sin ganador» aunque el cuartos ya estaba
    cargado (Refran–Richard, ganó Refran). Contestar «Ganó X» lo habría contado dos veces."""
    x = partes_batalla(det)
    if not x or len(x[4]) < 2:
        return None
    ev, sv, fecha, ronda, lados = x
    n, L = _evento_llave(ev, sv, fecha, ll)
    if not L:
        return None
    quiero = {canon(l) for l in lados}
    for R in L.get('rondas') or []:
        if ronda_canon(R.get('r')) != ronda_canon(ronda):
            continue
        for b in R.get('b') or []:
            nota = str(b[2] if len(b) > 2 else '').lower()
            if not b or not b[1] or 'sin ganador' in nota or 'nadie siguió' in nota:
                continue
            if {canon(l) for l in b[0]} == quiero:
                return n, list(b[0]), b[1]
    return None


def pedazo_de(match, sv, fecha, ll, canon):
    """🔑 R12: `(número, nombre)` del evento cargado que YA TIENE todas las batallas de un «Bracket incompleto» —el mismo
    servidor, ±1 día, las mismas personas en cada batalla—, o `None`. Pura.

    «LA REDENCION VOL.3» (FFA, 10/10/2026) traía «OASIS, LETRAO vs Verc» y «SNOW vs tam»: las semis del #447 LA
    REDENCION, que ya contaba con Oasis y Letrao campeones.

    🔴 (la revisión del 14/10/2026) CON UNA SOLA BATALLA NO ALCANZA: «final: WALKER SANITY vs NOXVELL» (11/10) se cerró
    como pedazo de un evento del 10/10 donde esos dos se cruzaron en cuartos. Ahora pide DOS batallas o más, TODAS en
    ese evento, y cada una en la MISMA ronda cuando la pregunta la dice."""
    segs = segmentos_llave(match)
    if len(segs) < 2:
        return None

    def dia(f):
        m = re.match(r'^(\d{1,2})/(\d{1,2})$', str(f or ''))
        return datetime.date(2026, int(m.group(2)), int(m.group(1))) if m else None
    d0 = dia(fecha)
    if not d0:
        return None
    for n, L in ll.items():
        dl = dia(L.get('fecha'))
        if L.get('sv') != sv or not dl or abs((dl - d0).days) > 1:
            continue
        # cada batalla de la llave como (ronda, el conjunto de su gente); una triple viene en filas con el mismo ganador
        bats = []
        for R in L.get('rondas') or []:
            rc, por_g = ronda_canon(R.get('r')), {}
            for b in R.get('b') or []:
                gente = {canon(p) for lado in b[0] for p in _personas(lado)}
                if b[1] and 'triple' in str(b[2] if len(b) > 2 else '').lower():
                    por_g.setdefault(canon(b[1]), set()).update(gente)
                else:
                    bats.append((rc, gente))
            bats += [(rc, g) for g in por_g.values()]

        def esta(r, lados):
            gente = {canon(p) for lado in lados for p in _personas(lado)}
            return any(g == gente and (r not in ORDEN_RONDAS or rc == r) for rc, g in bats)
        if all(esta(r, lados) for r, lados, _p in segs):
            return n, L.get('nombre')
    return None


def nadie_como_las_demas(det, bat_dec, abiertas):
    """🔑 R6: `[decisiones]` de las OTRAS batallas de esa misma ronda, si TODAS se contestaron «nadie siguió» —por el
    organizador o por Dlx— y no queda otra sin contestar; si no, `None`. Pura.

    DEM UZBEKISTAN FECHA 2 (FFA, 13/10/2026): el organizador contestó «nadie siguió» a los dos tríos de octavos que le
    preguntó; el tercero no se lo preguntaron (el mensaje lleva cuatro batallas como mucho, `finales.MAX_PREGUNTAS`)."""
    x = partes_batalla(det)
    if not x:
        return None
    ev, sv, fecha, ronda, _l = x
    pref = '|'.join([norm(ev), sv.upper(), fecha, norm(ronda)]) + '|'
    yo = clave_batalla(det)
    otras = [v for k, v in (bat_dec or {}).items() if k.startswith(pref) and k != yo]
    if not otras or any((v or {}).get('ganador') != NADIE for v in otras):
        return None
    for q in abiertas or ():
        y = partes_batalla(q.get('detalle')) if q.get('tipo') == 'Batalla sin ganador' else None
        if y and clave_batalla(q['detalle']) != yo and '|'.join([norm(y[0]), y[1].upper(), y[2], norm(y[3])]) + '|' == pref:
            return None
    return otras


def vidas_no_suma(det, eventos, ll, decision, sacar=()):
    """🔑 R1: por qué un «Vidas cargado» ya no hace falta, o `''`. Pura: `decision` es `decision_evento()`; `sacar`, los
    números sacados (`numeros_a_sacar()`).

    «MAÑANA DE LLUVIA VOL 1» (FFA, 07/10/2026) se leyó como 5 vidas y se cargó dos veces (#420, #421); se sacaron por
    número y el evento quedó como lo que era, una llave común (#419). ⚠️ SE CIERRA SIN DECISIÓN: un «No cuenta» va por
    nombre y se llevaría el #419 (NOVEDADES 2.51).

    ⚠️ (la revisión del 14/10/2026) MIRA TODOS LOS CARGADOS CON ESE NOMBRE, MENOS LOS SACADOS: con el primero que
    apareciera, un #420 sacado podía tapar al #419. Y SI NO HAY NINGUNO, NO SE CIERRA: puede ser que `procesar_entrada`
    no lo haya cargado TODAVÍA (falló esa corrida), y «no está cargado» la cerraba para siempre."""
    partes = [x.strip() for x in str(det or '').split(' · ')]
    if len(partes) != 3 or not eventos:
        return ''
    ev, sv, fecha = partes
    if decision is not None:
        return 'ya está decidido: «%s»' % decision
    ns = [k for k, v in eventos.items() if len(v) > 2 and norm(_limpio(v[0])) == norm(_limpio(ev))
          and v[1] == sv and v[2] == fecha and not (str(k).isdigit() and int(k) in set(sacar or ()))]
    if not ns:
        return ''
    rondas = {}
    for n in ns:
        rs = [str(R.get('r') or '') for R in ((ll or {}).get(str(n)) or {}).get('rondas') or []]
        if not rs or any(re.search(r'vidas?', r, re.I) for r in rs):
            return ''                                   # éste sí puede ser el 5 vidas, o no se sabe
        rondas[n] = rs
    return ('%s con ese nombre %s una llave común (%s), no este 5 vidas: éste no suma por ningún lado'
            % (', '.join('el #%s' % n for n in ns), 'es' if len(ns) == 1 else 'son',
               ', '.join(rondas[ns[0]][:4])))


_ESCALA_RE = re.compile(r'^ESCALA: la ronda «([^»]+)» no tiene valor en la escala (\S+)')


def cobran_ronda(ll, nums, puesto):
    """🔑 R19: `'#418: Badterne 625, …'` si en el evento cargado (`datos/llaves_t1.json`, la tabla con la que pagó el
    motor) TODOS los de ese puesto ya cobran algo; `''` si alguno sigue en 0, si no hay nadie ahí o si no está. Pura."""
    out = []
    for n in nums or ():
        tabla = ((ll or {}).get(str(n)) or {}).get('tabla') or []
        ahi = [f for f in tabla if len(f) > 2 and norm(f[1]) == norm(puesto)]
        if not ahi or any(not isinstance(f[2], (int, float)) or f[2] <= 0 for f in ahi):
            return ''
        out.append('#%s: %s' % (n, ', '.join('%s %s' % (f[0], f[2]) for f in ahi[:4])
                                + (' y %d más' % (len(ahi) - 4) if len(ahi) > 4 else '')))
    return '; '.join(out)


def _siglas():
    """Las siglas de los servidores de la Liga (las de las llaves cargadas y de `Eventos Procesados`)."""
    out = {str(L.get('sv') or '') for L in _llaves_t1().values()}
    out |= {str(v[1]) for v in (_DATOS.get('eventos') or {}).values() if len(v) > 1}
    return {s for s in out if re.fullmatch(r'[A-Z]{2,5}', s)}


def _bandera_en_nota(nombre, nota):
    """La bandera que la nota de un `no_confundir` le pone a `nombre` («el Force 🇲🇽 de FVS» → «🇲🇽»), o `''`."""
    m = re.search(r'(?i)(?<![\w])%s\s*((?:[\U0001F1E6-\U0001F1FF]{2})+)' % re.escape(str(nombre or '').strip()),
                  str(nota or ''))
    return banderas_de(m.group(1)) if m else ''


def distintos_aca(det, otro, akas, svs=(), siglas=()):
    """🔑 R16: ¿un `no_confundir` de AKAs dice que `det` NO es `otro`, Y VALE PARA ESTE `det`? Pura.

    🔴 (la revisión del 14/10/2026) «Force» de URBF se cerró como «alguien nuevo» por lo que Dlx dijo del Force 🇲🇽 de
    FVS («no es ForceGP»): la tabla compara sin banderas y sin servidor. Ahora no vale si las banderas no coinciden —la
    de la celda o, si la celda no trae, la que la nota le pone a ese nombre— ni si la nota nombra servidores y
    ninguno es de esta pregunta (`svs`)."""
    kd, ko = norm(_sin_bandera(det)), norm(_sin_bandera(otro))
    fd = banderas_de(det)
    for x in (akas or {}).get('no_confundir') or []:
        a, b, nota = (list(x) + ['', '', ''])[:3]
        if {norm(_sin_bandera(a)), norm(_sin_bandera(b))} != {kd, ko}:
            continue
        lado = a if norm(_sin_bandera(a)) == kd else b
        fl = banderas_de(lado) or _bandera_en_nota(_sin_bandera(lado), nota)
        if fd and fl and fd != fl:
            continue
        nombra = {s for s in siglas or () if re.search(r'(?<![A-Za-z])%s(?![A-Za-z])' % re.escape(s), str(nota or ''))}
        if nombra and not nombra & set(svs or ()):
            continue
        return True
    return False


def reglas(preguntas, eventos, dry=True, todas=None):
    """🤖 LAS REGLAS QUE DLX APROBÓ EL 13/10/2026 —las que sólo cierran o evitan duplicados («sin pedirle nada») y las
    que le pidieron su «Sí»—. Cada una pasa por `resolver_solo()` con su prueba. Devuelve los ids.

      R1  lo que ya no existe: la pregunta de un evento sacado o que ya no está en `Eventos Procesados`; el 5 vidas ya
          decidido o que no es el evento cargado con ese nombre (`vidas_no_suma()`); el duplicado ya sacado
      R3  el alta del bot, y la de una cuenta que buscó otro (`_por_otro()`) y no jugó en la T1
      R4  la batalla que es copia de otra ya resuelta (`copia_de()`): «No se jugó», escrito como del ciclo
      R5  la llave «de broma» (sólo ésa: «nunca había publicado una llave») que ya se cargó (su mensaje es la llave de un
          evento) o que se borró (`cancelados.json`)
      R6  «nadie siguió» si el organizador o Dlx lo contestó a TODAS las demás de esa ronda (`nadie_como_las_demas()`)
      R12 el bracket incompleto que es un pedazo de un evento cargado (`pedazo_de()`)
      R16 el nombre cuya única cuenta es de alguien que Dlx dijo que NO es, con su bandera y su servidor
          (`distintos_aca()`): «Es alguien nuevo». Sin el caché de apodos, no
      R19 el aviso de ESCALA de una ronda que ahora paga (`motor.pago_fuera_de_escala()`) Y que en el evento cargado ya
          cobra (`cobran_ronda()`)

    ⚠️ R4 y R6 ESCRIBEN una decisión de batalla (`datos/decisiones.json`, `por: el ciclo (R4)`): así el lector no la
    vuelve a dejar «sin ganador». «Deshacer» la saca. ⚠️ Y CIERRAN DESPUÉS DE ESCRIBIRLA: si la escritura falla, la
    pregunta queda abierta. Las demás sólo cierran: no escriben nada.

    `preguntas`: las abiertas SIN contestar; `todas`: también las contestadas, para R6 (una hermana con «Ganó X» sin
    aplicar todavía cuenta como abierta)."""
    no = deshechas()
    ps = [p for p in preguntas if p['id'] not in no]
    if not ps:
        return set()
    todas = list(todas) if todas is not None else ps
    hechas = set()
    ll = _llaves_t1()
    sacar = numeros_a_sacar()
    dec = _decisiones()
    bat_dec = dec.get('batallas') or {}
    nuevas_dec = {}
    try:
        import construir_akas as AK
        akas = AK.cargar() or {}
    except Exception:                                    # noqa: BLE001
        AK, akas = None, {}
    real_de = None
    try:
        import motor as MO
    except Exception:                                    # noqa: BLE001
        MO = None
    try:
        with io.open(os.path.join(BASE, 'datos', 'cancelados.json'), encoding='utf-8') as f:
            borradas = {str((v or {}).get('llave') or '') for v in ((json.load(f) or {}).get('eventos') or {}).values()}
        borradas.discard('')
    except (OSError, ValueError):
        borradas = set()
    try:
        sys.path.append(os.path.join(BASE, 'bot'))
        import escuchar as _E
        bot = str(_E.BOT_ID)
    except Exception:                                    # noqa: BLE001
        bot = ''
    por_id = _lista_por_id()
    hay_apodos = os.path.exists(APODOS)
    siglas = _siglas()
    # R4 y R6: lo que se cierra recién cuando su decisión de batalla quedó escrita
    con_dec = []

    def sola(p, r, regla, porque, escribio=None):
        if resolver_solo(p, r, regla, porque, escribio=escribio):
            hechas.add(p['id'])

    for p in ps:
        t, det = p['tipo'], p['detalle']
        nums = _nums(p) if re.match(r'evento\s*#', p.get('origen') or '', re.I) else []
        # ── R1 · el evento de la pregunta ya no existe
        if nums and eventos and t in ('Evento dudoso', 'Nombre desconocido'):
            fuera = [n for n in nums if int(n) in sacar or n not in eventos]
            if len(fuera) == len(nums):
                n = fuera[0]
                nota = ((dec.get('sacar') or {}).get(n) or {}).get('nota') or ''
                sola(p, YA_NO, 'R1', ('el #%s se sacó%s' % (n, ': ' + nota.split(':')[0][:120] if nota else ''))
                     if int(n) in sacar else 'el #%s ya no está en Eventos Procesados' % n)
                continue
        if t == 'Vidas cargado':
            partes = [x.strip() for x in det.split(' · ')]
            por = vidas_no_suma(det, eventos, ll, decision_evento(*partes) if len(partes) == 3 else None, sacar)
            if por:
                sola(p, YA_NO, 'R1', por)
            continue
        if t == 'Evento duplicado':
            m = _DUP_RE.match(det)
            if m and int(m.group(1)) in sacar:
                sola(p, SACAR_DUP + m.group(1), 'R1', 'el #%s ya se sacó (%s)' % (
                    m.group(1), ((dec.get('sacar') or {}).get(m.group(1)) or {}).get('por') or 'ya no está'))
            # ⚠️ si ya no está, no se «sacó»: la respuesta no dice que lo sacamos
            elif m and eventos and m.group(1) not in eventos:
                sola(p, YA_NO, 'R1', 'el #%s ya no está en Eventos Procesados' % m.group(1))
            continue
        # ── R3 · el alta que no hace falta
        if t == 'alta':
            did = det.split(' = ')[-1].strip() if ' = ' in det else ''
            if bot and did == bot:
                sola(p, 'Ya está resuelto', 'R3', 'es el bot de la Liga (ULAYA): alguien le hizo /card')
            elif did.isdigit() and _por_otro(p.get('match')) and not _jugo(did, det.split(' = ')[0]):
                sola(p, 'Ya está resuelto', 'R3', 'no usó /card: lo buscó otra persona, y no jugó en la T1 (ni su '
                     'nombre ni con lo que se anotó está en ningún resultado). Si se anota sola, entra como cualquiera')
            continue
        # ── R4 y R6 · la batalla sin ganador
        if t == 'Batalla sin ganador':
            x = partes_batalla(det)
            if not x:
                continue
            if real_de is None:
                real_de = _dos_datos()[0]
            c = copia_de(det, ll, _canon(real_de, x[1]))
            if c:
                n, lados, g = c
                porque = ('es la misma batalla que «%s» (ganó %s), ya cargada en el #%s: contestar «Ganó» la contaría dos '
                          'veces' % (' vs '.join(lados), g, n))
                nuevas_dec[clave_batalla(det)] = {'ganador': '', 'batalla': det, 'cuando': _ahora_et(),
                                                  'por': 'el ciclo (R4)', 'nota': porque}
                con_dec.append((p, NO_SE_JUGO, 'R4', porque, {'batalla': det}))
                continue
            if 'no aparece nadie' in (p.get('match') or ''):
                # ⚠️ contra TODAS, también las contestadas sin aplicar: un «Ganó X» de una hermana no es «nadie»
                otras = nadie_como_las_demas(det, bat_dec, [q for q in todas if q['id'] != p['id']])
                if otras:
                    quien = sorted({str(v.get('por') or '?') for v in otras})
                    porque = ('en esa misma ronda contestaron «nadie siguió» a las otras %d (%s): %s'
                              % (len(otras), ', '.join(quien)[:120],
                                 '; '.join((v.get('batalla') or '').split(' · ')[-1] for v in otras)[:200]))
                    nuevas_dec[clave_batalla(det)] = {'ganador': NADIE, 'batalla': det, 'cuando': _ahora_et(),
                                                      'por': 'el ciclo (R6)', 'nota': porque}
                    con_dec.append((p, NADIE_SIGUIO, 'R6', porque, {'batalla': det}))
            continue
        # ── R5 y R19 · el evento dudoso
        if t == 'Evento dudoso':
            if 'llaves' in (p.get('origen') or '').lower():
                mid = str(p.get('link') or '').rstrip('/').rsplit('/', 1)[-1]
                # ⚠️ SÓLO LA DE BROMA (`llaves_a_entrada.llave_de_broma()`): una retenida por Interserver o por una fase
                # sin batallas espera el «Sí cuenta» de Dlx aunque su llave se haya cargado con otro nombre
                if mid.isdigit() and 'nunca había publicado una llave' in (p.get('match') or ''):
                    n = next((k for k, L in ll.items() if any(str(u).rstrip('/').rsplit('/', 1)[-1] == mid
                                                             for u in L.get('links') or [])), None)
                    if n:
                        sola(p, YA_NO, 'R5', 'esa llave ya se cargó como el #%s «%s»: cuenta con ese nombre'
                             % (n, _limpio((ll.get(n) or {}).get('nombre'))))
                    elif mid in borradas:
                        sola(p, YA_NO, 'R5', 'esa llave se borró y no hubo otra (`cancelados.json`): no suma')
                continue
            m = _ESCALA_RE.match(det)
            if m and MO is not None:
                puesto = dict(MO.CAIDA).get(MO.ronda_de(m.group(1)))
                pago = MO.pago_fuera_de_escala(m.group(2), puesto) if puesto else 0
                # ⚠️ (la revisión del 14/10/2026) Y QUE YA PAGUE DE VERDAD: el evento cargado tiene que haberse
                # recalculado con la regla —los de esa ronda con puntos—. Hasta entonces el aviso sigue siendo cierto
                ya = cobran_ronda(ll, _nums(p), puesto) if pago else ''
                if ya:
                    sola(p, 'Está bien así', 'R19', 'la ronda «%s» de la escala %s paga %d desde la regla de Dlx del '
                         '13/10 («la ronda que la escala 8-15 no tiene paga 625»), y en el evento cargado ya cobran: %s'
                         % (m.group(1), m.group(2), pago, ya))
            continue
        # ── R12 · el bracket incompleto que ya está cargado con otro nombre
        if t == 'Bracket incompleto':
            partes = [x.strip() for x in det.split(' · ')]
            if len(partes) == 3:
                if real_de is None:
                    real_de = _dos_datos()[0]
                pd = pedazo_de(p.get('match'), partes[1], partes[2], ll, _canon(real_de, partes[1]))
                if pd:
                    sola(p, YA_NO, 'R12', 'sus batallas ya están en el #%s «%s», que ya cuenta: es un pedazo de ese '
                         'evento' % (pd[0], _limpio(pd[1])))
            continue
        # ── R16 · la única cuenta con ese nombre es de alguien que Dlx dijo que NO es
        # ⚠️ sin el caché de apodos no se sabe si hay OTRA cuenta con ese nombre: no actúa
        if t == 'Nombre desconocido' and AK is not None and hay_apodos:
            k = norm(_sin_bandera(det))
            ids = set(_apodos().get(k) or ()) if len(k) >= 3 else set()
            ids |= {str(c.get('id')) for c in _cuentas_posibles(det) if c.get('id')}
            quienes = [por_id.get(i) for i in ids]
            svs_p = {(eventos.get(n) or ('', ''))[1] for n in _nums(p)} - {''}
            if ids and all(quienes) and all(distintos_aca(det, q, akas, svs_p, siglas) for q in quienes):
                sola(p, NUEVO, 'R16', 'Dlx dijo que «%s» no es %s, y no hay otra cuenta con ese nombre: queda con su '
                     'nombre' % (_sin_bandera(det), ' ni '.join(sorted(set(quienes)))))
    # 📝 R4 y R6: ANOTADO ANTES (`anotar_pendientes()`), DESPUÉS LA DECISIÓN, y el cierre al final (`flush_solas()`). Si
    # la decisión no se pudo escribir, se retira: no cierran nada
    ids_dec, dets = set(), set()
    for p, r, regla, porque, esc in con_dec:
        if resolver_solo(p, r, regla, porque, escribio=esc):
            ids_dec.add(p['id'])
            dets.add(esc['batalla'])
            hechas.add(p['id'])
    nuevas_dec = {k: v for k, v in nuevas_dec.items() if v.get('batalla') in dets}
    if nuevas_dec and not dry:
        anotar_pendientes(ids_dec, dry=False)
        try:
            d = _decisiones()
            d.setdefault('batallas', {}).update(nuevas_dec)
            with io.open(DECISIONES, 'w', encoding='utf-8', newline='\n') as f:
                json.dump(d, f, ensure_ascii=False, indent=1)
                f.write('\n')
        except Exception:
            retirar_pendientes(ids_dec, dry=False)
            hechas.difference_update(ids_dec)
            raise
    return hechas


def _jugo(did, nombre):
    """¿Esa cuenta jugó en la T1? Con su nombre, con algo con que se anotó o con su apodo de Discord: si alguno está en
    `Resultados` o en alguna llave cargada. `True` si no se puede saber (sin `Resultados` no se cierra nada)."""
    res = _nombres_en_resultados()
    if res is None:
        return True
    ns = {norm(_sin_bandera(_sin_decoracion(_reparar(nombre))))}
    for x in (_datos('anuncios') or {}).get('inscripciones') or []:
        if str(x.get('discord_id') or '') == str(did):
            ns |= set(_nombres_insc(x.get('texto')))
    try:
        with io.open(APODOS, encoding='utf-8') as f:
            ns |= {norm(_sin_bandera(n)) for n in ((json.load(f) or {}).get('nombres') or {}).get(str(did)) or []}
    except (OSError, ValueError):
        pass
    ns = {n for n in ns if len(n) >= 2}
    en_llaves = {norm(_sin_bandera(p)) for L in _llaves_t1().values() for R in L.get('rondas') or []
                 for b in R.get('b') or [] for lado in (b[0] if b else []) for p in _personas(lado)}
    return bool(ns & (set(res) | en_llaves))


# ── 🔤 el tipeo: «Enkil» es Enkill ──────────────────────────────────────

#: menos letras que esto no es un tipeo, es otro nombre: «Ola» y Olaf, «Ger9» y Gero
TIPEO_MIN = 5
TIPEO_POR = 'el ciclo (una letra de diferencia)'


def _letras(a, b):
    """Cuántas letras separan a `a` de `b`: agregar, sacar, cambiar una, o dar vuelta dos seguidas."""
    d = [[i + j if not i * j else 0 for j in range(len(b) + 1)] for i in range(len(a) + 1)]
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] != b[j - 1]))
            if i > 1 and j > 1 and a[i - 1] == b[j - 2] and a[i - 2] == b[j - 1]:
                d[i][j] = min(d[i][j], d[i - 2][j - 2] + 1)
    return d[len(a)][len(b)]


def tipeo_de(det, variantes, padron, svs_ev, juega_en, son_distintos=lambda a, b: False):
    """El nombre de la Lista del que `det` es un tipeo, o `None`. Ver `tipeos()`."""
    k = norm(_sin_bandera(det))
    if len(k) < TIPEO_MIN or not svs_ev:
        return None
    ccs = {_iso(b) for v in (variantes or [det]) for b in _BANDERA.findall(v)}
    if len(ccs) != 1:
        return None
    cc = next(iter(ccs))
    try:
        from padron_t1 import PAIS_ISO
    except Exception:                                    # noqa: BLE001
        return None
    cerca = []
    for r in padron:
        kr = norm(_sin_bandera(r.get('raw') or r.get('full') or ''))
        if kr and kr != k and abs(len(kr) - len(k)) <= 2:
            d = _letras(k, kr)
            if d <= 2:
                cerca.append((d, r))
    uno = [r for d, r in cerca if d == 1]
    if len(uno) != 1 or PAIS_ISO.get(uno[0].get('pais')) != cc:
        return None
    # ⚠️ NI OTRO DEL MISMO PAÍS A DOS LETRAS: entre «Kaell», «Kael» y «Kaelo» no hay uno que sea el obvio
    if any(d == 2 and PAIS_ISO.get(r.get('pais')) == cc for d, r in cerca):
        return None
    real = uno[0].get('raw') or uno[0].get('full')
    if son_distintos(det, real) or not (set(svs_ev) & set(juega_en(uno[0]))):
        return None
    return real


def tipeos(preguntas, respuestas, eventos, dry=True):
    """🔤 «¿QUIÉN ES ENKIL?» SE CONTESTA SOLO CUANDO ES UN TIPEO OBVIO DE ALGUIEN DE LA LISTA.

    Dlx, 12/10/2026, sobre ✅ Decidir: *«la idea es que la gran mayoría lo soluciones tú»*. Ese día había
    «Enkil 🇦🇷» (Enkill), «Hasan🇦🇷» (Hassan) y «Launnok🇨🇱» (Launok) esperando su respuesta: el nombre de alguien
    de la Lista con una letra de más o de menos, que es lo que contestaría cualquiera que los conozca.

    Alias (hoja AKAs) sólo si se cumple TODO:

      · el nombre tiene `TIPEO_MIN` letras o más, y una sola bandera;
      · hay UNA persona de la Lista a una letra (`_letras()`), del país de esa bandera, y ninguna otra de ese país
        a dos;
      · esa persona ya jugó en el servidor del evento, o su cuenta está ahí;
      · nadie en Discord se llama así (`_cuenta_de()`): si hay una cuenta con ese nombre, es un nombre, no un
        tipeo;
      · y el par no está marcado distinto en AKAs.

    ⚠️ NO DA DE ALTA A NADIE: sólo junta con quien ya está. Lo que no cumple sigue en `Pendientes`.
    Devuelve los ids de las preguntas que resolvió (o resolvería, en seco).
    """
    import construir_akas as AK
    akas = AK.cargar() or {}
    padron = _datos('padron') or []
    svs = _datos('servidores_de') or {}
    fuera = no_rankear()
    no = deshechas()
    cand = [p for p in preguntas if p['tipo'] == 'Nombre desconocido' and p['id'] not in (respuestas or {})
            and p['id'] not in no and len(norm(_sin_bandera(p['detalle']))) >= TIPEO_MIN]
    if not cand:
        return set()
    try:
        from escribir import Hoja
        jugo = {}
        for f in Hoja('Resultados').filas():
            f = [str(x).strip() for x in list(f) + [''] * 5]
            jugo.setdefault(norm(_sin_bandera(f[4])), set()).add(f[2])
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ no pude leer Resultados para los tipeos: %s' % str(e)[:60])
        return set()

    def juega_en(r):
        out = set(jugo.get(norm(_sin_bandera(r.get('raw') or r.get('full') or ''))) or ())
        if r.get('discord_id'):
            out |= set(_servidores_de(str(r['discord_id']), svs))
        return out

    pares, hechas = [], []
    for p in cand:
        svs_ev = {(eventos.get(n) or ('', '', ''))[1] for n in _nums(p)} - {''}
        real = tipeo_de(p['detalle'], p.get('variantes'), padron, svs_ev, juega_en,
                        lambda a, b: AK.son_distintos(a, b, akas))
        if not real or norm(real) in fuera:
            continue
        ids, _f = _cuenta_de(p, eventos)
        if ids:
            continue
        a = _sin_bandera(p['detalle']).strip()
        pares.append([a, real, ''.join(_BANDERA.findall(p['detalle']))])
        hechas.append((p, 'alias de %s: «%s» con una letra de diferencia, del mismo país, y %s juega en %s'
                       % (real, a, real, _y(sorted(svs_ev)))))
    if not hechas:
        return set()
    print('\n   🔤 tipeos de alguien de la Lista: %d' % len(hechas))
    for p, res in hechas:
        print('      %s — %s' % (p['detalle'][:40], res))
    # 🤖 la fila de `Pendientes` la cierra `flush_solas()`. 📝 Anotado antes de escribir (`anotar_pendientes()`)
    for (p, res), (a, real, _f) in zip(hechas, pares):
        resolver_solo(p, 'Es %s' % real, 'tipeo', res, por=TIPEO_POR, escribio={'alias': [a, real]})
    ids = {p['id'] for p, _r in hechas}
    if not dry:
        anotar_pendientes(ids, dry=False)
        try:
            poner_filas_aka(ids, _agregar_akas(pares, []), dry=False)
        except Exception:
            retirar_pendientes(ids, dry=False)
            raise
    return ids


#: cómo se dice cada motivo del lector
_MOTIVO = {
    'no aparece nadie después': 'Ninguno aparece en la ronda siguiente, y la llave no marca quién pasó.',
    'última ronda y no dice campeón': 'Es la última ronda y la llave no dice quién salió campeón.',
}


def _pistas(p):
    """La columna «Pistas»: lo que ayuda a contestar."""
    t, out = p['tipo'], []
    if t == 'Nombre desconocido':
        # ✍️ R17: quién se anotó así para ese evento, firmado por su cuenta (`_cuentas_insc()`)
        for c in p.get('_insc') or []:
            out.append('✍️ Se anotó así desde la cuenta de %s%s' % (
                c['real'] or '@' + c['usuario'],
                ' (es organizador o staff de %s: suele anotar a otros)' % c['sv'][0] if c.get('rol') else ''))
        sug = [x for x in _sugerencias(p['match'])]
        if sug:
            out.append('¿Será %s?' % ' o '.join(sug))
        out.append(_en_discord(p['detalle'])[0])
        out.append(_posibles(p['detalle']))
        out.append(_en_llamada(p['detalle'], _num_evento(p))[0])
        out.append(_termino(p['detalle'], _num_evento(p)))
        out += _peleas(p['detalle'], _num_evento(p))
    elif t == 'Batalla sin ganador':
        mot = (p['match'] or '').strip()
        out.append(_MOTIVO.get(mot, mot) if mot else '')
    elif t == 'alta':
        if p['sug'] and p['sug'] != '—':
            out.append('¿Será %s?' % p['sug'].replace(', ', ' o '))
        did = p['detalle'].split(' = ')[-1].strip() if ' = ' in p['detalle'] else ''
        out.append(('Su cuenta: ' + _cuenta(did)) if _cuenta(did) else '')
    elif t == 'Alias posible':
        m = re.search(r"ya tiene ID (\d+), el log trae (\d+)", p['detalle'])
        m2 = re.search(r"^ID (\d+) ya pertenece", p['detalle'])
        m3 = _DOS_RE.match(p['detalle'])
        m4 = _DOS_C_RE.match(p['detalle'])
        if m4:
            out += ['La de «%s»: ' % m4.group(1) + _cuenta(m4.group(3)), 'La de %s: ' % m4.group(2) + _cuenta(m4.group(4))]
        elif m:
            out += ['La que tiene: ' + _cuenta(m.group(1)), 'La otra: ' + _cuenta(m.group(2))]
        elif m2:
            out.append('Esa cuenta: ' + _cuenta(m2.group(1)))
        elif m3:
            out.append('Esa cuenta: ' + _cuenta(m3.group(3)))
    elif t == 'Vidas cargado':
        # cómo quedó: las batallas, el campeón y el orden en que cayeron
        out += [x.strip() for x in (p['match'] or '').split(' | ') if x.strip()]
    elif t == 'Bracket incompleto':
        # lo que la llave sí dice: sus batallas, para decidir sin abrirla
        for x in (p['match'] or '').split(' | ')[1:5]:
            x = x.strip()
            out.append(x[:1].upper() + x[1:])
    elif p['sug'] and p['sug'] != '—':
        out.append(p['sug'])
    # ⚠️ EL LINK DE LA LLAVE NO VA ACÁ: va una vez, en la franja de su evento
    return '\n'.join(x for x in out if x) or '—'


def es_fragmento(det):
    """¿Es un pedazo de equipo y no un nombre? «a + b + c», «x(kc)», «kc)».

    🔴 SON DE UNA VERSIÓN ANTERIOR DEL LECTOR, que reportaba el lado entero
    de una batalla por equipos como si fuera una persona. El de hoy los
    parte —los puntos ya se reparten entre los integrantes, y cada uno
    que falta tiene su propia pregunta—, pero las filas viejas seguían
    abiertas: «marto🇦🇷+ erian 🇵🇦 + melomaniaco» como un solo nombre.
    """
    return '+' in det or '(' in det or ')' in det


def _reparar(s):
    """Un texto que pasó por la codificación equivocada, arreglado.

    «!馃挆ValenAdoratesJuan馃挆» es «!💗ValenAdoratesJuan💗»: los bytes UTF-8
    del emoji leídos como GBK. «Kingđź‡¦đź‡·» es «King🇦🇷» leído como
    Windows-1250.

    🔴 LAS DOS VENÍAN DEL MISMO LUGAR: `registrar_ids.py` decodificaba lo
    que baja de KV con `r.text`, y requests ADIVINA el charset cuando la
    respuesta no lo dice. Arreglado en la fuente el 24/09/2026; esto queda
    para las filas que ya estaban escritas en `Pendientes`.

    ⚠️ LA PRUEBA ES LA VUELTA ENTERA, no un parecido: se recodifica con la
    codificación sospechada y se lee como UTF-8. Un nombre de verdad con
    tildes —«José», «Łukasz», «Ñandú»— no forma UTF-8 válido al revés y
    queda como estaba.
    """
    t = str(s or '')
    if t.isascii():
        return t
    for cod in ('gbk', 'cp1250', 'cp1252'):
        try:
            r = t.encode(cod).decode('utf-8')
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue
        if r != t:
            return r
    return t


def _sin_decoracion(nombre):
    """«👤 | DRAKO MC» -> «DRAKO MC»: el prefijo del apodo de DRA."""
    return re.sub(r'^[^\w]*\|\s*', '', str(nombre or '')).strip() or nombre


def _conflicto_en_palabras(det):
    """Los conflictos del sync, dichos para una persona y con los links.

    🔴 VENÍAN ASÍ: *«AKA 'Shadow' (fila 237) ya tiene ID 1461433944237936829,
    el log trae 821825142556196895»*. Para contestar había que ir a buscar
    dos números a mano. Ahora dice qué pasó y deja los dos perfiles a un
    click.
    """
    # ⚠️ «SÓLO QUEDA ANOTADO» VA DICHO: contestar no mueve ningún Discord
    # ID —`_poner_ids()` nunca pisa uno—, y sin la frase «es la misma
    # persona» parecía que la Lista pasaba a la cuenta nueva.
    # 👥 la de `una_cuenta_dos_nombres()`: ésta SÍ hace algo, y lo dice
    m = _DOS_C_RE.match(det)
    if m:
        a, b, da, db = m.groups()
        return ('¿«%s» es otra cuenta de %s? Tienen cuentas de Discord distintas, son del mismo país, los nombres se '
                'parecen y nunca jugaron el mismo evento. Si es la misma persona, los puntos de «%s» pasan a %s y esa '
                'cuenta abre sus cartas.\nLa de «%s»: https://discord.com/users/%s\nLa de %s: https://discord.com/users/%s'
                % (a, b, a, b, a, da, b, db))
    m = _DOS_RE.match(det)
    if m:
        a, b, did = m.groups()
        return ('¿«%s» es %s? La cuenta de %s en la Lista se anotó como «%s», y en el ranking suman aparte. Si es '
                'la misma persona, los puntos de «%s» pasan a %s.\nLa cuenta: https://discord.com/users/%s'
                % (a, b, b, a, a, b, did))
    m = re.search(r"AKA '(.+?)' \(fila \d+\) ya tiene ID (\d+), el log trae (\d+)", det)
    if m:
        return ('«%s» ya tiene una cuenta de Discord en la Lista, y el sync '
                'encontró OTRA cuenta con ese nombre. ¿Es la misma persona '
                'con dos cuentas, u otra persona? (Contestar sólo lo anota: '
                'la Lista se queda con la cuenta que tiene.)\nLa que tiene: '
                'https://discord.com/users/%s\nLa otra: '
                'https://discord.com/users/%s' % m.groups())
    m = re.search(r"ID (\d+) ya pertenece a fila \d+ \((.+?)\); no se asignó a '(.+?)'", det)
    if m:
        did, dueno, otro = m.groups()
        return ('La cuenta de Discord de «%s» en la Lista apareció en el sync '
                'también como «%s». ¿«%s» es %s? (Contestar sólo lo anota.)'
                '\nLa cuenta: https://discord.com/users/%s'
                % (dueno, otro, otro, _sin_bandera(dueno), did))
    return 'Conflicto de identidad que encontró el sync: %s' % det


_PADRON_NOMBRES = []


def _parecidos_padron(nombre):
    """Hasta tres nombres de la Lista que se parecen a ese."""
    import difflib
    if not _PADRON_NOMBRES:
        try:
            with io.open(os.path.join(BASE, 'datos', 'padron.json'),
                         encoding='utf-8') as f:
                _PADRON_NOMBRES.extend(x.get('raw') for x in json.load(f)
                                       if x.get('raw'))
        except (OSError, ValueError):
            return []
    k = norm(nombre)
    if not k:
        return []
    por = {}
    for r in _PADRON_NOMBRES:
        por.setdefault(norm(r), r)
    return [por[x] for x in difflib.get_close_matches(k, list(por), n=3,
                                                      cutoff=0.8)]


def _sugerencias(match):
    # ⚠️ SIN REPETIR: «¿Será PichulaMc o PichulaMc o PichulaMc?» (CARABOBO) y tres «Es Erian» seguidos en la lista
    return list(dict.fromkeys(x.strip() for x in re.split(r',|;', match or '') if x.strip()))[:3]


def _pregunta(p):
    """(qué, sugerencia, opciones) de una pregunta, en palabras."""
    t, det, match = p['tipo'], p['detalle'], p['match']
    if t == 'Reporte':
        # `detalle` es «<qué>: <texto> · #<id>» y `match`, quién lo mandó
        que = re.sub(r'\s*·\s*#\d+$', '', det)
        return ('Alguien avisó desde la página que algo de esta llave está mal: «%s»' % que,
                match or '—', ['Ya lo revisé', 'Dejar para después'])
    if t == 'Nombre desconocido':
        sug = _sugerencias(match)
        otras = [v for v in p.get('variantes', [det]) if v != det]
        tambien = (' (también escrito %s)' % ', '.join('«%s»' % v for v in otras)
                   if otras else '')
        # ⚠️ CORTA: «no está en la Lista… escribí su nombre como figura ahí»
        # se repetía en 44 filas, y ahora está una vez, arriba (ver `pintar()`)
        # 🔑 Y PRIMERO LA CUENTA DE DISCORD QUE YA ESTÁ EN LA LISTA con otro
        # nombre: es la respuesta más probable. Ver `_en_discord()`.
        dc = [x for x in _en_discord(det)[1] if norm(x) not in {norm(s) for s in sug}]
        # 🎙️ y quien estaba en la llamada con ese nombre, si está en la Lista
        ll = [x for x in _en_llamada(det, _num_evento(p))[1]
              if norm(x) not in {norm(s) for s in dc + sug}]
        # 🔎 y las cuentas que se buscaron para ese nombre (Dlx, 04/10/2026, «4. Ok»): elegir una lo carga con ella
        cuentas = ['Es la cuenta @%s' % c['usuario'] for c in _cuentas_posibles(det) if c.get('usuario')]
        # 🔑 R17 (13/10/2026): PRIMERO LA CUENTA QUE SE ANOTÓ ASÍ PARA ESE EVENTO. «TRRR» lo escribió la cuenta de BNA y
        # las opciones eran Hassan, nuevo o troll: la respuesta correcta no se podía elegir. Si la cuenta está en la
        # Lista, «Es <ella>»; si no, «Es la cuenta @usuario» (la carga con ella). Ver `_cuentas_insc()`
        p['_insc'] = _cuentas_insc(p)
        # ⚠️ la de alguien con rol en ese servidor va al final: el staff anota a otros (Player anotó a Steven en URBF)
        de_insc = [c['real'] for c in p['_insc'] if c.get('real') and not c.get('rol')]
        de_staff = [c['real'] for c in p['_insc'] if c.get('real') and c.get('rol')]
        cuentas = ['Es la cuenta @%s' % c['usuario'] for c in p['_insc'] if not c.get('real') and c.get('usuario')] + cuentas
        # 🔑 R16 (13/10/2026): Y NO SE OFRECE A QUIEN DLX DIJO QUE NO ES. «Force» ofrecía «Es ForceGP» después de que
        # Dlx dijo «el Force 🇲🇽 de FVS no es ForceGP» (`no_confundir` de AKAs)
        distinto = _son_distintos_de(det, {((_DATOS.get('eventos') or {}).get(n) or ('', ''))[1] for n in _nums(p)})
        es = [x for x in dict.fromkeys(de_insc + dc + ll + sug + de_staff) if not distinto(x)]
        return ('¿Quién es «%s»?%s' % (det, tambien),
                ', '.join(sug) if sug else '—',
                ['Es %s' % x for x in es] + list(dict.fromkeys(cuentas)) + [NUEVO, TROLL])
    if t == 'alta':
        quien = _sin_decoracion(_reparar(det.split(' = ')[0].strip()))
        did = det.split(' = ')[-1].strip() if ' = ' in det else ''
        # ⚠️ «sv FFA» NO ES UNA SUGERENCIA: es dónde usó /card. Va dicho, y
        # la sugerencia pasa a ser lo que la palabra promete: nombres de la
        # Lista que se le parecen.
        sv = match[3:].split(' · ')[0].strip() if match.startswith('sv ') else ''
        sug = _parecidos_padron(quien)
        # 🔑 R3 (13/10/2026): A QUIEN LO BUSCÓ OTRA PERSONA NO SE LE DICE QUE «USÓ /card». Así apareció «ULAYA», que es
        # el bot: alguien le hizo /card. Ver `_por_otro()`
        dice = ('a «%s» lo buscó otra persona con /card%s (no lo usó él)' % (quien, ' en %s' % sv if sv and sv != '?' else '')
                if _por_otro(match) else '«%s» usó /card%s' % (quien, ' en %s' % sv if sv and sv != '?' else ''))
        return ('%s y no está en la Lista de Raperos. Si ya '
                'está con otro nombre, elegilo o escribilo: le pongo su '
                'Discord.%s' % (dice[0].upper() + dice[1:],
                                '\nSu cuenta: https://discord.com/users/%s' % did
                                if did.isdigit() else ''),
                ', '.join(sug) if sug else '—',
                ['Es %s' % x for x in sug] + [NUEVO, 'Ya está resuelto'])
    if t in ('conflicto', 'ambiguo'):
        quien = det.split(' = ')[0].strip()
        return ('«%s» usó /card y su nombre choca con la lista (%s). '
                'Revisalo en Discord.' % (quien, match or t),
                match or '—', ['Ya lo revisé', 'Dejar para después'])
    if t == 'Alias posible':
        # ⚠️ LA PREGUNTA ES «¿ES LA MISMA PERSONA?» Y LAS OPCIONES ERAN «YA LO
        # REVISÉ»: contestar no decía qué se había decidido. Las dos cierran
        # igual —no hay nada que mover: la Lista se queda con la cuenta que
        # tiene—, pero queda escrito cuál fue.
        return (_conflicto_en_palabras(det), match or '—',
                [MISMA, OTRA, 'Dejar para después'])
    if t == 'Batalla sin ganador':
        x = partes_batalla(det)
        lados = x[4] if x else [det]
        dos = len(lados) == 2
        return ('¿Quién %s en %s?\n%s' % ('ganó' if dos else 'pasó',
                                          (x[3] if x else '') or 'esta batalla',
                                          SEP_LADOS.join(lados)),
                match or '—',
                ['%s %s' % ('Ganó' if dos else 'Pasó', l) for l in lados]
                + [NADIE_SIGUIO, NO_SE_JUGO, 'Dejar para después'])
    if t == 'Evento duplicado' and _DUP_RE.match(det):
        dup, nd, sv, fe, orig, no, com, tot = _DUP_RE.match(det).groups()
        return ('El #%s «%s» (%s · %s) tiene las mismas batallas que el #%s «%s»: %s de %s. Los dos suman puntos y '
                'duelos. ¿Es el mismo evento contado dos veces?' % (dup, nd, sv, fe, orig, no, com, tot),
                '—', [SACAR_DUP + dup, NO_DUP, 'Dejar para después'])
    if t == 'Vidas cargado':
        ev = det.split(' · ')[0].strip()
        return ('«%s» es un 5 vidas que el ciclo cargó solo desde #veredictos: '
                'los puntos ya están en el ranking. ¿Está bien?' % ev,
                '—', ['Está bien así', 'No cuenta'])
    if t == 'Bracket incompleto':
        # 🏆 Dlx, 13/10/2026: *«¿cómo digo quién ganó ahí si no me deja seleccionar al ganador?»*. «Ganó X» por cada
        # lado de la ÚLTIMA ronda que trae la llave; lo aplica `llaves_a_entrada.con_campeon()`
        ult, _b = ultima_ronda(match)
        gan = _candidatos_campeon(match)
        if not gan:
            return ('Esta llave no dice quién ganó y lleva más de 12 h sin '
                    'cambios, así que no sumó nada. ¿Cuenta?',
                    '—', ['No cuenta', 'La completo en Discord'])
        return ('Esta llave no dice quién ganó y lleva más de 12 h sin cambios, así que no sumó nada. Si sabés quién '
                'salió campeón, elegilo: %s. Si no, ¿cuenta?' % como_cobra(ult),
                '—', ['Ganó %s' % x for x in gan] + ['No cuenta', 'La completo en Discord'])
    if t == 'Evento dudoso' and 'llaves' in p['origen'].lower():
        mot = re.sub(r'\.?\s*NO se sumó nada\.?\s*$', '', match).strip()
        return ('No sumó nada porque %s' % mot[0].lower() + mot[1:] if mot
                else 'No sumó nada. ¿Cuenta?', '—', ['No cuenta', 'Sí cuenta'])
    if t == 'Evento dudoso':
        return ('Algo raro al puntuar: %s' % det, '—',
                ['Está bien así', 'Hay que revisarlo'])
    if t == 'Llave sin resolver':
        return ('No pude leer estas batallas: %s' % (match or det), '—',
                ['La corrijo en Discord', 'Dejala así'])
    return ('%s: %s' % (t, det), match or '—', ['Hecho', 'Dejar para después'])


# ── las respuestas ──────────────────────────────────────────────────────

#: lo que cierra la pregunta tal cual, sin hacer nada más
MISMA, OTRA = 'Es la misma persona', 'Es otra persona'
CIERRAN = {'Ya lo revisé', 'Ya está resuelto', 'La completo en Discord',
           'Está bien así', 'La corrijo en Discord', 'Dejala así', 'Hecho',
           MISMA, OTRA}
#: lo que la deja abierta, con la respuesta anotada
ESPERAN = {'Dejar para después', 'Hay que revisarlo'}


def interpretar(p, respuesta):
    """Qué hacer con una respuesta: `(accion, dato)`.

        ('cerrar', resolución)   se cierra con ese texto
        ('alias', nombre)        es otra persona de la lista
        ('evento', decisión)     'cuenta' / 'no cuenta'
        ('esperar', nota)        queda abierta
        ('error', motivo)        no se entiende; queda abierta y se dice
    """
    r = re.sub(r'\s+', ' ', str(respuesta or '')).strip()
    if not r:
        return None
    if r in ESPERAN:
        return ('esperar', r)
    # ⚠️ ANTES QUE `CIERRAN`: en un 5 vidas cargado, «Está bien así» no sólo
    # cierra —queda como decisión del evento, y la pregunta no vuelve—
    if p['tipo'] == 'Vidas cargado' and r in ('Está bien así', 'Sí cuenta'):
        return ('evento', 'cuenta')
    # 👥 UNA CUENTA, DOS NOMBRES (`una_cuenta_dos_nombres()`): «es la misma» los une, y «otra» los marca distintos
    # para que no se vuelva a preguntar
    if p['tipo'] == 'Alias posible' and r in (MISMA, OTRA) and _DOS_RE.match(p['detalle']):
        a, b, _did = _DOS_RE.match(p['detalle']).groups()
        return ('unir' if r == MISMA else 'distintos', (a, b))
    # 👥 DOS CUENTAS, UNA PERSONA (`dos_cuentas()`): «es la misma» une los nombres y la cuenta del alias pasa a ser la
    # otra cuenta del real; «otra» los marca distintos
    if p['tipo'] == 'Alias posible' and r in (MISMA, OTRA) and _DOS_C_RE.match(p['detalle']):
        a, b, da, _db = _DOS_C_RE.match(p['detalle']).groups()
        return ('dos_cuentas', (a, b, da)) if r == MISMA else ('distintos', (a, b))
    # 👯 EL MISMO EVENTO DOS VECES (`duplicados_corrida()`): «sí» saca el de número más alto —por número, no por
    # nombre: el #421 se llamaba casi igual que el #419—; «no» los marca distintos y no se vuelve a preguntar
    if p['tipo'] == 'Evento duplicado' and _DUP_RE.match(p['detalle']):
        dup, nd, sv, fe, orig = _DUP_RE.match(p['detalle']).groups()[:5]
        if r.startswith(SACAR_DUP):
            return ('sacar_num', (int(dup), int(orig), nd, sv, fe))
        if r == NO_DUP:
            return ('no_duplicado', (int(dup), int(orig)))
    if r in CIERRAN:
        return ('cerrar', r)
    # ⚠️ ANTES QUE EL ALIAS: «Es un troll» empieza con «es », y la rama de
    # abajo lo leería como «alias de "un troll"».
    if r == TROLL:
        if p['tipo'] == 'Nombre desconocido':
            return ('troll', _sin_bandera(p['detalle']))
        return ('error', '«%s» no aplica a esta pregunta' % r)
    if r == NUEVO:
        return ('cerrar', 'nuevo: queda con este nombre')
    # 🔎 «Es la cuenta @usuario»: una de las cuentas buscadas para ese nombre. ⚠️ ANTES que el alias: «Es la cuenta…»
    # empieza con «Es »
    m = CUENTA_RE.match(r)
    if m:
        if p['tipo'] != 'Nombre desconocido':
            return ('error', '«%s» no aplica a esta pregunta' % r)
        # 🔑 R17: también la cuenta que se anotó así para ese evento (`_cuentas_insc()`)
        c = next((c for c in _cuentas_posibles(p['detalle']) + (p.get('_insc') or _cuentas_insc(p))
                  if c.get('usuario') == m.group(1)), None)
        return ('cuenta', c) if c else ('error', '@%s no es una de las cuentas de «%s»' % (m.group(1), p['detalle']))
    # 🏆 «Ganó X» en un «Bracket incompleto» (Dlx, 13/10/2026): X campeón. Ver `llaves_a_entrada.con_campeon()`
    if p['tipo'] == 'Bracket incompleto':
        m = re.match(r'gan[oó]\s+(.+)$', r, re.I)
        if m:
            ult, bats = ultima_ronda(p.get('match'))
            # ⚠️ con bandera si la hay: «Ganó volk 🇨🇴» no es «Volk 🇲🇽». Y si sin bandera son dos, no se adivina
            hit = [x for x in _candidatos_campeon(p.get('match')) if mismo_lado(x, m.group(1))]
            if len(hit) > 1:
                hit = [x for x in hit if banderas_de(x) == banderas_de(m.group(1))]
            if len(hit) != 1:
                return ('error', '«%s» no está en la última ronda de la llave: elegí de la lista' % m.group(1))
            return ('campeon', {'ganador': hit[0], 'ronda': ult,
                                'batallas': [lados for _r, lados, paso in bats if not paso],
                                'pasaron': [paso for _r, _l, paso in bats if paso]})
    # ⚠️ ANTES QUE EL ALIAS: «Ganó X» no es «es X»
    if p['tipo'] == 'Batalla sin ganador':
        if r == NO_SE_JUGO:
            return ('batalla', '')
        if r == NADIE_SIGUIO or norm(r) in (norm('nadie siguió'), norm('nadie pasó')):
            return ('batalla', NADIE)
        m = re.match(r'(?:gan[oó]|pas[oó])\s+(.+)$', r, re.I)
        quien = norm(_sin_bandera(m.group(1) if m else r))
        x = partes_batalla(p['detalle'])
        hit = [l for l in (x[4] if x else []) if norm(_sin_bandera(l)) == quien]
        if len(hit) == 1:
            return ('batalla', hit[0])
        return ('error', '«%s» no es uno de los que pelearon: elegí de la lista' % r)
    if r in ('No cuenta', 'Sí cuenta'):
        if p['tipo'] in ('Bracket incompleto', 'Evento dudoso', 'Vidas cargado'):
            return ('evento', 'cuenta' if r == 'Sí cuenta' else 'no cuenta')
        return ('error', '«%s» no aplica a esta pregunta' % r)
    if p['tipo'] in ('Nombre desconocido', 'alta'):
        nombre = r[3:].strip() if r.lower().startswith('es ') else r
        if nombre:
            return ('alias', nombre)
    return ('error', 'no entiendo «%s»: elegí una opción de la lista' % r)


def _decisiones():
    try:
        with io.open(DECISIONES, encoding='utf-8') as f:
            return json.load(f) or {}
    except (OSError, ValueError):
        return {}


def no_rankear():
    """Los nombres que no entran a NINGÚN ranking, normalizados.

    🔴 LA REGLA EXISTÍA Y NO LA APLICABA NADIE. `datos/identidades.json`
    tiene a Farmeador y Manito como *«joke/placeholder, se filtra del
    ranking (§6)»*, pero sólo la leían las herramientas de IDs y roles:
    las vitrinas de la T1 no. Dlx, 24/09/2026, mirando el hub: *«why the
    ultra man is still on the list? If it is a troll name right?»* —
    «El ultra knowledge instintivo», puesto 45.

    Son dos fuentes y se suman: lo que Dlx marca en ✅ Decidir como
    «Es un troll» (`datos/decisiones.json`, `no_rankear`) y los joke de
    las reglas de identidad.

    ⚠️ SALE DEL RANKING, NO DE LA LLAVE: quien le ganó al troll conserva
    su duelo ganado. Ver `rankings.agregar()`.
    """
    out = {norm(k) for k in (_decisiones().get('no_rankear') or {})}
    try:
        with io.open(os.path.join(BASE, 'datos', 'identidades.json'),
                     encoding='utf-8') as f:
            ident = json.load(f)
        out |= {norm(k) for k, v in (ident.get('no_verificar') or {}).items()
                if 'joke' in str(v).lower()}
    except (OSError, ValueError):
        pass
    return {x for x in out if x}


def decision_evento(ev, sv, fecha):
    """'cuenta' / 'no cuenta' / None para `ev · sv · fecha`. Lo lee el lector.

    ⚠️ TAMBIÉN POR NOMBRE, Y CON `*` COMO FECHA, para lo que se decide ANTES
    de que exista la llave. Dlx, 24/09/2026, sobre «RAP EXHIBITION 1/8» de
    Snake Rap —jugado el 22/09 y sin llave en ningún canal—: *«no debería
    contar»*. El título y la fecha exactos que va a tener si alguien la
    publica tarde no se conocen: el nombre se compara sin adornos y `*`
    vale cualquier día.
    """
    return (_decision_de_evento(ev, sv, fecha) or {}).get('decision')


def _decision_de_evento(ev, sv, fecha):
    """La decisión entera de `ev · sv · fecha` (ver `decision_evento()`), o `None`."""
    return entrada_evento(_decisiones().get('eventos') or {}, '%s · %s · %s' % (ev, sv, fecha), (ev, sv, fecha))[1]


def entrada_evento(eventos, det, partes=None):
    """`(clave, decisión)` de un evento en `decisiones.json` (`eventos`), o `(None, None)`. Pura: la clave exacta y, si
    no, el mismo nombre normalizado y servidor con esa fecha —primero— o con `*`. Es la búsqueda del lector
    (`_decision_de_evento()`) y la de `poner_campeon()`: tienen que ser la misma. `partes`: `(evento, sv, fecha)`, si
    ya se saben (un nombre con « · » adentro no se parte bien)."""
    if det in eventos:
        return det, eventos[det]
    partes = [str(x).strip() for x in partes] if partes else [x.strip() for x in str(det or '').split(' · ')]
    if len(partes) != 3 or not norm(partes[0]):
        return None, None
    mismo = estrella = None
    for clave, v in eventos.items():
        ps = [x.strip() for x in clave.split(' · ')]
        if len(ps) == 3 and norm(ps[0]) == norm(partes[0]) and ps[1] == partes[1]:
            if ps[2] == partes[2] and mismo is None:
                mismo = (clave, v)
            elif ps[2] == '*' and estrella is None:
                estrella = (clave, v)
    return mismo or estrella or (None, None)


#: cómo empieza la nota del campeón elegido en un «Bracket incompleto» (`poner_campeon()`)
_NOTA_CAMPEON = 'Dlx en ✅ Decidir, a «Bracket incompleto»'


def _sin_nota_campeon(nota):
    """La nota de un evento sin el tramo del campeón (se reescribe entero cada vez que Dlx elige otro)."""
    return ' · '.join(x for x in str(nota or '').split(' · ') if x.strip() and not x.startswith(_NOTA_CAMPEON))


def poner_campeon(eventos, det, c, cuando, por):
    """🏆 Suma el campeón que Dlx eligió a la decisión del evento. Pura sobre `eventos` (la sección de `decisiones.json`).

    ⚠️ SE SUMA, NO PISA (la tercera revisión, 14/10/2026): la entrada se busca como la busca el lector
    (`entrada_evento()`) —otra grafía del nombre no perdía `paga` ni `final`— y la nota que tenía se conserva. Una entrada
    con `*` vale para cualquier día, así que el campeón va en la clave de ESTE evento, con lo de la `*`. Y SIN
    `decision: cuenta`: ésa va por nombre y destrabaría la retención de broma de OTRA llave «(sin titulo)» de ese
    servidor y ese día."""
    clave, v0 = entrada_evento(eventos, det)
    destino = clave if clave and clave.split(' · ')[-1].strip() != '*' else det
    v = dict(v0 or {})
    nueva = ('%s: ganó %s. La llave no decía el campeón: %s %s (`llaves_a_entrada.con_campeon()`)'
             % (_NOTA_CAMPEON, c['ganador'], c['ganador'], como_cobra(c['ronda'])))
    vieja = _sin_nota_campeon(v.get('nota'))
    v.update({'campeon': c, 'cuando': cuando, 'por': por, 'nota': (vieja + ' · ' if vieja else '') + nueva})
    eventos[destino] = v
    return destino


def sacar_campeon(eventos, det, cuando, por):
    """Le saca a la decisión del evento el campeón elegido (Dlx contestó otra cosa a la pregunta que volvió). Pura."""
    clave, v = entrada_evento(eventos, det)
    if not isinstance(v, dict) or v.pop('campeon', None) is None:
        return
    nota = _sin_nota_campeon(v.get('nota'))
    if nota:
        v['nota'] = nota
    else:
        v.pop('nota', None)
    v.update({'cuando': cuando, 'por': por})
    if not any(k for k in v if k not in ('cuando', 'por')):
        eventos.pop(clave, None)


def final_decidida(ev, sv, fecha):
    """`{'lados': [a, b], 'ganador': a}` si Dlx dijo cuál fue la final que la llave no escribió, o `None`.

    🔑 COMPE DE UDDI (la ACADEMIA, 22/09/2026) puso en la final sólo «ERIAN» y nunca la batalla; quién llegó del otro
    lado lo dicen sus votaciones (COLESITO, 2 a 1 en la segunda réplica) y quién ganó, Dlx (*«3. Sí»*). Lo lee
    `llaves_a_entrada` cuando la llave no tiene campeón."""
    f = (_decision_de_evento(ev, sv, fecha) or {}).get('final') or {}
    lados = [str(x).strip() for x in (f.get('lados') or []) if str(x).strip()]
    gana = str(f.get('ganador') or '').strip()
    return {'lados': lados, 'ganador': gana} if len(lados) == 2 and gana in lados else None


def campeon_decidido(ev, sv, fecha):
    """🏆 `{ganador, ronda, batallas, pasaron}` si Dlx eligió el campeón de un «Bracket incompleto» (`campeon` en la
    decisión del evento), o `None`. Lo lee `llaves_a_entrada.con_campeon()`."""
    c = (_decision_de_evento(ev, sv, fecha) or {}).get('campeon')
    if not isinstance(c, dict) or not str(c.get('ganador') or '').strip():
        return None
    return {'ganador': str(c['ganador']).strip(), 'ronda': ronda_canon(c.get('ronda')),
            'batallas': [[str(x) for x in b] for b in c.get('batallas') or [] if isinstance(b, list)],
            'pasaron': [str(x) for x in c.get('pasaron') or []]}


def integrantes_equipo(ev, sv, fecha, equipo):
    """Quiénes eran un equipo que la llave nombra con UN nombre, si Dlx lo dijo.

    `datos/decisiones.json`, `equipos`: «evento · sv · fecha · equipo» ->
    `[nombres]`, y `[]` es «nadie: no se sabe». `None` si no hay decisión:
    entonces manda la inscripción (`llaves_a_entrada.marcar_equipos()`).

    🔑 Dlx, 29/09/2026, sobre TEAM VENECIA: *«debería reconocer los
    integrantes del equipo; si no se puede, ya fue»*. Lo que el lector no
    puede saber —ME TIENE SIN CUIDADO se anotó como PARIA + KRAVITZ y la
    llave los pone además como pareja aparte— lo dice él, acá.
    """
    eq = _decisiones().get('equipos') or {}
    ke = norm(_sin_bandera(equipo))
    for clave, v in eq.items():
        if clave.startswith('_'):
            continue
        p = [x.strip() for x in clave.split(' · ')]
        if (len(p) == 4 and norm(p[0]) == norm(ev) and p[1] == sv
                and p[2] in (fecha, '*') and norm(_sin_bandera(p[3])) == ke):
            if isinstance(v, dict):                  # con quién y cuándo
                v = v.get('integrantes')
            return [str(x).strip() for x in (v or []) if str(x).strip()]
    return None


def paga_ronda(ev, sv, fecha):
    """`{ronda: puntos}` que Dlx dijo para las rondas que la escala de ese evento no paga (`paga` en la decisión del
    evento), o `{}`. Ver `motor._paga()`: FVS UNDER, «octavos» a 625 (12/10/2026)."""
    d = (_decision_de_evento(ev, sv, fecha) or {}).get('paga') or {}
    return {norm(r): int(v) for r, v in d.items() if str(v).isdigit()}


def cobra_ronda(ev, sv, fecha):
    """Quiénes cobran una ronda que GANARON y después no siguieron, si Dlx lo dijo: `{nombre: ronda}`.

    `datos/decisiones.json`, `cobra`: «evento · sv · fecha · nombre» -> `{"ronda": "octavos", ...}`. Lo lee
    `llaves_a_entrada.marcar_cobra()`, que deja la nota `cobra: <nombre>` en esa batalla, y `sheet/motor.py` le paga
    la ronda como a quien la perdió.

    🔑 Dlx, 02/10/2026, sobre Geoka en la DOS GENERACIONES VOL 2 (FFA, 01/10): ganó su octavo y en cuartos peleó
    Zignos en su lugar. El motor paga al que PIERDE cada ronda, así que quien gana y no sigue se queda en 0. *«3. B»*:
    cobra lo que jugó, el octavo.

    ⚠️ NO ES UNA REGLA GENERAL, A PROPÓSITO. Quien gana y no vuelve a aparecer también puede ser un nombre troll que
    el lector no unió con su dueño —Oasis jugó octavos como «Park-Ji Sung»—, y pagarle crearía puntos para alguien
    que no existe. Por eso se decide por persona.
    """
    out = {}
    for clave, v in (_decisiones().get('cobra') or {}).items():
        if clave.startswith('_'):
            continue
        p = [x.strip() for x in clave.split(' · ')]
        if (len(p) == 4 and norm(p[0]) == norm(ev) and p[1] == sv
                and p[2] in (fecha, '*') and p[3]):
            r = v.get('ronda') if isinstance(v, dict) else v
            if r:
                out[p[3]] = str(r).strip().lower()
    return out


def _del_evento(seccion, ev, sv, fecha):
    """`[(nombre de la clave, valor)]` de una sección «evento · sv · fecha · nombre» de `datos/decisiones.json`."""
    out = []
    for clave, v in (_decisiones().get(seccion) or {}).items():
        if clave.startswith('_'):
            continue
        p = [x.strip() for x in clave.split(' · ')]
        if len(p) == 4 and norm(p[0]) == norm(ev) and p[1] == sv and p[2] in (fecha, '*') and p[3]:
            out.append((p[3], v))
    return out


def quien_en_evento(ev, sv, fecha):
    """`{nombre normalizado sin bandera: persona}`: quién era de verdad un nombre de ESA llave, si Dlx lo dijo.

    `datos/decisiones.json`, `quien`: «evento · sv · fecha · nombre» -> `{"es": "AGUSTÍN51K", ...}`. Lo lee
    `llaves_a_entrada.otro_en_evento()`, que cambia el nombre en las filas de ese evento y de ningún otro.

    🔑 Dlx, 13/10/2026, a los reportes de la página (*«me llegaron los reportes pero ¿qué acciones puedo hacer acá?»*,
    y a la propuesta, *«Sí, todas»*): «Agus» es un nombre común y el lector une por nombre, así que todo «Agus» iba a
    Agus 🇦🇷 —la #464 de URBF era AGUSTÍN51K 🇨🇱, y la #423 y la #429 de FFA, un Agustin 🇺🇾 que no está en la Lista—.
    `akas_a_mano.json` (`por_servidor`) lo resuelve para un servidor entero; esto, para un evento. Se decide desde el
    Dashboard («Corregir» en el reporte) y lo aplica `bot/reportes.py --corregir`.
    """
    out = {}
    for nombre, v in _del_evento('quien', ev, sv, fecha):
        es = v.get('es') if isinstance(v, dict) else v
        if es and norm(_sin_bandera(nombre)):
            out[norm(_sin_bandera(nombre))] = str(es).strip()
    return out


def ganadores_forzados(ev, sv, fecha):
    """`[{ronda, lados, ganador}]`: las batallas de ese evento cuyo ganador corrigió Dlx, AUNQUE LA LLAVE DIGA OTRO.

    `datos/decisiones.json`, `ganador`: «evento · sv · fecha · ronda» -> `[{"lados": [...], "ganador": "X"}, ...]`.
    Lo lee `llaves_a_entrada.ganador_forzado()`. ⚠️ No es `batallas`: ésa sólo completa lo que la llave NO dijo
    (`decision_batalla()`), y un reporte de «el ganador está mal» es justo lo contrario (Dlx, 13/10/2026).
    """
    out = []
    for ronda, v in _del_evento('ganador', ev, sv, fecha):
        for b in (v if isinstance(v, list) else [v]):
            if not isinstance(b, dict):
                continue
            lados = [str(x).strip() for x in (b.get('lados') or []) if str(x).strip()]
            gana = str(b.get('ganador') or '').strip()
            if len(lados) >= 2 and norm(_sin_bandera(gana)) in {norm(_sin_bandera(x)) for x in lados}:
                out.append({'ronda': str(ronda).strip().lower(), 'lados': lados, 'ganador': gana})
    return out


def _persona(nombre, padron, akas):
    """El nombre de la Lista de Raperos al que se refiere, o None."""
    k = norm(_sin_bandera(nombre))
    if not k:
        return None
    for x in padron:
        if norm(x.get('raw') or x.get('full')) == k:
            return x
    real = (akas.get('alias') or {}).get(k)
    if real:
        for x in padron:
            if norm(x.get('raw') or x.get('full')) == norm(real):
                return x
    return None


# ── el Sheet ────────────────────────────────────────────────────────────

def _abiertas_de_pendientes():
    """(abiertas, repetidas, resueltas_por_dlx) de la hoja cruda."""
    import pendientes as P
    h = P._hoja()
    todas = P._filas_con_n(h)
    abiertas, vistas, repetidas, hechas = [], {}, [], []
    for n, f in todas:
        f = list(f) + [''] * P.ANCHO
        d = {c: str(f[i]).strip() for i, c in enumerate(P.COLS)}
        if d['Estado'].lower() not in ('', 'pendiente'):
            if d['Resuelto por'] == POR:
                hechas.append((n, d))
            continue
        k = clave(d['Tipo'], d['Detalle'])
        if k in vistas:
            repetidas.append((n, vistas[k]))
            continue
        vistas[k] = n
        abiertas.append((n, d))
    return abiertas, repetidas, hechas


def _eventos():
    """{'353': ('ELRAP FECHA 6', 'FFA', '24/09')} desde `Eventos Procesados`."""
    try:
        from escribir import Hoja
        out = {}
        for f in Hoja('Eventos Procesados').filas():
            f = [str(x).strip() for x in list(f) + [''] * 4]
            if f[0].isdigit():
                out[f[0]] = (f[1], f[2], f[3])
        return out
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ no pude leer los nombres de los eventos: %s' % str(e)[:60])
        return {}


_ID = {}


def _hoja_id(crear=False):
    from escribir import _pedir
    if _ID.get(HOJA) is not None:
        return _ID[HOJA]
    d = _pedir('GET', '?fields=sheets.properties(sheetId,title)')
    for s in d.get('sheets') or []:
        if s['properties']['title'] == HOJA:
            _ID[HOJA] = s['properties']['sheetId']
            return _ID[HOJA]
    if not crear:
        return None
    r = _pedir('POST', ':batchUpdate', json={'requests': [{'addSheet': {
        'properties': {'title': HOJA, 'index': 0,
                       'gridProperties': {'frozenRowCount': FILA_CAB}}}}]})
    _ID[HOJA] = r['replies'][0]['addSheet']['properties']['sheetId']
    return _ID[HOJA]


def _respuestas():
    """{id: (respuesta, estado)} de lo que hay escrito en la hoja.

    También deja en `_respuestas.notas` `{id: nota}` y en
    `_respuestas.sugerencias` `{id: lo que dice la columna Sugerencia}`,
    para rescatar lo que alguien escribió ahí. Ver `C_NOTA`.
    """
    import requests
    from escribir import _pedir
    _respuestas.notas, _respuestas.sugerencias = {}, {}
    if _hoja_id() is None:
        return {}
    v = _pedir('GET', '/values/%s' % requests.utils.quote(
        "'%s'!A%d:Z" % (HOJA, FILA_CAB))).get('values', [])
    if not v:
        return {}
    cab = [str(c).strip() for c in v[0]]

    def col(nombre, antes):
        return cab.index(nombre) if nombre in cab else antes
    i_resp, i_id = col('✍️ RESPUESTA', C_RESP), col('id', C_ID)
    # ⚠️ «Pistas» en la hoja nueva, «Sugerencia» en la de antes: la primera
    # corrida después del cambio lee la vieja
    i_est, i_sug = col('Estado', C_ESTADO), col('Pistas', col('Sugerencia', None))
    i_nota = col('📝 NOTA', None)
    out = {}
    for f in v[1:]:
        f = list(f) + [''] * (len(cab) + len(COLS))
        k = str(f[i_id]).strip()
        if not k:
            continue
        r = str(f[i_resp]).strip()
        if r:
            out[k] = (r, str(f[i_est]).strip())
        if i_nota is not None and str(f[i_nota]).strip():
            _respuestas.notas[k] = str(f[i_nota]).strip()
        if i_sug is not None:
            _respuestas.sugerencias[k] = str(f[i_sug]).strip()
    # 🌐 Y LO CONTESTADO EN EL DASHBOARD (13/10/2026, «Sí, con Reportes»): manda sobre la hoja, que es la vieja
    for k, x in _respuestas_web().items():
        if str(x.get('r') or '').strip():
            out[k] = (str(x['r']).strip(), '')
        # 🔐 y quién la contestó, si no fue Dlx (13/10/2026: los permisos del Dashboard): queda en la nota de la hoja
        quien = str(x.get('por') or '').strip()
        nota = str(x.get('nota') or '').strip()
        if quien and quien != 'Dlx':
            nota = (nota + ' · ' if nota else '') + 'lo contestó %s' % quien
        if nota:
            _respuestas.notas[k] = nota
    return out


#: las líneas que escribe `_pistas()`, de esta versión y de las anteriores
_PISTA_SISTEMA = re.compile(
    r'^(—|¿Será .*\?|Terminó .*\(.* pts\)|[^:]{1,40}: (le ganó a|perdió con) .*'
    r'|(La que tiene|La otra|Su cuenta|Esa cuenta): .*|[^:]{1,40}: .+ vs .+|En Discord .*|✍️ Se anotó así .*'
    r'|Ninguno aparece en la ronda siguiente.*|Es la última ronda.*)$')


def _nota(p):
    """La nota de esa pregunta: la de 📝 NOTA, más lo que se haya escrito en
    «Sugerencia» encima de lo que puso el sistema."""
    nota = (getattr(_respuestas, 'notas', {}) or {}).get(p['id'], '')
    s_hoja = (getattr(_respuestas, 'sugerencias', {}) or {}).get(p['id'], '')
    # ⚠️ Lo que escribió el SISTEMA antes no es una nota: la sugerencia de
    # la corrida anterior era el «Posible match» crudo («sv FFA»).
    sistema = [x for x in (p.get('pistas'), p['sug']) if x]
    if s_hoja and s_hoja not in sistema + [(p.get('match') or '').strip()]:
        de = next((x for x in sistema if s_hoja.startswith(x)), '')
        extra = s_hoja[len(de):] if de else s_hoja
        if not de:
            # 🔴 CUANDO CAMBIAN LAS PISTAS, LAS DE LA CORRIDA ANTERIOR NO
            # SON UNA NOTA. «¿Será King?» pasó a «¿Será King?» + «Su
            # cuenta: …», y lo que había en la hoja ya no era el comienzo
            # de lo nuevo: se copiaba entero a 📝 NOTA. Línea por línea, lo
            # que tiene forma de pista es del sistema.
            extra = '\n'.join(x for x in extra.split('\n')
                              if x.strip() and not _PISTA_SISTEMA.match(x.strip()))
        extra = extra.strip(' —-·')
        if extra and extra not in nota:
            nota = (nota + ' · ' if nota else '') + extra
    return nota


def _agregar_akas(pares, distintos):
    """Escribe los alias nuevos al final de la tabla de la hoja AKAs. Devuelve `{(alias, real) normalizados: [filas]}`:
    en qué filas quedó cada uno —TODAS: el mismo par escrito dos veces en una corrida son dos filas—, para que
    «Deshacer» borre ésas y no otras (`_sacar_akas()`)."""
    import requests
    from escribir import _pedir
    if not pares and not distintos:
        return {}
    v = _pedir('GET', '/values/%s' % requests.utils.quote('AKAs!A1:G800')
               ).get('values', [])
    datos, filas = [], {}
    if pares:
        ult = max([i for i, f in enumerate(v, 1) if f and str(f[0]).strip()]
                  or [1])
        datos.append({'range': 'AKAs!A%d:C%d' % (ult + 1, ult + len(pares)),
                      'values': pares})
        for i, a in enumerate(pares):
            filas.setdefault((norm(_sin_bandera(a[0])), norm(_sin_bandera(a[1]))), []).append(ult + 1 + i)
    if distintos:
        ult = max([i for i, f in enumerate(v, 1)
                   if len(f) > 4 and str(f[4]).strip()] or [2])
        datos.append({'range': 'AKAs!E%d:G%d' % (ult + 1, ult + len(distintos)),
                      'values': distintos})
    _pedir('POST', '/values:batchUpdate',
           json={'valueInputOption': 'RAW', 'data': datos})
    return filas


def _poner_ids(ids):
    """Escribe Discord IDs en la Lista de Raperos. `[(nombre, id)]` -> errores.

    ⚠️ NUNCA PISA UN ID NI USA UNO QUE YA ESTÁ EN OTRA FILA: es la regla de
    `registrar_ids.py`, que existe porque el nombre de Discord coincide con
    el de otra persona más seguido de lo que parece (9 sospechas, 6 falsas).
    """
    import requests
    from escribir import Hoja, _pedir
    if not ids:
        return {}
    h = Hoja('Lista de Raperos')
    iR, iID = h.cabecera.index('Rapero'), h.cabecera.index('Discord ID')
    filas = h.filas()
    en_uso = {str((list(f) + [''] * (iID + 1))[iID]).strip()
              for f in filas} - {''}
    errores, datos = {}, []
    for nombre, did in ids:
        if did in en_uso:
            errores[did] = 'ese Discord ya está en otra fila de la lista'
            continue
        fila = None
        for i, f in enumerate(filas):
            f = list(f) + [''] * (max(iR, iID) + 1)
            if norm(_sin_bandera(f[iR])) == norm(_sin_bandera(nombre)):
                fila = (i, f)
                break
        if fila is None:
            errores[did] = 'no encontré «%s» en la Lista de Raperos' % nombre
        elif str(fila[1][iID]).strip():
            errores[did] = '«%s» ya tiene otro Discord' % nombre
        else:
            n = h.fila_datos + fila[0]
            datos.append({'range': "'Lista de Raperos'!%s%d"
                                   % (chr(ord('A') + iID), n),
                          'values': [[str(did)]]})
            en_uso.add(did)
    if datos:
        _pedir('POST', '/values:batchUpdate',
               json={'valueInputOption': 'RAW', 'data': datos})
    return errores


def aplicar(preguntas, respuestas, repetidas, dry=True):
    """Aplica lo contestado. Devuelve `{id: estado}` para la hoja.

    ⚠️ UNA RESPUESTA QUE NO SE PUEDE APLICAR NO SE PIERDE: queda escrita en
    su celda con el motivo al lado. Borrarla sería hacerle creer a quien
    contestó que se aplicó.
    """
    import construir_akas as AK
    padron = json.load(io.open(os.path.join(BASE, 'datos', 'padron.json'),
                               encoding='utf-8'))
    akas = AK.cargar() or {}
    estados, cierres, pares, eventos, ids = {}, [], [], {}, []
    # 👥 los que Dlx dijo que son otra persona (`interpretar()`): a la tabla de distintos de AKAs
    distintos = []
    # 🔎 las altas con la cuenta que eligió Dlx (`Es la cuenta @usuario`)
    altas = []
    batallas = {}
    trolls = []
    # 👯 los números que Dlx dijo que son otro evento contado dos veces, y los pares que no
    sacar, no_dup = {}, []
    # 🏆 el campeón que Dlx eligió en un «Bracket incompleto»: `{detalle: (dato, pregunta)}`; y los que ya no lo tienen
    campeones, sin_campeon = {}, []
    fuera = no_rankear()
    for p in preguntas:
        r = respuestas.get(p['id'])
        # un nombre que ya se sabe troll no se vuelve a preguntar
        if (not r and p['tipo'] == 'Nombre desconocido'
                and norm(_sin_bandera(p['detalle'])) in fuera):
            cierres += [(n, 'troll: no cuenta (ya decidido)') for n in p['filas']]
            continue
        if not r and p['tipo'] == 'Nombre desconocido' and es_fragmento(p['detalle']):
            cierres += [(n, 'fragmento de equipo: sus integrantes ya están '
                            'por separado') for n in p['filas']]
            continue
        acc = interpretar(p, r[0] if r else '')
        if not acc:
            continue
        que, dato = acc
        if que == 'esperar':
            estados[p['id']] = '🕐 anotado: queda abierta'
        elif que == 'error':
            estados[p['id']] = '⚠️ ' + dato
        elif que == 'cerrar':
            cierres += [(n, dato) for n in p['filas']]
            # 🏆 «La completo en Discord» a un bracket que ya tenía campeón elegido (la llave cambió y la pregunta volvió):
            # el campeón de antes se olvida, o el lector la volvería a abrir en cada corrida
            if p['tipo'] == 'Bracket incompleto':
                sin_campeon.append(p['detalle'])
        elif que == 'evento':
            eventos[p['detalle']] = dato
            # 🔴 UN 5 VIDAS YA ESTÁ EN EL RANKING: «no cuenta» lo saca
            # `procesar_entrada.sacar_descartados()` en la corrida siguiente
            cierres += [(n, ('no cuenta: sale del ranking en la corrida siguiente'
                             if p['tipo'] == 'Vidas cargado' and dato == 'no cuenta'
                             else 'evento: %s' % dato)) for n in p['filas']]
        elif que == 'cuenta':
            ya = next((x for x in padron if str(x.get('discord_id') or '') == str(dato['id'])), None)
            if ya:
                real = ya.get('raw') or ya.get('full')
                pares.append([_sin_bandera(p['detalle']), real, ''.join(_BANDERA.findall(p['detalle']))])
                cierres += [(n, 'alias de %s: es su cuenta (@%s)' % (real, dato['usuario'])) for n in p['filas']]
            else:
                altas.append((p, _sin_bandera(p['detalle']).strip(), dato))
        elif que == 'troll':
            trolls.append(dato)
            cierres += [(n, 'troll: no cuenta') for n in p['filas']]
        elif que == 'batalla':
            batallas[p['detalle']] = dato
            cierres += [(n, 'nadie siguió: cobran la ronda, sin duelo' if dato == NADIE
                         else ('ganó %s: entra en la corrida siguiente' % dato) if dato
                         else 'no se jugó: queda afuera') for n in p['filas']]
        elif que == 'unir':
            pares.append([dato[0], dato[1], ''])
            cierres += [(n, 'alias de %s: es la misma persona' % dato[1]) for n in p['filas']]
        elif que == 'dos_cuentas':
            # el nombre, como alias; la cuenta, como la otra de él (abre sus cartas); y la fila del alias, sin ID
            pares.append([dato[0], dato[1], ''])
            if not dry:
                try:
                    _agregar_cuenta(dato[1], dato[2])
                    _sacar_id(dato[0], dato[2])
                except Exception as e:                   # noqa: BLE001
                    print('   ⚠️ %s -> %s: no pude mover la cuenta (%s)' % (dato[0], dato[1], str(e)[:60]))
            cierres += [(n, 'otra cuenta de %s: es la misma persona' % dato[1]) for n in p['filas']]
        elif que == 'campeon':
            campeones[p['detalle']] = (dato, p)
            cierres += [(n, 'ganó %s: entra como campeón en la corrida siguiente' % dato['ganador']) for n in p['filas']]
        elif que == 'sacar_num':
            dup, orig, nd, sv, fe = dato
            sacar[str(dup)] = {'es': orig, 'nombre': nd, 'sv': sv, 'fecha': fe}
            cierres += [(n, 'el #%d es el #%d otra vez: sale del ranking en la corrida siguiente' % (dup, orig))
                        for n in p['filas']]
        elif que == 'no_duplicado':
            no_dup.append(list(dato))
            cierres += [(n, 'son eventos distintos: no se vuelve a preguntar') for n in p['filas']]
        elif que == 'distintos':
            distintos.append([dato[0], dato[1], 'Dlx en ✅ Decidir (%s): es otra persona' % _ahora_et()])
            cierres += [(n, 'otra persona: quedan separados') for n in p['filas']]
        elif que == 'alias':
            x = _persona(dato, padron, akas)
            if x is None:
                estados[p['id']] = ('⚠️ no encontré «%s» en la Lista de '
                                    'Raperos: escribilo como figura ahí' % dato)
                continue
            real = x.get('raw') or x.get('full')
            if p['tipo'] == 'alta':
                did = p['detalle'].split(' = ')[-1].strip()
                ids.append((real, did, p))
                continue
            if AK.son_distintos(p['detalle'], real, akas):
                estados[p['id']] = ('⚠️ «%s» y «%s» están marcados como '
                                    'personas distintas en AKAs' % (p['detalle'], real))
                continue
            flags = ''.join(_BANDERA.findall(p['detalle']))
            pares.append([_sin_bandera(p['detalle']), real, flags])
            cierres += [(n, 'alias de %s' % real) for n in p['filas']]
    cierres += [(n, 'repetida de la fila %d' % m) for n, m in repetidas]

    print('   %d respuesta(s) · %d fila(s) se cierran · %d alias nuevo(s) · '
          '%d decisión(es) de evento · %d Discord ID'
          % (sum(1 for p in preguntas if p['id'] in respuestas),
             len(cierres), len(pares), len(eventos), len(ids)))
    for a, b, _f in pares:
        print('      alias: %s -> %s' % (a, b))
    for ev, dec in eventos.items():
        print('      evento: %s -> %s' % (ev, dec))
    for det, g in batallas.items():
        print('      batalla: %s -> %s' % (det, g or 'no se jugó'))
    for _p, n, c in altas:
        print('      alta: %s con la cuenta @%s' % (n, c['usuario']))
    for det, (c, _p) in campeones.items():
        print('      campeón: %s -> %s' % (det, c['ganador']))
    aplicar.hubo = bool(cierres or pares or eventos or ids or trolls or batallas or altas or distintos or campeones
                        or sin_campeon)
    # ⚠️ LAS NOTAS DE LO QUE SE CIERRA NO SE PIERDEN: van a
    # `datos/decisiones.json` con la pregunta, para quien tenga que actuar.
    cerradas = {n for n, _d in cierres}
    notas_cerradas = {p['id']: {'pregunta': p['detalle'], 'nota': _nota(p)}
                      for p in preguntas if _nota(p) and set(p['filas']) & cerradas}
    if dry:
        return estados

    if altas:
        # la bandera de la llave, si es una (como `por_discord()`); si no, sin país: lo completa autoverificar
        import lista_raperos as LR
        filas_a = []
        for p, n, c in altas:
            cc = {_iso(b) for b in _BANDERA.findall(p['detalle'])}
            filas_a.append((n, next(iter(cc)) if len(cc) == 1 else '', str(c['id']),
                            'Dlx en ✅ Decidir: es la cuenta @%s' % c['usuario']))
        entraron = LR.agregar_varios(filas_a, aplicar=True)
        for p, n, c in altas:
            if str(c['id']) in (entraron or {}):
                cierres += [(f, 'alta con la cuenta @%s' % c['usuario']) for f in p['filas']]
            else:
                estados[p['id']] = '⚠️ no pude cargarlo: mirá la Lista'
    if ids:
        errores = _poner_ids([(real, did) for real, did, _p in ids])
        for real, did, p in ids:
            if did in errores:
                estados[p['id']] = '⚠️ ' + errores[did]
            else:
                cierres += [(n, 'Discord %s puesto en %s' % (did, real))
                            for n in p['filas']]
    if pares or distintos:
        _agregar_akas(pares, distintos)
    if eventos:
        d = _decisiones()
        d.setdefault('_leeme', [
            'Lo que Dlx decidió sobre eventos en la hoja ✅ Decidir.',
            'La clave es «evento · servidor · fecha», como en Pendientes.',
            'llaves_a_entrada.py lo respeta: «no cuenta» no se suma nunca;',
            '«cuenta» no se retiene por Interserver ni por fase sin batallas.'])
        ahora = _ahora_et()
        for ev, dec in eventos.items():
            d.setdefault('eventos', {})[ev] = {'decision': dec, 'cuando': ahora,
                                               'por': POR}
        with io.open(DECISIONES, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(d, f, ensure_ascii=False, indent=1)
            f.write('\n')
    if campeones or sin_campeon:
        d = _decisiones()
        ahora = _ahora_et()
        for det, (c, _p) in campeones.items():
            poner_campeon(d.setdefault('eventos', {}), det, c, ahora, POR)
        for det in sin_campeon:
            sacar_campeon(d.setdefault('eventos', {}), det, ahora, POR)
        with io.open(DECISIONES, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(d, f, ensure_ascii=False, indent=1)
            f.write('\n')
    if sacar or no_dup:
        d = _decisiones()
        ahora = _ahora_et()
        for n, v in sacar.items():
            d.setdefault('sacar', {})[n] = dict(v, cuando=ahora, por=POR)
        for par in no_dup:
            if par not in d.setdefault('no_duplicados', []):
                d['no_duplicados'].append(par)
        with io.open(DECISIONES, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(d, f, ensure_ascii=False, indent=1)
            f.write('\n')
    if batallas:
        d = _decisiones()
        ahora = _ahora_et()
        for det, g in batallas.items():
            d.setdefault('batallas', {})[clave_batalla(det)] = {
                'ganador': g, 'batalla': det, 'cuando': ahora, 'por': POR}
        with io.open(DECISIONES, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(d, f, ensure_ascii=False, indent=1)
            f.write('\n')
    if notas_cerradas:
        d = _decisiones()
        ahora = _ahora_et()
        for k, v in notas_cerradas.items():
            v['cuando'] = ahora
            d.setdefault('notas', {})[k] = v
            print('      📝 nota guardada: %s — %s' % (v['pregunta'], v['nota']))
        with io.open(DECISIONES, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(d, f, ensure_ascii=False, indent=1)
            f.write('\n')
    if trolls:
        d = _decisiones()
        ahora = _ahora_et()
        for t in trolls:
            d.setdefault('no_rankear', {})[t] = {'motivo': 'troll',
                                                 'cuando': ahora, 'por': POR}
        with io.open(DECISIONES, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(d, f, ensure_ascii=False, indent=1)
            f.write('\n')
        print('      troll: %s' % ', '.join(trolls))
    if cierres:
        from escribir import _pedir
        _pedir('POST', '/values:batchUpdate', json={
            'valueInputOption': 'RAW',
            'data': [{'range': 'Pendientes!F%d:H%d' % (n, n),
                      'values': [['Resuelto', res,
                                  'el ciclo' if res.startswith('repetida')
                                  else POR]]}
                     for n, res in cierres]})
    return estados


def _ahora_et():
    """«2026-09-24 7:40 PM ET»: la fecha y hora que queda escrita.

    ⚠️ EN HORA DEL ESTE, NUNCA UTC. Dlx, 24/09/2026: *«I told you to refer
    everything as my local time zone EST»*. Este archivo guardaba
    «2026-09-24 23:40 UTC» y Dlx lo lee en GitHub.
    """
    ahora = datetime.datetime.now(datetime.timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        et = ahora.astimezone(ZoneInfo('America/New_York'))
    except Exception:                                    # noqa: BLE001
        et = ahora - datetime.timedelta(hours=4)
    return et.strftime('%Y-%m-%d ') + et.strftime('%I:%M %p ET').lstrip('0')


def _hora_et():
    ahora = datetime.datetime.now(datetime.timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        return ahora.astimezone(ZoneInfo('America/New_York')).strftime(
            '%d/%m %I:%M %p ET')
    except Exception:                                    # noqa: BLE001
        return (ahora - datetime.timedelta(hours=4)).strftime('%d/%m %I:%M %p ET')


PROTECCION = 'decidir: la rehace el ciclo'


def _protecciones(sid):
    """Los ids de las protecciones que puso esta hoja en corridas anteriores."""
    from escribir import _pedir
    d = _pedir('GET', '?fields=sheets(properties.sheetId,protectedRanges('
                      'protectedRangeId,description))')
    for x in d.get('sheets') or []:
        if x['properties']['sheetId'] == sid:
            return [p['protectedRangeId'] for p in x.get('protectedRanges') or []
                    if p.get('description') == PROTECCION]
    return []


#: 🎨 los colores de la hoja (RGB de 0 a 1). Los de la Liga: el verde agua del
#: hub y el fondo oscuro, y un color claro por tipo de pregunta.
_OSCURO = {'red': .055, 'green': .098, 'blue': .09}
_AGUA = {'red': .161, 'green': .698, 'blue': .596}
_BLANCO = {'red': 1, 'green': 1, 'blue': 1}
_GRIS = {'red': .45, 'green': .47, 'blue': .47}
_AMARILLO = {'red': 1, 'green': .969, 'blue': .82}
_VERDE = {'red': .85, 'green': .949, 'blue': .87}
_ROJO = {'red': .988, 'green': .878, 'blue': .878}
#: el fondo de la franja de cada sección, por el tipo de su primera pregunta
_FRANJA = {'❤️ Vidas': {'red': .992, 'green': .878, 'blue': .886},
           '⚔️ Batalla': {'red': 1, 'green': .918, 'blue': .835},
           '🏆 Evento': {'red': 1, 'green': .953, 'blue': .78},
           '👤 Nombre': {'red': .867, 'green': .949, 'blue': .929},
           '🪪 Identidad': {'red': .925, 'green': .91, 'blue': .988},
           '🎯 MW': {'red': .992, 'green': .898, 'blue': .929}}


#: 🔑 CONTESTAR UN EVENTO ENTERO. Dlx, 28/09/2026, a «un botón para decir
#: "todos los nombres de este evento son gente nueva"»: *«va»*. RAP EXHIBITION
#: 1/8 tenía diez nombres fuera de la Lista, y contestar «Es alguien nuevo»
#: diez veces es lo que hace que una hoja se deje de usar.
EN_BLOQUE = 'Todos son gente nueva'
#: desde cuántos nombres desconocidos en un evento aparece la fila del bloque
BLOQUE_MIN = 2


def id_bloque(k):
    """El id de la fila «⚡ Todo el evento» de la sección `k`."""
    return 'todos:' + hashlib.sha1(str(k).encode('utf-8')).hexdigest()[:10]


def bloques(preguntas):
    """`{id_bloque: [preguntas]}`: los nombres desconocidos de cada evento, si son varios."""
    por = collections.defaultdict(list)
    for p in preguntas:
        if p['tipo'] == 'Nombre desconocido':
            k = (p.get('seccion') or _seccion(p))[0]
            if str(k).startswith('ev:'):
                por[id_bloque(k)].append(p)
    return {b: ps for b, ps in por.items() if len(ps) >= BLOQUE_MIN}


def repartir(preguntas, respuestas):
    """Las respuestas, con la de «⚡ Todo el evento» repartida a cada nombre.

    ⚠️ LA RESPUESTA DE CADA FILA MANDA: si uno de los diez es de la Lista, se
    contesta en su fila y el bloque no la pisa.
    """
    out = dict(respuestas)
    for b, ps in bloques(preguntas).items():
        if (respuestas.get(b) or ('',))[0] != EN_BLOQUE:
            continue
        for p in ps:
            if not (respuestas.get(p['id']) or ('',))[0]:
                out[p['id']] = (NUEVO, '')
    return out


def secciones(preguntas):
    """`[(título, [preguntas])]`: una sección por evento con TODO lo de ese
    evento —batallas, el evento, los nombres—, y al final lo que no es de un
    evento (identidad, MW).

    🔑 POR EVENTO Y NO POR TIPO. Dlx piensa en eventos —«MARRUECOS lo resuelvo
    yo»— y la hoja los tenía desparramados: las batallas de MARRUECOS arriba,
    sus nombres cuarenta filas más abajo. Primero van los eventos que tienen
    algo que MUEVE PUNTOS de varios (una batalla sin ganador, un evento
    dudoso), después los que sólo tienen nombres.
    """
    por, orden = {}, []
    for p in preguntas:
        k, tit = p.get('seccion') or _seccion(p)
        if k not in por:
            por[k] = (tit, [])
            orden.append(k)
        por[k][1].append(p)

    def peso(k):
        ps = por[k][1]
        return (2 if k.startswith('grupo:') else 0 if min(x['grupo'][0] for x in ps) == 0 else 1,
                min(x['grupo'][0] for x in ps), min(x['filas'][0] for x in ps))
    out = []
    for k in sorted(orden, key=peso):
        tit, ps = por[k]
        out.append((tit, sorted(ps, key=lambda x: (x['grupo'][0], x['filas'][0]))))
    return out


# ── 🌐 ✅ DECIDIR EN EL DASHBOARD ───────────────────────────────────────
# 🔑 Dlx, 13/10/2026: *«estaba pensando en mover lo de decidir del sheet, aquí»*, y a la propuesta, *«Sí, con
# Reportes»*: las MISMAS preguntas, en la pestaña «Decisiones» del Dashboard, con sus pistas y sus opciones. Lo que
# se contesta ahí lo guarda el objeto y entra por `_respuestas()` como si estuviera escrito en la hoja, así que lo
# aplica `aplicar()` de siempre y no hay una regla nueva en ningún lado. La hoja sigue una semana en paralelo.
#: el Worker, para hablar con el objeto con la clave del ciclo
WORKER = 'https://liga-global-bot.liga-global-ul.workers.dev'


def para_web(preguntas):
    """`[{id, tipo, sec, que, pistas, opciones, link, libre, grupo, imp}]`: las preguntas como las ve Dlx en el
    Dashboard, por evento y en el orden de la hoja. Sin los «Reporte»: ésos tienen su pestaña. `libre`: se puede
    escribir «Es <nombre>». `grupo` y `imp` son para los filtros (`GRUPO`, `IMPORTANCIA`)."""
    out = []
    for tit, ps in secciones([p for p in preguntas if p['tipo'] != 'Reporte']):
        for p in ps:
            link = str(p.get('link') or '')
            out.append({'id': p['id'], 'tipo': p['tipo'], 'sec': str(tit)[:120], 'que': str(p.get('que') or '')[:400],
                        'pistas': str(p.get('pistas') or '')[:900], 'opciones': [str(x)[:80] for x in p.get('opciones') or []][:14],
                        'link': link if link.startswith('https://discord.com/') else '',
                        'libre': p['tipo'] == 'Nombre desconocido',
                        'grupo': GRUPO.get(p['tipo'], (4, p['tipo']))[1], 'imp': IMPORTANCIA.get(p['tipo'], 'media')})
    return out[:150]


def _objeto(metodo, ruta, cuerpo=None):
    """El objeto, con la clave del ciclo. `None` si no contesta (no frena ✅ Decidir)."""
    try:
        import requests
        sys.path.insert(0, os.path.join(BASE, 'bot'))
        import fotos as F
        import clave_ciclo as CC
        tok = F.env('DISCORD_TOKEN', obligatorio=False)
        if not tok:
            return None
        h = {'x-lg-ciclo': CC.clave(tok), 'content-type': 'application/json'}
        r = (requests.get(WORKER + ruta, headers=h, timeout=30) if metodo == 'GET' else
             requests.post(WORKER + ruta, data=json.dumps(cuerpo, ensure_ascii=False).encode('utf-8'), headers=h, timeout=30))
        return r.json() if r.ok else None
    except Exception:                                    # noqa: BLE001
        return None


_CICLO = {}


def _decidir_ciclo():
    """Lo que el objeto le guarda al ciclo (`/avisos/decidir-ciclo`), leído una vez por corrida. `{}` si no contesta."""
    if 'd' not in _CICLO:
        _CICLO['d'] = _objeto('GET', '/avisos/decidir-ciclo') or {}
    return _CICLO['d']


def _respuestas_web():
    """`{id: {r, nota}}`: lo contestado en el Dashboard. `{}` si el objeto no contesta."""
    d = _decidir_ciclo()
    return {str(k): v for k, v in (d.get('respuestas') or {}).items() if isinstance(v, dict)}


def deshacer_web():
    """↩️ Los ids que Dlx deshizo en «Lo que se resolvió solo» del Dashboard (`deshacer` de `/avisos/decidir-ciclo`)."""
    return {str(x).strip() for x in (_decidir_ciclo().get('deshacer') or []) if str(x).strip()}


def publicar_web(preguntas):
    """Las preguntas abiertas, al Dashboard, y lo que se resolvió solo en los últimos `SOLAS_DIAS` días (`solas`, con
    la regla y la prueba, para «Deshacer»). El objeto borra lo contestado de las que ya no están (se aplicaron)."""
    d = _objeto('POST', '/avisos/decidir-estados', {'preguntas': para_web(preguntas), 'solas': solas_web()})
    print('   🌐 %s' % ('%d pregunta(s) en el Dashboard' % len(para_web(preguntas)) if d else
                        '⚠️ el objeto no contestó: el Dashboard queda con las de antes'))
    return bool(d)


def _u16(texto):
    """El largo en unidades UTF-16, que es como cuenta la API de Sheets los
    índices de un tramo de texto: un emoji son dos."""
    return len(texto.encode('utf-16-le')) // 2


def con_links(texto):
    """`(texto, [(desde, hasta, url)])`: cada URL cambiada por una palabra
    que se toca —«perfil ↗», «ver la llave ↗»—.

    🔴 LAS URL IBAN ESCRITAS ENTERAS Y NO ERAN LINKS: la API escribe en
    RAW, y una URL dentro de un texto queda como texto. Ciento veinte
    caracteres de `discord.com/channels/4923…` en cada franja, y para
    abrirla había que copiarla a mano.
    """
    out, runs, i = '', [], 0
    for m in re.finditer(r'https?://[^\s»)]+', texto or ''):
        out += texto[i:m.start()]
        url = m.group(0)
        et = ('perfil ↗' if '/users/' in url else 'ver la llave ↗' if '/channels/' in url
              else 'abrir ↗')
        runs.append((_u16(out), _u16(out) + _u16(et), url))
        out += et
        i = m.end()
    return out + (texto or '')[i:], runs


def tramos(filas):
    """`[(desde, hasta)]` de las rachas de filas seguidas, `hasta` excluido:
    `3, 4, 5, 7, 8` → `(3, 6), (7, 9)`."""
    out = []
    for f in sorted(filas):
        if out and out[-1][1] == f:
            out[-1][1] = f + 1
        else:
            out.append([f, f + 1])
    return [tuple(t) for t in out]


def _condicionales(sid):
    """Cuántas reglas de formato condicional tiene esta hoja: se borran antes
    de poner las nuevas, de atrás para adelante (ver `rankings._adornos()`)."""
    from escribir import _pedir
    d = _pedir('GET', '?fields=sheets(properties.sheetId,conditionalFormats)')
    for x in d.get('sheets') or []:
        if x['properties']['sheetId'] == sid:
            return len(x.get('conditionalFormats') or [])
    return 0


def pintar(preguntas, estados, respuestas, hechas, dry=True):
    """Rehace la hoja entera: la franja de arriba, cómo se usa, cada evento con
    sus preguntas, y lo último que se aplicó.

    🎨 Dlx, 28/09/2026: *«mejora esa página de decidir incluso más… hazla.
    Más mejor y bonita»*. Lo que cambió, y por qué:

      · UNA SECCIÓN POR EVENTO, con su franja de color, su servidor, su fecha
        y el link a la llave. Ver `secciones()`.
      · LA PREGUNTA, CORTA. «No está en la Lista de Raperos. Si es alguien
        que ya está, escribí su nombre como figura ahí» se repetía en 44
        filas: ahora se dice una vez, arriba.
      · «PISTAS»: con quién peleó en esa llave y si ganó, y a quién se parece
        en la Lista (`_pistas()`). Para saber quién es sin abrir Discord.
      · LA FILA SE PONE VERDE AL CONTESTARLA, y roja si la respuesta no se
        entendió: se ve de un vistazo qué falta.
      · Sin cuadrícula, con la franja de arriba oscura como el hub.
    """
    import requests
    from escribir import _pedir
    ANCHO = len(COLS)
    cuenta = collections.Counter(p['grupo'][1] for p in preguntas)
    DICHO = {'⚔️ Batalla': ('batalla', 'batallas'), '🏆 Evento': ('evento', 'eventos'),
             '❤️ Vidas': ('5 vidas para confirmar', '5 vidas para confirmar'),
             '👤 Nombre': ('nombre', 'nombres'), '🪪 Identidad': ('de identidad', 'de identidad'),
             '🎯 MW': ('del MW', 'del MW')}
    resumen = '   ·   '.join(
        '%s %d %s' % (g.split(' ')[0], n, DICHO.get(g, (g, g))[n != 1])
        for g, n in sorted(cuenta.items(), key=lambda x: GRUPO.get(
            next((t for t, v in GRUPO.items() if v[1] == x[0]), ''), (9, ''))[0]))
    secs = secciones(preguntas)
    filas = [
        ['✅  DECIDIR'] + [''] * (ANCHO - 1),
        ['Lo que el sistema no pudo resolver solo. Elegí una respuesta en la columna '
         'amarilla ✍️ —si es alguien que ya está en la Lista de Raperos, escribí su '
         'nombre como figura ahí— y el ciclo la aplica en menos de media hora. La fila '
         'se pone verde cuando está contestada. Para aclarar algo, 📝 NOTA: se guarda.']
        + [''] * (ANCHO - 1),
        [('%d para decidir   —   %s' % (len(preguntas), resumen) if preguntas
          else '🎉 No hay nada para decidir')
         + '   ·   actualizado %s' % _hora_et()] + [''] * (ANCHO - 1),
        [''] * ANCHO,
        COLS,
    ]
    fila_sec, fila_preg = [], []          # índices (0) de cada franja y cada pregunta
    links = []                            # (fila, columna, texto, [(desde, hasta, url)])
    n = 0
    for tit, ps in secs:
        fila_sec.append((len(filas), ps[0]['grupo'][1]))
        link = next((p['link'] for p in ps if p.get('link')), '') or next(
            (((_llaves_t1().get(_num_evento(p)) or {}).get('links') or [''])[-1]
             for p in ps if _num_evento(p)), '')
        txt, runs = con_links('▸  %s%s' % (tit, ('   ·   %s' % link) if link else ''))
        if runs:
            links.append((len(filas), 0, txt, runs))
        filas.append([txt] + [''] * (ANCHO - 1))
        # ⚡ el evento entero, cuando tiene varios nombres fuera de la Lista.
        # ⚠️ Una fila y no la franja: la franja está combinada de A a H.
        nd = [p for p in ps if p['tipo'] == 'Nombre desconocido']
        k0 = (ps[0].get('seccion') or _seccion(ps[0]))[0]
        if len(nd) >= BLOQUE_MIN and str(k0).startswith('ev:'):
            b = id_bloque(k0)
            rb = respuestas.get(b)
            fila_preg.append((len(filas), {'opciones': [EN_BLOQUE, 'Dejar para después'], 'id': b}))
            filas.append(['', '⚡ Todo el evento',
                          '¿Los %d nombres de este evento que no están en la Lista son todos '
                          'gente nueva?' % len(nd),
                          ('Si alguno ya está en la Lista, contestalo en su fila: esa respuesta '
                           'manda. · %s' % ', '.join(_sin_bandera(p['detalle']) for p in nd))[:500],
                          rb[0] if rb else '', '', estados.get(b, ''), b])
        for p in ps:
            n += 1
            r = respuestas.get(p['id'])
            # la respuesta se conserva si la pregunta sigue abierta: si se
            # borrara, parecería aplicada
            fila_preg.append((len(filas), p))
            que, runs = con_links(p['que'])
            if runs:
                links.append((len(filas), 2, que, runs))
            filas.append([str(n), p['grupo'][1], que, p.get('pistas') or p['sug'],
                          r[0] if r else '', _nota(p), estados.get(p['id'], ''), p['id']])
    if not preguntas:
        filas.append(['', '', '🎉 No hay nada para decidir.'] + [''] * (ANCHO - 3))
    fila_hechas = None
    if hechas:
        filas.append([''] * ANCHO)
        fila_hechas = len(filas)
        filas.append(['✔️  Lo último que se aplicó'] + [''] * (ANCHO - 1))
        for _n, d in hechas[-8:][::-1]:
            filas.append(['', GRUPO.get(d['Tipo'], (4, d['Tipo']))[1], d['Detalle'],
                          d['Origen'], d['Resolución'], '', '✔️ aplicado', ''])
    if dry:
        print('   (simulacro) la hoja tendría %d fila(s): %d pregunta(s) en %d sección(es)'
              % (len(filas), len(preguntas), len(secs)))
        pintar.filas, pintar.links = filas, links
        return
    sid = _hoja_id(crear=True)
    # 🔴 PRIMERO SE DESCOMBINA, DESPUÉS SE ESCRIBE. Una fila que en la
    # pintada anterior era la franja de un evento está combinada de A a H,
    # y escribir en una celda combinada se traga el valor SIN ERROR: quedaba
    # el número en A y la pregunta vacía. Medido el 28/09/2026 a las 11:54
    # AM ET: entraron las 11 batallas, las secciones se corrieron, y cuatro
    # preguntas —la batalla de cuatro de MARRUECOS entre ellas— salieron en
    # blanco. El `unmergeCells` del batch de abajo llegaba tarde.
    _pedir('POST', ':batchUpdate', json={'requests': [{'unmergeCells': {'range': {
        'sheetId': sid, 'startRowIndex': 0, 'endRowIndex': 2000,
        'startColumnIndex': 0, 'endColumnIndex': 10}}}]})
    _pedir('POST', '/values/%s:clear' % requests.utils.quote("'%s'!A1:J2000" % HOJA))
    _pedir('PUT', '/values/%s?valueInputOption=RAW'
           % requests.utils.quote("'%s'!A1" % HOJA), json={'values': filas})
    fin = len(filas)

    def rango(f0, f1, c0=0, c1=ANCHO):
        return {'sheetId': sid, 'startRowIndex': f0, 'endRowIndex': f1,
                'startColumnIndex': c0, 'endColumnIndex': c1}

    def pinta(r, fmt, campos):
        return {'repeatCell': {'range': r, 'cell': {'userEnteredFormat': fmt},
                               'fields': 'userEnteredFormat(%s)' % campos}}
    reqs = [
        # lo de la corrida anterior: formato, validaciones, uniones, reglas
        {'unmergeCells': {'range': rango(0, 2000, 0, 10)}},
        {'setDataValidation': {'range': rango(FILA_CAB, 2000, 0, 10)}},
        {'repeatCell': {'range': rango(0, 2000, 0, 10), 'cell': {'userEnteredFormat': {}},
                        'fields': 'userEnteredFormat'}},
        # los links de la corrida anterior: la fila que era franja ahora
        # puede ser una pregunta
        {'updateCells': {'range': rango(0, 2000, 0, 10), 'fields': 'textFormatRuns'}},
    ]
    for k in range(_condicionales(sid) - 1, -1, -1):
        reqs.append({'deleteConditionalFormatRule': {'sheetId': sid, 'index': k}})
    reqs += [
        {'updateSheetProperties': {'properties': {
            'sheetId': sid, 'tabColorStyle': {'rgbColor': _AGUA},
            'gridProperties': {'frozenRowCount': FILA_CAB, 'hideGridlines': True}},
            'fields': 'tabColorStyle,gridProperties.frozenRowCount,gridProperties.hideGridlines'}},
        # 🔝 la franja de arriba: oscura, como el hub
        {'mergeCells': {'range': rango(0, 1), 'mergeType': 'MERGE_ALL'}},
        {'mergeCells': {'range': rango(1, 2), 'mergeType': 'MERGE_ALL'}},
        {'mergeCells': {'range': rango(2, 3), 'mergeType': 'MERGE_ALL'}},
        pinta(rango(0, 3), {'backgroundColor': _OSCURO, 'wrapStrategy': 'WRAP',
                            'verticalAlignment': 'MIDDLE', 'padding': {'left': 14, 'top': 6, 'bottom': 6},
                            'textFormat': {'foregroundColor': _BLANCO, 'fontSize': 10}},
              'backgroundColor,wrapStrategy,verticalAlignment,padding,textFormat'),
        pinta(rango(0, 1), {'textFormat': {'foregroundColor': _BLANCO, 'fontSize': 20, 'bold': True}},
              'textFormat'),
        pinta(rango(2, 3), {'textFormat': {'foregroundColor': _AGUA, 'fontSize': 11, 'bold': True}},
              'textFormat'),
        pinta(rango(3, 4), {'backgroundColor': _OSCURO}, 'backgroundColor'),
        # la cabecera de la tabla
        pinta(rango(FILA_CAB - 1, FILA_CAB), {
            'backgroundColor': {'red': .106, 'green': .169, 'blue': .157},
            'textFormat': {'foregroundColor': _BLANCO, 'bold': True, 'fontSize': 10},
            'verticalAlignment': 'MIDDLE', 'padding': {'left': 8}},
            'backgroundColor,textFormat,verticalAlignment,padding'),
        # el cuerpo: se lee de arriba abajo, con aire
        pinta(rango(FILA_CAB, fin), {'wrapStrategy': 'WRAP', 'verticalAlignment': 'TOP',
                                     'padding': {'left': 8, 'right': 8, 'top': 6, 'bottom': 6},
                                     'textFormat': {'fontSize': 10}},
              'wrapStrategy,verticalAlignment,padding,textFormat'),
        {'updateDimensionProperties': {'range': {'sheetId': sid, 'dimension': 'ROWS',
                                                 'startIndex': 0, 'endIndex': 1},
                                       'properties': {'pixelSize': 52}, 'fields': 'pixelSize'}},
        {'updateDimensionProperties': {'range': {'sheetId': sid, 'dimension': 'ROWS',
                                                 'startIndex': 3, 'endIndex': 4},
                                       'properties': {'pixelSize': 8}, 'fields': 'pixelSize'}},
    ]
    # ▸ la franja de cada evento
    for f, grupo in fila_sec:
        reqs += [
            {'mergeCells': {'range': rango(f, f + 1), 'mergeType': 'MERGE_ALL'}},
            pinta(rango(f, f + 1), {'backgroundColor': _FRANJA.get(grupo, _FRANJA['👤 Nombre']),
                                    'verticalAlignment': 'MIDDLE', 'wrapStrategy': 'CLIP',
                                    'padding': {'left': 10, 'top': 8, 'bottom': 8},
                                    'textFormat': {'bold': True, 'fontSize': 11}},
                  'backgroundColor,verticalAlignment,wrapStrategy,padding,textFormat'),
        ]
    # las preguntas: el número y el tipo, apagados; la pregunta, en negrita;
    # las pistas, en gris; y las dos columnas para escribir, amarillas
    for f, p in fila_preg:
        reqs.append({'setDataValidation': {
            'range': rango(f, f + 1, C_RESP, C_RESP + 1),
            # ⚠️ NO ESTRICTA: «Es X» con un X que no está en la lista se
            # escribe a mano, y una validación estricta lo rechazaría.
            'rule': {'condition': {'type': 'ONE_OF_LIST', 'values': [
                {'userEnteredValue': o} for o in p['opciones']]},
                'strict': False, 'showCustomUi': True}}})
    if fila_preg:
        f0, f1 = fila_preg[0][0], fila_preg[-1][0] + 1
        # ⚠️ POR TRAMO, NO DE LA PRIMERA A LA ÚLTIMA: entre medio están las
        # franjas de los eventos, y un formato de columna de f0 a f1 las
        # pisaba —la segunda franja en adelante salía gris, chica y
        # centrada—. Un tramo es una racha de preguntas seguidas.
        for a, b in tramos(f for f, _p in fila_preg):
            reqs += [
                pinta(rango(a, b, 0, 2), {'textFormat': {'foregroundColor': _GRIS, 'fontSize': 9},
                                          'horizontalAlignment': 'CENTER'},
                      'textFormat,horizontalAlignment'),
                pinta(rango(a, b, 2, 3), {'textFormat': {'bold': True, 'fontSize': 10}}, 'textFormat'),
                pinta(rango(a, b, 3, 4), {'textFormat': {'foregroundColor': _GRIS, 'fontSize': 9}},
                      'textFormat'),
                pinta(rango(a, b, C_ESTADO, C_ESTADO + 1),
                      {'textFormat': {'foregroundColor': _GRIS, 'fontSize': 9}}, 'textFormat'),
            ]
        for f, _p in fila_preg:
            reqs.append(pinta(rango(f, f + 1, C_RESP, C_NOTA + 1),
                              {'backgroundColor': _AMARILLO}, 'backgroundColor'))
            # una línea finita entre pregunta y pregunta, sin la cuadrícula
            reqs.append({'updateBorders': {'range': rango(f, f + 1),
                                           'bottom': {'style': 'SOLID', 'colorStyle': {
                                               'rgbColor': {'red': .9, 'green': .91, 'blue': .91}}}}})
        # ✅ la fila contestada, verde; ⚠️ la que no se entendió, roja
        reqs += [
            {'addConditionalFormatRule': {'index': 0, 'rule': {
                'ranges': [rango(f0, f1)],
                'booleanRule': {'condition': {'type': 'CUSTOM_FORMULA', 'values': [
                    {'userEnteredValue': '=AND($H%d<>"",$E%d<>"")' % (f0 + 1, f0 + 1)}]},
                    'format': {'backgroundColor': _VERDE}}}}},
            {'addConditionalFormatRule': {'index': 0, 'rule': {
                'ranges': [rango(f0, f1)],
                'booleanRule': {'condition': {'type': 'CUSTOM_FORMULA', 'values': [
                    {'userEnteredValue': '=LEFT($G%d,1)="⚠"' % (f0 + 1)}]},
                    'format': {'backgroundColor': _ROJO}}}}},
        ]
    if fila_hechas is not None:
        reqs += [
            {'mergeCells': {'range': rango(fila_hechas, fila_hechas + 1), 'mergeType': 'MERGE_ALL'}},
            pinta(rango(fila_hechas, fila_hechas + 1), {
                'backgroundColor': {'red': .93, 'green': .94, 'blue': .94},
                'textFormat': {'bold': True, 'fontSize': 10, 'foregroundColor': _GRIS},
                'padding': {'left': 10, 'top': 6, 'bottom': 6}},
                'backgroundColor,textFormat,padding'),
            pinta(rango(fila_hechas + 1, fin), {'textFormat': {'foregroundColor': _GRIS, 'fontSize': 9}},
                  'textFormat'),
        ]
    # 🔗 los links, al final: van sobre el texto ya escrito y ya formateado.
    # El tramo del link lleva su color; el que sigue vuelve al de la celda.
    for f, c, txt, runs in links:
        tr = []
        for a, b, url in runs:
            tr.append({'startIndex': a, 'format': {
                'link': {'uri': url}, 'underline': True, 'bold': True,
                'foregroundColor': {'red': .02, 'green': .45, 'blue': .38}}})
            if b < _u16(txt):
                tr.append({'startIndex': b, 'format': {}})
        reqs.append({'updateCells': {
            'range': rango(f, f + 1, c, c + 1),
            'rows': [{'values': [{'userEnteredValue': {'stringValue': txt},
                                  'textFormatRuns': tr}]}],
            'fields': 'userEnteredValue,textFormatRuns'}})
    for k, ancho in enumerate((34, 92, 420, 300, 230, 200, 170, 60)):
        reqs.append({'updateDimensionProperties': {
            'range': {'sheetId': sid, 'dimension': 'COLUMNS', 'startIndex': k, 'endIndex': k + 1},
            'properties': {'pixelSize': ancho, 'hiddenByUser': k == C_ID},
            'fields': 'pixelSize,hiddenByUser'}})
    # 🔴 LO QUE NO ES PARA ESCRIBIR, AVISA SI SE ESCRIBE. Protección con
    # aviso —no bloquea: la hoja es de Dlx—: quien edite fuera de RESPUESTA
    # o NOTA ve que eso lo rehace el ciclo. La de la corrida anterior se
    # saca antes, o se apilan.
    for pr in _protecciones(sid):
        reqs.append({'deleteProtectedRange': {'protectedRangeId': pr}})
    reqs.append({'addProtectedRange': {'protectedRange': {
        'range': {'sheetId': sid},
        'description': PROTECCION,
        'warningOnly': True,
        'unprotectedRanges': [rango(f, f + 1, C_RESP, C_NOTA + 1) for f, _p in fila_preg][:200]
        or [rango(FILA_CAB, FILA_CAB + 1, C_RESP, C_NOTA + 1)]}}})
    _pedir('POST', ':batchUpdate', json={'requests': reqs})
    print('   ✅ `%s`: %d pregunta(s) en %d sección(es)' % (HOJA, len(preguntas), len(secs)))


#: 🙈 los días que una batalla o una llave sin campeón le tocan al organizador (`bot/finales.py`) antes que a Dlx
DIAS_ORGANIZADOR = 2
#: los días que un nombre desconocido con un parecido en la Lista se le muestra a Dlx
DIAS_PARECIDO = 7


def _dia_de_pregunta(p, eventos):
    """El día del evento de una pregunta (`datetime.date`), o `None`: del número de evento o de su detalle."""
    ev = eventos.get(_num_evento(p)) or ()
    f = ev[2] if len(ev) > 2 else ''
    if not f:
        partes = [x.strip() for x in str(p.get('detalle') or '').split(' · ')]
        f = next((x for x in partes if re.match(r'^\d{1,2}/\d{1,2}$', x)), '')
    m = re.match(r'^(\d{1,2})/(\d{1,2})$', f or '')
    if not m:
        return None
    hoy = datetime.date.today()
    try:
        d = datetime.date(hoy.year, int(m.group(2)), int(m.group(1)))
    except ValueError:
        return None
    return d if d <= hoy + datetime.timedelta(days=1) else datetime.date(hoy.year - 1, d.month, d.day)


def para_dlx(preguntas, eventos, respuestas=None, hoy=None):
    """🙈 LO QUE ✅ DECIDIR LE MUESTRA A DLX: sólo lo que de verdad necesita su decisión.

    Dlx, 12/10/2026: *«esa página hasta ahora sólo la he visto 2 veces desde que se creó… sólo cosas muy raras que no se
    entiendan aparezcan ahí… no que yo entre y vea 104 cosas pendientes. La idea es que la gran mayoría lo soluciones
    tú, y ahora con los organizadores»*. Medido ese día: 115 preguntas abiertas, y 43 eran nombres que nadie tiene en
    Discord ni se parecen a nadie de la Lista —no hay a quién elegir—.

    · NOMBRE DESCONOCIDO: sólo si hay cuentas que no se pudieron confirmar solas (`_cuenta_de()`), o si se parece a
      alguien de la Lista y el evento es de los últimos `DIAS_PARECIDO` días. Sin nada de eso, Dlx tampoco sabe quién
      es: queda en `Pendientes` y se cierra sola si algún día resuelve (`pendientes.barrer()`).
    · BATALLA SIN GANADOR y BRACKET INCOMPLETO: los primeros `DIAS_ORGANIZADOR` días son del organizador, que tiene la
      pregunta con botones (`bot/finales.py`).
    · Lo demás —altas dudosas, eventos dudosos, alias, conflictos—, siempre: eso sí es raro.
    · Y lo que Dlx ya contestó en la hoja no se esconde nunca, o la respuesta se perdería.

    ⚠️ NO CIERRA NADA: sólo decide qué se pinta. Todo sigue en `Pendientes`."""
    hoy = hoy or datetime.date.today()
    out = []
    for p in preguntas:
        if respuestas and p.get('id') in respuestas:
            out.append(p)
            continue
        t, d = p.get('tipo'), _dia_de_pregunta(p, eventos)
        if t == 'Nombre desconocido':
            ids, _f = _cuenta_de(p, eventos)
            reciente = d is not None and (hoy - d).days <= DIAS_PARECIDO
            if not ids and not (p.get('match') and reciente):
                continue
        elif t in ('Batalla sin ganador', 'Bracket incompleto'):
            if d is not None and (hoy - d).days < DIAS_ORGANIZADOR:
                continue
        out.append(p)
    return out


def correr(dry=True):
    abiertas, repetidas, hechas = _abiertas_de_pendientes()
    eventos = _eventos()
    preguntas = armar(abiertas, eventos)
    respuestas = _respuestas()
    print('\n══ ✅ DECIDIR ══\n')
    print('   %d pregunta(s) abierta(s) · %d fila(s) repetida(s) en '
          '`Pendientes`' % (len(preguntas), len(repetidas)))
    # ↩️ LO QUE DLX DESHIZO EN EL DASHBOARD, ANTES QUE NADA: vuelve a ✅ Decidir y la regla no se le aplica más
    try:
        dsh = deshacer(deshacer_web(), dry=dry)
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ no pude deshacer lo pedido (%s)' % str(e)[:80])
        dsh = []
    if dsh and not dry:
        abiertas, repetidas, hechas = _abiertas_de_pendientes()
        preguntas = armar(abiertas, eventos)
    # ♻️ Y LO QUE OTRA CORRIDA DEJÓ A MEDIAS (escrito afuera y sin cerrar): ver `recuperar_pendientes()`. ⚠️ Con lo que
    # Dlx contestó: su respuesta manda sobre la de la regla
    try:
        rec = recuperar_pendientes(preguntas, dry=dry, respuestas=repartir(preguntas, respuestas), hechas=hechas)
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ no pude revisar lo que quedó a medias (%s)' % str(e)[:80])
        rec = set()
    # 🤖 LAS REGLAS QUE DLX APROBÓ EL 13/10/2026: ver `reglas()`. ⚠️ Ninguna toca lo que Dlx ya contestó, tampoco con
    # «⚡ Todo el evento» (`repartir()`)
    contestadas = repartir(preguntas, respuestas)
    try:
        rr = reglas([p for p in preguntas if p['id'] not in contestadas], eventos, dry=dry, todas=preguntas)
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ no pude correr las reglas (%s)' % str(e)[:80])
        rr = set()
    preguntas = [p for p in preguntas if p['id'] not in rr]
    # 🔑 PRIMERO LO QUE SE CONTESTA SOLO CON DISCORD: ver `por_discord()`
    try:
        solas = por_discord(preguntas, respuestas, eventos, dry=dry)
    except Exception as e:                               # noqa: BLE001
        # ⚠️ NO FRENA ✅ DECIDIR: si falla, las preguntas quedan para Dlx
        print('   ⚠️ no pude resolver con Discord (%s)' % str(e)[:80])
        solas = set()
    preguntas = [p for p in preguntas if p['id'] not in solas]
    # 🔤 Y EL TIPEO OBVIO DE ALGUIEN DE LA LISTA: ver `tipeos()`
    try:
        tip = tipeos(preguntas, respuestas, eventos, dry=dry)
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ no pude revisar los tipeos (%s)' % str(e)[:80])
        tip = set()
    if tip:
        preguntas = [p for p in preguntas if p['id'] not in tip]
        solas = set(solas) | tip
    # 👥 Y LA CUENTA QUE JUEGA CON DOS NOMBRES: ver `una_cuenta_dos_nombres()`. Lo que pregunta aparece la próxima vez
    try:
        una_cuenta_dos_nombres(dry=dry, preguntas=preguntas, respuestas=contestadas, hechas=hechas)
    except Exception as e:                               # noqa: BLE001
        # ⚠️ NO FRENA ✅ DECIDIR, como `por_discord()`
        print('   ⚠️ no pude revisar las cuentas con dos nombres (%s)' % str(e)[:80])
    # 👥 Y LA PERSONA CON DOS CUENTAS: ver `dos_cuentas()`. Sólo pregunta
    try:
        dos_cuentas_corrida(dry=dry, preguntas=preguntas)
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ no pude revisar las personas con dos cuentas (%s)' % str(e)[:80])
    # 👯 Y EL MISMO EVENTO CARGADO DOS VECES: ver `duplicados_corrida()`. Sólo pregunta
    try:
        duplicados_corrida(dry=dry, preguntas=preguntas)
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ no pude revisar los eventos repetidos (%s)' % str(e)[:80])
    # 🧹 Y LO QUE TIENE RESPUESTA SEGURA SIN PREGUNTAR: ver `cierres_solos()`. Sin lo que ya contestó R2 en esta corrida
    ya_solas = {x['p']['id'] for x in _SOLAS}
    try:
        cerradas = cierres_solos([p for p in preguntas if p['id'] not in contestadas and p['id'] not in ya_solas],
                                 dry=dry)
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ no pude cerrar lo seguro (%s)' % str(e)[:80])
        cerradas = {}
    if cerradas:
        preguntas = [p for p in preguntas if p['id'] not in cerradas]
    # 🤖 Y TODO LO QUE SE RESOLVIÓ SOLO, EN UNA ESCRITURA: `Pendientes`, y la lista para el Dashboard (`flush_solas()`)
    preguntas = [p for p in preguntas if p['id'] not in {x['p']['id'] for x in _SOLAS}]
    try:
        solas_n = flush_solas(dry=dry)
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ no pude cerrar lo resuelto solo (%s)' % str(e)[:80])
        solas_n = set()
    # ⚡ lo que se contestó para el evento entero, a cada nombre sin respuesta
    respuestas = repartir(preguntas, respuestas)
    estados = aplicar(preguntas, respuestas, repetidas, dry=dry)
    if (solas or cerradas or solas_n or rr or dsh or rec) and not dry:
        aplicar.hubo = True
    # lo que se acaba de cerrar ya no se pregunta. ⚠️ Y SI NO SE CERRÓ NADA
    # NO SE RELEE: dos lecturas menos en cada corrida, que es la mayoría.
    if not dry and getattr(aplicar, 'hubo', True):
        abiertas, repetidas, hechas = _abiertas_de_pendientes()
        preguntas = armar(abiertas, eventos)
    # 🙈 y a Dlx, sólo lo que necesita su decisión (`para_dlx()`)
    antes = len(preguntas)
    preguntas = para_dlx(preguntas, eventos, respuestas)
    print('   🙈 %d de %d pregunta(s) se le muestran a Dlx: lo demás espera al organizador o no tiene a quién elegir'
          % (len(preguntas), antes))
    # 🌐 y las mismas, al Dashboard (pestaña «Decisiones»): ver `para_web()`
    if not dry:
        publicar_web(preguntas)
    pintar(preguntas, estados, respuestas, hechas, dry=dry)
    return 0


def _self_check():
    global SIN_RED
    print('\n  decidir.py — self-check\n')
    mal = 0
    # la llamada vive en KV: el self-check no la pide (ver `_llamada()`)
    SIN_RED = True

    def ok(cond, que):
        nonlocal mal
        mal += not cond
        print('   %s %s' % ('✅' if cond else '🔴', que))

    ab = [(2, {'Tipo': 'Nombre desconocido', 'Origen': 'evento #350',
               'Detalle': 'JAHNO 🇦🇷', 'Posible match': 'Juano',
               'Estado': 'Pendiente'}),
          (3, {'Tipo': 'Nombre desconocido', 'Origen': 'evento #350',
               'Detalle': 'JAHNO 🇦🇷', 'Posible match': 'Juano',
               'Estado': 'Pendiente'}),
          (4, {'Tipo': 'Bracket incompleto', 'Origen': 'llaves de Discord',
               'Detalle': '(sin titulo) · FFA · 23/09', 'Posible match': 'x',
               'Estado': 'Pendiente'}),
          (5, {'Tipo': 'Evento dudoso', 'Origen': 'llaves de Discord',
               'Detalle': 'COPA X · FFA · 24/09',
               'Posible match': 'es una llave rumbo al Interserver. NO se sumó nada.',
               'Estado': 'Pendiente'})]
    ps = armar(ab, {'350': ('DESGRACIAS EN TOKYO VOL.10', 'FFA', '23/09')})
    _lk = 'https://discord.com/channels/1/2/3'
    dud = armar([(9, {'Tipo': 'Evento dudoso', 'Origen': 'llaves de Discord',
                      'Detalle': 'COPA Y · FFA · 24/09',
                      'Posible match': 'es una llave rumbo al Interserver. NO se sumó nada. · ' + _lk,
                      'Estado': 'Pendiente'})])[0]
    ok(dud['link'] == _lk and _lk not in dud['que'] and _lk not in dud['pistas'],
       'el link a la llave queda aparte: va una vez, en la franja del evento')
    pintar([dud], {}, {}, [], dry=True)
    ok(not any(_lk in str(c) for f in pintar.filas for c in f)
       and [u for _f, _c, _t, rs in pintar.links for _a, _b, u in rs] == [_lk]
       and any('ver la llave ↗' in t for _f, _c, t, _r in pintar.links),
       'y la franja lo trae, una vez y como link: «ver la llave ↗»')
    _t, _r = con_links('La que tiene: https://discord.com/users/146\nLa otra: https://discord.com/users/821')
    ok(_t == 'La que tiene: perfil ↗\nLa otra: perfil ↗'
       and [u for _a, _b, u in _r] == ['https://discord.com/users/146', 'https://discord.com/users/821']
       and _t.encode('utf-16-le')[2 * _r[0][0]:2 * _r[0][1]].decode('utf-16-le') == 'perfil ↗',
       'los perfiles, como links cortos, con los índices en UTF-16')
    _t, _r = con_links('▸  🐍 SNAKE · https://discord.com/channels/1/2/3')
    ok(_t.encode('utf-16-le')[2 * _r[0][0]:2 * _r[0][1]].decode('utf-16-le') == 'ver la llave ↗',
       'un emoji antes del link no corre el tramo')
    ok(tramos([7, 3, 4, 5, 8]) == [(3, 6), (7, 9)] and tramos([]) == [],
       'el formato de las preguntas va por tramo: no pisa las franjas de en medio')
    ok(_lk not in dud['match'], 'y el motivo queda sin el link')
    ok(len(ps) == 3, 'las dos filas de JAHNO son UNA pregunta')
    ok(ps[0]['grupo'][1] == '🏆 Evento', 'los eventos van primero')
    jahno = next(p for p in ps if p['tipo'] == 'Nombre desconocido')
    ok(jahno['filas'] == [2, 3], 'y contestarla cierra las dos filas')
    ok('DESGRACIAS EN TOKYO VOL.10' in jahno['donde'],
       'el evento se dice por su nombre, no por el número')
    # 🔑 R16: JAHNO y Juano son dos personas (Dlx, 24/09/2026, en `no_confundir`): la sugerencia no se ofrece
    ok(jahno['opciones'][-2:] == [NUEVO, TROLL]
       and ('Es Juano' in jahno['opciones']) != _son_distintos_de(jahno['detalle'])('Juano'),
       'la sugerencia es una opción, salvo la que Dlx marcó como otra persona (R16: JAHNO no es Juano)')
    ok(interpretar(jahno, TROLL) == ('troll', jahno['detalle'].replace('🇦🇷', '').strip()),
       '«Es un troll» es troll')
    ok(interpretar(jahno, TROLL)[0] != 'alias',
       'y no se lee como «alias de "un troll"»')

    # 🔴 LO QUE DLX VIO LA PRIMERA VEZ QUE LA USÓ (24/09/2026)
    nd = 'Nombre desconocido'
    filas = [(10, {'Tipo': nd, 'Detalle': 'MAU KC 🇨🇴', 'Origen': 'evento #350'}),
             (11, {'Tipo': nd, 'Detalle': 'Mau Kc 🇨🇴', 'Origen': 'evento #354'}),
             (12, {'Tipo': nd, 'Detalle': 'Volk 🇲🇽', 'Origen': 'evento #352'}),
             (13, {'Tipo': nd, 'Detalle': 'volk 🇨🇴', 'Origen': 'evento #353'}),
             (14, {'Tipo': nd, 'Detalle': 'kc)', 'Origen': 'evento #353'}),
             (15, {'Tipo': nd, 'Detalle': 'kc', 'Origen': 'evento #353'})]
    g = armar(filas)
    mau = next(p for p in g if p['detalle'] == 'MAU KC 🇨🇴')
    ok(mau['filas'] == [10, 11] and 'Mau Kc' in mau['que'],
       'la misma persona escrita distinto es UNA pregunta')
    ok(sum(1 for p in g if norm(p['detalle']) == 'volk') == 2,
       'con otra bandera, sigue aparte')
    ok(next(p for p in g if p['detalle'] == 'kc')['filas'] == [15],
       'un fragmento no se junta con el nombre de verdad')
    ok(es_fragmento('marto🇦🇷+ erian 🇵🇦 + melomaniaco') and es_fragmento('kc)')
       and not es_fragmento('Konan'), 'los fragmentos de equipo se reconocen')
    ok(_reparar('!馃挆ValenAdoratesJuan馃挆') == '!💗ValenAdoratesJuan💗',
       'el emoji mal decodificado se arregla')
    ok(_reparar('Kingđź‡¦đź‡·') == 'King🇦🇷',
       'arregla un emoji leído como Windows-1250 (el de registrar_ids)')
    ok(all(_reparar(x) == x for x in ('José', 'Łukasz', 'Ñandú', 'King🇦🇷', 'Konan')),
       'no toca nombres de verdad: la vuelta entera no da UTF-8')
    ok(_sin_decoracion('👤 | DRAKO MC') == 'DRAKO MC', 'sin el «👤 |» de DRA')
    c = _conflicto_en_palabras("AKA 'Shadow' (fila 237) ya tiene ID 146, el log trae 821")
    ok('discord.com/users/146' in c and 'discord.com/users/821' in c,
       'el conflicto del sync, en palabras y con los dos perfiles')
    _respuestas.notas, _respuestas.sugerencias = {}, {mau['id']: '— son la misma'}
    mau['sug'], mau['pistas'] = '—', '—'
    ok(_nota(mau) == 'son la misma', 'lo escrito en «Pistas» se rescata como nota')
    _respuestas.sugerencias = {mau['id']: mau['pistas'] + ' los dos de Colombia'}
    ok(_nota(mau) == 'los dos de Colombia', 'y lo agregado al final de las pistas, también')
    _respuestas.sugerencias = {mau['id']: 'sv FFA'}
    mau['match'] = 'sv FFA'
    ok(_nota(mau) == '', 'y lo que puso el sistema antes, no')
    _respuestas.sugerencias = {mau['id']: '¿Será King?\nOctavos: perdió con Zeta'}
    mau['pistas'] = '¿Será King?\nSu cuenta: en SR'
    ok(_nota(mau) == '', 'ni las pistas de una versión anterior')
    _respuestas.sugerencias = {mau['id']: '¿Será King?\nes el de SR, seguro'}
    ok(_nota(mau) == 'es el de SR, seguro', 'pero lo que se escribió entre medio, sí')
    _alias = {'tipo': 'Alias posible', 'detalle': "AKA 'Shadow' (fila 237) ya tiene ID 146, "
              "el log trae 821", 'match': 'Shadow', 'sug': 'Shadow', 'origen': 'backfill'}
    ok(_pregunta(_alias)[2][:2] == [MISMA, OTRA]
       and interpretar(_alias, MISMA)[0] == 'cerrar' and interpretar(_alias, OTRA)[0] == 'cerrar',
       '«¿es la misma persona?» se contesta con «es la misma» u «otra», y cierra')
    _DATOS.update({'servidores_de': {'146': ['DRA', 'FFA']}, 'dra': {'146'},
                   'padron': [{'raw': 'Shadow', 'discord_id': '146'}], 'temporada_pool': []})
    ok(_pistas(_alias) == 'La que tiene: en DRA y FFA · Miembro de DRA · en la Lista como Shadow'
       '\nLa otra: no está en ningún servidor de la Liga',
       'las pistas dicen qué es cada cuenta')
    # 🔑 el nombre desconocido que es el apodo de alguien de la Lista
    _DATOS.clear()
    _DATOS.update({'apodos': {'kulrw': {'500'}, 'sol': {'7', '8'}},
                   'padron': [{'raw': 'Jult', 'discord_id': '500'}], 'posibles': {}})
    _ku = {'tipo': 'Nombre desconocido', 'detalle': 'KULRW🇦🇷', 'match': '', 'variantes': ['KULRW🇦🇷'],
           'origen': 'evento #360', 'donde': ''}
    _so = dict(_ku, detalle='SOL🇵🇪', variantes=['SOL🇵🇪'])
    ok(_en_discord('KULRW🇦🇷') == ('En Discord es la cuenta de «Jult» en la Lista', ['Jult'])
       and _pregunta(_ku)[2][0] == 'Es Jult',
       'el apodo de Discord de alguien de la Lista: la pista lo dice y «Es Jult» va primero')
    ok(_en_discord('SOL🇵🇪')[0] == 'En Discord hay 2 cuentas con ese nombre, ninguna en la Lista'
       and _pregunta(_so)[2][0] == NUEVO and _en_discord('L🇨🇴') == ('', []),
       'dos cuentas sin Lista se dicen, y un nombre de una letra no busca nada')
    # 🔎 las cuentas buscadas (04/10/2026): la pista las nombra, la pregunta ofrece elegir una y elegirla es «cuenta»
    _DATOS['posibles'] = {'SOL': [{'id': '7', 'nombre': 'Sol', 'usuario': 'sol_x', 'sv': ['FFA']}]}
    ok('Es la cuenta @sol_x' in _pregunta(_so)[2] and _posibles('SOL🇵🇪') == 'Cuentas con ese nombre: «Sol» @sol_x (FFA)'
       and interpretar(_so, 'Es la cuenta @sol_x') == ('cuenta', _DATOS['posibles']['SOL'][0])
       and interpretar(_so, 'Es la cuenta @otro')[0] == 'error',
       'las cuentas buscadas: la pista, la opción y elegir una carga con esa cuenta')
    _DATOS['posibles'] = {}
    _DATOS.clear()
    _vi = {'tipo': 'Vidas cargado', 'detalle': 'SNAKE ARENA VOL. 2 · SR · 27/09', 'sug': '—',
           'origen': 'veredictos de Discord',
           'match': '23 batallas · 5 raperos | Campeón: DELUXE 🇦🇷 | 2.º JIMMY 🇵🇪 · 3.º DTR 🇨🇴'}
    ok(_pregunta(_vi)[2] == ['Está bien así', 'No cuenta']
       and interpretar(_vi, 'Está bien así') == ('evento', 'cuenta')
       and interpretar(_vi, 'No cuenta') == ('evento', 'no cuenta'),
       'el 5 vidas cargado se confirma o se saca, y queda como decisión del evento')
    ok(_pistas(_vi).split('\n')[1] == 'Campeón: DELUXE 🇦🇷'
       and _seccion(_vi)[0] == 'ev:snakearenavol2|SR|27/09'
       and _seccion(_vi)[1].startswith('SNAKE ARENA VOL. 2 · SR · 27/09'),
       'con el campeón en las pistas, en la sección de su evento')
    _br = {'tipo': 'Bracket incompleto', 'detalle': 'X · FFA · 23/09', 'sug': '—', 'match':
           'sin campeón | cuartos: a vs b | semifinales: c vs d'}
    ok(_pistas(_br) == 'Cuartos: a vs b\nSemifinales: c vs d', 'la llave incompleta muestra sus batallas')
    _respuestas.notas, _respuestas.sugerencias = {}, {}
    ok(interpretar(jahno, 'Es Juano') == ('alias', 'Juano'),
       '«Es Juano» es un alias')
    ok(interpretar(jahno, 'Makmah') == ('alias', 'Makmah'),
       'un nombre escrito a mano también')
    ok(interpretar(jahno, NUEVO)[0] == 'cerrar', '«Es alguien nuevo» cierra')
    ok(interpretar(jahno, 'Sí cuenta')[0] == 'error',
       '«Sí cuenta» no aplica a un nombre: se dice, no se adivina')
    inc = next(p for p in ps if p['tipo'] == 'Bracket incompleto')
    ok(interpretar(inc, 'No cuenta') == ('evento', 'no cuenta'),
       '«No cuenta» queda como decisión del evento')
    dud = next(p for p in ps if p['tipo'] == 'Evento dudoso')
    ok(dud['que'].startswith('No sumó nada porque es una llave rumbo'),
       'el motivo se dice en palabras')
    ok(interpretar(dud, 'Sí cuenta') == ('evento', 'cuenta'),
       '«Sí cuenta» destraba un evento retenido')
    ok(interpretar(dud, 'Dejar para después')[0] == 'esperar',
       '«Dejar para después» la deja abierta')
    ok(clave('A', ' x ') == clave('A', 'x'), 'el id no depende de espacios')
    pad = [{'raw': 'Juano', 'full': 'Juano 🇪🇸'}]
    ok((_persona('Juano', pad, {}) or {}).get('raw') == 'Juano',
       'el nombre se busca en la lista')
    ok(_persona('Zzz', pad, {}) is None, 'y lo que no está no se inventa')
    # ⚔️ la batalla sin ganador (28/09/2026): una pregunta por batalla
    det = detalle_batalla('__ MARRUECOS EN VENTA V.1 __', 'FFA', '26/09', 'OCTAVOS',
                          ['Richard 🇪🇨', 'Number 🇺🇾'])
    bt = armar([(20, {'Tipo': 'Batalla sin ganador', 'Origen': 'llaves de Discord',
                      'Detalle': det, 'Posible match': 'no aparece nadie después · ' + _lk,
                      'Estado': 'Pendiente'}),
                (21, {'Tipo': nd, 'Detalle': 'OKAM🇨🇷', 'Origen': 'evento #359'})],
               {'359': ('__ MARRUECOS EN VENTA V.1 __', 'FFA', '26/09')})
    b = next(p for p in bt if p['tipo'] == 'Batalla sin ganador')
    ok(b['opciones'][:2] == ['Ganó Richard 🇪🇨', 'Ganó Number 🇺🇾'] and NO_SE_JUGO in b['opciones'],
       'la batalla se contesta eligiendo quién ganó')
    ok(interpretar(b, 'Ganó Number 🇺🇾') == ('batalla', 'Number 🇺🇾')
       and interpretar(b, 'gano number') == ('batalla', 'Number 🇺🇾'),
       'con o sin bandera, con o sin tilde')
    ok(interpretar(b, NO_SE_JUGO) == ('batalla', '') and interpretar(b, 'Ganó Zzz')[0] == 'error',
       '«No se jugó» cierra sin ganador, y un nombre que no peleó es un error')
    ok(interpretar(b, NADIE_SIGUIO) == ('batalla', NADIE) and interpretar(b, 'nadie siguio') == ('batalla', NADIE)
       and NADIE_SIGUIO in b['opciones'],
       '«Nadie siguió»: se jugó, nadie pasó y cobran la ronda (DEM UZBEKISTAN, 07/10)')
    ok(clave_batalla(det) == clave_batalla(det.replace('Richard 🇪🇨', 'RICHARD')),
       'la clave no depende de banderas ni mayúsculas')
    ok(partes_batalla(det)[4] == ['Richard 🇪🇨', 'Number 🇺🇾'], 'el detalle se lee de vuelta')
    sec = secciones(bt)
    ok(len(sec) == 1 and sec[0][0].startswith('MARRUECOS EN VENTA V.1 · FFA · 26/09')
       and [p['tipo'] for p in sec[0][1]] == ['Batalla sin ganador', nd],
       'la batalla y el nombre del mismo evento van en UNA sección, la batalla primero')
    ok('Richard 🇪🇨 🆚 Number 🇺🇾' in b['que'] and 'ronda siguiente' in b['pistas'],
       'la pregunta dice quiénes pelearon, y las pistas por qué no se sabe')
    pintar(bt, {}, {}, [], dry=True)
    ok(any(str(f[0]).startswith('▸  MARRUECOS') for f in pintar.filas),
       'la hoja tiene la franja del evento')

    # 🔑 «¿quién es X?» con una sola cuenta, en seco (28/09/2026, «2. A»)
    antes = dict(_DATOS)
    try:
        _DATOS['apodos'] = {'praiseriza': {'1'}, 'kulrw': {'2'}, 'mhs': {'3'},
                            'rorro': {'4'}, 'pollo': {'5'}}
        _DATOS['padron'] = [{'raw': 'Jult', 'discord_id': '2'}, {'raw': 'Pollo Sport'}]
        _DATOS['servidores_de'] = {'1': ['FFA'], '2': ['FFA'], '3': ['DRA'], '5': ['FFA']}
        # 🔴 AISLADO DE LOS DATOS DE VERDAD: sin esto leía `datos/anuncios.json`
        # —PRAISERIZA sí se anotó— y el caché de apodos de la máquina, y pasaba
        # acá y fallaba en CI, que no tiene caché (28/09/2026)
        _DATOS.update({'inscritos': {}, 'donde': {}, 'podio': {}})
        ev = {'359': ('MARRUECOS', 'FFA', '26/09')}
        qs = armar([(30, {'Tipo': nd, 'Detalle': 'PRAISERIZA 🇻🇪', 'Origen': 'evento #359'}),
                    (31, {'Tipo': nd, 'Detalle': 'KULRW🇦🇷', 'Origen': 'evento #359'}),
                    (32, {'Tipo': nd, 'Detalle': 'MHS 🇦🇷', 'Origen': 'evento #359'}),
                    (33, {'Tipo': nd, 'Detalle': 'RORRO', 'Origen': 'evento #359'}),
                    (34, {'Tipo': nd, 'Detalle': 'pollo', 'Origen': 'evento #359'})], ev)
        ids = {p['detalle']: p['id'] for p in qs}
        solas = por_discord(qs, {}, ev, dry=True)
        ok(ids['PRAISERIZA 🇻🇪'] in solas and ids['KULRW🇦🇷'] in solas,
           'con una sola cuenta: nuevo (PRAISERIZA) o alias (KULRW = Jult)')
        ok(ids['MHS 🇦🇷'] not in solas,
           'un nombre corto con la cuenta en OTRO servidor que el del evento, no')
        ok(ids['RORRO'] not in solas and ids['pollo'] not in solas,
           'ni una cuenta que no está en la Liga, ni un nombre que se parece a alguien de la Lista')
        ok(not por_discord(qs, {ids['PRAISERIZA 🇻🇪']: ('Es alguien nuevo',)}, ev, dry=True)
           - {ids['KULRW🇦🇷']}, 'lo que Dlx ya contestó no se toca')
        # 🔑 y la inscripción (Dlx, 28/09/2026: «combinar con sus IDs»)
        _DATOS['inscritos'] = indice_inscritos([
            {'servidor': 'FFA', 'texto': 'Prrr🇦🇴', 'discord_id': '9'},
            {'servidor': 'FFA', 'texto': 'PARIA SIN REMEDIO🇧🇲 +PRRR🇦🇴', 'discord_id': '9'},
            {'servidor': 'FFA', 'texto': 'Player 🇻🇪', 'discord_id': '7'},
            {'servidor': 'FFA', 'texto': 'Steven 🇨🇴', 'discord_id': '7'},
            {'servidor': 'URBF', 'texto': 'Iguana 🇵🇪', 'discord_id': '8'}])
        ok(_DATOS['inscritos'] == {'FFA': {'prrr': {'9'}}, 'URBF': {'iguana': {'8'}}},
           'sólo las de un nombre, y no las de quien anota a otros (Player y Steven)  %s' % _DATOS['inscritos'])
        _prov = [{'servidor': 'FFA', 'texto': '🇮🇨', 'discord_id': '30'}] * 2 + [
            {'servidor': 'FFA', 'texto': 'fleivaman🇨🇦 + belleza🇮🇨', 'discord_id': '30'},
            {'servidor': 'FFA', 'texto': 'uno🇮🇨 + otro🇮🇨', 'discord_id': '30'},
            {'servidor': 'FFA', 'texto': '🇦🇷', 'discord_id': '31'},
            {'servidor': 'FFA', 'texto': 'ana🇦🇷 + beto🇨🇱', 'discord_id': '31'}]
        ok(suyos_de_pareja(_prov) == [('30', 'FFA', 'belleza')],
           '«fleivaman🇨🇦 + belleza🇮🇨» desde la cuenta que se anota sola con «🇮🇨»: belleza es esa cuenta; '
           'con los dos de esa bandera, o con la bandera una sola vez, no  %s' % suyos_de_pareja(_prov))
        _DATOS['servidores_de'].update({'9': ['FFA'], '7': ['FFA'], '8': ['URBF']})
        qs = armar([(40, {'Tipo': nd, 'Detalle': 'PRRR 🇦🇴', 'Origen': 'evento #359'}),
                    (41, {'Tipo': nd, 'Detalle': 'PARIA SIN REMEDIO 🇧🇲', 'Origen': 'evento #359'}),
                    (42, {'Tipo': nd, 'Detalle': 'IGUANA 🇵🇪', 'Origen': 'evento #359'}),
                    (43, {'Tipo': nd, 'Detalle': 'Steven', 'Origen': 'evento #359'})], ev)
        ids = {p['detalle']: p['id'] for p in qs}
        solas = por_discord(qs, {}, ev, dry=True)
        ok(ids['PRRR 🇦🇴'] in solas and ids['PARIA SIN REMEDIO 🇧🇲'] not in solas,
           'PRRR se anotó solo desde su cuenta: sale; PARIA SIN REMEDIO sólo va en la de dos, no')
        ok(ids['IGUANA 🇵🇪'] not in solas and ids['Steven'] not in solas,
           'la inscripción de OTRO servidor no vale, ni la de quien anota a otros')
        # 🔴 y la cuenta de Snake Rap o Urban que todavía no está en la Lista:
        # `servidores_de.json` no la tiene —guarda sólo las del padrón—, el
        # caché de apodos sí. 28/09/2026: 10 de 50 preguntas quedaban por eso.
        _DATOS['inscritos'] = indice_inscritos([
            {'servidor': 'SR', 'texto': 'leteletras🇨🇱', 'discord_id': '11'}])
        _DATOS['apodos'].update({'isaias': {'12'}, 'jimmy': {'13'}})
        _DATOS['donde'] = {'11': ['SR'], '12': ['SR'], '13': ['SR']}
        ev2 = {'363': ('RAP EXHIBITION', 'SR', '22/09'), '351': ('TOKYO VOL 11', 'FFA', '23/09')}
        qs = armar([(50, {'Tipo': nd, 'Detalle': 'leteletras🇨🇱', 'Origen': 'evento #363'}),
                    (51, {'Tipo': nd, 'Detalle': 'ISAIAS 🇪🇸', 'Origen': 'evento #351'}),
                    (52, {'Tipo': nd, 'Detalle': 'JIMMY 🇵🇪', 'Origen': 'evento #363'})], ev2)
        ids = {p['detalle']: p['id'] for p in qs}
        solas = por_discord(qs, {}, ev2, dry=True)
        ok(ids['leteletras🇨🇱'] in solas and ids['JIMMY 🇵🇪'] in solas,
           'la cuenta que sólo está en Snake Rap y no en la Lista: por su inscripción, o por su nombre en el servidor del evento')
        ok(ids['ISAIAS 🇪🇸'] not in solas,
           'pero no un nombre suelto con la cuenta en otro servidor que el del evento (ISAIAS)')
        # 🔴 una pareja escrita sin «+» no es una persona (VOL 16 2VS2, 28/09/2026)
        _DATOS['inscritos'] = indice_inscritos([
            {'servidor': 'FFA', 'texto': '27 🇺🇸 Piyi 🇲🇽', 'discord_id': '20'},
            {'servidor': 'FFA', 'texto': 'Garxziiscity 🇦🇿🇲🇽 🇻🇪🇦🇷', 'discord_id': '21'}])
        ok(_DATOS['inscritos'] == {'FFA': {'garxziiscity': {'21'}}},
           'la bandera ENTRE dos nombres separa («27 🇺🇸 Piyi 🇲🇽» son dos); las del final no  %s'
           % _DATOS['inscritos'])
        _DATOS['apodos'].update({'27piyi': {'20'}})
        _DATOS['donde'].update({'20': ['FFA']})
        qs = armar([(60, {'Tipo': nd, 'Detalle': '27 🇺🇸 Piyi 🇲🇽', 'Origen': 'evento #359'})], ev)
        ok(not por_discord(qs, {}, ev, dry=True),
           'y un lado que son dos nombres no se resuelve como una cuenta, aunque alguien se llame así')
        # 🔑 el podio con mención (Dlx, 28/09/2026: «A · sí, como las inscripciones»)
        _DATOS['podio'] = {'rapexhibition18|SR|22/09': {'antorchaolimpica': '30'}}
        _DATOS['donde'].update({'30': ['SR']})
        ev3 = {'363': ('__ RAP EXHIBITION 1 8 __', 'SR', '22/09')}
        qs = armar([(70, {'Tipo': nd, 'Detalle': 'ANTORCHA OLIMPICA', 'Origen': 'evento #363'}),
                    (71, {'Tipo': nd, 'Detalle': 'KIRITO', 'Origen': 'evento #363'})], ev3)
        ids = {p['detalle']: p['id'] for p in qs}
        ok(por_discord(qs, {}, ev3, dry=True) == {ids['ANTORCHA OLIMPICA']},
           'el campeón que el podio menciona se resuelve con esa cuenta; el que no sube al podio, no')
        # ⚡ el evento entero (Dlx, 28/09/2026: «va»)
        qs = armar([(80, {'Tipo': nd, 'Detalle': 'KIRITO', 'Origen': 'evento #363'}),
                    (81, {'Tipo': nd, 'Detalle': 'PLA PLA', 'Origen': 'evento #363'}),
                    (82, {'Tipo': nd, 'Detalle': 'RIQUEZA', 'Origen': 'evento #363'}),
                    (83, {'Tipo': nd, 'Detalle': 'SOLITO', 'Origen': 'evento #359'})],
                   dict(ev3, **ev))
        ids = {p['detalle']: p['id'] for p in qs}
        bq = bloques(qs)
        ok(len(bq) == 1 and len(next(iter(bq.values()))) == 3,
           'la fila «⚡ Todo el evento» sale en el evento con varios nombres, no en el de uno')
        b = next(iter(bq))
        rp = repartir(qs, {b: (EN_BLOQUE, ''), ids['PLA PLA']: ('Es Pollo Sport', '')})
        ok(rp[ids['KIRITO']][0] == NUEVO and rp[ids['RIQUEZA']][0] == NUEVO
           and rp[ids['PLA PLA']][0] == 'Es Pollo Sport' and ids['SOLITO'] not in rp,
           'y «Todos son gente nueva» contesta a los que no tienen respuesta: la de su fila manda')
        pintar(qs, {}, {b: (EN_BLOQUE, '')}, [], dry=True)
        ok(sum(1 for f in pintar.filas if f[-1] == b) == 1,
           'la hoja tiene la fila del bloque, con su id')
        # 🎙️ la llamada (Dlx, 29/09/2026: «podrías chequear quiénes están en
        # la llamada?»): la foto se carga a mano, el self-check no sale a la red
        t0 = 1790660472174                 # 03:41 UTC del 29/09, la llave del 1vs1
        viejas = list(_LLAVES_T1)
        _LLAVES_T1[:] = [{'371': {'links': ['https://discord.com/channels/1/2/%d'
                                            % ((t0 - 1420070400000) << 22)]}}]
        _DATOS.pop('lista_por_id', None)
        _DATOS['llamada'] = {'FFA': {
            '2': {'n': ['MOTERA', 'motera_x'], 'c': ['🎤'], 't': [t0 + 600000]},
            '7': {'n': ['snowzzzz'], 'c': ['🎤'], 't': [t0 + 1200000]},
            '8': {'n': ['ZORRO'], 'c': ['🎤'], 't': [t0 - 3 * 86400000]}}}
        ev4 = {'371': ('DESGRACIAS EN TOKYO VOL 16', 'FFA', '28/09')}
        try:
            qs = armar([(90, {'Tipo': nd, 'Detalle': 'MOTERA 🇨🇴', 'Origen': 'evento #371'})], ev4)
            pz, en = _en_llamada('MOTERA 🇨🇴', '371')
            ok('estaba «MOTERA» (en la Lista: Jult)' in pz and en == ['Jult'],
               'el nombre raro de la llave estaba en la llamada mientras se jugaba: es una cuenta de la Lista  %s' % pz)
            ok('Es Jult' in qs[0]['opciones'] and pz in qs[0]['pistas'],
               'y va como pista y como opción de la pregunta')
            ok('había alguien parecido: «snowzzzz»' in _en_llamada('snow', '371')[0],
               'un nombre parecido dice «parecido», no «estaba»')
            ok(_en_llamada('ZORRO', '371')[0] == '' and _en_llamada('MOTERA', '999')[0] == '',
               'quien estuvo en la llamada tres días antes no cuenta, y sin evento no hay pista')
            # 🔑 «1. A» (29/09): el nombre EXACTO de UNA persona de la llamada
            # que ya está en la Lista se resuelve solo, como alias
            ok(por_discord(qs, {}, ev4, dry=True) == {qs[0]['id']},
               'la llamada resuelve sola: «MOTERA» es alias de Jult, que estaba en la llamada con ese nombre')
            _DATOS['llamada']['FFA']['5'] = {'n': ['Motera'], 'c': ['🎤'], 't': [t0 + 900000]}
            qs = armar([(91, {'Tipo': nd, 'Detalle': 'MOTERA 🇨🇴', 'Origen': 'evento #371'})], ev4)
            ok(por_discord(qs, {}, ev4, dry=True) == set(),
               'con dos «MOTERA» en la llamada no elige: queda la pregunta')
            del _DATOS['llamada']['FFA']['5']
            _DATOS['llamada']['FFA']['6'] = {'n': ['RAREZA'], 'c': ['🎤'], 't': [t0 + 900000]}
            qs = armar([(92, {'Tipo': nd, 'Detalle': 'RAREZA', 'Origen': 'evento #371'})], ev4)
            ok(por_discord(qs, {}, ev4, dry=True) == set() and 'estaba «RAREZA»' in qs[0]['pistas'],
               'una cuenta de la llamada que no está en NINGÚN servidor de la Liga no entra: sólo la pista')
            # 🔑 01/10/2026 (Dlx: «que el BOT haga la mayoría de las cosas por su propia cuenta… hasta el máximo»):
            # UNA cuenta con ese nombre exacto en la llamada, en el servidor del evento, entra a la Lista aunque no
            # estuviera. Es «TITO CALDERON» de la DESGRACIAS EN TOKYO VOL 20
            _DATOS['servidores_de']['6'] = ['FFA']
            qs = armar([(93, {'Tipo': nd, 'Detalle': 'RAREZA', 'Origen': 'evento #371'})], ev4)
            ok(por_discord(qs, {}, ev4, dry=True) == {qs[0]['id']},
               'una sola cuenta con ese nombre exacto en la llamada, en el servidor del evento: entra a la Lista')
            # 🔑 y el PARECIDO de una sola persona de la Lista que estaba en la llamada: «ELSOLAR» era Elsoolar (en
            # la llamada), no Solar (que no estaba)
            _DATOS['padron'] = list(_DATOS['padron']) + [{'raw': 'Elsoolar', 'discord_id': '20'},
                                                         {'raw': 'Solar', 'discord_id': '21'}]
            _DATOS.pop('lista_por_id', None)
            _DATOS['llamada']['FFA']['20'] = {'n': ['elsoolar'], 'c': ['🎤'], 't': [t0 + 900000]}
            qs = armar([(94, {'Tipo': nd, 'Detalle': 'ELSOLAR 🇨🇴', 'Origen': 'evento #371'})], ev4)
            ok(_cuenta_de(qs[0], ev4) == (['20'], 'llamada_parecido') and por_discord(qs, {}, ev4, dry=True) == {qs[0]['id']},
               'un nombre parecido al de UNA persona de la Lista que estaba en la llamada: es alias suyo (Elsoolar)')
            _DATOS['llamada']['FFA']['21'] = {'n': ['Solar'], 'c': ['🎤'], 't': [t0 + 950000]}
            qs = armar([(95, {'Tipo': nd, 'Detalle': 'ELSOLAR 🇨🇴', 'Origen': 'evento #371'})], ev4)
            ok(por_discord(qs, {}, ev4, dry=True) == set(),
               'con dos parecidos en la llamada (Elsoolar y Solar) no elige: queda la pregunta')
            del _DATOS['llamada']['FFA']['21']
            _DATOS['llamada']['FFA']['22'] = {'n': ['elsolarr'], 'c': ['🎤'], 't': [t0 + 950000]}
            qs = armar([(96, {'Tipo': nd, 'Detalle': 'ELSOLAR 🇨🇴', 'Origen': 'evento #371'})], ev4)
            ok(por_discord(qs, {}, ev4, dry=True) == set(),
               'y si en la llamada hay además un parecido FUERA de la Lista, tampoco')
        finally:
            _LLAVES_T1[:] = viejas

        # 🔑 01/10/2026 —«mejorar la detección de personas automáticamente»—: lo que la llave dice, todos los
        # eventos de un nombre, el nombre que crece, quien se anotó con su nombre, y lo que se cierra solo
        print('\n  lo que la llave dice de quién es quién, y lo que se cierra solo')
        nd = 'Nombre desconocido'
        ev5 = {'358': ('__ MARRUECOS EN VENTA V.1 __', 'FFA', '23/09'),
               '359': ('__ MARRUECOS EN VENTA V.1 __', 'FFA', '26/09'),
               '375': ('__ DESGRACIAS EN TOKYO VOL 18 2VS2 __', 'FFA', '30/09')}
        _DATOS['identidad'] = {
            'marruecosenventav1|FFA|26/09': {'menciones': {'shuliot': '77'}},
            'desgraciasentokyovol182vs2|FFA|30/09': {'crece': [['Paria🇦🇷', 'PARIA SIN REMEDIO 🇦🇷']]}}
        _DATOS['padron'] = [{'raw': 'Paria', 'discord_id': ''}, {'raw': 'MILICA 👑', 'discord_id': '6'},
                            {'raw': 'Xervoe', 'discord_id': '1'}]
        _DATOS.pop('lista_por_id', None)
        _DATOS['inscritos'] = {'FFA': {'paria': {'55'}}}
        _DATOS['podio'] = {}
        _DATOS['apodos'], _DATOS['donde'] = {}, {'8': ['DRA', 'FFA']}
        _DATOS['servidores_de'] = {'77': ['FFA'], '55': ['FFA']}
        qs = armar([(101, {'Tipo': nd, 'Detalle': 'SHULIOT🇦🇷', 'Origen': 'evento #358'}),
                    (102, {'Tipo': nd, 'Detalle': 'SHULIOT🇦🇷', 'Origen': 'evento #359'})], ev5)
        ok(_nums(qs[0]) == ['358', '359'], 'un nombre de dos eventos se busca en los dos, no sólo en el primero')
        ok(_cuenta_de(qs[0], ev5) == (['77'], 'llave'),
           'la mención que pasó de ronda con ese nombre dice qué cuenta es (SHULIOT, del segundo evento)')
        ok(por_discord(qs, {}, ev5, dry=True) == {qs[0]['id']}, '… y entra a la Lista con esa cuenta')
        qs = armar([(103, {'Tipo': nd, 'Detalle': 'PARIA SIN REMEDIO 🇦🇷', 'Origen': 'evento #375'})], ev5)
        ok(_crecio_de(qs[0], ev5, _DATOS['padron'], {}) == 'Paria'
           and por_discord(qs, {}, ev5, dry=True) == {qs[0]['id']},
           'el nombre que crece de una ronda a otra es alias de quien ya está en la Lista (Paria)')
        ok(_se_anoto_como('55', _DATOS['padron']) == 'Paria'
           and _se_anoto_como('55', [{'raw': 'Paria', 'discord_id': '99'}]) is None,
           'la cuenta que se anotó sola como alguien de la Lista sin cuenta es esa persona; con otra cuenta, no')
        _guarda = _nombres_en_resultados
        try:
            globals()['_nombres_en_resultados'] = lambda: {'six', 'papa'}
            al = 'Alias posible'
            qs = armar([(110, {'Tipo': al, 'Detalle': "ID 1 ya pertenece a fila 3 (Xervoe 🇨🇱); no se asignó a 'xervœ'"}),
                        (111, {'Tipo': al, 'Detalle': "AKA 'o.e.p' (fila 622) ya tiene ID 5, el log trae 6"}),
                        (112, {'Tipo': al, 'Detalle': "AKA 'Ññ' (fila 407) ya tiene ID 7, el log trae 8"}),
                        (113, {'Tipo': nd, 'Detalle': 'SIX 🇦🇷 R', 'Origen': 'evento #375'}),
                        (114, {'Tipo': nd, 'Detalle': 'papa', 'Origen': 'evento #375'})], ev5)
            c = cierres_solos(qs, dry=True)

            def de(pref):
                return next(q['id'] for q in qs if q['detalle'].startswith(pref))
            ok(de('ID 1 ya') in c and de("AKA 'o.e.p'") in c and de("AKA 'Ññ'") not in c,
               '«¿es la misma persona?» se cierra sola cuando la respuesta se lee: la ligadura, o la otra cuenta ya es '
               'otra persona de la Lista; dos cuentas de la Liga siguen preguntando')
            ok(de('SIX') in c and de('papa') not in c,
               'un nombre que ya no está en ningún resultado se cierra; uno que sigue, se pregunta')
            globals()['_nombres_en_resultados'] = lambda: None
            ok(not cierres_solos([q for q in qs if q['tipo'] == nd], dry=True),
               'sin Resultados leído no se cierra ningún nombre')
        finally:
            globals()['_nombres_en_resultados'] = _guarda
        ok(_sugerencias('PichulaMc, PichulaMc, PichulaMc') == ['PichulaMc'], 'las sugerencias no se repiten')
    finally:
        _DATOS.clear()
        _DATOS.update(antes)
    # 👥 una cuenta, dos nombres (Velatz y Shisui, 06/10/2026, y la revisión de esa noche)
    _rd = lambda n: {'shishui': 'shisui', 'cyk': 'crackandkrank'}.get(norm(_sin_bandera(n)), norm(_sin_bandera(n)))  # noqa: E731
    _ls = [{'raw': 'Velatz', 'discord_id': '1'}, {'raw': 'Mr.Kude', 'discord_id': '2'},
           {'raw': 'Player', 'discord_id': '3'}, {'raw': 'Org', 'discord_id': '4'}, {'raw': 'Cris', 'discord_id': '5'},
           {'raw': 'Alonso', 'discord_id': ''}, {'raw': 'EmiZor', 'discord_id': '9'}, {'raw': 'Mudo', 'discord_id': '13'},
           {'raw': 'Pcyka', 'discord_id': '12'}, {'raw': 'Dos', 'discord_id': '15'}, {'raw': 'DosBis', 'discord_id': '15'}]
    _cp = {k: k.title() for k in ('velatz', 'shisui', 'kude', 'player', 'steven', 'ana', 'bea', 'cris', 'pipas', 'rt',
                                    'alonso', 'zeta', 'emi', 'sol', 'amigo', 'juan', 'shinji', 'otro', 'xname')}
    _cp['crackandkrank'] = 'Crack and Krank'
    _i = lambda d, t, dia='2026-10-04', sv='FFA': {'discord_id': d, 'texto': t, 'cuando': dia + 'T20:00', 'servidor': sv}  # noqa: E731
    _ins = [_i('1', 'Shisui 🇯🇵'), _i('1', 'Shishui 🇯🇵', '2026-10-05'), _i('1', 'Velatz 🇨🇱'),
            _i('2', 'Kude 🇦🇷'), _i('2', 'Kude 🇦🇷', '2026-10-05'), _i('2', 'Jr 🇵🇪 (me pidió que lo inscriba)'),
            _i('3', 'Steven 🇨🇴'), _i('3', 'Player 🇻🇪'),
            _i('4', 'Ana'), _i('4', 'Ana', '2026-10-05'), _i('4', 'Bea'), _i('4', 'Bea', '2026-10-05'),
            _i('5', 'Pipas'), _i('5', 'Pipas', '2026-10-05'),
            _i('6', 'RT 🇲🇽'), _i('6', 'RT 🇲🇽', '2026-10-05'), _i('6', 'RT 🇲🇽', '2026-10-05'),
            _i('7', 'Alonso 🇨🇱'), _i('7', 'Alonso 🇨🇱', '2026-10-05'),
            _i('8', 'Zeta'), _i('8', 'Zeta', '2026-10-05'), _i('10', 'Zeta'),
            _i('9', 'Emi 🇲🇽'),
            _i('12', 'CyK'), _i('12', 'CyK', '2026-10-05'),
            _i('13', 'Amigo'), _i('13', 'Amigo', '2026-10-05'),
            _i('14', 'Juan 🇦🇷'), _i('14', 'Juan 🇦🇷', '2026-10-05'), _i('14', 'Pedro'), _i('14', 'Luis'),
            _i('16', 'Shinji 🇯🇵'), _i('16', 'Shinji 🇯🇵', '2026-10-05'),
            _i('15', 'Xname'), _i('15', 'Xname', '2026-10-05')]
    _men = [('ffaworldcup|FFA|27/09', 'sol', '11'), ('sintitulo|FFA|27/09', 'sol', '11'),
            ('copa|FFA|28/09', 'sol', '11')]
    _jg = {'cris': {1}, 'pipas': {1}, 'velatz': {2}, 'shisui': {3}, 'player': {4}, 'ana': {5}, 'bea': {6}, 'org': {7}}
    _liga = {'mx', 'cl', 'ar', 'co', 've', 'pe'}
    d2 = dos_nombres(_ins, _men, _ls, _cp, _jg, _rd, liga=_liga)
    _u = {(x['alias'], x['real']) for x in d2['unir']}
    _e = {x['nombre']: x for x in d2['enganchar']}
    _p = {(x['alias'], x['real']) for x in d2['preguntar']}
    ok(('Shisui', 'Velatz') in _u,
       'Velatz: su cuenta se anotó como Shisui (y Shishui) en dos días, y juega con su nombre: se unen solos')
    ok(('Kude', 'Mr.Kude') in _u,
       'Mr.Kude no juega, pero Kude es el único otro nombre y se le parece: se unen («(me pidió…)» es para otro)')
    ok(all(a != 'Steven' for a, _b in _u | _p), 'Player anotó a Steven una vez y no se parecen: nada')
    ok(('Ana', 'Org') in _p and ('Bea', 'Org') in _p and all(b != 'Org' for _a, b in _u),
       'una cuenta que JUEGA y anota a dos es la de un organizador: se pregunta, no se une (antes: los dos solos)')
    ok(('Amigo', 'Mudo') in _p and all(b != 'Mudo' for _a, b in _u),
       'una cuenta que no juega y anota a uno que no se le parece: se pregunta, no se une')
    ok(all(a != 'Pipas' for a, _b in _u | _p), 'jugaron el mismo evento: son dos')
    ok('Rt' in _e and not _e['Rt']['fila'] and _e['Rt']['cc'] == 'mx' and _e['Rt']['pruebas'] == 2,
       'RT: tres inscripciones en dos días son dos pruebas; fila nueva, con su bandera de la Liga')
    ok('Shinji' in _e and _e['Shinji']['cc'] == '', 'una bandera que no es de la Liga («Shinji 🇯🇵») no da país')
    ok('Alonso' in _e and _e['Alonso']['fila'], 'Alonso: su fila no tiene cuenta: se le pone')
    ok('Sol' in _e and _e['Sol']['pruebas'] == 2,
       'SOL: la misma llave guardada dos veces (27/09) cuenta UNA; con la del 28/09, dos')
    ok('Juan' not in _e, 'la cuenta que anota a Juan dos veces y a Pedro y Luis una no es la de Juan (antes: sí)')
    ok(all(a != 'Zeta' for a, _b in _u | _p) and 'Zeta' not in _e, 'un nombre que usaron dos cuentas no es de ninguna')
    ok(('Emi', 'EmiZor') in _p, 'Emi y EmiZor: una sola prueba, pero se parecen: se pregunta')
    ok(('Crack and Krank', 'Pcyka') in _p and all(a != 'Crack and Krank' for a, _b in _u),
       'un nombre de equipo («Crack and Krank») no se une solo: se pregunta')
    ok(('Xname', 'Dos') in _p and all(a != 'Xname' for a, _b in _u),
       'una cuenta con dos filas en la Lista no se une sola: se pregunta')
    _d3 = dos_nombres(_ins, _men, _ls, _cp, _jg, _rd, son_distintos=lambda a, b: {a, b} == {'Shisui', 'Velatz'})
    ok(all((x['alias'], x['real']) != ('Shisui', 'Velatz') for x in _d3['unir'] + _d3['preguntar']),
       'marcados distintos en AKAs: ni se unen ni se pregunta')
    _d4 = dos_nombres(_ins, _men, _ls, _cp, _jg, _rd, preguntados=[('Shisui', 'Velatz')])
    ok(all((x['alias'], x['real']) != ('Shisui', 'Velatz') for x in _d4['unir'] + _d4['preguntar']),
       'un par que ya está preguntado no se une solo aunque lleguen más pruebas: lo contesta Dlx')
    _d5 = dos_nombres(_ins, _men, _ls, _cp, _jg, _rd, en_la_liga=lambda did: did != '6')
    ok('Rt' not in {x['nombre'] for x in _d5['enganchar']}, 'una cuenta que no está en la Liga no se engancha')
    _d6 = dos_nombres(_ins, _men, _ls, _cp, _jg, _rd, es_equipo=lambda n: n == 'Kude')
    ok(all(a != 'Kude' for a, _b in {(x['alias'], x['real']) for x in _d6['unir']}),
       'un equipo que la llave nombra con UN nombre (`es_equipo`) tampoco se une solo')
    _q = {'tipo': 'Alias posible', 'detalle': 'DOS NOMBRES: «Shisui» → «Velatz» · cuenta 1'}
    ok(interpretar(_q, MISMA) == ('unir', ('Shisui', 'Velatz'))
       and interpretar(_q, OTRA) == ('distintos', ('Shisui', 'Velatz')),
       '«¿es la misma persona?»: «es la misma» los une y «otra» los marca distintos')
    ok('los puntos de «Shisui» pasan a Velatz' in _conflicto_en_palabras(_q['detalle']),
       'y la pregunta dice qué pasa si contestás que sí')

    # 👥 DOS CUENTAS, UNA PERSONA (07/10/2026): Riferian y Erian, como estaban en la Lista
    _rd = lambda n: norm(_sin_bandera(n))                                 # noqa: E731
    _lista = [{'raw': 'Erian', 'pais': 'Panamá', 'discord_id': '1055'},
              {'raw': 'Riferian', 'pais': 'Panamá', 'discord_id': '6815'},
              {'raw': 'Ana', 'pais': 'Chile', 'discord_id': '1'}, {'raw': 'Mariana', 'pais': 'Chile', 'discord_id': '2'},
              {'raw': 'Snow', 'pais': 'Colombia', 'discord_id': '3'}, {'raw': 'Snowy', 'pais': 'Chile', 'discord_id': '4'},
              {'raw': 'Kairo', 'pais': 'Ecuador', 'discord_id': '5'}, {'raw': 'Kairos', 'pais': 'Ecuador', 'discord_id': '6'},
              {'raw': 'Lex', 'pais': 'Perú', 'discord_id': '7'}, {'raw': 'Lexus', 'pais': 'Perú', 'discord_id': '8'}]
    _cp = {_rd(r['raw']): r['raw'] for r in _lista}
    _jg = {'erian': {349, 353, 357}, 'riferian': {359, 380}, 'ana': {1}, 'mariana': {2}, 'snow': {3}, 'snowy': {4},
           'kairo': {5}, 'kairos': {5}, 'lex': {6}, 'lexus': {7}}
    _dc = dos_cuentas(_lista, _cp, _jg, _rd)
    ok([(x['alias'], x['real'], x['did_alias']) for x in _dc] == [('Riferian', 'Erian', '6815')],
       'dos cuentas: «Riferian» es la otra cuenta de Erian, y nada más  %s' % _dc)
    ok(not any(x['real'] in ('Ana', 'Mariana') for x in _dc),
       'el nombre de 3 letras adentro de otro no alcanza (Ana en Mariana)')
    ok(not any(x['real'] in ('Snow', 'Snowy') for x in _dc), 'de distinto país, no')
    ok(not any(x['real'] in ('Kairo', 'Kairos') for x in _dc), 'si jugaron el mismo evento, no: son dos')
    ok(not dos_cuentas(_lista, _cp, _jg, _rd, preguntados=[('Riferian', 'Erian')]),
       'lo ya preguntado no se vuelve a preguntar')
    ok(not dos_cuentas(_lista, _cp, _jg, _rd, son_distintos=lambda a, b: {a, b} == {'Riferian', 'Erian'}),
       'ni lo marcado distinto')
    _q2 = {'tipo': 'Alias posible', 'detalle': 'DOS CUENTAS: «Riferian» → «Erian» · cuentas 6815 y 1055'}
    ok(interpretar(_q2, MISMA) == ('dos_cuentas', ('Riferian', 'Erian', '6815'))
       and interpretar(_q2, OTRA) == ('distintos', ('Riferian', 'Erian')),
       '«es la misma» la hace la otra cuenta de Erian; «otra», distintos')
    ok('otra cuenta de Erian' in _conflicto_en_palabras(_q2['detalle']) and '6815' in _conflicto_en_palabras(_q2['detalle']),
       'y la pregunta lleva las dos cuentas')
    # 👯 el mismo evento dos veces (`duplicados_corrida()`): «sí» saca el número más alto, POR NÚMERO; «no», nunca más
    _qd = {'tipo': 'Evento duplicado', 'detalle': 'DUPLICADO: #409 «(sin titulo)» · FFA · 27/09 = #366 «FFA WORLD CUP '
                                                  'EL ESTADIO DEL FREESTYLE 2026» · 7 de 7 batallas', 'match': '', 'sug': '—'}
    _pd = _pregunta(_qd)
    ok('#409' in _pd[0] and '#366' in _pd[0] and _pd[2][0] == SACAR_DUP + '409'
       and interpretar(_qd, SACAR_DUP + '409') == ('sacar_num', (409, 366, '(sin titulo)', 'FFA', '27/09'))
       and interpretar(_qd, NO_DUP) == ('no_duplicado', (409, 366)),
       'el mismo evento dos veces: «sí» saca el #409 por número, «no» los deja y no se vuelve a preguntar')
    # 🔤 el tipeo obvio (`tipeo_de()`)
    _pt = [{'raw': 'Enkill', 'pais': 'Argentina'}, {'raw': 'Hassan', 'pais': 'Argentina'},
           {'raw': 'HadaH', 'pais': 'México'}, {'raw': 'Olaf', 'pais': 'México'},
           {'raw': 'Kael', 'pais': 'Chile'}, {'raw': 'Kaelo', 'pais': 'Chile'}]
    _je = lambda r: {'FFA'}                              # noqa: E731
    ok(tipeo_de('Enkil 🇦🇷', None, _pt, {'FFA'}, _je) == 'Enkill'
       and tipeo_de('Hasan🇦🇷', None, _pt, {'FFA'}, _je) == 'Hassan',
       'el tipeo obvio: una letra, el mismo país, y juega en ese servidor')
    ok(tipeo_de('Enkil 🇦🇷', None, _pt, {'DRA'}, _je) is None, 'si nunca jugó en ese servidor, no')
    ok(tipeo_de('Hasan 🇲🇽', None, _pt, {'FFA'}, _je) is None, 'de otro país, no')
    ok(tipeo_de('Ola🇲🇽', None, _pt, {'FFA'}, _je) is None, 'menos de cinco letras, no: «Ola» no es Olaf')
    ok(tipeo_de('Kaell 🇨🇱', None, _pt, {'FFA'}, _je) is None, 'dos parecidos del mismo país, no')
    ok(tipeo_de('Enkil', None, _pt, {'FFA'}, _je) is None
       and tipeo_de('Enkil', ['Enkil 🇦🇷', 'Enkil 🇨🇱'], _pt, {'FFA'}, _je) is None, 'sin bandera o con dos, no')
    ok(tipeo_de('Enkil 🇦🇷', None, _pt, {'FFA'}, _je, lambda a, b: True) is None, 'ni lo marcado distinto')
    # 🌐 las preguntas para el Dashboard (13/10/2026): por evento, sin los reportes, y «Es <nombre>» libre sólo en nombres
    _pw = [{'id': 'a1', 'tipo': 'Nombre desconocido', 'detalle': 'ZORRO', 'que': '¿Quién es ZORRO?', 'pistas': '—',
            'opciones': ['Es alguien nuevo'], 'link': 'https://discord.com/channels/1/2/3', 'seccion': ('ev:x', 'COPA · FFA · 07/10'),
            'grupo': (3, 'n'), 'filas': [5]},
           {'id': 'a2', 'tipo': 'Reporte', 'detalle': 'x · #4', 'que': 'r', 'pistas': '', 'opciones': [],
            'link': '', 'seccion': ('ev:x', 'COPA · FFA · 07/10'), 'grupo': (0, 'r'), 'filas': [6]},
           {'id': 'a3', 'tipo': 'Batalla sin ganador', 'detalle': 'y', 'que': '¿Quién ganó?', 'pistas': 'p',
            'opciones': ['Ganó A', 'Ganó B'], 'link': 'javascript:x', 'seccion': ('ev:x', 'COPA · FFA · 07/10'),
            'grupo': (0, 'b'), 'filas': [2]}]
    _w = para_web(_pw)
    ok([x['id'] for x in _w] == ['a3', 'a1'] and _w[1]['libre'] and not _w[0]['libre'] and _w[0]['link'] == ''
       and _w[1]['sec'] == 'COPA · FFA · 07/10',
       'las preguntas del Dashboard: en el orden de la hoja, sin los reportes, y sólo links de Discord')

    # ── 🤖 lo que se resolvió solo y las reglas del 13/10/2026 ─────────────────────────────────────────────────────────
    _guarda_d, _guarda_s = dict(_DATOS), dict(_SOLAS_D)
    try:
        _SOLAS[:] = []
        _SOLAS_D['d'] = {'solas': [], 'deshechas': ['yaNo']}
        _q = {'id': 'q1', 'tipo': 'Evento dudoso', 'detalle': 'x', 'filas': [3], 'seccion': ('', 'X · FFA · 01/10'),
              'que': '¿?'}
        ok(resolver_solo(_q, YA_NO, 'R1', 'porque sí') and not resolver_solo(_q, YA_NO, 'R1', 'otra vez')
           and not resolver_solo(dict(_q, id='yaNo'), YA_NO, 'R1', 'p')
           and flush_solas(dry=True) == {'q1'} and not _SOLAS,
           'todo lo resuelto solo pasa por resolver_solo(): una vez por corrida, y nunca lo que Dlx deshizo')
        ok(_regla_dicha('R2').startswith('R2 · una cuenta') and _regla_dicha('Discord').startswith('Discord · '),
           'la regla va en palabras al Dashboard')
        ok(deshacer(['yaNo'], dry=True) == [] and deshacer(['q9'], dry=True) == ['q9'],
           'Deshacer: lo ya deshecho no se repite')
        # 🏆 el «Bracket incompleto» con «Ganó X» (Dlx, 13/10/2026)
        _m22 = ('sin campeón y sin tocar hace 12 h o más: la guía (Parte 1) lo descarta y NO se sumó nada. Si cuenta, '
                'completá la final en la llave | cuartos: cinefilo vs solar vs marco polo | cuartos: nc vs mi sicario '
                'vs regional (masino | semifinales: los 3 vs nacho vs baltrip')
        _mr3 = ('sin campeón y sin tocar hace 12 h o más: x | cuartos: ⚔️ Semifinales: OASIS, LETRAO vs Verc | '
                'semifinales: ⚔️ Semifinales: SNOW vs tam')
        _m19 = 'sin campeón: x | final: WALKER SANITY vs NOXVELL'
        _mp = 'sin campeón: x | semifinales: ANA vs BEA | semifinales: CID vs DAN · pasó CID'
        ok(ultima_ronda(_m22)[0] == 'semifinal' and _candidatos_campeon(_m22) == ['los 3', 'nacho', 'baltrip'],
           'la última ronda de la (sin titulo) del 22/09: la semifinal de tres, y cada uno puede ser el campeón')
        ok(ultima_ronda(_mr3)[0] == 'semifinal' and _candidatos_campeon(_mr3) == ['OASIS, LETRAO', 'Verc', 'SNOW', 'tam'],
           'LA REDENCION VOL.3: el rótulo que trae el texto manda («⚔️ Semifinales») y el equipo es un lado')
        ok(_candidatos_campeon(_mp) == ['ANA', 'BEA', 'CID'], 'de una batalla con ganador, sólo el que pasó')
        _b = {'id': 'b1', 'tipo': 'Bracket incompleto', 'detalle': '(sin titulo) · FFA · 22/09', 'match': _m22,
              'origen': 'llaves de Discord', 'sug': '—'}
        _pb = _pregunta(_b)
        ok(_pb[2] == ['Ganó los 3', 'Ganó nacho', 'Ganó baltrip', 'No cuenta', 'La completo en Discord']
           and 'las semifinales cobran esa ronda' in _pb[0],
           'el bracket incompleto ofrece «Ganó X» por cada lado de la última ronda, y dice cómo paga')
        ok('el otro, subcampeón' in _pregunta(dict(_b, match=_m19))[0], 'si la última ronda es la final, el otro es subcampeón')
        ok(interpretar(_b, 'Ganó nacho') == ('campeon', {'ganador': 'nacho', 'ronda': 'semifinal',
                                                           'batallas': [['los 3', 'nacho', 'baltrip']], 'pasaron': []})
           and interpretar(_b, 'Ganó Konan')[0] == 'error' and interpretar(_b, 'No cuenta') == ('evento', 'no cuenta'),
           '«Ganó X» es el campeón de esa llave; alguien que no está, error; «No cuenta» sigue igual')
        ok(_pregunta(dict(_b, match='sin campeón: x'))[2] == ['No cuenta', 'La completo en Discord'],
           'sin batallas que leer, las dos de siempre')
        # R1 · lo que ya no existe
        _ll = {'419': {'nombre': '__ MAÑANA DE LLUVIA VOL 1 __', 'sv': 'FFA', 'fecha': '07/10',
                       'rondas': [{'r': 'Cuartos', 'b': []}, {'r': 'Final', 'b': []}]},
               '365': {'nombre': 'SNAKE ARENA VOL. 2', 'sv': 'SR', 'fecha': '27/09', 'rondas': [{'r': '5 vidas', 'b': []}]}}
        _evs = {'419': ('__ MAÑANA DE LLUVIA VOL 1 __', 'FFA', '07/10'), '365': ('SNAKE ARENA VOL. 2', 'SR', '27/09')}
        ok('llave común' in vidas_no_suma('MAÑANA DE LLUVIA VOL 1 · FFA · 07/10', _evs, _ll, None)
           and 'decidido' in vidas_no_suma('5 VIDAS 07:57 · FFA · 07/10', _evs, _ll, 'no cuenta')
           and vidas_no_suma('SNAKE ARENA VOL. 2 · SR · 27/09', _evs, _ll, None) == '',
           'R1: el 5 vidas que no es el evento cargado con ese nombre (MAÑANA DE LLUVIA) se cierra; uno de verdad, no')
        # 🔴 la revisión del 14/10: «no está cargado» puede ser que procesar_entrada no lo cargó TODAVÍA; y un sacado
        # con ese nombre no tapa a otro cargado que sí es el 5 vidas
        _ll2 = dict(_ll, **{'420': {'nombre': '__ MAÑANA DE LLUVIA VOL 1 __', 'sv': 'FFA', 'fecha': '07/10',
                                    'rondas': [{'r': '5 vidas', 'b': []}]}})
        _evs2 = dict(_evs, **{'420': ('__ MAÑANA DE LLUVIA VOL 1 __', 'FFA', '07/10')})
        ok(vidas_no_suma('OTRO · FFA · 07/10', _evs, _ll, None) == ''
           and vidas_no_suma('MAÑANA DE LLUVIA VOL 1 · FFA · 07/10', _evs2, _ll2, None) == ''
           and 'llave común' in vidas_no_suma('MAÑANA DE LLUVIA VOL 1 · FFA · 07/10', _evs2, _ll2, None, {420}),
           'R1: uno que no está cargado queda abierto, y con dos con ese nombre manda el que no se sacó')
        # R4 · la copia de una batalla ya resuelta (FVS UNDER, #461)
        _l461 = {'461': {'nombre': 'FVS UNDER', 'sv': 'FVS', 'fecha': '26/09', 'rondas': [
            {'r': 'Cuartos', 'b': [[['Refran', 'Richard'], 'Refran', ''], [['Drexx', 'Astral'], 'Drexx', ''],
                                   [['Astral🇦🇷', 'Draxx🇨🇱'], '', 'sin ganador: espera en ✅ Decidir']]}]}}
        _al = {'rfran': 'refran', 'ricard': 'richard', 'draxx': 'drexx'}
        _cn = lambda x: _al.get(norm(_sin_bandera(lado_limpio(x))), norm(_sin_bandera(lado_limpio(x))))  # noqa: E731
        ok(copia_de('FVS UNDER · FVS · 26/09 · cuartos · Rfran🇪🇸 🆚 Ricard🇪🇨', _l461, _cn) == ('461', ['Refran', 'Richard'], 'Refran')
           and copia_de('FVS UNDER · FVS · 26/09 · cuartos · Astral🇦🇷 🆚 Draxx🇨🇱', _l461, _cn)[2] == 'Drexx'
           and copia_de('FVS UNDER · FVS · 26/09 · semifinales · Rfran🇪🇸 🆚 Ricard🇪🇨', _l461, _cn) is None
           and copia_de('FVS UNDER · FVS · 26/09 · cuartos · Rfran🇪🇸 🆚 Otro', _l461, _cn) is None,
           'R4: la batalla que ya está resuelta con otros nombres es copia; otra ronda u otro rival, no')
        # R12 · el bracket incompleto que es un pedazo de un evento cargado (LA REDENCION VOL.3 en el #447)
        _l447 = {'447': {'nombre': 'LA REDENCION', 'sv': 'FFA', 'fecha': '10/10', 'rondas': [
            {'r': 'Semifinales', 'b': [[['Oasis, Letrao🇨🇱', 'Verc'], 'Oasis, Letrao🇨🇱', ''], [['Snow', 'Tam'], 'Snow', '']]}]}}
        ok(pedazo_de(_mr3, 'FFA', '10/10', _l447, _cn) == ('447', 'LA REDENCION')
           and pedazo_de(_mr3, 'DDF', '10/10', _l447, _cn) is None and pedazo_de(_m22, 'FFA', '10/10', _l447, _cn) is None,
           'R12: un bracket incompleto con las mismas batallas que un evento del mismo servidor y día es un pedazo')
        # R6 · «nadie siguió» como contestaron todas las demás (DEM UZBEKISTAN FECHA 2)
        _bd = {'demuzbekistanfecha2|FFA|13/10|octavos|chop|marto|sinlimites': {'ganador': NADIE, 'por': 'el organizador'},
               'demuzbekistanfecha2|FFA|13/10|octavos|bna|vandu|yor': {'ganador': NADIE, 'por': 'el organizador'}}
        _d6 = 'DEM UZBEKISTAN FECHA 2 · FFA · 13/10 · octavos · SAIK 🆚 Xubaru prime 🇧🇲 🆚 warap🇦🇷'
        _otra = {'tipo': 'Batalla sin ganador', 'detalle': 'DEM UZBEKISTAN FECHA 2 · FFA · 13/10 · octavos · A 🆚 B'}
        ok(len(nadie_como_las_demas(_d6, _bd, [{'tipo': 'Batalla sin ganador', 'detalle': _d6}]) or []) == 2
           and nadie_como_las_demas(_d6, _bd, [_otra]) is None
           and nadie_como_las_demas(_d6, dict(_bd, **{'demuzbekistanfecha2|FFA|13/10|octavos|x|y': {'ganador': 'X'}}), []) is None
           and nadie_como_las_demas(_d6.replace('octavos', 'cuartos'), _bd, []) is None,
           'R6: si todas las demás de esa ronda son «nadie siguió», ésta también; con otra abierta o un ganador, no')
        # R3 · el alta que buscó otro, y el texto
        _qa = {'id': 'a9', 'tipo': 'alta', 'detalle': 'Seba = 1382549511775191060', 'match': 'sv FFA', 'sug': '—'}
        ok(_por_otro('sv FFA') and _por_otro('sv FFA · lo buscó otra persona con /card')
           and not _por_otro('sv FFA · sin país (ni bandera en el apodo ni rol de país)')
           and _pregunta(_qa)[0].startswith('A «Seba» lo buscó otra persona con /card en FFA (no lo usó él)')
           and _pregunta(dict(_qa, match='sv DRA · ¿es Villa?'))[0].startswith('«Seba» usó /card en DRA'),
           'R3: el alta que buscó otra persona no dice «usó /card»; la propia, sí')
        # R2 · una cuenta que usa varios nombres, con la bandera de su dueño y sin rol de staff
        _rd2 = lambda n: {'hinjkybesuk': 'bna'}.get(norm(_sin_bandera(n)), norm(_sin_bandera(n)))  # noqa: E731
        _ins2 = [{'discord_id': '849', 'servidor': 'FFA', 'texto': 'Ckl', 'cuando': '2026-10-06T00:57:10'},
                 {'discord_id': '849', 'servidor': 'DDF', 'texto': 'Ckl', 'cuando': '2026-10-11T17:01:04'},
                 {'discord_id': '849', 'servidor': 'FFA', 'texto': 'Armando Faso 🇦🇫', 'cuando': '2026-10-07T22:45:08'},
                 {'discord_id': '849', 'servidor': 'FFA', 'texto': 'Armando faso🇦🇷', 'cuando': '2026-10-11T02:15:44'},
                 {'discord_id': '849', 'servidor': 'FFA', 'texto': '🇦🇫', 'cuando': '2026-10-11T16:47:13'},
                 {'discord_id': '849', 'servidor': 'FFA', 'texto': 'Trrr🇦🇷', 'cuando': '2026-10-12T20:14:31'},
                 {'discord_id': '849', 'servidor': 'FFA', 'texto': 'Bna', 'cuando': '2026-10-12T20:13:27'},
                 {'discord_id': '1439', 'servidor': 'DDF', 'texto': 'Riley🇵🇪', 'cuando': '2026-10-11T16:59:52'},
                 {'discord_id': '1439', 'servidor': 'DDF', 'texto': 'Riley🇵🇪', 'cuando': '2026-10-12T15:50:44'},
                 {'discord_id': '1439', 'servidor': 'DDF', 'texto': 'Dm🇵🇪', 'cuando': '2026-10-07T01:32:12'}]
        _ls2 = [{'raw': 'BNA', 'discord_id': '849', 'pais': 'Argentina'},
                {'raw': 'Dominick', 'discord_id': '1439', 'pais': 'Perú'}]
        _cp2 = {'ckl': 'Ckl', 'armandofaso': 'Armando Faso', 'trrr': 'TRRR 🇦🇷', 'riley': 'Riley🇵🇪', 'dm': 'Dm🇵🇪',
                'bna': 'BNA', 'dominick': 'Dominick'}
        _jg2 = {'ckl': {407}, 'armandofaso': {425}, 'trrr': {462}, 'bna': {449}, 'riley': {451}, 'dm': {415},
                'dominick': {440}}
        _iso2 = lambda pais: {'Argentina': 'ar', 'Perú': 'pe'}.get(pais, '')  # noqa: E731
        _rol2 = lambda did, sv: did == '1439' and sv == 'DDF'  # noqa: E731
        _r2 = dos_nombres(_ins2, [], _ls2, _cp2, _jg2, _rd2, con_rol=_rol2, iso_de=_iso2,
                          preguntados=[('Ckl', 'BNA')])
        _u2 = {(x['alias'], x['real']): x for x in _r2['unir']}
        ok(('Ckl', 'BNA') in _u2 and _u2[('Ckl', 'BNA')].get('regla') == 'R2' and _u2[('Ckl', 'BNA')]['preguntado']
           and ('Armando Faso', 'BNA') in _u2 and ('TRRR 🇦🇷', 'BNA') not in _u2,
           'R2: Ckl y Armando Faso son BNA (2 pruebas cada uno, su bandera o la que usa sola); TRRR, con una, no')
        ok(not any(x['alias'] == 'Riley🇵🇪' for x in _r2['unir']),
           'R2: la cuenta de alguien con rol de staff ahí (Dominick en DDF) no se une sola: anota a otros')
        ok(not any(x.get('regla') == 'R2' for x in dos_nombres(_ins2, [], _ls2, _cp2, _jg2, _rd2, con_rol=_rol2,
                                                                iso_de=_iso2, cuentas_con_nombre=lambda k: {'7'})['unir']),
           'R2: si otra cuenta de Discord se llama así, no')
        ok(not any(x.get('regla') == 'R2' for x in dos_nombres(_ins2, [], _ls2, _cp2, dict(_jg2, ckl={449}, armandofaso={449}),
                                                                _rd2, con_rol=_rol2, iso_de=_iso2)['unir']),
           'R2: si jugaron el mismo evento, no: son dos')
        # R11 · el nombre ya no está en SU evento
        _gr = _nombres_en_resultados
        try:
            globals()['_nombres_en_resultados'] = lambda: {'g8': {'354', '381'}, 'papa': {'349'}, 'volk': {'353'}}
            _DATOS['resultados_b'] = {('g8', '🇨🇴'), ('g8', '🇯🇴'), ('papa', ''), ('volk', '🇲🇽')}
            _qs = armar([(201, {'Tipo': 'Nombre desconocido', 'Detalle': 'G8', 'Origen': 'evento #425'}),
                         (202, {'Tipo': 'Nombre desconocido', 'Detalle': 'papa', 'Origen': 'evento #349'}),
                         (203, {'Tipo': 'Nombre desconocido', 'Detalle': 'Volk 🇲🇽', 'Origen': 'evento #352'})],
                        {'425': ('PRITTY FREE', 'FFA', '07/10'), '349': ('EL RAP FECHA 5', 'FFA', '22/09'),
                         '352': ('DESGRACIAS CON TOKIO', 'FFA', '23/09')})
            _c11 = cierres_solos(_qs, dry=True)
            ok(_qs[0]['id'] in _c11 and _qs[1]['id'] not in _c11 and _qs[2]['id'] not in _c11
               and any(x['regla'] == 'R11' for x in _SOLAS),
               'R11: un nombre que ya no está en SU evento se cierra (G8 del #425); si sigue con su bandera en otro '
               '(Volk 🇲🇽 en el #353), no: la fila es una por nombre')
            # (6, la revisión del 14/10/2026) con `Resultados` vacío no se cierra nada: `{}` también es un dict
            _SOLAS[:] = []
            globals()['_nombres_en_resultados'] = lambda: {}
            _DATOS['resultados_b'] = set()
            ok(not cierres_solos(_qs, dry=True) and not _SOLAS, 'R11: con `Resultados` vacío no cierra nada')
        finally:
            globals()['_nombres_en_resultados'] = _gr
            _SOLAS[:] = []
        # R17 · la cuenta que se anotó así para ese evento, entre las opciones
        _DATOS['anuncios'] = {'inscripciones': [
            {'discord_id': '849', 'quien': 'benjaclink31', 'servidor': 'FFA', 'texto': 'Trrr🇦🇷', 'cuando': '2026-10-12T20:14:31'},
            {'discord_id': '55', 'quien': 'nadie', 'servidor': 'FFA', 'texto': 'Trrr🇦🇷', 'cuando': '2026-10-01T20:14:31'},
            {'discord_id': '66', 'quien': 'otro', 'servidor': 'URBF', 'texto': 'Trrr🇦🇷', 'cuando': '2026-10-12T20:14:31'}]}
        _DATOS['padron'] = [{'raw': 'BNA', 'discord_id': '849', 'pais': 'Argentina'}]
        _DATOS.pop('lista_por_id', None)
        _DATOS['eventos'] = {'9462': ('COMPE POR 1.5 DOLARES', 'FFA', '12/10')}
        _q17 = {'id': 't1', 'tipo': 'Nombre desconocido', 'detalle': 'TRRR 🇦🇷', 'origen': 'evento #9462',
                'origenes': ['evento #9462'], 'match': 'Hassan', 'variantes': ['TRRR 🇦🇷'], 'sug': 'Hassan'}
        _o17 = _pregunta(_q17)[2]
        ok([c['id'] for c in _cuentas_insc(_q17)] == ['849'] and _o17[0] == 'Es BNA',
           'R17: la cuenta que se anotó «Trrr» para ese evento es la primera opción («Es BNA»); otro día u otro '
           'servidor, no')

        # ── 🔴 la revisión del 14/10/2026 ──────────────────────────────────────────────────────────────────────────
        # (1, 2) R2 no pisa a Dlx: lo contestado sin aplicar, una fila que resolvió él, lo deshecho; y sin pregunta
        # abierta no une (vuelve a preguntar, como antes de R2)
        _x2 = {'alias': 'Ckl', 'real': 'BNA', 'regla': 'R2', 'si_no': 'preguntar'}
        _pq = [{'id': 'nd1', 'tipo': 'Nombre desconocido', 'detalle': 'Ckl'},
               {'id': 'ap1', 'tipo': 'Alias posible', 'detalle': 'DOS NOMBRES: «Ckl» → «BNA» · cuenta 849'}]

        def _f2(ps=_pq, resp=None, no=(), np=(), dn=(), dp=()):
            return filtrar_r2([_x2, {'alias': 'A', 'real': 'B'}], ps, resp or {}, set(no), set(np), set(dn), set(dp))
        _s0 = _f2()
        ok(_s0[0] == [_x2, {'alias': 'A', 'real': 'B'}] and [q['id'] for q in _s0[2][id(_x2)]] == ['nd1', 'ap1']
           and not _s0[1], 'R2 contesta las preguntas abiertas de ese par, y lo que no es de R2 pasa igual')
        ok(all(_x2 not in s[0] and s[1] == [_x2] for s in (
            _f2(resp={'ap1': (OTRA, '')}), _f2(no={'nd1'}), _f2(np={('ckl', 'bna')}), _f2(dn={'ckl'}),
            _f2(dp={frozenset(('ckl', 'bna'))}), _f2(ps=[]))),
           'R2 no une si Dlx contestó algo de ese nombre o ese par (sin aplicar o ya resuelto), si lo deshizo alguna '
           'vez, ni sin una pregunta abierta: vuelve a preguntarse, como antes de R2')
        _dn, _dp = _lo_que_dlx_contesto(_pq, {'nd1': (NUEVO, '')},
                                        [(9, {'Tipo': 'Alias posible', 'Detalle': 'DOS NOMBRES: «Jb» → «JHEYSON» · cuenta 1'})])
        ok(_dn == {'ckl'} and _dp == {frozenset(('jb', 'jheyson'))}, 'lo que Dlx contestó, por nombre y por par')
        # (4) R2 pide 3 letras: «nadie más usa ese nombre» sale de apodos de 3 o más
        _ins4 = _ins2 + [{'discord_id': '849', 'servidor': 'FFA', 'texto': 'Jb🇦🇷', 'cuando': '2026-10-02T01:00:00'},
                         {'discord_id': '849', 'servidor': 'URBF', 'texto': 'Jb', 'cuando': '2026-10-03T01:00:00'}]
        ok(not any(x['alias'] == 'JB' and x.get('regla') == 'R2' for x in dos_nombres(
            _ins4, [], _ls2, dict(_cp2, jb='JB'), dict(_jg2, jb={300}), _rd2, con_rol=_rol2, iso_de=_iso2)['unir']),
           'R2: un nombre de 2 letras no se une solo')
        # (7) R12 con una sola batalla, o en otra ronda, no es un pedazo
        _lw = {'1': {'nombre': 'COPA A', 'sv': 'FFA', 'fecha': '10/10', 'rondas': [
            {'r': 'Cuartos', 'b': [[['WALKER SANITY', 'NOXVELL'], 'NOXVELL', ''], [['ANA', 'BEA'], 'ANA', '']]}]}}
        ok(pedazo_de(_m19, 'FFA', '11/10', _lw, _cn) is None
           and pedazo_de('x | final: WALKER SANITY vs NOXVELL | final: ANA vs BEA', 'FFA', '11/10', _lw, _cn) is None
           and pedazo_de('x | cuartos: WALKER SANITY vs NOXVELL | cuartos: ANA vs BEA', 'FFA', '11/10', _lw, _cn)
           == ('1', 'COPA A'),
           'R12: una sola batalla no alcanza («final: WALKER vs NOXVELL» no es un pedazo de un cuartos), ni dos en otra '
           'ronda; dos en la misma, sí')
        # (8) «Ganó X» con su bandera
        _bv = dict(_b, match='x | final: Volk 🇲🇽 vs volk 🇨🇴')
        ok(_candidatos_campeon(_bv['match']) == ['Volk 🇲🇽', 'volk 🇨🇴']
           and interpretar(_bv, 'Ganó volk 🇨🇴')[1]['ganador'] == 'volk 🇨🇴'
           and interpretar(_bv, 'Ganó volk')[0] == 'error'
           and mismo_lado('Volk', 'volk 🇨🇴') and not mismo_lado('Volk 🇲🇽', 'volk 🇨🇴'),
           '«Ganó volk 🇨🇴» no es «Volk 🇲🇽»: son dos opciones, y sin bandera no se adivina')
        # (10) lo que dice la pregunta es lo que paga `con_campeon()`
        ok('también los que ganaron su batalla' in como_cobra('cuartos')
           and 'la otra semifinal' in como_cobra('semifinal') and como_cobra('final').endswith('subcampeón'),
           'la pregunta dice qué cobra cada uno según la última ronda: cuartos, semis o final')
        # (11) R19 sólo si el evento cargado ya paga esa ronda
        _l19 = {'418': {'tabla': [['Pomberito', 'Campeón', 7500], ['Badterne', 'Octavos', 625], ['Desio', 'Octavos', 625]]},
                '422': {'tabla': [['EmiZor', 'Octavos', 0], ['Krish', 'Octavos', 625]]}}
        ok(cobran_ronda(_l19, ['418'], 'octavos').startswith('#418: Badterne 625')
           and cobran_ronda(_l19, ['422'], 'octavos') == '' and cobran_ronda(_l19, ['999'], 'octavos') == '',
           'R19: el aviso de ESCALA se cierra sólo si en el evento cargado los de esa ronda ya cobran')
        # (15) Deshacer: sólo la fila que sigue siendo la que se cerró, y la unión entera
        _hay = [{'tipo': 'alta', 'rk': 'R3', 'por': 'el ciclo', 'variantes': ['Seba = 1'], 'filas': [5, 6, 7]}]
        _hj = {5: {'Tipo': 'alta', 'Estado': 'Resuelto', 'Detalle': 'Seba = 1', 'Resuelto por': 'el ciclo (R3)'},
               6: {'Tipo': 'alta', 'Estado': 'Resuelto', 'Detalle': 'Otro = 2', 'Resuelto por': 'el ciclo (R3)'},
               7: {'Tipo': 'alta', 'Estado': 'Resuelto', 'Detalle': 'Seba = 1', 'Resuelto por': 'Dlx en ✅ Decidir'}}
        ok(filas_a_reabrir(_hay, _hj) == ([5], [6, 7]), 'Deshacer reabre sólo la fila que sigue como la dejó la regla')
        _SOLAS_D['d'] = {'solas': [{'id': 's1', 'escribio': {'alias': ['Ckl', 'BNA']}},
                                   {'id': 's2', 'escribio': {'alias': ['ckl', 'BNA']}}, {'id': 's3'}],
                         'deshechas': [], 'pares_deshechos': [['jb', 'jheyson']]}
        ok(deshacer(['s1'], dry=True) == ['s1', 's2'] and ('jb', 'jheyson') in pares_deshechos(),
           'Deshacer una pregunta de R2 deshace las otras que cerró con ese alias, y el par queda deshecho para siempre')
        # (16) R16 con bandera y servidor: lo del Force 🇲🇽 de FVS no vale para el Force de URBF
        _ak16 = {'no_confundir': [['Force', 'ForceGP', 'Dlx, 12/10/2026: el Force 🇲🇽 de FVS no es ForceGP 🇲🇽.'],
                                  ['JAHNO', 'Juano', 'JAHNO es de Argentina y Juano de Espana']]}
        _sg = {'FVS', 'URBF', 'FFA'}
        ok(not distintos_aca('Force 🇦🇷', 'ForceGP', _ak16, {'FVS'}, _sg)
           and not distintos_aca('Force', 'ForceGP', _ak16, {'URBF'}, _sg)
           and distintos_aca('Force', 'ForceGP', _ak16, {'FVS'}, _sg)
           and distintos_aca('JAHNO 🇦🇷', 'Juano', _ak16, {'FFA'}, _sg),
           'R16: el «no es» de Dlx vale con su bandera y en su servidor; sin ninguno de los dos, en todos')
        # (18) el Dashboard lee `t` como número
        _SOLAS_D['d'] = {'solas': [{'id': 'z', 't': _ahora_ms()}, {'id': 'v', 't': '2020-01-01T00:00:00Z'}]}
        _sw = solas_web()
        ok([x['id'] for x in _sw] == ['z'] and isinstance(_sw[0]['t'], int)
           and _t_ms('2026-10-14T04:00:00Z') == 1791950400000,
           'lo resuelto solo va con `t` en milisegundos, y lo de más de 14 días no')
        # (14) R5 sólo la llave de broma; (1) las reglas no tocan lo contestado
        _lk1 = next(((L['links'][0], n) for n, L in _llaves_t1().items() if L.get('links')), None)
        if _lk1:
            _SOLAS[:] = []
            _q5 = {'id': 'r5a', 'tipo': 'Evento dudoso', 'detalle': 'X · FFA · 01/10', 'origen': 'llaves de Discord',
                   'link': _lk1[0], 'filas': [1], 'match': 'es una llave rumbo al Interserver: ¿cuenta?'}
            _q5b = dict(_q5, id='r5b', match='la publicó @x, que nunca había publicado una llave, y ningún anuncio')
            ok(reglas([_q5, _q5b], {_lk1[1]: ('x', 'FFA', '01/10')}, dry=True) == {'r5b'},
               'R5: se cierra la llave de broma que ya se cargó; la retenida por Interserver espera a Dlx')
            _SOLAS[:] = []

        # ── 🔴 la tercera revisión (14/10/2026) ───────────────────────────────────────────────────────────────────────
        # (A) R2 POR PERSONA: «Ckl → BNA» y «Ckl → Hinjkybesuk», con Hinjkybesuk → BNA en AKAs (`_rd2`)
        _xa = {'alias': 'Ckl', 'real': 'BNA', 'regla': 'R2', 'si_no': 'preguntar'}
        _pa = [{'id': 'ndc', 'tipo': 'Nombre desconocido', 'detalle': 'Ckl'},
               {'id': 'apb', 'tipo': 'Alias posible', 'detalle': 'DOS NOMBRES: «Ckl» → «BNA» · cuenta 849'},
               {'id': 'aph', 'tipo': 'Alias posible', 'detalle': 'DOS NOMBRES: «Ckl» → «Hinjkybesuk» · cuenta 849'}]
        _sa = filtrar_r2([_xa], _pa, {}, set(), set(), set(), set(), real_de=_rd2)
        ok([q['id'] for q in _sa[2][id(_xa)]] == ['ndc', 'apb', 'aph'],
           'R2 por persona: «¿Ckl es Hinjkybesuk?» también es «¿Ckl es BNA?», y la contesta la misma unión')
        _ro = {'aph': (OTRA, '')}
        _hh = [(7, {'Tipo': 'Alias posible', 'Detalle': 'DOS NOMBRES: «Ckl» → «Hinjkybesuk» · cuenta 849'})]
        _akn = {'no_confundir': [['Ckl', 'Hinjkybesuk', 'Dlx en ✅ Decidir: es otra persona']]}
        ok(filtrar_r2([_xa], _pa, _ro, set(), set(), *_lo_que_dlx_contesto(_pa, _ro, [], _rd2), real_de=_rd2)[0] == []
           and filtrar_r2([_xa], _pa[:2], {}, set(), set(), *_lo_que_dlx_contesto([], {}, _hh, _rd2),
                          real_de=_rd2)[0] == []
           and filtrar_r2([_xa], _pa[:2], {}, set(), {('ckl', 'hinjkybesuk')}, set(), set(), real_de=_rd2)[0] == []
           and _distintos_persona('Ckl', 'BNA', _akn, _rd2) and not _distintos_persona('Armando Faso', 'BNA', _akn, _rd2)
           and not any(x['alias'] == 'Ckl' for x in dos_nombres(
               _ins2, [], _ls2, _cp2, _jg2, _rd2, son_distintos=lambda a, b: _distintos_persona(a, b, _akn, _rd2),
               con_rol=_rol2, iso_de=_iso2)['unir']),
           'R2 por persona: un «Es otra persona» a «¿Ckl es Hinjkybesuk?» —sin aplicar, aplicado o como no_confundir— o '
           'esa unión deshecha frena Ckl → BNA')
        # (C) lo que `cierres_solos()` cierra gracias al alias de R2 va atado a esa unión
        _gd = _dos_datos
        try:
            globals()['_dos_datos'] = lambda: (lambda n: {'ckl': 'bna', 'hinjkybesuk': 'bna'}.get(
                norm(_sin_bandera(n)), norm(_sin_bandera(n))), {}, {}, {})
            _UNION_DE['ckl'] = {'alias': ['Ckl', 'BNA'], 'filas': [300]}
            _SOLAS[:] = []
            cierres_solos([_pa[2]], dry=True)
            ok([x['escribio'] for x in _SOLAS] == [{'alias': ['Ckl', 'BNA'], 'filas': [300]}],
               'lo que se cierra gracias al alias que R2 escribió lleva esa unión: «Deshacer» la reabre con ella')
        finally:
            globals()['_dos_datos'] = _gd
            _UNION_DE.clear()
            _SOLAS[:] = []
        # (D) Deshacer borra la fila que escribió la regla, y sólo si sigue diciendo eso
        _va = [['Ckl', 'BNA', ''], ['Otro', 'X', ''], ['Ckl', 'BNA', '']]
        ok(filas_aka_a_sacar([('Ckl', 'BNA', 3)], _va) == ([3], [])
           and filas_aka_a_sacar([('Ckl', 'BNA', 3)], _va[:2] + [['', '', '']])[0] == []
           and filas_aka_a_sacar([('Ckl', 'BNA', None)], _va)[0] == []
           and filas_aka_a_sacar([('Ckl', 'BNA', None)], _va[:2])[0] == [1],
           'Deshacer: la fila anotada, si sigue igual; al reintentar no borra otra; sin fila, sólo si está una vez')
        # (E) lo escrito afuera, anotado antes; lo que quedó a medias, se termina o se borra
        _dpp = 'COPA · FFA · 01/10 · cuartos · A 🆚 B'
        _SOLAS_D['d'] = {'solas': [
            {'id': 'pp1', 'pendiente': True, 'escribio': {}, 'r': YA_NO, 'rk': 'R1', 'porque': 'x', 'por': 'el ciclo'},
            {'id': 'pp2', 'pendiente': True, 'escribio': {'batalla': _dpp}, 'r': NO_SE_JUGO, 'rk': 'R4'},
            {'id': 'pp3', 'pendiente': True, 'escribio': {}, 'r': YA_NO, 'rk': 'R1'}], 'deshechas': []}
        _SOLAS[:] = []
        _rp = recuperar_pendientes([{'id': 'pp1', 'tipo': 'Evento dudoso', 'detalle': 'x', 'filas': [4]},
                                    {'id': 'pp2', 'tipo': 'Batalla sin ganador', 'detalle': _dpp, 'filas': [5]}], dry=True)
        ok(_rp == {'pp1'} and [x['p']['id'] for x in _SOLAS] == ['pp1'] and solas_web() == []
           and _escrito_existe({'escribio': {'alias': ['Ckl', 'BNA'], 'fila': 3}}, _va)
           and not _escrito_existe({'escribio': {'alias': ['Ckl', 'BNA'], 'fila': 2}}, _va),
           'lo pendiente: si lo escrito está y sigue abierta se vuelve a cerrar; si lo escrito no está, no; y no se '
           'muestra hasta confirmarse')
        retirar_pendientes({'pp1'}, dry=True)
        ok(not _SOLAS, 'y si la escritura falla, se retira')
        # (I) el campeón se suma a la decisión del evento como la busca el lector, y la nota se conserva
        _ev = {'COPA X · FFA · 22/09': {'paga': {'octavos': 625}, 'nota': 'Dlx: octavos a 625'},
               'COPA Y · FFA · *': {'final': {'lados': ['A', 'B'], 'ganador': 'A'}}}
        _c1 = {'ganador': 'ANA', 'ronda': 'final', 'batallas': [['ANA', 'BEA']], 'pasaron': []}
        ok(poner_campeon(_ev, 'Copa x · FFA · 22/09', _c1, 't', 'Dlx') == 'COPA X · FFA · 22/09'
           and _ev['COPA X · FFA · 22/09']['paga'] == {'octavos': 625}
           and _ev['COPA X · FFA · 22/09']['nota'].startswith('Dlx: octavos a 625 · Dlx en ✅ Decidir')
           and 'decision' not in _ev['COPA X · FFA · 22/09']
           and poner_campeon(_ev, 'COPA Y · FFA · 23/09', _c1, 't', 'Dlx') == 'COPA Y · FFA · 23/09'
           and _ev['COPA Y · FFA · 23/09']['final']['ganador'] == 'A' and 'campeon' not in _ev['COPA Y · FFA · *'],
           'el campeón se suma a la decisión del evento (otra grafía, sin perder paga ni la nota; una «*» no se toca)')
        poner_campeon(_ev, 'COPA X · FFA · 22/09', dict(_c1, ganador='BEA'), 't', 'Dlx')
        sacar_campeon(_ev, 'COPA X · FFA · 22/09', 't', 'Dlx')
        ok(_ev['COPA X · FFA · 22/09'].get('nota') == 'Dlx: octavos a 625' and 'campeon' not in _ev['COPA X · FFA · 22/09'],
           'elegir otro reemplaza el tramo del campeón; sacarlo deja la nota de antes')

        # ── 🔴 la cuarta revisión (14/10/2026) ───────────────────────────────────────────────────────────────────────
        # (1) lo que quedó a medias no pisa una respuesta de Dlx, ni pasa los frenos de R2 (por persona)
        _SOLAS_D['d'] = {'solas': [{'id': 'pq', 'pendiente': True, 'escribio': {}, 'r': YA_NO, 'rk': 'R1'}],
                         'deshechas': []}
        _SOLAS[:] = []
        ok(recuperar_pendientes([{'id': 'pq', 'tipo': 'Nombre desconocido', 'detalle': 'Ckl', 'filas': [4]}],
                                dry=True, respuestas={'pq': ('Es Hassan', '')}) == set() and not _SOLAS,
           'lo que quedó a medias no se cierra si Dlx ya contestó esa pregunta: su respuesta manda')
        _yc = {'id': 'pc', 'escribio': {'alias': ['Ckl', 'BNA'], 'filas': [3]}}
        _dn4, _dp4 = _lo_que_dlx_contesto([], {}, _hh, _rd2)
        ok(frena_pendiente(_yc, {}, _dn4, _dp4, set(), {}, _rd2)
           and frena_pendiente(_yc, {}, set(), set(), set(), _akn, _rd2)
           and frena_pendiente(_yc, {}, set(), set(), {frozenset(('ckl', 'bna'))}, {}, _rd2)
           and not frena_pendiente(_yc, {}, set(), set(), set(), {}, _rd2),
           'y con un alias, los frenos de R2 por persona: «Ckl no es Hinjkybesuk» (contestado o no_confundir) o la '
           'unión deshecha')
        # (2) sin las filas que escribió la regla, no se le atribuye nada
        ok(not _escrito_existe({'escribio': {'alias': ['Ckl', 'BNA']}}, _va)
           and _escrito_existe({'escribio': {'alias': ['Ckl', 'BNA'], 'filas': [1, 3]}}, _va)
           and filas_escritas({'fila': 7}) == [7] and filas_escritas({'filas': [1, 3]}) == [1, 3],
           'lo pendiente sin la fila del alias no se atribuye: se retira sin cerrar')
        # (3) Deshacer reabre también lo que `barrer()` cerró con «el ciclo»
        _hj3 = dict(_hj)
        _hj3[8] = {'Tipo': 'alta', 'Estado': 'Resuelto', 'Detalle': 'Seba = 1', 'Resuelto por': 'el ciclo'}
        ok(filas_a_reabrir([dict(_hay[0], filas=[5, 8])], _hj3) == ([5, 8], []),
           'Deshacer reabre también la fila que barrer() cerró («el ciclo»): no queda un nombre sin pregunta')
        # (4) el mismo par escrito dos veces: Deshacer saca las dos filas
        ok(filas_aka_a_sacar([('Ckl', 'BNA', 1), ('Ckl', 'BNA', 3)], _va) == ([1, 3], []),
           'el mismo par escrito dos veces en una corrida: Deshacer saca las dos filas de la regla')
    finally:
        _DATOS.clear()
        _DATOS.update(_guarda_d)
        _SOLAS_D.clear()
        _SOLAS_D.update(_guarda_s)
        _SOLAS[:] = []
    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


def main():
    if '--auto' in sys.argv:
        return _self_check()
    return correr(dry='--aplicar' not in sys.argv)


if __name__ == '__main__':
    sys.exit(main())
