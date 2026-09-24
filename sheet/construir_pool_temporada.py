"""
CONSTRUIR EL POOL DE TEMPORADA desde el Google Sheet
=====================================================

Lee la hoja "Ranking Temporada" y escribe `datos/temporada_pool.json`, que es
lo que consumen los generadores de la Temporada y de la Servidor.

    python3 sheet/construir_pool_temporada.py

Necesita `creds.json` en la raiz del proyecto. Ese archivo NO va al repo.

QUE HACE, ademas de leer
------------------------
- calcula el OVR de temporada con la formula acordada
- ordena, asigna puesto y rango de color
- deriva el servidor principal de cada rapero
- rescata los avatares conocidos de los JSON que ya existan

TRES TRAMPAS DEL SHEET, todas contempladas aca
----------------------------------------------
1. La columna `Sv` esta vacia en 134 de 138. El servidor se deriva de aquel
   donde el rapero tiene mas puntos, usando las 7 columnas por servidor.
2. La columna 🔥 guarda texto `actual/maxima`, no un numero. Leerla como
   numero hace desaparecer todos los TAG de racha.
3. Las banderas son emoji de dos "regional indicator". Hay que decodificarlas
   para sacar el codigo de pais.
"""
import json
import math
import os
import sys
import re

import gspread
from google.oauth2.service_account import Credentials

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# ⚠️ ESTA LINEA ES LO QUE PERMITE **IMPORTAR** ESTE MODULO, no sólo
# correrlo. `python sheet/foo.py` le pone `sheet/` en `sys.path[0]`
# solo, así que `from planillas import …` andaba de prestado: quien lo
# importara desde otro lado se comía `ModuleNotFoundError`. Pasó el
# 22/09 con un módulo hermano —`pipeline.py` importó `construir_padron`
# y el ciclo se habría caído en la nube—, y **el simulacro no lo
# encuentra** porque el import vive en la rama que no ejecuta.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
# ⚠️ EL ID VIVE EN `sheet/planillas.py`, NO ACA. Estaba copiado en cinco
# archivos: hoy coinciden y por eso no se nota, pero **la T1 estrena
# planilla nueva** y ese dia el que se olvide de actualizar su copia lee
# la planilla vieja y devuelve datos validos de la temporada equivocada.
# No falla: miente.
from planillas import OFICIAL as SHEET                  # noqa: E402
SERVIDORES = ['TWR', 'TFC', 'SR', 'FTN', 'URBF', 'FRZ', 'DRA']
# 🔴 EL PISO DEL POOL SALE DEL REQUISITO MAS FLOJO, Y ERA 8 A MANO.
#
# El comentario que estaba acá decía *«el corte que desbloquea WR, rango
# competitivo y carta»* — y eso es de **antes del 16/09/2026**, cuando el
# 8 era una sola cosa. `CLAUDE.md` lo dice con mayúsculas: *«YA NO HAY UN
# SOLO CORTE DE 8»*. Hoy son cuatro requisitos distintos y el más flojo
# es **1 participación** (Temporada); la Servidor no tiene ninguno.
#
# ⚠️ Y LA REGLA DEL PROYECTO ES QUE EL REQUISITO BLOQUEA LA CARTA, NO EL
# DATO. `CLAUDE.md`: *«si subir el Competitivo a 10 sacara a esa gente
# del pool, los 22 que caen se quedarían sin rango en su Temporada… por
# eso los pools no se tocan: cada carta pregunta por su requisito antes
# de dibujar»*. Un piso de 8 en el pool hace exactamente lo contrario.
#
# 🔴 Y CON LA T1 ARRANCANDO DE CERO ESO NO ES UN DETALLE: NADIE RECIBE
# CARTA. Medido el 22/09/2026, con el primer evento cargado: las 6
# personas del #349 **cumplen** el requisito de Temporada y de Servidor,
# y las dos cartas no se podían dibujar porque el pool estaba en 0. Peor:
# 5 de las 6 tienen carta de la pre-temporada en R2, así que `/card` les
# servía sus puntos y su OVR de una temporada **reseteada**. El requisito
# se cumplía, la Bloqueada se saltaba —correctamente— y la carta real no
# existía. Nada falló.
#
# ⚠️ Sale de `comun/requisitos.py` y no de un número acá, para que el día
# que el requisito cambie el pool lo siga solo.
def _piso():
    try:
        import sys as _s
        _s.path.insert(0, BASE)
        from comun.requisitos import REQUISITOS
        pisos = [min(n for n, _c, _e in cs) for cs in REQUISITOS.values() if cs]
        return min(pisos) if pisos else 1
    except Exception:                                    # noqa: BLE001
        return 1


