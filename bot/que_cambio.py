# -*- coding: utf-8 -*-
"""QUIEN CAMBIO EN EL POOL, Y QUE CARTA LE QUEDO VIEJA.

    python bot/que_cambio.py            quien y que carta
    python bot/que_cambio.py --lista    los nombres, para pasar a otro script
    python bot/que_cambio.py --sellar   marca el estado actual como dibujado

🔴 SIN ESTO, «MANTENERSE SOLO» CUESTA UNA HORA Y MEDIA POR EVENTO.

La regla de `docs/arquitectura.md` es **«redibujar solo lo que cambio»**:
son 2.000 minutos de Actions al mes y una tanda completa son ~26, asi que
redibujar todo despues de cada evento se come el 40 % del mes para que el
99 % de las cartas salga identica.

Pero «lo que cambio» no se sabia. `bot/rehacer.py --cambiaron` contesta
solo por la **foto** —mira `git status` sobre `_avatares/`— y no por los
datos: si a alguien le cambia el Score, su tarjeta queda vieja y nada lo
dice. Este modulo contesta por los datos.

NO ES «CAMBIO ALGO»: ES «QUE CARTA»
------------------------------------
Un cambio en `pts` **solo** afecta a la Temporada; uno en `score` afecta a
las cuatro. Eso no se adivina: esta medido en
`datos/campos_por_carta.json`, que genera
`herramientas/que_pide_cada_carta.py` envolviendo el pool en un dict que
anota cada clave que alguien le pide y **dibujando las cuatro cartas de
verdad**.

⚠️ SE USA LA MEDICION, NO UNA LISTA A MANO. Una lista escrita de «que
campo usa cada carta» se queda vieja el dia que un generador pide uno
nuevo, y el sintoma seria **una tarjeta que no se redibuja**: el error
mas silencioso posible en un pipeline cuyo trabajo es redibujar.

⚠️ Y SI EL CAMPO NO ESTA EN EL MAPA, SE REDIBUJAN LAS CUATRO. Un campo
que nadie midio puede ser uno nuevo; darlo por «no lo usa nadie» es
apostar a que la medicion esta al dia. Se prefiere trabajar de mas.

EL SELLO
--------
`datos/cartas_selladas.json` guarda **un hash por persona y por carta**,
del estado que tenia la ultima vez que esa carta se dibujo y subio.

⚠️ HASHES Y NO EL POOL ENTERO, POR DOS RAZONES. Va **commiteado** —si
Actions es quien dibuja, el sello tiene que sobrevivir entre corridas y
el repo es donde vive lo que sobrevive—, asi que guardar los dos pools
completos en cada corrida infla el historial para siempre: son ~200 KB
contra ~10. Y el diff de git pasa a ser legible: se ve **que persona y
que carta** cambio, que es exactamente la pregunta.

⚠️ SE SELLA DESPUES DE SUBIR, NO ANTES. Al reves, una corrida que falla
en el medio deja el sello diciendo que todo se dibujo y **los cambios se
pierden para siempre**: la proxima corrida no ve diferencia. Es el mismo
orden que `sheet/procesar_entrada.py` usa con el contador de eventos.

⚠️ Y SE PUEDE SELLAR SOLO LO QUE SE SUBIO: `--sellar konan axinu`. Una
tanda que redibuja a cuatro y sube tres no puede sellar las cuatro.
"""
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, BASE)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

from comun import huella_codigo                           # noqa: E402

# ⚠️ NO EMPIEZA CON PUNTO Y VA COMMITEADO. Nacio como
# `datos/.pool_dibujado.json` y eso estaba mal por dos motivos: un
# archivo oculto que hay que versionar se pasa por alto —y si no viaja
# con el repo, Actions arranca sin sello y redibuja todo cada vez—, y
# guardaba los dos pools enteros, ~200 KB por corrida en el historial
# para siempre.
SELLO = os.path.join(BASE, 'datos', 'cartas_selladas.json')
MAPA = os.path.join(BASE, 'datos', 'campos_por_carta.json')

