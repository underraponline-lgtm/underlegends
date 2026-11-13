# -*- coding: utf-8 -*-
"""INDEX.HTML, ENTERO: la cáscara donde se monta la página (React, `web/`).

    python web/montar.py            rehace bot/paginas/index.html desde acá (sus metas se conservan)
    python web/montar.py --script   rehace SÓLO el script del principio (lo mismo, de a una parte)

Nació el 29/09/2026 para ENCHUFAR el Inicio nuevo a la página de hoy (`app.js`): agregaba el CSS que apagaba el marco
viejo, `#inicio-nuevo` y un script que decidía, antes de dibujar, si la ruta era del Inicio nuevo o de la vieja. El
27/10/2026 se fue `app.js` (la tanda 4 del remake; Dlx: «Borra la tanda 4 entonces»), y con él las vistas viejas:
desde entonces esto arma la página ENTERA, que es poco:

1. El `<head>` de siempre (título, metas para Discord, manifiesto): se toma del index.html que hay, tal cual.
2. Las fuentes (`/inicio/inicio.css`), el CSS de la cáscara (`CSS`: el fondo, la pantalla de carga y el aviso de
   «no pude cargar») y el script del principio (`script()`): las rutas de verdad, el permiso de Discord fuera de la
   dirección y el plan B.
3. En el `<body>`: la pantalla de carga, `#inicio-nuevo` (ahí se monta la app, en un shadow root: web/src/main.jsx),
   el aviso de «No pude cargar los datos» y los scripts — la cañería que la app escucha (comun, cuenta, tienda,
   social, datos y nucleo.js, que es lo que quedó de app.js) y después la app.

⚠️ SIN DATOS NO HAY PÁGINA EN BLANCO: si `/api/lobby` no contesta, si la app no se monta en 8 s o se rompe entera,
sale «No pude cargar los datos» con «Reintentar» (`__sinPagina()`). Antes eso lo hacía el Inicio viejo, que quedaba
escondido de respaldo; es lo que mira `herramientas/web_en_borde.py`.
"""
import io
import os
import re
import sys

WEB = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(WEB)
PAG = os.path.join(BASE, 'bot', 'paginas')
MARCA = 'inicio-nuevo'

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

