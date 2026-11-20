# -*- coding: utf-8 -*-
"""🎞️ LOS GIF DEL DRAGÓN DROP PARA EL BOT (20/11/2026).

Dlx, con una captura del «Drop abierto» que contestaba el bot: *«abrir un drop debería generar como un gif de la
animación del drop moviéndose poco a poco y si le das click al botón tap, ahí evoluciona, o no, así como el real drop de
la página es, y puedes presionar 4 veces… Y al finalizar cambia el gif a abrir uno osea como es el verdadero y ahí
consigues la recompensa»*.

Un Worker no dibuja, así que los GIF se graban una vez y viven en R2. **Son la animación de la página, no una copia**:
`gif_drops/escena.js` monta `mostrarDrops()` de `web/src/drops_show.js` tal cual, con un drop de mentira cuyo
resultado se elige, y acá se toca como lo haría una persona mientras se graba (CDP, ~30 cuadros por segundo). Si la
animación de la página cambia, se vuelven a grabar y se sube la `VERSION`.

    python herramientas/gif_drops.py               graba y arma todos en salida_gif_drops/ (no sube nada)
    python herramientas/gif_drops.py --solo drop:2 sólo los de esa animación y rareza, para mirar
    python herramientas/gif_drops.py --subir       sube los de salida_gif_drops/ a R2 (drops/gif/<VERSION>/)
    python herramientas/gif_drops.py --auto        self-check sin navegador: los nombres que pide el Worker existen acá

Los estados (los arma `nombres()`, y `gifDrop()` de bot/worker.js los pide con el mismo nombre):
    <anim>-entra-<r>   llega y queda quieto en la rareza r (lo primero que se ve)
    <anim>-nada-<r>    un toque que no sube: se sacude y sigue en r
    <anim>-sube-<r>    un toque que sube a r
    <anim>-listo-<r>   los 4 toques hechos, brillando, «toca para abrir» (éste se repite)
    <anim>-abre-<r>    se rompe y muestra los Puntos (el número va en el texto del bot: cambia en cada drop)
    <anim>-titulo-<slug> se rompe y muestra ese título
`anim` es `drop` (el casete que se transforma, rarezas 0–4) o `star` (la escama azul, 2–4). Todos menos `listo` se ven
**una vez** y quedan en el último cuadro, que es el estado en que queda el drop.
"""
import base64
import io
import json
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import time
import unicodedata
from urllib.parse import urlparse

AQUI = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(AQUI)
WEB = os.path.join(BASE, 'web')
SALIDA = os.path.join(BASE, 'salida_gif_drops')
CRUDO = os.path.join(SALIDA, '_armado')
#: la carpeta de R2. Se sube cuando cambian los GIF: Discord guarda la imagen por su dirección
VERSION = 'v1'
CLAVE = 'drops/gif/%s/' % VERSION
LADO = 360          # px del GIF (cuadrado)
FPS = 15
#: las rarezas de cada animación (bot/avisos.js `DROP_RAREZAS`; un Star arranca en Vinilo)
RAREZAS = {'drop': [0, 1, 2, 3, 4], 'star': [2, 3, 4]}
NOMBRE_RZ = ['Maqueta', 'Mixtape', 'Vinilo', 'Disco de Oro', 'Micrófono de Oro']

HTML = """<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
@font-face{font-family:Archivo;font-weight:100 900;font-stretch:62% 125%;src:url(/fonts/archivo-latin-wdth-normal.woff2) format('woff2-variations')}
@font-face{font-family:Archivo;font-weight:100 900;font-stretch:62% 125%;src:url(/fonts/archivo-latin-ext-wdth-normal.woff2) format('woff2-variations');unicode-range:U+0100-02BA}
html,body{margin:0;background:#000}
/* lo que en Discord hace el botón: la ✕, el sonido, los puntitos y «Toca…». Y el número del premio, que cambia */
dialog.dsw .dsw-x,dialog.dsw .dsw-mudo,dialog.dsw .dsw-pie,dialog.dsw .dsw-pr-num,dialog.dsw .dsw-pr-tope{visibility:hidden!important}
/* el fondo quieto: las escamas y los rayos se mueven siempre, así que cada cuadro cambiaba entero y el GIF pesaba 4 MB.
   En dos segundos ese movimiento casi no se ve; quieto, el GIF sólo guarda lo que cambia, que es el drop */
dialog.dsw .dsw-escamas,dialog.dsw .dsw-rayos,dialog.dsw .dsw-pr-rayos{animation-play-state:paused!important}
/* sin los puntitos ni el «Toca…» abajo, ese lugar es del drop: en Discord el GIF se ve chico y el drop tiene que llenarlo */
dialog.dsw{--cab:40px!important;--pie:18px!important}
</style></head><body><div id="host"></div><script type="module" src="/escena.js"></script></body></html>"""
FUENTES = os.path.join(WEB, 'node_modules', '@fontsource-variable', 'archivo', 'files')


