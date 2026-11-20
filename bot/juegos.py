# -*- coding: utf-8 -*-
"""🎭 LOS ESTILOS DE JUEGO DE CADA UNO: lo elegido, los niveles y el 2.º y 3.º lugar, para la Competitiva (paso 2f3 del ciclo).

    python bot/juegos.py              muestra lo que escribiría (no escribe)
    python bot/juegos.py --aplicar    trae lo elegido, calcula los niveles y escribe `datos/estilos.json`
    python bot/juegos.py --auto       el self-check (no pide nada a nadie)

1.º LUGAR — EL QUE ELIGES. Cada uno lo elige en el Inventario de la página (Dlx, 16/11/2026: el 1.º «lo puedes elegir
desde la página»; una vez por temporada). Lo guarda el objeto de avisos (`juegoElige()` en `bot/avisos.js`) y esto lo
trae con la clave del ciclo (`/avisos/juegos-ciclo`), como los TAGs (`bot/tags_inventario.py`).

LOS NIVELES Y EL 2.º Y 3.º LUGAR — LOS EVENTOS DE ESTILO (Dlx, 17/11/2026: «sí a las reglas, y que se pueda marcar
antes»; y «olvida esto… que el segundo y tercero se ganen por un evento específico en DRA y ya está»: Competencias no).
Dlx marca eventos de DRA con un estilo en el Dashboard; `bot/eventos_estilo.py` los resuelve a número de evento
(`datos/eventos_estilo.json`) y acá, con los resultados de la temporada:
  · jugar un evento de un estilo da **nivel 1** en ese estilo; quedar en el **cuarto de arriba** de la llave (la regla de
    la Racha: la final en una de 8, la semi en una de 16, cuartos en una de 32) **sube uno**, hasta el 3;
  · si es el estilo que elegiste, sube ese; si no, **se te desbloquea en el 2.º o 3.º lugar**. Con más de dos, van los
    dos de nivel más alto, y en un empate el más reciente; los demás quedan desbloqueados;
  · el que elegiste **arranca de 0 desde que lo elegiste**: lo que jugaste con ese estilo antes de elegirlo no cuenta
    para él (Dlx: «si eliges una nueva empieza desde 0»). El día en que el ciclo lo vio elegido va en `desde`;
  · 🔁 **SE ACUMULA TODO DE UNA TEMPORADA A LA OTRA** (Dlx, 20/11/2026: *«se quedan todos… que la gente acumule los
    estilos y que los mejoren es la meta. Y que desbloquee cada uno también»*; al nivel, *«Sí, el nivel se queda»*; y
    *«que se vaya acumulando todo»*). Hasta ese día los niveles volvían a 0 cada temporada. Ahora, la primera vuelta de una
    temporada nueva guarda lo de la que cerró en `antes` (`cerrar_temporada()`) y los niveles de la temporada arrancan de
    ahí (`calcular(base=…)`): un estilo en 3 sigue en 3, y el 2.º y 3.º lugar salen de todo lo ganado.

DÓNDE QUEDA: `datos/estilos.json` (`{clave: [[estilo, nivel], …]}` en el orden de los lugares, lo que dibuja la carta) y
`datos/estilos_niveles.json` (`desde`, `niveles` por estilo y los `ganados` del 2.º y 3.º lugar).

⚠️ SIN RESPUESTA DEL OBJETO NO SE TOCA NADA. Una caída de red escribiendo `{}` le borraría el estilo a todos y
redibujaría sus cartas sin él.
"""
import datetime
import io
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _p in (BASE, os.path.join(BASE, 'bot'), os.path.join(BASE, 'sheet'), os.path.join(BASE, '02_Competitivo', 'v2')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

ARCH = os.path.join(BASE, 'datos', 'estilos.json')
NIVELES = os.path.join(BASE, 'datos', 'estilos_niveles.json')
EVENTOS = os.path.join(BASE, 'datos', 'eventos_estilo.json')
LEEME = ('🎭 Los estilos de juego de la Competitiva, por clave: [[estilo, nivel], …] en el orden de los lugares (1 el elegido '
         'en la página · 2 y 3 los ganados en eventos de estilo de DRA). Lo escribe bot/juegos.py; lo lee '
         '02_Competitivo/v2/estilos_juego.py')
LEEME_N = ('🎭 Lo que no se ve en la carta: desde cuándo tiene cada uno su estilo elegido (`desde`, el día en que el ciclo lo '
           'vio), el nivel de cada estilo que jugó (`niveles`) y los que van en su 2.º y 3.º lugar (`ganados`). Lo escribe '
           'bot/juegos.py con los eventos de estilo y los resultados de la temporada, arrancando de lo acumulado en las '
           'temporadas que cerraron (`antes`: se acumula todo, Dlx 20/11/2026)')


def _j(ruta, defecto):
    try:
        with io.open(ruta, encoding='utf-8') as f:
            d = json.load(f)
        return d if isinstance(d, type(defecto)) else defecto
    except (OSError, ValueError):
        return defecto


def traer(mandar=None):
    """`{clave: {juego, viejos}}` del objeto, o `None` si no contestó. Con `mandar` (`{lugares, niveles}`), además le deja
    a cada uno sus tres lugares con su nivel, que el Inventario muestra (17/11/2026)"""
    import requests
    import fotos as F
    import clave_ciclo as CC
    import pase as PA
    tok = F.env('DISCORD_TOKEN', obligatorio=False)
    if not tok:
        return None
    try:
        r = requests.post(PA.WORKER + '/avisos/juegos-ciclo', data=json.dumps(mandar or {}, ensure_ascii=False).encode('utf-8'),
                          headers={'x-lg-ciclo': CC.clave(tok), 'content-type': 'application/json'}, timeout=30)
        d = r.json() if r.ok else None
    except (OSError, ValueError):
        return None
    return d.get('elegidos') if isinstance(d, dict) and isinstance(d.get('elegidos'), dict) else None


def actualizar_desde(desde, elegidos, hoy):
    """`{clave: [estilo, día]}`: el día en que se vio elegido el estilo de hoy. Si cambió, desde hoy; si dejó de tener,
    afuera."""
    out = {}
    for k, juego in elegidos.items():
        d = desde.get(k)
        out[k] = d if isinstance(d, list) and len(d) == 2 and d[0] == juego else [juego, hoy]
    return out


def cerrar_temporada(viejo, actual):
    """🔁 `antes`: lo acumulado de las temporadas que cerraron, `{clave: {estilo: nivel}}`. Si lo guardado es de otra
    temporada (la primera vuelta de una nueva), sus niveles —que ya traían lo de antes— pasan a `antes`; si no, queda el
    `antes` que había. Pura, y se puede repetir: si la vuelta se corta antes de escribir, la siguiente cierra igual."""
    antes = {k: dict(v) for k, v in ((viejo or {}).get('antes') or {}).items() if isinstance(v, dict)}
    if (viejo or {}).get('temporada') and viejo.get('temporada') != actual:
        for k, xs in (viejo.get('niveles') or {}).items():
            if not isinstance(xs, dict):
                continue
            for est, n in xs.items():
                if n in (1, 2, 3):
                    antes.setdefault(k, {})[est] = max(antes.get(k, {}).get(est, 0), n)
    return {k: dict(sorted(v.items())) for k, v in sorted(antes.items()) if v}


def calcular(eventos, filas, dias, elegidos, desde, clave_de, LLEGO, umbral, norm, base=None):
    """Los niveles de la temporada y el 2.º y 3.º lugar. `base`: lo acumulado de antes (`cerrar_temporada()`), de donde
    arrancan los niveles: se acumula todo.

    `eventos` `{número: estilo}` · `filas` las de `t1_resultados` (`[n, fecha, sv, escala, rapero, país, posición, …]`)
    · `dias` `{número: 'AAAA-MM-DD'}` · `elegidos` `{clave: estilo}` · `desde` `{clave: [estilo, día]}`.
    Devuelve `(niveles {clave: {estilo: nivel}}, ganados {clave: [estilo, estilo]})`: los dos de nivel más alto que no son
    el elegido (en empate, el más reciente)."""
    por_ev = {}
    for f in filas or []:
        if len(f) > 6 and str(f[0]) in eventos:
            por_ev.setdefault(str(f[0]), []).append((f[4], norm(f[6])))
    niv, ult = {}, {}
    # 🔁 lo de las temporadas que cerraron, primero: un estilo en 3 sigue en 3 (y, en un empate, va detrás de lo nuevo)
    for k, xs in (base or {}).items():
        for est, v in (xs or {}).items():
            if v in (1, 2, 3):
                niv[(k, est)], ult[(k, est)] = v, 0
    for n in sorted(por_ev, key=int):
        est, gente, dia = eventos[n], por_ev[n], dias.get(n, '')
        tam = max((LLEGO.get(p, 0) for _, p in gente), default=0)
        tope = umbral(tam) if tam else 0
        for rapero, pos in gente:
            k = clave_de(rapero)
            if not k:
                continue
            d = desde.get(k)
            # el elegido arranca de 0 desde que lo eligió: antes de eso, ese estilo no cuenta para nada
            if elegidos.get(k) == est and d and dia and dia < d[1]:
                continue
            v = max(niv.get((k, est), 0), 1)
            if tope and LLEGO.get(pos, 999) <= tope:
                v = min(3, v + 1)
            niv[(k, est)] = v
            ult[(k, est)] = int(n)
    niveles, ganados = {}, {}
    for (k, est), v in niv.items():
        niveles.setdefault(k, {})[est] = v
    for k, xs in niveles.items():
        otros = sorted((e for e in xs if e != elegidos.get(k)), key=lambda e: (xs[e], ult[(k, e)]), reverse=True)
        if otros:
            ganados[k] = otros[:2]
    return ({k: dict(sorted(v.items())) for k, v in sorted(niveles.items())}, dict(sorted(ganados.items())))


def armar(elegidos, niveles, ganados, catalogo):
    """`{clave: [[estilo, nivel], …]}`: el elegido con su nivel y, si tiene, los del 2.º y 3.º lugar. Lo que no está
    en el catálogo o una clave rara, afuera."""
    out = {}
    for k in sorted(set(elegidos) | set(ganados)):
        if not isinstance(k, str) or not k or k.startswith('_'):
            continue
        xs = niveles.get(k) if isinstance(niveles.get(k), dict) else {}
        fila = []
        j = elegidos.get(k)
        if j in catalogo:
            n = xs.get(j, 0)
            fila.append([j, n if n in (0, 1, 2, 3) else 0])
        for s in (ganados.get(k) or [])[:2]:
            if s in catalogo and s != j:
                n = xs.get(s, 1)
                fila.append([s, n if n in (1, 2, 3) else 1])
        if fila:
            out[k] = fila
    return out


def _escribir(ruta, d):
    with io.open(ruta, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(d, f, ensure_ascii=False, indent=1)
        f.write('\n')


def escribir(gente):
    _escribir(ARCH, dict({'_leeme': LEEME}, **gente))


def _hoy():
    try:
        import zoneinfo
        return datetime.datetime.now(zoneinfo.ZoneInfo('America/New_York')).date().isoformat()
    except Exception:                                    # noqa: BLE001
        return datetime.date.today().isoformat()


def correr(aplicar):
    import estilos_juego as EJ
    import rankings as RK
    from comun.claves import clave as _CL
    from comun.temporada import ACTUAL
    el = traer()
    if el is None:
        print('      🎭 el objeto no contestó lo elegido (¿el Worker sin desplegar?): queda lo de antes')
        return 0
    elegidos = {k: (x or {}).get('juego') for k, x in el.items()
                if isinstance(x, dict) and (x or {}).get('juego') in EJ.CATALOGO and isinstance(k, str) and k}
    viejo = _j(NIVELES, {})
    antes = cerrar_temporada(viejo, ACTUAL)
    if viejo.get('temporada') and viejo.get('temporada') != ACTUAL:
        print('      🎭 temporada nueva (%s → %s): lo de %d personas pasa entero, con sus niveles' % (viejo.get('temporada'), ACTUAL, len(antes)))
    desde = actualizar_desde(viejo.get('desde') or {}, elegidos, _hoy())
    eventos = (_j(EVENTOS, {}).get('eventos') or {})
    filas = (_j(os.path.join(BASE, 'datos', '%s_resultados.json' % ACTUAL), {}).get('filas') or [])
    llaves = _j(os.path.join(BASE, 'datos', 'llaves_%s.json' % ACTUAL), {})
    dias = {str(n): (r or {}).get('dia', '') for n, r in llaves.items() if isinstance(r, dict)}
    niveles, ganados = calcular(eventos, filas, dias, elegidos, desde, _CL, RK.LLEGO, RK._umbral, RK._norm, base=antes)
    gente = armar(elegidos, niveles, ganados, EJ.CATALOGO)
    en_carta = {k: v for k, v in EJ.todos().items() if not k.startswith('_')}
    cambian = sorted(k for k in set(en_carta) | set(gente) if en_carta.get(k) != gente.get(k))
    print('      🎭 %d con estilo de juego · %d eventos de estilo%s' % (
        len(gente), len(eventos), (' · cambian: ' + ', '.join(cambian[:12]) + ('…' if len(cambian) > 12 else ''))
        if cambian else ' · nada cambió'))
    if not aplicar:
        return 0
    # 🎭 de vuelta al objeto: los tres lugares de cada uno y el nivel de cada estilo, para el Inventario (17/11/2026)
    if traer({'lugares': gente, 'niveles': niveles}) is None:
        print('      🎭 los lugares no llegaron al objeto: el Inventario muestra los de la vuelta anterior')
    nuevo_n = {'_leeme': LEEME_N, 'temporada': ACTUAL, 'desde': dict(sorted(desde.items())), 'niveles': niveles,
               'ganados': ganados, 'antes': antes}
    if {k: v for k, v in viejo.items() if k != '_leeme'} != {k: v for k, v in nuevo_n.items() if k != '_leeme'}:
        _escribir(NIVELES, nuevo_n)
    if cambian or not os.path.exists(ARCH):
        escribir(gente)
    return 0


def _self_check():
    import estilos_juego as EJ
    mal = 0

    def ok(c, que):
        nonlocal mal
        print('   %s %s' % ('✅' if c else '❌', que))
        mal += 0 if c else 1

    LLEGO = {'campeon': 1, 'subcampeon': 2, 'tercero': 4, 'cuarto': 4, 'semifinal': 4, 'cuartos': 8, 'octavos': 16}

    def umbral(t):
        return t // 4 if t >= 32 else 4 if t >= 16 else 2
    import unicodedata

    def norm(s):
        """como `rankings._norm()`: sin tildes y en minúsculas («Campeón» → «campeon»)"""
        return ''.join(c for c in unicodedata.normalize('NFKD', str(s)) if not unicodedata.combining(c)).lower().strip()
    clave = str.lower
    # #10 (Punchline, llave de 8 → arriba = la final), #11 (Flow, de 16 → arriba = semis), #12 (Punchline, de 8)
    ev = {'10': 'punchline', '11': 'flow', '12': 'punchline'}
    filas = [[10, '01/11', 'DRA', '8-15', 'Ana', 'ar', 'Campeón'], [10, '01/11', 'DRA', '8-15', 'Beto', 'cl', 'Cuartos'],
             [10, '01/11', 'DRA', '8-15', 'Cami', 'uy', 'Semifinal'], [10, '01/11', 'DRA', '8-15', 'Dani', 'pe', 'Subcampeón'],
             [11, '05/11', 'DRA', '16+', 'Ana', 'ar', 'Semifinal'], [11, '05/11', 'DRA', '16+', 'Beto', 'cl', 'Octavos'],
             [11, '05/11', 'DRA', '16+', 'Dani', 'pe', 'Octavos'],
             [12, '09/11', 'DRA', '8-15', 'Ana', 'ar', 'Subcampeón'], [12, '09/11', 'DRA', '8-15', 'Beto', 'cl', 'Campeón'],
             [99, '09/11', 'FFA', '8-15', 'Ana', 'ar', 'Campeón']]
    dias = {'10': '2026-11-01', '11': '2026-11-05', '12': '2026-11-09'}
    elegidos = {'ana': 'punchline', 'beto': 'flow', 'cami': 'punchline'}
    desde = {'ana': ['punchline', '2026-10-01'], 'beto': ['flow', '2026-11-06'], 'cami': ['punchline', '2026-11-02']}
    niv, seg = calcular(ev, filas, dias, elegidos, desde, clave, LLEGO, umbral, norm)
    ok(niv['ana'] == {'flow': 2, 'punchline': 3},
       'Ana: campeona en la de Punchline (1 + arriba = 2) y en la final de la otra (+1 = 3); semi en una de 16 de Flow: 2')
    ok(niv['beto'] == {'punchline': 2} and seg.get('beto') == ['punchline'],
       'Beto: lo de Flow antes de elegirlo no cuenta; Punchline, que no es el suyo, va a su 2.º lugar')
    ok('cami' not in niv, 'Cami: jugó Punchline antes de elegirlo: arranca de 0')
    ok(niv['dani'] == {'flow': 1, 'punchline': 2} and seg['dani'] == ['punchline', 'flow'],
       'Dani (sin elegir): subcampeona de 8 (arriba: 2) y octavos de 16 (1); primero el de nivel más alto')
    ok(seg['ana'] == ['flow'], 'Ana: los ganados son los que no son el suyo')
    _n, _g = calcular({'1': 'flow', '2': 'burla', '3': 'frio'},
                      [[1, '', '', '', 'Eva', '', 'Campeón'], [1, '', '', '', 'Otro', '', 'Cuartos'],
                       [2, '', '', '', 'Eva', '', 'Cuartos'], [2, '', '', '', 'Otro', '', 'Campeón'],
                       [3, '', '', '', 'Eva', '', 'Cuartos'], [3, '', '', '', 'Otro', '', 'Campeón']],
                      {}, {}, {}, clave, LLEGO, umbral, norm)
    ok(_g['eva'] == ['flow', 'frio'], 'con tres ganados van dos: el de nivel más alto y, en el empate, el más reciente')
    g = armar(elegidos, niv, seg, EJ.CATALOGO)
    ok(g == {'ana': [['punchline', 3], ['flow', 2]], 'beto': [['flow', 0], ['punchline', 2]], 'cami': [['punchline', 0]],
             'dani': [['punchline', 2], ['flow', 1]]},
       'en la carta: el elegido con su nivel (0 si todavía nada) y los ganados; sin elegir, sólo los ganados')
    ok(actualizar_desde({'ana': ['punchline', '2026-10-01'], 'beto': ['frio', '2026-10-01'], 'x': ['flow', '2026-10-01']},
                        {'ana': 'punchline', 'beto': 'flow'}, '2026-11-17')
       == {'ana': ['punchline', '2026-10-01'], 'beto': ['flow', '2026-11-17']},
       'desde: si el estilo sigue, la fecha de antes; si cambió, hoy; si ya no tiene, afuera')
    # 🔁 se acumula todo (Dlx, 20/11/2026): lo de la temporada que cerró es la base de la nueva
    base = cerrar_temporada({'temporada': 't1', 'niveles': {'ana': {'flow': 2, 'punchline': 3}, 'dani': {'frio': 1}},
                             'antes': {'dani': {'frio': 2, 'burla': 1}}}, 't2')
    ok(base == {'ana': {'flow': 2, 'punchline': 3}, 'dani': {'burla': 1, 'frio': 2}}
       and cerrar_temporada({'temporada': 't2', 'niveles': {'ana': {'flow': 3}}, 'antes': base}, 't2') == base
       and cerrar_temporada({}, 't1') == {},
       'al cambiar de temporada lo ganado pasa entero (el nivel más alto); en la misma temporada, `antes` no se toca')
    n2, g2 = calcular({'20': 'flow'}, [[20, '05/01', 'DRA', '8-15', 'Ana', 'ar', 'Campeón'], [20, '05/01', 'DRA', '8-15', 'Eli', 'ar', 'Cuartos']],
                      {'20': '2027-01-05'}, {'ana': 'punchline'}, {'ana': ['punchline', '2026-10-01']}, clave, LLEGO, umbral, norm,
                      base={'ana': {'flow': 2, 'punchline': 3}, 'dani': {'burla': 1, 'frio': 2}})
    ok(n2['ana'] == {'flow': 3, 'punchline': 3} and n2['dani'] == {'burla': 1, 'frio': 2} and g2['dani'] == ['frio', 'burla']
       and n2['eli'] == {'flow': 1} and armar({'ana': 'punchline'}, n2, g2, EJ.CATALOGO)['ana'] == [['punchline', 3], ['flow', 3]],
       'en la T2 se arranca de lo de antes: Ana sube Flow de 2 a 3 y su Punchline sigue en 3; Dani conserva sus dos sin jugar')
    EJ._cache = g
    ok(EJ.de('ana') == [('punchline', 3), ('flow', 2)] and EJ.de('dani') == [('punchline', 2), ('flow', 1)],
       'y lo que escribe, la carta lo entiende (`estilos_juego.de()`)')
    EJ._cache = None
    print('   %s' % ('todo bien' if not mal else '%d mal' % mal))
    return 1 if mal else 0


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    if '--auto' in sys.argv:
        sys.exit(_self_check())
    sys.exit(correr('--aplicar' in sys.argv))
