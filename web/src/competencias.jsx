// 🏆 LA PÁGINA DE COMPETENCIAS (#/competencias). Nació el 26/10/2026 como tres listas; Dlx: «siento que es muy básica»,
// «tiene que ser más visual… como Top Eleven… y por qué todo está negro, recuerda seguir el estilo de las nuevas páginas
// remake», y eligió la maqueta B («Vestuario») con «que muestre completamente los 10 de la liga… elite league, gold
// league… y que muestre cómo se juega». Ideas de 21st y del research de Top Eleven (reports/), sin traer código.
// De arriba abajo, como la maqueta:
//   · la ESCENA: la semana, cuánto falta para el próximo cierre y TU PRÓXIMO CRUCE, carta contra carta
//   · la tira de días
//   · LAS LIGAS: la pirámide (Oro · Plata · Bronce · Ascenso) con la Élite aparte, la liga elegida ENTERA y su jornada
//   · la Copa y la Rapid
//   · los MINI EVENTOS que rotan, el EQUIPO DE LA SEMANA y una simulada por dentro (con su jurado sorteado)
//   · CÓMO SE JUEGA y las preguntas de quien entra nuevo
//   · los grupos de la Copa, con buscador
// Lo arma `bot/competencias.py`; acá sólo se dibuja.
import { useMemo, useRef, useState } from 'react';
import { Carta } from './piezas.jsx';
import {
  DIVISIONES, NIVEL, NIVELES, dondeEstoy, faltaTxt, nombreDe, nombreLiga, semanaTxt, todasLasLigas, ultimas, useCompetencias,
} from './competencias_datos.js';
import CSS_PAGINA from './css/competencias.css?inline';
import { usarCss } from './css.js';

usarCss('competencias', CSS_PAGINA);

const pct = (p) => Math.round((p || 0) * 100) + ' %';
const ancho = (p) => Math.round((p || 0) * 100) + '%';
const inicial = (s) => (String(s || '?').replace(/[^\p{L}\p{N}]/gu, '').charAt(0) || '?').toUpperCase();

function Nombre({ liga, C, k, yo }) {
  if (!k) return <span className="cm9-nadie">por definir</span>;
  const n = nombreDe(liga, C, k);
  const tiene = liga && liga.T && liga.T[k];
  const cls = k === yo ? 'cm9-yo' : undefined;
  return tiene ? <a href={'#/r/' + encodeURIComponent(k)} className={cls}>{n}</a> : <span className={cls}>{n}</span>;
}

/** El cartel de cómo salió un cruce: REAL (con su evento), SIMULADO o POR JUGAR */
function Como({ m }) {
  if (m[3] === 'real') return <span className="cm9-tag real">REAL{m[5] ? ' · #' + m[5] : ''}</span>;
  if (m[3] === 'sim') return <span className="cm9-tag sim">SIMULADO</span>;
  return <span className="cm9-tag pend">POR JUGAR</span>;
}

/** El jurado sorteado de una simulada: quién votó a quién */
function Jurado({ liga, C, m }) {
  if (m[3] !== 'sim' || !Array.isArray(m[5])) return null;
  const va = m[5].filter(([, v]) => v === 'a').length;
  return (
    <div className="cm9-jur">
      <small>Jurado sorteado · {Math.max(va, 3 - va)}–{Math.min(va, 3 - va)}</small>
      {m[5].map(([q, v]) => (
        <span key={q}><i>{inicial(juradoNombre(liga, C, q))}</i>{juradoNombre(liga, C, q)}<b className={v === (m[2] === m[0] ? 'a' : 'b') ? 'ok' : 'no'}>{nombreDe(liga, C, v === 'a' ? m[0] : m[1])}</b></span>
      ))}
    </div>
  );
}
const juradoNombre = (liga, C, q) => ((C.jur || {})[q] || {}).n || nombreDe(liga, C, q);

function Cruce({ liga, C, m, yo, jurado }) {
  const [a, b, g, como, p] = m;
  return (
    <li className={'cm9-cru ' + como + (a === yo || b === yo ? ' tuyo' : '')}>
      <Como m={m} />
      <span className="cm9-cru-l">
        <span className={g && g === a ? 'gana' : g ? 'pierde' : ''}><Nombre liga={liga} C={C} k={a} yo={yo} /></span>
        <small>vs</small>
        <span className={g && g === b ? 'gana' : g ? 'pierde' : ''}><Nombre liga={liga} C={C} k={b} yo={yo} /></span>
      </span>
      {como === 'pend' && a && b ? <b className="cm9-p" title={'Si se simula, ' + nombreDe(liga, C, a) + ' gana ' + pct(p)}>{pct(p)}</b> : null}
      {jurado ? <Jurado liga={liga} C={C} m={m} /> : null}
    </li>
  );
}

