# -*- coding: utf-8 -*-
"""🎁 LAS MINIATURAS DE LOS LINKS CORTOS: `og/crew/<slug>.jpg`, `og/ref/<slug>.jpg` y `og/perfil/<slug>.jpg` en R2, 1200 × 630.

🖼️ Y DESDE EL 17/11/2026 LA DEL LINK DE CADA PERFIL (la tanda 2 del remake de Tu cuenta; Dlx, de la vista previa: «debería
ser prebuilded»): su fondo de «Tu perfil» (Tus fondos), su carta y su nombre, para los de la tabla con carta. Son muchas:
se arman hasta `MAX_PERFIL` por corrida, primero las que nunca se armaron, y las demás en la siguiente.

🎬 Y DESDE EL 18/11/2026 LAS TIPO CINE (Dlx, de las maquetas: «en general me gusta más eso de estilo cine» y «Yes, move
them»): una por página del menú (`og/pag/<pagina>.jpg`), servidor (`og/sv/`), país (`og/pais/`), llave del lobby
(`og/llave/`) y liga (`og/liga/`). Los textos los arma `_cine()` acá y viajan en la ruta; los fondos los hornea
herramientas/fondos_og.py. Se arman hasta `MAX_CINE` por corrida, primero las páginas. Mientras una no está, el Worker da
la de antes (`hayOg()`). Los perfiles NO: su cartel lleva el fondo que cada uno eligió en Tus fondos.

    python bot/og_links.py --subir     arma las que cambiaron y las sube (el ciclo, al final de dibujar)
    python bot/og_links.py --seco      dice cuáles armaría, sin abrir el navegador ni subir
    python bot/og_links.py --ver X     arma sólo la crew o el link X en salida_og/, sin subir (para mirarla)
    python bot/og_links.py --auto      self-check

Dlx, 17/11/2026: *«que el link de invitación de la crew sea más corto para no asustar y que tenga un thumbnail
personalizable, o sea de la crew en este caso, y en este caso el referral también»*, y a la pregunta de dónde sale la
imagen: *«armada sola»*. Nadie sube nada: la de una crew lleva su logo, su nombre, su sigla y cuántos son; la de un link de
referido, «X te invita» con su tarjeta.

La DIBUJA LA PÁGINA (`#/og/<tipo>/<id>`, web/src/og_link.jsx) y acá se le saca la foto, como `bot/con_marco.py`: el
escudo armado de una crew existe sólo ahí (escudo.jsx), y dibujarlo de nuevo en Python serían dos dibujos de lo mismo.

La vista previa la da `bot/paginas/_worker.js` (`vistaCrew()`, `vistaRef()`) a los bots de Discord, WhatsApp y demás,
preguntando si la imagen ya está (HEAD). Si todavía no está, usa el logo o la tarjeta: nada se rompe por esperar.

⚠️ EL SLUG ES EL MISMO EN LOS DOS LADOS: `slug_og()` acá y `slugOg()` en _worker.js. El self-check los compara con los
mismos casos.

⚠️ SE ARMA SÓLO LO QUE CAMBIÓ: la huella de lo que se dibuja (nombre, sigla, logo, cuántos; nombre y tarjeta) queda en
`datos/og_links.json`, que va en `ARCHIVOS` de `bot/ci/guardar.sh`. Sin eso cada corrida volvería a subir todas.
"""
import hashlib
import io
import json
import os
import re
import sys
import unicodedata

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE):
    if _p not in sys.path:
        sys.path.insert(0, _p)

ESTADO = os.path.join(BASE, 'datos', 'og_links.json')
#: la página publicada; `LG_WEB` la cambia para probar contra la copia local (como bot/con_marco.py)
WEB = os.environ.get('LG_WEB') or 'https://underlegends.pages.dev/freestyle-rap'
SALIDA = os.path.join(BASE, 'salida_og')
PUBLICA = 'https://pub-70d5821d06a8432c9cffd0c102195000.r2.dev'
ORDEN_CARTA = ('temporada', 'servidor', 'competitivo', 'pais')
#: cambia esto y se rearman todas (el diseño entra en la huella)
DISENO = 'v2'
#: cuántos carteles de perfil por corrida: la primera vez son unos 200 y cada uno es una foto de Chromium (~1 s)
MAX_PERFIL = 40
#: 🎬 las de cine de las páginas, los servidores, los países, las llaves y las ligas (18/11/2026): el mismo `DISENO_CINE` de
#: web/src/og_link.jsx. La primera vez son unas 85; después, sólo las que cambiaron
DISENO_CINE = 'cine-1'
TIPOS_CINE = ('pag', 'sv', 'pais', 'llave', 'liga')
MAX_CINE = 45


def slug_og(x):
    """El mismo de `slugOg()` en bot/paginas/_worker.js: sin tildes, minúsculas, todo lo que no es letra o número a «-»."""
    s = unicodedata.normalize('NFD', str(x or ''))
    s = ''.join(c for c in s if not unicodedata.category(c).startswith('M')).lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')[:60]


