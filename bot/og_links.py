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

🌎 Y DESDE EL 24/11/2026 LA DE CADA FICHA DEL RANKING GLOBAL (`og/glob/<clave>.jpg`; Dlx, a «¿le hago a cada ficha su
propia miniatura de link?»: «Sí, hazlas»). Las 1.270 personas del Ranking global tienen ficha con dirección
(`/freestyle-rap/ranking/global/<clave>`): su nombre, su país y por qué está, con su foto a la derecha (el recorte de
fms.tv o la de perfil) o su bandera. 🔒 SIN NÚMEROS (Dlx: «no pongas estadísticas porque va a cambiar eso y no quiero que
cambie a cada rato»): se arman una vez y se rehacen sólo si cambia quién es. Salen de `bot/paginas/global.json` del repo
(`_cine_global()`); van aparte de las otras de cine, de a `MAX_GLOB` por corrida, así la primera vez (o alguien nuevo en
la tabla) no frena las de las páginas. El Worker las da en `vistaGlobal()`.

🖼️ Y DESDE EL 20/11/2026 LAS IMÁGENES DE `/perfil` Y `/vitrina` (la tanda 2 de los comandos del bot; Dlx aprobó «A · la
portada» y «la combinación»): `perfil/<clave>.webp` y `vitrina/<clave>.webp` en R2, de 1200 de ancho. Las dibuja la página
(`#/og/perfil-img/<clave>`, web/src/og_img.jsx) con las mismas cuentas que el perfil. Quién cambió lo dice el SELLO de cada
imagen, que la página calcula para todos de una vez (`#/og/img-sellos/t1`, una sola carga): se rearman las que cambiaron,
de a `MAX_IMG` por corrida, primero las que nunca se armaron, y las de más de `VIEJA_DIAS` días aunque no hayan cambiado
(su rol de DRA y los emblemas que eligió no entran al sello: son un pedido por persona). Lo que no llega acá lo arma a
pedido el kit (`bot/kit.py --tipo img`) cuando alguien usa el comando.

    python bot/og_links.py --subir     arma las que cambiaron y las sube (el ciclo, al final de dibujar)
    python bot/og_links.py --seco      dice cuáles armaría, sin abrir el navegador ni subir
    python bot/og_links.py --ver X     arma sólo la crew o el link X en salida_og/, sin subir (para mirarla)
    python bot/og_links.py --local CARPETA clave…   las imágenes de /perfil y /vitrina de esas claves con la página
                                       construida ACÁ (bot/paginas) y los datos publicados, en CARPETA, sin subir nada
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
TIPOS_CINE = ('pag', 'sv', 'pais', 'llave', 'liga', 'glob')
MAX_CINE = 45
#: 🌎 las fichas del Ranking global (24/11/2026), aparte del tope de arriba: son ~1.270 la primera vez y después sólo los
#: que entran a la tabla o cambian de foto. ~1 s cada una
MAX_GLOB = 150
GRUPO_GLOBAL = {'pro': 'Pro', 'plaza': 'Plaza', 'liga': 'Liga'}
#: 🖼️ /perfil y /vitrina (20/11/2026): el mismo `DISENO_IMG` de web/src/og_img.jsx (si la página publicada dice otro, la foto
#: se saltea); cuántas por corrida (cada una ~1 s, sin recargar la página entre una y otra); y cada cuántos días se rearma
#: una aunque su sello no haya cambiado (lo que no entra al sello: su rol de DRA y los emblemas que eligió)
DISENO_IMG = 'img-1'
TIPOS_IMG = {'perfil-img': 'perfil', 'vitrina-img': 'vitrina'}
MAX_IMG = 30
VIEJA_DIAS = 7
#: los sellos de hoy de todos (los calcula la página), para `bot/subir_datos.py`, que los pone en el `p:` de cada uno: así
#: el Worker sabe si la imagen que hay es la de hoy. No se commitea: se vuelve a calcular en cada corrida
SELLOS_HOY = os.path.join(SALIDA, 'sellos_img.json')
#: el bot/paginas de este repo, para `--local`
PAGINAS = os.path.join(BASE, 'bot', 'paginas')


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
    # 🆕 y las tres que no tenían (19/11/2026, Dlx: «sí, hazlas»): daban `og.png`, el cartel de antes
    pag('competencias', 'competencias', 'a', 'Competencias', 'Compite', 'cada semana', ['*32* en la Copa · la Liga de 10 y la Rapid'])
    pag('invitar', 'invitar', 'a', 'Invita y gana', 'Invita', 'y gana', ['Quien entra con tu link: *500* Puntos de Tienda', 'Con *10* invitados, el marco Embajador'])
    pag('inventario', 'inventario', 'a', 'Inventario', 'Arma', 'tu carta', ['Marcos, TAGs, fondos y estilos'])

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
    if d.get('r'):
        q.append(('r', d['r']))
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
    for tipo, slug, d in _cine(L, LG, nombres) + _cine_global():
        out.append((tipo, slug, _huella(dict(d, dis=DISENO_CINE)), _ruta_cine(tipo, slug, d)))
    return out