/** La tabla de una liga ENTERA, con sus zonas: campeón, suben, bajan */
function TablaLiga({ liga, C, g, yo }) {
  const n = g.t.length;
  const esElite = g.id === 'elite';
  const zona = (i) => {
    if (i === 0) return 'campeon';
    if (!esElite && g.nv !== 'oro' && i < 2) return 'sube';
    if (!esElite && g.nv !== 'ascenso' && n >= 6 && i >= n - 2) return 'baja';
    return '';
  };
  return (
    <div className="cm9-tw">
      <table className="cm9-tabla">
        <thead><tr><th>#</th><th aria-label="Inicial" /><th>Rapero</th><th>PJ</th><th>G</th><th>P</th><th>Últimas</th><th>PTS</th></tr></thead>
        <tbody>
          {g.t.map(([k, pj, gg, pts], i) => (
            <tr key={k} className={(zona(i) + (k === yo ? ' yo' : '')).trim() || undefined}>
              <td>{i + 1}</td>
              <td><i className="cm9-cr">{inicial(nombreDe(liga, C, k))}</i></td>
              <td><Nombre liga={liga} C={C} k={k} yo={yo} /></td>
              <td>{pj}</td><td>{gg}</td><td>{pj - gg}</td>
              <td><span className="cm9-fo">{ultimas(g, k).concat(Array(5).fill('')).slice(0, 5).map((x, j) => <i key={j} className={x === 'G' ? 'g' : x === 'P' ? 'p' : ''}>{x}</i>)}</span></td>
              <td><b>{pts}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="cm9-ley">
        <span><i className="campeon" />{esElite ? 'Campeón de la Élite' : 'Campeón'}</span>
        {!esElite && g.nv !== 'oro' ? <span><i className="sube" />Suben de liga</span> : null}
        {!esElite && g.nv !== 'ascenso' ? <span><i className="baja" />Bajan de liga</span> : null}
        <span><i className="g" />G ganó · <i className="p" />P perdió</span>
      </div>
    </div>
  );
}

function Escena({ liga, C, yo, donde, onComo }) {
  const L = C.ligas || {};
  // el próximo cierre de lo que sea: la jornada de las ligas o la semana (la Copa y la Rapid)
  const prox = [C.fin].concat(L.cierres || []).filter((x) => new Date(x).getTime() > Date.now()).sort((a, b) => new Date(a) - new Date(b))[0];
  const pr = donde && donde.prox;
  // sin cruce tuyo: el primero por jugar de la Élite, para que la escena siempre muestre un cara a cara
  const ej = !pr && L.e ? (L.e.j.find((j) => j.n === L.jornada) || { p: [] }).p.find((m) => !m[2]) : null;
  const a = pr ? yo : ej && ej[0];
  const b = pr ? pr[1].rival : ej && ej[1];
  const p = pr ? pr[1].p : ej ? ej[4] : 0.5;
  return (
    <section className="cm9-esc" aria-label="Competencias">
      <div className="cm9-esc-t">
        <span className="cm9-chip">COMPETENCIAS · T1</span>
        <h1>LA SEMANA</h1>
        <p>Ligas, Copa y Rapid que se juegan <b>solas con tus batallas</b>. Si te cruzas con tu rival en cualquier evento, cuenta esa batalla. Si no, se simula al cierre con tu nivel.</p>
        <dl className="cm9-stats">
          <div><dt>Día</dt><dd>{C.dia} / 7</dd></div>
          <div><dt>Próximo cierre</dt><dd className="v">{prox ? faltaTxt(prox) : 'ahora'}</dd></div>
          <div><dt>Juegan</dt><dd>{C.activos}</dd></div>
        </dl>
        <button type="button" className="cm9-como-btn" onClick={onComo}>¿Primera vez? Cómo se juega ↓</button>
      </div>
      {a && b ? (
        <div className="cm9-vs">
          <div className="cm9-vs-t"><span className="cm9-tag real">{pr ? 'TU PRÓXIMO CRUCE' : 'EN LA ÉLITE'}</span><small>{pr ? pr[0] : 'Jornada ' + L.jornada}</small></div>
          <div className="cm9-vs-c">
            <Carta liga={liga} k={a} cual={liga.cartaDe(a) || 'temporada'} cls="cm9-vs-img" />
            <b>VS</b>
            <Carta liga={liga} k={b} cual={liga.cartaDe(b) || 'temporada'} cls="cm9-vs-img" />
          </div>
          <div className="cm9-barra" aria-hidden="true"><i style={{ width: ancho(p) }} /></div>
          <div className="cm9-vs-n"><span>{nombreDe(liga, C, a)} {pct(p)}</span><span>{pct(1 - p)} {nombreDe(liga, C, b)}</span></div>
          <small className="cm9-vs-nota">Si se cruzan en un evento antes del cierre, cuenta esa batalla. Si no, se simula con estas chances.</small>
        </div>
      ) : null}
    </section>
  );
}

function Dias({ C }) {
  const ini = new Date(C.ini);
  return (
    <nav className="cm9-dias" aria-label="Los días de la semana">
      {[0, 1, 2, 3, 4, 5, 6].map((d) => {
        const hoy = d + 1 === C.dia;
        // el día de hoy con su fecha de verdad: el día 7 va del domingo 11 AM al lunes 11 AM
        const f = hoy ? new Date() : new Date(ini.getTime() + d * 86400000);
        return (
          <span key={d} className={hoy ? 'hoy' : d + 1 < C.dia ? 'ya' : ''}>
            <small>{hoy ? 'HOY' : f.toLocaleDateString('es', { timeZone: 'America/New_York', weekday: 'short' }).replace('.', '').toUpperCase()}</small>
            <b>{f.toLocaleDateString('es', { timeZone: 'America/New_York', day: 'numeric' })}</b>
          </span>
        );
      })}
    </nav>
  );
}

function Ligas({ liga, C, yo, donde }) {
  const L = C.ligas || {};
  const todas = todasLasLigas(C);
  const mia = (donde && (donde.liga || donde.elite)) ? (donde.liga || donde.elite).g.id : null;
  const [sel, setSel] = useState(mia || (L.e ? 'elite' : (todas[0] || {}).id));
  const g = todas.find((x) => x.id === sel) || todas[0];
  if (!g) return null;
  const nivelSel = g.id === 'elite' ? 'elite' : g.nv;
  const delNivel = todas.filter((x) => x.nv === nivelSel);
  const jor = (g.j || []).find((j) => j.n === L.jornada) || (g.j || [])[0];
  const cuenta = (nv) => (L.g || []).filter((x) => x.nv === nv).length;
  const tuNivel = (nv) => (donde && donde.liga && donde.liga.g.nv === nv);
  return (
    <section className="cm9-sec" aria-label="Las ligas" id="cm9-ligas">
      <div className="cm9-cab">
        <div><h2>LAS LIGAS</h2><p>Ligas de 10. Tres jornadas por semana (cierran lunes, miércoles y viernes), nueve por temporada. <b>Los 2 primeros suben</b> de liga y <b>los 2 últimos bajan</b>.</p></div>
        <span className="cm9-et">Temporada {L.temp} · jornada {L.jornada} de 9 · termina el {new Date(L.hasta).toLocaleDateString('es', { timeZone: 'America/New_York', day: 'numeric', month: 'numeric' })}</span>
      </div>
      <div className="cm9-ligas">
        <div className="cm9-pir">
          {L.e ? (
            <button type="button" className={'cm9-elite' + (nivelSel === 'elite' ? ' on' : '')} onClick={() => setSel('elite')}>
              <b>⭐ LIGA ÉLITE</b><small>En paralelo · los 10 mejores del Competitivo{donde && donde.elite ? ' · tú' : ''}</small>
            </button>
          ) : null}
          <span className="cm9-et">Los niveles</span>
          {NIVELES.map(([nv, n, c], i) => (cuenta(nv) ? (
            <button key={nv} type="button" className={'cm9-niv' + (nivelSel === nv ? ' on' : '')} style={{ '--c': c, width: (46 + i * 18) + '%' }}
              onClick={() => setSel(tuNivel(nv) ? donde.liga.g.id : (todas.find((x) => x.nv === nv) || {}).id)}>
              <b>{n.toUpperCase()}</b><small>{cuenta(nv)} {cuenta(nv) === 1 ? 'liga' : 'ligas'}{tuNivel(nv) ? ' · tú' : ''}</small>
            </button>
          ) : null))}
          <p className="cm9-pir-n"><b>¿Cómo se arman?</b> Cada temporada, por cómo terminaste la anterior. Quien entra nuevo empieza en <b>Ascenso</b>. La Élite se juega además de tu liga.</p>
        </div>
        <article className="cm9-liga">
          <header style={{ '--c': g.id === 'elite' ? '#F5C542' : NIVEL[g.nv].c }}>
            <div><h3>LIGA {nombreLiga(C, g).toUpperCase()}</h3><small>{g.id === 'elite' ? 'Los 10 mejores del Competitivo' : g.t.length + ' raperos'}</small></div>
            <div className="cm9-jbar" aria-label={'Jornada ' + L.jornada + ' de 9'}>{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <i key={n} className={n < L.jornada ? 'ya' : n === L.jornada ? 'hoy' : ''} />)}</div>
          </header>
          {delNivel.length > 1 ? (
            <div className="cm9-sub" role="tablist" aria-label="Las ligas de este nivel">
              {delNivel.map((x) => <button key={x.id} type="button" role="tab" aria-selected={x.id === g.id} className={x.id === g.id ? 'on' : ''} onClick={() => setSel(x.id)}>{nombreLiga(C, x)}{x.id === mia ? ' · tú' : ''}</button>)}
            </div>
          ) : null}
          <TablaLiga liga={liga} C={C} g={g} yo={yo} />
        </article>
      </div>
      {jor ? (
        <div className="cm9-jor">
          <h3>JORNADA {jor.n} · LOS {jor.p.length} CRUCES <small>cierra en {faltaTxt(jor.fin)}</small></h3>
          <ul className="cm9-crus">{jor.p.map((m) => <Cruce key={m[0] + m[1]} liga={liga} C={C} m={m} yo={yo} jurado />)}</ul>
        </div>
      ) : null}
    </section>
  );
}

function CopaRapid({ liga, C, yo, donde, onGrupos }) {
  const g = (donde && donde.copa && donde.copa.g) || (C.copa || [])[0];
  const r = (donde && donde.rapid && donde.rapid.r) || (C.rapid || [])[0];
  return (
    <section className="cm9-dos" aria-label="La Copa y la Rapid">
      {g ? (
        <article className="cm9-card">
          <header className="mag"><h3>🏆 COPA</h3><small>Grupo {g.id}{donde && donde.copa ? ' · eres ' + donde.copa.pos + '.º' : ''}</small></header>
          <p>Grupos de 4 cada semana, todos contra todos. Los 2 primeros cobran.</p>
          <ol className="cm9-mini-t">{g.t.map(([k, , , pts], i) => <li key={k} className={(i < 2 ? 'pasa' : '') + (k === yo ? ' yo' : '')}><span>{i + 1} · <Nombre liga={liga} C={C} k={k} yo={yo} /></span><b>{pts}</b></li>)}</ol>
          <button type="button" className="cm9-btn" onClick={onGrupos}>Ver los {(C.copa || []).length} grupos</button>
        </article>
      ) : null}
      {r ? (
        <article className="cm9-card">
          <header className="ver"><h3>⚡ RAPID</h3><small>{(C.rapid || []).length} llaves de 8 esta semana</small></header>
          <p>Una llave de 8 sorteada cada lunes: cuartos hasta el jueves, semis hasta el sábado, final hasta el lunes.</p>
          <div className="cm9-llave">
            {r.r.map((rd) => (
              <div key={rd.r}><small>{rd.r} · {faltaTxt(rd.hasta)}</small>
                {rd.p.map((m, i) => (
                  <span key={i} className={m[0] === yo || m[1] === yo ? 'tuyo' : undefined}>
                    <b className={m[2] && m[2] === m[0] ? 'g' : ''}>{m[0] ? nombreDe(liga, C, m[0]) : '—'}</b>
                    <b className={m[2] && m[2] === m[1] ? 'g' : ''}>{m[1] ? nombreDe(liga, C, m[1]) : '—'}</b>
                  </span>
                ))}
              </div>
            ))}
          </div>
          {r.campeon ? <p className="cm9-camp"><span className="cm9-tag mag">CAMPEÓN</span> <Nombre liga={liga} C={C} k={r.campeon} yo={yo} /></p> : null}
        </article>
      ) : null}
    </section>
  );
}

/** Lo de adentro de cada mini evento */
function Mini({ liga, C, x, yo }) {
  const N = (k) => nombreDe(liga, C, k);
  let cuerpo = null;
  if (x.id === 'derbi') cuerpo = <><b className="cm9-big">{x.svs[0]} {x.score[0]} <small>vs</small> {x.score[1]} {x.svs[1]}</b><p>Los 5 mejores de cada servidor, uno contra uno. Cada cruce, real o simulado, suma.</p></>;
  else if (x.id === 'meta') cuerpo = <><p>Si entre todos llegamos a {x.objetivo} batallas esta semana, cobran todos los que jugaron.</p><div className="cm9-meta"><i style={{ width: Math.min(100, Math.round(x.n / x.objetivo * 100)) + '%' }} /></div><small>{x.n >= x.objetivo ? '¡Cumplida! ' + x.n + ' batallas: cobran todos los que jugaron' : x.n + ' de ' + x.objetivo + ' batallas'}</small></>;
  else if (x.id === 'supercopa' && x.p) cuerpo = <><b className="cm9-big">{N(x.p[0])} <small>vs</small> {N(x.p[1])}</b><p>Una sola batalla: el que lidera la Élite contra el que lidera el Oro.</p></>;
  else if (x.id === 'duos' || x.id === 'pandillas') cuerpo = <><p>{x.id === 'duos' ? 'Parejas sorteadas: suman los puntos de los dos en la semana.' : 'Grupos de 5 sorteados: suman los puntos de todos en la semana.'}</p><ol className="cm9-mini-t">{x.t.slice(0, 3).map(([g, pts], i) => <li key={i} className={g.includes(yo) ? 'yo' : undefined}><span>{g.map(N).join(' · ')}</span><b>{pts.toLocaleString('es')}</b></li>)}</ol></>;
  else if (x.id === 'rey') cuerpo = <><b className="cm9-big">👑 {N(x.rey)}</b><p>Quien le gane al rey en un cruce real se queda con la corona. {x.defensas ? 'Lleva ' + x.defensas + (x.defensas === 1 ? ' defensa.' : ' defensas.') : ''}</p></>;
  else if (x.id === 'revancha') cuerpo = <><p>Te vuelve a tocar quien te ganó la última vez: ganarle vale doble.</p><small>{x.hechas.length ? x.hechas.length + ' revanchas cumplidas · ' + x.hechas.slice(0, 2).map(([a, b]) => N(a) + ' a ' + N(b)).join(', ') : 'Nadie se cobró la revancha todavía'}</small></>;
  else if (x.id === 'racha') cuerpo = <><p>Gana quien encadene más victorias seguidas en la semana.</p><ol className="cm9-mini-t">{x.t.slice(0, 3).map(([k, n]) => <li key={k} className={k === yo ? 'yo' : undefined}><span>{N(k)}</span><b>{n}</b></li>)}</ol></>;
  else if (x.id === 'novatos') cuerpo = <><p>Una llave de 8 sólo para quienes tienen menos de 5 eventos.</p>{x.campeon ? <small>Campeón: {N(x.campeon)}</small> : <small>{(x.r[0] || { p: [] }).p.map((m) => N(m[0]) + ' vs ' + N(m[1])).slice(0, 2).join(' · ')}</small>}</>;
  return (
    <article className="cm9-ev">
      <div className="cm9-ev-t"><span aria-hidden="true">{x.ic}</span><span className="cm9-tag real">ABIERTO</span></div>
      <h3>{x.nombre.toUpperCase()}</h3>
      {cuerpo}
    </article>
  );
}

function Simulada({ liga, C }) {
  // una simulada de verdad con su jurado: de la jornada que se cerró, o de la Copa
  const todas = todasLasLigas(C).flatMap((g) => (g.j || []).flatMap((j) => j.p)).concat((C.copa || []).flatMap((g) => g.p));
  const m = todas.find((x) => x[3] === 'sim' && Array.isArray(x[5]));
  if (!m) return null;
  return (
    <article className="cm9-card">
      <header className="neg"><h3>ASÍ SE VE UNA SIMULADA</h3><span className="cm9-tag sim">SIMULADO</span></header>
      <div className="cm9-simv">
        <div><b>{nombreDe(liga, C, m[0])}</b><small>{pct(m[4])}</small></div>
        <b className="cm9-tag real">{m[2] === m[0] ? 'GANA' : 'PIERDE'}</b>
        <div><b>{nombreDe(liga, C, m[1])}</b><small>{pct(1 - m[4])}</small></div>
      </div>
      <Jurado liga={liga} C={C} m={m} />
      <p className="cm9-nota">Cada simulada sortea 3 jueces que ya votaron en la Liga. Cada uno vota según su ficha: el que menos coincide con la mayoría es el que se aparta.</p>
    </article>
  );
}

function Equipo({ liga, C, yo }) {
  if (!(C.equipo || []).length) return null;
  return (
    <article className="cm9-card">
      <header className="oro"><h3>EQUIPO DE LA SEMANA</h3><small>Las 5 mejores notas</small></header>
      <ol className="cm9-eq">
        {C.equipo.map(([k, nota], i) => (
          <li key={k} className={k === yo ? 'yo' : undefined}>
            {i === 0 ? <span className="cm9-tag mvp">MVP</span> : <span className="cm9-et">{i + 1}</span>}
            <Nombre liga={liga} C={C} k={k} yo={yo} />
            <b className={nota >= 8 ? 'alta' : ''}>{nota.toFixed(1)}</b>
          </li>
        ))}
      </ol>
      <p className="cm9-nota">Sale de la nota 1–10 de cada batalla de la semana.</p>
    </article>
  );
}

const PREGUNTAS = [
  ['¿Por qué no aparezco?', 'Entra quien jugó al menos un evento en las 2 semanas antes del lunes. En las ligas entras al arrancar la temporada que viene, en Ascenso.'],
  ['¿Tengo que hacer algo?', 'No. No hay inscripción ni botón: tus batallas de siempre cuentan solas. Sólo mira quién te toca y búscalo en los eventos.'],
  ['¿Se puede arreglar una simulación?', 'No. Lo mismo da siempre el mismo resultado y cualquiera puede rehacer la cuenta. Un resultado real nunca se inventa.'],
  ['¿Qué gano?', 'Subir de liga y Puntos de Tienda según tu puesto. Y la Élite: los 10 mejores del Competitivo la juegan además de su liga.'],
];

export function Competencias({ liga, dc }) {
  const C = useCompetencias();
  const [busca, setBusca] = useState('');
  const [div, setDiv] = useState(-1);
  const [ver, setVer] = useState(15);
  const como = useRef(null);
  const grupos = useRef(null);
  const yo = (liga && liga.yo && liga.yo.k) || (dc && dc.clave) || '';
  const donde = useMemo(() => dondeEstoy(C, yo), [C, yo]);
  if (!C) return <div className="cargando">Cargando las competencias…</div>;
  if (!C.ligas) return <div className="cargando">Las competencias se están armando: vuelve en un rato.</div>;
  const q = busca.trim().toLowerCase();
  const divs = [...new Set((C.copa || []).map((g) => g.div))].sort();
  const gs = (C.copa || []).filter((g) => (div < 0 || g.div === div)
    && (!q || g.id.toLowerCase() === q || g.t.some(([k]) => nombreDe(liga, C, k).toLowerCase().includes(q))));
  const ir = (r) => r.current && r.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <div className="cm9">
      <Escena liga={liga} C={C} yo={yo} donde={donde} onComo={() => ir(como)} />
      <Dias C={C} />
      <Ligas liga={liga} C={C} yo={yo} donde={donde} />
      <CopaRapid liga={liga} C={C} yo={yo} donde={donde} onGrupos={() => ir(grupos)} />

      {(C.mini || []).length ? (
        <section className="cm9-sec" aria-label="Más mini eventos">
          <div className="cm9-cab"><div><h2>MÁS MINI EVENTOS</h2><p>Rotan cada semana: siempre hay algo abierto, nunca todo a la vez.</p></div><span className="cm9-et">Esta semana · {C.mini.length} abiertos</span></div>
          <div className="cm9-evs">
            {C.mini.map((x) => <Mini key={x.id} liga={liga} C={C} x={x} yo={yo} />)}
          </div>
          {(C.pronto || []).length ? (
            <p className="cm9-pronto"><span className="cm9-tag pend">PRONTO</span>{C.pronto.map(([id, ic, n]) => <span key={id}>{ic} {n}</span>)}</p>
          ) : null}
        </section>
      ) : null}

      <section className="cm9-dos cm9-sec" aria-label="El equipo de la semana">
        <Simulada liga={liga} C={C} />
        <Equipo liga={liga} C={C} yo={yo} />
      </section>

      <section className="cm9-como" aria-label="Cómo se juega" ref={como}>
        <div className="cm9-cab"><div><span className="cm9-chip">PARA EMPEZAR</span><h2>CÓMO SE JUEGA</h2></div><p>No hay que anotarse en nada: <b>juegas tus eventos de siempre</b> y esto se arma solo.</p></div>
        <ol className="cm9-pasos">
          <li><b>1</b><h3>JUEGA</h3><p>Cualquier evento de un servidor de la Liga. Con <b>1 evento en las últimas 2 semanas</b> ya entras el lunes.</p></li>
          <li><b>2</b><h3>TE TOCAN RIVALES</h3><p>Tu liga (y la Élite, si estás entre los 10 mejores), tu grupo de la Copa y tu Rapid. Los ves arriba, en «Tu próximo cruce».</p></li>
          <li><b>3</b><h3>CRÚZATE</h3><p>Si te enfrentas a tu rival en un 1v1 de <b>cualquier evento</b> antes del cierre, cuenta esa batalla. Si no, se simula con tu nivel.</p></li>
          <li><b>4</b><h3>SUMA Y SUBE</h3><p>Ganar da <b>3 puntos</b>. Al final de las 9 jornadas, los 2 primeros de cada liga suben y los 2 últimos bajan.</p></li>
        </ol>
        <ul className="cm9-glos">
          <li><span className="cm9-tag real">REAL</span>Se cruzaron de verdad en un evento: cuenta esa batalla, y dice en cuál.</li>
          <li><span className="cm9-tag sim">SIMULADO</span>No se cruzaron: decide el nivel de cada uno, con un jurado sorteado. Los batacazos pasan.</li>
          <li><span className="cm9-tag pend">65 %</span>Tus chances si se simula. Salen de tu Score competitivo y tu forma de las últimas batallas.</li>
        </ul>
      </section>

      <section className="cm9-sec" aria-label="Preguntas">
        <h2 className="cm9-h2">PREGUNTAS</h2>
        <div className="cm9-faq">{PREGUNTAS.map(([p, r]) => <div key={p}><h3>{p}</h3><p>{r}</p></div>)}</div>
      </section>

      <section className="cm9-grupos" aria-label="Los grupos de la Copa" ref={grupos}>
        <div className="cm9-gcab">
          <h2>LOS {(C.copa || []).length} GRUPOS DE LA COPA</h2>
          <div className="cm9-gfil" role="radiogroup" aria-label="División">
            <button type="button" role="radio" aria-checked={div < 0} className={div < 0 ? 'on' : ''} onClick={() => setDiv(-1)}>Todos {(C.copa || []).length}</button>
            {divs.map((d) => <button key={d} type="button" role="radio" aria-checked={div === d} className={div === d ? 'on' : ''} onClick={() => setDiv(d)}>{DIVISIONES[d]} {(C.copa || []).filter((g) => g.div === d).length}</button>)}
          </div>
          <input type="search" placeholder="Buscar un rapero o grupo…" value={busca} onChange={(e) => { setBusca(e.target.value); setVer(15); }} aria-label="Buscar en la Copa" />
        </div>
        <div className="cm9-gs">
          {gs.slice(0, ver).map((g) => (
            <article key={g.id} className={g.t.some(([k]) => k === yo) ? 'yo' : undefined}>
              <header><b>GRUPO {g.id}</b><small>{DIVISIONES[g.div]}</small></header>
              {g.t.map(([k, , , pts], i) => <span key={k} className={i < 2 ? 'pasa' : undefined}><Nombre liga={liga} C={C} k={k} yo={yo} /><b>{pts}</b></span>)}
            </article>
          ))}
        </div>
        {gs.length > ver ? <button type="button" className="cm9-btn inv" onClick={() => setVer(ver + 30)}>Ver más grupos ({gs.length - ver})</button> : null}
        {!gs.length ? <p className="cm9-nada">Nadie se llama así en la Copa de esta semana.</p> : null}
      </section>
    </div>
  );
}