#: el CSS de la cáscara: lo que hay fuera de la app. La base del documento es la que ponía estilo.css (que se fue con
#: app.js): lo que hereda la app adentro de su shadow root —el color y la letra— tiene que seguir siendo lo mismo
CSS = '''*{margin:0;padding:0;box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth;scroll-padding-top:0}
body{background:#030304;color:#EDEDF2;overflow-x:hidden;font:17px/1.55 Archivo,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
#inicio-nuevo{display:block;position:relative;z-index:4}
html.sin-pagina #inicio-nuevo,html.sin-pagina #lg-carga{display:none!important}
#sin-pagina{display:none}
html.sin-pagina #sin-pagina{display:grid;min-height:100vh;min-height:100dvh;place-content:center;justify-items:center;gap:14px;padding:24px;text-align:center}
#sin-pagina img{width:72px;height:72px}
#sin-pagina h1{font:900 24px/1.15 Archivo,system-ui,sans-serif;font-stretch:118%;color:#F6F6F6;text-wrap:balance}
#sin-pagina p{max-width:34em;color:#9CAAA7;font-size:16px}
#sin-pagina button{margin-top:4px;padding:12px 22px;border:0;background:#E41373;color:#F6F6F6;font:800 15px/1 Archivo,system-ui,sans-serif;
  letter-spacing:.04em;text-transform:uppercase;cursor:pointer}
#sin-pagina button:focus-visible{outline:3px solid #29B298;outline-offset:3px}
#lg-carga{display:none}
html.ini-nuevo #lg-carga{display:block;position:fixed;inset:0;z-index:1000;overflow:hidden;background:#030304;color:#F6F6F6;
  transition:opacity .35s ease,visibility 0s linear .35s}
html.ini-nuevo.lg-listo:not(.lg-carga-js) #lg-carga{opacity:0;visibility:hidden}
html.ini-nuevo.lg-fuera #lg-carga{display:none}
#lg-carga .lg-c{position:absolute;inset:0;z-index:3}
/* 🏷️ arriba a la izquierda, la marca de la bienvenida: el UL y la temporada en blanco */
#lg-carga .lg-marca{position:absolute;top:22px;left:max(56px,calc((100% - 1320px) / 2));display:flex;align-items:center;gap:10px;
  filter:drop-shadow(0 1px 6px rgba(3,3,4,.8))}
#lg-carga .lg-marca img{display:block;width:auto;height:42px}
#lg-carga .lg-marca i{width:2px;height:28px;background:rgba(246,246,246,.5)}
#lg-carga .lg-marca b{font:900 28px/1 Archivo,system-ui,sans-serif;font-stretch:125%}
/* 🎬 el título de la bienvenida, SIEMPRE EN EL MISMO LUGAR (Dlx: «como Brawl Stars, que siempre tiene su estilo pero
   diferentes fondos»): el sello, «LIGA GLOBAL» en blanco y «DE FREESTYLE» en magenta.
   ⚪ BLANCO LISO, NO RELLENO CON LA FOTO (Dlx, 13/11/2026: «los fondos de carga no deberían tener el texto de textura
   esa… simplemente color blanco»). Hasta la 4.95 iba relleno con el fondo que tocó, como el de la bienvenida; ESE de la
   bienvenida (`.bv-t-rel`, con el video) no se toca: es otra pieza */
#lg-carga .lg-logo{position:absolute;left:50%;top:max(24px,5.2vw);translate:-50% 0;display:grid;justify-items:center;gap:max(10px,.9vw);text-align:center}
#lg-carga .lg-logo::before{content:'';position:absolute;left:50%;top:50%;width:150%;height:210%;translate:-50% -50%;z-index:-1;
  background:radial-gradient(ellipse at center,rgba(3,3,4,.82) 0,rgba(3,3,4,.55) 45%,transparent 72%)}
#lg-carga .lg-sello{display:inline-block;padding:7px 12px 6px;background:#E41373;color:#fff;border-radius:2px;
  font:700 clamp(12px,1vw,17px)/1 "Barlow Condensed",system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;transform:rotate(-3deg);
  box-shadow:4px 4px 0 #29B298}
#lg-carga .lg-t{display:grid;gap:2px;font:900 clamp(30px,3.9vw,76px)/.9 Archivo,system-ui,sans-serif;font-stretch:125%;letter-spacing:.01em;
  word-spacing:.08em;white-space:nowrap;filter:drop-shadow(0 4px 16px rgba(0,0,0,.65))}
#lg-carga .lg-t1{color:#F6F6F6}
#lg-carga .lg-t2{color:#E41373;text-shadow:0 0 3px rgba(3,3,4,.85),0 0 14px rgba(3,3,4,.75)}
/* 🔦 el magenta, con su sombra (13/11/2026, Dlx: «fíjate… el contraste»). Medido letra contra lo que la rodea: «DE FREESTYLE»
   quedaba bajo 3:1 (lo mínimo para texto grande) en 11 de 78 casos, con la gente iluminada de dos batallas detrás. El
   magenta tiene poca luz propia (contra negro puro da 4,8:1), así que no alcanza con el velo del título: va su sombra */
/* ⏳ abajo al centro, la barrita celeste de la bienvenida: el consejo, el porcentaje y la barra */
#lg-carga .lg-pie{position:absolute;left:50%;bottom:max(20px,3.2vw);translate:-50% 0;width:min(560px,34vw);display:grid;gap:12px}
#lg-carga .lg-fila{display:flex;justify-content:space-between;align-items:baseline;gap:12px;text-shadow:0 1px 8px rgba(3,3,4,.9)}
/* 🔦 la marca y el consejo, con sombra (13/11/2026): con el teléfono acostado, sobre los afiches y el 3D bajaban de 4,5:1 */
/* 🎞️ LOS CONSEJOS, EL PORCENTAJE Y LA BARRA LOS MUEVE EL COMPOSITOR, no el JS (13/11/2026, Dlx: «asegúrate que esto sea
   smooth»). Mientras está la pantalla, la app se arma atrás y en un celular modesto eso traba el hilo principal 1,5–2 s
   seguidos: lo que se movía con JS se congelaba. Los consejos van en una animación de CSS (uno cada 1,3 s), la barra con
   `animate()` y el número es una TIRA con 0 %…100 % que sube a saltos (`steps`), con la misma curva que la barra */
#lg-carga .lg-tip{display:grid;min-width:0;font:700 clamp(12px,1.1vw,17px)/1.2 "Barlow Condensed",system-ui,sans-serif;letter-spacing:.16em;
  text-transform:uppercase;color:#C9C9C4}
#lg-carga .lg-tip>span{grid-area:1/1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:0}
#lg-carga .lg-tip>span:first-child{opacity:1}
#lg-carga .lg-tip>span:not(.lg-ya){animation:lg-tip 5.2s linear infinite both}
#lg-carga .lg-tip>span:nth-child(2){animation-delay:1.3s}
#lg-carga .lg-tip>span:nth-child(3){animation-delay:2.6s}
#lg-carga .lg-tip>span:nth-child(4){animation-delay:3.9s}
#lg-carga.lleno .lg-tip>span{animation:none;opacity:0}
#lg-carga.lleno .lg-tip>.lg-ya{opacity:1}
#lg-carga .lg-pct{display:block;flex:none;height:1.15em;overflow:hidden;font:900 clamp(14px,1.3vw,22px)/1.15 Archivo,system-ui,sans-serif;
  font-stretch:125%;font-variant-numeric:tabular-nums;text-align:right}
#lg-carga .lg-cifras{display:block;will-change:transform}
#lg-carga .lg-barra{position:relative;height:4px;background:rgba(246,246,246,.2);border-radius:2px;overflow:hidden}
#lg-carga .lg-barra i{position:absolute;inset:0;background:#29B298;border-radius:2px;transform-origin:0 50%;transform:scaleX(0);
  will-change:transform;transition:background-color .3s ease}
#lg-carga.lleno .lg-barra i{background:#F6F6F6}
/* 📱 el teléfono PARADO (13/11/2026): acostado (844×390) usaba estos tamaños y el título le tapaba media pantalla y la
   barra. Acostado va como la compu, que se mide por el ancho */
@media (max-width:899.98px) and (orientation:portrait){
  /* 📏 con tope por el ALTO (13/11/2026): medido por el ancho, en una tablet parada (3:4) el título bajaba hasta el 28 %
     de la pantalla y tapaba el fondo. En un teléfono (≈ 9:19,5) el ancho y el alto dan lo mismo, y queda igual */
  #lg-carga .lg-marca{top:max(16px,min(6vw,2.8vh));left:5.5vw;gap:2.4vw}
  #lg-carga .lg-marca img{height:max(24px,min(7.4vw,3.4vh))}
  #lg-carga .lg-marca i{height:max(16px,min(5vw,2.3vh))}
  #lg-carga .lg-marca b{font-size:max(18px,min(5vw,2.3vh))}
  #lg-carga .lg-logo{top:min(16vw,7.4vh);gap:min(2.4vw,1.1vh)}
  #lg-carga .lg-sello{font-size:max(11px,min(3.2vw,1.5vh))}
  #lg-carga .lg-t{font-size:min(9.4vw,4.3vh)}
  #lg-carga .lg-pie{width:82vw;bottom:calc(min(11vw,5vh) + env(safe-area-inset-bottom,0px))}
  #lg-carga .lg-tip{font-size:max(12px,min(3.6vw,1.7vh))}
  #lg-carga .lg-pct{font-size:max(14px,min(4.2vw,1.95vh))}
}
/* ✂️ el corte de salida (18/10/2026): tres capas —negra, magenta, verde— se van en diagonal; el fondo vive en la negra */
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
/* 🌅 QUE EMPIECE DE A POCO (Dlx, 12/11/2026: «se lagea un poquito cuando la página de carga empieza… que empiece poco a
   poco»). Tironeaba por tres cosas a la vez: el título salía con la letra del sistema y saltaba a la nuestra al llegar,
   todo entraba en el mismo instante en que la página baja su código, y el relleno del título se movía (repintarlo en
   cada cuadro). Ahora nada aparece hasta que están las letras (`va`: document.fonts.ready, o 0,7 s), y entra en
   escalera: la marca, el título, el sello y la barra; la foto, con un fundido largo, recién decodificada.
   🔴 Y ESO SOLO NO ALCANZÓ (13/11/2026): medido con un trace (CPU ×4), la app se arma en UNA tarea de 1,7 s que
   arrancaba a los 1,36 s, justo después de `va`: la escalera no llegaba a empezar y la pantalla quedaba en negro hasta
   los ~3 s. Ahora la app ESPERA a que la pantalla entre (`__lgApp`, ver SCRIPTS) y todo lo que se mueve después lo
   anima el compositor, que sigue andando aunque el hilo principal esté trabado */
#lg-carga .lg-marca,#lg-carga .lg-sello,#lg-carga .lg-t,#lg-carga .lg-pie{opacity:0}
#lg-carga.va .lg-marca{animation:lg-sube .8s ease-out .05s both}
#lg-carga.va .lg-t{animation:lg-sube 1s cubic-bezier(.2,.7,.2,1) .2s both}
#lg-carga.va .lg-sello{animation:lg-sello .8s cubic-bezier(.2,.7,.3,1) .7s both}
#lg-carga.va .lg-pie{animation:lg-sube .8s ease-out .9s both}
#lg-carga.va.quieto .lg-marca,#lg-carga.va.quieto .lg-sello,#lg-carga.va.quieto .lg-t,#lg-carga.va.quieto .lg-pie{opacity:1}
@keyframes lg-sube{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes lg-sello{from{opacity:0;transform:rotate(-3deg) scale(1.25)}to{opacity:1;transform:rotate(-3deg)}}
@keyframes lg-tip{0%{opacity:0;transform:translateY(.4em)}5%,22%{opacity:1;transform:none}27%,100%{opacity:0;transform:translateY(-.4em)}}
@keyframes lg-fuera{to{transform:scale(1.14);opacity:0}}
@keyframes lg-corte{to{transform:rotate(30deg) translateY(-125vmax)}}
@keyframes lg-grano{0%,100%{transform:none}20%{transform:translate3d(-3%,2%,0)}40%{transform:translate3d(2%,-3%,0)}60%{transform:translate3d(-2%,-1%,0)}80%{transform:translate3d(3%,3%,0)}}
@media (prefers-reduced-motion: reduce){
  #lg-carga *{animation:none!important}
  html.lg-sale #lg-carga{opacity:0;transition:opacity .25s ease}
}
html.calma #lg-carga *{animation:none!important}
html.calma.lg-sale #lg-carga{opacity:0;transition:opacity .25s ease}'''


