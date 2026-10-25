/**
 * underlegends.pages.dev — el hub de la Liga Global.
 *
 * 🔴 LA PAGINA ES ESTATICA Y LOS DATOS VIENEN POR UNA SOLA RUTA. Ese
 * reparto es todo el diseño: Cloudflare Pages sirve estáticos **gratis e
 * ilimitados**, así que el HTML, el CSS, el JS y las imágenes no tocan
 * el presupuesto del Worker. Lo único que pasa por él es `/api/lobby`,
 * un json de ~13 KB que `bot/subir_web.py` deja masticado en KV una vez
 * por ciclo.
 *
 * ⚠️ POR ESO LA PAGINA PUEDE CRECER SIN COSTAR NADA. El límite que manda
 * en el proyecto son **10 ms de CPU por request** del Worker, y buscar,
 * filtrar, ordenar y mostrar cartas pasó a ser trabajo del navegador de
 * quien mira. Ordenar 200 filas ahí es gratis; hacerlo en el Worker sale
 * del presupuesto de todos.
 *
 * ⚠️ Y NO TIENE UNA COPIA DE NADA. Los datos salen de la misma clave que
 * lee el Worker del bot. Tener el payload en dos lados es la forma que
 * este repo ya documenta cinco veces —el rango en cinco sitios, el
 * fallback de `escudo()` escrito tres— y que siempre termina igual: uno
 * se queda viejo y nadie se entera porque los dos contestan 200.
 *
 * ⚠️ SOLO SE DEJA PASAR LA RUTA DE LECTURA, y eso no es paranoia: `/` del
 * Worker es el endpoint de interacciones de Discord. Si este proxy
 * reenviara cualquier cosa habría DOS URLs por las que llegan POST
 * firmados, y una de ellas sin que Discord lo sepa.
 *
 * 🔔 LA EXCEPCION SON LOS AVISOS DE EVENTOS (24/09/2026): cinco rutas
 * nombradas una por una —ver `AVISOS`— que el Worker atiende en
 * `/avisos/*` antes de mirar si algo es de Discord.
 *
 * ⚠️ UN PROYECTO DE PAGES NO SE RENOMBRA: el nombre ES el subdominio.
 * Éste nació como `liga-global` y pasó a `underlegends` creando el
 * proyecto nuevo. El viejo **no se borró**: quedaría un link muerto por
 * nada, así que sirve un 301 hacia acá (ver `bot/paginas_viejas/`).
 */
const ORIGEN = 'https://liga-global-bot.liga-global-ul.workers.dev';

