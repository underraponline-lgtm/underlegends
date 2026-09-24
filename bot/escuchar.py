# -*- coding: utf-8 -*-
"""LAS LLAVES, DETECTADAS SOLAS EN LOS CANALES DE DISCORD.

    python bot/escuchar.py            que encontro, sin escribir nada
    python bot/escuchar.py --detalle  ademas, la llave parseada
    python bot/escuchar.py --dirigido solo los canales ya conocidos
    python bot/escuchar.py --auto     el self-check del detector

⚠️ DOS CADENCIAS, Y ESO ES LO QUE HACE QUE ENTRE UN CICLO POR HORA.
Medido el 21/09/2026, las dos corridas seguidas:

    completo   45,5 s   130 canales   1.710 mensajes   25 llaves
    dirigido    0,6 s     2 canales      36 mensajes   25 llaves

**Las mismas 25**, en el 1,3 % del tiempo. Corriendo cada hora eso es la
diferencia entre ~720 min/mes y ~6, de los 2.000 que da Actions. El
dirigido no reemplaza al completo: sin el completo, un servidor nuevo
—o un canal nuevo en uno viejo— **no se descubre jamas**, y eso no
falla. Ver `conocidos()`.

🔴 POR QUE NO SE CONFIGURA NADA NI SE LE PIDE UN COMANDO A NADIE.

Dlx, 21/09/2026: *«te dije que todo deberia ser automatizado no?»*. La
version anterior de esta idea pedia una de dos cosas: que cada servidor
declarara su canal de llaves, o que el organizador escribiera `/cargar`.
Las dos son manuales y las dos sobran.

**Una llave se reconoce por su contenido, no por donde esta.** Medido el
21/09/2026 sobre **129 canales y 1.728 mensajes** de los cuatro
servidores donde esta el bot:

    mensajes que dan LLAVE     28  (1,6 %)
      FFA      ✦🔐︱llaves      21 de 25
      LIVONIA  『🔐』𝑳𝑳𝑨𝑽𝑬𝑺       7 de 11

**Cero falsos positivos en los otros 127 canales** — charla, staff,
anuncios, bots. Y el caso que cierra la discusion: buscar canales *por
nombre* decia que LIVONIA no tenia ninguno, porque el suyo se llama
`𝑳𝑳𝑨𝑽𝑬𝑺` en unicode estilizado. El contenido lo encontro igual, en un
servidor que nadie configuro.

⚠️ **LA FIRMA SON DOS CONDICIONES, NO UNA.** Con solo «dice OCTAVOS»
entra cualquier charla que mencione la palabra; con solo «tiene lineas
con vs» entra cualquiera que escriba «yo vs vos». Dos rondas distintas
**y** dos lineas de batalla es lo que da 1,6 % en vez de ruido.

COMO SALE EL GANADOR
--------------------
Dlx: *«Octavos: A vs B. Cuartos: B vs C. ¿Quien gano en octavos? Es
simple no?»*. Exacto: **quien aparece en la ronda siguiente gano en la
anterior**. Medido sobre 100 mensajes reales de #llaves:

    un solo ganador, por la ronda siguiente    421  (63 %)
    la final, por la linea CAMPEON:             66  (10 %)
    ── resuelto                                487  (73 %)

    no aparece nadie de esa batalla             61
    pasan DOS o mas (no hay «un» ganador)       28
    ultima ronda y sin campeon                  91

De las batallas que **tienen** ronda siguiente, el **83 %** deja un solo
ganador. Lo que no cierra va a `Pendientes`, nunca a una suposicion:
puntos equivocados no se ven y se propagan al ranking, al rango y a las
cuatro cartas.

🔴 **Y ESA REGLA ESTABA ESCRITA Y ROTA.** La rama de la linea CAMPEON
hacia `_parecido(camp, b) or camp`, o sea que cuando el texto capturado
no enganchaba con nadie **devolvia el texto crudo como ganador**.
Medido el 21/09/2026 sobre las 25 llaves vivas: **8 de 202 batallas**
salian con un ganador que no peleo — `'DEL TORNEO ``🏆``'`,
`'__** <@1345962362615894027>…'`, `'GEOKA 🇦🇷 + CYK 🇦🇷 + AGUS 🇦🇷'`. Eso
no es un hueco, es peor: es una suposicion disfrazada de dato.

    antes              176 de 202 «resueltas»  — 8 de ellas inventadas
    sin inventar       168 de 202 resueltas    — 0 inventadas
    + el padron        170 de 202              — 0
    + equipo=conjunto  172 de 202              — 0
    + el renglon abajo 174 de 202  (86 %)      — 0

⚠️ **LA MENCION SI SE RESUELVE, Y NO CON EL TEXTO.** Tres finales dicen
`CAMPEON: <@979878316846768139>` mientras los competidores van por
nombre; `norm()` borra la mencion entera, asi que no se parece a nadie.
El padron tiene **498 Discord ID**, o sea que el ID *es* un nombre:
`resolver(..., ids=...)` recupera 2 de los 3 — y son **finales**, o sea
el campeon de dos eventos, el resultado que mas puntos vale.

⚠️ **SE SIGUE EXIGIENDO QUE EL NOMBRE SALGA DE LA BATALLA.** El padron
tiene un ID repetido —`979878316846768139` figura como Oasis y como
Fullylo4ded— asi que `ids` es una **lista** y el que decide no es el
orden de lectura sino cual de los dos peleo.

La que queda sin resolver es el campeon que es un **equipo** de tres, y
va a `Pendientes` con su motivo.

⚠️ **Y UN EQUIPO ES UN CONJUNTO, NO UNA CADENA.** `makma+lilñaño` en
octavos y `lil ñaño+makma` en semis son los mismos dos; comparados
enteros no se parecen y el ganador se perdia. Con igualdad **exacta de
conjuntos** —no parecido— entran 2 mas. Aflojar eso seria volver al
ganador inventado por otro camino, asi que un integrante suelto NO
alcanza: `A+B` no gana porque `A+Z` este en la ronda siguiente.

⚠️ **Y EL A/B SE HACE CONTRA UNA COPIA, NO CONTRA DISCORD.** Dos
mediciones con media hora de diferencia dieron **202 y 187** batallas
sin que cambiara el codigo. **La causa quedo sin identificar**: se
comprobo despues que `resolver()` devuelve exactamente una entrada por
batalla, y que en una hora los 25 mensajes no cambiaron ni un
caracter. O sea que la explicacion facil —«se editan»— no se verifico.
Lo que si quedo claro es la regla: comparando dos versiones del codigo
contra el vivo se miden **las dos cosas a la vez** y no se sabe cual
se movio. Las mediciones de arriba son todas contra una misma copia
guardada.

⚠️ **Y LA MODALIDAD SALE DE LA LLAVE, NO DEL ANUNCIO.** Llegue a decir
que hacia falta leer el `MODALIDAD:` del canal de eventos para aplicar
la regla de Dlx —los duelos solo cuentan en 1v1—. No hace falta: la
linea se describe sola. Medido: 351 batallas de 2, 81 de 3, 59 de 4, 15
de 5. Dos nombres es 1v1; tres o mas, no. Ademas el anuncio estructurado
resulto ser **un organizador de un servidor**, asi que depender de el
habria sido depender del banco de pruebas.
"""
import collections
import datetime
import difflib
import io
import json
import os
import re
import sys
import time
import unicodedata

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

import requests                                          # noqa: E402

# ⚠️ EL ORDEN ES LO QUE DEFINE «LA RONDA SIGUIENTE», asi que no es una
# lista decorativa: si `SEMIFINALES` quedara antes que `CUARTOS`, el
# ganador se buscaria en la ronda equivocada y saldrian ganadores dados
# vuelta sin un solo error.
ORDEN = ['CLASIFICATORIAS', 'PRELIMINARES', 'DIECISEISAVOS', 'OCTAVOS',
         'CUARTOS', 'SEMIFINALES', 'TERCER LUGAR', 'FINAL']
ALIAS = {'CLASIFICATORIA': 'CLASIFICATORIAS', 'CUARTOS DE FINAL': 'CUARTOS',
         'SEMI - FINAL': 'SEMIFINALES', 'SEMI-FINAL': 'SEMIFINALES',
         'SEMI FINAL': 'SEMIFINALES', 'SEMIFINAL': 'SEMIFINALES',
         'SEMIS': 'SEMIFINALES', 'SEMI': 'SEMIFINALES',
         'GRAN FINAL': 'FINAL'}

