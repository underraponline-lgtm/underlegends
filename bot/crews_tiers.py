# -*- coding: utf-8 -*-
"""🏆 LOS TIERS DE LAS CREWS: como las divisiones del fútbol, una crew sube, baja o se mantiene cada semana.

    python bot/crews_tiers.py            cómo va la semana de cada crew, sin escribir nada
    python bot/crews_tiers.py --aplicar  y cierra la semana si terminó, en datos/crews_tiers.json (paso 1c)
    python bot/crews_tiers.py --auto     el self-check, sin red ni archivos

Dlx, 19/10/2026: *«crear diferentes TIERS para las CREWS. Como Bronce, Plata, Diamante, etc. Y a partir del Diamante
tú sugiere cómo uno obtiene o sube de TIERs… en algún tier se desbloqueará una TARJETA crew personalizable por el dueño
de la CREW. Ojo, esto tiene que ser aprobado por un mod o más»*. Y a las preguntas: *«Es como los equipos de fútbol.
Pueden bajar de división y subir y mantenerse»*, la tarjeta en **Diamante** y la aprueban él y los del Dashboard.

LAS REGLAS (los números, acá abajo)
-----------------------------------
- **Siete tiers**, de Bronce a Leyenda (`TIERS`). Toda crew arranca en Bronce, también las 34 de la Liga.
- **La semana es la de las divisiones y los multiplicadores**: de lunes a lunes a las 11 AM ET (`divisiones.json`).
- **Los puntos de la crew en la semana** son los de Temporada que su gente hizo esa semana (los mismos de las
  divisiones), sumados como dice el Dashboard para el ranking de crews —todos, los N mejores o los representantes—.
- **Al cerrar la semana**: con `SUBE[t]` o más, sube un tier; con menos de `BAJA[t]`, baja uno; si no, se mantiene.
  De a uno por semana, como un ascenso: llegar a Diamante pide un mes jugando.
- **Subir pide gente, no sólo puntos** (lo que Dlx dejó para sugerir): para entrar a cada tier tienen que haber jugado
  esa semana al menos `JUEGAN[t]` de la crew —para Diamante, 4—. Una crew de uno que gana todo no es una crew.
- **Cuentan todos los que están en la crew cuando cierra la semana**, con lo que hicieron esa semana. No hace falta
  frenar los «fichajes del domingo»: quien deja una crew espera 7 días para entrar a otra (`bot/crews.js`), así que
  nadie le suma la misma semana a dos crews. (Se probó al revés —sólo quien estaba al arrancar la semana— y dejaba a
  toda crew nueva sin sumar su primera semana: la que se arma un martes no podía subir hasta dos lunes después.)
- **La tarjeta de crew personalizable** se desbloquea en `TARJETA` (Diamante) y la aprueba un mod. Si la crew baja, la
  tarjeta deja de verse; si vuelve a subir, vuelve.

⚠️ ES UN ESTADO, NO UN CÁLCULO ENTERO: el tier de hoy sale del de la semana pasada, así que vive en
`datos/crews_tiers.json` (en `ARCHIVOS` de `bot/ci/guardar.sh`: si no, cada runner arrancaría con todas en Bronce).
⚠️ LA SEMANA SE CIERRA CON LA ÚLTIMA FOTO: cada corrida guarda los puntos de la semana en curso (`pts`), y cuando
`divisiones.json` ya está en la semana siguiente, cierra la anterior con esa foto. Lo de la madrugada del lunes (3 a 11
AM ET, sin ciclo) se pierde para esa semana.
⚠️ ARRANCA EL 19/10/2026 (`ARRANQUE`): la primera semana que cuenta es la que empieza ese lunes a las 11 AM.
"""
import datetime as dt
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE):
    if _p not in sys.path:
        sys.path.insert(0, _p)

RUTA = os.path.join(BASE, 'datos', 'crews_tiers.json')
DIVISIONES = os.path.join(BASE, 'datos', 'divisiones.json')
VIVAS = os.path.join(BASE, 'datos', 'crews_vivas.json')

#: de abajo para arriba, con su color —viaja en el payload: NINGÚN color vive en el CSS de la página (CLAUDE.md)—
TIERS = (('Bronce', '#B4713D'), ('Plata', '#AEB6C1'), ('Oro', '#E8B923'), ('Platino', '#5FC8C0'), ('Diamante', '#58A6FF'),
         ('Maestro', '#9B5CFF'), ('Leyenda', '#E4005B'))