// 🔔 LAS RUTAS DE LOS AVISOS, UNA POR UNA Y CON SU METODO. Son las únicas
// que pasan escritura, y la regla de arriba sigue en pie: ninguna de estas
// llega al `POST /` del Worker —las interacciones de Discord—, porque el
// Worker las atiende en `/avisos/*` antes de mirar nada más. Y se nombran
// enteras en vez de reenviar un prefijo: un prefijo deja pasar la ruta que
// alguien agregue mañana sin pensar en esto.
const AVISOS = {
  '/api/avisos/clave': 'GET',
  '/api/avisos/estado': 'GET',
  '/api/avisos/alta': 'POST',
  '/api/avisos/baja': 'POST',
  '/api/avisos/probar': 'POST',
  // sólo le llega a quien eligió el servidor de prueba: ver `SV_PRUEBA`
  '/api/avisos/simular': 'POST',
  // 🔑 los avisos de cada uno (25/09/2026): ver `vincular()` en bot/avisos.js
  '/api/avisos/vincular': 'POST',
  '/api/avisos/desvincular': 'POST',
  // 🔑 las llaves que se están jugando (27/09/2026): ver `llaves()` en bot/avisos.js
  '/api/avisos/vivo': 'GET',
  // 🔑 las encuestas (27/09/2026): cuántos votos lleva cada una, y votar. Ver
  // `validarVoto()` en bot/avisos.js: quién vota lo dice Discord, no la página
  '/api/avisos/encuestas': 'GET',
  '/api/avisos/votar': 'POST',
  // 🗳️ «¿quién gana la liga?» (14/10/2026): cuántos votos lleva cada uno, y votar. Ver `validarVotoLiga()` en
  // bot/avisos.js: quién vota lo dice la sesión; qué liga y entre quiénes, el ciclo
  '/api/avisos/ligas-votos': 'GET',
  '/api/avisos/liga-votar': 'POST',
  // un error en una llave (28/09/2026): con la sesión, como el voto
  '/api/avisos/reportar': 'POST',
  // 🏷️ tu «#N» en el apodo, servidor por servidor, desde tu perfil (21/10/2026): ver `numeralPagina()` en bot/worker.js
  '/api/avisos/numeral': 'POST',
  // 🔑 el precio por cabeza (28/09/2026): cuánto vale cada cabeza, poner un
  // precio y ver tu billetera. Ver `validarPrecio()` en bot/avisos.js
  '/api/avisos/precios': 'GET',
  '/api/avisos/precio': 'POST',
  '/api/avisos/billetera': 'POST',
  // 🔑 seguir raperos (28/09/2026): seguir, a quién seguís y cuántos siguen a
  // cada uno. Ver `seguir()` en bot/avisos.js: quién sigue lo dice Discord
  '/api/avisos/seguir': 'POST',
  '/api/avisos/sigo': 'POST',
  '/api/avisos/seguidores': 'GET',
  // 🔑 «tu servidor» (28/09/2026): elegirlo, y cuál eligió cada perfil.
  // Ver `miServidor()` en bot/avisos.js
  '/api/avisos/mi-servidor': 'POST',
  '/api/avisos/servidores': 'GET',
  // 👥 las crews (19/10/2026, bot/crews.js): todas, una acción, la tuya, y lo del dueño. Quién actúa lo dice Discord
  '/api/avisos/crews': 'GET',
  '/api/avisos/crew': 'POST',
  '/api/avisos/crew-mia': 'POST',
  '/api/avisos/dueno/crew': 'POST',
  // 🙈 «ocultar mi foto» (02/10/2026): en Mi cuenta → Privacidad. Ver `miFoto()` en bot/avisos.js
  '/api/avisos/mi-foto': 'POST',
  // 👏 felicitar un logro de Publicaciones, y cuántos lleva cada uno (02/10/2026). Ver `validarAplauso()` en
  // bot/avisos.js: quién felicita lo dice Discord; qué publicación, el muro
  '/api/avisos/felicitar': 'POST',
  // 📖 las historias que viste, en tu cuenta (18/10/2026)
  '/api/avisos/historias': 'POST',
  '/api/avisos/panel-socio': 'POST',
  '/api/avisos/socio-ajustes': 'POST',
  '/api/avisos/promo-vio': 'POST',
  '/api/avisos/promo-extender': 'POST',
  '/api/avisos/dueno-logs': 'POST',
  '/api/avisos/pedido': 'POST',
  '/api/avisos/liga-seguir': 'POST',
  '/api/avisos/mis-ligas': 'POST',
  '/api/avisos/mis-pedidos': 'POST',
  '/api/avisos/dueno-pedido': 'POST',
  '/api/avisos/aplausos': 'GET',
  // 🔔 el panel de la campana (02/10/2026): lo que se te avisó, con tu sesión. Ver `bandeja()` en bot/avisos.js
  '/api/avisos/bandeja': 'POST',
  // 🔥 la racha diaria y los niveles (04/10/2026): la tuya con tu sesión, y la de cada perfil. Ver `rachaDe()` y
  // `niveles()` en bot/avisos.js
  '/api/avisos/racha': 'POST',
  // 🎁 el premio de la semana (13/10/2026)
  '/api/avisos/semanal': 'POST',
  '/api/avisos/niveles': 'GET',
  // 🎟️ el Pase de rapero (05/10/2026): el tuyo y «miré una llave en vivo» con tu sesión, y el de cada perfil. Ver
  // `paseDe()`, `paseVivo()` y `pases()` en bot/avisos.js. ⚠️ `pase-ciclo` NO va acá: es sólo del ciclo, con su clave
  '/api/avisos/pase': 'POST',
  '/api/avisos/pase-vivo': 'POST',
  // 🎟️ (25/10/2026) tus avisos del Pase, tu color premium, el sorteo del premium y entrar a él
  '/api/avisos/pase-avisos': 'POST',
  '/api/avisos/pase-color': 'POST',
  '/api/avisos/sorteo': 'POST',
  '/api/avisos/sorteo-entrar': 'POST',
  // 🖼️ tus marcos de carta y elegir cuál llevar (25/10/2026)
  '/api/avisos/marcos': 'POST',
  '/api/avisos/marco-elige': 'POST',
  // 🏷️ tus TAGs y elegir cuál lleva cada carta (25/10/2026)
  '/api/avisos/tags-mios': 'POST',
  '/api/avisos/tag-elige': 'POST',
  '/api/avisos/pases': 'GET',
  // 📊 una visita sin cuenta, una vez por día y por navegador (04/10/2026): ver `visita()` en bot/avisos.js
  '/api/avisos/visita': 'POST',
  // 🧭 el tutorial (12/10/2026): qué vio un navegador, sin nada de nadie. Ver `tutorial()` en bot/avisos.js
  '/api/avisos/tutorial': 'POST',
  // 📊 qué secciones se abren (12/10/2026): una por navegador y por día. Ver `seccion()` en bot/avisos.js
  '/api/avisos/seccion': 'POST',
  // 👆 qué se toca en toda la página (16/10/2026), de a tandas. Ver `clics()` en bot/avisos.js
  '/api/avisos/clics': 'POST',
  // 🐞 un error de la página, para el Dashboard (19/10/2026, web/src/errores.js): nunca de quién
  '/api/avisos/error': 'POST',
  // 🔒 el Dashboard del dueño: el Worker comprueba que es Dlx (ver `/avisos/dueno` en bot/avisos.js)
  '/api/avisos/dueno': 'POST',
  // ⚙️ un ajuste del Dashboard (sólo Dlx)
  '/api/avisos/dueno/ajuste': 'POST',
  // ▶️ correr el ciclo ahora, desde el Dashboard (sólo Dlx)
  '/api/avisos/dueno/ciclo': 'POST',
  // 🎬 tus batallas en video (12/10/2026): pedir, ver y quitar las tuyas, reportar la de otro, y aprobar lo raro (sólo
  // Dlx). Ver `misVideos()` en bot/avisos.js. ⚠️ `videos-ciclo` y `videos-estados` NO van acá: son del ciclo
  '/api/avisos/mis-videos': 'POST',
  '/api/avisos/video-reportar': 'POST',
  '/api/avisos/dueno/video': 'POST',
  // 📣 qué hacer con un reporte de una llave (13/10/2026, sólo Dlx). ⚠️ `reportes-estados` NO va acá: es del ciclo
  '/api/avisos/dueno/reporte': 'POST',
  // 👀 quién está mirando qué caso de Pendientes (25/10/2026)
  '/api/avisos/dueno/viendo': 'POST',
  // 🔁 avisarle a alguien de la lista de primerizos que vuelva (25/10/2026). ⚠️ `primerizos-ciclo` NO va acá: es del ciclo
  '/api/avisos/dueno/vuelve': 'POST',
  // ✅ contestar ✅ Decidir desde el Dashboard (13/10/2026, sólo Dlx). ⚠️ `decidir-ciclo` y `decidir-estados` NO van acá
  '/api/avisos/dueno/decidir': 'POST',
  // 🏷️ los roles de cada perfil (cualquiera) y ponerlos (sólo Dlx), 13/10/2026. ⚠️ `roles-estados` NO va acá
  '/api/avisos/roles': 'GET',
  '/api/avisos/dueno/rol': 'POST',
  // 🖼️ tu fondo (13/10/2026): subirlo y verlo (con tu sesión), los aprobados (cualquiera) y revisarlos (sólo Dlx)
  '/api/avisos/fondo': 'POST', '/api/avisos/mi-fondo': 'POST', '/api/avisos/fondos': 'GET', '/api/avisos/dueno/fondo': 'POST',
  // 📸 tu foto de tarjeta (13/10/2026): subirla y verla (con tu sesión) y revisarla (quien puede)
  '/api/avisos/foto-carta': 'POST', '/api/avisos/mi-foto-carta': 'POST', '/api/avisos/dueno/foto-carta': 'POST',
  // 📣 seguir a un organizador (12/10/2026): con tu sesión. Ver `seguirOrg()` en bot/avisos.js
  '/api/avisos/seguir-org': 'POST',
};

// 🔑 «MI CUENTA»: el login y lo que se hace con ese permiso, nombradas una por
// una igual que los avisos. POST, JSON chico, nunca en caché.
//
// 🔴 EL 25/09/2026 NACIERON `/cuenta/redes` Y `/cuenta/foto` EN EL WORKER Y NO
// ACÁ, y lo mismo `vincular` en los avisos: la página recibía su propio HTML
// en vez de la respuesta y decía «No pude leer tus redes» (Dlx, con captura).
// Las pruebas llamaban al Worker directo y daban verde. Ahora
// `bot/probar_local.mjs` saca de app.js y campana.js cada `/api/…` que la
// página pide y prueba que este proxy lo deje pasar.
const CUENTA = {
  '/api/cuenta': '/cuenta',
  '/api/cuenta/redes': '/cuenta/redes',
  '/api/cuenta/foto': '/cuenta/foto',
  // 🔑 «Salir» cierra la sesión (28/09/2026)
  '/api/cuenta/salir': '/cuenta/salir',
  // 🔑 verificarse desde la página, entrando a DRA (01/10/2026)
  '/api/cuenta/verificar': '/cuenta/verificar',
  // 🔗 los roles vinculados de Discord (19/10/2026, `bot/paginas/vincular/`)
  '/api/cuenta/rol': '/cuenta/rol',
};

