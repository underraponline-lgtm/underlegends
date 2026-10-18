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
  · TIER 3: el directorio. Sin el bot.

DE DÓNDE SALE EL NIVEL: lo elige Dlx en el Dashboard (ajuste `tiers`, `{sigla: 1|2|3}`); sin elegir, Tier 1 quien está
en la Liga. El ciclo lo copia a `datos/niveles.json` (público: es lo que dice la página) y de ahí lo leen el lector de
llaves (`escuchar._guilds_liga()`) y las ligas (`ligas.duelos()`), con `bajados()`.

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
    """`{sigla: tier}` de los servidores de la Liga: lo elegido (`datos/niveles.json`), y Tier 1 por defecto."""
    svs = servidores if servidores is not None else ((_j('datos', 'servidores.json') or {}).get('servidores') or {})
    g = guardados if guardados is not None else ((_j('datos', 'niveles.json') or {}).get('niveles') or {})
    out = {}
    for sv, x in svs.items():
        if x.get('en_la_liga') is False or not x.get('confirmado'):
            continue
        t = g.get(sv)
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

    out = []
    for sv, t in nivel.items():
        m, partes, pts = parte(sv, ini, fin)
        _m0, _p0, pts0 = parte(sv, ini0, ini)
        ult = max((d for d, s, _ns in evs if s == sv), default=None)
        sin = (hoy - ult).days if ult else None
        m['miembros'] = (miembros or {}).get(sv)
        rec, porque = ('casa', 'la casa de la Liga: no se evalúa como socio') if sv in CASA else recomendar(t, pts, m, sin)
        out.append({'sv': sv, 'nombre': (svs.get(sv) or {}).get('nombre') or sv, 'tier': t, 'puntos': pts,
                    'antes': pts0, 'partes': partes, 'm': m, 'ultimo': str(ult) if ult else '', 'sin_jugar': sin,
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
    filas = medir(datos(), hoy, svs, nivel, gente)
    if aplicar:
        nuevo = {'_leeme': 'El nivel de cada servidor de la Liga (Tier 1: suma al ranking; 2: sólo el calendario; 3: el '
                           'directorio). Lo elige Dlx en el Dashboard; sin elegir, Tier 1. Lo escribe bot/tiers.py y lo '
                           'leen el lector de llaves y las ligas. El puntaje de cada uno NO va acá: va al Dashboard.',
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
