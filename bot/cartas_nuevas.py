# -*- coding: utf-8 -*-
"""LA CARTA DE SERVIDOR DE LOS QUE ESTAN EN LA LIGA Y NO TIENEN NINGUNA.

    python bot/cartas_nuevas.py               el plan, sin tocar nada
    python bot/cartas_nuevas.py --avatares    baja las fotos que faltan
    python bot/cartas_nuevas.py --generar     dibuja las cartas
    python bot/cartas_nuevas.py --generar --limite 50   de a tandas

Dlx, 19/09/2026: la Servidor va desbloqueada para todos, y «todos» es la Lista
de Raperos —la Liga— y no el Ranking. Lil Drako estaba en la Lista, verificado
y con ID, y no tenia ninguna carta porque el generador solo dibuja a los del
pool (138 con 8+ eventos). No era un caso raro: son 331 personas, mas que las
que SI tienen carta.

⚠️ UNA CARTA POR SERVIDOR DONDE ESTA, no una sola. Es la opcion (a) que eligio
Dlx: quien esta en DRA y en FFA lleva las dos, y `/card` abre la del servidor
desde donde escribio. De ahi que 331 personas den 464 cartas.

⚠️ DE QUE SERVIDOR ES CADA UNO SE LE PREGUNTA A DISCORD, no al Sheet. El `sv`
del pool sale del argmax de 7 columnas de puntos, y por eso a Lil Drako le
aparecia Fontana cuando solo jugo en DRA. Estar en un servidor es un hecho que
Discord sabe; deducirlo de los puntos era adivinar.

⚠️ SIN EVENTOS NO HAY NUMEROS, HAY GUIONES. Ver `val()` en todos_sv.py: cero y
«no hay» no son lo mismo. Estas 331 no compitieron, asi que su carta sale con
«—» y la pastilla dice NOVATO, que es lo que corresponde.

⚠️ ES RESUMIBLE A PROPOSITO. Son ~464 renders de unos 13 s: hora y media larga.
Salta lo que ya esta hecho, asi que se puede cortar y seguir.
"""
import asyncio
import importlib.util
import io
import json
import os
import re
import sys
import time
import urllib.request

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, BASE)
sys.path.insert(0, os.path.join(BASE, 'sheet'))

from comun.claves import clave as CLAVE   # noqa: E402

LISTA = os.path.join(os.environ.get('TEMP', '/tmp'), 'faltan_cartas.json')
AVATARES = os.path.join(BASE, '03_Servidor', 'disenos', '_avatares')
SALIDA = os.path.join(BASE, '03_Servidor', 'salida')
API = 'https://discord.com/api/v10'
CDN = 'https://cdn.discordapp.com'


def env(clave):
    for l in io.open(os.path.join(BASE, '.env'), encoding='utf-8'):
        if l.strip().startswith(clave + '='):
            return l.split('=', 1)[1].strip().strip('"\'')
    sys.exit('falta %s en .env' % clave)


def limpio(nombre):
    n = re.sub(r'[^\w\s-]', '', nombre, flags=re.UNICODE).strip()
    return re.sub(r'\s+', '_', n).lower() or 'sin_nombre'


def _slug(s):
    """La clave de esa persona. Vive en `comun/claves.py`, no aca.

    🔴 ESTA FUNCION ESTUVO MAL DE TRES MANERAS DISTINTAS EN UN SOLO DIA, y
    ninguna tiraba un error. Con `[^a-z0-9]`: **Ññ** y **Ржунимагу** quedaban
    en la cadena vacia y sus cartas se pisaban entre si; **Lázaro** quedaba en
    `lzaro` y se subia a una clave que el bot nunca consulta. Copiar la regla
    era el problema, asi que ahora hay una sola.
    """
    return CLAVE(s)
def cargar_lista():
    if not os.path.exists(LISTA):
        sys.exit('falta la lista: %s\n   (la arma el paso de medicion)' % LISTA)
    return json.load(io.open(LISTA, encoding='utf-8'))