# como se llama cada carta en el mapa medido -> como se llama en R2
COMO_R2 = {'Temporada': 'temporada', 'Competitiva': 'competitivo',
           'Servidor': 'servidor', 'Pais': 'pais'}
TODAS = sorted(COMO_R2.values())


def _j(*p):
    ruta = os.path.join(BASE, *p)
    if not os.path.exists(ruta):
        return None
    with io.open(ruta, encoding='utf-8') as f:
        return json.load(f)


def estado():
    """{persona: {'c': {...}, 't': {...}}} — los DOS pools, por separado.

    🔴 LOS DOS, Y NO FUSIONADOS. La primera version juntaba los dos en un
    dict y copiaba **solo `seg` y `ter`** del de temporada. Eso dejaba sin
    vigilar `pts`, `oro`, `pod`, `racha`, `srv`, `sem`, `caz`, `czd` y
    `sob`, que viven **unicamente** ahi — o sea que un cambio de puntos no
    disparaba nada, y la carta que hay que redibujar cuando cambian los
    puntos es justo la Temporada.

    ⚠️ Y NO SE PUEDEN FUSIONAR: los dos pools tienen `score`, `ovr`,
    `pos`, `total`, `wr` y `rango` con **valores distintos** —uno es el de
    temporada y el otro el competitivo— asi que fusionar pisa uno con el
    otro y esconde la mitad de los cambios. Separados, un cambio en
    cualquiera de los dos se ve.
    """
    comp = _j('datos', 'competitivo_pool.json') or []
    temp = {x['raw']: x for x in (_j('datos', 'temporada_pool.json') or [])}
    out = {}
    for x in comp:
        # `av` se saca a proposito: cambia de hash sin que cambie la foto,
        # y quien sabe si la cara cambio es `bot/rehacer.py --cambiaron`,
        # que compara los BYTES. Dejarla aca redibujaria todo por nada.
        c = {k: v for k, v in x.items() if k != 'av'}
        t = {k: v for k, v in (temp.get(x['raw']) or {}).items() if k != 'av'}
        out[x['raw']] = {'c': c, 't': t}

    # 🔴 Y LOS QUE PASAN EL PORTON PERO NO ESTAN EN NINGUN POOL. Sin esto
    # el ciclo **no los ve existir**: `cambios()` compara contra este
    # dict, no los encuentra, y decide que no hay nada que dibujar.
    #
    # Medido el 22/09/2026, con el pool en cero por el reset: 319 pasan
    # el porton y **235 no tenian su carta de Servidor**, que es la que
    # el bot muestra por defecto y la unica sin requisito. El ciclo
    # informaba «nada cambió» todos los días, con razón desde su punto de
    # vista: para él no existía nadie.
    #
    # ⚠️ Es la cuarta vez que aparece la misma forma en un día —ver
    # `03_Servidor/generar._los_de_cero()`, `subir_datos.armar()` y el
    # inventario de R2—: **quién debe tener carta salía de una lista que
    # no es «quién debe tener carta»**. Acá la lista era el pool
    # competitivo, que mide desempeño, no identidad.
    #
    # ⚠️ PERO NO ENTRAN VACIOS, Y ESA ERA LA MITAD QUE FALTABA. La
    # primera versión los metía con `{'c': {}, 't': {}}`, y entonces
    # `huellas()` —que hashea los campos medidos de cada carta— les daba
    # a los 319 **el mismo hash**, porque todos los campos son `None`.
    # O sea: su carta se dibujaba una vez y después el sello no podía
    # ver **ningún** cambio. El día que a alguien le carguen el país, su
    # Servidor tiene que cambiar de bandera y no se enteraría.
    #
    # Sería una cache que no mira nada, que es exactamente lo que este
    # repo acaba de arreglar en las Bloqueadas.
    #
    # Entran con lo único que su carta sí dibuja: el país y en qué
    # servidores están — los dos campos que `_los_de_cero()` usa.
    try:
        import sys as _s
        _s.path.insert(0, os.path.join(BASE, 'bot'))
        _s.path.insert(0, os.path.join(BASE, 'sheet'))
        import verificados as _V
        import construir_padron as _PAD
        import subir_datos as _SD
        verif, _c = _V.cargar()
        donde = _j('datos', 'servidores_de.json') or {}
        if verif is not None:
            for p in _PAD.cargar():
                nom = p.get('raw') or ''
                if not nom or nom in out or not _V.pasa(p, verif):
                    continue
                svs = donde.get(str(p.get('discord_id') or '')) or []
                out[nom] = {'fuera': 1, 't': {},
                            'c': {'raw': nom,
                                  'cc': _SD._cc_de(p.get('pais')),
                                  'sv': (svs[0] if svs else ''),
                                  'svs': ','.join(sorted(svs))}}
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ no pude sumar los de fuera del pool (%s)' % str(e)[:60])
    return out


