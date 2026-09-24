# -*- coding: utf-8 -*-
"""QUE SALE Y QUE NO SALE SI EL REPO SE HACE PUBLICO.

    python herramientas/repo_publico.py            el inventario
    python herramientas/repo_publico.py --armar D  arma el arbol limpio en D

POR QUE
-------
Actions es **gratis e ilimitado** en un repo publico y son **2.000 min/mes** en
uno privado. Medido el 24/09/2026: **1.806 min en tres dias**. O sea que esto
no es una optimizacion, es la unica salida — y cuando el plan se agota los
workflows no se ponen lentos, **se detienen**.

🔴 **LA LISTA NO SE ESCRIBE A MANO, Y ESA ES TODA LA GRACIA.** Un inventario a
mano es exactamente el bug que este repo persigue en cinco lugares de
CLAUDE.md: la decision vive en un archivo que nadie vuelve a mirar y el proximo
archivo que entra no esta en ninguna lista. Aca la regla es al reves:

    **sale todo, menos lo que una regla explicita saca** — y despues se
    VERIFICA que lo que quedo no tenga secretos ni caras.

⚠️ Una lista blanca seria mas segura contra filtraciones y peor contra el otro
error: un archivo nuevo de codigo se quedaria afuera **en silencio** y el
workflow se rompe en el runner. La lista negra falla del lado ruidoso.

⚠️ **Y NO ALCANZA CON QUE `.gitignore` YA LOS IGNORE.** `herramientas/
secretos_en_git.py` comprueba el repo de hoy; esto comprueba **el arbol que se
va a publicar**, que es otro arbol. Las dos preguntas se parecen y no son la
misma.

LO QUE SACA, Y POR QUE CADA COSA
--------------------------------
=== credenciales ===
Los cuatro de siempre. Ya estan en `.gitignore`, asi que sacarlos aca es
cinturon y tirantes — pero el costo de equivocarse es rotar todo.

=== caras de personas reales ===
`03_Servidor/disenos/_avatares/` son **421 fotos** de gente de la Liga,
**versionadas**, 116 MB. En un repo privado son un respaldo; en uno publico son
421 fotos de personas que no eligieron eso, permanentes en el historial de git
tambien para quien despues se vaya.

⚠️ **Y NO SE PIERDE NADA MEDIBLE.** Ya se midio el 22/09: los 7 avatares que
estan en git y **no** en R2 fallan el porton de identidad, o sea que hoy no
pueden tener carta. El ciclo baja el espejo de R2 como paso propio.

=== lo generado ===
`salida/`, `**/salida/`, los PNG y los HTML de muestra. Se vuelven a hacer
corriendo el generador, y son la mitad del peso.

LO QUE **NO** SACA Y HAY QUE DECIDIR A MANO
-------------------------------------------
🔑 **Los IDs de Discord.** `datos/` trae ~2.000 IDs de usuario repartidos en
`servidores_de.json` (1.803), `padron.json` (266) y unos pocos mas. Un ID de
Discord **no es un secreto** —lo ve cualquiera en el servidor— pero una lista
de 1.800 en un repo publico es raspable, y con el padron al lado queda un
perfil: nombre, pais, servidor, puntaje.

⚠️ **No lo decide este script.** Los cuenta, los nombra y se planta si nadie
contesto: `--con-ids` los publica, `--sin-ids` los deja afuera. Sin una de las
dos no arma nada, porque el default silencioso seria justamente publicar.

⚠️ **Y sacarlos tiene un precio que conviene saber antes**: el ciclo los
necesita —`servidores_de.json` mapea cada ID a su servidor— asi que el repo
publico tendria que bajarlos de algun lado en cada corrida.
"""
import io
import json
import os
import re
import shutil
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

