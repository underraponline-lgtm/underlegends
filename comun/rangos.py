"""LOS OCHO RANGOS: su color y su figura.

El rango sale del Score competitivo y es UNO SOLO POR PERSONA: el mismo en
todas sus cartas. Esto no lo decide ninguna carta, lo decide el Score.


⚠️ EL COLOR NO SE COPIA DE ACA: SE VERIFICA CONTRA gencomp.py
-------------------------------------------------------------
La paleta nace en 02_Competitivo/v2/gencomp.py, que es la carta que la
inventa. Este modulo la repite para que las otras no tengan que importar un
script que genera al importarse.

Repetir un valor es exactamente el problema que este proyecto ya pago tres
veces. Por eso `verificar()` LEE gencomp.py y compara: si alguna vez se
tocan alla y no aca, revienta con el detalle. Corre sola al ejecutar este
archivo, y la puede llamar cualquier test.


LA FIGURA
---------
Dlx: "que quizas la forma cambie dependiendo del rango, por ejemplo el SS
creo que era color diamante no?".

⚠️ LA MEDICION DIO VUELTA MI PRIMER ARGUMENTO. Yo iba a justificarlo diciendo
que los colores se confunden. NO SE CONFUNDEN: de los 28 pares, CERO estan
por debajo de dE 20, y el mas parecido —SS contra D— esta en 25.0. Puestos
uno al lado del otro los ocho se distinguen bien.

Lo que si es cierto son dos cosas distintas:

1. NUNCA SE VEN DOS JUNTOS. La carta cae sola en Discord. El problema no es
   distinguir dos muestras, es NOMBRAR UNA DE OCHO DE MEMORIA, que es otra
   tarea y mucho mas dificil. La medicion de pares contesta la pregunta
   equivocada.

2. EN CLARO/OSCURO SE APELMAZAN. Que es como se ve en miniatura, sobre un
   fondo cualquiera, o con daltonismo:

       A  vs SSS   0.7 de L*
       SS vs D     0.9 de L*
       S  vs SS    1.4 de L*

   La figura se lee sin color. El color solo, no.

⚠️ POR ESO LAS FIGURAS SE ASIGNAN CONTRA ESOS PARES, no por gusto: los tres
pares de arriba tienen que quedar en siluetas MUY distintas, o la figura no
arregla nada.

    SS rombo    vs  D cuadrado   -> punta arriba contra lado plano
    A hexagono  vs  SSS estrella -> lleno contra puntas
    S circulo   vs  SS rombo     -> sin esquinas contra cuatro

Y el reparto de gente manda sobre cuales tienen que separarse mejor:

    SSS   1    0.7%          A   27  19.6%
    SS    5    3.6%          B   25  18.1%
    S     8    5.8%          C   36  26.1%
    E    10    7.2%          D   26  18.8%

Los cuatro del medio son 114 de 138 —el 83%— asi que A, B, C y D son los que
mas se van a ver y los que MAS TIENEN QUE DISTINGUIRSE ENTRE SI. Los de
arriba se ven poco, pero tienen que verse ESPECIALES.

⚠️ Por eso D NO es un rombo. Cuadrado y rombo son la misma figura girada, y
D es justo el rango que mas se parece a SS en luz (0.9 de L*). Habria sido
elegir la peor combinacion posible sin darse cuenta.
"""

# ── el color, espejo de gencomp.py:19-26 ─────────────────────────────────
ACENTO = {
    'SSS': '#C77DFF',   # amatista
    'SS':  '#8FE8FF',   # diamante
    'S':   '#FFD24A',   # oro
    'A':   '#FF6B7A',   # rubi
    'B':   '#5CE6A5',   # esmeralda
    'C':   '#6B8FE8',   # zafiro
    'D':   '#D8DEE8',   # plata
    'E':   '#C98A4B',   # bronce
}
ORDEN = ['SSS', 'SS', 'S', 'A', 'B', 'C', 'D', 'E']
MATERIAL = {'SSS': 'amatista', 'SS': 'diamante', 'S': 'oro', 'A': 'rubi',
            'B': 'esmeralda', 'C': 'zafiro', 'D': 'plata', 'E': 'bronce'}

