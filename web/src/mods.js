// 🛠️ EL MENÚ MODS (16/11/2026). Dlx: «nosotros como admins y yo como owner, que tengamos acceso a todo, incluso como owner
// de crew de cualquiera… un MODS menu para activar eso… que sólo los que pueden ver lo vean, para que en competencias no me
// aparezca siempre eso de ver como admin», y «que vean un menú así los dueños de otros servidores y sus admins… lo que sea
// necesario y cuando sea necesario». La maqueta (BEZkuXnUvV98jPMy6NN7KA, v4) lo cerró así:
//   · Owner y Admin: cualquier crew como su Líder, y en Competencias ver todas las llaves o mirar como quien no juega
//   · el dueño de un socio y su equipo: su panel, desde la página de su servidor
//   · Moderador y Asistente: el Dashboard, desde Publicaciones y los perfiles
// El botón sale SÓLO en las páginas donde esa persona tiene algo para hacer. Todo arranca APAGADO y se apaga al cerrar la
// pestaña (`sessionStorage`). ⚠️ Esto es lo que la página muestra: quién puede de verdad lo decide el Worker (los roles
// del objeto) en cada pedido, y lo que hace un mod queda en el historial con su nombre (`crew_log`, `mod:<clave>`).
import { useEffect, useState } from 'react';
import { DUENO } from './liga.js';
import { useRoles } from './roles.js';
import { useSocio } from './panelsocio.js';

const W = window;
const CLAVE = 'lg:mods';
// 🛠️ LA PÁGINA MODS (20/11/2026, Dlx, de la maqueta privada 2n91HAK3krNGWeK6u7zFF1: «A con lo de B, dale»). Mods dejó de ser
// una ventana con cinco interruptores sueltos: es una página (`#/mods`, mods_pag.jsx) en tres grupos, y cada cosa es un
// estado de esta pestaña:
//   · la lente, que sólo cambia lo que ves: `vista` ('' · 'usuario' · 'sincuenta')
//   · probar sin gastar: `prueba` (tener todo), `dinero` (Puntos de prueba), `pase` + `paseN` + `paseP` (el Pase en otro
//     nivel, con o sin Premium). Nada de esto sale al objeto
//   · corregir de verdad: `lapices` (un lápiz en cada cosa que puedes corregir, en su propia página)
// Lo de antes (`crews`, `todo`, `fuera`, `usuario`) sale de esto en `derivar()`, así que las páginas que ya lo miraban
// (crew2.jsx, competencias.jsx, tienda3.jsx) siguen igual.
//: lo que dice la franja de cada cosa prendida (las que no están acá no salen en la franja)
export const INTERRUPTORES = {
  vista: 'Ver como',
  prueba: 'Tener todo',
  dinero: 'Dinero de prueba',
  pase: 'El Pase en otro nivel',
  lapices: 'Lápices para corregir',
};
export const VISTAS = { usuario: 'un usuario', sincuenta: 'sin cuenta' };

function leer() {
  try {
    const x = JSON.parse(W.sessionStorage.getItem(CLAVE) || '{}');
    return x && typeof x === 'object' ? x : {};
  } catch (e) { return {}; }
}

/** Prende o apaga una cosa (o todas, con `null`) y le avisa a la página. Un valor que no es sí/no (la vista, el nivel)
 *  se guarda tal cual; vacío o 0, apagado. */
export function ponerMod(k, v) {
  const x = k === null ? {} : Object.assign(leer(), { [k]: typeof v === 'boolean' ? v : v || '' });
  try { W.sessionStorage.setItem(CLAVE, JSON.stringify(x)); } catch (e) { /* sin sessionStorage: dura lo que la página */ }
  W.__mods = x;
  W.dispatchEvent(new Event('lg:mods'));
}

/** Lo prendido, con lo de antes calculado: los lápices abren las crews y todas las llaves de Competencias, y ver como un
 *  usuario es la Tienda sin tu Premium y Competencias como quien no juega. */
