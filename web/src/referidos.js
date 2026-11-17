// 🎁 LOS REFERIDOS, DEL LADO DE LA PÁGINA (17/11/2026). Dlx: «una nueva opción con el ícono de regalo… será un sistema de
// referrals», «que el link sea corto… no asustar», «que el máximo sea 10 de momento».
//
// El link corto `/i/<clave>` lleva a `/freestyle-rap/invitar?ref=<clave>` (bot/paginas/_worker.js). Acá:
//   · `guardarRef()` anota en el navegador qué link tocó (`lg:ref`, una semana: el que tarda más ya no llegó por él).
//   · `mandarRef()` se lo dice al objeto apenas hay cuenta (al cargar y con cada `lg:cuenta`), UNA vez: la respuesta queda
//     en `lg:ref` (`r`) para que la página la muestre, y no se vuelve a mandar.
// Quién cuenta y cuándo lo decide el objeto (`refLlegue()` y `refRevisar()` en bot/avisos.js), nunca la página.
import { useEffect, useState } from 'react';
import { pasePost } from './pase.js';

const W = window;
const LS = 'lg:ref';
export const REF_DIAS = 7;
const COD = /^[a-z0-9][a-z0-9._-]{0,59}$/;

function leer() {
  try { return JSON.parse(W.localStorage.getItem(LS) || 'null'); } catch (e) { return null; }
}
function escribir(v) {
  try { if (v) W.localStorage.setItem(LS, JSON.stringify(v)); else W.localStorage.removeItem(LS); } catch (e) { /* sin almacenamiento */ }
  W.dispatchEvent(new Event('lg:ref'));
}

/** El link que tocó, si es de esta semana: `{k, t, r?}` (`r`: lo que contestó el objeto) */
export function refPendiente() {
  const v = leer();
  return v && COD.test(String(v.k || '')) && Date.now() - Number(v.t || 0) < REF_DIAS * 864e5 ? v : null;
}

/** Lee `?ref=` de la dirección y lo anota (no pisa uno que ya se mandó con otra clave) */
export function guardarRef() {
  try {
    const k = String(new URLSearchParams(W.location.search).get('ref') || '').toLowerCase();
    if (!COD.test(k)) return;
    const v = refPendiente();
    if (v && v.r) return;
    escribir({ k, t: Date.now() });
  } catch (e) { /* tal cual */ }
}

let yendo = false;
/** Si hay cuenta y un link sin mandar, lo manda. Devuelve lo que contestó, o `null` */
export async function mandarRef() {
  const v = refPendiente();
  if (!v || v.r || yendo) return null;
  let dc = null;
  try { dc = JSON.parse(W.localStorage.getItem('lg:dc') || 'null'); } catch (e) { dc = null; }
  if (!dc || !dc.id) return null;
  yendo = true;
  try {
    const j = await pasePost('ref', { accion: 'llegue', de: v.k });
    // sin respuesta (la red, la sesión vencida) se reintenta en la próxima; con una, queda anotada
    if (j && (j._ok || j.error)) escribir(Object.assign({}, v, { r: j.ok ? (j.ya ? 'ya' : 'ok') : String(j.error || 'no') }));
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
setTimeout(() => { mandarRef(); }, 1500);