# ── umbrales, de CLAUDE.md y gencomp.py:106 ──────────────────────────────
UMBRAL = [('SSS', 82), ('SS', 73), ('S', 62), ('A', 48),
          ('B', 37), ('C', 26), ('D', 18)]


def de_score(s):
    """El rango que le toca a ese Score. E es el resto."""
    for r, t in UMBRAL:
        if s >= t:
            return r
    return 'E'


# ── la figura, en un viewBox de 100x100 centrado ─────────────────────────
#
# ⚠️ EL PRIMER JUEGO DE FIGURAS FALLO Y LA MEDICION LO DIJO. Yo las habia
# elegido por CANTIDAD DE LADOS —hexagono, octagono, escudo, cuadrado— y a
# 26 px sin color dieron esto (IoU, interseccion sobre union):
#
#     A vs B 0.847   B vs D 0.836   A vs D 0.820   A vs C 0.769
#
# o sea que los CUATRO DEL MEDIO —114 de 138, el 83% de la gente— estaban
# todos entre 0.75 y 0.85. Se confundian.
#
# EL MOTIVO, y es lo que hay que recordar: contar lados NO separa siluetas.
# Un hexagono, un octagono, un escudo y un cuadrado son todos BLOQUES
# CONVEXOS que llenan casi lo mismo de su caja —33.0%, 34.4%, 32.6%, 34.2%—
# y dos figuras que tapan la misma area se parecen aunque se describan
# distinto. Las unicas dos que se separaban solas eran las que llenaban
# POCO: la estrella (23.6%) y el triangulo (27.4%).
#
# LO QUE SI SEPARA es cuanto llenan y HACIA DONDE VAN. Por eso el juego de
# ahora mezcla llenos con puntas y, sobre todo, cruza las proporciones:
#
#     A  alto y angosto      va para arriba
#     B  ancho y chato       va para los costados
#     C  marquesa apuntada   angosta y hueca a los lados
#     D  cuadrado            el unico neutro
#
# A y B son perpendiculares a proposito: son el par mas visto de los cuatro.
FIGURA = {
    # amatista: seis puntas. La unica con puntas hacia afuera, y hay UNA.
    'SSS': ('M50 2 L61 32 L92 22 L74 50 L92 78 L61 68 L50 98 L39 68 '
            'L8 78 L26 50 L8 22 L39 32 Z'),
    # diamante: EL CORTE BRILLANTE DE PERFIL, no un rombo.
    # Dlx: "el diamante no va a ser un rombo". Y tiene razon: un rombo es un
    # cuadrado girado, no un diamante. El brillante de verdad tiene TABLA
    # plana arriba, corona que se abre hasta el cinturon en el tercio de
    # arriba, y pabellon largo que baja a la punta. Esa asimetria
    # arriba/abajo es justo lo que lo hace leer como piedra tallada y no
    # como figura geometrica.
    'SS':  'M23 16 L77 16 L96 39 L50 97 L4 39 Z',
    # oro: la moneda. Es la mas llena, y hace de ancla del otro extremo.
    'S':   'M50 3 A47 47 0 1 1 49.9 3 Z',
    # rubi: hexagono ALTO Y ANGOSTO. Antes era ancho y se comia a B y a D.
    'A':   'M50 1 L79 21 L79 79 L50 99 L21 79 L21 21 Z',
    # esmeralda: el corte esmeralda de verdad, ANCHO Y CHATO. Perpendicular
    # a A, que es el rango con el que mas se cruza.
    'B':   'M17 27 L83 27 L99 43 L99 57 L83 73 L17 73 L1 57 L1 43 Z',
    # zafiro: marquesa. Apuntada arriba y abajo y hueca a los costados: es
    # lo que la separa del hexagono, que tambien es alto pero lleno.
    # ⚠️ ANCHA, no fina. Con la curva mas cerrada tapaba 15% contra el 34%
    # del cuadrado, y C es EL RANGO MAS NUMEROSO —36 de 138—: la figura mas
    # flaca le habria tocado justo a la mayoria de la gente.
    'C':   'M50 1 Q93 50 50 99 Q7 50 50 1 Z',
    # plata: LINGOTE. Trapecio ancho y chato, mas angosto arriba que abajo,
    # que es como se ve una barra de plata apoyada.
    #
    # ⚠️ ERA UN CUADRADO Y EL CUADRADO SE CONFUNDIA. La idea escrita aca era
    # que fuera "el unico neutro, el que contrasta con los tres de arriba sin
    # parecerse a ninguno", y medido al tamaño de la carta pasaba lo contrario:
    # ser neutro es NO TENER DIRECCION, y una figura sin direccion se solapa
    # con todas. El cuadrado estaba en 3 de los 5 peores pares.
    #
    #     cuadrado vs circulo   0.82   <- el juego anterior se tiro con 0.85
    #     cuadrado vs diamante  0.70
    #     cuadrado vs rubi      0.69
    #
    # El lingote tiene la direccion que le faltaba —se ensancha hacia abajo—
    # y pasa a ser la figura MAS despegada del juego: su peor par es 0.62,
    # contra la esmeralda, que tambien es ancha.
    #
    #     peor par del juego   0.823 -> 0.706
    #     promedio             0.597 -> 0.533
    #     pares arriba de .75      1 -> 0
    #
    # ⚠️ EL GROSOR SE MIDIO, NO SE ELIGIO. A 32 de alto se separa mejor —0.52
    # contra la esmeralda— pero a 20 px se lee como un guion; a 56 sube a
    # 0.64. Queda en 44: solido y todavia lejos.
    'D':   'M12 28 L88 28 L94 72 L6 72 Z',
    # bronce: triangulo, la figura mas simple del juego.
    'E':   'M50 4 L96 90 L4 90 Z',
}