RONDA = re.compile(
    r'\b(CLASIFICATORIAS?|PRELIMINARES|DIECISEISAVOS|OCTAVOS|'
    r'CUARTOS(?:\s+DE\s+FINAL)?|SEMI\s*-?\s*FINALES?|SEMIS?|'
    r'TERCER\s+LUGAR|GRAN\s+FINAL|FINAL)\b', re.I)

# ⚠️ CUATRO ESTILOS MEDIDOS, no inventados. Sobre 100 mensajes:
# `⌞x⌝` 52 %, nada reconocible 29 %, `[x]` 12 %, `vs` suelto 7 %.
# ⚠️ `{1,30}` Y NO `{2,30}`: HAY NOMBRES DE UNA LETRA. Nacio pidiendo dos
# caracteres y con datos reales no se notaba, porque los nombres de las
# llaves que mire eran largos. Lo destapo el self-check — y no es un caso
# inventado: **«7» es una persona de verdad**, tiene sus cartas en R2.
DELIMS = (re.compile(r'⌞(.+?)⌝'),
          re.compile(r'\[([^\[\]\n]{1,30})\]'))
SEP = re.compile(r'🆚|<a?:VSF?:\d+>|\bvs\.?\b', re.I)

# 🔴 `(?<!SUB)` Y `(?<!SUB-)` NO SON ADORNO: `SUBCAMPEON: PIPE` matchea
# `CAMPEON:` y devuelve al **segundo** como campeon. Hoy no se nota
# porque la linea del campeon va siempre arriba y `search` se queda con
# la primera, o sea que anda **por el orden en que la gente escribe**.
# Una llave que anuncie primero el subcampeon —o que solo lo anuncie a
# el— daria el ganador dado vuelta, sin fallar.
#
# ⚠️ Y `1ER PUESTO` TAMBIEN ES UNA FORMA REAL, medida: de las 25 llaves
# de hoy, 24 dicen `CAMPEON` y una dice `:1ER PUESTO:┋ …`. Estaba
# contada como «ultima ronda y no dice campeon».
CAMPEON = re.compile(
    r'(?:(?<!SUB)(?<!SUB-)(?<!SUB )CAMPE[OÓ]N'
    r'|\b(?:1\s*(?:ER|RO)|PRIMER)\s+PUESTO)'
    r'\s*:?\s*[*_`~|┋]*\s*([^\n]{1,60})', re.I)
MENCION = re.compile(r'<@!?(\d+)>')
#: una linea de podio: campeon, subcampeon, tercero, cuarto, MVP. Nunca
#: es una batalla, aunque traiga dos nombres entre corchetes.
CONTRA = re.compile(r'🆚|\bvs\.?\b', re.I)
PODIO = re.compile(
    r'CAMPE[OÓ]N|\bPUESTO\b|\bLUGAR\b|M\.?\s*V\.?\s*P\b', re.I)
#: el segundo puesto. Sirve para deducir al campeon cuando su linea no
#: engancha con nadie: en una final de dos, el otro lado.
SUBCAMPEON = re.compile(
    r'(?:SUB[\s\-]*CAMPE[OÓ]N|\b(?:2\s*(?:DO|DO\.)|SEGUNDO)\s+PUESTO)'
    r'\s*:?\s*[*_`~|┋]*\s*([^\n]{1,60})', re.I)
# los shortcodes de emoji de Discord: `:flag_ve:`, `:ownerroleicon:`
CORTO = re.compile(r':[a-z0-9_+\-]{2,32}:')


def norm(s):
    """El nombre sin emojis, menciones, tildes ni puntuacion.

    ⚠️ LOS EMOJIS SE SACAN PORQUE SON LA BANDERA, no el nombre. `andre 🇨🇱`
    en cuartos y `andre` en semis son la misma persona, y compararlos con
    el emoji adentro los separa.
    """
    s = re.sub(r'<a?:\w+:\d+>', '', s or '')
    s = MENCION.sub('', s)
    # ⚠️ Y LOS SHORTCODES TAMBIEN SON BANDERA. `CAMPEON:OG:flag_ve:` daba
    # `ogflagve`, que contra `OG` saca 0,40 de parecido y no engancha con
    # nadie. Es el mismo motivo que el emoji personalizado: lo que sobra
    # es el pais, no el nombre.
    s = CORTO.sub('', s)
    s = ''.join(c for c in s if not (0x1F000 <= ord(c) <= 0x1FAFF))
    s = unicodedata.normalize('NFKD', s.lower())
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]', '', s)


def nombres_de_linea(l):
    """Los competidores de una linea, en orden. [] si no es una batalla.

    🔴 EL MARCO NO GANA SI EL SEPARADOR VE MAS LADOS. Antes, con dos
    nombres entre `⌞ ⌝` se devolvian esos dos y **el resto de la linea
    se tiraba**. Medido el 25/09/2026 en ELRAP FECHA 6 (#353):

        ⌞fokox🇦🇷⌝  <:VSF:…>  ⌞Sin límites 🇵🇪⌝ <:VSF:…> nhp🇨🇱

    son tres, y `nhp` —el que PASO— no tiene marco. Salia «fokox vs Sin
    límites», ninguno de los dos aparecia en cuartos y la batalla se iba
    a Pendientes: los dos eliminados sin puesto. Lo mismo con `EricRJ`,
    `moneymaker`, `ricard`, `erian` y `ZTR`, todos al final de su linea.
    Era la fuga mas grande de ese evento: **19 de 31** con puesto.

    ⚠️ Y SOLO SI VE MAS, no si ve distinto. En `[A] [B] 🆚 [C] [D]` —la
    forma de las finales grupales— el marco encuentra cuatro y el
    separador dos, y ahi el marco tiene razon.
    """
    marco = []
    for d in DELIMS:
        hay = d.findall(l)
        if len(hay) >= 2:
            marco = [x.strip() for x in hay]
            break
    sep = []
    if SEP.search(l):
        trozos = [re.sub(r'[⌞⌝\[\]]', '', t).strip(' .·▪️♠︎-–—*_`')
                  for t in SEP.split(l)]
        trozos = [t for t in trozos if 1 < len(norm(t)) <= 28]
        if len(trozos) >= 2:
            sep = trozos
    if len(sep) > len(marco):
        return sep
    return marco or sep


def unir_continuadas(texto):
    """Junta las lineas que son la continuacion de la de arriba.

    🔴 UN EQUIPO PARTIDO EN DOS LINEAS SE PERDIA ENTERO, y costo la
    mitad de la primera llave de la T1. Medido el 22/09/2026 sobre
    «EL RAP FECHA 5» (FFA, #349), comparando el mensaje contra lo que
    entro al Sheet:

        cuartos          4 en el mensaje  ->  2 cargadas
        semis            2                ->  2
        final            1                ->  0
        campeon/subcampeon   declarados   ->  ninguno

    O sea que los **10.000 puntos del campeon y los 7.500 del
    subcampeon no se asignaron a nadie**, y el resto entro a medias:
    `⌞Hassan🇪🇬 +` se cargo asi, sin sus dos companeros, porque el `⌝`
    estaba en la linea siguiente.

    ⚠️ NO FALLABA. Salian 4 batallas de 7, el evento quedaba ✅ en
    `Eventos Procesados` y nadie tenia con que darse cuenta. Es la forma
    de siempre: un resultado plausible en vez de un error.

    ⚠️ LA REGLA ES EL BALANCE DE `⌞ ⌝`, no una heuristica de «parece
    corta». Si una linea abre mas de lo que cierra, lo que sigue es
    suyo. Es exacto y no pide ningun umbral — la misma clase de regla
    que separa estructura de dibujo en las banderas.

    ⚠️ Y SE CORTA EN UNA LINEA VACIA O EN UN ENCABEZADO DE RONDA. Un
    `⌝` que falta por un error de tipeo pegaria el resto del mensaje a
    esa linea: el limite evita que un descuido se coma la llave entera.
    """
    def _abiertas(s):
        return s.count('⌞') - s.count('⌝')

    def _sigue(s):
        """¿Esta linea esta a medias? Tres señales, todas exactas.

        ⚠️ NINGUNA ES «la linea parece corta». Un umbral acá haria que
        el resultado dependa de como escriba cada uno.
        """
        # 1 · un delimitador abierto sin cerrar
        if _abiertas(s) > 0:
            return True
        # 2 · hay un «vs» y NO hay dos competidores: falta el rival.
        #     Es `⌞lord+camila+dxg⌝ <VS>` con el rival abajo — los
        #     delimitadores cuadran, asi que el balance no lo agarra.
        if SEP.search(s) and len(nombres_de_linea(s)) < 2:
            return True
        # 3 · termina en el separador de equipos. Es la linea del
        #     campeon: `**CAMPEON:**Hassan🇪🇬 +` y los otros dos abajo.
        if s.rstrip().endswith('+'):
            return True
        return False

    salida, buf = [], None
    for l in (texto or '').splitlines():
        if buf is not None:
            # ⚠️ SE CORTA EN UNA LINEA VACIA O EN UN ENCABEZADO DE RONDA.
            # Un `⌝` que falta por un tipeo pegaria el resto del mensaje
            # a esa linea: el limite evita que un descuido se coma la
            # llave entera.
            if (not l.strip()) or (RONDA.search(l)
                                   and not nombres_de_linea(l)):
                salida.append(buf)
                salida.append(l)
                buf = None
                continue
            buf = buf.rstrip() + ' ' + l.strip()
            if not _sigue(buf):
                salida.append(buf)
                buf = None
            continue
        if _sigue(l):
            buf = l
        else:
            salida.append(l)
    if buf is not None:
        salida.append(buf)
    return '\n'.join(salida)


