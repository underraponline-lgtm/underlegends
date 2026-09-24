"""EL EMBLEMA de la carta Servidor: el escudo del servidor y sus estrellas.

DEFINICION CANONICA. Todo lo que decide como se ve y donde va esta aca.

    from comun.emblema import CY, LADO, fondo_pieza, estrellas

Vive en comun/ y no en 03_Servidor/ por la regla del proyecto: la carpeta de
la carta es para lo que es de esa carta. Hoy el emblema lo usa solo la
Servidor, pero su generador de escudos escribe en comun/escudos_cuad/ y esos
escudos ya los mira mas de un script. Tener la geometria en un lado y los
archivos en otro es como empezaron los tres casos de codigo duplicado que
este proyecto ya pago: la funcion de escudo, las siluetas y los pools.


DONDE VA
--------
El emblema NO esta contenido en la carta: sobresale por la punta de arriba.

    la carta          300 x 405, silueta PICO de comun/siluetas.py
    margen arriba     62 px de aire donde viven el emblema y las estrellas
    el escudo         68 px de diametro, su centro 10 px POR DEBAJO del pico
                      -> sobresale 24 px de la carta
    las estrellas     21 px, apoyadas sobre la tapa del escudo, ENTERAS
                      fuera del recorte

El escudo esta corrido hacia abajo a proposito: pegado al pico no quedaba
lugar para las estrellas. El pico mide 41.6 px planos y de ahi cae a los
hombros, asi que el ancho de la carta a la altura y vale 41.6 + 8.28*y.
Encima de un escudo apoyado en el borde quedan 5 px de carta y una estrella
mide 21: no entra. Por eso las estrellas van afuera y el escudo baja.

⚠️ ESTO CAMBIA LA EXPORTACION. Mientras el clip-path recortaba a todos los
hijos alcanzaba con capturar el elemento. Con el escudo y las estrellas
afuera del recorte, la Servidor pasa a necesitar el calculo de union con lo
que sobresale, igual que la Competitiva. Capturar solo el elemento deja el
PNG sin escudo y sin estrellas.


LAS ESTRELLAS
-------------
Una estrella = un Interserver ganado. Salen de datos/estrellas.json.

SIEMPRE BLANCAS. Antes tomaban el acento del servidor y asi decian dos cosas
a la vez: cuantos ganaste y de que servidor sos. El servidor ya se lee en el
escudo, en el marco y en el fondo. La estrella dice UNA cosa.

Llevan CONTORNO y no solo sombra. Sobre blanco una estrella blanca da 1.00:1
y desaparece; la sombra no alcanza porque es un desplazamiento hacia abajo y
deja el borde de arriba sin nada. Va con paint-order=stroke para que el trazo
no coma las puntas.

El relleno es un degrade al sesgo, no un tono plano. Una figura de un solo
tono se lee como icono; con la luz de arriba a la izquierda y la sombra abajo
a la derecha se lee como una pieza de metal.

Hoy tienen estrella cuatro de los nueve, una cada uno. El maximo historico
son 3, las de EDF antes de que se repartieran por herencia.


EL FONDO DEL ESCUDO LO PONE LA CARTA
------------------------------------
Los PNG de comun/escudos_cuad/ traen SOLO TINTA, sin fondo. El fondo lo pone
esta pieza con el tono del servidor.

Se probaron las dos alternativas y las dos fallaban por el mismo lado:

  · placa unica oscura -> nadie se pelea con la carta, pero los logos cuyo
    COLOR VIVE EN EL FONDO lo pierden. DRA quedaba en blanco y negro: sus
    microfonos son blancos y todo su color era el azul de atras.
  · fondo del archivo -> cada uno conserva su color pero mete el color de SU
    ARCHIVO al lado del de la carta. TFC y FTN traian su negro contra cartas
    que no son negras, y ademas su tinta quedaba chica adentro de ese negro:
    el cuadro se llenaba, el logo no.

Con el fondo puesto por la carta, DRA tiene azul —el suyo, el de su carta—,
ninguno trae un color ajeno, y la tinta puede llenar porque ya no compite
con un margen horneado.

Quedan DOS EXCEPCIONES, y las dos por el mismo motivo: cuando el fondo es
parte de la marca, sacarlo no limpia, borra.

  SR    su icono siempre fue una cobra encendida SOBRE NEGRO, y el naranja
        de su carta es justo lo que ese negro hace resaltar. Sobre el
        degrade naranja la cobra pierde el fuego. Lleva fondo propio.
  TWR   su icono ES la pared de graffiti con las letras encima. Se le pueden
        separar las letras por saturacion —sale, baja de 100% a 64% de
        densidad— pero las letras solas no se leen como TWR. Va a sangre,
        con su baldosa entera, y por eso ignora el fondo de aca.

Los escudos los genera herramientas/escudos_cuadrados.py.
"""

