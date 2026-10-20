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
  · TIER 1: sus eventos suman al ranking oficial y lleva todo (el bot completo, su carta, los multiplicadores…).
  · TIER 2: sus anuncios se leen (el calendario y la campana), pero sus llaves NO: no suma al ranking. Tampoco sus
    ligas cuentan como duelos.
  · TIER 3: su página de servidor y sus ligas en Ligas (sin contar como duelos); sin carta de Servidor ni puntos.
    ⚠️ DECÍA «el directorio, sin el bot» hasta el 20/10/2026, y FDS entró a Tier 3 CON el bot (Dlx: «para cualquier
    TIER meter el bot, así nos beneficiamos de información y de IDs… pero que no necesariamente convierta a tener esos
    beneficios»). El bot adentro es lo que hace posible leerle las ligas y reconocer a su gente.

🔑 Y LO QUE ES DE TODOS, EN CUALQUIER TIER (Dlx, 20/10/2026: «I want their events to be promoted and social media. I
think that should be a general benefit… because we provide information to the Liga Global»): sus eventos en el
calendario, la campana y Publicaciones, y sus redes en Socios. Por eso `bot/anuncios.py` lee a TODOS los confirmados sin
mirar el tier; lo que el tier apaga son las llaves (`escuchar._guilds_liga()`) y los duelos de las ligas.

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
#: 👥 los miembros de su Discord para ser socio (Tier 1). Dlx, 18/10/2026: «al menos 500 para ser socios (no necesario
#: pero recomendado), mínimo 300»
MIN_MIEMBROS = 300
RECOMENDADO = 500


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


def bajados(servidores=None, guardados=None):
    """Las siglas en Tier 2 o 3: sus llaves no se leen y sus ligas no cuentan como duelos."""
    return {sv for sv, t in niveles(servidores, guardados).items() if t != 1}


def guilds_bajados(servidores=None, guardados=None):
    """Los guild ID de los servidores en Tier 2 o 3 (para el lector de llaves)."""
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


