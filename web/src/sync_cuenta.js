// 📱 LO VISTO O HECHO EN LA PÁGINA, EN TODOS TUS DISPOSITIVOS (23/11/2026). Dlx: «asegúrate que las cosas que se hagan en un
// dispositivo con tu cuenta se sincronicen perfectamente con otras, porque hice la encuesta semanal en mi PC pero en mi
// celular me pide hacerla, y entre otras cosas que puedas ver así».
//
// Los votos y los aplausos ya los guardaba el servidor: ahora vienen con `pedirSigo()` (social.js, `usarMios()`). Esto es lo
// otro, lo que sólo sabía el navegador: el tutorial y la bienvenida (que en un celular nuevo volvían a salir, con notas en
// cada página por 21 días), el «¡Subiste!» del Pase, lo nuevo del Inventario y de Publicaciones, las fiestas de la racha,
// los invitados ya vistos, el aviso de la página cerrado y, en el Dashboard de Dlx, los «Ya lo vi» y lo pospuesto.
//
// CÓMO: `pedirSigo()` trae lo guardado de tu cuenta (`mios.ui`, una fila por cuenta: `uiGuardar()` de bot/avisos.js) y avisa
// `lg:ui-cuenta`. Acá se junta con lo de este navegador marca por marca —ninguna regla «des-ve» nada: lo visto en cualquier
// dispositivo queda visto—, se escribe en el navegador, se avisa `lg:ui` (cada pieza vuelve a leer) y, si cambió algo, se
// sube. Después, lo que cambie se sube al minuto o al dejar la pestaña. Nada se sube antes de haber leído lo de la cuenta:
// si no, un celular recién estrenado pisaría lo de la PC.
//
// ⚠️ LA LISTA DE CLAVES ESTÁ DOS VECES: acá (`REGLAS`) y en `UI_CLAVES` de bot/avisos.js, que rechaza las que no conoce.
// Una clave nueva va en las dos.

const W = typeof window !== 'undefined' ? window : {};
const js = (s) => { try { return JSON.parse(s); } catch (e) { return undefined; } };
const num = (s) => Number(s) || 0;
const esObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);

// { temp, n }: la temporada más nueva y, en la misma, el nivel más alto
function masAlto(a, b) {
  const A = js(a), B = js(b);
  if (!esObj(A)) return b;
  if (!esObj(B)) return a;
  const c = String(A.temp || '').localeCompare(String(B.temp || ''), 'es', { numeric: true });
  if (c) return c > 0 ? a : b;
  return (Number(A.n) || 0) >= (Number(B.n) || 0) ? a : b;
}
// una lista de cosas vistas: las dos juntas, con tope (lo de este navegador primero)
const unionLista = (tope) => (a, b) => {
  const A = js(a), B = js(b);
  if (!Array.isArray(A)) return b;
  if (!Array.isArray(B)) return a;
  return JSON.stringify([...new Set(A.concat(B))].slice(0, tope));
};
// {clave: algo}: las dos juntas; si las dos la tienen, la de este navegador
function unionObj(a, b) {
  const A = js(a), B = js(b);
  if (!esObj(A)) return b;
  if (!esObj(B)) return a;
  return JSON.stringify(Object.assign({}, B, A));
}
// 🧭 el tutorial (`lg:tuto`, primera.js): lo más avanzado de cada cosa y la primera visita más vieja. `nuevo` es «nunca vino»:
// si en algún dispositivo ya no lo era, no lo es. `c` (lo que cuenta el Dashboard, una vez por navegador) y `pista` (la
// decide el servidor) quedan como están en cada navegador
function unirTuto(a, b) {
  const A = js(a), B = js(b);
  if (!esObj(A)) return b;
  if (!esObj(B)) return a;
  const o = Object.assign({}, B, A);
  for (const k of new Set(Object.keys(A).concat(Object.keys(B)))) {
    if (k === 't' || k === 'nuevo' || k === 'c' || k === 'pista') continue;
    const va = A[k], vb = B[k];
    if (Array.isArray(va) && Array.isArray(vb)) o[k] = [...new Set(va.concat(vb))];
    else if (esObj(va) && esObj(vb)) o[k] = Object.assign({}, vb, va);
    else if (!va && vb) o[k] = vb;
    else if (k === 'tour' && (va === 'fin' || vb === 'fin')) o[k] = 'fin';
  }
  const ts = [A.t, B.t].filter((t) => Number(t) > 0);
  if (ts.length) o.t = Math.min(...ts);
  if ('nuevo' in B) o.nuevo = !!(A.nuevo && B.nuevo);
  o.c = A.c || {};
  if ('pista' in A) o.pista = A.pista; else delete o.pista;
  return JSON.stringify(o);
}
// el aviso de la página que cerraste («texto|hasta»): el de fecha más nueva
const hastaDe = (s) => Date.parse(String(s || '').split('|').pop()) || 0;

