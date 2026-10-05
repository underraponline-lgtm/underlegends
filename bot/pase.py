# -*- coding: utf-8 -*-
"""EL PASE DE RAPERO: 30 niveles por temporada, sólo para los miembros de DRA, que se suben con Tareas.

    python bot/pase.py            lo que se le mandaría al objeto, sin mandar nada
    python bot/pase.py --auto     el self-check, sin red ni archivos
    python bot/pase.py --aplicar  se lo manda al objeto (lo hace el ciclo, paso 2b4b)

Dlx, 27/09/2026: *«eso sí me gustaría que sólo para DRA»* y *«lo de pase viene con TAREAS no misiones»*. El 04/10:
*«8. B, como Brawl Stars»*; a la propuesta (30 niveles, cinco Tareas, premios de perfil), *«3. A»*; y el 05/10, *«si
sigue con todo eso»*.

LAS REGLAS (los números, acá arriba: van con el rebalanceo del final)
--------------------------------------------------------------------
- **Sólo los miembros de DRA**: el rol Miembro (`datos/verificados.json`). Los demás ven qué es y cómo sumarse.
- **Cinco Tareas por semana** (`TAREAS`), que se renuevan el lunes a las 11 AM ET con las misiones y los
  multiplicadores (`multiplicadores.periodo()`).
- **Cada Tarea cumplida es un nivel**, hasta `NIVELES`. Una cumplida no se pierde: el objeto la anota
  (`pase_hecho`), así que una llave corregida no te baja de nivel.
- **Cada nivel paga `TIENDA_NIVEL` Puntos de Tienda**, y algunos más y algo para tu perfil (`ESPECIALES`): dos
  insignias del Pase, dos títulos y un color para tu nombre. **El último deja una insignia de la temporada que queda
  para siempre.**
- **30 niveles por temporada**: con la temporada nueva se arranca de cero. Lo de esta semana de prueba también: se
  reinicia el lunes 12/10 con la T1.
- **Las tarjetas no cambian** (Dlx: la web es la pared, las cartas son los afiches).

QUIÉN SABE QUÉ
- **Jugar en DRA y las misiones**: el ciclo (acá), con las llaves y `datos/misiones.json`.
- **Entrar 3 días seguidos** (los días de la racha: `activo`), **felicitar** (`aplausos`) y **mirar una llave en
  vivo** (`pase_vivo`): el objeto, que los ve pasar.
- La cuenta, los premios y lo que se muestra: el objeto (`paseDe()` en `bot/avisos.js`). Esto le manda los números,
  las semanas, quiénes son miembros y quién jugó en DRA o cumplió sus misiones cada semana.

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
#: `(id, texto, cómo se cumple)`, en el orden en que se muestran. Las cuentas: `DIAS_SEGUIDOS` y `FELICITAR`
TAREAS = (
    ('dias', 'Entrá 3 días seguidos', 'Con tu cuenta en la página, usando el bot o jugando: los días de tu racha.'),
    ('dra', 'Jugá un evento en DRA', 'Cualquier evento de DRA de esta semana.'),
    ('misiones', 'Completá tus misiones', 'Las tres misiones de la semana, las del Ranking.'),
    ('felicitar', 'Felicitá a 3 personas', 'Con 👏 en Publicaciones.'),
    ('vivo', 'Mirá una llave en vivo', 'Abrí la llave de un evento mientras se juega, con tu cuenta.'),
)
DIAS_SEGUIDOS = 3
FELICITAR = 3
#: Puntos de Tienda por cada nivel (la billetera arranca con 5.000: `precios.INICIAL`)
TIENDA_NIVEL = 200
#: el color del nombre: el dorado del Pase
COLOR = '#F5C542'
#: los niveles que dan algo más: `nivel: (Puntos de Tienda, tipo, valor)`. El 30 es la insignia de la temporada
ESPECIALES = {
    5: (500, 'insignia', 'Pase Bronce'),
    10: (500, 'titulo', 'De la casa'),
    15: (500, 'insignia', 'Pase Plata'),
    20: (500, 'color', COLOR),
    25: (500, 'titulo', 'Pilar de DRA'),
    30: (1000, 'insignia', 'Pase Oro'),
}

WORKER = 'https://liga-global-bot.liga-global-ul.workers.dev'


def premios():
    """`[[nivel, tienda, tipo, valor], …]` de los `NIVELES`: lo que da cada uno. `tipo` vacío: sólo Tienda."""
    out = []
    for n in range(1, NIVELES + 1):
        t, tipo, valor = ESPECIALES.get(n, (TIENDA_NIVEL, '', ''))
        out.append([n, t, tipo, valor])
    return out


def config(temp):
    """Lo que lee el objeto: los números y los textos. La temporada (`temp`) separa un Pase del siguiente."""
    return {'temp': temp or 'prueba', 'niveles': NIVELES, 'dias': DIAS_SEGUIDOS, 'felicitar': FELICITAR,
            'tareas': [list(t) for t in TAREAS], 'premios': premios()}


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


def hechas(sems, evs, mis, quien_es, miembros):
    """`{discord_id: {semana: [dra, misiones]}}` de los miembros que cumplieron alguna de las dos.

    `evs` son los de `most_wanted.cargar_todo()` (con `sv` y su instante `t`); `mis`, `datos/misiones.json`;
    `quien_es`, `buscador()`."""
    import misiones as MI
    out = {}

    def marca(did, sid, i):
        if did and did in miembros:
            x = out.setdefault(did, {}).setdefault(sid, [0, 0])
            x[i] = 1
    for sid, ini, fin in sems:
        for ev in evs:
            t = ev.get('t')
            if ev.get('sv') != 'DRA' or not t or not (ini <= t.timestamp() * 1000 < fin):
                continue
            for raw in _gente(ev):
                marca(quien_es(raw), sid, 0)
        s = ((mis or {}).get('semanas') or {}).get(sid) or {}
        lista = s.get('lista') or []
        for raw, vs in (s.get('prog') or {}).items():
            if lista and len(vs) == len(lista) and all(MI.cumplida(x[0], v, x[3]) for x, v in zip(lista, vs)):
                marca(quien_es(raw), sid, 1)
    return out


def armar(ahora=None):
    """Lo que va al objeto: `{v, cfg, sem, miembros, hechas}`. `None` si no se sabe quiénes son miembros."""
    import most_wanted as MW
    import misiones as MI
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
    h = hechas(sems, evs, MI.leer(), buscador(PR.discords(pool)), set(miembros))
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
    print('   ✅ %s · %d miembros · %d con una Tarea del ciclo%s'
          % ('cambió' if x.get('cambio') else 'igual que antes', len(d['miembros']), len(d['hechas']),
             (' · %d nivel(es) nuevo(s)' % x['niveles']) if x.get('niveles') else ''))
    return True


def _self_check():
    print('\n══ EL PASE DE RAPERO ══\n')
    mal = 0

    def ok(c, q):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '🔴', q))
    ps = premios()
    ok(len(ps) == NIVELES and [p[0] for p in ps] == list(range(1, NIVELES + 1)), 'treinta niveles, uno por Tarea')
    ok(ps[-1][2] == 'insignia' and all(p[1] > 0 for p in ps), 'todos pagan Tienda y el último es una insignia')
    ok({p[2] for p in ps if p[2]} == {'insignia', 'titulo', 'color'}, 'los premios de perfil: insignias, títulos y color')
    ok([t[0] for t in TAREAS] == ['dias', 'dra', 'misiones', 'felicitar', 'vivo'], 'las cinco Tareas de la propuesta')
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
           {'sv': 'FFA', 't': t, 'fase': {'Cami': 'Campeón'}, 'rondas': []}]
    mis = {'semanas': {'2026-10-05': {'lista': [['eventos2', 'x', 'facil', 2, 300], ['duelos3', 'x', 'media', 3, 600],
                                                 ['final', 'x', 'dificil', 2, 1000]],
                                       'prog': {'Cami🇨🇱': [2, 3, 1], 'Ana': [1, 1, 1]}}}}
    dids = {'Ana': '111111', 'Bea': '222222', 'Cami': '333333'}
    h = hechas(sems, evs, mis, buscador(dids), {'111111', '333333'})
    ok(h.get('111111') == {'2026-10-05': [1, 0]}, 'Ana jugó en DRA y no completó las misiones')
    ok('222222' not in h, 'Bea jugó en DRA pero no es miembro: no entra')
    ok(h.get('333333') == {'2026-10-05': [0, 1]}, 'Cami completó las tres (su nombre con bandera la encuentra igual)')
    q = buscador({'SOL': '1', 'SOL🇵🇪': '2'})
    ok(q('SOL') == '1' and q('SOL🇵🇪') == '2' and q('Sol') is None, 'dos con el mismo nombre: no se adivina')
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
    print('   el Pase · %s · %d semana(s) · %d miembros · %d con una Tarea del ciclo'
          % (d['cfg']['temp'], len(d['sem']), len(d['miembros']), len(d['hechas'])))
    if '--aplicar' in sys.argv:
        mandar(d)


if __name__ == '__main__':
    main()