def mapa_viejo():
    """Generadores tocados DESPUES de medir el mapa. Lista de rutas.

    🔴 EL MAPA ES UNA CACHE Y SU FALLO ES EL MAS SILENCIOSO DE TODOS.
    `datos/campos_por_carta.json` dice que campo usa cada carta, y con
    eso este modulo decide **que redibujar**. Si un generador empieza a
    pedir un campo nuevo y el mapa no se volvio a medir, ese campo no
    dispara nada: la carta se queda vieja **para siempre** y el ciclo
    informa «nada cambio» todos los dias.

    ⚠️ No se avisa por antiguedad sino por **causa**: el mapa esta viejo
    exactamente cuando un generador cambio despues de medirlo. Un umbral
    de dias grita cuando no pasa nada y calla cuando si.

    🔴 Y LA CAUSA SE MIDE POR HUELLA, NO POR mtime. Hasta el 21/09/2026
    esto comparaba `os.path.getmtime` de cada `.py` contra el del JSON,
    y **un `git checkout` le pone a todos la hora del checkout**: en
    Actions, que es justamente donde corre el ciclo desatendido, esta
    funcion no detectaba nada nunca. La huella viaja dentro del JSON,
    asi que sobrevive al clone.

    ⚠️ ESTO NO ES LO MISMO QUE LA HUELLA DEL SELLO, aunque use la misma
    cuenta. El sello pregunta «¿hay que redibujar?» y ya se contesta
    solo. Esto pregunta «¿el mapa campo→carta se quedo corto?», que es
    peor y mas callado: si un generador empieza a pedir un campo nuevo y
    el mapa no lo sabe, **ese campo no dispara nada nunca mas**.

    Devuelve las cartas cuyo codigo cambio despues de medir el mapa.
    Se regenera con `python herramientas/que_pide_cada_carta.py`.
    """
    m = _j('datos', 'campos_por_carta.json')
    if not m:
        return []
    antes = m.get('codigo')
    # ⚠️ UN MAPA SIN `codigo` ES DE ANTES DE ESTE CAMBIO, y no se puede
    # saber con que codigo se midio. Se avisa igual —una vez— en vez de
    # callar: callar es exactamente el fallo que esta funcion existe
    # para evitar.
    if not antes:
        return ['(el mapa no guarda con qué código se midió: regeneralo)']
    hoy = huella_codigo.todas()
    return sorted(c for c in hoy if antes.get(c) != hoy[c])


def por_campo():
    """{campo: {cartas que lo usan}} desde la medicion."""
    m = _j('datos', 'campos_por_carta.json')
    if not m:
        return None
    inv = {}
    for carta, campos in m['cartas'].items():
        for k in campos:
            inv.setdefault(k, set()).add(COMO_R2.get(carta, carta.lower()))
    return inv, m.get('medido', '?')


