# -*- coding: utf-8 -*-
"""🖼️ LAS IMÁGENES DEL BUZÓN DE DRA (28/11/2026): las franjas, los cuadritos de cada aviso y las piezas de la Tienda.

    python bot/buzon_img.py --vista [carpeta]   dibuja todo en la carpeta (no sube nada, no toca bot/buzon_img.js)
    python bot/buzon_img.py --publicar          dibuja, sube a R2 lo que falta y escribe bot/buzon_img.js
    python bot/buzon_img.py --auto              el self-check, sin red ni navegador

🔑 Dlx, 28/11/2026: *«¿Esos mensajes planos tú crees que están bonitos? Usa el estilo que usamos para anunciar eventos…
imágenes»*. El hilo del buzón lleva arriba una franja con el estilo de DRA (negro, magenta, verde y las palabras con eco,
el de `bot/paneles_img/verificate.png` y los carteles de `bot/paneles_dra.py`), y cada aviso un cuadrito al costado: la
imagen de verdad si existe (tu carta, el Drop), y si no, el cuadrito de su clase dibujado acá.

⚠️ SE DIBUJAN UNA VEZ, NO POR MENSAJE: el Worker y Railway no dibujan nada. Las franjas y los cuadritos van a R2 con la
huella de su PNG en el nombre (`paneles/buzon-<clave>-<huella>.png`, como el banner de verificarse: Discord guarda lo que
bajó de una URL); si ya están, no se suben. Las piezas de la Tienda, una vez por versión del arte
(`tienda/piezas/<arte_v>/<id>.png`): la vitrina rota cada día, pero sus piezas salen siempre del mismo catálogo.

⚠️ `bot/buzon_img.js` LO ESCRIBE `--publicar`, DESPUÉS DE SUBIR: el Worker sólo nombra una imagen que ya está en R2 (sin
dato no hay pieza: nunca una imagen rota). Si el arte de la Tienda cambia de versión, la vitrina de Discord sale sin
imágenes hasta correr esto otra vez y desplegar (lo dice `PIEZAS.v` contra el `arte_v` del objeto).

⚠️ EL ARTE DE LA TIENDA NO VIVE EN EL REPO: se lee de la página (`/api/avisos/tienda-arte`, lo mismo que baja cualquiera
con la Tienda abierta) y las piezas dibujadas no se guardan acá, sólo en R2.
"""
import hashlib
import html
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (BASE, SCR):
    if _p not in sys.path:
        sys.path.insert(0, _p)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

HUB = 'https://underlegends.pages.dev'
R2 = 'https://pub-70d5821d06a8432c9cffd0c102195000.r2.dev'
CARPETA = os.path.join(SCR, 'paneles_img', 'buzon')
JS = os.path.join(SCR, 'buzon_img.js')
MAGENTA, VERDE, NEGRO, BLANCO = '#E41373', '#29B298', '#030304', '#EFEFEF'

#: 🪧 las franjas (1500×500): `clave: (arriba, grande, línea)`. La del hilo y las de dos respuestas de sus botones
FRANJAS = {
    'avisos': ('Tu buzón', 'Avisos', 'Sólo para ti'),
    'drop': ('Reclama tu', 'Drop', 'Uno gratis cada día'),
    'vitrina': ('La vitrina', 'De hoy', 'Cambia cada día'),
}
#: 🔲 los cuadritos (512×512) de los avisos que no traen una imagen de verdad: `clave: (palabra, chiquita)`. Una palabra
#: corta: en Discord la miniatura se ve de ~80 px
CUADROS = {
    'personal': ('Liga', 'Tus avisos'), 'pase': ('Pase', 'Subiste'), 'tienda': ('Tienda', 'Lo tuyo'),
    'libre': ('VS', 'Te retaron'), 'suplente': ('Cupo', 'Entraste'), 'calificar': ('Nota', 'Califica'),
    'reporte': ('Llave', 'Corregida'), 'fondo': ('Fondo', 'Aprobado'), 'pedido': ('Listo', 'Tu pedido'),
    'ref': ('Invita', 'Y gana'), 'crew': ('Crew', 'Tu gente'), 'racha': ('Racha', 'Seguida'),
    'tuvideo': ('Video', 'Tu batalla'), 'tapado': ('?', 'Tapado'),
}
#: las rarezas de la Tienda (las de los Dragón Drops): la misma tabla que `web/src/tienda_rz.js` (el self-check lo mira)
RZ = [['Maqueta', '#9AA4B2'], ['Mixtape', '#29B298'], ['Vinilo', '#9B5CFF'], ['Disco de Oro', '#FF4F93'],
      ['Micrófono de Oro', '#F5C542'], ['Disco de Diamante', '#BFF4FF']]
