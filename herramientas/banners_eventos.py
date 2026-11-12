# -*- coding: utf-8 -*-
"""EL BANNER DE CADA SERVIDOR PARA `eventos-hoy` (Dlx, 11/11/2026).

    python herramientas/banners_eventos.py           dibuja los de todos los servidores de la Liga
    python herramientas/banners_eventos.py DDF SR    sólo esos
    python herramientas/banners_eventos.py --hoja    además, una hoja con todos juntos para mirarlos (scratch, no se sube)
    python herramientas/banners_eventos.py --auto    el self-check, sin red ni navegador (CI)

🔑 Dlx, a la tarjeta nueva de `eventos-hoy`: *«Toda, y que bueno cada sv tenga un banner o un thumbnail generado por
nosotros si su evento no tiene flyer o banner o lo que sea»*. La tarjeta lleva el afiche del anuncio cuando lo hay; cuando
no, éste.

QUÉ ES
------
· 🌆 la escena del VS de ese servidor (`bot/vs_fondos/<sv>.jpg`, la que Dlx ya aprobó: `kit.camiseta()`, también la que
  haya subido en el Dashboard); sin escena (FVS), su camiseta, igual que el VS.
· 🛡️ abajo a la izquierda su logo (`comun/logos_color/`), su nombre y su etiqueta (`tag` de `datos/servidores.json`:
  ENTRENAMIENTO, COMUNIDAD…), y arriba de todo «EVENTO DE LA LIGA GLOBAL». El UL chico, abajo a la derecha.
· 📐 1200×675 (16:9, lo mismo que la escena), JPG 84: Discord lo muestra a ~400 de ancho y lo achica él.

⚠️ VA EN `bot/paginas/banners/<sv>.jpg` Y LO SIRVE PAGES, no R2: es un archivo fijo, el ciclo despliega la página solo, y
así no hay nada que subir a mano. `subir_datos._eventos_hoy()` lo encuentra ahí y le pone `?v=` con la huella del
archivo: si se vuelve a dibujar, Discord no se queda con el viejo.
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


def html(sv, d):
    """El HTML del banner de `sv` (`d` = su fila de `datos/servidores.json`)."""
    import kit
    cam = kit.camiseta({'sv': sv, 'color': _color(sv)})
    acento = cam['a']
    lg = logo_de(sv)
    ul = os.path.join(BASE, '01_Temporada', 'ul_blanco.png')
    nombre = (d.get('nombre') or sv).upper()
    tag = (d.get('tag') or '').upper()
    return """<!doctype html><html><head><meta charset="utf-8"><style>%(fuentes)s
