# -*- coding: utf-8 -*-
"""LA COLA DE LO QUE UNA PERSONA TIENE QUE MIRAR. El unico paso no automatico.

    from sheet.pendientes import anotar
    anotar('Nombre desconocido', 'evento #349', 'Konnan', 'Konan')

    python sheet/pendientes.py            que hay pendiente
    python sheet/pendientes.py --probar   anota y borra uno de prueba

🔴 EL PIPELINE NO SE FRENA: DEJA LA DUDA ACA Y SIGUE.

Dlx, 20/09/2026: *«todo deberia ser automatico… lo pendiente esa hoja
seria lo unico semi automatico, pero ahi son casos extremos donde
requieres que un usuario chequee»*.

La hoja ya existia con la forma exacta que hace falta —`# · Tipo ·
Origen · Detalle · Posible match · Estado · Resolucion · Resuelto por`—
y su lista de tipos **ya tenia** `Nombre desconocido`, que es
literalmente el caso del nombre mal tipeado. O sea que la convencion
estaba acordada antes de que yo escribiera nada.

⚠️ **Y YO HABIA HECHO LO CONTRARIO.** `procesar_entrada.py` FRENABA la
corrida cuando un nombre no estaba en el padron. Frenar es correcto en
un flujo manual —alguien esta mirando la consola— y es **exactamente lo
que no sirve** cuando el que corre es un job: un evento entero se queda
sin cargar por una letra, y el error vive en un log que nadie lee.

LO QUE ESTA COLA HACE POSIBLE
------------------------------
Que el pipeline **siempre termine**. Lo que se pudo resolver entra; lo
que no, queda con su `Posible match` sugerido para que alguien decida en
cinco segundos. Es la diferencia entre «el evento no se cargo» y «el
evento se cargo y hay un nombre para confirmar».

⚠️ **ES IDEMPOTENTE POR (tipo, detalle).** El mismo job puede correr dos
veces —reintento de Actions, el mismo evento reprocesado— y la cola no
puede llenarse de la misma duda repetida: una cola con la misma fila
veinte veces se deja de leer, y entonces deja de existir.

⚠️ **SOLO SE ESCRIBEN LAS COLUMNAS A:H.** A la derecha, en la J, viven
el panel `📊 Estado` y las `📖 Instrucciones` de la hoja. `Hoja.ancho`
da 10 porque cuenta hasta ahi, y escribir 10 columnas **pisa el panel** —
que es exactamente como se perdieron las `📖 Instrucciones` de `Config`
el 20/09/2026.
"""
import io
import os
import re
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

import requests                                          # noqa: E402

from escribir import Hoja, token, API, id_operativo, _pedir   # noqa: E402

HOJA = 'Pendientes'
# A:H. La I esta vacia y la J es el panel de la hoja. Ver el docstring.
COLS = ['#', 'Tipo', 'Origen', 'Detalle', 'Posible match', 'Estado',
        'Resolución', 'Resuelto por']
ANCHO = len(COLS)
ULTIMA = chr(ord('A') + ANCHO - 1)          # 'H'

# Los tipos que se escriben en la cola. Eran los cinco de una columna
# `📋 Tipos` que la hoja ya no tiene —hoy es técnica y se contesta desde
# «✅ Decidir»—, y `registrar_ids.py` escribía además `alta`, `conflicto` y
# `ambiguo`: cada corrida avisaba «tipo 'alta' no está en la hoja» (5 de 8
# corridas del 25/09/2026, en la lectura de los logs) y la fila entraba
# igual. ⚠️ Son los de `decidir.GRUPO`, que dice cómo se pregunta cada uno:
# el self-check los compara.
TIPOS = ('Nombre desconocido', 'Alias posible', 'Evento dudoso',
         'Bracket incompleto', 'MW pendiente', 'Llave sin resolver',
         'alta', 'conflicto', 'ambiguo')


def _did(detalle):
    """El Discord ID de una fila de identidad («nombre = 1234…»), o `''`."""
    d = str(detalle).split(' = ')[-1].strip() if ' = ' in str(detalle) else ''
    return d if d.isdigit() else ''


def _hoja():
    return Hoja(HOJA)


