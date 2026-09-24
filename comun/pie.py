"""EL PIE de la carta Servidor: la fila de la Liga y el UL.

DEFINICION CANONICA de las posiciones. Estaban repartidas en los scripts de
diseño y ya iban por el tercer ajuste: un numero decidido que vive en dos
archivos se separa solo. Es lo mismo que paso con la posicion del nombre,
que termino en comun/nombre.py por la misma razon.


QUE LLEVA, y por que estas tres cosas
-------------------------------------
El pie es LA ZONA DE LA LIGA. Mide CALIDAD —todo lo que hay aca sale del
Score— y por eso lleva:

    bandera    de donde sos
    puesto     en que posicion estas DENTRO DE TU SERVIDOR, por Score.
               Es pos_sv, el mismo criterio que el circulo del pais de la
               Competitiva. CLAUDE.md: "pais, servidor y crew se calculan
               por Score, los tres".
    figura     el rango competitivo

La otra zona —la columna de la derecha— mide CUANTO: OVR del servidor,
campeonatos y racha, que son acumulacion.

⚠️ CADA ZONA TIENE UN SOLO CRITERIO, Y NO ES ESTETICA. Se probo poner
tambien un puesto por acumulacion en la columna, y los dos ordenes se
contradicen dentro del mismo servidor: 78% de la gente cambia de puesto, 28%
se mueve 5 o mas, y el peor caso es 36º por Score contra 11º por
acumulacion. Dos puestos del mismo servidor que no coinciden no se pueden
explicar adentro de una carta.


EL ORDEN
--------
    bandera · COMPETITIVO · TEMPORADA · SERVIDOR · figura

Los numeros van al medio porque la pieza central del pie es EL NUMERO, no el
material: la figura remata, no encabeza.

⚠️ Y los tres puestos son DEL MISMO SERVIDOR midiendo cosas distintas, asi
que la etiqueta de cada uno es lo unico que los separa. Por eso ninguna dice
el total: "DE 79" seria el mismo numero en los tres.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from comun.siluetas import PICO

# ── la fila ──────────────────────────────────────────────────────────────
# ⚠️ SUBE 7 PARA HACERLE LUGAR AL TAG. Entra una pieza nueva entre la fila y
# el UL, asi que las tres se recorren. El presupuesto es fijo: del final del
# nombre (292) a la punta (405) hay 113 px y las piezas suman 64.1, o sea que
# quedan 48.9 para repartir en cuatro huecos.
# ⚠️ SE CENTRA CONTRA LA TINTA, NO CONTRA EL CIRCULO. Yo la habia centrado
# tomando la fila como 26 px de alto y da mal: el circulo mide 27 y ADEMAS la
# pastilla del numero cuelga por debajo, asi que lo que se ve ocupa ~35 px y
# su base caia en 336 — o sea PISANDO el TAG, que arranca en 335.
#
# Es el mismo error que ya aparecio dos veces en esta carta: medir la caja en
# vez de lo pintado. Paso con el hueco del titulo bajo el numero y con el TAG
# contra el nombre.
#
# Con 35 px de tinta y 43 de lugar sobran 8, o sea 4 de cada lado:
#     tinta arriba  296     tinta abajo  331     TAG  335
# ⚠️ 317 Y NO 312, porque la fila crecio. Los circulos pasaron de 27 a 35 y su
# tinta —disco mas la pastilla del numero— de 35 a 43. Con 49.5 px de lugar
# entre el nombre y el TAG sobran 6.5, o sea 3.25 de cada lado.
#
# El self-check lo agarro: a 312 daba "nombre -> fila -1.5 SE PISAN". Es la
# primera vez que ese chequeo encuentra algo antes que el ojo, y solo funciono
# porque ALTO_FILA reemplazo a LADO: con LADO=26 habria dicho que sobraba
# lugar mientras la fila pisaba el nombre.
# ⚠️ 312 OTRA VEZ, Y ESTA VEZ MEDIDO CONTRA LA TINTA DEL NOMBRE. Dlx pidio
# que la fila quede "mas centrada entre el nombre y el logo de UL". Medido
# sobre la carta renderizada, en coordenadas de carta:
#
#     el nombre TERMINA en 286.0   <- su TINTA. La caja baja hasta 290.4,
#                                     4.4 mas, porque el nombre es MAYUSCULA
#                                     y no tiene descendentes. huecos() traia
#                                     292.0 clavado, o sea 6 px de menos.
#     el UL EMPIEZA en 371.0
#     entre medio: la fila y el TAG
#
# Con el circulo de 31 —el caso mas comun, cuatro piezas— la fila ocupa 39.65
# de tinta y el TAG 20, asi que sobran 25.35 para tres huecos: 8.45 cada uno.
# De ahi salen Y_FILA 312 y TAG_Y 342.5, y los tres huecos dan 8.5 / 8.35 /
# 8.5. Antes eran 16.0 / 7.6 / 9.5: la fila estaba pegada al TAG y despegada
# del nombre.
#
# ⚠️ Y QUE SEA 312 OTRA VEZ NO ES VOLVER ATRAS. Cuando bajo de 312 a 317 fue
# porque los circulos crecieron de 27 a 35; ahora que son cinco volvieron a
# 26 y hay lugar de nuevo. El numero coincide, el motivo no.
Y_FILA = 312        # ... -> 309 -> 312 -> 317 -> 312: ver arriba
LADO = 26           # LA FIGURA DEL RANGO. Ya NO es "lo mismo que la bandera":
                    # los circulos pasaron a un grupo flex cuyo diametro sale
                    # de cuantos haya (35 con 3, 31 con 4), asi que la fila ya
                    # no tiene un solo tamaño. Ver diametro() en todos_sv.py.
ALTO_FILA = 43      # ⚠️ QUEDA SOLO PARA NO ROMPER A QUIEN LO IMPORTE. Es un
                    # numero fijo para una fila que YA NO LO ES: el diametro
                    # sale de cuantos circulos haya (35 con 2, 31 con 4, 26
                    # con 5) y la pastilla cuelga una fraccion de ese
                    # diametro. Usar alto_fila(d), que devuelve los dos
                    # lados por separado.


# ⚠️ LA FILA NO ES SIMETRICA Y POR ESO DEVUELVE DOS NUMEROS. La pastilla del
# puesto cuelga SOLO HACIA ABAJO, asi que repartir un alto total en dos
# mitades —que es lo que hacia huecos() con ALTO_FILA/2— miente de los dos
# lados a la vez: dice que arriba ocupa mas de lo que ocupa y abajo menos.
#
# Medido: el aro suma 2 px de padding sobre el disco, y la pastilla cuelga
# una fraccion del diametro que depende de donde se apoye (ver POS_OPS en
# todos_sv.py). El default .15 es la opcion elegida, "dos tercios afuera".
def alto_fila(d=31, cuelga=.15):
    """(arriba, abajo) de tinta desde el centro de la fila."""
    arriba = d / 2 + 2
    return arriba, arriba + cuelga * d
# ⚠️ CUATRO PIEZAS, no tres: entra el puesto de TEMPORADA al lado del de
# competitivo. Dlx: "en vez de que diga de 150 o de cuantos miembros sea,
# abajo diga competitivo para saber que es".
#
# Y ese cambio de etiqueta NO es cosmetico: "DE 79" decia el tamaño del
# grupo, que con dos numeros al lado dejaria de distinguirlos —los dos son
# del mismo servidor y tienen el mismo total—. La etiqueta tiene que decir
# QUE MIDE cada uno, no de cuantos.
# ⚠️ CINCO piezas ahora: entra tambien el puesto del ranking DEL SERVIDOR,
# que es el que alimenta el numero grande. Los tres puestos son del mismo
# servidor y miden cosas distintas, asi que la etiqueta de cada uno es lo
# unico que los separa.
X_BAN, X_COMP, X_TEMP, X_SV, X_FIG = 32, 92, 150, 208, 268

# el velo oscuro del panel se saca: Dlx lo pidio y ademas el panel ya se
# separa de la foto por el material repintado, que era su unico trabajo
VELO = None

# ── el TAG ───────────────────────────────────────────────────────────────
# La pieza nueva: va ENCIMA DEL UL, como en la Competitiva. El texto lo
# resuelve comun/titulos.py; aca solo vive donde se apoya.
#
# ⚠️ NO VA CENTRADO EN SU HUECO, Y ES A PROPOSITO. Es la misma decision que
# tomo la Competitiva (card.css:335): pegado a la fila de arriba se lee como
# el remate de esa fila, y centrado entre las dos flota. Queda 7 contra la
# fila y 11 contra el UL.
#
# ⚠️ EL ANCHO NO ES PROBLEMA ACA Y SI LO SERIA 30 PX MAS ABAJO. Medido sobre
# el alfa del render: la carta mantiene 287 px utiles hasta y=355 y despues
# se cierra rapido —135 en y=385, 98 en y=390—. El TAG necesita ~104, asi que
# el ultimo lugar donde entra entero es y=389.
# ⚠️ SUBE 4 CON LA FILA, NO SOLO. Dlx lo vio pegado al UL. Comparado con la
# Competitiva —.tagbot en 81.97% y .ul en 429 sobre 485— la proporcion dice
# algo distinto de lo que parecia:
#
#     hueco          Competitiva   Servidor antes
#     TAG -> UL         2.90%          2.62%     <- casi iguales
#     UL  -> fondo      7.26%          4.27%     <- LA DIFERENCIA
#
# O sea que el TAG no estaba mal puesto respecto del UL: el BLOQUE ENTERO
# estaba empujado hacia abajo, con el UL casi en la punta. Por eso suben la
# fila y el TAG juntos y el UL se queda: mover solo el TAG lo habria pegado
# a la fila sin arreglar lo que se veia.
#
# Igualar la proporcion del todo es imposible: pedia 29.4 px de UL a la punta
# y solo quedan 48.9 para los cuatro huecos. Se llega hasta donde el nombre
# deja, que es 10 px de aire arriba de la fila.
TAG_Y = 342.5       # 339 -> 335 -> 337 -> 340 -> 341.5 -> 342.5: el reparto
                    # parejo del hueco entre el nombre y el UL. Ver Y_FILA.
TAG_H = 20          # ⚠️ 17.4 ESTABA MAL Y NADIE LO MIRO. Salio de sumar a
                    # mano .54rem + padding 3/4 = 17.4, pero .tagb NO fija
                    # line-height, asi que la caja de linea de Archivo es
                    # ~1.5 del cuerpo y no 1.2. Medido en el navegador: 20.0.
                    # Los 2.6 de diferencia son justo el hueco que huecos()
                    # se inventaba contra el UL.

# ── el UL ────────────────────────────────────────────────────────────────
# ⚠️ EL ALTO YA NO ES EL DE LA COMPETITIVA, Y ESO CAMBIA UNA REGLA ESCRITA
# ACA. Decia que el UL "mide igual en las tres" porque es la marca. Dlx pidio
# revisarlo contra el tamaño real de cada carta, y medido no se sostiene:
#
#     carta          alto    UL     % del alto
#     Competitiva     485   20.8      4.29%
#     Servidor        405   20.7      5.11%
#
# El mismo alto en px sobre una carta 80 px mas baja ocupa 19% MAS de su
# alto. O sea que copiar el numero no copiaba la presencia de la marca: la
# agrandaba. Igualar la PROPORCION da 17.4.
#
# La regla nueva: la marca ocupa la misma FRACCION de su carta, no los mismos
# pixeles. Si alguna vez se hace una carta de otro tamaño, se escala igual.
UL_Y = 371          # 369 -> 371: baja un poco, pedido. 372 -> 368 -> 364 -> 367 -> 369: al achicarse el logo,
                    # baja 2 para repartir los 3.3 que libero entre el hueco
                    # de arriba y el de la punta, en vez de dejarlos todos
                    # abajo.
UL_H = 17.4         # 20.7 -> 17.4: el 4.29% de 405, la fraccion de la
                    # Competitiva. Libera 3.3 px para los huecos de abajo.

# ── la columna del costado ───────────────────────────────────────────────
# Sube tres veces: el OVR arranco en 96, bajo a 58 y quedo en 46.
#
# ⚠️ EL TECHO NO ES EL ESCUDO. Yo lo habia medido asi y estaba mal: el escudo
# va de x=116 a x=184 y la columna de x=232 a x=288, NO SE SUPERPONEN. Arriba
# de la columna hay borde de carta, y el pico se abre 8.28 px por cada y, asi
# que la carta recien alcanza x=260 en y=21.5. Ese es el techo real.
COL_ANCHO = 56
COL_DER = 20                # 12 -> 20: el numero se corre a la izquierda
COL_Y_OVR = 46              # 96 -> 58 -> 46
COL_Y0 = 126                # la primera fila chica. Con CINCO filas el
                            # paso baja de 32 a 27: 5*27 no entra a 32.
                            # ⚠️ 118 -> 126 POR LA PASTILLA DEL RANGO, que
                            # ocupa 17 y abajo del numero habia 28 libres.
                            # El desplazamiento vivio un rato en todos_sv.py
                            # como DESPL_ESC y eso dejaba a este self-check
                            # informando 30.2 px de hueco cuando el real era
                            # 22.2. Un numero decidido que vive en dos
                            # archivos se separa solo: por eso esta aca.
COL_PASO = 27               # ⚠️ con la etiqueta debajo, cada fila mide ~22:
                            # con paso 24 se tocaban. El minimo real es 28.


def lavado(base):
    """El material de la columna: EL COLOR del servidor, sin su dibujo.

    ⚠️ NO ES EL MATERIAL DE LA CARTA, y el cambio es a proposito. El lavado
    repintaba el FONDO tal cual, y varios fondos llevan una banda diagonal
    fuerte que cruza justo la columna: los numeros quedaban mitad sobre claro
    y mitad sobre oscuro. Medido, rango de luz dentro de la columna:

        SR 152.9 · TWR 126.8 · FTN 120.3 · DRA 113.5 · FRZ 93.6
        URBF 74.3 · TFC 65.5 · RZ 48.5 · FFA 24.6

    Un velo casi no ayuda —baja 12%— porque oscurece parejo: COMPRIME el
    rango pero no borra el borde. Lo que molesta no es que la zona sea clara,
    es que TIENE UNA LINEA ADENTRO.

    Con el color sin dibujo, los tres peores pasan de 197/143/189 a 90/94/92:
    la mitad, y ademas emparejados entre si.

    ⚠️ EL MOTIVO DE FONDO: el material se diseño para verse en 300 px de
    ancho, no en 56. Una banda diagonal en una carta entera es un gesto; la
    misma banda en una franja de 56 px es un corte. La columna necesita un
    tratamiento pensado para SU tamaño.
    """
    from comun.emblema import tono
    return (f'linear-gradient(180deg,{tono(base, .22)} 0%,'
            f'{tono(base, -.10)} 55%,{tono(base, -.42)} 100%)')


def techo_columna():
    """A que altura la carta alcanza el eje de la columna. Ver el aviso."""
    x = PICO.w - COL_DER - COL_ANCHO / 2
    return max((abs(x - PICO.w / 2) - 20.8) / 4.14, 0)


# ── el aire que queda, para no pisarse ───────────────────────────────────
# nombre     hasta y 292 aprox (282.4 + 25.6 - 16)
# fila       y 313 .. 339
# UL         y 368 .. 388.7
# punta      y 388.7 .. 405, y se cierra a 0 de ancho


# la pastilla del rango, entre el numero y la primera fila
ESC_Y = COL_Y_OVR + 46      # tope de la pastilla
ESC_H = 15.0
ESC_ANCHO_MAX = 83.0        # centrada en la columna, lo que entra sin pisar
                            # el marco. A .6rem son unas 8 letras.


def tag_centrado(d=31, cuelga=.15, y_fila=None):
    """Donde arranca el TAG para quedar JUSTO EN EL MEDIO entre la fila y el UL.

    Dlx: "asegurate tambien el TAG de abajo este entre el logo de UL y la
    linea de los circulos centrado... perfectamente".

    ⚠️ Y "PERFECTAMENTE" OBLIGA A QUE DEPENDA DEL DIAMETRO. El UL no se mueve
    y el centro de la fila tampoco, pero LO QUE BAJA LA FILA si: el disco
    crece con cuantos circulos haya y la pastilla del puesto cuelga una
    fraccion de ese disco. Con 5 circulos la fila termina en 330.9 y con 3 en
    336.8, casi 6 px de diferencia. Un TAG fijo solo puede estar centrado para
    UNO de los tres casos.

        circulos   diametro   fin de la fila   TAG
        5            26          330.9        341.0
        4            31          334.2        342.6
        3            35          336.8        343.9

    Lo que se paga es que el TAG queda 3 px mas arriba en unas cartas que en
    otras. Se elige asi porque la asimetria se ve DENTRO de una carta —los dos
    huecos estan uno al lado del otro— y el corrimiento solo se veria
    comparando dos cartas al lado, que es lo que casi nunca pasa en Discord.
    """
    y = Y_FILA if y_fila is None else y_fila
    fin = y + alto_fila(d, cuelga)[1]
    return fin + (UL_Y - fin - TAG_H) / 2


def huecos(y_nombre_fin=286.0, n_filas=5, y_divisor=265.2, d_circulo=31,
           cuelga=.15):
    """Todos los huecos verticales, para verificar que nada se pisa.

    ⚠️ SEIS PIEZAS VERTICALES AHORA, no cinco: entro el TAG. Y el default de
    n_filas paso de 4 a 5 porque la columna tiene cinco desde hace rato y el
    default viejo hacia que correr esto a secas midiera una carta que ya no
    existe.
    """
    fin_col = COL_Y0 + (n_filas - 1) * COL_PASO + 9
    arr, aba = alto_fila(d_circulo, cuelga)
    return {
        'techo -> OVR': COL_Y_OVR - techo_columna(),
        'OVR -> pastilla': ESC_Y - (COL_Y_OVR + 44.2),
        'pastilla -> filas': (COL_Y0 - 9) - (ESC_Y + ESC_H),
        'columna -> divisor': y_divisor - fin_col,
        'nombre -> fila': Y_FILA - arr - y_nombre_fin,
        'fila -> TAG': TAG_Y - (Y_FILA + aba),
        'TAG -> UL': UL_Y - (TAG_Y + TAG_H),
        'UL -> punta': PICO.h - (UL_Y + UL_H),
    }


if __name__ == '__main__':
    import sys
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    print('EL PIE DE LA SERVIDOR')
    print('  fila     y %d' % Y_FILA)
    print('           bandera x %d · compet x %d · tempor x %d · '
          'servidor x %d · figura x %d'
          % (X_BAN, X_COMP, X_TEMP, X_SV, X_FIG))
    print('  piezas   %d px la bandera y la figura' % LADO)
    print('  TAG      y %d .. %.1f' % (TAG_Y, TAG_Y + TAG_H))
    print('  UL       y %d .. %.1f' % (UL_Y, UL_Y + UL_H))
    print()
    for k, v in huecos().items():
        aviso = '   <- SE PISAN' if v < 0 else ''
        print('  %-16s %6.1f px%s' % (k, v, aviso))
