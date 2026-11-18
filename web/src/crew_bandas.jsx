// 🛡️ LA PÁGINA DE LA CREW EN BANDAS (17/11/2026). Dlx, después del perfil del rapero y el del servidor: «ahora haz lo
// mismo con el perfil de las crews». Las mismas bandas negras y blancas (`Banda`) y los mismos paneles (`pf9-`, de
// css/perfil.css); las piezas de la crew de antes (la pirámide, su gente, la semana, por día, las estrellas, los
// representantes y lo que pasó) siguen en crew2.jsx y entran a las bandas tal cual. Acá, lo nuevo: sus historias, de un
// vistazo, sus noches (los títulos y las finales de su gente), su muro y sus récords.
// ⚠️ NO CALCULA NADA EN EL SERVIDOR: sale de lo que la página ya baja —`/api/perfiles` (`e`: los eventos de la temporada;
// `p[k].ev`: el puesto de cada uno), el payload de los tiers (`crews_tiers`) y el muro—. Sin dato no hay pieza.
import { useEffect, useMemo, useState } from 'react';
import { diaISO, ksDe, limpio, num, siglaDe } from './liga.js';
import { Cara, accion } from './piezas.jsx';
import { historiasDeGente } from './arriba.jsx';
import { useAplausos } from './aplausos.js';
import { useComentarios } from './comentarios.jsx';
import { usePase } from './pase.js';
import { Fila } from './publicaciones2.jsx';
import { Banda } from './perfil_bandas.jsx';
import CSS_PERFIL from './css/perfil.css?inline';
import { usarCss } from './css.js';

// los paneles y las bandas son los del perfil (`pf9-`); lo propio de la crew está en css/crew2.css (`k2-`)
usarCss('perfil', CSS_PERFIL);

export { Banda };

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
const fecha = (iso) => { const d = new Date(iso); if (isNaN(d)) return ''; const [, m, dd] = diaISO(d).split('-'); return Number(dd) + ' ' + MES[Number(m) - 1]; };
const coma = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
const cuenta = (xs) => { const m = new Map(); xs.forEach((x) => m.set(x, (m.get(x) || 0) + 1)); return m; };
const masComun = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]);
const SEMIS = ['Tercero', 'Cuarto', 'Semifinal'];
const plural = (n, s) => n + ' ' + s + (n === 1 ? '' : 's');

// ── los datos de una vez: cada evento de la temporada que jugó alguien de la crew, con su puesto ──
export function useCrewDatos(liga, ks, P) {
  const clave = ks.join('|');
  return useMemo(() => {
    if (!P || !P.e || !P.p || !ks.length) return null;
    const fila = (k) => liga.T[k] || (P.p[k] && P.p[k].f) || null;
    const nombre = (k) => { const f = fila(k); return limpio((f && f.n) || k); };
    const xs = [];
    ks.forEach((k) => ((P.p[k] || {}).ev || []).forEach(([n, pu, pts]) => {
      const e = P.e[n] || P.e[String(n)];
      if (!e || !e[2]) return;
      xs.push({ k, n, pu, pts: pts || 0, nom: limpio(e[0] || 'Evento ' + n), sv: e[1] || '', iso: e[2], gente: e[3] || 0 });
    }));
    if (!xs.length) return null;
    xs.sort((a, b) => b.iso.localeCompare(a.iso));
    const titulos = xs.filter((x) => x.pu === 'Campeón');
    const finales = xs.filter((x) => x.pu === 'Subcampeón');
    const semis = xs.filter((x) => SEMIS.includes(x.pu));
    const porK = cuenta(xs.map((x) => x.k));
    const titK = cuenta(titulos.map((x) => x.k));
    const porN = cuenta(xs.map((x) => x.n));
    const svs = cuenta(xs.map((x) => x.sv).filter(Boolean));
    return { xs, titulos, finales, semis, porK, titK, porN, svs, fila, nombre };
  }, [liga, P, clave]); // eslint-disable-line react-hooks/exhaustive-deps
}

const Av = ({ liga, D, k, cls = '' }) => <Cara liga={liga} k={k} nombre={D ? D.nombre(k) : k} cls={'cara pf9-av ' + cls} lazy />;