# Cuanto ocupa cada figura de su caja: un triangulo con la misma caja que un
# circulo se ve la mitad. Se compensa aca para que las ocho PESEN parecido.
#
# ⚠️ Compensar el peso NO es igualar el area: si todas taparan lo mismo
# volveriamos al problema de arriba. Se empareja lo justo para que ningun
# rango se lea como "menos" por dibujarse mas chico.
# ⚠️ D SE QUEDA EN 0.98 Y ESO SE MIDIO DESPUES DE EQUIVOCARME. Yo lo habia
# subido a 1.04 razonando que el lingote es ancho y chato —su lado mayor ocupa
# 88 de 100 contra los 94 del circulo— y que a la misma escala se veria mas
# chico. El razonamiento suena bien y el numero lo desmiente por los dos lados:
#
#     escala   presencia   lingote vs esmeralda
#      0.98      0.92            0.62
#      1.10      1.03            0.88   <- se confunden
#      1.20      1.12            0.82
#
# La presencia que ganaba era del 11% y el parecido con la esmeralda subia 26
# puntos, porque las dos son ANCHAS: agrandar una la mete adentro de la otra.
# Y 0.92 no es "mas chico", es practicamente el mismo lado mayor.
ESCALA = {'SSS': 1.16, 'SS': 1.06, 'S': 1.00, 'A': 1.12,
          'B': 1.12, 'C': 1.16, 'D': 0.98, 'E': 1.16}