#: 🔤 las dos letras de la pantalla de carga (el título, la marca y el número en Archivo; el sello y los consejos en
#: Barlow Condensed 700). Se piden en el <head>, antes que nada: si llegan tarde, el título sale con la letra del sistema
#: y salta. Tienen que ser las MISMAS direcciones que pide /inicio/inicio.css, o se bajarían dos veces
FUENTES_CARGA = ('archivo-latin-wdth-normal.woff2', 'barlow-condensed-latin-700-normal.woff2')


def conf_carga():
    """Lo que la pantalla de carga sabe de los fondos: de dónde salen (R2), la temporada, cuáles hay y qué precargar.
    Los fondos los arma herramientas/fondos_carga.py y viven en R2; cuáles hay lo dice web/carga.json."""
    import json
    conf = json.load(io.open(os.path.join(WEB, 'carga.json'), encoding='utf-8'))
    sw = io.open(os.path.join(BASE, 'bot', 'subir_web.py'), encoding='utf-8').read()
    r2 = re.search(r"^R2 = '([^']+)'", sw, re.M)
    if not r2:
        raise SystemExit('🔴 no encontré R2 en bot/subir_web.py: la pantalla de carga no sabe de dónde sacar los fondos')
    # 📦 lo que se precarga mientras está la pantalla: las páginas del menú (no el Dashboard ni el panel del socio,
    # que son de pocos y pesan la mitad de todo)
    fuera = {'inicio.js', 'inicio-dashboard.js', 'inicio-socio2.js', 'inicio-panelsocio.js', 'inicio-verificar.js'}
    trozos = sorted(f for f in os.listdir(os.path.join(PAG, 'inicio')) if f.endswith('.js') and f not in fuera)
    return json.dumps({'r2': r2.group(1), 't': conf['temporada'], 'v': conf.get('v', 1), 'f': conf['fondos'], 'b': [b['id'] for b in conf['batallas']],
                       'p': trozos}, ensure_ascii=False, separators=(',', ':')), conf['temporada'].upper()


