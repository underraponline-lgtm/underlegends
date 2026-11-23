"""🏆 EL AVISO DESPUÉS DE CADA EVENTO, EN EL CHAT GENERAL DE SU SERVIDOR (Discord, tanda 2, 17/11/2026).

    python bot/aviso_ganadores.py            # qué se mandaría (no manda nada)
    python bot/aviso_ganadores.py --aplicar  # lo manda (lo corre el ciclo, paso 2b4c)
    python bot/aviso_ganadores.py --auto     # el self-check

Dlx, 17/11/2026: *«después del evento, al campeón se le avisa de su premio o drop mencionándolo en el chat general y a
todos los que hayan ganado, y la opción de que se pueda abrir algunos drops en el mismo Discord»*; *«el aviso
post-evento en el chat general: prendido en todos los socios, el dueño lo apaga»*; y *«menciona a quien gana un drop»*
(sólo se puede mencionar a quien tiene su Discord en la Lista; el resto va nombrado con cómo vincularse).

- UNO POR EVENTO, después de que el ciclo reparte sus drops (paso 2b4b): campeón y podio de `Resultados` y los batacazos
  de `1v1`, con las MISMAS reglas que `drops_merito.py` (lo que dice el aviso es lo que se dio).
- EN EL CHAT GENERAL DEL SERVIDOR DEL EVENTO, con la misma regla que `chats.chat_general()`. Sólo socios donde está el bot.
- MENCIONA SÓLO A LOS GANADORES con su cuenta en la Lista (`allowed_mentions.users`, nunca @everyone ni roles). Los
  demás, en negrita y con `/vincular`: si se vinculan en `VENTANA_DIAS`, el drop les llega igual (`drops_merito`).
- ✂️ DESDE EL 19/11/2026, SÓLO LOS PREMIOS Y UN BOTÓN (Dlx: «lo tercero debería estar de menos… ver mis recompensas en
  un solo botón en vez de 6… y esos botones de la tercera imagen son de la primera»): sin recuadro, sin los puntos ni el
  campeón repetidos (los dice «La noche de…»), las menciones en las líneas de los premios y «🎁 Abrir mis premios»
  (`dd:mis`: a quien lo toca, sus drops, como `/drops`). Ver `mensaje()`. Del 18/11 al 19/11 fue un botón por ganador y
  por premio (`dd:<drop|star|nido>:x:<id>`, que el Worker sigue entendiendo para los avisos que ya salieron).
- EL FORMATO: Componentes V2 sin recuadro. Del 18/11 al 19/11 fue un recuadro con el color del servidor, los puntos del
  evento por puesto y las menciones afuera, en una línea arriba (Dlx: «gente dentro del embed no se menciona»).
- 🌙 AL PIE, LA IMAGEN «LA NOCHE DE…» (`bot/noche.py`, Dlx 18/11/2026: la nota de cada uno, el MVP, el batacazo y el
  ELO, como al final de un partido; con 👑 sobre las tarjetas de los campeones desde el 19/11) y una fila de cinco
  botones, que van con la imagen, en el cierre del bot en vivo si lo hay: 🎯 Tu nota y 👤 Perfiles (los contesta el Worker,
  sólo a quien toca, con lo que se guarda en KV `noche:<n>`), y los links a La llave, el Ranking y los Próximos eventos.
  SÓLO DESDE EL EVENTO `NOCHE_DESDE` (Dlx: «sólo los próximos eventos… NO los actuales y pasados»). Si la imagen
  falla, el aviso sale igual, sin ella.
- LO APAGA EL STAFF de cada servidor en su panel (`ganadores` en `cfg:<guild>`, prendido de entrada).
- UNA SOLA VEZ: `datos/avisos_ganadores.json` (en `ARCHIVOS` de bot/ci/guardar.sh). La primera vez se siembra con lo que
  ya hay y no se avisa nada para atrás. Sólo eventos de los últimos `DIAS`.
"""
import datetime as dt
import io
import json
import os
import re
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path[:0] = [SCR, os.path.join(BASE, 'sheet'), BASE]

ESTADO = os.path.join(BASE, 'datos', 'avisos_ganadores.json')
API = 'https://discord.com/api/v10'
WEB_DROPS = 'https://underlegends.pages.dev/freestyle-rap/?drops=1'
#: un evento procesado tarde (una corrección de días después) no se anuncia: sería ruido en el chat
DIAS = 2
#: el tope de menciones de Discord es 100; un evento no tiene tantos ganadores
MENCIONES = 40


