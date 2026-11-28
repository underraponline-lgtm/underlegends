# -*- coding: utf-8 -*-
"""🎯 LA RETENCIÓN: ¿VUELVEN LOS QUE DEBUTAN? A 7, 30 Y 90 DÍAS (28/11/2026).

    python bot/retencion.py          los números de hoy, en palabras (lo mismo que `--ver`)
    python bot/retencion.py --ver    idem
    python bot/retencion.py --json   el bloque del Dashboard, tal cual viaja
    python bot/retencion.py --auto   el self-check, sin red (CI)

Dlx, 27/11/2026: *«la retención es el objetivo principal»*. Los mismos números, en tres lugares:

  · el Dashboard (sólo Dlx): `medir()` entero, por semana de debut y por servidor, con la tendencia y el «juega una
    sola vez». Viaja con la lista de primerizos (`bot/primerizos.py` → `/avisos/primerizos-ciclo`, al objeto): un canal
    privado que ya existía, sin clave nueva de KV.
  · el panel de cada socio («Tu servidor»): `para_socio()`, lo suyo contra el promedio de los socios y UN consejo, que
    es una sugerencia y nunca una orden (objetivo 3 de DRA: herramientas, no órdenes). Viaja en el panel de los tiers
    (`bot/tiers.py`, `panel['retencion']`).
  · la página, para todos: `publico()`, sólo lo que entusiasma y sin nombres. Si el número es malo o son pocos, no va
    (y la página no dibuja nada: «sin dato no hay pieza»). Viaja en el lobby (`ret`), que se escribe sólo si cambió.

LAS DEFINICIONES (las mismas de `rankings.retencion()`, que mide los 14 días del Dashboard desde el 29/09)
  · DEBUTAR es jugar tu primer evento de la temporada. Debutar la SEMANA DEL ARRANQUE no cuenta en los totales: ahí
    «debuta» todo el que ya jugaba antes (en la T1, el 71 % de vuelta de la semana del 21/09 contra 41 % la siguiente).
    Se ve en las semanas, marcada.
  · VOLVER EN N DÍAS es jugar otro evento, OTRO DÍA (hora del este), dentro de los N días de tu debut. Dos llaves la
    misma noche no es volver.
  · «0 DE 0 NO ES 0 %»: quien debutó hace menos de N días todavía no se cuenta para la ventana de N —ni como que volvió
    ni como que no—. Por eso cada número es `[cuántos ya cumplieron los N días, cuántos de ellos volvieron]`.
  · LA PERSONA ES LA DE TODO EL SISTEMA: `rankings.canon()` (el mapa de AKAs, así un renombre sigue a la persona) y sin
    los troll (`rankings._trolls()`). Una persona en dos servidores es UNA: su servidor de debut es el de su primer
    evento, y si después jugó en otro cuenta en `multi`.
  · UN EVENTO POR EQUIPOS (un 3v3, MULTIVERSE) es un evento jugado para cada integrante: cada uno tiene su fila en
    `Resultados`. Que no cuente como duelo no cambia que jugó.

⚠️ SÓLO CONTEOS. Nada de esto lleva nombres: el bloque del Dashboard tampoco (los nombres de los primerizos ya viajan
en su lista, al lado).
"""
import datetime as dt
import io
import json
import math
import os
import sys
from collections import defaultdict

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

#: las tres ventanas, en días
VENTANAS = (7, 30, 90)
#: con menos debutantes que esto (que ya cumplieron la ventana) no se da un porcentaje. El mismo 8 de `tiers.MIN_VUELVEN`
MIN_PCT = 8
#: la página: «debutaron N» sólo con 10 o más; «X de cada 10» sólo con 30 o más cumplidos y si X es 3 o más
MIN_PUB = 10
MIN_PUB_DIEZ = 30
PISO_DIEZ = 3
#: la ventana de «X de cada 10 volvieron»: el primer mes
VENTANA_PUB = 30
#: el consejo del socio: a cuántos puntos del promedio ya es «más» o «menos»
MARGEN = 5
#: la tendencia: las últimas N semanas cerradas contra las N de antes, en la ventana de 7 días
TEND_SEMANAS = 4


