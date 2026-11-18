// 🧩 LA CARTA VIVA: tu carta de verdad, dibujada en la página, a la que se le cambian las piezas (16/11/2026).
//
// Dlx: «cuando tú seleccionas algo en el inventario, un tag, ese tiene que cambiar de la tarjeta misma… previsualizar tu
// personaje completamente, como si estuviésemos cambiando la ropa a un personaje». Hasta la 5.72 el Inventario mostraba
// la IMAGEN de la carta y le pegaba encima una pastilla imitada: con un TAG pasaba, con un fondo, un efecto o una forma
// (lo que trae la Tienda) no hay cómo.
//
// Cómo: cada exportador deja al lado de la imagen la carta ARMABLE (`comun/armable.py`): el mismo HTML y CSS con que se
// sacó la foto, más cada variante de cada pieza ya dibujada por su generador (`comun/piezas.py`). Acá se carga en un
// iframe (el CSS de la carta usa `body`, `:root` y selectores de la hoja: adentro de un iframe vale igual que en el
// exportador y no se mezcla con el de la página) y se cambia el elemento `[data-pieza]` por la variante. Sale idéntica a
// /card porque es el mismo dibujo. La página no sabe dibujar ningún TAG: sólo los cambia.
//
// ⚠️ SIN ARMABLE TODAVÍA (la carta se dibujó antes del 16/11/2026, o no subió), va la imagen y la pieza no se ve
// cambiar: `estado` lo dice para que el Inventario avise. Cada carta la trae en su próximo dibujo.
import { useEffect, useRef, useState } from 'react';
import { Carta } from './piezas.jsx';
import { usePases } from './pase.js';
import { ConMarco } from './marcos.jsx';
import { ConEfecto, usePuesto } from './puesto.js';

const cache = new Map();

/** la dirección de la armable: la de la imagen con `.html` (y su misma versión `?v=`, así no se lee una vieja) */
function urlDe(liga, k, cual) {
  const u = liga.cartaUrl(k, cual);
  return u ? u.replace(/\.webp(\?|$)/, '.html$1') : null;
}

