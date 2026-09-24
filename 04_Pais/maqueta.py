"""MAQUETA de la carta de País. Cuatro secciones, con marco y TAG.

    python 04_Pais/maqueta.py                    la version elegida
    python 04_Pais/maqueta.py --comparar         la hoja con las opciones

── LAS CUATRO SECCIONES, TRAZADAS ───────────────────────────────────────

No se estimaron: `referencia/paisB.png` es una carta VACIA y sus lineas
doradas estan ahi, sin nada encima. Buscando el dorado por fila y por columna:

    y = 53.1%   arriba de la banda del nombre
    y = 63.3%   abajo de la banda
    x = 50.8%   donde se parten las dos columnas de stats

    1  ARRIBA      0 -> 53.1%   la foto, con la columna encima
    2  NOMBRE   53.1 -> 63.3%   la banda, de lado a lado del contenido
    3  STATS    63.3 -> abajo   dos columnas
    4  COLUMNA  a la izquierda, de arriba abajo

⚠️ EL 50.8% NO SE APLICA TAL CUAL. Salio de la plantilla VACIA, que no tiene
columna izquierda: ahi las stats ocupan todo el ancho y su division cae al
medio de la carta. Con panel, el medio del bloque es (LW+300)/2. Es lo mismo
que hace la de Ronaldo.

── LO QUE SE COMPARA ────────────────────────────────────────────────────

⚠️ EL ANCHO DE LA COLUMNA NO SE PUDO TRAZAR: la plantilla vacia no la trae
dibujada y la de Ronaldo es una captura, no un archivo. Asi que se ofrecen
tres y se elige mirando, que es lo unico honesto cuando no hay que medir.

    --lane   por ciento del ancho de la carta. Quedo en 23%.

⚠️ EL MARCO NO PUEDE SER METALICO. Ese lenguaje es de la Competitiva y la
Servidor ya lo tiene prohibido por escrito para no confundirlas. Quedan:

    A  sin marco
    B  acento del RANGO
    C  acento de la BANDERA
    D  filo oscuro neutro
    E  BANDERA arriba, RANGO abajo, en degrade

⚠️ LA OPCION C ARRANCA CON UN PROBLEMA CONOCIDO: el acento de Argentina es
BLANCO y el de Peru tambien. Contra su propia bandera desaparecen. Se incluye
igual para poder verlo, no porque prometa.

⚠️ Y LA E LO CUBRE. Dlx pidio "una combinacion de los colores de la bandera y
el rango", y ademas de decir las dos cosas resuelve ese agujero: arriba el
acento del pais puede perderse contra su bandera, pero abajo el rango SIEMPRE
es cromatico, asi que el marco nunca desaparece entero.

── EL NUMERO SE ACHICA CON LA COLUMNA ───────────────────────────────────

Dlx: "muestra el 22 pero con el numero grande adaptado al entorno, mas
pequeño pero no tanto". Es proporcional —2.45rem a 78 px de columna— asi que
sale solo para cualquier ancho:

    columna 22%    ->  66 px  ->  2.07 rem
    columna 22.5%  ->  68 px  ->  2.14 rem
    columna 23%    ->  69 px  ->  2.17 rem

No es una excepcion del 22: vale para los tres, y por eso no hay que
acordarse de tocarlo si el ancho cambia.

── LA BANDA DEL NOMBRE ──────────────────────────────────────────────────

⚠️ SE FUSIONO DOS VECES Y POR DOS MOTIVOS DISTINTOS. Primero era un velo
neutro y se pegaba AL PANEL, que es otro velo neutro. Se le puso el color del
pais y entonces se pego A LA BANDERA, que es el mismo color. Dlx marco las dos.

Ahora toma el ACENTO DEL RANGO oscurecido: no es neutro como el panel y no es
del pais como el fondo, asi que no tiene con que fusionarse. Y ya estaba en la
carta, en la linea y en el borde.

── EL TAG ───────────────────────────────────────────────────────────────

Dlx: "recuerda que aqui debe haber TAG tambien... y no hay espacio no?".

Si hay, y en el unico lugar posible: ENTRE LAS STATS Y EL UL. Arriba esta la
foto, al medio el nombre, abajo las stats y a la izquierda el panel. Y no es
un lugar inventado — es donde lo tienen la Servidor y la Competitiva.

⚠️ SUS TEXTOS SON PROVISORIOS. comun/titulos.py tiene la cascada del SERVIDOR
y sus palabras son de ahi: "DUEÑO DE CASA", "TOP DEL SERVIDOR". Pais necesita
las suyas y no estan decididas. Lo que la maqueta prueba es DONDE ENTRA.
"""
import argparse
import asyncio
import base64
import os
import pathlib
import re
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)

from comun.siluetas import PAIS
from comun import rangos as RG, nombre as NOM
# ⚠️ SOLO POR EL GRIS. `bloqueada.TINTA` es el tono que se eligió para «está
# antes de los ocho niveles»; importarlo en vez de copiar el hex es lo que
# evita que dentro de un mes haya dos grises distintos que quieren decir lo
# mismo. Ver `acc` más abajo.
from comun import bloqueada as BL
import fondos as FON
from fondos import defs, MATERIAL, VELO

sys.path.insert(0, os.path.join(BASE, '03_Servidor', 'disenos'))
import avatares

# ══ LOS REMATES DE ABAJO ══
# ⚠️ SOLO SE TOCA LA COLA. Los vertices 0..8 y 25..34 —los hombros de arriba y
# los dos lados rectos— NO SE MUEVEN en ninguna variante: son los que la
# identifican y salieron de trazar el PNG, no de dibujar. Lo que cambia es lo
# que pasa de y=367.5 para abajo, que en el original son 95 px de punta.
REMATES = {
    'punta': 'la punta trazada, como esta hoy',
    'recta': 'recta, con las esquinas curvadas como los hombros',
    'corta': 'la misma punta pero a la mitad de hondo',
    'espejo': 'los hombros de arriba, espejados abajo',
}
Y_CORTE = 367.5


def _cola(modo):
    """Los vertices de y>=367.5, segun el remate."""
    pts = [(float(x), float(y))
           for x, y in re.findall(r'(-?[\d.]+),(-?[\d.]+)', PAIS.d)]
    cabeza = [q for q in pts if q[1] < Y_CORTE]
    cola = [q for q in pts if q[1] >= Y_CORTE]
    if modo == 'punta':
        return cabeza, cola
    if modo == 'recta':
        # ⚠️ NO ES UN CORTE AL RAS. Una recta pura choca con los hombros de
        # arriba, que son curvos: la carta quedaria mitad blanda y mitad dura.
        #
        # ⚠️ Y LA ESQUINA NO ES UN BISEL DE 9 px. Dlx: "recta pero dale un poco
        # de diseño a las esquinas de abajo". El primer intento cortaba en
        # diagonal y a 9 px la diagonal ni se ve — se leia como un canto sucio,
        # no como una forma. Ahora la esquina es una CURVA de 33 px construida
        # con cinco puntos, que es el mismo largo que tiene el hombro de arriba
        # (de x=264 a x=300, o sea 36). Asi arriba y abajo hablan igual.
        Y = 402.0
        return cabeza, [
            (299.7, Y_CORTE),
            (298.6, 378.0), (295.6, 386.5), (290.0, 393.0),
            (281.5, 398.0), (270.0, Y),
            (30.0, Y),
            (18.5, 398.0), (10.0, 393.0), (4.4, 386.5),
            (1.4, 378.0), (0.0, Y_CORTE)]
    if modo == 'corta':
        f = .5
        return cabeza, [(x, Y_CORTE + (y - Y_CORTE) * f) for x, y in cola]
    if modo == 'espejo':
        # los hombros de arriba, dados vuelta y pegados abajo
        arriba = [q for q in pts if q[1] < 30]
        alto = Y_CORTE + 30
        der = [(x, alto - y) for x, y in arriba if x > 150]
        izq = [(x, alto - y) for x, y in arriba if x <= 150]
        return cabeza, der[::-1] + izq[::-1]
    raise ValueError(modo)


def silueta(acorta=0, remate='punta'):
    """La silueta de Pais, acortada por su TRAMO RECTO.

    ⚠️ NO ES UN ESCALADO Y NO SE REDIBUJA NADA. El lado derecho va de (300,26)
    a (299.7,367.5): 341 px practicamente verticales. Recien ahi empieza a
    cerrar. Subiendo los vertices de abajo se acorta ESE tramo y el remate
    —hombros arriba, punta abajo— conserva su forma exacta.

    Es el mismo mecanismo que ya tiene el PICO de la Servidor con ESTIRA, y
    esta escrito ahi por que: "escalar habria multiplicado todo y el pico de
    arriba se habria estirado tambien".

    ⚠️ Y ACORTAR NO ES SOLO ESTETICA: medido en Discord —docs/discord_tamanos.md—
    el feed recorta por ALTO, asi que una carta MAS BAJA se ve MAS ANCHA. Los
    463 de hoy dan proporcion 0.648; a 423 da 0.709.
    """
    cabeza, cola = _cola(remate)
    # el orden del path: cabeza hasta el lado derecho, cola, y el resto de la
    # cabeza subiendo por la izquierda
    der = [q for q in cabeza if q[1] <= 26 and q[0] > 150] + [(300.0, 26.0)]
    izq = [(0.0, 26.0)] + [q for q in cabeza if q[1] <= 26 and q[0] <= 150]
    out = der + [(x, y - acorta) for x, y in cola] + izq
    return 'M' + ' L'.join('%g,%g' % q for q in out) + ' Z'


def alto_de(remate, acorta=0):
    _c, cola = _cola(remate)
    return round(max(y for _x, y in cola)) - acorta


W, H = PAIS.w, PAIS.h
ESCALA = 3
# 🔴 SALE DE `comun/temporada.py`, NO SE ESCRIBE ACA. Estuvo a mano
# en CUATRO archivos y los cuatro decian «un solo lugar para
# cambiarlo»: el dia del reset las cuatro cartas siguieron diciendo
# PRE con la T1 ya empezada. No fallaba, imprimia otra temporada.
from comun.temporada import SELLO as TEMPORADA  # noqa: E402,F401

# ⚠️ LAS SECCIONES SE CALCULAN SOBRE EL ALTO REAL, no sobre 463. Salieron de
# trazar la plantilla como PORCENTAJES, asi que escalan solas cuando el remate
# de abajo cambia el alto. Tenerlas clavadas en px fue un error que se vio
# enseguida: con el remate recto —402 px— las stats terminaban en 404 y el UL,
# que va pegado al borde de abajo, les caia encima.
Y_NOMBRE, Y_STATS = .531, .633


def secciones(h):
    return round(h * Y_NOMBRE), round(h * Y_STATS)


YN, YS = secciones(H)

# ⚠️ EL TAMAÑO DE LA PASTILLA (#26, x3). Dlx, 17/09/2026: «esos labels de
# x y # mas grande, un poquito nada mas». Estaba en .5rem.
#
# ⚠️ NO SE TOCA EL `.75em` DEL `#`: ese numero sale de una medicion —por
# tinta, el # tiene 35% mas alto y 74% mas area que la x— y esta en `em`
# justamente para seguir a este valor sin volver a calcularse.
PAS_REM = .56

# ⚠️ EL VELO DE LAS STATS. 0 = sin panel. Dlx lo pidio en 0 el 17/09/2026.
# El porque, la medicion vieja que lo justificaba y el riesgo que queda
# estan en el comentario de `.stats`, en el CSS. Subirlo a .32 lo devuelve.
ALFA_STATS = 0

MARCOS = {'A': 'sin marco', 'B': 'acento del rango',
          'C': 'acento de la bandera', 'D': 'filo oscuro neutro',
          'E': 'bandera arriba, rango abajo'}

# (nombre, cc, rango, sv, crew, pos_pais, ovr, sem, evt, pod, cam, win, racha)
GENTE = [
    # ⚠️ SOLO KONAN POR AHORA. Dlx: "usemos la tarjeta de Konan unicamente para
    # seguir". Las otras cuatro vuelven cuando haya que verificar los casos que
    # solo aparecen ahi —sin foto, sin puesto, sin crew— que son justo los que
    # rompen. Miradas de a una no se ven.
    #
    # ⚠️ EL PUESTO DENTRO DEL RANGO Y SU UMBRAL. Dlx: "we need to put a #X next
    # to the rank icon similar to what we did with the X1". El numero natural
    # al lado de la piedra es en que puesto estas DENTRO de tu rango — lo mismo
    # que la Servidor ya habia decidido para su gema.
    #
    # ⚠️ PERO NO SE DIBUJA SI EL RANGO NO LLEGA A 3, por el mismo umbral que
    # rige todo lo demas. Y ahi hay algo incomodo:
    #
    #     SSS   1 persona   NO se dibuja   <- y esa persona es KONAN
    #     SS 5 · S 8 · A 27 · B 25 · C 36 · D 26 · E 10   si
    #
    # Lo verian 137 de 138. El unico que no es justo EL MEJOR DE LA LIGA, que
    # ademas es la muestra de esta maqueta: con datos reales, la carta de Konan
    # NO lleva ese numero.
    #
    # (nombre, cc, rango, sv, crew, pos_pais, ovr, sem, evt, pod, cam, win, rch,
    #  puesto en el rango, puesto en el servidor, duelos, fechas)
    #  ... , puesto dentro del rango, puesto dentro del servidor
    #  ... , puesto en el rango, puesto en el servidor, duelos, fechas
    ('KONAN', 'ar', 'SSS', 'TWR', None, '1/33', 92, 11, 50, 29, 23, '71%', 12,
     1, 1, '9/14', 6, None, None),
    # ⚠️ KAIRO NO EXISTE: es una carta inventada para ver la de al lado. Dlx:
    # "quiero que inventes una tarjeta, o sea las estadisticas y todo eso, para
    # ver como queda". Se eligio a proposito TODO lo contrario de Konan, porque
    # la carta de Konan no ejercita casi nada:
    #
    #   otro pais       Colombia, o sea otra bandera y otro fondo
    #   otro rango      A, o sea rubi en vez de amatista, y con SUBRANGO
    #   otro servidor   SR, cuyo escudo lleva fondo propio
    #   CON crew        Konan no tiene, asi que ese casillero nunca se veia
    #   dos trofeos     nacional x2 y mundial x1, o sea los SEIS casilleros
    #   no es el #1     4 de 25, que es como lo va a ver casi todo el mundo
    #
    # Ese ultimo punto es el que mas importa: el #1 de un pais es el unico a
    # quien no le queda a donde subir, asi que su carta esconde la mitad de lo
    # que el diseño tiene que aguantar.
    # ⚠️ ECUADOR Y COLOMBIA TIENEN LA MISMA BANDERA, y son el unico par que el
    # chequeo de ver_fondos.py da como parecido de verdad. Lo que las separa
    # es el escudo del medio — y SI se lee a tamaño de carta: el fondo 'ec'
    # trae un emblema simplificado que en la carta aparece como un disco claro
    # sobre el amarillo. O sea que el chequeo por perfil de color tenia razon
    # en que los colores empatan, y su propia nota tambien: "el unico que los
    # separa es el escudo del medio".
    #
    # El cambio grande esta en el numero, igual: Ecuador tiene 3 personas en
    # el pool contra las 25 de Colombia, y 2 de 3 dice algo muy distinto que
    # 4 de 25.
    ('KAIRO', 'ec', 'A', 'SR', 'Follombia', '2/3', 84, 9, 62, 31, 14, '63%', 7,
     3, 2, '38/61', 5, 2, 1),
    # ⚠️ el primer 1 es INVENTADO —SSS tiene una sola persona y con el umbral
    # de 3 no se dibujaria—; el segundo es REAL, Konan es 1 de 18 en TWR.
    # DUE y FCH son inventados: la Fecha FIFA arranca en T2.
]

# ⚠️ LOS TRES TROFEOS NO EXISTEN TODAVIA Y ESTO SON PLACEHOLDERS. Dlx pidio el
# hueco porque van a existir: regional, nacional e internacional. Hoy no hay
# ninguna competencia que los genere —la Fecha FIFA y la Copa de Naciones
# arrancan en T2— asi que los numeros son inventados y estan marcados como
# tales. Lo que la maqueta prueba es QUE ENTRAN, no cuanto vale cada uno.
# ⚠️ REGIONAL SE VA. Dlx: "las regionales las podemos quitar debido a que
# usualmente no se hace en Discord regionales". Quedan dos, y cada uno con su
# propio icono en vez de solo una sigla.
# ⚠️ "MUNDIAL" Y NO "INTERNACIONAL": la palabra larga NO ENTRA. El panel mide
# 69 px y la etiqueta de 13 letras se salia por los dos lados. Y ademas
# MUNDIAL es como lo llama el Sheet —"Ranking Mundial", "Copa de Naciones"—
# asi que la carta usa la palabra que ya usa la Liga.
TROFEOS = [('nac', 'NACIONAL', 1), ('int', 'MUNDIAL', 0)]

# ══ EL BLOQUE NACIONAL, DE MUESTRA ══
#   DE   de cuantos compatriotas sos el #N     -> del pool, real
#   DIF  Score que te separa del #1 de tu pais -> del pool, real.
#        Si sos el #1 va la ventaja sobre el #2, para que nunca quede vacio:
#        los 9 lideres de pais tendrian 0 siempre.
#   MEJ  el mejor puesto que tuviste en tu pais   -> pide historial
#   SUB  cuantos puestos subiste o bajaste        -> pide historial
#   SEL  tu puesto en la seleccion de tu pais     -> pide las 9 selecciones
DEMO_NAC = {
    #          de   dif      mej sub   sel  pico   tmp  nac  podn seg ter dni     dna       din    evn evi
    'KONAN': (33, '+18.0', 1, '0', 1, '91.1', 4, 0, 0, 4, 2, '6/3', '4/6', '2/3', 8, 3),
    'VALEN': (33, '21.9', 2, '+1', 3, '71.4', 3, 0, 0, 8, 6, '12/7', '104/141', '65/87', 14, 6),
    'KAIRO': (3, '11.4', 2, '+3', 2, '79.8', 3, 0, 0, 6, 9, '38/61', '38/61', '12/23', 11, 4),
}

# ⚠️ DOS GLOBALES QUE VALEN None Y NO SON UN OLVIDO. Son la unica puerta por
# la que generar.py mete datos de verdad sin tocar carta(), que tiene trece
# parametros y lo usan once hojas comparativas. None = "estoy en una hoja, usa
# lo de la maqueta"; puesto = "estoy dibujando a una persona".
#
#   NAC    {nombre: las 16 stats nacionales}   en vez de DEMO_NAC
#   FOTOS  [dataURI o None, por carta]         en vez de la rotacion de prueba
NAC = None
FOTOS = None

# ⚠️ DNI: DUELOS GANADOS CONTRA COMPATRIOTAS / CONTRA EXTRANJEROS. Dlx:
# "cuantos duelos del mismo pais gano e internacional con el /". Es la unica
# stat de todas las probadas que parte en dos por PAIS y no por resultado, o
# sea la unica que la carta de Pais puede tener y las otras tres no.
# Y de paso arregla el ancho: 12/7 mide 42 px contra los 78 de 169/228, que
# era el valor que descolocaba la columna entera.

# ⚠️ EL PODIO PARTIDO EN DOS NO ES SOLO UNA PREFERENCIA: SACA UNA REPETICION.
# Dlx: "necesito que POD esten ahi o sino podemos dividirlo en 2, TER terceros
# SEG segundos en vez de podios". Y partirlo es estrictamente mejor por la
# regla que esta carta viene siguiendo desde el OVR — un podio son primeros,
# segundos y terceros, y LOS PRIMEROS YA ESTAN CONTADOS en el trofeo con su
# xN. Un POD entero dice dos veces el mismo dato; SEG y TER dicen lo que
# falta, y cada numero de la carta aparece una sola vez.
#
# ⚠️ PERO EL DESGLOSE NO EXISTE TODAVIA. El pool trae 'oro' y 'pod' y nada mas:
# Valen tiene 21 oros y 35 podios, o sea 14 entre plata y bronce, sin saber
# cuantos de cada. Los 8 y 6 de aca son inventados. Para publicarlo hay que
# pedirle al Sheet la columna, o que los builders la deriven de los
# resultados evento por evento.

# ══ EL ANCHO DEL NUMERO DE UNA STAT ══
# ⚠️ LA COLUMNA DE LA DERECHA ESTABA DESALINEADA Y NO ERA A OJO: medido, sus
# etiquetas arrancaban en 257.3, 258, 261 y 271 —13.7 px de diferencia—
# mientras que la izquierda tenia las tres en 142. La causa es el min-width:52
# del <b>: mientras el numero entra, la etiqueta cae siempre en el mismo x;
# en cuanto lo pasa, la empuja. Con dos cifras nunca se veia, y aparecio con
# 169/228 (78 px) y 57.3% (58).
#
# Los anchos salen de medir la fuente, no de contar caracteres: los digitos y
# el + miden 12, el punto, la barra y el menos 6, y el % mide 18. Con eso el
# ancho de cualquier valor se calcula exacto — control: 169/228 da 78 y 57.3%
# da 58, que es lo que mide el DOM.
ANCHO_GL = {'.': 6, '/': 6, '-': 6, '%': 18}
COL_NUM = 62      # el ancho fijo de la columna del numero, arriba
# ⚠️ LA FILA DE ABAJO USA UNA COLUMNA MAS ANCHA porque los valores son otros:
# arriba van conteos de una o dos cifras y abajo van #/# de hasta tres por
# lado. El caso real es Valen con 104/141, que mide 78. Con los 62 de arriba
# se achicaria al 0.89 sin necesidad: en su mitad hay 115.5 px y 78 + 5 de
# aire + 26 de etiqueta son 109. Achicar cuando entra es perder tamaño gratis.
COL_PIE = 78
REM_ST = 1.12     # su tamaño cuando entra
REM_CHIP = .82    # el del numero de un chip
COL_CHIP = 43     # lo que le queda adentro: 56 menos el relleno y el filo


def _rem_chip(v):
    """El tamaño del numero de un chip, achicado solo si no entra.

    ⚠️ EL ANCHO SE MIDE A SU PROPIO TAMAÑO. _ancho_st da la tinta a 1.12rem,
    que es el de las stats; el chip escribe a .82, asi que hay que convertir
    antes de comparar con los 43 que tiene adentro. Comparar los dos numeros
    sin convertir daria que 38/61 no entra cuando entra de sobra.
    """
    a = _ancho_st(v) * REM_CHIP / REM_ST
    return REM_CHIP if a <= COL_CHIP else round(REM_CHIP * COL_CHIP / a, 3)


def _ancho_st(v):
    return sum(ANCHO_GL.get(c, 12) for c in str(v))


# ⚠️ EL VALOR DE ABAJO ACHICA APENAS AL CRECER, no solo cuando ya no entra.
# Dlx: "cuando sean 2 digitos quizas hacerlo un poco mas pequeño para que no se
# alargue tanto... pero poquito". Con el limite de ancho a secas, 38/61 entraba
# de sobra y salia del mismo tamaño que 4/6, asi que la fila se alargaba al
# doble sin avisar. Con la raiz el castigo crece despacio:
#
#     4/6       30 px de tinta   1.120 rem   entero
#     38/61     54               0.972       13% mas chico
#     104/141   78               0.850       24%
#
# El exponente .35 es lo que separa "se nota que crecio" de "se achico". A 1
# seria proporcional y 104/141 quedaria a la mitad; a 0 no se achicaria nunca.
CRECE = .35


def _rem_pie(v, col=None):
    """El tamaño del valor de la fila de abajo."""
    a = _ancho_st(v)
    r = REM_ST * min(1., (30. / a) ** CRECE) if a > 30 else REM_ST
    return round(min(r, REM_ST * (col or COL_PIE) / a), 3)


def _rem_st(v, col=COL_NUM):
    """El valor se achica solo si no entra, como ya hace el nombre.

    ⚠️ ACHICAR ES MEJOR QUE ENSANCHAR LA COLUMNA. Para que 169/228 entrara a
    tamaño entero la columna tendria que medir 78, y con la etiqueta al lado
    serian 109 de los 115.5 que tiene cada mitad: la pareja quedaria pegada a
    los bordes y dejaria de leerse como una unidad centrada.
    """
    a = _ancho_st(v)
    return REM_ST if a <= col else round(REM_ST * col / a, 3)