def _cine_global(G=None):
    """🌎 `[('glob', slug, datos)]` de cada ficha del Ranking global (24/11/2026), con lo que dibuja `Cine` (og_link.jsx).
    `G` es `bot/paginas/global.json` (sin pasarlo, el del repo). A la derecha, el recorte sin fondo (`fr`, `retrato`), la
    foto de perfil (`ft`, `foto`), la carta de la Liga con la bandera o la bandera sola; sin nada de eso, el nombre a lo
    ancho. ⚠️ NADA QUE CAMBIE CADA SEMANA: ni números ni el fondo por puesto (sale de la clave), así la miniatura de cada
    uno se arma una vez y se rehace sólo si cambia quién es (nombre, país, foto, por qué es pro)"""
    if G is None:
        try:
            with io.open(os.path.join(BASE, 'bot', 'paginas', 'global.json'), encoding='utf-8') as f:
                G = json.load(f)
        except (OSError, ValueError):
            return []
    if os.path.join(BASE, 'herramientas') not in sys.path:
        sys.path.insert(0, os.path.join(BASE, 'herramientas'))
    import fondos_og as FO
    try:
        with io.open(os.path.join(BASE, 'bot', 'paginas', 'og', 'pais', 'nombres.json'), encoding='utf-8') as f:
            nombres = json.load(f)
    except (OSError, ValueError):
        nombres = {}
    # los de la Liga, con su carta de Temporada (o la de Servidor) al lado de la bandera, como la miniatura de cada país
    try:
        with io.open(os.path.join(BASE, 'datos', 'cartas_r2.json'), encoding='utf-8') as f:
            inv = json.load(f)
    except (OSError, ValueError):
        inv = {}
    out = []
    import zlib
    for g in (G or {}).get('g') or []:
        if not isinstance(g, dict) or not g.get('k') or not g.get('n') or not slug_og(g['k']):
            continue
        fijo = zlib.crc32(str(g['k']).encode('utf-8'))
        cc = str(g.get('cc') or '').lower()
        cc = cc if re.match(r'^[a-z]{2}$', cc) else ''
        # 🔒 SIN NÚMEROS QUE SE MUEVAN (Dlx, 24/11/2026: «no pongas estadísticas porque va a cambiar eso y no quiero que
        # cambie a cada rato»): ni el puesto, ni los puntos, ni las batallas. Sólo quién es: su país y por qué está
        if g.get('esc') == 'pro' and g.get('por'):
            datos = [str(g['por'][0]).split(' (')[0]]
        elif g.get('esc') == 'liga':
            datos = ['Juega en la *Liga Global*']
        else:
            datos = ['Su ficha en el *Ranking global*']
        fr, ft = str(g.get('fr') or ''), str(g.get('ft') or '')
        mias = inv.get(str(g.get('lg') or '')) or {} if g.get('esc') == 'liga' else {}
        carta = next((mias[x] for x in ('temporada', 'servidor') if isinstance(mias.get(x), str) and mias[x].startswith(PUBLICA)), '')
        v = 'retrato' if fr else 'foto' if ft else 'bandera' if cc or carta else ''
        out.append(('glob', slug_og(g['k']), {
            'f': FO.fondo_de('sv', fijo) if v else FO.fondo_de('llave', fijo), 'l': 'c' if v else 'a',
            's': 'Ranking global · %s' % GRUPO_GLOBAL.get(g.get('esc'), 'Ranking global'),
            'a': str(g['n']).strip(),
            'b': nombres.get(cc) or 'freestyle',
            'd': datos, 'v': v, 'c': [carta] if carta and v == 'bandera' else [], 'e': [cc] if cc else [], 'o': False,
            'r': fr or ft}))
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