def titulos():
    """`{rareza: [títulos]}` de `DROP_TITULOS` (bot/avisos.js), del 2 al 4: los que puede dar un drop o un Star"""
    js = io.open(os.path.join(BASE, 'bot', 'avisos.js'), encoding='utf-8').read()
    m = re.search(r'export const DROP_TITULOS = (\{.*?\});', js, re.S)
    d = json.loads(re.sub(r"'", '"', re.sub(r'(\d+):', r'"\1":', m.group(1))))
    return {int(k): v for k, v in d.items() if 2 <= int(k) <= 4}


def slug(t):
    t = unicodedata.normalize('NFKD', t).encode('ascii', 'ignore').decode('ascii').lower()
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')


def nombres():
    """Todos los GIF, como `{nombre: (anim, estado, rareza, título)}`"""
    out = {}
    T = titulos()
    for anim, rs in RAREZAS.items():
        for r in rs:
            for estado in ('entra', 'nada', 'listo', 'abre'):
                out['%s-%s-%d' % (anim, estado, r)] = (anim, estado, r, '')
            if r > rs[0]:
                out['%s-sube-%d' % (anim, r)] = (anim, 'sube', r, '')
            for t in T.get(r, []):
                out['%s-titulo-%s' % (anim, slug(t))] = (anim, 'titulo', r, t)
    return out


# ── la grabación ─────────────────────────────────────────────────────────────────────────────────────────────────────
def armar_escena(dst):
    r = subprocess.run(['node', os.path.join(AQUI, 'gif_drops', 'armar.mjs'), dst], capture_output=True, text=True, encoding='utf-8')
    if r.returncode or not os.path.exists(os.path.join(dst, 'escena.js')):
        sys.exit('no se armó la escena:\n' + (r.stdout or '') + (r.stderr or ''))


def servidor(build):
    def servir(route, request):
        p = urlparse(request.url).path
        if p in ('/', '/index.html'):
            return route.fulfill(status=200, body=HTML, headers={'content-type': 'text/html; charset=utf-8'})
        if p.startswith('/fonts/'):
            return route.fulfill(status=200, body=open(os.path.join(FUENTES, os.path.basename(p)), 'rb').read(),
                                 headers={'content-type': 'font/woff2'})
        f = os.path.join(build, p.lstrip('/'))
        if os.path.isfile(f):
            tipo = 'text/javascript' if f.endswith('.js') else mimetypes.guess_type(f)[0] or 'application/octet-stream'
            return route.fulfill(status=200, body=open(f, 'rb').read(), headers={'content-type': tipo})
        return route.fulfill(status=404, body='')
    return servir


class Grabadora:
    def __init__(self, pg, cdp):
        self.pg, self.cdp = pg, cdp

    def estado(self):
        return self.pg.evaluate('estado()') or {}

    def grabar(self, accion, listo, extra, maximo=9.0):
        """Hace `accion` (js) y graba hasta que `listo(estado)` y `extra` segundos más. `[(t, jpg)]` y el último estado"""
        self.pg.evaluate(accion)
        cuadros, t0, fin, k, st = [], time.time(), None, 0, {}
        while True:
            d = self.cdp.send('Page.captureScreenshot', {'format': 'jpeg', 'quality': 95, 'optimizeForSpeed': True})
            cuadros.append((time.time(), base64.b64decode(d['data'])))
            k += 1
            if fin is None and k % 3 == 0:
                st = self.estado()
                if time.time() - t0 > 0.25 and listo(st):
                    fin = time.time() + extra
            if (fin and time.time() >= fin) or time.time() - t0 > maximo:
                break
        return cuadros, st or self.estado()

    def escena(self, anim, r_min, r_fin, titulo=''):
        puntos = 10000 if (titulo and r_fin >= 4) else 0 if titulo else 500
        o = json.dumps({'tipo': anim, 'min': r_min, 'fin': r_fin, 'puntos': puntos, 'titulo': titulo})
        return self.grabar('escena(%s)' % o, lambda s: s.get('fase') == 'toques' and not s.get('ocupado'), 0.9)

    def toque(self):
        return self.grabar('tocar()', lambda s: not s.get('ocupado') and s.get('fase') in ('toques', 'listo'), 0.7)

    def brillo(self, seg=2.4):
        return self.grabar('0', lambda s: True, seg)

    def abrir(self):
        return self.grabar('tocar()', lambda s: s.get('fase') == 'premio', 1.6)


