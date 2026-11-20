// 🏟️ EL PERFIL DEL SERVIDOR EN BANDAS (17/11/2026). Dlx, después del perfil del rapero (6.26): «ahora haz lo mismo con el
// perfil de los servidores», y a la maqueta privada (https://claude.ai/artifact/Y7sWhTvSjVNCRCshPGMXYs): «Sí, pásala».
// Las mismas bandas negras y blancas del Inicio y los mismos paneles (`Banda`, clases `pf9-` de css/perfil.css); acá van
// las piezas que son de un servidor: sus historias, su forma, su próximo evento, de un vistazo, su noche más grande, cara a
// cara con otro servidor, quién organiza, su muro, sus eventos, sus campeones, la tabla de servidores, cuándo juega, sus
// récords, ¿vuelven? y los de la casa. Lo que lleva el research (scratchpad/maqueta_sv): FotMob pone el próximo partido
// primero; la forma reciente; el podio; el mapa de calor; la retención; el cara a cara entre comunidades.
// ⚠️ NO CALCULA NADA EN EL SERVIDOR: todo sale de lo que la página ya baja —`/api/perfiles` (`e`: los eventos de la
// temporada con su servidor, su instante y su gente; `p[k].ev`: el puesto de cada uno), la tabla, `svs`, `agenda`, `mult`
// y el muro—. Sin dato no hay pieza.
import { useEffect, useMemo, useState } from 'react';
import { diaISO, limpio, minutosDelDia, num, siglaDe } from './liga.js';
import { Alguien, Bandera, Cara, aDiscord, accion, nombrePais } from './piezas.jsx';
import { gruposHistorias } from './arriba.jsx';
import { useAplausos } from './aplausos.js';
import { useComentarios } from './comentarios.jsx';
import { usePase } from './pase.js';
import { Fila } from './publicaciones2.jsx';
import { Banda } from './perfil_bandas.jsx';
import CSS_PERFIL from './css/perfil.css?inline';
import CSS_PAGINA from './css/servidor_bandas.css?inline';
import { usarCss } from './css.js';

// los paneles y las bandas son los del perfil (css/perfil.css, `pf9-`); lo propio del servidor, `sv9-`
usarCss('perfil', CSS_PERFIL);
usarCss('servidor_bandas', CSS_PAGINA);

export { Banda };

const MES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEPT', 'OCT', 'NOV', 'DIC'];
const fecha = (iso) => { const d = new Date(iso); if (isNaN(d)) return ''; const [, m, dd] = diaISO(d).split('-'); return Number(dd) + ' ' + MES[Number(m) - 1].toLowerCase(); };
// el día de la semana en la zona de quien mira (0 = lunes)
const diaSem = (iso) => (new Date(diaISO(new Date(iso)) + 'T12:00:00Z').getUTCDay() + 6) % 7;
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DIAS_PL = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'];
const FRANJAS = [['Madrugada', 0, 6], ['Mañana', 6, 12], ['Mediodía', 12, 16], ['Tarde', 16, 20], ['Noche', 20, 24]];
// 🕒 cada franja dentro de una frase (18/11/2026): se armaba «a la » + la etiqueta, y «Mediodía» es masculino —«los
// domingos a la mediodía», en DDF, CEU, URBF, SR, FRZ y FVS—
const EN_FRANJA = ['a la madrugada', 'a la mañana', 'al mediodía', 'a la tarde', 'a la noche'];
const SEMIS = ['Semifinal', 'Tercero', 'Cuarto'];
const coma = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
const cuenta = (xs) => { const m = new Map(); xs.forEach((x) => m.set(x, (m.get(x) || 0) + 1)); return m; };
const masComun = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]);

