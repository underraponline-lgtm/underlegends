# -*- coding: utf-8 -*-
"""EL INICIO NUEVO, ENCHUFADO A LA PÁGINA DE HOY.

    python web/montar.py            arma bot/paginas/nuevo.html: la dirección de prueba (/nuevo)
    python web/montar.py --inicio   lo mete en bot/paginas/index.html: el Inicio de verdad

Dlx, 29/09/2026: «1. B. 2. B» — el Inicio nuevo reemplaza al de hoy ya, y en
React. El resto de las vistas sigue siendo la página de hoy (`app.js`), así que
no se reemplaza el archivo: se le agregan tres cosas.

1. En el `<head>`: las fuentes (`/inicio/inicio.css`), el CSS que apaga el
   marco de hoy cuando se mira el Inicio, y un script que decide **antes de
   dibujar nada** si la ruta es el Inicio. Sin eso, el Inicio viejo asomaba un
   instante antes de que llegara el nuevo.
2. `<div id="inicio-nuevo">` adelante en `<main>`: ahí se monta la app, en un
   shadow root (ver `web/src/main.jsx`).
3. `/inicio/inicio.js` después de `app.js`: se engancha a sus funciones
   (`pintaDatos`, `ir`…), así que tiene que llegar después.

⚠️ **EL INICIO VIEJO SE QUEDA EN EL DOM, ESCONDIDO.** Es el respaldo: si la
app no carga en 8 s, si se rompe entera o si la API no contesta, se saca la
clase `ini-nuevo` y se ve el de hoy, con su «No pude cargar los datos» (que es
lo que mira `herramientas/web_en_borde.py`).

⚠️ **QUÉ ES UNA VISTA SALE DE LOS ARCHIVOS, no de una lista escrita acá**: las
`data-vista` del HTML y el `ALIAS` de `app.js`. Una vista nueva entra sola; si
la lista estuviera escrita, la vista nueva abriría el Inicio.
"""
import io
import os
import re
import sys

WEB = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(WEB)
PAG = os.path.join(BASE, 'bot', 'paginas')
MARCA = 'inicio-nuevo'

#: las vistas de la página de hoy que ya dibuja el Inicio nuevo: su ruta es suya, y la vieja se sigue dibujando
#: escondida, de respaldo. `cambios` desde el 01/10/2026 (Dlx: «1. A»). La misma lista que `PROPIAS` de App.jsx
PROPIAS = ('cambios',)

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

CSS = '''#inicio-nuevo{display:none}
html.ini-nuevo #inicio-nuevo{display:block;position:relative;z-index:4}
html.ini-nuevo .aurora,html.ini-nuevo .trama,html.ini-nuevo .velo,html.ini-nuevo aside.menu{display:none}
html.ini-nuevo .app{display:block;max-width:none}
html.ini-nuevo main{padding:0}
html.ini-nuevo main > section.vista{display:none}
html.ini-nuevo .barra{position:fixed;top:0;right:0;height:0;margin:0;padding:0;border:0;background:none;z-index:80}
html.ini-nuevo .barra > :not(.pop){visibility:hidden}
html.ini-nuevo .barra .pop{top:64px;right:12px}
html.ini-nuevo body{background:#FFFFFF}
html.ini-nuevo.ini-noche body{background:#030304}
html.ini-nuevo{scroll-padding-top:0}'''


def vistas(html, appjs):
    v = sorted(set(re.findall(r'data-vista="([^"]*)"', html)) - {''})
    m = re.search(r'var ALIAS = \{([^}]*)\}', appjs)
    alias = re.findall(r'(\w+)\s*:', m.group(1)) if m else []
    if not v or not alias:
        raise SystemExit('🔴 no encontré las vistas (%d) o el ALIAS de app.js (%d)' % (len(v), len(alias)))
    return [x for x in v + [a for a in alias if a not in v] if x not in PROPIAS]


