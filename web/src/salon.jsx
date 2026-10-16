// 🏛️ EL SALÓN DE LA FAMA (Dlx, 16/10/2026: «me refería hacer una página sólo para el salón de la fama: lo mejor de la
// Liga Global en general ahí, y lo reconocido»; en el menú, como sección, y con las cuatro cosas): los campeones de cada
// temporada, los récords, las insignias más difíciles y los salones que ya existían —los campeones de las ligas, el
// Salón del Pase y las figuras de cada semana—, todo junto.
//
// ⚠️ NO CALCULA NADA NUEVO: cada parte sale de lo que ya viaja. Los récords del lobby (`records`, `_records()` de
// bot/subir_web.py), las insignias de cada uno de los perfiles (`/api/perfiles`, `ins`), los campeones de liga del
// lobby (`ligas.salon`) y el Salón del Pase del objeto (`/api/avisos/pases`). Ninguna sección se dibuja vacía, salvo la
// de los campeones de cada temporada, que dice cuándo se llena.
import { useEffect } from 'react';
import { DIAS, MESES, limpio, num, siglaDe } from './liga.js';
import { Cara, Ico, Sec, usePerfiles } from './piezas.jsx';
import { usePases } from './pase.js';

// las insignias «difíciles»: las que tienen como mucho tantos; de la más rara a la menos. Las que nadie tiene no van
const DIFICIL = 25;
const VER_CARAS = 12;

function diaSin(d) {
  const [y, m, dd] = String(d || '').slice(0, 10).split('-').map(Number);
  if (!y || !m || !dd) return '';
  return dd + ' de ' + MESES[m - 1];
}
const diaSemana = (d) => {
  const [y, m, dd] = String(d || '').slice(0, 10).split('-').map(Number);
  return y ? DIAS[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()] : '';
};
const nombreTemp = (t) => (!t || t === 'prueba' ? 'Temporada 1' : 'Temporada ' + String(t).replace(/^t/i, ''));

// una cara con su link, de la tabla (`liga.T`) o con la inicial
function Persona({ liga, k, n, cls = 'sf-cara' }) {
  const f = k && liga.T[k];
  const nombre = (f && f.n) || n || k || '?';
  return <Cara liga={liga} k={f ? k : ''} nombre={nombre} cls={cls} />;
}
const nomDe = (liga, k, n) => limpio((k && liga.T[k] && liga.T[k].n) || n || k || '');

// ── 1 · los campeones de cada temporada: hoy la T1 está en juego, y se dice quién va primero y cuándo se define ──
function Temporadas({ liga }) {
  const t = liga.d.tabla || [];
  const tem = t.filter((f) => f.pos && !f.fc).sort((a, b) => a.pos - b.pos)[0];
  const comp = t.filter((f) => f.rg && !f.fc).sort((a, b) => (b.sc || 0) - (a.sc || 0))[0];
  const fin = (liga.d.fase || {}).termina;
  const fila = (que, f, dato, href) => (
    <li>
      <small>{que}</small>
      {f ? <a className="sf-tp" href={'#/r/' + encodeURIComponent(f.k)}><Persona liga={liga} k={f.k} n={f.n} /><b>{limpio(f.n)}</b><i>{dato}</i></a>
        : <a className="sf-tp vacia" href={href}><b>Al cierre</b><i>Cómo se juega</i></a>}
    </li>
  );
  return (
    <Sec id="sf-temporadas" titulo="Los campeones de cada temporada" extra="negra">
      <article className="sf-temp">
        <header>
          <span className="tag">{(liga.temp || 'T1').toUpperCase()} · EN JUEGO</span>
          <h3>{nombreTemp(liga.temp)}</h3>
          <p>{fin ? <>Se define el <b>{diaSin(fin)}</b>. </> : null}Hasta entonces, quién va primero; al cierre, los campeones quedan acá para siempre.</p>
        </header>
        <ul className="sf-temp-l">
          {fila('#1 DE LA TEMPORADA · VA PRIMERO', tem, tem ? 'OVR ' + (tem.ovr || '—') : '', '#/ranking/temporada')}
          {fila('#1 DEL COMPETITIVO · VA PRIMERO', comp, comp ? (comp.rg || '') + ' · ' + String(comp.sc || '').replace('.', ',') : '', '#/ranking/competitivo')}
          {fila('CAMPEÓN DE LA SUPERLIGA', null, '', '#/ligas/superliga')}
          {fila('CAMPEÓN DE LA CLAUSURA', null, '', '#/ligas/clausura')}
        </ul>
      </article>
    </Sec>
  );
}

