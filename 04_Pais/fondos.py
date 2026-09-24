"""LOS FONDOS DE LA CARTA DE PAIS — la bandera nacional de cada uno.

    python 04_Pais/ver_fondos.py             -> 04_Pais/fondos.png
    python 04_Pais/ver_fondos.py --chequear  -> ademas mide si dos se parecen

⚠️ EMPEZARON SIENDO CAMISETAS Y TERMINARON SIENDO BANDERAS, y el motivo vale
mas que el resultado. Dlx pidio primero «la camiseta oficial de su seleccion o
los colores simplemente». Las hice camisetas y al verlas dijo: «hay algunos que
no reconozco... ese verde puro que es? mexico?».

Era BOLIVIA: verde con el pie amarillo y rojo, que es su camiseta. Y ahi esta
el problema de fondo: **una camiseta la reconoce el que sigue futbol; una
bandera la reconoce cualquiera**. Con 16 paises y cinco de ellos con camiseta
roja lisa, la camiseta deja de identificar.

Ahora son las banderas, tal cual, sin estilizar.

── EL UNICO CHOQUE QUE QUEDA ES REAL ────────────────────────────────────

⚠️ COLOMBIA Y ECUADOR TIENEN LA MISMA BANDERA: amarillo la mitad, azul un
cuarto, rojo un cuarto. No es un descuido del dibujo, es asi en el mundo. Lo
unico que las separa es el escudo que Ecuador lleva al medio, asi que aca ese
escudo NO ES OPCIONAL: sin el, dos paises comparten carta.

El chequeo lo mide y lo marca. Los demas pares dan 36 o mas; ese da 14.

── QUE SE MIDE Y QUE NO ─────────────────────────────────────────────────

⚠️ LA PRIMERA VERSION DEL CHEQUEO NO SERVIA PARA BANDERAS. Comparaba «cuanto
varia por fila y por columna», que distingue rayado horizontal de vertical
pero NO distingue amarillo-azul-rojo de rojo-amarillo-verde: los dos son tres
bandas. Daba por parecidos a Colombia y Bolivia, que no se parecen en nada.

Lo que separa dos banderas es EL ORDEN DE SUS COLORES, asi que ahora la firma
es el perfil: el color medio de 16 fajas horizontales y 8 verticales.

── LOS ESCUDOS DEL MEDIO ────────────────────────────────────────────────

Mexico y Guatemala lo tenian y se lo saque: a este tamaño un circulo marron no
se lee como un aguila, se lee como una mancha. Verde-blanco-rojo vertical ya
es Mexico. Ecuador lo conserva porque sin el es Colombia, que es otra cosa.
"""

import base64
import os
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)


def t(c, f):
    """Aclara (f>0) u oscurece (f<0) un color. Copiada de los_nueve.py."""
    h = c.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    if f >= 0:
        r, g, b = (int(x + (255 - x) * f) for x in (r, g, b))
    else:
        r, g, b = (int(x * (1 + f)) for x in (r, g, b))
    return '#%02X%02X%02X' % (r, g, b)


