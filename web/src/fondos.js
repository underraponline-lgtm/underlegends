// 🖼️ LOS FONDOS APROBADOS (13/10/2026): `{clave: [url, en su perfil, de fondo de su página]}`, del objeto (`fondos()` en
// bot/avisos.js). Una vez por visita y con cinco minutos de borde, como los roles. Lo usan el perfil (la cabecera de cada
// uno) y la app (tu propia página, si lo elegiste). Ver `FondoCaja` en cuenta.jsx
import { useEffect, useState } from 'react';

let fondos = null, fondosT = 0, fondosP = null;

export function useFondos() {
  const [f, setF] = useState(fondos);
  useEffect(() => {
    if (fondos && Date.now() - fondosT < 300000) return undefined;
    let vivo = true;
    fondosP = fondosP || fetch('/api/avisos/fondos').then((x) => (x.ok ? x.json() : null)).catch(() => null)
      .then((d) => { fondosP = null; if (d && d.f) { fondos = d.f; fondosT = Date.now(); } return fondos; });
    fondosP.then((x) => { if (vivo) setF(x); });
    return () => { vivo = false; };
  }, []);
  return f;
}

// sólo direcciones del bucket de la Liga: un `url("…")` armado con otra cosa no entra al estilo
export const urlFondo = (u) => (/^https:\/\/pub-[a-z0-9]+\.r2\.dev\/fondos\/[a-f0-9]{24}\.(webp|jpg|png)$/.test(String(u || '')) ? 'url("' + u + '")' : '');
