"""EL TAG DE LA SERVIDOR: titulos por COMBINACION, no por el numero grande.

Dlx: "agregar otros titulos a ellos basado en diferentes combinaciones no solo
en el overall... tambien agregar el tag encima de UL como lo tenemos en el
competitivo".


POR QUE NO REPITE LO QUE YA DICE LA PASTILLA
--------------------------------------------
La carta pasa a llevar DOS piezas de texto premiado, y eso solo funciona si
miden cosas distintas. El reparto es el mismo que ya usa la Competitiva:

    pastilla bajo el numero   el NIVEL. Sale del OVR, igual que su rango sale
                              del Score. Pertenece al numero: si el numero
                              sube, la pastilla sube.
    TAG sobre el UL           QUE CLASE de jugador sos. Sale de combinaciones,
                              y por eso dos personas con el mismo OVR pueden
                              tener TAG distinto.

⚠️ SI ALGUNA VEZ EL TAG SE CUELGA DEL OVR, SOBRA UNA DE LAS DOS. Es la razon
de que la cascada de abajo no mire el OVR ni una vez.


LA FORMA ES LA DE LA COMPETITIVA, EL MATERIAL NO
------------------------------------------------
La cascada, los niveles y el emoji salen de gencomp.py:213. Lo que NO se
copia son los degrades metalicos de .t1/.t2/.t3: CLAUDE.md dice que el
metalico es el lenguaje de la Competitiva y que esta carta no va por ahi.

⚠️ Y TAMPOCO SE PINTA EL TEXTO CON EL ACENTO. Ya mordio cuatro veces: el
acento no tiene croma en 3 de 10 y su claridad va de casi negro a casi
blanco. Aca el fondo del TAG es oscuro propio y el texto va BLANCO, que pasa
siempre; el acento queda en el borde, donde decora y no sostiene la lectura.


✅ LOS DATOS YA EXISTEN, desde el 03/10/2026: `datos/por_servidor.json`
(`sheet/rankings.por_servidor()`) trae lo de cada uno EN CADA servidor, y
desde el 14/10/2026 también sus hechos (`tg`, `sheet/hechos_tags.py`): las
finales ahí, si jugó el primer evento, a quién le ganó. Los umbrales se
midieron contra eso (el catálogo de Dlx, 14/10/2026) y van a quedar cortos
en diciembre: se re-miden con `python sheet/hechos_tags.py --contar`.


LA CASCADA DEL 14/10/2026
-------------------------
Dlx: *«crear más tags… crea muchísimos más y combinaciones para cada
tarjeta»*. De 7 textos a 17, y el piso (🎤 DE LA CASA) pasa de llevarse 3 de
cada 4 a uno de cada tres. Cuatro cosas cambiaron además de sumar:

- 🏰 FORTALEZA en vez del 🏆 CAMPEÓN de t1: eran el MISMO texto en dos
  niveles y se veian iguales salvo el borde.
- 🎖️ INAMOVIBLE (10 podios ahí) se va: no lo tenía nadie; lo cubre
  🏟️ FINALISTA DE CASA.
- los umbrales de EN LLAMAS (5 → 3), DUELISTA (70 → 65 %), PILAR (20 → 15)
  y PODIOS (3 → 2) se bajaron: con los de antes no los tenía nadie.
- ⚠️ LA CARTA DE OTRO SERVIDOR (la «camiseta») tiene su propia cascada, de
  dos: 🧳 VISITANTE ILUSTRE si hizo podio ahí y 🎟️ DE VISITA si no. Un
  «DE LA CASA» o un «FUNDADOR» en la casa de otro dirían algo falso.
"""

# (condicion, texto, nivel) — se evalua EN ORDEN y gana la primera
# ⚠️ EL ORDEN ES LA REGLA. Un campeon del servidor que ademas tiene racha
# muestra CAMPEON, no EN LLAMAS: primero lo que costo mas.
NIVELES = ('t1', 't2', 't3', 't4')