# ── 🖼️ LAS IMÁGENES DE /perfil Y /vitrina (20/11/2026) ─────────────────────────────────────────────────────────────────
def _raiz_web():
    """La raíz de la página (sin el `/freestyle-rap`): ahí viven `/inicio/`, `/api/` y las imágenes"""
    m = re.match(r'^(https?://[^/]+)', WEB)
    return m.group(1) if m else WEB


_CO_LOCAL = {}


def _co_local():
    """`{clave: [puesto, de cuántos]}` del Competitivo, de `datos/` (lo mismo que `_perfiles()` de subir_web.py pone en
    `rk.co`): para que `--local` muestre lo que va a publicar el próximo ciclo aunque /api/perfiles todavía no lo traiga"""
    if not _CO_LOCAL:
        try:
            for p in (os.path.join(BASE, 'sheet'), os.path.join(BASE, 'bot')):
                if p not in sys.path:
                    sys.path.append(p)
            import subir_web as SW
            import espejo_t1 as ESP
            with io.open(os.path.join(BASE, 'datos', 'temporada_pool.json'), encoding='utf-8') as f:
                de = SW._quien(json.load(f))
            vc = [x for x in (ESP.leer('Ranking Competitivo') or {}).get('filas') or [] if isinstance(x, list) and len(x) > 1 and isinstance(x[0], int)]
            for x in vc:
                q = de(x[1])
                if q and q not in _CO_LOCAL:
                    _CO_LOCAL[q] = [x[0], len(vc)]
        except Exception as e:                           # noqa: BLE001
            print('   · --local sin el puesto del Competitivo de datos/ (%s)' % str(e)[:60])
            _CO_LOCAL['_'] = None
    return _CO_LOCAL


def _servir_local(route, req):
    """`--local`: la página construida ACÁ (bot/paginas) con los datos publicados, como `servir()` de herramientas/tuto_medir.py.
    Lo de `/inicio/` y el documento salen del disco; `/api/` y las imágenes, de la página de verdad (sólo se leen). A
    /api/perfiles se le suma `rk.co` de `datos/` (ver `_co_local()`)"""
    u = req.url
    raiz = _raiz_web()
    if u.startswith(raiz) and u.split('?')[0].endswith('/api/perfiles'):
        try:
            r = route.fetch()
            d = r.json()
            co = _co_local()
            for k, p in (d.get('p') or {}).items():
                if co.get(k) and isinstance(p, dict) and not (p.get('rk') or {}).get('co'):
                    p.setdefault('rk', {})['co'] = co[k]
            return route.fulfill(status=200, body=json.dumps(d, ensure_ascii=False).encode('utf-8'),
                                 headers={'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'})
        except Exception:                                # noqa: BLE001
            return route.continue_()
    if u.startswith(raiz) and '/inicio/' in u:
        f = os.path.join(PAGINAS, 'inicio', *u.split('/inicio/', 1)[1].split('?')[0].split('/'))
        if os.path.isfile(f):
            ct = 'text/css' if f.endswith('.css') else 'application/json' if f.endswith('.json') else 'application/javascript'
            return route.fulfill(path=f, headers={'content-type': ct, 'cache-control': 'no-store'})
    if req.resource_type == 'document' and u.startswith(raiz) and '/api/' not in u:
        return route.fulfill(path=os.path.join(PAGINAS, 'index.html'), headers={'content-type': 'text/html; charset=utf-8'})
    return route.continue_()


def _navegador(pw, local):
    """El navegador del fotógrafo, en hora del este (las fechas de las placas, «8 nov», son las de la Liga)"""
    nav = pw.chromium.launch()
    ctx = nav.new_context(viewport={'width': 1200, 'height': 960}, device_scale_factor=1, timezone_id='America/New_York')
    if local:
        ctx.route('**/*', _servir_local)
    return nav, ctx.new_page()


