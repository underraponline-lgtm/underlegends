# -*- coding: utf-8 -*-
"""DE LA LLAVE DETECTADA EN DISCORD A LAS FILAS DE `Entrada`.

    python bot/llaves_a_entrada.py            que escribiria, sin tocar nada
    python bot/llaves_a_entrada.py --aplicar  lo escribe
    python bot/llaves_a_entrada.py --auto     el self-check

Es el eslabon que faltaba de la cadena:

    Discord ──> [ESTE] ──> Entrada ──> procesar_entrada ──> Resultados/1v1

`bot/escuchar.py` detecta y resuelve; este traduce a las nueve columnas
que `sheet/motor.py` ya sabe leer y las deja en la hoja.

🔴 UNA BATALLA DE TRES O MAS **NO ENTRA EN EL FORMATO**, Y NO SE FUERZA.

`Entrada` tiene `ladoA` y `ladoB`, y una coma dentro de un lado significa
**equipo**. Asi que la tentacion es escribir un 3-way como `A` vs `B,C`
— y eso calcula mal, en silencio. `motor.sumar()`:

    cuota = pts // len(ms) if len(ms) > 1 else pts

Los puntos **se dividen** entre los miembros. B y C se llevarian la mitad
cada uno de lo que vale llegar a cuartos, cuando cada uno llego a cuartos
por su cuenta.

Medido sobre 507 batallas reales: **351 son de dos** (69 %) y **156 son
de tres o mas** (81 de 3, 59 de 4, 15 de 5, 4 de 6+). O sea que forzarlo
dejaria mal casi un tercio de los puntos, sin un error que mirar.

⚠️ **Partirlo en pares tampoco sirve.** `A vs B vs C` como dos filas
—`A vs B` y `A vs C`— da los puntos bien, pero inventa **dos duelos 1v1
que nunca pasaron**, y la regla de Dlx es que los duelos cuentan *sólo*
cuando el formato es 1v1.

Asi que las de tres o mas van a `Pendientes` con el motivo. Que el
formato no sepa expresarlas es una decision de formato, no algo que este
script deba resolver adivinando.

⚠️ **Y NO SE ESCRIBE UNA BATALLA SIN GANADOR.** `motor._perdedor()`
devuelve `None` si el ganador no coincide con ningun lado, y esa batalla
no reparte puntos. Mejor que quede en `Pendientes`, donde alguien la ve,
que en `Entrada` haciendo bulto.

COMO SE IDENTIFICA UN EVENTO: POR EL PLANTEL
---------------------------------------------
Dlx: *«a veces eliminan las llaves x error pero lo vuelven a poner, y eso
seria otro mensaje ID»*. Por eso la clave **no** es el ID del mensaje.

Medido sobre **8.515 pares** de llaves reales: **ninguno** comparte el
60 % de su gente, y el parecido promedio es **0,03**. Dos eventos
distintos casi no comparten competidores, asi que el plantel de la
primera ronda es una huella limpia que sobrevive a que se republique.

⚠️ **EL TITULO NO SIRVE DE CLAVE, aunque el 80 % lo tenga**: se reutiliza.
`llave1` aparece en 6 mensajes repartidos en 28 dias, `rrpitolachaleco`
en 44, y uno se llama literalmente `nombre`. Se usa para *nombrar* el
evento, nunca para decidir si dos llaves son la misma.
"""
import collections
import datetime
import io
import json
import os
import re
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)
sys.path.insert(0, os.path.join(BASE, 'sheet'))
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

import escuchar as E                                     # noqa: E402
from comun import temporada as TEMP                      # noqa: E402

# ⚠️ Por debajo de esto el plantel no identifica nada: una final suelta
# son dos personas y cualquier par de finales se parece. Medido: el
# mensaje `llave1` son 6 posteos de solo FINAL/SEMIFINALES.
MIN_PLANTEL = 4
# el corte de «es el mismo evento». El promedio entre eventos distintos
# es 0,03, asi que 0,6 tiene tres ordenes de margen.
IGUAL = 0.6


def _ddmm(iso):
    """`2026-09-21T05:31:00+00:00` -> `21/09`, que es como lo escribe la hoja.

    ⚠️ LA FECHA DEL EVENTO ES LA DE PUBLICACION, no la de la ultima
    edicion. El 96 % de las llaves se edita despues —a veces dias— y el
    evento se jugo cuando se publico, no cuando el organizador termino de
    cargar el campeon.
    """
    if not iso:
        return ''
    try:
        return datetime.datetime.fromisoformat(iso).strftime('%d/%m')
    except (ValueError, TypeError):
        return ''


def de_esta_temporada(hallazgos):
    """(las de esta temporada, cuántas quedaron afuera).

    🔴 SIN ESTE CORTE EL RESET SE DESHACE SOLO. Los canales de llaves
    siguen teniendo las **25 llaves de la pre-temporada** y el lector
    las detecta igual de bien que a una nueva: el día que esto empiece
    a escribir, esas 25 entran a `Entrada`, se procesan y repueblan las
    hojas que se acaban de vaciar. No falla — funciona perfecto y deja
    la T1 arrancando con los datos que se borraron a propósito.

    ⚠️ LO QUE QUEDA AFUERA SE CUENTA Y SE DICE. Un filtro que descarta
    en silencio es indistinguible de un lector que dejó de encontrar
    nada, y ese es justo el modo de falla que este repo documenta una y
    otra vez.

    ⚠️ Y SIN FECHA **NO** ENTRA. Un mensaje sin `timestamp` no se puede
    ubicar en ninguna temporada; darle el beneficio de la duda es
    exactamente cómo una llave de la pre se cuela.
    """
    de_ahora, fuera = [], 0
    for h in hallazgos:
        cuando = (h.get('cuando') or '').strip()
        if cuando and cuando >= TEMP.INICIO:
            de_ahora.append(h)
        else:
            fuera += 1
    return de_ahora, fuera


_IDS = [None]


_INSC = [None]


def inscriptos_de(sv):
    """Los nombres que se anotaron en el canal de inscripciones de `sv`.

    🔴 ESTE ES EL PARAMETRO QUE FALTABA, Y ES EL QUE DLX PIDIO. La llamada
    a `escuchar.resolver()` pasaba `ids=` y **no** `conocidos=`, que es
    justamente la lista de inscriptos de ese evento. Su docstring lo dice
    entero: *«cuando están, el parecido se busca contra ~16 candidatos en
    vez de contra todo el texto»*. Sin eso cae a parecido sobre el texto
    crudo de la llave, y de ahí sale la basura que se vio en la vitrina:

        nhp(sinlimites     <- cortado en el paréntesis
        fleivacheck)       <- la OTRA MITAD del mismo nombre
        papa               <- de «sosa+papa+ bna🇯🇴»
        XXXXX 🇳🇴 · Garxziiscity 🇦🇿 · El ultra knowledge 🇬🇦

    Cada pedazo se volvía una persona y agarraba la bandera del emoji que
    tenía al lado — y así aparecieron Noruega, Azerbaiyán y Gabón en un
    ranking de una liga hispanohablante.

    🔑 **Y UNA INSCRIPCION VALE MAS QUE CUALQUIER ALGORITMO DE NOMBRES**,
    que es lo que dice `bot/inscripciones.py` en su encabezado: es un
    mensaje que escribió la propia persona, así que el `author.id` es su
    Discord ID **firmado por Discord**. Medido el 21/09: cruzar los 371
    del padrón sin ID contra los 2.705 miembros de DRA daba **11 (3 %)**;
    por el canal es el 100 % y sin margen, porque no es un parecido. El
    caso que lo muestra: `tnor` se inscribe desde la cuenta `tenor_25499`.

    ⚠️ VAN TODOS LOS DEL SERVIDOR Y NO SOLO LOS DE ESE EVENTO. Se podría
    filtrar por fecha, pero **sobrar un candidato es barato y faltar uno
    es el bug de arriba**: si el inscripto no está en la lista, el nombre
    de la llave no tiene con qué canonizarse. Son 35 en total.

    ⚠️ Y SALE DE `datos/anuncios.json`, que el ciclo ya refresca en el
    paso anterior. Pedirle a Discord otra vez sería una segunda fuente
    para lo mismo, y la que se quede vieja no avisa.
    """
    if _INSC[0] is None:
        d = {}
        try:
            p = os.path.join(BASE, 'datos', 'anuncios.json')
            with io.open(p, encoding='utf-8') as f:
                for x in (json.load(f) or {}).get('inscripciones') or []:
                    t = (x.get('texto') or '').strip()
                    if t:
                        d.setdefault(x.get('servidor') or '', []).append(t)
        except (OSError, ValueError):
            # ⚠️ SIN INSCRIPTOS SE SIGUE, con el comportamiento de antes.
            # Quedarse sin procesar una llave porque falta un json es peor
            # que resolverla peor.
            d = {}
        _INSC[0] = d
    return _INSC[0].get(sv) or []