// 🔑 LA SESIÓN (28/09/2026): entrar con Discord una vez. La cookie `lg_ses`
// —HttpOnly: el JS de la página no la ve— viaja al Worker como `x-lg-ses`,
// y el `Set-Cookie` del Worker vuelve tal cual. Ver `sesionNueva()` en
// bot/avisos.js. Sólo en los POST: lo que se lee (GET) es público y se cachea.
// 🛡️ lo que va en toda respuesta de la API (04/10/2026): que el navegador no adivine otro tipo que el que dice. Las
// cabeceras de la página (los archivos) están en `_headers`
const SEGURO = { 'x-content-type-options': 'nosniff' };

function sesion(req) {
  const m = /(?:^|;\s*)lg_ses=([A-Za-z0-9_-]{30,100})/.exec(req.headers.get('cookie') || '');
  return m ? m[1] : '';
}

// 📊 LA VISITA, UNA VEZ CADA 6 HORAS POR IP (revisión del 05/10/2026). Es lo único que cualquiera escribe sin entrar:
// sin tope, un script empujaba el contador y gastaba filas del objeto (techo: 100.000 escritas por día). Acá y no en el
// Worker porque el Worker ve la IP de este proxy, no la de quien visita. En la memoria de cada instancia: no es un
// candado, es un freno —la página ya avisa una vez por día y por navegador—
const VISITAS = new Map();
function visitaRepetida(req, que) {
  const ip = req.headers.get('cf-connecting-ip') || '';
  if (!ip) return false;
  const k = que ? ip + '|' + que : ip;
  const ahora = Date.now();
  if (VISITAS.size > 20000) VISITAS.clear();
  if (ahora - (VISITAS.get(k) || 0) < 6 * 3600000) return true;
  VISITAS.set(k, ahora);
  return false;
}

async function avisos(req, url) {
  const metodo = AVISOS[url.pathname];
  if (req.method !== metodo) return new Response('no', { status: 405 });
  // 🧭 lo del tutorial, con el mismo freno que la visita pero por cosa: el navegador ya cuenta cada una una sola vez.
  // 📊 Y las secciones (12/10/2026), igual: el nombre de la sección es la «cosa»
  const secc = url.pathname === '/api/avisos/seccion';
  if (url.pathname === '/api/avisos/tutorial' || secc) {
    const crudo = await req.text();
    let ev = '';
    try { ev = crudo.length <= 200 ? String((JSON.parse(crudo) || {}).ev || '').slice(0, 20) : ''; } catch (e) { ev = ''; }
    // lo que no es de la lista lo rechaza el Worker (`TUTO_EV`); acá sólo se frena lo repetido
    if (ev && visitaRepetida(req, (secc ? 's:' : '') + ev)) {
      return new Response('{"ok":true}', { headers: { 'content-type': 'application/json; charset=utf-8', ...SEGURO,
        'cache-control': 'no-store' } });
    }
    const r = await fetch(ORIGEN + (secc ? '/avisos/seccion' : '/avisos/tutorial'), { method: 'POST', headers: { 'content-type': 'application/json',
      accept: 'application/json', 'x-lg-ip': ipDe(req) }, body: JSON.stringify({ ev }) });
    return new Response(r.body, { status: r.status, headers: { 'content-type': 'application/json; charset=utf-8', ...SEGURO,
      'cache-control': 'no-store' } });
  }
  if (url.pathname === '/api/avisos/visita' && visitaRepetida(req)) {
    return new Response('{"ok":true}', { headers: { 'content-type': 'application/json; charset=utf-8', ...SEGURO,
      'cache-control': 'no-store' } });
  }
  const init = { method: metodo, headers: { accept: 'application/json', 'x-lg-ip': ipDe(req) } };
  if (metodo === 'POST') {
    const cuerpo = await req.text();
    // 🖼️ una imagen de fondo es más que 4 KB: sólo esa ruta, y con su propio tope (el Worker lo vuelve a medir). Y el
    // logo de una crew (19/10/2026): viaja en el mismo pedido que la crea
    const grande = url.pathname === '/api/avisos/fondo' || url.pathname === '/api/avisos/foto-carta' || url.pathname === '/api/avisos/crew';
    if (cuerpo.length > (grande ? 900000 : 4096)) return new Response('demasiado grande', { status: 413 });
    init.body = cuerpo;
    init.headers['content-type'] = 'application/json';
    if (sesion(req)) init.headers['x-lg-ses'] = sesion(req);
  } else if (url.pathname.endsWith('/clave')) {
    // la clave pública no cambia: una hora en el borde
    init.cf = { cacheTtl: 3600, cacheEverything: true };
  } else if (url.pathname.endsWith('/vivo') || url.pathname.endsWith('/encuestas') || url.pathname.endsWith('/ligas-votos') ||
             url.pathname.endsWith('/precios') || url.pathname.endsWith('/aplausos') ||
             url.pathname.endsWith('/estado')) {
    // ⚡ `/estado` también (revisión del 04/10/2026): la campana lo pide en cada visita, es público —cuántos,
    // cuándo, nunca quién— y cada pedido eran once lecturas de tablas enteras en el objeto que vigila
    // ⚠️ 30 s EN EL BORDE: la página pregunta cada minuto y el vigía escribe
    // cada minuto; con esto, mucha gente mirando son pocos pedidos al Worker.
    // Los votos, igual: quien vota recibe su cuenta en la respuesta del voto
    init.cf = { cacheTtl: 30, cacheEverything: true };
  } else if (url.pathname.endsWith('/seguidores') || url.pathname.endsWith('/servidores')) {
    // cuántos siguen a cada uno: se mira al abrir un perfil, y un minuto
    // de atraso no le cambia nada a nadie
    init.cf = { cacheTtl: 60, cacheEverything: true };
  } else if (url.pathname.endsWith('/pases') || url.pathname.endsWith('/niveles') || url.pathname.endsWith('/avisos/roles')
    || url.pathname.endsWith('/avisos/fondos')) {
    // 🎟️ el nivel del Pase y el de la racha de cada perfil (revisión del 05/10/2026): los pide CADA Inicio y CADA
    // perfil, y en el objeto son tablas enteras —el Pase, una persona por persona—. Con la Liga creciendo eran
    // millones de filas leídas por día (techo: 5 millones). Cinco minutos en el borde: un nivel nuevo se ve un rato
    // después, y el de cada uno, en su Pase, al instante (eso va con su sesión, no por acá)
    init.cf = { cacheTtl: 300, cacheEverything: true };
  }
  const r = await fetch(ORIGEN + url.pathname.slice('/api'.length), init);
  return new Response(r.body, {
    status: r.status,
    headers: {
      'content-type': 'application/json; charset=utf-8', ...SEGURO,
      'cache-control': metodo === 'GET' ? 'public, max-age=20' : 'no-store',
    },
  });
}

