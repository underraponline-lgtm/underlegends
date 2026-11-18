// 🎁 LOS REFERIDOS, DEL LADO DE LA PÁGINA (17/11/2026). Dlx: «una nueva opción con el ícono de regalo… será un sistema de
// referrals», «que el link sea corto… no asustar», «que el máximo sea 10 de momento».
//
// El link corto `/i/<clave>` lleva a `/freestyle-rap/invitar?ref=<clave>` (bot/paginas/_worker.js). Acá:
//   · `guardarRef()` anota en el navegador qué link tocó (`lg:ref`, una semana: el que tarda más ya no llegó por él).
//   · `mandarRef()` se lo dice al objeto apenas hay cuenta (al cargar y con cada `lg:cuenta`), UNA vez: la respuesta queda
//     en `lg:ref` (`r`) para que la página la muestre, y no se vuelve a mandar. Sólo la que es final (`FINAL`): la sesión
//     que falta o el objeto que falla se muestran en esta visita y se vuelven a probar (18/11/2026).
// Quién cuenta y cuándo lo decide el objeto (`refLlegue()` y `refRevisar()` en bot/avisos.js), nunca la página.
import { useEffect, useState } from 'react';
import { pasePost } from './pase.js';

const W = window;
const LS = 'lg:ref';
export const REF_DIAS = 7;
// 🔤 CON LETRAS DE CUALQUIER ALFABETO (18/11/2026): la clave sale de `comun/claves.clave()`, que deja la ø y el cirílico, y
// con [a-z0-9] `guardarRef()` tiraba el `?ref=tøkiø` que el link corto ya redirige bien (bot/paginas/_worker.js). La
// misma expresión que allá y que `REF_COD` (bot/avisos.js)
const COD = /^[\p{L}\p{N}][\p{L}\p{N}._-]{0,59}$/u;

function leer() {
  try { return JSON.parse(W.localStorage.getItem(LS) || 'null'); } catch (e) { return null; }
}
function escribir(v) {
  try { if (v) W.localStorage.setItem(LS, JSON.stringify(v)); else W.localStorage.removeItem(LS); } catch (e) { /* sin almacenamiento */ }
  W.dispatchEvent(new Event('lg:ref'));
}

// 🔁 LAS RESPUESTAS QUE SE GUARDAN (18/11/2026): los «no» de `refPuede()` (bot/avisos.js), que no cambian por volver a
// mandar. Un 401 `sin_sesion` (sin la cookie, o el objeto que falló al leerla), un `discord` o un 5xx se guardaban igual
// y la invitación no se volvía a mandar en 7 días, aunque la página dijera «Prueba de nuevo en un rato»
const FINAL = new Set(['link_vencido', 'propio', 'no_nuevo', 'cuenta_nueva', 'lleno', 'faltan_datos']);
// lo que contestó con un error que no es final: sólo para esta visita (`{k, t, r}`, el de ESE link), así la página lo
// dice igual
let pasajero = null;

/** Lo guardado, si es de esta semana: `{k, t, r?}` */
function guardado() {
  const v = leer();
  if (!(v && COD.test(String(v.k || '')) && Date.now() - Number(v.t || 0) < REF_DIAS * 864e5)) return null;
  // 🔁 un error que no es final guardado por la versión de antes (17/11, `sin_sesion`, `discord`…) seguía trabando el
  // reintento toda la semana (18/11/2026, revisión): se lee como «sin respuesta» y se vuelve a mandar
  if (v.r && v.r !== 'ok' && v.r !== 'ya' && !FINAL.has(v.r)) return { k: v.k, t: v.t };
  return v;
}

/** El link que tocó, si es de esta semana: `{k, t, r?}` (`r`: lo que contestó el objeto) */
export function refPendiente() {
  const v = guardado();
  return v && !v.r && pasajero && pasajero.k === v.k && pasajero.t === v.t ? Object.assign({}, v, { r: pasajero.r }) : v;
}