# ══ LOS JUEGOS DE STATS QUE SE PROBARON ══
# No son variantes del mismo bloque: cada uno contesta OTRA PREGUNTA, y por eso
# se comparan enteros y no casillero por casillero.
#
#   pre     que hiciste          lo que Dlx pidio en su momento
#   nac     donde estas entre los tuyos
#   camino  como llegaste hasta ahi   una sola pregunta, seis angulos
#   mitad   la mitad hoy, la mitad cuando exista la competencia
#   cuatro  lo mismo que nac pero SIN RELLENO
#
# ⚠️ 'cuatro' esta para discutir el numero seis, no para ganarle a los otros.
# Nadie dijo que tienen que ser seis: la Competitiva tiene cinco dimensiones y
# la columna de la Servidor tiene cuatro. Con cuatro, cada numero entra mas
# grande y no hay que inventar dos para llenar. El precio es que la mitad de
# abajo de la carta queda mas vacia.
JUEGOS = {
    'pre':    ['SEM', 'EVT', 'POD', 'WIN', 'DUE', 'FCH'],
    'nac':    ['DE', 'DIF', 'MEJ', 'SUB', 'SEL', 'DUE'],
    'camino': ['DE', 'DIF', 'SUB', 'MEJ', 'PICO', 'TMP'],
    'mitad':  ['DE', 'DIF', 'SUB', 'NAC', 'PODN', 'DUE'],
    'cuatro': ['DE', 'DIF', 'SUB', 'DUE'],
    'podio':  ['DE', 'DIF', 'SUB', 'SEG', 'TER', 'DUE'],
    'duelos': ['DE', 'DIF', 'SUB', 'SEG', 'TER', 'DNI'],
    # ⚠️ LOS DUELOS SON DOS STATS, NO UNA CON BARRA. Dlx: "DNA y DIN deben ser
    # 2, internacionales internacionales y dna nacionales, pueden estar abajo
    # ambas, tipo centrado". Partirlos cuesta un casillero —eran siete
    # candidatos para seis lugares— y por eso hay dos versiones: la que
    # conserva DE, que es el denominador del #N de la bandera, y la que
    # conserva SUB, que es el movimiento. Es lo unico que las separa.
    'duelos2': ['DE', 'DIF', 'SEG', 'TER', 'DNA', 'DIN'],
    'duelos3': ['DIF', 'SUB', 'SEG', 'TER', 'DNA', 'DIN'],
    # ⚠️ EL DE LA CARTA, Y LAS SEIS SON EL MISMO CORTE. Dlx saco DE y DIF —que
    # eran "de cuantos compatriotas" y "cuanto te falta para el #1"— y pidio
    # eventos participados por alcance. Con eso el bloque queda partido de una
    # sola manera, NACIONAL contra INTERNACIONAL, en las tres filas:
    #
    #     EVN · EVI    en cuantos jugaste
    #     SEG · TER    como te fue      (el 1o ya esta en el trofeo)
    #     DNA · DIN    duelos ganados/jugados contra cada tipo de rival
    #
    # Que las seis se partan igual es lo que hace que el bloque se lea de una:
    # la columna izquierda es lo tuyo adentro del pais y la derecha afuera.
    # DE y DIF no entraban en ese corte —eran del pool, no de la competencia—
    # y por eso desentonaban aunque los numeros estuvieran bien.
    #
    # ⚠️ REGIONALES NO. Dlx ya dijo de los trofeos que "usualmente no se hace
    # en Discord regionales"; meter un tercer alcance seria abrir una columna
    # que va a estar en cero para todos.
    # ⚠️ EL DE LA CARTA. Las seis se parten TODAS igual, nacional a la
    # izquierda e internacional a la derecha, y las tres filas dejan ver ese
    # corte de una: EVN·EVI donde jugaste, SEG·TER como te fue, DNA·DIN los
    # duelos ganados sobre jugados contra cada tipo de rival.
    #
    # ⚠️ LOS DUELOS ESTUVIERON EN DOS CHIPS A LA DERECHA Y VOLVIERON ACA. La
    # idea funcionaba —los chips son el lenguaje de la Competitiva y se veian
    # bien— pero costaba mas de lo que daba: sacarlos del bloque deja una fila
    # vacia, y NO HAY dos stats mas que valgan. Se probaron cinco juegos y las
    # candidatas se caen todas solas (ver la lista de abajo); las mejores que
    # quedaban eran MEJ y SUB, que ademas de pedir historial que no existe no
    # se entienden sin explicacion.
    #
    # O sea que el precio de los chips era inventar dos datos para tapar el
    # agujero que ellos mismos abrian. El codigo de los chips se queda —vive en
    # los juegos 'chips-*' y en --chips— pero la carta no los usa.
    'final':  ['EVN', 'SEG', 'EVI', 'TER', 'DNA', 'DIN'],
    # ⚠️ CON LOS DUELOS EN LOS CHIPS, EL BLOQUE SE QUEDA CON CUATRO Y SOBRA UNA
    # FILA. Estas tres son que poner ahi, y no son variantes de lo mismo:
    #
    #   pais    el nombre del pais escrito. La carta entera habla de un pais y
    #           NUNCA lo dice: lo dice la bandera, y con dieciseis banderas hay
    #           dos que comparten la suya —Colombia y Ecuador— asi que hay un
    #           caso donde el dato no esta en ningun lado.
    #   mas     dos stats mas, MEJ y SUB: el techo y el movimiento.
    #   nada    dos por dos y se acabo. Mas aire y ningun relleno.
    'chips-pais': ['EVN', 'SEG', 'EVI', 'TER', 'PAIS'],
    'chips-mas':  ['EVN', 'SEG', 'EVI', 'TER', 'MEJ', 'SUB'],
    'chips-nada': ['EVN', 'SEG', 'EVI', 'TER'],
}
# como se rotula cada uno en la carta
SIGLA = {'PODN': 'POD', 'DNI': 'DUE'}

# ⚠️ ESTOS JUEGOS NO SON DOS COLUMNAS DE TRES: son un 2x2 y un par centrado
# debajo. La fila de abajo cruza las dos columnas, asi que el divisor vertical
# tiene que quedarse arriba — si cruzara entero, partiria en dos una fila que
# justamente esta para leerse junta.
PIE_2 = {'duelos2', 'duelos3', 'final', 'chips-pais', 'chips-mas'}
# el nombre del pais no es un numero: va sin etiqueta y a lo ancho
PIE_PAIS = {'chips-pais'}

# ══ DONDE ACABA LA TINTA DE CADA ICONO DEL PANEL ══
# En px de carta. NO se deducen leyendo el CSS: los cinco .ic miden 26x26 y van
# centrados, pero cada dibujo los llena distinto —el trofeo ocupa x=4..20 de un
# viewBox de 24, la bandera lo llena entero, el escudo del servidor casi—, asi
# que la caja termina siempre en 50 y la tinta no.
#
# Salen de medir con herramientas/hueco_numeros.py: se renderiza con y sin el
# icono, se restan las dos imagenes y se busca la ultima columna que quedo
# pintada. Correr maqueta.py primero, que es quien deja el _maqueta.html.
# ⚠️ Si un icono cambia de dibujo, hay que volver a medirlos.
# ⚠️ EL DE LA BANDERA CAMBIO CUANDO EL CHIP PASO A SER UNA IMAGEN. Valia 55.5
# con la bandera dibujada en CSS, que se escalaba a 32 de ancho; el PNG llena
# su .ic entero y su tinta acaba en 62.0. El numero viejo no estaba mal: media
# otra cosa. Cada vez que un icono cambia de origen hay que volver a medirlo,
# y el que avisa es este mismo script.
TINTA_DER = {'ban': 62.0, 'rg': 47.8, 'sv': 50.8, 'tro': 44.5}

# ⚠️ NEGATIVO A PROPOSITO: el numero MONTA sobre el borde de la tinta. Es el
# hueco que tenia el x1 que Dlx aprobo. A hueco 0 ya se lee separado.
HUECO_X = -2.5
LANE_X = 5          # donde arranca .lane, y con ella cada .cas


# ══ LAS ESTRELLAS DEL MUNDIAL ══
# ⚠️ UNA ESTRELLA = UN MUNDIAL, y van arriba del nombre porque es donde van en
# una camiseta: sobre el escudo. La carta ya es una camiseta de seleccion —el
# fondo es la bandera— asi que el lugar no se elige, se hereda.
#
# ⚠️ Y NO REEMPLAZAN AL CASILLERO DEL MUNDIAL: lo acompañan. El casillero dice
# CUANTOS con su xN y vive en la columna de datos; la estrella dice QUE SOS y
# vive en la zona de identidad. Es la misma division que ya separa el panel de
# las stats. Si alguna vez hay que elegir una sola, la que se va es la
# estrella: el numero es el dato.
#
# ⚠️ LLEVAN CONTORNO Y NO SOLO SOMBRA, igual que las de la Servidor y por el
# mismo motivo medido alla: una estrella blanca sobre una bandera blanca da
# 1.00:1 y desaparece. Aca ademas caen sobre CUALQUIER bandera, que es peor
# que un fondo que controlamos.
#
# ⚠️ HOY NO LAS TIENE NADIE. La Copa de Naciones arranca en T2, asi que esto
# solo se puede mirar simulado — igual que el casillero del mundial.
ESTRELLA = ('M12 2 L14.9 8.9 L22.4 9.5 L16.7 14.4 L18.4 21.7 L12 17.8 '
            'L5.6 21.7 L7.3 14.4 L1.6 9.5 L9.1 8.9 Z')
EST_LADO = 15
EST_HUECO = 4


def estrellas(n, i, izq, ancho, y):
    """Las n estrellas del mundial, centradas sobre la banda del nombre.

    ⚠️ RECIBE EL BORDE IZQUIERDO Y NO SOLO EL ANCHO. Se centran en la ZONA
    DERECHA —de LW a 300, que es donde vive el nombre— pero se posicionan
    desde el borde de la carta, asi que sin el desplazamiento quedaban 69 px
    a la izquierda, sobre el panel.
    """
    if not n:
        return ''
    tot = n * EST_LADO + (n - 1) * EST_HUECO
    x0 = izq + (ancho - tot) / 2
    out = []
    for k in range(n):
        out.append(
            f'<svg class="est" viewBox="0 0 24 24" width="{EST_LADO}" '
            f'height="{EST_LADO}" style="left:{x0 + k * (EST_LADO + EST_HUECO):.1f}px;'
            f'top:{y:.1f}px">'
            f'<defs><linearGradient id="es{i}{k}" x1=".15" y1="0" x2=".8" y2="1">'
            '<stop offset="0" stop-color="#FFFFFF"/>'
            '<stop offset=".42" stop-color="#F6F6FA"/>'
            '<stop offset=".72" stop-color="#D9DBE6"/>'
            '<stop offset="1" stop-color="#AEB2C4"/></linearGradient></defs>'
            f'<path d="{ESTRELLA}" fill="url(#es{i}{k})" '
            'stroke="rgba(0,0,0,.7)" stroke-width="1.7" '
            'stroke-linejoin="round" paint-order="stroke"/></svg>')
    return ''.join(out)


# ══ TEXTURAS DEL PANEL ══
# ⚠️ EL PANEL ES DONDE VIVEN LOS CIRCULOS, asi que su textura tiene el mismo
# techo que la de la banda del nombre: si se nota, compite con lo unico que esa
# zona tiene que decir. La banda esta a 4-7% de alfa por eso mismo, y aca hay
# un motivo mas — el panel es .90 opaco, o sea que YA tiene la bandera del pais
# colandose al 10%. Una textura encima no cae sobre negro, cae sobre eso.
#
# 'rango' es la unica que no es decoracion: reusa la textura que la banda del
# nombre ya tiene para ese rango, asi que las dos superficies pasan a ser el
# mismo material y la carta se lee de una pieza. Las otras cuatro son formas
# sueltas, buenas o malas por si mismas.
PANEL_TEX = {
    'plano':   ('', 'como esta hoy, sin textura'),
    'rango':   ('@', 'la MISMA textura que la banda del nombre, por rango'),
    'rayado':  ('repeating-linear-gradient(48deg,rgba(255,255,255,.045) 0 1px,'
                'transparent 1px 9px)', 'rayado fino en diagonal'),
    'vertical': ('repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 1px,'
                 'transparent 1px 6px)',
                 'rayas verticales, que acompañan al divisor'),
    # ⚠️ LA ELEGIDA, Y NO POR COMO SE VE A 300 PX. Ver
    # herramientas/textura_al_achicar.py: 'puntos' es 58% mas fuerte a tamaño
    # entero y al 25% conserva solo el 25% de su amplitud contra el 45% de
    # esta, o sea que en absoluto la trama termina MAS presente. Y la grilla
    # de puntos deja 1.7 veces mas mancha, porque su frecuencia bate con la
    # del remuestreo y se vuelve parches grandes en vez de ruido parejo.
    # En Discord la carta casi nunca se ve a tamaño entero.
    'trama':   ('repeating-linear-gradient(45deg,rgba(255,255,255,.04) 0 1px,'
                'transparent 1px 7px),'
                'repeating-linear-gradient(-45deg,rgba(0,0,0,.10) 0 1px,'
                'transparent 1px 7px)', 'trama cruzada, como un tejido'),
    'puntos':  ('radial-gradient(rgba(255,255,255,.07) .8px,transparent .9px)',
                'una grilla de puntos finos'),
}
PANEL_TAM = {'puntos': 'background-size:6px 6px'}


def css_panel(modo, rg):
    """El fondo del panel. Vuelve vacio si no lleva textura."""
    t = PANEL_TEX[modo][0]
    if t == '@':
        t = TEXTURA[rg]
    return t


# ══ IDEAS PARA EL NUMERO ══
# ⚠️ EL PROBLEMA DE FONDO NO ES DONDE PONER EL NUMERO: ES QUE LOS ICONOS NO
# TIENEN UN BORDE COMUN. Mientras cada dibujo termine donde termina su tinta,
# "pegado" y "alineado" se pelean — pegarlos a la tinta los desalinea, y
# alinearlos los despega. Medido las dos veces en esta carta.
#
# Cuatro de estas seis ideas atacan eso: le dan al casillero UNA FORMA, y
# entonces las dos cosas pasan a ser la misma. Las otras dos se quedan sin
# contenedor y prueban si alcanza con cambiar el tratamiento del numero.
NUM_MODOS = {
    'tinta':    'sin contenedor — el numero pegado a la tinta (lo de hoy)',
    'placa':    'el casillero pasa a ser una placa redondeada',
    'anillo':   'el icono en un circulo con anillo del rango',
    'hexa':     'casillero hexagonal',
    'rombo':    'casillero en rombo, el numero en la punta',
    'pastilla': 'sin contenedor, el numero en pastilla del color del rango',
    'combo':    'anillo + pastilla, y cada icono al tamaño que le toca',
    # ── la familia combo: todas comparten circulo, aro e iconos medidos; lo
    #    que cambia es DONDE cae el numero y CUANTO color se reparte ──
    'combo-baja':   'la pastilla baja a la esquina, a las 4 en punto',
    'combo-oscura': 'pastilla oscura con filo; el numero toma el color',
    'combo-corta':  'sin la almohadilla y la pastilla mas chica',
    'combo-tenida': 'el circulo teñido del rango, la pastilla oscura',
    'combo-neutro': 'el circulo sin color; el rango vive solo en la pastilla',
    # ── y las tres del texto ──
    'combo-clara':  'las etiquetas mas blancas, de .72 a .95',
    'combo-mudo':   'sin etiquetas; el mismo icono con mas aire',
    'combo-grande': 'sin etiquetas y el icono a 34, que es lo que entra',
    'combo-rango':  'solo el rango conserva etiqueta; el resto no la necesita',
    # ── y dos que se traen el lenguaje de las otras dos cartas ──
    'combo-comp':   'como los rombos de la Competitiva: rombo, borde del rango',
    'combo-serv':   'como los circulos del pie de la Servidor: el numero DEBAJO',
    # ── las tres que salieron de la eleccion de combo-rango ──
    'combo-r1': 'sin etiquetas, con # al peso de la x',
    'combo-r2': 'la pastilla montada en el borde: mitad adentro, mitad afuera',
    'combo-r3': 'como r1, pero centrando el circulo Y su pastilla',
}

# ⚠️ SIN ALMOHADILLA. Con pastilla el # es redundante —el fondo ya separa el
# numero de todo lo demas— y ademas cuesta: son 6 px de los 24 que hay entre
# el circulo y el divisor. La x de los trofeos SI se queda, porque ahi no
# sobra: la x es el conteo, no un adorno. Dlx ya lo dijo cuando se probo
# esconderla en 1: "me referia al x por los titulos de q tiene".
SIN_ALM = {'combo-corta', 'combo-grande', 'combo-comp',
           'combo-serv'}


# ⚠️ LAS VARIANTES SOLO ESCRIBEN LA DIFERENCIA. Todas heredan el circulo, el
# aro, el recorte y los factores por icono de 'combo'; aca abajo va nada mas
# lo que cambia. Si una variante repitiera el bloque entero, arreglar el
# tamaño de un icono habria que hacerlo seis veces y la sexta se olvidaria.
_COMBO = {
    # a las 4 en punto. El circulo va de 23 a 51 y la pastilla arranca en 45,
    # o sea que monta 6 px sobre el borde y el resto cuelga afuera; mas
    # adentro tapaba el dibujo, mas afuera dejaba de tocar el aro.
    'combo-baja': (chr(10) + '.lane.%(m)s .cas .x'
                   '{left:40px;top:17px;transform:none}'),
    'combo-oscura': (chr(10) + '.lane.%(m)s .cas .x'
                     '{background:rgba(9,11,20,.94);color:var(--acc);'
                     'box-shadow:0 0 0 1px var(--acc),0 1px 3px rgba(0,0,0,.75)}'),
    'combo-corta': (chr(10) + '.lane.%(m)s .cas .x'
                    '{font-size:.44rem;padding:2px 3px;border-radius:8px}'),
    'combo-tenida': (chr(10) + '.lane.%(m)s .ic'
                     '{background:color-mix(in srgb,var(--acc) 26%%,transparent)}'
                     + chr(10) + '.lane.%(m)s .cas .x'
                     '{background:rgba(9,11,20,.94);color:#fff;'
                     'box-shadow:0 0 0 1px var(--acc),0 1px 3px rgba(0,0,0,.75)}'),
    'combo-neutro': (chr(10) + '.lane.%(m)s .ic'
                     '{border-color:rgba(255,255,255,.20)}'),
    'combo-clara': (chr(10) + '.lane.%(m)s .cas i{opacity:.95}'),
    'combo-mudo': (chr(10) + '.lane.%(m)s .cas i{display:none}'),
    # ⚠️ EL TAMAÑO DEL ICONO Y LA POSICION DE LA PASTILLA ESTAN ATADOS. Con el
    # circulo a 35 el borde derecho se va a 54.5 y la pastilla arranca en 52;
    # con dos cifras y almohadilla acabaria en 73, y el panel termina en 69.
    # Por eso esta variante lleva las dos cosas juntas: sin almohadilla —ya
    # esta en SIN_ALM— y la pastilla a las 4 en punto, que es donde el panel
    # todavia tiene ancho. No son tres decisiones sueltas, es una.
    # ⚠️ 34 Y NO 35. A 35 entraba —el ultimo casillero quedaba a 1.0 px del
    # sello UL— pero cada px de circulo cuesta SEIS de alto, porque son seis
    # casilleros. Un px de mas y se pisa. A 34 quedan 7.0.
    'combo-grande': (chr(10) + '.lane.%(m)s .cas i{display:none}'
                     + chr(10) + '.lane.%(m)s .cas .x'
                     '{left:44px;top:22px;transform:none}'),
    # ⚠️ LA UNICA ETIQUETA QUE DICE ALGO QUE EL ICONO NO DICE ES LA DEL RANGO.
    # El escudo de TWR ya dice TWR, el logo de crew ya es la crew, y la copa y
    # el globo se distinguen entre si por la forma. Pero las ocho figuras de
    # rango se separan por figura y color, y eso se lee de memoria: SSS se lee
    # de una. Asi que esta variante paga alto solo por esa.
    #
    # El :not(:has()) elige el casillero POR SU ICONO y no por su posicion,
    # que es lo que hace falta: el orden cambia —hay gente sin crew y sin
    # trofeos— y un :nth-child se estaria refiriendo a otro casillero en cada
    # carta.
    # ⚠️ EL GIRO VA EN .ic Y EL CONTRAGIRO EN SUS HIJOS, no al reves. Girar el
    # icono adentro de una caja sin girar deja la caja cuadrada y el recorte
    # no seria un rombo. Y el contragiro tiene que MULTIPLICARSE con el scale
    # por icono, no reemplazarlo: son la misma propiedad, y el ultimo
    # transform que se escriba gana. Por eso .ic > * se escribe aca y los
    # factores por icono se le suman despues, no antes.
    #
    # ⚠️ 30 CON 16 DE AIRE, Y EL AIRE ES CASI TODO ROTACION. La rotacion no
    # cambia la caja de LAYOUT: un rombo de lado 30 mide 30 para el flujo y
    # pinta 42.4, o sea que se come 12.4 del hueco siguiente. El aire que se
    # ve es gap - 12.4 = 3.6, no 16.
    # Por eso la primera version quedo con gap 6 y los rombos encimados: por
    # caja daba 268 de 276 y parecia lleno, pero pintado sobraban 73 px al
    # final de la columna. Medir la caja de algo girado no sirve.
    # A 41 —el piso de la Competitiva— seis rombos pintarian 348 y no entran
    # ni sin aire: alla son TRES y aca son SEIS.
    'combo-comp': (chr(10) + '.lane.%(m)s .ic{transform:rotate(45deg)}'
                   + chr(10) + '.lane.%(m)s .cas i{display:none}'
                   + chr(10) + '.lane.%(m)s .cas .x'
                   '{left:43px;top:26px;transform:none}'),
    # ⚠️ EL NUMERO VA DEBAJO Y EL AIRE BAJA A 6. En la Servidor el numero
    # cuelga del circulo y la etiqueta va abajo de eso; aca la etiqueta se
    # cae, porque seis pisos de tres cosas no entran. Medido: circulo 28 +
    # numero 10 + 3 de aire son 41 por casillero, y seis a 6 de gap piden 276
    # justos.
    # ⚠️ ACA EL NUMERO VUELVE AL FLUJO. En todas las demas variantes es
    # absoluto —cuelga del icono y no ocupa alto—, pero si va DEBAJO tiene que
    # empujar: con position:absolute el .cas seguia midiendo 28 y el numero se
    # dibujaba encima del icono del casillero siguiente. Se veia como un error
    # de posicion y era un error de flujo.
    'combo-serv': (chr(10) + '.lane.%(m)s .cas i{display:none}'
                   + chr(10) + '.lane.%(m)s .cas .x'
                   '{position:static;display:block;margin:3px 0 0;'
                   'text-align:center;background:none;box-shadow:none;'
                   'padding:0;transform:none;color:var(--acc);'
                   'font-size:.62rem;text-shadow:0 2px 5px rgba(0,0,0,.9)}'),
    # r1 — lo elegido, sin la etiqueta del rango y con la almohadilla puesta
    'combo-r1': (chr(10) + '.lane.%(m)s .cas i{display:none}'
                 + chr(10) + '.lane.%(m)s .cas .x'
                 '{left:44px;top:22px;transform:none}'),
    # ⚠️ r2 — LA PASTILLA SE CENTRA EN EL BORDE, no se apoya al lado. Es el
    # punto de nivel de la Competitiva: va en right:-3.5 bottom:-3.5 de un
    # rombo de 41, o sea con su CENTRO sobre el vertice, mitad adentro y
    # mitad afuera. Aca el punto equivalente del circulo de 34 son las 4 en
    # punto: (37+12, 17+12) en px de carta.
    # El translate(-50%,-50%) no es cosmetico: la pastilla cambia de ancho
    # con el numero —#1, #15, x2— y anclada por left se descentraria sola en
    # cuanto el numero tenga dos cifras.
    'combo-r2': (chr(10) + '.lane.%(m)s .cas i{display:none}'
                 + chr(10) + '.lane.%(m)s .cas .x'
                 '{left:44px;top:29px;transform:translate(-50%%,-50%%)}'
                 + chr(10) + '.lane.%(m)s{transform:translateX(%(dx2)s)}'),
    # r3 — el mismo r1 corrido: lo que se centra es el conjunto
    'combo-r3': (chr(10) + '.lane.%(m)s .cas i{display:none}'
                 + chr(10) + '.lane.%(m)s .cas .x'
                 '{left:44px;top:22px;transform:none}'
                 + chr(10) + '.lane.%(m)s{transform:translateX(%(dx)s)}'),
    'combo-rango': (chr(10) + '.lane.%(m)s .cas:not(:has(.ic.rk)) i'
                    '{display:none}'
                    + chr(10) + '.lane.%(m)s .cas i{opacity:.95}'
                    + chr(10) + '.lane.%(m)s .cas .x'
                    '{left:44px;top:22px;transform:none}'),
}


def _familia(m):
    """Las variantes de combo comparten forma, aire, recorte y relleno."""
    return 'combo' if m.startswith('combo') else m

# ⚠️ EN 'combo' LOS ICONOS NO MIDEN TODOS LO MISMO, Y ESA ES LA IDEA. Medido
# dentro del anillo —radio interior 12.5— la tinta de cada uno daba:
#
#   casillero   r de su tinta   fuera del circulo
#   bandera         14.8            9.8%
#   TWR             14.7            3.2%
#   SSS             10.5            0%    le sobraba sitio
#   NACIONAL        10.0            0%    le sobraba sitio
#
# O sea que igualar la CAJA no iguala nada: dos se salian y dos flotaban
# chicos adentro. Es la misma leccion que ya estaba en procesar_logos.py —
# normalizar por TINTA y no por caja— aplicada al panel.
#
# Se resuelve en dos grupos, segun que sea el dibujo:
#
#   los que son una superficie (la bandera, la baldosa de TWR) LLENAN el
#   circulo y se recortan con el. Es la moneda de bandera de toda la vida, y
#   encogerlas hasta que les entre la diagonal las dejaba en 0.84 — una
#   bandera de 18 px al lado de una estrella de 25.
#
#   los que son un dibujo suelto (rango, trofeos, crew) se AGRANDAN hasta
#   acercarse al aro, que es donde ya deberian haber estado.
# ⚠️ CADA DIBUJO LLEVA SU FACTOR, Y NO SE PUEDE SACAR DE UN SOLO NUMERO. Se
# probo con uno solo, 1.14 para los cuatro, y la estrella se comio el aro: ya
# estaba en 13.0 SIN escalar, o sea pasada del radio interior de 12.5.
#
# Medido en crudo adentro del circulo de 25 (r maximo, y area de tinta):
#
#   icono       r max   area   disco equivalente
#   bandera      19.7    725       15.2   <- superficie, se recorta
#   TWR          18.4    610       13.9   <- superficie, se recorta
#   SSS          13.0    283        9.5
#   crew         12.5    258        9.1
#   copa         11.1    142        6.7
#   globo         9.0    211        8.2
#
# ⚠️ Y LOS DOS NUMEROS SE CONTRADICEN. Por radio, la copa (11.1) le gana al
# globo (9.0) y el globo parece el chico. Por area es al reves: el globo tiene
# 211 y la copa 142, o sea que la copa es LA MAS LIVIANA de las seis. No es
# que una medicion este mal: el radio maximo premia a las formas con esquinas
# y el area premia a las macizas, y la copa es ancha y hueca mientras el globo
# es redondo y lleno.
#
# Manda el radio, porque es el que decide si el dibujo se recorta contra el
# aro. Pero el globo baja un escalon aparte: un disco lleno al mismo radio que
# una copa de contorno pesa mucho mas. Igualar area es imposible sin recortar
# —la copa pediria x1.27 y se saldria— asi que la copa queda un poco liviana,
# y eso es del dibujo, no del encuadre.
R_OBJETIVO = 11.8
# ⚠️ CUANTO HAY QUE CORRER LA COLUMNA PARA QUE EL CONJUNTO QUEDE CENTRADO.
# Sale de medir, no de calcular: se mide de donde a donde PINTA el conjunto
# —circulo mas pastilla— y se lo centra entre el filo del marco y el divisor.
# Medido sobre r1: el conjunto pinta de 19.8 a 61.8 y su centro cae en 40.8,
# mientras que el panel util —del filo interno del marco, 2.3, al divisor,
# 68.0— tiene el suyo en 35.1. Son 5.7 px, no los 7 que daba la cuenta a
# mano: el circulo no llega a su borde teorico porque el aro se pinta hacia
# adentro.
DX_R3 = '-5.7px'