def cabeza_carga():
    """🚀 LO PRIMERO DE LA PANTALLA DE CARGA, EN EL <head> Y ANTES DE LA HOJA DE ESTILOS (13/11/2026). Un <script> que
    viene después de una hoja de estilos espera a que baje; acá no espera nada, así que el fondo sale a pedirse a los
    ~0,2 s en vez de a los ~0,6 (medido con un trace, CPU ×4). Lo mismo las dos letras y el código de la app, que se
    baja ya pero NO corre hasta que la pantalla entró (ver SCRIPTS)."""
    css = io.open(os.path.join(PAG, 'inicio', 'inicio.css'), encoding='utf-8').read()
    for f in FUENTES_CARGA:
        if not os.path.isfile(os.path.join(PAG, 'inicio', 'f', f)) or ('/inicio/f/' + f) not in css:
            raise SystemExit('🔴 la letra %s no está en /inicio/f/ o inicio.css no la pide así: la pantalla de carga la '
                             'precargaría de balde' % f)
    c, _ = conf_carga()
    letras = ''.join('<link rel="preload" href="/inicio/f/%s" as="font" type="font/woff2" crossorigin>\n' % f
                     for f in FUENTES_CARGA)
    return (letras + '<link rel="modulepreload" href="/inicio/inicio.js">\n<script>\n' + """(function () {
  // 🎲 EL FONDO, ELEGIDO YA: cada uno con la misma chance; en «La batalla», cada video con la suya (Dlx, 12/11/2026)
  var C = window.__lgC = @CONF@;
  try {
    var n = C.f[Math.floor(Math.random() * C.f.length)];
    var nom = n === 2 ? '2-' + C.b[Math.floor(Math.random() * C.b.length)] : String(n);
    var fmt = innerWidth / Math.max(1, innerHeight) < 0.8 ? 'cel' : 'pc';
    var d = new Date(), dia = d.getUTCFullYear() * 1e4 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
    var src = window.__lgFondo = C.r2 + '/carga/' + C.t + '/' + nom + '-' + fmt + '.webp?d=' + dia + '-' + (C.v || 1);
    var l = document.createElement('link');
    l.rel = 'preload'; l.as = 'image'; l.href = src;
    l.setAttribute('fetchpriority', 'high');
    document.head.appendChild(l);
  } catch (e) { /* sin fondo: la pantalla sale en negro, con el título y la barra */ }
})();
</script>
""".replace('@CONF@', c))


