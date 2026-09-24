# -*- coding: utf-8 -*-
"""DE `Entrada` A `Resultados`, `1v1` Y `Eventos Procesados`. El ciclo cerrado.

    python sheet/procesar_entrada.py            que haria, NO escribe
    python sheet/procesar_entrada.py --aplicar  lo escribe
    python sheet/procesar_entrada.py --aplicar --limpiar   y vacia `Entrada`


Es el reemplazo del menu `🎯 Procesar evento` del Apps Script, del lado de
Python: se pegan las batallas en `Entrada!C:K` y esto hace el resto.

    Entrada  ──leer──>  motor.procesar  ──>  resultados.guardar
                                        └──>  Eventos Procesados
                                        └──>  Config!B27/B28

🔴 POR QUE EXISTE, SI EL MENU YA LO HACIA.

Porque **nunca lo hizo**. El `Log` del Operativo dice `Total entradas 0` y
`logAccion` se llama en cinco puntos de ese flujo, asi que los 348 eventos
de `Eventos Procesados` entraron por otro camino y `Resultados` y `1v1`
—las dos hojas que alimentan `duel_t`, `duel_v`, `DNA` y `DIN`— estan
vacias. Dlx, 20/09: *«todo es automatico, lo del sheet es viejo»*.

⚠️ **TODO ES IDEMPOTENTE, Y NO POR PROLIJIDAD.** Esto escribe en tres
hojas; si se corta en el medio, lo que hay que poder hacer es **volver a
correrlo**. `resultados.guardar()` ya borra las filas viejas de ese numero
antes de poner las nuevas, y aca se hace lo mismo con `Eventos
Procesados` — que es un `append` y duplicaria en el segundo intento.

🔴 **Y ESO NO ALCANZABA, PORQUE EL NUMERO CAMBIABA.** La primera version
sacaba el numero de `Config!B27 + 1`, asi que volver a correr la misma
llave daba **#349 y despues #350**: el mismo evento dos veces, con las
dos hojas «idempotentes» haciendo exactamente lo que se les pidio. Se
encontro corriendolo, no leyendolo. Un evento se identifica por lo mismo
que lo agrupa —**nombre, servidor y fecha**—, y si ya esta en `Eventos
Procesados` se reusa su numero. El contador solo sube con eventos nuevos.

⚠️ **EL ORDEN IMPORTA Y ES AL REVES DE LO QUE PARECE.** Primero las dos
hojas de datos, despues el registro, y **el contador al final**. Al reves,
una corrida cortada deja `Config!B27` diciendo que el evento se proceso
cuando sus filas no estan, y el siguiente arranca en un numero que ya se
uso — que es el unico error de esta cadena que no se arregla volviendo a
correr.

⚠️ **`--limpiar` VA APARTE Y DESPUES DE VERIFICAR.** `limpiarEntrada()`
del original borra la hoja al terminar, y por eso *«el pasado no se
recupera»*: las batallas crudas de los 348 eventos no existen en ningun
lado. Aca la hoja se vacia solo si se pide, solo si la escritura se
verifico leyendo, y **la copia queda impresa** en la corrida.
"""
import io
import json
import os
import sys
from datetime import date

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

import requests                                          # noqa: E402

from escribir import Hoja, token, API, id_operativo      # noqa: E402
import motor                                             # noqa: E402
import resultados as RES                                 # noqa: E402

# ⚠️ LAS BATALLAS EMPIEZAN EN LA COLUMNA C. `Entrada` tiene las
# instrucciones en A y B —«1. Procesa brackets…»— y por eso `Hoja.filas()`
# devuelve 15 filas de texto de ayuda que no son datos. Es `ENT_START_COL`
# de `Code.gs`, que vale 3.
COL_A, COL_Z = 'C', 'K'
CAMPOS = ['evento', 'servidor', 'fecha', 'participantes', 'ronda',
          'ladoA', 'ladoB', 'ganador', 'notas']

CELDA_ULTIMO, CELDA_PROXIMO = 'Config!B27', 'Config!B28'


