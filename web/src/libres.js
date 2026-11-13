// ⚔️ LAS BATALLAS LIBRES: el estado compartido. Vivía en panel.jsx; desde el 13/11/2026 lo usa también la campana
// (arriba.jsx, «Para hacer»: Dlx, «si alguien te reta que aparezca ahí»), que carga siempre, y panel.jsx se baja aparte.
// Una sola copia: lo que se contesta en un lado se ve en el otro
import { useEffect, useState } from 'react';

const W = typeof window !== 'undefined' ? window : {};

export const LB = { d: null, va: false, oyen: new Set() };
const avisarLB = () => LB.oyen.forEach((f) => f());
export function pedirLibres() {
  if (LB.va || !W.conCuenta) return;
  LB.va = true;
  W.conCuenta('/api/avisos/libres', {}).then((j) => { LB.va = false; if (j && j.ok) { LB.d = j; avisarLB(); } })
    .catch(() => { LB.va = false; });
}
export async function libreAccion(ruta, cuerpo) {
  const j = W.conCuenta ? await W.conCuenta('/api/avisos/' + ruta, cuerpo).catch(() => null) : null;
  if (j && j.ok) { LB.d = Object.assign({}, LB.d || {}, { libres: j.libres || [] }); avisarLB(); }
  return j;
}
export function useLibres(dc) {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!dc) return undefined;
    const f = () => setN((n) => n + 1);
    LB.oyen.add(f);
    if (!LB.d) pedirLibres();
    return () => { LB.oyen.delete(f); };
  }, [!!dc]); // eslint-disable-line react-hooks/exhaustive-deps
  return dc ? LB.d : null;
}
export const ERR_LIBRE = { ya: 'Ya tienes una batalla libre pendiente con esa persona.', muchas: 'Tienes 3 batallas libres pendientes: juega o cancela una.',
  hora: 'Esa hora ya no se puede: elige otra.', sin_perfil: 'Necesitas haber jugado para retar.', todavia: 'Todavía no es la hora de la batalla.' };