def _et():
    try:
        from zoneinfo import ZoneInfo
        return ZoneInfo('America/New_York')
    except Exception:                                    # noqa: BLE001
        return dt.timezone(dt.timedelta(hours=-4))


def _lunes(d):
    return d - dt.timedelta(days=d.weekday())


def _arranque():
    """El lunes (hora del este) de la semana en que arrancó la temporada, de `comun/temporada.py`. O `None`."""
    try:
        from comun.temporada import ACTUAL, FECHAS
        ini = (FECHAS.get(ACTUAL) or ('',))[0]
        return _lunes(dt.date.fromisoformat(ini)) if ini else None
    except Exception:                                    # noqa: BLE001
        return None


# ── las filas ────────────────────────────────────────────────────────────────────────────────────────────────────────

def filas(crudas=None, canon=None, troll=None, instantes=None, ms_de_fecha=None):
    """`[(evento, servidor, instante UTC, persona)]` de `Resultados` de la temporada, una por fila.

    Todo se puede pasar (para el self-check); sin pasarlo: `espejo_t1.fuente('Resultados')`, `rankings.canon`,
    `rankings._trolls()` y cuándo se publicó cada llave (`llaves_web.instantes()`, o el mediodía de su fecha)."""
    if crudas is None:
        import espejo_t1 as E
        crudas = E.fuente('Resultados', 'retencion')
    if canon is None or troll is None:
        import rankings as R
        canon = canon or R.canon
        troll = troll or R._trolls()
    if instantes is None or ms_de_fecha is None:
        import llaves_web as LW
        if instantes is None:
            try:
                instantes = LW.instantes()
            except Exception:                            # noqa: BLE001
                instantes = {}
        ms_de_fecha = ms_de_fecha or LW.ms_de_fecha
    out = []
    for f in crudas:
        f = list(f) + [''] * 6
        quien = str(f[4] or '').strip()
        if not quien:
            continue
        quien = canon(quien)
        if not quien or troll(quien):
            continue
        try:
            num = int(float(str(f[0]).strip() or 0))
        except ValueError:
            continue
        ms = instantes.get(num) or ms_de_fecha(str(f[1]).strip())
        if not ms:
            continue
        out.append((num, str(f[2] or '').strip(), dt.datetime.fromtimestamp(ms / 1000, dt.timezone.utc), quien))
    return out


# ── la cuenta ────────────────────────────────────────────────────────────────────────────────────────────────────────

def _wilson(k, n):
    if not n:
        return (0.0, 0.0)
    z = 1.96
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    m = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (max(0.0, c - m), min(1.0, c + m))


def _pct(par):
    n, k = par
    return round(100 * k / n) if n else None


