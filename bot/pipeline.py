# -*- coding: utf-8 -*-
"""EL CICLO ENTERO, DE UNA. Del Sheet a Discord, redibujando solo lo que cambio.

    python bot/pipeline.py            simulacro: dice que haria
    python bot/pipeline.py --correr   lo hace
    python bot/pipeline.py --correr --sin-pools   no rebaja los pools del Sheet
    python bot/pipeline.py --correr --sin-subir   dibuja y NO publica (para probar)
    python bot/pipeline.py --correr --sin-dibujar hasta el paso 2c y para

🔴 POR QUE EXISTE. Cada pieza de esta cadena ya estaba y **nada las
encadenaba**: rebajar los pools, dibujar, subir a R2, refrescar KV y
sellar eran cinco comandos que alguien tenia que acordarse de correr en
orden. Eso no es «se mantiene solo», es una lista de pasos en la cabeza
de una persona.

    Entrada ──> Sheet ──> pools ──> que cambio ──> caras ──┐
                                                    │  por tanda de 10:
                                                    └──> dibujar ──> R2 ──> sello
                                                                         y al final KV

⚠️ **LO CARO ES DIBUJAR, Y POR ESO EL PASO 2 ES EL QUE IMPORTA.** Una
tanda completa son ~26 minutos de Actions y hay 2.000 al mes: redibujar
todo despues de cada evento se come el 40 % del mes para que el 99 % de
las cartas salga identica. `bot/que_cambio.py` contesta **quien cambio y
que carta suya quedo vieja** —si cambio `pts`, la Temporada y nada mas—
y aca se dibuja exactamente eso.

⚠️ **UN CICLO SIN CAMBIOS TERMINA EN SEGUNDOS.** Es lo que permite
correrlo seguido: si no paso nada, lo unico que cuesta es leer el Sheet.

EL ORDEN, Y POR QUE ES ESE
---------------------------
Se trabaja **en tandas** —`POR_TANDA`, hoy 10 personas— y cada tanda
se dibuja, se sube y **se sella antes de empezar la siguiente**.

⚠️ **EL SELLO VA DESPUES DE SUBIR, NUNCA ANTES.** Al reves, una corrida
que se corta deja el sello diciendo que todo se dibujo y **los cambios
se pierden para siempre**: la proxima no ve diferencia y las cartas
viejas se quedan arriba. Es el mismo orden que
`sheet/procesar_entrada.py` usa con el contador de eventos.

⚠️ **Y SE SELLA SOLO A QUIEN SALIO BIEN.** Si de una tanda de diez
fallan dos, se sellan ocho y las otras dos vuelven a salir en la
proxima corrida.

🔴 **LAS TANDAS NO SON PROLIJIDAD: SIN ELLAS SE TRABA SOLO.** Con el
sello al final de todo, un job que muere a mitad de camino no sella
nada — y la corrida siguiente rehace lo mismo y muere en el mismo
lugar, para siempre. Medido: 1,7 min por persona, 30 de job, o sea que
arriba de 17 personas no terminaba. Y el Score sale del ranking del
pool entero, asi que el primer evento de la T1 le cambia el Score a
**todos**: la corrida grande era justo la que se trababa.

⚠️ **NADA DE ESTO FRENA POR UN CASO RARO.** Un nombre que no esta en el
padron va a la hoja `Pendientes` y la corrida sigue: un job que se cae
por una letra deja el evento sin cargar y el error en un log que nadie
lee. Ver `sheet/pendientes.py`.
"""
import glob
import hashlib
import io
import json
import os
import subprocess
import sys
import time

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)
# 🔴 `sheet/` TAMBIEN, desde el 22/09. El paso 2 importa
# `construir_padron` para saber cuanta gente hay antes y despues; hasta
# hoy este modulo solo llamaba a `sheet/` por subprocess y no lo
# necesitaba.
#
# ⚠️ Y EL SIMULACRO NO HABRIA ENCONTRADO ESTO. El import vive dentro de
# la rama `correr`, que el simulacro no ejecuta: `python bot/pipeline.py`
# pasaba en verde y la corrida de verdad se caia con
# `ModuleNotFoundError` en el paso 2. Correr en seco ejercita el camino
# que no importa.
sys.path.insert(0, os.path.join(BASE, 'sheet'))
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

SALIDA = os.path.join(SCR, 'salida')
SERVIDORES = ('DRA', 'EFA', 'FFA', 'FRZ', 'FTN', 'SR', 'TFC', 'TWR', 'URBF')

# Cuantas personas por tanda.
#
# 🔴 ERA 10 Y AHORA SON 40, PORQUE DIBUJAR DEJO DE COSTAR LO MISMO. El 10
# salia de «1,7 min por persona, 10 son ~17 min»; ese 1,7 eran **diez
# arranques de Chromium por persona** —la propia y nueve servidores— y no
# el dibujo. Desde que la tanda se dibuja de una sola llamada por carta,
# una persona cuesta ~13,5 s y 40 entran en ~9 min.
#
# ⚠️ EL TECHO SIGUE SIENDO EL JOB, no la memoria: 120 minutos. Se deja
# margen de sobra porque la tanda es la unidad que se **sella**, y una
# tanda que no termina no deja nada — cuanto mas grande, mas se pierde al
# cortarse. 40 es el punto donde el arranque ya no se nota (medido: 1,41
# s/persona a 20 nombres y 1,34 a 60) y la perdida por corte sigue siendo
# chica.
POR_TANDA = 40

# 🔴 CUANTO CUESTA UNA PASADA, MEDIDO **EN ACTIONS** Y NO EN LA MAQUINA
# DE AL LADO. Y esa distincion costo una corrida de dos horas.
#
# Local, con la tanda bateada: `03_Servidor/generar.py` da 1,41 s/persona
# a 20 nombres y 1,34 a 60. Con eso el simulacro anunciaba **74 min** para
# las 319.
#
# En el runner de GitHub, medido el 22/09/2026 sobre la corrida que se
# corto por timeout: **5 tandas de 40 en ~115 min**, o sea 200 personas x
# 10 variantes = 2.000 pasadas -> **3,45 s cada una**. Dos veces y media
# mas lento, y ahi se suman la subida a R2 y un CPU mas flojo.
#
# ⚠️ EL NUMERO QUE VALE ES EL DE ACTIONS, porque la pregunta que la
# estimacion contesta es «¿entra en el job?» y el job es ese. Medirlo acá
# daba 74 min de un trabajo de 183 — y el timeout son 120.
#
# ⚠️ Y DE AHI SALE QUE UN REDIBUJO COMPLETO NO ENTRA EN UNA CORRIDA. Son
# ~3 h contra 120 min, asi que se hace en dos; por eso el sello tiene que
# sobrevivir al timeout (ver `guardar el sello` en el .yml).
SEG_POR_CARTA = 3.5

# 🔴 LAS PASADAS DE UNA TANDA VAN DE A VARIAS A LA VEZ. Eran trece
# Chromium en fila —Temporada, Competitivo, País y diez de la Servidor—
# en un runner de 4 núcleos. Medido el 24/09/2026 en el ciclo de las
# 9:09 AM ET: **27 min dibujando** 89 personas. Y ese tiempo es lo que
# la carta anda atrás del ranking: el ciclo publica el ranking al
# terminar de escuchar, y la carta nueva recién cuando esto termina.
#
# ⚠️ SE PUEDE PORQUE CADA TIPO USA SUS PROPIOS ARCHIVOS. Temporada,
# Competitivo y País escriben un temporal fijo cada una —`_tmp.html`,
# `comp.json`, `_export.html`— pero hay UNA llamada de cada una por
# tanda, así que nunca se pisan; las diez de la Servidor ya nombran su
# temporal con el PID (`03_Servidor/generar.py`) y su PNG con el
# servidor. Lo que NO se puede es partir un mismo tipo en dos llamadas.
PARALELO = max(1, min(4, os.cpu_count() or 1))
# Cuantas rutas por llamada a `subir_cartas.py`. El techo real son
# ~380 (32.768 caracteres / ~86 por ruta); 200 deja margen.
POR_SUBIDA = 200

