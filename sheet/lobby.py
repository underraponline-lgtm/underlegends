# -*- coding: utf-8 -*-
"""EL LOBBY, CALCULADO. La portada del Oficial deja de envejecer.

    python sheet/lobby.py             dice qué pondría, sin escribir
    python sheet/lobby.py --aplicar   lo escribe
    python sheet/lobby.py --auto      el self-check

🔴 ES LA HOJA QUE MÁS SE VE Y LA QUE MÁS MIENTE. Medido el 23/09/2026,
con la T1 arrancada y dos eventos cargados, el Lobby decía:

    Total raperos        735      (el padrón tiene 876)
    Eventos procesados   348      (van 2 de la T1)
    Últimos campeones    #195     (vamos por el #350)
    TOP 3 Temporada      Bloody · Valen · MCO — de la pre-temporada

Todo pegado a mano. `docs/sheet_t1.md` lo tiene escrito: *«hoy se pegan
a mano, por eso `Axinu 🇨🇴 — 24 🥇` sigue diciendo eso aunque Axinu deje
de ser el que más campeonatos tiene»*.

⚠️ NO SE REHACE LA HOJA: SE RECALCULAN LAS CELDAS. El Lobby es un
tablero con su maqueta, y rehacerlo es una decisión de diseño que no
hace falta tomar para que deje de mentir. Lo que se toca son las celdas
que son **hechos**, una por una, y cada una se comprueba leyendo — la
misma disciplina que `escribir_vitrina()`, y por el mismo motivo: una
celda combinada se traga lo que le escribas sin devolver ningún error.

⚠️ LO QUE NO SE PUEDE CALCULAR SE PONE EN `—`, NO SE DEJA VIEJO. Las dos
filas de Most Wanted —«Más cazado» y «Mejor cazador»— no tienen fuente
en el repo, así que quedan con el hueco a la vista. Es la regla que la
carta de País ya aplica: *el agujero se ve, en vez de esconderse detrás
de un número plausible*.
"""
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

sys.path.insert(0, os.path.join(BASE, 'bot'))
# ⚠️ de `bot/`: convierte «EN 30 MINUTOS» en una hora. Ver su encabezado,
# que explica por que esto SI se puede derivar y `anuncios.py` decia que no.
import cuando as _CU  # noqa: E402

HOJA = 'Lobby'

#: Cuántos eventos hay que tener para entrar al «mejor Win%». Sin un
#: piso, un 1/1 gana con 100 % y la fila deja de decir nada — la misma
#: razón por la que el `Ranking Duelos` ordena por ganados.
MIN_EV_WR = 3


def _bandera(cc):
    """`ar` -> 🇦🇷. Vacío si no hay código."""
    cc = (cc or '').strip().lower()
    if len(cc) != 2 or not cc.isalpha():
        return ''
    return ''.join(chr(0x1F1E6 + ord(c) - ord('a')) for c in cc)


def _con_bandera(nombre, cc_de):
    b = _bandera(cc_de.get(nombre, ''))
    return '%s %s' % (nombre, b) if b else nombre


#: El huso de la planilla. `NOW()` contesta en ESTE huso, no en UTC.
#:
#: 🔴 Y LA PLANILLA ESTA EN `America/Los_Angeles`, medido el 23/09/2026.
#: Para una liga de Argentina, Chile, Colombia, España y México eso es
#: raro, pero **no se toca desde acá**: cambiarlo movería toda fecha que
#: alguien haya escrito a mano. Lo que sí hay que hacer es convertir la
#: hora del evento a este huso antes de compararla con `NOW()`, o la
#: cuenta atrás se equivoca en las horas de diferencia y **se ve
#: perfecta**: un número bien formado que termina cuando no es.
HUSO = 'America/Los_Angeles'

#: Cuánto dura el cartel «▶ EN VIVO» después de la hora de arranque, en
#: días de Sheets (una fracción: 3/24 son tres horas).
#:
#: ⚠️ TRES HORAS PORQUE UN EVENTO DURA UN RATO. Una llave de 16 con sus
#: rondas no termina en veinte minutos, así que apagar el cartel al
#: minuto uno diría que se acabó cuando recién empieza. Y más de tres
#: deja «en vivo» algo que ya cerró, que es el error de la otra punta.
VENTANA_DIAS = '3/24'


