// 🪪 EL PERFIL DE CADA UNO DEL RANKING GLOBAL, CON LA INTERFAZ DEL PERFIL DE LA LIGA (24/11/2026). Dlx: «me refería a que
// todos ellos tengan un perfil como …/r/dlx, como yo… que ellos sí tengan más cosas e historias»; «dale, arma los perfiles
// como el mío»; y al ver uno con otro diseño: «pero que tenga la misma interfaz de nuestro perfil pues».
//
// Las MISMAS piezas y clases que perfil.jsx (`Cabeza`: `.escena.pf8`, `.pf8-cab`…) y perfil_v10.jsx (`.pv-esc` con los
// círculos, el récord, la tarjeta grande, las barras y los cuatro rivales; `.pv-papel` con las pestañas y el costado), con
// lo que hay de cada uno: su carrera de Freestylestats (`/global_historia.json`) y su T1 en el Ranking global
// (`/global.json`). Lo que no tiene no se dibuja.
//
// Vive en `#/global/<clave>` y no en `#/r/<clave>`: 39 claves del global son también de alguien de la Liga («puppy») y
// «chuty» es el aka de un rapero de la Liga, así que en /r/ unos taparían a otros. `#/r/<clave>` lleva acá cuando la Liga
// no tiene a nadie así (`HaciaGlobal` en perfil.jsx). Los de la Liga tienen su perfil de la Liga y van allá.
import { useEffect, useMemo, useState } from 'react';
import { Bandera, nombrePais } from './piezas.jsx';
import { pu } from './perfil_datos.js';
import { ICO } from './perfil_v10.jsx';
import CSS_PF from './css/perfil.css?inline';
import CSS_V10 from './css/perfil_v10.css?inline';
import { usarCss } from './css.js';
import { GRUPO, MEDALLA, PUESTO, TIPO, fechaEv, limpioEv, miles, n1, nombre, plural, porEvento, porTx, preparar, rivalDe, useGlobal, useHistoria } from './global.jsx';
import { indiceCompetencias, slugComp } from './global_datos.js';

// los mismos ids que perfil.jsx y perfil_v10.jsx: si ya están, no se duplican
usarCss('perfil', CSS_PF);
usarCss('perfil_v10', CSS_V10);

/** sus podios por competencia: `[{ c, xs: [[puesto, edición, fase, duda]…], oros, n }]`, la de más oros primero */
function porCompetencia(h) {
  const m = new Map();
  for (const t of (h && h.t) || []) {
    const x = m.get(t[1]) || { c: t[1], xs: [], oros: 0, n: 0 };
    x.xs.push([t[0], t[2], t[3], t[4]]);
    x.n++;
    if (t[0] === 1) x.oros++;
    m.set(t[1], x);
  }
  return [...m.values()].sort((a, b) => (b.oros - a.oros) || (b.n - a.n) || a.c.localeCompare(b.c));
}
// la medalla como lo dice el perfil de la Liga (`pu()`): Campeón, Subcampeón, Tercero
const PU_MED = { 1: 'Campeón', 2: 'Subcampeón', 3: 'Tercero' };
/** las siglas de una competencia, para su círculo: «Red Bull Batalla España» → RB ES, «FMS Chile» → FMS */
function sigla(c) {
  const t = String(c || '');
  if (/^Red Bull/i.test(t)) return 'RB';
  if (/^FMS/i.test(t)) return 'FMS';
  if (/^God Level/i.test(t)) return 'GL';
  if (/^BDM/i.test(t)) return 'BDM';
  return t.split(/\s+/).filter((w) => /^\p{Lu}/u.test(w)).map((w) => w[0]).join('').slice(0, 3) || t.slice(0, 2).toUpperCase();
}
/** la cara: la foto de perfil (`ft`), el recorte de fms.tv (`fr`) o la inicial, en el círculo de la Liga */
function CaraGl({ g, cls }) {
  const [mal, setMal] = useState('');
  const src = [g.ft, g.fr].find((u) => u && u !== mal) || '';
  if (src) return <span className={cls}><img alt="" src={src} className={src === g.fr ? 'glpv-rto' : undefined} onError={() => setMal(src)} /></span>;
  return <span className={cls + ' ini'}>{([...limpio2(g.n)][0] || '?').toUpperCase()}</span>;
}
const limpio2 = (s) => String(s || '').replace(/[^\p{L}\p{N}\s]/gu, '').trim();
const irA = (g) => () => { location.hash = g.esc === 'liga' && g.hk ? '#/r/' + encodeURIComponent(g.hk) : '#/global/' + encodeURIComponent(g.k); };

