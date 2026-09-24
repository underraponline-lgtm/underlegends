"""QUÉ HACE FALTA PARA CADA CARTA — un solo lugar.

    from comun.requisitos import falta, REQUISITOS
    falta('competitivo', persona)   -> None si la tiene, o (cuánto, de cuánto, qué)

⚠️ **YA NO HAY UN SOLO CORTE DE 8.** Hasta el 16/09/2026 el proyecto entero
descansaba en una línea de `CLAUDE.md`: *«el pool de las cartas son los que
tienen 8 o más eventos: 138 de 735. Ese mismo corte desbloquea el Win%, el
rango competitivo y la carta»*. Dlx lo partió en cuatro:

| carta | requisito |
|---|---|
| **Temporada** | 1 **participación** |
| **Competitivo** | 10 eventos |
| **País** | 1 bandera asignada + 3 duelos nacionales + 3 internacionales |
| **Servidor** | nada |

⚠️ **ESTA TABLA SE MOVIO DOS VECES Y LA DE ACÁ ARRIBA QUEDÓ VIEJA LAS DOS.**
Decía *«Temporada: 2 eventos»* y *«País: 1 evento nacional»* cuando `REQUISITOS`
ya decía otra cosa treinta líneas más abajo, en el mismo archivo. La regla de
siempre, aplicada a un docstring: **la fuente es el dict, no el comentario** —
si hay que elegir cuál creer, correr `python comun/requisitos.py`, que imprime
la tabla desde `REQUISITOS` y por eso no puede mentir.

🔴 **Y HAY UN SEGUNDO CORTE QUE NO ES DE EVENTOS Y NO VIVE ACÁ: LA IDENTIDAD.**
Dlx, 19/09/2026: *«para alguien tener tarjeta competitiva necesita estar sí o
sí en DRA, estar verificado y con ID también, aparte de los requisitos q ya
tiene»*. O sea que para tener carta hacen falta **las dos cosas**:

1. **identidad** — `discord_id` cargado + estar en DRA + tener el rol Miembro;
2. **el requisito de esa carta** — los eventos de la tabla de arriba.

⚠️ **ESE PRIMER CORTE NO VA EN ESTE ARCHIVO, Y ES A PROPÓSITO.** Acá se mide
desempeño, que sale del Sheet. La identidad se pregunta **a Discord**, decide
*quién entra al pool* y va en el builder, **antes de dibujar**. Mezclarlos
haría que este módulo necesite red y un token para contestar algo que hoy
contesta con un número. Está documentado en `docs/sheet_t1.md`, y
`herramientas/en_dra.py` es el que lo mide.

⚠️ **EL REQUISITO BLOQUEA LA CARTA, NO EL DATO. Y ESA DISTINCIÓN ES NUEVA.**
El 8 era las dos cosas a la vez, así que no había que separarlas. Ahora sí:

- El **rango** es uno solo por persona y tiene que dar igual en sus cuatro
  cartas — es la primera regla de `CLAUDE.md`. Sale del Score competitivo.
- Si subir el Competitivo a 10 sacara a esa gente **del pool**, los 22 que
  caen se quedarían **sin rango en su carta de Temporada**, que sí tienen
  derecho a ver.

Por eso los pools no se tocan: cada carta pregunta por su requisito **antes de
dibujar**, y si no llega devuelve la Bloqueada. Los pools siguen siendo la
fuente del dato.

⚠️ **CUÁNTOS PASAN HOY NO SE ESCRIBE ACÁ: LO IMPRIME EL SELF-CHECK.** Había
una tabla con *«Temporada 138 · Competitivo 116 · País 0 · Servidor 138»* y los
cuatro números eran de la **pre-temporada**, que se borró el 22/09/2026 — o
sea, de un mundo que ya no existe. `python comun/requisitos.py` los cuenta
contra el pool del día y además avisa cuando **no hay con qué medirlos**, que
es la respuesta que un número escrito a mano nunca puede dar.

Lo que sí es estructural y por eso se queda escrito:

- **El pool ya no está filtrado en 8.** Desde el 22/09/2026 su piso sale de
  acá mismo —el requisito más flojo— así que los de 2..7 **sí** están en
  `datos/`. Ver `sheet/construir_pool_temporada.py`.
- **«Sin requisito» no es «todos».** El `sv` de la Servidor sale del argmax de
  las columnas por servidor: quien no jugó nada no tiene servidor asignado.

⚠️ **Que País dé CERO no es un error del código.** Es el requisito funcionando:
pide **duelos** —tres contra compatriotas y tres contra el resto— y la hoja
`1v1` quedó vacía con el reset del 22/09/2026. Se desbloquea sola en cuanto
se carguen duelos, sin tocar nada acá.

⚠️ **Esta línea decía «el día que exista la primera Fecha FIFA».** Era cierto
con el requisito viejo —1 evento nacional— y dejó de serlo el 22/09: hoy lo
que falta no es un torneo, son filas en `1v1`. Dos causas muy distintas
dando el mismo cero.
"""
import os
import re
import sys
import unicodedata

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)

