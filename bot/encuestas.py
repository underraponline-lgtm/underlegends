# -*- coding: utf-8 -*-
"""LAS ENCUESTAS DE LA PÁGINA: El Elegido del Most Wanted y el ×2 votado.

    python bot/encuestas.py          las de ahora y cómo van, sin escribir nada
    python bot/encuestas.py --auto   el self-check, sin red ni archivos

Dlx, 27/09/2026, del Most Wanted: *«eso de que los buscados lo elige la gente
es peak»*, y dónde: *«podría ser en la página. O sea la idea es que la página
sea el HUB central»*. Y a las dos preguntas, *«1. A. 2. A»*: vota
**cualquiera que entre con Discord**, y en el ×2 **nadie vota a su propio
servidor** — de los 161 que jugaron la temporada, 126 son de FFA: si se
pudiera, FFA ganaría todas las semanas.

LAS DOS
-------
EL ELEGIDO. Mientras corre un período del Most Wanted se vota quién es
buscado en el siguiente. El más votado entra como «El Elegido», en un lugar
del nivel del medio: los buscados siguen siendo 3 por día y 9 por semana
(ver `most_wanted.elegir()`). Se puede votar a quien puede ser buscado
—activo, no fuera de concurso y no buscado en el período de ahora— y nadie
se vota a sí mismo.

EL ×2 VOTADO. Mientras corre una semana se vota qué servidor se lleva el ×2
la siguiente. El más votado sale del sorteo del lunes con **×2 como
mínimo**: si el sorteo le da menos, sube a ×2; si le da más, se queda con lo
suyo. Los premios de siempre (la guerra, el Semillero) van encima (ver
`multiplicadores.correr()`).

LAS REGLAS DE LAS DOS
- Un voto por cuenta de Discord y por encuesta; se cambia hasta que cierra.
  Cierra cuando arranca lo que se vota.
- Hacen falta `MIN_VOTOS` votos para que cuente. Con menos no pasa nada.
- Empate: se sortea con el id de la encuesta, así se puede volver a mirar.
- Las cuentas de Discord de menos de 30 días no votan (`EDAD_MIN_DIAS` en
  `bot/avisos.js`): es lo único que frena las cuentas hechas para votar.

DÓNDE VIVE CADA COSA
- Qué se vota, entre qué opciones y hasta cuándo: acá. El ciclo lo deja en
  KV (`encuestas`, sólo si cambió; con quién es de qué servidor, para la
  regla del ×2) y en el payload de la página (sin eso).
- Los votos: el Durable Object de `bot/avisos.js` (tabla `votos`), uno por
  Discord ID. El Worker le pregunta a Discord de quién es cada voto —nunca a
  la página— y rechaza lo que no vale. Afuera se ve cuántos, nunca quién.
- El resultado: lo lee el ciclo de `/avisos/encuestas` cuando le toca
  elegir (`most_wanted.correr()`) o sortear (`multiplicadores.correr()`).

⚠️ NUNCA TRABA EL CICLO: si no se pueden leer los votos se elige y se sortea
sin ellos, y lo dice. Una encuesta que tumba el sorteo del lunes es peor que
una que no cuenta una vez.
"""
import datetime as dt
import hashlib
import io
import json
import os
import random
import sys
import time

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

# ── los números, todos acá ───────────────────────────────────────────────
#: los votos que hacen falta para que una encuesta cuente
MIN_VOTOS = 3
#: la clave de KV que lee el Worker para validar cada voto
CLAVE_KV = 'encuestas'
#: la primera que se vota: el período y la semana que arrancan el lunes 28/09
#: a las 11 AM ET. Nada para atrás.
DESDE = '2026-09-28T15:00:00Z'


def _iso(t):
    return t.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def _de_iso(s):
    return dt.datetime.fromisoformat(str(s).replace('Z', '+00:00'))


# ── qué se vota ──────────────────────────────────────────────────────────
def elegido(ahora=None, datos=None):
    """La encuesta de El Elegido que corre ahora, o `None`.

    `datos` es `(pool, eventos, R)` de `most_wanted.cargar_todo()`, para no
    leerlo dos veces; sin eso se lee.
    """
    import most_wanted as MW
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    c = MW.candidatos(ahora, datos=datos)
    if not c:
        return None
    (pid, ini, fin, tipo), op = c
    if ini < _de_iso(DESDE) or not op:
        return None
    return {'id': 'mw:' + pid, 'tipo': 'elegido', 'per': tipo, 'hasta': _iso(ini), 'fin': _iso(fin),
            'min': MIN_VOTOS, 'op': op}


def x2(ahora=None):
    """La encuesta del ×2 de la semana que viene, o `None`."""
    import multiplicadores as MU
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    _pid, _ini, fin = MU.periodo(ahora)
    pid, ini, fin2 = MU.periodo(fin)
    if ini < _de_iso(DESDE):
        return None
    svs = MU.servidores()
    if len(svs) < 2:
        return None
    return {'id': 'x2:' + pid, 'tipo': 'x2', 'hasta': _iso(ini), 'fin': _iso(fin2),
            'min': MIN_VOTOS, 'x': MU.VOTADO_X, 'op': sorted(svs)}