FONDOS = ('fp', 'fv', 'fe', 'fd', 'ff', 'fr')


def _e(s):
    return html.escape(str(s or ''), quote=True)


#: la fuente y el logo de los carteles de DRA (los mismos archivos que `bot/paneles_dra.py`). ⚠️ Copiados y no
#: importados a propósito: paneles_dra.py lo editan otras tandas y, roto a medias, no tiene que tumbar estas imágenes
FUENTE = os.path.join(BASE, 'bot', 'paginas', 'inicio', 'f', 'archivo-latin-wdth-normal.woff2')
LOGO = os.path.join(BASE, 'bot', 'paginas', 'ul.png')


def _b64(ruta):
    import base64
    with open(ruta, 'rb') as f:
        return base64.b64encode(f.read()).decode()


def _base_css():
    """`(css de la fuente, logo en data:)`. Sin la fuente variable, la Archivo de comun/fonts/embed.css."""
    try:
        fuente = ("@font-face{font-family:'UL Cartel';font-weight:100 900;font-stretch:62%% 125%%;"
                  "src:url(data:font/woff2;base64,%s) format('woff2')}" % _b64(FUENTE))
    except OSError:
        try:
            with open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'), encoding='utf-8') as f:
                fuente = f.read()
        except OSError:
            fuente = ''
    try:
        logo = 'data:image/png;base64,' + _b64(LOGO)
    except OSError:
        logo = ''
    return fuente, logo


def _chevron(arriba, abajo):
    """Dos «v» apiladas, como las del banner: la de arriba de un color y la de abajo del otro."""
    def v(col):
        return ('<i><svg viewBox="0 0 104 62"><polyline points="8,8 52,50 96,8" fill="none" stroke="%s" '
                'stroke-width="20" stroke-linejoin="miter"/></svg></i>' % col)
    return '<span class="chev">%s%s</span>' % (v(arriba), v(abajo))


#: hace entrar cada grupo `data-fit` en su ancho: primero lo angosta (el eje de ancho de la fuente) y después lo achica
#: (la misma regla que `ENCAJAR` de bot/paneles_dra.py)
ENCAJAR = """() => { for (const g of document.querySelectorAll('[data-fit]')) {
  const max = +g.dataset.fit; let fs = parseFloat(getComputedStyle(g).fontSize); let st = 125;
  const ancho = () => { const h = [...g.children].filter((x) => !x.classList.contains('eco')).map((x) => x.getBoundingClientRect());
    return Math.max(...h.map((r) => r.right)) - Math.min(...h.map((r) => r.left)); };
  for (let i = 0; i < 25 && ancho() > max && st > 100; i++) { st -= 1; g.style.fontStretch = st + '%'; }
  for (let i = 0; i < 80 && ancho() > max && fs > 20; i++) { fs *= 0.97; g.style.fontSize = fs + 'px'; } } }"""


def foto(htm, ruta, pw=None):
    """El PNG del `#c` de ese HTML, entero (se mide y se recorta, como `foto()` de bot/paneles_dra.py). `pw`: un
    navegador ya abierto, para no abrir uno por imagen."""
    def con(b):
        pg = b.new_page(viewport={'width': 1600, 'height': 1000}, device_scale_factor=1)
        try:
            pg.set_default_timeout(60000)
            pg.set_content(htm, wait_until='load', timeout=60000)
            pg.evaluate('() => document.fonts.ready.then(() => true)')
            pg.evaluate(ENCAJAR)
            pg.wait_for_timeout(300)
            ancho, alto = pg.evaluate("() => { const r = document.querySelector('#c').getBoundingClientRect();"
                                      " return [Math.ceil(r.width), Math.ceil(r.height)]; }")
            pg.screenshot(path=ruta, clip={'x': 0, 'y': 0, 'width': int(ancho), 'height': int(alto)}, timeout=60000)
        finally:
            pg.close()
        return ruta
    if pw is not None:
        return con(pw)
    import navegador
    navegador.hace_falta()
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-sandbox'])
        try:
            return con(b)
        finally:
            b.close()


