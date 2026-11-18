// 🫣 ¿LO QUE SE MUESTRA ABAJO SE VE DE VERDAD? (17/11/2026, la simulación de la semana de un nuevo con la 6.40). Los
// avisos cortos (`.nvt`, nuevos.jsx) y el globo «Desliza la barra» (abajo.jsx) se gastaban sin que nadie los viera: se
// anotaban como vistos al ponerlos en la fila, y salían debajo de la pantalla de carga, de la bienvenida, del final del
// tutorial, de la ventana de los drops o del «¡Subiste!» del Pase. Y el aviso, además, vivía adentro de `.pg-entra`: con
// `.app.tapado` su animación queda en pausa en `translateY(18px)`, un ancestro con `transform` es el que manda a un
// `position:fixed`, y el aviso caía en y≈5980 de un teléfono de 844. Ahora:
//   · `algoTapa()`: qué lo está tapando ('' si nada). Lo miran los dos antes de mostrarse y mientras se ven
//   · `capaFija()`: la capa donde se cuelgan, en la raíz del shadow root, fuera de toda animación y de todo `transform`
//   · `seVe()`: si lo que está en el centro de esa pieza es ella misma (lo que tapa sin estar en la lista)

/** ¿Sigue la pantalla de carga (`#lg-carga`, web/montar.py) delante de la página? */
export function cargaTapa() {
  try {
    const h = document.documentElement;
    if (!h.classList.contains('ini-nuevo') || h.classList.contains('lg-fuera')) return false;
    const c = document.getElementById('lg-carga');
    if (!c) return false;
    const cs = getComputedStyle(c);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05;
  } catch (e) {
    return false;
  }
}

//: lo que se pone delante de toda la página: la bienvenida y cualquier ventana modal (`aria-modal`), el tutorial (sus pasos
//: y su tarjeta final), los `<dialog>` abiertos (la ventana de los drops, el escenario, los momentos), el «¡Subiste!» del
//: Pase, las redes de la pista, una historia y una tarjeta abiertas
const DELANTE = ['.bv', '[aria-modal="true"]', '.rc-raiz > *', 'dialog[open]', '.ps-velo', '.nvp-velo', '.hv-ov', '.vc'];
const visible = (el) => { try { return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'; } catch (e) { return true; } };

/**
 * Qué tapa la página ahora: 'carga', 'tapado' (las animaciones esperan a que se vaya la carga), el selector de lo que está
 * delante, o '' si nada. `raiz`: el shadow root (o cualquier pieza de adentro). `mas`: otros selectores que también tapan
 */
export function algoTapa(raiz, mas) {
  if (cargaTapa()) return 'carga';
  const r = raiz && raiz.getRootNode ? raiz.getRootNode() : raiz;
  if (!r || !r.querySelector) return '';
  if (r.querySelector('.app.tapado')) return 'tapado';
  for (const s of DELANTE.concat(mas || [])) {
    const els = r.querySelectorAll(s);
    for (const el of els) if (visible(el)) return s;
  }
  return '';
}

/** ¿Lo que está en el centro de `el` es `el`? (lo tapa algo que no está en `DELANTE`) */
export function seVe(el) {
  try {
    const b = el.getBoundingClientRect();
    if (!b.width || !b.height || b.bottom <= 0 || b.top >= (window.innerHeight || 0)) return false;
    const r = el.getRootNode();
    const p = (r && r.elementFromPoint ? r : document).elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return !!p && (p === el || el.contains(p));
  } catch (e) {
    return true;
  }
}

/** La capa de lo que flota sobre la página, al final del shadow root (o del body): una sola, la crea quien llega primero */
export function capaFija(el) {
  const r = el && el.getRootNode ? el.getRootNode() : null;
  const casa = typeof ShadowRoot !== 'undefined' && r instanceof ShadowRoot ? r : document.body;
  let c = Array.from(casa.children || []).find((x) => x.classList && x.classList.contains('capa-fija'));
  if (!c) {
    c = document.createElement('div');
    c.className = 'capa-fija';
    casa.appendChild(c);
  }
  return c;
}