def rondas_de(texto):
    """[(ronda, [[competidor,...],...])] en el orden en que aparecen."""
    out, actual, bats = [], None, []
    # ⚠️ PRIMERO SE UNEN LAS CONTINUADAS. Ver `unir_continuadas()`: sin
    # esto, un equipo partido en dos lineas se pierde y la ronda entera
    # puede quedar a medias sin que nada falle.
    for l in unir_continuadas(texto).splitlines():
        m = RONDA.search(l)
        nombres = nombres_de_linea(l)
        # ⚠️ UNA LINEA QUE TRAE LOS DOS es una batalla, no un encabezado:
        # `FINAL: A vs B` existe y perderla corta la llave al medio.
        if m and not nombres:
            e = re.sub(r'\s+', ' ', m.group(1).upper()).strip()
            if actual and bats:
                out.append((actual, bats))
            actual, bats = ALIAS.get(e, e), []
            continue
        # 🔴 LA LINEA DEL PODIO NO ES UNA BATALLA. `CAMPEÓN: [Cj] [Zignos]`
        # trae dos nombres entre corchetes y cae dentro de la seccion
        # FINAL, asi que se leia como una final mas —Cj contra Zignos,
        # que son COMPAÑEROS— y entraba a `1v1` como un duelo que nunca
        # existio. Medido el 25/09/2026 en CARABOBO: tres «finales», una
        # real y dos fantasmas, la del campeon y la del subcampeon.
        #
        # ⚠️ Y NO SE VEIA POR OTRO BUG. Hasta ese dia la canonizacion
        # contra las inscripciones (corte 0.66) convertia `ZIGNOS` en el
        # equipo `Zignos + CJ`, asi que el fantasma salia como equipo y
        # quedaba afuera de los duelos por accidente. Arreglar aquel dejo
        # a la vista este: un bug tapaba al otro.
        # ⚠️ solo si NO trae un «contra»: una linea de podio nunca lo
        # tiene, y un tercer puesto escrito en linea —`3ER PUESTO: A 🆚 B`—
        # si es una batalla
        if nombres and actual and not (PODIO.search(l)
                                       and not CONTRA.search(l)):
            bats.append(nombres)
    if actual and bats:
        out.append((actual, bats))
    return out


def es_llave(texto):
    """La firma: dos rondas distintas Y dos lineas de batalla."""
    rs = rondas_de(texto)
    return len(rs) >= 2 and sum(len(b) for _, b in rs) >= 2


#: `A(B+C)`: lo de adentro es a quien le gano A, no parte de su nombre.
#: Solo al FINAL del lado, y el cierre es opcional porque hay llaves
#: que lo cortan. Es el mismo criterio que `sheet/equipos._PAREN`.
HISTORIA = re.compile(r'\s*[(\uff08][^()\uff08\uff09]*[)\uff09]?\s*$')

_PERSONAS = [None]


def _personas():
    """Los nombres (normalizados) de gente que YA EXISTE. Se cachea.

    Sale del padron y del mapa de AKAs —los dos lados de cada alias—,
    que es lo que el resto del sistema llama «una persona». Si falta
    alguno de los dos archivos se sigue con lo que haya: el parecido
    queda igual de estricto por el corte.
    """
    if _PERSONAS[0] is None:
        out = set()
        try:
            with io.open(os.path.join(BASE, 'datos', 'padron.json'),
                         encoding='utf-8') as f:
                for x in json.load(f) or []:
                    out.add(norm(x.get('raw') or ''))
        except (OSError, ValueError):
            pass
        try:
            with io.open(os.path.join(BASE, 'datos', 'akas.json'),
                         encoding='utf-8') as f:
                al = (json.load(f) or {}).get('alias') or {}
            for a, r in al.items():
                out.add(norm(a))
                out.add(norm(r))
        except (OSError, ValueError):
            pass
        out.discard('')
        _PERSONAS[0] = out
    return _PERSONAS[0]


def _grupo_campeon(camp, b):
    """Los lados de `b` que nombra la linea del campeon, si son VARIOS.

    Devuelve la lista (en el orden de `b`) solo si la linea nombra a dos
    o mas lados, a cada uno por separado, y deja al menos uno afuera —o
    sea, si describe un equipo ganador contra el resto—. Si no, `[]`.

    ⚠️ SE PARTE LA LINEA Y SE BUSCA CADA PEDAZO, no se pregunta si el
    nombre «esta adentro». `nc` esta adentro de muchas palabras; un
    pedazo que es exactamente `Nc` no.
    """
    if len(b) < 3:
        return []
    partes = [x for x in re.split(r'[+&,\[\]]|\s+y\s+', camp or '')
              if norm(x)]
    if len(partes) < 2:
        return []
    elegidos = []
    for x in partes:
        g = _parecido(x, [n for n in b if n not in elegidos], corte=0.8)
        if g is None:
            return []
        elegidos.append(g)
    if len(elegidos) < 2 or len(elegidos) >= len(b):
        return []
    return [n for n in b if n in elegidos]


class Batalla(tuple):
    """`(ronda, lados, ganador, razon)` — una tupla de cuatro, igual que
    siempre — que ademas puede decir quienes **pasaron**.

    ⚠️ ES UNA TUPLA A PROPOSITO. Todos los que llaman desarman cuatro
    valores (`for ronda, lados, gan, razon in resolver(...)`); agregar un
    quinto los rompe a todos juntos. Con esto el que no pregunta por
    `.pasan` no se entera de que existe.
    """
    def __new__(cls, t, pasan=()):
        o = super().__new__(cls, t)
        o.pasan = list(pasan)
        return o


def _parecido(x, candidatos, corte=0.72):
    nx = norm(x)
    if not nx:
        return None
    mapa = {norm(c): c for c in candidatos}
    if nx in mapa:
        return mapa[nx]
    cerca = difflib.get_close_matches(nx, list(mapa), n=1, cutoff=corte)
    return mapa[cerca[0]] if cerca else None


def _equipo(s):
    """Un equipo como CONJUNTO de sus integrantes. `frozenset()` si es uno.

    ⚠️ UN EQUIPO NO TIENE ORDEN, Y ESO NO ES UNA SUPOSICION: es lo que
    significa. `makma+lilñaño` en octavos y `lil ñaño+makma` en semis
    son los mismos dos, y comparados como cadena entera no se parecen
    —`makmalilnano` contra `lilnanomakma`— asi que el ganador de esa
    batalla se perdia. Medido: **2 de 202** se recuperan con esto.

    ⚠️ SOLO `+` Y `&`, Y SOLO IGUALDAD EXACTA. Se probaron tambien `/`
    y ` y `: resuelven los mismos 2 y agregan formas de partir un
    nombre que no es un equipo. Y la comparacion es por conjuntos
    **iguales**, no parecidos: aflojar acá es volver al ganador
    inventado por otro camino.
    """
    partes = [norm(p) for p in re.split(r'[+&]', s or '')]
    partes = [p for p in partes if p]
    return frozenset(partes) if len(partes) > 1 else frozenset()