def _filas(h):
    """Las filas de la TABLA (A:H), sin el panel de la derecha.

    🔴 UN 429 ERA «LA COLA ESTÁ VACÍA». Esto hacía `requests.get(…)
    .json().get('values', [])` sin mirar el código: con la cuota agotada
    la respuesta es un `{"error": …}`, no trae `values`, y la cola
    parecía vacía — así que `anotar()` no encontraba la duda y **la
    escribía otra vez**. Un error convertido en un dato plausible.

    ⚠️ Ahora pasa por `escribir._pedir()`, que reintenta el 429 y el 5xx
    y levanta todo lo demás. Una lectura que falla falla.
    """
    return [f for _n, f in _filas_con_n(h)]


def _filas_con_n(h):
    """`[(fila del Sheet, valores)]` de la tabla, sin las vacías.

    🔴 EL NÚMERO DE FILA SE GUARDA, NO SE RECALCULA. `barrer()` hacía
    `h.fila_datos + i` sobre la lista YA FILTRADA: con una fila vacía en
    el medio, todo lo que venía después se corría uno y el ciclo marcaba
    `Resuelto` la duda de al lado. No se veía porque la tabla todavía no
    tiene huecos — el día que alguien borre una fila a mano, sí.
    """
    d = _pedir('GET', '/values/%s' % requests.utils.quote(
        '%s!A%d:%s' % (HOJA, h.fila_datos, ULTIMA))).get('values', [])
    return [(h.fila_datos + i, f) for i, f in enumerate(d)
            if any(str(c).strip() for c in f)]


def leer():
    """[{col: valor}] de lo que hay en la cola."""
    h = _hoja()
    out = []
    for f in _filas(h):
        f = list(f) + [''] * ANCHO
        out.append({c: str(f[i]).strip() for i, c in enumerate(COLS)})
    return out


def anotar(tipo, origen, detalle, match='', dry=False):
    """Pone una duda en la cola. Devuelve True si la agrego.

    ⚠️ No levanta si el tipo no esta en `TIPOS`: avisa y lo anota igual.
    Perder la duda es peor que tener un tipo raro, y el pipeline que
    llama a esto **no se puede caer por esto** — es lo contrario de para
    lo que existe.

    ⚠️ PARA VARIAS DUDAS, `anotar_varios()`: esta lee la cola entera en
    cada llamada.
    """
    return anotar_varios([(tipo, origen, detalle, match)], dry=dry) == 1


