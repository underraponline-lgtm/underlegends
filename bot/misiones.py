# -*- coding: utf-8 -*-
"""LAS MISIONES DE LA SEMANA: tres por semana, para todos, que suman a la Temporada.

    python bot/misiones.py           cómo va la semana, con lo que leyó el último ciclo
    python bot/misiones.py --auto    el self-check, sin red ni archivos

Dlx, 27/09/2026: *«lo de pase viene con TAREAS no misiones… lo de misiones es para el ranking de temporada»*. Y el
04/10, a la propuesta (*«3. A»*): **tres misiones por semana, que se renuevan el lunes a las 11 AM ET con los
multiplicadores; cada una suma puntos de Temporada y completar las tres da un bono**. El 05/10: *«empezá ya»*.

LAS REGLAS (los números, acá arriba: van con el rebalanceo del final)
--------------------------------------------------------------------
- **Las mismas tres para todos**, una fácil, una media y una difícil (`CATALOGO`), sorteadas con la semana como
  semilla: se puede recalcular cuando sea y da lo mismo. Ninguna repite la de la semana anterior de su nivel.
- **Se cumplen jugando**, con lo que dicen las llaves: eventos, duelos, hasta dónde llegaste, en qué servidor. Nada que
  se reclame con un botón.
- **Cada una suma sus `PUNTOS` a la Temporada** y las tres, además, `BONO`. Al Competitivo, nunca (como el Most
  Wanted y el precio por cabeza: `rankings.sumar_misiones()`).
- **No repiten lo que la semana ya paga sola**: el Pasaporte (servidores distintos) y la Asistencia (días distintos) de
  `bot/multiplicadores.py`.

⚠️ SE RECALCULA ENTERO EN CADA CORRIDA, semana por semana desde `DESDE`, con las filas de `Resultados` y `1v1`: una
llave que se procesa tarde o se corrige cambia quién cumplió. Lo corre el paso 1c (`sheet/rankings.py`) y lo deja en
`datos/misiones.json` para la Temporada (una corrida atrás, como el precio por cabeza) y para la página.

⚠️ ARRANCAN EN CERO CON CADA TEMPORADA: las semanas de antes del arranque no cuentan.
"""
import datetime as dt
import io
import json
import os
import random
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

#: la primera semana con misiones: la que arranca el lunes 05/10/2026 a las 11 AM ET
DESDE = '2026-10-05'
#: `id: (texto, qué mide, meta)` por nivel. Lo que mide: `eventos`, `duelos` (ganados), `llego` (hasta qué ronda:
#: 4 = semifinal, 2 = final, 1 = campeón), `multi` (un evento del servidor con el multiplicador más alto) y `nuevo`
#: (un servidor donde no jugaste antes en la temporada)
CATALOGO = {
    'facil': {
        'eventos2': ('Jugá 2 eventos', 'eventos', 2),
        'duelo1': ('Ganá un duelo', 'duelos', 1),
        'multi': ('Jugá un evento del servidor con el multiplicador más alto', 'multi', 1),
    },
    'media': {
        'duelos3': ('Ganá 3 duelos', 'duelos', 3),
        'semis': ('Llegá a una semifinal', 'llego', 4),
        'nuevo': ('Jugá en un servidor donde todavía no jugaste esta temporada', 'nuevo', 1),
    },
    'dificil': {
        'final': ('Llegá a una final', 'llego', 2),
        'duelos5': ('Ganá 5 duelos', 'duelos', 5),
        'campeon': ('Ganá un evento', 'llego', 1),
    },
}
NIVELES = ('facil', 'media', 'dificil')
#: puntos de Temporada por misión cumplida, y el bono por las tres
PUNTOS = {'facil': 300, 'media': 600, 'dificil': 1000}
BONO = 1000
#: hasta qué ronda llegó cada puesto de `Resultados` (como `rankings.LLEGO`)
LLEGO = {'campeon': 1, 'subcampeon': 2, 'tercero': 4, 'cuarto': 4, 'semifinal': 4, 'cuartos': 8,
         'octavos': 16, 'r32': 32, 'dieciseisavos': 32, 'r64': 64}

SALIDA = os.path.join(BASE, 'datos', 'misiones.json')


def _norm(s):
    import unicodedata
    s = unicodedata.normalize('NFD', str(s or '').lower())
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn').strip()


def elegir(sem, anterior=None):
    """Las tres de la semana `sem` (su id, `2026-10-05`): `[[id, texto, nivel, meta, puntos], …]`, una por nivel.

    ⚠️ CON LA SEMANA COMO SEMILLA: la misma semana da siempre las mismas, en cualquier corrida y en cualquier máquina.
    `anterior` son los ids de la semana de antes: ninguna se repite seguida."""
    rnd = random.Random('misiones:' + str(sem))
    out = []
    for niv in NIVELES:
        ops = sorted(CATALOGO[niv])
        libres = [x for x in ops if x not in (anterior or ())] or ops
        i = libres[rnd.randrange(len(libres))]
        texto, _que, meta = CATALOGO[niv][i]
        out.append([i, texto, niv, meta, PUNTOS[niv]])
    return out