// 🛡️ UN FRENO POR IP (Dlx, 14/10/2026: «Las dos», a «contra un DDoS que agote la cuota gratis»: este freno y, cuando
// haya, un dominio propio con la regla de Cloudflare). Medido ese día desde afuera: 60 pedidos seguidos a la API pasaban
// todos. ⚠️ LO QUE ARREGLA Y LO QUE NO: en el plan gratis un pedido que llega acá ya cuenta para los 100.000 del día
// aunque se lo rechace; lo que este freno corta es lo de atrás —el Worker, el objeto y KV—, así que una IP que inunda
// gasta la mitad y no toca los datos. Lo que frena ANTES de contar es la regla de Cloudflare de un dominio propio.
// ⚠️ Es por isolate (la memoria de esta copia del código en ese datacenter), no global: frena a una IP que manda
// muchísimos, no a un ataque desde miles de IPs (eso lo frena Cloudflare). El techo deja de sobra a una página normal
// (unos 10 pedidos al abrirla) y a muchos detrás de la misma IP (una escuela, un celular con CGNAT)
/** La IP para contar: IPv4 entera; IPv6 por su bloque /64, que es lo que tiene una casa o un celular (adentro de él
 * se cambia de dirección gratis, y contarlas sueltas dejaría pasar a quien las rota) */
const bloqueIP = (ip) => {
  const x = String(ip || '');
  if (x.indexOf(':') < 0) return x;
  const p = x.split(':');
  return p.slice(0, 4).join(':') + '::/64';
};
const LIMITE_IP = { max: 300, ventana: 60000, tope: 5000 };
const POR_IP = new Map();
/** ¿Esa IP ya pasó su techo en este minuto? Cuenta este pedido */
function demasiados(ip, ahora = Date.now()) {
  if (!ip) return false;
  let x = POR_IP.get(ip);
  if (!x || ahora - x.t0 >= LIMITE_IP.ventana) {
    x = { t0: ahora, n: 0 };
    POR_IP.set(ip, x);
    // la memoria se poda: un isolate vive horas
    if (POR_IP.size > LIMITE_IP.tope) {
      for (const [k, v] of POR_IP) if (ahora - v.t0 >= LIMITE_IP.ventana) POR_IP.delete(k);
      if (POR_IP.size > LIMITE_IP.tope) POR_IP.clear();
    }
  }
  x.n++;
  if (x.n === LIMITE_IP.max + 1) console.warn('[seguridad] freno por IP: más de ' + LIMITE_IP.max + ' pedidos en un minuto');
  return x.n > LIMITE_IP.max;
}
// 🛡️ la IP de quien mira, para el Worker (`x-lg-ip`): un subpedido le llega con la IP de Cloudflare, y sin esto su freno
// contaría a toda la página como una sola persona. Va en lo que no se cachea (lo que sí, casi no le llega)
const ipDe = (req) => req.headers.get('cf-connecting-ip') || '';
const muchos = () => new Response('{"error":"demasiados"}', { status: 429,
  headers: { 'content-type': 'application/json; charset=utf-8', 'retry-after': '60', 'cache-control': 'no-store',
    'x-content-type-options': 'nosniff' } });

// 🔗 LA VISTA PREVIA DE CADA PERFIL (Dlx, 13/10/2026: «quizás que el link de cada perfil tenga un fondo diferente? no sé
// qué tanto ocupe eso»). Al pegar `/freestyle-rap/r/<clave>` en Discord, WhatsApp o X, la vista previa trae su nombre,
// sus números y SU TARJETA de imagen, en vez del cartel de la Liga. ⚠️ SÓLO PARA LOS BOTS que arman la vista previa: a la
// gente le llega el index.html de siempre, sin pedir nada más. Ocupa poco: dos lecturas cacheadas (el lobby, y los
// perfiles sólo si no está entre los 200 de la tabla) por cada link pegado
const BOTS_VISTA = /discordbot|twitterbot|facebookexternalhit|facebot|whatsapp|telegrambot|slackbot|linkedinbot|embedly|skypeuripreview|redditbot|pinterest|vkshare|iframely|mastodon|bluesky|cardyb|googlebot|bingbot|applebot/i;
const R2_CARTAS = 'https://pub-70d5821d06a8432c9cffd0c102195000.r2.dev';
const ORDEN_CARTA = ['temporada', 'servidor', 'competitivo', 'pais'];
const banderaDe = (cc) => (/^[a-z]{2}$/i.test(String(cc || ''))
  ? String.fromCodePoint(...[...String(cc).toUpperCase()].map((c) => 0x1F1E6 + c.charCodeAt(0) - 65)) : '');

/** La fila de alguien para su vista previa: `{f, temp, cartas}` (la tabla del lobby, o su perfil si no entra), o `null` */
async function fichaVista(k) {
  const pedir = async (ruta) => {
    const r = await fetch(ORIGEN + ruta, { headers: { accept: 'application/json' }, cf: { cacheTtl: 300, cacheEverything: true } });
    return r.ok ? r.json() : null;
  };
  const L = await pedir('/lobby?json=1').catch(() => null);
  let f = L && (L.tabla || []).find((x) => x && x.k === k);
  if (!f) {
    const P = await pedir('/perfiles').catch(() => null);
    f = P && P.p && P.p[k] && P.p[k].f;
  }
  return f ? { f, temp: String((L && L.temporada) || 'T1').toUpperCase(), cartas: (L && L.cartas) || [] } : null;
}

