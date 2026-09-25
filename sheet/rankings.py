# -*- coding: utf-8 -*-
"""DE `Resultados` Y `1v1` A LA VITRINA. Que columnas se pueden recalcular.

    python sheet/rankings.py --cobertura   de donde sale cada columna
    python sheet/rankings.py --probar      una llave de 16, agregada
    python sheet/rankings.py --comparar    lo calculado contra el Oficial
    python sheet/rankings.py --escribir    la tabla recalculada, SIN escribir
    python sheet/rankings.py --escribir --aplicar    escribirla de verdad
    python sheet/rankings.py --auto        el self-check

🔴 EL SHEET NO CALCULA NADA, Y ESE ES EL PROBLEMA DE FONDO.

`CLAUDE.md` lo tiene medido celda por celda: **cero formulas** en las
cuatro hojas de ranking del Oficial. Es una vitrina de algo calculado
afuera, y «afuera» resulto ser un lugar que ya no existe — los 348
eventos se procesaron y su detalle por persona no quedo guardado.

Mientras siga asi, **la vitrina no se puede regenerar**: si alguien la
borra, no hay de donde volver a armarla. Eso es lo contrario de «que se
mantenga solo».

Este modulo agrega `Resultados` y `1v1` a las columnas del ranking, dice
cuales NO puede calcular, y **desde el 21/09/2026 escribe la hoja**.

⚠️ **RECALCULAR EL RANKING LO REORDENA, o sea que hay que reescribir la
tabla ENTERA.** No alcanza con pisar celdas: el `#` y el orden dependen
de `Puntos`, asi que las filas se mueven. Y reescribirla entera con lo
que este modulo sabe calcular **borraria** las cuatro columnas de Most
Wanted y el `Rango`, que salen de otro lado. Escribir de menos en una
hoja publica no falla: deja ceros donde habia datos. Por eso esas se
**arrastran** de la fila que esa persona tenia, y por eso existe
`sin_dueno()`.

🔴 **Y ESA ERA LA RAZON POR LA QUE NO HABIA ESCRITOR — resulto ser una
razon para escribirlo con guardias, no para no escribirlo.** El agujero
existia de verdad: `DE_DONDE` prometia la racha `🔥` y `agregar()` **no
la calculaba**, y tampoco estaba en `ARRASTRE`, asi que la primera
escritura se la habria borrado a todo el mundo. Ahora la racha se
calcula y **ninguna columna puede quedar sin dueño**: si alguna lo
queda, `tabla_nueva()` devuelve el aviso y no escribe.

⚠️ **CUATRO PUERTAS ANTES DE TOCAR LA HOJA**, porque es publica:

    1. `Resultados` vacia          -> no escribe (hoy es el caso)
    2. una columna sin dueño       -> no escribe
    3. sin respaldo del Oficial    -> no escribe
    4. la tabla encogeria          -> no escribe sin `--achicar`

⚠️ **Y HOY NO PUEDE CORRER IGUAL.** `Resultados` tiene 0 filas: los 348
eventos de la pre se procesaron y su detalle no quedo. La hoja se llena
sola a partir del primer evento de la T1 que pase por
`sheet/procesar_entrada.py`.
"""
import io
import json
import os
import re
import sys
import unicodedata
from collections import defaultdict

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

# ⚠️ el ID vive en `planillas.py`: la T1 estrena planilla y una
# copia suelta lee la vieja sin fallar. Ver el encabezado de ese modulo.
from planillas import OFICIAL  # noqa: E402
# ⚠️ el estilo de las cinco vitrinas vive en un solo lugar: `sheet/estilo.py`
import estilo  # noqa: E402
import ovr as _OVR  # noqa: E402
HOJA = 'Ranking Temporada'
FILA_CAB = 16

# Las columnas por servidor de la vitrina. ⚠️ SON CONTEOS DE EVENTOS, no
# de puntos: medido sobre Bloody, 13+46+5+4+16+4 y su DRA dan sus 95 `Ev`.
#
# 🔴 ERAN SIETE Y FALTABAN **FFA Y EFA**, los dos servidores sin columna.
# Medido el 22/09/2026 con el primer evento de la T1, que fue de FFA: el
# `Sv` de una persona sale del servidor donde más jugó, y ese argmax
# recorre esta tupla — así que las 6 personas del #349 salieron **sin
# servidor**, indistinguibles de alguien que nunca compitió.
#
# ⚠️ Y NO ERA SÓLO LA VITRINA: `sheet/construir_pool_temporada.py` tiene
# la misma lista, así que el hueco llegaba hasta la carta. La de País
# reventaba buscando `sv_.png`.
SERVIDORES = ('FFA', 'EFA', 'TWR', 'TFC', 'SR', 'FTN', 'URBF', 'FRZ', 'DRA')

# columna de la vitrina -> de donde sale. `None` = no se puede hoy.
DE_DONDE = {
    'Puntos': 'Resultados: suma de Puntos',
    'Ev': 'Resultados: eventos distintos',
    '🥇': 'Resultados: posición Campeón',
    '🥈': 'Resultados: posición Subcampeón',
    '🥉': 'Resultados: posición Tercero',
    '🎖️': 'Resultados: posición Semifinal',
    '4️⃣': 'Resultados: eventos de escala 4-7',
    '8️⃣': 'Resultados: eventos de escala 8-15',
    '➕': 'Resultados: eventos de escala 16+',
    'Win%': '1v1: ganados sobre jugados',
    # ⚠️ POR `Evento #`, NO POR `Fecha`. Esta linea decia «por fecha» y
    # la fecha de la hoja es `28/04` sin año: con dos temporadas encima
    # no ordena. Ver `_racha()`.
    '🔥': ('Resultados: eventos seguidos llegando a semifinal (llave de 16 o '
           'más) o a la final (llave de 8), actual/máxima, en orden de fecha'),
    'Rapero': 'padrón: Nombre + la bandera de País',
    'Sv': 'Resultados: el servidor con más eventos',
    '✅': 'padrón: la columna Verificado',
    '#': 'el orden por Puntos',
    '🎯': None,    # cazador       — Most Wanted
    '💀': None,    # cazado        — Most Wanted
    '🛡️': None,   # sobrevivió    — Most Wanted
    'Rango': None,  # sale del Score del Ranking Competitivo
    # `(10/07)・🥇` — la fecha del último evento y qué puesto hizo. Sale de
    # `Resultados`, pero pide que la Fecha sea ordenable y hoy es `28/04`
    # sin año: con dos temporadas encima, «la última» deja de ser la última.
    # ⚠️ ESTO DECIA «pide fecha con año» Y NO LA PIDE. Se ordena por
    # `Evento #`, que es monotono —la misma solucion que la racha ya
    # usaba tres funciones mas abajo—. La fecha se muestra, no se ordena.
    'Último Resultado': 'Resultados: el evento con el # más alto y su puesto',
}
for _s in SERVIDORES:
    DE_DONDE[_s] = 'Resultados: eventos en ese servidor'

POS = {'campeon': '🥇', 'subcampeon': '🥈', 'tercero': '🥉',
       # 🔴 EL CUARTO PUESTO ES UN SEMIFINALISTA, y no estaba. `motor.py`
       # lo da a quien perdió la semifinal y después el partido por el
       # tercero: llegó a semifinal igual que el que no jugó ese partido.
       # Sin esta línea no contaba como semifinal en `SEM`, en la racha ni
       # en la `T` del Competitivo (que toma esta misma tabla).
       'cuarto': '🎖️',
       'semifinal': '🎖️'}

#: 🔑 HASTA DONDE LLEGO, como el tamaño de la ronda en que quedó afuera.
#: El campeón es 1; el que perdió la final, 2; los semifinalistas, 4.
LLEGO = {'campeon': 1, 'subcampeon': 2, 'tercero': 4, 'cuarto': 4,
         'semifinal': 4, 'cuartos': 8, 'octavos': 16, 'r32': 32,
         'dieciseisavos': 32, 'r64': 64}


def _umbral(tamano):
    """Hasta dónde hay que llegar para que ese evento sume a la racha.

    🔴 LA DEFINICION ES DE DLX, 25/09/2026: *«RACHA es llegar a semifinal
    cuando el formato es de octavos, o cuando es de cuartos a la gran
    final. Y si es más de 16 supongo hasta semifinal igual? o cuartos?
    ahí veremos»*.

        llave de 16 (octavos)      semifinal  (LLEGO <= 4)
        llave de 8  (cuartos)      la final   (LLEGO <= 2)
        más de 16                  semifinal  — su «supongo», a confirmar
        menos de 8                 la final   — no lo dijo; a confirmar

    ⚠️ EL FORMATO ES LA PRIMERA RONDA DE LA LLAVE, NO LA GENTE ANOTADA.
    Un evento de 29 personas en tríos arranca en cuartos: son 8 lados.
    Se deduce de la ronda más temprana en que alguien quedó afuera —ver
    `agregar()`—, que es lo que `Resultados` guarda de cada uno.
    """
    return 4 if tamano >= 16 else 2


def _orden_fecha(fecha, num):
    """`'28/09'` + `#` -> una clave que ordena cronológicamente.

    🔴 EL `Evento #` NO ES CRONOLOGICO, aunque así lo decía este archivo.
    Los eventos de una misma corrida se numeran en orden **alfabético**
    (`procesar_entrada.py`): el #355, del 23/09, quedó después del #353 y
    el #354, del 24/09. Para una racha el orden es todo, así que manda la
    fecha y el número sólo desempata dentro del día.

    ⚠️ LA FECHA NO TRAE AÑO. El año sale del arranque de la temporada
    (`comun/temporada.INICIO`): un mes anterior al del arranque es del año
    siguiente, así una temporada que cruza diciembre no se desordena.
    """
    try:
        dia, mes = [int(x) for x in str(fecha).strip().split('/')[:2]]
    except ValueError:
        return (9999, 99, 99, num)
    try:
        from comun.temporada import INICIO
        anio0, mes0 = int(INICIO[:4]), int(INICIO[5:7])
    except (ImportError, ValueError):
        anio0, mes0 = 2026, 1
    return (anio0 + (1 if mes < mes0 else 0), mes, dia, num)

# 🔴 LO QUE NO SE CALCULA SE **ARRASTRA** DE LA FILA QUE ESA PERSONA
# TENIA. Reescribir la tabla entera con solo lo que sale de `Resultados`
# dejaria estas columnas en blanco, y **escribir de menos en una hoja
# publica no falla**: deja huecos donde habia datos.
#
# ⚠️ VIVE ACA ARRIBA Y NO ADENTRO DE `tabla_nueva()` para que el
# self-check la pueda cruzar contra la cabecera. Ver `sin_dueno()`: una
# columna que no se calcula **ni** se arrastra se borra en silencio, y
# eso ya paso con `🔥`.
# ⚠️ `Último Resultado` SALIO DE ACA porque ahora SE CALCULA. Dejarlo en
# los dos lados no falla: `tabla_nueva()` pregunta primero por el
# arrastre, asi que el valor calculado **nunca llegaria a la hoja** y
# seguiria mostrando el de la pre-temporada. Dos fuentes para una
# columna es una que gana callada.
#
# 🔴 Y `Rango` SALIO DE ACA EL 23/09/2026, por el mismo motivo que
# `Rapero`: **se puede calcular**, y arrastrarlo lo dejaba vacío para
# siempre. Una columna que se copia de su propia fila anterior no tiene
# semilla — después del reset no había rango que copiar, así que no se
# llenaba, así que la corrida siguiente tampoco tenía de dónde copiar.
# Medido: 21 de 21 personas con el `Rango` en blanco, que es el dato
# más delicado del proyecto. Ahora sale de `rangos_de()`.
ARRASTRE = ('🎯', '💀', '🛡️', '✅')

# El `#` no se calcula ni se arrastra: se numera al final, despues de
# ordenar.
#
# 🔴 Y `Rapero` SALIO DE `ARRASTRE` PARA ENTRAR ACA. Arrastrarlo hacia
# que la hoja conservara **la grafia vieja para siempre**: el nombre de
# la fila anterior ganaba sobre el resuelto. Medido el 23/09/2026, los
# dos pools quedaron con la misma gente escrita distinto —`MAKMA` en
# Temporada contra `Makma` en Competitivo— y cualquier cruce entre las
# dos hojas los contaba como personas distintas: `puedo_generar` daba
# «19 de 23» sobre 19 personas reales.
#
# ⚠️ Es un caso de la regla de este mismo archivo, al reves: `ARRASTRE`
# es para lo que NO se puede calcular, y el nombre **es la clave**, o
# sea lo mas calculable que hay.
APARTE = ('#', 'Rapero')

#: Las que se calculan **fuera** de `agregar()`, o sea que tienen dueño
#: aunque no aparezcan en sus filas.
#:
#: ⚠️ SIN ESTO, `sin_dueno()` MARCA `Rango` COMO HUERFANA y la escritura
#: se niega entera. Es correcto que pregunte: la guarda existe para que
#: una columna no se borre en silencio. Lo que hay que decirle es que
#: esta columna sí tiene quien la llene — `rangos_de()` — porque su
#: fuente es el Score y no el registro crudo.
CALCULADAS = ('Rango',)
ESCALA_COL = {'4-7': '4️⃣', '8-15': '8️⃣', '16+': '➕'}


def _norm(s):
    import unicodedata
    s = unicodedata.normalize('NFD', str(s or '').lower())
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn').strip()


_ALIAS = None


def canon(quien):
    """El nombre real de esa persona, según el mapa de AKAs. O el mismo.

    🔴 EL MAPA DE 186 ALIAS SE CALCULABA Y NO LO LEIA NADIE. Medido el
    24/09/2026: `construir_pool_temporada`, `construir_pool_competitivo`,
    `padron`, `subir_web` y `subir_datos` lo mencionaban **cero** veces.
    `sheet/construir_akas.py` lo construía, `pendientes.py` lo miraba para
    avisar, y el camino que atribuye resultados a una persona lo ignoraba.

    Es *«el dato estaba y el pipeline lo tiraba»* otra vez, y el síntoma
    fue Makma: nueve filas del padrón son un alias de otra fila, así que
    **nueve personas se contaban dos veces**. Makma 🇻🇪 juntaba los 16.000
    puntos y Makmah 🇦🇷 tenía el Discord ID — la web mostraba al primero
    como #1 de FFA y `/card` le daba al segundo una tarjeta vacía. Hasta
    su `/foto` cayó en la mitad equivocada.

    ⚠️ VA EN `agregar()` Y NO EN CADA VITRINA. Es el embudo único: las
    cinco salen de este dict, así que canonizar acá mueve los puntos, los
    eventos, los podios, los servidores, los duelos y la racha de una vez.
    Puesto en una vitrina quedaría bien en ésa y mal en las otras cuatro.

    ⚠️ Y SE HACE ANTES DE ACUMULAR, no después. Sumar dos filas y después
    renombrar una deja dos entradas; la fusión tiene que pasar en la clave.
    """
    global _ALIAS
    if _ALIAS is None:
        _ALIAS = {}
        try:
            p = os.path.join(BASE, 'datos', 'akas.json')
            with io.open(p, encoding='utf-8') as f:
                _ALIAS = (json.load(f) or {}).get('alias') or {}
        except (OSError, ValueError):
            # ⚠️ SIN MAPA SE SIGUE, con los nombres crudos. Quedarse sin
            # vitrinas porque falta un json es peor que no fusionar.
            _ALIAS = {}
    # 🔴 SE SIGUE LA CADENA HASTA EL FINAL, no un solo salto.
    # `datos/akas.json` tiene `gekto -> geekto` y `geekto -> Presagio`,
    # así que con un salto único `canon('gekto')` daba **`geekto`**, que
    # es otro alias. Una fila escrita `gekto` y otra escrita `geekto`
    # terminaban en dos personas distintas de la vitrina siendo la
    # misma — el bug de Makma otra vez, un eslabón más adentro.
    #
    # ⚠️ `construir_akas.py` YA LO AVISA al construir el mapa
    # («⚠️ cadena: "gekto" -> "geekto" -> "Presagio"») y el aviso no
    # alcanzaba: quien lee el mapa tenía que saber seguirlo.
    #
    # ⚠️ CON TOPE, PORQUE UN CICLO CUELGA. `a -> b -> a` es un empate
    # declarado mal en la hoja, y ocho de los nueve «enlaces» de hoy
    # son `bna -> BNA`, que apunta a sí mismo con otra caja: eso para
    # solo porque se compara la clave normalizada, no el texto.
    vis, act = set(), quien or ''
    for _ in range(8):
        k = ''.join(c for c in unicodedata.normalize('NFKD', act)
                    if c.isalnum()).lower()
        if k in vis:
            break
        vis.add(k)
        sig = _ALIAS.get(k)
        if not sig:
            break
        act = sig
    # si pasó por el mapa, la identidad está DECLARADA: ver `_grafia()`
    return _grafia(act or quien, declarado=(act or '') != (quien or ''))


