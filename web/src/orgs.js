// 📣 SEGUIR A UN ORGANIZADOR (Dlx, 12/10/2026, «5. E»): «avisame cuando organice algo». La cuenta vive en el objeto
// (`seguirOrg()` de bot/avisos.js) y el aviso llega a la campana cuando el vigía ve su anuncio. Acá, una sola copia de
// a quiénes seguís para toda la página, que se pide una vez por sesión.
import { useEffect, useState } from 'react';

let lista = null;
let pidiendo = null;
const oyentes = new Set();
const avisar = () => oyentes.forEach((f) => f(lista));

/** La clave de un nombre, como `claveOrg()` del objeto (sin las letras de fantasía, que el objeto sí pasa a latinas). */
export function claveOrg(n) {
  return String(n || '').replace(/^[@!\s]+/, '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]/g, '').slice(0, 40);
}

async function pedir(cuerpo) {
  const r = await fetch('/api/avisos/seguir-org', { method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
  const j = await r.json().catch(() => ({}));
  if (r.ok && j.orgs) { lista = j.orgs; avisar(); }
  return r.ok ? '' : j.error || 'error';
}

/** `[{org, nombre}]` de quien entró con Discord, o `null` mientras no se sabe (o sin cuenta). */
export function useOrgs(dc) {
  const [v, setV] = useState(lista);
  useEffect(() => {
    oyentes.add(setV);
    if (dc && lista === null && !pidiendo) pidiendo = pedir({ accion: 'ver' }).finally(() => { pidiendo = null; });
    return () => { oyentes.delete(setV); };
  }, [dc && dc.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}

/** Seguir o dejar de seguir: `''` si salió, o el error (`sin_sesion`, `muchos`…). */
export function seguirOrg(nombre, si) { return pedir({ nombre, si }); }
