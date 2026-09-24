"""¿Se pueden recrear las cuatro cartas, para las 138, con lo que hay en el repo?

    python herramientas/puedo_generar.py

⚠️ **CORRE LOS GENERADORES DE VERDAD, no lee el código.** Es la única forma de
contestar: los dos errores que este proyecto ya se comió —`KeyError: 'URBF'`
que tumbaba las 138 por 2 personas, y una carpeta con su copia vieja del pool
que hacía que refrescar no cambiara nada— **los dos pasan la lectura**. Uno
aparece sólo cuando entra la persona 137 y el otro no aparece nunca.

Por eso cada carta se genera con **el pool entero**, no con su muestra, y se
cuentan las cartas que salieron en el HTML.

Y DESPUES, ¿EL PNG SALE BIEN?
-----------------------------
Generar no es exportar. Se corren los cuatro exportadores y se revisa el
archivo: un PNG tiene **dos maneras de salir mal sin que nada falle** — sale
*rectangular* si una sombra pinta la caja y se pierde la silueta, o sale
*vacío*, que pesa poco y abre bien.

⚠️ **La esquina se mide en el píxel exacto, no en una banda.** Se probó primero
con una banda de `min(alto,ancho)/40` y la **Temporada daba falso positivo**:
es un rectángulo con `border-radius:14` —42 px a escala 3— así que a 22 px de
la esquina ya hay carta, legítimamente. Las siluetas trazadas se meten mucho
más: en País la carta empieza a **80 px** de la esquina y en la Competitiva a
más de **120**. Una sola banda no puede servir para las dos formas.

Qué NO contesta
---------------
Si la carta se ve **bien**. Eso no se automatiza: `comun/pie.py` verifica que
las piezas no se pisen y el resto se mide a mano, con el caso a la vista. Acá
las preguntas son más chicas y más duras: **¿sale, sale para todos, y el
archivo está sano?**

⚠️ **Y "sale" no es "está completa".** Una carta puede generarse para las 138 y
mostrar un número inventado. Por eso además de correr los generadores, el
informe lista los agujeros de DATOS que ya están medidos y documentados.
"""
import io
import json
import os
import time
import re
import shutil
import subprocess
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
DATOS = os.path.join(BASE, 'datos')


def _j(*p):
    with open(os.path.join(BASE, *p), encoding='utf-8') as f:
        return json.load(f)


def _corre(argv, cwd=None):
    r = subprocess.run([sys.executable] + argv, capture_output=True, text=True,
                       encoding='utf-8', errors='replace', cwd=cwd or BASE)
    return r.returncode, (r.stdout or '') + (r.stderr or '')


ARRANQUE = [0.0]


def _cuantas(ruta, patron='class="card'):
    """Cuantas cartas hay en ESE HTML, si lo escribio ESTA corrida.

    🔴 CONTABA LO QUE HABIA EN DISCO, que es el bug que este archivo
    existe para encontrar — escrito adentro de el. Medido el 22/09/2026:
    con el pool en cero, `01_Temporada/salida/tarjeta_temporada.html` era
    del **21/09 a las 21:08** y tenia 138 cartas de la pre-temporada. El
    informe decia «Temporada 138 de 0 · ok».

    ⚠️ Y EL «ok» LO DABA `k >= techo`. Con techo 0, cualquier numero pasa.
    O sea que la herramienta que dice si las cuatro cartas salen daba por
    buenas 138 que no habia dibujado nadie hoy.

    Es la tercera vez que este repo se come la misma forma —
    `generar_todas.py`, `tanda_servidores.py` y `subir_cartas.py` el
    20/09— y la primera dentro del verificador. Lo unico que separa la
    carta de hoy de la de anteayer es el **mtime**.
    """
    p = os.path.join(BASE, ruta)
    if not os.path.exists(p):
        return None
    if ARRANQUE[0] and os.path.getmtime(p) < ARRANQUE[0]:
        return None          # esta, pero es de antes: no cuenta
    return io.open(p, encoding='utf-8').read().count(patron)


# ══ LAS CUATRO ══
# ⚠️ EL TECHO NO ES 138 EN TODAS, Y ESA DIFERENCIA IMPORTA. Una carta que sale
# 137 veces puede estar PERFECTA —si la que falta es alguien a quien la regla
# dice que no se le emite— o rota. Por eso cada una declara su techo y por qué,
# y el informe compara contra eso y no contra el total del pool.
def temporada(nombres):
    """Lee datos/temporada_pool.json directo. Se le pasan los nombres por argv."""
    cod, log = _corre([os.path.join('01_Temporada', 'generar.py')] + nombres)
    return (cod, _cuantas('01_Temporada/salida/tarjeta_temporada.html'),
            len(nombres), 'el pool entero', log)