#: los puntos de la semana para subir DESDE cada tier (Leyenda ya no sube). Medido el 19/10/2026 sobre la semana del 12
#: con la gente de hoy: la mejor crew hizo 286.308, la segunda 149.218, la mediana de las que jugaron ~20.000
SUBE = (15000, 30000, 50000, 80000, 120000, 180000, None)
#: con menos de esto en la semana, BAJA (Bronce no baja). Una crew que no juega, baja
BAJA = (None, 5000, 15000, 25000, 40000, 60000, 90000)
#: cuántos de la crew tienen que haber jugado la semana para ENTRAR a cada tier
JUEGAN = (0, 1, 2, 3, 4, 5, 6)
#: el tier que desbloquea la tarjeta de crew personalizable
TARJETA = 4
ARRANQUE = '2026-10-19'
HISTORIA = 200


def reglas_validas(r):
    """🏆 Los números del Dashboard (`crews_tiers_num`, Dlx 19/10/2026: «Tiers en el Dashboard»): `(sube, baja, juegan)`
    como las tuplas de arriba, o `None` si no valen. ⚠️ Las mismas reglas que `tiersValidos()` de bot/crews.js, que es
    quien los guarda: se vuelven a mirar acá porque un número roto cerraría la semana de todas las crews."""
    if not isinstance(r, dict):
        return None

    def ent(xs, n, lo, hi):
        ok = isinstance(xs, list) and len(xs) == n and all(isinstance(x, int) and not isinstance(x, bool) and lo <= x <= hi
                                                            for x in xs)
        return list(xs) if ok else None
    sube, baja, juegan = ent(r.get('sube'), 6, 1, 10 ** 7), ent(r.get('baja'), 6, 0, 10 ** 7), ent(r.get('juegan'), 7, 0, 20)
    if not sube or not baja or not juegan:
        return None
    if any(sube[i] <= sube[i - 1] or baja[i] < baja[i - 1] for i in range(1, 6)) \
            or any(juegan[i] < juegan[i - 1] for i in range(1, 7)) or any(baja[i] > sube[i] for i in range(6)):
        return None
    return tuple(sube) + (None,), (None,) + tuple(baja), tuple(juegan)


def usar_reglas(aj):
    """Si el Dashboard puso números, son los de esta corrida (y los de la página: `para_web()`). Sin ajustes —el Worker
    no contestó— o con números rotos, los de siempre. Devuelve si se usaron los del Dashboard."""
    global SUBE, BAJA, JUEGAN
    r = reglas_validas((aj or {}).get('crews_tiers_num'))
    if not r:
        return False
    SUBE, BAJA, JUEGAN = r
    return True


def _json(ruta, defecto=None):
    try:
        with io.open(ruta, encoding='utf-8') as f:
            return json.load(f)
    except Exception:                                    # noqa: BLE001
        return defecto


def _clave(nombre):
    from comun.claves import clave
    return clave(nombre or '')


def pts_de_divisiones(div):
    """`(semana, {clave: puntos})` de la semana en curso, de lo que arma `bot/divisiones.py`."""
    pts = {}
    for d in (div or {}).get('divs') or []:
        for g in d or []:
            for x in g or []:
                if x and len(x) >= 2:
                    k = _clave(x[0])
                    pts[k] = pts.get(k, 0) + int(x[1] or 0)
    return str((div or {}).get('sem') or ''), pts


def inicio_ms(sem):
    """La semana `sem` (su lunes) arranca a las 11 AM ET: en milisegundos, para comparar con `desde` de cada miembro."""
    try:
        from zoneinfo import ZoneInfo
        d = dt.datetime.strptime(sem, '%Y-%m-%d').replace(hour=11, tzinfo=ZoneInfo('America/New_York'))
    except Exception:                                    # noqa: BLE001
        d = dt.datetime.strptime(sem, '%Y-%m-%d').replace(hour=15, tzinfo=dt.timezone.utc)
    return int(d.timestamp() * 1000)