def _ecos(txt, paso, n, baja):
    return ''.join('<span class="eco" style="top:%.2fem;opacity:%.2f">%s</span>' % (paso * i, 1 - baja * (i - 1), _e(txt))
                   for i in range(n, 0, -1))


def html_franja(arriba, grande, linea):
    """La franja del hilo (1500×500), con el estilo del banner de verificarse: la marca arriba, `arriba` en magenta con
    ecos verdes, `grande` en verde con ecos magenta hacia abajo, y `linea` en blanco entre chevrones. Las diagonales de
    las esquinas de abajo, como el banner."""
    fuente, logo = _base_css()
    css = """*{box-sizing:border-box;margin:0;padding:0}body{background:%(n)s}
#c{position:relative;width:1500px;height:500px;overflow:hidden;background:%(n)s;color:%(b)s;
  font-family:'UL Cartel','Archivo',sans-serif;font-weight:900;font-stretch:125%%;text-transform:uppercase}
.rayas{position:absolute;inset:0}
.marca{position:absolute;left:0;right:0;top:52px;transform:translateY(-50%%);display:flex;justify-content:center;
  align-items:center;gap:16px;font-size:30px;letter-spacing:.01em;line-height:1}
.marca img{width:70px;height:70px;clip-path:circle(45%%)}
.g{position:absolute;left:0;right:0;display:flex;justify-content:center;line-height:1;white-space:nowrap}
.g .eco{display:block;position:absolute;left:50%%;transform:translateX(-50%%)}
.g .solido{display:block;position:relative;z-index:2}
.arriba{top:170px;font-size:76px;color:%(m)s;transform:translateY(-50%%)}
.arriba .eco{color:transparent;-webkit-text-stroke:2px %(v)s}
.grande{top:282px;font-size:150px;color:%(v)s;transform:translateY(-50%%);z-index:2}
.grande .eco{color:transparent;-webkit-text-stroke:2px %(m)s}
.linea{top:430px;transform:translateY(-50%%);gap:26px;align-items:center;font-size:44px;color:%(b)s;z-index:3}
.chev{position:relative;width:52px;height:52px;flex:none}
.chev i{position:absolute;left:0;width:52px;height:31px}
.chev i:first-child{top:0}.chev i:last-child{top:21px}
.chev svg{width:52px;height:31px}
""" % {'n': NEGRO, 'b': BLANCO, 'm': MAGENTA, 'v': VERDE}
    rayas = ''
    for col, x1, y1, x2, y2 in ((VERDE, 0, 270, 190, 500), (MAGENTA, 0, 335, 140, 500), (MAGENTA, 0, 365, 345, 500),
                                (VERDE, 0, 410, 235, 500)):
        for a, b in ((x1, x2), (1500 - x1, 1500 - x2)):
            rayas += '<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="4"/>' % (a, y1, b, y2, col)
    cuerpo = ('<svg class="rayas" viewBox="0 0 1500 500" width="1500" height="500">%s</svg>'
              '<div class="marca"><span>Under</span>%s<span>Legends</span></div>'
              '<div class="g arriba" data-fit="1150">%s<span class="solido">%s</span></div>'
              '<div class="g grande" data-fit="1300">%s<span class="solido">%s</span></div>'
              '<div class="g linea" data-fit="1100">%s<span class="solido">%s</span>%s</div>'
              % (rayas, ('<img src="%s" alt="">' % logo) if logo else '', _ecos(arriba, -0.27, 3, 0.28), _e(arriba),
                 _ecos(grande, 0.13, 3, 0.25), _e(grande), _chevron(VERDE, MAGENTA), _e(linea), _chevron(MAGENTA, VERDE)))
    return ('<!doctype html><html><head><meta charset="utf-8"><style>%s%s</style></head><body><div id="c">%s</div>'
            '</body></html>') % (fuente, css, cuerpo)


