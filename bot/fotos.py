# -*- coding: utf-8 -*-
"""LA FOTO DE CADA UNO, CONGELADA POR TEMPORADA.

    python bot/fotos.py --ver              cuantas hay, cuantas faltan y por que
    python bot/fotos.py --bajar            trae las que faltan y las sube a R2
    python bot/fotos.py --bajar --todas    refresca TAMBIEN las que ya estan
    python bot/fotos.py --bajar --limite 20    una prueba corta
    python bot/fotos.py --espejo           R2 -> comun/fotos/t1/ (lo que dibuja)
    python bot/fotos.py --desde-disco      las que solo estan en `_avatares/` -> R2

🔴 POR QUE EXISTE: ES EL BUG MAS VIEJO DEL PROYECTO.
--------------------------------------------------
La columna `av` del Sheet guarda un link de `cdn.discordapp.com` con un hash
que **Discord invalida cuando la persona cambia su foto**. Medido:

    julio 2026      6 de 20 caidos
    04/08/2026     11 de 20 caidos   <- quedaban 9 vivos

Y no se puede refrescar desde el Sheet, porque el Sheet no los tiene:
`construir_pool_competitivo.py` los rescata del JSON anterior, o sea de si
mismo. Cada rebuild arrastra las mismas URL muriendo, asi que el numero
**solo puede empeorar**.

Guardada como archivo propio en R2, esa URL **no vence nunca**.

⚠️ UNA CARPETA POR TEMPORADA, Y ES A PROPOSITO. `fotos/t1/<clave>.webp`, no
`fotos/<clave>.webp`. Si se pisara, las cartas de la T1 perderian su cara el
dia que arranque la T2 — y eso rompe la Historica, que justamente acumula
todas las temporadas. Dentro de la temporada la foto **no se toca**: es lo
que quiere decir «congelada».

⚠️ EL HASH VIENE EN BLOQUE, NO DE UN PEDIDO POR PERSONA. `GET /users/<id>`
son 444 llamadas con su limite de tasa; `GET /guilds/<id>/members?limit=1000`
trae mil miembros por llamada **con su objeto `user` adentro**, que es donde
vive el avatar. Cuatro paginas contra cuatrocientas.

⚠️ EL AVATAR **GLOBAL**, NO EL DEL SERVIDOR. El objeto `member` trae los dos:
`member.avatar` es el que la persona se puso en ESE servidor y `user.avatar`
es el suyo. La carta es una sola para los nueve servidores, asi que la foto
tiene que ser una sola: si saliera la del servidor, la misma persona tendria
cuatro caras distintas segun donde la miren.

⚠️ `?size=1024`, NO 128. El `size` **no es parte del hash**, asi que la misma
URL con otro tamaño trae la misma foto mas grande. El pool tiene `?size=128`
clavado y la carta dibuja a 345 px de ancho: se agrandaba 2,7 veces, y por
eso las caras se veian blandas.

🔴 PERO EL CDN **NO AGRANDA**, Y ESO CORRIGE LO QUE DECIA CLAUDE.md. Medido
el 20/09/2026 pidiendo cinco tamaños del mismo hash:

    Konan     size=128 -> 128    size=256/512/1024/4096 -> 256
    Abyssus   size=128 -> 128    size=256 en adelante   -> 256
    Afidu     size=128 -> 128    size=256 en adelante   -> 170

O sea que `size` es un **tope**, no un pedido: el CDN devuelve lo que la
persona subió y nada mas. CLAUDE.md dice que «la misma URL con `?size=512`
trae la misma foto cuatro veces mas grande», y eso vale **solo hasta el
tamaño original**. Para la mayoria el salto real es 128 -> 256, o sea el
doble y no ocho veces: la carta pasa de agrandar 2,7x a agrandar 1,35x. Se
gana la mitad del problema, no todo — y no hay manera de ganar el resto,
porque el pixel no existe en ningun lado.

Por eso el resumen imprime **la distribucion de tamaños** y no un promedio:
lo que hay que poder ver es cuantas caras van a salir blandas igual.

⚠️ SIN AVATAR NO SE GUARDA NADA, y no es un descuido. Discord da un blob gris
por defecto para el que nunca se puso foto. Guardarlo haria que la carta
dibuje ese blob en vez de la inicial gigante — y la inicial, con el color del
rango, es mejor carta que el gris de Discord.
"""
import io
import json
import os
import sys
import time

