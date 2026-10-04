# -*- coding: utf-8 -*-
"""EL PRECIO POR CABEZA: la gente pone Puntos de Tienda sobre un rapero, y el que le gana los cobra.

    python bot/precios.py            cómo van, sin escribir nada
    python bot/precios.py --aplicar  resuelve lo cazado y lo vencido, y escribe
                                     datos/precios.json y KV (el ciclo, paso 2b4)
    python bot/precios.py --auto     el self-check, sin red ni archivos

Dlx, 27/09/2026, de las ideas para enganchar (*«me gustan todas»*): *«precio
por tu cabeza: cualquiera pone puntos sobre otro, y el que lo elimina los
cobra»*. A las preguntas: *«1. Pues PUNTOS de TIENDA… que todos empecemos con
5k… 2. A 3. sí 20k»*, y después *«1. Ambos. 2. B»*, con el porqué: *«MW is for
puntos temporada mainly but we need more incentives… for people to get
through the website»*.

LAS REGLAS (los números, acá arriba: Dlx va a rebalancear al final)
------------------------------------------------------------------
- Se pone con **Puntos de Tienda**, no con los de Temporada: nadie baja en el
  ranking por poner un precio. Cada billetera arranca con `INICIAL`.
- **Billetera tiene cualquiera que entre con Discord** (Dlx: *«B»*), con una
  cuenta de más de 30 días: la regla de las encuestas (`EDAD_MIN_DIAS` en
  `bot/avisos.js`).
- Se le pone precio a quien juega la temporada —está en el ranking— y no es
  fuera de concurso, y nadie a sí mismo. Desde `MINIMO`, de a 100; una cabeza
  vale como mucho `TOPE_CABEZA` sumando lo que tiene encima.
- **Lo cobra el primero que le gana** en un evento de la Liga de 8 o más,
  después de que se puso y antes de que termine la semana (el lunes a las 11
  AM ET, la de los multiplicadores). Por equipos se reparte. Es la regla del
  Most Wanted: `most_wanted.primera_derrota()`.
- ⚠️ UN EVENTO QUE YA ESTABA EN MARCHA NO COBRA: cuenta el evento que
  arrancó después de poner el precio. Si no, se podría poner el precio a
  alguien a mitad de llave, sabiendo con quién le toca.
- **El que caza cobra lo mismo en los dos** (Dlx: *«ambos»*): esos Puntos de
  Tienda a su billetera y esos puntos a su Temporada. El Competitivo, nunca.
- **Si nadie lo caza en la semana, vuelve a quien lo puso** (Dlx: *«A»*),
  `GRACIA_H` horas después de que termina: una llave del domingo a la noche
  se procesa el lunes a las 11:22.
- Nadie ve quién puso un precio: se ve cuánto vale cada cabeza.
- Con la temporada las billeteras arrancan de nuevo: lo de la prueba se borra.

DÓNDE VIVE CADA COSA
- La billetera y los precios: el Durable Object de `bot/avisos.js` (tablas
  `precios` y `tienda`). Saldo = `INICIAL` + lo cobrado − lo puesto; lo
  devuelto no cuenta.
- Qué cabezas valen, de quién es cada Discord ID, hasta cuándo y los números:
  el ciclo lo deja en KV (`precios`) y el Worker valida cada precio contra eso
  (`validarPrecio()`). Un solo lugar para los números: éste.
- Quién cazó qué lo calcula el ciclo acá, con las llaves procesadas, y se lo
  pasa al objeto por KV (`precios:resolucion`). Los puntos de Temporada salen
  de `datos/precios.json` (`rankings.sumar_precios()`, como el Most Wanted).

⚠️ QUIEN CAZA SIN DISCORD EN EL PADRÓN cobra igual los puntos de Temporada;
los de Tienda le llegan cuando se sepa su Discord (se vuelven a mandar en cada
corrida, y el objeto los anota una vez).
"""
import datetime as dt
import hashlib
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