# ══ LA DEFINICION CANONICA DE CADA FONDO ══
# cc: (acento, base, fondo css, capa extra css, pais, descripcion)
#
# Mismo formato que los_nueve.py a proposito: si algun dia las dos cartas se
# comparan lado a lado, se comparan con la misma vara.
def defs():
    d = {}

    # ── ARGENTINA ───────────────────────────────────────────────────────
    A, B = '#75AADB', '#FFFFFF'
    d['ar'] = (B, A,
               f'linear-gradient(180deg,{A} 0 33%,{B} 33% 67%,{A} 67% 100%)',
               # ⚠️ SIN LOS RAYOS. Dlx los saco. Y ademas del gusto habia un
               # motivo: el conic-gradient barria LA CARTA ENTERA, no el sol,
               # asi que los rayos cruzaban las tres franjas y la bandera
               # dejaba de leerse como bandera. El sol solo alcanza.
               'radial-gradient(circle at 50% 50%,#E3AE22 0 20px,transparent 21px)',
               'Argentina', 'celeste, blanco y el sol')

    # ── CHILE ───────────────────────────────────────────────────────────
    A, B = '#D52B1E', '#0039A6'
    d['cl'] = (B, A,
               f'linear-gradient(180deg,#F2F2F5 0 50%,{A} 50% 100%)',
               'radial-gradient(circle at 16.5% 25%,#FFFFFF 0 16px,transparent 17px),'
               f'linear-gradient(90deg,{B} 0 33%,transparent 33%) 0 0/100% 50% no-repeat',
               'Chile', 'el cuadro azul con la estrella, blanco y rojo')

    # ── COLOMBIA ────────────────────────────────────────────────────────
    # ⚠️ LA BANDERA DE COLOMBIA Y LA DE ECUADOR SON LA MISMA: amarillo la
    # mitad, azul un cuarto, rojo un cuarto. Lo unico que las separa en la
    # realidad es el escudo que Ecuador lleva al medio, asi que aca tambien.
    A, B = '#FCD116', '#003895'
    d['co'] = (B, A,
               f'linear-gradient(180deg,{A} 0 50%,{B} 50% 75%,#CE1126 75% 100%)',
               '', 'Colombia', 'amarillo la mitad, azul y rojo')

    # ── MEXICO ──────────────────────────────────────────────────────────
    A, B = '#046A38', '#CE1126'
    d['mx'] = (B, A,
               f'linear-gradient(90deg,{A} 0 33%,#FFFFFF 33% 67%,{B} 67% 100%)',
               # ⚠️ SIN EL PUNTO DEL ESCUDO. Lo tenia como un circulo marron al
               # medio y a este tamaño no se lee como un aguila, se lee como
               # una mancha. Verde-blanco-rojo vertical ya es Mexico y no se
               # confunde con nadie: el unico otro vertical de tres es Peru,
               # que es rojo-blanco-rojo.
               '',
               'México', 'verde, blanco y rojo verticales')

    # ── VENEZUELA ───────────────────────────────────────────────────────
    A, B = '#00247D', '#FFCC00'
    d['ve'] = (B, A,
               f'linear-gradient(180deg,{B} 0 33%,{A} 33% 67%,#CF142B 67% 100%)',
               'radial-gradient(circle at 26% 54%,#FFF 0 5px,transparent 6px),'
               'radial-gradient(circle at 37% 46%,#FFF 0 5px,transparent 6px),'
               'radial-gradient(circle at 50% 43%,#FFF 0 5px,transparent 6px),'
               'radial-gradient(circle at 63% 46%,#FFF 0 5px,transparent 6px),'
               'radial-gradient(circle at 74% 54%,#FFF 0 5px,transparent 6px)',
               'Venezuela', 'amarillo, azul con las estrellas, y rojo')

    # ── PERU ────────────────────────────────────────────────────────────
    A, B = '#D91023', '#FFFFFF'
    d['pe'] = (B, A,
               f'linear-gradient(90deg,{A} 0 33%,{B} 33% 67%,{A} 67% 100%)',
               '', 'Perú', 'rojo, blanco y rojo verticales')

    # ── ESPAÑA ──────────────────────────────────────────────────────────
    A, B = '#C60B1E', '#FFC400'
    d['es'] = (B, A,
               f'linear-gradient(180deg,{A} 0 25%,{B} 25% 75%,{A} 75% 100%)',
               '', 'España', 'roja con la franja amarilla al doble')

    # ── URUGUAY ─────────────────────────────────────────────────────────
    # ⚠️ EL CANTON VA ENTERO Y ARRIBA DEL RAYADO. La primera version dejaba
    # asomar un pedazo de franja azul en la esquina de arriba a la derecha,
    # porque el blanco del canton tapaba solo hasta el 48% del ancho pero el
    # rayado seguia corriendo por debajo hasta el 33% del alto. El canton de
    # la bandera de Uruguay es un CUADRADO blanco: tiene que tapar todo su
    # rectangulo, no una parte.
    A, B = '#4FA3D9', '#FFFFFF'
    d['uy'] = (B, A,
               f'repeating-linear-gradient(180deg,{B} 0 51.4px,{A} 51.4px 102.8px)',
               # ⚠️ EL SOL VA COMO DISCO, sin rayos, por lo mismo que Argentina.
               # Aca ademas los rayos se CORTABAN EN SECO contra el borde del
               # canton —estaban recortados a su rectangulo— y ese corte recto
               # se leia como un error de dibujo, no como un sol.
               'radial-gradient(circle at 22% 13%,#E3AE22 0 19px,transparent 20px),'
               f'linear-gradient(90deg,{B} 0 100%) 0 0/44% 26% no-repeat',
               'Uruguay', 'las nueve franjas y el sol en el cantón')

    # ── ECUADOR ─────────────────────────────────────────────────────────
    # ⚠️ MISMA BANDERA QUE COLOMBIA. Lo unico que las separa es el escudo del
    # medio, asi que aca va si o si: sin el, las dos cartas son la misma.
    A, B = '#FFD100', '#0F3F87'
    d['ec'] = (B, A,
               f'linear-gradient(180deg,{A} 0 50%,{B} 50% 75%,#EF3340 75% 100%)',
               'radial-gradient(circle at 50% 40%,#E8B23A 0 7px,transparent 8px),'
               'radial-gradient(ellipse 22px 30px at 50% 50%,rgba(30,92,164,.95) '
               '0 96%,transparent 97%),'
               'radial-gradient(ellipse 33px 43px at 50% 50%,rgba(246,246,250,.96) '
               '0 96%,transparent 97%)',
               'Ecuador', 'la misma que Colombia, con el escudo al medio')

    # ── PANAMA ──────────────────────────────────────────────────────────
    A, B = '#DA121A', '#072357'
    d['pa'] = (B, A,
               f'linear-gradient(90deg,#FFFFFF 0 50%,{A} 50% 100%) 0 0/100% 50% no-repeat,'
               f'linear-gradient(90deg,{B} 0 50%,#FFFFFF 50% 100%) 0 100%/100% 50% no-repeat',
               f'radial-gradient(circle at 25% 25%,{B} 0 15px,transparent 16px),'
               f'radial-gradient(circle at 75% 75%,{A} 0 15px,transparent 16px)',
               'Panamá', 'los cuatro cuartos con sus dos estrellas')

    # ── ESTADOS UNIDOS ──────────────────────────────────────────────────
    A, B = '#0A2A5E', '#BF0A30'
    d['us'] = (B, A,
               f'repeating-linear-gradient(180deg,{B} 0 26px,#F2F2F5 26px 52px)',
               f'linear-gradient(90deg,{A} 0 42%,transparent 42%) 0 0/100% 39% no-repeat,'
               'radial-gradient(circle at 11% 8%,#FFF 0 4px,transparent 5px),'
               'radial-gradient(circle at 25% 8%,#FFF 0 4px,transparent 5px),'
               'radial-gradient(circle at 18% 18%,#FFF 0 4px,transparent 5px),'
               'radial-gradient(circle at 11% 28%,#FFF 0 4px,transparent 5px),'
               'radial-gradient(circle at 25% 28%,#FFF 0 4px,transparent 5px)',
               'Estados Unidos', 'el cantón azul y las barras')

    # ── PUERTO RICO ─────────────────────────────────────────────────────
    A, B = '#CC2027', '#0050A0'
    d['pr'] = (B, A,
               f'repeating-linear-gradient(180deg,{A} 0 46px,#F2F2F5 46px 92px)',
               f'linear-gradient(115deg,{B} 0 30%,transparent 30%),'
               'radial-gradient(circle at 11% 47%,#FFFFFF 0 12px,transparent 13px)',
               'Puerto Rico', 'las cinco franjas y el triángulo con la estrella')

    # ── BOLIVIA ─────────────────────────────────────────────────────────
    # ⚠️ ROJO ARRIBA, NO VERDE. Yo lo tenia al reves —verde con el pie
    # amarillo y rojo— porque estaba dibujando su CAMISETA. Su bandera va
    # rojo, amarillo y verde de arriba a abajo. Dlx preguntó justamente
    # "ese verde puro que es? mexico?": era este, y no se reconocia.
    A, B = '#007A33', '#F4E400'
    d['bo'] = (B, A,
               f'linear-gradient(180deg,#D52B1E 0 33%,{B} 33% 67%,{A} 67% 100%)',
               '', 'Bolivia', 'rojo, amarillo y verde')

    # ── REPUBLICA DOMINICANA ────────────────────────────────────────────
    A, B = '#002D62', '#CE1126'
    d['do'] = (B, A,
               f'linear-gradient(90deg,{A} 0 50%,{B} 50% 100%) 0 0/100% 50% no-repeat,'
               f'linear-gradient(90deg,{B} 0 50%,{A} 50% 100%) 0 100%/100% 50% no-repeat',
               'linear-gradient(90deg,transparent 0 45%,#FFFFFF 45% 55%,transparent 55%),'
               'linear-gradient(180deg,transparent 0 46%,#FFFFFF 46% 54%,transparent 54%)',
               'Rep. Dominicana', 'la cruz blanca sobre los cuatro cuartos')

    # ── GUATEMALA ───────────────────────────────────────────────────────
    A, B = '#4997D0', '#FFFFFF'
    d['gt'] = (B, A,
               f'linear-gradient(90deg,{A} 0 33%,{B} 33% 67%,{A} 67% 100%)',
               # sin el escudo, por lo mismo que Mexico
               '',
               'Guatemala', 'celeste, blanco y celeste verticales')

    # ── HONDURAS ────────────────────────────────────────────────────────
    A, B = '#0073CF', '#FFFFFF'
    d['hn'] = (B, A,
               f'linear-gradient(180deg,{A} 0 33%,{B} 33% 67%,{A} 67% 100%)',
               'radial-gradient(circle at 50% 50%,#3E82C4 0 7px,transparent 8px),'
               'radial-gradient(circle at 35% 42%,#3E82C4 0 7px,transparent 8px),'
               'radial-gradient(circle at 65% 42%,#3E82C4 0 7px,transparent 8px),'
               'radial-gradient(circle at 35% 58%,#3E82C4 0 7px,transparent 8px),'
               'radial-gradient(circle at 65% 58%,#3E82C4 0 7px,transparent 8px)',
               'Honduras', 'azul y blanco con las cinco estrellas')

    # ── SIN PAIS ────────────────────────────────────────────────────────
    # ⚠️ NO ES UN CASO RARO: en el Sheet son 145 raperos sin bandera, mas que
    # cualquier pais salvo Argentina. Con carta hoy hay uno solo, pero cuando
    # se verifiquen los roles de pais ese numero se mueve fuerte.
    A, B = '#3A3F4B', '#8B93A6'
    d['??'] = (B, A,
               f'linear-gradient(180deg,{t(A,.1)} 0%,{t(A,-.45)} 100%)',
               'repeating-linear-gradient(45deg,rgba(255,255,255,.045) 0 8px,'
               'transparent 8px 16px)',
               'Sin país', 'gris neutro, a la espera de la verificación')

    return d