/** Lo que dice la vista previa de alguien: `{titulo, desc, img, alt}`. Sin `img` queda el cartel de la Liga */
function textoVista(f, k, temp, cartas) {
  const nombre = String(f.n || k).trim();
  const titulo = nombre + (f.cc && !/[\u{1F1E6}-\u{1F1FF}]/u.test(nombre) ? ' ' + banderaDe(f.cc) : '') + ' · Liga Global de Freestyle';
  const partes = f.solo ? ['En la Liga Global por su rol'] : [f.pos ? '#' + f.pos + ' de la ' + temp : '', f.ovr ? 'OVR ' + f.ovr : '',
    // ⚠️ sin el servidor: se muestra sólo si lo eligió (Dlx, 12/10/2026), y eso no viaja en la fila
    f.rg ? 'Rango ' + f.rg : '', f.ev ? f.ev + (f.ev === 1 ? ' evento' : ' eventos') : ''].filter(Boolean);
  const desc = (partes.length ? partes.join(' · ') + '. ' : '') + 'Su perfil, sus tarjetas y sus batallas en la Liga Global de Freestyle.';
  const carta = ORDEN_CARTA.find((c) => (f.c || []).includes(c));
  let img = '';
  if (carta) {
    const i = (cartas || []).indexOf(carta);
    const v = typeof f.cv === 'string' && i >= 0 ? f.cv.split('.')[i] : '';
    img = R2_CARTAS + '/' + encodeURIComponent(k) + '/' + carta + '.webp' + (v ? '?v=' + v : '');
  }
  return { titulo, desc, img, alt: 'La tarjeta de ' + nombre };
}

/** El index.html con la vista previa de esa persona; `null` si no se sabe quién es (queda la de la Liga) */
async function vistaPerfil(req, env, k, url) {
  const x = await fichaVista(k).catch(() => null);
  if (!x) return null;
  const { titulo, desc, img, alt } = textoVista(x.f, k, x.temp, x.cartas);
  const pag = await env.ASSETS.fetch(new Request(url.origin + '/', { headers: req.headers }));
  const poner = (atr, valor) => ({ element(el) { el.setAttribute(atr, valor); } });
  const sacar = { element(el) { el.remove(); } };
  let rw = new HTMLRewriter()
    .on('title', { element(el) { el.setInnerContent(titulo); } })
    .on('meta[property="og:title"]', poner('content', titulo))
    .on('meta[property="og:description"]', poner('content', desc))
    .on('meta[name="description"]', poner('content', desc))
    .on('meta[property="og:type"]', poner('content', 'profile'))
    .on('meta[property="og:url"]', poner('content', url.origin + url.pathname));
  if (img) {
    // la tarjeta es vertical: sin las medidas del cartel (1200×630), que la deformarían
    rw = rw.on('meta[property="og:image"]', poner('content', img))
      .on('meta[name="twitter:image"]', poner('content', img))
      .on('meta[property="og:image:width"]', sacar)
      .on('meta[property="og:image:height"]', sacar)
      .on('meta[property="og:image:alt"]', poner('content', alt));
  }
  const r = rw.transform(pag);
  const h = new Headers(r.headers);
  h.set('cache-control', 'public, max-age=300');
  return new Response(r.body, { status: 200, headers: h });
}

