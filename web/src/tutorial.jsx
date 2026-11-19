// 🧭 EL TUTORIAL. Nació el 12/10/2026 (Dlx: «A pero que no sea necesariamente con jugar tu primer evento… B me gusta, C me
// gusta pero que sea lo que B no mostró, D me gusta así atrapamos la atracción, E. Dale») y se rehízo el 13/11/2026, con el
// Inicio nuevo (Dlx: «remakear también el tutorial para nuevos usuarios… no solo en el inicio sino en general… un tutorial
// corto y la opción de tener un tutorial más completo»; a la maqueta: el corto da 3 Dragón Drops, el completo 1 cofre, los
// dos si estás vinculado —si no, «te esperan»—, y «el completo en la guía tmb»). Quién es nuevo y lo que se cuenta, en
// primera.js; qué señala cada paso, en capitulos.js; acá lo que se dibuja:
//
//   A · `PrimerosPasos`: una lista que se tilda sola, en la Guía (y en el Inicio pasada la primera semana)
//   B · `Recorrido`: elegir rápido o completo; el corto (cinco pasos en el Inicio) y cada capítulo del completo en su página
//   C · `NOTAS`: una línea la primera vez en una página que no tiene capítulo (las que lo tienen llevan su «¿Cómo funciona?»)
//   D · la franja: quien entra por un link (un perfil, una llave) ve primero eso, y arriba «¿primera vez?»
//   E · lo cuenta `contar()`, y lo muestra el Dashboard
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { num } from './liga.js';
import { Ico, accion } from './piezas.jsx';
import { usePase } from './pase.js';
import { CAPITULOS, CORTO, capituloDe } from './capitulos.js';
import { pedirNuevo, txtPremio } from './nuevos.jsx';
import { LLEGADA, PRIMERA_VISITA, contar, enSemanaNueva, pedirRecorrido, reciente, tuto, tutoPoner } from './primera.js';

const W = typeof window !== 'undefined' ? window : {};
const leerLS = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };

// ── B · el recorrido ─────────────────────────────────────────────────────────────────────────────────────────────
// 🎯 LA MIRA (19/11/2026, Dlx: «se mueven las pantallas y todo eso pero selecciona más las cosas»). Medido paso por paso
// en los 32 del corto y los nueve capítulos: unos 30 señalaban una sección o una página entera —«Búscate» encendía
// 1345×3756 px, la tabla completa—, así que el velo no tenía nada que tapar y no se notaba qué se señalaba; tres no
// encontraban su marca en esa pantalla y la caja tapaba hasta un 31 % de lo señalado. Ahora:
//   · cada paso apunta a algo chico (capitulos.js) y puede traer una marca de repuesto (`sel: ['a', 'b']`)
//   · lo que es más alto que lo que queda libre se enciende sólo arriba, y nada de borde a borde
//   · el velo es un recorte (`clip-path` con un hueco) y cuatro esquinas se cierran sobre lo señalado; de un paso al
//     siguiente la luz se desliza (21st: «Product Tour» de laziekiki y «Focus Frame» de shadcnspace)
//   · la carta se mide y se pone donde no tapa lo señalado: en la compu, pegada a lo señalado con un pico que lo apunta
//     (la «A» de la maqueta; Dlx, 19/11/2026: «A»); en el celular, siempre abajo, encima de la barra
//   · 🧩 Y SE ACOPLA A UNA PÁGINA REHECHA (Dlx: «que se acople si actualizamos o remakeamos»): si la marca de un paso ya
//     no está, se enciende el título de esa página en vez de nada; `herramientas/tuto_medir.py` corre los dos tutoriales
//     después de cada despliegue (web.yml) y se pone rojo si un paso se queda sin marca, se corta o queda tapado