def _clave_fila(n):
    """La identidad de un nombre, LA MISMA que usa el ranking: `canon()`.

    ⚠️ Y NO SOLO LETRAS Y NÚMEROS: con eso `Volk 🇲🇽` y `volk 🇨🇴` —dos
    desconocidos con banderas distintas, que el ranking mantiene
    separados— compartían la fila vieja y uno se llevaba la del otro. La
    fila anterior de cada uno tiene que buscarse con la misma identidad
    con que se agrupa.
    """
    return canon(str(n or '').strip())


_GRAFIA = None
#: los que no están en el padrón ni tienen alias: (clave, banderas) -> grafía
_DESCONOCIDOS = {}
#: claves que la hoja AKAs declara como dos personas que solo cambian de
#: bandera (`Zeta 🇨🇴` / `Zeta 🇲🇽`)
_POR_BANDERA = set()
#: una bandera es un PAR de indicadores regionales
_BANDERA2 = re.compile('[\U0001F1E6-\U0001F1FF]{2}')


def _grafia(nombre, declarado=False):
    """UNA sola forma de escribir a cada persona. La del padrón si está.

    🔴 EL RANKING AGRUPABA POR COMO ESTABA ESCRITO, NO POR QUIEN ERA.
    `canon()` devolvía el nombre tal cual cuando no era un alias, y
    `agregar()` usa ese texto como clave: `MAU KC` y `Mau Kc` eran dos
    claves y por lo tanto **dos personas**. Medido el 24/09/2026 sobre el
    pool que escribió el ciclo:

        MAU KC 5.250  +  Mau Kc 5.250   semifinalista en #350 y en #354
        Denik  5.250  +  DENIK  1.250
        RICARD 2.000  +  ricard 1.250
        Volk🇲🇽 5.250 +  volk🇨🇴 1.250

    Mau Kc tiene 10.500 en dos eventos y figuraba como dos de 5.250.

    ⚠️ LO DESTAPÓ UN ARREGLO, NO LO CAUSÓ. Hasta el 24/09 la
    canonización difusa contra las inscripciones (corte 0.66) juntaba
    estas variantes de casualidad —y de paso le cambiaba el nombre a
    gente que no era—. Sacada esa, quedó a la vista que la identidad
    dependía de las mayúsculas.

    🔴 LA BANDERA SEPARA A LOS DESCONOCIDOS, Y A NADIE MÁS. La primera
    versión de esto juntaba `volk🇨🇴` con `Volk🇲🇽` apoyada en la regla
    escrita —*la bandera en una llave es decoración*—, y Dlx la corrigió
    el mismo día: *«la bandera no siempre es decoración»*. Las dos cosas
    son ciertas en casos distintos:

      · alguien DEL PADRÓN, o con un alias declarado: la identidad ya
        está resuelta y la bandera es decoración. El mismo Hassan aparece
        como 🇪🇬, 🇮🇶 y 🇦🇴, y es uno.
      · alguien que el sistema NO conoce: no hay nada más que el nombre y
        la bandera, y dos banderas distintas pueden ser dos personas. Se
        juntan sólo si la bandera coincide —`MAU KC 🇨🇴` con `Mau Kc 🇨🇴`—.
        Si son la misma, se declara el alias y pasan al primer caso.

    ⚠️ LA DEL PADRÓN GANA porque es el AKA oficial: Dlx, 24/09/2026,
    *«esos nombres deberían ser los que aparecen en la lista de raperos
    del sheet operativo, ya que ese es su oficial AKA»*. Si no está en el
    padrón, la primera que aparece — y `Resultados` se lee siempre en el
    mismo orden, así que es siempre la misma.
    """
    global _GRAFIA
    if _GRAFIA is None:
        _GRAFIA = {}
        # los nombres que la hoja AKAs distingue SOLO por la bandera
        try:
            with io.open(os.path.join(BASE, 'datos', 'akas.json'),
                         encoding='utf-8') as f:
                for x in (json.load(f) or {}).get('no_confundir') or []:
                    if len(x) >= 2:
                        a, b = (''.join(c for c in unicodedata.normalize(
                            'NFKD', str(v)) if c.isalnum()).lower()
                            for v in x[:2])
                        if a and a == b:
                            _POR_BANDERA.add(a)
        except (OSError, ValueError):
            pass
        try:
            with io.open(os.path.join(BASE, 'datos', 'padron.json'),
                         encoding='utf-8') as f:
                for x in json.load(f) or []:
                    r = str(x.get('raw') or '').strip()
                    kk = ''.join(c for c in unicodedata.normalize('NFKD', r)
                                 if c.isalnum()).lower()
                    if kk and kk not in _GRAFIA:
                        _GRAFIA[kk] = r
        except (OSError, ValueError):
            # sin padrón se sigue: quedan las grafías de la primera vez
            pass
    kk = ''.join(c for c in unicodedata.normalize('NFKD', nombre or '')
                 if c.isalnum()).lower()
    if not kk:
        return nombre
    # 🔴 SALVO QUE ESE NOMBRE ESTÉ DECLARADO COMO DOS PERSONAS QUE SÓLO
    # CAMBIAN DE BANDERA. La guía de Dlx (parte 5) tiene `Zeta 🇨🇴 ≠ Zeta
    # 🇲🇽`: con la clave de letras son la misma, así que aunque «Zeta» esté
    # en el padrón, ahí la bandera manda. Es la otra cara de su «la
    # bandera no siempre es decoración».
    if kk in _POR_BANDERA:
        fl = frozenset(_BANDERA2.findall(nombre or ''))
        return _DESCONOCIDOS.setdefault((kk, fl), nombre)
    if kk in _GRAFIA:
        return _GRAFIA[kk]
    if declarado:
        return _GRAFIA.setdefault(kk, nombre)
    fl = frozenset(_BANDERA2.findall(nombre or ''))
    return _DESCONOCIDOS.setdefault((kk, fl), nombre)


def _trolls():
    """`f(nombre) -> bool`: ¿es un nombre que no entra a ningún ranking?

    ⚠️ SI NO SE PUEDE SABER, NADIE ES TROLL: sacar gente del ranking por
    un archivo que no se pudo leer sería peor que dejar a un troll.
    """
    try:
        import decidir as _DEC
        fuera = _DEC.no_rankear()
        return lambda q: bool(fuera) and _DEC.norm(q) in fuera
    except Exception:                                    # noqa: BLE001
        return lambda q: False


def agregar(filas_res, filas_uno):
    """Las filas crudas -> {rapero: {columna: valor}}.

    ⚠️ TOMA FILAS, NO LEE LA PLANILLA. Asi se puede probar con una llave
    inventada sin tocar el Sheet, que es como se verifico con `--probar`
    mientras `Resultados` esta vacia.

    `filas_res` son las 11 columnas de `Resultados` y `filas_uno` las 9
    de `1v1`, en el orden de la hoja.

    🔴 Y CANONIZA LOS NOMBRES CONTRA EL MAPA DE AKAs. Ver `canon()`: sin
    eso, nueve personas se cuentan dos veces.
    """
    d = defaultdict(lambda: defaultdict(int))
    evs = defaultdict(set)
    ultimo = defaultdict(list)          # (num, fecha, puesto) por persona
    jugo = defaultdict(list)            # (orden, num, puesto) por persona
    tamano = {}                         # num -> la primera ronda de su llave
    es_troll = _trolls()
    for f in filas_res:
        f = list(f) + [''] * 11
        num, sv, esc, quien = str(f[0]).strip(), str(f[2]).strip(), \
            str(f[3]).strip(), str(f[4]).strip()
        if not quien:
            continue
        quien = canon(quien)
        # 🔴 LOS TROLL NO ENTRAN A NINGUNA VITRINA. Ver `decidir.no_rankear()`.
        if es_troll(quien):
            continue
        pos = _norm(f[6])
        try:
            pts = int(float(str(f[7]).replace(',', '') or 0))
        except ValueError:
            pts = 0
        r = d[quien]
        r['Puntos'] += pts
        evs[quien].add(num)
        if pos in POS:
            r[POS[pos]] += 1
        if esc in ESCALA_COL:
            r[ESCALA_COL[esc]] += 1
        if sv in SERVIDORES:
            r[sv] += 1
        try:
            _n = int(float(num or 0))
        except ValueError:
            _n = 0
        ultimo[quien].append((_n, str(f[1]).strip(), POS.get(pos, '')))
        jugo[quien].append((_orden_fecha(f[1], _n), _n, pos))
        if pos in LLEGO:
            tamano[_n] = max(tamano.get(_n, 0), LLEGO[pos])

    # 🔴 LA RACHA SON EVENTOS, NO DUELOS. Hasta el 25/09/2026 la `🔥` era
    # «duelos 1v1 ganados seguidos», y el hub se contradecía: la tarjeta de
    # Hassan decía «RACHA DE 8» —ocho duelos— y los récords del Inicio
    # daban a Makmah, porque ahí se descartaba a quien tuviera una racha
    # más larga que sus eventos (8 > 6). Dlx lo definió: eventos seguidos
    # llegando a semifinal o a la final según la llave. Ver `_umbral()`.
    #
    # ⚠️ SOLO CUENTAN LOS EVENTOS QUE JUGÓ: faltar a uno no corta la racha
    # (es lo que ya hacía la `T` del Competitivo). A confirmar con Dlx.
    for quien, lista in jugo.items():
        oks = [LLEGO.get(pos, 999) <= _umbral(tamano.get(n, 0))
               for _k, n, pos in sorted(lista)]
        d[quien]['🔥'] = _racha(oks)

    # ⚠️ `Ev` SON EVENTOS DISTINTOS, NO FILAS. Una persona tiene una fila
    # por evento, pero si alguna vez entra dos veces —un reproceso a medias,
    # un equipo contado aparte— contar filas la infla sin avisar.
    for quien, s in evs.items():
        d[quien]['Ev'] = len(s)

    # 🔴 `Último Resultado` SE PUEDE CALCULAR, Y `DE_DONDE` DECIA QUE NO.
    # Estaba anotado como *«pide que la Fecha sea ordenable y hoy es
    # 28/04 sin año»*, o sea marcado como imposible por el mismo motivo
    # que la racha... y la racha **ya se resolvió** ordenando por
    # `Evento #`, que es monótono. La conclusión no se actualizó con el
    # hallazgo: quedó una columna dada por perdida teniendo la respuesta
    # tres funciones más arriba.
    #
    # ⚠️ Se muestra la fecha igual —`(22/09)・🥇`— porque es lo que la
    # persona quiere leer; lo que NO se usa es para ordenar.
    for quien, filas in ultimo.items():
        n, fecha, pos = max(filas, key=lambda x: x[0])
        d[quien]['Último Resultado'] = ('(%s)・%s' % (fecha, pos) if pos
                                        else '(%s)' % fecha)

    # el servidor es aquel donde jugo mas, igual que en el pool
    for quien, r in d.items():
        vistos = [(r.get(s, 0), s) for s in SERVIDORES if r.get(s, 0)]
        r['Sv'] = max(vistos)[1] if vistos else ''

    # los duelos
    #
    # 🔴 EL ORDEN SALE DEL `Evento #`, NO DE LA `Fecha`, y esto no es un
    # atajo: la fecha de la hoja es `28/04` **sin año**, asi que con dos
    # temporadas encima «el duelo anterior» deja de estar definido. El
    # numero de evento es monotono —`Config!B27 + 1`— y dentro de un
    # evento el orden de la hoja ya es el de la llave, porque
    # `resultados._filas_uno()` las escribe ronda por ronda y
    # `resultados.reescribir()` conserva ese orden.
    #
    # ⚠️ El docstring de `DE_DONDE` decia «por fecha» y la fecha es justo
    # el campo que no se puede ordenar. Ordenar por lo que no ordena no
    # falla: da una racha plausible y equivocada.
    g, j = defaultdict(int), defaultdict(int)
    hist = defaultdict(list)
    orden = []
    for i, f in enumerate(filas_uno):
        f = list(f) + [''] * 9
        try:
            num = int(float(str(f[0]).strip() or 0))
        except ValueError:
            num = 0
        orden.append((num, i, f))
    for _num, _i, f in sorted(orden, key=lambda x: (x[0], x[1])):
        a, b, gan = str(f[4]).strip(), str(f[5]).strip(), str(f[6]).strip()
        if not (a and b and gan):
            continue
        # ⚠️ LOS TRES, INCLUIDO EL GANADOR. Si `a` se canoniza y `gan` no,
        # `x == gan` da False y la persona pierde un duelo que ganó — un
        # Win% plausible y equivocado, que no falla en ningún lado.
        a, b, gan = canon(a), canon(b), canon(gan)
        # ⚠️ EL TROLL SALE, SU RIVAL NO: el que le ganó conserva el duelo
        # ganado y el que le perdió, el perdido. Sólo no se le cuentan al
        # troll, que no tiene fila.
        for x in (a, b):
            if es_troll(x):
                continue
            j[x] += 1
            hist[x].append(x == gan)
        if not es_troll(gan):
            g[gan] += 1
    for quien in set(list(j) + list(d)):
        if j.get(quien):
            d[quien]['Win%'] = '%.1f%%' % (100.0 * g.get(quien, 0) / j[quien])
            d[quien]['_duelos'] = '%d/%d' % (g.get(quien, 0), j[quien])
            # la de duelos sigue existiendo para su propia vitrina
            d[quien]['_racha_duelos'] = _racha(hist[quien])
            # ⚠️ Y LOS DOS NUMEROS SUELTOS, que es lo que el `Ranking
            # Duelos` ordena. `_duelos` es texto —`12/18`— y una vitrina
            # que ordena por texto pone «9/10» arriba de «12/18».
            d[quien]['_dg'] = g.get(quien, 0)
            d[quien]['_dj'] = j[quien]
            d[quien]['_dp'] = j[quien] - g.get(quien, 0)
    return {k: dict(v) for k, v in d.items()}


def _racha(gano):
    """`actual/máxima` a partir de la lista de duelos en orden.

    ⚠️ ES TEXTO Y NO UN NUMERO, a proposito: `CLAUDE.md` lo tiene
    anotado como trampa del Sheet —*«la columna 🔥 guarda texto
    actual/maxima; si se lee como numero, todos los TAG de racha
    desaparecen»*—. Devolver `3` en vez de `3/7` rompe la carta sin
    romper la hoja.
    """
    act = mejor = 0
    for ok in gano:
        act = act + 1 if ok else 0
        mejor = max(mejor, act)
    return '%d/%d' % (act, mejor)