def html_cuadro(palabra, chica):
    """El cuadrito de una clase de aviso (512×512): la palabra en verde con ecos magenta, una línea chica en blanco y
    las diagonales de abajo. Se lee a 80 px: por eso una sola palabra."""
    fuente, logo = _base_css()
    css = """*{box-sizing:border-box;margin:0;padding:0}body{background:%(n)s}
#c{position:relative;width:512px;height:512px;overflow:hidden;background:%(n)s;color:%(b)s;
  font-family:'UL Cartel','Archivo',sans-serif;font-weight:900;font-stretch:125%%;text-transform:uppercase}
.rayas{position:absolute;inset:0}
.logo{position:absolute;left:50%%;top:70px;width:96px;height:96px;transform:translate(-50%%,-50%%);clip-path:circle(45%%)}
.g{position:absolute;left:0;right:0;display:flex;justify-content:center;line-height:1;white-space:nowrap}
.g .eco{display:block;position:absolute;left:50%%;transform:translateX(-50%%)}
.g .solido{display:block;position:relative;z-index:2}
.grande{top:250px;font-size:150px;color:%(v)s;transform:translateY(-50%%)}
.grande .eco{color:transparent;-webkit-text-stroke:3px %(m)s}
.chica{top:420px;font-size:44px;color:%(b)s;transform:translateY(-50%%)}
""" % {'n': NEGRO, 'b': BLANCO, 'm': MAGENTA, 'v': VERDE}
    rayas = ''
    for col, x1, y1, x2, y2 in ((VERDE, 0, 330, 140, 512), (MAGENTA, 0, 400, 260, 512)):
        for a, b in ((x1, x2), (512 - x1, 512 - x2)):
            rayas += '<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="5"/>' % (a, y1, b, y2, col)
    cuerpo = ('<svg class="rayas" viewBox="0 0 512 512" width="512" height="512">%s</svg>%s'
              '<div class="g grande" data-fit="440">%s<span class="solido">%s</span></div>'
              '<div class="g chica" data-fit="440"><span class="solido">%s</span></div>'
              % (rayas, ('<img class="logo" src="%s" alt="">' % logo) if logo else '', _ecos(palabra, 0.12, 3, 0.28),
                 _e(palabra), _e(chica)))
    return ('<!doctype html><html><head><meta charset="utf-8"><style>%s%s</style></head><body><div id="c">%s</div>'
            '</body></html>') % (fuente, css, cuerpo)


# ── las piezas de la Tienda ─────────────────────────────────────────────────────────────────────────────────────────
#: la cara y la carta de muestra (las de quien no entró a la página: `CARTA_MUESTRA` de web/src/tienda3.jsx)
FOTO_MUESTRA = ('data:image/svg+xml,' + __import__('urllib.parse', fromlist=['quote']).quote(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#2A2A33"/>'
    '<circle cx="50" cy="40" r="18" fill="#4A4D57"/><path d="M18 96c4-24 18-36 32-36s28 12 32 36z" fill="#4A4D57"/></svg>'))
CARTA_MUESTRA = ('data:image/svg+xml,' + __import__('urllib.parse', fromlist=['quote']).quote(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 438"><rect x="3" y="3" width="294" height="432" rx="10" '
    'fill="#17191E" stroke="#3A3D45" stroke-width="6"/><rect x="24" y="24" width="252" height="250" rx="6" fill="#22252B"/>'
    '<circle cx="150" cy="128" r="46" fill="#2E3138"/><path d="M78 274c8-50 40-78 72-78s64 28 72 78z" fill="#2E3138"/>'
    '<text x="150" y="338" text-anchor="middle" font-family="Archivo,Arial,sans-serif" font-weight="900" font-size="34" '
    'fill="#F6F6F6">TU CARTA</text></svg>'))
LADO = 360


def molde(h):
    """Llena los tres huecos del molde, como `moldeX()` de la página: la cara, la carta y el nombre («Tú»)."""
    return (str(h or '').replace('__FOTO__', FOTO_MUESTRA).replace('__CARTA__', CARTA_MUESTRA).replace('__N__', 'Tú'))