# (cuántos, de qué, cómo se dice en la Bloqueada)
# ⚠️ EL PLURAL VA APARTE porque "1 EVENTOS NACIONALES" se lee mal y el
# requisito de Pais es JUSTAMENTE de uno. Se guardan las dos formas en vez de
# quitarle la 's' a la cadena: hay idiomas y palabras donde eso no alcanza, y
# esto lo lee la carta.
#
# ⚠️ LA SERVIDOR FUE Y VOLVIO, Y EL VIAJE DE IDA Y VUELTA ES LO QUE HAY QUE
# LEER. El 16/09/2026 dejo de ser "sin requisito" y paso a pedir **1 evento en
# {sv}**: Dlx habia decidido que `/card` abriera en la carta del servidor
# donde escribiste, asi que la pregunta dejo de ser "¿llegas?" para ser
# "¿llegas ACA?". Fue el primer requisito con parametro, y por eso el texto
# trae `{sv}` y `falta()` acepta `sv=`.
#
# El 17/09/2026 Dlx lo derogo, mirando el menu del bot: *«el servidor siempre
# va a estar desbloqueado»*. Lo que se vio al usarlo es que el candado mentia
# — de los nueve servidores, ocho decian «te falta 1 evento en X» a alguien
# que **ni siquiera esta en X**. Lo que te separa de la carta de TWR no es un
# evento: es no estar en TWR. Por eso el bot ahora manda la invitacion.
#
# ⚠️ SE DEJA EN 0 Y NO SE BORRA LA ENTRADA. `falta('servidor', p)` tiene que
# seguir contestando None sin reventar, porque lo llaman los generadores. Y el
# texto con `{sv}` se queda: es el unico ejemplo de requisito con parametro
# que hay en el proyecto, y el dia que Pais necesite uno por competencia va a
# hacer falta de nuevo.
# 🔴 REESCRITOS EL 19/09/2026. Dlx: *«hay que pensar bien los requisitos de
# cada uno»*. Lo que cambió y por qué:
#
# · **Temporada: de 2 eventos a 1 de CUALQUIER actividad.** Dlx: «1
#   misión/evento/MW», y confirmó que alcanza con una de las tres. El campo
#   pasa a ser `actividad`, que suma las tres en vez de mirar sólo `ev`: pedir
#   dos eventos dejaba afuera a quien hizo una misión y una MW, que participó
#   igual. La Temporada mide **que estuviste**, no cuánto.
#
# · **País: deja de pedir eventos.** Antes pedía «1 evento nacional», que
#   **nadie cumple** —no hubo ninguno, arrancan en la T2— así que el requisito
#   bloqueaba a las 735 personas para siempre. Dlx: «la de países tiene que
#   tener un país asignado en el Sheet... esa tarjeta calcula en base a
#   nacionales, por eso es tarjeta de países». O sea que lo nacional es lo que
#   la carta MIDE, no lo que la desbloquea: lo que la desbloquea es tener país.
#   Es la misma distinción que ya está escrita más abajo — **el requisito
#   bloquea la carta, no el dato**— aplicada al revés de como estaba.
#
# · Competitivo y Servidor no se tocan.
# 🔴 CADA CARTA TIENE UNA **LISTA** DE CONDICIONES, Y TODAS LA TIENEN.
# Hasta el 22/09/2026 era una sola por carta —una tupla suelta— porque
# ninguna pedía dos cosas. Ese día Dlx pidió que País pidiera tres:
# *«3 duelos nacionales y 3 internacionales y bandera asignada»*.
#
# ⚠️ SE HIZO UNIFORME EN VEZ DE AGREGAR UN CASO ESPECIAL. La alternativa
# era dejar la tupla y colgarle a País un diccionario `EXTRA` aparte —y
# eso parte la verdad en dos lugares, que es la forma que este repo
# documenta tres veces en `CLAUDE.md`. Con una lista siempre, quien lee
# `REQUISITOS` ve todo lo que hace falta sin saber que existe un
# segundo sitio donde mirar.
#
# ⚠️ `servidor` ES UNA LISTA VACIA, no un `0` con un campo que no se
# usa. «No pide nada» se dice mejor con cero condiciones que con una
# condición de cero.
REQUISITOS = {
    'temporada':   [(1,  'actividad', ('PARTICIPACIÓN', 'PARTICIPACIONES'))],
    'competitivo': [(10, 'ev',        ('EVENTO', 'EVENTOS'))],
    # 🔴 LAS TRES DE PAIS, del 22/09/2026. Antes era «tener país
    # asignado», que no pedía haber competido — y por eso después del
    # reset la carta se seguía emitiendo con los números de la
    # pre-temporada. Ahora **lo que la carta mide es lo que la
    # desbloquea**, que es la regla del proyecto.
    #
    # 🔴 LA BANDERA VA PRIMERA, Y EL ORDEN NO ES ESTETICO: la Bloqueada
    # muestra **la primera que falta**. Con los duelos adelante, a
    # alguien sin país le decía «te faltan 3 duelos nacionales» — y un
    # duelo nacional **no está definido** si no se sabe de qué país
    # sos. Le pedía algo que no puede hacer.
    #
    # Con la bandera primera los dos casos salen bien: quien la tiene
    # ve los duelos, y quien no, ve la bandera. Escribí el orden al
    # revés apoyándome en que «lo nacional es de lo que habla la
    # carta», que es cierto y no es lo que decide acá.
    'pais':        [(1,  'tiene_cc',  ('BANDERA ASIGNADA',
                                       'BANDERAS ASIGNADAS')),
                    (3,  'dna_t',     ('DUELO NACIONAL',
                                       'DUELOS NACIONALES')),
                    (3,  'din_t',     ('DUELO INTERNACIONAL',
                                       'DUELOS INTERNACIONALES'))],
    'servidor':    [],
}