ORDEN = ['ar', 'cl', 'co', 'mx', 've', 'pe', 'es', 'uy', 'ec',
         'pa', 'us', 'pr', 'bo', 'do', 'gt', 'hn', '??']


# ══ EL VELO ══
# ⚠️ SIN ESTO LA CARTA NO SE PUEDE LEER, Y NO ES OPINION. Medido el contraste
# del blanco contra cada fondo, en su parte mas clara:
#
#     12 de 17 quedan por DEBAJO de 3.0, que es el minimo de WCAG hasta para
#     texto grande. Argentina y Dominicana dan 1.00 — o sea blanco sobre
#     blanco, cero.
#
# La bandera esta bien como IDENTIDAD y es imposible como SUPERFICIE: arriba
# van un numero grande, un nombre y cinco stats. Es la misma estructura que
# ya tienen las otras dos cartas — la Servidor apoya su pie en un panel y la
# Temporada oscurece la foto— asi que aca no se inventa nada.
#
# El velo NO es parejo: arriba deja ver la bandera —ahi va la foto, que tapa
# igual— y baja cerrando hacia el pie, que es donde vive el texto.
# ⚠️ SUAVIZADO. La primera version cerraba en .93 y Dlx dijo que era mucho:
# tapaba la bandera justo donde se reconoce. Ahora arranca en CERO y solo
# cierra en el ultimo tercio. Verificado que sigue alcanzando: medido el
# contraste del blanco contra el PIE de cada carta, ver aguanta.
# ══ EL MATERIAL ══
# ⚠️ SIN ESTO LAS BANDERAS SON PLANAS Y SE VEN COMO UN PNG PEGADO, no como
# una carta. Dlx: «intenta mejorar la estetica, quizas ahi añadir sombras o
# texturas estaria bueno».
#
# Quedan DOS capas y cada una hace una cosa distinta:
#
#   VIÑETA   oscurece las esquinas. Es lo que le da CUERPO: sin ella el
#            recorte del escudo se lee como una calcomania.
#   BRILLO   una luz suave arriba, como la que tienen las otras dos cartas
#            (comun/brillo.py). Da la sensacion de superficie.
#
# ⚠️ HABIA UNA TERCERA —EL TEJIDO— Y SE SACO. Eran dos diagonales cruzadas al
# 3.5% y 5%, la misma idea de la greca y del rayado de los_nueve. Dlx: «hay
# una textura en la seccion de arriba donde esta el avatar y abajo donde esta
# el tag, quita esas 2 texturas». **No eran dos: era esta, vista en los dos
# unicos lugares donde nada la tapa.** Medido apagandola sola, sobre KONAN:
#
#   | zona                      | media | max |
#   |---------------------------|-------|-----|
#   | arriba, sobre la foto     |  0.11 |   8 |
#   | abajo, detras del TAG     |  0.26 |   3 |
#   | la bandera bajo las stats |  0.59 |   5 |
#   | el panel izquierdo        |  0.15 |   2 |
#
# O sea que en el medio de la carta no aportaba casi nada —la foto, la banda
# del nombre y la sombra de las stats se la comen— y donde SI se veia era
# justo encima de la cara. Que la trama de la banda del nombre (TEXTURA[rg])
# y los puntos del panel se quedan: esas dos SI son de ellos y se eligieron
# a mano.
#
# ⚠️ VAN MUY BAJAS A PROPOSITO: la viñeta es lo unico que pasa del 5%. Una
# textura que se nota es una textura que compite con la bandera, y la
# bandera es lo unico que esta carta tiene para identificar al pais.
#
# ⚠️ ES UNA TUPLA, NO UNA CADENA, Y ESO IMPORTA. `fondo()` arma un
# background-size y un background-position POR CAPA, y antes contaba el
# MATERIAL como UNA. Con cuatro sub-capas la cuenta daba 6 capas contra 3
# tamaños, que en CSS se repiten ciclicamente y la bandera caia justo en el
# ultimo del ciclo: **andaba de casualidad**. Al bajar a dos sub-capas la
# cuenta daba 4 contra 3 y la bandera se dibujaba con `auto`, o sea corrida
# y sin estirar. Ahora se cuentan de verdad.
MATERIAL_CAPAS = (
    'radial-gradient(ellipse 80% 64% at 50% 40%,transparent 38%,'
    'rgba(6,8,16,.46) 100%)',
    'linear-gradient(179deg,rgba(255,255,255,.17) 0%,'
    'rgba(255,255,255,.05) 16%,transparent 32%)',
)
MATERIAL = ','.join(MATERIAL_CAPAS)