def sin_dueno(cab, ag, viejo=None):
    """Las columnas de la cabecera que nadie llena. [] si todas tienen.

    🔴 CON `viejo`, SOLO CUENTAN LAS QUE HOY TIENEN ALGO PUESTO, y sin ese
    matiz esta guarda no dejaba escribir NUNCA. Medido el 22/09/2026 con
    el primer evento de la T1 cargado: 15 columnas «sin dueño», y seis de
    ellas son **los otros servidores** —TWR, TFC, SR, FTN, URBF, FRZ—. Un
    evento de FFA no le da dueño a la columna de TWR, asi que esperar a
    que las siete lo tengan es esperar a que haya pasado un evento en
    cada servidor: media temporada con la vitrina en blanco.

    ⚠️ LA GUARDA EXISTE PARA NO BORRAR DATOS, no para exigir datos. Si la
    columna esta vacia hoy, escribirla vacia no borra nada. `viejo` son
    las filas **con nombre**, y eso importa: la hoja tiene 135 valores
    sueltos en la columna `DRA` sobre filas **sin rapero** —restos del
    reset—, y un numero que no es de nadie no es un dato que se pueda
    perder. Dejarlos seria peor: en cuanto entren los nombres de la T1,
    esos numeros se alinean al lado de gente a la que no pertenecen.

    🔴 ESTE ES EL CHEQUEO QUE FALTABA Y EL BUG QUE ENCONTRO. `DE_DONDE`
    prometia `🔥` —*«1v1: racha actual/máxima»*— y `agregar()` **no la
    calculaba**; tampoco estaba en `ARRASTRE`. O sea que la primera
    escritura habria borrado la racha de todo el mundo, y la carta se
    habria quedado sin su TAG de racha, sin un solo error en ningun
    lado: la hoja acepta un blanco igual que un numero.

    ⚠️ SE PREGUNTA CONTRA LOS DATOS DE VERDAD, no contra `DE_DONDE`. La
    version obvia era cruzar la cabecera con el diccionario de
    documentacion, y eso es justo lo que fallaba: `DE_DONDE` **decia**
    que `🔥` salia del registro crudo. Lo que importa no es lo que el
    modulo promete sino lo que sus filas traen puestas.

    ⚠️ Y SE MIRA LA UNION DE TODAS LAS PERSONAS, no una. Nadie tiene
    todas las columnas —quien nunca hizo podio no tiene `🥇`— asi que
    preguntar fila por fila marcaria media tabla. Una columna tiene
    dueño si **alguien** la trae.
    """
    traidas = set()
    for v in (ag or {}).values():
        traidas.update(k for k in v if not str(k).startswith('_'))
    cand = [c for c in cab
            if c and c not in traidas and c not in ARRASTRE
            and c not in APARTE and c not in CALCULADAS]
    if viejo is None:
        # sin la hoja de hoy no se puede saber si hay algo que perder, y
        # entonces se contesta lo estricto: es el lado seguro
        return cand
    icol = {c: i for i, c in enumerate(cab)}
    con_datos = set()
    for f in viejo.values():
        for c in cand:
            i = icol.get(c)
            if i is not None and i < len(f) and str(f[i]).strip():
                con_datos.add(c)
    return [c for c in cand if c in con_datos]


def _leer(sid, rng):
    """Lee un rango. **Reintenta si Google pide esperar.**

    🔴 SIN EL REINTENTO, UN 429 TUMBA EL PASO ENTERO. Pasó el
    23/09/2026: `cabecera_oficial()` pidió `Ranking Temporada!A1:AA1`,
    Google contestó `429 Too Many Requests` y `rankings.py --escribir`
    murió con un Traceback — o sea que la vitrina principal **no se
    recalculó** esa corrida, con `Resultados` ya actualizado. Salió un
    ciclo «success» con la portada vieja.

    ⚠️ UN 429 ES «ESPERÁ», NO «ESTÁ MAL». La cuota de lectura son 60 por
    minuto y por usuario; el ciclo las gasta de a ráfagas. `reintentar`
    ya existía y lo usaban los tres builders — este camino no, y es el
    que más lee desde que las cinco vitrinas se visten.
    """
    from reintentar import leer as _reint

    def _pedir():
        import requests
        from escribir import token
        r = requests.get('https://sheets.googleapis.com/v4/spreadsheets'
                         '/%s/values/%s' % (sid, requests.utils.quote(rng)),
                         headers={'Authorization': 'Bearer ' + token()},
                         timeout=90)
        r.raise_for_status()
        return r.json().get('values', [])
    # ⚠️ EL `lambda` ENVUELVE LA LLAMADA ENTERA, no su resultado. Es el
    # error que este repo ya se comió: `_reint(sh.worksheet('X').get)`
    # evalúa `worksheet(...)` —que también pega a la API— **antes** de
    # entrar al reintento.
    return _reint(_pedir)


#: lo que identifica la cabecera de cada vitrina. Ver `fila_cabecera()`.
MARCAS = {
    'Ranking Temporada': ('Rapero', 'Puntos'),
    'Ranking Competitivo': ('Rapero', 'Score'),
    'Ranking Podios': ('Rapero', 'Pts Podio'),
    'Ranking Duelos': ('Rapero', 'Ganados'),
    'Ranking Mundial': ('País', 'Puntos'),
}
_CACHE_FILA = {}


def fila_cabecera(hoja, refresco=False):
    """En qué fila está la cabecera de esa hoja, buscándola. 1-based.

    🔴 ESTABA CLAVADA EN `FILA_CAB = 16`, Y ESO REVENTO EN EL MISMO
    MODULO QUE MOVIO LA CABECERA. Medido el 22/09/2026: se rehizo
    `Ranking Temporada` con la cabecera en la fila 1 y el escritor
    siguio leyendo la 16 —vacia—, asi que `cab` salia vacia, cada fila
    salia `[]` y el relleno murio con `IndexError`.

    ⚠️ ES LA MISMA LECCION QUE ESTE MISMO CAMBIO LE APLICO A LOS DOS
    BUILDERS quince minutos antes: un numero de fila describe el DISEÑO
    de la hoja, no el dato. Tenerlo escrito obliga a acordarse de
    cambiarlo en cada lector, y el que se olvida **no falla igual**:
    el builder levanta `ValueError` y esto devolvia una tabla vacia.

    ⚠️ Y SE CACHEA POR CORRIDA, porque `tabla_nueva()` la pide varias
    veces y cada una es una lectura de la API.
    """
    if not refresco and hoja in _CACHE_FILA:
        return _CACHE_FILA[hoja]
    marcas = MARCAS.get(hoja) or ('Rapero',)
    v = _leer(OFICIAL, '%s!A1:AA40' % hoja)
    for i, f in enumerate(v, 1):
        h = [str(c).strip() for c in f]
        if all(m in h for m in marcas):
            _CACHE_FILA[hoja] = i
            return i
    # no se encontro: se contesta la de siempre y quien lea vera vacio
    _CACHE_FILA[hoja] = FILA_CAB if hoja == HOJA else 1
    return _CACHE_FILA[hoja]


def cabecera_oficial(hoja=None, fila=None):
    """La cabecera de esa hoja, tal cual está. Por defecto, la de Temporada.

    ⚠️ TOMA HOJA Y FILA porque cada vitrina tiene la suya en un renglón
    distinto —16, 12, 11— y las nuevas nacen en la 1. Leerla en vez de
    escribirla es lo que permite agregar una columna a la hoja y que el
    escritor la llene sin tocar código.
    """
    hoja = hoja or HOJA
    # ⚠️ SE BUSCA, no se asume la 16. Ver `fila_cabecera()`.
    fila = fila_cabecera(hoja) if fila is None else fila
    v = _leer(OFICIAL, '%s!A%d:AA%d' % (hoja, fila, fila))
    return [str(c).strip() for c in (v[0] if v else [])]


def rangos_de(res):
    """`{rapero: 'SSS'|…|'E'}` desde el Score. `{}` si no se puede.

    🔴 LA UNICA FUENTE DEL RANGO, para las cinco vitrinas y las cuatro
    cartas. `comun/rangos.de_score()` con el Score de
    `sheet/competitivo.py` — o sea el mismo número que decide la letra
    en la carta. *«El rango es uno solo por persona y tiene que dar
    igual en todas sus cartas»*, y eso incluye lo que la gente lee en
    el Sheet: hoy alguien abre el ranking, se ve «A», tira `/card` y le
    sale «B». Con esto no puede pasar.

    ⚠️ NO LEVANTA. Es un adorno de la vitrina, no su contenido: si el
    cálculo falla, la tabla se escribe igual con el rango en blanco. Lo
    que no puede pasar es que una columna nueva tumbe la escritura.
    """
    try:
        from competitivo import calcular
        from comun.rangos import de_score
        from comun.requisitos import minimo
        # 🔴 EL RANGO ES EL DEL COMPETITIVO, Y EL COMPETITIVO PIDE 10.
        # Quien no entra a esa hoja todavía no tiene letra.
        #
        # Dlx, 23/09/2026: *«el ranking competitivo no aparece nadie
        # hasta q tenga 10 eventos. Mira los requisitos de las
        # tarjetas»*. La respuesta estaba en `comun/requisitos.py` desde
        # siempre; lo que faltaba era aplicarla.
        #
        # ⚠️ ESTO YA ESTUVO PUESTO Y LO SAQUÉ, apoyado en la línea de
        # `CLAUDE.md` que dice *«el requisito bloquea la carta, no el
        # dato»* y que los que caen *«tienen derecho a ver su rango en
        # su Temporada»*. Esa línea se escribió cuando el corte sacaba
        # gente **del pool** —ahí sí perdían todo— y no describe esto:
        # acá el pool no se toca, sólo no se les inventa una letra que
        # todavía no ganaron. La decisión de Dlx manda sobre mi lectura.
        #
        # ⚠️ Y ASÍ LAS TRES PANTALLAS DICEN LO MISMO: el Sheet, la
        # página pública (`MIN_EV_RANGO`, que ya gateaba en 10) y la
        # carta. Era la única incoherencia que quedaba del rango.
        piso = minimo('competitivo', 'ev')
        return {q: de_score(v['score'])
                for q, v in calcular(res).items()
                if (v.get('ev') or 0) >= piso}
    except Exception:                                    # noqa: BLE001
        return {}


def _desempate(v, quien):
    """Lo que ordena a dos con el mismo OVR y los mismos puntos.

    La cadena de la guía (Parte 2, §10.8): 🥇 → 🥈 → eventos → WR%, y el
    nombre al final para que el orden no dependa del dict.

    ⚠️ «EVENTOS» VA DE MAYOR A MENOR, y es una lectura: la guía no dice
    el sentido. Con los mismos puntos y las mismas medallas, adelante
    queda quien compitió más.
    """
    g = lambda c: _OVR.num(v.get(c) or 0)
    return (-g('🥇'), -g('🥈'), -g('Ev'), -g('Win%'), str(quien).lower())


def _comp_ovr(v):
    """Las cinco componentes del OVR de esa persona, desde `agregar()`.

    ⚠️ `pod` SON LAS TRES MEDALLAS, no solo el oro. El builder del pool
    ya se comio ese bug —sumaba las tres y guardaba solo el oro— y si aca
    se leyera distinto, las dos mitades del mismo numero se separarian.
    """
    g = lambda c: _OVR.num(v.get(c) or 0)
    return (g('Puntos'), g('Ev'), g('Win%'),
            g('🥇') + g('🥈') + g('🥉'), g('🎯'))


def tabla_nueva():
    """La `Ranking Temporada` entera, recalculada. (filas, avisos).

    🔴 LAS COLUMNAS QUE NO SE PUEDEN CALCULAR SE **ARRASTRAN**, NO SE
    BORRAN. Las tres de Most Wanted y el `Rango` salen de otro lado; una
    reescritura que solo sepa lo que sale de `Resultados` las dejaria en
    blanco, y **escribir de menos en una hoja publica no falla**: deja
    ceros donde habia datos. Se copian de la fila que esa persona tenia.

    ⚠️ Y POR ESO HAY QUE REESCRIBIR LA TABLA ENTERA y no pisar celdas: el
    `#` y el orden dependen de `Puntos`, asi que al recalcular **las
    filas se mueven**. Arrastrar por nombre es lo que permite reordenar
    sin perder lo que no se calcula.

    ⚠️ Quien no estaba antes entra con esas columnas vacias, y es lo
    correcto: no tiene registro de Most Wanted todavia, y su `Rango` lo
    pone el pipeline del Competitivo.
    """
    from escribir import Hoja
    res, uno = Hoja('Resultados').filas(), Hoja('1v1').filas()
    avisos = []
    if not res:
        return None, ['`Resultados` está vacía: no hay de dónde calcular']
    ag = agregar(res, uno)
    rg = rangos_de(res)

    cab = cabecera_oficial()
    icol = {c: i for i, c in enumerate(cab)}
    viejo = {}
    for f in _leer(OFICIAL, '%s!A%d:AA' % (HOJA, fila_cabecera(HOJA) + 1)):
        f = list(f) + [''] * len(cab)
        nom = str(f[icol.get('Rapero', 1)]).strip()
        # 🔴 LA MISMA CLAVE PARA GUARDAR Y PARA BUSCAR. Acá se guardaba
        # SIN bandera (`MAU KC 🇨🇴` -> `mau kc`) y abajo se buscaba CON
        # bandera (`mau kc 🇨🇴`), así que nadie con bandera en el nombre
        # enganchaba nunca con su fila anterior. Se veía en el aviso de
        # cada corrida —«20 sin fila anterior: dxg🇲🇽🇨🇴🇨🇴, Garxziiscity
        # 🇦🇿…, KC 🇨🇴, Volk 🇲🇽, BLANKO 🇺🇸…»— y **todos** tenían bandera:
        # ese número no podía bajar nunca, y un aviso que no baja enseña a
        # no leerlo. Medido el 24/09/2026.
        #
        # ⚠️ Y ES LA CLAVE DE `canon()`: sólo letras y números. Cubre de
        # paso lo que el comentario de abajo ya nombraba como riesgo
        # —`Rodri LP` contra `RodriLP`, una tilde, un espacio de más—.
        base = _clave_fila(nom)
        if base:
            viejo[base] = f

    # 🔴 NINGUNA COLUMNA PUEDE QUEDAR SIN DUEÑO. Si una no se calcula ni
    # se arrastra, esta escritura la deja en blanco para las 138 sin un
    # solo error. Se pregunta **antes** de escribir, no despues.
    # ⚠️ SE LE PASA `viejo`, o sea lo que la hoja tiene HOY en filas con
    # nombre. Sin eso la pregunta es «¿alguien llena esta columna?» y la
    # respuesta es no para los seis servidores donde todavia no hubo
    # eventos — media temporada sin poder escribir. Ver `sin_dueno()`.
    huerfanas = sin_dueno(cab, ag, viejo)
    if huerfanas:
        return None, ['no escribo: %d columna(s) se borrarían en silencio '
                      '(%s). Ver `sin_dueno()`.'
                      % (len(huerfanas), ', '.join(huerfanas))]

    filas = []
    perdidos = []
    # ⚠️ QUIEN DE LA VITRINA VIEJA ENCONTRO DUEÑO. Es lo que mide la
    # deriva de nombres, y va colgado de la funcion —igual que
    # `resolver.fallo` en `motor.py`— para no cambiarle la firma a algo
    # que llaman cuatro lugares. Ver la guarda de `main()`.
    enganchadas = set()
    for quien, v in ag.items():
        prev = viejo.get(_clave_fila(quien), [])
        # 🔴 NO ENCONTRAR LA FILA VIEJA NO ES LO MISMO QUE SER NUEVO, y
        # se parecen mucho. Si el nombre de `Resultados` no escribe
        # igual que el de la vitrina —`Rodri LP` contra `RodriLP`, una
        # tilde, un espacio de más— el arrastre no engancha y esa
        # persona pierde su `Rango` y sus tres de Most Wanted. Sale una
        # fila válida con el Rango en blanco, que es justo el dato más
        # delicado del proyecto: el rango es UNO por persona y tiene que
        # dar igual en sus cuatro cartas.
        if not prev and viejo:
            perdidos.append(quien)
        if prev:
            enganchadas.add(_clave_fila(quien))
        fila = [''] * len(cab)
        for c, i in icol.items():
            if c in ARRASTRE:
                fila[i] = prev[i] if i < len(prev) else ''
            elif c in v:
                fila[i] = v[c]
        # 🔴 EL RANGO SE CALCULA, NO SE ARRASTRA — y estuvo VACIO para
        # las 21 personas hasta el 23/09/2026.
        #
        # Estaba en `ARRASTRE`, o sea que cada fila copiaba el `Rango`
        # de su propia fila anterior. Es un **candado**: después del
        # reset no había fila anterior con rango, así que no había de
        # dónde copiar, así que quedaba vacío, así que la corrida
        # siguiente tampoco tenía de dónde copiar. El dato no podía
        # entrar nunca. El docstring de arriba decía *«su Rango lo pone
        # el pipeline del Competitivo»* y **nadie lo ponía**: el
        # Competitivo escribe en SU hoja.
        #
        # ⚠️ ES LA MISMA FORMA QUE «quién debe tener carta no puede
        # salir de quién ya la tiene», y falla en el mismo caso: el
        # primero. Una columna que se arrastra de sí misma no tiene
        # semilla.
        #
        # ⚠️ Y SALE DEL SCORE, que es la regla central del proyecto:
        # *«el rango sale del Score competitivo. Siempre»*. El mismo
        # `calcular()` que llena `Ranking Competitivo`, así que la
        # vitrina y las cuatro cartas no pueden discrepar.
        if 'Rango' in icol:
            fila[icol['Rango']] = rg.get(quien, '')
        # ⚠️ SIEMPRE, no solo si está vacío. Antes decía `if not
        # fila[...]` porque `Rapero` se arrastraba, y eso congelaba la
        # grafía de la primera vez: la hoja se quedaba con `MAKMA`
        # mientras el resto del sistema usaba `Makma`. Ver `APARTE`.
        fila[icol.get('Rapero', 1)] = quien
        filas.append((_comp_ovr(v), fila, _desempate(v, quien)))

    # 🔴 EL ORDEN Y EL `#` SALEN DEL **OVR**, NO DE LOS PUNTOS.
    # Dlx, 24/09/2026: *«OVR… porque en si el OVR va a variar en mas
    # factores que puntos y MW»*. Hasta ese dia esta hoja ordenaba por
    # `Puntos` y el pool —o sea la carta, su pastilla y el hub— por OVR,
    # asi que **CJ era #1 en la planilla y #6 en la web** con los mismos
    # datos: 12.500 puntos de un solo evento dan OVR 74 contra el 86 de
    # Hassan. Dos pantallas, un dato, dos respuestas.
    #
    # ⚠️ LA FORMULA NO SE COPIA: se llama a `sheet/ovr.py`, que es el
    # mismo que usa `construir_pool_temporada.py`. Copiarla seria el bug
    # de las crews y el del divisor — dos lugares que empiezan iguales y
    # se separan solos.
    #
    # ⚠️ EL OVR SE NORMALIZA CONTRA EL GRUPO, asi que hay que calcularlo
    # con **todas** las filas juntas y no una por una. Verificado el
    # 24/09/2026: con las 74 de la vitrina y con las 70 del pool los
    # cinco topes dan identicos y el numero coincide persona por persona.
    _ovrs = _OVR.calcular([c for c, _f, _d in filas])
    # ⚠️ DESEMPATE POR PUNTOS. El OVR es un entero redondeado, asi que
    # hay empates de verdad; sin un segundo criterio el orden entre ellos
    # depende de como vino el dict y **cambia solo entre corridas**, con
    # la tabla entera moviendose sin que nadie compita.
    #
    # ⚠️ Y DESPUES, LA CADENA DE LA GUIA (Parte 2, §10.8): *«Puntos → 🥇 →
    # 🥈 → eventos → WR%»*. Con puntos solos el agujero seguia: dos con el
    # mismo OVR y los mismos puntos volvian a depender del dict. El nombre
    # cierra la cadena para que el orden no pueda cambiar solo.
    filas = [f for _o, _p, _d, f in sorted(
        [(-o, -_OVR.num(c[0]), d, f)
         for o, (c, f, d) in zip(_ovrs, filas)],
        key=lambda t: (t[0], t[1], t[2]))]
    for n, f in enumerate(filas, 1):
        f[icol['#']] = n

    # 🔴 UN TROLL QUE SALE NO ES «LA TABLA ENCOGE». El guardián de abajo
    # cuenta personas para atajar un `Resultados` leído a medias, y el
    # 24/09/2026 atajó lo contrario: sacar a «El ultra knowledge
    # instintivo» dejaba 86 contra 87, y la hoja no se escribió — con lo
    # que el pool y el hub siguieron mostrándolo. Los que salen por
    # `decidir.no_rankear()` no cuentan como perdidos; cualquier otro, sí.
    es_troll = _trolls()
    trolls_fuera = [k for k in viejo if es_troll(k)]
    if trolls_fuera:
        avisos.append('sale(n) %d nombre(s) troll: %s'
                      % (len(trolls_fuera), ', '.join(trolls_fuera)))
    hubo = len(viejo) - len(trolls_fuera)
    ahora = len(filas)
    if ahora < hubo:
        avisos.append('la tabla pasaría de %d a %d personas (%d menos)'
                      % (hubo, ahora, hubo - ahora))
    if perdidos:
        # ⚠️ YA NO DICE «con Rango en blanco»: el Rango se calcula desde
        # el 23/09 y no depende de haber estado antes. Lo único que se
        # arrastra son las tres de Most Wanted y el ✅.
        avisos.append('%d sin fila anterior: entran con Most Wanted '
                      'en blanco (%s%s)'
                      % (len(perdidos), ', '.join(perdidos[:6]),
                         '…' if len(perdidos) > 6 else ''))
    tabla_nueva.viejo_ids = list(viejo)
    tabla_nueva.enganchadas = enganchadas
    # `filas` ya son las filas: el orden por OVR las desarma arriba.
    return filas, avisos