# ── geometria, en pixeles del lienzo de la carta ──────────────────────────
MARGEN = 62      # aire arriba de la carta, donde sobresale el emblema
LADO = 66        # diametro del escudo. 68 -> 66
BAJA = 5.5       # cuanto baja su centro por debajo del pico. 10 -> 7 -> 6 -> 5.5
                 # ⚠️ LA ESTRELLA SUBE SOLA CON ESTO y no hay que tocarla:
                 # se apoya en la tapa del escudo (CY - LADO/2 - SEPARA), asi
                 # que bajar BAJA la levanta el mismo medio pixel. Si alguna
                 # vez se la mueve aparte, el hueco medido en HUECO deja de
                 # valer.
CY = MARGEN + BAJA

# ── las estrellas ────────────────────────────────────────────────────────
E = 20           # lado de cada estrella. 21 -> 20. NO CAMBIA CON LA CANTIDAD
SUBE = 1.3       # cuanto se levantan sobre la tapa del escudo

# ⚠️ EL HUECO SE MIDE CONTRA LA ESTRELLA, NO EN PIXELES SUELTOS.
# Dlx: "calcula la distancia que tiene en las camisetas de futbol sus
# estrellas y el logo de la federacion". No tengo una foto de camiseta en el
# repo para medirla, asi que lo que se fija es la PROPORCION, que es lo que
# se copia de una camiseta y lo unico que sobrevive a cambiar de tamaño:
#
#     hueco = 30% del alto de la estrella
#
# Antes eran 2.8 px sobre una estrella de 21, o sea 13%: las estrellas
# quedaban apoyadas sobre el escudo, no flotando encima. En una camiseta la
# banda de aire entre las estrellas y el escudo se LEE como banda.
#
# Si algun dia aparece una camiseta de referencia, se mide y se cambia ESTE
# numero solo. Por eso es una fraccion y no un pixel.
HUECO = 0.36
SEPARA = E * HUECO - SUBE      # lo que queda para el hueco geometrico


def aire(n):
    """El hueco entre estrellas SE ESTRECHA cuando son mas. El tamaño no.

    ⚠️ La tentacion es achicar las estrellas cuando entran mas, como hace el
    nombre. Pero el nombre se achica porque es UN objeto que tiene que
    caber; las estrellas son VARIAS y cada una significa un Interserver
    ganado. Si el de tres se dibuja mas chico que el de uno, la carta esta
    diciendo que su titulo vale menos.

    Lo que cede es el AIRE entre ellas, que no significa nada.
    """
    return 5 if n <= 2 else (3 if n == 3 else 1.5)

# ── EL ARCO ──────────────────────────────────────────────────────────────
# Las estrellas van SOBRE LA CURVA del escudo, no en fila recta, y cada una
# gira para quedar perpendicular al radio: es el gesto de una corona, no el
# de un renglon.
#
# ⚠️ ARCO es un factor, no un si/no, y hay un motivo. Siguiendo la curva
# EXACTA del circulo, tres estrellas de 21 px sobre un radio de 46 abren
# unos 78 grados, o sea que las de los costados bajan casi hasta la mitad
# del escudo. Queda mas de collar que de corona. Con el factor se toma parte
# de esa curvatura:
#
#     0.0   fila recta
#     0.5   se insinua el arco, las de los costados apenas bajan
#     1.0   la curva exacta del escudo
ARCO = 0.5

ESTRELLA = ('M12 2 L14.9 8.9 L22.4 9.5 L16.7 14.4 L18.4 21.7 L12 17.8 '
            'L5.6 21.7 L7.3 14.4 L1.6 9.5 L9.1 8.9 Z')