VELO = ('linear-gradient(180deg,rgba(8,10,18,0) 0%,rgba(8,10,18,.05) 44%,'
        'rgba(8,10,18,.30) 64%,rgba(8,10,18,.72) 85%,rgba(8,10,18,.84) 100%)')


def css(cc, velo=True):
    """El CSS del fondo de un país, listo para meter en un style.

    ⚠️ `velo` viene en True a proposito: sin el, 12 de 17 no se pueden leer.
    Se apaga solo para MIRAR la bandera, nunca para dibujar una carta.
    """
    # 🔴 UN PAIS QUE NO ESTA NO PUEDE TUMBAR LA TANDA. Esto era
    # `defs()[cc]` y el 23/09/2026 entró **Azerbaiyán** —`Garxziiscity
    # 🇦🇿🇲🇽🇻🇪🇦🇷`— así que la corrida del ciclo murió con `KeyError: 'az'`
    # y se perdieron las **39 cartas de País** de esa tanda, incluidas
    # las 38 de gente cuyo país sí está.
    #
    # ⚠️ Y `??` EXISTE JUSTO PARA ESTO: es el fallback declarado, con su
    # línea en `CLAUDE.md` —*«`??` no tiene bandera, son el fallback si
    # falta un archivo»*—. El mecanismo estaba y el lookup no lo usaba.
    #
    # ⚠️ Es la familia de «el pool vacío es un ESTADO, no un error»: que
    # entre alguien de un país nuevo es lo normal en una liga que crece,
    # no un caso raro. Lo que hay que evitar es inventarle una bandera;
    # salir con el fondo neutro es la respuesta honesta.
    d = defs()
    a, b, fondo, extra, _p, _d = d.get(cc) or d['??']
    capas = (([VELO] if velo else []) + list(MATERIAL_CAPAS)
             + [x for x in (extra, fondo) if x])
    return 'background:%s' % ','.join(capas)