def huellas():
    """{persona: {carta: '<datos>:<codigo>'}} del estado de AHORA.

    🔴 LAS DOS MITADES, Y LA SEGUNDA ES NUEVA. Hasta el 21/09/2026 esto
    hasheaba **solo los datos**, asi que un cambio en el codigo que
    dibuja no disparaba nada: los datos eran identicos, el sello no veia
    diferencia y la carta se quedaba vieja en silencio. Ya paso — la
    Competitiva *«tenia las fotos y dibujaba la inicial en 93 de 112»*
    fue un cambio de codigo puro con cero cambios en el pool. Ver
    `comun/huella_codigo.py`.

    ⚠️ VA PEGADO AL MISMO CAMPO A PROPOSITO, no en un bloque aparte. Asi
    `cambios()`, `sellar(solo=...)`, las tandas y el sello parcial
    siguen funcionando **sin tocar una linea**: comparan strings. Un
    bloque `codigo` global al lado habria necesitado su propia regla de
    «cuando se puede dar por saldado», y se saldaria despues de la
    primera tanda dejando a las otras 128 personas sin redibujar.

    ⚠️ Y ADEMAS EL DIFF DE GIT DICE **CUAL** DE LAS DOS CAMBIO, que es la
    primera pregunta cuando una corrida toca 138 personas de golpe.

    ⚠️ UN HASH POR CARTA, no un volcado del pool. El sello va commiteado
    —Actions lo necesita entre corridas— asi que los dos pools enteros
    serian ~200 KB por corrida en el historial para siempre; esto son
    ~10. Y el diff de git pasa a ser legible: se ve **que persona y que
    carta** cambio, que es exactamente la pregunta.

    ⚠️ SE HASHEA EL VALOR DE LOS DOS POOLS CUANDO EL CAMPO ESTA EN LOS
    DOS. `score`, `ovr`, `pos`, `total`, `wr` y `rango` existen en ambos
    con **valores distintos** —uno es el de temporada y el otro el
    competitivo—, asi que elegir uno esconderia la mitad de los cambios.
    Se meten los dos: se redibuja de mas antes que de menos.
    """
    import hashlib
    pc = por_campo()
    # 🔴 SIN EL MAPA, ESTO DEVOLVIA EL MISMO HASH PARA TODOS Y TODO.
    #
    # Con `mapa = {}` no hay campos que hashear, asi que las cuatro
    # cartas de las 138 personas daban `da39a3ee5e6b` —el sha1 de la
    # cadena vacia— y quedaban indistinguibles. Y `sellar()` **no
    # chequeaba el mapa**: sellar en ese estado guarda 552 hashes
    # identicos y a partir de ahi `cambios()` no encuentra nunca una
    # diferencia. El ciclo diria «nada cambio» todos los dias, para
    # siempre, sin un solo error.
    #
    # ⚠️ El chequeo va ACA y no en quien llama, porque el problema no es
    # de una ruta: es que **el resultado de esta funcion no significa
    # nada sin el mapa**. `main()` y `bot/pipeline.py` ya lo miraban;
    # `--sellar` no, y es justo el que deja el estado roto.
    if not pc:
        raise RuntimeError(
            'falta datos/campos_por_carta.json: sin el mapa campo→carta '
            'las huellas son todas iguales y el sello queda inservible. '
            'Corré `python herramientas/que_pide_cada_carta.py`.')
    mapa = pc[0]
    porcarta = {}
    for campo, cartas in mapa.items():
        for c in cartas:
            porcarta.setdefault(c, set()).add(campo)
    cod = huella_codigo.todas()
    est = estado()

    # 🔴 LA CARA ENTRA AL SELLO, Y HASTA HOY NO ENTRABA DE NINGUNA FORMA.
    # `estado()` saca `av` a propósito —esa URL cambia de hash sin que
    # cambie la foto— y no ponía nada en su lugar. Resultado: alguien usa
    # `/foto`, su cara queda guardada en R2 y **su carta no se redibuja
    # nunca**.
    #
    # ⚠️ Y EL MECANISMO QUE EL PROYECTO SEÑALABA PARA ESTO NO PODÍA VERLO.
    # `bot/rehacer.py --cambiaron` compara con `git status` sobre
    # `_avatares/`; las fotos de `/foto` llegan a **R2** y su espejo está
    # gitignoreado. Además `rehacer.py` no está en el ciclo.
    #
    # Lo que entra es el **etag** de R2, que es un hash del contenido: la
    # misma regla que `rehacer.py` ya tenía escrita —«pregunta por el
    # contenido, no por la fecha»— con la fuente correcta. Cuesta un
    # listado (443 fotos en 1,0 s) y no una descarga.
    #
    # ⚠️ VA EN LAS CUATRO CARTAS porque las cuatro dibujan la cara.
    #
    # ⚠️ Y SI R2 NO CONTESTA SE USA LO ÚLTIMO QUE SE SUPO, guardado en
    # `datos/fotos_etag.json`. Con `{}` todas las huellas cambiarían a la
    # vez y una caída de red costaría redibujar las 320.
    caras = {}
    try:
        import sys as _s2
        _s2.path.insert(0, os.path.join(BASE, 'bot'))
        import fotos as _FT
        import requests as _rq2
        _se = _rq2.Session()
        _se.headers['Authorization'] = ('Bearer '
                                        + _FT.env('CLOUDFLARE_API_TOKEN'))
        caras = _FT.etags(_se)
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ no pude leer las caras de R2 (%s): uso las de antes'
              % str(e)[:50])
        try:
            import fotos as _FT2
            caras = _FT2.etags(None)
        except Exception:                                # noqa: BLE001
            caras = {}

    from comun.claves import clave as _CL
    out = {}
    for quien, dos in est.items():
        h = {}
        cara = caras.get(_CL(quien), '')
        for carta in TODAS:
            campos = sorted(porcarta.get(carta, ()))
            crudo = []
            for k in campos:
                crudo.append('%s=%r|%r' % (k, dos['c'].get(k), dos['t'].get(k)))
            # ⚠️ La cara, en las cuatro. Ver el bloque de arriba.
            crudo.append('cara=%s' % cara)
            h[carta] = '%s:%s' % (
                hashlib.sha1('\n'.join(crudo).encode('utf-8')).hexdigest()[:12],
                cod.get(carta, '?'))
        out[quien] = h
    return out


