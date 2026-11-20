// 🪪 EL PERFIL, DEBAJO DE TU NOMBRE, la v10 (19/11/2026). Dlx, a la maqueta privada
// (https://claude.ai/artifact/TydR6JiTZpcXuyDYyBsDUY): «pasa la v10 a mi perfil». Reemplaza las cuatro bandas de la 6.26.
// Arriba, en negro: sus momentos (los destacados de Instagram), el récord, su mejor noche, contra la Liga y sus rivales en
// una fila. Abajo, como un perfil de Instagram o de Roblox: su próximo evento, sus ligas, las pestañas —Publicaciones,
// Eventos, Videos, Logros— y al costado «Sobre él», su camino, lo que lleva puesto, cara a cara y dónde está.
// Todo sale de lo que el perfil ya trae (`p.ev`, `p.du`, `p.mu`, su fila) y de los pedidos de siempre: sin dato no hay pieza.
// ⚠️ Las clases van con `pv-`: las del prototipo son globales adentro del shadow root (`.cara`, `.esc`, `.tag` ya existen).
import { useEffect, useMemo, useRef, useState } from 'react';
import { diaISO, limpio, num, siglaDe, srcLogo } from './liga.js';
import { Bandera, Cara, accion } from './piezas.jsx';
import { historiasDePersona } from './arriba.jsx';
import { escenaDe, urlFondo, useFondos } from './fondos.js';
import { usePaseDe, usePases, usePase } from './pase.js';
import { crewDe, useCrews } from './crews.js';
import { Escudo, escudoDe } from './escudo.jsx';
import { pedirLigas } from './ligas_datos.js';
import { useCompetencias } from './competencias_datos.js';
import { useAplausos } from './aplausos.js';
import { useComentarios } from './comentarios.jsx';
import { Felicitar, Fila } from './publicaciones2.jsx';
import { LuNube, LuSocial } from './medio.jsx';
import { delHilo } from './comentarios.jsx';
import CSS_V10 from './css/perfil_v10.css?inline';
import { usarCss } from './css.js';

usarCss('perfil_v10', CSS_V10);

// ── lo de siempre ──
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MES_L = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const fecha = (t) => {
  if (!t) return 'sin fecha';
  const [, m, d] = diaISO(new Date(t)).split('-');
  return Number(d) + ' ' + MES[Number(m) - 1];
};
const sinB = (s) => limpio(String(s || '').replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '')).trim();
const ini = (n) => (String(n || '').replace(/[^\p{L}\p{N}]/gu, '').charAt(0) || '?').toUpperCase();
const PU = { Campeón: ['CAMPEÓN', 'c', 7], Subcampeón: ['FINAL', 's', 6], Tercero: ['PODIO', 't', 5], Cuarto: ['SEMIS', 't', 4],
  Semifinal: ['SEMIS', 't', 4], Cuartos: ['CUARTOS', '', 3], Octavos: ['OCTAVOS', '', 2] };
const pu = (p) => PU[p] || [String(p || '').toUpperCase(), '', 1];
const CORTO = { Campeón: 'C', Subcampeón: 'F', Tercero: 'SF', Cuarto: 'SF', Semifinal: 'SF', Cuartos: '4°', Octavos: '8°' };
const NIVEL5 = (x) => (x === 'Campeón' ? 'c' : x === 'Subcampeón' ? 's' : ['Tercero', 'Cuarto', 'Semifinal'].includes(x) ? 't' : x === 'Cuartos' ? 'q' : 'o');
const sinTit = (e) => /^\(?\s*sin t[ií]tulo\s*\)?$/i.test(String(e.nom || '').trim());
const nomEv = (e) => (sinTit(e) ? e.sv + ' · ' + fecha(e.t) : e.nom);
const DIMS = ['Eficiencia', 'Consistencia', 'Dominancia', 'Racha', 'Diversidad'];
const DIAS_N = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];
const DIA1 = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIA_C = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
// el día de la semana y la hora en ET (las horas de la Liga son las del este)
const PARTES = typeof Intl !== 'undefined' ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', hour12: false }) : null;
const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const enET = (t) => {
  const ps = PARTES ? PARTES.formatToParts(new Date(t)) : [];
  const w = (ps.find((x) => x.type === 'weekday') || {}).value;
  const h = Number((ps.find((x) => x.type === 'hour') || {}).value) % 24;
  return [DOW[w] ?? new Date(t).getDay(), isNaN(h) ? 0 : h];
};
const yt = (vid) => 'https://i.ytimg.com/vi/' + vid + '/mqdefault.jpg';

const SVG = {
  corona: <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2 6l4 4 4-7 4 7 4-4-2 10H4z" fill="#E5B800" /></svg>,
  mira: <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="10" cy="10" r="2.2" fill="currentColor" /><path d="M10 0v5M10 15v5M0 10h5M15 10h5" stroke="currentColor" strokeWidth="2" /></svg>,
  copa: (c) => <svg viewBox="0 0 20 26" aria-hidden="true"><path d="M3 2h14l-1 8q-1 6-6 6t-6-6z" fill={c} /><path d="M3 4H1q0 5 3 6M17 4h2q0 5-3 6" fill="none" stroke={c} strokeWidth="1.6" /><rect x="8.5" y="16" width="3" height="5" fill={c} /><rect x="5" y="21" width="10" height="3" rx="1" fill={c} /></svg>,
};
const ICO = {
  pubs: <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2h12v9H6l-4 3z" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>,
  noches: <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 1h6v6H1zM9 1h6v6H9zM1 9h6v6H1zM9 9h6v6H9z" fill="currentColor" /></svg>,
  videos: <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 3h14v10H1z" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M6.5 5.5l4 2.5-4 2.5z" fill="currentColor" /></svg>,
  logros: <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1l2 4.2 4.6.5-3.4 3.1 1 4.5L8 11l-4.2 2.3 1-4.5L1.4 5.7 6 5.2z" fill="currentColor" /></svg>,
};

// ── una cara por nombre (el rival puede no estar en la tabla) ──
function CaraN({ liga, n, cls = 'cara pv-cara' }) {
  const r = n ? liga.quien(n) : null;
  return <Cara liga={liga} k={r ? r.k : ''} nombre={sinB(n)} cls={cls} />;
}

// ════════ los datos, de una vez ════════
export function useV10(liga, k, f, p, e) {
  return useMemo(() => {
    const E = e || {};
    const evs = ((p && p.ev) || []).map(([n, puesto, pts]) => {
      const x = E[n] || E[String(n)] || [];
      return { n, pu: puesto, pts: pts || 0, nom: limpio(x[0] || 'Evento ' + n), sv: x[1] || '', t: x[2] ? Date.parse(x[2]) : 0, gente: x[3] || 0 };
    });
    const enT = evs.filter((x) => x.t).sort((a, b) => a.t - b.t);
    const du = (p && p.du) || [];
    const porEv = {};
    du.forEach(([n, r, w]) => { const x = porEv[n] || (porEv[n] = { gano: [], cayo: '' }); if (w) x.gano.push(r); else x.cayo = r; });
    const riv = new Map();
    du.forEach(([n, r, w]) => {
      const q = liga.quien(r);
      const id = q ? q.k : 'n:' + sinB(r).toLowerCase();
      if (!riv.has(id)) riv.set(id, { id, k: q ? q.k : '', n: q ? q.n : r, g: 0, p: 0, ult: 0 });
      const x = riv.get(id);
      if (w) x.g += 1; else x.p += 1;
      const ev = E[n] || E[String(n)];
      if (ev && ev[2]) x.ult = Math.max(x.ult, Date.parse(ev[2]));
    });
    const rivs = [...riv.values()].sort((a, b) => (b.g + b.p) - (a.g + a.p) || b.ult - a.ult);
    const g = du.filter((d) => d[2]).length;
    const mejor = enT.slice().sort((a, b) => pu(b.pu)[2] - pu(a.pu)[2] || b.pts - a.pts || b.gente - a.gente)[0] || null;
    const cuenta = (x) => evs.filter((y) => y.pu === x).length;
    // el de al lado en la tabla: el de adelante, o —si es el #1— el que lo persigue
    const filas = Object.values(liga.T || {}).filter((x) => x && x.pos);
    const pos = Number(f.pos) || 0;
    const ad = pos > 1 ? filas.find((x) => Number(x.pos) === pos - 1) : null;
    const at = pos ? filas.find((x) => Number(x.pos) === pos + 1) : null;
    const cercano = ad ? { f: ad, arriba: true } : at ? { f: at, arriba: false } : null;
    // su mejor victoria: el de mejor puesto de la Temporada al que le ganó un duelo
    let mejorVic = null;
    du.forEach(([n, r, w]) => {
      if (!w) return;
      const q = liga.quien(r);
      if (!q || !q.pos || q.k === k) return;
      if (!mejorVic || Number(q.pos) < Number(mejorVic.f.pos)) mejorVic = { f: q, n };
    });
    if (mejorVic) { const x = E[mejorVic.n] || E[String(mejorVic.n)] || []; mejorVic.ev = limpio(x[0] || ''); mejorVic.sv = x[1] || ''; }
    return { evs, enT, du, porEv, rivs, g, perd: du.length - g, mejor, oro: cuenta('Campeón'), seg: cuenta('Subcampeón'), ter: cuenta('Tercero'), cercano, mejorVic };
  }, [liga, k, f, p, e]);
}