# ══ LAS BANDERAS DE VERDAD ══
# ⚠️ ESTAS 17 DEFINICIONES CSS SE QUEDAN, PERO YA NO PINTAN LA CARTA. Dlx:
# "honestamente la de ecuador es horrible, ¿podes usar las banderas oficiales
# de una web en vez de dibujarlas vos?". Tenia razon y el caso lo demuestra
# solo: el escudo de Ecuador dibujado a mano era un ovalo celeste, y el de
# verdad tiene el condor, el Chimborazo y el sol. Lo mismo con Mexico, España,
# Bolivia, Guatemala y Dominicana — seis de diecisiete son banderas CON
# ESCUDO, y un escudo no se aproxima con gradientes.
#
# Siguen aca por tres motivos que no son nostalgia:
#   1. '??' no tiene bandera y necesita algo que pintar;
#   2. son el fallback si algun archivo falta;
#   3. documentan que colores lleva cada una, que es lo que el chequeo de
#      ver_fondos.py compara.
#
# ⚠️ LOS ARCHIVOS VIVEN EN EL REPO, no se bajan al generar. Es la misma regla
# que ya obliga a embeber avatares, escudos y fuentes: Chromium no llega a
# ningun CDN desde el entorno aislado del render. Se bajaron una vez de
# flagcdn.com a 1280 de ancho.
BANDERAS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'banderas')
# ⚠️ HAY DOS JUEGOS Y CADA UNO SIRVE PARA UNA COSA. Las de banderas/ son las
# oficiales, 3:2, y van en el CHIP, que tambien es 3:2 — ahi no hay nada que
# corregir. Las de banderas_carta/ estan preparadas para la proporcion de la
# carta por herramientas/banderas_carta.py: sus franjas ya vienen estiradas y
# su escudo ya viene a su proporcion, asi que la carta las dibuja al 100% 100%
# sin deformar nada. Drako: "como que estan muy estiradas".
BANDERAS_CARTA = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                              'banderas_carta')