def todos_los_que_tienen_carta():
    """Los 472, no los 331. Para bajar fotos hay que mirarlos a todos.

    ⚠️ LA LISTA DE LOS 331 ES «A QUIEN LE FALTA CARTA», y para las fotos esa
    no es la pregunta: los 138 del pool tambien tienen la foto chica o no
    tenerla. Medido, 292 de 472 estaban a 256 px, y la mayoria son del pool.
    """
    import construir_padron as PAD
    with io.open(os.path.join(BASE, 'datos', 'cartas_r2.json'), encoding='utf-8') as f:
        inv = json.load(f)
    idx = PAD.por_nombre()
    out = []
    for k in sorted(inv):
        p = idx.get(k) or {}
        did = p.get('discord_id')
        if did:
            out.append({'raw': p.get('raw') or k, 'id': did,
                        'pais': p.get('pais') or '', 'svs': []})
    return out


def cc_de_pais():
    """{nombre de pais -> codigo de 2 letras}, deducido de los datos que hay.

    ⚠️ NO SE INVENTA EL CODIGO. El pool trae `cc` y el padron trae el nombre;
    cruzando los dos sale el mapa real que ya usa el proyecto, sin tener que
    escribir a mano una tabla que despues discrepe.
    """
    import construir_padron as PAD
    idx = {PAD.norm(x['raw']): x for x in PAD.cargar()}
    mapa = {}
    for x in json.load(io.open(os.path.join(BASE, 'datos', 'competitivo_pool.json'),
                               encoding='utf-8')):
        pais = (idx.get(PAD.norm(x['raw'])) or {}).get('pais')
        if pais and x.get('cc'):
            mapa.setdefault(pais.strip(), x['cc'])
    return mapa


# ── las fotos ─────────────────────────────────────────────────────────────
# La carta dibuja el avatar a 345 px de ancho. Por debajo de esto lo AGRANDA,
# y ahí es donde se ve blando.
ANCHO_MINIMO = 400


def _ya_esta(destino):
    """¿La foto que hay en disco sirve? Se mira el ANCHO, no que exista.

    🔴 ESTA LECCIÓN YA ESTABA ESCRITA Y LA VOLVÍ A ROMPER. `CLAUDE.md`, sobre
    `herramientas/bajar_avatares.py`: *«su chequeo de "ya está" mira el ancho
    de la imagen y no si el archivo existe — con lo segundo el arreglo no
    habría llegado a ninguno de los ya guardados»*. Este archivo nació con
    `os.path.exists()` y el resultado fue exactamente el predicho: **292 de
    472 quedaron a 256 px**, agrandándose 2.7 veces en la carta, y ninguna
    corrida posterior las iba a tocar porque el archivo ya estaba.

    ⚠️ El `?size=` de la URL NO es parte del hash: la misma foto se puede
    volver a pedir más grande sin que Discord la considere otra.
    """
    if not os.path.exists(destino) or os.path.getsize(destino) <= 1024:
        return False
    try:
        from PIL import Image
        return Image.open(destino).width >= ANCHO_MINIMO
    except Exception:
        return False        # ilegible = no sirve, y se vuelve a bajar


def bajar_avatares(gente):
    import requests
    s = requests.Session()
    s.headers['Authorization'] = 'Bot ' + env('DISCORD_TOKEN')
    os.makedirs(AVATARES, exist_ok=True)
    hechas, ya, sin = 0, 0, []
    for n, p in enumerate(gente, 1):
        destino = os.path.join(AVATARES, limpio(p['raw']) + '.png')
        if _ya_esta(destino):
            ya += 1
            continue
        for _ in range(4):
            r = s.get('%s/users/%s' % (API, p['id']), timeout=20)
            if r.status_code == 429:
                time.sleep(float(r.json().get('retry_after', 1)) + .2)
                continue
            break
        h = r.json().get('avatar') if r.status_code == 200 else None
        if not h:
            sin.append(p['raw'])
            continue
        u = '%s/avatars/%s/%s.png?size=1024' % (CDN, p['id'], h)
        try:
            req = urllib.request.Request(u)
            req.add_header('User-Agent', 'Mozilla/5.0')
            datos = urllib.request.urlopen(req, timeout=25).read()
            # ⚠️ NUNCA UN ARCHIVO VACIO: despues se lee como avatar valido y
            # la carta sale en blanco sin avisar.
            if len(datos) < 1024:
                sin.append(p['raw'])
                continue
            io.open(destino, 'wb').write(datos)
            hechas += 1
        except Exception:
            sin.append(p['raw'])
        if n % 40 == 0:
            print('   %d de %d...' % (n, len(gente)))
        time.sleep(0.12)
    print('\n  fotos bajadas: %d   ·   ya estaban: %d   ·   sin foto: %d'
          % (hechas, ya, len(sin)))
    if sin:
        print('   (sin foto, saldran con la inicial: %s%s)'
              % (', '.join(sin[:10]), ' …' if len(sin) > 10 else ''))