def de_la_semana(crew, pts, desde_ms, modo, n):
    """Los puntos y cuántos jugaron, de una crew en una semana: sólo quien ya estaba al arrancar la semana."""
    import crews_vivas as CV
    suyos = {}
    for g in crew.get('gente') or []:
        k, desde = g[0], (g[2] if len(g) > 2 else 0) or 0
        if desde_ms is not None and desde > desde_ms:
            continue
        # 🪪 quien está sin verificarse no suma para el tier mientras tanto (`crewVerificar()` de bot/crews.js)
        if len(g) > 3 and g[3]:
            continue
        suyos[k] = int(pts.get(k, 0) or 0)
    reps = [k for k in crew.get('reps') or [] if k in suyos]
    total = int(round(CV.puntos(suyos, modo, n, reps)))
    return total, sum(1 for v in suyos.values() if v > 0)


def mover(tier, total, jugaron):
    """El tier de la semana que viene: sube uno, baja uno o se queda. Pura."""
    if tier < len(TIERS) - 1 and SUBE[tier] is not None and total >= SUBE[tier] and jugaron >= JUEGAN[tier + 1]:
        return tier + 1
    if tier > 0 and BAJA[tier] is not None and total < BAJA[tier]:
        return tier - 1
    return tier


def cerrar(estado, vivas, sem_nueva, pts_nuevos):
    """Cierra la semana `estado['sem']` con la última foto (`estado['pts']`) y arranca `sem_nueva`. Devuelve los cambios."""
    sem = estado.get('sem') or ''
    rk = (vivas or {}).get('ranking') or {}
    modo, n = rk.get('modo') or 'todos', int(rk.get('n') or 5)
    desde = None  # cuentan todos los que están al cerrar (ver arriba)
    tiers = estado.setdefault('tier', {})
    res, cambios = {}, []
    cuenta = bool(sem) and sem >= ARRANQUE
    for c in (vivas or {}).get('crews') or []:
        cid = c.get('id')
        t = int(tiers.get(cid, 0))
        total, jug = de_la_semana(c, estado.get('pts') or {}, desde, modo, n)
        nuevo = mover(t, total, jug) if cuenta else t
        res[cid] = {'pts': total, 'jugaron': jug, 'de': t, 'a': nuevo}
        tiers[cid] = nuevo
        if nuevo != t:
            cambios.append([sem, cid, t, nuevo, total])
    # las que ya no existen, afuera
    vivas_ids = {c.get('id') for c in (vivas or {}).get('crews') or []}
    for cid in [x for x in tiers if x not in vivas_ids]:
        tiers.pop(cid, None)
    estado['ult'] = {'sem': sem, 'crews': res, 'cuenta': cuenta}
    estado['hist'] = (cambios + (estado.get('hist') or []))[:HISTORIA]
    estado['sem'], estado['pts'] = sem_nueva, pts_nuevos
    return cambios


def actual(estado, vivas):
    """Cómo va la semana en curso de cada crew, para la página: `{id: [puntos, jugaron]}`."""
    rk = (vivas or {}).get('ranking') or {}
    modo, n = rk.get('modo') or 'todos', int(rk.get('n') or 5)
    return {c.get('id'): list(de_la_semana(c, estado.get('pts') or {}, None, modo, n)) for c in (vivas or {}).get('crews') or []}


def paso(estado, div, vivas):
    """Una corrida: cierra la semana si `divisiones.json` ya está en otra, o guarda la foto de la de ahora."""
    sem_d, pts = pts_de_divisiones(div)
    if not sem_d:
        return []
    if not estado.get('sem'):
        estado['sem'], estado['pts'] = sem_d, pts
        return []
    # 🛡️ una semana VIEJA (un divisiones.json de antes que volvió al repo) no cierra nada: cerraría la de ahora a medias y
    # la corrida siguiente la cerraría de nuevo —dos ascensos en una semana— (la revisión del 19/10/2026)
    if sem_d < estado['sem']:
        return []
    if sem_d != estado['sem']:
        # 🛡️ sin las crews (el objeto no contestó) NO se cierra: se borrarían todas de la tabla. Se espera a la corrida
        # siguiente con la foto que había —la semana nueva todavía no tiene nada que perder—
        if not (vivas or {}).get('crews'):
            return []
        return cerrar(estado, vivas, sem_d, pts)
    estado['pts'] = pts
    return []