# carta -> (script, carpeta donde deja el PNG, prefijo del archivo)
#
# 🔴 EL PREFIJO DE TEMPORADA Y COMPETITIVO ERA `''` Y ES SU NOMBRE. Los
# exportadores escriben `temporada_Agus.png` y `competitivo_Agus.png` —
# es la convencion que `bot/subir_cartas.py` parsea, `<carta>_<nombre>`—
# y aca se los buscaba como `agus.png`. O sea que `no_salieron()`
# **nunca** encontraba una de esas dos y las daba todas por fallidas.
#
# Medido en la corrida del 23/09/2026: «competitivo 40 persona(s) → 40 no
# salió» y «temporada 40 → 40 no salió», con **480 PNG** en el mismo
# informe. 400 de servidor + 40 + 40: estaban las ochenta, dibujadas y
# subidas. Lo que fallaba era la cuenta.
#
# ⚠️ Y NO ES COSMETICO: lo que `no_salieron()` marca no se sella, asi que
# esas ochenta personas volvian a la cola **en cada corrida**. Es la
# forma contraria a la de siempre —acá el contador da por MALO lo bueno—
# y el sintoma es el que se veia: corridas de dos y tres horas.
COMO = {
    'temporada':   (['01_Temporada/exportar_png.py'], '01_Temporada/salida',
                    'temporada_'),
    'competitivo': (['02_Competitivo/exportar_png.py'], '02_Competitivo/salida',
                    'competitivo_'),
    'pais':        (['04_Pais/exportar_png.py'], '04_Pais/salida', 'pais_'),
    'servidor':    (['03_Servidor/generar.py'], '03_Servidor/salida', 'sv_'),
}


def _avisar_actions(hay, personas, cartas):
    """Le dice al workflow si hace falta dibujar. Fuera de Actions, nada.

    ⚠️ POR `$GITHUB_OUTPUT` Y NO POR EL LOG. El que decide si arranca el
    job caro es el workflow; leer el log para eso es un acople que se
    rompe el día que alguien cambia una palabra del mensaje.

    ⚠️ Y SI LA VARIABLE NO ESTA, NO PASA NADA. Este módulo se corre a
    mano todos los días desde una terminal: un `KeyError` acá sería un
    fallo en el camino común por algo que sólo le importa al raro.
    """
    d = os.environ.get('GITHUB_OUTPUT')
    if not d:
        return
    try:
        with io.open(d, 'a', encoding='utf-8') as f:
            f.write('dibujar=%s\n' % ('true' if hay else 'false'))
            f.write('personas=%d\n' % personas)
            f.write('cartas=%d\n' % cartas)
    except OSError:
        pass


def corre(args, callado=True, mostrar=()):
    """⚠️ encoding utf-8 explicito: ver el comentario de bot/rehacer.py.

    `mostrar`: pedazos de texto; las líneas de la salida que los contengan
    se imprimen aunque la llamada vaya callada. Es para el chequeo que un
    paso hace de sí mismo y que no tiene que frenar el ciclo, pero sí verse.
    """
    r = subprocess.run([sys.executable] + args, cwd=BASE,
                       capture_output=callado, text=True,
                       encoding='utf-8', errors='replace')
    if callado and mostrar:
        for l in (r.stdout or '').splitlines():
            if any(m in l for m in mostrar):
                print('      %s' % l.strip())
    if r.returncode and callado:
        ultima = (r.stderr or r.stdout or '').strip().splitlines()
        print('      ⚠️ falló: %s' % ' '.join(args[:2]))
        # 🔴 EL ERROR SOLO NO DICE DÓNDE. Hasta el 24/09/2026 esto imprimía
        # la última línea, cortada a 110 caracteres, y el log del ciclo de
        # las 6:52 AM ET del 24/09 decía «APIError: [429]: Quota exceeded»
        # sin decir qué llamada: hubo que deducirla leyendo el builder. La
        # última línea `File "…", line N` del traceback es la que la
        # nombra, y cuesta una línea más en el log.
        donde = [l for l in ultima if l.strip().startswith('File "')]
        if donde:
            print('         %s' % donde[-1].strip()[:150])
        if ultima:
            print('         %s' % ultima[-1][:200])
    return r.returncode == 0


def paso(n, que):
    # ⚠️ `%s` y no `%d`: hay un paso «1b». Se agrego entre el 1 y el 2 y
    # renumerar los seis siguientes habria ensuciado el diff con ruido que
    # esconde el cambio de verdad.
    print('\n── %s · %s' % (n, que))


def _pool(nombre):
    """Cuántas personas tiene ese pool ahora. `[]` si no está."""
    p = os.path.join(BASE, 'datos', '%s_pool.json' % nombre)
    if not os.path.exists(p):
        return []
    try:
        with io.open(p, encoding='utf-8') as f:
            return json.load(f)
    except (ValueError, OSError):
        return []


_NAVEGADOR = [False]


def hace_falta_el_navegador():
    """Baja Chromium, y sólo si hay algo que dibujar. Idempotente.

    🔴 SE BAJABA EN TODA CORRIDA Y EL 97 % NO DIBUJA NADA. Estaba en el
    paso `instalar` del `.yml` como
    `playwright install --with-deps chromium`.

    Medido el 22/09/2026 sobre una corrida quieta de verdad: el job entero
    son **62 s** y ese paso **36** — el 58 %. Con el cron cada hora son 23
    corridas quietas por día bajando un navegador que no se usa: **~7 h
    por mes** de las 33 que da el plan.

    ⚠️ Es la misma regla que ya sigue `bajar_las_caras()`: la precondición
    es **dibujar**, no «correr en Actions». Puesta en el workflow queda
    bien para ese llamador y mal para el otro — y acá el otro llamador es
    el 97 % de las veces.

    ⚠️ FUERA DE ACTIONS NO HACE NADA. En una máquina donde Playwright ya
    tiene su navegador, `install` termina enseguida; pero `--with-deps`
    pide sudo y en Windows no aplica, así que se prueba primero si ya está
    y sólo se baja si falta.
    """
    if _NAVEGADOR[0]:
        return
    _NAVEGADOR[0] = True
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as pw:
            pw.chromium.executable_path      # ya está: no hay nada que bajar
            if os.path.exists(pw.chromium.executable_path):
                return
    except Exception:                                    # noqa: BLE001
        pass
    print('      bajando Chromium (sólo cuando hay que dibujar)…')
    args = [sys.executable, '-m', 'playwright', 'install']
    if os.environ.get('GITHUB_ACTIONS'):
        args.append('--with-deps')
    args.append('chromium')
    r = subprocess.run(args, cwd=BASE, capture_output=True, text=True,
                       encoding='utf-8', errors='replace')
    if r.returncode:
        print('      ⚠️ no pude instalar el navegador: %s'
              % (r.stderr or '').strip().splitlines()[-1][:90])


_ESPEJO_HECHO = [False]


def bajar_las_caras():
    """El espejo de R2 a `comun/fotos/<temporada>/`. Idempotente.

    🔴 SE LLAMA DESDE LOS DOS CAMINOS QUE DIBUJAN, y hasta hoy había uno
    solo. Estaba escrito como paso 4, o sea **después** del `return 0` de
    «nada cambió» — que era correcto mientras lo único que se dibujaba
    fueran las cuatro cartas.

    ⚠️ LO ROMPÍ YO AL AGREGAR EL PASO 5b. Las Bloqueadas se rehacen
    **también** cuando el ciclo dice «nada cambió», y eso pasa antes del
    paso 4: la Bloqueada **lleva foto** —«la foto va apagada y detrás del
    velo», dice `CLAUDE.md`— así que se redibujaba sin espejo y la cara
    salía de `_avatares/`, que tiene 110 contra las 112 de R2. Dos
    personas perdiendo su cara, en silencio, sólo en los días tranquilos.

    La precondición es **dibujar**, no «ser el paso 4». Por eso ahora la
    pide quien dibuja.

    ⚠️ IDEMPOTENTE Y BARATO LA SEGUNDA VEZ: `fotos.espejo()` saltea lo que
    ya está con el tamaño correcto, y la bandera de acá evita hasta el
    listado de R2. Un runner limpio lo paga una vez por corrida.
    """
    if _ESPEJO_HECHO[0]:
        return
    try:
        sys.path.insert(0, SCR)
        import fotos as FT
        import requests as _rq
        _s = _rq.Session()
        _s.headers['Authorization'] = 'Bearer ' + FT.env('CLOUDFLARE_API_TOKEN')
        FT.espejo(_s)
        _ESPEJO_HECHO[0] = True
    except Exception as e:                               # noqa: BLE001
        print('      ⚠️ sin espejo (%s): dibujo con lo que haya en el repo'
              % str(e)[:70])


