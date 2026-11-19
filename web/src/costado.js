// 🖱️ LA RUEDA MUEVE LAS FILAS DE COSTADO EN LA COMPU (6.85; Dlx, 19/11/2026: «En pc no se puede scrollear… hay cosas q
// no se pueden ver»). Una fila que sólo se mueve de costado —el camino del Pase, las historias, una tira de chips o de
// cartas— no tenía cómo moverse con el mouse: la rueda baja la página y la barra está escondida o es un hilo. Medido en
// 24 páginas a 1333 px (herramientas: el `costado.py` de la sesión): seis filas así, y la rueda no movía ninguna.
//
// Ahora, con el mouse encima, la rueda la mueve de costado hasta la punta; en la punta sigue bajando la página, así no
// queda nadie atrapado. Con Shift, con Ctrl (el zoom) o con un trackpad que ya va de costado, el navegador hace lo suyo.
// ⚠️ UNA SOLA ESCUCHA PARA TODA LA PÁGINA, en `window`: el camino del evento (`composedPath()`) cruza el shadow root, y
// sirve también para las filas que vengan. Lo que maneja su propia rueda (un mapa, un zoom) llama a `preventDefault()`
// antes y acá se respeta
const DESLIZA = /auto|scroll/;
const juntado = new WeakMap();

// la fila de costado más cercana al mouse, o nada si antes aparece algo que baja por su cuenta (una lista con su scroll)
function filaDe(camino) {
  for (const el of camino) {
    if (el === document.body || el === document.documentElement || el === window) return null;
    if (!(el instanceof Element)) continue;                    // el shadow root, un texto
    const ancho = el.scrollWidth > el.clientWidth + 1;
    // ⚠️ unos píxeles de sobra para abajo no son «baja sola»: el camino del Pase sobra 1-2 px por el brillo del nivel que
    // sigue (`overflow-x:auto` vuelve `auto` también el vertical) y por eso la rueda no lo movía
    const alto = el.scrollHeight > el.clientHeight + 8;
    if (!ancho && !alto) continue;
    const cs = getComputedStyle(el);
    if (alto && DESLIZA.test(cs.overflowY)) return null;      // baja sola: la rueda es suya
    if (ancho && DESLIZA.test(cs.overflowX)) return el;
  }
  return null;
}

export function ruedaDeCostado() {
  if (typeof window === 'undefined' || typeof matchMedia !== 'function') return;
  const mouse = matchMedia('(hover: hover) and (pointer: fine)');
  window.addEventListener('wheel', (e) => {
    if (!mouse.matches || e.defaultPrevented || e.ctrlKey || e.shiftKey) return;
    if (!e.deltaY || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
    const el = filaDe(e.composedPath());
    if (!el) return;
    const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * el.clientWidth : e.deltaY;
    const max = el.scrollWidth - el.clientWidth;
    // en la punta, la rueda vuelve a ser de la página
    if ((d > 0 && el.scrollLeft >= max - 1) || (d < 0 && el.scrollLeft <= 1)) return;
    e.preventDefault();
    const iman = getComputedStyle(el).scrollSnapType;
    if (iman && iman !== 'none') {
      // 🧲 con imán, un paso chico vuelve a su lugar (un trackpad manda de a 4 px): se junta y se mueve de a un tramo
      const a = (juntado.get(el) || 0) + d;
      if (Math.abs(a) < 50) { juntado.set(el, a); return; }
      juntado.set(el, 0);
      el.scrollBy({ left: Math.sign(a) * Math.max(120, el.clientWidth * 0.6), behavior: 'smooth' });
      return;
    }
    el.scrollLeft += d;
  }, { passive: false });
}