// 🏟️ Y LA DE CADA SERVIDOR (Dlx, 14/10/2026, con FRZ: «asegurate que FRZ tenga su link propio… o sea con su thumbnail
// personalizado»). `/freestyle-rap/sv/<SIGLA>` es la página de cada servidor, y pegada en Discord salía con el cartel de
// la Liga. La imagen ya existía —la de cada servidor, con su logo y su color (`/og/<sv>.png`, de
// `herramientas/banner_link.py`)—, sólo faltaba que su página la dijera. Igual que el perfil: sólo para los bots, con el
// lobby cacheado. Sin ese servidor en el lobby queda la de la Liga
async function vistaServidor(req, env, x, url) {
  const r = await fetch(ORIGEN + '/lobby?json=1', { headers: { accept: 'application/json' }, cf: { cacheTtl: 300, cacheEverything: true } })
    .catch(() => null);
  const L = r && r.ok ? await r.json().catch(() => null) : null;
  const X = String(x || '').toUpperCase();
  const s = L && (L.svs || []).find((y) => y && (y.sv === X || String(y.sigla || '').toUpperCase() === X));
  if (!s || !/^[A-Z]{2,5}$/.test(String(s.sv || ''))) return null;
  const nombre = String(s.nombre || s.sv).trim();
  const titulo = nombre + ' en la Liga Global de Freestyle';
  const desc = (s.tag ? String(s.tag).charAt(0) + String(s.tag).slice(1).toLowerCase() + '. ' : '')
    + 'Sus eventos, su gente y sus tarjetas, en el ranking mundial del freestyle online.';
  const img = url.origin + '/og/' + s.sv.toLowerCase() + '.png';
  const pag = await env.ASSETS.fetch(new Request(url.origin + '/', { headers: req.headers }));
  const poner = (atr, valor) => ({ element(el) { el.setAttribute(atr, valor); } });
  const rw = new HTMLRewriter()
    .on('title', { element(el) { el.setInnerContent(nombre + ' · Liga Global de Freestyle'); } })
    .on('meta[property="og:title"]', poner('content', titulo))
    .on('meta[property="og:description"]', poner('content', desc))
    .on('meta[name="description"]', poner('content', desc))
    .on('meta[property="og:url"]', poner('content', url.origin + url.pathname))
    .on('meta[property="og:image"]', poner('content', img))
    .on('meta[name="twitter:image"]', poner('content', img))
    .on('meta[property="og:image:alt"]', poner('content', titulo))
    // la barrita de color de Discord, la del servidor
    .on('meta[name="theme-color"]', poner('content', /^#[0-9a-f]{6}$/i.test(String(s.color || '')) ? s.color : '#29B298'));
  const out = rw.transform(pag);
  const h = new Headers(out.headers);
  h.set('cache-control', 'public, max-age=300');
  return new Response(out.body, { status: 200, headers: h });
}

// 🖼️ LA VISTA PREVIA DE CADA PÁGINA (Dlx, 19/10/2026, con el link de /crews pegado en Discord y el cartel de la Liga
// abajo: «quiero que cada página como la de crews tenga su propio thumbnail»). Las once del menú, cada una con su
// imagen (`/og/p/<pagina>.png`, de herramientas/banner_paginas.py: la misma piel, otra ilustración), su título y su
// bajada. Igual que el perfil y el servidor: sólo para los bots de vista previa; la persona recibe el index.html de
// siempre. ⚠️ El título y la bajada van acá y en banner_paginas.py: si se cambia uno, se cambia el otro
const PAGINAS = {
  ranking: ['Ranking', 'Los mejores del freestyle online, de todos los servidores, en una sola tabla.'],
  crews: ['Crews', 'Arma la tuya, invita a tu gente y subí de tier cada semana.'],
  eventos: ['Eventos', 'Qué se juega hoy en cada servidor, con la llave en vivo y la campana.'],
  tarjetas: ['Tarjetas', 'Temporada, Competitiva, Servidor y País: tus números, en una carta.'],
  pase: ['Pase rapero', 'Tareas diarias y semanales, XP y niveles: subí y desbloquea.'],
  ligas: ['Ligas', 'Fechas, tablas y campeones de las ligas de los servidores socios.'],
  tienda: ['Tienda', 'Caza cabezas, apuesta en vivo y gasta tus Puntos de Tienda.'],
  publicaciones: ['Publicaciones', 'Campeones, rachas y crews que suben: el muro de todos los servidores.'],
  socios: ['Socios', 'Los servidores de rap online que suman al ranking mundial.'],
  guia: ['Guía', 'Puntos, rangos, tarjetas y TAGs, explicados en una página.'],
  salon: ['Salón de la fama', 'Los MES AWARDS, las promos y los que hicieron historia.'],
  // y las que no están en el menú pero se comparten (Dlx, 19/10/2026: «¿estás seguro que ésos son todos?»)
  cuenta: ['Tu cuenta', 'Entra con Discord: tus tarjetas, tu Pase, tus Puntos y tus avisos, en un lugar.'],
  cambios: ['Lo nuevo', 'Cada cambio de la página y del bot, con su versión y su hora.'],
  socio: ['El panel de tu servidor', 'Tu puntaje, cuándo hay actividad, tus raperos y los ajustes del bot, para los dueños.'],
};
// los nombres viejos de algunas páginas, que siguen abriendo lo mismo: la misma vista previa
const ALIAS = { avisos: 'eventos', mundo: 'socios', duelos: 'ranking' };
// `/cuenta` y `/cambios` son de toda la marca y viven en la raíz (`EN_RAIZ` de web/montar.py); el resto, en /freestyle-rap
const RUTA_PAGINA = new RegExp('^/(?:freestyle-rap/)?(' + Object.keys(PAGINAS).concat(Object.keys(ALIAS), ['llave', 'pais']).join('|') + ')(?:/|$)');
const R2_CREWS = /^https:\/\/pub-[a-z0-9]+\.r2\.dev\/crews\/[\w.-]+$/;

/** Un json del Worker del bot, cacheado 5 min (el lobby, las llaves viejas); `null` si no contestó */
async function pedirJson(ruta) {
  const r = await fetch(ORIGEN + ruta, { headers: { accept: 'application/json' }, cf: { cacheTtl: 300, cacheEverything: true } }).catch(() => null);
  return r && r.ok ? r.json().catch(() => null) : null;
}

/** La imagen de un servidor (`/og/<sv>.png`, de banner_link.py: hay una por servidor con logo), o la de esa página */
function imagenSv(L, sv, url, pagina) {
  const s = L && (L.svs || []).find((y) => y && y.sv === sv);
  return s && s.logo && /^[A-Z]{2,5}$/.test(String(sv)) ? url.origin + '/og/' + String(sv).toLowerCase() + '.png' : url.origin + '/og/p/' + pagina + '.png';
}

// 🏟️ LA DE CADA LIGA (`/freestyle-rap/ligas/<id>`): su nombre, de qué servidor es y cuántas batallas lleva, con la imagen
// de ese servidor. La Superliga y la Clausura no son de un servidor: van con la de Ligas
async function vistaLiga(req, env, id, url) {
  const fijas = { superliga: ['Superliga', 'El cierre de la temporada: el top 16 del Competitivo, en una liga de 10.'],
    clausura: ['Clausura', 'El cierre del ranking de Temporada: el top 16, en octavos.'] };
  if (fijas[id]) {
    return conVista(req, env, url, { tab: fijas[id][0] + ' · Liga Global de Freestyle', titulo: fijas[id][0] + ' · Liga Global de Freestyle',
      desc: fijas[id][1], img: url.origin + '/og/p/ligas.png', alt: fijas[id][0] });
  }
  const L = await pedirJson('/lobby?json=1');
  // 🏟️ las ligas ya no viajan en el lobby (25/10/2026): van en `/ligas`, con lo del Inicio en `lobby`. El lobby viejo,
  // mientras el ciclo no haya subido uno nuevo, todavía las trae
  const LG = L && L.ligas ? null : await pedirJson('/ligas');
  const x = L && (((L.ligas || (LG && LG.lobby)) || {}).ligas || []).find((l) => l && l.id === id);
  if (!x || !x.n) return null;
  const s = (L.svs || []).find((y) => y && y.sv === x.sv);
  const nombre = String(x.n).trim();
  const desc = 'La liga de ' + (s ? s.nombre : x.sv) + (x.bat ? ' · ' + x.bat + ' batallas' : '') + '. Sus fechas, su tabla y sus campeones, en la Liga Global de Freestyle.';
  return conVista(req, env, url, { tab: nombre + ' · Liga Global de Freestyle', titulo: nombre + ' · Liga Global de Freestyle', desc,
    img: imagenSv(L, x.sv, url, 'ligas'), alt: nombre, color: s && /^#[0-9a-f]{6}$/i.test(String(s.color || '')) ? s.color : '' });
}

// 🏆 LA DE CADA LLAVE (`/freestyle-rap/llave/<n>`): el nombre del evento, su servidor, la fecha, cuántos jugaron y el
// campeón, con la imagen del servidor. Las del lobby primero; las viejas, de `/llaves`. Las en vivo (`v:…`) no: cambian
async function vistaLlave(req, env, n, url) {
  if (!/^\d{1,6}$/.test(n)) return null;
  const L = await pedirJson('/lobby?json=1');
  let x = L && (L.llaves || {})[n];
  if (!x) { const T = await pedirJson('/llaves'); x = T && T[n]; }
  if (!x || !x.nombre) return null;
  const s = L && (L.svs || []).find((y) => y && y.sv === x.sv);
  const camp = (x.tabla || []).filter((f) => Array.isArray(f) && f[1] === 'Campeón').map((f) => String(f[0]).trim()).slice(0, 2);
  const nombre = String(x.nombre).trim();
  const desc = [x.fecha ? String(x.fecha) : '', s ? s.nombre : String(x.sv || ''), x.participantes ? x.participantes + ' participantes' : '',
    camp.length ? 'Campeón: ' + camp.join(' y ') : ''].filter(Boolean).join(' · ') + '. La llave completa, batalla por batalla.';
  return conVista(req, env, url, { tab: nombre + ' · Liga Global de Freestyle', titulo: nombre + (x.sv ? ' · ' + x.sv : '') + ' · Liga Global',
    desc, img: imagenSv(L, x.sv, url, 'eventos'), alt: 'La llave de ' + nombre,
    color: s && /^#[0-9a-f]{6}$/i.test(String(s.color || '')) ? s.color : '' });
}

// 🌎 LA DE CADA PAÍS (`/freestyle-rap/pais/<cc>`): su nombre y cuántos raperos tiene, con su bandera (`/og/pais/<cc>.png`,
// de banner_paginas.py --paises). El nombre sale de `og/pais/nombres.json`, que el mismo script deja desde web/src/liga.js
async function vistaPais(req, env, cc, url) {
  cc = String(cc || '').toLowerCase();
  if (!/^[a-z]{2}$/.test(cc)) return null;
  const r = await env.ASSETS.fetch(new Request(url.origin + '/og/pais/nombres.json')).catch(() => null);
  const nombres = r && r.ok ? await r.json().catch(() => null) : null;
  if (!nombres || !nombres[cc]) return null;
  const L = await pedirJson('/lobby?json=1');
  const p = L && (L.paises || []).find((y) => y && String(y.cc).toLowerCase() === cc);
  const nombre = String(nombres[cc]);
  const desc = (p && p.n ? p.n + (p.n === 1 ? ' rapero' : ' raperos') + ' en la Liga Global. ' : '')
    + 'Su ranking, su OVR Nacional y sus tarjetas de País en el freestyle online.';
  return conVista(req, env, url, { tab: nombre + ' · Liga Global de Freestyle', titulo: nombre + ' en la Liga Global de Freestyle', desc,
    img: url.origin + '/og/pais/' + cc + '.png', alt: 'La bandera de ' + nombre });
}

/** El index.html con otra vista previa: `{tab, titulo, desc, img, alt, color?}` sobre la página de siempre */
async function conVista(req, env, url, v) {
  const pag = await env.ASSETS.fetch(new Request(url.origin + '/', { headers: req.headers }));
  const poner = (atr, valor) => ({ element(el) { el.setAttribute(atr, valor); } });
  const rw = new HTMLRewriter()
    .on('title', { element(el) { el.setInnerContent(v.tab); } })
    .on('meta[property="og:title"]', poner('content', v.titulo))
    .on('meta[property="og:description"]', poner('content', v.desc))
    .on('meta[name="description"]', poner('content', v.desc))
    .on('meta[property="og:url"]', poner('content', url.origin + url.pathname))
    .on('meta[property="og:image"]', poner('content', v.img))
    .on('meta[name="twitter:image"]', poner('content', v.img))
    .on('meta[property="og:image:alt"]', poner('content', v.alt || v.titulo))
    .on('meta[name="theme-color"]', poner('content', v.color || '#E41373'));
  const out = rw.transform(pag);
  const h = new Headers(out.headers);
  h.set('cache-control', 'public, max-age=300');
  return new Response(out.body, { status: 200, headers: h });
}

function vistaPagina(req, env, pagina, url) {
  const [nombre, desc] = PAGINAS[pagina];
  return conVista(req, env, url, { tab: nombre + ' · Liga Global de Freestyle', titulo: nombre + ' · Liga Global de Freestyle', desc,
    img: url.origin + '/og/p/' + pagina + '.png', alt: nombre + ' en la Liga Global de Freestyle' });
}

// 👥 Y LA DE CADA CREW: su nombre, su descripción, cuántos son y su logo (`/avisos/crews` es público y se cachea 5 min).
// Sin logo, o si la crew no existe, la imagen de la página de crews
async function vistaCrew(req, env, id, url) {
  const r = await fetch(ORIGEN + '/avisos/crews', { headers: { accept: 'application/json' }, cf: { cacheTtl: 300, cacheEverything: true } })
    .catch(() => null);
  const j = r && r.ok ? await r.json().catch(() => null) : null;
  const c = j && (j.crews || []).find((x) => x && x.id === id);
  if (!c) return null;
  const nombre = String(c.nombre || id).trim();
  const n = (c.gente || []).length;
  const desc = (c.desc ? String(c.desc).trim().slice(0, 160) + ' · ' : '') + n + (n === 1 ? ' integrante' : ' integrantes')
    + (c.sigla ? ' · ' + String(c.sigla).toUpperCase() : '') + ' · una crew de la Liga Global de Freestyle.';
  const img = R2_CREWS.test(String(c.logo || '')) ? String(c.logo) : url.origin + '/og/p/crews.png';
  return conVista(req, env, url, { tab: nombre + ' · Liga Global de Freestyle', titulo: nombre + ' · crew de la Liga Global', desc, img,
    alt: 'El logo de ' + nombre });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const ua = req.headers.get('user-agent') || '';

    // 🖼️ la vista previa de cada página, sólo para los bots: una liga, una llave o un país tienen la suya; las demás, la de
    // su página (ver `vistaPagina()` y las tres de arriba)
    const mPag = req.method === 'GET' && BOTS_VISTA.test(ua) && RUTA_PAGINA.exec(url.pathname);
    if (mPag) {
      const pagina = ALIAS[mPag[1]] || mPag[1];
      const resto = url.pathname.slice(mPag[0].length).replace(/\/$/, '');
      let id = resto;
      try { id = decodeURIComponent(resto); } catch (e) { /* tal cual */ }
      let v = null;
      if (id && pagina === 'ligas') v = await vistaLiga(req, env, id, url).catch(() => null);
      else if (id && mPag[1] === 'llave') v = await vistaLlave(req, env, id, url).catch(() => null);
      else if (id && mPag[1] === 'pais') v = await vistaPais(req, env, id, url).catch(() => null);
      if (!v && PAGINAS[pagina]) v = await vistaPagina(req, env, pagina, url).catch(() => null);
      if (v) return v;
    }
    // 👥 y la de cada crew (ver `vistaCrew()`)
    const mCrew = req.method === 'GET' && /^\/freestyle-rap\/crew\/([^/?#]{1,60})\/?$/.exec(url.pathname);
    if (mCrew && BOTS_VISTA.test(ua)) {
      let id = mCrew[1];
      try { id = decodeURIComponent(id); } catch (e) { /* tal cual */ }
      const v = await vistaCrew(req, env, id, url).catch(() => null);
      if (v) return v;
    }

    // 🏟️ la vista previa de cada servidor, sólo para los bots (ver `vistaServidor()`)
    const mSv = req.method === 'GET' && /^\/freestyle-rap\/sv\/([A-Za-z]{2,5})\/?$/.exec(url.pathname);
    if (mSv && BOTS_VISTA.test(req.headers.get('user-agent') || '')) {
      const v = await vistaServidor(req, env, mSv[1], url).catch(() => null);
      if (v) return v;
    }

    // 🔗 la vista previa de cada perfil, sólo para los bots (ver `vistaPerfil()`)
    const mPerfil = req.method === 'GET' && /^\/freestyle-rap\/r\/([^/?#]{1,80})\/?$/.exec(url.pathname);
    if (mPerfil && BOTS_VISTA.test(req.headers.get('user-agent') || '')) {
      let k = mPerfil[1];
      try { k = decodeURIComponent(k); } catch (e) { /* tal cual */ }
      const v = await vistaPerfil(req, env, k, url).catch(() => null);
      if (v) return v;
    }

    // 🛡️ UN POST TIENE QUE VENIR DE ESTA PÁGINA (04/10/2026, la lista de seguridad de Dlx: «CSRF»). La cookie de la
    // sesión es SameSite=Strict, pero un formulario de otra página podía mandar a `/api/cuenta` el permiso de OTRA
    // persona —la de quien arma la trampa— y dejarle a la víctima esa sesión: votaba, seguía y gastaba Puntos como el
    // otro sin saberlo. Los navegadores mandan `Origin` en todo POST; si viene y no es éste, no pasa. Sin `Origin`
    // (el ciclo, un navegador viejo) pasa como antes
    // 🛡️ el freno por IP: todo lo de la API y la vista previa de los perfiles (ver `demasiados()`)
    if ((url.pathname.indexOf('/api/') === 0 || url.pathname.indexOf('/freestyle-rap/r/') === 0
      || url.pathname.indexOf('/freestyle-rap/sv/') === 0 || url.pathname.indexOf('/freestyle-rap/crew/') === 0
      || url.pathname.indexOf('/freestyle-rap/llave/') === 0 || url.pathname.indexOf('/freestyle-rap/pais/') === 0
      || url.pathname.indexOf('/freestyle-rap/ligas/') === 0)
      && demasiados(bloqueIP(req.headers.get('cf-connecting-ip')))) return muchos();
    if (req.method === 'POST' && url.pathname.indexOf('/api/') === 0) {
      const o = req.headers.get('origin');
      if (o !== null && o !== url.origin) return new Response('no', { status: 403, headers: SEGURO });
    }

    if (AVISOS[url.pathname]) return avisos(req, url);

    if (url.pathname === '/api/lobby') {
      if (req.method !== 'GET') return new Response('no', { status: 405 });
      // El Worker sirve el lobby como HTML; lo que hace falta acá es el
      // json crudo. `?json=1` se lo pide (ver `/lobby` en worker.js).
      const r = await fetch(ORIGEN + '/lobby?json=1', {
        method: 'GET',
        headers: { accept: 'application/json' },
        cf: { cacheTtl: 60, cacheEverything: true },
      });
      const h = new Headers();
      h.set('content-type', 'application/json; charset=utf-8');
      h.set('x-content-type-options', 'nosniff');
      // ⚠️ 60 s DE CACHE Y `stale-while-revalidate`: el ciclo escribe una
      // vez por hora, pero la cuenta atrás corre en el navegador, así que
      // una copia de hace un minuto no atrasa el contador ni un segundo.
      //
      // 🔴 EL `stale-while-revalidate` ERA 600 Y ESO ENGAÑA MIRANDO. Dlx
      // reportó el 24/09/2026 que la tarjeta de Makma seguía vieja y que
      // le salía la de Servidor: las dos cosas eran ESTE encabezado. La
      // carta ya estaba redibujada y el payload ya ofrecía su Temporada —
      // su navegador estaba sirviendo una copia de hasta **diez minutos**
      // mientras revalidaba por detrás.
      //
      // ⚠️ Diez minutos está bien para un dato que cambia cada media hora
      // y está MAL cuando alguien está mirando si un arreglo llegó: la
      // página se ve rota y no lo está. 120 s conserva casi toda la
      // ganancia —la segunda visita sigue siendo instantánea— y deja de
      // mostrar un mundo de hace diez minutos.
      h.set('cache-control', 'public, max-age=60, stale-while-revalidate=120');
      return new Response(r.body, { status: r.status, headers: h });
    }

    // 🔑 LOS PERFILES, por el mismo camino que el lobby: el Worker los lee
    // de KV y acá se reenvían. Se piden sólo al abrir un perfil.
    // el calendario para Google y Apple (webcal): el Worker lo tiene en KV
    if (url.pathname === '/api/calendario.ics' || url.pathname === '/calendario.ics') {
      const r = await fetch(ORIGEN + '/calendario.ics', {
        headers: { accept: 'text/calendar' },
        cf: { cacheTtl: 600, cacheEverything: true },
      });
      return new Response(r.body, {
        status: r.status,
        headers: { 'content-type': 'text/calendar; charset=utf-8', ...SEGURO,
          'cache-control': 'public, max-age=900' },
      });
    }
    // «Mi cuenta» con Discord: el permiso va al Worker, que le pregunta a Discord
    if (CUENTA[url.pathname]) {
      if (req.method !== 'POST') return new Response('no', { status: 405 });
      const cuerpo = await req.text();
      // las redes elegidas viajan en el cuerpo: 2 KB alcanzan de sobra
      if (cuerpo.length > 2048) return new Response('grande', { status: 413 });
      const hs = { 'content-type': 'application/json', 'x-lg-ip': ipDe(req) };
      if (sesion(req)) hs['x-lg-ses'] = sesion(req);
      const r = await fetch(ORIGEN + CUENTA[url.pathname], { method: 'POST', body: cuerpo, headers: hs });
      const vuelta = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...SEGURO };
      // la sesión: el Worker la abre (entrar) o la cierra (salir) con su cookie
      if (r.headers.get('set-cookie')) vuelta['set-cookie'] = r.headers.get('set-cookie');
      return new Response(r.body, { status: r.status, headers: vuelta });
    }
    // 🔑 las llaves viejas, a pedido: ver `llaveVieja()` en app.js. Y el muro
    // de Publicaciones (28/09/2026): ver `pedirMuro()`
    // 🏟️ y el detalle de las ligas (14/10/2026): las fechas y el flyer de cada una, al abrir Ligas
    if (url.pathname === '/api/perfiles' || url.pathname === '/api/llaves' || url.pathname === '/api/muro' ||
        url.pathname === '/api/ligas' || url.pathname === '/api/salon' || url.pathname === '/api/tags' || url.pathname === '/api/semanas') {
      if (req.method !== 'GET') return new Response('no', { status: 405 });
      const r = await fetch(ORIGEN + url.pathname.slice(4), {
        method: 'GET',
        headers: { accept: 'application/json' },
        cf: { cacheTtl: 60, cacheEverything: true },
      });
      const h = new Headers();
      h.set('content-type', 'application/json; charset=utf-8');
      h.set('x-content-type-options', 'nosniff');
      h.set('cache-control', 'public, max-age=60, stale-while-revalidate=120');
      return new Response(r.body, { status: r.status, headers: h });
    }

    // `/lobby` era la ruta de antes. Se conserva como redirección: es la
    // que está en los commits y en cualquier link ya pasado.
    if (url.pathname === '/lobby' || url.pathname === '/lobby/') {
      return Response.redirect(url.origin + '/', 301);
    }

    // Todo lo demás son los archivos de `bot/paginas/`. En modo avanzado
    // el `_worker.js` recibe TODO, así que hay que pasarle la pelota a
    // los estáticos a mano — si no, la página no existe.
    return env.ASSETS.fetch(req);
  },
};