def html_piezas(arte, cat, ids):
    """Una página con cada pieza en su cuadro de `LADO`: el molde de la vista previa (`v`; los fondos, `fondo`) con la
    raya de su rareza arriba, como los cuadros de la Tienda. Las medidas son las de `.tz-q-v` de tienda3.css, por 3,3."""
    fuente, _ = _base_css()
    cuadros = []
    for pid in ids:
        a, p = (arte.get('p') or {}).get(pid) or {}, (cat.get('piezas') or {}).get(pid) or {}
        h = a.get('fondo') if p.get('c') in FONDOS and a.get('fondo') else a.get('v')
        col = RZ[max(0, min(len(RZ) - 1, int(p.get('r') or 0)))][1]
        cuadros.append('<div class="pz" data-id="%s" style="--r:%s"><span class="ta-raiz tz-w" style="--carta:url(\'%s\');'
                       '--dragon:url(\'%s/ul-blanco.png\')">%s</span></div>' % (_e(pid), col, CARTA_MUESTRA, HUB, molde(h)))
    css = """*{box-sizing:border-box;margin:0;padding:0}body{background:#0B0C0E;display:flex;flex-wrap:wrap;gap:8px;width:%(w)dpx}
.pz{position:relative;display:grid;place-items:center;width:%(l)dpx;height:%(l)dpx;overflow:hidden;background:#0B0C0E;
  border-top:12px solid var(--r);color:#F6F6F6;font-family:'UL Cartel','Archivo',sans-serif}
.tz-w{display:contents}
.pz .ta-av{width:230px;height:230px}.pz .ta-carta{width:170px}.pz .ta-nom{font-size:58px}
.pz .ta-fondo,.pz .ta-mk{position:absolute;inset:0}
""" % {'w': (LADO + 8) * 8, 'l': LADO}
    return ('<!doctype html><html><head><meta charset="utf-8"><base href="%s/"><style>%s%s%s</style></head><body>%s</body>'
            '</html>') % (HUB, fuente, css, arte.get('css') or '', ''.join(cuadros))


def _pedir_tienda():
    """El arte y el catálogo públicos de la Tienda, como los baja la página sin cuenta. `(arte, cat, arte_v)`."""
    import requests
    cab = {'content-type': 'application/json', 'User-Agent': 'LigaGlobal-buzon/1'}
    a = requests.post(HUB + '/api/avisos/tienda-arte', data='{"anon":1}', headers=cab, timeout=60).json()
    t = requests.post(HUB + '/api/avisos/tienda', data='{"anon":1}', headers=cab, timeout=60).json()
    if not a.get('ok') or not t.get('ok') or not t.get('cat'):
        raise SystemExit('🔴 la Tienda no me dio su arte o su catálogo (¿está cerrada?)')
    return a, t['cat'], str(t.get('arte_v') or a.get('v') or '')


def dibujar_piezas(arte, cat, ids, carpeta):
    """Un PNG por pieza en `carpeta`, con UN navegador para todas. `{id: ruta}` de las que salieron."""
    import navegador
    navegador.hace_falta()
    from playwright.sync_api import sync_playwright
    os.makedirs(carpeta, exist_ok=True)
    out = {}
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=['--no-sandbox'])
        try:
            pg = b.new_page(viewport={'width': (LADO + 8) * 8, 'height': 900}, device_scale_factor=1)
            pg.set_default_timeout(60000)
            pg.set_content(html_piezas(arte, cat, ids), wait_until='load', timeout=90000)
            pg.evaluate('() => document.fonts.ready.then(() => true)')
            pg.wait_for_timeout(1500)
            for pid in ids:
                el = pg.query_selector('.pz[data-id="%s"]' % pid)
                if not el:
                    continue
                ruta = os.path.join(carpeta, '%s.png' % pid)
                el.screenshot(path=ruta, timeout=30000)
                out[pid] = ruta
        finally:
            b.close()
    return out


