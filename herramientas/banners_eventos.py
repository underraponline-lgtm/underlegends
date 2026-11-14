# -*- coding: utf-8 -*-
"""EL BANNER DE CADA SERVIDOR PARA `eventos-hoy` (Dlx, 11/11/2026).

    python herramientas/banners_eventos.py           dibuja los de los servidores que ya tienen su imagen
    python herramientas/banners_eventos.py DDF SR    sólo esos
    python herramientas/banners_eventos.py --hoja    además, una hoja con todos juntos para mirarlos (scratch, no se sube)
    python herramientas/banners_eventos.py --auto    el self-check, sin red ni navegador (CI)

🔑 Dlx, a la tarjeta nueva de `eventos-hoy`: *«Toda, y que bueno cada sv tenga un banner o un thumbnail generado por
nosotros si su evento no tiene flyer o banner o lo que sea»*. La tarjeta lleva el afiche del anuncio cuando lo hay; cuando
no, éste.

QUÉ ES (lo eligió Dlx el 11/11, en cuatro vueltas)
-------------------------------------------------
· 🌆 UNA IMAGEN PROPIA, A TODO EL ANCHO: `bot/eventos_fondos/<sv>.jpg`, hecha con IA para esto (los textos en su
  `PROMPTS.md`). *«que quizás sea uno diferente a los que los de vs vivo ya usan»*: la escena del VS no va. Probadas y
  descartadas: la escena del VS en duotono, la imagen a un lado con la franja de color y el logo gigante del otro, y la
  imagen espejada a medias (*«sin la franja derecha»*, *«más completa»*).
· 🛡️ abajo a la izquierda su logo EN CÍRCULO (*«el logo de dra y dds queda mal, asegúrate que estén circulados»*: un ícono
  que llena su cuadrado va a sangre y lo recorta el círculo; uno con transparencia, al 76 % sobre una placa), «EVENTO DE LA
  LIGA GLOBAL» en una cinta de su color, su nombre en Anton con contorno negro y su etiqueta (`tag` de
  `datos/servidores.json`).
· 🏷️ arriba, el chip **T1** (*«quizás hacer que aparezca el T1 típico»*: la temporada de `comun/temporada.py`, como en el
  VS) y el de UL, negros con la sombra de su color, como el VS de liga.
· 📐 1200×675 (16:9), JPG 84: Discord lo muestra a ~400 de ancho y lo achica él.

⚠️ VA EN `bot/paginas/banners/<sv>.jpg` Y LO SIRVE PAGES, no R2: es un archivo fijo, el ciclo despliega la página solo, y
así no hay nada que subir a mano. `subir_datos._eventos_hoy()` lo encuentra ahí y le pone `?v=` con la huella del
archivo: si se vuelve a dibujar, Discord no se queda con el viejo.
⚠️ SIN IMAGEN NO HAY BANNER: un servidor que todavía no tiene la suya no sale con otra cosa, y la tarjeta va sin imagen
(o con el afiche, si el anuncio lo trae). Sin dato no hay pieza.
⚠️ SIN TEXTO DEL EVENTO: el nombre, la hora y el premio van en la tarjeta, que se edita. El banner es del servidor y no
cambia con cada evento: por eso no hace falta dibujar nada en el Worker (que no puede: no hay navegador ahí).
"""
import base64
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, BASE)
sys.path.insert(0, os.path.join(BASE, 'bot'))
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

SALIDA = os.path.join(BASE, 'bot', 'paginas', 'banners')
FONDOS = os.path.join(BASE, 'bot', 'eventos_fondos')
ANCHO, ALTO = 1200, 675
CALIDAD = 84


def _servidores():
    with io.open(os.path.join(BASE, 'datos', 'servidores.json'), encoding='utf-8') as f:
        s = json.load(f).get('servidores') or {}
    return {k: v for k, v in s.items() if v.get('confirmado')}


def _color(sv):
    with io.open(os.path.join(BASE, 'datos', 'colores_sv_marca.json'), encoding='utf-8') as f:
        return (json.load(f).get('usar') or {}).get(sv) or '#888888'


def _datauri(p):
    ext = os.path.splitext(p)[1].lower().lstrip('.')
    tipo = {'jpg': 'jpeg', 'jpeg': 'jpeg', 'png': 'png', 'webp': 'webp', 'gif': 'gif'}.get(ext, 'png')
    with open(p, 'rb') as f:
        return 'data:image/%s;base64,%s' % (tipo, base64.b64encode(f.read()).decode('ascii'))


def logo_de(sv):
    """El logo a color del servidor (`comun/logos_color/<sv>.png|jpg`), o `''`."""
    for ext in ('png', 'jpg', 'webp'):
        p = os.path.join(BASE, 'comun', 'logos_color', '%s.%s' % (sv.lower(), ext))
        if os.path.exists(p):
            return p
    return ''