def ids_del_padron():
    """{discord_id: [nombres]}, del padrón más sus alias. `{}` si falla.

    🔴 SIRVE PARA RESOLVER AL CAMPEÓN CUANDO LO ESCRIBEN COMO MENCIÓN.
    Tres finales de hoy dicen `CAMPEÓN: <@979878316846768139>` mientras
    los competidores van por nombre: `norm()` borra la mención entera,
    así que no se parece a nadie y el campeón de esos tres eventos —el
    resultado que más puntos vale— se perdía.

    ⚠️ ES UNA **LISTA** Y NO UN NOMBRE, y no por prolijidad: hay un
    Discord ID repetido en el padrón —`979878316846768139` figura como
    Oasis y como Fullylo4ded— así que un dict se queda con el último y
    descarta al otro sin decirlo. Con la lista, el que decide cuál es no
    es el orden de lectura sino **cuál de los dos peleó esa batalla**.

    ⚠️ LOS ALIAS ENTRAN POR LO MISMO. La hoja `AKAs` existe justamente
    para que `Humilda` y `Humildad` sean la misma persona; un campeón
    mencionado cuyo nombre de padrón no coincide con cómo lo escribió el
    organizador se resuelve por ahí, que es un dato declarado y no un
    parecido.

    ⚠️ SI EL SHEET NO CONTESTA, `{}` Y NO REVIENTA. El lector corre en
    seco todas las noches dentro del ciclo y no puede tumbarlo: sin
    padrón esas menciones vuelven a quedar sin resolver, que es el
    comportamiento de antes, no uno peor.
    """
    if _IDS[0] is None:
        out = {}
        try:
            import construir_padron as PAD
            for x in PAD.cargar():
                if x.get('discord_id'):
                    out.setdefault(str(x['discord_id']), []).append(x['raw'])
        except Exception as e:                           # noqa: BLE001
            # ⚠️ EL FALLBACK ESTA BIEN Y EL SILENCIO NO. Devolver `{}` es
            # lo correcto —sin padron las menciones quedan sin resolver,
            # que es el comportamiento de antes— pero no decirlo hace que
            # el sintoma se lea al reves: los campeones anunciados con
            # `<@mencion>` se van a `Pendientes` y parece que el detector
            # falla, cuando lo que fallo fue **leer el padron**.
            #
            # Son tres finales de las 25 llaves medidas, asi que durante
            # la prueba se nota y no se entiende.
            print('   ⚠️ no pude leer el padrón (%s): las menciones van a '
                  'quedar\n      sin resolver. NO es el detector.'
                  % str(e)[:60])
            _IDS[0] = {}
            return _IDS[0]
        # 🔴 ESTO NUNCA AGREGO UN SOLO ALIAS, y el docstring de arriba
        # dice que si. `construir_akas.cargar()` devuelve el json ENTERO
        # —`{_leeme, alias, pares, no_confundir}`— y aca se iteraban esas
        # cuatro claves como si fueran alias: `_leeme` apuntando a una
        # lista. No fallaba, asi que el `except` de abajo tampoco avisaba;
        # simplemente no hacia nada.
        #
        # Medido el 24/09/2026 con la final de DESGRACIAS CON TöKĪØ: el
        # campeon es `<@1405241805733105704>`, ese ID es **Hassan** en el
        # padron, y el lado de la final dice `PRRR🇦🇴` —un alias de Hassan
        # declarado en la hoja AKAs—. Sin los alias, `Hassan` contra
        # `PRRR` no engancha y la final entera se iba a Pendientes.
        try:
            import construir_akas as AK
            mapa = (AK.cargar() or {}).get('alias') or {}

            def _real(a):
                # siguiendo la cadena, como `rankings.canon()`
                vis, k = set(), _norm_simple(a)
                while k in mapa and k not in vis:
                    vis.add(k)
                    k = _norm_simple(mapa[k])
                return k

            alias = {}
            for a in mapa:
                alias.setdefault(_real(a), []).append(a)
            for did, nombres in out.items():
                for n in list(nombres):
                    for a in alias.get(_real(n), []):
                        if a not in nombres:
                            nombres.append(a)
        except Exception as e:                           # noqa: BLE001
            # sin alias se sigue —es un extra—, pero se dice
            print('   ⚠️ sin alias para las menciones: %s' % str(e)[:60])
        # 🔑 Y EL NOMBRE CON EL QUE CADA UNO SE INSCRIBIO. Es lo que Dlx
        # pidio desde el principio —*«basate en el ID de los autores del
        # canal de inscripciones»*—: un `<@ID>` que se anoto como
        # `PRRR🇦🇴` se llama `PRRR🇦🇴` en esa llave, y eso lo firmo Discord.
        try:
            with io.open(os.path.join(BASE, 'datos', 'anuncios.json'),
                         encoding='utf-8') as f:
                for x in (json.load(f) or {}).get('inscripciones') or []:
                    did, t = str(x.get('discord_id') or ''), (x.get('texto') or '').strip()
                    if did and t:
                        l = out.setdefault(did, [])
                        if t not in l:
                            l.append(t)
        except (OSError, ValueError):
            pass
        _IDS[0] = out
    return _IDS[0]


def _norm_simple(s):
    return re.sub(r'[^a-z0-9]', '', str(s or '').lower())


def plantel(texto):
    """El conjunto de competidores de TODAS las rondas, normalizado.

    🔴 ERA SOLO LA PRIMERA RONDA, Y ESO ROMPIA EL CASO QUE `agrupar()`
    EXISTE PARA RESOLVER. Dlx: *«a veces eliminan las llaves x error
    pero lo vuelven a poner»*, y lo que se repostea suele ser la
    version **con la ronda que faltaba**. Mirando solo la primera, esa
    ronda nueva **reemplaza** el plantel entero: medido con un caso de
    cuatro, el parecido entre la llave y su propia repostada caia a
    **0,20** y las dos entraban como eventos distintos.

    ⚠️ LA UNION NO JUNTA NADA QUE ANTES ESTUVIERA SEPARADO. El miedo
    razonable es que dos eventos del mismo servidor, con los mismos
    habitues, se fusionen. Medido sobre las 25 llaves vivas del
    21/09/2026:

        primera ronda      25 llaves -> 25 grupos
        todas las rondas   25 llaves -> 25 grupos

    Mismo resultado, y el plantel mediano sube de 12 a 13. O sea que la
    primera ronda ya traia casi todo el mundo y la union agrega margen
    sin costo.

    ⚠️ LOS EQUIPOS SE PARTEN. `Jetix 🇦🇷 + Arez 🇪🇨` son dos personas, y
    contarlo como una sola cambia el parecido.

    🔴 UN LADO ENTERO ES UN COMPETIDOR AUNQUE TENGA UNA SOLA LETRA. El
    corte de dos letras es para los PEDAZOS que salen de partir un
    equipo —ahí una letra suelta es basura—, pero se aplicaba también a
    un lado entero, y hay un rapero que se llama `7`. Y este conjunto no
    es sólo una huella: `len()` de él es `participantes`, que es lo que
    elige la escala de puntos (`motor.escala_de`). Medido el 24/09/2026:
    DESGRACIAS EN TOKYO VOL.12 tuvo 16 personas —cuatro batallas de
    cuatro en cuartos—, se contaban 15, y el evento entero cobraba con
    la escala 8-15 en vez de 16+.

    🔴 Y EL PARÉNTESIS SE SACA ANTES DE PARTIR, como en `equipos.py`.
    `gekto(chianluka+makma)` partido por `+` daba `gektochianluka` y
    `makma)`: una «persona» que no existe. Medido el 24/09/2026: ELRAP
    FECHA 6 contaba **34** y eran 27 lados limpios —siete de basura—, y
    EL RAP FECHA 5 contaba 29 con `agusyinn` y `neopollo`. Ninguno cambió
    de escala, pero con 15 reales y una basura un evento cobra 16+. La
    guía (Parte 1, §2) lo llama *«el paso que más se arruina»*.

    ⚠️ LO DE ADENTRO SÍ CUENTA, SI ES ALGUIEN NUEVO. Quien aparece sólo
    entre paréntesis estuvo en la llave —`hassan(tam)`: tam perdió con
    Hassan—, pero muchas veces es otra forma de escribir a alguien que ya
    tiene su lado: `blody` es `bloody`, `pollo` es `pollo sport`. Entra
    sólo si no se parece a nadie ya contado.
    """
    from equipos import _PAREN
    out, adentro = set(), set()
    for _ronda, bats in E.rondas_de(texto):
        for b in bats:
            for n in b:
                # ⚠️ EL POKEMON NO SUMA AL PLANTEL (guía, §2 regla 3): no
                # peleó. Va primero porque su marca `(P)` es un paréntesis.
                n = E._sin_pokemon(n)
                for x in _PAREN.findall(n):
                    for p in re.split(r'[+,/]', x.strip('()（）')):
                        if len(E.norm(p)) >= 2:
                            adentro.add(E.norm(p))
                partes = re.split(r'[+,/]|\s-\s', _PAREN.sub('', n))
                for parte in partes:
                    k = E.norm(parte)
                    if len(k) >= 2 or (k and len(partes) == 1):
                        out.add(k)
    for k in sorted(adentro - out):
        if not (E._parecido(k, list(out)) or any(
                min(len(k), len(c)) >= 4 and (c.startswith(k) or k.startswith(c))
                for c in out)):
            out.add(k)
    return out


def parecido(a, b):
    return len(a & b) / float(len(a | b)) if (a or b) else 0.0


def titulo(texto):
    """Como se llama el evento. Solo para NOMBRARLO, nunca como clave."""
    for l in (texto or '').splitlines()[:6]:
        limpio = re.sub(r'<a?:\w+:\d+>|<@[&!]?\d+>', ' ', l)
        limpio = re.sub(r'[^\w\sÁÉÍÓÚÑáéíóúñ.\-]', ' ', limpio)
        limpio = re.sub(r'\s+', ' ', limpio).strip()
        if len(limpio) < 3:
            continue
        if E.RONDA.search(limpio) or E.nombres_de_linea(l):
            continue
        return limpio[:60]
    return None


def codigo_servidor(guild_id):
    """(codigo, por_que) de ese guild. Sale de datos/servidores.json.

    🔴 «SIN CODIGO» NO ES LO MISMO QUE «NO DECIDIDO», Y CONFUNDIRLOS ERA
    UN BUG. La primera version preguntaba solo por `servidores` y mandaba
    las 7 llaves de LIVONIA a la pila de problemas, como si faltara
    configurarlo. No falta: **LIVONIA y CONFED estan declarados en
    `solo_identidad` desde el 19/09** — *«para: sacar Discord ID, nada
    mas»*. El bot esta ahi para leer identidades, no para contar sus
    eventos.

    ⚠️ Y la confusion tenia un costo real hacia el otro lado: alguien que
    leyera «servidor sin codigo, 7 llaves» podia agregarlo a
    `servidores` para «arreglarlo» — y ahi los eventos de LIVONIA
    empezarian a sumar para la Liga, que es lo contrario de lo decidido.

    Los tres casos quedan separados:

        ('FFA', 'liga')       cuenta: sus eventos entran
        (None, 'identidad')   decidido que NO: se saltea callado
        (None, 'desconocido') ESE si es un hueco de configuracion
    """
    p = os.path.join(BASE, 'datos', 'servidores.json')
    with io.open(p, encoding='utf-8') as f:
        d = json.load(f)
    for k, v in (d.get('servidores') or {}).items():
        if isinstance(v, dict) and str(v.get('guild_id')) == str(guild_id):
            return k, 'liga'
    for k, v in (d.get('solo_identidad') or {}).items():
        if isinstance(v, dict) and str(v.get('guild_id')) == str(guild_id):
            return None, 'identidad'
    return None, 'desconocido'


