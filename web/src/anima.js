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

// ↔️ LAS PESTAÑAS SE DESLIZAN HACIA DONDE FUISTE (Dlx, 18/10/2026: «ya se nota un poco más el tema de animaciones,
// pero creo que podrías hacerlo mejor, ¿no?»). `const ref = useDesliza(tab, ORDEN)` en lo que cambia con la pestaña:
// entra desde la derecha si elegiste una de más a la derecha, y al revés. Con 'carta', la tarjeta se da vuelta (como al
// abrir un sobre). ⚠️ SIN VOLVER A MONTAR NADA —la Web Animations API sobre el mismo elemento—: lo elegido adentro de
// la pestaña no se pierde, y sin `fill` no queda ningún `transform` puesto (lo `fixed` de adentro sigue en su lugar)
export function useDesliza(i, orden, como = 'lado') {
  const ref = useRef(null);
  const antes = useRef(i);
  useEffect(() => {
    const a = antes.current;
    antes.current = i;
    const el = ref.current;
    if (a === i || !el || !el.animate || quieto()) return;
    const pos = (x) => (orden ? orden.indexOf(x) : x);
    const d = typeof pos(i) === 'number' && typeof pos(a) === 'number' && pos(i) < pos(a) ? -1 : 1;
    const marcos = como === 'carta'
      ? [{ opacity: 0, rotate: 'y ' + d * 75 + 'deg', scale: '0.92' }, { opacity: 1, offset: 0.6 }, { opacity: 1, rotate: 'y 0deg', scale: '1' }]
      : [{ opacity: 0, transform: 'translateX(' + d * 32 + 'px)' }, { opacity: 1, transform: 'none' }];
    try { el.animate(marcos, { duration: como === 'carta' ? 480 : 320, easing: 'cubic-bezier(.2,.8,.2,1)' }); } catch (e) { /* sin animar */ }
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  return ref;
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

// 🎬 ¿la pantalla de carga sigue tapando la página? (Dlx, 18/10/2026: «carga demasiado rápido, al menos para mí, que
// no logro verlas»). Medido: al abrirse el corte, la entrada de las filas del ranking ya había terminado DETRÁS de la
// pantalla de carga (440 ms) y la de la página también. Mientras tapa, App.jsx pone `.app.tapado` y las animaciones
// esperan en pausa (vivo.css); arrancan cuando la pantalla se va (`lg-sale`, web/montar.py)
function tapadoAhora() {
  try {
    const c = document.documentElement.classList;
    return c.contains('ini-nuevo') && c.contains('lg-carga-js') && !c.contains('lg-sale');
  } catch (e) {
    return false;
  }
}
export function useTapado() {
  const [t, setT] = useState(tapadoAhora);
  useEffect(() => {
    if (!tapadoAhora()) { setT(false); return undefined; }
    let ob = null;
    try {
      // ⏱️ y un poco después de que arranca el corte (~0,4 s): destapa en diagonal en ~0,9 s, y lo de arriba sale último
      ob = new MutationObserver(() => { if (!tapadoAhora()) { if (ob) ob.disconnect(); setTimeout(() => setT(false), 400); } });
      ob.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    } catch (e) { setT(false); }
    return () => { if (ob) ob.disconnect(); };
  }, []);
  return t;
}
