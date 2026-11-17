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
  if (sv && (Q.socio || Q.owner)) atajos.push({ t: 'El panel de tu servidor', d: 'estadísticas, ajustes del bot y tu equipo', ruta: '#/socio' });
  if (Q.mod && (pagina === 'publicaciones' || pagina === 'r')) atajos.push({ t: 'El Dashboard', d: 'lo que espera que decidas', ruta: '#/dashboard' });
  return { sw, atajos };
}
