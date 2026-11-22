// ❓ EL «¿CÓMO FUNCIONA?» DE CADA PÁGINA, Y EL AVISO DE QUE EL TUTORIAL ES NUEVO (13/11/2026). La maqueta del tutorial
// nuevo, tablero 7, y Dlx: «el completo en la guía tmb… y tmb un aviso chico porq cambió mucho». Va en toda la página y
// es liviano a propósito: no baja el tutorial (tutorial.jsx) hasta que alguien lo pide.
//   · en cada página con capítulo (capitulos.js), un botón chico arriba a la derecha: en una línea qué es la página, y el
//     capítulo entero. La primera vez lleva un punto magenta: reemplaza las notas de «Primera vez acá». Debajo de 760 px
//     (17/11/2026) ese botón no se dibuja y va un «?» redondo en la cabecera (`PreguntaCab`)
//   · en el Inicio, para quien ya venía antes del tutorial nuevo, una franja una sola vez: «la página cambió mucho»
import { useEffect, useRef, useState } from 'react';
import { Ico } from './piezas.jsx';
import { CAPITULOS, capituloDe } from './capitulos.js';
import { pedirRecorrido, tuto, tutoPoner } from './primera.js';

const W = typeof window !== 'undefined' ? window : {};
//: hasta cuándo sale el aviso a quien ya venía (un mes desde que salió)
const AVISO_HASTA = Date.parse('2026-12-14T05:00:00Z');

const aLaGuia = () => { location.hash = '#/guia'; setTimeout(() => W.dispatchEvent(new Event('lg:aprende')), 300); };

/** Lo que comparten el botón flotante y el de la cabecera: abrir y cerrar (afuera o con Escape), y el capítulo */
function useCF(pagina) {
  const C = capituloDe(pagina);
  const [abierto, setAbierto] = useState(false);
  const caja = useRef(null);
  useEffect(() => { setAbierto(false); }, [pagina]);
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { const p = e.composedPath ? e.composedPath() : []; if (caja.current && !p.includes(caja.current)) setAbierto(false); };
    const tecla = (e) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('pointerdown', fuera, true);
    W.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('pointerdown', fuera, true); W.removeEventListener('keydown', tecla); };
  }, [abierto]);
  return { C, abierto, setAbierto, caja };
}

/**
 * 📏 DEBAJO DE LA FILA DE PESTAÑAS (21/11/2026, la revisión de todos los botones). En el Ranking y en Tarjetas la fila de
 * pestañas (`.rk-subs`) es pegajosa y está por encima (z-index 20): tapaba este botón entero, no se veía, y tocarlo era
 * tocar «Misiones». Si la página tiene esa fila arriba, el botón baja su alto (`--cf-baja`). Se mira al cambiar de página
 * —la página llega después, perezosa: unas pocas veces en los primeros segundos— y la fila se sigue con un ResizeObserver,
 * porque cambia de alto con el ancho (dos líneas a 900 px)
 */
function useBajoLasPestanas(caja, pagina) {
  useEffect(() => {
    const el = caja.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const raiz = el.getRootNode();
    let ro = null, vista = null;
    const mirar = () => {
      const s = raiz && raiz.querySelector ? raiz.querySelector('.rk-subs') : null;
      if (s === vista) return;
      if (ro) ro.disconnect();
      ro = null;
      vista = s;
      if (!s) { el.style.removeProperty('--cf-baja'); el.classList.remove('en-banda'); return; }
      // 🎯 Y SI LA FILA TIENE LUGAR A LA DERECHA, ADENTRO DE ELLA (revisión 22/11/2026, G1#8): debajo, en Tarjetas caía justo sobre
      // la raya que abre «TEMPORADA». El botón es de la página, no de la sección: va en la banda negra, que ahí está vacía desde
      // x≈600. En el Ranking la fila llega al borde y el botón sigue debajo, como antes
      const medir = () => {
        el.style.setProperty('--cf-baja', s.offsetHeight + 'px');
        const q = el.querySelector('.cf-q');
        const fin = Math.max(0, ...[...s.querySelectorAll('a, button')].map((x) => x.getBoundingClientRect().right));
        el.classList.toggle('en-banda', !!q && s.offsetHeight <= 70 && fin + 24 < q.getBoundingClientRect().left);
      };
      ro = new ResizeObserver(medir);
      ro.observe(s);
    };
    mirar();
    const ts = [150, 600, 1500, 3500].map((ms) => setTimeout(mirar, ms));
    return () => { ts.forEach(clearTimeout); if (ro) ro.disconnect(); };
  }, [caja, pagina]);
}

