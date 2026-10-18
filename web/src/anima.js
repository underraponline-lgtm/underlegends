// 🎞️ LO QUE SE MUEVE CON JS, Y CUÁNDO NO (Dlx, 18/10/2026: «asegúrate que haya más animaciones para que el ajuste de
// accesibilidad "menos animaciones" tenga sentido»). Todo lo que anima desde JS pregunta acá primero: con «Menos
// animaciones» (Mi cuenta → `html.calma`) o con la opción del celular (`prefers-reduced-motion`), llega quieto.
// Lo que se mueve con CSS se apaga en vivo.css (`.app.calma` y la media query, juntos).
import { useEffect, useRef, useState } from 'react';

export function quieto() {
  try {
    return document.documentElement.classList.contains('calma') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {
    return false;
  }
}

// 🔢 un número que llega contando (~0,7 s, frenando al final): de 0 la primera vez, y del anterior cuando cambia
export function useNumero(v, ms = 700) {
  const quieta = quieto();
  const [x, setX] = useState(() => (quieta || typeof v !== 'number' ? v : 0));
  const de = useRef(quieta || typeof v !== 'number' ? v : 0);
  useEffect(() => {
    if (typeof v !== 'number' || quieto()) {
      setX(v);
      de.current = v;
      return undefined;
    }
    const a = typeof de.current === 'number' ? de.current : 0;
    const t0 = performance.now();
    let id = 0;
    const paso = (t) => {
      const p = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      setX(Math.round(a + (v - a) * e));
      if (p < 1) id = requestAnimationFrame(paso);
      else de.current = v;
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [v, ms]);
  return x;
}

// el mismo número, como pieza: `<Numero v={1234} f={num} />`
export function Numero({ v, f }) {
  const x = useNumero(v);
  return f ? f(x) : x;
}

// 🧘 «Menos animaciones» de Mi cuenta (`lg:ajustes`.calma, que app.js también pone como `html.calma`): App.jsx se lo
// pasa a la raíz de la página (`.app.calma`), porque el CSS de acá vive en un shadow root y la clase de <html> no le
// llega. Se entera al momento: el evento `lg:ajustes` y la clase de <html>
function calmaAhora() {
  try {
    if (document.documentElement.classList.contains('calma')) return true;
    const aj = JSON.parse(localStorage.getItem('lg:ajustes') || 'null');
    return !!(aj && aj.calma);
  } catch (e) {
    return false;
  }
}
export function useCalma() {
  const [c, setC] = useState(calmaAhora);
  useEffect(() => {
    const mirar = () => setC(calmaAhora());
    window.addEventListener('lg:ajustes', mirar);
    let ob = null;
    try {
      ob = new MutationObserver(mirar);
      ob.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    } catch (e) { /* sin observador: queda el evento */ }
    return () => { window.removeEventListener('lg:ajustes', mirar); if (ob) ob.disconnect(); };
  }, []);
  return c;
}
