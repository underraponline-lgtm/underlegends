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
        try:
            import construir_akas as AK
            alias = {}
            for a, real in (AK.cargar() or {}).items():
                alias.setdefault(_norm_simple(real), []).append(a)
            for did, nombres in out.items():
                for n in list(nombres):
                    nombres.extend(alias.get(_norm_simple(n), []))
        except Exception:                                # noqa: BLE001
            pass                    # sin alias se sigue: es un extra
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
    """
    out = set()
    for _ronda, bats in E.rondas_de(texto):
        for b in bats:
            for n in b:
                for parte in re.split(r'[+,/]|\s-\s', n):
                    k = E.norm(parte)
                    if len(k) >= 2:
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

    for ronda, lados, ganador, razon in E.resolver(txt,
                                                   ids=ids_del_padron()):
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
                      'ganador': ganador, 'notas': ''})
    return filas, dudas, sabidas


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
    repes = 0
    for g in grupos:
        # 🔴 UN NOMBRE POR GRUPO Y LAS BATALLAS SIN REPETIR. Ver
        # `nombre_de()` y `sin_repetir()`: dos mensajes del mismo evento
        # daban dos nombres -> dos numeros de evento -> contado dos
        # veces, que es el unico error de esta cadena que no se arregla
        # volviendo a correr.
        nom, fec = nombre_de(g), fecha_de(g)
        del_grupo = []
        for h in g['llaves']:
            f, d, sab = filas_de(h, nombre=nom, fecha=fec,
                                 gente_grupo=g['plantel'])
            del_grupo += f
            dudas += d
            sabidas.update(sab)
        limpias = sin_repetir(del_grupo)
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
    for ev, cosas in por_evento.items():
        P.anotar('Llave sin resolver', 'llaves de Discord', ev,
                 ' | '.join(cosas[:4]))
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
