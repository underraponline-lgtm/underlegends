# -*- coding: utf-8 -*-
"""EL PASE DE RAPERO: 30 niveles por temporada, sólo para los miembros de DRA, que se suben con XP de Tareas.

    python bot/pase.py            lo que se le mandaría al objeto, sin mandar nada
    python bot/pase.py --auto     el self-check, sin red ni archivos
    python bot/pase.py --aplicar  se lo manda al objeto (lo hace el ciclo, paso 2b4b)

Dlx, 27/09/2026: *«eso sí me gustaría que sólo para DRA»* y *«lo de pase viene con TAREAS no misiones»*. El 04/10:
*«8. B, como Brawl Stars»*; a la propuesta (30 niveles, cinco Tareas, premios de perfil), *«3. A»*; y el 05/10, *«si
sigue con todo eso»*. El 06/10: *«a mí me gustaría que se base en Brawl Stars más o menos»*, y al borrador, *«1, sí»*;
los premios nuevos (marcos, fondos, sobres…), *«ninguno de momento»*; en el 30, *«B»* (el Salón del Pase).

LAS REGLAS (los números, acá arriba: van con el rebalanceo del final)
--------------------------------------------------------------------
- **Sólo los miembros de DRA**: el rol Miembro (`datos/verificados.json`). Los demás ven qué es y cómo sumarse.
- **Las Tareas dan XP y la XP sube de nivel**, como en Brawl Stars. Tres tipos:
  - **diarias** (`DIARIAS`): `POR_DIA` por día, que cambian a la medianoche del este; la primera está siempre y las
    demás se turnan día por día;
  - **semanales** (`SEMANALES`): se renuevan el lunes a las 11 AM ET, con las misiones y los multiplicadores
    (`multiplicadores.periodo()`);
  - **de temporada** (`TEMPORADA`): duran hasta el final, y se cumplen en cualquier orden.
- **Las Tareas no son las Misiones** (Dlx, 06/10: *«hay TAREAS y misiones que son diferentes»*): las Misiones —jugar,
  ganar duelos, llegar lejos— son para todos y suman a la Temporada; las Tareas son de la Liga y de la página, y de
  DRA queda una sola, jugar ahí.
- **Una cumplida no se pierde**: el objeto la anota (`pase_hecho`), así que una llave corregida no te baja de nivel.
- **Cada nivel cuesta `XP_NIVEL`** (los primeros `XP_PRIMEROS`) **y paga `TIENDA_NIVEL` Puntos de Tienda**; algunos
  dan algo para tu perfil (`ESPECIALES`): la tarjeta de Temporada, dos insignias, dos títulos y el nombre dorado.
  **El último deja la insignia de la temporada, que queda para siempre, y te pone en el Salón del Pase.**
- **Después del último nivel sigue la cola** (`COLA`): cada tanto de XP, más Puntos de Tienda (Dlx, 06/10: *«2. B»*,
  poco en cada nivel y el resto después del 30).
- **Llegar a `PUBLICAR` sale en Publicaciones**, para que te feliciten (Dlx, 06/10: *«5. c»*).
- **Con la temporada nueva se arranca de cero.** Lo de esta semana de prueba también: se reinicia el lunes 12/10 con la
  T1.
- **Las tarjetas no cambian** (Dlx: la web es la pared, las cartas son los afiches; 06/10: *«7. A»*).

QUIÉN SABE QUÉ
- **Jugar en DRA y cazar a un buscado**: el ciclo (acá), con las llaves y el Most Wanted.
- **Los días** (los de la racha: `activo`), **felicitar** y **mirar una llave en vivo** (`pase_log`) y **poner un
  precio** (`precios`): el objeto, que los ve pasar.
- La cuenta, los premios y lo que se muestra: el objeto (`paseDe()` en `bot/avisos.js`). Esto le manda los números,
  las Tareas (con qué mide cada una: `MIDE`), las semanas, quiénes son miembros y lo que hizo cada uno en los eventos.

⚠️ VA DIRECTO AL OBJETO, NO POR KV (`/avisos/pase-ciclo`, con la clave del ciclo). KV tiene 1.000 escrituras por día
y se gastan (el 05/10 iban 931 antes del mediodía); la lista de miembros cambia todos los días. El objeto guarda sólo
si cambió (`v`).
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

#: la primera semana del Pase: la de prueba, que arrancó el lunes 05/10/2026 a las 11 AM ET
DESDE = '2026-10-05'
NIVELES = 30
#: la XP de cada nivel: los primeros, baratos (el arranque tiene que sentirse), y después todos iguales
XP_PRIMEROS, PRIMEROS, XP_NIVEL = 300, 3, 1000
#: después del último nivel: cada `COLA[0]` de XP paga `COLA[1]` Puntos de Tienda
COLA = (1000, 300)
#: lo que el objeto sabe contar. `activo`: días de la racha · `fel`: felicitaciones · `vivo`: llaves en vivo
#: distintas · `precio`: precios por cabeza · `dra`: eventos jugados en DRA · `caza`: buscados cazados (estos dos, del
#: ciclo). Si se agrega uno, también en `PASE_MIDE` de `bot/avisos.js`
MIDE = ('activo', 'fel', 'vivo', 'precio', 'dra', 'caza')
#: las Tareas: `(id, texto, cómo se cumple, qué mide, meta, xp)`, en el orden en que se muestran
DIARIAS = (
    ('entrar', 'Entrá hoy', 'Con tu cuenta en la página, usando el bot o jugando un evento.', 'activo', 1, 150),
    ('felicitar1', 'Felicitá a alguien', 'Con 👏 en Publicaciones.', 'fel', 1, 150),
    ('vivo1', 'Mirá una llave en vivo', 'Abrí la llave de un evento mientras se juega, con tu cuenta.', 'vivo', 1, 150),
)
#: cuántas diarias hay cada día: la primera siempre, y las demás se turnan día por día
POR_DIA = 2
SEMANALES = (
    ('dias', 'Entrá 3 días', 'Tres días cualesquiera de la semana: la página con tu cuenta, el bot o un evento.',
     'activo', 3, 500),
    ('felicitar', 'Felicitá a 3 personas', 'Con 👏 en Publicaciones.', 'fel', 3, 500),
    ('dra', 'Jugá un evento en DRA', 'Cualquier evento de DRA de esta semana.', 'dra', 1, 500),
    ('vivo', 'Mirá 2 llaves en vivo', 'Dos llaves distintas mientras se juegan, con tu cuenta.', 'vivo', 2, 500),
    ('precio', 'Poné precio a una cabeza', 'En la Tienda, a cualquiera de los buscados.', 'precio', 1, 500),
)
TEMPORADA = (
    ('fel10', 'Felicitá a 10 personas', 'En toda la temporada, con 👏 en Publicaciones.', 'fel', 10, 1500),
    ('vivo5', 'Mirá 5 llaves en vivo', 'En toda la temporada.', 'vivo', 5, 1500),
    ('dra3', 'Jugá 3 eventos en DRA', 'En toda la temporada.', 'dra', 3, 2000),
    ('fel20', 'Felicitá a 20 personas', 'En toda la temporada.', 'fel', 20, 2000),
    ('vivo10', 'Mirá 10 llaves en vivo', 'En toda la temporada.', 'vivo', 10, 2000),
    ('caza', 'Cazá a un buscado', 'Ganale a un buscado del Most Wanted, en cualquier servidor de la Liga.', 'caza', 1,
     3000),
    ('dra5', 'Jugá 5 eventos en DRA', 'En toda la temporada.', 'dra', 5, 3000),
    ('dias30', 'Entrá 30 días', 'En toda la temporada: la página con tu cuenta, el bot o un evento.', 'activo', 30,
     3000),
)
#: Puntos de Tienda por cada nivel (la billetera arranca con 5.000: `precios.INICIAL`)
TIENDA_NIVEL = 150
#: el color del nombre: el dorado del Pase
COLOR = '#F5C542'
#: los niveles que dan algo más que Tienda: `nivel: (tipo, valor)`. El último es la insignia de la temporada
ESPECIALES = {
    # 🎟️ la Temporada es la recompensa del nivel 1 (Dlx, 05/10/2026: «C», «nivel 1»): la desbloquea `verificados.puede()`
    1: ('tarjeta', 'Temporada'),
    5: ('insignia', 'Pase Bronce'),
    10: ('titulo', 'De la casa'),
    15: ('insignia', 'Pase Plata'),
    20: ('color', COLOR),
    25: ('titulo', 'Pilar de DRA'),
    30: ('insignia', 'Pase Oro'),
}
#: los niveles que salen en Publicaciones para que te feliciten (Dlx, 06/10/2026: «5. c»). El último, además, es el
#: Salón del Pase (Dlx, 06/10: «4. B»)
PUBLICAR = (10, 30)

WORKER = 'https://liga-global-bot.liga-global-ul.workers.dev'


def umbrales():
    """La XP total que pide cada nivel, del 1 al último: `[300, 600, 900, 1900, …]`."""
    out, t = [], 0
    for n in range(1, NIVELES + 1):
        t += XP_PRIMEROS if n <= PRIMEROS else XP_NIVEL
        out.append(t)
    return out


def premios():
    """`[[nivel, tienda, tipo, valor], …]` de los `NIVELES`: lo que da cada uno. `tipo` vacío: sólo Tienda."""
    out = []
    for n in range(1, NIVELES + 1):
        tipo, valor = ESPECIALES.get(n, ('', ''))
        out.append([n, TIENDA_NIVEL, tipo, valor])
    return out


def diarias_de(dia):
    """Las diarias de un día `AAAA-MM-DD` (hora del este): la primera siempre, y las demás se turnan.

    ⚠️ LA MISMA CUENTA QUE `paseDelDia()` DE `bot/avisos.js`: el día como número (días desde 1970) elige."""
    n = (dt.date.fromisoformat(dia) - dt.date(1970, 1, 1)).days
    resto = DIARIAS[1:]
    if not resto:
        return list(DIARIAS[:1])
    return [DIARIAS[0]] + [resto[(n + j) % len(resto)] for j in range(min(POR_DIA - 1, len(resto)))]


def config(temp):
    """Lo que lee el objeto: los números y los textos. La temporada (`temp`) separa un Pase del siguiente."""
    lista = lambda xs: [list(t) for t in xs]
    out = {'temp': temp or 'prueba', 'niveles': NIVELES, 'umbrales': umbrales(), 'cola': list(COLA),
           'diarias': lista(DIARIAS), 'por_dia': POR_DIA, 'semanales': lista(SEMANALES),
           'temporada': lista(TEMPORADA), 'premios': premios(), 'publicar': list(PUBLICAR)}
    # ⚠️ LA SEMANA DE PRUEBA TENÍA «Completá tus misiones», que ya no es una Tarea: lo que se cumplió sigue valiendo lo
    # que vale una semanal (si no, a quien sólo tenía ésa se le iba el nivel 1, y con él la tarjeta de Temporada)
    if out['temp'] == 'prueba':
        out['legado'] = {'misiones': SEMANALES[0][5]}
    return out


def semanas(ahora, a=None):
    """`[[id, inicio_ms, fin_ms], …]` del Pase de esta temporada, hasta la de `ahora` incluida.

    Desde el arranque de la temporada si ya pasó; si no (la prueba), desde `DESDE`. `a` es el arranque, para el
    self-check."""
    import multiplicadores as MU
    a = MU._arranque() if a is None else a
    if a and a <= ahora:
        t = a
    else:
        t = MU.periodo(dt.datetime.fromisoformat(DESDE + 'T16:00:00+00:00'), a)[1]
    out = []
    while t <= ahora and len(out) < 60:
        sid, ini, fin = MU.periodo(t, a)
        out.append([sid, int(ini.timestamp() * 1000), int(fin.timestamp() * 1000)])
        t = fin
    return out


def _gente(ev):
    """Los que jugaron un evento: la tabla y los dos lados de cada batalla (como `racha._gente()`)."""
    import racha as RA
    return RA._gente(ev)


def buscador(dids):
    """`f(nombre) -> discord_id` o `None`: primero el nombre tal cual, después normalizado (sin banderas ni
    tildes). ⚠️ Un normalizado que comparten dos personas («SOL» y «SOL🇵🇪») no se usa: no se adivina."""
    import construir_padron as PAD
    por, dobles = {}, set()
    for raw, d in dids.items():
        n = PAD.norm(raw)
        if n in por and por[n] != d:
            dobles.add(n)
        por.setdefault(n, d)
    for n in dobles:
        por.pop(n, None)
    return lambda x: dids.get(x) or por.get(PAD.norm(x or ''))


def _cazas(mw):
    """`[(instante, [nombres de los cazadores]), …]` del Most Wanted de la temporada (`MW.periodos()`)."""
    import most_wanted as MW
    out = []
    for per in MW.periodos(mw or {}):
        for b in per.get('buscados') or []:
            c = b.get('caza') or {}
            t = str(c.get('t') or '')
            por = [y.get('n') for y in c.get('por') or [] if y.get('n')]
            if not t or not por:
                continue
            try:
                ti = dt.datetime.fromisoformat(t.replace('Z', '+00:00'))
            except ValueError:
                continue
            out.append((ti if ti.tzinfo else ti.replace(tzinfo=dt.timezone.utc), por))
    return out


def hechas(sems, evs, cazas, quien_es, miembros):
    """`{discord_id: {semana: [eventos en DRA, buscados cazados]}}` de los miembros que hicieron algo de eso.

    `evs` son los de `most_wanted.cargar_todo()` (con `sv` y su instante `t`); `cazas`, los de `_cazas()`;
    `quien_es`, `buscador()`. Cuenta eventos, no batallas: dos rondas del mismo evento son uno."""
    out = {}

    def suma(did, sid, i):
        if did and did in miembros:
            x = out.setdefault(did, {}).setdefault(sid, [0, 0])
            x[i] += 1
    for sid, ini, fin in sems:
        dentro = lambda t: t and ini <= t.timestamp() * 1000 < fin
        for ev in evs:
            if ev.get('sv') != 'DRA' or not dentro(ev.get('t')):
                continue
            for did in {quien_es(raw) for raw in _gente(ev)}:
                suma(did, sid, 0)
        for t, por in cazas:
            if dentro(t):
                for did in {quien_es(raw) for raw in por}:
                    suma(did, sid, 1)
    return out


def armar(ahora=None):
    """Lo que va al objeto: `{v, cfg, sem, miembros, hechas}`. `None` si no se sabe quiénes son miembros."""
    import most_wanted as MW
    import multiplicadores as MU
    import precios as PR
    import verificados as VE
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    ids, _cuando = VE.cargar()
    if not ids:
        return None
    pool, evs, _R = MW.cargar_todo()
    sems = semanas(ahora)
    miembros = sorted(ids)
    h = hechas(sems, evs, _cazas(MW.leer()), buscador(PR.discords(pool)), set(miembros))
    out = {'cfg': config(MU.temporada_actual(ahora)), 'sem': sems, 'miembros': miembros, 'hechas': h}
    out['v'] = hashlib.sha256(json.dumps(out, sort_keys=True, ensure_ascii=False).encode('utf-8')).hexdigest()[:16]
    return out


def mandar(d):
    """Al objeto, con la clave del ciclo. `True` si lo tomó."""
    import requests
    import fotos as F
    tok = F.env('DISCORD_TOKEN', obligatorio=False)
    if not tok:
        print('   ⚠️ sin DISCORD_TOKEN: no le mando el Pase al objeto')
        return False
    k = hashlib.sha256(('lg-ciclo:' + tok).encode('utf-8')).hexdigest()
    try:
        r = requests.post(WORKER + '/avisos/pase-ciclo', data=json.dumps(d, ensure_ascii=False).encode('utf-8'),
                          headers={'x-lg-ciclo': k, 'content-type': 'application/json'}, timeout=30)
        x = r.json() if r.ok else {}
    except (OSError, ValueError) as e:
        print('   ⚠️ el objeto no tomó el Pase (%s)' % str(e)[:80])
        return False
    if not r.ok:
        print('   ⚠️ el objeto no tomó el Pase: contestó %s' % r.status_code)
        return False
    print('   ✅ %s · %d miembros · %d con algo del ciclo%s'
          % ('cambió' if x.get('cambio') else 'igual que antes', len(d['miembros']), len(d['hechas']),
             (' · %d Tarea(s) nueva(s)' % x['niveles']) if x.get('niveles') else ''))
    return True


NIVELES_ARCHIVO = os.path.join(BASE, 'datos', 'pase_niveles.json')


def traer_niveles():
    """`{temp, niveles: {discord_id: nivel}, hitos: [[discord_id, nivel, ms, clave], …]}` del objeto
    (`/avisos/pase-niveles`, con la clave del ciclo), o `None`.

    🔑 LA TEMPORADA ES LA RECOMPENSA DEL NIVEL 1 (Dlx, 05/10/2026: «C», «nivel 1»): con esto el portón
    (`verificados.puede()`) sabe a quién dibujársela. Y los hitos (`PUBLICAR`) van a Publicaciones: `bot/muro.py`."""
    import requests
    import fotos as F
    tok = F.env('DISCORD_TOKEN', obligatorio=False)
    if not tok:
        return None
    k = hashlib.sha256(('lg-ciclo:' + tok).encode('utf-8')).hexdigest()
    try:
        r = requests.get(WORKER + '/avisos/pase-niveles', headers={'x-lg-ciclo': k}, timeout=20)
        d = r.json() if r.ok else None
    except (OSError, ValueError):
        return None
    if not isinstance(d, dict) or not isinstance(d.get('niveles'), dict):
        return None
    hitos = []
    for h in d.get('hitos') or []:
        if (isinstance(h, list) and len(h) >= 3 and str(h[0]).isdigit() and isinstance(h[1], int)
                and isinstance(h[2], int)):
            hitos.append([str(h[0]), h[1], h[2], str(h[3] if len(h) > 3 else '')[:80]])
    return {'temp': str(d.get('temp') or ''), 'niveles': {str(q): int(n) for q, n in d['niveles'].items()
                                                         if str(q).isdigit() and isinstance(n, int)},
            'hitos': sorted(hitos, key=lambda h: (h[2], h[0], h[1]))}


def guardar_niveles(d):
    """A `datos/pase_niveles.json`, sólo si cambió (lo commitea el ciclo). Devuelve si escribió.

    🔴 CON DOS FRENOS (revisión del 05/10/2026), porque de este archivo sale quién tiene la Temporada: si el objeto
    perdiera lo suyo y contestara vacío, guardarlo le sacaba la tarjeta a todos —y `bot/fuera.py` arrancaba el reloj
    para borrarlas—. Sin temporada (el objeto no tiene el Pase cargado) no se guarda; y en la MISMA temporada los niveles
    sólo crecen (`pase_hecho` no se borra salvo con /borrar-mis-datos), así que perder la mitad de la gente no es gente
    que bajó: es el objeto. El cambio de temporada sí vacía: es la T1 arrancando de cero."""
    previo = leer_niveles()
    if not d.get('temp'):
        print('   ⚠️ el objeto no tiene el Pase cargado: no toco los niveles guardados')
        return False
    hitos = d.get('hitos') or []
    if (previo is not None and previo.get('temp') == d['temp'] and previo.get('niveles') == d['niveles']
            and (previo.get('hitos') or []) == hitos):
        return False
    if (previo is not None and previo.get('temp') == d['temp'] and len(previo.get('niveles') or {}) >= 6
            and len(d['niveles']) < len(previo['niveles']) / 2):
        print('   🔴 el objeto dice %d con nivel y había %d en la misma temporada: eso no es gente bajando, es el objeto. '
              'No toco los niveles guardados' % (len(d['niveles']), len(previo['niveles'])))
        return False
    out = {'_leeme': 'Quién tiene nivel en el Pase de rapero de la temporada (Discord ID: nivel) y quién llegó a los '
                     'niveles que se publican (hitos: Discord ID, nivel, cuándo en ms y la clave de su perfil). Lo trae '
                     'bot/pase.py del objeto en cada corrida; lo leen verificados.puede() (la Temporada es el premio '
                     'del nivel 1) y bot/muro.py (Publicaciones).',
           'temp': d['temp'], 'niveles': dict(sorted(d['niveles'].items())), 'hitos': hitos}
    with io.open(NIVELES_ARCHIVO, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')
    return True


def leer_niveles(ruta=None):
    """`{temp, niveles, hitos}` de `datos/pase_niveles.json`, o `None` si no está."""
    try:
        with io.open(ruta or NIVELES_ARCHIVO, encoding='utf-8') as f:
            d = json.load(f) or {}
        return {'temp': d.get('temp') or '', 'niveles': d.get('niveles') or {}, 'hitos': d.get('hitos') or []}
    except (OSError, ValueError):
        return None


def _self_check():
    print('\n══ EL PASE DE RAPERO ══\n')
    mal = 0

    def ok(c, q):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '🔴', q))
    ps = premios()
    u = umbrales()
    ok(len(ps) == NIVELES and [p[0] for p in ps] == list(range(1, NIVELES + 1)) and len(u) == NIVELES,
       'treinta niveles, cada uno con su XP')
    ok(u[:4] == [300, 600, 900, 1900] and all(b > a for a, b in zip(u, u[1:])),
       'los tres primeros cuestan 300 y después 1.000: la XP pedida sólo crece  %s' % u[:5])
    ok(ps[-1][2] == 'insignia' and all(p[1] > 0 for p in ps), 'todos pagan Tienda y el último es una insignia')
    ok({p[2] for p in ps if p[2]} == {'tarjeta', 'insignia', 'titulo', 'color'} and ps[0][2] == 'tarjeta',
       'el nivel 1 es la tarjeta de Temporada; los demás premios: insignias, títulos y color')
    todas = DIARIAS + SEMANALES + TEMPORADA
    ids = [t[0] for t in todas]
    ok(len(ids) == len(set(ids)) and all(t[3] in MIDE and t[4] >= 1 and t[5] > 0 for t in todas),
       'cada Tarea tiene un id único, mide algo que el objeto sabe contar, y da XP')
    ok(not [t for t in todas if 'misi' in t[0] or 'misi' in t[1].lower()],
       'ninguna Tarea es una Misión (Dlx, 06/10: «hay TAREAS y misiones que son diferentes»)')
    ok(sum(1 for t in todas if t[3] == 'dra') == 3 and len(SEMANALES) == 5,
       'de DRA, jugar ahí (una semanal y dos de temporada); cinco semanales')
    # 📏 la regla de margen del informe: completar el Pase no puede pedir más de la mitad de lo que se puede juntar
    semanas_t1 = 11
    tope = semanas_t1 * (sum(t[5] for t in SEMANALES) + 7 * sum(t[5] for t in diarias_de('2026-10-12')))
    tope += sum(t[5] for t in TEMPORADA)
    ok(u[-1] <= tope / 2, 'completarlo pide %d XP de los %d que se pueden juntar en la T1: menos de la mitad'
       % (u[-1], tope))
    d1, d2 = diarias_de('2026-10-12'), diarias_de('2026-10-13')
    ok(len(d1) == POR_DIA and d1[0][0] == 'entrar' and d2[0][0] == 'entrar' and d1[1][0] != d2[1][0],
       'las diarias: «Entrá hoy» siempre, y la otra se turna día por día  %s %s' % ([x[0] for x in d1],
                                                                                    [x[0] for x in d2]))
    c = config('t1')
    ok(c['temp'] == 't1' and c['umbrales'] == u and c['cola'] == [1000, 300] and c['publicar'] == [10, 30]
       and all(len(t) == 6 for t in c['diarias'] + c['semanales'] + c['temporada']),
       'lo que va al objeto: umbrales, cola, las tres listas de Tareas y qué se publica')
    # 🔴 los frenos de los niveles (revisión del 05/10/2026): sobre una copia, nunca sobre el archivo de verdad
    global NIVELES_ARCHIVO
    import tempfile
    _real = NIVELES_ARCHIVO
    NIVELES_ARCHIVO = os.path.join(tempfile.mkdtemp(), 'niveles.json')
    try:
        diez = {str(10000 + i): 1 for i in range(10)}
        ok(guardar_niveles({'temp': 'prueba', 'niveles': diez}) and leer_niveles()['niveles'] == diez, 'se guardan')
        ok(not guardar_niveles({'temp': '', 'niveles': {}}) and leer_niveles()['niveles'] == diez,
           'el objeto sin el Pase cargado no borra los niveles')
        ok(not guardar_niveles({'temp': 'prueba', 'niveles': {'10000': 1}}) and leer_niveles()['niveles'] == diez,
           'en la misma temporada, perder la mitad de la gente es el objeto: no se guarda')
        h = [['10000', 10, 1760000000000, 'ana']]
        ok(guardar_niveles({'temp': 'prueba', 'niveles': diez, 'hitos': h}) and leer_niveles()['hitos'] == h,
           'un hito nuevo, con los mismos niveles, también se guarda (es lo que lee Publicaciones)')
        ok(guardar_niveles({'temp': 't1', 'niveles': {}}) and leer_niveles() == {'temp': 't1', 'niveles': {}, 'hitos': []},
           'la temporada nueva sí arranca de cero')
    finally:
        NIVELES_ARCHIVO = _real
    U = dt.timezone.utc
    a = dt.datetime(2026, 10, 12, 4, 0, tzinfo=U)
    s = semanas(dt.datetime(2026, 10, 7, 12, 0, tzinfo=U), a)
    ok(len(s) == 1 and s[0][0] == '2026-10-05' and s[0][2] == int(a.timestamp() * 1000),
       'en la prueba: una semana, que corta en el arranque de la T1')
    s = semanas(dt.datetime(2026, 10, 21, 12, 0, tzinfo=U), a)
    ok(s[0][1] == int(a.timestamp() * 1000) and len(s) == 2, 'en la T1: desde el arranque, sin la prueba')
    ok(all(x[2] == y[1] for x, y in zip(s, s[1:])), 'las semanas van pegadas')
    t = dt.datetime(2026, 10, 6, 1, 0, tzinfo=U)
    sems = semanas(dt.datetime(2026, 10, 7, 12, 0, tzinfo=U), a)
    evs = [{'sv': 'DRA', 't': t, 'fase': {'Ana': 'Campeón'}, 'rondas': [[([['Ana'], ['Bea']], {'Ana'}, '')]]},
           {'sv': 'DRA', 't': t, 'fase': {'Ana': 'Octavos'}, 'rondas': []},
           {'sv': 'FFA', 't': t, 'fase': {'Cami': 'Campeón'}, 'rondas': []}]
    cazas = [(t, ['Cami🇨🇱']), (dt.datetime(2026, 9, 1, tzinfo=U), ['Ana'])]
    dids = {'Ana': '111111', 'Bea': '222222', 'Cami': '333333'}
    h = hechas(sems, evs, cazas, buscador(dids), {'111111', '333333'})
    ok(h.get('111111') == {'2026-10-05': [2, 0]}, 'Ana jugó dos eventos en DRA (la caza de septiembre no es de la semana)')
    ok('222222' not in h, 'Bea jugó en DRA pero no es miembro: no entra')
    ok(h.get('333333') == {'2026-10-05': [0, 1]}, 'Cami cazó a un buscado (su nombre con bandera la encuentra igual)')
    q = buscador({'SOL': '1', 'SOL🇵🇪': '2'})
    ok(q('SOL') == '1' and q('SOL🇵🇪') == '2' and q('Sol') is None, 'dos con el mismo nombre: no se adivina')
    mw = {'actual': {'id': 'x', 'temporada': 't1', 'buscados': [
        {'n': 'Bea', 'caza': {'t': '2026-10-13T22:00:00Z', 'por': [{'n': 'Ana'}, {'n': 'Cami'}]}},
        {'n': 'Dan', 'estado': 'suelto'}]}}
    cz = _cazas(mw)
    ok(len(cz) == 1 and cz[0][1] == ['Ana', 'Cami'] and cz[0][0].tzinfo is not None,
       'las cazas del Most Wanted, con su instante y sus cazadores')
    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        sys.exit(_self_check())
    d = armar()
    if d is None:
        print('   ⚠️ no sé quiénes son miembros (datos/verificados.json): no mando nada')
        return
    print('   el Pase · %s · %d semana(s) · %d miembros · %d con algo del ciclo'
          % (d['cfg']['temp'], len(d['sem']), len(d['miembros']), len(d['hechas'])))
    if '--aplicar' in sys.argv:
        mandar(d)
        # 🎟️ y quién tiene nivel, para el portón de la Temporada (el premio del nivel 1) y para Publicaciones
        n = traer_niveles()
        if n is None:
            print('   ⚠️ no pude traer los niveles del Pase: queda lo de la corrida anterior')
        else:
            print('   🎟️ %d con nivel 1 o más · %d hito(s)%s'
                  % (len(n['niveles']), len(n['hitos']), ' (guardado)' if guardar_niveles(n) else ''))


if __name__ == '__main__':
    main()
