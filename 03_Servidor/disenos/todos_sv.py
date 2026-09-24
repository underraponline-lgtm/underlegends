"""La carta como esta hoy, en LOS DIEZ SERVIDORES.

⚠️ ESTA NO ES LA VERSION FINAL. Falta el marco, y los numeros de la columna
no existen todavia en ningun pool.

QUE SE VE ACA QUE NO SE VE EN UNA SOLA CARTA. Cada pieza se decidio mirando
uno o dos servidores; esta hoja es la unica que muestra si aguantan en los
diez a la vez:

    el brillo de arriba sale del color PROPIO, y ese color va de croma 42
    (FFA) a 194 (DRA)
    el escudo lleva contorno de dos tonos porque el 61% cae fuera de la carta
    la figura del rango se cruza con el fondo del servidor: 80 combinaciones
    el lavado de la columna repinta EL MATERIAL de cada carta, o sea que es
    un color distinto en cada una


⚠️ TRES SERVIDORES NO TIENEN GENTE, Y NO ES QUE NADIE JUEGUE AHI.
FFA, EFA y RZ no tienen columna en el Sheet, y como `sv` sale del argmax de
las 7 que si la tienen, NADIE PUEDE QUEDAR ASIGNADO a esos tres. Sus cartas
hoy no le tocan a ninguna persona. Van con nombre inventado y marcadas.

Los otros siete llevan gente y datos REALES —nombre, rango, pais y pos_sv—
salvo los cuatro numeros de la columna, que no existen.
"""
import asyncio
import base64
import hashlib
import json
import os
import re
import sys

from playwright.async_api import async_playwright

# 🔴 SE CALCULA, NO SE CLAVA. Acá había una ruta absoluta a la máquina de
# Dlx, y este archivo **no es exploración**: `03_Servidor/generar.py` lo
# importa, así que era la carta Servidor entera atada a una máquina.
# `CLAUDE.md` afirma lo contrario
# —*«las rutas son relativas al script, así que el proyecto se puede mover
# de lugar»*— y para las otras tres cartas es cierto.
#
# ⚠️ NO FALLABA ACÁ, Y POR ESO DURÓ. En esta PC la ruta existe, así que los
# 85 scripts de `disenos/` y el generador andaban. Lo destapó la primera
# corrida del ciclo en Actions que tuvo trabajo de verdad: doce cartas de
# trece con `FileNotFoundError` y una ruta de Windows adentro de un runner
# Linux. Un simulacro no lo encuentra —no llega a dibujar— y leer el diff
# tampoco.
SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(os.path.dirname(SCR))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun.siluetas import PICO
from comun import emblema, divisor as DIV, brillo as BRI, nombre as NOM
from comun import rangos as RG, pie as PIE, iconos as ICO
from comun import marco as MK, titulos as TIT
from los_nueve import defs
from paneles import borde
import avatares

RG.verificar()
W, MARGEN = PICO.w, emblema.MARGEN
DEFS = defs()
BASE_Y = DIV.Y_EXTREMOS * PICO.h
SUBE = DIV.RECORRIDO * PICO.w * 1.3
# ⚠️ LA FOTO TERMINA EN LA CIMA DEL DIVISOR, no 32 px por debajo. Antes
# llegaba a BASE_Y+14 = 283 y el panel arranca en su cima, 250.6: o sea que
# el panel tapaba 32.4 px de avatar en el centro y 14.2 en los bordes. Y no
# era transparencia: el panel repinta el material, asi que ahi habia foto
# TAPADA. Ademas la mascara de la foto recien empieza a desvanecer en el
# 72%, o sea DESPUES de que el panel ya empezo.
# Dlx: "que el panel de abajo solo se quede abajo, que no se sobreponga
# sobre el avatar".
ALTO_FOTO = round(BASE_Y) + 4
ALTO = PICO.h + MARGEN + 20
PTS = [tuple(float(v) for v in p.split(','))
       for p in re.findall(r'(-?[\d.]+,-?[\d.]+)', PICO.d)]
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)
VELO = 'linear-gradient(180deg,rgba(0,0,0,.30),rgba(0,0,0,.64))'
# se desvanece antes, porque ahora termina justo donde arranca el panel
M_FOTO = ('linear-gradient(180deg,#000 0%,#000 84%,rgba(0,0,0,.55) 95%,'
          'transparent 100%)')
_EST = json.load(open(os.path.join(BASE, 'datos', 'estrellas.json'),
                      encoding='utf-8'))['estrellas_por_servidor']
LAVADO = (13, 25, 43)

# ⚠️ los PODIOS contienen a los CAMPEONATOS: pod = oro+plata+bronce. Por eso
# ninguna fila tiene menos podios que campeonatos.
# ⚠️ LA MUESTRA CUBRE LOS 10 SERVIDORES Y LOS 8 RANGOS A LA VEZ, y las dos
# cosas se eligen juntas. Con gente al azar la mitad saldria TFC —79 de 138
# son de ahi— y no se veria como se comporta el color en los demas; con un
# solo rango no se verian las ocho piedras.
#
# ⚠️ LOS RANGOS DE ACA SON INVENTADOS y no coinciden con el pool: Kude es B en
# la Liga y aca va de D, Marcos es C y va de E. Es una hoja de diseño, no una
# carta de nadie. Los reales salen del pool cuando se generen las 138.
#
#  nombre     sv     rg    cc  pos de  tot ovr pod tit  racha   duelos  ev  sin foto
GENTE = [
    ('KONAN',   'TWR', 'SSS', 'co', 1, 1, 18, 92, 11, 4, '9/14', '11/15', 34, False),
    ('AXINU',   'TFC', 'SS',  'co', 3, 2, 79, 84,  8, 2, '7/11',  '8/12', 27, False),
    ('NFK',     'URBF','S',   'co', 1, 1, 12, 80,  6, 2, '6/10',  '7/11', 24, False),
    ('BLOODY',  'FFA', 'A',   'co', 7, 5, 31, 74,  5, 1, '5/9',   '6/10', 21, False),
    ('WALKER',  'SR',  'B',   'co', 8, 6, 22, 69,  3, 1, '4/7',   '5/9',  18, False),
    ('METEORO', 'FTN', 'C',   'bo', 4, 2, 11, 62,  1, 0, '3/5',   '2/6',  13, False),
    ('KUDE',    'FRZ', 'D',   'ar', 2, 1,  5, 56,  1, 0, '2/5',   '3/7',  10, False),
    ('MARCOS',  'DRA', 'E',   'es', 1, 1,  1, 48,  0, 0, '1/4',   '2/5',   9, False),
    ('—',       'EFA', 'B',   'pe', 4, 3,  9, 67,  2, 0, '4/8',   '5/9',  16, True),
    ('—',       'RZ',  'C',   'cl', 6, 4, 14, 60,  1, 0, '2/5',   '1/4',  12, True),
]


def y(v):
    return v + MARGEN


def b64(p):
    return ('data:image/png;base64,'
            + base64.b64encode(open(p, 'rb').read()).decode())


def camino(n=90):
    xi, xd = borde(BASE_Y, 'izq'), borde(BASE_Y, 'der')
    return [(xi + (xd - xi) * (i / n), BASE_Y - DIV.altura(i / n) * SUBE)
            for i in range(n + 1)]


# ⚠️ LA CAJA DE RECORTE, MEDIDA SOBRE LOS DIEZ FONDOS. Ver recortar().
# Lienzo 300x487 a escala 4 = 1200x1948; la carta usa 1200x1839.
CAJA_SET = (0, 29, 1200, 1868)


def recortar(archivos, caja=CAJA_SET):
    """Le saca al PNG el margen transparente que no dibuja nada.

    ⚠️ ESTO NO ES COSMETICA: ES TAMAÑO EN DISCORD. Medido en el servidor real
    —ver docs/discord_tamanos.md—, el feed de Discord recorta por ALTO y ajusta
    el ancho segun la proporcion del ARCHIVO. O sea que cada pixel transparente
    de mas arriba o abajo hace la carta mas chica en el chat.

    La Servidor traia 27 px de aire —7.3 arriba y 20 abajo— sobre 487 de
    archivo. Sacarlos la lleva de 1:1.62 a 1:1.53 sin tocar el dibujo.

    ⚠️ SE RECORTA A UNA CAJA COMUN, NO CADA CARTA A LA SUYA. Los servidores
    tienen distinta cantidad de estrellas, asi que su tinta empieza a alturas
    distintas: recortando cada una a su propio borde saldrian de tamaños
    distintos y dejarian de verse como un set. Se toma la union de las diez.

    🔴 Y DURANTE UN TIEMPO TOMABA LA UNION DE **LA TANDA**, NO DE LAS DIEZ.
    La frase de arriba ya decia "de las diez"; el codigo medía los archivos
    que le pasaban. Con una tanda de un servidor con estrella salia 1200x1839
    y con una sin estrella 1200x1768 — la MISMA carta, dos tamaños, y en
    Discord eso es tamaño en el chat. Medido: `sv_konan.png` (TWR, sin
    estrella) daba 1768 y `sv_marcos.png` (DRA, con estrella) 1839.

    Es la forma que mas veces rompio este proyecto: la decision existia en un
    comentario y el codigo leia otra cosa. Y no se ve nunca mirando una tanda,
    porque dentro de una tanda todas salen iguales.

    Ahora la caja es FIJA y esta medida sobre los diez fondos x dos personas
    (una con crew, una sin), a escala 4:

        con estrella    DRA FTN SR TFC   y0 =  29
        sin estrella    los otros seis   y0 = 100
        abajo y ancho   iguales en los diez

    Pasar `caja=None` vuelve al comportamiento viejo — util para explorar un
    fondo nuevo, no para emitir cartas.
    """
    from PIL import Image
    import numpy as np
    if caja is None:
        cajas = []
        for f in archivos:
            a = np.array(Image.open(f).convert('RGBA'))[:, :, 3] > 12
            ys, xs = np.where(a.any(axis=1))[0], np.where(a.any(axis=0))[0]
            cajas.append((xs[0], ys[0], xs[-1] + 1, ys[-1] + 1))
        caja = (min(c[0] for c in cajas), min(c[1] for c in cajas),
                max(c[2] for c in cajas), max(c[3] for c in cajas))
    x0, y0, x1, y1 = caja
    for f in archivos:
        Image.open(f).crop((x0, y0, x1, y1)).save(f)
    return (x1 - x0), (y1 - y0)