#: 🔴 NUNCA SALE, POR SEGURIDAD O POR LAS PERSONAS. Tocar esta lista es una
#: decision de seguridad y cuesta rotar credenciales o publicar la cara de
#: alguien que no lo eligio.
PRIVADO = (
    ('creds.json', 'la cuenta de servicio del Sheet'),
    ('oauth_client.json', 'el client_secret del OAuth'),
    ('.env', 'los tokens'),
    ('oauth_token.json', 'el OAuth del Apps Script'),
    ('ACCESOS.md', 'el inventario de credenciales'),
    ('03_Servidor/disenos/_avatares/', '421 fotos de gente de la Liga'),
    ('03_Servidor/disenos/av_valen.png', 'la foto de Valen'),
    # 🔑 LA UNICA CARTA RENDERIZADA QUE NO SALE, Y NO ES UNA REGLA GENERAL.
    # Las otras 21 si salen: una carta es el producto, va a Discord y ya se
    # sirve desde el bucket publico de R2, asi que publicarla no da nada
    # nuevo. Esta es distinta por un motivo concreto — CLAUDE.md documenta
    # que la URL del avatar de Valen da 404, o sea que **esa persona cambio
    # su foto** y este archivo es la ultima copia que queda de la anterior.
    #
    # ⚠️ Publicar una cara que su dueño ya se saco si agrega algo. Es el
    # unico de los 22 donde lo sabemos, y sale gratis: nadie lo lee
    # —`v11_marcos.py` solo lo nombra en un comentario, y lee `av_valen.png`.
    ('03_Servidor/Valen_servidor.png', 'la carta con la foto que Valen cambió'),
    ('comun/fotos/', 'el espejo de R2, fotos de personas'),
)

#: ⚠️ NO SALE PORQUE UN GENERADOR LO VUELVE A HACER, y eso es una decision de
#: TAMAÑO, no de seguridad. Se separa de `PRIVADO` a proposito: quien quiera
#: recuperar la galeria tiene que poder hacerlo sin sentir que esta tocando un
#: candado.
#:
#: 🔴 Y NO ES UN DETALLE: medido el 24/09/2026, sin esta lista el arbol publico
#: pesa **1.681 MB**, y **1.084 de esos son `03_Servidor/disenos`** — las hojas
#: de exploracion de la carta Servidor, que son PNG de 12 MB cada una. El
#: codigo entero del proyecto son unas decenas de MB.
#:
#: ⚠️ Se van los PNG y los HTML, se quedan los `.py` y los `.md`. Lo que
#: explica una decision vale; la imagen que la ilustro la vuelve a sacar el
#: script que esta al lado.
GENERADO = (
    ('salida/', 'se regenera'),
    ('galeria/', 'hojas de galeria · las rehace cada generar.py'),
    ('__pycache__/', 'basura de Python'),
    ('.pytest_cache/', 'idem'),
    # 🔴 SOLO EL NIVEL 1, Y ESTE `[^/]+` ES UN BUG QUE YA PASO. La primera
    # version era `.*\.(png|html)$` y se llevo tambien
    # `03_Servidor/disenos/texturas/`, que son **insumos**: `los_nueve.tx()`
    # las lee para armar los nueve fondos, y sin ellas el generador de
    # produccion de la Servidor no arranca.
    #
    # ⚠️ Lo encontro `herramientas/puedo_generar.py` corriendo el generador
    # de verdad en el arbol nuevo — leer la regex no lo encuentra, porque
    # `.*` se ve bien hasta que sabes que hay subcarpetas. Las tres de
    # `disenos/` son `_avatares/` (fotos, fuera por PRIVADO),
    # `_respaldo_405/` y `texturas/` (insumos, se quedan).
    (re.compile(r'^03_Servidor/disenos/[^/]+\.(png|html)$'),
     'hojas de exploracion de la Servidor · 1.084 MB'),
    (re.compile(r'^04_Pais/_.*\.html$'),
     'hojas comparativas de Pais · las rehace maqueta.py'),
    (re.compile(r'^04_Pais/(fondos|maqueta|ver_fondos)\.png$'),
     'hojas de Pais · las rehace maqueta.py'),
    # 🔴 NIVEL 1 OTRA VEZ, POR EL MISMO MOTIVO: `v2/estilos/` son los **16
    # iconos de estilo**, insumos que `todos_sv.estilo_img()` lee y que
    # `herramientas/extraer_estilos.py` produjo una vez. La version con `.*`
    # se los llevaba y la carta Servidor no arrancaba.
    #
    # ⚠️ TRES VECES EL MISMO BUG EN UNA SESION —texturas, estilos, y el
    # `.*` original— asi que ahora las subcarpetas estan MIRADAS, no
    # supuestas. Las de `v2/` son `estilos/`; las de `04_Pais/` son
    # `banderas/`, `banderas_carta/` y `referencia/`; las de `disenos/` son
    # `_avatares/`, `_respaldo_405/` y `texturas/`. **Ninguna es salida de
    # un generador**, asi que ninguna regla de GENERADO debe cruzar un `/`.
    (re.compile(r'^02_Competitivo/v2/[^/]+\.(png|html)$'),
     'hojas de la Competitiva · las rehace gencomp.py'),
)

