// 🛠️ La ventana de MODS de «Tus paneles» (el menú de tu cara) y la franja de «MODO MODS». Qué ofrece y a quién: `mods.js`.
// ⚠️ SIN EL BOTÓN DE LA CABECERA desde el 18/11/2026 (Dlx: «put the mods menu within the account… remove the mods menu
// from the top»): con él, el menú no entraba y la marca quedaba pegada a Inicio («LIGA GLOBAL · T1INICIO» en la Tienda)
import { useEffect, useRef, useState } from 'react';
import { INTERRUPTORES, lugaresMods, ponerMod, rolMods, useModsEstado } from './mods.js';
import { PopCab } from './pop.jsx';
import { Ico } from './piezas.jsx';

/** Un interruptor de la ventana. */
function Interruptor({ x, M }) {
  return (
    <button type="button" role="switch" aria-checked={!!M[x.k]} className="mods-sw" onClick={() => ponerMod(x.k, !M[x.k])}>
      <span><b>{x.t}</b><small>{x.d}</small></span><i aria-hidden="true" /></button>
  );
}

/**
 * 🗺️ LA VENTANA DE «TUS PANELES» (Dlx, 17/11/2026): todos los lugares donde esta persona puede usar MODS, cada uno con sus
 * interruptores, sus atajos y un «Ir». Los interruptores son de la pestaña, no de la página, así que se prenden desde acá y
 * valen al llegar. La abre el menú de tu cara con `abrirLugaresMods(Q)`: ese menú se cierra al tocar afuera, así que la
 * ventana no puede vivir adentro de él; vive una sola vez en App.jsx y no pide nada hasta que se abre.
 */
export function LugaresMods() {
  const [Q, setQ] = useState(null);
  const M = useModsEstado();
  const dref = useRef(null);
  useEffect(() => {
    const f = (e) => setQ((e && e.detail) || null);
    window.addEventListener('lg:mods-lugares', f);
    return () => window.removeEventListener('lg:mods-lugares', f);
  }, []);
  useEffect(() => {
    const d = dref.current;
    if (Q && d && !d.open && d.showModal) d.showModal();
  }, [Q]);
  if (!Q) return null;
  const lugares = lugaresMods(Q);
  const prendidos = Object.keys(INTERRUPTORES).filter((x) => M[x]).length;
  const cerrar = () => { if (dref.current && dref.current.open) dref.current.close(); };
  return (
    <dialog className="pn-pop mods-lug" ref={dref} aria-label="MODS: dónde puedes usarlo" onClose={() => setTimeout(() => { if (!dref.current || !dref.current.open) setQ(null); }, 220)}
      onClick={(e) => { if (e.target === dref.current) cerrar(); }}>
      <PopCab ico="escudo" t="MODS" sub={rolMods(Q) + ' · ' + (lugares.length === 1 ? 'un lugar' : lugares.length + ' lugares') + ' donde puedes usarlo'} cerrar={cerrar} />
      <div className="mods-lug-in">
        {lugares.length ? lugares.map((L) => (
          <section key={L.pagina} className="mods-lug-g" aria-label={L.t}>
            <div className="mods-lug-h">
              <span className="mods-lug-ic" aria-hidden="true"><Ico n={L.ico} t={18} /></span>
              <span className="mods-lug-tt"><b>{L.t}</b><small>{L.d}</small></span>
              {L.ruta ? <a className="mods-lug-ir" href={L.ruta} onClick={cerrar}>Ir<i aria-hidden="true">›</i></a> : null}
            </div>
            {L.sw.map((x) => <Interruptor key={x.k} x={x} M={M} />)}
            {L.atajos.map((x) => (
              <a key={x.ruta} className="mods-ir" href={x.ruta} onClick={cerrar}><span><b>{x.t}</b><small>{x.d}</small></span><i aria-hidden="true">›</i></a>
            ))}
          </section>
        )) : <p className="mods-pie">Hoy no hay nada para usar con MODS.</p>}
        <p className="mods-pie">{prendidos ? (prendidos === 1 ? 'Tienes 1 prendido. ' : 'Tienes ' + prendidos + ' prendidos. ') : ''}
          Lo que prendas sirve en esta pestaña hasta que lo apagues o la cierres, y lo que hagas queda anotado con tu nombre.</p>
      </div>
    </dialog>
  );
}

/** La franja magenta mientras algo esté prendido: qué, y apagarlo todo. */
export function FranjaMods() {
  const M = useModsEstado();
  const on = Object.keys(INTERRUPTORES).filter((k) => M[k]);
  if (!on.length) return null;
  return (
    <div className="mods-franja" role="status">
      <span><b>MODO MODS</b>{on.map((k) => INTERRUPTORES[k]).join(' · ')}</span>
      <button type="button" onClick={() => ponerMod(null)}>Apagar</button>
    </div>
  );
}