// ── los datos de una vez, para todas las piezas ──
export function useSvDatos(liga, sv, P) {
  return useMemo(() => {
    if (!P || !P.e || !P.p) return null;
    const E = P.e;
    const puestos = {};
    const primero = {};
    const veces = {};
    // 👀 sin las llaves que no suman (`x[5]`, la marca de /api/perfiles para las de `llaves_sin_sumar.json`) (18/11/2026):
    // entraban a los eventos, al debut, a las veces y al cara a cara, y CEU decía 26 eventos con 10 en su tira (`s.ev`).
    // Dlx, 20/10/2026, de esas llaves: «No cuenta para nada». Siguen en el calendario y en «Ver llave»
    Object.entries(P.p).forEach(([k, v]) => {
      const xs = [];
      (v.ev || []).forEach(([n, pu]) => {
        (puestos[n] = puestos[n] || {})[k] = pu;
        const x = E[n];
        if (x && x[2] && !x[5]) xs.push([x[2], x[1]]);
      });
      if (xs.length) { xs.sort((a, b) => a[0].localeCompare(b[0])); primero[k] = xs[0][1]; veces[k] = xs.length; }
    });
    const evs = Object.entries(E).filter(([, x]) => x[1] === sv && x[2] && !x[5]).map(([n, x]) => {
      const pz = puestos[n] || {};
      const ks = Object.keys(pz);
      return { n, nom: limpio(x[0] || 'Evento ' + n), iso: x[2], gente: x[3] || ks.length, ks,
        camp: ks.filter((k) => pz[k] === 'Campeón'), sub: ks.filter((k) => pz[k] === 'Subcampeón'), semi: ks.filter((k) => SEMIS.includes(pz[k])) };
    }).sort((a, b) => b.iso.localeCompare(a.iso));
    if (!evs.length) return null;
    const fila = (k) => liga.T[k] || (P.p[k] && P.p[k].f) || null;
    const nombre = (k) => { const f = fila(k); return limpio((f && f.n) || k); };
    const gente = cuenta(evs.flatMap((e) => e.ks));
    const titulos = cuenta(evs.flatMap((e) => e.camp));
    const finales = cuenta(evs.flatMap((e) => e.camp.concat(e.sub)));
    const paises = cuenta([...gente.keys()].map((k) => (fila(k) || {}).cc).filter(Boolean));
    const deb = Object.keys(primero).filter((k) => primero[k] === sv);
    const volvio = deb.filter((k) => veces[k] > 1);
    const debL = Object.keys(primero);
    const volvioL = debL.filter((k) => veces[k] > 1);
    // cuándo: día y franja en la zona de quien mira
    const cal = {};
    evs.forEach((e) => { const h = minutosDelDia(e.iso) / 60; const f = FRANJAS.findIndex(([, a, b]) => h >= a && h < b); const c = diaSem(e.iso) + ':' + f; cal[c] = (cal[c] || 0) + 1; });
    // por semana (de lunes a domingo) y los días seguidos con evento
    const sem = {};
    const dias = [...new Set(evs.map((e) => diaISO(new Date(e.iso))))].sort();
    evs.forEach((e) => { const d = new Date(diaISO(new Date(e.iso)) + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - diaSem(e.iso)); const l = d.toISOString().slice(0, 10); (sem[l] = sem[l] || [0, 0])[0] += 1; sem[l][1] += e.gente; });
    let racha = 0, mejor = 0, prev = null;
    dias.forEach((d) => { const t = Date.parse(d + 'T12:00:00Z'); racha = prev != null && t - prev === 864e5 ? racha + 1 : 1; mejor = Math.max(mejor, racha); prev = t; });
    // el de cualquier servidor, para el cara a cara
    const stats = (s) => {
      // 👀 sin las que no suman (`x[5]`), como `evs` (18/11/2026)
      const xs = Object.entries(E).filter(([, x]) => x[1] === s && x[2] && !x[5]);
      const g = new Set(xs.flatMap(([n]) => Object.keys(puestos[n] || {})));
      const o = liga.svs[s] || {};
      return { ev: xs.length, gente: g.size, prom: xs.reduce((t, [, x]) => t + (x[3] || 0), 0) / Math.max(1, xs.length), mayor: Math.max(0, ...xs.map(([, x]) => x[3] || 0)), pts: o.pts || 0, miembros: o.miembros || 0 };
    };
    return { evs, fila, nombre, gente, titulos, finales, paises, deb, volvio, debL, volvioL, cal, sem, mejorRacha: mejor, stats };
  }, [liga, sv, P]);
}

