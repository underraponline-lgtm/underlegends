# -*- coding: utf-8 -*-
"""🗂️ LOS TRES FOROS DE DRA, AL DÍA: servidores-rap, crews y ligas (Dlx, 28/11/2026).

    python bot/foros_dra.py --vista [carpeta]   dibuja cada imagen y cada publicación (PNG + HTML), sin tocar Discord ni R2
    python bot/foros_dra.py --ver               el plan contra lo que hay en Discord: cuántas crea, edita y deja (sólo lee)
    python bot/foros_dra.py --aplicar           lo hace (lo corre el ciclo, paso 2c2f; apagado hasta el sí de Dlx)
    python bot/foros_dra.py --aplicar --prender la primera vez, con el sí de Dlx a la vista previa
    python bot/foros_dra.py --auto              el self-check, sin red ni navegador

    opciones de --aplicar: --ya (sin esperar la hora) · --etiquetas (crea las etiquetas que falten en crews y ligas)
                           · --desfijar-viejo (saca el fijado de otro para fijar el del bot: un foro fija UNA publicación)

🔑 Dlx: *«¿Ves la categoría de servidores de RAP? Vamos a actualizar eso con la información actual, socios actuales y
todo eso. Sigue el estilo que tiene cada servidor y ponlo dentro de aquí. Lo mismo haz con CREWS y ligas, y pon botones
si es necesario, como cómo ascender, etc.»*. Y sus reglas de siempre para Discord: nada de mensajes planos —imagen con
estilo, cosas reales y botones que HACEN algo— y *«no todo debería llevar a la página»*.

LO QUE HAY EN CADA FORO
  · 〢🌎〉servidores-rap: una publicación por SOCIO ACTUAL (`tiers.niveles()`: confirmado y en la Liga; DRA no, es la
    casa y el foro vive adentro), con SU estilo: su escena de fondo (la del banner que aprobó su equipo en «Tu página»,
    o la portada de su bot), su color (`datos/colores_sv_marca.json`) y su logo. El texto: qué es (lo que escribió su
    equipo), su tier y qué le cuenta, sus eventos de la temporada, sus ligas, su multiplicador de la semana y sus redes.
    Botones: «Unirme» (su invitación de la Liga), «Su página» y «📅 Sus próximos eventos» (sólo a quien toca, sin ir a
    la página). La etiqueta: Tier 1, 2 o 3, de su tier. Hermandad, Aliado y Pagado NO: no hay ningún dato de hoy que
    diga quién es qué (eran la taxonomía de mayo de Dlx), y una etiqueta inventada es peor que ninguna.
    Y una fijada del bot, «📌 Tiers y beneficios», con «🚀 Cómo ascender de tier» y «🤝 Sumar mi servidor».
  · crews: una por crew (`datos/crews_vivas.json`) con su escudo o su logo, su tier (Bronce…Leyenda, `crews_tiers`),
    su gente y su Líder. Botones: «Ver la crew», «➕ Cómo unirme» (y adentro, «Pedir entrar», que hace lo mismo que
    `/crew unirme`) y «📈 Cómo sube de tier». Y una fijada, «📌 Cómo funcionan las crews», con «🛡️ Crear una crew».
  · ligas: una por liga EN JUEGO (`ligas.para_web()`: sin campeón, con sus canales y con una batalla en los últimos
    `LIGA_ACTIVA_DIAS`), con su tabla dibujada en los colores de su servidor y su afiche al lado. Botones: «Ver la
    tabla» (el top 10, sólo a quien toca), «La liga» y «Su servidor». La que ya tiene publicación se sigue editando
    cuando termina (con su campeón). El cartel fijado de ese foro es de `bot/paneles_dra.py` (`ligas`): no se toca.

⚠️ UNA PUBLICACIÓN POR COSA, QUE SE EDITA. Nunca otra: el hilo y el mensaje quedan en `datos/foros_dra.json` (en
`ARCHIVOS` de `bot/ci/guardar.sh`: un runner nuevo no tiene memoria) y sólo se tocan si cambió su FIRMA —el título, las
etiquetas, el texto, los botones y la huella de la imagen—. Si alguien borró el hilo (404), se vuelve a crear.
⚠️ LA IMAGEN VA A R2 (`paneles/foros/…`, pública, con su huella en el nombre: Discord guarda lo que bajó de una URL) y
se dibuja y se sube SÓLO cuando cambió su HTML. Un ciclo quieto no abre el navegador.
⚠️ LOS BOTONES QUE HACEN ALGO los atiende el Worker (`bot/foros.js`, `fo:<qué>:<de quién>`) con lo que este script
deja en R2 (`paneles/foros/info.json`): textos ya armados acá, con las reglas de verdad (`tiers.py`, `crews_tiers.py`,
`crews.js`), y los próximos eventos de cada socio. Ni KV ni el lobby entero: una lectura chica de R2 por clic. Hasta que
ese Worker esté desplegado (`WORKER_LISTO`), `--aplicar` publica sólo los botones de link.
⚠️ UN FORO FIJA UNA SOLA PUBLICACIÓN. En servidores-rap ya está la de Dlx («INFO 〉TIERS, BENEFICIOS, ETC»): la nuestra
sale sin fijar hasta que Dlx diga (`--desfijar-viejo`). Un bot no puede editar la de Dlx.
⚠️ APAGADO HASTA EL SÍ DE DLX (`ENCENDIDO`), una vez por hora como mucho (`CADA_MIN`) y nunca de 3 a 11 AM ET.
"""
import base64
import datetime as dt
import hashlib
import html
import io
import json
import os
import re
import sys
import time

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (BASE, SCR, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

import paneles_dra as PD  # noqa: E402  el estilo de DRA (el cartel), las fuentes y cómo se encuentra un canal

#: 🔒 hasta que Dlx apruebe la vista previa: con `False`, `--aplicar` no hace nada (salvo `--prender`)
ENCENDIDO = False
#: 🤖 el Worker con `bot/foros.js` desplegado: hasta entonces sólo salen los botones de link (uno sin handler contesta
#: «Esta interacción falló», que es peor que no tenerlo)
WORKER_LISTO = False
#: una vez por hora como mucho: casi nada de esto cambia más seguido
CADA_MIN = 55
#: una liga sin batallas en estos días no está «en juego» (si ya tiene publicación, se sigue editando igual)
LIGA_ACTIVA_DIAS = 45
#: entra a la firma: cambiarlo vuelve a editar todas una vez (no las vuelve a publicar)
VERSION = '1'

GUILD = PD.GUILD
HUB = 'https://underlegends.pages.dev'
WEB = HUB + '/freestyle-rap'
ESTADO = os.path.join(BASE, 'datos', 'foros_dra.json')
R2_DIR = 'paneles/foros/'
INFO_R2 = R2_DIR + 'info.json'
API = 'https://discord.com/api/v10'
#: el nombre de cada foro, como lo compara `PD.canal_de()` (NFKD, sólo letras y números)
FOROS = {'sv': 'servidoresrap', 'crews': 'crews', 'ligas': 'ligas'}
TAG_TIER = {1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3'}
#: las etiquetas que este script propone crear (`--etiquetas`) en los foros que no tienen ninguna
ETIQUETAS_NUEVAS = {'crews': ['Bronce', 'Plata', 'Oro', 'Platino', 'Diamante', 'Maestro', 'Leyenda'],
                    'ligas': ['En juego', 'Terminada']}
#: el botón para agregar el bot: el mismo `BOT_LINK` de web/src/sumar2.jsx (administrador, con su propio rol)
BOT_LINK = ('https://discord.com/oauth2/authorize?client_id=1550026808404217926&permissions=8&integration_type=0'
            '&scope=bot+applications.commands')
#: los `que` que atiende `bot/foros.js` (`QUE` allá): el self-check compara las dos listas
QUE = ('tiers', 'sumar', 'ev', 'cu', 'cp', 'ct', 'cr', 'lt')
NEGRO, BLANCO, MAGENTA, VERDE = '#030304', '#F6F6F6', PD.MAGENTA, PD.VERDE
#: lo que suma cada tier, en palabras: COPIA de `DA` de web/src/sumar2.jsx (`['cuenta'|'tiene', frase]`). El self-check
#: compara las claves y el tipo con ese archivo: si allá se suma una, acá se pide
DA = {
    'suma': ('cuenta', 'tus eventos de {min} o más raperos suman a la Temporada'),
    'competitivo': ('cuenta', 'tus eventos cuentan para el Competitivo'),
    'duelos': ('cuenta', 'tus ligas cuentan como duelos'),
    'unirse': ('cuenta', 'sales en «Unirme a los Tier 1», el botón que suma gente a tu Discord con un toque'),
    'carta': ('tiene', 'la carta de tu servidor para tu gente'),
    'mes_awards': ('tiene', 'tus MES AWARDS'),
    'pagina': ('tiene', 'tu página en Socios'),
    'calendario': ('tiene', 'tus eventos en el calendario y la campana'),
    'ligas': ('tiene', 'tus ligas'),
    'panel': ('tiene', 'tu panel'),
    'estilos': ('cuenta', 'tus eventos dan estilos de juego'),
    'pases_t1': ('cuenta', 'regalas los Pases premium que te da la Liga a tus campeones'),
    'tarea_t1': ('cuenta', 'el Pase tiene una Tarea que lleva gente a tus eventos'),
    'redes2': ('tiene', '2 imágenes por semana para tus redes'),
    'redes5': ('tiene', '5 imágenes por semana para tus redes'),
    'consejo': ('tiene', 'tu voto en el consejo de socios'),
    'bienvenida': ('tiene', 'la bienvenida del bot a quien llega a tu Discord'),
    'perfil': ('tiene', 'el bot con el nombre, la foto y el banner de tu servidor'),
    'lo_nuevo': ('tiene', 'lo nuevo antes que nadie'),
    'prendas': ('tiene', 'la posibilidad de camisetas y prendas de tu servidor, hechas por la Liga'),
}
ORDEN_DA = ('suma', 'competitivo', 'duelos', 'estilos', 'unirse', 'pases_t1', 'tarea_t1', 'carta', 'mes_awards', 'redes2',
            'redes5', 'consejo', 'bienvenida', 'perfil', 'lo_nuevo', 'prendas', 'pagina', 'calendario', 'ligas', 'panel')
REDES = {'instagram': 'Instagram', 'youtube': 'YouTube', 'tiktok': 'TikTok', 'x': 'X', 'twitch': 'Twitch',
         'kick': 'Kick', 'facebook': 'Facebook', 'discord': 'Discord', 'web': 'Web'}
MEDALLA = {1: '🥇', 2: '🥈', 3: '🥉'}


# ── lo básico ────────────────────────────────────────────────────────────────────────────────────────────────────────
def _e(s):
    return html.escape(str(s if s is not None else ''), quote=True)


def _j(*p):
    try:
        with io.open(os.path.join(BASE, *p), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def _h(x, n=16):
    return hashlib.sha256((x if isinstance(x, str) else json.dumps(x, ensure_ascii=False, sort_keys=True)).encode('utf-8')).hexdigest()[:n]


def _mil(n):
    return '{:,}'.format(int(round(float(n or 0)))).replace(',', '.')


def _limpio(s):
    return ' '.join(str(s or '').replace('_', ' ').split())


def _md(s):
    """Un texto de afuera (una descripción, un nombre) sin que su markdown ni sus menciones rompan el nuestro."""
    s = re.sub(r'<[@#&!][^>]*>|@everyone|@here', '', str(s or ''))
    return re.sub(r'([*_~`|>\[\]])', r'\\\1', s).strip()


def _hex(c, defecto=0x29B298):
    try:
        return int(str(c).lstrip('#')[:6], 16)
    except ValueError:
        return defecto


def tinta(hexa):
    """Negra sobre los colores claros, blanca sobre los oscuros (la `tinta()` de web/src/escudo.jsx)."""
    try:
        n = int(str(hexa).lstrip('#')[:6], 16)
    except ValueError:
        return BLANCO
    return NEGRO if (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 150 else BLANCO


def _ahora():
    return dt.datetime.now(dt.timezone.utc)


def _iso(t):
    try:
        x = dt.datetime.fromisoformat(str(t).replace('Z', '+00:00'))
        return x if x.tzinfo else x.replace(tzinfo=dt.timezone.utc)
    except ValueError:
        return None


def _b64(ruta, tipo):
    try:
        return 'data:%s;base64,%s' % (tipo, base64.b64encode(open(ruta, 'rb').read()).decode())
    except OSError:
        return ''


def _b64_url(url, cache={}):                             # noqa: B006  (memoria de una corrida, a propósito)
    """Una imagen de R2 embebida (Chromium aislado no llega a la red). `''` si no se pudo."""
    if url in cache:
        return cache[url]
    out = ''
    try:
        import requests
        r = requests.get(url, timeout=20)
        if r.status_code == 200 and len(r.content) > 500:
            tipo = r.headers.get('content-type') or 'image/webp'
            out = 'data:%s;base64,%s' % (tipo.split(';')[0], base64.b64encode(r.content).decode())
    except Exception:                                    # noqa: BLE001
        out = ''
    cache[url] = out
    return out


def _temporada():
    try:
        from comun import temporada as T
        return str(T.ACTUAL or 't1').upper()
    except Exception:                                    # noqa: BLE001
        return 'T1'


def _nombres():
    """`{clave: nombre}` de la Lista, para mostrar a la gente de una crew por su nombre y no por su clave."""
    from comun.claves import clave
    out = {}
    for p in _j('datos', 'padron.json') or []:
        if isinstance(p, dict) and p.get('raw'):
            out.setdefault(clave(p['raw']), _limpio(p['raw']))
    return out


def _js_const(ruta, nombre):
    """Lee un `const NOMBRE = {…}` o `[…]` / `new Set([…])` de un archivo JS sin ejecutarlo: así el escudo de una crew
    se dibuja con los MISMOS catálogos que la página (web/src/escudo.jsx), sin copiarlos."""
    try:
        txt = io.open(os.path.join(BASE, ruta), encoding='utf-8').read()
    except OSError:
        return None
    m = re.search(r'const %s = (\{.*?\n\};|new Set\(\[.*?\]\);|\[.*?\];)' % re.escape(nombre), txt, re.S)
    if not m:
        return None
    cuerpo = m.group(1)
    if cuerpo.startswith('{'):
        return dict(re.findall(r"^\s+(\w+): '([^']*)',", cuerpo, re.M))
    return re.findall(r"'([^']*)'", cuerpo)


# ── 🛡️ el escudo armado de una crew (web/src/escudo.jsx, sin copiar sus piezas) ─────────────────────────────────────
_ESC = {}


def _esc_cat():
    if not _ESC:
        r = 'web/src/escudo.jsx'
        for k in ('FORMAS', 'SIMBOLOS', 'DIVISIONES', 'TRAZO', 'HUECOS', 'COLORES', 'FORMAS_ANTES', 'SIMBOLOS_ANTES'):
            _ESC[k] = _js_const(r, k)
    return _ESC


def leer_escudo(logo):
    """`{forma, simb, a, b, div, borde, c, sigla}` de un `esc:…`, o `None` (`leerEscudo()` de escudo.jsx)."""
    C = _esc_cat()
    m = re.match(r'^esc:([a-z]+)\.([a-z]+)\.([0-9a-f]{6})\.([0-9a-f]{6})(?:\.([a-z]+)\.([a-z]+)\.([0-9a-f]{6}))?(?:\.(\w{2,4}))?$',
                 str(logo or ''))
    if not m or not C.get('FORMAS') or m.group(1) not in C['FORMAS'] or m.group(2) not in (C.get('SIMBOLOS') or {}):
        return None
    e = {'forma': m.group(1), 'simb': m.group(2), 'a': m.group(3), 'b': m.group(4), 'div': 'liso', 'borde': 'fino',
         'c': m.group(4), 'sigla': m.group(8) or ''}
    if m.group(5):
        e.update(div=m.group(5), borde=m.group(6), c=m.group(7))
    return e


def del_nombre(nombre):
    """El escudo de una crew sin logo, sacado de su nombre (`delNombre()` de escudo.jsx: FNV-1a, `>>> 0`)."""
    C = _esc_cat()
    h = 2166136261
    for ch in str(nombre or '').lower().strip():
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    fa, sa, ca = C['FORMAS_ANTES'], C['SIMBOLOS_ANTES'], C['COLORES'][:10]
    e = {'forma': fa[h % len(fa)], 'simb': sa[(h >> 3) % len(sa)], 'a': ca[(h >> 7) % len(ca)], 'b': ca[(h >> 11) % len(ca)],
         'div': 'liso', 'borde': 'fino', 'sigla': ''}
    if e['b'] == e['a']:
        e['b'] = '0e0e10' if e['a'] == 'f6f6f6' else 'f6f6f6'
    e['c'] = e['b']
    return e


def svg_escudo(e, sigla=''):
    """El SVG del escudo (`Escudo` de escudo.jsx), 100 × 100 de viewBox."""
    C = _esc_cat()
    forma = C['FORMAS'][e['forma']]
    div = (C.get('DIVISIONES') or {}).get(e.get('div') or 'liso') or ''
    c = '#' + (e.get('c') or e['b'])
    borde = e.get('borde') or 'fino'
    trazo = e['simb'] in (C.get('TRAZO') or [])
    out = ['<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">']
    if div:
        out.append('<defs><clipPath id="cl"><path d="%s"/></clipPath></defs>' % forma)
    out.append('<path d="%s" fill="#%s"/>' % (forma, e['a']))
    if div:
        out.append('<path d="%s" fill="%s" clip-path="url(#cl)"/>' % (div, c))
    out.append('<path d="%s" fill="none" stroke="#030304" stroke-width="%d" stroke-linejoin="round"/>'
               % (forma, 8 if borde == 'grueso' else 4))
    if borde == 'doble':
        out.append('<path d="%s" fill="none" stroke="%s" stroke-width="3" stroke-linejoin="round" '
                   'transform="translate(50 50) scale(0.84) translate(-50 -50)"/>' % (forma, c))
    if e['simb'] == 'sigla':
        t = (e.get('sigla') or sigla or '?')[:4]
        out.append('<text x="50" y="50" dy="0.35em" text-anchor="middle" font-size="%d" font-weight="900" fill="#%s" '
                   'stroke="#030304" stroke-width="2" paint-order="stroke" font-family="Archivo">%s</text>'
                   % (36 if len(t) <= 2 else 29 if len(t) == 3 else 23, e['b'], _e(t)))
    else:
        out.append('<path d="%s" fill="%s" %s stroke="#%s" stroke-width="%d" stroke-linejoin="round" stroke-linecap="round"/>'
                   % (C['SIMBOLOS'][e['simb']], 'none' if trazo else '#' + e['b'],
                      'fill-rule="evenodd"' if e['simb'] in (C.get('HUECOS') or []) else '', e['b'], 6 if trazo else 2))
    out.append('</svg>')
    return ''.join(out)


# ── los datos ────────────────────────────────────────────────────────────────────────────────────────────────────────
def paginas_socios():
    """Lo que escribió el equipo de cada socio en «Tu página» (`paginasPublicas()` del objeto, público). `{}` sin red."""
    try:
        import requests
        from alertar import WORKER
        r = requests.get(WORKER + '/avisos/socio-paginas', timeout=10)
        if r.status_code == 200:
            return (r.json() or {}).get('paginas') or {}
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ las páginas de los socios no llegaron (%s): van con lo de datos/servidores.json' % str(e)[:60])
    return {}


def ligas_web():
    try:
        import ligas as LG
        return (LG.para_web() or {}).get('ligas') or []
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ las ligas no se leyeron (%s): el foro de ligas queda como está' % str(e)[:80])
        return None


def multiplicadores(ahora=None):
    """`{sv: ×}` de la semana en curso (`datos/multiplicadores.json`, que sortea bot/multiplicadores.py)."""
    ahora = ahora or _ahora()
    for s in reversed((_j('datos', 'multiplicadores.json') or {}).get('semanas') or []):
        a, b = _iso(s.get('inicio')), _iso(s.get('fin'))
        if a and b and a <= ahora < b:
            return s.get('sv') or {}
    return {}


def proximos(ahora=None):
    """`{sv: [[nombre, unix, link], …]}`: los eventos anunciados que todavía no empezaron (`cuando.proximos()`)."""
    try:
        import cuando as CU
        an = (_j('datos', 'anuncios.json') or {}).get('anuncios') or []
        xs = CU.proximos(an, (ahora or _ahora()).replace(tzinfo=None), cuantos=500)
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ los próximos eventos no se leyeron (%s)' % str(e)[:80])
        return {}
    out = {}
    for x in xs:
        t = _iso(x.get('cuando'))
        if not t:
            continue
        link = ('https://discord.com/channels/%s/%s/%s' % (x['guild_id'], x['canal_id'], x['msg_id'])
                if x.get('guild_id') and x.get('canal_id') and x.get('msg_id') else '')
        out.setdefault(x.get('servidor') or '', []).append([_limpio(x.get('nombre'))[:90], int(t.timestamp()), link])
    return {k: v[:8] for k, v in out.items()}


def discord_info():
    """`{sv: {desc, miembros}}` de cada socio, de Discord (`GET /guilds/{id}`, sólo lee): la descripción de su servidor
    para quien no escribió la suya en «Tu página», y cuánta gente tiene. Sin token o sin red, `{}`."""
    h = _cab()
    if not h:
        return {}
    import tiers as TI
    svs = (_j('datos', 'servidores.json') or {}).get('servidores') or {}
    out = {}
    for sv in TI.niveles(svs):
        gid = (svs.get(sv) or {}).get('guild_id')
        if not gid or sv in TI.CASA:
            continue
        try:
            r = _pedir('GET', '%s/guilds/%s?with_counts=true' % (API, gid), headers=h)
        except Exception:                                # noqa: BLE001
            continue
        if r.status_code == 200:
            j = r.json()
            out[sv] = {'desc': _limpio(j.get('description'))[:300], 'miembros': j.get('approximate_member_count')}
        time.sleep(0.25)
    return out


def _gente(n):
    """Cuánta gente, redondeado para abajo (7.356 → «más de 7.300»): así la publicación no se edita cada hora."""
    try:
        n = int(n)
    except (TypeError, ValueError):
        return ''
    if n < 50:
        return ''
    paso = 100 if n >= 1000 else 10
    return 'Más de %s' % _mil(n // paso * paso)


def socios(paginas=None, ligas=None, ahora=None, dc=None):
    """Los socios de hoy, con lo que dicen sus publicaciones: `[{sv, sigla, nombre, tier, …}]`, por tier y eventos."""
    import tiers as TI
    svs = (_j('datos', 'servidores.json') or {}).get('servidores') or {}
    niv = TI.niveles(svs)
    nb = _j('datos', 'niveles.json') or {}
    sin_t, sin_c = TI.sin('suma', nb), TI.sin('competitivo', nb)
    col = (_j('datos', 'colores_sv_marca.json') or {}).get('usar') or {}
    mult = multiplicadores(ahora)
    ev = {}
    for x in (_j('datos', 'llaves_t1.json') or {}).values():
        if isinstance(x, dict) and x.get('sv'):
            ev[str(x['sv']).upper()] = ev.get(str(x['sv']).upper(), 0) + 1
    lg = {}
    for L in ligas or []:
        if es_activa(L, ahora):
            lg.setdefault(L.get('sv'), []).append(L.get('n'))
    paginas = paginas or {}
    out = []
    for sv, t in niv.items():
        if sv in TI.CASA:
            continue
        x = svs.get(sv) or {}
        pg = paginas.get(sv) or {}
        sig = x.get('sigla') or sv
        out.append({
            'sv': sv, 'sigla': sig, 'nombre': _limpio(x.get('nombre') or sv), 'tier': t, 'tag': x.get('tag') or '',
            'color': col.get(sv) or '#7E8B89', 'desc': _limpio(pg.get('desc') or ((dc or {}).get(sv) or {}).get('desc'))[:600],
            'gente': _gente(((dc or {}).get(sv) or {}).get('miembros')),
            'redes': [[str(a), str(b)] for a, b in (pg.get('redes') or x.get('redes') or [])][:6],
            'banner': pg.get('banner') if str(pg.get('banner') or '').startswith('https://') else '',
            'invita': x.get('invitacion') or '', 'pagina': WEB + '/sv/' + sig, 'eventos': ev.get(sv, 0),
            'ligas': lg.get(sv) or [], 'suma': sv not in sin_t, 'comp': sv not in sin_c, 'mult': mult.get(sv),
            'min': TI.MIN_SOLO_TEMPORADA,
        })
    return sorted(out, key=lambda d: (d['tier'], -d['eventos'], d['nombre'].lower()))


def es_activa(L, ahora=None):
    """En juego: sin campeón, con sus canales y con una batalla en los últimos `LIGA_ACTIVA_DIAS`."""
    if L.get('fin') or L.get('cerrada'):
        return False
    t = _iso(L.get('ult_t'))
    return bool(t) and ((ahora or _ahora()) - t).days <= LIGA_ACTIVA_DIAS


def crews(ahora=None):
    """Las crews de hoy con su tier y su semana: `[{id, nombre, sigla, logo, desc, entrada, n, max, lider, tier, …}]`."""
    import crews_tiers as CT
    vivas = _j('datos', 'crews_vivas.json') or {}
    est = _j('datos', 'crews_tiers.json') or {}
    web = CT.para_web(est, vivas) if est else {'crews': {}}
    nom = _nombres()
    out = []
    for c in vivas.get('crews') or []:
        cid = c.get('id')
        if not cid:
            continue
        fila = (web.get('crews') or {}).get(cid) or [0, 0, 0]
        lider = next((g[0] for g in c.get('gente') or [] if len(g) > 1 and g[1] == 'lider'), '')
        out.append({'id': cid, 'nombre': _limpio(c.get('nombre') or cid), 'sigla': c.get('sigla') or '',
                    'logo': str(c.get('logo') or ''), 'desc': _limpio(c.get('desc'))[:300], 'entrada': c.get('entrada') or 'pedido',
                    'oficial': bool(c.get('oficial')), 'n': len(c.get('gente') or []), 'max': int(vivas.get('max') or 20),
                    'lider': nom.get(lider) or (lider.capitalize() if lider else ''), 'tier': int(fila[0] or 0),
                    'pts': int(fila[1] or 0), 'jugaron': int(fila[2] or 0), 'req': c.get('req') or {},
                    'pagina': WEB + '/crew/' + _url(cid)})
    return sorted(out, key=lambda d: (-d['tier'], -d['n'], d['nombre'].lower()))


def _url(s):
    from urllib.parse import quote
    return quote(str(s), safe='')


# ── 🖼️ las imágenes ──────────────────────────────────────────────────────────────────────────────────────────────────
def _fuentes():
    return PD._fuente_cartel() + PD._fuentes()


def _logo_sv(sv):
    p = os.path.join(BASE, 'bot', 'paginas', 'logos', str(sv).lower() + '.webp')
    return _b64(p, 'image/webp') if os.path.exists(p) else ''


def _escena_sv(d, red=True):
    """El fondo de un socio: el banner que aprobó su equipo, si no la portada de su bot (`bot/paginas/banners/bot/`)."""
    if d.get('banner') and red:
        b = _b64_url(d['banner'])
        if b:
            return b
    p = os.path.join(BASE, 'bot', 'paginas', 'banners', 'bot', str(d['sv']).lower() + '.jpg')
    return _b64(p, 'image/jpeg') if os.path.exists(p) else ''


CSS_SV = """
*{box-sizing:border-box;margin:0;padding:0}
body{background:#030304}
#c{position:relative;width:1600px;height:900px;overflow:hidden;background:#030304;color:#F6F6F6;font-family:'Archivo',sans-serif}
.esc{position:absolute;inset:0;background-size:cover;background-position:center}
.sin{position:absolute;inset:0;background:radial-gradient(120% 90% at 80% 10%,var(--c) 0%,#030304 62%)}
.sin:after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 2px,transparent 2px 26px)}
.velo{position:absolute;inset:0;background:linear-gradient(90deg,rgba(3,3,4,.94) 0%,rgba(3,3,4,.78) 38%,rgba(3,3,4,.18) 78%,rgba(3,3,4,.05) 100%),
  linear-gradient(0deg,rgba(3,3,4,.94) 0%,rgba(3,3,4,.62) 42%,rgba(3,3,4,0) 72%)}
.tier{position:absolute;left:64px;top:56px;display:flex;align-items:center;gap:14px;background:var(--c);color:var(--t);
  font-family:'Barlow Condensed','Archivo',sans-serif;font-weight:700;font-size:40px;letter-spacing:.1em;padding:8px 22px 6px;
  text-transform:uppercase;box-shadow:6px 6px 0 #030304}
.ul{position:absolute;right:60px;top:48px;width:110px;height:110px;filter:drop-shadow(4px 4px 0 #030304)}
.pie{position:absolute;left:64px;right:64px;bottom:86px;display:flex;align-items:center;gap:48px}
.logo{width:300px;height:300px;flex:none;border-radius:50%;background:#030304;border:10px solid var(--c);overflow:hidden;
  box-shadow:10px 10px 0 rgba(3,3,4,.9)}
.logo img{width:100%;height:100%;object-fit:cover}
.txt{flex:1;min-width:0}
.kick{display:inline-block;background:var(--c);color:var(--t);font-family:'Barlow Condensed','Archivo',sans-serif;font-weight:700;
  font-size:34px;letter-spacing:.16em;padding:6px 18px 4px;text-transform:uppercase}
.nom{font-family:'UL Cartel','Archivo',sans-serif;font-weight:900;font-stretch:125%;font-size:150px;line-height:.92;
  text-transform:uppercase;margin:18px 0 10px;white-space:nowrap;text-shadow:6px 6px 0 #030304}
.tag{font-family:'Barlow Condensed','Archivo',sans-serif;font-weight:700;font-size:44px;letter-spacing:.22em;color:#F6F6F6;
  text-transform:uppercase;opacity:.92}
.tag b{color:var(--c);font-weight:700}
.franja{position:absolute;left:0;right:0;bottom:0;height:16px;background:var(--c)}
"""


def html_sv(d, red=True):
    """La imagen de un socio, con SU estilo: su escena, su color, su logo y su nombre (como el banner de sus eventos)."""
    esc = _escena_sv(d, red)
    logo = _logo_sv(d['sv'])
    ul = _b64(PD.LOGO_CARTEL, 'image/png')
    fondo = ('<div class="esc" style="background-image:url(%s)"></div>' % esc) if esc else '<div class="sin"></div>'
    tag = ' · '.join(_e(x) for x in (d.get('tag'), d['sigla']) if x)
    cuerpo = ('%s<div class="velo"></div><div class="tier">Tier %d</div>%s'
              '<div class="pie">%s<div class="txt"><div class="kick">Servidor socio · Liga Global</div>'
              '<div class="nom" data-fit="1080"><span class="solido">%s</span></div><div class="tag">%s</div></div></div><div class="franja"></div>'
              % (fondo, d['tier'], ('<img class="ul" src="%s" alt="">' % ul) if ul else '',
                 ('<div class="logo"><img src="%s" alt=""></div>' % logo) if logo else '', _e(d['nombre']), tag))
    return ('<!doctype html><html><head><meta charset="utf-8"><style>%s%s</style></head><body>'
            '<div id="c" style="--c:%s;--t:%s">%s</div></body></html>') % (_fuentes(), CSS_SV, d['color'], tinta(d['color']), cuerpo)


CSS_CREW = """
*{box-sizing:border-box;margin:0;padding:0}
body{background:#030304}
#c{position:relative;width:1600px;height:900px;overflow:hidden;background:#030304;color:#EFEFEF;font-family:'Archivo',sans-serif}
.rayas{position:absolute;inset:0;width:1600px;height:900px;opacity:.9}
.kick{position:absolute;left:0;right:0;top:64px;display:flex;justify-content:center;align-items:center;gap:22px;
  font-family:'UL Cartel','Archivo',sans-serif;font-weight:900;font-stretch:125%;font-size:44px;text-transform:uppercase}
.kick img{width:96px;height:96px;clip-path:circle(45%)}
.esc{position:absolute;left:120px;top:250px;width:460px;height:460px;display:flex;align-items:center;justify-content:center;
  filter:drop-shadow(10px 10px 0 #E41373)}
.esc svg,.esc img{width:100%;height:100%;object-fit:contain}
.esc img{border-radius:24px}
.der{position:absolute;left:660px;right:80px;top:290px}
.cw{font-family:'Barlow Condensed','Archivo',sans-serif;font-weight:700;font-size:40px;letter-spacing:.2em;color:#E41373;
  text-transform:uppercase}
.nom{position:relative;font-family:'UL Cartel','Archivo',sans-serif;font-weight:900;font-stretch:125%;font-size:150px;line-height:.95;
  text-transform:uppercase;color:#29B298;white-space:nowrap;margin:10px 0 22px}
.nom .eco{position:absolute;left:0;top:.09em;color:transparent;-webkit-text-stroke:3px #E41373;z-index:0}
.nom .solido{position:relative;z-index:1}
.fila{display:flex;align-items:center;gap:20px;flex-wrap:wrap}
.sig{font-family:'UL Cartel','Archivo',sans-serif;font-weight:900;font-size:54px;background:#EFEFEF;color:#030304;padding:4px 20px}
.tier{font-family:'UL Cartel','Archivo',sans-serif;font-weight:900;font-size:54px;text-transform:uppercase;padding:4px 22px;
  background:var(--tc);color:var(--tt)}
.dato{font-family:'Barlow Condensed','Archivo',sans-serif;font-weight:700;font-size:46px;letter-spacing:.06em;text-transform:uppercase;
  margin-top:30px;color:#EFEFEF}
.dato b{color:#29B298;font-weight:700}
.liga{position:absolute;left:0;right:0;bottom:0;height:16px;background:linear-gradient(90deg,#29B298 50%,#E41373 50%)}
"""


def _rayas_crew():
    ls = ''
    for col, x1, y1, x2, y2 in [(VERDE, 0, 500, 320, 900), (MAGENTA, 0, 610, 230, 900), (MAGENTA, 0, 660, 580, 900),
                                (VERDE, 0, 735, 390, 900)]:
        for a, b in ((x1, x2), (1600 - x1, 1600 - x2)):
            ls += '<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="5"/>' % (a, y1, b, y2, col)
    return '<svg class="rayas" viewBox="0 0 1600 900">%s</svg>' % ls


def _logo_crew(c, red=True):
    """El logo de una crew: la imagen que subió (R2), el del repo (`bot/paginas/logos/crews/`), su escudo armado o el
    de su nombre — el mismo orden que la página (`escudoDe()`)."""
    lg = c.get('logo') or ''
    if lg.startswith('https://') and red:
        b = _b64_url(lg)
        if b:
            return '<img src="%s" alt="">' % b
    p = os.path.join(BASE, 'bot', 'paginas', 'logos', 'crews', c['id'] + '.webp')
    if not lg.startswith('esc:') and os.path.exists(p):
        return '<img src="%s" alt="">' % _b64(p, 'image/webp')
    e = leer_escudo(lg) or del_nombre(c['nombre'])
    return svg_escudo(e, c.get('sigla'))


def html_crew(c, red=True):
    import crews_tiers as CT
    tn, tc = CT.TIERS[min(max(c['tier'], 0), len(CT.TIERS) - 1)]
    ul = _b64(PD.LOGO_CARTEL, 'image/png')
    dato = '<b>%d</b> de %d' % (c['n'], c['max']) + (' · Líder <b>%s</b>' % _e(c['lider']) if c['lider'] else '')
    cuerpo = ('%s<div class="kick"><span>Under</span>%s<span>Legends</span></div><div class="esc">%s</div>'
              '<div class="der"><div class="cw">Crew · Liga Global</div>'
              '<div class="nom" data-fit="880"><span class="eco">%s</span><span class="solido">%s</span></div>'
              '<div class="fila">%s<span class="tier">%s</span></div><div class="dato">%s</div></div><div class="liga"></div>'
              % (_rayas_crew(), ('<img src="%s" alt="">' % ul) if ul else '', _logo_crew(c, red), _e(c['nombre']), _e(c['nombre']),
                 ('<span class="sig">%s</span>' % _e(c['sigla'])) if c['sigla'] else '', _e(tn), dato))
    return ('<!doctype html><html><head><meta charset="utf-8"><style>%s%s</style></head><body>'
            '<div id="c" style="--tc:%s;--tt:%s">%s</div></body></html>') % (_fuentes(), CSS_CREW, tc, tinta(tc), cuerpo)


CSS_LIGA = CSS_SV + """
.velo{background:linear-gradient(90deg,rgba(3,3,4,.95) 0%,rgba(3,3,4,.86) 52%,rgba(3,3,4,.55) 100%)}
.izq{position:absolute;left:64px;top:150px;width:700px}
.mini{display:flex;align-items:center;gap:20px;margin-bottom:22px}
.mini img{width:110px;height:110px;border-radius:50%;border:6px solid var(--c);background:#030304}
.nom{font-size:112px;white-space:normal;line-height:.95}
.estado{font-family:'Barlow Condensed','Archivo',sans-serif;font-weight:700;font-size:40px;letter-spacing:.12em;text-transform:uppercase;
  margin-top:26px;color:#F6F6F6}
.tabla{position:absolute;right:64px;top:110px;width:700px;display:flex;flex-direction:column;gap:12px}
.tabla .t{font-family:'Barlow Condensed','Archivo',sans-serif;font-weight:700;font-size:34px;letter-spacing:.16em;color:var(--c);
  text-transform:uppercase;margin-bottom:4px}
.f{display:grid;grid-template-columns:74px minmax(0,1fr) auto;align-items:center;gap:18px;background:#F6F6F6;color:#030304;
  padding:10px 24px;height:104px}
.f .p{font-family:'UL Cartel','Archivo',sans-serif;font-weight:900;font-size:54px;color:var(--cx)}
.f b{display:block;font-weight:900;font-size:42px;line-height:1.02;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.f span{display:block;font-family:'Barlow Condensed','Archivo',sans-serif;font-weight:700;font-size:28px;color:#55555c}
.f .pts{font-family:'UL Cartel','Archivo',sans-serif;font-weight:900;font-size:58px;text-align:right}
.f.uno{background:var(--c);color:var(--t)}.f.uno span{color:var(--t);opacity:.8}.f.uno .p{color:var(--t)}
.camp{background:#F5C542;color:#030304;padding:22px 28px}
.camp span{display:block;font-family:'Barlow Condensed','Archivo',sans-serif;font-weight:700;font-size:34px;letter-spacing:.16em}
.camp b{display:block;font-family:'UL Cartel','Archivo',sans-serif;font-weight:900;font-size:78px;line-height:1;text-transform:uppercase}
"""


def html_liga(L, d, red=True):
    """La imagen de una liga: la escena de su servidor, su nombre y su tabla (el top 5), en los colores del servidor."""
    esc = _escena_sv(d, red) if d else ''
    col = (d or {}).get('color') or '#29B298'
    logo = _logo_sv(L.get('sv'))
    filas = ''
    for i, f in enumerate((L.get('tabla') or [])[:5]):
        n, jug, gan, pts = (list(f) + [0, 0, 0, 0])[:4]
        filas += ('<div class="f%s"><span class="p">%d</span><div><b>%s</b><span>%d jugadas · %d ganadas</span></div>'
                  '<div class="pts">%s</div></div>') % (' uno' if i == 0 else '', i + 1, _e(_limpio(n)), jug, gan, _mil(pts))
    fin = L.get('fin') or {}
    camp = ('<div class="camp"><span>🏆 CAMPEÓN</span><b>%s</b></div>' % _e(_limpio(fin['c']))) if fin.get('c') else ''
    estado = 'Terminada' if fin.get('c') else ('Jornada %s · ' % L['j'] if L.get('j') else '') + '%d batallas' % int(L.get('bat') or 0)
    cuerpo = ('%s<div class="velo"></div><div class="izq"><div class="mini">%s<span class="kick">Liga · %s</span></div>'
              '<div class="nom" data-fit="700"><span class="solido">%s</span></div><div class="estado">%s</div></div>'
              '<div class="tabla"><div class="t">La tabla</div>%s%s</div><div class="franja"></div>'
              % (('<div class="esc" style="background-image:url(%s)"></div>' % esc) if esc else '<div class="sin"></div>',
                 ('<img src="%s" alt="">' % logo) if logo else '', _e((d or {}).get('sigla') or L.get('sv')), _e(L.get('n')),
                 _e(estado), camp, filas))
    return ('<!doctype html><html><head><meta charset="utf-8"><style>%s%s</style></head><body>'
            '<div id="c" style="--c:%s;--t:%s;--cx:%s">%s</div></body></html>') % (
        _fuentes(), CSS_LIGA, col, tinta(col), col if tinta(col) == BLANCO else NEGRO, cuerpo)


#: después de `PD.ENCAJAR`: el nombre de una liga puede ir en dos renglones; se achica hasta que entre en 330 px de alto
#: y ninguna palabra se salga de su columna (una palabra larga no se parte: «GENERATIONS» pisaba la tabla)
ENCAJAR_ALTO = """() => { for (const g of document.querySelectorAll('.izq .nom')) {
  let fs = parseFloat(getComputedStyle(g).fontSize); for (let i = 0; i < 80 && (g.getBoundingClientRect().height > 330 || g.scrollWidth > g.clientWidth + 1) && fs > 36; i++) {
  fs *= 0.95; g.style.fontSize = fs + 'px'; } } }"""


def dibujar(htmls, carpeta):
    """`{clave: html}` → `{clave: ruta del PNG}`, con UN navegador para todas. Cada `data-fit` se angosta y achica hasta
    entrar (`PD.ENCAJAR`), como los carteles."""
    os.makedirs(carpeta, exist_ok=True)
    if not htmls:
        return {}
    import navegador
    navegador.hace_falta()
    from playwright.sync_api import sync_playwright
    out = {}
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-sandbox'])
        try:
            pg = b.new_page(viewport={'width': 1920, 'height': 1080}, device_scale_factor=1)
            pg.set_default_timeout(60000)
            for k, htm in htmls.items():
                ruta = os.path.join(carpeta, re.sub(r'[^\w.-]+', '_', k) + '.png')
                pg.set_content(htm, wait_until='load', timeout=60000)
                pg.evaluate('() => document.fonts.ready.then(() => true)')
                pg.evaluate(PD.ENCAJAR)
                pg.evaluate(ENCAJAR_ALTO)
                pg.wait_for_timeout(250)
                w, h = pg.evaluate("() => { const r = document.querySelector('#c').getBoundingClientRect();"
                                   " return [Math.ceil(r.width), Math.ceil(r.height)]; }")
                pg.screenshot(path=ruta, clip={'x': 0, 'y': 0, 'width': int(w), 'height': int(h)}, timeout=60000)
                out[k] = ruta
        finally:
            b.close()
    return out


# ── ✍️ los textos ────────────────────────────────────────────────────────────────────────────────────────────────────
def _lista(xs):
    xs = [x for x in xs if x]
    return (', '.join(xs[:-1]) + ' y ' + xs[-1]) if len(xs) > 1 else (xs[0] if xs else '')


def _xmult(m):
    return ('×%s' % ('%g' % float(m))).replace('.', ',')


def texto_sv(d):
    tmp = _temporada()
    L = ['## %s' % _md(d['nombre']), '-# Tier %d de la Liga Global%s · %s' % (d['tier'], (' · ' + _md(d['tag'])) if d['tag'] else '',
                                                                          _md(d['sigla']))]
    L.append(_md(d['desc']) if d['desc'] else 'Servidor socio de la Liga Global: sus eventos y su gente están en el ranking.')
    L.append('')
    L.append('**En la Liga**')
    if d.get('gente'):
        L.append('👥 %s personas en su Discord' % d['gente'])
    if d['eventos']:
        L.append('🎤 **%s** %s en la %s' % (_mil(d['eventos']), 'evento jugado' if d['eventos'] == 1 else 'eventos jugados', tmp))
    if d['suma'] and d['comp']:
        L.append('🏆 Sus eventos suman a la Temporada y cuentan para el Competitivo')
    elif d['suma']:
        L.append('🏆 Sus eventos de %d o más raperos suman a la Temporada' % d['min'])
    else:
        L.append('📅 Sus eventos salen en el calendario y la campana')
    if d['ligas']:
        L.append('🏟️ %s: %s' % ('Su liga' if len(d['ligas']) == 1 else 'Sus ligas', _lista([_md(x) for x in d['ligas']])))
    if d['mult'] and float(d['mult']) != 1:
        L.append('⚡ Esta semana sus eventos valen **%s**' % _xmult(d['mult']))
    redes = [(REDES.get(r.lower()) or r.capitalize(), u) for r, u in d['redes'] if str(u).startswith('https://')]
    if redes:
        L.append('🔗 ' + ' · '.join('[%s](%s)' % (n, u) for n, u in redes))
    return '\n'.join(L)


def texto_crew(c):
    import crews_tiers as CT
    tn = CT.TIERS[min(max(c['tier'], 0), len(CT.TIERS) - 1)][0]
    entra = {'abierta': 'Abierta: entras directo', 'pedido': 'Con pedido: su Líder o un Colíder te acepta',
             'invitacion': 'Sólo por invitación'}.get(c['entrada'], '')
    L = ['## %s%s' % (_md(c['nombre']), ('  `%s`' % c['sigla']) if c['sigla'] else ''),
         '-# Crew de la Liga Global · Tier %s' % tn]
    if c['desc']:
        L.append(_md(c['desc']))
    L.append('')
    L.append('👥 **%d** de %d%s' % (c['n'], c['max'], (' · Líder: **%s**' % _md(c['lider'])) if c['lider'] else ''))
    L.append('🏆 Tier **%s** · esta semana lleva **%s** puntos' % (tn, _mil(c['pts'])))
    if entra:
        L.append('🚪 ' + entra)
    return '\n'.join(L)


def texto_liga(L, d):
    fin = L.get('fin') or {}
    out = ['## %s' % _md(L.get('n')), '-# Liga de %s%s' % (_md((d or {}).get('nombre') or L.get('sv')),
                                                          (' · temporada %s' % L['lt']) if L.get('lt') else '')]
    fmt = ((L.get('info') or {}).get('fmt') or [])[:1]
    if fmt:
        out.append(_md(fmt[0])[:500])
    out.append('')
    if fin.get('c'):
        out.append('🏆 Campeón: **%s**' % _md(_limpio(fin['c'])))
        if fin.get('p'):
            out.append('🥇🥈🥉 ' + ' · '.join(_md(_limpio(x)) for x in fin['p'][:3]))
    else:
        t = L.get('tabla') or []
        if t:
            out.append('👑 Arriba: **%s** con %s puntos' % (_md(_limpio(t[0][0])), _mil(t[0][3])))
        out.append('⚔️ **%d** batallas jugadas%s' % (int(L.get('bat') or 0), (' · %d por jugar' % L['pend']) if L.get('pend') else ''))
        pr = L.get('prox') or {}
        t0 = _iso(pr.get('t'))
        if t0:
            out.append('📅 Próxima fecha: <t:%d:F>' % int(t0.timestamp()))
    return '\n'.join(out)


def _da(claves, minimo):
    return [DA[k][1].replace('{min}', str(minimo)) for k in ORDEN_DA if k in claves and k in DA]


def texto_tiers(svs=None):
    """La fijada de servidores-rap: qué da cada tier (`tiers.reglas()`, con las frases de la página) y quién está en cada uno."""
    import tiers as TI
    R = TI.reglas()
    L = ['## Tiers y beneficios', '-# Los servidores socios de la Liga Global, y lo que gana cada uno', '']
    for t, (nom, antes) in ((3, ('🥉 Tier 3', '')), (2, ('🥈 Tier 2', 'Todo lo del Tier 3 y además: ')),
                            (1, ('🥇 Tier 1', 'Todo lo del Tier 2 y además: '))):
        xs = _da(R['da'].get(str(t)) or [], TI.MIN_SOLO_TEMPORADA)
        L.append('**%s** · se recomiendan %s miembros' % (nom, _mil(R['rec'].get(str(t)))))
        frase = '; '.join(xs)
        L.append(antes + (frase if antes else frase[:1].upper() + frase[1:]) + '.')
        if svs:
            ss = [d['sigla'] for d in svs if d['tier'] == t]
            if ss:
                L.append('-# Hoy: %s' % ' · '.join(ss))
        L.append('')
    L.append('**De todos, en cualquier tier:** sus eventos se promocionan en el calendario, la campana y Publicaciones, '
             'y sus redes salen en Socios.')
    return '\n'.join(L).strip()


def texto_ascenso():
    import tiers as TI
    R = TI.reglas()
    S = TI.SEGUIR
    rec = R['rec']
    return '\n'.join([
        '### 🚀 Cómo sube un servidor de tier',
        '**Tier 3 → Tier 2:** %s.' % R['sube']['2'],
        '**Tier 2 → Tier 1:** %s.' % R['sube']['1'],
        '',
        '**Para quedarse** (las últimas 8 semanas):',
        '· Tier 1: %d eventos con %d raperos por evento de promedio' % (S[1]['eventos'], S[1]['por_evento']),
        '· Tier 2: %d eventos%s' % (S[2]['eventos'], (' y %d de estilo de juego' % S[2]['estilos']) if S[2].get('estilos') else ''),
        '· Tier 3: seguir vivo, un evento o una fecha de liga por mes',
        '',
        '👥 Los miembros de tu Discord no son requisito: se recomiendan %s (Tier 1), %s (Tier 2) y %s (Tier 3).'
        % (_mil(rec['1']), _mil(rec['2']), _mil(rec['3'])),
        'El panel de tu servidor muestra cómo vas —actividad, alcance, calidad y comunidad— y el paso lo decide Dlx.',
    ])


def texto_sumar():
    return '\n'.join([
        '### 🤝 Cómo se suma un servidor a la Liga',
        '**1.** Agrega el bot a tu servidor (botón de abajo).',
        '**2.** Un admin corre **`/setup`** y elige cómo quiere al bot: «Liga completa», «Lo básico» o «Sólo leer». '
        'El bot no crea canales ni roles: sólo la invitación de la Liga a tu servidor.',
        '**3.** Entras como **Tier 3**: tus eventos en el calendario y la campana, tu página en Socios y tus ligas.',
        '**4.** Que tus eventos sumen a la Temporada lo aprueba Dlx. Después subes de tier con tus eventos.',
        '',
        '-# Todo el paso a paso, los comandos y las preguntas, en «Suma tu servidor».',
    ])


def texto_crews_fijo(vivas=None):
    import crews_tiers as CT
    v = vivas or (_j('datos', 'crews_vivas.json') or {})
    return '\n'.join([
        '## Cómo funcionan las crews',
        '-# Un grupo que juega junto, se apoya en las llaves y sube de tier cada semana',
        '',
        '🛡️ **Crear una:** estar verificado (Miembro de DRA) y **%s Puntos de Tienda**. Nombre, sigla, logo o escudo y una '
        'descripción.' % _mil(v.get('precio') or 2500),
        '👥 **Hasta %d por crew.** Líder · Colíder · Veterano · Miembro. El Líder elige cómo se entra: abierta, con pedido o '
        'sólo por invitación.' % int(v.get('max') or 20),
        '🔁 Si sales de una crew, esperas %d días para entrar a otra.' % espera_dias(),
        '🏆 **Tiers:** %s. Cada lunes a las 11 AM ET una crew sube, baja o se mantiene con los puntos de Temporada que hizo '
        'su gente esa semana.' % ' · '.join(t[0] for t in CT.TIERS),
        '💎 En **%s** se desbloquea la tarjeta de crew.' % CT.TIERS[CT.TARJETA][0],
        '',
        '-# Cada publicación de este foro es una crew: tócala para ver cómo entrar y cómo va su semana.',
    ])


def espera_dias():
    """Los días entre crews, de `ESPERA_MS` de bot/crews.js (sin copiarlo)."""
    try:
        m = re.search(r'ESPERA_MS = (\d+) \* DIA', io.open(os.path.join(SCR, 'crews.js'), encoding='utf-8').read())
        return int(m.group(1)) if m else 7
    except OSError:
        return 7


def texto_crear(vivas=None):
    v = vivas or (_j('datos', 'crews_vivas.json') or {})
    return '\n'.join([
        '### 🛡️ Crear una crew',
        '· Estar **verificado** (Miembro de DRA) y tener **%s Puntos de Tienda**.' % _mil(v.get('precio') or 2500),
        '· Se crea en la página: nombre, **sigla** (obligatoria), logo o escudo armado y una descripción de 10 a 160 letras.',
        '· Hasta **%d** por crew. Eliges cómo se entra: abierta, con pedido o sólo por invitación, y si pides una letra o '
        'eventos mínimos.' % int(v.get('max') or 20),
        '· Invita con **`/crew invitar`** o comparte un link con **`/crew link`**.',
        '· Toda crew arranca en Bronce y sube cada lunes con lo que juega su gente.',
    ])


def texto_unirme(c):
    lleno = c['n'] >= c['max']
    req = c.get('req') or {}
    L = ['### ➕ Cómo entrar a %s' % _md(c['nombre'])]
    if lleno:
        L.append('Está llena (%d de %d): cuando se libere un lugar, podrás pedir entrar.' % (c['n'], c['max']))
    elif c['entrada'] == 'abierta':
        L.append('Es **abierta**: entras directo con el botón de abajo o con `/crew unirme`.')
    elif c['entrada'] == 'invitacion':
        L.append('Es **sólo por invitación**: pídele a alguien de la crew (Líder, Colíder o Veterano) que te invite con '
                 '`/crew invitar`.')
    else:
        L.append('Es **con pedido**: lo pides con el botón de abajo (o `/crew unirme`) y su Líder o un Colíder te acepta.')
    pide = [('rango **%s** o más' % _md(req['rg'])) if req.get('rg') else '',
            ('**%d** eventos en la temporada' % int(req['ev'])) if req.get('ev') else '']
    if any(pide):
        L.append('Pide %s.' % _lista(pide))
    L.append('')
    L.append('-# Para estar en una crew tienes que estar verificado (Miembro de DRA). Si sales de una, esperas %d días para '
             'entrar a otra.' % espera_dias())
    return '\n'.join(L)


def pedir_vale(c):
    return c['n'] < c['max'] and c['entrada'] in ('abierta', 'pedido')


def texto_tier_crew(c=None):
    import crews_tiers as CT
    T = CT.TIERS
    if not c:
        return '\n'.join(['### 📈 Cómo suben las crews', 'Cada lunes a las 11 AM ET, con los puntos de Temporada que hizo su '
                          'gente esa semana:'] + ['· **%s → %s:** %s puntos y %d jugando' % (T[i][0], T[i + 1][0], _mil(CT.SUBE[i]),
                                                                                           CT.JUEGAN[i + 1])
                                                 for i in range(len(T) - 1)] + ['', '-# Con poco, bajan: una crew que no juega, baja.'])
    t = min(max(c['tier'], 0), len(T) - 1)
    L = ['### 📈 %s y su tier' % _md(c['nombre']),
         'Está en **%s**. Esta semana lleva **%s** puntos y jugaron **%d** de la crew.' % (T[t][0], _mil(c['pts']), c['jugaron'])]
    if t < len(T) - 1 and CT.SUBE[t]:
        L.append('📈 Sube a **%s** con **%s** puntos en la semana y al menos **%d** jugando.' % (T[t + 1][0], _mil(CT.SUBE[t]),
                                                                                              CT.JUEGAN[t + 1]))
    else:
        L.append('👑 Ya está en lo más alto.')
    if t > 0 and CT.BAJA[t]:
        L.append('📉 Baja a **%s** con menos de **%s**.' % (T[t - 1][0], _mil(CT.BAJA[t])))
    L.append('')
    L.append('-# La semana cierra el lunes a las 11 AM ET. Suman los puntos de Temporada que hace su gente esa semana.')
    return '\n'.join(L)


def texto_tabla(L, d):
    t = L.get('tabla') or []
    out = ['### 📋 %s' % _md(L.get('n')), '-# Liga de %s%s' % (_md((d or {}).get('nombre') or L.get('sv')),
                                                              (' · jornada %s' % L['j']) if L.get('j') else '')]
    for i, f in enumerate(t[:10]):
        n, jug, gan, pts = (list(f) + [0, 0, 0, 0])[:4]
        out.append('%s **%s** · %s pts (%d de %d)' % (MEDALLA.get(i + 1, '`%d.`' % (i + 1)), _md(_limpio(n)), _mil(pts), gan, jug))
    if (L.get('fin') or {}).get('c'):
        out.append('')
        out.append('🏆 Campeón: **%s**' % _md(_limpio(L['fin']['c'])))
    return '\n'.join(out)


# ── 🧱 las publicaciones ─────────────────────────────────────────────────────────────────────────────────────────────
def _boton(etiqueta, url=None, cid=None, emoji=None):
    b = {'type': 2, 'label': etiqueta[:80]}
    if url:
        b.update(style=5, url=url)
    else:
        b.update(style=2, custom_id=cid[:100])
    if emoji:
        b['emoji'] = {'name': emoji}
    return b


def publicaciones(svs, cws, ligas, estado=None, red=True):
    """`[{foro, k, titulo, tags, fijar, html, alt, texto, color, botones, extra}]`: todo lo que tiene que haber en los
    tres foros. Pura salvo los HTML, que leen imágenes del repo (`red=False` en el self-check)."""
    estado = estado or {}
    out = []
    por_sv = {d['sv']: d for d in svs}
    out.append({'foro': 'sv', 'k': '_fijo', 'titulo': '📌 Tiers y beneficios', 'tags': ['Información'], 'fijar': True,
                'html': PD.html_cartel('Servidores socios', 'Tiers', 'Cómo sumarte y subir'), 'alt': 'Tiers y beneficios',
                'texto': texto_tiers(svs), 'color': _hex(MAGENTA), 'extra': '',
                'botones': [_boton('Cómo ascender de tier', cid='fo:tiers', emoji='🚀'),
                            _boton('Sumar mi servidor', cid='fo:sumar', emoji='🤝'),
                            _boton('Suma tu servidor', url=WEB + '/socios/sumar', emoji='🌐')]})
    for d in svs:
        bot = [_boton('Unirme', url=d['invita'], emoji='🚪') if d['invita'] else None,
               _boton('Su página', url=d['pagina'], emoji='🌐'),
               _boton('Sus próximos eventos', cid='fo:ev:' + d['sv'], emoji='📅')]
        out.append({'foro': 'sv', 'k': d['sv'], 'titulo': '[%s] %s' % (d['sigla'], d['nombre']), 'tags': [TAG_TIER[d['tier']]],
                    'fijar': False, 'html': html_sv(d, red), 'alt': '%s · Tier %d de la Liga Global' % (d['nombre'], d['tier']),
                    'texto': texto_sv(d), 'color': _hex(d['color']), 'extra': '', 'botones': [b for b in bot if b]})
    import crews_tiers as CT
    out.append({'foro': 'crews', 'k': '_fijo', 'titulo': '📌 Cómo funcionan las crews', 'tags': [], 'fijar': True,
                'html': PD.html_cartel('Cómo funcionan las', 'Crews', 'Arma la tuya · sube de tier'), 'alt': 'Cómo funcionan las crews',
                'texto': texto_crews_fijo(), 'color': _hex(VERDE), 'extra': '',
                'botones': [_boton('Crear una crew', cid='fo:cr', emoji='🛡️'), _boton('Los tiers', cid='fo:ct:_', emoji='📈'),
                            _boton('Las crews', url=WEB + '/crews', emoji='🌐')]})
    for c in cws:
        tn, tc = CT.TIERS[min(max(c['tier'], 0), len(CT.TIERS) - 1)]
        out.append({'foro': 'crews', 'k': c['id'], 'titulo': ('[%s] %s' % (c['sigla'], c['nombre'])) if c['sigla'] else c['nombre'],
                    'tags': [tn], 'fijar': False, 'html': html_crew(c, red), 'alt': 'La crew %s, tier %s' % (c['nombre'], tn),
                    'texto': texto_crew(c), 'color': _hex(tc), 'extra': '',
                    'botones': [_boton('Ver la crew', url=c['pagina'], emoji='👥'),
                                _boton('Cómo unirme', cid='fo:cu:' + c['id'], emoji='➕'),
                                _boton('Cómo sube de tier', cid='fo:ct:' + c['id'], emoji='📈')]})
    ya = (estado.get('ligas') or {})
    for L in ligas or []:
        if not (es_activa(L) or L.get('id') in ya):
            continue
        d = por_sv.get(L.get('sv'))
        if d is None and L.get('id') not in ya:
            continue                                     # una liga de un servidor que ya no es socio no se abre
        terminada = bool((L.get('fin') or {}).get('c') or L.get('cerrada'))
        bot = [_boton('Ver la tabla', cid='fo:lt:' + L['id'], emoji='📋'),
               _boton('La liga', url=WEB + '/ligas/' + L['id'], emoji='🏟️'),
               _boton('Su servidor', url=d['pagina'], emoji='🌐') if d else None]
        fl = (L.get('flyer') or {}).get('u') or ''
        out.append({'foro': 'ligas', 'k': L['id'], 'titulo': '[%s] %s' % ((d or {}).get('sigla') or L.get('sv'), _limpio(L.get('n'))),
                    'tags': ['Terminada' if terminada else 'En juego'], 'fijar': False, 'html': html_liga(L, d, red),
                    'alt': 'La tabla de %s' % _limpio(L.get('n')), 'texto': texto_liga(L, d),
                    'color': _hex((d or {}).get('color') or VERDE), 'extra': fl if fl.startswith('https://') else '',
                    'botones': [b for b in bot if b]})
    return out


def info(svs, cws, ligas, ahora=None):
    """Lo que leen los botones del Worker (`bot/foros.js`), a R2. Textos armados acá, con las reglas de verdad."""
    pr = proximos(ahora)
    por_sv = {d['sv']: d for d in svs}
    return {
        'v': 1, 'tiers': texto_ascenso(), 'sumar': texto_sumar(), 'crear': texto_crear(), 'crews_tiers': texto_tier_crew(None),
        'bot': BOT_LINK, 'guia_sumar': WEB + '/socios/sumar',
        'sv': {d['sv']: {'n': d['nombre'], 'p': d['pagina'], 'ev': pr.get(d['sv']) or []} for d in svs},
        'crews': {c['id']: {'n': c['nombre'], 'p': c['pagina'], 'unir': texto_unirme(c), 'pedir': pedir_vale(c),
                            'tier': texto_tier_crew(c)} for c in cws},
        'ligas': {L['id']: {'n': L.get('n'), 'p': WEB + '/ligas/' + L['id'], 'tabla': texto_tabla(L, por_sv.get(L.get('sv')))}
                  for L in ligas or []},
    }


def botones_finales(botones, worker=None):
    """Sin el Worker desplegado (`WORKER_LISTO`), sólo los de link."""
    worker = WORKER_LISTO if worker is None else worker
    return [b for b in botones if worker or b.get('style') == 5][:5]


def cuerpo(p, url_img, worker=None):
    """El mensaje V2 de una publicación: un recuadro con su color, la imagen (y el afiche, si hay), el texto y los botones."""
    galeria = [{'media': {'url': url_img}, 'description': p['alt'][:1000]}]
    if p.get('extra'):
        galeria.append({'media': {'url': p['extra']}, 'description': 'El afiche'})
    dentro = [{'type': 12, 'items': galeria}, {'type': 10, 'content': p['texto'][:3800]}]
    bs = botones_finales(p['botones'], worker)
    if bs:
        dentro += [{'type': 14, 'divider': True, 'spacing': 1}, {'type': 1, 'components': bs}]
    return {'flags': 32768, 'components': [{'type': 17, 'accent_color': p['color'], 'components': dentro}],
            'allowed_mentions': {'parse': []}}


def img_h(p):
    return _h(p['html'], 10)


def firma(p, worker=None):
    """La huella de todo lo que se ve. Sin la hora: un ciclo quieto no edita nada."""
    return _h([VERSION, p['titulo'], sorted(p['tags']), p['texto'], botones_finales(p['botones'], worker), img_h(p),
               p.get('extra') or '', p['color'], bool(p['fijar'])])


def plan(posts, estado, worker=None):
    """`[(accion, post)]`: `crear` lo que no tiene hilo, `editar` lo que cambió, `igual` el resto. Nunca crea dos veces lo
    mismo: con hilo guardado se EDITA. Pura."""
    out = []
    for p in posts:
        e = ((estado or {}).get(p['foro']) or {}).get(p['k']) or {}
        if not e.get('hilo'):
            out.append(('crear', p))
        elif e.get('firma') != firma(p, worker):
            out.append(('editar', p))
        else:
            out.append(('igual', p))
    return out


def limites(p, worker=True):
    """Lo que Discord rechazaría (el mensaje entero): `[problema]`."""
    mal = []
    if not (1 <= len(p['titulo']) <= 100):
        mal.append('título de %d letras' % len(p['titulo']))
    if len(p['texto']) > 3800:
        mal.append('texto de %d letras' % len(p['texto']))
    bs = botones_finales(p['botones'], worker)
    if len(p['botones']) > 5:
        mal.append('%d botones' % len(p['botones']))
    for b in bs:
        if len(b['label']) > 80:
            mal.append('etiqueta larga')
        cid = b.get('custom_id')
        if cid is not None and (len(cid) > 100 or not re.match(r'^fo:(%s)(:[^:]{1,80})?$' % '|'.join(QUE), cid)):
            mal.append('custom_id «%s»' % cid)
        if b.get('url') is not None and not str(b['url']).startswith('https://'):
            mal.append('link «%s»' % b['url'])
    if len(p['tags']) > 5:
        mal.append('más de 5 etiquetas')
    return mal


def tag_ids(nombres, disponibles):
    """Las etiquetas por nombre → sus ids del foro (NFKD, como `PD._n`). Las que no existen no van. Pura."""
    por = {PD._n(t.get('name')): t.get('id') for t in disponibles or [] if t.get('id')}
    return [por[PD._n(n)] for n in nombres if PD._n(n) in por]


# ── 🌐 Discord y R2 ──────────────────────────────────────────────────────────────────────────────────────────────────
def _pedir(metodo, url, **kw):
    """Un pedido a Discord que respeta el 429 (espera `retry_after` y repite, hasta tres veces)."""
    import requests
    for _ in range(4):
        r = requests.request(metodo, url, timeout=60, **kw)
        if r.status_code != 429:
            return r
        try:
            espera = float(r.json().get('retry_after') or 2)
        except ValueError:
            espera = 2
        time.sleep(min(espera, 30) + 0.3)
    return r


def _cab():
    import avisar as AV
    tok = AV._token()
    return {'Authorization': 'Bot ' + tok} if tok else None


def leer_discord(h):
    """`{foro: {canal, tags, hilos}}` de los tres foros, sólo leyendo."""
    rc = _pedir('GET', '%s/guilds/%s/channels' % (API, GUILD), headers=h)
    canales = rc.json() if rc.status_code == 200 else []
    act = _pedir('GET', '%s/guilds/%s/threads/active' % (API, GUILD), headers=h)
    activos = (act.json() or {}).get('threads') or [] if act.status_code == 200 else []
    out = {}
    for k, sfx in FOROS.items():
        c = PD.canal_de(canales, sfx) if canales else None
        if not c or c.get('type') != 15:
            out[k] = None
            continue
        hs = [t for t in activos if t.get('parent_id') == c['id']]
        ra = _pedir('GET', '%s/channels/%s/threads/archived/public?limit=100' % (API, c['id']), headers=h)
        if ra.status_code == 200:
            hs += (ra.json() or {}).get('threads') or []
        out[k] = {'canal': c, 'tags': c.get('available_tags') or [], 'hilos': hs}
    return out


def viejos(foro, bot_id, svs):
    """🗄️ Las publicaciones que no son del bot en servidores-rap, con a qué socio de hoy se parecen: la lista para Dlx."""
    if not foro:
        return []
    def norm(s):
        return PD._n(re.sub(r'[^\w\s]', ' ', str(s or '')))
    out = []
    for t in foro['hilos']:
        if t.get('owner_id') == bot_id:
            continue
        n = norm(t.get('name'))
        socio = next((d['sigla'] for d in svs if norm(d['nombre']) and (norm(d['nombre']) in n or n in norm(d['nombre']))), '')
        if not socio and 'info' in n:
            socio = 'INFO'                               # la de tiers de mayo, de Dlx
        elif not socio and 'underlegends' in n:
            socio = 'DRA'                                # la casa: no lleva publicación nueva
        meta = t.get('thread_metadata') or {}
        out.append({'id': t['id'], 'nombre': t.get('name'), 'socio': socio, 'fijada': bool(int(t.get('flags') or 0) & 2),
                    'archivada': bool(meta.get('archived')), 'cerrada': bool(meta.get('locked'))})
    return out


def subir_r2(clave, datos, tipo):
    import subir_cartas as SC
    r = SC.sesion().put('%s/objects/%s' % (SC.API, clave), data=datos, headers={'Content-Type': tipo}, timeout=60)
    return ('%s/%s' % (SC.PUBLICA, clave)) if SC._ok(r, clave) is not None else None


def url_img(p):
    import subir_cartas as SC
    return '%s/%s%s/%s-%s.png' % (SC.PUBLICA, R2_DIR, p['foro'], re.sub(r'[^a-z0-9]+', '-', PD._n(p['k']) or 'x'), img_h(p))


def _leer_estado():
    e = _j('datos', 'foros_dra.json') or {}
    for k in FOROS:
        e.setdefault(k, {})
    return e


def _guardar_estado(e):
    with io.open(ESTADO, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(e, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write('\n')


def armar(red=True):
    """Todo lo que hace falta para un plan: `(posts, info, svs, cws, ligas)`."""
    pg = paginas_socios() if red else {}
    dc = discord_info() if red else {}
    lg = ligas_web()
    svs = socios(pg, lg or [], dc=dc)
    cws = crews()
    estado = _leer_estado()
    return publicaciones(svs, cws, lg or [], estado), info(svs, cws, lg or []), svs, cws, lg


def _imprimir_plan(pl, est=None):
    n = {'crear': 0, 'editar': 0, 'igual': 0}
    for acc, p in pl:
        n[acc] += 1
        if acc != 'igual':
            print('  %-7s %-6s %-26s %s%s' % (acc, p['foro'], p['k'][:26], p['titulo'], '  📌' if p['fijar'] else ''))
    print('\n  → crear %d · editar %d · sin tocar %d' % (n['crear'], n['editar'], n['igual']))
    return n


def ver():
    """El plan contra Discord, sólo leyendo."""
    h = _cab()
    posts, inf, svs, _c, _l = armar(True)
    estado = _leer_estado()
    pl = plan(posts, estado)
    print('🗂️ los foros de DRA — el plan (no se toca nada)\n')
    _imprimir_plan(pl)
    if not h:
        print('\n  (sin token: no miré Discord)')
        return 0
    D = leer_discord(h)
    me = _pedir('GET', API + '/users/@me', headers=h).json().get('id')
    for k in FOROS:
        F = D.get(k)
        if not F:
            print('\n  ⚠️ no encontré el foro «%s»' % FOROS[k])
            continue
        tienen = {PD._n(t.get('name')) for t in F['tags']}
        faltan = sorted({t for acc, p in pl if p['foro'] == k for t in p['tags'] if PD._n(t) not in tienen})
        fij = [t.get('name') for t in F['hilos'] if int(t.get('flags') or 0) & 2]
        print('\n  %s (%s): %d publicaciones hoy · fijada: %s%s' % (F['canal'].get('name'), F['canal']['id'], len(F['hilos']),
                                                                  ', '.join(fij) or 'ninguna',
                                                                  (' · etiquetas que faltan: %s (con --etiquetas)' % ', '.join(faltan)) if faltan else ''))
    vs = viejos(D.get('sv'), me, svs)
    if vs:
        print('\n  🗄️ las publicaciones viejas de servidores-rap (de Dlx; el bot no las puede editar):')
        for v in vs:
            que = {'INFO': 'la info de tiers vieja', 'DRA': 'es DRA, la casa'}.get(v['socio']) or (('→ hoy socio %s' % v['socio']) if v['socio'] else 'ya no es socio')
            print('     %s  %-44s %s%s%s' % (v['id'], v['nombre'][:44], que,
                                           ' · 📌 fijada' if v['fijada'] else '', ' · archivada' if v['archivada'] else ''))
    print('\n  info para los botones: %d socios, %d crews, %d ligas (paneles/foros/info.json, %s)'
          % (len(inf['sv']), len(inf['crews']), len(inf['ligas']), 'igual' if estado.get('info_h') == _h(inf) else 'cambia'))
    return 0


def aplicar():
    est = _leer_estado()
    prender = '--prender' in sys.argv
    if not (ENCENDIDO or est.get('prendido') or prender):
        print('  🗂️ los foros de DRA están apagados hasta que Dlx apruebe la vista previa (--aplicar --prender la primera vez)')
        return 0
    if PD.madrugada() and '--ya' not in sys.argv:
        print('  🌙 de 3 a 11 AM ET no se tocan los foros')
        return 0
    t0 = _iso(est.get('t'))
    if t0 and (_ahora() - t0).total_seconds() < CADA_MIN * 60 and '--ya' not in sys.argv:
        print('  los foros se miraron hace menos de %d minutos: hasta la próxima' % CADA_MIN)
        return 0
    h = _cab()
    if not h:
        print('Falta el token del bot.')
        return 1
    hj = dict(h, **{'Content-Type': 'application/json'})
    try:
        import crews_tiers as CT
        import multiplicadores as _M
        CT.usar_reglas(_M.ajustes_dueno())
    except Exception:                                    # noqa: BLE001
        pass
    posts, inf, svs, _c, lg = armar(True)
    if lg is None:
        posts = [p for p in posts if p['foro'] != 'ligas']
    D = leer_discord(h)
    est['prendido'] = True
    # 1 · lo que leen los botones, primero: una publicación nueva no puede tener un botón que todavía no sabe contestar
    hi = _h(inf)
    if est.get('info_h') != hi:
        if subir_r2(INFO_R2, json.dumps(inf, ensure_ascii=False).encode('utf-8'), 'application/json; charset=utf-8'):
            est['info_h'] = hi
            print('  ✓ info de los botones en R2')
    # 2 · las etiquetas que faltan (sólo con --etiquetas)
    if '--etiquetas' in sys.argv:
        for k, nuevas in ETIQUETAS_NUEVAS.items():
            F = D.get(k)
            if not F:
                continue
            tienen = {PD._n(t.get('name')) for t in F['tags']}
            suma = [{'name': n} for n in nuevas if PD._n(n) not in tienen]
            if suma and len(F['tags']) + len(suma) <= 20:
                r = _pedir('PATCH', '%s/channels/%s' % (API, F['canal']['id']), headers=hj,
                           json={'available_tags': [{'id': t['id'], 'name': t['name']} for t in F['tags']] + suma})
                if r.status_code == 200:
                    F['tags'] = r.json().get('available_tags') or F['tags']
                    print('  ✓ %s: etiquetas %s' % (k, ', '.join(x['name'] for x in suma)))
    import tempfile
    carpeta = tempfile.mkdtemp()
    hechos = 0
    for acc, p in plan(posts, est):
        if acc == 'igual':
            continue
        F = D.get(p['foro'])
        if not F:
            print('  %-6s %-20s sin foro: no se toca' % (p['foro'], p['k']))
            continue
        e = est[p['foro']].get(p['k']) or {}
        url = e.get('img') if e.get('img_h') == img_h(p) else None
        if not url:
            png = dibujar({p['k']: p['html']}, carpeta)[p['k']]
            url = subir_r2(url_img(p).split('.r2.dev/')[1], open(png, 'rb').read(), 'image/png')
            if not url:
                print('  %-6s %-20s ✗ la imagen no subió a R2: queda como estaba' % (p['foro'], p['k']))
                continue
        msg = cuerpo(p, url)
        tags = tag_ids(p['tags'], F['tags'])
        ok, hilo, mid = False, e.get('hilo'), e.get('msg')
        if hilo:
            r = _pedir('PATCH', '%s/channels/%s/messages/%s' % (API, hilo, mid), headers=hj, json=msg)
            if r.status_code == 400 and '50083' in r.text:          # hilo archivado: se abre y se vuelve a intentar
                _pedir('PATCH', '%s/channels/%s' % (API, hilo), headers=hj, json={'archived': False})
                r = _pedir('PATCH', '%s/channels/%s/messages/%s' % (API, hilo, mid), headers=hj, json=msg)
            if r.status_code == 404:
                print('  %-6s %-20s el hilo ya no está: se vuelve a crear' % (p['foro'], p['k']))
                hilo = None
            elif r.status_code == 200:
                ok = True
                if e.get('titulo') != p['titulo'] or e.get('tags') != tags:
                    _pedir('PATCH', '%s/channels/%s' % (API, hilo), headers=hj,
                           json={'name': p['titulo'][:100], 'applied_tags': tags, 'archived': False})
            else:
                print('  %-6s %-20s ✗ %s %s' % (p['foro'], p['k'], r.status_code, r.text[:160]))
                continue
        if not hilo:
            r = _pedir('POST', '%s/channels/%s/threads' % (API, F['canal']['id']), headers=hj,
                       json={'name': p['titulo'][:100], 'applied_tags': tags, 'auto_archive_duration': 10080, 'message': msg})
            if r.status_code not in (200, 201):
                print('  %-6s %-20s ✗ %s %s' % (p['foro'], p['k'], r.status_code, r.text[:160]))
                continue
            j = r.json()
            hilo, mid, ok = j.get('id'), (j.get('message') or {}).get('id') or j.get('id'), True
            if p['fijar']:
                otros = [t for t in F['hilos'] if int(t.get('flags') or 0) & 2 and t.get('id') != hilo]
                if otros and '--desfijar-viejo' not in sys.argv:
                    print('  %-6s %-20s ⚠️ sin fijar: ya está fijada «%s» (--desfijar-viejo)' % (p['foro'], p['k'], otros[0].get('name')))
                else:
                    for t in otros:
                        _pedir('PATCH', '%s/channels/%s' % (API, t['id']), headers=hj, json={'flags': int(t.get('flags') or 0) & ~2})
                    _pedir('PATCH', '%s/channels/%s' % (API, hilo), headers=hj, json={'flags': 2})
        if ok:
            est[p['foro']][p['k']] = {'hilo': hilo, 'msg': mid, 'firma': firma(p), 'img': url, 'img_h': img_h(p),
                                      'titulo': p['titulo'], 'tags': tags, 't': _ahora().strftime('%Y-%m-%dT%H:%M:%SZ')}
            hechos += 1
            print('  %-6s %-20s ✓ %s' % (p['foro'], p['k'], 'editada' if acc == 'editar' and e.get('hilo') == hilo else 'publicada'))
            _guardar_estado(est)                         # de a una: un corte a mitad no deja publicaciones sin dueño
        time.sleep(1.2)
    est['t'] = _ahora().strftime('%Y-%m-%dT%H:%M:%SZ')
    _guardar_estado(est)
    print('  🗂️ foros de DRA: %d publicaciones tocadas' % hechos)
    return 0


# ── 👀 la vista previa ───────────────────────────────────────────────────────────────────────────────────────────────
def _md_html(t):
    """Un markdown de Discord, más o menos como se ve (sólo para la vista previa)."""
    out = []
    for l in str(t).split('\n'):
        x = _e(l)
        x = re.sub(r'\[([^\]]+)\]\((https?://[^)]+)\)', r'<a href="\2">\1</a>', x)
        x = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', x)
        x = re.sub(r'`([^`]+)`', r'<code>\1</code>', x)
        x = re.sub(r'&lt;t:(\d+):[A-Za-z]&gt;', lambda m: dt.datetime.fromtimestamp(int(m.group(1)), PD._et().tzinfo)
                   .strftime('%d/%m %I:%M %p ET'), x)
        if x.startswith('## '):
            out.append('<h2>%s</h2>' % x[3:])
        elif x.startswith('### '):
            out.append('<h3>%s</h3>' % x[4:])
        elif x.startswith('-# '):
            out.append('<small>%s</small>' % x[3:])
        else:
            out.append('<p>%s</p>' % (x or '&nbsp;'))
    return ''.join(out)


CSS_VISTA = """body{background:#313338;color:#dbdee1;font-family:system-ui,sans-serif;margin:0;padding:24px}
h1{color:#fff;font-size:22px}.foro{color:#fff;margin:28px 0 8px;font-size:20px}
.post{max-width:620px;margin:18px 0 34px}.tit{color:#fff;font-weight:700;font-size:17px;margin-bottom:4px}
.tags span{display:inline-block;background:#404249;border-radius:10px;padding:2px 9px;font-size:12px;margin-right:5px}
.caja{background:#2b2d31;border-left:4px solid;border-radius:6px;padding:12px;margin-top:8px}
.gal{display:flex;gap:4px}.gal img{width:100%;border-radius:4px;min-width:0}.gal img.af{width:30%;object-fit:cover}
.caja h2{font-size:20px;color:#fff;margin:10px 0 2px}.caja h3{font-size:16px;color:#fff;margin:8px 0 2px}.caja p{margin:2px 0;font-size:14.5px}
.caja small{display:block;color:#949ba4;font-size:12.5px}.caja a{color:#00a8fc;text-decoration:none}
code{background:#1e1f22;padding:1px 4px;border-radius:3px}
.bs{border-top:1px solid #3f4147;margin-top:10px;padding-top:10px;display:flex;flex-wrap:wrap;gap:8px}
.bs span{background:#4e5058;color:#fff;border-radius:4px;padding:6px 12px;font-size:14px}.bs span.w{opacity:.55;outline:1px dashed #f0b232}
.nota{color:#949ba4;font-size:13px}.ef{background:#1e1f22;border-radius:6px;padding:10px 12px;margin:8px 0 0 18px;font-size:13.5px}
.ef b.t{color:#949ba4;font-size:11px;display:block;margin-bottom:4px}"""


def _efimeras(p, inf):
    """Lo que contesta cada botón de acción, para la vista previa (lo mismo que arma `respuesta()` de bot/foros.js)."""
    out = []
    for b in p['botones']:
        cid = b.get('custom_id') or ''
        partes = cid.split(':')
        que, arg = (partes[1] if len(partes) > 1 else ''), (partes[2] if len(partes) > 2 else '')
        t = ''
        if que in ('tiers', 'sumar', 'crear'):
            t = inf.get(que) or ''
        elif que == 'cr':
            t = inf['crear']
        elif que == 'ev':
            evs = (inf['sv'].get(arg) or {}).get('ev') or []
            t = ('### 📅 Los próximos eventos de %s\n' % (inf['sv'].get(arg) or {}).get('n', arg)
                 + ('\n'.join('**%s** · <t:%d:F>' % (n, u) for n, u, _l in evs) if evs else 'No tiene eventos anunciados ahora.'))
        elif que == 'cu':
            t = (inf['crews'].get(arg) or {}).get('unir', '') + ('\n[Pedir entrar]' if (inf['crews'].get(arg) or {}).get('pedir') else '')
        elif que == 'ct':
            t = inf['crews_tiers'] if arg == '_' else (inf['crews'].get(arg) or {}).get('tier', '')
        elif que == 'lt':
            t = (inf['ligas'].get(arg) or {}).get('tabla', '')
        if t:
            out.append('<div class="ef"><b class="t">al tocar «%s» (sólo lo ve quien toca)</b>%s</div>' % (_e(b['label']), _md_html(t)))
    return ''.join(out)


def vista(carpeta):
    os.makedirs(carpeta, exist_ok=True)
    posts, inf, svs, cws, lg = armar(True)
    estado = _leer_estado()
    pngs = dibujar({'%s__%s' % (p['foro'], p['k']): p['html'] for p in posts}, carpeta)
    secciones = {'sv': '〢🌎〉servidores-rap', 'crews': '🛡️˚┊crews', 'ligas': '〢🏟️〉ligas'}
    partes = []
    for k, nom in secciones.items():
        cards = []
        for p in [x for x in posts if x['foro'] == k]:
            img = os.path.basename(pngs['%s__%s' % (p['foro'], p['k'])])
            bs = ''.join('<span class="%s">%s%s</span>' % ('' if b.get('style') == 5 else 'w', (b.get('emoji') or {}).get('name', '') + ' ',
                                                         _e(b['label'])) for b in p['botones'])
            mal = limites(p)
            cards.append('<div class="post"><div class="tit">%s%s</div><div class="tags">%s</div><div class="caja" style="border-color:#%06x">'
                         '<div class="gal"><img src="%s">%s</div>%s<div class="bs">%s</div></div>%s%s</div>' % (
                             _e(p['titulo']), ' 📌' if p['fijar'] else '', ''.join('<span>%s</span>' % _e(t) for t in p['tags']),
                             p['color'], img, ('<img class="af" src="%s">' % _e(p['extra'])) if p['extra'] else '',
                             _md_html(p['texto']), bs, _efimeras(p, inf),
                             ('<p class="nota">⚠️ %s</p>' % _e('; '.join(mal))) if mal else ''))
        partes.append('<h2 class="foro">%s · %d publicaciones</h2>%s' % (nom, len(cards), ''.join(cards)))
    doc = ('<!doctype html><html><head><meta charset="utf-8"><title>Foros de DRA</title><style>%s</style></head><body>'
           '<h1>Los foros de DRA — vista previa</h1><p class="nota">Los botones punteados los atiende el Worker '
           '(bot/foros.js): salen cuando esté desplegado. Debajo de cada publicación, lo que contesta cada uno.</p>%s</body></html>'
           % (CSS_VISTA, ''.join(partes)))
    ruta = os.path.join(carpeta, 'foros.html')
    with io.open(ruta, 'w', encoding='utf-8') as f:
        f.write(doc)
    with io.open(os.path.join(carpeta, 'info.json'), 'w', encoding='utf-8') as f:
        json.dump(inf, f, ensure_ascii=False, indent=1)
    with io.open(os.path.join(carpeta, 'payloads.json'), 'w', encoding='utf-8') as f:
        json.dump([{'foro': p['foro'], 'k': p['k'], 'titulo': p['titulo'], 'tags': p['tags'], 'fijar': p['fijar'],
                    'mensaje': cuerpo(p, url_img(p), worker=True)} for p in posts], f, ensure_ascii=False, indent=1)
    print('🗂️ vista previa: %s (%d imágenes)\n' % (ruta, len(pngs)))
    _imprimir_plan(plan(posts, estado))
    return 0


# ── ✅ el self-check ─────────────────────────────────────────────────────────────────────────────────────────────────
def _self_check():
    mal = 0

    def ok(c, que):
        nonlocal mal
        print('  %s %s' % ('✓' if c else '✗', que))
        if not c:
            mal += 1

    # el escudo, con los catálogos de la página
    C = _esc_cat()
    ok(C.get('FORMAS') and len(C['FORMAS']) >= 8 and C.get('SIMBOLOS') and C.get('COLORES') and C.get('FORMAS_ANTES'),
       'los catálogos del escudo se leen de web/src/escudo.jsx (%d formas, %d símbolos)' % (len(C.get('FORMAS') or {}), len(C.get('SIMBOLOS') or {})))
    e = leer_escudo('esc:circulo.estrella.e5484d.29b298')
    ok(e and e['forma'] == 'circulo' and e['div'] == 'liso' and '<svg' in svg_escudo(e), 'un escudo corto se lee y se dibuja')
    e2 = leer_escudo('esc:circulo.calavera.2f6fdb.e5484d.franja.fino.f6f6f6')
    ok(e2 and e2['div'] == 'franja' and e2['c'] == 'f6f6f6', 'y uno largo, con su división')
    ok(leer_escudo('https://x/y.webp') is None and leer_escudo('esc:nada.estrella.e5484d.29b298') is None, 'lo que no es escudo, no')
    ok(del_nombre('Follombia') == del_nombre(' follombia ') and del_nombre('KS') != del_nombre('Follombia'),
       'el escudo del nombre es siempre el mismo')
    # las frases de los tiers, iguales en claves y tipo a las de la página
    try:
        jsx = io.open(os.path.join(BASE, 'web', 'src', 'sumar2.jsx'), encoding='utf-8').read()
        bloque = re.search(r'const DA = \{(.*?)\n\};', jsx, re.S).group(1)
        web = dict(re.findall(r"^\s+(\w+): \['(cuenta|tiene)'", bloque, re.M))
        ok(web == {k: v[0] for k, v in DA.items()}, 'DA es la de web/src/sumar2.jsx (%d frases)' % len(web))
    except (OSError, AttributeError):
        ok(False, 'no pude leer DA de web/src/sumar2.jsx')
    import tiers as TI
    da = TI.reglas()['da']
    ok(all(k in DA for t in da.values() for k in t), 'cada beneficio de tiers.reglas() tiene su frase')
    # las etiquetas
    disp = [{'id': '1', 'name': 'Tier 1'}, {'id': '2', 'name': 'Tier 2'}, {'id': '3', 'name': 'Tier 3'},
            {'id': '9', 'name': 'Información'}, {'id': '7', 'name': 'Hermandad'}]
    ok(tag_ids(['Tier 2'], disp) == ['2'] and tag_ids(['informacion'], disp) == ['9'] and tag_ids(['Platino'], disp) == [],
       'las etiquetas: por nombre (sin tildes ni mayúsculas); la que no existe no va')
    # los datos y las publicaciones, sin red
    svs = socios({}, [])
    ok(svs and all(d['tier'] in (1, 2, 3) for d in svs) and 'DRA' not in {d['sv'] for d in svs},
       '%d socios, cada uno con su tier; DRA no (es la casa)' % len(svs))
    ok(not ({d['sv'] for d in svs} & {'TFC', 'EFA', 'TWR', 'FTN'}), 'los que no están en la Liga no salen')
    cws = crews()
    lg = [{'id': 'liga-a', 'n': 'Liga A', 'sv': svs[0]['sv'], 'bat': 10, 'pend': 2, 'j': 4,
           'tabla': [['Ana', 3, 3, 9], ['Beto', 3, 2, 6]], 'ult_t': _ahora().strftime('%Y-%m-%dT%H:%M:%SZ')},
          {'id': 'liga-vieja', 'n': 'Liga Vieja', 'sv': svs[0]['sv'], 'bat': 10, 'tabla': [['Ana', 3, 3, 9]],
           'ult_t': '2026-01-01T00:00:00Z'},
          {'id': 'liga-fin', 'n': 'Liga Fin', 'sv': svs[0]['sv'], 'bat': 10, 'tabla': [['Ana', 3, 3, 9]], 'fin': {'c': 'Ana', 'p': ['Ana']},
           'ult_t': _ahora().strftime('%Y-%m-%dT%H:%M:%SZ')}]
    posts = publicaciones(svs, cws, lg, red=False)
    ks = {(p['foro'], p['k']) for p in posts}
    ok(('ligas', 'liga-a') in ks and ('ligas', 'liga-vieja') not in ks and ('ligas', 'liga-fin') not in ks,
       'ligas: sólo las en juego se abren')
    ok(('ligas', 'liga-fin') in {(p['foro'], p['k']) for p in publicaciones(svs, cws, lg, {'ligas': {'liga-fin': {'hilo': '1'}}}, red=False)},
       'y la que ya tiene publicación se sigue editando cuando termina')
    ok(len(ks) == len(posts), 'una publicación por cosa (sin claves repetidas)')
    ok(sum(1 for p in posts if p['fijar'] and p['foro'] == 'sv') == 1 and sum(1 for p in posts if p['fijar'] and p['foro'] == 'crews') == 1
       and not any(p['fijar'] for p in posts if p['foro'] == 'ligas'),
       'una fijada en servidores y una en crews; en ligas ninguna (la de paneles_dra.py se queda)')
    malos = [(p['k'], limites(p)) for p in posts if limites(p)]
    ok(not malos, 'todas entran en los topes de Discord%s' % (': %s' % malos[:3] if malos else ''))
    ok(all(TAG_TIER[d['tier']] in p['tags'] for d in svs for p in posts if p['foro'] == 'sv' and p['k'] == d['sv']),
       'la etiqueta de cada socio es la de su tier')
    ok(not any(t in ('Hermandad', 'Aliado', 'Pagado') for p in posts for t in p['tags']), 'Hermandad, Aliado y Pagado no se inventan')
    vos = [p['k'] for p in posts if PD.re_vos(p['texto'] + p['titulo'])]
    inf = info(svs, cws, lg)
    vos += [k for k in ('tiers', 'sumar', 'crear', 'crews_tiers') if PD.re_vos(inf[k])]
    vos += [k for k, c in inf['crews'].items() if PD.re_vos(c['unir'] + c['tier'])]
    ok(not vos, 'todo en «tú», sin voseo%s' % (': %s' % vos if vos else ''))
    # la firma y el plan: editar, nunca volver a publicar
    p = posts[1]
    f1 = firma(p)
    ok(f1 == firma(dict(p)) and f1 != firma(dict(p, texto=p['texto'] + '.')), 'la firma cambia con el texto y sólo con lo que se ve')
    ok(firma(p, worker=False) != firma(p, worker=True), 'y con los botones que salen (el Worker listo o no)')
    est = {'sv': {p['k']: {'hilo': '10', 'msg': '10', 'firma': f1}}}
    pl = dict(((x['foro'], x['k']), a) for a, x in plan(posts, est))
    ok(pl[(p['foro'], p['k'])] == 'igual', 'sin cambios: no se toca')
    est2 = {'sv': {p['k']: {'hilo': '10', 'msg': '10', 'firma': 'otra'}}}
    ok(dict(((x['foro'], x['k']), a) for a, x in plan(posts, est2))[(p['foro'], p['k'])] == 'editar',
       'con cambios y con hilo: se EDITA, no se publica otra')
    ok(all(a == 'crear' for a, _x in plan(posts, {})), 'sin hilo guardado: se crea')
    ok(not any(b.get('custom_id') for b in botones_finales(posts[1]['botones'], worker=False)),
       'sin el Worker desplegado, sólo botones de link')
    ok('fo:ev:' + svs[0]['sv'] in json.dumps(cuerpo(posts[1], 'https://x/y.png', worker=True)), 'con el Worker, «Sus próximos eventos»')
    m = cuerpo(posts[1], 'https://x/y.png', worker=True)
    ok(m['flags'] == 32768 and m['components'][0]['type'] == 17 and m['allowed_mentions'] == {'parse': []},
       'el mensaje: V2, un recuadro, sin menciones')
    # el Worker sabe contestar lo mismo que se publica
    try:
        js = io.open(os.path.join(SCR, 'foros.js'), encoding='utf-8').read()
        q = re.search(r'export const QUE = \[([^\]]*)\]', js).group(1)
        ok(sorted(re.findall(r"'(\w+)'", q)) == sorted(QUE), 'los `que` de los botones son los de bot/foros.js')
        ok(INFO_R2 in js, 'y lee la info del mismo lugar de R2')
    except (OSError, AttributeError):
        ok(False, 'no pude leer bot/foros.js')
    ok(all(k in inf for k in ('tiers', 'sumar', 'crear', 'crews_tiers', 'sv', 'crews', 'ligas')) and len(json.dumps(inf)) < 200000,
       'la info de los botones (%d KB)' % (len(json.dumps(inf)) // 1024))
    # el ciclo
    try:
        g = io.open(os.path.join(SCR, 'ci', 'guardar.sh'), encoding='utf-8').read()
        ok('datos/foros_dra.json' in g, 'datos/foros_dra.json va en ARCHIVOS de guardar.sh')
        pl_txt = io.open(os.path.join(SCR, 'pipeline.py'), encoding='utf-8').read()
        ok("'bot/foros_dra.py', '--aplicar'" in pl_txt, 'el ciclo lo corre (bot/pipeline.py)')
    except OSError:
        ok(False, 'no pude leer guardar.sh o pipeline.py')
    ok(os.path.exists(ESTADO), 'datos/foros_dra.json existe (CI pide que cada archivo de ARCHIVOS esté)')
    ok(ENCENDIDO is False, 'apagado hasta el sí de Dlx')
    print('\n%s' % ('todo bien' if not mal else '%d mal' % mal))
    return mal == 0


def main():
    a = sys.argv[1:]
    if '--auto' in a:
        sys.exit(0 if _self_check() else 1)
    if '--vista' in a:
        i = a.index('--vista')
        carpeta = a[i + 1] if len(a) > i + 1 and not a[i + 1].startswith('--') else os.path.join(SCR, 'salida', 'foros_dra')
        sys.exit(vista(carpeta))
    if '--aplicar' in a:
        sys.exit(aplicar())
    sys.exit(ver())


if __name__ == '__main__':
    main()