def condiciones(carta):
    """Las condiciones de esa carta, en orden. `[]` si no pide nada."""
    c = carta.lower()
    if c not in REQUISITOS:
        raise KeyError('no se que hace falta para "%s"' % carta)
    return REQUISITOS[c]


def minimo(carta, campo):
    """Cuantos hacen falta de ese campo para esa carta. Un `int`.

    🔴 EXISTE PORQUE `REQUISITOS[x][0]` DEJO DE SER UN NUMERO. Hasta el
    22/09/2026 cada carta tenia **una** condicion guardada como tupla
    —`('competitivo': (10, 'ev', (...)))`— asi que `[0]` daba el 10. Con
    Pais pidiendo tres cosas, el valor paso a ser una **lista** de
    condiciones y `[0]` pasó a dar la tupla entera.

    ⚠️ Y ESO ROMPIO DOS COSAS QUE NADIE MIRABA. `sheet/webapp_rangos.py`
    —el que publica la **pagina publica** de rangos— reventó con
    `TypeError: not all arguments converted during string formatting`
    en el workflow `rangos`, dos corridas seguidas el 22/09. Y
    `sheet/guia_t1.py` tenia el mismo `[0]` y todavia no habia fallado
    **porque nadie lo corrio**.

    ⚠️ Es la forma que `CLAUDE.md` documenta como «un default que no es
    la decision»: la decision cambio de forma en un lugar y los lectores
    siguieron leyendo la forma vieja. La diferencia es que aca **si**
    fallo — pero en un workflow, que es donde nadie mira.

    Por eso esto es una funcion y no un indice: el dia que la forma
    vuelva a cambiar, cambia aca y los llamadores no se enteran.
    """
    for n, campo_i, _palabras in condiciones(carta):
        if campo_i == campo:
            return n
    raise KeyError('%s no pide nada de "%s"' % (carta, campo))