def _formula_cuenta(iso_utc, huso=None):
    """La fórmula de cuenta atrás para un instante UTC. `''` si no hay.

    🔴 UNA FORMULA Y NO UN TEXTO, y en eso está toda la gracia. Un texto
    lo escribe el ciclo **una vez por hora**: a los cincuenta minutos
    diría «faltan 55 min» cuando faltan 5. La fórmula la recalcula
    Sheets sola — ver `poner_recalculo()`, porque por defecto no lo
    hace.

    ⚠️ MINUTOS, NO SEGUNDOS, Y NO ES UN DESCUIDO. Dlx pidió *«cada
    segundo va restando»*, y **una celda de Sheets no puede**: el
    recálculo automático más rápido que existe es de un minuto. El
    segundero vive donde sí se puede, que es el Apps Script — ver
    `docs/appscript_oficial/`. Poner segundos acá daría un contador
    congelado que miente 59 de cada 60 segundos.
    """
    from datetime import datetime, timezone
    try:
        t = datetime.strptime(str(iso_utc)[:19], '%Y-%m-%dT%H:%M:%S')
    except (ValueError, TypeError):
        return ''
    # 🔴 EN WINDOWS `zoneinfo` NO TRAE LA BASE DE HUSOS, y esto se cayó
    # acá y habría andado en Actions. Python usa la del sistema, que
    # Windows no tiene: hace falta el paquete `tzdata` —está en
    # `requirements.txt` por esto—. Y el error **no es `ImportError`**
    # sino `ZoneInfoNotFoundError`, así que el `except ImportError` de
    # la primera versión lo dejaba pasar y tumbaba el Lobby entero.
    #
    # ⚠️ LA CUENTA ATRAS ES UN ADORNO Y EL LOBBY ES EL CONTENIDO: si el
    # huso no se puede resolver, se devuelve '' y la portada se escribe
    # igual. Lo que no puede pasar es que un contador deje la hoja sin
    # actualizar.
    try:
        from zoneinfo import ZoneInfo
        zona = ZoneInfo(huso or HUSO)
    except Exception:                                    # noqa: BLE001
        return ''
    loc = t.replace(tzinfo=timezone.utc).astimezone(zona)
    inst = 'DATE(%d,%d,%d)+TIME(%d,%d,%d)' % (loc.year, loc.month, loc.day,
                                              loc.hour, loc.minute, loc.second)
    # ⚠️ `[h]` Y NO `h`: con `h` a secas, 25 horas se muestran como 1.
    # Y las comillas van dobladas porque viven dentro de la cadena de la
    # fórmula.
    pat = '[h]"h" mm"m"'.replace('"', '""')
    # 🔴 TRES ESTADOS, Y EL TERCERO ES EL QUE HACE FALTA. La primera
    # versión tenía dos —falta esto / EN VIVO— y con los anuncios reales
    # **los tres salían «EN VIVO»**: el Lobby muestra los tres últimos
    # ANUNCIADOS, no los tres próximos, y los tres eran de ayer. Un
    # cartel de «en vivo» permanente sobre un evento que terminó hace
    # catorce horas es peor que no poner nada.
    #
    # ⚠️ Y EXPIRA SOLA, dentro de la fórmula. Podría filtrarse en Python
    # al escribir, pero entonces el cartel se apagaría **en la próxima
    # corrida del ciclo**, o sea hasta una hora tarde. Puesto en la
    # fórmula, la celda se vacía sin que nadie la toque — que es lo
    # mismo que se pide de la cuenta atrás.
    return ('=IFS(NOW()>=%s+%s,"",NOW()>=%s,"▶ EN VIVO",TRUE,'
            '"⏳ "&TEXT(%s-NOW(),"%s"))'
            % (inst, VENTANA_DIAS, inst, inst, pat))


MARCAS_INSC = {'abiertas': ' · 📝 inscripciones ABIERTAS',
               'cerradas': ' · 🔒 inscripciones cerradas'}


def marca_inscripciones(anuncio, ahora=None):
    """El texto de inscripciones de ese evento. `''` si no corresponde.

    🔴 NO VA EN UN EVENTO QUE YA ARRANCÓ. El estado es **por servidor**
    —`bot/anuncios.py` lo explica: lo que la gente quiere saber es
    «¿puedo anotarme?»— y se le cuelga a todos sus anuncios. Pegado a un
    evento que ya pasó dice «anotate» a algo que terminó.

    Medido el 23/09/2026 en el Lobby: los **tres** eventos de FFA
    mostraban «📝 inscripciones ABIERTAS» y los tres ya se habían
    corrido; uno era de ayer.

    ⚠️ SÓLO SE CALLA CUANDO SE SABE QUE ARRANCÓ. Si el anuncio no dice
    cuándo empieza, `momento()` devuelve `None` y la marca se muestra
    igual: **no saber la hora no es saber que pasó**. Es la misma regla
    que el resto de la cuenta atrás.
    """
    arranca = _CU.momento(anuncio)
    if arranca:
        ref = (ahora or _CU.ahora_utc()).strftime('%Y-%m-%dT%H:%M:%S')
        if arranca < ref:
            return ''
    return MARCAS_INSC.get(anuncio.get('inscripciones'), '')


def poner_recalculo(dry=True):
    """Pone la planilla en «recalcular cada minuto». `True` si cambió.

    🔴 SIN ESTO LA CUENTA ATRAS NO SE MUEVE, y la fórmula igual se ve
    bien. Medido el 23/09/2026: la planilla estaba en `ON_CHANGE`, o sea
    que `NOW()` sólo se recalcula cuando alguien **edita** algo. Un
    visitante que abre el Lobby y mira ve el número que quedó de la
    última edición — congelado, sin ninguna señal de que lo está.

    ⚠️ Es exactamente la forma de «una cache que mira los datos no ve el
    código»: la pieza que tenía que refrescar no se estaba ejecutando, y
    lo que se veía era plausible.
    """
    import rankings as RK
    r = RK._api('GET', RK.OFICIAL, '?fields=properties.autoRecalc')
    actual = (r or {}).get('properties', {}).get('autoRecalc')
    if actual == 'MINUTE':
        return False
    if dry:
        return True
    RK._api('POST', RK.OFICIAL, ':batchUpdate', json={'requests': [
        {'updateSpreadsheetProperties': {
            'properties': {'autoRecalc': 'MINUTE'},
            'fields': 'autoRecalc'}}]})
    return True


