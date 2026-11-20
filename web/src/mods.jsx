// 🛠️ La franja de Mods: lo que está prendido, cada cosa con su ✕, y «Apagar todo». Qué es cada cosa: `mods.js`; la
// página donde se prende: mods_pag.jsx (`#/mods`).
// ⚠️ SIN EL BOTÓN DE LA CABECERA desde el 18/11/2026 (Dlx: «put the mods menu within the account… remove the mods menu
// from the top»): con él, el menú no entraba y la marca quedaba pegada a Inicio («LIGA GLOBAL · T1INICIO» en la Tienda).
// Y SIN LA VENTANA DE «TUS PANELES» desde el 20/11/2026: la reemplazó la página (Dlx, a la maqueta: «A con lo de B»)
import { INTERRUPTORES, VISTAS, ponerMod, useModsEstado } from './mods.js';

/** Lo que dice la franja de cada cosa prendida */
function nombre(k, M) {
  if (k === 'vista') return 'Ver como: ' + (VISTAS[M.vista] || M.vista);
  if (k === 'pase') return 'El Pase en el nivel ' + (Number(M.paseN) || 1) + (M.paseP ? ' · Premium' : '');
  return INTERRUPTORES[k];
}

/** La franja magenta mientras algo esté prendido: qué, apagar cada cosa y apagarlo todo. */
export function FranjaMods() {
  const M = useModsEstado();
  const on = Object.keys(INTERRUPTORES).filter((k) => M[k]);
  if (!on.length) return null;
  return (
    <div className="mods-franja" role="status">
      <a className="mods-fr-t" href="#/mods">MODS</a>
      {on.map((k) => (
        <button key={k} type="button" className="mods-chip" onClick={() => ponerMod(k, typeof M[k] === 'boolean' ? false : '')}
          aria-label={'Apagar ' + nombre(k, M)}>{nombre(k, M)}<i aria-hidden="true">✕</i></button>
      ))}
      <button type="button" className="mods-fin" onClick={() => ponerMod(null)}>Apagar todo</button>
    </div>
  );
}