# ── CUANTO MIDE CADA CIRCULO SEGUN CUANTOS HAYA ──────────────────────────
# ⚠️ EL LARGO DEL GRUPO ES LO QUE SE MANTIENE, no el diametro. Dlx: "que sean
# mas grandes dependiendo de cuantos circulos hayan, porque no todos van a
# estar en una crew". Con diametro fijo, una fila de 2 se ve raquitica al lado
# de una de 4; con el grupo de largo parejo, las dos ocupan lo mismo y la
# carta no cambia de peso segun quien sea.
#
# ⚠️ EL TOPE NO ES ESTETICO, ES VERTICAL, Y ESTA MEDIDO. Del final del nombre
# (292) al tope del TAG (341.5) hay 49.5 px. La tinta de la fila es el circulo
# MAS la pastilla del numero, que cuelga ~8:
#
#     d=32 -> tinta 40, sobran  9.5
#     d=35 -> tinta 43, sobran  6.5   <- el maximo con aire decente
#     d=42 -> tinta 50, sobran -0.5   <- PISA EL TAG
#
# Yo habia puesto 42 razonando "hay lugar" sin medirlo, y no entraba. Es el
# mismo error de medir la caja en vez de la tinta que ya aparecio tres veces
# en esta carta.
#
# ⚠️ CONSECUENCIA A SABIENDAS: con 1, 2 o 3 circulos el tope manda y los tres
# casos dan 35. El "mas grandes segun cuantos haya" recien se nota al llegar a
# 4. Para que 2 circulos fueran de verdad mas grandes habria que bajar el TAG
# o subir el nombre, y eso ya se acomodo con Dlx.
ANCHO_GRUPO = 150       # lo que ocupa la fila entera, con sus huecos
# ⚠️ CUANTO DEL CIRCULO LLENA LA FIGURA DEL RANGO. Era .56 y la figura
# quedaba flotando: al lado de una bandera y un escudo, que llegan al borde,
# una figura chica en el medio se lee como un punto y no como una pieza.
GEMA_LLENA = .74
# ⚠️ CUANTO AIRE QUEDA ENTRE LA TINTA Y EL BORDE DEL CIRCULO, como fraccion
# del radio. Dlx: "asegurate que el icono de los rangos no sobresalgan o
# toquen el borde de su circulo".
#
# Medido, dos de las ocho lo hacian: el BRONCE se salia —un triangulo tiene
# las esquinas de abajo lejisimos del centro— y el circulo lo RECORTABA, que
# es peor que verse mal porque el corte es limpio y parece parte del dibujo.
# Y la AMATISTA quedaba a 0.94 px, que a este tamaño es rozar.
#
# El tope no empareja los radios, solo baja al que se pasa: emparejarlos
# dibujaria la estrella y el triangulo tan grandes como el circulo macizo,
# que es justo lo que ESCALA existe para evitar.
HOLGURA = .12
DIAM_MAX, DIAM_MIN = 35, 26


def diametro(n):
    if n <= 0:
        return DIAM_MAX
    # el hueco es proporcional al diametro, asi que se resuelve junto
    d = ANCHO_GRUPO / (n + (n - 1) * 0.30)
    return round(max(DIAM_MIN, min(DIAM_MAX, d)))


def gema_fig(rg, lado, sufijo):
    """La figura del rango como ICONO. Es rangos.icono(), no una copia.

    ⚠️ ANTES ERA UN RELLENO PLANO Y ESO LA ROMPIA A ESTE TAMAÑO. Yo la habia
    dibujado aca —un `path` con `fill` y nada mas— y a 15 px se leia como
    MANCHA: se veia que habia algo de color, no QUE forma tenia. Y la forma
    es lo unico que distingue un rango de otro; rangos.py ya lo aprendio a
    los golpes cuando el primer juego de figuras se confundia.

    Dlx: "haz que el icono sobresalga mas, que el diseño del icono del rango
    correspondiente sea mas detallado".

    Ahora es LA MISMA PIEZA que lleva la Competitiva: degrade del acento,
    facetas talladas segun el material —amatista, diamante, oro, rubi,
    esmeralda, zafiro, plata, bronce—, filo negro por fuera y filo blanco por
    dentro. Son 33 caminos y NO se copian: viven en comun/rangos.py y de ahi
    salen las dos cartas.

    `lado` es lo PINTADO, no la caja: icono() agranda el envoltorio solo. Y
    `sufijo` tiene que ser unico por carta, porque adentro hay un gradiente
    con id y dos SVG con el mismo id se pisan.
    """
    return RG.icono(rg, lado, sufijo, r_max=lado / GEMA_LLENA / 2 * (1 - HOLGURA))


def gema_pie(rg, pos, tot, sufijo):
    """Abajo: CIRCULO, porque al lado tiene los tres circulos del pie.

    ⚠️ EL CONTINENTE NO ES EL MISMO ARRIBA Y ABAJO, y es a proposito. Abajo la
    gema convive con la fila de circulos, asi que un circulo rima; arriba
    convive con el numero y la pastilla, que son rectangulares, y ahi el rombo
    corta mejor. Dlx pidio justamente eso: "el C vaya abajo… y arriba al
    costado del numero quizas el B".

    ⚠️ EL PUESTO ES DENTRO DEL RANGO Y DEL SERVIDOR. Medido: de las 30
    combinaciones rango x servidor que existen, 13 tienen menos de 3 personas
    —el 12% de las cartas— y 9 son de una sola. Esas van sin numero, por el
    mismo umbral de 3 que rige el pie.
    """
    acc = RG.ACENTO[rg]
    num = (f'<b class="gnum" style="background:{acc}">{pos}</b>'
           if tot >= 3 else '')
    return (f'<div class="gema pie" style="border-color:{acc}">'
            f'{gema_fig(rg, PIE.LADO * .58, sufijo)}{num}</div>')


def gema_arriba(rg, sufijo):
    """Arriba: ROMBO, al lado del numero. El icono va contra-rotado."""
    acc = RG.ACENTO[rg]
    return (f'<div class="gema top" style="border-color:{acc}">'
            f'<u>{gema_fig(rg, 15, sufijo)}</u></div>')


def crew_img(nombre):
    """El logo de la crew si existe; si no, sus dos primeras letras.

    ⚠️ HAY DOS DE DIECISIETE. Follombia y KS son las unicas con archivo, y
    Dlx pidio que se priorice la que tiene imagen. Las otras quince siguen en
    letras, que es lo que hay hasta que existan los PNG — no es un estilo,
    es un placeholder, y conviene que se note que lo es.

    Los archivos salen de herramientas/logos_crew.py y vienen CON SU COLOR y
    con filo oscuro, sin fondo: el fondo lo pone la carta. El filo no es
    adorno — el rojo de la bandera de Follombia da 1.04 de contraste contra el
    circulo de URBF y se perderia sin el. Esta medido en ese script.
    """
    p = os.path.join(BASE, 'comun', 'logos_crew', '%s.png' % nombre)
    if os.path.exists(p):
        return '<img src="%s">' % b64(p)
    return ('<span style="font-weight:900;font-size:.62rem;color:#fff;'
            'line-height:1">%s</span>' % nombre[:2].upper())


def panel_pie(pts):
    # el camino vive en comun/divisor.py: estaba copiado en ocho
    # scripts, todos con el mismo bug de la punta perdida
    return DIV.panel(pts, PTS, W, dy=MARGEN)


# ── LA ESCALERA DEL SERVIDOR, forma B ────────────────────────────────────
# ⚠️ NO ESTA DECIDIDA: se dibuja para verla en la carta. Si se descarta, se
# borra esto y se pone DESPL_ESC en 0.
#
# Cuelga del OVR, que mide PUNTOS EN ESE SERVIDOR sobre un tope FIJO. Los dos
# datos salen de ovr_que_mide.py y los dos importan:
#
#   · puntos, porque partido por servidor el Sheet tiene UN ingrediente de
#     los cinco del OVR de temporada. Los otros cuatro son totales de la
#     persona y saldrian iguales en sus diez cartas.
#   · tope fijo, porque un tope sacado del pool BAJA a las 138 cuando el
#     puntero mejora, y un escalon que se cae es un reclamo.
#
# Los cortes no son redondos: con tope 60 y raiz la mediana de la gente cae
# en 51-62, asi que los escalones se abren ahi. En 70-90 estarian vacios.
#
# ⚠️ LOS NOMBRES SON DE RELLENO. Los elige Dlx, no la medicion.
ESCALERA = [(85, 'LEYENDA'), (72, 'MAESTRO'), (62, 'VETERANO'),
            (52, 'HABITUAL'), (0, 'NOVATO')]

# ── DE QUE LADO VA LA COLUMNA ────────────────────────────────────────────
# Dlx: "quizas tambien probar a ver como se ve en el lado izquierdo todo eso".
#
# ⚠️ Y NO ES SOLO GUSTO: LAS OTRAS DOS CARTAS YA LO DECIDIERON. La Temporada
# pone su bloque de OVR en left:20px (01_Temporada/normal_v3.css:88) y la
# Competitiva en left:8% (02_Competitivo/v2/card.css:42). La Servidor es la
# UNICA de las tres con el numero a la derecha.
#
# Se maneja con un interruptor para poder mirar las dos en vez de discutirlas.
# ⚠️ LA GEMA APARECE EN DOS LADOS, y el de arriba esta a prueba. Dlx: "que
# aparezca en 2 lados: al costado del numero grande de arriba a la derecha, y
# abajo para medir la posicion dentro de ese rango".
#   abajo   circulo con el PUESTO dentro de su rango en ese servidor
#   arriba  rombo al lado del numero, que se achica para hacerle lugar
# ⚠️ SE PROBO Y SE DESCARTO. La comparativa con y sin —gema_arriba_cmp.png—
# la dejo afuera: obligaba a bajar el numero de 3rem a 2.6 y repetia el rango,
# que ya lo dice la pastilla justo debajo. Queda el interruptor por si se
# quiere volver a mirar, pero apagado por defecto.
GEMA_ARRIBA = '--con-gema-arriba' in sys.argv

IZQ = '--izq' in sys.argv
LADO_COL = 'left' if IZQ else 'right'

# ⚠️ DOS MARGENES DISTINTOS, NO UNO. Dlx: "haz que eso este 6px dentro, pero
# manten un poco mas cerca del costado la columna de las estadisticas
# (exceptuando el titulo y el numero)".
#
# O sea que el bloque de arriba —numero y pastilla— y las cinco filas dejan de
# compartir margen. Y tiene sentido: el numero pesa mucho mas, asi que pegado
# al filo se lee como si se fuera de la carta, mientras que las filas son
# chicas y ganan aire para la foto si se corren al borde.
#
# ⚠️ PERO ENTONCES YA NO COMPARTEN EJE, y eso hay que decidirlo a sabiendas:
# el numero queda 11 px mas adentro que sus propias filas. Se ve como dos
# bloques alineados a cosas distintas, que es exactamente lo que se pidio.
SEP_NUM = 26        # numero + pastilla: 6 px mas adentro que antes
SEP_FILAS = 19      # las cinco filas: mas cerca del costado