def medir(fs, ahora=None, arranque='auto'):
    """El bloque entero (para el Dashboard). Pura: `fs` son las de `filas()`.

    `{'v', 'dia', 'ventanas', 'jugadores', 'una', 'una30', 'debutantes', 'tot': {'7': [n, k], …}, 'multi': [n, k],
    'cohortes': [{'s', 'n', 'a'?, '7': [n, k], …}], 'por_sv': {sv: {'n', '7': [n, k], …, 'multi', 'aca', 'otro'}},
    'tend': {'w', 'ahora': [n, k, semanas], 'antes': [n, k, semanas], 'dir'}, 'semana': n}`."""
    et = _et()
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    hoy = ahora.astimezone(et).date()
    arr = _arranque() if arranque == 'auto' else arranque
    por = defaultdict(dict)                              # persona -> {evento: (instante, servidor)}
    for num, sv, t, q in fs:
        v = por[q].get(num)
        if v is None or t < v[0]:
            por[q][num] = (t, sv)

    def par():
        return {str(w): [0, 0] for w in VENTANAS}
    tot, cohortes, por_sv = par(), {}, {}
    una = debut = semana = 0
    una30 = [0, 0]
    multi = [0, 0]
    for q, evs in por.items():
        xs = sorted(evs.values(), key=lambda x: x[0])
        t1, sv1 = xs[0]
        d1 = t1.astimezone(et).date()
        lun = _lunes(d1)
        es_arr = arr is not None and lun == arr
        una += len(xs) == 1
        # 🔁 «juega una sola vez», honesto: sólo entre quienes debutaron hace 30 días o más (los recién llegados tienen
        # un evento porque recién llegaron, no porque no volvieron)
        if (ahora - t1).days >= 30:
            una30[0] += 1
            una30[1] += len(xs) == 1
        c = cohortes.setdefault(lun, dict(par(), n=0))
        c['n'] += 1
        if (ahora - t1).days < 7 and not es_arr:
            semana += 1
        if es_arr:
            continue
        debut += 1
        s = por_sv.setdefault(sv1 or '?', dict(par(), n=0, multi=0, aca=0, otro=0))
        s['n'] += 1
        varios = len({x[1] for x in xs if x[1]}) > 1
        multi[0] += 1
        multi[1] += varios
        s['multi'] += varios
        # la vuelta: otro evento, otro día; y dónde (en el mismo servidor del debut o en otro)
        sig = next((x for x in xs[1:] if x[0].astimezone(et).date() > d1), None)
        if sig:
            s['aca' if sig[1] == sv1 else 'otro'] += 1
        for w in VENTANAS:
            if (ahora - t1).days < w:
                continue                                 # 0 de 0 no es 0 %: todavía no se sabe
            volvio = bool(sig) and sig[0] - t1 <= dt.timedelta(days=w)
            for b in (tot, c, s):
                b[str(w)][0] += 1
                b[str(w)][1] += volvio
    lista = []
    for lun, c in sorted(cohortes.items()):
        f = {'s': lun.isoformat(), 'n': c['n']}
        if arr is not None and lun == arr:
            f['a'] = 1
        for w in VENTANAS:
            f[str(w)] = c[str(w)]
        lista.append(f)
    # 📈 la tendencia a 7 días: las semanas ya cerradas (a todos sus debutantes se les cumplieron los 7), sin el arranque
    cerradas = [f for f in lista if not f.get('a') and f['n'] and hoy > dt.date.fromisoformat(f['s']) + dt.timedelta(days=6 + 7)]
    ult, ant = cerradas[-TEND_SEMANAS:], cerradas[-2 * TEND_SEMANAS:-TEND_SEMANAS]
    sn = lambda xs: [sum(f['7'][0] for f in xs), sum(f['7'][1] for f in xs), len(xs)]  # noqa: E731
    a, b = sn(ult), sn(ant)
    d = 0
    if a[0] >= 30 and b[0] >= 30:
        (la, ha), (lb, hb) = _wilson(a[1], a[0]), _wilson(b[1], b[0])
        d = 1 if la > hb else -1 if ha < lb else 0
    return {'v': 1, 'dia': hoy.isoformat(), 'ventanas': list(VENTANAS), 'jugadores': len(por), 'una': una,
            'una30': una30, 'debutantes': debut, 'tot': tot, 'multi': multi, 'cohortes': lista,
            'por_sv': {k: por_sv[k] for k in sorted(por_sv)}, 'tend': {'w': 7, 'ahora': a, 'antes': b, 'dir': d},
            'semana': semana, 'arranque': arr.isoformat() if arr else ''}


# ── el panel del socio ───────────────────────────────────────────────────────────────────────────────────────────────

def consejo(mio, prom):
    """💡 UNA línea, una sugerencia y no una orden (objetivo 3: herramientas, no órdenes). `mio` y `prom` en %."""
    if mio is None or prom is None:
        return ''
    if mio < prom - MARGEN:
        return 'Tus nuevos vuelven menos que el promedio de los socios: prueba avisarles del próximo evento al terminar el suyo.'
    if mio > prom + MARGEN:
        return ('Tus nuevos vuelven más que el promedio de los socios: lo que haces al recibirlos funciona. '
                'Si quieres sumar más, un evento en los días siguientes ayuda.')
    return 'Estás en el promedio de los socios: lo que más ayuda a que un nuevo vuelva es tener otro evento en los días siguientes.'


