// 🔥 LA RACHA DIARIA Y LOS NIVELES (Dlx, 04/10/2026: «¿un daily streak? al conectarse en cualquier parte de la Liga
// Global» y «¿quizás hasta niveles? para ver qué tan antiguo eres»). La cuenta la hace el servidor (`rachaDe()` y
// `niveles()` en bot/avisos.js; las reglas, en bot/racha.py): acá sólo se pide y se muestra.
//
// ⚠️ PEDIR TU RACHA YA CUENTA EL DÍA: va con tu sesión y el Worker anota que entraste. Por eso se pide una vez al
// abrir la página y no en cada vista.
import { useEffect, useState } from 'react';

const W = typeof window !== 'undefined' ? window : {};

let pidiendo = null;
/** Tu racha y tu nivel (`W.RACHA`), o `null` si no entraste. Avisa `lg:racha` cuando llega */
export function pedirRacha() {
  if (pidiendo) return pidiendo;
  pidiendo = fetch('/api/avisos/racha', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((d) => {
      W.RACHA = d && d.racha && d.nivel ? d : null;
      pidiendo = null;
      try { W.dispatchEvent(new Event('lg:racha')); } catch (e) { /* sin aviso */ }
      return W.RACHA;
    });
  return pidiendo;
}

/** Tu racha, si `activo` (entraste con Discord). Se vuelve a pedir si cambia quién sos */
export function useRacha(activo) {
  const [d, setD] = useState(() => W.RACHA || null);
  useEffect(() => {
    if (!activo) return undefined;
    const f = () => setD(W.RACHA || null);
    const otra = () => { pedirRacha(); };
    W.addEventListener('lg:racha', f);
    W.addEventListener('lg:cuenta', otra);
    if (W.RACHA === undefined) pedirRacha(); else f();
    return () => { W.removeEventListener('lg:racha', f); W.removeEventListener('lg:cuenta', otra); };
  }, [activo]);
  return activo ? d : null;
}

let niveles = null, nivelesT = 0, nivelesP = null;
/** `{clave: [nivel, racha]}` de todos los perfiles, cinco minutos en memoria. Público: es por clave, nunca por cuenta */
export function useNiveles() {
  const [n, setN] = useState(niveles);
  useEffect(() => {
    if (niveles && Date.now() - nivelesT < 300000) return undefined;
    let vivo = true;
    nivelesP = nivelesP || fetch('/api/avisos/niveles').then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((d) => { nivelesP = null; if (d && d.n) { niveles = d.n; nivelesT = Date.now(); } return niveles; });
    nivelesP.then((x) => { if (vivo) setN(x); });
    return () => { vivo = false; };
  }, []);
  return n;
}