def resolver(texto, conocidos=None, ids=None):
    """[(ronda, [competidores], ganador|None, por_que)] de una llave.

    `conocidos` son los nombres de los inscriptos de ese evento. Cuando
    estan, el parecido se busca contra ~16 candidatos en vez de contra
    todo el texto, y `Kaminan` vs `kminan` deja de ser una apuesta.

    🔴 ESTE PARAMETRO ESTUVO DECLARADO Y DOCUMENTADO SIN USARSE. El
    docstring prometia esto y el cuerpo lo ignoraba: la firma decia una
    cosa y el codigo hacia otra, que es la misma forma que este repo ya
    documenta tres veces. Ahora canoniza de verdad.

    ⚠️ CANONIZAR ANTES DE COMPARAR, no comparar dos veces. Si `Kaminan`
    de cuartos y `kminan` de semis se mapean los dos al mismo inscripto,
    la comparacion posterior es **exacta** y deja de depender de un
    umbral de parecido. Sin inscriptos se cae al comportamiento de antes.
    """
    rs = rondas_de(texto)
    _c = None
    if conocidos:
        canon = {}
        mapa = {norm(c): c for c in conocidos if norm(c)}
        personas = _personas()

        def _c(n):
            # 🔴 EL PARECIDO PUEDE CORREGIR UN TYPO, PERO NUNCA CONVERTIR A
            # UNA PERSONA EN OTRA. Hasta el 25/09/2026 esto era
            # `_parecido(n, conocidos, corte=0.66) or n`, y medido sobre
            # las 38 llaves de FFA hacia cuatro cosas distintas mal:
            #
            #   persona -> OTRA persona   MASINO->Rumasi, OASIS->Sin limites,
            #                             CRK->Rumasi, VANDU->Volk, MARK->Makma
            #   equipo  -> uno solo       makma+colesito->colesito (13 casos)
            #   uno     -> equipo         ZIGNOS->«Zignos + CJ» (5 casos)
            #   ganador -> perdedor       nhp(sin limites)->Sin limites
            #
            # El peor: `masino` contra `rumasi` comparten `masi` y dan
            # 2·4/12 = **0.667**, un pelo arriba del corte. Masino GANO
            # DESGRACIAS EN TOKYO VOL.10 y se quedo sin fila: sus semis
            # salian a nombre de Rumasi y la linea «CAMPEÓN: MASINO» ya
            # no coincidia con nadie, asi que la final se tiraba entera
            # —y con ella el campeon y el subcampeon—. Dlx lo vio desde
            # afuera: *«si Makma esta top 1, no ha ganado mas de un
            # duelo?»*.
            #
            # ⚠️ Y NO SUMABA NADA. Medido el mismo dia: sin esta
            # canonizacion se resuelven **las mismas 241 batallas** y dos
            # finales MAS (28 contra 26 de 36). El paso que tenia que
            # arreglar nombres solo los cambiaba de dueno.
            #
            # Tres reglas, las tres baratas:
            #  1. igual a una inscripcion -> esa (es la cuenta que firmo);
            #  2. si el nombre ya ES alguien del padron, se queda: un
            #     parecido no puede pisar una identidad que existe;
            #  3. si no, parecido a 0.85 y con la misma forma —equipo
            #     con equipo, uno con uno—. `kminan`/`Kaminan` da 0.92 y
            #     pasa; `masino`/`rumasi` da 0.67 y no.
            #
            # ⚠️ LA HISTORIA `A(B+C)` NO ES EL NOMBRE: es a quien le gano
            # A. Se compara sin ella, porque con ella adentro `nhp(sin
            # limites)` se parecia mas al perdedor que al ganador.
            if n in canon:
                return canon[n]
            nb = norm(HISTORIA.sub('', n))
            r = n
            if nb in mapa:
                r = mapa[nb]
            elif nb and nb not in personas:
                cerca = difflib.get_close_matches(nb, list(mapa), n=1,
                                                  cutoff=0.85)
                if cerca and (bool(_equipo(n))
                              == bool(_equipo(mapa[cerca[0]]))):
                    r = mapa[cerca[0]]
            canon[n] = r
            return r

        rs = [(ronda, [[_c(n) for n in b] for b in bats])
              for ronda, bats in rs]
    mc = CAMPEON.search(texto or '')
    camp = mc.group(1).strip() if mc else None
    # ⚠️ Y A VECES EL NOMBRE ESTA EN LA LINEA DE ABAJO. Medido: una
    # llave escribe ```🏆`` CAMPEÓN DEL TORNEO ``🏆``` como **titulo** y
    # el nombre en el renglon siguiente. La captura da «DEL TORNEO 🏆»,
    # que no es nadie. Se guarda la linea de abajo como segundo
    # candidato — y sigue teniendo que coincidir con alguien de la
    # batalla, asi que no puede inventar.
    camp2 = None
    if mc:
        resto = (texto or '')[mc.end():].split('\n')
        camp2 = next((l.strip() for l in resto[1:3] if l.strip()), None)
    out = []
    for i, (ronda, bats) in enumerate(rs):
        # 🔴 `rs[i + 1][1]`, NO `rs[i + 1]`. La primera version iteraba la
        # TUPLA, o sea que comparaba los nombres contra las letras de
        # «CLASIFICATORIAS» — y los nombres cortos matcheaban. Daba 77 %
        # de aciertos que no existian. El numero real es 73 %.
        # 🔴 EL TERCER PUESTO NO ES UN PASO DE LA LLAVE, Y SE SALTEA.
        # Es un partido aparte entre los dos que perdieron la semi:
        # nadie avanza desde ahi. Pero aparece ESCRITO entre las semis y
        # la final, y como «la ronda siguiente» se toma por posicion, los
        # de cuartos se buscaban ahi adentro — dos personas— y no
        # aparecian. Medido el 21/09/2026: **9 cuartos y 4 semis** que
        # fallaban por esto, de 22 sin resolver.
        #
        # ⚠️ Y su propio ganador sigue sin salir de la progresion, porque
        # de verdad no tiene ronda siguiente. Eso no es confusion, es la
        # forma del torneo, asi que lleva su motivo propio y no ensucia
        # `Pendientes`.
        sig = set()
        for j in range(i + 1, len(rs)):
            if rs[j][0] == 'TERCER LUGAR':
                continue
            for b in rs[j][1]:
                sig.update(b)
            break
        for b in bats:
            # el tercer puesto no puede salir de la progresion: su motivo
            # es propio para que no se lea como una duda del sistema
            if ronda == 'TERCER LUGAR':
                out.append((ronda, b, None,
                            'el tercer puesto no tiene ronda siguiente'))
                continue
            if sig:
                # 🔴 LA HISTORIA ENTRE PARENTESIS NO ES PARTE DEL NOMBRE, y
                # comparada adentro rompia justo la pregunta de esta linea.
                # `SAITO` pasa de octavos y en cuartos aparece como
                # `SAITO(blody)`: `saito` contra `saitoblody` da 0.67, abajo
                # del corte, asi que «no aparece nadie despues» y la
                # batalla se iba a Pendientes. Medido el 25/09/2026: 4
                # octavos de FFA caian por esto.
                sig_l = {HISTORIA.sub('', x) for x in sig}
                ganan = [n for n in b if _parecido(n, sig)
                         or _parecido(HISTORIA.sub('', n), sig_l)]
                if not ganan:
                    # el mismo equipo escrito al reves. Ver `_equipo()`.
                    eqs = {_equipo(s) for s in sig} - {frozenset()}
                    ganan = [n for n in b if _equipo(n) in eqs]
                if len(ganan) == 1:
                    out.append((ronda, b, ganan[0], 'ronda siguiente'))
                elif not ganan:
                    out.append((ronda, b, None, 'no aparece nadie después'))
                else:
                    # 🔑 SE DICE QUIENES PASARON. En una batalla de 4
                    # donde pasan 2, los otros 2 quedaron eliminados en
                    # esta ronda —y eso es un puesto—, pero hasta el
                    # 25/09/2026 solo se devolvia el conteo: el que
                    # llamaba no podia saber quien habia caido y tiraba la
                    # batalla entera. Ver `Batalla`.
                    out.append(Batalla((ronda, b, None,
                                        'pasan %d, no hay un ganador'
                                        % len(ganan)), pasan=ganan))
            elif camp and _grupo_campeon(camp, b):
                # 🔑 EL CAMPEON ES UN GRUPO DE LOS LADOS: es una final POR
                # EQUIPOS escrita sin `+`. `[PRR] [SIX] [SNOW] 🆚 [COLESITO]
                # [BLOODY] [MAKMA]` con `CAMPEÓN: PRR + SIX + SNOW` son dos
                # equipos de tres, no una batalla de seis —y como batalla de
                # seis «la linea CAMPEÓN no coincide con nadie», porque no
                # coincide con UNO. Se devuelve como dos lados-equipo, que es
                # la forma que `motor.equipo()` ya sabe repartir y que
                # `resultados._filas_uno()` ya deja afuera de los duelos.
                gan = _grupo_campeon(camp, b)
                per = [n for n in b if n not in gan]
                ta, tb = ' + '.join(gan), ' + '.join(per)
                out.append((ronda, [ta, tb], ta,
                            'línea CAMPEÓN: final por equipos'))
            elif camp:
                # 🔴 EL CAMPEON TIENE QUE SER UNO DE LOS QUE PELEARON.
                # Aca decia `_parecido(camp, b) or (camp if len(b) else
                # None)`, o sea que cuando el texto capturado no
                # enganchaba con nadie **se devolvia el texto crudo como
                # ganador**. Medido el 21/09/2026 sobre las 25 llaves
                # vivas: **8 de 202 batallas** salian con un ganador que
                # no es ninguno de los dos lados —
                #
                #     'DEL TORNEO ``🏆``'
                #     '__** <@1345962362615894027> <@147134442806…>'
                #     'GEOKA 🇦🇷 + CYK 🇦🇷 + AGUS 🇦🇷'
                #
                # — y eso no es un hueco, es **peor que un hueco**:
                # entra a `Resultados` como puntos de alguien que no
                # existe, y de ahi al ranking, al rango y a las cuatro
                # cartas. `CLAUDE.md` lo dice con todas las letras:
                # *«puntos equivocados no se ven y se propagan»*.
                #
                # ⚠️ Los dos casos mas comunes no se pueden resolver con
                # el texto solo: el campeon escrito como **mencion**
                # (`<@123>`) cuando los competidores van por nombre, y
                # el campeon que es un **equipo** de tres. Los dos van a
                # `Pendientes` con su motivo, que es la respuesta
                # honesta.
                g, pq = _parecido(camp, b), 'línea CAMPEÓN'
                # 🔴 Y CANONIZADO IGUAL QUE LOS LADOS. Antes se canonizaba
                # la batalla y se comparaba contra la linea CAMPEON cruda:
                # si un lado cambiaba de nombre, el campeon ya no era
                # nadie. Las dos puntas de la comparacion por el mismo
                # camino, o la comparacion mide la diferencia de caminos.
                if g is None and _c is not None:
                    g = _parecido(_c(camp), b)
                # el mismo equipo escrito al revés, igual que arriba:
                # `1ER PUESTO: TAM+RIZAS+CUTULÚ` contra el lado
                # `CUTULÚ+RIZAS+TAM` de la final. Ver `_equipo()`.
                if g is None and _equipo(camp):
                    g = next((n for n in b if _equipo(n) == _equipo(camp)),
                             None)
                if g is None and camp2:
                    g = _parecido(camp2, b) or next(
                        (n for n in b
                         if _equipo(n) and _equipo(n) == _equipo(camp2)),
                        None)
                    if g is not None:
                        pq = 'línea CAMPEÓN, el nombre en el renglón de abajo'
                # ⚠️ LA MENCION SI SE PUEDE RESOLVER, CON EL PADRON. El
                # `<@123>` no se parece a ningun nombre porque `norm()`
                # lo borra entero — pero el padron tiene 499 Discord ID
                # cargados, asi que el ID **es** un nombre. Medido: los
                # tres casos de hoy son finales, o sea el campeon de
                # tres eventos, que es el resultado que mas puntos vale.
                #
                # ⚠️ SE SIGUE EXIGIENDO QUE SALGA DE LA BATALLA. Un ID
                # puede estar repetido en el padron —hay uno, que figura
                # como Oasis y como Fullylo4ded— y ahi el que decide es
                # cual de los dos peleo. Quedarse con el primero de una
                # lista es adivinar con mas pasos.
                if g is None and ids:
                    for did in MENCION.findall(camp):
                        for cand in (ids.get(str(did)) or []):
                            g = _parecido(cand, b)
                            if g is not None:
                                pq = 'línea CAMPEÓN, por mención'
                                break
                        if g is not None:
                            break
                # 🔑 Y SI EL CAMPEON NO SE RESUELVE, EL SUBCAMPEON PUEDE
                # DECIRLO. En una final de dos, saber quien perdio ES saber
                # quien gano. Medido el 25/09/2026: DESGRACIAS EN TOKYO VOL
                # 11 escribe `CAMPEÓN: JOVEN ALA` con el lado `PRR` —dos
                # alias de Hassan que no se parecen entre si— y `SUB-CAMPEÓN:
                # SEBITA`, que si es un lado. La final se iba a Pendientes.
                #
                # ⚠️ SOLO CON DOS LADOS Y SOLO SI ENGANCHA CON UNO. Con tres
                # saber quien perdio no dice quien gano, y si el
                # subcampeon se parece a los dos no se elige.
                if g is None and len(b) == 2:
                    ms = SUBCAMPEON.search(texto or '')
                    sub = ms.group(1).strip() if ms else None
                    # ⚠️ SI LA LINEA NOMBRA A LOS DOS, O A UN EQUIPO, NO SE
                    # DEDUCE NADA. La primera version de esto hizo campeon
                    # a Nc en CARABOBO: la linea era `SUB-CAMPEÓN: [Nc]
                    # [Mcnadie]` —los dos, como equipo—, `ncmcnadie` se
                    # parecia a `mcnadie` y no a `nc`, y «engancha con uno
                    # solo» daba verdadero. Se pregunta tambien si el nombre
                    # de cada lado ESTA ADENTRO de la linea: si estan los dos,
                    # es ambigua.
                    en_linea = norm(sub) if sub else ''
                    if sub and (_equipo(sub) or sub.count('[') > 1):
                        sub = None
                    if sub:
                        cand = set()
                        for n in b:
                            nn = norm(HISTORIA.sub('', n))
                            if (_parecido(sub, [n]) or (nn and nn in en_linea)
                                    or (_c is not None
                                        and _parecido(_c(sub), [n]))):
                                cand.add(n)
                        if not cand and ids:
                            for did in MENCION.findall(sub):
                                for nom in (ids.get(str(did)) or []):
                                    cand.update(n for n in b if _parecido(nom, [n]))
                        if len(cand) == 1:
                            g = next(n for n in b if n not in cand)
                            pq = 'línea SUB-CAMPEÓN: el campeón es el otro lado'
                if g is not None:
                    out.append((ronda, b, g, pq))
                elif MENCION.search(camp):
                    out.append((ronda, b, None,
                                'el campeón es una mención que no se '
                                'resuelve contra el padrón'))
                else:
                    out.append((ronda, b, None,
                                'la línea CAMPEÓN no coincide con nadie '
                                'de la batalla'))
            else:
                out.append((ronda, b, None, 'última ronda y no dice campeón'))
    return out