def datos():
    """Todo lo que el Lobby muestra. `({celda: valor}, {celda: formula})`.

    El segundo son las celdas que llevan **formula** y no texto: hoy la
    cuenta atras. Ver `_formula_cuenta()` y `escribir()`.
    """
    from escribir import Hoja
    import rankings as RK

    res = Hoja('Resultados').filas()
    uno = Hoja('1v1').filas()
    ag = RK.agregar(res, uno)
    # ⚠️ EL CODIGO ISO SALE DE `padron.seguro()`, NO DE
    # `datos/padron.json`. Ese archivo guarda `pais` con el **nombre**
    # —«Colombia»— y pedirle `cc` devuelve cadena vacia sin fallar: la
    # primera version salio con los TOP 3 sin una sola bandera. Es la
    # misma trampa que dejo el Ranking Mundial en cero paises.
    cc_de = {}
    padron = []
    try:
        with io.open(os.path.join(BASE, 'datos', 'padron.json'),
                     encoding='utf-8') as f:
            padron = json.load(f)
    except (OSError, ValueError):
        pass
    try:
        from padron import seguro
        for d in (seguro() or {}).values():
            if d.get('nombre'):
                cc_de[d['nombre']] = d.get('cc') or ''
    except Exception:                                    # noqa: BLE001
        pass

    # ── los tres contadores de arriba ──────────────────────────────
    evs = set()
    svs = set()
    for f in res:
        f = list(f) + [''] * 11
        if str(f[0]).strip():
            evs.add(str(f[0]).strip())
        if str(f[2]).strip():
            svs.add(str(f[2]).strip())
    # 🔴 EL SUBTITULO DECIA «Pre-Temporada 2026» CON LA T1 YA ARRANCADA.
    # Estaba pegado a mano en `A2` desde antes del reset del 22/09, o
    # sea que la primera línea que lee cualquiera que abre el Oficial
    # anunciaba una temporada que se borró a propósito. Ahora sale de
    # `comun/temporada.py`, que es el único lugar donde la temporada
    # vive — la misma regla que ya arregló el sello de las cuatro
    # cartas, que también decían PRE con la T1 empezada.
    try:
        from comun.temporada import SELLO
        titulo = 'Temporada %s' % SELLO
    except Exception:                                    # noqa: BLE001
        titulo = 'Liga Global'
    out = {
        'A2': '%s — Freestyle Rap en Español' % titulo,
        'K5': len(padron),
        'K6': len(evs),
        'K7': len(svs),
    }
    # ⚠️ LAS FORMULAS VAN APARTE DE LOS VALORES, y no es prolijidad: se
    # escriben con `USER_ENTERED` para que Sheets las interprete, y ese
    # modo **le cambia el tipo a todo lo demas**. `12/16` de los cupos
    # se volveria una fecha y `+5` un numero. Ver `escribir()`.
    fml = {}

    # ── TOP 3 de cada ranking ──────────────────────────────────────
    def top(clave, n=3):
        return sorted(ag.items(), key=lambda kv: -_num(kv[1].get(clave)))[:n]

    medalla = ('🥇', '🥈', '🥉')
    for i, (quien, v) in enumerate(top('Puntos')):
        out['I%d' % (9 + i)] = '%s %s' % (medalla[i], _con_bandera(quien, cc_de))
        out['K%d' % (9 + i)] = '%d ev' % _num(v.get('Ev'))
        out['L%d' % (9 + i)] = '{:,}'.format(_num(v.get('Puntos')))

    # el Competitivo sale de su pool, que es donde vive el Score
    comp = []
    try:
        with io.open(os.path.join(BASE, 'datos', 'competitivo_pool.json'),
                     encoding='utf-8') as f:
            comp = sorted(json.load(f), key=lambda x: -(x.get('score') or 0))
    except (OSError, ValueError):
        pass
    for i, x in enumerate(comp[:3]):
        out['I%d' % (13 + i)] = '%s %s' % (medalla[i],
                                           _con_bandera(x['raw'], cc_de))
        out['K%d' % (13 + i)] = '%d ev' % _num(x.get('ev'))
        out['L%d' % (13 + i)] = '%s pts' % x.get('score')

    # Podios: por puntos de podio, igual que `tabla_podios()`
    pod = sorted(((v.get('🥇', 0) * 5 + v.get('🥈', 0) * 3 + v.get('🥉', 0),
                   k, v) for k, v in ag.items()
                  if v.get('🥇') or v.get('🥈') or v.get('🥉')), reverse=True)
    for i, (_p, quien, v) in enumerate(pod[:3]):
        out['I%d' % (17 + i)] = '%s %s' % (medalla[i],
                                           _con_bandera(quien, cc_de))
        out['K%d' % (17 + i)] = '%d 🥈' % _num(v.get('🥈'))
        out['L%d' % (17 + i)] = '%d 🥇' % _num(v.get('🥇'))

    # ── las stats locas ────────────────────────────────────────────
    #
    # ⚠️ CADA UNA DICE DE DONDE SALE, y las dos que no salen de ningun
    # lado van con `—` en vez de quedarse con el nombre de la pre.
    def mejor(f, minimo=None):
        cands = [(f(v), k, v) for k, v in ag.items()]
        cands = [c for c in cands if c[0] is not None]
        if minimo is not None:
            cands = [c for c in cands if _num(ag[c[1]].get('Ev')) >= minimo]
        return max(cands) if cands else None

    filas = [
        (15, mejor(lambda v: _racha_max(v.get('🔥'))), '%d seguidas'),
        (16, mejor(lambda v: _num(v.get('🥈')) or None), '%d subcampeonatos'),
        (17, mejor(lambda v: _wr(v.get('Win%')), MIN_EV_WR), '%.1f%% (WR)'),
        (18, mejor(lambda v: _num(v.get('Ev')) or None), '%d eventos'),
    ]
    for fila, m, fmt in filas:
        if not m:
            out['D%d' % fila], out['E%d' % fila] = '—', '—'
            continue
        val, quien, _v = m
        out['D%d' % fila] = _con_bandera(quien, cc_de)
        out['E%d' % fila] = fmt % val

    # 19 · mejor debut: campeón en su primer evento
    deb = _debut(res)
    out['D19'], out['E19'] = ((_con_bandera(deb, cc_de), 'Campeón en su debut')
                              if deb else ('—', '—'))
    # 20 · guerrero sin podio: más eventos con cero podios
    sinp = mejor(lambda v: (_num(v.get('Ev'))
                            if not (v.get('🥇') or v.get('🥈') or v.get('🥉'))
                            else None))
    if sinp:
        out['D20'] = _con_bandera(sinp[1], cc_de)
        out['E20'] = '%d ev, 0 podios' % sinp[0]
    else:
        out['D20'], out['E20'] = '—', '—'
    # 🔴 21 y 23 SON MOST WANTED Y NO TIENEN FUENTE EN EL REPO. Se
    # ponen en `—`: dejarlas con «Bloody · 2 veces cazado» seria
    # sostener un dato de la pre-temporada en la portada.
    out['D21'], out['E21'] = '—', 'sin datos de Most Wanted'
    out['D23'], out['E23'] = '—', 'sin datos de Most Wanted'
    # 22 · servidor más activo
    porsv = {}
    for f in res:
        f = list(f) + [''] * 11
        sv, ev = str(f[2]).strip(), str(f[0]).strip()
        if sv and ev:
            porsv.setdefault(sv, set()).add(ev)
    if porsv:
        sv, es = max(porsv.items(), key=lambda kv: len(kv[1]))
        out['D22'], out['E22'] = sv, '%d evento(s)' % len(es)
    else:
        out['D22'], out['E22'] = '—', '—'
    # 24 · más campeonatos
    cam = mejor(lambda v: _num(v.get('🥇')) or None)
    if cam:
        out['D24'] = _con_bandera(cam[1], cc_de)
        out['E24'] = '%d título(s) en %d eventos' % (cam[0],
                                                     _num(ag[cam[1]].get('Ev')))
    else:
        out['D24'], out['E24'] = '—', '—'

    # ── raperos por país (I21:L25) ─────────────────────────────────
    #
    # ⚠️ SALE DEL PADRON, NO DE QUIEN COMPITIO. La caja se llama
    # «raperos por país» y eso es cuánta gente hay de cada uno, no
    # cuántos puntuaron esta temporada — para eso está el Mundial.
    por_pais = {}
    for x in padron:
        p = (x.get('pais') or '').strip()
        por_pais[p if p else '❓'] = por_pais.get(p if p else '❓', 0) + 1
    # ⚠️ EL MAPA NOMBRE→CODIGO YA EXISTE Y NO SE REHACE ACA.
    # `bot/bloqueadas.cc_de_pais()` lo arma —lo usa la Bloqueada para su
    # bandera, y `bot/cartas_nuevas.py` tambien—. `padron.seguro()` NO
    # sirve para esto: trae `cc` pero **no** el nombre del pais, asi que
    # el cruce daba vacio y la caja salia con «Argentina 204» en vez de
    # «🇦🇷 204».
    nombre_cc = {}
    try:
        sys.path.insert(0, os.path.join(BASE, 'bot'))
        from bloqueadas import cc_de_pais
        nombre_cc = cc_de_pais() or {}
    except Exception:                                    # noqa: BLE001
        pass
    orden = sorted(por_pais.items(), key=lambda kv: -kv[1])[:20]
    L = 'IJKL'
    for i, (p, n) in enumerate(orden):
        fila, col = 21 + i // 4, L[i % 4]
        if fila > 25:
            break
        eti = _bandera(nombre_cc.get(p, '')) or ('❓' if p == '❓' else p[:9])
        out['%s%d' % (col, fila)] = '%s %d' % (eti, n)
    # lo que sobra de la tabla vieja se vacía: 20 países entran y si hoy
    # hay menos, las celdas de abajo quedarían con los de la pre
    for i in range(len(orden), 20):
        fila, col = 21 + i // 4, L[i % 4]
        if fila <= 25:
            out['%s%d' % (col, fila)] = ''

    # ── últimos campeones (I32:K34) ────────────────────────────────
    #
    # 🔴 DECIA `#195` CON EL CONTADOR EN `#350`. Es lo más visible de la
    # portada y lo más fácil de calcular: los tres eventos de número más
    # alto y quién los ganó.
    camp = {}
    for f in res:
        f = list(f) + [''] * 11
        try:
            n = int(float(str(f[0]).strip() or 0))
        except ValueError:
            continue
        # 🔴 `'campe' in pos` AGARRA **SUBCAMPEON**. Es el mismo error
        # que `CLAUDE.md` documenta del regex de campeon —por eso lleva
        # `(?<!SUB)`— repetido en otro archivo. Medido: el #350 salia
        # con «Masino · Makma» cuando Makma fue subcampeon.
        if _es_campeon(f[6]):
            camp.setdefault(n, []).append(str(f[4]).strip())
    nombres_ev = _nombres_de_evento()
    for i, n in enumerate(sorted(camp, reverse=True)[:3]):
        quienes = camp[n]
        out['I%d' % (32 + i)] = '#%d' % n
        out['J%d' % (32 + i)] = nombres_ev.get(n, '')
        # ⚠️ PUEDE HABER VARIOS: un evento por equipos tiene tres
        # campeones. Se dicen todos; poner sólo el primero seria elegir
        # uno de los tres sin motivo.
        out['K%d' % (32 + i)] = '🏆 %s' % ' · '.join(quienes[:3])
    for i in range(len(camp), 3):
        for c in 'IJK':
            out['%s%d' % (c, 32 + i)] = ''

    # ── los eventos anunciados y los organizadores ─────────────────
    #
    # 🔴 ESTOS DOS BLOQUES NO TENIAN FUENTE HASTA HOY. Dlx, 23/09/2026:
    # *«necesitamos q el bot lea los canales donde se anuncian los
    # eventos y donde se anuncian que se abren las inscripciones»*. El
    # anuncio trae el **ORGANIZADOR** y los **CUPOS**, que la llave no
    # puede traer porque existe antes que el bracket. Ver
    # `bot/anuncios.py`.
    anun = {'anuncios': [], 'inscripciones': []}
    try:
        sys.path.insert(0, os.path.join(BASE, 'bot'))
        from anuncios import cargar as _car
        anun = _car()
    except Exception:                                    # noqa: BLE001
        pass

    # 📅 EVENTOS ACTIVOS: los tres anuncios más recientes.
    #
    # ⚠️ «EN VIVO · HOY · PRÓXIMO» NO SE PUEDE DECIDIR, y por eso no se
    # decide: el `HORARIO` del anuncio es texto libre —«EN 30 MINUTOS»,
    # «ahora», «22hs»— así que no hay con qué ordenar por tiempo real.
    # Se muestran los tres últimos **por fecha de publicación**, con su
    # horario tal cual lo escribieron. Inventar cuál está en vivo sería
    # poner un dato plausible donde hay una frase.
    # 🔴 Y LAS ETIQUETAS CAMBIAN, PORQUE AFIRMABAN LO QUE NO SE SABE.
    # Decían «EN VIVO · HOY · PRÓXIMO» y lo único con lo que puedo
    # ordenar es la **fecha de publicación** del anuncio. Poner el más
    # reciente bajo «EN VIVO» sería exactamente inventar el dato que el
    # `HORARIO` no da. Se muestra cuándo se anunció, que es cierto.
    ult = sorted(anun.get('anuncios') or [],
                 key=lambda a: a.get('cuando') or '', reverse=True)[:3]
    out['B4'] = '📅 ÚLTIMOS EVENTOS ANUNCIADOS'
    for i in range(3):
        if i < len(ult):
            a = ult[i]
            cup = (' · %s' % a['cupos_texto']) if a.get('cupos_texto') else ''
            # ⚠️ EL ESTADO DE LAS INSCRIPCIONES ES LO QUE LA GENTE
            # QUIERE SABER —«¿puedo anotarme?»— y sólo aparece si hay
            # una marca **de las últimas 24 h**. Ver `anuncios.py`: una
            # apertura de hace tres meses no dice nada de hoy.
            est = a.get('inscripciones')
            # 🔴 LA MARCA NO VA EN UN EVENTO QUE YA ARRANCÓ. El estado de
            # inscripciones es **por servidor** —`anuncios.py` lo explica:
            # lo que la gente quiere saber es «¿puedo anotarme?»— y se le
            # cuelga a todos sus anuncios. Pegada a un evento que ya pasó
            # dice «anotate» a algo que terminó.
            #
            # Medido el 23/09/2026 en el Lobby: los **tres** eventos de
            # FFA mostraban «📝 inscripciones ABIERTAS», y dos ya se
            # habían corrido. Uno era de ayer.
            #
            # ⚠️ SÓLO SE CALLA CUANDO SE SABE QUE ARRANCÓ. Si el anuncio
            # no dice cuándo empieza, `momento()` devuelve `None` y la
            # marca se muestra igual: no saber la hora no es saber que
            # pasó. Es la misma regla que el resto de la cuenta atrás.
            marca = marca_inscripciones(a)
            out['G%d' % (5 + i)] = (a.get('cuando') or '')[5:10].replace('-', '/')
            out['B%d' % (5 + i)] = '%s — %s%s%s' % (
                a['nombre'][:38], (a.get('horario') or 's/h')[:22], cup, marca)
            # ⏳ LA CUENTA ATRAS, en E5:F5 / E6:F6 / E7:F7.
            #
            # ⚠️ ESOS TRES SON MERGES Y SE ESCRIBE EN SU ANCLA. Una
            # combinada se traga lo que le escribís **sin devolver
            # ningún error** — es lo que se comió 31 celdas al rehacer
            # el Mundial. `E5` es la esquina de `E5:F5`, así que entra.
            fml[('E%d' % (5 + i))] = _formula_cuenta(_CU.momento(a))
        else:
            out['G%d' % (5 + i)] = ''
            out['B%d' % (5 + i)] = ''
            fml['E%d' % (5 + i)] = ''

    # 👑 TOP ORGANIZADORES (I27:L29), desde los anuncios
    import collections as _col
    orgs = _col.Counter(a['organizador'] for a in (anun.get('anuncios') or [])
                        if a.get('organizador'))
    L2 = 'IJKL'
    top12 = orgs.most_common(12)
    for i in range(12):
        fila, col = 27 + i // 4, L2[i % 4]
        if i < len(top12):
            q, n = top12[i]
            out['%s%d' % (col, fila)] = '%s %d' % (q.lstrip('@')[:14], n)
        else:
            out['%s%d' % (col, fila)] = ''
    if top12:
        out['I26'] = '👑 TOP ORGANIZADORES — de los anuncios'

    # ── los dos bloques sin fuente, etiquetados ────────────────────
    #
    # 🔴 NO ALCANZA CON DEJARLOS: SE LEEN COMO ACTUALES. «MOST WANTED —
    # Semana 4-5 (CERRADA)» y «TOP ORGANIZADORES» traen nombres de la
    # pre-temporada y **no tienen fuente en el repo** —quién organiza un
    # evento no se registra en ningún lado, y los puntos de MW viven en
    # una hoja que nadie lee—.
    #
    # ⚠️ Borrarlos perdería un dato que existió; dejarlos sin avisar los
    # presenta como los de esta temporada. Se etiquetan, que es la única
    # de las tres opciones que dice la verdad.
    out['B26'] = ('🎯 MOST WANTED — ⚠️ de la PRE-TEMPORADA · sin fuente '
                  'para recalcularlo')
    # ⚠️ SOLO SI NO HAY ANUNCIOS. Con anuncios, el bloque se llena de
    # verdad veinte líneas más arriba y esta etiqueta se pisa.
    if not (anun.get('anuncios') or []):
        out['I26'] = '👑 TOP ORGANIZADORES — ⚠️ de la PRE-TEMPORADA'

    # ── el pie (A40) ───────────────────────────────────────────────
    import time
    out['A40'] = ('📊 %d evento(s) · %d raperos · %s · '
                  'actualizado solo el %s'
                  % (len(evs), len(padron),
                     '%d servidor%s' % (len(svs), '' if len(svs) == 1 else 'es'),
                     __import__('datetime').datetime.now(__import__('zoneinfo').ZoneInfo('America/New_York')).strftime('%d/%m/%Y %I:%M %p ET')))
    return out, fml