#: ⏳ LA PANTALLA DE CARGA (Dlx, 17/10/2026: «¿y si hacemos una pestaña de carga?»): lo primero del <body>. Desde el
#: 12/11/2026, con los fondos de la temporada (Dlx: «como lo hace Brawl Stars pero con nuestros integrantes»)
def html_carga():
    """La pantalla de carga: el HTML y su script. El fondo ya lo eligió `cabeza_carga()` (`__lgFondo`)."""
    _, temp = conf_carga()
    tips = ''.join('<span>%s</span>' % t for t in
                   ('Cargando el ranking', 'Preparando las llaves', 'Contando los puntos', 'Buscando tus tarjetas'))
    return ("""<body>
<!-- ⏳ LA PANTALLA DE CARGA (Dlx, 17/10/2026: «¿y si hacemos una pestaña de carga?»). Va en el HTML y no en la app: se ve
     al instante, también con 3G lento. Se va cuando la app tiene los datos (`lg-listo`, App.jsx) y terminó de
     acomodarse, o cuando sale el aviso de «no pude cargar» (`sin-pagina`). La pone web/montar.py.
     🎲 LOS FONDOS (Dlx, 12/11/2026): cinco por temporada, cada uno con la misma chance, y en «La batalla» cada video con
     su parte. Los arma herramientas/fondos_carga.py y viven en R2 (carga/<temporada>/); cuáles hay, web/carga.json.
     El título, la marca y la barra son los de la bienvenida y van SIEMPRE en el mismo lugar: cambia el fondo, no el estilo.
     ⏳ 4 SEGUNDOS LA PRIMERA VEZ (Dlx: «que la página se demore un poco más… para que se contemple»), mientras se
     precarga todo; si vuelve en los siguientes 30 minutos (`lg:carga`), lo que tarde en cargar.
     🎞️ SUAVE (Dlx, 13/11/2026: «asegúrate que esto sea smooth»): la app espera a que la pantalla entre, y lo que se
     mueve después lo anima el compositor, que no se traba cuando la app se arma atrás.
     ✂️ Y SE VA CON EL CORTE (18/10/2026): tres capas —negra, magenta, verde— en diagonal; el fondo vive en la negra. -->
<div id="lg-carga" aria-hidden="true"><i class="lg-capa v"></i><i class="lg-capa m"></i><i class="lg-capa n"><b class="lg-foto"><b class="lg-img"></b><b class="lg-velo"></b><svg class="lg-grano"><filter id="lg-gr"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#lg-gr)"/></svg></b></i><div class="lg-c"><span class="lg-marca"><img src="/ul-blanco.png" alt="" width="160" height="130"><i></i><b>@TEMP@</b></span><div class="lg-logo"><span class="lg-sello">Temporada @NUM@ · en juego</span><span class="lg-t"><span class="lg-t1">LIGA GLOBAL</span><span class="lg-t2">DE FREESTYLE</span></span></div><div class="lg-pie"><div class="lg-fila"><span class="lg-tip">@TIPS@<span class="lg-ya">Listo</span></span><b class="lg-pct"><span class="lg-cifras">0%</span></b></div><span class="lg-barra"><i></i></span></div></div></div>
<script>
(function () {
  var h = document.documentElement, el = document.getElementById('lg-carga');
  // 🚦 LA APP ESPERA A QUE LA PANTALLA ENTRE (ver `__lgApp`, al final de la página): `entro()` la suelta. Si algo de
  // acá falla, la suelta igual: una pantalla de carga rota no puede dejar a nadie sin página
  var entro = function () {
    if (window.__lgEntro) return;
    window.__lgEntro = true;
    if (window.__lgApp) window.__lgApp();
  };
  if (!el || !h.classList.contains('ini-nuevo')) { entro(); return; }
  try {
    h.classList.add('lg-carga-js');
    var C = window.__lgC || { p: [] }, src = window.__lgFondo || '';
    var t0 = Date.now(), quieto = false, primera = true;
    try { quieto = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    // 🧘 y «Menos animaciones» de Tu cuenta, que nucleo.js pone recién al llegar: acá se lee del navegador
    try { if ((JSON.parse(localStorage.getItem('lg:ajustes') || 'null') || {}).calma) { quieto = true; h.classList.add('calma'); } } catch (e) {}
    // ⏳ la primera vez, 4 s; si volvió en los últimos 30 minutos, lo que tarde
    try { primera = t0 - (+localStorage.getItem('lg:carga') || 0) > 18e5; localStorage.setItem('lg:carga', String(t0)); } catch (e) {}
    var MIN = primera ? 4000 : 0;
    // la app no espera más que esto, aunque las letras o la foto no lleguen
    setTimeout(entro, primera ? 1400 : 700);
    var vaYa = false, fotoYa = !src;
    function entrada() {
      if (!vaYa || !fotoYa) return;
      // dos cuadros: en el primero se dibuja la escalera con la foto, y al segundo ya las tiene el compositor
      requestAnimationFrame(function () { requestAnimationFrame(entro); });
    }
    // 🌅 de a poco: nada aparece hasta que están las letras (si tardan, a los 0,7 s igual). Se piden a propósito:
    // `document.fonts.ready` contesta «listo» antes de que nadie las haya pedido
    if (quieto) el.classList.add('quieto');
    if ((src.indexOf('/3-cel.webp') > 0 || src.indexOf('/4-cel.webp') > 0) && innerWidth / Math.max(1, innerHeight) > 0.6) el.classList.add('entero');
    var va = function () { if (vaYa) return; vaYa = true; el.classList.add('va'); entrada(); };
    try {
      Promise.all([document.fonts.load('900 1em Archivo'), document.fonts.load('700 1em "Barlow Condensed"')]).then(va, va);
    } catch (e) { va(); }
    setTimeout(va, 700);
    // la foto, decodificada ANTES de mostrarla: decodificar 1920 px en el cuadro que entra es lo que tironea
    if (src) {
      var im = new Image();
      var mostrar = function () {
        if (fotoYa) return; fotoYa = true;
        el.querySelector('.lg-img').style.backgroundImage = 'url("' + src + '")';
        requestAnimationFrame(function () { el.classList.add('con-foto'); entrada(); });
      };
      var sinFoto = function () { if (fotoYa) return; fotoYa = true; entrada(); };
      im.onload = function () { if (!im.decode) mostrar(); };
      im.onerror = sinFoto;
      im.src = src;
      if (im.decode) im.decode().then(mostrar, function () { if (im.complete && im.naturalWidth) mostrar(); else sinFoto(); });
    }
    // 🎞️ LA BARRA Y EL NÚMERO, EN EL COMPOSITOR: los dos siguen la misma curva, de 0 a 92 % en 4 s la primera vez (en
    // 2,6 las demás); el resto, cuando la app está lista. El número es una tira de 0 % a 100 % que sube a saltos
    var barra = el.querySelector('.lg-barra i'), cifras = el.querySelector('.lg-cifras');
    var A = 0.92, K = 2.2, T = MIN || 2600, E = 1 - Math.exp(-K), LIN = 1.15, tA = performance.now(), anims = [];
    var avance = function (ms) { return A * (1 - Math.exp(-K * Math.min(ms, T) / T)) / E; };
    var cuando = function (y) { return -T / K * Math.log(1 - y * E / A); };
    var fila = function (q) { return { transform: 'translateY(-' + (q * LIN).toFixed(2) + 'em)', easing: 'steps(1, end)' }; };
    var tira = '';
    for (var q = 0; q <= 100; q++) tira += (q ? '<br>' : '') + q + '%';
    cifras.innerHTML = tira;
    try {
      var kb = [], kc = [];
      for (var i = 0; i <= 24; i++) kb.push({ offset: i / 24, transform: 'scaleX(' + avance(i / 24 * T).toFixed(4) + ')' });
      for (var q2 = 0; q2 <= 92; q2++) { var f = fila(q2); f.offset = Math.min(1, cuando(q2 / 100) / T); kc.push(f); }
      // ⚠️ el último, en 1 JUSTO: con 0,9999999 el navegador agrega uno en 1 con el valor de base, y al terminar la
      // subida el número volvía a «0 %» (pasó: lo mostró el video)
      kc[0].offset = 0; kc[kc.length - 1].offset = 1;
      anims = [barra.animate(kb, { duration: T, fill: 'forwards' }), cifras.animate(kc, { duration: T, fill: 'forwards' })];
    } catch (e) { anims = []; }
    // 📦 mientras tanto, las demás páginas: que después no haya esperas (no con ahorro de datos ni en 2G)
    function precargar() {
      try { var cx = navigator.connection; if (cx && (cx.saveData || /2g/.test(cx.effectiveType || ''))) return; } catch (e) {}
      (C.p || []).forEach(function (f) { var l = document.createElement('link'); l.rel = 'modulepreload'; l.href = '/inicio/' + f; document.head.appendChild(l); });
    }
    // 🧘 EL FINAL ARRANCA EN UN MOMENTO TRANQUILO. Con los datos, la app sigue armándose atrás: medido en un celular
    // modesto, tareas de 0,5 y 1 s después de `lg-listo`. Lo que se mueve lo anima el compositor, pero ARRANCARLO pide un
    // cuadro del hilo principal: si cae en medio de una de esas tareas, sale tarde y de golpe (y la barra se quedaba en
    // «100 % · Listo» dos segundos sin irse). Se espera a ver cuatro cuadros seguidos sin trabas, como mucho `tope` ms
    // (el setTimeout, por si la pestaña está atrás y no hay cuadros); mientras, la barra sigue en su 92 %
    function suelto(f, tope) {
      var hecho = false, prev = 0, seguidos = 0;
      var ir = function () { if (!hecho) { hecho = true; f(); } };
      setTimeout(ir, tope);
      requestAnimationFrame(function paso(ts) {
        if (hecho) return;
        seguidos = prev && ts - prev < 50 ? seguidos + 1 : 0;
        prev = ts;
        if (seguidos >= 4) ir(); else requestAnimationFrame(paso);
      });
    }
    // ✅ el final: la barra se completa (la primera vez, a los 4 s), «Listo», y el corte
    function terminar() {
      var dur = Math.max(quieto ? 150 : 400, MIN - (Date.now() - t0));
      var y = avance(performance.now() - tA), q0 = Math.min(99, Math.floor(y * 100)), kc = [];
      anims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
      for (var q = q0; q <= 100; q++) { var f = fila(q); f.offset = (q - q0) / (100 - q0); kc.push(f); }
      try {
        barra.animate([{ transform: 'scaleX(' + y.toFixed(4) + ')' }, { transform: 'scaleX(1)' }], { duration: dur, fill: 'forwards' });
        cifras.animate(kc, { duration: dur, fill: 'forwards' });
      } catch (e) { barra.style.transform = 'scaleX(1)'; cifras.style.transform = fila(100).transform; }
      setTimeout(function () {
        el.classList.add('lleno');
        setTimeout(function () {
          h.classList.add('lg-sale');
          setTimeout(function () { h.classList.add('lg-fuera'); }, quieto ? 300 : 1700);
        }, quieto ? 80 : 300);   // que se vea llena antes del corte
      }, dur);
    }
    var tic = setInterval(function () {
      if (h.classList.contains('sin-pagina')) { clearInterval(tic); return; }
      if (!h.classList.contains('lg-listo')) return;
      clearInterval(tic);
      precargar();
      // la primera vez, la barra se completa en los últimos 0,4 s de los 4: hasta ahí no hay nada que esperar
      setTimeout(function () { suelto(terminar, 1500); }, Math.max(0, MIN - 400 - (Date.now() - t0)));
    }, 100);
  } catch (e) { entro(); }
})();
</script>
""".replace('@TEMP@', temp).replace('@NUM@', temp.lstrip('T')).replace('@TIPS@', tips))


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