# ── todo junto ──────────────────────────────────────────────────────────────────────────────────────────────────────
def dibujar(carpeta):
    """Las franjas y los cuadritos, en `carpeta`. `{clave: ruta}` con `franja-<k>` y `cuadro-<k>`."""
    import navegador
    navegador.hace_falta()
    from playwright.sync_api import sync_playwright
    os.makedirs(carpeta, exist_ok=True)
    out = {}
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-sandbox'])
        try:
            for k, (a, g, ln) in FRANJAS.items():
                out['franja-' + k] = foto(html_franja(a, g, ln), os.path.join(carpeta, 'franja-%s.png' % k), b)
            for k, (pa, c) in CUADROS.items():
                out['cuadro-' + k] = foto(html_cuadro(pa, c), os.path.join(carpeta, 'cuadro-%s.png' % k), b)
        finally:
            b.close()
    return out


def clave_r2(k, png):
    return 'paneles/buzon-%s-%s.png' % (k, hashlib.sha1(png).hexdigest()[:10])


def escribir_js(franjas, cuadros, piezas_v, piezas_ids, ruta=JS):
    """`bot/buzon_img.js`: las URL de lo que YA está en R2. Lo importa bot/buzon_vista.js."""
    txt = ('// 🖼️ GENERADO por `python bot/buzon_img.py --publicar` (no se edita a mano): las imágenes del buzón que YA están en\n'
           '// R2. Sin una, el mensaje sale sin esa pieza (nunca una imagen rota). Ver bot/buzon_img.py.\n'
           'export const FRANJAS = %s;\n'
           'export const CUADROS = %s;\n'
           '//: las piezas de la Tienda dibujadas, de la versión del arte `v` (la vitrina de Discord las usa sólo si es la de hoy)\n'
           'export const PIEZAS = %s;\n') % (
        json.dumps(franjas, ensure_ascii=False, sort_keys=True, indent=2),
        json.dumps(cuadros, ensure_ascii=False, sort_keys=True, indent=2),
        json.dumps({'v': piezas_v, 'base': R2 + '/tienda/piezas/' + piezas_v + '/' if piezas_v else '',
                    'ids': sorted(piezas_ids)}, ensure_ascii=False, sort_keys=True))
    with open(ruta, 'w', encoding='utf-8', newline='\n') as f:
        f.write(txt)
    return ruta


def publicar():
    import requests
    import tempfile
    import subir_cartas as SC
    s = SC.sesion()

    def subir(clave, png):
        url = '%s/%s' % (SC.PUBLICA, clave)
        if requests.head(url, timeout=20).status_code == 200:
            return url, False
        r = s.put('%s/objects/%s' % (SC.API, clave), data=png, headers={'Content-Type': 'image/png'}, timeout=60)
        if SC._ok(r, clave) is None:
            raise SystemExit('🔴 no subió a R2: %s' % clave)
        return url, True

    hechos = dibujar(CARPETA)
    franjas, cuadros, nuevos = {}, {}, 0
    for k, ruta in sorted(hechos.items()):
        with open(ruta, 'rb') as f:
            png = f.read()
        url, nuevo = subir(clave_r2(k, png), png)
        nuevos += nuevo
        (franjas if k.startswith('franja-') else cuadros)[k.split('-', 1)[1]] = url
    print('   🪧 %d franjas y %d cuadritos en R2 (%d nuevos)' % (len(franjas), len(cuadros), nuevos))
    arte, cat, v = _pedir_tienda()
    ids = sorted(i for i in cat.get('piezas', {}) if i in (arte.get('p') or {}))
    with tempfile.TemporaryDirectory() as tmp:
        rutas = dibujar_piezas(arte, cat, ids, tmp)
        subidas, np = [], 0
        for pid, ruta in sorted(rutas.items()):
            with open(ruta, 'rb') as f:
                png = f.read()
            _, nuevo = subir('tienda/piezas/%s/%s.png' % (v, pid), png)
            np += nuevo
            subidas.append(pid)
    print('   🛍️ %d piezas de la Tienda (arte %s) en R2 (%d nuevas)' % (len(subidas), v, np))
    print('   ✍️ %s' % escribir_js(franjas, cuadros, v, subidas))
    print('   ⚠️ falta desplegar el Worker para que las use')
    return 0


