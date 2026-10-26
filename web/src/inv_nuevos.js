// 🆕 LO NUEVO DEL INVENTARIO: lo que ganaste desde la última vez que lo abriste (26/10/2026). Vive aparte de
// tags_inv.jsx para que el menú de tu cara (yomenu.jsx) lo cuente sin bajarse la página entera
// Se guarda en el navegador qué viste (`lg:inv-visto`). La primera vez no hay nada «nuevo»: se da todo por visto, si no
// le saldrían 30 NUEVO a quien ya tenía todo. Lo usan esta página y el menú de tu cara (yomenu.jsx)
const VISTO = 'lg:inv-visto';
/** las claves de lo que tienes: `carta|tag` de cada TAG guardado y `pase|título` de cada título */
export function clavesDe(yo) {
  const out = [];
  for (const [c, xs] of Object.entries((yo && yo.ganados) || {})) for (const t of Object.keys(xs || {})) out.push(c + '|' + t);
  for (const t of (yo && yo.titulos) || []) out.push('pase|' + t);
  return out;
}
export function leerVisto() {
  try { const v = JSON.parse(localStorage.getItem(VISTO) || 'null'); return Array.isArray(v) ? new Set(v) : null; } catch (e) { return null; }
}
/** cuántas cosas nuevas tienes (0 si es la primera vez: ver arriba) */
export function cuantosNuevos(yo) {
  const v = leerVisto();
  return v ? clavesDe(yo).filter((x) => !v.has(x)).length : 0;
}
export function marcarVisto(yo) {
  try { localStorage.setItem(VISTO, JSON.stringify(clavesDe(yo))); } catch (e) { /* sin guardar: vuelve a decir nuevo */ }
}