def como_se_dice(carta, n, sv=None, i=0):
    """'EVENTO' o 'EVENTOS' segun cuantos, con el servidor si lo lleva.

    `i` es cuál de las condiciones, porque desde el 22/09 una carta
    puede pedir varias. Por defecto la primera, que es la que la
    Bloqueada muestra.
    """
    cs = condiciones(carta)
    if not cs:
        raise ValueError('la carta "%s" no pide nada' % carta)
    uno, varios = cs[i][2]
    t = uno if n == 1 else varios
    if '{sv}' in t:
        if not sv:
            raise ValueError(
                'el requisito de "%s" es POR SERVIDOR: hace falta sv=' % carta)
        t = t.replace('{sv}', sv)
    return t

# ⚠️ `ev_nac` NO ESTA EN NINGUN POOL, y no es un olvido: no existe la
# competencia que lo genera. `datos/eventos.json` trae los cinco eventos
# insignia y los cinco son internacionales. Hasta que haya uno nacional, esto
# vale 0 para las 735 personas — que es la respuesta correcta, no un hueco.
def eventos_nacionales(p):
    return int(p.get('ev_nac') or 0)


# ⚠️ `ev_por_sv` TAMPOCO ESTA EN NINGUN POOL TODAVIA, pero por un motivo
# distinto al de `ev_nac`: el dato EXISTE en el Sheet —son 7 columnas por
# servidor— y `construir_pool_temporada.py` las lee **solo para el argmax y
# tira los valores**. O sea que esto no espera a que pase algo en la liga:
# espera a que el builder guarde lo que ya tiene delante.
#
# ⚠️ Y POR ESO NO DEVUELVE 0 CUANDO FALTA: revienta. Un 0 diria "no jugaste
# ahi", que es una respuesta, y la verdad es "no se". Con 0 las 138 quedarian
# bloqueadas en los 7 servidores y la carta se veria perfecta — un requisito
# que mide un campo inexistente bloquea a todos y parece que funciona.
def eventos_en(p, sv):
    """Cuantos eventos jugo esa persona EN ESE servidor."""
    if not sv:
        raise ValueError('¿eventos en que servidor? falta sv=')
    por_sv = p.get('ev_por_sv')
    if por_sv is None:
        raise KeyError(
            'la fila no trae `ev_por_sv`: el builder lee las 7 columnas por '
            'servidor solo para el argmax y tira los valores. Ver '
            'docs/sheet_t1.md')
    return int(por_sv.get(sv) or 0)


def actividad(p):
    """Misiones + eventos + MW. Con UNA alcanza para la Temporada.

    ⚠️ SE SUMAN, PERO EL REQUISITO ES 1: da igual cuál de las tres. Dlx, cuando
    se lo pregunté: «cualquiera de las tres, con una alcanza». Sumarlas y pedir
    1 es la forma más simple de escribir eso, y de paso el número que muestra
    la Bloqueada es «participaste 0 veces», que es lo que se quiere decir.

    ⚠️ LOS NOMBRES DE LOS CAMPOS SALEN DEL SHEET Y HOY SOLO HAY DOS. El pool
    trae `ev` (EVT) y `mw` (MW); **las misiones todavía no están** en ningún
    pool. Se las busca igual por varios nombres posibles para que el día que
    aparezcan entren solas, en vez de que alguien tenga que acordarse.
    """
    tot = 0
    for campo in ('ev', 'mw', 'mis', 'misiones'):
        try:
            tot += int(p.get(campo) or 0)
        except (TypeError, ValueError):
            pass
    return tot