# ── LAS FACETAS ──────────────────────────────────────────────────────────
# Una silueta plana se lee como icono; con caras se lee como PIEDRA TALLADA.
# Cada faceta es (camino, luz) con luz de -1 a 1: positivo aclara, negativo
# oscurece. Se pintan ENCIMA del relleno y DENTRO de la silueta.
#
# ⚠️ Las facetas NO cambian la silueta, y eso es a proposito: la silueta es
# lo unico que sobrevive a 26 px sobre un fondo cualquiera, y es lo que se
# midio con IoU. Las caras son el premio de mirarla de cerca, no lo que la
# hace reconocible. Si alguna vez una faceta se sale del contorno, se
# rompen las dos cosas a la vez.
#
# La luz entra de arriba a la izquierda, igual que en las estrellas del
# emblema (comun/emblema.py). Que dos piezas de la misma carta tengan el sol
# en lugares distintos se nota aunque nadie sepa decir por que.
FACETAS = {
    # amatista: nucleo levantado y puntas alternadas
    'SSS': [('M50 2 L61 32 L50 50 L39 32 Z', .40),
            ('M8 22 L39 32 L50 50 L26 50 Z', .18),
            ('M92 22 L61 32 L50 50 L74 50 Z', -.26),
            ('M50 50 L61 68 L50 98 L39 68 Z', -.40),
            ('M26 50 L39 68 L50 98 L8 78 Z', -.14)],
    # diamante: tabla, corona en cuatro y pabellon partido al medio
    'SS':  [('M23 16 L77 16 L67 30 L33 30 Z', .55),      # la tabla
            ('M23 16 L33 30 L14 39 L4 39 Z', .26),       # corona izq
            ('M77 16 L67 30 L86 39 L96 39 Z', -.20),     # corona der
            ('M4 39 L50 97 L50 55 Z', .10),              # pabellon izq
            ('M96 39 L50 97 L50 55 Z', -.34),            # pabellon der
            ('M14 39 L86 39', 0)],                       # el cinturon
    # oro: es metal, no piedra. El canto biselado y el aro de moneda acuñada.
    #
    # 🔴 REHECHO EL 19/09/2026. Dlx: «el icono del rango DORADO, ese que es un
    # circulo, se ve bien raro y apagado». Y el numero lo confirmaba: tenia
    # DOS facetas contra las 3-6 del resto, y una de las dos era un -0.10 que
    # cubria el 84 % del disco, o sea que APLANABA el degrade en vez de dar
    # forma. Rango de contraste +0.45 / -0.10 contra el +0.55 / -0.44 de los
    # demas: era, medido, el menos modelado de los ocho.
    #
    # ⚠️ EL PROBLEMA DE FONDO ERA GEOMETRICO. Las siete piedras sacan sus
    # planos DE LAS ARISTAS DE SU SILUETA —el diamante tiene tabla y corona
    # porque su contorno las marca—; un circulo no tiene ninguna, asi que
    # cualquier faceta que se le pinte encima es un dibujo pegado. Lo unico
    # que un circulo SI tiene como geometria propia es **el canto**.
    #
    # ⚠️ Y LAS DOS LUNAS SON DOS CIRCULOS DESPLAZADOS, no dos medias lunas.
    # La primera version las corto en radial y el corte se leia como si al
    # canto le faltara un pedazo. Dos circulos de igual radio con el centro
    # corrido dan una luna gruesa de un lado que se va a cero del otro:
    # termina en punta sola, y ademas es como cae la luz sobre un canto
    # redondo. r=47 en (50,50) contra r=47 en (56,56) se cortan en
    # (86.1, 19.9) y (19.9, 86.1).
    #
    # ⚠️ LA SILUETA NO SE TOCO. El circulo esta elegido midiendo IoU contra
    # las otras siete —«S circulo vs SS rombo: sin esquinas contra cuatro»—,
    # asi que cambiarlo tiraria abajo una separacion ya verificada.
    'S':   [('M86.1 19.9 A47 47 0 0 0 19.9 86.1 A47 47 0 0 1 86.1 19.9 Z', .56),
            ('M13.9 80.1 A47 47 0 0 0 80.1 13.9 A47 47 0 0 1 13.9 80.1 Z', -.40),
            ('M50 14 A36 36 0 0 1 50 86 A36 36 0 0 1 50 14 Z', -.14),
            ('M27 33 A31 31 0 0 1 73 33 A39 39 0 0 0 27 33 Z', .42),
            ('M50 14 A36 36 0 0 1 50 86 A36 36 0 0 1 50 14 Z', 0)],
    # rubi: corona de seis y fondo en punta
    'A':   [('M50 1 L79 21 L50 40 L21 21 Z', .42),
            ('M21 21 L50 40 L50 62 L21 79 Z', .12),
            ('M79 21 L50 40 L50 62 L79 79 Z', -.28),
            ('M21 79 L50 62 L79 79 L50 99 Z', -.42)],
    # esmeralda: corte escalonado, que es lo que define al corte esmeralda
    'B':   [('M17 27 L83 27 L74 38 L26 38 Z', .40),
            ('M26 38 L74 38 L74 62 L26 62 Z', .14),
            ('M1 43 L17 27 L26 38 L11 50 Z', .30),
            ('M99 43 L83 27 L74 38 L89 50 Z', -.22),
            ('M26 62 L74 62 L83 73 L17 73 Z', -.38)],
    # zafiro: la marquesa se parte a lo largo, que es como se talla
    'C':   [('M50 1 Q28 50 50 99 Q7 50 50 1 Z', .34),
            ('M50 1 Q72 50 50 99 Q93 50 50 1 Z', -.26),
            ('M50 12 Q70 50 50 88 Q30 50 50 12 Z', .16)],
    # plata: es metal. Bisel de placa, no caras de piedra. Las cuatro caras
    # siguen los cuatro lados del lingote, asi que el bisel se abre hacia
    # abajo junto con el.
    'D':   [('M12 28 L88 28 L82 38 L18 38 Z', .46),
            ('M12 28 L18 38 L14 62 L6 72 Z', .24),
            ('M88 28 L82 38 L86 62 L94 72 Z', -.24),
            ('M6 72 L14 62 L86 62 L94 72 Z', -.44)],
    # bronce: tres caras, la mas simple de todas
    'E':   [('M50 4 L73 47 L27 47 Z', .40),
            ('M27 47 L50 47 L50 90 L4 90 Z', .14),
            ('M73 47 L50 47 L50 90 L96 90 Z', -.32)],
}