tabla_nueva.viejo_ids = []
tabla_nueva.enganchadas = set()


# ══ LAS OTRAS VITRINAS ══════════════════════════════════════════════
#
# 🔴 ESTE MODULO ESCRIBIA UNA SOLA HOJA Y HAY CINCO. Dlx, 22/09/2026,
# mirando el Oficial despues del primer evento de la T1: *«no
# actualizaste los demas rankings»*. Tenia razon — `Ranking Temporada`
# se recalculaba y las otras cuatro seguian con los numeros pegados a
# mano de la pre-temporada.
#
# ⚠️ LAS TRES DE ACA SALEN DE LO MISMO QUE LA DE TEMPORADA: `agregar()`
# ya cuenta medallas, duelos y puntos por persona. No hacia falta un
# calculo nuevo, hacia falta **escribir lo que ya se sabia**.
#
# ⚠️ `Ranking de Ligas` NO ENTRA, y es a proposito: sus columnas son
# `Pts FMS` y `PTB`, que salen de ligas externas —FRZ, Snake— y no de
# ningun evento nuestro. Calcularla seria inventarla.

#: hoja -> (nombre, fila de la cabecera). La fila es la de HOY; cuando
#: la estructura se rehaga, se cambia acá y en un solo lugar.
#: ⚠️ LA FILA NO SE DECLARA: `escribir_todas()` la busca con
#: `fila_cabecera()`. Tenerla escrita fue lo que rompio el relleno el dia
#: que la cabecera se movio a la fila 1.
VITRINAS = ('temporada', 'competitivo', 'podios', 'duelos', 'mundial')
NOMBRE = {'temporada': 'Ranking Temporada', 'competitivo': 'Ranking Competitivo',
          'podios': 'Ranking Podios',
          'duelos': 'Ranking Duelos', 'mundial': 'Ranking Mundial'}

CAB_DUELOS = ['#', 'Rapero', 'Sv', 'Duelos', 'Ganados', 'Perdidos',
              'Win%', '🔥', 'Rango']

# 🔴 `Rango` ENTRA A LA CABECERA DEL COMPETITIVO, y por eso esta pasa a
# estar declarada acá en vez de leerse de la hoja. Es la vitrina que
# **decide** la letra —tiene el Score y las cinco dimensiones— y era la
# única de las cinco que no la mostraba: había que cruzarla con
# Temporada para saber qué rango daba su propio número.
#
# ⚠️ Va en la cuarta columna, pegada a la identidad y antes de los
# números, igual que en `Ranking Temporada`. Que las dos hojas pongan el
# rango en el mismo lugar es la mitad de que se lean como una familia.
CAB_COMPETITIVO = ['#', 'Rapero', 'Sv', 'Rango', 'Ev', 'Score', 'Confianza',
                   '⚡ Eficiencia', '🎯 Consistencia', '👑 Dominancia',
                   '🔥 Racha', '🌍 Diversidad', 'Posición # Temporada']

#: Las que se rehacen de cero, con su color de pestaña. Ver `rehacer_hoja()`.
#: El navy y el blurple son los que la planilla ya usa.
REHACER = {
    'duelos': {'red': 0.349, 'green': 0.400, 'blue': 0.949},   # blurple
    'mundial': {'red': 0.149, 'green': 0.698, 'blue': 0.647},  # teal
    # ⚠️ EL COMPETITIVO TAMBIEN, y por lo mismo que Podios: su banner
    # trae los líderes por dimensión **pegados a mano** —«Tuca 100/100»,
    # «Bau 100»— que son de la pre-temporada. Un banner que no se
    # recalcula es una vitrina que envejece.
    'competitivo': {'red': 0.353, 'green': 0.408, 'blue': 0.949},
}

# 🔴 LA CABECERA NUEVA DE `Ranking Temporada`, Y EL MOMENTO ES AHORA.
#
# Tiene todas las columnas que ya tenía, en un orden pensado —identidad,
# después los números grandes, después el desglose, y los servidores al
# final— más **FFA y EFA**, que faltaban.
#
# ⚠️ REHACERLA CUESTA LO QUE HAYA EN LAS COLUMNAS QUE NO SE CALCULAN, y
# medido el 22/09/2026 eso es **cero**: `Rango`, las tres de Most Wanted,
# `✅` y `Último Resultado` están **todas vacías** después del reset. Lo
# único con dato era `Rapero`, que el cálculo produce igual.
#
# Dentro de dos semanas eso deja de ser cierto y rehacerla pasa a ser una
# operación con pérdida. Por eso se hace hoy.
CAB_TEMPORADA = [
    '#', 'Rapero', 'Sv', 'Rango', 'Puntos', 'Ev', 'Win%', '🔥',
    '🥇', '🥈', '🥉', '🎖️', '4️⃣', '8️⃣', '➕',
    '🎯', '💀', '🛡️', 'Último Resultado', '✅',
] + list(SERVIDORES)

CAB_PODIOS = ['#', 'Rapero', '🥇', '🥈', '🥉', 'Pts Podio', '✅',
              'Vs Ranking Temporada', 'Vs Ranking Competitivo']

# 🔴 EL MUNDIAL SE REHACE PORQUE SU EVENTO NO EXISTE. Dlx, 22/09/2026:
# *«actualizar el ranking mundial que ese evento fifa ya no se esta
# haciendo»*.
#
# La hoja traia TRES cosas mezcladas: las selecciones (1 capitan + 4
# representantes por pais), la **Fecha FIFA** —el torneo mensual— y un
# «ranking pasivo» que suma los puntos de los representantes. Lo que se
# cae es el torneo; lo que queda en pie es justamente el pasivo, que no
# necesita ningun evento: son los puntos que la gente ya hizo, sumados
# por pais.
#
# ⚠️ POR ESO PASA DE SELECCIONES A PAISES. Una seleccion es una decision
# de la Directiva —el capitan elige— y sin Fecha FIFA no compite contra
# nadie: la tabla diria quien fue elegido, no quien rindio. Sumando por
# pais la hoja mide lo mismo que su propia linea prometia y se
# recalcula sola.
CAB_MUNDIAL = ['#', 'País', 'Raperos', 'Puntos', 'Eventos', '🥇',
               'Mejor', 'Pts del mejor']


def tabla_competitivo(res, orden_temp, sv_de, piso=None):
    """`Ranking Competitivo`: el Score y las cinco dimensiones.

    🔴 ESTE CALCULO NO EXISTIA. El Score se **leia** del Sheet y el Sheet
    lo recibia pegado desde un lugar que ya no existe, asi que con la T1
    arrancada nadie tenia Score — y sin Score no hay rango, que es la
    regla central del proyecto: *«el rango sale del Score competitivo.
    Siempre»*, y aparece en las cuatro tarjetas.

    Vive en `sheet/competitivo.py`, con la formula verificada contra las
    138 filas reales de la pre-temporada.
    """
    from competitivo import calcular
    from comun.rangos import de_score
    from comun.requisitos import minimo
    # 🔴 EN EL COMPETITIVO NO APARECE NADIE HASTA LOS 10 EVENTOS.
    #
    # Dlx, 23/09/2026: *«mira el ranking competitivo no aparece nadie
    # hasta q tenga 10 eventos. Mira los requisitos de las tarjetas…
    # estas son preguntas con respuestas muy sencillas»*. Y es asi: el
    # requisito ya estaba escrito en `comun/requisitos.py`, sólo no se
    # aplicaba acá. La hoja listaba a **las 45**, con gente de 1 evento.
    #
    # ⚠️ ESTO RESUELVE LA INCOHERENCIA DE LAS TRES PANTALLAS. Masino, con
    # 1 evento: el Sheet decía «Rango A», la página pública «Falta 9 EV»
    # y su carta Competitiva estaba bloqueada. Con la puerta puesta, las
    # tres dicen lo mismo — el rango **es** el competitivo, y el
    # competitivo pide 10.
    #
    # ⚠️ EL 10 NO SE ESCRIBE ACA: sale de `comun/requisitos.py`, que es
    # la fuente y ya tiene su self-check.
    # ⚠️ `piso=0` TRAE A TODOS, y lo usa `construir_pool_competitivo.py`.
    # La puerta es de la **vitrina**: los pools necesitan el Score de
    # todos porque las cartas de País y Servidor —que no piden 10
    # eventos— lo usan para el OVR Nacional y para ordenar dentro del
    # rango. Leer la hoja filtrada como fuente de datos fue exactamente
    # el error que dejó a los 45 en `score: 0.0`.
    if piso is None:
        piso = minimo('competitivo', 'ev')
    # 🔴 LAS FILAS SE CANONIZAN **ANTES** DE `calcular()`, Y FALTABA. La
    # canonización se puso en `agregar()` porque es el embudo de las cinco
    # vitrinas — pero ésta no pasa por ahí: recibe las filas crudas de
    # `Resultados` y se las da a `competitivo.calcular()`, que agrupa por
    # el nombre tal cual vino de la llave.
    #
    # El síntoma: `temporada_pool.json` decía `Makmah` y
    # `competitivo_pool.json` decía `Makma` **el mismo día y desde la misma
    # hoja**. Y eso rompe cosas que no se ven: `bot/rehacer.py` busca a la
    # persona en el pool competitivo, así que «rehacer las cartas de
    # Makmah» contestaba *«no está en el pool»* teniéndolo.
    #
    # ⚠️ Y NO SE ARREGLA EN `competitivo.py`: `rankings` lo importa, así
    # que importar al revés sería un ciclo. Se arregla acá, que es donde
    # las filas entran.
    res = [list(f[:4]) + [canon(str(f[4]).strip())] + list(f[5:])
           if len(f) > 4 else f for f in res]
    c = {q: v for q, v in calcular(res).items() if (v.get('ev') or 0) >= piso}
    filas = []
    for quien, v in c.items():
        # 🔴 LA HOJA QUE **DECIDE** EL RANGO NO LO MOSTRABA. Tiene el
        # Score y las cinco dimensiones, o sea todo lo que hace falta
        # para saber la letra, y la letra no estaba en ninguna columna.
        # La regla del proyecto es que el rango sale de acá —*«el rango
        # sale del Score competitivo. Siempre»*— así que esconderlo
        # justo en su propia hoja obliga a cruzarla con otra.
        filas.append((v['score'], [
            0, quien, sv_de.get(quien, ''), de_score(v['score']),
            v['ev'], v['score'], v['conf'],
            v['E'], v['C'], v['Dm'], v['T'], v['V'],
            _texto_pos(orden_temp.get(quien)),
        ]))
    filas.sort(key=lambda x: -x[0])
    out = []
    for n, (_s, f) in enumerate(filas, 1):
        f[0] = n
        out.append(f)
    return out


def _texto_pos(v):
    """`3` -> `3º`, vacío -> ''. Para las columnas «Vs Ranking X»."""
    return '%dº' % v if v else ''


def tabla_podios(ag, orden_temp, orden_comp):
    """`Ranking Podios`: quién sube más al podio. Filas ya ordenadas.

    ⚠️ `Pts Podio` NO ES `Puntos`. Es lo que el propio encabezado de la
    hoja dice —*«solo cuentan 1ros, 2dos y 3ros»*—: un puntaje del
    podio, no la suma de la temporada. Se arma con la escala que la hoja
    ya usaba: 5 por oro, 3 por plata, 1 por bronce.
    """
    filas = []
    for quien, v in ag.items():
        oro, pla, bro = v.get('🥇', 0), v.get('🥈', 0), v.get('🥉', 0)
        if not (oro or pla or bro):
            continue                      # sin podio no entra a esta hoja
        pts = oro * 5 + pla * 3 + bro * 1
        filas.append((pts, oro, [
            0, quien, oro or '', pla or '', bro or '', pts, '',
            _texto_pos(orden_temp.get(quien)),
            _texto_pos(orden_comp.get(quien)),
        ]))
    # ⚠️ EMPATE POR ORO. Con los mismos puntos de podio, gana el que
    # tiene mas primeros puestos: es lo que la hoja se llama.
    filas.sort(key=lambda x: (-x[0], -x[1]))
    out = []
    for n, (_p, _o, f) in enumerate(filas, 1):
        f[0] = n
        out.append(f)
    return out


