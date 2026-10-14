// 🏷️ LOS ROLES DE CADA UNO (13/10/2026). Dlx: «en cada perfil aparezca el rol de cada uno… competidor, organizador,
// staff, o roles superiores ÚNICAMENTE decididos por mí: Moderador de la página web, asistente, Admin y owner
// únicamente yo», y «el título de socio para los owners de los servidores asociados». Los arma el objeto
// (`roles()` en bot/avisos.js): los que salen solos de Discord (`bot/roles.py`) y lo que pone o saca Dlx. Por clave de
// perfil, una vez por visita y con cinco minutos de borde, como los niveles (racha.js).
import { useEffect, useState } from 'react';

let roles = null, rolesT = 0, rolesP = null;

export function useRoles() {
  const [r, setR] = useState(roles);
  useEffect(() => {
    if (roles && Date.now() - rolesT < 300000) return undefined;
    let vivo = true;
    rolesP = rolesP || fetch('/api/avisos/roles').then((x) => (x.ok ? x.json() : null)).catch(() => null)
      .then((d) => { rolesP = null; if (d && d.r) { roles = d.r; rolesT = Date.now(); } return roles; });
    rolesP.then((x) => { if (vivo) setR(x); });
    return () => { vivo = false; };
  }, []);
  return r;
}

// cómo se llama cada uno, y si es de los que pone Dlx (van marcados)
export const ROL = {
  owner: ['Owner', true], admin: ['Admin', true], asistente: ['Asistente', true], moderador: ['Moderador de la página', true],
  socio: ['Socio', false], staff: ['Staff', false], organizador: ['Organizador', false], jurado: ['Jurado', false],
  host: ['Host', false], competidor: ['Competidor', false],
};

// «Organizador · FFA, DDF»; con más de dos servidores, cuántos (no sobrecargar el perfil)
export function textoRol([rol, svs]) {
  const n = (ROL[rol] || [rol])[0];
  if (!svs || !svs.length) return n;
  return n + ' · ' + (svs.length > 2 ? svs.length + ' servidores' : svs.join(', '));
}
