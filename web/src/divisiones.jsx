// 🏟️ LAS DIVISIONES DE LA SEMANA (Dlx, 29/09/2026: «como otro tipo de eventos semanales»; 04/10/2026: «1. A 2. C,
// subir a una división mejor y más competitiva»). La cuenta la hace el ciclo (`bot/divisiones.py`) y viaja en el
// lobby (`div`): acá sólo se muestra. Una tabla por grupo de 30; los de arriba suben y los de abajo bajan.
//
// ⚠️ LA ZONA ES LA MISMA CUENTA QUE `divisiones.zona()`: cinco, o un tercio si el grupo es chico. Si se cambia allá,
// se cambia acá.
import { useEffect, useState } from 'react';
import { MESES, hora, limpio, num } from './liga.js';
import { Cara } from './piezas.jsx';

const zonaDe = (n, z) => Math.min(z, Math.floor(n / 3));

function fechaCorta(iso) {
  const d = new Date(String(iso || '') + 'T12:00:00');
  return isNaN(d) ? '' : d.getDate() + ' ' + MESES[d.getMonth()].slice(0, 3);
}

export function Divisiones({ liga }) {
  const D = liga.d.div;
  const yo = liga.yo;
  const nombres = (D && D.n) || [];
  const divs = (D && D.d) || [];
  const esYo = (raw) => !!yo && liga.esDe(raw, yo.k);
  const mia = divs.findIndex((gs) => (gs || []).some((g) => g.some((f) => esYo(f[0]))));
  const conGente = divs.findIndex((gs) => (gs || []).length);
  const [sel, setSel] = useState(mia >= 0 ? mia : Math.max(0, conGente));
  useEffect(() => { if (mia >= 0) setSel(mia); }, [mia]);
  if (!D) return null;
  const ult = D.u;
  const ultYo = ult && yo ? (ult.sube.some(esYo) ? 'sube' : ult.baja.some(esYo) ? 'baja' : '') : '';
  const gs = divs[sel] || [];
  const ultima = nombres.length - 1;
  return (
    <div className="dv">
      <p className="dv-cab">Semana del {fechaCorta(D.sem)} · cierra el lunes a las {hora(D.fin)}.
        {' '}Los {D.z} primeros de cada grupo suben y ganan <b>{num(D.p)} Puntos de Tienda</b>; los {D.z} últimos bajan.
        {' '}En un grupo chico, un tercio.</p>
      {ult ? <p className="dv-ult">{ultYo === 'sube' ? '⬆️ La semana pasada subiste de división. ' : ultYo === 'baja' ? '⬇️ La semana pasada bajaste de división. ' : ''}
        La semana del {fechaCorta(ult.sem)} subieron {ult.sube.length} y bajaron {ult.baja.length}.</p> : null}
      <div className="rk-chips dv-divs" role="group" aria-label="División">
        {nombres.map((n, i) => ((divs[i] || []).length ? (
          <button type="button" key={n} className={i === sel ? 'on' : ''} aria-pressed={i === sel} onClick={() => setSel(i)}>
            {n}{i === mia ? ' · la tuya' : ''}</button>
        ) : null))}
      </div>
      {gs.map((g, gi) => {
        const z = zonaDe(g.length, D.z);
        return (
          <section className="dv-g" key={gi} aria-label={nombres[sel] + ' División' + (gs.length > 1 ? ', grupo ' + (gi + 1) : '')}>
            <h3 className="dv-gt">{nombres[sel]} División{gs.length > 1 ? ' · grupo ' + (gi + 1) : ''}<small>{g.length} jugando</small></h3>
            <ol className="dv-tabla">
              {g.map(([raw, pts, ev], i) => {
                const f = liga.fila(raw);
                const sube = sel > 0 && i < z;
                const baja = sel < ultima && i >= g.length - z;
                const cls = (sube ? 'sube' : baja ? 'baja' : '') + (esYo(raw) ? ' yo' : '');
                return (
                  <li key={raw} className={cls}>
                    <span className="dv-i">{i + 1}</span>
                    {f ? <Cara liga={liga} k={f.k} nombre={f.n} cls="cara dv-cara" /> : <span className="cara dv-cara ini">{limpio(raw).slice(0, 1).toUpperCase()}</span>}
                    {f ? <a className="dv-n" href={'#/r/' + encodeURIComponent(f.k)}>{limpio(raw)}</a> : <span className="dv-n">{limpio(raw)}</span>}
                    {sube ? <i className="dv-z">SUBE</i> : baja ? <i className="dv-z">BAJA</i> : null}
                    <span className="dv-ev">{ev} {ev === 1 ? 'evento' : 'eventos'}</span>
                    <b className="dv-p">{num(pts)}</b>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
