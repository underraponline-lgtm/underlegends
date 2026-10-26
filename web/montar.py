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
#: encanta»), con `duelos`, el alias viejo que abre el de Duelos; `eventos` desde la 1.93 (Dlx: «sí, publícalo»),
#: con `avisos`, el link de la campana; `publicaciones` desde la 1.99 (Dlx: «me gusta pero que lo de encuestas no sea
#: lo primero que uno vea»); `socios` (lo que era Mundo; `mundo` lo sigue abriendo) y `guia` desde la 2.02 (Dlx,
#: 03/10/2026: «1. A 2. A»); `tarjetas` desde la 2.08 (Dlx, 03/10/2026: «1. A 2. A 3. A»); `r`, el perfil, desde la
#: 2.09 (Dlx, 03/10/2026: «1. A 2. A»); `llave` desde la 2.10 (Dlx: «1. A»); `tienda` y `pase` desde la 2.12 (Dlx: «A.»); `crew` y `pais` desde la 2.21 (Dlx, 04/10/2026: «si falta reworkear algo, reworkealo»).
#: La misma lista que `PROPIAS` de App.jsx
PROPIAS = ('cambios', 'ranking', 'duelos', 'eventos', 'avisos', 'publicaciones', 'socios', 'mundo', 'guia', 'tarjetas', 'r',
           'llave', 'tienda', 'pase', 'crew', 'pais')

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
html.ini-nuevo body{background:#030304}
html.ini-nuevo.ini-noche body{background:#030304}
html.ini-nuevo{scroll-padding-top:0}
#lg-carga{display:none}
html.ini-nuevo #lg-carga{display:grid;position:fixed;inset:0;z-index:1000;place-items:center;overflow:hidden;background:#030304;color:#F6F6F6;
  transition:opacity .35s ease,visibility 0s linear .35s}
html.ini-nuevo.lg-listo:not(.lg-carga-js) #lg-carga{opacity:0;visibility:hidden}
html.ini-nuevo.lg-fuera #lg-carga{display:none}
#lg-carga .lg-c{position:relative;z-index:3;display:grid;justify-items:center;gap:10px}
#lg-carga .lg-sello{position:relative;width:96px;height:96px}
#lg-carga .lg-sello img{position:relative;z-index:2;display:block;width:96px;height:96px;animation:lg-sello .65s cubic-bezier(.2,.8,.25,1.15) both}
#lg-carga .lg-sombra{position:absolute;inset:0;background:#E41373;animation:lg-sombra .35s .42s cubic-bezier(.2,.9,.3,1.3) both}
#lg-carga .lg-onda{position:absolute;inset:0;border:3px solid #29B298;opacity:0;animation:lg-onda .6s .38s ease-out both}
#lg-carga .lg-tit{display:flex;overflow:hidden;padding-top:4px;font:900 23px/1 Archivo,system-ui,sans-serif;font-stretch:118%;letter-spacing:.04em}
#lg-carga .lg-tit i{display:inline-block;font-style:normal;animation:lg-sube .5s cubic-bezier(.2,.9,.2,1) both;animation-delay:calc(.32s + var(--i) * .04s)}
#lg-carga .lg-tit .lg-esp{width:.32em}
#lg-carga small{font:700 13px/1 "Barlow Condensed",system-ui,sans-serif;letter-spacing:.24em;color:#29B298;animation:lg-abre .6s .75s cubic-bezier(.2,.8,.2,1) both}
#lg-carga .lg-seg{display:grid;grid-template-columns:repeat(12,10px);gap:4px;margin-top:10px;animation:lg-aparece .35s .85s both}
#lg-carga .lg-seg i{height:7px;background:#1d1d24;transform:skewX(-20deg);transition:background .12s}
#lg-carga .lg-seg i.on{background:#E41373}
#lg-carga .lg-seg.lleno i{background:#29B298}
#lg-carga .lg-tip{display:block;height:16px;overflow:hidden;font:700 13px/16px "Barlow Condensed",system-ui,sans-serif;letter-spacing:.12em;
  text-transform:uppercase;color:#A5A5A0;animation:lg-aparece .35s .85s both}
#lg-carga .lg-tip span{display:block;animation:lg-tip .3s ease-out}
#lg-carga .lg-capa{display:none}
html.lg-carga-js #lg-carga{background:none}
html.lg-carga-js #lg-carga .lg-capa{display:block;position:absolute;left:50%;top:50%;width:130vmax;height:130vmax;margin:-65vmax 0 0 -65vmax;will-change:transform;
  transform:rotate(30deg) translateY(-5vmax)}
