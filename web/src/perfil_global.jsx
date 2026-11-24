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
import { GRUPO, MEDALLA, PUESTO, limpioEv, miles, n1, nombre, plural, porEvento, porTx, preparar, rivalDe, useGlobal, useHistoria } from './global.jsx';

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
        <h3>{t[1]}</h3>
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
        <li key={x.c}><span className="l">{x.c}</span><span className="t"><i style={{ width: Math.round((100 * x.n) / mx) + '%' }} /></span><span className="v">{x.n}</span></li>
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
                <b className="pv-np-h">{t[1]}</b>
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