# ⚠️ LA BANDERA VA ESTIRADA, NO RECORTADA, y eso se decidio mirando el peor
# caso y no el promedio. La carta es 300x463 y una bandera es 3:2, asi que hay
# tres formas de encajarla y las tres se probaron:
#
#   cover        se escala por el alto y se ve la franja central, del 28% al
#                72%. Los escudos salen sin deformar y las de franjas
#                horizontales quedan perfectas. Pero PERU QUEDA TODO BLANCO:
#                su tercio central es blanco y el recorte no llega a los rojos.
#                Uruguay pierde el sol, que vive en la esquina. Una bandera que
#                no se puede reconocer no es una bandera.
#   al ancho     la bandera arriba y el color del pie estirado abajo. El escudo
#                queda enorme y la mitad de abajo es un plano liso.
#   estirada     100% 100%. Todas siguen siendo reconocibles —Peru con sus
#                rojos, Uruguay con su sol— y el precio es 1.54x de alto en el
#                escudo, que es UNIFORME y conocido.
#
# Se elige estirada porque es UNA regla que sirve para las dieciseis. Con
# cover harian falta posiciones a mano pais por pais, y cada pais nuevo
# pediria otra decision.
#
# ⚠️ Y el estirado importa menos de lo que parece: el escudo cae detras de la
# foto y de la banda del nombre, y el VELO oscurece de 64% para abajo.
TAMANO = '100% 100%'

