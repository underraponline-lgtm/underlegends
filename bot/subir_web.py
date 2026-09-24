# -*- coding: utf-8 -*-
"""LO QUE LA WEB MUESTRA, EN UNA SOLA CLAVE DE KV.

    python bot/subir_web.py            dice qué subiría, sin subir
    python bot/subir_web.py --aplicar  lo sube
    python bot/subir_web.py --auto     el self-check, sin red

🔴 UNA CLAVE Y NO CUARENTA Y CINCO. El Worker tiene **10 ms de CPU por
request** —es el límite que manda en todo este proyecto— y leer una
clave por persona para armar un ranking son 45 viajes a KV por visita.
Acá se arma el payload **una vez por ciclo** y el Worker sólo lo sirve:
una lectura y un template.

⚠️ ES LA MISMA REGLA QUE YA SIGUE `/card`: el Worker no calcula, lee
algo ya masticado. Ver `CLAUDE.md` — *«por eso el Worker no lee el
Sheet: lee datos ya masticados en KV o D1»*.

⚠️ Y LA CUENTA ATRÁS VIAJA COMO **INSTANTE**, no como «faltan 30 min».
El texto lo arma el navegador de quien mira, con su reloj. Mandar
minutos desde acá daría un contador que miente desde el segundo uno,
porque el payload se escribe una vez por hora. Es lo mismo que ya
aprendió `getProximos()` del Apps Script.
"""
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

# 🔴 LOS REQUISITOS, DE SU UNICO LUGAR. La web tiene que ofrecer sólo las
# cartas que la persona **se ganó**, y eso no lo sabe el inventario de R2:
# ahí quedaron las de la pre-temporada. Ver `_cartas()`.
from comun import requisitos as RQ  # noqa: E402

#: la clave. `web:` para que se vea de un vistazo que no es de `/card`.
CLAVE = 'web:lobby'

#: cuántos entran al ranking de la página. No son todos a propósito: el
#: payload viaja entero en cada visita y una tabla de 300 no se lee.
#:
#: ⚠️ ERA 50 Y AHORA 200. El 50 venía de una página que era **una tabla**:
#: con buscador, filtros por servidor y por país y orden por columna, una
#: lista larga deja de ser un problema y pasa a ser el contenido. Medido:
#: 54 filas pesan 8,4 KB del payload, o sea ~160 bytes cada una; 200 son
#: ~32 KB, que es menos que una sola foto de las que la página muestra.
TOPE = 200

#: 🔑 EL BUCKET ES PUBLICO Y LAS CARTAS ESTAN AHI. Es el dato que la web
#: no estaba usando y que es **todo el proyecto**: `/card` se las manda a
#: Discord desde esta misma URL. La clave es `<nombre en minúsculas>/
#: <carta>.webp`, estable a propósito (ver `urlCarta()` en worker.js).
R2 = 'https://pub-70d5821d06a8432c9cffd0c102195000.r2.dev'

#: Las cuatro, en el orden en que la página las muestra.
CARTAS = ('temporada', 'competitivo', 'servidor', 'pais')

#: Cuántos minutos después de empezar un evento sigue siendo «lo que
#: viene».
#:
#: 🔴 ERAN 180 Y MOSTRABAN EL PASADO COMO FUTURO. Dlx, 24/09/2026:
#: *«eso de lo que se viene está desactualizado»*. Medido en ese momento:
#: la sección anunciaba «DESGRACIAS EN TOKYO VOL 12» con el cartel de
#: **EN VIVO** parpadeando, y el evento había empezado **hace 160
#: minutos**. Con tres horas de gracia eso es lo correcto según la regla
#: y es una mentira según el título del bloque.
#:
#: ⚠️ 90 NO ES UN NUMERO REDONDO CUALQUIERA: es lo que dura una llave.
#: Debajo de eso un evento en curso desaparecería de la página mientras
#: la gente lo está jugando, que es el error contrario.
VENTANA_VIVO = 90