def filas_de(hallazgo, nombre=None, fecha=None, gente_grupo=None):
    """(filas para `Entrada`, dudas, sabidas) de UNA llave.

    🔴 `nombre` LO PONE EL GRUPO, Y ESO CIERRA UNA GRIETA DE COMPOSICION.
    `titulo()` dice en su propio docstring *«solo para NOMBRARLO, nunca
    como clave»*, y `procesar_entrada.numeros_por_evento()` **keyea por
    `(nombre, servidor, fecha)`**. Cada mitad es defendible y juntas
    hacen que lo que un modulo declara inservible como clave sea
    exactamente lo que el otro usa de clave.

    Sin esto, un evento repartido en dos mensajes —el caso que Dlx
    describio: *«a veces eliminan las llaves x error pero lo vuelven a
    poner, y eso seria otro mensaje ID»*— entra a `Entrada` con **dos
    nombres**, saca **dos numeros de evento** y se cuenta dos veces. Y
    ese es el unico error de la cadena que su propio docstring dice que
    **no se arregla volviendo a correr**.

    ⚠️ `agrupar()` ya resolvia que son el mismo evento y **su resultado
    no lo usaba nadie para nombrar**. La decision existia y el codigo
    leia de otro lado, que es la forma que este repo documenta tres
    veces en `CLAUDE.md`.

    🔴 `Pendientes` ES PARA LO CONFUSO, NO PARA TODO LO QUE NO ENTRA.
    Dlx, 21/09: *«que casi nunca se vayan cosas a pendientes a menos que
    el sistema detecte algo muy confuso»*. La primera version mandaba
    **67 de 180** —el 37 %— y eso no es una cola, es un vertedero: nadie
    revisa una lista donde un tercio son avisos repetidos de cosas ya
    decididas.

    Ahora se separan dos montones:

        `dudas`    lo que una persona PUEDE arreglar mirando la llave
        `sabidas`  limitaciones conocidas — se CUENTAN, no se encolan

    En `sabidas` van las batallas de tres o mas (el formato tiene dos
    lados y Dlx dejo esa decision para despues), el tercer puesto (no
    tiene ronda siguiente: es la forma del torneo) y el servidor sin
    codigo (es UN servidor, no una duda por batalla).
    """
    txt = hallazgo['texto']
    sv, por_que = codigo_servidor(hallazgo['guild'])
    ev = nombre or titulo(txt) or '(sin titulo)'
    fecha = fecha or hallazgo.get('fecha') or ''
    gente = plantel(txt)
    filas, dudas, sabidas = [], [], collections.Counter()

    if por_que == 'identidad':
        # decidido que no cuenta: se saltea y se dice, no se encola
        sabidas['solo identidad, sus eventos no cuentan: %s'
                % hallazgo['servidor'][:20]] += 1
        return filas, dudas, sabidas
    if not sv:
        # ⚠️ ESTE SI ES UN HUECO: un servidor donde el bot esta y que no
        # esta declarado en ninguno de los dos lados. Hay que decidirlo.
        dudas.append((ev, '(servidor)', hallazgo['servidor'][:30],
                      'no está en `servidores` ni en `solo_identidad`'))
        return filas, dudas, sabidas

    # 🔑 `conocidos=` ERA EL PARAMETRO QUE FALTABA. Ver `inscriptos_de()`:
    # sin él, los nombres de la llave se resuelven contra el texto crudo y
    # salen partidos por los paréntesis y los `+` de los equipos.
    for bat in E.resolver(txt, conocidos=inscriptos_de(sv),
                          ids=ids_del_padron()):
        ronda, lados, ganador, razon = bat
        # 🔴 EN UNA BATALLA DONDE PASAN VARIOS, LOS QUE NO PASAN CAYERON
        # AHI —y eso es un puesto—. Hasta el 24/09/2026 esto se contaba
        # como «limitacion conocida» y no se escribia ninguna fila: medido
        # ese dia, **30 batallas** en las llaves de FFA, casi todas de 4
        # con 2 que pasan. Los eliminados quedaban sin sus puntos.
        #
        # ⚠️ LA REGLA YA ESTABA DECIDIDA, para los triples, justo abajo:
        # *«el puesto si se reparte y el duelo no»*. Esto es el mismo caso
        # un paso mas alla —una batalla de muchos—, asi que va con la misma
        # nota: `triple`, que `resultados._filas_uno()` deja afuera del 1v1.
        #
        # ⚠️ El `ladoA` es uno de los que paso y NO es «quien le gano»:
        # el motor solo usa la fila para saber quien cayo y en que ronda
        # (`motor._perdedor`), y el que paso cobra por su ronda siguiente.
        # La nota lo dice para quien mire la hoja.
        pasan = [x for x in (getattr(bat, 'pasan', None) or []) if x in lados]
        if ganador is None and 'pasan' in razon and pasan:
            caen = [l for l in lados if l not in pasan]
            for p in caen:
                filas.append({'evento': ev, 'servidor': sv, 'fecha': fecha,
                              'participantes': len(gente_grupo or gente),
                              'ronda': ronda.lower(),
                              'ladoA': pasan[0], 'ladoB': p,
                              'ganador': pasan[0],
                              'notas': 'triple (%d bandas, pasan %d)'
                                       % (len(lados), len(pasan))})
            sabidas['batalla de %d donde pasan %d -> %d fila(s), sin duelo'
                    % (len(lados), len(pasan), len(caen))] += 1
            continue
        if ganador is None:
            if 'tercer puesto' in razon or 'pasan' in razon:
                sabidas[razon] += 1
            else:
                dudas.append((ev, ronda, ' vs '.join(lados), razon))
            continue
        # 🔴 UNA BATALLA A TRES BANDAS SE PARTE EN UNA FILA POR PERDEDOR,
        # Y ANTES SE TIRABA ENTERA.
        #
        # `Entrada` tiene dos lados —`Lado A` y `Lado B`— así que un
        # `A vs B vs C` no entra, y el lector lo contaba como limitación
        # conocida. Medido el 23/09/2026 sobre el #349: **6 personas se
        # quedaban sin su puesto de cuartos**, o sea sin sus puntos,
        # porque su batalla no existía.
        #
        # ⚠️ Y LA CONVENCIÓN PARA ESTO YA ESTABA EN EL CÓDIGO:
        # `resultados._filas_uno()` descarta del `1v1` las filas cuya
        # nota dice **«triple»**. O sea que alguien ya había decidido
        # que un 1v2 no es un duelo — y el lector nunca producía esa
        # nota. Es la misma forma que los equipos: la regla escrita y el
        # dato entrando por otro lado.
        #
        # ⚠️ EL PUESTO SÍ SE REPARTE Y EL DUELO NO. Los dos perdedores
        # caen en la misma ronda, que es lo que les da sus puntos; pero
        # ninguna de las dos filas entra a `1v1`, porque una batalla a
        # tres no son dos duelos.
        if len(lados) > 2:
            perdedores = [l for l in lados if l != ganador]
            for p in perdedores:
                filas.append({'evento': ev, 'servidor': sv, 'fecha': fecha,
                              'participantes': len(gente_grupo or gente),
                              'ronda': ronda.lower(),
                              'ladoA': ganador, 'ladoB': p,
                              'ganador': ganador,
                              'notas': 'triple (%d bandas)' % len(lados)})
            sabidas['batalla de %d bandas -> %d fila(s), sin duelo'
                    % (len(lados), len(perdedores))] += 1
            continue
        if len(lados) != 2:
            sabidas['batalla de %d, el formato tiene 2 lados' % len(lados)] += 1
            continue
        otro = lados[0] if lados[1] == ganador else lados[1]
        filas.append({'evento': ev, 'servidor': sv, 'fecha': fecha,
                      # 🔴 EL PLANTEL DEL GRUPO Y NO EL DEL MENSAJE, y
                      # este es el tercero del mismo molde —después del
                      # nombre y la fecha— pero el único que **cambia
                      # los puntos**: `motor.escala_de()` elige la tabla
                      # con este número (4-7, 8-15, 16+). Con dos
                      # mensajes, `motor.procesar()` se queda con el
                      # `max`, que no es la unión: 6 y 7 dan «4-7»
                      # cuando el evento tuvo 12 y le tocaba «8-15».
                      'participantes': len(gente_grupo or gente),
                      'ronda': ronda.lower(),
                      'ladoA': ganador, 'ladoB': otro,
                      'ganador': ganador,
                      # ⚠️ EL TERCERO QUE SALE DEL PODIO NO ES UN DUELO: la
                      # llave no trae esa batalla y no se sabe si se peleó.
                      # Con la nota, `resultados._filas_uno()` la deja
                      # afuera de `1v1` y el motor igual paga 3ro y 4to.
                      'notas': ('podio: tercer puesto sin batalla en la llave'
                                if razon.startswith('podio') else '')})
    return filas, dudas, sabidas


def _con_nota(f, nota):
    """Agrega `nota` a la fila si no la tiene ya."""
    if nota.lower() not in (f.get('notas') or '').lower():
        f['notas'] = ('%s; %s' % (f['notas'], nota)) if f.get('notas') else nota


def _pokemones(f):
    """Las claves de los que la fila marca como pokemon."""
    return {E.norm(x) for x in re.findall(r'pokemon\s*:\s*([^;|]+)',
                                          f.get('notas') or '', re.I)}


def marcar_pokemones(filas, textos=()):
    """Anota `Pokemon: nombre` en las filas de la ronda donde no peleó.

    🔴 EL POKEMON APARECE EN LA LLAVE Y NO PELEÓ. Guía de formatos, Parte 2
    (§9.7, §10.2 a §10.4): se marca `(P)` o con la palabra *pokemon*, y
    esa aparición no paga, no da puesto —*«si le ponés campeón le estás
    regalando un 🥇»*— y no entra al divisor del equipo. Lo que ganó
    antes lo conserva entero: *«el pokemon no significa revivido»*.

    ⚠️ LA MARCA SE LEE EN EL TEXTO CRUDO, NO EN LAS FILAS. El paréntesis se
    pierde antes de llegar acá: `equipos.integrantes()` borra todo lo que
    está entre paréntesis —porque `A(B+C)` es a quién le ganó A— y el
    canonizador del lector compara sin él. Es lo mismo que ya hacen el
    walk-in y el revivido.
    """
    def _ronda(r):
        r = (r or '').upper()
        return E.ALIAS.get(r, r)

    marcados = set()                     # (ronda, clave)
    for t in textos:
        for ronda, bats in E.rondas_de(t):
            for b in bats:
                for lado in b:
                    for parte in re.split(r'[+,&]', lado):
                        if E.POKEMON.search(parte):
                            k = E.norm(E.POKEMON.sub('', parte))
                            if k:
                                marcados.add((_ronda(ronda), k))
    if not marcados:
        return filas
    for f in filas:
        r = _ronda(f.get('ronda'))
        for lado in (f.get('ladoA'), f.get('ladoB')):
            for parte in re.split(r'[+,&]', E.HISTORIA.sub('', lado or '')):
                limpio = E.POKEMON.sub('', parte).strip()
                if (r, E.norm(limpio)) in marcados:
                    _con_nota(f, 'Pokemon: %s' % limpio)
    return filas