# ── LA LINEA QUE SEPARA LA FOTO DEL PANEL ────────────────────────────────
# Dlx: "podrias hacer que esa linea sea el mismo tamaño del marco de la
# tarjeta? y quizas tambien el mismo toque de degradado vs otra comparacion
# que sea full blanco?".
#
# ⚠️ "EL MISMO TAMAÑO DEL MARCO" TIENE DOS RESPUESTAS Y DAN DISTINTO. El
# marco se dibuja con stroke-width 9 PERO recortado a la silueta, asi que la
# mitad de afuera no se pinta: lo que se ve son 4.5 px. La linea del divisor
# no esta recortada, asi que sus 1.9 se ven enteros.
#
#   copiar el NUMERO      -> 9 px, o sea el DOBLE de grueso que el marco
#   copiar lo que SE VE   -> 4.5 px
#
# Por eso se comparan las dos y no una.
GROSOR_MARCO = 9.0
DIV_OPS = {
    'A': (1.9, 'acento', .90),      # como esta hoy
    'B': (4.5, 'acento', .95),      # lo que se ve del marco
    'C': (9.0, 'acento', .95),      # el numero del marco
    'D': (4.5, 'degrade', .95),     # el degrade del marco
    'E': (4.5, 'blanco', .95),      # blanco pleno
    'F': (4.5, 'degrade2', .95),    # el degrade ARREGLADO
}
# ⚠️ EL DEFAULT ES F Y ESTUVO EN 'A' DE MAS. Todas las hojas desde el 20/08 se
# corrieron con --div=F —todos_sv_dF, _dF_pB, _dF_pC, _dF_pD— y la comparacion
# de POSICION de la pastilla se hizo ENCIMA de F. O sea que F era la decision y
# el default nunca se movio, igual que POS_OP si se movio a D cuando Dlx dijo
# "2 tercios me gusta". Un default que no es la decision hace que el proximo
# que corra el script sin argumentos crea que la carta es otra — y eso paso:
# `03_Servidor/generar.py` nacio dibujando la linea de A.
#
# Que separa a F de las otras, mirado sobre Juasmio (TFC) y Meteoro (FTN):
#
#   A  1.9 px del acento. Es una raya, no la pieza que cierra la U.
#   D  4.5 con el degrade DEL MARCO. Su parada del medio es
#      encender(propio,.30), que en una horizontal cae en el CENTRO contra el
#      panel del MISMO color: el medio de la linea desaparece.
#   F  4.5 con su propio degrade. El medio sube hacia el BLANCO con tono() y
#      las DOS PUNTAS salen del marco evaluado donde la linea lo toca, asi que
#      empalma en vez de cortarse. Es lo que Dlx pidio tres veces.
DIV_OP = next((a.split('=')[1] for a in sys.argv if a.startswith('--div=')), 'F')
# ── DONDE VA LA PASTILLA DEL PUESTO ──────────────────────────────────────
# Dlx: "eso de las posiciones quizas lo podamos poner de otra manera porque
# mira el pais de colombia a penas se nota".
#
# ⚠️ Y NO ES CUESTION DE GUSTO: LA PASTILLA NO ESCALABA. El circulo si —lo
# decide diametro(n)— pero la pastilla estaba clavada en px, asi que al
# entrar la crew y la gema el circulo bajo de 35 a 26 y la pastilla se quedo
# igual. Sobre 26 px de bandera tapa el ancho entero y casi la mitad del
# alto: de Colombia solo sobrevive el amarillo, que es lo que Dlx vio.
#
# El escalado se aplica en LAS CUATRO opciones porque es el arreglo, no una
# variante. Lo que se compara es DONDE se apoya:
#
#     A  centrada encima, como hoy
#     B  en la esquina de abajo a la derecha
#     C  entera por debajo del circulo, sin tapar nada
#     D  centrada pero mas afuera, dos tercios abajo
POS_OPS = {'A': 'centro', 'B': 'esquina', 'C': 'afuera', 'D': 'baja'}
# ⚠️ EL DEFAULT ES D. Dlx eligio "2 tercios me gusta", que es la opcion
# "dos tercios afuera": la pastilla apoya en el borde del circulo en vez de
# sentarse encima. Tapa 4.7% del disco contra el 21% que tapaba antes.
POS_OP = next((a.split('=')[1] for a in sys.argv if a.startswith('--pos=')), 'D')
POS_MODO = POS_OPS[POS_OP]
# ⚠️ CADA OPCION SUBE LA FILA LO QUE NECESITA, y sin esto la comparacion
# estaria arreglada. Medido con la fila donde esta hoy: A deja 0.5 px de aire
# contra el halo del TAG y B deja 1.0, pero C se pisa 4.2 y D 1.4 — o sea que
# C y D se verian rotas por una razon que NO es la idea que proponen. Arriba
# sobran 13.6 px contra el nombre, asi que la fila tiene de donde subir.
# ⚠️ AHORA SON CORRECCIONES CHICAS Y ESO ES PORQUE PIE.Y_FILA SE MOVIO. La
# fila se recentro para la opcion ELEGIDA —"baja"— repartiendo parejo el
# hueco entre el nombre y el UL, asi que esa no necesita correccion: es 0.
# Las otras tres cuelgan distinto y se corrigen por la MITAD de la diferencia,
# que es lo que mantiene los dos huecos iguales.
#
#     modo      cuanto cuelga a d=31    correccion
#     centro       2.0 px (fijo)          baja 1.3
#     esquina      1.9 px                 baja 1.4
#     afuera       8.1 px                 sube 1.7
#     baja         4.7 px                 ninguna
POS_SUBE = {'centro': -1.3, 'esquina': -1.4, 'afuera': 1.7, 'baja': 0}
# lo que cuelga la pastilla, como fraccion del diametro. Va a pie.alto_fila()
# para que el self-check mida la fila que de verdad se dibuja.
POS_CUELGA = {'centro': .065, 'esquina': .060, 'afuera': .26, 'baja': .15}
Y_FILA = None           # se resuelve abajo, cuando PIE ya esta importado
DIV_GROSOR, DIV_COLOR, DIV_OPAC = DIV_OPS[DIV_OP]
# el sufijo solo marca lo que se APARTA del preset; sin gema arriba es el
# default, asi que no lleva marca
SUF = (('_izq' if IZQ else '') + ('' if DIV_OP == 'A' else '_d' + DIV_OP)
       + ('' if POS_OP == 'D' else '_p' + POS_OP)
       + ('_ga' if GEMA_ARRIBA else ''))


_POS_CSS = {
    # A — como hoy: centrada y apoyada encima del borde de abajo
    'centro': """.ar > b{left:50%;bottom:-2px;transform:translateX(-50%)}""",
    # B — a la esquina. Tapa un cuarto de circulo en vez de la franja del
    # medio, y sobre todo NO tapa el centro, que es donde una bandera tiene
    # su dibujo.
    'esquina': """.ar > b{right:calc(var(--d) * -.10);
  bottom:calc(var(--d) * -.06)}""",
    # C — entera por debajo. La imagen queda intacta; lo que cuesta es ALTO,
    # que es lo que escasea: entre el nombre y el TAG hay 6.5 px de aire.
    'afuera': """.ar > b{left:50%;bottom:calc(var(--d) * -.26);
  transform:translateX(-50%)}""",
    # D — el punto medio: dos tercios afuera. Toca solo el borde del circulo.
    'baja': """.ar > b{left:50%;bottom:calc(var(--d) * -.15);
  transform:translateX(-50%)}""",
}
POS_CSS = _POS_CSS[POS_MODO]
Y_FILA = PIE.Y_FILA - POS_SUBE[POS_MODO]


def x_esc():
    """El centro del bloque de arriba, para lo que se centra con translate."""
    return (SEP_NUM + PIE.COL_ANCHO / 2 if IZQ
            else W - SEP_NUM - PIE.COL_ANCHO / 2)
# ⚠️ EL DESPLAZAMIENTO YA NO VIVE ACA. La pastilla corre las filas 8 px, y
# eso estaba escrito como DESPL_ESC en este archivo mientras COL_Y0 vivia en
# comun/pie.py: el self-check del pie informaba 30.2 px de hueco cuando el
# real era 22.2. Ahora COL_Y0 vale 126 y el self-check dice la verdad.


# ⚠️ EL SELLO SALE DE UNA CONSTANTE, no esta escrito adentro del HTML. Dlx
# dijo que tiene que decir T1 o PRE segun la temporada, asi que el dia que
# cambie se toca aca y no en el markup. Cuando el pool traiga la temporada,
# esto pasa a leerse de ahi en vez de estar fijo.
# ⚠️ ARRANCA EN PRE Y PASA A T1 CUANDO EMPIECE LA TEMPORADA. Dlx: "la de
# temporada y competitiva se pueden sacar de PRE, pero ese PRE sera T1 cuando
# empiece la nueva temporada". Un solo lugar para cambiarlo.
# 🔴 SALE DE `comun/temporada.py`, NO SE ESCRIBE ACA. Estuvo a mano
# en CUATRO archivos y los cuatro decian «un solo lugar para
# cambiarlo»: el dia del reset las cuatro cartas siguieron diciendo
# PRE con la T1 ya empezada. No fallaba, imprimia otra temporada.
from comun.temporada import SELLO as TEMPORADA  # noqa: E402,F401

# ── A QUE ESCALA SE EXPORTA ──────────────────────────────────────────────
# ⚠️ 4x Y NO 3x, Y EL MOTIVO NO ES EL FEED SINO LA PANTALLA COMPLETA.
#
# En el feed Discord recorta por alto —~350 px en escritorio— asi que con 3x
# sobraba resolucion de sobra: 1379 de alto es 3.9 veces ese tope.
#
# Pero al TOCAR la imagen, la carta llena el ancho del telefono. Medido en el
# de Dlx: 1179 px de ancho contra los 900 del archivo, o sea que se agrandaba
# 1.31 veces y salia blanda. Es el mismo problema que ya tuvimos con los
# avatares guardados a 128 y dibujados a 345.
#
# A 4x el archivo sale 1200 de ancho y cubre los dos casos sin upscale. Pesa
# ~1.2 MB, muy por debajo del limite de 10 MB de Discord.
ESCALA = 4

# las dos imagenes que van adentro de los aros del pie
def bandera(cc):
    """La bandera del pais. ⚠️ VIVE EN comun/banderas.py.

    Esta carta la pedia a flagcdn teniendola en el repo, y despues resulto que
    la Temporada y la Competitiva hacian lo mismo. Tres implementaciones de
    "buscar la bandera" es dos de mas: ver el docstring de ese modulo.
    """
    from comun.banderas import src
    s = src(cc)
    return '<img src="%s">' % s if s else '' 


# ⚠️ INVENTADOS PARA VER LA FILA. ESTILO_DE esta vacio en todo el proyecto:
# los 16 iconos existen y nadie tiene estilo asignado. Cuando se asignen, esto
# se borra y sale del pool.
ESTILO_MUESTRA = ['agresividad', 'conceptos', 'delivery', 'coherencia',
                  'dobletempo', 'cazafla']

# ⚠️ CREW DE MUESTRA, y a proposito NO la tienen todos. Dlx: "no todos van a
# estar en una crew". Poner crew en las diez habria escondido justo lo que hay
# que mirar — que la fila se acomode cuando falta una pieza—. Asi se ve con
# 4 circulos, con 3 y con 2 en la misma hoja.
#   indice -> (nombre de la crew, puesto, cuantos son)
# ⚠️ LAS CREWS SON LAS REALES, de datos/crews.json. Antes habia tres
# inventadas —Ronin, Aura, Nova— que quedaron de cuando no existia el dato, y
# la carta de TFC mostraba "RO" de una crew que no existe. El JSON estaba
# guardado desde el 20/08 y nunca se habia enchufado.
def _cargar_crews():
    """⚠️ VIVE EN comun/crews.py. Esto estaba escrito cuatro veces y dos de
    esas copias tenian la lista vieja de 13 personas."""
    from comun.crews import puestos
    try:
        with open(os.path.join(BASE, 'datos', 'competitivo_pool.json'),
                  encoding='utf-8') as f:
            pool = json.load(f)
    except Exception:
        return {}
    return puestos(pool)