def _que(i):
    for niv in NIVELES:
        if i in CATALOGO[niv]:
            return CATALOGO[niv][i][1]
    return ''


def valor(i, ev, du, svs_antes, top):
    """Cuánto lleva alguien de la misión `i` en una semana: `ev` son sus filas de esa semana `(num, sv, t, puesto)`,
    `du` cuántos duelos ganó, `svs_antes` dónde jugó antes en la temporada y `top` los servidores del multiplicador
    más alto. Para lo que se cumple o no, 0 o 1; `llego` devuelve la mejor ronda (menor es mejor)."""
    q = _que(i)
    if q == 'eventos':
        return len({e[0] for e in ev})
    if q == 'duelos':
        return du
    if q == 'multi':
        # `top` es el conjunto de la semana o, desde el 05/10/2026, una función del instante (ver `calcular()`)
        en = top if callable(top) else (lambda _t: top)
        return int(any(e[1] in en(e[2]) for e in ev))
    if q == 'nuevo':
        return int(any(e[1] and e[1] not in svs_antes for e in ev))
    if q == 'llego':
        return min([LLEGO.get(e[3], 99) for e in ev] or [99])
    return 0


def cumplida(i, v, meta):
    return v <= meta if _que(i) == 'llego' else v >= meta


def filas_de(res, uno, instantes=None, canon=None, es_troll=None):
    """Las filas de `Resultados` y `1v1` como las piden las misiones: `(eventos, duelos)`, con
    `eventos = [(num, sv, instante, quién, puesto)]` y `duelos = [(num, instante, ganador)]`. Los nombres, canónicos
    (el mapa de AKAs) y sin los troll, como en las vitrinas."""
    import llaves_web as LW
    if instantes is None:
        try:
            instantes = LW.instantes()
        except Exception:                                # noqa: BLE001
            instantes = {}
    canon = canon or (lambda x: x)
    es_troll = es_troll or (lambda x: False)

    def cuando(num, fecha):
        ms = instantes.get(num) or LW.ms_de_fecha(str(fecha).strip())
        return dt.datetime.fromtimestamp(ms / 1000, dt.timezone.utc) if ms else None

    def _n(x):
        try:
            return int(float(str(x).strip() or 0))
        except ValueError:
            return 0
    evs = []
    for f in res or []:
        f = list(f) + [''] * 11
        quien = str(f[4]).strip()
        if not quien:
            continue
        quien = canon(quien)
        if es_troll(quien):
            continue
        num = _n(f[0])
        evs.append((num, str(f[2]).strip(), cuando(num, f[1]), quien, _norm(f[6])))
    dus = []
    for f in uno or []:
        f = list(f) + [''] * 9
        gan = str(f[6]).strip()
        if not gan or not str(f[4]).strip() or not str(f[5]).strip():
            continue
        gan = canon(gan)
        if es_troll(gan):
            continue
        num = _n(f[0])
        dus.append((num, cuando(num, f[1]), gan))
    return evs, dus