#: Lo que `--armar` le agrega al `.gitignore` del árbol nuevo.
#:
#: ⚠️ ES LA MISMA DECISION QUE `PRIVADO` Y `GENERADO`, ESCRITA EN EL IDIOMA DE
#: GIT. No se puede derivar de esas dos listas —una trae regex de Python y git
#: quiere globs— así que van al lado y se comprueba distinto: después de
#: commitear el árbol nuevo, `git status` tiene que quedar limpio. Si algo
#: falta acá, aparece ahí.
IGNORAR = u'''
# ── agregado por herramientas/repo_publico.py ──
# Lo que este repo dejó de llevar a proposito. Las dos primeras son por
# PERSONAS —fotos de gente real— y el resto es peso que un generador rehace.
03_Servidor/disenos/_avatares/
03_Servidor/disenos/av_valen.png
comun/fotos/
galeria/
03_Servidor/disenos/*.png
03_Servidor/disenos/*.html
04_Pais/_*.html
04_Pais/fondos.png
04_Pais/maqueta.png
04_Pais/ver_fondos.png
# ⚠️ UN SOLO `*` Y NUNCA `**`: en git `*` no cruza `/`, asi que estas cuatro
# lineas tocan el nivel 1 y dejan en paz `v2/estilos/`, `disenos/texturas/` y
# `disenos/_respaldo_405/`, que son INSUMOS. Con `**` se van y la carta
# Servidor no arranca — paso tres veces el 24/09/2026.
02_Competitivo/v2/*.png
02_Competitivo/v2/*.html
'''

#: Archivos que llevan IDs de Discord. No se sacan solos: ver el docstring.
_ID = re.compile(r'\b1[0-9]{17,18}\b')


def rel(p):
    return os.path.relpath(p, BASE).replace('\\', '/')


def privado(r):
    """`(motivo, es_seguridad)` si esa ruta no sale, o `(None, False)`."""
    for lista, seg in ((PRIVADO, True), (GENERADO, False)):
        for pat, por in lista:
            if hasattr(pat, 'search'):
                if pat.search(r):
                    return por, seg
            elif pat.endswith('/'):
                if r.startswith(pat) or pat.rstrip('/') in r.split('/'):
                    return por, seg
            elif r == pat or r.endswith('/' + pat):
                return por, seg
    return None, False


