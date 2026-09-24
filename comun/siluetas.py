"""CATALOGO DE SILUETAS de las seis cartas.

Un solo lugar. Si una silueta se define en dos, tarde o temprano se separan.

    de comun.siluetas import PAIS, PICO
    css = 'clip-path: %s;' % PAIS.css

QUIEN USA QUE
-------------
    1 Temporada    RECTANGULAR        300 x 438   terminada
    2 Competitivo  ESCUDO_TRAZADO     300 x 485   terminada
    3 Servidor     PICO               300 x 405   en curso
    4 Pais         PAIS               300 x 463   trazada, sin concepto
    5 Prime        -                              sin concepto
    6 Historico    -                              sin concepto

EL BISELADO QUEDO LIBRE, NO SE INVENTO
--------------------------------------
Era la silueta de la Servidor. Cuando la Servidor paso al PICO trazado de
la referencia, el biselado quedo sin dueño, y Pais era la proxima carta sin
silueta. Por eso se reserva aca en vez de borrarse.

Antes habia TRES siluetas para SEIS cartas y las tres estaban tomadas; ahora
hay CUATRO y quedan dos cartas sin ninguna. Prime e Historico van a tener que
compartir o inventar.

⚠️ Reservar la silueta NO define la carta. Pais sigue sin concepto: la regla
del proyecto es que el numero de cada carta mide lo que esa carta mide, y
todavia no esta decidido que numero muestra Pais. Tener la forma no contesta
esa pregunta.

POLYGON vs PATH
---------------
Las dos primeras son `polygon()`, que solo une puntos con RECTAS. Por eso el
PICO, que salio de trazar un PNG, es un `path()`: no habia forma de redondear
ni de seguir una curva con polygon.

`path()` va en PIXELES ABSOLUTOS, no en porcentajes. Es la contra de usarlo:
la silueta deja de escalar sola con el tamano del elemento. Como las cartas
son de tamano fijo no molesta, pero si algun dia hay una version chica hay
que reescribir el path, no alcanza con cambiar el ancho.
"""


class Silueta:
    def __init__(self, nombre, w, h, css, carta, origen):
        self.nombre = nombre
        self.w = w
        self.h = h
        self.css = css          # el valor para clip-path
        self.carta = carta
        self.origen = origen

    @property
    def proporcion(self):
        return self.w / self.h

    def __repr__(self):
        return '<Silueta %s %dx%d %.3f · %s>' % (
            self.nombre, self.w, self.h, self.proporcion, self.carta)


# ── 4 · PAIS ────────────────────────────────────────────────────────────
# Tope plano con dos hombros pequeños en las esquinas, laterales rectos y
# fondo ancho que cierra en punta suave.
#
# NO dibujada: trazada del alfa de 04_Pais/referencia/paisB.png con
# herramientas/trazar_silueta.py.
#   caja de tinta 947x1460  ·  proporcion 0.649  ·  35 puntos con tol 1.2
#
# ⚠️ Y LA COMPARACION CONTRA LAS QUE YA TIENEN DUEÑO ESTA MEDIDA, PORQUE YO
# ME EQUIVOQUE MIRANDO. Dlx paso cuatro referencias de FIFA y yo dije, a ojo,
# que eran la misma forma que la Competitiva. Dijo que no y tenia razon:
#
#     vs COMPETITIVA   IoU 0.894   distinta
#     vs SERVIDOR      IoU 0.848   distinta
#     vs BISELADO      IoU 0.909   parecida — y la maxima diferencia cae
#                                  al 0% del alto, o sea EN LOS HOMBROS
#
# O sea que no choca con ninguna carta: choca con el BISELADO, que estaba
# reservado para Pais y no tenia dueño. Es el mismo cuerpo con hombros, y los
# hombros son justo lo que la hace leer como carta de futbol.
#
# Se corre 04_Pais/comparar_siluetas.py para rehacer estos numeros.
_PAIS_D = ('M169.5,0.0 L212.6,1.6 L264.2,4.8 L264.8,5.4 L267.1,13.6 L268.6,17.1 L273.1,21.5 L277.5,23.1 L300.0,26.0 L299.7,367.5 L297.8,379.2 L294.6,386.5 L292.4,389.7 L286.7,395.4 L281.0,399.5 L259.5,411.2 L191.3,442.6 L150.2,462.2 L42.4,412.1 L20.0,400.1 L11.1,393.5 L7.6,389.7 L4.4,384.9 L1.3,375.4 L0.0,362.1 L0.0,26.0 L22.5,23.1 L26.3,21.9 L27.9,20.9 L31.4,17.1 L33.3,12.4 L35.2,5.1 L35.8,4.8 L81.1,1.9 L130.5,0.0 Z')

PAIS = Silueta(
    'escudo de hombros', 300, 463, "path('%s')" % _PAIS_D, 'Pais',
    'trazada de 04_Pais/referencia/paisB.png')
PAIS.d = _PAIS_D

# ⚠️ EL BISELADO SE JUBILA Y SE DEJA ESCRITO. Era el de la Servidor, quedo
# libre cuando esa paso al PICO, y se reservo para Pais por ser la proxima
# carta sin silueta — nunca porque encajara. Medido contra PAIS da 0.909, o
# sea que PAIS es el mismo cuerpo mejor rematado. Queda aca por si alguna de
# las dos que faltan lo quiere.
_BISEL = ('polygon(0% 3%, 3% 0%, 97% 0%, 100% 3%, 100% 79%, '
          '97% 86%, 88% 92%, 66% 97.5%, 50% 100%, '
          '34% 97.5%, 12% 92%, 3% 86%, 0% 79%)')

