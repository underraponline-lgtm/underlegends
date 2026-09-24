"""EL DIVISOR de la carta Servidor: la curva que separa la foto del pie.

DEFINICION CANONICA. No se dibuja a ojo ni se ajusta una cuadratica: esta
RECUPERADA de FINAL REFERENCIA con herramientas/ajustar_divisor.py.

COMO SE OBTUVO, y por que los intentos anteriores fallaron
----------------------------------------------------------
Cuatro metodos que dan un numero y NINGUNO avisa que mide otra cosa:

  brillo maximo por columna    en esa franja hay otras cosas brillantes y
                               el maximo salta entre features distintos
  clasificacion por color      la zona de arriba tiene un grafico cuyas
                               formas no se parecen a ninguna region
  techo de la region de abajo  esa region tiene degrade
  camino por programacion      correcto, pero devuelve ENTEROS: el camino se
  dinamica sola                mueve de a un pixel y el resultado es una
                               escalera que al escalar tiembla

LO QUE SI FUNCIONA, en dos pasos:

  1. el camino por programacion dinamica ubica la linea de forma continua
  2. cada columna se refina al CENTROIDE PESADO del gradiente en una
     ventana chica, lo que da un y FRACCIONARIO
  3. se ajusta un modelo y se mide el residuo

Resultados del ajuste, en pixeles de error RMS:

    polinomio de 6to          0.1238 px   <- elegido
    polinomio de 4to          0.1548 px
    coseno alzado             0.6105 px
    parabola                  0.8125 px
    arco de circunferencia    5.0420 px

⚠️ 0.12 px de residuo significa que esto NO es una curva parecida: es la
curva original recuperada. El PNG era su rasterizado y el ajuste lo deshace.

⚠️ Y CORRIGE UNA CONCLUSION MIA ANTERIOR. Yo habia dicho que "la cima es
plana, tres lecturas seguidas en 62.8%, asi que no es una parabola". Con 10
px de recorrido sobre 152 columnas la pendiente cerca de la cima es casi
cero, y varias columnas seguidas en el mismo entero es EXACTAMENTE lo que se
ve al rasterizar una curva suave. La meseta era del pixel, no del diseño.

⚠️ Pero SI es cierto que no es una parabola: la parabola da 0.81 px de
residuo, seis veces peor. El perfil es mas PLANO en los extremos y sube mas
rapido en el medio, parecido a un coseno alzado.

LA GEOMETRIA
------------
    extremos   66.366% del alto
    cima       62.211% del alto
    RECORRIDO  4.658% DEL ANCHO

⚠️ El recorrido se guarda como fraccion del ANCHO, no del alto. La curva
cruza a lo ancho: lo que hay que conservar al trasladarla a otra carta es
subida sobre ancho. Escalarla por el alto la deja un tercio mas empinada en
una carta mas angosta, que fue otro de los errores.
"""

# ── la geometria, en fracciones de la carta ──
Y_EXTREMOS = 0.66366     # del ALTO
Y_CIMA = 0.62211         # del ALTO
RECORRIDO = 0.04658      # del ANCHO

# ── el perfil recuperado: 41 puntos, 0 en los extremos y 1 en la cima ──
# Los valores apenas negativos de las puntas no son ruido: el polinomio
# recuperado cae un pelo por debajo de la horizontal antes de arrancar.
PERFIL = [
    -0.0071, -0.0152, 0.0044, 0.0455, 0.1027, 0.1714,
    0.2478, 0.3286, 0.4109, 0.4926, 0.5717, 0.6466,
    0.7163, 0.7796, 0.8359, 0.8845, 0.9250, 0.9570,
    0.9802, 0.9946, 1.0000, 0.9963, 0.9836, 0.9619,
    0.9313, 0.8921, 0.8445, 0.7890, 0.7263, 0.6569,
    0.5820, 0.5028, 0.4209, 0.3381, 0.2570, 0.1803,
    0.1114, 0.0545, 0.0143, -0.0037, 0.0071,
]


def altura(u):
    """La altura del divisor en u, con u de 0 (izquierda) a 1 (derecha).

    Devuelve 0 en los extremos y 1 en la cima. Interpola entre los puntos
    recuperados; con 41 puntos sobre una curva suave, el error de la
    interpolacion queda muy por debajo del pixel.
    """
    if u <= 0:
        return PERFIL[0]
    if u >= 1:
        return PERFIL[-1]
    p = u * (len(PERFIL) - 1)
    i = int(p)
    f = p - i
    return PERFIL[i] * (1 - f) + PERFIL[min(i + 1, len(PERFIL) - 1)] * f


