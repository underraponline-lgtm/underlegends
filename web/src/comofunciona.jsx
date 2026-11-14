// ❓ EL «¿CÓMO FUNCIONA?» DE CADA PÁGINA, Y EL AVISO DE QUE EL TUTORIAL ES NUEVO (13/11/2026). La maqueta del tutorial
// nuevo, tablero 7, y Dlx: «el completo en la guía tmb… y tmb un aviso chico porq cambió mucho». Va en toda la página y
// es liviano a propósito: no baja el tutorial (tutorial.jsx) hasta que alguien lo pide.
//   · en cada página con capítulo (capitulos.js), un botón chico arriba a la derecha: en una línea qué es la página, y el
//     capítulo entero. La primera vez lleva un punto magenta: reemplaza las notas de «Primera vez acá»
//   · en el Inicio, para quien ya venía antes del tutorial nuevo, una franja una sola vez: «la página cambió mucho»
import { useEffect, useRef, useState } from 'react';
import { Ico } from './piezas.jsx';
import { CAPITULOS, capituloDe } from './capitulos.js';
import { pedirRecorrido, tuto, tutoPoner } from './primera.js';

const W = typeof window !== 'undefined' ? window : {};
//: hasta cuándo sale el aviso a quien ya venía (un mes desde que salió)
const AVISO_HASTA = Date.parse('2026-12-14T05:00:00Z');

const aLaGuia = () => { location.hash = '#/guia'; setTimeout(() => W.dispatchEvent(new Event('lg:aprende')), 300); };

export function ComoFunciona({ pagina }) {
  const C = capituloDe(pagina);
  const [abierto, setAbierto] = useState(false);
  const [, setN] = useState(0);
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
      {abierto ? (
        <div className="cf-pop" role="dialog" aria-label={'Cómo funciona: ' + C.t}>
          <span className="cf-k">{C.t.toUpperCase()} · EN UNA LÍNEA</span>
          <p>{C.linea}</p>
          <button type="button" className="cf-ver" onClick={() => { setAbierto(false); pedirRecorrido('cap:' + C.id); }}>
            <span>{hecho ? 'Ver el capítulo otra vez' : 'Ver el capítulo'}</span><small>{C.pasos.length} pasos · 1 min</small></button>
          <div className="cf-pie">
            <button type="button" onClick={() => { setAbierto(false); aLaGuia(); }}>Todo el tutorial · {CAPITULOS.length} capítulos</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
