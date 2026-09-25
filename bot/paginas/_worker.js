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
};

async function avisos(req, url) {
  const metodo = AVISOS[url.pathname];
  if (req.method !== metodo) return new Response('no', { status: 405 });
  const init = { method: metodo, headers: { accept: 'application/json' } };
  if (metodo === 'POST') {
    const cuerpo = await req.text();
    if (cuerpo.length > 4096) return new Response('demasiado grande', { status: 413 });
    init.body = cuerpo;
    init.headers['content-type'] = 'application/json';
  } else if (url.pathname.endsWith('/clave')) {
    // la clave pública no cambia: una hora en el borde
    init.cf = { cacheTtl: 3600, cacheEverything: true };
  }
  const r = await fetch(ORIGEN + url.pathname.slice('/api'.length), init);
  return new Response(r.body, {
    status: r.status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': metodo === 'GET' ? 'public, max-age=20' : 'no-store',
    },
  });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

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
        headers: { 'content-type': 'text/calendar; charset=utf-8',
          'cache-control': 'public, max-age=900' },
      });
    }
    // «Mi cuenta» con Discord: el permiso va al Worker, que le pregunta a Discord
    if (CUENTA[url.pathname]) {
      if (req.method !== 'POST') return new Response('no', { status: 405 });
      const cuerpo = await req.text();
      // las redes elegidas viajan en el cuerpo: 2 KB alcanzan de sobra
      if (cuerpo.length > 2048) return new Response('grande', { status: 413 });
      const r = await fetch(ORIGEN + CUENTA[url.pathname], {
        method: 'POST', body: cuerpo, headers: { 'content-type': 'application/json' },
      });
      return new Response(r.body, { status: r.status, headers: {
        'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
    }
    if (url.pathname === '/api/perfiles') {
      if (req.method !== 'GET') return new Response('no', { status: 405 });
      const r = await fetch(ORIGEN + '/perfiles', {
        method: 'GET',
        headers: { accept: 'application/json' },
        cf: { cacheTtl: 60, cacheEverything: true },
      });
      const h = new Headers();
      h.set('content-type', 'application/json; charset=utf-8');
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