def _json(*p):
    try:
        with io.open(os.path.join(BASE, *p), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def armar():
    """El payload que la web necesita. Un dict, listo para `json.dumps`."""
    import cuando as CU
    from comun.temporada import SELLO

    pool = _json('datos', 'temporada_pool.json') or []
    r2 = _json('datos', 'cartas_r2.json') or {}
    # 🔴 EL POOL COMPETITIVO TAMBIEN, PARA PODER PREGUNTAR POR LOS
    # REQUISITOS. Los duelos de País —`dna_t` y `din_t`— viven ahí y no en
    # el de temporada, así que sin esto `requisitos.falta('pais', …)`
    # contesta que falta lo primero para todo el mundo. Es el mismo reparto
    # que ya documenta `comun/requisitos.py` en su self-check.
    _comp = {}
    for x in (_json('datos', 'competitivo_pool.json') or []):
        k = x.get('raw') or x.get('full')
        if k:
            _comp[k] = x
    # ⚠️ ORDENADO POR PUESTO Y NO POR PUNTOS. El `pos` ya lo calculó el
    # builder con sus desempates; reordenar acá sería una segunda regla
    # de orden que puede discrepar con la del Sheet.
    gente = sorted((p for p in pool if p.get('raw')),
                   key=lambda p: p.get('pos') or 9999)[:TOPE]

    from comun import respaldo as _resp
    _foto = _con_foto()
    _ver, _vieja = _versiones()
    tabla = [{
        'n': p.get('raw'),
        'pos': p.get('pos'),
        'sv': p.get('sv') or '',
        'cc': p.get('cc') or '',
        # 🔴 `pts` Y NO `total`. `total` es **cuánta gente hay en el
        # pool** —45— así que la primera versión de esta página mostró a
        # los cuarenta y cinco con «45 puntos», todos iguales, sin que
        # nada fallara. Es la forma de siempre en este repo: el dato
        # estaba y se pedía por otro nombre.
        'pts': p.get('pts') or 0,
        'ev': p.get('ev') or 0,
        # ⚠️ VA VACÍO DEBAJO DE 10 EVENTOS, igual que la carta y que el
        # Sheet. Si la web mostrara la letra sería la cuarta pantalla
        # diciendo otra cosa. Ver `01_Temporada/normal_v3.letra_rango`.
        'rg': _letra(p),
        # 🔴 EL COLOR VIAJA CON LA LETRA, no se mapea en el Worker. Es la
        # regla de siempre: `comun/rangos.py` es la fuente del rango y de
        # su acento, y una tabla `{'SSS':'#C77DFF', …}` escrita en
        # `worker.js` sería el SEXTO lugar donde vive el rango —los cinco
        # están contados en `CLAUDE.md`, y dos de ellos ya se
        # desincronizaron—. Mandándolo masticado, cambiar un acento en
        # `rangos.py` lo cambia en la web sola, en el ciclo siguiente.
        'rgc': _acento(_letra(p)),
        'ovr': p.get('ovr') or 0,
        'wr': p.get('wr') or '',
        'pod': p.get('pod') or 0,
        # 🔴 LAS TRES MEDALLAS, NO SOLO EL ORO. El medallero de la web
        # leía `seg` y `ter` y el payload mandaba sólo `oro`: las columnas
        # de plata y bronce salían en **0 para todos**, con tres personas
        # que sí tienen plata en el pool. No fallaba —un cero es un
        # número válido— y por eso la tabla se veía bien y mentía.
        'oro': p.get('oro') or 0,
        'seg': p.get('seg') or 0,
        'ter': p.get('ter') or 0,
        'sem': p.get('sem') or 0,
        'crew': p.get('crew') or '',
        # 🔑 QUE CARTAS TIENE ESTA PERSONA EN R2. La página las muestra de
        # verdad —es lo que el proyecto fabrica— y para eso necesita saber
        # **cuáles existen**, no adivinarlas: construir las cuatro URLs y
        # dejar que el navegador se coma cuatro 404 es una imagen rota por
        # carta que no está.
        'k': _clave(p),
        'c': _cartas(p, r2, _comp.get(p.get('raw'))),
        # 🔑 LA VERSIÓN DE CADA CARTA Y CUÁLES ESTÁN POR REDIBUJARSE. Ver
        # `_versiones()`: sin la primera el navegador muestra una imagen
        # guardada, y sin la segunda la carta contradice al ranking sin
        # decir por qué.
        'cv': _ver.get(p.get('raw')) or {},
        'vj': sorted(_vieja.get(p.get('raw')) or ()),
        # 🔑 SI ESTA PERSONA TIENE CARA. Dlx, 24/09/2026: *«en la sección
        # de tarjetas sólo quisiera ver tarjetas con avatares, no
        # muestres ahí si no hay avatares»*.
        #
        # ⚠️ VIAJA COMO DATO Y NO SE DECIDE EN LA PAGINA. El navegador no
        # puede saberlo: la cara está **dibujada adentro** del `.webp`,
        # así que desde el HTML una carta con inicial y una con foto son
        # el mismo pedido con el mismo 200. La única forma de preguntarlo
        # del lado del navegador sería mirar los píxeles.
        #
        # ⚠️ Y NO FILTRA LA TABLA NI EL RANKING, sólo la galería. Quien no
        # tiene foto compitió igual, y sacarlo del ranking le borraría lo
        # que sí se ganó. Es *«la bandera es identidad, el número es
        # ranking»* otra vez: la cara decide cómo se ve la carta, no si
        # la persona existe.
        #
        # ⚠️ EL SLUG NO ES `_clave()`. La clave de R2 es el nombre en
        # minúsculas y el inventario de fotos va por `respaldo._norm()`,
        # que además saca espacios y acentos: `Fakin Jose` es
        # `fakin jose` como clave y `fakinjose` como slug. Comparar uno
        # contra el otro le daría «sin foto» a todo el que tenga un
        # espacio o una tilde en el nombre — teniéndola.
        'fo': 1 if (_foto is None
                    or _resp._norm(p.get('raw')) in _foto) else 0,
    } for p in gente]

    _an = _json('datos', 'anuncios.json') or {}
    ann = _an.get('anuncios') or []
    prox = [{
        'nombre': x['nombre'],
        'sv': x.get('servidor') or '',
        # 🔑 EL INSTANTE, EN ISO UTC. El texto lo arma el navegador.
        'cuando': x['cuando'],
        'cupos': x.get('cupos') or '',
        # 🔑 EL LINK AL ANUNCIO. Dlx, 24/09/2026: *«lo que se viene
        # próximamente, EN VIVO (con el link del canal o invitación)»*.
        # Un link de Discord pide los **tres** ids —guild, canal y
        # mensaje— y `datos/anuncios.json` guardaba el NOMBRE del canal
        # y el id del mensaje, con lo cual no se podía armar nada. Los
        # tres existen al leer y ahora viajan: ver `anuncios.parsear()`.
        #
        # ⚠️ VA VACIO SI FALTA ALGUNO, y la vista no dibuja el enlace.
        # Un `href` a medias lleva a una página de error de Discord, que
        # es peor que no ofrecerlo. *Sin dato no hay pieza.*
        'link': ('https://discord.com/channels/%s/%s/%s'
                 % (x['guild_id'], x['canal_id'], x['msg_id'])
                 if x.get('guild_id') and x.get('canal_id') and x.get('msg_id')
                 else ''),
        'modalidad': x.get('modalidad') or '',
        'premios': (x.get('premios') or '')[:60],
    } for x in CU.proximos(ann, cuantos=5, margen_min=VENTANA_VIVO)]

    # 🔑 Y LO QUE ACABA DE PASAR, PORQUE «LO QUE SE VIENE» SE APAGA SOLO.
    # Dlx, 24/09/2026: *«hoy día hubieron muchos eventos, hay que mejorar
    # eso de LO QUE SE VIENE, EN VIVO»*. Medido ese día a las 4:35am: la
    # sección estaba **vacía** y era correcto —el último anuncio fue a las
    # 12:11am y la ventana de EN VIVO son 90 min— pero el resultado es que
    # el bloque desaparece justo el día que hubo cuatro eventos.
    #
    # ⚠️ NO SE AGRANDA LA VENTANA. Eso ya fue un bug: `margen_min=180`
    # mostraba como EN VIVO algo de hace 160 minutos. La ventana dice la
    # verdad; lo que faltaba era la otra mitad de la pregunta.
    #
    # ⚠️ Y SE EXCLUYEN LOS QUE YA ESTAN EN `prox`, o el mismo evento sale
    # dos veces —una como «en vivo» y otra como «pasó»— que es exactamente
    # el tipo de contradicción en pantalla que este proyecto persigue.
    _ya = {x.get('msg_id') for x in
           CU.proximos(ann, cuantos=5, margen_min=VENTANA_VIVO)}
    _ahora = __import__('datetime').datetime.utcnow().strftime(
        '%Y-%m-%dT%H:%M:%S')
    pas = []
    for x in sorted(ann, key=lambda y: str(y.get('cuando') or ''),
                    reverse=True):
        if x.get('msg_id') in _ya or not x.get('cuando'):
            continue
        if str(x['cuando']) >= _ahora:
            continue                       # todavía no pasó: es de `prox`
        pas.append({
            'nombre': x['nombre'],
            'sv': x.get('servidor') or '',
            'cuando': x['cuando'],
            'modalidad': x.get('modalidad') or '',
            'link': ('https://discord.com/channels/%s/%s/%s'
                     % (x['guild_id'], x['canal_id'], x['msg_id'])
                     if x.get('guild_id') and x.get('canal_id')
                     and x.get('msg_id') else ''),
        })
        if len(pas) >= 6:
            break

    return {
        'temporada': SELLO,
        'gente': len(pool),
        'tabla': tabla,
        'proximos': prox,
        'pasados': pas,
        'r2': R2,
        'cartas': list(CARTAS),
        'svs': _servidores(gente),
        'paises': _paises(gente),
        'rangos': _escalera(),
        # 🔑 TODO LO DE ACA SALE DE LOS DOS POOLS QUE YA ESTABAN. No hay
        # una consulta nueva ni una hoja nueva: duelos, rachas, crews y
        # récords son campos que el builder ya escribe y que **nadie
        # estaba mirando**. Es la forma de siempre en este repo, del lado
        # bueno: el dato estaba y el consumidor no lo pedía.
        'duelos': _duelos(),
        'rachas': _rachas(gente),
        'crews': _crews(),
        'records': _records(gente),
        'requisitos': _requisitos(),
        # ⚠️ para que la página pueda decir «esto es de hace X». Un dato
        # sin fecha no se distingue de uno viejo.
        'sello': __import__('time').strftime('%Y-%m-%dT%H:%M:%SZ',
                                             __import__('time').gmtime()),
        # 🔴 Y CUANDO SE LEYERON LOS ANUNCIOS, QUE NO ES LO MISMO. El
        # `sello` es **cuándo se escribió este payload**, y eso se puede
        # mover sin que los datos se muevan: correr `subir_web.py` a mano
        # lo pone en «recién» con anuncios de hace dos horas. Dlx lo vio
        # tal cual —*«eso de lo que se viene está desactualizado y dice
        # que se actualizó hace 35 m»*— y tenía las dos razones: el
        # evento era viejo Y la fecha medía otra cosa.
        #
        # ⚠️ La página muestra ESTE, no el `sello`: quien mira quiere
        # saber de cuándo es lo que está leyendo, no cuándo se copió.
        'leido': _an.get('cuando') or '',
    }


def _clave(p):
    """La clave de esa persona en R2.

    ⚠️ ES EL NOMBRE EN MINUSCULAS, y eso hay que sacarlo del inventario,
    no inventarlo: `bot/subir_cartas.py` la construye así, y probarlo con
    `Makma/temporada.webp` da 404 mientras `makma/temporada.webp` da 200.
    """
    return str(p.get('raw') or '').lower()


def _con_foto():
    """Los slugs que TIENEN una foto guardada en R2, o `None` si no se sabe.

    🔑 SALE DE `datos/fotos_etag.json`, QUE ESTA COMMITEADO. Es lo que
    `bot/fotos.py` deja al congelar las caras en R2, una entrada por
    persona, con el etag del objeto — o sea la respuesta exacta a «¿esta
    persona tiene cara?».

    ⚠️ Y NO SE PREGUNTA AL ESPEJO LOCAL. `comun/respaldo.avatar()` daría
    el mismo número acá —medido el 24/09/2026: **35 de 70, las mismas
    35**— y daría **cero** en un runner recién clonado, porque
    `comun/fotos/` está gitignoreado y el ciclo lo baja en un paso
    aparte. Un payload armado antes de ese paso escondería la galería
    entera sin que nada falle: es la forma que este repo ya documenta
    —*contar lo que hay en disco no es contar lo que salió*— y acá
    costaría la sección completa.

    ⚠️ DEVUELVE `None` SI EL INVENTARIO NO ESTA, y el que llama no filtra
    nada. Esconder a todos porque no pude leer mi propia entrada es
    exactamente el error que el párrafo de arriba describe: mejor una
    galería con caras de menos que una vacía.
    """
    d = _json('datos', 'fotos_etag.json')
    if not isinstance(d, dict) or not d:
        print('   ⚠️ sin datos/fotos_etag.json: nadie se filtra por foto')
        return None
    from comun import respaldo
    return set(respaldo._norm(k) for k in d)


def _versiones():
    """`({persona: {carta: version}}, {persona: {cartas viejas}})`.

    🔴 LA CARTA Y EL RANKING SE PUBLICAN EN MOMENTOS DISTINTOS, y por eso
    se contradecían. El ranking sale cuando el ciclo termina de escuchar;
    la carta nueva, cuando termina de dibujar — medido el 24/09/2026,
    36 min después, con el OVR moviéndose para todos en cada evento.
    Mientras tanto la web mostraba la imagen de antes debajo del número
    de ahora, sin decir nada.

    ⚠️ LA VIEJA SE SABE SIN ADIVINAR: es la misma pregunta que decide qué
    dibujar (`que_cambio.huellas()` contra el sello). Si la huella de hoy
    no es la sellada, lo que está en R2 se dibujó con otros datos.

    ⚠️ Y LA VERSIÓN SALE DEL SELLO, no de la hora: cambia exactamente
    cuando la carta se redibuja. La URL de R2 es estable a propósito, así
    que sin `?v=` el navegador puede seguir mostrando la guardada — el
    mismo problema que `bot/worker.js` ya resolvió para Discord.

    ⚠️ SI NO SE PUEDE MEDIR, NO SE MARCA NADA: una marca falsa de
    «actualizándose» es peor que ninguna.
    """
    import hashlib
    ver, vieja = {}, {}
    try:
        sello = (_json('datos', 'cartas_selladas.json') or {}).get('cartas') or {}
        for quien, cs in sello.items():
            ver[quien] = {c: hashlib.sha1(str(h).encode('utf-8'))
                          .hexdigest()[:8] for c, h in cs.items()}
        import que_cambio as QC
        for quien, cs in QC.huellas().items():
            antes = sello.get(quien) or {}
            malas = {c for c, h in cs.items() if c in antes and antes[c] != h}
            if malas:
                vieja[quien] = malas
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ no pude medir qué cartas están viejas: %s' % str(e)[:80])
        return ver, {}
    return ver, vieja


def _cartas(p, r2, comp=None):
    """Las cartas que esta persona TIENE **y se ganó**. Nunca inventa.

    🔴 SE PREGUNTA AL INVENTARIO, no se arman las cuatro URLs y se deja
    que el navegador descubra cuáles no están. Con 54 personas eso serían
    hasta 216 pedidos que terminan en 404 y una imagen rota por cada uno
    — y una carta que no existe **no es un error**: País pide tres
    condiciones y hoy no la tiene nadie.

    🔴 Y ADEMAS SE PREGUNTA POR EL REQUISITO, QUE ES LO QUE FALTABA. Estar
    en R2 significa «alguna vez se dibujó», no «le corresponde hoy»: el
    bucket todavía tiene las cartas de la **pre-temporada**, que se
    reseteó. Medido el 24/09/2026 con el pool en 72 personas:

        58 de 72 tenían al menos una carta que no se ganaron
        57 Competitivo (pide 10 eventos)  ·  56 País (pide 3+3 duelos)

    Makma aparecía con las cuatro teniendo **4 eventos**. La web se las
    ofrecía y al abrirlas se veía una carta de verdad — de otra temporada.

    ⚠️ Dlx, 24/09/2026: *«en el website no se tiene que mostrar ninguna
    tarjeta de las que tienen requisitos, a menos que se hayan cumplido
    esos requisitos»*.

    ⚠️ **EL BOT YA LO HACIA BIEN, y eso es lo que hay que leer acá.**
    `bot/subir_datos.py` arma `cs` (las que tiene) y `bl` (las
    bloqueadas) preguntándole a `comun/requisitos.py`; el registro de
    Makmah en KV dice `cs:["servidor"]` y `bl:["competitivo","pais",
    "temporada"]`, que es correcto. Las dos pantallas leían **fuentes
    distintas para la misma pregunta**: el bot el requisito y la web el
    inventario. Es el bug del rango en cinco lugares, con dos.

    ⚠️ **NO alcanza con el requisito solo**: sigue haciendo falta el
    inventario, porque una carta que le corresponde y todavía no se
    dibujó tampoco se puede mostrar. Son las dos condiciones, no una.
    """
    tiene = r2.get(_clave(p)) or {}
    # los duelos de País viven en el pool competitivo; el resto acá
    fila = dict(comp or {}, **p)
    out = []
    for c in CARTAS:
        if c not in tiene:
            continue
        try:
            if RQ.falta(c, fila, p.get('sv')) is None:
                out.append(c)
        except Exception:                                    # noqa: BLE001
            # ⚠️ SI NO SE PUEDE PREGUNTAR, NO SE OFRECE. Al revés —dar la
            # carta por buena cuando el chequeo falla— es volver al bug de
            # arriba, y en silencio.
            pass
    return out


def _servidores(gente):
    """Cuánta gente y cuántos puntos por servidor, con su color de marca.

    ⚠️ EL COLOR SALE DE `datos/colores_sv_marca.json`, que es donde ya
    vive — *«manda el logo»*, dice su propia nota. Escribir los nueve en
    el CSS de la página sería el mismo error que el rango en cinco
    lugares, con nueve en vez de ocho.
    """
    col = (_json('datos', 'colores_sv_marca.json') or {}).get('usar') or {}
    acc = {}
    for p in gente:
        sv = (p.get('sv') or '').upper()
        if not sv:
            continue
        a = acc.setdefault(sv, {'sv': sv, 'n': 0, 'pts': 0, 'ev': 0,
                                'color': col.get(sv, '#7E8B89')})
        a['n'] += 1
        a['pts'] += p.get('pts') or 0
        a['ev'] += p.get('ev') or 0
    return sorted(acc.values(), key=lambda a: (-a['n'], a['sv']))


def _paises(gente):
    """Lo mismo por país, ordenado por PUNTOS.

    🔴 NO POR CUANTA GENTE. La sección dice *«de dónde es la Liga, por
    puntos de su gente»* y ordenaba por cabezas: Noruega, con **1 rapero
    y 5.250 puntos**, quedaba décima debajo de Ecuador, con 2 y 2.083. El
    título prometía una cosa y la lista mostraba otra —y la que estaba mal
    era la lista, porque `Ranking Mundial` del Sheet también ordena por
    puntos.
    """
    acc = {}
    for p in gente:
        cc = (p.get('cc') or '').lower()
        if not cc:
            continue
        a = acc.setdefault(cc, {'cc': cc, 'n': 0, 'pts': 0})
        a['n'] += 1
        a['pts'] += p.get('pts') or 0
    return sorted(acc.values(), key=lambda a: (-a['pts'], -a['n']))


def _duelos(tope=10):
    """Quién gana más 1v1. Sale del pool competitivo, que ya lo trae.

    ⚠️ SOLO LOS QUE TIENEN DUELOS DE VERDAD. `duel_real` distingue al que
    peleó 0 del que no tiene el dato cargado, y son cosas distintas: un
    `0/0` en la tabla se lee como «perdió todo» cuando en realidad nadie
    le anotó una batalla.

    ⚠️ Y SE ORDENA POR GANADOS, NO POR Win%. Es la misma regla que ya
    tiene `rankings.tabla_duelos()`: un 1/1 da 100 % y no dice nada.
    """
    comp = _json('datos', 'competitivo_pool.json') or []
    con = [{'n': p.get('raw'), 'k': _clave(p), 'cc': p.get('cc') or '',
            'sv': p.get('sv') or '',
            'g': p.get('duel_v') or 0, 't': p.get('duel_t') or 0,
            'wr': p.get('wr') or ''}
           for p in comp if p.get('duel_real') and (p.get('duel_t') or 0)]
    con.sort(key=lambda x: (-x['g'], -x['t'], x['n'] or ''))
    return con[:tope]


def _rachas(gente, tope=8):
    """Quién viene encadenando eventos. `racha` es del pool de temporada.

    🔴 SE DESCARTA LA RACHA MAYOR QUE LOS EVENTOS, PORQUE ES IMPOSIBLE.
    Medido el 23/09/2026: **3 de 54** —Masino y Hassan con racha 3 y UN
    evento, Colesito con 2 y uno—. La columna `🔥` del Sheet guarda
    `actual/máxima` y ahí está contando otra cosa (probablemente batallas
    seguidas dentro de una llave, no eventos seguidos).

    ⚠️ NO SE "ARREGLA" EL NUMERO, SE SACA LA FILA. Inventar un tope
    —`min(racha, ev)`— daría un valor plausible y falso, que es justo lo
    que este repo persigue. Que la persona no aparezca en la tabla se
    nota; que aparezca con un número corregido a mano, no.
    """
    con = [{'n': p.get('raw'), 'k': _clave(p), 'cc': p.get('cc') or '',
            'r': p.get('racha') or 0, 'ev': p.get('ev') or 0}
           for p in gente
           if 0 < (p.get('racha') or 0) <= (p.get('ev') or 0)]
    con.sort(key=lambda x: (-x['r'], -x['ev']))
    return con[:tope]


def _crews():
    """Las crews con su gente y sus puntos.

    🔴 LA IDENTIDAD SALE DE `comun/crews.py`, NO DEL POOL. Es una regla de
    `CLAUDE.md`: el pool trae `crew` y `pos_crew` **viejos** —de un dict
    de 13 personas de antes de que Dlx pasara la lista de 48—, y las
    cuatro cartas ya sacan las dos cosas del módulo. Leer la identidad de
    un lado y el número del otro es exactamente el caso de Bloody, que
    figuraba 5/9 cuando era 2/9.

    ⚠️ EL UMBRAL DE 3 VALE IGUAL QUE PARA PAIS Y SERVIDOR: ser «1 de 1»
    no dice nada. Una crew con una persona no es una crew en una tabla.
    """
    try:
        from comun.crews import DE_CADA_UNO, norm
    except Exception:                                    # noqa: BLE001
        return []
    pool = _json('datos', 'temporada_pool.json') or []
    acc = {}
    for p in pool:
        c = DE_CADA_UNO.get(norm(p.get('raw')))
        if not c:
            continue
        a = acc.setdefault(c, {'crew': c, 'n': 0, 'pts': 0, 'mejor': '',
                               'mejor_pos': 10 ** 9})
        a['n'] += 1
        a['pts'] += p.get('pts') or 0
        if (p.get('pos') or 10 ** 9) < a['mejor_pos']:
            a['mejor_pos'] = p.get('pos') or 10 ** 9
            a['mejor'] = p.get('raw')
    fuera = [a for a in acc.values() if a['n'] >= 3]
    for a in fuera:
        a.pop('mejor_pos', None)
    return sorted(fuera, key=lambda a: (-a['pts'], -a['n']))


def _records(gente):
    """Los números que sobresalen. Uno por categoría, o ninguno.

    ⚠️ SI NADIE TIENE EL DATO, LA FICHA NO SALE. Es la regla del proyecto
    —*«sin dato no hay pieza»*—: un récord de racha con la temporada
    recién arrancada sería «1», y eso no es un récord, es que no hubo
    tiempo. Se devuelve sólo lo que tiene con qué medirse.
    """
    def top(campo, minimo=1):
        con = [p for p in gente if (p.get(campo) or 0) >= minimo]
        if not con:
            return None
        p = max(con, key=lambda x: x.get(campo) or 0)
        return {'n': p.get('raw'), 'k': _clave(p), 'cc': p.get('cc') or '',
                'v': p.get(campo)}

    def wr():
        # ⚠️ CON UN PISO DE EVENTOS. Un 100 % con un evento jugado no es
        # el mejor win rate de la liga, es el único que jugó una vez.
        con = [p for p in gente if (p.get('ev') or 0) >= 2 and p.get('wr')]
        if not con:
            return None
        def v(p):
            try:
                return float(str(p['wr']).rstrip('%').replace(',', '.'))
            except ValueError:
                return -1.0
        p = max(con, key=v)
        return {'n': p.get('raw'), 'k': _clave(p), 'cc': p.get('cc') or '',
                'v': p.get('wr')}

    def top_racha():
        con = [p for p in gente
               if 1 < (p.get('racha') or 0) <= (p.get('ev') or 0)]
        if not con:
            return None
        p = max(con, key=lambda x: x.get('racha') or 0)
        return {'n': p.get('raw'), 'k': _clave(p), 'cc': p.get('cc') or '',
                'v': p.get('racha')}

    salida = [
        ('ovr', 'OVR más alto', top('ovr')),
        ('pts', 'Más puntos', top('pts')),
        ('ev', 'Más eventos', top('ev', 2)),
        ('wr', 'Mejor win rate', wr()),
        ('pod', 'Más podios', top('pod')),
        # 🔴 LA RACHA PASA POR EL MISMO FILTRO QUE `_rachas()`, y esto
        # se me escapó: la tabla descartaba a Masino —racha 3 con UN
        # evento— y la ficha de récord lo mostraba igual, en la misma
        # pantalla. Dos piezas del mismo dato con dos reglas distintas
        # es peor que no filtrar ninguna.
        ('racha', 'Racha más larga', top_racha()),
    ]
    return [{'id': i, 'que': q, **d} for i, q, d in salida if d]


def _requisitos():
    """Qué hace falta para cada carta, dicho como lo lee una persona.

    🔴 SALE DE `comun/requisitos.py` Y NO SE ESCRIBE ACA. Es la fuente, y
    su propio docstring ya se contradijo dos veces con el dict que tiene
    treinta líneas más abajo. Una tercera copia, en una página pública,
    sería la que más gente lee y la primera en quedar vieja.
    """
    try:
        from comun.requisitos import REQUISITOS, como_se_dice
    except Exception:                                    # noqa: BLE001
        return []
    titulo = {'temporada': 'Temporada', 'competitivo': 'Competitiva',
              'servidor': 'Servidor', 'pais': 'País'}
    mide = {
        'temporada': 'Tu OVR de la temporada: cuánto hiciste.',
        'competitivo': 'Tu Score: la calidad, no el volumen. De acá sale el rango.',
        'servidor': 'Lo tuyo dentro del servidor donde más jugaste.',
        'pais': 'Tu OVR Nacional y tu puesto dentro de tu país.',
    }
    out = []
    for k in ('temporada', 'competitivo', 'servidor', 'pais'):
        cs = REQUISITOS.get(k) or []
        partes = [como_se_dice(k, m, '<sv>', i).lower()
                  for i, (m, _c, _q) in enumerate(cs) if m]
        out.append({
            'id': k, 'titulo': titulo[k], 'mide': mide[k],
            'pide': [('%d %s' % (m, p)) for (m, _c, _q), p
                     in zip([c for c in cs if c[0]], partes)] or ['nada'],
        })
    return out


def _escalera():
    """Los ocho rangos con su umbral, su color y su material.

    ⚠️ SALE DE `comun/rangos.py` ENTERA, incluida la `E`, que no tiene
    umbral propio —es «el resto»— y por eso `UMBRAL` sólo trae siete.
    Armarla a mano en la página dejaría a la `E` afuera o le inventaría
    un número.
    """
    try:
        from comun.rangos import UMBRAL, ACENTO, ORDEN, MATERIAL
    except Exception:                                    # noqa: BLE001
        return []
    u = dict(UMBRAL)
    return [{'r': r, 'min': u.get(r, 0), 'color': ACENTO.get(r, ''),
             'mat': MATERIAL.get(r, '')} for r in ORDEN]


def _letra(p):
    """La letra de rango, o `''`. Misma puerta que la carta."""
    try:
        from comun.requisitos import minimo
        if (p.get('ev') or 0) < minimo('competitivo', 'ev'):
            return ''
    except Exception:                                    # noqa: BLE001
        return ''
    return p.get('rango') or ''


def _acento(rg):
    """El color de esa letra, de `comun/rangos.py`. `''` si no hay letra.

    ⚠️ SE LE SACA EL SIGNO. Un `A+` y un `A−` comparten color —es la
    regla de `CLAUDE.md`, *«el signo cambia la pastilla, no el color»*—
    así que buscar `'A+'` en `ACENTO` daría vacío y la pastilla saldría
    gris justo para los que tienen subrango.
    """
    r = str(rg or '').rstrip('+-−')
    if not r:
        return ''
    try:
        from comun.rangos import ACENTO
        return ACENTO.get(r, '')
    except Exception:                                    # noqa: BLE001
        return ''


def _sin_sello(p):
    """El payload sin `sello`, para poder compararlo consigo mismo.

    ⚠️ `sello` ES LA HORA DE AHORA, así que cambia en cada corrida. Sin
    sacarlo, «¿cambió algo?» contesta que sí **siempre** y el diff-writer
    no escribe menos que el que escribe todo.
    """
    return json.dumps({k: v for k, v in (p or {}).items() if k != 'sello'},
                      ensure_ascii=False, sort_keys=True)


def _token():
    """El token de Cloudflare, o `''`.

    ⚠️ SIN `.env` DEVUELVE VACIO EN VEZ DE REVENTAR. Esto es un paso del
    ciclo desde el 23/09/2026, y lo que hace es **cosmético**: refrescar
    la página. Un `FileNotFoundError` acá imprimiría un traceback en el
    medio de una corrida que por lo demás está bien, y en un repo recién
    clonado —sin `.env`— pasaría siempre. Que la web quede vieja se
    dice con una línea; no se avisa tirando la corrida.
    """
    try:
        for l in io.open(os.path.join(BASE, '.env'), encoding='utf-8'):
            if l.strip().startswith('CLOUDFLARE_API_TOKEN='):
                return l.split('=', 1)[1].strip().strip('"\'')
    except OSError:
        pass
    return ''


def subir(payload, solo_si_cambio=False):
    """Lo deja en KV. Devuelve `True` si salió, `None` si no hizo falta.

    ⚠️ CON `solo_si_cambio` ES UN DIFF-WRITER, igual que
    `subir_datos.py`. KV da **1.000 escrituras por día** y el ciclo corre
    cada hora: escribir siempre no lo rompe, pero tampoco sirve — y el
    día que el ciclo baje a cada diez minutos, este número importa.
    """
    import requests
    import subir_datos as SD

    tok = _token()
    if not tok:
        return False
    if solo_si_cambio:
        try:
            r = requests.get('%s/values/%s' % (SD.API, CLAVE),
                             headers={'Authorization': 'Bearer ' + tok},
                             timeout=45)
            if r.status_code == 200 and \
                    _sin_sello(json.loads(r.text)) == _sin_sello(payload):
                return None
        except (ValueError, OSError):
            # ⚠️ SI NO SE PUEDE LEER, SE ESCRIBE. El error de este lado es
            # dejar la web vieja, no gastar una escritura de más.
            pass
    r = requests.put('%s/values/%s' % (SD.API, CLAVE),
                     headers={'Authorization': 'Bearer ' + tok},
                     files={'value': (None, json.dumps(payload,
                                                       ensure_ascii=False)),
                            'metadata': (None, '{}')},
                     timeout=60)
    return r.status_code == 200


def _self_check():
    print('\n  subir_web.py — self-check\n')
    mal = 0

    def ok(cond, que):
        nonlocal mal
        mal += not cond
        print('   %s %s' % ('ok' if cond else '🔴', que))

    p = armar()
    ok(isinstance(p.get('tabla'), list), 'arma la tabla  (%d)'
       % len(p.get('tabla') or []))
    ok(len(p['tabla']) <= TOPE, 'y no pasa de %d filas' % TOPE)

    # 🔴 LA LETRA SIGUE LA MISMA PUERTA QUE LA CARTA. Si la web mostrara
    # el rango con 1 evento sería la cuarta pantalla diciendo otra cosa.
    con_letra = [f for f in p['tabla'] if f['rg']]
    flojos = [f for f in con_letra if (f['ev'] or 0) < 10]
    ok(not flojos, 'nadie con menos de 10 eventos trae letra  %s'
       % ([f['n'] for f in flojos][:4] or '—'))

    # 🔴 LA LETRA Y SU COLOR VAN JUNTOS, O NINGUNO. El color viaja en el
    # payload justamente para que `worker.js` no tenga su propia tabla de
    # rangos; si `rgc` se quedara vacío con `rg` puesto, la pastilla
    # saldría gris —o sea, el rango sin su color— y nadie se enteraría,
    # porque una pastilla gris se ve como una pastilla.
    sueltos = [f for f in p['tabla'] if bool(f.get('rg')) != bool(f.get('rgc'))]
    ok(not sueltos, 'cada letra viaja con su color  %s'
       % ([(f['n'], f.get('rg'), f.get('rgc')) for f in sueltos][:3] or '—'))
    # ⚠️ Y QUE EL SUBRANGO NO SE QUEDE SIN COLOR. `ACENTO` tiene ocho
    # claves y ningún `A+`: es la regla de `CLAUDE.md` —*«el signo cambia
    # la pastilla, no el color»*—. Un `.get('A+')` daría vacío justo para
    # los cuatro tramos que llevan signo.
    from comun.rangos import ACENTO as _AC
    malas = [r for r in ('A+', 'A', 'A−', 'B-', 'D+', 'SSS', 'E')
             if not _acento(r)]
    ok(not malas, 'los subrangos con signo también tienen color  %s'
       % (malas or '—'))
    ok(_acento('A+') == _AC['A'], 'y es el color de su tramo, no otro')
    ok(_acento('') == '', 'sin letra no hay color')

    # ⚠️ el orden es el `pos` del builder, no un segundo criterio
    pos = [f['pos'] for f in p['tabla'] if f['pos']]
    ok(pos == sorted(pos), 'la tabla va en orden de puesto')

    # 🔑 los próximos viajan como INSTANTE, no como «faltan N»
    ok(all(re_iso(x['cuando']) for x in p['proximos']),
       'los eventos viajan con su instante ISO  (%d)' % len(p['proximos']))

    # 🔴 QUE LOS PUNTOS SEAN LOS PUNTOS. La primera version pedia
    # `total`, que es **cuanta gente hay en el pool**, asi que la pagina
    # mostro a los 45 con «45 puntos» — todos iguales y ninguno cierto.
    # No fallaba: el campo existia y traia un numero.
    pool = _json('datos', 'temporada_pool.json') or []
    if pool and p['tabla']:
        top = max((x.get('pts') or 0) for x in pool)
        ok(p['tabla'][0]['pts'] == top,
           'el #1 trae los puntos del #1 del pool  (%s vs %s)'
           % (p['tabla'][0]['pts'], top))
        distintos = len({f['pts'] for f in p['tabla']})
        # ⚠️ con una sola persona no prueba nada, por eso el `if`
        if len(p['tabla']) > 3:
            ok(distintos > 1,
               'y no son todos el mismo numero (%d valores distintos)'
               % distintos)

    ok(json.dumps(p, ensure_ascii=False) and True, 'el payload es JSON')
    tam = len(json.dumps(p, ensure_ascii=False).encode('utf-8'))
    # ⚠️ KV admite 25 MB por valor; el problema no es ese sino que el
    # payload viaja entero en CADA visita.
    ok(tam < 120000, 'y pesa poco: %.1f KB' % (tam / 1024.0))

    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


def re_iso(s):
    import re
    return bool(re.match(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}', str(s or '')))


def main():
    if '--auto' in sys.argv:
        return _self_check()
    p = armar()
    print('\n══ LO QUE VA A LA WEB ══\n')
    print('   temporada %s · %d en el padrón del pool' % (p['temporada'],
                                                          p['gente']))
    print('   %d fila(s) de ranking · %d evento(s) por venir'
          % (len(p['tabla']), len(p['proximos'])))
    for f in p['tabla'][:5]:
        print('      #%-3s %-16s %-5s %8s pts  %s'
              % (f['pos'], f['n'][:16], f['sv'], f['pts'], f['rg'] or '—'))
    for x in p['proximos']:
        print('      ⏳ %-30s %s' % (x['nombre'][:30], x['cuando']))
    tam = len(json.dumps(p, ensure_ascii=False).encode('utf-8'))
    print('\n   payload: %.1f KB' % (tam / 1024.0))
    if '--aplicar' not in sys.argv:
        print('\n   (simulacro: no subí nada — agregá `--aplicar`)\n')
        return 0
    okk = subir(p, solo_si_cambio='--siempre' not in sys.argv)
    if okk is None:
        print('\n   ✓ ya estaba igual arriba: no gasté una escritura\n')
        return 0
    print('\n   %s\n' % ('✅ subido a KV como `%s`' % CLAVE if okk
                         else '🔴 no pude subirlo'))
    return 0 if okk else 1


if __name__ == '__main__':
    raise SystemExit(main() or 0)