def invitados_de(textos=()):
    """Las claves de los invitados de honor que la llave declara.

    ⚠️ Guía, Parte 2 (§9.2): el invitado de honor cobra el 100 % aunque
    entre en una ronda avanzada — no es un walk-in. Se reconoce al lado
    del nombre (`Konan (invitado)`) o en una línea propia
    (`INVITADO DE HONOR: Konan`).
    """
    out = set()
    for t in textos:
        for l in E.plano(t or '').splitlines():
            if not E.INVITADO.search(l):
                continue
            partes = []
            ns = E.nombres_de_linea(l)
            if ns:
                partes = [x for lado in ns for x in re.split(r'[+,&]', lado)
                          if E.INVITADO.search(x)]
            elif ':' in l:
                partes = re.split(r'[,+/]|\s+y\s+', l.split(':', 1)[1])
            for x in partes:
                x = re.sub(r'(?i)\bde\s+honor\b', '', E.INVITADO.sub('', x))
                k = E.norm(x)
                if k:
                    out.add(k)
    return out


#: la fase previa que, sin batallas, es un cypher disfrazado (guía §12)
FASE_PREVIA = ('FILTROS', 'CLASIFICATORIAS', 'PRELIMINARES')
#: `FASE CYPHER`, `[ CYPHER ]`: un encabezado, no el nombre del evento
CYPHER = re.compile(r'^\W*(?:(?:fase|ronda)\s+(?:de\s+)?)?c[iy]pher\W*$'
                    r'|(?:fase|ronda)\s+(?:de\s+)?c[iy]pher', re.I)
#: `rumbo al Interserver`: el Interserver tiene su propio sistema (§11.2)
INTERSERVER = re.compile(r'inter\s*-?\s*server|camino\s+a\s+la\s+hermandad',
                         re.I)


def _cuantos_nombres(l):
    """Cuántos nombres trae una línea que no es una batalla."""
    n = len(E.MENCION.findall(l))
    l = E.MENCION.sub(' ', l)
    for x in re.split(r'[,+/|•·]|\s[-–—]\s|^\s*[-–—*]\s*', l):
        k = E.norm(x)
        if 2 <= len(k) <= 28:
            n += 1
    return n


def fase_sin_batallas(texto):
    """La fase previa que lista gente SIN mostrar batallas, o None.

    🔴 LA GUÍA LO DICE CON TODAS LAS LETRAS Y ES LO CONTRARIO DE LO QUE
    HACE UN LECTOR. Parte 2, §12: *«si hay una fase de filtros,
    clasificatoria o cypher sin batallas mostradas, se descarta el evento
    entero. No se procesa "solo la parte clara"»*. Un lector hace
    exactamente eso por diseño: una sección sin batallas no deja filas y
    el evento sigue con el resto — los eliminados en filtros
    desaparecen sin puntos y el evento entra cuando tenía que quedar
    afuera. La guía lo llama *«la diferencia de criterio que más daño
    hace»*.

    ⚠️ Sólo las fases PREVIAS (filtros, clasificatoria, preliminares) y
    un encabezado de cypher. Un evento que se LLAMA «Cypher algo» y trae
    su llave cuenta (§14.2: *«lo que decide es el bracket, no el
    título»*), y una lista de inscriptos antes de la primera ronda no es
    una fase.
    """
    halladas = []
    actual, gente, bats = None, 0, 0
    for l in E.unir_continuadas(E.plano(texto or '')).splitlines():
        nombres = E.nombres_de_linea(l)
        m = E.RONDA.search(l)
        cy = bool(CYPHER.search(l)) and not nombres
        if cy or (m and not nombres):
            if actual and gente >= 3 and not bats:
                halladas.append(actual)
            if cy:
                actual = 'CYPHER'
            else:
                e = re.sub(r'\s+', ' ', m.group(1).upper()).strip()
                e = E.ALIAS.get(e, e)
                actual = e if e in FASE_PREVIA else None
            gente, bats = 0, 0
            continue
        if not actual:
            continue
        if nombres:
            bats += 1
        elif not E.PODIO.search(l):
            gente += _cuantos_nombres(l)
    if actual and gente >= 3 and not bats:
        halladas.append(actual)
    return halladas[0] if halladas else None


def marcar_walkins(filas, textos=()):
    """Anota `Walk-in N: nombre` a quien aparece recien en una ronda avanzada.

    🔴 LA GUIA DE FORMATOS LO TIENE COMO EL ERROR #4 —«walk-in sin
    descuento», 19 de 78 eventos— Y EL LECTOR NO LO MIRABA. Dlx,
    23/09/2026, §4.1: *«alguien aparece por primera vez en cuartos o semis
    sin haber jugado antes. Cobra menos porque se salto camino»*: una ronda
    salteada 50 %, dos 25 %, tres o mas 0 %. Al campeon tambien: «Konan
    aparecio recien en cuartos… cobro 5.000 en vez de 10.000».

    Medido el 24/09/2026: en DESGRACIAS EN TOKYO VOL 11 el ganador de
    ONZASS vs GUS no se presento y PICHULITA entro directo a cuartos.
    Cobraba sus cuartos enteros.

    ⚠️ QUIEN ESTUVO ANTES SE MIRA EN EL TEXTO DE LA LLAVE, NO EN LAS FILAS.
    La primera version miraba las filas ya resueltas, y una batalla de
    octavos que queda sin resolver no deja filas: su gente parecia
    aparecer recien en cuartos. Asi le cayo un walk-in falso a `nhp` en
    ELRAP FECHA 6, que peleo octavos (`fokox 🆚 Sin limites 🆚 nhp`).

    ⚠️ LA NOTA LLEVA EL NOMBRE. El motor aplicaba `Walk-in N` a los DOS
    lados de la batalla —su propio comentario lo documenta como bug
    pendiente de decidir— y la guia lo decide: castiga al que salteo.

    ⚠️ SOLO INDIVIDUALES. Quien aparece por primera vez dentro de un
    equipo es un drafteado o un absorbido (§3.2, §4.1: «no aplica a
    drafteados de pandilla»), no un walk-in. Y no cuenta si se parece a
    alguien de una ronda anterior: `PICHULITAMC` en octavos y `PICHULITA`
    en cuartos son la misma persona escrita distinto.
    """
    def _k(n):
        return E.norm(E.HISTORIA.sub('', n or ''))

    def _ronda(r):
        r = (r or '').upper()
        return E.ALIAS.get(r, r)

    # las rondas del texto, en orden, con TODOS los nombres que aparecen
    # —tambien los de adentro de un parentesis: son gente que ya peleo—
    en_texto = collections.defaultdict(set)
    for t in textos:
        for ronda, bats in E.rondas_de(t):
            r = _ronda(ronda)
            if r not in E.ORDEN or r == 'TERCER LUGAR':
                continue
            for b in bats:
                for n in b:
                    for parte in re.split(r'[+,&()]', n):
                        k = E.norm(parte)
                        if k:
                            en_texto[r].add(k)
    for f in filas:
        r = _ronda(f.get('ronda'))
        if r in E.ORDEN and r != 'TERCER LUGAR':
            for lado in (f.get('ladoA'), f.get('ladoB')):
                for parte in re.split(r'[+,&]', lado or ''):
                    k = _k(parte)
                    if k:
                        en_texto[r].add(k)
    rondas = sorted(en_texto, key=E.ORDEN.index)
    if len(rondas) < 2:
        return filas
    pos = {r: i for i, r in enumerate(rondas)}

    # ⚠️ NI EL POKEMON NI EL INVITADO DE HONOR SON WALK-IN (guía, Parte 2,
    # §9.2): el primero no peleó esa ronda y el segundo cobra el 100 %.
    invitados = invitados_de(textos)
    primera = {}   # clave -> (indice de ronda, nombre, fila)
    for f in filas:
        r = _ronda(f.get('ronda'))
        if r not in pos:
            continue
        pk = _pokemones(f)
        for lado in (f.get('ladoA'), f.get('ladoB')):
            if not lado or E._equipo(lado) or re.search(
                    r'[+,&]', E.HISTORIA.sub('', lado)):
                continue
            k = _k(lado)
            if k in pk or k in invitados:
                continue
            if k and (k not in primera or pos[r] < primera[k][0]):
                primera[k] = (pos[r], lado, f)
    for k, (i, nombre, f) in primera.items():
        if i == 0:
            continue
        previos = set().union(*(en_texto[rondas[j]] for j in range(i)))
        if k in previos or E._parecido(k, list(previos)):
            continue
        nota = 'Walk-in %d: %s' % (min(i, 3), E.HISTORIA.sub('', nombre).strip())
        f['notas'] = ('%s; %s' % (f['notas'], nota)) if f.get('notas') else nota
    return filas


#: la notacion de revivido de la guia (§3.7): `Mco (R)`, `1R`, `2R`
REVIVIDO_MARCA = re.compile(r'([^\s⌞\[\]()]{2,}[^⌞\[\]()]*?)\s*(?:\(\s*R\s*\)|\b[123]\s*R\b)')


