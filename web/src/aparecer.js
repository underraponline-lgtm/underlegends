// ✨ LAS SECCIONES ENTRAN AL LLEGAR (25/11/2026). Dlx: «más animaciones en general… en cualquier parte de la página web».
// Cada `section.sec` que todavía está abajo, fuera de la pantalla, sube y aparece la primera vez que entra (una sola vez:
// volver a subir no la repite). Lo que ya se ve al cargar no se toca, así la página nunca arranca vacía. Con «Menos
// animaciones» o el movimiento reducido, nada. Al terminar se le sacan las clases: un `transform` que se queda puesto
// cambiaría a qué se pega lo que adentro va con `position: fixed`.
import { useEffect } from 'react';

const calma = () => {
  try { return document.documentElement.classList.contains('calma') || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return true; }
};

export function useAparecer() {
  useEffect(() => {
    const host = document.getElementById('inicio-nuevo');
    const raiz = host && host.shadowRoot;
    // ⚠️ con un navegador automático (las miniaturas de las páginas, los chequeos del tutorial) no: una captura de la página
    // entera las agarraría a mitad de aparecer
    if (navigator.webdriver) return undefined;
    if (!raiz || typeof IntersectionObserver === 'undefined' || typeof MutationObserver === 'undefined') return undefined;
    const vistos = new WeakSet();
    const io = new IntersectionObserver((es) => {
      for (const e of es) {
        if (!e.isIntersecting) continue;
        const el = e.target;
        io.unobserve(el);
        el.classList.add('ap-in');
        const fin = () => { el.classList.remove('ap', 'ap-in'); el.removeEventListener('transitionend', fin); };
        el.addEventListener('transitionend', fin);
        setTimeout(fin, 900);
      }
    }, { rootMargin: '0px 0px -8% 0px' });
    const mirar = () => {
      if (calma()) return;
      const alto = window.innerHeight;
      raiz.querySelectorAll('section.sec').forEach((s) => {
        if (vistos.has(s)) return;
        vistos.add(s);
        if (s.getBoundingClientRect().top < alto) return; // ya se ve (o está arriba): no se esconde
        s.classList.add('ap');
        io.observe(s);
      });
    };
    let pedido = 0;
    const mo = new MutationObserver(() => { if (!pedido) pedido = requestAnimationFrame(() => { pedido = 0; mirar(); }); });
    mo.observe(raiz, { childList: true, subtree: true });
    mirar();
    return () => { mo.disconnect(); io.disconnect(); if (pedido) cancelAnimationFrame(pedido); };
  }, []);
}