def tiene_pais(p):
    """1 si tiene país asignado, 0 si no. Ver el comentario de REQUISITOS.

    ⚠️ VALE CUALQUIERA DE LOS DOS CAMPOS: el pool guarda el código de dos
    letras (`cc`) y el padrón el nombre (`pais`). Mirando uno solo, la mitad de
    la gente quedaba «sin país» según de qué lado viniera la fila.
    """
    return 1 if ((p.get('cc') or '').strip() or (p.get('pais') or '').strip()) else 0


def cuanto(p, campo, sv=None):
    if campo == 'ev_nac':
        return eventos_nacionales(p)
    if campo == 'ev_sv':
        return eventos_en(p, sv)
    if campo == 'actividad':
        return actividad(p)
    if campo == 'tiene_cc':
        return tiene_pais(p)
    return int(p.get(campo) or 0)


def falta(carta, p, sv=None):
    """None si la carta se le puede emitir. Si no, (tiene, necesita, de que).

    `p` es una fila de cualquiera de los dos pools: sólo se le piden `ev` y,
    según la carta, `ev_nac` o `ev_por_sv`.

    `sv` es **obligatorio para la Servidor** y se ignora en las otras tres.
    """
    # 🔴 DEVUELVE **LA PRIMERA QUE FALTA**, no todas. La Bloqueada
    # dibuja una barra de progreso y un texto: con dos huecos a la vez
    # habría que elegir igual, y elegir en el que dibuja significa que
    # cada carta elegiría distinto. Acá se elige una vez, por el orden
    # declarado en `REQUISITOS` — para País, primero lo nacional.
    #
    # ⚠️ Y AL COMPLETAR UNA APARECE LA SIGUIENTE, que es lo correcto:
    # la barra vuelve a arrancar porque de verdad falta otra cosa. Lo
    # que no puede pasar es decir «ya está» cuando falta la segunda.
    i = cual_falta(carta, p, sv)
    if i is None:
        return None
    meta, campo, _q = condiciones(carta)[i]
    return (cuanto(p, campo, sv), meta, como_se_dice(carta, meta, sv, i))


def cual_falta(carta, p, sv=None):
    """El ÍNDICE de la primera condición sin cumplir. `None` si las cumple.

    🔴 EXISTE PARA QUE LA BLOQUEADA NO VUELVA A DERIVARLO POR SU CUENTA.
    `falta()` devuelve el texto ya armado, que alcanza para mostrar una
    línea; la carta necesita además el **singular/plural de lo que
    falta** —«TE FALTAN 3 DUELOS»— y para eso hace falta saber *cuál*
    de las condiciones es. Sin esto, `bloqueada.html()` tomaba la
    primera y con País —tres condiciones— decía «0/1 BANDERA ASIGNADA»
    a gente que sí tenía bandera.
    """
    for i, (meta, campo, _q) in enumerate(condiciones(carta)):
        if meta and cuanto(p, campo, sv) < meta:
            return i
    return None