def marcar_revividos(filas, textos=()):
    """Anota `Revivido: nombre` a quien pierde y vuelve a entrar.

    🔴 EL FENOMENO MAS FRECUENTE DE LA GUIA, Y EL LECTOR NO LO VEIA. Dlx,
    23/09/2026, §3.7: *«aparece 33 veces en 78 eventos. Alguien pierde, y
    vuelve a entrar al torneo. Regla: el revivido cobra el 50 % de su
    posicion FINAL, y ademas conserva los puntos de la ronda donde perdio
    la primera vez»*. Medido el 24/09/2026 en la T1:

        Snow      VOL.12    pierde la semi en dupla, gana la final en trio
        Colesito  VOL.12    pierde la semi en dupla, sale subcampeon en trio
        nc        CARABOBO  pierde cuartos con g8, sube con Mcnadie

    Cobraban los dos puestos enteros (Snow 5.958 donde le tocan 4.291).

    Se reconoce de tres maneras, las tres de la guia:
      · la notacion `(R)`, `1R`, `2R` al lado del nombre;
      · el mismo nombre dos veces en la misma ronda (el segundo es el
        revivido: «de arriba hacia abajo»);
      · quien pierde una batalla y aparece en otra de la misma ronda o de
        una posterior —el absorbido de §3.2 es exactamente esto—.

    ⚠️ EL TERCER PUESTO NO CUENTA COMO VOLVER: los que pierden la semi lo
    juegan por reglamento. Y la batalla del podio tampoco (no se peleo).
    """
    def _k(n):
        return E.norm(E.HISTORIA.sub('', n or ''))

    def _r(f):
        r = (f.get('ronda') or '').upper()
        r = E.ALIAS.get(r, r)
        return E.ORDEN.index(r) if r in E.ORDEN else -1

    def _miembros(lado):
        # ⚠️ LA HISTORIA SE SACA ANTES DE PARTIR: `SAITO(blody+cj)` partido
        # por `+` dejaba un integrante `cj)`, y CJ parecia volver a semis
        # en ELRAP FECHA 6. Mismo error que ya tuvo `escuchar.resolver`.
        return [p for p in (_k(x) for x in re.split(
            r'[+,&]', E.HISTORIA.sub('', lado or ''))) if p]

    revividos = {}
    # 🔑 EN UN DRAFT, QUIEN VUELVE DENTRO DE UN EQUIPO ES UN DRAFTEADO, no
    # un revivido (guía, Parte 2, §9.1 y §11.1): cobra su eliminación Y su
    # parte del equipo al 100 %. En la llave se ven igual, así que lo
    # decide que la llave diga que es un draft.
    es_draft = any(E.DRAFT.search(t or '') for t in textos)
    drafteados = set()
    # 1. la notacion, en el texto crudo
    for t in textos:
        for m in REVIVIDO_MARCA.finditer(t or ''):
            k = E.norm(m.group(1))
            if k:
                revividos.setdefault(k, m.group(1).strip())
    # 2 y 3. perdio y volvio a aparecer
    validas = [f for f in filas
               if _r(f) >= 0 and 'TERCER' not in (f.get('ronda') or '').upper()
               and 'podio' not in (f.get('notas') or '').lower()]
    for i, f in enumerate(validas):
        g = f.get('ganador') or ''
        perdedor = f.get('ladoB') if g == f.get('ladoA') else f.get('ladoA')
        for m in _miembros(perdedor):
            for j, h in enumerate(validas):
                if j == i or _r(h) < _r(f):
                    continue
                # ⚠️ EL POKEMON NO VUELVE: aparece sin pelear (§10.3).
                if m in _pokemones(h):
                    continue
                ma, mb = _miembros(h.get('ladoA')), _miembros(h.get('ladoB'))
                if m in ma + mb:
                    # ⚠️ las filas de una amenaza partida comparten al que
                    # PASO, no al que perdio: el perdedor de una fila de
                    # «triple» no reaparece en otra de la misma batalla
                    en_equipo = len(ma if m in ma else mb) > 1
                    if es_draft and en_equipo and m not in revividos:
                        drafteados.add(m)
                    else:
                        revividos.setdefault(m, m)
                    break
    drafteados -= set(revividos)
    if not revividos and not drafteados:
        return filas
    # la nota va en la PRIMERA fila donde aparece, con el nombre como esta
    # escrito ahi, para que el motor lo resuelva igual que al resto
    puesto = set()
    for f in sorted(validas, key=_r):
        for lado in (f.get('ladoA'), f.get('ladoB')):
            for parte in re.split(r'[+,&]', lado or ''):
                k = _k(parte)
                if k in puesto or not (k in revividos or k in drafteados):
                    continue
                puesto.add(k)
                que = 'Revivido' if k in revividos else 'Drafteado'
                nota = '%s: %s' % (que, E.HISTORIA.sub('', parte).strip())
                f['notas'] = ('%s; %s' % (f['notas'], nota)) if f.get('notas') else nota
    return filas


def nombre_de(grupo):
    """UN nombre para todo el grupo. El más repetido; si empatan, el 1º.

    ⚠️ EL MÁS REPETIDO Y NO EL PRIMERO, aunque casi siempre den lo
    mismo. Cuando alguien reposta la llave, la copia suele ser idéntica
    y el original puede ser el que quedó a medias; contar deja ganar a
    la forma en que el evento se escribió de verdad, y no depende del
    orden en que Discord los devolvió — que cambia si se borra un
    mensaje.
    """
    tits = [t for t in (titulo(h['texto']) for h in grupo['llaves']) if t]
    if not tits:
        return '(sin titulo)'
    return collections.Counter(tits).most_common(1)[0][0]


def fecha_de(grupo):
    """UNA fecha para todo el grupo: la del mensaje MÁS VIEJO.

    🔴 SIN ESTO EL ARREGLO DEL NOMBRE NO ALCANZA, y por poco. La clave
    de `procesar_entrada.numeros_por_evento()` es
    `(nombre, servidor, fecha)`: darle un nombre común al grupo y dejar
    que cada mensaje ponga **su** fecha vuelve a dar dos claves, o sea
    el mismo evento con dos números — exactamente lo que se estaba
    cerrando, mudado un campo a la derecha.

    ⚠️ LA MÁS VIEJA Y NO LA MÁS NUEVA. La repostada es una corrección
    que llega después, a veces días; el evento se jugó cuando se
    publicó la primera. Es la misma razón por la que `_ddmm()` usa
    `timestamp` y no `edited_timestamp`.
    """
    fs = [h.get('cuando') or '' for h in grupo['llaves']]
    fs = [f for f in fs if f]
    return _ddmm(min(fs)) if fs else ''


def sin_repetir(filas):
    """Las filas del grupo sin la misma batalla dos veces.

    🔴 UNA LLAVE REPOSTADA TRAE LAS MISMAS BATALLAS OTRA VEZ. Ahora que
    las dos copias comparten nombre de evento, sus filas caen en el
    mismo número y `motor.py` contaría cada combate dos veces — o sea
    el doble de puntos, sin que nada falle.

    ⚠️ LA CLAVE ES (ronda, los dos lados), no la fila entera: el
    `ganador` puede diferir entre la copia a medias y la corregida, así
    que importa cuál gana — y gana **la repostada**. Comprobado el
    21/09/2026 en los dos canales: Discord devuelve los mensajes del
    más nuevo al más viejo, `agrupar()` conserva ese orden y
    `sin_repetir()` se queda con el primero. O sea que la corrección le
    gana al original, que es lo que se quiere. Si algún día se
    ordenara al revés, esta función empieza a preferir la versión
    vieja **sin fallar**.
    """
    vistas, out = set(), []
    for f in filas:
        k = (f['ronda'], f['ladoA'], f['ladoB'])
        k2 = (f['ronda'], f['ladoB'], f['ladoA'])
        if k in vistas or k2 in vistas:
            continue
        vistas.add(k)
        out.append(f)
    return out


#: horas sin publicar ni editar la llave para dar por TERMINADO un evento
#: que no dice quién ganó. Un evento dura una noche; la llave se va
#: completando mientras tanto, así que menos que esto es «en curso».
QUIETA_H = 12


def tiene_campeon(filas):
    """`True` si alguna fila es la FINAL con ganador: se sabe quién ganó."""
    return any(str(f.get('ronda') or '').strip().lower() == 'final'
               and str(f.get('ganador') or '').strip() for f in filas)


def horas_quieta(grupo, ahora=None):
    """Horas desde lo último que se hizo con la llave: publicarla o editarla.

    `None` si ningún mensaje trae hora, y quien llama lo trata como
    quieta: una llave que no se puede ubicar en el tiempo no puede
    esperar para siempre sin que nadie la vea.
    """
    ahora = ahora or datetime.datetime.now(datetime.timezone.utc)
    ult = None
    for h in grupo['llaves']:
        for k in ('editado', 'cuando'):
            t = str(h.get(k) or '').strip()
            if not t:
                continue
            try:
                t = datetime.datetime.fromisoformat(t.replace('Z', '+00:00'))
            except ValueError:
                continue
            if t.tzinfo is None:
                t = t.replace(tzinfo=datetime.timezone.utc)
            if ult is None or t > ult:
                ult = t
    return None if ult is None else (ahora - ult).total_seconds() / 3600.0


def agrupar(hallazgos):
    """Junta las llaves que son el MISMO evento, por plantel."""
    grupos = []
    for h in hallazgos:
        p = plantel(h['texto'])
        if len(p) < MIN_PLANTEL:
            h['_chico'] = True
            grupos.append({'plantel': p, 'llaves': [h]})
            continue
        for g in grupos:
            if g['llaves'][0].get('_chico'):
                continue
            if parecido(g['plantel'], p) >= IGUAL:
                g['llaves'].append(h)
                g['plantel'] |= p
                break
        else:
            grupos.append({'plantel': p, 'llaves': [h]})
    return grupos


