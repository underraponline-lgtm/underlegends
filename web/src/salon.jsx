// 🏛️ EL SALÓN DE LA FAMA (Dlx, 16/10/2026: «me refería hacer una página sólo para el salón de la fama: lo mejor de la
// Liga Global en general ahí, y lo reconocido»; en el menú, como sección, y con las cuatro cosas): los campeones de cada
// temporada, los récords, las insignias más difíciles y los salones que ya existían —los campeones de las ligas, el
// Salón del Pase y las figuras de cada semana—, todo junto.
//
// ⚠️ NO CALCULA NADA NUEVO: cada parte sale de lo que ya viaja. Los récords del lobby (`records`, `_records()` de
// bot/subir_web.py), las insignias de cada uno de los perfiles (`/api/perfiles`, `ins`), los campeones de liga del
// lobby (`ligas.salon`) y el Salón del Pase del objeto (`/api/avisos/pases`). Ninguna sección se dibuja vacía, salvo la
// de los campeones de cada temporada, que dice cuándo se llena.
import { useEffect, useState } from 'react';
import { DIAS, MESES, limpio, num, siglaDe } from './liga.js';
import { Cara, Ico, Sec, accion, usePerfiles } from './piezas.jsx';
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
          {fila('CAMPEÓN DE LA CLAUSURA', null, '', '#/ligas/clausura')}
          {fila('CAMPEÓN DE LA SUPERLIGA', null, '', '#/ligas/superliga')}
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
      <ul className="sf-rec aparece">{rs.map((r) => {
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
      <ul className="sf-ins aparece">{xs.map((x) => (
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

// ── 🏆 LOS MES AWARDS (Dlx, 16/10/2026: «como el Balón de Oro pero cada mes»): lo que se vota, cómo va el mes y los
// ganadores. Lo arma el ciclo (`bot/mes_awards.py`) y se pide al abrir el Salón (`/api/salon`): no viaja en el lobby.
// Se vota con las mismas reglas que El Elegido y el ×2 (`accion.votar`, `enc` de App.jsx): un voto por cuenta y por
// categoría, se cambia hasta que cierra, y afuera se ve cuántos, nunca quién
const SAL = { d: null, pedido: 0, oyentes: new Set() };
function pedirSalon() {
  if (Date.now() - SAL.pedido < 120000) return;
  SAL.pedido = Date.now();
  fetch('/api/salon', { headers: { accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { if (d && d.cats) { SAL.d = d; SAL.oyentes.forEach((f) => f()); } })
    .catch(() => { /* sin esto, el Salón sigue sin los MES AWARDS */ });
}
export function useSalon() {
  const [, setN] = useState(0);
  useEffect(() => {
    const f = () => setN((n) => n + 1);
    SAL.oyentes.add(f);
    pedirSalon();
    return () => { SAL.oyentes.delete(f); };
  }, []);
  return SAL.d;
}
const capM = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// cada nominado: su cara (o la miniatura de la batalla, o el escudo del servidor), su nombre y su número del mes
export function Nominado({ liga, cat, x }) {
  // 🏆 las de «Ver las demás nominaciones» (bot/mes_otros.py) traen su línea hecha (`d`) y qué se ve: un video, una
  // imagen, el escudo del servidor, la bandera o la cara de `q`
  if (x.d !== undefined) {
    const fq = x.q ? liga.fila(x.q) : null;
    const vis = x.vid ? <img className="ma-vid" alt="" src={'https://i.ytimg.com/vi/' + x.vid + '/mqdefault.jpg'} loading="lazy" />
      : x.img ? <img className="ma-vid" alt="" src={x.img} loading="lazy" />
        : x.cc ? <img className="ma-cara ma-flag" alt="" src={'/banderas/g/' + x.cc + '.webp'} />
          : x.sv && !x.q ? <img className="ma-cara" alt="" src={liga.logo(x.sv)} />
            : <Cara liga={liga} k={fq ? fq.k : ''} nombre={x.q || x.n} cls="ma-cara" />;
    return <>{vis}<span className="ma-t"><b>{limpio(x.n)}</b><small>{x.d}</small></span></>;
  }
  const f = (cat === 'rapero' || cat === 'revelacion') ? liga.fila(x.op) : null;
  const vis = cat === 'batalla' ? <img className="ma-vid" alt="" src={'https://i.ytimg.com/vi/' + x.op + '/mqdefault.jpg'} loading="lazy" />
    : cat === 'servidor' ? <img className="ma-cara" alt="" src={liga.logo(x.op)} />
      : <Cara liga={liga} k={f ? f.k : ''} nombre={x.n} cls="ma-cara" />;
  const dato = cat === 'batalla' ? siglaDe(x.sv) + ' · ' + num(x.vistas) + ' vistas'
    : cat === 'servidor' ? num(x.gente) + ' raperos · ' + num(x.ev) + ' eventos'
      : num(x.pts) + ' pts' + (x.oro ? ' · ' + x.oro + (x.oro === 1 ? ' título' : ' títulos') : '') + ' · ' + x.ev + (x.ev === 1 ? ' evento' : ' eventos');
  return <>{vis}<span className="ma-t"><b>{cat === 'batalla' ? limpio(x.n) : f ? limpio(f.n) : limpio(x.n)}</b><small>{dato}</small></span></>;
}

export function Categoria({ liga, enc, cat, nombre, de, nom, encId, gana }) {
  const E = encId ? ((liga.d.enc || []).find((e) => e.id === encId) || null) : null;
  const cu = E && enc ? enc.cuenta(E.id) : {};
  const tot = Object.values(cu).reduce((s, n) => s + (Number(n) || 0), 0);
  const mio = E && enc ? enc.mio[E.id] : '';
  const est = (E && enc && enc.est[E.id]) || {};
  return (
    <article className="ma-cat">
      <header><b>{nombre}</b><small>Por {de}</small></header>
      <ol className="ma-noms">{nom.map((x, i) => {
        const n = Number(cu[x.op] || 0);
        const p = tot ? Math.round((100 * n) / tot) : 0;
        const cuerpo = <><span className="ma-i">{gana ? (x.op === gana ? '🏆' : '') : i + 1}</span><Nominado liga={liga} cat={cat} x={x} /></>;
        return (
          <li key={x.op} className={(gana && x.op === gana ? 'gana ' : '') + (mio === x.op ? 'mio' : '')}>
            {E ? (
              <button type="button" className={'ma-op' + (est.va === x.op ? ' va' : '')} onClick={() => accion.votar(E.id, x.op)}
                aria-pressed={mio === x.op} aria-label={'Votar a ' + limpio(x.n) + ' · ' + p + '% de los votos'}>
                <i className="ma-bar" style={{ width: p + '%' }} />{cuerpo}<em>{mio === x.op ? '✓ ' : ''}{p}%</em>
              </button>
            ) : <div className="ma-op">{cuerpo}</div>}
          </li>
        );
      })}</ol>
      {E && enc ? <p className="ma-pie" aria-live="polite">{enc.pie(E, (op) => limpio((nom.find((x) => x.op === op) || {}).n || op))}</p> : null}
    </article>
  );
}

// 📊 los porcentajes del cierre (Dlx, 18/10/2026: «me gusta lo de porcentajes»): el ganador y los que le siguen, como
// publican los FMS AWARDS. Sólo si se decidió por votos: si fue por los números, no hay reparto que mostrar
export function reparto(x) {
  const cu = x.cuenta || {};
  const tot = Object.values(cu).reduce((s, n) => s + (Number(n) || 0), 0);
  if (x.por !== 'votos' || !tot) return null;
  const nom = (op) => limpio(((x.nom || []).find((y) => y.op === op) || {}).n || op);
  const orden = Object.keys(cu).sort((a, b) => cu[b] - cu[a]).slice(0, 4);
  return (
    <small className="ma-pct">{orden.map((op, i) => (
      <span key={op}>{i ? ' · ' : ''}{op === x.gana ? <b>{nom(op)} {Math.round((100 * cu[op]) / tot)}%</b> : nom(op) + ' ' + Math.round((100 * cu[op]) / tot) + '%'}</span>
    ))}{' · ' + tot + (tot === 1 ? ' voto' : ' votos')}</small>
  );
}

function MesAwards({ liga, enc }) {
  const S = useSalon();
  // 🏆 las cuatro a la vista y las doce detrás del botón (Dlx, 16/10/2026: «tampoco rellenar todo de eso, sino como el
  // botón que dirá ver las demás nominaciones»)
  const [todas, setTodas] = useState(false);
  // 🎧 y el staff por rol, en su bloque y detrás de su botón (Dlx, 18/10/2026: «agrega staff por separado y también en
  // general, o sea como está ahora»): el Staff del mes sigue entre las demás
  const [staff, setStaff] = useState(false);
  if (!S) return null;
  const cats = (S.cats || []).filter((c) => !c[3] || (todas && c[3] === 1));
  const catsStaff = staff ? (S.cats || []).filter((c) => c[3] === 2) : [];
  const nOtras = (S.cats || []).filter((c) => c[3] === 1).length;
  const nStaff = (S.cats || []).filter((c) => c[3] === 2).length;
  const boton = nOtras || nStaff ? (
    <div className="ma-botones">
      {nOtras ? <button type="button" className="btn borde2 chico ma-mas" aria-expanded={todas} onClick={() => setTodas((v) => !v)}>
        {todas ? 'Ver sólo las principales' : 'Ver las demás nominaciones (' + nOtras + ')'}</button> : null}
      {nStaff ? <button type="button" className="btn borde2 chico ma-mas" aria-expanded={staff} onClick={() => setStaff((v) => !v)}>
        {staff ? 'Esconder las del staff' : 'Ver las del staff (' + nStaff + ')'}</button> : null}
    </div>
  ) : null;
  // el bloque del staff: su título y sus categorías, después de las otras
  // (en su propia grilla: tres a lo ancho, para que el DJ no quede solo con un hueco al lado)
  const bloque = (lista) => (lista.some(Boolean) ? [<h3 key="ma-st" className="lgf-st ma-staff">El staff · jurado, host y DJ</h3>,
    <div key="ma-sg" className="ma-staff-g">{lista}</div>] : []);
  const ab = S.abierto;
  const viv = S.vivo;
  const hist = S.hist || [];
  let cab;
  let cuerpo = null;
  if (ab) {
    const votando = ab.votando;
    cab = votando ? <>Vota lo mejor de <b>{ab.nombre}</b>: cierra {liga.dia(ab.cierra)}.</> : <>Los nominados de <b>{ab.nombre}</b>: la votación abre {liga.dia(ab.abre)}.</>;
    const una = ([c, n, de]) => {
      const nom = ((ab.cats || {})[c] || {}).nom || [];
      if (!nom.length) return null;
      return <Categoria key={c} liga={liga} enc={enc} cat={c} nombre={n} de={de} nom={nom} encId={votando && nom.length >= 2 ? 'mes:' + ab.mes + ':' + c : ''} />;
    };
    cuerpo = <div className="ma-cats">{cats.map(una)}{bloque(catsStaff.map(una))}{boton}</div>;
  } else if (viv) {
    // 🤫 LOS NOMINADOS NO SE VEN MIENTRAS EL MES CORRE (Dlx, 18/10/2026: «no muestres los nominados hasta que termine»,
    // y a la pregunta: «hasta que termine el mes»). Antes aparecía «así va»: quién iba primero en cada categoría. Ahora
    // se conocen el día 1, cuando salen los nominados de verdad
    cab = <>Los nominados de <b>{viv.nombre}</b> se conocen cuando termina el mes. Se vota {liga.dia(viv.vota)}.</>;
  }
  return (
    <Sec id="sf-mes" titulo="MES AWARDS" extra="negra sf-mes">
      <p className="ma-cab">{cab || <>Cada mes, lo mejor de la Liga, votado por la gente.</>}</p>
      <p className="ma-como">Los nominados salen solos de los números del mes; vota cualquiera con Discord, una vez por categoría, y se puede cambiar
        hasta que cierra. El ganador se lleva su insignia{S.premio ? ', Puntos de Tienda' : ''} y su lugar en este Salón.
        {nOtras ? ' Los de crew, país, liga y servidor se llevan el Salón y la publicación.' : ''}
        {S.cats_sv ? ' Y cada servidor Tier 1 tiene los suyos, en su página, votados por los que jugaron ahí.' : ''}</p>
      {cuerpo}
      {hist.length ? (
        <div className="ma-hist">
          <h3 className="lgf-st">Los ganadores</h3>
          {hist.map((m) => (
            <div key={m.mes} className="ma-hm">
              <small>{capM(m.nombre)} {m.mes.slice(0, 4)}</small>
              {/* todas las categorías: los botones de «las demás» y del staff están sólo con un mes abierto, y con el mes
                  cerrado sus ganadores no se veían (pasada del 19/10/2026) */}
              <ul>{(S.cats || []).map(([c, n]) => {
                const x = (m.cats || {})[c] || {};
                const fila = (x.nom || []).find((y) => y.op === x.gana);
                return fila ? <li key={c}><Nominado liga={liga} cat={c} x={fila} /><em>{n}</em>{reparto(x)}</li> : null;
              })}</ul>
            </div>
          ))}
        </div>
      ) : null}
    </Sec>
  );
}

export function SalonFama({ liga, enc }) {
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
      <MesAwards liga={liga} enc={enc} />
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

