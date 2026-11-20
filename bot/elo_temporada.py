# -*- coding: utf-8 -*-
"""🪨 EL ELO DE TEMPORADA Y EL HISTÓRICO, PARA LA T2.

    python bot/elo_temporada.py              la T1 rehecha con estas reglas (sólo lee): los números del diseño
    python bot/elo_temporada.py --ver Oasis  el de una persona: puntos, piedra, histórico y sus últimas batallas
    python bot/elo_temporada.py --auto       self-check, sin red ni archivos

EL DISEÑO ENTERO ESTÁ EN `docs/elo_temporada.md` (Dlx, 20/11/2026, pieza por pieza y medido sobre la T1). Este archivo
lo implementa y no decide nada: si un número cambia, cambia primero allá.

🔑 DOS NÚMEROS, DOS TRABAJOS. Dlx: *«el competitivo ya dice quiénes son los mejores en general, pero con esto veremos
quiénes son los mejores en sus respectivos niveles, y esa es la meta»*.
- El **HISTÓRICO** mide el nivel de verdad y no se reinicia nunca: arma los cruces, el pronóstico, la nota y el 1v1. Es
  el Elo de `bot/elo.py` con los dos arreglos medidos sobre la T1 —las batallas de 3 o más con un ganador cuentan, el
  ganador contra cada uno con medio K, y K 48 en las primeras 10 batallas de cada uno y 24 después— y junta TODAS las
  temporadas (`todas_las_llaves()`).
- El **DE TEMPORADA** es la escalera de la temporada, como el ranked de Brawl: arranca en 0 (o en lo que deja el
  reinicio), nunca baja de 0, y de él salen las piedras.

⚠️ NO TOCA LA T1. Las piedras de la T1 salen de `bot/elo.py` por `bot/divisiones.py` y sus subidas ya se cobraron:
esto se prende recién con la T2, después de la gala (ver «Cómo se prende», en `docs/elo_temporada.md` §8).

LAS REGLAS DEL DE TEMPORADA (los números viven acá arriba)
- Cada batalla que cuenta es un **traspaso**: lo que suma el que gana lo resta el que pierde.

      lo que se juega = K × (1 − la chance del que ganó, POR EL ELO DE TEMPORADA) × ronda × nivel × tamaño × veredicto

  Adentro de tu piedra cada victoria vale parecido, unos 15 (Dlx: *«Sí, la A»*). En una de 3 o más, el ganador contra
  cada uno con la mitad.
- **El área** (Dlx: *«el ELO se sube y se baja solamente cuando luchas con personas de tu misma piedra»*, y *«la
  anterior que esté en rangos altos, Hierro 2 y Hierro 3, y para el siguiente Oro 1 y Oro 2»*): toda tu piedra, II y III
  de la anterior, I y II de la siguiente; Mítico, toda Diamante. Cuenta cuando **cada uno está en la lista del otro**.
  Si pasa `SEMANA` días sin que te toque nadie de tu piedra, se te abre entera la de al lado —el doble, dos— hasta que te
  toque alguien de la tuya; al cambiar de piedra, el reloj arranca de nuevo (*«Sí, las dos»*). Vale la piedra de cada
  uno **al empezar la noche**: la noche se cierra entera al final.
- **La noche**: llegar a la final nunca resta; el campeón suma al menos `PISO_CAMPEON` si peleó con alguien de su área.
  Abajo de todo perder resta menos (`PROTECCION`: en Hierro nada, en Jade y Zafiro la mitad).
- **Lo de la noche** —campeón, MVP, 🔥 Batacazo y la racha desde la 3.ª victoria seguida—, × lo esperado (paga menos si
  eras mucho más fuerte que el resto del evento), y **sólo si esa noche peleaste con alguien de tu área**: la racha
  cuenta sólo las batallas del área. El MVP y el 🔥 son los de `bot/notas.py`, los mismos que ve la gente.
- **Las piedras** crecen de a 5 (*«Sí, la suave»*): `UMBRALES`, cada una en tercios I · II · III.
- **El reinicio** según la piedra más alta de la temporada (*«Sí, el borrador»*): `REINICIO`. La primera vez, de la T1
  a la T2, desde el piso de la piedra más alta que cada uno vio en las divisiones de la T1 (`PRIMERA_VEZ`).
- Faltan, porque todavía no existen: el 1v1 ranked (×`FORMATO_1V1`) y lo que votaba el público.
"""
import collections
import datetime as dt
import glob
import io
import json
import math
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