# ⚠️ ESTA ES LA MISMA NORMALIZACION QUE comun/crews.py, Y ESO NO ALCANZA.
# CREWS ahora lo llena `crews.puestos()`, o sea que las CLAVES las pone ese
# modulo: si las dos funciones se separan un dia —un guion, un emoji nuevo— el
# `.get()` falla y la crew desaparece sin avisar. Se queda porque el resto del
# archivo la usa para otras cosas, pero la busqueda de crew va por crews.norm.
def _k(s):
    import unicodedata
    s = re.sub(r'[🇦-🇿]', '', s)
    s = re.sub(r'[❓?‍️]', '', s)
    s = ''.join(x for x in unicodedata.normalize('NFD', s)
                if unicodedata.category(x) != 'Mn')
    return re.sub(r'[^a-z0-9]', '', s.lower())


CREWS = _cargar_crews()

# puesto dentro del rango Y del servidor. Medido sobre el pool: de las 30
# combinaciones que existen, 13 tienen menos de 3 y 9 son de una sola persona.
# Esas van sin numero. Aca se ponen valores de muestra, con dos casos por
# debajo del umbral —indices 5 y 6— para ver la carta sin el numero.
PUESTO_RANGO = {0: (9, 17), 1: (2, 6), 2: (3, 8), 3: (5, 11), 4: (1, 4),
                5: (1, 1), 6: (1, 2), 7: (4, 9), 8: (2, 5), 9: (6, 13)}

# ⚠️ LA PUERTA POR LA QUE ENTRA LA GENTE DE VERDAD. Vale None en la hoja —que
# es una muestra de diseño y usa sus propios numeros— y `generar.py` la llena
# con {indice: total del pais}. Se hace asi y no cambiando carta() porque esa
# funcion desarma una tupla de catorce campos que usan diez lugares distintos.
TOTALES_PAIS = None


def estilo_img(k):
    return '<img src="%s">' % b64(os.path.join(
        BASE, '02_Competitivo', 'v2', 'estilos', '%s.png' % k))


def esc_sv(sv):
    """El escudo cuadrado del servidor, en b64. ⚠️ NO se puede dejar como
    plantilla con %s: el PNG entra embebido y el string tendria megas."""
    return '<img src="%s">' % b64(os.path.join(
        BASE, 'comun', 'escudos_cuad', 'sv_%s.png' % sv.lower()))

MEDIO_DIV = 0.45        # cuanto sube la parada del medio, hacia el blanco
TECHO_DIV = 2.81        # contraste maximo del medio contra el panel


def medio_divisor(propio):
    """Cuanto sube el medio de la linea. NO es el mismo para los diez.

    ⚠️ EL 45% FIJO LES CAE DISTINTO Y POR ESO UNOS SE VEN LAVADOS. Subir una
    fraccion fija hacia el blanco mueve mucho mas, EN LUZ, a un color oscuro
    que a uno claro. Medido, los cuatro mas levantados eran los cuatro propios
    mas oscuros: FFA 4.41, RZ 4.16, TFC 3.62, FTN 3.43.

    Dlx marco cual le gusta —FRZ— y cual no —FTN—. No los separaba el croma:
    45 contra 49, casi iguales. Los separaba el CONTRASTE, 2.81 contra 3.43.
    Por eso "mas fuerte" o "mas suave" no arreglaba nada: el problema no era
    el nivel sino que el mismo nivel les caia distinto.

    ⚠️ ES UN TECHO Y NO UN OBJETIVO, a proposito. Llevar a los diez a 2.81
    tambien SUBIRIA a los vividos —SR, TWR y DRA estan en 2.05-2.18— y eso
    les mete blanco justo a los que hoy son los que menos tienen: su croma
    caeria de ~100 a ~74. Como la queja es que sobra blanco, esto solo baja.
    Cinco bajan, cinco quedan igual, ninguno empeora.
    """
    from comun.emblema import tono

    def _l(h):
        h = h.lstrip('#')
        c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
        c = [x / 12.92 if x <= .03928 else ((x + .055) / 1.055) ** 2.4 for x in c]
        return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]

    def ct(a, b):
        la, lb = _l(a), _l(b)
        return (max(la, lb) + .05) / (min(la, lb) + .05)

    # ⚠️ LAS EXCEPCIONES A MANO SE FUERON. Estaban parcheando FTN y FFA uno
    # por uno, y el problema era la REGLA: mientras el degrade iba del acento
    # al propio, cualquier servidor con acento y propio opuestos cruzaba el
    # eje neutro. Ahora el degrade no sale del acento, asi que no hay cruce
    # que parchear. Ver defs_divisor().
    if ct(tono(propio, MEDIO_DIV), propio) <= TECHO_DIV:
        return MEDIO_DIV
    lo, hi = 0.0, MEDIO_DIV
    for _ in range(40):
        m = (lo + hi) / 2
        if ct(tono(propio, m), propio) < TECHO_DIV:
            lo = m
        else:
            hi = m
    return hi


def _mez(c1, c2, t):
    a = [int(c1.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)]
    b = [int(c2.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)]
    return '#%02X%02X%02X' % tuple(int(x + (yy - x) * t) for x, yy in zip(a, b))