const ovrTxt = (f) => (f && f.ovr && f.pos ? <>{f.cc ? <Bandera cc={f.cc} cls="pf9-flag" /> : null}OVR {f.ovr} · #{f.pos}</> : 'fuera del ranking');
// 🧑 la clave va también para quien está fuera de las 200 filas (18/11/2026): con `liga.T[k]` le llegaba vacía y su cara
// dependía de encontrarla por nombre; `avUrl()` ya la busca por clave en los perfiles y en los que viajan fuera
const Av = ({ liga, D, k, cls = '' }) => <Cara liga={liga} k={liga.existe(k) ? k : ''} nombre={D.nombre(k)} cls={'cara pf9-av ' + cls} lazy />;

// ── ⚖️ LAS COLUMNAS DE CADA BANDA TERMINAN JUNTAS (como el perfil del rapero): en «Sus noches» el muro muestra más o
// menos publicaciones, en «Su temporada» la lista de eventos crece o se achica y en «Su gente» los de la casa. Sólo en la
// compu, una fila por vuelta y con tope de vueltas, para que nada salte ──
// Los servidores chicos (pocas publicaciones, pocos eventos) no se emparejan sólo con las listas: además, las piezas que
// pueden ir a cualquier lado (`B2_FLEX`, `B3_FLEX`) van donde dejan las dos columnas más parejas, como «Lo suyo» del perfil
export const B2_FLEX = ['sv9-duelo', 'sv9-org'];
export const B3_FLEX = ['sv9-camp', 'sv9-hm', 'pf9-rec'];
const B0 = { ev: 6, mu: 5, fi: 8, b2: 0, b3: 0b011, v: 0 };
export const aLaDerecha = (mask, flex, c) => !!((mask >> (flex.length - 1 - flex.indexOf(c))) & 1);
export function useBalanceSv(raiz, sv, listo) {
  const [L, setL] = useState(Object.assign({ sv: '' }, B0));
  const [medida, setMedida] = useState(0);
  const B = L.sv === sv ? L : Object.assign({ sv }, B0);
  useEffect(() => {
    const el = raiz.current;
    if (!el || !listo || typeof ResizeObserver !== 'function') return undefined;
    const ro = new ResizeObserver(() => setMedida((x) => x + 1));
    el.querySelectorAll('.pf9-g > .pf9-pila').forEach((x) => ro.observe(x));
    return () => ro.disconnect();
  }, [raiz, sv, listo]);
  useEffect(() => {
    const el = raiz.current;
    if (!el || !listo || B.v > 20 || !window.matchMedia || !window.matchMedia('(min-width: 900px)').matches) return;
    const dif = (c) => { const [a, b] = el.querySelectorAll('.' + c + ' > .pf9-pila'); return a && b ? b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom : 0; };
    const alto = (sel) => { const x = el.querySelector(sel); return x ? x.getBoundingClientRect().height + 8 : 60; };
    // primero, qué pieza va a cada lado: el alto de cada una (14 px de hueco) y todas las combinaciones
    const h = (c) => { const x = el.querySelector('.' + c); return x ? x.getBoundingClientRect().height + 14 : 0; };
    const mejor = (fijoI, fijoD, flex, mask) => {
      const lados = (m) => flex.reduce((acc, c) => { acc[aLaDerecha(m, flex, c) ? 1 : 0] += h(c); return acc; }, [h(fijoI), h(fijoD)]);
      const desv = (m) => { const [a, b] = lados(m); return Math.abs(a - b); };
      let best = mask;
      for (let m = 0; m < 1 << flex.length; m++) if (desv(m) < desv(best) - 60) best = m;
      return best;
    };
    const b2 = mejor('pf9-noche', 'pf9-muro', B2_FLEX, B.b2);
    const b3 = mejor('sv9-eventos', 'sv9-tsv', B3_FLEX, B.b3);
    if (b2 !== B.b2 || b3 !== B.b3) { setL(Object.assign({}, B, { sv, b2, b3, v: B.v + 1 })); return; }
    const n = Object.assign({}, B);
    const d2 = dif('sv9-b2'), h2 = alto('.pf9-filas > *');
    if (d2 > h2 && n.mu > 2) n.mu -= 1; else if (d2 < -h2 * 1.5 && n.mu < 10) n.mu += 1;
    const d3 = dif('sv9-b3'), h3 = alto('.sv9-evl > li');
    if (d3 > h3) n.ev += 1; else if (d3 < -h3 && n.ev > 3) n.ev -= 1;
    const d4 = dif('sv9-b4'), h4 = alto('.sv9-fie li');
    if (d4 > h4 && n.fi > 3) n.fi -= 1; else if (d4 < -h4 && n.fi < 12) n.fi += 1;
    if (n.mu !== B.mu || n.ev !== B.ev || n.fi !== B.fi) setL(Object.assign(n, { sv, v: B.v + 1 }));
  }, [medida, sv, listo, B.mu, B.ev, B.fi, B.b2, B.b3]); // eslint-disable-line react-hooks/exhaustive-deps
  return B;
}

// ── 📸 sus historias: el círculo del servidor en el Inicio, como destacados. Un toque abre el mismo visor ──
export function SvHistorias({ liga, sv }) {
  const g = useMemo(() => { try { return gruposHistorias(liga).find((x) => x.id === 'sv-' + sv.toLowerCase()) || null; } catch (e) { return null; } }, [liga, sv]);
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
              <span className="pf9-hist-c" style={{ backgroundImage: 'url(' + liga.logo(s.esc || sv) + ')' }}><i>▶</i></span>
              <b>{limpio(String(s.tag || '').split('·')[0]).toLowerCase()}</b>
              <small>{s.t ? fecha(s.t) : ''}</small>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 🖥️ ¿Es la compu (900 px o más)? La misma de crew2.jsx: el corte del CSS de las bandas. */
function useCompu() {
  const q = '(min-width: 900px)';
  const [si, setSi] = useState(() => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(q).matches);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const m = window.matchMedia(q);
    const f = () => setSi(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return si;
}

// ── 📊 su forma: los últimos doce eventos (ocho en el teléfono); el alto es la gente, abajo quién ganó ──
// 📱 el corte del teléfono va acá y no en el CSS (18/11/2026): el CSS escondía cuatro columnas y el título, el promedio
// y el pie seguían contando doce —«últimos 12 eventos» sobre 8 barras, en CEU a 390 px—
export function SvForma({ liga, D }) {
  const compu = useCompu();
  const xs = D.evs.slice(0, compu ? 12 : 8).reverse();
  if (xs.length < 2) return null;
  const mx = Math.max(...xs.map((e) => e.gente), 1);
  const rec = Math.max(...D.evs.map((e) => e.gente));
  const prom = xs.reduce((t, e) => t + e.gente, 0) / xs.length;
  const ult = xs[xs.length - 1];
  return (
    <section className="pf9-pz pf9-forma tinte-v">
      <header className="pf9-h"><h3>Su forma</h3><span>últimos {xs.length} eventos</span></header>
      <ol className="pf9-fm" style={{ gridTemplateColumns: 'repeat(' + xs.length + ',minmax(0,1fr))' }}>
        {xs.map((e) => {
          const c = e.gente === rec ? '#F5C542' : '#29B298';
          const k = e.camp[0];
          return (
            <li key={e.n}>
              <button type="button" onClick={() => accion.llave(String(e.n))} title={e.nom + ' · ' + e.gente + ' raperos'} aria-label={e.nom + ': ' + e.gente + ' raperos'}>
                <em>{e.gente}</em>
                <b style={{ height: Math.max(12, Math.round((100 * e.gente) / mx)) + '%', background: c }} />
                <span style={{ background: c, color: '#030304' }}>{DIAS[diaSem(e.iso)].toUpperCase()}</span>
              </button>
              <span className="pf9-fm-q" title={k ? 'Ganó ' + D.nombre(k) : ''}>{k ? <Av liga={liga} D={D} k={k} cls="xs" /> : '·'}</span>
              <small>{fecha(e.iso)}</small>
            </li>
          );
        })}
      </ol>
      <p className="pf9-pie"><b>{coma(prom)} raperos por evento</b> en los últimos {xs.length} · el alto es la gente, abajo quién ganó · el último: <b>{ult.nom}</b>, {ult.gente} raperos</p>
    </section>
  );
}

// ── ⏭️ su próximo evento, o el que se juega ahora: lo primero que mira el que llega ──
export function SvProximo({ liga, sv }) {
  const vivo = liga.vivo().find((e) => e.sv === sv);
  const e = vivo || liga.luego().find((x) => x.sv === sv);
  if (!e) return null;
  const d = aDiscord(liga, e, !!vivo);
  const n = liga.luego().filter((x) => x.sv === sv).length;
  return (
    <section className="pf9-pz sv9-prox">
      <span className="sv9-k">{vivo ? '● En vivo ahora' : 'Su próximo evento'}</span>
      <p className="sv9-prox-t">{limpio(e.nombre)}</p>
      {/* ⏰ un sin_hora dice cuándo se anunció (revisión del 18/11/2026): su `cuando` es la hora de publicación */}
      <p className="sv9-prox-d">{vivo ? 'empezó ' + liga.dia(liga.cuandoDe(e)) : e.sin_hora ? 'anunciado ' + liga.cuando(e.cuando) : liga.dia(liga.cuandoDe(e))}{e.modalidad ? ' · ' + limpio(e.modalidad) : ''}
        {e.cupos ? ' · cupos ' + e.cupos : ''}{e.premios ? ' · ' + limpio(e.premios).toLowerCase() : ''}{e.org ? ' · organiza ' + limpio(e.org) : ''}</p>
      <div className="sv9-acc">
        {d ? <a className="pf9-btn sv9-negro" href={d.url} target="_blank" rel="noopener noreferrer">{d.txt}</a> : null}
        {n > 1 ? <a className="sv9-lk" href="#/eventos">Ver los {n} próximos</a> : null}
      </div>
    </section>
  );
}

// ── 🎮 CÓMO SE JUEGA ACÁ (20/11/2026, el plan de los tiers: «dale», para todos): lo que un nuevo necesita saber antes de
// anotarse, sacado de los anuncios de la temporada (`como` de `_servidores()` en bot/subir_web.py: nada se escribe a mano).
// El día y la hora fuerte ya están en «Cuándo juega», en la hora de quien mira ──
const antTxt = (h) => (h < 0.25 ? 'al empezar' : h < 1.5 ? Math.max(10, Math.round((h * 60) / 5) * 5) + ' min antes'
  : h < 36 ? Math.round(h) + ' h antes' : Math.round(h / 24) + ' días antes');
export function SvComo({ liga, sv, D }) {
  const c = ((liga.svs || {})[sv] || {}).como;
  if (!c) return null;
  const ev = D ? D.evs : [];
  const prom = ev.length ? ev.reduce((t, e) => t + e.gente, 0) / ev.length : 0;
  const mod = c.mod || [];
  const ins = c.ins || {};
  const xs = [
    mod.length ? ['Qué se juega', (mod[1] ? 'también ' + mod[1][0] + ' · ' : '') + mod[0][1] + ' de sus ' + c.n + ' anuncios', mod[0][0]] : null,
    c.cup ? ['Cupos', 'lo que suele dar cada evento', String(c.cup)] : null,
    prom >= 2 ? ['Por evento', 'raperos de promedio en la temporada', coma(prom)] : null,
    c.ant != null ? ['Avisa', c.ant < 1.5 ? 'con la campana te enteras al minuto' : 'anuncia con tiempo', antTxt(c.ant)] : null,
    ins.canal ? ['Para anotarte', '#' + String(ins.canal).replace(/^#/, ''), 'En su canal'] : null,
  ].filter(Boolean);
  if (!xs.length) return null;
  return (
    <section className="pf9-pz pf9-rec sv9-como tinte-g">
      <header className="pf9-h"><h3>Cómo se juega acá</h3><span>de sus anuncios</span></header>
      <ul>{xs.map((x) => <li key={x[0]}><span>{x[0]}<small>{x[1]}</small></span><b>{x[2]}</b></li>)}</ul>
      {ins.link || (c.ant != null && c.ant < 1.5) ? (
        <div className="sv9-acc">
          {ins.link ? <a className="pf9-btn bl" href={ins.link} target="_blank" rel="noopener noreferrer">Ir a inscribirte ↗</a> : null}
          {c.ant != null && c.ant < 1.5 ? <a className="sv9-lk" href="#/avisos">Activar la campana</a> : null}
        </div>
      ) : null}
    </section>
  );
}

// ── 👀 de un vistazo: seis números ──
export function SvVistazo({ D, sv }) {
  const ev = D.evs;
  const tot = ev.reduce((t, e) => t + e.gente, 0);
  const mayor = Math.max(...ev.map((e) => e.gente));
  // 📅 la semana de HOY, con la misma clave que `D.sem` (el lunes, en la zona de quien mira) (18/11/2026): se tomaba la
  // última semana con eventos, y FVS decía «1 esta semana» con su último evento del 13/10
  const hoy = new Date();
  const lun = new Date(diaISO(hoy) + 'T12:00:00Z');
  lun.setUTCDate(lun.getUTCDate() - diaSem(hoy.toISOString()));
  const esta = (D.sem[lun.toISOString().slice(0, 10)] || [0])[0];
  const pct = D.deb.length ? Math.round((100 * D.volvio.length) / D.deb.length) : null;
  const pctL = D.debL.length ? Math.round((100 * D.volvioL.length) / D.debL.length) : null;
  const top = masComun(D.titulos)[0];
  const pa = masComun(D.paises)[0];
  const xs = [
    ['Eventos', num(ev.length), (esta ? esta + ' esta semana · ' : '') + num(tot) + ' participaciones'],
    ['Raperos', num(D.gente.size), 'distintos jugaron acá'],
    ['Por evento', coma(tot / ev.length), 'el más lleno: ' + mayor],
    ['Campeones', String(D.titulos.size), top ? top[1] + (top[1] === 1 ? ' título de ' : ' títulos de ') + D.nombre(top[0]) : ''],
    pct != null && D.deb.length >= 3 ? ['Vuelven', pct + ' %', 'de los ' + D.deb.length + ' que debutaron acá · la Liga ' + pctL + ' %'] : null,
    ['Países', String(D.paises.size), pa ? nombrePais(pa[0]) + ', ' + pa[1] : ''],
  ].filter(Boolean);
  return (
    <section className="pf9-pz pf9-kpis tinte-g">
      <header className="pf9-h"><h3>De un vistazo</h3><span>{siglaDe(sv)} en la temporada</span></header>
      <dl>{xs.map((x) => <div key={x[0]}><dt>{x[0]}</dt><dd>{x[1]}</dd><small>{x[2]}</small></div>)}</dl>
    </section>
  );
}

// ── 🌙 su noche más grande: el evento con más gente, su podio y las otras noches grandes ──
export function SvNoche({ liga, D, sv }) {
  const xs = [...D.evs].sort((a, b) => b.gente - a.gente || b.iso.localeCompare(a.iso));
  const e = xs[0];
  const lugar = (k, r, cls = '') => (
    <li key={r + k} className={cls}><span className="pf9-rd">{r}</span><Av liga={liga} D={D} k={k} cls={cls ? 'lg' : ''} /><b><Alguien liga={liga} nombre={D.nombre(k)} cara={false} /></b><small>{ovrTxt(D.fila(k))}</small></li>
  );
  const pod = [...e.camp.slice(0, 1).map((k) => lugar(k, 'Campeón', 'cop')), ...e.sub.slice(0, 1).map((k) => lugar(k, 'Final')), ...e.semi.slice(0, 2).map((k) => lugar(k, 'Semifinal'))];
  // 🔢 «1 evento», en singular (18/11/2026): con un solo evento decía «1 eventos en la T1»
  return (
    <section className="pf9-pz pf9-noche tinte-o">
      <header className="pf9-h"><h3>Su noche más grande</h3><span>{D.evs.length} {D.evs.length === 1 ? 'evento' : 'eventos'} en la {liga.temp}</span></header>
      <p className="pf9-nt">{e.nom}</p>
      <p className="pf9-pie">{fecha(e.iso)} · {e.gente} raperos · el récord de {siglaDe(sv)} en la {liga.temp}</p>
      {pod.length ? <ol className="pf9-ruta sv9-pod">{pod}</ol> : null}
      {xs.length > 1 ? (
        <div className="pf9-otros"><span className="pf9-k">Sus otras noches grandes</span>
          <ul>{xs.slice(1, 5).map((x) => (
            <li key={x.n}><button type="button" onClick={() => accion.llave(String(x.n))}><b>{x.nom}</b>
              <small>{fecha(x.iso)} · {x.gente} raperos{x.camp[0] ? ' · ganó ' + D.nombre(x.camp[0]) : ''}</small></button></li>
          ))}</ul></div>
      ) : null}
      <button type="button" className="pf9-btn bl" onClick={() => accion.llave(String(e.n))}>Ver la llave</button>
    </section>
  );
}

// ── ⚔️ cara a cara con otro servidor: su rival de la guerra de la semana o, sin guerra, el de al lado en la tabla ──
export function SvDuelo({ liga, D, sv }) {
  const mm = liga.d.mult || {};
  const par = ((mm.guerra || {}).pares || []).find((p) => p.includes(sv));
  const orden = Object.values(liga.svs).sort((a, b) => (b.pts || 0) - (a.pts || 0));
  const i = orden.findIndex((s) => s.sv === sv);
  const rival = par ? (par[0] === sv ? par[1] : par[0]) : (orden[i - 1] || orden[i + 1] || {}).sv;
  if (!rival || !liga.svs[rival]) return null;
  const a = D.stats(sv), b = D.stats(rival);
  const filas = [['Puntos', a.pts, b.pts, num], ['Eventos', a.ev, b.ev, String], ['Raperos', a.gente, b.gente, String], ['Por evento', a.prom, b.prom, coma],
    ['Evento más grande', a.mayor, b.mayor, String], ['Miembros en Discord', a.miembros, b.miembros, num]].filter((f) => f[1] || f[2]);
  return (
    <section className="pf9-pz sv9-duelo tinte-m">
      <header className="pf9-h"><h3>Cara a cara</h3></header>
      <div className="sv9-du-cab">
        <span><img alt="" src={liga.logo(sv)} /><b>{siglaDe(sv)}</b></span><em>VS</em>
        <a href={'#/sv/' + encodeURIComponent(siglaDe(rival))}><b>{siglaDe(rival)}</b><img alt="" src={liga.logo(rival)} /></a>
      </div>
      <ul className="sv9-du-l">
        {filas.map(([t, x, y, f]) => {
          const tot = (x + y) || 1;
          return (
            <li key={t}><b className={x > y ? 'gana' : ''}>{f(x)}</b><span>{t}</span><b className={y > x ? 'gana' : ''}>{f(y)}</b>
              <i><u style={{ width: Math.round((100 * x) / tot) + '%' }} /><s style={{ width: Math.round((100 * y) / tot) + '%' }} /></i></li>
          );
        })}
      </ul>
      <p className="pf9-pie">{siglaDe(rival)}, {par ? 'su rival en la guerra de esta semana' : 'el de al lado en la tabla'} · en toda la {liga.temp}</p>
    </section>
  );
}

// ── 🎤 quién organiza: los que firmaron los anuncios de sus eventos (`agenda` del lobby) ──
export function SvOrganiza({ liga, sv }) {
  const xs = ((liga.d.agenda || {})[sv] || []).filter((x) => x[1] > 0);
  if (!xs.length) return null;
  const tot = xs.reduce((t, x) => t + x[1], 0);
  return (
    <section className="pf9-pz sv9-org">
      <header className="pf9-h"><h3>Quién organiza</h3></header>
      <ul>{xs.slice(0, 5).map(([n, c]) => <li key={n}><b>{limpio(n)}</b><i><u style={{ width: Math.round((100 * c) / xs[0][1]) + '%' }} /></i><span>{c}</span></li>)}</ul>
      <p className="pf9-pie">los anuncios de sus eventos firmados por cada uno · {tot} en total</p>
    </section>
  );
}

// ── 📰 su muro: lo del servidor (la semana, el cierre, el chat, sus récords) y lo de su gente, con el dibujo de Publicaciones ──
const DEL_SV = (it) => /^sv/.test(it.tipo) || it.tipo === 'flyer';
const VER_MURO = 5;
export function SvMuro({ liga, sv, n = VER_MURO }) {
  const A = useAplausos();
  useComentarios();
  const P = usePase(typeof window !== 'undefined' && !!window.DC);
  const [fil, setFil] = useState('');
  const [todas, setTodas] = useState(false);
  const xs = useMemo(() => liga.muroLimpio().filter((it) => it.tipo !== 'anuncio' && liga.svDe(it) === sv), [liga, sv]);
  if (!xs.length) return null;
  const nsv = xs.filter(DEL_SV).length;
  // 🧹 el filtro vale sólo si los chips están a la vista (18/11/2026): el perfil no se vuelve a montar al pasar de un
  // servidor a otro, y «De su gente» marcado en FFA dejaba a ACAD —sólo publicaciones del servidor— con «Su muro» vacío
  // y sin chips para volver a «Todo»
  const f = nsv && nsv < xs.length ? fil : '';
  const lista = f === 'sv' ? xs.filter(DEL_SV) : f === 'gente' ? xs.filter((it) => !DEL_SV(it)) : xs;
  const ver = todas ? lista : lista.slice(0, n);
  const ch = (k, t, n) => <button type="button" className={fil === k ? 'on' : ''} aria-pressed={fil === k} onClick={() => { setFil(k); setTodas(false); }}>{t} <em>{n}</em></button>;
  return (
    <section className="pf9-pz pf9-muro pw" id="sv-muro">
      <header className="pf9-h"><h3>Su muro</h3><span>lo firma {siglaDe(sv)} o su gente</span></header>
      {nsv && nsv < xs.length ? <div className="pw-chips pf9-chips" role="group" aria-label="Qué publicaciones ver">{ch('', 'Todo', xs.length)}{ch('sv', 'Del servidor', nsv)}{ch('gente', 'De su gente', xs.length - nsv)}</div> : null}
      <div className="pf9-filas">{ver.map((it) => <Fila key={it.id || it.t} liga={liga} it={it} A={A} P={P} nuevo={false} />)}</div>
      {lista.length > n ? <button type="button" className="pf9-btn" aria-expanded={todas} onClick={() => setTodas(!todas)}>{todas ? 'Ver menos' : 'Ver las ' + lista.length + ' publicaciones'}</button> : null}
    </section>
  );
}

// ── 📈 sus eventos: cada uno en su fecha (el alto, la gente) y los últimos con su campeón ──
export function SvEventos({ liga, D, n = 6 }) {
  const [todos, setTodos] = useState(false);
  const ev = D.evs;
  const ini = Date.parse(ev[ev.length - 1].iso);
  const fin = Math.max(Date.now(), Date.parse(ev[0].iso)) + 864e5;
  const W = 600, H = 90;
  const mx = Math.max(...ev.map((e) => e.gente));
  const x = (iso) => ((Date.parse(iso) - ini) / (fin - ini)) * (W - 4);
  const ver = todos ? ev : ev.slice(0, n);
  return (
    <section className="pf9-pz sv9-eventos" id="sv-eventos">
      <header className="pf9-h"><h3>Sus eventos</h3><span>{ev.length} en la {liga.temp} · {num(ev.reduce((t, e) => t + e.gente, 0))} participaciones</span></header>
      <svg className="sv9-tira" viewBox={'0 0 ' + W + ' ' + H} preserveAspectRatio="none" aria-label={'Sus ' + ev.length + ' eventos en la temporada, con la gente de cada uno'}>
        {ev.map((e) => { const h = ((H - 6) * e.gente) / mx; return <rect key={e.n} x={x(e.iso).toFixed(1)} y={(H - h).toFixed(1)} width="3.2" height={h.toFixed(1)} fill={e.gente === mx ? '#F5C542' : '#29B298'} />; })}
      </svg>
      <p className="sv9-ley"><i style={{ background: '#29B298' }} />cada evento en su fecha · el alto, la gente <i style={{ background: '#F5C542' }} />el récord</p>
      <ul className="sv9-evl">
        {ver.map((e) => (
          <li key={e.n}>
            <button type="button" onClick={() => accion.llave(String(e.n))}>
              <span className="sv9-med">{e.gente}</span>
              <span className="sv9-ev-tx"><b>{e.nom}</b><small>{fecha(e.iso)} · {DIAS[diaSem(e.iso)].toLowerCase()} · {e.camp[0] ? 'ganó ' + D.nombre(e.camp[0]) : 'sin campeón cargado'}</small></span>
              {e.camp[0] ? <Av liga={liga} D={D} k={e.camp[0]} /> : <span />}
            </button>
          </li>
        ))}
      </ul>
      {ev.length > n ? <button type="button" className="pf9-btn" aria-expanded={todos} onClick={() => setTodos(!todos)}>{todos ? 'Ver menos' : 'Ver los ' + ev.length + ' eventos'}</button> : null}
    </section>
  );
}

// ── 🏆 sus campeones: el podio de títulos ganados acá y los que siguen ──
export function SvCampeones({ liga, D }) {
  const xs = masComun(D.titulos).slice(0, 9);
  if (!xs.length) return null;
  const orden = xs.length >= 3 ? [1, 0, 2] : xs.map((_, i) => i);
  const t = (n) => n + (n === 1 ? ' título' : ' títulos');
  return (
    <section className="pf9-pz sv9-camp tinte-o">
      <header className="pf9-h"><h3>Sus campeones</h3><span>{D.titulos.size} distintos ganaron acá</span></header>
      <ol className={'sv9-podio n' + Math.min(3, xs.length)}>
        {orden.map((i) => (
          <li key={xs[i][0]} className={'p' + (i + 1)}><Av liga={liga} D={D} k={xs[i][0]} cls="lg" /><b><Alguien liga={liga} nombre={D.nombre(xs[i][0])} cara={false} /></b><span>{t(xs[i][1])}</span><i>{i + 1}º</i></li>
        ))}
      </ol>
      {xs.length > 3 ? (
        <ol className="sv9-camp-l">{xs.slice(3).map(([k, c], i) => (
          <li key={k}><span className="sv9-n">{i + 4}</span><Av liga={liga} D={D} k={k} cls="xs" /><b><Alguien liga={liga} nombre={D.nombre(k)} cara={false} /></b><small>{t(c)} · {D.finales.get(k) || c} finales</small></li>
        ))}</ol>
      ) : null}
    </section>
  );
}

// ── 📋 en la tabla de servidores: su puesto por los puntos de su gente, a quién tiene arriba y cuánto le falta ──
export function SvTabla({ liga, sv }) {
  const orden = Object.values(liga.svs).filter((s) => (s.pts || 0) > 0).sort((a, b) => (b.pts || 0) - (a.pts || 0));
  const i = orden.findIndex((s) => s.sv === sv);
  if (i < 0) return null;
  const yo = orden[i];
  const ini = Math.max(0, Math.min(i - 2, orden.length - 5));
  const t = i > 0
    ? <>Le faltan <b>{num((orden[i - 1].pts || 0) - (yo.pts || 0))} pts</b> para pasar a {siglaDe(orden[i - 1].sv)} y subir al #{i}</>
    : orden[1] ? <>Es el <b>#1 de los servidores</b>: le saca <b>{num((yo.pts || 0) - (orden[1].pts || 0))} pts</b> a {siglaDe(orden[1].sv)}</> : <>Es el <b>#1 de los servidores</b></>;
  return (
    <section className="pf9-pz sv9-tsv tinte-g">
      <header className="pf9-h"><h3>En la tabla de servidores</h3><a className="sv9-lk" href="#/socios">Socios</a></header>
      <p className="sv9-tsv-t">{t}</p>
      <ol className="sv9-tsv-l">
        {orden.slice(ini, ini + 5).map((s, j) => (
          <li key={s.sv} className={s.sv === sv ? 'yo' : ''}>
            <a href={'#/sv/' + encodeURIComponent(siglaDe(s.sv))}><span className="sv9-n">{ini + j + 1}</span><img alt="" src={liga.logo(s.sv)} /><b>{siglaDe(s.sv)}</b><small>{num(s.pts || 0)} pts</small></a>
          </li>
        ))}
      </ol>
      <p className="pf9-pie">por los puntos que su gente hizo acá · {orden.length} servidores con puntos</p>
    </section>
  );
}

// ── 🕒 cuándo juega: día y franja (en la hora de quien mira), cinco escalones sin degradé ──
export function SvCuando({ D }) {
  const vals = Object.values(D.cal);
  if (vals.length < 2) return null;
  const mx = Math.max(...vals);
  const tops = Object.entries(D.cal).filter(([, c]) => c === mx).map(([k]) => k.split(':').map(Number)).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const fr = [...new Set(tops.map((x) => x[1]))];
  const ds = tops.map((x) => DIAS_PL[x[0]]);
  const fuerte = fr.length === 1 ? 'los ' + (ds.length > 1 ? ds.slice(0, -1).join(', ') + ' y ' + ds[ds.length - 1] : ds[0]) + ' ' + EN_FRANJA[fr[0]]
    : tops.slice(0, 3).map(([d, f]) => 'los ' + DIAS_PL[d] + ' ' + EN_FRANJA[f]).join(' · ');
  return (
    <section className="pf9-pz sv9-hm">
      <header className="pf9-h"><h3>Cuándo juega</h3><span>en tu hora</span></header>
      <div className="sv9-hm-g" role="table" aria-label="Cuántos eventos hizo cada día y franja">
        <span />{DIAS.map((d) => <span key={d} className="sv9-hm-d">{d}</span>)}
        {FRANJAS.map(([fn], f) => [<span key={'f' + f} className="sv9-hm-f">{fn}</span>, ...DIAS.map((d, i) => {
          const c = D.cal[i + ':' + f] || 0;
          return <i key={d + f} className={'c' + (c ? Math.min(4, Math.ceil((4 * c) / mx)) : 0)} title={d + ' · ' + fn + ': ' + c}>{c || ''}</i>;
        })])}
      </div>
      {/* «cada uno» sólo si hay más de una casilla en el máximo (18/11/2026: con una sola decía «6 eventos cada uno») */}
      <p className="pf9-pie">Su hora fuerte: <b>{fuerte}</b> ({mx} {mx === 1 ? 'evento' : 'eventos'}{tops.length > 1 ? ' cada uno' : ''})</p>
    </section>
  );
}

// ── 🏅 sus récords ──
export function SvRecords({ D }) {
  const ev = D.evs;
  const mayor = ev.reduce((a, b) => (b.gente > a.gente ? b : a), ev[0]);
  const sem = Object.entries(D.sem).sort((a, b) => b[1][0] - a[1][0] || b[1][1] - a[1][1])[0];
  const fiel = masComun(D.gente)[0];
  const top = masComun(D.titulos)[0];
  const xs = [
    ['Su evento más grande', mayor.gente + ' raperos', mayor.nom + ' · ' + fecha(mayor.iso)],
    sem && sem[1][0] > 1 ? ['Su semana más fuerte', sem[1][0] + ' eventos', num(sem[1][1]) + ' participaciones · desde el lunes ' + fecha(sem[0] + 'T12:00:00Z')] : null,
    D.mejorRacha > 1 ? ['Días seguidos con evento', String(D.mejorRacha), 'su mejor racha en la temporada'] : null,
    fiel && fiel[1] > 1 ? ['El más fiel', fiel[1] + ' eventos', D.nombre(fiel[0]) + ' jugó más que nadie acá'] : null,
    top && top[1] > 1 ? ['El que más ganó', top[1] + ' títulos', D.nombre(top[0]) + ' · ' + (D.finales.get(top[0]) || top[1]) + ' finales'] : null,
  ].filter(Boolean);
  return (
    <section className="pf9-pz pf9-rec tinte-o">
      <header className="pf9-h"><h3>Sus récords</h3></header>
      <ul>{xs.map((x) => <li key={x[0]}><span>{x[0]}<small>{x[2]}</small></span><b>{x[1]}</b></li>)}</ul>
    </section>
  );
}

// ── 🔁 ¿vuelven? y de dónde es su gente ──
export function SvVuelven({ D, sv }) {
  const pa = masComun(D.paises).slice(0, 7);
  const hay = D.deb.length >= 3;
  if (!hay && !pa.length) return null;
  const pct = hay ? Math.round((100 * D.volvio.length) / D.deb.length) : 0;
  const pctL = D.debL.length ? Math.round((100 * D.volvioL.length) / D.debL.length) : 0;
  return (
    <section className="pf9-pz sv9-vuel tinte-g">
      <header className="pf9-h"><h3>{hay ? '¿Vuelven?' : 'De dónde es su gente'}</h3></header>
      {hay ? (
        <>
          <div className="sv9-vu-big"><b className={pct >= pctL ? '' : 'baja'}>{pct} %</b>
            <p>de los <b>{D.deb.length}</b> que debutaron en {siglaDe(sv)} volvieron a jugar<small>en toda la Liga es el {pctL} %</small></p></div>
          <div className="sv9-vu-bar"><i><u style={{ width: pct + '%' }} /><s style={{ left: pctL + '%' }} /></i><small>{siglaDe(sv)} · la raya es la Liga</small></div>
        </>
      ) : null}
      {pa.length ? (
        <>
          {hay ? <h4 className="sv9-k">De dónde es su gente</h4> : null}
          <ul className="sv9-pa">{pa.map(([cc, n]) => <li key={cc}><Bandera cc={cc} cls="pf9-flag" /><b>{nombrePais(cc)}</b><i><u style={{ width: Math.round((100 * n) / pa[0][1]) + '%' }} /></i><em>{n}</em></li>)}</ul>
          <p className="pf9-pie">{D.paises.size} países · {D.gente.size} raperos</p>
        </>
      ) : null}
    </section>
  );
}

// ── 🏠 los de la casa: los que más eventos jugaron acá ──
export function SvFieles({ liga, D, n = 8 }) {
  const xs = masComun(D.gente).slice(0, n);
  if (xs.length < 2) return null;
  return (
    <section className="pf9-pz sv9-fie">
      <header className="pf9-h"><h3>Los de la casa</h3><span>los que más jugaron acá</span></header>
      <ol>{xs.map(([k, c], i) => (
        <li key={k}><span className="sv9-n">{i + 1}</span><Av liga={liga} D={D} k={k} /><p><b><Alguien liga={liga} nombre={D.nombre(k)} cara={false} /></b><small>{ovrTxt(D.fila(k))}</small></p><em>{c}</em></li>
      ))}</ol>
      <a className="pf9-btn" href="#/ranking">Ver el ranking</a>
    </section>
  );
}