SALIDA = os.path.join(BASE, 'datos', 'precios.json')

# ── los números, todos acá ───────────────────────────────────────────────
#: con cuántos Puntos de Tienda arranca cada billetera (Dlx: *«que todos empecemos con 5k»*)
INICIAL = 5000
#: lo mínimo que se pone por vez (y de a cuánto)
MINIMO, PASO = 500, 100
#: lo máximo que vale una cabeza, sumando todo lo que tiene encima (Dlx: *«sí 20k»*)
TOPE_CABEZA = 20000
#: cuánto se espera después del fin de la semana para devolver lo que nadie cazó
GRACIA_H = 12
#: hasta cuántos días atrás se leen los precios (lo más viejo ya quedó resuelto)
DIAS = 30
#: las claves de KV: lo que lee el Worker, y lo que lee el objeto
CLAVE_KV = 'precios'
CLAVE_RES = 'precios:resolucion'


def _iso(t):
    return t.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def _de_ms(ms):
    return dt.datetime.fromtimestamp(int(ms) / 1000, dt.timezone.utc)


def _ms(t):
    return int(t.timestamp() * 1000)


def _arranque():
    """El arranque de la temporada en curso, o `None` en la prueba."""
    from comun.temporada import arranque
    a = arranque()
    a = dt.datetime.fromisoformat(a) if a else None
    return a if a and a <= dt.datetime.now(dt.timezone.utc) else None


# ── a quién se le puede poner precio, y de quién es cada Discord ─────────
def cabezas(pool):
    """Los raperos de la temporada que no son fuera de concurso, en orden."""
    return sorted({p['raw'] for p in pool if p.get('raw') and not p.get('fc')})


def discords(pool):
    """`{rapero: discord_id}` de los que tienen su Discord en el padrón."""
    out = {}
    for p in pool:
        did = str(p.get('discord_id') or '').strip()
        if p.get('raw') and did.isdigit():
            out[p['raw']] = did
    return out


def config(ahora=None, pool=None):
    """Lo que lee el Worker: `{cabezas, yo, fin, desde, inicial, min, paso, tope}`.

    ⚠️ CON DISCORD IDs (`yo`, para que nadie se ponga precio a sí mismo): va
    sólo a KV, nunca al payload de la página.
    """
    import multiplicadores as MU
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    pool = _pool() if pool is None else pool
    _pid, _ini, fin = MU.periodo(ahora)
    a = _arranque()
    return {'cabezas': cabezas(pool), 'yo': {d: r for r, d in discords(pool).items()},
            'fin': _iso(fin), 'desde': _iso(a) if a else '', 'inicial': INICIAL,
            'min': MINIMO, 'paso': PASO, 'tope': TOPE_CABEZA}


def _pool():
    try:
        with io.open(os.path.join(BASE, 'datos', 'temporada_pool.json'), encoding='utf-8') as f:
            return json.load(f) or []
    except (OSError, ValueError):
        return []


# ── quién cazó qué ───────────────────────────────────────────────────────
def leer_precios(intentos=3, espera=2.0):
    """Los precios de los últimos días, sin quién los puso, o `None` si no se pudo."""
    import time
    import requests
    from alertar import WORKER
    for i in range(intentos):
        try:
            r = requests.get(WORKER + '/avisos/precios', timeout=20)
            if r.status_code == 200:
                return (r.json() or {}).get('precios') or []
            print('   ⚠️ los precios: el Worker contestó %s' % r.status_code)
        except (OSError, ValueError) as e:
            print('   ⚠️ los precios: %s' % str(e)[:80])
        if i + 1 < intentos:
            time.sleep(espera * (i + 1))
    return None


def repartir(monto, gente):
    """`[[persona, parte]]`: el monto en partes iguales; lo que sobra, a los primeros."""
    gente = sorted(gente)
    if not gente:
        return []
    base, resto = divmod(int(monto), len(gente))
    return [[g, base + (1 if i < resto else 0)] for i, g in enumerate(gente)]