_OG = "() => { const h = document.querySelector('#inicio-nuevo'); return h && h.shadowRoot && h.shadowRoot.querySelector('.og'); }"
#: la imagen de ESA clave y ese tipo, lista (o que la página dijo que no está): el fotógrafo cambia sólo la dirección, y
#: hasta que React no monta la nueva sigue estando la anterior
_ESPERA_IMG = """([k, t]) => { const h = document.querySelector('#inicio-nuevo');
    const o = h && h.shadowRoot && h.shadowRoot.querySelector('.og');
    if (!o) return false;
    if (!o.classList.contains('oi')) return o.dataset.listo === '1';
    return o.dataset.k === k && o.dataset.t === t && o.dataset.listo === '1'; }"""


def sellos_img(local=False):
    """🔏 `{clave: [sello de /perfil, sello de /vitrina]}` de todos los que tienen carta, como los calcula la página
    (`#/og/img-sellos/<t>`, web/src/og_img.jsx), o `None` si no pudo: un pedido caído, o la página publicada todavía no
    tiene la ruta (sin sellos no se redibuja nada, y el Worker sigue con las imágenes que hay)."""
    import navegador
    navegador.hace_falta()
    from playwright.sync_api import sync_playwright
    from comun.temporada import ACTUAL
    d = None
    with sync_playwright() as pw:
        nav, pag = _navegador(pw, local)
        try:
            pag.goto('%s/og/img-sellos/%s' % (WEB, ACTUAL), wait_until='domcontentloaded', timeout=60000)
            pag.wait_for_function('() => { const o = (%s)(); return !!(o && o.dataset.listo === "1"); }' % _OG, timeout=120000)
            d = pag.evaluate('() => { const o = (%s)(); return {d: o.dataset.d || "", falta: o.dataset.falta === "1", s: o.dataset.sellos || ""}; }' % _OG)
        except Exception as e:                           # noqa: BLE001
            print('   ⚠️ los sellos de /perfil y /vitrina no salieron: %s' % str(e)[:100])
        finally:
            nav.close()
    if not d:
        return None
    if d.get('d') != DISENO_IMG:
        print('   · los sellos: la página publicada todavía no tiene las imágenes de /perfil (o es otro diseño)')
        return None
    if d.get('falta') or not d.get('s'):
        print('   · los sellos: a la página le faltó un dato (un pedido caído): esta vuelta no se redibuja ninguna')
        return None
    try:
        s = json.loads(d['s'])
    except ValueError:
        return None
    return {k: v for k, v in s.items() if isinstance(v, list) and len(v) == 2
            and all(isinstance(x, str) and re.match(r'^[0-9a-f]{10}$', x) for x in v)}