def vista(carpeta):
    hechos = dibujar(carpeta)
    for k, r in sorted(hechos.items()):
        print('  %-20s %s' % (k, r))
    try:
        arte, cat, v = _pedir_tienda()
        vit = ((cat.get('vitrina') or {}).get('ids') or [])[:8]
        rp = dibujar_piezas(arte, cat, vit, os.path.join(carpeta, 'piezas'))
        print('  🛍️ la vitrina de hoy (arte %s): %d piezas en %s' % (v, len(rp), os.path.join(carpeta, 'piezas')))
    except Exception as e:                                # noqa: BLE001
        print('  ⚠️ las piezas de la Tienda no salieron: %s' % str(e)[:200])
    return 0


def _self_check():
    mal = 0

    def ok(c, que):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '🔴', que))

    print('\n  buzon_img.py — sin red ni navegador\n')
    h = html_franja('Tu buzón', 'Avisos', 'Sólo para ti')
    ok('id="c"' in h and h.count('class="eco"') == 6 and 'data-fit' in h, 'la franja: el #c, los ecos de las dos palabras y el encaje')
    ok('&lt;' in html_franja('<b>', 'x', 'y'), 'el texto se escapa')
    ok(all(len(p) <= 6 or p == '?' for p, _ in CUADROS.values()), 'cada cuadrito con una palabra corta (se ve a 80 px)')
    ok(set(CUADROS) >= {'personal', 'pase', 'tienda', 'libre', 'suplente', 'calificar', 'reporte', 'fondo', 'pedido', 'ref',
                        'crew', 'racha', 'tuvideo', 'tapado'}, 'un cuadrito por cada clase que no trae imagen propia, y el «tapado»')
    k1, k2 = clave_r2('franja-avisos', b'a'), clave_r2('franja-avisos', b'b')
    ok(k1 != k2 and k1.startswith('paneles/buzon-franja-avisos-'), 'la huella del PNG va en el nombre: si cambia, es otra URL')
    m = molde('<img src="__FOTO__"><i>__N__</i><b style="background:url(__CARTA__)">')
    ok('__' not in m and 'Tú' in m, 'el molde se llena: la cara, la carta y el nombre')
    hp = html_piezas({'css': '.ta-av{}', 'p': {'A1': {'v': '<div class="ta-av"></div>'}, 'F1': {'v': 'x', 'fondo': '<div class="ta-fondo"></div>'}}},
                     {'piezas': {'A1': {'c': 'aro', 'r': 2}, 'F1': {'c': 'fp', 'r': 9}}}, ['A1', 'F1'])
    ok('data-id="A1"' in hp and '#9B5CFF' in hp and 'ta-fondo' in hp and '#BFF4FF' in hp,
       'las piezas: la raya de su rareza (una de más, la última) y los fondos con su molde de fondo')
    try:
        with open(os.path.join(BASE, 'web', 'src', 'tienda_rz.js'), encoding='utf-8') as f:
            web = f.read()
        ok(all(n in web and c in web for n, c in RZ), 'las rarezas son las de web/src/tienda_rz.js')
    except OSError:
        ok(False, 'no pude leer web/src/tienda_rz.js')
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        r = escribir_js({'avisos': 'https://x/a.png'}, {'pase': 'https://x/p.png'}, 'abc123', ['B', 'A'], os.path.join(tmp, 'x.js'))
        with open(r, encoding='utf-8') as f:
            js = f.read()
    ok('export const FRANJAS' in js and '"ids": ["A", "B"]' in js and '/tienda/piezas/abc123/' in js,
       'bot/buzon_img.js: las URL, las piezas en orden y su carpeta de la versión')
    print('\n  %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return mal


def main():
    if '--auto' in sys.argv:
        return 1 if _self_check() else 0
    if '--publicar' in sys.argv:
        return publicar()
    if '--vista' in sys.argv:
        i = sys.argv.index('--vista')
        return vista(sys.argv[i + 1] if i + 1 < len(sys.argv) else CARPETA)
    print(__doc__)
    return 0


if __name__ == '__main__':
    sys.exit(main())