def elegir(d):
    """`(id, texto, nivel)` del TAG. `d`: pos_sv, total_sv, titulos, podios,
    racha, duelos, eventos, `hechos` (el `tg` de ese servidor en
    `datos/por_servidor.json`) y `casa` (False en la carta de otro servidor).

    ⚠️ racha y duelos vienen como texto "actual/maxima" y "ganados/jugados",
    igual que en el resto del proyecto. Leerlos como numero los borra.

    ⚠️ EL `id` ES LO QUE MIRAN LAS OTRAS CARTAS (`hechos_tags.svtag()`): si
    esta dice 🏆 CAMPEÓN, la Temporada no repite su 👑 CAMPEÓN ×N. Cambiar un
    texto no rompe nada; cambiar un `id` hay que buscarlo allá.
    """
    pos = d.get('pos_sv') or 0
    tot = d.get('total_sv') or 0
    tit = d.get('titulos') or 0
    pod = d.get('podios') or 0
    evt = d.get('eventos') or 0
    rch = _par(d.get('racha'))[0]
    dg, dj = _par(d.get('duelos'))
    h = d.get('hechos') or {}

    # 🧳 LA CAMISETA: la carta de un servidor que no es el tuyo
    if d.get('casa') is False:
        if pod >= 1:
            return ('visitante', '\U0001F9F3 VISITANTE ILUSTRE', 't3')
        return ('visita', '\U0001F39F️ DE VISITA', 't4')

    # ── t1 · lo que casi nadie tiene ────────────────────────────────────
    # ⚠️ el umbral de 3 vale igual que en los puestos: ser "1 de 2" no es
    # ser dueño de casa. Es la misma regla que deja pos_sv vacio.
    if pos == 1 and tot >= 3:
        return ('dueno', '\U0001F451 DUEÑO DE CASA', 't1')
    if tit >= 3:
        return ('fortaleza', '\U0001F3F0 FORTALEZA', 't1')
    if pos and tot >= 3 and pos <= max(3, tot * 0.1):
        return ('top', '⭐ TOP DEL SERVIDOR', 't1')
    if h.get('dv'):
        return ('verdugo', '\U0001FA93 VERDUGO DEL DUEÑO', 't1')
    if dj >= 3 and dg == dj:
        return ('invicto', '\U0001F6E1️ INVICTO EN CASA', 't1')
    # ── t2 · lo que distingue ───────────────────────────────────────────
    if rch >= 3:
        return ('llamas', '\U0001F525 EN LLAMAS', 't2')
    if (h.get('fin') or 0) >= 3:
        return ('finalista', '\U0001F3DF️ FINALISTA DE CASA', 't2')
    if dj >= 8 and dg / dj >= 0.65:
        return ('duelista', '⚔️ DUELISTA', 't2')
    if evt >= 15:
        return ('pilar', '\U0001F3DB️ PILAR', 't2')
    if h.get('llave'):
        return ('llave', '\U0001F511 LLAVE DE LA CASA', 't2')
    if h.get('bcasa'):
        return ('buscado', '\U0001F4DC BUSCADO EN CASA', 't2')
    if tit >= 1:
        return ('campeon', '\U0001F3C6 CAMPEÓN', 't2')
    # ── t3 · lo que se ve ───────────────────────────────────────────────
    if h.get('fund'):
        return ('fundador', '\U0001F9F1 FUNDADOR', 't3')
    if pod >= 2:
        return ('podios', '\U0001F3C5 PODIOS', 't3')
    if evt >= 5:
        return ('habitue', '\U0001F4C6 HABITUÉ', 't3')
    # ── t4 · el piso ────────────────────────────────────────────────────
    if h.get('nuevo'):
        return ('nuevo', '\U0001F331 RECIÉN LLEGADO', 't4')
    return ('casa', '\U0001F3A4 DE LA CASA', 't4')


def cascada(d):
    """`(texto, nivel)` del TAG: `elegir()` sin el id."""
    _i, t, k = elegir(d)
    return (t, k)


def _par(v):
    """"8/12" -> (8, 12). Vacio o suelto -> (0, 0)."""
    if not v:
        return (0, 0)
    s = str(v)
    if '/' not in s:
        try:
            return (int(float(s)), 0)
        except ValueError:
            return (0, 0)
    a, b = s.split('/', 1)
    try:
        return (int(float(a or 0)), int(float(b or 0)))
    except ValueError:
        return (0, 0)


def css(y):
    """La parte del TAG que NO depende del servidor.

    ⚠️ EL COLOR VA INLINE Y ESTO NO, a proposito: la hoja de estilos es una
    sola para las diez cartas, asi que todo lo que cambia por servidor tiene
    que viajar en el elemento. Meterlo aca haria que las diez tomaran el color
    de la ultima.

    ⚠️ radio 20 y no 6: la pastilla del rango usa 6, y dos pastillas iguales
    en la misma carta se leen como la misma pieza dicha dos veces. La forma es
    lo unico que las separa a simple vista.
    """
    return f"""
.tagb{{position:absolute;left:50%;transform:translateX(-50%);top:{y}px;
  z-index:9;white-space:nowrap;font-family:'Archivo','LigaEmoji',sans-serif;
  font-size:.54rem;font-weight:900;letter-spacing:1.1px;color:#fff;
  padding:3px 11px 4px;border-radius:20px;
  text-shadow:0 1px 3px rgba(0,0,0,.9);
  box-shadow:0 3px 10px rgba(0,0,0,.6)}}
"""