def _self_check():
    a = ('`[ OCTAVOS ]`\n⌞Ana⌝ 🆚 ⌞Beto⌝\n⌞Caro⌝ 🆚 ⌞Dani⌝\n'
         '`[ FINAL ]`\n⌞Ana⌝ 🆚 ⌞Caro⌝')
    # la misma, republicada con otro ID y el titulo cambiado
    b = ('# COPA X\n`[ OCTAVOS ]`\n⌞Ana⌝ 🆚 ⌞Beto⌝\n⌞Caro⌝ 🆚 ⌞Dani⌝\n'
         '`[ FINAL ]`\n⌞Ana⌝ 🆚 ⌞Caro⌝\n🥇 CAMPEÓN: Ana')
    # otra distinta
    c = ('`[ OCTAVOS ]`\n⌞Eze⌝ 🆚 ⌞Fer⌝\n⌞Gala⌝ 🆚 ⌞Hugo⌝\n'
         '`[ FINAL ]`\n⌞Eze⌝ 🆚 ⌞Gala⌝')
    mal = 0
    print('\n  la huella del plantel')
    casos = [('una republicada se reconoce', a, b, True),
             ('un evento distinto NO', a, c, False)]
    for que, x, y, esperado in casos:
        ok = (parecido(plantel(x), plantel(y)) >= IGUAL) == esperado
        mal += not ok
        print('   %s %-32s %.2f' % ('✅' if ok else '🔴', que,
                                    parecido(plantel(x), plantel(y))))

    print('\n  qué se escribe y qué va a Pendientes')
    h = {'texto': b, 'guild': '1468472442925092958', 'servidor': 'FFA',
         'fecha': '21/09'}
    filas, dudas, _sab = filas_de(h)
    ok = len(filas) == 3 and all(f['ladoA'] == f['ganador'] for f in filas)
    mal += not ok
    print('   %s 3 batallas de dos lados, escritas' % ('✅' if ok else '🔴'))
    for f in filas:
        print('      %-10s %-8s vs %-8s -> %s'
              % (f['ronda'], f['ladoA'], f['ladoB'], f['ganador']))

    # 🔴 LA DE TRES BANDAS **ENTRA**, EN UNA FILA POR PERDEDOR. Antes se
    # tiraba entera y eso costaba los puntos de los dos lados que
    # perdieron: medido sobre el #349, **6 personas sin su puesto de
    # cuartos**.
    tres = ('`[ CUARTOS ]`\n⌞Ana⌝ 🆚 ⌞Beto⌝ 🆚 ⌞Caro⌝\n⌞Dani⌝ 🆚 ⌞Eze⌝\n'
            '`[ FINAL ]`\n⌞Ana⌝ 🆚 ⌞Dani⌝')
    h3 = dict(h, texto=tres)
    f3, d3, s3 = filas_de(h3)
    de_tres = [f for f in f3 if 'triple' in f['notas']]
    ok = len(de_tres) == 2 and {f['ladoB'] for f in de_tres} == {'Beto', 'Caro'}
    mal += not ok
    print('\n   %s la de tres entra en 2 filas, una por perdedor   %s'
          % ('✅' if ok else '🔴',
             ' · '.join('%s vs %s' % (f['ladoA'], f['ladoB'])
                        for f in de_tres) or 'ninguna'))
    # ⚠️ Y LAS DOS LLEVAN LA NOTA «triple», que es lo que hace que NO
    # entren al `1v1`: una batalla a tres no son dos duelos. La
    # convención ya existía en `resultados._filas_uno()` y el lector
    # nunca la producía.
    ok = all('triple' in f['notas'] for f in de_tres)
    mal += not ok
    print('   %s y llevan la nota «triple», así que no cuentan como duelos'
          % ('✅' if ok else '🔴'))
    for d in d3:
        print('      a Pendientes: %s · %s' % (d[1], d[3]))

    # 🔴 QUE LA FILA ENTRE EN LA HOJA, que es lo que `--aplicar` no
    # probaba. `Entrada` mide 11 columnas y los campos son 9: las dos de
    # la izquierda son el instructivo. Sin este chequeo el error aparece
    # recien el dia que se escribe de verdad.
    # 🔴 EL CASO QUE DLX DESCRIBIO: *«a veces eliminan las llaves x error
    # pero lo vuelven a poner, y eso seria otro mensaje ID»*. Dos
    # mensajes del mismo evento con titulos distintos daban dos nombres
    # -> dos numeros en `Eventos Procesados` -> el evento contado dos
    # veces. Y `procesar_entrada` dice que ese es el unico error de la
    # cadena que **no se arregla volviendo a correr**.
    print('\n  una llave reposteada es UN evento, no dos')
    # ⚠️ LA COPIA NO ES IDENTICA, Y ESO ES EL CASO. Se repostea porque
    # la primera salió mal o incompleta, así que el plantel cambia un
    # poco — acá la repostada suma a Eva, que faltaba. Con planteles
    # IDÉNTICOS el parecido da 1,0 y agruparían con **cualquier**
    # umbral: el chequeo pasaría sin depender de `IGUAL`, que es
    # justo lo que la constante decide. Lo destapó
    # `herramientas/chequeo_que_no_chequea.py`.
    cuerpo = ('`[ SEMIFINALES ]`\n⌞Ana⌝ 🆚 ⌞Beto⌝\n⌞Caro⌝ 🆚 ⌞Dani⌝\n'
              '`[ FINAL ]`\n⌞Ana⌝ 🆚 ⌞Caro⌝\nCAMPEON: Ana')
    cuerpo2 = ('`[ CUARTOS ]`\n⌞Eva⌝ 🆚 ⌞Beto⌝\n' + cuerpo)
    # ⚠️ EL GUILD ES EL DE FFA Y SALE DE `datos/servidores.json`, igual
    # que en el camino real. Con un guild vacío `filas_de()` se va por
    # la rama de la duda y no escribe **ninguna** fila, con lo cual el
    # chequeo pasaba sin haber mirado lo que dice mirar — el conteo daba
    # `0 -> 0` y se leía como ✅.
    ffa = '1468472442925092958'
    dos = [{'texto': 'COPA DEL BARRIO VOL.3\n' + cuerpo,
            'guild': ffa, 'servidor': 'FFA', 'fecha': '01/01'},
           # la repostada: mismo evento, encabezado distinto, y con la
           # ronda que le faltaba a la primera
           {'texto': 'RESUBIDO\nCOPA DEL BARRIO VOL.3\n' + cuerpo2,
            'guild': ffa, 'servidor': 'FFA', 'fecha': '01/01'}]
    gs = agrupar(dos)
    casos = [('las dos se agrupan como un solo evento', len(gs) == 1)]
    if len(gs) == 1:
        nom = nombre_de(gs[0])
        crudo = [titulo(h['texto']) for h in gs[0]['llaves']]
        casos.append(('y los títulos crudos NO coinciden (%s)'
                      % ' / '.join(x[:16] for x in crudo),
                      len(set(crudo)) > 1))
        f1, _, _ = filas_de(gs[0]['llaves'][0], nombre=nom)
        f2, _, _ = filas_de(gs[0]['llaves'][1], nombre=nom)
        casos.append(('las dos escriben el mismo nombre de evento',
                      len({x['evento'] for x in f1 + f2}) == 1))
        # la repostada es un superconjunto: trae las mismas batallas
        # más la ronda que faltaba. Al unirlas tiene que quedar
        # exactamente la repostada, ni una batalla repetida ni una
        # perdida.
        unidas = sin_repetir(f1 + f2)
        casos.append(('las batallas no se cuentan dos veces (%d -> %d)'
                      % (len(f1 + f2), len(unidas)),
                      len(unidas) == len(f2) < len(f1 + f2)))
        casos.append(('y la ronda que sólo traía la repostada se queda',
                      any(x['ronda'] == 'cuartos' for x in unidas)))
        # 🔴 LA FECHA ES LA OTRA MITAD DE LA CLAVE. Con el nombre común
        # pero una fecha por mensaje, `numeros_por_evento()` vuelve a
        # ver dos eventos: el arreglo se mudaba un campo a la derecha.
        g2 = {'llaves': [
            {'texto': dos[0]['texto'], 'guild': ffa,
             'cuando': '2026-09-10T20:00:00+00:00'},
            {'texto': dos[1]['texto'], 'guild': ffa,
             'cuando': '2026-09-13T04:00:00+00:00'}]}
        fec = fecha_de(g2)
        casos.append(('y la fecha del grupo es la del posteo original '
                      '(%s, no 13/09)' % fec, fec == '10/09'))
        fs = {x['fecha'] for h in g2['llaves']
              for x in filas_de(h, nombre='X', fecha=fec)[0]}
        casos.append(('las dos escriben esa misma fecha', fs == {'10/09'}))
    for que, ok in casos:
        mal += not ok
        print('   %s %s' % ('✅' if ok else '🔴', que))

    # 🔴 EL CORTE DE TEMPORADA, EN LOS DOS SENTIDOS. Probar sólo que
    # deja afuera lo viejo no distingue el filtro que anda del filtro
    # que se come todo: hoy las dos versiones dicen «0 llaves», porque
    # las 25 que hay son de la pre.
    print('\n  el corte de temporada')
    ini = TEMP.INICIO
    antes = ini.replace('2026-09-22', '2026-09-21')
    despues = ini.replace('T00:00:00', 'T12:00:00')
    dentro, fuera = de_esta_temporada([
        {'cuando': antes}, {'cuando': despues}, {'cuando': ini},
        {'cuando': ''}, {},
    ])
    casos = [
        ('lo de después entra', len(dentro) == 2),
        ('lo de antes queda afuera', fuera == 3),
        ('el instante exacto del inicio entra',
         any(h['cuando'] == ini for h in dentro)),
        # ⚠️ SIN FECHA NO ENTRA: no se puede ubicar en ninguna
        # temporada, y el beneficio de la duda es cómo se cuela una
        # llave de la pre.
        ('sin fecha NO entra',
         not any((h.get('cuando') or '') == '' for h in dentro)),
        ('y nada se pierde: entran + afuera = todas',
         len(dentro) + fuera == 5),
    ]
    for que, ok in casos:
        mal += not ok
        print('   %s %s' % ('✅' if ok else '🔴', que))

    print('\n  sin campeón no se suma: ¿terminó o sigue?')
    ahora = datetime.datetime(2026, 9, 24, 12, 0,
                              tzinfo=datetime.timezone.utc)
    g_viejo = {'llaves': [{'cuando': '2026-09-23T03:26:17.654000+00:00',
                           'editado': ''}]}
    g_editado = {'llaves': [{'cuando': '2026-09-23T03:26:17+00:00',
                             'editado': '2026-09-24T10:00:00+00:00'}]}
    casos = [
        ('con la final y su ganador, hay campeón',
         tiene_campeon([{'ronda': 'final', 'ganador': 'Ana'}])),
        ('la semi ganada NO es campeón',
         not tiene_campeon([{'ronda': 'semifinales', 'ganador': 'Ana'}])),
        ('la final sin ganador NO es campeón',
         not tiene_campeon([{'ronda': 'final', 'ganador': ''}])),
        ('publicada hace 32 h y sin tocar: terminó',
         horas_quieta(g_viejo, ahora) >= QUIETA_H),
        ('editada hace 2 h: manda la edición, sigue en curso',
         abs(horas_quieta(g_editado, ahora) - 2.0) < 1e-6),
        ('sin ninguna hora: None, y quien llama la da por quieta',
         horas_quieta({'llaves': [{'cuando': '', 'editado': ''}]},
                      ahora) is None),
    ]
    for que, ok in casos:
        mal += not ok
        print('   %s %s' % ('✅' if ok else '🔴', que))

    print('\n  la Parte 2 de la guía: pokemon, invitado, draft, fases')
    hp = dict(h, texto=('`[ SEMIFINALES ]`\n⌞Ana⌝ 🆚 ⌞Beto⌝\n⌞Caro⌝ 🆚 ⌞Dani⌝\n'
                        '`[ FINAL ]`\n⌞Ana⌝ ⌞Beto (P)⌝ 🆚 ⌞Caro⌝ ⌞Eze⌝\n'
                        '🥇 CAMPEÓN: Ana + Beto'))
    fp = marcar_revividos(marcar_walkins(marcar_pokemones(
        filas_de(hp)[0], [hp['texto']]), [hp['texto']]), [hp['texto']])
    fin = [f for f in fp if f['ronda'] == 'final']
    notas = ' '.join(f['notas'] for f in fp)
    # ⚠️ EN DUPLAS, que es como se escribe una absorción: en un 1v1 el que
    # pierde y reaparece con el ganador deja la batalla sin ganador —los
    # dos «pasan»— y no hay derrota que conservar
    dr = dict(h, texto=('# DRAFT KINGS\n`[ CUARTOS ]`\n⌞Ana⌝ ⌞Fer⌝ 🆚 ⌞Beto⌝ ⌞Gus⌝\n'
                        '⌞Caro⌝ ⌞Hugo⌝ 🆚 ⌞Dani⌝ ⌞Ivan⌝\n`[ FINAL ]`\n'
                        '⌞Ana⌝ ⌞Fer⌝ ⌞Beto⌝ 🆚 ⌞Caro⌝ ⌞Hugo⌝ ⌞Dani⌝\n'
                        '🥇 CAMPEÓN: Ana + Fer + Beto'))
    fd = marcar_revividos(filas_de(dr)[0], [dr['texto']])
    rv = dict(dr, texto=dr['texto'].replace('# DRAFT KINGS', '# COPA'))
    fr = marcar_revividos(filas_de(rv)[0], [rv['texto']])
    wk = ('`[ CUARTOS ]`\n⌞Ana⌝ 🆚 ⌞Beto⌝\n⌞Caro⌝ 🆚 ⌞Dani⌝\n`[ SEMIFINALES ]`\n'
          '⌞Ana⌝ 🆚 ⌞Konan⌝\n`[ FINAL ]`\n⌞Konan⌝ 🆚 ⌞Caro⌝\n'
          'INVITADO DE HONOR: Konan\n🥇 CAMPEÓN: Konan')
    fw = marcar_walkins(filas_de(dict(h, texto=wk))[0], [wk])
    casos = [
        ('el pokemon de la final queda anotado en esa fila',
         len(fin) == 1 and 'Pokemon: Beto' in fin[0]['notas']),
        ('y no se lo cuenta como revivido (§10.3)', 'Revivido' not in notas),
        ('el pokemon no suma al plantel',
         plantel(hp['texto']) == {'ana', 'beto', 'caro', 'dani', 'eze'}
         and plantel('`[ CUARTOS ]`\n⌞Ana⌝ 🆚 ⌞Beto⌝\n`[ FINAL ]`\n⌞Ana⌝ 🆚 '
                     '⌞Zzz (P)⌝') == {'ana', 'beto'}),
        ('el paréntesis no inventa gente: `gekto(chianluka+makma)`',
         plantel('`[ CUARTOS ]`\n⌞gekto(chianluka)⌝ 🆚 ⌞Makma⌝\n`[ FINAL ]`\n'
                 '⌞gekto(chianluka+makma)⌝ 🆚 ⌞nhp⌝')
         == {'gekto', 'makma', 'nhp', 'chianluka'}),
        ('y el que está adentro escrito distinto no se cuenta dos veces',
         plantel('`[ CUARTOS ]`\n⌞SAITO(blody)⌝ 🆚 ⌞Bloody⌝\n`[ FINAL ]`\n'
                 '⌞SAITO⌝ 🆚 ⌞Ana⌝') == {'saito', 'bloody', 'ana'}),
        ('en un draft, el que vuelve en un equipo es drafteado',
         'Drafteado: Beto' in ' '.join(f['notas'] for f in fd)),
        ('sin draft, el mismo caso es revivido',
         'Revivido: Beto' in ' '.join(f['notas'] for f in fr)),
        ('el invitado de honor no es walk-in (§9.2)',
         not any('Walk-in' in f['notas'] for f in fw)),
        ('filtros con nombres y sin batallas: se descarta',
         fase_sin_batallas('# COPA\nFILTROS\nAna\nBeto\nCaro\nDani\n'
                           'SEMIFINALES\nAna vs Beto\nCaro vs Dani\n'
                           'FINAL\nAna vs Caro') == 'FILTROS'),
        ('filtros CON batallas: cuenta',
         fase_sin_batallas('FILTROS\nAna vs Beto\nCaro vs Dani\n'
                           'FINAL\nAna vs Caro') is None),
        ('una fase cypher con gente: se descarta',
         fase_sin_batallas('FASE CYPHER\n<@1> <@2> <@3>\nFINAL\nAna vs Beto')
         == 'CYPHER'),
        ('un evento que se LLAMA cypher y trae llave: cuenta (§14.2)',
         fase_sin_batallas('CYPHER KINGS VOL 2\nAna, Beto, Caro, Dani\n'
                           'SEMIFINALES\nAna vs Beto\nCaro vs Dani\n'
                           'FINAL\nAna vs Caro') is None),
        ('los inscriptos antes de la primera ronda no son una fase',
         fase_sin_batallas('# COPA\nInscriptos: Ana, Beto, Caro, Dani\n'
                           'SEMIFINALES\nAna vs Beto\nCaro vs Dani') is None),
        ('una llave rumbo al Interserver se reconoce',
         bool(INTERSERVER.search('# CLASIFICATORIO INTER-SERVER'))
         and not INTERSERVER.search('# COPA INTERNACIONAL')),
    ]
    for que, ok in casos:
        mal += not ok
        print('   %s %s' % ('✅' if ok else '🔴', que))

    print('\n  la fila, contra la forma de la hoja')
    try:
        from procesar_entrada import COL_A, CAMPOS as CAMPOS_E
        desplazo = ord(COL_A.upper()) - ord('A')
        ancho = desplazo + len(CAMPOS_E)
        print('   .. la hoja empieza en la columna %s -> %d de relleno'
              % (COL_A, desplazo))
        print('   .. %d relleno + %d campos = %d columnas'
              % (desplazo, len(CAMPOS_E), ancho))
        from escribir import Hoja
        real = Hoja('Entrada').ancho
        ok = ancho == real
        mal += not ok
        print('   %s la hoja mide %d' % ('✅' if ok else '🔴', real))
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ sin credenciales, no se pudo comprobar: %s'
              % str(e)[:50])
    return mal