# ── mirar Discord ─────────────────────────────────────────────────────
def _env(clave):
    for l in io.open(os.path.join(BASE, '.env'), encoding='utf-8'):
        if l.strip().startswith(clave + '='):
            return l.split('=', 1)[1].strip().strip('"\'')
    sys.exit('falta %s en .env' % clave)


def sesion():
    s = requests.Session()
    s.headers['Authorization'] = 'Bot ' + _env('DISCORD_TOKEN')
    return s


MEMORIA = os.path.join(BASE, 'datos', 'canales_llaves.json')
# cada cuanto se vuelve a mirar TODO. Ver `conocidos()`.
HORAS_BARRIDO = 20


def conocidos():
    """Los canales donde alguna vez hubo una llave, y cuando se barrio todo.

    🔴 SIN ESTO, BAJAR EL CICLO A CADA HORA NO ENTRA. Barrer los 130
    canales cuesta **45,5 s**, o sea ~720 min/mes corriendo cada hora, de
    los 2.000 que da Actions. Revisar los **2** donde aparecen llaves
    cuesta **0,6 s** y devuelve **las mismas 25 llaves**: ~6 min/mes.
    Medido el 21/09/2026, las dos corridas una detras de la otra.

    ⚠️ PERO EL BARRIDO COMPLETO NO SE PUEDE ABANDONAR, y por eso esto
    guarda tambien CUANDO fue el ultimo. Mirando solo los canales
    conocidos, un servidor nuevo —o un canal nuevo en uno viejo— no se
    descubre **nunca**, y eso no falla: el sistema sigue procesando los
    de siempre y nadie nota lo que falta. Es el modo de error que este
    repo documenta una y otra vez.

    El trato: dirigido casi siempre, completo una vez por dia.
    """
    try:
        with io.open(MEMORIA, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {'canales': {}, 'ultimo_completo': ''}


def _guardar_conocidos(d):
    os.makedirs(os.path.dirname(MEMORIA), exist_ok=True)
    with io.open(MEMORIA, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, indent=1, sort_keys=True)


def toca_completo(mem=None):
    """¿Ya pasaron las horas del barrido completo?"""
    mem = mem if mem is not None else conocidos()
    ult = mem.get('ultimo_completo') or ''
    if not ult:
        return True
    try:
        t = datetime.datetime.fromisoformat(ult)
    except ValueError:
        return True
    ahora = datetime.datetime.now(t.tzinfo) if t.tzinfo else \
        datetime.datetime.now()
    return (ahora - t).total_seconds() >= HORAS_BARRIDO * 3600


def _canales(s, solo=None):
    """(canal_id, canal, servidor, guild) de los canales que hay que mirar.

    ⚠️ CON `solo` NO SE LE PREGUNTA NADA A DISCORD, y ahi esta el ahorro
    de verdad. El barrido completo gasta **1 request de servidores + 4 de
    canales + 129 de mensajes**; el dirigido gasta **2**, porque los
    nombres ya estan en la memoria. Filtrar la lista completa despues de
    pedirla no habria ahorrado nada.
    """
    if solo:
        for cid in sorted(solo):
            d = solo[cid] or {}
            yield (cid, d.get('canal') or '?', d.get('servidor') or '?',
                   d.get('guild') or '')
        return
    gs = s.get('https://discord.com/api/v10/users/@me/guilds', timeout=30)
    if gs.status_code != 200:
        sys.exit('no pude listar los servidores: %s' % gs.text[:120])
    for g in gs.json():
        r = s.get('https://discord.com/api/v10/guilds/%s/channels' % g['id'],
                  timeout=30)
        if r.status_code != 200:
            continue
        for c in r.json():
            if c['type'] in (0, 5):
                yield c['id'], c['name'], g['name'], g['id']


def barrer(s, por_canal=25, solo=None):
    """Mira los ultimos mensajes de cada canal y devuelve las llaves.

    ⚠️ NO SE FILTRA POR NOMBRE DE CANAL. Ver el encabezado: `eventos-hoy`
    de DRA es ruido de bots y el canal de LIVONIA se llama `𝑳𝑳𝑨𝑽𝑬𝑺` en
    unicode estilizado. Mirar todo y filtrar por contenido encuentra mas
    y configura menos.

    `solo` es {canal_id: {servidor, guild, canal}}: mira **esos** y nada
    mas. Es el modo dirigido —ver `conocidos()`— y cuesta menos de un
    segundo contra los 48 del completo. El que llama decide cual usa;
    este modulo no lo decide solo, porque «dirigido siempre» es dejar de
    descubrir canales nuevos en silencio.

    🔴 Y NO HAY MARCADOR DE «LO NUEVO», A PROPOSITO. Esta funcion llego a
    aceptar un `desde={canal_id: ultimo_visto}` para pedir solo los
    mensajes posteriores, que es la optimizacion obvia y **aca esta
    mal**: una llave se completa **editando el mismo mensaje** —el
    ganador de octavos aparece cuando alguien escribe cuartos encima—, y
    el 96 % se edita despues de publicado, a veces dias. Con `after`, el
    mensaje se lee una sola vez, vacio, y su estado final **no vuelve
    nunca**. Se saca cero por ciento de error y se pierde casi todo,
    sin un solo fallo. El ahorro que si es gratis es mirar menos
    canales, no menos mensajes de cada canal.
    """
    out, n_ch, n_msg = [], 0, 0
    for cid, canal, servidor, guild in _canales(s, solo):
        n_ch += 1
        rr = s.get('https://discord.com/api/v10/channels/%s/messages' % cid,
                   params={'limit': por_canal}, timeout=30)
        if rr.status_code != 200:
            continue              # sin permiso de leer: se salta, no falla
        ms = rr.json()
        n_msg += len(ms)
        for m in ms:
            if es_llave(m.get('content') or ''):
                out.append({'servidor': servidor, 'guild': guild,
                            'canal': canal, 'canal_id': cid,
                            'msg_id': m['id'],
                            'autor': (m.get('author') or {}).get('username'),
                            # ⚠️ LA FECHA VA Y NO ES OPCIONAL:
                            # `motor.py` agrupa por (evento, servidor,
                            # fecha), asi que sin ella dos ediciones
                            # del mismo torneo en semanas distintas se
                            # mezclan en un solo evento.
                            #
                            # ⚠️ Y VA LA DE PUBLICACION, no la de la
                            # ultima edicion: el 96 % se edita despues,
                            # a veces dias, y la fecha del evento es
                            # cuando se jugo.
                            'cuando': m.get('timestamp') or '',
                            'editado': m.get('edited_timestamp') or '',
                            'texto': m.get('content') or ''})
        time.sleep(0.05)
    return out, n_ch, n_msg


def escuchar(s, forzar=None, por_canal=25):
    """Un barrido eligiendo la cadencia, con la memoria al dia.

    Devuelve `(llaves, info)`, con `info` = {completo, canales, mensajes}.
    Es **lo que hay que llamar**: `barrer()` no elige cadencia ni recuerda
    nada, y quien la use directo se queda con el barrido completo para
    siempre.

    ⚠️ SIN MEMORIA, COMPLETO. Un clone limpio no tiene a quien dirigirse,
    asi que el dirigido miraria **cero canales** y contestaria «ninguna
    llave» sin haber mirado. Degradar al barrido caro cuesta 48 s; la
    otra rama cuesta no enterarse.
    """
    mem = conocidos()
    completo = toca_completo(mem) if forzar is None else bool(forzar)
    if not mem.get('canales'):
        completo = True
    out, n_ch, n_msg = barrer(s, por_canal=por_canal,
                              solo=None if completo else mem['canales'])
    for h in out:
        mem.setdefault('canales', {})[h['canal_id']] = {
            'servidor': h['servidor'], 'guild': h['guild'],
            'canal': h['canal']}
    if completo:
        mem['ultimo_completo'] = datetime.datetime.now(
            datetime.timezone.utc).isoformat(timespec='seconds')
    _guardar_conocidos(mem)
    return out, {'completo': completo, 'canales': n_ch, 'mensajes': n_msg}


def _self_check():
    """Que la firma separe una llave de una charla, con casos escritos."""
    llave = ('`[ OCTAVOS ]`\n⌞A⌝ 🆚 ⌞B⌝\n⌞C⌝ 🆚 ⌞D⌝\n'
             '`[ FINAL ]`\n⌞A⌝ 🆚 ⌞C⌝')
    casos = [
        ('una llave de dos rondas', llave, True),
        ('charla que dice OCTAVOS', 'che cuando son los octavos?', False),
        ('charla con un vs', 'yo vs vos cuando quieras', False),
        ('una sola ronda', '`[ FINAL ]`\n⌞A⌝ 🆚 ⌞B⌝', False),
        ('con corchetes', '[OCTAVOS]\n[A] 🆚 [B]\n[C] 🆚 [D]\n'
                          '[FINAL]\n[A] 🆚 [C]', True),
    ]
    mal = 0
    print('\n  la firma')
    for que, txt, esperado in casos:
        ok = es_llave(txt) == esperado
        mal += not ok
        print('   %s %-26s %s' % ('✅' if ok else '🔴', que,
                                  'es llave' if esperado else 'NO es llave'))

    # 🔴 LAS LINEAS PARTIDAS, QUE COSTARON LA MITAD DE LA PRIMERA LLAVE
    # DE LA T1. Medido el 22/09/2026 contra «EL RAP FECHA 5»: el mensaje
    # tenia 7 batallas y entraron 4, sin final y sin campeon. Los tres
    # casos son los tres que tenia ese mensaje.
    print('\n  las líneas partidas')
    partidas = [
        # un equipo cuyo `⌝` esta en la linea siguiente
        ('un equipo cortado en dos líneas',
         '`[ FINAL ]`\n⌞A + B +\nC⌝ 🆚 ⌞D⌝', 1, ['A + B + C', 'D']),
        # delimitadores balanceados y el rival abajo
        ('el rival en la línea de abajo',
         '`[ FINAL ]`\n⌞A⌝ 🆚 \n⌞B⌝', 1, ['A', 'B']),
        # una batalla a tres, repartida en tres lineas
        ('una batalla a tres, en tres líneas',
         '`[ FINAL ]`\n⌞A +\nB⌝ 🆚 ⌞C⌝ 🆚 ⌞D +\nE⌝', 1, None),
    ]
    for que, txt, nbat, esp in partidas:
        rs = rondas_de(txt)
        bats = rs[0][1] if rs else []
        ok = len(bats) == nbat and (esp is None or bats[0] == esp)
        mal += not ok
        print('   %s %-36s %s' % ('✅' if ok else '🔴', que,
                                  ' 🆚 '.join(bats[0]) if bats else 'nada'))
    # ⚠️ Y QUE NO PEGUE DE MAS: una linea sana no arrastra a la de abajo.
    rs = rondas_de(llave)
    ok = sum(len(b) for _, b in rs) == 3
    mal += not ok
    print('   %s %-36s %d batalla(s)'
          % ('✅' if ok else '🔴', 'una llave sana no se pega sola',
             sum(len(b) for _, b in rs)))

    print('\n  el ganador por la ronda siguiente')
    r = resolver(llave)
    esp = [('OCTAVOS', 'A'), ('OCTAVOS', 'C'), ('FINAL', None)]
    for (ronda, b, g, _), (er, eg) in zip(r, esp):
        ok = ronda == er and g == eg
        mal += not ok
        print('   %s %-10s %-14s -> %s' % ('✅' if ok else '🔴', ronda,
                                           ' vs '.join(b), g or '—'))

    # 🔴 EL BUG QUE YA TUVE: iterar la tupla en vez de las batallas hacia
    # que los nombres matchearan contra las letras de la ronda. Un nombre
    # de una letra lo destapa.
    print('\n  que no matchee contra el nombre de la ronda')
    trampa = ('`[ CLASIFICATORIAS ]`\n⌞C⌝ 🆚 ⌞L⌝\n⌞A⌝ 🆚 ⌞S⌝\n'
              '`[ FINAL ]`\n⌞Z⌝ 🆚 ⌞Y⌝')
    gan = [g for _, _, g, _ in resolver(trampa)[:2]]
    ok = all(x is None for x in gan)
    mal += not ok
    print('   %s ninguno de C/L/A/S gana por decir «CLASIFICATORIAS»: %s'
          % ('✅' if ok else '🔴', gan))

    # 🔴 LOS OCHO GANADORES INVENTADOS. Medido el 21/09/2026 sobre las
    # 25 llaves vivas: 8 de 202 batallas devolvian como ganador un texto
    # que no es ninguno de los dos lados. Eso es peor que un hueco —
    # entra a `Resultados` como puntos de alguien que no existe.
    print('\n  el campeón tiene que ser uno de los que pelearon')
    base = '`[ SEMIFINALES ]`\n⌞A⌝ 🆚 ⌞B⌝\n⌞C⌝ 🆚 ⌞D⌝\n`[ FINAL ]`\n'
    for que, txt, esp in [
        ('dice el nombre', base + '⌞A⌝ 🆚 ⌞C⌝\nCAMPEON: A', 'A'),
        ('con markdown y bandera',
         base + '⌞A⌝ 🆚 ⌞C⌝\n**__CAMPEON:A:flag_ve:__**', 'A'),
        ('`1ER PUESTO` también cuenta',
         base + '⌞A⌝ 🆚 ⌞C⌝\n:1ER PUESTO:┋ C', 'C'),
        ('una mención no inventa a nadie',
         base + '⌞A⌝ 🆚 ⌞C⌝\nCAMPEON: <@1345962362615894027>', None),
        ('un equipo de tres tampoco',
         base + '⌞A⌝ 🆚 ⌞C⌝\nCAMPEON: X + Y + Z', None),
        ('ni una frase suelta',
         base + '⌞A⌝ 🆚 ⌞C⌝\nCAMPEON DEL TORNEO 🏆', None),
        # 🔴 `SUBCAMPEON` MATCHEA `CAMPEON`. Hoy anda por el orden en que
        # la gente escribe: la linea del campeon va arriba y `search` se
        # queda con la primera. Si una llave anuncia solo al subcampeon,
        # sin esto el ganador sale dado vuelta.
        ('el SUBCAMPEÓN no es el campeón',
         base + '⌞A⌝ 🆚 ⌞C⌝\nSUBCAMPEON: C', None),
        ('ni el SUB-CAMPEÓN con guion',
         base + '⌞A⌝ 🆚 ⌞C⌝\nSUB-CAMPEÓN: C', None),
        # el título en una línea y el nombre en la de abajo
        ('el nombre en el renglón siguiente',
         base + '⌞A⌝ 🆚 ⌞C⌝\n`🏆` CAMPEÓN DEL TORNEO `🏆`\n`👑` 『C』',
         'C'),
        ('pero si abajo tampoco hay nadie, no inventa',
         base + '⌞A⌝ 🆚 ⌞C⌝\n`🏆` CAMPEÓN DEL TORNEO `🏆`\nGracias a todos',
         None),
    ]:
        r = resolver(txt)
        fin = [x for x in r if x[0] == 'FINAL']
        g = fin[0][2] if fin else '(sin final)'
        ok = g == esp
        mal += not ok
        print('   %s %-34s -> %s' % ('✅' if ok else '🔴', que, g or '—'))

    print('\n  un equipo es un conjunto, no una cadena')
    for que, txt, esp in [
        ('el mismo dúo al revés',
         '`[ OCTAVOS ]`\n⌞A+B⌝ 🆚 ⌞C+D⌝\n⌞E+F⌝ 🆚 ⌞G+H⌝\n'
         '`[ FINAL ]`\n⌞B+A⌝ 🆚 ⌞E+F⌝', 'A+B'),
        # 🔴 UN INTEGRANTE NO ES EL EQUIPO. Si alcanzara con que uno
        # coincida, `A+B` pasaria porque `A+Z` gano en la otra llave, y
        # eso es un ganador inventado con otra forma.
        ('un integrante suelto NO alcanza',
         '`[ OCTAVOS ]`\n⌞A+B⌝ 🆚 ⌞C+D⌝\n⌞E+F⌝ 🆚 ⌞G+H⌝\n'
         '`[ FINAL ]`\n⌞A+Z⌝ 🆚 ⌞E+F⌝', None),
        ('y una persona sola sigue siendo una persona',
         '`[ OCTAVOS ]`\n⌞A⌝ 🆚 ⌞C⌝\n⌞E⌝ 🆚 ⌞G⌝\n'
         '`[ FINAL ]`\n⌞A⌝ 🆚 ⌞E⌝', 'A'),
    ]:
        r = [x for x in resolver(txt) if x[0] == 'OCTAVOS']
        g = r[0][2] if r else '(sin octavos)'
        ok = g == esp
        mal += not ok
        print('   %s %-34s -> %s' % ('✅' if ok else '🔴', que, g or '—'))

    # la misma regla en la linea del campeon, que es donde aparecio:
    # `1ER PUESTO: TAM+RIZAS+CUTULÚ` contra el lado `CUTULÚ+RIZAS+TAM`
    print('\n  y también cuando el campeón es el equipo')
    for que, txt, esp in [
        ('el campeón, con los nombres en otro orden',
         '`[ SEMIFINALES ]`\n⌞A+B⌝ 🆚 ⌞C+D⌝\n⌞E+F⌝ 🆚 ⌞G+H⌝\n'
         '`[ FINAL ]`\n⌞A+B⌝ 🆚 ⌞E+F⌝\nCAMPEON: B+A', 'A+B'),
        ('pero no si cambia un integrante',
         '`[ SEMIFINALES ]`\n⌞A+B⌝ 🆚 ⌞C+D⌝\n⌞E+F⌝ 🆚 ⌞G+H⌝\n'
         '`[ FINAL ]`\n⌞A+B⌝ 🆚 ⌞E+F⌝\nCAMPEON: A+Z', None),
    ]:
        r = [x for x in resolver(txt) if x[0] == 'FINAL']
        g = r[0][2] if r else '(sin octavos)'
        ok = g == esp
        mal += not ok
        print('   %s %-34s -> %s' % ('✅' if ok else '🔴', que, g or '—'))

    # 🔴 LA MENCION SE RESUELVE CON EL PADRON, Y EL ID REPETIDO ES REAL.
    # `979878316846768139` figura como Oasis y como Fullylo4ded: un
    # dict se queda con uno y descarta al otro sin decirlo. Por eso
    # `ids` es una lista y el que decide es quien peleo.
    print('\n  la mención del campeón, contra el padrón')
    basem = ('`[ SEMIFINALES ]`\n⌞Konan⌝ 🆚 ⌞Bau⌝\n⌞Vize⌝ 🆚 ⌞Val⌝\n'
             '`[ FINAL ]`\n⌞Konan⌝ 🆚 ⌞Vize⌝\n')
    for que, txt, ids, esp in [
        ('el ID es de uno de los dos', basem + 'CAMPEON: <@11>',
         {'11': ['Konan']}, 'Konan'),
        ('el ID repetido: gana el que peleó', basem + 'CAMPEON: <@11>',
         {'11': ['Oasis', 'Vize']}, 'Vize'),
        ('y en el otro orden también', basem + 'CAMPEON: <@11>',
         {'11': ['Vize', 'Oasis']}, 'Vize'),
        ('un ID que no está en el padrón', basem + 'CAMPEON: <@99>',
         {'11': ['Konan']}, None),
        ('un ID de alguien que no peleó', basem + 'CAMPEON: <@11>',
         {'11': ['Bloody']}, None),
        ('sin padrón, no inventa', basem + 'CAMPEON: <@11>', None, None),
    ]:
        r = resolver(txt, ids=ids)
        fin = [x for x in r if x[0] == 'FINAL']
        g = fin[0][2] if fin else '(sin final)'
        ok = g == esp
        mal += not ok
        print('   %s %-34s -> %s' % ('✅' if ok else '🔴', que, g or '—'))

    mal += _check_cadencia()
    return mal


class _Resp(object):
    def __init__(self, d):
        self.status_code, self._d, self.text = 200, d, ''

    def json(self):
        return self._d


class _Discord(object):
    """Un Discord de mentira, para contar A QUIEN se le pregunta.

    🔴 LA CADENCIA NO SE PUEDE PROBAR CONTRA DISCORD DE VERDAD. La
    diferencia entre dirigido y completo es **cuantos requests salen**, y
    medirlo contra la red da segundos que dependen del dia y de la cuota.
    Aca se cuentan las URLs, que es el numero que de verdad decide si el
    ciclo por hora entra en los 2.000 minutos de Actions.
    """
    LLAVE = ('`[ OCTAVOS ]`\n⌞A⌝ 🆚 ⌞B⌝\n⌞C⌝ 🆚 ⌞D⌝\n'
             '`[ FINAL ]`\n⌞A⌝ 🆚 ⌞C⌝')

    def __init__(self):
        self.urls = []

    def get(self, url, params=None, timeout=None):
        self.urls.append(url)
        if url.endswith('/users/@me/guilds'):
            return _Resp([{'id': 'g1', 'name': 'FFA'}])
        if url.endswith('/channels'):
            # el de voz (type 2) esta a proposito: tiene que quedar fuera
            return _Resp([{'id': 'c1', 'name': 'llaves', 'type': 0},
                          {'id': 'c2', 'name': 'charla', 'type': 0},
                          {'id': 'c3', 'name': 'voz', 'type': 2}])
        txt = self.LLAVE if '/channels/c1/' in url else 'hola que tal'
        return _Resp([{'id': 'm1', 'content': txt,
                       'timestamp': '2026-09-21T10:00:00+00:00',
                       'author': {'username': 'org'}}])


def _check_cadencia():
    """Que el dirigido encuentre lo mismo que el completo, y mas barato.

    🔴 LO QUE ESTO CUIDA ES UN MODO DE FALLA MUDO. Si el dirigido mira
    cero canales —memoria vacia, memoria con ids viejos, un `solo` que
    se pasa mal— la respuesta es «ninguna llave», que es **exactamente
    lo que contesta un dia tranquilo**. No hay error, no hay excepcion, y
    los eventos dejan de entrar al Sheet sin que nadie se entere.
    """
    global MEMORIA
    import shutil
    import tempfile
    mal = 0

    print('\n  cuando toca volver a mirar todo')
    ahora = datetime.datetime.now(datetime.timezone.utc)

    def _hace(h):
        return {'canales': {'c1': {}},
                'ultimo_completo':
                    (ahora - datetime.timedelta(hours=h)).isoformat()}

    for que, ok in [
        ('recién barrido -> dirigido', toca_completo(_hace(0)) is False),
        ('un minuto antes del plazo -> dirigido',
         toca_completo(_hace(HORAS_BARRIDO - 1 / 60.0)) is False),
        ('un minuto después -> completo',
         toca_completo(_hace(HORAS_BARRIDO + 1 / 60.0)) is True),
        ('sin fecha -> completo',
         toca_completo({'canales': {'c1': {}}}) is True),
        ('fecha ilegible -> completo',
         toca_completo({'ultimo_completo': 'ayer'}) is True),
        # ⚠️ EL PLAZO ES UNA PERILLA, NO UNA VERDAD, asi que no se
        # compara contra un numero: se comprueba que este en una banda
        # donde las dos cosas que tiene que lograr siguen valiendo. Mas
        # corto que una hora no ahorra nada; mas largo que un dia deja a
        # un servidor nuevo sin descubrir mas de 24 h.
        ('el plazo está en una banda razonable (%s h)' % HORAS_BARRIDO,
         1 <= HORAS_BARRIDO <= 24),
    ]:
        mal += not ok
        print('   %s %s' % ('✅' if ok else '🔴', que))

    print('\n  las dos cadencias, contra un Discord de mentira')
    guardo = MEMORIA
    tmp = tempfile.mkdtemp()
    MEMORIA = os.path.join(tmp, 'canales_llaves.json')
    try:
        d1 = _Discord()
        h1, i1 = escuchar(d1, forzar=True, por_canal=5)
        casos = [
            ('el completo encuentra la llave', len(h1) == 1),
            ('mira los 2 canales de texto y no el de voz',
             i1['canales'] == 2),
            ('y deja anotado dónde estaba',
             sorted(conocidos().get('canales') or {}) == ['c1']),
        ]
        d2 = _Discord()
        h2, i2 = escuchar(d2, forzar=False, por_canal=5)
        casos += [
            ('el dirigido encuentra la MISMA llave', len(h2) == 1),
            ('preguntando por 1 canal y no por 2', i2['canales'] == 1),
            ('con %d request(s) en vez de %d'
             % (len(d2.urls), len(d1.urls)), len(d2.urls) < len(d1.urls)),
        ]
        # 🔴 SIN MEMORIA, COMPLETO — aunque se pida dirigido. Es la rama
        # que salva a un clone limpio de contestar «ninguna llave» sin
        # haber mirado un solo canal.
        _guardar_conocidos({'canales': {}, 'ultimo_completo': ''})
        d3 = _Discord()
        h3, i3 = escuchar(d3, forzar=False, por_canal=5)
        casos.append(('sin memoria cae al completo aunque se pida dirigido',
                      i3['completo'] and len(h3) == 1))
        for que, ok in casos:
            mal += not ok
            print('   %s %s' % ('✅' if ok else '🔴', que))
    finally:
        MEMORIA = guardo
        shutil.rmtree(tmp, ignore_errors=True)
    return mal


def main():
    if '--auto' in sys.argv:
        print('\n══ EL DETECTOR DE LLAVES ══')
        return 1 if _self_check() else 0

    print('\n══ LLAVES ENCONTRADAS, SIN CONFIGURAR NINGUN CANAL ══\n')
    s = sesion()
    # a mano gana mirar todo, salvo que se pida lo contrario: el que
    # corre esto quiere ver que encuentra, no ahorrar 47 segundos.
    forzar = False if '--dirigido' in sys.argv else True
    hallazgos, info = escuchar(s, forzar=forzar)
    n_ch, n_msg = info['canales'], info['mensajes']
    print('   barrido %s · %d canal(es) · %d mensaje(s) mirados'
          % ('completo' if info['completo'] else 'DIRIGIDO', n_ch, n_msg))
    print('   %d llave(s) detectada(s)  (%.1f %%)\n'
          % (len(hallazgos), 100.0 * len(hallazgos) / max(n_msg, 1)))
    donde = collections.Counter(
        '%s · %s' % (h['servidor'][:16], h['canal']) for h in hallazgos)
    for k, v in donde.most_common():
        print('     %-46s %d' % (k[:46], v))

    if '--detalle' not in sys.argv:
        print('\n   (--detalle para ver cada llave resuelta)\n')
        return 0

    tot = res = 0
    porque = collections.Counter()
    for h in hallazgos:
        filas = resolver(h['texto'])
        for ronda, b, g, pq in filas:
            tot += 1
            res += g is not None
            if g is None:
                porque[pq] += 1
    print('\n   batallas %d · con ganador %d (%.0f %%)'
          % (tot, res, 100.0 * res / max(tot, 1)))
    print('   lo que no cierra va a `Pendientes`:')
    for k, v in porque.most_common():
        print('     %-34s %d' % (k, v))
    print('')
    return 0


if __name__ == '__main__':
    sys.exit(main())