# ── las cartas ────────────────────────────────────────────────────────────
def generar(gente, limite=None):
    from comun import respaldo
    mapa_cc = cc_de_pais()
    os.chdir(os.path.join(BASE, '03_Servidor'))
    spec = importlib.util.spec_from_file_location('svgen', 'generar.py')
    G = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(G)

    # 🔴 LO QUE YA ESTA EN R2 NO SE REDIBUJA. Este script preguntaba solo por
    # el PNG en `03_Servidor/salida/`, y el pipeline **borra esos PNG despues
    # de subirlos** —a proposito: «R2 es la copia que importa; el disco es un
    # intermedio»—. Asi que despues de la primera corrida del ciclo la carpeta
    # queda vacia y esto dice «faltan 464» de cartas que estan todas arriba:
    # media hora de Chromium para volver a subir lo mismo.
    #
    # ⚠️ Es la trampa de siempre al reves. Las tres veces documentadas, mirar
    # el disco daba por bueno lo VIEJO; aca da por ausente lo que existe. El
    # disco no es la fuente en ninguno de los dos sentidos — `cartas_r2.json`
    # es el inventario de lo que esta publicado.
    try:
        with io.open(os.path.join(BASE, 'datos', 'cartas_r2.json'),
                     encoding='utf-8') as _f:
            _en_r2 = json.load(_f)
    except (OSError, ValueError):
        _en_r2 = {}
    pend = []
    for p in gente:
        for sv in p['svs']:
            destino = os.path.join(SALIDA, 'sv-%s_%s.png' % (sv.lower(), _slug(p['raw'])))
            if ('sv-' + sv.lower()) in (_en_r2.get(_slug(p['raw'])) or {}):
                continue                  # ya publicada
            if not os.path.exists(destino):
                pend.append((p, sv))
    print('  faltan dibujar: %d de %d' % (len(pend), sum(len(p['svs']) for p in gente)))
    if limite:
        pend = pend[:limite]
        print('  (esta tanda: %d)' % len(pend))
    if not pend:
        print('  no queda nada\n')
        return

    # 🔴 UN CHROMIUM POR CARTA. `G.dibujar()` ya sabe recibir VARIAS personas y
    # las dibuja todas en una sola sesión —abre el navegador una vez y hace un
    # `goto` por carta—, pero acá se lo llamaba con `[persona]`, o sea con una
    # lista de uno. Medido con las MISMAS seis cartas por los dos caminos:
    #
    #     de a una      6.48 s por carta     464 cartas = 50 min
    #     en tanda      3.35 s por carta     464 cartas = 26 min
    #
    # 1.9x, o sea 48 % menos. El arranque de Chromium son ~3 s y se estaba
    # pagando una vez por carta.
    #
    # ⚠️ NO ES 5x, Y LA PRIMERA CUENTA QUE HICE DECIA QUE SÍ. Saqué el «0.7 s
    # por carta» de `bot/bloqueadas.py`, que agrupa de a ocho — pero la
    # Bloqueada es una silueta gris con texto y ésta lleva fondo, marco,
    # escudo, estrellas, avatar y un recorte con PIL. Ese 0.7 medía la carta,
    # no el navegador. Dos cartas distintas no se comparan por tiempo; hay que
    # correr LAS MISMAS por los dos caminos, que es de donde salen los números
    # de arriba.
    #
    # ⚠️ SE AGRUPA POR SERVIDOR PORQUE EL PREFIJO ES POR TANDA. `dibujar()`
    # nombra los archivos con un solo prefijo, que es la clave en R2: mezclar
    # servidores en una tanda le pondría `sv-dra` a la carta de FFA.
    #
    # ⚠️ Y EN TANDAS DE 20, NO TODAS DE UNA. Si una revienta se pierde la
    # tanda entera —ya pasó con País, donde una persona sin servidor costó 58
    # cartas—, así que el tamaño es cuánto se está dispuesto a perder.
    POR_TANDA = 20
    hechas = 0
    t0 = time.time()
    porsv = {}
    for p, sv in pend:
        porsv.setdefault(sv, []).append(p)

    def _persona(p, sv):
        return {
            'nombre': p['raw'], 'sv': sv, 'rango': 'E',
            'cc': mapa_cc.get((p.get('pais') or '').strip(), ''),
            'pos_sv': 0, 'tot_sv': 0, 'pos_pais': 0, 'tot_pais': 24,
            'rango_pos': (0, 0),
            'ovr': 0, 'titulos': 0, 'podios': 0, 'eventos': 0,
            'racha': '0/0', 'duelos': '0/0',
            'foto': respaldo.avatar(p['raw'], ''),
        }

    # ⚠️ EL RECORTE NO DEPENDE DE LA TANDA, ASI QUE AGRUPAR NO CAMBIA EL PNG.
    # Era la duda razonable: `generar.dibujar()` termina en `TS.recortar()`, y
    # esa funcion dice arriba de todo que se recorta «a una caja COMUN» — si la
    # caja fuera la union de la tanda, la misma carta saldria de un tamaño
    # distinto segun con quien le tocara salir, y en Discord eso es tamaño en
    # el chat. Ya paso: es el 🔴 de `todos_sv.recortar()`. Hoy la caja es
    # `CAJA_SET`, fija y medida sobre los diez fondos, asi que el archivo sale
    # igual de a uno o de a veinte. Si alguien vuelve a hacerla depender de los
    # archivos que recibe, ESTE agrupamiento empieza a cambiar el resultado.
    for sv in sorted(porsv):
        gsv = porsv[sv]
        for i in range(0, len(gsv), POR_TANDA):
            lote = gsv[i:i + POR_TANDA]
            try:
                asyncio.run(G.dibujar([_persona(p, sv) for p in lote],
                                      'sv-%s' % sv.lower()))
                hechas += len(lote)
            except Exception as e:
                # ⚠️ SE DICE A QUIENES SE LLEVO PUESTO, no solo que fallo. Una
                # tanda que revienta son 20 cartas, y sin los nombres no hay
                # manera de saber cuales volver a pedir.
                print('   ⚠️ %s x%d: %s' % (sv, len(lote), str(e)[:70]))
                print('      (%s)' % ', '.join(p['raw'] for p in lote[:6]))
            if hechas:
                seg = (time.time() - t0) / hechas
                print('   %d de %d   ·   %.1f s/carta   ·   faltan ~%d min'
                      % (hechas, len(pend), seg, (len(pend) - hechas) * seg / 60))
    print('\n  ✅ cartas dibujadas: %d de %d   (%.0f min)'
          % (hechas, len(pend), (time.time() - t0) / 60))