def dibujar_img(lista, local=False, salida=None):
    """`[(tipo, clave)]` → `{(tipo, clave): (ruta del WebP, sello, alto)}` de las que salieron. UNA página para todas: entre
    una y otra cambia sólo la dirección, así los datos (/api/perfiles, ~1 MB) se bajan una vez. Una que la página no
    encuentra, o con otro diseño, no sale."""
    from urllib.parse import quote
    import navegador
    navegador.hace_falta()
    from playwright.sync_api import sync_playwright
    from PIL import Image
    salida = salida or SALIDA
    os.makedirs(salida, exist_ok=True)
    out = {}
    with sync_playwright() as pw:
        nav, pag = _navegador(pw, local)
        primera = True
        for tipo, k in lista:
            ruta = '%s/%s' % (tipo, quote(k, safe=''))
            try:
                if primera:
                    pag.goto('%s/og/%s' % (WEB, ruta), wait_until='domcontentloaded', timeout=60000)
                else:
                    pag.evaluate('(h) => { location.hash = h; }', '#/og/' + ruta)
                pag.wait_for_function(_ESPERA_IMG, arg=[k, tipo], timeout=60000)
                if primera:
                    pag.add_style_tag(content='body *{visibility:hidden!important} #inicio-nuevo{visibility:visible!important}')
                    primera = False
                d = pag.evaluate('() => { const o = (%s)(); return {oi: o.classList.contains("oi"), d: o.dataset.d || "", falta: o.dataset.falta === "1",'
                                 ' inc: o.dataset.incompleto === "1", sello: o.dataset.sello || "", alto: Number(o.dataset.alto) || 0}; }' % _OG)
                if not d['oi'] or d['d'] != DISENO_IMG:
                    print('   · %s/%s: la página todavía no tiene esta imagen (o es otro diseño)' % (tipo, k))
                    continue
                if d['falta']:
                    print('   · %s/%s: %s' % (tipo, k, 'a la página le faltó un dato' if d['inc'] else 'la página no lo encontró'))
                    continue
                pag.wait_for_timeout(250)
                png = os.path.join(salida, '%s_%s.png' % (TIPOS_IMG[tipo], slug_og(k) or 'x'))
                pag.screenshot(path=png, clip={'x': 0, 'y': 0, 'width': 1200, 'height': d['alto'] or 760})
                webp = png[:-4] + '.webp'
                Image.open(png).convert('RGB').save(webp, 'WEBP', quality=86, method=4)
                os.remove(png)
                out[(tipo, k)] = (webp, d['sello'], d['alto'])
            except Exception as e:                       # noqa: BLE001
                print('   ⚠️ %s/%s: %s' % (tipo, k, str(e)[:90]))
                primera = True                           # la próxima, con la página cargada de nuevo
        nav.close()
    return out


def clave_r2_img(tipo, k):
    """`perfil/<clave>.webp` o `vitrina/<clave>.webp`: fijas, la versión va en la dirección (`?v=<sello>`)"""
    return '%s/%s.webp' % (TIPOS_IMG[tipo], k)


def subir_img(hechas):
    """Sube las que salieron a su clave fija de R2. `[(tipo, clave)]` de las que entraron"""
    import subir_cartas as SC
    s = SC.sesion()
    ok = []
    for (tipo, k), (ruta, _sello, _alto) in hechas.items():
        clave = clave_r2_img(tipo, k)
        try:
            with open(ruta, 'rb') as f:
                datos = f.read()
            r = s.put('%s/objects/%s' % (SC.API, clave), data=datos, headers={'Content-Type': 'image/webp'}, timeout=60)
            if SC._ok(r, clave) is not None:
                ok.append((tipo, k))
        except Exception as e:                           # noqa: BLE001
            print('   ⚠️ %s no subió: %s' % (clave, str(e)[:80]))
    return ok


def _hoy():
    import datetime
    return (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=5)).strftime('%Y-%m-%d')


def _vieja(fecha, hoy):
    import datetime
    try:
        return (datetime.date.fromisoformat(hoy) - datetime.date.fromisoformat(fecha)).days >= VIEJA_DIAS
    except (TypeError, ValueError):
        return True


def que_img(sellos, est, hoy, tope=MAX_IMG):
    """`[(tipo, clave, sello)]` de las imágenes para rearmar esta vuelta, como mucho `tope`: primero las que nunca se
    armaron (en el orden de `sellos`), después las que cambiaron y al final las de más de `VIEJA_DIAS`. `est` es
    `{tipo: {clave: [sello, fecha]}}` (lo de `datos/og_links.json`)."""
    nunca, cambio, viejas = [], [], []
    for k, (sp, sv) in sellos.items():
        for tipo, s in (('perfil-img', sp), ('vitrina-img', sv)):
            ya = (est.get(tipo) or {}).get(k)
            if not isinstance(ya, list) or len(ya) < 2:
                nunca.append((tipo, k, s))
            elif ya[0] != s:
                cambio.append((tipo, k, s))
            elif _vieja(ya[1], hoy):
                viejas.append((tipo, k, s))
    return (nunca + cambio + viejas)[:max(0, tope)]


