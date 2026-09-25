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
import re
import sys
from collections import Counter, defaultdict

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
#: 🔑 LOS PERFILES VAN EN OTRA CLAVE: el lobby se baja en CADA visita y el
#: perfil sólo cuando alguien abre uno. Juntos, el Inicio cargaría el
#: historial de toda la Liga para mostrar cinco nombres.
CLAVE_PERFILES = 'web:perfiles'

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

#: Cuántas llaves viajan en el payload, además de las de «Lo que pasó».
#:
#: ⚠️ LAS MÁS NUEVAS Y NO TODAS. Una llave pesa ~1,5 KB y FFA juega cuatro
#: por día: la temporada entera serían ~600 KB en CADA visita. Con 24 el
#: calendario abre el cuadro de los últimos días; las de antes llevan al
#: mensaje de Discord. El día que haga falta más, van a R2 aparte.
LLAVES_WEB = 24


def _nom(s):
    """El nombre sin el subrayado de Discord: `__RAP EXHIBITION__` es
    `RAP EXHIBITION`. Se veía tal cual en «Lo que pasó» y en el
    calendario."""
    return str(s or '').strip().strip('_*~ ').strip()


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
    _avs = _avatares()
    _ult = _ultimos()
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
        # 🔑 EL SCORE, SÓLO DE QUIEN TIENE LETRA: es el número del ranking
        # Competitivo, y debajo de 10 eventos no hay ranking que mostrar.
        'sc': (round(float(_comp.get(p.get('raw'), {}).get('score')
                           or p.get('score') or 0), 1) if _letra(p) else 0),
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
        # 🔑 LO QUE EL RANKING DE TEMPORADA OFICIAL TIENE Y LA WEB NO. Dlx,
        # 25/09/2026: «chequea cómo está el ranking temporada el oficial…
        # tiene racha, último evento, sobrevivió, cazó, cazado, rango».
        'rch': [p.get('racha_act') or 0, p.get('racha') or 0],
        'caz': p.get('caz') or 0,
        'czd': p.get('czd') or 0,
        'sob': p.get('sob') or 0,
        'ult': (_ult.get(_resp._norm(p.get('raw')) + '|' + (p.get('cc') or '').lower())
                or ([] if p.get('raw') in _choques() else _ult.get(_resp._norm(p.get('raw'))))
                or []),
        # 🔑 EL AVATAR DE DISCORD, `<id>/<hash>`, para el círculo del ranking.
        # Ver `_avatares()`: la foto de R2 NO, que su dirección es secreta.
        'av': ('%s/%s' % (p.get('discord_id'), _avs[str(p.get('discord_id'))])
               if _avs.get(str(p.get('discord_id') or '')) else ''),
    } for p in gente]

    _an = _json('datos', 'anuncios.json') or {}
    ann = _an.get('anuncios') or []
    _link = lambda x: ('https://discord.com/channels/%s/%s/%s'
                       % (x['guild_id'], x['canal_id'], x['msg_id'])
                       if x.get('guild_id') and x.get('canal_id') and x.get('msg_id')
                       else '')
    _dt_ = __import__('datetime')
    _t = _dt_.datetime.now(_dt_.timezone.utc).replace(tzinfo=None)
    _ahora = _t.strftime('%Y-%m-%dT%H:%M:%S')
    # 🔑 LOS ANUNCIADOS SIN UNA HORA QUE SE PUEDA LEER, UNAS HORAS EN «LO QUE
    # VIENE». Desde el lector ancho (25/09/2026) entran los de DRA, que dan
    # la hora por país —«🇲🇽 16:00 · 🇦🇷 19:00»— y ésa no se convierte en un
    # instante (ver `cuando.momento()`: una hora mal leída sería peor). Sin
    # esto, un evento de esta noche aparecía en «Lo que pasó» apenas se
    # anunciaba. Van con su hora de publicación y `sin_hora`: la página dice
    # «anunciado hace X» en vez de una cuenta atrás.
    SIN_HORA_H = 3
    sin_hora = []
    for x in ann:
        if CU.momento(x) or not x.get('cuando'):
            continue
        pub = CU._leer_iso(x['cuando'])
        if pub and 0 <= (_t - pub).total_seconds() < SIN_HORA_H * 3600:
            sin_hora.append(x)
    sin_hora.sort(key=lambda x: str(x.get('cuando')), reverse=True)
    prox = [{
        'nombre': _nom(x['nombre']),
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
    prox += [{'nombre': _nom(x['nombre']), 'sv': x.get('servidor') or '',
              'cuando': x['cuando'], 'sin_hora': 1,
              'cupos': x.get('cupos_texto') or '', 'link': _link(x),
              'modalidad': x.get('modalidad') or '',
              'premios': (x.get('premios') or '')[:60]}
             for x in sin_hora][:max(0, 5 - len(prox))]

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
           CU.proximos(ann, cuantos=5, margen_min=VENTANA_VIVO) + sin_hora}
    # 🔴 «PASÓ» ES QUE ARRANCÓ, NO QUE SE PUBLICÓ. Esto comparaba la hora de
    # publicación, así que un evento anunciado para la noche figuraba como
    # pasado desde que se anunciaba. Ahora cuenta el arranque; y el que no
    # tiene hora, recién cuando deja de estar en «Lo que viene».
    _ini = lambda y: CU.momento(y) or str(y.get('cuando') or '')
    pas = []
    for x in sorted(ann, key=_ini, reverse=True):
        if x.get('msg_id') in _ya or not x.get('cuando'):
            continue
        if _ini(x) >= _ahora:
            continue                       # todavía no pasó: es de `prox`
        pas.append({
            'nombre': _nom(x['nombre']),
            'sv': x.get('servidor') or '',
            # Dlx, 25/09/2026: «quizás nombrar al organizador también»
            'org': _org(x.get('organizador')),
            # Dlx, 25/09/2026: «poner el rango de esta misma» — el nivel del
            # evento cuando el anuncio lo dice (DRA: TIER 1, 2, 3, MIX)
            'rango': _rango_ev(x.get('rango')),
            'cuando': _ini(x),
            'modalidad': x.get('modalidad') or '',
            'link': ('https://discord.com/channels/%s/%s/%s'
                     % (x['guild_id'], x['canal_id'], x['msg_id'])
                     if x.get('guild_id') and x.get('canal_id')
                     and x.get('msg_id') else ''),
        })
        if len(pas) >= 6:
            break

    # 🔑 «VER LLAVES»: la llave de cada uno, si ya se procesó. Dlx,
    # 25/09/2026. El cruce vive en `sheet/llaves_web.py`, con su
    # self-check, porque el anuncio y la llave no comparten ninguna
    # clave: los junta el servidor, la fecha y el nombre.
    #
    # ⚠️ VIAJAN ACÁ Y NO EN UNA CLAVE DE KV PROPIA: son seis como mucho,
    # y el lobby ya se escribe sólo cuando cambia. Ver `llaves_web.py`.
    try:
        _sh = os.path.join(BASE, 'sheet')
        if _sh not in sys.path:
            sys.path.append(_sh)
        import llaves_web as _LW
        regs = _LW.leer()
        llaves = _LW.cruzar(pas, regs)
        # 🔑 Y LAS MÁS NUEVAS, para que el calendario de «Eventos» abra su
        # cuadro. Ver `LLAVES_WEB`.
        _inst = _LW.instantes(regs)
        for n in sorted(regs, key=lambda n: _inst.get(int(n), 0) if str(n).isdigit()
                        else 0, reverse=True)[:LLAVES_WEB]:
            llaves.setdefault(n, regs[n])
        # 🔑 CON EL ÁRBOL: de qué batalla viene cada lado, que es lo que
        # dibuja el cuadro. Dlx, 25/09/2026, con la imagen de una llave
        # clásica: *«pensé que ibas a crear algo así y rellenar los nombres
        # en esos huecos»*. Ver `llaves_web.enlazar()`.
        llaves = {n: dict(r, rondas=_LW.enlazar(r.get('rondas') or []))
                  for n, r in llaves.items()}
        _info = {}
        calendario = _calendario(ann, regs, llaves, _LW, CU, _ahora, _info)
        for _n, _f in _info.items():
            if _n in llaves:
                llaves[_n] = dict(llaves[_n], info=_f)
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ sin llaves para «Lo que pasó» (%s)' % str(e)[:60])
        regs, llaves, calendario = {}, {}, []

    # 🔑 LA FASE: prueba hasta que arranca la temporada, y sus fechas. La
    # página decide qué mostrar según el día de quien mira. Ver `FECHAS`.
    from comun.temporada import ACTUAL, FECHAS
    _f = FECHAS.get(ACTUAL)
    return {
        'temporada': SELLO,
        'fase': {'arranca': _f[0], 'termina': _f[1]} if _f else None,
        'gente': len(pool),
        'tabla': tabla,
        'proximos': prox,
        'pasados': pas,
        'llaves': llaves,
        # 🔑 LA TEMPORADA EN UN CALENDARIO: lo que pasó y lo que viene. Ver
        # `_calendario()`.
        'calendario': calendario,
        # 🔴 LOS EVENTOS DE LA TEMPORADA, NO LAS PARTICIPACIONES. El Inicio
        # sumaba `ev` de cada persona y decía «134 eventos» con siete
        # jugados (auditoría del 25/09/2026).
        'eventos': len(regs),
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
        'duelos': _duelos(tope=300),
        'rachas': _rachas(gente),
        'crews': _crews(),
        'records': _records(gente, regs, _comp),
        # 🔑 LO QUE DLX PIDIÓ PARA EL INICIO EL 25/09/2026: «medir la
        # actividad», «3 mini recent feeds de DRA… información de la liga»
        # y las redes. Ver `_actividad()`, `_novedades()` y `_redes()`.
        'actividad': _actividad(regs),
        # 🔑 CUÁNTA GENTE TIENE LA LIGA. Ver `_comunidad()`.
        'comunidad': _comunidad(),
        # 🔑 LAS NOVEDADES SON LO DE LA LIGA EN DRA, y el feed las REDES.
        # Dlx, 25/09/2026: «lo último de la liga que sea como novedades,
        # información», y las redes en grande aparte, arriba del top 5.
        'novedades': _novedades(tope=8),
        # 🔑 EL FEED: lo de DRA y los últimos videos de YouTube de cada
        # servidor, del más nuevo al más viejo. Ver `_feed()`.
        'feed': _feed(),
        # 🔑 LA GUÍA CON LOS NÚMEROS DE VERDAD: cuántos puntos da cada
        # puesto (de `Config`, la tabla con la que se puntúa) y de qué está
        # hecho el OVR y el Score (de `sheet/ovr.py` y `sheet/competitivo.py`,
        # los que calculan). Escritos a mano en la página se quedarían viejos
        # el día que cambie un peso.
        'guia': _guia(),
        'redes': _redes(),
        # ⚠️ LOS PERFILES NO VIAJAN EN EL LOBBY: `main()` los saca de acá y
        # los sube aparte, a `CLAVE_PERFILES`. Ver `_perfiles()`.
        '_perfiles': _perfiles(gente, list(_comp.values()), regs),
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


def _org(s):
    """`@!    MMC.` -> `MMC.`: el organizador, sin la arroba ni el relleno."""
    return re.sub(r'^[@!\s]+', '', str(s or '')).strip()


_EMOJI = re.compile(r'<a?:\w+:\d+>')
_MENCION = re.compile(r'<[@#][!&]?\d+>|@everyone|@here')


def _limpio_md(s):
    """Los renglones de un mensaje de Discord, sin su formato.

    ⚠️ SE SACAN LOS EMOJIS PROPIOS DEL SERVIDOR (`<:CorazonLleno:152…>`):
    afuera de Discord son texto crudo. Y los separadores `▬▬▬`, que en la
    web son un renglón de rayas.
    """
    out = []
    for l in str(s or '').split('\n'):
        l = _MENCION.sub('', _EMOJI.sub('', l))
        # un anuncio con ping arranca con «@everyone»: en la página no dice nada
        l = re.sub(r'@(everyone|here)\b', '', l)
        l = re.sub(r'^\s*(-#|#{1,3})\s*', '', l)
        l = re.sub(r'\*\*|__|~~|`', '', l).strip(' ▬—=·\t')
        if l:
            out.append(l)
    return out


def _discord():
    """Una sesión con el token del bot, o `None` si no hay red o token."""
    if _SIN_RED[0]:
        return None
    try:
        import requests
        import fotos as FO
        s = requests.Session()
        s.headers['Authorization'] = 'Bot ' + FO.env('DISCORD_TOKEN')
        return s
    except (SystemExit, Exception):                      # noqa: BLE001
        return None


def _avatares():
    """`{discord_id: hash}` de los miembros de DRA, para el ranking.

    🔴 EL AVATAR DE DISCORD Y NO LA FOTO DE R2. La foto congelada vive bajo
    `fotos/<sal>-t1/` y la sal existe para que la cara de alguien no se
    pueda bajar sabiendo su nombre (`comun/temporada.sal_fotos()`):
    publicar UNA de esas direcciones en el payload, que es público, dejaría
    a la vista las 427. El avatar de Discord es lo que cualquiera del
    servidor ya ve, y si la persona lo cambia o se va, el link se muere
    con él, que es justo lo que la sal quería.

    ⚠️ SIN RED O SIN TOKEN, NADIE TIENE CÍRCULO: la página pone la inicial.
    """
    s = _discord()
    if s is None:
        return {}
    # ⚠️ DRA Y FFA, NO SNAKE RAP: medido el 25/09/2026 sobre los 50 del pool
    # con Discord ID, DRA da 33, FFA suma 14 y Snake Rap no suma ninguno —y
    # tarda 11 s en listar sus 7.300—. El avatar es el global de la cuenta,
    # así que alcanza con encontrar a la persona en uno.
    out = {}
    for sv in ('DRA', 'FFA'):
        try:
            import fotos as FO
            for k, v in FO.avatares_del_servidor(s, FO.guild(sv)).items():
                if v and k not in out:
                    out[k] = v
        except (SystemExit, Exception) as e:             # noqa: BLE001
            print('   ⚠️ sin avatares de %s (%s)' % (sv, str(e)[:60]))
    return out


def _textos_v2(cs):
    """El texto de los componentes V2 de un mensaje (Text Display), en orden."""
    out = []
    for c in cs or []:
        if isinstance(c, dict):
            if c.get('type') == 10:
                out.append(c.get('content') or '')
            out += _textos_v2(c.get('components'))
    return out


def _novedades(tope=3):
    """Lo último que publicó la Liga en DRA, para el Inicio.

    🔑 Dlx, 25/09/2026: *«3 mini recent feeds de DRA únicamente, como una
    pestaña de novedades… información de la liga»*. El canal es
    〢🌍〉rankings-liga-global (`canales.DRA.novedades`), donde se anuncia
    la página, las postulaciones y cada actualización.

    ⚠️ SIN LAS IMÁGENES: las direcciones de los adjuntos de Discord vienen
    firmadas y cambian en cada pedido, así que el lobby cambiaría en cada
    corrida y gastaría una escritura de KV por nada. Va el texto y el link.
    """
    s = _discord()
    sv = _json('datos', 'servidores.json') or {}
    canal = ((sv.get('canales') or {}).get('DRA') or {}).get('novedades')
    guild = ((sv.get('servidores') or {}).get('DRA') or {}).get('guild_id')
    if s is None or not canal or not guild:
        return []
    try:
        r = s.get('https://discord.com/api/v10/channels/%s/messages' % canal,
                  params={'limit': 10}, timeout=20)
        ms = r.json() if r.status_code == 200 else []
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ sin novedades de DRA (%s)' % str(e)[:60])
        return []
    out = []
    for m in ms if isinstance(ms, list) else []:
        # 🔑 CON EL EMBED, SI LO HAY. Un anuncio «decorado» del bot es un
        # embed con poco o nada de texto, y esto leía sólo el texto: Dlx,
        # 25/09/2026, pidió anunciar en este canal y que saliera en la web.
        # ⚠️ SÓLO LOS `rich` (los que arma un bot): la vista previa que
        # Discord le pone a un link también es un embed, y no es anuncio.
        partes = [m.get('content') or '']
        for e in (m.get('embeds') or [])[:1]:
            if (e or {}).get('type') == 'rich':
                partes += [e.get('title') or '', e.get('description') or '']
        # 🔑 Y LOS COMPONENTES V2 (títulos con #, listas): un mensaje así no
        # trae `content` ni `embeds`, todo su texto vive en los Text Display
        # (tipo 10), a veces adentro de un contenedor o una sección.
        partes += _textos_v2(m.get('components'))
        ls = _limpio_md('\n'.join(p for p in partes if p))
        if not ls:
            continue
        a = m.get('author') or {}
        out.append({'t': str(m.get('timestamp') or '')[:19] + 'Z',
                    'tit': ls[0][:110], 'tx': ' '.join(ls[1:])[:280],
                    'de': a.get('global_name') or a.get('username') or '',
                    'link': 'https://discord.com/channels/%s/%s/%s' % (guild, canal, m['id'])})
        if len(out) >= tope:
            break
    return out


#: las versalitas que usan los anuncios («ʙʀᴏɴᴄᴇ ɪɪɪ»): NFKD no las toca
_VERSALITAS = {'ᴀ': 'a', 'ʙ': 'b', 'ᴄ': 'c', 'ᴅ': 'd', 'ᴇ': 'e', 'ꜰ': 'f', 'ɢ': 'g',
               'ʜ': 'h', 'ɪ': 'i', 'ᴊ': 'j', 'ᴋ': 'k', 'ʟ': 'l', 'ᴍ': 'm', 'ɴ': 'n',
               'ᴏ': 'o', 'ᴘ': 'p', 'ǫ': 'q', 'ʀ': 'r', 'ꜱ': 's', 'ᴛ': 't', 'ᴜ': 'u',
               'ᴠ': 'v', 'ᴡ': 'w', 'ʏ': 'y', 'ᴢ': 'z'}
_TIERS = r'(bronce|plata|oro|platino|diamante|esmeralda|rubi|maestro|leyenda|elite)'


def _rango_ev(s):
    """El rango del evento en SU servidor: «ʙʀᴏɴᴄᴇ ɪɪɪ 🥉» -> «Bronce III».

    🔑 Dlx, 25/09/2026: *«quizás poner el rango de esta misma… aplica solo
    para el servidor local, obviamente»*. Es el campo `RANGO` del anuncio.

    ⚠️ SÓLO SI ES UN RANGO: el campo es texto libre y trae «4», «rap»,
    «chill» o «diamante tunesino a lo galatasaray». Tiene que TERMINAR en
    un nivel (con su número o no); si no, no se muestra — mostrar
    «Diamante» de un chiste es peor que no mostrar nada.
    """
    import unicodedata
    t = ''.join(_VERSALITAS.get(c, c) for c in str(s or ''))
    t = unicodedata.normalize('NFKD', t)
    t = ''.join(c for c in t if not unicodedata.combining(c)).lower()
    t = re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]+', ' ', t)).strip()
    m = re.search(r'(?:^|\s)' + _TIERS + r'(?:\s+(iii|ii|iv|i|v|[1-5]))?$', t)
    if not m:
        return ''
    r = m.group(1).capitalize() + (' ' + m.group(2).upper() if m.group(2) else '')
    return r + (' · Ascenso' if 'ascenso' in t else '')


#: el nombre de cada dimensión del Score, como la explica `sheet/competitivo.py`
_DIM = {'E': ['⚡', 'Eficiencia', 'puntos por evento'],
        'C': ['🎯', 'Consistencia', 'qué tan seguido llegás a semifinal o más'],
        'Dm': ['👑', 'Dominancia', 'eventos ganados'],
        'T': ['🔥', 'Racha', 'eventos seguidos en semifinal o más'],
        # ⚠️ DÓNDE SUMÁS, no en cuántos jugás: la Diversidad reparte los
        # PUNTOS por servidor (rework A4). Dlx, 25/09/2026, al leer «en
        # cuántos servidores competís»: «asegurate que eso de la diversidad
        # del rework aplique». Aplicaba; el que estaba mal era este texto.
        'V': ['🌍', 'Diversidad', 'dónde sumás tus puntos: repartidos entre servidores vale más']}
#: el orden de los componentes del OVR, como los recibe `sheet/ovr.calcular()`
_OVR_COMP = ['Puntos', 'Eventos', 'Win%', 'Podios', 'Most Wanted']
#: cómo se escribe cada puesto de `Config` en la página
_PUESTO = {'campeon': 'Campeón', 'subcampeon': 'Subcampeón', 'tercero': 'Tercero',
           'cuarto': 'Cuarto', 'semifinal': 'Semifinal', 'cuartos': 'Cuartos',
           'octavos': 'Octavos', 'r32': 'Dieciseisavos'}


def _guia():
    """Los números de la Guía, de los mismos lugares que los calculan.

    ⚠️ LA TABLA DE PUNTOS VIVE EN `Config` del Operativo y se lee en vivo;
    si no se puede (sin red, sin credenciales), sale de la última copia en
    `datos/escala.json`, que esta misma función refresca cuando lee bien.
    """
    out = {}
    try:
        sys.path.append(os.path.join(BASE, 'sheet'))
        import ovr as _O
        import competitivo as _C
        out['ovr'] = [[n, int(round(w * 100))] for n, w in zip(_OVR_COMP, _O.PESOS)]
        out['score'] = [_DIM[k] + [int(round(w * 100))] for k, w in _C.PESOS if k in _DIM]
        out['conf'] = [[1, int(round(_C.confianza(1) * 100))],
                       [_C.CONF_DESDE[0], int(round(_C.CONF_DESDE[1] * 100))],
                       [_C.CONF_HASTA[0], int(round(_C.CONF_HASTA[1] * 100))]]
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ la guía sin pesos (%s)' % str(e)[:60])
    esc = _json('datos', 'escala.json') or {}
    if not _SIN_RED[0]:
        try:
            import motor as _M
            t, mods = _M.tablas(), _M.modificadores()
            nueva = {'tablas': {e: [[_PUESTO.get(k, k), v] for k, v in
                                    sorted(t[e].items(), key=lambda kv: -kv[1])]
                                for e in ('16+', '8-15', '4-7') if t.get(e)},
                     'walkin': [[int(k), int(round(v * 100))] for k, v in
                                sorted(mods.get('walkin', {}).items()) if int(k) > 0],
                     'revivido': int(round(mods.get('revivido', 0.5) * 100))}
            if nueva['tablas'] and nueva != {k: esc.get(k) for k in nueva}:
                io.open(os.path.join(BASE, 'datos', 'escala.json'), 'w', encoding='utf-8',
                        newline='\n').write(json.dumps(dict(nueva, _leeme=(
                            'Copia de Config (Operativo): cuántos puntos da cada puesto '
                            'por tamaño de llave. La refresca bot/subir_web.py cuando lee '
                            'la hoja; es el respaldo de la Guía de la web.')),
                            ensure_ascii=False, indent=1) + '\n')
                esc = nueva
        except Exception as e:                           # noqa: BLE001
            print('   ⚠️ los puntos de Config, de la copia (%s)' % str(e)[:60])
    if esc.get('tablas'):
        out['puntos'] = {k: esc[k] for k in ('tablas', 'walkin', 'revivido') if k in esc}
    return out


def _ultimos():
    """`{nombre normalizado: [fecha, puesto]}` del último evento de cada uno.

    Sale de las llaves procesadas, en el orden en que se jugaron (la hora
    de la llave). Es el `Último Resultado` del ranking oficial.
    """
    try:
        sys.path.append(os.path.join(BASE, 'sheet'))
        import llaves_web as LW
        from comun import respaldo as _resp
    except Exception:                                    # noqa: BLE001
        return {}
    regs = LW.leer()
    inst = LW.instantes(regs)
    out = {}
    for n in sorted((n for n in regs if str(n).isdigit()),
                    key=lambda n: LW.orden(inst.get(int(n)), regs[n].get('fecha'), int(n))):
        for t in regs[n].get('tabla') or []:
            if t and t[0]:
                # ⚠️ EL DÍA ENTERO, no «24/09»: la temporada puede cruzar de
                # año, y «01/01» ordenado como texto quedaría antes que «24/09»
                v = [regs[n].get('dia') or '', t[1] or '']
                out[_resp._norm(t[0])] = v
                # y por bandera: `Volk` 🇲🇽 y `volk` 🇨🇴 normalizan igual
                for cc in _banderas(t[0]):
                    out[_resp._norm(t[0]) + '|' + cc] = v
    return out


def _youtube(canal, tope=3):
    """Los últimos videos de un canal, por su RSS público: sin clave ni cuota."""
    if _SIN_RED[0] or not canal:
        return []
    try:
        import requests
        import xml.etree.ElementTree as ET
        r = requests.get('https://www.youtube.com/feeds/videos.xml',
                         params={'channel_id': canal}, timeout=20)
        if r.status_code != 200:
            return []
        ns = {'a': 'http://www.w3.org/2005/Atom', 'yt': 'http://www.youtube.com/xml/schemas/2015'}
        raiz = ET.fromstring(r.content)
    except Exception:                                    # noqa: BLE001
        return []
    out = []
    canal_nombre = (raiz.findtext('a:title', default='', namespaces=ns) or '')[:60]
    for e in raiz.findall('a:entry', ns)[:tope]:
        vid = e.findtext('yt:videoId', default='', namespaces=ns)
        t = (e.findtext('a:published', default='', namespaces=ns) or '')[:19]
        if vid and t:
            out.append({'t': t + 'Z', 'tipo': 'youtube', 'tit': (e.findtext('a:title', default='',
                        namespaces=ns) or '')[:120], 'vid': vid, 'canal': canal_nombre,
                        'link': 'https://www.youtube.com/watch?v=' + vid})
    return out


def _feed(tope=9):
    """Las redes de la Liga: los últimos videos de YouTube de cada servidor.

    🔑 Dlx, 25/09/2026: *«abajo de la Liga hoy irían los posts más recientes
    de las redes sociales, con flechas para ir a la siguiente página»*.

    ⚠️ YOUTUBE SÍ, INSTAGRAM Y TIKTOK NO: YouTube publica un RSS abierto por
    canal; Instagram y TikTok piden una app aprobada y un token por cuenta.
    De esos dos van los links, en «Seguí a la Liga».
    """
    svs = ((_json('datos', 'servidores.json') or {}).get('servidores') or {})
    out = []
    for sv, x in svs.items():
        if x.get('confirmado') and x.get('youtube_id'):
            for v in _youtube(x['youtube_id']):
                out.append(dict(v, sv=sv, de=x.get('nombre') or sv))
    out.sort(key=lambda x: x['t'], reverse=True)
    return out[:tope]


def _ics_texto(s):
    return (str(s or '').replace('\\', '\\\\').replace(';', '\\;').replace(',', '\\,')
            .replace('\n', '\\n'))


def _ics(cal):
    """El calendario de la Liga en iCalendar, para Google, Apple y Outlook.

    🔑 Dlx, 25/09/2026: *«la opción de sincronizar esto con el calendario de
    Google»*. El Worker lo sirve tal cual (`/calendario.ics`), sin armarlo:
    cero CPU por pedido.

    ⚠️ SIN HORA DE ESCRITURA QUE CAMBIE: `DTSTAMP` es el arranque del
    evento, así el archivo sólo cambia cuando cambian los eventos y no gasta
    una escritura de KV por corrida.
    """
    def fold(l):
        b = l.encode('utf-8')
        if len(b) <= 74:
            return l
        partes, act = [], ''
        for ch in l:
            if len((act + ch).encode('utf-8')) > 73:
                partes.append(act)
                act = ch
            else:
                act += ch
        partes.append(act)
        return '\r\n '.join(partes)
    ls = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Liga Global de Freestyle//Eventos//ES',
          'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Liga Global de Freestyle',
          'X-WR-CALDESC:Los eventos de la Liga Global: underlegends.pages.dev',
          'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H']
    import datetime as dt
    for c in cal or []:
        try:
            t = dt.datetime.strptime(c['t'][:19], '%Y-%m-%dT%H:%M:%S')
        except (KeyError, ValueError):
            continue
        ini = t.strftime('%Y%m%dT%H%M%SZ')
        fin = (t + dt.timedelta(minutes=90)).strftime('%Y%m%dT%H%M%SZ')
        uid = 'ev-%s-%s-%s@underlegends.pages.dev' % (c.get('sv') or 'x', ini, __import__('hashlib').md5((c.get('n') or '').encode('utf-8')).hexdigest()[:6])
        ls += ['BEGIN:VEVENT', 'UID:' + uid, 'DTSTAMP:' + ini, 'DTSTART:' + ini, 'DTEND:' + fin,
               fold('SUMMARY:' + _ics_texto('%s · %s' % (c.get('n') or 'Evento', c.get('sv') or ''))),
               fold('DESCRIPTION:' + _ics_texto('Evento de la Liga Global de Freestyle. ' +
                                                (c.get('link') or ''))),
               fold('URL:' + (c.get('link') or 'https://underlegends.pages.dev/#/eventos')),
               'END:VEVENT']
    ls.append('END:VCALENDAR')
    return '\r\n'.join(ls) + '\r\n'