def anotar_varios(dudas, dry=False):
    """Pone varias dudas en la cola con UNA lectura y UN pedido. Cuántas.

    🔴 UNA LECTURA POR DUDA AGOTABA LA CUOTA. Medido el 24/09/2026 en el
    ciclo de las 9:22 AM ET: 33 nombres desconocidos eran 33 `anotar()`,
    y cada uno leía la cabecera y la cola —unas 66 lecturas contra una
    cuota de 60 por minuto—. El reintento esperaba hasta 87 s por duda y
    **una se perdió igual** («no pude anotarlo … 429»). La cola existe
    para que nada se pierda, y la forma de escribir en ella perdía.

    `dudas` es `[(tipo, origen, detalle, match), …]`. Se descartan las
    que ya están en la hoja y las repetidas dentro del mismo lote.
    """
    nuevas, vistas = [], set()
    for tipo, origen, detalle, match in dudas:
        if tipo not in TIPOS:
            print('   ⚠️ tipo %r no está en la hoja (%s)'
                  % (tipo, ', '.join(TIPOS)))
        # ⚠️ SE COMPARA LO MISMO QUE SE ESCRIBE. Antes el lado de la hoja
        # iba con `.strip()` y el `detalle` recien llegado no, asi que un
        # nombre con un espacio de mas nunca coincidia consigo mismo y
        # entraba otra vez en cada corrida. Una cola con la misma duda
        # veinte veces se deja de leer, y entonces deja de existir.
        detalle = str(detalle).strip()
        # 🔴 EL ALTA ES DE UNA CUENTA, NO DE UN NOMBRE. Quien usa /card con
        # un apodo y después con otro entraba dos veces: el 25/09/2026 el ID
        # 554330098812059679 quedó en dos filas con dos nombres (10:55 y
        # 11:23 AM) y a las 11:53 entró solo a la Lista con un tercero.
        clave = (tipo, _did(detalle) or detalle) if tipo == 'alta' else (tipo, detalle)
        if clave in vistas:
            continue
        vistas.add(clave)
        nuevas.append(['', tipo, str(origen).strip(), detalle,
                       str(match).strip(), 'Pendiente', '', ''])
    if not nuevas:
        return 0
    h = _hoja()
    hay = _filas(h)
    ya = {(str((list(f) + [''] * ANCHO)[1]).strip(),
           str((list(f) + [''] * ANCHO)[3]).strip()) for f in hay}
    # y un alta con ese ID que siga abierta, con el nombre que sea
    altas = {_did((list(f) + [''] * ANCHO)[3]) for f in hay
             if str((list(f) + [''] * ANCHO)[1]).strip() == 'alta'
             and str((list(f) + [''] * ANCHO)[5]).strip().lower() in ('', 'pendiente')}
    altas.discard('')
    nuevas = [f for f in nuevas if (f[1], f[3]) not in ya
              and not (f[1] == 'alta' and _did(f[3]) in altas)]
    if dry:
        for f in nuevas:
            print('   [dry] %s · %s · %s' % (f[1], f[2], f[3]))
        return len(nuevas)
    if nuevas:
        # ⚠️ OVERWRITE Y NO INSERT_ROWS: insertar mete filas ENTERAS, y
        # eso empujaba para abajo todo lo que estaba a la derecha. Así se
        # partió el panel de instrucciones de esta hoja —pasos 1-3 en la
        # fila 31 y 4-6 en la 123—. Escribir en las filas vacías de abajo
        # no mueve nada.
        _pedir('POST', '/values/%s!A%d:append?valueInputOption=RAW'
               '&insertDataOption=OVERWRITE'
               % (requests.utils.quote(HOJA), h.fila_datos),
               json={'values': nuevas})
    return len(nuevas)