def resolver(precios, evs, ahora=None):
    """Cada precio con su estado: `activo`, `cazado` (por quién, en qué evento) o `devuelto`.

    `evs` son los de `most_wanted.cargar_todo()`, con su instante, su gente y
    sus rondas. Se recalcula entero en cada corrida, como el Most Wanted: una
    llave que se procesa tarde, o se corrige, cambia la caza.
    """
    import most_wanted as MW
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    evs = sorted(evs, key=lambda e: e['t'])
    out = []
    for p in precios:
        try:
            tp, fin = _de_ms(p['t']), _de_ms(p['fin'])
        except (KeyError, TypeError, ValueError):
            continue
        x = {'id': int(p['id']), 'cabeza': p.get('cabeza') or '', 'monto': int(p.get('monto') or 0),
             't': _iso(tp), 'fin': _iso(fin), 'e': 'activo'}
        for ev in evs:
            # ⚠️ el evento tiene que arrancar DESPUÉS del precio: ver arriba
            if not (tp < ev['t'] <= fin) or ev['part'] < MW.MIN_PARTICIPANTES:
                continue
            caz = MW.primera_derrota(ev, x['cabeza'])
            if caz:
                x.update(e='cazado', por=repartir(x['monto'], caz),
                         ev={'n': ev['n'], 'nombre': ev['nombre'], 'sv': ev['sv'], 't': _iso(ev['t'])})
                break
        if x['e'] == 'activo' and ahora > fin + dt.timedelta(hours=GRACIA_H):
            x['e'] = 'devuelto'
        out.append(x)
    return out


def tienda_mw(mw, dids):
    """`{id: [discord_id, puntos, ms]}`: lo que el Most Wanted paga en Puntos de Tienda.

    🔑 Dlx, 28/09/2026: *«b»*. Al que caza, el `most_wanted.TIENDA` de lo que
    cobró; al que sobrevive, lo mismo de lo que se llevó. Sólo la temporada
    del período de ahora (`most_wanted.periodos()`): con la T1, lo de la
    prueba deja de mandarse y el objeto lo borra.

    ⚠️ SE MANDA ENTERO EN CADA CORRIDA Y EL OBJETO LO REEMPLAZA ENTERO: una
    llave corregida cambia quién cazó, y así nadie cobra dos veces.
    """
    import most_wanted as MW
    out = {}
    for per in MW.periodos(mw or {}):
        for b in per.get('buscados') or []:
            if b.get('caza'):
                c = b['caza']
                t = _de_iso(c.get('t') or per.get('fin'))
                for y in c.get('por') or []:
                    m = int(round((y.get('cobra') or 0) * MW.TIENDA))
                    if m > 0 and y.get('n') in dids and t:
                        out['%s:%s:%s' % (per.get('id'), b['n'], y['n'])] = [dids[y['n']], m, _ms(t)]
            elif b.get('estado') == 'sobrevivio' and b.get('paga'):
                m = int(round(b['paga'] * MW.TIENDA))
                t = _de_iso(per.get('fin'))
                if m > 0 and b['n'] in dids and t:
                    out['%s:%s:sobrevivio' % (per.get('id'), b['n'])] = [dids[b['n']], m, _ms(t)]
    return out