// 💎 SU ELO Y SU PIEDRA (la tabla de divisiones del lobby, como la lee divisiones.jsx: `[nombre, ELO, batallas, …]`)
export function eloDe(liga, k) {
  const V = liga.d && liga.d.div;
  if (!V || V.m !== 'elo' || !Array.isArray(V.d)) return null;
  const SUBS = ['I', 'II', 'III'];
  for (let di = 0; di < V.d.length; di++) {
    for (const g of V.d[di] || []) {
      for (let i = 0; i < (g || []).length; i++) {
        const r = g[i];
        const q = r && liga.quien(r[0]);
        if (!q || q.k !== k) continue;
        const t = V.t || [];
        const piso = di < t.length ? t[di] : (t[t.length - 1] || 0) - 50;
        const s = Math.max(0, Math.min(2, Math.floor((r[1] - piso) / (50 / 3))));
        const prox = s < 2 ? [(V.n || [])[di] + ' ' + SUBS[s + 1], piso + Math.ceil(((s + 1) * 50) / 3)] : di > 0 ? [(V.n || [])[di - 1] + ' I', t[di - 1]] : null;
        return { elo: r[1], bat: r[2], piedra: (V.n || [])[di] || '', sub: SUBS[s], c: (V.c || [])[di] || '#8A8F98', pos: i + 1, tot: g.length, prox, prov: r[2] < (V.pv || 5) };
      }
    }
  }
  return null;
}
export function EloNum({ liga, k }) {
  const e = eloDe(liga, k);
  if (!e) return null;
  const tt = e.prox ? 'Le faltan ' + (e.prox[1] - e.elo) + ' de ELO para ' + e.prox[0] : 'Lo más alto que hay';
  return (
    <a className="pv-elo" href="#/ranking/divisiones" style={{ '--pc': e.c }} title={tt}>
      <i className="pv-gema" aria-hidden="true" />
      <span><b>{num(e.elo)}</b><small>ELO · <em>{e.piedra} {e.sub}</em>{e.prov ? ' · provisional' : ''}</small></span>
    </a>
  );
}

// 🏆 LA VITRINA, VIVA COMO TARJETAS: un abanico de placas con la escena de su servidor y el trofeo encima
export function PlacasVitrina({ liga, p, e }) {
  const E = e || {};
  const xs = ((p && p.ev) || []).filter((x) => x[1] === 'Campeón').map((x) => ['#E5B800', x])
    .concat(((p && p.ev) || []).filter((x) => x[1] === 'Subcampeón').map((x) => ['#C9CDD2', x])).slice(0, 3);
  if (!xs.length) return <span className="pv-placas" aria-hidden="true">{[0, 1, 2].map((i) => <span key={i} className="pv-pl v">{SVG.copa('#55555B')}</span>)}</span>;
  return (
    <span className="pv-placas" aria-hidden="true">
      {xs.map(([c, x], i) => {
        const sv = (E[x[0]] || E[String(x[0])] || [])[1] || '';
        const es = escenaDe(sv);
        return <span key={i} className="pv-pl" style={{ '--mc': c, ...(es ? { backgroundImage: 'url("' + es + '")' } : { backgroundColor: (liga.svs[sv] || {}).color || '#2A2A2E' }) }}>{SVG.copa(c)}</span>;
      })}
    </span>
  );
}