def competitivo(nombres):
    """⚠️ gencomp.py NO recibe nombres: dibuja lo que haya en 02_Competitivo/
    comp.json, que es una MUESTRA DE OCHO. El que sí lee datos/ es el
    exportador, que pisa comp.json con la persona pedida y la restaura después.

    Acá se hace lo mismo que el exportador —con respaldo y restauración en
    `finally`, porque si el pool de muestra se queda pisado el próximo que abra
    la hoja ve 138 cartas y no entiende por qué.
    """
    orig = os.path.join(BASE, '02_Competitivo', 'comp.json')
    bak = orig + '.puedo_generar'
    shutil.copy(orig, bak)
    try:
        pool = _j('datos', 'competitivo_pool.json')
        por = {x['raw']: x for x in pool}
        with io.open(orig, 'w', encoding='utf-8') as f:
            json.dump([por[n] for n in nombres if n in por], f,
                      ensure_ascii=False, indent=1)
        cod, log = _corre([os.path.join('02_Competitivo', 'v2', 'gencomp.py')])
        # 🔴 SU TECHO ES EL POOL COMPETITIVO, NO LA UNION. Desde que los
        # requisitos se partieron, la union tiene gente que **no le toca**
        # esta carta: 10 eventos es su requisito. Medido el 22/09 con la
        # T1 arrancando: la union eran 6 y el pool competitivo 0, asi que
        # el informe decia *«Competitivo 0 de 6 ⚠️ LE FALTAN 6»* sobre
        # seis personas a las que la regla dice que no se les emite.
        #
        # Es la regla que este archivo ya tiene escrita dos veces —cada
        # carta declara SU techo— aplicada a la tercera. Un aviso sobre
        # el estado normal entrena a ignorar los avisos.
        return (cod, _cuantas('02_Competitivo/salida/tarjeta_competitiva.html',
                              '<div class="card'),
                len(por), 'el pool competitivo', log)
    finally:
        shutil.move(bak, orig)


def servidor(nombres):
    """El diseño vigente, vía `03_Servidor/generar.py`.

    ⚠️ **NO se mide `normal_gen.py`**, que sí lee del pool de seis: ese es el
    LAYOUT VIEJO —sin escudo en la punta, sin fondo del servidor, sin la
    columna— y sigue existiendo sólo detrás de `exportar_png.py --viejo`.

    ⚠️ Y acá no se dibuja: se ARMA EL HTML de las 138 y se cuenta. Cada carta
    Servidor es una captura propia —el escudo sobresale de la silueta, así que
    no se pueden apilar en una hoja— y 138 capturas son tres minutos. Lo que
    este informe pregunta es si el generador aguanta a las 138, y eso lo
    contesta el armado: es donde reventaba el `KeyError: 'URBF'`.
    """
    import importlib
    sys.path.insert(0, os.path.join(BASE, '03_Servidor'))
    sys.path.insert(0, os.path.join(BASE, '03_Servidor', 'disenos'))
    sys.path.insert(0, BASE)
    try:
        G = importlib.import_module('generar')
        import todos_sv as TS
        gente = G.cargar()
        G.montar(gente)
        k = sum(1 for i in range(len(gente)) if TS.carta(i, 'q%d' % i))
        # 🔴 SU TECHO NO ES EL POOL COMPETITIVO, y desde el 22/09 la
        # diferencia es enorme: la Servidor no tiene requisito y se le
        # emite a **todo el que pasa el porton de identidad**, que hoy son
        # 319 con el pool en 0. Comparar contra el pool daba «319 de 0»,
        # un numero que no quiere decir nada.
        #
        # Es la regla que este archivo ya tiene escrita —cada carta
        # declara SU techo— aplicada a la unica que no lo hacia.
        return 0, k, len(gente), 'los que pasan el portón', ''
    except BaseException:                                # noqa: BLE001
        # 🔴 `BaseException` Y NO `Exception`, y la diferencia es que la
        # herramienta viva o muera. Esta es la unica de las cinco que
        # IMPORTA el generador en vez de correrlo por subprocess, asi que
        # un `sys.exit()` adentro de ese modulo —o cualquier `SystemExit`
        # al importar— **no lo agarra `except Exception`**: sube y mata
        # el informe entero.
        #
        # Medido el 22/09/2026 metiendole un `raise SystemExit` al
        # generador: el informe corto en la tercera linea e imprimio el
        # mensaje suelto, en vez de decir «⚠️ EL GENERADOR FALLA».
        #
        # Un verificador que muere con lo que vino a verificar no
        # verifica nada.
        import traceback
        return 1, None, 0, '', traceback.format_exc()