def _hechas_a_pedido():
    """Las que armó el kit a pedido (`/avisos/img-hechas`, del objeto): `{tipo: {clave: [sello, fecha]}}`. Así el ciclo
    no vuelve a armar lo que alguien acaba de pedir"""
    import avisar
    d = _get(avisar.WORKER + '/avisos/img-hechas', ciclo=True) or {}
    out = {}
    for x in d.get('hechas') or []:
        if isinstance(x, list) and len(x) >= 4 and x[0] in ('p', 'v') and re.match(r'^[0-9a-f]{10}$', str(x[2])):
            out.setdefault('perfil-img' if x[0] == 'p' else 'vitrina-img', {})[str(x[1])] = [str(x[2]), str(x[3])]
    return out


def sin_olvidados(sellos, gente=None):
    """Los sellos sin quien pidió que lo olviden (`bot/olvidar.py`, `datos/olvidados.json`), por su nombre normalizado
    contra la clave. `gente` es para el self-check"""
    try:
        import olvidar as OLV
        g = OLV.olvidados() if gente is None else gente
        fuera = {OLV.norm((v or {}).get('quien') or '') for v in g.values()} - {''}
        return {k: v for k, v in sellos.items() if OLV.norm(k) not in fuera}
    except Exception:                                    # noqa: BLE001
        return sellos


def mezclar_hechas(est, hechas, sellos):
    """Lo que el kit armó a pedido cuenta como hecho SÓLO si es la imagen de HOY (su sello es el de `sellos`). 🔴 Antes se
    tomaba cualquiera que fuera distinta de la anotada: el objeto devuelve lo del kit durante 8 días, así que una imagen
    que el ciclo ya había rehecho volvía a figurar como la vieja del kit, y se redibujaba en CADA corrida (revisión del
    20/11/2026). Devuelve cuántas tomó."""
    n = 0
    for tipo, xs in (hechas or {}).items():
        i = 0 if tipo == 'perfil-img' else 1
        for k, v in xs.items():
            hoy_k = (sellos.get(k) or ['', ''])[i]
            ya = (est.get(tipo) or {}).get(k)
            if v[0] == hoy_k and (not isinstance(ya, list) or ya[0] != v[0]):
                est.setdefault(tipo, {})[k] = v
                n += 1
    return n