def medir(D, hoy, svs, nivel, miembros=None):
    """`[{sv, nombre, tier, puntos, partes, m, antes, rec, porque}]` de cada servidor de la Liga. `D` trae: `llaves`
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
        partes = {'actividad': round(act), 'alcance': round(alc), 'calidad': round(cal), 'comunidad': round(com)}
        return m, partes, round(act + alc + cal + com)

    # 📈 ¿las 4 semanas de antes son de esta temporada? Si no, comparar contra ellas es comparar contra cero: todos
    # «suben» (el panel de los socios decía «▲ 81» a FFA el 19/10). `compara_desde`: el día en que ya se puede
    try:
        from comun.temporada import FECHAS, ACTUAL
        arranque = dt.date.fromisoformat(FECHAS[ACTUAL][0])
    except Exception:                                    # noqa: BLE001
        arranque = None
    compara = arranque is None or ini0 >= arranque
    compara_desde = (arranque + dt.timedelta(days=7 * SEMANAS * 2 - 1)).isoformat() if arranque else ''
    out = []
    for sv, t in nivel.items():
        m, partes, pts = parte(sv, ini, fin)
        _m0, _p0, pts0 = parte(sv, ini0, ini)
        ult = max((d for d, s, _ns in evs if s == sv), default=None)
        sin = (hoy - ult).days if ult else None
        m['miembros'] = (miembros or {}).get(sv)
        rec, porque = ('casa', 'la casa de la Liga: no se evalúa como socio') if sv in CASA else recomendar(t, pts, m, sin)
        out.append({'sv': sv, 'nombre': (svs.get(sv) or {}).get('nombre') or sv, 'tier': t, 'puntos': pts,
                    'antes': pts0, 'compara': compara, 'compara_desde': compara_desde, 'partes': partes, 'm': m, 'ultimo': str(ult) if ult else '', 'sin_jugar': sin,
                    'rec': rec, 'porque': porque})
    out.sort(key=lambda x: (x['tier'], -x['puntos'], x['sv']))
    return out


def recomendar(tier, pts, m, sin_jugar):
    """`(recomendación, por qué)`. Recomienda: decide Dlx."""
    gente = m.get('miembros')
    if tier == 1:
        if sin_jugar is None or sin_jugar > 21:
            return 'revisar', 'hace %s que no juega un evento' % ('más de 4 semanas' if sin_jugar is None else '%d días' % sin_jugar)
        if gente is not None and gente < MIN_MIEMBROS:
            return 'revisar', 'tiene %d miembros: para ser socio se piden %d como mínimo' % (gente, MIN_MIEMBROS)
        if pts < 35:
            return 'revisar', 'puntaje bajo (%d): poca actividad o mucha ayuda para leer sus llaves' % pts
        if gente is not None and gente < RECOMENDADO:
            return 'bien', 'cumple como Tier 1 (con %d miembros: se recomiendan %d)' % (gente, RECOMENDADO)
        return 'bien', 'cumple como Tier 1'
    if tier == 2:
        if pts >= 60 and m['eventos'] >= 4 and (m['ayudas'] / m['eventos'] if m['eventos'] else 9) <= 1:
            if gente is not None and gente < MIN_MIEMBROS:
                return 'bien', 'trabaja como Tier 1, pero tiene %d miembros: el mínimo es %d' % (gente, MIN_MIEMBROS)
            return 'subir', 'listo para Tier 1: %d eventos en 4 semanas y el bot los lee casi solo' % m['eventos']
        return 'bien', 'se mantiene en Tier 2'
    if m['anuncios'] >= 2:
        return 'subir', 'ya anuncia eventos (%d): puede pasar a Tier 2' % m['anuncios']
    return 'bien', 'se mantiene en Tier 3'


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


def panel(D, hoy, sv, ps=None, crews=None, otros=None):
    """📊 Lo de un servidor para su dueño. `D` es lo de `datos()`; `ps`, la gente de `por_servidor.json`; `crews`,
    `{clave de persona: (id, nombre de la crew)}`; `otros`, las siglas de los demás socios (para cuántos eventos tiene
    la Liga cada día). Devuelve `{semanas, dias, franjas, liga, raperos, crews, sugerencias}`. Pura."""
    from comun.claves import clave as K
    fin = hoy + dt.timedelta(days=1)
    lunes = hoy - dt.timedelta(days=hoy.weekday())
    ini = lunes - dt.timedelta(days=7 * (SEMANAS_PANEL - 1))
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
    for k in range(SEMANAS_PANEL):
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
    out = {'semanas': semanas, 'dias': dias, 'franjas': franjas, 'liga': liga, 'raperos': raperos[:10],
           'gente_total': len(raperos), 'crews': crews_top, 'ev4': ev4}
    out['sugerencias'] = sugerencias(out)
    return out


def sugerencias(p, m=None):
    """💡 Lo que conviene, en palabras y con el número que lo respalda: qué días junta más gente, cuál menos, qué días
    la Liga está más o menos llena, a qué hora y cómo viene. Sólo lo que los números dicen: con poca muestra, nada."""
    out = []
    dias = p.get('dias') or []
    buenos = [(i, d) for i, d in enumerate(dias) if d[0] >= MIN_MUESTRA]
    if len(buenos) >= 2:
        mejor = max(buenos, key=lambda x: x[1][1])
        peor = min(buenos, key=lambda x: x[1][1])
        out.append('Los %s tus eventos juntan %s raperos de promedio: el mejor día que tienes.' % (DIAS[mejor[0]], _n(mejor[1][1])))
        if peor[0] != mejor[0] and peor[1][1] < mejor[1][1] * 0.8:
            out.append('Los %s, %s de promedio: el más flojo. Si puedes, movelo a otro día.' % (DIAS[peor[0]], _n(peor[1][1])))
    liga = p.get('liga') or []
    if any(x[0] for x in liga):
        lleno = max(range(7), key=lambda i: liga[i][0])
        libres = [i for i in range(7) if liga[i][0] <= 0.5]
        if liga[lleno][0] >= 2:
            out.append('Los %s la Liga tiene %s eventos por semana: un evento tuyo ese día compite por la misma gente.'
                       % (DIAS[lleno], _n(liga[lleno][0])))
        if libres:
            out.append('Casi nadie juega los %s (%s): menos competencia para llenar tu llave.'
                       % (_lista([DIAS[i] for i in libres]), 'ningún evento' if all(liga[i][0] == 0 for i in libres) else 'medio evento por semana o menos'))
    fr = [(i, f) for i, f in enumerate(p.get('franjas') or []) if f[0] >= MIN_MUESTRA]
    if len(fr) >= 2:
        i, f = max(fr, key=lambda x: x[1][1])
        out.append('%s es cuando más gente juntas (%s por evento).' % (FRANJAS[i][2].capitalize(), _n(f[1])))
    ev4 = p.get('ev4') or []
    if len(ev4) == 3:
        a, b, nuevos = ev4
        if b == 0 and a:
            out.append('En las últimas 4 semanas no hubo eventos: un evento por semana ya te devuelve a la tabla.')
        elif a and b >= a * 1.25:
            out.append('Vas en subida: %d eventos en las últimas 4 semanas contra %d en las 4 de antes.' % (b, a))
        elif a and b <= a * 0.75:
            out.append('Bajaste: %d eventos en las últimas 4 semanas contra %d en las 4 de antes.' % (b, a))
        if nuevos:
            out.append('Trajiste %d raperos nuevos en 4 semanas: avisales del próximo evento para que vuelvan.' % nuevos)
    m = m or {}
    if m.get('eventos') and m.get('por_semana', 0) < 1:
        out.append('Haces %s eventos por semana; con 2 por semana la parte de actividad de tu puntaje llega al máximo.' % _n(m['por_semana']))
    if m.get('anuncios') and m.get('con_staff', 0) < m['anuncios'] * 0.5:
        out.append('Sólo %d de tus %d anuncios dicen quién organiza: ponerlo suma a la calidad.' % (m.get('con_staff', 0), m['anuncios']))
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
    return {'llaves': _j('datos', 'llaves_t1.json') or {}, 'ayudas': ayudas, 'anuncios': list(an.values()),
            'cancelados': canc, 'promos': pro, 'ligas': (_j('datos', 'ligas.json') or {}).get('ligas') or {}}


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
    r = requests.post(WORKER + '/avisos/tiers-ciclo', headers={'x-lg-ciclo': CC.clave(tok), 'content-type': 'application/json'},
                      data=json.dumps(x, ensure_ascii=False).encode('utf-8'), timeout=25)
    if r.status_code != 200:
        print('   ⚠️ el puntaje no llegó al Dashboard (%s)' % r.status_code)
    return r.status_code == 200


def correr(aplicar=False, ahora=None):
    import zoneinfo
    hoy = (ahora or dt.datetime.now(dt.timezone.utc)).astimezone(zoneinfo.ZoneInfo('America/New_York')).date()
    svs = (_j('datos', 'servidores.json') or {}).get('servidores') or {}
    viejo = _j('datos', 'niveles.json') or {}
    elegidos = dict(viejo.get('niveles') or {})
    # lo elegido en el Dashboard manda; sin poder leerlo, queda lo de antes (un Worker que no contesta no es «Dlx cambió»)
    if aplicar:
        try:
            import multiplicadores as MU
            aj = MU.ajustes_dueno()
        except Exception as e:                           # noqa: BLE001
            print('   ⚠️ los tiers: no leí los ajustes (%s)' % str(e)[:60])
            aj = None
        if aj is not None:
            elegidos = {k: v for k, v in ((aj.get('tiers') or {}).items()) if v in TIERS}
    nivel = niveles(svs, elegidos)
    # 👥 los miembros de cada Discord, de su invitación (lo mismo que muestra Socios: `subir_web._miembros()`)
    gente = {}
    if aplicar:
        try:
            import subir_web
            gente = {sv: x['miembros'] for sv, x in (subir_web._miembros(svs) or {}).items() if x.get('miembros')}
        except Exception as e:                           # noqa: BLE001
            print('   ⚠️ los tiers: no leí los miembros (%s)' % str(e)[:60])
    D = datos()
    filas = medir(D, hoy, svs, nivel, gente)
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
                f['panel']['sugerencias'] = sugerencias(f['panel'], f.get('m'))
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
                 'niveles': {sv: t for sv, t in sorted(nivel.items())}}
        if nuevo['niveles'] != viejo.get('niveles'):
            with io.open(NIVELES, 'w', encoding='utf-8', newline='\n') as f:
                json.dump(nuevo, f, ensure_ascii=False, indent=1)
            print('   🤝 los niveles cambiaron: %s' % ', '.join('%s %d' % kv for kv in sorted(nivel.items())))
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
    ok(niveles(svs, {'BBB': 2, 'CCC': 9}) == {'AAA': 1, 'BBB': 2, 'CCC': 1} and bajados(svs, {'BBB': 2}) == {'BBB'}
       and guilds_bajados(svs, {'BBB': 2, 'CCC': 3}) == {'2', '3'},
       'lo elegido manda; un número que no es tier no vale; los de Tier 2 y 3 son los «bajados»')
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
    ok(f['CCC']['rec'] == 'subir', 'un Tier 3 que ya anuncia eventos: puede pasar a Tier 2', str(f['CCC']))
    ok(recomendar(2, 70, {'eventos': 6, 'ayudas': 2, 'anuncios': 6}, 3)[0] == 'subir'
       and recomendar(2, 70, {'eventos': 6, 'ayudas': 12, 'anuncios': 6}, 3)[0] == 'bien',
       'un Tier 2 sube con puntaje, eventos y llaves que el bot lee casi solo; con mucha ayuda, no')
    ok(_sv_de_sec('POESÍA CRUDA · URBF · 01/10 · #380') == ('URBF', dt.date(2026, 10, 1)), 'la sigla y el día de una pregunta')
    # 👥 los miembros (Dlx: «al menos 500… mínimo 300»)
    g = {x['sv']: x for x in medir(D, hoy, svs, {'AAA': 1}, {'AAA': 250})}
    g2 = {x['sv']: x for x in medir(D, hoy, svs, {'AAA': 1}, {'AAA': 420})}
    sin = {x['sv']: x for x in medir(D, hoy, svs, {'AAA': 1})}
    ok(g['AAA']['rec'] == 'revisar' and '300' in g['AAA']['porque'] and g2['AAA']['rec'] == 'bien' and '500' in g2['AAA']['porque']
       and sin['AAA']['rec'] == 'bien' and sin['AAA']['m']['miembros'] is None,
       'un Tier 1 con 250 miembros: revisar (mínimo 300); con 420 cumple y dice que se recomiendan 500; sin el dato, no se inventa')
    ok(recomendar(2, 70, {'eventos': 6, 'ayudas': 2, 'anuncios': 6, 'miembros': 120}, 3)[0] == 'bien',
       'un Tier 2 que trabaja como Tier 1 no sube con menos de 300 miembros')
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