// ── ⚖️ LAS COLUMNAS DE CADA BANDA TERMINAN JUNTAS (como el servidor): en «Su gente» la tabla muestra más o menos filas
// (el resto, detrás de «Ver los N»), en «Su temporada» el muro muestra más o menos publicaciones y «Sus noches» más o
// menos renglones. Sólo en la compu, una fila por vuelta y con tope de vueltas, para que nada salte ──
export function useBalanceCrew(raiz, id, listo) {
  const ini = { id, ge: 12, mu: 4, no: 6, v: 0 };
  const [L, setL] = useState(ini);
  const [medida, setMedida] = useState(0);
  const B = L.id === id ? L : ini;
  useEffect(() => {
    const el = raiz.current;
    if (!el || !listo || typeof ResizeObserver !== 'function') return undefined;
    const ro = new ResizeObserver(() => setMedida((x) => x + 1));
    el.querySelectorAll('.pf9-g > .pf9-pila').forEach((x) => ro.observe(x));
    return () => ro.disconnect();
  }, [raiz, id, listo]);
  useEffect(() => {
    const el = raiz.current;
    if (!el || !listo || B.v > 24 || !window.matchMedia || !window.matchMedia('(min-width: 900px)').matches) return;
    // lo que la columna de la derecha tiene de más (positivo) o de menos, para la banda `c`
    // se mide dónde termina lo escrito del último panel de cada columna, no la columna: en «Su gente» los paneles se
    // estiran hasta terminar juntos, y medir la caja daría siempre cero
    const fin = (pila) => { const vis = (y) => y.getBoundingClientRect().height > 0; const us = [...pila.children].filter(vis); const u = us[us.length - 1]; if (!u) return 0;
      const hs = [...u.children].filter(vis); return (hs[hs.length - 1] || u).getBoundingClientRect().bottom; };
    const dif = (c) => { const [a, b] = el.querySelectorAll('.' + c + ' > .pf9-pila'); return a && b && a.offsetHeight && b.offsetHeight ? fin(b) - fin(a) : 0; };
    const alto = (sel) => { const x = el.querySelector(sel); return x ? x.getBoundingClientRect().height + 8 : 60; };
    const n = Object.assign({}, B);
    // su gente: la tabla está a la izquierda
    const d2 = dif('k2-b2'), h2 = alto('.k2-b2 .ent-gente > li');
    if (d2 > h2 && el.querySelector('.k2-gente > .pf9-btn[aria-expanded="false"]')) n.ge += 1; else if (d2 < -h2 && n.ge > 4) n.ge -= 1;
    // su temporada: el muro a la izquierda y las noches a la derecha (con un muro corto, las noches abajo del muro). Primero se suma
    // lo que falta del lado corto; sólo si ya no hay qué sumar, se saca del lado largo
    const d3 = dif('k2-b3'), hm = alto('.k2-b3 .pf9-filas > *'), hn = alto('.k2-noches li');
    const masMuro = !!el.querySelector('.k2-b3 .pf9-muro > .pf9-btn[aria-expanded="false"]');
    const masNoches = !!el.querySelector('.k2-noches > .pf9-btn[aria-expanded="false"]');
    const nochesIzq = !!el.querySelector('.k2-b3 > .pf9-t-main .k2-noches');
    // lo que crece si se suma una noche: la derecha (o la izquierda, sin muro)
    const dn = nochesIzq ? -d3 : d3;
    if (!nochesIzq && d3 > hm * 0.5 && masMuro) n.mu += 1;
    else if (dn < -hn && masNoches) n.no += 1;
    else if (dn > hn * 0.6 && n.no > 2) n.no -= 1;
    else if (!nochesIzq && d3 < -hm * 1.2 && n.mu > 2) n.mu -= 1;
    if (n.ge !== B.ge || n.mu !== B.mu || n.no !== B.no) setL(Object.assign(n, { id, v: B.v + 1 }));
  }, [medida, id, listo, B.ge, B.mu, B.no]); // eslint-disable-line react-hooks/exhaustive-deps
  return B;
}