# ⚠️ r2 TAMBIEN SE CORRE, PERO MUCHO MENOS. Meter la pastilla adentro del
# borde ya devuelve casi todo el centrado solo: el desvio cae de 5.7 a 1.9 sin
# tocar nada, porque lo que descentraba no era el circulo sino la pastilla
# colgando afuera. Lo que queda es lo que la pastilla sigue asomando.
DX_R2 = '-1.9px'

ESCALA_ICONO = {'rk': 0.91, 'cw': 0.94, 'tro-nac': 1.06, 'tro-int': 1.13}

# lado de la caja y aire de adentro, por modo
# ⚠️ LA FORMA CRECE, EL ICONO NO. Primero se probo al reves —forma de 30 con
# el icono adentro— y los cuatro iconos encogian de 26 a 22: la idea se
# juzgaba contra un dibujo mas chico y no contra la idea. El aire de adentro
# esta calculado para que el icono siga midiendo 24, o sea casi los 26 de hoy.
# El rombo necesita mas caja que los demas: un cuadrado de 24 tiene 33.9 de
# diagonal y esa diagonal es lo que tiene que entrar.
_FORMA = {'placa': (28, 3), 'anillo': (28, 3), 'hexa': (28, 3),
          'rombo': (34, 6), 'combo': (28, 0), 'combo-grande': (34, 0),
          'combo-rango': (34, 0), 'combo-comp': (30, 0),
          'combo-r1': (34, 0), 'combo-r2': (34, 0),
          'combo-r3': (34, 0),
          'combo-serv': (28, 0)}

# ⚠️ EL CONTENEDOR SE PAGA CON AIRE ENTRE CASILLEROS, y el presupuesto lo fija
# EL PEOR CASO, que no es el de Konan. Konan tiene cuatro casilleros; el que
# manda es el de SEIS —bandera, rango, servidor, crew, nacional y mundial—,
# que hoy no lo tiene nadie porque la Copa de Naciones arranca en T2. Medir
# con la carta de hoy da headroom de sobra y no dice nada.
#
# Medido con los seis puestos: del techo del panel al sello UL hay 276 px.
#
#   idea       caja  paso   seis piden   sobra
#   tinta       26    48       276         1.8   <- justo
#   placa 32    32    54       312       -34.2   se pisa
#   rombo 40    40    62       360       -82.2   se pisa
#
# O sea que el contenedor NO sale gratis. Entra si el icono baja de 26 a 22 y
# el aire de 12 a 9 — y baja bien, porque el contenedor separa por si mismo lo
# que antes tenia que separar el aire.
#
# ⚠️ EL ROMBO NO ENTRA NI ASI: necesita 34 de caja para que un cuadrado de 22
# le quepa en la diagonal (22*raiz(2) = 31.1), y a 34 el paso deja 2.4 de aire.
# Es el unico de los seis que pide una carta mas alta.
_GAP = {'placa': 9, 'anillo': 9, 'hexa': 9, 'rombo': 3,
        'combo': 9, 'combo-grande': 12, 'combo-rango': 10,
        'combo-comp': 16, 'combo-serv': 6,
        'combo-r1': 12, 'combo-r2': 12, 'combo-r3': 12}

# ⚠️ EL margin-left NEGATIVO NO ES UN AJUSTE A OJO: la pastilla tiene 4 px de
# relleno propio, asi que sin el, el texto arrancaria 4 px mas a la derecha que
# en las ideas sin pastilla y el hueco de -2.5 dejaria de ser -2.5. Lo que se
# pega al icono es LA TINTA del numero, no la caja de su fondo.
# ⚠️ EL RELLENO ES 3 Y NO 4 POR EL DIVISOR. El panel acaba en x=69 —medido en
# el DOM, no mirando el render: a ojo lo habia puesto en 78.7 y sobraban 10 px
# que no existian—. Con relleno 4 y un numero de dos cifras la pastilla llegaba
# a 67.5 y quedaba 1.5 de aire; con 3 llega a 65.5 y quedan 3.5.
#
# ⚠️ Y ESTO HUNDE A 'pastilla', que no tiene contenedor: sus cuatro numeros
# arrancan en x distintos, asi que el mas largo empieza mas a la derecha y con
# dos cifras SE PASA del panel — 72.0 contra 69. El contenedor no solo alinea,
# tambien le pone techo a cuanto puede correrse el numero.
_PILDORA = ('.lane.%s .cas .x{background:var(--acc);color:#0B0B12;'
            'border-radius:9px;padding:2px 3px;margin-left:-3px;'
            'text-shadow:none;box-shadow:0 1px 3px rgba(0,0,0,.75)}')
_RECORTE = {
    'placa':  'border-radius:8px',
    'anillo': 'border-radius:50%',
    # ⚠️ overflow:hidden ES LO QUE HACE LA MONEDA. border-radius solo redondea
    # el fondo; sin el overflow los hijos siguen pintando en las esquinas y el
    # aro queda con la bandera saliendose por los cuatro lados.
    'combo':  'border-radius:50%;overflow:hidden',
    # ⚠️ EL ROMBO SE RECORTA IGUAL QUE EL CIRCULO. En la Competitiva no hace
    # falta —ahi el icono es una mascara blanca al 78%, que nunca llega al
    # borde— pero aca la bandera y la baldosa de TWR LLENAN su caja, asi que
    # sin overflow se saldrian por las cuatro esquinas del rombo girado.
    'combo-comp': 'border-radius:9px;overflow:hidden',
    'combo-serv': 'border-radius:50%;overflow:hidden',
    'hexa':   ('clip-path:polygon(50% 0,100% 25%,100% 75%,'
               '50% 100%,0 75%,0 25%)'),
    'rombo':  'clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)',
}
# ⚠️ EL RELLENO TIENE QUE VERSE. La primera vuelta los dejo en 5-8% de blanco
# y en la hoja no se distinguian de 'tinta': se estaba comparando una idea
# contra su propia version invisible. Un contenedor que no se ve no resuelve
# nada, porque lo que alinea al numero es que se le vea el borde.
_RELLENO = {
    'placa':  'background:rgba(255,255,255,.11);'
              'box-shadow:inset 0 0 0 1px rgba(255,255,255,.17)',
    'anillo': 'background:rgba(255,255,255,.08);border:1.5px solid var(--acc)',
    'combo':  'background:rgba(255,255,255,.08);border:1.5px solid var(--acc)',
    # el relleno y el borde son los de .skills i de 02_Competitivo/v2/card.css
    'combo-comp': ('background:linear-gradient(150deg,rgba(9,9,16,.95),'
                   'rgba(32,32,50,.95));border:2px solid var(--acc)'),
    # ⚠️ Y ACA EL FILO ES BLANCO, NO DEL RANGO. Es .ban del pie de la
    # Servidor: 0 0 0 1.5px rgba(255,255,255,.45). En esa carta el color del
    # rango lo lleva EL NUMERO, no el aro — por eso el numero va en var(--acc)
    # y el circulo se queda neutro. Copiar el aro de color rompia justo lo que
    # hace que ese pie se lea.
    'combo-serv': ('background:rgba(255,255,255,.06);border:0;'
                   'box-shadow:0 2px 7px rgba(0,0,0,.8),'
                   '0 0 0 1.5px rgba(255,255,255,.45)'),
    'hexa':   'background:rgba(255,255,255,.13)',
    'rombo':  'background:rgba(255,255,255,.13)',
}


# ══ EL TAMAÑO DEPENDE DE CUANTOS CASILLEROS HAYA ══
# ⚠️ ES LA REGLA QUE LA COMPETITIVA YA TIENE, no una invencion. Ahi los rombos
# van a 41 con tres, 44 con dos y 47 con uno, y el comentario de card.css lo
# dice: "41 es el PISO, la columna llena". Aca pasa lo mismo pero con circulos
# y con mas piezas — la columna llena son cinco.
#
# Dlx: "cuando esten todas puedas hacer que todos los circulos y labels se
# hagan quizas algo mas pequeño, pero poquititititito nada mas". Los escalones
# son de 2 px, o sea 6% por paso: se nota en la columna llena y no en las
# otras.
LADO_N = {3: 36, 4: 34, 5: 32, 6: 30}
# ⚠️ EL TAMAÑO DE LA ETIQUETA LO MANDA ESTA TABLA, NO la regla .cas i. Subir
# la base no hacia nada porque _por_cantidad() la pisa por cantidad de
# casilleros: se cambio .41 -> .44 en la base y el DOM seguia dando 6.56 px.
# Una constante que otra regla sobreescribe siempre es la que hay que tocar.
ETIQ_N = {3: .48, 4: .47, 5: .46, 6: .45}
LADO_BASE = 34        # con el que se midieron DX_R2 y las posiciones


def _sel(modo, n):
    """El selector de una variante con n casilleros."""
    return '.lane.%s.n%d' % (modo, n)


def css_num(modo):
    """El CSS que le sobra a cada idea. Va al final, para que gane."""
    if modo == 'tinta':
        return ''
    if modo == 'pastilla':
        # ⚠️ MISMA GEOMETRIA QUE 'tinta', SOLO CAMBIA EL TRATAMIENTO. Es la
        # prueba de si el numero se lee pegado por estar cerca o por estar
        # adentro de algo, y la respuesta fue que no: se quedo con los mismos
        # 11 px de spread, ahora subrayados por el color.
        return chr(10) + _PILDORA % modo
    fam = _familia(modo)
    # ⚠️ .get(modo) ANTES QUE LA FAMILIA: casi todas las variantes heredan la
    # forma de combo, pero combo-grande no puede — sin etiquetas le sobran
    # 60 px de alto y de eso se trata.
    s, pad = _FORMA.get(modo, _FORMA[fam])
    dentro = s - 2 * pad
    extra = ''
    if modo.startswith('combo'):
        # los dibujos sueltos se agrandan; las superficies ya llenan y se
        # recortan solas contra el overflow del circulo
        # ⚠️ SI EL CIRCULO CRECE, LOS DIBUJOS NO LO SIGUEN SOLOS. El escudo y
        # el logo de crew son <img> al 100%, asi que si; pero el rango sale a
        # 23 px clavados y los trofeos a 22, y esos se quedarian del mismo
        # tamaño adentro de un circulo mas grande. El factor del circulo se
        # les multiplica encima.
        k_c = s / 28
        # el rombo gira la caja, asi que todo lo de adentro tiene que
        # desgirarse — y en la MISMA declaracion que su escala
        giro = 'rotate(-45deg) ' if modo == 'combo-comp' else ''
        extra = (''.join(
                     chr(10) + '.lane.%s .ic.%s > svg,'
                     '.lane.%s .ic.%s img{transform:%sscale(%.2f)}'
                     % (modo, k, modo, k, giro, v * k_c)
                     for k, v in ESCALA_ICONO.items())
                 + chr(10) + '.lane.%s .ic.ban > em{'
                 'transform:translate(-50%%,-50%%) %sscale(%.5f)}'
                 % (modo, giro, (s - 3) / 200)
                 + (chr(10) + '.lane.%s .ic .esc{transform:%s}'
                    % (modo, giro) if giro else '')
                 + chr(10) + _PILDORA % modo
                 + (_COMBO.get(modo, '') % {'m': modo, 'dx': DX_R3,
                                            'dx2': DX_R2})
                 # ⚠️ VA DESPUES del bloque de la variante y con UNA CLASE MAS:
                 # esa variante ya escribio display:none sobre la misma
                 # etiqueta, asi que con la misma especificidad ganaria la
                 # ultima escrita y esto dependeria del orden del diccionario.
                 # ⚠️ EL AIRE BAJA A 9 CUANDO HAY ETIQUETAS, no por apretar:
                 # la etiqueta misma separa un casillero del siguiente, asi
                 # que 11 de vacio encima es aire de mas. Y hace falta —
                 # ahora la bandera tambien lleva etiqueta, o sea 10 px que
                 # antes no estaban, y el ultimo casillero habia quedado a
                 # 9.8 del sello.
                 + chr(10) + '.lane.%s.etiq .cas i{display:block;opacity:.95}'
                 % modo
                 + chr(10) + '.lane.%s.etiq{gap:9px}' % modo
                 + ''.join(_por_cantidad(modo, n, giro)
                           for n in sorted(LADO_N)))
    # el .ic va centrado en x=37, asi que su borde derecho cae en 37+s/2, y el
    # numero arranca HUECO_X antes. Uno solo para los cuatro: con forma comun,
    # pegado y alineado dejan de pelearse.
    izq = 37 + s / 2 + HUECO_X - LANE_X
    aire = chr(10) + '.lane.%s{gap:%dpx}' % (modo, _GAP.get(modo, _GAP[fam]))
    return (f'\n.lane.{modo} .ic{{box-sizing:border-box;width:{s}px;'
            f'height:{s}px;padding:{pad}px;{_RECORTE.get(modo, _RECORTE[fam])};'
            f'{_RELLENO.get(modo, _RELLENO[fam])}}}'
            f'\n.lane.{modo} .ic.ban > em{{'
            f'transform:translate(-50%,-50%) scale({dentro / W:.5f})}}'
            # el numero se va al medio de la forma: es donde toda forma es mas
            # ancha, y en el rombo y el hexagono es el unico punto donde el
            # borde derecho existe de verdad
            f'\n.lane.{modo} .cas .x{{left:{izq:.1f}px;top:{s / 2:.1f}px;'
            f'transform:translateY(-50%)}}' + aire + extra)


def _por_cantidad(modo, n, giro=''):
    """Todo lo que cambia cuando el circulo cambia de tamaño.

    ⚠️ NO ES SOLO width/height. Con el circulo escalan cuatro cosas mas, y
    olvidarse de cualquiera se ve enseguida:

      los dibujos sueltos   el rango sale a 23 px clavados y los trofeos a 22,
                            asi que no siguen al circulo solos
      la bandera            su chip se escala desde un div de 300x200
      la pastilla           va montada en el borde, a las 4 en punto, y ese
                            punto se mueve con el radio
      el corrimiento        lo que la pastilla asoma tambien escala
    """
    s = LADO_N[n]
    k = s / LADO_BASE
    r = s / 2
    # las 4 en punto del circulo, en coordenadas del casillero
    px, py = 32 + r * .7071, r + r * .7071
    sel = _sel(modo, n)
    return (chr(10) + '%s .ic{width:%dpx;height:%dpx}' % (sel, s, s)
            + ''.join(chr(10) + '%s .ic.%s > svg,%s .ic.%s img'
                      '{transform:%sscale(%.2f)}'
                      % (sel, ic, sel, ic, giro, v * s / 28)
                      for ic, v in ESCALA_ICONO.items())
            + chr(10) + '%s .ic.ban > em{transform:translate(-50%%,-50%%) '
            '%sscale(%.5f)}' % (sel, giro, (s - 3) / 200)
            + chr(10) + '%s .cas .x{left:%.1fpx;top:%.1fpx}' % (sel, px, py)
            + chr(10) + '%s{transform:translateX(%.1fpx)}'
            % (sel, float(DX_R2.rstrip('px')) * k)
            + chr(10) + '%s .cas i{font-size:%.2frem}' % (sel, ETIQ_N[n]))


def _bx(k):
    """El left del numero, relativo a su casillero."""
    return TINTA_DER[k] + HUECO_X - LANE_X

# ⚠️ LOS DOS ICONOS SON PROVISORIOS Y DIBUJADOS ACA. Cuando existan los de
# verdad entran igual que los escudos de servidor. Se eligieron dos formas que
# se separan a 20 px: una COPA —silueta cerrada, ancha arriba y con pie— y un
# GLOBO —circulo con meridianos—. Es la misma leccion de rangos.py: a este
# tamaño lo que distingue es la silueta, no el detalle.
# ⚠️ LOS DOS TROFEOS LLEVAN MATERIAL, NO BLANCO PLANO. Dlx: "hacer los iconos
# de nacional y mundial mas especial, o sea no blanco sino mas como el de TWR".
# El escudo de TWR es un PNG a color; estos son SVG, asi que su color sale de
# un degrade con luz arriba y sombra abajo, que es lo mismo que hace
# rangos.py con las piedras.
#
#     NACIONAL   oro, el mismo #FFD24A del rango S
#     MUNDIAL    acero azul, para que no se lea como otro oro
#
# ⚠️ Y NO SE USA EL ACENTO DEL PAIS: el de Argentina es blanco y el de Peru
# tambien, o sea que el trofeo desapareceria en las dos. Ya paso con la linea
# y con el logo de crew.
def _trofeo(uid, d, c1, c2, extra=''):
    return (f'<svg viewBox="0 0 24 24" width="22" height="22">'
            f'<defs><linearGradient id="{uid}" x1="0" y1="0" x2=".3" y2="1">'
            f'<stop offset="0" stop-color="{c1}"/>'
            f'<stop offset="1" stop-color="{c2}"/></linearGradient></defs>'
            f'{d.replace("CUR", f"url(#{uid})")}{extra}</svg>')


ICONO_TROFEO = {
    'nac': lambda i: _trofeo(
        f'tn{i}',
        '<path d="M7 3h10v4a5 5 0 0 1-10 0V3Z" fill="CUR" stroke="rgba(0,0,0,.6)"'
        ' stroke-width="1.1"/>'
        '<path d="M4 4h3v3.4a3.4 3.4 0 0 1-3-3.4ZM20 4h-3v3.4a3.4 3.4 0 0 0 3-3.4Z"'
        ' fill="CUR" opacity=".8"/>'
        '<path d="M10.4 12h3.2v5h-3.2zM7.2 19.2h9.6v2.2H7.2z" fill="CUR"'
        ' stroke="rgba(0,0,0,.55)" stroke-width="1"/>',
        '#FFE79A', '#C9902A'),
    'int': lambda i: _trofeo(
        f'ti{i}',
        '<circle cx="12" cy="12" r="8.4" fill="CUR" stroke="rgba(0,0,0,.6)"'
        ' stroke-width="1.1"/>',
        '#BFE3FF', '#2F6FA8',
        '<ellipse cx="12" cy="12" rx="3.7" ry="8.4" fill="none"'
        ' stroke="rgba(255,255,255,.75)" stroke-width="1.4"/>'
        '<path d="M3.6 12h16.8" stroke="rgba(255,255,255,.75)"'
        ' stroke-width="1.4"/>'),
}


# ══ LA TEXTURA DE LA BANDA DEL NOMBRE ══
# ⚠️ NO ES UN ADORNO SUELTO: SALE DEL MATERIAL DEL RANGO, que ya esta decidido
# en comun/rangos.py —amatista, diamante, oro, rubi, esmeralda, zafiro, plata,
# bronce— y que hasta ahora solo se veia en la figurita de la columna.
#
# ⚠️ VAN A 4-7% DE ALFA. La banda tiene que sostener el nombre en blanco: una
# textura que se note compite con lo unico que esa franja tiene que decir. Las
# probe a 12% y el nombre perdia filo.
TEXTURA = {
    'SSS': ('repeating-linear-gradient(58deg,rgba(255,255,255,.07) 0 1px,'
            'transparent 1px 7px),'
            'repeating-linear-gradient(-58deg,rgba(0,0,0,.09) 0 1px,'
            'transparent 1px 7px)'),
    'SS':  ('repeating-linear-gradient(58deg,rgba(255,255,255,.07) 0 1px,'
            'transparent 1px 7px),'
            'repeating-linear-gradient(-58deg,rgba(0,0,0,.09) 0 1px,'
            'transparent 1px 7px)'),
    'S':   ('repeating-linear-gradient(180deg,rgba(255,255,255,.06) 0 1px,'
            'transparent 1px 4px)'),
    'A':   ('repeating-linear-gradient(48deg,rgba(255,255,255,.055) 0 1px,'
            'transparent 1px 9px)'),
    'B':   ('repeating-linear-gradient(48deg,rgba(255,255,255,.055) 0 1px,'
            'transparent 1px 9px)'),
    'C':   ('repeating-linear-gradient(48deg,rgba(255,255,255,.055) 0 1px,'
            'transparent 1px 9px)'),
    'D':   ('repeating-linear-gradient(90deg,rgba(255,255,255,.06) 0 1px,'
            'transparent 1px 3px)'),
    'E':   ('repeating-linear-gradient(30deg,rgba(255,255,255,.05) 0 2px,'
            'transparent 2px 11px)'),
    # 🔴 SIN RANGO. Cada tramo tiene su trama a propósito —se eligieron a
    # mano, dice `CLAUDE.md`— y quien no tiene Score no está en ninguno: va
    # lisa. Una trama inventada diría que pertenece a algún nivel, que es
    # justo lo que el gris de `acc` evita.
    #
    # ⚠️ NO PUEDE SER LA CADENA VACÍA: la banda hace
    # `background:{TEXTURA[rg]},{tono(...)}` y una coma suelta rompe el CSS
    # entero, sin avisar. Un gradiente transparente es «nada» y se comporta
    # como una capa.
    '':    'linear-gradient(0deg,transparent 0,transparent 100%)',
}


def tono(c, f):
    h = c.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    if f >= 0:
        r, g, b = (int(x + (255 - x) * f) for x in (r, g, b))
    else:
        r, g, b = (int(x * (1 + f)) for x in (r, g, b))
    return '#%02X%02X%02X' % (r, g, b)


def b64(p):
    return ('data:image/png;base64,'
            + base64.b64encode(open(p, 'rb').read()).decode())


def crew_img(nombre):
    p = os.path.join(BASE, 'comun', 'logos_crew', '%s.png' % nombre)
    if os.path.exists(p):
        return '<img src="%s">' % b64(p)
    return '<span class="ini">%s</span>' % nombre[:2].upper()


def tag(pos, nac=0, mun=0, evt=0, pod=0, win='0%', rch=0, dna='', din=''):
    """El TAG nacional: una cascada, no un solo texto.

    Dlx: "crea mas tags".

    ⚠️ MISMA FORMA QUE comun/titulos.py Y POR EL MISMO MOTIVO: tres niveles y
    la primera regla que se cumple gana. Ahi esta escrito por que —una lista
    de "si cumple X" sin orden deja a la mayoria en el ultimo escalon— y la
    leccion vale igual aca.

    ⚠️ Y NO MIRA EL OVR, a proposito. El OVR ya es el numero grande de la
    carta: un TAG que salga de el diria dos veces lo mismo. Sale de LOGROS y
    de POSICION, que es lo que el numero no cuenta.

        t1   lo que casi nadie tiene: titulos y el primer puesto
        t2   lo que distingue: podio nacional, top del pais, volumen
        t3   el piso: todos representan

    ⚠️ LOS TEXTOS SIGUEN SIENDO PROVISORIOS. Las palabras de la Servidor
    —"DUEÑO DE CASA", "TOP DEL SERVIDOR"— son de servidor; estas son de pais y
    todavia no las aprobo nadie. Y los dos primeros niveles cuelgan de trofeos
    que NO EXISTEN hasta la T2, asi que hoy nadie los alcanzaria.
    """
    p = int(pos.split('/')[0]) if pos else 0
    t = int(pos.split('/')[1]) if pos else 0
    # ⚠️ float Y NO int: el pool guarda el win rate CON DECIMAL —'71.0%',
    # '57.3%'— y la maqueta lo tenia escrito a mano como '71%'. Con int() esto
    # reventaba en cuanto entraba un valor de verdad, o sea en las 138. No se
    # veia porque la unica muestra tenia el numero redondeado a mano.
    w = float(str(win).rstrip('%') or 0)
    # ⚠️ LOS DUELOS ENTRAN A LA CASCADA, y son lo unico que esta carta puede
    # mirar y las otras tres no: DNA y DIN parten el mismo hecho —ganaste un
    # duelo— por la NACIONALIDAD del rival. De ahi salen dos TAG que ninguna
    # otra carta podria tener.
    def _pct(x):
        try:
            a, b = str(x).split('/')
            return 100 * int(a) / int(b) if int(b) else None
        except Exception:
            return None

    ca, fu = _pct(dna), _pct(din)
    # ── t1 · lo que casi nadie tiene ────────────────────────────────────
    if mun >= 3:
        return ('INMORTAL', 't1')
    if mun >= 2:
        return ('LEYENDA MUNDIAL', 't1')
    # ⚠️ LA COMBINACION VA ANTES QUE SUS PARTES. Con el mundial solo se
    # llevaba a todos los que ademas eran campeones nacionales, y ese cruce es
    # mas raro que cualquiera de los dos por separado: si no va arriba, no se
    # ve nunca. Es la misma leccion de comun/titulos.py sobre el orden.
    if mun and nac:
        return ('DOBLE CORONA', 't1')
    if mun:
        return ('CAMPEÓN DEL MUNDO', 't1')
    if nac >= 3:
        return ('DINASTÍA NACIONAL', 't1')
    if nac >= 2:
        return ('BICAMPEÓN NACIONAL', 't1')
    if nac and p == 1:
        return ('REY DE SU PAÍS', 't1')
    if nac:
        return ('CAMPEÓN NACIONAL', 't1')
    if p == 1 and t >= 20:
        return ('EL MEJOR DE %d' % t, 't1')
    if p == 1 and w >= 70:
        return ('INTRATABLE', 't1')
    if p == 1:
        return ('Nº1 DEL PAÍS', 't1')
    # ── t2 · lo que distingue ───────────────────────────────────────────
    if (p == 2 or p == 3) and w >= 65:
        return ('PODIO Y PUNTERÍA', 't2')
    if p == 2 or p == 3:
        return ('PODIO NACIONAL', 't2')
    if ca is not None and fu is not None and fu - ca >= 10:
        return ('MEJOR AFUERA', 't2')
    if ca is not None and fu is not None and ca - fu >= 10:
        return ('FUERTE EN CASA', 't2')
    if p and t and p <= max(5, t * .25) and w >= 60:
        return ('TITULAR FIJO', 't2')
    if p and t and p <= max(5, t * .25):
        return ('SELECCIONABLE', 't2')
    if w >= 65 and evt >= 25:
        return ('GANA AFUERA', 't2')
    if pod >= 20:
        return ('BANDERA VIVA', 't2')
    if rch >= 8:
        return ('EN RACHA', 't2')
    if evt >= 40:
        return ('KILÓMETROS', 't2')
    # ── t3 · el piso ────────────────────────────────────────────────────
    if p and t and p <= t * .5:
        return ('MEDIA TABLA', 't3')
    if evt >= 12:
        return ('DA LA CARA', 't3')
    if not p:
        return ('SIN RANKING', 't3')
    return ('REPRESENTANTE', 't3')