def main():
    gente = cargar_lista()
    cartas = sum(len(p['svs']) for p in gente)
    print('\n%d personas · %d cartas (una por servidor donde estan)' % (len(gente), cartas))
    # ⚠️ SE CUENTA LO PUBLICADO, NO LOS ARCHIVOS. Ver el comentario de
    # `_en_r2` mas arriba: el pipeline borra los PNG despues de subirlos.
    try:
        with io.open(os.path.join(BASE, 'datos', 'cartas_r2.json'),
                     encoding='utf-8') as _f:
            _inv = json.load(_f)
    except (OSError, ValueError):
        _inv = {}
    hechas = sum(
        1 for p in gente for sv in p['svs']
        if ('sv-' + sv.lower()) in (_inv.get(_slug(p['raw'])) or {})
        or os.path.exists(os.path.join(SALIDA, 'sv-%s_%s.png'
                                       % (sv.lower(), _slug(p['raw'])))))
    print('   ya dibujadas: %d   ·   faltan: %d' % (hechas, cartas - hechas))

    if '--avatares' in sys.argv:
        # ⚠️ POR DEFECTO, TODOS LOS QUE TIENEN CARTA. La lista de los 331 es
        # «a quién le falta carta», que no es la pregunta de las fotos.
        quienes = gente if '--solo-nuevos' in sys.argv else todos_los_que_tienen_carta()
        print('\nbajando las fotos de %d persona(s) con Discord ID...' % len(quienes))
        bajar_avatares(quienes)
    if '--generar' in sys.argv:
        lim = None
        for a in sys.argv:
            if a.startswith('--limite='):
                lim = int(a.split('=')[1])
        print('\ndibujando...')
        generar(gente, lim)
    if '--avatares' not in sys.argv and '--generar' not in sys.argv:
        print('\n  (nada hecho — usá --avatares y después --generar)\n')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()