def script():
    raiz = ','.join('"%s":1' % n for n in EN_RAIZ)
    return ('''(function () {
  // ⚡ EL LOBBY, PEDIDO YA (10/11/2026): salía recién cuando corría nucleo.js, después de bajar y correr seis scripts
  // (llave_vivo.js solo son 96 KB). Acá sale apenas se lee la página, y nucleo.js usa ESTA promesa (`__lobbyP`) en vez
  // de pedirlo otra vez: el Response se lee una sola vez. Un `<link rel=preload>` no: si el navegador no lo reconoce como
  // el mismo pedido, baja el lobby (230 KB) dos veces
  try { window.__lobbyP = fetch('/api/lobby', { headers: { accept: 'application/json' } }); } catch (e) { window.__lobbyP = null; }
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
  // ⚠️ Lo que vuelve de Discord (`#access_token=…`) no se toca: lo lee cuenta.js antes de enrutar (`volverDeDiscord()`)
  function limpiar() {
    var h = location.hash || '';
    if (/^#(access_token|error)=/.test(h)) return;
    var u = urlLG(rutaLG()) + (/^#\\//.test(h) ? '' : h);
    if (u === location.pathname + location.search + h) return;
    try { history.replaceState(history.state, '', u); } catch (e) { /* queda como vino: rutaLG() la lee igual */ }
  }
  // 🛡️ EL PERMISO DE DISCORD SALE DE LA DIRECCIÓN YA (04/10/2026, la lista de seguridad de Dlx). Vuelve en el `#` y
  // quedaba en la barra —y en el historial— hasta que se bajaban los datos; si `/api/lobby` fallaba, no salía
  // nunca, y con ese permiso se vota y se gastan Puntos durante 7 días. Queda en memoria para `volverDeDiscord()`,
  // que decide adónde volver como siempre
  var hv = location.hash || '';
  if (/^#(access_token|error)=/.test(hv)) {
    window.__vueltaDC = hv;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* queda en la barra */ }
  }
  limpiar();
  // 🔑 UN AVISO POR CAMBIO DE DIRECCIÓN: `lg:dir`, que escuchan nucleo.js, la campana y la app. 🔴 No alcanza con
  // escuchar `popstate` y `hashchange`: un `location.hash = …` dispara LOS DOS (Chrome, primero popstate), y la página
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
  // 🔑 la página es siempre la nueva (desde la tanda 4, 27/10/2026): la clase la usan la pantalla de carga y la app
  var c = document.documentElement.classList;''' % (PREFIJO, raiz)) + '''
  c.add('ini-nuevo');
  try { var tm = localStorage.getItem('lg:tema'); if (tm && tm !== 'clara') c.add('ini-noche'); } catch (e) { /* sin guardar */ }
  // la última versión del changelog que se vio, ANTES de que nucleo.js la dé por vista (lo lee la app)
  try { window.__cambiosVisto = JSON.parse(localStorage.getItem('lg:cambios') || '""') || ''; } catch (e) { /* sin guardar */ }
  // «Instalar» (01/10/2026): Chrome avisa que la página se puede instalar una sola vez y puede ser antes de que el
  // Inicio monte. Se guarda acá y el Inicio pone su propio botón; sin esto, Chrome mostraba el suyo cuando quería
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); window.__instalar = e; window.dispatchEvent(new Event('lg:instalar'));
  });
  window.addEventListener('appinstalled', function () { window.__instalar = null; window.dispatchEvent(new Event('lg:instalar')); });
  // ⚠️ SIN PÁGINA, UN AVISO Y «REINTENTAR» (27/10/2026: el Inicio viejo, que era el respaldo, se fue con app.js). Lo
  // llaman el plan B de acá abajo, nucleo.js si `/api/lobby` no contesta y la app si se rompe entera (`Respaldo`)
  window.__sinPagina = function (por) {
    var p = document.getElementById('sin-pagina-por');
    if (p && por) p.textContent = por + ' Prueba de nuevo en un rato.';
    c.add('sin-pagina');
  };
  // si la app no llegó a montarse (un navegador viejo, o se rompió)
  function planB() {
    var el = document.getElementById('inicio-nuevo');
    if (!el || !el.shadowRoot) window.__sinPagina('La página no terminó de cargar.');
  }
  // ⚠️ LOS 8 SEGUNDOS CUENTAN DESDE QUE BAJÓ TODO (`load`), NO DESDE QUE SE ABRIÓ LA PÁGINA. Dlx, 15/10/2026: «a Juan
  // no le carga la página a veces, y a mí me pasa lo mismo». Medido con un celular modesto y 3G lento: la app termina
  // de bajar a los ~7 s y se arma a los 7,1; un poco peor y el plan B se adelantaba y la app, aunque llegara un
  // segundo después, no volvía. Si su archivo NO baja, va al toque
  if (document.readyState === 'complete') setTimeout(planB, 8000);
  else window.addEventListener('load', function () { setTimeout(planB, 8000); });
  window.addEventListener('error', function (e) {
    var t = e && e.target;
    if (t && t.tagName === 'SCRIPT' && /\\/inicio\\/inicio\\.js/.test(t.src || '')) planB();
  }, true);
})();'''