def _check_compuesto():
    """Que País pida LAS TRES y que la Bloqueada diga cuál falta.

    🔴 SIN ESTO NO SE PUEDE COMPROBAR. `1v1` quedó vacía con el reset
    del 22/09, así que sobre datos reales las tres condiciones dan 0 y
    el resultado es el mismo esté bien o mal escrito el `and`. El caso
    que importa —cumplir dos y que igual falte la tercera— no existe
    hoy en ninguna fila.
    """
    mal = 0
    print('\n  las tres de País, y cuál se muestra')
    casos = [
        ('con las tres, sale', {'dna_t': 3, 'din_t': 3, 'cc': 'ar'}, None),
        ('con bandera y sin duelos, pide los nacionales',
         {'dna_t': 0, 'din_t': 0, 'cc': 'ar'}, 'DUELOS NACIONALES'),
        # 🔴 EL CASO QUE ORDENO LA LISTA: sin país, un duelo nacional
        # ni siquiera está definido. Pedirle duelos es pedirle algo
        # que no puede hacer.
        ('sin bandera, lo primero que pide es la bandera',
         {'dna_t': 0, 'din_t': 0, 'cc': ''}, 'BANDERA ASIGNADA'),
        ('con las nacionales, pasa a pedir las internacionales',
         {'dna_t': 3, 'din_t': 1, 'cc': 'ar'}, 'DUELOS INTERNACIONALES'),
        # 🔴 EL CASO QUE UN `and` MAL ESCRITO DEJA PASAR: cumple los
        # duelos de las dos clases y **no tiene bandera**.
        ('con los seis duelos pero sin bandera, NO sale',
         {'dna_t': 5, 'din_t': 9, 'cc': ''}, 'BANDERA ASIGNADA'),
        ('y de a uno no alcanza', {'dna_t': 3, 'din_t': 0, 'cc': 'ar'},
         'DUELOS INTERNACIONALES'),
        ('2 nacionales no son 3', {'dna_t': 2, 'din_t': 9, 'cc': 'ar'},
         'DUELOS NACIONALES'),
    ]
    for que, fila, esp in casos:
        r = falta('pais', fila)
        dice = None if r is None else r[2]
        ok = dice == esp
        mal += not ok
        print('   %s %-48s -> %s'
              % ('✅' if ok else '🔴', que, dice or 'la carta sale'))

    # ⚠️ Y QUE LAS OTRAS TRES NO SE HAYAN VUELTO COMPUESTAS SIN QUERER.
    for k, n in (('temporada', 1), ('competitivo', 1), ('servidor', 0)):
        ok = len(REQUISITOS[k]) == n
        mal += not ok
        print('   %s %-48s -> %d condición(es)'
              % ('✅' if ok else '🔴', '%s sigue con %d' % (k, n),
                 len(REQUISITOS[k])))
    return mal


def _check_docstring():
    """Que la tabla del docstring diga lo mismo que `REQUISITOS`.

    🔴 ESTE ARCHIVO SE CONTRADIJO A SI MISMO DOS VECES. La tabla de
    arriba decía *«Temporada: 2 eventos»* y *«País: 1 evento nacional»*
    mientras el dict, treinta líneas más abajo, decía 1 participación y
    tres condiciones. Nada fallaba: el código usa el dict y el docstring
    es lo que lee la persona — o sea que **el único que se equivocaba
    era el que venía a leer.**

    Se comparan los NUMEROS de cada fila, en orden. Alcanza: «2» contra
    «1» cambia el número, y «1 evento nacional» contra tres condiciones
    cambia cuántos hay. Comparar el texto pediría que la tabla se
    escribiera como el código, y entonces no serviría para leerla.
    """
    mal = 0
    print('\n  la tabla del docstring contra REQUISITOS')
    filas = {}
    for linea in (__doc__ or '').splitlines():
        m = re.match(r'\|\s*\*\*(\w+)\*\*\s*\|(.+)\|\s*$', linea.strip())
        if not m:
            continue
        clave = ''.join(c for c in unicodedata.normalize('NFKD', m.group(1))
                        if not unicodedata.combining(c)).lower()
        filas[clave] = [int(x) for x in re.findall(r'\b(\d+)\b', m.group(2))]
    for k, cs in REQUISITOS.items():
        esp = [m for m, _c, _q in cs if m]
        hay = filas.get(k)
        ok = hay is not None and hay == esp
        mal += not ok
        print('   %s %-12s tabla %-12s dict %s'
              % ('✅' if ok else '🔴', k,
                 'no está' if hay is None else hay, esp))
    return mal