MIN_EVENTOS = _piso()


def _cabecera(valores, *obligatorias):
    """`(indice, cabecera)` de la fila que trae esas columnas.

    🔴 BUSCARLA EN VEZ DE CLAVARLA. Las cuatro vitrinas tienen su
    cabecera en filas distintas —16, 12, 11— y eso obligaba a que cada
    lector llevara el numero escrito. Un numero de fila describe el
    **diseño** de la hoja, no el dato: el dia que se rehaga, el lector
    lee un banner y revienta con `ValueError` en un `.index()`.

    ⚠️ SE PIDEN VARIAS COLUMNAS Y NO UNA. Con una sola, un banner que
    diga «Rapero» en algun lado gana. Pidiendo dos que solo conviven en
    la cabecera de verdad, no hay ambigüedad.

    ⚠️ Y MIRA SOLO LAS PRIMERAS 40 FILAS: si no esta ahi, no es una
    cabecera, y recorrer 1.000 filas para no encontrarla esconde el
    problema detras de una espera.
    """
    for i, f in enumerate(valores[:40]):
        h = [str(x).strip() for x in f]
        if all(o in h for o in obligatorias):
            return i, h
    raise SystemExit(
        'no encuentro la cabecera: ninguna de las primeras 40 filas trae '
        '%s. ¿Cambió la hoja?' % ' y '.join(repr(o) for o in obligatorias))

# OVR de temporada: PTS 36% · EVT 20% · WR 16% · POD 16% · CAZ 12%
# 🔑 LOS PESOS Y LOS UMBRALES VIVEN EN `sheet/ovr.py`. Estaban
# escritos aca y eran el unico lugar que los tenia, que es por lo que
# `rankings.py` no podia ordenar por OVR. Se reexportan para no romper
# a quien los importe de este modulo.
import ovr as OVR  # noqa: E402

PESOS = list(OVR.PESOS)
UMBRAL_COLOR = OVR.UMBRAL_COLOR


def num(x):
    try:
        return float(str(x).replace(',', '').replace('%', '').strip() or 0)
    except ValueError:
        return 0.0


#: 🔴 LOS PAISES DE LA LIGA, Y ES UN FILTRO NECESARIO. Sale de
#: `sheet/padron_t1.PAIS_ISO` —que dice de dónde salió cada uno— menos
#: Brasil y Emiratos, que CLAUDE.md ya declara fuera: *«Emiratos y Brasil no
#: deberían existir, no se les toma en cuenta»* (Dlx, 22/09/2026).
#:
#: ⚠️ NO SE ESCRIBE LA LISTA ACA, se deriva. Copiarla sería el bug del rango
#: en cinco lugares con veintiún países.
def _iso_liga():
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from padron_t1 import PAIS_ISO
        return {v for k, v in PAIS_ISO.items()} - {'br', 'ae'}
    except ImportError:
        return set()


ISO_LIGA = _iso_liga()


