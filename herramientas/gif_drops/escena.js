// 🎞️ EL ESCENARIO DE LOS DROPS, SOLO, PARA GRABARLO (20/11/2026; lo usa herramientas/gif_drops.py).
// Monta `mostrarDrops()` de la página tal cual, con un drop de mentira cuyo resultado se elige acá: así los GIF del bot
// son la animación de verdad y no una copia que se separa de ella. `escena({tipo, min, fin, puntos, titulo})`.
import { mostrarDrops } from '../../web/src/drops_show.js';

window.escena = (o) => {
  const host = document.getElementById('host');
  host.innerHTML = '';
  const res = { ok: true, id: 1, tipo: o.tipo, rareza: o.fin, puntos: o.puntos || 0, titulo: o.titulo || '', sin_tope: 0 };
  const item = { id: 1, origen: o.tipo === 'star' ? 'star:gif' : 'gif', min: o.min, t: Date.now(), tipo: o.tipo };
  window.__drops = mostrarDrops(host, [item], { abrir: () => Promise.resolve(res), alCerrar() {} });
  return true;
};
//: en qué está: la fase, si está ocupado y la rareza que muestra
window.estado = () => {
  const d = document.querySelector('dialog.dsw');
  if (!d) return null;
  return { fase: d.dataset.fase || '', ocupado: !!d.dataset.ocupado, rz: (d.querySelector('.dsw-rz') || {}).textContent || '' };
};
window.tocar = () => {
  const b = document.querySelector('dialog.dsw .dsw-toque');
  if (b) b.click();
  return !!b;
};