def fondo_de(sv):
    """La imagen propia del banner (`bot/eventos_fondos/<sv>.jpg`), o `''`."""
    p = os.path.join(FONDOS, sv.lower() + '.jpg')
    return p if os.path.exists(p) else ''


def logo_lleno(p):
    """¿El ícono llena su cuadrado? (las cuatro esquinas opacas: DRA, DDS, DDF…). Entonces va a sangre y el círculo lo
    recorta; si trae transparencia (ACAD, CH, FVS, URBF), va al 76 % sobre una placa oscura."""
    from PIL import Image
    im = Image.open(p).convert('RGBA')
    w, h = im.size
    return min(im.getpixel(q)[3] for q in [(2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3)]) > 200


def html(sv, d):
    """El HTML del banner de `sv` (`d` = su fila de `datos/servidores.json`)."""
    import kit
    from comun.temporada import SELLO
    acento = kit.camiseta({'sv': sv, 'color': _color(sv)})['a']
    lg = logo_de(sv)
    ul = os.path.join(BASE, '01_Temporada', 'ul_blanco.png')
    fuentes = kit._fuentes() + io.open(os.path.join(BASE, '05_Liga', 'fuentes.css'), encoding='utf-8').read()
    logo = ('background:#0b0b0e url(%s) center/%s no-repeat' % (_datauri(lg), 'cover' if logo_lleno(lg) else '76%')) if lg else ''
    return """<!doctype html><html><head><meta charset="utf-8"><style>%(fuentes)s
*{margin:0;padding:0;box-sizing:border-box}body{width:%(w)dpx;height:%(h)dpx;background:#060608}
.b{position:relative;width:%(w)dpx;height:%(h)dpx;overflow:hidden;background:#060608}
.img{position:absolute;inset:0;background:url(%(fondo)s) center/cover no-repeat}
.velo{position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,6,8,0) 30%%,rgba(6,6,8,.6) 62%%,rgba(6,6,8,.95) 92%%),
 linear-gradient(90deg,rgba(6,6,8,.45),rgba(6,6,8,0) 55%%)}
.chip{position:absolute;background:#030304;color:#F6F6F6;box-shadow:5px 5px 0 %(acento)s}
.t{left:56px;top:48px;font:400 46px/1 Anton,sans-serif;padding:8px 18px 4px;transform:rotate(-3deg);letter-spacing:.04em}
.ul{right:56px;top:46px;padding:10px;transform:rotate(3deg)}.ul img{display:block;height:46px}
.pie{position:absolute;left:56px;right:56px;bottom:56px;display:flex;align-items:center;gap:30px}
.lg{width:190px;height:190px;border-radius:50%%;flex:none;%(logo)s;box-shadow:0 0 0 7px #030304,0 0 0 13px %(acento)s}
.txt{min-width:0;flex:1;overflow:hidden}
.sup{display:inline-block;font:800 24px/1 Archivo,sans-serif;letter-spacing:.2em;color:#030304;background:%(acento)s;
 padding:8px 12px 7px;transform:rotate(-1.5deg);margin-bottom:14px}
.nom{font:400 104px/.9 Anton,sans-serif;color:#F6F6F6;white-space:nowrap;letter-spacing:.01em;
 -webkit-text-stroke:10px #030304;paint-order:stroke fill}
.tag{font:800 26px/1 Archivo,sans-serif;letter-spacing:.24em;color:#F6F6F6;margin-top:16px;opacity:.85}
</style></head><body><div class="b"><div class="img"></div><div class="velo"></div>
<div class="chip t">%(t)s</div>%(ul)s
<div class="pie">%(lg)s<div class="txt"><div class="sup">EVENTO DE LA LIGA GLOBAL</div>
<div class="nom" id="nom">%(nombre)s</div>%(tag)s</div></div></div></body></html>""" % {
        'fuentes': fuentes, 'w': ANCHO, 'h': ALTO, 'acento': acento, 'fondo': _datauri(fondo_de(sv)), 'logo': logo,
        'ul': '<div class="chip ul"><img src="%s" alt=""></div>' % _datauri(ul) if os.path.exists(ul) else '',
        'lg': '<div class="lg"></div>' if lg else '', 't': SELLO,
        'nombre': (d.get('nombre') or sv).upper(), 'tag': '<div class="tag">%s</div>' % (d.get('tag') or '').upper() if d.get('tag') else ''}


#: 🌆 la escena sola, sin textos, para el escenario del Inicio (14/11/2026, Dlx a la maqueta: «principalmente A»): de fondo
#: de cada momento, detrás de un velo. WebP del mismo tamaño que la imagen propia (HD, ver `imagenes-en-hd`)
ESCENAS = os.path.join(BASE, 'bot', 'paginas', 'escenas')


