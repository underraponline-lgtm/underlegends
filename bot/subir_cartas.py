"""SUBIR LAS CARTAS A R2.

    python bot/subir_cartas.py versiones/konan-pre     una carpeta
    python bot/subir_cartas.py <carpeta> --simulacro   que subiria, sin subir
    python bot/subir_cartas.py --listar                que hay arriba
    python bot/subir_cartas.py --borrar <clave>        sacar una

La clave de cada objeto es **`<persona>/<carta>.webp`**, estable.

⚠️ **SE SUBE WEBP, NO PNG.** El generador saca PNG sin perdida —que es lo que
hay que mirar y medir— y acá se convierte a WEBP q90 para servirla: 1.095 KB
pasan a 138. El porque esta medido en `bot/a_webp.py`.

⚠️ **LA CLAVE NO LLEVA HASH, Y ES UNA DECISION.** La primera idea fue
`konan/pais-a3f9c1.png`, porque **Discord cachea las imagenes POR URL** y si el
archivo cambia sin cambiar el link, su proxy sigue sirviendo el viejo. Pero el
hash en la clave trae dos problemas:

1. El Worker no puede **construir** la URL: tendria que buscar el hash de cada
   carta en algun lado, o sea una consulta mas por cada boton.
2. Cada corrida deja **552 archivos nuevos** y los viejos no se borran solos.

La cache se rompe igual con **`?v=<sello>`**, que Discord cuenta como otra URL
y R2 **ignora** —sirve el objeto igual—. Asi que:

    la clave     konan/pais.png          estable, la arma el Worker solo
    el link      konan/pais.png?v=0917   cambia cuando corre el pipeline

⚠️ **Y el sello es UNO SOLO por corrida, no uno por carta.** El Worker lee un
valor y lo pega en las 552 URLs. Con un hash por carta serian 552 consultas.

⚠️ **Consecuencia asumida**: un mensaje viejo con `?v=` viejo muestra la carta
**de hoy**, no la de aquel dia. Para un boton que dice "tu carta de Pais" eso
es lo correcto — y ademas es lo que evita guardar cada version para siempre.
"""
import concurrent.futures as cf
import hashlib
import io
import json
import os
import re
import sys
import threading
import time
import unicodedata

import requests

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)

CUENTA = 'a85733396fd158a8e9660b02e20f33c8'
BUCKET = 'cartas'
PUBLICA = 'https://pub-70d5821d06a8432c9cffd0c102195000.r2.dev'
API = ('https://api.cloudflare.com/client/v4/accounts/%s/r2/buckets/%s'
       % (CUENTA, BUCKET))

# Del nombre de archivo al tipo de carta. Los PNG de versiones/ salen como
# `Konan_4_pais.png`, y los exportadores como `pais_konan.png`.
#: Con que se comprime la webp que se sirve. LOS DOS VIVEN ACA Y NADIE MAS
#: LOS ESCRIBE: `bot/a_webp.py` los importa. Tenerlos en dos lugares es el bug
#: que este repo persigue en cinco secciones de CLAUDE.md —el divisor, las
#: crews, los rangos— y aca costaba que una conversion saliera distinta de la
#: otra sin que nada fallara.
CALIDAD = 90

#: 🔴 ESFUERZO 5 Y NO 6, Y ES EL CUELLO DE TODO EL CICLO. Medido el
#: 24/09/2026 sobre la corrida que el timeout de 120 min corto en la tanda 5
#: de 6: por cada tanda de 40 personas, **dibujar tardaba 9-11 min y SUBIR
#: 15-19**. O sea que lo caro no era ni el navegador ni la red — era esta
#: linea. `method=6` le pide al codificador que busque la mejor prediccion
#: para cada bloque, y eso cuesta CPU pura:
#:
#:     method=6   2.45 - 3.38 s por carta
#:     method=5   0.31 - 0.35 s por carta     <- este, 8x mas rapido
#:
#: ⚠️ Y LOS 8 HILOS NO TAPAN ESTO, porque el runner de Actions tiene **2
#: nucleos**: contra un cuello de CPU, ocho hilos dan dos. El paralelismo
#: sirve para solapar la red, que es lo que parecia el problema.
#:
#: ⚠️ LO QUE SE PAGA SON BYTES, Y SE MIDIO: **+2.4 %** (136.8 -> 140.1 KB en
#: la carta de Agus). Sobre los 6.475 objetos de R2 son ~15 MB mas de los
#: 10 GB del plan gratis.
#:
#: ⚠️ Y LO QUE **NO** SE PAGA ES LA IMAGEN, que era la pregunta que importaba.
#: El cambio mueve la carta trece veces menos que la compresion en la que ya
#: vive, medido contra el PNG original sobre cinco cartas:
#:
#:     PNG -> method=6   max 194   media 1.14     la perdida YA aceptada
#:     method=6 -> 5     max  15   media 0.55     este cambio
#:     el canal alfa     max   0                  identico
#:
#: Ese alfa en 0 no es un detalle: es lo unico que podia romper la carta —una
#: webp sin transparencia se ve como un RECTANGULO sobre el fondo de Discord,
#: y eso no da error en ningun lado. Ver el docstring de `bot/a_webp.py`.
ESFUERZO = 5