// ── 2 · los récords de la temporada (los mismos de Socios): quién, cuánto y de qué ──
function Records({ liga }) {
  const rs = liga.d.records || [];
  if (!rs.length) return null;
  return (
    <Sec id="sf-records" titulo="Los récords" bajada={'De la ' + nombreTemp(liga.temp) + ', y se mueven con cada evento.'}>
      <ul className="sf-rec">{rs.map((r) => {
        const cuerpo = <>
          {r.k ? <Persona liga={liga} k={r.k} n={r.n} /> : <span className="sf-cara sf-rec-ic" aria-hidden="true"><Ico n="copa" t={20} /></span>}
          <span className="sf-rec-t"><small>{r.que}</small><b>{r.k ? nomDe(liga, r.k, r.n) : limpio(r.n)}</b>{r.x ? <em>{limpio(r.x)}</em> : null}</span>
          <span className="sf-rec-v">{typeof r.v === 'number' ? num(r.v) : r.v}</span>
        </>;
        return <li key={r.id}>{r.k ? <a href={'#/r/' + encodeURIComponent(r.k)}>{cuerpo}</a> : <div>{cuerpo}</div>}</li>;
      })}</ul>
    </Sec>
  );
}

// ── 3 · las insignias más difíciles: las que tienen pocos, de la más rara a la menos, con las caras de quienes la tienen ──
function Insignias({ liga, perf }) {
  const cat = liga.d.insignias || [];
  const P = (perf && perf.p) || null;
  if (!cat.length || !P) return null;
  const por = {};
  Object.entries(P).forEach(([k, p]) => (p.ins || []).forEach(([id, t]) => { (por[id] = por[id] || []).push([k, t]); }));
  const xs = cat.map(([id, ic, n, desc]) => ({ id, ic, n, desc, quien: (por[id] || []).sort((a, b) => String(a[1]).localeCompare(String(b[1]))) }))
    .filter((x) => x.quien.length && x.quien.length <= DIFICIL)
    .sort((a, b) => a.quien.length - b.quien.length);
  if (!xs.length) return null;
  return (
    <Sec id="sf-insignias" titulo="Las insignias más difíciles" bajada="Las que tienen pocos, de la más rara a la menos. Quedan para siempre.">
      <ul className="sf-ins">{xs.map((x) => (
        <li key={x.id}>
          <span className="sf-ins-ic" aria-hidden="true">{x.ic}</span>
          <span className="sf-ins-t"><b>{x.n}</b><small>{x.desc}</small></span>
          <span className="sf-ins-n">{x.quien.length === 1 ? 'Sólo 1' : x.quien.length}<small>{x.quien.length === 1 ? 'la tiene' : 'la tienen'}</small></span>
          <span className="sf-ins-caras">
            {x.quien.slice(0, VER_CARAS).map(([k]) => (
              <a key={k} href={'#/r/' + encodeURIComponent(k)} title={nomDe(liga, k)} aria-label={nomDe(liga, k)}><Persona liga={liga} k={k} cls="sf-mini" /></a>
            ))}
            {x.quien.length > VER_CARAS ? <em>+{x.quien.length - VER_CARAS}</em> : null}
          </span>
        </li>
      ))}</ul>
    </Sec>
  );
}

// ── 4 · los salones que ya existían, juntos ──
function CampeonesLigas({ liga }) {
  const xs = ((liga.d.ligas || {}).salon) || [];
  if (!xs.length) return null;
  return (
    <Sec id="sf-ligas" titulo="Campeones de las ligas" enlace="Ligas" href="#/ligas">
      <ul className="sf-lista">{xs.map((x) => {
        const k = (x.ks || {})[x.c] || (liga.fila(x.c) || {}).k;
        return (
          <li key={x.id + x.ult}>
            <Persona liga={liga} k={k} n={x.c} />
            <span><small><img alt="" src={liga.logo(x.sv)} />{x.n} · {siglaDe(x.sv)} · {nombreTemp(x.temp)}</small>
              <b>{k ? <a href={'#/r/' + encodeURIComponent(k)}>{limpio(x.c)}</a> : limpio(x.c)}</b>
              {(x.p || []).length > 1 ? <em>2º {limpio(x.p[1])}{x.p[2] ? ' · 3º ' + limpio(x.p[2]) : ''}</em> : null}</span>
          </li>
        );
      })}</ul>
    </Sec>
  );
}