# ⚠️ EL RELLENO NO SE PUEDE COPIAR: ES ESTA FUNCION. Son 33 caminos de facetas
# mas el degrade y los dos filos, y basta que una carta los reescriba para que
# se separen. Por eso el cuerpo vive aparte y los dos envoltorios lo comparten.
#
# ⚠️ Y LOS DOS ENVOLTORIOS SON DE LA SERVIDOR, NO UNO DE CADA CARTA. Yo escribi
# que svg() "es la que usa la Competitiva" y es FALSO: gencomp.py no importa
# este modulo. Sus "rombos" son las MEDALLAS DE EVENTO —oro, plata, bronce— y
# no tienen nada que ver con las figuras del rango. Lo unico que comparte con
# este archivo son los COLORES, y para eso esta verificar().
#
# O sea que hoy las ocho figuras las dibuja UNA SOLA CARTA. Igual viven aca:
# el rango es de la Liga y no de un servidor, y si Pais o Historico lo muestran
# van a salir de este archivo.
PAD_ICONO = 7      # cuanto se agranda el viewBox del icono, ver icono()

# ⚠️ HASTA DONDE LLEGA LA TINTA DE CADA FIGURA, como fraccion del `lado` que
# se le pide a icono(). Sirve para meterlas en un circulo sin que toquen el
# borde, y NO se puede deducir de la silueta por dos razones:
#
#   1. cuenta el FILO. El trazo negro es de 9 y sale 4.5 unidades del path
#      —la mitad, porque va con paint-order:stroke—, asi que la tinta llega
#      mas lejos que el camino.
#   2. cuenta ESCALA. Cada rango se dibuja a su propio tamaño, asi que dos
#      figuras con la misma silueta llegarian distinto.
#
# Medido renderizando cada icono suelto y buscando el pixel pintado mas lejos
# del centro de su caja. Un valor de 0.50 seria "justo en el borde de un
# circulo de diametro `lado`".
#
# ⚠️ MIRAR EL BRONCE. Un triangulo tiene las esquinas de abajo MUY lejos del
# centro, y encima E es de los que mas ESCALA tienen: llega a 0.73, o sea que
# se sale casi la mitad del radio. Con GEMA_LLENA .74 la punta caia en 0.539
# del diametro y el circulo la RECORTABA. No se veia como error porque el
# recorte es limpio y redondo: parecia un triangulo con las esquinas comidas.
#
# ⚠️ Y LOS NUMEROS SALEN DE ITERAR, no de medir la figura suelta. Medirla
# aparte y aplicar el resultado a otro tamaño NO DIO: al mismo rango le salio
# 0.639 a lado 100, 0.646 a lado 60, y se comporta como 0.706 a lado 18. La
# diferencia es del renderizado —antialias del filo, redondeos— y no hace
# falta explicarla: se mide EL AIRE EN EL CIRCULO, que es lo que importa, y
# se sube R_TINTA hasta que ninguna figura se pasa. Convergio en tres vueltas.
#
# Verificado despues: aire minimo 1.56 px con circulo de 26, 1.79 con 31 y
# 1.97 con 35. Ninguna toca.
R_TINTA = {
    'SSS': 0.670, 'SS': 0.571, 'S': 0.578, 'A': 0.616,
    'B': 0.623, 'C': 0.636, 'D': 0.551, 'E': 0.808,
}