def abiertas(ahora=None, datos=None):
    """Las que se pueden votar ahora. Para la página y para el Worker."""
    out = []
    for f in (lambda: elegido(ahora, datos), lambda: x2(ahora)):
        try:
            e = f()
        except Exception as ex:                          # noqa: BLE001
            print('   ⚠️ una encuesta no se pudo armar (%s)' % str(ex)[:80])
            e = None
        if e:
            out.append(e)
    return out


def gente(pool=None):
    """`{'yo': {discord_id: rapero}}` de los que jugaron: nadie se vota a sí mismo en El Elegido.

    🔑 EN EL ×2 CUALQUIERA VOTA A CUALQUIERA, también al suyo. Dlx,
    28/09/2026: *«3. B y C»*. Hasta ese día esto mandaba también `sv` —de
    qué servidor era cada Discord ID, el que más jugó— para que nadie votara
    al suyo; ahora «tu servidor» lo elige cada uno en Mi cuenta y no frena
    ningún voto, así que ese dato no viaja más: un Discord ID menos en KV.
    """
    if pool is None:
        try:
            with io.open(os.path.join(BASE, 'datos', 'temporada_pool.json'), encoding='utf-8') as f:
                pool = json.load(f) or []
        except (OSError, ValueError):
            pool = []
    yo = {}
    for p in pool:
        did = str(p.get('discord_id') or '').strip()
        if did.isdigit() and p.get('raw'):
            yo[did] = p['raw']
    return {'yo': yo}


def para_kv(ahora=None, datos=None, lista=None):
    """Lo que lee el Worker para validar un voto. ⚠️ Con Discord IDs: sólo a KV."""
    g = gente(datos[0] if datos else None)
    return {'lista': abiertas(ahora, datos) if lista is None else lista, 'yo': g['yo']}


# ── cómo van, y quién ganó ───────────────────────────────────────────────
def leer_votos(intentos=3, espera=2.0):
    """`{encuesta: {opción: votos}}` de `/avisos/encuestas`, o `None` si no se pudo."""
    import requests
    from alertar import WORKER
    for i in range(intentos):
        try:
            r = requests.get(WORKER + '/avisos/encuestas', timeout=20)
            if r.status_code == 200:
                return (r.json() or {}).get('votos') or {}
            print('   ⚠️ los votos: el Worker contestó %s' % r.status_code)
        except (OSError, ValueError) as e:
            print('   ⚠️ los votos: %s' % str(e)[:80])
        if i + 1 < intentos:
            time.sleep(espera * (i + 1))
    return None


def ganador(cuenta, validas=None, semilla='', minimo=MIN_VOTOS):
    """`(opción, sus votos, votos que cuentan)` del más votado, o `None`.

    Sólo cuentan los votos a opciones `validas` (si se dan): el más votado de
    El Elegido puede haber dejado de poder ser buscado. Con menos de `minimo`
    votos que cuentan, `None`. El empate se sortea con `semilla`.
    """
    c = {}
    for op, n in (cuenta or {}).items():
        try:
            n = int(n)
        except (TypeError, ValueError):
            continue
        if n > 0 and (validas is None or op in validas):
            c[op] = n
    total = sum(c.values())
    if not c or total < minimo:
        return None
    top = max(c.values())
    empate = sorted(op for op, n in c.items() if n == top)
    op = empate[0] if len(empate) == 1 else \
        random.Random(hashlib.sha256(('enc' + semilla).encode()).hexdigest()).choice(empate)
    return op, top, total