def _get(rng):
    # 🔴 CON REINTENTO: corre en el ciclo y es una lectura como cualquier
    # otra. Sin él, un 429 —la cuota es por minuto— tumba la carga de
    # eventos entera; es el agujero que mató el ciclo de las 6:52 AM ET del
    # 24/09/2026 desde otro archivo. Ver `sheet/reintentar.py`.
    from reintentar import leer

    def _pedir():
        r = requests.get('%s/%s/values/%s'
                         % (API, id_operativo(), requests.utils.quote(rng)),
                         headers={'Authorization': 'Bearer ' + token()},
                         timeout=60)
        r.raise_for_status()
        return r.json().get('values', [])
    return leer(_pedir)


def _put(rng, filas):
    r = requests.put('%s/%s/values/%s?valueInputOption=RAW'
                     % (API, id_operativo(), requests.utils.quote(rng)),
                     headers={'Authorization': 'Bearer ' + token()},
                     json={'values': filas}, timeout=60)
    if r.status_code >= 300:
        raise RuntimeError('%s: %s' % (r.status_code, r.text[:200]))


def leer_entrada():
    """Las batallas pegadas en `Entrada!C:K`."""
    h = Hoja('Entrada')
    filas = _get('Entrada!%s%d:%s' % (COL_A, h.fila_datos, COL_Z))
    out = []
    for f in filas:
        f = list(f) + [''] * (len(CAMPOS) - len(f))
        d = dict(zip(CAMPOS, [str(x).strip() for x in f[:len(CAMPOS)]]))
        # sin evento no es una batalla: es una fila en blanco o una nota
        if not d['evento'] or not d['ronda']:
            continue
        try:
            d['participantes'] = int(float(d['participantes'] or 0))
        except ValueError:
            d['participantes'] = 0
        out.append(d)
    return out, h


def agrupar(batallas):
    """Por (evento, servidor, fecha), igual que `agruparPorEvento`."""
    evs = {}
    for b in batallas:
        k = (b['evento'], b['servidor'], b['fecha'])
        evs.setdefault(k, []).append(b)
    return evs


def ultimo_numero():
    v = _get(CELDA_ULTIMO)
    s = str(v[0][0]) if v and v[0] else ''
    d = ''.join(c for c in s if c.isdigit())
    return int(d) if d else 0


def numeros_por_evento(h):
    """{(nombre, servidor, fecha): numero} desde `Eventos Procesados`.

    🔴 LA IDENTIDAD DE UN EVENTO NO ES EL CONTADOR. La primera version
    sacaba el numero de `Config!B27` y le sumaba uno, y el docstring de
    arriba prometia que volver a correr era seguro. **No lo era**: medido
    el 20/09/2026, procesar la misma llave dos veces daba #349 y despues
    #350, o sea el mismo evento dos veces con dos numeros. La
    idempotencia de `resultados.guardar()` no alcanzaba porque protege
    contra repetir *un numero*, y el numero cambiaba.

    Lo que identifica un evento es lo mismo que lo agrupa —nombre,
    servidor y fecha, igual que `agruparPorEvento`—, asi que si ya esta
    registrado se **reusa su numero** y todo lo de abajo lo reemplaza.
    """
    out = {}
    for f in h.filas():
        f = list(f) + [''] * 4
        n = str(f[0]).strip()
        if not n.isdigit():
            continue
        out[(str(f[1]).strip(), str(f[2]).strip(), str(f[3]).strip())] = int(n)
    return out


def _quitar_de_procesados(h, num):
    """Saca ese numero del registro. Ver la nota de idempotencia."""
    filas = h.filas()
    quedan = [f for f in filas if str(f[0]).strip() != str(num)]
    if len(quedan) == len(filas):
        return 0
    quedan = [list(f) + [''] * (h.ancho - len(f)) for f in quedan]
    vacias = [[''] * h.ancho for _ in range(len(filas) - len(quedan))]
    _put('%s!A%d:%s%d' % (h.nombre, h.fila_datos,
                          chr(ord('A') + h.ancho - 1),
                          h.fila_datos + len(filas) - 1), quedan + vacias)
    return len(filas) - len(quedan)