# ── el de temporada ──────────────────────────────────────────────────────
#: una batalla pareja: ±K/2
K = 30.0
ESCALA = 400.0
#: la final pesa más que unos octavos
RONDA = {'Cuartos': 1.1, 'Semifinales': 1.2, 'Semifinal': 1.2, 'Final': 1.3}
#: el tamaño del evento: de 4 a 16 o más
TAMANO = (0.85, 1.25)
#: el veredicto, con 2 jurados o más (`notas.VOTOS_MIN`)
UNANIME, DIVIDIDO = 1.2, 0.8
#: el 1v1 ranked, cuando exista: una batalla más larga se juega más (Dlx: «Sí, ×1,5»)
FORMATO_1V1 = 1.5
#: lo de la noche
CAMPEON, MVP, BATACAZO = 15.0, 8.0, 6.0
#: la racha: +RACHA, +2·RACHA, +3·RACHA desde la RACHA_DESDE-ésima victoria seguida
RACHA, RACHA_DESDE, RACHA_TOPE = 2.0, 3, 3
#: salir campeón suma al menos esto (si peleó con alguien de su área)
PISO_CAMPEON = 5.0
#: lo de la noche paga entre esto y 1 según lo esperado
FAV_MIN = 0.3
#: de abajo arriba (`bot/divisiones.py` las tiene de arriba abajo)
PIEDRAS = ('Hierro', 'Jade', 'Zafiro', 'Rubí', 'Diamante', 'Mítico')
#: dónde empieza cada piedra: crecen de a 5, 65 · 70 · 75 · 80 · 85 (Mítico, sin techo)
UMBRALES = (0, 65, 135, 210, 290, 375)
#: cuánto resta perder en cada piedra
PROTECCION = (0.0, 0.5, 0.5, 1.0, 1.0, 1.0)
#: días sin rival de tu piedra para que se te abra la de al lado (el doble, dos), y como mucho cuántas: el diseño dice
#: «una semana, la de al lado; dos semanas, dos piedras» y nada más
SEMANA, ABIERTA_TOPE = 7, 2
#: el reinicio: piedra más alta → (cuánto te quedas, el piso: el comienzo de esa piedra, o None)
REINICIO = {5: (0.6, 3), 4: (0.55, 2), 3: (0.5, 1), 2: (0.4, None)}
#: la primera vez (de la T1 a la T2): piedra más alta en las divisiones de la T1 → la piedra desde cuyo piso se arranca
PRIMERA_VEZ = {5: 3, 4: 2, 3: 1}
#: cuántas batallas de cada uno viajan con su +/−, como `bot/elo.py`
ULTIMAS = 3
#: «activo»: jugó en los últimos 30 días
ACTIVO_DIAS = 30

# ── el histórico ─────────────────────────────────────────────────────────
H_INI = 1000.0
H_K_NUEVO, H_K, H_NUEVO = 48.0, 24.0, 10

MITICO = len(PIEDRAS) - 1


def piedra(x):
    """0 (Hierro) a 5 (Mítico)."""
    s = 0
    for i, u in enumerate(UMBRALES):
        if x >= u:
            s = i
    return s


def ancho(s):
    """Lo que mide una piedra; Mítico, que no tiene techo, se mide como la anterior para sus subniveles."""
    return UMBRALES[s + 1] - UMBRALES[s] if s + 1 < len(UMBRALES) else UMBRALES[-1] - UMBRALES[-2]


