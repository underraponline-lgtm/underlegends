// 🧭 POR QUÉ ESTÁS AHÍ Y CÓMO SUBIR, EN CADA RANKING (Dlx, 13/11/2026: «explicar en un texto las razones de ese puesto y
// cómo subir o mejorar para cada ranking… esto en cada ranking»). Va adentro de «TU LUGAR» (`TuTira` de ranking.jsx),
// plegado: un botón que lo abre y se acuerda (`lg:rk-porque`), así la cabecera del Ranking no crece para quien no lo
// pide (Dlx, 02/10/2026: «la cosa no es sobrecargar»).
//
// ⚠️ TODO SALE DE UN DATO, nada escrito a mano que se pueda quedar viejo:
// - los pesos del OVR y del Score, la confianza y los puntos por puesto, de `guia` (el payload: `sheet/ovr.py` y
//   `sheet/competitivo.py`), lo mismo que muestra la Guía;
// - las letras y su mínimo, de `rangos` (comun/rangos.py); los multiplicadores de la semana, de `mult`;
// - las cinco dimensiones de cada uno, de su perfil (`/api/perfiles`, `p[k].dm`), y sólo con la Competitiva
//   desbloqueada, la misma regla del perfil (Dlx, 07/10/2026);
// - que el Competitivo cuenta sólo los eventos de Tier 1, de los socios (`svs[].cu`, Socios 4.98).
// Y se compara contra QUIEN TIENES ARRIBA, cosa por cosa: «por qué» es en qué te gana, «cómo subir» es lo que más pesa
// de eso.
import { useEffect, useState } from 'react';
import { limpio, num, siglaDe } from './liga.js';
import { Ico, nombrePais } from './piezas.jsx';

const pct = (x) => parseFloat(String(x == null ? '' : x).replace(',', '.')) || 0;
const coma = (x, d = 1) => Number(x || 0).toFixed(d).replace('.', ',');
const wr = (f) => Math.round(pct(f && f.wr) || 0);
const du = (f) => (f && Array.isArray(f.du) ? f.du : [0, 0]);
const rch = (f) => (f && Array.isArray(f.rch) ? f.rch : [0, 0]);
const y = (xs) => (xs.length > 1 ? xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1] : xs[0] || '');
const pl = (n, uno, varios) => num(n) + ' ' + (n === 1 ? uno : varios);

