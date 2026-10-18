// 👏 LOS APLAUSOS, en un solo lugar: el estado lo tiene app.js (`APLAUSOS`, `felicitar()`), como el de las encuestas, y
// acá se lee. Lo usan Publicaciones y, desde el 18/10/2026, las historias (Dlx, a las ideas: «todas»: «reaccionar desde
// la historia y que le llegue a la persona, como Felicitar»). ⚠️ Cada publicación trae su `id` del muro (`id_de()` en
// bot/muro.py): es lo que se felicita, y el Worker lo busca ahí
import { useEffect, useState } from 'react';

function leerAplausos() {
  const A = window.APLAUSOS || {};
  return { cu: A.cu || {}, mios: A.mios || {}, va: A.va || {}, err: A.err || {} };
}

export function useAplausos() {
  const [a, setA] = useState(leerAplausos);
  useEffect(() => {
    const f = () => setA(leerAplausos());
    const pedir = () => { if (window.pedirAplausos) window.pedirAplausos(); };
    window.addEventListener('lg:aplausos', f);
    pedir();
    // los de los demás, cada dos minutos mientras se mira (el borde guarda 30 s)
    const t = setInterval(pedir, 120000);
    return () => { window.removeEventListener('lg:aplausos', f); clearInterval(t); };
  }, []);
  return a;
}
