// 👏 LOS APLAUSOS, en un solo lugar: el estado lo tiene app.js (`APLAUSOS`, `felicitar()`), como el de las encuestas, y
// acá se lee. Lo usan Publicaciones y, desde el 18/10/2026, las historias (Dlx, a las ideas: «todas»: «reaccionar desde
// la historia y que le llegue a la persona, como Felicitar»). ⚠️ Cada publicación trae su `id` del muro (`id_de()` en
// bot/muro.py): es lo que se felicita, y el Worker lo busca ahí
import { useEffect, useState } from 'react';

function leerAplausos() {
  const A = window.APLAUSOS || {};
  // 🔥 `e`: cuántas de cada reacción que no es 👏, por publicación; `miE`: con cuál reaccionaste (sin fila = 👏)
  return { cu: A.cu || {}, e: A.e || {}, mios: A.mios || {}, miE: A.miE || {}, va: A.va || {}, err: A.err || {} };
}

export function useAplausos() {
  const [a, setA] = useState(leerAplausos);
  useEffect(() => {
    const f = () => setA(leerAplausos());
    // (sólo con la pestaña a la vista: oculta seguía pidiendo cada dos minutos, 10/11/2026)
    const pedir = () => { if (window.pedirAplausos && !document.hidden) window.pedirAplausos(); };
    window.addEventListener('lg:aplausos', f);
    pedir();
    // los de los demás, cada dos minutos mientras se mira (el borde guarda 30 s)
    const t = setInterval(pedir, 120000);
    return () => { window.removeEventListener('lg:aplausos', f); clearInterval(t); };
  }, []);
  return a;
}

/**
 * 🔥 Las reacciones de una publicación, de la más usada a la menos: `[[emoji, n], …]`. Las que no son 👏 vienen contadas
 * (`A.e`); el resto del total (`A.cu`) son 👏
 */
export function reaccionesDe(A, id) {
  if (!id) return [];
  const n = Number(A.cu[id] || 0);
  const otras = Object.entries(A.e[id] || {}).filter(([, x]) => x > 0);
  const base = Math.max(0, n - otras.reduce((s, [, x]) => s + x, 0));
  return (base ? [['👏', base]] : []).concat(otras).sort((a, b) => b[1] - a[1]);
}
/** 🔥 con cuál reaccionaste tú a esa publicación, o '' */
export function miReaccion(A, id) { return id && A.mios[id] ? A.miE[id] || '👏' : ''; }