// ── 📸 sus historias: las de su gente (campeón, caza, carta nueva, rango), un toque abre el visor del Inicio ──
export function CrewHistorias({ liga, ks, id, nombre, crew }) {
  const g = useMemo(() => { try { return historiasDeGente(liga, ks, liga.muroLimpio(), id, nombre, crew); } catch (e) { return null; } }, [liga, ks.join('|'), id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!g || !g.slides.length) return null;
  let v = {};
  try { v = JSON.parse(localStorage.getItem('lg:historias2')) || {}; } catch (e) { v = {}; }
  const xs = [...g.slides].reverse();
  return (
    <section className="pf9-hist" aria-label="Sus historias">
      <h3 className="pf9-hist-t">Sus historias<small>{xs.length}</small></h3>
      <ul>
        {xs.map((s) => (
          <li key={s.id}>
            <button type="button" className={'pf9-hist-b' + (v[s.id] ? ' vista' : '')} onClick={() => window.lgVerHistorias && window.lgVerHistorias(g, s.id)}>
              <span className="pf9-hist-c" style={s.esc ? { backgroundImage: 'url(' + liga.logo(s.esc) + ')' } : undefined}><i>▶</i></span>
              <b>{limpio(String(s.tag || '').split('·')[0]).toLowerCase()}</b>
              <small>{s.t ? fecha(s.t) : ''}</small>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── 👀 de un vistazo: los números de la crew que existen ──
export function CrewVistazo({ D, c, pos, N, T, fila, cid }) {
  const tier = T ? fila[0] : null;
  const subidas = T ? (T.hist || []).filter((h) => h[1] === cid && h[3] > h[2]).length : 0;
  const top = D ? masComun(D.titK)[0] : null;
  const xs = [
    ['Puntos', num(c.pts || 0), pos ? '#' + pos + ' de las crews' : 'sin puesto: hacen falta tres'],
    N ? ['Por rapero', num(Math.round((c.pts || 0) / N)), N + ' en la crew'] : null,
    T ? ['Tier', T.nombres[tier], subidas ? 'subió ' + subidas + (subidas === 1 ? ' vez' : ' veces') + ' en la temporada' : 'cambia cada lunes'] : null,
    T && N ? ['Esta semana', fila[2] + '/' + N, (fila[2] === 1 ? 'jugó' : 'jugaron') + (fila[1] ? ' · ' + num(fila[1]) + ' pts' : '')] : null,
    D ? ['Títulos', String(D.titulos.length), top ? top[1] + ' de ' + D.nombre(top[0]) : D.finales.length ? D.finales.length + (D.finales.length === 1 ? ' final' : ' finales') : 'todavía ninguno'] : null,
    D ? ['Eventos', num(D.xs.length), D.porN.size + (D.porN.size === 1 ? ' noche distinta' : ' noches distintas') + ' · ' + D.svs.size + (D.svs.size === 1 ? ' servidor' : ' servidores')] : null,
  ].filter(Boolean);
  if (!xs.length) return null;
  return (
    <section className="pf9-pz pf9-kpis tinte-g">
      <header className="pf9-h"><h3>De un vistazo</h3><span>la crew en la temporada</span></header>
      <dl>{xs.map((x) => <div key={x[0]}><dt>{x[0]}</dt><dd>{x[1]}</dd><small>{x[2]}</small></div>)}</dl>
    </section>
  );
}

// ── 🌙 sus noches: los títulos y las finales de su gente en la temporada, de la más nueva a la más vieja ──
const MED = { Campeón: ['1º', '#E7B622'], Subcampeón: ['2º', '#C9CDD4'] };
export function CrewNoches({ liga, D, n = 6 }) {
  const [todas, setTodas] = useState(false);
  if (!D) return null;
  const xs = D.xs.filter((x) => MED[x.pu]);
  if (!xs.length) return null;
  const ver = todas ? xs : xs.slice(0, n);
  return (
    <section className="pf9-pz k2-noches tinte-o">
      <header className="pf9-h"><h3>Sus noches</h3><span>{D.titulos.length} {D.titulos.length === 1 ? 'título' : 'títulos'} · {D.finales.length} {D.finales.length === 1 ? 'final' : 'finales'}</span></header>
      <ul>
        {ver.map((x) => (
          <li key={x.n + x.k}>
            <button type="button" onClick={() => accion.llave(String(x.n))}>
              <span className="k2-med" style={{ background: MED[x.pu][1] }}>{MED[x.pu][0]}</span>
              <Av liga={liga} D={D} k={x.k} />
              <span className="k2-nt"><b>{x.nom}</b><small>{D.nombre(x.k)} · {fecha(x.iso)}{x.sv ? ' · ' + siglaDe(x.sv) : ''}{x.gente ? ' · ' + x.gente + ' raperos' : ''}</small></span>
            </button>
          </li>
        ))}
      </ul>
      {xs.length > n ? <button type="button" className="pf9-btn" aria-expanded={todas} onClick={() => setTodas(!todas)}>{todas ? 'Ver menos' : 'Ver las ' + xs.length}</button> : null}
      {D.semis.length ? <p className="pf9-pie">y <b>{D.semis.length} {D.semis.length === 1 ? 'semifinal' : 'semifinales'}</b> · un toque abre la llave</p> : <p className="pf9-pie">un toque abre la llave</p>}
    </section>
  );
}

// ── 📰 su muro: lo de la crew (sus tiers, su unión) y lo de su gente, con el dibujo de Publicaciones ──
const esDeCrew = (it, id, nombre) => /^crew/.test(it.tipo) && (it.crew === id || limpio(it.crew || it.nombre || '').toLowerCase() === limpio(nombre).toLowerCase());
export function useMuroCrew(liga, ks, id, nombre) {
  return useMemo(() => {
    const S = new Set(ks);
    return liga.muroLimpio().filter((it) => it.tipo !== 'anuncio' && (esDeCrew(it, id, nombre) || ksDe(it).some((k) => S.has(k))));
  }, [liga, ks.join('|'), id, nombre]); // eslint-disable-line react-hooks/exhaustive-deps
}
export function CrewMuro({ liga, xs, id, nombre, n = 4 }) {
  const A = useAplausos();
  useComentarios();
  const P = usePase(typeof window !== 'undefined' && !!window.DC);
  const [fil, setFil] = useState('');
  const [todas, setTodas] = useState(false);
  if (!xs.length) return null;
  const del = (it) => esDeCrew(it, id, nombre);
  const nc = xs.filter(del).length;
  const lista = fil === 'crew' ? xs.filter(del) : fil === 'gente' ? xs.filter((it) => !del(it)) : xs;
  const ver = todas ? lista : lista.slice(0, n);
  const ch = (k, t, m) => <button type="button" className={fil === k ? 'on' : ''} aria-pressed={fil === k} onClick={() => { setFil(k); setTodas(false); }}>{t} <em>{m}</em></button>;
  return (
    <section className="pf9-pz pf9-muro pw" id="crew-muro">
      <header className="pf9-h"><h3>Su muro</h3><span>lo de la crew y lo de su gente</span></header>
      {nc && nc < xs.length ? <div className="pw-chips pf9-chips" role="group" aria-label="Qué publicaciones ver">{ch('', 'Todo', xs.length)}{ch('crew', 'De la crew', nc)}{ch('gente', 'De su gente', xs.length - nc)}</div> : null}
      <div className="pf9-filas">{ver.map((it) => <Fila key={it.id || it.t} liga={liga} it={it} A={A} P={P} nuevo={false} />)}</div>
      {lista.length > n ? <button type="button" className="pf9-btn" aria-expanded={todas} onClick={() => setTodas(!todas)}>{todas ? 'Ver menos' : 'Ver las ' + lista.length + ' publicaciones'}</button> : null}
    </section>
  );
}

// ── 🏅 sus récords: sólo los renglones que tienen con qué ──
const DIAS_N = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
export function CrewRecords({ D, T, cid }) {
  const xs = [];
  if (D) {
    const tt = masComun(D.titK)[0];
    if (tt) xs.push(['El que más ganó', tt[1] + (tt[1] === 1 ? ' título' : ' títulos'), D.nombre(tt[0]) + ' · ' + coma((100 * tt[1]) / D.titulos.length) + ' % de los de la crew']);
    const ac = masComun(D.porK)[0];
    if (ac && ac[1] > 1) xs.push(['El más activo', ac[1] + ' eventos', D.nombre(ac[0]) + ' jugó más que nadie de la crew']);
    const juntos = masComun(D.porN)[0];
    if (juntos && juntos[1] > 1) { const e = D.xs.find((x) => x.n === juntos[0]); xs.push(['Su noche con más gente', juntos[1] + ' de la crew', e.nom + ' · ' + fecha(e.iso)]); }
    const mx = D.xs.reduce((a, b) => (b.pts > a.pts ? b : a), D.xs[0]);
    if (mx.pts > 0) xs.push(['Más puntos en una noche', '+' + num(mx.pts), D.nombre(mx.k) + ' en ' + mx.nom]);
    const sv = masComun(D.svs)[0];
    if (sv && D.svs.size > 1) xs.push(['Donde más juega', siglaDe(sv[0]), sv[1] + ' de sus ' + D.xs.length + ' eventos']);
  }
  if (T) {
    const dia = (T.dia || {})[cid];
    if (Array.isArray(dia) && dia.length === 7 && dia.some((x) => x > 0)) { const i = dia.indexOf(Math.max(...dia)); xs.push(['Su mejor día de la semana', '+' + num(dia[i]), 'el ' + DIAS_N[i]]); }
    const hs = (T.hist || []).filter((h) => h[1] === cid);
    if (hs.length) { const a = Math.max(...hs.map((h) => h[3])); xs.push(['Su tier más alto', T.nombres[a], plural(hs.filter((h) => h[3] > h[2]).length, 'subida') + ' y ' + plural(hs.filter((h) => h[3] < h[2]).length, 'bajada')]); }
  }
  if (!xs.length) return null;
  return (
    <section className="pf9-pz pf9-rec tinte-o">
      <header className="pf9-h"><h3>Sus récords</h3></header>
      <ul>{xs.map((x) => <li key={x[0]}><span>{x[0]}<small>{x[2]}</small></span><b>{x[1]}</b></li>)}</ul>
    </section>
  );
}