def tabla_duelos(ag, rangos):
    """`Ranking Duelos`: quién ganó más duelos. Dlx lo pidió el 22/09.

    ⚠️ SE ORDENA POR GANADOS Y NO POR Win%. Un 1/1 da 100 % y no dice
    nada; la pregunta que Dlx hizo es *«quién tiene más duelos
    ganados»*. El Win% va igual, como columna.

    ⚠️ Y SOLO ENTRA QUIEN PELEO AL MENOS UNO. Una tabla de duelos llena
    de ceros esconde a los que sí pelearon.
    """
    filas = []
    for quien, v in ag.items():
        j = int(v.get('_dj') or 0)
        if not j:
            continue
        g = int(v.get('_dg') or 0)
        filas.append((g, j and 1.0 * g / j, [
            0, quien, v.get('Sv', ''), j, g, int(v.get('_dp') or 0),
            # ⚠️ EN DUELOS, LA RACHA DE DUELOS: hasta que Dlx diga si esta
            # vitrina también pasa a la de eventos, se queda con lo suyo
            v.get('Win%', ''), v.get('_racha_duelos', ''), rangos.get(quien, ''),
        ]))
    filas.sort(key=lambda x: (-x[0], -x[1]))
    out = []
    for n, (_g, _w, f) in enumerate(filas, 1):
        f[0] = n
        out.append(f)
    return out


def tabla_mundial(ag, pais_de):
    """`Ranking Mundial`: los países, por los puntos que su gente hizo.

    `pais_de` es `{rapero: 'Argentina'}`. Ver `CAB_MUNDIAL` arriba por
    qué esta hoja dejó de ser selecciones.

    ⚠️ `Raperos` ES CUÁNTOS APORTARON, no cuántos hay en el padrón. Un
    país con 33 personas y 2 compitiendo tiene 2 acá, y esa es la
    respuesta honesta: la tabla mide lo que se hizo esta temporada.
    """
    por = {}
    for quien, v in ag.items():
        p = (pais_de.get(quien) or '').strip()
        if not p:
            continue
        d = por.setdefault(p, {'n': 0, 'pts': 0, 'ev': 0, 'oro': 0,
                               'mejor': '', 'mejor_pts': -1})
        d['n'] += 1
        d['pts'] += int(v.get('Puntos') or 0)
        d['ev'] += int(v.get('Ev') or 0)
        d['oro'] += int(v.get('🥇') or 0)
        if int(v.get('Puntos') or 0) > d['mejor_pts']:
            d['mejor'], d['mejor_pts'] = quien, int(v.get('Puntos') or 0)
    filas = sorted(por.items(), key=lambda kv: -kv[1]['pts'])
    out = []
    for n, (p, d) in enumerate(filas, 1):
        out.append([n, p, d['n'], d['pts'], d['ev'], d['oro'] or '',
                    d['mejor'], d['mejor_pts'] if d['mejor_pts'] >= 0 else ''])
    return out


def _api(metodo, sid, cola, **kw):
    """Una llamada a la API de Sheets, con reintento por cuota.

    ⚠️ ESCRIBIR TAMBIÉN TIENE CUOTA —60 por minuto— y el paso que viste
    las cinco vitrinas manda varios `batchUpdate` seguidos. Ver `_leer`.
    """
    from reintentar import leer as _reint

    def _pedir():
        import requests
        from escribir import token
        r = requests.request(metodo, 'https://sheets.googleapis.com/v4'
                             '/spreadsheets/%s%s' % (sid, cola),
                             headers={'Authorization': 'Bearer ' + token()},
                             timeout=120, **kw)
        if r.status_code >= 300:
            # ⚠️ EL CÓDIGO VA EN EL TEXTO porque `reintentar._es_cuota()`
            # busca «429» ahí. Un `RuntimeError` que sólo diga «falló»
            # se reintentaría nunca.
            raise RuntimeError('%s %s -> %s: %s'
                               % (metodo, cola[:60], r.status_code,
                                  r.text[:200]))
        return r.json() if r.content else {}
    # ⚠️ UN `batchUpdate` CAMBIA LA ESTRUCTURA —bandas, condicionales,
    # pestañas—, así que la metadata guardada deja de valer. Ver `_meta()`.
    if metodo != 'GET' and ':batchUpdate' in cola:
        _META.pop(sid, None)
    return _reint(_pedir)


#: la metadata de cada documento, por corrida. Ver `_meta()`.
_META = {}


def _meta(sid, refresco=False):
    """`{pestaña: su metadata}` del documento: propiedades, bandas y
    reglas condicionales. **Una** lectura, **con** reintento.

    🔴 ERAN CUATRO `requests.get` SUELTOS Y NINGUNO REINTENTABA:
    `hoja_existe()`, `crear_hoja()`, `_hoja_id()` y `_adornos()`. Medido
    el 24/09/2026: el paso de Podios/Duelos/Mundial murió **en tres de
    cuatro corridas seguidas** —de las 2:22 PM a las 3:52 PM ET—, las
    tres en uno de estos dos: `?fields=sheets.properties` y
    `?fields=sheets(…bandedRanges…)`. `_leer()` y `_api()` tenían su
    reintento; la lectura que falló no pasaba por ninguno. Ninguna
    corrida figuró como fallida: el ciclo sigue, y las tres vitrinas se
    quedaron con los números de la corrida anterior.

    ⚠️ Y SE PEDÍAN DE A DOS POR HOJA, DOS VECES POR HOJA. `rehacer_hoja()`
    pedía la pestaña y después sus adornos, y `vestir()` las dos cosas
    otra vez: cuatro lecturas de metadata por vitrina, con la cuota en 60
    por minuto. Ahora es una, que se guarda hasta el próximo
    `batchUpdate` —que es lo único que la cambia—.
    """
    if refresco or sid not in _META:
        d = _api('GET', sid, '?fields=sheets(properties,'
                 'bandedRanges.bandedRangeId,conditionalFormats)')
        _META[sid] = {x['properties']['title']: x
                      for x in d.get('sheets') or []}
    return _META[sid]


def _mismo(mandado, leido):
    """¿La celda quedó con lo que se mandó? Compara número con número.

    🔴 `'32.0'` CONTRA `'32'` NO ES UN FALLO, Y SE REPORTABA COMO UNO.
    Sheets guarda un número y lo devuelve en su forma corta: mandarle
    `32.0` y leer `32` es la misma celda. Medido el 23/09/2026 en
    `Ranking Competitivo`: **«🔴 2 celda(s) no entraron»** con las dos
    bien escritas — las dimensiones son floats y las que caen redondas
    pierden el `.0` al volver.

    ⚠️ ES LA ALARMA FALSA DE SIEMPRE, y su costo no es el ruido: es que
    un verificador que grita por algo correcto **enseña a ignorarlo**, y
    el día que una celda de verdad no entre nadie va a mirar. Es la
    lección de las 188 del `audit` y la de los avisos repetidos.

    ⚠️ Y NO SE AFLOJA MÁS QUE ESO: si alguno de los dos no es un número,
    se compara el texto tal cual. `'12/16'` tiene que seguir siendo
    distinto de una fecha.
    """
    a, b = str(mandado).strip(), str(leido).strip()
    if a == b:
        return True
    try:
        return float(a) == float(b)
    except (TypeError, ValueError):
        return False


def alias_vivos(hoja=None, sid=None):
    """Los nombres de una vitrina que siguen siendo un ALIAS de otro.

    🔴 EXISTE PORQUE UNA CELDA NO ENTRO Y EL VERIFICADOR DIJO QUE SI.
    El 24/09/2026 se declaró `XXXXX -> Xubaru`, `escribir_vitrina()`
    mandó `Xubaru` en la fila 11 —comprobado interceptando la llamada— y
    contestó **0 celdas malas**, «74 quedaron», «la vitrina quedó como se
    calculó». La hoja seguía diciendo `XXXXX 🇳🇴`. En la misma
    corrida `Fokox -> Focox` y `gekto -> Presagio` sí entraron, así que no
    fue el mapa ni la tabla: fue **esa celda**. Repetir el comando lo
    arregló y no se pudo reproducir.

    ⚠️ NO SE SABE POR QUE, Y ESTE CHEQUEO NO LO AVERIGUA. Lo que hace es
    convertirlo en ruido en vez de silencio: `_mismo()` compara lo que
    mandé contra lo que leí, o sea que si el problema está **en la
    lectura** las dos mitades se equivocan juntas y la comparación pasa.
    Esto pregunta otra cosa —¿quedó algún alias vivo en la hoja?— con una
    lectura nueva y contra `datos/akas.json`, que es la fuente.

    ⚠️ Y CAZA UN SEGUNDO CASO, que es el que va a volver: declarar un
    alias nuevo y olvidar reescribir la vitrina. Ahí no falla nada
    tampoco — la hoja sigue mostrando a la misma persona dos veces.

    Devuelve `[(nombre_en_la_hoja, nombre_real), …]`, vacío si está bien.
    """
    hoja = hoja or HOJA
    fila = fila_cabecera(hoja)
    v = _leer(sid or OFICIAL, '%s!A%d:C300' % (hoja, fila))
    # ⚠️ la columna del nombre se BUSCA, como en todo el resto de este
    # archivo: un índice escrito describe el diseño de la hoja de hoy.
    cab = v[0] if v else []
    try:
        c = [str(x).strip().lower() for x in cab].index('rapero')
    except ValueError:
        c = 1
    malos = []
    for f in v[1:]:
        n = str(f[c]).strip() if len(f) > c else ''
        if not n:
            continue
        real = canon(n)
        if real and _norm(real) != _norm(n):
            malos.append((n, real))
    return malos


def escribir_vitrina(filas, cab, sid=None, hoja=None, fila_cab=None):
    """Reemplaza `Ranking Temporada` por `filas`. Devuelve qué pasó.

    Los tres últimos son para `--ensayo`, que corre **este mismo código**
    contra una pestaña de prueba. Un escritor que sólo se va a ejecutar
    una vez, el día del reset, y nunca antes, es un escritor que se
    estrena con gente mirando.

    🔴 SE ESCRIBE PRIMERO Y SE LIMPIA LA COLA DESPUES, en ese orden, y
    no es cosmético. Al revés —limpiar y después escribir— hay un
    instante en que la vitrina pública está **vacía**, y si el segundo
    pedido falla se queda así. Escribiendo primero, lo peor que puede
    pasar es una tabla completa con filas viejas colgando debajo, que la
    corrida siguiente arregla sola.

    ⚠️ Y LA COLA HAY QUE LIMPIARLA. La tabla se reordena y **encoge**:
    escribir 100 filas sobre 138 deja 38 fantasmas abajo, con su `#`
    viejo, y nada falla. Es el mismo error que este repo ya documentó en
    los conteos por archivos: lo que quedó de antes se lee como si fuera
    de ahora.

    ⚠️ SE VERIFICA LEYENDO. Un 200 dice que la API aceptó el pedido, no
    que la hoja quedó como se pidió — `escribir.poner()` tiene medido el
    caso de la celda combinada que se traga los valores en silencio.
    """
    sid = sid or OFICIAL
    hoja = hoja or HOJA
    fila_cab = fila_cabecera(hoja) if fila_cab is None else fila_cab
    n = len(filas)
    ancho = len(cab)
    fin = fila_cab + n
    cuerpo = [list(f) + [''] * (ancho - len(f)) for f in filas]

    _api('PUT', sid,
         '/values/%s?valueInputOption=RAW'
         % _q("%s!A%d:%s%d" % (hoja, fila_cab + 1, _col(ancho), fin)),
         json={'values': cuerpo})
    _api('POST', sid,
         '/values/%s:clear' % _q('%s!A%d:%s' % (hoja, fin + 1, _col(ancho))),
         json={})

    leido = _leer(sid, '%s!A%d:%s' % (hoja, fila_cab + 1, _col(ancho)))
    vivas = [f for f in leido if any(str(c).strip() for c in f)]
    malas = []
    for i, esperada in enumerate(cuerpo):
        real = list(leido[i]) if i < len(leido) else []
        for j, val in enumerate(esperada):
            got = str(real[j]) if j < len(real) else ''
            if not _mismo(val, got):
                malas.append('fila %d col %s: mandé %r y quedó %r'
                             % (fila_cab + 1 + i, _col(j + 1),
                                str(val)[:14], got[:14]))
    return {'escritas': n, 'quedaron': len(vivas), 'malas': malas[:8],
            'total_malas': len(malas)}


def hoja_existe(sid, nombre):
    """`True` si esa pestaña está en el documento. Ver `_meta()`."""
    return nombre in _meta(sid)


def crear_hoja(sid, nombre, cab, color=None):
    """Crea la pestaña con su cabecera congelada. No hace nada si ya está.

    ⚠️ CABECERA EN LA FILA 1 Y CONGELADA, que es como tienen que nacer
    las hojas nuevas. Las viejas la tienen en la 16, la 12 y la 11, con
    un banner arriba, y eso es lo que obliga a que cada script lleve
    escrito en qué fila empieza cada una.
    """
    if hoja_existe(sid, nombre):
        return False
    _api('POST', sid, ':batchUpdate', json={'requests': [
        {'addSheet': {'properties': {
            'title': nombre,
            'gridProperties': {'rowCount': 1000, 'columnCount': max(len(cab), 12),
                               'frozenRowCount': 1},
            'tabColorStyle': {'rgbColor': color or {'red': 0.35, 'green': 0.40,
                                                    'blue': 0.95}},
        }}}]})
    _api('PUT', sid, '/values/%s?valueInputOption=RAW'
         % _q('%s!A1:%s1' % (nombre, _col(len(cab)))), json={'values': [cab]})
    # la cabecera, con el mismo navy de las otras hojas
    hid = ((_meta(sid).get(nombre) or {}).get('properties') or {}).get('sheetId')
    if hid is not None:
        _api('POST', sid, ':batchUpdate', json={'requests': [
            {'repeatCell': {
                'range': {'sheetId': hid, 'startRowIndex': 0, 'endRowIndex': 1},
                'cell': {'userEnteredFormat': {
                    'backgroundColorStyle': {'rgbColor': {
                        'red': 0.118, 'green': 0.118, 'blue': 0.173}},
                    'textFormat': {'bold': True, 'foregroundColorStyle': {
                        'rgbColor': {'red': 1, 'green': 1, 'blue': 1}}},
                }},
                'fields': 'userEnteredFormat(backgroundColorStyle,textFormat)',
            }}]})
    return True


def _hoja_id(sid, nombre):
    """Las propiedades de esa pestaña, o `None`. Ver `_meta()`."""
    x = _meta(sid).get(nombre)
    return x['properties'] if x else None


def _adornos(sid, nombre):
    """Las bandas y las reglas condicionales que la hoja YA tiene.

    🔴 HAY QUE SACARLAS ANTES DE PONER LAS NUEVAS, y las dos fallan
    distinto. `addBanding` sobre una hoja que ya tiene una banda da
    **400 `You can't add a banded range that overlaps`** y con eso se cae
    el batch entero: o sea que la primera corrida deja la vitrina linda y
    la segunda la rompe. Las condicionales **no** fallan, se apilan: a la
    décima corrida la hoja tiene diez reglas iguales, y eso sí se nota
    porque Sheets se pone lento.

    ⚠️ `updateCells` con `userEnteredFormat` NO las borra: banding y
    condicionales son objetos de la hoja, no formato de celda. Es por eso
    que `rehacer_hoja()` las dejaba pasar aunque limpie todo.
    """
    x = _meta(sid).get(nombre) or {}
    return ([b['bandedRangeId'] for b in x.get('bandedRanges', [])],
            len(x.get('conditionalFormats', [])))