/** `{doc, w, h, piezas}` de la armable, `null` si no hay (todavía), `undefined` mientras se busca */
export function useArmable(liga, k, cual) {
  const url = k ? urlDe(liga, k, cual) : null;
  const [a, setA] = useState(() => (url && cache.has(url) && !(cache.get(url) instanceof Promise) ? cache.get(url) : undefined));
  useEffect(() => {
    if (!url) { setA(null); return undefined; }
    let vivo = true;
    const c = cache.get(url);
    if (c !== undefined && !(c instanceof Promise)) { setA(c); return undefined; }
    setA(undefined);
    const p = c instanceof Promise ? c : fetch(url).then((r) => (r.ok ? r.text() : null)).then((doc) => {
      if (!doc) return null;
      const m = doc.match(/name="carta" content="(\d+)x(\d+)"/);
      let piezas = {};
      try {
        const d = new DOMParser().parseFromString(doc, 'text/html');
        const s = d.querySelector('script.piezas');
        piezas = s ? JSON.parse(s.textContent) : {};
      } catch (e) { piezas = {}; }
      // ⚠️ sin los `onerror` de la carta (el respaldo de la foto en el exportador): el iframe no corre scripts —a
      // propósito, la carta trae nombres que escribió la gente— y cada uno dejaba un error en la consola. En la armable
      // la foto ya va adentro: no tiene cómo fallar
      return m ? { doc: doc.replace(/\son[a-z]+="[^"]*"/gi, ''), w: +m[1], h: +m[2], piezas } : null;
    }).catch(() => null).then((x) => { cache.set(url, x); return x; });
    cache.set(url, p);
    p.then((x) => { if (vivo) setA(x); });
    return () => { vivo = false; };
  }, [url]);
  return a;
}

const quieto = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Tu carta `cual`, viva, de `ancho` px de ancho. `piezas`: `{tag: llave}` (la llave del Inventario: el texto del
 * catálogo, `pase:<título>` o `auto`); lo que no viene queda como se dibujó. `marco` como en `Carta`. `onEstado`
 * recibe `'viva'` cuando la carta ya se puede vestir y `'imagen'` cuando no hay armable.
 */
// 🛍️ `efecto` (18/11/2026, el remake de la pestaña Cartas): el efecto de carta de la Tienda que se está probando, con
// `arte` (el de `pedirArte()`): un id, `''` para ninguno, o `undefined` para el que tiene puesto. Lo demás que tenga
// puesto (aro, nombre…) no cambia
export function CartaViva({ liga, k, cual, ancho, piezas = {}, marco, onEstado, cls = '', efecto, arte }) {
  const a = useArmable(liga, k, cual);
  const ifr = useRef(null);
  const [lista, setLista] = useState(false);
  const pub = usePases();
  // 🛍️ el efecto de carta de la Tienda (tanda 3), encima de la armable: sólo el efecto, la carta ya está abajo
  const PT0 = usePuesto(k);
  const PT = efecto === undefined ? PT0 : efecto && arte ? { t: Object.assign({}, PT0 ? PT0.t : {}, { carta: efecto }), A: arte } : null;
  useEffect(() => { setLista(false); }, [a]);
  useEffect(() => {
    if (onEstado) onEstado(a === undefined ? 'buscando' : a ? (lista ? 'viva' : 'buscando') : 'imagen');
  }, [a, lista]); // eslint-disable-line react-hooks/exhaustive-deps
  const tag = piezas.tag;
  // 👕 el cambio de ropa: cada pieza pedida reemplaza a la que está, con un destello para que se note
  useEffect(() => {
    const d = lista && ifr.current && ifr.current.contentDocument;
    if (!d || !a) return;
    for (const [tipo, llave] of Object.entries(piezas)) {
      if (llave == null) continue;
      const html = ((a.piezas || {})[tipo] || {})[llave];
      const el = d.querySelector('[data-pieza="' + tipo + '"]');
      if (!html || !el || el.dataset.llave === llave) continue;
      const t = d.createElement('template');
      t.innerHTML = html.trim();
      const nuevo = t.content.firstElementChild;
      if (!nuevo) continue;
      nuevo.dataset.llave = llave;
      el.replaceWith(nuevo);
      if (!quieto() && nuevo.animate) {
        nuevo.animate([{ filter: 'brightness(1.9)', scale: '1.12' }, { filter: 'brightness(1)', scale: '1' }],
          { duration: 420, easing: 'cubic-bezier(.23,1,.32,1)' });
      }
    }
  }, [lista, a, tag]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!a) {
    // todavía no (o nunca) hay armable: la imagen, para que no quede un hueco
    // ⚠️ del ancho pedido: suelta, la imagen sale a su tamaño (1200 px) y tapaba la página desde la barra de guardar
    return <span className={'cv cv-img ' + cls} style={{ width: ancho }}><Carta liga={liga} k={k} cual={cual} cls="cv-im" abre={false} marco={marco} /></span>;
  }
  const s = ancho / a.w;
  const caja = (
    <span className={'cv ' + cls} style={{ width: ancho, height: Math.round(a.h * s) }}>
      <iframe ref={ifr} title={'Tu carta de ' + cual} srcDoc={a.doc} sandbox="allow-same-origin" tabIndex={-1} aria-hidden="true"
        onLoad={() => setLista(true)} style={{ width: a.w, height: a.h, transform: 'scale(' + s + ')' }} />
      {!lista ? <Carta liga={liga} k={k} cual={cual} cls="cv-tapa" abre={false} /> : null}
    </span>
  );
  const mk = marco !== undefined ? marco : pub && pub.m && pub.m[k];
  const f = liga.T[k] || (liga.X && liga.X[k]) || {};
  const svc = f.sv && liga.svs && liga.svs[f.sv] ? liga.svs[f.sv].color : '';
  const conFx = <ConEfecto P={PT} src={liga.cartaUrl(k, cual) || ''} sinImg>{caja}</ConEfecto>;
  return mk ? <ConMarco m={mk} cual={cual} ancho={ancho} svColor={svc} cc={f.cc}>{conFx}</ConMarco> : conFx;
}