def calcular(evs, dus, ahora, desde=None, mult=None):
    """Semana por semana desde `DESDE` (y desde `desde`, el arranque de la temporada): las misiones, quién cumplió
    qué y cuánto suma cada uno. `mult` es `multiplicadores.leer()` (para «el servidor con el multiplicador más alto»).
    """
    import multiplicadores as MU
    sem_hoy, ini_hoy, fin_hoy = MU.periodo(ahora)
    semanas = {}
    for e in evs:
        if e[2] is None or (desde and e[2] < desde):
            continue
        sid, ini, fin = MU.periodo(e[2])
        if sid >= DESDE:
            semanas.setdefault(sid, (ini, fin))
    if sem_hoy >= DESDE:
        semanas.setdefault(sem_hoy, (ini_hoy, fin_hoy))
    # 🔴 EL SERVIDOR DEL MULTIPLICADOR MÁS ALTO EN EL MOMENTO DE CADA EVENTO (revisión del 05/10/2026), no el de la
    # semana entera: con un cambio a mano desde el Dashboard a mitad de semana (`tramos`), los eventos de antes se
    # volvían a medir contra el nuevo y alguien ganaba o perdía la misión —y sus puntos— para atrás. Es lo mismo que
    # hace `multiplicadores.factor_de()` con los puntos: el sorteo, y cada tramo desde su `desde`
    def _top(sv):
        if not sv:
            return set()
        m = max(sv.values())
        return {k for k, v in sv.items() if v == m}
    tops = {}
    for s in (mult or {}).get('semanas') or []:
        base = s.get('sv_sorteo') or s.get('sv') or {}
        tramos = []
        for t in s.get('tramos') or []:
            try:
                tramos.append((MU._de_iso(t['desde']), t.get('sv') or {}))
            except (KeyError, TypeError, ValueError):
                continue
        tramos.sort(key=lambda x: x[0])

        def en(t, base=base, tramos=tramos):
            sv = base
            for desde, sv2 in tramos:
                if t is not None and desde <= t:
                    sv = sv2
            return _top(sv)
        tops[str(s.get('id') or '')] = en
    out_sem, suma, anterior = {}, {}, None
    for sid in sorted(semanas):
        ini, fin = semanas[sid]
        lista = elegir(sid, anterior)
        anterior = [x[0] for x in lista]
        ev_s, svs_antes = {}, {}
        for e in evs:
            if e[2] is None or (desde and e[2] < desde):
                continue
            if ini <= e[2] < fin:
                ev_s.setdefault(e[3], []).append((e[0], e[1], e[2], e[4]))
            elif e[2] < ini:
                svs_antes.setdefault(e[3], set()).add(e[1])
        du_s = {}
        for d in dus:
            if d[1] is not None and ini <= d[1] < fin and not (desde and d[1] < desde):
                du_s[d[2]] = du_s.get(d[2], 0) + 1
        top = tops.get(sid, set())
        prog, pts = {}, {}
        for quien in sorted(set(ev_s) | set(du_s)):
            vs = [valor(i, ev_s.get(quien, []), du_s.get(quien, 0), svs_antes.get(quien, set()), top)
                  for i, _t, _n, _m, _p in lista]
            hechas = [cumplida(x[0], v, x[3]) for x, v in zip(lista, vs)]
            p = sum(x[4] for x, h in zip(lista, hechas) if h) + (BONO if all(hechas) else 0)
            prog[quien] = vs
            if p:
                pts[quien] = p
                suma[quien] = suma.get(quien, 0) + p
        out_sem[sid] = {'lista': lista, 'prog': prog, 'pts': pts,
                        'fin': fin.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}
    return {'sem': sem_hoy, 'semanas': out_sem, 'suma': suma}