def rehacer_hoja(sid, nombre, cab, filas, color=None):
    """Deja la hoja con cabecera en la fila 1, congelada y SIN merges.

    🔴 ESTA ES LA PRIMITIVA DEL REDISEÑO, y nació de un fallo medido.
    Escribir el `Ranking Mundial` nuevo sobre el viejo mandó 8 filas y
    **31 celdas volvieron vacías**: la maqueta de selecciones tiene
    celdas combinadas, y una combinada se traga lo que le escribís sin
    devolver ningún error. `escribir_vitrina()` lo detecta porque
    verifica leyendo — si no, la hoja habría quedado a medias y el
    informe habría dicho «8 escritas».

    ⚠️ POR ESO SE DESARMAN LOS MERGES PRIMERO. Pisar celdas no alcanza
    cuando la hoja vieja tiene otra forma; hay que rehacerla.

    ⚠️ Y EL ORDEN ES: desarmar, limpiar, escribir. Limpiar al final
    dejaría la tabla nueva y después la borraría.
    """
    props = _hoja_id(sid, nombre)
    if props is None:
        crear_hoja(sid, nombre, cab, color)
        props = _hoja_id(sid, nombre)
    hid = props['sheetId']
    filas_hoja = props['gridProperties']['rowCount']
    cols_hoja = props['gridProperties']['columnCount']
    ancho = max(len(cab), 1)

    bandas, n_cond = _adornos(sid, nombre)
    peticiones = [{'unmergeCells': {'range': {'sheetId': hid}}}]
    # ⚠️ LAS CONDICIONALES SE BORRAN DE ATRAS PARA ADELANTE. Borrar la 0
    # corre las demas un lugar, asi que borrar 0,1,2 saltea la del medio
    # y deja la mitad puestas. Es el mismo error que borrar de una lista
    # mientras se la recorre.
    peticiones += [{'deleteConditionalFormatRule': {'sheetId': hid, 'index': i}}
                   for i in range(n_cond - 1, -1, -1)]
    peticiones += [{'deleteBanding': {'bandedRangeId': b}} for b in bandas]
    peticiones.append({'updateCells': {'range': {'sheetId': hid},
                                       'fields': 'userEnteredValue,userEnteredFormat'}})
    if color:
        peticiones.append({'updateSheetProperties': {
            'properties': {'sheetId': hid, 'tabColorStyle': {'rgbColor': color}},
            'fields': 'tabColorStyle'}})
    _api('POST', sid, ':batchUpdate', json={'requests': peticiones})

    _api('PUT', sid, '/values/%s?valueInputOption=RAW'
         % _q('%s!A1:%s1' % (nombre, _col(ancho))), json={'values': [cab]})
    escritas = escribir_vitrina(filas, cab, sid=sid, hoja=nombre, fila_cab=1)
    # ⚠️ LIMPIA: el batch de arriba ya le sacó bandas y condicionales, así
    # que preguntarle cuáles tiene es una lectura que contesta «ninguna».
    vestir(sid, nombre, cab, filas, hid=hid, limpia=True)
    return escritas, (filas_hoja, cols_hoja)


def vestir(sid, nombre, cab, filas, hid=None, limpia=False):
    """Le pone el diseño a una vitrina ya escrita. Ver `sheet/estilo.py`.

    🔴 LO LLAMAN LAS DOS RUTAS, Y ESO ES EL PUNTO. `Ranking Temporada` y
    `Ranking Podios` no se rehacen —conservan columnas que no se
    calculan— así que pasan por `escribir_vitrina()` y se quedaban
    **sin** el rediseño. Medido el 23/09/2026 leyendo la planilla: las
    tres rehechas tenían banda y dos columnas congeladas, y las dos que
    más se miran seguían igual que antes.

    ⚠️ ERA EXACTAMENTE «el rediseño no se nota»: se notaba en las tres
    hojas que nadie abre y no en la portada. Dlx pidió que se note.

    ⚠️ EL ESTILO VA **DESPUES** DE ESCRIBIR: `por_fila()` pinta la celda
    de `Rango` con el color de ese rango, o sea que necesita los valores
    puestos, y `formato()` necesita cuántas filas hay para no pedir
    bandas sobre un rango vacío — que es un 400 que tumba el batch.
    """
    if hid is None:
        props = _hoja_id(sid, nombre)
        if props is None:
            return False
        hid = props['sheetId']
    # limpiar lo de antes: las bandas chocan y las condicionales se apilan
    bandas, n_cond = ([], 0) if limpia else _adornos(sid, nombre)
    previas = ([{'deleteConditionalFormatRule': {'sheetId': hid, 'index': i}}
                for i in range(n_cond - 1, -1, -1)]
               + [{'deleteBanding': {'bandedRangeId': b}} for b in bandas])
    pet = previas + (estilo.formato(hid, cab, len(filas))
                     + estilo.por_fila(hid, cab, filas)
                     + estilo.condicionales(hid, cab, len(filas)))
    if pet:
        _api('POST', sid, ':batchUpdate', json={'requests': pet})
    return True


def rehacer_estructura(dry=True):
    """Pone `Ranking Temporada` y `Ranking Podios` con la cabecera arriba.

    🔴 ES LA MITAD ESTRUCTURAL DEL REDISEÑO. Las vitrinas viejas tienen
    la cabecera en la fila 16, la 12 y la 11, con un banner arriba y
    celdas combinadas — y ese banner **se pega a mano**, así que miente
    apenas cambian los datos: el de Podios seguía diciendo *«Zignos — 99
    pts»* y *«Axinu — 24 oros»*, números de la pre-temporada, con la T1
    ya arrancada.

    ⚠️ NO BORRA LO QUE NO SE PUEDE RECALCULAR: se comprueba antes. Ver
    `CAB_TEMPORADA`, donde está medido que hoy no hay nada que perder.

    ⚠️ Y DESPUÉS HAY QUE VOLVER A ESCRIBIR EL CUERPO. Esto deja la hoja
    con su cabecera nueva y vacía; `tabla_nueva()` la lee y la llena.
    """
    pendientes = []
    cab_vieja = cabecera_oficial()
    # 🔴 LA COMPROBACIÓN, ANTES DE TOCAR NADA: ninguna columna que no se
    # calcule puede tener datos. Si los tiene, esto no corre.
    v = _leer(OFICIAL, '%s!A%d:AA' % (HOJA, fila_cabecera(HOJA) + 1))
    icol = {c: i for i, c in enumerate(cab_vieja)}
    con_datos = []
    for c in ARRASTRE:
        if c == 'Rapero':
            continue                  # se recalcula
        i = icol.get(c)
        if i is None:
            continue
        n = sum(1 for f in v if len(f) > i and str(f[i]).strip()
                and len(f) > 1 and str(f[1]).strip())
        if n:
            con_datos.append('%s (%d)' % (c, n))
    if con_datos:
        return {'freno': 'hay columnas con datos que no se recalculan: %s'
                         % ', '.join(con_datos)}

    faltan = [c for c in cab_vieja if c and c not in CAB_TEMPORADA]
    if faltan:
        return {'freno': 'la cabecera nueva perdería %s' % ', '.join(faltan)}

    # los tonos que la planilla ya usa: el ámbar de las bandas y el
    # dorado de los podios
    pendientes.append((HOJA, CAB_TEMPORADA,
                       {'red': 0.722, 'green': 0.525, 'blue': 0.043}))
    pendientes.append(('Ranking Podios', CAB_PODIOS,
                       {'red': 0.898, 'green': 0.725, 'blue': 0.290}))
    if dry:
        return {'haria': [(n, len(c)) for n, c, _x in pendientes],
                'cab_vieja': len(cab_vieja), 'cab_nueva': len(CAB_TEMPORADA),
                'agrega': [c for c in CAB_TEMPORADA if c not in cab_vieja]}
    out = {}
    for nombre, cab, color in pendientes:
        r, _ = rehacer_hoja(OFICIAL, nombre, cab, [], color=color)
        out[nombre] = r
    return out


def identidad():
    """`(pais_de, rango_de)` por nombre de rapero, desde el padrón y el pool.

    ⚠️ EL PAIS SALE DEL PADRON Y EL RANGO DEL POOL COMPETITIVO, y no es
    lo mismo preguntarle a los dos: el país es identidad y está para
    todos, el rango sale del Score y **sólo lo tiene quien compite**.
    Mezclarlos daría un rango inventado para quien no tiene Score.
    """
    pais, rango = {}, {}
    # 🔴 EL NOMBRE DEL PAIS SALE DE `datos/padron.json` Y NO DE
    # `padron.seguro()`, que trae `cc` —el codigo ISO— y no el nombre.
    # Pedirle `pais` a esa fila devuelve **cadena vacia sin fallar**, y
    # con eso el Ranking Mundial salia con **cero paises** teniendo
    # quince personas con puntos. Es la forma de siempre: el dato estaba
    # y se pedia por otro nombre.
    try:
        p = os.path.join(BASE, 'datos', 'padron.json')
        with io.open(p, encoding='utf-8') as f:
            for x in json.load(f):
                if x.get('raw'):
                    pais[x['raw']] = (x.get('pais') or '').strip()
    except (OSError, ValueError):
        pass
    try:
        p = os.path.join(BASE, 'datos', 'competitivo_pool.json')
        with io.open(p, encoding='utf-8') as f:
            for x in json.load(f):
                if x.get('raw'):
                    rango[x['raw']] = x.get('rango') or ''
    except (OSError, ValueError):
        pass
    return pais, rango


def escribir_todas(dry=True):
    """Recalcula y escribe Podios, Duelos y Mundial. `{hoja: resultado}`.

    ⚠️ `Ranking Temporada` NO ENTRA ACA: tiene arrastre de columnas que
    no se calculan —`Rango`, las tres de Most Wanted— y por eso su
    escritura pasa por `tabla_nueva()`, que las conserva. Estas tres se
    calculan enteras, así que no hay nada que arrastrar.
    """
    from escribir import Hoja
    res, uno = Hoja('Resultados').filas(), Hoja('1v1').filas()
    ag = agregar(res, uno)
    pais_de, _rango_pool = identidad()
    # 🔴 UN SOLO ORIGEN PARA EL RANGO, Y EL POOL DEJA DE SER RESPALDO.
    #
    # `identidad()` lo saca de `datos/competitivo_pool.json`, que **no
    # tiene la puerta de los 10 eventos**. Mientras `rangos_de()` daba
    # letra a todos daba igual cuál ganara; con la puerta puesta el pool
    # se volvió una gotera: medido el 23/09/2026, `Ranking Temporada`
    # quedó con 0 letras y `Ranking Duelos` con **5**, sacadas de ahí.
    #
    # ⚠️ Y UN RESPALDO QUE NO SIGUE LA REGLA NO ES UN RESPALDO: sirve el
    # dato justo cuando la regla dice que no hay dato. Quien no aparece
    # en `Resultados` tampoco tiene Score, así que no pierde ninguna
    # letra que hubiera ganado.
    rango_de = rangos_de(res)

    # el puesto de cada uno en las dos tablas grandes, para las columnas
    # «Vs Ranking …» de Podios
    por_pts = sorted(ag.items(), key=lambda kv: -int(kv[1].get('Puntos') or 0))
    orden_temp = {k: i for i, (k, _v) in enumerate(por_pts, 1)}
    orden_comp = {}
    try:
        p = os.path.join(BASE, 'datos', 'competitivo_pool.json')
        with io.open(p, encoding='utf-8') as f:
            for x in json.load(f):
                if x.get('raw') and x.get('pos'):
                    orden_comp[x['raw']] = x['pos']
    except (OSError, ValueError):
        pass

    sv_de = {k: v.get('Sv', '') for k, v in ag.items()}
    trabajos = [
        ('competitivo', tabla_competitivo(res, orden_temp, sv_de),
         CAB_COMPETITIVO),
        ('podios', tabla_podios(ag, orden_temp, orden_comp), None),
        ('duelos', tabla_duelos(ag, rango_de), CAB_DUELOS),
        ('mundial', tabla_mundial(ag, pais_de), CAB_MUNDIAL),
    ]
    out = {}
    for cual, filas, cab in trabajos:
        nombre = NOMBRE[cual]
        # ⚠️ LAS QUE SE REHACEN TIENEN LA CABECERA EN LA FILA 1 SIEMPRE
        # —`rehacer_hoja()` la pone ahí—, así que buscarla es una lectura
        # que no cambia nada. Tres de cuatro, con la cuota en 60 por minuto.
        fila_cab = 1 if cual in REHACER else fila_cabecera(nombre)
        if cab is None:
            cab = cabecera_oficial(hoja=nombre, fila=fila_cab)
        out[cual] = {'filas': len(filas), 'hoja': nombre, 'cab': len(cab)}
        if dry:
            out[cual]['muestra'] = filas[:3]
            continue
        # 🔴 LAS QUE NACEN O CAMBIAN DE FORMA SE **REHACEN**; las que
        # conservan su maqueta se escriben encima.
        #
        # `Ranking Duelos` es nueva y `Ranking Mundial` cambia de
        # contenido —de selecciones a países— así que su maqueta vieja
        # ya no sirve: sus celdas combinadas se tragaron 31 valores en
        # la primera prueba. `Ranking Podios` mantiene sus columnas, así
        # que se le pisa el cuerpo y se le deja el encabezado.
        if cual in REHACER:
            r, _ = rehacer_hoja(OFICIAL, nombre, cab, filas,
                                color=REHACER[cual])
            out[cual]['r'] = r
        else:
            out[cual]['r'] = escribir_vitrina(filas, cab, hoja=nombre,
                                              fila_cab=fila_cab)
            # ⚠️ EL DISEÑO TAMBIEN ACA. Conservar la maqueta no es lo
            # mismo que no vestirla: Podios se escribe encima porque sus
            # columnas se mantienen, y aun asi tiene que verse como las
            # otras cuatro. Sin esto el rediseño se notaba en las tres
            # hojas que nadie abre.
            if fila_cab == 1:
                vestir(OFICIAL, nombre, cab, filas)
    return out


def _col(n):
    """1 -> A, 27 -> AA."""
    s = ''
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(ord('A') + r) + s
    return s


def _q(s):
    import requests
    return requests.utils.quote(s)


ENSAYO = '_ensayo_vitrina'


def ensayo():
    """Corre el escritor de verdad contra una pestaña de prueba.

    🔴 POR QUE ESTO EXISTE. `escribir_vitrina()` se va a ejecutar **una
    vez**, el día del reset, sobre la hoja que mira toda la Liga, y hasta
    hoy nunca se había ejecutado. Este repo ya tiene la lección escrita
    en el paso 1 del ciclo: *«si no se ejercita, el día que se encienda
    se estrena»*. Tres bugs de esta semana sólo aparecieron corriendo de
    verdad, y los tres pasan la lectura del diff.

    ⚠️ VA CONTRA EL **OPERATIVO**, en una pestaña que se crea y se borra
    acá mismo. No hay nada que perder: la pestaña nace vacía y muere en
    la misma corrida, también si algo revienta.

    ⚠️ LO QUE DE VERDAD PRUEBA ES QUE LA COLA SE LIMPIA. Escribir sobre
    una hoja vacía anda siempre; el caso que rompe es la segunda
    escritura, más corta que la primera, que deja filas viejas colgando
    con su `#` de antes. Por eso escribe 8 y después 3.
    """
    from planillas import operativo
    sid = operativo()
    print('\n══ ENSAYO DEL ESCRITOR, EN UNA PESTAÑA DE PRUEBA ══\n')
    print('   planilla  %s' % sid)
    print('   pestaña   %s  (se crea y se borra acá)\n' % ENSAYO)

    # ⚠️ SI QUEDÓ UNA DE ANTES, SE BORRA. El `finally` de abajo cubre
    # las excepciones pero no que a alguien le corten el job: un tab
    # huérfano haría fallar el `addSheet` por título repetido, y el
    # ensayo pasaría de «probó el escritor» a «no pudo ni empezar» todas
    # las semanas.
    vieja = [s['properties']['sheetId']
             for s in _api('GET', sid, '?fields=sheets.properties')['sheets']
             if s['properties']['title'] == ENSAYO]
    if vieja:
        print('   (había una pestaña de un ensayo cortado: la borro)')
        _api('POST', sid, ':batchUpdate', json={'requests': [
            {'deleteSheet': {'sheetId': v}} for v in vieja]})

    hid = _api('POST', sid, ':batchUpdate', json={'requests': [
        {'addSheet': {'properties': {'title': ENSAYO}}}]})
    hid = hid['replies'][0]['addSheet']['properties']['sheetId']
    mal = 0
    try:
        cab = ['#', 'Rapero', 'Puntos', '🔥']
        _api('PUT', sid, '/values/%s?valueInputOption=RAW'
             % _q('%s!A1:D1' % ENSAYO), json={'values': [cab]})

        largo = [[i, 'R%02d' % i, 100 - i, '%d/%d' % (i % 3, i)]
                 for i in range(1, 9)]
        r1 = escribir_vitrina(largo, cab, sid=sid, hoja=ENSAYO, fila_cab=1)
        corto = largo[:3]
        r2 = escribir_vitrina(corto, cab, sid=sid, hoja=ENSAYO, fila_cab=1)

        for que, ok, detalle in [
            ('la primera escritura deja 8 filas',
             r1['quedaron'] == 8 and not r1['malas'], r1),
            ('la segunda deja 3 y NO 8: la cola se limpió',
             r2['quedaron'] == 3, r2),
            ('y lo que quedó es lo que se mandó', not r2['malas'], r2),
        ]:
            mal += not ok
            print('   %s %s' % ('✅' if ok else '🔴', que))
            if not ok:
                print('      %s' % detalle)

        # 🔴 QUE EL VERIFICADOR PUEDA FALLAR, Y CON EL CASO DE VERDAD.
        # Un chequeo que sólo da verde no distingue «escribió bien» de
        # «no miró». El caso que este verificador existe para agarrar
        # está medido en `escribir.poner()`: una **celda combinada se
        # traga los valores en silencio** y la API igual contesta 200.
        # Pasó el 20/09 escribiendo `Config`. Acá se reproduce a mano.
        _api('POST', sid, ':batchUpdate', json={'requests': [
            {'mergeCells': {'mergeType': 'MERGE_ALL', 'range': {
                'sheetId': hid, 'startRowIndex': 2, 'endRowIndex': 3,
                'startColumnIndex': 1, 'endColumnIndex': 3}}}]})
        r3 = escribir_vitrina(corto, cab, sid=sid, hoja=ENSAYO, fila_cab=1)
        ok = bool(r3['malas'])
        mal += not ok
        print('   %s con una celda combinada, el verificador GRITA  (%s)'
              % ('✅' if ok else '🔴',
                 r3['malas'][0] if r3['malas'] else 'no dijo nada'))
    finally:
        _api('POST', sid, ':batchUpdate',
             json={'requests': [{'deleteSheet': {'sheetId': hid}}]})
        print('\n   pestaña borrada')
    print('')
    return mal