def para_socio(M, sv, socios=None):
    """🤝 Lo de un servidor para su panel: lo suyo contra el promedio de los socios, y un consejo. `None` si nadie debutó
    ahí. El promedio es el de los socios (la media de sus porcentajes, cada uno con `MIN_PCT` o más), no el de toda la
    Liga junta: si no, el servidor más grande sería «el promedio»."""
    ps = (M or {}).get('por_sv') or {}
    s = ps.get(sv)
    # sin nadie con siquiera 7 días cumplidos no hay nada que medir: el panel no dibuja la sección («sin dato no hay pieza»)
    if not s or not s.get('n') or not any(s[str(w)][0] for w in VENTANAS):
        return None
    socios = set(socios or ps) | {sv}
    out = {'n': s['n'], 'multi': s.get('multi', 0), 'aca': s.get('aca', 0), 'otro': s.get('otro', 0), 'prom': {}, 'socios': {}}
    for w in VENTANAS:
        k = str(w)
        out[k] = s[k]
        xs = [100 * x[k][1] / x[k][0] for c, x in ps.items() if c in socios and x[k][0] >= MIN_PCT]
        out['prom'][k] = round(sum(xs) / len(xs)) if len(xs) >= 2 else None
        out['socios'][k] = len(xs)
    # el consejo, con la ventana más larga que ya tenga datos de los dos lados (30, si no 7)
    for w in (30, 7):
        k = str(w)
        if out[k][0] >= MIN_PCT and out['prom'][k] is not None:
            out['w'] = w
            out['consejo'] = consejo(_pct(out[k]), out['prom'][k])
            break
    return out


# ── la página ────────────────────────────────────────────────────────────────────────────────────────────────────────

def publico(M):
    """🌟 Lo de la página, para todos: sólo lo que entusiasma, sin nombres. `None` si no hay nada que mostrar.

    `sem`: cuántos debutaron en los últimos 7 días (con `MIN_PUB` o más). `diez`: de cada 10 nuevos, cuántos volvieron
    a jugar en su primer mes (con `MIN_PUB_DIEZ` cumplidos y si da `PISO_DIEZ` o más). `vol`: cuántos nuevos ya
    volvieron en su primer mes (con `MIN_PUB` o más). Un número malo no se maquilla: no va."""
    if not M:
        return None
    out = {}
    if (M.get('semana') or 0) >= MIN_PUB:
        out['sem'] = M['semana']
    n, k = (M.get('tot') or {}).get(str(VENTANA_PUB)) or [0, 0]
    if n >= MIN_PUB_DIEZ:
        diez = int(math.floor(10 * k / n + 0.5))
        if diez >= PISO_DIEZ:
            out['diez'] = diez
    if k >= MIN_PUB and 'diez' in out:
        out['vol'] = k
    return out or None


# ── todo junto ───────────────────────────────────────────────────────────────────────────────────────────────────────

def cargar(ahora=None):
    """`medir()` sobre los resultados de hoy. Sin red."""
    return medir(filas(), ahora=ahora)


def _ver(M):
    def p(par):
        n, k = par
        return '%d de %d (%s)' % (k, n, ('%d %%' % round(100 * k / n)) if n else 'todavía no se sabe')
    print('\n  🎯 La retención, al %s (hora del este)\n' % M['dia'])
    print('   jugadores de la temporada: %d · jugaron UNA sola vez: %d (%s)' % (
        M['jugadores'], M['una'], ('%d %%' % round(100 * M['una'] / M['jugadores'])) if M['jugadores'] else '—'))
    print('   …entre los que debutaron hace 30 días o más: %s jugaron una sola vez' % p(M['una30']))
    print('   debutantes (sin la semana del arranque, %s): %d · en los últimos 7 días: %d' % (M['arranque'] or '—', M['debutantes'], M['semana']))
    for w in VENTANAS:
        print('   volvieron en %2d días: %s' % (w, p(M['tot'][str(w)])))
    print('   jugaron en más de un servidor: %s' % p(M['multi']))
    t = M['tend']
    print('   tendencia a 7 días: últimas %d semanas cerradas %s · las %d de antes %s · %s' % (
        t['ahora'][2], p(t['ahora'][:2]), t['antes'][2], p(t['antes'][:2]),
        {1: 'subió', -1: 'bajó', 0: 'sin cambio claro'}[t['dir']]))
    print('\n   semana      nuevos   7 días        30 días       90 días')
    for c in M['cohortes']:
        print('   %s %6d   %-13s %-13s %-13s%s' % (c['s'], c['n'], *('%d/%d' % (c[str(w)][1], c[str(w)][0]) if c[str(w)][0] else '—' for w in VENTANAS),
                                                 '  (arranque, no cuenta)' if c.get('a') else ''))
    print('\n   servidor  nuevos   7 días        30 días       90 días   + de un sv')
    for sv, s in sorted(M['por_sv'].items(), key=lambda x: -x[1]['n']):
        print('   %-8s %6d   %-13s %-13s %-13s %d' % (sv, s['n'], *('%d/%d' % (s[str(w)][1], s[str(w)][0]) if s[str(w)][0] else '—' for w in VENTANAS), s['multi']))
    print('\n   la página: %s' % (publico(M) or 'nada (pocos o el número no entusiasma)'))
    ej = next((sv for sv, s in sorted(M['por_sv'].items(), key=lambda x: -x[1]['n'])), None)
    if ej:
        print('   el panel de %s: %s' % (ej, para_socio(M, ej)))
    print()