def no_salieron(carta, quienes, corte):
    """[(quien, que)] de lo que esa carta NO dejo en disco recien dibujado.

    🔴 HACE FALTA PORQUE AHORA SE DIBUJA DE A MUCHOS. Con una llamada por
    persona, el `returncode` alcanzaba: si fallaba, fallaba esa. Con diez
    nombres adentro de una llamada, que a uno no le salga la carta **no
    cambia el codigo de salida** — el generador termina bien igual.

    ⚠️ Y EL MTIME, NO EL NOMBRE. La carta vieja de la misma persona se
    llama igual que la nueva; lo unico que las separa es cuando se
    escribio. Es el bug que tenian `generar_todas`, `tanda_servidores` y
    `subir_cartas` el 20/09.
    """
    from comun.claves import clave as CL
    _script, carpeta, pref = COMO[carta]
    d = os.path.join(BASE, carpeta)
    falta = []
    esperados = [('', pref)]
    if carta == 'servidor':
        esperados += [(sv, 'sv-%s_' % sv.lower()) for sv in SERVIDORES]
    # ⚠️ SE PRUEBAN LAS DOS GRAFIAS, y no por las dudas: los
    # exportadores no coinciden. Servidor escribe la **clave**
    # (`sv_bloody.png`) y Temporada y Competitivo el nombre **tal cual**
    # (`temporada_Agus.png`). Pedir una sola forma es elegir cuál de los
    # dos se cuenta mal, que es exactamente lo que pasaba.
    for quien in quienes:
        for sv, p in esperados:
            hay = False
            for n in (CL(quien), str(quien)):
                f = os.path.join(d, '%s%s.png' % (p, n))
                if os.path.exists(f) and os.path.getmtime(f) >= corte:
                    hay = True
                    break
            if not hay:
                falta.append((quien, carta if not sv else 'sv-%s' % sv.lower()))
    return falta


def rehacer_bloqueadas():
    """Redibuja y sube las Bloqueadas cuyo contenido cambio. Devuelve cuantas.

    🔴 NO ESTABAN EN EL CICLO, Y SON LA UNICA CARTA CUYO CONTENIDO ES UN
    CONTADOR. «2/3 DUELOS NACIONALES» cambia cada vez que la persona
    compite y el nombre del archivo no, asi que se dibujaban a mano una vez
    y se quedaban con el numero de ese dia. Durante una prueba de tres dias
    esa es la carta que mas se mueve y era la unica que no se movia.

    ⚠️ TIENE SU PROPIO SELLO, aparte del de las otras cuatro. El de
    `que_cambio.py` es por persona y por carta sobre los cuatro
    generadores; este es el hash del HTML de cada Bloqueada, que tapa el
    dato y el dibujo juntos. Ver `bloqueadas._sello_de()`.

    ⚠️ Y SE LLAMA TAMBIEN CUANDO EL CICLO DICE «NADA CAMBIO». Una
    Bloqueada puede moverse sin que se mueva ninguna carta: quien pasa de
    1/3 a 2/3 duelos nacionales **sigue sin** carta de Pais, asi que no
    hay carta que redibujar y el contador cambio igual. Colgarla del `if
    subidas` la habria dejado congelada justo en los dias tranquilos.

    ⚠️ NO CORTA LA CORRIDA SI FALLA. Quedarse sin Bloqueadas frescas es
    peor que nada y muchisimo mejor que abortar despues de haber dibujado.
    """
    paso('5b', 'las Bloqueadas')
    # 🔴 LAS CARAS PRIMERO. La Bloqueada lleva foto, y este paso corre
    # también en la rama de «nada cambió», que es anterior al paso 4.
    # Ver `bajar_las_caras()`.
    hace_falta_el_navegador()
    bajar_las_caras()
    try:
        sys.path.insert(0, SCR)
        import bloqueadas as BQ
        antes = len(BQ.sellos_viejos())
        # 🔴 EL CORTE SE TOMA ANTES, Y NO ES OPCIONAL. La carpeta ya
        # tenía **1.413 PNG** de corridas a mano anteriores —nunca se
        # limpiaba, porque este paso no existía—, así que un `glob` de
        # todo habría subido 1.419 archivos cada vez que cambiara uno.
        #
        # ⚠️ Es la misma forma que este repo documenta tres veces
        # —«contar lo que hay en disco no es contar lo que salió»— y la
        # escribí de nuevo acá al montar el paso. El nombre del archivo
        # no distingue la Bloqueada de hoy de la de anteayer; el mtime sí.
        # 2 s de margen entre `time.time()` y el mtime del filesystem.
        corte = time.time() - 2
        ok = corre(['bot/bloqueadas.py', '--generar'], callado=False)
        if not ok:
            print('      ⚠️ falló: sigo con las que ya están arriba')
            return 0
        todas = sorted(glob.glob(os.path.join(BQ.SALIDA, '*.png')))
        nuevas = [f for f in todas if os.path.getmtime(f) >= corte]
        if len(todas) != len(nuevas):
            print('      (%d archivo(s) de antes en la carpeta, no se suben)'
                  % (len(todas) - len(nuevas)))
        if not nuevas:
            print('      nada cambió')
            # ⚠️ Igual se limpia: la carpeta es un intermedio y dejar las
            # sobras es lo que la hizo llegar a 1.413.
            for f in todas:
                try:
                    os.remove(f)
                except OSError:
                    pass
            return 0
        for i in range(0, len(nuevas), 200):
            corre(['bot/subir_cartas.py'] + nuevas[i:i + 200])
        # ⚠️ SE BORRA `todas`, NO SÓLO LO QUE SE SUBIÓ. La carpeta es un
        # intermedio —R2 es la copia que importa— y dejar las sobras es
        # exactamente cómo llegó a tener 1.413 archivos.
        for f in todas:
            try:
                os.remove(f)
            except OSError:
                pass
        print('      %d Bloqueada(s) redibujada(s) y subida(s)  '
              '(%d selladas antes)' % (len(nuevas), antes))
        return len(nuevas)
    except Exception as e:                               # noqa: BLE001
        print('      ⚠️ las Bloqueadas no se pudieron rehacer (%s)'
              % str(e)[:70])
        return 0