def arbol():
    """`(sale, fuera, sin_decidir)` — y la lista sale de **git**.

    🔴 CAMINAR EL DISCO NO ES CAMINAR EL REPO, Y ESO CASI PUBLICO UN
    SECRETO. La primera version usaba `os.walk` y encontro
    `oauth_client.json` —el `client_secret` del OAuth, vivo— listo para
    copiarse al arbol publico. Esta **ignorado** en `.gitignore:168`, o
    sea que nunca estuvo en el repo: lo unico que lo metia era mi
    herramienta.

    ⚠️ La autoridad de «que hay en el repo» es `git ls-files`, no el
    sistema de archivos. Es la misma leccion que este proyecto ya tiene
    escrita tres veces: *contar lo que hay en disco no es contar lo que
    salio*.

    ⚠️ **Y LO QUE NO ESTA EN NINGUNA DE LAS DOS SE INFORMA APARTE.** Un
    archivo que existe, no esta trackeado y **tampoco** ignorado es
    ambiguo: al armar el arbol nuevo con `git init` entraria. Se lista
    como `sin_decidir` en vez de decidirlo yo.
    """
    import subprocess

    def _git(*a):
        # 🔴 `-z` Y NO SALTOS DE LINEA, Y ESTO CASI PUBLICA CINCO CARAS.
        # `git ls-files` **entrecomilla y escapa en octal** cualquier ruta
        # con un caracter no ASCII:
        #
        #     "03_Servidor/disenos/_avatares//303/261/303/261.png"
        #
        # Esa comilla al principio hace que
        # `r.startswith('03_Servidor/disenos/_avatares/')` de **False**, asi
        # que las cinco fotos con tilde o cirilico —lilñaño, lázaro, tøkīø,
        # ññ, ржунимагу— se saltearon la lista `PRIVADO` entera y entraron a
        # `sale`.
        #
        # ⚠️ NO SE COPIARON SOLO PORQUE WINDOWS RECHAZA `"` EN UN NOMBRE DE
        # ARCHIVO. En el runner de Actions, que es Linux, se copiaban y se
        # publicaban. Me salvo el sistema operativo, no mi chequeo — que es
        # justo lo que este repo llama «un bug que no avisa».
        #
        # Con `-z` git entrega las rutas crudas separadas por NUL y no
        # entrecomilla nada. Medido: 5 rutas entrecomilladas con saltos de
        # linea, **0** con `-z`.
        r = subprocess.run(('git',) + a + ('-z',), cwd=BASE,
                           capture_output=True)
        salida = r.stdout.decode('utf-8', 'surrogateescape')
        return [x.replace('\\', '/') for x in salida.split('\0') if x]

    seguidos = set(_git('ls-files'))
    sueltos = set(_git('ls-files', '--others', '--exclude-standard'))
    sale, fuera = [], []
    for r in sorted(seguidos):
        por, seg = privado(r)
        (fuera if por else sale).append(
            (r, ('🔒 ' if seg else '') + por if por else None))
    return sale, fuera, sorted(sueltos)


def con_ids(rutas):
    """`{ruta: cuantos IDs distintos}` de los que traen IDs de Discord."""
    out = {}
    for r, _ in rutas:
        if not r.startswith('datos/') or not r.endswith('.json'):
            continue
        try:
            t = io.open(os.path.join(BASE, r), encoding='utf-8').read()
        except (OSError, UnicodeDecodeError):
            continue
        n = len(set(_ID.findall(t)))
        if n:
            out[r] = n
    return out


def secretos(rutas):
    """Los valores secretos que aparezcan en lo que SALE.

    🔴 QUE ES UN SECRETO NO LO DECIDE ESTE ARCHIVO. Lo importa de
    `herramientas/secretos_en_git.py`, que es el que ya lo sabe y que
    ademas sabe lo que **no** lo es. Mi primera version tenia su propia
    lista y metia `creds.json · client_email` adentro: marco **9 archivos
    filtrados** —entre ellos `docs/sheet_t1.md`, que documenta a quien
    hay que compartirle el Sheet— cuando un correo de cuenta de servicio
    es un identificador, no una credencial.

    ⚠️ Es la trampa que ese mismo script trae escrita: *«una alarma que
    pide el arreglo equivocado hace daño»*. Y es la otra, tambien: una
    decision escrita en dos lugares acaba diciendo dos cosas.
    """
    sys.path.insert(0, SCR)
    try:
        import secretos_en_git as S
    except ImportError as e:
        return ['no pude importar secretos_en_git: %s' % e]
    vals = {}
    try:
        for k, v in S.del_env().items():
            if k not in S.PUBLICOS and len(v) >= S.MINIMO:
                vals['.env · %s' % k] = v
        vals.update(S.de_los_json())
    except (OSError, ValueError) as e:
        return ['no pude leer las credenciales (%s): no puedo afirmar '
                'que no estén' % e]
    if not vals:
        return ['no hay ninguna credencial en disco: no puedo afirmar '
                'que no esté']
    mal = []
    for r, _ in rutas:
        try:
            t = io.open(os.path.join(BASE, r), encoding='utf-8',
                        errors='ignore').read()
        except OSError:
            continue
        for nombre, v in vals.items():
            if v in t:
                mal.append('%s tiene %s' % (r, nombre))
    return mal