def _self_check():
    """Lo que se puede probar sin la planilla: la racha y el guardián."""
    mal = 0

    print('\n  la racha, con los duelos en orden')
    for que, gano, esp in [
        ('todo ganado', [1, 1, 1], '3/3'),
        ('cortada al final', [1, 1, 0], '0/2'),
        ('vuelve a arrancar', [1, 1, 0, 1], '1/2'),
        ('nunca gano', [0, 0], '0/0'),
        ('un solo duelo', [1], '1/1'),
    ]:
        r = _racha([bool(x) for x in gano])
        ok = r == esp
        mal += not ok
        print('   %s %-20s %s -> %s' % ('✅' if ok else '🔴', que, gano, r))

    # 🔴 EL ORDEN ES POR `Evento #` Y LA HOJA PUEDE TRAERLOS MEZCLADOS.
    # `resultados.reescribir()` saca las filas de un evento reprocesado y
    # las vuelve a agregar **al final**, asi que el #1 puede quedar debajo
    # del #2. Leyendo en el orden del archivo la racha sale distinta y
    # sigue siendo un numero creible.
    print('\n  y no en el orden en que estan en la hoja')
    #        num, fecha, sv, ronda, A,     B,     ganador, perdedor, notas
    uno = [[2, '', '', '', 'Ana', 'Bea', 'Bea', 'Ana', ''],
           [1, '', '', '', 'Ana', 'Cyn', 'Ana', 'Cyn', ''],
           [3, '', '', '', 'Ana', 'Dia', 'Ana', 'Dia', '']]
    ag = agregar([], uno)
    ok = ag.get('Ana', {}).get('_racha_duelos') == '1/1'
    mal += not ok
    print('   %s Ana gana el #1, pierde el #2, gana el #3 -> %s '
          '(en orden de hoja daria 1/2)'
          % ('✅' if ok else '🔴', ag.get('Ana', {}).get('_racha_duelos')))

    # 🔑 LA RACHA DE EVENTOS, como la definió Dlx el 25/09/2026. Ver
    # `_umbral()`: semifinal si la llave es de 16, la final si es de 8.
    print('\n  la racha de eventos (semifinal en llave de 16, final en llave de 8)')

    def R(num, fecha, quien, pos):
        return [num, fecha, 'FFA', '16+', quien, 'ar', pos, 10, '', 10, '']
    res = [
        # #1, 22/09, llave de 16 (alguien quedó en octavos): semifinal SUMA
        R(1, '22/09', 'Ana', 'Semifinal'), R(1, '22/09', 'Bea', 'Cuarto'),
        R(1, '22/09', 'Zed', 'Octavos'),
        # #2, del 25/09 aunque tenga número 2: llave de 8, semifinal NO suma
        R(2, '25/09', 'Ana', 'Semifinal'), R(2, '25/09', 'Zed', 'Cuartos'),
        # #3, 24/09, llave de 8: subcampeón SUMA
        R(3, '24/09', 'Ana', 'Subcampeón'), R(3, '24/09', 'Zed', 'Cuartos'),
    ]
    ag = agregar(res, [])
    for que, got, esp in [
        ('Ana: #1 ✓ (22/09) · #3 ✓ (24/09) · #2 ✗ (25/09) — por FECHA, no por número',
         ag.get('Ana', {}).get('🔥'), '0/2'),
        ('Bea: el cuarto puesto es semifinal en una llave de 16',
         ag.get('Bea', {}).get('🔥'), '1/1'),
        ('Zed: quedó en octavos y en cuartos, nunca suma',
         ag.get('Zed', {}).get('🔥'), '0/0'),
        ('y el cuarto puesto cuenta como semifinal en SEM',
         ag.get('Bea', {}).get('🎖️'), 1),
    ]:
        ok = got == esp
        mal += not ok
        print('   %s %s -> %s' % ('✅' if ok else '🔴', que, got))
    ok = (_orden_fecha('02/01', 9) > _orden_fecha('28/12', 1)
          and _orden_fecha('23/09', 355) < _orden_fecha('24/09', 353))
    mal += not ok
    print('   %s la fecha ordena aunque cruce diciembre y aunque el # esté corrido'
          % ('✅' if ok else '🔴'))

    print('\n  ninguna columna se borra en silencio')
    cab = ['#', 'Rapero', 'Puntos', '🔥', 'Rango', 'Sv', 'Ev']
    ag2 = agregar([[1, '', 'DRA', '8-15', 'Ana', '', 'campeon', 10, '', 10,
                    '']], uno)
    casos = [
        ('con la racha calculada, ninguna huérfana',
         sin_dueno(cab, ag2) == []),
        ('si `🔥` dejara de calcularse, se avisa',
         sin_dueno(cab, {'Ana': {k: v for k, v in ag2['Ana'].items()
                                 if k != '🔥'}}) == ['🔥']),
        ('una columna nueva en la hoja también',
         sin_dueno(cab + ['Nueva'], ag2) == ['Nueva']),
        # 🔴 CON LA HOJA DE HOY, UNA COLUMNA VACIA NO BLOQUEA. Es lo que
        # dejaba la vitrina sin escribir toda la temporada: un evento de
        # FFA no le da dueño a la columna de TWR.
        ('una columna que HOY está vacía no bloquea',
         sin_dueno(cab + ['TWR'], ag2,
                   {'ana': ['1', 'Ana', '10', '1/1', 'A', 'DRA', '1', '']})
         == []),
        # ⚠️ Y si la columna SI tiene algo puesto en la fila de alguien,
        # sigue bloqueando: es para lo que la guarda existe.
        ('pero si tiene un dato de alguien, sí bloquea',
         sin_dueno(cab + ['TWR'], ag2,
                   {'ana': ['1', 'Ana', '10', '1/1', 'A', 'DRA', '1', '900']})
         == ['TWR']),
        # 🔴 Y UN VALOR EN UNA FILA SIN NOMBRE NO ES UN DATO. La hoja
        # tiene 135 asi en la columna `DRA`, restos del reset: `viejo`
        # solo trae filas con nombre, asi que no llegan acá.
        ('un valor suelto sin rapero no cuenta como dato',
         sin_dueno(cab + ['TWR'], ag2, {}) == []),
        ('el `#` no cuenta: se numera al final',
         '#' not in sin_dueno(cab, ag2)),
        # alcanza con que UNA persona la traiga: el que nunca hizo podio
        # no tiene `🥇` y eso no la vuelve huérfana
        ('basta con que alguien traiga la columna',
         sin_dueno(['🥇'], ag2) == []
         and sin_dueno(['🥇'], {'Bea': {'Puntos': 3}}) == ['🥇']),
    ]
    for que, ok in casos:
        mal += not ok
        print('   %s %s' % ('✅' if ok else '🔴', que))

    # ── que `32.0` y `32` sean la misma celda ────────────────────────
    print('\n  el verificador de la vitrina')
    ok = _mismo('32.0', '32') and _mismo('0.50', '.5') and _mismo(' 7 ', '7')
    mal += not ok
    print('   %s `32.0` y `32` son la misma celda' % ('✅' if ok else '🔴'))
    # 🔴 pero no se afloja más que eso: `12/16` no puede volverse fecha
    ok = (not _mismo('12/16', '16/12') and not _mismo('Konan', 'konan')
          and not _mismo('5', '') and not _mismo('', '5'))
    mal += not ok
    print('   %s y un texto distinto SIGUE siendo distinto'
          % ('✅' if ok else '🔴'))
    ok = _mismo('', '') and _mismo('—', '—')
    mal += not ok
    print('   %s el vacío y los guiones se comparan igual que antes'
          % ('✅' if ok else '🔴'))

    print('\n  la letra de columna')
    for n, esp in ((1, 'A'), (26, 'Z'), (27, 'AA'), (28, 'AB')):
        ok = _col(n) == esp
        mal += not ok
        print('   %s %2d -> %s' % ('✅' if ok else '🔴', n, _col(n)))

    # 🔴 LAS TRES VITRINAS NUEVAS, CON DATOS ARMADOS. `Ranking Duelos`
    # hoy sale con **cero filas** —el único evento de la T1 fue por
    # equipos y por equipos no cuentan como duelos— así que sin esto se
    # estrenaría el día del primer 1v1, con gente mirando. Es la misma
    # razón por la que existe `--ensayo`.
    print('\n  las tres vitrinas nuevas')
    res = [
        [1, '22/09', 'FFA', '16+', 'Ana', 'ar', 'Campeón', 10000, '', 10000, ''],
        [1, '22/09', 'FFA', '16+', 'Bea', 've', 'Subcampeón', 7500, '', 7500, ''],
        [1, '22/09', 'FFA', '16+', 'Cid', 'ar', 'Tercero', 6000, '', 6000, ''],
        [2, '23/09', 'DRA', '8-15', 'Ana', 'ar', 'Campeón', 5000, '', 5000, ''],
    ]
    uno = [
        [1, '22/09', 'FFA', 'final', 'Ana', 'Bea', 'Ana', 'Bea', ''],
        [1, '22/09', 'FFA', 'semis', 'Ana', 'Cid', 'Ana', 'Cid', ''],
        [1, '22/09', 'FFA', 'semis', 'Bea', 'Cid', 'Bea', 'Cid', ''],
        [2, '23/09', 'DRA', 'final', 'Bea', 'Ana', 'Bea', 'Ana', ''],
    ]
    ag3 = agregar(res, uno)

    d = tabla_duelos(ag3, {'Ana': 'S', 'Bea': 'A'})
    # Ana: 3 duelos, 2 ganados. Bea: 3 duelos, 2 ganados. Cid: 2, 0.
    ok = (len(d) == 3 and d[0][1] in ('Ana', 'Bea') and d[0][4] == 2
          and d[-1][1] == 'Cid' and d[-1][4] == 0)
    mal += not ok
    print('   %s Duelos ordena por GANADOS   %s'
          % ('✅' if ok else '🔴',
             ' · '.join('%s %s/%s' % (f[1], f[4], f[3]) for f in d)))
    # ⚠️ Y NO POR Win%: un 1/1 da 100 % y no dice nada. Cid, con 0 de 2,
    # tiene que quedar último aunque haya peleado más que un 1/1.
    ok = d[-1][4] == 0
    mal += not ok
    print('   %s y el que no ganó ninguno queda último'
          % ('✅' if ok else '🔴'))
    # quien no peleó no entra
    ok = all(f[3] for f in d)
    mal += not ok
    print('   %s quien no peleó ningún duelo no entra a esa hoja'
          % ('✅' if ok else '🔴'))

    p = tabla_podios(ag3, {'Ana': 1, 'Bea': 2}, {})
    # Ana 2 oros = 10 pts, Bea 1 plata = 3, Cid 1 bronce = 1
    ok = len(p) == 3 and p[0][1] == 'Ana' and p[0][5] == 10
    mal += not ok
    print('   %s Podios: 5 por oro, 3 por plata, 1 por bronce   %s'
          % ('✅' if ok else '🔴',
             ' · '.join('%s %s' % (f[1], f[5]) for f in p)))

    m = tabla_mundial(ag3, {'Ana': 'Argentina', 'Bea': 'Venezuela',
                            'Cid': 'Argentina'})
    # Argentina = Ana 15000 + Cid 6000 = 21000, con 2 raperos
    ok = len(m) == 2 and m[0][1] == 'Argentina' and m[0][2] == 2 \
        and m[0][3] == 21000
    mal += not ok
    print('   %s Mundial suma por país   %s'
          % ('✅' if ok else '🔴',
             ' · '.join('%s %s (%s)' % (f[1], f[3], f[2]) for f in m)))
    # ⚠️ quien no tiene país no puede inventar uno
    m2 = tabla_mundial(ag3, {'Ana': 'Argentina'})
    ok = len(m2) == 1 and m2[0][2] == 1
    mal += not ok
    print('   %s y quien no tiene país no entra   %d país(es)'
          % ('✅' if ok else '🔴', len(m2)))

    # 🔴 `Último Resultado` ORDENA POR `Evento #`, NO POR LA FECHA NI POR
    # EL ORDEN DE LA HOJA. Estaba dado por imposible —«pide fecha con
    # año»— teniendo la respuesta tres funciones más arriba, en la racha.
    print('\n  el último resultado')
    res4 = [
        [1, '22/09', 'FFA', '16+', 'Ana', 'ar', 'Campeón', 10000, '', 0, ''],
        [3, '24/09', 'TWR', '16+', 'Ana', 'ar', 'Subcampeón', 7500, '', 0, ''],
        [2, '23/09', 'DRA', '16+', 'Ana', 'ar', 'Cuartos', 2500, '', 0, ''],
    ]
    ag4 = agregar(res4, [])
    ok = ag4['Ana'].get('Último Resultado') == '(24/09)・🥈'
    mal += not ok
    print('   %s el # más alto, no el último de la lista   %s'
          % ('✅' if ok else '🔴', ag4['Ana'].get('Último Resultado')))
    # ⚠️ Y NO PUEDE SEGUIR EN `ARRASTRE`: ahí ganaría el valor viejo y el
    # calculado no llegaría nunca a la hoja.
    ok = 'Último Resultado' not in ARRASTRE
    mal += not ok
    print('   %s y ya no se arrastra, o el calculado no llegaría'
          % ('✅' if ok else '🔴'))

    # 🔴 Y LO QUE **SI** SE ARRASTRA TIENE QUE SEGUIR AHI. Esto faltaba y
    # lo destapó `herramientas/chequeo_que_no_chequea.py`: al sacar
    # `Rango` de `ARRASTRE` dejé sólo asserts de tipo «no está», y ésos
    # siguen en verde aunque la tupla se **vacíe**. O sea que el
    # self-check dejó de mirar la constante que protege.
    #
    # ⚠️ Lo que cuesta es concreto: estas cuatro no las calcula
    # `agregar()`, así que si se caen de `ARRASTRE` la próxima escritura
    # las deja **en blanco para todos** — y `sin_dueno()` no lo frena,
    # porque su trabajo es exactamente preguntar si alguien las llena.
    lleva = ('🎯', '💀', '🛡️', '✅')
    faltan = [c for c in lleva if c not in ARRASTRE]
    mal += bool(faltan)
    print('   %s las que NO se calculan siguen en ARRASTRE  %s'
          % ('✅' if not faltan else '🔴', faltan or '🎯 💀 🛡️ ✅'))
    # y que de verdad no las produzca `agregar()`, que es el porqué
    traidas = set()
    for v in ag.values():
        traidas.update(v)
    cruce = [c for c in lleva if c in traidas]
    mal += bool(cruce)
    print('   %s y ninguna la calcula `agregar()` (si no, sobra)  %s'
          % ('✅' if not cruce else '🔴', cruce or '—'))

    # ── el rango, que es la regla central del proyecto ────────────────
    print('\n  el rango sale del Score')
    # 🔴 ESTABA VACIO PARA LAS 21 PERSONAS. Se arrastraba de su propia
    # fila anterior, o sea que sin semilla no entraba nunca. Estas tres
    # pruebas cierran las tres mitades del candado.
    ok = 'Rango' not in ARRASTRE
    mal += not ok
    print('   %s NO se arrastra: una columna que se copia de sí misma '
          'no tiene semilla' % ('✅' if ok else '🔴'))
    ok = 'Rango' in CALCULADAS
    mal += not ok
    print('   %s y `sin_dueno()` sabe que tiene quien la llene'
          % ('✅' if ok else '🔴'))
    # que la guarda no lo marque huérfano aunque `agregar()` no lo traiga
    cab_r = ['#', 'Rapero', 'Rango', 'Puntos']
    ag_r = {'Ana': {'Puntos': 100}}
    ok = 'Rango' not in sin_dueno(cab_r, ag_r)
    mal += not ok
    print('   %s la escritura no se niega por el Rango' % ('✅' if ok else '🔴'))
    # y que de verdad salga del Score, con los umbrales de comun/rangos
    from comun.rangos import de_score
    ok = (de_score(91.1) == 'SSS' and de_score(47.8) == 'B'
          and de_score(0) == 'E')
    mal += not ok
    print('   %s los umbrales son los de comun/rangos.py (91.1→SSS, '
          '47.8→B, 0→E)' % ('✅' if ok else '🔴'))

    # 🔴 DEBAJO DE LOS 10 EVENTOS NO HAY LETRA. Dlx, 23/09/2026: «el
    # ranking competitivo no aparece nadie hasta q tenga 10 eventos».
    # Es lo que hace que el Sheet, la página pública y la carta digan lo
    # mismo.
    from comun.requisitos import minimo as _min
    piso = _min('competitivo', 'ev')
    poco = [[1, '22/09', 'FFA', '16+', 'Poco', 'ar', 'Campeón', 10000,
             '', 0, '']]
    mucho = [[i, '22/09', 'FFA', '16+', 'Mucho', 'ar', 'Campeón', 10000,
              '', 0, ''] for i in range(1, piso + 1)]
    r = rangos_de(poco + mucho)
    ok = 'Poco' not in r
    mal += not ok
    print('   %s con 1 evento NO tiene letra (el competitivo pide %d)'
          % ('✅' if ok else '🔴', piso))
    ok = 'Mucho' in r
    mal += not ok
    print('   %s con %d sí, y sale del Score   %s'
          % ('✅' if ok else '🔴', piso, r.get('Mucho', '—')))
    # ⚠️ y el piso no se escribe acá: sale de comun/requisitos.py
    ok = piso == 10
    mal += not ok
    print('   %s el piso sale de comun/requisitos.py (%s)'
          % ('✅' if ok else '🔴', piso))

    return mal