const seVe = (a) => { const r = a.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
const avisado = {};
/** Lo señalado: el primer `data-tuto` que se ve (el del menú de arriba en la compu, el de la barra en el celular). `sel`
 *  puede ser una lista: la primera marca que esté en la pantalla. Con `repuesto`, si no hay ninguna, el título de la
 *  página (una página rehecha que perdió la marca no deja el paso a ciegas; avisa en la consola) */
function blanco(raiz, sel, repuesto) {
  if (!raiz || !sel) return null;
  for (const s of [].concat(sel)) {
    const el = Array.from(raiz.querySelectorAll('[data-tuto="' + s + '"]')).find(seVe);
    if (el) return el;
  }
  if (!repuesto) return null;
  const h = Array.from(raiz.querySelectorAll('.app h1')).find(seVe) || null;
  if (h && !avisado[String(sel)]) {
    avisado[String(sel)] = 1;
    try { console.warn('[tutorial] no está la marca ' + [].concat(sel).join(' / ') + ': se señala el título de la página'); } catch (e) { /* nada */ }
  }
  return h;
}
/** ¿Va pegado a la pantalla (la cabecera, la barra de abajo)? Entonces correr la página no lo mueve. La barra de abajo
 *  del celular es `sticky` con `bottom`, no `fixed`: cuenta si ya está en la pantalla. Lo `sticky` de ARRIBA (la tira
 *  de días de Eventos, los filtros de Publicaciones) no: correr la página lo sube hasta que se pega, y sin correrla la
 *  carta de abajo lo tapaba entero */
function fijo(el) {
  const vh = W.innerHeight || 640;
  for (let x = el, i = 0; x && x.nodeType === 1 && i < 14; i++) {
    const cs = getComputedStyle(x);
    if (cs.position === 'fixed') return true;
    if (cs.position === 'sticky' && cs.bottom !== 'auto') { const r = el.getBoundingClientRect(); if (r.bottom > 0 && r.top < vh) return true; }
    x = x.parentElement || (x.getRootNode && x.getRootNode().host) || null;
  }
  return false;
}
/** La página que se ve, como la llama App.jsx ('' es el Inicio) */
const paginaVista = () => {
  const r = W.rutaLG ? W.rutaLG() : String(location.hash || '').replace(/^#\/?/, '');
  return String(r || '').split('?')[0].split('/')[0];
};
/** Ir a una página y esperar a que aparezca `sel` (hasta 3 s: si no aparece, la caja va al centro) */
function irYEsperar(ruta, sel, raiz, listo) {
  const pag = ruta.replace(/^#\/?/, '').split('/')[0];
  if (paginaVista() !== pag) location.hash = ruta;
  const t0 = Date.now();
  const mirar = () => {
    if ((paginaVista() === pag && blanco(raiz(), sel)) || Date.now() - t0 > 3000) { listo(); return; }
    setTimeout(mirar, 120);
  };
  setTimeout(mirar, 60);
}

const AIRE = 8;      // entre lo señalado y el borde de la luz
const ARRIBA = 72;   // lo que tapa la cabecera
// 🔍 LA PÁGINA AGRANDADA (19/11/2026). Desde 1440 px `.app` lleva `zoom` (1,1 · 1,2 · 1,35, ver vivo.css), y el tutorial
// vive adentro: lo que se mide (`getBoundingClientRect`, la ventana) viene en px de la pantalla y lo que se pone (`left`,
// `translate`, el recorte) se multiplica por el zoom. Sin pasar una cosa a la otra, a 1920 px la luz caía afuera de la
// pantalla en 19 de los 31 pasos (`tuto_medir.py`). Todo lo medido se divide por el zoom; lo que se corre, se multiplica
const zoomApp = () => {
  try {
    const a = document.getElementById('inicio-nuevo').shadowRoot.querySelector('.app');
    return parseFloat(getComputedStyle(a).zoom) || 1;
  } catch (e) { return 1; }
};
/** La pantalla en px de la página: { z, vw, vh } */
const geo = () => { const z = zoomApp(); return { z, vw: (W.innerWidth || 360) / z, vh: (W.innerHeight || 640) / z }; };
/** La caja de `el` en px de la página */
const cajaDe = (el, z) => {
  const r = el.getBoundingClientRect();
  return { left: r.left / z, top: r.top / z, right: r.right / z, bottom: r.bottom / z, width: r.width / z, height: r.height / z };
};
/** Si la luz se corta (lo señalado es más alto que lo que entra), se corta en el borde de una pieza de adentro —una
 *  fila, una tarjeta— y no por la mitad de una (la crítica del 19/11: «METRICOS» partido a la mitad) */
function corte(el, y1, yMax, z) {
  let mejor = 0, n = 0;
  const xs = el.querySelectorAll(':scope > *, :scope > * > *, :scope > * > * > *');
  for (const c of xs) {
    if (++n > 400) break;
    const b = c.getBoundingClientRect().bottom / z + AIRE;
    if (b <= yMax && b > mejor) mejor = b;
  }
  return mejor > y1 + 0.55 * (yMax - y1) ? mejor : yMax;
}
/** La luz sobre `el`: con su aire, adentro de la pantalla y, si es más alto que `maxH` o pasa de `fondo` (donde empieza
 *  la carta), sólo su parte de arriba */
function luzDe(el, vw, vh, maxH, fondo, z) {
  const r = cajaDe(el, z);
  const x1 = Math.max(6, r.left - AIRE), x2 = Math.min(vw - 6, r.right + AIRE);
  const y1 = Math.max(6, r.top - AIRE);
  const tope = Math.min(vh - 6, fondo || vh, y1 + Math.max(64, maxH));
  const y2 = r.bottom + AIRE <= tope ? r.bottom + AIRE : corte(el, y1, tope, z);
  if (x2 - x1 < 8 || y2 - y1 < 8) return null;
  return { x: Math.round(x1), y: Math.round(y1), w: Math.round(x2 - x1), h: Math.round(y2 - y1) };
}
const entre = (v, a, b) => Math.min(Math.max(v, a), Math.max(a, b));
/** A · dónde va la carta: abajo, arriba o al costado de la luz, sin taparla; si no entra en ningún lado, del otro lado */
function lugarA(luz, cw, ch, vw, vh) {
  const g = 16;
  const cx = luz.x + luz.w / 2, cy = luz.y + luz.h / 2;
  const left = Math.round(entre(cx - cw / 2, 12, vw - cw - 12));
  const pX = Math.round(entre(cx - left, 22, cw - 22));
  if (luz.y + luz.h + g + ch <= vh - 12) return { left, top: luz.y + luz.h + g, lado: 'abajo', pico: pX };
  if (luz.y - g - ch >= 12) return { left, top: luz.y - g - ch, lado: 'arriba', pico: pX };
  const top = Math.round(entre(cy - ch / 2, 12, vh - ch - 12));
  const pY = Math.round(entre(cy - top, 22, ch - 22));
  if (luz.x + luz.w + g + cw <= vw - 12) return { left: luz.x + luz.w + g, top, lado: 'der', pico: pY };
  if (luz.x - g - cw >= 12) return { left: luz.x - g - cw, top, lado: 'izq', pico: pY };
  return { left: Math.round((vw - cw) / 2), top: cy > vh / 2 ? 12 : vh - ch - 12, lado: 'hoja', pico: 0 };
}
const px = (x, y) => x + 'px ' + y + 'px';
/** El velo con un hueco: los mismos puntos siempre (sin luz, un hueco de 0 al medio), así de un paso al otro se desliza */
const recorte = (h) => 'polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ' + px(h.x, h.y) + ', ' + px(h.x + h.w, h.y) + ', '
  + px(h.x + h.w, h.y + h.h) + ', ' + px(h.x, h.y + h.h) + ', ' + px(h.x, h.y) + ')';
/** El marco fino alrededor del hueco: sobre una página negra el velo oscurece negro sobre negro y, sin él, sólo las
 *  esquinas decían qué estaba señalado (medido: brillo 12 adentro y 6 afuera). Un anillo de 1,5 px con el mismo truco */
const anillo = (h) => {
  const a = h.x - 1.5, b = h.y - 1.5, c = h.x + h.w + 1.5, d = h.y + h.h + 1.5;
  return 'polygon(evenodd, ' + px(a, b) + ', ' + px(c, b) + ', ' + px(c, d) + ', ' + px(a, d) + ', ' + px(a, b) + ', '
    + px(h.x, h.y) + ', ' + px(h.x + h.w, h.y) + ', ' + px(h.x + h.w, h.y + h.h) + ', ' + px(h.x, h.y + h.h) + ', ' + px(h.x, h.y) + ')';
};
/** La barra de abajo del celular, si se ve: la carta va encima de ella y nunca salta arriba */
function altoBarra(raiz, z) {
  const b = raiz && raiz.querySelector('.tabbar');
  if (!b) return 0;
  const r = b.getBoundingClientRect();
  return r.height > 0 && r.bottom >= (W.innerHeight || 640) - 2 ? Math.round(r.height / z) : 0;
}

function Foco({ paso, n, de, onSig, onAtras, onSaltar, ultimo, txtUltimo }) {
  const [luz, setLuz] = useState(null);
  const [bar, setBar] = useState(0);
  const [tam, setTam] = useState({ w: 360, h: 230 });
  const [anda, setAnda] = useState(false);   // sin transición hasta la primera luz: las esquinas no vuelan desde 0,0
  const yo = useRef(null);
  const carta = useRef(null);
  const sig = useRef(null);
  const cb = useRef({});
  cb.current = { onSig, onAtras, onSaltar, n };
  const { vw, vh } = geo();
  const cel = vw < 700;
  // 📱 en el celular la carta va SIEMPRE abajo (la crítica del 19/11: con la carta al lado, «Siguiente» saltaba de 489 a
  // 721 y a 264 px entre un paso y otro): el pulgar no la persigue
  const ancho = cel ? vw : Math.min(380, vw - 24);
  const tamR = useRef(tam);
  tamR.current = tam;
  const barR = useRef(bar);
  barR.current = bar;
  // lo que la carta le quita a la pantalla: lo señalado tiene que entrar en lo que queda. En la compu la carta va al
  // costado si entra; si lo señalado es ancho, va abajo o arriba y se le guarda su lugar
  const ancha = (r) => { const g = geo(); return !!r && r.width > g.vw - (g.vw < 700 ? g.vw : Math.min(380, g.vw - 24)) - 64; };
  const reservaDe = (r) => {
    const h = tamR.current.h;
    if (geo().vw < 700) return h + barR.current + 28;
    return ancha(r) ? h + 30 : 16;
  };
  // y la luz nunca es enorme: a lo sumo un 42 % de la pantalla en el celular y la mitad en la compu
  const topeDe = (r) => {
    const g = geo(), c = g.vw < 700;
    return Math.max(80, Math.min(Math.round(g.vh * (c ? 0.42 : 0.5)), c || ancha(r) ? g.vh - ARRIBA - reservaDe(r) : g.vh));
  };
  const raizDe = () => (yo.current ? yo.current.getRootNode() : null);
  const quieto = () => !!((W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches) || (yo.current && yo.current.closest('.calma')));
  const medir = useCallback(() => {
    const raiz = raizDe();
    const { z, vw: V, vh: H } = geo();
    const b = V < 700 ? altoBarra(raiz, z) : 0;
    if (b !== barR.current) { barR.current = b; setBar(b); }
    const el = blanco(raiz, paso.sel, true);
    if (!el) { setLuz(null); return; }
    // en el celular, con la carta abajo, lo que se corre con la página se enciende hasta su borde (al final de una
    // página no hay cómo subirlo más); lo pegado a la pantalla (la barra) no: la carta va encima de ella
    const fondo = V < 700 && !fijo(el) ? H - tamR.current.h - b - 28 : 0;
    setLuz(luzDe(el, V, H, topeDe(cajaDe(el, z)), fondo, z));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso]);
  /** Lo señalado a la vista, en lo que la carta deja libre: la tira de abajo se corre ella, y lo que va pegado a la
   *  pantalla no se toca. Se llama dos veces: la página a veces crece después de llegar (lo que baja de a poco) */
  const aLaVista = () => {
    const el = blanco(raizDe(), paso.sel, true);
    if (!el) return;
    const tira = el.closest('.tb-tira');
    if (tira) { tira.scrollLeft = Math.max(0, el.offsetLeft - (tira.clientWidth - el.offsetWidth) / 2); return; }
    if (fijo(el)) return;
    const { z, vh: H } = geo();
    const r = cajaDe(el, z);
    const abajo = H - reservaDe(r);
    const libre = abajo - ARRIBA;
    const alto = Math.min(r.height + 2 * AIRE, topeDe(r));
    if (r.top - AIRE < ARRIBA - 2 || r.top - AIRE + alto > abajo + 2) {
      const y = alto <= libre ? ARRIBA + (libre - alto) / 2 : ARRIBA;
      // (lo que se corre, en px de la pantalla)
      W.scrollBy({ top: Math.round((r.top - AIRE - y) * z), behavior: quieto() ? 'auto' : 'smooth' });
    }
  };
  // la carta mide lo que mide su texto
  useLayoutEffect(() => {
    const c = carta.current;
    if (!c) return undefined;
    const f = () => {
      const r = cajaDe(c, zoomApp());
      setTam((t) => (Math.abs(t.h - r.height) > 1 || Math.abs(t.w - r.width) > 1 ? { w: r.width, h: r.height } : t));
    };
    f();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(f);
    ro.observe(c);
    return () => ro.disconnect();
  }, []);
  // al cambiar de paso: a la vista, y otra vez a los 0,7 s por si la página creció
  useLayoutEffect(() => {
    medir();
    aLaVista();
    medir();
    const t1 = setTimeout(medir, 380), t2 = setTimeout(() => { aLaVista(); medir(); }, 720), t3 = setTimeout(medir, 1150);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso, medir]);
  // 🐢 una página que llega tarde (la Tienda, con una conexión lenta): mientras no hay luz se sigue buscando lo señalado,
  // cada 0,4 s y hasta 6 s; antes el paso quedaba con la carta al medio aunque la pieza apareciera un segundo después
  useEffect(() => {
    if (luz) return undefined;
    let k = 0;
    const t = setInterval(() => {
      if (++k > 15) { clearInterval(t); return; }
      if (blanco(raizDe(), paso.sel, true)) { clearInterval(t); aLaVista(); medir(); setTimeout(medir, 450); }
    }, 400);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [luz, paso, medir]);
  useEffect(() => {
    if (!luz || anda) return undefined;
    const r = requestAnimationFrame(() => setAnda(true));
    return () => cancelAnimationFrame(r);
  }, [luz, anda]);
  useEffect(() => {
    W.addEventListener('resize', medir);
    W.addEventListener('scroll', medir, { passive: true });
    return () => { W.removeEventListener('resize', medir); W.removeEventListener('scroll', medir); };
  }, [medir]);
  useEffect(() => { if (sig.current) sig.current.focus({ preventScroll: true }); }, [paso]);
  // ⌨️ Escape sale; las flechas pasan de paso (lo que se usa con el teclado no se anima de más: la luz tarda 0,28 s)
  useEffect(() => {
    const k = (e) => {
      const c = cb.current;
      if (e.key === 'Escape') c.onSaltar();
      else if (e.key === 'ArrowRight') { e.preventDefault(); c.onSig(); }
      else if (e.key === 'ArrowLeft' && c.n > 1) { e.preventDefault(); c.onAtras(); }
    };
    W.addEventListener('keydown', k);
    return () => W.removeEventListener('keydown', k);
  }, []);

  let est, lado = 'centro', pico = 0;
  if (cel) {
    // encima de la barra y con aire: si lo señalado es la barra, su luz sale 8 px por arriba
    est = { left: 0, width: vw, bottom: bar ? bar + AIRE + 4 : 0 };
    lado = 'dock';
  } else if (luz) {
    const L = lugarA(luz, ancho, tam.h, vw, vh);
    est = { left: L.left, top: L.top, width: ancho };
    lado = L.lado; pico = L.pico;
  } else est = { left: Math.round((vw - ancho) / 2), top: Math.round(Math.max(16, (vh - tam.h) / 2)), width: ancho };
  const hueco = luz || { x: Math.round(vw / 2), y: Math.round(vh / 2), w: 0, h: 0 };
  const esq = luz ? [['a', luz.x, luz.y], ['b', luz.x + luz.w, luz.y], ['c', luz.x, luz.y + luz.h], ['d', luz.x + luz.w, luz.y + luz.h]] : [];
  return (
    <div className={'rc' + (anda ? ' anda' : '')} ref={yo}>
      <div className="rc-tapa" />
      <div className="rc-velo" style={{ clipPath: recorte(hueco) }} />
      {luz ? <div className="rc-marco" style={{ clipPath: anillo(luz) }} /> : null}
      {esq.map(([k, x, y]) => <span key={k} className={'rc-esq ' + k} style={{ transform: 'translate(' + x + 'px,' + y + 'px)' }} aria-hidden="true"><i key={n} /></span>)}
      <div ref={carta} className={'rc-caja rc-paso l-' + lado} role="dialog" aria-modal="true" aria-labelledby="rc-h" style={est}>
        {lado === 'abajo' || lado === 'arriba' || lado === 'der' || lado === 'izq'
          ? <i className="rc-pico" style={lado === 'der' || lado === 'izq' ? { top: pico } : { left: pico }} aria-hidden="true" /> : null}
        <div className="rc-in" key={n}>
          <div className="rc-cab"><span className="rc-k">{paso.k}</span><small>{n} de {de}</small></div>
          <span className="rc-seg" aria-hidden="true">{Array.from({ length: de }, (_, j) => <i key={j} className={j < n ? 'si' : ''} />)}</span>
          <h2 id="rc-h">{paso.h}</h2>
          <p>{paso.p}</p>
        </div>
        <div className="rc-acc">
          <button type="button" className="btn chico rc-sig" ref={sig} onClick={onSig}>{ultimo ? txtUltimo : 'Siguiente'}</button>
          {n > 1 ? <button type="button" className="btn chico rc-atras" onClick={onAtras}>Atrás</button> : null}
          <button type="button" className="rc-saltar" onClick={onSaltar}>Saltar</button>
        </div>
      </div>
    </div>
  );
}

/** Una ventana al centro (elegir, y los finales) */
function Centro({ children, onCerrar, et }) {
  const yo = useRef(null);
  // ⌨️ el foco UNA vez, al abrir (18/11/2026): el efecto dependía de `onCerrar`, una flecha nueva en cada dibujo, y cada
  // redibujo de App (el reloj, cada 60 s) devolvía el foco a «Rápido»: quien iba con Tab en «Completo» o «Ahora no» elegía
  // otra cosa con Enter. El Escape lee la última `onCerrar` de la ref
  const cb = useRef(onCerrar);
  cb.current = onCerrar;
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') cb.current(); };
    W.addEventListener('keydown', k);
    // el foco, en lo principal (no en la ✕ de arriba)
    const b = yo.current && (yo.current.querySelector('.rc-acc .btn, .rc-op') || yo.current.querySelector('button, a'));
    if (b) b.focus({ preventScroll: true });
    return () => W.removeEventListener('keydown', k);
  }, []);
  return (
    <div className="rc anda">
      <div className="rc-velo" />
      <div className="rc-caja rc-centro" role="dialog" aria-modal="true" aria-labelledby="rc-h" ref={yo}>
        <div className="rc-cab"><span className="rc-k">{et}</span>
          <button type="button" className="btn-ico rc-x" aria-label="Cerrar" onClick={onCerrar}><Ico n="cerrar" t={18} /></button></div>
        {children}
      </div>
    </div>
  );
}

/** Los drops que esperan, con candado si no está vinculado */
function Huevos({ n, cofre, lock }) {
  return (
    <span className="rc-huevos" aria-hidden="true">
      {Array.from({ length: n }, (_, j) => <i key={j} className={(cofre ? 'cofre' : '') + (lock ? ' lock' : '')}>{lock ? <Ico n="candado" t={13} /> : null}</i>)}
    </span>
  );
}

/**
 * El recorrido entero. `inicio`: 'elegir', 'corto' o 'cap:<id>'. Al terminar el corto o el último capítulo se avisa al
 * objeto (`pedirNuevo`), que paga si esa persona tiene la pista de nuevos; la ventana del final dice lo que pasó de verdad
 */
function Recorrido({ liga, dc, inicio, onCerrar }) {
  const [modo, setModo] = useState(null);   // 'elegir' | 'corto' | 'cap' | 'fin' | 'espera'
  const [cap, setCap] = useState(null);
  const [i, setI] = useState(0);
  const [fin, setFin] = useState(null);     // { que: 'corto' | 'cap' | 'completo', premio: bool | null | 'espera' | 'dia:<n>' }
  const raiz = useRef(null);
  const c = liga.d.comunidad || {};
  const deRaiz = () => (raiz.current ? raiz.current.getRootNode() : null);
  // 🧷 el paso del corto, el MISMO objeto entre dibujos (18/11/2026): sin cuenta, el paso con `pSin` se armaba nuevo en
  // cada render, y los efectos `[paso]` de Foco volvían a poner el foco en «Siguiente» (y a medir y correr la página) con
  // cada redibujo de App, como mínimo cada 60 s
  const conCuenta = !!dc;
  const pasoCorto = useMemo(() => {
    const p = CORTO[i];
    return p && !conCuenta && p.pSin ? Object.assign({}, p, { p: p.pSin }) : p;
  }, [i, conCuenta]);

  const empezarCorto = useCallback(() => {
    setModo('espera');
    irYEsperar('#/', CORTO[0].sel, deRaiz, () => { setI(0); setModo('corto'); contar('tour'); });
  }, []);
  const empezarCap = useCallback((id) => {
    const C = CAPITULOS.find((x) => x.id === id);
    if (!C) { onCerrar('salto', 0); return; }
    setModo('espera');
    irYEsperar(C.ruta, C.pasos[0].sel, deRaiz, () => { setCap(C); setI(0); setModo('cap'); contar('cap_' + C.id); });
  }, [onCerrar]);
  useEffect(() => {
    if (inicio === 'corto') empezarCorto();
    else if (String(inicio).startsWith('cap:')) empezarCap(String(inicio).slice(4));
    else setModo('elegir');
  }, [inicio, empezarCorto, empezarCap]);

  // ¿cobró? Se le pregunta al objeto (sólo con cuenta); sin cuenta, lo que dice este navegador
  // 💰 «se pagó EN ESTE PEDIDO» (`pista.recien.mis`), no «la misión está hecha» (18/11/2026): con `m.ok`, repetir el corto
  // desde la Guía volvía a decir «Te ganaste 3 Dragón Drops» (se pagan una vez), y el completo terminado antes del día 7
  // (su misión es del día 7, que todavía no se abrió) no decía nada del Cajón prometido. Ese caso es `'dia:<n>'`
  const cobrar = (que, id) => {
    const ok = (D) => {
      const P = D && D.pista;
      if (!P) return false;
      if (((P.recien || {}).mis || []).includes(id)) return true;
      const dia = (P.dias || []).find((x) => (x.mis || []).some((m) => m.id === id));
      if (dia && !dia.abierto && !P.fin) return 'dia:' + dia.n;
      return false;
    };
    setFin({ que, premio: dc ? null : (enSemanaNueva() ? 'espera' : false) });
    setModo('fin');
    if (dc) pedirNuevo(dc, true).then((D) => setFin({ que, premio: ok(D) }));
  };
  const terminarCorto = () => {
    tutoPoner({ corto: 'fin', tour: 'fin' });
    contar('tour_fin');
    cobrar('corto', 'corto');
  };
  const terminarCap = () => {
    const T = tuto() || {};
    // ⚠️ ANTES de `tutoPoner()` (17/11/2026): `tuto()` es el mismo objeto que `tutoPoner()` cambia, así que leído después
    // `completo` ya era 1 y la tarjeta de «Terminaste el tutorial completo» no salía nunca (quedaba la del capítulo 9 de 9)
    const yaCompleto = !!T.completo;
    const caps = Object.assign({}, T.caps || {}, { [cap.id]: 1 });
    const todos = CAPITULOS.every((x) => caps[x.id]);
    tutoPoner(Object.assign({ caps }, todos ? { completo: 1 } : {}));
    if (todos && !yaCompleto) { contar('completo'); cobrar('completo', 'completo'); return; }
    setFin({ que: 'cap' }); setModo('fin');
  };
  const cerrar = (como) => onCerrar(como || 'salto', i + 1);

  let dentro = null;
  if (modo === 'elegir') {
    dentro = (
      <Centro et="BIENVENIDO" onCerrar={() => cerrar('salto')}>
        <h2 id="rc-h">¿Cómo quieres conocer la Liga?</h2>
        {/* 👥 `personas` es la gente de los servidores donde está el bot (18/11/2026): decía «21.387 raperos… compiten»,
            unas 26 veces los que compiten de verdad */}
        <p>{c.personas && c.servidores ? <>{num(c.personas)} personas en {num(c.servidores)} servidores de Discord, y un solo ranking. </> : null}
          Te lo mostramos sobre la página de verdad.</p>
        <div className="rc-ops">
          {/* 🎁 el premio, sólo si todavía no lo cobró este navegador (18/11/2026): se pagan una vez, y repetir el corto o el
              completo desde la Guía lo seguía prometiendo */}
          <button type="button" className="rc-op" onClick={empezarCorto}>
            <b>Rápido</b><span>Un minuto: cinco pasos acá en el Inicio.</span>
            <small>{enSemanaNueva() && (tuto() || {}).corto !== 'fin' ? 'Te llevas 3 Dragón Drops' : '5 pasos · 1 min'}</small></button>
          <button type="button" className="rc-op" onClick={() => { cerrar('completo'); location.hash = '#/guia'; setTimeout(() => W.dispatchEvent(new Event('lg:aprende')), 300); }}>
            <b>Completo</b><span>Nueve capítulos de un minuto, cada uno en su página.</span>
            <small>{enSemanaNueva() && !(tuto() || {}).completo ? 'Te llevas ' + txtPremio(['cofre', 0]) : '9 capítulos'}</small></button>
        </div>
        {/* 🎮 con la barra E (19/11/2026) ya no se desliza: cinco lugares abajo y el resto en el ☰ de arriba */}
        {(W.innerWidth || 0) < 900 ? <p className="rc-nota">Lo principal está en la barra de abajo; todo lo demás, en el ☰ de arriba.</p> : null}
        <div className="rc-acc"><button type="button" className="rc-saltar" onClick={() => cerrar('salto')}>Ahora no</button></div>
      </Centro>
    );
  } else if (modo === 'corto') {
    dentro = <Foco paso={pasoCorto} n={i + 1} de={CORTO.length} ultimo={i === CORTO.length - 1} txtUltimo="Terminar"
      onSig={() => (i === CORTO.length - 1 ? terminarCorto() : setI(i + 1))} onAtras={() => setI(Math.max(0, i - 1))} onSaltar={() => cerrar('salto')} />;
  } else if (modo === 'cap' && cap) {
    dentro = <Foco paso={cap.pasos[i]} n={i + 1} de={cap.pasos.length} ultimo={i === cap.pasos.length - 1} txtUltimo="Terminar"
      onSig={() => (i === cap.pasos.length - 1 ? terminarCap() : setI(i + 1))} onAtras={() => setI(Math.max(0, i - 1))} onSaltar={() => cerrar('salto')} />;
  } else if (modo === 'fin' && fin) {
    const sinCuenta = fin.premio === 'espera';
    const gano = fin.premio === true;
    // el día de la semana de nuevo en que se cobra (`'dia:<n>'`): hecho antes de que se abra su día
    const elDia = typeof fin.premio === 'string' && fin.premio.startsWith('dia:') ? fin.premio.slice(4) : null;
    if (fin.que === 'cap') {
      const T = tuto() || {};
      const hechos = CAPITULOS.filter((x) => (T.caps || {})[x.id]).length;
      const sigue = CAPITULOS.find((x) => !(T.caps || {})[x.id]);
      dentro = (
        <Centro et={'CAPÍTULO ' + (CAPITULOS.indexOf(cap) + 1) + ' DE ' + CAPITULOS.length} onCerrar={() => cerrar('fin')}>
          <h2 id="rc-h">{cap.t}: listo</h2>
          {/* sin la promesa si ya terminó los nueve antes y está repitiendo uno (18/11/2026) */}
          <p>Llevas {hechos} de {CAPITULOS.length}.{enSemanaNueva() && !T.completo ? ' Al terminar los nueve te llevas ' + txtPremio(['cofre', 0]) + '.' : ''}</p>
          <span className="rc-barra" aria-hidden="true"><i style={{ width: (100 * hechos) / CAPITULOS.length + '%' }} /></span>
          <div className="rc-acc">
            {sigue ? <button type="button" className="btn chico rc-sig" onClick={() => { setFin(null); empezarCap(sigue.id); }}>Siguiente: {sigue.t}</button> : null}
            <a className="btn chico rc-atras" href="#/guia" onClick={() => { cerrar('fin'); setTimeout(() => W.dispatchEvent(new Event('lg:aprende')), 300); }}>Los capítulos</a>
          </div>
        </Centro>
      );
    } else {
      const corto = fin.que === 'corto';
      dentro = (
        <Centro et={corto ? 'TUTORIAL CORTO · ' + CORTO.length + ' DE ' + CORTO.length : 'TUTORIAL COMPLETO'} onCerrar={() => cerrar('fin')}>
          <h2 id="rc-h">{corto ? 'Ya conoces la Liga' : 'Terminaste el tutorial completo'}</h2>
          {fin.premio === null ? <p>Un momento…</p>
            : gano ? <><p>Te ganaste {corto ? <b>3 Dragón Drops</b> : <b>{txtPremio(['cofre', 0])}</b>}: {corto ? 'ábrelos' : 'ábrelo'} cuando quieras.</p><Huevos n={corto ? 3 : 1} cofre={!corto} /></>
              : sinCuenta ? <><p>Te ganaste {corto ? <b>3 Dragón Drops</b> : <b>{txtPremio(['cofre', 0])}</b>}. Te esperan en cuanto vincules tu cuenta de Discord: es gratis y tarda diez segundos.</p>
                <Huevos n={corto ? 3 : 1} cofre={!corto} lock /></>
                : elDia ? <p>Quedó anotado: {corto ? <><b>3 Dragón Drops</b> se cobran</> : <><b>{txtPremio(['cofre', 0])}</b> se cobra</>} el día {elDia} de tu semana, cuando entres a la página.</p>
                : <p>{corto ? 'Ya sabes dónde está cada cosa.' : 'Ya pasaste por todas las páginas de la Liga.'} Lo que sigue: entra a un evento o sube el Pase con Tareas.</p>}
          <div className="rc-acc">
            {gano ? <button type="button" className="btn chico rc-sig" onClick={() => { cerrar('fin'); W.dispatchEvent(new Event('lg:abrir-drops')); }}>{corto ? 'Abrirlos' : 'Abrir el cofre'}</button>
              : sinCuenta ? <button type="button" className="btn chico rc-dc" onClick={() => { cerrar('fin'); accion.entrar(); }}>Vincular con Discord y recibirlos</button>
                : <button type="button" className="btn chico rc-sig" onClick={() => cerrar('fin')}>Listo</button>}
          </div>
          {corto ? (
            <p className="rc-mas">¿Quieres más? El <b>tutorial completo</b> son nueve capítulos de un minuto{enSemanaNueva() && !(tuto() || {}).completo ? <> y da <b>{txtPremio(['cofre', 0])}</b> al terminarlo</> : null}.{' '}
              <a href="#/guia" onClick={() => { cerrar('fin'); setTimeout(() => W.dispatchEvent(new Event('lg:aprende')), 300); }}>Ver los capítulos</a></p>
          ) : null}
        </Centro>
      );
    }
  }
  return <span ref={raiz} className="rc-raiz">{dentro}</span>;
}

// ── C · la primera vez en cada página que no tiene capítulo ───────────────────────────────────────────────────
// ⚠️ UN CONSEJO DE QUÉ HACER, NO QUÉ ES. Las páginas con capítulo (capitulos.js) llevan su «¿Cómo funciona?» en vez de esto
const NOTAS = {
  socios: '¿Tu servidor no está? Escríbele a @itsdlx en Discord.',
  r: 'Con «Seguir» te avisa cuando gana algo, y con el botón de compartir mandas su perfil.',
  llave: 'Si se está jugando, se actualiza sola: déjala abierta y mira quién pasa.',
  sv: 'En Eventos, en «Cuándo suele jugar», puedes seguir a sus organizadores: te avisa cuando anuncian.',
  pais: 'Los raperos de un país en la temporada, y cómo le va al país en el ranking mundial.',
};

// ── D · quien llega por un link ve primero eso; arriba, la invitación a mirar cómo funciona ──────────────────────
const FRANJA = {
  r: '¿Primera vez en la Liga? Así se consigue una tarjeta como ésta.',
  tarjetas: '¿Primera vez en la Liga? Así se consigue la tuya.',
  llave: '¿Primera vez en la Liga? Así funciona cada evento.',
};
// donde alguien vino a hacer algo puntual, no se le cruza nada
const SIN_FRANJA = { cuenta: 1, ajustes: 1, dashboard: 1, cambios: 1, guia: 1 };

/**
 * Lo del tutorial que vive en toda la página: el recorrido (solo la primera vez por el Inicio, o pedido), la franja de
 * quien llegó por un link y la nota de cada página. Va arriba del contenido, debajo de la cabecera. `pedido`:
 * `{n, que}` de App.jsx (cada pedido, un número nuevo)
 */
export function Tutorial({ liga, dc, pagina, sv, pedido }) {
  const T = tuto();
  const [abierto, setAbierto] = useState(null);
  const [franja, setFranja] = useState(() => !!(PRIMERA_VISITA && T && !T.tour && T.franja !== 'no' && LLEGADA
    && !SIN_FRANJA[LLEGADA]));
  const clave = sv ? 'sv' : pagina;
  const [nota, setNota] = useState(null);
  const enInicio = useRef(pagina === '');
  enInicio.current = pagina === '';

  // B · solo, una vez: la primera visita, entrando por el Inicio, después de que se vea la página
  useEffect(() => {
    if (!T || !T.nuevo || T.tour || !PRIMERA_VISITA || LLEGADA !== '') return undefined;
    // ⏳ y no ENCIMA de una historia o una tarjeta abierta (18/10/2026): espera a que la cierre
    const hayVentana = () => {
      try { return !!document.getElementById('inicio-nuevo').shadowRoot.querySelector('.hv-ov, .vc, [aria-modal="true"]'); } catch (e) { return false; }
    };
    let t = 0;
    const probar = () => {
      if (!enInicio.current || tuto().tour) return;
      if (hayVentana()) { t = setTimeout(probar, 1500); return; }
      setAbierto({ que: 'elegir', n: 0 });
    };
    t = setTimeout(probar, 1200);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // y pedido (la Guía, el «¿Cómo funciona?» de cada página, la pista de nuevos), las veces que se quiera
  useEffect(() => {
    if (!pedido || !pedido.n) return;
    setFranja(false); setAbierto({ que: pedido.que || 'elegir', n: pedido.n }); contar('repite');
  }, [pedido]);
  useEffect(() => { if (franja) contar('franja'); }, [franja]);
  // C · la nota, una vez por página: no mientras esté la franja (una sola invitación arriba) ni con el recorrido abierto
  useEffect(() => {
    const t = tuto();
    if (!t || !reciente() || !NOTAS[clave] || capituloDe(clave) || (t.notas || {})[clave] || franja) { setNota(null); return; }
    setNota(clave);
    tutoPoner({ notas: Object.assign({}, t.notas || {}, { [clave]: 1 }) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const cerrar = useCallback((como, n) => {
    setAbierto(null);
    const t = tuto();
    if (t && !t.tour) tutoPoner({ tour: como === 'fin' ? 'fin' : 'salto' });
    if (como === 'salto') contar('salta' + Math.min(4, n || 0));
  }, []);
  const verFranja = () => { setFranja(false); tutoPoner({ franja: 'no' }); contar('franja_si'); setAbierto({ que: 'elegir', n: -1 }); };
  const cerrarFranja = () => { setFranja(false); tutoPoner({ franja: 'no' }); };

  return (
    <>
      {franja && !abierto ? (
        <div className="rc-franja" role="region" aria-label="Primera vez">
          <p>{FRANJA[LLEGADA] || '¿Primera vez en la Liga? Mira cómo funciona.'}</p>
          <button type="button" className="btn verde chico" onClick={verFranja}>Ver cómo · 1 min</button>
          <button type="button" className="btn-ico rc-x" aria-label="Cerrar" onClick={cerrarFranja}><Ico n="cerrar" t={18} /></button>
        </div>
      ) : null}
      {nota && nota === clave && !abierto ? (
        <div className="rc-nota-p" role="note">
          <span className="rc-nota-t">PRIMERA VEZ ACÁ</span>
          <p>{NOTAS[nota]}</p>
          <button type="button" className="btn-ico rc-x" aria-label="Entendido" onClick={() => setNota(null)}><Ico n="cerrar" t={18} /></button>
        </div>
      ) : null}
      {abierto ? <Recorrido key={abierto.n} liga={liga} dc={dc} inicio={abierto.que} onCerrar={cerrar} /> : null}
    </>
  );
}

// ── el completo, en la Guía ───────────────────────────────────────────────────────────────────────────────────
/** «Aprende la Liga»: los nueve capítulos, con dónde quedaste */
export function Capitulos() {
  const [, setN] = useState(0);
  const yo = useRef(null);
  useEffect(() => {
    const ir = () => { if (yo.current) yo.current.scrollIntoView({ block: 'start', behavior: 'smooth' }); };
    W.addEventListener('lg:aprende', ir);
    const vuelve = () => setN((n) => n + 1);
    W.addEventListener('focus', vuelve);
    return () => { W.removeEventListener('lg:aprende', ir); W.removeEventListener('focus', vuelve); };
  }, []);
  const T = tuto() || {};
  const caps = T.caps || {};
  const hechos = CAPITULOS.filter((c) => caps[c.id]).length;
  const sigue = CAPITULOS.find((c) => !caps[c.id]);
  return (
    <div className="ap" ref={yo} id="aprende">
      <div className="ap-cab">
        <p>Nueve capítulos de un minuto. Cada uno te lleva a su página y te muestra lo que hay. Se guarda dónde quedaste.
          {enSemanaNueva() && !T.completo ? <> Al terminar los nueve te llevas <b>{txtPremio(['cofre', 0])}</b>.</> : null}</p>
        <span className="ap-av"><b>{hechos} de {CAPITULOS.length}</b><span className="rc-barra" aria-hidden="true"><i style={{ width: (100 * hechos) / CAPITULOS.length + '%' }} /></span></span>
        <button type="button" className="ap-corto" onClick={() => pedirRecorrido('corto')}>¿Apurado? El corto · 1 min</button>
      </div>
      <ol className="ap-l">
        {CAPITULOS.map((c, j) => {
          const ok = !!caps[c.id], ahora = sigue && sigue.id === c.id;
          return (
            <li key={c.id}>
              <button type="button" className={'ap-cap' + (ok ? ' hecho' : '') + (ahora ? ' sigue' : '')} onClick={() => pedirRecorrido('cap:' + c.id)}>
                <span className="ap-n">{j + 1}</span>
                <span className="ap-tx"><b>{c.t}</b><small>{c.d}</small>
                  <em>{ok ? <><Ico n="ok" t={13} /> Hecho</> : ahora ? 'Sigue acá' : 'Sin ver'} · {c.pasos.length} pasos · 1 min</em></span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ── A · primeros pasos ────────────────────────────────────────────────────────────────────────────────────────
/**
 * La lista que se tilda sola. `enGuia`: siempre, con «Ver el recorrido» y sin ✕; en el Inicio, hasta completarla o
 * cerrarla (`pasosEnInicio()` decide si se monta)
 */
export function PrimerosPasos({ liga, dc, enGuia }) {
  const [cerrado, setCerrado] = useState(false);
  const verificado = !!(dc && dc.rapero);
  const P = usePase(verificado, false);
  const nivel = P && P.listo ? P.nivel || 0 : 0;
  const pasos = [
    ['entrar', !!dc, 'Entra con Discord', 'Con tu cuenta: tu perfil, tus avisos, votar y seguir.',
      dc ? null : <button key="b" type="button" className="btn verde chico" onClick={accion.entrar}>Entrar</button>],
    ['verif', verificado, 'Verifícate', 'En Discord Rap Español, con tu país. Se abre tu tarjeta de Servidor.',
      <a key="b" className="btn verde chico" href="#/cuenta/verificar">Verificarme</a>],
    ['pase', nivel >= 1, 'Llega al nivel 1 del Pase', 'Dos Tareas del día o una de la semana, sin necesidad de jugar. Se abre tu tarjeta de Temporada.',
      <a key="b" className="btn verde chico" href="#/pase">Ver mis Tareas</a>],
    ['campana', !!leerLS('campana:activada'), 'Prende la campana', 'Te avisa al minuto cuando un servidor anuncia un evento.',
      <a key="b" className="btn verde chico" href="#/avisos">Activar</a>],
    // la lista entera (18/11/2026): `liga.sigue` deja afuera a quien no está en las 200 filas, y seguir sólo a alguien de
    // más abajo dejaba este paso sin tildar
    ['seguir', liga.sigueTodos.length > 0, 'Sigue a un rapero', 'Te avisa cuando gana algo.',
      <a key="b" className="btn verde chico" href="#/ranking">Ver el ranking</a>],
  ];
  const hechos = pasos.filter((p) => p[1]).length;
  const sigue = pasos.find((p) => !p[1]);
  const completo = hechos === pasos.length;
  useEffect(() => { if (!enGuia) contar('pasos'); }, [enGuia]);
  // ⚠️ en la Guía cuenta sólo si llegó hace poco: quien ya venía la ve completa y no la completó por el tutorial
  useEffect(() => {
    if (!completo) return;
    if (!enGuia || reciente()) contar('pasos_fin');
    if (!enGuia) tutoPoner({ pasos: 'fin' });
  }, [completo, enGuia]);
  if (cerrado) return null;
  // en la Guía va adentro de su sección «Cómo empezar», que ya trae el título
  const Raiz = enGuia ? 'div' : 'section';
  return (
    <Raiz className={'pp' + (enGuia ? ' pp-guia' : ' sec')} aria-labelledby={enGuia ? undefined : 'pp-h'}>
      <div className="pp-cab">
        <div>
          {enGuia ? null : <><span className="pp-k">PRIMEROS PASOS</span>
            <h2 id="pp-h">{completo ? 'Ya diste los primeros pasos' : 'Empieza por acá'}</h2></>}
          <small>{hechos} de {pasos.length}{completo ? ' · listo' : ''}</small>
        </div>
        {!enGuia ? <button type="button" className="btn-ico rc-x" aria-label="Cerrar los primeros pasos"
          onClick={() => { setCerrado(true); tutoPoner({ pasos: 'cerrado' }); }}><Ico n="cerrar" t={18} /></button> : null}
      </div>
      <span className="pp-barra" role="img" aria-label={hechos + ' de ' + pasos.length + ' pasos'}>
        {pasos.map((p) => <i key={p[0]} className={p[1] ? 'si' : ''} />)}
      </span>
      <ol className="pp-lista">
        {pasos.map(([id, ok, h, d, acc]) => (
          <li key={id} className={ok ? 'ok' : sigue && sigue[0] === id ? 'ahora' : ''}>
            <span className="pp-i">{ok ? <Ico n="ok" t={16} /> : null}</span>
            <span className="pp-t"><b>{h}</b><small>{d}</small></span>
            {!ok && sigue && sigue[0] === id ? acc : null}
          </li>
        ))}
      </ol>
      <p className="pp-pie">¿Y jugar? Cuando quieras: con una participación ya estás en el ranking. <a href="#/eventos">Ver los eventos</a>
        {enGuia ? <> · <button type="button" className="pp-rec" onClick={() => pedirRecorrido('corto')}>Ver el tutorial corto</button></> : null}</p>
    </Raiz>
  );
}