def script(nombres):
    mapa = ','.join('"%s":1' % n for n in nombres)
    return ('''(function () {
  // ¿La ruta es el Inicio? La misma regla que ir() de app.js: vacío, #/, lo que vuelve de Discord, o algo que
  // no es una vista. Va acá y no en la app para que el Inicio viejo no llegue a asomarse.
  var V = {%s};
  var h = location.hash || '', ini = /^#(access_token|error)=/.test(h);
  if (!ini) { var p = h.replace(/^#\\/?/, '').split('?')[0].split('/')[0]; ini = !p || !V[p]; }
  var c = document.documentElement.classList;
  if (ini) c.add('ini-nuevo');
  try { if (localStorage.getItem('lg:tema') === 'noche') c.add('ini-noche'); } catch (e) { /* sin guardar */ }
  // la última versión del changelog que se vio, ANTES de que app.js la dé por vista (lo lee el Inicio nuevo)
  try { window.__cambiosVisto = JSON.parse(localStorage.getItem('lg:cambios') || '""') || ''; } catch (e) { /* sin guardar */ }
  // «Instalar» (01/10/2026): Chrome avisa que la página se puede instalar una sola vez y puede ser antes de que el
  // Inicio monte. Se guarda acá y el Inicio pone su propio botón; sin esto, Chrome mostraba el suyo cuando quería
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); window.__instalar = e; window.dispatchEvent(new Event('lg:instalar'));
  });
  window.addEventListener('appinstalled', function () { window.__instalar = null; window.dispatchEvent(new Event('lg:instalar')); });
  // si la app no llegó a montarse (red lenta, un navegador viejo), vuelve el Inicio de hoy
  setTimeout(function () {
    var el = document.getElementById('inicio-nuevo');
    if (!el || !el.shadowRoot) { window.__inicioSinDatos = true; c.remove('ini-nuevo'); }
  }, 8000);
})();''' % mapa)


def montar(html, appjs):
    if MARCA in html:
        raise SystemExit('🔴 ese HTML ya tiene el Inicio nuevo')
    cab = ('<link rel="stylesheet" href="estilo.css">\n'
           '<!-- 🛠️ EL INICIO NUEVO (el remake; Dlx, 29/09/2026: «1. B. 2. B»). Lo pone web/montar.py: no se edita a mano.\n'
           '     La app vive en web/ y se construye a inicio/; se ve sólo en el Inicio y el resto sigue siendo esta página. -->\n'
           '<link rel="stylesheet" href="/inicio/inicio.css">\n'
           '<style id="ini-css">\n' + CSS + '\n</style>\n'
           '<script>\n' + script(vistas(html, appjs)) + '\n</script>')
    n0 = html.count('<link rel="stylesheet" href="estilo.css">')
    n1 = html.count('  <div class="barra">')
    n2 = html.count('<script src="app.js"></script>')
    if (n0, n1, n2) != (1, 1, 1):
        raise SystemExit('🔴 no encontré los tres lugares una sola vez: %s' % ((n0, n1, n2),))
    html = html.replace('<link rel="stylesheet" href="estilo.css">', cab)
    html = html.replace('  <div class="barra">',
                        '  <!-- 🛠️ acá se monta el Inicio nuevo (web/src/main.jsx) -->\n'
                        '  <div id="inicio-nuevo"></div>\n\n  <div class="barra">')
    html = html.replace('<script src="app.js"></script>',
                        '<script src="app.js"></script>\n<script type="module" src="/inicio/inicio.js"></script>')
    return html


def main():
    idx = os.path.join(PAG, 'index.html')
    html = io.open(idx, encoding='utf-8').read()
    appjs = io.open(os.path.join(PAG, 'app.js'), encoding='utf-8').read()
    for f in ('inicio.js', 'inicio.css'):
        if not os.path.exists(os.path.join(PAG, 'inicio', f)):
            raise SystemExit('🔴 falta inicio/%s: correr `npx vite build` en web/' % f)
    if '--inicio' in sys.argv:
        dest = idx
    else:
        dest = os.path.join(PAG, 'nuevo.html')
        # la de prueba no se indexa ni se comparte: es la misma página con otro Inicio
        html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="robots" content="noindex">', 1)
    io.open(dest, 'w', encoding='utf-8', newline='\n').write(montar(html, appjs))
    print('✓ %s' % os.path.relpath(dest, BASE))


if __name__ == '__main__':
    main()