// ⚠️ la misma lista que `UI_CLAVES` de bot/avisos.js. El orden es el de prioridad si no entra todo en `UI_MAX`
export const REGLAS = {
  'lg:tuto': unirTuto,
  'lg:pase-visto': masAlto,
  'lg:barra-pase': masAlto,
  'lg:pub-visto': (a, b) => String(Math.max(num(a), num(b))),
  'lg:ref_visto': (a, b) => String(Math.max(num(a), num(b))),
  'lg:racha-fest': unionObj,
  'lg:aviso-cerrado': (a, b) => (hastaDe(a) >= hastaDe(b) ? a : b),
  'lg:inv-visto': unionLista(1500),
  'lg:db-pospuesto': unionObj,
  'lg:db-logs': unionLista(400),
};
const UI_MAX = 15500;

/** Lo de este navegador y lo de la cuenta, juntos: `{clave: texto}` (el texto tal cual va en localStorage) */
export function juntar(local, cuenta) {
  const out = {};
  for (const k of Object.keys(REGLAS)) {
    const a = local[k], b = cuenta && typeof cuenta[k] === 'string' ? cuenta[k] : null;
    if (a == null && b == null) continue;
    out[k] = a == null ? b : b == null ? a : REGLAS[k](a, b);
  }
  return out;
}

function leerLocal() {
  const out = {};
  for (const k of Object.keys(REGLAS)) {
    try { const v = localStorage.getItem(k); if (v != null) out[k] = v; } catch (e) { /* sin almacenamiento */ }
  }
  return out;
}
// lo que se sube: en el orden de `REGLAS`, mientras entre
function paraSubir(ui) {
  const out = {};
  let largo = 2;
  for (const k of Object.keys(REGLAS)) {
    if (ui[k] == null) continue;
    const n = JSON.stringify(k).length + JSON.stringify(ui[k]).length + 2;
    if (largo + n > UI_MAX) continue;
    out[k] = ui[k];
    largo += n;
  }
  return out;
}

let leido = false;
let subido = '';
function subir(keepalive) {
  if (!leido || !W.DC) return;
  const ui = paraSubir(leerLocal());
  const firma = JSON.stringify(ui);
  if (firma === subido || firma === '{}') return;
  subido = firma;
  try {
    fetch('/api/avisos/ui', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ui }), keepalive: !!keepalive })
      .then((r) => { if (!r.ok) subido = ''; })
      .catch(() => { subido = ''; });
  } catch (e) { subido = ''; }
}

// lo de la cuenta llegó (`usarMios()` de social.js): se junta, se escribe, se avisa y se sube si hace falta
function llego(e) {
  const cuenta = (e && e.detail) || {};
  const local = leerLocal();
  const junto = juntar(local, cuenta);
  let cambio = false;
  for (const k of Object.keys(junto)) {
    if (junto[k] !== local[k]) {
      try { localStorage.setItem(k, junto[k]); cambio = true; } catch (er) { /* sin almacenamiento */ }
    }
  }
  // lo que ya está en la cuenta no se vuelve a subir
  subido = JSON.stringify(paraSubir(cuenta || {}));
  leido = true;
  if (cambio) { try { W.dispatchEvent(new Event('lg:ui')); } catch (er) { /* navegador viejo */ } }
  subir(false);
}

if (W.addEventListener) {
  W.addEventListener('lg:ui-cuenta', llego);
  // ya había llegado antes de que esto cargara (`UI_CUENTA` de social.js)
  if (W.UI_CUENTA) llego({ detail: W.UI_CUENTA });
  // al salir de la cuenta, lo que sigue en este navegador ya no es de ella
  W.addEventListener('lg:cuenta', () => { if (!W.DC) { leido = false; subido = ''; } });
  setInterval(() => { if (!document.hidden) subir(false); }, 60000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) subir(true); });
}