def para_web(estado, vivas):
    """Lo que viaja a la página: las reglas, el tier de cada crew y cómo va su semana."""
    act = actual(estado, vivas) if vivas else {}
    ult = (estado.get('ult') or {}).get('crews') or {}
    return {
        'nombres': [t[0] for t in TIERS], 'colores': [t[1] for t in TIERS], 'sube': list(SUBE), 'baja': list(BAJA),
        'juegan': list(JUEGAN), 'tarjeta': TARJETA, 'sem': estado.get('sem') or '',
        'crews': {cid: [int((estado.get('tier') or {}).get(cid, 0))] + (act.get(cid) or [0, 0])
                  + [((ult.get(cid) or {}).get('de', None))] for cid in {c.get('id') for c in (vivas or {}).get('crews') or []}},
    }


def _escribir(estado):
    nuevo = json.dumps(dict({'_leeme': 'Los tiers de las crews: el de cada una, la semana en curso (la última foto de '
                                       'los puntos de cada persona) y los últimos cambios. Lo escribe bot/crews_tiers.py '
                                       'en el paso 1c; las reglas viven en ese archivo.'},
                            **{k: v for k, v in estado.items() if k != '_leeme'}), ensure_ascii=False, indent=1, sort_keys=True) + '\n'
    viejo = None
    try:
        with io.open(RUTA, encoding='utf-8') as f:
            viejo = f.read()
    except Exception:                                    # noqa: BLE001
        pass
    if viejo == nuevo:
        return False
    with io.open(RUTA, 'w', encoding='utf-8', newline='\n') as f:
        f.write(nuevo)
    return True


def _auto():
    mal = []

    def ok(c, t):
        if not c:
            mal.append(t)
            print('  🔴 ' + t)

    # las reglas: sube uno, baja uno, se queda; subir pide gente
    ok(mover(0, 20000, 1) == 1 and mover(0, 1000, 0) == 0, 'Bronce sube con 15.000 y no baja')
    ok(mover(1, 4000, 1) == 0 and mover(1, 10000, 1) == 1, 'Plata baja con menos de 5.000 y se mantiene entre las dos')
    ok(mover(3, 500000, 3) == 3 and mover(3, 500000, 4) == 4, 'a Diamante se entra con 4 que jugaron, no con un crack solo')
    ok(mover(6, 10 ** 7, 20) == 6 and mover(6, 0, 0) == 5, 'Leyenda no sube más, y baja si no juega')
    ok(de_la_semana({'gente': [['a', 'lider', 1], ['b', 'miembro', 2, 99]]}, {'a': 100, 'b': 900}, None, 'todos', 5) == (100, 1),
       'quien está sin verificarse no suma para el tier')
    ok(all(SUBE[i] is None or BAJA[i + 1] is None or BAJA[i + 1] <= SUBE[i] for i in range(len(TIERS) - 1)),
       'subir a un tier nunca pide menos que no bajar de él (si no, se sube y se baja la misma semana)')
    ok(len(TIERS) == len(SUBE) == len(BAJA) == len(JUEGAN) and TIERS[TARJETA][0] == 'Diamante', 'siete tiers y la tarjeta en Diamante')
    # una semana entera, con quien entró tarde y la semana del arranque
    t0 = inicio_ms('2026-10-19')
    vivas = {'ranking': {'modo': 'todos', 'n': 5}, 'crews': [
        {'id': 'A', 'gente': [['a1', 'lider', t0 - 1], ['a2', 'miembro', t0 - 1]]},
        {'id': 'B', 'gente': [['b1', 'lider', t0 - 1], ['b2', 'miembro', t0 + 3600000]]},
        {'id': 'C', 'gente': [['c1', 'lider', t0 - 1]]}]}
    div = lambda sem, pts: {'sem': sem, 'divs': [[[[k, v, 1] for k, v in pts.items()]]]}  # noqa: E731
    e = {}
    paso(e, div('2026-10-12', {'a1': 90000}), vivas)
    ok(e['sem'] == '2026-10-12' and not e.get('tier'), 'la primera corrida sólo guarda la foto')
    cambios = paso(e, div('2026-10-19', {}), vivas)
    ok(not cambios and e['ult']['cuenta'] is False and e['tier'].get('A') == 0, 'la semana de antes del arranque no cuenta')
    paso(e, div('2026-10-19', {'a1': 9000, 'a2': 8000, 'b1': 1000, 'b2': 900000, 'c1': 0}), vivas)
    ok(actual(e, vivas)['A'] == [17000, 2] and actual(e, vivas)['B'] == [901000, 2], 'la semana en curso, con todos los que están')
    cambios = paso(e, div('2026-10-26', {}), vivas)
    ok(e['tier'] == {'A': 1, 'B': 1, 'C': 0} and ['2026-10-19', 'A', 0, 1, 17000] in cambios,
       'al cerrar: A y B suben a Plata (el que entró a mitad de semana también suma), C no')
    paso(e, div('2026-11-02', {}), vivas)
    ok(e['tier']['A'] == 0 and e['tier']['B'] == 0 and e['hist'][0][2:4] == [1, 0], 'una semana sin jugar, baja')
    w = para_web(e, vivas)
    ok(w['crews']['A'][0] == 0 and w['nombres'][4] == 'Diamante' and w['colores'][0].startswith('#'), 'lo de la página')
    vivas['crews'].pop()
    paso(e, div('2026-11-09', {}), vivas)
    ok('C' not in e['tier'], 'la crew que se borró sale de la tabla')
    vieja = dict(e)
    ok(paso(e, div('2026-11-02', {'a1': 10 ** 6}), vivas) == [] and e['sem'] == vieja['sem'] and e['tier'] == vieja['tier'],
       'una semana más vieja que la de ahora no cierra nada')
    antes = dict(e['tier'])
    ok(paso(e, div('2026-11-16', {}), {}) == [] and e['tier'] == antes and e['sem'] == '2026-11-09',
       'sin las crews (el objeto no contestó) la semana no se cierra: nadie pierde su tier')
    bien = {'sube': [1, 2, 3, 4, 5, 6], 'baja': [0, 1, 2, 3, 4, 5], 'juegan': [0, 1, 1, 2, 2, 3, 3]}
    ok(reglas_validas(bien) == ((1, 2, 3, 4, 5, 6, None), (None, 0, 1, 2, 3, 4, 5), (0, 1, 1, 2, 2, 3, 3))
       and reglas_validas(dict(bien, sube=[1, 1, 3, 4, 5, 6])) is None and reglas_validas(dict(bien, baja=[0, 9, 9, 9, 9, 9])) is None
       and reglas_validas(dict(bien, juegan=[0, 1])) is None and reglas_validas(dict(bien, sube=[1, 2, 3, 4, 5, '6'])) is None
       and reglas_validas(None) is None, 'los números del Dashboard: crecen, lo de quedarse no pasa lo de subir, y si no, nada')
    print('  ✅ tiers de crews: todo bien' if not mal else '\n  🔴 %d mal' % len(mal))
    return not mal


