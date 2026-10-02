# -*- coding: utf-8 -*-
"""EL INICIO NUEVO, ENCHUFADO A LA PÁGINA DE HOY.

    python web/montar.py            arma bot/paginas/nuevo.html: la dirección de prueba (/nuevo)
    python web/montar.py --inicio   lo mete en bot/paginas/index.html: el Inicio de verdad
    python web/montar.py --script   rehace SÓLO el script del principio de index.html, que ya está montado

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
#: escondida, de respaldo. `cambios` desde el 01/10/2026 (Dlx: «1. A»); `ranking` desde el 02/10/2026 (Dlx: «me
#: encanta»), con `duelos`, el alias viejo que abre el de Duelos. La misma lista que `PROPIAS` de App.jsx
PROPIAS = ('cambios', 'ranking', 'duelos')

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


#: 🔑 LA LIGA VIVE EN `/freestyle-rap` (Dlx, 01/10/2026: «/freestyle-rap, put it like that, better»): Under Legends
#: va a ser más cosas y la Liga Global es una sección, como Red Bull Batalla adentro de Red Bull. Tu cuenta y el
#: changelog son de toda la marca y van en la raíz (`/cuenta`, `/cambios`); los Ajustes son parte de tu cuenta.
#:
#: ⚠️ TODO EL CÓDIGO SIGUE HABLANDO EN `#/…`, y a propósito: los links que ya circulan en Discord son `/#/r/hassan`
#: y tienen que seguir abriendo lo mismo (docs/remake/inventario.md §6). El script del principio los traduce en un
#: solo lugar: `rutaLG()` lee y `urlLG()` escribe. Pages sirve index.html en cualquier dirección que no sea un
#: archivo, y `<base href="/">` hace que la página pida sus archivos a la raíz desde `/freestyle-rap/r/hassan`.
PREFIJO = '/freestyle-rap'
EN_RAIZ = ('cuenta', 'cambios', 'ajustes')


def script(nombres):
    mapa = ','.join('"%s":1' % n for n in nombres)
    raiz = ','.join('"%s":1' % n for n in EN_RAIZ)
    return ('''(function () {
  // 🔑 LAS RUTAS DE VERDAD: /freestyle-rap/ranking en vez de #/ranking (ver web/montar.py). Todo el código de la
  // página sigue pidiendo y escribiendo `#/…`: acá se traduce, en un solo lugar.
  //   rutaLG()  la ruta pedida, sin «/» adelante: «ranking/temporada». Un `#/…` (un link viejo) gana
  //   urlLG(r)  «#/ranking» -> «/freestyle-rap/ranking»; «#/cuenta» -> «/cuenta» (lo de toda la marca, en la raíz)
  //   lg:dir    el evento de «cambió la dirección»: uno por cambio (ver `avisar()`)
  var PRE = '%s', RAIZ = {%s};
  function rutaLG() {
    var h = location.hash || '';
    if (/^#\\//.test(h)) return h.replace(/^#\\/?/, '');
    var p = location.pathname || '/', pm = p.toLowerCase();
    if (pm === PRE || pm.indexOf(PRE + '/') === 0) p = p.slice(PRE.length);
    else if (pm === '/index.html') p = '/';
    return p.replace(/^\\/+/, '').replace(/\\/+$/, '') + (location.search || '');
  }
  function urlLG(r) {
    r = String(r || '').replace(/^#?\\/?/, '');
    return (RAIZ[r.split(/[\\/?]/)[0]] ? '/' : PRE + '/') + r;
  }
  window.rutaLG = rutaLG;
  window.urlLG = urlLG;
  // cada dirección pasa a la suya, en el mismo lugar del historial: un `#/…` —un link que ya circula, o un
  // `location.hash = …` del código—, la raíz sola (a la Liga), `/ranking` sin la Liga o `/freestyle-rap/cuenta`.
  // ⚠️ Lo que vuelve de Discord (`#access_token=…`) no se toca: lo lee app.js antes de enrutar (`volverDeDiscord()`)
  function limpiar() {
    var h = location.hash || '';
    if (/^#(access_token|error)=/.test(h)) return;
    var u = urlLG(rutaLG()) + (/^#\\//.test(h) ? '' : h);
    if (u === location.pathname + location.search + h) return;
    try { history.replaceState(history.state, '', u); } catch (e) { /* queda como vino: rutaLG() la lee igual */ }
  }
  limpiar();
  // 🔑 UN AVISO POR CAMBIO DE DIRECCIÓN: `lg:dir`, que escuchan app.js, la campana y el Inicio. 🔴 No alcanza con
  // escuchar `popstate` y `hashchange`: un `location.hash = …` dispara LOS DOS (Chrome, primero popstate), y app.js
  // enrutaba dos veces — la segunda cerraba la llave que la primera acababa de abrir. El hashchange que llega
  // detrás de su popstate, con la misma ruta, no avisa
  var porPop = null;
  function avisar() { window.dispatchEvent(new Event('lg:dir')); }
  window.addEventListener('popstate', function () { limpiar(); porPop = rutaLG(); avisar(); });
  window.addEventListener('hashchange', function () {
    limpiar();
    var r = rutaLG(), p = porPop;
    porPop = null;
    if (r !== p) avisar();
  });
  // 🔴 LOS LINKS `#/…` SE ATAJAN: con <base href="/"> el navegador los llevaría a «/#/…», recargando la página. Se
  // cambia la dirección sin recargar y se avisa. Un ancla de la misma página (`#semana`) baja hasta ella. Si otro ya
  // atajó el click, no se hace nada; con Ctrl o la rueda, el navegador abre `/#/…` en otra pestaña y `limpiar()` la
  // deja en su lugar
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var camino = e.composedPath ? e.composedPath() : [e.target], a = null;
    for (var i = 0; i < camino.length; i++) { if (camino[i] && camino[i].tagName === 'A') { a = camino[i]; break; } }
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    var href = a.getAttribute('href') || '';
    if (href.charAt(0) !== '#') return;
    e.preventDefault();
    if (/^#\\//.test(href)) {
      var u = urlLG(href);
      if (u === location.pathname + location.search && !location.hash) return;
      history.pushState(null, '', u);
      porPop = null;
      avisar();
      return;
    }
    var id = href.slice(1), r = a.getRootNode ? a.getRootNode() : document;
    var el = id && ((r.getElementById && r.getElementById(id)) || document.getElementById(id));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  // ¿La ruta es el Inicio? La misma regla que ir() de app.js: vacío, lo que vuelve de Discord, o algo que no es una
  // vista. Va acá y no en la app para que el Inicio viejo no llegue a asomarse.
  var V = {%s};
  var h = location.hash || '', ini = /^#(access_token|error)=/.test(h);
  if (!ini) { var p = rutaLG().split('?')[0].split('/')[0]; ini = !p || !V[p]; }
  var c = document.documentElement.classList;''' % (PREFIJO, raiz, mapa)) + '''
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
})();'''


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


def rehacer_script(html, appjs):
    """`index.html` YA montado, con el script del principio rehecho desde `script()`: el bloque de index.html sale de
    acá, y cambiarlo a mano lo deja distinto de su fuente. `python web/montar.py --script`."""
    m = re.search(r'<script>\n\(function \(\) \{\n.*?\n\}\)\(\);\n</script>\n</head>', html, re.S)
    if not m or html.count('<script>\n(function () {\n') != 1:
        raise SystemExit('🔴 no encontré el script del principio una sola vez')
    return html[:m.start()] + '<script>\n' + script(vistas(html, appjs)) + '\n</script>\n</head>' + html[m.end():]


def main():
    idx = os.path.join(PAG, 'index.html')
    html = io.open(idx, encoding='utf-8').read()
    appjs = io.open(os.path.join(PAG, 'app.js'), encoding='utf-8').read()
    if '--script' in sys.argv:
        io.open(idx, 'w', encoding='utf-8', newline='\n').write(rehacer_script(html, appjs))
        print('✓ el script del principio de %s, rehecho' % os.path.relpath(idx, BASE))
        return
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