def por_que(antes, hoy):
    """De un sello viejo a uno nuevo: que cambio, si los datos o el codigo.

    ⚠️ ES DERIVADO, NO GUARDADO. Las dos mitades estan en el mismo campo,
    asi que esto no necesita ningun estado extra que pueda quedar
    desfasado del que decide. Devuelve {carta: (n_datos, codigo_cambio)}.
    """
    out = {}
    for carta in TODAS:
        n, codcam = 0, False
        for quien, h in hoy.items():
            v, a = h.get(carta), (antes.get(quien) or {}).get(carta)
            if a is None or v == a:
                continue
            d0, _, c0 = a.partition(':')
            d1, _, c1 = v.partition(':')
            if d0 != d1:
                n += 1
            if c0 != c1:
                codcam = True
        out[carta] = (n, codcam)
    return out


def emitibles(quien, est=None):
    """Que cartas se le pueden emitir HOY a esa persona.

    🔴 SIN ESTO EL CICLO REINTENTA PARA SIEMPRE. Si alguien no tiene
    pais, `04_Pais/exportar_png.py` falla **con razon** —«sin dato no hay
    pieza»—, el pipeline lo cuenta como fallo, no lo sella, y la corrida
    siguiente lo vuelve a intentar. Todos los dias, sin avanzar nunca.

    ⚠️ Hoy no lo sufre nadie porque las 138 tienen pais, y por eso no
    aparecio probando. Pero el pool de la T1 sale del padron, donde
    **128 de 875 no tienen pais**: el dia que entre uno, el ciclo se
    queda con un fallo permanente que no dice por que.

    🔴 **Y SE FILTRA SOLO LO QUE NO SE PUEDE DIBUJAR, NO LO QUE EL BOT
    NO MUESTRA.** La primera version usaba `comun/requisitos.falta()`
    para las cuatro, y eso es otra cosa: `CLAUDE.md` dice que **el
    requisito bloquea la CARTA, no el DATO**. Los 22 que no llegan a 10
    eventos tienen su Competitiva dibujada y en R2 —el Worker les
    muestra la Bloqueada mirando `bl`/`cs`—, asi que filtrarla habria
    **dejado de refrescarles una carta que si existe**, en silencio.

    Lo unico que el exportador no puede producir es la de Pais de quien
    no tiene pais: «sin dato no hay pieza». Ese es el filtro, y nada mas.
    """
    est = est if est is not None else estado()
    ent = est.get(quien) or {}

    # 🔴 EL QUE NO ESTA EN NINGUN POOL SOLO PUEDE TENER LA SERVIDOR, y es
    # la única que no necesita datos de competencia: `03_Servidor` sabe
    # dibujarla en cero (`_los_de_cero()`). Las otras tres salen de los
    # pools, así que pedírselas al generador es pedirle que invente.
    #
    # ⚠️ NO ES EL REQUISITO OTRA VEZ. Las otras tres no se descartan
    # porque la persona no las **merezca** —para eso está la Bloqueada,
    # que el paso 5b del ciclo dibuja— sino porque el exportador **no
    # puede producirlas**. Es la misma razón por la que se descarta
    # `pais` de quien no tiene país: «sin dato no hay pieza».
    if ent.get('fuera'):
        return {'servidor'}

    fila = ent.get('c') or {}
    if not fila:
        return set(TODAS)
    out = set(TODAS)
    if not str(fila.get('cc') or '').strip():
        out.discard('pais')
    return out


