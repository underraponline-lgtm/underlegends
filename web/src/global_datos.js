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

// 📜 `/global_historia.json` (la carrera de cada uno, de Freestylestats), también una vez para toda la página: la piden el
// perfil global, la ficha, las páginas de competencias y el buscador. Si falla, `{ p: {} }` y se vuelve a pedir la próxima
let pedidoH = null;
export function bajarHistoria() {
  if (pedidoH) return pedidoH;
  const este = fetch('/global_historia.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    .then((d) => d || { p: {} });
  pedidoH = este;
  este.then((d) => { este.listo = d; if (!d || !d.p || !Object.keys(d.p).length) { if (pedidoH === este) pedidoH = null; } });
  return este;
}
export const historiaLista = () => (pedidoH && pedidoH.listo) || null;

// 🏆 LAS COMPETENCIAS (24/11/2026, Dlx: «agregar a las ligas de FMS, competencias así fuertes, como historias o perfiles
// también»): FMS España, Red Bull Batalla Chile, God Level… Cada una sale de juntar los podios de la carrera de cada uno
// (`global_historia.json`: [puesto, competencia, edición, fase, en duda]) y los eventos de la T1 del Ranking global cuyo
// nombre empieza igual («FMS Colombia 2026/27 · Jornada 1» es de «FMS Colombia»). ⚠️ No es la competencia entera: es lo
// que sabemos de los que están en el Ranking global. La página lo dice.

/** la clave de una competencia en la dirección: sin tildes, minúsculas, lo demás a «-» (`#/competencia/red-bull-batalla-chile`) */
export function slugComp(n) {
  return String(n || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}
/** el nombre de la competencia de un evento de la T1: sin el año ni lo que va después del «·» */
export function compDeEvento(n) {
  return String(n || '').split(' · ')[0].replace(/\s+20\d\d(\/\d{2,4})?(\s.*)?$/, '').trim();
}
/** `{ id: { id, n, tit: [[clave, puesto, edición, fase, duda]…], ev: [índice del evento en `D.ev`…] } }` */
export function indiceCompetencias(H, D) {
  const C = {};
  const de = (n) => {
    const id = slugComp(n);
    if (!id) return null;
    if (!C[id]) C[id] = { id, n: String(n).trim(), tit: [], ev: [] };
    return C[id];
  };
  Object.entries((H && H.p) || {}).forEach(([k, h]) => {
    ((h && h.t) || []).forEach((t) => { const c = de(t[1]); if (c) c.tit.push([k, t[0], t[2], t[3], t[4]]); });
  });
  ((D && D.ev) || []).forEach((e, i) => {
    if (!e || /^liga/.test(e[2] || '')) return;
    const n = compDeEvento(e[1]);
    if (!n || n.length < 3) return;
    const id = slugComp(n);
    // un evento de la T1 se suma a una competencia que ya existe, o arma la suya si es de los que pesan (no una plaza suelta)
    if (C[id] || e[2] !== 'plaza') { const c = de(n); if (c) c.ev.push(i); }
  });
  return C;
}