// ════════ 🟡 SUS MOMENTOS ════════
// Como los destacados de Instagram (Dlx: «que tengan su propia imagen única, no logos; quizás uno que se llame Mi servidor
// con el logo de ese, igual con su crew»). El logo va SÓLO en «Mi servidor» y «Mi crew»; cada momento lleva lo suyo, y
// ninguna imagen dos veces. Un toque abre lo suyo: sus historias de ese tipo en el visor, su servidor, su crew, la pestaña
function Momentos({ liga, k, f, p, D, esYo, ligas, ir }) {
  useCrews();
  const fo = (useFondos() || {})[k];
  const fondo = fo && urlFondo(fo[0]) ? fo[0] : '';
  const cs = (f.c || []).map((c) => liga.cartaUrl(k, c));
  const cv = crewDe(k);
  const mu = (p && p.mu) || [];
  const usadas = new Set();
  const img = (us, letra, zoom) => {
    const u = [].concat(us).find((x) => x && !usadas.has(x));
    if (u) { usadas.add(u); return <img alt="" src={u} className={zoom && cs.includes(u) ? 'zoom' : undefined} style={zoom && cs.includes(u) ? { transformOrigin: zoom } : undefined} loading="lazy" />; }
    return <em>{letra}</em>;
  };
  const cara = (n) => { const q = n && liga.quien(n); return q ? liga.avUrl(q.k, 256) : ''; };
  const hist = (tipos) => {
    const xs = mu.filter((m) => tipos.includes(m.tipo));
    return () => {
      try { const g = historiasDePersona(liga, k, xs); if (g && g.slides && g.slides.length && window.lgVerHistorias) { window.lgVerHistorias(g, g.slides[g.slides.length - 1].id); return; } } catch (err) { /* sin visor */ }
      ir('pubs');
    };
  };
  const xs = [];
  const sv = liga.svs[f.sv] || {};
  if (f.sv) xs.push(['sv', 'Mi servidor', img(liga.logo(f.sv), siglaDe(f.sv)), '', sv.color || '#29B298', 'logo', () => { location.hash = '#/sv/' + siglaDe(f.sv); }]);
  if (cv) {
    const e0 = escudoDe(cv.c.logo, cv.c.nombre);
    const im = e0 ? <Escudo e={e0} sigla={cv.c.sigla} /> : img(srcLogo(cv.c.logo), cv.c.sigla || ini(cv.c.nombre));
    xs.push(['crew', 'Mi crew', im, '', '#9B5CFF', 'logo', () => { location.hash = '#/crew/' + encodeURIComponent(cv.c.id); }]);
  }
  const tit = D.enT.filter((x) => x.pu === 'Campeón');
  const carta = (c) => (f.c || []).includes(c) ? liga.cartaUrl(k, c) : '';
  if (tit.length) xs.push(['tit', 'Títulos', img([carta('servidor'), carta('competitivo'), carta('temporada')], '1º', '50% 40%'), tit.length, '#E5B800', 'carta', hist(['campeon'])]);
  const fin = D.enT.filter((x) => x.pu === 'Subcampeón');
  if (fin.length) { const z = D.porEv[fin[fin.length - 1].n] || {}; xs.push(['fin', 'Finales', img([cara(z.cayo)].concat(cs), ini(z.cayo), '50% 80%'), fin.length, '#C9CDD2', '', () => ir('noches', 's')]); }
  const cz = mu.filter((m) => m.tipo === 'caza');
  if (cz.length) xs.push(['caz', 'Cazas', img(cara(cz[0].a), ini(cz[0].a)), cz.length, '#E41373', '', hist(['caza'])]);
  const lg = (ligas || []).filter((x) => x.flyer);
  if ((ligas || []).length) xs.push(['lig', 'Ligas', img(lg.length ? lg[0].flyer : '', 'L'), ligas.length, '#2F6FDB', '', () => { const el = document.querySelector('#inicio-nuevo') && document.querySelector('#inicio-nuevo').shadowRoot.querySelector('#pf-ligas'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }]);
  const vs = ((p && p.vid) || []).concat((p && p.vp) || []);
  if (vs.length) xs.push(['vid', 'Videos', img(yt(vs[0][0]), '▶'), vs.length, '#F6F6F6', '', () => ir('videos')]);
  const aw = mu.filter((m) => m.tipo === 'mesaward' || m.tipo === 'premios');
  if (aw.length) xs.push(['prem', 'Premios', img(fondo, '★'), aw.length, '#E5B800', '', hist(['mesaward', 'premios'])]);
  if (f.rg) xs.push(['rg', 'Rango ' + f.rg, <em key="rg">{f.rg}</em>, '', liga.colorRg(f.rg), 'rango', hist(['rango'])]);
  if (D.enT[0]) {
    const z = D.porEv[D.enT[0].n] || { gano: [] };
    const r = z.gano[0] || z.cayo;
    xs.push(['deb', 'Debut', img([cara(r), liga.avUrl(k, 256)].concat(cs), 'D', '50% 52%'), '', '#29B298', '', () => accion.llave(D.enT[0].n)]);
  }
  if (!xs.length) return null;
  return (
    <div className="pv-mom" role="list" aria-label={esYo ? 'Tus momentos' : 'Sus momentos'}>
      {xs.map(([id, n, im, c, rc, cl, fn]) => (
        <button key={id} type="button" role="listitem" className={cl ? 'pv-mom-' + cl : undefined} style={{ '--rc': rc }} onClick={fn}>
          <span className="pv-ci"><span>{im}</span>{c ? <i>{c}</i> : null}</span><b>{n}</b>
        </button>
      ))}
    </div>
  );
}

// ════════ ARRIBA: el récord, su mejor noche, contra la Liga y sus rivales ════════
function Record({ f, p, D, esYo }) {
  const tot = D.g + D.perd;
  const rd = (p && p.rd) || [0, 0];
  const rk = (p && p.rk) || {};
  const ult = D.enT.slice(-5).reverse();
  return (
    <div className="pv-rec">
      <p className="pv-et"><b>El récord</b> · duelos 1v1</p>
      {tot ? (
        <>
          <div className="pv-rec-n"><span>{D.g}</span><i>–</i><span className="p">{D.perd}</span></div>
          <p className="pv-sub">{Math.round((100 * D.g) / tot)} % ganados{rk.du ? ' · #' + rk.du[0] + ' de ' + rk.du[1] + ' en Duelos' : ''}</p>
          <div className="pv-rec-bar" role="img" aria-label={D.g + ' ganados y ' + D.perd + ' perdidos'}><i style={{ width: ((100 * D.g) / tot).toFixed(1) + '%' }} /></div>
        </>
      ) : <div className="pv-vac"><b>{esYo ? 'Tu primer duelo' : 'Su primer duelo'}</b><span>El récord arranca en el primer 1v1 de una llave: acá se van a ver las ganadas y las perdidas.</span></div>}
      <div className="pv-cint">
        <div><b><span className="pv-med o" />{D.oro || f.oro || 0}</b><small>títulos</small></div>
        <div><b><span className="pv-med p" />{D.seg}</b><small>finales perdidas</small></div>
        <div><b><span className="pv-med b" />{D.ter}</b><small>terceros</small></div>
      </div>
      {tot ? <div className="pv-racha"><span>Racha de duelos</span><span><b>{rd[0]}</b> hoy · <b>{rd[1]}</b> {esYo ? 'tu' : 'su'} mejor</span></div> : null}
      {ult.length ? (
        <>
          <div className="pv-forma-l"><span>{esYo ? 'Tu forma' : 'Su forma'}</span><span>las últimas {ult.length}</span></div>
          <div className="pv-forma">{ult.map((x) => <button key={x.n} type="button" className={pu(x.pu)[1]} title={nomEv(x)} onClick={() => accion.llave(x.n)}>{CORTO[x.pu] || 'R32'}</button>)}</div>
        </>
      ) : null}
    </div>
  );
}

function MejorNoche({ liga, D, esYo }) {
  const mn = D.mejor;
  if (!mn) return <div className="pv-mn vac"><p className="pv-et"><b>{esYo ? 'Tu primera noche' : 'Su primera noche'}</b></p><p className="pv-sub">Con el primer evento, acá va la mejor noche, con a quién le ganó.</p></div>;
  const x = D.porEv[mn.n] || { gano: [], cayo: '' };
  const pasos = x.gano.map((n) => [n, 'le ganó', '']).concat(x.cayo ? [[x.cayo, 'cayó', 'x']] : []);
  return (
    <div className="pv-mn">
      <p className="pv-et"><b>{esYo ? 'Tu mejor noche' : 'Su mejor noche'}</b> · {fecha(mn.t)} · {siglaDe(mn.sv)}</p>
      <span className={'pv-res ' + pu(mn.pu)[1]}>{pu(mn.pu)[0]}</span>
      <h3><button type="button" onClick={() => accion.llave(mn.n)}>{nomEv(mn)}</button></h3>
      {pasos.length ? (
        <div className="pv-camino">
          {pasos.slice(-5).map(([n, t, c], i) => (
            <span key={i} className="pv-paso-w">{i ? <span className="pv-fl" aria-hidden="true">›</span> : null}
              <span className={'pv-paso ' + c}><CaraN liga={liga} n={n} /><b>{sinB(n)}</b><small>{t}</small></span></span>
          ))}
        </div>
      ) : null}
      <div className="pv-mn-num">
        <div><b>+{num(mn.pts)}</b><small>puntos</small></div>
        <div><b>{mn.gente || '—'}</b><small>raperos</small></div>
        <div><b>{x.gano.length}</b><small>{x.gano.length === 1 ? 'duelo ganado' : 'duelos ganados'}</small></div>
        <div><b>{D.enT.length}</b><small>{D.enT.length === 1 ? 'noche jugada' : 'noches jugadas'}</small></div>
      </div>
    </div>
  );
}

function ContraLiga({ f, p, dmp, esYo }) {
  const dm = (p && p.dm) || null;
  if (!dm || !dm.some((x) => x)) return null;
  const pr = dmp || [];
  return (
    <div className="pv-caja pv-tape">
      <p className="pv-et"><b>Contra la Liga</b> · {esYo ? 'tus' : 'sus'} cinco fortalezas</p>
      <ul>{DIMS.map((n, i) => (
        <li key={n}><span className="l">{n}</span><span className="t"><i style={{ width: (dm[i] || 0) + '%' }} />{pr[i] != null ? <s style={{ left: pr[i] + '%' }} /> : null}</span><span className="v">{dm[i] || 0}</span></li>
      ))}</ul>
      <div className="pv-tape-ley"><span><i />{limpio(f.n)}</span><span><i className="m" />el promedio de la Liga</span></div>
      {(f.ev || 0) < 10 ? <p className="pv-sub">Provisorio: con pocos eventos cambia mucho.</p> : null}
    </div>
  );
}

function Rivales4({ liga, f, D, esYo }) {
  const xs = [];
  const cl = D.rivs[0] && D.rivs[0].g + D.rivs[0].p >= 3 ? D.rivs[0] : null;
  const ir = (kk) => (kk ? () => { location.hash = '#/r/' + encodeURIComponent(kk); } : undefined);
  const caja = (key, cls, n, kk, et, nom, det) => (
    <button key={key} type="button" className={'pv-rv ' + cls} onClick={ir(kk)} disabled={!kk}>
      <CaraN liga={liga} n={n} cls="cara pv-rv-c" /><span><span className="pv-et"><b>{et}</b></span><b>{nom}</b><small>{det}</small></span>
    </button>
  );
  if (cl) xs.push(caja('cl', '', cl.n, cl.k, esYo ? 'Tu clásico' : 'Su clásico', sinB(cl.n), <><em>{cl.g}–{cl.p}</em> en {cl.g + cl.p} cruces · {cl.g > cl.p ? 'gana la serie' : cl.g < cl.p ? 'pierde la serie' : 'empatados'}</>));
  const nem = D.rivs.filter((r) => r.p >= 2 && r.p > r.g && r !== cl).sort((a, b) => b.p - a.p || a.g - b.g)[0];
  if (nem) xs.push(caja('nem', 'nem', nem.n, nem.k, esYo ? 'Tu némesis' : 'Su némesis', sinB(nem.n), <>le ganó <em>{nem.p} de {nem.g + nem.p}</em></>));
  const mv = D.mejorVic;
  if (mv) xs.push(caja('vic', 'vic', mv.f.n, mv.f.k, esYo ? 'Tu mejor victoria' : 'Su mejor victoria', sinB(mv.f.n), <>le ganó al <em>#{mv.f.pos}</em> de la Temporada{mv.ev ? ' · en ' + (sinTit({ nom: mv.ev }) ? siglaDe(mv.sv) : mv.ev) : ''}</>));
  const ce = D.cercano;
  if (ce) {
    const gap = Math.abs((Number(ce.f.pts) || 0) - (Number(f.pts) || 0));
    xs.push(caja('ce', '', ce.f.n, ce.f.k, ce.arriba ? 'El que tiene adelante' : (esYo ? 'El que te persigue' : 'El que lo persigue'), sinB(ce.f.n),
      <><em>#{ce.f.pos}</em> · {ce.arriba ? 'le faltan ' + num(gap) + ' pts para pasarlo' : 'a ' + num(gap) + ' pts de alcanzarlo'}</>));
  }
  if (xs.length < 4 && !cl) xs.push(<div key="v1" className="pv-rv vac"><span><b>{esYo ? 'Tu clásico' : 'Su clásico'}</b>Aparece al cruzarse tres veces con el mismo rival.</span></div>);
  if (xs.length < 4 && !mv) xs.push(<div key="v2" className="pv-rv vac"><span><b>{esYo ? 'Tu mejor victoria' : 'Su mejor victoria'}</b>La primera vez que le gane a alguien de la tabla, va acá.</span></div>);
  return <div className="pv-rivs">{xs.slice(0, 4)}</div>;
}

// ════════ ABAJO: su próximo evento y sus ligas ════════
function Proximo({ liga, k, esYo }) {
  const ps = (liga.d && liga.d.proximos) || [];
  const ahora = Date.now();
  const e = ps.find((x) => {
    const t = Date.parse(x.cuando);
    if (!t || t < ahora - 3600e3 || t > ahora + 36 * 3600e3) return false;
    try { return liga.anotados(x).some((a) => a.f && a.f.k === k); } catch (err) { return false; }
  });
  if (!e) return null;
  const t = Date.parse(e.cuando);
  const [dw, h] = enET(t);
  const m = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', minute: '2-digit' }).format(new Date(t));
  const hora = (h % 12 || 12) + ':' + String(m).padStart(2, '0') + (h < 12 ? ' AM' : ' PM');
  const es = escenaDe(e.sv);
  return (
    <div className={'pv-prox' + (es ? ' con-esc' : '')} style={es ? { backgroundImage: 'url("' + es + '")' } : undefined}>
      <img alt="" src={liga.logo(e.sv)} />
      <div>
        <p className="pv-et"><b>{esYo ? 'Tu próximo evento' : 'Su próximo evento'}</b> · está anotado</p>
        <h4>{limpio(e.nombre)}</h4>
        <small>{siglaDe(e.sv)} · {DIA1[dw]} · {hora} ET{e.modalidad ? ' · ' + e.modalidad : ''}</small>
      </div>
      <div className="pv-prox-b">
        {e.link ? <a className="btn borde" href={e.link} target="_blank" rel="noopener noreferrer">Ir a verlo</a> : null}
        <a className="btn borde" href="#/avisos">Avisarme</a>
      </div>
    </div>
  );
}

// las ligas de los servidores con su flyer y su puesto, la de la Liga Global y su ascenso
function useSusLigas(liga, k, p) {
  const [det, setDet] = useState(null);
  useEffect(() => { let vivo = true; pedirLigas(liga.d && liga.d.sello).then((x) => { if (vivo) setDet(x); }); return () => { vivo = false; }; }, [liga.d && liga.d.sello]); // eslint-disable-line react-hooks/exhaustive-deps
  const C = useCompetencias();
  return useMemo(() => {
    const xs = [];
    for (const L of ((liga.d.ligas || {}).ligas) || []) {
      const i = (L.tabla || []).findIndex(([raw]) => ((L.ks || {})[raw] || (liga.quien(raw) || {}).k) === k);
      if (i < 0) continue;
      const [, pj, pg, pts] = L.tabla[i];
      const fl = det && det.ligas && det.ligas[L.id] && det.ligas[L.id].flyer;
      xs.push({ id: L.id, n: L.n, sv: L.sv, pos: i + 1, tot: L.tabla.length, pj, pg, pts, flyer: (fl && fl.u) || '' });
    }
    let lc = null;
    for (const g of (C && C.ligas && C.ligas.g) || []) {
      const i = (g.t || []).findIndex((r) => r[0] === k);
      if (i >= 0) lc = { g: g.id, nv: g.nv || '', pos: i + 1, tot: g.t.length, pj: g.t[i][1], pg: g.t[i][2], pts: g.t[i][3] };
    }
    return { xs, lc, asc: (p && p.asc) || null };
  }, [liga, k, p, det, C]);
}
const NV_C = { oro: '#E5B800', plata: '#C9CDD2', bronce: '#C8702A', ascenso: '#29B298', elite: '#E41373' };
function SusLigasV({ liga, L, esYo }) {
  const { xs, lc, asc } = L;
  if (!xs.length && !lc && !asc) return null;
  return (
    <div id="pf-ligas">
      <div className="pv-lg-h"><h3>{esYo ? 'Tus ligas' : 'Sus ligas'}</h3><a href="#/ligas">Ligas</a></div>
      <div className="pv-lg">
        {xs.map((l) => (
          <a key={l.id} className="pv-lg-c" href={'#/ligas/' + encodeURIComponent(l.id)}>
            <span className="pv-lg-fl" style={{ '--svc': (liga.svs[l.sv] || {}).color || '#030304' }}>
              {l.flyer ? <img className="pv-lg-img" alt="" src={l.flyer} loading="lazy" /> : null}
              <span className="pv-lg-sv"><img alt="" src={liga.logo(l.sv)} />{siglaDe(l.sv)}</span>
              <span className="pv-lg-ps">{l.pos}º<small>de {l.tot}</small></span>
            </span>
            <span className="pv-lg-tx"><b>{l.n}</b><small>{l.pg} de {l.pj} {l.pj === 1 ? 'ganada' : 'ganadas'} · {l.pts} pts</small></span>
          </a>
        ))}
        {lc ? (
          <a className="pv-lg-c" href="#/competencias">
            <span className="pv-lg-fl" style={{ '--svc': '#030304' }}><span className="pv-lg-med" style={{ background: NV_C[lc.nv] || '#29B298' }}>{lc.pos}º</span><span className="pv-lg-sv">LIGA GLOBAL</span></span>
            <span className="pv-lg-tx"><b>Liga {lc.nv ? lc.nv.charAt(0).toUpperCase() + lc.nv.slice(1) : ''} · grupo {String(lc.g).split('-').pop()}</b><small>{lc.pos}º de {lc.tot} · {lc.pg} de {lc.pj} · {lc.pts} pts</small></span>
          </a>
        ) : null}
        {asc ? (
          <a className="pv-lg-c" href={'#/ligas/' + encodeURIComponent(asc[5] || '')}>
            <span className="pv-lg-fl" style={{ '--svc': (liga.svs[asc[0]] || {}).color || '#030304' }}><img className="pv-lg-logo" alt="" src={liga.logo(asc[0], true)} /><span className="pv-lg-sv">ASCENSO</span><span className="pv-lg-ps">{asc[2]}º</span></span>
            <span className="pv-lg-tx"><b>Ascenso a la {asc[1]}</b><small>{asc[6] ? 'hoy sube' : asc[4] ? 'a ' + num(asc[4]) + ' pts de subir' : 'empatado con el último que sube'} · {num(asc[3])} pts</small></span>
          </a>
        ) : null}
      </div>
    </div>
  );
}

// ════════ LAS PESTAÑAS ════════
// 📋 LA FILA DE «LO ÚLTIMO» DEL INICIO (Dlx, v5: «que publicaciones tenga la apariencia de publicaciones del inicio de lo
// último»): su cara con la esquinita de qué es, la etiqueta en su color, felicitar, reaccionar y comentar de verdad. Las
// mismas clases que el Inicio (`nt-f lu-r`, vivo.css): si allá cambia, acá también. Un toque abre lo suyo
const LU_BADGE = { campeon: '🏆', caza: '🎯', ligahito: '🏟️', tarjeta: '🃏' };
const luTono = (liga, it) => (it.tipo === 'rango' ? liga.colorRg(it.rg) : { campeon: '#FFD024', caza: '#E41373', tarjeta: '#29B298', ligahito: '#7FA8FF' }[it.tipo] || '#FF4F9A');
function irItem(liga, it) {
  const x = liga.itemMuro(it);
  const d = x && x[4];
  if (!d) { if (it.id) location.hash = '#/publicaciones/' + encodeURIComponent(it.id); return; }
  if (d.carta) accion.carta(d.carta, d.cual);
  else if (d.perfil) accion.perfil(d.perfil);
  else if (d.llave) accion.llave(d.llave);
  else if (d.ruta) location.hash = d.ruta;
  else if (d.link) window.open(d.link, '_blank', 'noopener');
}
function FilaLU({ liga, k, f, it, A, P }) {
  const x = liga.itemMuro(it);
  if (!x) return null;
  const hilo = it.id ? delHilo(it, Date.now()) : [];
  const sv = it.sv ? siglaDe(it.sv) : '';
  const sub = it.tipo === 'campeon' ? [sv, it.part ? it.part + ' raperos' : ''].filter(Boolean).join(' · ') : it.tipo === 'caza' ? [it.cat, sv].filter(Boolean).join(' · ') : sv;
  const der = it.tipo === 'rango' ? <span className="lu-r-letra" style={{ background: liga.colorRg(it.rg) }} aria-label={'Rango ' + it.rg}>{it.rg}</span>
    : (it.tipo === 'campeon' || it.tipo === 'ligahito') && it.sv ? <img className="lu-r-sv" alt={siglaDe(it.sv)} src={liga.logo(it.sv)} loading="lazy" />
      : it.tipo === 'caza' && it.pts ? <span className="lu-r-pts">+{num(it.pts)}</span> : null;
  const abre = () => irItem(liga, it);
  const c = liga.cuando(it.t);
  return (
    <li>
      <div className={'nt-f lu-r t-' + it.tipo} style={{ '--lu-c': luTono(liga, it) }} role="link" tabIndex={0} onClick={abre}
        onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abre(); } }}>
        <span className="lu-r-v v-cara"><span className="nt-cara"><Cara liga={liga} k={k} nombre={f.n} cls="nt-c" />{it.tipo !== 'rango' && LU_BADGE[it.tipo] ? <i className="nt-badge">{LU_BADGE[it.tipo]}</i> : null}</span></span>
        <span className="nt-t">
          <span className="lu-cat">{x[0]}</span>
          <b>{x[1]}</b>
          {sub ? <small>{sub}</small> : null}
          <LuSocial liga={liga} it={it} A={A} hilo={hilo} P={P} />
          <LuNube liga={liga} it={it} hilo={hilo} />
        </span>
        <span className="lu-r-der"><span className="nt-hora">{c ? c.charAt(0).toUpperCase() + c.slice(1) : ''}</span>{der}</span>
      </div>
    </li>
  );
}

// 📰 PUBLICACIONES: las fuertes en grande, cada tipo con su forma (Dlx, v7: «es mucha repetición… más variación»), y
// al lado la lista con el dibujo de Publicaciones (`Fila`: felicitar, reaccionar, comentar de verdad)
const FUERTES = ['campeon', 'caza', 'elegido', 'premios', 'mesaward', 'sobrevivio'];
const GRUPOS = [['', 'Todo', null], ['campeones', 'Campeones', ['campeon', 'podio', 'resnoche']], ['mw', 'Most Wanted', ['caza', 'sobrevivio', 'elegido', 'premios']],
  ['rangos', 'Rangos', ['rango']], ['pase', 'Pase', ['pase']], ['mes', 'MES AWARDS', ['mesaward']]];
function Publicaciones({ liga, k, f, p, D, esYo, extra, fil, setFil }) {
  const A = useAplausos();
  useComentarios();
  const P = usePase(typeof window !== 'undefined' && !!window.DC);
  const pub = usePases();
  const xs = useMemo(() => {
    const mu = ((p && p.mu) || []).filter((it) => it.tipo !== 'anuncio');
    const fuera = new Set();
    let previo = null;
    [...mu].reverse().forEach((m) => { if (m.tipo !== 'rango') return; if (previo === m.rg) fuera.add(m.id); previo = m.rg; });
    return mu.filter((m) => !fuera.has(m.id));
  }, [p]);
  if (!xs.length && esYo) {
    return (
      <div className="pv-ej">
        <p><b>Tu muro se llena solo.</b> Todavía no hay nada: esto es lo que va a salir acá.</p>
        {[[SVG.corona, '#E5B800', 'Campeón', 'Ganas una llave', 'sale «Gané…» con las caras de a quién le ganaste'],
          [<b key="r" className="pv-ej-rg">D</b>, '#29B298', 'Rango', 'Subes de letra', 'jugando el Competitivo: la letra nueva, con su color'],
          [SVG.mira, '#E41373', 'Most Wanted', 'Cazas a alguien', 'el cartel de Se busca y lo que cobraste']].map(([ic, c, cat, t, d]) => (
          <div key={cat} className="pv-ej-i" style={{ '--tc': c }}><span className="pv-ej-ic">{ic}</span><span><span className="pv-cat">{cat}</span><b>{t}</b><small>{d}</small></span></div>
        ))}
      </div>
    );
  }
  if (!xs.length) return <p className="pv-nada">Todavía no publicó nada.</p>;
  const fuertes = xs.filter((m) => FUERTES.includes(m.tipo));
  const d1 = fuertes[0] || xs[0];
  const tits = D.enT.filter((x) => x.pu === 'Campeón');
  let nCamp = 0;
  const dest = (m, primera) => {
    const yo = <Cara liga={liga} k={k} nombre={f.n} cls="cara pv-cara pv-yo" />;
    const ll = m.ll || m.n || null;
    const fel = <div className="pv-bts"><Felicitar liga={liga} it={m} A={A} />{ll ? <button type="button" className="btn borde chico" onClick={() => accion.llave(ll)}>Ver la llave</button> : null}</div>;
    const cab = (t) => <><span className="pv-cat">{t}{m.sv ? ' · ' + siglaDe(m.sv) : ''} · {fecha(Date.parse(m.t))}</span></>;
    // la primera, como en Publicaciones: la fila fuerte, con su carta, y felicitar y comentar de verdad
    if (primera || !FUERTES.includes(m.tipo)) return <div key={m.id || 'd1'} className="pv-dest0"><Fila liga={liga} it={m} A={A} P={P} nuevo={false} /></div>;
    if (m.tipo === 'campeon') {
      const z = D.porEv[ll] || { gano: [] };
      if (nCamp++ % 2 === 1) {
        const n = tits.findIndex((x) => x.n === ll) + 1;
        return (
          <article key={m.id} className="pv-dest num">
            <span className="pv-big oro"><span>{n ? <><b>{n}º</b><small>título de {tits.length}</small></> : <>{SVG.corona}<small>campeón</small></>}</span></span>
            <div>{cab('Campeón')}<h4>Gané {limpio(m.ev || '')}</h4>
              {z.gano.length ? <div className="pv-vencio"><span>{z.gano.slice(-5).map((x, i) => <CaraN key={i} liga={liga} n={x} />)}</span><small>le ganó a {z.gano.length}</small></div> : null}{fel}</div>
          </article>
        );
      }
      const es = escenaDe(m.sv);
      return (
        <article key={m.id} className="pv-dest ev" style={{ '--svc': (liga.svs[m.sv] || {}).color || '#2A2A2E' }}>
          <div className={'pv-ev-img' + (es ? ' con-esc' : '')} style={es ? { backgroundImage: 'url("' + es + '")' } : undefined}>
            {es ? null : <img className="pv-ev-lg" alt="" src={liga.logo(m.sv)} />}{yo}{z.gano.slice(-4).map((x, i) => <CaraN key={i} liga={liga} n={x} />)}<span className="pv-copa">{SVG.corona}</span>
          </div>
          <div className="pv-ev-tx">{cab('Campeón')}<h4>Gané {limpio(m.ev || '')}</h4><div className="pv-pills">{m.part ? <span>{m.part} raperos</span> : null}{m.sv ? <span>{siglaDe(m.sv)}</span> : null}</div>{fel}</div>
        </article>
      );
    }
    if (m.tipo === 'caza') {
      return (
        <article key={m.id} className="pv-dest wanted">
          <div className="pv-wp"><small>SE BUSCA</small><CaraN liga={liga} n={m.a} cls="cara pv-wp-c" /><b>+{num(m.pts)}</b><i>{m.cat || ''}</i></div>
          <div>{cab('Most Wanted')}<h4>Cacé a {sinB(m.a)} y cobro {num(m.pts)}</h4><p className="pv-sub">{limpio(m.ev || '')}</p>{fel}</div>
        </article>
      );
    }
    const big = m.tipo === 'elegido' ? <span className="pv-big"><span><b>{m.votos}/{m.de}</b><small>votos</small></span></span>
      : m.tipo === 'premios' ? <span className="pv-big rect"><span><b>{num(Math.round((((m.figura || [])[1]) || 0) / 1000))}K</b><small>puntos</small></span></span>
        : m.tipo === 'sobrevivio' ? <span className="pv-big"><span>{SVG.mira}<small>sobrevivió</small></span></span>
          : <span className="pv-big"><span>{SVG.corona}<small>MES AWARDS</small></span></span>;
    const tt = { elegido: 'Soy El Elegido', premios: 'Soy la figura de la semana', sobrevivio: 'Sobreviví al Most Wanted', mesaward: 'Estoy nominado a los MES AWARDS' }[m.tipo] || '';
    return <article key={m.id} className="pv-dest num">{big}<div>{cab({ elegido: 'El Elegido', premios: 'Premios', sobrevivio: 'Most Wanted', mesaward: 'MES AWARDS' }[m.tipo])}<h4>{tt}</h4>{fel}</div></article>;
  };
  const g = GRUPOS.find((x) => x[0] === fil) || GRUPOS[0];
  const cu = (gg) => (gg[2] ? xs.filter((m) => gg[2].includes(m.tipo)).length : xs.length);
  const fs = GRUPOS.filter((gg) => cu(gg));
  const extraD = fuertes.filter((m) => m !== d1);
  const masD = extraD.slice(0, extra);
  const todos = xs.filter((m) => m !== d1 && !masD.includes(m) && (!g[2] || g[2].includes(m.tipo)));
  const ys = todos.slice(0, 3 + extra * 2);
  return (
    <div className="pv-pubs">
      <div className="pv-pubs-dest">{dest(d1, true)}{masD.map((m) => dest(m, false))}</div>
      <div className="pv-pubs-l">
        {fs.length > 2 ? (
          <div className="pv-chips" role="group" aria-label="Qué publicaciones ver">
            {fs.map((gg) => <button key={gg[0] || 'todo'} type="button" aria-pressed={fil === gg[0]} className={fil === gg[0] ? 'on' : ''} onClick={() => setFil(gg[0])}>{gg[1]} <em>{cu(gg)}</em></button>)}
          </div>
        ) : null}
        <ul className="lu-lista pv-lu">{ys.map((it) => <FilaLU key={it.id || it.t} liga={liga} k={k} f={f} it={it} A={A} P={P} />)}</ul>
        <a className="pv-pie" href="#/publicaciones" data-mas={todos.length > ys.length ? '1' : undefined}><span>Todo lo que publicó, en Publicaciones</span><b>Ver todo</b></a>
      </div>
    </div>
  );
}

// 🎞️ EVENTOS: cada noche un afiche según cómo le fue, con filtros (cómo le fue, el servidor y el mes)
function EventosV({ liga, k, f, p, D, esYo, extra, fr, setFr }) {
  const [fs, setFs] = useState('todos');
  const [fm, setFm] = useState('todos');
  const base = D.enT.slice().reverse();
  const R = [['todas', 'Todas', () => true], ['c', 'Títulos', (x) => NIVEL5(x.pu) === 'c'], ['s', 'Finales', (x) => NIVEL5(x.pu) === 's'], ['t', 'Semis', (x) => NIVEL5(x.pu) === 't'], ['q', 'Cuartos', (x) => NIVEL5(x.pu) === 'q'], ['o', 'Antes', (x) => NIVEL5(x.pu) === 'o']];
  const cuenta = (fn) => base.filter(fn).length;
  const svs = Object.entries(base.reduce((a, x) => { a[x.sv] = (a[x.sv] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]);
  const meses = [...new Set(base.map((x) => Number(diaISO(new Date(x.t)).split('-')[1]) - 1))];
  const fR = (R.find((x) => x[0] === fr) || R[0])[2];
  const xs = base.filter((x) => fR(x) && (fs === 'todos' || x.sv === fs) && (fm === 'todos' || String(Number(diaISO(new Date(x.t)).split('-')[1]) - 1) === fm));
  const mu = (p && p.mu) || [];
  const pub = usePases();
  const cp = (pub && pub.cp && pub.cp[k]) || (f.c || [])[0] || '';
  const ver = xs.slice(0, 10 + extra * 3);
  const af = (x) => {
    const r = pu(x.pu), n5 = NIVEL5(x.pu), z = D.porEv[x.n] || { gano: [], cayo: '' };
    const caza = mu.find((m) => m.tipo === 'caza' && limpio(m.ev || '') === x.nom);
    const tags = [];
    if (x.gente >= 25) tags.push(x.gente + ' raperos');
    if (caza) tags.push('cazó a ' + sinB(caza.a));
    if (z.gano.length >= 3) tags.push(z.gano.length + ' duelos ganados');
    let im;
    if (n5 === 'c' && cp) im = <><span className="pv-np-ic">{SVG.corona}</span><img className="pv-np-card" alt="" src={liga.cartaUrl(k, cp)} loading="lazy" /></>;
    else if (n5 === 's') im = <><span className="pv-np-ic">{SVG.copa('#C9CDD2')}</span><span className="pv-np-vs"><Cara liga={liga} k={k} nombre={f.n} cls="cara pv-cara" /><em>VS</em>{z.cayo ? <CaraN liga={liga} n={z.cayo} /> : null}</span></>;
    else if (n5 === 't') im = <><span className="pv-np-ic">{SVG.copa('#C8702A')}</span><span className="pv-np-pila"><Cara liga={liga} k={k} nombre={f.n} cls="cara pv-cara" />{z.gano.slice(-3).map((n, i) => <CaraN key={i} liga={liga} n={n} />)}</span></>;
    else if (n5 === 'q') im = <span className="pv-np-ronda"><b>{CORTO[x.pu] || 'R32'}</b>{z.cayo ? <span><CaraN liga={liga} n={z.cayo} />cayó con {sinB(z.cayo)}</span> : <span>{x.gente} raperos</span>}</span>;
    else im = <><img className="pv-np-lgc" alt="" src={liga.logo(x.sv)} /><span className="pv-np-chip">{CORTO[x.pu] || 'R32'}{z.cayo ? ' · cayó con ' + sinB(z.cayo) : ''}</span></>;
    const det = z.gano.length ? 'le ganó a ' + z.gano.slice(-2).map(sinB).join(', ') + (z.gano.length > 2 ? ' y ' + (z.gano.length - 2) + ' más' : '') : z.cayo ? 'cayó con ' + sinB(z.cayo) : (x.gente || 0) + ' raperos';
    const es = n5 === 'c' ? escenaDe(x.sv) : '';
    return (
      <button key={x.n} type="button" className={'pv-np ' + r[1] + (n5 === 'c' && cp ? ' c2' : '')} style={{ '--svc': (liga.svs[x.sv] || {}).color || '#2A2A2E' }} onClick={() => accion.llave(x.n)}>
        <span className={'pv-np-img' + (es ? ' con-esc' : '')} style={es ? { backgroundImage: 'url("' + es + '")' } : undefined}><span className="pv-np-sv"><img alt="" src={liga.logo(x.sv)} />{siglaDe(x.sv)}</span>{im}</span>
        <span className="pv-np-tx">
          <span className="pv-np-f1"><span className={'pv-res ' + r[1]}>{r[0]}</span><span>{fecha(x.t)}</span></span>
          <b className="pv-np-h">{nomEv(x)}</b>
          {tags.length ? <span className="pv-np-tags">{tags.map((t) => <span key={t}>{t}</span>)}</span> : null}
          <span className="pv-np-f2"><span>{det}</span><b>+{num(x.pts)}</b></span>
        </span>
      </button>
    );
  };
  return (
    <>
      {base.length > 1 ? (
        <div className="pv-filas-f">
          <div className="pv-chips" role="group" aria-label="Cómo le fue">{R.filter((x) => x[0] === 'todas' || cuenta(x[2])).map((x) => <button key={x[0]} type="button" className={fr === x[0] ? 'on' : ''} aria-pressed={fr === x[0]} onClick={() => setFr(x[0])}>{x[1]} <em>{cuenta(x[2])}</em></button>)}</div>
          {svs.length > 1 ? <div className="pv-chips" role="group" aria-label="El servidor">{[['todos', 'Todos los servidores']].concat(svs.slice(0, 6).map(([s, n]) => [s, siglaDe(s) + ' · ' + n])).map(([v, t]) => <button key={v} type="button" className={fs === v ? 'on' : ''} aria-pressed={fs === v} onClick={() => setFs(v)}>{v !== 'todos' ? <img alt="" src={liga.logo(v)} /> : null}{t}</button>)}</div> : null}
          {meses.length > 1 ? <div className="pv-chips" role="group" aria-label="El mes">{[['todos', 'Toda la temporada']].concat(meses.map((mm) => [String(mm), MES_L[mm]])).map(([v, t]) => <button key={v} type="button" className={fm === v ? 'on' : ''} aria-pressed={fm === v} onClick={() => setFm(v)}>{t}</button>)}</div> : null}
        </div>
      ) : null}
      <div className={'pv-np-g' + (fr === 'c' ? ' solo-c' : '')}>
        {ver.map(af)}
        {base.length < 3 ? <div className="pv-np vac">{esYo ? 'Tu próxima noche' : 'Su próxima noche'} va a quedar acá</div> : null}
      </div>
      {!xs.length ? <p className="pv-nada">Ninguna noche con esos filtros.</p> : null}
      {xs.length > ver.length ? <a className="pv-pie" href={'#/r/' + encodeURIComponent(k) + '/eventos'} data-mas="1"><span>{xs.length} noches</span><b>Ver todas</b></a> : null}
    </>
  );
}

function Tabs({ liga, k, f, p, D, esYo, extra, tab, setTab, filPub, setFilPub, fr, setFr, videos, logros }) {
  const nPub = ((p && p.mu) || []).filter((m) => m.tipo !== 'anuncio').length;
  const nVid = ((p && p.vid) || []).length + ((p && p.vp) || []).length;
  const T = [['pubs', 'Publicaciones', nPub], ['noches', 'Eventos', D.enT.length], ['videos', 'Videos', nVid], ['logros', 'Logros', ((p && p.ins) || []).length]];
  const t = T.some((x) => x[0] === tab) ? tab : 'pubs';
  return (
    <>
      <div className="pv-tabs" role="tablist" aria-label={esYo ? 'Lo tuyo' : 'Lo suyo'}>
        {T.map(([id, n, c]) => (
          <button key={id} type="button" role="tab" aria-selected={t === id} className={t === id ? 'on' : ''} onClick={() => setTab(id)}>{ICO[id]}<span className="pv-tab-t">{n}</span>{c ? <small>{c}</small> : null}</button>
        ))}
      </div>
      <div id={t === 'pubs' ? 'pf-publicaciones' : t === 'noches' ? 'pf-eventos' : t === 'videos' ? 'pf-videos' : 'pf-insignias'}>
        {t === 'pubs' ? <Publicaciones liga={liga} k={k} f={f} p={p} D={D} esYo={esYo} extra={extra} fil={filPub} setFil={setFilPub} />
          : t === 'noches' ? <EventosV liga={liga} k={k} f={f} p={p} D={D} esYo={esYo} extra={extra} fr={fr} setFr={setFr} />
            : t === 'videos' ? (videos || <p className="pv-nada">{esYo ? 'Todavía no hay videos de tus batallas.' : 'Todavía no hay videos de sus batallas.'}</p>)
              : logros}
      </div>
    </>
  );
}

// ════════ EL COSTADO ════════
// 🪪 SOBRE ÉL, como el «About» de Roblox: qué días y a qué hora juega, dónde, desde cuándo
function SobreEl({ liga, k, f, p, D, esYo }) {
  const ev = D.enT;
  const xs = [];
  const c = [0, 0, 0, 0, 0, 0, 0];
  ev.forEach((x) => { c[enET(x.t)[0]] += 1; });
  const mx = Math.max(1, ...c);
  let sem = null;
  if (ev.length >= 3) {
    const dias = c.map((v, i) => [v, i]).filter(([v]) => v >= Math.max(2, mx * 0.8)).sort((a, b) => b[0] - a[0]).slice(0, 2);
    const fr = {};
    ev.forEach((x) => { const h = enET(x.t)[1]; const kk = h < 6 ? 'de madrugada' : h < 12 ? 'a la mañana' : h < 19 ? 'a la tarde' : 'a la noche'; fr[kk] = (fr[kk] || 0) + 1; });
    const [fra, nf] = Object.entries(fr).sort((a, b) => b[1] - a[1])[0];
    const orden = [1, 2, 3, 4, 5, 6, 0];
    sem = (
      <>
        <div className="pv-sem7" role="img" aria-label={(esYo ? 'Tus' : 'Sus') + ' eventos por día de la semana'}>
          {orden.map((i) => <i key={i} className={dias.some((d) => d[1] === i) ? 'on' : ''} style={{ height: Math.round((100 * c[i]) / mx) + '%' }} title={c[i] + ' los ' + DIAS_N[i]} />)}
        </div>
        <div className="pv-sem7l">{orden.map((i) => <span key={i}>{DIA_C[i]}</span>)}</div>
      </>
    );
    if (dias.length) xs.push(['Suele jugar', 'los ' + dias.map((d) => DIAS_N[d[1]]).join(' y los ') + (nf * 2 > ev.length ? ', ' + fra : ''), dias.map((d) => d[0] + ' un ' + DIA1[d[1]]).join(' · ') + ' · hora del este']);
  }
  if (ev.length >= 2) {
    const sv = {};
    ev.forEach((x) => { sv[x.sv] = (sv[x.sv] || 0) + 1; });
    const [s, n] = Object.entries(sv).sort((a, b) => b[1] - a[1])[0];
    xs.push(['Juega más en', <a key="s" href={'#/sv/' + siglaDe(s)}><img alt="" src={liga.logo(s)} />{(liga.svs[s] || {}).nombre || siglaDe(s)}</a>, n + ' de ' + ev.length + ' noches' + (Object.keys(sv).length > 1 ? ' · en ' + Object.keys(sv).length + ' servidores' : '')]);
  }
  if (ev[0]) xs.push(['Debutó', fecha(ev[0].t), sinTit(ev[0]) ? siglaDe(ev[0].sv) : ev[0].nom]);
  if (ev.length > 1) { const u = ev[ev.length - 1]; const d = Math.round((Date.now() - u.t) / 864e5); xs.push([esYo ? 'Tu último evento' : 'Su último evento', d <= 0 ? 'hoy' : d === 1 ? 'ayer' : 'hace ' + d + ' días', sinTit(u) ? siglaDe(u.sv) : u.nom]); }
  if (f.cc) xs.push(['País', <a key="cc" href={'#/pais/' + f.cc}><Bandera cc={f.cc} cls="pv-flag" />{String(f.cc).toUpperCase()}</a>, '']);
  if (!xs.length && !sem) return null;
  return (
    <section className="pv-cajal">
      <h3>Sobre {esYo ? 'ti' : 'él'}</h3>
      {sem}
      <ul className="pv-sob">{xs.map(([a, b, cc]) => <li key={a}><span>{a}</span><span><b>{b}</b>{cc ? <small>{cc}</small> : null}</span></li>)}</ul>
    </section>
  );
}

// 👕 LO QUE LLEVA PUESTO, como el «Currently Wearing» de Roblox: su fondo, su carta principal y lo que se puso
function LoQueLleva({ liga, k, f, esYo }) {
  const fo = (useFondos() || {})[k];
  const fondo = fo && urlFondo(fo[0]) ? fo[0] : '';
  const pub = usePases();
  const pa = usePaseDe(k);
  const cp = (pub && pub.cp && pub.cp[k]) || (f.c || [])[0] || '';
  if (!fondo && !cp) return null;
  const chips = [];
  if (pa && pa.premium) chips.push(['#E5B800', 'Pase premium']);
  if (pa && pa.marco) chips.push(['#C9CDD2', 'Marco ' + pa.marco]);
  if (pa && pa.nivel) chips.push(['#29B298', 'Pase ' + pa.nivel]);
  return (
    <section className="pv-cajal" id="pf-puesto">
      <h3>{esYo ? 'Lo que llevas puesto' : 'Lo que lleva puesto'}<a href={esYo ? '#/inventario' : '#/r/' + encodeURIComponent(k)} onClick={esYo ? undefined : (ev) => { ev.preventDefault(); accion.carta(k); }}>{esYo ? 'Abrir mi inventario' : 'Ver sus cartas'}</a></h3>
      <div className="pv-puesto">{fondo ? <img className="f" alt="" src={fondo} loading="lazy" /> : null}{cp ? <span className="ca"><img alt="" src={liga.cartaUrl(k, cp)} loading="lazy" /></span> : null}</div>
      {chips.length ? <div className="pv-tags">{chips.map(([c, t]) => <span key={t}><i style={{ '--tc': c }} />{t}</span>)}</div> : null}
    </section>
  );
}

// 🤝 CARA A CARA, como los amigos de Roblox: sus rivales con el marcador
function CaraACara({ liga, p, D, esYo }) {
  if (!D.rivs.length) return null;
  const eq = p && p.eq;
  return (
    <section className="pv-cajal">
      <h3>Cara a cara<a href={'#'} onClick={(ev) => { ev.preventDefault(); const el = document.querySelector('#inicio-nuevo') && document.querySelector('#inicio-nuevo').shadowRoot.querySelector('.pv-rivs'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>{D.rivs.length} rivales</a></h3>
      <div className="pv-amig">{D.rivs.slice(0, 6).map((r) => (
        <a key={r.id} href={r.k ? '#/r/' + encodeURIComponent(r.k) : undefined}><CaraN liga={liga} n={r.n} cls="cara pv-amig-c" /><b>{sinB(r.n)}</b><small>{r.g}<span>–{r.p}</span></small></a>
      ))}</div>
      {eq ? <ul className="pv-extra"><li><CaraN liga={liga} n={eq[1]} /><span><b>{esYo ? 'Tu mejor equipo' : 'Mejor equipo'} con {sinB(eq[1])}</b><small>ganaron {eq[2]} de {eq[3]} juntos</small></span></li></ul> : null}
    </section>
  );
}

function DondeEsta({ liga, k, f, p }) {
  const rk = (p && p.rk) || {};
  const e = eloDe(liga, k);
  const filas = [['Temporada', f.pos ? '#' + f.pos : '—']];
  if (rk.du) filas.push(['Duelos', '#' + rk.du[0] + ' de ' + rk.du[1]]);
  if (e) filas.push(['División', e.piedra + ' ' + e.sub + ' · ' + e.pos + 'º de ' + e.tot, e.c]);
  if (rk.pod) filas.push(['Podios', '#' + rk.pod[0] + ' de ' + rk.pod[1]]);
  if (rk.pa) filas.push(['Su país', '#' + rk.pa[0] + ' de ' + rk.pa[1]]);
  if (rk.cr) filas.push([rk.cr[0], '#' + rk.cr[1] + ' de ' + rk.cr[2]]);
  filas.push(['Cazó · lo cazaron', (f.caz || 0) + ' · ' + (f.czd || 0)]);
  if (f.mis) filas.push(['Misiones', '+' + num(f.mis)]);
  return (
    <section className="pv-cajal">
      <h3>Dónde está<a href="#/ranking">Ranking</a></h3>
      <ul className="pv-dl">{filas.map(([a, b, c]) => <li key={a} className={c ? 'dv' : undefined} style={c ? { '--pc': c } : undefined}><span>{a}</span><b>{c ? <i className="pv-gema" aria-hidden="true" /> : null}{b}</b></li>)}</ul>
    </section>
  );
}

// ════════ EL CUERPO ENTERO ════════
// `piezas`: las del costado que ya existían (su camino, lo que le falta, su ficha de jurado, sus récords, el precio), y
// `videos` / `logros`, las dos pestañas que se reusan tal cual
// los links de antes (`#/r/x/eventos`, `#/r/x/insignias`) abren su pestaña
const TAB0 = { publicaciones: 'pubs', eventos: 'noches', insignias: 'logros', videos: 'videos' };
export function PerfilV10({ liga, k, f, p, P, esYo, piezas, videos, logros, tab0 }) {
  const D = useV10(liga, k, f, p, P && P.e);
  const L = useSusLigas(liga, k, p);
  const [tab, setTab] = useState(TAB0[tab0] || 'pubs');
  const [filPub, setFilPub] = useState('');
  const [fr, setFr] = useState('todas');
  const [extra, setExtra] = useState(0);
  const [abajo, setAbajo] = useState(0);
  const raiz = useRef(null);
  const ir = (t, filtro) => {
    setTab(t);
    if (t === 'noches' && filtro) setFr(filtro);
    const el = raiz.current && raiz.current.querySelector('.pv-tabs');
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  };
  useEffect(() => { setTab(TAB0[tab0] || 'pubs'); setFilPub(''); setFr('todas'); setExtra(0); setAbajo(0); }, [k, tab0]);
  // ⚖️ LAS DOS COLUMNAS TERMINAN JUNTAS (Dlx, v6: «el lado derecho es largo… ¿cómo planeas que todo esté parejo?»). Una vuelta
  // más de la pestaña (más publicaciones o más noches) sólo si deja las columnas MÁS parejas; si todavía sobra costado,
  // sus últimas piezas bajan debajo de la pestaña. En la compu; en el celular, una columna
  const [medida, setMedida] = useState(0);
  useEffect(() => {
    const el = raiz.current;
    if (!el || typeof ResizeObserver !== 'function') return undefined;
    const ro = new ResizeObserver(() => setMedida((x) => x + 1));
    el.querySelectorAll('.pv-izq, .pv-lado').forEach((x) => ro.observe(x));
    return () => ro.disconnect();
  }, [k, tab]);
  // 🔁 cada vuelta hace UNA cosa y se mide: si no dejó las columnas más parejas, se deshace y para. Se vuelve a armar al
  // cambiar de perfil, de pestaña o de filtro, y una vez más cuando terminaron de bajar las cartas y los afiches
  const bal = useRef({ n: 0, ult: null, listo: false, no: [] });
  useEffect(() => { bal.current = { n: 0, ult: null, listo: false, no: [] }; }, [k, tab, filPub, fr]);
  useEffect(() => {
    const t = setTimeout(() => { bal.current = { n: 0, ult: null, listo: false, no: [] }; setMedida((x) => x + 1); }, 2500);
    return () => clearTimeout(t);
  }, [k, tab]);
  // ⏳ se decide cuando la página se quedó quieta (350 ms sin cambios): mientras bajan las cartas y los afiches, la
  // diferencia cambia sola y una acción buena parecía no servir
  const est = useRef({ extra: 0, abajo: 0 });
  est.current = { extra, abajo };
  useEffect(() => {
    const tm = setTimeout(() => {
      const { extra: ex, abajo: ab } = est.current;
      const el = raiz.current;
      const B = bal.current;
      if (!el || B.listo || B.n > 14 || !window.matchMedia || !window.matchMedia('(min-width: 900px)').matches) return;
      const izq = el.querySelector('.pv-izq'), ld = el.querySelector('.pv-lado');
      if (!izq || !ld) return;
      const dif = ld.getBoundingClientRect().bottom - izq.getBoundingClientRect().bottom;
      // lo que no mejoró se deshace y queda gastado: la próxima vuelta prueba otra cosa (crecer la pestaña y después bajar piezas)
      if (B.ult && Math.abs(dif) > Math.abs(B.ult.dif) - 30) {
        const a = B.ult.a;
        B.no.push(a);
        B.ult = null;
        if (a === 'e+') setExtra((x) => x - 1); else if (a === 'e-') setExtra((x) => x + 1);
        else if (a === 'b+') setAbajo((x) => x - 1); else if (a === 'b-') setAbajo((x) => x + 1);
        return;
      }
      const hay = !!el.querySelector('[data-mas="1"]');
      const puede = (x) => !B.no.includes(x);
      let a = null;
      if (dif > 140 && hay && puede('e+')) a = 'e+';
      else if (dif > 180 && ld.children.length > 3 && ab < 5 && puede('b+')) a = 'b+';
      else if (dif < -180 && ab > 0 && puede('b-')) a = 'b-';
      else if (dif < -180 && ex > 0 && puede('e-')) a = 'e-';
      if (!a) { B.listo = true; return; }
      B.n += 1;
      B.ult = { dif, a };
      if (a === 'e+') setExtra((x) => x + 1); else if (a === 'e-') setExtra((x) => x - 1);
      else if (a === 'b+') setAbajo((x) => x + 1); else setAbajo((x) => x - 1);
    }, 350);
    return () => clearTimeout(tm);
  }, [medida, extra, abajo, k, tab]); // eslint-disable-line react-hooks/exhaustive-deps
  const lado = [
    <SobreEl key="sobre" liga={liga} k={k} f={f} p={p} D={D} esYo={esYo} />,
    piezas.camino,
    piezas.falta,
    <LoQueLleva key="lleva" liga={liga} k={k} f={f} esYo={esYo} />,
    <CaraACara key="cxc" liga={liga} p={p} D={D} esYo={esYo} />,
    piezas.jurado,
    piezas.records,
    piezas.precio,
    <DondeEsta key="donde" liga={liga} k={k} f={f} p={p} />,
  ].filter(Boolean);
  const corte = Math.max(3, lado.length - abajo);
  return (
    <div className="pv" ref={raiz}>
      <section className="pv-esc" aria-label={esYo ? 'Tu récord' : 'Su récord'}>
        <Momentos liga={liga} k={k} f={f} p={p} D={D} esYo={esYo} ligas={L.xs} ir={ir} />
        <div className="pv-ag">
          <Record f={f} p={p} D={D} esYo={esYo} />
          <MejorNoche liga={liga} D={D} esYo={esYo} />
          <div className="pv-pila"><ContraLiga f={f} p={p} dmp={P && P.dmp} esYo={esYo} /></div>
        </div>
        <Rivales4 liga={liga} f={f} D={D} esYo={esYo} />
      </section>
      <section className="pv-papel">
        <div className="pv-g">
          <div className="pv-izq">
            <Proximo liga={liga} k={k} esYo={esYo} />
            <SusLigasV liga={liga} L={L} esYo={esYo} />
            <Tabs liga={liga} k={k} f={f} p={p} D={D} esYo={esYo} extra={extra} tab={tab} setTab={setTab} filPub={filPub} setFilPub={setFilPub} fr={fr} setFr={setFr} videos={videos} logros={logros} />
            {abajo ? <div className="pv-mas-g">{lado.slice(corte)}</div> : null}
          </div>
          <aside className="pv-lado">{lado.slice(0, corte)}</aside>
        </div>
      </section>
    </div>
  );
}
