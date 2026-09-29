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

NUEVO = 'Es alguien nuevo'
#: la batalla que no se peleó (un walkover sin nadie que pase, una anulada)
NO_SE_JUGO = 'No se jugó'
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
                if det not in q['variantes']:
                    q['variantes'].append(det)
                continue
            grupo_de[g] = k
        if k in por:
            por[k]['filas'].append(n)
            continue
        origen, match = f.get('Origen', '').strip(), f.get('Posible match', '').strip()
        link, match = _link_llave(origen, match)
        p = {'id': k, 'tipo': tipo, 'detalle': det, 'origen': origen,
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
    return idx


def _cuenta_de(p, eventos):
    """`([discord_id…], fuente)` de un «¿quién es X?»: primero la inscripción, después el apodo.

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
    # 🎙️ LA LLAMADA (Dlx, 29/09/2026, «1. A»): UNA sola persona que estaba en
    # la llamada de ese servidor mientras se jugaba esa llave, con EXACTAMENTE
    # ese nombre, y que ya está en la Lista. Va antes que el nombre suelto:
    # cuando «Sol» es de cinco cuentas, la que estaba ahí es la que jugó.
    # ⚠️ SÓLO ALIAS: si esa cuenta no está en la Lista, la llamada no da de
    # alta a nadie —sigue la regla de siempre, por el nombre—.
    if len(k) >= 3:
        _ev, exactos, _par = _de_la_llamada(p['detalle'], _num_evento(p), eventos)
        if len(exactos) == 1 and exactos[0][0] in _lista_por_id():
            return [exactos[0][0]], 'llamada'
    return sorted(_apodos().get(k) or set()) if len(k) >= 3 else [], 'Discord'


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


def _de_la_llamada(nombre, num, eventos=None):
    """`(evento, exactos, parecidos)`: quién estaba en la llamada de ese
    servidor mientras se jugaba esa llave, con ese nombre (`exactos`) o uno
    parecido. Cada uno es `(discord_id, {n, c, t})`. Sin foto, listas vacías.
    """
    ev = (eventos if eventos is not None else (_DATOS.get('eventos') or {})).get(str(num or ''))
    k = norm(_sin_bandera(nombre))
    if not ev or len(k) < 3:
        return ev, [], []
    import llaves_web as LW
    ms = LW._primero((_llaves_t1().get(str(num)) or {}).get('links'))
    if ms is not None:
        desde, hasta = ms - LLAMADA_H[0] * 3600000, ms + LLAMADA_H[1] * 3600000
    else:
        # sin el link de la llave, el día entero (hora del este)
        ms = LW.ms_de_fecha(ev[2])
        if ms is None:
            return ev, [], []
        desde, hasta = ms - 12 * 3600000, ms + 12 * 3600000
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
    persona que estaba en la llamada mientras se jugaba esa llave, si ya está
    en la Lista, es alias suyo aunque ese nombre sea de varias cuentas. Si no
    está en la Lista, la llamada no da de alta a nadie. Ver `_cuenta_de()`.

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
    for p in preguntas:
        if p['tipo'] != 'Nombre desconocido' or p['id'] in respuestas:
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
        # ⚠️ el podio con mención tampoco: lo escribió el organizador del evento
        if fuente not in ('inscripción', 'podio'):
            ev = eventos.get(_num_evento(p)) or ()
            if len(ev) < 2 or ev[1] not in donde:
                continue
        porque = {'inscripción': 'se anotó así en inscripciones',
                  'podio': 'el podio de la llave lo menciona',
                  'llamada': 'estaba en la llamada del evento con ese nombre'}.get(fuente, 'la misma cuenta de Discord')
        real = por_id.get(did)
        if real:
            if AK.son_distintos(det, real, akas):
                continue
            pares.append([_sin_bandera(det), real, ''.join(_BANDERA.findall(det))])
            hechas.append((p, 'alias de %s: %s' % (real, porque)))
        elif fuente == 'llamada':
            # la llamada sólo hace alias (ver `_cuenta_de()`): no da de alta
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
    if not (pares or nuevos):
        return set()
    print('\n   🔎 resueltos con Discord y las inscripciones: %d alias · %d nuevo(s) a la Lista'
          % (len(pares), len(nuevos)))
    for a, b, _f in pares:
        print('      alias: %s -> %s' % (a, b))
    for _p, n, cc, did, fu in nuevos:
        print('      nuevo: %s %s (Discord %s, por %s)' % (n, cc or '(sin bandera)', did, fu))
    if dry:
        return {p['id'] for p, _r in hechas} | {p['id'] for p, *_ in nuevos}
    import lista_raperos as LR
    entraron = LR.agregar_varios(
        [(n, cc, did, 'alta automática · %s · %s' % ({'inscripción': 'se anotó así en inscripciones',
                                                     'podio': 'el podio de la llave lo menciona'}
                                                    .get(fu, 'su nombre en Discord'), _ahora_et()))
         for _p, n, cc, did, fu in nuevos], aplicar=True) if nuevos else {}
    for p, n, cc, did, fu in nuevos:
        if did in entraron:
            hechas.append((p, 'nuevo: entró a la Lista con %s (%s)' % (
                {'inscripción': 'la cuenta con que se anotó', 'podio': 'la cuenta que menciona el podio'}
                .get(fu, 'su Discord'), did)))
    if pares:
        _agregar_akas(pares, [])
    if hechas:
        from escribir import _pedir
        _pedir('POST', '/values:batchUpdate', json={
            'valueInputOption': 'RAW',
            'data': [{'range': 'Pendientes!F%d:H%d' % (n, n),
                      'values': [['Resuelto', res, POR_DISCORD]]}
                     for p, res in hechas for n in p['filas']]})
    return {p['id'] for p, _r in hechas}


#: cómo se dice cada motivo del lector
_MOTIVO = {
    'no aparece nadie después': 'Ninguno aparece en la ronda siguiente, y la llave no marca quién pasó.',
    'última ronda y no dice campeón': 'Es la última ronda y la llave no dice quién salió campeón.',
}


def _pistas(p):
    """La columna «Pistas»: lo que ayuda a contestar."""
    t, out = p['tipo'], []
    if t == 'Nombre desconocido':
        sug = [x for x in _sugerencias(p['match'])]
        if sug:
            out.append('¿Será %s?' % ' o '.join(sug))
        out.append(_en_discord(p['detalle'])[0])
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
        if m:
            out += ['La que tiene: ' + _cuenta(m.group(1)), 'La otra: ' + _cuenta(m.group(2))]
        elif m2:
            out.append('Esa cuenta: ' + _cuenta(m2.group(1)))
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
    return [x.strip() for x in re.split(r',|;', match or '') if x.strip()][:3]


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
        return ('¿Quién es «%s»?%s' % (det, tambien),
                ', '.join(sug) if sug else '—',
                ['Es %s' % s for s in dc + ll + sug] + [NUEVO, TROLL])
    if t == 'alta':
        quien = _sin_decoracion(_reparar(det.split(' = ')[0].strip()))
        did = det.split(' = ')[-1].strip() if ' = ' in det else ''
        # ⚠️ «sv FFA» NO ES UNA SUGERENCIA: es dónde usó /card. Va dicho, y
        # la sugerencia pasa a ser lo que la palabra promete: nombres de la
        # Lista que se le parecen.
        sv = match[3:].strip() if match.startswith('sv ') else ''
        sug = _parecidos_padron(quien)
        return ('«%s» usó /card%s y no está en la Lista de Raperos. Si ya '
                'está con otro nombre, elegilo o escribilo: le pongo su '
                'Discord.%s' % (quien, ' en %s' % sv if sv and sv != '?' else '',
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
                + [NO_SE_JUGO, 'Dejar para después'])
    if t == 'Vidas cargado':
        ev = det.split(' · ')[0].strip()
        return ('«%s» es un 5 vidas que el ciclo cargó solo desde #veredictos: '
                'los puntos ya están en el ranking. ¿Está bien?' % ev,
                '—', ['Está bien así', 'No cuenta'])
    if t == 'Bracket incompleto':
        return ('Esta llave no dice quién ganó y lleva más de 12 h sin '
                'cambios, así que no sumó nada. ¿Cuenta?',
                '—', ['No cuenta', 'La completo en Discord'])
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
    # ⚠️ ANTES QUE EL ALIAS: «Ganó X» no es «es X»
    if p['tipo'] == 'Batalla sin ganador':
        if r == NO_SE_JUGO:
            return ('batalla', '')
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
    eventos = _decisiones().get('eventos') or {}
    d = eventos.get('%s · %s · %s' % (ev, sv, fecha))
    if d is None:
        k = norm(ev)
        for clave, v in eventos.items():
            partes = [x.strip() for x in clave.split(' · ')]
            if (len(partes) == 3 and k and norm(partes[0]) == k
                    and partes[1] == sv and partes[2] in (fecha, '*')):
                d = v
                break
    return (d or {}).get('decision')


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
    return out


#: las líneas que escribe `_pistas()`, de esta versión y de las anteriores
_PISTA_SISTEMA = re.compile(
    r'^(—|¿Será .*\?|Terminó .*\(.* pts\)|[^:]{1,40}: (le ganó a|perdió con) .*'
    r'|(La que tiene|La otra|Su cuenta|Esa cuenta): .*|[^:]{1,40}: .+ vs .+|En Discord .*'
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
    """Escribe los alias nuevos al final de la tabla de la hoja AKAs."""
    import requests
    from escribir import _pedir
    if not pares and not distintos:
        return
    v = _pedir('GET', '/values/%s' % requests.utils.quote('AKAs!A1:G800')
               ).get('values', [])
    datos = []
    if pares:
        ult = max([i for i, f in enumerate(v, 1) if f and str(f[0]).strip()]
                  or [1])
        datos.append({'range': 'AKAs!A%d:C%d' % (ult + 1, ult + len(pares)),
                      'values': pares})
    if distintos:
        ult = max([i for i, f in enumerate(v, 1)
                   if len(f) > 4 and str(f[4]).strip()] or [2])
        datos.append({'range': 'AKAs!E%d:G%d' % (ult + 1, ult + len(distintos)),
                      'values': distintos})
    _pedir('POST', '/values:batchUpdate',
           json={'valueInputOption': 'RAW', 'data': datos})


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
    batallas = {}
    trolls = []
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
        elif que == 'evento':
            eventos[p['detalle']] = dato
            # 🔴 UN 5 VIDAS YA ESTÁ EN EL RANKING: «no cuenta» lo saca
            # `procesar_entrada.sacar_descartados()` en la corrida siguiente
            cierres += [(n, ('no cuenta: sale del ranking en la corrida siguiente'
                             if p['tipo'] == 'Vidas cargado' and dato == 'no cuenta'
                             else 'evento: %s' % dato)) for n in p['filas']]
        elif que == 'troll':
            trolls.append(dato)
            cierres += [(n, 'troll: no cuenta') for n in p['filas']]
        elif que == 'batalla':
            batallas[p['detalle']] = dato
            cierres += [(n, ('ganó %s: entra en la corrida siguiente' % dato) if dato
                         else 'no se jugó: queda afuera') for n in p['filas']]
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
    aplicar.hubo = bool(cierres or pares or eventos or ids or trolls or batallas)
    # ⚠️ LAS NOTAS DE LO QUE SE CIERRA NO SE PIERDEN: van a
    # `datos/decisiones.json` con la pregunta, para quien tenga que actuar.
    cerradas = {n for n, _d in cierres}
    notas_cerradas = {p['id']: {'pregunta': p['detalle'], 'nota': _nota(p)}
                      for p in preguntas if _nota(p) and set(p['filas']) & cerradas}
    if dry:
        return estados

    if ids:
        errores = _poner_ids([(real, did) for real, did, _p in ids])
        for real, did, p in ids:
            if did in errores:
                estados[p['id']] = '⚠️ ' + errores[did]
            else:
                cierres += [(n, 'Discord %s puesto en %s' % (did, real))
                            for n in p['filas']]
    if pares:
        _agregar_akas(pares, [])
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


def correr(dry=True):
    abiertas, repetidas, hechas = _abiertas_de_pendientes()
    eventos = _eventos()
    preguntas = armar(abiertas, eventos)
    respuestas = _respuestas()
    print('\n══ ✅ DECIDIR ══\n')
    print('   %d pregunta(s) abierta(s) · %d fila(s) repetida(s) en '
          '`Pendientes`' % (len(preguntas), len(repetidas)))
    # 🔑 PRIMERO LO QUE SE CONTESTA SOLO CON DISCORD: ver `por_discord()`
    try:
        solas = por_discord(preguntas, respuestas, eventos, dry=dry)
    except Exception as e:                               # noqa: BLE001
        # ⚠️ NO FRENA ✅ DECIDIR: si falla, las preguntas quedan para Dlx
        print('   ⚠️ no pude resolver con Discord (%s)' % str(e)[:80])
        solas = set()
    preguntas = [p for p in preguntas if p['id'] not in solas]
    # ⚡ lo que se contestó para el evento entero, a cada nombre sin respuesta
    respuestas = repartir(preguntas, respuestas)
    estados = aplicar(preguntas, respuestas, repetidas, dry=dry)
    if solas and not dry:
        aplicar.hubo = True
    # lo que se acaba de cerrar ya no se pregunta. ⚠️ Y SI NO SE CERRÓ NADA
    # NO SE RELEE: dos lecturas menos en cada corrida, que es la mayoría.
    if not dry and getattr(aplicar, 'hubo', True):
        abiertas, repetidas, hechas = _abiertas_de_pendientes()
        preguntas = armar(abiertas, eventos)
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
    ok(jahno['opciones'] == ['Es Juano', NUEVO, TROLL], 'la sugerencia es una opción')
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
                   'padron': [{'raw': 'Jult', 'discord_id': '500'}]})
    _ku = {'tipo': 'Nombre desconocido', 'detalle': 'KULRW🇦🇷', 'match': '', 'variantes': ['KULRW🇦🇷'],
           'origen': 'evento #360', 'donde': ''}
    _so = dict(_ku, detalle='SOL🇵🇪', variantes=['SOL🇵🇪'])
    ok(_en_discord('KULRW🇦🇷') == ('En Discord es la cuenta de «Jult» en la Lista', ['Jult'])
       and _pregunta(_ku)[2][0] == 'Es Jult',
       'el apodo de Discord de alguien de la Lista: la pista lo dice y «Es Jult» va primero')
    ok(_en_discord('SOL🇵🇪')[0] == 'En Discord hay 2 cuentas con ese nombre, ninguna en la Lista'
       and _pregunta(_so)[2][0] == NUEVO and _en_discord('L🇨🇴') == ('', []),
       'dos cuentas sin Lista se dicen, y un nombre de una letra no busca nada')
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
               'quien no está en la Lista no entra por la llamada: sólo la pista')
        finally:
            _LLAVES_T1[:] = viejas
    finally:
        _DATOS.clear()
        _DATOS.update(antes)
    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


def main():
    if '--auto' in sys.argv:
        return _self_check()
    return correr(dry='--aplicar' not in sys.argv)


if __name__ == '__main__':
    sys.exit(main())