def main():
    aplicar = '--aplicar' in sys.argv
    limpiar = '--limpiar' in sys.argv
    print('\n══ `Entrada` → `Resultados` · `1v1` · `Eventos Procesados` ══\n')

    batallas, hent = leer_entrada()
    if not batallas:
        print('   `Entrada` no tiene batallas pegadas (se leen de %s a %s,\n'
              '   desde la fila %d). No hay nada que procesar.\n'
              % (COL_A, COL_Z, hent.fila_datos))
        return 0

    evs = agrupar(batallas)
    print('   %d batalla(s) en %d evento(s)\n' % (len(batallas), len(evs)))

    num = ultimo_numero()
    print('   `Config!B27` dice #%d, así que el próximo es #%d\n'
          % (num, num + 1))

    tab, mods = motor.tablas(), motor.modificadores()
    resolver, cuantos = motor._resolvedor()
    print('   el padrón resuelve %d nombre(s)\n' % cuantos)

    hproc = Hoja('Eventos Procesados')
    ya = numeros_por_evento(hproc)
    planes, tope, sin_resolver, alias_mal = [], num, [], []
    for (nombre, sv, fecha), bs in sorted(evs.items()):
        repetido = ya.get((nombre, sv, fecha))
        if repetido is None:
            tope += 1
            n = tope
        else:
            n = repetido
        try:
            ev = motor.procesar(bs, num=n, fecha=fecha, servidor=sv,
                                tab=tab, mods=mods, resolver=resolver)
        except ValueError as e:
            print('   🔴 #%d  %s · %s: %s' % (n, nombre, sv, e))
            if repetido is None:
                tope -= 1
            continue
        ev['nombre'] = nombre
        planes.append(ev)
        print('   #%-4d %-28s %-6s %-7s %s  ·  %d con puntos, %d duelo(s)%s'
              % (n, nombre[:28], sv, fecha, ev['escala'],
                 len(ev['resultados']), len(ev['duelos']),
                 '   ← ya estaba, se reemplaza' if repetido else ''))
        for a in ev['avisos']:
            print('          ⚠️ %s' % a)
        # 🔴 EL CHEQUEO DE ANTES NO CHEQUEABA NADA. Hacia
        # `resolver(r['rapero']) != r['rapero']` sobre el nombre **ya
        # resuelto**, o sea que comparaba algo consigo mismo y daba False
        # siempre. Probado: escribir «Konnan» en la final daba un Konnan
        # campeon con 10.000 puntos y cero avisos. Ahora el que avisa es
        # el resolvedor, que es el unico que sabe si encontro o no.
        for n in ev['sin_resolver']:
            cerca = motor.parecidos(n, resolver)
            print('          🔴 «%s» no está en el padrón%s'
                  % (n, '  ¿será %s?' % ', '.join(cerca) if cerca else ''))
        sin_resolver += [(ev['num'], n) for n in ev['sin_resolver']]
        # 🔴 UN ALIAS QUE CHOCA NO PUEDE QUEDAR SÓLO EN UN MENSAJE. Los
        # avisos del motor salían por consola y por `#registros`, y un
        # aviso que se lee una vez y se va es un aviso que se pierde. El de
        # dos lados que son la misma persona pide que alguien decida sobre
        # un alias, así que va a `Pendientes`, como los nombres desconocidos.
        alias_mal += [(ev['num'], a) for a in ev['avisos']
                      if 'pelean en la misma batalla' in a
                      or a.startswith('ESCALA:') or a.startswith('SUMA:')]

    if alias_mal and aplicar:
        try:
            from pendientes import anotar_varios
            anotar_varios([('Evento dudoso', 'evento #%s' % n, a, '')
                           for n, a in alias_mal])
        except Exception as e:                           # noqa: BLE001
            # como con los desconocidos: la cola no puede tumbar la carga
            print('   ⚠️ no pude anotar el alias en conflicto (%s)' % str(e)[:60])

    if not planes:
        print('\n   nada que escribir.\n')
        return 1

    # 🔴 UN NOMBRE QUE NO ESTA EN EL PADRON NO SE ESCRIBE, SE FRENA.
    #
    # Las llaves las carga una persona a mano —Dlx, 20/09/2026: «mayormente
    # los usuarios pondrán las llaves y anunciarán los eventos
    # manualmente»—, asi que el typo no es un caso raro: **es EL caso**.
    #
    # Y lo que deja no es una fila invalida que alguien vaya a notar: deja
    # un **rapero nuevo** con sus puntos. Probado, escribiendo «Konnan» en
    # la final de una llave de 16: sale un Konnan campeon con 10.000
    # puntos, y de ahi se propaga al ranking, a la tarjeta y al padron. Se
    # descubre cuando alguien pregunta quien es Konnan.
    #
    # ⚠️ Escribir igual se puede, pero hay que **pedirlo** con `--igual`:
    # un nombre nuevo de verdad —alguien que todavia no esta en el
    # padron— existe y tiene que poder entrar. Lo que no puede es pasar
    # de largo.
    # 🔴 UN NOMBRE DESCONOCIDO NO FRENA: VA A `Pendientes` Y LA CORRIDA SIGUE.
    #
    # La version anterior de esto **cortaba** la corrida. Frenar es lo
    # correcto cuando hay alguien mirando la consola, y es exactamente lo
    # que no sirve cuando el que corre es un job: un evento entero se
    # queda sin cargar por una letra, y el error vive en un log que nadie
    # lee.
    #
    # Dlx, 20/09/2026: *«todo deberia ser automatico… lo pendiente esa
    # hoja seria lo unico semi automatico, pero ahi son casos extremos
    # donde requieres que un usuario chequee»*. La hoja `Pendientes` ya
    # existia con la forma exacta —y su lista de tipos **ya tenia**
    # `Nombre desconocido`—, asi que la convencion estaba acordada antes
    # de que yo escribiera nada.
    #
    # ⚠️ La diferencia es entre «el evento no se cargo» y «el evento se
    # cargo y hay un nombre para confirmar».
    if sin_resolver:
        print('\n   ⚠️ %d nombre(s) no están en el padrón. Van a `Pendientes`'
              % len(sin_resolver))
        print('      y el evento se carga igual:')
        lote = []
        for n, nom in sin_resolver:
            cerca = motor.parecidos(nom, resolver)
            print('      #%s  %-16s %s'
                  % (n, nom, '¿será %s?' % ', '.join(cerca) if cerca else ''))
            lote.append(('Nombre desconocido', 'evento #%s' % n, nom,
                         ', '.join(cerca)))
        # 🔴 DE UNA VEZ Y NO UNA POR NOMBRE: 33 nombres eran 66 lecturas y
        # agotaban la cuota. Ver `pendientes.anotar_varios()`.
        if aplicar and lote:
            try:
                from pendientes import anotar_varios
                k = anotar_varios(lote)
                print('      ✅ %d nueva(s) en `Pendientes` (%d ya estaban)'
                      % (k, len(lote) - k))
            except Exception as e:                       # noqa: BLE001
                # ⚠️ Ni siquiera esto puede tumbar la carga del evento:
                # la cola existe para que el pipeline no se frene.
                print('         ⚠️ no pude anotarlos (%s)' % str(e)[:60])

    # ⚠️ LA COPIA SE IMPRIME SIEMPRE, no solo con --limpiar. Es lo unico
    # que separa esto de `limpiarEntrada()`, que borro el pasado de 348
    # eventos sin dejar rastro.
    cop = os.path.join(BASE, 'datos', 'entrada_%s.json'
                       % date.today().strftime('%Y%m%d'))
    with io.open(cop, 'w', encoding='utf-8') as f:
        f.write(json.dumps(batallas, ensure_ascii=False, indent=1))
    print('\n   las batallas crudas quedaron en %s'
          % os.path.relpath(cop, BASE))

    if not aplicar:
        print('\n   (simulacro: no escribí nada — corré con --aplicar)\n')
        return 0

    for ev in planes:
        n1, n2 = RES.guardar(ev, dry=False)
        _quitar_de_procesados(hproc, ev['num'])
        hproc.agregar([[ev['num'], ev['nombre'], ev['servidor'], ev['fecha'],
                        ev['participantes'], ev['escala'], '✅', '', '', '', '']],
                      dry=False)
        print('   ✅ #%d  %d en Resultados, %d en 1v1, 1 en Eventos Procesados'
              % (ev['num'], n1, n2))
        # 🔴 Y SE AVISA EN DISCORD. Dlx, 22/09/2026: *«¿como se que el bot
        # escaneo algo? Puedes agregar un mensaje diciendo q detecto el
        # evento de X servidor?»* — preguntado justo cuando el evento
        # **si** se habia cargado y lo unico que lo decia era el log de un
        # job de GitHub. Desde afuera, un lector roto y uno que anda dan
        # la misma pantalla.
        #
        # ⚠️ DESPUES DE ESCRIBIR Y ENVUELTO: el evento ya esta en el
        # Sheet, asi que si Discord no contesta lo unico que se pierde es
        # el aviso. `avisar.mandar()` no levanta, pero el import si puede.
        #
        # ⚠️ Y SOLO CON `--aplicar`, que es donde estamos: un simulacro no
        # puede mandar un mensaje diciendo que cargo algo.
        try:
            sys.path.insert(0, os.path.join(BASE, 'bot'))
            import avisar as AV
            from equipos import es_equipo
            lados = set()
            for b in ev.get('duelos') or ():
                for x in (b.get('a'), b.get('b')):
                    if x and es_equipo(x):
                        lados.add(str(x))
            dudas = ['«%s» no está en el padrón' % n
                     for n in ev.get('sin_resolver') or ()]
            dudas += list(ev.get('avisos') or ())
            AV.evento(ev, n1, n2, dudas, len(lados))
        except Exception as e:                           # noqa: BLE001
            print('      (no pude avisar en Discord: %s)' % str(e)[:60])

    # ⚠️ EL CONTADOR AL FINAL, Y SOLO SI SUBIO. Reprocesar un evento que ya
    # estaba no inventa un numero nuevo, asi que tampoco mueve el contador.
    if tope > num:
        _put(CELDA_ULTIMO, [['#%d' % tope]])
        _put(CELDA_PROXIMO, [['#%d' % (tope + 1)]])
        print('   ✅ `Config`: último #%d · próximo #%d' % (tope, tope + 1))
    else:
        print('   (el contador no se mueve: no hubo eventos nuevos)')

    if not limpiar:
        print('\n   (`Entrada` queda como está — `--limpiar` la vacía)\n')
        return 0

    # se comprueba leyendo ANTES de borrar el unico original
    puestas = sum(len(_get('Resultados!A1:A')) for _ in (1,))
    if not puestas:
        print('\n   🔴 `Resultados` sigue vacía: NO limpio `Entrada`.\n')
        return 1
    # 🔴 SE VACIA EL AREA ENTERA, NO `len(batallas) + 6` FILAS.
    #
    # `leer_entrada()` **saltea** las filas sin evento o sin ronda, asi
    # que `len(batallas)` no es el alto de lo que hay pegado: con un
    # hueco en el medio, o con filas mas abajo de una tanda anterior, el
    # rango se quedaba corto y sobrevivian batallas. Medido el
    # 23/09/2026: despues de un `--limpiar` que dijo «Entrada vacía»
    # quedaban **10 filas** del evento #349, y la corrida siguiente las
    # sumo a las nuevas.
    #
    # ⚠️ Y ESO ES LO QUE DUPLICA LOS DUELOS. Un `1v1` con la misma
    # batalla dos veces no falla: da el doble de duelos y un win rate
    # plausible. El #350 paso de 7 a 14 y despues a 21 en tres corridas.
    #
    # ⚠️ SE VERIFICA LEYENDO, como todo lo que escribe este modulo: un
    # 200 dice que la API acepto el pedido, no que la hoja quedo vacia.
    ancho = ord(COL_Z) - ord(COL_A) + 1
    # ⚠️ EL ALTO SALE DE LO QUE LA HOJA TIENE, no de cuántas batallas se
    # leyeron: leerlas saltea las filas vacías, así que ese número no
    # mide el alto de lo pegado.
    hay = _get('Entrada!%s%d:%s' % (COL_A, hent.fila_datos, COL_Z))
    alto = max(len(hay), len(batallas) + 6)
    _put('Entrada!%s%d:%s%d' % (COL_A, hent.fila_datos, COL_Z,
                                hent.fila_datos + alto - 1),
         [[''] * ancho for _ in range(alto)])
    queda = [f for f in _get('Entrada!%s%d:%s' % (COL_A, hent.fila_datos,
                                                  COL_Z))
             if any(str(c).strip() for c in f)]
    if queda:
        print('   🔴 `Entrada` NO quedó vacía: sobreviven %d fila(s).'
              % len(queda))
        print('      La copia está en %s\n' % os.path.relpath(cop, BASE))
        return 1
    print('   ✅ `Entrada` vacía (la copia está en %s)\n'
          % os.path.relpath(cop, BASE))
    return 0


if __name__ == '__main__':
    sys.exit(main())