def bandera(s):
    """El emoji de bandera son dos 'regional indicator': U+1F1E6 = A.

    🔴 Y SOLO VALE SI ES UN PAIS DE LA LIGA. Dlx, 24/09/2026: *«te dije que
    sólo las banderas hispanohablantes. Veo una bandera de noruega»*.

    Esa bandera era real y el dato venía de acá: **el emoji que la gente
    pega a su nombre en la llave es decoración, no dato**, y este fallback lo
    tomaba como país cuando la persona no estaba en el padrón. Medido sobre
    los lados reales de la T1, el mismo Hassan aparece como `Hassan🇪🇬`,
    `Hassan🇮🇶` y `hassan🇦🇴` — Egipto, Irak y Angola— y hay `🇬🇦` Gabón,
    `🇦🇿` Azerbaiyán, `🇯🇴` Jordania y `🇳🇴` Noruega. Ninguno es un país de
    la Liga y ninguno es un error de nadie: son chistes.

    ⚠️ EL FALLBACK NO SE BORRA, SE ACOTA. Sirve para la gente que todavía no
    está en el padrón y escribe su bandera de verdad — que es la mayoría. Lo
    que no puede es aceptar cualquier cosa.

    ⚠️ Y CON UNA BANDERA DE AFUERA DEVUELVE VACIO, no la primera válida que
    encuentre. Sin país no hay carta de País, y eso es *«sin dato no hay
    pieza»*: mejor sin bandera que con la de un país que no compite.
    """
    m = re.findall(r'[\U0001F1E6-\U0001F1FF]{2}', s)
    if not m:
        return ''
    cc = ''.join(chr(ord(c) - 0x1F1E6 + ord('a')) for c in m[0])
    if ISO_LIGA and cc not in ISO_LIGA:
        return ''
    return cc


sys.path.insert(0, RAIZ)
from comun.claves import clave as norm      # noqa: E402,F401

# 🔴 DECIA «MISMA NORMALIZACION QUE construir_pool_competitivo.py» Y ERA CIERTO:
# eran dos copias identicas de la misma regla equivocada. Que coincidieran
# entre si es lo que hacia que el cruce entre las dos hojas funcionara y que
# nadie mirara el resultado — las dos perdian **Ржунимагу** de la misma manera,
# asi que el cruce daba «bien» sobre una persona que las dos habian borrado.
#
# Eso es lo que hace peligrosa a la copia: no discrepa, concuerda en el error.


def racha_maxima(s):
    """La columna 🔥 guarda 'actual/maxima' como TEXTO."""
    p = str(s).split('/')
    return int(num(p[1])) if len(p) > 1 else 0


def avatares_conocidos():
    """Los avatares no estan en el Sheet: se rescatan de los JSON existentes.

    OJO: son URLs con hash que CADUCAN cuando la persona cambia su foto.
    Hoy 118 de 138 no tienen avatar y 6 de los 20 que hay estan rotos, cinco
    porque eran prestados. El arreglo de fondo es traerlos de Discord al
    generar, no guardarlos aca.

    🔴 Y NO SE ARRASTRAN LAS PRESTADAS. El parrafo de arriba ya decia «cinco
    porque eran prestados» y eso quedo como una nota: el rescate las copiaba
    igual de una corrida a la siguiente, para siempre. Medido el 17/09/2026,
    CINCO de las veinte llevan el Discord ID de OTRA persona —Tam y Krtman el
    de Bloody, Jupiter y Rayo el de MCO, Provenza el de Vize—. Eran fotos
    puestas a mano para mirar el diseño.

    ⚠️ Mientras la URL da 404 la carta cae en la inicial y no se nota. El dia
    que una responda, la carta de Tam muestra la cara de Bloody. Un dato
    equivocado que no falla es peor que uno que falta.

    Ahora una URL se conserva solo si su ID es el que el padron le da a esa
    persona. Es la misma prueba que hace `comun/respaldo._url_suya()`.
    """
    import re as _re
    ids = {}
    p = os.path.join(RAIZ, 'datos', 'padron.json')
    if os.path.exists(p):
        for x in json.load(open(p, encoding='utf-8')):
            if x.get('discord_id'):
                ids[norm(x['raw'])] = x['discord_id']

    av, prestadas = {}, []
    for f in ['datos/temporada_pool.json', 'datos/competitivo_pool.json']:
        ruta = os.path.join(RAIZ, f)
        if not os.path.exists(ruta):
            continue
        for x in json.load(open(ruta, encoding='utf-8')):
            u = x.get('av', '')
            if not u.startswith('http'):
                continue
            m = _re.search(r'/avatars/(\d+)/', u)
            if m and m.group(1) != ids.get(norm(x['raw'])):
                prestadas.append(x['raw'])
                continue
            av.setdefault(x['raw'].lower(), u)
    if prestadas:
        print('   ⚠️ %d avatar(es) PRESTADOS, no se arrastran: %s'
              % (len(prestadas), ', '.join(sorted(set(prestadas)))))
    return av


