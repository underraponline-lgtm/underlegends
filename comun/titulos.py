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


⚠️ NINGUNO DE ESTOS DATOS EXISTE TODAVIA
----------------------------------------
Partido por servidor el Sheet tiene UN numero: los puntos (ver
03_Servidor/disenos/ovr_que_mide.py). Titulos, podios, racha, duelos y
eventos POR SERVIDOR no se pueden derivar de ahi, los tiene que traer el bot.

Los umbrales de abajo estan puestos contra el reparto GLOBAL, que es la cota
optimista: por servidor cada numero es un pedazo de ese, asi que cuando
lleguen los datos reales hay que volver a mirarlos o casi todos van a caer en
el piso de la cascada.
"""

# (condicion, texto, nivel) — se evalua EN ORDEN y gana la primera
# ⚠️ EL ORDEN ES LA REGLA. Un campeon del servidor que ademas tiene racha
# muestra CAMPEON, no EN LLAMAS: primero lo que costo mas.
NIVELES = ('t1', 't2', 't3')


def cascada(d):
    """d: dict con pos_sv, total_sv, titulos, podios, racha, duelos, eventos.

    ⚠️ racha y duelos vienen como texto "actual/maxima" y "ganados/jugados",
    igual que en el resto del proyecto. Leerlos como numero los borra.
    """
    pos = d.get('pos_sv') or 0
    tot = d.get('total_sv') or 0
    tit = d.get('titulos') or 0
    pod = d.get('podios') or 0
    evt = d.get('eventos') or 0
    rch = _par(d.get('racha'))[0]
    dg, dj = _par(d.get('duelos'))

    # ⚠️ el umbral de 3 vale igual que en los puestos: ser "1 de 2" no es
    # ser dueño de casa. Es la misma regla que deja pos_sv vacio.
    if pos == 1 and tot >= 3:
        return ('\U0001F451 DUEÑO DE CASA', 't1')
    if tit >= 3:
        return ('\U0001F3C6 CAMPEÓN', 't1')
    if pos and tot >= 3 and pos <= max(3, tot * 0.1):
        return ('⭐ TOP DEL SERVIDOR', 't1')
    if rch >= 5:
        return ('\U0001F525 EN LLAMAS', 't2')
    if dj >= 8 and dg / dj >= 0.7:
        return ('⚔️ DUELISTA', 't2')
    if pod >= 10:
        return ('\U0001F396️ INAMOVIBLE', 't2')
    if evt >= 20:
        return ('\U0001F3DB️ PILAR', 't2')
    if tit >= 1:
        return ('\U0001F3C6 CAMPEÓN', 't2')
    if pod >= 3:
        return ('\U0001F3C5 PODIOS', 't3')
    return ('\U0001F3A4 DE LA CASA', 't3')


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
    borde = {'t1': f'1.4px solid {acento}',
             't2': f'1px solid {acento}',
             't3': '1px solid rgba(255,255,255,.22)'}[k]
    op = {'t1': 1, 't2': .96, 't3': .92}[k]
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
    pruebas = [
        ('el 1 de un servidor grande', dict(pos_sv=1, total_sv=79)),
        ('el 1 de uno de 2', dict(pos_sv=1, total_sv=2)),
        ('4 titulos', dict(pos_sv=12, total_sv=79, titulos=4)),
        ('top 10%', dict(pos_sv=5, total_sv=79)),
        ('racha 6', dict(pos_sv=30, total_sv=79, racha='6/9')),
        ('duelos 9/12', dict(pos_sv=30, total_sv=79, duelos='9/12')),
        ('11 podios', dict(pos_sv=30, total_sv=79, podios=11)),
        ('24 eventos', dict(pos_sv=30, total_sv=79, eventos=24)),
        ('1 titulo', dict(pos_sv=40, total_sv=79, titulos=1)),
        ('4 podios', dict(pos_sv=60, total_sv=79, podios=4)),
        ('nada', dict(pos_sv=70, total_sv=79)),
    ]
    print('LA CASCADA DEL TAG, en orden\n')
    for q, d in pruebas:
        t, k = cascada(d)
        print('   %-28s %-22s %s' % (q, t, k))
    print('\n⚠️ ninguno de estos datos existe todavia por servidor: los trae'
          '\n   el bot. Los umbrales estan contra el reparto GLOBAL, que es la'
          '\n   cota optimista.')
