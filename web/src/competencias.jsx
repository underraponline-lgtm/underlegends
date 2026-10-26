// 🏆 LA PÁGINA DE COMPETENCIAS (#/competencias, 26/10/2026). Dlx: «que hayan mini eventos pero que se note… diferentes
// grupos, no solo 1… donde sea se enfrenten, en cualquier servidor o evento, que eso cuente… si no se pelean se simula»,
// y a sumarla al menú, «sí». Lo arma `bot/competencias.py`; acá sólo se dibuja:
//   · arriba, la semana (día N de 7) y, si entraste, EN QUÉ VAS en cada una
//   · la COPA: tu grupo primero, y los demás con buscador
//   · la LIGA DE 10: la tabla y la jornada de esta semana, con la probabilidad de cada cruce
//   · la RAPID del día: la llave entera, simulada
import { useMemo, useState } from 'react';
import { Sec } from './piezas.jsx';
import { DIVISIONES, dondeEstoy, nombreDe, semanaTxt, useCompetencias } from './competencias_datos.js';
import CSS_PAGINA from './css/competencias.css?inline';
import { usarCss } from './css.js';

usarCss('competencias', CSS_PAGINA);

const pct = (p) => Math.round((p || 0) * 100) + ' %';

function Nombre({ liga, C, k, yo }) {
  const n = nombreDe(liga, C, k);
  const tiene = liga && liga.T && liga.T[k];
  return tiene ? <a href={'#/r/' + encodeURIComponent(k)} className={k === yo ? 'cmp-yo' : undefined}>{n}</a> : <span className={k === yo ? 'cmp-yo' : undefined}>{n}</span>;
}

function Cruce({ liga, C, m, yo }) {
  const [a, b, g, como, p] = m;
  return (
    <li className={'cmp-cruce ' + como}>
      <span className={g === a ? 'gana' : ''}><Nombre liga={liga} C={C} k={a} yo={yo} /></span>
      <small>{como === 'real' ? 'REAL' : como === 'sim' ? 'SIMULADO' : 'vs'}</small>
      <span className={g === b ? 'gana' : ''}><Nombre liga={liga} C={C} k={b} yo={yo} /></span>
      <b title={'Si se simula, ' + nombreDe(liga, C, a) + ' gana ' + pct(p)}>{como === 'pend' ? pct(p) : ''}</b>
    </li>
  );
}

function Grupo({ liga, C, g, yo, abierto }) {
  return (
    <article className={'cmp-grupo' + (abierto ? ' tuyo' : '')}>
      <header><b>Grupo {g.id}</b><small>{DIVISIONES[g.div] || ''}</small></header>
      <table>
        <thead><tr><th>#</th><th>Rapero</th><th>PJ</th><th>G</th><th>PTS</th></tr></thead>
        <tbody>
          {g.t.map(([k, pj, gg, pts], i) => (
            <tr key={k} className={k === yo ? 'yo' : undefined}><td>{i + 1}</td><td><Nombre liga={liga} C={C} k={k} yo={yo} /></td><td>{pj}</td><td>{gg}</td><td><b>{pts}</b></td></tr>
          ))}
        </tbody>
      </table>
      {abierto ? <ul className="cmp-cruces">{g.p.map((m) => <Cruce key={m[0] + m[1]} liga={liga} C={C} m={m} yo={yo} />)}</ul> : null}
    </article>
  );
}