# ── self-check ───────────────────────────────────────────────────────────────────────────────────────────────────────

def _self_check():
    print('\n  retencion.py — self-check\n')
    mal = 0

    def ok(c, que):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '❌', que))

    U = dt.timezone.utc
    t = lambda d, h=23: dt.datetime(2026, 10, 1, h, tzinfo=U) + dt.timedelta(days=d)  # noqa: E731
    ahora = t(60, 12)
    # el arranque, en el self-check: el lunes 28/09 (así el 01/10 es «arranque» y el 05/10 en adelante, no)
    arr = dt.date(2026, 9, 28)
    fs = [
        (1, 'FFA', t(0), 'Vieja'), (2, 'FFA', t(1), 'Vieja'),           # debuta la semana del arranque: no cuenta
        (10, 'FFA', t(5), 'Ana'), (11, 'FFA', t(7), 'Ana'),             # vuelve a los 2 días, mismo servidor
        (10, 'FFA', t(5), 'Beto'), (20, 'DDF', t(25), 'Beto'),          # vuelve a los 20 días, en OTRO servidor
        (10, 'FFA', t(5), 'Caro'), (12, 'FFA', t(5, 23), 'Caro'),       # otro evento la MISMA noche: no es volver
        (10, 'FFA', t(5), 'Dani'), (10, 'FFA', t(5, 23), 'Dani'),       # el mismo evento dos veces = uno
        (30, 'DDF', t(57), 'Eli'),                                      # debutó hace 3 días: 0 de 0 en las tres
        (40, 'DDF', t(20), 'Fede'), (40, 'DDF', t(20), 'Gus'), (40, 'DDF', t(20), 'Hugo'),  # un 3v3: los tres jugaron
        (41, 'DDF', t(22), 'Fede'),
    ]
    M = medir(fs, ahora=ahora, arranque=arr)
    ok(M['jugadores'] == 9 and M['una'] == 4, 'jugadores y «una sola vez» (Caro jugó dos eventos la misma noche: no es una)')
    ok(M['debutantes'] == 8, 'la semana del arranque no cuenta en los debutantes (Vieja)')
    ok(M['tot']['7'] == [7, 2], 'a 7 días: de 7 con sus 7 días cumplidos volvieron Ana y Fede (Eli todavía no cuenta)')
    ok(M['tot']['30'] == [7, 3], 'a 30 días: se suma Beto, que volvió a los 20 en otro servidor')
    ok(M['tot']['90'] == [0, 0], 'a 90 días: nadie cumplió todavía, y eso es 0 de 0, no 0 %')
    ok(M['multi'] == [8, 1], 'en más de un servidor: Beto')
    ok(M['por_sv']['FFA']['n'] == 4 and M['por_sv']['FFA']['aca'] == 1 and M['por_sv']['FFA']['otro'] == 1,
       'por servidor de debut: FFA trajo 4; uno volvió ahí y otro en DDF')
    ok(M['por_sv']['DDF']['7'] == [3, 1] and M['por_sv']['DDF']['n'] == 4, 'DDF: Eli cuenta como debut pero no para la ventana')
    ok([c['s'] for c in M['cohortes']][:1] == ['2026-09-28'] and M['cohortes'][0].get('a') == 1, 'la semana del arranque está, marcada')
    ok(para_socio(medir([(30, 'XYZ', t(57), 'Eli')], ahora=ahora, arranque=arr), 'XYZ') is None,
       'un servidor cuyos nuevos todavía no cumplieron ni 7 días: el panel no dibuja nada')
    ok(M['semana'] == 1, 'en los últimos 7 días debutó una persona (Eli)')
    ok(M['una30'] == [8, 3], '«una sola vez» honesto: sólo entre quienes debutaron hace 30 días o más')
    # un renombre: los dos nombres son la misma persona por el mapa de AKAs (`canon`)
    al = {'Makma': 'Makmah'}
    ms = lambda f: int(dt.datetime(2026, 10, int(f.split('/')[0]), 16, tzinfo=U).timestamp() * 1000)  # noqa: E731
    fr = filas([[50, '06/10', 'FFA', '16+', 'Makmah'], [51, '09/10', 'FFA', '16+', 'Makma'], [52, '09/10', 'FFA', '16+', 'Troll']],
               canon=lambda n: al.get(n, n), troll=lambda n: n == 'Troll', instantes={}, ms_de_fecha=ms)
    M2 = medir(fr, ahora=t(60, 12), arranque=arr)
    ok(M2['jugadores'] == 1 and M2['tot']['7'] == [1, 1], 'un renombre sigue a la persona (canon) y los troll no entran')
    # la temporada recién arrancada: nada, sin romperse
    M0 = medir([], ahora=ahora, arranque=arr)
    ok(M0['jugadores'] == 0 and M0['tot']['7'] == [0, 0] and publico(M0) is None and para_socio(M0, 'FFA') is None,
       'sin nadie todavía: ceros, nada para la página y nada para el panel')
    # la página: sólo con muchos, y sólo si entusiasma
    ok(publico({'semana': 9, 'tot': {'30': [29, 20]}}) is None, 'la página: con 9 debutantes y 29 cumplidos no dice nada')
    ok(publico({'semana': 12, 'tot': {'30': [40, 8]}}) == {'sem': 12}, 'la página: 2 de cada 10 no se muestra (no entusiasma)')
    ok(publico({'semana': 3, 'tot': {'30': [40, 16]}}) == {'diez': 4, 'vol': 16}, 'la página: 4 de cada 10 y cuántos volvieron')
    # el socio: contra el promedio de los socios, un consejo que sugiere
    ps = {'AAA': dict({'7': [20, 2], '30': [20, 4], '90': [0, 0]}, n=20), 'BBB': dict({'7': [20, 8], '30': [20, 10], '90': [0, 0]}, n=20),
          'CCC': dict({'7': [10, 4], '30': [10, 5], '90': [0, 0]}, n=10), 'DDD': dict({'7': [3, 3], '30': [3, 3], '90': [0, 0]}, n=3)}
    S = para_socio({'por_sv': ps}, 'AAA')
    ok(S['prom']['30'] == round((20 + 50 + 50) / 3) and S['socios']['30'] == 3, 'el promedio es de los socios con 8 o más (DDD no entra)')
    ok(S['prom']['90'] is None, 'sin socios con 90 días cumplidos, no hay promedio')
    ok(S['w'] == 30 and 'menos que el promedio' in S['consejo'] and 'prueba' in S['consejo'], 'debajo del promedio: «prueba…», una sugerencia')
    ok('más que el promedio' in para_socio({'por_sv': ps}, 'BBB')['consejo'], 'arriba del promedio: lo dice')
    ok('consejo' not in para_socio({'por_sv': ps}, 'DDD'), 'con 3 debutantes no hay porcentaje ni consejo')
    ok(all(not c.lower().startswith(('debes', 'tienes que', 'haz ')) for c in (consejo(10, 40), consejo(60, 40), consejo(40, 40))),
       'ningún consejo es una orden')
    print('\n   %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return mal == 0


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        return 0 if _self_check() else 1
    M = cargar()
    if '--json' in sys.argv:
        print(json.dumps(M, ensure_ascii=False, indent=1))
        return 0
    _ver(M)
    return 0


if __name__ == '__main__':
    sys.exit(main())