*{margin:0;padding:0;box-sizing:border-box}
body{width:%(w)dpx;height:%(h)dpx;background:#030304}
.b{position:relative;width:%(w)dpx;height:%(h)dpx;overflow:hidden;background:%(fondo)s}
.capa{position:absolute;inset:0;background:%(capa)s}
.luz{position:absolute;inset:0;background:%(luz)s}
.velo{position:absolute;inset:0;background:linear-gradient(180deg,rgba(3,3,4,0) 38%%,rgba(3,3,4,.72) 72%%,rgba(3,3,4,.94) 100%%)}
.pie{position:absolute;left:56px;right:56px;bottom:48px;display:flex;align-items:flex-end;gap:28px}
.logo{width:176px;height:176px;border-radius:50%%;flex:none;background:#0b0b0e center/78%% no-repeat;
  box-shadow:0 0 0 5px %(acento)s,0 10px 30px rgba(0,0,0,.6)}
.txt{flex:1;min-width:0;padding-bottom:6px}
.sup{font:800 28px/1 'Archivo',sans-serif;letter-spacing:.22em;color:%(acento)s;margin-bottom:12px}
.nom{font:700 96px/.92 'Barlow Condensed',sans-serif;color:#F6F6F6;letter-spacing:.01em;
  white-space:nowrap;overflow:hidden;text-overflow:clip}
.tag{font:800 28px/1 'Archivo',sans-serif;letter-spacing:.2em;color:rgba(246,246,246,.78);margin-top:14px}
.ul{position:absolute;right:56px;top:44px;width:64px;opacity:.92}
</style></head><body><div class="b"><div class="capa"></div><div class="luz"></div><div class="velo"></div>
<img class="ul" src="%(ul)s" alt="">
<div class="pie">%(logo)s<div class="txt"><div class="sup">EVENTO DE LA LIGA GLOBAL</div>
<div class="nom" id="nom">%(nombre)s</div>%(tag)s</div></div></div></body></html>""" % {
        'fuentes': kit._fuentes(), 'w': ANCHO, 'h': ALTO, 'fondo': cam['fondo'], 'capa': cam.get('capa') or 'none',
        'acento': acento,
        # 💡 sin escena propia (FVS) la camiseta queda oscura en el medio: una luz de su color, donde las escenas tienen la suya
        'luz': 'none' if cam.get('sombra') == 0 else 'radial-gradient(ellipse 60%% 70%% at 50%% 32%%, %s 0%%, rgba(3,3,4,0) 70%%)' % kit._mezcla(acento, '#030304', 0.35),
        'ul': _datauri(ul) if os.path.exists(ul) else '',
        'logo': '<div class="logo" style="background-image:url(%s)"></div>' % _datauri(lg) if lg else '',
        'nombre': nombre, 'tag': '<div class="tag">%s</div>' % tag if tag else ''}


def dibujar(svs, hoja=False):
    from playwright.sync_api import sync_playwright
    os.makedirs(SALIDA, exist_ok=True)
    hechos = []
    with sync_playwright() as p:
        nav = p.chromium.launch()
        pg = nav.new_page(viewport={'width': ANCHO, 'height': ALTO})
        for sv, d in svs.items():
            pg.set_content(html(sv, d), wait_until='load')
            pg.evaluate('document.fonts.ready')
            # 📏 un nombre largo («FREESTYLE DISCORD SERIES») no se corta: se achica hasta entrar
            pg.evaluate("""() => { const n = document.getElementById('nom'); let t = 96;
              while (n.scrollWidth > n.clientWidth && t > 40) { t -= 2; n.style.fontSize = t + 'px'; } }""")
            ruta = os.path.join(SALIDA, sv.lower() + '.jpg')
            pg.screenshot(path=ruta, type='jpeg', quality=CALIDAD, clip={'x': 0, 'y': 0, 'width': ANCHO, 'height': ALTO})
            hechos.append((sv, ruta, os.path.getsize(ruta)))
            print('   🖼  %-5s %s  %d KB' % (sv, os.path.relpath(ruta, BASE), os.path.getsize(ruta) // 1024))
        if hoja:
            celdas = ''.join('<figure><img src="%s"><figcaption>%s</figcaption></figure>' % (_datauri(r), sv)
                             for sv, r, _n in hechos)
            pg.set_viewport_size({'width': 1240, 'height': 800})
            pg.set_content('<body style="margin:0;background:#313338;font:14px sans-serif;color:#ddd;display:grid;'
                           'grid-template-columns:repeat(3,400px);gap:14px;padding:14px">' + celdas.replace(
                               '<img ', '<img style="width:400px;border-radius:6px;display:block" ') + '</body>')
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
    hay = sorted(f[:-4].upper() for f in os.listdir(SALIDA)) if os.path.isdir(SALIDA) else []
    ok(set(hay) <= set(svs), 'no queda un banner de un servidor que ya no es de la Liga (%s)' % (', '.join(hay) or 'ninguno'))
    falta = sorted(set(svs) - set(hay))
    ok(not falta, 'cada servidor de la Liga tiene su banner (faltan: %s)' % (', '.join(falta) or 'ninguno'))
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