function derivar(x) {
  const usuario = x.vista === 'usuario';
  return Object.assign({}, x, { crews: !!x.lapices, todo: !!x.lapices && !usuario, fuera: usuario, usuario });
}

/** La vista de la lente, para quien no puede usar hooks (liga.js `quienMira()`, App.jsx): '' si no hay ninguna */
export function vistaMods() {
  return (W.__mods || leer()).vista || '';
}

/** Lo prendido: `{vista, prueba, dinero, pase, paseN, paseP, lapices}` y lo de antes (`crews`, `todo`, `fuera`, `usuario`). */
export function useModsEstado() {
  const [m, setM] = useState(() => derivar(W.__mods || leer()));
  useEffect(() => {
    const f = () => setM(derivar(Object.assign({}, W.__mods || leer())));
    W.addEventListener('lg:mods', f);
    return () => W.removeEventListener('lg:mods', f);
  }, []);
  return m;
}

/** Cuántas cosas hay prendidas (lo dicen la franja y «Tus paneles») */
export function prendidosMods(M) {
  return Object.keys(INTERRUPTORES).filter((k) => !!M[k]).length;
}

// 📒 LO QUE HICISTE CON MODS, EN ESTE NAVEGADOR (20/11/2026): las correcciones con su Deshacer. Es una comodidad de quien
// mira, no el registro: lo que corriges queda anotado con tu nombre en el objeto (`socioAnotar()`), y el registro del
// servidor llega a la página en la próxima tanda
const HIST = 'lg:mods-hist';
export function historialMods() {
  try { const x = JSON.parse(localStorage.getItem(HIST) || '[]'); return Array.isArray(x) ? x : []; } catch (e) { return []; }
}
/** Anota una corrección: `{t, que, donde, ruta, deshacer?}` (deshacer: lo que hay que mandar para volver atrás) */
export function anotarMods(x) {
  const xs = [Object.assign({ t: Date.now() }, x), ...historialMods()].slice(0, 30);
  try { localStorage.setItem(HIST, JSON.stringify(xs)); } catch (e) { /* sin almacenamiento: no queda */ }
  W.dispatchEvent(new Event('lg:mods-hist'));
}
/** Marca una como deshecha (por su `t`) */
export function deshechaMods(t) {
  const xs = historialMods().map((x) => (x.t === t ? Object.assign({}, x, { deshecha: Date.now() }) : x));
  try { localStorage.setItem(HIST, JSON.stringify(xs)); } catch (e) { /* nada */ }
  W.dispatchEvent(new Event('lg:mods-hist'));
}
export function useHistorialMods() {
  const [h, setH] = useState(historialMods);
  useEffect(() => {
    const f = () => setH(historialMods());
    W.addEventListener('lg:mods-hist', f);
    return () => W.removeEventListener('lg:mods-hist', f);
  }, []);
  return h;
}

/** Quién es quien mira, para el menú: `{owner, admin, mod, socio}`. ⚠️ Si es socio se pregunta SÓLO en la página de un
 *  servidor (`sv`): es un pedido al panel, y no hace falta en ninguna otra. */
export function useQuienMod(dc, k, sv) {
  const r = (useRoles() || {})[k] || [];
  const rs = r.map((x) => x[0]);
  const owner = !!dc && String(dc.id) === DUENO;
  const socio = useSocio(!!dc && !!sv);
  return {
    owner,
    admin: owner || rs.includes('admin'),
    mod: owner || rs.some((x) => ['admin', 'moderador', 'asistente'].includes(x)),
    socio: !!socio,
  };
}

/** Quién es, en una palabra: lo que dice arriba del menú y de la ventana. */
export function rolMods(Q) {
  return Q.owner ? 'Owner' : Q.admin ? 'Admin' : Q.mod ? 'Moderación' : 'Tu servidor';
}

/** ¿Tiene algo para hacer en Mods? (la fila de «Tus paneles» y la página) */
export const tieneMods = (Q) => !!(Q && (Q.owner || Q.admin || Q.mod || Q.socio));