#: ⚠️ SIN DATOS NO HAY PÁGINA EN BLANCO: el aviso (lo enciende `__sinPagina()`, del script del principio). El texto «No
#: pude cargar los datos» es el que busca herramientas/web_en_borde.py
SIN_PAGINA = """<div id="sin-pagina" role="alert">
  <img src="/ul.png" alt="" width="72" height="72">
  <h1>No pude cargar los datos</h1>
  <p id="sin-pagina-por">La página no contestó. Prueba de nuevo en un rato.</p>
  <button type="button" id="sin-pagina-otra">Reintentar</button>
</div>
<script>document.getElementById('sin-pagina-otra').addEventListener('click', function () { location.reload(); });</script>
"""

#: la cañería que la app escucha, en este orden (cada uno usa lo de los anteriores al correr; nucleo.js arranca), y
#: después la app. `campana.js` va aparte: anota el dispositivo para los avisos
SCRIPTS = """<script src="llave_vivo.js"></script>
<script src="comun.js"></script>
<script src="cuenta.js"></script>
<script src="tienda.js"></script>
<script src="social.js"></script>
<script src="datos.js"></script>
<script src="nucleo.js"></script>
<script>
// 🚦 LA APP ARRANCA CUANDO LA PANTALLA DE CARGA YA ENTRÓ (13/11/2026, Dlx: «asegúrate que esto sea smooth»). Medido con
// un trace en un celular modesto: la app se arma en una sola tarea de 1,7 s, y arrancaba justo cuando la pantalla tenía
// que aparecer, así que ésta quedaba en negro ~3 s. Ahora el código se BAJA desde el <head> (modulepreload) pero CORRE
// cuando la pantalla avisa que entró (`__lgEntro`), o a los 1,6 s pase lo que pase. Va acá, después de la cañería: la
// app tiene que correr después de nucleo.js. Sin modulepreload (Safari < 17), arranca ya, como antes
(function () {
  var ya = false;
  window.__lgApp = function () {
    if (ya) return;
    ya = true;
    var s = document.createElement('script');
    s.type = 'module';
    s.src = '/inicio/inicio.js';
    document.body.appendChild(s);
  };
  var rl = document.createElement('link').relList;
  if (window.__lgEntro || !(rl && rl.supports && rl.supports('modulepreload'))) window.__lgApp();
  else setTimeout(window.__lgApp, 1600);
})();
</script>
<script src="campana.js" defer></script>
"""