def _nombres_de_evento():
    """`{numero: nombre}` desde `Eventos Procesados`."""
    try:
        from escribir import Hoja
        out = {}
        for f in Hoja('Eventos Procesados').filas():
            f = list(f) + [''] * 4
            n = str(f[0]).strip()
            if n.isdigit():
                out[int(n)] = str(f[1]).strip()
        return out
    except Exception:                                    # noqa: BLE001
        return {}


def _es_campeon(pos):
    """¿Esta posición es la de campeón? **No** la de subcampeón.

    🔴 `'campe' in pos` DA `True` PARA «Subcampeón», y ese es el error
    que `CLAUDE.md` ya tiene documentado del regex de campeón —lleva un
    `(?<!SUB)` justamente por esto—. Repetirlo acá costaba poner dos
    campeones en la portada.
    """
    import unicodedata
    s = unicodedata.normalize('NFD', str(pos or '').strip().lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return s == 'campeon'


def _num(x):
    try:
        return int(float(str(x).replace(',', '') or 0))
    except (TypeError, ValueError):
        return 0


def _wr(s):
    try:
        return float(str(s or '').replace('%', '')) or None
    except ValueError:
        return None


def _racha_max(s):
    """`3/5` -> 5. La racha máxima, que es la que la fila muestra."""
    try:
        return int(str(s or '').split('/')[-1]) or None
    except (ValueError, IndexError):
        return None


def _debut(res):
    """Quién fue campeón en su PRIMER evento. `None` si nadie.

    ⚠️ «Primer evento» es el de número más bajo de esa persona, no el
    más bajo de la tabla: alguien que entra en el #350 debuta ahí.
    """
    porp = {}
    for f in res:
        f = list(f) + [''] * 11
        quien = str(f[4]).strip()
        if not quien:
            continue
        try:
            n = int(float(str(f[0]).strip() or 0))
        except ValueError:
            continue
        pos = str(f[6]).strip()
        if quien not in porp or n < porp[quien][0]:
            porp[quien] = (n, pos)
    # ⚠️ Y ACA TAMBIEN: «Subcampeon» contiene «campe». Ver `_es_campeon()`.
    ganadores = [(n, q) for q, (n, pos) in porp.items() if _es_campeon(pos)]
    return max(ganadores)[1] if ganadores else None


def escribir(vals, dry=True, fml=None):
    """Escribe celda por celda y **comprueba leyendo**. `(puestas, malas)`

    `fml` son las celdas que llevan formula.

    🔴 VAN EN OTRA LLAMADA, CON `USER_ENTERED`, Y NO SE PUEDE UNIFICAR.
    `RAW` guarda `=IF(...)` como **texto**: la celda muestra la formula
    en vez de ejecutarla. Y al reves es peor — con `USER_ENTERED` para
    todo, el `12/16` de los cupos se vuelve una FECHA y el nombre que
    empieza con `+` un numero. Dos modos porque hay dos clases de celda.

    ⚠️ Y LAS FORMULAS NO SE VERIFICAN LEYENDO. Lo que vuelve de una
    celda con formula es su **resultado** —«⏳ 0h 29m»— y no la formula,
    asi que compararlo con lo que se mando marcaria un fallo siempre.
    Se verifica que la celda **tenga** algo, que es lo que se puede
    afirmar.
    """
    import rankings as RK
    if dry:
        return len(vals), []
    # 🔴 UNA SOLA LLAMADA, NO CINCUENTA. La cuota de escritura de Sheets
    # es de 60 por minuto: cincuenta `PUT` sueltos la rozan solos, y el
    # ciclo escribe en paralelo. `values:batchUpdate` manda todos los
    # rangos juntos — y de paso es atómico: no hay un estado intermedio
    # con media portada vieja y media nueva.
    RK._api('POST', RK.OFICIAL, '/values:batchUpdate', json={
        'valueInputOption': 'RAW',
        'data': [{'range': '%s!%s' % (HOJA, c), 'values': [[v]]}
                 for c, v in sorted(vals.items())]})
    if fml:
        RK._api('POST', RK.OFICIAL, '/values:batchUpdate', json={
            'valueInputOption': 'USER_ENTERED',
            'data': [{'range': '%s!%s' % (HOJA, c), 'values': [[v]]}
                     for c, v in sorted(fml.items())]})
    # 🔴 EL RANGO DE VERIFICACION SALE DE LO ESCRITO, y estaba clavado
    # en `A1:M30` mientras se escribia hasta la fila 40. Un verificador
    # que lee MENOS de lo que escribio reporta fallos falsos —dijo que
    # seis celdas «quedaron vacías» sin haberlas mirado— y, peor, puede
    # dar por buena una celda que nunca leyo.
    #
    # ⚠️ Es la misma regla que este repo ya tiene escrita tres veces con
    # otro traje: un número de fila describe el diseño, no el dato.
    leido = {}
    ultima = max(int(c[1:]) for c in vals) if vals else 1
    v = RK._leer(RK.OFICIAL, '%s!A1:M%d' % (HOJA, ultima))
    L = 'ABCDEFGHIJKLM'
    for i, f in enumerate(v, 1):
        for j, c in enumerate(f):
            leido['%s%d' % (L[j], i)] = str(c).strip()
    malas = [(c, vals[c], leido.get(c, ''))
             for c in vals if str(vals[c]).strip() != leido.get(c, '')]
    # 🔴 LA FORMULA SE VERIFICA CONTRA LA FORMULA, NO CONTRA SU
    # RESULTADO — y la primera versión se equivocó justo acá.
    #
    # Comparaba contra lo que la celda **muestra**, y dio «101 de 104
    # quedaron» con las tres bien puestas: los tres eventos eran de
    # ayer, así que la fórmula —que expira sola— evaluaba a cadena
    # vacía. El verificador llamaba fallo al comportamiento correcto.
    #
    # ⚠️ Y AL REVES ES PEOR: dar por buena una celda porque muestra algo
    # no dice que la fórmula esté ahí. Se pide `valueRenderOption=
    # FORMULA`, que devuelve el `=IFS(…)` tal cual — la única lectura
    # que contesta la pregunta que se está haciendo. Sigue cazando el
    # fallo que importa: una combinada que no es su ancla se traga la
    # escritura y vuelve vacía.
    if fml:
        import requests
        from escribir import token
        nums = sorted({int(c[1:]) for c in fml})
        rng = '%s!A%d:M%d' % (HOJA, nums[0], nums[-1])
        r = requests.get('https://sheets.googleapis.com/v4/spreadsheets'
                         '/%s/values/%s' % (RK.OFICIAL,
                                            requests.utils.quote(rng)),
                         params={'valueRenderOption': 'FORMULA'},
                         headers={'Authorization': 'Bearer ' + token()},
                         timeout=90)
        crudo = {}
        if r.status_code < 300:
            for i, f in enumerate(r.json().get('values', []), nums[0]):
                for j, c in enumerate(f):
                    if j < len(L):
                        crudo['%s%d' % (L[j], i)] = str(c).strip()
        for c, f in fml.items():
            if str(f).strip() != crudo.get(c, ''):
                malas.append((c, str(f)[:24], crudo.get(c, '')[:24]))
    return len(vals) + len(fml or {}) - len(malas), malas


def _self_check():
    print('\n  lobby.py — self-check\n')
    mal = 0
    casos = [('ar', '🇦🇷'), ('CO', '🇨🇴'), ('', ''), ('xxx', '')]
    d = [c for c, e in casos if _bandera(c) != e]
    mal += bool(d)
    print('   %s la bandera sale del código ISO%s'
          % ('✅' if not d else '🔴', '' if not d else '  %s' % d))

    ok = _racha_max('3/5') == 5 and _racha_max('0/0') is None
    mal += not ok
    print('   %s la racha que se muestra es la MÁXIMA   3/5 -> %s'
          % ('✅' if ok else '🔴', _racha_max('3/5')))

    # 🔴 EL DEBUT ES EL PRIMER EVENTO **DE ESA PERSONA**, no el primero
    # de la tabla: alguien que entra en el #350 debuta ahí.
    res = [
        [1, '', 'FFA', '16+', 'Ana', '', 'Cuartos', 0, '', 0, ''],
        [2, '', 'FFA', '16+', 'Ana', '', 'Campeón', 0, '', 0, ''],
        [2, '', 'FFA', '16+', 'Bea', '', 'Campeón', 0, '', 0, ''],
    ]
    ok = _debut(res) == 'Bea'
    mal += not ok
    print('   %s el debut es el primer evento DE ESA PERSONA   %s'
          % ('✅' if ok else '🔴', _debut(res)))

    # ⚠️ y sin nadie no inventa
    ok = _debut([]) is None
    mal += not ok
    print('   %s sin datos no inventa un debut' % ('✅' if ok else '🔴'))

    # ── la marca de inscripciones ────────────────────────────────────
    print('\n  la marca de inscripciones')
    import datetime as _dt
    ahora = _dt.datetime(2026, 9, 23, 12, 0, 0)
    futuro = {'inscripciones': 'abiertas', 'horario': 'EN 30 MINUTOS',
              'cuando': '2026-09-23T12:00:00'}
    pasado = {'inscripciones': 'abiertas', 'horario': 'EN 15',
              'cuando': '2026-09-21T05:23:14'}
    sin_hora = {'inscripciones': 'abiertas', 'horario': '',
                'cuando': '2026-09-21T05:23:14'}
    ok = 'ABIERTAS' in marca_inscripciones(futuro, ahora)
    mal += not ok
    print('   %s un evento que todavía no arrancó la muestra'
          % ('✅' if ok else '🔴'))
    # 🔴 el caso real: «EN 15» del 21/09 seguía diciendo «anotate»
    ok = marca_inscripciones(pasado, ahora) == ''
    mal += not ok
    print('   %s uno que ya arrancó, NO' % ('✅' if ok else '🔴'))
    # ⚠️ y no saber la hora no es saber que pasó
    ok = 'ABIERTAS' in marca_inscripciones(sin_hora, ahora)
    mal += not ok
    print('   %s y si no se sabe cuándo empieza, se muestra igual'
          % ('✅' if ok else '🔴'))
    ok = marca_inscripciones({'horario': 'EN 30 MINUTOS',
                              'cuando': '2026-09-23T12:00:00'}, ahora) == ''
    mal += not ok
    print('   %s sin marca del servidor no se inventa ninguna'
          % ('✅' if ok else '🔴'))

    # ── la cuenta atrás ──────────────────────────────────────────────
    print('\n  la cuenta atrás')
    f = _formula_cuenta('2026-09-23T02:00:41')
    ok = f.startswith('=') and 'NOW()' in f
    mal += not ok
    print('   %s es una FÓRMULA, no un texto (si no, la escribe el ciclo '
          'una vez por hora)' % ('✅' if ok else '🔴'))

    # 🔴 LOS TRES ESTADOS. Sin el de «ya pasó», los tres anuncios reales
    # —todos de ayer— salían con «▶ EN VIVO» permanente.
    ok = f.count('"') >= 6 and '▶ EN VIVO' in f and VENTANA_DIAS in f
    mal += not ok
    print('   %s tiene los tres estados: falta · en vivo · ya pasó'
          % ('✅' if ok else '🔴'))

    # ⚠️ EL HUSO SE APLICA. La planilla está en LA y el evento viene en
    # UTC: si no se convirtiera, la cuenta erraría por horas **y se
    # vería perfecta**.
    ok = 'TIME(19,0,41)' in f
    mal += not ok
    print('   %s 02:00 UTC se escribe como las 19:00 del huso de la hoja  %s'
          % ('✅' if ok else '🔴', 'DATE/TIME convertidos' if ok else f[:60]))

    ok = _formula_cuenta('') == '' and _formula_cuenta(None) == ''
    mal += not ok
    print('   %s sin hora no pone ninguna cuenta' % ('✅' if ok else '🔴'))
    ok = _formula_cuenta('mañana a las 8') == ''
    mal += not ok
    print('   %s ni con una fecha que no se entiende' % ('✅' if ok else '🔴'))

    # 🔴 Y LAS COMILLAS TIENEN QUE ESTAR DOBLADAS o Sheets rechaza la
    # fórmula entera y la celda queda en `#ERROR!`.
    ok = '""h""' in f
    mal += not ok
    print('   %s las comillas del formato van dobladas' % ('✅' if ok else '🔴'))

    # 🔴 EL WEBAPP LEE ESTA FORMULA CON UN REGEX, Y ESO ES UN CONTRATO
    # ENTRE DOS ARCHIVOS QUE NO SE IMPORTAN.
    #
    # `getProximos()` en `docs/appscript_oficial/WebApp.gs` saca el
    # instante de acá para la cuenta atrás de un segundo. Si alguien
    # cambia la forma de la fórmula —pone `DATEVALUE`, junta fecha y
    # hora, mete espacios— el webapp **deja de encontrar nada y no
    # falla**: devuelve `[]` y el contador simplemente no aparece. Es
    # la forma favorita de este proyecto, el silencio plausible.
    #
    # ⚠️ El regex de abajo es **el mismo** que está en el .gs. Si este
    # test se pone en rojo, hay que cambiar los dos.
    import re as _re
    rx = _re.compile(r'DATE\((\d+),(\d+),(\d+)\)\+TIME\((\d+),(\d+),(\d+)\)')
    m = rx.search(f)
    ok = bool(m) and m.groups() == ('2026', '9', '22', '19', '0', '41')
    mal += not ok
    print('   %s el regex de getProximos() (WebApp.gs) la encuentra   %s'
          % ('✅' if ok else '🔴', '·'.join(m.groups()) if m else 'NO MATCHEA'))

    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


def main():
    if '--auto' in sys.argv:
        return _self_check()
    aplicar = '--aplicar' in sys.argv
    print('\n══ EL LOBBY, CALCULADO ══\n')
    vals, fml = datos()
    for c in sorted(vals, key=lambda x: (int(x[1:]), x[0])):
        print('   %-5s %s' % (c, vals[c]))
    for c in sorted(fml, key=lambda x: (int(x[1:]), x[0])):
        if fml[c]:
            print('   %-5s ⏳ %s' % (c, fml[c][:70]))
    vivas = sum(1 for v in fml.values() if v)
    print('\n   %d celda(s) · %d cuenta(s) atrás' % (len(vals), vivas))
    if not vivas:
        # ⚠️ SE DICE POR QUE, porque «no hay» y «no funciona» se ven
        # igual. La cuenta sale de la hora del anuncio más su desfase:
        # sin anuncios con «EN 30» recientes, no hay nada que contar.
        print('      (ningún anuncio dice cuánto falta, o ya pasaron)')
    if not aplicar:
        print('\n   (simulacro: no escribí nada — corré con --aplicar)\n')
        return 0
    # 🔴 SIN ESTO LA CUENTA ATRAS NO CORRE. La planilla viene en
    # `ON_CHANGE`: `NOW()` sólo se mueve cuando alguien edita algo.
    try:
        if poner_recalculo(dry=False):
            print('\n   ✅ la planilla pasó a recalcular cada minuto')
    except Exception as e:                               # noqa: BLE001
        print('\n   ⚠️ no pude poner el recálculo: %s' % str(e)[:70])
    puestas, malas = escribir(vals, dry=False, fml=fml)
    print('\n   %d de %d quedaron' % (puestas, len(vals) + len(fml)))
    for c, mand, quedo in malas[:6]:
        print('      🔴 %s: mandé %r y quedó %r' % (c, str(mand)[:18], quedo[:18]))
    print('')
    return 1 if malas else 0


if __name__ == '__main__':
    raise SystemExit(main() or 0)