def a_gif(cuadros, nombre, repetir):
    """Los cuadros (a su hora) a un GIF de `FPS` parejos: en cada instante, el último cuadro que había"""
    d = os.path.join(CRUDO, nombre)
    shutil.rmtree(d, ignore_errors=True)
    os.makedirs(d)
    t0, t1 = cuadros[0][0], cuadros[-1][0]
    n, i = int((t1 - t0) * FPS) + 1, 0
    for k in range(n):
        t = t0 + k / FPS
        while i + 1 < len(cuadros) and cuadros[i + 1][0] <= t:
            i += 1
        with open(os.path.join(d, 'f%04d.jpg' % k), 'wb') as f:
            f.write(cuadros[i][1])
    gif = os.path.join(SALIDA, nombre + '.gif')
    # 🎨 una paleta por GIF y el trapo ordenado (bayer): el que difunde el error (sierra) mueve el ruido en cada cuadro y
    # lo quieto deja de serlo. `diff_mode=rectangle` vuelve a pintar sólo lo que cambió
    filtro = ('scale=%d:%d:flags=lanczos,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];'
              '[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle' % (LADO, LADO))
    r = subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(d, 'f%04d.jpg'),
                        '-vf', filtro, '-loop', '0' if repetir else '-1', gif], capture_output=True, text=True)
    if r.returncode:
        sys.exit('ffmpeg: ' + r.stderr[-400:])
    return gif, n