def main():
    correr = '--correr' in sys.argv
    t0 = time.time()
    print('\n══ EL CICLO %s ══' % ('' if correr else '(simulacro)'))

    # ── 1 · las llaves que haya cargadas ────────────────────────────
    # 🔴 EL BOTON QUE NUNCA CORRIO. El paso 5 de la hoja `Entrada` manda a
    # apretar un menu del Apps Script, y ese menu **no se ejecuto una sola
    # vez**: el `Log` del Operativo dice `Total entradas 0` y por eso
    # `Resultados` y `1v1` tienen 2 filas —la cabecera— despues de 348
    # eventos, con `Eventos Procesados` en 352. La fila 8 de la propia
    # hoja ya lo avisa: «el boton viejo NO procesa».
    #
    # El procesamiento existe y anda: `sheet/motor.py` +
    # `procesar_entrada.py`, en Python, que es lo que ya corre acá todos
    # los dias. Lo unico que faltaba era llamarlo.
    #
    # ⚠️ VA ANTES DE LOS POOLS, y el orden no es cosmetico: procesar una
    # llave cambia los puntos, y los pools se rebajan del Sheet. Al reves,
    # el evento entra hoy y las cartas se enteran manana.
    #
    # ⚠️ NO FRENA EL CICLO SI FALLA. Un nombre raro o una fila mal pegada
    # no puede dejar sin redibujar a las 138: lo dudoso va a `Pendientes`
    # —ver `sheet/pendientes.py`— y el ciclo sigue. Y con la hoja vacia es
    # un no-op que sale en un segundo.
    paso(1, 'las llaves cargadas en `Entrada`')
    # ✅ EL LECTOR **YA ESCRIBE**, desde el 22/09/2026. Dlx: «pongamos
    # esto a prueba, estos 3 dias pongamos a prueba FFA, quiero ver si
    # logras captar todo».
    #
    # Lo que lo frenaba era que cargaria eventos de la pre en hojas que
    # el reset iba a limpiar. El reset ya esta hecho — y lo que impide
    # que las 25 llaves de la pre vuelvan a entrar **no es el reset**,
    # es `llaves_a_entrada.de_esta_temporada()`, que descarta todo lo
    # publicado antes de `comun/temporada.INICIO`. Sin ese corte la
    # primera corrida repoblaria las hojas recien vaciadas, y no
    # fallando: funcionando.
    #
    # ⚠️ SIGUE SIN ESCRIBIR EN EL SIMULACRO. `--aplicar` va solo con
    # `--correr`, asi que `python bot/pipeline.py` a secas sigue siendo
    # seguro de correr en cualquier momento.
    #
    # ⚠️ Y CORRERLO DE VERDAD FUE LO QUE ENCONTRO TRES BUGS de esta
    # tanda: una ruta de Windows clavada, `numpy` sin declarar, y un
    # `--aplicar` que mandaba 9 columnas a una hoja de 11. Los tres
    # pasan la lectura del diff.
    #
    # ⚠️ NO PUEDE TUMBAR EL CICLO: si Discord no contesta o el parser
    # revienta, se avisa y se sigue a dibujar, que es lo que de verdad
    # tiene que pasar todas las noches.
    try:
        cmd = [sys.executable, 'bot/llaves_a_entrada.py']
        if correr:
            cmd.append('--aplicar')
        r = subprocess.run(cmd,
                           cwd=BASE, capture_output=True, text=True,
                           encoding='utf-8', errors='replace', timeout=600)
        # ⚠️ se filtran las lineas de resumen, no los encabezados: un
        # titulo sin su contenido debajo se lee como que algo se perdio.
        for l in (r.stdout or '').splitlines():
            s = l.strip()
            if s.startswith('--') or s.startswith('('):
                continue
            if any(x in s for x in ('llave(s)', 'fila(s)', 'evento(s)',
                                    'canal(es)')):
                print('      %s' % s[:96])
        if r.returncode:
            # 🔴 Y SE IMPRIME EL MOTIVO, QUE ANTES SE TIRABA. Esto decía
            # sólo «salió con 1» y mandaba el stderr a la basura, o sea
            # que informaba **que** algo falló y escondía **qué**. El
            # lector tiene un `sys.exit('...')` con mensaje —el guardián
            # de ancho de `Entrada`, que no escribe nada si la hoja ganó
            # o perdió una columna— y ese mensaje es exactamente el que
            # no llegaba.
            #
            # ⚠️ Un aviso que no se puede accionar es ruido, y el ruido
            # de todos los días entrena a no mirar. Es la misma forma que
            # las 188 alarmas falsas del `audit` del repo de sync.
            print('      ⚠️ el lector salió con %d (no frena el ciclo)'
                  % r.returncode)
            for l in (r.stderr or '').strip().splitlines()[-6:]:
                if l.strip():
                    print('         %s' % l.strip()[:96])
    except Exception as e:                               # noqa: BLE001
        print('      ⚠️ el lector no pudo correr (%s): sigo'
              % str(e)[:60])

    # 🔴 `--limpiar` NO ES OPCIONAL EN EL CICLO, Y SIN EL LOS DUELOS SE
    # DUPLICAN CADA HORA. El lector **agrega** a `Entrada`
    # (`Hoja.agregar()`), asi que cada corrida vuelve a pegar las mismas
    # llaves que Discord sigue mostrando. `resultados.guardar()` es
    # idempotente y deja `Resultados` igual —por eso no se veia— pero
    # `1v1` no: medido el 23/09/2026, el evento #350 paso de **7 duelos
    # a 14** entre dos corridas seguidas, y las batallas leidas de 29 a
    # 42. Un error que se compone, en silencio, una vez por hora.
    #
    # ⚠️ VACIAR ES SEGURO: `--limpiar` corre **despues** de verificar
    # leyendo que la escritura quedo, y la copia cruda queda siempre en
    # `datos/entrada_<fecha>.json`. Ademas la fuente de verdad es el
    # mensaje de Discord, que se vuelve a leer cada vuelta.
    if not correr:
        print('      correría sheet/procesar_entrada.py --aplicar --limpiar')
    else:
        corre(['sheet/procesar_entrada.py', '--aplicar', '--limpiar'],
              callado=False)

    # ── 1d · lo que una persona contestó en ✅ Decidir ──────────────
    #
    # 🔴 CONTESTAR TIENE QUE HACER ALGO, O NADIE CONTESTA. `Pendientes`
    # juntaba dudas y ningún proceso leía las respuestas: Dlx, 24/09/2026,
    # *«es muy confusa… por eso no la he usado»*. `sheet/decidir.py` aplica
    # lo contestado —alias a la hoja AKAs, decisiones de eventos, Discord
    # IDs— y rehace la hoja con lo que sigue abierto.
    #
    # ⚠️ Y LA HOJA AKAs SE LEE ACÁ, Y ANTES NO SE LEÍA NUNCA. `datos/akas.json`
    # sólo se rehacía corriendo `construir_akas.py` a mano: un alias que
    # alguien escribía en la hoja no llegaba al ranking. Va después de
    # Decidir —que puede agregar alias— y antes de las vitrinas, que son
    # las que fusionan por alias.
    #
    # ⚠️ NO FRENA EL CICLO. Si la hoja no contesta, las dudas esperan.
    paso('1d', 'lo contestado en ✅ Decidir, y los alias de la hoja AKAs')
    if not correr:
        print('      correría sheet/decidir.py --aplicar y '
              'sheet/construir_akas.py')
    else:
        corre(['sheet/decidir.py', '--aplicar'], callado=False)
        corre(['sheet/construir_akas.py'], callado=False)

    # ── 1c · la vitrina del Ranking, recalculada ────────────────────
    #
    # 🔴 EL EVENTO ENTRABA Y LA HOJA QUE LA GENTE MIRA QUEDABA IGUAL.
    # `CLAUDE.md` lo tiene medido celda por celda: el Sheet **no calcula
    # nada**, las cuatro hojas de ranking son una vitrina de algo
    # computado afuera. Asi que el paso 1 escribia `Resultados` y `1v1`
    # —correctamente— y `Ranking Temporada` seguia en blanco.
    #
    # Dlx lo encontro mirando: *«ha habido un evento y lo usualmente el
    # github… lo debio de agarrar y actualizar el sheet no? Pues yo lo veo
    # blanco»* (22/09/2026). Lo habia agarrado: #349, EL RAP FECHA 5, FFA.
    # Lo que no existia era este paso.
    #
    # ⚠️ VA DESPUES DE PROCESAR Y ANTES DE LOS POOLS, por el mismo motivo
    # que el paso 1 va antes que el 2: los pools se rebajan del Ranking,
    # asi que un evento procesado sin recalcular la vitrina no llega a
    # las cartas hasta el dia siguiente. Al reves seria peor: recalcular
    # antes de procesar recalcula lo de ayer.
    #
    # ⚠️ ES UNA HOJA PUBLICA y `rankings.py` no escribe si alguna columna
    # quedaria en blanco teniendo datos hoy —`sin_dueno()`—, asi que el
    # riesgo de que un recalculo automatico borre algo esta cerrado del
    # lado del escritor y no con un `if` aca.
    #
    # ⚠️ NO FRENA EL CICLO. Si la vitrina no se puede recalcular, las
    # cartas se dibujan igual con los pools que haya. Lo que no sirve es
    # no dibujar.
    # ⚠️ SON **CINCO** VITRINAS Y ESTO ESCRIBIA UNA. Dlx, 22/09/2026:
    # *«no actualizaste los demas rankings»*. Temporada se recalculaba y
    # Podios, Duelos y Mundial seguian con los numeros pegados a mano de
    # la pre-temporada — el banner de Podios todavia decia «Zignos, 99
    # pts» con la T1 ya arrancada.
    #
    # ⚠️ `Ranking de Ligas` NO ENTRA: sus columnas son `Pts FMS` y `PTB`,
    # de ligas externas. Calcularla seria inventarla.
    #
    # ⚠️ Y VAN EN DOS LLAMADAS PORQUE SON DOS CAMINOS. Temporada pasa por
    # `tabla_nueva()`, que **arrastra** las columnas que no se calculan
    # —Rango, Most Wanted—; las otras tres se calculan enteras. Meterlas
    # en el mismo flujo obligaria a que una sepa del arrastre de la otra.
    paso('1c', 'las vitrinas del Oficial')
    if not correr:
        print('      correría sheet/rankings.py --escribir --aplicar')
        print('      y sheet/rankings.py --otras --aplicar')
    else:
        corre(['sheet/rankings.py', '--escribir', '--aplicar'], callado=False)
        corre(['sheet/rankings.py', '--otras', '--aplicar'], callado=False)
        # ⚠️ Y EL LOBBY, que es la hoja que MAS se ve y la que mas
        # mentia: decia «735 raperos · 348 eventos · ultimos campeones
        # #195» con la T1 arrancada y el contador en #350. Ver
        # `sheet/lobby.py`: no rehace la maqueta, recalcula las celdas
        # que son hechos y comprueba leyendo.
        # ⚠️ LOS ANUNCIOS VAN **ANTES** DEL LOBBY, que los lee. Al revés
        # el Lobby dibuja los del ciclo anterior y nadie se entera.
        corre(['bot/anuncios.py', '--aplicar'], callado=False)
        # 🔴 EL LOBBY YA NO ES UN AFICHE: ES EL ÍNDICE DE LOS DATOS EN
        # CRUDO. Dlx, 24/09/2026: *«el hub será esta página y principalmente
        # nuestro servidor… el sheet es más que todo información raw»*. Ver
        # `sheet/indice.py`. `lobby.py` queda en el repo, pero no se llama:
        # repintaría el afiche encima del índice.
        corre(['sheet/indice.py', '--aplicar'], callado=False)

    # ── 1b · la identidad, desde Discord ────────────────────────────
    #
    # 🔴 DOS ARCHIVOS QUE DECIDEN QUIEN RECIBE CARTA Y CUAL, Y NADIE LOS
    # REFRESCABA. Los dos se escriben corriendo un script a mano:
    #
    #   `datos/verificados.json`    quien tiene el rol Miembro de DRA, o
    #                               sea el porton de identidad entero
    #   `datos/servidores_de.json`  en que servidores esta cada uno, de
    #                               donde sale que carta de Servidor le toca
    #
    # Medido el 22/09/2026: el segundo era del **19/09**, tres dias antes.
    # O sea que quien entro a FFA esa semana no tenia su carta de FFA y
    # **nada avisaba** — el ciclo corria, dibujaba y sellaba, informando
    # exito. Y el primero es peor todavia durante una prueba: alguien se
    # verifica, el archivo no se refresca, y no recibe carta hasta que
    # alguien se acuerde de correr el script.
    #
    # ⚠️ VA EN EL PIPELINE Y NO EN EL `.yml`, por la misma razon que el
    # espejo de las caras: la precondicion es **dibujar**, no «correr en
    # Actions». Puesto en el workflow queda bien para ese llamador y mal
    # para el otro.
    #
    # ⚠️ Y VA ACA Y NO EN EL REPO DE SYNC, aunque aquel hable con Discord
    # todos los dias y parezca el dueño natural de «quien es quien». Dos
    # razones medidas:
    #   · **cadencia.** Aquel corre 1 vez por dia a las 08:00 UTC y esto
    #     corre cada hora. Con el porton alla, quien se verifica a las
    #     09:00 espera 23 h por su carta; aca espera una.
    #   · **el transporte es un agujero nuevo.** Escrito alla, el archivo
    #     tendria que viajar hasta aca por algun lado, y ese salto puede
    #     quedarse viejo en silencio — que es exactamente el problema que
    #     esto viene a cerrar.
    # Lo que SI gana el otro repo es medir el mismo porton en su
    # auditoria diaria: dos cuentas independientes que tienen que dar
    # igual. Si un dia difieren, una de las dos esta mal.
    #
    # ⚠️ NO FRENA EL CICLO. Igual que el padron: la identidad de ayer
    # sirve para dibujar, y lo que no sirve es no dibujar.
    # ── 1a · la cola del bot, al Sheet ──────────────────────────────
    #
    # 🔴 «YA TE ANOTÉ — UN ADMIN TE VA A CARGAR» ERA UNA PROMESA QUE NADIE
    # CUMPLÍA. Cuando alguien corre `/card` y el bot no lo tiene, el Worker
    # le deja el ID en la cola `reg:<id>` de KV y le dice eso. El que vacía
    # esa cola es `sheet/registrar_ids.py`, **local y a mano**, y no estaba
    # en ningún ciclo.
    #
    # Medido el 22/09/2026: **21 en la cola**. Nueve ya tenían su ID —basura
    # acumulada— y **doce eran gente de verdad esperando**, ocho de ellos de
    # FFA, que es justo el servidor de la prueba. Probaron el bot, se les
    # prometió que alguien los cargaría, y nadie iba a hacerlo.
    #
    # ⚠️ SE PUEDE CORRER SOLO PORQUE EL SCRIPT YA ESTÁ HECHO PARA ESO: sólo
    # escribe el caso **inequívoco** —calza exacto y único con alguien sin
    # ID— y todo lo demás va a la hoja `Pendientes`, donde una persona lo
    # ve. Nunca pisa un ID ni adivina un match ambiguo; su propio docstring
    # cuenta por qué (9 sospechas, 6 falsas).
    #
    # ⚠️ Y VA ANTES DEL PADRÓN, que es el paso 2: al revés, el ID que se
    # acaba de cargar recién se usaría en la corrida siguiente.
    #
    # ⚠️ NO FRENA EL CICLO. Que la cola no se vacíe no impide dibujar.
    paso('1a', 'la cola del bot (`/card` de quien no está), al Sheet')
    if not correr:
        print('      correría sheet/registrar_ids.py --aplicar')
    else:
        ok = corre(['sheet/registrar_ids.py', '--aplicar'], callado=False)
        if not ok:
            print('      ⚠️ falló: la cola queda para la próxima')

    paso('1b', 'quién está verificado y en qué servidores, desde Discord')
    if not correr:
        print('      preguntaría a Discord por el rol Miembro y por los '
              'dos servidores')
    else:
        # 🔴 SE COMPARA ANTES Y DESPUES, Y UNA CAIDA GRANDE SE DESCARTA.
        # Si Discord devuelve una pagina incompleta, el porton se cierra
        # sobre gente que si esta verificada: no falla, deja de emitir
        # cartas. El mismo 20 % que usan el padron y los pools, por el
        # mismo motivo.
        import verificados as _VER
        antes_v, _ = _VER.cargar()
        try:
            import requests as _rq
            _sd = _rq.Session()
            _sd.headers['Authorization'] = 'Bot ' + _VER._env('DISCORD_TOKEN')
            nuevos, cuantos_ms = _VER.refrescar(_sd)
            if antes_v and len(nuevos) < len(antes_v) * 0.8:
                print('      🔴 los verificados pasaron de %d a %d: lo '
                      'descarto y sigo con los de ayer.'
                      % (len(antes_v), len(nuevos)))
                _VER.guardar(antes_v)
            else:
                print('      %-42s %s -> %d'
                      % ('verificados (rol Miembro en DRA)',
                         len(antes_v) if antes_v else '—', len(nuevos)))
        except Exception as e:                           # noqa: BLE001
            print('      ⚠️ verificados: %s — sigo con los de ayer'
                  % str(e)[:60])

        antes_s = 0
        p_sv = os.path.join(BASE, 'datos', 'servidores_de.json')
        if os.path.exists(p_sv):
            with io.open(p_sv, encoding='utf-8') as f:
                antes_s = len(json.load(f))
        ok = corre(['herramientas/servidores_de.py', '--json'])
        hay_s = 0
        if os.path.exists(p_sv):
            with io.open(p_sv, encoding='utf-8') as f:
                hay_s = len(json.load(f))
        if not ok:
            print('      %-42s ⚠️ falló: sigo con el de ayer'
                  % 'servidores_de.py')
        else:
            print('      %-42s %d -> %d'
                  % ('en qué servidores está cada uno', antes_s, hay_s))

    # ── 2 · los pools, desde el Sheet ───────────────────────────────
    paso(2, 'el padrón y los pools, desde el Sheet')
    if '--sin-pools' in sys.argv:
        print('      (--sin-pools: me quedo con los que hay)')
    elif not correr:
        print('      correría construir_padron, construir_pool_temporada y '
              'construir_pool_competitivo')
    else:
        # 🔴 EL PADRON VA PRIMERO, Y HASTA HOY NO ESTABA EN EL CICLO.
        # `datos/padron.json` es **la fuente de identidad** —país, crew,
        # Discord ID, verificado— y lo leen los dos builders de pool,
        # `bot/fotos.py`, `bot/paises_nuevos.py` y el resolvedor de
        # campeones por mención. Sólo se reescribía cuando alguien se
        # acordaba de correr el script.
        #
        # Medido el 22/09/2026: el archivo era del **19/09** y contra el
        # Sheet en vivo le faltaban **5 personas** —cuatro con país,
        # Discord ID y ✅— y **330 marcas de verificado**. O sea que el
        # ciclo corría solo todos los días sobre una identidad de tres
        # días antes, sin fallar.
        #
        # ⚠️ Y VA ANTES DE LOS POOLS porque los pools lo leen: al revés,
        # el padrón fresco recién se usaría al día siguiente.
        #
        # ⚠️ NO FRENA SI FALLA. La identidad de ayer sirve para dibujar;
        # lo que no sirve es no dibujar. Se avisa y se sigue — que es la
        # regla opuesta a la de los pools, y a propósito: sin pools se
        # dibujarían cartas viejas y se sellarían como nuevas.
        import construir_padron as _PAD
        # 🔴 SE GUARDA UNA COPIA ANTES, Y ESA ES LA DIFERENCIA CON LOS
        # POOLS. Ahí el guardián **frena el ciclo**, y con eso alcanza:
        # nada se dibuja ni se sella. Acá el ciclo sigue, así que un
        # padrón roto se usaría para dibujar. Detectarlo sin poder
        # deshacerlo sería avisar de un daño ya hecho.
        viejo_p = None
        if os.path.exists(_PAD.SALIDA):
            with io.open(_PAD.SALIDA, encoding='utf-8') as f:
                viejo_p = f.read()
        antes_p = len(_PAD.cargar())
        ok = corre(['sheet/construir_padron.py'])
        hay_p = len(_PAD.cargar())
        if not ok:
            print('      %-42s ⚠️ falló: sigo con el de ayer'
                  % 'sheet/construir_padron.py')
        elif antes_p and hay_p < antes_p * 0.8:
            # el mismo umbral que los pools, por el mismo motivo: un
            # padrón de tres personas no se lee como un error, se lee
            # como que se fue la Liga entera.
            print('      🔴 el padrón pasó de %d a %d: lo descarto y '
                  'sigo con el de ayer.' % (antes_p, hay_p))
            if viejo_p is not None:
                with io.open(_PAD.SALIDA, 'w', encoding='utf-8') as f:
                    f.write(viejo_p)
        else:
            print('      %-42s %d -> %d'
                  % ('sheet/construir_padron.py', antes_p, hay_p))

        # 🔴 SE MIDE EL POOL ANTES Y DESPUES, Y UNA CAIDA GRANDE FRENA.
        #
        # Los builders **pisan** `datos/*.json`. Si el Sheet esta a medio
        # editar, o una hoja se renombro, o la API devuelve una pagina
        # incompleta, el builder puede terminar con codigo 0 y dejar un
        # pool de tres personas. Y eso no se ve como un error: el ciclo
        # lo lee como «135 personas se fueron del pool», no redibuja nada
        # de ellas, y **sella** el estado nuevo. La proxima corrida ya no
        # ve la diferencia.
        #
        # ⚠️ Es la forma que este repo documenta tres veces —lo viejo
        # dado por bueno— pero al reves y peor: acá lo NUEVO es lo roto,
        # y queda sellado como bueno.
        #
        # Un pool puede encoger de verdad (alguien deja de cumplir el
        # requisito), asi que el corte no es «cualquier caida» sino una
        # grande: **20 %**. Por debajo pasa y se avisa.
        antes = {n: len(_pool(n)) for n in ('temporada', 'competitivo')}
        for s in ('sheet/construir_pool_temporada.py',
                  'sheet/construir_pool_competitivo.py'):
            # ⚠️ EL CHEQUEO «¿EL # DE LA CARTA ES EL DEL RANKING?» SE MUESTRA.
            # No frena —un puesto distinto no justifica dejar sin cartas a
            # nadie— pero callado no lo veía nadie.
            ok = corre([s], mostrar=('el puesto de cada carta',
                                     'la carta y el ranking no dan'))
            print('      %-42s %s' % (s, 'ok' if ok else '🔴 falló'))
            if not ok:
                # ⚠️ SIN POOLS NO SE SIGUE. Dibujar con los de ayer sube
                # cartas viejas y las sella como nuevas, que es peor que
                # no correr: el proximo ciclo ya no ve la diferencia.
                print('\n   🔴 sin pools frescos no sigo.\n')
                return 1
        for n, hubo in antes.items():
            hay = len(_pool(n))
            if hubo and hay < hubo * 0.8:
                print('\n   🔴 el pool de %s pasó de %d a %d (-%.0f %%).'
                      % (n, hubo, hay, 100.0 * (hubo - hay) / hubo))
                print('      Eso no parece un cambio real: no sigo. Mirá el')
                print('      Sheet, y si la caída es de verdad corré con')
                print('      `--sin-pools` una vez para aceptarla.\n')
                return 1
            if hay != hubo:
                print('      %-42s %d -> %d' % (n, hubo, hay))

    # ── 2c · la web, que es lo que ve el que no abre Discord ────────
    #
    # 🔴 ESTE PASO FALTABA Y LA WEB SE QUEDABA VIEJA EN SILENCIO. Medido
    # el 23/09/2026, justo después de un ciclo que dio verde: el pool
    # pasó de **45 a 54** personas y `underlegends.pages.dev` siguió
    # diciendo «45 raperos» y mostrando el ranking de antes. Nada falló
    # —la página respondía 200 con un payload perfectamente válido, sólo
    # que de hace una hora—, que es la forma exacta que este repo
    # documenta una y otra vez.
    #
    # ⚠️ VA ANTES DEL PASO 3, NO AL FINAL, porque la web NO depende de
    # que se dibuje ninguna carta: muestra el pool y los eventos
    # anunciados. Ponerlo junto a la subida de PNG lo dejaría afuera de
    # la rama de «nada cambió» —donde igual puede haber un evento nuevo
    # que anunciar— y lo haría depender de una precondición que no es la
    # suya. Es lo mismo que ya se decidió con el espejo de fotos.
    #
    # ⚠️ Y ES UN DIFF-WRITER: si el payload sale igual al que está en KV
    # no escribe. KV da 1.000 escrituras por día.
    if correr:
        paso('2c', 'la web')
        corre(['bot/subir_web.py', '--aplicar'], callado=False)

        # 🔴 Y EL SITIO EN SI, QUE HASTA HOY NO SE DESPLEGABA SOLO.
        # Cloudflare Pages está conectado al repo **privado**, así que
        # desde que el trabajo se mudó al público ningún cambio del hub
        # llegaba — y no fallaba: la página seguía viva con su HTML del
        # día que alguien pusheó allá mientras este paso le refrescaba el
        # payload cada media hora. **Las dos mitades de la misma página
        # con dos edades distintas.**
        #
        # ⚠️ SOLO CUANDO EL SITIO CAMBIO. Un despliegue por corrida serían
        # ~48 por día para publicar los mismos cinco archivos. El sello es
        # el hash de `bot/paginas/`, que es la misma idea que
        # `comun/huella_codigo.py` con otra carpeta.
        try:
            hs = hashlib.sha256()
            d = os.path.join(SCR, 'paginas')
            for raiz, _ds, _fs in os.walk(d):
                for f in sorted(_fs):
                    hs.update(f.encode())
                    hs.update(io.open(os.path.join(raiz, f), 'rb').read())
            h = hs.hexdigest()[:16]
            p = os.path.join(BASE, 'datos', 'web_sello.json')
            viejo = ''
            if os.path.exists(p):
                viejo = (json.load(io.open(p, encoding='utf-8'))
                         or {}).get('hash', '')
            if h != viejo:
                print('      el sitio cambió: desplegando')
                if corre(['bot/paginas_subir.py', '--aplicar'], callado=False):
                    json.dump({'hash': h, 'cuando': time.strftime(
                        '%Y-%m-%dT%H:%M:%S')},
                        io.open(p, 'w', encoding='utf-8', newline='\n'))
            else:
                print('      el sitio no cambió: no lo despliego')
        except Exception as e:                               # noqa: BLE001
            # ⚠️ NO PUEDE TUMBAR EL CICLO. Lo que de verdad tiene que pasar
            # todas las noches es dibujar; que el hub quede una corrida
            # atrás es molesto y no es una caída.
            print('      ⚠️ no pude desplegar el sitio: %s' % str(e)[:90])

    # ── 2 · que cambio ──────────────────────────────────────────────
    paso(3, 'qué cambió')
    import que_cambio as QC
    if not QC.por_campo():
        print('      🔴 falta datos/campos_por_carta.json — corré')
        print('         python herramientas/que_pide_cada_carta.py')
        return 1
    motivos = []
    cam, nuevas, idas, hay_sello = QC.cambios(motivos)
    # ⚠️ DECIR **POR QUE** SON TANTAS. Una corrida que toca 138 personas
    # de golpe puede ser un cambio de codigo —normal y correcto— o el
    # Sheet a medio editar. Sin esta linea las dos se ven igual, y la
    # primera reaccion ante «552 cartas» es cancelar.
    for carta, (n_datos, cod) in sorted((motivos[0] if motivos else {}).items()):
        if cod:
            print('      ⚠️ cambió el CÓDIGO de la %s: le toca a todo el '
                  'pool' % carta)
            print('         (%d de ellas además cambiaron de datos)' % n_datos)
    if not hay_sello:
        print('      no hay sello anterior: la primera corrida sella y no')
        print('      dibuja nada. `python bot/que_cambio.py --sellar`')
        return 1

    trabajo = {}
    # ⚠️ A UNA PERSONA NUEVA TAMPOCO SE LE PIDEN LAS CUATRO A CIEGAS: si
    # no tiene pais, su carta de Pais no se emite —«sin dato no hay
    # pieza»— y pedirla es un fallo permanente que se reintenta todos
    # los dias. Ver `que_cambio.emitibles()`.
    for quien in nuevas:
        trabajo[quien] = QC.emitibles(quien)
    for quien, cs in cam.items():
        trabajo.setdefault(quien, set()).update(cs)

    if idas:
        print('      %d ya no está(n) en el pool (su carta queda en R2): %s'
              % (len(idas), ', '.join(idas[:6])))
    if not trabajo:
        print('      ✅ nada cambió en las cuatro cartas')
        _avisar_actions(False, 0, 0)
        # ⚠️ PERO LAS BLOQUEADAS SE MIRAN IGUAL. Ver rehacer_bloqueadas():
        # su contador puede moverse sin que se mueva ninguna carta.
        n_bq = rehacer_bloqueadas() if correr else 0
        if n_bq:
            corre(['bot/subir_datos.py'], callado=False)
        print('\n   listo en %.1f s · %s\n'
              % (time.time() - t0,
                 '%d Bloqueada(s) al día' % n_bq if n_bq
                 else 'no había nada que hacer'))
        return 0
    n_cartas = sum(len(v) for v in trabajo.values())

    # 🔑 ACA TERMINA EL TRABAJO BARATO Y EMPIEZA EL CARO, Y POR ESO SE
    # PUEDE CORTAR JUSTO ACA. Todo lo de arriba —leer Discord, escribir
    # el Sheet, rebajar los pools, refrescar KV y la web— son **segundos**
    # y no necesitan navegador. De acá para abajo se dibuja, y una corrida
    # que dibuja puede tardar dos horas.
    #
    # 🔴 Y ESO NO ES SOLO PLATA: ES FRESCURA. El `concurrency` del
    # workflow encola, así que mientras un redibujo de dos horas corre,
    # **nadie escucha Discord**. Con el corte, escuchar sale cada media
    # hora pase lo que pase y dibujar va aparte.
    #
    # ⚠️ SE IMPRIME EN EL FORMATO QUE ACTIONS LEE (`name=value` a
    # `$GITHUB_OUTPUT`) porque el que decide si arranca el job de dibujar
    # es el workflow, no este proceso. Sin esto habría que parsear el log,
    # que es la clase de acople que se rompe el día que alguien cambia una
    # palabra del mensaje.
    if '--sin-dibujar' in sys.argv:
        print('\n   ✋ --sin-dibujar: %d persona(s) y %d carta(s) quedan '
              'para el próximo paso' % (len(trabajo), n_cartas))
        _avisar_actions(True, len(trabajo), n_cartas)
        print('\n   listo en %.1f s\n' % (time.time() - t0))
        return 0

    # ⚠️ ARRIBA DE ~50 PERSONAS ESTE CAMINO ES EL LENTO, Y CONVIENE
    # DECIRLO. Aca se dibuja **una carta por proceso**, o sea que arrancar
    # Chromium se paga 13 veces por persona: 1,7 min cada una, 235 para
    # las 138. Los scripts en tanda levantan **un solo Chromium** y hacen
    # lo mismo en ~95 (`generar_todas.py` 23 + `tanda_servidores.py` 72).
    #
    # Se cruzan cerca de 56 personas. Por debajo gana este camino —no
    # redibuja a nadie de mas—; por encima gana la tanda.
    #
    # ⚠️ NO SE CAMBIA DE CAMINO SOLO. Seguir igual **siempre avanza**:
    # cada tanda queda sellada, asi que aunque tarde varias corridas
    # nunca se traba. Saltar a otro camino con otra forma de subir y de
    # sellar seria un segundo flujo que casi nunca corre — y un flujo que
    # casi nunca corre es uno que no esta probado el dia que hace falta.
    if len(trabajo) > 50:
        print('      ⚠️ son muchas: por acá son ~%.0f min (1,7 por persona).'
              % (len(trabajo) * 1.7))
        print('         Más rápido a mano, con un solo Chromium (~95 min):')
        print('         python bot/generar_todas.py && '
              'python bot/tanda_servidores.py')
        print('         Igual sigo: cada tanda queda sellada y esto avanza.')
    print('      %d persona(s) · %d carta(s)' % (len(trabajo), n_cartas))
    for quien in sorted(trabajo)[:10]:
        print('         %-18s %s' % (quien, ', '.join(sorted(trabajo[quien]))))
    if len(trabajo) > 10:
        print('         … y %d más' % (len(trabajo) - 10))

    # ── 3 a 7 · POR TANDAS, SELLANDO CADA UNA ──────────────────────
    #
    # 🔴 EN TANDAS PORQUE SI NO **SE TRABA SOLO**. Medido el 21/09/2026:
    # una persona son **1,7 min** —sus 4 cartas mas las 9 por servidor,
    # un proceso por carta—. El job de Actions corta a los 30, o sea que
    # arriba de **17 personas** muere en el medio. Y como el sello iba al
    # final, no sellaba nada: la corrida siguiente rehacia TODO y volvia
    # a morir en el mismo lugar. Para siempre.
    #
    # ⚠️ Y NO ES UN CASO EXTREMO: el Score sale del ranking del pool
    # entero, asi que el primer evento de la T1 le cambia el Score a
    # **todos**. La corrida mas comun de las grandes era justo la que se
    # trababa.
    #
    # Con tandas, cada una que termina queda **subida y sellada**: una
    # corrida cortada pierde como mucho la tanda en curso y la siguiente
    # arranca donde quedo. Avanza siempre.
    if not correr:
        paso(5, 'dibujar')
        print('      dibujaría %d carta(s) de %d persona(s)'
              % (n_cartas, len(trabajo)))
        # 🔴 LA ESTIMACION SALE DE `SEG_POR_PERSONA`, NO DE UN 1,7
        # ESCRITO ACA. Ese 1,7 quedo de cuando se dibujaba una carta por
        # proceso, y al batear la tanda siguio anunciando **542 minutos**
        # de un trabajo de 70 — o sea que el simulacro, que existe para
        # decidir si conviene correr, mentia por 8x en la direccion mas
        # asustadora. Un numero escrito a mano al lado de uno medido.
        # ⚠️ Y LA SERVIDOR CUENTA POR DIEZ. Es la propia mas una por
        # servidor, asi que contarla como una subestima el trabajo diez
        # veces — que es el mismo error que el 1,7 escrito a mano, dado
        # vuelta. La primera version de esta linea decia «7 min» de un
        # trabajo de 70.
        pasadas = sum(len(SERVIDORES) + 1 if c == 'servidor' else 1
                      for cs in trabajo.values() for c in cs)
        print('      en %d tanda(s) de hasta %d · %d pasada(s) · ~%.0f min'
              % ((len(trabajo) + POR_TANDA - 1) // POR_TANDA, POR_TANDA,
                 pasadas, pasadas * SEG_POR_CARTA / 60.0 / PARALELO))
        print('\n   (simulacro: no toqué nada — corré con --correr)\n')
        return 0

    # 🔴 LAS CARAS, ANTES DE DIBUJAR. Sin esto el runner dibuja **15 de
    # 138**. `comun/respaldo.py` busca la foto en dos lugares:
    # `03_Servidor/disenos/_avatares/` —versionado, 116 MB— y
    # `comun/fotos/<temporada>/` —el espejo de R2, **gitignoreado**—. Un
    # clone limpio trae el primero y no el segundo, asi que hoy la nube
    # depende de que 422 fotos de personas reales vivan en el historial
    # de git, que es exactamente lo que `CLAUDE.md` prohibe para la otra
    # carpeta. Con el espejo, R2 pasa a ser la fuente y el repo puede
    # soltarlas. Medido el 21/09/2026: **112 de 138 con `_avatares/` y
    # 112 sin el**.
    #
    # ⚠️ VA ACA Y NO EN EL WORKFLOW, y la diferencia es cual es la
    # precondicion de que. Lo que necesita las caras es **dibujar**, no
    # «correr en Actions»: puesto en el .yml queda bien para ese llamador
    # y mal para el otro —una persona con el repo recien clonado corre
    # `pipeline.py --correr` y saca cartas con la inicial, sin que nada
    # avise—. Ademas cuesta 34 s y el 97 % de las corridas no dibuja
    # nada: aca ya pasamos el `return 0` de «nada cambió», asi que solo
    # se paga el dia que sirve.
    #
    # ⚠️ NO CORTA LA CORRIDA SI R2 NO CONTESTA. Una carta con la inicial
    # es peor que con la cara y muchisimo mejor que no tener carta.
    paso(4, 'las caras, desde R2')
    hace_falta_el_navegador()
    bajar_las_caras()

    os.makedirs(SALIDA, exist_ok=True)
    gente = sorted(trabajo)
    tandas = [gente[i:i + POR_TANDA]
              for i in range(0, len(gente), POR_TANDA)]
    subidas, sellados, fallaron = 0, [], []

    for nt, lote in enumerate(tandas, 1):
        paso(5, 'tanda %d de %d · %d persona(s)'
             % (nt, len(tandas), len(lote)))
        corte = time.time() - 2
        malos = set()

        # 🔴 UNA LLAMADA POR CARTA Y POR TANDA, NO POR PERSONA. Los cuatro
        # generadores aceptan varios nombres desde siempre y este paso los
        # llamaba **de a uno**. Lo caro no es dibujar, es arrancar
        # Chromium. Medido el 22/09/2026 con `03_Servidor/generar.py`:
        #
        #     nombres   s/persona
        #        1        6.50
        #        5        1.91
        #       20        1.41
        #       60        1.34
        #
        # ⚠️ Y LA SERVIDOR SON DIEZ LLAMADAS POR PERSONA —la propia mas
        # nueve servidores—, asi que cada persona pagaba **diez arranques**
        # para ~13 s de dibujo: los 1,7 min por persona que el encabezado
        # de este archivo da por sentados.
        #
        # 🔴 Y ESO NO ERA TEORICO. Hoy el sello marco las **319** para
        # redibujar —cambio la huella de codigo, no los datos— y el
        # simulacro anuncio **542 minutos**, sobre 2.000 al mes. La corrida
        # en la nube habria gastado sus 120 de timeout sin terminar, **cada
        # hora**. Con la tanda entera, esas mismas 319 son ~70 min.
        #
        # ⚠️ EL EXITO SE MIRA EN EL ARCHIVO, NO EN EL CODIGO DE SALIDA. Con
        # una llamada por persona alcanzaba con el `returncode`; con diez
        # nombres adentro, una que no salga no lo cambia. Es la regla de
        # este repo —contar lo que salio— aplicada donde antes no hacia
        # falta.
        por_carta = {}
        for quien in lote:
            for c in trabajo[quien]:
                por_carta.setdefault(c, []).append(quien)
        llamadas = []
        for c, quienes in sorted(por_carta.items()):
            print('      %-12s %d persona(s)' % (c, len(quienes)))
            llamadas.append(list(COMO[c][0]) + sorted(quienes))
            if c == 'servidor':
                # ⚠️ la Servidor son DIEZ: la propia y una por servidor,
                # porque `/card` abre en la del servidor donde escribiste.
                #
                # 🔴 Y SUS FALLOS CUENTAN. Antes se ignoraba el resultado
                # de estas nueve: si fallaban, la persona se sellaba igual
                # —su carta «servidor» habia salido— y sus nueve `sv-*`
                # quedaban viejas **para siempre**, porque el sello no
                # vuelve a marcarlas como pendientes.
                llamadas += [list(COMO[c][0]) + sorted(quienes)
                             + ['--sv=%s' % sv] for sv in SERVIDORES]
        # ⚠️ TODAS LAS PASADAS DE LA TANDA A LA VEZ, y RECIÉN DESPUÉS se
        # cuenta lo que salió. Ver `PARALELO`: el éxito se sigue mirando
        # en el archivo y no en el código de salida, igual que antes.
        from concurrent.futures import ThreadPoolExecutor
        t_tanda = time.time()
        with ThreadPoolExecutor(max_workers=PARALELO) as ex:
            list(ex.map(corre, llamadas))
        print('      %d pasada(s) en %.1f min, de a %d'
              % (len(llamadas), (time.time() - t_tanda) / 60, PARALELO))
        for c, quienes in sorted(por_carta.items()):
            faltan = no_salieron(c, quienes, corte)
            for quien, que in faltan:
                malos.add(quien)
                fallaron.append('%s/%s' % (quien, que))
            if faltan:
                print('         ⚠️ %s: %d no salió/salieron' % (c, len(faltan)))

        # ⚠️ EL MTIME Y NO EL NOMBRE. Una carta vieja de la misma persona
        # se llama igual que la nueva: es el bug que tenian generar_todas,
        # tanda_servidores y subir_cartas el 20/09.
        frescos = []
        for _c, (_, carpeta, _pref) in COMO.items():
            d = os.path.join(BASE, carpeta)
            if os.path.isdir(d):
                frescos += [f for f in glob.glob(os.path.join(d, '*.png'))
                            if os.path.getmtime(f) >= corte]
        print('      %d PNG' % len(frescos))
        if not frescos:
            print('      🔴 ni un PNG en esta tanda: no subo ni sello')
            continue

        # ⚠️ `--sin-subir` DIBUJA Y NO PUBLICA, y existe para poder probar
        # la cadena entera sin poner una carta en produccion. Sin el, la
        # unica forma de verificar el ciclo es subir algo de verdad — y
        # para provocar un cambio hay que tocar el pool, o sea publicar
        # una carta con un dato inventado. Tampoco sella ni borra: no se
        # puede decir «esto ya se dibujo» de algo que no se subio.
        if '--sin-subir' in sys.argv:
            print('      (--sin-subir: %d PNG quedaron en su carpeta, '
                  'no subí ni sellé)' % len(frescos))
            continue

        # ⚠️ LA SUBIDA TAMBIEN EN LOTES. Windows corta la linea de
        # comandos en 32.768 caracteres y cada ruta absoluta mide ~86:
        # arriba de unas 380 revienta con un error del sistema operativo
        # que no dice nada util. Medido: 552 archivos son 47.472.
        ok = True
        for i in range(0, len(frescos), POR_SUBIDA):
            if not corre(['bot/subir_cartas.py']
                         + frescos[i:i + POR_SUBIDA], callado=False):
                ok = False
                break
        if not ok:
            print('      🔴 la subida falló: NO sello esta tanda. El '
                  'próximo ciclo la reintenta.')
            continue
        subidas += len(frescos)

        # 🔴 SELLAR DESPUES DE SUBIR, Y SOLO A LOS QUE SALIERON BIEN. Al
        # reves, una corrida cortada deja el sello diciendo que todo se
        # dibujo y los cambios se pierden para siempre.
        #
        # ⚠️ Se le pasa la lista ACUMULADA y no solo la de esta tanda:
        # `sellar(solo=...)` parte del sello que hay en disco, asi que
        # pasarle unicamente el lote de ahora funciona igual — pero si
        # alguna vez deja de partir del previo, esto sigue siendo
        # correcto. Es la version que no depende de ese detalle.
        bien = [q for q in lote if q not in malos]
        if bien:
            sellados += bien
            QC.sellar(sorted(set(sellados)))
            print('      ✅ sellé %d de %d' % (len(bien), len(lote)))
        if malos:
            print('      %d sin sellar (falló alguna carta): se reintenta'
                  % len(malos))

        # R2 es la copia que importa; el disco es un intermedio. La misma
        # regla que sigue `bot/tanda_servidores.py`, y no es solo espacio:
        # un PNG viejo con el mismo nombre que el nuevo es exactamente la
        # trampa que causo los tres bugs de conteo del 20/09.
        for f in frescos:
            try:
                os.remove(f)
            except OSError:
                pass

    subidas += rehacer_bloqueadas()

    # ── KV, UNA SOLA VEZ AL FINAL ──────────────────────────────────
    # ⚠️ Es un diff-writer y KV da 1.000 escrituras por dia: llamarlo por
    # tanda reescribiria `meta` una vez por tanda para nada. Lo que
    # guarda —que cartas tiene cada uno— queda bien con la ultima.
    if subidas:
        paso(6, 'refrescar KV')
        corre(['bot/subir_datos.py'], callado=False)
        # 🔴 Y LA WEB OTRA VEZ, CON LAS CARTAS YA NUEVAS. La web se sube al
        # escuchar —antes de dibujar— y marca como «actualizándose» las
        # cartas cuyo dato cambió; sin esta vuelta la marca quedaba hasta
        # el ciclo siguiente, media hora después de que la carta ya
        # estaba bien. Y lleva la versión nueva de cada carta (`?v=`), que
        # es lo que hace que el navegador pida la imagen nueva.
        corre(['bot/subir_web.py', '--aplicar'], callado=False)

    if fallaron:
        print('\n   🔴 %d carta(s) fallaron: %s'
              % (len(fallaron), ', '.join(fallaron[:8])))
    print('\n   listo en %.1f min · %d carta(s) subida(s) · %d de %d '
          'persona(s) selladas'
          % ((time.time() - t0) / 60, subidas, len(sellados), len(trabajo)))
    faltan = len(trabajo) - len(sellados)
    if faltan:
        print('   el próximo ciclo sigue con las %d que faltan\n' % faltan)
    else:
        print('')
    return 0


if __name__ == '__main__':
    sys.exit(main())
