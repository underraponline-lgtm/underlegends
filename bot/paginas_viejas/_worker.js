/**
 * liga-global.pages.dev — el nombre viejo, que ahora redirige.
 *
 * 🔴 UN PROYECTO DE PAGES NO SE RENOMBRA. El nombre **es** el
 * subdominio, así que pasar de `liga-global` a `underlegends` es crear
 * otro proyecto, no cambiarle el nombre a éste.
 *
 * ⚠️ Y EL VIEJO NO SE BORRA, SE REDIRIGE. Borrarlo deja muerto
 * cualquier link que ya se haya compartido —y un link muerto no dice a
 * dónde ir—. Un 301 cuesta diez líneas, no rompe nada y se puede apagar
 * el día que ya nadie lo use.
 *
 * ⚠️ 301 Y NO 302: le dice al navegador y a Google que la mudanza es
 * definitiva, así que el nombre nuevo hereda lo que el viejo hubiera
 * juntado. Un 302 los haría seguir volviendo acá para siempre.
 *
 * ⚠️ SE CONSERVA LA RUTA Y LA QUERY. Quien tenga guardado `/lobby` cae
 * en `/lobby`, no en la portada — que es la diferencia entre una
 * redirección y una que te pierde donde estabas.
 */
const NUEVO = 'https://underlegends.pages.dev';

export default {
  fetch(req) {
    const u = new URL(req.url);
    return Response.redirect(NUEVO + u.pathname + u.search, 301);
  },
};
