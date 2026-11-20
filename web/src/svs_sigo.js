// 🏟️ SEGUIR A UN SERVIDOR (20/11/2026, el plan de los tiers: «dale»): con tu cuenta, la campana te avisa cuando ese
// servidor anuncia un evento, en todos tus teléfonos vinculados y en la bandeja (`seguirSv()` de bot/avisos.js). Acá, una
// sola copia de los servidores que sigues para toda la página, que se pide una vez por sesión (como `orgs.js`).
import { useEffect, useState } from 'react';

let lista = null;
let pidiendo = null;
const oyentes = new Set();
const avisar = () => oyentes.forEach((f) => f(lista));

async function pedir(cuerpo) {
  const r = await fetch('/api/avisos/seguir-sv', { method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
  const j = await r.json().catch(() => ({}));
  if (r.ok && j.svs) { lista = j.svs; avisar(); }
  return r.ok && !j.error ? '' : j.error || 'error';
}

/** `['FFA', …]` de quien entró con Discord, o `null` mientras no se sabe (o sin cuenta). */
export function useSvsSigo(dc) {
  const [v, setV] = useState(lista);
  useEffect(() => {
    oyentes.add(setV);
    if (dc && lista === null && !pidiendo) pidiendo = pedir({ accion: 'ver' }).finally(() => { pidiendo = null; });
    return () => { oyentes.delete(setV); };
  }, [dc && dc.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}

/** Seguir o dejar de seguir: `''` si salió, o el error (`sin_sesion`, `muchos`…). */
export function seguirSv(sv, si) { return pedir({ sv, si }); }