CARTAS = ('temporada', 'competitivo', 'servidor', 'pais', 'bloqueada')
# ⚠️ El exportador de Servidor escribe `sv_<nombre>.png`, no
# `<nombre>_servidor.png`. Sin este alias los 138 se saltean en silencio.
ALIAS = {'sv': 'servidor', 'bloq': 'bloqueada'}


def env(clave):
    p = os.path.join(BASE, '.env')
    for linea in io.open(p, encoding='utf-8'):
        if linea.strip().startswith(clave + '='):
            return linea.split('=', 1)[1].strip().strip('"\'')
    sys.exit('falta %s en .env' % clave)


def norm(s):
    s = unicodedata.normalize('NFD', str(s).lower())
    return ''.join(c for c in s if c.isalnum())


# ⚠️ `sv-ffa_konan.png` SE LEE ANTES QUE NADA, Y TIENE QUE SER ASI.
# El camino generico parte por `[_\-. ]+`, o sea que de `sv-ffa_konan` saca
# ['sv','ffa','konan'], ve que 'sv' es alias de 'servidor' y deja
# quien='ffakonan' -- una persona que no existe. No falla: sube 138 archivos a
# claves inventadas y el bot sigue sin encontrar las cartas.
POR_SERVIDOR = re.compile(r'^sv-([a-z0-9]+)[_\-. ]+(.+)$', re.I)
# ⚠️ LA BLOQUEADA ES **POR CARTA**, y por eso lleva la carta en la clave. Con
# el camino generico, `bloq-temporada_konan` se parte en ['bloq','temporada',
# 'konan'], reconoce 'temporada' como la carta y deja quien='bloqkonan' — o
# sea que pisaria la Temporada de verdad de una persona que no existe. Es el
# mismo agujero que ya tenia `sv-ffa_konan`, un nivel mas adentro.
POR_BLOQUEADA = re.compile(r'^bloq-([a-z]+)[_\-. ]+(.+)$', re.I)


def leer_nombre(archivo):
    """(persona, carta) desde el nombre del archivo, o None si no se entiende."""
    raiz = os.path.splitext(os.path.basename(archivo))[0]
    m = POR_BLOQUEADA.match(raiz)
    if m:
        return norm(m.group(2)), 'bloq-%s' % m.group(1).lower()
    m = POR_SERVIDOR.match(raiz)
    if m:
        return norm(m.group(2)), 'sv-%s' % m.group(1).lower()
    partes = [p for p in re.split(r'[_\-. ]+', raiz) if p]
    carta = next((ALIAS.get(p.lower(), p.lower()) for p in partes
                  if p.lower() in CARTAS or p.lower() in ALIAS), None)
    if not carta:
        return None
    # lo que no es la carta ni un numero de orden es la persona
    resto = [p for p in partes if p.lower() != carta and p.lower() not in ALIAS]
    quien = [p for p in resto if not p.isdigit()]
    # 🔴 HAY UNA PERSONA QUE SE LLAMA «7». El filtro de digitos esta para
    # ignorar el numero de orden de `Konan_4_pais.png`, pero con
    # `pais_7.png` se come el nombre entero y el archivo se salta con «no
    # entiendo que carta es» — su carta no se sube y nadie lo nota, porque un
    # SALTADO entre 300 no llama la atencion. Si al sacar los digitos no queda
    # NADA, es que el nombre ERA el digito.
    if not quien:
        quien = resto
    return (norm(''.join(quien)), carta) if quien else None