def escena(sv):
    """Escribe `bot/paginas/escenas/<sv>.webp` desde la imagen propia del servidor. `''` si no la tiene."""
    src = fondo_de(sv)
    if not src:
        return ''
    from PIL import Image
    os.makedirs(ESCENAS, exist_ok=True)
    dst = os.path.join(ESCENAS, sv.lower() + '.webp')
    Image.open(src).convert('RGB').save(dst, 'WEBP', quality=80, method=6)
    return dst


def dibujar(svs, hoja=False):
    from playwright.sync_api import sync_playwright
    os.makedirs(SALIDA, exist_ok=True)
    hechos = []
    with sync_playwright() as p:
        nav = p.chromium.launch()
        pg = nav.new_page(viewport={'width': ANCHO, 'height': ALTO})
        for sv, d in svs.items():
            if not fondo_de(sv):
                print('   ⏳ %-5s sin imagen propia en bot/eventos_fondos/: no se dibuja' % sv)
                continue
            pg.set_content(html(sv, d), wait_until='load')
            pg.evaluate('document.fonts.ready')
            # 📏 un nombre largo («FREESTYLE DISCORD SERIES») no se corta: se achica hasta entrar
            pg.evaluate("""() => { const n = document.getElementById('nom'); let t = 104;
              while (n.scrollWidth > n.parentElement.clientWidth && t > 44) { t -= 2; n.style.fontSize = t + 'px'; } }""")
            ruta = os.path.join(SALIDA, sv.lower() + '.jpg')
            pg.screenshot(path=ruta, type='jpeg', quality=CALIDAD, clip={'x': 0, 'y': 0, 'width': ANCHO, 'height': ALTO})
            hechos.append((sv, ruta))
            escena(sv)
            print('   🖼  %-5s %s  %d KB' % (sv, os.path.relpath(ruta, BASE), os.path.getsize(ruta) // 1024))
        if hoja and hechos:
            celdas = ''.join('<figure style="margin:0"><img src="%s" style="width:400px;border-radius:6px;display:block">'
                             '<figcaption>%s</figcaption></figure>' % (_datauri(r), sv) for sv, r in hechos)
            pg.set_viewport_size({'width': 1280, 'height': 800})
            pg.set_content('<body style="margin:0;background:#313338;font:14px sans-serif;color:#ddd;display:grid;'
                           'grid-template-columns:repeat(3,400px);gap:14px;padding:14px">' + celdas + '</body>')
            r = os.path.join(os.environ.get('TEMP', BASE), 'banners_eventos_hoja.png')
            pg.screenshot(path=r, full_page=True)
            print('   📋 la hoja: %s' % r)
        nav.close()
    return hechos


def _self_check():
    mal = 0

    def ok(c, que):
        nonlocal mal
        print('   %s %s' % ('✅' if c else '❌', que))
        mal += 0 if c else 1
    svs = _servidores()
    ok(len(svs) >= 3, 'los servidores de la Liga salen de datos/servidores.json (%d)' % len(svs))
    sin_logo = [sv for sv in svs if not logo_de(sv)]
    ok(not sin_logo, 'cada uno tiene su logo en comun/logos_color/ (faltan: %s)' % (', '.join(sin_logo) or 'ninguno'))
    hay = sorted(f[:-4].upper() for f in os.listdir(SALIDA) if f.endswith('.jpg')) if os.path.isdir(SALIDA) else []
    ok(set(hay) <= set(svs), 'no queda un banner de un servidor que ya no es de la Liga (%s)' % (', '.join(hay) or 'ninguno'))
    sin_fondo = [sv for sv in hay if not fondo_de(sv)]
    ok(not sin_fondo, 'cada banner sale de su imagen propia, no de la escena del VS (sin imagen: %s)'
       % (', '.join(sin_fondo) or 'ninguno'))
    ok(all(logo_lleno(logo_de(sv)) for sv in ('DRA', 'DDS') if logo_de(sv)),
       'los íconos que llenan su cuadrado (DRA, DDS) van a sangre: el círculo los recorta')
    falta = sorted(set(svs) - set(hay))
    # ⏳ no es un error: sin imagen no hay banner, y la tarjeta sale sin él
    print('   %s banners: %d de %d%s' % ('✅' if not falta else '⏳', len(hay), len(svs),
                                         ' · faltan: ' + ', '.join(falta) if falta else ''))
    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


if __name__ == '__main__':
    a = sys.argv[1:]
    if '--auto' in a:
        sys.exit(_self_check())
    todos = _servidores()
    pedidos = [x.upper() for x in a if not x.startswith('--')]
    elegidos = {k: v for k, v in todos.items() if not pedidos or k in pedidos}
    dibujar(elegidos, hoja='--hoja' in a)