def main():
    if '--auto' in sys.argv:
        print('\n══ LA VITRINA ══')
        return 1 if _self_check() else 0

    if '--ensayo' in sys.argv:
        return 1 if ensayo() else 0

    if '--estructura' in sys.argv:
        # rehace `Ranking Temporada` y `Ranking Podios` con la cabecera
        # en la fila 1. Ver `rehacer_estructura()`: comprueba antes que
        # no haya nada que no se pueda recalcular.
        print('\n══ REHACER LA ESTRUCTURA ══\n')
        d = rehacer_estructura(dry='--aplicar' not in sys.argv)
        if d.get('freno'):
            print('   🔴 no lo hago: %s\n' % d['freno'])
            return 1
        for k, v in d.items():
            print('   %s: %s' % (k, v))
        print('')
        return 0

    if '--otras' in sys.argv:
        # 🔴 LAS OTRAS TRES VITRINAS. Dlx, 22/09/2026: *«no actualizaste
        # los demas rankings»*. `Ranking Temporada` se recalculaba y
        # Podios, Duelos y Mundial seguian con los numeros pegados a
        # mano de la pre-temporada.
        dry = '--aplicar' not in sys.argv
        print('\n══ PODIOS · DUELOS · MUNDIAL ══\n')
        out = escribir_todas(dry=dry)
        mal = 0
        for cual, d in out.items():
            r = d.get('r') or {}
            if dry:
                print('   %-10s %-22s %3d fila(s)  (simulacro)'
                      % (cual, d['hoja'], d['filas']))
                continue
            malas = r.get('total_malas') or 0
            mal += bool(malas)
            print('   %-10s %-22s %3d escritas · %d quedaron  %s'
                  % (cual, d['hoja'], r.get('escritas', 0),
                     r.get('quedaron', 0),
                     '🔴 %d celda(s) no entraron' % malas if malas else 'ok'))
            for m in (r.get('malas') or [])[:3]:
                print('        %s' % m)
        print('')
        return 1 if mal else 0

    if '--escribir' in sys.argv:
        print('\n══ RECALCULAR `Ranking Temporada` ══\n')
        filas, avisos = tabla_nueva()
        for a in avisos:
            print('   ⚠️ %s' % a)
        if filas is None:
            print('\n   🔴 No escribo. El registro crudo se llena solo a')
            print('      partir del primer evento de la T1.\n')
            return 1
        cab = cabecera_oficial()
        print('   %d fila(s) · %d columnas' % (len(filas), len(cab)))
        print('\n   las tres primeras:')
        for f in filas[:3]:
            print('      ' + ' | '.join('%-9s' % str(c)[:9] for c in f[:10]))
        if '--aplicar' not in sys.argv:
            print('\n   (simulacro: no escribí nada — `--escribir --aplicar`)')
            print('   ⚠️ Es una hoja PÚBLICA. El respaldo completo está en')
            print('      docs/sheet_respaldo/ (sheet/respaldar.py).\n')
            return 0

        # 🔴 TRES PUERTAS ANTES DE TOCAR UNA HOJA PÚBLICA, y cada una
        # tapa una forma distinta de romperla sin que nada falle.

        # 1 · respaldo. Misma regla que `sheet/resetear.py`: lo que se
        #     reemplaza entero tiene que poder volver.
        sys.path.insert(0, SCR)
        from resetear import hay_respaldo
        rp = hay_respaldo().get('oficial')
        print('\n   respaldo oficial   %s' % (rp or '🔴 NO HAY'))
        if not rp:
            print('\n   🔴 No escribo sin respaldo. '
                  '`python sheet/respaldar.py`\n')
            return 1

        # 2 · que no encoja sola. Un `Resultados` leído a medias —una
        #     página incompleta de la API, un reproceso cortado— da una
        #     tabla más chica y perfectamente válida. Es el guardián que
        #     `pipeline.py` ya tiene para los pools, por el mismo motivo.
        if any('menos)' in a for a in avisos) and '--achicar' not in sys.argv:
            print('\n   🔴 La tabla encogería. Si es a propósito —un reset,')
            print('      gente que se fue— repetí con `--achicar`.\n')
            return 1

        # 3b · que el arrastre haya enganchado. Media tabla sin fila
        #      anterior no es «entró media Liga nueva», es que los
        #      nombres de `Resultados` no escriben igual que los de la
        #      vitrina — y entonces esta escritura les borra el `Rango`.
        sin_prev = [a for a in avisos if 'sin fila anterior' in a]
        if sin_prev:
            print('   ⚠️ %s' % sin_prev[0])
        if sin_prev and '--nuevos' not in sys.argv:
            n = int(sin_prev[0].split()[0])
            # 🔴 SE MIDE LA PERDIDA DEL LADO VIEJO, NO LA NOVEDAD DEL
            # NUEVO, y antes era al reves. La guarda existe para cazar
            # **deriva de nombres**: gente que ya estaba en la vitrina y
            # deja de enganchar porque se escribe distinto, con lo cual
            # esta escritura le borra el `Rango`. Eso se ve en cuantas
            # filas VIEJAS quedaron sin dueño, no en cuantas nuevas hay.
            #
            # ⚠️ CONTANDO NOVEDAD, LA T1 ENTERA ES UN FALSO POSITIVO. La
            # temporada arranca de cero: **todos** son nuevos, asi que
            # `n > len(filas)/2` es cierto en cada corrida de las primeras
            # semanas y el paso del ciclo se niega a escribir siempre.
            # Medido el 22/09/2026 con el primer evento completo: 9 de 15
            # sin fila anterior, y los 9 eran gente nueva de verdad —la
            # vitrina tenia 6 filas y las 6 engancharon—.
            #
            # ⚠️ Y CON LA VITRINA VACIA NO HAY NADA QUE PERDER: si no hay
            # filas viejas, no hay deriva posible. Un `--nuevos` en el
            # ciclo apagaria la guarda para siempre; esto la deja
            # encendida para el unico caso que importa.
            viejo_ids = tabla_nueva.viejo_ids
            enganchadas = tabla_nueva.enganchadas
            huerfanas = [k for k in viejo_ids if k not in enganchadas]
            if viejo_ids and len(huerfanas) > len(viejo_ids) / 2:
                print('\n   🔴 %d de %d fila(s) VIEJAS se quedaron sin '
                      'dueño.\n      Eso no es gente que se fue: son '
                      'nombres que dejaron de\n      escribirse igual, y '
                      'esta escritura les borra el Rango.\n      Si de '
                      'verdad son nuevos, repetí con `--nuevos`.\n'
                      % (len(huerfanas), len(viejo_ids)))
                for k in huerfanas[:6]:
                    print('      · %s' % k)
                print('')
                return 1
            if n:
                print('      (%d sin fila anterior, y las %d viejas '
                      'engancharon: es gente nueva)'
                      % (n, len(viejo_ids) - len(huerfanas)))

        print('\n   escribiendo…')
        r = escribir_vitrina(filas, cab)
        # ⚠️ LA PORTADA TAMBIEN SE VISTE. Es la hoja que más se mira y
        # era justo la que quedaba sin rediseño, porque no se rehace.
        try:
            f = fila_cabecera(HOJA)
            if f == 1 and vestir(OFICIAL, HOJA, cab, filas):
                print('   ✨ diseño aplicado')
        except Exception as e:                           # noqa: BLE001
            # el diseño no puede tumbar una escritura que ya salió bien
            print('   ⚠️ el diseño no se aplicó: %s' % str(e)[:80])
        print('   %d fila(s) escritas · %d quedaron en la hoja'
              % (r['escritas'], r['quedaron']))
        if r['quedaron'] != r['escritas']:
            print('   🔴 sobran o faltan filas: la cola no quedó limpia')
        for m in r['malas']:
            print('   🔴 %s' % m)
        if r['total_malas'] > len(r['malas']):
            print('   🔴 … y %d celda(s) más'
                  % (r['total_malas'] - len(r['malas'])))
        ok = not r['malas'] and r['quedaron'] == r['escritas']
        # 🔴 Y UNA SEGUNDA PREGUNTA, CON UNA LECTURA NUEVA. Ver
        # `alias_vivos()`: la comparación de arriba dio limpia con una
        # celda sin entrar, porque compara contra lo que mandé.
        sobran = alias_vivos()
        if sobran:
            ok = False
            print('\n   🔴 %d nombre(s) de la hoja siguen siendo un '
                  'ALIAS de otra persona:' % len(sobran))
            for _n, _real in sobran[:8]:
                print('      · %-24s tendría que decir  %s'
                      % (_n, _real))
            print('      -> esa celda no entró, o falta reescribir la '
                  'vitrina.\n         Repetí el comando y volvé a mirar.')
        print('\n   %s\n' % ('✅ la vitrina quedó como se calculó'
                             if ok else '🔴 la hoja NO quedó como se pidió'))
        return 0 if ok else 1

    if '--cobertura' in sys.argv:
        print('\n══ QUÉ COLUMNA DE LA VITRINA SALE DE DÓNDE ══\n')
        cab = cabecera_oficial()
        print('   `%s` fila %d · %d columnas\n'
              % (HOJA, fila_cabecera(HOJA), len(cab)))
        hay = sum(1 for c in cab if DE_DONDE.get(c))
        for i, c in enumerate(cab):
            letra = chr(ord('A') + i) if i < 26 else 'A' + chr(ord('A') + i - 26)
            de = DE_DONDE.get(c, '🔴 no sé qué es')
            print('   %-3s %-11s %s' % (letra, c[:11], de or '⚠️ hoy NO se puede'))
        print('\n   %d de %d se pueden recalcular del registro crudo' % (hay, len(cab)))
        faltan = [c for c in cab if c in DE_DONDE and not DE_DONDE[c]]
        print('   %d no: %s' % (len(faltan), ', '.join(faltan)))
        print('\n   ⚠️ Las cuatro de Most Wanted y el Rango salen de otro lado,')
        print('      así que un escritor que sólo sepa lo de arriba las BORRA.')
        print('      Ver el docstring: por eso todavía no hay escritor.\n')
        return 0

    if '--probar' in sys.argv:
        from motor import procesar, _llave16, _resolvedor
        from resultados import _filas_res, _filas_uno, _pais_de
        print('\n══ UNA LLAVE DE 16, AGREGADA A COLUMNAS DE VITRINA ══\n')
        r, _ = _resolvedor()
        ev = procesar(_llave16(), num=349, fecha='20/09', servidor='DRA',
                      resolver=r)
        paises, clave = _pais_de()
        ag = agregar(_filas_res(ev, paises, clave), _filas_uno(ev))
        cols = ['Puntos', 'Ev', '🥇', '🥈', '🥉', '🎖️', '➕', 'DRA',
                'Win%', '🔥']
        print('   %-14s %s' % ('rapero', ' '.join('%7s' % c for c in cols)))
        for quien, v in sorted(ag.items(), key=lambda x: -x[1].get('Puntos', 0)):
            print('   %-14s %s' % (quien[:14],
                                   ' '.join('%7s' % v.get(c, '') for c in cols)))
        print('\n   %d persona(s). Los 🎯 💀 🛡️ y el Rango no están: no salen'
              '\n   del registro crudo. Ver `--cobertura`.\n' % len(ag))
        return 0

    if '--comparar' in sys.argv:
        from escribir import Hoja
        print('\n══ EL REGISTRO CRUDO CONTRA LA VITRINA ══\n')
        res, uno = Hoja('Resultados').filas(), Hoja('1v1').filas()
        print('   `Resultados` %d filas · `1v1` %d filas' % (len(res), len(uno)))
        if not res:
            print('\n   🔴 El registro crudo está VACÍO, así que la vitrina')
            print('      NO se puede regenerar: si se borra, no hay de dónde.')
            print('      Los 348 eventos se procesaron y su detalle no quedó.')
            print('      Se llena solo a partir del primer evento de la T1 que')
            print('      pase por `sheet/procesar_entrada.py`.\n')
            return 1
        ag = agregar(res, uno)
        cab = cabecera_oficial()
        viv = _leer(OFICIAL, '%s!A%d:AA' % (HOJA, fila_cabecera(HOJA) + 1))
        icol = {c: i for i, c in enumerate(cab)}
        iguales = distintos = 0
        for f in viv:
            f = list(f) + [''] * len(cab)
            quien = str(f[icol.get('Rapero', 1)]).strip()
            base = quien.split(' ')[0] if quien else ''
            mio = ag.get(base) or ag.get(quien)
            if not mio:
                continue
            for c in ('Puntos', 'Ev', '🥇', '🥈', '🥉'):
                if c not in icol or c not in mio:
                    continue
                suyo = str(f[icol[c]]).strip().replace(',', '')
                if suyo == str(mio[c]):
                    iguales += 1
                else:
                    distintos += 1
                    if distintos <= 10:
                        print('   %-14s %-7s vitrina %-9s  crudo %s'
                              % (base[:14], c, suyo, mio[c]))
        print('\n   %d celda(s) coinciden · %d no' % (iguales, distintos))
        print('')
        return 0

    print(__doc__)
    return 0


if __name__ == '__main__':
    sys.exit(main())