def _huella(d):
    return hashlib.sha1(json.dumps([DISENO, d], ensure_ascii=False, sort_keys=True).encode('utf-8')).hexdigest()[:16]


def _get(url, ciclo=False, timeout=25):
    import requests
    h = {'accept': 'application/json'}
    if ciclo:
        import avisar
        import clave_ciclo as CC
        t = avisar._token()
        if not t:
            return None
        h['x-lg-ciclo'] = CC.clave(t)
    try:
        r = requests.get(url, headers=h, timeout=timeout)
        return r.json() if r.ok else None
    except Exception:                                    # noqa: BLE001
        return None


#: el diseño de la miniatura del link de invitación: el mismo `DISENO_REF` de web/src/og_link.jsx (`data-d`). Cambiarlo rearma
#: sólo ésas, no las crews ni los perfiles; y si la página publicada todavía dice otro, la foto se saltea
DISENO_REF = 'ref-cine-1'


def _mas_de(n, paso):
    """El número de «más de N» que es VERDAD: el múltiplo de `paso` que queda por debajo. 42 → 40, pero 40 justos → 30
    («más de 40» con 40 sería mentira). Redondeado, además, para que la miniatura no se rearme por una unidad."""
    return max(0, (int(n) - 1) // paso * paso) if n else 0


def _vitrina(L, ahora=None):
    """Los números de la miniatura del link de invitación, la de cine (18/11/2026, Dlx: «que aparezca que hay más de 40
    eventos por semana» y «14 servidores se vuelven 14 socios»): los eventos de los últimos 7 días del calendario (`t`, a
    la decena), las personas de los servidores (`m`, `comunidad.personas`, al millar) y los socios (`s`,
    `comunidad.servidores`). La misma regla que `vitrinaRef()` de web/src/og_link.jsx."""
    import datetime
    ahora = ahora or datetime.datetime.now(datetime.timezone.utc)
    desde = ahora - datetime.timedelta(days=7)
    t = 0
    for c in (L or {}).get('calendario') or []:
        try:
            x = datetime.datetime.fromisoformat(str((c or {}).get('t') or (c or {}).get('cuando') or '').replace('Z', '+00:00'))
        except ValueError:
            continue
        if x.tzinfo and desde <= x <= ahora:
            t += 1
    com = (L or {}).get('comunidad') or {}
    try:
        m = int(com.get('personas') or 0)
    except (TypeError, ValueError):
        m = 0
    try:
        s = int(com.get('servidores') or 0)
    except (TypeError, ValueError):
        s = 0
    return {'t': _mas_de(t, 10), 'm': _mas_de(m, 1000), 's': s}


def _carta(k, f, cartas):
    """La URL de la primera carta que tiene (`ORDEN_CARTA`), con su versión, o ''."""
    vs = f.get('cv').split('.') if isinstance(f.get('cv'), str) else []
    for c in ORDEN_CARTA:
        if c in (f.get('c') or []):
            i = cartas.index(c) if c in cartas else -1
            v = vs[i] if 0 <= i < len(vs) else ''
            return '%s/%s/%s.webp%s' % (PUBLICA, k, c, ('?v=' + v) if v else '')
    return ''


def _carta_de(k, f, cartas, carta):
    """La URL de una carta en particular de alguien, con su versión, o '' si no la tiene"""
    if not k or carta not in (f.get('c') or []):
        return ''
    vs = f.get('cv').split('.') if isinstance(f.get('cv'), str) else []
    i = cartas.index(carta) if carta in cartas else -1
    v = vs[i] if 0 <= i < len(vs) else ''
    return '%s/%s/%s.webp%s' % (PUBLICA, k, carta, ('?v=' + v) if v else '')


def _miles(n):
    return '{:,}'.format(int(n)).replace(',', '.')


def _corto(n):
    """837.478 → «837K», 6.693.149 → «6,7M» (como la carta)"""
    n = int(n or 0)
    if n >= 1000000:
        return ('%.1fM' % (n / 1e6)).replace('.', ',').replace(',0M', 'M')
    return '%dK' % round(n / 1000) if n >= 1000 else str(n)


def _cine(L, LG=None, nombres=None, ahora=None):
    """🎬 `[(tipo, slug, datos)]` de las miniaturas tipo cine: las páginas del menú, los servidores, los países, las llaves
    del lobby y las ligas. `datos` es TODO lo que la página dibuja (`Cine` en web/src/og_link.jsx no decide ningún texto):
    el fondo `f` (herramientas/fondos_og.py), el armado `l`, el sello `s`, el título `a` y `b`, las líneas `d` (`*x*` en
    magenta), lo de la derecha `v`, las cartas `c` y los códigos `e`. Los números dicen «más de» cuando cambian seguido
    (`_mas_de()`), para no rearmar por una unidad, y lo que se afirma se comprueba («hay torneo todos los días» sólo si los
    siete días tuvieron uno). Lo copiado de las maquetas que Dlx aprobó: https://claude.ai/artifact/AB6H3Gn4nU7GK8iy12wwPL"""
    import datetime
    if os.path.join(BASE, 'herramientas') not in sys.path:
        sys.path.insert(0, os.path.join(BASE, 'herramientas'))
    import fondos_og as FO
    L = L or {}
    cartas = L.get('cartas') or []
    tabla = [f for f in L.get('tabla') or [] if isinstance(f, dict) and f.get('k')]
    tabla.sort(key=lambda f: f.get('pos') or 10 ** 6)
    com = L.get('comunidad') or {}
    socios = int(com.get('servidores') or 0)
    temp = str(L.get('temporada') or 'T1').upper()
    out = []

    def pag(slug, f, l, s, a, b, d, v='', c=(), e=(), o=False):
        out.append(('pag', slug, {'f': f, 'l': l, 's': s, 'a': a, 'b': b, 'd': list(d), 'v': v, 'c': list(c), 'e': list(e), 'o': o}))
    ahora = ahora or datetime.datetime.now(datetime.timezone.utc)
    desde = ahora - datetime.timedelta(days=7)
    sem, dias, svs_sem = 0, set(), set()
    for c in L.get('calendario') or []:
        try:
            x = datetime.datetime.fromisoformat(str((c or {}).get('t') or '').replace('Z', '+00:00'))
        except ValueError:
            continue
        if x.tzinfo and desde <= x <= ahora:
            sem += 1
            dias.add((x - datetime.timedelta(hours=5)).date())        # el día en hora del este
            if c.get('sv'):
                svs_sem.add(c['sv'])
    m = _mas_de(com.get('personas') or 0, 1000)
    if m:
        pag('inicio', 'inicio', 'a', '%s · en juego' % temp, 'Liga Global', 'de freestyle',
            ['Más de %s miembros' % _miles(m) + (' · *%d* socios' % socios if socios else '')], o=True)
    top = [f for f in tabla if 'temporada' in (f.get('c') or [])][:3]
    if len(top) == 3:
        pag('ranking', 'ranking', 'c', '%s raperos' % _miles(L.get('gente') or len(tabla)), 'Ranking', 'de la %s' % temp,
            ['#1 %s · *%s*' % (top[0].get('n'), _corto(top[0].get('pts')))], v='podio', c=[_carta_de(f['k'], f, cartas, 'temporada') for f in top])
    todos_dias = len(dias) >= 7
    pag('eventos', 'eventos', 'a', 'Eventos', 'Hay torneo' if todos_dias else 'Torneos', 'todos los días' if todos_dias else 'cada semana',
        ['%d torneos en 7 días · *%d* servidores' % (sem, len(svs_sem))] if sem else ['El calendario de todos los servidores'])
    n_ligas = len(((LG or {}).get('lobby') or {}).get('ligas') or [])
    pag('ligas', 'ligas', 'a', '%d ligas' % n_ligas if n_ligas else 'Ligas', 'Ligas', 'de los servidores', ['Fechas, tablas y campeones'])
    cuatro = next((f for f in tabla if all(c in (f.get('c') or []) for c in ('pais', 'servidor', 'competitivo', 'temporada'))), None)
    if cuatro:
        pag('tarjetas', 'tarjetas', 'c', 'Tus números', 'Tarjetas', '4 cartas', ['Tu OVR, tu rango y tu país'], v='abanico',
            c=[_carta_de(cuatro['k'], cuatro, cartas, x) for x in ('pais', 'servidor', 'competitivo', 'temporada')])
    pag('pase', 'pase', 'a', 'Pase rapero', 'Sube', 'de nivel', ['Tareas diarias y semanales · *XP*'])
    ini = int(((L.get('tienda') or {}).get('inicial')) or 0)
    pag('tienda', 'tienda', 'a', 'Tienda', 'Caza cabezas', 'y apuesta en vivo',
        ['*%s* Puntos de Tienda para empezar' % _miles(ini)] if ini else ['Tus Puntos de Tienda'])
    pag('publicaciones', 'publicaciones', 'a', 'Publicaciones', 'El muro', 'de todos los servidores', ['Campeones, rachas y crews que suben'])
    con_logo = [s['sv'].lower() for s in L.get('svs') or [] if isinstance(s, dict) and s.get('logo') and re.match(r'^[A-Z]{2,5}$', str(s.get('sv') or ''))]
    if socios and con_logo:
        pag('socios', 'socios', 'c', 'Servidores aliados', '%d socios' % socios, 'una sola liga', ['El ranking de todos, sumado'], v='escudos', e=con_logo[:16])
    pag('guia', 'guia', 'c', 'En una página', 'Guía', 'cómo se juega', ['Puntos, rangos y TAGs'], v='rangos')
    rec = next((r for r in L.get('records') or [] if isinstance(r, dict) and r.get('id') == 'oro' and r.get('n')), None)
    pag('salon', 'salon', 'a', 'Salón de la fama', 'Los que', 'hicieron historia',
        ['%s · *%s* títulos, el récord' % (rec['n'], rec['v'])] if rec else ['Los MES AWARDS y los récords'])
    cw = sorted([c for c in L.get('crews') or [] if isinstance(c, dict) and c.get('crew')], key=lambda c: -(c.get('pts') or 0))
    pag('crews', 'crews', 'a', 'Sube de tier', 'Crews', 'arma la tuya',
        ['%s · *%d* raperos, la #1' % (cw[0]['crew'], cw[0].get('n') or 0)] if cw else ['Invita a tu gente'])
    pag('cuenta', 'cuenta', 'a', 'Tu cuenta', 'Entra', 'con Discord', ['Tus cartas, tu Pase y tus Puntos'])
    pag('cambios', 'cambios', 'a', 'Cambios', 'Lo nuevo', 'cada cambio, con su hora', ['La página y el bot, al día'])
    pag('socio', 'socio', 'a', 'Para dueños', 'Tu servidor', 'en números', ['Puntaje, actividad y el bot'])

    # 🏟️ cada servidor que tiene gente: su escudo y la carta de Servidor del mejor de ahí
    for i, s in enumerate(s for s in L.get('svs') or [] if isinstance(s, dict) and s.get('n') and s.get('logo')):
        sv = str(s.get('sv') or '')
        if not re.match(r'^[A-Z]{2,5}$', sv):
            continue
        mejor = next((f for f in tabla if f.get('sv') == sv and 'servidor' in (f.get('c') or [])), None)
        out.append(('sv', slug_og(sv), {'f': FO.fondo_de('sv', i), 'l': 'c', 's': 'Servidor', 'a': str(s.get('sigla') or sv),
                                         'b': str(s.get('nombre') or sv), 'd': ['*%s* raperos · %s eventos' % (_miles(s['n']), _miles(s.get('ev') or 0))],
                                         'v': 'escudo', 'c': [_carta_de(mejor['k'], mejor, cartas, 'servidor')] if mejor else [], 'e': [sv.lower()], 'o': False}))
    # 🌎 cada país (sin Emiratos ni Brasil): su bandera, su puesto en el mundo y la carta de País del mejor de ahí
    nombres = nombres or {}
    ps = [p for p in L.get('paises') or [] if isinstance(p, dict) and p.get('cc') and p['cc'] not in ('ae', 'br', 'no')]
    ps.sort(key=lambda p: -(p.get('pts') or 0))
    for i, p in enumerate(ps):
        cc = str(p['cc']).lower()
        if not re.match(r'^[a-z]{2}$', cc) or not nombres.get(cc):
            continue
        mejor = next((f for f in tabla if f.get('cc') == cc and 'pais' in (f.get('c') or [])), None)
        out.append(('pais', cc, {'f': FO.fondo_de('pais', i), 'l': 'c', 's': 'País', 'a': nombres[cc], 'b': '#%d del mundo' % (i + 1),
                                 'd': ['*%s* %s · %s puntos' % (_miles(p.get('n') or 0), 'rapero' if p.get('n') == 1 else 'raperos', _corto(p.get('pts')))],
                                 'v': 'bandera', 'c': [_carta_de(mejor['k'], mejor, cartas, 'pais')] if mejor else [], 'e': [cc], 'o': False}))
    # 🏆 las llaves del lobby (las más nuevas): el evento, el campeón y la final. Las en vivo no: cambian
    for n, x in (L.get('llaves') or {}).items():
        if not re.match(r'^\d{1,6}$', str(n)) or not isinstance(x, dict) or not x.get('nombre'):
            continue
        tb = [r for r in x.get('tabla') or [] if isinstance(r, list) and len(r) > 1]
        camp = [str(r[0]).strip() for r in tb if r[1] == 'Campeón'][:2]
        sub = [str(r[0]).strip() for r in tb if r[1] == 'Subcampeón'][:1]
        part = x.get('participantes') or len(tb)
        # «(sin titulo)» es como el lector guarda la llave sin nombre (ver `_titulo()` de bot/aviso_ganadores.py): el título
        # pasa a ser su número, y el servidor y la fecha van al sello
        nom = str(x['nombre']).strip()
        sin = bool(re.match(r'^\(?\s*sin\s+t[ií]tulo\s*\)?$', nom, re.I))
        sello = ' · '.join(y for y in (str(x.get('sv') or ''), str(x.get('fecha') or '')) if y) if sin else 'Llave #%s · %s' % (n, x.get('sv') or '')
        out.append(('llave', str(n), {'f': FO.fondo_de('llave', int(n)), 'l': 'a', 's': sello or 'Llave',
                                      'a': 'Llave #%s' % n if sin else nom, 'b': 'campeón: ' + ' y '.join(camp) if camp else 'el %s' % (x.get('fecha') or ''),
                                      'd': ['*%s* raperos' % part + (' · final con ' + sub[0] if sub else '')] if part else ['La llave completa'],
                                      'v': '', 'c': [], 'e': [], 'o': False}))
    # 🏟️ las ligas: su servidor, su jornada (o cuántas batallas lleva)
    for i, lg in enumerate(((LG or {}).get('lobby') or {}).get('ligas') or []):
        if not isinstance(lg, dict) or not lg.get('id') or not lg.get('n') or not slug_og(lg['id']):
            continue
        out.append(('liga', slug_og(lg['id']), {'f': FO.fondo_de('liga', i), 'l': 'a', 's': 'Liga · %s' % (lg.get('sv') or ''),
                                                'a': str(lg['n']).strip(), 'b': 'jornada %s' % lg['j'] if lg.get('j') else '%s batallas' % (lg.get('bat') or 0),
                                                'd': ['Tabla, batallas y campeones'], 'v': '', 'c': [], 'e': [], 'o': False}))
    return out


def _ruta_cine(tipo, slug, d):
    from urllib.parse import urlencode
    q = [('f', d['f']), ('l', d['l']), ('s', d['s']), ('a', d['a']), ('b', d['b'])] + [('d', x) for x in d['d']]
    if d.get('v'):
        q.append(('v', d['v']))
    if d.get('c'):
        q.append(('c', ','.join(x for x in d['c'] if x)))
    if d.get('e'):
        q.append(('e', ','.join(d['e'])))
    if d.get('o'):
        q.append(('o', '1'))
    return '%s/%s?%s' % (tipo, slug, urlencode(q))


def trabajos():
    """`[(tipo, slug, huella, ruta)]` de todo lo que hay hoy: las crews y los links abiertos esta temporada. `ruta` es lo
    que va después de `#/og/` (ver `dibujar()`). La huella es de lo que la miniatura muestra: si no cambió, no se saca.

    ⚠️ A QUIEN INVITA SE LO BUSCA TAMBIÉN EN LOS PERFILES: el lobby trae sólo la tabla de los 200 primeros, y la primera
    miniatura salió sin la tarjeta de Dlx (#228). El nombre y la carta viajan en la ruta (`?n=`, `?c=`): la página
    tampoco lo tiene en su tabla."""
    from urllib.parse import quote
    import avisar
    out = []
    cw = _get(avisar.WORKER + '/avisos/crews') or {}
    for c in cw.get('crews') or []:
        s = slug_og(c.get('id'))
        if not s:
            continue
        datos = {'n': c.get('nombre'), 's': c.get('sigla'), 'l': c.get('logo'), 'g': len(c.get('gente') or []), 'd': c.get('desc')}
        out.append(('crew', s, _huella(datos), 'crew/' + quote(str(c.get('id')), safe='')))
    ks = (_get(avisar.WORKER + '/avisos/ref-links', ciclo=True) or {}).get('ks') or []
    L = _get(avisar.WORKER + '/lobby?json=1', timeout=40) or {}
    cartas = L.get('cartas') or []
    if ks:
        filas = {f.get('k'): f for f in (L.get('tabla') or []) if isinstance(f, dict)}
        if any(k not in filas for k in ks):
            P = (_get(avisar.WORKER + '/perfiles', timeout=60) or {}).get('p') or {}
            for k in ks:
                if k not in filas and isinstance((P.get(k) or {}).get('f'), dict):
                    filas[k] = P[k]['f']
        V = _vitrina(L)
        for k in ks:
            f = filas.get(k) or {}
            # la de cine (18/11/2026): los números entran en la huella, ya redondeados, y la carta decide el armado (con
            # carta, la A; sin carta, la B); `d` es el diseño de ésta sola, así cambiarlo no rearma las crews ni los perfiles
            r = {'k': k, 'n': f.get('n') or k, 'carta': _carta(k, f, cartas), 'd': DISENO_REF, **V}
            ruta = 'ref/%s?n=%s&c=%s&t=%d&m=%d&s=%d' % (quote(k, safe=''), quote(str(r['n']), safe=''), quote(r['carta'], safe=''),
                                                     V['t'], V['m'], V['s'])
            out.append(('ref', slug_og(k), _huella(r), ruta))
    # 🖼️ el cartel del link de cada perfil: los de la tabla con carta. La huella es todo lo que el cartel muestra
    fondos = (_get(avisar.WORKER + '/avisos/fondos') or {}).get('f') or {}
    for f in L.get('tabla') or []:
        k = (f or {}).get('k')
        carta = _carta(k, f or {}, cartas)
        if not k or not carta or not slug_og(k):
            continue
        r = {'k': k, 'n': f.get('n'), 'carta': carta, 'pos': f.get('pos'), 'ovr': f.get('ovr'), 'rg': f.get('rg'), 'cc': f.get('cc'),
             'sv': f.get('sv'), 'fondo': fondos.get(k)}
        out.append(('perfil', slug_og(k), _huella(r), 'perfil/' + quote(k, safe='')))
    # 🎬 y las de cine (18/11/2026): las páginas, los servidores, los países, las llaves y las ligas. Todo lo que se dibuja va
    # en la ruta y en la huella; el diseño también, así cambiarlo rearma sólo éstas
    try:
        with io.open(os.path.join(BASE, 'bot', 'paginas', 'og', 'pais', 'nombres.json'), encoding='utf-8') as fh:
            nombres = json.load(fh)
    except (OSError, ValueError):
        nombres = {}
    LG = _get(avisar.WORKER + '/ligas', timeout=40) or {}
    for tipo, slug, d in _cine(L, LG, nombres):
        out.append((tipo, slug, _huella(dict(d, dis=DISENO_CINE)), _ruta_cine(tipo, slug, d)))
    return out


def _leer_estado():
    try:
        with io.open(ESTADO, encoding='utf-8') as f:
            d = json.load(f)
        return d if isinstance(d, dict) else {}
    except (OSError, ValueError):
        return {}


def dibujar(lista):
    """`{(tipo, slug): ruta del JPG}` de las que salieron: la foto de `#/og/<tipo>/<id>` (web/src/og_link.jsx), con un
    navegador para todas. Una que la página no sabe dibujar (la ruta todavía no está publicada) no sale y se reintenta."""
    import navegador
    navegador.hace_falta()                               # Chromium, sólo si hay algo que sacar (bot/navegador.py)
    from playwright.sync_api import sync_playwright
    from PIL import Image
    os.makedirs(SALIDA, exist_ok=True)
    out = {}
    with sync_playwright() as pw:
        nav = pw.chromium.launch()
        pag = nav.new_page(viewport={'width': 1200, 'height': 630}, device_scale_factor=1)
        for tipo, slug, _h, ruta in lista:
            try:
                pag.goto('%s/og/%s' % (WEB, ruta), wait_until='domcontentloaded', timeout=45000)
                pag.wait_for_function("""() => { const h = document.querySelector('#inicio-nuevo');
                    const o = h && h.shadowRoot && h.shadowRoot.querySelector('.og');
                    return o && o.dataset.listo === '1'; }""", timeout=45000)
                falta = pag.evaluate("""() => {
                    const st = document.createElement('style');
                    st.textContent = 'body *{visibility:hidden!important} #inicio-nuevo{visibility:visible!important}';
                    document.head.appendChild(st);
                    return document.querySelector('#inicio-nuevo').shadowRoot.querySelector('.og').dataset.falta === '1'; }""")
                if falta:
                    print('   · %s/%s: la página no lo encontró' % (tipo, slug))
                    continue
                # ⚠️ la «4b» va en la huella: si la página publicada todavía es la de antes (el ciclo corrió antes de que se
                # desplegara la web), la foto saldría vieja con la huella nueva y no se volvería a sacar nunca. Se saltea
                # y se reintenta en la corrida siguiente
                esperado = DISENO_REF if tipo == 'ref' else DISENO_CINE if tipo in TIPOS_CINE else ''
                if esperado and pag.evaluate("() => document.querySelector('#inicio-nuevo').shadowRoot.querySelector('.og').dataset.d || ''") != esperado:
                    print('   · %s/%s: la página publicada todavía es la de antes' % (tipo, slug))
                    continue
                # las fuentes: el nombre se vuelve a medir cuando llegan (og_link.jsx), y medido antes se salía
                pag.evaluate('() => document.fonts.ready.then(() => 1)')
                pag.wait_for_timeout(500)
                png = os.path.join(SALIDA, '%s_%s.png' % (tipo, slug))
                pag.screenshot(path=png, clip={'x': 0, 'y': 0, 'width': 1200, 'height': 630})
                jpg = png[:-4] + '.jpg'
                Image.open(png).convert('RGB').save(jpg, 'JPEG', quality=88, optimize=True)
                out[(tipo, slug)] = jpg
            except Exception as e:                       # noqa: BLE001
                print('   ⚠️ %s/%s: %s' % (tipo, slug, str(e)[:90]))
        nav.close()
    return out


def subir(hechas):
    import subir_cartas as SC
    s = SC.sesion()
    ok = []
    for (tipo, slug), ruta in hechas.items():
        with open(ruta, 'rb') as f:
            datos = f.read()
        clave = 'og/%s/%s.jpg' % (tipo, slug)
        try:
            r = s.put('%s/objects/%s' % (SC.API, clave), data=datos, headers={'Content-Type': 'image/jpeg'}, timeout=60)
            if SC._ok(r, clave) is not None:
                ok.append((tipo, slug))
        except Exception as e:                           # noqa: BLE001
            print('   ⚠️ %s no subió: %s' % (clave, str(e)[:80]))
    return ok


def correr(seco=False, solo=None):
    est = _leer_estado()
    todos = trabajos()
    if solo:
        todos = [t for t in todos if t[1] == slug_og(solo)]
    faltan = [t for t in todos if solo or (est.get(t[0]) or {}).get(t[1]) != t[2]]
    # 🖼️ los carteles de perfil, de a `MAX_PERFIL`: primero los que nunca se armaron
    pf = [t for t in faltan if t[0] == 'perfil']
    if len(pf) > MAX_PERFIL and not solo:
        pf.sort(key=lambda t: t[1] in (est.get('perfil') or {}))
        quedan = set(id(t) for t in pf[:MAX_PERFIL])
        faltan = [t for t in faltan if t[0] != 'perfil' or id(t) in quedan]
    # 🎬 las de cine, de a `MAX_CINE`: primero las que nunca se armaron, y las páginas antes que el resto
    cn = [t for t in faltan if t[0] in TIPOS_CINE]
    if len(cn) > MAX_CINE and not solo:
        cn.sort(key=lambda t: (t[1] in (est.get(t[0]) or {}), TIPOS_CINE.index(t[0])))
        quedan_c = set(id(t) for t in cn[:MAX_CINE])
        faltan = [t for t in faltan if t[0] not in TIPOS_CINE or id(t) in quedan_c]
    print('   🎁 miniaturas de los links: %d crews, links, perfiles y de cine, %d para armar ahora (%d perfiles y %d de cine esperan)'
          % (len(todos), len(faltan), max(0, len(pf) - MAX_PERFIL) if not solo else 0, max(0, len(cn) - MAX_CINE) if not solo else 0))
    if seco or not faltan:
        for t in faltan[:20]:
            print('      · %s/%s' % (t[0], t[1]))
        return 0
    hechas = dibujar(faltan)
    if solo:
        for (tipo, slug), ruta in hechas.items():
            print('      ✅ %s' % ruta)
        return 0
    subidas = subir(hechas)
    huellas = {(t[0], t[1]): t[2] for t in faltan}
    for tipo, slug in subidas:
        est.setdefault(tipo, {})[slug] = huellas[(tipo, slug)]
    with io.open(ESTADO, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(est, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write('\n')
    print('      ✅ %d subidas de %d' % (len(subidas), len(faltan)))
    return 0


def _self_check():
    malos = 0

    def ok(c, que):
        nonlocal malos
        print('  %s %s' % ('✅' if c else '❌', que))
        if not c:
            malos += 1
    # los mismos casos que `slugOg()` en _worker.js (medidos con node el 17/11/2026)
    ok(slug_og('La Fórmula Crew') == 'la-formula-crew' and slug_og('Ñandú_7') == 'nandu-7' and slug_og('  --  ') == ''
       and slug_og('Follombia') == 'follombia', 'el slug es el de _worker.js: sin tildes, minúsculas, «-» entre palabras')
    a = _huella({'n': 'X', 'g': 3})
    ok(a == _huella({'g': 3, 'n': 'X'}) and a != _huella({'n': 'X', 'g': 4}), 'la huella no depende del orden y cambia con los datos')
    f0 = {'k': 'ana', 'c': ['servidor', 'temporada'], 'cv': 'a1.b2'}
    ok(_carta('ana', f0, ['temporada', 'servidor']) == PUBLICA + '/ana/temporada.webp?v=a1' and _carta('x', {}, []) == '',
       'la carta del cartel: la primera en el orden de la vista previa, con su versión; sin carta, nada')
    import datetime
    hoy = datetime.datetime(2026, 11, 18, 3, 0, tzinfo=datetime.timezone.utc)
    cal = [{'t': (hoy - datetime.timedelta(hours=h)).strftime('%Y-%m-%dT%H:%M:%SZ')} for h in range(0, 42 * 4, 4)]
    cal.append({'t': (hoy - datetime.timedelta(days=9)).strftime('%Y-%m-%dT%H:%M:%SZ')})     # fuera de la semana
    L0 = {'calendario': cal, 'comunidad': {'personas': 21386, 'servidores': 14}}
    V = _vitrina(L0, hoy)
    ok(V == {'t': 40, 'm': 21000, 's': 14},
       'la miniatura del link: 42 eventos en 7 días → «más de 40», 21.386 → «más de 21.000», 14 socios (%s)' % V)
    ok(_mas_de(40, 10) == 30 and _mas_de(21000, 1000) == 20000 and _mas_de(1, 10) == 0 and _mas_de(0, 10) == 0,
       '«más de» siempre es verdad: 40 justos dicen «más de 30», no «más de 40»')
    ok(_vitrina({}, hoy) == {'t': 0, 'm': 0, 's': 0}, 'sin lobby, ceros (la página esconde lo que no llega)')
    with io.open(os.path.join(BASE, 'web', 'src', 'og_link.jsx'), encoding='utf-8') as f:
        jsx = f.read()
    mj = re.search(r"export const DISENO_REF = '([^']+)'", jsx)
    ok(mj is not None and mj.group(1) == DISENO_REF,
       'DISENO_REF es el mismo acá y en og_link.jsx (si no, la página nunca «es la de ahora» y no sale ninguna foto)')
    mc = re.search(r"export const DISENO_CINE = '([^']+)'", jsx)
    ok(mc is not None and mc.group(1) == DISENO_CINE, 'DISENO_CINE es el mismo acá y en og_link.jsx')
    mt = re.search(r"const CINE = new Set\(\[([^\]]+)\]\)", jsx)
    ok(mt is not None and set(re.findall(r"'(\w+)'", mt.group(1))) == set(TIPOS_CINE), 'los tipos de cine son los mismos acá y en og_link.jsx')
    ok(_corto(837478) == '837K' and _corto(6693149) == '6,7M' and _corto(2000000) == '2M' and _miles(21386) == '21.386',
       'los números como la carta: 837K, 6,7M, 21.386')
    # una semana con un torneo por día salvo uno: «Torneos cada semana», no «Hay torneo todos los días»
    hoy7 = datetime.datetime(2026, 11, 18, 20, 0, tzinfo=datetime.timezone.utc)
    cal7 = [{'t': (hoy7 - datetime.timedelta(days=d)).strftime('%Y-%m-%dT%H:%M:%SZ'), 'sv': 'FFA'} for d in range(6)]
    Lc = {'calendario': cal7, 'comunidad': {'personas': 21386, 'servidores': 14}, 'temporada': 'T1',
          'svs': [{'sv': 'FFA', 'n': 3, 'ev': 9, 'logo': 'x', 'sigla': 'FFA', 'nombre': 'Freestyle For All'}],
          'paises': [{'cc': 'ar', 'n': 2, 'pts': 9000}, {'cc': 'br', 'n': 900, 'pts': 10 ** 9}],
          'llaves': {'660': {'nombre': 'NEW GENESIS', 'sv': 'FFA', 'participantes': 34, 'tabla': [['Valen', 'Campeón', 1], ['Oasis', 'Subcampeón', 1]]},
                     '659': {'nombre': '(sin titulo)', 'sv': 'LKR', 'fecha': '17/11', 'participantes': 10, 'tabla': [['Puppy', 'Campeón', 1]]},
                     'v:9': {'nombre': 'en vivo'}}}
    C = {(t, s): d for t, s, d in _cine(Lc, {'lobby': {'ligas': [{'id': 'fmh-espana', 'n': 'FMH España', 'sv': 'URBF', 'j': 9}]}}, {'ar': 'Argentina'}, hoy7)}
    ok(C[('pag', 'inicio')]['d'] == ['Más de 21.000 miembros · *14* socios'] and C[('pag', 'inicio')]['o'],
       'la portada: «más de 21.000 miembros · 14 socios» y el «online» al lado de freestyle')
    ok(C[('pag', 'eventos')]['a'] == 'Torneos', 'con un día sin torneo no dice «hay torneo todos los días»')
    ok(('pais', 'ar') in C and not any(k[0] == 'pais' and k[1] == 'br' for k in C) and C[('pais', 'ar')]['b'] == '#1 del mundo',
       'los países: sin Brasil, con su puesto en el mundo')
    ok(C[('llave', '660')]['b'] == 'campeón: Valen' and C[('llave', '660')]['d'] == ['*34* raperos · final con Oasis'] and ('llave', 'v:9') not in C,
       'las llaves: el campeón y la final; las en vivo, no')
    ok(C[('llave', '659')]['a'] == 'Llave #659' and C[('llave', '659')]['s'] == 'LKR · 17/11',
       'una llave «(sin titulo)» se llama por su número, con el servidor y la fecha en el sello')
    ok(C[('liga', 'fmh-espana')]['b'] == 'jornada 9' and C[('sv', 'ffa')]['a'] == 'FFA', 'las ligas con su jornada y los servidores con su sigla')
    ok('ranking' not in {s for t, s in C} and 'tarjetas' not in {s for t, s in C}, 'sin cartas no hay podio ni abanico: esas páginas quedan con la de antes')
    with io.open(os.path.join(BASE, 'bot', 'ci', 'guardar.sh'), encoding='utf-8') as f:
        ok('datos/og_links.json' in f.read(), 'datos/og_links.json va en ARCHIVOS de guardar.sh (si no, cada corrida sube todas)')
    print('\n%s' % ('✅ las miniaturas de los links' if not malos else '❌ %d falla(s)' % malos))
    return 1 if malos else 0


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:                                    # noqa: BLE001
        pass
    a = sys.argv[1:]
    if '--auto' in a:
        return _self_check()
    if '--ver' in a:
        i = a.index('--ver')
        return correr(solo=a[i + 1] if i + 1 < len(a) else '')
    if '--subir' in a:
        return correr()
    if '--seco' in a:
        return correr(seco=True)
    print(__doc__)
    return 0


if __name__ == '__main__':
    sys.exit(main())