function SalonPase({ liga }) {
  const pub = usePases();
  const por = (pub && pub.salon) || {};
  const temps = Object.keys(por).filter((t) => (por[t] || []).length).sort().reverse();
  if (!temps.length) return null;
  return (
    <Sec id="sf-pase" titulo="Salón del Pase" enlace="El Pase" href="#/pase" bajada="Los que completaron el Pase de rapero, en el orden en que llegaron.">
      {temps.map((t) => (
        <ol key={t} className="sf-lista">{por[t].filter(([k]) => liga.T[k]).map(([k, cuando], i) => (
          <li key={k}>
            <Persona liga={liga} k={k} />
            <span><small>{nombreTemp(t)} · {i + 1}.º EN COMPLETARLO</small>
              <b><a href={'#/r/' + encodeURIComponent(k)}>{nomDe(liga, k)}</a></b>
              <em>{liga.cuando(new Date(cuando).toISOString())}</em></span>
          </li>
        ))}</ol>
      ))}
    </Sec>
  );
}

// las figuras y las revelaciones de cada semana: salen de sus insignias, que guardan cuándo se ganaron
function Figuras({ liga, perf }) {
  const P = (perf && perf.p) || null;
  if (!P) return null;
  const xs = [];
  Object.entries(P).forEach(([k, p]) => (p.ins || []).forEach(([id, t]) => {
    if (id === 'figura' || id === 'revelacion') xs.push({ k, id, t: String(t || '') });
  }));
  if (!xs.length) return null;
  xs.sort((a, b) => b.t.localeCompare(a.t) || (a.id === 'figura' ? -1 : 1));
  return (
    <Sec id="sf-figuras" titulo="Figuras y revelaciones" bajada="Al cerrar cada semana: la figura es la que más puntos hizo, y la revelación, la figura de los que debutaron.">
      <ul className="sf-lista">{xs.map((x) => (
        <li key={x.id + x.k + x.t}>
          <Persona liga={liga} k={x.k} />
          <span><small>{x.id === 'figura' ? '🥇 FIGURA DE LA SEMANA' : '🌟 REVELACIÓN DE LA SEMANA'}</small>
            <b><a href={'#/r/' + encodeURIComponent(x.k)}>{nomDe(liga, x.k)}</a></b>
            <em>{x.t ? 'el ' + diaSemana(x.t) + ' ' + diaSin(x.t) : ''}</em></span>
        </li>
      ))}</ul>
    </Sec>
  );
}

export function SalonFama({ liga }) {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const perf = usePerfiles();
  const ins = (liga.d.insignias || []).length;
  return (
    <>
      <div className="escena sf-esc" style={{ '--mo-c': '#E5B800', '--mo-o': 0.9, '--mo-c2': '#E41373' }}>
        <section className="rk-cab sf-cab">
          <div className="rk-tx">
            <span className="tag">LIGA GLOBAL · {liga.temp || 'T1'}</span>
            <h1 className="hero-ev largo">Salón de la fama</h1>
            <p className="hero-p">Lo mejor de la Liga Global: los campeones de cada temporada, los récords, las insignias más difíciles y los que ya entraron a un salón. Lo que se gana acá queda para siempre.</p>
            <dl className="svp-num sf-num">
              <div><dt>RÉCORDS</dt><dd>{(liga.d.records || []).length}</dd></div>
              <div><dt>INSIGNIAS</dt><dd>{ins}</dd></div>
              <div><dt>EVENTOS</dt><dd>{num(liga.d.eventos || 0)}</dd></div>
              <div><dt>TEMPORADAS</dt><dd>1</dd></div>
            </dl>
          </div>
          <div className="sf-copa" aria-hidden="true"><Ico n="copa" t={150} /></div>
        </section>
      </div>
      <Temporadas liga={liga} />
      <Records liga={liga} />
      <Insignias liga={liga} perf={perf} />
      <CampeonesLigas liga={liga} />
      <SalonPase liga={liga} />
      <Figuras liga={liga} perf={perf} />
      {!perf ? <p className="sec sf-carga" role="status">Cargando las insignias…</p> : null}
    </>
  );
}

