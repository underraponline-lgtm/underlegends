// 🇬🇧 LA PÁGINA EN INGLÉS (18/11/2026). Dlx: «un empleador quiere ver la página… un link que muestre toda la página sin la
// intro, sin permisos de admin, y si todo o casi todo pudiera estar en inglés desde ese link». El link es
// `underlegends.pages.dev/en` (o `?lang=en` en cualquier dirección; `?lang=es` lo apaga): el script del principio
// (web/montar.py) deja `lg:lang`, salta la pantalla de carga, la bienvenida y el tutorial, y main.jsx baja ESTE módulo,
// que nadie más baja.
//
// 🔁 CÓMO: la página sigue escrita en castellano y esto la traduce mientras se dibuja. Mira el shadow root entero con un
// MutationObserver y cambia cada texto (y los `placeholder`, `title` y `aria-label`) por el de `ingles.json`, buscado por
// su CLAVE (`ingles_base.js`: los números y los nombres de la Liga son huecos). Un texto con « · » que no está entero se
// traduce por partes. Lo que no está en el diccionario queda como está: los anuncios de Discord, los nombres de los
// eventos y Lo nuevo siguen en castellano, y no es un error.
// ⚠️ React no relee el texto del DOM: si vuelve a escribir uno (un número que cambia), el observador lo traduce de nuevo.
// 🔧 Los textos que faltan los junta herramientas/textos_ingles.py, recorriendo la página publicada.
import DIC from './ingles.json';
import { nombresDe, normalizar, numeroIngles, rellenar, rxHuecos } from './ingles_base.js';

const ATRIBUTOS = ['placeholder', 'title', 'aria-label'];
const LETRA = /\p{L}/u;
const SOLO_NUMERO = /^[+#-]?\d{1,3}(\.\d{3})+$/;

export function ingles(sombra) {
  let rx = rxHuecos([]);
  // lo que se escribió en cada nodo: si el observador ve justo eso, es el eco de este mismo cambio
  const puesto = new WeakMap();

  const buscar = (t) => {
    const { k, h } = normalizar(t, rx);
    const v = DIC[k];
    return v == null ? null : rellenar(v, h);
  };
  /** El texto traducido, o `null` si no hay traducción. Se respetan los espacios de los bordes */
  const traducir = (crudo) => {
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(crudo);
    const t = m[2].replace(/\s+/g, ' ');
    if (!t) return null;
    if (!LETRA.test(t)) {
      // un número suelto con miles: 21.000 → 21,000
      if (!SOLO_NUMERO.test(t)) return null;
      const s = t.match(/^[+#-]?/)[0];
      return m[1] + s + numeroIngles(t.slice(s.length)) + m[3];
    }
    let v = buscar(t);
    if (v == null && t.includes(' · ')) {
      let alguna = false;
      const partes = t.split(' · ').map((p) => { const x = buscar(p); if (x != null) alguna = true; return x == null ? p : x; });
      if (alguna) v = partes.join(' · ');
    }
    return v == null ? null : m[1] + v + m[3];
  };
  const texto = (n) => {
    if (puesto.get(n) === n.nodeValue) return;
    const p = n.parentNode;
    if (!p || p.nodeName === 'STYLE' || p.nodeName === 'SCRIPT') return;
    const v = traducir(n.nodeValue);
    if (v != null && v !== n.nodeValue) { n.nodeValue = v; puesto.set(n, v); }
  };
  const enAtr = new WeakMap();
  const atributos = (el) => {
    if (!el.getAttribute) return;
    for (const a of ATRIBUTOS) {
      const x = el.getAttribute(a);
      const ya = enAtr.get(el) || {};
      if (!x || ya[a] === x) continue;
      const v = traducir(x);
      if (v != null && v !== x) { ya[a] = v; enAtr.set(el, ya); el.setAttribute(a, v); }
    }
  };
  // 📅 las iniciales de la semana (los calendarios de Eventos, el Inicio y el panel): letra por letra no se pueden traducir
  // —«M» es martes y miércoles—, así que se reconoce la fila entera, siete hijos seguidos «L M M J V S D»
  const SEMANA_ES = 'LMMJVSD', SEMANA_EN = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const semana = (el) => {
    const h = el.children;
    if (!h || h.length < 7) return;
    for (let i = 0; i + 7 <= h.length; i++) {
      let si = true;
      for (let j = 0; j < 7 && si; j++) si = h[i + j].childElementCount === 0 && h[i + j].textContent.trim() === SEMANA_ES[j];
      if (si) for (let j = 0; j < 7; j++) h[i + j].textContent = SEMANA_EN[j];
    }
  };
  const pasar = (raiz) => {
    if (raiz.nodeType === 3) { texto(raiz); return; }
    if (raiz.nodeType === 1) { atributos(raiz); semana(raiz); }
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let x;
    while ((x = w.nextNode())) { if (x.nodeType === 3) texto(x); else { atributos(x); semana(x); } }
  };

  const obs = new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === 'characterData') texto(m.target);
      else if (m.type === 'attributes') atributos(m.target);
      else m.addedNodes.forEach(pasar);
    }
  });
  obs.observe(sombra, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATRIBUTOS });
  pasar(sombra);

  // el título de la pestaña («Ranking · Liga Global de Freestyle»)
  const titulo = () => { const v = traducir(document.title); if (v != null && v !== document.title) document.title = v; };
  const tt = document.querySelector('title');
  if (tt) new MutationObserver(titulo).observe(tt, { childList: true, characterData: true, subtree: true });
  titulo();

  // 👤 los nombres de la Liga, del lobby: con ellos, «La Temporada de Valen» encuentra «La Temporada de {p}». Se vuelve a
  // pasar por toda la página cuando llegan
  fetch('/api/lobby', { headers: { accept: 'application/json' } }).then((r) => (r.ok ? r.json() : null)).then((L) => {
    if (!L) return;
    rx = rxHuecos(nombresDe(L));
    pasar(sombra);
  }).catch(() => {});
}