UL = b64(os.path.join(BASE, '01_Temporada', 'ul_blanco.png'))


def panel_svg(i, LW, acc, remate, acorta=0):
    """El panel CERRADO: su contorno, no una raya suelta.

    ⚠️ SOLIDA NO ES LO MISMO QUE CERRADA, y ese fue mi error. Yo tenia una
    linea vertical de arriba abajo y la daba por buena porque ya no se
    desvanecia. Pero una linea sola no cierra nada: el panel tenia borde a la
    derecha y NADA arriba, abajo ni a la izquierda, asi que donde lo tocaba la
    banda del nombre las dos superficies se mezclaban — que es exactamente lo
    que Dlx sigue viendo.

    Cerrarlo es contornear su forma. Y su forma no es un rectangulo: es LA
    SILUETA recortada a los primeros LW px. Por eso son dos trazos:

        el borde IZQUIERDO   la silueta, recortada a la franja del panel
        el borde DERECHO     la vertical, recortada a la silueta

    Juntos dan una figura cerrada, y como van dibujados ENCIMA de la banda del
    nombre, la banda ya no puede fundirse con el panel: hay un filo en el medio.
    """
    d = silueta(acorta, remate)
    h = alto_de(remate, acorta)
    uid = f'p{i}{remate}{acorta}'
    return (f'<svg class="panelb" viewBox="0 0 {W} {h}" style="height:{h}px">'
            f'<defs>'
            f'<clipPath id="s{uid}"><path d="{d}"/></clipPath>'
            f'<clipPath id="f{uid}"><rect x="0" y="0" width="{LW}" '
            f'height="{h}"/></clipPath>'
            f'</defs>'
            # el filo oscuro primero, para que el color no toque la bandera
            f'<g clip-path="url(#f{uid})">'
            f'<path d="{d}" fill="none" stroke="rgba(6,8,16,.9)" '
            f'stroke-width="9"/>'
            f'<path d="{d}" fill="none" stroke="{acc}" stroke-width="4"/></g>'
            f'<g clip-path="url(#s{uid})">'
            f'<line x1="{LW}" y1="0" x2="{LW}" y2="{h}" '
            f'stroke="rgba(6,8,16,.9)" stroke-width="5"/>'
            f'<line x1="{LW}" y1="0" x2="{LW}" y2="{h}" '
            f'stroke="{acc}" stroke-width="2"/></g></svg>')


def marco_svg(modo, i, acc, acento_pais, acorta=0, remate='punta'):
    """El marco como STROKE RECORTADO, no como border de una caja.

    ⚠️ Y ESTO CORRIGE LO QUE YO TENIA. Usaba `border` sobre un div rectangular
    y despues clip-path: el borde se dibuja alrededor del RECTANGULO y el
    recorte se come todo lo que no toca sus lados, asi que del marco sobrevivian
    los dos costados rectos y nada mas — ni los hombros ni la punta.

    02_Competitivo/v2/shield.py ya lo explica para su carta: "el marco se dibuja
    con stroke recortado y no desplazando el contorno". Es lo mismo aca. El
    stroke sigue la silueta, y recortado con ella queda su mitad de adentro.

    ⚠️ EL MODO E ES LO QUE PIDIO DLX: la bandera arriba y el rango abajo, en un
    degrade. Es la unica forma de que el marco diga las dos cosas sin que una
    tape a la otra, y ademas cubre el agujero conocido del modo C — el acento
    de Argentina y el de Peru son BLANCOS, asi que arriba puede perderse contra
    su bandera, pero abajo el rango siempre es cromatico.
    """
    if modo == 'A':
        return ''
    trazo = {'B': acc, 'C': acento_pais, 'D': '#22283A'}.get(modo)
    if modo == 'E':
        pinta = f'url(#mk{i}{acorta})'
        defs = (f'<linearGradient id="mk{i}{acorta}" x1="0" y1="0" x2=".22" y2="1">'
                f'<stop offset="0" stop-color="{acento_pais}"/>'
                f'<stop offset=".46" stop-color="{acento_pais}"/>'
                f'<stop offset="1" stop-color="{acc}"/></linearGradient>')
    else:
        pinta, defs = trazo, ''
    d = silueta(acorta, remate)
    h = alto_de(remate, acorta)
    uid = f'{i}{modo}{acorta}{remate}'
    return (f'<svg class="marco" viewBox="0 0 {W} {h}" style="height:{h}px">'
            f'<defs>{defs}<clipPath id="mc{uid}">'
            f'<path d="{d}"/></clipPath></defs>'
            f'<g clip-path="url(#mc{uid})">'
            f'<path d="{d}" fill="none" stroke="rgba(6,8,16,.9)" '
            f'stroke-width="10"/>'
            f'<path d="{d}" fill="none" stroke="{pinta}" '
            f'stroke-width="5.2"/></g></svg>')


# ══ EL PRESET: LO QUE LA CARTA ES ══
# ⚠️ UN SOLO LUGAR, Y ESTO NACIO DE UN ERROR CONCRETO. En la Servidor el
# divisor se habia decidido en F y el default del script quedo en A; el dia
# que se escribio su generador, heredo la A y dibujo otra linea. Nadie mintio:
# la decision estaba tomada, escrita y mirada, pero vivia en el NOMBRE DE UN
# ARCHIVO de hoja comparativa y no en el codigo.
#
# Aca pasaba lo mismo en chiquito: los trece valores elegidos estaban una vez
# como defaults de argparse y OTRA VEZ escritos a mano adentro de generar.py.
# Dos copias de una decision es una copia de mas.
#
# Cada valor de aca es una decision de Dlx y esta justificada donde vive su
# tabla —MARCOS, REMATES, NUM_MODOS, PANEL_TEX, JUEGOS, CHIPS—.
PRESET = {
    'lane': 23,            # el ancho del panel izquierdo, en % de la carta
    'marco': 'B',
    'acorta': 0,
    'remate': 'recta',     # el pie cortado: la carta mide 402, no 463
    'iconos': 'colgado',
    'trofeo': 'E',         # el ×N como pastilla, sin mover el icono
    'num': 'combo-r2',     # circulo con aro del rango + pastilla a las 4
    'ul': 'panel',
    'stats': 'final',      # EVN·EVI / SEG·TER / DNA·DIN
    'caja': 'centro',
    'panel': 'puntos',     # la grilla de puntos finos
    'crew_on': False,      # la crew no habla del pais
    'etiq': True,          # PAIS / RANGO / SERVIDOR, genericas
    'ovr_der': False,      # el numero grande va a la izquierda
    'chip': 'caja',        # solo lo usan los juegos chips-*, que la carta no usa
    'tag_centro': True,
}


def carta_preset(i, LW, **cambios):
    """`carta()` con el preset puesto. Lo que se aparta, se nombra.

    ⚠️ USALO EN TODO LO QUE DIBUJE LA CARTA DE VERDAD. Las hojas comparativas
    llaman a `carta()` directo porque su trabajo ES apartarse del preset, pero
    un generador que repita los valores a mano se desincroniza el dia que uno
    cambie, y no avisa: dibuja una carta distinta de la decidida.
    """
    # ⚠️ `lane` NO es parametro de carta(): es de la CARTA, pero entra
    # convertido en LW —el ancho en px— porque carta() dibuja y no calcula.
    # Vive igual en el PRESET porque es una decision, y el que llama la usa
    # para sacar LW. Sacarla de aca a mano es lo unico que este helper pide.
    v = {**PRESET, **cambios}
    v.pop('lane', None)
    return carta(i, LW, **v)


def carta(i, LW, marco, tag_centro=True, acorta=0, remate='punta',
          iconos='colgado', trofeo='E', num='tinta', ul='panel',
          stats='final', caja='centro', panel='puntos',
          crew_on=False, etiq=True, ovr_der=False, chip='caja'):
    (nom, cc, rg, sv, crew, pos, ovr, sem, evt, pod, cam, win, rch,
     pos_rg, pos_sv, due, fch, t_nac, t_mun) = GENTE[i]
    # ⚠️ LOS TROFEOS SON DE CADA UNO, no de la maqueta. TROFEOS global existia
    # porque con una sola muestra daba igual, y en cuanto hay dos personas deja
    # de dar: las dos tendrian los mismos titulos. Se queda como fuente de los
    # NOMBRES y los iconos, y de los conteos solo cuando la persona los deja en
    # None — que es lo que usan las hojas que simulan casos moviendo el global.
    _tro = [(k, n, (v if c is None else c))
            for (k, n, v), c in zip(TROFEOS, (t_nac, t_mun))]
    # 🔴 UN PAIS QUE NO ESTA NO PUEDE TUMBAR LA TANDA — y este es el
    # lookup que de verdad la tumbó. Arreglé el de `fondos.css()`
    # primero y la corrida siguiente volvió a morir con el mismo
    # `KeyError: 'az'`: hay **dos** lugares que indexan `defs()` y el que
    # dibuja la carta es este. Arreglar uno de dos deja el bug igual de
    # vivo y con la misma cara.
    #
    # ⚠️ `??` es el fallback declarado, con su línea en `CLAUDE.md`.
    # Salir con el fondo neutro es la respuesta honesta; inventarle una
    # bandera a alguien no.
    _D = defs()
    acento_pais, base, fondo, extra, pais, _d = _D.get(cc) or _D['??']
    # ⚠️ EL FONDO SALE DEL PNG DE LA BANDERA, no de las capas CSS. Dlx: "la de
    # ecuador es horrible, usa las banderas oficiales". Y no era gusto: seis
    # de diecisiete llevan ESCUDO —Ecuador, Mexico, España, Bolivia, Guatemala
    # y Dominicana— y un escudo no se aproxima con gradientes; el de Ecuador
    # habia quedado en un ovalo celeste.
    # fondo() devuelve tambien el size y la position porque una imagen los
    # necesita y esas propiedades se escriben POR CAPA: si la bandera es la
    # tercera, su cover tiene que ser el tercer valor o se le aplica a la
    # capa equivocada.
    # ⚠️ LOS DOS BORDES DE LA BANDA SALEN DE YN, MEDIDOS UNA VEZ. El .nom se
    # posiciona con top:YN-16 pero su caja pintada no arranca ahi: con
    # YN=213.5 el DOM da 213.0..256.0, o sea YN-0.5 y YN+42.5. Pasar YN a
    # secas habria alineado el corte con un borde que no se ve.
    # el alto y la banda salen del remate de ESTA carta, no del global: con
    # otro remate la carta mide otra cosa y la banda se mueve con ella
    _H = alto_de(remate, acorta)
    _YN, _ = secciones(_H)
    capas, _tam, _pos = FON.fondo(cc, True, _H, (_YN - .5, _YN + 42.5))
    _fcss = ('background:%s;background-size:%s;background-position:%s'
             % (capas, _tam, _pos) if _tam else 'background:%s' % capas)
    # 🔴 «SIN RANGO» NO ES EL RANGO E. `CLAUDE.md`: *«darle el bronce diría
    # que es el peor, y no es eso — es que todavía no se sabe»*. El rango
    # sale del Score competitivo y hay gente que no tiene Score: los 303 que
    # entraron por `bot/paises_nuevos.py` —tienen país, que es el requisito
    # de esta carta, y ningún evento— y **todo el mundo el día que la T1
    # arranque en cero**. Hasta el 21/09/2026 `paises_nuevos.py` les clavaba
    # `'rango': 'E'` y el bot les decía que eran los peores de los ocho.
    #
    # El gris es el de `comun/bloqueada.py`, que se eligió exactamente para
    # esto: un tono que no es ninguno de los ocho niveles.
    #
    # ⚠️ Y EL CASILLERO DEL RANGO NO SE DIBUJA — ver más abajo. Es «sin dato
    # no hay pieza», la misma regla que ya aplican la crew y la bandera.
    acc = RG.ACENTO[rg] if rg else BL.TINTA
    # ⚠️ Y EL NÚMERO GRANDE VA EN «—», NO EN 0. El OVR Nacional se deriva del
    # Score; sin Score no hay con qué calcularlo. `04_Pais/generar.py:246` ya
    # devolvía `None` para este caso exacto —era `paises_nuevos.py` el que
    # ponía 0—, pero el camino nunca se había ejercitado porque hoy todos los
    # países del pool tienen Score Selección. Un 0 dice «te medimos y diste
    # cero»; un «—» dice «todavía no hay nada que medir», que es la verdad.
    ovr = '—' if ovr is None or ovr == '' else ovr

    # ⚠️ VACIO SI NO HAY SERVIDOR, o si el archivo no esta. Mas abajo el
    # casillero se omite; ver el comentario de `'SERVIDOR'`.
    esc = (os.path.join(BASE, 'comun', 'escudos_cuad', 'sv_%s.png' % sv.lower())
           if sv else '')
    if esc and not os.path.exists(esc):
        esc = ''
    # ⚠️ LA BANDERA DEL CHIP SALE DE fondos.defs(), NO DE UN PNG NUEVO. Es la
    # misma definicion que pinta el fondo de la carta, asi que si alguna se
    # corrige, se corrige en los dos lados a la vez. Bajar un PNG de flagcdn
    # ademas no sirve: Chromium no llega al CDN desde el entorno aislado, que
    # es lo que ya obligo a embeber todo lo demas en base64.
    # ⚠️ Y NO SE PINTA EL CSS DIRECTO EN UN CHIP DE 30 px: SE ESCALA LA CARTA
    # ENTERA. Las banderas estan escritas para 300x463 y varias tienen medidas
    # ABSOLUTAS —el sol de Argentina es un circulo de 20 px de radio, las
    # estrellas de Venezuela y EEUU son de 5, las franjas de Uruguay de 51—.
    # Puesto tal cual en un chip de 30, el sol de Argentina lo tapaba ENTERO:
    # su bandera salia un cuadrado amarillo liso.
    #
    # Escalando un div de 300x463 con transform, todo se achica junto y la
    # bandera del chip es exactamente la del fondo.
    # ⚠️ VUELVEN A SER DOS CASILLEROS. Los habia fusionado para que los
    # trofeos pudieran medir 34 como TWR, y Dlx corta esa via: "la idea no es
    # fusionar los iconos... en cualquier caso tendriamos que hacer mas
    # pequeño el esto". O sea: seis casilleros y el icono baja.
    #
    # Medido, con 246 px utiles: seis casilleros con hueco 6 dan 26 px de
    # icono. Es menos que 34 pero es LO MISMO PARA LOS SEIS, que es lo que
    # importaba — el problema nunca fue el tamaño absoluto sino que el trofeo
    # se viera mas chico que el escudo.
    # ⚠️ EL CHIP TAMBIEN. Y ahi la imagen es ESTRICTAMENTE mejor que el CSS:
    # las definiciones estan escritas para 300x463 y varias tienen medidas
    # ABSOLUTAS —el sol de Argentina es un circulo de radio 20, las estrellas
    # de Venezuela y EEUU miden 5— asi que habia que escalar un div entero con
    # transform para que no se deformaran. Una imagen 3:2 en un chip 3:2 no
    # necesita nada de eso.
    _bimg = FON.imagen(cc)
    _b = ','.join(x for x in (extra, fondo) if x)
    # ⚠️ LA BANDERA TAMBIEN LLEVA SU NUMERO AL LADO. Dlx: "also for the 1/33 in
    # the country flag". Era el unico casillero que ponia su numero ABAJO, en
    # la etiqueta, mientras los otros tres lo ponen al lado del icono: dos
    # gramaticas en la misma columna.
    #
    # ⚠️ Y AL MUDARSE PIERDE EL TOTAL: pasa de "1/33" a "#1". No es un recorte
    # por espacio — es que los otros tres ya lo hacen asi: el #1 del rango no
    # dice de cuantos, ni el del servidor. Mostrar el total en uno solo lo
    # haria parecer otra cosa.
    # ⚠️ LOS TRES PUESTOS SE PARTEN IGUAL, Y ESTO LO DESTAPARON LOS DATOS
    # REALES. El pool guarda pos_pais y pos_sv como "1/18" —puesto sobre
    # total— y esta funcion solo partia el del pais: el casillero del servidor
    # imprimia "#1/18" al lado de un "#1" del de al lado. Con la maqueta no se
    # veia porque ahi pos_sv estaba escrito a mano como el entero 1.
    # El total no va en el casillero a proposito: vive en el TAG, que dice
    # "EL MEJOR DE 33". Repetirlo en un chip de 22 px lo unico que hace es
    # alargarlo hasta que no entra.
    def _puesto(v):
        return str(v).split('/')[0] if v not in (None, '') else ''
    _pn = _puesto(pos)
    pos_rg, pos_sv = _puesto(pos_rg), _puesto(pos_sv)
    # ⚠️ LA ALMOHADILLA VA EN SU PROPIO <span> PARA PODER MEDIRLA APARTE. El
    # # y la x son los dos un prefijo del mismo numero, pero no son el mismo
    # dibujo: a igual font-size el # ocupa mas y pesa mas, asi que "#1" y
    # "x1" no se leen del mismo tamaño aunque el CSS diga que lo son. Dlx:
    # "pon el # del mismo tamaño del x de los trofeos". Sin el span no hay
    # donde escribir esa diferencia.
    alm = '' if num in SIN_ALM else '<span class="alm">#</span>'
    # ⚠️ LAS ETIQUETAS DICEN QUE ES EL CASILLERO, NO CUANTO VALE. Decian 'A' y
    # 'SR', o sea repetian en texto lo que la figura y el escudo ya dibujan, y
    # encima cambiaban de persona a persona: la misma fila decia una cosa
    # distinta en cada carta y no habia forma de aprenderse la columna. Dlx:
    # "en colombia pon Pais, en rango pon rango no A, asi asi y asi".
    # Genericas, la columna se lee una vez y sirve para las 138. Y de paso la
    # bandera deja de ser la unica sin etiqueta, que era lo que hacia que el
    # primer hueco se viera mas grande que los otros.
    _em = (f'<em class="img" style="background-image:url({_bimg})"></em>'
           if _bimg else f'<em style="background:{_b}"></em>')
    cas = [(f'<div class="ic ban xn">{_em}</div>'
            + (f'<b class="x ban">{alm}{_pn}</b>' if _pn else ''), 'PAÍS')]
    # ⚠️ EL CASILLERO DEL RANGO SOLO SI HAY RANGO. Ver el comentario de `acc`:
    # sin Score no hay rango, y dibujar la figura de E diría que es el peor.
    # «Sin dato no hay pieza» — la misma regla que la crew y que la bandera de
    # quien no tiene país.
    if rg:
        cas.append(
            (f'<div class="ic rk xn">{RG.icono(rg, 23, "g%d" % i, r_max=14)}</div>'
             + (f'<b class="x rg">{alm}{pos_rg}</b>' if pos_rg else ''), 'RANGO'))
    # 🔴 SIN SERVIDOR NO VA EL CASILLERO, y antes reventaba. Con `sv` vacío
    # el escudo se resolvía a `comun/escudos_cuad/sv_.png`, que no existe:
    # `FileNotFoundError` y la carta entera no sale.
    #
    # ⚠️ ES LA MISMA REGLA QUE YA TIENE LA BANDERA veinte líneas más arriba
    # —«sin dato no hay pieza»—: con `cc` vacío el círculo no se dibuja,
    # porque un ícono de imagen rota es peor que no mostrar nada. Acá era
    # peor todavía: no salía una pieza rota, no salía la carta.
    #
    # ⚠️ Y NO ES UN CASO RARO. `sv` sale del argmax de las **7** columnas
    # por servidor del Sheet, y ni `FFA` ni `EFA` tienen columna: medido el
    # 22/09/2026, las 6 primeras personas de la T1 compitieron en FFA y
    # las 6 salieron con `sv=''`. Ver `sheet/construir_pool_temporada.py`.
    if esc:
        cas.append(
            (f'<div class="ic sv xn"><img class="esc" src="{b64(esc)}"></div>'
             + (f'<b class="x sv">{alm}{pos_sv}</b>' if pos_sv else ''),
             'SERVIDOR'))
    # ⚠️ LA CREW ES EL UNICO CASILLERO QUE NO HABLA DEL PAIS. La bandera es de
    # donde sos, el rango es tu nivel, el servidor es donde jugas y los dos
    # trofeos son nacional y mundial; la crew es ortogonal a todo eso y ya
    # tiene su lugar en las otras cartas. Sacarla no es solo ganar espacio.
    if crew and crew_on:
        cas.append((f'<div class="ic cw">{crew_img(crew)}</div>', 'CREW'))
    # ⚠️ CUATRO FORMAS DE PONER EL CONTEO, y lo que las separa es UNA SOLA
    # COSA: que el icono quede centrado como los otros cinco. Dlx: "el icono
    # tiene que estar centrado como los demas... si quieres poner el # lo
    # puedes poner abajo, o da diferentes ideas".
    #
    #   A  el numero entra en la etiqueta      NACIONAL 1
    #   B  el numero ES la etiqueta            solo el icono dice cual es
    #   C  pastilla en la esquina del icono    como el puesto en la Servidor
    #   D  el icono repetido, sin numero       se cuenta mirando
    #
    # ⚠️ LA D TIENE UN TECHO DURO: a partir de tres copias no entran en 64 px
    # de panel util, y ahi el casillero deja de servir justo para quien MAS
    # trofeos tiene, que es el caso que la carta mas querria mostrar.
    for k, nom_t, v in _tro:
        # ⚠️ EL NUMERO VA COMO PASTILLA EN LA ESQUINA, no al lado del icono.
        # Puesto al lado, el icono tenia que achicarse a 26 para que los dos
        # entraran en el ancho del panel, y entonces el trofeo se veia MAS
        # CHICO que el escudo de TWR, que llena sus 34. Dlx: "que el icono sea
        # el mismo tamaño de los iconos de TWR".
        # En la esquina, el icono llena la caja igual que los demas y el conteo
        # se apoya encima, que es lo mismo que ya hace la piedra del rango
        # sobre la bandera y la pastilla del puesto en el pie de la Servidor.
        ico = ICONO_TROFEO[k](i)
        if trofeo == 'A':
            cas.append((f'<div class="ic">{ico}</div>', f'{nom_t} {v}'))
        elif trofeo == 'B':
            cas.append((f'<div class="ic">{ico}</div>', str(v)))
        elif trofeo == 'C':
            cas.append((f'<div class="ic pas">{ico}<b>{v}</b></div>', nom_t))
        elif trofeo == 'D':
            cas.append(('<div class="ic rep">' + (ico * max(1, v) if v else
                        f'<u class="cero">{ico}</u>') + '</div>', nom_t))
        else:
            # E — EL ICONO NO SE MUEVE NUNCA. Dlx: "me gusta la ultima pero si
            # hay forma de que no movamos el icono y pongamos el x# cerca del
            # icono, seria genial".
            #
            # ⚠️ Y ESO PIDE QUE EL ×N NO OCUPE LUGAR EN LA FILA. Mientras el
            # numero sea un hermano del icono, el navegador centra LOS DOS y
            # el icono se corre — es lo mismo que ya pasaba con el conteo al
            # lado, y lo mismo que pasa al repetir el icono dos o tres veces.
            # Sacandolo del flujo con position:absolute, el icono queda
            # centrado como los otros cinco y el numero se apoya al lado.
            #
            # ⚠️ EL ×N SE ESCRIBE DESDE 1, y esto corrige lo que yo habia
            # decidido. Lo tenia desde 2 razonando que "un ×1 es ruido, el
            # icono solo ya dice que hay uno". Dlx: "me referia al x por los
            # titulos que tiene". O sea que el × NO es un desempate para
            # cuando hay varios: es COMO SE DICE CUANTOS TITULOS TIENE, y
            # tener uno es un dato tan bueno como tener cuatro.
            #
            # Y ademas al esconderlo en 1, el unico caso que hoy existe de
            # verdad —Konan con un nacional— era justo el que no mostraba el
            # numero: la pieza se veia siempre sin el, o sea que parecia que
            # no existia.
            #
            # ⚠️ CON 0 EL CASILLERO NO SE DIBUJA. Lo tenia apagado —el icono
            # en gris al 32%— razonando que un hueco vacio se lee como error
            # de dibujo. Dlx: "why mundial is black? if theres 0, then it
            # shouldnt pop up". Tiene razon y ademas es LA REGLA QUE EL
            # PROYECTO YA TIENE ESCRITA: "sin dato no hay pieza", la misma por
            # la que el circulo de la bandera no se dibuja cuando la persona
            # no tiene pais.
            #
            # ⚠️ Y LA CONSECUENCIA HAY QUE TENERLA A LA VISTA: hoy NADIE tiene
            # trofeos —no existe la competencia que los da hasta la T2— asi
            # que con datos reales la columna va a mostrar TRES casilleros,
            # no cinco. Los dos de trofeos aparecen recien cuando alguien gane
            # algo, y eso es correcto: la carta no promete lugares vacios.
            if not v:
                continue
            cas.append((f'<div class="ic tro-{k} xn">{ico}</div>'
                        f'<b class="x tro">×{v}</b>', nom_t))
    col = ''.join(f'<div class="cas">{c}<i>{e}</i></div>' for c, e in cas)

    # ⚠️ CON UNA SOLA MUESTRA, LA FOTO. El reparto anterior mandaba el ULTIMO
    # de la lista al caso SIN FOTO, y con la lista de uno ese ultimo era el
    # unico: Konan salia sin cara. El caso sin foto sigue importando —118 de
    # 138— pero se mira cuando la hoja vuelve a tener varias, no aca.
    # ⚠️ EL CASO SIN FOTO ENTRA RECIEN CON TRES. Con una sola muestra mandaba
    # al unico a quedarse sin cara; con dos, dejaba a la mitad de la hoja sin
    # foto justo cuando lo que se quiere comparar es otra cosa. Sigue siendo el
    # caso de 118 de 138 y sigue apareciendo solo — pero cuando hay lugar.
    # ⚠️ FOTOS GANA SI ESTA PUESTA. La rotacion de avatares.para() es de las
    # HOJAS: reparte fotos de prueba para juzgar el diseño y no a la persona.
    # generar.py, que dibuja gente de verdad, pone aca la foto de cada uno —o
    # None, que es el caso de 118 de 138— y esa tiene que ganar.
    if FOTOS is not None:
        av = FOTOS[i]
    else:
        _et, av = avatares.para(avatares.cuantas() - 1
                                if len(GENTE) > 2 and i == len(GENTE) - 1 else i)
    foto = (f'<div class="foto"><img src="{av}"></div>' if av else
            f'<div class="foto vacia"><b>{nom[0]}</b></div>')

    # ⚠️ FUERA LOS PUNTOS. Dlx: "eso de los pts que no este puntos". Y hay
    # un motivo ademas del gusto: los puntos de temporada son EXACTAMENTE de
    # lo que sale el OVR de la carta Temporada, asi que mostrarlos aca era
    # repetir el numero de otra carta. Ademas "224K" no dice nada solo: es
    # grande, y no se sabe grande respecto de que.
    #
    # Entra SEM, semifinales: es un RESULTADO como los otros cinco, y lo
    # tienen 112 de 138. Se probaron los otros tres candidatos del pool y no
    # sirven — caz 28 de 138, czd 26, sob 5: la mayoria veria un cero.
    # ⚠️ CUATRO STATS, NO SEIS. Dlx: "23 cam would dissapear from there, RCH as
    # well I think, win rate would be counting only within these events".
    #
    # Y las tres bajas tienen motivo propio, no es solo recorte:
    #
    #   CAM  se va porque YA ESTA EN LA COLUMNA. El trofeo nacional con su ×N
    #        cuenta exactamente eso; tenerlo en los dos lados es decir el mismo
    #        numero dos veces, que es lo que esta carta viene evitando desde el
    #        OVR —por eso tampoco muestra los puntos de temporada—.
    #   RCH  se va porque una racha NACIONAL no significa nada todavia: con una
    #        Fecha FIFA por mes, una racha de 3 son tres meses. Volvera cuando
    #        haya volumen suficiente para que el numero diga algo.
    #   WIN  se queda pero CAMBIA DE SIGNIFICADO: pasa a contar solo dentro de
    #        estos eventos.
    #
    # ⚠️ Y ESO ULTIMO VALE PARA LAS CUATRO: SEM, EVT, POD y WIN pasan a ser
    # NACIONALES. Hoy no existe ninguna competencia de pais —la Fecha FIFA y la
    # Copa de Naciones arrancan en T2— asi que los numeros que se ven son los
    # de TODA LA LIGA y no los de la carta. Es el mismo agujero que los
    # trofeos: el lugar esta, el dato no.
    # ⚠️ VUELVEN A SER SEIS, y las dos que entran salen de como funciona el
    # Mundial, no de rellenar: la Fecha FIFA es MENSUAL y se juega BEST OF 3,
    # asi que las dos unidades que ese formato genera son las fechas jugadas y
    # los duelos. Son las unicas dos stats nuevas que la competencia va a
    # producir sola.
    #
    #     FCH   fechas FIFA jugadas
    #     DUE   duelos ganados sobre jugados
    #
    # ⚠️ "FCH" y no "FFA": FFA ya es un servidor de la Liga y aparece en la
    # columna de otras cartas. Dos siglas iguales para dos cosas distintas en
    # el mismo sistema se confunden solas.
    # ⚠️ DOS JUEGOS DE STATS, Y EL SEGUNDO ES UNA PROPUESTA SIN DATO. 'pre' es
    # el que salio de lo que Dlx pidio en su momento —fuera CAM porque ya esta
    # en los trofeos, fuera RCH, y SEM/EVT/POD/WIN pasando a contar solo
    # eventos nacionales—. 'nac' es el que se propuso despues, cuando dos de
    # esas cuatro se cayeron solas:
    #
    #   WIN  si el win rate termina siendo el original, repite el numero de
    #        otra carta, que es lo que esta carta viene evitando desde el OVR.
    #   POD  depende de que los eventos tengan bracket nacional, o sea de que
    #        lo organice alguien mas. Con 9 paises con 3 o mas personas, eso
    #        son 9 brackets que hoy no existen.
    #   EVT  ademas se pisa con FCH: si los eventos nacionales SON las fechas,
    #        los dos casilleros dicen casi el mismo numero.
    #
    # ⚠️ LOS VALORES DE 'nac' SON DE MUESTRA. DE y DIF salen del pool de
    # verdad; MEJ, SUB y SEL necesitan historial y selecciones armadas, que
    # llegan con la T1. Estan aca para poder MIRAR el bloque, no para
    # publicarlo.
    # ⚠️ NAC GANA SI ESTA PUESTA, y el default es DEMO_NAC a proposito: las
    # hojas comparativas necesitan numeros para poder MIRAR el bloque, y
    # generar.py necesita que no haya ninguno inventado. Un solo dict no puede
    # ser las dos cosas.
    d = (NAC if NAC is not None else DEMO_NAC).get(nom, ('—',) * 16)
    VAL = {'SEM': sem, 'EVT': evt, 'POD': pod, 'WIN': win, 'DUE': due,
           'FCH': fch, 'DE': d[0], 'DIF': d[1], 'MEJ': d[2], 'SUB': d[3],
           'SEL': d[4], 'PICO': d[5], 'TMP': d[6], 'NAC': d[7],
           'PODN': d[8], 'SEG': d[9], 'TER': d[10], 'DNI': d[11],
           'DNA': d[12], 'DIN': d[13], 'EVN': d[14], 'EVI': d[15],
           'PAIS': pais.upper()}
    st = [(SIGLA.get(k, k), VAL[k]) for k in JUEGOS[stats]]
    m = len(st) // 2
    # ⚠️ LA TEXTURA VA ANTES DEL COLOR EN LA MISMA background, no en otra capa:
    # el panel es .90 opaco y si la textura fuera un fondo aparte quedaria
    # DEBAJO de ese velo, o sea al 10% de lo que se ve. Apilada arriba del
    # color, se ve entera.
    _t = css_panel(panel, rg)
    _bg_panel = ('background:%s,rgba(6,8,16,.90)' % _t if _t
                 else 'background:rgba(6,8,16,.90)')
    if panel in PANEL_TAM:
        _bg_panel += ';' + PANEL_TAM[panel]

    # ⚠️ LOS DUELOS SE DIBUJAN UNA SOLA VEZ. Cuando el juego los saca del
    # bloque de stats, entran como chips; si estuvieran en los dos lados, la
    # carta diria el mismo dato dos veces, que es lo que viene evitando desde
    # que se le sacaron los puntos de temporada.
    _chips = ''
    if stats.startswith('chips'):
        if chip == 'unido':
            _chips = (f'<div class="chips {chip}"><div class="chip">'
                      f'<span class="ac" style="font-size:{_rem_chip(VAL["DNA"])}rem">'
                      f'{VAL["DNA"]}<u>CASA</u></span>'
                      f'<span style="font-size:{_rem_chip(VAL["DIN"])}rem">'
                      f'{VAL["DIN"]}<u>FUERA</u></span></div></div>')
        else:
            _chips = (f'<div class="chips {chip}">'
                      f'<div class="chip casa" '
                      f'style="font-size:{_rem_chip(VAL["DNA"])}rem">'
                      f'{VAL["DNA"]}<u>CASA</u></div>'
                      f'<div class="chip" '
                      f'style="font-size:{_rem_chip(VAL["DIN"])}rem">'
                      f'{VAL["DIN"]}<u>FUERA</u></div></div>')

    fila = (lambda k, v, col=COL_NUM: f'<div class="st">'
            f'<b style="font-size:{_rem_st(v, col)}rem">{v}</b>'
            f'<i>{k}</i></div>')
    if stats in PIE_2:
        # los cuatro de arriba en 2x2, y lo que sobre —uno o dos— abajo
        izq = ''.join(fila(k, v) for k, v in st[:2])
        der = ''.join(fila(k, v) for k, v in st[2:4])
        if stats in PIE_PAIS:
            pie2 = ('<div class="pie2 pais">%s</div>' % st[4][1])
        else:
            pie2 = ('<div class="pie2">'
                    + ''.join(f'<div class="st">'
                              f'<b style="font-size:{_rem_pie(v)}rem">{v}</b>'
                              f'<i>{k}</i></div>' for k, v in st[4:])
                    + '</div>')
    elif stats == 'chips-nada':
        izq = ''.join(fila(k, v) for k, v in st[:2])
        der = ''.join(fila(k, v) for k, v in st[2:])
        pie2 = ''
    else:
        izq = ''.join(fila(k, v) for k, v in st[:m])
        der = ''.join(fila(k, v) for k, v in st[m:])
        pie2 = ''

    # ⚠️ SIN PUESTO NO SE DIBUJA LA PASTILLA. Meteoro es 1 de 2 bolivianos con
    # carta y el umbral de 3 le deja pos_pais vacio.
    # ⚠️ EL PUESTO SE MUDO AL CHIP DE LA BANDERA. Dlx: "en vez de que el numero
    # de arriba tenga un #/#, pon la bandera del pais al lado izquierdo y ahi
    # pon el # como los demas tienen".
    #
    # Y ademas de lo que pidio, ordena una cosa: en la columna TODOS los
    # casilleros son "un icono y abajo que es" —la piedra dice el rango, el
    # escudo dice el servidor—, mientras el puesto colgaba del numero grande
    # sin icono que lo explicara. Ahora la bandera dice el pais y el numero
    # abajo dice tu puesto en el, con la misma gramatica que los otros dos.
    pst = ''

    mk = marco_svg(marco, i, acc, acento_pais, acorta, remate)
    # ⚠️ EL TAG SE CENTRA EN LA CARTA Y NO EN EL CONTENIDO, Y ESO ES LO QUE
    # DLX SINTIO DESBALANCEADO. Estaba centrado entre el panel y el borde
    # derecho —o sea en x=186— mientras el UL, tres centimetros mas abajo, va
    # en la punta del escudo, que esta en x=150. Dos piezas apiladas sobre EJES
    # DISTINTOS se leen torcidas aunque cada una este bien centrada en su caja.
    #
    # Centrado en la carta no pisa el panel: el TAG mas largo mide ~95 px, o
    # sea que va de 102 a 198, y el panel termina en 68.
    TAGCLS = '' if tag_centro else ' der'
    TAGTXT, TAGN = tag(pos, _tro[0][2], _tro[1][2], evt, pod, win, rch,
                       VAL.get('DNA', ''), VAL.get('DIN', ''))
    TAGN = TAGN[1]

    # ⚠️ LOS CHIPS VAN AFUERA DEL RECORTE, en un envoltorio. .card tiene
    # clip-path y overflow:hidden —la silueta— asi que cualquier cosa en
    # right:-11px se corta contra el borde: se probo adentro y los dos chips
    # salian partidos por la mitad. Es la misma estructura que la Competitiva,
    # donde los chips son hermanos de .clip y no hijos.
    #
    # ⚠️ Y EL ENVOLTORIO NO TIENE ANCHO PROPIO: mide lo que la carta, asi que
    # los chips sobresalen de el tambien. Al exportar hay que medir la UNION,
    # que es lo que CLAUDE.md ya obliga en las otras dos cartas.
    # ⚠️ --acc SE DECLARA EN EL ENVOLTORIO Y NO EN .lane. Estaba en la columna
    # porque hasta ahora el acento solo se usaba ahi; los chips viven afuera de
    # la carta y no lo heredaban, asi que el de casa salia blanco en vez de con
    # el color del rango. Una variable declarada en un hijo no llega a sus tios.
    return f'''<div class="fuera" style="--acc:{acc}">
<div class="card{' ovrder' if ovr_der else ''}" style="{_fcss}">
  <div class="panel" style="width:{LW}px;{_bg_panel}"></div>

  <div class="foto{"" if av else " vacia"}" style="left:{LW}px">{
      f'<img src="{av}">' if av else f'<b>{nom[0]}</b>'}</div>
  <div class="ovr" style="width:{LW - 5}px;font-size:{2.45 * LW / 78:.2f}rem">{ovr}{pst}</div>
  <div class="lane {iconos} {num}{' etiq' if etiq else ''} n{len(cas)}"
       style="width:{LW - 5}px;--acc:{acc}">{col}</div>
  {estrellas(_tro[1][2], i, LW, W - LW, _YN - EST_LADO - 7)}
  <div class="nom" style="left:{LW}px;border-color:{acc};
       font-size:{NOM.rem(nom, 1.42):.2f}rem;
       background:{TEXTURA[rg]},{tono(acc, -.72)}">{nom}</div>
  <div class="stats {caja}{' arriba' if ul == 'tag' else ''}"
       style="left:{LW}px">
    <div class="par"><div class="cl">{izq}</div>
      <div class="cl">{der}</div></div>{pie2}</div>
  <div class="tag t{TAGN}{TAGCLS}{' sube' if ul == 'tag' else ''}"
       style="left:{LW}px;border-color:{acc}">{TAGTXT}</div>
  <img class="ul{' baja' if ul == 'tag' else ''}" src="{UL}"
       style="left:{LW / 2 + 2.5 if ul == 'panel' else (LW + W) / 2:.1f}px">
  {panel_svg(i, LW, acc, remate, acorta)}
  {mk}
</div>{_chips}</div>'''


