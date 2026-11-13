// 🧭 POR QUÉ ESTÁS AHÍ Y CÓMO SUBIR, EN CADA RANKING (Dlx, 13/11/2026: «explicar en un texto las razones de ese puesto y
// cómo subir o mejorar para cada ranking… esto en cada ranking»). Un botón adentro de «TU LUGAR» (`TuTira` de
// ranking.jsx) que abre un POP-UP, el de la casa (`dialog.pn-pop` + `PopCab`).
//
// ⚠️ ERA UN DESPLEGABLE Y ESTIRABA EL FONDO (5.03). Dlx: «eso de que agrande la pantalla, que no haga eso porque crea un
// efecto raro… cuando abro eso estira el fondo». El panel crecía adentro del escenario del Ranking, y el escenario —con
// su fondo— crecía con él. El pop-up vive en la capa de arriba: la página no se mueve.
// ⚠️ Y «HAZ QUE EL TEXTO SEA MÁS ORDENADO»: repetía en «Dónde estás» la misma frase de la tira. Ahora va por partes, sin
// repetir: TUS NÚMEROS (cajas), una barra si todavía no entras, TÚ CONTRA el de arriba (una tablita), POR QUÉ (renglones
// cortos) y CÓMO SUBIR (pasos numerados). En el Competitivo, los servidores Tier 1 con su «Entrar» y «Ver en Socios».
//
// ⚠️ TODO SALE DE UN DATO, nada escrito a mano que se pueda quedar viejo:
// - los pesos del OVR y del Score, la confianza y los puntos por puesto, de `guia` (`sheet/ovr.py` y
//   `sheet/competitivo.py`), lo mismo que muestra la Guía;
// - las letras y su mínimo, de `rangos` (comun/rangos.py); los multiplicadores de la semana, de `mult`;
// - las cinco dimensiones de cada uno, de su perfil (`/api/perfiles`, `p[k].dm`), y sólo con la Competitiva
//   desbloqueada, la misma regla del perfil (Dlx, 07/10/2026);
// - qué socios cuentan para el Competitivo (`svs[].cu.c`, Socios 4.98), y los eventos de cada uno que cuentan ahí
//   (`evc`: sólo los de Tier 1; sin él, `ev`).
import { useEffect, useRef, useState } from 'react';
import { limpio, num, siglaDe } from './liga.js';
import { Ico, nombrePais } from './piezas.jsx';
import { PopCab } from './pop.jsx';

const pct = (x) => parseFloat(String(x == null ? '' : x).replace(',', '.')) || 0;
const coma = (x, d = 1) => Number(x || 0).toFixed(d).replace('.', ',');
const wr = (f) => Math.round(pct(f && f.wr) || 0);
const rch = (f) => (f && Array.isArray(f.rch) ? f.rch : [0, 0]);
const pl = (n, uno, varios) => num(n) + ' ' + (n === 1 ? uno : varios);
const evc = (f) => (f ? (typeof f.evc === 'number' ? f.evc : f.ev || 0) : 0);
const PCT = (v) => v + ' %';

// qué hacer para subir cada dimensión del Score (lo que mide cada una, dicho como acción)
const DIM_TIP = {
  Eficiencia: 'llega más lejos en cada evento: los de más gente dan más puntos.',
  Consistencia: 'llega a semifinal o más, más seguido.',
  Dominancia: 'gana eventos: es lo que mide.',
  Racha: 'encadena eventos llegando a semifinal o más.',
  Diversidad: 'suma en otros servidores Tier 1, no siempre en el mismo.',
};