BISELADO = Silueta(
    'biselado', 300, 438, _BISEL, 'libre',
    'fue de la Servidor y estuvo reservado a Pais; lo reemplazo PAIS')


# ── 3 · SERVIDOR ────────────────────────────────────────────────────────
# Pico ancho y bajo con la punta achatada, laterales casi verticales,
# esquinas de abajo cortadas y dos diagonales largas que cierran en punta.
#
# NO dibujada: trazada de 03_Servidor/referencia/ref1.png con
# herramientas/trazar_silueta.py y despues simetrizada contra x=150.
#   caja de tinta 454x613  ·  proporcion 0.741
#   1226 puntos -> 11 con tolerancia 1.5
#   error contra el contorno crudo: medio 0.54 px, maximo 1.44 px
# Si hay que rehacerla, se corre el trazador. No se dibuja a ojo: ya fallo
# dos veces (03_Servidor/disenos/punta.py y punta2.py).
# ⚠️ EL PICO SE ESTIRO DE 405 A 485 SIN REDIBUJARLO, y esto merece leerse
# antes de tocarlo. Yo habia dicho que igualar los altos obligaba a rehacer la
# silueta. Dlx dijo que no, que alcanzaba con alargar los lados rectos. Miro
# los vertices y tenia razon:
#
#     v2  x=296.70  y= 30.40    <- termina el pico de arriba
#     v3  x=300.00  y=356.50    <- empieza la punta de abajo
#
# Entre esos dos el lado va de x=296.7 a 300: es practicamente una VERTICAL.
# Meter alto ahi no deforma nada — el pico de arriba y la punta de abajo
# quedan con su forma exacta, solo se separan mas.
#
# Por eso los cuatro vertices de arriba —0, 1, 2 y 10— no se mueven, y los
# siete de abajo —3 a 9— bajan ESTIRA px. La curva no se toca porque no hay
# curva en ese tramo: es recta.
#
# ⚠️ NO ES UN ESCALADO. Escalar habria multiplicado todo por 485/405 y el
# pico de arriba se habria estirado un 20% tambien. Esto solo alarga el
# tramo recto, que es lo que Dlx pidio.
ESTIRA = 0              # ⚠️ VUELVE A 0. Ver docs/discord_tamanos.md:
                        # medido, estirar la carta la hace MAS CHICA en
                        # el feed de Discord, que recorta por alto. A 485
                        # se veia 13% mas angosta que a 405. El mecanismo
                        # de estirado se deja porque es correcto y puede
                        # servir; lo que estaba mal era la direccion.
_ARRIBA = ((129.2, 0), (170.8, 0), (296.7, 30.4))
_ABAJO = ((300, 356.5), (292, 365.4), (281.5, 369.4), (150, 405),
          (18.5, 369.4), (8, 365.4), (0, 356.5))
_CIERRA = ((3.3, 30.4),)
_PICO_D = 'M' + ' L'.join(
    '%g,%g' % (x, y + (ESTIRA if (x, y) in _ABAJO else 0))
    for x, y in _ARRIBA + _ABAJO + _CIERRA) + ' Z'

PICO = Silueta(
    'pico', 300, 405 + ESTIRA, "path('%s')" % _PICO_D, 'Servidor',
    'trazada de referencia/ref1.png, estirada en su tramo recto')
PICO.d = _PICO_D        # el path pelado, para usarlo en un <clipPath> de SVG


# ── 2 · COMPETITIVO ─────────────────────────────────────────────────────
# NO vive aca: son 3 paths largos que se leen de disco. Ver
# 02_Competitivo/v2/shield.py, que ademas explica por que el marco se dibuja
# con stroke recortado y no desplazando el contorno.
# ⚠️ ESTA ES LA SILUETA DE FIFA, Y CONVIENE SABERLO ANTES DE ELEGIR OTRA.
# shield.py lo dice: se trazo "pixel por pixel del PNG de la plantilla real" y
# que los intentos con polygon() fallaron "porque la carta de FIFA tiene
# curvas". O sea que el escudo FUT —hombros con muescas arriba, laterales
# rectos, V abajo— YA TIENE DUEÑO en este proyecto.
#
# Dlx paso cuatro referencias de FIFA para la carta de Pais —una dorada de
# Cristiano, una plantilla amarilla, una de Champions y una dorada en blanco—
# y las cuatro son ESTA forma. Ver galeria/siluetas.png, que las pone al lado.
#
# No quiere decir que Pais no pueda usarla: quiere decir que si la usa hay que
# decidir a proposito que dos cartas compartan silueta, y que entonces las
# distinga otra cosa.
ESCUDO_TRAZADO = Silueta(
    'escudo trazado', 300, 485, None, 'Competitivo',
    'ver 02_Competitivo/v2/shield.py — es la forma de FIFA')


# ── 1 · TEMPORADA ───────────────────────────────────────────────────────
RECTANGULAR = Silueta(
    'rectangular', 300, 438, None, 'Temporada',
    'ver 01_Temporada')


TODAS = [RECTANGULAR, ESCUDO_TRAZADO, PICO, PAIS, BISELADO]


if __name__ == '__main__':
    print('%-16s %-9s %-7s %s' % ('silueta', 'tamaño', 'prop.', 'carta'))
    print('-' * 62)
    for s in TODAS:
        print('%-16s %-9s %-7.3f %s' % (
            s.nombre, '%dx%d' % (s.w, s.h), s.proporcion, s.carta))
    print()
    print('Sin silueta: Prime, Historico.')