#lg-carga .lg-capa.n{z-index:2;background:#030304}
#lg-carga .lg-capa.m{z-index:1;background:#E41373}
#lg-carga .lg-capa.v{z-index:0;background:#29B298}
html.lg-sale #lg-carga{pointer-events:none}
html.lg-sale #lg-carga .lg-c{animation:lg-fuera .35s ease-in forwards}
html.lg-sale #lg-carga .lg-capa{will-change:transform;animation:lg-corte 1s .25s cubic-bezier(.65,0,.35,1) forwards}
html.lg-sale #lg-carga .lg-capa.m{animation-delay:.4s}
html.lg-sale #lg-carga .lg-capa.v{animation-delay:.55s}
@keyframes lg-sello{0%{transform:scale(1.9) rotate(-14deg);opacity:0}45%{opacity:1}70%{transform:scale(.94) rotate(2deg)}100%{transform:none;opacity:1}}
@keyframes lg-sombra{from{transform:none}to{transform:translate(7px,7px)}}
@keyframes lg-onda{0%{transform:scale(1);opacity:.9}100%{transform:scale(1.7);opacity:0}}
@keyframes lg-sube{from{transform:translateY(110%)}to{transform:none}}
@keyframes lg-abre{from{transform:scaleX(1.9);opacity:0}to{transform:none;opacity:1}}
@keyframes lg-aparece{from{opacity:0}to{opacity:1}}
@keyframes lg-tip{from{transform:translateY(100%);opacity:0}to{transform:none;opacity:1}}
@keyframes lg-fuera{to{transform:scale(1.14);opacity:0}}
@keyframes lg-corte{to{transform:rotate(30deg) translateY(-125vmax)}}
@media (prefers-reduced-motion: reduce){
  #lg-carga *{animation:none!important}
  html.lg-sale #lg-carga{opacity:0;transition:opacity .25s ease}
}
html.calma #lg-carga *{animation:none!important}
html.calma.lg-sale #lg-carga{opacity:0;transition:opacity .25s ease}'''


