// 🎨 EL CSS DE CADA PÁGINA, CON SU PEDAZO (Dlx, 19/10/2026: «dale», a «partir el CSS por página»).
//
// vivo.css viajaba entero adentro del código del Inicio —306 KB sin comprimir— aunque la mitad fuera de páginas que se
// bajan aparte. Las reglas que usa UNA sola de esas páginas viven ahora en web/src/css/<página>.css, y la página las
// inyecta al bajarse llamando a esto en su primer renglón: así el Inicio baja ~91 KB menos de CSS y el celular procesa
// un tercio menos de reglas.
//
// ⚠️ VA JUSTO DESPUÉS DEL CSS DE TODOS, no al final: quedan antes de los `<style>` que dibuja cada componente (el Pase y
// el Dashboard traen el suyo así), como estaban en vivo.css, que se cargaba primero.
// ⚠️ Una vez por página: el pedazo puede bajarse de nuevo (otra ruta, otra exportación) y no se duplica.
// ⚠️ El de todos lo pone `cssBase()`, desde main.jsx: así este archivo va en el paquete de todos y no en un pedazo de
// 459 bytes que cada página pedía aparte.
export function cssBase(sombra, css) {
  const st = document.createElement('style');
  st.textContent = css;
  sombra.appendChild(st);
}

export function usarCss(id, css) {
  try {
    const host = document.getElementById('inicio-nuevo');
    const raiz = host && host.shadowRoot;
    if (!raiz || raiz.querySelector('style[data-css="' + id + '"]')) return;
    const st = document.createElement('style');
    st.dataset.css = id;
    st.textContent = css;
    const base = raiz.querySelector('style');
    // las de páginas, en el orden en que se bajaron, todas después del CSS de todos
    let ancla = base;
    while (ancla && ancla.nextSibling && ancla.nextSibling.nodeName === 'STYLE' && ancla.nextSibling.dataset && ancla.nextSibling.dataset.css) {
      ancla = ancla.nextSibling;
    }
    if (ancla && ancla.nextSibling) raiz.insertBefore(st, ancla.nextSibling); else raiz.appendChild(st);
  } catch (e) { /* sin shadow root: la página de respaldo no lo usa */ }
}