def _subir_crudo(clave, texto, tipo='text/plain'):
    """Un texto tal cual a KV, sólo si cambió. `True`, `None` (igual) o `False`."""
    import requests
    import subir_datos as SD
    tok = _token()
    if not tok:
        return False
    try:
        r = requests.get('%s/values/%s' % (SD.API, clave),
                         headers={'Authorization': 'Bearer ' + tok}, timeout=45)
        if r.status_code == 200 and r.content.decode('utf-8') == texto:
            return None
    except (ValueError, OSError):
        pass
    r = requests.put('%s/values/%s' % (SD.API, clave), headers={'Authorization': 'Bearer ' + tok},
                     files={'value': (None, texto), 'metadata': (None, '{}')}, timeout=60)
    return r.status_code == 200


def _redes():
    """Las redes de la Liga: las de Under Legends, que son las de DRA."""
    sv = ((_json('datos', 'servidores.json') or {}).get('servidores') or {})
    return (sv.get('DRA') or {}).get('redes') or []


def _hoy_este():
    import datetime as dt
    try:
        from zoneinfo import ZoneInfo
        return dt.datetime.now(ZoneInfo('America/New_York')).date()
    except Exception:                                    # noqa: BLE001
        return dt.datetime.utcnow().date()


def _con_redes(perf):
    """Suma a cada perfil las redes que esa persona eligió mostrar.

    🔑 Las guarda el Worker en `redes:<clave>` cuando la persona toca
    «Guardar» en «Mis redes» (ver `cuentaRedes()` en `bot/worker.js`). Acá
    sólo se leen —`keys` con prefijo y `bulk/get`, dos pedidos— y viajan
    dentro de `web:perfiles`, que ya se escribe sólo si cambió.

    ⚠️ SI KV NO CONTESTA, LOS PERFILES SALEN SIN REDES Y NO SIN PERFIL: es
    un agregado, no puede tumbar lo demás.
    """
    ps = (perf or {}).get('p') or {}
    if not ps or _SIN_RED[0]:
        return 0
    try:
        import requests
        import subir_datos as SD
        tok = _token()
        if not tok:
            return 0
        s = requests.Session()
        s.headers['Authorization'] = 'Bearer ' + tok
        r = s.get('%s/keys' % SD.API, params={'prefix': 'redes:', 'limit': 1000}, timeout=30).json()
        ks = [k['name'] for k in (r.get('result') or [])]
        n = 0
        for i in range(0, len(ks), 100):
            v = (s.post('%s/bulk/get' % SD.API, json={'keys': ks[i:i + 100]}, timeout=30)
                 .json().get('result') or {}).get('values') or {}
            for k, x in v.items():
                cl = k[len('redes:'):]
                x = x.get('value') if isinstance(x, dict) else x
                try:
                    rs = json.loads(x) if isinstance(x, str) else x
                except ValueError:
                    continue
                if cl in ps and isinstance(rs, list) and rs:
                    ps[cl]['redes'] = [[r.get('t'), r.get('u'), r.get('n')] for r in rs
                                       if isinstance(r, dict) and r.get('t') and r.get('u')][:8]
                    n += 1
        if n:
            print('   🔗 redes en %d perfil(es)' % n)
        return n
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ sin redes en los perfiles (%s)' % str(e)[:60])
        return 0