/** La ventana chica: el capítulo en una línea, verlo, y todo el tutorial */
function PopCF({ C, hecho, cerrar }) {
  return (
    <div className="cf-pop" role="dialog" aria-label={'Cómo funciona: ' + C.t}>
      <span className="cf-k">{C.t.toUpperCase()} · EN UNA LÍNEA</span>
      <p>{C.linea}</p>
      <button type="button" className="cf-ver" onClick={() => { cerrar(); pedirRecorrido('cap:' + C.id); }}>
        <span>{hecho ? 'Ver el capítulo otra vez' : 'Ver el capítulo'}</span><small>{C.pasos.length} pasos · 1 min</small></button>
      <div className="cf-pie">
        <button type="button" onClick={() => { cerrar(); aLaGuia(); }}>Todo el tutorial · {CAPITULOS.length} capítulos</button>
      </div>
    </div>
  );
}

/**
 * 📱 EN EL TELÉFONO, UN «?» REDONDO EN LA CABECERA (17/11/2026, Dlx a la maqueta, «Tus elecciones»). Debajo de 760 px el
 * botón flotante tapaba títulos y pestañas (en /ranking caía debajo de «Competitivo» y no se podía tocar). La opción
 * aprobada era un «?» al lado del título de la página, pero cada página arma su título a su manera (`hero-ev`, `ta-h`,
 * `cu-h`, un `h1` suelto…, y el Pase cambia el suyo con tu nivel): colgarse de él no es confiable en las nueve. Va en la
 * cabecera, al lado de la lupa y la campana, que es la misma en todas. En la compu sigue el de siempre (`ComoFunciona`)
 */
export function PreguntaCab({ pagina }) {
  const { C, abierto, setAbierto, caja } = useCF(pagina);
  const [, setN] = useState(0);
  if (!C) return null;
  const T = tuto();
  const visto = !!(T && (T.cf || {})[C.id]);
  const hecho = !!(T && (T.caps || {})[C.id]);
  const abrir = () => {
    setAbierto((v) => !v);
    if (T && !visto) { tutoPoner({ cf: Object.assign({}, T.cf || {}, { [C.id]: 1 }) }); setN((n) => n + 1); }
  };
  return (
    <div className="cf-cab" ref={caja}>
      <button type="button" className={'btn-ico cf-cab-b' + (abierto ? ' on' : '')} aria-expanded={abierto} onClick={abrir}
        aria-label={'¿Cómo funciona ' + C.t + '?'} title="¿Cómo funciona?">
        <i aria-hidden="true">?</i>{!visto ? <span className="cf-pt" aria-label="nuevo" /> : null}</button>
      {abierto ? <PopCF C={C} hecho={hecho} cerrar={() => setAbierto(false)} /> : null}
    </div>
  );
}

export function ComoFunciona({ pagina }) {
  const { C, abierto, setAbierto, caja } = useCF(pagina);
  const [, setN] = useState(0);
  useBajoLasPestanas(caja, pagina);
  const T = tuto();
  // 📣 el aviso, en el Inicio, a quien ya venía: una sola vez
  const aviso = pagina === '' && T && !T.nuevo && !T.aviso_tuto && Date.now() < AVISO_HASTA;
  if (aviso) {
    const listo = (q) => { tutoPoner({ aviso_tuto: 1 }); setN((n) => n + 1); if (q === 'corto') pedirRecorrido('corto'); if (q === 'guia') aLaGuia(); };
    return (
      <div className="rc-franja cf-aviso" role="region" aria-label="El tutorial nuevo">
        <p><b>La página cambió mucho.</b> Mira cómo funciona ahora: un minuto en el Inicio, o los nueve capítulos de la Guía.</p>
        <button type="button" className="btn verde chico" onClick={() => listo('corto')}>Ver el corto · 1 min</button>
        <button type="button" className="btn borde2 chico cf-guia" onClick={() => listo('guia')}>Los capítulos</button>
        <button type="button" className="btn-ico rc-x" aria-label="Cerrar" onClick={() => listo()}><Ico n="cerrar" t={18} /></button>
      </div>
    );
  }
  if (!C) return null;
  const visto = !!(T && (T.cf || {})[C.id]);
  const hecho = !!(T && (T.caps || {})[C.id]);
  const abrir = () => {
    setAbierto((v) => !v);
    if (T && !visto) tutoPoner({ cf: Object.assign({}, T.cf || {}, { [C.id]: 1 }) });
  };
  return (
    <div className="cf" ref={caja}>
      <button type="button" className={'cf-q' + (abierto ? ' on' : '')} aria-expanded={abierto} onClick={abrir}>
        <i aria-hidden="true">?</i>¿Cómo funciona?{!visto ? <span className="cf-pt" aria-label="nuevo" /> : null}</button>
      {abierto ? <PopCF C={C} hecho={hecho} cerrar={() => setAbierto(false)} /> : null}
    </div>
  );
}
