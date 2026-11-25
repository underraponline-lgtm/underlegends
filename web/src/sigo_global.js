// ⭐ SEGUIR A CUALQUIERA DEL RANKING GLOBAL: PROS, PLAZAS Y LA LIGA (25/11/2026). Dlx: «que se pueda seguir a los raperos
// pros plazas y liga».
//
// 🔑 TODO VA A LA MISMA LISTA DE SIEMPRE (`lg:sigo` y la tabla `sigue` del objeto, con `window.alternarSigo()` de social.js):
// con tu cuenta, en todos tus dispositivos; sin cuenta, en este navegador. Hasta acá Reels guardaba a los de afuera sólo en
// el navegador (`lg:reels-sigo`), y en el Ranking global no se podía seguir a nadie.
//   · alguien de la Liga (o de afuera unido a su perfil de la Liga): su clave de la Liga, como siempre
//   · un pro o uno de plaza: `g--<clave del Ranking global>`
//
// ⚠️ EL `--` ES LO QUE LOS SEPARA. 19 claves del global son también de alguien de la Liga («snow» de plaza y «snow» de la
// Liga son dos personas, `comun/claves.py`), así que la clave sola seguiría a la persona equivocada. Una clave de la Liga
// nunca lleva `--` (sólo el `-cc` del final de `_choques()`), y `g--x` pasa `claveValida()` del Worker: no hizo falta
// tocarlo. Todo lo que lista a quién sigues pasa por `liga.quienK()`, que no encuentra un `g--` y lo saltea.
import { useEffect, useState } from 'react';
import { aQuienSigo } from './liga.js';

export const PREFIJO = 'g--';
const VIEJO = 'lg:reels-sigo';   // lo que Reels guardaba sólo en el navegador (24/11/2026), hasta pasarlo a la lista

/** La clave con la que se sigue a alguien del Ranking global (`g`: su fila de global.json, con `hk` si es de la Liga). */
export function claveSeguir(g) {
  if (!g) return '';
  if (g.hk) return g.hk;
  // alguien de la Liga que la página no encontró en su tabla (Heat, 25/11/2026): su clave de la Liga igual (`lg`), nunca
  // un `g--`: si no, seguirlo acá y en su perfil de la Liga serían dos cosas distintas
  if (g.lg) return g.lg;
  return g.k ? PREFIJO + g.k : '';
}
/** ¿Es la clave de alguien de afuera? */
export const esDeAfuera = (k) => typeof k === 'string' && k.startsWith(PREFIJO);
/** La clave del Ranking global de un `g--x` */
export const deAfuera = (k) => (esDeAfuera(k) ? k.slice(PREFIJO.length) : '');

/** Seguir o dejar de seguir (lo mismo que el botón de la Liga). */
export function alternar(k) {
  if (!k || typeof window === 'undefined' || typeof window.alternarSigo !== 'function') return false;
  window.alternarSigo(k);
  return true;
}

/** `[sigo(g) → bool, alternar(g)]`: se vuelve a pintar cuando cambia a quién sigues (`lg:sigo`). */
export function useSigoGlobal() {
  const [lista, setLista] = useState(() => aQuienSigo());
  useEffect(() => {
    const f = () => setLista(aQuienSigo());
    window.addEventListener('lg:sigo', f);
    migrarReels();
    return () => window.removeEventListener('lg:sigo', f);
  }, []);
  const sigo = (g) => { const k = claveSeguir(g); return !!k && lista.includes(k); };
  const seguir = (g) => { const k = claveSeguir(g); if (alternar(k)) setTimeout(() => setLista(aQuienSigo()), 30); };
  return [sigo, seguir, lista];
}

// 🧳 lo que Reels guardaba aparte pasa a la lista, una vez (sin `alternarSigo` todavía —la cañería no cargó—, la próxima)
let migrado = false;
export function migrarReels() {
  if (migrado || typeof window === 'undefined' || typeof window.alternarSigo !== 'function') return;
  migrado = true;
  let xs = [];
  try { xs = JSON.parse(localStorage.getItem(VIEJO) || '[]'); } catch (e) { xs = []; }
  if (!Array.isArray(xs) || !xs.length) return;
  const ya = aQuienSigo();
  // de a uno, como el botón (`alternarSigo` es «cambiar»: sólo los que todavía no sigues). Tope: Reels salió ayer
  for (const k of xs.filter((x) => typeof x === 'string' && x).slice(0, 40)) {
    if (!ya.includes(PREFIJO + k)) window.alternarSigo(PREFIJO + k);
  }
  try { localStorage.removeItem(VIEJO); } catch (e) { /* sin almacenamiento */ }
}