// qué hacer para subir cada dimensión del Score (lo que mide cada una, dicho como acción)
const DIM_TIP = {
  Eficiencia: 'llegar más lejos en cada evento: los de más gente dan más puntos',
  Consistencia: 'llegar a semifinal o más seguido',
  Dominancia: 'ganar eventos',
  Racha: 'encadenar eventos llegando a semifinal o más',
  Diversidad: 'sumar en otros servidores Tier 1, no siempre en el mismo',
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

function leerAbierto() {
  try { return localStorage.getItem('lg:rk-porque') === '1'; } catch (e) { return false; }
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

/** `{por, subir}`: dos listas cortas de renglones. `c` trae todo lo que se sabe de tu lugar en este ranking. */
export function explicar(sub, c) {
  const { liga, f, arriba, n, nombreDe, perf } = c;
  const G = liga.d.guia || {};
  const por = [];
  const subir = [];
  const A = arriba ? <b>{nombreDe(arriba)}</b> : null;
  const nA = arriba ? c.numero(arriba) : 0;

  // ⛔ fuera de concurso: con número estarías ahí
  if (f && f.fc && !c.grupo) {
    const k = c.base.slice(0, c.iYo).filter((g) => c.numero(g)).length + 1;
    por.push(<>No tienes número porque <b>no estás verificado</b>: con tus números estarías <b>#{k}</b>.</>);
    subir.push(<>Verifícate (es tener el rol <b>Miembro</b> en Discord Rap Español) y entras con número.</>);
  }

  if (sub === 'temporada') {
    const pesos = (G.ovr || []).map(([t, p]) => t + ' ' + p + ' %');
    const t = f ? liga.T[f.k] || f : c.yo;
    if (t) por.push(<>Tu OVR es <b>{t.ovr || '—'}</b>: sale de {y(pesos)}, medidos contra el que más tiene de cada cosa.</>);
    // 🙋 fuera de las 200 que viajan: cuánto te falta para entrar a la tabla que se ve
    if (!f && t && t.pos) {
      const ult = c.base.filter((g) => c.numero(g)).slice(-1)[0];
      if (ult && (ult.ovr || 0) > (t.ovr || 0)) subir.push(<>Para entrar a la tabla que se ve te faltan <b>{(ult.ovr || 0) - (t.ovr || 0)} de OVR</b>: el #{c.numero(ult)} tiene {ult.ovr}.</>);
    }
    const cosas = [['Puntos', 'pts', num], ['Eventos', 'ev', num], ['Win%', null, (v) => v + ' %'], ['Podios', 'pod', num]];
    const val = (g, [, campo]) => (campo ? g[campo] || 0 : wr(g));
    if (t && arriba) {
      const ta = liga.T[arriba.k] || arriba;
      const gana = cosas.filter((q) => val(ta, q) > val(t, q));
      const ganas = cosas.filter((q) => val(t, q) > val(ta, q));
      if (gana.length) por.push(<>{A} (#{nA}) te gana en {y(gana.map((q) => q[0] + ' (' + q[2](val(ta, q)) + ' a ' + q[2](val(t, q)) + ')'))}{ganas.length ? <>; tú le ganas en {y(ganas.map((q) => q[0]))}</> : null}.</>);
      // lo que más pesa de lo que te gana
      const peso = Object.fromEntries((G.ovr || []).map(([q, p]) => [q, p]));
      const top = gana.slice().sort((p, q) => (peso[q[0]] || 0) - (peso[p[0]] || 0))[0];
      const [c16, c8] = puntosCampeon(liga);
      const tip = {
        Puntos: <>Lo que más pesa son los <b>Puntos</b>{c16 ? <>: un 1.º en un evento de 16 o más da {num(c16)}{c8 ? <>, y en uno de 8 a 15, {num(c8)}</> : null}</> : null}.</>,
        Eventos: <>Juega más <b>eventos</b>: cada uno cuenta, aunque no ganes.</>,
        'Win%': <>Gana más <b>duelos</b>: el Win% son los ganados sobre los jugados.</>,
        Podios: <>Llega a más <b>podios</b>: la final o el tercer puesto.</>,
      };
      if (top) subir.push(tip[top[0]]);
    }
    const mm = mejorMult(liga);
    if (mm) subir.push(<>Esta semana los eventos de <b>{siglaDe(mm[0])}</b> valen <b>×{String(mm[1]).replace('.', ',')}</b>.</>);
    if (liga.d.mis) subir.push(<>Las <a className="te-link" href="#/ranking/misiones">misiones de la semana</a> también suman a tu Temporada.</>);
  } else if (sub === 'competitivo') {
    const D = G.score || [];
    const t = f ? liga.T[f.k] || f : c.yo;
    const dm = (g) => { const v = perf && perf.p && perf.p[g.k] && perf.p[g.k].dm; return v && (g.c || []).includes('competitivo') ? v : null; };
    if (f && t) {
      por.push(<>Tu Score es <b>{coma(t.sc)}</b>{t.rg ? <>, rango <b>{t.rg}</b></> : null}: mide la calidad, no la cantidad. Sale de {y(D.map((d) => d[1] + ' ' + d[3] + ' %'))}.</>);
      const mio = dm(t);
      if (mio && D.length) {
        const ix = mio.map((v, i) => [v, i]);
        const mx = ix.slice().sort((p, q) => q[0] - p[0])[0];
        const mn = ix.slice().sort((p, q) => p[0] - q[0])[0];
        por.push(<>Tu fuerte: <b>{D[mx[1]][1]}</b> ({mx[0]}). Lo más flojo: <b>{D[mn[1]][1]}</b> ({mn[0]}).</>);
        const ta = arriba ? liga.T[arriba.k] || arriba : null;
        const suyo = ta ? dm(ta) : null;
        // lo que más te separa del de arriba, pesado por lo que vale cada dimensión
        const gap = suyo ? D.map((d, i) => [i, (suyo[i] - mio[i]) * d[3]]).filter((g) => g[1] > 0).sort((p, q) => q[1] - p[1]) : [];
        if (suyo && gap.length) por.push(<>{A} (#{nA}) te gana en {y(gap.slice(0, 2).map(([i]) => D[i][1] + ' (' + suyo[i] + ' a ' + mio[i] + ')'))}.</>);
        const cual = gap.length ? gap[0][0] : mn[1];
        if (DIM_TIP[D[cual][1]]) subir.push(<>Para subir tu <b>{D[cual][1]}</b>: {DIM_TIP[D[cual][1]]}.</>);
      }
      const conf = G.conf || [];
      const lleno = (conf[conf.length - 1] || [])[0];
      if (lleno && (t.ev || 0) < lleno) por.push(<>Con {pl(t.ev || 0, 'evento', 'eventos')}, tu Score todavía se descuenta por confianza: desde {lleno} cuenta entero.</>);
      // la letra siguiente y cuánto le falta
      const rs = (liga.d.rangos || []).slice().sort((p, q) => (p.min || 0) - (q.min || 0));
      const sig = rs.find((r) => (r.min || 0) > (t.sc || 0));
      if (t.rg && sig) subir.push(<>Para el rango <b>{sig.r}</b> te faltan <b>{coma(sig.min - (t.sc || 0))}</b> de Score.</>);
    }
    const t1 = Object.values(liga.svs || {}).filter((s) => s.cu && s.cu.c).map((s) => siglaDe(s.sv));
    if (t1.length) subir.push(<>Para el Competitivo cuentan sólo los eventos de los servidores <b>Tier 1</b>: {y(t1)}.</>);
  } else if (sub === 'duelos') {
    const g = f ? f.g || 0 : 0;
    const j = f ? f.t || 0 : 0;
    if (f) por.push(<>Ganaste <b>{g}</b> de {j} duelos ({j ? Math.round((100 * g) / j) : 0}&nbsp;%). Se ordena por ganados: un 1 de 1 da 100&nbsp;% y no dice nada.</>);
    if (f && arriba) {
      const d = (arriba.g || 0) - g + 1;
      por.push(<>{A} (#{nA}) lleva {arriba.g || 0} de {arriba.t || 0}.</>);
      subir.push(<>Con <b>{pl(d, 'duelo ganado', 'duelos ganados')}</b> más lo pasas.</>);
    }
    subir.push(<>Cuentan sólo los uno contra uno de las llaves: los triples y los de equipos no.</>);
  } else if (sub === 'podios') {
    const m = (g) => [g.oro || 0, g.seg || 0, g.ter || 0];
    if (f) por.push(<>Tienes <b>{pl(m(f)[0], 'primero', 'primeros')}</b>, <b>{pl(m(f)[1], 'segundo', 'segundos')}</b> y <b>{pl(m(f)[2], 'tercero', 'terceros')}</b>. Se ordena como un medallero: primero los oros, después las platas y después los bronces.</>);
    if (f && arriba) {
      const [o, s, t] = m(f);
      const [oa, sa, ta] = m(arriba);
      por.push(<>{A} (#{nA}) tiene {oa}, {sa} y {ta}.</>);
      if (oa > o) subir.push(<>Con <b>{pl(oa - o + (s > sa || (s === sa && t > ta) ? 0 : 1), 'evento ganado', 'eventos ganados')}</b> más lo pasas.</>);
      else if (sa > s || (sa === s && ta >= t)) subir.push(<>Con <b>un evento ganado</b> lo pasas{sa > s ? <>, o con {pl(sa - s + (t > ta ? 0 : 1), 'segundo puesto', 'segundos puestos')} más</> : null}.</>);
      else subir.push(<>Con <b>un podio más</b> lo pasas.</>);
    } else if (!f) subir.push(<>Llega a la final o al tercer puesto de un evento y entras.</>);
  } else if (sub === 'rachas') {
    const [r0, r1] = rch(f);
    if (f) por.push(<>{!r0 ? <>Ahora no llevas racha</> : r0 === 1 ? <>Llevas <b>1</b> evento llegando arriba de la llave</> : <>Llevas <b>{r0}</b> eventos seguidos llegando arriba de la llave</>}; tu mejor racha: <b>{r1}</b>.</>);
    subir.push(<>En tu próximo evento llega a la <b>final</b> (si es de menos de 16), a <b>semis</b> (de 16 a 31) o a <b>cuartos</b> (de 32 a 63): suma 1. Si no, vuelve a 0.</>);
    if (f && arriba) {
      const [a0] = rch(arriba);
      if (a0 >= r0) subir.push(<>Para pasar a {A} (#{nA}) necesitas <b>{pl(a0 - r0 + 1, 'evento seguido', 'eventos seguidos')}</b> más.</>);
    }
  } else if (sub === 'eventos') {
    if (f) por.push(<>Jugaste <b>{pl(f.ev || 0, 'evento', 'eventos')}</b> en la temporada, en todos los servidores. A igual cantidad, va primero el de más puntos.</>);
    if (f && arriba) {
      const d = (arriba.ev || 0) - (f.ev || 0) + ((f.pts || 0) > (arriba.pts || 0) ? 0 : 1);
      por.push(<>{A} (#{nA}) lleva {arriba.ev || 0}.</>);
      subir.push(<>Con <b>{pl(d, 'evento', 'eventos')}</b> más lo pasas. En <a className="te-link" href="#/eventos">Eventos</a> ves lo que se juega hoy.</>);
    }
  } else if (sub === 'mw') {
    if (f) por.push(<>Cobraste <b>{num(f.pts || 0)} pts</b>: cazaste {pl(f.caz || 0, 'buscado', 'buscados')}{f.sob ? <> y sobreviviste {pl(f.sob, 'vez', 'veces')} siendo buscado</> : null}.</>);
    if (f && arriba) subir.push(<>Te faltan <b>{num((arriba.pts || 0) - (f.pts || 0) + 1)} pts</b> para pasar a {A} (#{nA}).</>);
    subir.push(<>Caza a los <b>buscados de esta semana</b>: están arriba de la tabla, con lo que vale cada cabeza. Lo que cobras suma a tu Temporada.</>);
  } else if (sub === 'paises' && f) {
    por.push(<><b>{nombrePais(f.cc)}</b> suma {num(f.pts || 0)} pts con {pl(f.n || 0, 'rapero', 'raperos')}{f.n ? <> ({num(Math.round((f.pts || 0) / f.n))} por rapero)</> : null}.</>);
    if (arriba) subir.push(<>Le faltan <b>{num((arriba.pts || 0) - (f.pts || 0) + 1)} pts</b> para pasar a {A} (#{nA}).</>);
    subir.push(<>Cada punto que haces en cualquier evento suma a tu país.</>);
  } else if (sub === 'crews' && f) {
    por.push(<><b>{limpio(f.crew)}</b> suma {num(f.pts || 0)} pts con {pl(f.n || 0, 'rapero', 'raperos')}.</>);
    if (c.sinPuesto) por.push(<>Para tener puesto una crew necesita <b>tres raperos</b> en la temporada.</>);
    if (arriba && n) subir.push(<>Le faltan <b>{num((arriba.pts || 0) - (f.pts || 0) + 1)} pts</b> para pasar a {A} (#{nA}).</>);
    subir.push(<>Cada lunes sube, baja o se mantiene de tier según lo que sumó en la semana.</>);
  } else if (sub === 'crews') {
    subir.push(<>Súmate a una crew o funda la tuya en <a className="te-link" href="#/crews">Crews</a>: lo que sumas, suma a tu crew.</>);
  }
  if (f && !arriba && n === 1) por.push(c.grupo === 'pais' ? <>Tu país es el <b>#1</b>.</> : c.grupo === 'crew' ? <>Tu crew es la <b>#1</b>.</> : <>Eres el <b>#1</b> de este ranking.</>);
  if (!f && c.lugarTxt) por.unshift(<>{c.lugarTxt}.</>);
  return { por, subir };
}

export function Porque({ sub, c, n }) {
  const [abierto, setAbierto] = useState(leerAbierto);
  const [perf, setPerf] = useState(() => (typeof window !== 'undefined' && window.PERF) || null);
  // las cinco dimensiones viven en los perfiles: se piden sólo para el Competitivo, y sólo al abrir
  useEffect(() => {
    if (!abierto || sub !== 'competitivo' || perf || typeof window.perfiles !== 'function') return undefined;
    let vivo = true;
    Promise.resolve(window.perfiles()).then((d) => { if (vivo && d) setPerf(d); }).catch(() => {});
    return () => { vivo = false; };
  }, [abierto, sub, perf]);
  const { por, subir } = explicar(sub, { ...c, perf });
  if (!por.length && !subir.length) return null;
  const cambiar = () => {
    const v = !abierto;
    setAbierto(v);
    try { localStorage.setItem('lg:rk-porque', v ? '1' : '0'); } catch (e) { /* igual */ }
  };
  return (
    <div className={'rk-pq' + (abierto ? ' abierto' : '')}>
      <button type="button" className="rk-pq-b" aria-expanded={abierto} onClick={cambiar}>
        <Ico n="guia" t={15} />{n ? 'Por qué estás #' + n + ' y cómo subir' : 'Cómo entrar y subir'}<i className="rk-pq-fl" aria-hidden="true" />
      </button>
      {abierto ? (
        <div className="rk-pq-c">
          {por.length ? <div><span className="rk-pq-t">{n ? 'POR QUÉ ESTÁS #' + n : 'DÓNDE ESTÁS'}</span><ul>{por.map((x, i) => <li key={i}>{x}</li>)}</ul></div> : null}
          {subir.length ? <div><span className="rk-pq-t">CÓMO SUBIR</span><ul>{subir.slice(0, 3).map((x, i) => <li key={i}>{x}</li>)}</ul></div> : null}
        </div>
      ) : null}
    </div>
  );
}