def CSSF(H, SIL, num='tinta'):
    YN, YS = secciones(H)
    return css_base(H, SIL) + css_num(num)


def css_base(H, SIL):
    YN, YS = secciones(H)
    return f'''
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@600;800;900&display=swap');
body{{margin:0;background:#0B0B12;padding:26px;font-family:Archivo,'LigaEmoji',system-ui}}
.rack{{display:flex;gap:26px}}
.tit{{color:#EDEDF5;font-size:14px;font-weight:800;letter-spacing:1.4px;
  margin:26px 0 12px}}
.tit span{{opacity:.5;font-weight:600;letter-spacing:.3px}}
.card{{position:relative;width:{W}px;height:{H}px;
  clip-path:{SIL};-webkit-clip-path:{SIL};overflow:hidden}}

/* ── 4 · el panel, de arriba abajo ── */
/* ⚠️ EL PANEL VA PAREJO Y NO EN DEGRADE. Lo tenia de .90 a .66 de izquierda a
   derecha, y ese aclarado hacia que el borde derecho —justo donde vive la
   linea— fuera la parte MAS CLARA del panel: la bandera se colaba ahi y el
   panel dejaba de leerse como una superficie aparte. Dlx: "asegurate de que el
   panel del lado izquierdo este completo de oscuro tambien". Va plano. */
.panel{{position:absolute;left:0;top:0;bottom:0;
  background:rgba(6,8,16,.90)}}
/* la linea lleva filo oscuro a los dos lados: contra la bandera el acento
   solo daba 1.13 de contraste y se perdia */
/* ⚠️ LA LINEA VA CERRADA, de punta a punta. Dlx: "en el lado izquierdo tiene
   que estar cerrado la linea de la izquierda". Se desvanecia arriba y abajo, y
   una linea que se desvanece no cierra nada: el panel quedaba abierto por los
   dos extremos. Ahora es solida y la recorta la silueta, que es la que le da
   los dos finales. */
/* el contorno del panel: va ENCIMA de la banda del nombre, que es lo que
   impide que las dos superficies se fundan */
.panelb{{position:absolute;left:0;top:0;width:{W}px;pointer-events:none;
  filter:drop-shadow(0 0 5px rgba(0,0,0,.45))}}

/* ⚠️ EL NUMERO ARRANCA EN y=44. A 30 no se cortaba —el escudo es de ancho
   completo desde y=26— pero quedaba PEGADO AL TECHO: entre el borde de la
   carta y la cifra habia 4 px, y encima el contorno del panel pasa justo por
   ahi. Son dos lineas y un numero en 34 px de alto.
   A 44 quedan 18 px de aire, que es lo mismo que respira el nombre contra su
   banda. */
/* ⚠️ TODO LO DEL PANEL SE CORRE 5 px A LA DERECHA, y esto explica lo que Dlx
   venia viendo. El panel va de x=0 a 69, pero EL MARCO SE DIBUJA POR DENTRO y
   mide 3 px de carta, mientras que a la derecha lo que cierra es una linea de
   1.8. O sea que el hueco VISIBLE no va de 0 a 69 sino de 3 a 69, y su centro
   esta en 36, no en 34.5.
   Medido sobre el render a la altura del UL: el marco ocupa de x=7 a x=15 en
   pixeles de imagen, y el centro visible cae 2.7 px de carta a la derecha del
   geometrico. Por eso todo lo centrado en el panel se veia pegado a la
   izquierda: estaba centrado en la caja, no en lo que se ve. */
.ovr{{position:absolute;left:5px;top:44px;text-align:center;
  color:#fff;font-size:2.45rem;font-weight:900;line-height:.9;
  text-shadow:0 2px 7px rgba(0,0,0,.8)}}
/* ⚠️ EL NUMERO A LA DERECHA CAMBIA DOS COSAS, NO UNA. Dlx: "siento que el
   numero grande de la izquierda arriba queda algo raro". Mudarlo sobre la
   foto lo saca del panel, y entonces la columna de casilleros deja de colgar
   de el y puede arrancar arriba de todo: son 45 px que el panel no tenia.
   Va con sombra mas dura porque ahi no cae sobre el panel oscuro sino sobre
   una foto que puede ser de cualquier color — es el mismo problema que las
   estrellas de la Servidor sobre fondo que no controlamos. */
.card.ovrder .ovr{{left:auto;right:14px;top:12px;width:auto;
  text-shadow:0 2px 6px rgba(0,0,0,.95),0 0 16px rgba(0,0,0,.7)}}
.card.ovrder .lane{{top:26px}}
.ovr u{{display:block;font-size:.62rem;font-weight:800;letter-spacing:1.5px;
  text-decoration:none;opacity:.88;margin-top:3px}}
/* ⚠️ LOS ICONOS VUELVEN A COLGAR DEL NUMERO, y esta vez con el motivo medido.
   Los probe centrados en el hueco y se ve por que no va: el bloque CAMBIA DE
   ALTURA segun cuantos haya, asi que el primer icono caia en y=155 con dos y
   en y=125 con tres. O sea que la misma pieza —el rango, que la tienen las
   138— aparecia a distinta altura segun si la persona tiene crew o no. Son 31
   de 138 con crew: 107 cartas en un lado y 31 en el otro.
   Colgados del numero con hueco fijo, el rango siempre esta en el mismo lugar
   y lo que sobra queda abajo, que es lo que hace la carta de FIFA. */
/* ⚠️ EL HUECO ENTRE EL NUMERO Y EL PRIMER CASILLERO ERA DE 29 px MIENTRAS
   ENTRE CASILLEROS HAY 12. Dlx lo vio y no era un margen elegido: es lo que
   quedo cuando el puesto —el "1/33" que colgaba del numero— se mudo al chip
   de la bandera. El top de la columna se habia calculado con esa linea
   puesta y nadie lo bajo despues.
   A 89 el hueco queda en 14, apenas mas que los 12 de adentro: el numero
   sigue leyendose como una pieza aparte sin abrir un agujero. */
/* ⚠️ LA COLUMNA OCUPA EL HUECO ENTERO Y SE CENTRA EN EL. Dlx: "haz que los
   circulos, si estan llenos, esten entre el numero y UL exactamente".
   Estaba anclada arriba —top:89, flex-start— y el sobrante caia todo abajo:
   con cuatro casilleros quedaban 11 px arriba y 70.8 abajo. Ahora la caja va
   de donde acaba el 92 (78) a donde arranca el sello (363), o sea 285 px, y
   el contenido cuelga de arriba.
   ⚠️ EL top VOLVIO A 89 Y NO A 78. Con 78 —que es exactamente donde acaba el
   92— el primer circulo lo TOCA: medido, 0.0 px de aire. Los 11 de diferencia
   son lo que separa al numero de la columna, y ya estaban elegidos: a 89 el
   hueco queda apenas mas grande que los 9 de adentro, asi que el numero se
   lee como pieza aparte sin abrir un agujero.
   El bottom es 39 porque el sello vive en bottom:20 y mide 19. */
.lane{{position:absolute;left:5px;top:89px;bottom:39px;
  display:flex;flex-direction:column;align-items:center;gap:12px}}
/* ⚠️ EL HUECO ES 18 Y NO 22 POR EL CUARTO CASILLERO. Con la bandera adentro,
   quien tiene crew lleva CUATRO iconos y a hueco 22 el ultimo terminaba a 10
   px del sello. A 18 quedan 25. Son 31 de 138 los que llegan a cuatro, o sea
   que el caso apretado es el minoritario y facil de no ver. */
/* ⚠️ TRES FORMAS DE REPARTIRLOS Y NINGUNA ES OBVIA, asi que se comparan.
   Lo que las separa no es el gusto sino DONDE QUEDA EL RANGO, que lo tienen
   las 138, cuando la persona tiene crew y cuando no —31 contra 107—:

     colgado   el rango siempre en el mismo y; el hueco queda abajo
     centrado  el bloque flota; el rango baja 30 px si no hay crew
     repartido el rango siempre arriba y el ultimo icono pegado al sello */
.lane.colgado{{justify-content:flex-start}}
.lane.centrado{{justify-content:center}}
.lane.repartido{{justify-content:space-between}}
.cas{{text-align:center;color:#fff;line-height:1}}
/* ⚠️ .44, DESPUES DE UNA VUELTA A .41 Y DE VUELTA. Dlx pidio achicarlas y
   despues agrandarlas, y en el medio cambio algo que hace que ahora entren:
   se fue la crew, asi que el peor caso paso de seis casilleros a cinco. Con
   seis, .44 dejaba el ultimo a 4.8 px del sello; con cinco sobra. */
.cas i{{display:block;font-size:.44rem;font-weight:800;letter-spacing:.7px;
  font-style:normal;opacity:.72;margin-top:3px;
  text-shadow:0 1px 3px rgba(0,0,0,.85)}}
/* ⚠️ EL margin:0 auto NO ES COSMETICO: SIN EL, EL ICONO SE VA A LA IZQUIERDA
   CUANDO SU ETIQUETA ES MAS ANCHA. .cas tiene text-align:center, que centra
   contenido EN LINEA pero no hijos de bloque, y .ic es un flex —o sea bloque—.
   Asi que el icono se apoyaba en el borde izquierdo de su casillero, y el
   casillero es tan ancho como su texto.
   Con etiquetas cortas —1/33, SSS, TWR— no se notaba porque miden lo mismo que
   el icono. Con NACIONAL (44.6 px) y MUNDIAL (37.9) si: medido, esos dos
   iconos caian en x=27.7 y 31.0 mientras los otros tres en 37.0.
   Era el mismo sintoma que Dlx venia marcando —"el icono tiene que estar
   centrado como los demas"— pero por una causa distinta a la del conteo. */
.ic{{width:26px;height:26px;object-fit:contain;display:flex;
  margin:0 auto;
  align-items:center;justify-content:center;
  filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))}}
.ic.cw img{{width:100%;height:100%;object-fit:contain}}
.ic .esc{{width:100%;height:100%;object-fit:contain}}
/* el chip de la bandera: mas angosto que los otros porque conserva la
   proporcion de la carta, y con filo oscuro porque hay banderas blancas y el
   panel es oscuro pero no negro */
/* ⚠️ LA BANDERA VA APAISADA, NO CON LA FORMA DE LA CARTA. Dlx: "el problema
   de la bandera de la izquierda es que esta muy alta, no ancha". Tenia razon:
   una bandera es 3:2 acostada y la estabamos mostrando 2:3 parada, porque la
   heredaba del fondo, que tiene la proporcion del escudo.
   Se resuelve escalando un div de 300x200 en vez de 300x463. Las bandas de
   las banderas estan escritas en PORCENTAJES, asi que salen bien en cualquier
   caja; lo unico que cambia de peso relativo son los detalles en px —el sol,
   las estrellas— y a este tamaño eso no se nota. */
.ic.ban{{position:relative;overflow:visible}}
/* ⚠️ CON IMAGEN NO HAY NADA QUE ESCALAR, y por eso pisa las reglas de escala.
   Las banderas CSS estan escritas para 300x463 con medidas absolutas adentro
   —el sol de Argentina es un circulo de radio 20— asi que css_num genera un
   transform:scale por modo y por cantidad de casilleros para que el chip no
   las deforme. Un PNG 3:2 en un chip 3:2 no necesita ninguna de esas reglas,
   pero las hereda igual porque el selector apunta al mismo <em>.
   El !important es el precio de que la escala se genere por modo: una regla
   normal tendria que repetirse en los siete modos por las cuatro cantidades.
   Es la misma excepcion que ya se acepta en .tag.t3. */
.ic.ban > em.img{{position:absolute;left:0;top:0;width:100%;height:100%;
  transform:none !important;border-radius:0;
  background-size:cover !important;background-position:center !important}}

/* ⚠️ ES <em> Y NO <i> A PROPOSITO: las etiquetas de los casilleros tambien
   son <i>, asi que el chip tenia un <i> adentro de un .cas que ya tiene otro.
   No rompia el dibujo pero si cualquier medicion que busque "el <i> de este
   casillero" — me paso midiendo si las etiquetas se salian del panel. */
.ic.ban > em{{position:absolute;left:50%;top:50%;width:{W}px;height:200px;
  transform:translate(-50%,-50%) scale({32 / W:.5f});
  border-radius:{W * 3 / 32:.0f}px;
  box-shadow:0 0 0 {W * 1.2 / 32:.0f}px rgba(4,6,12,.9),
             0 {W * 2 / 32:.0f}px {W * 5 / 32:.0f}px rgba(0,0,0,.6)}}
.ini{{font-size:.66rem;font-weight:900;color:#fff}}
/* los tres trofeos, en fila dentro de un solo casillero */
/* los dos trofeos, en fila dentro de un solo casillero: icono y su numero */
/* cada trofeo llena su caja como los demas, con el conteo apoyado encima */
/* C — el conteo como pastilla en la esquina, igual que el puesto en el pie
   de la Servidor. El icono queda centrado. */
.ic.pas{{position:relative}}
.ic.pas b{{position:absolute;right:-6px;bottom:-3px;z-index:2;
  min-width:13px;padding:1px 3px;border-radius:7px;
  background:rgba(8,10,18,.92);
  font-size:.5rem;font-weight:900;color:#fff;text-align:center;
  box-shadow:0 1px 4px rgba(0,0,0,.7)}}
/* D — el icono repetido. El cero va apagado, no ausente: un casillero vacio
   se lee como un error de dibujo. */
.ic.rep{{gap:1px;width:auto !important}}
.ic.rep .cero{{opacity:.28;filter:grayscale(1)}}
/* E — el icono centrado y el ×N FUERA DEL FLUJO, para que no lo empuje */

/* ⚠️ EL ×N SE PEGA AL TROFEO, Y EL OFFSET NO ES A OJO. Con left:100% quedaba
   a 8.7 px de la copa, y ese hueco no venia del margen: la CAJA del icono mide
   26 px pero el dibujo de la copa ocupa de x=4 a x=20 de un viewBox de 24, o
   sea que entre el borde de la caja y donde termina el trofeo ya hay 6 px que
   no se ven. Medir cajas habria dicho "estan pegados".
   Se compensa ese aire con margen negativo. Barrido y medido, tinta a tinta:

       margen -4   2.7 px de hueco
       margen -5   1.7
       margen -6   0.7   <- este
       margen -7   0.0, se tocan

   Queda -6: pegado pero sin empastarse. */
/* ⚠️ EL NUMERO NO PUEDE VIVIR ADENTRO DE .ic. Se probo dejarlo ahi y
   anclarlo al casillero poniendo .ic en position:static, y no se movio ni un
   pixel: .ic tiene un `filter` de drop-shadow, y **un filter distinto de none
   crea bloque contenedor para los hijos absolutos**, tenga o no position. El
   right:1px se seguia midiendo contra la caja del icono. Sacarlo del .ic es
   la unica forma, y de paso el numero deja de recibir esa sombra. */
.cas{{width:100%;position:relative}}
/* ⚠️ SE ANCLA ARRIBA Y NO ABAJO. Con bottom, el numero de la bandera quedaba
   7 px mas alto que los otros tres, y no por el icono: ese casillero es el
   unico SIN ETIQUETA, asi que su <i> vacio no genera linea y su .cas mide 29
   en vez de 36. Medido desde abajo, esos 7 px de menos se le pasan enteros al
   numero. El .ic siempre arranca en top:0 y siempre mide 26, asi que anclarlo
   arriba lo deja a la misma altura del icono en los cuatro. */
/* ⚠️ EL NUMERO SE PEGA A LA TINTA DEL ICONO, NO A SU CAJA — y por eso los
   cuatro left son distintos. No es descuido: es la unica forma de que se vean
   igual de pegados.

   Se probo lo contrario, una columna unica en el mismo x para los cuatro.
   Medida de caja daba perfecta; medida de TINTA daba -0.2, 1.0, 4.2 y 7.5,
   porque cada dibujo deja distinto aire adentro de su .ic de 26: el trofeo
   ocupa x=4..20 de un viewBox de 24 y la bandera lo llena entero. El x1 —el
   que Dlx queria "cerquisima o pegado al trofeo"— quedaba el MAS suelto de
   los cuatro. Dlx: "no me gusta, me gusta mas como esta pegado el x1".

   El hueco de referencia es el que tenia ese x1: HUECO_X. Es NEGATIVO, o sea
   que el numero monta sobre el borde de la tinta. Eso es lo que se lee como
   pegado; a hueco 0 ya se lee separado. */
/* ⚠️ EL # VA A .75em PARA PESAR LO MISMO QUE LA x. Por ancho de AVANCE los
   dos miden 5.00 px identicos y parecerian ya iguales; por TINTA no: medidos
   a 64 px, el # da 46 de alto y 1012 de area y la x da 34 y 582, o sea 35%
   mas alto y 74% mas tinta. Igualar por alto pide .739 y por area .759, y
   que las dos cuentas caigan en el mismo lugar es lo que hace confiable el
   numero. Va en em para que siga al tamaño de cada variante. */
.cas .x .alm{{font-size:.75em}}
.cas .x{{position:absolute;right:auto;top:16px;
  font-size:{PAS_REM}rem;font-weight:900;color:#fff;white-space:nowrap;
  text-shadow:0 2px 4px rgba(0,0,0,.85)}}
.cas .x.ban{{left:{_bx('ban'):.1f}px}}
.cas .x.rg{{left:{_bx('rg'):.1f}px}}
.cas .x.sv{{left:{_bx('sv'):.1f}px}}
.cas .x.tro{{left:{_bx('tro'):.1f}px}}


/* ── 1 · la foto ── */
.foto{{position:absolute;right:0;top:0;height:{YN}px;
  display:flex;align-items:center;justify-content:center;overflow:hidden}}
/* ⚠️ LA FOTO MUERE POR LOS CUATRO BORDES, Y ANTES MORIA POR DOS.
   Dlx: "el degradado entre la bandera del pais y el avatar podria ser mejor
   gestionado... mira el de Argentina, con el avatar de Axinu combina pero el
   de Number queda algo raro con eso de Uruguay".

   Tenia razon y la causa no era la foto: era que el fundido solo existia a la
   IZQUIERDA (13%) y ABAJO (18%). Arriba y a la derecha la foto terminaba en
   un CORTE RECTO contra el marco. Cuando funcionaba —Konan— era porque el
   cielo de esa foto y el celeste de Argentina comparten paleta: suerte, no
   diseño.

   Se compararon seis maneras sobre tres casos, y despues las dos finalistas
   sobre OCHO imagenes de bordes muy distintos —cara sobre fondo claro, sobre
   fondo oscuro, de perfil, un grupo, un paisaje con detalle, uno claro, uno
   plano y el avatar por defecto de Discord— cada una sobre otra bandera. Las
   que se cayeron:

     largo    el mismo corte al doble de largo: arregla abajo y SE COME la
              foto —a Konan le borraba los hombros— y deja arriba y la derecha
     tenido   un velo del color de la bandera encima: le CAMBIA el color a la
              cara, que es lo que hacia que la foto rara se viera rara
     vineta   apaga los bordes pero el corte de abajo sigue
     desat    la bandera manda, pero apaga la cara

   ⚠️ Y hay un motivo de fondo para descartar `tenido` y `desat`: tratan a la
   foto como decoracion. Cuando se decidio, 128 de 138 no tenian foto y no
   se notaba; hoy son 26, asi que ya se nota — y el
   dia que el token del bot las traiga todas, esa decision pega en las 138.

   ⚠️ NO SE FUE MAS MARCADO. Se probo tambien 20·88·11·70 y ahi la foto empieza
   a perderse: en Mexico se veia la bandera entera y la cara corrida. El
   fundido tiene que INTEGRAR la foto, no taparla.

   ⚠️ LA DERECHA VA EN 96, NO EN 92. Dlx: "¿puedes hacer que la foto este
   extendida o mas pegada a la derecha?". El 92 dejaba una franja de bandera
   entre la foto y el marco que se leia como si la foto no llegara. Con 96 la
   foto llena y queda un 4% de fundido, que es lo que evita que choque contra
   el marco — y el choque contra el marco era el problema original. A 100 llega
   al borde y ese choque vuelve. El plato la acompaña: 97 -> 99. */
.foto img{{width:100%;height:100%;object-fit:cover;object-position:50% 22%;
  -webkit-mask-image:linear-gradient(90deg,transparent 0,#000 16%,#000 96%,transparent 100%),
  linear-gradient(180deg,transparent 0,#000 7%,#000 78%,transparent 100%);
  -webkit-mask-composite:source-in;mask-composite:intersect;
  mask-image:linear-gradient(90deg,transparent 0,#000 16%,#000 96%,transparent 100%),
  linear-gradient(180deg,transparent 0,#000 7%,#000 78%,transparent 100%)}}
/* ⚠️ UN PLATO OSCURO ENTRE LA FOTO Y LA BANDERA, Y SOLO SI HAY FOTO.
   Dlx, despues de los cuatro bordes: "siento que el degradado sigue siendo un
   problema en algunas ocasiones". Y el problema ya no era la FORMA del
   fundido: era CONTRA QUE se funde. La foto se disuelve y atras aparece la
   bandera, asi que cuando la bandera es clara —Uruguay, Peru, Guatemala,
   Puerto Rico— la foto termina rodeada de un halo brillante.

   El plato es un rectangulo oscuro con la MISMA forma de fundido pero MAS
   ANCHO que la foto: 8 · 97 · 3 · 88 contra 16 · 92 · 7 · 78. Asi la foto
   muere contra el plato y el plato contra la bandera, y la bandera clara nunca
   toca el borde de la foto.

   ⚠️ `:not(.vacia)` NO ES UN DETALLE. Eran 128 de 138 y hoy son 26: la
   regla no cambia, el argumento si — ya no se justifica por mayoria sino
   porque en esas 26 el plato borra lo unico que la carta tiene. Sin eso el
   plato tambien cae sobre las cartas SIN foto, y ahi no hay nada que integrar
   —solo lava la bandera—. Probado: Uruguay, Peru y Guatemala perdian el color
   de su bandera en toda la zona de arriba, que es justo lo unico que esas
   cartas tienen para identificar al pais.

   ⚠️ Y EL ALFA ES .55. Con .78 la bandera desaparece del todo alrededor de la
   foto y la carta deja de decir de donde sos en esa zona. */
.foto:not(.vacia)::before{{content:'';position:absolute;inset:0;
  background:rgba(6,8,16,.55);
  -webkit-mask-image:linear-gradient(90deg,transparent 0,#000 8%,#000 99%,transparent 100%),linear-gradient(180deg,transparent 0,#000 3%,#000 88%,transparent 100%);
  mask-image:linear-gradient(90deg,transparent 0,#000 8%,#000 99%,transparent 100%),linear-gradient(180deg,transparent 0,#000 3%,#000 88%,transparent 100%);
  -webkit-mask-composite:source-in;mask-composite:intersect}}
.foto img{{position:relative;z-index:1}}
.foto.vacia b{{font-size:6.6rem;font-weight:900;color:rgba(255,255,255,.16);
  line-height:1;text-shadow:0 0 22px rgba(0,0,0,.55),0 3px 10px rgba(0,0,0,.5)}}

/* ── 2 · la banda del nombre, en el acento del RANGO oscurecido ── */
.nom{{position:absolute;right:0;top:{YN}px;height:{YS - YN}px;
  display:flex;align-items:center;justify-content:center;
  /* ⚠️ EL TAMAÑO LO PONE comun/nombre.py, NO ESTA HOJA. Son cuatro escalones
     por largo —6, 8, 10 y mas letras— y ya los usan la Competitiva y la
     Servidor. Si Pais los reimplementara, el mismo nombre saldria de dos
     tamaños distintos en dos cartas de la misma persona.
     La base es 1.42 porque el ancho util de esta carta es 231 px —300 menos
     el panel— contra los 300 de la Competitiva, o sea el 77%. */
  color:#fff;font-weight:900;letter-spacing:1.6px;
  border-top:1.6px solid;border-bottom:1.6px solid;
  text-shadow:0 2px 6px rgba(0,0,0,.85)}}

/* ── 3 · las stats ── */
/* ⚠️ LAS STATS SE CENTRAN EN SU ZONA Y CRECEN, porque de seis pasaron a
   cuatro. Con seis el bloque medía 71 px y llenaba el hueco entre el nombre y
   el TAG; con cuatro mide 46 y quedaban 49 px muertos abajo contra 12 arriba.
   Bajarlas 16 px reparte 30 y 31, y subir el cuerpo aprovecha el lugar que
   dejaron las dos que se fueron. */
/* ⚠️ LAS STATS LLEVAN SU PROPIA SOMBRA PORQUE LA BANDERA NO ES PAREJA. Medido
   el fondo de los nueve paises debajo del bloque —apagando las stats para no
   medir su propio blanco— el contraste con el texto iba de 15.4:1 a 2.9:1, y
   CUATRO quedaban por debajo del minimo de 4.5:

       Colombia 15.4 · Ecuador 12.7 · Venezuela 10.8 · Chile 9.9 · Argentina 5.8
       España 4.5 · Peru 3.0 · Mexico 3.0 · Uruguay 2.9

   No es casualidad cuales: son las que tienen una franja BLANCA o AMARILLA
   cruzando esa altura. Mexico y Peru la tienen vertical, asi que ademas parte
   el bloque en dos mitades de distinto brillo.

   ⚠️ Y SUBIR EL VELO GENERAL NO SERVIA: apagaria tambien a Colombia, que ya
   esta en 15.4, y la bandera se veria lavada en las cinco que estan bien. La
   sombra tiene que ser LOCAL, como ya lo es la del panel izquierdo.

   Se desvanece arriba y abajo para no leerse como una caja: lo que hace falta
   es un piso de contraste, no un recuadro.

   ⚠️ EL ALFA ES .32 Y NO MAS. Con relleno, .58 dejaba al peor pais en 9.75:1
   —mas del doble del minimo— y eso no es seguridad, es bandera apagada de
   gratis. Barrido: .30 da 5.31, .38 da 6.27, .46 da 7.46. Se elige el mas
   bajo que deje margen sobre 4.5, porque cada punto de alfa de mas se lo come
   la bandera, que es lo unico que identifica al pais.

   ⚠️ Y POR ESO EL BLOQUE LLEVA RELLENO. Sin el, el desvanecido ocurria DENTRO
   de la caja y la primera fila caia justo ahi: con la sombra al 66% Mexico
   seguia en 3.70. Con 18 px de relleno arriba el degradé se apaga en el aire y
   las tres filas quedan sobre la parte plana. El top compensa el relleno para
   que las stats no se muevan. */
/* 🔴 EL PANEL SE FUE — Dlx, 17/09/2026: «reducí más la sombra o quitá el panel
   oscuro al 100%». Lo de arriba queda escrito porque es la medición que lo
   justificaba y hay que poder deshacer esto: `ALFA_STATS = .32` lo devuelve.

   ⚠️ Y SE VA CON UNA ADVERTENCIA HONESTA, NO CON UN NÚMERO. Intenté tres
   veces medir el contraste de nuevo y la medición NO CONVERGIÓ: daba valores
   idénticos entre .32, .16 y 0, o sea que estaba mirando algo que el panel no
   cubre —primero las rayitas blancas de SEG/TER, después el nombre—. Es la
   trampa que `CLAUDE.md` ya tiene escrita: *cuando lo que medís es más chico
   que la tolerancia de tu medición, el número que sale no sirve*.

   Así que esto NO dice «medí y da bien». Dice: se sacó porque Dlx lo pidió
   mirando las cartas, la comparación visual de México y Perú —las dos con
   franja blanca justo ahí— muestra el texto legible, y **la medición vieja
   sigue siendo la única confiable que hay**: según ella, sin panel España,
   Perú, México y Uruguay caen por debajo de 4.5:1.

   ⚠️ SI ALGUIEN VE UNA CARTA DONDE NO SE LEEN LAS STATS, ESTO ES LO PRIMERO
   QUE HAY QUE MIRAR, y el arreglo es subir `ALFA_STATS` otra vez. */
.stats{{position:absolute;right:0;top:{YS - 4}px;padding:18px 0 16px;
  display:flex;flex-direction:column;color:#fff;
  background:linear-gradient(180deg,rgba(6,8,16,0) 0%,rgba(6,8,16,{ALFA_STATS}) 16%,
    rgba(6,8,16,{ALFA_STATS}) 84%,rgba(6,8,16,0) 100%)}}
.par{{display:flex}}
.cl{{flex:1;display:flex;flex-direction:column;align-items:center;gap:8px}}
.cl:first-child{{border-right:1.4px solid rgba(255,255,255,.16)}}
/* ⚠️ EL PAR DE ABAJO CRUZA LAS DOS COLUMNAS y por eso el divisor se queda
   arriba: si bajara entero partiria en dos una fila que existe justamente
   para leerse junta. El gap sale de que las dos mitades ya estan separadas
   por el divisor de arriba; aca lo unico que las separa es el aire. */
/* ⚠️ CADA UNO SE CENTRA EN SU MITAD, no los dos juntos en el medio. Como par
   ya estaban centrados —184.5 contra 184.5— pero no coincidian con las
   columnas de arriba: DNA caia en 114..174 cuando la columna izquierda vive
   en 106..147. Un bloque de tres filas donde la tercera no se apoya en las
   dos de arriba se ve torcido aunque cada pieza este bien puesta.
   ⚠️ Y de paso deja de apretar: juntos con 26 de gap tenian ~102 px cada uno,
   y en su mitad tienen 115.5, que es lo que hace falta para que un 104/141
   —el caso real de Valen— entre sin achicarse. */
/* ⚠️ LOS DOS DUELOS VUELVEN A IR JUNTOS EN EL MEDIO. Estaban uno en cada
   mitad, alineados con las columnas de arriba, y ahi el problema es otro: se
   ven como dos filas sueltas en los bordes del bloque en vez de como el par
   que son. Dlx: "eso de los duelos ponlo en el medio".
   El hueco de 24 los separa lo justo — pegados se leerian como un solo dato
   de cuatro numeros. */
/* ⚠️ LA FILA DE ABAJO USA EL MISMO ANCHO QUE LAS DE ARRIBA. Iba centrada con
   un hueco propio de 24 y por eso se leia como un apendice y no como la
   tercera fila: sus dos numeros caian en un x que no era el de ninguna de las
   dos columnas. Ahora cada uno ocupa su mitad, igual que EVN/EVI y SEG/TER, y
   las tres filas comparten los mismos dos ejes. */
.pie2{{display:flex;margin-top:8px}}
.pie2 .st{{flex:1;justify-content:center}}
/* ⚠️ EL PAIS NO ES UN NUMERO Y NO SE ESCRIBE COMO UNO. Va en versalitas
   espaciadas y con la opacidad de una etiqueta, no con el peso de un dato:
   lo que dice ya esta dicho por la bandera, y solo hace falta cuando la
   bandera no alcanza — Colombia y Ecuador comparten la suya. */
.pie2.pais{{display:block;text-align:center;font-size:.6rem;font-weight:900;
  letter-spacing:3px;opacity:.62;margin-top:12px;
  text-shadow:0 1px 3px rgba(0,0,0,.9)}}
.pie2 .st{{grid-template-columns:auto 26px}}
/* ══ LAS TRES FORMAS DE LA FILA ══
   ⚠️ ALINEAR LAS ETIQUETAS Y CENTRAR LA TINTA SE PELEAN, y no hay arreglo que
   de las dos: si las etiquetas caen todas en el mismo x, el numero tiene que
   ir en una columna fija, y entonces un valor de una cifra ocupa 12 de esos
   62 y su tinta queda corrida. Medido en 'fija': hasta 24.1 px a la derecha
   del centro de la columna.

     fija      las etiquetas alineadas; la tinta corrida hasta 24 px
     centro    cada pareja centrada por su tinta; las etiquetas escalonadas
     apilada   la etiqueta debajo del numero: no hay nada que alinear ni que
               centrar, pero la fila pasa de una linea a dos

   ⚠️ 'apilada' es la unica que resuelve las dos cosas, y por eso cuesta: el
   bloque crece a lo alto y hay que ver si entra. Es lo mismo que ya hacen los
   casilleros de la columna y el pie de la Servidor. */
.stats.centro .st{{display:flex;grid-template-columns:none;gap:5px;
  align-items:baseline}}
/* ⚠️ 'apilada' NO ENTRA DONDE ARRANCA EL BLOQUE HOY. Medido: pasa de 75.5 px
   de alto a 117.5 y termina en 386, con el TAG arrancando en 363 — se pisa
   por 23. Apilar la etiqueta no es un cambio de forma nada mas: es pedir el
   doble de lineas en el mismo lugar.

   Del pie del nombre al techo del TAG hay 107 px. Con el aire interno bajado
   de 11 a 6, la fila apretada a 1 y la etiqueta a .52rem, el bloque mide 105:
   ENTRA CON 1 PX DE AIRE DE CADA LADO. O sea que se puede, pero deja las
   stats tocando la banda del nombre arriba y el TAG abajo. Si esta forma es
   la elegida, lo honesto es darle mas alto a la carta, no exprimir el hueco. */
/* ⚠️ EL CORRIMIENTO Y EL APRETUJON SE FUERON CUANDO EL BLOQUE CAMBIO DE
   FORMA. Con tres filas por columna, 'apilada' medía 105 de los 107 que hay
   entre el nombre y el TAG, asi que subia 11 y bajaba su aire interno de 11 a
   6 para entrar con 1 px de cada lado. Con el 2x2 mas el par de abajo son dos
   filas por columna, no tres: sobran 50 px y no hace falta nada de eso.
   ⚠️ Quedarse con el ajuste viejo habria sido peor que no tenerlo: apretaba
   contra la banda del nombre —1 px— por un problema que ya no existia. */
.stats.apilada{{transform:translateY(-11px)}}
.stats.apilada.arriba{{transform:translateY(-23px)}}
.stats.apilada .cl{{gap:6px}}
.stats.apilada .st{{gap:1px}}
.stats.apilada .pie2{{margin-top:6px}}
.stats.apilada .st i{{font-size:.52rem}}
.stats.apilada .st{{display:flex;grid-template-columns:none;
  flex-direction:column;align-items:center;gap:2px}}
.stats.apilada .st b{{text-align:center}}
.stats.apilada .st i{{text-align:center}}

/* ⚠️ GRID Y NO FLEX CON min-width. Con flex, un numero mas ancho que su
   min-width empuja a la etiqueta y ADEMAS ensancha la fila, que al ir
   centrada dentro de la columna se corre para los dos lados. Con dos columnas
   fijas las cuatro filas miden lo mismo y la etiqueta cae siempre en el mismo
   x, valga lo que valga el numero. */
.st{{display:grid;grid-template-columns:{COL_NUM}px 26px;gap:5px;
  align-items:baseline}}
.st b{{font-size:{REM_ST}rem;font-weight:900;text-align:right;
  text-shadow:0 2px 5px rgba(0,0,0,.8)}}
.st i{{font-size:.56rem;font-weight:800;letter-spacing:1.1px;font-style:normal;
  opacity:.78;text-align:left;
  text-shadow:0 1px 3px rgba(0,0,0,.85)}}

/* ── el TAG, DEBAJO DEL NOMBRE ──
   ⚠️ Dlx: "el tag debe estar bajo del nombre". Y ahi no hace falta cambiar la
   silueta: entra entre la banda y las stats. Lo que la silueta SI permite es
   acortarse, porque al subir el TAG el tercio de abajo queda con menos cosas.
   Las dos decisiones son independientes: --tag y --acorta. */
/* ⚠️ EL TAG SE CENTRA CON EL NOMBRE, NO CON LA CARTA. Dlx: "que el TAG este
   centrado DEBAJO DEL NOMBRE pero abajo de todo".
   Y el eje cambio de dueño en esta misma tanda: antes el TAG iba en x=150
   porque abajo estaba el UL, que va en la punta. Ahora el UL se mudo al panel,
   asi que en el pie ya no hay nada anclado al centro geometrico — el eje que
   manda es el del CONTENIDO, donde viven el nombre y las stats: x=184. */
.tag{{position:absolute;right:0;margin:0 auto;
  bottom:18px;width:fit-content;
  padding:4px 13px 5px;border:1.2px solid;border-radius:20px;
  background:rgba(8,10,18,.8);
  color:#fff;font-size:.54rem;font-weight:900;letter-spacing:1.2px;
  white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,.9)}}
/* ⚠️ EL NIVEL SE VE, no solo se calcula. Un TAG de nivel 1 y uno de nivel 3
   con el mismo aspecto son el mismo TAG con otras palabras: el que lo mira no
   sabe si lo que dice es raro o es el piso. El borde y la opacidad lo
   separan, igual que en comun/titulos.py. */
.tag.t1{{border-width:1.6px;opacity:1}}
.tag.t2{{border-width:1px;opacity:.96}}
.tag.t3{{border-color:rgba(255,255,255,.24) !important;opacity:.9}}
/* la version vieja, centrada en el contenido, para poder comparar */
.tag.der{{left:auto;right:0;transform:none;margin:0 auto}}

/* ⚠️ EL SELLO VA A y=401 Y NO ABAJO DEL TODO. El panel llega hasta su ancho,
   pero el escudo se cierra: a y=433 su borde izquierdo ya esta en x=87, o sea
   que alli no hay panel y el sello se recortaba entero. */
/* ⚠️ EL SELLO DE TEMPORADA SE SACA POR AHORA. Dlx: "quita lo del PRE de
   momento, para ver cuantos iconos del mismo tamaño podemos poner en el
   lateral izquierdo". Y libera bastante: la columna pasa de 239 px utiles a
   246, o sea un casillero mas de margen. La regla se queda escrita por si
   vuelve. */
.sello{{position:absolute;left:0;bottom:52px;text-align:center;color:#fff;
  font-size:.54rem;font-weight:900;letter-spacing:2.4px;opacity:.6;
  text-shadow:0 1px 4px rgba(0,0,0,.9)}}
/* el UL va centrado en LA CARTA: la punta del escudo esta en el centro
   geometrico y correrlo lo sacaria del vertice */
/* ⚠️ EL UL ESTABA CORRIDO A LA IZQUIERDA Y NO ERA UN AJUSTE FINO: lo centraba
   con left:(LW-44)/2, o sea suponiendo que la imagen mide 44 de ancho. Mide 20
   a esa altura, asi que quedaba 12 px a la izquierda del centro. Centrar por
   un ancho SUPUESTO falla en cuanto el archivo no mide eso; ahora se centra
   con transform, que no necesita saberlo. */
/* ⚠️ EL UL SE CORRE 1 px A LA DERECHA, y no es un capricho: su tinta NO esta
   repartida pareja. Medido sobre el archivo, el centro de la CAJA de tinta
   cae en el 49.93% del ancho pero el centro de MASA en el 46.28% — la cabeza
   del lobo pesa a la izquierda. Centrar por caja lo deja opticamente corrido
   3.65% del ancho, que a 22 px de alto es ~1 px.
   Centrado geometricamente esta perfecto y aun asi se ve movido: por eso se
   compensa la masa y no la caja. */
/* ⚠️ EL UL DEBAJO DEL TAG SE CENTRA CON EL TAG, no con la carta. El TAG vive
   en la zona de la derecha —de LW a 300— y va centrado ahi; poner el UL en el
   centro de la carta lo dejaria a caballo del divisor, con media pieza sobre
   el panel. "Debajo del TAG" es una alineacion, no solo una altura.

   ⚠️ Y NO ENTRA SIN MOVER LAS STATS. Medido: las stats acaban en 344 y el
   filo de abajo del marco esta en 399, o sea 55 px. El TAG mide 21 y el UL
   22: 43 de pieza y 12 para tres huecos. La primera version dejaba el TAG en
   bottom:40 y le quedaba el borde de arriba en 341, TRES PIXELES ADENTRO de
   las stats — se leia como un error de altura del TAG y era falta de lugar.
   Las stats suben 12 y entonces los tres huecos dan 5, 7 y 12. */
.stats.arriba{{transform:translateY(-12px)}}
.ul.baja{{bottom:15px}}
.tag.sube{{bottom:44px}}
/* ⚠️ 19 Y NO 22. Dlx: "quizas hay un poquitito mas pequeño UL?". Achicarlo no
   es solo estetica: esta anclado por abajo, asi que cada px que pierde de alto
   es un px que le devuelve al ultimo casillero. Son 3. */
.ul{{position:absolute;bottom:20px;height:19px;width:auto;
  transform:translateX(calc(-50% + 1px));
  opacity:.92;filter:drop-shadow(0 2px 5px rgba(0,0,0,.8))}}

/* ══ LOS DOS CHIPS DE DUELOS ══
   Dlx: "si ponemos 2 chips o cuadrados como la tarjeta competitiva y hacemos
   eso como lo hace el competitivo eso de duelos? pero en este caso 2, duelos
   nacionales e internacionales".

   El lenguaje sale de .chip de 02_Competitivo/v2/card.css y se copia entero:
   relleno oscuro en degrade de 180 grados, filo blanco de 1.4, radio 8, y una
   etiqueta chiquita adentro con opacidad .55. Lo unico que cambia es la
   fuente — alla es Barlow Condensed y aca la carta usa Archivo, y traer una
   familia nueva por dos chips no se paga.

   ⚠️ SALEN 11 px FUERA DEL BORDE, igual que alla, y eso tiene consecuencia
   fuera de la pantalla: al exportar hay que medir la union con lo que cuelga,
   no la caja de la carta. Es exactamente lo que CLAUDE.md ya documenta de la
   Competitiva y de la Servidor.

   ⚠️ Y POR ESO NO LLEVAN BRILLO DEL ACENTO. Alla se lo sacaron por lo mismo:
   un halo de 14 px sobre algo que ya sobresale 11 termina a 25 del borde, y
   sobre transparencia queda como una mancha suelta en vez de fundirse. */
.fuera{{position:relative;width:{W}px;height:{H}px}}
/* ⚠️ SE ANCLAN A LA BANDA DEL NOMBRE, NO A UN PORCENTAJE DEL ALTO. A 29% del
   techo caian sobre el retrato; a 37% quedaban bien pero el ultimo se metia
   4.9 px DENTRO de la banda, porque un porcentaje no sabe donde termina el
   par: dos chips de 32 con 5 de aire son 69 px que crecen hacia abajo.
   Anclados por abajo, el par apoya siempre a 9 px del filo de la banda y da
   igual cuanto mida cada chip. */
/* ══ SEIS FORMAS PARA LOS CHIPS ══
   Todas comparten el sitio, el ancho y la etiqueta en palabras; lo que cambia
   es la forma y de donde sale el color. Van como clase del contenedor para que
   una sola linea cambie los dos a la vez y no puedan quedar distintos.

     caja      rectangulo redondeado con filo. Es el de la Competitiva.
     pastilla  redondeado entero, como el TAG de abajo
     bisel     esquina cortada, lenguaje de marcador deportivo
     placa     relleno macizo en vez de filo: el de casa toma el color del
               rango y escribe en oscuro
     banderin  muesca en el filo izquierdo, como una cinta
     unido     UNO SOLO partido en dos. Es la unica que no es un cambio de
               forma sino de estructura: dice que los duelos son un dato con
               dos caras y no dos datos.
*/
.chips.pastilla .chip{{border-radius:999px;padding:5px 10px 4px}}
.chips.bisel .chip{{border-radius:0;
  clip-path:polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,
  0 100%,0 9px)}}
.chips.placa .chip{{border-color:transparent;
  background:linear-gradient(180deg,rgba(16,17,26,.97),rgba(34,35,52,.97))}}
.chips.placa .chip.casa{{background:linear-gradient(180deg,var(--acc),
  color-mix(in srgb,var(--acc) 72%,#000));color:#0B0B12}}
.chips.placa .chip.casa u{{opacity:.72}}
.chips.banderin .chip{{border-radius:0 8px 8px 0;
  clip-path:polygon(0 0,100% 0,100% 100%,0 100%,7px 50%)}}
.chips.banderin .chip{{padding-left:14px}}
/* el unido es un solo chip con un filo en el medio */
.chips.unido{{align-items:stretch}}
.chips.unido .chip{{width:104px;display:flex;padding:4px 0 3px}}
.chips.unido .chip > span{{flex:1;text-align:center}}
.chips.unido .chip > span + span{{border-left:1.2px solid rgba(255,255,255,.22)}}
.chips.unido .chip .ac{{color:var(--acc)}}

/* ⚠️ EL PAR SE CENTRA EN LA ZONA DE LA FOTO, que va de 0 a donde arranca la
   banda del nombre. Dlx: "puedes centrarlo mas, o sea mas arriba, como estan
   los chips del competitivo".

   Y las dos cosas dan el mismo numero, que es lo que lo confirma: los chips de
   la Competitiva viven en top:17.5% de su carta, y centrar un par de 69 px en
   los 213 de foto de esta da 72, o sea 17.9%. Pedir "como el competitivo" y
   pedir "centrado" llevan al mismo lugar.

   ⚠️ SE CENTRA CON flex Y NO CON UN top FIJO. El par mide lo que midan sus dos
   chips, asi que un top calculado a mano se descentraria en cuanto uno cambie
   de alto — y cambia, porque el numero se achica cuando no entra. Antes
   estaban anclados al pie de la banda por el motivo contrario: ese borde si es
   fijo, pero deja el par abajo. */
/* ⚠️ LAS ESTRELLAS VAN DENTRO DEL RECORTE, al reves que los chips. Un chip
   cuelga por fuera a proposito; una estrella sobre la banda del nombre esta
   en el medio de la carta, asi que no hay nada que saltear al exportar. */
.est{{position:absolute;z-index:11;
  filter:drop-shadow(0 2px 4px rgba(0,0,0,.85))}}
.chips{{position:absolute;right:-11px;top:0;height:{YN:.0f}px;z-index:9;
  display:flex;flex-direction:column;justify-content:center;gap:5px;
  align-items:flex-end}}
/* ⚠️ 56 DE ANCHO, QUE ES EL DE LA COMPETITIVA. Estaban en 76 y se veian
   estirados; Dlx lo noto y mando a mirar el original. Medido sobre su carta de
   verdad —02_Competitivo/_kn.html, no el CSS— los cuatro chips dan 56.0 de
   ancho y sobresalen 11.0. O sea que lo que sobresale ya coincidia y lo que
   sobraba era el ancho: 36% de mas.

   ⚠️ ANCHO FIJO Y NO min-width, eso si se queda: son un PAR y tienen que
   leerse como uno solo. Con min-width cada chip medía lo que su numero, asi
   que 4/6 salia mucho mas angosto que 38/61 y quedaban en escalera. La
   Competitiva usa min-width y ahi no molesta porque sus cuatro chips llevan
   valores de largo parecido; aca los dos son el mismo dato y cualquier
   diferencia de ancho se lee como un error.

   El relleno baja de 8 a 5 para que en 56 entre 38/61 sin achicarse. */
.chip{{width:56px;box-sizing:border-box;text-align:center;
  padding:4px 5px 3px;border-radius:8px;
  background:linear-gradient(180deg,rgba(11,11,19,.95),rgba(28,28,44,.95));
  border:1.4px solid rgba(255,255,255,.34);
  font-size:.82rem;font-weight:800;line-height:1.15;color:#fff;
  box-shadow:0 3px 9px rgba(0,0,0,.7)}}
/* ⚠️ LA ETIQUETA VA DEBAJO Y DICE LA PALABRA. Estaba al lado y en codigo
   —DNA, DIN— y ahi el chip tenia dos problemas a la vez: el codigo hay que
   aprenderselo, y la etiqueta al lado empujaba el numero fuera del centro, o
   sea que los dos chips tenian su numero en x distinto.
   Abajo y centrada, el numero manda y la palabra explica. CASA y FUERA se
   entienden sin leyenda; DNA y DIN no. */
/* ⚠️ EL ESPACIADO SE QUEDA EN 1.1. Lo habia bajado a .8 creyendo que FUERA se
   salia del chip de 56, y esa medicion estaba mal: pedi el rango de todo el
   contenido, o sea la caja que cubre LAS DOS LINEAS, y me dio 44 contra 43.2
   de adentro. Medidas por separado, la palabra da 27.0 y el numero 36.0.
   Un rango sobre un elemento con dos lineas no mide ninguna de las dos: mide
   la mas ancha, y ni siquiera sabe cual es. */
.chip u{{display:block;text-decoration:none;font-size:.38rem;
  font-weight:900;letter-spacing:1.1px;opacity:.6;margin-top:1px}}
/* el de casa toma el color del rango; el de afuera se queda neutro. Son dos
   caras del mismo dato y hay que poder decir cual es cual de un vistazo. */
.chip.casa{{color:var(--acc);border-color:var(--acc)}}

/* ── el marco ──
   ⚠️ NO PUEDE SER METALICO: ese lenguaje es de la Competitiva y la Servidor ya
   lo tiene prohibido por escrito. Va como borde de la silueta, con filo
   oscuro adentro para que no se pierda contra la bandera. */
/* ⚠️ z-index:3 Y NO NADA. El marco va ULTIMO en el DOM, y eso NO ALCANZA: la
   foto es `position:relative;z-index:1`, y en CSS un elemento posicionado con
   z-index pinta encima de uno con z-index:auto **aunque el otro vaya despues**.
   O sea que la foto tapaba el marco.

   🔴 Y SE VEIA EN UNA SOLA ESQUINA, QUE ES LO QUE LO HIZO DIFICIL. Los dos se
   pisan nada mas donde la foto llega mas alla de la linea del marco, y eso
   pasa justo en el HOMBRO DE ARRIBA A LA DERECHA, donde la silueta entra y la
   foto —que llega al 96% de su caja— la cruza. A la izquierda no hay foto
   sino el panel, asi que ahi el marco siempre se vio entero. Dlx lo encontro
   mirando: «mira el borde del marco de la esquina derecho superior».

   Medido sobre la carta de Zignos, el color pegado al borde fila por fila:

       y=36   izquierda (255,211,75)   derecha (219,172,83)
       y=60   izquierda (255,210,79)   derecha (177,129,75)
       y=84   izquierda (154,128,50)   derecha (153,113,79)

   A la izquierda el dorado se mantiene; a la derecha se apaga contra la piel
   de la foto. No era el trazo: era quien lo tapaba.

   3 y no mas: tiene que quedar debajo de los chips (9) y las estrellas (11),
   que viven FUERA del recorte y sobresalen a proposito. */
.marco{{position:absolute;inset:0;width:{W}px;height:{H}px;
  z-index:3;pointer-events:none}}
'''


