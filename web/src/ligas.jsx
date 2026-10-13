// 🏟️ LAS LIGAS DE LOS SERVIDORES (Dlx, 12/10/2026: «2. Me gusta», a la pestaña «Ligas» con la tabla de cada una; y a
// la Copa de Campeones, no: «cada liga tiene su inicio y su fin aleatoriamente… no podemos controlar eso»). La cuenta
// la hace el ciclo (`bot/ligas.py`) con los veredictos de cada liga y viaja en el lobby (`ligas`): acá sólo se muestra.
//
// ⚠️ LA TABLA ES LA QUE SALE DE LOS VEREDICTOS QUE SE PUDIERON LEER: directa 3 y 0, réplica 2 y 1, sin los ExtraPlayers.
// La oficial de cada liga puede tener sanciones o defaults que acá no están; por eso va el link a la suya.
import { useState } from 'react';
import { limpio, num, siglaDe } from './liga.js';
import { Cara } from './piezas.jsx';

export function Ligas({ liga }) {
  const D = liga.d.ligas;
  const ls = (D && D.ligas) || [];
  const [sel, setSel] = useState(0);
  if (!ls.length) return null;
  const L = ls[Math.min(sel, ls.length - 1)];
  const yo = liga.yo;
  const esYo = (raw) => !!yo && liga.esDe(raw, yo.k);
  const nombre = (raw, cls) => {
    const f = liga.fila(raw);
    return f ? <a className={cls} href={'#/r/' + encodeURIComponent(f.k)}>{limpio(raw)}</a> : <span className={cls}>{limpio(raw)}</span>;
  };
  const cara = (raw) => {
    const f = liga.fila(raw);
    return f ? <Cara liga={liga} k={f.k} nombre={f.n} cls="cara dv-cara" /> : <span className="cara dv-cara ini">{limpio(raw).slice(0, 1).toUpperCase()}</span>;
  };
  return (
    <div className="dv lgs">
      <p className="dv-cab">Las ligas de los servidores, con sus jornadas: cada una arranca y termina cuando la organiza su servidor.
        {' '}Sus batallas suman a tus <b>duelos</b> —el Ranking Duelos y el Win%—; al Score, no.</p>
      <div className="lg-tabs" role="tablist" aria-label="Las ligas">
        {ls.map((x, i) => (
          <button key={x.id} type="button" role="tab" aria-selected={i === sel} className={i === sel ? 'on' : ''} onClick={() => setSel(i)}>
            {x.n}<small>{siglaDe(x.sv)}</small>
          </button>
        ))}
      </div>
      <section className="dv-g" aria-label={L.n}>
        <h3 className="dv-gt">{L.n}<small>{L.j ? 'jornada ' + L.j + ' · ' : ''}{num(L.bat)} {L.bat === 1 ? 'batalla' : 'batallas'}{L.pend ? ' · ' + L.pend + ' sin cierre todavía' : ''}</small></h3>
        <ol className="dv-tabla lg-tabla">
          {L.tabla.map(([raw, pj, pg, pts], i) => (
            <li key={raw} className={esYo(raw) ? 'yo' : ''}>
              <span className="dv-i">{i + 1}</span>
              {cara(raw)}
              {nombre(raw, 'dv-n')}
              <span className="lg-pj" title="ganadas de jugadas">{pg}/{pj}</span>
              <b className="dv-p">{pts}</b>
            </li>
          ))}
        </ol>
        <h4 className="lg-st">Los últimos resultados</h4>
        <ul className="lg-ult">
          {L.ult.map(([a, b, g, como, j], i) => (
            <li key={i}>
              {nombre(g, 'lg-g')} le ganó a {nombre(g === a ? b : a, 'lg-p')}
              <small>{como === 'replica' ? 'en réplica' : 'directo'}{j ? ' · jornada ' + j : ''}</small>
            </li>
          ))}
        </ul>
        <p className="lg-nota">La tabla sale de los veredictos que se pudieron leer: directa 3 puntos, réplica 2 y 1, sin los invitados.
          {L.link ? <> La oficial, con sanciones y defaults, está en <a className="te-link" href={L.link} target="_blank" rel="noopener noreferrer">su Discord</a>.</> : null}</p>
      </section>
    </div>
  );
}