def pais(nombres):
    """⚠️ SU TECHO NO ES EL DEL POOL, Y POR ESO SE CALCULA. "Sin dato no hay
    pieza": una carta de País sin país no se emite, así que el techo es el
    pool menos los que no lo tienen.

    ⚠️ **Acá decía «su techo es 137 y eso es correcto, Mark es el único del
    pool sin país».** Desde el 20/09/2026 son **138**: la identidad la pone
    el padrón del Operativo y Mark tiene país ahí — el `❓` estaba en el
    nombre del Oficial, no en la persona. El cálculo nunca estuvo escrito a
    mano, así que se corrigió solo; el que se quedó viejo fue este texto."""
    # ⚠️ EL `cc` SALE DE LOS DOS POOLS, NO SOLO DEL COMPETITIVO. Con el
    # competitivo en 0 este `sin` daba 0 y el techo quedaba en la union
    # entera, contando como emitible a quien no tiene pais. Mismo motivo
    # que la union de `main()`: los dos pools dejaron de tener la misma
    # gente el 16/09/2026.
    filas = {}
    for _f in ('temporada_pool.json', 'competitivo_pool.json'):
        for x in _j('datos', _f):
            filas.setdefault(x.get('raw'), {}).update(x)
    sin = sum(1 for n in nombres if not (filas.get(n) or {}).get('cc'))
    cod, log = _corre([os.path.join('04_Pais', 'generar.py'), '--todas',
                       '--salida', '_puedo_generar.png'])
    return (cod, _cuantas('04_Pais/salida/pais.html'), len(nombres) - sin,
            'el pool menos %d sin país' % sin, log)


def bloqueada(nombres):
    """⚠️ SU TECHO NO ES 138: ES 4, UNA POR CADA CARTA QUE SE PUEDE PEDIR.

    La Bloqueada no se emite por persona sino **por carta pedida**: el texto
    del progreso sale del requisito de esa carta. Así que lo que hay que
    probar no es "¿sale para las 138?" sino **"¿sale para las cuatro?"**.

    ⚠️ **Dio 3 de 4 hasta el 16/09/2026**: `REQUISITOS['servidor']` era
    `(0, None, ...)` y la barra hacía `100 * ev / meta` → `ZeroDivisionError`.
    No lo llamaba nadie con `servidor` porque esa carta no tenía requisito;
    desde que `/card` abre en la carta **del servidor donde escribiste**, es la
    primera que se pide — y con la T1 de cero, **la primera que se ejecuta**.

    **Entró acá justamente por eso**: el bug existía desde que la Bloqueada
    nació y esta herramienta no la miraba, así que no lo encontró nadie
    corriendo nada — lo destapó una decisión de diseño.

    ⚠️ **Y AHORA SON TRES, NO CUATRO, PORQUE LA SERVIDOR NO SE BLOQUEA.**
    Dlx la desbloqueó el 17/09/2026 —*«el servidor siempre va a estar
    desbloqueado»*— así que su requisito volvió a 0 y `bloqueada.html()` con
    `carta='servidor'` levanta `ValueError`: **no hay barra de progreso que
    dibujar cuando no hay meta**.

    ⚠️ **Eso es lo correcto y por eso el techo baja a 3.** Si se dejara en 4,
    esta herramienta quedaría en rojo para siempre por algo que está bien — y
    una herramienta que siempre avisa deja de avisar. Lo que sí se comprueba
    es que reviente **por el motivo bueno**: con `ValueError` y no con el
    `ZeroDivisionError` que tenía antes, que era el bug de verdad.
    """
    sys.path.insert(0, BASE)
    from comun import bloqueada as B
    ok, err = 0, ''
    for c in ('temporada', 'competitivo', 'pais'):
        try:
            B.html('Konan', 'ar', ev=0, carta=c)
            ok += 1
        except Exception as e:
            err = '%s -> %s: %s' % (c, type(e).__name__, e)
    # La Servidor TIENE que negarse, y con el error que explica por qué.
    try:
        B.html('Konan', 'ar', ev=0, carta='servidor', sv='DRA')
        err = err or 'servidor -> dibujó una Bloqueada y no debería: esa carta no se bloquea'
    except ValueError:
        pass
    except Exception as e:
        err = err or 'servidor -> %s en vez de ValueError: %s' % (type(e).__name__, e)
    return (0, ok, 3, 'una por cada carta que SÍ se bloquea', err)