def sesion():
    s = requests.Session()
    s.headers['Authorization'] = 'Bearer ' + env('CLOUDFLARE_API_TOKEN')
    return s


def _ok(r, que):
    try:
        j = r.json()
    except Exception:
        print('  ⚠️ %s -> %d %s' % (que, r.status_code, r.text[:120]))
        return None
    if not j.get('success'):
        for e in j.get('errors') or []:
            print('  ⚠️ %s  [%s] %s' % (que, e.get('code'), str(e.get('message'))[:110]))
        return None
    return j.get('result')


def listar(s):
    """Todos los objetos del bucket, paginando.

    ⚠️ PAGINA, Y NO ES UN DETALLE: la API devuelve como mucho 1.000 por
    llamada y el bucket pasa de 1.200 con las cartas por servidor. Sin el
    cursor, `--listar` mostraria 1.000 y `--sincronizar` daria por perdidas
    las demas — o sea que el arreglo BORRARIA del inventario cartas que si
    estan. Un limite que se alcanza de a poco no avisa cuando se cruza.

    🔴 Y REVIENTA EN VEZ DE DEVOLVER UNA LISTA A MEDIAS. Antes, si la API
    fallaba, esto imprimia el aviso y devolvia lo que tenia — que podian ser
    CERO objetos. Paso el 18/09/2026: R2 contesto `[971] Please wait and
    consider throttling your request speed` y `listar()` devolvio [].

    ⚠️ ESO NO ES UN AVISO, ES UNA TRAMPA, y la ruta corta es espantosa:
    `sincronizar()` reescribe `datos/cartas_r2.json` con lo que esto devuelve.
    Con [] habria dejado el inventario VACIO; `subir_datos.py` habria escrito
    `cs: []` para las 138 y `svs: []`; y el bot habria dejado de dibujar
    botones y de ofrecer servidores, con las 1.793 cartas intactas en R2.

    Un fallo de red convertido en «no hay nada» y propagado en silencio hasta
    apagar el producto. Ahora levanta `IOError` y el que llama se entera.
    """
    todos, cursor, espera = [], None, 0
    while True:
        pars = {'per_page': 1000}
        if cursor:
            pars['cursor'] = cursor
        r = s.get(API + '/objects', params=pars)
        try:
            j = r.json()
        except Exception:
            raise IOError('listar -> %d %s' % (r.status_code, r.text[:120]))
        if not j.get('success'):
            codigos = [e.get('code') for e in (j.get('errors') or [])]
            # ⚠️ EL 971 SE ESPERA, NO SE REINTENTA A CIEGAS. R2 contesta
            # «Please wait and consider throttling your request speed»: es
            # transitorio y te esta diciendo que bajes el ritmo. Se espera
            # cada vez mas, hasta seis veces, y recien ahi se levanta.
            if 971 in codigos and espera < 6:
                time.sleep(4 * (espera + 1))
                espera += 1
                continue
            msg = '; '.join('[%s] %s' % (e.get('code'), str(e.get('message'))[:90])
                            for e in (j.get('errors') or [])) or 'sin detalle'
            raise IOError('listar fallo con %d objetos leidos: %s' % (len(todos), msg))
        espera = 0
        todos += j.get('result') or []
        cursor = (j.get('result_info') or {}).get('cursor')
        if not cursor:
            return todos
    # (inalcanzable; el return vive en el while)