def _cuerpo(rg, sufijo):
    """Defs, silueta, facetas y filo. Sin envoltorio y sin posicion."""
    c = ACENTO[rg]
    caras = []
    for d, luz in FACETAS.get(rg, ()):
        if not luz:                                   # trazo, no cara
            caras.append(f'<path d="{d}" fill="none" '
                         f'stroke="rgba(255,255,255,.5)" stroke-width="2.2"/>')
            continue
        col = '255,255,255' if luz > 0 else '0,0,0'
        caras.append(f'<path d="{d}" fill="rgba({col},{abs(luz):.2f})"/>')
    return (
      f'<defs><linearGradient id="g{sufijo}" x1="0.12" y1="0" x2="0.88" y2="1">'
      f'<stop offset="0" stop-color="{_encender(c, .58)}"/>'
      f'<stop offset=".48" stop-color="{c}"/>'
      f'<stop offset="1" stop-color="{_apagar(c, .48)}"/></linearGradient>'
      f'<clipPath id="k{sufijo}"><path d="{FIGURA[rg]}"/></clipPath></defs>'
      f'<path d="{FIGURA[rg]}" fill="url(#g{sufijo})" stroke="rgba(0,0,0,.75)" '
      f'stroke-width="9" stroke-linejoin="round" paint-order="stroke"/>'
      f'<g clip-path="url(#k{sufijo})">{"".join(caras)}</g>'
      f'<path d="{FIGURA[rg]}" fill="none" stroke="rgba(255,255,255,.55)" '
      f'stroke-width="3.5" stroke-linejoin="round"/>')


def svg(rg, lado, cx, cy, sufijo, clase='fig'):
    """La pieza completa, POSICIONADA en absoluto por su centro.

    ⚠️ NO ES "LA DE LA COMPETITIVA", que es lo que yo habia escrito aca. La
    usan las hojas de exploracion de la Servidor —columna.py, derecha.py,
    pie_num.py—, que colocan la figura a mano en vez de dejarsela al flex.
    La carta terminada usa icono().
    """
    L = lado * ESCALA[rg]
    return (
      f'<svg class="{clase}" width="{L:.1f}" height="{L:.1f}" '
      f'viewBox="0 0 100 100" style="left:{cx - L/2:.1f}px;top:{cy - L/2:.1f}px">'
      + _cuerpo(rg, sufijo) + '</svg>')