def para_objeto(res, dids, mw=None, jugo=None, rcfg=None, div=None):
    """Lo que lee el objeto: `{v, r: {id: {e, t, por: [[discord_id, parte]]}}, mw: {…}, jugo, rcfg}`.

    Sólo lo resuelto (cazado o devuelto). Quien cazó sin Discord conocido no
    va todavía: le llega cuando se sepa. `mw` es lo que el Most Wanted paga
    en Tienda (`tienda_mw()`). `v` es la huella, para que el objeto no lo
    vuelva a aplicar si no cambió.

    🔥 `jugo` y `rcfg` son de la racha diaria y los niveles (`bot/racha.py`):
    quién jugó qué días y los números. Viajan por acá porque es el camino que
    el ciclo ya tiene hacia el objeto, y la racha también paga Tienda.

    🏟️ `div` es lo que pagan las subidas de división (`divisiones.tienda()`):
    entero en cada corrida, como el MW.
    """
    r = {}
    for x in res:
        if x['e'] == 'cazado':
            t = int(_de_iso(x['ev']['t']).timestamp() * 1000)
            r[str(x['id'])] = {'e': 'cazado', 't': t,
                               'por': [[dids[n], m] for n, m in x['por'] if n in dids]}
        elif x['e'] == 'devuelto':
            r[str(x['id'])] = {'e': 'devuelto', 'por': []}
    m = tienda_mw(mw, dids) if mw is not None else {}
    v = hashlib.sha1(json.dumps([r, m, jugo, rcfg, div], sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:16]
    out = {'v': v, 'r': r, 'mw': m}
    if jugo is not None:
        out['jugo'] = jugo
    if rcfg is not None:
        out['rcfg'] = rcfg
    if div is not None:
        out['div'] = div
    return out


def _de_iso(s):
    return dt.datetime.fromisoformat(str(s).replace('Z', '+00:00'))


def suma(res, desde=None):
    """`{rapero: puntos}`: lo cobrado cazando, para la Temporada (Dlx: *«ambos»*).

    Sólo lo de la temporada en curso: con `desde` (el arranque), lo cazado
    antes no cuenta —lo de la prueba se borra—.
    """
    out = {}
    for x in res:
        if x['e'] != 'cazado':
            continue
        if desde and _de_iso(x['ev']['t']) < desde:
            continue
        for n, m in x['por']:
            out[n] = out.get(n, 0) + m
    return out


def leer(ruta=None):
    """`datos/precios.json`, o `{}`."""
    try:
        with io.open(ruta or SALIDA, encoding='utf-8') as f:
            return json.load(f) or {}
    except (OSError, ValueError):
        return {}


def correr(ahora=None, aplicar=False, precios=None, datos=None):
    """Resuelve los precios y devuelve lo que va a `datos/precios.json`.

    ⚠️ SI NO SE PUEDEN LEER LOS PRECIOS NO ESCRIBE NADA y devuelve `None`:
    un archivo vacío le sacaría a todos lo cobrado por una corrida.
    """
    import most_wanted as MW
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    precios = leer_precios() if precios is None else precios
    if precios is None:
        print('   ⚠️ no pude leer los precios: queda lo de la corrida anterior')
        return None
    pool, evs, _R = datos or MW.cargar_todo()
    res = resolver(precios, evs, ahora)
    a = _arranque()
    out = {'_leeme': 'El precio por cabeza: lo arma bot/precios.py en el ciclo (paso 2b4). Las '
                     'reglas y los números viven en ese archivo.',
           'precios': res, 'suma': suma(res, a)}
    if aplicar:
        with io.open(SALIDA, 'w', encoding='utf-8') as f:
            json.dump(out, f, ensure_ascii=False, indent=1)
        _subir(config(ahora, pool), CLAVE_KV, 'lo que valida el Worker')
        # 🔑 y lo que el Most Wanted paga en Tienda (Dlx: «b»), por el mismo camino. 🔥 Y quién jugó qué
        # días, para la racha diaria y los niveles (`bot/racha.py`)
        # 🏟️ y lo que pagan las subidas de división (`bot/divisiones.py`)
        import racha as RA
        import divisiones as DV
        dids = discords(pool)
        import multiplicadores as MU
        o = RA.origen(ahora)
        _subir(para_objeto(res, dids, MW.leer(), RA.jugo(evs, dids, o), RA.config(o, MU.temporada_actual(ahora)),
                           DV.tienda(DV.leer(), dids)),
               CLAVE_RES, 'lo cazado, lo devuelto, el MW, los días jugados y las subidas de división')
    return out


def _subir(valor, clave, que):
    """A KV con el diff-writer de la web: sólo si cambió."""
    try:
        import subir_web as SW
        ok = SW.subir(valor, solo_si_cambio=True, clave=clave)
        print('   %s' % ('✓ %s: igual' % que if ok is None else '✅ %s: subido (%s)' % (que, clave)
                         if ok else '🔴 %s: no pude subirlo' % que))
    except Exception as e:                               # noqa: BLE001
        print('   🔴 %s: %s' % (que, str(e)[:80]))


# ── self-check ───────────────────────────────────────────────────────────
def _self_check():
    print('\n══ EL PRECIO POR CABEZA ══\n')
    mal = 0

    def ok(c, que):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '🔴', que))

    import most_wanted as MW

    class _R:
        def lado(self, s):
            return [m.strip() for m in str(s).split(',') if m.strip()]

    def ev(n, t, rondas, part=16):
        R = _R()
        return {'n': n, 't': t, 'nombre': 'E%d' % n, 'sv': 'FFA', 'part': part, 'fase': {},
                'rondas': [[([R.lado(s) for s in b[0]], set(R.lado(b[1])), b[2] if len(b) > 2 else '')
                            for b in bs] for bs in rondas]}
    t0 = dt.datetime(2026, 10, 13, 15, tzinfo=dt.timezone.utc)
    h = lambda x: t0 + dt.timedelta(hours=x)
    fin = h(24 * 6)
    evs = [ev(1, h(-1), [[[['Ana', 'Bea'], 'Bea']]]),                     # antes del precio
           ev(2, h(5), [[[['Ana', 'Cid'], 'Ana']], [[['Ana', 'Dan'], 'Dan']]]),
           ev(3, h(8), [[[['Ana, Eli', 'Fer, Gus'], 'Fer, Gus']]]),
           ev(4, h(9), [[[['Zoe', 'Bea'], 'Bea']]], part=4)]              # chico: no cuenta
    P = lambda i, cabeza, monto, t, f=fin: {'id': i, 'cabeza': cabeza, 'monto': monto,
                                            't': _ms(t), 'fin': _ms(f), 'estado': ''}
    precios = [P(1, 'Ana', 3000, t0), P(2, 'Ana', 1000, h(6)), P(3, 'Zoe', 2000, t0),
               P(4, 'Cid', 1500, h(-200), h(-150)), P(5, 'Hal', 500, h(1))]
    res = {x['id']: x for x in resolver(precios, evs, h(10))}
    ok(res[1]['e'] == 'cazado' and res[1]['por'] == [['Dan', 3000]] and res[1]['ev']['n'] == 2,
       'lo cobra el primero que le gana después del precio (Dan, no Bea, que fue antes)')
    ok(res[2]['e'] == 'cazado' and res[2]['por'] == [['Fer', 500], ['Gus', 500]],
       'el de después lo cobra el evento siguiente; por equipos, se reparte')
    ok(res[3]['e'] == 'activo', 'un evento de menos de 8 no cuenta')
    ok(res[4]['e'] == 'devuelto' and res[5]['e'] == 'activo',
       'lo que venció sin que lo cacen vuelve (con %d h de gracia); lo de esta semana sigue' % GRACIA_H)
    ok(resolver([P(6, 'Ana', 1000, h(4.9))], [ev(9, h(4.9), [[[['Ana', 'Cid'], 'Cid']]])], h(10))[0]['e']
       == 'activo', 'un evento que arrancó a la vez que el precio no lo cobra (a mitad de llave, no)')
    ok(repartir(1000, ['c', 'a', 'b']) == [['a', 334], ['b', 333], ['c', 333]] and repartir(5, []) == [],
       'el reparto es parejo, y lo que sobra va a los primeros')
    sm = suma(list(res.values()))
    ok(sm == {'Dan': 3000, 'Fer': 500, 'Gus': 500}, 'lo cobrado suma a la Temporada, lo mismo  %s' % sm)
    ok(suma(list(res.values()), desde=h(6)) == {'Fer': 500, 'Gus': 500},
       'y sólo lo de la temporada en curso')
    po = para_objeto(list(res.values()), {'Dan': '111111111111111111', 'Fer': '222222222222222222'})
    ok(po['r']['1'] == {'e': 'cazado', 't': _ms(h(5)), 'por': [['111111111111111111', 3000]]}
       and po['r']['2']['por'] == [['222222222222222222', 500]] and po['r']['4'] == {'e': 'devuelto', 'por': []}
       and '3' not in po['r'] and '5' not in po['r'],
       'al objeto va lo resuelto; quien cazó sin Discord conocido (Gus) no, todavía')
    ok(para_objeto(list(res.values()), {})['v'] != po['v'], 'y cambia la huella si cambia algo')
    # 🔑 el Most Wanted también paga Tienda: el 10 % (Dlx: «b»)
    D1, D2 = '111111111111111111', '222222222222222222'
    mwd = {'actual': {'id': 'p1', 'temporada': 'prueba', 'fin': '2026-10-19T15:00:00Z', 'buscados': [
        {'n': 'Bea', 'estado': 'cazado', 'caza': {'t': '2026-10-13T22:00:00Z',
                                                  'por': [{'n': 'Dan', 'cobra': 9500}, {'n': 'Gus', 'cobra': 9500}]}},
        {'n': 'Fer', 'estado': 'sobrevivio', 'paga': 3000}, {'n': 'Hal', 'estado': 'escondio'}]}}
    tm = tienda_mw(mwd, {'Dan': D1, 'Fer': D2})
    ok(tm == {'p1:Bea:Dan': [D1, 950, _ms(_de_iso('2026-10-13T22:00:00Z'))],
              'p1:Fer:sobrevivio': [D2, 300, _ms(_de_iso('2026-10-19T15:00:00Z'))]},
       'el Most Wanted paga el %d %% en Tienda, al que caza y al que sobrevive (sin Discord conocido, todavía no)'
       % round(MW.TIENDA * 100))
    po2 = para_objeto([], {'Dan': D1, 'Fer': D2}, mwd)
    ok(po2['mw'] == tm and po2['v'] != para_objeto([], {'Dan': D1, 'Fer': D2})['v'],
       'y viaja con lo de los precios, cambiando la huella')
    pool = [{'raw': 'Ana', 'discord_id': '123456789012345678'}, {'raw': 'Bea', 'fc': True},
            {'raw': 'Cid', 'discord_id': ''}]
    ok(cabezas(pool) == ['Ana', 'Cid'] and discords(pool) == {'Ana': '123456789012345678'},
       'se le pone precio a los de la temporada que no son fuera de concurso')
    c = config(t0, pool)
    ok(c['yo'] == {'123456789012345678': 'Ana'} and c['inicial'] == INICIAL and c['tope'] == TOPE_CABEZA
       and c['fin'] == '2026-10-19T15:00:00Z',
       'el Worker recibe los números y hasta cuándo: el lunes a las 11 AM ET  (%s)' % c['fin'])
    ok(MW.MIN_PARTICIPANTES == 8, 'la misma regla de 8 que el Most Wanted')
    print('\n   %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return mal


def main():
    a = sys.argv[1:]
    if '--auto' in a:
        return 1 if _self_check() else 0
    out = correr(aplicar='--aplicar' in a)
    if out is None:
        return 0
    print('\n══ EL PRECIO POR CABEZA ══\n')
    for x in out['precios'][-15:]:
        print('   #%-4s %-18s %6d  %-8s %s' % (x['id'], x['cabeza'][:18], x['monto'], x['e'],
                                            ', '.join('%s %d' % tuple(p) for p in x.get('por') or [])))
    print('\n   %d precios · a la Temporada: %s' % (len(out['precios']), out['suma'] or '—'))
    if '--aplicar' not in a:
        print('   (simulacro: no escribí nada — `--aplicar`)')
    print('')
    return 0


if __name__ == '__main__':
    raise SystemExit(main() or 0)