def sincronizar(s):
    """Reescribe `datos/cartas_r2.json` con lo que R2 dice que tiene.

    ⚠️ EL INVENTARIO TIENE QUE SALIR DE R2, NO DE LO QUE CREIMOS SUBIR, y esto
    existe porque los dos ya se separaron: `competitivo_Prosu.png` fallo una
    vez, se reintento a mano y subio — pero el inventario de esa corrida ya
    estaba escrito sin el. Resultado: R2 servia la carta con 200 y el bot,
    que ahora lee el inventario para saber que botones dibujar, se la
    escondia. Un archivo que dice de menos es tan malo como uno que dice de
    mas: los dos mienten en silencio.
    """
    objs = listar(s)
    mapa = {}
    for o in objs:
        clave = o['key']
        # ⚠️ Se listan las .webp: las .png quedaron de antes del 17/09/2026 y
        # no las sirve nadie. Ver bot/a_webp.py.
        if not clave.endswith('.webp') or '/' not in clave:
            continue
        # 🔴 LAS FOTOS NO SON CARTAS, Y ESTABAN ENTRANDO AL INVENTARIO.
        # Viven en `fotos/<temporada>/<quien>.webp` y `rpartition('/')` las
        # metia como una persona llamada `fotos/t1` con **443 cartas**
        # —una por cara—, asi que el inventario decia 4.690 donde R2 sirve
        # 4.247 cartas.
        #
        # ⚠️ Y ROMPIA EL CHEQUEO QUE EXISTE PARA ESTO. `bot/verificar.py`
        # compara «lo que el pipeline anoto» contra «lo que R2 sirve» y
        # daba MAL por exactamente 443, un numero que parece un faltante de
        # cartas y era una suma de fotos. Un contador que cuenta de mas se
        # lee igual que uno que descubrio algo.
        #
        # ⚠️ La carpeta es `fotos/<temporada>/`, asi que el filtro va por
        # el prefijo y no por el nombre de la temporada: el dia que sea
        # `fotos/t2/` sigue andando. Ver `comun/temporada.clave_foto()`.
        if clave.startswith('fotos/'):
            continue
        quien, _, carta = clave.rpartition('/')
        mapa.setdefault(quien, {})[carta[:-5]] = '%s/%s' % (PUBLICA, clave)
    salida = os.path.join(BASE, 'datos', 'cartas_r2.json')
    with open(salida, 'w', encoding='utf-8') as f:
        json.dump(mapa, f, ensure_ascii=False, indent=1, sort_keys=True)
    total = sum(len(v) for v in mapa.values())
    print('R2 tiene %d objeto(s): %d persona(s), %d carta(s)'
          % (len(objs), len(mapa), total))
    from collections import Counter
    c = Counter(k for v in mapa.values() for k in v)
    for k, n in sorted(c.items()):
        print('  %-16s %3d %s' % (k, n, '' if n == len(mapa) else '⚠️ faltan %d' % (len(mapa) - n)))
    print('\n-> %s' % os.path.relpath(salida, BASE))


def a_webp(datos):
    """El PNG del generador, convertido a lo que se sirve.

    ⚠️ SE CONVIERTE AL SUBIR Y NO AL GENERAR. El generador sigue sacando PNG
    —sin perdida, que es lo que hay que mirar y medir— y lo que viaja a
    Discord es la copia liviana. Asi el master no se degrada nunca: cada
    corrida re-comprime desde el original, no desde la webp anterior.

    ⚠️ Y SE COMPRUEBA EL ALFA. Una carta que pierde la transparencia se ve
    como un RECTANGULO sobre el fondo de Discord, y eso no da error en ningun
    lado: sale mal y ya. Ver bot/a_webp.py para el porque del formato.
    """
    from PIL import Image
    im = Image.open(io.BytesIO(datos)).convert('RGBA')
    b = io.BytesIO()
    im.save(b, 'WEBP', quality=CALIDAD, method=ESFUERZO)
    out = b.getvalue()
    if Image.open(io.BytesIO(out)).mode != 'RGBA':
        raise ValueError('la webp perdio el alfa')
    return out


def subir(s, ruta, clave, intentos=3):
    """Sube una carta a R2. Devuelve (bytes, md5) o (None, por_que).

    ⚠️ REINTENTA, Y NO ES PARANOIA: son 1.242 subidas por corrida. Con una
    tasa de fallo de uno en mil, fallar UNA es lo normal, no lo excepcional —
    y ya paso: `competitivo_Prosu.png` fallo una vez y anduvo al segundo
    intento. Un archivo que no sube deja al bot pidiendo una URL que no
    existe, y Discord no avisa de una imagen que no carga.
    """
    with open(ruta, 'rb') as f:
        datos = f.read()
    # ⚠️ NO se sube un PNG vacio: en la carpeta de salida un archivo de 0 bytes
    # se lee despues como carta valida y el embed sale roto sin avisar.
    if len(datos) < 1024:
        return None, 'pesa %d bytes' % len(datos)
    try:
        datos = a_webp(datos)
    except Exception as e:
        return None, 'no se pudo convertir: %s' % str(e)[:50]
    for n in range(intentos):
        try:
            r = s.put('%s/objects/%s' % (API, clave), data=datos,
                      headers={'Content-Type': 'image/webp'}, timeout=60)
            if _ok(r, clave) is not None:
                return len(datos), hashlib.md5(datos).hexdigest()[:8]
        except Exception as e:
            if n == intentos - 1:
                return None, str(e)[:70]
        time.sleep(1.5 * (n + 1))
    return None, 'la API rechazo la subida %d veces' % intentos