def _calcular_scores(dentro):
    """Llena `dentro` con el Score de cada quien, desde `Resultados`.

    🔴 EXISTE PORQUE LA VITRINA DEJO DE SER FUENTE. `Ranking
    Competitivo` sólo lista a los de 10+ eventos desde el 23/09/2026
    —decisión de Dlx—, así que leerla como origen del Score dejaba a
    todos los demás en **0.0**. Y eso no es lo que se decidió: la
    puerta es para lo que se **muestra**, no para el dato.

    Medido el mismo día: los 45 del pool salieron con `score: 0.0`, y
    con eso se rompen tres cosas que **no** piden 10 eventos — el OVR
    Nacional de la carta de País, el orden dentro del rango en la de
    Servidor y el TOP 3 del Lobby. Ninguna fallaba: mostraban ceros.

    ⚠️ `Resultados` VIVE EN EL OPERATIVO, no en el Oficial. La primera
    versión hacía `sh.worksheet('Resultados')` sobre la planilla
    equivocada y el `except` se comía el error con un aviso que parecía
    de otra cosa.

    ⚠️ Y NO LEVANTA: si esto falla, el pool se arma igual con el Score
    en cero. Es lo que ya hacía; el arreglo no puede empeorarlo.
    """
    try:
        from escribir import Hoja
        from competitivo import calcular
        res = Hoja('Resultados').filas()
        for quien, v in calcular(res).items():
            dentro[norm(quien)] = v.get('score') or 0.0
        print('   ⚠️ la vitrina no dio Scores (puerta de 10 ev): '
              '%d calculados desde `Resultados`' % len(dentro))
    except Exception as e:                               # noqa: BLE001
        print('   🔴 tampoco pude calcularlos: %s' % str(e)[:70])