async def disparar(html, ancho, alto, salida, tmp='_maqueta.html'):
    # ⚠️ EL NOMBRE DEL HTML ES UN PARAMETRO PORQUE herramientas/hueco_numeros.py
    # LEE _maqueta.html. Si una hoja comparativa lo pisara, ese medidor pasaria
    # a medir seis cartas en vez de la de verdad y no avisaria: encontraria
    # .card y .cas igual, con otros numeros.
    p = os.path.join(SCR, tmp)
    open(p, 'w', encoding='utf-8').write(html)
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        br = await pw.chromium.launch()
        pg = await br.new_page(viewport={'width': ancho, 'height': alto},
                               device_scale_factor=ESCALA)
        await pg.goto(pathlib.Path(p).as_uri())
        await pg.wait_for_timeout(1100)
        # 🔴 EL TIMEOUT SE CALCULA, NO SE DEJA EN EL DEFAULT DE 30 s. El
        # 24/09/2026 `generar.py --todas` empezó a fallar entero con
        # `Page.screenshot: Timeout 30000ms exceeded` — no porque algo
        # estuviera roto, sino porque la hoja creció: el pool pasó de 19
        # a 54 personas y la grilla con todas es una imagen de varios
        # miles de píxeles de lado que Chromium tarda más de medio minuto
        # en serializar.
        #
        # ⚠️ ES LA MISMA FAMILIA QUE «CHROMIUM TIRA CARTAS EN BLANCO
        # CUANDO LA HOJA ES MUY GRANDE», que `CLAUDE.md` ya documenta: la
        # hoja crece con el pool y algo se rompe sin que el diseño haya
        # cambiado. Aquella se resolvió contando las cartas pintadas;
        # ésta, dándole tiempo proporcional al tamaño.
        #
        # ⚠️ Y NO ES «PONER UN NUMERO GRANDE»: sale del área real. Una
        # carta sola son ~0,4 Mpx y termina en un segundo; la hoja de las
        # 54 son ~50 Mpx. Un techo fijo generoso escondería el día que
        # una hoja tarde de verdad demasiado — el número dice cuánto se
        # esperó y por qué.
        mpx = (ancho * alto * ESCALA * ESCALA) / 1e6
        espera = max(30_000, int(mpx * 2_500))
        await pg.screenshot(path=salida, full_page=True, timeout=espera)
        await br.close()
    print('-> %s' % os.path.relpath(salida, BASE))