# ══ EL CORTE DE LA BANDERA CAE EN LA BANDA DEL NOMBRE ══
# Dlx: "cuando las banderas son horizontales, ¿podes hacer que la linea tape el
# cambio de color? en argentina estirar el celeste hacia arriba para que choque
# con el panel del nombre, y en ecuador bajar un poquito para que el azul quede
# debajo".
#
# ⚠️ NO ES DECORACION: UN CORTE SUELTO COMPITE CON LA BANDA. La banda del
# nombre es una linea horizontal fuerte a media carta, y la bandera trae la
# suya propia unos pixeles mas arriba o mas abajo. Dos horizontales casi
# alineadas se leen como un error de alineacion, no como dos cosas distintas.
# Haciendolas coincidir, el corte deja de existir como linea aparte.
#
# La fraccion de cada bandera salio de medir el PNG —filas donde el color medio
# salta— y quedarse con el corte mas cercano a un borde de la banda:
#
#   pais  cortes           elegido   hay que mover
#   ar    .33 .67            .67       -11.8 px
#   co    .50 .75            .50       +12.2
#   ve    .33 .67            .67       -11.7
#   uy    nueve franjas      .56       -10.4
#   ec    .50 .75            .50       +12.2
#   pa    .22 .50            .50       +12.2
#   us    trece franjas      .54        -3.5
#   pr    .20 .40 .60 .80    .60       +15.2
#   bo    .33 .67            .67       -12.0
#   hn    .33 .67            .67       -11.6
#
# ⚠️ LAS SEIS QUE FALTAN NO ESTAN OLVIDADAS: Chile, Mexico, Peru, España,
# Dominicana y Guatemala tienen franjas VERTICALES o un dibujo que cruza, o
# sea que no tienen un corte horizontal que alinear. Se dejan como estan.
# ⚠️ CUATRO DECIMALES Y NO DOS. Con .67 el corte quedaba 2.2 px del borde de
# la banda, y no por el metodo: un tercio es .6667, y esos .0033 de diferencia
# sobre una bandera estirada a 442 px son 1.5 px. La fraccion se saca del
# centro de masa del salto de color, no del primer pixel que cambia, porque el
# PNG trae el borde suavizado y el primer pixel llega antes que el corte.
CORTE = {'ar': .6661, 'co': .4994, 've': .6662, 'uy': .5551, 'ec': .4996,
         'pa': .4994, 'us': .5378, 'pr': .5993, 'bo': .6661, 'hn': .6660}


def encaje(cc, h, banda):
    """(background-size, background-position) para que el corte caiga ahi.

    ⚠️ MOVER LA BANDERA OBLIGA A AGRANDARLA, y ese es todo el problema. Si se
    la corre hacia arriba deja el pie descubierto, y si se la corre hacia
    abajo deja el techo. Asi que hay que resolver las tres cosas juntas: el
    corte en su sitio, el techo tapado y el pie tapado.

        corte:  b * hf + y0 = t
        techo:  y0 <= 0
        pie:    y0 + hf >= h

    De ahi sale hf = max(t/b, (h-t)/(1-b)) y el resto es despejar. Da estirones
    de 2 a 10%, o sea que la bandera se agranda MENOS de lo que ya se agranda
    al llenar la carta.

    ⚠️ Y SE ESTIRA, NO SE REPITE. Repetir la mostraria dos veces; estirar solo
    agranda franjas que ya son planas de color.
    """
    b = CORTE.get(cc)
    if b is None:
        return TAMANO, 'center'
    t = min(banda, key=lambda y: abs(y - b * h))
    hf = max(t / b, (h - t) / (1 - b))
    return '100%% %.1fpx' % hf, 'center %.1fpx' % (t - b * hf)


def imagen(cc, para='chip'):
    """El PNG de la bandera en base64, o None si no hay."""
    d = BANDERAS_CARTA if para == 'carta' else BANDERAS
    p = os.path.join(d, '%s.png' % cc)
    if not os.path.exists(p):
        return None
    with open(p, 'rb') as f:
        return 'data:image/png;base64,' + base64.b64encode(f.read()).decode()