def _comunidad():
    """Personas en los servidores, en la Lista, con Discord y verificadas.

    🔑 Dlx, 25/09/2026: *«¿cuántas personas diferentes tenemos, y con ID y
    verificadas? Quizás ese dato podríamos agregarlo a La Liga hoy»*. La
    primera sale de `datos/comunidad.json` (1b); las otras tres se cuentan
    acá, con el padrón que el paso 2 acaba de rehacer.

    ⚠️ VERIFICADAS ES EL PORTÓN, NO EL ROL: `verificados.pasa()` —ID, el
    Miembro de DRA y país—, o sea quien tiene tarjeta. El Miembro solo
    son miles más.

    ⚠️ SIN DATO NO HAY PIEZA: lo que no se pudo contar no viaja.
    """
    out = {}
    c = _json('datos', 'comunidad.json') or {}
    if c.get('personas'):
        out['personas'] = int(c['personas'])
        out['servidores'] = len(c.get('servidores') or [])
    try:
        _sh = os.path.join(BASE, 'sheet')
        if _sh not in sys.path:
            sys.path.append(_sh)
        import construir_padron as _PAD
        import verificados as _VER
        pad = _PAD.cargar()
        out['lista'] = len(pad)
        out['con_id'] = sum(1 for p in pad if str(p.get('discord_id') or '').strip())
        verif, _ = _VER.cargar()
        if verif:
            out['verificados'] = sum(1 for p in pad if _VER.pasa(p, verif))
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ no pude contar la comunidad (%s)' % str(e)[:60])
    return {k: v for k, v in out.items() if v} or None