/**
 * Lee `?ref=` de la dirección y lo anota. No pisa uno ya anotado (`ok`, `ya`) ni un «no» final con la MISMA clave; sí
 * otra clave, o la misma después de un `link_vencido` o un `lleno` (18/11/2026: quien invita reabre su link y es el
 * mismo `/i/<clave>`, y tocarlo no cambiaba nada en 7 días: la invitación se perdía)
 */
export function guardarRef() {
  try {
    const k = String(new URLSearchParams(W.location.search).get('ref') || '').toLowerCase();
    if (!COD.test(k)) return;
    const v = guardado();
    if (v && v.r && (v.r === 'ok' || v.r === 'ya' || (v.k === k && v.r !== 'link_vencido' && v.r !== 'lleno'))) return;
    escribir({ k, t: Date.now() });
  } catch (e) { /* tal cual */ }
}

let yendo = false;
/** Si hay cuenta y un link sin mandar, lo manda. Devuelve lo que contestó, o `null` */
export async function mandarRef() {
  const v = guardado();
  if (!v || v.r || yendo) return null;
  let dc = null;
  try { dc = JSON.parse(W.localStorage.getItem('lg:dc') || 'null'); } catch (e) { dc = null; }
  if (!dc || !dc.id) return null;
  yendo = true;
  try {
    const j = await pasePost('ref', { accion: 'llegue', de: v.k });
    // sin respuesta (la red) o con un error que no es final (la sesión que falta, el objeto que falló) se reintenta en
    // la próxima —el error se muestra igual en esta visita—; con un sí o un «no» final, queda anotada
    if (j && (j._ok || FINAL.has(j.error))) escribir(Object.assign({}, v, { r: j.ok ? (j.ya ? 'ya' : 'ok') : String(j.error || 'no') }));
    else if (j && j.error) { pasajero = { k: v.k, t: v.t, r: String(j.error) }; W.dispatchEvent(new Event('lg:ref')); }
    return j;
  } finally { yendo = false; }
}

/** Lo que tocó y qué pasó, para la página (se redibuja con `lg:ref`) */
export function useRefPendiente() {
  const [v, setV] = useState(refPendiente);
  useEffect(() => {
    const f = () => setV(refPendiente());
    W.addEventListener('lg:ref', f);
    return () => W.removeEventListener('lg:ref', f);
  }, []);
  return v;
}

/** Lo tuyo (`/avisos/ref`): tu link, el track y a quién trajiste. `accion`: 'ver' o 'activar' */
export function pedirRef(accion = 'ver') {
  return pasePost('ref', { accion });
}

/** Lo que dice la página de cada respuesta del objeto */
export const REF_ERROR = {
  ok: 'Listo: quedaste anotado. Cuenta cuando te verifiques y llegues al nivel 1 del Pase (dos Tareas): ahí te llegan tus 500 Puntos de Tienda.',
  ya: 'Ya estabas anotado por una invitación.',
  link_vencido: 'Ese link ya no está abierto: pídele uno nuevo a quien te invitó.',
  propio: 'Ése es tu propio link: pásaselo a alguien que todavía no esté en la Liga.',
  no_nuevo: 'Las invitaciones son para quien llega por primera vez, y tú ya estabas en la Liga.',
  cuenta_nueva: 'Tu cuenta de Discord es muy nueva para una invitación: tiene que tener 30 días o más.',
  lleno: 'Quien te invitó ya llegó al tope de invitados.',
  sin_verificar: 'Tu link se abre cuando estés verificado.',
};

// al cargar: lo que vino en la dirección, y mandarlo si ya hay cuenta (y cada vez que alguien entra)
guardarRef();
W.addEventListener('lg:cuenta', () => { mandarRef(); });
// 🔁 y al volver a entrar con la MISMA cuenta (18/11/2026): `lg:dc` no cambia, `lg:cuenta` no salta, y quedaba sólo el
// intento de 1,5 s, que puede llegar antes que la cookie de /api/cuenta. `quienSoy()` siempre avisa `lg:cuentaest`;
// `mandarRef()` no repite nada si no hay un link pendiente
W.addEventListener('lg:cuentaest', () => { mandarRef(); });
setTimeout(() => { mandarRef(); }, 1500);