def main():
    if '--auto' in sys.argv:
        sys.exit(0 if _auto() else 1)
    aplicar = '--aplicar' in sys.argv
    try:
        import multiplicadores as _M
        if usar_reglas(_M.ajustes_dueno()):
            print('   🏆 con los números del Dashboard')
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ los números de los tiers del Dashboard no se leyeron (%s): van los de siempre' % str(e)[:60])
    estado = _json(RUTA, {}) or {}
    estado.pop('_leeme', None)
    div, vivas = _json(DIVISIONES), _json(VIVAS) or {}
    if not div:
        print('   ⚠️ sin divisiones.json: los tiers quedan como estaban')
        return
    if not vivas.get('crews'):
        print('   ⚠️ sin crews_vivas.json: sólo se guarda la foto de la semana (no se cierra ninguna)')
    cambios = paso(estado, div, vivas)
    for sem, cid, de, a, total in cambios:
        print('   🏆 %s: %s %s → %s (%s puntos)' % (sem, cid, TIERS[de][0], TIERS[a][0], format(total, ',').replace(',', '.')))
    if not aplicar:
        act = actual(estado, vivas)
        for cid, (p, j) in sorted(act.items(), key=lambda x: -x[1][0])[:10]:
            print('   %-28s %-9s %9s pts · jugaron %d' % (cid, TIERS[int((estado.get('tier') or {}).get(cid, 0))][0], format(p, ',').replace(',', '.'), j))
        return
    if _escribir(estado):
        print('   🏆 tiers de crews: semana %s%s' % (estado.get('sem'), ' · %d cambios' % len(cambios) if cambios else ''))


if __name__ == '__main__':
    main()
