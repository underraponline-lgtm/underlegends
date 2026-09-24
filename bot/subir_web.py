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
    # ⚠️ ORDENADO POR PUESTO Y NO POR PUNTOS. El `pos` ya lo calculó el
    # builder con sus desempates; reordenar acá sería una segunda regla
    # de orden que puede discrepar con la del Sheet.
    gente = sorted((p for p in pool if p.get('raw')),
                   key=lambda p: p.get('pos') or 9999)[:TOPE]

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
        'c': _cartas(p, r2),
    } for p in gente]

    _an = _json('datos', 'anuncios.json') or {}
    ann = _an.get('anuncios') or []
    prox = [{
        'nombre': x['nombre'],
        'sv': x.get('servidor') or '',
        # 🔑 EL INSTANTE, EN ISO UTC. El texto lo arma el navegador.
        'cuando': x['cuando'],
        'cupos': x.get('cupos') or '',
    } for x in CU.proximos(ann, cuantos=5, margen_min=VENTANA_VIVO)]

    return {
        'temporada': SELLO,
        'gente': len(pool),
        'tabla': tabla,
        'proximos': prox,
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


def _cartas(p, r2):
    """Las cartas que esta persona TIENE, de las cuatro. Nunca inventa.

    🔴 SE PREGUNTA AL INVENTARIO, no se arman las cuatro URLs y se deja
    que el navegador descubra cuáles no están. Con 54 personas eso serían
    hasta 216 pedidos que terminan en 404 y una imagen rota por cada uno
    — y una carta que no existe **no es un error**: País pide tres
    condiciones y hoy no la tiene nadie.
    """
    tiene = r2.get(_clave(p)) or {}
    return [c for c in CARTAS if c in tiene]


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