def div(d, propio, acento, y=None):
    """El TAG. Fondo oscuro propio, texto blanco, acento SOLO en el borde.

    ⚠️ ESTO ES EL TAG, LA PASTILLA DE ARRIBA DEL UL. NO es "el titulo": el
    titulo es la pastilla que va debajo del numero y dice el escalon —
    VETERANO, MAESTRO—. Dlx tuvo que aclararmelo porque yo aplique aca un
    cambio que era para el otro. Son dos piezas distintas y miden cosas
    distintas: el titulo sale del OVR y el TAG de combinaciones.
    """
    from comun.emblema import tono
    t, k = cascada(d)
    # ⚠️ t4, el piso, más apagado que t3: un nivel que se ve igual que otro
    # es el mismo TAG con otras palabras (ver `.tag.t1` de la de País)
    borde = {'t1': f'1.4px solid {acento}',
             't2': f'1px solid {acento}',
             't3': '1px solid rgba(255,255,255,.22)',
             't4': '1px solid rgba(255,255,255,.12)'}[k]
    op = {'t1': 1, 't2': .96, 't3': .92, 't4': .84}[k]
    # ⚠️ EL `top` VIENE POR ESTILO EN LINEA CUANDO LO MANDAN, y no es capricho:
    # la regla .tagb del CSS es UNA SOLA para todas las cartas de la hoja, y
    # la Servidor necesita que el TAG se acomode a cuantos circulos tenga cada
    # una. Sin dato se queda donde diga el CSS.
    pos = f'top:{y}px;' if y is not None else ''
    return (f'<div class="tagb" style="{pos}background:{tono(propio, -.55)};'
            f'border:{borde};opacity:{op}">{t}</div>')


if __name__ == '__main__':
    import sys
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    # (que, d, el id que tiene que salir)
    pruebas = [
        ('el 1 de un servidor grande', dict(pos_sv=1, total_sv=79), 'dueno'),
        ('el 1 de uno de 2', dict(pos_sv=1, total_sv=2), 'casa'),
        ('4 titulos', dict(pos_sv=12, total_sv=79, titulos=4), 'fortaleza'),
        ('top 10%', dict(pos_sv=5, total_sv=79), 'top'),
        ('le ganó al dueño', dict(pos_sv=30, total_sv=79, hechos={'dv': 1}), 'verdugo'),
        ('duelos 4/4', dict(pos_sv=30, total_sv=79, duelos='4/4'), 'invicto'),
        ('racha 3', dict(pos_sv=30, total_sv=79, racha='3/9'), 'llamas'),
        ('3 finales', dict(pos_sv=30, total_sv=79, hechos={'fin': 3}), 'finalista'),
        ('duelos 9/12', dict(pos_sv=30, total_sv=79, duelos='9/12'), 'duelista'),
        ('duelos 5/12', dict(pos_sv=30, total_sv=79, duelos='5/12'), 'casa'),
        ('16 eventos', dict(pos_sv=30, total_sv=79, eventos=16), 'pilar'),
        ('la mitad de los eventos', dict(pos_sv=30, total_sv=79, eventos=4, hechos={'llave': 1}), 'llave'),
        ('Dueño de Casa del MW', dict(pos_sv=30, total_sv=79, hechos={'bcasa': 1}), 'buscado'),
        ('1 titulo', dict(pos_sv=40, total_sv=79, titulos=1), 'campeon'),
        ('el primer evento', dict(pos_sv=40, total_sv=79, hechos={'fund': 1}), 'fundador'),
        ('2 podios', dict(pos_sv=60, total_sv=79, podios=2), 'podios'),
        ('6 eventos', dict(pos_sv=60, total_sv=79, eventos=6), 'habitue'),
        ('llegó esta semana', dict(pos_sv=70, total_sv=79, eventos=1, hechos={'nuevo': 1}), 'nuevo'),
        ('nada', dict(pos_sv=70, total_sv=79), 'casa'),
        ('camiseta con podio', dict(titulos=3, podios=4, casa=False), 'visitante'),
        ('camiseta sin podio', dict(eventos=9, casa=False), 'visita'),
    ]
    print('LA CASCADA DEL TAG, en orden\n')
    mal = 0
    for q, d, esp in pruebas:
        i, t, k = elegir(d)
        mal += i != esp
        print('   %s %-26s %-24s %s' % ('✅' if i == esp else '🔴 (%s)' % esp, q, t, k))
    textos = {}
    for _q, d, _e in pruebas:
        i, t, k = elegir(d)
        textos.setdefault(t, set()).add(k)
    dobles = [t for t, ks in textos.items() if len(ks) > 1]
    mal += bool(dobles)
    print('\n   %s ningún texto en dos niveles%s' % ('🔴' if dobles else '✅', (': %s' % dobles) if dobles else ''))
    print('\n   cuántos ven cada uno, sobre datos/: python sheet/hechos_tags.py --contar')
    sys.exit(1 if mal else 0)