import requests

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)

# La consola de Windows es cp1252 y este script imprime ═ y ⚠️. Sin esto
# revienta al imprimir el resumen, DESPUES de haber hecho todo el trabajo.
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

# 🔴 LA TEMPORADA SALE DE `comun/temporada.py`, QUE ES EL UNICO LUGAR. Estuvo
# escrita aca un rato y esa es justo la forma que este repo documenta tres
# veces: la decision en un lado y el codigo leyendola de otro. Va a aparecer
# tambien en el nombre del Sheet, en las claves de KV y en la Historica.
from comun.temporada import (ACTUAL as TEMPORADA, clave_foto,
                             carpeta_fotos, carpeta_r2)

CUENTA = 'a85733396fd158a8e9660b02e20f33c8'
BUCKET = 'cartas'
API_R2 = ('https://api.cloudflare.com/client/v4/accounts/%s/r2/buckets/%s'
          % (CUENTA, BUCKET))
API_DC = 'https://discord.com/api/v10'
CDN = 'https://cdn.discordapp.com'


def guild(sv='DRA'):
    """El guild ID, sacado de la tabla y no escrito aca.

    🔴 LO ESCRIBI A MANO PRIMERO Y ESTABA MAL: Discord contesto
    `404 Unknown Guild`. Es exactamente la forma que este repo documenta tres
    veces —la decision existe en un lado y el codigo la lee de otro—, y con
    suerte fallo ruidoso: un guild ID equivocado que EXISTA habria listado
    los miembros de otro servidor sin decir nada.

    `datos/servidores.json` es la misma tabla que usa el Worker. Si mañana
    entra un servidor, se agrega ahi y esto lo ve.
    """
    p = os.path.join(BASE, 'datos', 'servidores.json')
    with io.open(p, encoding='utf-8') as f:
        d = json.load(f)['servidores']
    if sv not in d or not d[sv].get('guild_id'):
        sys.exit('%s no esta en datos/servidores.json o no tiene guild_id' % sv)
    return d[sv]['guild_id']



LADO = 1024          # lo que se le pide al CDN
ANCHO_CARTA = 345    # a cuanto lo dibuja la carta mas grande


def env(clave, obligatorio=True):
    p = os.path.join(BASE, '.env')
    if os.path.exists(p):
        for linea in io.open(p, encoding='utf-8'):
            if linea.strip().startswith(clave + '='):
                return linea.split('=', 1)[1].strip().strip('"\'')
    if obligatorio:
        sys.exit('falta %s en .env' % clave)
    return None


clave_de = clave_foto


# ── de donde sale la gente ────────────────────────────────────────────────
def gente_con_id():
    """`{clave: discord_id}` desde el volcado de KV.

    ⚠️ SALE DE KV Y NO DEL POOL, y la diferencia importa: `d:<id>` es el
    indice que el Worker usa para resolver `/card quien:@alguien`. Si una
    persona tiene foto acá pero no está en ese índice, la foto no la va a
    encontrar nadie.
    """
    p = os.path.join(SCR, '_kv_volcado.json')
    if not os.path.exists(p):
        sys.exit('Falta bot/_kv_volcado.json. Corré antes:  python bot/volcar_kv.py')
    with io.open(p, encoding='utf-8') as f:
        v = json.load(f)
    # `d:<discord_id>` -> clave
    return {v[k]: k[2:] for k in v if k.startswith('d:')}


