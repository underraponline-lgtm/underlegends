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
 * ⚠️ UN PROYECTO DE PAGES NO SE RENOMBRA: el nombre ES el subdominio.
 * Éste nació como `liga-global` y pasó a `underlegends` creando el
 * proyecto nuevo. El viejo **no se borró**: quedaría un link muerto por
 * nada, así que sirve un 301 hacia acá (ver `bot/paginas_viejas/`).
 */
const ORIGEN = 'https://liga-global-bot.liga-global-ul.workers.dev';

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

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
