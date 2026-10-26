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
// Lo arma `bot/competencias.py`; acá sólo se dibuja.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Cara, Carta, nombrePais } from './piezas.jsx';
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
      {como === 'pend' && a && b ? (
        <span className="cm9-p" title={'Si no se cruzan antes del cierre, se simula: ' + nombreDe(liga, C, a) + ' gana ' + pct(p) + ' de las veces'}>
          <small>Chances si se simula</small>
          <span className="cm9-p-b"><i style={{ width: ancho(p) }} /></span>
          <span className="cm9-p-n"><b>{pct(p)}</b><b>{pct(1 - p)}</b></span>
        </span>
      ) : null}
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
            <Carta liga={liga} k={a} cual={liga.cartaDe(a, { comp: true }) || 'temporada'} cls="cm9-vs-img" />
            <b>VS</b>
            <Carta liga={liga} k={b} cual={liga.cartaDe(b, { comp: true }) || 'temporada'} cls="cm9-vs-img" />
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
              <b>⭐ LIGA ÉLITE</b><small>En paralelo · los 10 mejores del Competitivo con su carta Competitiva{donde && donde.elite ? ' · tú' : ''}</small>
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
            <div><h3>LIGA {nombreLiga(C, g).toUpperCase()}</h3><small>{g.id === 'elite' ? 'Los 10 mejores del Competitivo · con carta Competitiva' : g.t.length + ' raperos'}{g.id === mia ? ' · tu liga' : ''}</small></div>
            <div className="cm9-jder">
              <div className="cm9-jbar" aria-label={'Jornada ' + L.jornada + ' de 9'}>{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <i key={n} className={n < L.jornada ? 'ya' : n === L.jornada ? 'hoy' : ''} />)}</div>
              <a className="cm9-info" href="#/competencias/ligas">Más información</a>
            </div>
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

/** Un lado de un cruce: cara, nombre y, según cómo va, la ✓ del que pasó o sus chances si se simula */
function Lado({ liga, C, k, m, pos, yo }) {
  const [a, b, g, como, p] = m;
  if (!k) return <span className="cm9-br-l vacio">{como === 'pase' ? 'pase libre' : 'por definir'}</span>;
  const n = nombreDe(liga, C, k);
  const gano = g && g === k;
  const chance = como === 'pend' && a && b ? (pos === 0 ? p : 1 - p) : null;
  return (
    <span className={'cm9-br-l' + (gano ? ' g' : g ? ' out' : '') + (k === yo ? ' yo' : '')}>
      <Cara liga={liga} k={k} nombre={n} cls="cara cm9-br-cara" lazy />
      <b>{n}</b>
      {gano ? <i className="cm9-br-ok" aria-label="pasó">✓</i> : chance != null ? <i className="cm9-br-pc">{pct(chance)}</i> : null}
    </span>
  );
}

/** 🏆 UNA LLAVE COMO CUADRO (Dlx, 26/10/2026: «esto es muy simple»): una columna por ronda con los cruces centrados entre
 *  los dos de los que vienen, la cara de cada uno, quién pasó y las chances de lo que falta, tu camino marcado, y al
 *  final la copa. En el celular se desliza de costado y abre en la ronda que se está jugando */