def icono(rg, lado, sufijo, r_max=None):
    """La MISMA pieza, en linea, para meterla adentro de un circulo.

    ⚠️ NO ES OTRA FIGURA NI UNA VERSION SIMPLIFICADA. Mismo degrade, mismas
    facetas, mismos dos filos. Lo unico que cambia es el envoltorio, y cambia
    por dos razones concretas:

    1. SIN POSICION ABSOLUTA, porque adentro del circulo la centra el flex.
    2. CON EL viewBox AGRANDADO. El filo negro es de 9 y sale 4.5 unidades
       del path; con el viewBox en 0 0 100 100 se recorta JUSTO EN LAS PUNTAS,
       que a 20 px es donde se decide si la figura se reconoce. svg() vive con
       ese recorte porque dibuja a 30-44 px y la punta recortada es medio
       pixel; aca seria el 5% de la pieza.

    `lado` es el tamaño de LO PINTADO, no el de la caja: el envoltorio se
    agranda solo para compensar el padding del viewBox. Asi el que llama pide
    "quiero 19 px de figura" y le entran 19, no 19 menos el borde. Ojo que
    ESCALA sigue multiplicando: `lado` es la referencia, no el resultado.

    ⚠️ `r_max` ES EL RADIO QUE NO SE PUEDE PASAR, en px, y existe porque el
    continente de la Servidor es REDONDO. Una caja cuadrada adentro de un
    circulo tiene las esquinas afuera, asi que el limite no es el lado sino
    el radio de LA TINTA, que es lo que mide R_TINTA. Si la figura no llega,
    no se toca: el tope recorta, no empareja. Emparejar los radios haria que
    la estrella y el triangulo —que llegan lejos con poca tinta— se dibujaran
    tan grandes como el circulo macizo.
    """
    if r_max:
        tope = r_max / max(1e-6, lado * R_TINTA[rg])
        if tope < 1:
            lado *= tope
    L = lado * ESCALA[rg] * (100 + 2 * PAD_ICONO) / 100
    vb = f'{-PAD_ICONO} {-PAD_ICONO} {100 + 2 * PAD_ICONO} {100 + 2 * PAD_ICONO}'
    return (f'<svg width="{L:.1f}" height="{L:.1f}" viewBox="{vb}">'
            + _cuerpo(rg, sufijo) + '</svg>')


def _encender(c, f):
    h = c.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    k = 1 + (255 / max(r, g, b, 1) - 1) * f
    return '#%02X%02X%02X' % tuple(min(255, int(x * k)) for x in (r, g, b))


def _apagar(c, f):
    h = c.lstrip('#')
    return '#%02X%02X%02X' % tuple(int(int(h[i:i + 2], 16) * (1 - f))
                                   for i in (0, 2, 4))


def verificar(ruta=None):
    """Compara la paleta con gencomp.py y revienta si se separaron.

    ⚠️ Existe porque el sintoma de la copia desincronizada es el SILENCIO:
    todo sigue corriendo y las dos cartas de la misma persona salen de dos
    colores distintos sin que nada avise.
    """
    import os
    import re
    if ruta is None:
        ruta = os.path.join(os.path.dirname(os.path.dirname(
            os.path.abspath(__file__))), '02_Competitivo', 'v2', 'gencomp.py')
    txt = open(ruta, encoding='utf-8').read()
    hall = dict(re.findall(r"'(SSS|SS|S|A|B|C|D|E)'\s*:\s*\('(#[0-9A-Fa-f]{6})'",
                           txt))
    if not hall:
        raise RuntimeError('no encontre la paleta en %s' % ruta)
    mal = {r: (ACENTO.get(r), hall.get(r)) for r in set(ACENTO) | set(hall)
           if ACENTO.get(r) != hall.get(r)}
    if mal:
        raise RuntimeError(
            'la paleta de rangos se separo de gencomp.py:\n' +
            '\n'.join('  %-4s  aca %s  <->  alla %s' % (r, a, b)
                      for r, (a, b) in sorted(mal.items())))
    return len(hall)