# Servidores cuyo fondo es parte de la marca. Ver el porque arriba.
FONDO_PROPIO = {
    'SR': 'linear-gradient(158deg,#1B1310 0%,#0C0704 55%,#050201 100%)',
}
A_SANGRE = {'TWR'}      # traen su baldosa entera: el fondo de aca no se ve


def tono(c, f):
    """Aclara (f>0) u oscurece (f<0) un color, con f entre -1 y 1."""
    h = c.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    if f >= 0:
        r, g, b = (int(x + (255 - x) * f) for x in (r, g, b))
    else:
        r, g, b = (int(x * (1 + f)) for x in (r, g, b))
    return '#%02X%02X%02X' % (r, g, b)


def fondo_pieza(sv, base):
    """El fondo del escudo, con el tono del servidor.

    De +38% a -62%. Antes iba de +20 a -68 y se leia oscuro y casi plano: el
    recorrido estaba, pero del lado equivocado.
    """
    if sv in FONDO_PROPIO:
        return FONDO_PROPIO[sv]
    return (f'linear-gradient(158deg,{tono(base, .38)} 0%,'
            f'{tono(base, .02)} 46%,{tono(base, -.62)} 100%)')


def estrellas(n, ancho, sufijo='', arco=None):
    """Las n estrellas, sobre el arco del escudo y girando con el.

    `sufijo` desambigua los id de los degrades cuando hay varias cartas en
    la misma pagina: dos <linearGradient> con el mismo id y gana el primero.
    """
    if not n:
        return ''
    import math
    a = ARCO if arco is None else arco
    ai = aire(n)                               # se estrecha, no se achica

    # el radio al CENTRO de las estrellas, medido desde el centro del escudo
    r = LADO / 2 + SEPARA + E / 2 + SUBE
    cx, cy = ancho / 2, CY
    # el angulo que separa dos estrellas si siguieran la curva exacta
    paso_ang = (E + ai) / r
    # a media curvatura, el paso angular se reparte entre giro y corrimiento
    paso_x = (E + ai) * (1 - a)

    out = []
    for i in range(n):
        k = i - (n - 1) / 2
        ang = k * paso_ang * a                     # rad, 0 = arriba
        x = cx + math.sin(ang) * r + k * paso_x
        y = cy - math.cos(ang) * r
        giro = math.degrees(ang)
        out.append(
            f'<svg class="est" viewBox="0 0 24 24" width="{E}" height="{E}" '
            f'style="left:{x - E/2:.2f}px;top:{y - E/2:.2f}px;'
            f'transform:rotate({giro:.2f}deg)">'
            f'<defs><linearGradient id="mt{sufijo}{i}" '
            f'x1="0.15" y1="0" x2="0.8" y2="1">'
            f'<stop offset="0" stop-color="#FFFFFF"/>'
            f'<stop offset=".42" stop-color="#F6F6FA"/>'
            f'<stop offset=".72" stop-color="#D9DBE6"/>'
            f'<stop offset="1" stop-color="#AEB2C4"/></linearGradient></defs>'
            f'<path d="{ESTRELLA}" fill="url(#mt{sufijo}{i})" '
            f'stroke="rgba(0,0,0,.66)" stroke-width="1.6" '
            f'stroke-linejoin="round" paint-order="stroke"/></svg>')
    return ''.join(out)


CSS = """
.est{position:absolute;z-index:11;filter:drop-shadow(0 2px 4px rgba(0,0,0,.85))}
.aro{position:absolute;left:50%%;transform:translateX(-50%%);z-index:10;
  border-radius:50%%;display:flex;align-items:center;justify-content:center}
.pieza{border-radius:50%%;overflow:hidden}
.pieza img{width:100%%;height:100%%;display:block;object-fit:cover;
  filter:drop-shadow(0 1px 2px rgba(0,0,0,.55))}
""".replace('%%', '%')


