// 🛠️ El botón MODS de la cabecera, su menú y la franja de «MODO MODS». Qué ofrece y a quién: `mods.js`.
import { useEffect, useRef, useState } from 'react';
import { INTERRUPTORES, opcionesMods, ponerMod, useModsEstado, useQuienMod } from './mods.js';

/** El botón: sólo si en esta página hay algo para esta persona. */
export function BotonMods({ liga, dc, pagina, sv }) {
  const k = (liga && liga.yo && liga.yo.k) || (dc && dc.clave) || '';
  const Q = useQuienMod(dc, k, sv);
  const M = useModsEstado();
  const [ab, setAb] = useState(false);
  const caja = useRef(null);
  const { sw, atajos } = opcionesMods(Q, pagina, sv);
  const prendidos = sw.filter((x) => M[x.k]).length;
  useEffect(() => {
    if (!ab) return undefined;
    const fuera = (e) => { const p = e.composedPath ? e.composedPath() : []; if (caja.current && !p.includes(caja.current)) setAb(false); };
    const esc = (e) => { if (e.key === 'Escape') setAb(false); };
    document.addEventListener('pointerdown', fuera);
    window.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', fuera); window.removeEventListener('keydown', esc); };
  }, [ab]);
  if (!dc || (!sw.length && !atajos.length)) return null;
  return (
    <span className="mods-envol" ref={caja}>
      <button type="button" className={'mods-b' + (prendidos ? ' on' : '')} aria-haspopup="dialog" aria-expanded={ab}
        aria-label={'Herramientas de moderación' + (prendidos ? ' · ' + prendidos + ' prendidas' : '')} onClick={() => setAb((v) => !v)}>
        MODS{prendidos ? <i aria-hidden="true">{prendidos}</i> : null}</button>
      {ab ? (
        <div className="mods-pop" role="dialog" aria-label="Herramientas de moderación">
          <p className="mods-t"><b>MODS</b><span>{Q.owner ? 'Owner' : Q.admin ? 'Admin' : Q.mod ? 'Moderación' : 'Tu servidor'} · sólo en esta pestaña</span></p>
          {sw.map((x) => (
            <button key={x.k} type="button" role="switch" aria-checked={!!M[x.k]} className="mods-sw" onClick={() => ponerMod(x.k, !M[x.k])}>
              <span><b>{x.t}</b><small>{x.d}</small></span><i aria-hidden="true" /></button>
          ))}
          {atajos.map((x) => (
            <a key={x.ruta} className="mods-ir" href={x.ruta} onClick={() => setAb(false)}><span><b>{x.t}</b><small>{x.d}</small></span><i aria-hidden="true">›</i></a>
          ))}
          {sw.length ? <p className="mods-pie">Arranca apagado y se apaga al cerrar la pestaña. Lo que hagas queda anotado con tu nombre.</p> : null}
        </div>
      ) : null}
    </span>
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