def correr(res=None, uno=None, ahora=None, aplicar=False):
    """Lo de esta temporada desde `Resultados` y `1v1` (si no vienen, se leen); con `aplicar`, a `datos/misiones.json`."""
    import multiplicadores as MU
    import rankings as RK
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    if res is None or uno is None:
        from escribir import Hoja
        res = Hoja('Resultados').filas() if res is None else res
        uno = Hoja('1v1').filas() if uno is None else uno
    # ⚠️ EL ARRANQUE CORTA SÓLO CUANDO YA PASÓ, como en las divisiones (ver `divisiones.correr()`)
    desde = MU._arranque()
    if desde and desde > ahora:
        desde = None
    evs, dus = filas_de(res, uno, canon=RK.canon, es_troll=RK._trolls())
    c = calcular(evs, dus, ahora, desde, MU.leer())
    out = {'_leeme': 'Las misiones de la semana: las arma bot/misiones.py en el paso 1c, enteras en cada corrida. '
                     'Las reglas y los números viven en ese archivo. `suma` es lo que cada uno lleva sumado a la '
                     'Temporada; `semanas`, qué tocó cada semana y quién cumplió.',
           'sem': c['sem'], 'bono': BONO, 'semanas': c['semanas'], 'suma': c['suma'],
           # 🔴 de qué temporada es (revisión del 05/10/2026): `rankings.sumar_misiones()` suma lo de la corrida
           # anterior, y el día que arranca la T1 eso era lo de la prueba —hasta 2.900 por persona— sumado a la T1
           'temp': MU.temporada_actual(ahora)}
    if aplicar:
        with io.open(SALIDA, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(out, f, ensure_ascii=False, indent=1, sort_keys=True)
            f.write('\n')
    return out


def leer(ruta=None):
    """`datos/misiones.json`, o `{}`."""
    try:
        with io.open(ruta or SALIDA, encoding='utf-8') as f:
            return json.load(f) or {}
    except (OSError, ValueError):
        return {}


def para_web(d):
    """Lo de la semana para la página: `{sem, fin, lista, bono, prog, pts, total}`, o `None` si todavía no hay.

    ⚠️ EL PROGRESO VA LISTO PARA MOSTRAR: «cuánto llevás de cuánto», con la meta `m` de cada misión. Las de llegar a
    una ronda o de jugar en un servidor son de sí o no (`m` = 1), y `llego` (la mejor ronda, menor es mejor) no se
    entiende en una barra."""
    d = d or {}
    s = (d.get('semanas') or {}).get(d.get('sem') or '')
    if not s:
        return None
    lista = s.get('lista') or []
    metas = [x[3] if _que(x[0]) in ('eventos', 'duelos') else 1 for x in lista]

    def mostrar(vs):
        out = []
        for x, m, v in zip(lista, metas, vs):
            out.append(min(v, m) if _que(x[0]) in ('eventos', 'duelos') else int(cumplida(x[0], v, x[3])))
        return out
    return {'sem': d['sem'], 'fin': s.get('fin'), 'bono': d.get('bono', BONO),
            'lista': [{'id': x[0], 't': x[1], 'n': x[2], 'm': m, 'p': x[4]} for x, m in zip(lista, metas)],
            'prog': {q: mostrar(vs) for q, vs in (s.get('prog') or {}).items()},
            'pts': s.get('pts') or {}, 'total': d.get('suma') or {}}


def _self_check():
    print('\n══ LAS MISIONES DE LA SEMANA ══\n')
    mal = 0

    def ok(c, q):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '🔴', q))
    a, b = elegir('2026-10-05'), elegir('2026-10-05')
    ok(a == b and [x[2] for x in a] == list(NIVELES), 'la misma semana da las mismas tres: una de cada nivel')
    c = elegir('2026-10-12', [x[0] for x in a])
    ok(all(x[0] != y[0] for x, y in zip(a, c)), 'y la semana siguiente ninguna se repite en su nivel')
    U = dt.timezone.utc
    t1 = dt.datetime(2026, 10, 6, 1, 0, tzinfo=U)       # lunes 5/10, 9 PM ET: ya es la semana del 5
    t0 = dt.datetime(2026, 10, 1, 1, 0, tzinfo=U)       # la semana de antes
    evs = [(10, 'FFA', t0, 'Ana', 'octavos'),
           (20, 'FFA', t1, 'Ana', 'campeon'), (21, 'DRA', t1, 'Ana', 'cuartos'),
           (20, 'FFA', t1, 'Bea', 'subcampeon')]
    dus = [(20, t1, 'Ana'), (20, t1, 'Ana'), (20, t1, 'Ana'), (21, t1, 'Ana'), (21, t1, 'Ana'), (20, t1, 'Bea')]
    ahora = dt.datetime(2026, 10, 7, 12, 0, tzinfo=U)
    r = calcular(evs, dus, ahora, None, {'semanas': [{'id': '2026-10-05', 'sv': {'DRA': 2, 'FFA': 1}}]})
    s = r['semanas'].get('2026-10-05') or {}
    lista = s.get('lista') or []
    ok(r['sem'] == '2026-10-05' and '2026-09-28' not in r['semanas'], 'las misiones arrancan la semana del 5/10')
    ok(r['suma'].get('Ana') == sum(PUNTOS.values()) + BONO,
       'Ana cumple las tres (2 eventos, 5 duelos, campeona, en DRA y en un servidor nuevo): las tres y el bono '
       '(%s)' % [x[0] for x in lista])
    ok(0 < r['suma'].get('Bea', 0) < sum(PUNTOS.values()), 'Bea cumple algunas: suma sólo las suyas, sin el bono')
    ok(valor('nuevo', [(21, 'DRA', t1, 'cuartos')], 0, {'FFA'}, set()) == 1
       and valor('nuevo', [(20, 'FFA', t1, 'campeon')], 0, {'FFA'}, set()) == 0,
       '«un servidor nuevo» mira dónde jugaste antes en la temporada')
    ok(cumplida('final', 1, 2) and not cumplida('final', 4, 2) and cumplida('semis', 2, 4),
       'llegar más lejos también cumple: campeón cumple «llegá a una final»')
    w = para_web({'sem': '2026-10-05', 'semanas': {'2026-10-05': s}, 'suma': r['suma']})
    ok(w and len(w['lista']) == 3 and w['total'] == r['suma'], 'la página recibe las tres, el progreso y lo sumado')
    ok(para_web({}) is None, 'sin semana, nada para la página')
    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        return _self_check()
    d = leer()
    w = para_web(d)
    if not w:
        print('\n   todavía no hay misiones (arrancan la semana del %s)\n' % DESDE)
        return 0
    print('\n══ LAS MISIONES DE LA SEMANA DEL %s ══\n' % w['sem'])
    for x in w['lista']:
        print('   %-8s %-60s +%d' % (x['n'], x['t'][:60], x['p']))
    print('   y +%d por las tres\n' % w['bono'])
    top = sorted(w['pts'].items(), key=lambda kv: -kv[1])[:10]
    for q, p in top:
        print('   %-20s +%d' % (q[:20], p))
    print('')
    return 0


if __name__ == '__main__':
    raise SystemExit(main() or 0)