def solo_dibujo(antes, hoy):
    """¿Cambió el código y NO los datos? `antes` y `hoy`, dos huellas.

    ⚠️ UNA CARTA SIN SELLO NO ES «SÓLO DIBUJO»: nunca se dibujó, así que
    lo que le falta es la primera, no un redibujo.
    """
    if not antes or not hoy or antes == hoy:
        return False
    return antes.partition(':')[0] == hoy.partition(':')[0]


def cambios(motivos=None, ahora=None):
    """(dict {persona: set(cartas)}, nuevas, idas, hay_sello).

    ⚠️ `motivos` es una lista que se LLENA, no un parametro que cambia
    lo que hace. Quien la pasa recibe el `por_que()` del mismo par de
    sellos que se comparo aca — asi el informe no puede discrepar del
    calculo, que es la forma de bug que este archivo mas repite. Y
    después, `{carta: cuántas esperan a la madrugada}`: ver abajo.

    🌙 LO QUE CAMBIÓ SÓLO DE DIBUJO ESPERA A LA MADRUGADA. Dlx,
    25/09/2026, sobre el naranja de Urban Freestyle: *«prográmalo para la
    madrugada, ya que no hay muchas cosas»*. Un cambio de código le toca a
    todo el pool con los mismos datos —50 minutos que no mueven un número—
    y de día eso atrasa lo que sí importa. Fuera de
    `madrugada.REDIBUJO` esas cartas no se piden, **no se sellan**, y la
    primera corrida de la noche las encuentra solas.

    ⚠️ QUIEN CAMBIÓ DE DATOS SE REDIBUJA IGUAL, y con el código nuevo: la
    regla mira carta por carta y frena sólo las que tienen en R2 los
    mismos datos de hoy.
    """
    hoy = huellas()
    antes = None
    if os.path.exists(SELLO):
        with io.open(SELLO, encoding='utf-8') as f:
            antes = (json.load(f) or {}).get('cartas')
    if antes is None:
        return {}, sorted(hoy), [], False
    if motivos is not None:
        motivos.append(por_que(antes, hoy))

    import madrugada as _MD
    ya = _MD.es_hora_de_redibujar(ahora)
    esperan = {}
    viejas, nuevas = set(antes), set(hoy)
    est = estado()
    out = {}
    for quien in sorted(nuevas & viejas):
        d = {c for c in TODAS if antes[quien].get(c) != hoy[quien].get(c)}
        # ⚠️ SOLO LAS QUE SE LE PUEDEN EMITIR. Ver `emitibles()`: pedir
        # una que no se puede es un fallo permanente que se reintenta
        # todos los dias sin avanzar.
        d &= emitibles(quien, est)
        # 🌙 y las que cambiaron sólo de dibujo, de madrugada
        if not ya:
            for c in sorted(d):
                if solo_dibujo(antes[quien].get(c), hoy[quien].get(c)):
                    d.discard(c)
                    esperan[c] = esperan.get(c, 0) + 1
        if d:
            out[quien] = d
    if motivos is not None:
        motivos.append(esperan)
    return out, sorted(nuevas - viejas), sorted(viejas - nuevas), True