def correr_img(est):
    """🖼️ El paso de /perfil y /vitrina, adentro de `correr()`: los sellos de hoy, lo que cambió y la foto de eso. Escribe
    `SELLOS_HOY` para bot/subir_datos.py y anota en `est` lo que subió. Nunca frena el ciclo"""
    sellos = sellos_img()
    if sellos is None:
        return 0
    # 🗑️ quien pidió que lo olviden no se dibuja (hasta que la página lo saque, todavía puede venir en los perfiles)
    sellos = sin_olvidados(sellos)
    os.makedirs(SALIDA, exist_ok=True)
    # lo que el kit armó a pedido desde la última corrida cuenta como hecho, si es la de hoy
    mezclar_hechas(est, _hechas_a_pedido(), sellos)
    hoy = _hoy()
    lista = que_img(sellos, est, hoy)
    print('   🖼️ /perfil y /vitrina: %d con carta, %d para armar ahora' % (len(sellos), len(lista)))
    if lista:
        hechas = dibujar_img([(t, k) for t, k, _s in lista])
        for (tipo, k) in subir_img(hechas):
            est.setdefault(tipo, {})[k] = [hechas[(tipo, k)][1], hoy]
    # 🔏 para subir_datos.py: el sello de hoy y el de la imagen que hay, de cada uno (`p:<clave>`, campo `im`)
    hoy_img = {k: [sp, ((est.get('perfil-img') or {}).get(k) or [''])[0], sv, ((est.get('vitrina-img') or {}).get(k) or [''])[0]]
               for k, (sp, sv) in sellos.items()}
    with io.open(SELLOS_HOY, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(hoy_img, f, ensure_ascii=False, sort_keys=True)
    return len(lista)


def local(carpeta, claves):
    """`--local`: las dos imágenes de cada clave con la página construida acá, en `carpeta`. No sube ni escribe estado"""
    lista = [(t, k) for k in claves for t in ('perfil-img', 'vitrina-img')]
    hechas = dibujar_img(lista, local=True, salida=carpeta)
    for (tipo, k), (ruta, sello, alto) in sorted(hechas.items()):
        print('   ✅ %s · %s · 1200×%d · sello %s · %d KB' % (ruta, tipo, alto, sello, os.path.getsize(ruta) // 1024))
    faltan = [x for x in lista if x not in hechas]
    for t, k in faltan:
        print('   🔴 %s/%s no salió' % (t, k))
    return 1 if faltan else 0


def _guardar_estado(est):
    with io.open(ESTADO, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(est, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write('\n')


def _img_y_guardar(est):
    """🖼️ /perfil y /vitrina (nunca frena el ciclo: sin las imágenes nuevas, el bot sigue con las que hay) y el estado"""
    try:
        correr_img(est)
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ /perfil y /vitrina no salieron esta vez: %s' % str(e)[:100])
    _guardar_estado(est)


def correr(seco=False, solo=None):
    est = _leer_estado()
    # los sellos de hoy son de ESTA corrida: uno viejo le diría a subir_datos.py que una imagen está al día sin saberlo
    if not seco and not solo:
        try:
            os.remove(SELLOS_HOY)
        except OSError:
            pass
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
    # 🌎 las fichas del Ranking global, de a `MAX_GLOB`: primero las que nunca se armaron
    gl = [t for t in faltan if t[0] == 'glob']
    if len(gl) > MAX_GLOB and not solo:
        gl.sort(key=lambda t: t[1] in (est.get('glob') or {}))
        quedan_g = set(id(t) for t in gl[:MAX_GLOB])
        faltan = [t for t in faltan if t[0] != 'glob' or id(t) in quedan_g]
    cn = [t for t in faltan if t[0] in TIPOS_CINE and t[0] != 'glob']
    if len(cn) > MAX_CINE and not solo:
        cn.sort(key=lambda t: (t[1] in (est.get(t[0]) or {}), TIPOS_CINE.index(t[0])))
        quedan_c = set(id(t) for t in cn[:MAX_CINE])
        faltan = [t for t in faltan if t[0] not in TIPOS_CINE or t[0] == 'glob' or id(t) in quedan_c]
    print('   🎁 miniaturas de los links: %d crews, links, perfiles y de cine, %d para armar ahora (%d perfiles, %d de cine y %d fichas '
          'del global esperan)' % (len(todos), len(faltan), max(0, len(pf) - MAX_PERFIL) if not solo else 0,
                                  max(0, len(cn) - MAX_CINE) if not solo else 0, max(0, len(gl) - MAX_GLOB) if not solo else 0))
    if seco or not faltan:
        for t in faltan[:20]:
            print('      · %s/%s' % (t[0], t[1]))
        if not seco and not solo:
            _img_y_guardar(est)
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
    print('      ✅ %d subidas de %d' % (len(subidas), len(faltan)))
    _img_y_guardar(est)
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
    # 🖼️ y el del bot (22/11/2026: /crew muestra `og/crew/<slug>.jpg`): `slugCrewOg()` en bot/worker.js es el mismo cálculo
    def _cuerpo(ruta, patron):
        t = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), ruta), encoding='utf-8').read()
        m = re.search(patron, t, re.S)
        return re.sub(r'\s+', '', m.group(1)) if m else None
    js_pag = _cuerpo('paginas/_worker.js', r'function slugOg\(x\) \{\s*return (.+?);\s*\}')
    js_bot = _cuerpo('worker.js', r'const slugCrewOg = \(x\) => (.+?);\n')
    ok(js_pag and js_pag == js_bot, 'el slug de las crews en bot/worker.js (slugCrewOg) es el mismo de _worker.js (slugOg)')
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
    # 🖼️ /perfil y /vitrina (20/11/2026)
    with io.open(os.path.join(BASE, 'web', 'src', 'og_img.jsx'), encoding='utf-8') as f:
        oi = f.read()
    mi = re.search(r"export const DISENO_IMG = '([^']+)'", oi)
    ok(mi is not None and mi.group(1) == DISENO_IMG, 'DISENO_IMG es el mismo acá y en og_img.jsx (si no, ninguna foto de /perfil sale)')
    with io.open(os.path.join(BASE, 'web', 'src', 'og_link.jsx'), encoding='utf-8') as f:
        ol = f.read()
    ok(all("tipo === '%s'" % t in ol for t in TIPOS_IMG) and "tipo === 'img-sellos'" in ol,
       'og_link.jsx monta las dos imágenes y los sellos (las rutas que pide el fotógrafo)')
    hoy_ = '2026-11-20'
    s1, s2, s3 = 'a' * 10, 'b' * 10, 'c' * 10
    est0 = {'perfil-img': {'ana': [s1, hoy_], 'bo': [s1, '2026-11-01']}, 'vitrina-img': {'ana': [s3, hoy_], 'bo': [s2, hoy_]}}
    q = que_img({'ana': [s1, s2], 'bo': [s1, s2], 'cy': [s3, s3]}, est0, hoy_)
    ok(q == [('perfil-img', 'cy', s3), ('vitrina-img', 'cy', s3), ('vitrina-img', 'ana', s2), ('perfil-img', 'bo', s1)],
       'qué rearmar: primero las que nunca se armaron, después las que cambiaron y al final las de más de %d días (%s)' % (VIEJA_DIAS, q))
    ok(len(que_img({'k%d' % i: [s1, s2] for i in range(40)}, {}, hoy_)) == MAX_IMG, 'de a MAX_IMG (%d) por corrida' % MAX_IMG)
    # 🔴 lo del kit, sólo si es la de hoy: tres corridas seguidas con una vieja del kit en `img-hechas` no redibujan nada
    est1 = {'perfil-img': {'ana': [s2, hoy_]}, 'vitrina-img': {'ana': [s3, hoy_]}}
    kit_viejo = {'perfil-img': {'ana': [s1, '2026-11-18']}}              # lo que armó el kit ANTES de que el ciclo lo rehiciera
    redib = []
    for _ in range(3):
        mezclar_hechas(est1, kit_viejo, {'ana': [s2, s3]})
        redib.append(len(que_img({'ana': [s2, s3]}, est1, hoy_)))
    ok(redib == [0, 0, 0] and est1['perfil-img']['ana'][0] == s2,
       'una imagen vieja del kit no pisa la del ciclo: tres corridas, ninguna redibuja (%s)' % redib)
    ok(sin_olvidados({'lil-drako': [s1, s2], 'ana': [s1, s2]}, {'123': {'quien': 'Lil Drako'}}) == {'ana': [s1, s2]},
       'quien pidió que lo olviden no se dibuja')
    est2 = {'perfil-img': {'bo': [s1, '2026-11-19']}}
    ok(mezclar_hechas(est2, {'perfil-img': {'bo': [s2, hoy_]}}, {'bo': [s2, s3]}) == 1 and est2['perfil-img']['bo'][0] == s2
       and not [x for x in que_img({'bo': [s2, s3]}, est2, hoy_) if x[0] == 'perfil-img'],
       'la del kit que SÍ es la de hoy cuenta como hecha (el ciclo no la vuelve a armar)')
    ok(_vieja('2026-11-13', hoy_) and not _vieja('2026-11-14', hoy_) and _vieja('', hoy_), 'vieja a los %d días (sin fecha, vieja)' % VIEJA_DIAS)
    ok(clave_r2_img('perfil-img', 'makmah') == 'perfil/makmah.webp' and clave_r2_img('vitrina-img', 'nc') == 'vitrina/nc.webp',
       'las claves fijas de R2: perfil/<clave>.webp y vitrina/<clave>.webp (las mismas que arma el Worker, `V.urlImg()`)')
    with io.open(os.path.join(BASE, 'bot', 'vista.js'), encoding='utf-8') as f:
        ok('${r2}/${tipo}/${k}.webp' in f.read(), 'vista.js arma la misma dirección')
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
    if '--local' in a:
        i = a.index('--local')
        resto = [x for x in a[i + 1:] if not x.startswith('--')]
        if len(resto) < 2:
            print('uso: python bot/og_links.py --local CARPETA clave [clave…]')
            return 2
        return local(resto[0], resto[1:])
    if '--subir' in a:
        return correr()
    if '--seco' in a:
        return correr(seco=True)
    print(__doc__)
    return 0


if __name__ == '__main__':
    sys.exit(main())