def subnivel(x):
    """0, 1 o 2 (I, II, III): en qué tercio de su piedra está. Mítico se queda en III."""
    s = piedra(x)
    return max(0, min(2, int((max(0.0, x) - UMBRALES[s]) // (ancho(s) / 3.0))))


def escalon(x):
    """De 0 (Hierro I) a 17 (Mítico III), como `divisiones.escalon()`."""
    return 3 * piedra(x) + subnivel(x)


def lista(s):
    """Con quién juega una piedra: toda la suya, II y III de la anterior, I y II de la siguiente; Mítico, toda Diamante."""
    out = {(s, 0), (s, 1), (s, 2)}
    if s == MITICO:
        return out | {(s - 1, 0), (s - 1, 1), (s - 1, 2)}
    if s > 0:
        out |= {(s - 1, 1), (s - 1, 2)}
    return out | {(s + 1, 0), (s + 1, 1)}


def en_area(a, b):
    """¿Cuenta una batalla entre alguien con `a` puntos y alguien con `b`? Lo que gana uno lo pierde el otro, así que
    tiene que valer para los dos: cada uno en la lista del otro."""
    ea, eb = (piedra(a), subnivel(a)), (piedra(b), subnivel(b))
    if ea[0] == eb[0] or {ea[0], eb[0]} == {MITICO, MITICO - 1}:
        return True
    return eb in lista(ea[0]) and ea in lista(eb[0])


def esperado(a, b):
    """La chance de ganar del de `a` contra el de `b`."""
    return 1.0 / (1.0 + 10 ** ((b - a) / ESCALA))


def tamano(n):
    """×0,85 a ×1,25 según cuántos jugaron (16 es ×1)."""
    return max(TAMANO[0], min(TAMANO[1], 1 + 0.1 * math.log2(max(4, n or 16) / 16.0)))


def lo_esperado(h, nivel):
    """× entre `FAV_MIN` y 1: lo de la noche paga menos si eras mucho más fuerte (en el histórico) que el resto."""
    return 1.0 if nivel is None else max(FAV_MIN, min(1.0, 1 - (h - nivel) / 400.0))


def reinicio(pts, mas_alta):
    """Con cuánto arranca la temporada que viene quien terminó con `pts` y llegó como mucho a la piedra `mas_alta`."""
    m, piso = REINICIO.get(mas_alta, (0.0, None))
    x = pts * m
    return float(max(x, UMBRALES[piso]) if piso is not None else x)


def primera_vez(escalon_mas_alto):
    """La T1 no tuvo ELO de temporada: se arranca del piso de la piedra más alta que se vio en sus divisiones
    (`divisiones.json` → `mejor`, de 0 = Hierro I a 17 = Mítico III)."""
    s = min(MITICO, max(0, int(escalon_mas_alto)) // 3)
    p = PRIMERA_VEZ.get(s)
    return float(UMBRALES[p]) if p is not None else 0.0


def prendido(temp=None):
    """¿Las piedras salen de acá? Desde la T2. La T1 sigue con `bot/elo.py` hasta su cierre: con eso se cobraron sus
    subidas y con eso se paga su premio de fin de temporada."""
    from comun import temporada as T
    return (temp or T.ACTUAL) != 't1'


def inicio(temp=None):
    """El primer día de la temporada (`comun/temporada.FECHAS`), o `None` si no está."""
    from comun import temporada as T
    f = T.FECHAS.get(temp or T.ACTUAL)
    return dt.date.fromisoformat(f[0]) if f else None


def ruta_arranque(temp, base=BASE):
    return os.path.join(base, 'datos', '%s_elo_arranque.json' % temp)


def _leer(ruta):
    try:
        with io.open(ruta, encoding='utf-8') as f:
            return json.load(f) or {}
    except (OSError, ValueError):
        return {}


def arranque(temp=None, base=BASE):
    """`{clave: puntos}` con los que arrancó la temporada (`datos/<temp>_elo_arranque.json`, lo deja el cambio de
    temporada); sin el archivo, todos en 0."""
    from comun import temporada as T
    return {k: float(v) for k, v in (_leer(ruta_arranque(temp or T.ACTUAL, base)).get('pts') or {}).items()}


def arranque_de(de, base=BASE, divisiones=None, llaves=None):
    """`{clave: puntos}` con los que arranca la temporada que viene después de `de`. Sin ELO de temporada en `de` (la
    T1), desde el piso de la piedra más alta de sus divisiones (`datos/divisiones.json` → `mejor`); con él, el reinicio
    según cómo terminó cada uno y su piedra más alta. Sólo los que arrancan arriba de 0."""
    import competencias as CO
    if not prendido(de):
        d = divisiones if divisiones is not None else _leer(os.path.join(base, 'datos', 'divisiones.json'))
        out = {}
        for q, e in (d.get('mejor') or {}).items():
            k, x = CO.norm(q), primera_vez(e)
            if k and x > out.get(k, 0.0):
                out[k] = x
        return {k: v for k, v in sorted(out.items()) if v > 0}
    from comun import temporada as T
    f = T.FECHAS.get(de)
    if not f:
        return {}
    r = calcular(llaves if llaves is not None else todas_las_llaves(base), desde=dt.date.fromisoformat(f[0]),
                 hasta=dt.date.fromisoformat(f[1]) + dt.timedelta(days=1), arranque=arranque(de, base))
    out = {k: round(reinicio(v['pts'], v['max']), 1) for k, v in r['temp'].items()}
    return {k: v for k, v in sorted(out.items()) if v > 0}


def guardar_arranque(nueva, de, base=BASE, aplicar=False):
    """El cambio de temporada (`sheet/espejo_t1.py --nueva-temporada`): con qué arranca cada uno la `nueva`, a
    `datos/<nueva>_elo_arranque.json`. Nunca pisa uno que ya exista. Devuelve los puntos."""
    pts = arranque_de(de, base)
    ruta = ruta_arranque(nueva, base)
    if aplicar and not os.path.exists(ruta):
        os.makedirs(os.path.dirname(ruta), exist_ok=True)
        with io.open(ruta, 'w', encoding='utf-8', newline='\n') as f:
            json.dump({'_leeme': 'Con cuántos puntos de ELO de temporada arranca cada uno la %s, según cómo terminó la %s '
                                 '(bot/elo_temporada.py: REINICIO, y la primera vez PRIMERA_VEZ). Lo deja el cambio de '
                                 'temporada y no se toca después.' % (nueva.upper(), de.upper()),
                       'de': de, 'pts': pts}, f, ensure_ascii=False, indent=1, sort_keys=True)
            f.write('\n')
    return pts


def todas_las_llaves(base=BASE):
    """Las llaves de todas las temporadas (`datos/llaves_t*.json`), juntas: el número de evento no se repite entre
    temporadas (el contador sigue), así que una llave que esté en dos archivos es la misma."""
    out = {}
    for ruta in sorted(glob.glob(os.path.join(base, 'datos', 'llaves_t*.json'))):
        try:
            with io.open(ruta, encoding='utf-8') as f:
                out.update(json.load(f) or {})
        except (OSError, ValueError):
            continue
    return out


def _dia(ev):
    try:
        return dt.date.fromisoformat(str(ev.get('dia') or '')[:10])
    except ValueError:
        return None


def _batallas(ev, votos, NO, norm):
    """`[(ronda, ganador, [perdedores], veredicto)]` de un evento, con las claves de hoy. Lo que no se peleó, los
    equipos y lo que no tiene ganador no son batallas."""
    out = []
    for rd in ev.get('rondas') or []:
        mr = RONDA.get(rd.get('r') or '', 1.0)
        for b in rd.get('b') or []:
            try:
                lados, gana, nota = b[0], b[1], str(b[2] or '').lower()
            except (IndexError, TypeError):
                continue
            if not isinstance(lados, list):
                continue
            lados = [x for x in lados if x]
            if len(lados) < 2 or not gana or gana not in lados or any(x in nota for x in NO.NO_PELEO) \
                    or any(NO.es_equipo(x) for x in lados):
                continue
            vs = NO.veredicto(votos, lados, ev.get('dia')) if votos else None
            tot = sum(vs.values()) if vs else 0
            vg = vs.get(NO._norm(gana), 0) if vs else 0
            mv = (UNANIME if vg == tot else DIVIDIDO) if (tot >= NO.VOTOS_MIN and vg * 2 > tot) else 1.0
            out.append((mr, norm(gana), [norm(x) for x in lados if x != gana], mv))
    return out


def historico(llaves, hasta=None):
    """El ELO HISTÓRICO solo (sin el de temporada), con las llaves de antes de `hasta`: una fecha (`date`: los eventos de
    antes de ese día) o un instante (`datetime`: como `competencias.cruces()`, el evento cuenta a las 16 UTC de su día).
    Devuelve `(elos, fuerzas)`: `elos` es lo que da `elo.calcular()` —`{clave: {'elo', 'n', 'h'}}`— y `fuerzas` lo que
    da `notas.fuerzas()` —`{n: {'nivel', 'pre'}}`: el nivel de cada evento al empezar y el ELO de cada 1v1 justo antes—.
    Desde la T2 los dos los sacan de acá (`prendido()`)."""
    import competencias as CO
    import notas as NO
    norm = CO.norm
    orden = sorted(llaves, key=lambda n: (str((llaves[n] or {}).get('dia') or ''), int(n) if str(n).isdigit() else 0))
    hist, nb, h_ult, fz = {}, collections.Counter(), collections.defaultdict(list), {}
    for n in orden:
        ev = llaves[n] or {}
        hoy = _dia(ev)
        if hoy is None:
            continue
        if isinstance(hasta, dt.datetime):
            if dt.datetime(hoy.year, hoy.month, hoy.day, 16, tzinfo=dt.timezone.utc) >= hasta:
                continue
        elif hasta and hoy >= hasta:
            continue
        gente = {norm(p) for nombre, _pu, _x in ev.get('tabla') or [] for p in NO.personas(nombre)} - {''}
        nivel = sum(hist.get(q, H_INI) for q in gente) / len(gente) if gente else None
        pre = {}
        for _mr, g, pierden, _mv in _batallas(ev, None, NO, norm):
            medio = 0.5 if len(pierden) > 1 else 1.0
            for p in pierden:
                eg, ep = hist.get(g, H_INI), hist.get(p, H_INI)
                if len(pierden) == 1:
                    pre.setdefault((g, p), []).append((eg, ep))
                e = esperado(eg, ep)
                dg = (H_K_NUEVO if nb[g] < H_NUEVO else H_K) * medio * (1 - e)
                dp = (H_K_NUEVO if nb[p] < H_NUEVO else H_K) * medio * (1 - e)
                hist[g], hist[p] = eg + dg, ep - dp
                h_ult[g].append([int(round(dg)), p, str(n)])
                h_ult[p].append([-int(round(dp)), g, str(n)])
            for q in [g] + pierden:
                nb[q] += 1
        fz[str(n)] = {'nivel': nivel, 'pre': pre}
    elos = {k: {'elo': int(round(v)), 'n': nb[k], 'h': h_ult[k][::-1][:ULTIMAS]} for k, v in hist.items()}
    return elos, fz


def calcular(llaves, desde=None, hasta=None, arranque=None, cortes=(), fz=None, votos=None, por_evento=False):
    """El histórico (con todas las llaves de antes de `hasta`) y el de temporada (con las de `desde` en adelante,
    arrancando de `arranque`: `{clave: puntos}`).

    `desde` y `hasta` son fechas (`date`). `cortes` son fechas en las que se guarda cómo estaba el de temporada justo
    antes de ese día (para las semanas de `bot/divisiones.py`): `out['cortes'][fecha] = {clave: {'elo', 'n', 'h'}}`.
    `fz` y `votos` son los de `notas.fuerzas()` y `notas.indice_votos()` (sin ellos, se calculan). Con `por_evento`,
    `out['por_evento'][n] = {clave: (antes, después)}`: el de temporada de cada uno al empezar esa noche y al cerrarla,
    con lo de la noche adentro (lo que muestra «La noche de…», `bot/noche.py`)."""
    import competencias as CO
    import notas as NO
    norm = CO.norm
    fz = NO.fuerzas(llaves) if fz is None else fz
    votos = NO.indice_votos() if votos is None else votos
    orden = sorted(llaves, key=lambda n: (str((llaves[n] or {}).get('dia') or ''), int(n) if str(n).isdigit() else 0))
    hist, nb = {}, collections.Counter()
    pts = {k: float(v) for k, v in (arranque or {}).items()}
    ultima, ult_misma, maxp = {}, {}, {k: piedra(v) for k, v in pts.items()}
    racha, btot, bcon = collections.Counter(), collections.Counter(), collections.Counter()
    h_ult = collections.defaultdict(list)
    pendientes = sorted(set(cortes))
    snaps, fin, noches = {}, None, {}

    def foto():
        return {k: {'elo': int(round(v)), 'n': btot[k], 'h': h_ult[k][::-1][:ULTIMAS]} for k, v in pts.items()}

    for n in orden:
        ev = llaves[n] or {}
        hoy = _dia(ev)
        if hoy is None or (hasta and hoy >= hasta):
            continue
        while pendientes and hoy >= pendientes[0]:
            snaps[pendientes.pop(0)] = foto()
        temporada = desde is None or hoy >= desde
        bats = _batallas(ev, votos if temporada else None, NO, norm)
        gente = {norm(p) for nombre, _pu, _x in ev.get('tabla') or [] for p in NO.personas(nombre)} - {''}
        h0 = {q: hist.get(q, H_INI) for q in gente}
        nivel = sum(h0.values()) / len(h0) if h0 else None
        if temporada:
            fin = hoy
            mn = NO._mult_nivel(nivel)
            mt = tamano(ev.get('participantes') or len(gente))
            jugaron = gente | {x for _mr, g, ps, _mv in bats for x in [g] + ps}
            for q in jugaron:
                ultima[q] = hoy
                ult_misma.setdefault(q, hoy)
                pts.setdefault(q, 0.0)
            al_empezar = {q: pts[q] for q in jugaron} if por_evento else None
            s_ini = {q: piedra(pts.get(q, 0.0)) for q in gente}

            def abierta(q):
                d0 = ult_misma.get(q)
                return 0 if d0 is None else min(ABIERTA_TOPE, (hoy - d0).days // SEMANA)
            dn, en, misma = collections.Counter(), set(), set()
        for mr, g, pierden, mv in bats:
            medio = 0.5 if len(pierden) > 1 else 1.0
            conto = False
            for p in pierden:
                eg, ep = hist.get(g, H_INI), hist.get(p, H_INI)
                e = esperado(eg, ep)
                if temporada:
                    sg, sp = pts.get(g, 0.0), pts.get(p, 0.0)
                    btot[g] += 1
                    btot[p] += 1
                    dd = abs(piedra(sg) - piedra(sp))
                    if dd == 0:
                        misma.update((g, p))
                    if en_area(sg, sp) or dd <= max(abierta(g), abierta(p)):
                        d = K * medio * (1 - esperado(sg, sp)) * mr * mn * mt * mv
                        dn[g] += d
                        dn[p] -= d
                        en.update((g, p))
                        bcon[g] += 1
                        bcon[p] += 1
                        h_ult[g].append([int(round(d)), p])
                        h_ult[p].append([-int(round(d)), g])
                        racha[p] = 0
                        conto = True
                kg = (H_K_NUEVO if nb[g] < H_NUEVO else H_K) * medio
                kp = (H_K_NUEVO if nb[p] < H_NUEVO else H_K) * medio
                hist[g], hist[p] = eg + kg * (1 - e), ep - kp * (1 - e)
            if temporada and conto:
                racha[g] += 1
                if racha[g] >= RACHA_DESDE:
                    dn[g] += RACHA * min(racha[g] - RACHA_DESDE + 1, RACHA_TOPE) * lo_esperado(h0.get(g, H_INI), nivel)
            for q in [g] + pierden:
                nb[q] += 1
        if not temporada:
            continue
        puestos = {norm(nombre): puesto for nombre, puesto, _x in ev.get('tabla') or [] if not NO.es_equipo(nombre)}
        for q, d in dn.items():
            pu = puestos.get(q, '')
            if pu == 'Subcampeón':
                d = max(d, 0.0)
            elif pu == 'Campeón' and q in en:
                d = max(d, PISO_CAMPEON)
            x = pts.get(q, 0.0)
            pts[q] = x + (d if d >= 0 else -min(x, -d * PROTECCION[piedra(x)]))
        notas, mvp = NO.nota_evento(ev, fz.get(str(n)), votos)
        bat = NO.batacazo(notas)
        solos = set(puestos)
        for q, pu in puestos.items():
            if pu == 'Campeón' and q in en:
                pts[q] = pts.get(q, 0.0) + CAMPEON * mn * mt * lo_esperado(h0.get(q, H_INI), nivel)
        for nombre, extra in ((mvp, MVP), ((bat or [''])[0], BATACAZO)):
            q = norm(nombre or '')
            if q and q in solos and q in en:
                pts[q] = pts.get(q, 0.0) + extra * lo_esperado(h0.get(q, H_INI), nivel)
        for q in gente:
            s = piedra(pts.get(q, 0.0))
            maxp[q] = max(maxp.get(q, 0), s)
            if s != s_ini.get(q):
                ult_misma[q] = hoy
        for q in misma:
            ult_misma[q] = hoy
        if por_evento:
            noches[str(n)] = {q: (a, pts.get(q, 0.0)) for q, a in al_empezar.items()}
    for c in pendientes:
        snaps[c] = foto()
    activos = {q for q, d in ultima.items() if fin and (fin - d).days <= ACTIVO_DIAS}
    return {'hist': {k: {'elo': int(round(v)), 'n': nb[k]} for k, v in hist.items()},
            'temp': {k: {'pts': round(v, 1), 'piedra': piedra(v), 'sub': subnivel(v), 'max': maxp.get(k, piedra(v)),
                         'n': btot[k], 'cuentan': bcon[k], 'h': h_ult[k][::-1][:ULTIMAS]} for k, v in pts.items()},
            'cortes': snaps, 'activos': sorted(activos), 'fin': fin.isoformat() if fin else None, 'por_evento': noches}


def nombre_piedra(x):
    return '%s %s' % (PIEDRAS[piedra(x)], ('I', 'II', 'III')[subnivel(x)])


# ── self-check ───────────────────────────────────────────────────────────
def _ev(dia, rondas, tabla, n=None):
    return {'dia': dia, 'participantes': n or len(tabla), 'tabla': [[q, pu, 0] for q, pu in tabla],
            'rondas': [{'r': r, 'b': [[list(l), g, ''] for l, g in bs]} for r, bs in rondas]}


def _self_check():
    mal = 0

    def ok(c, t):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '🔴', t))

    print('\n══ EL ELO DE TEMPORADA ══\n')
    ok([piedra(x) for x in (0, 64, 65, 134, 135, 289, 290, 374, 375, 5000)] == [0, 0, 1, 1, 2, 3, 4, 4, 5, 5],
       'las piedras: Hierro 0 · Jade 65 · Zafiro 135 · Rubí 210 · Diamante 290 · Mítico 375')
    ok([subnivel(x) for x in (0, 22, 64, 65, 375, 5000)] == [0, 1, 2, 0, 0, 2] and escalon(5000) == 17,
       'los subniveles son tercios de cada piedra, y Mítico se queda en III')
    ok(abs(K * (1 - esperado(100, 100)) - 15) < 1e-9, 'una batalla pareja vale ±15')
    ok(en_area(120, 140) and not en_area(70, 165) and en_area(60, 70) and en_area(5000, 295) and not en_area(400, 280)
       and not en_area(0, 140) and en_area(70, 130),
       'el área: Jade III con Zafiro I sí, Jade I con Zafiro II no, Mítico con todo Diamante, Mítico con Rubí no')
    ok([reinicio(*a) for a in ((400, 5), (150, 5), (320, 4), (250, 3), (170, 2), (120, 1), (30, 0))]
       == [240.0, 210.0, 176.0, 125.0, 68.0, 0.0, 0.0],
       'el reinicio: Mítico 60 % sin bajar de Rubí, Diamante 55 %, Rubí 50 %, Zafiro 40 %, el resto a 0')
    ok([primera_vez(e) for e in (17, 15, 12, 9, 6, 0)] == [210.0, 210.0, 135.0, 65.0, 0.0, 0.0],
       'la primera vez, desde el piso de la piedra más alta de las divisiones de la T1')
    import competencias as CO
    ar = arranque_de('t1', divisiones={'mejor': {'Oasis': 16, 'Bea': 12, 'Cid': 9, 'Dan': 6}})
    ok(ar == {CO.norm('Oasis'): 210.0, CO.norm('Bea'): 135.0, CO.norm('Cid'): 65.0},
       'el arranque de la T2: Mítico a Rubí I, Diamante a Zafiro I, Rubí a Jade I; el resto en 0 y no se anota')
    # una noche de cuatro en Hierro: A le gana a C, B a D, A a B en la final
    L = {'1': _ev('2027-01-05', [('Semifinales', [(('A', 'C'), 'A'), (('B', 'D'), 'B')]), ('Final', [(('A', 'B'), 'A')])],
                  [('A', 'Campeón'), ('B', 'Subcampeón'), ('C', ''), ('D', '')])}
    r = calcular(L, votos={}, por_evento=True)
    t = {k: v['pts'] for k, v in r['temp'].items()}
    pe = r['por_evento']['1']
    ok(pe['a'][0] == 0.0 and round(pe['a'][1], 1) == t['a'] and pe['b'] == (0.0, 0.0),
       'el antes y el después de cada noche, con lo de la noche adentro (para «La noche de…»)')
    ok(t['a'] > 40 and t['b'] == 0 and t['c'] == 0 and t['d'] == 0,
       'una noche: el campeón suma, la final nunca resta (B queda en 0) y en Hierro perder no resta')
    h = r['hist']
    ok(abs(sum(v['elo'] for v in h.values()) - 4 * H_INI) <= 2 and h['a']['elo'] > h['b']['elo'] > h['d']['elo'],
       'el histórico: suma cero y ordena')
    # un Mítico que le gana a un Hierro: fuera del área, no se mueve nada; ni el premio de campeón
    L2 = {'1': _ev('2027-01-05', [('Final', [(('X', 'Y'), 'X')])], [('X', 'Campeón'), ('Y', 'Subcampeón')])}
    r = calcular(L2, arranque={'x': 400.0}, votos={})
    ok(r['temp']['x']['pts'] == 400.0 and r['temp']['y']['pts'] == 0.0 and r['temp']['x']['cuentan'] == 0,
       'fuera del área no se mueve nada, ni el premio de campeón')
    # la semana: un Zafiro y un Hierro, a los 0, 8 y 15 días: cuenta recién a los 15 (dos piedras de distancia).
    # ⚠️ Las claves salen de `competencias.norm()`, con los alias de la Liga: «Z» es «zeta»
    kz = CO.norm('Z')
    L3 = {str(i + 1): _ev(d, [('Final', [(('Z', 'H'), 'Z')])], [('Z', 'Campeón'), ('H', 'Subcampeón')])
          for i, d in enumerate(('2027-01-05', '2027-01-13', '2027-01-20'))}
    pasos = [calcular(L3, hasta=dt.date(2027, 1, d), arranque={kz: 150.0}, votos={})['temp'][kz]['pts'] for d in (6, 14, 21)]
    ok(pasos[0] == pasos[1] == 150.0 and pasos[2] > 150.0,
       'la semana: sin rival de su piedra se le abre la de al lado, y a las dos semanas, dos')
    # una de tres: el ganador contra cada uno con medio K en el histórico
    L4 = {'1': _ev('2027-01-05', [('Final', [(('A', 'B', 'C'), 'A')])], [('A', 'Campeón'), ('B', ''), ('C', '')])}
    h = calcular(L4, votos={})['hist']
    ok(h['a']['elo'] == 1024 and h['b']['elo'] == h['c']['elo'] == 988,
       'el histórico cuenta las de tres: medio K contra cada uno (48 de los nuevos → +24 y −12 −12)')
    # los cortes: cómo estaba justo antes de un día
    r = calcular(L3, arranque={kz: 150.0}, cortes=[dt.date(2027, 1, 14)], votos={})
    ok(r['cortes'][dt.date(2027, 1, 14)][kz]['elo'] == 150 and r['temp'][kz]['pts'] > 150,
       'los cortes guardan el de temporada de antes de ese día (para las semanas de las divisiones)')
    # 🪨 desde la T2, `elo.calcular()` y `notas.fuerzas()` salen del histórico nuevo; en la T1, del de siempre
    import elo as EL
    import notas as NO
    hs, fzs = historico(L4)
    ok(hs == {k: dict(v, h=hs[k]['h']) for k, v in calcular(L4, votos={})['hist'].items()} and fzs['1']['pre'] == {},
       'el histórico solo da lo mismo que el de la temporada (y una de tres no es un 1v1 para la nota)')
    # ⚠️ se parchea el MÓDULO que importan elo.py y notas.py: corriendo este archivo, este es `__main__`, otro objeto
    mod = __import__('elo_temporada')
    viejo = EL.calcular(L4)
    antes = mod.prendido
    try:
        mod.prendido = lambda temp=None: True
        nuevo, fz2 = EL.calcular(L4), NO.fuerzas(L)
    finally:
        mod.prendido = antes
    medio = H_INI + H_K_NUEVO / 2
    ok(viejo == {} and nuevo['a']['elo'] == 1024 and fz2['1']['nivel'] == H_INI
       and fz2['1']['pre'][('a', 'b')] == [(medio, medio)],
       'desde la T2, elo.calcular() y notas.fuerzas() salen de acá: la de tres cuenta, y el ELO de antes de cada 1v1')
    print('\n   %s' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return 1 if mal else 0


def _t1():
    """La T1 entera con estas reglas, como si hubiera sido la primera temporada: los números de `docs/elo_temporada.md`."""
    with io.open(os.path.join(BASE, 'datos', 'llaves_t1.json'), encoding='utf-8') as f:
        L = json.load(f) or {}
    return calcular(L)


def main():
    a = sys.argv[1:]
    if '--auto' in a:
        sys.exit(_self_check())
    r = _t1()
    T, H = r['temp'], r['hist']
    if '--ver' in a and a.index('--ver') + 1 < len(a):
        import competencias as CO
        k = CO.norm(a[a.index('--ver') + 1])
        x = T.get(k)
        if not x:
            print('%s: no jugó en la T1' % k)
            return
        print('%s: %s puntos (%s) · la más alta %s · histórico %s (%d batallas) · contaron %d de %d · últimas %s' % (
            k, x['pts'], nombre_piedra(x['pts']), PIEDRAS[x['max']], H.get(k, {}).get('elo'), H.get(k, {}).get('n', 0),
            x['cuentan'], x['n'], x['h']))
        return
    act = [q for q in r['activos'] if T[q]['n'] >= 5]
    c = collections.Counter(T[q]['piedra'] for q in act)
    tb, tc = sum(v['n'] for v in T.values()), sum(v['cuentan'] for v in T.values())
    print('🪨 La T1 rehecha con el ELO de temporada (sólo lee; hasta el %s)' % r['fin'])
    print('   cuentan %d %% de las batallas · activos con 5 o más: %d → %s' % (
        round(100 * tc / max(1, tb)), len(act), ' · '.join('%s %d' % (PIEDRAS[s], c.get(s, 0)) for s in range(MITICO, -1, -1))))
    for i, (k, v) in enumerate(sorted(T.items(), key=lambda kv: -kv[1]['pts'])[:12], 1):
        print('  %2d. %-16s %6.1f  %-12s histórico %5s' % (i, k, v['pts'], nombre_piedra(v['pts']), H.get(k, {}).get('elo')))


if __name__ == '__main__':
    main()
