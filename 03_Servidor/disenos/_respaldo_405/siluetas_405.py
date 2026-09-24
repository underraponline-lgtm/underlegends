"""CATALOGO DE SILUETAS de las seis cartas.

Un solo lugar. Si una silueta se define en dos, tarde o temprano se separan.

    de comun.siluetas import BISELADO, PICO
    css = 'clip-path: %s;' % BISELADO.css

QUIEN USA QUE
-------------
    1 Temporada    RECTANGULAR        300 x 438   terminada
    2 Competitivo  ESCUDO_TRAZADO     300 x 485   terminada
    3 Servidor     PICO               300 x 405   en curso
    4 Pais         BISELADO           300 x 438   RESERVADA, sin concepto
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
# Esquinas biseladas arriba, cierra hacia abajo en punta ancha.
# Copiada tal cual de 03_Servidor/normal_card.css, que era su dueño.
_BISEL = ('polygon(0% 3%, 3% 0%, 97% 0%, 100% 3%, 100% 79%, '
          '97% 86%, 88% 92%, 66% 97.5%, 50% 100%, '
          '34% 97.5%, 12% 92%, 3% 86%, 0% 79%)')

BISELADO = Silueta(
    'biselado', 300, 438, _BISEL, 'Pais (reservada)',
    'era de la Servidor, quedo libre al pasar esta al PICO')


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
_PICO_D = ('M129.2,0 L170.8,0 L296.7,30.4 L300,356.5 L292,365.4 L281.5,369.4 '
           'L150,405 L18.5,369.4 L8,365.4 L0,356.5 L3.3,30.4 Z')

PICO = Silueta(
    'pico', 300, 405, "path('%s')" % _PICO_D, 'Servidor',
    'trazada de referencia/ref1.png')
PICO.d = _PICO_D        # el path pelado, para usarlo en un <clipPath> de SVG


# ── 2 · COMPETITIVO ─────────────────────────────────────────────────────
# NO vive aca: son 3 paths largos que se leen de disco. Ver
# 02_Competitivo/v2/shield.py, que ademas explica por que el marco se dibuja
# con stroke recortado y no desplazando el contorno.
ESCUDO_TRAZADO = Silueta(
    'escudo trazado', 300, 485, None, 'Competitivo',
    'ver 02_Competitivo/v2/shield.py')


# ── 1 · TEMPORADA ───────────────────────────────────────────────────────
RECTANGULAR = Silueta(
    'rectangular', 300, 438, None, 'Temporada',
    'ver 01_Temporada')


TODAS = [RECTANGULAR, ESCUDO_TRAZADO, PICO, BISELADO]


if __name__ == '__main__':
    print('%-16s %-9s %-7s %s' % ('silueta', 'tamaño', 'prop.', 'carta'))
    print('-' * 62)
    for s in TODAS:
        print('%-16s %-9s %-7.3f %s' % (
            s.nombre, '%dx%d' % (s.w, s.h), s.proporcion, s.carta))
    print()
    print('Sin silueta: Prime, Historico.')