def color_marco_en(px, py, propio, acento):
    """Que color tiene EL MARCO en ese punto de la carta.

    ⚠️ ES LO QUE FALTABA PARA QUE LA LINEA TENGA SENTIDO. Dlx lo vio: la
    linea del divisor MUERE CONTRA EL MARCO en sus dos puntas, asi que ahi
    tienen que ser el mismo color. Con dos degrades independientes no lo son,
    y se nota como un empalme cortado —en DRA el marco llega azul por la
    izquierda y la linea arrancaba blanca—.

    El degrade del marco es objectBoundingBox de (0.1,0) a (0.9,1), con el
    acento en las dos puntas y encender(propio,.30) en 0.45. Se proyecta el
    punto sobre ese vector y se evalua la parada que corresponde.
    """
    from comun.marco import paradas
    a, b = paradas(propio, acento)          # a = medio, b = puntas
    u, v = px / W, (py - MARGEN) / PICO.h
    dx, dy = .8, 1.0
    t = ((u - .1) * dx + v * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    return _mez(b, a, t / .45) if t <= .45 else _mez(a, b, (t - .45) / .55)


def defs_divisor(propio, acento, sufijo, pts=None):
    """El degrade DE LA LINEA. Mismo dibujo que el del marco, otra parada.

    ⚠️ NO SE PUEDE REUSAR EL DEL MARCO Y ESTE ES EL MOTIVO. Su parada del
    medio es encender(propio,.30), que da casi el propio —en DRA da EXACTO el
    propio—. En el marco eso no molesta porque su medio cae en los COSTADOS,
    contra el fondo; en una linea horizontal cae en el CENTRO, contra el panel
    del mismo color. El mismo degrade hace cosas opuestas segun la forma que
    recorre.

    ⚠️ Y SUBIR encender() NO ARREGLA NADA: multiplica por
    k = 1 + (255/max(canal) - 1)*f, asi que un color que ya tiene un canal en
    255 no se mueve por mas f que se le ponga. Medido a f=1.00 —el maximo—
    siguen sin llegar SR 1.64, TWR 1.57, URBF 1.60 y DRA 1.00. Cuatro de diez.

    Por eso el medio sube hacia el BLANCO con tono(), que no depende del canal
    maximo: a 0.45 los diez pasan de 1.9 y el peor sube de 1.00 a ~2.1.

    El croma que pierde el medio no se extraña: las PUNTAS siguen siendo el
    acento, asi que la linea sigue diciendo de que servidor es la carta, que
    era lo unico que el blanco pleno perdia.
    """
    from comun.emblema import tono
    # ⚠️ TODO EL DEGRADE SALE DEL COLOR DEL LOGO. Antes las puntas eran el
    # acento —o el marco evaluado ahi, que cerca de las puntas ES el acento—
    # y el medio el propio levantado. Eso obligaba a viajar de un color a
    # otro, y cuando esos dos son opuestos el camino pasa por el eje neutro:
    # en FTN, amarillo contra azul, el croma caia a 3 a mitad de camino. Ese
    # era el gris.
    #
    # Dlx lo dijo derecho: que salga del color principal del logo, y que sea
    # oscuro contra claro como el de FRZ. Y FRZ funcionaba justamente porque
    # su acento (#8FE8E0) y su propio (#0E5F5E) YA SON EL MISMO TEAL: su
    # degrade siempre fue monocromo, por casualidad. Ahora lo son los diez.
    #
    # ⚠️ Y NO ES METALICO, que es lo otro que pidio evitar: metalico seria
    # alternar claro-oscuro-claro-oscuro para fingir reflejos. Esto es UN
    # solo tramo oscuro -> claro -> oscuro, la misma forma que ya tenia.
    #
    # Al no salir del acento, no hay cruce de tonos posible y las excepciones
    # a mano de FTN y FFA sobran.
    # ⚠️ LAS PUNTAS SALEN DEL MARCO EVALUADO DONDE LA LINEA LO TOCA. Esto lo
    # pidio Dlx tres veces y yo lo saque sin querer en el medio: lo habia
    # puesto bien, y al pasar el degrade a monocromo lo reemplace por un
    # oscuro fijo. Un color fijo NO empalma, porque el marco en ese punto esta
    # en algun lugar de SU degrade y casi nunca es su extremo.
    #
    # La leccion, y va a ESTADO.md: al cambiar una regla hay que revisar que
    # no se lleve puesta una decision anterior que dependia de ella. El
    # monocromo era correcto; borrar el empalme fue un efecto colateral que no
    # mire.
    #
    # ⚠️ AHORA ES SEGURO HACERLO. Antes las puntas del marco eran el ACENTO,
    # asi que empalmar traia el acento a la linea y con el propio en el medio
    # se cruzaba el eje neutro —el gris de FTN—. Con el marco monocromo, el
    # color del empalme ya es del mismo tono, asi que no hay cruce posible.
    #
    # El MEDIO no se toca: ahi la linea no toca nada y necesita separarse del
    # panel, asi que sigue siendo MK.claro().
    if pts:
        (xi, vi), (xd, vd) = pts[0], pts[-1]
        izq = color_marco_en(xi, y(vi), propio, acento)
        der = color_marco_en(xd, y(vd), propio, acento)
    else:
        izq = der = MK.oscuro(propio)
    return (f'<linearGradient id="dv{sufijo}" x1="0" y1="0" x2="1" y2="0"'
            f' gradientUnits="objectBoundingBox">'
            f'<stop offset="0" stop-color="{izq}"/>'
            f'<stop offset=".5" stop-color="{MK.claro(propio)}"/>'
            f'<stop offset="1" stop-color="{der}"/></linearGradient>')


def escalon(ovr):
    for lim, nom in ESCALERA:
        if ovr >= lim:
            return nom
    return ESCALERA[-1][1]


def val(v, sin_datos):
    """El valor de una fila, o «—» si esa persona no tiene NADA medido.

    ⚠️ CERO Y «NO HAY» NO SON LO MISMO, y la diferencia la nota el que mira la
    carta. Quien compitio y no gano nada tiene CERO titulos: el dato existe y
    vale cero. Quien nunca jugo no tiene cero — no tiene dato, y un cero ahi
    dice «perdio todo» cuando la verdad es «todavia no jugo».

    Dlx, 19/09/2026, mirando la primera carta de alguien sin competir:
    «un - esta mejor; 0 no deberia existir».
    """
    # El guion va con su propia clase: al peso del numero (900) una raya se
    # lee como una BARRA MACIZA, no como «no hay». Mismo problema que tuvo el
    # OVR y misma solucion: mas fino y mas tenue.
    return '<span class="nd">—</span>' if sin_datos else v


def pieza(k, v, i, apagado):
    """Una fila de la columna.

    ⚠️ EL TEXTO VA SIEMPRE EN BLANCO. Antes la fila entera bajaba a 34% de
    opacidad cuando el valor era cero, y eso ponia el numero y la etiqueta en
    gris: Dlx lo vio como un error de capas y tenia razon en que se leia mal.
    Lo que se apaga ahora es SOLO EL ICONO, que alcanza para que el cero se
    note sin que el texto pierda color.
    """
    cy = PIE.COL_Y0 + i * PIE.COL_PASO
    return (f'<div class="mini" style="top:{y(cy)-9:.0f}px">'
            f'<div class="lin">{ICO.svg(k, 15, .38 if apagado else .92)}'
            f'<b>{v}</b></div>'
            f'<span>{ICO.ETIQUETA[k]}</span></div>')


def carta(i, sufijo):
    nom, sv, rg, cc, p, pt, tot, ovr, pod, tit, rch, duel, evt, falso = GENTE[i]
    # «Sin datos» = no jugo NADA. No alcanza con que un stat sea cero: el que
    # compitio y no gano tiene cero de verdad. El corte es no tener eventos.
    sin_datos = not evt
    B, A, FONDO, EXTRA, _, _ = DEFS[sv]
    pts = camino()
    # ⚠️ SE RESUELVE ACA Y NO EN EL f-string: un dict literal adentro de una
    # f-string es error de sintaxis, las llaves chocan con las del formato.
    tinta_div = {'acento': B, 'blanco': '#FFFFFF',
                 'degrade': MK.stroke(sufijo),
                 'degrade2': 'url(#dv%s)' % sufijo}[DIV_COLOR]
    # ⚠️ SE RECORRE TODA LA LISTA, no los primeros. Con para(i) a secas la
    # muestra agarraba los 10 primeros avatares, que son todos FOTOS REALES,
    # y nunca llegaba al ultimo, que es SIN FOTO — el caso de 118 de 138. La
    # hoja mostraba la excepcion y escondia la regla. Repartiendo de punta a
    # punta entran tambien los casos de prueba y el sin foto.
    _n = avatares.cuantas()
    _, av = avatares.para(round(i * (_n - 1) / max(1, len(GENTE) - 1)))
    lado = W * 115 / 100
    a, b, c = LAVADO
    # ⚠️ EL LAVADO TIENE QUE MIRAR AL MISMO LADO QUE LA COLUMNA. En CSS 0deg
    # apunta arriba y 90 a la derecha, asi que 270 arranca opaco en el borde
    # DERECHO y se abre hacia la izquierda. Si la columna se muda y esto no,
    # la carta queda oscurecida del lado vacio y la columna sin fondo.
    m = (f'linear-gradient({90 if IZQ else 270}deg,#000 0%,#000 {a}%,'
         f'rgba(0,0,0,.5) {b}%,transparent {c}%)')
    foto = (f'<div class="foto" style="-webkit-mask-image:{M_FOTO};'
            f'mask-image:{M_FOTO}"><img src="{av}" style="width:{lado:.0f}px;'
            f'left:{(W-lado)/2:.1f}px;top:{MARGEN-(lado-ALTO_FOTO)*.44:.1f}px">'
            f'</div>') if av else (
        # 🔴 SIN FOTO NO SE DEJA EL HUECO: VA LA INICIAL. Esto era
        # `if av else ''`, o sea que a quien no tiene foto la carta le
        # dibujaba **nada** — un rectangulo vacio donde va la cara, que
        # se lee como una carta rota y no como «no se puso foto».
        #
        # Las otras tres cartas ya resuelven esto asi desde siempre:
        # `01_Temporada/normal_v3.py` y `02_Competitivo/v2/gencomp.py`
        # ponen `<div class="c-initials">` con la inicial. Esta era la
        # unica que no, y no estaba decidido en ESTADO.md — era un hueco,
        # no una eleccion.
        #
        # ⚠️ Medido el 22/09/2026: **24 de las 320** dibujables no tienen
        # foto, el 8 %. No es un caso raro: son los que no se pusieron
        # avatar en Discord, y `bot/fotos.py` no guarda el blob gris por
        # defecto **a proposito** —«peor carta que la inicial»—. O sea que
        # el proyecto ya habia decidido preferir la inicial y esta carta
        # no la dibujaba.
        #
        # ⚠️ Y APARECIO MIRANDO UNA CARTA DE VERDAD: la de Yinn en FFA.
        # Dlx pregunto si el problema era que no estaba en DRA o que la
        # foto no habia cargado. No era ninguna de las dos — esta en DRA
        # y no tiene foto — pero la carta no lo decia.
        f'<div class="ini">{(nom or "?")[0].upper()}</div>')
    # ⚠️ el umbral de 3 ya rige pos_sv: en un grupo de menos de tres el
    # puesto no se dibuja, porque ser "1 de 1" no dice nada
    # ⚠️ los dos puestos llevan etiqueta de QUE MIDEN, no del total: los dos
    # son del mismo servidor, asi que "DE 79" no los distinguiria
    # los tres puestos son del mismo servidor y miden cosas distintas: la
    # etiqueta es lo unico que los separa
    # ⚠️ LOS PUESTOS PASAN A CIRCULOS, como en la Competitiva. Lo que se trae
    # es LA FORMA, no el aro que mide: en la Competitiva cada circulo se llena
    # contra un grupo distinto —pais, servidor, crew— y por eso su anillo dice
    # algo. Los tres de aca son DEL MISMO SERVIDOR, o sea el mismo total, asi
    # que tres anillos se llenarian casi igual y el aro seria decorado con
    # forma de dato. Es la misma razon por la que ninguna etiqueta dice "DE
    # 79": ya se habia decidido no mostrar el total.
    #
    # Queda entonces el circulo con un borde fino del color claro del logo,
    # que es el mismo lenguaje que ya usan el marco, la linea y el titulo.
    # ⚠️ EL ARO DE VERDAD, no un circulo con el numero adentro. El diseño de
    # la Competitiva (card.css:296-330) es: una IMAGEN adentro, un aro que se
    # llena segun tu puesto, y el numero EN LA ABERTURA de abajo. Su propio
    # comentario dice por que: "el arco sigue midiendo la posicion, pero solo,
    # nadie entiende que mide; con el numero adentro del hueco, el arco pasa a
    # ser el medidor y el numero la etiqueta".
    #
    # ⚠️ Y ESO DESARMA LA OBJECION QUE YO HABIA PUESTO. Dije que el aro no
    # servia porque los tres puestos comparten total. Cierto para tres numeros
    # sueltos, falso para este diseño: aca cada aro rodea UNA IMAGEN DISTINTA
    # —bandera, escudo— o sea grupos distintos, y por eso cada arco informa.
    #
    # El arco barre 310deg desde 205deg y deja el hueco abajo. Se llena con
    # (total - puesto + 1) / total: el 1º lo llena entero, el ultimo casi
    # nada. Minimo 6% para que no desaparezca del todo.
    def _estilo(k, d):
        """El estilo: mismo circulo, sin aro y sin numero."""
        return (f'<div class="ar" style="--c:{MK.claro(A)};--d:{d}px">'
                f'<div class="arim es" style="background:{MK.oscuro(A)};'
                f'width:{d}px;height:{d}px">{estilo_img(k)}</div></div>')

    def _aro(img, pos, tot, d, cuad=False, gem=False):
        # ⚠️ SIN PUESTO TAMPOCO HAY NUMERO NI ARCO. `tot >= 3` cubria «el grupo
        # es muy chico para rankear», pero no «esta persona no tiene puesto»:
        # con pos=0 dibujaba un «0» debajo de la bandera, que es justo lo que
        # la regla de CLAUDE.md prohibe —*sin dato no hay pieza*—. Aparecio con
        # la primera carta de alguien que nunca compitio (Lil Drako, 19/09/2026).
        hay = tot >= 3 and pos >= 1
        f = max(.06, (tot - pos + 1) / tot) if hay else 0
        # ⚠️ EL ARO DE LA GEMA VA DEL COLOR DEL SERVIDOR, IGUAL QUE LOS OTROS,
        # y esto corrige lo que yo habia hecho. Le habia puesto el acento del
        # rango razonando que la gema "habla de la Liga y no del servidor", y
        # el razonamiento es cierto pero la conclusion estaba mal: EL AIRE NO
        # ES LA PIEZA. En esta fila el aro es el CONTINENTE —el mismo borde
        # que el marco, la linea y el titulo, todos MK.claro(A)— y lo que
        # identifica al rango es la FIGURA de adentro, que si conserva su
        # acento. Con dos colores de aro la fila se leia como dos grupos.
        # Dlx: "haz que el color sea el mismo de los otros circulos".
        cl = MK.claro(A)
        # ⚠️ EL "º" SE VA EN B, C y D. Son tres caracteres para decir lo que
        # ya dice el contexto —abajo de una bandera, un numero es un puesto—
        # y el simbolo cuesta un tercio del ancho de la pastilla. En A se
        # queda para que la comparacion muestre la opcion de hoy tal cual es.
        gr = 'º' if POS_MODO == 'centro' else ''
        num = f'<b>{pos}{gr}</b>' if hay else ''
        return (f'<div class="ar" style="--f:{f * 310:.1f}deg;--c:{cl};'
                f'--d:{d}px">'
                f'<div class="arim{" cu" if cuad else ""}" '
                f'style="background:{MK.oscuro(A)};width:{d}px;height:{d}px">'
                f'{img}</div>{num}</div>')
    # ⚠️ DOS AROS, NO TRES NUMEROS. Cada uno rodea su propia imagen y mide
    # contra SU grupo, que es lo que hace que el arco signifique algo:
    #
    #     bandera + aro   puesto en tu PAIS      -> pos_pais, otro grupo
    #     escudo  + aro   puesto en tu SERVIDOR  -> pos_sv
    #
    # El tercero de antes —el de temporada— no vuelve como aro: era del mismo
    # servidor que el de servidor, o sea el mismo total, y ahi el arco no
    # distingue. Queda pendiente si vuelve como texto.
    #
    # ⚠️ pos_pais NO ESTA EN LA MUESTRA todavia: se usa `pt` como marcador
    # para poder dibujar. El campo existe en el pool competitivo, con el mismo
    # umbral de 3, asi que al generar de verdad se lee de ahi.
    # ⚠️ SIN ETIQUETAS DEBAJO. La Competitiva tampoco las lleva, y con razon:
    # la imagen ya dice de que grupo se trata —una bandera es tu pais, un
    # escudo es tu servidor—. Ademas chocaban con el TAG, que esta 7 px mas
    # abajo.
    #
    # ⚠️ Y LA BANDERA SUELTA SE VA. Estaba a la izquierda como pieza aparte y
    # ahora vive adentro de su aro: dejarla era mostrar el mismo pais dos
    # veces en la misma fila.
    # ⚠️ EL ESTILO ENTRA COMO TERCER CIRCULO, pero sin aro ni numero: no es un
    # puesto, es QUIEN SOS. Ponerle un anillo que mide lo convertiria en un
    # ranking de estilo, y eso ya se midio y no da —112 casilleros para 138
    # personas, TFC toca a 4.9 por estilo—. El icono solo no necesita umbral.
    #
    # ⚠️ LOS ESTILOS SON INVENTADOS. ESTILO_DE esta vacio: nadie tiene estilo
    # asignado todavia. Se reparten a mano para ver como queda la fila.
    # ⚠️ EL GRUPO SE CENTRA Y EL DIAMETRO SALE DE CUANTOS HAY. Dlx: "no todos
    # van a estar en una crew", asi que la fila NO tiene un largo fijo: puede
    # llevar 2, 3 o 4 circulos. Con posiciones absolutas —como estaba— sacar
    # uno dejaba un hueco y agregarlo lo empujaba fuera de lugar.
    #
    # Es el patron de los chips de la Competitiva: un contenedor flex que
    # acomoda lo que haya (card.css:49, `display:flex` con `gap`).
    # ⚠️ 24 ES UN PLACEHOLDER Y SOLO VALE EN LA HOJA. `generar.py` pone acá
    # el total de verdad del país de cada uno —el pool trae pos_pais con el
    # formato "5/25"— a traves de TOTALES_PAIS. Sin esa puerta, una carta de
    # alguien de Guatemala dibujaria su aro contra 24 compatriotas que no
    # existen.
    TOT_PAIS = (TOTALES_PAIS or {}).get(i, 24)
    # ⚠️ EL PUESTO SALE DEL RANGO BASE, SIN EL SIGNO. Dlx: "el rango A con
    # signos y sin signos es lo mismo para la posicion; con signos se refiere
    # a que esta en lo alto de ese rango". O sea que A-, A y A+ compiten en la
    # MISMA lista de 27, no en tres listas de 9.
    pos_rg, tot_rg = PUESTO_RANGO.get(i, (0, 0))
    from comun.crews import norm as _cnorm
    _cr = CREWS.get(_cnorm(nom))
    crew, pos_crew, tot_crew = _cr if _cr else (None, 0, 0)

    # ⚠️ LA BANDERA Y EL ESCUDO SON IDENTIDAD: VAN SIEMPRE. EL NUMERO ES EL
    # QUE TIENE UMBRAL. Hasta el 17/09/2026 los dos colgaban de un solo
    # `if tot >= 3`, o sea del total del SERVIDOR: con menos de tres personas
    # en tu servidor desaparecian las DOS piezas, incluida la bandera, que no
    # tiene nada que ver con tu servidor.
    #
    # Es la regla escrita en CLAUDE.md, rota: *«la bandera es identidad, el
    # numero es ranking»*, y *«sin dato no hay pieza»* habla del DATO —si no
    # tenes pais no hay bandera— no del umbral del puesto.
    #
    # Pasaba ya con gente de verdad: `pos_sv` llega a 135 de 138, o sea que
    # NFK y MARCOS perdian su bandera y nadie lo iba a ver mirando una carta.
    # Y se volvio imposible de ignorar al dibujar la carta de OTRO servidor,
    # donde no hay puesto por definicion: las nueve salian sin bandera.
    #
    # `_aro()` ya sabe callarse el numero cuando el total no llega a 3, asi
    # que alcanza con dejarlo decidir a el.
    piezas = []
    if cc:
        piezas.append(('aro', bandera(cc), pt, TOT_PAIS, False))
    piezas.append(('aro', esc_sv(sv), p, tot, True))
    # ⚠️ EL ESTILO SALE DEL NOMBRE, NO DE LA POSICION EN LA TANDA.
    # Hasta el 17/09/2026 era `ESTILO_MUESTRA[i % len(...)]`, con `i` el indice
    # DENTRO DE LA TANDA. O sea que la misma persona recibia un icono distinto
    # segun con quien se la dibujara: en la tanda de 138 tenia uno, y
    # regenerando su carta sola tenia otro.
    #
    # ⚠️ NO SE VE MIRANDO UNA CARTA NI COMPARANDO UNA TANDA CONTRA SI MISMA.
    # Aparecio comparando pixel a pixel el render local contra el que esta en
    # R2: 0.15% de diferencia, toda concentrada en un circulo del pie. Todo lo
    # demas —cara, numeros, colores— identico.
    #
    # Sigue siendo INVENTADO, porque `ESTILO_DE` esta vacio y nadie tiene
    # estilo asignado. Pero ahora es **el invento de esa persona** y no el de
    # su posicion, asi que la carta se puede volver a generar y sale igual.
    # El md5 en vez de `hash()`: el de Python cambia en cada proceso.
    _e = int(hashlib.md5(str(nom).encode('utf-8')).hexdigest(), 16)
    piezas.append(('est', ESTILO_MUESTRA[_e % len(ESTILO_MUESTRA)], 0, 0, False))
    if crew:
        piezas.append(('aro', crew_img(crew), pos_crew, tot_crew, True))
    # ⚠️ LA GEMA ENTRA AL GRUPO, no queda suelta al costado. Dlx: "que este
    # junto a los demas circulos, que tenga su posicion abajo como los demas y
    # que sea del mismo tamaño". Al ser una pieza mas, el diametro se lo da
    # diametro(n) igual que a las otras y su numero usa la misma pastilla.
    # 🔴 SIN RANGO NO HAY GEMA, y es la misma regla de siempre: **sin
    # dato no hay pieza**. El rango sale del Score competitivo, asi que
    # quien no compitio en esta temporada no tiene ninguno — no tiene
    # el peor, no tiene. Ponerle `E` para que la gema exista diria «sos
    # el ultimo», y `CLAUDE.md` ya lo deja escrito para la Bloqueada:
    # *«el gris no es el color de E; los ocho son ocho niveles y el
    # bloqueado no esta en ninguno: esta antes»*.
    #
    # ⚠️ Y LA FILA NO SE ROMPE: `diametro(len(piezas))` reparte lo que
    # haya, y el caso de «ninguna pieza lleva numero» ya estaba
    # contemplado tres lineas mas abajo. Una pieza menos es un caso que
    # este layout sabe dibujar.
    #
    # ⚠️ El fondo de la carta lo da el SERVIDOR, no el rango, asi que
    # una carta sin gema sigue siendo una carta entera: es la camiseta
    # de ese servidor el dia uno.
    if rg:
        piezas.append(('gem', rg, pos_rg, tot_rg, False))

    d = diametro(len(piezas))
    # ⚠️ SI NINGUNA PIEZA LLEVA NUMERO, LA FILA NO CUELGA. La pastilla del
    # puesto solo se dibuja con el umbral de 3, asi que hay cartas donde no
    # hay ninguna —NFK tiene 2 en su servidor y MARCOS 1—. Dar por hecho que
    # siempre cuelga dejaba el TAG 5.25 px descentrado en esas dos, y era
    # justo el tipo de error que no se nota mirando UNA carta.
    cuelga = POS_CUELGA[POS_MODO] if any(x[3] >= 3 for x in piezas) else 0
    def _pieza(t, a, b, c, e):
        if t == 'aro':
            return _aro(a, b, c, d, cuad=e)
        if t == 'gem':
            return _aro(gema_fig(a, d * GEMA_LLENA, sufijo), b, c, d, gem=True)
        return _estilo(a, d)

    dentro = ''.join(_pieza(*x) for x in piezas)
    pst = (f'<div class="filaC" style="gap:{max(8, d * .30):.0f}px">'
           f'{dentro}</div>')
    tmp = ''
    return f"""<div class="wrap">
  <svg class="d" width="0" height="0"><defs>
    <clipPath id="{sufijo}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
    {MK.defs_svg(A, B, sufijo)}
    {defs_divisor(A, B, sufijo, pts)}
  </defs></svg>
  <div class="cu" style="clip-path:url(#{sufijo})">
    <div class="f" style="background:{FONDO}"></div>
    {f'<div class="f" style="{EXTRA}"></div>' if EXTRA else ''}
    {foto}
    <div class="wash" style="background:{PIE.lavado(A)};
         -webkit-mask-image:{m};mask-image:{m};
         clip-path:path('{DIV.arriba(pts, W, ALTO, dy=MARGEN)}')"></div>
    {BRI.arriba(A)}
    <div class="f" style="background:{FONDO};clip-path:path('{panel_pie(pts)}')"></div>
    {f'<div class="f" style="{EXTRA};clip-path:path(&quot;{panel_pie(pts)}&quot;)"></div>' if EXTRA else ''}
    <svg class="f" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
      <path d="{'M' + ' L'.join('%.2f,%.2f' % (x, y(v)) for x, v in pts)}"
            fill="none" stroke="{tinta_div}"
            stroke-width="{DIV_GROSOR}" opacity="{DIV_OPAC}"/>
    </svg>
  </div>
  <svg class="bo" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{sufijo})">
      <path d="{SIL}" fill="none" stroke="{MK.stroke(sufijo)}"
            stroke-width="9" opacity=".95"/>
    </g>
  </svg>
  <div class="ovr">{f'<b>{ovr}</b>' if ovr else '<b class="nd">—</b>'}</div>
  <div class="escp" style="background:{MK.claro(A)};color:{MK.tinta(A)};
       border:1.2px solid {MK.oscuro(A)}">{escalon(ovr)}</div>
  {pieza('campeonatos', val(tit, sin_datos), 0, tit == 0)}{pieza('podios', val(pod, sin_datos), 1, pod == 0)}
  {pieza('racha', val(rch, sin_datos), 2, rch == '0/0')}{pieza('duelos', val(duel, sin_datos), 3, duel == '0/0')}
  {pieza('eventos', val(evt, sin_datos), 4, evt == 0)}
  <div class="nom" style="font-size:{NOM.rem(nom, 1.5)}rem">{nom}</div>
  {pst}{tmp}
  {TIT.div(dict(pos_sv=max(1, p - 1), total_sv=tot, titulos=tit, podios=pod,
                racha=rch, duelos=duel, eventos=evt), A, B,
           y=y(PIE.tag_centrado(d, cuelga, Y_FILA)))}
  <div class="t1">{TEMPORADA}</div>
  <img class="ul" src="{UL}">
  {emblema.estrellas(int(_EST.get(sv, 0)), W, sufijo=sufijo)}
  {emblema.pieza(sv, A, B, b64(os.path.join(BASE, 'comun', 'escudos_cuad',
                                            f'sv_{sv.lower()}.png')))}
</div>"""


UL = b64(os.path.join(BASE, '01_Temporada', 'ul_blanco.png'))

CSS = f"""
body{{margin:0;background:transparent}}
.wrap{{position:relative;width:{W}px;height:{ALTO}px}}
.d{{position:absolute}}
.cu{{position:absolute;inset:0}}
.bo{{position:absolute;inset:0;pointer-events:none}}
.f{{position:absolute;inset:0;background-repeat:repeat}}
.foto{{position:absolute;top:0;left:0;width:{W}px;height:{ALTO}px;
  overflow:hidden}}
.foto img{{position:absolute;height:auto;display:block}}
/* ⚠️ LA INICIAL VIVE EN LA MISMA CAJA QUE LA FOTO y con su misma mascara,
   asi que se desvanece igual contra el fondo. Centrada en el alto de la
   foto y no de la carta: abajo esta el pie. */
.ini{{position:absolute;top:0;left:0;width:{W}px;height:{ALTO_FOTO}px;
  display:flex;align-items:center;justify-content:center;
  font-family:Archivo,sans-serif;font-weight:900;
  font-size:{round(ALTO_FOTO*0.52)}px;line-height:1;
  color:rgba(255,255,255,.13);letter-spacing:-.04em;
  text-shadow:0 2px 18px rgba(0,0,0,.45)}}
/* ⚠️ EL LAVADO VA EN LA MISMA CAJA QUE EL FONDO, no en una propia.
   Antes era top:MARGEN con height:BASE_Y, o sea una caja de 300x269 contra
   la de 300x487 del fondo. Las dos pintan el MISMO degrade a 158 grados, y
   un degrade se reparte sobre la diagonal de SU caja: 402.8 px contra 572.0.
   O sea que el lavado mostraba el degrade de la carta COMPRIMIDO UN 30% y
   corrido, y donde la foto se desvanece se veian los dos a la vez.
   Dlx: "el panel derecho tiene como una reflexion media rara". No era un
   reflejo: era el degrade de la carta duplicado y desalineado.
   Ahora comparte la caja y se limita con un RECORTE, que no toca el
   degrade. Y se repinta tambien la capa EXTRA, por lo mismo. */
.wash{{position:absolute;inset:0;background-repeat:repeat}}
{BRI.css('luz', MARGEN, PICO.h)}
/* ⚠️ ESTE TAMBIEN SE MUDA. Cuando se hizo el interruptor del lado, el
   reemplazo agarro .col y .mini pero NO este, porque aca `right` y `width`
   estan en lineas distintas. Resultado: la columna, la pastilla y las filas
   se fueron a la izquierda y el numero se quedo solo a la derecha. Se veia
   como una decision rara y era un renglon sin convertir. */
.ovr{{position:absolute;{LADO_COL}:{SEP_NUM}px;top:{y(PIE.COL_Y_OVR)}px;
  width:{PIE.COL_ANCHO}px;text-align:center;z-index:9;
  font-family:'Archivo','LigaEmoji',sans-serif;color:#fff}}
/* ⚠️ el numero es EL protagonista, y estaba tratado como un dato mas.
   Medido contra las otras dos: alla ocupa casi un cuarto del ancho de la
   carta y lleva FILO ademas de sombra (card.css .c-ovr, gencomp .tl). Aca
   media 33 px y era blanco plano. Ahora 3rem y con filo, que es lo que hace
   que aguante sobre cualquier fondo: la sombra sola es un desplazamiento y
   deja el borde de arriba sin nada. paint-order para que el trazo no se
   coma la letra. */
/* ⚠️ EL «SIN DATO» NO PUEDE IR AL TAMAÑO DEL NUMERO. Un «—» a 3rem y peso 900
   no se lee como una raya: es una BARRA BLANCA maciza, mas pesada que el 0 que
   vino a reemplazar. Se vio en la primera carta de alguien sin competir (Lil
   Drako, 19/09/2026). Chico y tenue si se lee como «todavia no hay». */
.ovr b.nd{{font-size:1.5rem;font-weight:800;opacity:.45;line-height:1.9;
  -webkit-text-stroke:0;}}
.ovr b{{display:block;font-size:3rem;font-weight:900;line-height:.92;
  -webkit-text-stroke:1.1px rgba(0,0,0,.62);paint-order:stroke fill;
  text-shadow:0 3px 10px rgba(0,0,0,.9)}}
.ovr span{{display:block;font-size:.44rem;font-weight:800;letter-spacing:1.1px;
  opacity:.75;margin-top:4px}}
/* la escalera. ⚠️ RELLENA CON EL ACENTO Y TEXTO OSCURO, no al reves: el
   acento pintando texto sobre el lavado del MISMO servidor sale del mismo
   color y no pasa contraste en SR, TWR y EFA. Medido en escalera_ver.py:
   asi pasa en los diez, al reves falla en tres.

   ⚠️ LA TIPOGRAFIA ES LA DE .rkbox DE LA COMPETITIVA, copiada tal cual de
   02_Competitivo/v2/card.css:187 —0.6rem, 900, spacing 1.6, padding 3/9/2,
   radio 6—. La primera version la hice a 0.4rem y ocupando la columna
   entera: quedaba una BARRA, no una pastilla. La .rkbox es inline-block, o
   sea que ABRAZA SU TEXTO, y eso es la mitad de lo que la hace leer como
   pastilla.

   Se centra con left+translate y no con text-align, porque a este tamaño la
   pastilla es MAS ANCHA QUE LA COLUMNA: dentro de un contenedor de 56 px un
   inline-block mas ancho no se centra, se desborda para un solo lado.

   ⚠️ EL CUERPO ES EL DE LA .rkbox, EL ESPACIADO NO, y no se pudo. Medido:
   con letter-spacing 1.6 y padding 9, "VETERANO" mide 91.8 px y llega a
   x=297.9, y ahi ya no hay carta libre: el marco se pinta con stroke 9
   recortado a la silueta, o sea 4.5 px hacia adentro, asi que lo dibujable
   termina en 295.5. Nueve de los diez pisaban el marco, hasta 4.4 px.

   El motivo es la FORMA, no el tamaño: la .rkbox arranca en left:8% con toda
   la carta a su derecha; esta va centrada a 28 px del borde. Centrada ahi
   entran 83 px.

   Se bajo el espaciado y el padding, NO el cuerpo: 0.6rem es lo que se lee
   como "el mismo tamaño". Asi la mas larga mide 80.2.

   ⚠️ Y ESO FIJA UN LIMITE PARA LOS NOMBRES: a este cuerpo entran ~8 letras.
   Un escalon que se llame CAMPEON ANDA; uno que se llame GRAN CAMPEON no. */
.escp{{position:absolute;left:{x_esc():.0f}px;
  transform:translateX(-50%);top:{y(PIE.ESC_Y)}px;z-index:9;
  font-family:'Archivo','LigaEmoji',sans-serif;display:inline-block;white-space:nowrap;
  font-size:.6rem;font-weight:900;letter-spacing:.9px;
  padding:3px 6px 2px;border-radius:6px;
  box-shadow:0 2px 6px rgba(0,0,0,.7)}}
.mini{{position:absolute;{LADO_COL}:{SEP_FILAS}px;width:{PIE.COL_ANCHO}px;
  z-index:9;color:#fff;font-family:'Archivo','LigaEmoji',sans-serif;text-align:center;
  text-shadow:0 2px 6px rgba(0,0,0,.9)}}
.lin{{display:flex;align-items:center;justify-content:center;gap:4px;
  white-space:nowrap}}
.lin svg{{flex:none}}
.lin b{{font-size:.9rem;font-weight:900;line-height:1}}
/* el «no hay»: mas fino y tenue, para que no pese mas que un numero */
.lin b .nd{{font-weight:600;opacity:.5}}
.mini span{{display:block;font-size:.38rem;font-weight:800;letter-spacing:.9px;
  opacity:.68;margin-top:2px}}
.nom{{position:absolute;left:0;right:0;top:{y(NOM.Y['servidor'])-16}px;
  text-align:center;z-index:9;font-family:'Archivo','LigaEmoji',sans-serif;font-weight:900;
  color:#fff;line-height:1;text-shadow:0 2px 6px rgba(0,0,0,.85)}}
.fig{{position:absolute;z-index:9;filter:drop-shadow(0 2px 6px rgba(0,0,0,.75))}}
.ban{{position:absolute;border-radius:2.5px;object-fit:cover;z-index:9;
  box-shadow:0 2px 6px rgba(0,0,0,.8),0 0 0 1.3px rgba(255,255,255,.5)}}
/* ⚠️ LA FILA ES UN FLEX CENTRADO, no posiciones fijas. Antes cada circulo
   tenia su `left` clavado: sacar uno dejaba un hueco y agregar la crew lo
   empujaba fuera de lugar. Es el patron de los chips de la Competitiva
   (card.css:49), un contenedor que acomoda lo que haya.

   ⚠️ SE CENTRA EN LA CARTA ENTERA, NO EN EL ESPACIO QUE DEJA LA GEMA. Dlx:
   "haz que no cuente para lo de centrar los demas". Antes el ancho del
   contenedor se recortaba hasta la figura del rango, asi que el grupo quedaba
   corrido a la izquierda para hacerle lugar. Ahora la gema no participa:
   queda como pieza suelta y el grupo se centra contra el eje de la carta.

   Verificado que no se pisan: con 3 circulos el grupo mide 126 y va de x=87 a
   213; con 4 mide 132 y va de 84 a 216. La gema esta en x={PIE.X_FIG}, o sea
   que sobran mas de 50 px. */
.filaC{{position:absolute;top:{y(Y_FILA)}px;transform:translateY(-50%);
  left:0;right:0;
  display:flex;align-items:center;justify-content:center;z-index:9;
  color:#fff;font-family:'Archivo','LigaEmoji',sans-serif;line-height:1}}
/* ── EL ARO QUE MIDE, copiado de 02_Competitivo/v2/card.css:296 ──────────
   La pista se ve entera siempre y encima se dibuja el arco de color. El
   arco barre desde 205deg y deja el hueco ABAJO, donde va el numero: el
   arco mide y el numero etiqueta lo que mide.

   ⚠️ EL COLOR NO ES EL DEL RANGO COMO ALLA, es MK.claro(propio). En la
   Competitiva el aro toma el color del rango porque su carta reserva el
   dorado para los logros; aca todo lo que es borde sale del color del logo
   —marco, linea, titulo, emblema— y el aro es un borde mas. */
.ar{{position:relative;display:inline-block;border-radius:50%;line-height:0;
  padding:2px;background:transparent}}
/* ⚠️ EL ARO VA CERRADO, y esto corrige lo que yo habia hecho. Copie la regla
   de card.css:318 —arco con abertura abajo y el numero en el hueco— pero esa
   NO es la version final: en la linea 392 hay un override posterior que la
   deja como circulo entero, y su comentario dice por que:

     "Tenia una abertura de 50 grados abajo para alojar el numero, pero al
      ampliar se ve como un anillo roto. Ahora el anillo es un circulo entero
      y el numero se apoya encima, con su propio fondo oscuro."

   En CSS gana la ultima regla y yo lei una del medio. Dlx se acordaba de como
   se ve la carta y tenia razon.

   ⚠️ CONSECUENCIA: EL ARO YA NO MIDE. Al cerrarse deja de ser un medidor y
   pasa a ser un borde, asi que el puesto lo dice SOLO el numero. Se deja la
   variable --f sin usar por si algun dia se quiere volver al arco. */
.ar::before{{content:'';position:absolute;inset:0;border-radius:50%;z-index:1;
  background:var(--c);
  -webkit-mask:radial-gradient(circle,transparent 0 calc(50% - 2px),#000 calc(50% - 2px) 100%);
  mask:radial-gradient(circle,transparent 0 calc(50% - 2px),#000 calc(50% - 2px) 100%)}}
/* la imagen adentro. ⚠️ EL DIAMETRO ES PIE.LADO, el de la figura del rango,
   para que las piezas de la fila pesen igual. */
/* ⚠️ 32 y NO los 27 de la Competitiva, y es a proposito. Los 27 salieron de
   copiarla exacto (card.css:282), pero su fila lleva DOS circulos y la
   nuestra TRES, y aun asi nos sobra lugar: la fila tiene 43 px de alto
   disponible entre el nombre y el TAG. A 32 la tinta pasa de 35 a 40 y
   quedan 5.2 px de aire de cada lado, que sigue siendo holgado.

   RELLENOS: el fondo del circulo era rgba(8,10,20,.5), un gris generico que
   no decia nada. Ahora es el OSCURO DEL COLOR DEL LOGO, o sea el mismo
   lenguaje del marco, la linea, el titulo y el aro. El circulo pasa de ser
   un hueco a ser una pieza. */
.arim{{position:relative;z-index:2;width:32px;height:32px;
  border-radius:50%;overflow:hidden;display:flex;align-items:center;
  justify-content:center}}
.arim img{{width:100%;height:100%;object-fit:cover}}
/* el escudo va CONTENIDO y no recortado: su tinta llega al borde del PNG,
   asi que con cover se le come el dibujo */
/* ⚠️ CASI SIN AIRE. La bandera llena su circulo entero porque va con `cover`;
   el escudo y el estilo iban con `contain` y padding, o sea un dibujo
   flotando sobre el fondo — por eso se veian vacios al lado de la bandera.
   El PNG de escudos_cuad ya viene normalizado POR TINTA, asi que a padding
   casi cero llena el cuadro y el circulo le recorta las esquinas, que es
   justo lo que hace la bandera. */
.arim.cu img{{object-fit:contain;padding:0.8px;box-sizing:border-box}}
/* el estilo: el icono es tinta blanca sobre transparente, asi que va
   contenido y con mas aire que el escudo */
/* el icono del estilo es de trazo, no macizo: con padding 0 toca el borde y
   se corta, asi que se le deja lo minimo para que respire */
.arim.es img{{object-fit:contain;padding:2.5px;box-sizing:border-box}}
/* el numero se APOYA ENCIMA del aro cerrado, con su propio fondo oscuro.
   Sin la abertura ya no hay hueco donde meterlo, asi que el fondo es lo que
   lo separa del anillo.

   ⚠️ TODO SALE DE --d, EL DIAMETRO DEL CIRCULO, y ese es el arreglo de
   fondo. Estaba en px fijos —font .5rem, padding 1.6/4, radio 7— mientras el
   circulo escalaba con cuantas piezas hay. Con 3 piezas el circulo mide 35 y
   la pastilla quedaba bien; con 5 baja a 26 y la MISMA pastilla pasa a tapar
   el ancho entero. Una pieza que no escala junto a una que si es una bomba
   de tiempo, y exploto cuando entraron la crew y la gema. */
.ar > b{{position:absolute;z-index:3;font-family:'Archivo','LigaEmoji',sans-serif;
  font-weight:900;line-height:1;color:#fff;white-space:nowrap;
  font-size:max(5.8px, calc(var(--d) * .235));
  padding:calc(var(--d) * .048) calc(var(--d) * .115);
  border-radius:calc(var(--d) * .22);
  background:rgba(8,10,20,.88);box-shadow:0 1px 4px rgba(0,0,0,.6)}}
{POS_CSS}
.pst span{{display:block;font-size:.32rem;font-weight:800;letter-spacing:.5px;
  opacity:.72;margin-top:7px;white-space:nowrap}}
/* ── LA GEMA DEL RANGO, en sus dos lados ────────────────────────────────
   Composicion copiada del rombo de la Competitiva (card.css:57): relleno
   oscuro, borde del acento del rango, el icono adentro. Lo que cambia es el
   CONTINENTE segun con quien convive.

   ⚠️ El de arriba va ROTADO y su icono CONTRA-ROTADO: sin eso la figura sale
   torcida 45 grados adentro del rombo. */
.gema{{position:absolute;z-index:9;display:flex;align-items:center;
  justify-content:center;border:2px solid;
  background:linear-gradient(150deg,rgba(9,9,16,.95),rgba(32,32,50,.95));
  box-shadow:0 2px 7px rgba(0,0,0,.6)}}
.gema.pie{{left:{PIE.X_FIG - PIE.LADO / 2}px;top:{y(PIE.Y_FILA)}px;
  transform:translateY(-50%);width:{PIE.LADO}px;height:{PIE.LADO}px;
  border-radius:50%}}
.gema.pie svg{{display:block}}
.gnum{{position:absolute;right:-5px;bottom:-4px;min-width:14px;height:14px;
  border-radius:7px;color:#0B0B12;font-family:'Archivo','LigaEmoji',sans-serif;
  font-size:.4rem;font-weight:900;display:flex;align-items:center;
  justify-content:center;padding:0 3px;
  box-shadow:0 1px 4px rgba(0,0,0,.7)}}
.gema.top{{right:{SEP_NUM + PIE.COL_ANCHO + 9}px;top:{y(PIE.COL_Y_OVR + 20)}px;
  width:26px;height:26px;transform:rotate(45deg);border-radius:7px}}
.gema.top u{{display:block;transform:rotate(-45deg);text-decoration:none;
  line-height:0}}
/* ⚠️ EL SELLO DE TEMPORADA. Va en la franja entre el marco —que pinta hasta
   x=295.5— y la columna —que arranca en x=285—: right:9 es el medio de esos
   10.5 px, asi que no toca ninguna de las dos.

   Se centra contra LAS STATS y no contra la carta: las cinco filas van de
   y=117 a 243, o sea centro 180, mientras que el centro de la silueta esta
   en 264.5. Acompaña al bloque de numeros, que es lo que se ve.

   translateY(-50%) porque con writing-mode el texto crece hacia abajo: sin
   eso el `top` seria su tope y no su centro, y el corrimiento CRECE con el
   largo —T1 se corre 5 px, PRE 8—.

   ⚠️ VA EN BLANCO Y ESO NO CONTRADICE HABER SACADO EL BLANCO DE LA CARTA. Lo
   que se saco fue el blanco OPACO como color de marca —marco, linea, titulo—.
   Esto es blanco TRANSPARENTE sobre la FOTO, que no controlamos, y ahi ningun
   color propio funciona: medido, el claro de DRA es #94A5FF y la foto detras
   es azul grisaceo. */
.t1{{position:absolute;right:9px;top:{y(180)}px;transform:translateY(-50%);
  z-index:9;writing-mode:vertical-rl;white-space:nowrap;
  font-family:'Archivo','LigaEmoji',sans-serif;font-weight:800;font-size:7.6px;
  letter-spacing:.22em;color:#fff;opacity:.10;line-height:1}}
.ul{{position:absolute;left:50%;transform:translateX(-50%);height:{PIE.UL_H}px;
  width:auto;z-index:9;top:{y(PIE.UL_Y)}px}}
{TIT.css(y(PIE.TAG_Y))}
""" + emblema.CSS


def croma(c):
    h = c.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return max(r, g, b) - min(r, g, b)


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    tmp = os.path.join(SCR, '_todos' + SUF)
    os.makedirs(tmp, exist_ok=True)
    hechos = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': W, 'height': ALTO},
                              device_scale_factor=ESCALA)
        for i in range(len(GENTE)):
            h = os.path.join(tmp, f'{i}.html')
            open(h, 'w', encoding='utf-8').write(
                '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
                + fuentes + CSS + '</style></head><body>'
                + carta(i, f't{i}') + '</body></html>')
            await pg.goto('file://' + h)
            await pg.wait_for_timeout(300)
            f = os.path.join(tmp, f'{i}.png')
            await pg.screenshot(path=f, omit_background=True)
            hechos.append(f)
        await b.close()

    recortar(hechos)

    cel = ''
    for i, f in enumerate(hechos):
        # ⚠️ EL PIE DE FOTO ESTABA CORRIDO UNA POSICION y decia otra cosa que
        # la carta. carta() desarma `nom, sv, rg, cc, p, pt, tot, ...`, o sea
        # que el total del servidor es el SEXTO campo; aca se saltaba `pt` y
        # se leia la POSICION DE TEMPORADA como si fuera el total. Por eso
        # Kude salia con "1 en el servidor · menos de 3: sin puesto" al lado
        # de una carta que sí dibujaba sus tres puestos: el aviso miraba pt=1
        # y la carta miraba tot. Dos lecturas del mismo dato, una mal.
        nom, sv, rg, cc, _p, _pt, tot, *_r, falso = GENTE[i]
        A = DEFS[sv][1]
        nota = ('<b style="color:#C98A4B">sin gente: no tiene columna en el '
                'Sheet</b>' if falso
                else (f'{nom.title()} · '
                      + (f'rango {rg}' if rg else '<b>sin rango todavía</b>')
                      + f' · {tot} en el servidor'
                      + ('<br><b>menos de 3: sin puesto</b>' if tot < 3 else '')))
        cel += (f'<div class="g"><div class="gl">{sv} · croma {croma(A)}</div>'
                f'<img class="z" src="{b64(f)}">'
                f'<div class="gs">{nota}</div></div>')

    hoja = f"""<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
body{{background:#0A0A10;margin:0;padding:30px;font-family:system-ui,sans-serif}}
.rot{{color:#EDEDF5;font-size:15px;font-weight:800;letter-spacing:1.3px;margin:0 0 8px}}
.d1{{color:#8A8AA0;font-size:12.5px;margin:0 0 20px;max-width:1240px;line-height:1.55}}
.fila{{display:flex;gap:16px;flex-wrap:wrap}}
.g{{text-align:center;width:{W}px;margin-bottom:20px}}
.gl{{color:#EDEDF5;font-size:11px;font-weight:800;letter-spacing:1px;margin-bottom:7px}}
.gs{{color:#7A7A90;font-size:10.5px;margin-top:7px;line-height:1.45}}
.z{{display:block;width:{W}px}}
</style></head><body>
<div class="rot">LOS DIEZ SERVIDORES</div>
<div class="d1">⚠️ <b>No es la versión final</b>: falta el marco, y los cuatro
números de la columna no existen en ningún pool.<br><br>
Esta hoja muestra lo que una sola carta no puede: cada pieza se decidió
mirando uno o dos servidores, y acá se ve si aguantan en los diez a la vez —
el <b>brillo de arriba</b> sale del color propio, que va de croma <b>42</b>
(FFA) a <b>194</b> (DRA); el <b>escudo</b> lleva contorno de dos tonos porque
el 61% cae fuera de la carta; la <b>figura del rango</b> se cruza con el fondo
en 80 combinaciones; y el <b>lavado</b> repinta el material de cada carta, o
sea un color distinto en cada una.<br><br>
⚠️ <b>Tres servidores no tienen gente, y no es que nadie juegue ahí.</b> FFA,
EFA y RZ <b>no tienen columna en el Sheet</b>, y como el servidor sale del
argmax de las 7 que sí la tienen, <b>nadie puede quedar asignado a esos
tres</b>. Van con nombre inventado y marcados.<br><br>
Los otros siete llevan gente y datos <b>reales</b> — nombre, rango, país y
<code>pos_sv</code>. Fijate en <b>URBF</b> y <b>DRA</b>: tienen 2 y 1 persona,
así que <b>el puesto no se dibuja</b> — el umbral de 3 ya rige, porque ser
«1 de 1» no dice nada.</div>
<div class="fila">{cel}</div>
</body></html>"""
    out = os.path.join(SCR, 'todos_sv%s.html' % SUF)
    open(out, 'w', encoding='utf-8').write(hoja)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1600, 'height': 1000},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'todos_sv%s.png' % SUF),
                            full_page=True)
        await b.close()
    print('-> todos_sv%s.png' % SUF)


if __name__ == '__main__':
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    asyncio.run(main())