export function Competencias({ liga, dc }) {
  const C = useCompetencias();
  const [busca, setBusca] = useState('');
  const [ver, setVer] = useState(12);
  const yo = (liga && liga.yo && liga.yo.k) || (dc && dc.clave) || '';
  const donde = useMemo(() => dondeEstoy(C, yo), [C, yo]);
  if (!C) return <div className="cargando">Cargando las competencias…</div>;
  const q = busca.trim().toLowerCase();
  const grupos = (C.copa || []).filter((g) => !q || g.id.toLowerCase() === q || g.t.some(([k]) => nombreDe(liga, C, k).toLowerCase().includes(q)));
  const mio = donde && donde.copa ? donde.copa.g : null;
  const resto = grupos.filter((g) => g !== mio);
  const L = C.liga || {};
  const jor = (L.j || [])[(L.j || []).length - 1];
  return (
    <div className="cmp">
      <section className="sec cmp-cab">
        <div className="cmp-cab-t">
          <span>SEMANA DEL {semanaTxt(C).toUpperCase()}</span>
          <h1>DÍA {C.dia} <small>DE 7</small></h1>
          <div className="cmp-dias" aria-label={'Día ' + C.dia + ' de 7'}>{[1, 2, 3, 4, 5, 6, 7].map((d) => <i key={d} className={d < C.dia ? 'ya' : d === C.dia ? 'hoy' : ''} />)}</div>
          <p>Cierra el lunes a las 11 AM. Si dos se cruzan en <b>cualquier evento de cualquier servidor</b> durante la semana, cuenta esa batalla; lo que no se cruzó se <b>simula</b> al cierre, con la fuerza de cada uno.</p>
        </div>
        {donde ? (
          <ul className="cmp-voy" aria-label="En qué vas">
            {donde.copa ? <li><span>COPA · GRUPO {donde.copa.g.id}</span><b>{donde.copa.pos}.º</b><small>{donde.copa.falta ? 'Faltan ' + donde.copa.falta + ' cruces' : 'Jugaste todos'}</small></li> : null}
            {donde.liga ? <li><span>LIGA DE 10</span><b>{donde.liga.pos}.º</b><small>{donde.liga.rival ? 'Contra ' + nombreDe(liga, C, donde.liga.rival) + (donde.liga.g ? '' : ' · ' + pct(donde.liga.p)) : ''}</small></li> : null}
            <li><span>RAPID DE HOY</span><b>{donde.rapid ? (C.rapid && C.rapid.campeon === yo ? 'Campeón' : 'Jugaste') : '—'}</b><small>{donde.rapid ? '' : 'Hoy no te tocó'}</small></li>
          </ul>
        ) : (
          <ul className="cmp-voy">
            <li><span>COPA</span><b>{(C.copa || []).length}</b><small>grupos · {C.activos} activos</small></li>
            <li><span>LIGA DE 10</span><b>J{(L.j || []).length || 1}</b><small>de 9</small></li>
            <li><span>RAPID DE HOY</span><b>{C.rapid ? nombreDe(liga, C, C.rapid.campeon) : '—'}</b><small>campeón</small></li>
          </ul>
        )}
      </section>

      <Sec id="cmp-copa" titulo="La Copa de la semana" bajada={'Grupos de 4 por división, con los que jugaron en las últimas dos semanas. Ganar da 3 puntos.'}>
        {mio ? <Grupo liga={liga} C={C} g={mio} yo={yo} abierto /> : null}
        <input className="cmp-busca" type="search" placeholder="Buscar un rapero o un grupo…" value={busca} onChange={(e) => { setBusca(e.target.value); setVer(12); }} aria-label="Buscar en la Copa" />
        <div className="cmp-grupos">{resto.slice(0, ver).map((g) => <Grupo key={g.id} liga={liga} C={C} g={g} yo={yo} abierto={!!q} />)}</div>
        {resto.length > ver ? <button type="button" className="btn borde2 chico" onClick={() => setVer(ver + 24)}>Ver más grupos ({resto.length - ver})</button> : null}
        {!grupos.length ? <p className="cmp-nada">Nadie se llama así en la Copa de esta semana.</p> : null}
      </Sec>

      <Sec id="cmp-liga" titulo="La Liga de 10" bajada="Los 10 mejores del Competitivo que están activos. Una jornada por semana, nueve en total.">
        {(L.t || []).length ? (
          <div className="cmp-liga">
            <table>
              <thead><tr><th>#</th><th>Rapero</th><th>PJ</th><th>G</th><th>PTS</th></tr></thead>
              <tbody>{L.t.map(([k, pj, g, pts], i) => <tr key={k} className={k === yo ? 'yo' : undefined}><td>{i + 1}</td><td><Nombre liga={liga} C={C} k={k} yo={yo} /></td><td>{pj}</td><td>{g}</td><td><b>{pts}</b></td></tr>)}</tbody>
            </table>
            {jor ? <div><h3>Jornada {jor.n}</h3><ul className="cmp-cruces">{jor.p.map((m) => <Cruce key={m[0] + m[1]} liga={liga} C={C} m={m} yo={yo} />)}</ul></div> : null}
          </div>
        ) : <p className="cmp-nada">Todavía no hay 10 activos con Competitivo: faltan {L.falta || 0}.</p>}
      </Sec>

      {C.rapid ? (
        <Sec id="cmp-rapid" titulo="La Rapid de hoy" bajada="8 activos sorteados y la llave entera simulada. Mañana, otros 8.">
          <div className="cmp-rapid">
            {C.rapid.r.map((r) => (
              <div key={r.r}><h3>{r.r}</h3><ul className="cmp-cruces">{r.p.map((m) => <Cruce key={m[0] + m[1]} liga={liga} C={C} m={m} yo={yo} />)}</ul></div>
            ))}
            <div className="cmp-camp"><small>CAMPEÓN</small><b><Nombre liga={liga} C={C} k={C.rapid.campeon} yo={yo} /></b></div>
          </div>
        </Sec>
      ) : null}
    </div>
  );
}
