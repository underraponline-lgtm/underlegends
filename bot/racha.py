# -*- coding: utf-8 -*-
"""LA RACHA DIARIA Y LOS NIVELES: cuántos días seguidos estás en la Liga, y qué tan antiguo sos.

    python bot/racha.py          quién jugó qué días, sin escribir nada
    python bot/racha.py --auto   el self-check, sin red ni archivos

Dlx, 04/10/2026, de las ideas nuevas: *«¿y un daily streak? al conectarse en cualquier parte de la Liga
Global»* y *«¿quizás hasta niveles? para ver qué tan antiguo eres»*. A las preguntas: *«3. A o cualquier
participación detectada… 4. A pero podemos pensar en más cosas 5. A y B»*.

LAS REGLAS (los números, acá arriba)
------------------------------------
- **Un día cuenta** (en hora del este) si ese día usaste el bot, hiciste algo en la página con tu cuenta o
  **jugaste un evento**. Lo de los dos primeros lo anota el Worker solo (`anotarUso()` en `bot/avisos.js`); lo
  de jugar se lo pasa el ciclo, con la fecha del evento y no la de la corrida.
- **La racha** son los días seguidos hasta hoy. Sigue viva todo el día de hoy si ayer contó.
- **Cada `CADA` días seguidos, `PREMIO` Puntos de Tienda** (Dlx: *«A»*). Una racha que se corta y vuelve a
  arrancar vuelve a pagar desde el primer `CADA`.
- **El nivel** sube con la experiencia (Dlx: *«A y B»*): `XP_EVENTO` por cada evento jugado y `XP_DIA` por cada
  día que contó. Para llegar al nivel N hacen falta `PASO · N · (N − 1)` puntos: 20 el 2, 60 el 3, 200 el 5,
  900 el 10. Las misiones van a sumar acá cuando existan.
- **Arrancan en cero con la T1**: lo de la prueba no cuenta (`origen()`, el arranque de la T1 en
  `comun/temporada.py`). Ni la racha ni el nivel se reinician en las temporadas siguientes: el nivel mide qué tan
  antiguo sos. Por eso los eventos viajan con su temporada (`temp`) y el objeto guarda los de cada una.

DÓNDE VIVE CADA COSA
- Los días, la racha, el premio y el nivel: el Durable Object de `bot/avisos.js` (tablas `activo` y `jugo_temp`).
  El cálculo es `rachaDeDias()` y `nivelDeXp()`, y los números le llegan de acá (`config()`).
- Quién jugó qué días: lo arma `jugo()` en cada corrida y viaja con lo del precio por cabeza
  (`precios:resolucion`, `precios.para_objeto()`): ENTERO cada vez, así una llave corregida corrige los días.
- ⚠️ Sólo de quien tiene Discord en el padrón: sin Discord no hay a quién anotarle el día.
"""
import datetime as dt
import os
import sys
from zoneinfo import ZoneInfo

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)

#: días seguidos para el premio
CADA = 7
#: Puntos de Tienda cada `CADA` días seguidos (la billetera arranca con 5.000: `precios.INICIAL`)
PREMIO = 500
#: experiencia por evento jugado y por día que contó
XP_EVENTO = 10
XP_DIA = 2
#: para el nivel N: `PASO · N · (N − 1)` puntos
PASO = 10

ET = ZoneInfo('America/New_York')


def origen(ahora=None):
    """Desde cuándo cuentan la racha y el nivel: el arranque de la T1, la primera de verdad; `None` en la prueba.

    ⚠️ ES EL DE LA T1 Y NO EL DE LA TEMPORADA EN CURSO: con el de la T2 los niveles volverían a cero, y miden qué tan
    antiguo sos. Lo único que se descarta es la prueba.
    """
    from comun.temporada import arranque
    a = arranque('t1')
    a = dt.datetime.fromisoformat(a) if a else None
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    return a if a and a <= ahora else None


def config(desde=None, temp='prueba'):
    """Lo que lee el objeto: los números, desde cuándo cuentan (ms, 0 en la prueba) y de qué temporada son los
    eventos que viajan (`temp`: el objeto los guarda por temporada y el nivel los suma todos)."""
    return {'cada': CADA, 'premio': PREMIO, 'xp_ev': XP_EVENTO, 'xp_dia': XP_DIA, 'paso': PASO,
            'desde': int(desde.timestamp() * 1000) if desde else 0, 'temp': temp or 'prueba'}


def _gente(ev):
    """Los que jugaron ese evento: la tabla y los dos lados de cada batalla."""
    g = set(ev.get('fase') or {})
    for bs in ev.get('rondas') or []:
        for lados, _gan, _nota in bs:
            for lado in lados:
                g.update(x for x in lado if x)
    return g