def caras(rutas):
    """Imagenes que llevan la cara de una persona, en lo que SALE.

    🔴 ESTE CHEQUEO DIO «NI UNA CARA» SOBRE UN ARBOL CON 22 CARAS. La
    primera version miraba si el nombre del archivo empezaba con `av_` o
    `avatar`, y con eso encontraba `av_valen.png` y nada mas. Lo que se le
    pasaba entero es lo obvio: **una carta renderizada lleva el avatar
    adentro**, y en el repo hay 22 —`versiones/konan-pre/Konan_1_temporada
    .png`, `03_Servidor/Juasmio_servidor.png`, `01_Temporada/
    Konan_temporada.png`…—.

    ⚠️ Un falso verde sobre caras es lo peor que puede hacer esta
    herramienta: da permiso para publicar. Es la misma forma que
    `herramientas/workflows_validos.py` persigue del otro lado — *un
    validador que dice que si donde el de verdad dice que no*.

    Devuelve `(avatares, cartas)`, y son dos cosas distintas a proposito:
    un **avatar** es la foto de alguien y no sale nunca; una **carta** es
    el producto —va a Discord y ya se sirve desde el bucket publico de
    R2— asi que publicarla no revela nada nuevo. La decision es de Dlx,
    no mia: se piden con `--con-cartas` o `--sin-cartas`.
    """
    #: `Konan_temporada.png`, `Konan_1_temporada.png`, `sv-dra_konan.png`,
    #: `bloq-pais_agus.png` — las convenciones que `bot/subir_cartas.py`
    #: parsea, que son justamente los nombres de una carta emitida.
    CARTA = re.compile(
        r'(^|/)(?:(sv|bloq)-[a-z0-9]+[_\-])?'
        r'[^/]*?[_\-](temporada|competitivo|servidor|pais|bloqueada)'
        r'\.(png|jpg|jpeg|webp)$|'
        r'(^|/)(temporada|competitivo|servidor|pais|bloqueada)'
        r'[_\-][^/]+\.(png|jpg|jpeg|webp)$', re.I)
    av, cartas = [], []
    for r, _ in rutas:
        b = r.rsplit('/', 1)[-1].lower()
        if not b.endswith(('.png', '.jpg', '.jpeg', '.webp')):
            continue
        if b.startswith('av_') or b.startswith('avatar') or '/fotos/' in r:
            av.append(r)
        elif CARTA.search(r) or r.startswith('versiones/'):
            cartas.append(r)
    return av, cartas