CARTAS = [('Temporada', temporada), ('Competitivo', competitivo),
          ('Servidor', servidor), ('País', pais),
          ('Bloqueada', bloqueada)]


# ══ LOS AGUJEROS DE DATOS, QUE NO SE VEN CORRIENDO NADA ══
def agujeros():
    comp = _j('datos', 'competitivo_pool.json')
    temp = _j('datos', 'temporada_pool.json')
    n = len(comp)
    # 🔴 ANTES CONTABA ARCHIVOS Y DABA «422 de 138». Los avatares de
    # `_avatares/` son de TODO el padrón —422 archivos— y el pool son 138
    # personas, así que la fracción no significaba nada: un numerador de una
    # población y un denominador de otra. Peor, se leía como «sobran fotos»
    # cuando lo que hay que saber es **a cuántos del pool les sale la cara**.
    #
    # ⚠️ Y hay dos lugares donde puede estar: `_avatares/` (versionado) y
    # `comun/fotos/<temporada>/` (el espejo de R2, gitignoreado). Preguntarle
    # a `comun/respaldo` es lo único que contesta por la persona en vez de
    # por la carpeta — es la misma función que usan las cuatro cartas, así
    # que este número es el que se va a dibujar y no una estimación.
    try:
        from comun import respaldo
        fotos = sum(1 for x in comp
                    if respaldo.avatar(x['raw'], x.get('av') or ''))
    except Exception:                                    # noqa: BLE001
        av = os.path.join(BASE, '03_Servidor', 'disenos', '_avatares')
        fotos = len(os.listdir(av)) if os.path.isdir(av) else 0
    sv_muestra = _j('03_Servidor', 'normal_datos.json')
    tpor = {x['raw']: x for x in temp}
    viejos = sum(1 for s in sv_muestra
                 if tpor.get(s['raw'], {}).get('score') != s['score'])
    return [
        ('las cuatro', 'les sale la cara', '%d de %d' % (fotos, n),
         'de los %d que faltan, la mayoria no esta en DRA o no se puso foto '
         'en Discord. La columna av del Sheet no sirve: guarda un hash que '
         'caduca. Hoy la cara sale de comun/respaldo (repo + espejo de R2)'
         % (n - fotos)),
        ('Competitivo', 'ESTILO_DE', 'vacío',
         'los 16 iconos estan listos y nadie tiene estilo asignado'),
        ('Competitivo', 'duelos reales',
         '%d de %d' % (sum(1 for x in comp if x.get('duel_real')), n),
         'el resto muestra 0/0'),
        ('Servidor', 'OVR, titulos, podios y eventos', 'NO SON DEL SERVIDOR',
         'los cuatro numeros de la columna no existen en ningun pool: el '
         'Sheet tiene 7 columnas por servidor y construir_pool_temporada.py '
         'las lee solo para el argmax y TIRA los valores. La carta dibuja el '
         'GLOBAL y generar.py lo avisa en cada corrida'),
        ('Servidor', 'normal_datos.json', '%d de %d, y %d con numeros viejos'
         % (len(sv_muestra), n, viejos),
         'ya no bloquea nada: es la muestra del LAYOUT VIEJO, que vive detras '
         'de exportar_png.py --viejo'),
        ('Servidor', 'el marco', 'sin hacer',
         'ver 03_Servidor/disenos/ESTADO.md'),
        # 🔴 ESTE `0` ESTABA ESCRITO A MANO Y DEJO DE SER CIERTO EL 20/09.
        # SEG y TER pasaron a 138 de 138 —estaban en las columnas 🥈 y 🥉 del
        # Sheet y el builder las tiraba— y esta herramienta siguio diciendo
        # cero. Un chequeo de completitud con un numero escrito reporta el
        # dia que se escribio, no el de hoy: ahora se cuenta.
        ('País', 'SEG y TER',
         '%d de %d' % (sum(1 for x in temp if 'seg' in x and 'ter' in x), n),
         'salen de las columnas 🥈 y 🥉 del Sheet, desde el 20/09/2026'),
        ('País', 'DNA, DIN', '0 de %d' % n,
         'los duelos no guardan de que pais era el rival. Se desbloquean '
         'solos en cuanto la hoja 1v1 tenga filas: ver sheet/rankings.py'),
        ('País', 'los dos trofeos', '0 de %d' % n,
         'la Copa de Naciones arranca en T2'),
    ]