# ── Discord ───────────────────────────────────────────────────────────────
def avatares_del_servidor(s, gid):
    """`{discord_id: hash_o_None}` de los miembros, paginado por `after`."""
    out, after, pag = {}, '0', 0
    while True:
        for _ in range(5):
            r = s.get('%s/guilds/%s/members' % (API_DC, gid),
                      params={'limit': 1000, 'after': after}, timeout=40)
            if r.status_code == 429:
                time.sleep(float(r.json().get('retry_after', 1)) + .3)
                continue
            break
        if r.status_code != 200:
            sys.exit('no pude listar miembros: %s %s' % (r.status_code, r.text[:160]))
        lote = r.json()
        if not lote:
            break
        for m in lote:
            u = m.get('user') or {}
            if u.get('id'):
                # 🔴 `u['avatar']`, NO `m['avatar']`. Ver el encabezado: el del
                # miembro es el de ESE servidor y la carta es una sola.
                out[u['id']] = u.get('avatar')
        pag += 1
        # 🔴 `key=int` NO ES COSMETICO: los snowflakes tienen 17, 18 y 19
        # dígitos y `max()` sobre cadenas compara alfabéticamente, así que el
        # cursor puede RETROCEDER. Está medido en `cruzar_miembros.py`.
        after = max((((m.get('user') or {}).get('id')) or '0' for m in lote), key=int)
        print('   pagina %d  ->  %d miembros' % (pag, len(out)))
        if len(lote) < 1000:
            break
    return out


def url_avatar(did, hash_):
    """La URL del CDN. `None` si la persona no tiene foto puesta.

    ⚠️ SE PIDE `.png` AUNQUE EL AVATAR SEA ANIMADO. Los hash que empiezan con
    `a_` son GIF; pidiendo `.png` el CDN devuelve el cuadro estático, que es
    lo que la carta necesita — un GIF adentro de un PNG transparente no se
    anima igual y pesa diez veces más.
    """
    if not hash_:
        return None
    return '%s/avatars/%s/%s.png?size=%d' % (CDN, did, hash_, LADO)


# ── R2 ────────────────────────────────────────────────────────────────────
ETAGS = os.path.join(BASE, 'datos', 'fotos_etag.json')


