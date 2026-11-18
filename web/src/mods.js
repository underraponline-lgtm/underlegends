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
// lo que se prende: cada uno es un interruptor del menú
export const INTERRUPTORES = {
  crews: 'Manejar cualquier crew como su Líder',
  todo: 'Ver todas las llaves',
  fuera: 'Mirar como quien no juega',
  // 🛍️ la Tienda, sólo para el dueño (17/11/2026, Dlx: «que en el menú de mods haya la opción de tener todo y en tienda todo
  // también, no es algo verdadero pero es como what if… también la opción para ver cómo lo ve un usuario»). Son VISTAS: no
  // se compra ni se guarda nada. Las mismas dos claves sirven para el resto de la página
  prueba: 'Tener todo (prueba)',
  usuario: 'Ver como un usuario',
};

function leer() {
  try {
    const x = JSON.parse(W.sessionStorage.getItem(CLAVE) || '{}');
    return x && typeof x === 'object' ? x : {};
  } catch (e) { return {}; }
}

/** Prende o apaga un interruptor (o todos, con `null`) y le avisa a la página. */
export function ponerMod(k, v) {
  const x = k === null ? {} : Object.assign(leer(), { [k]: !!v });
  try { W.sessionStorage.setItem(CLAVE, JSON.stringify(x)); } catch (e) { /* sin sessionStorage: dura lo que la página */ }
  W.__mods = x;
  W.dispatchEvent(new Event('lg:mods'));
}

/** Los interruptores prendidos: `{crews, todo, fuera}`. */
export function useModsEstado() {
  const [m, setM] = useState(() => W.__mods || leer());
  useEffect(() => {
    const f = () => setM(Object.assign({}, W.__mods || leer()));
    W.addEventListener('lg:mods', f);
    return () => W.removeEventListener('lg:mods', f);
  }, []);
  return m;
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

/**
 * Lo que el menú ofrece en ESTA página, para esta persona: `[{k, t, d}]` interruptores y `[{t, d, ruta}]` atajos. Vacío:
 * el botón no se dibuja.
 */
export function opcionesMods(Q, pagina, sv) {
  const sw = [], atajos = [];
  if (Q.admin && (pagina === 'crews' || pagina === 'crew')) {
    sw.push({ k: 'crews', t: INTERRUPTORES.crews, d: 'Sus Ajustes, como si fueras el Líder: entrada, rangos, pedidos, nombre y escudo. Gratis, y cada cosa queda anotada con tu nombre.' });
  }
  if (Q.admin && pagina === 'competencias') {
    sw.push({ k: 'todo', t: INTERRUPTORES.todo, d: 'La Copa, la Rapid y los mini eventos completos, también donde no juegas.' });
    sw.push({ k: 'fuera', t: INTERRUPTORES.fuera, d: 'La página como la ve la mayoría: sin tu cruce ni tu lugar.' });
  }
  if (Q.owner && pagina === 'tienda') {
    sw.push({ k: 'prueba', t: INTERRUPTORES.prueba, d: 'La Tienda como si tuvieras todas las piezas: te las pones y las ves. Nada es de verdad: no se compra ni se guarda nada.' });
    sw.push({ k: 'usuario', t: INTERRUPTORES.usuario, d: 'La Tienda como la ve alguien sin tus permisos: sin tu Premium y sin el ensayo. Es una vista: no se compra nada.' });
  }
  if (sv && (Q.socio || Q.owner)) atajos.push({ t: 'El panel de tu servidor', d: 'estadísticas, ajustes del bot y tu equipo', ruta: '#/socio' });
  if (Q.mod && (pagina === 'publicaciones' || pagina === 'r')) atajos.push({ t: 'El Dashboard', d: 'lo que espera que decidas', ruta: '#/dashboard' });
  return { sw, atajos };
}

/** Quién es, en una palabra: lo que dice arriba del menú y de la ventana. */
export function rolMods(Q) {
  return Q.owner ? 'Owner' : Q.admin ? 'Admin' : Q.mod ? 'Moderación' : 'Tu servidor';
}

/**
 * 🗺️ TODOS LOS LUGARES, PARA «TUS PANELES» (Dlx, 17/11/2026: «pon el menú de mods dentro de tus paneles… o si se puede
 * ponlo en ambos lugares. La diferencia es que en el de tus paneles ahí te aparece un pop up con todos los lugares que
 * puedes usar el mod menu dependiendo quién tú eres»). El botón de la cabecera muestra lo de ESTA página; la ventana de
 * Tus paneles, lo de todas. Cada lugar es una página de `opcionesMods()`: lo que se ofrece sale de ahí y no de una
 * segunda lista, así que un interruptor nuevo aparece en los dos sitios. `ruta` vacía: el lugar es la página de tu
 * servidor, que es una por socio, y su atajo ya lleva a donde hace falta.
 */
export const LUGARES = [
  { pagina: 'crews', t: 'Crews', d: 'la lista y la página de cada crew', ruta: '#/crews', ico: 'crews' },
  { pagina: 'competencias', t: 'Competencias', d: 'la Copa, la Rapid y las ligas simuladas', ruta: '#/competencias', ico: 'competencias' },
  { pagina: 'servidor', sv: true, t: 'Tu servidor', d: 'desde la página de tu servidor', ruta: '', ico: 'servidor' },
  { pagina: 'publicaciones', t: 'Publicaciones y perfiles', d: 'para lo que reporta la gente', ruta: '#/publicaciones', ico: 'publicaciones' },
  { pagina: 'tienda', t: 'La Tienda', d: 'con todo de prueba, o como un usuario', ruta: '#/tienda', ico: 'tienda' },
];

/** Los lugares de `LUGARES` donde esta persona tiene algo, cada uno con sus `sw` y `atajos`. */
export function lugaresMods(Q) {
  return LUGARES.map((L) => Object.assign({}, L, opcionesMods(Q, L.pagina, L.sv ? 'tu-servidor' : '')))
    .filter((L) => L.sw.length || L.atajos.length);
}

/** Abre la ventana de todos los lugares (`LugaresMods`, montada una vez en App.jsx) con quién es quien la pide. */
export function abrirLugaresMods(Q) {
  W.dispatchEvent(new CustomEvent('lg:mods-lugares', { detail: Q }));
}