def _self_check():
    import json
    print('QUE HACE FALTA PARA CADA CARTA\n')
    for k, cs in REQUISITOS.items():
        # '<sv>' en vez de un servidor de verdad: acá se lista la REGLA, no el
        # caso de nadie. Que se vea el hueco es la gracia.
        if not cs:
            print('  %-12s nada' % k)
            continue
        # ⚠️ SE LISTAN TODAS Y SE DICE QUE VAN JUNTAS. País pide tres
        # desde el 22/09 y mostrar sólo la primera haría creer que
        # alcanza con los duelos nacionales.
        partes = ['%d %s' % (m, como_se_dice(k, m, '<sv>', i).lower())
                  for i, (m, _c, _q) in enumerate(cs) if m]
        print('  %-12s %s' % (k, ' + '.join(partes) or 'nada'))
    mal = _check_compuesto() + _check_docstring()

    p = os.path.join(BASE, 'datos', 'temporada_pool.json')
    if not os.path.exists(p):
        return mal
    with open(p, encoding='utf-8') as f:
        pool = json.load(f)

    # 🔴 HACEN FALTA LOS DOS POOLS, Y ESTO LEIA UNO. Los campos que
    # mira el requisito de País —`dna_t`, `din_t`, `cc`— los escribe
    # `construir_pool_competitivo.py`, no el de temporada. Leyendo sólo
    # el de temporada, `cuanto()` los resolvía con su `or 0` y este
    # chequeo gritaba *«País pide `dna_t` y NINGUNA fila del pool lo
    # trae»* — con el campo presente en las 45 filas del otro archivo.
    #
    # ⚠️ Es la alarma que pide el arreglo equivocado: quien le hiciera
    # caso iría a agregar un campo que ya existe, al pool que no es.
    # La misma regla que `secretos_en_git.py` tiene escrita con
    # `DISCORD_PUBLIC_KEY`.
    #
    # ⚠️ Y SE CRUZA POR `raw`, que es la llave que usan los dos pools y
    # la que ya cruza `sheet/archivar_temporada.py` por el mismo motivo.
    q = os.path.join(BASE, 'datos', 'competitivo_pool.json')
    if os.path.exists(q):
        with open(q, encoding='utf-8') as f:
            comp = {x.get('raw'): x for x in json.load(f) if x.get('raw')}
        if comp:
            pool = [dict(comp.get(x.get('raw'), {}), **x) for x in pool]
    # ⚠️ EL PISO DEL POOL YA NO ES 8. Este texto decia «que ya estan
    # filtrados en 8» y es de antes del 16/09/2026; desde el 22/09 el piso
    # sale del requisito mas flojo —1 participacion— en
    # `sheet/construir_pool_temporada.py`. Un texto que describe un filtro
    # que ya no existe hace leer mal el numero de al lado.
    print('\n  sobre los %d del pool:\n' % len(pool))
    for k in REQUISITOS:
        # ⚠️ LA SERVIDOR PASA SIEMPRE Y POR ESO NO SE CUENTA. Desde el
        # 17/09/2026 no tiene requisito, asi que "cuantos pasan" es todos, en
        # los nueve servidores. Lo que si sigue faltando es el DATO —
        # `ev_por_sv` no esta en ningun pool— y conviene que se vea, porque el
        # dia que vuelva un requisito por servidor va a hacer falta.
        if k == 'servidor':
            # ⚠️ CON EL POOL VACIO NO SE PREGUNTA, y hasta hoy se
            # preguntaba igual: `pool[0]` sobre una lista vacía tiraba
            # `IndexError` y el `except` lo imprimía como
            # «⚠️ sin dato: list index out of range», o sea el mensaje de
            # que falta `ev_por_sv` cuando lo que falta es **el pool**.
            # Dos causas distintas contestando lo mismo — que es lo que
            # este chequeo existe para no hacer.
            if not pool:
                dato = 'sin pool, no se puede preguntar'
            else:
                try:
                    eventos_en(pool[0], 'DRA')
                    dato = 'el dato esta'
                except Exception as e:                   # noqa: BLE001
                    dato = '⚠️ sin dato: %s' % str(e).split(':')[0][:44]
            print('    %-12s %3d de %3d   sin requisito · %s'
                  % (k, len(pool), len(pool), dato))
            continue
        pasan = sum(1 for x in pool if falta(k, x) is None)
        aviso = ''
        if k == 'temporada':
            aviso = ''
        if k == 'pais' and pasan == 0:
            aviso = '  ⚠️ correcto: `1v1` esta vacia, nadie tiene duelos'
        print('    %-12s %3d de %3d%s' % (k, pasan, len(pool), aviso))

    # 🔴 Y ACA SE VERIFICA ALGO, QUE HASTA HOY NO PASABA. Todo lo de
    # arriba **reporta**: imprime la regla y los conteos y nunca afirma
    # nada, asi que rompiendole `REQUISITOS` seguia en verde. Lo detecto
    # `herramientas/chequeo_que_no_chequea.py`, que le muta la constante
    # a cada modulo y mira si se entera.
    #
    # Lo que se guarda es un fallo silencioso concreto: `cuanto()`
    # resuelve cuatro campos derivados y para todo lo demas hace
    # `int(p.get(campo) or 0)`. O sea que **un campo mal escrito da 0 y
    # no falla** — y un requisito que siempre da 0 es una carta que
    # desaparece para todo el mundo, sin un error que mirar.
    #
    #     cuanto(p, 'ev')   -> 95
    #     cuanto(p, 'evv')  -> 0     <- el typo no se distingue del dato
    DERIVADOS = ('ev_nac', 'ev_sv', 'actividad', 'tiene_cc')
    malos = []
    # 🔴 CON EL POOL VACIO ESTE CHEQUEO NO PUEDE CONTESTAR, Y DECIA QUE
    # SI. `any(campo in x for x in [])` es `False`, o sea que sobre cero
    # filas marcaba **todos** los campos como ausentes — 🔴 en rojo por
    # un pool que simplemente no tiene a nadie. Paso de verdad el
    # 22/09, justo despues del reset: acuso a `ev`, que lleva meses en
    # el pool. Un chequeo que no puede distinguir «falta el campo» de
    # «no hay filas» esta adivinando, y encima hacia ruido el unico dia
    # en que el pool vacio es lo correcto.
    if not pool:
        # ⚠️ `SIN DATOS PARA MEDIR` ES UNA MARCA, no una frase. La lee
        # `herramientas/chequeo_que_no_chequea.py` para no confundir «no
        # mira esa constante» con «no había nada que mirar»: sin ella,
        # un pool vacío —que es lo correcto entre el reset y el primer
        # evento de la T1— hace fallar la auditoría todas las semanas.
        print('\n    ⚠️ SIN DATOS PARA MEDIR: el pool está vacío, así que no '
              'puedo\n       comprobar que los campos existan. No es un '
              'fallo.')
        return 0
    # ⚠️ SE MIRAN **TODAS** LAS CONDICIONES, no la primera. País pide
    # tres desde el 22/09 y un typo en la segunda —`din_t` escrito
    # `dint`— daría 0 para todos sin que nada falle, que es justo lo
    # que este chequeo existe para encontrar.
    for k, cs in REQUISITOS.items():
        for meta, campo, _q in cs:
            if not meta or campo in DERIVADOS:
                continue
            # tiene que ser una clave que EXISTA en alguna fila del pool
            if not any(campo in x for x in pool):
                malos.append((k, campo))
    print('')
    if malos:
        for k, campo in malos:
            print('    🔴 %s pide el campo %r y NINGUNA fila del pool lo '
                  'trae.' % (k, campo))
            print('       Eso da 0 para todos: esa carta no se le emite a '
                  'nadie y no falla.')
        return mal + len(malos)
    n = sum(1 for cs in REQUISITOS.values() for m, c, _q in cs
            if m and c not in DERIVADOS)
    print('    ✅ %s' % ('el campo directo que se pide existe en el pool'
                        if n == 1 else
                        'los %d campos directos existen en el pool' % n))
    return mal


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    # ⚠️ EL CODIGO DE SALIDA TIENE QUE REFLEJARLO. Antes se llamaba y se
    # tiraba el resultado, asi que un fallo salia con 0 — y todo lo que
    # corre esto en tanda (`herramientas/`, un workflow) lo daba por
    # bueno. Un chequeo que avisa por pantalla y sale con 0 es invisible
    # para cualquiera que no sea una persona leyendo.
    sys.exit(1 if _self_check() else 0)
