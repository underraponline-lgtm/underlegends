// 🧭 EL ÍNDICE PEGADO ARRIBA de las páginas largas del remake (la Guía, el Salón, servidor/país/crew): qué sección se
// está leyendo y cómo se llega a otra. UNO SOLO PARA TODAS (02/11/2026): las dos críticas del remake encontraron las
// mismas fallas en cada copia —en el celular el chip activo quedaba fuera de la tira, y la última sección no se marcaba
// nunca, ni tocándola— porque cada una usaba un IntersectionObserver con una franja fija, y una sección corta al final
// de la página no llega a cruzarla.
// - Activa = la última que empezó antes del tercio de arriba de la pantalla; al fondo de la página, la última.
// - Al tocar un chip se marca ése enseguida, y la lectura espera a que termine de bajar: si no, en el camino se prenden
//   todas las del medio y la que queda marcada es la de abajo.
// - El chip activo se acomoda en el medio de su tira, que se mueve de costado y nunca mueve la página.
// - QUÉ CHIPS HAY SE MIRA EN LA PÁGINA, después de dibujarla (como el IR A del Inicio): una sección que se apaga por no
//   tener datos, o que no ocupa nada (la de un servidor sin MES AWARDS), no lleva chip. `hay` es la lista de las que sí.
import { useEffect, useRef, useState } from 'react';

const raiz = () => { const h = document.getElementById('inicio-nuevo'); return h && h.shadowRoot; };
const presentes = (ids) => { const r = raiz(); return r ? ids.filter((id) => { const s = r.getElementById(id); return s && s.offsetHeight; }) : ids; };

// ids: los de las secciones en el DOM, en orden. margen: cuánto se deja arriba al bajar (lo que tapa el índice pegado)
export function useIndice(ids, margen = 64) {
  const [hay, setHay] = useState(ids);
  const [act, setAct] = useState(ids[0] || '');
  const fijo = useRef(0);
  const tira = useRef(null);
  // después de cada dibujo: llegan los datos y aparece (o se va) una sección
  useEffect(() => {
    const n = presentes(ids);
    if (n.join('|') !== hay.join('|')) setHay(n);
  });
  const clave = hay.join('|');
  useEffect(() => {
    let pedido = 0;
    const mirar = () => {
      pedido = 0;
      if (Date.now() < fijo.current) return;
      const r = raiz();
      const secs = r ? hay.map((id) => r.getElementById(id)).filter((s) => s && s.offsetHeight) : [];
      if (!secs.length) return;
      const linea = window.innerHeight * 0.3;
      let a = secs[0].id;
      secs.forEach((s) => { if (s.getBoundingClientRect().top <= linea) a = s.id; });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) a = secs[secs.length - 1].id;
      setAct(a);
    };
    const pedir = () => { if (!pedido) pedido = requestAnimationFrame(mirar); };
    // terminó de bajar adonde se tocó: desde acá vuelve a mandar la lectura (el tope de 1,5 s es para el navegador
    // que no avisa `scrollend`)
    const fin = () => { fijo.current = 0; };
    window.addEventListener('scroll', pedir, { passive: true });
    window.addEventListener('resize', pedir);
    window.addEventListener('scrollend', fin);
    pedir();
    return () => {
      window.removeEventListener('scroll', pedir);
      window.removeEventListener('resize', pedir);
      window.removeEventListener('scrollend', fin);
      if (pedido) cancelAnimationFrame(pedido);
    };
  }, [clave]);
  useEffect(() => {
    const t = tira.current;
    const b = t && t.querySelector('[aria-current="true"]');
    if (!b || t.scrollWidth <= t.clientWidth) return;
    const x = t.scrollLeft + b.getBoundingClientRect().left - t.getBoundingClientRect().left - (t.clientWidth - b.offsetWidth) / 2;
    t.scrollTo({ left: Math.max(0, x), behavior: 'smooth' });
  }, [act]);
  // `el`: una cosa de adentro de la sección (lo que encontró un buscador): baja hasta ella y marca su sección
  const ir = (id, el) => {
    const r = raiz();
    const s = r && r.getElementById(id);
    if (!s) return;
    fijo.current = Date.now() + 1500;
    setAct(id);
    const a = el || s;
    window.scrollTo({ top: a.getBoundingClientRect().top + window.scrollY - margen - (el ? 24 : 0), behavior: 'smooth' });
  };
  return { act, ir, tira, hay };
}
