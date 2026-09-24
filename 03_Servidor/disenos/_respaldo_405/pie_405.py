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
Y_FILA = 312        # ... -> 313 -> 309 -> 312: se recentra al bajar el TAG
LADO = 26           # la bandera y la figura miden LO MISMO
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
TAG_Y = 341.5       # 339 -> 335 -> 337 -> 340 -> 341.5
TAG_H = 17.4        # .54rem + padding 3/4, el cuerpo de la .tagbot

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


def huecos(y_nombre_fin=292.0, n_filas=5, y_divisor=265.2):
    """Todos los huecos verticales, para verificar que nada se pisa.

    ⚠️ SEIS PIEZAS VERTICALES AHORA, no cinco: entro el TAG. Y el default de
    n_filas paso de 4 a 5 porque la columna tiene cinco desde hace rato y el
    default viejo hacia que correr esto a secas midiera una carta que ya no
    existe.
    """
    fin_col = COL_Y0 + (n_filas - 1) * COL_PASO + 9
    return {
        'techo -> OVR': COL_Y_OVR - techo_columna(),
        'OVR -> pastilla': ESC_Y - (COL_Y_OVR + 44.2),
        'pastilla -> filas': (COL_Y0 - 9) - (ESC_Y + ESC_H),
        'columna -> divisor': y_divisor - fin_col,
        'nombre -> fila': Y_FILA - LADO / 2 - y_nombre_fin,
        'fila -> TAG': TAG_Y - (Y_FILA + LADO / 2),
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