def _resuelto_ya(fila, resolver):
    """Por qué esa fila ya no hace falta. `''` si todavía hace falta.

    🔴 UNA COLA LLENA DE COSAS YA ARREGLADAS SE DEJA DE LEER, y entonces
    deja de existir. Es la lección de las 188 alarmas falsas del `audit`
    y la misma que `avisar.py` aplica con los avisos: *«24 mensajes al
    día que entrenan a no mirar el canal»*.

    Medido el 23/09/2026: **35 filas**, y varias eran de antes de que
    `equipos.py` partiera los lados —`Sin límites 🇵🇪+Trot🇪🇸+Sonet`
    entero como si fuera una persona— o de antes de que el resolvedor
    consultara las AKAs. Ya no se podían reproducir: el motor resuelve
    los tres nombres.

    ⚠️ NO SE BORRA NADA: se marca `Resuelto`. Borrar una fila pierde de
    qué se dudaba, y eso es justamente lo que hace falta el día que el
    mismo nombre vuelva a fallar.
    """
    tipo, detalle = fila.get('Tipo', ''), fila.get('Detalle', '')
    if (fila.get('Estado') or '').strip().lower() not in ('', 'pendiente'):
        return ''                                    # ya lo tocó alguien
    if tipo == 'Nombre desconocido':
        # ⚠️ SE PREGUNTA POR CADA INTEGRANTE. Las filas viejas traen el
        # lado entero —«A + B + C»— porque se anotaron antes de que se
        # partieran; hoy el motor resuelve los tres por separado, así
        # que la duda se cierra si **todos** resuelven.
        import motor
        ms = motor.equipo(detalle) or [detalle]
        # 🔴 `resolver.fallo` ES UN SET QUE **ACUMULA**, y eso hace que
        # cada fila contamine a la siguiente. Medido: la fila
        # `marto + erian + melomaniaco` deja `melomaniaco` en el set, y
        # dos filas más abajo la fila `melomaniaco` a secas ve su propio
        # nombre ya adentro, mide «no se agregó nada nuevo» y se cierra
        # **como resuelta**. Sin esto la barrida cerraba 12 filas de las
        # cuales al menos 3 seguían haciendo falta — o sea que el
        # limpiador de la cola le borraba trabajo de verdad.
        #
        # ⚠️ Se saca a estos nombres del set ANTES de medir, así cada
        # fila se pregunta sola. Es contar **efectos**, no respuestas,
        # que es la misma corrección que necesitó `kv_borrar()`.
        fallo = getattr(resolver, 'fallo', None)
        if fallo is None:
            return ''
        for m in ms:
            fallo.discard(m)
        antes = set(fallo)
        for m in ms:
            resolver(m)
        if not (set(fallo) - antes):
            return ('el nombre ya resuelve (%d integrante(s))' % len(ms)
                    if len(ms) > 1 else 'el nombre ya resuelve')
        return ''
    if tipo == 'Llave sin resolver':
        # 🔴 LA SEÑAL ES QUE EL EVENTO TENGA CAMPEON, no que se haya
        # cargado. Una llave leída a medias también se carga —es el
        # diseño: el pipeline nunca se frena— así que «está en
        # `Eventos Procesados`» no dice nada. Que haya un Campeón sí
        # dice que el lector llegó hasta la final, que es exactamente
        # lo que esta fila denuncia que no pasó.
        #
        # Medido el 23/09/2026: `EL RAP FECHA 5` quedó anotada cuando la
        # final se cortaba en `⌞makma 🇻🇪 + tam 🇻🇪 + agus🇦🇷⌝ vs ⌞Hassan…`.
        # Hoy el motor la resuelve entera —3 campeones y 3 subcampeones,
        # con los puntos repartidos— así que la duda ya no existe.
        return ('el evento ya tiene campeón' if _tiene_campeon(detalle)
                else '')
    if tipo == 'Bracket incompleto':
        # La misma señal, un paso después: `llaves_a_entrada.py` no suma
        # un evento sin campeón, así que si hoy tiene Campeón es que
        # alguien completó la final y el ciclo lo cargó entero.
        #
        # ⚠️ El detalle es `evento · servidor · fecha`, y se pregunta por
        # el nombre. SALVO `(sin titulo)`: ese nombre no distingue un
        # evento de otro, y cerrar la fila por el campeón de OTRO evento
        # sin título esconde la duda, que es el peor daño para una cola.
        nombre = detalle.split(' · ')[0].strip()
        if not nombre or nombre == '(sin titulo)':
            return ''
        return 'el evento ya tiene campeón' if _tiene_campeon(nombre) else ''
    if tipo == 'alta':
        # 🔑 «USÓ /card Y NO ESTÁ EN LA LISTA» DEJA DE SER CIERTO cuando su
        # Discord ID está en la Lista: la pregunta era a qué fila ponérselo,
        # y ya está puesto —lo hizo alguien o `autoverificar.py`—. Se
        # reproduce, como un nombre que hoy resuelve. Se dice con qué nombre
        # quedó, así un alta que terminó en la fila equivocada se ve.
        did = _did(detalle)
        quien = _en_la_lista().get(did) if did else None
        return ('su Discord ya está en la Lista, como «%s»' % quien) if quien else ''
    # 🔴 `Alias posible` NO SE CIERRA SOLO, Y LO INTENTE. La regla era
    # «si ese AKA ya está en el padrón, la duda se cerró» — y es
    # exactamente al revés: esas filas las escribe el **backfill** del
    # repo de sync y dicen *«AKA 'Shadow' (fila 237) ya tiene ID …»*, o
    # sea que existen **porque** el alias ya tiene dueño. Son dos filas
    # peleando por la misma identidad, y cuál gana lo decide una
    # persona.
    #
    # ⚠️ Mi regla las habría cerrado **las ocho**, que es el peor daño
    # posible para una cola: no deja rastro de que había un conflicto.
    # Y casi no se ve, porque un bug mío —leer `akas.json`, que es
    # anidado, como si fuera plano— dejaba la lista vacía y ninguna se
    # cerraba. Arreglar ESE bug habría destapado el otro.
    #
    # ⚠️ Lo que se puede cerrar solo es lo que se puede **reproducir**:
    # un nombre que hoy resuelve, una llave que hoy tiene campeón. Una
    # decisión de identidad no se reproduce, se toma.
    return ''