#: ⏳ LA PANTALLA DE CARGA (Dlx, 17/10/2026: «¿y si hacemos una pestaña de carga?»): lo primero del <body>
HTML_CARGA = """<body>
<!-- ⏳ LA PANTALLA DE CARGA (Dlx, 17/10/2026: «¿y si hacemos una pestaña de carga?»). Va en el HTML y no en la app: se ve
     al instante, también con 3G lento (la app tarda ~7 s en bajar; ver el plan B de arriba). Se va cuando la app tiene
     los datos (`lg-listo`, App.jsx) o cuando vuelve la página de antes (el plan B saca `ini-nuevo`). La pone
     web/montar.py.
     ✂️ Y SE VA CON UN CORTE (Dlx, 18/10/2026: «la transición… es demasiado básica»; de tres, eligió el Corte): el logo
     cae como un sello, la barra se llena por partes y tres capas —negra, magenta, verde— se van en diagonal. Con
     transform y no con clip-path: en un Android modesto mover una capa es barato y recortar la pantalla entera no.
     ⚠️ «LA PÁGINA CARGA RÁPIDO Y LA ANIMACIÓN NO SE NOTA» (Dlx): la primera vez de cada visita (`lg:intro`, de la
     sesión) el corte espera a que la entrada termine (`MIN`, ~1,9 s: Dlx, 18/10, «la veo completa pero pasa bien
     rápido», después «1 segundo menos» y el 19/10 «medio segundo más»), con la barra llenándose de a poco y un momento llena; al recargar en la misma visita, sin espera. Con
     «reducir movimiento», nada de esto: se apaga con un fundido. Sin este script, se apaga como antes. -->
<div id="lg-carga" aria-hidden="true"><i class="lg-capa v"></i><i class="lg-capa m"></i><i class="lg-capa n"></i><div class="lg-c"><span class="lg-sello"><span class="lg-sombra"></span><span class="lg-onda"></span><img src="/ul.png" alt="" width="96" height="96"></span><b class="lg-tit"><i style="--i:0">L</i><i style="--i:1">I</i><i style="--i:2">G</i><i style="--i:3">A</i><i class="lg-esp" style="--i:4"></i><i style="--i:5">G</i><i style="--i:6">L</i><i style="--i:7">O</i><i style="--i:8">B</i><i style="--i:9">A</i><i style="--i:10">L</i></b><small>DE FREESTYLE</small><span class="lg-seg"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="lg-tip"><span>Cargando el ranking</span></span></div></div>
<script>
(function () {
  var h = document.documentElement, el = document.getElementById('lg-carga');
  if (!el || !h.classList.contains('ini-nuevo')) return;
  h.classList.add('lg-carga-js');
  var t0 = Date.now(), quieto = false, primera = true;
  try { quieto = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  // 🧘 y «Menos animaciones» de Mi cuenta, que app.js pone recién al llegar: acá se lee del navegador
  try { if ((JSON.parse(localStorage.getItem('lg:ajustes') || 'null') || {}).calma) { quieto = true; h.classList.add('calma'); } } catch (e) {}
  try { primera = !sessionStorage.getItem('lg:intro'); sessionStorage.setItem('lg:intro', '1'); } catch (e) {}
  var MIN = quieto ? 0 : (primera ? 1900 : 0);
  var segs = el.querySelectorAll('.lg-seg i'), tip = el.querySelector('.lg-tip');
  var TIPS = ['Cargando el ranking', 'Preparando las llaves', 'Contando los puntos', 'Buscando tus tarjetas'];
  var k = 0, p = 0, ya = false;
  var tt = setInterval(function () { k = (k + 1) % TIPS.length; tip.innerHTML = '<span>' + TIPS[k] + '</span>'; }, 1300);
  // la barra avanza sola hasta casi el final; el último tramo, cuando la app tiene los datos
  var tic = setInterval(function () {
    if (!h.classList.contains('ini-nuevo')) { clearInterval(tic); clearInterval(tt); return; }
    var listo = h.classList.contains('lg-listo');
    p = listo ? Math.min(1, p + (primera ? 0.14 : 0.34)) : p + (0.86 - p) * 0.06;
    for (var j = 0, n = Math.floor(p * 12 + 1e-6); j < 12; j++) segs[j].className = j < n ? 'on' : '';
    if (listo && p >= 1 && !ya) {
      ya = true; clearInterval(tic); clearInterval(tt);
      el.querySelector('.lg-seg').className = 'lg-seg lleno';
      setTimeout(function () {
        h.classList.add('lg-sale');
        setTimeout(function () { h.classList.add('lg-fuera'); }, quieto ? 300 : 1700);
      }, Math.max(primera && !quieto ? 200 : 80, MIN - (Date.now() - t0)));
    }
  }, 70);
})();
</script>
"""


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
#: (`sumate` vivió acá del 03/10 al 13/10/2026: Dlx la descartó)
EN_RAIZ = ('cuenta', 'cambios', 'ajustes', 'dashboard')
#: 🔍 LAS VISTAS VIEJAS EN PREVIEW: con `lg:prev-<x>` (el link `?prev=<x>`) esa vista es del Inicio nuevo en ese
#: navegador. La primera fue la llave (`ll`, 03/10/2026), publicada en la 2.10; la Tienda y el Pase (`ti`), en la 2.12.
#: Cuando se publica, pasa a `PROPIAS`
PREVIEWS = {}


