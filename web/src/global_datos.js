// 🌎 `/global.json`, UNA vez para toda la página (24/11/2026): lo piden el Ranking global (global.jsx, que se baja aparte) y
// el buscador de arriba (arriba.jsx, que va en el paquete principal). Vive en su propio archivo para que el buscador no
// arrastre global.jsx entero al paquete principal.
//
// ⏳ CON PLAZO (21/11/2026, revisión de robustez): colgado, el pedido no fallaba nunca y la página no llegaba a decir que no
// pudo ni a dejar reintentar. A los 20 s se corta (`AbortController` + `setTimeout`, no `AbortSignal.timeout`: Safari viejo)
// y es un fallo más: se suelta, y el próximo intento vuelve a pedir.
let pedido = null;

/** La promesa de `/global.json` (la misma para todos los que la piden). `listo` trae el dato cuando ya llegó. */
export function bajarGlobal() {
  if (pedido) return pedido;
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const plazo = setTimeout(() => { if (ctl) ctl.abort(); }, 20000);
  const este = fetch('/global.json', { cache: 'no-cache', signal: ctl ? ctl.signal : undefined })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .finally(() => clearTimeout(plazo));
  pedido = este;
  este.then((d) => { este.listo = d; }, () => { if (pedido === este) pedido = null; });
  return este;
}

/** El dato si ya llegó, o null (para arrancar sin esperar). */
export const globalListo = () => (pedido && pedido.listo) || null;

/** Suelta el pedido (para «Reintentar»). */
export function olvidarGlobal() { pedido = null; }