def main():
    if '--auto' in sys.argv:
        print('\n══ LLAVE -> `Entrada` ══')
        return 1 if _self_check() else 0

    aplicar = '--aplicar' in sys.argv
    print('\n══ LAS LLAVES DE DISCORD, A `Entrada` ══\n')
    s = E.sesion()
    # 🔴 `E.escuchar` Y NO `E.barrer`: la primera elige la cadencia
    # —dirigida casi siempre, completa una vez por dia— y es lo que hace
    # que este paso entre en un ciclo por hora. Ver `escuchar.conocidos()`.
    # Llamar a `barrer` directo anda igual y cuesta 48 s todas las veces.
    hallazgos, info = E.escuchar(s)
    n_ch, n_msg = info['canales'], info['mensajes']
    hallazgos, viejas = de_esta_temporada(hallazgos)
    for h in hallazgos:
        # `escuchar.barrer` devuelve `cuando` en ISO; la hoja usa dd/mm
        h['fecha'] = _ddmm(h.get('cuando'))
    print('   barrido %s · %d canal(es) · %d mensaje(s) · %d llave(s)'
          % ('completo' if info['completo'] else 'dirigido',
             n_ch, n_msg, len(hallazgos)))
    if viejas:
        print('   %d llave(s) de antes del %s: fuera de la %s'
              % (viejas, TEMP.INICIO[:10], TEMP.ACTUAL.upper()))
    print('')

    grupos = agrupar(hallazgos)
    print('   %d llave(s) -> %d evento(s) distintos\n'
          % (len(hallazgos), len(grupos)))

    todas, dudas, sabidas = [], [], collections.Counter()
    en_curso, incompletos, retenidos, descartados = [], [], [], []
    import decidir as DEC
    repes = 0
    for g in grupos:
        # 🔴 UN NOMBRE POR GRUPO Y LAS BATALLAS SIN REPETIR. Ver
        # `nombre_de()` y `sin_repetir()`: dos mensajes del mismo evento
        # daban dos nombres -> dos numeros de evento -> contado dos
        # veces, que es el unico error de esta cadena que no se arregla
        # volviendo a correr.
        nom, fec = nombre_de(g), fecha_de(g)
        del_grupo, d_grupo = [], []
        for h in g['llaves']:
            f, d, sab = filas_de(h, nombre=nom, fecha=fec,
                                 gente_grupo=g['plantel'])
            del_grupo += f
            d_grupo += d
            sabidas.update(sab)
        _txt = [h.get('texto') or '' for h in g['llaves']]
        limpias = marcar_revividos(marcar_walkins(
            marcar_pokemones(sin_repetir(del_grupo), _txt), _txt), _txt)

        # 🔴 SIN CAMPEÓN NO SE SUMA NADA. La guía de formatos de Dlx
        # (23/09/2026) abre con *«esto se decide ANTES de sumar nada»*, y
        # entre los descartes pone «Resultado desconocido» —no se sabe
        # quién ganó la final— y «Bracket incompleto». Hasta el 24/09 se
        # cargaba lo que se pudiera leer y la duda iba a `Pendientes`, o
        # sea que **se sumaba primero y se preguntaba después**: el patrón
        # que la guía denuncia — *«la IA tiende a procesar lo ambiguo en
        # vez de descartarlo»*.
        #
        # ⚠️ Lo destapó una llave de FFA del 23/09 que nadie veía porque
        # `SEMIFINAL` a secas no era un encabezado. Con eso arreglado
        # aparecía «(sin titulo)»: dos cuartos donde no pasaba nadie,
        # gente en semis que no estaba en cuartos y una final ilegible.
        # Se iban a escribir **3 filas**, o sea puntos de cuartos para tres
        # personas de un evento que la guía descarta entero.
        #
        # ⚠️ Y NO ES LO MISMO «TODAVÍA NO» QUE «NUNCA». La llave se va
        # completando durante la noche, así que una sin final puede estar
        # en curso: esa espera sin sumar y sin ir a `Pendientes` —no es
        # una duda, es un evento que no terminó—. Recién cuando lleva
        # `QUIETA_H` horas sin que nadie la toque pasa a ser un
        # `Bracket incompleto`, que es un tipo que la hoja ya tenía.
        #
        # ⚠️ Sólo en servidores que CUENTAN: las llaves de los de
        # `solo_identidad` no dan filas por diseño, y sin esto cada una
        # parecería un evento sin campeón.
        ligas = [codigo_servidor(h.get('guild'))[0] for h in g['llaves']
                 if codigo_servidor(h.get('guild'))[1] == 'liga']
        # 🔴 LO QUE LA GUÍA NO DEJA SUMAR SE RETIENE ENTERO, antes de
        # preguntar por el campeón: una fase previa sin batallas descarta
        # el evento (Parte 2, §12) y una llave rumbo al Interserver usa
        # otro sistema de puntos (§11.2) — *«preguntá para cuál de los
        # dos rankings es»*.
        # 🔑 LO QUE DLX DECIDIÓ EN ✅ DECIDIR MANDA. «No cuenta» no se suma
        # nunca —aunque después alguien complete la llave—, y «cuenta»
        # destraba un evento retenido por Interserver o por una fase sin
        # batallas. Ver `sheet/decidir.py`.
        dec = DEC.decision_evento(nom, ligas[0], fec) if ligas else None
        if dec == 'no cuenta':
            descartados.append((nom, ligas[0], fec))
            continue
        motivo = None
        for h in g['llaves']:
            t = h.get('texto') or ''
            fase = fase_sin_batallas(t)
            if fase:
                motivo = ('la fase %s lista gente sin mostrar batallas: la '
                          'guía (Parte 2, §12) descarta el evento entero'
                          % fase.lower())
                break
            if INTERSERVER.search(t):
                motivo = ('es una llave rumbo al Interserver, que tiene su '
                          'propio sistema de puntos (guía, Parte 2, §11.2): '
                          '¿cuenta también para el Ranking Global?')
                break
        if ligas and motivo and dec != 'cuenta':
            retenidos.append((nom, ligas[0], fec, motivo))
            continue
        if ligas and not tiene_campeon(limpias):
            hq = horas_quieta(g)
            if hq is not None and hq < QUIETA_H:
                en_curso.append((nom, hq))
            else:
                incompletos.append((nom, ligas[0], fec,
                                    ['%s: %s' % (d[1].lower(), d[2])
                                     for d in d_grupo]))
            continue
        dudas += d_grupo
        repes += len(del_grupo) - len(limpias)
        todas += limpias
    if repes:
        print('   %d batalla(s) repetida(s) entre mensajes del mismo '
              'evento: se cuentan una vez\n' % repes)

    # ⚠️ UNA FILA POR EVENTO, NO POR BATALLA. Una persona revisa un
    # evento, no una batalla suelta: veinte avisos de la misma llave
    # son un aviso.
    por_evento = collections.defaultdict(list)
    for ev, ronda, quienes, razon in dudas:
        por_evento[ev].append('%s: %s' % (ronda.lower(), quienes))

    print('   %d fila(s) para `Entrada`' % len(todas))
    print('   %d evento(s) a `Pendientes`   (de %d batalla(s) sin resolver)'
          % (len(por_evento), len(dudas)))
    print('\n   -- limitaciones conocidas: se cuentan, NO se encolan --')
    for k, v in sabidas.most_common():
        print('     %-46s %d' % (k[:46], v))
    if por_evento:
        print('\n   -- lo que SI va a Pendientes --')
        for ev, cosas in list(por_evento.items())[:8]:
            print('     %-32s %d batalla(s)' % (ev[:32], len(cosas)))
    if en_curso:
        print('\n   -- en curso: sin campeón todavía, no se suma hasta la '
              'final --')
        for ev, hq in en_curso:
            print('     %-32s tocada hace %.1f h' % (ev[:32], hq))
    if incompletos:
        print('\n   -- Bracket incompleto: sin campeón y quieta %d h o más '
              '-> NO se suma, va a Pendientes --' % QUIETA_H)
        for ev, sv_i, fec_i, _c in incompletos:
            print('     %-32s %s · %s' % (ev[:32], sv_i, fec_i))
    if descartados:
        print('\n   -- Dlx dijo que no cuentan (✅ Decidir) --')
        for ev, sv_i, fec_i in descartados:
            print('     %-32s %s · %s' % (ev[:32], sv_i, fec_i))
    if retenidos:
        print('\n   -- retenidos: la guía no deja sumarlos --')
        for ev, sv_i, fec_i, mot in retenidos:
            print('     %-32s %s · %s\n        %s' % (ev[:32], sv_i, fec_i,
                                                   mot))

    if not aplicar:
        print('\n   (simulacro: no escribí nada — corré con --aplicar)\n')
        return 0

    from escribir import Hoja
    import pendientes as P
    # 🔴 LAS NUEVE COLUMNAS EMPIEZAN EN LA `C`, NO EN LA `A`. `Entrada`
    # mide **once** (A..K): la `A` es la columna del instructivo y la `B`
    # un separador. `Hoja.agregar()` escribe desde la A, asi que mandar
    # las nueve tal cual las corre dos lugares a la izquierda — el evento
    # caeria en la columna del instructivo y `procesar_entrada`, que lee
    # `C:K`, leeria todo desplazado.
    #
    # ⚠️ NO HABRIA ESCRITO BASURA, PERO SI HABRIA REVENTADO: `agregar()`
    # compara contra `self.ancho` y levanta. O sea que `--aplicar` estaba
    # roto de entrada y no se veia, porque es el unico camino de este
    # script que nunca se ejecuto. Un `--aplicar` sin probar es codigo que
    # se estrena el dia que mas importa.
    #
    # ⚠️ EL RELLENO SE CALCULA DE `COL_A`, no se escribe un 2. Si mañana
    # la hoja gana o pierde una columna a la izquierda, esto la sigue.
    from procesar_entrada import COL_A, CAMPOS as CAMPOS_E
    h = Hoja('Entrada')
    desplazo = ord(COL_A.upper()) - ord('A')
    filas_hoja = [[''] * desplazo + [f[c] for c in CAMPOS_E] for f in todas]
    ancho = desplazo + len(CAMPOS_E)
    if ancho != h.ancho:
        sys.exit('`Entrada` mide %d columnas y estas armando %d '
                 '(%d de relleno + %d campos). No escribo nada.'
                 % (h.ancho, ancho, desplazo, len(CAMPOS_E)))
    # 🔴 LA SEGUNDA GUARDA CONTRA LA DUPLICACION: no se vuelve a pegar
    # una batalla que YA esta en `Entrada`.
    #
    # `sin_repetir()` limpia dentro de la tanda que se acaba de leer, y
    # eso no alcanza: el lector **agrega**, asi que la corrida siguiente
    # trae las mismas llaves —Discord las sigue mostrando— y quedan dos
    # veces en la hoja. Medido el 23/09/2026: el evento #350 paso de 7
    # duelos a 14 entre dos corridas, y las batallas de 29 a 42.
    #
    # ⚠️ EL CICLO YA VACIA `Entrada` CON `--limpiar`, asi que esto es la
    # red de abajo: si esa limpieza falla una vez, sin esto la corrida
    # siguiente duplica igual. Un error que se COMPONE no puede depender
    # de una sola guarda.
    #
    # ⚠️ La clave es la misma que usa `sin_repetir()` —evento, ronda y
    # los dos lados— y no la fila entera: el `ganador` puede corregirse
    # en una repostada, y esa correccion tiene que poder entrar.
    def _clave(f):
        return (str(f.get('evento', '')).strip(),
                str(f.get('ronda', '')).strip().lower(),
                str(f.get('ladoA', '')).strip(),
                str(f.get('ladoB', '')).strip())

    ya = set()
    for f in h.filas():
        f = list(f) + [''] * (desplazo + len(CAMPOS_E))
        d = dict(zip(CAMPOS_E, [str(x).strip() for x in f[desplazo:]]))
        ya.add(_clave(d))
    nuevas = [f for f in todas if _clave(f) not in ya]
    if len(nuevas) != len(todas):
        print('   ⓘ %d batalla(s) ya estaban en `Entrada`: no se repiten'
              % (len(todas) - len(nuevas)))
    if nuevas:
        filas_hoja = [[''] * desplazo + [f[c] for c in CAMPOS_E]
                      for f in nuevas]
        h.agregar(filas_hoja, dry=False)
        print('   ✅ %d fila(s) en `Entrada`' % len(nuevas))
    else:
        print('   ✅ nada nuevo para `Entrada`')
    # ⚠️ TODO EN UN LOTE: una lectura de la cola y un pedido, no uno por
    # evento. Ver `pendientes.anotar_varios()`.
    lote = [('Llave sin resolver', 'llaves de Discord', ev,
             ' | '.join(cosas[:4])) for ev, cosas in por_evento.items()]
    # ⚠️ EL DETALLE LLEVA SERVIDOR Y FECHA, no sólo el nombre: la cola no
    # duplica por (tipo, detalle), y dos llaves sin título son dos eventos
    # que con el nombre solo se volverían una fila.
    lote += [('Evento dudoso', 'llaves de Discord',
              '%s · %s · %s' % (ev, sv_i, fec_i), mot + '. NO se sumó nada.')
             for ev, sv_i, fec_i, mot in retenidos]
    lote += [('Bracket incompleto', 'llaves de Discord',
              '%s · %s · %s' % (ev, sv_i, fec_i),
              ' | '.join(['sin campeón y sin tocar hace %d h o más: la '
                          'guía (Parte 1) lo descarta y NO se sumó nada. Si '
                          'cuenta, completá la final en la llave' % QUIETA_H]
                         + cosas[:3]))
             for ev, sv_i, fec_i, cosas in incompletos]
    if lote:
        k = P.anotar_varios(lote)
        print('   ✅ %d nueva(s) en `Pendientes` (%d ya estaban)'
              % (k, len(lote) - k))
    # 🔴 ERA `todas_dudas`, QUE NO EXISTE — y la variable de verdad es
    # `dudas`. `NameError` en la ULTIMA linea del camino `--aplicar`, o
    # sea **despues** de escribir en `Entrada` y de anotar en
    # `Pendientes`: no se perdia nada, pero el script salia con **1**.
    #
    # ⚠️ Y ESO ES PEOR QUE PERDER ALGO, porque el ciclo lo corre cada hora
    # y `bot/pipeline.py` lo reporta como «⚠️ el lector salió con 1 (no
    # frena el ciclo)». Un aviso que aparece SIEMPRE no distingue el dia
    # que el lector falle de verdad. Medido el 22/09/2026: salia con 1 en
    # todas las corridas desde que existe el paso 1.
    #
    # ⚠️ Y NO LO ENCONTRABA NADIE porque el camino sin `--aplicar` no pasa
    # por aca: `python bot/llaves_a_entrada.py` a secas sale con 0. El
    # simulacro ejercita el camino que no importa — es la misma leccion
    # que el `sys.path` de `sheet/` en `pipeline.py`.
    print('   ✅ %d duda(s) en `Pendientes`\n' % len(dudas))
    return 0


if __name__ == '__main__':
    sys.exit(main())