_LISTA = {}


def _en_la_lista():
    """`{discord_id: nombre}` del padrón. Una lectura por corrida."""
    if 'd' not in _LISTA:
        try:
            import construir_padron as _PAD
            _LISTA['d'] = {str(x.get('discord_id') or ''): x.get('raw') or ''
                           for x in _PAD.cargar() if x.get('discord_id')}
        except Exception:                                # noqa: BLE001
            _LISTA['d'] = {}
    return _LISTA['d']


def _tiene_campeon(nombre_evento):
    """`True` si ese evento ya dejó un Campeón en `Resultados`.

    ⚠️ CRUZA POR EL NUMERO Y NO POR EL NOMBRE. `Resultados` guarda el
    número de evento y `Eventos Procesados` la pareja número↔nombre; el
    nombre en la cola viene como lo escribió quien anotó la duda. Dos
    hojas, una clave.

    ⚠️ Y NO LEVANTA: esto decide si se cierra una fila de una cola, no
    si se carga un evento. Si el Sheet no contesta, la fila se queda
    abierta, que es el lado seguro.
    """
    try:
        from escribir import Hoja
        objetivo = norm_simple(nombre_evento)
        nums = set()
        for f in Hoja('Eventos Procesados').filas():
            f = list(f) + [''] * 3
            if norm_simple(f[1]) == objetivo and str(f[0]).strip().isdigit():
                nums.add(str(f[0]).strip())
        if not nums:
            return False
        for f in Hoja('Resultados').filas():
            f = list(f) + [''] * 8
            if str(f[0]).strip() in nums and _es_campeon(f[6]):
                return True
    except Exception:                                    # noqa: BLE001
        pass
    return False


def _es_campeon(pos):
    """⚠️ `'campe' in pos` DA True PARA «Subcampeón». Ver `lobby.py`."""
    import unicodedata
    s = unicodedata.normalize('NFD', str(pos or '').strip().lower())
    return ''.join(c for c in s
                   if unicodedata.category(c) != 'Mn') == 'campeon'


def norm_simple(s):
    """`'  Shä-dow!! '` -> `'shadow'`. Para comparar alias.

    ⚠️ LAS TILDES SE SACAN, y `isalnum()` sola NO las saca: `'ä'.isalnum()`
    es `True`, así que `Shädow` y `Shadow` quedaban como dos alias
    distintos y el de la cola no se cerraba nunca. Es la misma
    normalización que `rankings._norm()`, por el mismo motivo.
    """
    import unicodedata
    t = unicodedata.normalize('NFD', str(s or '').lower().strip())
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    return ''.join(c for c in t if c.isalnum())


def barrer(dry=True):
    """Marca `Resuelto` lo que ya no se puede reproducir. `(n, detalle)`."""
    import motor
    # ⚠️ devuelve `(resolver, cuantos)` — no la función sola
    resolver, _n = motor._resolvedor()
    # ⚠️ ACA SE LEIA `akas.json` PARA CERRAR LOS `Alias posible`, y esa
    # regla se retiró: ver `_resuelto_ya()`. Se saca el código en vez de
    # dejarlo apagado —«por si vuelve»— porque lo que codificaba era una
    # idea equivocada, y un lector lo tomaría por buena.
    h = _hoja()
    cierres = []
    for n, f in _filas_con_n(h):
        f = list(f) + [''] * ANCHO
        d = {c: str(f[j]).strip() for j, c in enumerate(COLS)}
        por = _resuelto_ya(d, resolver)
        if por:
            cierres.append((n, d['Tipo'], d['Detalle'], por))
    if dry or not cierres:
        return cierres
    # 🔴 UNA SOLA LLAMADA. La cuota de escritura son 60 por minuto y el
    # ciclo escribe en paralelo; veinte `PUT` sueltos la rozan solos.
    _pedir('POST', '/values:batchUpdate',
           json={'valueInputOption': 'RAW',
                 'data': [{'range': '%s!F%d:H%d' % (HOJA, n, n),
                           'values': [['Resuelto', por, 'el ciclo']]}
                          for n, _t, _d, por in cierres]})
    return cierres


