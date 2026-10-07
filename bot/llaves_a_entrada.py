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

    🔴 EN HORA DEL ESTE, NO EN UTC. Discord da el instante en UTC y esto
    lo cortaba ahí, así que un evento de las 10:25 PM ET del 23/09 quedaba
    del 24/09 (CARABOBO NO SE RINDE VOL.1, auditoría del 25/09/2026). Y la
    fecha no es sólo lo que se lee: es la mitad de la IDENTIDAD del evento
    —`procesar_entrada.numeros_por_evento()`— y lo que ordena la racha.
    """
    if not iso:
        return ''
    try:
        t = datetime.datetime.fromisoformat(str(iso).replace('Z', '+00:00'))
    except (ValueError, TypeError):
        return ''
    if t.tzinfo is None:
        t = t.replace(tzinfo=datetime.timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        et = ZoneInfo('America/New_York')
    except Exception:                                    # noqa: BLE001
        et = datetime.timezone(datetime.timedelta(hours=-4))
    return t.astimezone(et).strftime('%d/%m')


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


#: una bandera con un nombre antes y otro después: ahí va un «+»
_BANDERA_ENTRE = re.compile('([^\\s\U0001F1E6-\U0001F1FF]\\s*(?:[\U0001F1E6-\U0001F1FF]{2})+)'
                            '\\s+(?=[^\\s\U0001F1E6-\U0001F1FF+&,/(])')


def con_mas(texto):
    """La inscripción de una pareja escrita con banderas, como equipo.

    🔴 «27 🇺🇸 Piyi 🇲🇽» (FFA, 28/09/2026) son DOS: la llave de la VOL 16 2VS2
    los escribe «[27 🇺🇸 + PIYI 🇲🇽]». Como candidato de la canonización sin
    «+», convertía al equipo en una persona. La bandera del final no separa
    («TEAM VENECIA 🇲🇦 🇻🇪», «Garxziiscity 🇦🇿🇲🇽 🇻🇪🇦🇷») ni la de adelante
    («🇦🇷 DELUXE»): sólo la que tiene un nombre a cada lado. Es la misma regla
    que `decidir._ENTRE_BANDERAS`.
    """
    return _BANDERA_ENTRE.sub(r'\1 + ', str(texto or ''))


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
                        d.setdefault(x.get('servidor') or '', []).append(con_mas(t))
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


def ids_de(hallazgo):
    """`{discord_id: [nombres]}`: el padrón y lo que Discord trae con cada
    mención de ese mensaje. Ver `escuchar.menciones_de()`."""
    ids = ids_del_padron()
    if hallazgo and hallazgo.get('menciones'):
        ids = dict(ids)
        for did, ns in hallazgo['menciones'].items():
            ya = list(ids.get(did) or [])
            ids[did] = ya + [n for n in ns if n not in ya]
    return ids


#: las personas de cada nombre que no dependen del servidor (la Lista y los AKAs), y las de cada servidor
_PERS = [None]
_PERS_SV = {}
_CORTOS = [None]


def _cortos_a_mano():
    """Los nombres de 1 y 2 letras que Dlx dijo de quién son (`pares` de `akas_a_mano.json`): ésos sí se reconocen.

    «za» es Provenza (Dlx, 04/10/2026, «2. A»), y `personas()` lo descartaba por corto: en la DEM UZBEKISTAN (FFA,
    06/10) Provenza ganó sus cuartos como «za» y salía «Walk-in 2» en semis, como si no hubiera jugado. La regla de
    los nombres cortos es contra adivinar; un par escrito por Dlx no es una adivinanza.
    """
    if _CORTOS[0] is None:
        try:
            pares = json.load(io.open(os.path.join(BASE, 'datos', 'akas_a_mano.json'),
                                      encoding='utf-8')).get('pares') or []
        except Exception:                                # noqa: BLE001
            pares = []
        _CORTOS[0] = {E.norm(n) for p in pares for n in p if 0 < len(E.norm(n)) < 3}
    return _CORTOS[0]


def _personas_base():
    """`(idx, de_la_lista)`: `{nombre normalizado: {persona}}` de la Lista y los AKAs, y qué personas son de la
    Lista. Una persona es `id:<Discord ID>`, o `n:<nombre>` si la Lista no tiene su cuenta. Se cachea."""
    if _PERS[0] is None:
        idx, lista = collections.defaultdict(set), set()
        try:
            import construir_padron as PAD
            filas = PAD.cargar() or []
        except Exception:                                # noqa: BLE001
            filas = []
        for x in filas:
            p = ('id:%s' % x['discord_id']) if x.get('discord_id') else ('n:%s' % E.norm(x.get('raw') or ''))
            if p in ('n:', 'id:'):
                continue
            lista.add(p)
            for n in (x.get('raw'), x.get('full')):
                if E.norm(n):
                    idx[E.norm(n)].add(p)
        try:
            import construir_akas as AK
            mapa = (AK.cargar() or {}).get('alias') or {}
        except Exception:                                # noqa: BLE001
            mapa = {}
        for a in mapa:
            # siguiendo la cadena, como `ids_del_padron()`
            vis, k = set(), E.norm(a)
            while k in mapa and k not in vis:
                vis.add(k)
                k = E.norm(mapa[k])
            reales = {p for p in idx.get(k) or () if p in lista}
            if len(reales) == 1 and E.norm(a):
                idx[E.norm(a)] |= reales
        _PERS[0] = (idx, lista)
    return _PERS[0]


def _inscripciones_solas(sv):
    """`{nombre normalizado: {id:<cuenta>}}`: con qué nombre se anotó cada cuenta en el servidor `sv`.

    ⚠️ SÓLO LAS DE UN NOMBRE, Y NO LAS DE QUIEN ANOTA A OTROS: es la regla de `decidir._inscritos()`. Una
    inscripción de pareja no dice quién es quién, y una cuenta que se anotó con dos nombres distintos («Player» y
    «Steven», desde la del organizador) está anotando gente, no a sí misma. Dos grafías del mismo sí valen.
    """
    if sv not in _PERS_SV:
        try:
            import decidir as D
            with io.open(os.path.join(BASE, 'datos', 'anuncios.json'), encoding='utf-8') as f:
                ins = (json.load(f) or {}).get('inscripciones') or []
        except (OSError, ValueError, ImportError):
            ins, D = [], None
        por = collections.defaultdict(list)
        for x in ins:
            did = str(x.get('discord_id') or '')
            if D is None or (x.get('servidor') or '') != sv or not did.isdigit():
                continue
            t = re.sub(r'\(.*?\)|\(.*$', ' ', str(x.get('texto') or ''))
            partes = [q for p in D._SEP_INSC.split(t) for q in D._ENTRE_BANDERAS.split(p)]
            ns = [E.norm(p) for p in partes if len(E.norm(p)) >= 2]
            if len(ns) == 1:
                por[did].append(ns[0])
        out = collections.defaultdict(set)
        for did, ns in por.items():
            corto = min(ns, key=len)
            if all(corto in n for n in ns):
                for n in ns:
                    out[n].add('id:%s' % did)
        _PERS_SV[sv] = out
    return _PERS_SV[sv]


def personas(sv='', menciones=None):
    """`quien(nombre) -> frozenset de personas`: de quién es un nombre de llave, con lo que el sistema SABE.

    🔑 Dlx, 02/10/2026: *«te dije múltiples vías para detectar quiénes participan… esto es lo más difícil de este
    sistema, reconocer a las personas, y más cuando hacen esas cosas troll»*. La DOS GENERACIONES UN DESTINO VOL 2
    (FFA, 01/10) lo mostró: Oasis jugó octavos como «Park-Ji Sung🇰🇷» y cuartos como «Oasis🇨🇱», y el lector no los
    unía —el campeón salió walk-in y cobró la mitad—, cuando la hoja AKAs ya decía que eran el mismo y la inscripción
    «Park-Ji Sung🇰🇷» la había escrito su cuenta.

    Los nombres de una persona salen de cuatro lugares, y ninguno es un parecido:

        la Lista            su nombre y su nombre completo
        la hoja AKAs        sus alias, siguiendo la cadena
        las inscripciones   la de su propia cuenta en ESE servidor (`_inscripciones_solas()`)
        las menciones       lo que Discord trae de cada `<@ID>` del mensaje

    ⚠️ UN NOMBRE DE DOS PERSONAS DE LA LISTA NO ES DE NINGUNA: devuelve vacío y la llave se lee como antes. Una
    persona de la Lista sin cuenta (`n:`) y la cuenta que se anotó con ese nombre (`id:`) sí van juntas: es la
    misma regla que `decidir._se_anoto_como()`.
    ⚠️ LOS NOMBRES DE 1 Y 2 LETRAS NO: «7» y «27» existen, y se parecen a demasiado. Salvo los que Dlx dijo de
    quién son (`_cortos_a_mano()`: «za» es Provenza).
    """
    idx, lista = _personas_base()
    insc = _inscripciones_solas(sv or '')
    men = collections.defaultdict(set)
    for did, ns in (menciones or {}).items():
        for n in ns or ():
            if E.norm(n):
                men[E.norm(n)].add('id:%s' % did)

    def quien(nombre):
        k = E.norm(nombre)
        if len(k) < 3 and k not in _cortos_a_mano():
            return frozenset()
        ps = set(idx.get(k) or ()) | set(insc.get(k) or ()) | set(men.get(k) or ())
        if len(ps & lista) > 1:
            return frozenset()
        return frozenset(ps)
    return quien


def _ms_de(iso):
    """Un ISO (UTC si no dice zona) a milisegundos, o `None`."""
    try:
        t = datetime.datetime.fromisoformat(str(iso).replace('Z', '+00:00'))
    except (TypeError, ValueError):
        return None
    if t.tzinfo is None:
        t = t.replace(tzinfo=datetime.timezone.utc)
    return int(t.timestamp() * 1000)


def _iso_de(ms):
    return datetime.datetime.fromtimestamp(int(ms) / 1000.0, datetime.timezone.utc).isoformat(timespec='seconds')


def llave_de_veredictos_para(g, llaves_v=None):
    """La llave de #veredictos que es ESTE evento y está completa, o `None`. Ver `hallazgo_de_veredicto()`.

    Tiene que ser del mismo servidor, de entre 3 horas antes de la llave y 6 después de su último toque, con la mayoría
    de la gente en común (`escuchar.veredicto_de()`), con su final decidida (`escuchar.completa()`), y tiene que
    EMPEZAR donde empieza la llave del organizador: la misma primera ronda, con al menos 3 de cada 4 de sus batallas.
    Una de veredictos que arrancó a mitad del evento dejaría afuera las primeras rondas. Si dos sirven, ninguna.
    """
    lls = llaves_v if llaves_v is not None else E._VER_LLAVES[0]
    if not lls or not g.get('llaves'):
        return None
    guild = g['llaves'][0].get('guild')
    sv = codigo_servidor(guild)[0]
    ts = [x for h in g['llaves'] for x in (_ms_de(h.get('cuando')), _ms_de(h.get('editado'))) if x]
    if not ts:
        return None
    q = personas(sv, {d: n for h in g['llaves'] for d, n in (h.get('menciones') or {}).items()})
    cands = [V for V in lls if E.completa(V) and
             E.veredicto_de(V, list(g.get('plantel') or ()), guild, min(ts) - 3 * 3600000, max(ts) + 6 * 3600000,
                            quien=q)]
    if len(cands) != 1:
        return None
    V = cands[0]
    rs = [r for h in g['llaves'] for r in E.rondas_de(h.get('texto') or '')]
    if rs:
        r0 = E.ALIAS.get(rs[0][0], rs[0][0])
        vr0 = [bt for bt in V['batallas'] if bt[0] == V['batallas'][0][0]]
        if V['batallas'][0][0] != r0 or len(vr0) < 0.75 * len(rs[0][1]):
            return None
    return V


def hallazgo_de_veredicto(V, h0, quien=None, conocidos=None):
    """La llave de #veredictos como un hallazgo más, con sus batallas ya resueltas (`res`). Ver `filas_de()`.

    Del organizador queda lo que la nombra —el servidor, el autor— y el nombre y la fecha del evento los pone el grupo.
    El texto es el de las batallas como se jugaron, con sus rondas: lo leen el plantel, el walk-in y el revivido.

    🔑 Y EL QUE PASA CON OTRO NOMBRE SE LLAMA COMO EN LA RONDA SIGUIENTE, como en `escuchar.resolver()`: en #votaciones
    Oasis también jugó octavos como «Park-Ji Sung🇰🇷». Con `quien` (`personas()`), si el ganador no está en la ronda
    siguiente con su nombre y UNA persona de esa ronda —que nadie de la suya explica por su nombre— es él, es ella.

    🔑 Y CADA NOMBRE, COMO SE ANOTÓ (`conocidos`, la canonización del lector: `escuchar.canonizador()`): en #votaciones
    dice «Kurlw🇦🇷» y la inscripción, «kurl 🇦🇷» —Jult—. Sin esto entraba como alguien nuevo."""
    _c = E.canonizador(conocidos) if conocidos else None

    def c(x):
        return _c(x) if (_c is not None and x) else x
    bats = [[r, [c(x) for x in lados], c(gan), razon, [c(x) for x in (pasan or [])]]
            for r, lados, gan, razon, pasan in V['batallas']]
    if quien is not None:
        idx = {r: E.ORDEN.index(r) for r in {b[0] for b in bats} if r in E.ORDEN}
        for b in bats:
            if not b[2] or b[0] not in idx:
                continue
            sig = [x for bb in bats if idx.get(bb[0], -1) > idx[b[0]] for x in bb[1]]
            if not sig or E.norm(b[2]) in {E.norm(x) for x in sig}:
                continue
            suya = {E.norm(x) for bb in bats if bb[0] == b[0] for x in bb[1]}
            cands = {x for x in sig if E.norm(x) not in suya and quien(b[2]) and quien(b[2]) & quien(x)}
            if len({E.norm(x) for x in cands}) == 1:
                nuevo = sorted(cands)[0]
                b[1] = [nuevo if x == b[2] else x for x in b[1]]
                b[2] = nuevo
    res = [E.Batalla((r, lados, gan, razon), pasan=pasan) if pasan else (r, lados, gan, razon)
           for r, lados, gan, razon, pasan in bats]
    # el texto, con los mismos nombres que las batallas: lo leen el plantel, el walk-in y el revivido
    lineas, ult = [], None
    for r, lados, _g, _r, _p in bats:
        if r != ult:
            lineas.append('`[ %s ]`' % r)
            ult = r
        lineas.append(' 🆚 '.join('⌞%s⌝' % x for x in lados))
    return dict(h0, texto='\n'.join(lineas), res=res, canal_id=V['canal'], msg_id=V['id'],
                cuando=_iso_de(V['pub']), editado=_iso_de(V['ed']), menciones={}, veredicto=True)


def nombre_visible(lado, ids):
    """`[<@750…>🇪🇨]` -> `ricardflex 🇪🇨`: la mención, con su nombre.

    🔴 MARRUECOS EN VENTA escribe sus octavos SÓLO con menciones, y la
    pregunta de ✅ Decidir decía `<@750718442050551858>🇪🇨 vs <@458…>🇺🇾`:
    para contestarla había que ir a buscar a mano quién era cada uno. El
    nombre que va es el del padrón, si esa cuenta está; si no, el de Discord.
    """
    def _n(m):
        ns = (ids or {}).get(m.group(1)) or []
        return ' %s ' % (ns[0] if ns else '@' + m.group(1))
    s = re.sub(r'\s+', ' ', E.MENCION.sub(_n, str(lado or ''))).strip()
    # el nombre del padrón ya trae su bandera: `tormen 🇳🇮 🇳🇮` va una vez
    return re.sub('([\U0001F1E6-\U0001F1FF]{2})(?:\\s*\\1)+', r'\1', s)


def plantel(texto, ids=None):
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
    out, adentro, mencionados = set(), set(), set()
    for _ronda, bats in E.rondas_de(texto):
        for b in bats:
            for n in b:
                # 🔴 UNA MENCIÓN ES ALGUIEN, AUNQUE `norm()` LA BORRE.
                # MARRUECOS EN VENTA escribió sus octavos sólo con `<@…>` y
                # el plantel contaba a los ocho de cuartos: 8 personas, la
                # escala 8-15, cuando jugaron unas 20 (y la guía dice 16+).
                # Se cuenta por su nombre —el del padrón o el de Discord—
                # para no contarla dos veces si la ronda siguiente la
                # escribe con letras.
                # 🔴 Y CON TODOS SUS NOMBRES, NO SÓLO EL PRIMERO. El primero
                # es el de la Lista o el de Discord, y la ronda siguiente la
                # escribe como le parece: en esa misma MARRUECOS, Oasis es
                # «PARK JI-SUNG» en cuartos y `$$hulio↑ ElDojo` es SHULIOT.
                # Comparando sólo el primero se contaban dos veces: 22 donde
                # hubo 20 (28/09/2026). Con 15 reales y un doble, la escala
                # pasa de 8-15 a 16+ y cambian los puntos de todo el evento.
                if not E.norm(_PAREN.sub('', n)) and E.MENCION.search(n):
                    for did in E.MENCION.findall(n):
                        ns = [E.norm(x) for x in (ids or {}).get(did) or []]
                        ns = tuple(k for k in ns if len(k) >= 2)
                        mencionados.add(ns or ('id' + did,))
                    continue
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
    def _ya(k):
        return k in out or E._parecido(k, list(out)) or any(
            min(len(k), len(c)) >= 4 and (c.startswith(k) or k.startswith(c))
            for c in out)

    for ns in sorted(mencionados):
        if ns[0].startswith('id') and len(ns) == 1:
            out.add(ns[0])
        elif not any(_ya(k) for k in ns):
            out.add(ns[0])
    # 🔑 LA FASE DE UNA NAVE DE FUNA ES DE TODOS: los que cayeron no aparecen
    # en ninguna batalla y son la mayoría del evento (ver `escuchar.funa_de()`)
    for n, _cayo in E.funa_de(texto) or ():
        k = E.norm(n)
        if k and not _ya(k):
            out.add(k)
    return out


def filas_funa(filas, fu, texto, base):
    """Las filas de una NAVE DE FUNA: la fase, la final que dice el podio y el tercero.

    🔑 Dlx, 29/09/2026, con tres llaves de ejemplo: la fase es una lista con ❌
    en los que cayeron —por reacciones de Discord, una por ronda de beats— y
    *«lo que sigue está a disposición del organizador»*: final de dos o de
    tres, a veces semis, y el podio (CAMPEÓN / SUBCAMPEÓN / TERCER LUGAR, o
    🥇 🥈 🥉).

      · cada uno que cayó en la fase: una fila `fase de eliminación` con el
        lado que pasa VACÍO —como el grupo del filtro donde no pasó nadie—,
        y el motor los paga juntos (empatan: la llave no dice el orden);
      · sin ❌ en la lista (Anything Goes Vol.15), cayeron todos los que no
        llegaron a la final;
      · la final de TRES se rehace con el podio: campeón contra subcampeón
        (sin duelo, porque fue de tres) y el tercero aparte; la de dos que no
        dice campeón toma el del podio (`🥇 tam`);
      · quien quedó en pie sin llegar a la final (Sombra, en la del 15/5) es
        el tercero si el podio no nombra a otro.

    `base`: los campos de todas las filas (evento, servidor, fecha,
    participantes). Devuelve `(filas, resuelta)`: `resuelta` si la final
    recién ahora tiene campeón, para sacar la duda de «no dice campeón».
    """
    k = lambda x: E.norm(E.HISTORIA.sub('', x or ''))       # noqa: E731
    pl = E.plano(texto or '')
    med = E.medallas_de(texto)
    m = E.SUBCAMPEON.search(pl)
    sub_l = m.group(1) if m else med.get(2)
    ter = next((x for x in E.TERCERO.finditer(pl)
                if E.norm(E.MENCION.sub('', x.group(1)))), None)
    ter_l = ter.group(1) if ter else med.get(3)

    def _cual(linea, entre):
        """El de `entre` que nombra el renglón del podio, si es uno solo."""
        kl = k(linea)
        c = [x for x in entre if kl and k(x) and (k(x) == kl or kl.startswith(k(x)))]
        return c[0] if len(c) == 1 else None

    finales = [f for f in filas if (f.get('ronda') or '').lower() == 'final']
    if finales:
        lados_fin = []
        for f in finales:
            for x in (f.get('ladoA'), f.get('ladoB')):
                if x and k(x) not in [k(y) for y in lados_fin]:
                    lados_fin.append(x)
        camp = next((f.get('ganador') for f in finales if f.get('ganador')), None)
    else:
        # la final sin campeón escrito no dejó fila: sus lados, de la llave
        fin = [b for r, bs in E.rondas_de(texto or '') if r == 'FINAL' for b in bs]
        lados_fin = [E._sin_marcas(x) for x in fin[-1]] if len(fin) == 1 else []
        camp = _cual(med.get(1), lados_fin)
    resuelta, tercero = False, None
    if camp and len(lados_fin) == 3:
        sub = _cual(sub_l, [x for x in lados_fin if k(x) != k(camp)])
        otros = [x for x in lados_fin if k(x) not in (k(camp), k(sub or ''))]
        if sub and len(otros) == 1:
            # la final de tres, con el podio: campeón contra subcampeón y el
            # tercero aparte. Sin duelo: fue de tres.
            filas = [f for f in filas if f not in finales]
            filas.append(dict(base, ronda='final', ladoA=camp, ladoB=sub, ganador=camp,
                              notas='triple (3 bandas); nave de funa: el podio dice el orden'))
            tercero, resuelta = otros[0], not finales
    elif camp and len(lados_fin) == 2 and not finales:
        otro = next(x for x in lados_fin if k(x) != k(camp))
        filas.append(dict(base, ronda='final', ladoA=camp, ladoB=otro, ganador=camp, notas=''))
        resuelta = True
    arriba = {k(x) for f in filas for x in (f.get('ladoA'), f.get('ladoB'), f.get('ganador')) if x}
    arriba |= {k(x) for x in lados_fin}
    hay_ter = any((f.get('ronda') or '').lower() in ('tercer lugar', 'tercer puesto') for f in filas)
    marcas = any(c for _n, c in fu)
    sueltos = [n for n, c in fu if not c and k(n) not in arriba] if marcas else []
    if tercero is None and not hay_ter and camp:
        tercero = _cual(ter_l, sueltos) if ter_l else (sueltos[0] if len(sueltos) == 1 else None)
    if tercero is not None and not hay_ter:
        filas.append(dict(base, ronda='tercer lugar', ladoA=tercero, ladoB='', ganador=tercero,
                          notas='podio: tercer puesto sin batalla en la llave'))
        arriba.add(k(tercero))
    caen = [n for n, c in fu if c] if marcas else [n for n, _c in fu if k(n) not in arriba]
    pasan = len(fu) - len(caen)
    # 🔑 y en qué ronda cayó, si la llave lo dice («ELIMINADO #3», NAVE DE EXTERMINACIÓN, 03/10/2026): va en la nota
    # para que la página lo muestre ronda por ronda (`llaves_web`). Los puntos no cambian: la fase sigue empatada
    rnd = {k(n): r for (n, _c), r in zip(fu, E.funa_rondas(texto) or ()) if r}
    for n in [x for x in sueltos if k(x) not in arriba] + caen:
        if k(n) in arriba:
            continue
        filas.append(dict(base, ronda='fase de eliminación', ladoA='', ladoB=n, ganador='',
                          notas='nave de funa: %s (%d en la fase, pasan %d)'
                          % ('quedó en pie' if n in sueltos else
                             'cayó en la ronda %d' % rnd[k(n)] if k(n) in rnd else 'cayó', len(fu), pasan)))
    return filas, resuelta


def repetidos_en_la_primera(texto):
    """Cuántos lugares de la primera ronda ocupa alguien que ya estaba en ella.

    Es lo que le falta al plantel —que cuenta nombres DISTINTOS— para ser el
    formato de la llave: el que revive aparece dos veces en la misma ronda (la
    guía, §3.7) y ocupa dos lugares. Dlx, 28/09/2026: *«en sí el formato es
    de 16»*. Sólo la primera ronda: ahí están todos los lugares de la llave.
    """
    rs = E.rondas_de(texto or '')
    if not rs:
        return 0
    vistos, extra = set(), 0
    for b in rs[0][1]:
        for lado in b:
            for m in (E._miembros(lado) or [lado]):
                k = E.norm(E.HISTORIA.sub('', m))
                if not k:
                    continue
                if k in vistos:
                    extra += 1
                vistos.add(k)
    return extra


def faltan_en_equipos(texto):
    """Cuántas personas no cuenta el plantel porque la llave nombra a un equipo con UN nombre.

    🔑 DESGRACIAS EN TOKYO VOL 16 2VS2 (FFA, 28/09/2026): siete lados son
    parejas —«[JOTA P + IGUANA]»— y uno es «[TEAM VENECIA 🇲🇦🇻🇪]», dos
    personas con nombre de equipo. El plantel contaba 15 y el formato es de 16
    (8 parejas): con 15 la escala bajaba de «16+» a «8-15» para todos. Es la
    misma regla que `repetidos_en_la_primera()`: la escala sale del FORMATO.

    ⚠️ SÓLO SI LOS DEMÁS LADOS DE LA PRIMERA RONDA SON TODOS DEL MISMO TAMAÑO
    (2, 3…) y son la gran mayoría: en un MULTIVERSE (2v2, 1v3, 8v1) el que va
    solo va solo, y en un 1vs1 no hay equipos.
    """
    solos, k = equipos_con_nombre(texto)
    return len(solos) * (k - 1) if solos else 0


def equipos_con_nombre(texto):
    """Los lados de la primera ronda que son un equipo escrito con UN nombre.

    `([lado tal cual…], cuántos son)`, o `([], 0)`. La regla es la de
    `faltan_en_equipos()`, que la usa para contar: en una llave de parejas
    (o de tríos), el lado de un solo nombre es un equipo con nombre.
    """
    rs = E.rondas_de(texto or '')
    if not rs:
        return [], 0
    tams, solos = [], []
    for b in rs[0][1]:
        for lado in b:
            ms = [m for m in (E._miembros(lado) or [lado]) if E.norm(E.HISTORIA.sub('', m))]
            if ms:
                tams.append(len(ms))
                if len(ms) == 1:
                    solos.append(lado)
    grandes = [t for t in tams if t >= 2]
    if not grandes or len(set(grandes)) != 1 or not solos or len(grandes) < 3 * len(solos):
        return [], 0
    return solos, grandes[0]


#: cuánto antes de la llave vale una inscripción para decir quién es un equipo
EQUIPO_INSC_H = 36
#: «Me tiene sin cuidado🇯🇲🔥(PARIA+KRAVITZ)» · «TEAM X: A + B» · «TEAM X = A y B»
_INSC_EQUIPO = re.compile(r'^(?P<nom>[^(:=\uff08]{2,60}?)\s*(?:[(\uff08](?P<par>[^()\uff08\uff09]+)[)\uff09]'
                          r'|[:=]\s*(?P<pos>.+))\s*$')
_INSC_T = [None]


def _instante(x):
    """Un ISO de Discord o de `anuncios.json` -> datetime UTC sin zona, o None."""
    import datetime as _dt
    try:
        d = _dt.datetime.fromisoformat(str(x or '').replace('Z', '+00:00'))
    except ValueError:
        return None
    return d.replace(tzinfo=None) if d.tzinfo is None else \
        d.astimezone(_dt.timezone.utc).replace(tzinfo=None)


def integrantes_inscritos(equipo, sv, cuando=None, inscripciones=None):
    """Con quiénes se anotó un equipo, según su inscripción; `[]` si no se sabe.

    🔑 «Me tiene sin cuidado🇯🇲🔥(PARIA+KRAVITZ)» (FFA, 25/09/2026): el nombre
    del equipo y, entre paréntesis o después de `:`, quiénes son. Sólo del
    mismo servidor y de las `EQUIPO_INSC_H` horas antes de la llave: un
    nombre de equipo es de ESE evento (Dlx: *«solo un equipo creado x este
    evento»*), y otra noche el mismo nombre puede ser otra gente.
    """
    k = E.norm(E.HISTORIA.sub('', equipo or ''))
    if not k:
        return []
    if inscripciones is None:
        if _INSC_T[0] is None:
            try:
                with io.open(os.path.join(BASE, 'datos', 'anuncios.json'), encoding='utf-8') as f:
                    _INSC_T[0] = (json.load(f) or {}).get('inscripciones') or []
            except (OSError, ValueError):
                _INSC_T[0] = []
        inscripciones = _INSC_T[0]
    import datetime as _dt
    t0 = _instante(cuando)
    for x in inscripciones:
        if (x.get('servidor') or '') != sv:
            continue
        if t0 is not None:
            ti = _instante(x.get('cuando'))
            if ti is None or not (t0 - _dt.timedelta(hours=EQUIPO_INSC_H) <= ti <= t0 + _dt.timedelta(hours=6)):
                continue
        for renglon in str(x.get('texto') or '').splitlines():
            m = _INSC_EQUIPO.match(renglon.strip())
            if not m or E.norm(m.group('nom')) != k:
                continue
            ms = [p.strip() for p in re.split(r'[+,&/]|\s+y\s+', m.group('par') or m.group('pos') or '')
                  if E.norm(p)]
            if len(ms) >= 2:
                return ms
    return []


def marcar_equipos(filas, textos=(), cuando=None, inscripciones=None, decidir=None):
    """El equipo que la llave nombra con UN nombre: cobran sus integrantes, o nadie.

    🔴 «TEAM VENECIA 🇲🇦 🇻🇪» (FFA, DESGRACIAS EN TOKYO VOL 16 2VS2, 28/09/2026)
    entró como UNA persona y cobró la semifinal entera de su pareja: 5.250
    puntos, tarjetas y un lugar en el ranking para alguien que no existe.
    Dlx, 29/09: *«debería reconocer los integrantes del equipo; si no se
    puede, ya fue. Pero TEAM VENECIA no es un participante, es un equipo…
    no una crew ojo… solo un equipo creado x este evento»*.

    Quiénes son, en este orden:
      1. lo que Dlx dijo (`decidir.integrantes_equipo()`);
      2. su inscripción (`integrantes_inscritos()`), si nombra a tantos
         como el formato y ninguno juega además en otro lado de la llave
         —ME TIENE SIN CUIDADO (VOL.13) se anotó como PARIA + KRAVITZ, y la
         llave los pone también como pareja aparte: eso no se adivina—.
    Con integrantes, el lado pasa a ser ellos (`Equipo: nombre` en la nota)
    y cada uno cobra su parte. Sin integrantes, el lado queda como lo
    escribió la llave con `Sin integrantes: lado`: el motor no le paga a
    nadie ni lo trata como un nombre desconocido (`motor.nadie`).

    Devuelve `(filas, [(evento, servidor, fecha, equipo, [integrantes], por_qué)])`.
    """
    equipos = {}
    for t in textos:
        solos, n = equipos_con_nombre(t)
        for lado in solos:
            equipos.setdefault(E.norm(E.HISTORIA.sub('', lado)), (lado, n))
    if not equipos or not filas:
        return filas, []
    # quién juega en OTRO lado de la llave: si la inscripción dice que el
    # equipo son ellos, la llave se contradice
    otros = set()
    for t in textos:
        for _r, bats in E.rondas_de(t):
            for b in bats:
                for lado in b:
                    for m in E._miembros(lado):
                        otros.add(E.norm(E.HISTORIA.sub('', m)))
    # ⚠️ QUIEN JUEGA SOLO NO ES UN EQUIPO: en un 2VS2 al que no le vino la
    # pareja, el lado de un nombre es una PERSONA del padrón o de los AKAs, y
    # cobra como siempre
    try:
        personas = E._personas()
    except Exception:                                    # noqa: BLE001
        personas = set()
    equipos = {k: v for k, v in equipos.items() if k not in personas}
    if not equipos:
        return filas, []
    f0 = filas[0]
    ev, sv, fe = f0.get('evento') or '', f0.get('servidor') or '', f0.get('fecha') or ''
    if decidir is None:
        try:
            import decidir as DEC
            decidir = DEC.integrantes_equipo
        except Exception:                                # noqa: BLE001
            decidir = lambda *a: None
    plan, informe = {}, []
    for k, (crudo, n) in equipos.items():
        nombre = re.sub(r'\s+', ' ', E.HISTORIA.sub('', crudo)).strip()
        ms = decidir(ev, sv, fe, nombre)
        por = 'lo decidió Dlx'
        if ms is None:
            ms = integrantes_inscritos(nombre, sv, cuando, inscripciones)
            por = 'su inscripción'
            if ms and len(ms) != n:
                ms, por = [], 'la inscripción nombra a %d y el formato es de %d' % (len(ms), n)
            elif ms and any(E.norm(E.HISTORIA.sub('', m)) in otros for m in ms):
                ms, por = [], 'la inscripción dice %s, y la llave los pone también en otro lado' % ' + '.join(ms)
            elif not ms:
                por = 'ni la llave ni una inscripción dicen quiénes son'
        plan[k] = (ms, nombre)
        informe.append((ev, sv, fe, nombre, ms, por))
    for f in filas:
        for campo in ('ladoA', 'ladoB', 'ganador'):
            v = f.get(campo) or ''
            k = E.norm(E.HISTORIA.sub('', v))
            if k not in plan:
                continue
            ms, nombre = plan[k]
            if ms:
                f[campo] = ' + '.join(ms)
                _con_nota(f, 'Equipo: %s' % nombre)
            else:
                _con_nota(f, 'Sin integrantes: %s' % v)
    return filas, informe


def parecido(a, b):
    return len(a & b) / float(len(a | b)) if (a or b) else 0.0


#: el encabezado que dice qué es el mensaje y no cómo se llama el evento (`titulo()`; igual en `llave_vivo.js`)
TITULO_GENERICO = re.compile(r'(?:llaves?|brackets?|llaves? oficial(?:es)?|cruces|enfrentamientos|emparejamientos)',
                             re.I)


def titulo(texto):
    """Como se llama el evento. Solo para NOMBRARLO, nunca como clave."""
    for l in (texto or '').splitlines()[:6]:
        limpio = re.sub(r'<a?:\w+:\d+>|<@[&!]?\d+>', ' ', l)
        # 🔴 EL `__` DEL SUBRAYADO DE DISCORD SE QUEDA, Y NO ES DESCUIDO: es
        # parte de la IDENTIDAD de 11 eventos ya cargados. `Eventos
        # Procesados` guarda «__ DESGRACIAS EN TOKYO VOL.10 __», y la clave es
        # (nombre, servidor, fecha): sacarlo acá los renombra, no los
        # encuentra y los carga OTRA VEZ con número nuevo. Pasó cerca el
        # 27/09/2026 —el chequeo miró `datos/llaves_t1.json`, que ya viene
        # limpio para la web, en vez del Sheet—. El nombre se limpia para
        # MOSTRARLO (`sheet/llaves_web.py`); para cambiarlo acá hay que migrar
        # antes las tres hojas del Operativo.
        # 🐍 la «I» de adorno pegada a una barra y los guiones sueltos: Snake Rap (07/10/2026) titula
        # `# 🔑 LLAVES 🔑` y abajo `> ]|I{•------» (Gallos del Under Amateur I «------•}I|[`
        limpio = re.sub(r'(?<=\|)[Il](?=[\[\]{}|])|(?<=[\[\]{}|])[Il](?=\|)', ' ', limpio)
        limpio = re.sub(r'[^\w\sÁÉÍÓÚÑáéíóúñ.\-]', ' ', limpio)
        limpio = re.sub(r'(^|\s)[-.]{2,}(?=\s|$)', '\\1 ', limpio)
        limpio = re.sub(r'\s+', ' ', limpio).strip()
        if len(limpio) < 3:
            continue
        # y «LLAVES» no es el nombre de nada: el nombre viene abajo, o del anuncio
        if TITULO_GENERICO.fullmatch(limpio):
            continue
        # 🔴 UNA LÍNEA DE GUIONES NO ES UN TÍTULO. Urban Freestyle abre sus
        # llaves con `** ----------------------------- **` y el nombre
        # abajo (`# COMPE SOLO 4X4`); como el guion se deja pasar, el
        # evento se llamaba «-----------------------------». Medido el
        # 27/09/2026 sobre sus 46 llaves: casi todas. Y el nombre es parte
        # de la identidad del evento —(nombre, servidor, fecha)—, así que
        # tres llaves del mismo día eran UN evento. Sin una letra, se sigue.
        if not re.search(r'[^\W\d_]', limpio):
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
    ids = ids_de(hallazgo)
    gente = plantel(txt, ids)
    # 🔴 LA ESCALA SALE DEL FORMATO, NO DE CUÁNTOS NOMBRES DISTINTOS HAY. Dlx,
    # 28/09/2026, por la COMPE DEL VACILE (Majiztral dos veces en octavos, 15
    # nombres en una llave de 16): *«en sí el formato es de 16»*. El que
    # revive ocupa dos lugares de la primera ronda, así que se cuenta dos
    # veces para elegir la escala (`motor.escala_de()`). Ver
    # `repetidos_en_la_primera()`. Y el equipo que la llave nombra con un
    # solo nombre («TEAM VENECIA» en un 2VS2) es de dos: `faltan_en_equipos()`.
    n_part = len(gente_grupo or gente) + repetidos_en_la_primera(txt) + faltan_en_equipos(txt)
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
    # 🔑 un evento de vidas de #veredictos: sus batallas ya vienen armadas
    if hallazgo.get('vidas'):
        return filas_vidas(hallazgo, ev, sv, fecha)

    # 🔑 `conocidos=` ERA EL PARAMETRO QUE FALTABA. Ver `inscriptos_de()`:
    # sin él, los nombres de la llave se resuelven contra el texto crudo y
    # salen partidos por los paréntesis y los `+` de los equipos.
    # 🔑 Y LOS NOMBRES QUE DISCORD TRAE CON CADA MENCIÓN, después de los del
    # padrón: resuelven a quien todavía no tiene su ID cargado. Ver
    # `escuchar.menciones_de()`.
    # 🔑 EL QUE SIGUE SIENDO MENCIÓN EN UNA FILA —el que perdió y no aparece
    # después— entra con su nombre: el del padrón si está, si no el de
    # Discord (`nombre_visible()`), lo mismo que ya hacen las batallas que
    # decide Dlx en ✅ Decidir. Un `<@id>` en `Entrada` no es nadie para el
    # motor. El que pasó ya viene con el nombre de la ronda siguiente (ver
    # `escuchar.resolver()`).
    def _v(lado):
        return nombre_visible(lado, ids) if lado and E.MENCION.search(lado) else lado

    # 🔑 Y QUIÉN ES CADA NOMBRE, por su cuenta: el que cambia de nombre de una ronda a otra sigue
    # siendo él (02/10/2026, Oasis como «Park-Ji Sung🇰🇷»). Ver `personas()`.
    _q = personas(sv, hallazgo.get('menciones'))
    # 🔑 la llave como se jugó, de #veredictos, ya viene resuelta: ver `hallazgo_de_veredicto()`
    res = hallazgo['res'] if hallazgo.get('res') is not None else \
        E.resolver(txt, conocidos=inscriptos_de(sv), ids=ids, quien=_q)
    # 🔑 lo que la llave enseñó de quién es quién: ver `identidad_de_grupo()`
    hallazgo['_cambios'] = list(getattr(res, 'cambios', ()) or ())
    for bat in res:
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
        # 🔑 UN GRUPO DEL FILTRO DONDE NO PASÓ NADIE: caen todos. Ver el
        # final de `escuchar.resolver()`. El lado que pasa va VACÍO, y así
        # lo lee el motor: `_perdedor()` devuelve el lado que no es el
        # ganador, y el ganador vacío es el lado vacío. Con la nota
        # `triple`, `resultados._filas_uno()` la deja afuera de los duelos.
        if ganador is None and razon.startswith('pasan 0'):
            for p in lados:
                filas.append({'evento': ev, 'servidor': sv, 'fecha': fecha,
                              'participantes': n_part,
                              'ronda': ronda.lower(),
                              'ladoA': '', 'ladoB': _v(p), 'ganador': '',
                              'notas': 'triple (%d bandas, pasan 0)' % len(lados)})
            sabidas['filtro de %d donde no pasa nadie -> %d fila(s), sin duelo'
                    % (len(lados), len(lados))] += 1
            continue
        if ganador is None and 'pasan' in razon and pasan:
            caen = [l for l in lados if l not in pasan]
            for p in caen:
                filas.append({'evento': ev, 'servidor': sv, 'fecha': fecha,
                              'participantes': n_part,
                              'ronda': ronda.lower(),
                              'ladoA': _v(pasan[0]), 'ladoB': _v(p),
                              'ganador': _v(pasan[0]),
                              'notas': 'triple (%d bandas, pasan %d)'
                                       % (len(lados), len(pasan))})
            sabidas['batalla de %d donde pasan %d -> %d fila(s), sin duelo'
                    % (len(lados), len(pasan), len(caen))] += 1
            continue
        # 🔑 SI LA LLAVE NO DICE QUIÉN GANÓ, LO PUEDE DECIR #VEREDICTOS (02/10/2026). Dlx: *«detectar los veredictos en
        # el canal de veredictos»*. POESÍA CRUDA (URBF, 01/10) no escribió el campeón y su final se iba a ✅ Decidir
        # —sin campeón, el evento entero no suma—; en #veredictos decía `PICHULAMC vs Riferian` y `PICHULAMC X MÍNIMA`.
        # Los dos lados tienen que ser los del veredicto, en ese servidor y a pocas horas: ver
        # `escuchar.ganador_por_veredicto()`. La fila lo dice en la nota.
        por_veredicto = False
        if ganador is None and len(lados) == 2 and 'pasan' not in razon and 'tercer puesto' not in razon:
            g_v = E.ganador_por_veredicto(lados, hallazgo.get('guild'), hallazgo.get('cuando'), quien=_q)
            if g_v:
                ganador, por_veredicto = g_v, True
        if ganador is None:
            # un cruce de un solo lado que espera rival (`⌞X⌝ 🆚 ⌞⌝`, ver
            # `escuchar.nombres_de_linea()`): no hay a quién preguntar quién ganó
            if 'tercer puesto' in razon or 'pasan' in razon or len(lados) < 2:
                sabidas[razon if len(lados) >= 2 else 'cruce de un solo lado, esperando rival'] += 1
            else:
                # el quinto: los lados con su nombre, para preguntar quién ganó
                dudas.append((ev, ronda, ' vs '.join(lados), razon,
                              [nombre_visible(l, ids) for l in lados]))
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
                              'participantes': n_part,
                              'ronda': ronda.lower(),
                              'ladoA': _v(ganador), 'ladoB': _v(p),
                              'ganador': _v(ganador),
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
                      'participantes': n_part,
                      'ronda': ronda.lower(),
                      'ladoA': _v(ganador), 'ladoB': _v(otro),
                      'ganador': _v(ganador),
                      # ⚠️ EL TERCERO QUE SALE DEL PODIO NO ES UN DUELO: la
                      # llave no trae esa batalla y no se sabe si se peleó.
                      # Con la nota, `resultados._filas_uno()` la deja
                      # afuera de `1v1` y el motor igual paga 3ro y 4to.
                      'notas': ('podio: tercer puesto sin batalla en la llave'
                                if razon.startswith('podio') else
                                'ganador según #veredictos' if por_veredicto else '')})
    # 🔑 LA NAVE DE FUNA (Dlx, 29/09/2026): la fase de eliminación no tiene
    # batallas, así que ninguna fila de arriba la trae. Ver `filas_funa()`.
    fu = E.funa_de(txt)
    if fu:
        base = {'evento': ev, 'servidor': sv, 'fecha': fecha, 'participantes': n_part}
        filas, resuelta = filas_funa(filas, fu, txt, base)
        if resuelta:
            dudas = [d for d in dudas if str(d[1]).upper() != 'FINAL']
        sabidas['nave de funa: %d en la fase' % len(fu)] += 1
    return filas, dudas, sabidas


def _otros_por_servidor():
    """`{sv: {nombre normalizado: persona}}` de `datos/akas_a_mano.json` (`por_servidor`). `{}` si no hay."""
    try:
        with io.open(os.path.join(BASE, 'datos', 'akas_a_mano.json'), encoding='utf-8') as f:
            ps = (json.load(f) or {}).get('por_servidor') or {}
    except (OSError, ValueError):
        return {}
    return {sv: {E.norm(a): r for a, r in (m or {}).items() if E.norm(a)} for sv, m in ps.items()}


def otro_en_servidor(filas, sv, mapa=None):
    """Las filas de un evento de `sv` con los nombres que EN ESE SERVIDOR son otra persona que la de la Lista.

    🔑 Dlx, 03/10/2026 («8. A» y «9. A»): en DDF, «CARLOS🇪🇨» es Carlosss —@carlosss.mc23, ecuatoriano, dueño de DDF—
    y no el Carlos 🇲🇽 de la Lista, que ni está en ese servidor; «NUMBER🇻🇪» es Number VE y no Number 🇺🇾. El lector
    los juntaba porque el nombre coincide: el Carlos mexicano se llevaba 20.000 puntos de dos campeonatos ajenos.
    Lo decide Dlx y vive en `akas_a_mano.json` (`por_servidor`); se compara el nombre sin bandera, también adentro de
    un equipo. Como el ciclo reprocesa la temporada entera, los eventos viejos se corrigen en la corrida siguiente.
    """
    m = (_otros_por_servidor() if mapa is None else mapa).get(sv) or {}
    if not m:
        return filas

    def cambia(x):
        partes = re.split(r'(\s*[,+&]\s*)', str(x or ''))
        return ''.join(p if i % 2 else m.get(E.norm(p), p) for i, p in enumerate(partes))
    for f in filas:
        for k in ('ladoA', 'ladoB', 'ganador'):
            if f.get(k):
                f[k] = cambia(f[k])
        # y el `cobra: X` de la nota: el motor lo busca en la Lista sin saber del servidor, así que «cobra: Yo mc»
        # le pagaba al «Yo mc» de la ACADEMIA y no a Cronox (DEM UZBEKISTAN, FFA, 07/10/2026)
        if 'cobra' in str(f.get('notas') or '').lower():
            f['notas'] = re.sub(r'(cobra\s*:\s*)([^;|]+)', lambda q: q.group(1) + cambia(q.group(2)),
                                f['notas'], flags=re.I)
    return filas


def marcar_cobra(filas, decidir=None):
    """La ronda que alguien GANÓ y después no siguió, si Dlx dijo que la cobra: `cobra: <nombre>` en esa batalla.

    🔑 Dlx, 02/10/2026 (Geoka en la DOS GENERACIONES VOL 2: ganó su octavo y en cuartos peleó Zignos en su lugar):
    *«3. B»*, cobra el octavo. La decisión vive en `datos/decisiones.json` (`cobra`, ver `decidir.cobra_ronda()`);
    `sheet/motor.py` lee la nota y le paga la ronda como a quien la perdió. ⚠️ Sólo por decisión: ver por qué en
    `cobra_ronda()`.
    """
    if not filas:
        return filas
    f0 = filas[0]
    ev, sv, fe = f0.get('evento') or '', f0.get('servidor') or '', f0.get('fecha') or ''
    if decidir is None:
        try:
            import decidir as DEC
            decidir = DEC.cobra_ronda
        except Exception:                                # noqa: BLE001
            return filas
    try:
        plan = decidir(ev, sv, fe) or {}
    except Exception:                                    # noqa: BLE001
        plan = {}
    for nombre, ronda in plan.items():
        k = E.norm(E.HISTORIA.sub('', nombre))
        for f in filas:
            if E.norm(f.get('ronda')) != E.norm(ronda):
                continue
            g = f.get('ganador') or ''
            if k and E.norm(E.HISTORIA.sub('', g)) == k:
                _con_nota(f, 'cobra: %s' % g.strip())
    return filas


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

# ── las llaves de broma ────────────────────────────────────────────────
# 🔑 Dlx, 28/09/2026, a «¿una llave de alguien que nunca publicó una, y sin
# anuncio que la respalde, espera en ✅ Decidir antes de cargarse?»: *«A · sí»*.
# El caso fue «DENME MODERADOR LPM» (URBF, 27/09): la final «(pichula) 🆚
# (mi mamá)», campeón «MAMÁ ERIAN», en el canal de llaves de verdad. El lector
# no mira quién publica, así que una llave de broma terminada se cargaba igual
# que una real.
#
# ⚠️ LAS DOS COSAS A LA VEZ, y es lo que la hace barata: medido sobre las 21
# llaves de la T1 (11 autores), pedir sólo «autor nuevo» retenía llaves
# reales —un organizador nuevo con su anuncio— y pedir sólo «sin anuncio»
# también —hay llaves que se anuncian con otro nombre—. Juntas no retienen
# ninguna real y atrapan las dos de broma.
#
# ⚠️ Y SE SUELTA SOLA: «Sí cuenta» en ✅ Decidir la carga y suma a su autor a
# los conocidos (`AUTORES`); si el anuncio aparece después, la corrida
# siguiente ya no la retiene y `pendientes.barrer()` cierra la pregunta.
#
#: desde cuándo se revisa: lo publicado antes ya se cargó (o no) sin esto
BROMA_DESDE = '2026-09-29T04:00:00'
#: las huellas de quien ya publicó una llave que se cargó. Sólo la huella, no
#: la cuenta: va al repo público y para esto alcanza con reconocerla.
AUTORES = os.path.join(BASE, 'datos', 'autores_llaves.json')


def huella_autor(h):
    """La huella de quien publicó la llave `h`: su cuenta, o su usuario si
    es un hallazgo viejo sin cuenta. `''` si no trae ninguno.

    ⚠️ LA MISMA QUE LA DE QUIEN PUBLICÓ UN ANUNCIO (`anuncios.huella_cuenta()`):
    así se sabe que la llave y el anuncio los publicó la misma persona."""
    import anuncios as AN
    x = str(h.get('autor_id') or '').strip() or (
        'u:' + str(h.get('autor') or '').strip().lower() if h.get('autor') else '')
    return AN.huella_cuenta(x)


def autores_conocidos(hallazgos, links=None, guardadas=None):
    """Las huellas de quien ya publicó una llave que cuenta.

    Las guardadas, más las de toda llave anterior a la temporada (`INICIO`:
    la pre-temporada no pasó por esto) y las de toda llave que ya se cargó
    (su mensaje está en `datos/llaves_links.json`). ⚠️ NO las de cualquier
    llave vieja: «DENME MODERADOR LPM» es del 27/09 y nunca se cargó, así que
    su autor sigue siendo nuevo.
    """
    if guardadas is None:
        try:
            with io.open(AUTORES, encoding='utf-8') as f:
                guardadas = (json.load(f) or {}).get('huellas') or []
        except (OSError, ValueError):
            guardadas = []
    if links is None:
        try:
            with io.open(os.path.join(BASE, 'datos', 'llaves_links.json'), encoding='utf-8') as f:
                links = json.load(f) or {}
        except (OSError, ValueError):
            links = {}
    cargados = {str(u).rstrip('/').rsplit('/', 1)[-1]
                for us in (links or {}).values() for u in (us or [])}
    out = set(guardadas)
    for h in hallazgos or ():
        k = huella_autor(h)
        if k and (str(h.get('cuando') or '') < TEMP.INICIO_PRUEBA[:19]
                  or str(h.get('msg_id') or '') in cargados):
            out.add(k)
    return out


# ── el podio con mención ───────────────────────────────────────────────
# 🔑 Dlx, 28/09/2026, a «si el podio menciona al campeón (1ER PUESTO:
# @alguien), ¿eso resuelve su nombre solo?»: *«A · sí, como las
# inscripciones»*. RAP EXHIBITION 1/8 (Snake Rap) escribe «1ER PUESTO:
# <@639232575461654538>» y el campeón de su final es ANTORCHA OLÍMPICA, que
# no está en la Lista: la llave misma dice qué cuenta es.
#
# ⚠️ SÓLO LO QUE NO SE PRESTA A DUDA: un renglón del podio con UNA mención,
# contra un lado de UNA persona. Un equipo con dos menciones no dice cuál es
# cuál, y un puesto que aparece dos veces con cuentas distintas (dos
# terceros) tampoco. Lo usa `decidir.por_discord()`, como una inscripción.
#
#: `{'<evento normalizado>|<sv>|<dd/mm>': {'<nombre normalizado>': discord_id}}`
PODIO = os.path.join(BASE, 'datos', 'podio_menciones.json')
#: los equipos que una llave nombra con UN nombre: ver `marcar_equipos()`
EQUIPOS = os.path.join(BASE, 'datos', 'equipos_llaves.json')
_P_SEGUNDO = re.compile(r'SUB\s*-?\s*CAMPEON|\b2\s*(?:DO|ND|°|º)?\s*(?:PUESTO|LUGAR)\b'
                        r'|\bSEGUNDO\s+(?:PUESTO|LUGAR)|🥈')
_P_PRIMERO = re.compile(r'CAMPEON|\b1\s*(?:ER|RO|°|º)?\s*(?:PUESTO|LUGAR)\b'
                        r'|\bPRIMER\s+(?:PUESTO|LUGAR)|🥇')
_P_TERCERO = re.compile(r'\b3\s*(?:ER|RO|°|º)?\s*(?:PUESTO|LUGAR)\b|\bTERCER\s+(?:PUESTO|LUGAR)|🥉')


def menciones_podio(texto):
    """`{1: id, 2: id, 3: id}`: los renglones del podio con UNA sola mención."""
    import unicodedata
    vistos = {}
    for l in str(texto or '').splitlines():
        ids = set(E.MENCION.findall(l))
        if len(ids) != 1:
            continue
        s = ''.join(c for c in unicodedata.normalize('NFKD', l)
                    if not unicodedata.combining(c)).upper()
        if re.search(r'M\.?\s*V\.?\s*P\b', s):
            continue
        p = (2 if _P_SEGUNDO.search(s) else 1 if _P_PRIMERO.search(s)
             else 3 if _P_TERCERO.search(s) else None)
        if p:
            vistos.setdefault(p, set()).update(ids)
    return {p: next(iter(v)) for p, v in vistos.items() if len(v) == 1}


def podio_de_grupo(g, filas, norm_nombre):
    """`{nombre normalizado: id}` de quien sube al podio y la llave menciona.

    1º y 2º salen de la final; 3º, del tercer puesto. `norm_nombre` es la
    clave con que ✅ Decidir busca el nombre (`decidir.norm` sin bandera).
    """
    pos = {}
    for h in g.get('llaves') or []:
        for p, did in menciones_podio(h.get('texto') or '').items():
            pos.setdefault(p, set()).add(did)
    pos = {p: next(iter(v)) for p, v in pos.items() if len(v) == 1}
    if not pos:
        return {}
    r = lambda f: str(f.get('ronda') or '').strip().lower()     # noqa: E731
    fin = [f for f in filas if r(f) == 'final' and f.get('ganador')]
    ter = [f for f in filas if r(f) in ('tercer puesto', 'tercer lugar') and f.get('ganador')]
    lados = {}
    if len(fin) == 1:
        lados[1] = fin[0]['ganador']
        lados[2] = fin[0]['ladoB'] if fin[0]['ladoA'] == fin[0]['ganador'] else fin[0]['ladoA']
    if len(ter) == 1:
        lados[3] = ter[0]['ganador']
    out = {}
    for p, did in pos.items():
        lado = lados.get(p) or ''
        if not lado or E._miembros(lado) or E.MENCION.search(lado):
            continue
        k = norm_nombre(lado)
        if len(k) >= 2:
            out[k] = did
    return out


# ── quién es quién, según la llave ─────────────────────────────────────
# 🔑 Dlx, 01/10/2026: *«mejorar el sistema de detección de llaves y de personas
# automáticamente… el formato, las personas»*. La llave dice más de lo que se
# usaba para identificar a la gente, y lo dice el organizador:
#
#   · `NOMBRE <@id>` en cualquier renglón —el MVP, un podio de dos (`OKAM🇨🇷/
#     MASINO🇨🇱 <@a>/<@b>`)—: el podio con UNA mención ya contaba (Dlx, 28/09,
#     «A · sí, como las inscripciones»), éstos no;
#   · la mención que el lector hizo pasar a la ronda siguiente con un nombre
#     (`<@1273…>` en octavos, «SHULIOT🇦🇷» en cuartos): ese nombre es esa cuenta;
#   · el nombre que crece de una ronda a otra (`escuchar._crecio()`): PARIA en
#     octavos, «PARIA SIN REMEDIO» en cuartos, con el mismo compañero.
#
# Va a `IDENTIDAD`, por evento, y lo usa ✅ Decidir (`decidir._cuenta_de()` y
# `decidir.por_discord()`), igual que el podio. Medido el 01/10/2026: de las 39
# preguntas «¿quién es?» abiertas, SHULIOT tenía su cuenta en la propia llave.
#
#: `{'<evento normalizado>|<sv>|<dd/mm>': {'menciones': {nombre normalizado: id},
#:   'crece': [[antes, después], …]}}`
IDENTIDAD = os.path.join(BASE, 'datos', 'identidad_llaves.json')
#: lo que en un renglón del podio es una etiqueta y no un nombre
_ETIQUETA = re.compile(
    r'.*?(?:SUB\s*-?\s*CAMPE[OÓ]N|CAMPE[OÓ]N|M\.?\s*V\.?\s*P\.?'
    # ⚠️ «TERCER LUGAR» entero antes que «TERCER» solo: si no, «LUGAR» quedaba como nombre
    r'|(?:\b(?:PRIMER[OA]?|SEGUND[OA]|TERCER[OA]?)\s*)?(?:PUESTO|LUGAR)'
    # `# SEGUNDO <:TrofeoSegundo:…> : BLOODY` (Urban Freestyle): el puesto sin «PUESTO»
    r'|\bPRIMER[OA]?\b|\bSEGUND[OA]\b|\bTERCER[OA]?\b)'
    r'(?:\s*<a?:\w+:\d+>)?\s*[*_`~|:┋]*\s*', re.I)


def menciones_con_nombre(texto):
    """`{nombre normalizado: discord_id}` de los renglones `NOMBRE <@id>`.

    ⚠️ SÓLO LO QUE NO SE PRESTA A DUDA: tantos nombres como menciones, en el
    mismo orden —`A/B <@a>/<@b>`—, y nunca un renglón de batalla. Un nombre que
    sale con dos cuentas distintas en la misma llave no es de ninguna.
    """
    import unicodedata
    vistos = {}
    for l in str(texto or '').splitlines():
        ms = E.MENCION.findall(l)
        if not ms or E.SEP.search(l) or len(E.DELIMS[1].findall(l)) >= 2 \
                or len(E.DELIMS[0].findall(l)) >= 2:
            continue
        # ⚠️ sin tildes para encontrar la etiqueta; el nombre sólo se usa normalizado
        antes = ''.join(c for c in unicodedata.normalize('NFKD', l[:E.MENCION.search(l).start()])
                        if not unicodedata.combining(c))
        m = _ETIQUETA.match(antes)
        antes = re.sub(r'<a?:\w+:\d+>', ' ', antes[m.end():] if m else antes)
        partes = [x for x in re.split(r'\s*[/+&,]\s*', antes) if E.norm(x)]
        if len(partes) != len(ms):
            continue
        for x, did in zip(partes, ms):
            k = E.norm(x)
            if len(k) >= 2:
                vistos.setdefault(k, set()).add(did)
    return {k: next(iter(v)) for k, v in vistos.items() if len(v) == 1}


def identidad_de_grupo(g):
    """`{'menciones': {nombre normalizado: id}, 'crece': [[antes, después]]}` de las
    llaves de un grupo: lo que dicen sus renglones y lo que `resolver()` aprendió
    (`_cambios`, que deja `filas_de()` en cada llave). `{}` si no dice nada."""
    menc, crece = {}, []
    for h in g.get('llaves') or []:
        for k, did in menciones_con_nombre(h.get('texto') or '').items():
            menc.setdefault(k, set()).add(did)
        for c in h.get('_cambios') or ():
            if c[0] == 'mencion' and E.norm(c[2]):
                menc.setdefault(E.norm(c[2]), set()).add(c[1])
            elif c[0] == 'crece' and [c[1], c[2]] not in crece:
                crece.append([c[1], c[2]])
    menc = {k: next(iter(v)) for k, v in menc.items() if len(v) == 1}
    out = {}
    if menc:
        out['menciones'] = menc
    if crece:
        out['crece'] = crece
    return out


def llave_de_broma(g, conocidos, anuncios, nom, sv, fec, inferido=None, por_hora=''):
    """El motivo para retener una llave como de broma, o `None`.

    De broma = publicada desde `BROMA_DESDE`, por alguien que no está en
    `conocidos` (ningún mensaje del grupo), y sin un anuncio de su servidor
    que la respalde (`llaves_web.anunciado()`).

    🔑 SI EL NOMBRE LO PUSO EL ANUNCIO —una llave sin título, `inferido`: ver
    `anuncio_de_llave()`—, LA HORA SOLA NO LA RESPALDA: cualquiera puede
    publicar una llave en blanco justo después de un anuncio de verdad, y se
    llevaría su nombre. La respalda si ese anuncio lo publicó la misma cuenta.
    """
    hs = g.get('llaves') or []
    if not hs or all(str(h.get('cuando') or '') < BROMA_DESDE for h in hs):
        return None
    if any(huella_autor(h) in conocidos for h in hs):
        return None
    quien = ', '.join(sorted({str(h.get('autor') or '?') for h in hs}))
    if inferido is not None:
        if inferido.get('autor_h') and inferido['autor_h'] in {huella_autor(h) for h in hs}:
            return None
        return ('la publicó %s, que nunca había publicado una llave, y no trae título: por la hora es «%s», '
                'pero %s. Puede ser de broma. Si es de verdad, «Sí cuenta»'
                % (quien, (inferido.get('nombre') or '').strip(),
                   'ese anuncio lo publicó otra cuenta' if inferido.get('autor_h')
                   else 'no sé quién publicó ese anuncio'))
    if nom == '(sin titulo)':
        return ('la publicó %s, que nunca había publicado una llave, y no trae título (%s): puede ser '
                'de broma. Si es de verdad, «Sí cuenta»' % (quien, por_hora or 'ningún anuncio de %s' % sv))
    import llaves_web as LW
    try:
        dia = datetime.date.fromisoformat(LW.fecha_iso(fec))
    except ValueError:
        dia = None
    if dia and LW.anunciado(nom, sv, dia, anuncios):
        return None
    return ('la publicó %s, que nunca había publicado una llave, y ningún anuncio de %s '
            'la respalda: puede ser de broma. Si es de verdad, «Sí cuenta»'
            % (quien, sv))


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
    # 🔑 PERO LA NAVE DE FUNA SÍ DICE QUIÉN CAYÓ. Dlx, 29/09/2026, con tres
    # llaves de ejemplo: la fase es una lista con ❌ en los que cayeron, y la
    # final y el podio vienen después. No hay batallas, pero no es «la parte
    # clara» de algo que no se sabe: se sabe quién cayó —no en qué orden, y
    # por eso empatan—. Se carga (`filas_funa()`); lo que §12 descarta es
    # la fase que lista gente sin decir qué les pasó.
    if E.funa_de(texto):
        return None
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


#: las rondas que pueden ser una PREVIA —un filtro para unos pocos lugares—
PREVIAS = {'FILTROS', 'CLASIFICATORIAS', 'PRELIMINARES'}


def marcar_walkins(filas, textos=(), ids=None, quien=None):
    """Anota `Walk-in N: nombre` a quien aparece recien en una ronda avanzada.

    🔴 Y NO ES WALK-IN QUIEN ESTUVO ANTES CON OTRO NOMBRE (02/10/2026). Oasis
    jugó los octavos de la DOS GENERACIONES UN DESTINO VOL 2 como «Park-Ji
    Sung🇰🇷» y salió «Walk-in 1» en cuartos: el campeón cobró 5.000. `quien`
    (`personas()`) dice de quién es cada nombre por su cuenta —la Lista, los
    AKAs, la inscripción, la mención—, y si la persona ya estaba en una ronda
    anterior, no salteó nada.

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
    en cuartos son la misma persona escrita distinto — ni si su nombre
    EMPIEZA con el de alguien de antes: `MATI` en octavos y `MATICERNA` en
    cuartos (FFA WORLD CUP, 27/09/2026).

    🔴 UNA RONDA PREVIA QUE NO LLENA LA SIGUIENTE NO ES LA ENTRADA DE TODOS.
    La FFA WORLD CUP (27/09/2026) tuvo FILTROS de tres por UN lugar en
    octavos; los otros quince entraron directo a octavos, como estaba
    armado. Contando desde los filtros, los quince eran «Walk-in 1»: el
    campeón cobraba 5.000 en vez de 10.000. La Guía lo define como *«entrar
    a una llave ya empezada, salteando rondas»*, y nadie saltó nada. Si la
    primera ronda es una previa (filtros, clasificatoria, preliminar) con
    menos batallas que lugares tiene la ronda siguiente, la entrada es la
    siguiente.

    🔴 Y UNA MENCIÓN ES ALGUIEN QUE ESTUVO, con los nombres que se le
    conocen (`ids`: el padrón, sus alias, la inscripción y Discord).
    MARRUECOS EN VENTA V.1 (26/09/2026) escribe los octavos sólo con
    `<@id>`, y `norm()` borra la mención: PROVENZA, que pasó una batalla de
    cuatro donde pasan dos, no quedaba en ninguna fila de octavos y en
    cuartos salía «Walk-in 1» —la mitad de sus puntos— por haber jugado.
    """
    def _k(n):
        return E.norm(E.HISTORIA.sub('', n or ''))

    def _ronda(r):
        r = (r or '').upper()
        return E.ALIAS.get(r, r)

    # las rondas del texto, en orden, con TODOS los nombres que aparecen
    # —tambien los de adentro de un parentesis: son gente que ya peleo—
    en_texto = collections.defaultdict(set)
    n_bat, n_lados = collections.Counter(), collections.Counter()
    for t in textos:
        for ronda, bats in E.rondas_de(t):
            r = _ronda(ronda)
            if r not in E.ORDEN or r == 'TERCER LUGAR':
                continue
            n_bat[r] += len(bats)
            n_lados[r] += sum(len(b) for b in bats)
            for b in bats:
                for n in b:
                    for parte in re.split(r'[+,&()]', n):
                        k = E.norm(parte)
                        if k:
                            en_texto[r].add(k)
                        # la mención, con sus nombres: ver el docstring
                        for did in E.MENCION.findall(parte):
                            for nom in ((ids or {}).get(str(did)) or []):
                                if E.norm(nom):
                                    en_texto[r].add(E.norm(nom))
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
    # la ronda donde entra la mayoría: la previa que no llena la siguiente, no
    base = 1 if (rondas[0] in PREVIAS and n_bat[rondas[0]]
                 and n_bat[rondas[0]] < n_lados[rondas[1]]) else 0

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
        if i <= base:
            continue
        previos = set().union(*(en_texto[rondas[j]] for j in range(i)))
        if k in previos or E._parecido(k, list(previos)):
            continue
        if any(len(p) >= 4 and (k.startswith(p) or p.startswith(k)) for p in previos):
            continue
        # la misma persona, con otro nombre en una ronda anterior: ver el docstring
        if quien is not None and quien(k) and any(quien(k) & quien(p) for p in previos):
            continue
        nota = 'Walk-in %d: %s' % (min(i - base, 3), E.HISTORIA.sub('', nombre).strip())
        f['notas'] = ('%s; %s' % (f['notas'], nota)) if f.get('notas') else nota
    return filas


#: la notacion de revivido de la guia (§3.7): `Mco (R)`, `1R`, `2R`
REVIVIDO_MARCA = re.compile(r'([^\s⌞\[\]()]{2,}[^⌞\[\]()]*?)\s*(?:\(\s*R\s*\)|\b[123]\s*R\b)')
#: 🔑 Y LA «R» SUELTA DESPUÉS DE LA BANDERA: `SIX 🇦🇷 R`, `GOCHO 🇨🇴 R` (VOL 18 2VS2).
#: Dlx, 01/10/2026: es revivido y cobra como revivido («C»: la mitad de su
#: puesto final, §3.7). El nombre ya llega sin la R (`escuchar.sin_refuerzos()`);
#: acá se anota quién es. ⚠️ Sólo con bandera antes y el lado cerrándose
#: después: «ROMEO R» sin bandera es un nombre
REVIVIDO_R = re.compile(r'([^\s⌞⌝\[\]()+,&*]{2,}(?:[ \t]+[^\s⌞⌝\[\]()+,&*]+)*?)[ \t]*'
                        + E._BANDERA + r'{2}[ \t]+R(?=[ \t*_]*(?:[\]⌝+,&]|🆚|$))', re.M)


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
    # 1. la notacion, en el texto crudo: `(R)`, `1R` y la «R» suelta después de la bandera
    for t in textos:
        for m in list(REVIVIDO_MARCA.finditer(t or '')) + list(REVIVIDO_R.finditer(t or '')):
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


_ANUNCIOS = [None]


def _anuncios():
    if _ANUNCIOS[0] is None:
        try:
            with io.open(os.path.join(BASE, 'datos', 'anuncios.json'), encoding='utf-8') as f:
                _ANUNCIOS[0] = (json.load(f) or {}).get('anuncios') or []
        except (OSError, ValueError):
            _ANUNCIOS[0] = []
    return _ANUNCIOS[0]


#: «este anuncio es de esta llave»: el evento arranca entre cinco horas antes y
#: una después de la llave. La misma ventana de `nombre_vidas()` y de la página
#: (`llaveDeEvento()`).
ANTES_MS, DESPUES_MS = 3600000, 5 * 3600000
#: el nombre que le dio su anuncio a cada llave sin título, por mensaje: ver
#: `anuncio_de_llave()`. Se guarda porque el anuncio se va del canal y la llave
#: no: sin esto volvería a «(sin titulo)» —otro evento, otro número—.
NOMBRES = os.path.join(BASE, 'datos', 'nombres_llaves.json')


def _hora_et(ms):
    """`ms` -> «5:33 PM», en hora del este."""
    t = datetime.datetime.fromtimestamp(ms / 1000.0, datetime.timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        t = t.astimezone(ZoneInfo('America/New_York'))
    except Exception:                                    # noqa: BLE001
        t = t.astimezone(datetime.timezone(datetime.timedelta(hours=-4)))
    return t.strftime('%I:%M %p').lstrip('0')


def anuncio_de_llave(g, anuncios=None, tomados=()):
    """El anuncio de una llave SIN título: `(anuncio, cómo)`, o `(None, por qué)`.

    🔑 Dlx, 03/10/2026, con la KISS OF SHINIGAMI de FFA, que no se cargó: *«no
    en todos los servidores ponen nombres… ¿cómo detectás que esta llave es para
    este evento? ¿Por el tiempo que ambos fueron anunciados o por la persona que
    anunció esos 2?»*. Por las dos, en ese orden:

    1. LA HORA: los anuncios de su servidor cuyo evento arranca entre cinco
       horas antes y una después de la primera llave del grupo (su horario,
       `cuando.momento()`; sin horario, cuándo se publicó), menos los que ya
       tienen su llave (`tomados`).
    2. LA PERSONA: si quedan dos o más, el que publicó la misma cuenta que la
       llave (`autor_h` de `bot/anuncios.py`, contra `huella_autor()`).
    3. Si todavía son dos o más, ninguno: un nombre adivinado es un evento
       mal identificado que nadie ve.

    ⚠️ LA HORA NOMBRA PERO NO RESPALDA a quien nunca publicó una llave: eso lo
    decide `llave_de_broma()`, que pide además la misma cuenta.
    """
    import cuando as CU
    hs = g.get('llaves') or []
    ts = [x for x in (_ms_de(h.get('cuando')) for h in hs if h.get('cuando')) if x is not None]
    if not ts:
        return None, 'sin hora'
    t0 = min(ts)
    sv = codigo_servidor(hs[0].get('guild'))[0]
    cands = []
    for a in (anuncios if anuncios is not None else _anuncios()):
        if a.get('servidor') != sv or not (a.get('nombre') or '').strip():
            continue
        if str(a.get('msg_id') or '') in tomados:
            continue
        ti = _ms_de(CU.momento(a) or a.get('cuando'))
        if ti is None or not ti - ANTES_MS <= t0 <= ti + DESPUES_MS:
            continue
        cands.append((abs(t0 - ti), a))
    if not cands:
        return None, 'ningún anuncio de %s a esa hora' % sv
    def _de(a):
        p = _ms_de(a.get('cuando'))
        return '«%s», anunciado a las %s' % (a['nombre'].strip(), _hora_et(p)) if p else '«%s»' % a['nombre'].strip()
    if len(cands) == 1:
        return cands[0][1], '%s: el único de %s a esa hora' % (_de(cands[0][1]), sv)
    mias = {huella_autor(h) for h in hs} - {''}
    propios = [c for c in cands if c[1].get('autor_h') and c[1]['autor_h'] in mias]
    if len(propios) == 1:
        return propios[0][1], '%s: de %d anuncios a esa hora, el de la misma cuenta' % (_de(propios[0][1]), len(cands))
    return None, '%d anuncios de %s a esa hora (%s)' % (
        len(cands), sv, ', '.join(_de(c[1]) for c in sorted(cands, key=lambda c: c[0])))


def nombre_propio(g, nom, anuncio=None):
    """El nombre de una llave cuyo anuncio se llama igual que el de OTRO evento del mismo día y servidor: el del
    anuncio más lo que su primer renglón dice además —«CLASIFICATORIA 3 PRITTY FREE» con el anuncio «PRITTY FREE» da
    «PRITTY FREE CLASIFICATORIA 3»—; si ningún renglón lo nombra, el del anuncio con su hora: «PRITTY FREE 10:41 PM».

    ⚠️ EL RENGLÓN TIENE QUE NOMBRAR AL ANUNCIO, y puede decir «CLASIFICATORIA»: `titulo()` saltea los renglones con
    el nombre de una ronda (un `[ OCTAVOS ]` no es un título), y por eso esta llave no tenía título. Acá la ronda
    no estorba, porque lo que se busca es lo que el título agrega al nombre que ya se sabe."""
    pals = [E.norm(w) for w in nom.split() if E.norm(w)]
    for h in sorted(g.get('llaves') or [], key=lambda x: str(x.get('cuando') or '')):
        for l in (h.get('texto') or '').splitlines()[:6]:
            limpio = re.sub(r'<a?:\w+:\d+>|<@[&!]?\d+>', ' ', l)
            limpio = re.sub(r'[^\w\sÁÉÍÓÚÑáéíóúñ.\-]', ' ', limpio).replace('_', ' ')
            limpio = re.sub(r'\s+', ' ', limpio).strip()
            if not re.search(r'[^\W\d_]', limpio) or E.nombres_de_linea(l):
                continue
            palabras = limpio.split()
            claves = [E.norm(w) for w in palabras]
            if not pals or not all(p in claves for p in pals):
                continue
            resto = [w for w, k in zip(palabras, claves) if k not in pals]
            if resto:
                return ('%s %s' % (nom.strip(), ' '.join(resto)))[:60]
    ms = _ms_de((anuncio or {}).get('cuando')) if anuncio else None
    return ('%s %s' % (nom.strip(), _hora_et(ms)))[:60] if ms is not None else '%s (2)' % nom.strip()


def _nombres_guardados(ruta=None):
    """`{msg_id de una llave: {'nombre', 'anuncio', 'sv', 'autor_h'}}`: ver `NOMBRES`."""
    try:
        with io.open(ruta or NOMBRES, encoding='utf-8') as f:
            return (json.load(f) or {}).get('llaves') or {}
    except (OSError, ValueError):
        return {}


def nombre_vidas(h, anuncios=None):
    """El nombre de un evento de vidas de #veredictos: el del anuncio de su
    servidor que arrancó cerca —de una hora antes a cinco después de la
    primera batalla, la misma ventana que la página (`llaveDeEvento()`)—.

    ⚠️ SIN ANUNCIO, CON LA HORA: «5 VIDAS 17:38». El nombre es un tercio de
    la identidad del evento —(nombre, servidor, fecha)—, y dos 5 vidas del
    mismo servidor el mismo día sin nombre serían UN evento.
    """
    import cuando as CU
    V = h['vidas']
    sv = codigo_servidor(h.get('guild'))[0]
    # la hora de la primera batalla, no la del primer mensaje de la tanda
    t0 = E._ms(V['batallas'][0][3]) if V.get('batallas') else int(V['pub'])
    mejor = None
    for a in (anuncios if anuncios is not None else _anuncios()):
        if a.get('servidor') != sv or not a.get('nombre'):
            continue
        ini = CU.momento(a)
        if not ini:
            continue
        try:
            ti = datetime.datetime.fromisoformat(ini).replace(
                tzinfo=datetime.timezone.utc).timestamp() * 1000
        except ValueError:
            continue
        if ti - ANTES_MS <= t0 <= ti + DESPUES_MS and (mejor is None or abs(t0 - ti) < mejor[0]):
            mejor = (abs(t0 - ti), a['nombre'].strip())
    if mejor:
        return mejor[1]
    hora = datetime.datetime.fromtimestamp(t0 / 1000.0, datetime.timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        hora = hora.astimezone(ZoneInfo('America/New_York'))
    except Exception:                                    # noqa: BLE001
        hora = hora.astimezone(datetime.timezone(datetime.timedelta(hours=-4)))
    return '%d VIDAS %s' % (V['vidas'], hora.strftime('%H:%M'))


def _bandera_al_final(nombre):
    """«🇦🇷 DELUXE» -> «DELUXE 🇦🇷»: como se escriben en el resto de la Liga.
    Sólo para mostrar: el padrón compara sin banderas."""
    m = re.match(r'^\s*((?:[\U0001F1E6-\U0001F1FF]{2}\s*)+)(.+?)\s*$', nombre or '')
    return ('%s %s' % (m.group(2), re.sub(r'\s+', '', m.group(1)))) if m \
        else str(nombre or '').strip()


def filas_vidas(h, ev, sv, fecha):
    """(filas, dudas, sabidas) de un evento de vidas de #veredictos.

    🔑 UNA FILA POR BATALLA Y EN EL ORDEN EN QUE SE PELEARON: el motor saca
    el lugar del orden en que cayeron (`motor.lugares_vidas()`), así que ese
    orden ES el dato. Por eso nada de `sin_repetir()`: en un 5 vidas la
    misma pareja se cruza varias veces, y eso no es una copia.

    🔑 LA BATALLA QUE QUEDÓ PAREJA EN EL TEXTO —un juez que vota con una
    imagen— se pregunta en ✅ Decidir (Dlx, 28/09/2026: «A y b»), una por
    batalla y con su número, porque la misma pareja puede empatar dos veces.
    Lo que se contesta entra EN SU LUGAR, no al final: al final correría
    quién cayó primero.

    ⚠️ La réplica empatada no se pregunta: la decide la de después, que es
    la misma pareja.
    """
    import decidir as DEC
    V = h['vidas']
    filas, dudas, sabidas = [], [], collections.Counter()
    for i, (lados, g, nota, _mid) in enumerate(V['batallas'], 1):
        a, b = [_bandera_al_final(x) for x in lados]
        gana = _bandera_al_final(g) if g else ''
        if not gana:
            if 'réplica' in (nota or ''):
                sabidas['%s: réplica empatada, la decide la de después' % V['ronda']] += 1
                continue
            cual = '%s, batalla %d' % (V['ronda'], i)
            dec = DEC.decision_batalla(DEC.detalle_batalla(ev, sv, fecha, cual, [a, b]))
            if dec is None:
                dudas.append((ev, cual, '%s vs %s' % (a, b),
                              ('quedó %s en el texto: un juez pudo votar con una imagen'
                               % nota.replace('votos ', '')) if nota else
                              'ningún juez votó con texto', [a, b]))
                continue
            # en un 5 vidas no hay ronda que cobrar: «nadie siguió» es como «no se jugó»
            if not dec or dec == DEC.NADIE:
                sabidas['%s: batalla que no se jugó (✅ Decidir)' % V['ronda']] += 1
                continue
            gana, nota = dec, 'ganador: ✅ Decidir'
        # ⚠️ EL NÚMERO DE BATALLA VA EN LA NOTA: es lo único que separa dos
        # revanchas con el mismo ganador, y la guarda contra duplicados de
        # `Entrada` la mira (ver `_clave()` en `main()`)
        filas.append({'evento': ev, 'servidor': sv, 'fecha': fecha, 'participantes': V['n'],
                      'ronda': V['ronda'], 'ladoA': gana,
                      'ladoB': b if E.norm(gana) == E.norm(a) else a,
                      'ganador': gana, 'notas': 'batalla %d%s' % (i, ' · ' + nota if nota else '')})
    return filas, dudas, sabidas


def resumen_vidas(filas, vidas):
    """«23 batallas · 5 raperos | Campeón: X | 2.º Y · 3.º Z…» para ✅ Decidir."""
    import motor
    grupos, avisos = motor.lugares_vidas(filas, vidas, lambda x: x)
    gente = {x for f in filas for x in (f['ladoA'], f['ladoB'])}
    lugares = []
    k = 1
    for gr in grupos:
        lugares.append('%s %s' % ('%d.º' % k if len(gr) == 1 else '%d.º-%d.º' % (k, k + len(gr) - 1),
                                  ' y '.join(gr)))
        k += len(gr)
    out = ['%d batallas · %d raperos' % (len(filas), len(gente))]
    if grupos and len(grupos[0]) == 1:
        out.append('Campeón: %s' % grupos[0][0])
    out.append(' · '.join(lugares[1:] if grupos and len(grupos[0]) == 1 else lugares))
    if avisos:
        out.append('⚠️ terminó con más de uno en pie: comparten el lugar')
    return ' | '.join(x for x in out if x)


def nombre_de(grupo):
    """UN nombre para todo el grupo. El más repetido; si empatan, el 1º.

    ⚠️ EL MÁS REPETIDO Y NO EL PRIMERO, aunque casi siempre den lo
    mismo. Cuando alguien reposta la llave, la copia suele ser idéntica
    y el original puede ser el que quedó a medias; contar deja ganar a
    la forma en que el evento se escribió de verdad, y no depende del
    orden en que Discord los devolvió — que cambia si se borra un
    mensaje.

    🔑 Un evento de vidas de #veredictos no tiene título: lleva el de su
    anuncio (`nombre_vidas()`).
    """
    vs = [h for h in grupo['llaves'] if h.get('vidas')]
    if vs:
        return nombre_vidas(vs[0])
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
#: lo mismo para un 5 vidas de #veredictos, que no se edita después: la
#: tanda se corta a los 45 min sin mensajes (`escuchar.TANDA_MIN`)
VIDAS_CERRADO_H = 0.75


#: 📢 la llave que el organizador PAUSÓ —«se me fue la luz, podemos reanudar con la compe mañana» (GALLOS DEL UNDER
#: AMATEUR I, Snake Rap, 07/10/2026)— queda quieta toda la noche sin estar abandonada: espera esto antes de ir a
#: Pendientes. Las mismas 36 h que el vigía guarda esos avisos (`estados` de `/avisos/vivo`)
PAUSADA_H = 36
VIGIA = 'https://liga-global-bot.liga-global-ul.workers.dev'
_ESTADOS = [None]


def estados_vigia():
    """Lo que el vigía vio que los organizadores avisaron DESPUÉS del anuncio —cancelado, en pausa, atrasado—:
    `estados` de `/avisos/vivo` (ver `anotarEstado()` de bot/avisos.js). Sin red, nada: vale la regla de siempre."""
    if _ESTADOS[0] is None:
        try:
            import requests
            _ESTADOS[0] = requests.get(VIGIA + '/avisos/vivo', timeout=15).json().get('estados') or []
        except Exception:                                # noqa: BLE001
            _ESTADOS[0] = []
    return _ESTADOS[0]


def pausada(grupo, sv, estados=None):
    """¿El organizador avisó que esta llave sigue otro día? Un aviso «en pausa» de ESE servidor, publicado desde una
    hora antes de la llave hasta 24 h después de lo último que se hizo con ella."""
    ts = []
    for h in grupo['llaves']:
        for k in ('cuando', 'editado'):
            t = str(h.get(k) or '').strip()
            try:
                t = datetime.datetime.fromisoformat(t.replace('Z', '+00:00')) if t else None
            except ValueError:
                t = None
            if t is not None:
                ts.append((t if t.tzinfo else t.replace(tzinfo=datetime.timezone.utc)).timestamp() * 1000)
    if not ts:
        return False
    ini, fin = min(ts) - 3600 * 1000, max(ts) + 24 * 3600 * 1000
    return any(e.get('sv') == sv and e.get('tipo') == 'pausado' and ini <= int(e.get('pub') or 0) <= fin
               for e in (estados_vigia() if estados is None else estados))


#: los eventos ya cargados (`datos/llaves_t1.json`), para `ya_cargada()`
_CARGADAS = [None]
#: «es el mismo evento»: casi todas sus batallas, y desde tres
YA_PARTE, YA_MIN = 0.8, 3


def ya_cargada(nom, sv, fec, filas, cargadas=None):
    """El número del evento YA CARGADO, con otro nombre, que tiene casi todas las batallas de éste; o None.

    🔴 EL FFA WORLD CUP DEL 27/09 CONTÓ DOS VECES (#366 y #409), y lo destapó Molusco (Dlx, 07/10/2026: *«me dijo
    que me fije si algo está mal»*). La llave vino en dos mensajes —filtros y octavos; media hora después, de cuartos a
    la final— y se cargó entera como #366. El 06/10 una corrida leyó el segundo sin el primero, sin título, y lo cargó
    como «(sin titulo)»: OTRO evento, porque la identidad es (nombre, servidor, fecha). Oasis, Snow, Eze, Molusco,
    Maticerna, SOL, dxg y yinn cobraron dos veces, y sus duelos de cuartos para arriba también.

    Es la forma de la PRITTY FREE (#417) y del #420/#421: un evento ya cargado vuelve con otro nombre. Por el nombre no
    se ve; por las BATALLAS sí —las mismas, del mismo servidor y del mismo día o el siguiente (la final pasada la
    medianoche)—, con los nombres como los cuenta el ranking (`rankings.canon()`: FULLY es Oasis). ⚠️ Desde `YA_MIN`
    batallas: dos cruces iguales pueden ser casualidad, y la gente de FFA se cruza seguido.
    """
    if cargadas is None:
        if _CARGADAS[0] is None:
            try:
                d = json.load(io.open(os.path.join(BASE, 'datos', 'llaves_t1.json'), encoding='utf-8'))
            except (OSError, ValueError):
                d = {}
            _CARGADAS[0] = [x for x in (d.values() if isinstance(d, dict) else d) if isinstance(x, dict)]
        cargadas = _CARGADAS[0]
    try:
        import rankings as RK
        canon = RK.canon
    except Exception:                                    # noqa: BLE001
        def canon(x):
            return x

    def k(x):
        return E.norm(canon(str(x or '')))

    def dia(f):
        m = re.match(r'\s*(\d{1,2})/(\d{1,2})', str(f or ''))
        try:
            return datetime.date(2000, int(m.group(2)), int(m.group(1))) if m else None
        except ValueError:
            return None
    mias = {frozenset((k(f.get('ladoA')), k(f.get('ladoB')))) for f in filas
            if k(f.get('ladoA')) and k(f.get('ladoB')) and k(f.get('ladoA')) != k(f.get('ladoB'))}
    d0 = dia(fec)
    if len(mias) < YA_MIN or d0 is None:
        return None
    for ll in cargadas:
        d1 = dia(ll.get('fecha'))
        if ll.get('sv') != sv or d1 is None or abs((d1 - d0).days) > 1 or E.norm(ll.get('nombre')) == E.norm(nom):
            continue
        suyas = set()
        for r in ll.get('rondas') or []:
            for b in r.get('b') or []:
                lados = [k(x) for x in (b[0] if b else []) if k(x)]
                suyas |= {frozenset((a, c)) for i, a in enumerate(lados) for c in lados[i + 1:] if a != c}
        if len(mias & suyas) >= YA_PARTE * len(mias):
            return ll.get('n')
    return None


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


def _primera_ronda(h):
    """`(ronda, {parejas})` de la primera ronda de una llave: cada pareja es
    el conjunto de sus lados normalizados."""
    rs = E.rondas_de(h.get('texto') or '')
    if not rs:
        return None, set()
    r, bs = rs[0]
    pares = set()
    for b in bs:
        lados = frozenset(E.norm(x) for x in b if E.norm(x))
        if len(lados) >= 2:
            pares.add(lados)
    return E.ALIAS.get(r, r), pares


def sin_sorteos_viejos(llaves):
    """Las llaves de un evento sin los sorteos que el organizador rehízo.

    🔴 DESGRACIAS EN TOKYO VOL 15 MULTIVERSE (FFA, 28/09/2026) SE PUBLICÓ DOS
    VECES CON OTRO SORTEO, y la vieja quedó en el canal. Las dos tienen la
    misma gente, así que `agrupar()` las junta —bien: es un evento—, pero
    las batallas de la vieja nunca se pelearon: cuando se llenara la nueva,
    las de la vieja iban a ✅ Decidir como «¿Quién ganó?» de peleas que no
    existieron. Y la página mostraba dos «En vivo» del mismo evento.

    ⚠️ LA REGLA: la más nueva manda, y una más vieja se descarta si su
    primera ronda es LA MISMA RONDA con otras parejas —menos del 80 % de las
    suyas están en la nueva—. Una reposteada idéntica, o la misma llave más
    llena, comparte las parejas y se sigue juntando como siempre; la mitad
    de una llave partida empieza en otra ronda y no se toca.
    """
    if len(llaves) < 2:
        return llaves
    orden = sorted(llaves, key=lambda h: str(h.get('cuando') or ''), reverse=True)
    r0, p0 = _primera_ronda(orden[0])
    out = [orden[0]]
    for h in orden[1:]:
        r, p = _primera_ronda(h)
        if r0 and r == r0 and p and p0 and len(p & p0) < 0.8 * len(p):
            h['_sorteo_viejo'] = True
            continue
        out.append(h)
    # el orden de siempre: el que traían (ver `sin_repetir()`)
    quedan = {id(h) for h in out}
    return [h for h in llaves if id(h) in quedan]


def agrupar(hallazgos):
    """Junta las llaves que son el MISMO evento, por plantel."""
    grupos = []
    for h in hallazgos:
        p = plantel(h['texto'], ids_de(h))
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
    # ⚠️ CON CUENTAS DE FECHA, NO REEMPLAZANDO TEXTO: esto armaba «antes» con
    # `.replace('2026-09-22', …)`, y desde el arranque de la T1 `INICIO` es
    # otra fecha —el reemplazo no hacía nada y la prueba se ponía en rojo—
    import datetime as _dt
    _i = _dt.datetime.fromisoformat(ini)
    antes = (_i - _dt.timedelta(days=1)).isoformat()
    despues = (_i + _dt.timedelta(hours=12)).isoformat()
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
    # la FFA WORLD CUP recortada: un filtro de tres por un lugar y los demás
    # directo a octavos; en cuartos, `MATI` pasa a escribirse `MATICERNA`
    wc = ('# FILTROS\n⌞VELATZ⌝ 🆚 ⌞DREXX⌝ 🆚 ⌞EZEE⌝\n# OCTAVOS\n'
          '⌞NC⌝ 🆚 ⌞FULLY⌝\n⌞SNOW⌝ 🆚 ⌞MAKMA⌝\n⌞YINN⌝ 🆚 ⌞PROVENZA⌝\n⌞MATI⌝ 🆚 ⌞MTZ⌝\n'
          '⌞SOL⌝ 🆚 ⌞NACIO⌝\n⌞SONETO⌝ 🆚 ⌞DXG⌝\n⌞ABYSSUS⌝ 🆚 ⌞MOLUSCO⌝\n⌞PICHULITA⌝ 🆚 ⌞EZEE⌝\n'
          '# CUARTOS\n⌞FULLY⌝ 🆚 ⌞SOL⌝\n⌞SNOW⌝ 🆚 ⌞DXG⌝\n⌞YINN⌝ 🆚 ⌞MOLUSCO⌝\n⌞EZEE⌝ 🆚 ⌞MATICERNA⌝\n'
          '# SEMIFINALES\n⌞FULLY⌝ 🆚 ⌞MOLUSCO⌝\n⌞SNOW⌝ 🆚 ⌞EZEE⌝\n# FINAL\n⌞FULLY⌝ 🆚 ⌞SNOW⌝\n'
          'CAMPEÓN: FULLY')
    fwc = marcar_walkins(filas_de(dict(h, texto=wc))[0], [wc])
    # la misma, con ZETA apareciendo en cuartos en lugar de MOLUSCO
    wc2 = wc.replace('⌞YINN⌝ 🆚 ⌞MOLUSCO⌝', '⌞YINN⌝ 🆚 ⌞ZETA⌝').replace(
        '⌞FULLY⌝ 🆚 ⌞MOLUSCO⌝', '⌞FULLY⌝ 🆚 ⌞ZETA⌝')
    fwc2 = marcar_walkins(filas_de(dict(h, texto=wc2))[0], [wc2])
    # MARRUECOS EN VENTA V.1 recortada: octavos sólo con menciones, una
    # batalla de cuatro donde pasan dos (OKAM y PROVENZA)
    wm = ('# OCTAVOS\n[<@41>] 🆚 [<@42>] 🆚 [<@43>] 🆚 [<@44>]\n'
          '# CUARTOS\n[OKAM] 🆚 [PROVENZA]\n')

    def _fm():
        return [dict(ronda='octavos', ladoA='OKAM', ladoB='Jult', ganador='OKAM',
                     notas='triple (4 bandas, pasan 2)'),
                dict(ronda='octavos', ladoA='OKAM', ladoB='Sin Limites', ganador='OKAM',
                     notas='triple (4 bandas, pasan 2)'),
                dict(ronda='cuartos', ladoA='OKAM', ladoB='PROVENZA', ganador='OKAM',
                     notas='')]
    ids_w = {'41': ['Okam'], '42': ['Jult'], '43': ['Provenza'], '44': ['Sin Limites']}
    fwm, fwm0 = marcar_walkins(_fm(), [wm], ids_w), marcar_walkins(_fm(), [wm])
    # 🔑 LA MISMA PERSONA CON OTRO NOMBRE: la DOS GENERACIONES UN DESTINO VOL 2 recortada (FFA, 01/10/2026). Oasis
    # juega octavos como «Park-Ji Sung🇰🇷» y la semi como «Oasis🇨🇱». Quién es quién va de mentira y fijo —dos
    # «Sol» en la Lista, Oasis con su alias— para que la prueba no dependa de la Lista de hoy
    _sv_h = codigo_servidor(h.get('guild'))[0]
    _pers_antes, _sv_antes = _PERS[0], dict(_PERS_SV)
    _PERS[0] = ({'sol': {'id:1', 'id:2'}, 'oasis': {'id:9'}, 'parkjisung': {'id:9'}}, {'id:1', 'id:2', 'id:9'})
    _PERS_SV.clear()
    _PERS_SV[_sv_h] = {}
    try:
        _qt = personas(_sv_h)
        pj = ('# DOS GENERACIONES\n`[ OCTAVOS ]`\n⌞Soneto⌝ 🆚 ⌞ACH⌝\n'
              '⌞DXG🇲🇽⌝ 🆚 ⌞tito calderon 🇦🇷⌝ 🆚 ⌞Park-Ji Sung🇰🇷⌝\n'
              '`[ SEMIFINALES ]`\n⌞Soneto⌝ 🆚 ⌞Oasis🇨🇱⌝\nCAMPEÓN: Oasis🇨🇱')
        _oc = [b for b in E.resolver(pj, quien=_qt) if b[0] == 'OCTAVOS' and 'DXG🇲🇽' in b[1]]
        _oc0 = [b for b in E.resolver(pj) if b[0] == 'OCTAVOS' and 'DXG🇲🇽' in b[1]]
        fpj = marcar_walkins(filas_de(dict(h, texto=pj))[0], [pj], quien=_qt)
        # el que ya se llama Oasis en octavos es el Oasis de la semi: Park-Ji Sung no se lo lleva
        px = ('# OTRA\n`[ OCTAVOS ]`\n⌞Oasis🇨🇱⌝ 🆚 ⌞Beto⌝\n⌞Park-Ji Sung🇰🇷⌝ 🆚 ⌞Caro⌝\n'
              '`[ SEMIFINALES ]`\n⌞Oasis🇨🇱⌝ 🆚 ⌞Dani⌝\n')
        _ox = [b for b in E.resolver(px, quien=_qt) if b[0] == 'OCTAVOS' and 'Caro' in b[1]]
        _sol = personas(_sv_h)('Sol')
        # 🔑 la final sin campeón y su veredicto (POESÍA CRUDA, URBF, 01/10/2026)
        pc = ('# POESÍA CRUDA\n`[ SEMIFINALES ]`\n⌞PICHULAMC 🇦🇷⌝ 🆚 ⌞Júpiter 🇲🇽⌝\n⌞Riferian 🇵🇦⌝ 🆚 ⌞Kochi 🇨🇱⌝\n'
              '`[ FINAL ]`\n⌞PICHULAMC 🇦🇷⌝ 🆚 ⌞Riferian 🇵🇦⌝\n')
        _cu = '2026-10-02T00:30:00+00:00'
        _ver_antes = E._VER_BATALLAS[0]
        E._VER_BATALLAS[0] = [{'id': '1', 'sv': 'URBF', 'g': str(h.get('guild')), 'pub': 1790900887000,
                               'a': 'PICHULAMC 🇦🇷', 'b': 'Riferian 🇵🇦', 'ganador': 'PICHULAMC 🇦🇷', 'votos': '1–0'}]
        try:
            fpc, dpc, _s = filas_de(dict(h, texto=pc, cuando=_cu))
            E._VER_BATALLAS[0] = []
            fpc0, dpc0, _s = filas_de(dict(h, texto=pc, cuando=_cu))
        finally:
            E._VER_BATALLAS[0] = _ver_antes
        # 🔑 la llave como se jugó, de #votaciones, en lugar de la del organizador (DOS GENERACIONES VOL 2, recortada):
        # el organizador puso a ACH y un «pasan 2»; en #votaciones ACH no estaba y en el de tres pasó Six solo
        _org = ('# Dos Generaciones\n`[ OCTAVOS ]`\n⌞ACH⌝ 🆚 ⌞Yor⌝ 🆚 ⌞Soneto⌝\n⌞Kurlw⌝ 🆚 ⌞Abyssus⌝ 🆚 ⌞Six⌝\n'
                '`[ FINAL ]`\n⌞Soneto⌝ 🆚 ⌞Six⌝\nCAMPEÓN: Six')
        _t0 = 1790902998000
        _hv0 = dict(h, texto=_org, cuando=_iso_de(_t0 - 600000), editado=_iso_de(_t0 + 3600000), menciones={})

        def _fv(seg, tx):
            ms = _t0 + seg * 1000
            return {'id': str((ms - 1420070400000) << 22), 'canal': 'v', 'sv': 'FFA', 'g': str(h.get('guild')),
                    'autor': 'org', 'pub': ms, 'ed': ms, 'texto': tx}
        _rv = [_fv(0, '# [ OCTAVOS ]'), _fv(10, '⌞Yor⌝ 🆚 ⌞Soneto⌝'), _fv(20, 'Soneto'),
               _fv(30, '⌞Kurlw⌝ 🆚 ⌞Abyssus⌝ 🆚 ⌞Six⌝'), _fv(40, 'Six'), _fv(50, '# [ FINAL ]'),
               _fv(60, '⌞Soneto⌝ 🆚 ⌞Six⌝'), _fv(70, 'Six')]
        _lv = E.llaves_de_veredictos(_rv)
        _gv = {'llaves': [_hv0], 'plantel': plantel(_org, {})}
        _V = llave_de_veredictos_para(_gv, _lv)
        _fver = filas_de(hallazgo_de_veredicto(_V, _hv0), nombre='Dos Generaciones', fecha='01/10')[0] if _V else []
        # la de veredictos que empieza en la FINAL (a mitad del evento) no reemplaza a nada
        _V2 = llave_de_veredictos_para(_gv, E.llaves_de_veredictos(_rv[5:]))
        # 🔑 un nombre de dos letras vale sólo si Dlx dijo de quién es: «za» es Provenza (`_cortos_a_mano()`)
        _PERS[0] = ({'za': {'id:5'}, 'provenzal': {'id:5'}, 'zz': {'id:6'}}, {'id:5', 'id:6'})
        _CORTOS[0] = {'za'}
        _za = (personas(_sv_h)('za'), personas(_sv_h)('zz'))
        _PERS[0] = ({}, set())
        fpj0 = marcar_walkins(filas_de(dict(h, texto=pj))[0], [pj], quien=personas(_sv_h))
    finally:
        _PERS[0] = _pers_antes
        _CORTOS[0] = None
        _PERS_SV.clear()
        _PERS_SV.update(_sv_antes)
    # las llaves de broma: A publicó en la pre-temporada, B una que se cargó
    # (su mensaje está en los links) y C una que nunca se cargó
    _hb = [{'autor_id': 'A1', 'autor': 'viejo', 'cuando': '2026-09-10T02:00:00+00:00', 'msg_id': '11'},
           {'autor_id': 'B2', 'autor': 'organiza', 'cuando': '2026-09-25T02:00:00+00:00', 'msg_id': '22'},
           {'autor_id': 'C3', 'autor': 'troll', 'cuando': '2026-09-30T02:00:00+00:00', 'msg_id': '33'}]
    _con = {huella_autor(_hb[0]), huella_autor(_hb[1])}
    # la llave sin título y su anuncio: la KISS OF SHINIGAMI de FFA, 02/10/2026 (anuncio 5:33 PM, llave 5:46 PM)
    _ffa = '1468472442925092958'
    _gk = {'llaves': [{'autor_id': 'G4', 'autor': 'gocho444.', 'guild': _ffa, 'msg_id': '44',
                       'cuando': '2026-10-02T21:46:00+00:00'}]}
    _ak = {'nombre': 'KISS OF SHINIGAMI', 'servidor': 'FFA', 'msg_id': 'K1', 'cuando': '2026-10-02T21:33:06',
           'horario': '20-30 m', 'autor_h': huella_autor({'autor_id': 'G4'})}
    _ak2 = {'nombre': 'OTRA COMPE', 'servidor': 'FFA', 'msg_id': 'K2', 'cuando': '2026-10-02T21:40:00',
            'horario': '', 'autor_h': huella_autor({'autor_id': 'Z9'})}
    _aviejo = {'nombre': 'LA DE LA MAÑANA', 'servidor': 'FFA', 'msg_id': 'K3', 'cuando': '2026-10-02T12:00:00',
               'horario': ''}
    _aotro = dict(_ak, servidor='SR', msg_id='K4')
    # la clave con que ✅ Decidir busca un nombre: sin bandera y sin signos
    _nn = lambda x: ''.join(c for c in __import__('unicodedata').normalize(   # noqa: E731
        'NFKD', re.sub('[\U0001F1E6-\U0001F1FF]', '', x)) if c.isalnum()).lower()
    # el equipo con UN nombre en un 2VS2 (TEAM VENECIA, Dlx 29/09/2026)
    _teq = ('# CUARTOS\n[JOTA P + IGUANA] VS [TEAM VENECIA]\n[DOS + PIYI] VS [SOUL B + CHAR]\n'
            '[PARIA + PRRR] VS [VANDU + MAKMA]\n[ELSOLAR + METO] VS [SNOW + NC]\n')

    def _feq():
        return [{'evento': 'X 2VS2', 'servidor': 'FFA', 'fecha': '28/09', 'ronda': 'cuartos',
                 'ladoA': 'JOTA P + IGUANA', 'ladoB': 'TEAM VENECIA', 'ganador': 'TEAM VENECIA',
                 'notas': ''}]
    _nada = lambda *a: None                               # noqa: E731
    _cu = '2026-09-29T01:53:58+00:00'
    _eq_sin, _eq_sin_i = marcar_equipos(_feq(), [_teq], cuando=_cu, inscripciones=[], decidir=_nada)
    _eq_con, _ = marcar_equipos(_feq(), [_teq], cuando=_cu, decidir=_nada, inscripciones=[
        {'servidor': 'FFA', 'texto': 'Team Venecia 🇲🇦🔥(RUDO+TITO)', 'cuando': '2026-09-28T23:00:00'}])
    _eq_vieja, _ = marcar_equipos(_feq(), [_teq], cuando=_cu, decidir=_nada, inscripciones=[
        {'servidor': 'FFA', 'texto': 'Team Venecia (RUDO+TITO)', 'cuando': '2026-09-25T19:00:00'}])
    _eq_choca, _eq_choca_i = marcar_equipos(_feq(), [_teq], cuando=_cu, decidir=_nada, inscripciones=[
        {'servidor': 'FFA', 'texto': 'TEAM VENECIA: Paria + Prrr', 'cuando': '2026-09-28T23:00:00'}])
    _eq_dec, _ = marcar_equipos(_feq(), [_teq], cuando=_cu, inscripciones=[],
                                decidir=lambda *a: ['Uno', 'Dos'])
    _pv = E._PERSONAS[0]
    E._PERSONAS[0] = {'teamvenecia'}            # como si fuera alguien del padrón
    try:
        _eq_per, _eq_per_i = marcar_equipos(_feq(), [_teq], cuando=_cu, inscripciones=[],
                                            decidir=_nada)
    finally:
        E._PERSONAS[0] = _pv
    # quien ganó su ronda y no siguió, con la decisión de Dlx (Geoka en la DOS GENERACIONES VOL 2, 02/10/2026: «B»)
    _fc = [{'evento': 'DOS GEN', 'servidor': 'FFA', 'fecha': '01/10', 'ronda': 'octavos', 'ladoA': 'Arez 🇪🇨',
            'ladoB': 'Geoka 🇦🇷', 'ganador': 'Geoka 🇦🇷', 'notas': 'triple (3 bandas)'},
           {'evento': 'DOS GEN', 'servidor': 'FFA', 'fecha': '01/10', 'ronda': 'cuartos', 'ladoA': 'Zignos',
            'ladoB': 'Snow', 'ganador': 'Snow', 'notas': ''}]
    _fc_si = marcar_cobra([dict(f) for f in _fc], decidir=lambda *a: {'Geoka': 'octavos'})
    _fc_no = marcar_cobra([dict(f) for f in _fc], decidir=lambda *a: {})
    # la NAVE DE FUNA de Revo (2/5): la fase con ❌, la final de dos sin
    # «CAMPEÓN» y el podio con medallas (Dlx, 29/09/2026)
    _nf = ('nave de funa:\n\n1 - [Black demon] ❌\n2 - [Darkomc] ❌\n3 - [Saiko] ❌\n4 - [Tam]\n'
           '5 - [Diego] ❌\n6 - [multi]\n7 - [Guess]\n8 - [xubaru] ❌\n\nFinal\n\n[Guess] 🆚 [tam]\n\n'
           '🥇 tam\n🥈 guess\n🥉 multi')
    _fnf, _dnf, _ = filas_de({'texto': _nf, 'guild': '1468472442925092958', 'servidor': 'FFA',
                              'fecha': '02/05'}, nombre='NAVE', fecha='02/05')
    _fase = [f for f in _fnf if f['ronda'] == 'fase de eliminación']
    # 🔑 el nombre que en ESE servidor es otra persona (Carlosss y Number VE en DDF, 03/10/2026)
    _fo = [{'ladoA': 'CARLOS🇪🇨', 'ladoB': 'NUMBER🇻🇪, Xplicit', 'ganador': 'CARLOS🇪🇨', 'notas': ''}]
    _mo = {'DDF': {'carlos': 'Carlosss', 'number': 'Number VE'}}
    _fo_ddf = otro_en_servidor([dict(f) for f in _fo], 'DDF', mapa=_mo)
    _fo_ffa = otro_en_servidor([dict(f) for f in _fo], 'FFA', mapa=_mo)
    _fo_cob = otro_en_servidor([{'ladoA': 'Sin límites 🇵🇪', 'ladoB': 'Yo mc 🇨🇱', 'ganador': '',
                                 'notas': 'cobra: Sin límites 🇵🇪; cobra: Yo mc 🇨🇱; nadie siguió: ✅ Decidir'}],
                               'FFA', mapa={'FFA': {'yomc': 'Cronox'}})
    casos = [
        ('la mitad de una llave ya cargada, con otro nombre, es la ya cargada (#409 = #366, FFA WORLD CUP); con dos '
         'batallas, otro servidor u otra semana, no',
         ya_cargada('(sin titulo)', 'FFA', '27/09', [{'ladoA': 'FULLY', 'ladoB': 'SOL'}, {'ladoA': 'Snow', 'ladoB': 'DXG'},
                                                     {'ladoA': 'YINN', 'ladoB': 'MOLUSCO'}],
                    [{'n': 366, 'sv': 'FFA', 'fecha': '27/09', 'nombre': 'FFA WORLD CUP',
                      'rondas': [{'r': 'Cuartos', 'b': [[['Fully', 'SOL'], 'Fully', ''], [['Snow', 'dxg'], 'Snow', ''],
                                                         [['Molusco', 'yinn'], 'Molusco', '']]}]}]) == 366
         and ya_cargada('(sin titulo)', 'FFA', '27/09', [{'ladoA': 'Snow', 'ladoB': 'DXG'}, {'ladoA': 'YINN', 'ladoB': 'MOLUSCO'}],
                        [{'n': 366, 'sv': 'FFA', 'fecha': '27/09', 'nombre': 'X',
                          'rondas': [{'r': 'Cuartos', 'b': [[['Snow', 'dxg'], '', ''], [['Molusco', 'yinn'], '', '']]}]}]) is None
         and ya_cargada('(sin titulo)', 'FFA', '05/10', [{'ladoA': 'FULLY', 'ladoB': 'SOL'}, {'ladoA': 'Snow', 'ladoB': 'DXG'},
                                                         {'ladoA': 'YINN', 'ladoB': 'MOLUSCO'}],
                        [{'n': 366, 'sv': 'FFA', 'fecha': '27/09', 'nombre': 'FFA WORLD CUP',
                          'rondas': [{'r': 'Cuartos', 'b': [[['Fully', 'SOL'], '', ''], [['Snow', 'dxg'], '', ''],
                                                             [['Molusco', 'yinn'], '', '']]}]}]) is None),
        ('una llave EN PAUSA —«seguimos mañana», avisado después de publicarla— espera; la de otro servidor o de antes, no',
         pausada({'llaves': [{'cuando': '2026-10-07T20:45:15+00:00', 'editado': '2026-10-07T21:16:34+00:00'}]}, 'SR',
                 [{'sv': 'SR', 'tipo': 'pausado', 'pub': 1791415920000}])
         and not pausada({'llaves': [{'cuando': '2026-10-07T20:45:15+00:00'}]}, 'FFA',
                         [{'sv': 'SR', 'tipo': 'pausado', 'pub': 1791415920000}])
         and not pausada({'llaves': [{'cuando': '2026-10-07T20:45:15+00:00'}]}, 'SR',
                         [{'sv': 'SR', 'tipo': 'pausado', 'pub': 1791300000000}])),
        ('«LLAVES» no es un título, ni la «I» de adorno entre barras ni los guiones: Gallos del Under Amateur I (Snake '
         'Rap, 07/10/2026)',
         titulo('# ▌│█║▌║▌║ 🔑  LLAVES 🔑  ║▌║▌║█│▌\n\n> ]|I{•------» (Gallos del Under Amateur I «------•}I|[ \n\n'
                '## 4️⃣ Cuartos 4️⃣ \n** (< A >) ⚔️ (< B >)**') == 'Gallos del Under Amateur I'
         and titulo('# LLAVES\n## CUARTOS\n[A] 🆚 [B]') is None),
        ('en DDF, CARLOS es Carlosss y NUMBER es Number VE (también dentro de un equipo); en FFA, nadie cambia',
         (_fo_ddf[0]['ladoA'], _fo_ddf[0]['ladoB'], _fo_ddf[0]['ganador']) == ('Carlosss', 'Number VE, Xplicit', 'Carlosss')
         and _fo_ffa[0]['ladoA'] == 'CARLOS🇪🇨'),
        ('y el «cobra: X» de la nota también: en FFA «Yo mc» es Cronox, y quien no cambia queda igual',
         _fo_cob[0]['ladoB'] == 'Cronox'
         and _fo_cob[0]['notas'] == 'cobra: Sin límites 🇵🇪; cobra: Cronox; nadie siguió: ✅ Decidir'),
        ('ganó su octavo y no siguió: con la decisión de Dlx, su batalla dice «cobra: Geoka» y nada más cambia',
         _fc_si[0]['notas'] == 'triple (3 bandas); cobra: Geoka 🇦🇷' and _fc_si[1]['notas'] == ''
         and not any('cobra' in f['notas'] for f in _fc_no)),
        ('nave de funa: la final sale del podio (🥇 tam), el 🥉 es tercero y los 5 ❌ caen en la fase',
         [(f['ladoA'], f['ganador']) for f in _fnf if f['ronda'] == 'final'] == [('tam', 'tam')]
         and [f['ladoA'] for f in _fnf if f['ronda'] == 'tercer lugar'] == ['multi']
         and sorted(f['ladoB'] for f in _fase) == ['Black demon', 'Darkomc', 'Diego', 'Saiko', 'xubaru']
         and not _dnf and all(f['participantes'] == 8 for f in _fnf)),
        ('una fase de NAVE DE FUNA no descarta el evento (la lista dice quién cayó)',
         fase_sin_batallas(_nf) is None),
        ('quien juega solo en un 2VS2 (alguien del padrón) no es un equipo: cobra como siempre',
         'Sin integrantes' not in _eq_per[0]['notas'] and not _eq_per_i),
        ('TEAM VENECIA sin inscripción: la fila queda, con «Sin integrantes», y no cobra nadie',
         _eq_sin[0]['ladoB'] == 'TEAM VENECIA' and 'Sin integrantes: TEAM VENECIA' in _eq_sin[0]['notas']
         and _eq_sin_i[0][4] == [] and equipos_con_nombre(_teq) == (['TEAM VENECIA'], 2)),
        ('con su inscripción «NOMBRE (A+B)», el lado pasa a ser A + B, también de ganador',
         _eq_con[0]['ladoB'] == 'RUDO + TITO' and _eq_con[0]['ganador'] == 'RUDO + TITO'
         and 'Equipo: TEAM VENECIA' in _eq_con[0]['notas']),
        ('la inscripción de otra noche no dice quiénes son hoy',
         _eq_vieja[0]['ladoB'] == 'TEAM VENECIA' and 'Sin integrantes' in _eq_vieja[0]['notas']),
        ('si la inscripción nombra a quien juega en otro lado de la llave, no se adivina (VOL.13)',
         _eq_choca[0]['ladoB'] == 'TEAM VENECIA' and 'otro lado' in _eq_choca_i[0][5]),
        ('lo que decidió Dlx manda', _eq_dec[0]['ladoB'] == 'Uno + Dos'),
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
        ('la «R» suelta después de la bandera es revivido; sin bandera, no (Dlx: «C»)',
         [m.group(1) for m in REVIVIDO_R.finditer(
             '▪️   [PICHULITA 🇦🇷 + SIX 🇦🇷 R] 🆚 [GOCHO 🇨🇴 R + ANA 🇦🇷]\n⌞RICKY FORT 🇦🇷 R⌝ 🆚 ⌞ROMEO R⌝\n'
             'CAMPEÓN: NADIE 🇦🇷 RODRIGO')] == ['SIX', 'GOCHO', 'RICKY FORT']),
        ('el invitado de honor no es walk-in (§9.2)',
         not any('Walk-in' in f['notas'] for f in fw)),
        ('filtros de 3 por un lugar: los que entran directo a octavos no son '
         'walk-in (FFA WORLD CUP)', not any('Walk-in' in f['notas'] for f in fwc)),
        ('… y MATI en octavos es MATICERNA en cuartos', not any(
            'MATICERNA' in f['notas'] for f in fwc)),
        ('pero el que aparece recién en cuartos sigue siendo walk-in',
         [f['notas'] for f in fwc2 if 'Walk-in' in f['notas']] == ['Walk-in 1: ZETA']),
        ('el que revive en la primera ronda ocupa dos lugares: la escala es del formato',
         repetidos_en_la_primera('# OCTAVOS\n⌞MAJI⌝ 🆚 ⌞MOTE⌝\n⌞TG⌝ 🆚 ⌞MAJI⌝\n'
                                 '# CUARTOS\n⌞MOTE⌝ 🆚 ⌞MAJI⌝\n') == 1
         and repetidos_en_la_primera('# CUARTOS\n⌞A⌝ 🆚 ⌞B⌝\n# FINAL\n⌞A⌝ 🆚 ⌞C⌝\n') == 0),
        ('el equipo con nombre de un 2VS2 son dos (TEAM VENECIA); en un MULTIVERSE o un 1vs1, nada',
         faltan_en_equipos('# CUARTOS\n[JOTA P + IGUANA] VS [TEAM VENECIA]\n[DOS + PIYI] VS [SOUL B + CHAR]\n'
                           '[PARIA + PRRR] VS [VANDU + MAKMA]\n[ELSOLAR + METO] VS [SNOW + NC]\n') == 1
         and faltan_en_equipos('# CUARTOS\n[ANA + BEA] VS [CID]\n[DAN + EVA + FEDE] VS [GUS]\n') == 0
         and faltan_en_equipos('# CUARTOS\n⌞A⌝ 🆚 ⌞B⌝\n⌞C⌝ 🆚 ⌞D⌝\n') == 0),
        # 🔑 las llaves de broma (Dlx, 28/09/2026: «A · sí»)
        ('quien ya publicó una llave que se cargó, o en la pre-temporada, es conocido; '
         'quien sólo publicó una que nunca se cargó (DENME MODERADOR LPM), no',
         autores_conocidos(_hb, links={'X|FFA|24/09': ['https://discord.com/channels/1/2/22']},
                           guardadas=[]) == {huella_autor(_hb[0]), huella_autor(_hb[1])}),
        ('una llave nueva de alguien nuevo y sin anuncio se retiene, y dice quién la publicó',
         'troll' in (llave_de_broma({'llaves': [_hb[2]]}, _con, [], 'DENME MODERADOR LPM',
                                    'URBF', '29/09') or '')),
        ('con un anuncio de su servidor que la respalda, no',
         llave_de_broma({'llaves': [_hb[2]]}, _con,
                        [{'nombre': 'DENME MODERADOR LPM', 'servidor': 'URBF',
                          'cuando': '2026-09-29T20:00:00'}], 'DENME MODERADOR LPM', 'URBF',
                        '29/09') is None),
        ('ni de alguien que ya publicó una que se cargó, ni una de antes de la regla',
         llave_de_broma({'llaves': [dict(_hb[2], autor_id='B2')]}, _con, [], 'X', 'URBF', '29/09') is None
         and llave_de_broma({'llaves': [dict(_hb[2], cuando='2026-09-27T02:00:00+00:00')]}, _con, [],
                            'X', 'URBF', '27/09') is None),
        # 🔴 dos anuncios «PRITTY FREE» el mismo día (05/10/2026): la segunda llave lleva lo que agrega su título
        ('una llave cuyo anuncio se llama como el de otro evento del día lleva lo que agrega su título',
         nombre_propio({'llaves': [{'texto': '**__ ↱🉐 | CLASIFICATORIA 3 PRITTY FREE |  🉐 ↲__**\n\n'
                                              '**[•OCTAVOS DE FINAL•]**\n▪️ [Ana] 🆚 [Bea]'}]}, 'PRITTY FREE')
         == 'PRITTY FREE CLASIFICATORIA 3'),
        ('y si ningún renglón nombra al anuncio, la hora del anuncio',
         nombre_propio({'llaves': [{'texto': '`[ OCTAVOS ]`\n⌞Ana⌝ 🆚 ⌞Bea⌝'}]}, 'PRITTY FREE',
                       {'cuando': '2026-10-06T02:41:51'}) == 'PRITTY FREE 10:41 PM'),
        # 🔑 la llave sin título toma el nombre de su anuncio: la hora y, si hay dos, quién publicó (Dlx, 03/10/2026)
        ('una llave sin título es del anuncio de su servidor que arranca a esa hora (KISS OF SHINIGAMI, FFA)',
         (anuncio_de_llave(_gk, [_aviejo, _aotro, _ak])[0] or {}).get('msg_id') == 'K1'),
        ('con dos anuncios a esa hora, el que publicó la misma cuenta; si no hay cómo separarlos, ninguno',
         (anuncio_de_llave(_gk, [_ak2, _ak])[0] or {}).get('msg_id') == 'K1'
         and anuncio_de_llave(_gk, [_ak2, dict(_ak, autor_h='')])[0] is None
         and '2 anuncios' in anuncio_de_llave(_gk, [_ak2, dict(_ak, autor_h='')])[1]),
        ('un anuncio que ya tiene su llave no se lo lleva otra, y sin ninguno a esa hora, ninguno',
         anuncio_de_llave(_gk, [_ak], tomados={'K1'})[0] is None
         and anuncio_de_llave(_gk, [_aviejo, _aotro])[0] is None),
        ('la hora sola no respalda a quien nunca publicó una llave: la misma cuenta que el anuncio, sí',
         'otra cuenta' in (llave_de_broma(_gk, _con, [], 'KISS OF SHINIGAMI', 'FFA', '02/10',
                                          inferido=dict(_ak, autor_h='otra')) or '')
         and llave_de_broma(_gk, _con, [], 'KISS OF SHINIGAMI', 'FFA', '02/10', inferido=_ak) is None
         and 'no trae título' in (llave_de_broma(_gk, _con, [], '(sin titulo)', 'FFA', '02/10',
                                                 por_hora='ningún anuncio de FFA a esa hora') or '')),
        # 🔑 el podio con mención (Dlx, 28/09/2026: «A · sí, como las inscripciones»)
        ('el podio con una mención por puesto dice quién es cada uno (RAP EXHIBITION 1/8)',
         menciones_podio('• 1ER PUESTO: <@639> \n• 2DO PUESTO: <@535> \n• 3ER PUESTO: <@716>')
         == {1: '639', 2: '535', 3: '716'}),
        ('pero no el equipo con dos menciones, ni el MVP, ni un puesto con dos cuentas',
         menciones_podio('CAMPEÓN: <@1>🇨🇱&<@2>🇨🇴\n🥈 SUB-CAMPEÓN: <@3>\nM.V.P: <@4>\n'
                         '3ER PUESTO: <@5>\nTERCER LUGAR: <@6>') == {2: '3'}),
        ('y va contra la final: 1º el que ganó, 2º el otro; nunca un lado de equipo',
         podio_de_grupo({'llaves': [{'texto': '1ER PUESTO: <@639>\n2DO PUESTO: <@535>'}]},
                        [{'ronda': 'final', 'ladoA': 'ANTORCHA OLÍMPICA', 'ladoB': 'ZETA 🇩🇴',
                          'ganador': 'ANTORCHA OLÍMPICA'}], _nn) == {'antorchaolimpica': '639', 'zeta': '535'}
         and podio_de_grupo({'llaves': [{'texto': '1ER PUESTO: <@639>'}]},
                            [{'ronda': 'final', 'ladoA': 'A + B', 'ladoB': 'C + D', 'ganador': 'A + B'}],
                            _nn) == {}),
        # 🔑 lo demás que la llave dice de quién es quién (01/10/2026)
        ('`NOMBRE <@id>` en cualquier renglón del podio: el MVP, dos terceros, «SEGUNDO» sin PUESTO',
         menciones_con_nombre('TERCER LUGAR: 🇦🇷EZEE <@3>🇦🇷\n🉐 𝄆 **__3ER PUESTO:__** OKAM🇨🇷/MASINO🇨🇱 <@1>/<@2>\n'
                              '# SEGUNDO <:T:9> : BLOODY 🇨🇴 <@4>\nMVP: MATI CERNA🇦🇷 <@5>')
         == {'ezee': '3', 'okam': '1', 'masino': '2', 'bloody': '4', 'maticerna': '5'}),
        ('pero no una batalla con menciones, ni dos nombres para una mención',
         menciones_con_nombre('[<@1>🇪🇨] 🈯 **[<@2>🇺🇾]**\nCAMPEÓN: A + B <@7>') == {}),
        ('y el grupo junta lo de sus llaves: la mención que pasó y el nombre que creció',
         identidad_de_grupo({'llaves': [{'texto': 'MVP: SOL🇵🇪 <@8>', '_cambios': [
             ('mencion', '9', 'SHULIOT🇦🇷'), ('crece', 'MATI🇦🇷', 'MATICERNA🇦🇷')]}]})
         == {'menciones': {'sol': '8', 'shuliot': '9'}, 'crece': [['MATI🇦🇷', 'MATICERNA🇦🇷']]}),
        ('el que pasó octavos escrito como mención no es walk-in (MARRUECOS)',
         not any('Walk-in' in f['notas'] for f in fwm)),
        ('… y sin los nombres de la mención lo era: la prueba mide algo',
         any('Walk-in 1: PROVENZA' in f['notas'] for f in fwm0)),
        ('la misma persona con otro nombre pasa de ronda: «Park-Ji Sung» es Oasis (Dos Generaciones Vol 2)',
         _oc and _oc[0][2] == 'Oasis🇨🇱' and 'Oasis🇨🇱' in _oc[0][1] and 'Park-Ji Sung🇰🇷' not in _oc[0][1]),
        ('… y en cuartos no es walk-in: el campeón cobra entero',
         not any('Walk-in' in f['notas'] for f in fpj)),
        ('… y sin saber quién es quién, como antes: sin ganador y walk-in (la prueba mide algo)',
         _oc0 and _oc0[0][2] is None and any('Walk-in 1: Oasis' in f['notas'] for f in fpj0)),
        ('… pero el nombre que ya es de otro por su propio nombre no se le da a nadie más',
         _ox and _ox[0][2] is None),
        ('… y un nombre de dos personas de la Lista no es de ninguna',
         _sol == frozenset()),
        ('un nombre de dos letras no es de nadie, salvo que Dlx haya dicho de quién: «za» es Provenza',
         _za == (frozenset({'id:5'}), frozenset())),
        ('la final sin campeón la decide #veredictos: hay campeón y la fila lo dice (POESÍA CRUDA)',
         tiene_campeon(fpc) and any(f['ronda'] == 'final' and E.norm(f['ganador']) == 'pichulamc'
                                    and 'veredictos' in f['notas'] for f in fpc)
         and not any(str(d[1]).upper() == 'FINAL' for d in dpc)),
        ('… y sin el veredicto, como antes: sin campeón y la pregunta a ✅ Decidir (la prueba mide algo)',
         not tiene_campeon(fpc0) and any(str(d[1]).upper() == 'FINAL' for d in dpc0)),
        ('la llave de #votaciones es ESTE evento y reemplaza a la del organizador',
         bool(_V) and tiene_campeon(_fver)),
        ('… y manda lo que se jugó: ACH no peleó, y en el de tres pasó Six solo (Abyssus cae ahí)',
         not any('ACH' in (f['ladoA'], f['ladoB']) for f in _fver)
         and any(f['ronda'] == 'octavos' and f['ganador'] == 'Six' and f['ladoB'] == 'Abyssus' for f in _fver)),
        ('… pero la que empieza a mitad del evento no reemplaza a nadie', _V2 is None),
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

    # 🔴 EL SORTEO REHECHO: DESGRACIAS EN TOKYO VOL 15 MULTIVERSE (28/09/2026),
    # los dos mensajes de verdad, recortados a los octavos
    print('\n  el sorteo que el organizador rehízo')
    _t = lambda x: E.traducir(E.plano(x))                            # noqa: E731
    vieja = _t('# DESGRACIAS EN TOKYO VOL 15 MULTIVERSE\n# ▪️ [•OCTAVOS DE FINAL•]\n'
               '▪️   [TUSICARIO 🇨🇱 + KOREY 🇨🇱] 🆚 [JUASMIO 🇨🇴]\n'
               '▪️   [YINN 🇲🇦 + VELATZ 🇨🇱 + PROVENZA 🇺🇲] 🆚 [TEITO  🇨🇴]\n'
               '▪️   [PARK JI SUNG 🇰🇷] 🆚 [LIAM 🇺🇾]\n'
               '▪️   [MAJIZTRAL 🇨🇴] 🆚 [BOOTRAX HUMILDE 🇵🇪 + TROT 🇪🇦]\n'
               '▪️   [OG 🇻🇪] 🆚 [CINEXFILO 🇻🇪]\n▪️   [] 🆚 []')
    nueva = _t('# DESGRACIAS EN TOKYO VOL 15 MULTIVERSE\n# ▪️ [•OCTAVOS DE FINAL•]\n'
               '▪️   [SNOW 🇨🇴] 🆚 [ABYSSUS 🇨🇦]\n'
               '▪️   [PRAISERIZA 🇻🇪] 🆚 [BOOTRAX HUMILDE 🇵🇪 + TROT 🇪🇸]\n'
               '▪️   [OG 🇻🇪] 🆚 [VELATZ 🇨🇱 + YINN 🇲🇦 + PROVENZA 🇺🇸]\n'
               '▪️   [TUSICARIO 🇨🇱 + KOREY 🇨🇱] 🆚 [CINEXFILO 🇻🇪]\n'
               '▪️   [TEITO 🇨🇴 + MAJIZTRAL 🇨🇴] 🆚 [JUASMIO 🇨🇴]\n'
               '▪️   [LIAM 🇺🇾] 🆚 [PARK JI SUNG 🇰🇷]\n▪️   [MHS 🇦🇷] 🆚 []')
    hv = {'texto': vieja, 'cuando': '2026-09-28T17:14:00+00:00'}
    hn = {'texto': nueva, 'cuando': '2026-09-28T17:33:00+00:00'}
    llena = _t(nueva + '\n# ▪️ [•CUARTOS DE FINAL•]\n▪️   [SNOW 🇨🇴] 🆚 [OG 🇻🇪]')
    semis = _t('# DESGRACIAS EN TOKYO VOL 15 MULTIVERSE\n# ▪️ [•SEMI - FINAL•]\n'
               '▪️   [SNOW 🇨🇴] 🆚 [LIAM 🇺🇾]')
    casos = [
        ('otro sorteo de la misma ronda: se queda la llave nueva',
         sin_sorteos_viejos([hv, hn]) == [hn] and hv.get('_sorteo_viejo')),
        ('la misma llave reposteada se sigue juntando',
         len(sin_sorteos_viejos([dict(hn, cuando='2026-09-28T17:40:00+00:00'), hn])) == 2),
        ('la misma llave, más llena, también',
         len(sin_sorteos_viejos([hn, {'texto': llena, 'cuando': '2026-09-28T19:00:00+00:00'}])) == 2),
        ('y la mitad de una llave partida, que empieza en otra ronda, no se toca',
         len(sin_sorteos_viejos([hn, {'texto': semis, 'cuando': '2026-09-28T20:00:00+00:00'}])) == 2),
    ]
    for que, ok in casos:
        mal += not ok
        print('   %s %s' % ('✅' if ok else '🔴', que))

    # ❤️ LOS 5 VIDAS DE #VEREDICTOS, con la SNAKE ARENA VOL. 2 de verdad —la
    # del contrato con la página (`bot/llaves_casos.json`)—
    print('\n  los 5 vidas de #veredictos')
    import decidir as DEC
    with io.open(os.path.join(SCR, 'llaves_casos.json'), encoding='utf-8') as f:
        _filas = (json.load(f).get('veredictos') or [{}])[0].get('filas') or []
    _ev = (E.veredictos(_filas) or [None])[0]
    _t0 = int(datetime.datetime(2026, 9, 27, 21, 38, tzinfo=datetime.timezone.utc).timestamp() * 1000)
    _hv = {'guild': '492346406976356374', 'vidas': _ev}
    _ann = [{'servidor': 'SR', 'nombre': 'SNAKE ARENA VOL. 2', 'horario': '<t:1790542800:F>'},
            {'servidor': 'SR', 'nombre': 'SNAKE INSIGNIA', 'horario': '<t:1790564400:F>'},
            {'servidor': 'FFA', 'nombre': 'OTRO', 'horario': '<t:1790542800:F>'}]
    _ult = '5 vidas, batalla 24'
    _det = DEC.detalle_batalla('SNAKE ARENA VOL. 2', 'SR', '27/09', _ult, ['DELUXE 🇦🇷', 'JIMMY 🇵🇪'])
    _antes = DEC._decisiones
    try:
        DEC._decisiones = lambda: {}
        f1, d1, s1 = filas_vidas(_hv, 'SNAKE ARENA VOL. 2', 'SR', '27/09') if _ev else ([], [], {})
        DEC._decisiones = lambda: {'batallas': {DEC.clave_batalla(_det): {'ganador': 'DELUXE 🇦🇷'}}}
        f2, d2, _s2 = filas_vidas(_hv, 'SNAKE ARENA VOL. 2', 'SR', '27/09') if _ev else ([], [], {})
    finally:
        DEC._decisiones = _antes
    casos = [
        ('el 5 vidas lleva el nombre de su anuncio, el de SU servidor y a SU hora',
         _ev is not None and abs(E._ms(_ev['batallas'][0][3]) - _t0) < 60000
         and nombre_vidas(_hv, _ann) == 'SNAKE ARENA VOL. 2'),
        ('sin anuncio, «5 VIDAS» y la hora ET: dos del mismo día no son uno',
         nombre_vidas(_hv, []) == '5 VIDAS 17:38'),
        ('la bandera va después del nombre, como en el resto de la Liga',
         _bandera_al_final('🇦🇷 DELUXE') == 'DELUXE 🇦🇷'
         and _bandera_al_final('DELUXE 🇦🇷') == 'DELUXE 🇦🇷'),
        ('la batalla pareja en el texto se pregunta, con su número',
         len(f1) == 22 and len(d1) == 1 and d1[0][1] == _ult and d1[0][4] == ['DELUXE 🇦🇷', 'JIMMY 🇵🇪']),
        ('la réplica empatada no se pregunta: la decide la de después',
         any('réplica' in k for k in s1)),
        ('con la respuesta de ✅ Decidir entra EN SU LUGAR, y son las 23 de la carga a mano',
         len(f2) == 23 and not d2 and f2[-1]['ganador'] == 'DELUXE 🇦🇷'
         and f2[-1]['notas'] == 'batalla 24 · ganador: ✅ Decidir'),
        ('cada fila lleva su número de batalla: dos revanchas no son una copia',
         len({x['notas'].split(' · ')[0] for x in f2}) == 23),
        ('las revanchas se quedan: DELUXE contra FAZER cinco veces',
         sum(1 for x in f2 if {x['ladoA'], x['ladoB']} == {'DELUXE 🇦🇷', 'FAZER 🇦🇷'}) == 5),
        ('y el resumen para confirmar dice el campeón y el orden',
         resumen_vidas(f2, 5).startswith('23 batallas · 5 raperos | Campeón: DELUXE 🇦🇷 | 2.º ')
         if f2 else False),
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
    # las batallas y las llaves de #veredictos de esta lectura, también si vino guardada (`comparar_lector.py`): ver
    # `escuchar.ganador_por_veredicto()` y `llave_de_veredictos_para()`
    E._VER_BATALLAS[0] = info.get('ver_batallas') or E._VER_BATALLAS[0] or []
    E._VER_LLAVES[0] = info.get('ver_llaves') or E._VER_LLAVES[0] or []
    n_ch, n_msg = info['canales'], info['mensajes']
    # 🔑 QUIÉN YA PUBLICÓ UNA LLAVE, con la lista entera —la pre-temporada
    # también cuenta—, antes de filtrar. Ver `llave_de_broma()`.
    conocidos = autores_conocidos(hallazgos)
    try:
        with io.open(os.path.join(BASE, 'datos', 'anuncios.json'), encoding='utf-8') as _f:
            anuncios_l = (json.load(_f) or {}).get('anuncios') or []
    except (OSError, ValueError):
        anuncios_l = []
    hallazgos, viejas = de_esta_temporada(hallazgos)
    for h in hallazgos:
        # `escuchar.barrer` devuelve `cuando` en ISO; la hoja usa dd/mm
        h['fecha'] = _ddmm(h.get('cuando'))
    n_v = sum(1 for h in hallazgos if h.get('vidas'))
    print('   barrido %s · %d canal(es) · %d mensaje(s) · %d llave(s)%s'
          % ('completo' if info['completo'] else 'dirigido',
             n_ch, n_msg, len(hallazgos) - n_v,
             ' · %d 5 vidas de #veredictos' % n_v if n_v else ''))
    if info.get('nuevos'):
        print('   🆕 el bot está en un servidor nuevo: %s — por eso el '
              'barrido es completo' % ', '.join(info['nuevos']))
    if viejas:
        print('   %d llave(s) de antes del %s: fuera de la %s'
              % (viejas, TEMP.INICIO[:10], TEMP.ACTUAL.upper()))
    print('')

    grupos = agrupar(hallazgos)
    print('   %d llave(s) -> %d evento(s) distintos\n'
          % (len(hallazgos), len(grupos)))

    # 🔑 LAS LLAVES SIN TÍTULO TOMAN EL NOMBRE DE SU ANUNCIO (Dlx, 03/10/2026): ver `anuncio_de_llave()`. Antes, los
    # anuncios que ya tienen su llave —por el nombre, o porque una corrida anterior se lo dio a otra—: dos llaves no
    # se llevan el mismo.
    import llaves_web as LW
    guardados, nombres_nuevos, sin_titulo = _nombres_guardados(), {}, []
    tomados = {str(x.get('anuncio') or '') for x in guardados.values()}
    # 🔴 Y DE QUÉ ANUNCIO ES CADA NOMBRE YA GUARDADO: `(nombre, servidor, fecha) -> anuncio`. Ver «dos anuncios con el
    # mismo nombre el mismo día», abajo
    de_anuncio = {}
    for g in grupos:
        _y = next((guardados[str(h.get('msg_id'))] for h in g['llaves'] if str(h.get('msg_id') or '') in guardados), None)
        if _y and _y.get('anuncio'):
            de_anuncio.setdefault((_y.get('nombre') or '', _y.get('sv') or '', fecha_de(g)), str(_y['anuncio']))
    for g in grupos:
        if not g['llaves'] or nombre_de(g) == '(sin titulo)':
            continue
        try:
            _d = datetime.date.fromisoformat(LW.fecha_iso(fecha_de(g)))
        except ValueError:
            continue
        _a = LW.anuncio_de(nombre_de(g), codigo_servidor(g['llaves'][0].get('guild'))[0], _d, anuncios_l)
        if _a:
            tomados.add(str(_a.get('msg_id') or ''))
    _por_id = {str(a.get('msg_id') or ''): a for a in anuncios_l}

    todas, dudas, sabidas = [], [], collections.Counter()
    ya_cargadas = []   # la que ya está en el ranking con otro nombre: ver `ya_cargada()`
    en_curso, incompletos, retenidos, descartados = [], [], [], []
    esperan, vidas_cargados, vidas_b = [], [], []   # los 5 vidas de #veredictos
    de_veredictos = []                                # las llaves que se cargaron como se jugaron, de #veredictos
    links_llaves = {}                   # 'evento|servidor|fecha' -> [links]
    podio_ev = {}                       # 'evento|servidor|fecha' -> {nombre: id}
    ident_ev = {}                       # 'evento|servidor|fecha' -> lo de identidad_de_grupo()
    equipos_inf = []                    # los equipos con un solo nombre
    link_de = {}                        # (evento, fecha) y evento -> link
    import decidir as DEC
    repes = 0
    decididas = 0
    for g in grupos:
        # 🔴 EL SORTEO QUE EL ORGANIZADOR REHÍZO NO CUENTA: ver
        # `sin_sorteos_viejos()`. Antes del nombre y la fecha, que salen de
        # las llaves que quedan.
        antes_n = len(g['llaves'])
        g['llaves'] = sin_sorteos_viejos(g['llaves'])
        if len(g['llaves']) < antes_n:
            sabidas['sorteo rehecho: se queda la llave nueva'] += antes_n - len(g['llaves'])
        # 🔴 UN NOMBRE POR GRUPO Y LAS BATALLAS SIN REPETIR. Ver
        # `nombre_de()` y `sin_repetir()`: dos mensajes del mismo evento
        # daban dos nombres -> dos numeros de evento -> contado dos
        # veces, que es el unico error de esta cadena que no se arregla
        # volviendo a correr.
        nom, fec = nombre_de(g), fecha_de(g)
        # 🔑 SIN TÍTULO, EL NOMBRE DE SU ANUNCIO: por la hora y, si hay dos, por quién publicó los dos. Primero el que
        # ya se le dio (`NOMBRES`), que manda aunque después aparezca un título: el nombre es un tercio de la identidad
        # del evento, y cambiarlo lo carga otra vez con otro número. ⚠️ No a un pedazo suelto (`_chico`): una final sola
        # no dice de qué evento es, y se llevaría el nombre de otro.
        inferido, por_hora = None, ''
        _ya = next((guardados[str(h.get('msg_id'))] for h in g['llaves']
                    if str(h.get('msg_id') or '') in guardados), None)
        if _ya:
            inferido = dict(_ya)
            # la huella de quien publicó el anuncio, si la de entonces faltaba y el anuncio sigue
            if not inferido.get('autor_h') and (_por_id.get(inferido.get('anuncio') or '') or {}).get('autor_h'):
                inferido['autor_h'] = _por_id[inferido['anuncio']]['autor_h']
            # y para cada mensaje del grupo: si la llave se reposteó y el mensaje viejo se borra, el nombre sigue
            for h in g['llaves']:
                if h.get('msg_id') and guardados.get(str(h['msg_id'])) != inferido:
                    nombres_nuevos[str(h['msg_id'])] = inferido
            nom, por_hora = inferido['nombre'], 'el que ya tenía'
        elif nom == '(sin titulo)' and g['llaves'] and not g['llaves'][0].get('_chico') \
                and not any(h.get('vidas') for h in g['llaves']):
            inferido, por_hora = anuncio_de_llave(g, anuncios_l, tomados)
            if inferido:
                nom = inferido['nombre'].strip()
                tomados.add(str(inferido.get('msg_id') or ''))
                _sv_i, _aid = codigo_servidor(g['llaves'][0].get('guild'))[0], str(inferido.get('msg_id') or '')
                # 🔴 DOS ANUNCIOS CON EL MISMO NOMBRE EL MISMO DÍA SON DOS EVENTOS (06/10/2026). FFA hizo dos «PRITTY
                # FREE» el 05/10 —la Clasificatoria 2 a la 1 AM y la 3 a las 10:55 PM—, cada llave tomó el nombre de
                # su anuncio y, con la misma (nombre, servidor, fecha), quedaron en UN evento: el #402, con dos
                # finales, y la Clasificatoria 3 sin página (Snow: «la página no puso esa compe»). Dos llaves del
                # MISMO anuncio sí son uno —una llave en dos mensajes—; de dos anuncios, no: la segunda lleva lo que
                # agrega su título, o la hora (`nombre_propio()`). Un nombre ya guardado no se toca: es su identidad
                _otro = de_anuncio.get((nom, _sv_i, fec))
                if _otro and _aid and _otro != _aid:
                    _antes, nom = nom, nombre_propio(g, nom, inferido)
                    por_hora += ' · «%s» ya era de otro anuncio ese día: queda «%s»' % (_antes, nom)
                de_anuncio.setdefault((nom, _sv_i, fec), _aid)
                _r = {'nombre': nom, 'anuncio': _aid, 'sv': _sv_i, 'autor_h': inferido.get('autor_h') or ''}
                for h in g['llaves']:
                    if h.get('msg_id'):
                        nombres_nuevos[str(h['msg_id'])] = _r
        # 🔴 EL NOMBRE DE UN 5 VIDAS TAMBIÉN SE GUARDA (07/10/2026). `nombre_vidas()` lo saca del anuncio a esa hora y,
        # sin anuncio, de la hora: la corrida de las 11:33 AM leyó la tanda de FFA de las 7:57 sin su anuncio y la cargó
        # como «5 VIDAS 07:57» (#420); la de las 11:57 ya lo tenía y la cargó OTRA VEZ como «MAÑANA DE LLUVIA VOL 1»
        # (#421). El nombre es un tercio de la identidad: el primero que se le da, queda
        if not _ya:
            for h in g['llaves']:
                if h.get('vidas') and h.get('msg_id'):
                    nombres_nuevos[str(h['msg_id'])] = {'nombre': nom, 'anuncio': '', 'autor_h': '',
                                                        'sv': codigo_servidor(h.get('guild'))[0]}
        if inferido is not None or nom == '(sin titulo)':
            sin_titulo.append((nom, codigo_servidor((g['llaves'] or [{}])[0].get('guild'))[0], fec, por_hora,
                               inferido is not None))
        # 🔑 EL LINK DE LA LLAVE MÁS NUEVA DEL GRUPO, para que la pregunta
        # de ✅ Decidir sobre este evento lleve al mensaje: «(sin titulo)»
        # sin link obligaba a buscar la llave a mano en tres servidores.
        _lk = ['https://discord.com/channels/%s/%s/%s'
               % (h['guild'], h['canal_id'], h['msg_id'])
               for h in sorted(g['llaves'], key=lambda x: str(x.get('cuando') or ''))
               if h.get('guild') and h.get('canal_id') and h.get('msg_id')]
        # 🔴 CON EL SERVIDOR EN LA CLAVE. Era `(nombre, fecha)` y `nombre`:
        # dos llaves «(sin titulo)» de dos servidores daban la misma clave y
        # la pregunta de una llevaba al mensaje de la otra (auditoría del
        # 25/09/2026). Por nombre solo queda nada más si ese nombre es de UN
        # grupo: ante la duda, sin link, que es mejor que el link equivocado.
        if _lk:
            for _h in g['llaves']:
                link_de[(nom, codigo_servidor(_h.get('guild'))[0], fec)] = _lk[-1]
            link_de[nom] = None if nom in link_de else _lk[-1]
        # 🔑 LA LLAVE COMO SE JUGÓ, DE #VEREDICTOS, MANDA (02/10/2026). Dlx: *«el orden verdadero de las llaves para ese
        # evento estaba en el canal de veredictos»*. La DOS GENERACIONES VOL 2 (FFA) tenía la llave del organizador mal
        # actualizada —ACH y DXG que no pelearon, un «pasan 2» que no fue, un octavo sin nadie— y en #votaciones estaba
        # la noche entera. Si una llave de veredictos es ESTE evento y está completa, se cargan sus batallas en lugar de
        # las del organizador: ver `llave_de_veredictos_para()`. El nombre, la fecha y el link siguen siendo del grupo
        _v = llave_de_veredictos_para(g)
        if _v:
            _sv_v = codigo_servidor(_v['g'])[0]
            _hv = hallazgo_de_veredicto(_v, g['llaves'][0], quien=personas(
                _sv_v, {d: n for h in g['llaves'] for d, n in (h.get('menciones') or {}).items()}),
                conocidos=inscriptos_de(_sv_v))
            g = dict(g, llaves=[_hv], plantel=plantel(_hv['texto']))
            de_veredictos.append((nom, codigo_servidor(_v['g'])[0], fec, len(_v['batallas'])))
        del_grupo, d_grupo = [], []
        for h in g['llaves']:
            f, d, sab = filas_de(h, nombre=nom, fecha=fec,
                                 gente_grupo=g['plantel'])
            del_grupo += f
            d_grupo += d
            sabidas.update(sab)
        _txt = [h.get('texto') or '' for h in g['llaves']]
        # los nombres de cada mención de estas llaves, para los walk-ins
        _ids = {}
        for h in g['llaves']:
            for did, ns in ids_de(h).items():
                _ids.setdefault(did, [])
                _ids[did] += [n for n in ns if n not in _ids[did]]
        # ⚠️ LAS MARCAS DE LLAVE NO SON PARA UN 5 VIDAS: `sin_repetir()` se
        # comería las revanchas, y las marcas tocan las filas en su lugar
        _quien = personas(codigo_servidor((g['llaves'][0] if g['llaves'] else {}).get('guild'))[0],
                          {d: n for h in g['llaves'] for d, n in (h.get('menciones') or {}).items()})
        limpias = [] if any(h.get('vidas') for h in g['llaves']) else marcar_revividos(
            marcar_walkins(marcar_pokemones(sin_repetir(del_grupo), _txt), _txt, _ids, quien=_quien),
            _txt)
        # 🔑 EL EQUIPO CON UN SOLO NOMBRE (TEAM VENECIA), AL FINAL: el revivido
        # y el walk-in se miran con la llave tal cual la escribieron. Ver
        # `marcar_equipos()`.
        if limpias:
            _cu = min((str(h.get('cuando') or '') for h in g['llaves']), default='')
            limpias, _inf = marcar_equipos(limpias, _txt, cuando=_cu)
            equipos_inf += _inf
            # quien ganó su ronda y no siguió, si Dlx dijo que la cobra (Geoka, 02/10/2026)
            limpias = marcar_cobra(limpias)
            # y el nombre que en ESE servidor es otra persona (Carlosss y Number VE en DDF): ver `otro_en_servidor()`
            limpias = otro_en_servidor(limpias, codigo_servidor((g['llaves'][0] if g['llaves'] else {}).get('guild'))[0])

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
        # 🔑 UN EVENTO DE VIDAS DE #VEREDICTOS (Dlx, 28/09/2026: «A y b»): se
        # carga solo (A) y va a ✅ Decidir para confirmarlo (B). Ver
        # `filas_vidas()` y `escuchar.vidas()`.
        #
        # ⚠️ SUS FILAS VAN TAL CUAL, sin `sin_repetir()` ni las marcas de
        # llave: la misma pareja se cruza varias veces y el orden es el dato.
        vs = [h for h in g['llaves'] if h.get('vidas')]
        if vs and ligas:
            V = vs[0]['vidas']
            hq = horas_quieta(g)
            # en juego: la tanda se corta a los 45 min sin mensajes
            if not V['terminada'] and hq is not None and hq < VIDAS_CERRADO_H:
                en_curso.append((nom, hq))
                continue
            # 🔴 UNA BATALLA SIN GANADOR FRENA EL EVENTO ENTERO: cambia quién
            # cayó y cuándo. Se pregunta, y el evento espera la respuesta —no
            # es un bracket incompleto—.
            if d_grupo:
                for d in d_grupo:
                    dudas.append(tuple(d) + (DEC.detalle_batalla(nom, ligas[0], fec, d[1], d[4]),
                                             _lk[0] if _lk else ''))
                esperan.append((nom, len(d_grupo)))
                continue
            if not del_grupo:
                continue
            todas += del_grupo
            links_llaves['|'.join((nom, ligas[0], fec))] = _lk
            vidas_cargados.append((nom, ligas[0], fec, len(del_grupo)))
            if dec is None:
                vidas_b.append(('Vidas cargado', 'veredictos de Discord',
                                '%s · %s · %s' % (nom, ligas[0], fec),
                                resumen_vidas(del_grupo, V['vidas'])
                                + (' · %s' % _lk[0] if _lk else '')))
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
        # 🔑 Y LA LLAVE DE BROMA: autor nuevo y sin anuncio (Dlx, 28/09, «A»)
        if ligas and not motivo and dec != 'cuenta':
            motivo = llave_de_broma(g, conocidos, anuncios_l, nom, ligas[0], fec,
                                    inferido=inferido, por_hora=por_hora)
        if ligas and motivo and dec != 'cuenta':
            retenidos.append((nom, ligas[0], fec, motivo))
            continue
        # 🔑 LA BATALLA QUE DECIDIÓ DLX EN ✅ DECIDIR entra como una batalla
        # más: el que perdió cobra su ronda y, de a dos, es un duelo. La que
        # sigue sin decidir se pregunta sola, UNA POR BATALLA (ver
        # `decidir.detalle_batalla()`), con el link de la llave.
        # 🔴 Y VA ANTES DE PREGUNTAR POR EL CAMPEÓN (05/10/2026): la final que
        # decidió Dlx ES el campeón. Iba después, así que una llave cuya final
        # no lo decía quedaba «incompleta» aunque Dlx hubiera dicho quién ganó
        # (el torneo de grupos de la ACADEMIA del 03/10: *«2. Abyssus»*).
        n_leidas = len(limpias)   # antes de sumar lo decidido: ver `repes`
        base, quedan, _dec0 = (limpias[0] if limpias else {}), [], decididas
        for d in d_grupo:
            if len(d) < 5 or not ligas:
                quedan.append(d)
                continue
            det = DEC.detalle_batalla(nom, ligas[0], fec, d[1], d[4])
            gano = DEC.decision_batalla(det)
            if gano is None:
                quedan.append(tuple(d) + (det, _lk[-1] if _lk else ''))
                continue
            decididas += 1
            # 🔑 SE JUGÓ Y NADIE SIGUIÓ (`decidir.NADIE`, 07/10/2026): una fila por cada uno contra el primero, sin
            # ganador —no hay duelo— y con `cobra:` para todos, así cada uno cobra la ronda (`motor`, el bucle COBRA)
            if gano == DEC.NADIE:
                lados = list(d[4])
                for otro in lados[1:]:
                    limpias.append({
                        'evento': base.get('evento') or nom, 'servidor': base.get('servidor') or ligas[0],
                        'fecha': base.get('fecha') or fec,
                        'participantes': base.get('participantes') or len(g['plantel']),
                        'ronda': d[1].lower(), 'ladoA': lados[0], 'ladoB': otro, 'ganador': '',
                        'notas': '; '.join('cobra: %s' % x for x in lados) + '; nadie siguió: ✅ Decidir'})
                continue
            for otro in [x for x in d[4] if x != gano] if gano else []:
                limpias.append({
                    'evento': base.get('evento') or nom, 'servidor': base.get('servidor') or ligas[0],
                    'fecha': base.get('fecha') or fec,
                    'participantes': base.get('participantes') or len(g['plantel']),
                    'ronda': d[1].lower(), 'ladoA': gano, 'ladoB': otro, 'ganador': gano,
                    'notas': ('triple (%d bandas); ' % len(d[4]) if len(d[4]) > 2 else '')
                    + 'ganador: ✅ Decidir'})
        d_grupo = quedan
        # y las filas que sumó ✅ Decidir, con los nombres que en ESE servidor son otra persona (`otro_en_servidor()` ya
        # corrió sobre las leídas; aplicarlo otra vez no cambia lo que ya estaba): «Yo mc» en FFA es Cronox (07/10/2026)
        if decididas and ligas:
            limpias = otro_en_servidor(limpias, ligas[0])
        # 🔑 Y LOS WALK-INS, OTRA VEZ, CON LAS FILAS DE ✅ DECIDIR (07/10/2026). Se marcaban antes de sumarlas, así que
        # quien jugó una batalla decidida no constaba en esa ronda: en la DEM UZBEKISTAN (FFA, 06/10) Provenza ganó sus
        # cuartos como «za» —«pasó Za», Dlx— y salía «Walk-in 2» en semis; y Saz, que entró de reemplazo a esos
        # cuartos, no salía walk-in. Sólo en las llaves con algo decidido en esta corrida: las demás no cambian.
        if decididas > _dec0 and limpias and not any(h.get('vidas') for h in g['llaves']):
            for f in limpias:
                if 'Walk-in' in str(f.get('notas') or ''):
                    f['notas'] = '; '.join(x for x in re.split(r'\s*;\s*', f['notas'])
                                           if x and not re.match(r'Walk-in \d+:', x))
            limpias = marcar_walkins(limpias, _txt, _ids, quien=_quien)
        # 🔑 LA FINAL QUE LA LLAVE NO ESCRIBIÓ, si Dlx dijo cuál fue (`final` en la decisión del evento): COMPE DE
        # UDDI (22/09) puso en la final sólo «ERIAN» —el ganador— y nunca la batalla (Dlx: *«3. Sí»*, ganó Erian).
        fd = DEC.final_decidida(nom, ligas[0], fec) if ligas else None
        if fd and not tiene_campeon(limpias):
            for otro in [x for x in fd['lados'] if x != fd['ganador']]:
                limpias.append({
                    'evento': base.get('evento') or nom, 'servidor': base.get('servidor') or ligas[0],
                    'fecha': base.get('fecha') or fec,
                    'participantes': base.get('participantes') or len(g['plantel']),
                    'ronda': 'final', 'ladoA': fd['ganador'], 'ladoB': otro, 'ganador': fd['ganador'],
                    'notas': 'final: ✅ Decidir'})
        if ligas and not tiene_campeon(limpias):
            hq = horas_quieta(g)
            # 📢 o en pausa, si el organizador avisó que sigue otro día (`pausada()`; sólo se le pregunta al vigía
            # cuando ya pasó la espera de siempre)
            if hq is not None and (hq < QUIETA_H or (hq < PAUSADA_H and pausada(g, ligas[0]))):
                en_curso.append((nom, hq))
            else:
                incompletos.append((nom, ligas[0], fec,
                                    ['%s: %s' % (d[1].lower(), d[2])
                                     for d in d_grupo]))
            continue
        # 🔴 y la que ya está cargada con otro nombre no se suma otra vez (el FFA WORLD CUP, #366 y #409: ver `ya_cargada()`)
        ya = ya_cargada(nom, ligas[0], fec, limpias) if ligas else None
        if ya:
            ya_cargadas.append((nom, ligas[0], fec, ya))
            continue
        dudas += d_grupo
        repes += len(del_grupo) - n_leidas
        todas += limpias
        # quien publicó una llave que se carga ya no es nuevo
        if limpias:
            conocidos.update(k for k in map(huella_autor, g['llaves']) if k)
            # y el podio con mención dice quién es quién (Dlx, 28/09, «A»)
            _pm = podio_de_grupo(g, limpias, lambda x: DEC.norm(DEC._sin_bandera(x)))
            if _pm:
                podio_ev['%s|%s|%s' % (DEC.norm(limpias[0].get('evento') or nom),
                                       limpias[0].get('servidor') or '',
                                       limpias[0].get('fecha') or fec)] = _pm
            # y lo demás que la llave dice de quién es quién (01/10/2026)
            _id = identidad_de_grupo(g)
            if _id:
                ident_ev['%s|%s|%s' % (DEC.norm(limpias[0].get('evento') or nom),
                                       limpias[0].get('servidor') or '',
                                       limpias[0].get('fecha') or fec)] = _id
        # 🔑 LOS LINKS DE LA LLAVE EN DISCORD, para «Ver llaves» del hub.
        # Acá es el único lugar donde existen: `Entrada` tiene nueve
        # columnas y el mensaje no es una. Van todos los del grupo —un
        # organizador que corrige y re-publica deja dos—, el más nuevo al
        # final. Ver `sheet/llaves_web.py`.
        if limpias:
            k = '|'.join(str(limpias[0].get(c) or '').strip()
                         for c in ('evento', 'servidor', 'fecha'))
            links_llaves[k] = [
                'https://discord.com/channels/%s/%s/%s'
                % (h['guild'], h['canal_id'], h['msg_id'])
                for h in sorted(g['llaves'], key=lambda x: str(x.get('cuando') or ''))
                if h.get('guild') and h.get('canal_id') and h.get('msg_id')]
    if repes:
        print('   %d batalla(s) repetida(s) entre mensajes del mismo '
              'evento: se cuentan una vez\n' % repes)

    # ⚠️ UNA FILA POR EVENTO, NO POR BATALLA. Una persona revisa un
    # evento, no una batalla suelta: veinte avisos de la misma llave
    # son un aviso.
    por_evento = collections.defaultdict(list)
    for ev, ronda, quienes, razon, *_ in dudas:
        por_evento[ev].append('%s: %s' % (ronda.lower(), quienes))

    print('   %d fila(s) para `Entrada`' % len(todas))
    for ev, sv_i, fec_i, nb in vidas_cargados:
        print('   ❤️ %s (%s · %s): 5 vidas de #veredictos, %d batalla(s)' % (ev, sv_i, fec_i, nb))
    for ev, sv_i, fec_i, nb in de_veredictos:
        print('   ⚖️ %s (%s · %s): la llave como se jugó, de #veredictos (%d batallas)' % (ev, sv_i, fec_i, nb))
    for ev, nb in esperan:
        print('   ⏸️ %s: 5 vidas que espera %d batalla(s) en ✅ Decidir' % (ev, nb))
    if decididas:
        print('   %d batalla(s) con el ganador que eligió Dlx en ✅ Decidir' % decididas)
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
    if ya_cargadas:
        print('\n   -- ya está cargada con otro nombre: las mismas batallas -> NO se suma otra vez --')
        for ev, sv_i, fec_i, n_i in ya_cargadas:
            print('     %-32s %s · %s  es el #%s' % (ev[:32], sv_i, fec_i, n_i))
    if descartados:
        print('\n   -- Dlx dijo que no cuentan (✅ Decidir) --')
        for ev, sv_i, fec_i in descartados:
            print('     %-32s %s · %s' % (ev[:32], sv_i, fec_i))
    if retenidos:
        print('\n   -- retenidos: la guía no deja sumarlos --')
        for ev, sv_i, fec_i, mot in retenidos:
            print('     %-32s %s · %s\n        %s' % (ev[:32], sv_i, fec_i,
                                                   mot))
    if sin_titulo:
        print('\n   -- llaves sin título: el nombre sale de su anuncio (hora, y si hay dos, quién publicó) --')
        for ev, sv_i, fec_i, por, ok in sin_titulo:
            print('     %-32s %s · %s  %s %s' % (ev[:32], sv_i, fec_i, '←' if ok else '✗', por))

    if equipos_inf:
        print('\n   -- equipos con un solo nombre: quiénes cobran --')
        for ev, sv_i, fec_i, nom_i, ms, por in equipos_inf:
            print('     %-28s %s · %s · %s: %s (%s)'
                  % (ev[:28], sv_i, fec_i, nom_i,
                     ' + '.join(ms) if ms else 'nadie', por))

    if not aplicar:
        print('\n   (simulacro: no escribí nada — corré con --aplicar)\n')
        return 0

    # el nombre que su anuncio le dio a cada llave sin título, sumado a lo de antes: el anuncio se va del canal y la
    # llave no (ver `NOMBRES`)
    if nombres_nuevos:
        try:
            with io.open(NOMBRES, 'w', encoding='utf-8', newline='\n') as _f:
                json.dump({'_leeme': 'El nombre que le dio su anuncio a cada llave SIN título, por id del mensaje de '
                                     'la llave: la hora y, si hay dos anuncios, quién publicó los dos (autor_h, la '
                                     'huella, nunca la cuenta). Se guarda porque el anuncio se va del canal y la llave '
                                     'no: sin esto volvería a «(sin titulo)», otro evento con otro número. Lo escribe '
                                     'anuncio_de_llave() de bot/llaves_a_entrada.py. Dlx, 03/10/2026.',
                           'llaves': dict(guardados, **nombres_nuevos)}, _f, ensure_ascii=False, indent=1,
                          sort_keys=True)
                _f.write('\n')
        except OSError as e:
            print('   ⚠️ no pude guardar los nombres de las llaves sin título (%s)' % str(e)[:60])

    # y los equipos con un solo nombre, para que `Pendientes` no pregunte
    # quién es «TEAM VENECIA» como si fuera una persona
    try:
        with io.open(EQUIPOS, 'w', encoding='utf-8', newline='\n') as _f:
            json.dump({'_leeme': 'Los equipos que una llave nombra con UN nombre (TEAM VENECIA): '
                                 'quiénes cobran, y por qué. Lo escribe marcar_equipos() de '
                                 'bot/llaves_a_entrada.py en cada corrida; lo lee Pendientes para '
                                 'no preguntar por ellos como si fueran personas. Dlx, 29/09/2026.',
                       'equipos': [{'evento': e, 'sv': s_, 'fecha': fe, 'equipo': n_,
                                    'integrantes': ms, 'por': p_}
                                   for e, s_, fe, n_, ms, p_ in equipos_inf]},
                      _f, ensure_ascii=False, indent=1)
            _f.write('\n')
    except OSError as e:
        print('   ⚠️ no pude guardar los equipos con un solo nombre (%s)' % str(e)[:60])

    # los links de cada llave, para que `procesar_entrada` los cuelgue de
    # su evento en `datos/llaves_t1.json` (misma corrida, mismo runner)
    try:
        with io.open(os.path.join(BASE, 'datos', 'llaves_links.json'), 'w',
                     encoding='utf-8', newline='\n') as _f:
            json.dump(links_llaves, _f, ensure_ascii=False, indent=1,
                      sort_keys=True)
    except OSError as e:
        print('   ⚠️ no pude dejar los links de las llaves (%s)' % str(e)[:60])
    # y quién ya publicó una llave que se cargó, para las de broma
    try:
        with io.open(AUTORES, 'w', encoding='utf-8', newline='\n') as _f:
            json.dump({'_leeme': 'Las huellas (sha1 recortado, no la cuenta) de quien ya publicó una '
                                 'llave que se cargó. Una llave de alguien que no está acá y sin '
                                 'anuncio espera en ✅ Decidir: ver llave_de_broma() en '
                                 'bot/llaves_a_entrada.py. Dlx, 28/09/2026: «A · sí».',
                       'huellas': sorted(conocidos)}, _f, ensure_ascii=False, indent=1)
            _f.write('\n')
    except OSError as e:
        print('   ⚠️ no pude guardar quién ya publicó una llave (%s)' % str(e)[:60])
    # y el podio con mención, sumado a lo de antes: la pregunta de ✅ Decidir
    # puede seguir abierta cuando la llave ya no está entre las que se leen
    try:
        try:
            with io.open(PODIO, encoding='utf-8') as _f:
                podio_todo = (json.load(_f) or {}).get('eventos') or {}
        except (OSError, ValueError):
            podio_todo = {}
        podio_todo.update(podio_ev)
        with io.open(PODIO, 'w', encoding='utf-8', newline='\n') as _f:
            json.dump({'_leeme': 'Quién es quién en el podio de cada llave, cuando el renglón '
                                 'menciona a UNA cuenta y el lado es UNA persona: evento|sv|fecha '
                                 '-> {nombre normalizado: Discord ID}. Lo usa decidir.por_discord(), '
                                 'como una inscripción. Dlx, 28/09/2026: «A · sí».',
                       'eventos': podio_todo}, _f, ensure_ascii=False, indent=1, sort_keys=True)
            _f.write('\n')
        if podio_ev:
            print('   🥇 el podio menciona a %d persona(s) en %d evento(s)'
                  % (sum(len(v) for v in podio_ev.values()), len(podio_ev)))
    except OSError as e:
        print('   ⚠️ no pude guardar el podio con mención (%s)' % str(e)[:60])
    # y lo demás que las llaves dicen de quién es quién, sumado a lo de antes
    try:
        try:
            with io.open(IDENTIDAD, encoding='utf-8') as _f:
                ident_todo = (json.load(_f) or {}).get('eventos') or {}
        except (OSError, ValueError):
            ident_todo = {}
        ident_todo.update(ident_ev)
        with io.open(IDENTIDAD, 'w', encoding='utf-8', newline='\n') as _f:
            json.dump({'_leeme': 'Quién es quién según cada llave: evento|sv|fecha -> menciones '
                                 '{nombre normalizado: Discord ID} (renglones «NOMBRE <@id>» y la '
                                 'mención que pasó de ronda con un nombre) y crece [[antes, después]] '
                                 '(el mismo, escrito más largo o más corto de una ronda a otra). Lo '
                                 'escribe identidad_de_grupo() de bot/llaves_a_entrada.py y lo usa '
                                 'sheet/decidir.py. Dlx, 01/10/2026: «mejorar la detección de '
                                 'personas automáticamente».',
                       'eventos': ident_todo}, _f, ensure_ascii=False, indent=1, sort_keys=True)
            _f.write('\n')
        if ident_ev:
            print('   🪪 las llaves dicen quién es quién: %d mención(es) con nombre y %d nombre(s) '
                  'que cambian, en %d evento(s)'
                  % (sum(len(v.get('menciones') or {}) for v in ident_ev.values()),
                     sum(len(v.get('crece') or ()) for v in ident_ev.values()), len(ident_ev)))
    except OSError as e:
        print('   ⚠️ no pude guardar quién es quién de las llaves (%s)' % str(e)[:60])

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
        k = (str(f.get('evento', '')).strip(),
             str(f.get('ronda', '')).strip().lower(),
             str(f.get('ladoA', '')).strip(),
             str(f.get('ladoB', '')).strip())
        # 🔴 EN UN 5 VIDAS LA MISMA PAREJA PELEA VARIAS VECES, y con esta
        # clave la segunda revancha «ya estaba»: se la saltaba. La nota trae
        # el número de batalla (`filas_vidas()`).
        return k + ((str(f.get('notas', '')).strip(),)
                    if re.match(r'^\d+\s*vidas?$', k[1]) else ())

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
    # ⚠️ EL LINK VA AL FINAL DEL «POSIBLE MATCH», separado por « · »:
    # `decidir._link_llave()` lo saca de ahí y lo pone en la pregunta.
    con_link = lambda t, k: ('%s · %s' % (t, link_de[k]) if link_de.get(k) else t)
    # 🔑 UNA PREGUNTA POR BATALLA, y no una por evento con cuatro batallas
    # pegadas: cada una se contesta eligiendo quién ganó. En ✅ Decidir van
    # juntas bajo su evento, que es lo que pedía «una persona revisa un
    # evento, no una batalla suelta». Lo que no es una batalla —un servidor
    # sin código— sigue yendo como antes.
    batallas_q = [d for d in dudas if len(d) >= 7]
    lote = [('Batalla sin ganador', 'llaves de Discord', d[5],
             ('%s · %s' % (d[3], d[6])) if d[6] else d[3]) for d in batallas_q]
    lote += [('Llave sin resolver', 'llaves de Discord', ev,
              con_link(' | '.join(cosas[:4]), ev))
             for ev, cosas in por_evento.items()
             if not any(d[0] == ev for d in batallas_q)]
    # ⚠️ Y LA LISTA DE LAS QUE SIGUEN SIN GANADOR, para que `Pendientes` cierre
    # sola la pregunta de una batalla que el organizador completó en Discord
    # (ver `pendientes._resuelto_ya()`). Se escribe en cada corrida.
    try:
        with io.open(os.path.join(BASE, 'datos', 'batallas_sin_ganador.json'), 'w',
                     encoding='utf-8', newline='\n') as _f:
            json.dump({'t': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
                       'batallas': sorted(d[5] for d in batallas_q)}, _f, ensure_ascii=False, indent=1)
            _f.write('\n')
    except OSError as e:
        print('   ⚠️ no pude dejar la lista de batallas sin ganador (%s)' % str(e)[:60])
    # ⚠️ EL DETALLE LLEVA SERVIDOR Y FECHA, no sólo el nombre: la cola no
    # duplica por (tipo, detalle), y dos llaves sin título son dos eventos
    # que con el nombre solo se volverían una fila.
    lote += [('Evento dudoso', 'llaves de Discord',
              '%s · %s · %s' % (ev, sv_i, fec_i),
              con_link(mot + '. NO se sumó nada.', (ev, sv_i, fec_i)))
             for ev, sv_i, fec_i, mot in retenidos]
    lote += [('Bracket incompleto', 'llaves de Discord',
              '%s · %s · %s' % (ev, sv_i, fec_i),
              ' | '.join(['sin campeón y sin tocar hace %d h o más: la '
                          'guía (Parte 1) lo descarta y NO se sumó nada. Si '
                          'cuenta, completá la final en la llave' % QUIETA_H]
                         + cosas[:3]) + (' · %s' % link_de[(ev, sv_i, fec_i)]
                                         if link_de.get((ev, sv_i, fec_i)) else ''))
             for ev, sv_i, fec_i, cosas in incompletos]
    # ❤️ B: cada 5 vidas cargado solo, para que Dlx lo confirme o lo saque
    lote += vidas_b
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