def _actividad(regs, dias=14):
    """Cuánto se jugó: eventos por día y por servidor, y la última semana.

    🔑 Dlx, 25/09/2026: *«quizás podamos medir la actividad también»*. Sale
    de las llaves procesadas (`datos/llaves_t1.json`), que traen el día en
    hora del este, el servidor, la gente y los que sumaron puntos.

    ⚠️ LA SEMANA ANTERIOR VIAJA APARTE (`ant`) para que la página pueda
    decir si sube o baja; con la temporada recién arrancada es 0, y ahí la
    página no compara.
    """
    import datetime as dt
    hoy = _hoy_este()
    por, sem, ant, part, gente = {}, 0, 0, 0, set()
    from comun import respaldo as _resp
    for r in (regs or {}).values():
        try:
            dia = dt.date.fromisoformat(r.get('dia') or '')
        except ValueError:
            continue
        hace = (hoy - dia).days
        if 0 <= hace < dias:
            x = por.setdefault(dia.isoformat(), {})
            x[r.get('sv') or '?'] = x.get(r.get('sv') or '?', 0) + 1
        if 0 <= hace < 7:
            sem += 1
            part += int(r.get('participantes') or 0)
            gente |= {_resp._norm(t[0]) for t in r.get('tabla') or [] if t and t[0]}
        elif 7 <= hace < 14:
            ant += 1
    lista = [(hoy - dt.timedelta(days=i)).isoformat() for i in range(dias - 1, -1, -1)]
    return {'dias': [[d, por.get(d, {})] for d in lista], 'ev': sem, 'ant': ant,
            'part': part, 'gente': len(gente)}


def _duelos_de(regs, LW):
    """Los 1v1 de las llaves, del más viejo al más nuevo: `[(num, a, b, ganador)]`.

    ⚠️ SÓLO DOS LADOS DE UNA PERSONA: la regla de Dlx (21/09, reconfirmada el
    24/09) es que los triples, las de cuatro y las de equipos no son duelos.
    """
    inst = LW.instantes(regs)
    orden = sorted((n for n in regs if str(n).isdigit()),
                   key=lambda n: LW.orden(inst.get(int(n)), regs[n].get('fecha'), int(n)))
    out = []
    for n in orden:
        for R in regs[n].get('rondas') or []:
            for b in R.get('b') or []:
                lados = b[0] if b else []
                if len(lados) == 2 and not any(',' in (x or '') for x in lados):
                    out.append((int(n), lados[0], lados[1], b[1] if len(b) > 1 else ''))
    return out


def _mil(n):
    return '{:,}'.format(int(n)).replace(',', '.')