# ══ ¿Y EL PNG SALE BIEN? ══
# ⚠️ GENERAR NO ES EXPORTAR, y hasta ahora esto solo probaba lo primero. El PNG
# tiene dos maneras de salir mal sin que nada falle:
#
#   rectangular  si una sombra pinta la caja, la silueta se pierde y el
#                archivo sale igual de valido
#   vacio        un PNG entero transparente pesa poco y abre bien
#
# ⚠️ Y LA ESQUINA SE MIDE EN EL PIXEL EXACTO, NO EN UNA BANDA. Se probo primero
# con una banda de min(alto,ancho)/40 y la TEMPORADA daba FALSO POSITIVO: es un
# rectangulo con border-radius 14 —42 px a escala 3— asi que a 22 px de la
# esquina ya hay carta, legitimamente. Las siluetas trazadas se meten mucho
# mas: en Pais la carta empieza a 80 px de la esquina y en la Competitiva a mas
# de 120. Una sola banda no puede servir para las dos formas; el pixel (0,0) si.
EXPORTA = [
    ('Temporada',   ['01_Temporada/exportar_png.py',   '%(quien)s', '%(sale)s']),
    ('Competitivo', ['02_Competitivo/exportar_png.py', '%(quien)s', '%(sale)s']),
    ('Servidor',    ['03_Servidor/generar.py',         '%(quien)s']),
    ('País',        ['04_Pais/exportar_png.py',        '%(quien)s']),
]
# los dos que no reciben ruta de salida escriben en su propia carpeta
FIJOS = {'Servidor': os.path.join('03_Servidor', 'salida', 'sv_%s.png'),
         'País':     os.path.join('04_Pais', 'salida', 'pais_%s.png')}

# ⚠️ SE PRUEBA CON ALGUIEN QUE TIENE FOTO Y ALGUIEN QUE NO. Son los dos caminos
# del codigo —la copia del repo y la inicial—. El segundo era «el caso de 128
# de 138» y desde el 20/09/2026 es el de 26: la inicial paso a ser la
# excepcion, pero sigue siendo un camino que hay que probar.
QUIENES = ['Juasmio', 'Bloody']


def _norm(s):
    import unicodedata
    s = unicodedata.normalize('NFD', str(s).lower())
    return ''.join(c for c in s if c.isalnum())


def exportadores():
    """Corre los cuatro exportadores y revisa el PNG que sale."""
    import tempfile
    from PIL import Image
    import numpy as np
    out = []
    tmp = tempfile.mkdtemp(prefix='puedo_')
    # 🔴 QUIEN NO ESTA EN EL POOL NO PUEDE TENER ESA CARTA, y decir «NO
    # SALIO» de eso es gritar por el estado normal. Medido el 22/09 con el
    # pool en cero: seis avisos de ocho, todos esperados. Una herramienta
    # que grita por lo normal deja de leerse, que es como se pierde el
    # aviso de verdad.
    en_pool = {x['raw'] for x in _j('datos', 'competitivo_pool.json')}
    for quien in QUIENES:
        for nom, argv in EXPORTA:
            sale = os.path.join(tmp, '%s_%s.png' % (_norm(quien), _norm(nom)))
            av = [a % {'quien': quien, 'sale': sale} for a in argv]
            cod, log = _corre(av)
            p = (sale if nom not in FIJOS
                 else os.path.join(BASE, FIJOS[nom] % _norm(quien)))
            if cod or not os.path.exists(p):
                # La Servidor no tiene requisito y se dibuja igual; las
                # otras tres salen del pool.
                fuera = (nom != 'Servidor' and quien not in en_pool)
                out.append((nom, quien, None, None, None,
                            'ⓘ %s no está en el pool' % quien if fuera
                            else '⚠️ NO SALIO (codigo %d)' % cod))
                continue
            a = np.asarray(Image.open(p).convert('RGBA'))
            al = a[..., 3]
            esq = max(int(al[0, 0]), int(al[0, -1]),
                      int(al[-1, 0]), int(al[-1, -1]))
            tinta = float((al > 8).mean())
            est = 'ok'
            if esq > 8:
                est = '⚠️ ESQUINA OPACA: salio rectangular'
            elif tinta < .30:
                est = '⚠️ CASI VACIO'
            out.append((nom, quien, al.shape[1], al.shape[0], tinta, est))
    return out