// ── 👀 QUIÉN ERES EN EL RANKING SI NO ESTÁS VERIFICADO (Dlx, 13/11/2026: «que en el ranking uno muestre la posición
// arriba de cada uno, sin o al estar verificado»). `lg:mira` lo deja Mi cuenta al entrar (`cuentaDiscord()` del
// Worker) y, para quien entró antes de que existiera, `/api/cuenta/mira` lo da con la sesión, una vez por día. Sale de
// tu `dn:` (el que sólo leía `/card`) y SÓLO sirve para marcarte aquí: no va a `lg:yo`, que abriría lo de la cuenta.
// Tu fila sale de la tabla o, si no estás entre las 200 que viajan, de tu perfil (`p[k].f`), como hace App.jsx ──
const DIA = 86400000;
function leerMira(id) {
  try {
    const m = JSON.parse(localStorage.getItem('lg:mira') || 'null');
    return m && id && String(m.id) === id && (m.k || Date.now() - (m.t || 0) < DIA) ? m : null;
  } catch (e) { return null; }
}
// ⚠️ DEVUELVE `[fila, estado]`: 'listo' · 'buscando' · 'sin'. «No encontramos tu perfil» se dice SÓLO con 'sin': con
// los perfiles todavía bajando (pesan), quien está fuera de las 200 lo leía un segundo, siendo el #206
export function useMira(liga, dc) {
  const id = dc && dc.id ? String(dc.id) : '';
  const verif = dc && dc.clave ? String(dc.clave) : '';
  const [m, setM] = useState(() => leerMira(id));
  const [fila, setFila] = useState(null);
  const [mirado, setMirado] = useState('');
  useEffect(() => {
    if (!id || verif || liga.yo) return undefined;
    const ya = leerMira(id);
    if (ya) { setM(ya); return undefined; }
    let vivo = true;
    fetch('/api/cuenta/mira', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => {
        const v = { id, k: String((c && c.mira) || ''), t: Date.now() };
        if (c) try { localStorage.setItem('lg:mira', JSON.stringify(v)); } catch (e) { /* igual */ }
        if (vivo) setM(v);
      })
      .catch(() => { if (vivo) setM({ id, k: '', t: Date.now() }); });
    return () => { vivo = false; };
  }, [id, verif, !!liga.yo]); // eslint-disable-line react-hooks/exhaustive-deps
  // el verificado sin fila en el lobby (fuera de las 200): la suya, que App.jsx también busca
  const k = liga.yo ? '' : verif || (m && m.k) || '';
  useEffect(() => {
    if (!k || liga.T[k] || liga.X[k] || typeof window.perfiles !== 'function') return undefined;
    let vivo = true;
    Promise.resolve(window.perfiles()).then((d) => {
      const f = d && d.p && d.p[k] && d.p[k].f;
      if (!vivo) return;
      if (f && !f.solo) setFila(Object.assign({ k }, f));
      setMirado(k);
    }).catch(() => { if (vivo) setMirado(k); });
    return () => { vivo = false; };
  }, [k]); // eslint-disable-line react-hooks/exhaustive-deps
  if (liga.yo) return [null, 'listo'];
  if (!id) return [null, 'sin'];
  if (!k) return [null, m ? 'sin' : 'buscando'];
  const f = liga.T[k] || liga.X[k] || (fila && fila.k === k ? fila : null);
  return [f, f ? 'listo' : mirado === k ? 'sin' : 'buscando'];
}

// los puntos de un 1.º en el evento más grande y en uno de 8 a 15, de la tabla de puntos del payload
function puntosCampeon(liga) {
  const t = ((liga.d.guia || {}).puntos || {}).tablas || {};
  const de = (k) => ((t[k] || []).find((x) => x[0] === 'Campeón') || [])[1];
  return [de('16+'), de('8-15')];
}
// el multiplicador más alto de esta semana y de quién es
function mejorMult(liga) {
  const sv = (liga.d.mult || {}).sv || {};
  const [s, m] = Object.entries(sv).sort((a, b) => b[1] - a[1])[0] || [];
  return m > 1 ? [s, m] : null;
}
const reqDe = (liga, id) => {
  const q = (liga.d.requisitos || []).find((x) => x.id === id);
  const m = q && /(\d+)/.exec((q.pide || [])[0] || '');
  return m ? Number(m[1]) : 0;
};

