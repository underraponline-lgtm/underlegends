// ── 🗄️ LOS SHORTS DE LA LIGA DESPUÉS DE SU DÍA (Dlx, 25/11/2026: «could put into MCs profile, bracket and everything»).
// Un día están en Reels; después, 30 días en el perfil de cada uno y en su batalla de la llave. El robot deja
// `reels/archivo.json` en R2 (público, con CORS para esta página): cada short con quiénes, la ronda, el evento y el número de
// su llave (`ll`). Se lee de R2 directo, sin Worker ni KV, una sola vez por visita y sólo cuando una pantalla lo pide.
//
// ⚠️ Lo vencido lo saca el robot del archivo, y la página lo vuelve a filtrar por si el archivo llegó tarde
import { useEffect, useState } from 'react';

const R2 = 'https://pub-70d5821d06a8432c9cffd0c102195000.r2.dev';
const URL_ARCHIVO = R2 + '/reels/archivo.json';
// 🎧 ⚠️ las batallas enteras en audio YA NO SE LEEN DE ACÁ (28/11/2026): eran públicas (`reels/audios.json`); ahora pasan por
// el Worker con el permiso de cada uno (web/src/grabado.js, bot/grabados.js)
let pedido = null;

/** el nombre sin tildes, signos ni mayúsculas: como `normN` de reels.jsx */
export const normN = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** el archivo entero, vigente (una vez por visita) */
export function bajarArchivo() { return bajar(); }

function bajar() {
  if (!pedido) {
    pedido = fetch(URL_ARCHIVO, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : [])).catch(() => []).then((xs) => {
      const ahora = new Date().toISOString().slice(0, 16);
      return (Array.isArray(xs) ? xs : []).filter((x) => x && x.url && (x.hasta || '') > ahora);
    });
  }
  return pedido;
}

/** los shorts vigentes (`[]` mientras llegan o si no hay) */
export function useArchivo(activo = true) {
  const [xs, setXs] = useState([]);
  useEffect(() => {
    if (!activo) return undefined;
    let vivo = true;
    bajar().then((a) => { if (vivo) setXs(a); });
    return () => { vivo = false; };
  }, [activo]);
  return xs;
}

/** quiénes salen en un short: «A + B» (los de equipos) cuenta como dos */
const genteDe = (x) => (x.nombres || []).flatMap((n) => String(n).split(' + ')).map(normN).filter(Boolean);

/** los shorts donde aparece esa persona, del más nuevo al más viejo */
export function delPerfil(xs, nombre) {
  const n = normN(nombre);
  if (!n) return [];
  return xs.filter((x) => genteDe(x).includes(n)).sort((a, b) => String(b.dia).localeCompare(String(a.dia)) || a.k - b.k);
}

/** el short de una batalla de la llave: la misma llave y los mismos dos (en cualquier orden) */
export function deBatalla(xs, ll, lados) {
  const ls = (lados || []).flatMap((n) => String(n || '').split(' + ')).map(normN).filter(Boolean).sort().join('|');
  if (!ls) return null;
  return xs.find((x) => String(x.ll) === String(ll) && genteDe(x).sort().join('|') === ls) || null;
}

/** el id de Reels de un short del archivo (como `armarHoy()` de reels.jsx): `ul-<evento>-<n>` */
export const ridDe = (x) => 'ul-' + normN(x.ev).slice(0, 40) + '-' + x.k;

const RONDA = { octavos: 'Octavos', cuartos: 'Cuartos', semifinales: 'Semifinal', final: 'Final' };
/** «Final · PURISTAS DEL HIP HOP» */
export const tituloDe = (x) => [RONDA[String(x.ronda || '').toLowerCase()] || x.ronda, x.evento].filter(Boolean).join(' · ');