def _perfiles(gente, comp, regs):
    """Lo que la página de cada rapero necesita y el lobby no trae.

    🔑 Dlx, 25/09/2026: *«ESTARÍA BUENÍSIMO»*, al perfil de cada uno. Es lo
    que más le faltaba al hub contra la página vieja del Apps Script: su
    historial, sus duelos, su racha, su puesto en cada ranking y qué le
    falta para cada tarjeta.

    ⚠️ TODO SALE DE LO QUE YA ESTÁ EN `datos/`: los eventos y los duelos de
    las llaves procesadas, los requisitos de `comun/requisitos.py` —el
    mismo lugar que decide la Bloqueada— y la crew de `comun/crews.py`, no
    del pool, que la trae vieja.
    """
    import datetime as dt
    from comun import respaldo as _resp
    try:
        sys.path.append(os.path.join(BASE, 'sheet'))
        import llaves_web as LW
    except Exception:                                    # noqa: BLE001
        return {}
    try:
        from comun.crews import puestos as _puestos, norm as _crew_norm
        crews = _puestos(comp)
    except Exception:                                    # noqa: BLE001
        crews, _crew_norm = {}, (lambda s: s)
    norm = _resp._norm
    # 🔴 POR CLAVE Y NO POR NOMBRE NORMALIZADO: `Volk` y `volk` normalizan
    # igual y se juntaban en un solo perfil. Ver `_choques()`.
    por = {_clave(p): p for p in gente if p.get('raw')}
    comp_raw = {x.get('raw'): x for x in comp if x.get('raw')}
    comp_de = {norm(x.get('raw')): x for x in comp if x.get('raw')}
    candidatos = defaultdict(list)
    for p in gente:
        if p.get('raw'):
            candidatos[norm(p['raw'])].append(((p.get('cc') or '').lower(), _clave(p)))

    def de(nombre):
        """El nombre de una llave -> la clave de la persona, o None."""
        c = candidatos.get(norm(nombre)) or []
        if len(c) == 1:
            return c[0][1]
        ccs = _banderas(nombre)
        m = [k for cc, k in c if cc in ccs]
        return m[0] if len(m) == 1 else None
    inst = LW.instantes(regs)
    orden = sorted((n for n in regs if str(n).isdigit()),
                   key=lambda n: LW.orden(inst.get(int(n)), regs[n].get('fecha'), int(n)),
                   reverse=True)
    e, evs = {}, defaultdict(list)
    for n in orden:
        r = regs[n]
        ms = inst.get(int(n))
        t = (dt.datetime.fromtimestamp(ms / 1000, dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
             if ms else '')
        e[n] = [r.get('nombre') or '', r.get('sv') or '', t, int(r.get('participantes') or 0),
                r.get('fecha') or '']
        for fila in r.get('tabla') or []:
            q = de(fila[0])
            if q in por:
                evs[q].append([int(n), fila[1], int(fila[2] or 0)])
    dus = defaultdict(list)
    for n, a, b, g in _duelos_de(regs, LW):
        for yo, otro in ((a, b), (b, a)):
            q = de(yo)
            if q in por:
                dus[q].append([n, otro, 1 if de(g) == q else 0])
    duel_ord = sorted([x for x in comp if x.get('duel_real') and (x.get('duel_t') or 0)],
                      key=lambda x: (-(x.get('duel_v') or 0), -(x.get('duel_t') or 0),
                                     x.get('raw') or ''))
    pos_du = {_clave(x): i + 1 for i, x in enumerate(duel_ord)}
    med = sorted([p for p in gente
                  if (p.get('oro') or 0) + (p.get('seg') or 0) + (p.get('ter') or 0)],
                 key=lambda p: (-(p.get('oro') or 0), -(p.get('seg') or 0),
                                -(p.get('ter') or 0), -(p.get('pts') or 0)))
    pos_pod = {_clave(p): i + 1 for i, p in enumerate(med)}
    por_cc = Counter((x.get('cc') or '').lower() for x in comp if x.get('cc'))
    out = {}
    for q, p in por.items():
        cp = comp_raw.get(p.get('raw')) or (comp_de.get(norm(p.get('raw')))
                                            if p.get('raw') not in _choques() else None) or {}
        fila = dict(cp)
        fila.update({k: v for k, v in p.items() if v not in (None, '')})
        req = {}
        for carta in ('temporada', 'competitivo', 'pais'):
            req[carta] = [[RQ.cuanto(fila, campo), meta, RQ.como_se_dice(carta, meta, None, i)]
                          for i, (meta, campo, _q) in enumerate(RQ.condiciones(carta))]
        rk = {}
        if pos_du.get(q):
            rk['du'] = [pos_du[q], len(duel_ord)]
        if pos_pod.get(q):
            rk['pod'] = [pos_pod[q], len(med)]
        # ⚠️ `pos_pais` ES TEXTO, «1/23»: el puesto y cuántos son. Es el mismo
        # número del círculo de la carta de País, así que no se recalcula.
        pp = str(cp.get('pos_pais') or '')
        cc = (p.get('cc') or '').lower()
        if cc and re.match(r'^\d+(/\d+)?$', pp) and not pp.startswith('0'):
            pos, _, tot = pp.partition('/')
            rk['pa'] = [int(pos), int(tot) if tot else por_cc.get(cc, 0)]
        # ⚠️ CON LA NORMA DE `comun/crews.py`, no con la de las fotos
        cr = crews.get(_crew_norm(p.get('raw') or ''))
        if cr:
            rk['cr'] = [cr[0], cr[1], cr[2]]
        # la racha de duelos: seguidos ganados, del más viejo al más nuevo
        act = mej = 0
        for _n, _o, gano in dus.get(q, []):
            act = act + 1 if gano else 0
            mej = max(mej, act)
        x = {'req': req}
        if evs.get(q):
            x['ev'] = evs[q]
        if dus.get(q):
            x['du'] = list(reversed(dus[q]))
            x['rd'] = [act, mej]
        if rk:
            x['rk'] = rk
        if cr:
            x['crew'] = cr[0]
        out[q] = x
    import time
    return {'sello': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'e': e, 'p': out}


def _calendario(ann, regs, llaves, LW, CU, ahora, info=None):
    """Los eventos de la temporada, para el calendario de «Eventos».

    🔑 Dlx, 25/09/2026: *«crear una sección de eventos, y ahí aparecerá en
    forma de calendario todos los eventos que pasaron, con un color
    diferente y respectivo al servidor, y los futuros»*.

    Dos fuentes, y un evento sale UNA vez: el anuncio (lo que viene y lo
    que pasó) y la llave procesada (lo que se jugó). Se juntan con
    `llaves_web.cruzar()`, el mismo cruce de «Lo que pasó»; la llave que
    no tiene anuncio —un servidor que no anuncia en un canal que leemos—
    sale sola.

    ⚠️ EL INSTANTE EN UTC CON SU `Z`, y el día lo pone el navegador: quien
    mira desde Madrid y quien mira desde Lima ven el evento en SU día.
    """
    from comun.temporada import INICIO
    desde = INICIO[:19]
    link = lambda x: ('https://discord.com/channels/%s/%s/%s'
                      % (x['guild_id'], x['canal_id'], x['msg_id'])
                      if x.get('guild_id') and x.get('canal_id') and x.get('msg_id')
                      else '')
    items = []
    for x in ann:
        pub = str(x.get('cuando') or '')[:19]
        if not pub or pub < desde:
            continue
        ini = CU.momento(x)
        items.append({'nombre': x.get('nombre') or '', 'sv': x.get('servidor') or '',
                      'cuando': ini or pub, 'sh': 0 if ini else 1,
                      'link': link(x), 'rg': _rango_ev(x.get('rango')),
                      'mod': (x.get('modalidad') or '')[:40],
                      'org': _org(x.get('organizador')),
                      'pre': (x.get('premios') or '')[:60]})
    LW.cruzar(items, regs)
    # 🔑 LA FICHA DE CADA LLAVE: formato, rango, quién organizó y el premio,
    # que están en el anuncio y no en la llave. Dlx, 25/09/2026: «mostrar el
    # formato de eventos… lo mostrabas en inicio: pandillas, 1v1, el rango».
    if info is not None:
        for i in items:
            if i.get('llave'):
                ficha = {k: i[k] for k in ('mod', 'rg', 'org', 'pre') if i.get(k)}
                if i.get('link'):
                    ficha['anuncio'] = i['link']
                if ficha:
                    info[str(i['llave'])] = ficha
    usadas = {str(i['llave']) for i in items if i.get('llave')}
    import datetime as _d
    for n, r in regs.items():
        if str(n) in usadas:
            continue
        ms = LW._primero(r.get('links'))
        if ms is None:
            continue
        items.append({'nombre': r.get('nombre') or '', 'sv': r.get('sv') or '',
                      'cuando': _d.datetime.fromtimestamp(ms / 1000, _d.timezone.utc)
                      .strftime('%Y-%m-%dT%H:%M:%S'),
                      'sh': 0, 'link': (r.get('links') or [''])[0], 'llave': int(n)})
    out = []
    for i in sorted(items, key=lambda i: i['cuando']):
        ll = str(i.get('llave') or '')
        out.append({'t': i['cuando'] + 'Z', 'n': _nom(i['nombre']), 'sv': i['sv'],
                    'link': i['link'],
                    # la llave, si viaja en el payload; si no, el link basta
                    'll': int(ll) if ll in llaves else 0,
                    'jugado': 1 if ll else 0,
                    'fut': 1 if i['cuando'] > ahora else 0,
                    'sh': i['sh'], **({'rg': i['rg']} if i.get('rg') else {}),
                    **({'mod': i['mod']} if i.get('mod') else {})})
    return out


_CHOQUES = {}


def _choques():
    """`{nombre exacto: clave}` para los nombres que chocan en minúsculas.

    🔴 DOS PERSONAS, UNA CLAVE. `Volk` 🇲🇽 y `volk` 🇨🇴 son dos raperos
    distintos —Dlx, 25/09/2026: *«sí, son diferentes; los dos son parte de
    ello»*, de Guardia Nacional— y en minúsculas son el mismo `volk`. La
    página les daba la misma clave: el segundo abría el perfil del primero,
    heredaba sus tarjetas y su último evento.

    ⚠️ SE QUEDA CON LA CLAVE QUIEN TIENE DISCORD ID, porque es el único que
    puede tener tarjetas y ésas viven en R2 bajo `volk/`. El otro pasa a
    `volk-co`. Si ninguno tiene ID, los dos llevan su país y ninguno muestra
    tarjetas: la de `volk/` no se sabe de cuál de los dos es.
    """
    if 'mapa' not in _CHOQUES:
        grupos = defaultdict(list)
        for p in _json('datos', 'temporada_pool.json') or []:
            if p.get('raw'):
                grupos[str(p['raw']).lower()].append(p)
        out = {}
        for k, ps in grupos.items():
            if len({p['raw'] for p in ps}) < 2:
                continue
            con_id = [p for p in ps if p.get('discord_id')]
            usados = set()
            for p in ps:
                if len(con_id) == 1 and p is con_id[0]:
                    continue
                base = '%s-%s' % (k, (p.get('cc') or '').lower() or 'x')
                c, j = base, 2
                while c in usados:
                    c, j = '%s%d' % (base, j), j + 1
                usados.add(c)
                out[p['raw']] = c
        _CHOQUES['mapa'] = out
    return _CHOQUES['mapa']


def _banderas(nombre):
    """«volk 🇨🇴» -> ['co']: las banderas escritas en un nombre de llave."""
    out, par = [], ''
    for ch in str(nombre or ''):
        c = ord(ch)
        if 0x1F1E6 <= c <= 0x1F1FF:
            par += chr(c - 0x1F1E6 + 97)
            if len(par) == 2:
                out.append(par)
                par = ''
        else:
            par = ''
    return out


def _clave(p):
    """La clave de esa persona en R2.

    ⚠️ ES EL NOMBRE EN MINUSCULAS, y eso hay que sacarlo del inventario,
    no inventarlo: `bot/subir_cartas.py` la construye así, y probarlo con
    `Makma/temporada.webp` da 404 mientras `makma/temporada.webp` da 200.

    ⚠️ SALVO QUE CHOQUE CON OTRA PERSONA: ver `_choques()`.
    """
    raw = str(p.get('raw') or '')
    return _choques().get(raw) or raw.lower()


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
        # 🌙 SÓLO SI CAMBIARON LOS DATOS, no el dibujo. Un cambio de código
        # —el naranja de Urban Freestyle— espera a la madrugada
        # (`que_cambio.cambios()`), y mientras tanto la carta de R2 dice los
        # mismos números que el ranking: marcarla «actualizándose» todo el
        # día sería la marca falsa que este docstring prohíbe.
        for quien, cs in QC.huellas().items():
            antes = sello.get(quien) or {}
            malas = {c for c, h in cs.items() if c in antes and antes[c] != h
                     and not QC.solo_dibujo(antes[c], h)}
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


#: ⚠️ el self-check lo apaga: arma el payload entero y no tiene que salir
#: a Discord para eso (en CI la red está, pero la prueba no es de la red)
_SIN_RED = [False]


def _guardar_iconos(miembros):
    """Deja en `datos/iconos_sv.json` el ícono de hoy de cada servidor.

    🔑 PARA LAS CARTAS, QUE LO TENÍAN ESCRITO A MANO. El hub ya trackeaba el
    logo de cada servidor desde su invitación (`_miembros()`), y las cartas
    seguían con un hash clavado en `comun/escudos.py`. Medido el 25/09/2026:
    los de **DRA, Snake Rap y TWR daban 404** —cambiaron de ícono— y sus
    cartas caían en la silueta blanca sin avisar. Dlx, ese día, sobre Urban
    Freestyle: *«usa el nuevo logo, detéctalo del mismo servidor»*.

    ⚠️ SÓLO SE ESCRIBE SI CAMBIÓ, y sin hora adentro: es un archivo del
    ciclo (`bot/ci/guardar.sh`) y cada reescritura sería un commit.

    ⚠️ SIN RED NO SE TOCA: un `{}` borraría los íconos buenos de ayer.
    """
    nuevos = {}
    for sv, d in (miembros or {}).items():
        url = (d or {}).get('icono') or ''
        # .../icons/<guild>/<hash>.webp?size=128 -> '<guild>/<hash>'
        partes = url.split('/icons/')[-1].split('?')[0].rsplit('.', 1)[0]
        if url and partes.count('/') == 1:
            nuevos[sv] = partes
    if not nuevos:
        return
    p = os.path.join(BASE, 'datos', 'iconos_sv.json')
    viejo = _json('datos', 'iconos_sv.json') or {}
    if viejo.get('iconos') == nuevos:
        return
    import collections
    d = collections.OrderedDict()
    d['_leeme'] = ('El ícono de hoy de cada servidor, «guild/hash» como lo sirve '
                   'el CDN de Discord. Lo escribe bot/subir_web.py desde la '
                   'invitación pública de cada uno; lo leen las cartas por '
                   'comun/escudos.py. No se edita a mano.')
    d['iconos'] = dict(sorted(nuevos.items()))
    with io.open(p, 'w', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps(d, ensure_ascii=False, indent=1) + '\n')
    print('   🖼  datos/iconos_sv.json: %s' % ', '.join(
        sv for sv in sorted(nuevos) if (viejo.get('iconos') or {}).get(sv) != nuevos[sv]))


def _miembros(svs):
    """`{sv: {'miembros': n, 'icono': url}}` desde la invitación pública.

    🔑 EL LOGO TAMBIÉN, DE LA MISMA RESPUESTA. Dlx, 25/09/2026: *«para los
    íconos de los servidores intentá trackear los logos actuales»*. La
    invitación trae el hash del ícono de hoy, así que el logo del hub es
    el que el servidor tiene puesto en Discord —si lo cambia, la corrida
    siguiente lo toma— sin bajar ni guardar nada.

    🔑 POR LA INVITACION Y NO POR EL BOT. `GET /invites/<código>?
    with_counts=true` contesta para cualquier servidor con invitación
    pública —el bot no está en seis de los nueve— y no pide token.
    Medido el 25/09/2026: los nueve contestan y el guild de cada
    invitación coincide con el de `servidores.json`.

    ⚠️ REDONDEADO, a propósito. El número exacto se mueve con cada
    persona que entra o sale, y un payload que cambia en cada corrida
    gasta una escritura de KV por corrida —de las 1.000 del día— para
    decir «7.334» en vez de «7.300». Con cientos arriba de mil y decenas
    abajo, cambia cuando cambia de verdad.

    ⚠️ SI NO HAY RED, NO HAY NUMERO: la página dibuja el servidor sin él.
    *Sin dato no hay pieza.*
    """
    if _SIN_RED[0]:
        return {}
    import requests
    out = {}
    for sv, x in svs.items():
        cod = (x.get('invitacion') or '').rstrip('/').split('/')[-1]
        if not cod:
            continue
        try:
            r = requests.get('https://discord.com/api/v10/invites/%s' % cod,
                             params={'with_counts': 'true'}, timeout=15)
            j = r.json() if r.status_code == 200 else {}
        except (OSError, ValueError):
            continue
        n = j.get('approximate_member_count')
        g = j.get('guild') or {}
        # la invitación tiene que llevar a ESE servidor: un link cambiado
        # a mano contaría la gente de otro
        if g.get('id') != x.get('guild_id'):
            continue
        d = {}
        if n:
            # 🔑 EXACTO. Dlx, 25/09/2026: «en el mundo poner números exactos».
            # Se redondeaba para no reescribir el lobby por cada persona que
            # entra o sale; cuesta ~1 escritura de KV por corrida con cambios,
            # dentro del presupuesto (ver `subir_datos.presupuesto()`).
            d['miembros'] = int(n)
        if g.get('icon'):
            d['icono'] = ('https://cdn.discordapp.com/icons/%s/%s.webp?size=128'
                          % (g['id'], g['icon']))
        if d:
            out[sv] = d
    return out


def _servidores(gente):
    """Los servidores confirmados de la Liga, con su gente en la T1.

    🔴 ERAN SOLO LOS QUE TENÍAN GENTE EN EL RANKING, y con la T1 entera en
    FFA la vista «Mundo» mostraba un solo servidor. Dlx, 25/09/2026:
    *«deberías agregar DRA, Snake Rap también, pero con sus nombres
    completos e incluso sus logos y cantidad de miembros»*. La Liga es
    justamente eso —*«unimos los rankings de los mejores servidores»*—,
    así que van los nueve de `datos/servidores.json`, con o sin raperos.

    ⚠️ LOS FILTROS DEL RANKING NO CAMBIAN: `pintaChips()` ya ofrece sólo
    los servidores con gente (`s.n`), así que no aparecen chips que no
    filtran nada.

    ⚠️ EL COLOR SALE DE `datos/colores_sv_marca.json`, que es donde ya
    vive — *«manda el logo»*, dice su propia nota. Escribir los nueve en
    el CSS de la página sería el mismo error que el rango en cinco
    lugares, con nueve en vez de ocho. Y el logo, de
    `bot/paginas/logos/` (lo arma `herramientas/logos_web.py`).
    """
    col = (_json('datos', 'colores_sv_marca.json') or {}).get('usar') or {}
    # 🔴 SOLO LOS CONFIRMADOS. Dlx, 25/09/2026, a los minutos de pedir los
    # nueve: *«los únicos servidores confirmados son Snake Rap, Discord Rap
    # y FFA... los demás no están confirmados todavía»*. La marca vive en
    # `datos/servidores.json` (`"confirmado": true`) y no acá: el día que se
    # confirme otro, se cambia ahí y la página lo toma sola.
    svs = {k: v for k, v in ((_json('datos', 'servidores.json') or {})
                             .get('servidores') or {}).items() if v.get('confirmado')}
    acc = {}
    for p in gente:
        sv = (p.get('sv') or '').upper()
        if not sv:
            continue
        a = acc.setdefault(sv, {'sv': sv, 'n': 0, 'pts': 0, 'ev': 0})
        a['n'] += 1
        a['pts'] += p.get('pts') or 0
        a['ev'] += p.get('ev') or 0
    miembros = _miembros(svs)
    _guardar_iconos(miembros)
    logos = os.path.join(SCR, 'paginas', 'logos')
    out = []
    for sv in list(svs) + [s for s in acc if s not in svs]:
        a = acc.get(sv) or {'sv': sv, 'n': 0, 'pts': 0, 'ev': 0}
        x = svs.get(sv) or {}
        a['color'] = col.get(sv, '#7E8B89')
        a['nombre'] = x.get('nombre') or sv
        a['invita'] = x.get('invitacion') or ''
        # 🔑 LA ETIQUETA Y LAS REDES. Dlx, 25/09/2026: «generar tags para los
        # servidores… FFA COMUNIDAD, Snake Rap TALENTOS, DRA ENTRENAMIENTO».
        if x.get('tag'):
            a['tag'] = x['tag']
        if x.get('redes'):
            a['redes'] = x['redes']
        # ⚠️ EL DE DISCORD PRIMERO y el guardado de respaldo: sin red, o si
        # el servidor saca su ícono, la página sigue teniendo uno.
        if (miembros.get(sv) or {}).get('icono'):
            a['logo'] = miembros[sv]['icono']
        elif os.path.exists(os.path.join(logos, sv.lower() + '.webp')):
            a['logo'] = 'logos/%s.webp' % sv.lower()
        if (miembros.get(sv) or {}).get('miembros'):
            a['miembros'] = miembros[sv]['miembros']
        out.append(a)
    # primero los que tienen gente en la T1, por puntos; después, por tamaño
    return sorted(out, key=lambda a: (-a['pts'], -a.get('miembros', 0), a['sv']))


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
    """Quién viene encadenando eventos AHORA: `racha_act` del pool.

    🔴 ERA LA MÁXIMA, y la sección dice «vienen encadenando»: alguien con
    una racha de 5 en la primera semana y cero desde entonces aparecía
    arriba de todo (auditoría del 25/09/2026). La máxima sigue en «Racha
    más larga», que es lo que ese récord dice.

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
            'r': p.get('racha_act') or 0, 'ev': p.get('ev') or 0}
           for p in gente
           if 0 < (p.get('racha_act') or 0) <= (p.get('ev') or 0)]
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

    🔑 PERO SE VEN TODAS LAS QUE TIENEN ALGUIEN EN LA TEMPORADA (`rk: 0`
    las de menos de 3). Dlx, 25/09/2026: *«agregar Knowledge Sombrío a las
    crews también»* — y con el umbral no aparecía nunca: de sus siete sólo
    Zignos juega la T1. El PUESTO sigue pidiendo 3 (el top 5 filtra por
    `rk`); lo que cambió es que la crew exista en la página.
    """
    try:
        from comun.crews import DE_CADA_UNO, norm
    except Exception:                                    # noqa: BLE001
        return []
    nombres = (_json('datos', 'crews.json') or {}).get('_nombres') or {}
    logos = os.path.join(SCR, 'paginas', 'logos', 'crews')
    pool = _json('datos', 'temporada_pool.json') or []
    acc = {}
    for p in pool:
        c = DE_CADA_UNO.get(norm(p.get('raw')))
        if not c:
            continue
        a = acc.setdefault(c, {'crew': nombres.get(c, c), 'clave': c, 'n': 0, 'pts': 0,
                               'mejor': '', 'mejor_pos': 10 ** 9, 'gente': []})
        a['n'] += 1
        a['pts'] += p.get('pts') or 0
        a['gente'].append(p.get('raw'))
        if (p.get('pos') or 10 ** 9) < a['mejor_pos']:
            a['mejor_pos'] = p.get('pos') or 10 ** 9
            a['mejor'] = p.get('raw')
    fuera = list(acc.values())
    for a in fuera:
        a.pop('mejor_pos', None)
        a['rk'] = 1 if a['n'] >= 3 else 0
        if os.path.exists(os.path.join(logos, a['clave'] + '.webp')):
            a['logo'] = 'logos/crews/%s.webp' % a['clave']
    return sorted(fuera, key=lambda a: (-a['rk'], -a['pts'], -a['n']))


def _records(gente, regs=None, comp=None):
    """Los números que sobresalen. Uno por categoría, o ninguno.

    🔑 MÁS FICHAS DESDE EL 25/09/2026. Dlx: *«agrega más cosas para las
    cosas randoms de abajo de OVR más alto, más puntos… agrega más de
    esos»*. Las de un evento —el mejor puntaje en una sola llave, la llave
    más grande, el día con más eventos— salen de las llaves procesadas.

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

    def top_de(f, minimo=1):
        con = [(f(p), p) for p in gente]
        con = [(v, p) for v, p in con if v >= minimo]
        if not con:
            return None
        v, p = max(con, key=lambda x: x[0])
        return {'n': p.get('raw'), 'k': _clave(p), 'cc': p.get('cc') or '', 'v': v}

    salida += [
        ('oro', 'Más títulos', top('oro')),
        ('fin', 'Más finales', top_de(lambda p: (p.get('oro') or 0) + (p.get('seg') or 0))),
        ('sem', 'Más semifinales', top('sem')),
        ('srv', 'Más servidores', top('srv', 2)),
    ]
    # los duelos ganados salen del pool competitivo, que es donde viven
    con = [x for x in (comp or {}).values() if x.get('duel_real') and (x.get('duel_v') or 0)]
    if con:
        x = max(con, key=lambda x: (x.get('duel_v') or 0, -(x.get('duel_t') or 0)))
        salida.append(('duv', 'Más duelos ganados',
                       {'n': x.get('raw'), 'k': _clave(x), 'cc': x.get('cc') or '',
                        'v': x.get('duel_v')}))
    regs = regs or {}
    # el mejor puntaje en UNA llave, la llave más grande y el día con más eventos
    mejor = None
    for r in regs.values():
        for t in r.get('tabla') or []:
            if t and int(t[2] or 0) and (mejor is None or int(t[2]) > mejor[0]):
                mejor = (int(t[2]), t[0], r.get('nombre') or '')
    if mejor:
        p = next((g for g in gente if g.get('raw') == mejor[1]), {})
        salida.append(('mev', 'Mejor evento',
                       {'n': mejor[1], 'k': _clave(p) if p else '', 'cc': p.get('cc') or '',
                        'v': _mil(mejor[0]), 'x': mejor[2]}))
    if regs:
        r = max(regs.values(), key=lambda r: int(r.get('participantes') or 0))
        if int(r.get('participantes') or 0):
            salida.append(('grande', 'Llave más grande',
                           {'n': r.get('nombre') or '', 'v': int(r['participantes']),
                            'x': 'raperos · ' + (r.get('sv') or '')}))
        dias = Counter(r.get('fecha') for r in regs.values() if r.get('fecha'))
        if dias:
            fe, cu = max(dias.items(), key=lambda x: x[1])
            if cu > 1:
                salida.append(('dia', 'Día más activo', {'n': fe, 'v': cu, 'x': 'eventos'}))
    # la racha de duelos: ganados seguidos, en el orden en que se jugaron
    try:
        sys.path.append(os.path.join(BASE, 'sheet'))
        import llaves_web as LW
        from comun import respaldo as _resp
        act, mej = defaultdict(int), defaultdict(int)
        for _n, a, b, g in _duelos_de(regs, LW):
            for yo in (a, b):
                q = _resp._norm(yo)
                act[q] = act[q] + 1 if _resp._norm(g) == q else 0
                mej[q] = max(mej[q], act[q])
        if mej:
            q = max(mej, key=lambda k: mej[k])
            if mej[q] >= 2:
                p = next((g for g in gente if _resp._norm(g.get('raw')) == q), None)
                if p:
                    salida.append(('rdu', 'Racha de duelos',
                                   {'n': p.get('raw'), 'k': _clave(p), 'cc': p.get('cc') or '',
                                    'v': mej[q], 'x': 'ganados seguidos'}))
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ sin racha de duelos (%s)' % str(e)[:60])
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
    return json.dumps({k: v for k, v in (p or {}).items()
                       if k not in ('sello', 'leido')},
                      ensure_ascii=False, sort_keys=True)


#: cada cuánto se reescribe el lobby aunque sólo haya cambiado `leido`
LEIDO_MAX_H = 2


def _leido_viejo(arriba, nuevo):
    """¿La hora de lectura que está arriba quedó más vieja que esto?

    🔴 `leido` CAMBIA EN CADA CORRIDA —es cuándo se leyeron los anuncios—,
    así que comparándolo el lobby se escribía en KV **todas las veces**,
    ~48 escrituras por día de una cuota de 1.000 para toda la cuenta
    (auditoría del 25/09/2026). Pero si nunca se escribe por él, la página
    dice «datos de hace 9 h» de algo que se leyó hace un minuto. El punto
    medio: se ignora, salvo que lo de arriba tenga más de dos horas.
    """
    import datetime as d
    try:
        a = d.datetime.fromisoformat(str((arriba or {}).get('leido'))[:19])
        b = d.datetime.fromisoformat(str((nuevo or {}).get('leido'))[:19])
    except ValueError:
        return bool((nuevo or {}).get('leido'))
    return (b - a).total_seconds() > LEIDO_MAX_H * 3600


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


def subir(payload, solo_si_cambio=False, clave=None):
    """Lo deja en KV. Devuelve `True` si salió, `None` si no hizo falta.

    ⚠️ CON `solo_si_cambio` ES UN DIFF-WRITER, igual que
    `subir_datos.py`. KV da **1.000 escrituras por día** y el ciclo corre
    cada hora: escribir siempre no lo rompe, pero tampoco sirve — y el
    día que el ciclo baje a cada diez minutos, este número importa.
    """
    import requests
    import subir_datos as SD

    clave = clave or CLAVE
    tok = _token()
    if not tok:
        return False
    if solo_si_cambio:
        try:
            r = requests.get('%s/values/%s' % (SD.API, clave),
                             headers={'Authorization': 'Bearer ' + tok},
                             timeout=45)
            # ⚠️ `r.content` EN UTF-8 y no `r.text`: KV no dice el charset
            # y requests lo adivina. Una adivinanza mala acá no rompe nada
            # visible —dice «cambió» y escribe— pero gasta una escritura
            # de las 1.000 del día en cada corrida.
            if r.status_code == 200:
                arriba = json.loads(r.content.decode('utf-8'))
                if _sin_sello(arriba) == _sin_sello(payload) and \
                        not _leido_viejo(arriba, payload):
                    return None
        except (ValueError, OSError):
            # ⚠️ SI NO SE PUEDE LEER, SE ESCRIBE. El error de este lado es
            # dejar la web vieja, no gastar una escritura de más.
            pass
    r = requests.put('%s/values/%s' % (SD.API, clave),
                     headers={'Authorization': 'Bearer ' + tok},
                     files={'value': (None, json.dumps(
                         payload, ensure_ascii=False, separators=(',', ':'))),
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

    _SIN_RED[0] = True
    p = armar()
    perf = p.pop('_perfiles', None) or {}
    ok(isinstance(p.get('tabla'), list), 'arma la tabla  (%d)'
       % len(p.get('tabla') or []))

    # 🔑 «VER LLAVES»: cada anuncio con `llave` tiene su llave en el
    # payload, y ninguna llave viaja sin un anuncio que la abra.
    _ll = p.get('llaves')
    _con = [x['llave'] for x in p.get('pasados') or [] if x.get('llave')]
    ok(isinstance(_ll, dict) and all(str(n) in _ll for n in _con),
       'las llaves de «Lo que pasó», una por anuncio  (%d)' % len(_con))
    ok(len(_ll) <= len(_con) + LLAVES_WEB,
       'y no más de %d aparte  (%d en total)' % (LLAVES_WEB, len(_ll)))
    ok(all(len(b) == 4 for L in _ll.values() for R in L['rondas'] for b in R['b']),
       'cada batalla trae de qué batallas viene (el árbol)')
    _cal = p.get('calendario') or []
    ok(all(re_iso(c['t'][:19]) and c['t'].endswith('Z') for c in _cal),
       'el calendario viaja con instantes UTC  (%d)' % len(_cal))
    ok([c['t'] for c in _cal] == sorted(c['t'] for c in _cal),
       'y en orden')
    ok(all(str(c['ll']) in _ll for c in _cal if c['ll']),
       'cada «ver llave» del calendario tiene su llave en el payload')
    ok(p.get('eventos') == len(__import__('llaves_web').leer()),
       'los eventos son los procesados, no las participaciones  (%s)' % p.get('eventos'))

    # 🔑 LOS NUEVE SERVIDORES, con o sin gente en la T1, y cada uno con su
    # nombre y su logo. Ver `_servidores()`.
    _svs = {k: v for k, v in ((_json('datos', 'servidores.json') or {})
                              .get('servidores') or {}).items() if v.get('confirmado')}
    _ps = {s['sv']: s for s in p.get('svs') or []}
    ok(set(_svs) <= set(_ps), 'están los %d servidores confirmados  (%d)'
       % (len(_svs), len(_ps)))
    _de_mas = [s for s in _ps if s not in _svs and not _ps[s].get('n')]
    ok(not _de_mas, 'y ninguno sin confirmar que no tenga gente en la T1  %s'
       % (_de_mas or '—'))
    ok(all(_ps[s].get('nombre') and _ps[s].get('invita') for s in _svs if s in _ps),
       'cada uno con su nombre y su invitación')
    _sin_logo = [s for s in _svs if s in _ps and not _ps[s].get('logo')]
    ok(not _sin_logo, 'y con su logo  %s' % (_sin_logo or '—'))
    ok(all('miembros' not in s for s in p['svs']),
       'sin red no hay cantidad de miembros (sin dato no hay pieza)')
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

    # 🔑 LOS PERFILES: uno por fila de la tabla, con sus requisitos
    ok(set(perf.get('p') or {}) == {f['k'] for f in p['tabla']},
       'un perfil por cada rapero de la tabla  (%d)' % len(perf.get('p') or {}))
    ok(all(len(x['req'].get('pais') or []) == 3 for x in (perf.get('p') or {}).values()),
       'y cada uno con las tres condiciones de País')
    _evs = {str(e[0]) for x in (perf.get('p') or {}).values() for e in x.get('ev') or []}
    ok(_evs <= set(perf.get('e') or {}), 'cada evento del historial tiene su nombre  (%d)'
       % len(_evs))
    ok('_perfiles' not in p, 'y no viajan en el lobby')
    ok(all('av' in f for f in p['tabla']) and not any(f['av'] for f in p['tabla']),
       'sin red nadie tiene avatar (la inicial)')
    ok(isinstance(p.get('actividad'), dict) and len(p['actividad'].get('dias') or []) == 14,
       'la actividad trae 14 días')
    ok(p.get('novedades') == [], 'sin red no hay novedades')
    ok(p.get('feed') == [], 'ni feed')
    _i = _ics([{'t': '2026-09-23T19:35:00Z', 'n': 'TOKYO; VOL, 11', 'sv': 'FFA', 'link': 'https://x'}])
    ok(_i.startswith('BEGIN:VCALENDAR\r\n') and 'DTSTART:20260923T193500Z' in _i and
       'TOKYO\\; VOL\\, 11' in _i and _i.endswith('END:VCALENDAR\r\n'),
       'el calendario .ics sale bien armado y escapado')
    ok(all(len(l.encode('utf-8')) <= 75 for l in _ics(p.get('calendario')).split('\r\n')),
       'y ningún renglón pasa de 75 bytes (la regla de iCalendar)')
    ok(all(len(f.get('rch') or []) == 2 for f in p['tabla']), 'cada fila trae su racha actual/máxima')
    _rs = {'ʙʀᴏɴᴄᴇ ɪɪɪ 🥉': 'Bronce III', 'BRONCE': 'Bronce', '4': '', 'chill': '',
           'diamante tunesino a lo galatasaray': '',
           'Competencia De Ascenso Rango ᴘʟᴀᴛᴀ ɪɪɪ': 'Plata III · Ascenso'}
    ok(all(_rango_ev(a) == b for a, b in _rs.items()),
       'el rango del evento: los niveles sí, el texto suelto no  %s'
       % [(a, _rango_ev(a)) for a, b in _rs.items() if _rango_ev(a) != b])
    _ks = [x['k'] for x in p['tabla']]
    ok(len(_ks) == len(set(_ks)), 'cada rapero de la tabla tiene su clave (%d repetidas)'
       % (len(_ks) - len(set(_ks))))
    _vk = sorted(x['k'] for x in p['tabla'] if x['n'].lower() == 'volk')
    ok(len(_vk) in (0, 2) and (not _vk or len(set(_vk)) == 2),
       'Volk y volk son dos: %s' % _vk)
    ok(_banderas('volk 🇨🇴') == ['co'] and _banderas('Snow') == [], 'las banderas de un nombre')
    _g = p.get('guia') or {}
    ok(len(_g.get('ovr') or []) == 5 and sum(w for _n, w in _g['ovr']) == 100,
       'la guía trae los cinco pesos del OVR, y suman 100')
    ok(len(_g.get('score') or []) == 5 and sum(x[3] for x in _g['score']) == 100,
       'y las cinco dimensiones del Score, con nombre (ninguna quedó sin explicar)')
    ok(_limpio_md('# 🏆 HOLA <:CorazonLleno:152933862521543> @everyone\n▬▬▬\n**chau**')
       == ['🏆 HOLA', 'chau'], 'el texto de Discord sale sin su formato')
    ok(_org('@!    MMC.') == 'MMC.', 'y el organizador sin la arroba')
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
    perf = p.pop('_perfiles', None) or {}
    _con_redes(perf)
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
        print('\n   ✓ ya estaba igual arriba: no gasté una escritura')
    else:
        print('\n   %s' % ('✅ subido a KV como `%s`' % CLAVE if okk
                             else '🔴 no pude subirlo'))
    # 🔑 EL CALENDARIO PARA GOOGLE, tal cual: el Worker lo reenvía sin armarlo
    ok3 = _subir_crudo('web:ics', _ics(p.get('calendario')))
    print('   %s' % ('✓ calendario .ics: igual' if ok3 is None else
                     '✅ calendario .ics subido' if ok3 else '🔴 no pude subir el .ics'))
    # 🔑 LOS PERFILES, CON EL MISMO DIFF-WRITER: cambian cuando entra una
    # llave, no en cada corrida. Si fallan, el lobby ya está arriba.
    ok2 = None
    if perf.get('p'):
        ok2 = subir(perf, solo_si_cambio='--siempre' not in sys.argv, clave=CLAVE_PERFILES)
        print('   %s' % ('✓ perfiles: ya estaban iguales' if ok2 is None else
                         '✅ perfiles subidos (%d) a `%s`  %.1f KB'
                         % (len(perf['p']), CLAVE_PERFILES,
                            len(json.dumps(perf, ensure_ascii=False)) / 1024.0)
                         if ok2 else '🔴 no pude subir los perfiles'))
    print('')
    return 0 if okk is not False else 1


if __name__ == '__main__':
    raise SystemExit(main() or 0)