def main():
    # ⚠️ EL CORTE, ANTES DE CORRER NADA. Todo lo que tenga mtime anterior
    # no salio de esta corrida. 2 s de margen entre `time.time()` y el
    # mtime del sistema de archivos.
    ARRANQUE[0] = time.time() - 2
    # 🔴 LA UNION DE LOS DOS POOLS, Y ANTES ERA SOLO EL COMPETITIVO.
    #
    # Era lo mismo mientras los dos pools tenian la misma gente —el corte
    # unico de 8—, y dejo de serlo el 16/09/2026 cuando el requisito se
    # partio en cuatro: Temporada pide **1 participacion** y Competitivo
    # **10 eventos**, asi que sus poblaciones son distintas por diseno.
    #
    # ⚠️ Y EL SINTOMA ERA UN CONTADOR IMPOSIBLE. Medido el 22/09 con el
    # primer evento de la T1 cargado: el pool de temporada tenia **6** y
    # el competitivo **0**, asi que la herramienta preguntaba por 0
    # personas, llamaba al generador de Temporada **sin nombres** —que
    # entonces dibuja su muestra de 8— e informaba *«Temporada 1 de 0»*.
    # Uno dibujado de cero esperados no es un numero: es la herramienta
    # que existe para cazar contadores mal, con un contador mal.
    vistos, nombres = set(), []
    for _f in ('temporada_pool.json', 'competitivo_pool.json'):
        for x in _j('datos', _f):
            r = x.get('raw')
            if r and r not in vistos:
                vistos.add(r)
                nombres.append(r)
    print('¿SALE LA CARTA, Y SALE PARA LAS %d?\n' % len(nombres))
    malas = 0
    for nom, fn in CARTAS:
        cod, k, techo, por, log = fn(nombres)
        if cod:
            print('   %-12s ⚠️ EL GENERADOR FALLA (codigo %d)' % (nom, cod))
            print('                %s' % log.strip().splitlines()[-1][:110])
            malas += 1
        elif k is None and not techo:
            # ⚠️ SIN NADIE A QUIEN DIBUJARLE, NO HAY HTML — y eso es lo
            # correcto, no un fallo. Con el pool en cero los generadores
            # de Temporada y Pais no escriben nada; contarlo como falla
            # hacia que la herramienta gritara por el estado normal de
            # una temporada recien arrancada.
            print('   %-12s   0 de   0   ⓘ no hay a quién dibujarle todavía'
                  % nom)
        elif k is None:
            print('   %-12s ⚠️ corrio pero no encontre su HTML de HOY' % nom)
            malas += 1
        elif not techo:
            # 🔴 «0 a quien dibujarle» NO ES «ok». Con el pool vacio el
            # techo es 0 y `k >= techo` daba por bueno cualquier numero,
            # incluido el de un HTML de anteayer. Ver `_cuantas()`.
            print('   %-12s %3d de %3d   ⓘ no hay a quién dibujarle todavía'
                  % (nom, k or 0, techo))
        elif k >= techo:
            print('   %-12s %3d de %3d   ok · %s' % (nom, k, techo, por))
        else:
            print('   %-12s %3d de %3d   ⚠️ LE FALTAN %d' % (nom, k, techo,
                                                             techo - k))
            malas += 1

    print('\n¿Y EL PNG SALE BIEN?\n')
    for nom, quien, w, h, tinta, est in exportadores():
        if w is None:
            print('   %-12s %-9s %s' % (nom, quien, est))
            malas += 1
        else:
            print('   %-12s %-9s %4dx%-5d tinta %5.1f%%  %s'
                  % (nom, quien, w, h, 100 * tinta, est))
            malas += 0 if est.startswith('ok') else 1

    print('\nY LO QUE SALE PERO NO ESTA COMPLETO\n')
    ancho = max(len(c) for c, _, _, _ in agujeros())
    for carta, que, cuanto, por in agujeros():
        print('   %-*s  %-22s %s' % (ancho, carta, que, cuanto))
        print('   %-*s  %s' % (ancho, '', '· ' + por))
    print('\n   Prime e Histórico no tienen concepto: son dos cartas que no se')
    print('   pueden generar porque todavía no existen, no porque falte un')
    print('   dato. La Bloqueada SÍ tiene código desde el 16/09 y por eso')
    print('   ahora se prueba arriba, con las otras.')
    return 1 if malas else 0


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    sys.exit(main())