async def una(lane, marco, acorta, remate, iconos='colgado', trofeo='E',
              num='tinta', juego='final', panel='plano'):
    LW = round(W * lane / 100)
    h = alto_de(remate, acorta)
    sil = "path('%s')" % silueta(acorta, remate)
    html = ('<!DOCTYPE html><meta charset="utf-8"><style>' +
            CSSF(h, sil, num) + '</style><div class="rack">' +
            ''.join(carta(i, LW, marco, True, acorta, remate, iconos, 'E',
                          num, 'panel', juego, 'centro', panel)
                    for i in range(len(GENTE))) + '</div>')
    await disparar(html, len(GENTE) * (W + 26) + 40, h + 60,
                   os.path.join(SCR, 'maqueta.png'))


async def comparar():
    """Como se ve el MUNDIAL: hoy no lo tiene nadie, asi que hay que simularlo.

    ⚠️ Y ES LA UNICA FORMA DE MIRARLO. El casillero de un trofeo solo se dibuja
    si el conteo es mayor que cero —"sin dato no hay pieza"— asi que con los
    numeros de verdad la pieza NO EXISTE en ninguna carta: la Copa de Naciones
    arranca en T2. Una hoja que no la simule nunca la muestra.

    Se ven cuatro casos: sin mundial, con uno, con dos —que cambia el TAG a
    LEYENDA MUNDIAL— y con uno solo mundial y ningun nacional, que es como se
    ve el casillero cuando esta solo.
    """
    global TROFEOS
    guardar = TROFEOS
    LW = round(W * 23 / 100)
    casos = [((1, 0), 'como esta hoy — un nacional, ningun mundial'),
             ((1, 1), 'un nacional y un mundial'),
             ((1, 2), 'dos mundiales — el TAG cambia'),
             ((0, 1), 'solo mundial, sin nacional')]
    cuerpo = ''
    for (n, m), txt in casos:
        TROFEOS = [('nac', 'NACIONAL', n), ('int', 'MUNDIAL', m)]
        cuerpo += (f'<div class="tit">NAC {n} · MUN {m}<span> — {txt}</span></div>'
                   f'<div class="rack">'
                   + carta(0, LW, 'B', True, 0, 'recta', 'colgado', 'E')
                   + '</div>')
    TROFEOS = guardar
    h = alto_de('recta')
    html = ('<!DOCTYPE html><meta charset="utf-8"><style>'
            + CSSF(h, "path('%s')" % silueta(0, 'recta')) + '</style>' + cuerpo)
    await disparar(html, W + 66, len(casos) * (h + 62) + 60,
                   os.path.join(SCR, 'comparar.png'))


# ⚠️ LOS CASOS SE ESCRIBEN COMO ENTRADAS, NO COMO TEXTOS. La hoja llama a
# tag() de verdad con cada uno, asi que si manana cambia el orden de la
# cascada o el texto de una regla, la hoja cambia sola. Una lista de titulos
# escrita a mano se desincroniza del codigo el dia que alguien toca la
# cascada, y nadie se entera hasta que sale mal en una carta.
CASOS_TAG = [
    ('tres mundiales', dict(pos='1/33', nac=3, mun=3)),
    ('dos mundiales', dict(pos='1/33', nac=1, mun=2)),
    ('un mundial Y un nacional', dict(pos='2/25', nac=1, mun=1)),
    ('un mundial', dict(pos='2/25', mun=1)),
    ('tres nacionales', dict(pos='2/25', nac=3)),
    ('dos nacionales', dict(pos='2/25', nac=2)),
    ('un nacional siendo el 1 del pais', dict(pos='1/25', nac=1)),
    ('un nacional', dict(pos='5/25', nac=1)),
    ('1 de un pais de 20 o mas', dict(pos='1/33')),
    ('1 de un pais chico, ganando 7 de cada 10', dict(pos='1/8', win='72%')),
    ('1 de un pais chico', dict(pos='1/8', win='50%')),
    ('podio con 65% o mas', dict(pos='2/20', win='66%')),
    ('podio', dict(pos='2/20', win='50%')),
    ('gana 10 puntos mas afuera que en casa',
     dict(pos='6/25', dna='5/20', din='12/20')),
    ('gana 10 puntos mas en casa que afuera',
     dict(pos='6/25', dna='15/20', din='3/20')),
    ('cuarto de tabla con 60% o mas', dict(pos='4/25', win='62%')),
    ('cuarto de tabla', dict(pos='4/25', win='40%')),
    ('65% en 25 eventos o mas', dict(pos='9/25', win='66%', evt=30)),
    ('20 podios o mas', dict(pos='9/25', pod=22)),
    ('racha de 8 o mas', dict(pos='9/25', rch=9)),
    ('40 eventos o mas', dict(pos='9/25', evt=45)),
    ('mitad de tabla o mejor', dict(pos='9/25')),
    ('12 eventos o mas', dict(pos='20/25', evt=15)),
    ('sin puesto de pais', dict(pos='')),
    ('el resto', dict(pos='20/25')),
]


CHIPS = {'caja': 'rectangulo redondeado con filo, el de la Competitiva',
         'pastilla': 'redondeado entero, como el TAG de abajo',
         'bisel': 'esquina cortada, lenguaje de marcador',
         'placa': 'relleno macizo: el de casa lleva el color del rango',
         'banderin': 'muesca en el filo izquierdo, como una cinta',
         'unido': 'UNO solo partido en dos'}


async def comparar_titulos():
    """El TAG en cartas de verdad, y las estrellas del mundial.

    ⚠️ SE MIRA EN LA CARTA Y NO EN LA HOJA DE PASTILLAS. --tags muestra los 25
    textos con su nivel, que sirve para leer la cascada; esto sirve para otra
    cosa: ver si el TAG SE LEE sobre la banda del nombre y sobre la bandera que
    le toque, que es donde va a estar.

    ⚠️ Y TODOS LOS CASOS SON SIMULADOS. Los dos primeros niveles cuelgan de
    trofeos que arrancan en T2, asi que hoy nadie llegaria mas alla de t3.
    """
    global GENTE, TROFEOS
    g0, t0 = GENTE[0], TROFEOS
    # ⚠️ NO ALCANZA CON CAMBIAR EL PUESTO. La primera version movia solo eso y
    # los dos ultimos casos salian GANA AFUERA en vez de MEDIA TABLA y
    # REPRESENTANTE: Konan tiene 71% de win rate y 50 eventos, y esa regla de
    # nivel 2 se los lleva antes de que la cascada llegue al piso. Bajar solo
    # eso tampoco alcanzo: despues los agarraba BANDERA VIVA por sus 29
    # podios, y despues EN RACHA por su racha de 12.
    #
    # ⚠️ PARA VER UN NIVEL HAY QUE APAGAR TODO LO QUE SE CUMPLE MAS ARRIBA, y
    # que haga falta tres veces no es un estorbo de la hoja: es la prueba de
    # que la cascada funciona. Una lista de "si cumple X" sin orden dejaria a
    # esta persona con seis titulos a la vez.
    #        puesto   nac mun  win    evt pod rch  que muestra
    casos = [('1/33', 3, 3, '71%', 50, 29, 12, 'tres mundiales'),
             ('2/25', 1, 1, '71%', 50, 29, 12, 'un mundial y un nacional'),
             ('1/25', 2, 0, '71%', 50, 29, 12, 'dos nacionales'),
             ('2/20', 0, 0, '52%', 18, 6, 2, 'podio, sin titulos'),
             ('9/25', 0, 0, '48%', 14, 4, 1, 'mitad de tabla'),
             ('20/25', 0, 0, '44%', 9, 2, 0, 'el resto')]
    LW = round(W * 23 / 100)
    h = alto_de('recta')
    sil = "path('%s')" % silueta(0, 'recta')
    css = css_base(h, sil) + css_num('combo-r2')
    cuerpo = ('<div style="display:grid;grid-template-columns:repeat(3,1fr);'
              'gap:30px 24px;padding:26px 30px;justify-items:center">')
    for pos, nac, mun, win, evt, pod, rch, desc in casos:
        g = list(g0)
        g[5], g[8], g[9], g[11], g[12] = pos, evt, pod, win, rch
        g[17], g[18] = nac, mun
        GENTE = [tuple(g)]
        cuerpo += ('<div>'
                   + carta(0, LW, 'B', True, 0, 'recta', 'colgado', 'E',
                           'combo-r2', 'panel', 'final', 'centro', 'puntos')
                   + f'<div class="tit" style="margin:12px 0 0;font-size:11px;'
                   f'font-weight:600;opacity:.6">{desc}</div></div>')
    GENTE, TROFEOS = [g0], t0
    cuerpo += '</div>'
    html = ('<!DOCTYPE html><meta charset="utf-8"><style>' + css + '</style>'
            + cuerpo)
    await disparar(html, 3 * W + 2 * 24 + 90, 2 * (h + 50) + 60,
                   os.path.join(SCR, 'titulos.png'), '_titulos.html')


async def comparar_chips():
    """Las seis formas del chip, de cerca.

    ⚠️ SE MIRAN RECORTADAS Y AL DOBLE. Los chips miden 76x32 en una carta de
    300x402: en la carta entera la diferencia entre una esquina redonda y una
    cortada no llega a un pixel y medio, o sea que compararlas ahi seria
    compararlas sin poder verlas.
    """
    LW = round(W * 23 / 100)
    h = alto_de('recta')
    sil = "path('%s')" % silueta(0, 'recta')
    css = css_base(h, sil) + css_num('combo-r2')
    Z, an, al, y0 = 2.6, 130, 108, 128
    fila = ''
    for k, desc in CHIPS.items():
        fila += (f'<div><div style="width:{an}px;height:{al}px;'
                 'overflow:hidden;position:relative">'
                 f'<div style="position:absolute;left:{-(W - an + 14)}px;'
                 f'top:{-y0}px">'
                 + carta(1 if len(GENTE) > 1 else 0, LW, 'B', True, 0, 'recta',
                         'colgado', 'E', 'combo-r2', 'panel', 'chips-mas',
                         'centro', 'puntos', False, True, False, k)
                 + '</div></div>'
                 f'<div class="tit" style="margin:9px 0 0;font-size:11px">'
                 f'{k.upper()}</div></div>')
    paso = int((an + 16) * Z)
    pie = ''.join(f'<div style="width:{paso - 14}px;font-size:11px;'
                  'font-weight:600;opacity:.6;line-height:1.45;'
                  f'color:#EDEDF5">{d}</div>' for d in CHIPS.values())
    html = ('<!DOCTYPE html><meta charset="utf-8"><style>' + css + '</style>'
            + f'<div style="height:{int((al + 40) * Z)}px">'
            f'<div style="transform:scale({Z});transform-origin:top left;'
            'display:inline-flex;gap:16px;padding:14px 13px">'
            + fila + '</div></div>'
            + '<div style="display:flex;gap:14px;padding:2px 26px 26px">'
            + pie + '</div>')
    await disparar(html, len(CHIPS) * paso + 60, int((al + 40) * Z) + 120,
                   os.path.join(SCR, 'chips.png'), '_chips.html')