def etags(s=None):
    """{clave: etag} de las fotos de esta temporada en R2.

    🔴 EXISTE PARA QUE EL CICLO SE ENTERE DE UN `/foto`. El sello de las
    cartas saca la `av` a proposito —esa URL cambia de hash sin que cambie
    la cara— asi que una foto nueva **no redibujaba nada**. Y el mecanismo
    que el proyecto señalaba para esto, `bot/rehacer.py --cambiaron`, mira
    `git status` sobre `_avatares/`: las fotos de `/foto` llegan a R2 y el
    espejo esta gitignoreado, o sea que no las ve.

    ⚠️ EL `etag` ES UN HASH DEL CONTENIDO, y por eso sirve donde la fecha
    no: bajar la misma foto otra vez mueve el mtime y no el etag. Es la
    misma regla que `rehacer.py` ya tenia escrita — *«pregunta por el
    contenido, no por la fecha»*— con la fuente correcta.

    ⚠️ Y CUESTA UN LISTADO, NO UNA DESCARGA. Son 443 objetos en una
    pagina; bajarlos son 34 s y esto es menos de uno. Por eso se puede
    preguntar en **cada** corrida, que es lo que hace falta para que una
    foto nueva se vea en la vuelta siguiente y no cuando alguien se acuerde.

    ⚠️ SI R2 NO CONTESTA SE DEVUELVE LO ULTIMO QUE SE SUPO, no `{}`. Un
    diccionario vacio haria que **todas** las huellas cambien a la vez y
    el ciclo redibuje las 320 por una caida de red.
    """
    guardado = {}
    try:
        with io.open(ETAGS, encoding='utf-8') as f:
            guardado = json.load(f) or {}
    except (OSError, ValueError):
        pass
    if s is None:
        return guardado
    # 🔴 EL PREFIJO SALE DE `carpeta_r2()`, NO DE UNA CADENA ARMADA ACA.
    # Lo escribi a mano al agregar la sal y esto dio **0 fotos**: es la
    # forma que CLAUDE.md llama «un default que no es la decision»,
    # cometida en el mismo dia que se agrego la funcion que la evita.
    pref = carpeta_r2()
    try:
        out, cursor = {}, None
        while True:
            q = {'per_page': 1000, 'prefix': pref}
            if cursor:
                q['cursor'] = cursor
            r = s.get(API_R2 + '/objects', params=q, timeout=60)
            d = r.json()
            if not d.get('success'):
                return guardado
            for o in d.get('result') or []:
                k = o['key']
                if k.endswith('.webp'):
                    out[k[len(pref):-5]] = o.get('etag') or ''
            cursor = (d.get('result_info') or {}).get('cursor')
            if not cursor:
                break
    except Exception:                                    # noqa: BLE001
        return guardado
    if out != guardado:
        os.makedirs(os.path.dirname(ETAGS), exist_ok=True)
        with io.open(ETAGS, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(out, f, ensure_ascii=False, indent=1, sort_keys=True)
    return out


def ya_en_r2(s):
    """Las claves que ya están bajo `fotos/<temporada>/`."""
    tengo, cur = {}, None
    # 🔴 EL PREFIJO SALE DE `carpeta_r2()`, NO DE UNA CADENA ARMADA ACA.
    # Lo escribi a mano al agregar la sal y esto dio **0 fotos**: es la
    # forma que CLAUDE.md llama «un default que no es la decision»,
    # cometida en el mismo dia que se agrego la funcion que la evita.
    pref = carpeta_r2()
    while True:
        q = {'per_page': 1000, 'prefix': pref}
        if cur:
            q['cursor'] = cur
        d = s.get(API_R2 + '/objects', params=q, timeout=40).json()
        if not d.get('success'):
            sys.exit('R2: %s' % str(d.get('errors'))[:200])
        for o in d['result']:
            tengo[o['key']] = o['size']
        cur = (d.get('result_info') or {}).get('cursor')
        if not cur:
            break
    return tengo


def a_webp(datos, calidad=90):
    from PIL import Image
    im = Image.open(io.BytesIO(datos))
    # ⚠️ SE CONSERVA EL ALFA. Hay avatares con transparencia y la carta los
    # funde contra la bandera por los cuatro bordes: aplanarlos contra blanco
    # dejaría un halo recto justo donde el fundido tiene que integrar.
    if im.mode not in ('RGBA', 'RGB'):
        im = im.convert('RGBA')
    fuera = io.BytesIO()
    im.save(fuera, 'WEBP', quality=calidad, method=6)
    return fuera.getvalue(), im.size


def subir(s, clave, datos, intentos=3):
    for n in range(intentos):
        try:
            r = s.put('%s/objects/%s' % (API_R2, clave), data=datos,
                      headers={'Content-Type': 'image/webp'}, timeout=60)
            if r.status_code < 300:
                return None
            ultimo = '%s %s' % (r.status_code, r.text[:90])
        except Exception as e:                       # noqa: BLE001
            ultimo = str(e)[:90]
        time.sleep(1.5 * (n + 1))
    return ultimo


# ── lo que se corre ───────────────────────────────────────────────────────
def espejo(s):
    """Baja R2 -> `comun/fotos/<temporada>/`, que es de donde leen las cartas.

    ⚠️ R2 ES LA FUENTE Y ESTO ES EL CACHE, no al reves. La foto tiene que
    sobrevivir a la temporada y a esta maquina; por eso el original vive en
    R2 y la carpeta local esta en `.gitignore`. Son 10,4 MB de fotos de
    personas reales: meterlas al historial de git las vuelve permanentes,
    tambien para el que despues se vaya.

    ⚠️ SE SALTEA LO QUE YA ESTA CON EL MISMO PESO. Bajar 307 archivos cada
    vez que corre el pipeline es tiempo regalado, y el peso alcanza para
    detectar una foto cambiada porque una foto nueva **no pesa igual**.

    ⚠️ **EN PARALELO, PORQUE ES LATENCIA Y NO ANCHO DE BANDA.** Medido el
    21/09/2026 contra una carpeta vacia —que es lo que ve un runner nuevo,
    donde el salteo de arriba no ahorra nada—: **507 ms por objeto** para
    traer **25 KB**, o sea 50 KB/s. Eso no es una red lenta, es el viaje
    de ida y vuelta; bajar de a uno daba **225 s** para los 443. Con ocho
    hilos el viaje se solapa y el total cae a lo que tarde el mas lento.
    Mismo `max_workers=8` que `bot/subir_cartas.py`, por la misma razon.
    """
    import concurrent.futures as cf

    dest = carpeta_fotos()
    os.makedirs(dest, exist_ok=True)
    tengo = ya_en_r2(s)

    faltan, iguales = [], 0
    for k, tam in sorted(tengo.items()):
        local = os.path.join(dest, os.path.basename(k))
        if os.path.exists(local) and os.path.getsize(local) == tam:
            iguales += 1
        else:
            faltan.append((k, local))

    def _bajar(par):
        k, local = par
        r = s.get('%s/objects/%s' % (API_R2, k), timeout=60)
        if r.status_code != 200:
            return k, r.status_code
        # ⚠️ AL LADO Y DESPUES RENOMBRAR. Si el job se corta a mitad de un
        # `write`, queda un .webp truncado con el peso equivocado — y como
        # el salteo compara PESO, la corrida siguiente lo vuelve a bajar
        # igual, pero mientras tanto la carta se dibuja con una foto rota.
        # `os.replace` es atomico, asi que el archivo o esta entero o no
        # esta.
        tmp = local + '.parcial'
        with open(tmp, 'wb') as f:
            f.write(r.content)
        os.replace(tmp, local)
        return k, None

    nuevas, malas = 0, []
    if faltan:
        with cf.ThreadPoolExecutor(max_workers=8) as pool:
            for k, err in pool.map(_bajar, faltan):
                if err is None:
                    nuevas += 1
                else:
                    malas.append((k, err))
    for k, err in malas[:10]:
        print('   🔴 %s  %s' % (k, err))
    print('\n  espejo en %s' % os.path.relpath(dest, BASE))
    print('   %d nueva(s)  ·  %d ya estaban  ·  %d en total'
          % (nuevas, iguales, len(tengo)))
    if malas:
        print('   🔴 %d no se pudieron bajar' % len(malas))
    return len(tengo)


def desde_disco(s, dry=True):
    """Sube a R2 las caras que SOLO existen en `_avatares/`.

    🔴 EL ESLABON QUE FALTABA, Y SIN EL NO SE PUEDE SACAR NADA DE GIT.

    Medido el 21/09/2026: `_avatares/` tiene **422** caras y R2 **307**.
    Las 115 de diferencia se bajaron en su momento de la `av` del pool
    —URLs que despues murieron— y de esa gente **119 ya no esta en DRA**,
    asi que `--bajar` no las puede volver a traer: Discord no las muestra.

    ⚠️ ESO CONVIERTE A GIT EN LA UNICA COPIA de 115 caras, y por eso
    sacar `_avatares/` del repo **rompe las cartas en la nube**. Medido
    escondiendo la carpeta: de **112 de 138 con cara se cae a 15**, en
    silencio, porque el respaldo cae en la inicial sin avisar.

    Este modo invierte esa dependencia: pasa las 115 a R2, que es donde
    `CLAUDE.md` dice que tienen que estar —*«R2 es la fuente y
    `comun/fotos/` el espejo local»*—. Recien despues git puede dejar de
    guardarlas.

    ⚠️ NO PISA LO QUE YA ESTA. Lo de R2 salio de Discord con el hash
    vigente; lo de disco es de una URL que ya no responde. Entre las dos,
    la de Discord es la buena.
    """
    import glob
    tengo = ya_en_r2(s)
    dir_av = os.path.join(BASE, '03_Servidor', 'disenos', '_avatares')
    if not os.path.isdir(dir_av):
        print('   no existe %s' % dir_av)
        return 0, 0
    subidas = saltadas = fallaron = 0
    for p in sorted(glob.glob(os.path.join(dir_av, '*.png'))):
        nombre = os.path.splitext(os.path.basename(p))[0]
        clave = clave_de(nombre)
        if clave in tengo:
            saltadas += 1
            continue
        if dry:
            subidas += 1
            continue
        try:
            with io.open(p, 'rb') as f:
                datos, tam = a_webp(f.read())
        except Exception as e:                       # noqa: BLE001
            print('      ⚠️ %-16s no pude leerla (%s)' % (nombre, str(e)[:40]))
            fallaron += 1
            continue
        mal = subir(s, clave, datos)
        if mal:
            print('      ⚠️ %-16s %s' % (nombre, mal))
            fallaron += 1
        else:
            subidas += 1
    return subidas, saltadas, fallaron


def main():
    ver = '--ver' in sys.argv
    bajar = '--bajar' in sys.argv
    todas = '--todas' in sys.argv
    limite = None
    if '--limite' in sys.argv:
        limite = int(sys.argv[sys.argv.index('--limite') + 1])
    esp = '--espejo' in sys.argv
    disco = '--desde-disco' in sys.argv
    if not (ver or bajar or esp or disco):
        print(__doc__)
        return

    r2 = requests.Session()
    r2.headers['Authorization'] = 'Bearer ' + env('CLOUDFLARE_API_TOKEN')

    if disco:
        aplicar = '--aplicar' in sys.argv
        print('\n══ LAS QUE SÓLO ESTÁN EN `_avatares/` ══\n')
        n, hay, mal = desde_disco(r2, dry=not aplicar)
        if aplicar:
            print('   %d subidas a R2 · %d ya estaban · %d fallaron'
                  % (n, hay, mal))
            if n:
                print('\n   ⚠️ Ahora actualizá el espejo local para que las '
                      'cartas\n      las lean desde R2: '
                      '`python bot/fotos.py --espejo`')
        else:
            print('   %d subiría · %d ya están en R2' % (n, hay))
            print('\n   (simulacro: no subí nada — corré con --aplicar)')
        print('')
        if not (ver or bajar or esp):
            return

    if esp:
        # ⚠️ EL ESPEJO NO PIDE EL TOKEN DE DISCORD, y es a proposito: es el
        # paso que corre en Actions antes de dibujar, y cuantos menos
        # secretos necesite ese paso, mejor.
        espejo(r2)
        if not (ver or bajar):
            print('')
            return
    tok = env('DISCORD_TOKEN')
    dc = requests.Session()
    dc.headers['Authorization'] = 'Bot ' + tok

    porid = gente_con_id()
    print('\n  %d personas con Discord ID en KV' % len(porid))

    print('\n  mirando R2  (fotos/%s/)' % TEMPORADA)
    tengo = ya_en_r2(r2)
    print('   %d foto(s) guardadas' % len(tengo))

    print('\n  mirando los miembros de DRA')
    av = avatares_del_servidor(dc, guild('DRA'))

    # ── el reparto ────────────────────────────────────────────────────────
    listos, sin_foto, fuera, faltan = [], [], [], []
    for nombre, did in sorted(porid.items()):
        k = clave_de(nombre)
        if k in tengo and not todas:
            listos.append(nombre)
            continue
        if did not in av:
            # ⚠️ NO ES LO MISMO QUE «no tiene foto». Esta persona está en el
            # padrón de la Liga y **no está en DRA**, así que su avatar no lo
            # podemos ver desde acá. Se cuenta aparte porque la acción es
            # otra: no es esperar a que se ponga una foto, es que entre.
            fuera.append(nombre)
            continue
        if not av[did]:
            sin_foto.append(nombre)
            continue
        faltan.append((nombre, did, av[did]))

    print('\n══ COMO ESTAMOS ══\n')
    tot = len(porid)
    fila = lambda e, n: print('   %-34s %4d   %5.1f %%' % (e, n, 100 * n / max(1, tot)))
    fila('ya tienen su foto de la %s' % TEMPORADA.upper(), len(listos))
    fila('se pueden bajar ahora', len(faltan))
    fila('no se pusieron foto en Discord', len(sin_foto))
    fila('no están en DRA (no se puede ver)', len(fuera))
    print('   %-34s %4d' % ('', tot))

    if sin_foto:
        print('\n   ⚠️ Los que no se pusieron foto NO se guardan: Discord da un')
        print('      blob gris por defecto y la inicial con el color del rango')
        print('      es mejor carta que ese gris.')
    if fuera[:1]:
        print('\n   ⚠️ %d no están en DRA. Ejemplos: %s'
              % (len(fuera), ', '.join(fuera[:6])))

    if ver or not faltan:
        if not faltan:
            print('\n  nada que bajar.\n')
        else:
            print('\n  (esto fue `--ver`: no se bajó nada)\n')
        return

    if limite:
        faltan = faltan[:limite]
        print('\n  --limite %d: sólo las primeras %d' % (limite, len(faltan)))

    print('\n══ BAJANDO Y SUBIENDO ══\n')
    ok = mal = 0
    chico = []
    for i, (nombre, did, h) in enumerate(faltan, 1):
        u = url_avatar(did, h)
        try:
            r = requests.get(u, timeout=30)
            if r.status_code != 200:
                print('   🔴 %-16s el CDN dio %s' % (nombre, r.status_code))
                mal += 1
                continue
            datos, tam = a_webp(r.content)
        except Exception as e:                       # noqa: BLE001
            print('   🔴 %-16s %s' % (nombre, str(e)[:60]))
            mal += 1
            continue
        # ⚠️ SE MIRA EL ANCHO DE LA IMAGEN, NO QUE EL ARCHIVO EXISTA. Es la
        # lección de `herramientas/bajar_avatares.py`: con «ya está» mirando
        # el archivo, el arreglo del tamaño no habría llegado a ninguna de las
        # que ya estaban guardadas a 128 px.
        chico.append(tam[0])
        err = subir(r2, clave_de(nombre), datos)
        if err:
            print('   🔴 %-16s R2: %s' % (nombre, err))
            mal += 1
            continue
        ok += 1
        if i % 25 == 0 or i == len(faltan):
            print('   %d/%d  (%d subidas, %d fallaron)' % (i, len(faltan), ok, mal))

    print('\n  ✅ %d foto(s) subidas a fotos/%s/' % (ok, TEMPORADA))
    if chico:
        # ⚠️ LA DISTRIBUCIÓN, NO EL PROMEDIO. El CDN no agranda —ver el
        # encabezado—, así que lo que hay que poder ver es **cuántas caras
        # van a salir blandas igual**. Un promedio de 240 px escondería que
        # hay un grupo en 128.
        from collections import Counter
        c = Counter(chico)
        print('\n  Tamaños que devolvió el CDN (la carta dibuja a %d px):'
              % ANCHO_CARTA)
        for w in sorted(c):
            marca = '✅' if w >= ANCHO_CARTA else '⚠️ se agranda %.1fx' % (ANCHO_CARTA / w)
            print('     %4d px   %3d foto(s)   %s' % (w, c[w], marca))
        peor = sum(n for w, n in c.items() if w < ANCHO_CARTA)
        print('     ── %d de %d quedan por debajo (%.0f %%)'
              % (peor, len(chico), 100 * peor / len(chico)))
    if mal:
        # ⚠️ UN 404 SUELTO NO ES UN FALLO DEL SCRIPT: ES EL BUG DE LOS
        # AVATARES VISTO EN LA FUENTE. Medido el 20/09/2026: `ropomc` tiene
        # un hash que la lista de miembros devuelve y que el CDN ya no sirve
        # —404 en `.png`, `.gif`, `.webp` y `.jpg`—. O sea que ni la lista
        # fresca de Discord garantiza un hash vivo.
        #
        # 🔴 Y POR ESO EL CORTE ES PORCENTUAL. Si esto saliera con error por
        # uno solo, la corrida quedaría en rojo para siempre y nadie miraría
        # el día que fallen doscientos. Si fallara en silencio, un token
        # vencido —que hace fallar TODO— pasaría por «un par de 404».
        parte = 100.0 * mal / max(1, len(faltan))
        print('\n  ⚠️ %d de %d no se pudieron bajar (%.1f %%)'
              % (mal, len(faltan), parte))
        if parte > 10:
            print('  🔴 Eso es demasiado para ser hashes muertos sueltos: '
                  'mirá el token y la conexión.')
            sys.exit(1)
        print('  (son hashes que el CDN ya no sirve; esa gente cae en la '
              'inicial, que es el comportamiento correcto)')
    print('')


if __name__ == '__main__':
    main()