def fondo(cc, velo=True, h=None, banda=None):
    """(capas, tamaños, posiciones) del fondo de un pais, para el style.

    Devuelve tres cadenas porque una imagen necesita su background-size y su
    background-position, y esas propiedades se escriben por capa: si la
    bandera es la ultima de tres, su tamaño tiene que ser el tercer valor.
    """
    img = imagen(cc, 'carta')
    if img is None:
        return css(cc, velo).replace('background:', ''), None, None
    # ⚠️ MATERIAL_CAPAS SE DESARMA, no se mete como una sola. Los tamaños y
    # las posiciones de abajo se cuentan CON len(capas), asi que si el
    # material entrara como una cadena con comas adentro la cuenta quedaria
    # corta y la bandera —que es la ultima— se dibujaria con el tamaño de
    # otra capa. Ver el comentario de MATERIAL_CAPAS.
    capas = (([VELO] if velo else []) + list(MATERIAL_CAPAS)
             + ['url(%s)' % img])
    t, pp = (encaje(cc, h, banda) if h and banda else (TAMANO, 'center'))
    tam = ['auto'] * (len(capas) - 1) + [t]
    pos = ['center'] * (len(capas) - 1) + [pp]
    # ⚠️ EL CHEQUEO NO ES DECORACION: es lo unico que avisa si alguien vuelve
    # a meter varias capas en una sola cadena. Sin el, la bandera se dibuja
    # con el tamaño de otra capa y la carta sale igual de bien formada.
    assert len(capas) == len(tam) == len(pos), (
        'el fondo de %s tiene %d capas, %d tamaños y %d posiciones'
        % (cc, len(capas), len(tam), len(pos)))
    assert capas[-1].startswith('url('), (
        'la bandera de %s no es la ultima capa' % cc)
    return ','.join(capas), ','.join(tam), ','.join(pos)


def _self_check():
    """python 04_Pais/fondos.py --auto"""
    import glob
    import io as _io
    import re as _re
    import sys as _sys
    try:
        _sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:                                    # noqa: BLE001
        pass
    print('\n  fondos.py — self-check\n')
    mal = 0

    def ok(cond, que):
        nonlocal mal
        mal += not cond
        print('   %s %s' % ('ok' if cond else '🔴', que))

    d = defs()
    ok('??' in d, 'existe el fallback `??`')
    for cc in ('ar', 'az', 'xx', '', None):
        try:
            css(cc)
            bien = True
        except Exception as e:                           # noqa: BLE001
            bien = False
            print('      %r -> %s' % (cc, e))
        ok(bien, 'css(%r) no revienta' % cc)

    # 🔴 EL GUARDIAN DE VERDAD: QUE NO QUEDE OTRO `defs()[cc]` SUELTO.
    #
    # El 23/09/2026 entró Azerbaiyán y el ciclo murió con
    # `KeyError: 'az'`, perdiendo las 39 cartas de País de la tanda.
    # Arreglé el lookup de `css()` y **la corrida siguiente volvió a
    # morir igual**: había dos, y el que dibuja la carta era el otro
    # (`maqueta.py`). Arreglar uno de dos deja el bug con la misma cara.
    #
    # ⚠️ Por eso esto no prueba un caso, prueba que no haya otro lugar:
    # es la diferencia entre tapar el agujero que se vio y cerrar la
    # forma. El día que alguien agregue un tercero, esto grita acá en
    # vez de en una corrida de la nube dos semanas después.
    # ⚠️ POR AST Y NO POR REGEX. La primera version buscaba el texto
    # `defs()[` y marco tres lineas que eran **comentarios** —incluido
    # este—. Un chequeo que se acusa a si mismo no se puede dejar
    # encendido, y bajarle la exigencia para que calle lo habria dejado
    # sin dientes. El arbol ve subindices de verdad y nada mas.
    import ast as _ast
    malos = []
    for f in sorted(glob.glob(os.path.join(SCR, '*.py'))):
        if os.path.basename(f) in ('ver_fondos.py',):
            continue        # herramienta de diagnostico, se corre a mano
        try:
            arbol = _ast.parse(_io.open(f, encoding='utf-8').read())
        except SyntaxError:
            continue
        for nodo in _ast.walk(arbol):
            if not isinstance(nodo, _ast.Subscript):
                continue
            v = nodo.value
            if (isinstance(v, _ast.Call) and isinstance(v.func, _ast.Name)
                    and v.func.id == 'defs'):
                malos.append('%s:%d' % (os.path.basename(f), nodo.lineno))
    ok(not malos, 'nadie indexa `defs()[...]` sin fallback  %s' % (malos or ''))

    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


if __name__ == '__main__':
    import sys as _s
    raise SystemExit(_self_check() if '--auto' in _s.argv else 0)