async def comparar_pie():
    """Los duelos como chips a la derecha, y tres cosas para el hueco de abajo."""
    LW = round(W * 23 / 100)
    h = alto_de('recta')
    sil = "path('%s')" % silueta(0, 'recta')
    css = css_base(h, sil) + css_num('combo-r2')
    casos = [('final', 'COMO ESTA HOY',
              'los duelos en el bloque, sin chips'),
             ('chips-pais', 'CHIPS + EL PAIS ESCRITO',
              'la carta nunca dice de que pais habla'),
             ('chips-mas', 'CHIPS + DOS STATS MAS',
              'MEJ el techo y SUB el movimiento'),
             ('chips-nada', 'CHIPS + NADA',
              'dos por dos y se acabo')]
    cuerpo = ('<div style="display:grid;grid-template-columns:repeat(2,1fr);'
              'gap:34px 34px;padding:26px 34px;justify-items:center">')
    for juego, tit, sub in casos:
        cuerpo += ('<div>'
                   + carta(1 if len(GENTE) > 1 else 0, LW, 'B', True, 0,
                           'recta', 'colgado', 'E', 'combo-r2', 'panel',
                           juego, 'centro', 'puntos')
                   + f'<div class="tit" style="margin:14px 0 0;font-size:12px">'
                   f'{tit}<div style="font-size:10.5px;font-weight:600;'
                   f'opacity:.55;margin-top:4px">{sub}</div></div></div>')
    cuerpo += '</div>'
    html = ('<!DOCTYPE html><meta charset="utf-8"><style>' + css + '</style>'
            + cuerpo)
    await disparar(html, 2 * W + 34 + 88, 2 * (h + 82) + 60,
                   os.path.join(SCR, 'pie.png'), '_pie.html')


async def comparar_ovr():
    """El numero grande arriba a la izquierda contra arriba a la derecha."""
    LW = round(W * 23 / 100)
    h = alto_de('recta')
    sil = "path('%s')" % silueta(0, 'recta')
    css = css_base(h, sil) + css_num('combo-r2')
    cuerpo = ('<div style="display:grid;grid-template-columns:repeat(2,1fr);'
              'gap:30px 20px;padding:26px;justify-items:center">')
    for der, tit in ((False, 'EN EL PANEL — como esta hoy'),
                     (True, 'SOBRE LA FOTO — arriba a la derecha')):
        for i in range(len(GENTE)):
            cuerpo += carta(i, LW, 'B', True, 0, 'recta', 'colgado', 'E',
                            'combo-r2', 'panel', 'final', 'centro', 'puntos',
                            False, True, der)
        cuerpo += ('<div class="tit" style="grid-column:1/-1;margin:0 0 6px;'
                   f'font-size:12px">{tit}</div>')
    cuerpo += '</div>'
    html = ('<!DOCTYPE html><meta charset="utf-8"><style>' + css
            + '.tit{order:99}</style>' + cuerpo)
    await disparar(html, 2 * W + 20 + 52, 2 * (h + 60) + 60,
                   os.path.join(SCR, 'ovr.png'), '_ovr.html')


async def comparar_tags():
    """Todos los TAG que la cascada puede dar, en su nivel.

    ⚠️ EL NIVEL NO ES DECORACION. Un TAG de nivel 1 y uno de nivel 3 con el
    mismo aspecto son el mismo TAG con otras palabras: quien lo mira no sabe
    si lo que dice es raro o es el piso. Por eso la hoja los agrupa y muestra
    el borde y la opacidad de cada uno.
    """
    h = alto_de('recta')
    sil = "path('%s')" % silueta(0, 'recta')
    css = css_base(h, sil)
    grupos = {'t1': [], 't2': [], 't3': []}
    for desc, kw in CASOS_TAG:
        txt, niv = tag(**kw)
        grupos[niv].append((txt, desc))
    TIT = {'t1': ('NIVEL 1 — lo que casi nadie tiene',
                  'borde de 1.6 px, opacidad entera'),
           't2': ('NIVEL 2 — lo que distingue',
                  'borde de 1 px, opacidad .96'),
           't3': ('NIVEL 3 — el piso',
                  'borde gris en vez del acento, opacidad .90')}
    acc = RG.ACENTO['SSS']
    cuerpo = ''
    for niv in ('t1', 't2', 't3'):
        tit, sub = TIT[niv]
        cuerpo += (f'<div class="tit" style="margin:26px 0 4px">{tit}'
                   f'<div style="font-size:10.5px;font-weight:600;opacity:.5;'
                   f'letter-spacing:.2px;margin-top:3px">{sub}</div></div>'
                   '<div style="display:flex;flex-wrap:wrap;gap:14px 18px">')
        for txt, desc in grupos[niv]:
            cuerpo += (f'<div style="width:210px">'
                       f'<div class="tag {niv}" style="position:static;'
                       f'border-color:{acc};display:inline-block">{txt}</div>'
                       f'<div style="font-size:10px;font-weight:600;'
                       f'opacity:.5;margin-top:6px;line-height:1.4;'
                       f'color:#EDEDF5">{desc}</div></div>')
        cuerpo += '</div>'
    html = ('<!DOCTYPE html><meta charset="utf-8"><style>' + css
            + 'body{background:#0E1018;padding:22px 30px 34px}</style>'
            + cuerpo)
    # el alto sale de lo que hay: 3 titulos, las filas de cada nivel y el aire
    filas = sum(-(-len(v) // 4) for v in grupos.values())
    await disparar(html, 4 * 210 + 3 * 18 + 80,
                   3 * 62 + filas * 70 + 70,
                   os.path.join(SCR, 'tags.png'), '_tags.html')


async def comparar_lane():
    """Tres formas de resolver el apretujon del panel, en la carta que lo tiene.

    ⚠️ SE MIRA EN KAIRO Y NO EN KONAN. Konan no tiene crew ni mundial, asi que
    su panel lleva cuatro casilleros y le sobran 99 px hasta el sello: en su
    carta el problema no existe. El que decide es el de seis.
    """
    i = 1 if len(GENTE) > 1 else 0
    LW = round(W * 23 / 100)
    h = alto_de('recta')
    sil = "path('%s')" % silueta(0, 'recta')
    css = css_base(h, sil) + css_num('combo-r2')
    casos = [(True, False, 'COMO ESTA', 'seis casilleros, sin etiquetas'),
             (False, False, 'SIN CREW', 'cinco casilleros, sin etiquetas'),
             (False, True, 'SIN CREW, CON ETIQUETAS',
              'cinco casilleros y las etiquetas de vuelta, mas blancas')]
    x, an, y, al = TIRA
    fila = ''
    for cw, et, tit, _d in casos:
        fila += (f'<div><div style="width:{an}px;height:{al}px;'
                 'overflow:hidden;position:relative">'
                 f'<div style="position:absolute;left:{-x}px;top:{-y}px">'
                 + carta(i, LW, 'B', True, 0, 'recta', 'colgado', 'E',
                         'combo-r2', 'panel', 'final', 'centro', 'puntos',
                         cw, et)
                 + '</div></div></div>')
    paso = int((TIRA[1] + 14) * ZOOM_TIRA)
    pie = ''.join(f'<div style="width:{paso - 12}px;font-size:11px;'
                  'font-weight:700;letter-spacing:.4px;line-height:1.5;'
                  f'color:#EDEDF5">{t}<div style="font-weight:600;'
                  f'opacity:.55;margin-top:3px">{d}</div></div>'
                  for _c, _e, t, d in casos)
    html = ('<!DOCTYPE html><meta charset="utf-8"><style>' + css + '</style>'
            + f'<div style="height:{int((al + 46) * ZOOM_TIRA)}px">'
            f'<div style="transform:scale({ZOOM_TIRA});transform-origin:'
            'top left;display:inline-flex;gap:14px;padding:16px 13px">'
            + fila + '</div></div>'
            + '<div style="display:flex;gap:12px;padding:2px 26px 26px">'
            + pie + '</div>')
    await disparar(html, len(casos) * paso + 60,
                   int((TIRA[3] + 46) * ZOOM_TIRA) + 130,
                   os.path.join(SCR, 'lane.png'), '_lane.html')


async def comparar_paneles():
    """Las texturas del panel, en tira y de cerca.

    ⚠️ VAN EN TIRA Y NO EN CARTAS ENTERAS. Todas viven en 4-7% de alfa sobre
    una superficie que ademas deja pasar la bandera al 10%: a 300 px por carta
    la diferencia entre una y otra no llega a verse, y la hoja compararia seis
    paneles identicos.
    """
    LW = round(W * 23 / 100)
    h = alto_de('recta')
    sil = "path('%s')" % silueta(0, 'recta')
    css = css_base(h, sil) + css_num('combo-r2')
    x, an, y, al = TIRA
    fila = ''
    for m, (_t, desc) in PANEL_TEX.items():
        fila += (f'<div><div style="width:{an}px;height:{al}px;'
                 'overflow:hidden;position:relative">'
                 f'<div style="position:absolute;left:{-x}px;top:{-y}px">'
                 + carta(0, LW, 'B', True, 0, 'recta', 'colgado', 'E',
                         'combo-r2', 'panel', 'final', 'centro', m)
                 + '</div></div>'
                 f'<div class="tit" style="margin:10px 0 0;font-size:11px">'
                 f'{m.upper()}</div></div>')
    paso = int((TIRA[1] + 14) * ZOOM_TIRA)
    pie = ''.join(f'<div style="width:{paso - 12}px;font-size:11px;'
                  'font-weight:600;letter-spacing:.2px;opacity:.6;'
                  f'line-height:1.45;color:#EDEDF5">{d}</div>'
                  for _t, d in PANEL_TEX.values())
    html = ('<!DOCTYPE html><meta charset="utf-8"><style>' + css + '</style>'
            + f'<div style="height:{int((al + 46) * ZOOM_TIRA)}px">'
            f'<div style="transform:scale({ZOOM_TIRA});transform-origin:'
            'top left;display:inline-flex;gap:14px;padding:16px 13px">'
            + fila + '</div></div>'
            + '<div style="display:flex;gap:12px;padding:2px 26px 26px">'
            + pie + '</div>')
    await disparar(html, len(PANEL_TEX) * paso + 60,
                   int((TIRA[3] + 46) * ZOOM_TIRA) + 120,
                   os.path.join(SCR, 'paneles.png'), '_paneles.html')


async def comparar_stats():
    """Los dos juegos de stats, en las dos personas que importan.

    ⚠️ VAN DOS PERSONAS Y NO UNA. Konan es el #1 de Argentina, y para el lider
    de su pais tres de las seis nuevas caen en su caso degenerado: DIF no
    tiene a nadie arriba, MEJ ya es 1 y SUB es 0. Mirando solo su carta el
    bloque parece vacio y no lo es — es que el #1 es el unico a quien no le
    queda a donde subir. Valen va tercero y muestra el bloque como lo va a ver
    la mayoria.
    """
    global GENTE
    guardar = GENTE
    k = GENTE[0]
    #        nom      cc    rg   sv     crew  pos     ovr sem evt pod cam
    valen = ('VALEN', 'ar', 'S', 'TFC', None, '3/33', 78, 11, 80, 35, 18,
             '57.3%', 2, 4, 7, '169/228', 5, None, None)
    GENTE = [k, valen]
    LW = round(W * 23 / 100)
    h = alto_de('recta')
    sil = "path('%s')" % silueta(0, 'recta')
    css = css_base(h, sil) + css_num('combo-r2')
    filas = [('duelos2', 'CON DE', 'DE es de cuantos compatriotas sos el '
              '#N — el denominador de la pastilla de la bandera', 'centro'),
             ('duelos3', 'CON SUB', 'SUB es cuantos puestos subiste o '
              'bajaste — el movimiento', 'centro'),
             ('duelos2', 'CON DE, APILADA', 'la misma de la izquierda con '
              'la etiqueta debajo del numero', 'apilada')]
    cuerpo = ('<div style="display:grid;grid-template-columns:repeat(3,1fr);'
              'gap:32px 20px;padding:26px;justify-items:center">')
    for i, quien in ((1, 'VALEN — 3 de 33'),):
        for modo, tit, sub, cj in filas:
            cuerpo += ('<div>'
                       + carta(i, LW, 'B', True, 0, 'recta', 'colgado', 'E',
                               'combo-r2', 'panel', modo, cj)
                       + f'<div class="tit" style="margin:12px 0 0;'
                       f'font-size:12px">{tit}'
                       '<div style="font-size:10.5px;font-weight:600;'
                       'letter-spacing:.2px;opacity:.55;margin-top:4px;'
                       f'line-height:1.4">{sub}<br>'
                       + ' · '.join(SIGLA.get(k, k) for k in JUEGOS[modo])
                       + '</div></div></div>')
    cuerpo += '</div>'
    GENTE = guardar
    html = ('<!DOCTYPE html><meta charset="utf-8"><style>' + css + '</style>'
            + cuerpo)
    await disparar(html, 3 * W + 2 * 20 + 52, h + 96 + 60,
                   os.path.join(SCR, 'stats.png'), '_stats.html')


async def comparar_tres():
    """Las tres formas del casillero, cada una con el UL en sus dos lugares.

    ⚠️ VAN CARTAS ENTERAS Y NO TIRAS DEL PANEL. Uno de los dos ejes es DONDE
    VA EL UL, y el UL termina debajo del TAG, que vive en la zona derecha:
    una tira de 88 px del panel no lo mostraria y la hoja compararia el eje
    que no cambia.
    """
    modos = ['combo-r1', 'combo-r2', 'combo-r3']
    LW = round(W * 23 / 100)
    h = alto_de('recta')
    sil = "path('%s')" % silueta(0, 'recta')
    css = css_base(h, sil) + ''.join(css_num(m) for m in modos)
    cuerpo = ('<div style="display:grid;grid-template-columns:repeat(3,1fr);'
              'gap:30px 18px;padding:26px;justify-items:center">')
    for donde, comodin in (('panel', 'el UL en el panel, como hoy'),
                           ('tag', 'el UL debajo del TAG')):
        for m in modos:
            cuerpo += ('<div>'
                       + carta(0, LW, 'B', True, 0, 'recta', 'colgado', 'E',
                               m, donde)
                       + '<div class="tit" style="margin:12px 0 0;'
                       f'font-size:12px">{m.upper()[6:]} · {comodin.upper()}'
                       '<div style="font-size:10.5px;font-weight:600;'
                       'letter-spacing:.2px;opacity:.55;margin-top:4px;'
                       f'max-width:{W}px;line-height:1.4">'
                       f'{NUM_MODOS[m]}</div></div></div>')
    cuerpo += '</div>'
    html = ('<!DOCTYPE html><meta charset="utf-8"><style>' + css + '</style>'
            + cuerpo)
    await disparar(html, 3 * W + 2 * 18 + 52, 2 * (h + 92) + 60,
                   os.path.join(SCR, 'tres.png'), '_tres.html')


async def comparar_combos(solo=None):
    """Solo la familia combo, en tira y en el peor caso.

    ⚠️ VAN SOLAS Y NO METIDAS EN LA HOJA GRANDE. Las seis se diferencian por
    detalles de 2-3 px —donde cae la pastilla, cuanto color lleva el circulo—
    y en la hoja de cartas enteras, a 300 px cada una, esas diferencias no se
    ven. Compararlas ahi seria compararlas sin poder verlas.
    """
    # ⚠️ CON NUEVE COLUMNAS YA NO SE COMPARAN DE A DOS. Cuando lo que se
    # decide es una sola cosa —si las etiquetas van o no— conviene mirar solo
    # las que la cambian; --solo recorta la hoja a esas.
    modos = [m for m in NUM_MODOS if m.startswith('combo')]
    if solo:
        modos = [m for m in modos if m in solo]
    LW = round(W * 23 / 100)
    h = alto_de('recta')
    sil = "path('%s')" % silueta(0, 'recta')
    css = css_base(h, sil) + ''.join(css_num(m) for m in modos)
    paso = int((TIRA[1] + 14) * ZOOM_TIRA)
    pie = ''.join(
        f'<div style="width:{paso - 12}px;font-size:11px;'
        'font-weight:600;letter-spacing:.2px;opacity:.6;line-height:1.45;'
        f'color:#EDEDF5">{NUM_MODOS[m]}</div>' for m in modos)
    html = ('<!DOCTYPE html><meta charset="utf-8"><style>' + css + '</style>'
            + tira_peor_caso(LW, modos)
            + '<div style="display:flex;gap:12px;padding:2px 26px 26px">'
            + pie + '</div>')
    await disparar(html, len(modos) * paso + 60,
                   int((TIRA[3] + 46) * ZOOM_TIRA) + 120,
                   os.path.join(SCR, 'combos.png'), '_combos.html')


async def comparar_numeros():
    """Las seis ideas para el numero, una al lado de la otra.

    ⚠️ VAN LAS SEIS EN UNA SOLA PAGINA porque css_num() solo escribe reglas
    colgadas de .lane.MODO: el CSS base es identico para todas, asi que las
    diferencias que se vean son de la idea y no del render.
    """
    # ⚠️ LAS VARIANTES DE combo NO ENTRAN ACA: esta hoja compara IDEAS, y
    # combo-baja contra combo-oscura no son dos ideas, son dos ajustes de la
    # misma. Mezcladas, la hoja pasaba de 7 cartas a 13 y las siete ideas
    # dejaban de poder verse juntas. Van en --combos, en tira y de cerca.
    ideas = {m: d for m, d in NUM_MODOS.items() if not m.startswith('combo-')}
    LW = round(W * 23 / 100)
    h = alto_de('recta')
    sil = "path('%s')" % silueta(0, 'recta')
    css = css_base(h, sil) + ''.join(css_num(m) for m in ideas)
    cuerpo = ('<div style="display:grid;grid-template-columns:repeat(3,1fr);'
              'gap:34px 18px;padding:26px;justify-items:center">')
    for m, desc in ideas.items():
        cuerpo += ('<div>'
                   + carta(0, LW, 'B', True, 0, 'recta', 'colgado', 'E', m)
                   + f'<div class="tit" style="margin:14px 0 0;font-size:13px">'
                   f'{m.upper()}<div style="font-size:10.5px;font-weight:600;'
                   f'letter-spacing:.2px;opacity:.55;margin-top:4px;'
                   f'max-width:{W}px;line-height:1.4">{desc}</div></div></div>')
    cuerpo += '</div>' + tira_peor_caso(LW, list(ideas))
    html = ('<!DOCTYPE html><meta charset="utf-8"><style>' + css
            + '</style>' + cuerpo)
    # ⚠️ EL ANCHO LO PIDE LA TIRA, NO LA GRILLA. transform:scale no cambia el
    # ancho de LAYOUT, asi que la tira mide 638 para el flujo y pinta 1276: con
    # el viewport de la grilla el full_page se estiraba solo y salia una imagen
    # de 5694 px con medio lienzo vacio.
    ancho = max(3 * W + 2 * 18 + 52,
                int(len(ideas) * (TIRA[1] + 14) * ZOOM_TIRA) + 60)
    filas = -(-len(ideas) // 3)
    await disparar(html, ancho,
                   filas * (h + 74) + 60 + int((TIRA[3] + 46) * ZOOM_TIRA) + 90,
                   os.path.join(SCR, 'numeros.png'), '_numeros.html')


# el panel recortado y agrandado: 88 px de ancho por 308 de alto, desde el
# techo del panel hasta el sello UL
TIRA = (2, 88, 74, 308)
ZOOM_TIRA = 2.0


def tira_peor_caso(LW, modos=None):
    """Los seis paneles al doble, con SEIS casilleros.

    ⚠️ EL PEOR CASO NO ES EL DE NADIE. Konan tiene cuatro casilleros y con
    cuatro las seis ideas entran comodas: la de hoy sobra 97.9 px hasta el
    sello. Lo que decide es la carta de seis —bandera, rango, servidor, crew,
    nacional y mundial— y esa no existe todavia, porque la Copa de Naciones
    arranca en T2. Hay que simularla o la hoja miente por omision.

    ⚠️ Y SE RECORTA EN HTML, NO CON PIL. El recorte es un overflow:hidden con
    la carta corrida adentro, asi que sale del mismo render que la hoja de
    arriba y no puede desincronizarse de ella.
    """
    global TROFEOS, GENTE
    g0, t0 = GENTE[0], TROFEOS
    GENTE = [g0[:4] + ('KS',) + g0[5:]] + list(GENTE[1:])
    TROFEOS = [('nac', 'NACIONAL', 1), ('int', 'MUNDIAL', 2)]
    x, an, y, al = TIRA
    fila = ''
    for m in (modos or NUM_MODOS):
        fila += (f'<div><div style="width:{an}px;height:{al}px;'
                 'overflow:hidden;position:relative">'
                 f'<div style="position:absolute;left:{-x}px;top:{-y}px">'
                 + carta(0, LW, 'B', True, 0, 'recta', 'colgado', 'E', m)
                 + '</div></div>'
                 f'<div class="tit" style="margin:10px 0 0;font-size:11px">'
                 f'{m.upper()}</div></div>')
    GENTE, TROFEOS = [g0] + list(GENTE[1:]), t0
    # ⚠️ inline-flex Y NO flex: un flex de bloque ocupa el ancho del body, y al
    # escalarlo x2 el documento se iba a 2490 px con la mitad vacia. Lo que se
    # escala es la caja de LAYOUT, asi que primero tiene que encogerse al
    # contenido.
    # ⚠️ inline-flex Y NO flex: un flex de bloque ocupa el ancho del body, y al
    # escalarlo x2 el documento se iba a 2490 px con la mitad vacia. Lo que se
    # escala es la caja de LAYOUT, asi que primero tiene que encogerse al
    # contenido.
    #
    # ⚠️ Y VA ADENTRO DE UNA CAJA CON ALTO PROPIO, por lo mismo pero en la otra
    # dimension: la tira mide 308 para el flujo y pinta 616, asi que lo que
    # venga despues arranca a los 308 y le queda ENCIMA. Paso con los pies de
    # la hoja de combos, que salieron atravesando los paneles.
    return (f'<div style="height:{int((al + 46) * ZOOM_TIRA)}px">'
            f'<div style="transform:scale({ZOOM_TIRA});transform-origin:'
            'top left;display:inline-flex;gap:14px;padding:16px 13px">'
            + fila + '</div></div>')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--lane', type=float, default=PRESET['lane'])
    ap.add_argument('--marco', default=PRESET['marco'], choices=list(MARCOS))
    ap.add_argument('--acorta', type=int, default=PRESET['acorta'],
                    help='cuanto se sube el remate de abajo, en px')
    ap.add_argument('--remate', default=PRESET['remate'], choices=list(REMATES))
    ap.add_argument('--iconos', default=PRESET['iconos'],
                    choices=('colgado', 'centrado', 'repartido'))
    ap.add_argument('--trofeo', default=PRESET['trofeo'],
                    choices=('A', 'B', 'C', 'D', 'E'))
    # ⚠️ EL DEFAULT ES combo-r2 DESDE QUE DLX LO ELIGIO: circulo de 34 con
    # aro del rango, sin etiquetas, y la pastilla MONTADA en el borde con su
    # centro sobre las 4 en punto. Con el UL donde esta hoy, en el panel. 'tinta' sigue
    # existiendo porque es contra lo que se midio todo, y porque
    # herramientas/hueco_numeros.py solo tiene sentido en ese modo: ahi el
    # numero se pega a la tinta de cada icono, y en las variantes con
    # contenedor se pega al contenedor.
    ap.add_argument('--num', default=PRESET['num'], choices=list(NUM_MODOS),
                    help='como se resuelve el numero del casillero')
    ap.add_argument('--comparar', action='store_true')
    ap.add_argument('--numeros', action='store_true',
                    help='hoja con todas las ideas para el numero')
    ap.add_argument('--combos', action='store_true',
                    help='solo la familia combo, en tira')
    ap.add_argument('--panel', default=PRESET['panel'], choices=list(PANEL_TEX),
                    help='la textura del panel izquierdo')
    ap.add_argument('--chip', default=PRESET['chip'], choices=list(CHIPS),
                    help='la forma de los chips de duelos')
    ap.add_argument('--titulos', action='store_true',
                    help='el TAG en cartas y las estrellas del mundial')
    ap.add_argument('--chips', action='store_true',
                    help='las seis formas del chip')
    ap.add_argument('--pie', action='store_true',
                    help='los chips de duelos y que va abajo')
    ap.add_argument('--ovr', action='store_true',
                    help='el numero grande a la izquierda o a la derecha')
    ap.add_argument('--tags', action='store_true',
                    help='todos los TAG y sus tres niveles')
    ap.add_argument('--columna', action='store_true',
                    help='crew si o no, y etiquetas si o no')
    ap.add_argument('--paneles', action='store_true',
                    help='hoja con las texturas del panel')
    ap.add_argument('--juego', default=PRESET['stats'], choices=list(JUEGOS),
                    help='que seis stats van abajo')
    ap.add_argument('--stats', action='store_true',
                    help='los dos juegos de stats de abajo')
    ap.add_argument('--tres', action='store_true',
                    help='las tres formas del casillero x los dos UL')
    ap.add_argument('--solo', default='',
                    help='con --combos, recorta a estas variantes')
    a = ap.parse_args()
    if a.titulos:
        asyncio.run(comparar_titulos())
    elif a.chips:
        asyncio.run(comparar_chips())
    elif a.pie:
        asyncio.run(comparar_pie())
    elif a.ovr:
        asyncio.run(comparar_ovr())
    elif a.tags:
        asyncio.run(comparar_tags())
    elif a.columna:
        asyncio.run(comparar_lane())
    elif a.paneles:
        asyncio.run(comparar_paneles())
    elif a.stats:
        asyncio.run(comparar_stats())
    elif a.tres:
        asyncio.run(comparar_tres())
    elif a.combos:
        asyncio.run(comparar_combos(
            [x.strip() for x in a.solo.split(',') if x.strip()]))
    elif a.numeros:
        asyncio.run(comparar_numeros())
    elif a.comparar:
        asyncio.run(comparar())
    else:
        asyncio.run(una(a.lane, a.marco, a.acorta, a.remate, a.iconos,
                        a.trofeo, a.num, a.juego, a.panel))


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
