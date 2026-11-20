// 🔄 UNA PESTAÑA VIEJA CONTRA UNA VERSIÓN NUEVA (16/11/2026, la pasada de bugs; Dlx: «dicen que hay problemas con la
// interfaz»). Los errores que la gente mandó al Dashboard esa semana eran casi todos uno solo: alguien con la página
// abierta mientras se publicaba otra versión (hubo días de 15) abría después una página que todavía no había bajado
// —Inventario, Tu cuenta, el Pase—, y el pedazo NUEVO de esa página se encontraba con el archivo principal VIEJO.
// Los nombres de adentro no coinciden de una versión a otra: a veces faltaba uno («does not provide an export named
// 'c9'») y a veces coincidía con OTRA cosa, y el error era raro —«ss is not a function», React #321 y #31—, con la
// sección apagada sin decir por qué.
//
// Dos arreglos, que van juntos:
//  1. Cada pedazo se llama con su huella (`inicio-pase-<hash>.js`, vite.config.js): una pestaña vieja pide SU pedazo,
//     que ya no está, y falla limpio en vez de cargar funciones equivocadas.
//  2. Esa falla recarga la página una vez, y ya entra con la versión nueva. Lo avisa el ayudante de vite
//     (`vite:preloadError`) y, por si algo se le escapa, la caja que aísla cada página (`Aislada`, App.jsx).

const CLAVE = 'lg:recarga-version';

/** Lo que dice un navegador cuando un pedazo de la página no está o no coincide con el principal */
// (20/11/2026: + «'text/html' is not a valid JavaScript MIME type», lo que dicen Safari y Firefox cuando el pedazo ya no
// está y Pages contesta con la página; el 18/11 un Perfil se apagó así sin recargar)
export const esDeVersion = (e) => /dynamically imported module|Importing a module script failed|does not provide an export named|error loading dynamically imported|Unable to preload|is not a valid JavaScript MIME type/i
  .test(String((e && (e.message || e.reason)) || e || ''));

/** Recarga UNA vez: con un minuto de por medio (si el archivo de verdad falta, no queda en bucle), nunca sin conexión
 *  (ahí recargar no sirve) y nunca sin sessionStorage (no habría cómo frenar un bucle). `true` si recargó. */
export function recargarPorVersion() {
  try { if (navigator.onLine === false) return false; } catch (e) { /* sigue */ }
  try {
    if (Date.now() - Number(sessionStorage.getItem(CLAVE) || 0) < 60000) return false;
    sessionStorage.setItem(CLAVE, String(Date.now()));
  } catch (e) { return false; }
  // mientras se recarga, lo que se rompa por esto no se cuenta como error (lo mira `Aislada`, App.jsx)
  window.__lgRecargando = true;
  location.reload();
  return true;
}

if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (ev) => { if (recargarPorVersion()) ev.preventDefault(); });
}
