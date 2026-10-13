// 🏠 «TU SERVIDOR», EL QUE ELIGIÓ CADA UNO (Dlx, 12/10/2026: «quiero que quites de dónde son todos, o sea el servidor,
// a menos que eso lo hayan elegido»). Hasta acá la página nombraba a cada uno con el servidor donde más jugó (`sv` de
// los pools): en el perfil, en las filas del Ranking y en Tarjetas. Ahora sólo con el que eligió en Mi cuenta
// (`miServidor()` del objeto, público en `/api/avisos/servidores`: cuál eligió cada perfil, nunca quién es quién).
// ⚠️ La tarjeta de Servidor no cambia —mide donde jugó—, y los filtros por servidor tampoco: buscan a la gente de
// donde juega. Una copia para toda la página, cinco minutos.
import { useEffect, useState } from 'react';

let mapa = null, t = 0, pidiendo = null;
const oyentes = new Set();
function pedir() {
  if (pidiendo || (mapa && Date.now() - t < 300000)) return;
  pidiendo = fetch('/api/avisos/servidores', { headers: { accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null)
    .then((j) => {
      pidiendo = null;
      if (j && j.n && typeof j.n === 'object') { mapa = j.n; t = Date.now(); oyentes.forEach((f) => f(mapa)); }
    });
}

/** `{clave: sv}` de quienes eligieron su servidor, o `{}` mientras llega. */
export function useElegidos() {
  const [m, setM] = useState(mapa || {});
  useEffect(() => {
    oyentes.add(setM);
    pedir();
    return () => { oyentes.delete(setM); };
  }, []);
  return m;
}

/** El servidor que eligió `k`, si es uno de la Liga; si no eligió, ''. */
export const svElegido = (liga, m, k) => {
  const s = k && m ? m[k] : '';
  return s && liga && liga.svs && liga.svs[s] ? s : '';
};