/**
 * Lo que va en el pop-up, por partes: `datos` ([título, valor]: tus números), `prog` (la barra si todavía no entras),
 * `contra` ({nombre, n, filas: [título, tuyo, suyo, cómo se escribe]}), `notas` (por qué), `pasos` (cómo subir) y
 * `tier1` (los socios que cuentan para el Competitivo). `c` trae todo lo que se sabe de tu lugar en este ranking.
 */
export function explicar(sub, c) {
  const { liga, f, arriba, n, nombreDe, perf } = c;
  const G = liga.d.guia || {};
  const out = { datos: [], prog: null, contra: null, notas: [], pasos: [], tier1: null };
  const nA = arriba ? c.numero(arriba) : 0;
  const A = arriba ? <b>{nombreDe(arriba)}</b> : null;
  const contra = (filas) => { if (arriba && filas.length) out.contra = { nombre: nombreDe(arriba), n: nA, filas }; };
  const P = (k) => (perf && perf.p && perf.p[k]) || null;
  // la fila con todo (la de la tabla si está; si no, la tuya), para quien no está en ESTE ranking
  const t = f ? liga.T[f.k] || f : c.yo || null;

  // ⛔ fuera de concurso: con número estarías ahí
  if (f && f.fc && !c.grupo) {
    const k = c.base.slice(0, c.iYo).filter((g) => c.numero(g)).length + 1;
    out.notas.push(<>No tienes número porque <b>no estás verificado</b>: con tus números estarías <b>#{k}</b>.</>);
    out.pasos.push(<><a className="te-link" href="#/cuenta/verificar">Verifícate</a> (el rol <b>Miembro</b> en Discord Rap Español) y entras con número.</>);
  }

  if (sub === 'temporada' && t) {
    out.datos = [['OVR', t.ovr || '—'], ['Puntos', num(t.pts)], ['Eventos', num(t.ev || 0)], ['Podios', num(t.pod || 0)]];
    const cosas = [['Puntos', (g) => g.pts || 0, num], ['Eventos', (g) => g.ev || 0, num], ['Win%', wr, PCT], ['Podios', (g) => g.pod || 0, num]];
    const ta = arriba ? liga.T[arriba.k] || arriba : null;
    if (ta) contra(cosas.map(([q, v, fmt]) => [q, v(t), v(ta), fmt]));
    out.notas.push(<>El OVR sale de {(G.ovr || []).map(([q, p], i) => <span key={q}>{i ? ' · ' : ''}{q} <b>{PCT(p)}</b></span>)}, contra el que más tiene de cada cosa.</>);
    if (!f && t.pos) {
      const ult = c.base.filter((g) => c.numero(g)).slice(-1)[0];
      if (ult && (ult.ovr || 0) > (t.ovr || 0)) out.pasos.push(<>Te faltan <b>{(ult.ovr || 0) - (t.ovr || 0)} de OVR</b> para entrar a la tabla que se ve: el #{c.numero(ult)} tiene {ult.ovr}.</>);
    }
    if (ta) {
      const peso = Object.fromEntries((G.ovr || []).map(([q, p]) => [q, p]));
      const top = cosas.filter(([, v]) => v(ta) > v(t)).sort((p, q) => (peso[q[0]] || 0) - (peso[p[0]] || 0))[0];
      const [c16, c8] = puntosCampeon(liga);
      const tip = {
        Puntos: <>Suma <b>puntos</b>, que es lo que más pesa{c16 ? <>: un 1.º en un evento de 16 o más da {num(c16)}{c8 ? <>; en uno de 8 a 15, {num(c8)}</> : null}</> : null}.</>,
        Eventos: <>Juega más <b>eventos</b>: cada uno cuenta, aunque no ganes.</>,
        'Win%': <>Gana más <b>duelos</b>: el Win% son los ganados sobre los jugados.</>,
        Podios: <>Llega a más <b>podios</b>: la final o el tercer puesto.</>,
      };
      if (top) out.pasos.push(tip[top[0]]);
    }
    const mm = mejorMult(liga);
    if (mm) out.pasos.push(<>Esta semana los eventos de <b>{siglaDe(mm[0])}</b> valen <b>×{String(mm[1]).replace('.', ',')}</b>.</>);
    if (liga.d.mis) out.pasos.push(<>Cumple las <a className="te-link" href="#/ranking/misiones">misiones de la semana</a>: también suman.</>);
  } else if (sub === 'competitivo') {
    const D = G.score || [];
    const pide = reqDe(liga, 'competitivo') || 10;
    const dm = (g) => { const v = g && P(g.k) && P(g.k).dm; return v && (g.c || []).includes('competitivo') ? v : null; };
    out.tier1 = Object.values(liga.svs || {}).filter((s) => s.cu && s.cu.c);
    if (f && t) {
      out.datos = [['Score', t.sc ? coma(t.sc) : '—'],
        ['Rango', t.rg ? <span className="rg rk-rg" style={{ background: liga.colorRg(t.rg) }}>{t.rg}</span> : '—'],
        ['Eventos', num(evc(t))], ['Win%', t.wr ? PCT(wr(t)) : '—']];
      const mio = dm(t);
      const ta = arriba ? liga.T[arriba.k] || arriba : null;
      const suyo = dm(ta);
      if (ta && mio && suyo) contra(D.map((d, i) => [d[1], mio[i] || 0, suyo[i] || 0, String]));
      else if (ta) contra([['Score', t.sc || 0, ta.sc || 0, (v) => (v ? coma(v) : '—')], ['Eventos', evc(t), evc(ta), num], ['Win%', wr(t), wr(ta), PCT]]);
      out.notas.push(<>El Score mide la calidad, no la cantidad: {D.map((d, i) => <span key={d[1]}>{i ? ' · ' : ''}{d[1]} <b>{PCT(d[3])}</b></span>)}.</>);
      if (mio && D.length) {
        const ix = mio.map((v, i) => [v, i]);
        const mx = ix.slice().sort((p, q) => q[0] - p[0])[0];
        const mn = ix.slice().sort((p, q) => p[0] - q[0])[0];
        out.notas.push(<>Tu fuerte: <b>{D[mx[1]][1]}</b> ({mx[0]}). Lo más flojo: <b>{D[mn[1]][1]}</b> ({mn[0]}).</>);
        // lo que más te separa del de arriba, pesado por lo que vale cada dimensión; si no hay a quién, lo más flojo
        const gap = suyo ? D.map((d, i) => [i, (suyo[i] - mio[i]) * d[3]]).filter((g) => g[1] > 0).sort((p, q) => q[1] - p[1]) : [];
        const cual = gap.length ? gap[0][0] : mn[1];
        if (DIM_TIP[D[cual][1]]) out.pasos.push(<><b>{D[cual][1]}</b>: {DIM_TIP[D[cual][1]]}</>);
      }
      const conf = G.conf || [];
      const lleno = (conf[conf.length - 1] || [])[0];
      if (lleno && evc(t) < lleno) out.notas.push(<>Con {pl(evc(t), 'evento', 'eventos')}, tu Score todavía se descuenta por confianza: desde {lleno} cuenta entero.</>);
      const rs = (liga.d.rangos || []).slice().sort((p, q) => (p.min || 0) - (q.min || 0));
      const sig = rs.find((r) => (r.min || 0) > (t.sc || 0));
      if (t.rg && sig) out.pasos.push(<>Para el rango <b>{sig.r}</b> te faltan <b>{coma(sig.min - (t.sc || 0))}</b> de Score.</>);
    } else if (t) {
      // 🔒 todavía sin letra: la barra, y no la misma frase de la tira
      out.prog = { va: Math.min(evc(t), pide), de: pide, et: 'eventos en servidores Tier 1' };
      const resto = Math.max(0, pide - evc(t));
      if (resto) out.pasos.push(<>Juega <b>{pl(resto, 'evento', 'eventos')}</b> más en un servidor Tier 1: tu letra sale sola con el {pide}.º.</>);
      if (typeof t.evc === 'number' && t.evc !== t.ev) out.notas.push(<>De tus {t.ev} eventos, {t.evc} son de servidores Tier 1: los otros suman a tu Temporada, no al Competitivo.</>);
    }
  } else if (sub === 'duelos') {
    const g = f ? f.g || 0 : 0;
    const j = f ? f.t || 0 : 0;
    const rd = f && P(f.k) ? P(f.k).rd : null;
    if (f) out.datos = [['Ganados', num(g)], ['Jugados', num(j)], ['Ganó el', PCT(j ? Math.round((100 * g) / j) : 0)]].concat(rd ? [['Mejor racha', rd[1] || 0]] : []);
    if (f && arriba) {
      contra([['Ganados', g, arriba.g || 0, num], ['Jugados', j, arriba.t || 0, num]]);
      out.pasos.push(<>Gana <b>{pl((arriba.g || 0) - g + 1, 'duelo', 'duelos')}</b> más y pasas a {A}.</>);
    }
    out.notas.push(<>Se ordena por <b>ganados</b>: un 1 de 1 da 100&nbsp;% y no dice nada.</>);
    out.notas.push(<>Cuentan sólo los <b>uno contra uno</b> de las llaves: los triples y los de equipos no.</>);
  } else if (sub === 'podios') {
    const m = (g) => [g.oro || 0, g.seg || 0, g.ter || 0];
    if (f) out.datos = [['1.º', m(f)[0]], ['2.º', m(f)[1]], ['3.º', m(f)[2]], ['Semis', f.sem || 0]];
    out.notas.push(<>Se ordena como un <b>medallero</b>: primero los oros, después las platas y después los bronces.</>);
    if (f && arriba) {
      const [o, s, r] = m(f);
      const [oa, sa, ra] = m(arriba);
      contra([['1.º', o, oa, String], ['2.º', s, sa, String], ['3.º', r, ra, String]]);
      if (oa > o) out.pasos.push(<>Gana <b>{pl(oa - o + (s > sa || (s === sa && r > ra) ? 0 : 1), 'evento', 'eventos')}</b> más y pasas a {A}.</>);
      else if (sa > s || (sa === s && ra >= r)) out.pasos.push(<>Con <b>un evento ganado</b> pasas a {A}{sa > s ? <>, o con {pl(sa - s + (r > ra ? 0 : 1), 'segundo puesto', 'segundos puestos')} más</> : null}.</>);
      else out.pasos.push(<>Con <b>un podio más</b> pasas a {A}.</>);
    } else if (!f) out.pasos.push(<>Llega a la final o al tercer puesto de un evento y entras.</>);
  } else if (sub === 'rachas') {
    const [r0, r1] = rch(f);
    if (f) out.datos = [['Ahora', r0], ['La más larga', r1], ['Semis', f.sem || 0], ['Eventos', num(f.ev || 0)]];
    out.notas.push(<>Cuenta eventos <b>seguidos</b> llegando arriba de la llave: la final si es de menos de 16, semis de 16 a 31 y cuartos de 32 a 63.</>);
    if (f && arriba) {
      const [a0, a1] = rch(arriba);
      contra([['Ahora', r0, a0, String], ['La más larga', r1, a1, String]]);
      if (a0 >= r0) out.pasos.push(<>Encadena <b>{pl(a0 - r0 + 1, 'evento', 'eventos')}</b> más y pasas a {A}.</>);
    }
    out.pasos.push(<>Si en tu próximo evento no llegas arriba, la racha vuelve a 0.</>);
  } else if (sub === 'eventos') {
    if (f) out.datos = [['Eventos', num(f.ev || 0)], ['Puntos', num(f.pts || 0)], ['Por evento', num(f.ev ? Math.round((f.pts || 0) / f.ev) : 0)], ['Podios', num(f.pod || 0)]];
    out.notas.push(<>Cuentan los eventos de <b>todos los servidores</b>. A igual cantidad, va primero el de más puntos.</>);
    if (f && arriba) {
      contra([['Eventos', f.ev || 0, arriba.ev || 0, num], ['Puntos', f.pts || 0, arriba.pts || 0, num]]);
      out.pasos.push(<>Juega <b>{pl((arriba.ev || 0) - (f.ev || 0) + ((f.pts || 0) > (arriba.pts || 0) ? 0 : 1), 'evento', 'eventos')}</b> más y pasas a {A}.</>);
    }
    out.pasos.push(<>En <a className="te-link" href="#/eventos">Eventos</a> ves lo que se juega hoy.</>);
  } else if (sub === 'mw') {
    if (f) out.datos = [['Cobró', num(f.pts || 0)], ['Cazó', f.caz || 0], ['Cazado', f.czd || 0], ['Sobrevivió', f.sob || 0]];
    if (f && arriba) {
      contra([['Cobró', f.pts || 0, arriba.pts || 0, num], ['Cazó', f.caz || 0, arriba.caz || 0, String]]);
      out.pasos.push(<>Cobra <b>{num((arriba.pts || 0) - (f.pts || 0) + 1)} pts</b> más y pasas a {A}.</>);
    }
    out.pasos.push(<>Caza a los <b>buscados de esta semana</b>: están arriba de la tabla, con lo que vale cada cabeza.</>);
    out.notas.push(<>Lo que cobras cazando también suma a tu Temporada.</>);
  } else if (sub === 'paises' && f) {
    out.datos = [['Puntos', num(f.pts || 0)], ['Raperos', num(f.n || 0)], ['Por rapero', num(f.n ? Math.round((f.pts || 0) / f.n) : 0)]];
    if (arriba) {
      contra([['Puntos', f.pts || 0, arriba.pts || 0, num], ['Raperos', f.n || 0, arriba.n || 0, num]]);
      out.pasos.push(<>A {nombrePais(f.cc)} le faltan <b>{num((arriba.pts || 0) - (f.pts || 0) + 1)} pts</b> para pasar a {A}.</>);
    }
    out.pasos.push(<>Cada punto que haces en cualquier evento suma a tu país.</>);
  } else if (sub === 'crews') {
    if (f) {
      out.datos = [['Puntos', num(f.pts || 0)], ['Raperos', num(f.n || 0)]];
      if (c.sinPuesto) out.notas.push(<>Para tener puesto, una crew necesita <b>tres raperos</b> en la temporada.</>);
      if (arriba && n) {
        contra([['Puntos', f.pts || 0, arriba.pts || 0, num], ['Raperos', f.n || 0, arriba.n || 0, num]]);
        out.pasos.push(<>A {limpio(f.crew)} le faltan <b>{num((arriba.pts || 0) - (f.pts || 0) + 1)} pts</b> para pasar a {A}.</>);
      }
      out.pasos.push(<>Cada lunes sube, baja o se mantiene de tier según lo que sumó en la semana.</>);
    } else out.pasos.push(<>Súmate a una crew o funda la tuya en <a className="te-link" href="#/crews">Crews</a>: lo que sumas, suma a tu crew.</>);
  }
  if (f && !arriba && n === 1) out.notas.unshift(c.grupo === 'pais' ? <>Tu país es el <b>#1</b>.</> : c.grupo === 'crew' ? <>Tu crew es la <b>#1</b>.</> : <>Eres el <b>#1</b> de este ranking.</>);
  return out;
}

export function Porque({ sub, c, n, titulo, linea }) {
  const dlg = useRef(null);
  const [abierto, setAbierto] = useState(false);
  const [perf, setPerf] = useState(() => (typeof window !== 'undefined' && window.PERF) || null);
  // las dimensiones y la racha de duelos viven en los perfiles: se piden al abrir, y sólo donde hacen falta
  useEffect(() => {
    if (!abierto || perf || !['competitivo', 'duelos'].includes(sub) || typeof window.perfiles !== 'function') return undefined;
    let vivo = true;
    Promise.resolve(window.perfiles()).then((d) => { if (vivo && d) setPerf(d); }).catch(() => {});
    return () => { vivo = false; };
  }, [abierto, sub, perf]);
  useEffect(() => { if (abierto && dlg.current && !dlg.current.open) dlg.current.showModal(); }, [abierto]);
  const x = explicar(sub, { ...c, perf });
  if (!x.datos.length && !x.prog && !x.notas.length && !x.pasos.length) return null;
  const cerrar = () => { if (dlg.current) dlg.current.close(); };
  return (
    <>
      <button type="button" className="rk-pq-b" aria-haspopup="dialog" onClick={() => setAbierto(true)}>
        <Ico n="guia" t={15} />{n ? 'Por qué estás #' + n + ' y cómo subir' : 'Cómo entrar y subir'}
      </button>
      {abierto ? (
        <dialog className="pn-pop rk-pq-pop" ref={dlg} aria-label={titulo} onClose={() => setAbierto(false)}
          onClick={(e) => { if (e.target === dlg.current) cerrar(); }}>
          <PopCab ico="ranking" t={titulo} sub={linea} cerrar={cerrar} />
          <div className="rk-pq-in">
            {x.datos.length ? (
              <section><span className="rk-pq-t">TUS NÚMEROS</span>
                <dl className={'rk-pq-dat n' + x.datos.length}>{x.datos.map(([dt, dd]) => <div key={dt}><dt>{dt}</dt><dd>{dd}</dd></div>)}</dl>
              </section>
            ) : null}
            {x.prog ? (
              <section><span className="rk-pq-t">PARA ENTRAR</span>
                <div className="rk-pq-prog"><b>{x.prog.va} / {x.prog.de}</b><span>{x.prog.et}</span>
                  <i><u style={{ width: Math.round((100 * x.prog.va) / (x.prog.de || 1)) + '%' }} /></i></div>
              </section>
            ) : null}
            {x.contra ? (
              <section><span className="rk-pq-t">TÚ CONTRA {String(x.contra.nombre).toUpperCase()} (#{x.contra.n})</span>
                <table className="rk-pq-vs">
                  <thead><tr><th scope="col"><span className="rk-pq-oc">Qué</span></th><th scope="col">Tú</th><th scope="col">#{x.contra.n}</th></tr></thead>
                  <tbody>{x.contra.filas.map(([q, a, b, fmt]) => (
                    <tr key={q}><th scope="row">{q}</th><td className={a > b ? 'g' : ''}>{fmt(a)}</td><td className={b > a ? 'g' : ''}>{fmt(b)}</td></tr>
                  ))}</tbody>
                </table>
              </section>
            ) : null}
            {x.notas.length ? (
              <section><span className="rk-pq-t">POR QUÉ</span><ul className="rk-pq-l">{x.notas.map((t, i) => <li key={i}>{t}</li>)}</ul></section>
            ) : null}
            {x.pasos.length ? (
              <section><span className="rk-pq-t">CÓMO SUBIR</span><ol className="rk-pq-pasos">{x.pasos.slice(0, 4).map((t, i) => <li key={i}>{t}</li>)}</ol></section>
            ) : null}
            {x.tier1 && x.tier1.length ? (
              <section><span className="rk-pq-t">CUENTAN PARA EL COMPETITIVO · TIER 1</span>
                <ul className="rk-pq-sv">{x.tier1.map((s) => (
                  <li key={s.sv} style={{ '--c': s.color || '#29B298' }}>
                    {s.invita ? <a href={s.invita} target="_blank" rel="noopener noreferrer" aria-label={'Entrar a ' + (s.nombre || s.sv) + ' en Discord'}>
                      <img alt="" src={c.liga.logo(s.sv)} /><b>{siglaDe(s.sv)}</b><small>Entrar ↗</small></a>
                      : <span><img alt="" src={c.liga.logo(s.sv)} /><b>{siglaDe(s.sv)}</b></span>}
                  </li>
                ))}</ul>
                <a className="btn borde2 chico rk-pq-soc" href="#/socios" onClick={cerrar}>Ver los tiers en Socios</a>
              </section>
            ) : null}
          </div>
        </dialog>
      ) : null}
    </>
  );
}