def main():
    sale, fuera, sueltos = arbol()
    ids = con_ids(sale)
    print('\n══ SI ESTE REPO SE HACE PUBLICO ══\n')

    pesa = lambda rs: sum(                                        # noqa: E731
        os.path.getsize(os.path.join(BASE, r))
        for r, _ in rs if os.path.exists(os.path.join(BASE, r)))
    print('   sale         %5d archivos   %6.1f MB'
          % (len(sale), pesa(sale) / 1e6))
    print('   queda fuera  %5d archivos   %6.1f MB' % (len(fuera),
                                                       pesa(fuera) / 1e6))
    print('\n   por que queda fuera:')
    por = {}
    for r, p in fuera:
        por.setdefault(p, []).append(r)
    for p, rs in sorted(por.items(), key=lambda x: -len(x[1])):
        print('      %5d  %s' % (len(rs), p))

    print('\n   ── LO QUE HAY QUE DECIDIR ──')
    if ids:
        print('   %d archivo(s) de datos/ con IDs de Discord, %d IDs en total:'
              % (len(ids), sum(ids.values())))
        for r, n in sorted(ids.items(), key=lambda x: -x[1]):
            print('      %-38s %5d IDs' % (r, n))
        print('      ⚠️ --con-ids para publicarlos, --sin-ids para dejarlos')
    else:
        print('   ninguno: no hay IDs de Discord en lo que sale')

    print('\n   ── VERIFICACION DE LO QUE SALE ──')
    s = secretos(sale)
    av, cartas = caras(sale)
    for etiq, mal in (('secretos', s), ('fotos de personas', av)):
        if mal:
            print('   🔴 %s: %d' % (etiq, len(mal)))
            for x in mal[:8]:
                print('      %s' % x)
        else:
            print('   ✅ ni un(a) %s' % etiq)
    if cartas:
        print('\n   ── Y LAS CARTAS RENDERIZADAS, QUE TAMPOCO DECIDO YO ──')
        print('      %d carta(s) de gente real. UNA CARTA LLEVA LA CARA'
              % len(cartas))
        print('      ADENTRO — pero es el producto: va a Discord y ya se')
        print('      sirve desde el bucket público de R2, así que')
        print('      publicarla no revela nada que no esté dado. Algunas')
        print('      las leen los scripts de comparación.')
        for x in cartas[:6]:
            print('      %s' % x)
        if len(cartas) > 6:
            print('      … y %d más' % (len(cartas) - 6))
        print('      ⚠️ --con-cartas para publicarlas, --sin-cartas para no')

    if sueltos:
        print('\n   ── NI EN GIT NI IGNORADOS (%d) ──' % len(sueltos))
        print('      existen, no estan trackeados y tampoco ignorados: al')
        print('      armar el arbol nuevo entrarian. Decidilos antes.')
        for r in sueltos[:12]:
            print('      %s' % r)
        if len(sueltos) > 12:
            print('      … y %d mas' % (len(sueltos) - 12))

    if '--armar' not in sys.argv:
        print('\n   (nada escrito: --armar <carpeta> arma el árbol)\n')
        return 1 if (s or av) else 0

    if '--con-ids' not in sys.argv and '--sin-ids' not in sys.argv:
        print('\n   🔴 no armo nada: falta decidir los IDs de Discord.'
              '\n      --con-ids  los publica'
              '\n      --sin-ids  los deja afuera\n')
        return 2
    if s or av:
        print('\n   🔴 no armo nada: hay que resolver lo de arriba primero\n')
        return 2
    # ⚠️ LAS CARTAS PIDEN SU PROPIA PALABRA, igual que los IDs. No las saco
    # solas —son el producto, y publicarlas no revela nada que el bucket
    # publico de R2 no de ya— pero tampoco las publico solas: llevan la cara
    # de alguien, y el default silencioso seria publicar.
    if cartas and ('--con-cartas' not in sys.argv
                   and '--sin-cartas' not in sys.argv):
        print('\n   🔴 no armo nada: falta decidir las cartas renderizadas.'
              '\n      --con-cartas  las publica'
              '\n      --sin-cartas  las deja afuera\n')
        return 2

    dest = sys.argv[sys.argv.index('--armar') + 1]
    quitar_ids = '--sin-ids' in sys.argv
    fuera_cartas = set(cartas) if '--sin-cartas' in sys.argv else set()
    # 🔴 Y BORRAR EL DESTINO TIENE QUE FUNCIONAR, PORQUE SI FALLA QUEDA UN
    # ARBOL VIEJO QUE SE VE NUEVO. Paso el 24/09/2026: el destino ya tenia
    # un `.git` de una prueba anterior, y git crea sus objetos en **solo
    # lectura**, asi que `shutil.rmtree` murio con
    #
    #     PermissionError: [WinError 5] Access is denied:
    #     …/publico/.git/objects/00/38cba9a81cf…
    #
    # El build aborto ANTES de copiar y dejo intacto el arbol de la corrida
    # anterior — el que todavia tenia `03_Servidor/Valen_servidor.png`.
    # Estuve a un `git commit` de publicarlo.
    #
    # ⚠️ Y NO ME AVISO, porque la corrida estaba detras de un `| sed` y el
    # codigo de salida que vi era el del sed. Es la trampa de siempre en
    # otra ropa: *contar lo que hay en disco no es contar lo que salio*.
    #
    # ⚠️ Por eso la verificacion del arbol construido —que corre unas lineas
    # mas abajo— no salvo nada: nunca llego a correr. Un chequeo posterior
    # al paso que falla no es un chequeo.
    def _insistir(func, ruta, _exc):
        os.chmod(ruta, 0o700)
        func(ruta)

    if os.path.exists(dest):
        shutil.rmtree(dest, onexc=_insistir)
        if os.path.exists(dest):
            print('\n   🔴 no pude vaciar %s: no armo nada, porque lo que '
                  'quedaría\n      ahí sería el árbol de la corrida '
                  'anterior\n' % dest)
            return 2
    n = 0
    for r, _ in sale:
        if quitar_ids and r in ids:
            continue
        if r in fuera_cartas:
            continue
        d = os.path.join(dest, r.replace('/', os.sep))
        try:
            os.makedirs(os.path.dirname(d), exist_ok=True)
            shutil.copy2(os.path.join(BASE, r), d)
            n += 1
        except OSError as e:
            print('      no pude copiar %s: %s' % (r, e))
    # 🔴 Y EL `.gitignore` DEL ARBOL NUEVO TIENE QUE SABER TODO ESTO, O LO
    # QUE SACAMOS VUELVE SOLO. El primero que corra un generador en el repo
    # nuevo regenera `galeria/` y las hojas de exploracion, y el `git add
    # -A` de la tanda siguiente las commitea — con las 421 fotos detras si
    # alguien copia la carpeta. Lo que se saca una vez hay que sacarlo para
    # siempre, y eso es una linea en `.gitignore`, no una intencion.
    # 🔴 Y AHORA SE REVISA **EL ARBOL CONSTRUIDO**, NO LA LISTA DE ENTRADA.
    # La lista ya dijo que estaba bien una vez y se equivoco: las cinco rutas
    # que `git ls-files` entrecomilla se saltearon `PRIVADO` entero. Un
    # chequeo sobre la entrada no encuentra un error de la entrada.
    #
    # Es la regla que `04_Pais/exportar_png.py` ya tiene escrita: verifica el
    # PNG —que las cuatro esquinas esten transparentes— y no el proceso que
    # lo hizo. Los dos errores que este formato admite sin quejarse son el
    # rectangulo y el vacio; aca los dos son una cara y una credencial.
    colados = []
    for raiz, _ds, fs in os.walk(dest):
        for f in fs:
            r = os.path.relpath(os.path.join(raiz, f), dest).replace('\\', '/')
            por, seg = privado(r)
            if seg:
                colados.append('%s (%s)' % (r, por))
    if colados:
        print('\n   🔴 %d ARCHIVO(S) QUE NO DEBIAN SALIR ESTAN EN EL ARBOL:'
              % len(colados))
        for x in colados[:10]:
            print('      %s' % x)
        print('      borro el árbol y no publico nada\n')
        shutil.rmtree(dest)
        return 2

    gi = os.path.join(dest, '.gitignore')
    with io.open(gi, 'a', encoding='utf-8', newline='\n') as f:
        f.write(u'\n' + IGNORAR + u'\n')
    print('\n   ✅ %d archivos en %s' % (n, dest))
    print('      %s' % ('sin los IDs de Discord' if quitar_ids
                        else 'con los IDs de Discord'))
    print('      y %d líneas más en .gitignore, para que no vuelvan\n'
          % len([l for l in IGNORAR.split('\n')
                 if l.strip() and not l.startswith('#')]))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
