# -*- coding: utf-8 -*-
"""🤝 LOS TIERS: en qué nivel está cada servidor socio, y cómo viene trabajando cada uno.

    python bot/tiers.py            el puntaje de cada servidor, sin escribir ni mandar nada
    python bot/tiers.py --aplicar  y deja los niveles en datos/niveles.json y el puntaje en el Dashboard (paso 2b8f)
    python bot/tiers.py --auto     el self-check, sin red ni archivos

Dlx, 18/10/2026: *«necesitamos hacer 3 tier levels of association with us… todos nuestros partners ahora son TIER 1.
Pero hay otras asociaciones chicas, comunidades de distinto tipo, que se quieren asociar… no les podemos dar todos los
tiers»*. Y a las preguntas: *«Tier 1, Tier 2 y Tier 3»* (sin nombres); el Tier 2 **no suma** al ranking; el Tier 3 sin
el bot (lo recomendé: a los 100 servidores Discord pide verificar el bot y aprobar los permisos de leer mensajes); y
para subir, las tres cosas juntas: *«por números pero no sólo eso: el sistema recomienda y muestra qué tan bien los
servidores han hecho su trabajo»*, y decide él.

QUÉ ES CADA UNO
  · TIER 1: sus eventos suman al ranking oficial y lleva todo (el bot completo, su carta, los multiplicadores…), y es
    el único que sale en «Unirme a los Tier 1» (el botón que te suma a sus servidores: `cuentaUnirse()` del Worker).
  · TIER 2: TODO LO DEL TIER 1 MENOS ESE BOTÓN, desde el 19/11/2026. Dlx: *«Tier 2 que cuenten sus eventos para
    competitivo y tener su tarjeta de servidor aun así. No tendrían ese de que el bot les agregue a todos los servidores»*,
    *«1. A»* (sus MES AWARDS también) y *«2. se queda para tier 2»* (sus ligas cuentan como duelos). Pasaron SR, FRZ,
    ACAD y FVS (*«SNK, FRZ, LCW a tier 2»*, *«FVS pásalo a tier 2»*); los Tier 3 se quedan donde están por ahora.
    ⚠️ Hasta ese día el Tier 2 era «sólo calendario y campana, sin sumar» y después lo mismo que el Tier 3 (`PRESET`):
    no lo tenía nadie.
  · TIER 3: su página de servidor y sus ligas en Ligas (sin contar como duelos); sin carta de Servidor ni puntos.
    ⚠️ DECÍA «el directorio, sin el bot» hasta el 20/10/2026, y FDS entró a Tier 3 CON el bot (Dlx: «para cualquier
    TIER meter el bot, así nos beneficiamos de información y de IDs… pero que no necesariamente convierta a tener esos
    beneficios»). El bot adentro es lo que hace posible leerle las ligas y reconocer a su gente.

🔑 Y LO QUE ES DE TODOS, EN CUALQUIER TIER (Dlx, 20/10/2026: «I want their events to be promoted and social media. I
think that should be a general benefit… because we provide information to the Liga Global»): sus eventos en el
calendario, la campana y Publicaciones, y sus redes en Socios. Por eso `bot/anuncios.py` lee a TODOS los confirmados sin
mirar el tier; lo que el tier apaga es que sus llaves cuenten para el Competitivo (desde el 19/11/2026, el Tier 3 también
cuenta sus ligas como duelos).

DE DÓNDE SALE EL NIVEL: lo elige Dlx en el Dashboard (ajuste `tiers`, `{sigla: 1|2|3}`); sin elegir, el `tier` escrito en
`datos/servidores.json`, y si tampoco, Tier 1 quien está en la Liga. El ciclo lo copia a `datos/niveles.json` (público:
es lo que dice la página) y de ahí lo leen el lector de llaves (`escuchar._guilds_liga()`) y las ligas
(`ligas.duelos()`), con `bajados()`.

🔴 EL `tier` DEL JSON EXISTE PORQUE EL DEFAULT ERA EL PEOR: «sin elegir, Tier 1» significaba que un servidor nuevo que
Dlx todavía no tocó en el Dashboard —FDS, el 20/10/2026, a las horas de decidir que NO suma— arrancaba sumando al ranking
en la corrida siguiente, y el ajuste del Dashboard REEMPLAZA entero a `niveles.json` (ver `correr()`), así que escribir el
3 ahí no alcanzaba. Un default que no es la decisión es un bug que no avisa.

EL PUNTAJE (0–100, de las últimas 4 semanas, contra las 4 de antes) va SÓLO al Dashboard (`/avisos/tiers-ciclo`): no al
repo, que es público. Cuatro partes, con lo que ya medimos:
  · ACTIVIDAD (35): eventos jugados por semana (2 por semana es el máximo).
  · ALCANCE (25): raperos por evento (16 es el máximo) y gente nueva que trajo (10 en 4 semanas).
  · CALIDAD (25): lo que el bot lee sin ayuda (preguntas de ✅ Decidir y correcciones por evento), anuncios que dicen
    su staff, y eventos cancelados.
  · COMUNIDAD (15): de su gente nueva, cuántos volvieron a jugar; promos que compartió; ligas activas.
"""
import datetime as dt
import io
import json
import os
import re
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

NIVELES = os.path.join(BASE, 'datos', 'niveles.json')
TIERS = (1, 2, 3)
#: las semanas que se miran (y otras tantas antes, para la tendencia)
SEMANAS = 4
#: 🏠 la casa de la Liga: no es un socio que se evalúa (DRA abre el lunes 19/10/2026 y no tiene eventos todavía)
CASA = frozenset({'DRA'})
#: 👥 LOS MIEMBROS DE SU DISCORD SON SÓLO UNA RECOMENDACIÓN, UNA POR TIER (Dlx, 19/11/2026: «Eso de 300 miembros quita el
#: requisito de tener miembros. La cantidad no define, pero puedes poner recomendado. Tier 1 que tengan 1000 usuarios.
#: Tier 2 500 tier 3 100. recomendado»). Hasta ese día el Tier 1 pedía 300 como mínimo (18/10/2026). Ningún servidor sube,
#: baja ni queda en «revisar» por sus miembros: `recomendar()` y `como_subir()` sólo lo dicen, aparte de lo que se pide
RECOMENDADO = {1: 1000, 2: 500, 3: 100}


def reglas():
    """📦 Lo que pide y da cada tier, para la página: `tiers_reglas` del lobby (`subir_web.py`). Sale de las mismas
    constantes que `recomendar()` y `como_subir()`, así la página nunca dice otra cosa que el código.
      `rec`:  los miembros que se recomiendan en cada tier (no es requisito)
      `sube`: lo que pide llegar a ese tier desde el de abajo, en una frase
      `da`:   lo que SUMA cada tier sobre el de abajo: las claves de `PRESET` (pagina, calendario, ligas, panel, suma,
              competitivo, duelos) más `carta` (la de Servidor: el Tier 3 no la tiene), `mes_awards` (sólo nomina en 1 y 2,
              `mes_awards.nominar_sv`) y `unirse` («Unirme a los Tier 1», que pregunta por el tier en el Worker)
    Las claves de tier van como texto ('1', '2', '3'): así llegan de un JSON."""
    # 🗞️ y lo del plan de los tiers (20/11/2026): el Tier 2 da estilos, recibe 2 imágenes por semana y vota en el consejo;
    # el Tier 1 recibe 5, regala Pases, saluda a quien llega, tiene su Tarea del Pase, lo nuevo primero y, desde el mismo
    # 20/11 (Dlx: «otro beneficio de TIER 1 es la posibilidad de nosotros hacer camisetas y prendas de los tier 1»), prendas
    da = {3: sorted(PRESET[3]), 2: sorted((PRESET[2] - PRESET[3]) | {'carta', 'mes_awards'}) + ['estilos', 'redes2', 'consejo'],
          1: sorted(PRESET[1] - PRESET[2]) + ['unirse', 'redes5', 'pases_t1', 'tarea_t1', 'bienvenida', 'lo_nuevo', 'prendas']}
    sube = {2: '%d eventos en 8 semanas, con %d raperos por evento de promedio' % (SUBE[2]['eventos'], SUBE[2]['por_evento']),
            1: '%d eventos en 8 semanas, %d raperos por evento de promedio y %d puntos; después, un mes de prueba' % (
                SUBE[1]['eventos'], SUBE[1]['por_evento'], SUBE[1]['puntos'])}
    return {'rec': {str(k): v for k, v in sorted(RECOMENDADO.items())}, 'sube': {str(k): v for k, v in sube.items()},
            'da': {str(k): v for k, v in da.items()}}


def recomendado(tier, gente):
    """«(con N miembros: se recomiendan M)» si el servidor tiene menos que lo recomendado para ese tier; vacío si no se
    sabe cuántos tiene o si llega."""
    rec = RECOMENDADO.get(tier)
    if gente is None or rec is None or gente >= rec:
        return ''
    return ' (con %s miembros: se recomiendan %s)' % (_mil(gente), _mil(rec))


def _mil(n):
    """1000 → «1.000», como se escribe en la página."""
    return '{:,}'.format(int(n)).replace(',', '.')