def grabar_todo(solo=None):
    from playwright.sync_api import sync_playwright
    os.makedirs(CRUDO, exist_ok=True)
    build = os.path.join(CRUDO, '_escena')
    armar_escena(build)
    hechos, mal = {}, []
    queda = nombres()
    if solo:
        a, _, r = solo.partition(':')
        queda = {k: v for k, v in queda.items() if v[0] == a and (not r or v[2] == int(r))}
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        ctx = b.new_context(viewport={'width': 480, 'height': 480}, device_scale_factor=1, reduced_motion='no-preference')
        ctx.route('**/*', servidor(build))
        pg = ctx.new_page()
        errores = []
        pg.on('pageerror', lambda e: errores.append(str(e)[:200]))
        cdp = ctx.new_cdp_session(pg)
        G = Grabadora(pg, cdp)

        def nueva():
            pg.goto('http://gif.test/', wait_until='load')
            pg.wait_for_function('!!window.escena')
            pg.evaluate('document.fonts.ready.then(() => true)')

        def guardar(nombre, cuadros, repetir=False):
            if nombre not in queda:
                return
            gif, n = a_gif(cuadros, nombre, repetir)
            hechos[nombre] = (n, os.path.getsize(gif))
            print('   %-28s %3d cuadros  %5d KB' % (nombre, n, os.path.getsize(gif) // 1024))

        for anim, rs in RAREZAS.items():
            for r in rs:
                if not any(v[0] == anim and v[2] == r for v in queda.values()):
                    continue
                # 1) se queda en r: la llegada, un toque que no sube, el brillo y la apertura con Puntos
                nueva()
                c, st = G.escena(anim, r, r)
                guardar('%s-entra-%d' % (anim, r), c)
                c, st = G.toque()
                guardar('%s-nada-%d' % (anim, r), c)
                for _ in range(3):
                    c, st = G.toque()
                if st.get('fase') != 'listo':
                    mal.append('%s %d: después de 4 toques está en «%s»' % (anim, r, st.get('fase')))
                c, st = G.brillo()
                guardar('%s-listo-%d' % (anim, r), c, repetir=True)
                c, st = G.abrir()
                guardar('%s-abre-%d' % (anim, r), c)
                # 2) sube de r-1 a r en alguno de los cuatro toques: se guarda ése
                if r > rs[0] and '%s-sube-%d' % (anim, r) in queda:
                    nueva()
                    G.escena(anim, r - 1, r)
                    for _ in range(4):
                        antes = G.estado().get('rz')
                        c, st = G.toque()
                        if st.get('rz') != antes:
                            guardar('%s-sube-%d' % (anim, r), c)
                            break
                    else:
                        mal.append('%s %d: no subió en ningún toque' % (anim, r))
                # 3) los títulos de esta rareza
                for t in titulos().get(r, []):
                    nombre = '%s-titulo-%s' % (anim, slug(t))
                    if nombre not in queda:
                        continue
                    nueva()
                    G.escena(anim, r, r, titulo=t)
                    for _ in range(4):
                        G.toque()
                    c, st = G.abrir()
                    guardar(nombre, c)
        b.close()
    faltan = sorted(set(queda) - set(hechos))
    if errores:
        print('\n⚠️ errores de la página: %s' % ' | '.join(errores[:3]))
    for m in mal:
        print('🔴 ' + m)
    if faltan:
        print('🔴 faltan: %s' % ', '.join(faltan))
    total = sum(v[1] for v in hechos.values())
    print('\n%d GIF, %.1f MB en %s' % (len(hechos), total / 1048576, SALIDA))
    return 1 if (faltan or mal or errores) else 0


# ── subir ────────────────────────────────────────────────────────────────────────────────────────────────────────────
def subir():
    import requests
    sys.path.insert(0, AQUI)
    from bienvenida_video import API_R2, token     # la misma cuenta y el mismo bucket que las tarjetas
    gifs = sorted(n for n in nombres() if os.path.exists(os.path.join(SALIDA, n + '.gif')))
    faltan = sorted(set(nombres()) - set(gifs))
    if faltan:
        sys.exit('faltan en %s: %s (corre la grabación primero)' % (SALIDA, ', '.join(faltan)))
    s = requests.Session()
    s.headers['Authorization'] = 'Bearer ' + token()
    for n in gifs:
        datos = open(os.path.join(SALIDA, n + '.gif'), 'rb').read()
        r = s.put('%s/objects/%s%s.gif' % (API_R2, CLAVE, n), data=datos, headers={'Content-Type': 'image/gif'}, timeout=120)
        print('%-28s %5d KB  %s' % (n, len(datos) // 1024, 'ok' if r.status_code < 300 else '%s %s' % (r.status_code, r.text[:120])))
        if r.status_code >= 300:
            return 1
    print('\n%d GIF en R2: %s' % (len(gifs), CLAVE))
    return 0


# ── self-check ───────────────────────────────────────────────────────────────────────────────────────────────────────
def auto():
    mal = 0

    def ok(c, txt):
        nonlocal mal
        print('   %s %s' % ('✅' if c else '🔴', txt))
        if not c:
            mal += 1
    N = nombres()
    T = titulos()
    ok(T.get(2) and T.get(3) and T.get(4), 'los títulos de las rarezas 2, 3 y 4 se leen de bot/avisos.js')
    ok(len(N) == 5 * 4 + 4 + 3 * 4 + 2 + 2 * sum(len(v) for v in T.values()), '%d GIF: cuatro estados por rareza, las subidas y los títulos' % len(N))
    ok(slug('Aliento de Dragón') == 'aliento-de-dragon', 'el nombre del título va sin tildes ni espacios')
    w = io.open(os.path.join(BASE, 'bot', 'worker.js'), encoding='utf-8').read()
    m = re.search(r"const DROP_GIF = R2 \+ '/drops/gif/(v\d+)/';", w)
    ok(m and m.group(1) == VERSION, 'el Worker pide la misma versión (%s) que sube esto' % VERSION)
    ok(re.search(r"function gifDrop\(", w) and "-titulo-'" in w, 'el Worker arma los nombres con `gifDrop()`')
    # el Worker pasa el título por `slugGif()`: misma regla que `slug()` de acá (sin tildes, minúsculas, guiones)
    ok("normalize('NFKD')" in w and slug('Corona de Escamas') == 'corona-de-escamas', 'el nombre del título se arma igual en los dos lados')
    ok(set(RAREZAS['drop']) == set(range(5)) and min(RAREZAS['star']) == 2, 'el Drop va de Maqueta a Micrófono de Oro y el Star arranca en Vinilo')
    print('\n   %s' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return 1 if mal else 0


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if '--auto' in sys.argv:
        return auto()
    if '--subir' in sys.argv:
        return subir()
    solo = sys.argv[sys.argv.index('--solo') + 1] if '--solo' in sys.argv else None
    return grabar_todo(solo)


if __name__ == '__main__':
    sys.exit(main())