def _self_check():
    print('\n  pendientes.py — self-check\n')
    mal = 0

    def ok(cond, que):
        nonlocal mal
        mal += not cond
        print('   %s %s' % ('ok' if cond else '🔴', que))

    # 🔴 EL SET QUE ACUMULA. Es el bug que la barrida tuvo en su primera
    # versión y que le habría cerrado 3 filas que seguían haciendo falta.
    # `resolver.fallo` junta los fallos de TODA la corrida, así que una
    # fila que ve su propio nombre ya adentro mide «no se agregó nada»
    # y se da por resuelta.
    class _R:
        def __init__(s):
            s.fallo = set()

        def __call__(s, n):
            if n not in ('Ana', 'Bea'):        # sólo esos dos existen
                s.fallo.add(n)
            return n
    r = _R()
    # la fila 1 mete «Zzz» en el set porque de verdad no resuelve
    uno = _resuelto_ya({'Tipo': 'Nombre desconocido', 'Detalle': 'Ana + Zzz',
                        'Estado': 'Pendiente'}, r)
    ok(uno == '', 'una fila con un integrante que NO resuelve queda abierta')
    # y la fila 2, que es justo «Zzz», tiene que seguir abierta igual
    dos = _resuelto_ya({'Tipo': 'Nombre desconocido', 'Detalle': 'Zzz',
                        'Estado': 'Pendiente'}, r)
    ok(dos == '', 'y la fila siguiente con ESE nombre no se cierra sola')
    tres = _resuelto_ya({'Tipo': 'Nombre desconocido', 'Detalle': 'Ana + Bea',
                         'Estado': 'Pendiente'}, r)
    ok(tres != '', 'una en la que todos resuelven sí se cierra   (%s)' % tres)
    # ⚠️ y lo que ya tocó una persona no se pisa
    cuatro = _resuelto_ya({'Tipo': 'Nombre desconocido', 'Detalle': 'Ana',
                           'Estado': 'Resuelto'}, r)
    ok(cuatro == '', 'lo que ya tiene Estado no se vuelve a tocar')

    # 🔴 «SUBCAMPEON» CONTIENE «CAMPEON». Es el error que ya costó una
    # vuelta en `lobby.py`: con `'campe' in pos` el subcampeón cierra la
    # fila como si hubiera ganado, y entonces una llave que se corta
    # JUSTO en la final —que es el caso que esta fila denuncia— se daría
    # por resuelta.
    ok(_es_campeon('Campeón') and _es_campeon('campeon'),
       'el campeón se reconoce con y sin tilde')
    ok(not _es_campeon('Subcampeón'), '«Subcampeón» NO cuenta como campeón')
    ok(not _es_campeon('') and not _es_campeon(None), 'y el vacío tampoco')

    ok(norm_simple('  Shä-dow!! ') == 'shadow', 'el alias se normaliza')

    # 🔴 UN CONFLICTO DE IDENTIDAD NO SE CIERRA SOLO. Esas filas las
    # escribe el backfill y dicen «AKA X ya tiene ID Y»: existen PORQUE
    # el alias ya tiene dueño, así que la regla obvia —«ya está en el
    # padrón, listo»— las cerraría todas y borraría el conflicto.
    for det in ("AKA 'Shadow' (fila 237) ya tiene ID 146143",
                "ID 1497026847504990218 ya pertenece a fila 197"):
        v = _resuelto_ya({'Tipo': 'Alias posible', 'Estado': '',
                          'Detalle': det}, r)
        ok(v == '', 'no se cierra solo: %s…' % det[:34])

    # ⚠️ EL BRACKET INCOMPLETO SIN TÍTULO NO SE CIERRA POR EL CAMPEÓN DE
    # OTRO. Se contesta sin tocar el Sheet: el `(sin titulo)` corta antes
    # de preguntarle a `Resultados`.
    v = _resuelto_ya({'Tipo': 'Bracket incompleto', 'Estado': '',
                      'Detalle': '(sin titulo) · FFA · 23/09'}, r)
    ok(v == '', 'un Bracket incompleto «(sin titulo)» no se cierra solo')

    # el alta, por Discord ID
    ok(_did('JOVEN E R E M I T A⚕️ = 1266639530291') == '1266639530291'
       and _did('sin id') == '', 'el Discord ID sale del detalle de un alta')
    _LISTA['d'] = {'554330098812059679': 'La Loquita [Uma Cryu]'}
    v = _resuelto_ya({'Tipo': 'alta', 'Estado': 'Pendiente',
                      'Detalle': 'Catarsis = 554330098812059679'}, r)
    ok('La Loquita' in v, 'un alta cuyo ID ya está en la Lista se cierra, y dice con qué nombre')
    ok(_resuelto_ya({'Tipo': 'alta', 'Estado': 'Pendiente',
                     'Detalle': 'Otro = 111222333444555666'}, r) == '',
       'y uno cuyo ID no está, sigue abierto')
    _LISTA.clear()
    try:
        import decidir as _DC
        ok(set(_DC.GRUPO) == set(TIPOS), 'los tipos son los mismos que pregunta ✅ Decidir')
    except Exception as e:                               # noqa: BLE001
        ok(False, 'no pude comparar con decidir.GRUPO (%s)' % str(e)[:50])

    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