def _j(p, d):
    try:
        with io.open(p, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return d


def _guardar(x):
    x['_leeme'] = ('El aviso de los ganadores de cada evento en el chat general de su servidor (bot/aviso_ganadores.py, '
                   'Discord tanda 2, 17/11/2026): qué eventos ya se avisaron, dónde y con qué mensaje. «semilla»: los que ya '
                   'estaban cuando arrancó, que no se avisan.')
    with io.open(ESTADO, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(x, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write('\n')


def _md(s):
    """Un nombre que no rompa el markdown de Discord (ni lo use para mencionar)"""
    return re.sub(r'([*_~`|>\\])', r'\\\1', str(s or '')).replace('@', '@​')


class _Todos(dict):
    """Un `Q` de `drops_merito` que deja pasar a todos con su nombre (para nombrar también a quien no tiene cuenta)"""

    def get(self, k, d=None):
        return k

    def __getitem__(self, k):
        return k


def ganadores(res, duelos, Q, desde):
    """`{ev: {'camp': (nombre, tipo), 'pod': [nombre], 'bat': [(ganador, perdedor)]}}` con las reglas de `drops_merito`.
    `res` y `duelos`: las hojas con su cabecera. `Q`: nombre → Discord ID (para el Nido de la semana, que va por cuenta)"""
    import drops_merito as DM
    todos = DM.de_resultados(res, _Todos(), desde=desde)
    reales = {(x['q'], x['o']): x['k'] for x in DM.de_resultados(res, Q, desde=desde)}
    out = {}
    for x in todos:
        o = x['o'].split(':')
        ev = o[1]
        e = out.setdefault(ev, {'camp': None, 'camps': [], 'pod': [], 'bat': [], 'd': x.get('d', '')})
        if o[0] == 'camp':
            # 👥 TODOS LOS CAMPEONES (18/11/2026): en un evento por equipos cada integrante tiene su premio —el Nido o el
            # Drop según su semana— y acá se guardaba sólo el último: PANDILLAS (3v3) avisaba a Miniboy y no a Zanti ni a
            # MaYeuTyK. `camp` queda como el primero, para lo que lo leía así
            q = Q.get(x['q'])
            e['camps'].append((x['q'], reales.get((q, x['o']), x['k']) if q else x['k']))
            e['camp'] = e['camps'][0]
        elif o[0] == 'pod':
            e['pod'].append(x['q'])
    # los batacazos: el nombre del perdedor, de la hoja (el origen lo trae recortado)
    i, cab = DM._cabecera(duelos, 'Ganador')
    nombres = {}
    if i is not None:
        c = {k: cab.index(k) for k in ('Evento #', 'Perdedor') if k in cab}
        for f in duelos[i + 1:]:
            if len(f) > max(c.values() or [0]):
                nombres[(str(f[c['Evento #']]), DM._llave(f[c['Perdedor']]))] = str(f[c['Perdedor']])
    for x in DM.de_duelos(duelos, _Todos(), desde=desde):
        _b, ev, perd = x['o'].split(':', 2)
        e = out.setdefault(ev, {'camp': None, 'camps': [], 'pod': [], 'bat': [], 'd': x.get('d', '')})
        e['bat'].append((x['q'], nombres.get((ev, perd), perd)))
    return out


#: los colores de cada servidor (la barra del recuadro); sin color, el magenta de la marca
COLOR_UL = 0xE41373
#: un botón por ganador y por premio: hasta tantos (Discord deja 5 por fila y 40 piezas por mensaje)
BOTONES = 10
#: 📊 los puestos que muestra «Los puntos» (campeón, subcampeón, semis, cuartos); del resto, cuántos
PUESTOS = 4
MEDALLA = {'Campeón': '🥇', 'Subcampeón': '🥈', 'Semifinal': '🥉', 'Tercero': '🥉', 'Cuartos': '🎖️'}
#: 🌙 la imagen «La noche de…» y su fila de botones, SÓLO DESDE ESTE EVENTO (Dlx, 18/11/2026: «sólo necesitamos hacer que
#: los próximos eventos tengan eso. NO los actuales y pasados»). Vive en `bot/notas.py`, con el 🔥 de la llave
from notas import NOCHE_DESDE                            # noqa: E402
#: cuánto dura en KV lo que leen «Tu nota» y «Perfiles» (`noche:<n>`): una escritura por evento
NOCHE_DIAS = 30


def _titulo(evento):
    """El nombre del evento sin el adorno del organizador: «__ NEW GENESIS __» salía con los guiones a la vista (Dlx,
    18/11/2026, con la captura del aviso de FFA)."""
    t = str(evento or '').strip()
    if not t or t.startswith('('):
        return ''
    return re.sub(r'^[\s_*~|`]+|[\s_*~|`]+$', '', t).strip()


WEB = 'https://underlegends.pages.dev'
# 🔗 (21/11/2026) Dlx: «si el embed te dice que corras el slash command vincular, que cree un botón que te diga haz clic
# aquí para vincularte, te toma menos de 1 minuto». El mismo botón que el Worker suma solo (`BOTON_VINCULAR` de
# bot/vista.js: el self-check revisa que digan lo mismo), al lado de «Abrir mis premios» cuando alguien no está vinculado.
# ✂️ (23/11/2026) Dlx: «el botón de vincularte no se ve completo: en vez de agregar que te toma menos de 1m, simplemente
# pon el espacio y el signo de aproximación 1m». Discord corta las etiquetas largas en el celular: eran 57 letras.
TXT_VINCULAR = 'Haz clic aquí para vincularte ≈1m'
BOTON_VINCULAR = {'type': 2, 'style': 5, 'label': TXT_VINCULAR, 'emoji': {'name': '🔗'}, 'url': WEB + '/cuenta/verificar'}


def _logo(sv):
    """🛡️ La URL pública del logo del servidor (bot/paginas/logos/<sv>.webp, servido por la página), o `''` si no hay.
    Dlx, 18/11/2026: «que el embed tenga el logo del servidor en su ícono»."""
    sv = str(sv or '').lower()
    return '%s/logos/%s.webp' % (WEB, sv) if sv and os.path.exists(os.path.join(BASE, 'bot', 'paginas', 'logos', sv + '.webp')) else ''


def _sv_info(sv):
    """`(nombre del servidor, color)`, de `datos/servidores.json` y `datos/colores_sv_marca.json`."""
    svs = (_j(os.path.join(BASE, 'datos', 'servidores.json'), {}) or {}).get('servidores') or {}
    col = ((_j(os.path.join(BASE, 'datos', 'colores_sv_marca.json'), {}) or {}).get('usar') or {}).get(sv) or ''
    try:
        c = int(str(col).lstrip('#'), 16) if col else COLOR_UL
    except ValueError:
        c = COLOR_UL
    return (svs.get(sv) or {}).get('nombre') or sv, c


def _oficiales():
    """`{discord_id: nombre de la Lista, sin bandera}`: el nombre que va en cada botón. La hoja de resultados trae a veces la
    clave («rodrilp») y el botón tiene que decir «Rodri LP», como el ranking."""
    out = {}
    for r in _j(os.path.join(BASE, 'datos', 'padron.json'), []) or []:
        did = str(r.get('discord_id') or '').strip()
        n = re.sub('[\U0001F1E6-\U0001F1FF]', '', str(r.get('raw') or '')).strip()
        if did and n and did not in out:
            out[did] = n
    return out


def mensaje(evento, sv, g, Q, miembros, oficiales=None, puntos=None, solo_premios=False):
    """`(componentes, ids, texto)` del aviso de un evento: un mensaje de Componentes V2 (`flags` 32768) con su texto
    plano para la consola. `g`: lo de `ganadores()`; `Q`: nombre → Discord ID. Sin campeón, `None`.

    ✂️ REHECHO EL 19/11/2026, MÁS CORTO (Dlx, con las capturas de GRISELDA TIME VOL. 7: *«lo tercero debería estar de
    menos, eso ya está en la primera imagen; lo único que tendríamos que hacer es cómo ponemos las recompensas, quizás ver
    mis recompensas en un solo botón en vez de 6, y esos botones de la tercera imagen son de la primera»*):
    - SIN RECUADRO, SIN LOS PUNTOS Y SIN EL CAMPEÓN REPETIDO: eso lo dice «La noche de…», que va en el cierre del bot en
      vivo (y si no hay cierre, en este mismo mensaje, debajo);
    - LOS PREMIOS, CON LAS MENCIONES ADENTRO: «🥚 Nido por el título: @Vandu, @Trelok y @Kyss». Mencionadas suenan
      (`allowed_mentions.users`, sólo los ganadores con su cuenta en la Lista); quien no tiene cuenta, en negrita y con
      `/vincular`;
    - UN SOLO BOTÓN, «Abrir mis premios» (`dd:mis`): a quien lo toca, el Worker le muestra SUS drops para abrir, como
      `/drops` (sólo a él). Eran seis, uno por ganador y por premio;
    - `solo_premios`: cuando la imagen va en el cierre, el aviso es sólo esto, con su título («🎁 Los premios de…»). Sin
      cierre, arriba dice qué terminó y dónde, porque es el único mensaje del evento.
    Antes (18/11/2026): un recuadro con el color del servidor, el campeón, los puntos por puesto y un botón por premio,
    con las menciones en una línea afuera (*«gente dentro del embed no se menciona»*: acá no hay recuadro)."""
    if not g.get('camp'):
        return None
    ids, sin = [], []
    banderas = {n: cc for _pos, gente in (puntos or []) for n, cc, _p in gente}

    def nombre(n):
        """La mención si tiene su cuenta en la Lista; si no, en negrita con su bandera (y se anota para `/vincular`)"""
        i = Q.get(n)
        if i:
            if i not in ids:
                ids.append(i)
            return '<@%s>' % i
        if n not in sin:
            sin.append(n)
        fl = _bandera(banderas.get(n))
        return '**%s**%s' % (_md(n), ' ' + fl if fl else '')

    def y(xs):
        xs = list(xs)
        return xs[0] if len(xs) == 1 else ', '.join(xs[:-1]) + ' y ' + xs[-1]

    titulo = _titulo(evento)
    nombre_sv, _color = _sv_info(sv) if sv else ('', COLOR_UL)
    camps = g.get('camps') or [g['camp']]
    lineas = []
    if solo_premios:
        lineas.append('### 🎁 Los premios de %s' % (_md(titulo) if titulo else 'este evento'))
    else:
        lineas.append('### 🏆 Terminó %s%s' % ('**%s**' % _md(titulo) if titulo else 'el evento',
                                               (' en **%s**' % _md(nombre_sv)) if nombre_sv else ''))
    nidos = [c for c, t in camps if t == 'nido']
    drops_c = [c for c, t in camps if t != 'nido']
    if nidos:
        lineas.append('🥚 **Nido** por el título: %s' % y(nombre(c) for c in nidos))
    if drops_c:
        lineas.append('🎁 **Drop** por el título: %s' % y(nombre(c) for c in drops_c))
    if g.get('pod'):
        lineas.append('🎁 **Drop** por el podio: %s' % y(nombre(n) for n in g['pod']))
    for gan, perd in g.get('bat') or []:
        lineas.append('⚡ **Star** por el batacazo: %s, que le ganó a **%s**' % (nombre(gan), _md(perd)))
    if sin:
        lineas.append('-# 🔗 %s: vincula tu cuenta con `/vincular` en los próximos 14 días y lo que ganaste es tuyo.'
                      % y('**%s**' % _md(n) for n in sin))
    boton = {'type': 2, 'style': 1, 'label': 'Abrir mis premios', 'emoji': {'name': '🎁'}, 'custom_id': 'dd:mis'}
    botones = [boton] + ([BOTON_VINCULAR] if sin else [])
    comps = [{'type': 10, 'content': '\n'.join(lineas)}, {'type': 1, 'components': botones}]
    texto = '\n'.join(lineas + ['[🎁 Abrir mis premios]'] + (['[🔗 %s]' % TXT_VINCULAR] if sin else []))
    return comps, ids[:MENCIONES], texto


def fila_noche(ev, con_ficha=True):
    """🌙 Los cinco botones debajo de la imagen (Dlx, 18/11/2026, elegidos con las visitas de 7 días de la página):
    🎯 Tu nota y 👤 Perfiles los contesta el Worker (`nn:<nota|perf>:<n>`, sólo a quien toca); los otros tres son links.
    Sin la ficha en KV (`con_ficha=False`), sólo los links: un botón que contesta «no está» es peor que ninguno."""
    b = []
    if con_ficha:
        b += [{'type': 2, 'style': 1, 'label': 'Tu nota', 'emoji': {'name': '🎯'}, 'custom_id': 'nn:nota:%s' % ev},
              {'type': 2, 'style': 2, 'label': 'Perfiles', 'emoji': {'name': '👤'}, 'custom_id': 'nn:perf:%s' % ev}]
    b += [{'type': 2, 'style': 5, 'label': 'La llave', 'emoji': {'name': '📋'}, 'url': '%s/freestyle-rap/llave/%s' % (WEB, ev)},
          {'type': 2, 'style': 5, 'label': 'Ranking', 'emoji': {'name': '🏆'}, 'url': WEB + '/freestyle-rap/ranking'},
          {'type': 2, 'style': 5, 'label': 'Próximos eventos', 'emoji': {'name': '📅'}, 'url': WEB + '/freestyle-rap/eventos'}]
    return {'type': 1, 'components': b}


def fila_tarjeta():
    """🃏 «Consigue tu tarjeta», en su propia fila debajo de los cinco (Dlx, 20/11/2026, con una captura del cierre de la
    CHOP COMPE NOCTURNA: *«agrega el botón consigue tu tarjeta ahí»*). Discord admite cinco botones por fila y la de la
    imagen ya tiene cinco. Va siempre: la imagen muestra el podio con «SIN TARJETA» y el mensaje lo lee todo el chat. El
    link es el de `filaTarjeta()` del vs (bot/avisos.js): Tarjetas, donde «Las tuyas» le dice a cada uno qué le falta."""
    return {'type': 1, 'components': [{'type': 2, 'style': 5, 'label': 'Consigue tu tarjeta', 'emoji': {'name': '🃏'},
                                       'url': WEB + '/freestyle-rap/tarjetas'}]}


def filas_noche(ev, con_ficha=True):
    """🌙 Las dos filas de la imagen: los cinco botones (`fila_noche()`) y «Consigue tu tarjeta» (`fila_tarjeta()`)."""
    return [fila_noche(ev, con_ficha), fila_tarjeta()]


def pie_noche(alt, con_ficha, ev):
    """🌙 Lo que va DEBAJO del recuadro: la imagen (una Galería de Medios con su descripción) y sus dos filas de botones."""
    return [{'type': 12, 'items': [{'media': {'url': 'attachment://noche.png'}, 'description': alt[:1000]}]}] + filas_noche(ev, con_ficha)


def pie_con_url(pie, url):
    """🌙 El pie con la imagen como LINK (`url`, en R2) en lugar del archivo adjunto. Adjuntar pide el permiso «Adjuntar
    archivos» en ese chat y un link no: así va también la tarjeta del campeón del cierre. El 19/11/2026 el aviso del
    #664 (CH) recibió un 403 con la imagen adjunta y salió sin ella; sin la imagen, pasó. Sin `url`, el pie como estaba."""
    if not url or not pie or pie[0].get('type') != 12:
        return pie
    item = dict(((pie[0].get('items') or [{}])[0]) or {})
    item['media'] = {'url': url}
    return [{'type': 12, 'items': [item]}] + list(pie[1:])


def noche(ev, Q):
    """🌙 `(componentes, (archivo, png))` del pie del aviso, o `([], None)` si el evento es de antes de `NOCHE_DESDE` o la
    imagen no sale (el aviso va igual, sin ella: nunca lo frena)."""
    if not str(ev).isdigit() or int(ev) < NOCHE_DESDE:
        return [], None
    try:
        import noche as NO
        png, mal = NO.imagen(ev)
        R = NO.resumen(ev)
        alt = NO.descripcion(R)
        ficha = NO.ficha(R, Q)
    except (Exception, SystemExit) as e:                 # noqa: BLE001
        # ⚠️ también SystemExit: es lo que tira `navegador.hace_falta()` si Chromium no baja en sus tres intentos
        print('      ⚠️ la imagen «La noche de…» no salió (%r): el aviso va sin ella' % e)
        return [], None
    if mal:
        print('      ⚠️ la imagen salió con: %s' % '; '.join(mal))
    return pie_noche(alt, _guardar_ficha(ev, ficha), ev), ('noche.png', png)


# ── 🌙 «LA NOCHE DE…» EN EL CIERRE DEL BOT EN VIVO, EN LUGAR DE LA TARJETA SOLA (19/11/2026) ─────────────────────────────
# Dlx: «eso debería ser al instante así como la tarjeta de campeón, de hecho este es más completo, reemplazaría eso de
# campeón solitario». El cierre sale al minuto de la final con la tarjeta del campeón (`cierreChat()` de avisos.js); la
# imagen se dibuja en un navegador, acá, así que con el campeón el Worker pide una vuelta del ciclo (`ciclo_pedir`,
# `minutosAlCiclo()`) y esta vuelta le CAMBIA la tarjeta a ese mensaje por la imagen. El aviso de ganadores sale igual,
# con sus menciones y sus botones, y sin repetirla. Sin cierre (el servidor no tiene el bot en vivo), si el cierre ya
# lleva el aviso de otro evento o si Discord no la toma, la imagen va en el aviso, también como link (`pie_con_url()`).
def _ya_tiene_fila(comps):
    """¿Ya lleva la fila de la imagen? (los botones `nn:` o el link a La llave): una segunda vuelta no la repite"""
    return any(c.get('type') == 1 and any(str(b.get('custom_id') or '').startswith('nn:') or '/llave/' in str(b.get('url') or '')
                                          for b in c.get('components') or []) for c in comps)


def con_noche(msg, url, alt, fila=None):
    """El cuerpo del PATCH que cambia la imagen de `msg` (el mensaje como lo devuelve Discord) por `url`: en Componentes
    V2, la galería de afuera del recuadro (o una nueva al final); en el formato de antes, la imagen del primer embed.
    `None` si no hay dónde ponerla. No menciona a nadie (una edición no suena igual).

    🔘 Y LOS BOTONES DE LA IMAGEN, DEBAJO DE ELLA (`fila`, la de `fila_noche()`; Dlx, 19/11/2026: *«esos botones de la
    tercera imagen son de la primera»*): Tu nota, Perfiles, La llave, el Ranking y los Próximos eventos van con la imagen,
    en el cierre, y no en el aviso de los premios. `fila` puede ser una fila o una lista (`filas_noche()`: también la de
    «Consigue tu tarjeta»), y van todas juntas, en ese orden."""
    filas = [f for f in (fila if isinstance(fila, list) else [fila]) if f]
    item = {'media': {'url': url}, 'description': str(alt or '')[:1000]}
    if int(msg.get('flags') or 0) & 32768:
        comps = [dict(c) for c in msg.get('components') or []]
        i = next((j for j, c in enumerate(comps) if c.get('type') == 12), None)
        if i is None:
            # 🔘 sin tarjeta, la imagen va ARRIBA de los botones: desde el 19/11/2026 van debajo de la imagen y afuera del
            # recuadro (`cuerpoV2()` de avisos.js)
            i = next((k for k, c in enumerate(comps) if c.get('type') == 1), len(comps))
            comps.insert(i, {'type': 12, 'items': [item]})
        else:
            comps[i] = {'type': 12, 'items': [item]}
        if filas and not _ya_tiene_fila(comps):
            comps[i + 1:i + 1] = filas
        return {'components': comps, 'allowed_mentions': {'parse': []}}
    es = [dict(e) for e in msg.get('embeds') or []]
    if not es:
        return None
    es[0]['image'] = {'url': url}
    out = {'embeds': es, 'allowed_mentions': {'parse': []}}
    viejas = [dict(c) for c in msg.get('components') or []]
    if filas and not _ya_tiene_fila(viejas):
        # ⚠️ en el formato de antes van como mucho cinco filas: si no entran todas, va la de la imagen sola
        filas = filas if len(viejas) + len(filas) <= 5 else filas[:1] if len(viejas) < 5 else []
        if filas:
            out['components'] = viejas + filas
    return out


def _subir_noche(ev, png):
    """La imagen a R2 (pública, como las tarjetas), con su huella en el nombre: Discord guarda lo que bajó de una URL.
    La URL, o `None`."""
    import hashlib
    import subir_cartas as SC
    clave = 'noche/%s-%s.png' % (ev, hashlib.sha1(png).hexdigest()[:10])
    r = SC.sesion().put('%s/objects/%s' % (SC.API, clave), data=png, headers={'Content-Type': 'image/png'}, timeout=60)
    return '%s/%s' % (SC.PUBLICA, clave) if SC._ok(r, clave) is not None else None


def _url_noche(ev, png):
    """`_subir_noche()` que nunca levanta: la URL, o `None` (y entonces la imagen va adjunta, como antes)."""
    try:
        return _subir_noche(ev, png)
    except Exception as e:                               # noqa: BLE001
        print('      ⚠️ la imagen no subió a R2 (%r): va adjunta' % e)
        return None


def al_cierre(ev, nombre, sv, fecha, png, alt, s, fila=None):
    """🌙 Pone «La noche de…» en el cierre del bot en vivo de ese evento, en lugar de la tarjeta. `{canal, msg, url}` si
    quedó; `None` si no hay cierre, si ya lleva el aviso de OTRO evento (la regla de `avisar.evento()`) o si Discord no
    la tomó. `s` es la sesión del bot. **Nunca levanta.**"""
    try:
        import avisar as AV
        canal = (AV.canales_chat() or {}).get(str(sv).upper())
        ids = AV._ids_llave({'nombre': nombre, 'servidor': sv, 'fecha': fecha})
        cierre = AV._cierre_vivo(canal, ids) if canal and ids else None
        if not cierre:
            return None
        if any(isinstance(v, dict) and str(v.get('msg') or '') == cierre for k, v in AV._avisados().items() if k != str(ev)):
            print('      · el cierre de %s ya lleva el aviso de otro evento: la imagen va en el aviso' % sv)
            return None
        r = s.get('%s/channels/%s/messages/%s' % (API, canal, cierre), timeout=20)
        if r.status_code != 200:
            return None
        url = _subir_noche(ev, png)
        cuerpo_ = con_noche(r.json() or {}, url, alt, fila) if url else None
        if not cuerpo_:
            return None
        r = s.patch('%s/channels/%s/messages/%s' % (API, canal, cierre), json=cuerpo_, timeout=30)
        if r.status_code == 200:
            return {'canal': str(canal), 'msg': str(cierre), 'url': url}
        print('      ⚠️ el cierre no tomó la imagen (%s %s): va en el aviso' % (r.status_code, r.text[:160]))
    except Exception as e:                               # noqa: BLE001
        print('      ⚠️ el cierre no tomó la imagen (%r): va en el aviso' % e)
    return None


def _guardar_ficha(ev, ficha):
    """🎯 Lo que leen «Tu nota» y «Perfiles», a KV (`noche:<n>`, vence a los `NOCHE_DIAS`). `True` si quedó."""
    try:
        import requests
        import subir_datos as SD
        s = requests.Session()
        s.headers['Authorization'] = 'Bearer ' + SD.env('CLOUDFLARE_API_TOKEN')
        r = s.put('%s/values/noche:%s?expiration_ttl=%d' % (SD.API, ev, NOCHE_DIAS * 86400),
                  files={'value': (None, json.dumps(ficha, ensure_ascii=False)), 'metadata': (None, '{}')}, timeout=30)
        if r.status_code == 200:
            return True
        print('      ⚠️ «Tu nota» no quedó en KV (%s): el aviso va sin ese botón' % r.status_code)
    except Exception as e:                               # noqa: BLE001
        print('      ⚠️ «Tu nota» no quedó en KV (%r): el aviso va sin ese botón' % e)
    return False


def cuerpo(comps, ids, archivo=None):
    """Los argumentos de `requests.post` para el mensaje: JSON solo, o multipart con la imagen (`payload_json` y
    `files[0]`; el `Content-Type: None` saca el JSON que la sesión trae por defecto)."""
    payload = {'flags': 32768, 'components': comps, 'allowed_mentions': {'parse': [], 'users': ids}}
    if not archivo:
        return {'json': payload}
    nombre, png = archivo
    payload['attachments'] = [{'id': 0, 'filename': nombre}]
    return {'data': {'payload_json': json.dumps(payload, ensure_ascii=False)}, 'files': {'files[0]': (nombre, png, 'image/png')},
            'headers': {'Content-Type': None}}


def _bandera(cc):
    """`ar` → 🇦🇷; `''` si no es un código"""
    cc = str(cc or '').strip().lower()
    return ''.join(chr(0x1F1E6 + ord(c) - 97) for c in cc) if re.fullmatch(r'[a-z]{2}', cc) else ''


def _miles(n):
    """10000 → «10.000»"""
    try:
        return '{:,}'.format(int(round(float(n)))).replace(',', '.')
    except (TypeError, ValueError):
        return str(n or '')


def puntos_de(res, ev):
    """`[(puesto, [(nombre, país, puntos)])]` del evento `ev`, en el orden de la hoja (del campeón para abajo), de
    `Resultados` con su cabecera. Los puntos son los de la columna `Puntos` (con el Most Wanted, si sumó)."""
    if not res:
        return []
    cab = [str(c) for c in res[0]]
    if not all(k in cab for k in ('Evento #', 'Rapero', 'Posición', 'Puntos')):
        return []
    c = {k: cab.index(k) for k in ('Evento #', 'Rapero', 'País', 'Posición', 'Puntos') if k in cab}
    out = []
    for f in res[1:]:
        if len(f) <= max(c.values()) or str(f[c['Evento #']]) != str(ev):
            continue
        pos = str(f[c['Posición']] or '').strip() or '—'
        x = (str(f[c['Rapero']] or '').strip(), str(f[c['País']] or '') if 'País' in c else '', f[c['Puntos']] or 0)
        if not x[0]:
            continue
        if out and out[-1][0] == pos:
            out[-1][1].append(x)
        else:
            out.append((pos, [x]))
    return out


def _cfg(gid):
    """El panel de ese servidor (`cfg:<guild>` de KV): `{}` si nunca lo tocó, `None` si no se puede saber."""
    try:
        import subir_datos as SD
        r = SD.sesion().get('%s/values/cfg:%s' % (SD.API, gid), timeout=20)
    except Exception:                                    # noqa: BLE001
        return None
    if r.status_code == 404:
        return {}
    if r.status_code != 200:
        return None
    try:
        return r.json() or {}
    except ValueError:
        return None


def _fecha(s, hoy):
    """`dd/mm` de la hoja → fecha (del año que corresponde)"""
    try:
        d, m = (int(x) for x in str(s).split('/')[:2])
        f = dt.date(hoy.year, m, d)
        return f if f <= hoy + dt.timedelta(days=1) else dt.date(hoy.year - 1, m, d)
    except (ValueError, TypeError):
        return None


def correr(aplicar=False):
    import drops_merito as DM
    import espejo_t1 as ES
    import zoneinfo
    hoy = dt.datetime.now(zoneinfo.ZoneInfo('America/New_York')).date()
    estado = _j(ESTADO, None)
    hoja = lambda h: DM._hoja(ES, h)                     # noqa: E731
    evs = hoja('Eventos Procesados')
    cab = [str(c) for c in (evs[0] if evs else [])]
    if '#' not in cab:
        print('   🏆 el aviso de los ganadores: no encuentro los eventos procesados')
        return 0
    c = {k: cab.index(k) for k in ('#', 'Evento', 'Servidor', 'Fecha') if k in cab}
    eventos = {str(f[c['#']]): f for f in evs[1:] if len(f) > max(c.values())}
    if estado is None:
        # 🌱 la primera vez: lo que ya hay no se avisa (sería una pared de mensajes de eventos viejos)
        if aplicar:
            _guardar({'avisados': {ev: 'semilla' for ev in eventos}})
        print('   🏆 el aviso de los ganadores: arranca de cero (%d eventos sembrados, ninguno se avisa)' % len(eventos))
        return 0
    avisados = estado.get('avisados') or {}
    Q = DM.quienes()
    res = hoja('Resultados')
    G = ganadores(res, hoja('1v1'), Q, hoy - dt.timedelta(days=DIAS + 1))
    nuevos = []
    for ev, f in eventos.items():
        if ev in avisados or ev not in G:
            continue
        fe = _fecha(f[c['Fecha']], hoy)
        if not fe or (hoy - fe).days > DIAS:
            continue
        nuevos.append((ev, str(f[c['Evento']] or ''), str(f[c['Servidor']] or '').upper(), str(f[c['Fecha']] or '')))
    if not nuevos:
        print('   🏆 el aviso de los ganadores: nada nuevo')
        return 0
    miembros = set(str(x) for x in ((_j(os.path.join(BASE, 'datos', 'verificados.json'), {}) or {}).get('ids') or []))
    oficiales = _oficiales()
    import chats as CH
    svs = dict(CH.servidores())
    s = None
    canales = {}
    for ev, nombre, sv, fecha in sorted(nuevos, key=lambda x: int(x[0]) if x[0].isdigit() else 0):
        m = mensaje(nombre, sv, G[ev], Q, miembros, oficiales, puntos_de(res, ev))
        if not m:
            avisados[ev] = 'sin_campeon'
            continue
        comps, ids, texto = m
        print('\n   🏆 #%s %s (%s) · %d mención(es)\n      %s' % (ev, nombre, sv, len(ids), texto.replace('\n', '\n      ')))
        if ev.isdigit() and int(ev) >= NOCHE_DESDE:
            print('      🌙 + la imagen «La noche de…» y sus cinco botones (en el cierre del bot en vivo si lo hay; ahí el aviso va '
                  'sólo con los premios)')
        if not aplicar:
            continue
        gid = svs.get(sv)
        if not gid:
            avisados[ev] = 'sin_bot'
            print('      · %s no es un socio con el bot: no se manda' % sv)
            continue
        cfg = _cfg(gid)
        if cfg is None:
            print('      ⚠️ %s: no sé si lo apagaron (sin Cloudflare): queda para la próxima' % sv)
            continue
        if cfg.get('ganadores') is False:
            avisados[ev] = 'apagado'
            print('      · %s: apagado en su panel' % sv)
            continue
        if s is None:
            import escuchar as E
            s = E.sesion()
        if sv not in canales:
            import escuchar as E
            r = s.get('%s/guilds/%s/channels' % (API, gid), timeout=20)
            cs = r.json() if r.status_code == 200 else []
            canales[sv] = CH.chat_general(cs, E.categorias_staff(cs) | E.categorias_fuera(gid)) if cs else None
        canal = canales[sv]
        canal = canal.get('id') if isinstance(canal, dict) else canal
        if not canal:
            avisados[ev] = 'sin_chat'
            print('      · %s: sin chat general' % sv)
            continue
        # 🎨 Componentes V2 (`flags` 32768): sin `content`, todo va en el recuadro. Las menciones del texto suenan igual
        # (`allowed_mentions.users`: sólo los ganadores)
        # 🌙 la imagen y su fila, recién acá: no se dibuja para un servidor que no la va a recibir
        pie, archivo = noche(ev, Q)
        # 🌙 y va en el CIERRE del bot en vivo, en lugar de la tarjeta del campeón (ver `al_cierre()`): el aviso queda
        # con sus botones y sin repetirla
        en_cierre = None
        if archivo and pie and pie[0].get('type') == 12:
            alt = ((pie[0].get('items') or [{}])[0] or {}).get('description') or ''
            en_cierre = al_cierre(ev, nombre, sv, fecha, archivo[1], alt, s, pie[1:] or None)
            if en_cierre:
                # ✂️ y con ella sus botones (19/11/2026): el aviso queda sólo con los premios y «Abrir mis premios»
                print('      🌙 la imagen y sus botones, en el cierre del bot en vivo: el aviso va sólo con los premios')
                pie, archivo = [], None
                comps, ids, _t = mensaje(nombre, sv, G[ev], Q, miembros, oficiales, puntos_de(res, ev), solo_premios=True)
            else:
                # 🌙 va en el aviso, como LINK y no adjunta (`pie_con_url()`): adjuntar pide un permiso que no todos
                # los chats le dan al bot. Si R2 no la toma, adjunta, como antes
                url = _url_noche(ev, archivo[1])
                if url:
                    pie, archivo = pie_con_url(pie, url), None
        # 🎤 LA BIENVENIDA DE QUIEN DEBUTÓ, ADENTRO (Dlx, 22/11/2026: «make sure we are not that spammy»): era otro
        # mensaje en el mismo chat, al mismo tiempo. Ver `debutantes._esperar_ganadores()`
        deb = []
        try:
            import debutantes as DB
            deb = DB.del_evento(ev)
            if deb:
                _c, ids_d, txt_d = DB.mensaje_chat(deb, sv, DB.cuentas_inscritas(_j(os.path.join(BASE, 'datos', 'gente_eventos.json'), {}), Q))
                comps = comps[:1] + [{'type': 10, 'content': txt_d}] + comps[1:]
                ids = (ids + [i for i in ids_d if i not in ids])[:MENCIONES]
                print('      🎤 + la bienvenida de %d debut(s)' % len(deb))
        except Exception as e:                           # noqa: BLE001
            deb = []
            print('      ⚠️ la bienvenida del debut no entró (%r): sale sola' % e)
        con_imagen = bool(pie) and pie[0].get('type') == 12
        r = s.post('%s/channels/%s/messages' % (API, canal), **cuerpo(comps + pie, ids, archivo))
        if con_imagen and r.status_code not in (200, 201):
            # ⚠️ con lo que contestó Discord: el 403 del #664 no decía qué permiso faltaba
            print('      ⚠️ con la imagen no salió (%s %s): va sin ella' % (r.status_code, r.text[:160]))
            r = s.post('%s/channels/%s/messages' % (API, canal), **cuerpo(comps + filas_noche(ev, False), ids))
        if r.status_code in (200, 201):
            avisados[ev] = {'sv': sv, 'canal': str(canal), 'msg': str((r.json() or {}).get('id') or ''), 'dia': hoy.isoformat()}
            if en_cierre:
                avisados[ev]['noche'] = en_cierre
            if deb:
                DB.marcar_chat([raw for raw, _r in deb], hoy.isoformat())
            print('      ✅ mandado')
        else:
            print('      ⚠️ no salió (%s): queda para la próxima' % r.status_code)
    if aplicar:
        _guardar({'avisados': avisados})
    return 0


def _self_check():
    mal = 0

    def ok(c, t):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '🔴', t))

    print('\n══ 🏆 EL AVISO DE LOS GANADORES ══\n')
    res = [['Evento #', 'Fecha', 'Servidor', 'Rapero', 'Posición'],
           ['700', '17/11/2026', 'FFA', 'Ana', 'Campeón'], ['700', '17/11/2026', 'FFA', 'Beto', 'Subcampeón'],
           ['700', '17/11/2026', 'FFA', 'Caro*', 'Tercero'], ['701', '17/11/2026', 'FFA', 'Ana', 'Campeón']]
    duelos = [['Evento #', 'Fecha', 'Ganador', 'Perdedor']] + [['600', '10/11/2026', 'Fuerte', 'Debil%d' % i] for i in range(12)] + \
             [['700', '17/11/2026', 'Beto', 'Fuerte']]
    Q = {'Ana': '111111', 'Beto': '222222'}
    desde = dt.date(2026, 11, 1)
    G = ganadores(res, duelos, Q, desde)
    ok(G['700']['camp'] == ('Ana', 'nido') and G['701']['camp'] == ('Ana', 'drop'), 'el primer título de la semana es un Nido y el segundo un Drop, como en drops_merito')
    ok(set(G['700']['pod']) == {'Beto', 'Caro*'} and ('Beto', 'Fuerte') in G['700']['bat'], 'el podio y el batacazo, con el nombre del perdedor')
    res2 = [['Evento #', 'Fecha', 'Servidor', 'Escala', 'Rapero', 'País', 'Posición', 'Puntos'],
            ['700', '17/11', 'FFA', '16+', 'Ana', 'ar', 'Campeón', 10000], ['700', '17/11', 'FFA', '16+', 'Beto', 'cl', 'Subcampeón', 7500],
            ['700', '17/11', 'FFA', '16+', 'Caro*', 've', 'Semifinal', 5250], ['700', '17/11', 'FFA', '16+', 'Dani', 'co', 'Semifinal', 5250],
            ['700', '17/11', 'FFA', '16+', 'Eli', 'mx', 'Cuartos', 2500], ['700', '17/11', 'FFA', '16+', 'Fer', 'ar', 'Octavos', 1250],
            ['701', '17/11', 'FFA', '16+', 'Ana', 'ar', 'Campeón', 10000]]
    P = puntos_de(res2, '700')
    ok([x[0] for x in P] == ['Campeón', 'Subcampeón', 'Semifinal', 'Cuartos', 'Octavos'] and P[2][1][1] == ('Dani', 'co', 5250),
       'los puntos del evento, por puesto y en el orden de la hoja')
    comps, ids, t = mensaje('__ TOKYO VOL 27 __', 'FFA', G['700'], Q, {'111111'}, None, P)
    todo = json.dumps(comps, ensure_ascii=False)
    ok(comps[0]['type'] == 10 and '<@111111>' in comps[0]['content'] and '<@222222>' in comps[0]['content'] and ids == ['111111', '222222'],
       '✂️ (19/11/2026) sin recuadro: los premios con las menciones adentro, una vez cada uno')
    ok('🥚 **Nido** por el título: <@111111>' in todo and 'Drop** por el podio: <@222222> y **Caro' in todo
       and 'Star** por el batacazo: <@222222>, que le ganó a **Fuerte**' in todo,
       'el Nido del campeón, el Drop del podio y el Star del batacazo, cada uno con su gente')
    ok('Los puntos' not in todo and '10.000' not in todo and 'Campeón:' not in todo and comps[0]['content'].startswith('### 🏆 Terminó **TOKYO VOL 27**'),
       'sin los puntos ni el campeón repetidos (los dice «La noche de…»); arriba, qué terminó, sin los «__»')
    ok('**Caro\\\\*' in todo and '/vincular' in todo, 'quien no tiene cuenta va en negrita (escapado) y con cómo vincularse')
    bots = [b for c in comps if c['type'] == 1 for b in c['components']]
    ok(len(comps) == 2 and len(bots) == 2 and bots[0]['custom_id'] == 'dd:mis' and bots[0]['label'] == 'Abrir mis premios',
       'UN SOLO BOTÓN de premios, «Abrir mis premios», para todos (antes eran seis, uno por ganador y por premio)')
    ok(bots[1] == BOTON_VINCULAR and bots[1]['style'] == 5 and bots[1]['url'].endswith('/cuenta/verificar')
       and bots[1]['label'].endswith('≈1m') and len(bots[1]['label']) <= 40,
       '🔗 quien no está vinculado: al lado, el botón para vincularte (un link a la página, corto: «≈1m», ≤40 letras)')
    vista = io.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'vista.js'), encoding='utf-8').read()
    ok("TXT_VINCULAR = '%s'" % TXT_VINCULAR in vista and "PAGINAS + '/cuenta/verificar'" in vista,
       'el botón dice lo mismo y va al mismo lugar que el que el Worker suma solo (bot/vista.js)')
    cp, _ip, _tp = mensaje('__ TOKYO VOL 27 __', 'FFA', G['700'], Q, {'111111'}, None, P, solo_premios=True)
    ok(cp[0]['content'].startswith('### 🎁 Los premios de TOKYO VOL 27') and 'Terminó' not in cp[0]['content'],
       'con la imagen en el cierre, el aviso se titula «Los premios de…»')
    c2, _i2, t2 = mensaje('(sin titulo)', 'LKR', {'camp': ('Ana', 'drop'), 'pod': [], 'bat': []}, Q, {'111111'})
    t2j = json.dumps(c2, ensure_ascii=False)
    ok('Terminó el evento' in t2j and 'Star' not in t2j and 'Drop** por el título: <@111111>' in t2j,
       'sin título, «Terminó el evento»; sin batacazos, sin esa línea; el campeón con su Drop')
    ok(_titulo('**__ NEW GENESIS __**') == 'NEW GENESIS' and _titulo('(sin titulo)') == '', 'el adorno del título se va')
    res3 = [['Evento #', 'Fecha', 'Servidor', 'Rapero', 'Posición'],
            ['800', '13/11/2026', 'ACAD', 'Zanti', 'Campeón'], ['800', '13/11/2026', 'ACAD', 'Mayeu', 'Campeón'],
            ['800', '13/11/2026', 'ACAD', 'Mini', 'Campeón'], ['800', '13/11/2026', 'ACAD', 'Chuwin', 'Subcampeón'],
            ['800', '13/11/2026', 'ACAD', 'Leyenda', 'Subcampeón'], ['800', '13/11/2026', 'ACAD', 'Oasis', 'Subcampeón']]
    Q3 = {n: str(900000 + i) for i, n in enumerate(['Zanti', 'Mayeu', 'Mini', 'Chuwin', 'Leyenda', 'Oasis'])}
    G3 = ganadores(res3, [['Evento #', 'Fecha', 'Ganador', 'Perdedor']], Q3, dt.date(2026, 11, 1))
    ok(len(G3['800']['camps']) == 3 and G3['800']['camp'] == G3['800']['camps'][0],
       'por equipos: los TRES campeones, cada uno con su premio (antes quedaba sólo el último)')
    c3b, ids3, _t3b = mensaje('PANDILLAS', 'ACAD', G3['800'], Q3, set())
    ok(len(ids3) == 6 and '<@900000>, <@900001> y <@900002>' in json.dumps(c3b, ensure_ascii=False)
       and len([b for c in c3b if c['type'] == 1 for b in c['components']]) == 1,
       'los tres campeones juntos en una línea, los seis mencionados, y un solo botón')
    ok(mensaje('X', 'FFA', {'camp': None, 'pod': ['Ana'], 'bat': []}, Q, set()) is None, 'sin campeón, no hay aviso')
    ok(_md('@everyone') == '@​everyone', 'un nombre con @ no puede mencionar a nadie')
    ok(_fecha('17/11', dt.date(2026, 11, 18)) == dt.date(2026, 11, 17) and _fecha('31/12', dt.date(2027, 1, 1)) == dt.date(2026, 12, 31),
       'la fecha de la hoja (dd/mm), también la del año anterior')
    # 🌙 la imagen «La noche de…»: sólo desde NOCHE_DESDE, y al pie del recuadro
    ok(noche(str(NOCHE_DESDE - 1), Q) == ([], None) and noche('abc', Q) == ([], None),
       '🌙 los eventos de antes de NOCHE_DESDE no llevan imagen (Dlx: «NO los actuales y pasados»)')
    pie = pie_noche('La noche de TOKYO: campeón Ana (9,1)', True, '700')
    fila = [b.get('custom_id') or b.get('url') for b in pie[1]['components']]
    ok(pie[0]['type'] == 12 and pie[0]['items'][0]['media']['url'] == 'attachment://noche.png'
       and pie[0]['items'][0]['description'].startswith('La noche de TOKYO'), 'la imagen va en una Galería, con su descripción')
    ok(len(fila) == 5 and fila[:2] == ['nn:nota:700', 'nn:perf:700'] and fila[2].endswith('/freestyle-rap/llave/700')
       and fila[3].endswith('/freestyle-rap/ranking') and fila[4].endswith('/freestyle-rap/eventos'),
       'cinco botones: Tu nota, Perfiles (del Worker) y La llave, Ranking, Próximos eventos (links)')
    ok([b.get('url', '')[-6:] for b in fila_noche('700', False)['components']] == ['ve/700', 'anking', 'ventos'],
       'sin la ficha en KV, sólo los tres links (ningún botón que conteste «no está»)')
    cj = cuerpo(comps, ids)
    cm = cuerpo(comps + pie, ids, ('noche.png', b'png'))
    pj = json.loads(cm['data']['payload_json'])
    ok('json' in cj and cj['json']['flags'] == 32768 and cm['files']['files[0]'][0] == 'noche.png'
       and pj['attachments'] == [{'id': 0, 'filename': 'noche.png'}] and cm['headers'] == {'Content-Type': None}
       and [c['type'] for c in pj['components']][-3:] == [12, 1, 1] and pj['allowed_mentions']['users'] == ids,
       'con imagen va en multipart (payload_json + files[0]); sin imagen, JSON como siempre')
    pu = pie_con_url(pie, 'https://r2/noche/700-abc.png')
    ok(pu[0]['items'][0]['media']['url'] == 'https://r2/noche/700-abc.png'
       and pu[0]['items'][0]['description'].startswith('La noche de TOKYO') and pu[1] == pie[1]
       and pie[0]['items'][0]['media']['url'] == 'attachment://noche.png',
       'sin cierre, la imagen va en el aviso como link a R2 (no pide «Adjuntar archivos»), con su descripción y sus botones')
    ok(pie_con_url(pie, None) is pie and pie_con_url(pie[1:], 'https://x') == pie[1:],
       'sin link, el pie queda como estaba; sin imagen, no inventa una')
    cu = cuerpo(comps + pu, ids)
    ok('json' in cu and 'files' not in cu and cu['json']['components'][-3]['items'][0]['media']['url'].startswith('https://'),
       'con link, el aviso va en JSON, sin archivo adjunto')
    # 🌙 «La noche de…» en el cierre del bot en vivo, en lugar de la tarjeta (`con_noche()`)
    U = 'https://r2/noche/700-abc.png'
    v2 = {'flags': 32768, 'components': [{'type': 10, 'content': '🏆 <@1>'},
                                         {'type': 17, 'components': [{'type': 10, 'content': '### Campeón'}]},
                                         {'type': 12, 'items': [{'media': {'url': 'https://r2/ana/servidor.webp'}}]}]}
    p = con_noche(v2, U, 'La noche de COPA')
    ok([c['type'] for c in p['components']] == [10, 17, 12] and p['components'][2]['items'] == [
        {'media': {'url': U}, 'description': 'La noche de COPA'}] and p['components'][1] == v2['components'][1]
       and p['allowed_mentions'] == {'parse': []},
       'en V2, la tarjeta de abajo del recuadro se cambia por la imagen y el texto queda igual')
    sin = {'flags': 32768, 'components': v2['components'][:2]}
    ok([c['type'] for c in con_noche(sin, U, '')['components']] == [10, 17, 12],
       'un cierre V2 sin tarjeta (campeones de a varios) la suma abajo')
    con_bot = {'flags': 32768, 'components': v2['components'][:2] + [{'type': 1, 'components': [{'type': 2, 'style': 5, 'url': 'x'}]}]}
    ok([c['type'] for c in con_noche(con_bot, U, '')['components']] == [10, 17, 12, 1],
       'y si tiene botones, la imagen va arriba de ellos (los botones van debajo de la imagen)')
    v1 = {'flags': 0, 'embeds': [{'description': 'campeón', 'image': {'url': 'https://r2/ana/servidor.webp'}}]}
    p1 = con_noche(v1, U, '')
    ok(p1['embeds'][0]['image'] == {'url': U} and p1['embeds'][0]['description'] == 'campeón'
       and v1['embeds'][0]['image']['url'].endswith('servidor.webp'),
       'en el formato de antes, la imagen del embed (sin tocar el mensaje que se leyó)')
    ok(con_noche({'flags': 0, 'content': 'hola'}, U, '') is None, 'sin embed ni componentes, no hay dónde ponerla')
    # 🔘 los botones de la imagen van con ella, en el cierre (Dlx, 19/11/2026: «esos botones… son de la primera»)
    F = fila_noche('700')
    pf = con_noche(v2, U, '', F)
    ok([c['type'] for c in pf['components']] == [10, 17, 12, 1] and pf['components'][3] == F,
       '🔘 en el cierre, la fila de la imagen (Tu nota, Perfiles, La llave…) va justo debajo de ella')
    pb = con_noche(con_bot, U, '', F)
    ok([c['type'] for c in pb['components']] == [10, 17, 12, 1, 1] and pb['components'][3] == F,
       'si el cierre ya tenía botones, la fila de la imagen va debajo de la imagen y los de antes quedan')
    ok(len([c for c in con_noche(dict(v2, components=pf['components']), U, '', F)['components'] if c['type'] == 1]) == 1,
       'una segunda vuelta no repite la fila')
    pv = con_noche(v1, U, '', F)
    ok(pv.get('components') == [F], 'en el formato de antes, la fila va como componentes del mensaje')
    # 🃏 «Consigue tu tarjeta», en su propia fila debajo de los cinco (Dlx, 20/11/2026: «agrega el botón consigue tu tarjeta ahí»)
    T = pie[2]['components'] if len(pie) > 2 else []
    ok(len(pie) == 3 and len(T) == 1 and T[0]['label'] == 'Consigue tu tarjeta' and T[0]['url'].endswith('/freestyle-rap/tarjetas')
       and all(len(c['components']) <= 5 for c in pie[1:]),
       '🃏 debajo de los cinco botones, una fila con «Consigue tu tarjeta» (Discord no deja más de cinco por fila)')
    F2 = filas_noche('700')
    p2 = con_noche(v2, U, '', F2)
    ok([c['type'] for c in p2['components']] == [10, 17, 12, 1, 1] and p2['components'][3:5] == F2
       and len([c for c in con_noche(dict(v2, components=p2['components']), U, '', F2)['components'] if c['type'] == 1]) == 2,
       '🃏 en el cierre van las dos filas debajo de la imagen, y una segunda vuelta no las repite')
    ok(con_noche(v1, U, '', F2).get('components') == F2
       and con_noche(dict(v1, components=[{'type': 1, 'components': []}] * 4), U, '', F2)['components'][-1] == F2[0],
       '🃏 en el formato de antes también; si no entran las dos (cinco filas como mucho), va la de la imagen sola')
    print('\n   %s' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return 1 if mal else 0


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if '--auto' in sys.argv:
        return _self_check()
    return correr(aplicar='--aplicar' in sys.argv)


if __name__ == '__main__':
    sys.exit(main())