def jugo(evs, dids, desde=None):
    """`{discord_id: [clave, eventos, [días ET]]}` de los que jugaron, con Discord en el padrón.

    `evs` son los de `most_wanted.cargar_todo()`; `dids`, `{rapero: discord_id}`; `desde`, el arranque (o
    `None` en la prueba). La clave es la del perfil (`comun.claves.clave()`): con ella la página pregunta el
    nivel de cada uno.
    """
    from comun.claves import clave
    out = {}
    for ev in evs:
        t = ev.get('t')
        if not t or (desde and t < desde):
            continue
        dia = t.astimezone(ET).strftime('%Y-%m-%d')
        for raw in _gente(ev):
            did = dids.get(raw)
            if not did:
                continue
            x = out.setdefault(did, [clave(raw), 0, set()])
            x[1] += 1
            x[2].add(dia)
    return {k: [v[0], v[1], sorted(v[2])] for k, v in out.items()}


def xp_para(n):
    """Los puntos que hacen falta para llegar al nivel `n`."""
    return PASO * n * (n - 1)


def nivel(xp):
    """El nivel con esa experiencia: el más alto cuyo `xp_para()` no la pasa. Igual que `nivelDeXp()`."""
    n = 1
    while xp_para(n + 1) <= xp:
        n += 1
    return n


def _self_check():
    fallas = []

    def ok(c, que):
        print('  %s %s' % ('✅' if c else '❌', que))
        if not c:
            fallas.append(que)

    utc = dt.timezone.utc
    evs = [
        # un evento a las 11 PM ET del 03/10 es del 03/10, aunque en UTC ya sea 04/10
        {'t': dt.datetime(2026, 10, 4, 3, 0, tzinfo=utc), 'fase': {'Ana': 1},
         'rondas': [[([['Ana'], ['Beto']], {'Ana'}, '')]]},
        {'t': dt.datetime(2026, 10, 4, 20, 0, tzinfo=utc), 'fase': {},
         'rondas': [[([['Ana', 'Cami'], ['Dani']], {'Dani'}, '')]]},
        {'t': dt.datetime(2026, 9, 20, 20, 0, tzinfo=utc), 'fase': {'Ana': 2}, 'rondas': []},
    ]
    dids = {'Ana': '111', 'Beto': '222', 'Dani': '444'}
    j = jugo(evs, dids)
    ok(j['111'] == ['ana', 3, ['2026-09-20', '2026-10-03', '2026-10-04']],
       'Ana: tres eventos en tres días, con el día en hora del este (%s)' % j.get('111'))
    ok(j['222'] == ['beto', 1, ['2026-10-03']] and j['444'][1] == 1, 'cada lado de la batalla jugó')
    ok('Cami' not in str(j) and len(j) == 3, 'sin Discord en el padrón no hay a quién anotarle el día')
    j2 = jugo(evs, dids, desde=dt.datetime(2026, 10, 1, 4, 0, tzinfo=utc))
    ok(j2['111'][1] == 2 and '2026-09-20' not in j2['111'][2], 'lo de antes del arranque no cuenta')
    ok([xp_para(n) for n in (1, 2, 3, 5, 10)] == [0, 20, 60, 200, 900], 'la escalera de los niveles')
    ok((nivel(0), nivel(19), nivel(20), nivel(899), nivel(900)) == (1, 1, 2, 9, 10), 'el nivel de cada experiencia')
    c = config(dt.datetime(2026, 10, 12, 4, 0, tzinfo=utc), 't1')
    ok(c['desde'] == 1791777600000 and c['cada'] == CADA and c['temp'] == 't1' and config()['desde'] == 0
       and config()['temp'] == 'prueba', 'la configuración que viaja')
    ok(origen(dt.datetime(2026, 10, 1, tzinfo=utc)) is None
       and origen(dt.datetime(2027, 2, 1, tzinfo=utc)) == dt.datetime(2026, 10, 12, 4, 0, tzinfo=utc),
       'el origen es el arranque de la T1, también en la T2: el nivel no vuelve a cero')
    print('\n  %s' % ('todo ok' if not fallas else '%d fallaron' % len(fallas)))
    return not fallas


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        print('\n══ LA RACHA Y LOS NIVELES ══')
        return 0 if _self_check() else 1
    import most_wanted as MW
    import precios as PR
    pool, evs, _R = MW.cargar_todo()
    j = jugo(evs, PR.discords(pool), PR._arranque())
    print('%d personas con días jugados · %d días en total' % (len(j), sum(len(v[2]) for v in j.values())))
    for did, (k, n, dias) in sorted(j.items(), key=lambda x: -len(x[1][2]))[:15]:
        print('   %-18s %3d evento(s)  %3d día(s)  último %s' % (k[:18], n, len(dias), dias[-1]))
    return 0


if __name__ == '__main__':
    sys.exit(main())