def puntos(x_izq, x_der, ancho_carta, alto_carta, n=80, dy=0.0):
    """El divisor como lista de (x, y) en pixeles, listo para un path.

    x_izq y x_der son los bordes de la carta a esa altura; ancho_carta y
    alto_carta son sus medidas. dy corre todo el trazo, para el offset del
    lienzo.
    """
    base = Y_EXTREMOS * alto_carta
    sube = RECORRIDO * ancho_carta
    out = []
    for i in range(n + 1):
        u = i / n
        out.append((x_izq + (x_der - x_izq) * u,
                    base - altura(u) * sube + dy))
    return out


def path(x_izq, x_der, ancho_carta, alto_carta, n=80, dy=0.0):
    pts = puntos(x_izq, x_der, ancho_carta, alto_carta, n, dy)
    return 'M' + ' L'.join('%.2f,%.2f' % p for p in pts)


if __name__ == '__main__':
    print('EL DIVISOR DE LA SERVIDOR')
    print('  extremos   %.3f%% del alto' % (100 * Y_EXTREMOS))
    print('  cima       %.3f%% del alto' % (100 * Y_CIMA))
    print('  recorrido  %.3f%% del ANCHO' % (100 * RECORRIDO))
    print('  recuperado con residuo 0.1238 px sobre la referencia')
    print()
    for W, H in ((300, 405), (223, 250)):
        print('  en %dx%d  ->  extremos y=%.1f, cima y=%.1f, sube %.2f px'
              % (W, H, Y_EXTREMOS * H, Y_EXTREMOS * H - RECORRIDO * W,
                 RECORRIDO * W))


# ── EL PANEL DEL PIE ─────────────────────────────────────────────────────
# La forma cerrada que va de la curva del divisor para abajo, siguiendo la
# silueta. Vivia copiada en OCHO scripts de diseño, todos con el mismo bug.
#
# ⚠️ EL BUG, Y VALE LA PENA QUE QUEDE ESCRITO. La version vieja partia los
# vertices de la silueta en dos con `p[0] > 150` para la derecha y
# `p[0] < 150` para la izquierda. Pero LA PUNTA DE ABAJO ESTA EXACTAMENTE EN
# x=150, asi que no entraba en ninguno de los dos filtros: el panel se
# cerraba con una recta horizontal en y=369.4 y los ultimos 36 px de la
# carta —el triangulo de la punta— QUEDABAN SIN PANEL.
#
# No se veia como "falta un pedazo": se veia como que abajo el material
# cambiaba de tono, porque ahi seguia estando el fondo sin el velo encima.
# Dlx lo describio asi: "hay una parte de ahi que no esta con el panel
# oscuro encima".
#
# Un filtro que parte en dos con > y < deja afuera el valor del medio. Si el
# eje de simetria coincide con un vertice, ese vertice se pierde.
def panel(pts_divisor, vertices, ancho, dy=0.0):
    """El camino cerrado del panel: la curva, y la silueta hasta la punta."""
    mitad = ancho / 2
    base = min(v for _x, v in pts_divisor)
    d = ['M' + ' L'.join('%.2f,%.2f' % (x, v + dy) for x, v in pts_divisor)]
    # ⚠️ >= y no >: la punta esta justo en x=ancho/2 y con > se perdia
    der = sorted([p for p in vertices if p[0] >= mitad and p[1] > base],
                 key=lambda p: p[1])
    izq = sorted([p for p in vertices if p[0] < mitad and p[1] > base],
                 key=lambda p: p[1], reverse=True)
    for x, v in der + izq:
        d.append('L%.2f,%.2f' % (x, v + dy))
    return ' '.join(d) + ' Z'


def arriba(pts_divisor, ancho, alto, dy=0.0):
    """La region que va DESDE ARRIBA hasta la curva del divisor.

    ⚠️ EXISTE PORQUE CORTAR LA FOTO EN UNA RECTA DEJA FONDO PELADO. La foto
    se cortaba a la altura de la CIMA del divisor (250.6), pero la curva baja
    hasta sus extremos (268.8): entre esas dos alturas, en los bordes,
    quedaba una franja de hasta 18 px con el fondo de la carta a la vista, ni
    foto ni panel.

    No se veia como "falta la foto" sino como una banda de otro tono pegada
    al divisor. Dlx: "el fondo tiene que estar bajo la curva del trazado".

    La foto tiene que terminar EN LA CURVA, no en una recta a la altura de la
    curva. Son dos cosas distintas y la diferencia es exactamente el
    recorrido del divisor.
    """
    xi = pts_divisor[0][0]
    xd = pts_divisor[-1][0]
    d = ['M0,0 L%.2f,0' % ancho, 'L%.2f,%.2f' % (ancho, pts_divisor[-1][1] + dy)]
    for x, v in reversed(pts_divisor):
        d.append('L%.2f,%.2f' % (x, v + dy))
    d.append('L0,%.2f' % (pts_divisor[0][1] + dy))
    return ' '.join(d) + ' Z'