def script(nombres):
    mapa = ','.join('"%s":1' % n for n in nombres)
    prev = ','.join('"%s":"%s"' % (v, x) for v, x in sorted(PREVIEWS.items()) if v in nombres)
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
  // 🛡️ EL PERMISO DE DISCORD SALE DE LA DIRECCIÓN YA (04/10/2026, la lista de seguridad de Dlx). Vuelve en el `#` y
  // quedaba en la barra —y en el historial— hasta que app.js bajaba los datos; si `/api/lobby` fallaba, no salía
  // nunca, y con ese permiso se vota y se gastan Puntos durante 7 días. Queda en memoria para `volverDeDiscord()`,
  // que decide adónde volver como siempre
  var hv = location.hash || '';
  if (/^#(access_token|error)=/.test(hv)) {
    window.__vueltaDC = hv;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* queda en la barra */ }
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
  // 🔍 UNA VISTA VIEJA EN PREVIEW (03/10/2026, la llave): `?prev=ll` deja `lg:prev-ll` en este navegador —lo mismo
  // que App.jsx— y, con eso, esa vista es del Inicio nuevo. Va acá porque app.js lo tiene que saber antes de enrutar
  var PREV = {%s};
  try {
    var mp = /[?&]prev=([a-z]{2,12})\\b/.exec(location.search), mn = /[?&]noprev=([a-z]{2,12})\\b/.exec(location.search);
    if (mp) localStorage.setItem('lg:prev-' + mp[1], '1');
    if (mn) localStorage.removeItem('lg:prev-' + mn[1]);
  } catch (e) { /* sin almacenamiento, sin preview */ }
  function nueva(p) {
    if (!V[p]) return true;
    try { return !!(PREV[p] && localStorage.getItem('lg:prev-' + PREV[p])); } catch (e) { return false; }
  }
  // ¿esa vista la dibuja el Inicio nuevo? app.js lo pregunta antes de abrir lo suyo encima (la llave)
  window.__esNueva = nueva;
  var h = location.hash || '', ini = /^#(access_token|error)=/.test(h);
  if (!ini) { var p = rutaLG().split('?')[0].split('/')[0]; ini = !p || nueva(p); }
  var c = document.documentElement.classList;''' % (PREFIJO, raiz, mapa, prev)) + '''
  if (ini) c.add('ini-nuevo');
  try { var tm = localStorage.getItem('lg:tema'); if (tm && tm !== 'clara') c.add('ini-noche'); } catch (e) { /* sin guardar */ }
  // la última versión del changelog que se vio, ANTES de que app.js la dé por vista (lo lee el Inicio nuevo)
  try { window.__cambiosVisto = JSON.parse(localStorage.getItem('lg:cambios') || '""') || ''; } catch (e) { /* sin guardar */ }
  // «Instalar» (01/10/2026): Chrome avisa que la página se puede instalar una sola vez y puede ser antes de que el
  // Inicio monte. Se guarda acá y el Inicio pone su propio botón; sin esto, Chrome mostraba el suyo cuando quería
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); window.__instalar = e; window.dispatchEvent(new Event('lg:instalar'));
  });
  window.addEventListener('appinstalled', function () { window.__instalar = null; window.dispatchEvent(new Event('lg:instalar')); });
  // si la app no llegó a montarse (un navegador viejo, o se rompió), vuelve el Inicio de hoy
  function planB() {
    var el = document.getElementById('inicio-nuevo');
    // y lo viejo se dibuja recién ahora: mientras mandaba la página nueva, app.js no lo dibujó (`mandaLoNuevo()`)
    if (!el || !el.shadowRoot) { window.__inicioSinDatos = true; c.remove('ini-nuevo'); if (window.__pintarViejo) window.__pintarViejo(); }
  }
  // ⚠️ LOS 8 SEGUNDOS CUENTAN DESDE QUE BAJÓ TODO (`load`), NO DESDE QUE SE ABRIÓ LA PÁGINA. Dlx, 15/10/2026: «a Juan
  // no le carga la página a veces, y a mí me pasa lo mismo». Medido con un celular modesto y 3G lento: la app termina
  // de bajar a los ~7 s y se arma a los 7,1; un poco peor y el plan B se adelantaba, dejaba el Inicio viejo —que ya
  // casi no tiene nada— y la app, aunque llegara un segundo después, no volvía. Si su archivo NO baja, va al toque
  if (document.readyState === 'complete') setTimeout(planB, 8000);
  else window.addEventListener('load', function () { setTimeout(planB, 8000); });
  window.addEventListener('error', function (e) {
    var t = e && e.target;
    if (t && t.tagName === 'SCRIPT' && /\\/inicio\\/inicio\\.js/.test(t.src || '')) planB();
  }, true);
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
    # ⏳ la pantalla de carga, lo primero del <body> (17/10/2026)
    html = html.replace('<body>\n', HTML_CARGA, 1)
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