// ════════ LA CABECERA: la de `Cabeza` (perfil.jsx) ════════
function CabezaGl({ liga, g, h }) {
  const pct = h && h.b && h.v != null ? Math.round((100 * h.v) / h.b) + ' %' : '—';
  const por = (g.por || []).map(porTx);
  return (
    <div className="escena pf8" style={{ '--mo-c': '#E41373', '--mo-o': 0.85, '--mo-c2': '#29B298' }}>
      <div className="pf8-cover" />
      <section className="pf8-cab">
        <div className="pf8-carta"><CaraGl g={g} cls="cara pf8-cara" /></div>
        <div className="pf8-tx">
          <span className="tag">{g.pos ? '#' + g.pos + ' DEL RANKING GLOBAL' : 'RANKING GLOBAL'} · {liga.temp}</span>
          <div className="pf8-nom">
            <h1 className="hero-ev largo">{nombre(g)}</h1>
            <div className="pf8-pills"><span className="pf8-crew" title={por.join('. ') || GRUPO[g.esc]}><b>{(GRUPO[g.esc] || '').toUpperCase()}</b><span>{por[0] || 'Ranking global'}</span></span></div>
          </div>
          <p className="pf8-segs">
            {g.cc ? <a href={'#/pais/' + g.cc}><Bandera cc={g.cc} cls="pf-flag" />{nombrePais(g.cc)}</a> : null}
            {por.slice(1, 3).map((t) => <span key={t}>{t}</span>)}
            {g.esc !== 'liga' ? <span>No está en la Liga</span> : null}
            {g.jb && g.nb < 3 ? <span title="Menos de 3 batallas contadas: su puesto todavía se mueve mucho">Provisional</span> : null}
          </p>
        </div>
        <div className="pf8-acc">
          {g.esc !== 'liga' ? <a className="btn pf8-seguir verde" href="#/invitar">Invitar a la Liga</a> : null}
        </div>
        <div className="pf8-bar">
          <div className="pf8-num">
            <div className="pf8-yo" style={{ '--rc': '#E41373' }}><b>{g.pos ? '#' + g.pos : '—'}</b><small>RANKING GLOBAL</small></div>
            <div className="pf8-tres">
              <div><b>{g.jb ? n1(g.p) : '—'}</b><small>PUNTOS T1</small></div>
              <div><b>{h && h.b != null ? miles(h.b) : g.jb || 0}</b><small>{h && h.b != null ? 'BATALLAS' : 'BATALLAS T1'}</small></div>
              <div><b>{pct}</b><small>GANÓ</small></div>
            </div>
          </div>
          <div className="pf8-soc">
            <div><b>{h ? h.m[0] : '—'}</b><small>{h && h.m[0] === 1 ? 'título' : 'títulos'}</small></div>
            <div><b>{h ? h.t.length : '—'}</b><small>{h && h.t.length === 1 ? 'podio' : 'podios'}</small></div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ════════ ARRIBA, EN NEGRO: lo de `PerfilV10` ════════
function MomentosGl({ g, h, comps, ir }) {
  const xs = [];
  if (g.cc) xs.push(['pais', nombrePais(g.cc), <img key="b" alt="" src={'/banderas/g/' + g.cc + '.webp'} />, '', '#29B298', () => { location.hash = '#/pais/' + g.cc; }]);
  if (h && h.m[0]) xs.push(['tit', 'Títulos', <em key="t">★</em>, h.m[0], '#E5B800', () => ir('podios', 'oro')]);
  comps.slice(0, 5).forEach((x) => xs.push(['c' + x.c, x.c, <em key="c">{sigla(x.c)}</em>, x.oros || x.n, x.oros ? '#E5B800' : '#C9CDD2', () => ir('podios', x.c)]));
  if (g.jb) xs.push(['t1', 'Su T1', <em key="t1">T1</em>, g.jb, '#E41373', () => ir('t1')]);
  if (!xs.length) return null;
  return (
    <div className="pv-mom" role="list" aria-label="Sus momentos">
      {xs.map(([id, n, im, c, rc, fn]) => (
        <button key={id} type="button" role="listitem" style={{ '--rc': rc }} onClick={fn}>
          <span className="pv-ci"><span>{im}</span>{c ? <i>{c}</i> : null}</span><b>{n}</b>
        </button>
      ))}
    </div>
  );
}
function RecordGl({ g, h }) {
  const gan = g.b.filter((b) => b[3] !== 'PR').length;
  const per = Math.max(0, g.nb - gan);
  // la de toda su carrera sólo si dice más que la T1: un perfil de Freestylestats viejo (1 batalla, perdida) contradecía
  // la T1 que sí leímos
  const carrera = !!(h && h.b && h.v != null && h.b > (g.jb || 0));
  const v = carrera ? h.v : gan;
  const p = carrera ? h.b - h.v : per;
  const tot = v + p;
  return (
    <div className="pv-rec">
      <p className="pv-et"><b>El récord</b> · {carrera ? 'toda su carrera' : 'la T1'}</p>
      {tot ? (
        <>
          <div className="pv-rec-n"><span>{miles(v)}</span><i>–</i><span className="p">{miles(p)}</span></div>
          <p className="pv-sub">{Math.round((100 * v) / tot)} % ganadas{carrera && h.j ? ' · ' + plural(h.j, 'jornada', 'jornadas') : ''}</p>
          <div className="pv-rec-bar" role="img" aria-label={v + ' ganadas y ' + p + ' perdidas'}><i style={{ width: ((100 * v) / tot).toFixed(1) + '%' }} /></div>
        </>
      ) : <div className="pv-vac"><b>Su primera batalla</b><span>Cuando juegue una batalla que leamos, acá se ven las ganadas y las perdidas.</span></div>}
      <div className="pv-cint">
        <div><b><span className="pv-med o" />{h ? h.m[0] : 0}</b><small>títulos</small></div>
        <div><b><span className="pv-med p" />{h ? h.m[1] : 0}</b><small>finales perdidas</small></div>
        <div><b><span className="pv-med b" />{h ? h.m[2] : 0}</b><small>terceros</small></div>
      </div>
      {carrera && g.jb ? <div className="pv-racha"><span>En la T1</span><span><b>{gan}</b> ganadas · <b>{per}</b> perdidas</span></div> : null}
    </div>
  );
}
function GrandeGl({ g, h, X }) {
  const t = h && (h.t.find((x) => x[0] === 1) || h.t[0]);
  if (t) {
    const r = pu(PU_MED[t[0]]);
    return (
      <div className="pv-mn">
        <p className="pv-et"><b>{t[0] === 1 ? 'Su último título' : 'Su último podio'}</b> · {t[2]}</p>
        <span className={'pv-res ' + r[1]}>{r[0]}</span>
        <h3><LinkComp n={t[1]} /></h3>
        {t[3] ? <p className="pv-sub">{t[3]}{t[4] ? ' · en duda: la fuente se lo da a otro también' : ''}</p> : null}
        <div className="pv-mn-num">
          <div><b>{miles(h.b || 0)}</b><small>batallas</small></div>
          <div><b>{h.j || '—'}</b><small>jornadas</small></div>
          <div><b>{h.t.length}</b><small>podios</small></div>
          <div><b>{new Set(h.t.map((x) => x[1])).size}</b><small>competencias</small></div>
        </div>
      </div>
    );
  }
  // sin historia: su mejor noche de la T1, como en la Liga
  const evs = porEvento(g);
  const e = evs[0];
  if (!e) return <div className="pv-mn vac"><p className="pv-et"><b>Su primera noche</b></p><p className="pv-sub">Con su primer evento que leamos, acá va la mejor noche, con a quién le ganó.</p></div>;
  const ev = X.ev[e.e] || [];
  const r = pu(e.tit ? PU_MED[e.tit[1]] || 'Campeón' : 'Jugó');
  return (
    <div className="pv-mn">
      <p className="pv-et"><b>Su mejor noche</b> · la T1</p>
      {e.tit ? <span className={'pv-res ' + r[1]}>{PUESTO[e.tit[1]] || r[0]}</span> : null}
      <h3>{limpioEv(ev[1])}</h3>
      <p className="pv-sub">{e.bat.length ? 'le ganó a ' + e.bat.map((b) => rivalDe(X, b)).slice(0, 3).join(', ') : ''}</p>
      <div className="pv-mn-num">
        <div><b>+{n1(e.pts)}</b><small>puntos</small></div>
        <div><b>{e.bat.length}</b><small>{e.bat.length === 1 ? 'batalla ganada' : 'batallas ganadas'}</small></div>
        <div><b>{g.jb}</b><small>{g.jb === 1 ? 'batalla jugada' : 'batallas jugadas'}</small></div>
        <div><b>{evs.length}</b><small>{evs.length === 1 ? 'evento' : 'eventos'}</small></div>
      </div>
    </div>
  );
}
function CompetenciasGl({ comps }) {
  if (comps.length < 2) return null;
  const mx = Math.max(...comps.map((x) => x.n));
  return (
    <div className="pv-caja pv-tape">
      <p className="pv-et"><b>Dónde ganó</b> · sus podios por competencia</p>
      <ul>{comps.slice(0, 6).map((x) => (
        <li key={x.c}><span className="l"><LinkComp n={x.c} /></span><span className="t"><i style={{ width: Math.round((100 * x.n) / mx) + '%' }} /></span><span className="v">{x.n}</span></li>
      ))}</ul>
      <div className="pv-tape-ley"><span><i />podios</span><span>{plural(comps.reduce((s, x) => s + x.oros, 0), 'título', 'títulos')} en {plural(comps.length, 'competencia', 'competencias')}</span></div>
    </div>
  );
}
function RivalesGl({ g, X }) {
  const xs = [];
  const caja = (key, cls, r, et, det) => (
    <button key={key} type="button" className={'pv-rv ' + cls} onClick={irA(r)}>
      <CaraGl g={r} cls="cara pv-rv-c" /><span><span className="pv-et"><b>{et}</b></span><b>{nombre(r)}</b><small>{det}</small></span>
    </button>
  );
  const b = g.b[0];
  const rv = b && X.porK.get(b[2]);
  if (rv) xs.push(caja('vic', 'vic', rv, 'Su mejor victoria', <>le ganó en {limpioEv((X.ev[b[0]] || [])[1])} · <em>+{n1(b[4])}</em></>));
  if (g.pos) {
    const arriba = X.G[g.i - 1];
    const abajo = X.G[g.i + 1];
    if (arriba && arriba.pos) xs.push(caja('arr', '', arriba, 'El que tiene adelante', <><em>#{arriba.pos}</em> · le faltan {n1(arriba.p - g.p)} pts</>));
    if (abajo && abajo.pos) xs.push(caja('aba', '', abajo, 'El que lo persigue', <><em>#{abajo.pos}</em> · a {n1(g.p - abajo.p)} pts</>));
  }
  // el mejor de su país en el global, si no es él
  const pais = g.cc ? X.G.find((x) => x.cc === g.cc && x.pos) : null;
  if (pais && pais !== g) xs.push(caja('pais', '', pais, 'El #1 de ' + nombrePais(g.cc), <><em>#{pais.pos}</em> del Ranking global</>));
  if (!xs.length) return null;
  return <div className="pv-rivs">{xs.slice(0, 4)}</div>;
}

// ════════ ABAJO, EN EL PAPEL: las pestañas y el costado ════════
const VER = 12;
function PodiosGl({ h, comps, fil, setFil }) {
  const [todos, setTodos] = useState(false);
  useEffect(() => { setTodos(false); }, [fil]);
  if (!h || !h.t.length) return <p className="pv-nada">Todavía no tenemos sus podios de antes de la T1. Los leemos de Freestylestats cada semana.</p>;
  const R = [['todos', 'Todos', () => true], ['oro', 'Títulos', (t) => t[0] === 1], ['plata', 'Finales', (t) => t[0] === 2], ['bronce', 'Podios', (t) => t[0] === 3]];
  const esComp = comps.some((x) => x.c === fil);
  const fR = (R.find((x) => x[0] === fil) || R[0])[2];
  const xs = h.t.filter((t) => (esComp ? t[1] === fil : fR(t)));
  const cuenta = (fn) => h.t.filter(fn).length;
  return (
    <>
      <div className="pv-filas-f">
        <div className="pv-chips" role="group" aria-label="Qué medalla">{R.filter((x) => x[0] === 'todos' || cuenta(x[2])).map((x) => (
          <button key={x[0]} type="button" className={!esComp && fil === x[0] ? 'on' : ''} aria-pressed={!esComp && fil === x[0]} onClick={() => setFil(x[0])}>{x[1]} <em>{cuenta(x[2])}</em></button>
        ))}</div>
        {comps.length > 1 ? <div className="pv-chips" role="group" aria-label="La competencia">{comps.slice(0, 8).map((x) => (
          <button key={x.c} type="button" className={fil === x.c ? 'on' : ''} aria-pressed={fil === x.c} onClick={() => setFil(fil === x.c ? 'todos' : x.c)}>{x.c} · {x.n}</button>
        ))}</div> : null}
      </div>
      <div className="pv-np-g">
        {(todos ? xs : xs.slice(0, VER)).map((t, i) => {
          const r = pu(PU_MED[t[0]]);
          return (
            <div key={i} className={'pv-np ' + r[1]} style={{ '--svc': '#2A2A2E' }}>
              <span className="pv-np-img"><span className="pv-np-ronda"><b>{MEDALLA[t[0]]}</b><span>{sigla(t[1])}</span></span></span>
              <span className="pv-np-tx">
                <span className="pv-np-f1"><span className={'pv-res ' + r[1]}>{r[0]}</span><span>{t[2]}</span></span>
                <b className="pv-np-h"><LinkComp n={t[1]} /></b>
                {t[3] || t[4] ? <span className="pv-np-tags">{t[3] ? <span>{t[3]}</span> : null}{t[4] ? <span>en duda: la fuente se lo da a otro también</span> : null}</span> : null}
              </span>
            </div>
          );
        })}
      </div>
      {!todos && xs.length > VER ? <button type="button" className="pv-pie" onClick={() => setTodos(true)}><span>{plural(xs.length, 'podio', 'podios')}</span><b>Ver todos</b></button> : null}
      <p className="pv-nada">Su carrera, de <a href={'https://freestylestats.com/profile/' + h.s} target="_blank" rel="noopener noreferrer">Freestylestats</a>. No suma al Ranking global: el ranking cuenta sólo la T1.</p>
    </>
  );
}
function T1Gl({ g, X }) {
  const [todos, setTodos] = useState(false);
  if (!g.jb) return <p className="pv-nada">Todavía no jugó una batalla de la T1 que leamos. Cuando juegue una jornada de FMS, una final de Red Bull o un evento que leamos, sus batallas aparecen acá.</p>;
  const evs = porEvento(g);
  const falta = g.nb - g.b.length;
  return (
    <>
      <div className="pv-np-g">
        {(todos ? evs : evs.slice(0, VER)).map((x) => {
          const ev = X.ev[x.e] || [];
          const r = pu(x.tit ? PU_MED[x.tit[1]] || 'Campeón' : 'Cuartos');
          return (
            <div key={x.e} className={'pv-np ' + (x.tit ? r[1] : '')} style={{ '--svc': '#2A2A2E' }}>
              <span className="pv-np-img"><span className="pv-np-ronda"><b>+{n1(x.pts)}</b><span>{x.bat.length ? plural(x.bat.length, 'ganada', 'ganadas') : 'sin ganar'}</span></span></span>
              <span className="pv-np-tx">
                <span className="pv-np-f1">{x.tit ? <span className={'pv-res ' + r[1]}>{PUESTO[x.tit[1]] || r[0]}</span> : null}<span>{String(ev[3] || '').slice(8, 10) + '/' + String(ev[3] || '').slice(5, 7)}</span></span>
                <b className="pv-np-h">{limpioEv(ev[1])}</b>
                <span className="pv-np-f2"><span>{x.bat.length ? 'le ganó a ' + x.bat.map((b) => rivalDe(X, b)).join(', ') : ''}</span><b>+{n1(x.pts)}</b></span>
              </span>
            </div>
          );
        })}
      </div>
      {!todos && evs.length > VER ? <button type="button" className="pv-pie" onClick={() => setTodos(true)}><span>{plural(evs.length, 'evento', 'eventos')}</span><b>Ver todos</b></button> : null}
      <p className="pv-nada">{'Cuentan sus ' + X.mejores + ' mejores batallas de la T1 y sus ' + X.mejoresTit + ' mejores títulos.'}{falta > 0 ? ' ' + (falta === 1 ? 'Una batalla contada no sumó' : falta + ' batallas contadas no sumaron') + ' (perdidas).' : ''}</p>
    </>
  );
}
function SobreGl({ g, h }) {
  const xs = [];
  if (g.cc) xs.push(['País', <a key="cc" href={'#/pais/' + g.cc}><Bandera cc={g.cc} cls="pv-flag" />{nombrePais(g.cc)}</a>, '']);
  xs.push(['Grupo', GRUPO[g.esc] || g.esc, g.esc === 'pro' ? 'en el Ranking global' : '']);
  (g.por || []).forEach((t, i) => xs.push([i ? '' : 'Por qué es pro', porTx(t), '']));
  if (h && h.j) xs.push(['Jornadas', String(h.j), 'en toda su carrera']);
  if (h && h.t.length) {
    const ult = h.t[0];
    xs.push(['Su último podio', ult[1], ult[2] + (ult[3] ? ' · ' + ult[3] : '')]);
  }
  return (
    <section className="pv-cajal">
      <h3>Sobre su carrera</h3>
      <ul className="pv-sob">{xs.map(([a, b, cc], i) => <li key={i}><span>{a}</span><span><b>{b}</b>{cc ? <small>{cc}</small> : null}</span></li>)}</ul>
    </section>
  );
}
function DondeGl({ g, X }) {
  const filas = [['Ranking global', g.pos ? '#' + g.pos + ' de ' + miles(X.conPts) : '—']];
  const grupo = X.G.filter((x) => x.esc === g.esc && x.pos);
  const ig = grupo.indexOf(g);
  if (ig >= 0) filas.push(['Entre los ' + (GRUPO[g.esc] || '').toLowerCase(), '#' + (ig + 1) + ' de ' + grupo.length]);
  if (g.cc) {
    const pais = X.G.filter((x) => x.cc === g.cc && x.pos);
    const ip = pais.indexOf(g);
    if (ip >= 0) filas.push(['Su país', '#' + (ip + 1) + ' de ' + pais.length]);
  }
  if (g.jb) filas.push(['Puntos T1', n1(g.p)]);
  return (
    <section className="pv-cajal">
      <h3>Dónde está<a href={'#/ranking/global/' + encodeURIComponent(g.k)}>Ranking global</a></h3>
      <ul className="pv-dl">{filas.map(([a, b]) => <li key={a}><span>{a}</span><b>{b}</b></li>)}</ul>
    </section>
  );
}
function InvitaGl({ g }) {
  if (g.esc === 'liga') return null;
  return (
    <section className="pv-cajal">
      <h3>No está en la Liga</h3>
      <p className="pv-sub">Invítalo: si se une, sus batallas en la Liga también suman al Ranking global y puede pelear el Ranking de la T1.</p>
      <a className="btn verde" href="#/invitar">Invitar a la Liga</a>
    </section>
  );
}

export function PerfilGlobal({ liga, k: k0 }) {
  const [D, mal, reintentar] = useGlobal();
  const X = useMemo(() => (D ? preparar(D, liga) : null), [D, liga]);
  const H = useHistoria();
  let k = k0;
  try { k = decodeURIComponent(k0); } catch (e) { /* tal cual */ }
  const g = X ? X.porK.get(k) || X.G.find((x) => x.k.toLowerCase() === String(k).toLowerCase()) || null : null;
  const [tab, setTab] = useState('');
  const [fil, setFil] = useState('todos');
  useEffect(() => { window.scrollTo(0, 0); setTab(''); setFil('todos'); }, [k]);
  useEffect(() => {
    if (!g) return undefined;
    const poner = () => { document.title = nombre(g) + ' · Ranking global de freestyle'; };
    poner();
    const r = setTimeout(poner, 0);
    return () => clearTimeout(r);
  }, [g]);
  // los de la Liga: su perfil es el de la Liga, que ya tiene todo
  useEffect(() => { if (g && g.esc === 'liga' && g.hk) location.hash = '#/r/' + encodeURIComponent(g.hk); }, [g]);
  const h = H && g ? (H.p || {})[g.k] || null : null;
  const comps = useMemo(() => porCompetencia(h), [h]);
  if (mal) return <section className="sec pf-sec"><p className="pronto-p">No pude cargar el Ranking global. <button type="button" className="te-link" onClick={reintentar}>Reintentar</button></p></section>;
  if (!X || !H) return <div className="cargando">Cargando…</div>;
  if (!g) {
    return (
      <section className="sec pf-sec">
        <div className="sec-t"><h2>No está en el Ranking global</h2></div>
        <p className="pronto-p">Búscalo en el <a className="te-link" href="#/ranking/global">Ranking global</a>.</p>
      </section>
    );
  }
  const ir = (t, f) => {
    setTab(t);
    if (f) setFil(f);
    const raiz = document.querySelector('#inicio-nuevo');
    const el = raiz && raiz.shadowRoot && raiz.shadowRoot.querySelector('.pv-tabs');
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  };
  const T = [['podios', 'Sus títulos', h ? h.t.length : 0], ['t1', 'Su T1', g.jb || 0]];
  // sin elegir: sus títulos si tiene; si no, su T1
  const tabV = tab || (h && h.t.length ? 'podios' : 't1');
  return (
    <div className="pf8-pag pf9-pag glpv">
      <CabezaGl liga={liga} g={g} h={h} />
      <div className="pv">
        <section className="pv-esc" aria-label="Su récord">
          <MomentosGl g={g} h={h} comps={comps} ir={ir} />
          <div className="pv-ag">
            <RecordGl g={g} h={h} />
            <GrandeGl g={g} h={h} X={X} />
            <div className="pv-pila"><CompetenciasGl comps={comps} /></div>
          </div>
          <RivalesGl g={g} X={X} />
        </section>
        <section className="pv-papel">
          <div className="pv-g">
            <div className="pv-izq">
              <div className="pv-tabs" role="tablist" aria-label="Lo suyo">
                {T.map(([id, n, c]) => (
                  <button key={id} type="button" role="tab" aria-selected={tabV === id} className={tabV === id ? 'on' : ''} onClick={() => setTab(id)}>{ICO[id === 'podios' ? 'logros' : 'noches']}<span className="pv-tab-t">{n}</span>{c ? <small>{c}</small> : null}</button>
                ))}
              </div>
              {tabV === 'podios' ? <PodiosGl h={h} comps={comps} fil={fil} setFil={setFil} /> : <T1Gl g={g} X={X} />}
            </div>
            <aside className="pv-lado">
              <SobreGl g={g} h={h} />
              <DondeGl g={g} X={X} />
              <InvitaGl g={g} />
            </aside>
          </div>
        </section>
      </div>
    </div>
  );
}

// ════════ 🏆 LA PÁGINA DE CADA COMPETENCIA (24/11/2026) ════════
// Dlx: «agregar a las ligas de FMS, competencias así fuertes, como historias o perfiles también»; y a «¿Armo ahora las
// páginas de las competencias?»: «Sí, ármalas». `#/competencia/<clave>`, con la MISMA interfaz que el perfil: la cabecera,
// la banda negra (sus ediciones en círculos, quién más ganó, el último campeón, los más ganadores y sus cuatro reyes) y el
// papel con las pestañas «Ediciones» y «En la T1». Sale de `indiceCompetencias()` (global_datos.js): los podios de la
// carrera de cada uno y los eventos de la T1. ⚠️ No es la competencia entera: es lo que sabemos de los que están en el
// Ranking global, y la página lo dice
const anio = (ed) => { const m = /(\d{4})/.exec(String(ed || '')); return m ? Number(m[1]) : 0; };
const edCorta = (ed) => { const m = /^(\d{4})\/(\d{2})(\d{2})?$/.exec(String(ed || '')); return m ? m[1].slice(2) + '/' + (m[3] || m[2]) : String(ed || '').slice(0, 7); };
function familia(n) {
  if (/^FMS/i.test(n)) return ['FMS', 'Liga por jornadas'];
  if (/^Red Bull/i.test(n)) return ['RED BULL', 'Torneo por eliminación'];
  if (/^God Level/i.test(n)) return ['GOD LEVEL', 'Torneo internacional'];
  if (/^BDM/i.test(n)) return ['BDM', 'Torneo por eliminación'];
  return ['TORNEO', 'Competencia de freestyle'];
}
const hrefComp = (n) => '#/competencia/' + slugComp(n);
function LinkComp({ n }) { return <a href={hrefComp(n)} onClick={(e) => e.stopPropagation()}>{n}</a>; }
/** lo que se calcula una vez por competencia: ediciones, gente con sus medallas, el último campeón y sus eventos de la T1 */
function armarComp(c, X) {
  const porEd = new Map();
  const gente = new Map();
  for (const [k, p, ed, fase, duda] of c.tit) {
    const e = porEd.get(ed) || { ed, fases: new Map(), n: 0 };
    const f = fase || 'Final';
    const xs = e.fases.get(f) || [];
    xs.push([k, p, duda]);
    e.fases.set(f, xs);
    e.n++;
    porEd.set(ed, e);
    const g = X.porK.get(k);
    if (!g) continue;
    const x = gente.get(k) || { g, o: 0, p: 0, b: 0 };
    if (p === 1) x.o++; else if (p === 2) x.p++; else x.b++;
    gente.set(k, x);
  }
  const eds = [...porEd.values()].sort((a, b) => (anio(b.ed) - anio(a.ed)) || String(b.ed).localeCompare(String(a.ed)));
  const top = [...gente.values()].sort((a, b) => (b.o - a.o) || (b.p - a.p) || (b.b - a.b) || nombre(a.g).localeCompare(nombre(b.g)));
  let ult = null;
  for (const e of eds) {
    for (const [fase, xs] of e.fases) {
      const camp = xs.filter((x) => x[1] === 1).map((x) => X.porK.get(x[0])).filter(Boolean);
      if (camp.length) { ult = { ed: e.ed, fase, camp, n: xs.length }; break; }
    }
    if (ult) break;
  }
  const t1 = c.ev.map((i) => {
    const e = X.ev[i] || [];
    const camp = X.G.find((g) => g.t.some((t) => t[0] === i && t[1] === 1)) || null;
    const fin = X.G.find((g) => g.t.some((t) => t[0] === i && t[1] === 2)) || null;
    let bat = 0;
    for (const g of X.G) for (const b of g.b) if (b[0] === i) bat++;
    return { i, e, camp, fin, bat };
  }).sort((a, b) => String(b.e[3] || '').localeCompare(String(a.e[3] || '')));
  const paises = {};
  top.forEach((x) => { if (x.g.cc) paises[x.g.cc] = (paises[x.g.cc] || 0) + 1; });
  c.ev.forEach((i) => { const cc = (X.ev[i] || [])[4]; if (cc) paises[cc] = (paises[cc] || 0) + 3; });
  const cc = Object.entries(paises).sort((a, b) => b[1] - a[1]).map((x) => x[0])[0] || '';
  const o = c.tit.filter((t) => t[1] === 1).length;
  const pl = c.tit.filter((t) => t[1] === 2).length;
  return { eds, top, ult, t1, cc, o, pl, br: c.tit.length - o - pl, campeones: top.filter((x) => x.o).length };
}

function CabezaComp({ liga, c, A }) {
  const [fam, tipo] = familia(c.n);
  const desde = A.eds.length ? anio(A.eds[A.eds.length - 1].ed) : 0;
  return (
    <div className="escena pf8" style={{ '--mo-c': '#E5B800', '--mo-o': 0.85, '--mo-c2': '#E41373' }}>
      <div className="pf8-cover" />
      <section className="pf8-cab">
        <div className="pf8-carta"><span className="cara pf8-cara ini glpv-comp">{sigla(c.n)}</span></div>
        <div className="pf8-tx">
          <span className="tag">COMPETENCIA · RANKING GLOBAL · {liga.temp}</span>
          <div className="pf8-nom">
            <h1 className="hero-ev largo">{c.n}</h1>
            <div className="pf8-pills"><span className="pf8-crew"><b>{fam}</b><span>{tipo}</span></span></div>
          </div>
          <p className="pf8-segs">
            {A.cc ? <a href={'#/pais/' + A.cc}><Bandera cc={A.cc} cls="pf-flag" />{nombrePais(A.cc)}</a> : null}
            {desde ? <span>Desde {desde}</span> : null}
            {A.eds.length ? <span>{plural(A.eds.length, 'edición', 'ediciones')}</span> : null}
            {c.ev.length ? <span>{plural(c.ev.length, 'evento', 'eventos')} en la T1</span> : null}
          </p>
        </div>
        <div className="pf8-acc"><a className="btn pf8-seguir verde" href="#/ranking/global">Ranking global</a></div>
        <div className="pf8-bar">
          <div className="pf8-num">
            <div className="pf8-yo" style={{ '--rc': '#E5B800' }}><b>{A.eds.length || '—'}</b><small>{A.eds.length === 1 ? 'EDICIÓN' : 'EDICIONES'}</small></div>
            <div className="pf8-tres">
              <div><b>{A.campeones}</b><small>CAMPEONES</small></div>
              <div><b>{A.top.length}</b><small>CON PODIO</small></div>
              <div><b>{c.tit.length}</b><small>PODIOS</small></div>
            </div>
          </div>
          <div className="pf8-soc">
            <div><b>{A.o}</b><small>{A.o === 1 ? 'título' : 'títulos'}</small></div>
            <div><b>{c.ev.length}</b><small>en la T1</small></div>
          </div>
        </div>
      </section>
    </div>
  );
}
function MomentosComp({ A, ir }) {
  const xs = A.eds.slice(0, 9).map((e) => ({ id: e.ed, n: e.ed, im: <em className={edCorta(e.ed).length > 4 ? 'glpv-largo' : undefined}>{edCorta(e.ed)}</em>, c: e.n, rc: '#E5B800', fn: () => ir('eds', e.ed) }));
  if (A.t1.length) xs.push({ id: 't1', n: 'En la T1', im: <em>T1</em>, c: A.t1.length, rc: '#E41373', fn: () => ir('t1') });
  if (!xs.length) return null;
  return (
    <div className="pv-mom" role="list" aria-label="Sus ediciones">
      {xs.map((x) => (
        <button key={x.id} type="button" role="listitem" style={{ '--rc': x.rc }} onClick={x.fn}>
          <span className="pv-ci"><span>{x.im}</span>{x.c ? <i>{x.c}</i> : null}</span><b>{x.n}</b>
        </button>
      ))}
    </div>
  );
}
function ReyComp({ A }) {
  const r = A.top[0];
  const tot = A.o || 0;
  return (
    <div className="pv-rec">
      <p className="pv-et"><b>Quién más ganó</b> · de lo que sabemos</p>
      {r && r.o ? (
        <>
          <div className="pv-rec-n"><span>{r.o}</span><i>/</i><span className="p">{tot}</span></div>
          <p className="pv-sub">{r.o === 1 ? 'título' : 'títulos'} de <a href={'#/global/' + encodeURIComponent(r.g.k)}>{nombre(r.g)}</a>{r.p ? ' · y ' + plural(r.p, 'final', 'finales') : ''}</p>
          <div className="pv-rec-bar" role="img" aria-label={r.o + ' de ' + tot + ' títulos'}><i style={{ width: ((100 * r.o) / Math.max(1, tot)).toFixed(1) + '%' }} /></div>
        </>
      ) : <div className="pv-vac"><b>Sin campeones todavía</b><span>Cuando sepamos de un campeón de esta competencia, va acá.</span></div>}
      <div className="pv-cint">
        <div><b><span className="pv-med o" />{A.o}</b><small>títulos</small></div>
        <div><b><span className="pv-med p" />{A.pl}</b><small>finales</small></div>
        <div><b><span className="pv-med b" />{A.br}</b><small>terceros</small></div>
      </div>
    </div>
  );
}
function UltimoComp({ c, A }) {
  const u = A.ult;
  if (!u) {
    const t = A.t1[0];
    if (!t) return <div className="pv-mn vac"><p className="pv-et"><b>Su último campeón</b></p><p className="pv-sub">Todavía no sabemos quién ganó.</p></div>;
    return (
      <div className="pv-mn">
        <p className="pv-et"><b>Lo último que leímos</b> · {fechaEv(t.e[3])}</p>
        {t.camp ? <span className="pv-res c">Campeón</span> : null}
        <h3>{t.camp ? <a href={'#/global/' + encodeURIComponent(t.camp.k)}>{nombre(t.camp)}</a> : limpioEv(t.e[1])}</h3>
        <p className="pv-sub">{limpioEv(t.e[1])}</p>
        <div className="pv-mn-num">
          <div><b>{t.bat}</b><small>{t.bat === 1 ? 'batalla' : 'batallas'}</small></div>
          <div><b>{A.t1.length}</b><small>en la T1</small></div>
        </div>
      </div>
    );
  }
  return (
    <div className="pv-mn">
      <p className="pv-et"><b>Su último campeón</b> · {u.ed}</p>
      <span className="pv-res c">Campeón</span>
      <h3>{u.camp.map((g, i) => <span key={g.k}>{i ? ' y ' : ''}<a href={'#/global/' + encodeURIComponent(g.k)}>{nombre(g)}</a></span>)}</h3>
      <p className="pv-sub">{u.fase}</p>
      <div className="pv-mn-num">
        <div><b>{A.eds.length}</b><small>{A.eds.length === 1 ? 'edición' : 'ediciones'}</small></div>
        <div><b>{A.campeones}</b><small>campeones</small></div>
        <div><b>{c.tit.length}</b><small>podios</small></div>
        <div><b>{c.ev.length}</b><small>en la T1</small></div>
      </div>
    </div>
  );
}
function GanadoresComp({ A }) {
  const xs = A.top.slice(0, 6);
  if (xs.length < 2) return null;
  const mx = Math.max(...xs.map((x) => x.o + x.p + x.b));
  return (
    <div className="pv-caja pv-tape">
      <p className="pv-et"><b>Los más ganadores</b> · sus podios acá</p>
      <ul>{xs.map((x) => (
        <li key={x.g.k}><span className="l"><a href={'#/global/' + encodeURIComponent(x.g.k)}>{nombre(x.g)}</a></span><span className="t"><i style={{ width: Math.round((100 * (x.o + x.p + x.b)) / mx) + '%' }} /></span><span className="v">{x.o + x.p + x.b}</span></li>
      ))}</ul>
      <div className="pv-tape-ley"><span><i />podios</span><span>{plural(A.top.length, 'freestyler', 'freestylers')} con podio</span></div>
    </div>
  );
}
function ReyesComp({ A }) {
  const xs = A.top.filter((x) => x.o).slice(0, 4);
  if (!xs.length) return null;
  return (
    <div className="pv-rivs">
      {xs.map((x, i) => (
        <button key={x.g.k} type="button" className={'pv-rv' + (i ? '' : ' vic')} onClick={irA(x.g)}>
          <CaraGl g={x.g} cls="cara pv-rv-c" />
          <span><span className="pv-et"><b>{i ? 'Campeón' : 'El que más ganó'}</b></span><b>{nombre(x.g)}</b><small><em>{plural(x.o, 'título', 'títulos')}</em>{x.p ? ' · ' + plural(x.p, 'final', 'finales') : ''}</small></span>
        </button>
      ))}
    </div>
  );
}
function EdicionesComp({ A, X, fil, setFil }) {
  const [todos, setTodos] = useState(false);
  useEffect(() => { setTodos(false); }, [fil]);
  const filas = [];
  A.eds.forEach((e) => { for (const [fase, xs] of e.fases) filas.push({ ed: e.ed, fase, xs }); });
  const ver = fil && fil !== 'todos' ? filas.filter((f) => f.ed === fil) : filas;
  if (!filas.length) return <p className="pv-nada">Todavía no sabemos de podios de esta competencia: los vamos sumando cuando sus campeones entran al Ranking global.</p>;
  const g = (k) => X.porK.get(k);
  return (
    <>
      {A.eds.length > 1 ? (
        <div className="pv-filas-f">
          <div className="pv-chips" role="group" aria-label="La edición">{[['todos', 'Todas', filas.length]].concat(A.eds.slice(0, 12).map((e) => [e.ed, e.ed, e.n])).map(([v, t, n]) => (
            <button key={v} type="button" className={(fil || 'todos') === v ? 'on' : ''} aria-pressed={(fil || 'todos') === v} onClick={() => setFil(v)}>{t} <em>{n}</em></button>
          ))}</div>
        </div>
      ) : null}
      <div className="pv-np-g">
        {(todos ? ver : ver.slice(0, VER)).map((f) => {
          const camp = f.xs.filter((x) => x[1] === 1);
          const r = pu(camp.length ? 'Campeón' : f.xs.some((x) => x[1] === 2) ? 'Subcampeón' : 'Tercero');
          const orden = f.xs.slice().sort((a, b) => a[1] - b[1]);
          return (
            <div key={f.ed + '|' + f.fase} className={'pv-np ' + r[1]} style={{ '--svc': '#2A2A2E' }}>
              <span className="pv-np-img"><span className="pv-np-ronda"><b>{edCorta(f.ed)}</b><span>{plural(f.xs.length, 'podio', 'podios')}</span></span></span>
              <span className="pv-np-tx">
                <span className="pv-np-f1"><span className={'pv-res ' + r[1]}>{camp.length ? 'Campeón' : r[0]}</span><span>{f.ed}</span></span>
                <b className="pv-np-h">{f.fase}</b>
                <span className="pv-np-tags">{orden.map(([k, p, duda]) => (
                  <span key={k + p}>{MEDALLA[p]}: {g(k) ? <a href={'#/global/' + encodeURIComponent(k)}>{nombre(g(k))}</a> : k}{duda ? ' ?' : ''}</span>
                ))}</span>
              </span>
            </div>
          );
        })}
      </div>
      {!todos && ver.length > VER ? <button type="button" className="pv-pie" onClick={() => setTodos(true)}><span>{plural(ver.length, 'fase', 'fases')}</span><b>Ver todas</b></button> : null}
    </>
  );
}
function T1Comp({ A }) {
  if (!A.t1.length) return <p className="pv-nada">Todavía no leímos un evento de esta competencia en la T1.</p>;
  return (
    <div className="pv-np-g">
      {A.t1.map((t) => (
        <div key={t.i} className={'pv-np ' + (t.camp ? 'c' : '')} style={{ '--svc': '#2A2A2E' }}>
          <span className="pv-np-img"><span className="pv-np-ronda"><b>{fechaEv(t.e[3])}</b><span>{plural(t.bat, 'batalla', 'batallas')}</span></span></span>
          <span className="pv-np-tx">
            <span className="pv-np-f1">{t.camp ? <span className="pv-res c">Campeón</span> : null}<span>{TIPO[t.e[2]] || t.e[2]}</span></span>
            <b className="pv-np-h">{limpioEv(t.e[1])}</b>
            <span className="pv-np-tags">
              {t.camp ? <span>Oro: <a href={'#/global/' + encodeURIComponent(t.camp.k)}>{nombre(t.camp)}</a></span> : null}
              {t.fin ? <span>Plata: <a href={'#/global/' + encodeURIComponent(t.fin.k)}>{nombre(t.fin)}</a></span> : null}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
function SobreComp({ c, A, H }) {
  const [fam, tipo] = familia(c.n);
  const xs = [['Tipo', tipo, fam === 'TORNEO' ? '' : fam]];
  if (A.cc) xs.push(['País', <span key="p"><Bandera cc={A.cc} cls="pv-flag" />{nombrePais(A.cc)}</span>, '']);
  if (A.eds.length) xs.push(['Ediciones', A.eds[A.eds.length - 1].ed + ' a ' + A.eds[0].ed, plural(A.eds.length, 'edición', 'ediciones') + ' con podios que conocemos']);
  if (A.ult) xs.push(['Último campeón', A.ult.camp.map(nombre).join(' y '), A.ult.ed]);
  return (
    <>
      <section className="pv-cajal">
        <h3>Sobre la competencia</h3>
        <ul className="pv-sob">{xs.map(([a, b, cc]) => <li key={a}><span>{a}</span><span><b>{b}</b>{cc ? <small>{cc}</small> : null}</span></li>)}</ul>
      </section>
      <section className="pv-cajal">
        <h3>De dónde sale</h3>
        <p className="pv-sub">{'Los podios salen de la carrera de ' + plural(Object.keys((H && H.p) || {}).length, 'freestyler', 'freestylers') + ' del Ranking global, de Freestylestats. Si alguien que ganó no está en el Ranking global, su título todavía no aparece acá.'}</p>
      </section>
    </>
  );
}

export function PaginaCompetencia({ liga, id }) {
  const [D, mal, reintentar] = useGlobal();
  const X = useMemo(() => (D ? preparar(D, liga) : null), [D, liga]);
  const H = useHistoria();
  const C = useMemo(() => (D && H ? indiceCompetencias(H, D) : null), [D, H]);
  let cid = id;
  try { cid = decodeURIComponent(id); } catch (e) { /* tal cual */ }
  const c = C ? C[cid] || C[slugComp(cid)] || null : null;
  const A = useMemo(() => (c && X ? armarComp(c, X) : null), [c, X]);
  const [tab, setTab] = useState('');
  const [fil, setFil] = useState('todos');
  useEffect(() => { window.scrollTo(0, 0); setTab(''); setFil('todos'); }, [cid]);
  useEffect(() => {
    if (!c) return undefined;
    const poner = () => { document.title = c.n + ' · Ranking global de freestyle'; };
    poner();
    const r = setTimeout(poner, 0);
    return () => clearTimeout(r);
  }, [c]);
  if (mal) return <section className="sec pf-sec"><p className="pronto-p">No pude cargar el Ranking global. <button type="button" className="te-link" onClick={reintentar}>Reintentar</button></p></section>;
  if (!X || !H) return <div className="cargando">Cargando…</div>;
  if (!c || !A) {
    return (
      <section className="sec pf-sec">
        <div className="sec-t"><h2>No conocemos esa competencia</h2></div>
        <p className="pronto-p">Búscala en el buscador de arriba o mira el <a className="te-link" href="#/ranking/global">Ranking global</a>.</p>
      </section>
    );
  }
  const ir = (t, f) => {
    setTab(t);
    if (f) setFil(f);
    const raiz = document.querySelector('#inicio-nuevo');
    const el = raiz && raiz.shadowRoot && raiz.shadowRoot.querySelector('.pv-tabs');
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  };
  const nFases = A.eds.reduce((s, e) => s + e.fases.size, 0);
  const T = [['eds', 'Ediciones', nFases], ['t1', 'En la T1', A.t1.length]];
  const tabV = tab || (nFases ? 'eds' : 't1');
  return (
    <div className="pf8-pag pf9-pag glpv">
      <CabezaComp liga={liga} c={c} A={A} />
      <div className="pv">
        <section className="pv-esc" aria-label="Su historia">
          <MomentosComp A={A} ir={ir} />
          <div className="pv-ag">
            <ReyComp A={A} />
            <UltimoComp c={c} A={A} />
            <div className="pv-pila"><GanadoresComp A={A} /></div>
          </div>
          <ReyesComp A={A} />
        </section>
        <section className="pv-papel">
          <div className="pv-g">
            <div className="pv-izq">
              <div className="pv-tabs" role="tablist" aria-label="La competencia">
                {T.map(([tid, n, cnt]) => (
                  <button key={tid} type="button" role="tab" aria-selected={tabV === tid} className={tabV === tid ? 'on' : ''} onClick={() => setTab(tid)}>{ICO[tid === 'eds' ? 'logros' : 'noches']}<span className="pv-tab-t">{n}</span>{cnt ? <small>{cnt}</small> : null}</button>
                ))}
              </div>
              {tabV === 'eds' ? <EdicionesComp A={A} X={X} fil={fil} setFil={setFil} /> : <T1Comp A={A} />}
            </div>
            <aside className="pv-lado"><SobreComp c={c} A={A} H={H} /></aside>
          </div>
        </section>
      </div>
    </div>
  );
}
