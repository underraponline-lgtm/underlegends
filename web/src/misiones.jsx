// 🎯 LAS MISIONES DE LA SEMANA (Dlx, 04/10/2026, a la propuesta: «3. A»; 05/10: «empezá ya»). Tres por semana, las
// mismas para todos, que se renuevan el lunes a las 11 AM ET con los multiplicadores; cada una suma puntos a la
// Temporada y las tres juntas dan un bono. La cuenta la hace el ciclo (`bot/misiones.py`) y viaja en el lobby
// (`mis`): acá sólo se muestra. Las TAREAS son otra cosa: son del Pase.
import { MESES, limpio, num, quienMira } from './liga.js';
import { Cara } from './piezas.jsx';

const NIVEL = { facil: 'Fácil', media: 'Media', dificil: 'Difícil' };

function fechaCorta(iso) {
  const d = new Date(String(iso || '') + 'T12:00:00');
  return isNaN(d) ? '' : d.getDate() + ' ' + MESES[d.getMonth()].slice(0, 3);
}

export function Misiones({ liga }) {
  const M = liga.d.mis;
  if (!M) return null;
  const yo = liga.yo;
  const esYo = (raw) => !!yo && liga.esDe(raw, yo.k);
  const prog = M.prog || {};
  const lista = M.lista || [];
  const mio = Object.keys(prog).find(esYo);
  const dc = quienMira().dc;
  const cumplieron = (i) => Object.values(prog).filter((v) => (v[i] || 0) >= lista[i].m).length;
  const semana = Object.entries(M.pts || {}).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const total = Object.entries(M.total || {}).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 10);
  return (
    <div className="mi">
      <p className="dv-cab">Semana del {fechaCorta(M.sem)} · se renuevan {liga.dia(M.fin)}.
        {' '}Las mismas tres para todos, y se cumplen jugando: cada una suma a tu <b>Temporada</b>, y las tres juntas, <b>+{num(M.bono)}</b> más.</p>
      <ol className="mi-lista">
        {lista.map((x, i) => {
          // 🔑 quien juega la temporada y todavía no hizo nada esta semana lleva 0, no «nada» (revisión del 05/10/2026)
          const v = mio ? (prog[mio] || [])[i] || 0 : yo ? 0 : null;
          const ok = v != null && v >= x.m;
          return (
            <li key={x.id} className={'mi-m mi-' + x.n + (ok ? ' ok' : '')}>
              <span className="mi-niv">{NIVEL[x.n] || x.n}</span>
              <b className="mi-t">{x.t}</b>
              <span className="mi-p">+{num(x.p)}</span>
              {v != null ? <span className="mi-yo">{ok ? '✓ La cumpliste' : x.m > 1 ? 'Llevás ' + v + ' de ' + x.m : 'Todavía no'}</span> : null}
              <small className="mi-c">{cumplieron(i) === 1 ? '1 la cumplió' : num(cumplieron(i)) + ' la cumplieron'}</small>
            </li>
          );
        })}
      </ol>
      {!yo ? <p className="dv-cab">{dc ? 'Con tu primer evento de la ' + liga.temp + ' acá ves cuánto llevás de cada una.'
        : 'Entrá con Discord y acá ves cuánto llevás de cada una.'}</p> : null}
      <section className="dv-g" aria-label="Los que sumaron esta semana">
        <h3 className="dv-gt">Esta semana<small>{semana.length ? semana.length + ' sumaron' : 'todavía nadie'}</small></h3>
        {semana.length ? (
          <ol className="dv-tabla mi-tabla">
            {semana.map(([raw, pts]) => {
              const f = liga.fila(raw);
              const hechas = lista.map((x, j) => (prog[raw] || [])[j] >= x.m);
              return (
                <li key={raw} className={esYo(raw) ? 'yo' : ''}>
                  {f ? <Cara liga={liga} k={f.k} nombre={f.n} cls="cara dv-cara" /> : <span className="cara dv-cara ini">{limpio(raw).slice(0, 1).toUpperCase()}</span>}
                  {f ? <a className="dv-n" href={'#/r/' + encodeURIComponent(f.k)}>{limpio(raw)}</a> : <span className="dv-n">{limpio(raw)}</span>}
                  <span className="mi-marcas" role="img" aria-label={hechas.filter(Boolean).length + ' de ' + lista.length + ' cumplidas'}>
                    {hechas.map((h, j) => <i key={j} className={h ? 'si' : ''} />)}
                  </span>
                  <b className="dv-p">+{num(pts)}</b>
                </li>
              );
            })}
          </ol>
        ) : <p className="dv-cab">Cuando alguien cumpla la primera, aparece acá.</p>}
      </section>
      {total.length ? (
        <section className="dv-g" aria-label="Lo sumado en la temporada">
          <h3 className="dv-gt">En la temporada<small>lo sumado con misiones</small></h3>
          <ol className="dv-tabla mi-tabla con-i">
            {total.map(([raw, pts], i) => {
              const f = liga.fila(raw);
              return (
                <li key={raw} className={esYo(raw) ? 'yo' : ''}>
                  <span className="dv-i">{i + 1}</span>
                  {f ? <Cara liga={liga} k={f.k} nombre={f.n} cls="cara dv-cara" /> : <span className="cara dv-cara ini">{limpio(raw).slice(0, 1).toUpperCase()}</span>}
                  {f ? <a className="dv-n" href={'#/r/' + encodeURIComponent(f.k)}>{limpio(raw)}</a> : <span className="dv-n">{limpio(raw)}</span>}
                  <b className="dv-p">{num(pts)}</b>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
