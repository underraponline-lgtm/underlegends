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
COLS = ['#', 'Tipo', 'Qué hay que decidir', 'Dónde apareció', 'Sugerencia',
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
C_RESP, C_NOTA, C_ESTADO, C_ID = 5, 6, 7, 8
POR = 'Dlx (✅ Decidir)'
DECISIONES = os.path.join(BASE, 'datos', 'decisiones.json')

#: cómo se muestra cada tipo de `Pendientes`, y en qué orden. Primero lo que
#: mueve puntos de un evento entero; después los nombres; al final identidad.
GRUPO = {
    'Bracket incompleto': (0, '🏆 Evento'),
    'Evento dudoso': (0, '🏆 Evento'),
    'Llave sin resolver': (0, '🏆 Evento'),
    'Nombre desconocido': (1, '👤 Nombre'),
    'alta': (2, '🪪 Identidad'),
    'ambiguo': (2, '🪪 Identidad'),
    'conflicto': (2, '🪪 Identidad'),
    'Alias posible': (2, '🪪 Identidad'),
    'MW pendiente': (3, '🎯 MW'),
}

NUEVO = 'Es alguien nuevo'
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


# ── las preguntas ───────────────────────────────────────────────────────

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
        p = {'id': k, 'tipo': tipo, 'detalle': det, 'origen': origen,
             'match': match, 'filas': [n], 'variantes': [det],
             'grupo': GRUPO.get(tipo, (4, tipo)),
             'donde': _donde(origen, det, eventos)}
        por[k] = p
    for p in por.values():
        p['que'], p['sug'], p['opciones'] = _pregunta(p)
    return sorted(por.values(), key=lambda p: (p['grupo'][0], p['filas'][0]))


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
    del emoji leídos como GBK. Si deshacerlo da un texto válido, es eso.
    """
    t = str(s or '')
    if not re.search('[\u4e00-\u9fff]', t):
        return t
    try:
        return t.encode('gbk').decode('utf-8')
    except (UnicodeEncodeError, UnicodeDecodeError):
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
    m = re.search(r"AKA '(.+?)' \(fila \d+\) ya tiene ID (\d+), el log trae (\d+)", det)
    if m:
        return ('«%s» ya tiene una cuenta de Discord en la Lista, y el sync '
                'encontró OTRA cuenta con ese nombre. ¿Es la misma persona '
                'con dos cuentas, u otra persona?\nLa que tiene: '
                'https://discord.com/users/%s\nLa otra: '
                'https://discord.com/users/%s' % m.groups())
    m = re.search(r"ID (\d+) ya pertenece a fila \d+ \((.+?)\); no se asignó a '(.+?)'", det)
    if m:
        did, dueno, otro = m.groups()
        return ('La cuenta https://discord.com/users/%s es de «%s» en la '
                'Lista, y el sync la encontró también como «%s». ¿«%s» es %s?'
                % (did, dueno, otro, otro, _sin_bandera(dueno)))
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
    if t == 'Nombre desconocido':
        sug = _sugerencias(match)
        otras = [v for v in p.get('variantes', [det]) if v != det]
        tambien = (' (también escrito %s)' % ', '.join('«%s»' % v for v in otras)
                   if otras else '')
        return ('¿Quién es «%s»?%s No está en la Lista de Raperos. Si es '
                'alguien que ya está, escribí su nombre como figura ahí.'
                % (det, tambien),
                ', '.join(sug) if sug else '—',
                ['Es %s' % s for s in sug] + [NUEVO, TROLL])
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
        return (_conflicto_en_palabras(det), match or '—',
                ['Ya lo revisé', 'Dejar para después'])
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
CIERRAN = {'Ya lo revisé', 'Ya está resuelto', 'La completo en Discord',
           'Está bien así', 'La corrijo en Discord', 'Dejala así', 'Hecho'}
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
    if r in ('No cuenta', 'Sí cuenta'):
        if p['tipo'] in ('Bracket incompleto', 'Evento dudoso'):
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
    i_resp, i_id = col('✍️ RESPUESTA', 5), col('id', 7)
    i_est, i_sug = col('Estado', 6), col('Sugerencia', 4)
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
        _respuestas.sugerencias[k] = str(f[i_sug]).strip()
    return out


def _nota(p):
    """La nota de esa pregunta: la de 📝 NOTA, más lo que se haya escrito en
    «Sugerencia» encima de lo que puso el sistema."""
    nota = (getattr(_respuestas, 'notas', {}) or {}).get(p['id'], '')
    s_hoja = (getattr(_respuestas, 'sugerencias', {}) or {}).get(p['id'], '')
    # ⚠️ Lo que escribió el SISTEMA antes no es una nota: la sugerencia de
    # la corrida anterior era el «Posible match» crudo («sv FFA»).
    if s_hoja and s_hoja not in (p['sug'], (p.get('match') or '').strip()):
        extra = s_hoja[len(p['sug']):] if s_hoja.startswith(p['sug']) else s_hoja
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
            cierres += [(n, 'evento: %s' % dato) for n in p['filas']]
        elif que == 'troll':
            trolls.append(dato)
            cierres += [(n, 'troll: no cuenta') for n in p['filas']]
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
    aplicar.hubo = bool(cierres or pares or eventos or ids or trolls)
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
        ahora = datetime.datetime.now(datetime.timezone.utc).strftime(
            '%Y-%m-%d %H:%M UTC')
        for ev, dec in eventos.items():
            d.setdefault('eventos', {})[ev] = {'decision': dec, 'cuando': ahora,
                                               'por': POR}
        with io.open(DECISIONES, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(d, f, ensure_ascii=False, indent=1)
            f.write('\n')
    if notas_cerradas:
        d = _decisiones()
        ahora = datetime.datetime.now(datetime.timezone.utc).strftime(
            '%Y-%m-%d %H:%M UTC')
        for k, v in notas_cerradas.items():
            v['cuando'] = ahora
            d.setdefault('notas', {})[k] = v
            print('      📝 nota guardada: %s — %s' % (v['pregunta'], v['nota']))
        with io.open(DECISIONES, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(d, f, ensure_ascii=False, indent=1)
            f.write('\n')
    if trolls:
        d = _decisiones()
        ahora = datetime.datetime.now(datetime.timezone.utc).strftime(
            '%Y-%m-%d %H:%M UTC')
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


def pintar(preguntas, estados, respuestas, hechas, dry=True):
    """Rehace la hoja entera: título, cómo se usa, la tabla y lo último hecho."""
    import requests
    from escribir import _pedir
    cuenta = collections.Counter(p['grupo'][1] for p in preguntas)
    resumen = ' · '.join('%s %d' % (g, n) for g, n in sorted(
        cuenta.items(), key=lambda x: min(p['grupo'][0] for p in preguntas
                                          if p['grupo'][1] == x[0])))
    filas = [
        ['✅ DECIDIR — lo que el sistema no pudo resolver solo'] + [''] * 8,
        ['Elegí una respuesta en la columna ✍️ RESPUESTA (o escribí el nombre, '
         'si es alguien de la Lista de Raperos). El ciclo la aplica sola en '
         'menos de media hora y la pregunta sale de acá. Para aclarar algo, '
         'usá 📝 NOTA: se guarda. Lo demás lo rehace el ciclo.'] + [''] * 8,
        ['%d abierta(s)%s · actualizado %s'
         % (len(preguntas), (' — ' + resumen) if resumen else '',
            _hora_et())] + [''] * 8,
        [''] * 9,
        COLS,
    ]
    for i, p in enumerate(preguntas, 1):
        r = respuestas.get(p['id'])
        # la respuesta se conserva si la pregunta sigue abierta: si se
        # borrara, parecería aplicada
        filas.append([str(i), p['grupo'][1], p['que'], p['donde'], p['sug'],
                      r[0] if r else '', _nota(p), estados.get(p['id'], ''),
                      p['id']])
    if not preguntas:
        filas.append(['', '', '🎉 No hay nada para decidir.'] + [''] * 6)
    if hechas:
        filas += [[''] * 9, ['', '', '✔️ Lo último que se aplicó'] + [''] * 6]
        for n, d in hechas[-8:][::-1]:
            filas.append(['', GRUPO.get(d['Tipo'], (4, d['Tipo']))[1],
                          d['Detalle'], d['Origen'], '', d['Resolución'], '',
                          '✔️ aplicado', ''])
    if dry:
        print('   (simulacro) la hoja tendría %d fila(s): %d pregunta(s)'
              % (len(filas), len(preguntas)))
        return
    sid = _hoja_id(crear=True)
    _pedir('POST', '/values/%s:clear' % requests.utils.quote("'%s'!A1:I2000" % HOJA))
    _pedir('PUT', '/values/%s?valueInputOption=RAW'
           % requests.utils.quote("'%s'!A1" % HOJA), json={'values': filas})
    n_preg = len(preguntas)
    reqs = [
        # la tabla, limpia de lo que haya quedado de una corrida anterior
        {'setDataValidation': {'range': {'sheetId': sid, 'startRowIndex': FILA_CAB,
                                         'startColumnIndex': C_RESP, 'endColumnIndex': C_NOTA + 1}}},
        {'repeatCell': {'range': {'sheetId': sid, 'startRowIndex': 0,
                                  'endRowIndex': 2000},
                        'cell': {'userEnteredFormat': {}},
                        'fields': 'userEnteredFormat'}},
        {'updateSheetProperties': {'properties': {
            'sheetId': sid, 'gridProperties': {'frozenRowCount': FILA_CAB}},
            'fields': 'gridProperties.frozenRowCount'}},
        {'repeatCell': {'range': {'sheetId': sid, 'startRowIndex': 0,
                                  'endRowIndex': 1},
                        'cell': {'userEnteredFormat': {'textFormat': {
                            'bold': True, 'fontSize': 14}}},
                        'fields': 'userEnteredFormat.textFormat'}},
        {'repeatCell': {'range': {'sheetId': sid, 'startRowIndex': 1,
                                  'endRowIndex': 3},
                        'cell': {'userEnteredFormat': {'textFormat': {
                            'foregroundColor': {'red': .35, 'green': .35,
                                                'blue': .35}}}},
                        'fields': 'userEnteredFormat.textFormat'}},
        {'repeatCell': {'range': {'sheetId': sid, 'startRowIndex': FILA_CAB - 1,
                                  'endRowIndex': FILA_CAB},
                        'cell': {'userEnteredFormat': {
                            'textFormat': {'bold': True},
                            'backgroundColor': {'red': .9, 'green': .93,
                                                'blue': .98}}},
                        'fields': 'userEnteredFormat(textFormat,backgroundColor)'}},
        {'repeatCell': {'range': {'sheetId': sid, 'startRowIndex': FILA_CAB,
                                  'endRowIndex': FILA_CAB + n_preg + 20,
                                  'startColumnIndex': 2, 'endColumnIndex': 8},
                        'cell': {'userEnteredFormat': {'wrapStrategy': 'WRAP',
                                                       'verticalAlignment': 'TOP'}},
                        'fields': 'userEnteredFormat(wrapStrategy,verticalAlignment)'}},
        # las dos columnas para escribir, que se vea que son para escribir
        {'repeatCell': {'range': {'sheetId': sid, 'startRowIndex': FILA_CAB,
                                  'endRowIndex': FILA_CAB + n_preg,
                                  'startColumnIndex': C_RESP, 'endColumnIndex': C_NOTA + 1},
                        'cell': {'userEnteredFormat': {
                            'backgroundColor': {'red': 1, 'green': .97,
                                                'blue': .82}}},
                        'fields': 'userEnteredFormat.backgroundColor'}},
    ]
    for i, ancho in enumerate((36, 100, 430, 260, 150, 230, 230, 230, 60)):
        reqs.append({'updateDimensionProperties': {
            'range': {'sheetId': sid, 'dimension': 'COLUMNS',
                      'startIndex': i, 'endIndex': i + 1},
            'properties': {'pixelSize': ancho, 'hiddenByUser': i == C_ID},
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
        'unprotectedRanges': [{'sheetId': sid, 'startRowIndex': FILA_CAB,
                               'endRowIndex': FILA_CAB + max(n_preg, 1),
                               'startColumnIndex': C_RESP,
                               'endColumnIndex': C_NOTA + 1}]}}})
    for i, p in enumerate(preguntas):
        reqs.append({'setDataValidation': {
            'range': {'sheetId': sid, 'startRowIndex': FILA_CAB + i,
                      'endRowIndex': FILA_CAB + i + 1,
                      'startColumnIndex': C_RESP, 'endColumnIndex': C_RESP + 1},
            # ⚠️ NO ESTRICTA: «Es X» con un X que no está en la lista se
            # escribe a mano, y una validación estricta lo rechazaría.
            'rule': {'condition': {'type': 'ONE_OF_LIST', 'values': [
                {'userEnteredValue': o} for o in p['opciones']]},
                'strict': False, 'showCustomUi': True}}})
    _pedir('POST', ':batchUpdate', json={'requests': reqs})
    print('   ✅ `%s`: %d pregunta(s)' % (HOJA, len(preguntas)))


def correr(dry=True):
    abiertas, repetidas, hechas = _abiertas_de_pendientes()
    eventos = _eventos()
    preguntas = armar(abiertas, eventos)
    respuestas = _respuestas()
    print('\n══ ✅ DECIDIR ══\n')
    print('   %d pregunta(s) abierta(s) · %d fila(s) repetida(s) en '
          '`Pendientes`' % (len(preguntas), len(repetidas)))
    estados = aplicar(preguntas, respuestas, repetidas, dry=dry)
    # lo que se acaba de cerrar ya no se pregunta. ⚠️ Y SI NO SE CERRÓ NADA
    # NO SE RELEE: dos lecturas menos en cada corrida, que es la mayoría.
    if not dry and getattr(aplicar, 'hubo', True):
        abiertas, repetidas, hechas = _abiertas_de_pendientes()
        preguntas = armar(abiertas, eventos)
    pintar(preguntas, estados, respuestas, hechas, dry=dry)
    return 0


def _self_check():
    print('\n  decidir.py — self-check\n')
    mal = 0

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
    ok(_sin_decoracion('👤 | DRAKO MC') == 'DRAKO MC', 'sin el «👤 |» de DRA')
    c = _conflicto_en_palabras("AKA 'Shadow' (fila 237) ya tiene ID 146, el log trae 821")
    ok('discord.com/users/146' in c and 'discord.com/users/821' in c,
       'el conflicto del sync, en palabras y con los dos perfiles')
    _respuestas.notas, _respuestas.sugerencias = {}, {mau['id']: '— son la misma'}
    mau['sug'] = '—'
    ok(_nota(mau) == 'son la misma', 'lo escrito en «Sugerencia» se rescata como nota')
    _respuestas.sugerencias = {mau['id']: 'sv FFA'}
    mau['match'] = 'sv FFA'
    ok(_nota(mau) == '', 'y lo que puso el sistema antes, no')
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
    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


def main():
    if '--auto' in sys.argv:
        return _self_check()
    return correr(dry='--aplicar' not in sys.argv)


if __name__ == '__main__':
    sys.exit(main())