def sellar(solo=None):
    """Guarda el estado actual como ya dibujado.

    ⚠️ `solo` LIMITA A UNAS PERSONAS. Una tanda que dibuja cuatro y sube
    tres no puede sellar las cuatro: la que falto se perderia.
    """
    h = huellas()

    # 🔴 NO SE SELLA UNA CARTA QUE NO SE PUEDE DIBUJAR. `huellas()`
    # calcula las cuatro para todo el mundo, y eso está bien —es un
    # hash, no una promesa—; guardarlas todas **sí** es una promesa: el
    # sello significa «esto ya está dibujado».
    #
    # ⚠️ ES UNA TRAMPA QUE SE ARMA SOLA. Hoy los 319 están fuera del pool
    # y sólo pueden tener la Servidor, así que sellar las otras tres no
    # se nota: nadie las consulta. Pero el día que uno entre al pool,
    # `emitibles()` pasa a devolver las cuatro, encuentra el sello puesto
    # y decide que ya están dibujadas — **y sus tres cartas nuevas no se
    # dibujan nunca**, sin un error.
    #
    # Es la misma forma que este repo se comió cuatro veces hoy: un paso
    # que da por hecho algo que nunca pasó. Acá se corta en el único
    # lugar donde «ya está dibujado» se escribe.
    est = estado()
    h = {quien: {c: v for c, v in cartas.items()
                 if c in emitibles(quien, est)}
         for quien, cartas in h.items()}

    previo = {}
    if os.path.exists(SELLO):
        with io.open(SELLO, encoding='utf-8') as f:
            previo = (json.load(f) or {}).get('cartas') or {}
    if solo is not None:
        solo = set(solo)
        nuevo = dict(previo)
        for quien in solo:
            if quien in h:
                nuevo[quien] = h[quien]
        # los que ya no estan en el pool salen del sello
        for quien in list(nuevo):
            if quien not in h:
                del nuevo[quien]
    else:
        nuevo = h
    from datetime import datetime, timezone
    # ⚠️ EN UTC Y CON EL DESFASE ESCRITO: `subir_datos.py` lo compara contra
    # `meta.sello`, que es UTC. Con `now()` a secas era la hora de la
    # máquina —UTC en Actions, la del este acá— y la comparación daba
    # distinto según dónde corriera.
    with io.open(SELLO, 'w', encoding='utf-8') as f:
        json.dump({'cuando': datetime.now(timezone.utc).isoformat(timespec='seconds'),
                   'cartas': nuevo}, f, ensure_ascii=False,
                  indent=0, sort_keys=True)
    return SELLO