# ── self-check ───────────────────────────────────────────────────────────
def _self_check():
    print('\n══ LAS ENCUESTAS ══\n')
    mal = 0

    def ok(c, que):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '🔴', que))

    import most_wanted as MW
    import multiplicadores as MU
    from comun.temporada import ACTUAL, FECHAS
    et = MW._et()

    # quién gana
    ok(ganador({'A': 1, 'B': 1}) is None and ganador({'A': 2}) is None,
       'con menos de %d votos no cuenta' % MIN_VOTOS)
    ok(ganador({'A': 2, 'B': 1}) == ('A', 2, 3) and ganador({'A': 2, 'B': 1, 'C': 1}) == ('A', 2, 4),
       'con %d o más, gana el más votado' % MIN_VOTOS)
    ok(ganador({'A': 5, 'B': 1, 'C': 2}, validas={'B', 'C'}) == ('C', 2, 3),
       'lo que ya no vale no cuenta: gana el más votado de lo que sí')
    e1 = ganador({'A': 2, 'B': 2}, semilla='x2:2026-10-05')
    ok(e1 and e1[0] in 'AB' and e1 == ganador({'B': 2, 'A': 2}, semilla='x2:2026-10-05'),
       'el empate se sortea, y con la misma semilla sale lo mismo  %s' % (e1,))
    ok(ganador({'A': '3', 'B': 'x', 'C': -1}) == ('A', 3, 3), 'lo que no es un número no suma')

    # quién es quién: para que nadie se vote a sí mismo en El Elegido
    g = gente([{'raw': 'Ana', 'sv': 'FFA', 'discord_id': '123456789012345678'},
               {'raw': 'Bea', 'sv': 'SR', 'discord_id': ''},
               {'raw': 'Cid', 'sv': '', 'discord_id': 987654321098765432}])
    ok(g == {'yo': {'123456789012345678': 'Ana', '987654321098765432': 'Cid'}},
       'sólo quién es quién; sin Discord ID no hay regla, y el servidor ya no viaja (en el ×2 se vota a cualquiera)')

    # cuándo se vota el ×2
    x = x2(dt.datetime(2026, 9, 27, 15, 0, tzinfo=et))
    ok(x and x['id'] == 'x2:2026-09-28' and x['hasta'] == '2026-09-28T15:00:00Z' and x['x'] == MU.VOTADO_X,
       'hoy domingo 27/09 se vota el ×2 de la semana del lunes 28, hasta las 11 AM  %s'
       % (x and x['id'],))
    arr = dt.date.fromisoformat(FECHAS[ACTUAL][0])
    en = lambda d, h: dt.datetime(arr.year, arr.month, arr.day, h, tzinfo=et) + dt.timedelta(days=d)
    x = x2(en(-3, 15))
    ok(x and x['id'] == 'x2:' + arr.isoformat() and _de_iso(x['hasta']) == en(0, 0),
       'la última semana de la prueba vota la primera de la %s, y cierra a las 00:00 del arranque'
       % ACTUAL.upper())
    ok(x2(dt.datetime(2026, 9, 20, 15, 0, tzinfo=et)) is None,
       'nada para atrás: la semana del 21/09 no se votó')

    # cuándo se vota El Elegido
    s = MW.siguiente(dt.datetime(2026, 9, 27, 15, 0, tzinfo=et))
    ok(s and s[0] == '2026-09-28' and s[3] == 'dia', 'hoy se vota El Elegido de mañana  %s' % (s and s[0],))
    ok(MW.siguiente(en(-1, 15)) is None,
       'el último día de la prueba no se vota: el que sigue es de la temporada, y lo de la prueba no pasa')
    s = MW.siguiente(en(2, 15))
    ps = MW._primera_semana()
    ok(s and s[1] == ps and s[3] == 'semana',
       'en la primera semana de la %s se vota El Elegido del primer Most Wanted (%s)'
       % (ACTUAL.upper(), ps.astimezone(et).date()))

    # los candidatos: activos, no fuera de concurso, no buscados ahora
    t0 = dt.datetime(2026, 9, 27, 15, tzinfo=dt.timezone.utc)

    class _R:
        def lado(self, s):
            return [m.strip() for m in str(s).split(',') if m.strip()]

    def ev(t, fase):
        return {'n': 1, 't': t, 'nombre': 'X', 'sv': 'FFA', 'part': 16, 'fase': fase, 'rondas': []}
    pool = [{'raw': 'Ana', 'pos': 1, 'o': 1}, {'raw': 'Bea', 'pos': 2, 'o': 2, 'fc': True},
            {'raw': 'Cid', 'pos': 3, 'o': 3}, {'raw': 'Dan', 'pos': 4, 'o': 4}]
    evs = [ev(t0 - dt.timedelta(hours=h), {'Ana': 'Cuartos', 'Bea': 'Campeón', 'Cid': 'Octavos'})
           for h in (3, 30)] + [ev(t0 - dt.timedelta(hours=2), {'Dan': 'Cuartos'})]
    c = MW.candidatos(t0, datos=(pool, evs, _R()), actual={'temporada': 'prueba',
                                                         'buscados': [{'n': 'Cid'}]})
    ok(c and c[1] == ['Ana'],
       'se vota a quien puede ser buscado: activo, no fuera de concurso y no buscado hoy  %s'
       % (c and c[1],))
    print('\n   %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return mal


def main():
    a = sys.argv[1:]
    if '--auto' in a:
        return 1 if _self_check() else 0
    ls = abiertas()
    v = leer_votos(intentos=1) or {}
    print('\n══ LAS ENCUESTAS DE AHORA ══\n')
    if not ls:
        print('   ninguna abierta')
    for e in ls:
        cu = v.get(e['id']) or {}
        print('   %-16s hasta %s · %d opciones · %d votos' % (e['id'], e['hasta'], len(e['op']),
                                                          sum(cu.values())))
        for op, n in sorted(cu.items(), key=lambda kv: -kv[1])[:5]:
            print('      %-20s %d' % (op[:20], n))
        g = ganador(cu, set(e['op']), e['id'])
        print('      → %s' % ('%s, %d de %d' % g if g else 'no cuenta todavía (hacen falta %d votos)'
                              % MIN_VOTOS))
    print('')
    return 0


if __name__ == '__main__':
    raise SystemExit(main() or 0)