# ── EL ARO, DEL COLOR DE LA CARTA ────────────────────────────────────────
# El escudo NO se apoya en la carta: con BAJA=6, el 61% de su area y el 56%
# de su contorno caen FUERA, sobre el fondo de Discord, que no controlamos.
#
# Antes tenia solo "0 0 0 3px {acento}" mas una sombra hacia abajo, y las dos
# fallaban por el mismo lado que ya habian fallado en las estrellas:
#
#   · el acento es BLANCO en URBF y DRA y casi blanco en TFC. Un aro blanco
#     sobre fondo blanco no es un borde, es nada.
#   · la sombra va hacia ABAJO, asi que el borde de arriba —el que esta 100%
#     afuera— queda sin nada.
#
# Medido: el mejor contraste que ofrecia el filo contra el fondo, solo donde
# no hay carta detras, en el PEOR caso sobre los cuatro fondos:
#
#     como esta                 1.80    <- DRA sobre Discord claro
#     contorno fino             2.33
#     contorno normal           2.33
#     contorno + filo interno   2.64
#     CONTORNO DE DOS TONOS     3.55    <- el unico que pasa 3:1
#
# ⚠️ POR QUE DOS TONOS Y NO UNO. Un contorno de un solo tono NO PUEDE ganar
# en los dos extremos: el oscuro arregla el fondo claro y se pierde en el
# oscuro. Con un filo oscuro Y una linea clara por fuera, siempre hay uno de
# los dos contrastando, sea cual sea el fondo. Las estrellas se ahorran esto
# porque su relleno es blanco fijo y les alcanza con el filo oscuro; el
# escudo cambia de color con el servidor y no puede.
def pieza(sv, base, acento, src):
    """El div del escudo. El aro es UN DEGRADE, no un anillo plano.

    ⚠️ ANTES ERA UN box-shadow Y POR ESO SE VEIA GRIS. Un box-shadow solo
    acepta un color plano, asi que el aro era un tono unico —y con el filo
    oscuro y la linea clara alrededor, los tres juntos se leian como un anillo
    gris independiente de la carta. Dlx: "quita el circulo gris que rodea el
    logo, asegurate de que eso siga el color gradiente de los 2 lados de la
    tarjeta".

    Para que sea degrade tiene que ser un ELEMENTO, no una sombra: un div con
    el degrade de fondo y el escudo adentro con padding. Asi el aro puede
    tomar exactamente el mismo degrade que el borde de la carta —el de
    comun/marco.py— y el escudo queda hermanado con los dos lados en vez de
    tener su propio anillo.

    ⚠️ El degrade va al sesgo y con la misma direccion que el borde (x1=.1,
    y1=0 -> x2=.9, y2=1), no radial: si fuera radial el aro tendria su propia
    luz y volveria a leerse como pieza aparte.

    Queda un filo oscuro fino por fuera —una sola linea, no el sandwich de
    antes— porque sin el la pieza se pega al fondo cuando el fondo es del
    mismo tono.
    """
    from comun.marco import paradas
    a, b = paradas(base, acento)
    aro = f'linear-gradient(148deg,{b} 0%,{a} 46%,{b} 100%)'
    return (f'<div class="aro" style="top:{CY - LADO / 2 - 3.4}px;'
            f'width:{LADO + 6.8}px;height:{LADO + 6.8}px;background:{aro};'
            f'box-shadow:0 4px 14px rgba(0,0,0,.85),'
            f'0 0 0 1.2px rgba(0,0,0,.55)">'
            f'<div class="pieza" style="width:{LADO}px;height:{LADO}px;'
            f'background:{fondo_pieza(sv, base)}"><img src="{src}"></div>'
            f'</div>')


if __name__ == '__main__':
    print('EL EMBLEMA DE LA SERVIDOR')
    print('  escudo      %d px, centro en y=%d del lienzo' % (LADO, CY))
    print('              sobresale %d px por la punta' % (MARGEN - (CY - LADO / 2)))
    print('  estrella    %d px SIEMPRE, %.1f sobre la tapa' % (E, SUBE))
    print('              el aire se estrecha con la cantidad:')
    for n in (1, 2, 3, 4):
        print('                %d estrella%s -> %.1f px de aire'
              % (n, 's' if n > 1 else ' ', aire(n)))
    print('  arco        factor %.2f' % ARCO)
    print('  fondo       tono del servidor, +38% a -62%')
    print('  excepciones fondo propio: %s' % ', '.join(sorted(FONDO_PROPIO)))
    print('              a sangre:     %s' % ', '.join(sorted(A_SANGRE)))