def main():
    if '--sellar' in sys.argv:
        quienes = [a for a in sys.argv[1:] if not a.startswith('-')]
        p = sellar(quienes or None)
        print('\n   ✅ sellado: %s\n' % os.path.relpath(p, BASE))
        return 0

    pc = por_campo()
    if not pc:
        print('\n   🔴 falta `datos/campos_por_carta.json`.')
        print('      Corré `python herramientas/que_pide_cada_carta.py`.\n')
        return 1

    mot = []
    cam, nuevas, idas, hay = cambios(mot)
    esperan = mot[1] if len(mot) > 1 else {}

    if '--lista' in sys.argv:
        for quien in sorted(set(cam) | set(nuevas)):
            print(quien)
        return 0

    print('\n══ QUÉ QUEDÓ VIEJO ══\n')
    print('   el mapa campo→carta es del %s' % pc[1])
    viejos = mapa_viejo()
    if viejos:
        print('   🔴 el código de %d carta(s) cambió DESPUÉS de medir el '
              'mapa:' % len(viejos))
        for v in viejos:
            print('      %s' % v)
        print('      Si alguna pide un campo nuevo, ese campo no dispara')
        print('      nada y su carta se queda vieja en silencio.')
        # 🔴 Y CON LOS POOLS EN 0 NO SE PUEDE REGENERAR. El mapa se mide
        # **dibujando**: `que_pide_cada_carta.py` corre las cuatro cartas
        # con un pool espiado y anota que campo toca cada una. Sin gente
        # en el pool no toca ninguno, asi que no hay nada que medir.
        #
        # ⚠️ MANDAR A CORRERLO IGUAL ES MANDAR A UN CALLEJON. Desde el
        # reset de la T1 este aviso sale en cada corrida del ciclo con un
        # comando al lado que no puede funcionar, y un aviso asi enseña a
        # saltearse el aviso — que es justo lo contrario de lo que hace
        # falta el dia que la T1 tenga datos y el mapa SI haya que rehacer.
        hay_pool = False
        for n in ('temporada_pool.json', 'competitivo_pool.json'):
            try:
                with io.open(os.path.join(BASE, 'datos', n),
                             encoding='utf-8') as f:
                    hay_pool = hay_pool or bool(json.load(f))
            except (OSError, ValueError):
                pass
        if hay_pool:
            print('      Regenerá:')
            print('      python herramientas/que_pide_cada_carta.py')
        else:
            print('      ⚠️ pero los pools están en 0: el mapa se mide')
            print('      dibujando, así que HOY no se puede rehacer. Queda')
            print('      pendiente para cuando la T1 tenga datos.')
    print('')
    if not hay:
        print('   no hay sello anterior: es la primera corrida.')
        print('   `--sellar` marca el estado de ahora como ya dibujado,')
        print('   y desde la próxima se comparan los cambios.\n')
        return 0

    if esperan:
        import madrugada as _MD
        print('   🌙 %d carta(s) cambiaron sólo de dibujo y esperan a la '
              'madrugada (de 12 a %d AM ET): %s'
              % (sum(esperan.values()), _MD.REDIBUJO[1],
                 ', '.join('%s %d' % kv for kv in sorted(esperan.items()))))
        print('      REDIBUJAR_YA=true las adelanta.')
        print('')
    if not (cam or nuevas or idas):
        print('   ✅ nada cambió: no hay que redibujar nada\n')
        return 0

    if nuevas:
        print('   %d persona(s) NUEVA(s) — las cuatro cartas:' % len(nuevas))
        print('      %s\n' % ', '.join(nuevas[:12]))
    if idas:
        print('   %d ya no está(n) en el pool — su carta sigue en R2:'
              % len(idas))
        print('      %s\n' % ', '.join(idas[:12]))
    if cam:
        porcarta = {}
        for quien, cs in cam.items():
            for c in cs:
                porcarta.setdefault(c, []).append(quien)
        print('   %d persona(s) con datos distintos:\n' % len(cam))
        for c in TODAS:
            q = porcarta.get(c, [])
            print('      %-12s %3d   %s'
                  % (c, len(q), ', '.join(sorted(q)[:6]) +
                     (' …' if len(q) > 6 else '')))
    total = len(set(cam) | set(nuevas))
    print('\n   %d de %d personas para redibujar (%.0f %%)'
          % (total, len(estado()), 100.0 * total / max(1, len(estado()))))
    print('')
    return 0


if __name__ == '__main__':
    sys.exit(main())