def main():
    creds = os.path.join(RAIZ, 'creds.json')
    if not os.path.exists(creds):
        print('falta creds.json en la raiz del proyecto'); return

    # solo lectura: este script lee el Sheet y escribe JSON local. Ver
    # explorar_sheet.py para el porque.
    sc = ['https://www.googleapis.com/auth/spreadsheets.readonly']
    gc = gspread.authorize(Credentials.from_service_account_file(creds, scopes=sc))
    sh = gc.open_by_key(SHEET)
    from reintentar import leer as _leer_reint   # ver `sheet/reintentar.py`
    # ⚠️ EL `lambda` NO ES ADORNO: sin el, `sh.worksheet(...)` se evalua
    # ANTES de entrar al reintento —y esa llamada TAMBIEN pega a la API—,
    # asi que el 429 se escapaba por la mitad que quedaba afuera.
    v = _leer_reint(lambda: sh.worksheet('Ranking Temporada').get_all_values())

    # ⚠️ LA ELECCION MANUAL DEL SERVIDOR VIVE EN "Ranking Competitivo".
    # Regla de Dlx: "Konan decidio ser de TWR; eleccion manual supera a la del
    # bot". competitivo.py la respeta —su sv() devuelve el valor anterior si
    # existe y solo calcula el argmax cuando no habia nada— pero este builder
    # hacia lo contrario: el argmax pisaba la eleccion.
    #
    # Medido antes del arreglo: 10 de 138 salian con distinto servidor segun
    # que pool se leyera, Konan entre ellos —TWR elegido, TFC por argmax—.
    # Como la carta de Temporada dibuja el escudo del servidor, a esos 10 les
    # ponia el equivocado.
    #
    # ⚠️ Se lee la HOJA y no datos/competitivo_pool.json a proposito: el
    # competitivo se construye DESPUES que este —le pide el Win%, la racha y
    # los avatares— asi que depender de su JSON seria un ciclo. Las dos hojas
    # viven en el mismo Sheet, o sea que es una llamada mas y ninguna
    # dependencia nueva.
    # ⚠️ Y DE PASO SE TRAE EL SCORE, que hacia falta y NADIE lo escribia.
    # El pool commiteado tenia un campo `score` que ningun script del repo
    # generaba: al regenerar el pool desaparecia y 01_Temporada/normal_v3.py
    # reventaba con KeyError: 'score'. O sea que REFRESCAR EL POOL ROMPIA LA
    # CARTA DE TEMPORADA, y se habria descubierto recien al refrescar para T1.
    # Como el Score vive en esta misma hoja, sale en la misma lectura.
    SV_MANUAL, SCORE = {}, {}
    try:
        c = _leer_reint(lambda: sh.worksheet('Ranking Competitivo').get_all_values())
        fic, Hc = _cabecera(c, 'Rapero', 'Score')   # ver `_cabecera()`
        ic, isv, isc = Hc.index('Rapero'), Hc.index('Sv'), Hc.index('Score')
        for r in c[fic + 1:]:
            if not r or not r[0].strip():
                continue
            k = norm(r[ic])
            if r[isv].strip():
                SV_MANUAL[k] = r[isv].strip()
            SCORE[k] = num(r[isc])
        print('del Competitivo: %d servidores elegidos, %d scores'
              % (len(SV_MANUAL), len(SCORE)))
        # 🔴 Y SI LA VITRINA ESTA VACIA, SE CALCULA. La hoja `Ranking
        # Competitivo` **sólo lista a los de 10+ eventos** desde el
        # 23/09/2026 (decisión de Dlx), así que leerla como fuente del
        # Score deja a todos los demás en **0.0** — y eso no es lo que
        # se decidió: la puerta es para lo que se MUESTRA, no para el
        # dato.
        #
        # Medido el mismo día, después de aplicar la puerta: los 45 del
        # pool quedaron con `score: 0.0`, y con eso se rompen tres
        # cosas que **no** tienen requisito de 10 —el OVR Nacional de la
        # carta de País, el orden dentro del rango en la de Servidor y
        # el TOP 3 del Lobby—. Ninguna fallaba: mostraban ceros.
        #
        # ⚠️ CALCULAR ES MEJOR QUE LEER, ADEMAS. El Score sale de
        # `Resultados`, que es el dato crudo; la vitrina es una foto de
        # eso. Depender de la foto ataba el pool a una decisión de
        # presentación.
        if not SCORE:
            _calcular_scores(SCORE)
    except Exception as e:
        print('aviso: no pude leer el Competitivo (%s); sin Score ni eleccion' % e)
    # ⚠️ TAMBIEN SI LA LECTURA FALLO. El `if not SCORE` de arriba vive
    # dentro del `try`, asi que una excepcion lo salteaba: con la
    # vitrina vacia **y** un error, el pool salia con todos en 0.0 igual.
    if not SCORE:
        _calcular_scores(SCORE)

    # 🔴 LA CABECERA SE BUSCA, NO SE CLAVA. Esto decia `v[15]` —«la fila
    # 16»— y la fila 16 es una propiedad del **diseño** de la hoja, no
    # del dato. El dia que la vitrina se rehaga con la cabecera arriba,
    # un indice clavado lee una fila de banner: `H.index('Rapero')`
    # levanta `ValueError` y el pool no se construye.
    #
    # ⚠️ Y ES EL CAMBIO QUE HABILITA EL REDISEÑO. Buscarla por sus
    # nombres de columna hace que mover la cabecera —o agregarle FFA y
    # EFA— no toque una sola linea de codigo.
    fi, H = _cabecera(v, 'Rapero', 'Puntos')
    filas = [r for r in v[fi + 1:] if r and r[0].strip()]
    col = lambda n: H.index(n)

    AV = avatares_conocidos()

    # 🔴 LA IDENTIDAD SALE DEL PADRON. Ver `sheet/padron.py`: `Lista de
    # Raperos` del Operativo tiene `Nombre`, `País` (ISO) y `Crew` en
    # columnas limpias, mientras que aca el pais se deducia del emoji
    # pegado al nombre. Y ya falla: tres personas tienen en el padron un
    # pais distinto del emoji de su nombre.
    #
    # ⚠️ `seguro()` devuelve {} si el padron no responde, y todo cae en lo
    # que se deducia antes. Quedarse sin pools porque una hoja nueva no
    # contesta es peor que deducir.
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from padron import seguro as _padron           # noqa: E402
    PAD = _padron()
    if PAD:
        print('   padrón: %d personas, %d con país, %d con crew'
              % (len(PAD), sum(1 for d in PAD.values() if d.get('cc')),
                 sum(1 for d in PAD.values() if d.get('crew'))))

    pool = []
    # ⚠️ LOS QUE NO LLEGAN AL CORTE TAMBIEN SE GUARDAN, Y ANTES SE PERDIAN. Este
    # `continue` descartaba a 597 de 735 y no quedaban en ningun lado, asi que
    # la carta BLOQUEADA —el estado de quien tiene menos de 8 eventos— no tenia
    # a quien dibujar. Es la misma forma que el bug de los avatares: el dato
    # existia en el Sheet y el pipeline lo tiraba.
    #
    # Van con lo MINIMO que esa carta muestra —nombre, pais y eventos— porque
    # es lo unico que tiene sentido: sin 8 eventos no hay Win%, ni rango, ni
    # numero. Ver comun/bloqueada.py.
    bloqueados = []
    for r in filas:
        if num(r[col('Ev')]) < MIN_EVENTOS:
            _n = re.sub(r'[🇦-🇿]', '',
                        r[col('Rapero')]).replace('❓', '').strip()
            if _n:
                # 🔴 EL PAIS SALE DEL PADRON ACA TAMBIEN, Y ANTES NO.
                # Esta rama usaba SOLO `bandera(nombre)` —el emoji pegado
                # al nombre— mientras la del pool, veinte lineas mas
                # abajo, ya preguntaba al padron primero. Dos ramas y una
                # sola sabia del padron.
                #
                # ⚠️ NO SE NOTABA MIENTRAS LA VITRINA GUARDABA EL EMOJI.
                # Desde que el ciclo la recalcula, `Rapero` trae el nombre
                # **resuelto y limpio** —`Erian`, no `Erian 🇵🇦`— asi que
                # `bandera()` no encuentra nada. Medido el 22/09/2026 con
                # los 6 primeros de la T1: los cinco que estan en el
                # padron salieron con `cc=''`, y la carta de Pais les
                # decia *«te falta BANDERA ASIGNADA»* teniendo Panama,
                # Chile, España, Ecuador y Peru cargados.
                #
                # ⚠️ Y `sv` TAMPOCO ESTABA. Sin la clave, `x.get('sv')`
                # da None y la Bloqueada no puede decir de que servidor
                # sos. Se pone la columna `Sv` del Sheet, que es lo unico
                # que se puede saber de alguien sin eventos repartidos.
                _pb = PAD.get(norm(r[col('Rapero')]), {})
                bloqueados.append({'raw': _n,
                                   'cc': (_pb.get('cc')
                                          or bandera(r[col('Rapero')])),
                                   'sv': r[col('Sv')].strip(),
                                   'crew': _pb.get('crew', ''),
                                   'discord_id': _pb.get('discord_id', ''),
                                   # ⚠️ NO VA UNA CLAVE `actividad`:
                                   # `requisitos.actividad()` la DERIVA de
                                   # `ev`+`mw`+`mis`. Ponerla seria un
                                   # campo que parece la fuente y no lo es,
                                   # que es de donde salen las copias.
                                   'ev': num(r[col('Ev')]),
                                   'pts': int(num(r[col('Puntos')])),
                                   'av': AV.get(_n, '')})
            continue
        pod = num(r[col('🥇')]) + num(r[col('🥈')]) + num(r[col('🥉')])
        nom = re.sub(r'[\U0001F1E6-\U0001F1FF]', '', r[col('Rapero')]).replace('❓', '').strip()
        # ⚠️ EL SERVIDOR SALE DE DONDE TIENE MAS EVENTOS, no puntos. El comentario
        # decia "puntos" y era falso: medido, la suma de las 7 columnas da
        # exactamente Ev en 136 de 138, o sea que son la particion de los
        # eventos por servidor. El codigo siempre estuvo bien; el comentario no.
        # El REWORK del 20/08 tiene el mismo error en su Parte F y lo correcto
        # en su linea 86. Ver docs/rework_revision.md.
        sv = (SV_MANUAL.get(norm(r[col('Rapero')]))
              or (max(SERVIDORES, key=lambda s: num(r[col(s)]))
                  if any(num(r[col(s)]) > 0 for s in SERVIDORES) else '')
              or r[col('Sv')].strip())
        _p = PAD.get(norm(r[col('Rapero')]), {})
        pool.append({
            'full': r[col('Rapero')].strip(), 'raw': nom,
            # 🔴 EL PAIS SALE DEL PADRON. Ver sheet/padron.py y el mismo
            # comentario en construir_pool_competitivo.py: el emoji pegado
            # al nombre es una deduccion, la columna es un dato.
            'cc': _p.get('cc') or bandera(r[col('Rapero')]), 'sv': sv,
            'crew': _p.get('crew', ''),
            'discord_id': _p.get('discord_id', ''),
            'verificado': bool(_p.get('verificado')),
            'pts': int(num(r[col('Puntos')])), 'ev': int(num(r[col('Ev')])),
            'wr': r[col('Win%')].strip(), 'pod': int(pod),
            'oro': int(num(r[col('🥇')])), 'sem': int(num(r[col('🎖️')])),
            # 🔴 LA PLATA Y EL BRONCE SE LEIAN Y SE TIRABAN. Arriba se suman
            # los tres en `pod` y despues solo se guardaba el oro, asi que el
            # desglose se perdia **dentro de este mismo bucle**.
            #
            # Por eso `SEG` y `TER` de la carta Pais salian `—` en las 138, y
            # por eso su docstring decia «no existen: el pool trae `oro` y
            # `pod` y nada mas». Existian: estaban en el Sheet, este builder
            # ya los leia para sumarlos, y los descartaba una linea despues.
            #
            # Medido en el Sheet el 20/09/2026: **131 personas con plata y 83
            # con bronce**, todas con valor distinto de cero.
            #
            # Es la forma de siempre de este repo —el dato estaba y el
            # pipeline lo tiraba— y esta vez ni siquiera hacia falta ir a
            # buscarlo.
            'seg': int(num(r[col('🥈')])), 'ter': int(num(r[col('🥉')])),
            'caz': int(num(r[col('🎯')])), 'czd': int(num(r[col('💀')])),
            'sob': int(num(r[col('🛡️')])),
            'srv': sum(1 for s in SERVIDORES if num(r[col(s)]) > 0),
            'racha': racha_maxima(r[col('🔥')]),
            # el Score competitivo: de aca sale la LETRA del rango en la carta
            'score': SCORE.get(norm(r[col('Rapero')]), 0.0),
            'av': AV.get(nom.lower(), ''),
        })

    # OVR: se normaliza cada componente contra el maximo del pool.
    # 🔑 LA FORMULA VIVE EN `sheet/ovr.py` Y ACA SOLO SE LLAMA. La
    # tenia escrita este archivo y nadie mas podia usarla, asi que
    # `Ranking Temporada` se ordenaba por Puntos —lo unico que si sabia
    # calcular— y la carta por OVR. CJ salia #1 en la planilla y #6 en
    # la web con los mismos datos. Es la forma que este repo ya
    # documenta: la decision existia en un lugar y el otro leia otra
    # cosa.
    for d, o in zip(pool, OVR.calcular(
            [(d['pts'], d['ev'], num(d['wr']), d['pod'], d['caz'])
             for d in pool])):
        d['ovr'] = o

    pool.sort(key=lambda d: -d['ovr'])
    for i, d in enumerate(pool, 1):
        d['pos'] = i
        d['total'] = len(pool)
        d['rango'] = OVR.color(d['ovr'])

    salida = os.path.join(RAIZ, 'datos', 'temporada_pool.json')
    os.makedirs(os.path.dirname(salida), exist_ok=True)
    json.dump(pool, open(salida, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    sal_b = os.path.join(RAIZ, 'datos', 'bloqueados.json')
    bloqueados.sort(key=lambda d: (-d['ev'], d['raw'].lower()))
    json.dump(bloqueados, open(sal_b, 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)

    from collections import Counter
    print('%d raperos con %d+ eventos' % (len(pool), MIN_EVENTOS))
    print('%d BLOQUEADOS (menos de %d) -> %s' % (len(bloqueados), MIN_EVENTOS,
                                                 sal_b))
    print('rangos:', dict(Counter(d['rango'] for d in pool)))
    print('con avatar: %d | sin avatar: %d' % (sum(1 for d in pool if d['av']),
                                               sum(1 for d in pool if not d['av'])))
    print('->', salida)


if __name__ == '__main__':
    main()