function Llave({ liga, C, r, yo }) {
  const caja = useRef(null);
  const ia = r.campeon ? r.r.length : Math.max(0, r.r.findIndex((rd) => rd.p.some((m) => !m[2] && m[0] && m[1])));
  useEffect(() => {
    const el = caja.current;
    const col = el && el.children[ia];
    // ⚠️ por la caja y no por `offsetLeft`, que mide contra el padre posicionado y no contra el que se desliza
    if (el && col && ia > 0 && el.scrollWidth > el.clientWidth) el.scrollLeft = Math.max(0, col.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft - 16);
  }, [ia]);
  return (
    <div className="cm9-br" ref={caja} style={{ '--n': r.r.length + 1 }}>
      {r.r.map((rd, ri) => (
        <div key={rd.r} className={'cm9-br-c' + (ri === ia ? ' hoy' : ri < ia ? ' ya' : '')}>
          <small className="cm9-br-t">{rd.r === 'Semifinal' ? 'Semis' : rd.r}<i>{ri < ia ? 'jugada' : faltaTxt(rd.hasta)}</i></small>
          <div className="cm9-br-ms">
            {rd.p.map((m, i) => (
              <div key={i} className={'cm9-br-m ' + m[3] + (yo && (m[0] === yo || m[1] === yo) ? ' tuyo' : '')}
                title={m[3] === 'real' ? 'Se cruzaron de verdad' + (m[5] && !Array.isArray(m[5]) ? ' en el #' + m[5] : '') : m[3] === 'sim' ? 'Simulado al cierre' : undefined}>
                <Lado liga={liga} C={C} k={m[0]} m={m} pos={0} yo={yo} />
                <Lado liga={liga} C={C} k={m[1]} m={m} pos={1} yo={yo} />
                {m[3] === 'real' || m[3] === 'sim' ? <em className={'cm9-br-como ' + m[3]}>{m[3] === 'real' ? 'REAL' : 'SIM'}</em> : null}
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className={'cm9-br-c fin' + (r.campeon ? ' hoy' : '')}>
        <small className="cm9-br-t">Campeón</small>
        <div className="cm9-br-ms">
          <div className={'cm9-br-copa' + (r.campeon ? ' ok' : '') + (r.campeon && r.campeon === yo ? ' tuyo' : '')}>
            <span aria-hidden="true">🏆</span>
            {r.campeon ? <><Cara liga={liga} k={r.campeon} nombre={nombreDe(liga, C, r.campeon)} cls="cara cm9-br-cara" /><b><Nombre liga={liga} C={C} k={r.campeon} yo={yo} /></b></> : <b>por definir</b>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** «Octavos», «Afuera en cuartos», «Campeón»: en qué va alguien en una llave */
const estado = (e) => (!e ? '' : e.campeon ? 'Campeón' : e.fuera ? 'Afuera en ' + ((e.ronda || {}).r || 'octavos').toLowerCase() : (e.ronda || {}).r || '');

/** 🎯 Tu situación en una llave, en una línea: contra quién vas, tus chances y cuándo cierra */
function TuLlave({ liga, C, e, yo }) {
  if (e.campeon) return <p className="cm9-br-tu"><b>🏆 Campeón</b> de esta llave.</p>;
  if (e.fuera) return <p className="cm9-br-tu">Quedaste <b>afuera en {((e.ronda || {}).r || 'octavos').toLowerCase()}</b>. El lunes arranca otra.</p>;
  const m = ((e.ronda || {}).p || []).find((x) => x[0] === yo || x[1] === yo);
  if (!m) return null;
  const rival = m[0] === yo ? m[1] : m[0];
  const mia = m[0] === yo ? m[4] : 1 - m[4];
  return (
    <p className="cm9-br-tu">Vas en <b>{e.ronda.r === 'Semifinal' ? 'semis' : e.ronda.r.toLowerCase()}</b>
      {rival ? <> contra <b><Nombre liga={liga} C={C} k={rival} yo={yo} /></b>: <b>{pct(mia)}</b> si se simula</> : <>: esperando rival</>}
      {' '}· cierra en {faltaTxt(e.ronda.hasta)}. Si se cruzan en cualquier evento, cuenta esa batalla.</p>
  );
}

/** 🏆⚡ LA COPA Y LA RAPID: SÓLO TU LLAVE (Dlx, 26/10/2026: «no es necesario ver las 19 llaves si no estás tú»). Quien
 *  no está en ninguna —el dueño, o quien no jugó— ve la de más arriba, para saber cómo es */
function CopaRapid({ liga, C, yo, donde }) {
  const ec = donde && donde.copa;
  const er = donde && donde.rapid;
  const g = (ec && ec.r) || (C.copa || [])[0];
  const r = (er && er.r) || (C.rapid || [])[0];
  return (
    <section className="cm9-dos cm9-dos-br" aria-label="La Copa y la Rapid">
      {g ? (
        <article className="cm9-card">
          <header className="mag"><h3>🏆 COPA</h3><small>{ec ? 'Tu llave · ' + estado(ec) : 'Llave ' + g.id + ' · ' + DIVISIONES[g.div]}</small></header>
          {ec ? <TuLlave liga={liga} C={C} e={ec} yo={yo} />
            : <p>Una llave de 16 cada lunes, con gente de tu división: octavos, cuartos, semis y final, una ronda cada dos días. Esta semana no estás en ninguna: entras jugando un evento.</p>}
          <Llave liga={liga} C={C} r={g} yo={yo} />
        </article>
      ) : null}
      {r ? (
        <article className="cm9-card">
          <header className="ver"><h3>⚡ RAPID</h3><small>{er ? 'Tu llave · ' + estado(er) : 'Llave de 8 de esta semana'}</small></header>
          {er ? <TuLlave liga={liga} C={C} e={er} yo={yo} />
            : <p>Una llave de 8 con gente de tu mismo nivel, armada cada lunes: cuartos hasta el jueves, semis hasta el sábado, final hasta el lunes.</p>}
          <Llave liga={liga} C={C} r={r} yo={yo} />
        </article>
      ) : null}
    </section>
  );
}

/** 🎲 Cada mini evento explicado: qué es, quién juega y cómo se gana (la subpágina, #/competencias/mini) */
const EXPLICA = {
  derbi: ['Dos servidores sorteados entre los que tienen 5 o más activos. Sus 5 mejores se cruzan uno contra uno.', 'Los 5 mejores de cada servidor, por su nivel.', 'Gana el servidor que se lleve más cruces. Cuenta lo real si se cruzan en un evento; si no, se simula al cierre.'],
  paises: ['Dos países sorteados entre los que tienen 5 o más activos. Sus 5 mejores se cruzan uno contra uno.', 'Los 5 mejores de cada país, por su nivel.', 'Gana el país que se lleve más cruces. Real si se cruzan, simulado si no.'],
  meta: ['Una meta para toda la Liga: llegar a una cantidad de batallas en la semana entre todos.', 'Todos los que jueguen esa semana.', 'Si se llega, cobran todos los que jugaron. La meta sale de la semana anterior, un 10 % más.'],
  supercopa: ['Una sola batalla al cierre: el que lidera la Élite contra el que lidera el Oro.', 'Los dos líderes.', 'Real si se cruzan durante la semana; si no, se simula.'],
  duos: ['Parejas sorteadas entre los que juegan: suman los puntos de Temporada de los dos en la semana.', 'Todos los activos, de a dos.', 'Gana la pareja que más puntos sume.'],
  pandillas: ['Grupos de 5 sorteados (no son las crews): suman los puntos de Temporada de todos en la semana.', 'Todos los activos, de a cinco.', 'Gana la pandilla que más puntos sume.'],
  rey: ['Hay un rey: el de más nivel al arrancar. Quien le gane en un cruce real se queda con la corona.', 'Cualquiera que se cruce con el rey en un evento.', 'Es rey quien tenga la corona al cierre. Cada batalla que el rey gana es una defensa.'],
  revancha: ['Te vuelve a tocar quien te ganó la última vez.', 'Todos los que perdieron algún 1v1 en los últimos 60 días.', 'Si esta semana le ganas a quien te ganó, revancha cumplida: vale doble.'],
  racha: ['Victorias seguidas en la semana, en cualquier evento.', 'Todos los que juegan 1v1.', 'Gana la racha más larga de la semana.'],
  novatos: ['Una llave de 8 sólo para quienes tienen menos de 5 eventos.', 'Los que recién empiezan.', 'Como la Rapid: cuartos, semis y final, real si se cruzan y simulado si no.'],
  escalera: ['10 escalones: tu carta contra otra de tu nivel. Ganas subes, pierdes bajas, y de los escalones dorados no se baja.', 'Todos, con 3 intentos por día.', 'Se prepara: pide que juegues desde la página.'],
  fantasy: ['Eliges 3 raperos y sumas las notas que saquen en la semana.', 'Todos los que armen su equipo.', 'Se prepara: pide elegir desde la página.'],
  crews: ['Crew contra crew el fin de semana. Suma el que sube, el que se mantiene y hasta el que baja.', 'Las crews de la Liga.', 'Se prepara.'],
};

/** Lo de adentro de cada mini evento */
/** El color de cada mini evento: el cuadro de su ícono y su barra */
const COLOR_MINI = { derbi: '#E41373', paises: '#29B298', meta: '#E41373', supercopa: '#F5C542', duos: '#B07CFF', pandillas: '#56A2F2',
  rey: '#F5C542', revancha: '#E41373', racha: '#FF7A2F', novatos: '#29B298' };
const MEDALLA = ['🥇', '🥈', '🥉'];

/** Un podio de 3 con barra (Dúos, Pandillas, Racha): el 1.º llena la barra y los demás en proporción */
function Podio({ filas, yo, nombre, valor, sufijo = '' }) {
  if (!filas.length) return <p className="cm9-ev-nada">Todavía nadie suma esta semana.</p>;
  const tope = Math.max(1, ...filas.map(valor));
  return (
    <ol className="cm9-pod">
      {filas.map((f, i) => (
        <li key={i} className={nombre(f).yo ? 'yo' : undefined}>
          <span className="cm9-pod-m" aria-hidden="true">{MEDALLA[i] || i + 1}</span>
          <span className="cm9-pod-n">{nombre(f).t}</span>
          <b>{valor(f).toLocaleString('es')}{sufijo}</b>
          <i className="cm9-pod-b" style={{ width: Math.max(6, Math.round(valor(f) / tope * 100)) + '%' }} />
        </li>
      ))}
    </ol>
  );
}

/** Lo de adentro de cada mini evento: qué es en una línea, cómo va (con números que se leen de un vistazo) y tu lugar */
function Mini({ liga, C, x, yo, completo }) {
  const N = (k) => nombreDe(liga, C, k);
  const lado = (s) => (x.id === 'paises' ? nombrePais(s) : s);
  const ex = EXPLICA[x.id] || ['', '', ''];
  let cuerpo = null, tuyo = null;
  if (x.id === 'derbi' || x.id === 'paises') {
    const [a, b] = x.score;
    const t = a + b || 1;
    cuerpo = (
      <div className="cm9-guerra">
        <div className="cm9-guerra-n"><span>{lado(x.svs[0])}</span><b>{a} – {b}</b><span>{lado(x.svs[1])}</span></div>
        <div className="cm9-guerra-b" aria-hidden="true"><i style={{ width: Math.round(a / t * 100) + '%' }} /></div>
        <small>{x.p.filter((m) => m[2]).length} de {x.p.length} cruces resueltos · {x.p.filter((m) => m[3] === 'real').length} reales</small>
      </div>
    );
    const m = x.p.find((p) => p[0] === yo || p[1] === yo);
    if (m) tuyo = 'Estás en la guerra: contra ' + N(m[0] === yo ? m[1] : m[0]);
  } else if (x.id === 'meta') {
    const pc = Math.min(100, Math.round(x.n / x.objetivo * 100));
    cuerpo = (
      <div className="cm9-meta-v">
        <b>{x.n}<small> / {x.objetivo}</small></b>
        <div className="cm9-meta"><i style={{ width: pc + '%' }} /></div>
        <small>{x.n >= x.objetivo ? '¡Cumplida! Cobran todos los que jugaron.' : 'Faltan ' + (x.objetivo - x.n) + ' batallas · ' + pc + ' %'}</small>
      </div>
    );
  } else if (x.id === 'supercopa' && x.p) {
    cuerpo = (
      <div className="cm9-guerra">
        <div className="cm9-guerra-n"><span>{N(x.p[0])}</span><b>vs</b><span>{N(x.p[1])}</span></div>
        <small>{x.p[2] ? 'Ganó ' + N(x.p[2]) + (x.p[3] === 'real' ? ' · real' : ' · simulado') : 'Por jugar · ' + Math.round(x.p[4] * 100) + ' % – ' + Math.round((1 - x.p[4]) * 100) + ' %'}</small>
      </div>
    );
  } else if (x.id === 'duos' || x.id === 'pandillas') {
    const filas = completo ? x.t : x.t.slice(0, 3);
    cuerpo = <Podio filas={filas} yo={yo} nombre={([g]) => ({ t: g.map(N).join(' · '), yo: g.includes(yo) })} valor={([, p]) => p} />;
    const i = x.t.findIndex(([g]) => g.includes(yo));
    if (i >= 0) tuyo = 'Tu ' + (x.id === 'duos' ? 'pareja' : 'pandilla') + ' va ' + (i + 1) + '.ª de ' + x.n;
  } else if (x.id === 'rey') {
    cuerpo = (
      <div className="cm9-rey">
        <span className="cm9-rey-c" aria-hidden="true">👑</span>
        <div><b>{N(x.rey)}</b><small>{x.defensas ? x.defensas + (x.defensas === 1 ? ' defensa' : ' defensas') : 'Todavía nadie lo desafió'}</small></div>
        {x.reyes.length > 1 ? <p className="cm9-rey-h">{x.reyes.map(N).join(' → ')}</p> : null}
      </div>
    );
    if (x.rey === yo) tuyo = 'Eres el rey: defiéndelo';
  } else if (x.id === 'revancha') {
    cuerpo = (
      <div className="cm9-meta-v">
        <b>{x.hechas.length}<small> cobradas</small></b>
        <small>{x.hechas.length ? x.hechas.slice(0, 3).map(([a, b]) => N(a) + ' a ' + N(b)).join(' · ') : 'Nadie se cobró la revancha todavía'} · {x.pendientes} con una pendiente</small>
      </div>
    );
  } else if (x.id === 'racha') {
    cuerpo = <Podio filas={completo ? x.t : x.t.slice(0, 3)} yo={yo} nombre={([k]) => ({ t: N(k), yo: k === yo })} valor={([, n]) => n} sufijo=" 🔥" />;
  } else if (x.id === 'novatos') {
    cuerpo = x.campeon ? <div className="cm9-rey"><span className="cm9-rey-c" aria-hidden="true">🌱</span><div><b>{N(x.campeon)}</b><small>Campeón de los novatos</small></div></div>
      : <small>{(x.r[0] || { p: [] }).p.map((m) => N(m[0]) + ' vs ' + N(m[1])).slice(0, 2).join(' · ')}</small>;
  }
  return (
    <article className={'cm9-ev rico' + (completo ? ' completo' : '')} style={{ '--c': COLOR_MINI[x.id] || '#29B298' }}>
      <div className="cm9-ev-t">
        <span className="cm9-ev-ic" aria-hidden="true">{x.ic}</span>
        <span className="cm9-ev-cierra"><span className="cm9-tag real">ABIERTO</span><small>cierra en {faltaTxt(C.fin)}</small></span>
      </div>
      <h3>{x.nombre.toUpperCase()}</h3>
      <p className="cm9-ev-q">{ex[0]}</p>
      {cuerpo}
      {tuyo ? <p className="cm9-ev-tuyo">⭐ {tuyo}</p> : null}
      {completo && (x.id === 'derbi' || x.id === 'paises') ? <ul className="cm9-crus">{x.p.map((m) => <Cruce key={m[0] + m[1]} liga={liga} C={C} m={m} yo={yo} jurado />)}</ul> : null}
      {completo && x.id === 'novatos' ? <Llave liga={liga} C={C} r={x} yo={yo} /> : null}
      {completo ? <dl className="cm9-ex"><div><dt>Quién juega</dt><dd>{ex[1]}</dd></div><div><dt>Cómo se gana</dt><dd>{ex[2]}</dd></div></dl>
        : <p className="cm9-ev-gana"><b>Cómo se gana:</b> {ex[2]}</p>}
    </article>
  );
}

/** ⏳ «Abre en 7 h»: los que vienen la semana que viene, y los que se preparan */
function Vienen({ C, completo }) {
  if (!(C.proxima || []).length && !(C.pronto || []).length) return null;
  return (
    <div className="cm9-vienen">
      {(C.proxima || []).map(([id, ic, n]) => (
        <article key={id} className="cm9-ev viene">
          <div className="cm9-ev-t"><span aria-hidden="true">{ic}</span><span className="cm9-tag pend">ABRE EN {faltaTxt(C.fin).toUpperCase()}</span></div>
          <h3>{n.toUpperCase()}</h3>
          {completo && EXPLICA[id] ? <p>{EXPLICA[id][0]}</p> : null}
        </article>
      ))}
      {(C.pronto || []).map(([id, ic, n]) => (
        <article key={id} className="cm9-ev prep">
          <div className="cm9-ev-t"><span aria-hidden="true">{ic}</span><span className="cm9-tag pend">EN PREPARACIÓN</span></div>
          <h3>{n.toUpperCase()}</h3>
          {completo && EXPLICA[id] ? <p>{EXPLICA[id][0]}</p> : null}
        </article>
      ))}
    </div>
  );
}

/** 🥇 LAS LIGAS, EN DETALLE (#/competencias/ligas). Dlx, 26/10/2026: «un botón al costado de las barras que indican en
 * qué jornada van… más información, y ahí se ve su propia página explicando más a detalle» */
function LigasInfo({ liga, C, yo }) {
  const L = C.ligas || {};
  const donde = dondeEstoy(C, yo);
  const fecha = (iso) => new Date(iso).toLocaleDateString('es', { timeZone: 'America/New_York', weekday: 'long', day: 'numeric', month: 'long' });
  const todas = todasLasLigas(C);
  return (
    <div className="cm9">
      <section className="cm9-esc corta" aria-label="Las ligas">
        <div className="cm9-esc-t">
          <a className="cm9-volver" href="#/competencias">← Competencias</a>
          <span className="cm9-chip">LIGAS · TEMPORADA {L.temp}</span>
          <h1>CÓMO FUNCIONAN LAS LIGAS</h1>
          <p>Ligas de 10 por niveles, como en Top Eleven. Cada temporada dura <b>3 semanas</b> y tiene <b>9 jornadas</b>: al final, los 2 primeros de cada liga suben y los 2 últimos bajan.</p>
          <dl className="cm9-stats">
            <div><dt>Jornada</dt><dd>{L.jornada} / 9</dd></div>
            <div><dt>Ligas</dt><dd>{(L.g || []).length}</dd></div>
            <div><dt>Termina</dt><dd className="v">{faltaTxt(L.hasta)}</dd></div>
          </dl>
          {donde && (donde.liga || donde.elite) ? (
            <p>Estás en la <b>Liga {nombreLiga(C, (donde.liga || donde.elite).g)}</b>, {(donde.liga || donde.elite).pos}.º{donde.liga && donde.elite ? ', y además en la Élite (' + donde.elite.pos + '.º)' : ''}.</p>
          ) : null}
        </div>
      </section>

      <section className="cm9-sec" aria-label="Las reglas">
        <div className="cm9-cab"><div><h2>LAS REGLAS</h2></div></div>
        <ol className="cm9-reglas">
          <li><b>Los niveles</b><p>De arriba abajo: <b>Oro</b> (1 liga), <b>Plata</b> (2), <b>Bronce</b> (4) y <b>Ascenso</b> (las que hagan falta). Cada liga tiene unos 10 raperos.</p></li>
          <li><b>Quién juega</b><p>Todos los que jugaron al menos un evento en las 2 semanas antes de que arranque la temporada. Quien entra después empieza en Ascenso la temporada siguiente.</p></li>
          <li><b>Las jornadas</b><p>Todos contra todos: en cada jornada te toca un rival. Las jornadas cierran los <b>lunes, miércoles y viernes a las 11 AM</b> (hora del este).</p></li>
          <li><b>Cómo sale cada cruce</b><p>Si te enfrentas a tu rival en un 1v1 de <b>cualquier evento de cualquier servidor</b> antes del cierre, cuenta esa batalla. Si no se cruzan, se simula con el nivel de cada uno (su Score y su forma), con un jurado sorteado.</p></li>
          <li><b>Los puntos</b><p>Ganar da <b>3 puntos</b>. La tabla se ordena por puntos, después por victorias reales y después por nivel.</p></li>
          <li><b>Subir y bajar</b><p>Al terminar las 9 jornadas, los <b>2 primeros suben</b> de nivel y los <b>2 últimos bajan</b>. En Oro no se sube más; en Ascenso no se baja.</p></li>
          <li><b>⭐ La Élite</b><p>Se juega <b>además</b> de tu liga, con el mismo calendario. Es de los 10 mejores del Competitivo que estén activos y <b>tengan su carta Competitiva</b>: sin la carta no se entra.</p></li>
          <li><b>Los premios</b><p>Subir de liga, y Puntos de Tienda según tu puesto.</p></li>
        </ol>
      </section>

      <section className="cm9-sec" aria-label="El calendario">
        <div className="cm9-cab"><div><h2>EL CALENDARIO</h2><p>Las 9 jornadas de esta temporada.</p></div></div>
        <ol className="cm9-cal">
          {(L.cierres || []).map((x, i) => (
            <li key={x} className={i + 1 < L.jornada ? 'ya' : i + 1 === L.jornada ? 'hoy' : undefined}>
              <b>J{i + 1}</b><span>Cierra el {fecha(x)}</span><small>{new Date(x).getTime() < Date.now() ? 'cerrada' : 'en ' + faltaTxt(x)}</small>
            </li>
          ))}
        </ol>
      </section>

      <section className="cm9-sec" aria-label="Todas las ligas">
        <div className="cm9-cab"><div><h2>TODAS LAS LIGAS</h2><p>El que va primero en cada una.</p></div></div>
        <div className="cm9-todas">
          {todas.map((g) => (
            <a key={g.id} href="#/competencias" className={g.t.some((x) => x[0] === yo) ? 'yo' : undefined} style={{ '--c': g.id === 'elite' ? '#F5C542' : NIVEL[g.nv].c }}>
              <b>{nombreLiga(C, g)}</b>
              <span>{g.t[0] ? nombreDe(liga, C, g.t[0][0]) : '—'}</span>
              <small>{g.t[0] ? g.t[0][3] + ' pts' : ''}</small>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

/** 🎲 LA SUBPÁGINA DE LOS MINI EVENTOS (#/competencias/mini). Dlx, 26/10/2026: «puedes crear una subpágina sobre ellos…
 * y ahí explicar más… para lo que dice pronto crear un countdown… abre en X» */
function MiniPagina({ liga, C, yo }) {
  return (
    <div className="cm9">
      <section className="cm9-esc corta" aria-label="Mini eventos">
        <div className="cm9-esc-t">
          <a className="cm9-volver" href="#/competencias">← Competencias</a>
          <span className="cm9-chip">MINI EVENTOS · T1</span>
          <h1>CADA SEMANA, OTROS</h1>
          <p>Cada lunes a las 11 AM se abren <b>{(C.mini || []).length || 4} mini eventos</b>, sorteados de un catálogo de {Object.keys(EXPLICA).length}. Duran la semana y se juegan solos con tus batallas, como todo en Competencias.</p>
          <dl className="cm9-stats">
            <div><dt>Abiertos</dt><dd>{(C.mini || []).length}</dd></div>
            <div><dt>Los próximos abren en</dt><dd className="v">{faltaTxt(C.fin)}</dd></div>
          </dl>
        </div>
      </section>
      <section className="cm9-sec" aria-label="Abiertos esta semana">
        <div className="cm9-cab"><div><h2>ABIERTOS ESTA SEMANA</h2><p>Cierran el lunes a las 11 AM.</p></div></div>
        <div className="cm9-evs grande">{(C.mini || []).map((x) => <Mini key={x.id} liga={liga} C={C} x={x} yo={yo} completo />)}</div>
      </section>
      <section className="cm9-sec" aria-label="Los que vienen">
        <div className="cm9-cab"><div><h2>LOS QUE VIENEN</h2><p>Los de la semana que viene ya están sorteados. Los que se preparan todavía no tienen fecha.</p></div></div>
        <Vienen C={C} completo />
      </section>
    </div>
  );
}

function Simulada({ liga, C }) {
  // una simulada de verdad con su jurado: de la jornada que se cerró, o de la Copa
  const todas = todasLasLigas(C).flatMap((g) => (g.j || []).flatMap((j) => j.p))
    .concat((C.copa || []).concat(C.rapid || []).flatMap((r) => r.r.flatMap((rd) => rd.p)));
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
  ['¿Es sólo para los del Competitivo?', 'No: las ligas, la Copa, la Rapid y los mini eventos son para todos los que jugaron en las últimas 2 semanas. Sólo la Élite pide la carta Competitiva: es de los 10 mejores del Competitivo, y ellos juegan además su liga.'],
  ['¿Tengo que hacer algo?', 'No. No hay inscripción ni botón: tus batallas de siempre cuentan solas. Sólo mira quién te toca y búscalo en los eventos.'],
  ['¿Se puede arreglar una simulación?', 'No. Lo mismo da siempre el mismo resultado y cualquiera puede rehacer la cuenta. Un resultado real nunca se inventa.'],
  ['¿Qué gano?', 'Subir de liga y Puntos de Tienda según tu puesto. Y la Élite: los 10 mejores del Competitivo, con su carta Competitiva, la juegan además de su liga.'],
];

export function Competencias({ liga, dc, sub = '' }) {
  const C = useCompetencias();
  const como = useRef(null);
  const yo = (liga && liga.yo && liga.yo.k) || (dc && dc.clave) || '';
  const donde = useMemo(() => dondeEstoy(C, yo), [C, yo]);
  if (!C) return <div className="cargando">Cargando las competencias…</div>;
  if (!C.ligas) return <div className="cargando">Las competencias se están armando: vuelve en un rato.</div>;
  if (sub === 'mini') return <MiniPagina liga={liga} C={C} yo={yo} />;
  if (sub === 'ligas') return <LigasInfo liga={liga} C={C} yo={yo} />;
  const ir = (r) => r.current && r.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <div className="cm9">
      <Escena liga={liga} C={C} yo={yo} donde={donde} onComo={() => ir(como)} />
      <Dias C={C} />
      <Ligas liga={liga} C={C} yo={yo} donde={donde} />
      <CopaRapid liga={liga} C={C} yo={yo} donde={donde} />

      {(C.mini || []).length ? (
        <section className="cm9-sec" aria-label="Más mini eventos">
          <div className="cm9-cab"><div><h2>MÁS MINI EVENTOS</h2><p>Rotan cada semana: siempre hay algo abierto, nunca todo a la vez.</p></div><a className="cm9-ver" href="#/competencias/mini">Todos y cómo se juegan →</a></div>
          <div className="cm9-evs">
            {C.mini.map((x) => <Mini key={x.id} liga={liga} C={C} x={x} yo={yo} />)}
          </div>
          {(C.proxima || []).length ? (
            <p className="cm9-pronto"><span className="cm9-tag pend">ABREN EN {faltaTxt(C.fin).toUpperCase()}</span>{C.proxima.map(([id, ic, n]) => <span key={id}>{ic} {n}</span>)}</p>
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
          <li><span className="cm9-tag pend">65 %</span>Tus chances si se simula. Salen de tu nivel: a quién le ganaste y con quién perdiste en todas tus batallas 1v1 de la temporada.</li>
        </ul>
      </section>

      <section className="cm9-sec" aria-label="Preguntas">
        <h2 className="cm9-h2">PREGUNTAS</h2>
        <div className="cm9-faq">{PREGUNTAS.map(([p, r]) => <div key={p}><h3>{p}</h3><p>{r}</p></div>)}</div>
      </section>

    </div>
  );
}