# ── LOS UMBRALES ESTAN COPIADOS EN CUATRO ARCHIVOS ──────────────────────
# Y NADA LOS COMPARABA. verificar() miraba solo los COLORES, asi que la
# paleta estaba cuidada y los numeros que deciden el rango no.
#
#     sheet/construir_pool_competitivo.py   los aplica al armar el pool
#     comun/rangos.py                        este
#     01_Temporada/normal_v3.py              para la letra de la Temporada
#     02_Competitivo/v2/gencomp.py           para la pastilla de la Competitiva
#
# ⚠️ Y JUSTO ESE ES EL NUMERO QUE LA T1 VA A CAMBIAR. El rework lleva el Score
# a 40-99 (cambio 7) y con eso los umbrales de hoy —82/73/62/48/37/26/18—
# dejan de servir: nadie bajaria de 40, asi que B, C, D y E se vacian. Quien
# recalibre va a tocar UNO de los cuatro archivos y las tres cartas van a
# decir rangos distintos de la misma persona, EN SILENCIO.
#
# Esto lo hace ruidoso.
_COPIAS_UMBRAL = (
    'sheet/construir_pool_competitivo.py',
    '01_Temporada/normal_v3.py',
    '02_Competitivo/v2/gencomp.py',
)


def verificar_umbrales(raiz=None):
    """Compara UMBRAL contra sus otras tres copias. Revienta si se separaron."""
    import os
    import re
    if raiz is None:
        raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    mal = []
    for rel in _COPIAS_UMBRAL:
        ruta = os.path.join(raiz, rel)
        if not os.path.exists(ruta):
            mal.append((rel, 'no existe'))
            continue
        txt = open(ruta, encoding='utf-8').read()
        m = re.search(r"^UMBRAL\s*=\s*\[(.*?)\]", txt, re.S | re.M)
        if not m:
            mal.append((rel, 'no encontre UMBRAL'))
            continue
        hall = [(r, int(v)) for r, v in
                re.findall(r"'(\w+)'\s*,\s*(\d+)", m.group(1))]
        if hall != UMBRAL:
            mal.append((rel, ' '.join('%s%d' % x for x in hall) or '(vacio)'))
    if mal:
        raise RuntimeError(
            'LOS UMBRALES DE RANGO SE SEPARARON.\n  aca:%s\n%s'
            % (' '.join(' %s%d' % x for x in UMBRAL),
               '\n'.join('  %-38s %s' % (r, q) for r, q in mal)))
    return len(_COPIAS_UMBRAL)


if __name__ == '__main__':
    # ⚠️ La consola de Windows abre en cp1252 y ahi el simbolo de aviso
    # REVIENTA el script. Un self-check que se cae segun desde donde lo
    # corras no sirve como self-check: el que lo vea va a creer que la
    # paleta esta mal cuando lo unico roto es el encoding de la terminal.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    n = verificar()
    m = verificar_umbrales()
    print('LOS OCHO RANGOS')
    print('  paleta verificada contra gencomp.py: %d rangos, todos iguales' % n)
    print('  umbrales verificados contra sus %d copias: todos iguales\n' % m)
    print('  %-4s %-9s %-10s %-9s %s' % ('', 'color', 'material', 'umbral',
                                         'figura'))
    print('  ' + '-' * 52)
    U = dict(UMBRAL)
    for r in ORDEN:
        print('  %-4s %-9s %-10s %-9s %s'
              % (r, ACENTO[r], MATERIAL[r],
                 '>= %d' % U[r] if r in U else 'el resto',
                 FIGURA[r].split()[0].replace('M', 'empieza en ')))
    print('  ')
    print('  ⚠️ D es un LINGOTE, no un cuadrado ni un rombo. El cuadrado se')
    print('     descarto MIDIENDO: sin direccion se solapaba con todo, y')
    print('     contra el circulo daba 0.82, casi lo que hundio al primer')
    print('     juego. El rombo tampoco: es el cuadrado girado, y D es el')
    print('     rango mas parecido a SS en luz (0.9 de L*).')