def main():
    s = sesion()

    if '--listar' in sys.argv:
        objs = listar(s)
        print('EN R2 (%d objetos)\n' % len(objs))
        for o in sorted(objs, key=lambda x: x['key']):
            print('  %-34s %8.1f KB   %s' % (o['key'], int(o['size']) / 1024,
                                             o.get('uploaded', '')[:19]))
        if objs:
            print('\n  total %.1f MB de los 10 GB' %
                  (sum(int(o['size']) for o in objs) / 1024 / 1024))
        return

    if '--sincronizar' in sys.argv:
        sincronizar(s)
        return

    if '--borrar' in sys.argv:
        clave = sys.argv[sys.argv.index('--borrar') + 1]
        _ok(s.delete('%s/objects/%s' % (API, clave)), 'borrar')
        print('borrado', clave)
        return

    carpetas = [a for a in sys.argv[1:] if not a.startswith('-')]
    if not carpetas:
        sys.exit(__doc__.strip().splitlines()[2].strip())

    archivos = []
    for c in carpetas:
        p = os.path.join(BASE, c) if not os.path.isabs(c) else c
        if os.path.isdir(p):
            archivos += [os.path.join(p, f) for f in sorted(os.listdir(p))
                         if f.lower().endswith('.png')]
        elif os.path.exists(p):
            archivos.append(p)

    if not archivos:
        sys.exit('no encontre PNG en: %s' % ', '.join(carpetas))

    print('SUBIENDO %d archivo(s)\n' % len(archivos))
    trabajos, saltados = [], []
    for a in archivos:
        par = leer_nombre(a)
        if not par:
            saltados.append((os.path.basename(a), 'no entiendo que carta es'))
            continue
        quien, carta = par
        trabajos.append((a, quien, carta, '%s/%s.webp' % (quien, carta)))

    # 🔴 DOS ARCHIVOS CON LA MISMA CLAVE: GANA EL QUE TERMINE ULTIMO.
    #
    # `ALIAS` mapea `sv` a `servidor`, asi que `sv_abyssus.png` y
    # `servidor_abyssus.png` apuntan los dos a `abyssus/servidor.webp`. Los
    # dos se subian, en paralelo y con ocho hilos, o sea que cual quedaba
    # arriba **no era el orden del listado sino cual contestaba primero**.
    # El 20/09/2026 habia 138 `sv_*.png` del 17/09 en `bot/salida/` junto a
    # los 138 `servidor_*.png` de ese dia: una carrera para decidir si el
    # bot mostraba la carta nueva o la de tres dias antes.
    #
    # Gana el **mas nuevo por mtime**, que es lo que uno quiere siempre que
    # esto pasa: el de al lado es una sobra de un esquema de nombres viejo.
    # Y se **avisa**, porque una colision silenciosa es indistinguible de
    # que todo este bien.
    porclave = {}
    for t in trabajos:
        porclave.setdefault(t[3], []).append(t)
    choques = {k: v for k, v in porclave.items() if len(v) > 1}
    if choques:
        print('  ⚠️ %d clave(s) con mas de un archivo. Gana el mas nuevo:'
              % len(choques))
        for k, v in sorted(choques.items())[:6]:
            print('     %-28s %s' % (k, ' · '.join(os.path.basename(x[0])
                                                   for x in v)))
        if len(choques) > 6:
            print('     ... y %d mas' % (len(choques) - 6))
        trabajos = []
        for k, v in porclave.items():
            v.sort(key=lambda x: os.path.getmtime(x[0]), reverse=True)
            trabajos.append(v[0])
            for x in v[1:]:
                saltados.append((os.path.basename(x[0]),
                                 'choca con %s, que es mas nuevo'
                                 % os.path.basename(v[0][0])))
        trabajos.sort(key=lambda t: t[3])

    if '--simulacro' in sys.argv:
        print('\n  [simulacro] %d subiria(n), %d saltado(s)\n'
              % (len(trabajos), len(saltados)))
        from collections import Counter
        c = Counter(t[2] for t in trabajos)
        for k, n in sorted(c.items()):
            print('     %-18s %4d' % (k, n))
        for f, por in saltados:
            print('     SALTADO  %-26s %s' % (f, por))
        print('')
        return

    # ⚠️ EN PARALELO, PERO UNA SESION POR HILO. `requests.Session` comparte un
    # pool de conexiones y no promete ser thread-safe; con 8 hilos sobre una
    # sola aparecen errores que no se repiten dos veces igual, que es lo peor
    # que puede pasar en una corrida de 1.242 archivos. Una por hilo cuesta
    # ocho handshakes y se acaba la pregunta.
    #
    # ⚠️ Y OCHO, NO CIEN: el limite de R2 en el plan gratis son 1.000.000 de
    # escrituras al mes, asi que el cuello no es la cuota sino la subida en
    # si. Ocho baja una tanda de 138 de minutos a decenas de segundos sin
    # arriesgar 429.
    local = threading.local()

    def _subir(t):
        if not hasattr(local, 's'):
            local.s = sesion()
        ruta, quien, carta, clave = t
        n, marca = subir(local.s, ruta, clave)
        return t, n, marca

    mapa, hechos = {}, 0
    with cf.ThreadPoolExecutor(max_workers=8) as pool:
        for (ruta, quien, carta, clave), n, marca in pool.map(_subir, trabajos):
            if n is None:
                saltados.append((os.path.basename(ruta), marca))
                continue
            mapa.setdefault(quien, {})[carta] = '%s/%s' % (PUBLICA, clave)
            hechos += 1
            if len(trabajos) <= 24:
                print('  %-30s %8.1f KB   %s' % (clave, n / 1024, marca))
            elif hechos % 25 == 0:
                print('  %d de %d...' % (hechos, len(trabajos)))
    if len(trabajos) > 24:
        print('  %d de %d subidas' % (hechos, len(trabajos)))

    for f, por in saltados:
        print('  SALTADO  %-26s %s' % (f, por))

    # ⚠️ EL INVENTARIO SE FUSIONA, NO SE PISA. Antes se escribia `mapa` tal
    # cual, o sea SOLO lo que subio esta corrida: subir la tanda de FFA
    # borraba del archivo las cuatro cartas de cada uno, aunque siguieran
    # arriba en R2. Y como `bot/subir_datos.py` lee este archivo para saber
    # que servidores estan listos, el bot se quedaba sin saber lo que si
    # tiene. R2 no se toca; el que mentia era el inventario.
    salida = os.path.join(BASE, 'datos', 'cartas_r2.json')
    previo = {}
    if os.path.exists(salida):
        with io.open(salida, encoding='utf-8') as f:
            previo = json.load(f)
    nuevas = sum(1 for q, cs in mapa.items() for c in cs
                 if c not in previo.get(q, {}))
    for quien, cartas in mapa.items():
        previo.setdefault(quien, {}).update(cartas)
    with open(salida, 'w', encoding='utf-8') as f:
        json.dump(previo, f, ensure_ascii=False, indent=1, sort_keys=True)
    print('\n-> %s   %d persona(s), %d clave(s) nueva(s)'
          % (os.path.relpath(salida, BASE), len(previo), nuevas))

    # ⚠️ Se comprueba contra la URL PUBLICA, no contra la respuesta de la API.
    # La subida puede decir 200 y la URL publica no estar servida todavia.
    # Con pocas se revisan todas; con 551, una muestra repartida — para
    # detectar "no se sirve nada" alcanza, y no cuesta 551 descargas.
    todas = [(clave_de(u), u) for cs in mapa.values() for u in cs.values()]
    muestra = todas if len(todas) <= 12 else todas[::max(1, len(todas) // 10)][:10]
    print('\ncomprobando %d de %d URLs de verdad...' % (len(muestra), len(todas)))
    malas = 0
    for clave, u in muestra:
        g = requests.get(u, timeout=25)
        if g.status_code != 200 or len(g.content) < 1024:
            malas += 1
        print('  %-30s %d  %7.1f KB' % (clave, g.status_code, len(g.content) / 1024))
    print('  %s' % ('⚠️ %d no se sirven' % malas if malas else '✅ todas responden'))


def clave_de(url):
    return url[len(PUBLICA) + 1:]


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
