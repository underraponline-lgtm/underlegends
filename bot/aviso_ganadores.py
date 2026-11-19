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
- BOTONES (desde el 18/11/2026): UNO POR GANADOR Y POR PREMIO, con su nombre, que sólo abre esa persona
  (`dd:<drop|star|nido>:x:<id>`, worker.js); el del Nido le pasa el link de la página, donde se abre. «Ver mis drops»
  (`?drops=1`), al costado de los premios. Antes eran
  «Abrir mi Drop / Star» sin dueño, y cualquiera abría los suyos desde el aviso de otro.
- EL FORMATO, el de los anuncios de la Liga (Componentes V2): un recuadro con el color del servidor, con los puntos del
  evento por puesto, y LAS MENCIONES AFUERA, en una línea arriba (Dlx: «gente dentro del embed no se menciona»).
- 🌙 AL PIE, LA IMAGEN «LA NOCHE DE…» (`bot/noche.py`, Dlx 18/11/2026: la nota de cada uno, el MVP, el batacazo y el
  ELO, como al final de un partido) y una fila de cinco botones: 🎯 Tu nota y 👤 Perfiles (los contesta el Worker,
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


def mensaje(evento, sv, g, Q, miembros, oficiales=None, puntos=None):
    """`(componentes, ids, texto)` del aviso de un evento: un mensaje de Componentes V2 (`flags` 32768) con su texto
    plano para la consola. `g`: lo de `ganadores()`; `Q`: nombre → Discord ID; `miembros`: los IDs de DRA (los drops
    por ganar se abren siendo miembro). Sin campeón, `None`.

    🎨 REHECHO EL 18/11/2026 (Dlx, con la captura del primero, el de NEW GENESIS: «asegúrate también que estos botones
    sólo los abran las respectivas personas… y remakear ese texto también»). Era texto suelto con «Abrir mi Drop» y
    «Abrir mi Star» sin dueño: cualquiera que tuviera un drop guardado abría el SUYO desde el aviso de otro. Ahora:
    - el formato de los anuncios de la Liga (la v1.07): un recuadro con la barra del color del servidor, el evento
      arriba, el campeón, los premios y la letra chica;
    - UN BOTÓN POR GANADOR Y POR PREMIO, con su nombre («Drop · Oasis»), que sólo abre esa persona (`dd:<tipo>:x:<id>`:
      el Worker contesta «eso es de otra persona» a los demás). El Nido no se abre en Discord: su botón le manda el
      link de la página, sólo a él (`dd:nido`);
    - el título sin el adorno del organizador (`_titulo()`).

    🔁 SEGUNDA VUELTA, EL MISMO DÍA (Dlx, a la muestra por DM: «recuerda que gente dentro del embed no se menciona.
    ¿Dónde están las puntuaciones al finalizar el evento? Eso de si todavía no eres miembro de DRA, quita eso»):
    - LAS MENCIONES VAN AFUERA del recuadro, en una línea de texto arriba (un Text Display suelto): adentro, los nombres
      van en negrita;
    - LOS PUNTOS DEL EVENTO, por puesto (`puntos`, de `puntos_de()`): campeón, subcampeón, semis y cuartos;
    - sin la línea de «si todavía no eres Miembro de DRA» (`miembros` queda en la firma, sin uso).
    """
    if not g.get('camp'):
        return None
    ids, sin, botones = [], [], []
    banderas = {n: cc for _pos, gente in (puntos or []) for n, cc, _p in gente}

    def nombre(n):
        """Adentro del recuadro: el nombre en negrita, con su bandera. Y anota a quién mencionar afuera"""
        i = Q.get(n)
        if i:
            if i not in ids:
                ids.append(i)
        elif n not in sin:
            sin.append(n)
        fl = _bandera(banderas.get(n))
        return '**%s**%s' % (_md(n), ' ' + fl if fl else '')

    def boton(tipo, n):
        i = Q.get(n)
        cid = 'dd:%s:x:%s' % (tipo, i) if i else ''
        if not i or len(botones) >= BOTONES or any(b['custom_id'] == cid for b in botones):
            return
        emoji, premio = {'nido': ('🥚', 'Nido'), 'drop': ('🎁', 'Drop'), 'star': ('⚡', 'Star')}[tipo]
        botones.append({'type': 2, 'style': 1 if tipo != 'nido' else 2, 'label': ('%s · %s' % (premio, (oficiales or {}).get(i) or n))[:80],
                        'emoji': {'name': emoji}, 'custom_id': cid})

    def y(xs):
        xs = list(xs)
        return xs[0] if len(xs) == 1 else ', '.join(xs[:-1]) + ' y ' + xs[-1]

    titulo = _titulo(evento)
    nombre_sv, color = _sv_info(sv) if sv else ('', COLOR_UL)
    camps = g.get('camps') or [g['camp']]
    cabeza = '## 🏆 %s\n-# %s' % (_md(titulo) if titulo else 'Terminó el evento',
                                  ('Terminó en **%s**' % _md(nombre_sv)) if nombre_sv else 'Terminó')
    if len(camps) == 1:
        camp, tipo = camps[0]
        corona = '👑 Campeón: %s\n%s Se lleva un **%s** por el título.' % (
            nombre(camp), '🥚' if tipo == 'nido' else '🎁', 'Nido' if tipo == 'nido' else 'Drop')
    else:
        # 👥 por equipos: los campeones juntos, y cada uno con lo suyo (el Nido es el primer título de SU semana)
        corona = '👑 Campeones: %s\n%s' % (' + '.join(nombre(c) for c, _t in camps), '\n'.join(
            '%s %s se lleva un **%s** por el título.' % ('🥚' if t == 'nido' else '🎁', nombre(c), 'Nido' if t == 'nido' else 'Drop')
            for c, t in camps))
    for c, t in camps:
        boton('nido' if t == 'nido' else 'drop', c)
    premios = []
    if g.get('pod'):
        premios.append('🎁 **Drop** por el podio: %s' % y(nombre(n) for n in g['pod']))
        for n in g['pod']:
            boton('drop', n)
    for gan, perd in g.get('bat') or []:
        premios.append('⚡ **Star** por el batacazo: %s, que le ganó a **%s**' % (nombre(gan), _md(perd)))
        boton('star', gan)
    # 📊 los puntos del evento, por puesto
    tabla = []
    for pos, gente in (puntos or [])[:PUESTOS]:
        pts = sorted({p for _n, _c, p in gente}, reverse=True)
        cuanto = _miles(pts[0]) + (' c/u' if len(gente) > 1 and len(pts) == 1 else '') if pts else ''
        quienes = ', '.join('%s%s' % (_md(n), ' ' + _bandera(c) if _bandera(c) else '') for n, c, _p in gente)
        tabla.append('%s **%s** · %s · **%s**' % (MEDALLA.get(pos, '▫️'), _md(pos), quienes, cuanto))
    resto = sum(len(gente) for _pos, gente in (puntos or [])[PUESTOS:])
    if resto:
        tabla.append('-# y %d más sumaron puntos: la tabla entera, en la página' % resto)
    # 🧹 sin «Cada botón lo abre sólo quien ganó…» ni «Ver mis drops» suelto al final (Dlx, a la muestra 2: «elimina ese
    # texto… queda raro que esté solo, la parte del final»): el link va en la fila de los botones
    chica = []
    if sin:
        chica.append('-# 🔗 %s: vincula tu cuenta con `/vincular` en los próximos 14 días y lo que ganaste es tuyo.'
                     % y('**%s**' % _md(n) for n in sin))
    # 🐉 «VER MIS DROPS», AL COSTADO DE LOS PREMIOS (Dlx, 18/11/2026: primero «queda raro ver mis drops solo, hay un espacio
    # ahí vacío» —con cuatro ganadores Discord lo bajaba a otra línea, solo— y después «pero ver drops creo que es necesario…
    # las tarjetas son el lugar donde más gente ha entrado»: el link a la página es lo que trae gente). Va como el botón
    # de una Sección (type 9): a la derecha del texto de los premios, o del campeón si no hay premios. Nunca queda solo
    ver = {'type': 2, 'style': 5, 'label': 'Ver mis drops', 'emoji': {'name': '🐉'}, 'url': WEB_DROPS}
    # 🛡️ el título con el logo del servidor a la derecha (una Sección con su miniatura), si el servidor tiene logo
    logo = _logo(sv)
    adentro = [{'type': 9, 'components': [{'type': 10, 'content': cabeza}], 'accessory': {'type': 11, 'media': {'url': logo}}}
               if logo else {'type': 10, 'content': cabeza},
               {'type': 9, 'components': [{'type': 10, 'content': corona}], 'accessory': ver} if not premios
               else {'type': 10, 'content': corona}]
    if tabla:
        adentro += [{'type': 14, 'divider': True, 'spacing': 1}, {'type': 10, 'content': '### 📊 Los puntos\n' + '\n'.join(tabla)}]
    if premios:
        adentro += [{'type': 14, 'divider': True, 'spacing': 1},
                    {'type': 9, 'components': [{'type': 10, 'content': '### 🎁 Los premios\n' + '\n'.join(premios)}], 'accessory': ver}]
    if chica:
        adentro.append({'type': 10, 'content': '\n'.join(chica)})
    # 🧱 en filas PAREJAS (con seis: 3 y 3, no 5 y 1): uno solo abajo quedaba suelto, como «Ver mis drops»
    por_fila = -(-len(botones) // -(-len(botones) // 5)) if botones else 5
    adentro += [{'type': 1, 'components': botones[i:i + por_fila]} for i in range(0, len(botones), por_fila)]
    comps = [{'type': 17, 'accent_color': color, 'components': adentro}]
    # 🔔 las menciones, AFUERA del recuadro y arriba: la única línea que suena
    if ids:
        afuera = '🏆 Terminó **%s**: %s, sus premios están abajo 👇' % (_md(titulo) if titulo else 'el evento', y('<@%s>' % i for i in ids[:MENCIONES]))
        comps.insert(0, {'type': 10, 'content': afuera})
    texto = '\n'.join(([comps[0]['content']] if ids else []) + [cabeza, corona] + tabla + premios
                      + ['[%s]' % ' '.join(b['label'] for b in botones)] + chica)
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


def pie_noche(alt, con_ficha, ev):
    """🌙 Lo que va DEBAJO del recuadro: la imagen (una Galería de Medios con su descripción) y la fila de botones."""
    return [{'type': 12, 'items': [{'media': {'url': 'attachment://noche.png'}, 'description': alt[:1000]}]},
            fila_noche(ev, con_ficha)]


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
# lleva el aviso de otro evento o si Discord no la toma, la imagen va en el aviso, como antes.
def con_noche(msg, url, alt):
    """El cuerpo del PATCH que cambia la imagen de `msg` (el mensaje como lo devuelve Discord) por `url`: en Componentes
    V2, la galería de afuera del recuadro (o una nueva al final); en el formato de antes, la imagen del primer embed.
    `None` si no hay dónde ponerla. No menciona a nadie (una edición no suena igual)."""
    item = {'media': {'url': url}, 'description': str(alt or '')[:1000]}
    if int(msg.get('flags') or 0) & 32768:
        comps = [dict(c) for c in msg.get('components') or []]
        i = next((j for j, c in enumerate(comps) if c.get('type') == 12), None)
        if i is None:
            comps.append({'type': 12, 'items': [item]})
        else:
            comps[i] = {'type': 12, 'items': [item]}
        return {'components': comps, 'allowed_mentions': {'parse': []}}
    es = [dict(e) for e in msg.get('embeds') or []]
    if not es:
        return None
    es[0]['image'] = {'url': url}
    return {'embeds': es, 'allowed_mentions': {'parse': []}}


def _subir_noche(ev, png):
    """La imagen a R2 (pública, como las tarjetas), con su huella en el nombre: Discord guarda lo que bajó de una URL.
    La URL, o `None`."""
    import hashlib
    import subir_cartas as SC
    clave = 'noche/%s-%s.png' % (ev, hashlib.sha1(png).hexdigest()[:10])
    r = SC.sesion().put('%s/objects/%s' % (SC.API, clave), data=png, headers={'Content-Type': 'image/png'}, timeout=60)
    return '%s/%s' % (SC.PUBLICA, clave) if SC._ok(r, clave) is not None else None


def al_cierre(ev, nombre, sv, fecha, png, alt, s):
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
        cuerpo_ = con_noche(r.json() or {}, url, alt) if url else None
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
            print('      🌙 + la imagen «La noche de…» y sus cinco botones')
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
            en_cierre = al_cierre(ev, nombre, sv, fecha, archivo[1], alt, s)
            if en_cierre:
                print('      🌙 la imagen, en el cierre del bot en vivo (en lugar de la tarjeta): el aviso va sin ella')
                pie, archivo = pie[1:], None
        r = s.post('%s/channels/%s/messages' % (API, canal), **cuerpo(comps + pie, ids, archivo))
        if archivo and r.status_code not in (200, 201):
            print('      ⚠️ con la imagen no salió (%s): va sin ella' % r.status_code)
            r = s.post('%s/channels/%s/messages' % (API, canal), **cuerpo(comps + [fila_noche(ev, False)], ids))
        if r.status_code in (200, 201):
            avisados[ev] = {'sv': sv, 'canal': str(canal), 'msg': str((r.json() or {}).get('id') or ''), 'dia': hoy.isoformat()}
            if en_cierre:
                avisados[ev]['noche'] = en_cierre
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
    afuera = comps[0]
    caja = json.dumps(comps[1], ensure_ascii=False)
    bots = [b for c in comps[1]['components'] if c['type'] == 1 for b in c['components']]
    ok(afuera['type'] == 10 and '<@111111>' in afuera['content'] and '<@222222>' in afuera['content'] and ids == ['111111', '222222'],
       'las menciones van AFUERA del recuadro, arriba, una vez cada uno')
    ok(comps[1]['type'] == 17 and comps[1]['accent_color'] == 0x26045B and '<@' not in caja,
       'adentro del recuadro (con el color del servidor) no hay ninguna mención: los nombres van en negrita')
    ok('Los puntos' in caja and '10.000' in caja and '5.250 c/u' in caja and 'Dani 🇨🇴' in caja and 'y 1 más' in caja and 'Fer' not in caja,
       'los puntos: campeón, sub, semis (c/u) y cuartos, con bandera; del resto, cuántos')
    ok('## 🏆 TOKYO VOL 27' in caja and '__' not in caja.split('TOKYO')[0][-5:], 'el título sin los «__» del organizador')
    ok('**Caro\\\\*' in caja and '/vincular' in caja, 'quien no tiene cuenta va en negrita (escapado) y con cómo vincularse')
    ok('Miembro de DRA' not in json.dumps(comps, ensure_ascii=False) and 'Cada botón' not in caja,
       'sin la línea de «si todavía no eres Miembro de DRA» ni la de «cada botón lo abre…»')
    filas = [c for c in comps[1]['components'] if c['type'] == 1]
    secs = [c for c in comps[1]['components'] if c['type'] == 9 and c['accessory'].get('type') == 2]
    ok(comps[1]['components'][-1]['type'] == 1 and len(filas) == 1 and 'Ver mis drops' not in json.dumps(filas, ensure_ascii=False)
       and len(secs) == 1 and secs[0]['accessory'].get('url') == WEB_DROPS and 'Los premios' in secs[0]['components'][0]['content'],
       '«Ver mis drops» al costado de los premios (una Sección), nunca solo en una fila; termina con los botones de los ganadores')
    cids = [b.get('custom_id') for b in bots]
    ok(cids[:3] == ['dd:nido:x:111111', 'dd:drop:x:222222', 'dd:star:x:222222'] and 'dd:drop:x:' not in cids
       and [b.get('label') for b in bots][:3] == ['Nido · Ana', 'Drop · Beto', 'Star · Beto'],
       'un botón por ganador y premio, con su nombre y su dueño (Caro no tiene cuenta: sin botón); ninguno sin dueño')
    c2, _i2, t2 = mensaje('(sin titulo)', 'LKR', {'camp': ('Ana', 'drop'), 'pod': [], 'bat': []}, Q, {'111111'})
    t2j = json.dumps(c2, ensure_ascii=False)
    ok('Terminó el evento' in t2j and 'dd:star' not in t2j and 'Los puntos' not in t2j and 'dd:drop:x:111111' in t2j
       and c2[-1]['components'][1]['type'] == 9 and c2[-1]['components'][1]['accessory'].get('url') == WEB_DROPS,
       'sin título, «Terminó el evento»; sin batacazos ni puntos, sin esas partes; el campeón con su Drop y «Ver mis drops» a su lado')
    ok(_titulo('**__ NEW GENESIS __**') == 'NEW GENESIS' and _titulo('(sin titulo)') == '', 'el adorno del título se va')
    cab0 = comps[1]['components'][0]
    ok(cab0['type'] == 9 and cab0['accessory']['type'] == 11 and cab0['accessory']['media']['url'].endswith('/logos/ffa.webp')
       and '## 🏆' in cab0['components'][0]['content'], 'el título lleva el logo del servidor a la derecha (FFA tiene)')
    c_sin, _i, _t = mensaje('X', 'ZZZ', {'camp': ('Ana', 'drop'), 'pod': [], 'bat': []}, Q, set())
    ok(c_sin[-1]['components'][0]['type'] == 10, 'un servidor sin logo: el título solo, sin miniatura rota')
    res3 = [['Evento #', 'Fecha', 'Servidor', 'Rapero', 'Posición'],
            ['800', '13/11/2026', 'ACAD', 'Zanti', 'Campeón'], ['800', '13/11/2026', 'ACAD', 'Mayeu', 'Campeón'],
            ['800', '13/11/2026', 'ACAD', 'Mini', 'Campeón'], ['800', '13/11/2026', 'ACAD', 'Chuwin', 'Subcampeón'],
            ['800', '13/11/2026', 'ACAD', 'Leyenda', 'Subcampeón'], ['800', '13/11/2026', 'ACAD', 'Oasis', 'Subcampeón']]
    Q3 = {n: str(900000 + i) for i, n in enumerate(['Zanti', 'Mayeu', 'Mini', 'Chuwin', 'Leyenda', 'Oasis'])}
    G3 = ganadores(res3, [['Evento #', 'Fecha', 'Ganador', 'Perdedor']], Q3, dt.date(2026, 11, 1))
    ok(len(G3['800']['camps']) == 3 and G3['800']['camp'] == G3['800']['camps'][0],
       'por equipos: los TRES campeones, cada uno con su premio (antes quedaba sólo el último)')
    c3b, ids3, _t3b = mensaje('PANDILLAS', 'ACAD', G3['800'], Q3, set())
    filas3 = [c['components'] for c in c3b[-1]['components'] if c['type'] == 1]
    ok(len(ids3) == 6 and [len(f) for f in filas3] == [3, 3] and 'Campeones:' in json.dumps(c3b, ensure_ascii=False),
       'los seis con su botón, en dos filas de tres (no cinco y uno), y «Campeones» con los tres')
    c3, _i3, _t3 = mensaje('X', 'FFA', {'camp': ('rodrilp', 'drop'), 'pod': [], 'bat': []}, {'rodrilp': '333333'}, set(), {'333333': 'Rodri LP'})
    ok('Drop · Rodri LP' in json.dumps(c3, ensure_ascii=False), 'el botón con el nombre de la Lista, no con la clave de la hoja')
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
       and pj['components'][-2]['type'] == 12 and pj['allowed_mentions']['users'] == ids,
       'con imagen va en multipart (payload_json + files[0]); sin imagen, JSON como siempre')
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
    v1 = {'flags': 0, 'embeds': [{'description': 'campeón', 'image': {'url': 'https://r2/ana/servidor.webp'}}]}
    p1 = con_noche(v1, U, '')
    ok(p1['embeds'][0]['image'] == {'url': U} and p1['embeds'][0]['description'] == 'campeón'
       and v1['embeds'][0]['image']['url'].endswith('servidor.webp'),
       'en el formato de antes, la imagen del embed (sin tocar el mensaje que se leyó)')
    ok(con_noche({'flags': 0, 'content': 'hola'}, U, '') is None, 'sin embed ni componentes, no hay dónde ponerla')
    print('\n   %s' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return 1 if mal else 0


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if '--auto' in sys.argv:
        return _self_check()
    return correr(aplicar='--aplicar' in sys.argv)


if __name__ == '__main__':
    sys.exit(main())