def _j(*p):
    try:
        with io.open(os.path.join(BASE, *p), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


# ── el nivel de cada uno ─────────────────────────────────────────────────────────────────────────────────────────────
def niveles(servidores=None, guardados=None):
    """`{sigla: tier}` de los servidores de la Liga: lo elegido (`datos/niveles.json`, o el Dashboard), si no el `tier`
    que declara `datos/servidores.json`, y si no Tier 1."""
    svs = servidores if servidores is not None else ((_j('datos', 'servidores.json') or {}).get('servidores') or {})
    g = guardados if guardados is not None else ((_j('datos', 'niveles.json') or {}).get('niveles') or {})
    out = {}
    for sv, x in svs.items():
        if x.get('en_la_liga') is False or not x.get('confirmado'):
            continue
        t = g.get(sv)
        if t not in TIERS:
            t = x.get('tier')
        out[sv] = t if t in TIERS else 1
    return out


# ── 🎛️ LOS BENEFICIOS DE CADA SERVIDOR (Dlx, 20/10/2026: «yo debería tener las herramientas para agregar, qué beneficio
# dar que no, qué tier, a cada servidor nuevo», y a la propuesta, «Dale») ─────────────────────────────────────────────
# El tier es un PRESET: prende un grupo de beneficios. En el Dashboard, cada servidor tiene además un interruptor por
# beneficio (ajuste `beneficios`, `{sigla: {beneficio: bool}}`) que manda sobre el preset. El ciclo deja el resultado en
# `datos/niveles.json` (`beneficios`) y cada lector pregunta con `sin()`.
#
# ⚠️ SÓLO LOS QUE ESTÁN CABLEADOS. Son los seis que un lector de verdad respeta hoy; la carta de Servidor, los
# multiplicadores, los MES AWARDS y el anti-raid NO están acá porque prenderlos o apagarlos no cambiaría nada todavía, y un
# interruptor que no hace nada es peor que no tenerlo.
BENEFICIOS = (
    ('pagina', 'Su página en Socios'),
    ('calendario', 'Sus eventos: calendario, campana y Publicaciones'),
    ('ligas', 'Sus ligas en Ligas'),
    ('panel', 'El panel de su dueño'),
    ('suma', 'Sus llaves suman a la Temporada'),
    ('competitivo', 'Sus llaves cuentan para el Competitivo y los duelos'),
    ('duelos', 'Sus ligas cuentan como duelos'),
)
#: lo que prende cada tier. Los eventos y la página son de todos (Dlx, 20/10: «a general benefit»).
#: 🏆 SUMAR A LA TEMPORADA, TODOS LOS SOCIOS (Dlx, 26/10/2026: «cada servidor que sea socio nuestro, automáticamente sus
#: eventos cuenten para el ranking de temporada únicamente… así motivamos a los demás a CRECER SUS COMUNIDADES»). El
#: Competitivo, sólo el 1 (y el 2 desde el 19/11/2026): es lo que mide calidad. Los que suman sólo a la Temporada piden 8 participantes
#: (`MIN_SOLO_TEMPORADA`); sin tope semanal (Dlx: «quita eso de tope semanal… no me agrada esa idea»)
#: 🥈 Y EL TIER 2, TODO LO DEL 1 (Dlx, 19/11/2026: «Tier 2 que cuenten sus eventos para competitivo»): lo que los separa
#: no es un beneficio de esta lista sino el botón «Unirme a los Tier 1», que pregunta por el tier y no por `competitivo`
#: (Worker y web/src/unirse.jsx)
PRESET = {1: {'pagina', 'calendario', 'ligas', 'panel', 'suma', 'competitivo', 'duelos'},
          2: {'pagina', 'calendario', 'ligas', 'panel', 'suma', 'competitivo', 'duelos'},
          3: {'pagina', 'calendario', 'ligas', 'panel', 'suma', 'duelos'}}
#: 🏟️ Y LAS LIGAS DEL TIER 3 CUENTAN COMO DUELOS, desde el 19/11/2026 (Dlx: «que sus ligas sí cuenten si son tier 3»; a
#: «¿lo aplico ya?»: «Yes, apply it»). Medido antes: 158 batallas de la T1 (LKR 102, CEU 32, FDS 24; 9 ligas) y 102
#: personas, que suman al Ranking Duelos y al Win%, nunca al Score (`rankings.duelos_de_ligas()`)
#: cuántos participantes pide un evento de un servidor que suma sólo a la Temporada (sin `competitivo`)
MIN_SOLO_TEMPORADA = 8
#: y desde cuándo: DESDE EL ARRANQUE DE LA T1, como todos (Dlx, 26/10/2026: «haz que sus eventos cuenten desde el día que
#: todos están contando sus eventos»). Vacío = sin corte propio: lo de antes de la temporada ya lo saca
#: `temporada.de_esta_temporada()`. Se probó con el 26/10 y se sacó a pedido de Dlx
SOLO_TEMPORADA_DESDE = ''
#: 🔴 sumar al ranking pide que el servidor esté en las listas del código (`sheet/rankings.py` y las demás, que llena
#: `herramientas/sumar_servidor.py`): uno dado de alta desde el Dashboard no lo está, y sus llaves entrarían a medias.
#: Hasta que se sume a mano, `suma` y `duelos` quedan apagados y el Dashboard dice por qué.
PIDEN_CODIGO = ('suma', 'competitivo', 'duelos')


# ── 🧭 LOS QUE ENTRAN SOLOS CON /setup (19/11/2026) ────────────────────────────────────────────────────────────────────
# Dlx, 19/11/2026, a la maqueta del /setup: «tus elecciones» (1A 2A 3A 4A 5A). La 4A: terminar el setup mete al
# servidor en la Liga SOLO —confirmado, Tier 3, sus anuncios leídos, su página y su kit— pero sus eventos NO suman a la
# Temporada hasta que Dlx lo apruebe («Que sumen · Tier 3» en su DM o en el Dashboard: el ajuste `setup_suma`).
#
# 🔑 LA APROBACIÓN ES LA PUERTA, Y ESTÁ EN TRES LUGARES QUE DICEN LO MISMO:
#   · `beneficios()`: un servidor del setup sin aprobar tiene `suma`, `competitivo` y `duelos` apagados, aunque Dlx
#     prenda el interruptor en su caja: lo que lo prende es la aprobación;
#   · `guilds_sin()`: sus guilds van en «no suman» leyendo `datos/servidores.json` DIRECTO, sin depender de que
#     `datos/niveles.json` ya lo tenga (un ciclo cortado entre escribir uno y otro no lo deja sumar);
#   · `en_el_codigo()` y `sheet/rankings.py`: el aprobado entra a la lista de servidores del ranking AL FINAL, que es lo
#     que hacía a mano `herramientas/sumar_servidor.py` (su columna en la vitrina, su `Sv`). Sin aprobar, no entra.
# ⚠️ Y SÓLO TOCA LO QUE TIENE `alta: 'setup'`: un servidor que ya era de la Liga y corre /setup no cambia en nada acá.

def _svs(servidores=None):
    return servidores if servidores is not None else ((_j('datos', 'servidores.json') or {}).get('servidores') or {})


def de_setup(x):
    """¿Esta entrada de `datos/servidores.json` entró con /setup y está en la Liga?"""
    return isinstance(x, dict) and x.get('alta') == 'setup' and bool(x.get('confirmado')) and x.get('en_la_liga') is not False


def aprobados_setup(servidores=None):
    """Las siglas del /setup que Dlx aprobó, EN EL ORDEN EN QUE LAS APROBÓ (y por sigla si empatan). ⚠️ El orden importa:
    `sheet/rankings.py` las agrega al final de sus columnas, y la vitrina sólo crece sola si lo nuevo va DESPUÉS de lo que
    ya tenía (`columnas_que_faltan()`); por sigla, una aprobada hoy podría caer antes que una de ayer."""
    svs = _svs(servidores)
    return [sv for _a, sv in sorted((str(x.get('suma_aprobada')), sv) for sv, x in svs.items()
                                    if de_setup(x) and x.get('suma_aprobada') and re.match(r'^[A-Z]{2,6}$', sv))]


def pendientes_setup(servidores=None):
    """Las siglas del /setup que todavía esperan a Dlx (o a las que les dijo «Todavía no»)."""
    return {sv for sv, x in _svs(servidores).items() if de_setup(x) and not x.get('suma_aprobada')}


def con_setup(base, servidores=None):
    """La lista de servidores del ranking (`base`, escrita a mano) con los aprobados del /setup al final. Lo escrito no
    se mueve ni se repite: para los de siempre, `con_setup(base)[:len(base)] == base`."""
    base = tuple(base)
    return base + tuple(sv for sv in aprobados_setup(servidores) if sv not in base)


def en_el_codigo(servidores=None):
    """Las siglas que `sheet/rankings.py` conoce (su `SERVIDORES`): las únicas que pueden sumar al ranking. Con los
    aprobados del /setup, que el ranking agrega solo (ver arriba)."""
    try:
        txt = io.open(os.path.join(BASE, 'sheet', 'rankings.py'), encoding='utf-8').read()
        m = re.search(r"^SERVIDORES = \((.*)\)$", txt, re.M)
        escritos = set(re.findall(r"'([^']*)'", m.group(1))) if m else set()
    except OSError:
        escritos = set()
    return escritos | set(aprobados_setup(servidores))


def beneficios(nivel, elegidos=None, codigo=None, pendientes=None):
    """`{sigla: {beneficio: bool}}`: el preset de su tier, con lo que Dlx eligió encima; `suma` y `duelos`, sólo si el
    servidor está en el código. Y `bloq`: los que no se pueden prender todavía, para que el Dashboard diga por qué.
    🧭 `pendientes`: los del /setup sin aprobar (`pendientes_setup()`): ésos no suman AUNQUE estén en el código."""
    codigo = en_el_codigo() if codigo is None else codigo
    pendientes = pendientes_setup() if pendientes is None else pendientes
    out, bloq = {}, {}
    for sv, t in nivel.items():
        b = {k: k in PRESET.get(t, PRESET[3]) for k, _t in BENEFICIOS}
        for k, v in ((elegidos or {}).get(sv) or {}).items():
            if k in b and isinstance(v, bool):
                b[k] = v
        if sv not in codigo or sv in pendientes:
            for k in PIDEN_CODIGO:
                b[k] = False
            bloq[sv] = list(PIDEN_CODIGO)
        out[sv] = b
    return out, bloq


def sigla_libre(propuesta, nombre, usadas):
    """La sigla de un servidor del /setup: la propuesta (la que vio Dlx en el DM) si está libre; si no, de las iniciales
    del nombre, como `siglaPropuesta()` de bot/setup.js. 2 a 6 letras, que nadie use como código ni como sigla."""
    import unicodedata
    usadas = {str(x).upper() for x in usadas}
    p = str(propuesta or '').upper()
    if re.match(r'^[A-Z]{2,6}$', p) and p not in usadas:
        return p
    t = unicodedata.normalize('NFKD', str(nombre or ''))
    t = ''.join(c for c in t if not unicodedata.combining(c)).upper()
    palabras = [re.sub(r'[^A-Z]', '', w) for w in re.split(r'[^A-Z0-9]+', t)]
    palabras = [w for w in palabras if w]
    ini, todo = ''.join(w[0] for w in palabras), ''.join(palabras)
    cands = ([ini[:6]] if len(ini) >= 2 else []) + [todo[:n] for n in (3, 4, 5, 6) if len(todo) >= n]
    if len(ini) >= 2:
        cands += [ini[:5] + x for x in todo]
    for c in cands:
        if re.match(r'^[A-Z]{2,6}$', c) and c not in usadas:
            return c
    for a in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ':
        for b in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ':
            if 'SV' + a + b not in usadas:
                return 'SV' + a + b
    return ''


def altas_setup(aj, svs, ahora=None):
    """➕ Los que corrieron /setup (`aj['setup_altas']`, del objeto): entran a `svs` confirmados, Tier 3, con
    `alta: 'setup'`, su invitación y los canales que eligieron. Devuelve las siglas que entraron.
    ⚠️ UN GUILD QUE YA ESTÁ NO SE TOCA: ni un socio de antes (FFA corre /setup y no le pasa nada acá) ni uno registrado
    fuera de la Liga (TFC: «Olvida TFC»), que el setup marca `fuera` y sólo le llega a Dlx.
    ⚠️ Y NADA DE QUIÉN LO CORRIÓ: esto va a `datos/servidores.json`, y el repo es público."""
    nuevas = []
    ah = ahora or dt.datetime.now(dt.timezone.utc)
    hoy = ah.strftime('%d/%m/%Y')
    usadas = set(svs) | {str(x.get('sigla')) for x in svs.values() if isinstance(x, dict) and x.get('sigla')}
    guilds = {str(x.get('guild_id')) for x in svs.values() if isinstance(x, dict) and x.get('guild_id')}
    pedidos = [x for x in ((aj or {}).get('setup_altas') or []) if isinstance(x, dict)]
    for x in sorted(pedidos, key=lambda y: (y.get('t') or 0, str(y.get('g')))):
        g, n = str(x.get('g') or ''), str(x.get('n') or '').strip()
        if x.get('fuera') or not re.match(r'^\d{15,22}$', g) or not n or g in guilds:
            continue
        sv = sigla_libre(x.get('sigla'), n, usadas)
        if not sv:
            print('   ⚠️ /setup de «%s»: no encontré una sigla libre' % n[:40])
            continue
        aviso = str(x.get('aviso') or '')
        e = {'nombre': n[:60], 'guild_id': g, 'en_el_sheet': False, 'confirmado': True, 'sigla': sv, 'tier': 3,
             'alta': 'setup',
             'nota': 'entró solo con /setup el %s (bot/tiers.py `altas_setup()`): sus puntos de Temporada esperan la '
                     'aprobación de Dlx (`setup_suma`)' % hoy,
             'setup': {'plantilla': str(x.get('pl') or '')[:10], 'aviso': aviso if re.match(r'^\d{15,22}$', aviso) else '',
                       'desde': ah.strftime('%Y-%m-%d')}}
        inv = x.get('inv') if isinstance(x.get('inv'), dict) else None
        if inv and re.match(r'^[A-Za-z0-9-]{2,32}$', str(inv.get('codigo') or '')):
            # 🔗 la que creó el setup: con `invitacion_liga` puesta, `bot/invitaciones.py` no crea otra
            e['invitacion'] = 'https://discord.gg/%s' % inv['codigo']
            e['invitacion_liga'] = {'codigo': str(inv['codigo']), 'canal': str(inv.get('canal') or '')[:80],
                                    'canal_id': str(inv.get('canal_id') or ''), 'creada': ah.strftime('%Y-%m-%d')}
        c = {k: str(v) for k, v in (x.get('c') or {}).items() if k in ('an', 'in', 've', 'ge') and re.match(r'^\d{15,22}$', str(v))}
        if c:
            e['canales_setup'] = c
        svs[sv] = e
        usadas.add(sv)
        guilds.add(g)
        nuevas.append(sv)
    return nuevas


#: 🔑🏟️ cuántos canales de llaves (`ll`) y de resultados de liga (`lg`) se toman del /setup: los mismos topes del menú.
#: `ev`: los de sus eventos (anuncios, inscripciones, veredictos), que `ligas.candidatas()` no deja tomar como una liga
SETUP_TOPES = (('ll', 3), ('lg', 5), ('ev', 3))


def canales_del_setup(aj, svs):
    """🔑🏟️ Los canales de llaves (`ll`) y de resultados de cada liga (`lg`) que cada servidor eligió en su /setup
    (`aj['setup_canales']`, del objeto: `{guild: {ll: [ids], lg: [ids]}}`), a `canales_setup` de su entrada.

    Dlx, 21/11/2026, por Makma: *«cómo puede agregar sus ligas o cómo agrega el canal de llaves»*. TAMBIÉN para un socio
    de antes, a diferencia del alta (`altas_setup()`): sólo dice qué canales leer, no cambia su tier ni lo que suma. Los
    leen `escuchar.llaves_del_setup()` (las llaves en cada vuelta), `ligas.ligas_del_setup()` (`candidatas()`) y
    `subir_datos._canales_llaves()` (el bot en vivo). Un guild que no viene no se toca: «no sé» no es «ninguno».
    Devuelve las siglas que cambiaron."""
    sc = (aj or {}).get('setup_canales')
    if not isinstance(sc, dict):
        return []
    por_g = {str(x.get('guild_id')): sv for sv, x in svs.items()
             if isinstance(x, dict) and x.get('confirmado') and x.get('guild_id')}
    cambios = []
    for g, d in sorted(sc.items()):
        sv = por_g.get(str(g))
        if not sv or not isinstance(d, dict):
            continue
        x = svs[sv]
        antes = dict(x.get('canales_setup') or {})
        cs = dict(antes)
        for k, tope in SETUP_TOPES:
            ids = [str(i) for i in (d.get(k) or []) if re.match(r'^\d{15,22}$', str(i))][:tope]
            if ids:
                cs[k] = ids
            else:
                cs.pop(k, None)
        if cs != antes:
            if cs:
                x['canales_setup'] = cs
            else:
                x.pop('canales_setup', None)
            cambios.append(sv)
    return cambios


def aprobar_setup(aj, svs, ahora=None):
    """✅ Lo que decidió Dlx (`aj['setup_suma']`, `{guild: {si, t}}`) sobre los del /setup: `suma_aprobada` (la hora)
    es un ESPEJO de `si: true`. Sin decisión, o con «Todavía no» —también un «Deshacer»—, no está aprobado. Sólo mira
    los `alta: 'setup'`. Devuelve las siglas que cambiaron."""
    dec = (aj or {}).get('setup_suma')
    dec = dec if isinstance(dec, dict) else {}
    t = (ahora or dt.datetime.now(dt.timezone.utc)).strftime('%Y-%m-%dT%H:%MZ')
    cambios = []
    for sv, x in svs.items():
        if not de_setup(x):
            continue
        d = dec.get(str(x.get('guild_id')))
        si = isinstance(d, dict) and d.get('si') is True
        if si and not x.get('suma_aprobada'):
            x['suma_aprobada'] = t
            cambios.append(sv)
        elif not si and x.get('suma_aprobada'):
            x.pop('suma_aprobada', None)
            x.pop('suma_avisada', None)
            cambios.append(sv)
    return cambios


def avisar_suma(svs, ben, tok, ahora=None, mandar=None):
    """📣 El aviso al servidor cuando sus eventos YA suman (aprobado y con `suma` prendido en esta vuelta): un mensaje en
    el canal donde el bot escribe (`setup.aviso`), una sola vez (`suma_avisada`). Con «Sólo leer» no hay canal: se anota
    igual, y el servidor lo ve en su /setup. Devuelve las siglas anotadas. `mandar(canal, texto) -> bool` es para la prueba."""
    hechas = []
    for sv, x in svs.items():
        if not de_setup(x) or not x.get('suma_aprobada') or x.get('suma_avisada') or not (ben.get(sv) or {}).get('suma'):
            continue
        canal = str((x.get('setup') or {}).get('aviso') or '')
        if canal:
            txt = ('✅ **Los eventos de %s ya suman a la Temporada de la Liga Global.** Desde ahora, lo que se juegue acá con '
                   '%d participantes o más entra al ranking: <https://underlegends.pages.dev/freestyle-rap/ranking>'
                   % (re.sub(r'[\\`*_~|>#\[\]<@]', '', str(x.get('nombre') or sv))[:60], MIN_SOLO_TEMPORADA))
            ok = mandar(canal, txt) if mandar else _mandar_canal(canal, txt, tok)
            if not ok:
                print('   ⚠️ no pude avisarle a %s que ya suma: queda para la vuelta siguiente' % sv)
                continue
        x['suma_avisada'] = (ahora or dt.datetime.now(dt.timezone.utc)).strftime('%Y-%m-%d')
        hechas.append(sv)
    return hechas


def _mandar_canal(canal, texto, tok):
    import requests
    if not tok:
        return False
    try:
        r = requests.post('https://discord.com/api/v10/channels/%s/messages' % canal, timeout=20,
                          headers={'Authorization': 'Bot ' + tok, 'User-Agent': 'DiscordBot (underlegends, 1.0)'},
                          json={'content': texto, 'allowed_mentions': {'parse': []}})
        return r.status_code == 200
    except Exception:                                    # noqa: BLE001
        return False


def sin(beneficio, guardado=None):
    """Las siglas con ese beneficio APAGADO, de `datos/niveles.json`. Sin `beneficios` guardados (antes de la primera
    corrida con esto), lo de antes: los bajados (Tier 3) no cuentan para el Competitivo (sus ligas sí son duelos desde el
    19/11/2026), y lo demás lo tienen todos."""
    g = guardado if guardado is not None else (_j('datos', 'niveles.json') or {})
    ben = g.get('beneficios')
    if not isinstance(ben, dict):
        return {sv for sv, t in (g.get('niveles') or {}).items() if t == 3} if beneficio == 'competitivo' else set()
    return {sv for sv, b in ben.items() if isinstance(b, dict) and b.get(beneficio) is False}


def guilds_sin(beneficio, servidores=None, guardado=None):
    """Los guild ID de los servidores con ese beneficio apagado (para el lector de llaves: `suma`).
    🧭 Y los del /setup sin aprobar, para `suma`, `competitivo` y `duelos`, leídos de `servidores.json` y no de
    `niveles.json`: si el ciclo se cortara después de darlo de alta y antes de escribir los niveles, igual no suma."""
    svs = servidores if servidores is not None else ((_j('datos', 'servidores.json') or {}).get('servidores') or {})
    out = {str(svs[sv].get('guild_id')) for sv in sin(beneficio, guardado) if svs.get(sv, {}).get('guild_id')}
    if beneficio in PIDEN_CODIGO:
        out |= {str(svs[sv].get('guild_id')) for sv in pendientes_setup(svs) if svs[sv].get('guild_id')}
    return out


# ── ➕ EL ALTA DESDE EL DASHBOARD (ajuste `altas`, `{sigla: {n, g, t, tag}}`) ─────────────────────────────────────
# Lo que hacía a mano `herramientas/sumar_servidor.py` y es dato, no código: la entrada en `datos/servidores.json`
# (confirmada, con su tier y `alta: 'dashboard'`), el bot (`datos/bot_en.json`, si está adentro) y la invitación
# permanente de la Liga (`bot/invitaciones.py`). ⚠️ No toca el código: el Worker no lo conoce (no sale en el menú de
# /card ni reconoce su servidor en los comandos) y no puede sumar al ranking hasta que se sume a mano —`PIDEN_CODIGO`—.
# Por eso `bot/desplegar.py` no lo pide en worker.js.
def altas(aj, svs, tok=None, ahora=None):
    """Agrega a `svs` los servidores nuevos de `aj['altas']`. Devuelve las siglas que entraron."""
    nuevas = []
    hoy = (ahora or dt.datetime.now(dt.timezone.utc)).strftime('%d/%m/%Y')
    for sv, x in sorted(((aj or {}).get('altas') or {}).items()):
        if sv in svs or not isinstance(x, dict) or not re.match(r'^[A-Z]{2,6}$', sv):
            continue
        g, n = str(x.get('g') or ''), str(x.get('n') or '').strip()
        if not re.match(r'^\d{15,22}$', g) or not n or any(str(y.get('guild_id')) == g for y in svs.values()):
            continue
        e = {'nombre': n[:60], 'guild_id': g, 'en_el_sheet': False, 'confirmado': True, 'sigla': sv,
             'tier': x.get('t') if x.get('t') in TIERS else 3, 'alta': 'dashboard',
             'nota': 'dado de alta desde el Dashboard el %s (bot/tiers.py `altas()`)' % hoy}
        if str(x.get('tag') or '').strip():
            e['tag'] = str(x['tag']).strip().upper()[:24]
        svs[sv] = e
        nuevas.append(sv)
    return nuevas


def _alta_completar(nuevas, svs, tok):
    """El bot y la invitación de los recién dados de alta (con red). Lo que falle queda para la corrida siguiente."""
    import requests
    if not nuevas or not tok:
        return
    bot = _j('datos', 'bot_en.json') or []
    h = {'Authorization': 'Bot ' + tok, 'User-Agent': 'DiscordBot (underlegends, 1.0)'}
    for sv in nuevas:
        try:
            r = requests.get('https://discord.com/api/v10/guilds/%s' % svs[sv]['guild_id'], headers=h, timeout=20)
            if r.status_code == 200 and sv not in bot:
                bot.append(sv)
                print('   🤖 el bot está en %s' % sv)
            elif r.status_code != 200:
                print('   ⚠️ el bot no está en %s (Discord dijo %d): sin bot no se leen sus anuncios' % (sv, r.status_code))
        except OSError as e:
            print('   ⚠️ %s: %s' % (sv, str(e)[:60]))
    with io.open(os.path.join(BASE, 'datos', 'bot_en.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(bot, f, ensure_ascii=False)
    try:
        import invitaciones
        invitaciones.crear(aplicar=True)
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ la invitación de los nuevos: %s' % str(e)[:80])


def bajados(servidores=None, guardados=None):
    """Las siglas en Tier 3: no cuentan para el Competitivo (sus ligas sí son duelos desde el 19/11/2026). Desde el 19/11/2026
    el Tier 2 cuenta todo (ver `PRESET`); hasta ese día esto eran «Tier 2 o 3»."""
    return {sv for sv, t in niveles(servidores, guardados).items() if t == 3}


def guilds_bajados(servidores=None, guardados=None):
    """Los guild ID de los servidores en Tier 3."""
    svs = servidores if servidores is not None else ((_j('datos', 'servidores.json') or {}).get('servidores') or {})
    return {str(svs[sv].get('guild_id')) for sv in bajados(svs, guardados) if svs.get(sv, {}).get('guild_id')}


# ── el puntaje ───────────────────────────────────────────────────────────────────────────────────────────────────────
def _dia(s):
    try:
        return dt.date.fromisoformat(str(s)[:10])
    except ValueError:
        return None


def _sv_de_sec(sec):
    """«POESÍA CRUDA · URBF · 01/10 · #380» -> («URBF», date)."""
    p = [x.strip() for x in str(sec or '').split('·')]
    sv = p[1] if len(p) > 1 else ''
    d = None
    if len(p) > 2 and re.match(r'^\d{1,2}/\d{1,2}$', p[2]):
        dd, mm = p[2].split('/')
        try:
            d = dt.date(2026, int(mm), int(dd))
        except ValueError:
            d = None
    return sv, d


def _arranque():
    """El primer día de la temporada en curso (`comun/temporada.py`), o `None` si no se sabe. Lo usan el puntaje (si se
    puede comparar con las 4 semanas de antes) y el panel (desde qué semana se dibuja, y si la tendencia vale)."""
    try:
        from comun.temporada import FECHAS, ACTUAL
        return dt.date.fromisoformat(FECHAS[ACTUAL][0])
    except Exception:                                    # noqa: BLE001
        return None


def medir(D, hoy, svs, nivel, miembros=None, desde=None):
    """`[{sv, nombre, tier, puntos, partes, m, antes, rec, porque}]` de cada servidor de la Liga. `desde`: `{sigla: día en
    que entró}` (`desde_de()`): quien todavía no cumplió su primer tramo no se da por «no llega» (`nuevo`). `D` trae: `llaves`
    (llaves_t1), `ayudas` ([(sv, día)]: preguntas y correcciones), `anuncios` ([(sv, día, dice_staff)]), `cancelados`
    ([(sv, día)]), `promos` ([(sv, día)]), `ligas` ({id: {sv, batallas}})."""
    fin = hoy + dt.timedelta(days=1)
    ini = fin - dt.timedelta(days=7 * SEMANAS)
    ini0 = ini - dt.timedelta(days=7 * SEMANAS)
    # el primer evento de cada persona: quién trajo a quién, y si volvió
    evs = sorted(((_dia(v.get('dia')), v.get('sv') or '', [f[0] for f in v.get('tabla') or [] if f and f[0]])
                  for v in (D.get('llaves') or {}).values() if _dia(v.get('dia'))), key=lambda x: x[0])
    primero, dias_de = {}, {}
    for d, sv, ns in evs:
        for n in ns:
            primero.setdefault(n, (d, sv))
            dias_de.setdefault(n, set()).add(d)

    def parte(sv, a, b):
        ee = [(d, ns) for d, s, ns in evs if s == sv and a <= d < b]
        nev = len(ee)
        gente = sum(len(ns) for _d, ns in ee)
        nuevos = [n for n, (d, s) in primero.items() if s == sv and a <= d < b]
        volvieron = [n for n in nuevos if any(x > primero[n][0] for x in dias_de.get(n, ()))]
        ay = sum(1 for s, d in D.get('ayudas') or [] if s == sv and d and a <= d < b)
        an = [x for x in D.get('anuncios') or [] if x[0] == sv and x[1] and a <= x[1] < b]
        con_staff = sum(1 for x in an if x[2])
        canc = sum(1 for s, d in D.get('cancelados') or [] if s == sv and d and a <= d < b)
        pro = sum(1 for s, d in D.get('promos') or [] if s == sv and d and a <= d < b)
        lig = sum(1 for x in (D.get('ligas') or {}).values() if x.get('sv') == sv
                  and any(a <= (_dia(bt[1]) or a - dt.timedelta(days=1)) < b for bt in x.get('batallas') or []))
        sem = SEMANAS
        m = {'eventos': nev, 'por_semana': round(nev / sem, 1), 'por_evento': round(gente / nev, 1) if nev else 0,
             'nuevos': len(nuevos), 'volvieron': len(volvieron), 'ayudas': ay, 'anuncios': len(an),
             'con_staff': con_staff, 'cancelados': canc, 'promos': pro, 'ligas': lig}
        act = min(1.0, (nev / sem) / 2.0) * 35
        alc = min(1.0, m['por_evento'] / 16.0) * 15 + min(1.0, len(nuevos) / 10.0) * 10
        cal = ((1 - min(1.0, ay / nev / 2.0)) * 12 if nev else 0) + ((con_staff / len(an)) * 8 if an else 0) \
            + ((1 - min(1.0, canc / max(1, nev))) * 5 if nev else 0)
        com = ((len(volvieron) / len(nuevos)) * 8 if nuevos else 0) + min(1.0, pro / 8.0) * 4 + min(1.0, lig) * 3
        # 🧮 LAS PARTES SUMAN EL TOTAL (02/11/2026): redondeadas una por una daban 35 + 25 + 13 + 3 = 76 al lado de un
        # puntaje de 75 en el panel. Se redondea el total y las partes se reparten por el mayor resto: cada una queda a
        # menos de 1 de la de verdad y nunca pasa su tope (el +1 va a una con resto, que no está en el tope)
        crudas = {'actividad': act, 'alcance': alc, 'calidad': cal, 'comunidad': com}
        pts = round(act + alc + cal + com)
        partes = {k: int(v) for k, v in crudas.items()}
        for k in sorted(crudas, key=lambda k: -(crudas[k] - int(crudas[k])))[:max(0, pts - sum(partes.values()))]:
            partes[k] += 1
        return m, partes, pts

    # 📈 ¿las 4 semanas de antes son de esta temporada? Si no, comparar contra ellas es comparar contra cero: todos
    # «suben» (el panel de los socios decía «▲ 81» a FFA el 19/10). `compara_desde`: el día en que ya se puede
    arranque = _arranque()
    compara = arranque is None or ini0 >= arranque
    compara_desde = (arranque + dt.timedelta(days=7 * SEMANAS * 2 - 1)).isoformat() if arranque else ''
    est_ev = [(_dia(v.get('dia')), (v.get('sv') or '').upper()) for n, v in (D.get('llaves') or {}).items()
              if isinstance(v, dict) and str(n) in (D.get('estilos') or {}) and _dia(v.get('dia'))]
    out = []
    for sv, t in nivel.items():
        m, partes, pts = parte(sv, ini, fin)
        _m0, _p0, pts0 = parte(sv, ini0, ini)
        # 📏 las 8 semanas de los requisitos (`SUBE`, `SEGUIR`): las mismas cuentas de `parte()`, en la ventana doble
        x8 = parte(sv, ini0, fin)[0]
        m8 = {'eventos': x8['eventos'], 'por_evento': x8['por_evento'], 'ligas': x8['ligas'],
              # 🎭 sus eventos de estilo en las 8 semanas (`datos/eventos_estilo.json`, lo marca Dlx o su dueño)
              'estilos': sum(1 for d, s in est_ev if s == sv and ini0 <= d < fin)}
        if hoy < ESTILOS_DESDE + dt.timedelta(days=56):
            m8['estilos_cuenta'] = (ESTILOS_DESDE + dt.timedelta(days=56)).isoformat()
        ult = max((d for d, s, _ns in evs if s == sv), default=None)
        sin = (hoy - ult).days if ult else None
        m['miembros'] = (miembros or {}).get(sv)
        mide = mide_desde(t, (desde or {}).get(sv), arranque, hoy)
        rec, porque = ('casa', 'la casa de la Liga: no se evalúa como socio') if sv in CASA else recomendar(t, pts, m, sin, m8, mide)
        out.append({'sv': sv, 'nombre': (svs.get(sv) or {}).get('nombre') or sv, 'tier': t, 'puntos': pts,
                    'antes': pts0, 'compara': compara, 'compara_desde': compara_desde, 'partes': partes, 'm': m, 'm8': m8,
                    'ultimo': str(ult) if ult else '', 'sin_jugar': sin, 'rec': rec, 'porque': porque})
        # 🐣 sólo si en su primer tramo todavía no llega: al que ya cumple no hay que decirle desde cuándo cuenta
        if mide and no_llega(t, m, m8):
            out[-1]['mide_desde'] = mide.isoformat()
    out.sort(key=lambda x: (x['tier'], -x['puntos'], x['sv']))
    return out


#: 🪜 LO QUE PIDE SUBIR DE TIER, EN LAS ÚLTIMAS 8 SEMANAS (el plan de los tiers, Dlx 19/11/2026: «Para tier 2, me gusta ese
#: requisito para subir»). Hasta ese día era «anunciar 2 eventos en 4 semanas» para Tier 2 y «60 puntos, 4 eventos y llaves
#: que el bot lee casi solo» para Tier 1. Lo miran `recomendar()`, `como_subir()` y `reglas()`, y lo dice
#: docs/anuncios/kit_servidor_nuevo.md (y web/src/kit.jsx). A Tier 1, después de cumplir, un mes de prueba
SUBE = {2: {'eventos': 8, 'por_evento': 8}, 1: {'eventos': 12, 'por_evento': 10, 'puntos': 60}}
#: 📋 LO QUE PIDE CADA TIER PARA QUEDARSE (el mismo plan): Tier 1, 8 eventos en 8 semanas con 8 raperos por evento; Tier 2,
#: 4 eventos en 8 semanas; Tier 3, seguir vivo (un evento o una fecha de liga en las últimas 4 semanas). Los Pases (Tier 1) y
#: los estilos de juego (Tier 2) se suman cuando existan. Lo dice el panel de cada socio (`pide()`); no mueve a nadie
SEGUIR = {1: {'eventos': 8, 'por_evento': 8}, 2: {'eventos': 4, 'estilos': 2}, 3: {'vivo': 1}}
#: 🎭 desde cuándo se pueden marcar eventos de estilo en un Tier 2 (la 7.27): el requisito cuenta desde ahí, y se pide recién
#: con sus 8 semanas enteras (si no, los cuatro Tier 2 salían «Revisar» el mismo día en que se pudo empezar)
ESTILOS_DESDE = dt.date(2026, 11, 20)


def _cumple(req, pts, m8):
    """¿Llega a lo que pide `req` (de `SUBE`) con sus 8 semanas?"""
    m8 = m8 or {}
    return (m8.get('eventos', 0) >= req.get('eventos', 0) and m8.get('por_evento', 0) >= req.get('por_evento', 0)
            and (pts or 0) >= req.get('puntos', 0))


#: 🤝 LA ALIANZA (Dlx, 20/11/2026: «La armas tú, 2 Pases»): un Tier 1 acompaña a un Tier 2 o 3 (el ajuste `alianzas`,
#: `{T1: [aliado, …]}`); cuando su aliado sube de tier, el Tier 1 suma estos Pases a los de ese mes (`alianza_bonus()`)
ALIANZA_PASES = 2


def alianza_bonus(alianzas, viejos, nuevos, hoy, previo=None):
    """🤝 `[{t1, aliado, de, a, dia, pases}]`: lo de antes y, si un aliado subió de tier en esta vuelta (su número bajó), un
    bono nuevo. Uno por subida (el mismo aliado al mismo tier no repite). Pura."""
    out = [dict(x) for x in (previo or []) if isinstance(x, dict)]
    for t1, aliados in sorted((alianzas or {}).items()):
        for a in aliados or []:
            de, al = (viejos or {}).get(a), (nuevos or {}).get(a)
            if de and al and al < de and not any(x.get('t1') == t1 and x.get('aliado') == a and x.get('a') == al for x in out):
                out.append({'t1': t1, 'aliado': a, 'de': de, 'a': al, 'dia': hoy.isoformat(), 'pases': ALIANZA_PASES})
    return out[-40:]


#: 🔥 quién juega seguido en un servidor, para el aviso de evento flojo (`frecuentes()`): eventos ahí en las 8 semanas
FRECUENTE_MIN = 2
#: a cuántos manda por servidor, como mucho
FRECUENTE_TOPE = 80


def frecuentes(llaves, hoy, did_de):
    """🔥 `{sigla: [Discord ID, …]}`: los que jugaron `FRECUENTE_MIN` eventos o más en ese servidor en las últimas 8
    semanas, los que más primero. Para el aviso de evento flojo del Worker (`eventoFlojo()` de bot/avisos.js: una hora
    antes, si tiene menos de la mitad de sus cupos, les avisa la campana). `did_de(nombre)` da la cuenta o ''. Va SÓLO al
    objeto, con la fila del servidor (`frec`): son cuentas de personas y el panel del dueño no lo lleva. Pura."""
    desde = hoy - dt.timedelta(days=7 * 8 - 1)
    cuenta = {}
    for v in (llaves or {}).values():
        if not isinstance(v, dict):
            continue
        d, sv = _dia(v.get('dia')), (v.get('sv') or '').upper()
        if not d or not sv or d < desde or d > hoy:
            continue
        for f in v.get('tabla') or []:
            if f and f[0]:
                did = did_de(f[0])
                if did:
                    c = cuenta.setdefault(sv, {})
                    c[did] = c.get(did, 0) + 1
    return {sv: [q for q, n in sorted(c.items(), key=lambda x: (-x[1], x[0])) if n >= FRECUENTE_MIN][:FRECUENTE_TOPE]
            for sv, c in sorted(cuenta.items()) if any(n >= FRECUENTE_MIN for n in c.values())}


#: 📅 cuánto mide cada tier para quedarse (`SEGUIR`): Tier 1 y 2, las 8 semanas; Tier 3, «seguir vivo» en 4
VENTANA_SEGUIR = {1: 56, 2: 56, 3: 28}


def desde_de(viejo, nivel, hoy):
    """`{sigla: 'AAAA-MM-DD'}`, el día en que cada servidor entró a la Liga: lo que ya estaba en `datos/niveles.json`
    (`desde`) y, el que no estaba, hoy, que es la primera vuelta del ciclo que lo ve. Los que estaban el 20/11/2026 se
    sembraron a mano con el día de su nota en `datos/servidores.json`. Pura."""
    v = dict(viejo or {})
    return {sv: v.get(sv) or hoy.isoformat() for sv in sorted(nivel)}


def mide_desde(tier, entro, arranque, hoy):
    """🐣 El día desde el que vale lo que pide su tier, si todavía no llegó; `None` si ya cuenta. El tramo arranca el día
    en que entró o el del arranque de la temporada, el más nuevo: CHZ entró el 19/11/2026 y al otro día salía «no llega»
    con cero eventos, y al arrancar la T2 saldrían todos. Pura."""
    v = VENTANA_SEGUIR.get(tier)
    if not v:
        return None
    try:
        ini = dt.date.fromisoformat(str(entro)[:10]) if entro else None
    except ValueError:
        ini = None
    hay = [x for x in (ini, arranque) if x]
    if not hay:
        return None
    cuenta = max(hay) + dt.timedelta(days=v)
    return cuenta if cuenta > hoy else None


def _primer_tramo(mide, tier, m, m8):
    """La aclaración de «Bien» en su primer tramo, sólo si todavía no llega: al que ya cumple no se le dice nada."""
    return ' (lo que pide su tier cuenta desde el %s)' % mide.strftime('%d/%m') if mide and m8 is not None and no_llega(tier, m, m8) else ''


def no_llega(tier, m, m8, mide=None):
    """El porqué de «Revisar» si no llega a lo que pide su tier (`pide()`), o `''`. Nada en su primer tramo ni sin `m8`."""
    if mide or m8 is None:
        return ''
    falta = [r for r in pide(tier, m, m8) if not r[2] and len(r) < 4]
    return ('no llega a lo que pide Tier %d: ' % tier + '; '.join('%s (%s)' % (r[0], r[1]) for r in falta)) if falta else ''


def recomendar(tier, pts, m, sin_jugar, m8=None, mide=None):
    """`(recomendación, por qué)`. Recomienda: decide Dlx. `m8`: los eventos y raperos por evento de las últimas 8 semanas
    (lo que mira subir, `SUBE`, y quedarse, `SEGUIR`). `mide`: el día desde el que cuenta lo que pide su tier, si todavía
    no llegó (`mide_desde()`). Sin `m8` no se mide quedarse: es una medición que no está, no un «no llega».
    🔁 Hasta el 20/11/2026 un Tier 2 o 3 que no llegaba a lo que pide su tier salía «Bien» (FVS con 2 eventos de 4, FFS sin
    un evento en 4 semanas) mientras su panel decía «Te falta»: las dos pantallas tienen que decir lo mismo."""
    gente = m.get('miembros')
    medido = m8 is not None
    m8 = m8 or {}
    if tier == 1:
        if sin_jugar is None or sin_jugar > 21:
            return 'revisar', 'hace %s que no juega un evento' % ('más de 4 semanas' if sin_jugar is None else '%d días' % sin_jugar)
        if pts < 35:
            return 'revisar', 'puntaje bajo (%d): poca actividad o mucha ayuda para leer sus llaves' % pts
        falta = no_llega(1, m, m8 if medido else None, mide)
        if falta:
            return 'revisar', falta
        return 'bien', 'cumple como Tier 1' + recomendado(1, gente) + _primer_tramo(mide, 1, m, m8 if medido else None)
    a = {2: 1, 3: 2}.get(tier)
    if a and _cumple(SUBE[a], pts, m8):
        return 'subir', ('listo para Tier %d: %d eventos en 8 semanas con %s raperos por evento' % (
            a, m8.get('eventos', 0), str(m8.get('por_evento', 0)).replace('.', ','))) + recomendado(a, gente)
    falta = no_llega(tier, m, m8 if medido else None, mide)
    if falta:
        return 'revisar', falta
    return 'bien', 'se mantiene en Tier %d' % tier + recomendado(tier, gente) + _primer_tramo(mide, tier, m, m8 if medido else None)


# ── 📊 EL PANEL DE CADA SOCIO (los tres tiers desde el 20/10/2026; nació para 1 y 2) ─────────────────────────────────────────────────────────────────────────
# Dlx, 19/10/2026: *«dar un acceso especial tipo dashboard para los socios, o sea los owners de los sv… para ver cómo sus
# servidores están mejorando, sus estadísticas»*, y a las preguntas: *«digo tier 1 y tier 2»*, el dueño *«automático y
# lo corregís vos»*, y que traiga *«sugerencias para mejorar, ver cuándo hay actividad, qué días hacer eventos y qué
# días no»*, su puntaje y tendencia, eventos y gente, sus raperos y crews, y las visitas a su página.
#
# ⚠️ COMO EL PUNTAJE, VA SÓLO AL OBJETO (`/avisos/tiers-ciclo`) y no al repo, que es público. Lo lee el dueño del
# servidor con su cuenta (`panelSocio()` del objeto); las visitas las pone el objeto, que es quien las cuenta.

DIAS = ('lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos')
#: las franjas del día, en hora del este (las de la Liga: casi todo pasa de tarde y de noche)
FRANJAS = ((0, 6, 'de madrugada'), (6, 12, 'a la mañana'), (12, 16, 'al mediodía'), (16, 20, 'a la tarde'),
           (20, 24, 'a la noche'))
#: con menos eventos que esto en un día o una franja, no se saca conclusión de ese día
MIN_MUESTRA = 2
#: las semanas del panel (la tendencia y los días)
SEMANAS_PANEL = 8


def hora_et(links):
    """🕐 Cuándo se publicó la llave, en hora del este: el ID del mensaje de Discord trae la hora adentro. Es lo más
    cerca que la Liga tiene de cuándo se jugó (la llave sale al arrancar). `None` sin link."""
    try:
        from zoneinfo import ZoneInfo
        et = ZoneInfo('America/New_York')
    except Exception:                                    # noqa: BLE001
        et = dt.timezone(dt.timedelta(hours=-4))
    for u in links or []:
        m = re.search(r'/(\d{17,20})/?$', str(u))
        if m:
            ms = (int(m.group(1)) >> 22) + 1420070400000
            return dt.datetime.fromtimestamp(ms / 1000, et)
    return None


def _franja(h):
    for i, (a, b, _t) in enumerate(FRANJAS):
        if a <= h < b:
            return i
    return len(FRANJAS) - 1


def _prom(xs):
    return round(sum(xs) / len(xs), 1) if xs else 0


# 🔁 ¿VUELVE LA GENTE? Dlx, 04/11/2026, a «¿el panel le muestra al dueño cuánto vuelve su gente?»: *«Si y mejora esos
# paneles»*. Es lo que se midió ese día para toda la Liga (`docs/`, y el informe de uso): los premios casi no mueven a la
# gente, y tener otro evento cerca sí. «Volver» es lo de `rankings.retencion()`: otro evento, OTRO DÍA, dentro de 14.
VUELVE_DIAS = 14
#: «otro evento cerca»: en su servidor, en los días siguientes al debut
VUELVE_CERCA = 3
#: con menos debuts que esto no se da un porcentaje: tres personas no son un 33 %. La misma en web/src/socio2.jsx
MIN_VUELVEN = 8
#: hasta dónde llegan: cuántos jugaron al menos N eventos
EMBUDO = (1, 2, 3, 5, 10)
#: a cuántos se nombra en «Para invitar», y de hasta cuántos días atrás
SIN_VOLVER_N = 8
SIN_VOLVER_DIAS = 30


def quien_vuelve(llaves, hoy):
    """🔁 `{'liga': {...}, 'svs': {sigla: {...}}}`. Cada uno: `n` debuts, `v` los que volvieron, `aca`/`otro` adónde, `con`/`sin`
    `[volvieron, debuts]` según haya otro evento de su servidor cerca, y `emb` hasta dónde llegan. Sólo los debuts con sus 14
    días cumplidos y sin la semana del arranque: mucha de esa gente ya jugaba. `lista`: los que no volvieron, para invitar
    (no le hace falta cumplir los 14 días: es justo a quien hay que llamar). Pura."""
    from comun.claves import clave as K
    arr = _arranque()
    desde = arr + dt.timedelta(days=7 - arr.weekday()) if arr else None
    evs = []
    for k, v in (llaves or {}).items():
        d = _dia(v.get('dia')) if isinstance(v, dict) else None
        if d:
            evs.append((d, str(k), v.get('sv') or '', [f[0] for f in v.get('tabla') or [] if f and f[0]]))
    evs.sort(key=lambda e: (e[0], e[1]))
    por, nombre, dias_sv = {}, {}, {}
    for d, _k, sv, ns in evs:
        dias_sv.setdefault(sv, []).append(d)
        for q, raw in {K(x): x for x in ns}.items():
            if q:
                nombre.setdefault(q, raw)
                por.setdefault(q, []).append((d, sv))

    def nuevo():
        return {'n': 0, 'v': 0, 'aca': 0, 'otro': 0, 'con': [0, 0], 'sin': [0, 0], 'emb': [0] * len(EMBUDO)}
    svs, liga = {}, nuevo()
    for q, xs in por.items():
        d0, sv0 = xs[0]
        a = svs.setdefault(sv0, dict(nuevo(), lista=[]))
        if len(xs) == 1 and 0 < (hoy - d0).days <= SIN_VOLVER_DIAS:
            a['lista'].append((d0, nombre[q], q))
        if (desde and d0 < desde) or (hoy - d0).days < VUELVE_DIAS:
            continue
        sig = next((x for x in xs[1:] if 0 < (x[0] - d0).days <= VUELVE_DIAS), None)
        cerca = 'con' if any(0 < (d - d0).days <= VUELVE_CERCA for d in dias_sv.get(sv0, ())) else 'sin'
        for b in (a, liga):
            b['n'] += 1
            b[cerca][1] += 1
            for i, tope in enumerate(EMBUDO):
                b['emb'][i] += len(xs) >= tope
            if sig:
                b['v'] += 1
                b['aca' if sig[1] == sv0 else 'otro'] += 1
                b[cerca][0] += 1
    return {'liga': liga, 'svs': svs, 'desde': desde.isoformat() if desde else ''}


def vuelven_de(vv, sv, hoy):
    """🔁 Lo de un servidor, para su panel: con la Liga al lado y los que no volvieron, los más recientes primero."""
    a = (vv.get('svs') or {}).get(sv)
    if not a:
        return None
    lista = sorted(a.get('lista') or [], key=lambda x: (-x[0].toordinal(), x[1]))
    L = vv.get('liga') or {}
    return {k: a[k] for k in ('n', 'v', 'aca', 'otro', 'con', 'sin', 'emb')} | {
        'desde': vv.get('desde') or '', 'liga': {k: L.get(k) for k in ('n', 'v', 'con', 'sin', 'emb')},
        'sin_volver': [[n, q, (hoy - d).days] for d, n, q in lista[:SIN_VOLVER_N]], 'sin_n': len(lista)}


def _pct(a, b):
    return round(100 * a / b) if b else 0


def _coma(x):
    return str(round(x or 0, 1)).replace('.', ',')


def _filas_req(req, pts, m8):
    """`[[qué, cómo va, si cumple]]` de un requisito de `SUBE`/`SEGUIR`, con las 8 semanas."""
    m8 = m8 or {}
    out = []
    if 'eventos' in req:
        out.append(['%d eventos en 8 semanas' % req['eventos'], 'llevas %d' % m8.get('eventos', 0), m8.get('eventos', 0) >= req['eventos']])
    if 'por_evento' in req:
        out.append(['%d raperos por evento, de promedio' % req['por_evento'], 'llevas %s en 8 semanas' % _coma(m8.get('por_evento', 0)),
                    m8.get('por_evento', 0) >= req['por_evento']])
    if 'puntos' in req:
        out.append(['%d puntos o más' % req['puntos'], 'llevas %d' % (pts or 0), (pts or 0) >= req['puntos']])
    # 🎭 el Tier 2 da estilos (Dlx, 20/11/2026: «1 por mes»): los eventos de estilo de SU servidor en las 8 semanas
    if 'estilos' in req:
        si = m8.get('estilos', 0) >= req['estilos']
        fila = ['%d eventos de estilo en 8 semanas (1 por mes)' % req['estilos'], 'llevas %d' % m8.get('estilos', 0), si]
        # ⏳ el cuarto lugar es desde cuándo cuenta, mientras no tuvo sus 8 semanas: va, pero todavía no es «no llega»
        if not si and m8.get('estilos_cuenta'):
            fila.append(m8['estilos_cuenta'])
        out.append(fila)
    return out


def como_subir(tier, pts, m, m8=None):
    """🪜 Lo que le falta para el tier de arriba: `{'a': tier, 'pide': [[qué, cómo va, si cumple]], 'rec': [qué, cómo va, si
    llega] | None, 'despues': str}`; `None` en Tier 1. Lo mismo que mira `recomendar()` (`SUBE`): si se cambia una regla, es
    ahí. Dlx, 04/11/2026, al kit de los servidores nuevos: *«explica lo de tiers, como subir de tier»*. Los miembros van en
    `rec`, aparte de `pide`: desde el 19/11/2026 son un recomendado, no un requisito, y no cuentan en «N de M». `despues`: lo
    que viene después de cumplir (a Tier 1, un mes de prueba), que no se mide."""
    m = m or {}
    a = {3: 2, 2: 1}.get(tier)
    if a is None:
        return None
    gente = m.get('miembros')
    rec = (['Se recomiendan %s miembros en tu Discord' % _mil(RECOMENDADO[a]), 'tienes %s' % _mil(gente), gente >= RECOMENDADO[a]]
           if gente is not None else None)
    out = {'a': a, 'pide': _filas_req(SUBE[a], pts, m8), 'rec': rec}
    if a == 1:
        out['despues'] = 'Después de cumplir, un mes de prueba en Tier 1'
    return out


def pide(tier, m, m8=None):
    """📋 Lo que pide su tier para quedarse (`SEGUIR`): `[[qué, cómo va, si cumple]]`. Tier 3: seguir vivo, un evento o una
    fecha de liga en las últimas 4 semanas (`m`). Lo dice «En el aire» del panel; no mueve a nadie (decide Dlx)."""
    req = SEGUIR.get(tier)
    if req is None:
        return []
    if 'vivo' in req:
        m = m or {}
        ev, lg = m.get('eventos', 0), m.get('ligas', 0)
        return [['Seguir vivo: un evento o una fecha de liga por mes', 'llevas %d %s y %d %s en 4 semanas' % (
            ev, 'evento' if ev == 1 else 'eventos', lg, 'liga' if lg == 1 else 'ligas'), ev + lg >= req['vivo']]]
    return _filas_req(req, 0, m8)


def panel(D, hoy, sv, ps=None, crews=None, otros=None):
    """📊 Lo de un servidor para su dueño. `D` es lo de `datos()`; `ps`, la gente de `por_servidor.json`; `crews`,
    `{clave de persona: (id, nombre de la crew)}`; `otros`, las siglas de los demás socios (para cuántos eventos tiene
    la Liga cada día). Devuelve `{semanas, dias, franjas, liga, raperos, crews, sugerencias}`. Pura."""
    from comun.claves import clave as K
    fin = hoy + dt.timedelta(days=1)
    lunes = hoy - dt.timedelta(days=hoy.weekday())
    ini = lunes - dt.timedelta(days=7 * (SEMANAS_PANEL - 1))
    # 📅 desde el lunes de la semana del arranque, si es más nuevo: una semana de antes de la temporada no tiene eventos y
    # no dice nada (el panel arrancaba el 14/09 con «sin eventos», y la T1 empezó el 22)
    arr = _arranque()
    if arr:
        ini = max(ini, arr - dt.timedelta(days=arr.weekday()))
    ini4 = fin - dt.timedelta(days=28)
    evs = []
    primero = {}
    for v in sorted((D.get('llaves') or {}).values(), key=lambda v: str(v.get('dia') or '')):
        d = _dia(v.get('dia'))
        if not d:
            continue
        gente = [f[0] for f in v.get('tabla') or [] if f and f[0]]
        n = int(v.get('participantes') or 0) or len(gente)
        for x in gente:
            primero.setdefault(x, (d, v.get('sv') or ''))
        evs.append((d, v.get('sv') or '', n, hora_et(v.get('links')), gente))
    mios = [e for e in evs if e[1] == sv and ini <= e[0] < fin]
    # la tendencia: semana por semana (de lunes a domingo), con la gente nueva que trajo cada una
    semanas = []
    for k in range(max(0, (lunes - ini).days // 7 + 1)):
        a = ini + dt.timedelta(days=7 * k)
        b = a + dt.timedelta(days=7)
        ee = [e for e in mios if a <= e[0] < b]
        nuevos = sum(1 for x, (d, s) in primero.items() if s == sv and a <= d < b)
        semanas.append([a.isoformat(), len(ee), sum(e[2] for e in ee), nuevos])
    # los días y las franjas: cuántos eventos y cuánta gente por evento
    dias = [[0, 0] for _ in DIAS]
    for i in range(7):
        xs = [e[2] for e in mios if e[0].weekday() == i]
        dias[i] = [len(xs), _prom(xs)]
    franjas = []
    for i in range(len(FRANJAS)):
        xs = [e[2] for e in mios if e[3] and _franja(e[3].hour) == i]
        franjas.append([len(xs), _prom(xs)])
    # la Liga: cuántos eventos por semana hay cada día en los demás socios, y cuánta gente juntan
    otros = set(otros or ()) - {sv}
    liga = []
    for i in range(7):
        ee = [e for e in evs if e[1] in otros and ini4 <= e[0] < fin and e[0].weekday() == i]
        liga.append([round(len(ee) / 4.0, 1), _prom([e[2] for e in ee])])
    # su gente: lo de cada uno EN este servidor (`por_servidor.json`)
    raperos = []
    for n, x in (ps or {}).items():
        y = (x or {}).get(sv) or {}
        if y.get('ev'):
            raperos.append([n, K(n), int(y.get('ev') or 0), int(y.get('pts') or 0), int(y.get('oro') or 0), int(y.get('pod') or 0)])
    raperos.sort(key=lambda r: (-r[3], -r[2], r[0]))
    cr = {}
    for r in raperos:
        c = (crews or {}).get(r[1])
        if c:
            a = cr.setdefault(c[0], [c[0], c[1], 0, 0])
            a[2] += 1
            a[3] += r[3]
    crews_top = sorted(cr.values(), key=lambda c: (-c[2], -c[3]))[:6]
    # ⚠️ la tendencia de las sugerencias, con la MISMA ventana que los números de arriba (los últimos 28 días, como
    # `medir()`): con las semanas de lunes a domingo del gráfico daba 63 eventos donde el recuadro decía 76
    a4, a8 = fin - dt.timedelta(days=28), fin - dt.timedelta(days=56)
    ev4 = [sum(1 for e in evs if e[1] == sv and a8 <= e[0] < a4), sum(1 for e in evs if e[1] == sv and a4 <= e[0] < fin),
           sum(1 for x, (d, s) in primero.items() if s == sv and a4 <= d < fin)]
    # 📈 y la tendencia, sólo si las 4 semanas de antes son de esta temporada: la regla de `compara` en medir(). Contra
    # semanas de antes del arranque todos «suben» (FFA, 02/11/2026: «Vas en subida: 71 eventos contra 34», y esos 34 eran
    # dos semanas de temporada contra cuatro: 17,75 por semana contra 17)
    if arr and a8 < arr:
        ev4[0] = 0
    out = {'semanas': semanas, 'dias': dias, 'franjas': franjas, 'liga': liga, 'raperos': raperos[:10],
           'gente_total': len(raperos), 'crews': crews_top, 'ev4': ev4}
    vv = D.get('_vuelven') or quien_vuelve(D.get('llaves') or {}, hoy)
    v = vuelven_de(vv, sv, hoy)
    if v:
        out['vuelven'] = v
    out['sugerencias'] = sugerencias(out)
    return out


def sugerencias(p, m=None):
    """💡 Lo que conviene, en palabras: ver `sugerencias_ir()`."""
    return [t for t, _ in sugerencias_ir(p, m)]


def sugerencias_ir(p, m=None):
    """💡 Lo que conviene, en palabras y con el número que lo respalda: qué días junta más gente, cuál menos, qué días
    la Liga está más o menos llena, a qué hora y cómo viene. Sólo lo que los números dicen: con poca muestra, nada.
    Cada una con la parte del panel donde se ve lo que dice (`IR` de web/src/socio2.jsx): `[(texto, id de la sección)]`."""
    out = []
    # 🔁 primero lo que el dueño puede cambiar: de esto depende que la gente vuelva a jugar
    v = p.get('vuelven') or {}
    if (v.get('n') or 0) >= MIN_VUELVEN and (v.get('liga') or {}).get('n'):
        L = v['liga']
        out.append(('De quienes debutan en tu servidor vuelve el %d %% en 14 días; en toda la Liga, el %d %%.' % (_pct(v['v'], v['n']), _pct(L['v'], L['n'])), 'sp-vuelven'))
        if (m or {}).get('por_semana', 0) < 3 and L['con'][1] and L['sin'][1]:
            out.append(('Con otro evento en los 3 días siguientes vuelve el %d %%; sin otro evento, el %d %%. Un evento más por semana ayuda a que vuelvan.'
                        % (_pct(*L['con']), _pct(*L['sin'])), 'sp-vuelven'))
    dias = p.get('dias') or []
    buenos = [(i, d) for i, d in enumerate(dias) if d[0] >= MIN_MUESTRA]
    if len(buenos) >= 2:
        mejor = max(buenos, key=lambda x: x[1][1])
        peor = min(buenos, key=lambda x: x[1][1])
        out.append(('Los %s tus eventos juntan %s raperos de promedio: el mejor día que tienes.' % (DIAS[mejor[0]], _n(mejor[1][1])), 'sp-cuando'))
        if peor[0] != mejor[0] and peor[1][1] < mejor[1][1] * 0.8:
            out.append(('Los %s, %s de promedio: el más flojo. Si puedes, muévelo a otro día.' % (DIAS[peor[0]], _n(peor[1][1])), 'sp-cuando'))
    liga = p.get('liga') or []
    if any(x[0] for x in liga):
        lleno = max(range(7), key=lambda i: liga[i][0])
        libres = [i for i in range(7) if liga[i][0] <= 0.5]
        if liga[lleno][0] >= 2:
            out.append(('Los %s la Liga tiene %s eventos por semana: un evento tuyo ese día compite por la misma gente.'
                        % (DIAS[lleno], _n(liga[lleno][0])), 'sp-cuando'))
        if libres:
            out.append(('Casi nadie juega los %s (%s): menos competencia para llenar tu llave.'
                        % (_lista([DIAS[i] for i in libres]), 'ningún evento' if all(liga[i][0] == 0 for i in libres) else 'medio evento por semana o menos'), 'sp-cuando'))
    fr = [(i, f) for i, f in enumerate(p.get('franjas') or []) if f[0] >= MIN_MUESTRA]
    if len(fr) >= 2:
        i, f = max(fr, key=lambda x: x[1][1])
        out.append(('%s es cuando más gente juntas (%s por evento).' % (FRANJAS[i][2].capitalize(), _n(f[1])), 'sp-cuando'))
    ev4 = p.get('ev4') or []
    if len(ev4) == 3:
        a, b, nuevos = ev4
        if b == 0 and a:
            out.append(('En las últimas 4 semanas no hubo eventos: un evento por semana ya te devuelve a la tabla.', 'sp-semanas'))
        elif a and b >= a * 1.25:
            out.append(('Vas en subida: %d eventos en las últimas 4 semanas contra %d en las 4 de antes.' % (b, a), 'sp-semanas'))
        elif a and b <= a * 0.75:
            out.append(('Bajaste: %d eventos en las últimas 4 semanas contra %d en las 4 de antes.' % (b, a), 'sp-semanas'))
        if nuevos:
            out.append(('Trajiste %d raperos nuevos en 4 semanas: avísales del próximo evento para que vuelvan.' % nuevos, 'sp-vuelven' if v.get('sin_volver') else 'sp-ajustes'))
    m = m or {}
    if m.get('eventos') and m.get('por_semana', 0) < 1:
        out.append(('Haces %s eventos por semana; con 2 por semana la parte de actividad de tu puntaje llega al máximo.' % _n(m['por_semana']), 'sp-puntaje'))
    if m.get('anuncios') and m.get('con_staff', 0) < m['anuncios'] * 0.5:
        out.append(('Sólo %d de tus %d anuncios dicen quién organiza: ponerlo suma a la calidad.' % (m.get('con_staff', 0), m['anuncios']), 'sp-puntaje'))
    return out[:7]


def _n(x):
    """10.5 -> «10,5»; 10.0 -> «10»."""
    return ('%d' % x) if float(x) == int(x) else ('%s' % x).replace('.', ',')


def _lista(xs):
    return xs[0] if len(xs) == 1 else ', '.join(xs[:-1]) + ' y ' + xs[-1]


def duenos(svs, tok):
    """👑 El dueño de cada servidor en Discord (`owner_id` del servidor), para el panel. `{sigla: id}`; el que no se pudo
    leer, no está. Dlx lo corrige en el Dashboard (`socios_duenos`), y eso manda."""
    import requests
    out = {}
    for sv, x in (svs or {}).items():
        g = str(x.get('guild_id') or x.get('guild') or '')
        if not re.match(r'^\d{15,22}$', g):
            continue
        try:
            r = requests.get('https://discord.com/api/v10/guilds/' + g, headers={'Authorization': 'Bot ' + tok}, timeout=15)
            if r.status_code == 200 and re.match(r'^\d{15,22}$', str(r.json().get('owner_id') or '')):
                out[sv] = str(r.json()['owner_id'])
        except Exception:                                # noqa: BLE001
            continue
    return out


def datos():
    """Lo que pide `medir()`, de `datos/`."""
    import zoneinfo
    et = zoneinfo.ZoneInfo('America/New_York')
    ayudas = []
    for x in ((_j('datos', 'decidir_solas.json') or {}).get('solas') or []):
        sv, d = _sv_de_sec(x.get('sec'))
        if x.get('t'):
            d = dt.datetime.fromtimestamp(int(x['t']) / 1000, et).date()
        ayudas.append((sv, d))
    dec = _j('datos', 'decisiones.json') or {}
    for sec in ('batallas', 'quien', 'eventos', 'sacar', 'equipos', 'cobra'):
        for k, v in (dec.get(sec) or {}).items():
            if k == '_leeme':
                continue
            sv, d = _sv_de_sec(k if '·' in k else (v.get('batalla') or '') if isinstance(v, dict) else '')
            if not sv and isinstance(v, dict):
                sv = v.get('sv') or ''
            ayudas.append((sv, d))
    an = {}
    for m, v in (((_j('datos', 'mes_awards.json') or {}).get('vistas') or {}).items()):
        for mid, a in ((v or {}).get('an') or {}).items():
            an[mid] = (a.get('sv') or '', _dia(a.get('mo')), bool(a.get('staff')))
    for a in ((_j('datos', 'anuncios.json') or {}).get('anuncios') or []):
        mid = str(a.get('msg_id') or '')
        if mid and mid not in an:
            an[mid] = (a.get('servidor') or '', _dia(a.get('cuando')), bool(a.get('staff')))
    canc = [(x.get('sv') or '', _dia(x.get('t'))) for x in ((_j('datos', 'cancelados.json') or {}).get('eventos') or {}).values()]
    pro = [(x.get('sv') or '', _dia(x.get('t'))) for x in ((_j('datos', 'promos.json') or {}).get('items') or [])]
    return {'estilos': (_j('datos', 'eventos_estilo.json') or {}).get('eventos') or {},
            'llaves': _j('datos', 'llaves_t1.json') or {}, 'ayudas': ayudas, 'anuncios': list(an.values()),
            'cancelados': canc, 'promos': pro, 'ligas': (_j('datos', 'ligas.json') or {}).get('ligas') or {}}


def sin_lo_nuevo(x):
    """El paquete sin lo opcional del panel, para cuando el Worker todavía tiene el tope viejo."""
    y = dict(x)
    y['servidores'] = [dict(f, panel={k: v for k, v in (f.get('panel') or {}).items() if k not in ('vuelven', 'subir')})
                       if f.get('panel') else f for f in x.get('servidores') or []]
    return y


def _mandar(x):
    """El puntaje al Dashboard (`/avisos/tiers-ciclo`, con la clave del ciclo). Devuelve si llegó."""
    import requests
    import fotos as F
    import clave_ciclo as CC
    from alertar import WORKER
    tok = F.env('DISCORD_TOKEN', obligatorio=False)
    if not tok:
        print('   ⚠️ sin DISCORD_TOKEN: el puntaje no va al Dashboard')
        return False

    def enviar(cosa):
        return requests.post(WORKER + '/avisos/tiers-ciclo', headers={'x-lg-ciclo': CC.clave(tok), 'content-type': 'application/json'},
                             data=json.dumps(cosa, ensure_ascii=False, separators=(',', ':')).encode('utf-8'), timeout=25).status_code
    # 🔴 DIO 413 DESDE EL 21/10/2026 Y SÓLO LO DECÍA EL LOG: los paneles y el Dashboard se quedaron con los números de ese
    # día durante dos semanas. Ahora, si no entra entero, va sin lo que sumó la 4.26 (lo demás no espera a un despliegue),
    # y si no llega, le llega un DM a Dlx
    cod = enviar(x)
    if cod == 413:
        print('   ⚠️ el panel no entra en el tope del Worker: va sin «vuelven» y sin «subir». Hay que desplegar el Worker')
        cod = enviar(sin_lo_nuevo(x))
    if cod != 200:
        print('   ⚠️ el puntaje no llegó al Dashboard (%s)' % cod)
    try:
        import alertar as AL
        if cod == 200:
            AL.resuelto('tiers', 'Los paneles de los socios volvieron a actualizarse.')
        else:
            AL.alertar('tiers', 'Los paneles de los socios no se están actualizando: el Worker contesta %s a `/avisos/tiers-ciclo`.' % cod)
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ no pude avisar lo del panel (%s)' % str(e)[:60])
    return cod == 200


def correr(aplicar=False, ahora=None):
    import zoneinfo
    hoy = (ahora or dt.datetime.now(dt.timezone.utc)).astimezone(zoneinfo.ZoneInfo('America/New_York')).date()
    todo_svs = _j('datos', 'servidores.json') or {}
    svs = todo_svs.get('servidores') or {}
    viejo = _j('datos', 'niveles.json') or {}
    elegidos = dict(viejo.get('niveles') or {})
    elegidos_b = dict(viejo.get('beneficios_elegidos') or {})
    # lo elegido en el Dashboard manda; sin poder leerlo, queda lo de antes (un Worker que no contesta no es «Dlx cambió»)
    aj = None
    if aplicar:
        try:
            import multiplicadores as MU
            aj = MU.ajustes_dueno()
        except Exception as e:                           # noqa: BLE001
            print('   ⚠️ los tiers: no leí los ajustes (%s)' % str(e)[:60])
            aj = None
        if aj is not None:
            elegidos = {k: v for k, v in ((aj.get('tiers') or {}).items()) if v in TIERS}
            elegidos_b = aj.get('beneficios') or {}
            # ➕ los servidores nuevos del Dashboard, antes de medir: así entran a la lista en esta misma corrida
            nuevas = altas(aj, svs, ahora=ahora)
            # 🧭 y los del /setup (19/11/2026), y lo que Dlx decidió de sus puntos de Temporada
            nuevas_su = altas_setup(aj, svs, ahora=ahora)
            aprobadas = aprobar_setup(aj, svs, ahora=ahora)
            # 🔑🏟️ y los canales de llaves y de ligas que eligieron (21/11/2026), de todos los que corrieron /setup
            canales_su = canales_del_setup(aj, svs)
            if canales_su:
                print('   🔑 /setup: canales de llaves o de ligas de %s' % ', '.join(canales_su))
            if nuevas or nuevas_su or aprobadas or canales_su:
                with io.open(os.path.join(BASE, 'datos', 'servidores.json'), 'w', encoding='utf-8', newline='\n') as f:
                    json.dump(todo_svs, f, ensure_ascii=False, indent=1)
                    f.write('\n')
                if nuevas:
                    print('   ➕ dados de alta desde el Dashboard: %s' % ', '.join(nuevas))
                if nuevas_su:
                    print('   🧭 entraron con /setup (Tier 3, sin sumar hasta que Dlx apruebe): %s' % ', '.join(nuevas_su))
                if aprobadas:
                    print('   ✅ los puntos de Temporada del /setup cambiaron: %s' % ', '.join(
                        '%s %s' % (sv, 'aprobado' if svs[sv].get('suma_aprobada') else 'sin aprobar') for sv in aprobadas))
                try:
                    import fotos as F
                    _alta_completar(nuevas + nuevas_su, svs, F.env('DISCORD_TOKEN', obligatorio=False))
                except Exception as e:                   # noqa: BLE001
                    print('   ⚠️ el bot y la invitación de los nuevos: %s' % str(e)[:80])
    nivel = niveles(svs, elegidos)
    ben, bloq = beneficios(nivel, elegidos_b, codigo=en_el_codigo(svs), pendientes=pendientes_setup(svs))
    # 👥 los miembros de cada Discord, de su invitación (lo mismo que muestra Socios: `subir_web._miembros()`)
    gente = {}
    if aplicar:
        try:
            import subir_web
            gente = {sv: x['miembros'] for sv, x in (subir_web._miembros(svs) or {}).items() if x.get('miembros')}
        except Exception as e:                           # noqa: BLE001
            print('   ⚠️ los tiers: no leí los miembros (%s)' % str(e)[:60])
    D = datos()
    D['_vuelven'] = quien_vuelve(D.get('llaves') or {}, hoy)
    desde = desde_de(viejo.get('desde'), nivel, hoy)
    filas = medir(D, hoy, svs, nivel, gente, desde)
    # 🔥 quién juega seguido en cada uno, para el aviso de evento flojo (`frecuentes()`): sólo al objeto, con la fila
    try:
        import construir_padron as _PAD
        _idx = {_PAD.norm(x['raw']): str(x.get('discord_id') or '') for x in _PAD.cargar() if x.get('raw')}
        _fr = frecuentes(D.get('llaves'), hoy, lambda n: _idx.get(_PAD.norm(n), ''))
        for f in filas:
            if _fr.get(f['sv']):
                f['frec'] = _fr[f['sv']]
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ los que juegan seguido no se armaron (%s): el aviso de evento flojo espera' % str(e)[:60])
    # 🎛️ los beneficios de cada uno van con su fila: el Dashboard dibuja los interruptores y el objeto filtra el panel
    for f in filas:
        f['ben'] = ben.get(f['sv']) or {}
        if bloq.get(f['sv']):
            f['bloq'] = bloq[f['sv']]
        if (svs.get(f['sv']) or {}).get('alta') == 'dashboard':
            f['alta'] = True
        # 🧭 los del /setup: el Dashboard dice «espera tu respuesta» en vez de «falta sumarlo al código»
        if de_setup(svs.get(f['sv'])):
            f['alta'] = True
            f['setup'] = 'aprobado' if svs[f['sv']].get('suma_aprobada') else 'pendiente'
    # 📊 el panel de cada socio, con su dueño (ver arriba). Los tres tiers: Dlx, 20/10/2026, del dueño de FDS (Tier 3),
    # «para que pueda ver su página y sus estadísticas»
    try:
        from comun.crews import DE_CADA_UNO, norm as _norm
        from comun.claves import clave as _K
        noms = (_j('datos', 'crews.json') or {}).get('_nombres') or {}
        ps = (_j('datos', 'por_servidor.json') or {}).get('gente') or {}
        crews = {}
        for n in ps:
            c = DE_CADA_UNO.get(_norm(n))
            if c:
                crews[_K(n)] = (c, noms.get(c, c))
        socios = [sv for sv, t in nivel.items() if t in TIERS]
        for f in filas:
            if f['tier'] in TIERS:
                f['panel'] = panel(D, hoy, f['sv'], ps, crews, socios)
                f['panel']['subir'] = como_subir(f['tier'], f['puntos'], f.get('m'), f.get('m8'))
                f['panel']['pide'] = pide(f['tier'], f.get('m'), f.get('m8'))
                # los números de `SEGUIR` de su tier: con eso la cabina dibuja los bloques sin copiar las reglas
                f['panel']['seguir'] = SEGUIR.get(f['tier'])
                # 🐣 en su primer tramo, la cabina dice desde cuándo cuenta en vez de «Te falta»
                if f.get('mide_desde'):
                    f['panel']['mide_desde'] = f['mide_desde']
                su = sugerencias_ir(f['panel'], f.get('m'))
                f['panel']['sugerencias'] = [t for t, _ in su]
                f['panel']['sug_ir'] = [d for _, d in su]
        if aplicar:
            import fotos as F
            tok = F.env('DISCORD_TOKEN', obligatorio=False)
            ds = duenos({sv: svs[sv] for sv in socios if sv in svs}, tok) if tok else {}
            for f in filas:
                if f['sv'] in ds:
                    f['dueno'] = ds[f['sv']]
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ el panel de los socios no se armó (%s): el puntaje va igual' % str(e)[:80])
    if aplicar:
        nuevo = {'_leeme': 'El nivel de cada servidor de la Liga (Tier 1: suma al ranking; 2: sólo el calendario; 3: su '
                           'página, sus ligas y sus eventos promocionados, sin sumar). Lo elige Dlx en el Dashboard; sin '
                           'elegir, el `tier` de datos/servidores.json, y si no, Tier 1. Lo escribe bot/tiers.py y lo leen '
                           'el lector de llaves y las ligas. El puntaje de cada uno NO va acá: va al Dashboard.',
                 'niveles': {sv: t for sv, t in sorted(nivel.items())},
                 # 🎛️ lo que resulta (los lectores preguntan con `sin()`) y lo que Dlx eligió, para cuando el Dashboard
                 # no contesta
                 'beneficios': {sv: ben[sv] for sv in sorted(ben)},
                 'beneficios_elegidos': elegidos_b,
                 # 📅 el día en que entró cada uno (`desde_de()`): lo que pide su tier cuenta desde su primer tramo entero
                 'desde': desde,
                 # 🤝 los bonos de la Alianza (`alianza_bonus()`): +2 Pases al Tier 1 cuando su aliado sube
                 'alianza_bonus': alianza_bonus((aj or {}).get('alianzas'), viejo.get('niveles') or {}, nivel, hoy,
                                                viejo.get('alianza_bonus'))}
        if any(nuevo.get(k) != viejo.get(k) for k in ('niveles', 'beneficios', 'beneficios_elegidos', 'desde', 'alianza_bonus')):
            with io.open(NIVELES, 'w', encoding='utf-8', newline='\n') as f:
                json.dump(nuevo, f, ensure_ascii=False, indent=1)
            print('   🤝 los niveles cambiaron: %s' % ', '.join('%s %d' % kv for kv in sorted(nivel.items())))
        # 📣 a los del /setup que YA suman (aprobados y con `suma` prendido), su aviso, una vez. Después de escribir los
        # niveles: el aviso dice algo que ya es cierto
        try:
            import fotos as F
            avisados = avisar_suma(svs, ben, F.env('DISCORD_TOKEN', obligatorio=False), ahora=ahora)
            if avisados:
                with io.open(os.path.join(BASE, 'datos', 'servidores.json'), 'w', encoding='utf-8', newline='\n') as f:
                    json.dump(todo_svs, f, ensure_ascii=False, indent=1)
                    f.write('\n')
                print('   📣 les avisé que ya suman: %s' % ', '.join(avisados))
        except Exception as e:                           # noqa: BLE001
            print('   ⚠️ el aviso de «ya suman»: %s' % str(e)[:80])
        # 🤝 a cada Tier 1, los bonos de su Alianza de este mes (para su panel y el Dashboard)
        mes = hoy.strftime('%Y-%m')
        for f in filas:
            bs = [b for b in nuevo.get('alianza_bonus') or [] if b.get('t1') == f['sv'] and str(b.get('dia') or '')[:7] == mes]
            if bs:
                f['alianza_bonus'] = bs
        try:
            _mandar({'t': (ahora or dt.datetime.now(dt.timezone.utc)).strftime('%Y-%m-%dT%H:%M:%SZ'), 'semanas': SEMANAS,
                     'servidores': filas})
        except Exception as e:                           # noqa: BLE001
            print('   ⚠️ el puntaje no llegó al Dashboard (%s)' % str(e)[:60])
    return filas


# ── self-check ───────────────────────────────────────────────────────────────────────────────────────────────────────
def _self_check():
    print('\n══ LOS TIERS ══\n')
    mal = 0

    def ok(c, q, extra=''):
        nonlocal mal
        mal += not c
        print('   %s %s%s' % ('✅' if c else '🔴', q, ('  ' + extra) if extra and not c else ''))

    svs = {'AAA': {'confirmado': True, 'guild_id': '1', 'nombre': 'Uno'}, 'BBB': {'confirmado': True, 'guild_id': '2'},
           'CCC': {'confirmado': True, 'guild_id': '3'}, 'FUE': {'en_la_liga': False, 'confirmado': True, 'guild_id': '4'}}
    ok(niveles(svs, {}) == {'AAA': 1, 'BBB': 1, 'CCC': 1}, 'sin elegir, Tier 1 quien está en la Liga (el de afuera no)')
    con3 = dict(svs, NUE={'confirmado': True, 'guild_id': '5', 'tier': 3}, MAL={'confirmado': True, 'guild_id': '6', 'tier': 7})
    ok(niveles(con3, {})['NUE'] == 3 and niveles(con3, {})['MAL'] == 1 and niveles(con3, {'NUE': 1})['NUE'] == 1
       and guilds_bajados(con3, {}) == {'5'},
       'el `tier` de servidores.json es el default de un servidor nuevo (uno que no es tier no vale); lo elegido manda sobre él')
    ok(niveles(svs, {'BBB': 2, 'CCC': 9}) == {'AAA': 1, 'BBB': 2, 'CCC': 1} and bajados(svs, {'BBB': 3}) == {'BBB'}
       and bajados(svs, {'BBB': 2}) == set() and guilds_bajados(svs, {'BBB': 2, 'CCC': 3}) == {'3'},
       'lo elegido manda; un número que no es tier no vale; sólo el Tier 3 es «bajado» (el 2 cuenta todo desde el 19/11)')
    # 🥈 el Tier 2 prende lo mismo que el 1 (Dlx, 19/11/2026): lo que los separa es el botón de unirse, no un beneficio
    ok(PRESET[2] == PRESET[1] and PRESET[3] < PRESET[1] and 'competitivo' not in PRESET[3] and 'duelos' in PRESET[3]
       and globals()['sin']('duelos', {'niveles': {'X': 3}}) == set()
       and globals()['sin']('competitivo', {'niveles': {'X': 3}}) == {'X'},
       'el Tier 2 prende lo mismo que el 1, y el 3 todo menos el Competitivo: sus ligas también son duelos (19/11/2026)')
    # 🎛️ los beneficios y el alta
    bn, bq = beneficios({'AAA': 1, 'BBB': 3, 'CCC': 1}, {'BBB': {'ligas': False}, 'CCC': {'suma': True}}, codigo={'AAA', 'BBB'})
    ok(bn['AAA']['suma'] and bn['AAA']['competitivo'] and bn['BBB']['suma'] and not bn['BBB']['competitivo']
       and bn['BBB']['pagina'] and not bn['BBB']['ligas']
       and not bn['CCC']['suma'] and bq == {'CCC': ['suma', 'competitivo', 'duelos']},
       'el tier es un preset (todos suman a la Temporada, el Competitivo sólo el 1), lo elegido manda; sumar pide estar '
       'en el código (CCC no, aunque lo prendan)')
    sb = globals()['sin']   # (el self-check tiene su propio `sin`, más abajo)
    ok(sb('suma', {'beneficios': {k: v for k, v in bn.items()}}) == {'CCC'}
       and sb('competitivo', {'beneficios': {k: v for k, v in bn.items()}}) == {'BBB', 'CCC'}
       and sb('competitivo', {'niveles': {'AAA': 1, 'BBB': 2}}) == set() and sb('competitivo', {'niveles': {'AAA': 1, 'BBB': 3}}) == {'BBB'}
       and sb('suma', {'niveles': {'AAA': 1, 'BBB': 2}}) == set()
       and sb('pagina', {'niveles': {'AAA': 1}}) == set(),
       'los lectores preguntan con sin(); sin beneficios guardados, lo de antes')
    sv2 = {'AAA': {'guild_id': '111111111111111111'}}
    nv = altas({'altas': {'NUE': {'n': 'Nuevo', 'g': '222222222222222222', 't': 3, 'tag': 'comunidad'},
                          'DUP': {'n': 'Otro', 'g': '111111111111111111'}, 'AAA': {'n': 'x', 'g': '333333333333333333'},
                          'mal': {'n': 'x', 'g': '444444444444444444'}}}, sv2)
    ok(nv == ['NUE'] and sv2['NUE']['confirmado'] and sv2['NUE']['tier'] == 3 and sv2['NUE']['alta'] == 'dashboard'
       and sv2['NUE']['tag'] == 'COMUNIDAD',
       'el alta: entra el nuevo, confirmado y con su tier; ni una sigla que ya está, ni un guild repetido, ni una sigla mal')
    # 🧭 EL /setup (19/11/2026): entra solo, NO suma hasta que Dlx apruebe, y lo que ya estaba no cambia
    G1, G2, G3, G4, G5 = '111111111111111111', '444444444444444444', '555555555555555555', '999999999999999999', '666666666666666666'
    base_su = {'AAA': {'confirmado': True, 'guild_id': G1, 'nombre': 'Uno'},
               'FUE': {'en_la_liga': False, 'confirmado': True, 'guild_id': G2, 'nombre': 'Afuera'}}
    aj_su = {'setup_altas': [
        {'g': G3, 'n': 'Freestyle Nuevo Club', 'sigla': 'FNC', 'pl': 'completa', 't': 2, 'aviso': G5,
         'inv': {'codigo': 'abcDEF12', 'canal': 'bienvenida', 'canal_id': '777777777777777777'},
         'c': {'an': '888888888888888888', 'xx': '1'}, 'por': '123456789012345678'},
        {'g': G1, 'n': 'Uno otra vez', 'sigla': 'UNO', 't': 1},
        {'g': G2, 'n': 'Afuera', 'sigla': 'AFU', 't': 1, 'fuera': True},
        {'g': G4, 'n': 'Otro Uno', 'sigla': 'AAA', 't': 3}]}
    s1 = json.loads(json.dumps(base_su))
    ah = dt.datetime(2026, 11, 19, 22, 0, tzinfo=dt.timezone.utc)
    nv_su = altas_setup(aj_su, s1, ahora=ah)
    f1 = s1.get('FNC') or {}
    ok(nv_su == ['FNC', 'OU'] and s1['AAA'] == base_su['AAA'] and s1['FUE'] == base_su['FUE'],
       'el /setup: entran los nuevos; un guild que ya es de la Liga o que está registrado afuera no se toca; una sigla '
       'ocupada se cambia por otra libre', str(nv_su))
    ok(f1.get('confirmado') and f1.get('tier') == 3 and f1.get('alta') == 'setup' and f1.get('sigla') == 'FNC'
       and (f1.get('invitacion_liga') or {}).get('codigo') == 'abcDEF12' and f1.get('canales_setup') == {'an': '888888888888888888'}
       and (f1.get('setup') or {}).get('aviso') == G5 and '123456789012345678' not in json.dumps(f1),
       'el del /setup entra confirmado, Tier 3, con su invitación y sus canales, y SIN quién lo corrió (el repo es público)', str(f1))
    ok(pendientes_setup(s1) == {'FNC', 'OU'} and aprobados_setup(s1) == [], 'recién entrado, espera a Dlx')
    # 🔑🏟️ las llaves y las ligas del /setup (21/11/2026): de todos, también de un socio de antes, y sacarlas también llega
    LL, LG = '1700000000000000101', '1700000000000000102'
    s2 = json.loads(json.dumps(s1))
    cam = canales_del_setup({'setup_canales': {s2['AAA']['guild_id']: {'ll': [LL, 'x', LL + '9' * 9], 'lg': [LG], 'ev': []},
                                               s2['FNC']['guild_id']: {'ll': [], 'lg': []},
                                               '1999999999999999999': {'ll': [LL]}}}, s2)
    ok(cam == ['AAA'] and s2['AAA']['canales_setup'] == {'ll': [LL], 'lg': [LG]}
       and s2['FNC']['canales_setup'] == {'an': '888888888888888888'} and {k: v for k, v in s2['AAA'].items() if k != 'canales_setup'} == s1['AAA'],
       'los canales de llaves y de ligas del /setup: a un socio de antes también (sin tocar su tier); un id mal o de un '
       'guild que no es de la Liga, no; listas vacías no borran lo del alta', str(cam) + str(s2['AAA'].get('canales_setup')))
    cam2 = canales_del_setup({'setup_canales': {s2['AAA']['guild_id']: {'ll': [], 'lg': []}}}, s2)
    ok(cam2 == ['AAA'] and 'canales_setup' not in s2['AAA'] and canales_del_setup({}, s2) == []
       and canales_del_setup({'setup_canales': {s2['AAA']['guild_id']: {'ll': []}}}, s2) == [],
       'sacarlas en el /setup las saca; sin la lista del objeto no se toca nada; lo que ya estaba igual no es un cambio')
    nv1 = niveles(s1, {})
    b_pend, q_pend = beneficios(nv1, {'FNC': {'suma': True}}, codigo={'AAA', 'FNC', 'OU'}, pendientes=pendientes_setup(s1))
    ok(not b_pend['FNC']['suma'] and not b_pend['OU']['suma'] and b_pend['AAA']['suma'] and q_pend.get('FNC') == list(PIDEN_CODIGO)
       and b_pend['FNC']['pagina'] and b_pend['FNC']['calendario'],
       'sin aprobar NO suma: ni estando en el código ni con el interruptor prendido; su página y sus eventos, sí')
    gs = guilds_sin('suma', s1, {'beneficios': {'AAA': {'suma': True}}})
    ok(G3 in gs and G4 in gs and G1 not in gs,
       'y su guild va en «no suman» aunque niveles.json todavía no lo tenga (un ciclo cortado a mitad no lo deja sumar)', str(gs))
    camb = aprobar_setup({'setup_suma': {G3: {'si': True, 't': 1}, G1: {'si': True, 't': 1}}}, s1, ahora=ah)
    ok(camb == ['FNC'] and s1['FNC'].get('suma_aprobada') and 'suma_aprobada' not in s1['AAA'] and aprobados_setup(s1) == ['FNC']
       and con_setup(('AAA', 'BBB'), s1) == ('AAA', 'BBB', 'FNC') and 'FNC' in en_el_codigo(s1),
       '«Que sumen»: lo aprueba, y sólo a los del /setup (a AAA, que ya era de la Liga, no le escribe nada); entra al final '
       'de la lista del ranking', str(camb))
    b_ok, _q = beneficios(niveles(s1, {}), {}, codigo=en_el_codigo(s1), pendientes=pendientes_setup(s1))
    gs2 = guilds_sin('suma', s1, {'beneficios': b_ok})
    ok(b_ok['FNC']['suma'] and not b_ok['FNC']['competitivo'] and G3 not in gs2 and G4 in gs2,
       'aprobado: suma a la Temporada (Tier 3: sin el Competitivo); el otro sigue esperando')
    mandados = []
    av1 = avisar_suma(s1, b_ok, None, ahora=ah, mandar=lambda c, t: mandados.append((c, t)) or True)
    av2 = avisar_suma(s1, b_ok, None, ahora=ah, mandar=lambda c, t: mandados.append((c, t)) or True)
    ok(av1 == ['FNC'] and av2 == [] and len(mandados) == 1 and mandados[0][0] == G5 and 'ya suman' in mandados[0][1],
       'el aviso «ya suman», una sola vez, en el canal donde escribe el bot', str(mandados))
    camb2 = aprobar_setup({'setup_suma': {G3: {'si': False, 't': 2}}}, s1, ahora=ah)
    ok(camb2 == ['FNC'] and 'suma_aprobada' not in s1['FNC'] and 'suma_avisada' not in s1['FNC'] and 'FNC' in pendientes_setup(s1)
       and aprobar_setup({}, s1) == [], '«Todavía no» (o un «Deshacer») lo vuelve a apagar; sin decisión, nada cambia')
    s3 = {'XA': {'confirmado': True, 'alta': 'setup', 'guild_id': G3, 'suma_aprobada': '2026-11-20T10:00Z'},
          'AB': {'confirmado': True, 'alta': 'setup', 'guild_id': G4, 'suma_aprobada': '2026-11-21T10:00Z'}}
    ok(aprobados_setup(s3) == ['XA', 'AB'], 'en el orden en que se aprobaron, no por sigla: la vitrina crece sólo al final')
    ok(sigla_libre('XYZ', 'algo', {'AAA'}) == 'XYZ' and sigla_libre('AAA', 'Freestyle Zona Ártica', {'AAA'}) == 'FZA'
       and sigla_libre('', 'Freestyle Zona Ártica', {'FZA'}) == 'FRE' and sigla_libre('x', '', {'AAA'}) == 'SVAA',
       'la sigla: la propuesta si está libre; si no, las iniciales (sin tildes), y si no, otra')
    # y lo de verdad: para todo servidor que NO entró con /setup, los beneficios y los «no suman» son los de antes
    rs, rn = _j('datos', 'servidores.json') or {}, _j('datos', 'niveles.json') or {}
    rsv = rs.get('servidores') or {}
    rnv = niveles(rsv, rn.get('niveles') or {})
    cod = en_el_codigo(rsv)
    con, _ = beneficios(rnv, rn.get('beneficios_elegidos') or {}, codigo=cod, pendientes=pendientes_setup(rsv))
    antes, _ = beneficios(rnv, rn.get('beneficios_elegidos') or {}, codigo=cod, pendientes=set())
    viejos = [sv for sv in rnv if not de_setup(rsv.get(sv))]
    pend_g = {str(rsv[s].get('guild_id')) for s in pendientes_setup(rsv)}
    ok(viejos and all(con[sv] == antes[sv] for sv in viejos)
       and guilds_sin('suma', rsv, rn) - pend_g == {str(rsv[s].get('guild_id')) for s in sb('suma', rn) if rsv.get(s, {}).get('guild_id')},
       'con los datos de verdad: los %d servidores de antes del /setup tienen los mismos beneficios y los mismos «no suman»' % len(viejos))
    hoy = dt.date(2026, 10, 18)
    tb = lambda *ns: [[n, 'x', 1] for n in ns]  # noqa: E731
    ll = {str(i): {'dia': str(hoy - dt.timedelta(days=i * 3)), 'sv': 'AAA', 'tabla': tb(*['p%d' % j for j in range(16)])}
          for i in range(8)}
    ll['x'] = {'dia': str(hoy - dt.timedelta(days=40)), 'sv': 'BBB', 'tabla': tb('q1', 'p1')}
    D = {'llaves': ll, 'ayudas': [('AAA', hoy - dt.timedelta(days=2))], 'anuncios': [('AAA', hoy, True), ('AAA', hoy, False),
         ('CCC', hoy, False), ('CCC', hoy - dt.timedelta(days=5), False)], 'cancelados': [], 'promos': [], 'ligas': {}}
    f = {x['sv']: x for x in medir(D, hoy, svs, {'AAA': 1, 'BBB': 1, 'CCC': 3})}
    a = f['AAA']
    ok(a['m']['eventos'] == 8 and a['m']['por_semana'] == 2.0 and a['m']['por_evento'] == 16.0 and a['partes']['actividad'] == 35,
       'actividad: 8 eventos en 4 semanas es el máximo; 16 raperos por evento también', str(a['m']))
    ok(a['m']['nuevos'] == 15 and a['m']['volvieron'] == 15 and a['rec'] == 'bien',
       'trajo 15 nuevos (p1 ya había jugado en BBB) y volvieron todos; cumple como Tier 1', str((a['m'], a['rec'])))
    ok(f['BBB']['rec'] == 'revisar' and f['BBB']['sin_jugar'] == 40, 'un Tier 1 que hace 40 días no juega: revisar', str(f['BBB']))
    ok('m8' in f['CCC'] and {'eventos', 'por_evento', 'ligas', 'estilos'} <= set(f['CCC']['m8']), 'cada fila trae sus 8 semanas', str(f['CCC']))
    # 🪜 las reglas de 8 semanas (Dlx, 19/11/2026): anunciar ya no alcanza para Tier 2
    ok(recomendar(3, 50, {'anuncios': 6}, 3, {'eventos': 9, 'por_evento': 8.5})[0] == 'subir'
       and recomendar(3, 50, {'anuncios': 6, 'eventos': 2}, 3, {'eventos': 9, 'por_evento': 6})[0] == 'bien'
       and recomendar(3, 50, {'anuncios': 6}, 3)[0] == 'bien',
       'un Tier 3 sube con 8 eventos en 8 semanas y 8 raperos por evento; anunciar ya no alcanza')
    ok(recomendar(2, 70, {}, 3, {'eventos': 12, 'por_evento': 10})[0] == 'subir'
       and recomendar(2, 55, {}, 3, {'eventos': 12, 'por_evento': 10, 'estilos': 2})[0] == 'bien'
       and recomendar(2, 70, {}, 3, {'eventos': 11, 'por_evento': 10, 'estilos': 2})[0] == 'bien',
       'un Tier 2 sube con 12 eventos, 10 por evento y 60 puntos; con uno menos, no')
    # 📋 quedarse (20/11/2026): el que no llega a lo que pide su tier sale «Revisar», salvo en su primer tramo
    hoy2 = dt.date(2026, 11, 20)
    arr = dt.date(2026, 9, 22)
    ok(desde_de({'AAA': '2026-10-12'}, {'AAA': 2, 'NUE': 3}, hoy2) == {'AAA': '2026-10-12', 'NUE': '2026-11-20'},
       'el día en que entró: el de antes se queda, el nuevo es hoy')
    ok(mide_desde(3, '2026-11-19', arr, hoy2) == dt.date(2026, 12, 17) and mide_desde(2, '2026-10-12', arr, hoy2) == dt.date(2026, 12, 7)
       and mide_desde(1, '2026-09-01', arr, hoy2) is None and mide_desde(3, '2026-09-28', arr, hoy2) is None
       and mide_desde(2, None, dt.date(2026, 11, 1), hoy2) == dt.date(2026, 12, 27) and mide_desde(9, '2026-11-19', arr, hoy2) is None,
       'el primer tramo: 4 semanas en Tier 3 y 8 en Tier 1 y 2, desde que entró o desde el arranque, el más nuevo')
    r2 = recomendar(2, 50, {'eventos': 1}, 3, {'eventos': 2, 'por_evento': 8.5})
    r2n = recomendar(2, 50, {'eventos': 1}, 3, {'eventos': 2, 'por_evento': 8.5}, dt.date(2026, 12, 7))
    r3 = recomendar(3, 30, {'eventos': 0, 'ligas': 0}, None, {'eventos': 0, 'por_evento': 0})
    r1 = recomendar(1, 60, {}, 3, {'eventos': 9, 'por_evento': 7.5})
    ok(r2[0] == 'revisar' and '4 eventos en 8 semanas (llevas 2)' in r2[1] and r2n[0] == 'bien' and 'desde el 07/12' in r2n[1]
       and r3[0] == 'revisar' and 'Seguir vivo' in r3[1] and r1[0] == 'revisar' and '7,5' in r1[1]
       and recomendar(3, 30, {'eventos': 0, 'ligas': 1}, None, {'eventos': 0, 'por_evento': 0})[0] == 'bien',
       'no llegar a lo que pide su tier es «Revisar» (como dice su panel); en el primer tramo, no', str((r2, r2n, r3, r1)))
    # 🤝 la Alianza
    b = alianza_bonus({'FFA': ['LKR', 'CEU']}, {'LKR': 3, 'CEU': 3}, {'LKR': 2, 'CEU': 3}, dt.date(2026, 11, 20))
    b2 = alianza_bonus({'FFA': ['LKR']}, {'LKR': 2}, {'LKR': 2}, dt.date(2026, 11, 21), b)
    ok(b == [{'t1': 'FFA', 'aliado': 'LKR', 'de': 3, 'a': 2, 'dia': '2026-11-20', 'pases': 2}] and b2 == b
       and len(alianza_bonus({'FFA': ['LKR']}, {'LKR': 2}, {'LKR': 1}, dt.date(2026, 12, 1), b)) == 2,
       'la Alianza: +2 Pases al Tier 1 cuando su aliado sube (una vez por subida)', str(b))
    # 🔥 los que juegan seguido en cada servidor
    hoy3 = dt.date(2026, 11, 20)
    ll = {str(i): {'dia': str(hoy3 - dt.timedelta(days=d)), 'sv': sv, 'tabla': [[n, 'x', 1] for n in ns]}
          for i, (d, sv, ns) in enumerate(((1, 'AAA', ['Ana', 'Beto']), (5, 'AAA', ['Ana', 'Beto', 'Cami']), (9, 'AAA', ['Ana']),
                                           (70, 'AAA', ['Cami', 'Cami2']), (2, 'BBB', ['Beto', 'Nadie'])))}
    fr = frecuentes(ll, hoy3, lambda n: {'Ana': '1', 'Beto': '2', 'Cami': '3'}.get(n, ''))
    ok(fr == {'AAA': ['1', '2']}, 'los que juegan seguido: 2 eventos o más en 8 semanas, los que más primero; lo de hace 70 '
       'días no cuenta, y sin cuenta de Discord no va', str(fr))
    ok(recomendar(2, 55, {}, 3, {'eventos': 12, 'por_evento': 10, 'estilos': 0, 'estilos_cuenta': '2027-01-15'})[0] == 'bien'
       and len(pide(2, {}, {'eventos': 5, 'estilos': 0, 'estilos_cuenta': '2027-01-15'})[1]) == 4,
       'los eventos de estilo del Tier 2 cuentan desde que se pudieron marcar: hasta sus 8 semanas, «va» y no «no llega»')
    p2 = pide(2, {}, {'eventos': 5, 'estilos': 1})
    ok(len(p2) == 2 and p2[0][2] and not p2[1][2] and 'estilo' in p2[1][0] and pide(2, {}, {'eventos': 5, 'estilos': 2})[1][2],
       'el Tier 2 pide además 1 evento de estilo por mes (2 en 8 semanas)', str(p2))
    p1 = pide(1, {}, {'eventos': 9, 'por_evento': 7.5})
    ok(len(p1) == 2 and p1[0][2] and not p1[1][2] and '7,5' in p1[1][1]
       and pide(3, {'eventos': 0, 'ligas': 1})[0][2] and not pide(3, {'eventos': 0, 'ligas': 0})[0][2]
       and not pide(2, {}, {'eventos': 3})[0][2] and pide(9, {}) == [],
       'lo que pide cada tier para quedarse: Tier 1 eventos y gente, Tier 2 eventos, Tier 3 seguir vivo', str(p1))
    ok(_sv_de_sec('POESÍA CRUDA · URBF · 01/10 · #380') == ('URBF', dt.date(2026, 10, 1)), 'la sigla y el día de una pregunta')
    # 👥 los miembros, sólo recomendados (Dlx, 19/11/2026: «la cantidad no define… Tier 1 1000, Tier 2 500, tier 3 100»)
    g = {x['sv']: x for x in medir(D, hoy, svs, {'AAA': 1}, {'AAA': 250})}
    g2 = {x['sv']: x for x in medir(D, hoy, svs, {'AAA': 1}, {'AAA': 1500})}
    sin = {x['sv']: x for x in medir(D, hoy, svs, {'AAA': 1})}
    ok(g['AAA']['rec'] == 'bien' and 'se recomiendan 1.000' in g['AAA']['porque'] and g2['AAA']['rec'] == 'bien'
       and 'recomiendan' not in g2['AAA']['porque'] and sin['AAA']['rec'] == 'bien' and sin['AAA']['m']['miembros'] is None,
       'un Tier 1 con 250 miembros cumple igual y dice que se recomiendan 1000; con 1500 no dice nada; sin el dato, no se inventa')
    r2 = recomendar(2, 70, {'eventos': 6, 'ayudas': 2, 'anuncios': 6, 'miembros': 120}, 3, {'eventos': 12, 'por_evento': 10})
    ok(r2[0] == 'subir' and 'se recomiendan 1.000' in r2[1], 'un Tier 2 que trabaja como Tier 1 sube con 120 miembros', str(r2))
    ok('se recomiendan 100' in recomendar(3, 50, {'eventos': 1, 'ayudas': 0, 'anuncios': 0, 'miembros': 40}, 3)[1]
       and 'recomiendan' not in recomendar(3, 50, {'eventos': 1, 'ayudas': 0, 'anuncios': 0, 'miembros': 140}, 3)[1],
       'un Tier 3 con 40 miembros: se recomiendan 100; con 140, nada')
    cs = como_subir(2, 70, {'eventos': 6, 'ayudas': 2, 'miembros': 300}, {'eventos': 12, 'por_evento': 10.5})
    ok(len(cs['pide']) == 3 and all(x[2] for x in cs['pide']) and cs['rec'] == ['Se recomiendan 1.000 miembros en tu Discord', 'tienes 300', False]
       and 'mes de prueba' in cs['despues'] and 'despues' not in como_subir(3, 0, {})
       and como_subir(3, 0, {'anuncios': 2})['rec'] is None and como_subir(1, 90, {}) is None,
       'los miembros van en «rec», aparte de lo que se pide, y no frenan «N de M»', str(cs))
    rg = reglas()
    ok(rg['rec'] == {'1': 1000, '2': 500, '3': 100} and rg['da']['1'][0] == 'unirse' and {'redes5', 'prendas', 'pases_t1'} <= set(rg['da']['1'])
       and {'competitivo', 'carta', 'mes_awards', 'estilos', 'redes2', 'consejo'} == set(rg['da']['2']) and 'competitivo' not in rg['da']['3']
       and 'duelos' in rg['da']['3']
       and '8 semanas' in rg['sube']['2'] and str(SUBE[1]['puntos']) in rg['sube']['1'] and 'prueba' in rg['sube']['1']
       and len(json.dumps(rg, ensure_ascii=False, separators=(',', ':'))) < 600,
       'las reglas de la página: los recomendados, lo que suma cada tier y lo que pide subir, de las mismas constantes', str(rg))
    # 📊 el panel: la hora sale del mensaje de la llave, los días y la Liga, y lo que se sugiere con los números
    snow = lambda d, h: '%d' % ((int((dt.datetime(d.year, d.month, d.day, tzinfo=dt.timezone.utc)  # noqa: E731
                                      + dt.timedelta(hours=h + 4)).timestamp() * 1000) - 1420070400000) << 22)
    L = {}
    for i, (dd, sv, n, h) in enumerate([(13, 'AAA', 20, 19), (6, 'AAA', 22, 19), (14, 'AAA', 8, 13), (7, 'AAA', 9, 13),
                                         (10, 'BBB', 15, 21), (11, 'BBB', 15, 21), (3, 'BBB', 9, 21)]):
        d = dt.date(2026, 10, dd)
        L[str(i)] = {'dia': d.isoformat(), 'sv': sv, 'participantes': n, 'tabla': [['p%d_%d' % (i, j), 'Octavos'] for j in range(2)],
                     'links': ['https://discord.com/channels/1/2/' + snow(d, h)]}
    hh = hora_et(L['0']['links'])
    pa = panel({'llaves': L}, hoy, 'AAA', {'Ana': {'AAA': {'ev': 3, 'pts': 900}}, 'Beto': {'AAA': {'ev': 1, 'pts': 100}, 'BBB': {'ev': 2}}},
               {'ana': ('KS', 'Knowledge'), 'beto': ('KS', 'Knowledge')}, ['AAA', 'BBB'])
    ok(hh and hh.hour == 19 and hh.date() == dt.date(2026, 10, 13), 'la hora de la llave, del ID del mensaje, en hora del este')
    ok(pa['dias'][1] == [2, 21.0] and pa['dias'][2] == [2, 8.5] and pa['liga'][5] == [0.5, 12.0] and pa['liga'][1] == [0, 0],
       'los días de AAA (martes 21 de promedio, miércoles 8,5) y los de la Liga (BBB los sábados: medio evento por semana, 12)')
    ok(pa['raperos'][0][:2] == ['Ana', 'ana'] and pa['gente_total'] == 2 and pa['crews'] == [['KS', 'Knowledge', 2, 1000]],
       'su gente y sus crews, de lo que jugaron EN ese servidor')
    su = sugerencias(pa, {'eventos': 4, 'por_semana': 0.5, 'anuncios': 4, 'con_staff': 1})
    ok(any('martes' in x and '21' in x for x in su) and any('miércoles' in x for x in su)
       and any('a la noche' in x.lower() or 'a la tarde' in x.lower() for x in su) and any('2 por semana' in x for x in su)
       and any('quién organiza' in x for x in su), 'las sugerencias, con el número que las respalda')
    ok(sugerencias({'dias': [[1, 30]] + [[0, 0]] * 6}) == [], 'con poca muestra, no se sugiere nada')
    # 🔗 cada sugerencia lleva a una sección que el panel conoce (`IR` de web/src/socio2.jsx)
    ir_jsx = re.search(r'const IR = \{([^}]*)\}', io.open(os.path.join(BASE, 'web', 'src', 'socio2.jsx'), encoding='utf-8').read())
    ok(ir_jsx and all("'%s'" % d in ir_jsx.group(1) for _, d in sugerencias_ir(pa, {'eventos': 4, 'por_semana': 0.5, 'anuncios': 4, 'con_staff': 1})),
       'cada sugerencia lleva a una parte del panel que existe')
    # 🧮 las partes suman el puntaje (02/11/2026: el panel mostraba 35 + 25 + 13 + 3 = 76 al lado de 75)
    ok(all(sum(x['partes'].values()) == x['puntos'] for x in f.values()), 'las cuatro partes suman el puntaje de cada servidor',
       str([(x['sv'], x['puntos'], x['partes']) for x in f.values()]))
    # 📅 el panel arranca en la semana del arranque, y la tendencia no se compara con semanas de antes de la temporada
    arr = _arranque()
    if arr:
        ok(pa['semanas'][0][0] == (arr - dt.timedelta(days=arr.weekday())).isoformat() and pa['ev4'][0] == 0,
           'el panel arranca el lunes de la semana del arranque y no compara con las 4 semanas de antes, que son de la pretemporada',
           str((pa['semanas'][0], pa['ev4'])))
    # 🔁 ¿vuelve la gente? Ana vuelve a otro servidor a los 2 días; Beto, al rato (mismo día: no es volver); Caro debutó hace
    # poco (no cuenta todavía, pero se la puede invitar); Dani, la semana del arranque (no cuenta). `arr` es la de verdad
    if arr:
        h = arr + dt.timedelta(days=60)
        dd = lambda n: (h - dt.timedelta(days=n)).isoformat()  # noqa: E731
        tb2 = lambda *ns: [[n, 'x', 1] for n in ns]  # noqa: E731
        LL = {'1': {'dia': dd(30), 'sv': 'AAA', 'tabla': tb2('Ana🇦🇷', 'Beto')}, '2': {'dia': dd(30), 'sv': 'AAA', 'tabla': tb2('Beto')},
              '3': {'dia': dd(28), 'sv': 'BBB', 'tabla': tb2('ana')}, '4': {'dia': dd(1), 'sv': 'AAA', 'tabla': tb2('Caro')},
              '5': {'dia': arr.isoformat(), 'sv': 'AAA', 'tabla': tb2('Dani')}}
        vv = quien_vuelve(LL, h)
        A = vv['svs']['AAA']
        ok(A['n'] == 2 and A['v'] == 1 and A['otro'] == 1 and A['aca'] == 0, 'volver es otro día: Ana sí (a otro servidor, y su bandera no la parte en dos), Beto no; Caro y Dani no cuentan', str(A))
        ok(A['sin'] == [1, 2] and A['con'] == [0, 0], 'sin otro evento de su servidor en los 3 días siguientes', str(A))
        ok(A['emb'][:3] == [2, 2, 0], 'hasta dónde llegan: los dos jugaron 2 eventos', str(A['emb']))
        V = vuelven_de(vv, 'AAA', h)
        ok([x[1] for x in V['sin_volver']] == ['caro'] and V['sin_n'] == 1 and V['liga']['n'] == 2,
           'para invitar: quien jugó una vez hace poco (Beto jugó dos; Dani, hace más de 30 días)', str(V))
        sg = sugerencias_ir({'vuelven': dict(V, n=10, v=3, liga={'n': 100, 'v': 40, 'con': [45, 100], 'sin': [30, 100], 'emb': []})}, {'por_semana': 1})
        ok(sg[0] == ('De quienes debutan en tu servidor vuelve el 30 % en 14 días; en toda la Liga, el 40 %.', 'sp-vuelven') and '45 %' in sg[1][0] and '30 %' in sg[1][0],
           'lo primero que conviene es esto', str(sg[:2]))
        ok(not any('vuelve' in t for t, _ in sugerencias_ir({'vuelven': dict(V, n=3, v=1)}, {})), 'con pocos debuts no se da un porcentaje')
    # 🪜 cómo subir: las reglas de recomendar()
    s3, s2 = como_subir(3, 10, {'anuncios': 9}, {'eventos': 3, 'por_evento': 9}), como_subir(2, 70, {'eventos': 6, 'ayudas': 2, 'miembros': 120}, {'eventos': 12, 'por_evento': 10})
    ok(como_subir(1, 90, {}) is None and s3['a'] == 2 and [x[2] for x in s3['pide']] == [False, True]
       and all(x[2] for x in como_subir(3, 0, {}, {'eventos': 8, 'por_evento': 8})['pide']),
       'Tier 3 sube con 8 eventos en 8 semanas y 8 por evento (anunciar ya no alcanza); Tier 1 no tiene a dónde')
    ok(s2['a'] == 1 and [x[2] for x in s2['pide']] == [True, True, True] and s2['rec'][2] is False,
       'Tier 2: eventos, gente por evento y puntos, lo pide todo; los miembros, aparte y sólo recomendados', str(s2))
    # 📦 el paquete entra en el tope del Worker, con margen para más socios: dos semanas sin llegar y nadie lo vio
    js = io.open(os.path.join(BASE, 'bot', 'avisos.js'), encoding='utf-8').read()
    t = re.search(r"ruta === '/avisos/tiers-ciclo' \? (\d+) : \d+", js)
    fila = {'sv': 'AAA', 'panel': dict(pa, vuelven=V if arr else None, subir=s2), 'partes': {}, 'm': {}}
    ok(t and int(t.group(1)) > len(json.dumps(fila, ensure_ascii=False)) * 60, 'el tope del Worker aguanta 60 socios con su panel', t and t.group(1))
    sl = sin_lo_nuevo({'servidores': [{'sv': 'X', 'panel': {'vuelven': 1, 'subir': 2, 'dias': 3}}, {'sv': 'Y'}]})
    ok(sl['servidores'][0]['panel'] == {'dias': 3} and sl['servidores'][1] == {'sv': 'Y'}, 'sin lo nuevo, el panel va igual')
    print('\n   %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return mal == 0


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        return 0 if _self_check() else 1
    filas = correr(aplicar='--aplicar' in sys.argv)
    print('\n══ LOS TIERS · LAS ÚLTIMAS %d SEMANAS ══\n' % SEMANAS)
    for x in filas:
        m = x['m']
        print('   T%d %-5s %3d pts (antes %3d) · %4.1f ev/sem · %4.1f por evento · %2d nuevos · %s — %s' % (
            x['tier'], x['sv'], x['puntos'], x['antes'], m['por_semana'], m['por_evento'], m['nuevos'],
            x['rec'], x['porque']))
    if '--aplicar' not in sys.argv:
        print('\n   (simulacro: no escribí ni mandé nada — `--aplicar`)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