#: 🎬 EL FONDO, DENTRO DE LA CAPA NEGRA y enderezado: la capa va girada 30° y corrida 5vmax, así que la foto lleva la
#: transformación inversa y queda derecha y a pantalla completa. Al salir, se va con la capa en el corte. La viñeta y el
#: grano son los de la bienvenida. El zoom de entrada va con `scale` (no `transform`, que ya endereza)
CSS_FOTO = """#lg-carga .lg-foto{display:none}
html.lg-carga-js #lg-carga .lg-foto{display:block;position:absolute;left:50%;top:50%;width:100vw;height:100vh;margin:-50vh 0 0 -50vw;
  transform:translateY(5vmax) rotate(-30deg);overflow:hidden;background:#030304}
#lg-carga .lg-img{position:absolute;inset:0;background:#030304 center/cover no-repeat;opacity:0;scale:1.04;will-change:opacity,scale;
  transition:opacity 1.4s cubic-bezier(.3,0,.2,1),scale 6s cubic-bezier(.2,.6,.2,1)}
#lg-carga.con-foto .lg-img{opacity:1;scale:1}
/* 📐 EN LA TABLET, EL 3D Y EL COMPETITIVO VAN ENTEROS (13/11/2026). Se arman para el celular (1080×2340) y una tablet
   parada (3:4) se come un 20 % de arriba y otro de abajo: las franjas y las tarjetas quedaban debajo del título y de la
   barra. Ahí la imagen va entera, del 2 al 90 % del alto (entera hasta abajo, la última franja del Competitivo caía en la
   barra), y los costados se funden en negro. Los afiches y las batallas se recortan bien y siguen a pantalla completa */
#lg-carga.entero .lg-img{top:2%;bottom:10%;left:50%;right:auto;width:auto;aspect-ratio:1080/2340;translate:-50% 0;
  -webkit-mask-image:linear-gradient(90deg,transparent,#000 14%,#000 86%,transparent);mask-image:linear-gradient(90deg,transparent,#000 14%,#000 86%,transparent)}
#lg-carga .lg-velo{position:absolute;inset:0;box-shadow:inset 0 0 200px 80px #030304;
  background:linear-gradient(180deg,rgba(3,3,4,.6) 0,rgba(3,3,4,0) 30%,rgba(3,3,4,0) 72%,rgba(3,3,4,.85) 94%,#030304)}
#lg-carga .lg-grano{position:absolute;left:-10%;top:-10%;width:120%;height:120%;opacity:0;mix-blend-mode:overlay;transition:opacity 1.2s ease 1s;
  animation:lg-grano .6s steps(5) 1.6s infinite}
#lg-carga.con-foto .lg-grano{opacity:.16}
@media (max-width:899.98px){#lg-carga .lg-velo{box-shadow:inset 0 0 70px 12px #030304}}"""


def cabeza(html):
    """El `<head>` de index.html hasta las fuentes: título, metas para Discord, manifiesto. Se conserva tal cual."""
    marca = '<link rel="preconnect" href="https://pub-70d5821d06a8432c9cffd0c102195000.r2.dev" crossorigin>\n'
    if html.count(marca) != 1:
        raise SystemExit('🔴 no encontré el preconnect de R2 una sola vez: es donde termina la cabeza que se conserva')
    return html[:html.index(marca) + len(marca)]


def pagina(html):
    return (cabeza(html) + cabeza_carga() +
            '<!-- 🛡️ SIN GOOGLE FONTS (04/10/2026, la lista de seguridad de Dlx): las fuentes salen de /inicio/inicio.css\n'
            '     (web/src/fuentes.css). La IP de cada visita dejó de ir a Google. Todo lo de abajo lo arma web/montar.py:\n'
            '     no se edita a mano -->\n'
            '<link rel="stylesheet" href="/inicio/inicio.css">\n'
            '<style id="ini-css">\n' + CSS + '\n' + CSS_FOTO + '\n</style>\n'
            '<script>\n' + script() + '\n</script>\n</head>\n' +
            html_carga() +
            '\n<!-- 🛠️ acá se monta la página (web/src/main.jsx) -->\n'
            '<div id="inicio-nuevo"></div>\n\n' +
            SIN_PAGINA + '\n' + SCRIPTS + '</body>\n</html>\n')


def rehacer_script(html):
    """`index.html` con el script del principio rehecho desde `script()`. `python web/montar.py --script`."""
    # ⚠️ el de la pantalla de carga también empieza con `(function () {`: se busca por su primer renglón
    ini = '<script>\n(function () {\n  // 🔑 LAS RUTAS DE VERDAD'
    m = re.search(re.escape(ini) + r'.*?\n\}\)\(\);\n</script>\n</head>', html, re.S)
    if not m or html.count(ini) != 1:
        raise SystemExit('🔴 no encontré el script del principio una sola vez')
    return html[:m.start()] + '<script>\n' + script() + '\n</script>\n</head>' + html[m.end():]


def main():
    idx = os.path.join(PAG, 'index.html')
    html = io.open(idx, encoding='utf-8').read()
    nuevo = rehacer_script(html) if '--script' in sys.argv else pagina(html)
    io.open(idx, 'w', encoding='utf-8', newline='\n').write(nuevo)
    print('✓ %s%s' % (os.path.relpath(idx, BASE), ': el script del principio' if '--script' in sys.argv else ''))


if __name__ == '__main__':
    main()