def main():
    if '--auto' in sys.argv:
        return _self_check()

    if '--barrer' in sys.argv:
        # 🔴 LIMPIA LO QUE YA SE ARREGLO SOLO. Una cola llena de cosas
        # hechas se deja de leer, y entonces deja de existir.
        dry = '--aplicar' not in sys.argv
        print('\n══ BARRER LA COLA ══\n')
        c = barrer(dry=dry)
        if not c:
            print('   nada que cerrar: todo lo que hay sigue haciendo '
                  'falta\n')
            return 0
        for n, tipo, det, por in c:
            print('   f%-4d %-20s %-34s  %s'
                  % (n, tipo, str(det)[:34], por))
        print('\n   %d fila(s)%s\n'
              % (len(c), '' if not dry else '  (simulacro: --aplicar)'))
        return 0

    if '--probar' in sys.argv:
        print('\n══ PRUEBA: anotar y sacar ══\n')
        antes = len(leer())
        puso = anotar('Nombre desconocido', 'prueba', '__PRUEBA__', 'Konan')
        print('   agregó: %s · ahora hay %d (antes %d)'
              % (puso, len(leer()), antes))
        rep = anotar('Nombre desconocido', 'prueba', '__PRUEBA__', 'Konan')
        print('   al repetir agregó: %s  ← tiene que ser False' % rep)
        # sacarla
        h = _hoja()
        quedan = [f for f in _filas(h)
                  if str((list(f) + [''] * ANCHO)[3]).strip() != '__PRUEBA__']
        quedan = [list(f) + [''] * (ANCHO - len(f)) for f in quedan]
        vacias = [[''] * ANCHO for _ in range(len(_filas(h)) - len(quedan))]
        requests.put('%s/%s/values/%s?valueInputOption=RAW'
                     % (API, id_operativo(),
                        requests.utils.quote('%s!A%d:%s%d'
                                             % (HOJA, h.fila_datos, ULTIMA,
                                                h.fila_datos + len(_filas(h)) - 1))),
                     headers={'Authorization': 'Bearer ' + token()},
                     json={'values': quedan + vacias}, timeout=60)
        print('   sacada · quedan %d\n' % len(leer()))
        return 0

    filas = leer()
    print('\n══ LO QUE ESPERA A QUE ALGUIEN MIRE ══\n')
    if not filas:
        print('   ✅ nada pendiente\n')
        return 0
    from collections import Counter
    c = Counter(f['Tipo'] for f in filas)
    for t, n in sorted(c.items(), key=lambda x: -x[1]):
        print('   %-22s %3d' % (t, n))
    abiertas = [f for f in filas if f['Estado'].lower().startswith('pend')]
    print('\n   %d en total · %d sin resolver\n' % (len(filas), len(abiertas)))
    print('   %-20s %-26s %s' % ('tipo', 'detalle', 'posible match'))
    for f in abiertas[:20]:
        print('   %-20s %-26s %s'
              % (f['Tipo'][:20], f['Detalle'][:26], f['Posible match'][:24]))
    print('')
    return 0


if __name__ == '__main__':
    sys.exit(main())
