// 🌍 EL RANKING GLOBAL (21/11/2026): todos los que rapean en español en una sola tabla —los Pro, las plazas y la Liga—,
// para compararte con los gigantes y descubrir a los del under. La opción A de la maqueta que eligió Dlx
// (claude.ai/artifact/VY7VeJK7DzN13Jyh9UtMNP, v2), con sus correcciones: *«hazlas más visual»*, *«que sea listado, no
// escalera»*, *«asegúrate a quién metes en cada tag»*, *«¿dónde está Nekroos?»* y *«explicar cómo funciona y por qué estás
// en ese rango, así como los otros rankings»*.
//
// 🔑 LOS DATOS SON UN ESTÁTICO: `/global.json`, que escribe `bot/global_ranking.py` cada lunes (global.yml) y Pages sirve
// gratis. Se baja sólo al abrir esta pestaña. La página no calcula puntos: los lee, y explica con los mismos números
// (`formula` viaja en el json: si cambia un peso, la explicación cambia sola).
// ⚠️ La gente de afuera NO es de la Liga: sus claves (`k`) no son las de la tabla de la Liga. Sólo los de la Liga (`esc`
// 'liga') tienen cara y perfil acá (`hk`, por `liga.quien()`); a los demás, la inicial. Nunca `avNombre()` por nombre: un
// «Snow» de plaza heredaría la cara del «Snow» de la Liga.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bandera, Cara, Ico, accion, nombrePais } from './piezas.jsx';
import { PopCab } from './pop.jsx';
import { capital, limpio, norm } from './liga.js';
import CSS from './css/global.css?inline';
import { usarCss } from './css.js';

usarCss('global', CSS);

// ── los números, en castellano ──
const n1 = (x) => (Math.round((Number(x) || 0) * 10) / 10).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const n2 = (x) => String(Math.round((Number(x) || 0) * 100) / 100).replace('.', ',');
const miles = (x) => (Number(x) || 0).toLocaleString('es-AR');
const plural = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);

const GRUPO = { pro: 'Pro', plaza: 'Plaza', liga: 'Liga' };
const TIPO = {
  rb_internacional: 'Red Bull internacional', fms_internacional: 'FMS internacional', world_cup: 'World Cup', fms_jornada: 'FMS · jornada',
  rb_nacional: 'Red Bull · final nacional', rb_regional: 'Red Bull · regional', plazas_final: 'Final de plazas', independiente: 'Internacional independiente',
  plaza: 'Plaza', liga: 'Liga', liga_chica: 'Liga · evento chico', resto: 'Otro',
};
const RONDA = { final: 'final', semifinal: 'semi', cuartos: 'cuartos', octavos: 'octavos', jornada: 'jornada', grupos: 'grupos', '16avos': '16avos', tercer: '3.er puesto', repechaje: 'repechaje', filtro: 'filtro' };
const ART = { final: 'la final', semifinal: 'la semi', cuartos: 'los cuartos', octavos: 'los octavos', '16avos': 'los 16avos', grupos: 'la fase de grupos', repechaje: 'el repechaje', tercer: 'el 3.er puesto', filtro: 'el filtro' };
const PUESTO = { 1: 'Campeón', 2: 'Finalista', 3: 'Semifinal', MVP: 'MVP de la jornada' };
const PUESTO_MIN = { 1: 'título', 2: 'final', 3: 'semifinal', MVP: 'MVP' };
const RES = { G: 1, GR: 0.67, PR: 0.2 };
// lo que los datos no dicen: un título de ANTES de la T1 (Dlx, 21/11/2026). Sólo para explicar por qué todavía no suma
const ANTES = { nekroos: 'Ganó Red Bull Batalla Perú el 12/09, diez días antes de que arrancara la T1 (22/09): ese título no cuenta acá.' };

const nombre = (g) => capital(limpio(g.n)) || g.n;
const inicial = (g) => ([...limpio(g.n).replace(/[^\p{L}\p{N}]/gu, '')][0] || '?').toUpperCase();
/** el evento con su nombre, sin emojis, sin «(HOY)» y sin el año */
function limpioEv(s) {
  const t = limpio(s);
  if (!t || /^\(?\s*sin t[ií]tulo\s*\)?$/i.test(t)) return 'Evento sin nombre';
  return t.replace(/\(\s*[^)]*HOY\s*\)/i, '').replace(/\s20\d\d(\/\d\d)?(?=\s|$)/g, '').replace(/^[\s_\-–—·.]+|[\s_\-–—·.]+$/g, '').replace(/\s{2,}/g, ' ') || 'Evento sin nombre';
}
/** el «por qué es pro», dicho en palabras */
function porTx(s) {
  if (/^FMS .+ 20\d\d\/\d\d$/.test(s)) return 'Juega la ' + s;
  if (/^FMS Internacional/.test(s)) return 'Jugó la FMS Internacional 2026';
  if (/^Red Bull Batalla Final Internacional/.test(s)) return 'Jugó la Final Internacional de Red Bull 2026';
  if (/^Campeón nacional de Red Bull/.test(s)) return 'Campeón nacional de Red Bull 2026/27';
  if (/^Decidido por/.test(s)) return 'Pro por decisión de la Liga';
  if (/^FMS /.test(s)) return 'Está en la ' + s + ' 2026/27';
  return s;
}
// las fechas del json ya vienen en hora del este («2026-11-21T04:35:00-05:00»): el día es el de la cadena
const DIA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
function diaDe(iso, mas = 0) {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-').map(Number);
  if (!y) return null;
  return new Date(Date.UTC(y, m - 1, d + mas));
}
const ddmm = (f) => (f ? String(f.getUTCDate()).padStart(2, '0') + '/' + String(f.getUTCMonth() + 1).padStart(2, '0') : '');
const diaTx = (f) => (f ? DIA[f.getUTCDay()] + ' ' + ddmm(f) : '');
function proximoLunes(iso) {
  const f = diaDe(iso);
  if (!f) return null;
  const falta = (8 - f.getUTCDay()) % 7 || 7;
  return diaDe(iso, falta);
}
const fechaEv = (iso) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '');

// ── bajar /global.json, una vez ──
let pedido = null;
function useGlobal() {
  const [D, setD] = useState(() => (pedido && pedido.listo) || null);
  const [mal, setMal] = useState(false);
  useEffect(() => {
    if (D) return undefined;
    let vivo = true;
    if (!pedido) {
      pedido = fetch('/global.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
      pedido.then((d) => { pedido.listo = d; }, () => { pedido = null; });
    }
    pedido.then((d) => { if (vivo) setD(d); }, () => { if (vivo) setMal(true); });
    return () => { vivo = false; };
  }, [D]);
  return [D, mal, () => { setMal(false); setD(null); pedido = null; }];
}

/** lo que se calcula una vez por tabla */
function preparar(D, liga) {
  const F = D.formula || {};
  const peso = F.peso || {};
  const G = (D.g || []).map((g, i) => ({ ...g, i, pos: g.p > 0 ? i + 1 : 0, b: (g.b || []).slice().sort((a, b) => b[4] - a[4]), t: g.t || [] }));
  const porK = new Map(G.map((g) => [g.k, g]));
  const cnt = { pro: 0, plaza: 0, liga: 0 };
  const cp = {};
  for (const g of G) {
    cnt[g.esc] = (cnt[g.esc] || 0) + 1;
    const c = g.cc || '';
    cp[c] = (cp[c] || 0) + 1;
    // la cara y el perfil de los de la Liga: su fila de la tabla de la Liga
    if (g.esc === 'liga' && liga && liga.quien) {
      const f = liga.quien(g.n, g.lg);
      g.hk = (f && f.k) || '';
    }
  }
  const paises = Object.entries(cp).filter(([c]) => c).sort((a, b) => b[1] - a[1]);
  if (cp['']) paises.push(['', cp['']]);
  const conPts = G.filter((g) => g.p > 0).length;
  const noJugo = G.filter((g) => !g.jb);
  const sinPts = G.length - conPts - noJugo.length;
  const prov = G.filter((g) => g.jb > 0 && g.nb < 3).length;
  const liga1 = G.find((g) => g.esc === 'liga' && g.p > 0) || null;
  // 🏔️ los gigantes para comparar: el #1 y los mejores de las finales internacionales de FMS y Red Bull (lo dice su `por`)
  const gig = [];
  const uno = G.find((g) => g.esc === 'pro' && g.p > 0);
  if (uno) gig.push(uno);
  for (const g of G) {
    if (gig.length >= 4) break;
    if (g.esc === 'pro' && g.p > 0 && g !== uno && (g.por || []).some((x) => /Internacional/.test(x))) gig.push(g);
  }
  return {
    G, porK, cnt, paises, conPts, noJugo, sinPts, prov, liga1, gig, ev: D.ev || [], peso,
    ronda: F.ronda || {}, mejores: F.mejores || 10, mejoresTit: F.mejores_titulos || 3, flechas: !!D.antes_t,
  };
}

// ── piezas ──
// 📸 la cara: los de la Liga, la de Discord (su perfil); los de afuera, la que subió global_fotos.py a R2 (`ft`), y si la
// imagen no carga, la inicial
function CaraG({ liga, g, cls = '' }) {
  const [mal, setMal] = useState(false);
  if (g.esc === 'liga' && g.hk) return <Cara liga={liga} k={g.hk} nombre={g.n} cls={'gl-cara liga ' + cls} lazy />;
  if (g.ft && !mal) {
    return <span className={'gl-cara foto ' + (g.esc === 'pro' ? 'pro ' : '') + cls}><img alt="" src={g.ft} loading="lazy" decoding="async" onError={() => setMal(true)} /></span>;
  }
  return <span className={'gl-cara ini ' + (g.esc === 'pro' ? 'pro ' : '') + cls} aria-hidden="true">{inicial(g)}</span>;
}
// el retrato recortado de fms.tv (fondo transparente), para el podio y el gigante; sin él, la cara grande
function Retrato({ liga, g, cls = '' }) {
  const [mal, setMal] = useState(false);
  if (g.fr && !mal) return <img className={'gl-retrato ' + cls} alt="" src={g.fr} loading="lazy" decoding="async" onError={() => setMal(true)} />;
  return <CaraG liga={liga} g={g} cls="g" />;
}
function Etiq({ g }) {
  if (g.esc === 'pro') return <span className="gl-ec pro" title={'Es pro porque: ' + (g.por || []).map(porTx).join(' · ')}>Pro</span>;
  return <span className={'gl-ec ' + g.esc}>{GRUPO[g.esc]}</span>;
}
function Marca({ g }) {
  if (!g.jb) return <span className="gl-nojugo">Todavía no jugó en la T1</span>;
  if (g.nb < 3) return <span className="gl-prov" title="Menos de 3 batallas contadas: su puesto todavía se mueve mucho">Provisional</span>;
  return null;
}
function Diez({ g, solo = false, mejores = 10 }) {
  const ganadas = Math.min(g.nb, g.b.length);
  const t = g.nb + ' de ' + mejores + ' batallas contadas: ' + ganadas + ' ganadas' + (g.nb - ganadas ? ', ' + (g.nb - ganadas) + ' perdidas (0 pts)' : '');
  return (
    <span className={'gl-b10' + (solo ? ' solo' : '')} title={t}>
      <span aria-hidden="true">{Array.from({ length: mejores }, (_, k) => <i key={k} className={k < ganadas ? 'si' : k < g.nb ? 'per' : ''} />)}</span>
      {solo ? null : <b>{g.nb} de {mejores}</b>}
    </span>
  );
}
const Sello = ({ nf }) => (nf >= 2 ? <span className="gl-sello ok"><Ico n="ok" t={12} />Verificado · {nf}</span> : <span className="gl-sello uno">Una fuente</span>);
function Mov({ X, g, vacia = false }) {
  if (!g.pos || (vacia && !X.flechas)) return <span className="gl-mov vacio" aria-hidden="true" />;
  if (!X.flechas) return <span className="gl-mov nada" title="Las flechas arrancan con la tabla del lunes">—</span>;
  const m = g.mv;
  if (m === 'n') return <span className="gl-mov nuevo">Nuevo</span>;
  if (m > 0) return <span className="gl-mov sube" title={'Subió ' + m + ' desde el lunes anterior'}>▲{m}</span>;
  if (m < 0) return <span className="gl-mov baja" title={'Bajó ' + -m + ' desde el lunes anterior'}>▼{-m}</span>;
  return <span className="gl-mov igual" title="Igual que el lunes anterior">=</span>;
}
const Pos = ({ g }) => (g.pos ? String(g.pos) : '—');

// ── las frases ──
function rivalDe(X, b) { const r = X.porK.get(b[2]); return r ? nombre(r) : String(b[2] || 'alguien'); }
function dondeTx(X, b) {
  const ev = limpioEv((X.ev[b[0]] || [])[1]);
  const art = ART[b[1]];
  const m = ev.match(/^(.*?) · (Final(?: Nacional)?)$/i);
  if (!art) return 'en ' + ev;
  if (m) return b[1] === 'final' ? 'en la ' + m[2].toLowerCase() + ' de ' + m[1] : 'en ' + art + ' de la ' + m[2] + ' de ' + m[1];
  return 'en ' + art + ' de ' + ev;
}
const verbo = (r, tu) => ({ G: tu ? 'Le ganaste a' : 'Le ganó a', GR: tu ? 'Le ganaste con réplica a' : 'Le ganó con réplica a', PR: tu ? 'Perdiste ajustado con' : 'Perdió ajustado con' }[r] || (tu ? 'Le ganaste a' : 'Le ganó a'));
/** por qué está en ese puesto: su mejor batalla (y el título de ese evento si lo ganó) */
function PorQue({ X, g, tu = false }) {
  if (!g.jb) return ANTES[g.k] || 'Todavía no jugó una batalla de la T1 que leamos.';
  const b = g.b[0];
  if (!b) {
    const t = g.t[0];
    if (t) return (tu ? 'Fuiste ' : 'Fue ') + PUESTO[t[1]].toLowerCase() + ' en ' + limpioEv((X.ev[t[0]] || [])[1]);
    return (tu ? 'Jugaste ' : 'Jugó ') + plural(g.jb, 'batalla', 'batallas') + ' y todavía no ' + (tu ? 'ganaste' : 'ganó') + ' ninguna';
  }
  const camp = g.t.find((t) => t[0] === b[0] && t[1] === 1);
  return <>{verbo(b[3], tu)} <b>{rivalDe(X, b)}</b> {dondeTx(X, b)}{camp ? (tu ? ' y te llevaste el título' : ' y se llevó el título') : ''}</>;
}
/** los factores de una batalla: peso × fuerza del rival × resultado × ronda (+ extras) */
function factores(X, b) {
  const tipo = (X.ev[b[0]] || [])[2];
  const peso = X.peso[tipo] ?? X.peso.resto ?? 0;
  const r = X.porK.get(b[2]);
  const f = r && r.f ? r.f : 1;
  const res = RES[b[3]] || 1;
  const rx = X.ronda[b[1]] || 1;
  const base = peso * f * res * rx;
  return { peso, f, res, rx, base, extra: Math.max(0, b[4] - base), tipo: TIPO[tipo] || tipo || 'Otro' };
}
/** sus puntos agrupados por evento: batallas + título, de mayor a menor */
function porEvento(g) {
  const m = new Map();
  for (const b of g.b) { const x = m.get(b[0]) || { e: b[0], pts: 0, bat: [], tit: null }; x.pts += b[4]; x.bat.push(b); m.set(b[0], x); }
  for (const t of g.t) { const x = m.get(t[0]) || { e: t[0], pts: 0, bat: [], tit: null }; x.pts += t[2]; x.tit = t; m.set(t[0], x); }
  return [...m.values()].sort((a, b) => b.pts - a.pts);
}

// ── ARRIBA: título y podio ──
function Podio({ X, liga, abrir }) {
  const top = X.G.filter((g) => g.pos).slice(0, 3);
  if (top.length < 3) return null;
  const pie = (g) => (
    <button key={g.k} type="button" className={'gl-pod p' + g.pos + (g.fr ? ' con-retrato' : '')} onClick={() => abrir(g)}>
      <Retrato liga={liga} g={g} />
      <b>{nombre(g)}</b>
      <span className="gl-pod-q"><Bandera cc={g.cc} cls="gl-flag" /><Etiq g={g} /></span>
      <em>{n1(g.p)} pts</em>
      <span className="gl-ped">{g.pos}</span>
    </button>
  );
  return <div className="gl-podio" aria-label="El podio">{pie(top[1])}{pie(top[0])}{pie(top[2])}</div>;
}

// ── TU LUGAR: la lista ──
function FilaLb({ X, liga, g, yo, abrir, verPq }) {
  const mia = yo && g === yo;
  const d = yo ? g.p - yo.p : 0;
  return (
    <button type="button" className={'gl-lbf' + (mia ? ' yo' : '')} onClick={() => (mia ? verPq() : abrir(g))}>
      <span className="gl-lbf-n"><Pos g={g} /></span>
      <CaraG liga={liga} g={g} />
      <span className="gl-lbf-q"><b>{nombre(g)}</b><Bandera cc={g.cc} cls="gl-flag" /><Etiq g={g} />{mia ? <span className="gl-tu">Tú</span> : <Marca g={g} />}</span>
      <Mov X={X} g={g} />
      <span className="gl-lbf-p">{n1(g.p)}</span>
      <span className="gl-lbf-d">{mia || !yo ? '' : (d > 0 ? '+' : '−') + n1(Math.abs(d))}</span>
    </button>
  );
}
function TuLugar({ X, liga, yo, sesion, movil, abrir, verPq }) {
  if (!yo) {
    const top = X.G.filter((g) => g.esc === 'liga' && g.pos).slice(0, movil ? 4 : 6);
    const txt = !sesion
      ? ['Entra y mira tu lugar', 'Entra con Discord y te mostramos en qué puesto estás entre los ' + miles(X.G.length) + ', quién está justo arriba y quién justo abajo.']
      : ['Todavía no estás en la tabla', 'Entras con tu primera batalla de la T1 en un evento que leemos: la Liga, una plaza, Red Bull o FMS.'];
    return (
      <div className="gl-caja">
        <h2 className="gl-ch">Tu lugar<small>{sesion ? 'Todavía sin batallas en la T1' : 'Sin cuenta'}</small></h2>
        <div className="gl-sinlugar"><h3>{txt[0]}</h3><p>{txt[1]}</p>
          {sesion ? <a className="btn gl-blanco" href="#/eventos">Ver los próximos eventos</a>
            : <button type="button" className="btn gl-blanco" onClick={accion.entrar}>Entrar con Discord</button>}
        </div>
        {top.length ? (
          <>
            <h3 className="gl-ch gl-ch2">Los de la Liga más arriba<small>de {miles(X.cnt.liga)}</small></h3>
            <div className="gl-lb">{top.map((g) => <FilaLb key={g.k} X={X} liga={liga} g={g} abrir={abrir} verPq={verPq} />)}</div>
          </>
        ) : null}
      </div>
    );
  }
  const r = movil ? 3 : 4;
  const cerca = X.G.slice(Math.max(0, yo.i - r), yo.i + r + 1).filter((g) => g.pos);
  const arriba = yo.i > 0 ? X.G[yo.i - 1] : null;
  const falta = arriba ? arriba.p - yo.p : 0;
  const quedan = 3 - yo.nb;
  return (
    <div className="gl-caja">
      <h2 className="gl-ch">Tu lugar<small>#{yo.pos} de {miles(X.conPts)} con puntos</small></h2>
      <div className="gl-lb" role="list">
        <div className="gl-lb-cab" aria-hidden="true"><span>#</span><span /><span>Rapero</span><span>Semana</span><span>Pts</span><span>vs. tú</span></div>
        {cerca.map((g) => <FilaLb key={g.k} X={X} liga={liga} g={g} yo={yo} abrir={abrir} verPq={verPq} />)}
      </div>
      <div className="gl-porque">
        <p><b>Tu mejor victoria:</b> <PorQue X={X} g={yo} tu />.</p>
        <div className="gl-fila2">
          <Diez g={yo} mejores={X.mejores} />
          <span className="gl-mut2">
            {arriba ? <>{falta < 0.05 ? 'Te separa menos de 0,1 pts del' : <>Te faltan <b>{n1(falta)} pts</b> para el</>} #{arriba.pos} ({nombre(arriba)}).</> : 'Eres el #1.'}
            {quedan > 0 ? <> <b>Te {quedan === 1 ? 'falta 1 batalla contada' : 'faltan ' + quedan + ' batallas contadas'}</b> para dejar de ser provisional.</> : null}
          </span>
        </div>
        <div className="gl-fila2"><button type="button" className="btn gl-blanco gl-sombra" onClick={verPq}><Ico n="guia" t={16} />Por qué estás #{yo.pos} y cómo subir</button></div>
      </div>
    </div>
  );
}

// ── COMPÁRATE CON UN GIGANTE ──
function Gigante({ X, liga, yo, abrir }) {
  const [sel, setSel] = useState(X.gig.length > 1 ? 1 : 0);
  const g = X.gig[Math.min(sel, X.gig.length - 1)];
  const R = yo || X.liga1;
  if (!g || !R) return null;
  const refN = yo ? 'Tú' : nombre(R);
  const evs = porEvento(g);
  const gb = g.b[0] ? g.b[0][4] : 0;
  const yb = R.b[0] ? R.b[0][4] : 0;
  const veces = yb ? Math.round(gb / yb) : 0;
  const tope = X.liga1 ? X.liga1.p : 0;
  let honesto;
  const base = <>Su mejor batalla vale <b>{n1(gb)} pts</b>{yb ? <>; {yo ? <>la tuya, {n1(yb)}: una suya vale como {veces} tuyas</> : <>la mejor de {nombre(R)}, {n1(yb)}: una de {nombre(g)} vale como {veces} de {nombre(R)}</>}</> : null}.</>;
  if (g.p <= tope) honesto = <>{base} Está al alcance si sigues ganando.</>;
  else if (yo && R === X.liga1) honesto = <>{base} <b>Tú eres el techo de la Liga hoy ({n1(tope)}).</b> Para pasarlo hacen falta resultados en eventos grandes: plazas fuertes, Red Bull, FMS.</>;
  else honesto = <>{base} <b>Con la Liga sola no lo alcanzarías:</b> hoy nadie de la Liga pasó de {n1(tope)} ({nombre(X.liga1)}, #{X.liga1.pos}). Para acercarte hacen falta resultados en eventos grandes: plazas fuertes, Red Bull, FMS.</>;
  return (
    <div className="gl-caja">
      <h2 className="gl-ch">Compárate con un gigante<small>Desde la T1, todos en cero</small></h2>
      <div className="gl-chips" role="group" aria-label="Elegir gigante">
        {X.gig.map((x, k) => (
          <button key={x.k} type="button" className="gl-chip" aria-pressed={x === g} onClick={() => setSel(k)}>
            <CaraG liga={liga} g={x} />{nombre(x)} <small>#{x.pos}</small>
          </button>
        ))}
      </div>
      <div className="gl-barras">
        <div className="gl-barra"><CaraG liga={liga} g={g} /><b>{nombre(g)}</b><div className="gl-barra-t"><u style={{ width: '72%' }} /><span>{n1(g.p)}</span></div></div>
        <div className="gl-barra"><CaraG liga={liga} g={R} /><b>{refN}</b>
          <div className="gl-barra-t"><u className="tu" style={{ width: Math.max(0.6, (R.p / g.p) * 72).toFixed(1) + '%' }} /><span>{n1(R.p)}</span></div></div>
      </div>
      <div className="gl-dist"><b>{n1(g.p - R.p)}</b><span>pts de distancia{yo ? '' : ' con el mejor de la Liga'}</span></div>
      {g.por && g.por.length ? <p className="gl-espro-l"><span className="gl-ec pro">Pro</span> {g.por.map(porTx).join(' · ')}.</p> : null}
      <div className="gl-parte">
        <h3 className="gl-ch">De dónde salieron sus {n1(g.p)}</h3>
        <div className="gl-parte-b" aria-hidden="true">{evs.map((x) => <i key={x.e} style={{ flex: x.pts.toFixed(2) + ' 1 0' }} />)}</div>
        <ol>
          {evs.map((x) => {
            const partes = x.bat.map((b) => n1(b[4])).concat(x.tit ? [PUESTO_MIN[x.tit[1]] + ' ' + n1(x.tit[2])] : []);
            const nf = x.bat.length ? Math.min(...x.bat.map((b) => b[5] || 1)) : 0;
            return (
              <li key={x.e}><i /><button type="button" className="gl-lnk-s" onClick={() => abrir(g)}>{limpioEv((X.ev[x.e] || [])[1])} <small>· {plural(x.bat.length, 'victoria', 'victorias')}: {partes.join(' + ')}</small></button>
                <em>{x.bat.length ? <Sello nf={nf} /> : null}</em><b>{n1(x.pts)}</b></li>
            );
          })}
        </ol>
      </div>
      <div className="gl-lugares">
        <div className="gl-lug-f"><b>{nombre(g)}</b><Diez g={g} mejores={X.mejores} /></div>
        <div className="gl-lug-f"><b>{refN}</b><Diez g={R} mejores={X.mejores} /></div>
      </div>
      <p className="gl-honesto">{honesto}</p>
    </div>
  );
}

// ── LA TABLA ──
function Fila({ X, liga, g, yo, abrir }) {
  const mia = yo && g === yo;
  return (
    <button type="button" className={'gl-fila' + (g.pos && g.pos <= 3 ? ' p' + g.pos : '') + (mia ? ' yo' : '')} onClick={() => abrir(g)}>
      <span className="gl-f-pos"><b className={g.pos ? '' : 'cero'}><Pos g={g} /></b><Mov X={X} g={g} vacia /></span>
      <span className="gl-f-q"><CaraG liga={liga} g={g} />
        <span className="gl-f-tx">
          <span className="gl-f-n"><b>{nombre(g)}</b><Bandera cc={g.cc} cls="gl-flag" /><Etiq g={g} />{mia ? <span className="gl-tu">Tú</span> : null}<Marca g={g} /></span>
          <span className="gl-f-por"><PorQue X={X} g={g} tu={mia} /></span>
          {g.jb ? <span className="gl-f-cel"><Diez g={g} mejores={X.mejores} /></span> : null}
        </span>
      </span>
      <span className="gl-f-b10">{g.jb ? <Diez g={g} mejores={X.mejores} /> : null}</span>
      <span className={'gl-f-pts' + (g.p ? '' : ' cero')}>{g.jb ? n1(g.p) : '—'}</span>
      <span className="gl-f-ab" aria-hidden="true"><Ico n="flecha" t={14} /></span>
    </button>
  );
}
function Tabla({ X, liga, yo, sesion, movil, abrir, filtro, setFiltro }) {
  const tam = movil ? 10 : 14;
  const q = norm(filtro.q.trim());
  const L = useMemo(() => X.G.filter((g) => (filtro.g === 'todos' || g.esc === filtro.g)
    && (filtro.pais === 'todos' || (g.cc || '') === filtro.pais)
    && (!filtro.sinProv || g.nb >= 3)
    && (!q || norm(g.n).includes(q))), [X, filtro.g, filtro.pais, filtro.sinProv, q]);
  const npag = Math.max(1, Math.ceil(L.length / tam));
  const yoEn = yo ? L.indexOf(yo) : -1;
  // `pag: -1` es «la página donde estás» («Ir a mi lugar»)
  const pag = Math.min(filtro.pag === -1 ? (yoEn >= 0 ? Math.floor(yoEn / tam) : 0) : filtro.pag, npag - 1);
  const de = pag * tam;
  const vis = L.slice(de, de + tam);
  const ir = (d) => setFiltro({ ...filtro, pag: Math.max(0, Math.min(npag - 1, pag + d)) });
  return (
    <div className="gl-tb">
      <div className="gl-tb-cab" aria-hidden="true"><span>#</span><span>Rapero · su mejor victoria</span><span>Batallas</span><span>Puntos</span><span /></div>
      {vis.length ? vis.map((g) => <Fila key={g.k} X={X} liga={liga} g={g} yo={yo} abrir={abrir} />)
        : <p className="gl-vacio">Nadie con esos filtros. Prueba con otro país o con «Todos».</p>}
      {vis.length && yoEn >= 0 && !vis.includes(yo) ? (
        <>
          <div className="gl-corte">· · · {miles(Math.abs(yoEn - (yoEn > de ? de + tam : de)))} puestos · · ·</div>
          <Fila X={X} liga={liga} g={yo} yo={yo} abrir={abrir} />
        </>
      ) : null}
      {vis.length && !yo ? (
        <>
          <div className="gl-corte">· · ·</div>
          <div className="gl-fila-cta">{sesion ? <><b>Tu fila va acá</b> en cuanto juegues tu primera batalla de la T1 en un evento que leemos.</>
            : <><b>Tu fila va acá.</b> Entra con Discord y queda fija abajo de la tabla, estés donde estés.</>}</div>
        </>
      ) : null}
      <div className="gl-pag">
        <span>{L.length ? miles(de + 1) + '–' + miles(Math.min(de + tam, L.length)) + ' de ' + miles(L.length) : '0 de 0'}</span>
        <div>
          <button type="button" className="btn gl-borde chico" disabled={pag === 0} onClick={() => ir(-1)}>Anterior</button>
          <button type="button" className="btn gl-borde chico" disabled={pag >= npag - 1} onClick={() => ir(1)}>Siguiente</button>
        </div>
      </div>
      <ul className="gl-ley" aria-label="Qué significa cada marca">
        <li><span className="gl-ley-g"><span className="gl-ec pro">Pro</span><span className="gl-ec plaza">Plaza</span><span className="gl-ec liga">Liga</span></span><span>su grupo: toca su fila y la ficha dice por qué es pro</span></li>
        {X.liga1 ? <li><Diez g={X.liga1} solo mejores={X.mejores} /><span>las {X.mejores} batallas que cuentan</span></li> : null}
        <li><span className="gl-prov">Provisional</span><span>menos de 3 batallas (hoy {miles(X.prov)})</span></li>
        <li><span className="gl-mov sube">▲3</span><span className="gl-mov baja">▼2</span><span>puestos desde el lunes anterior</span></li>
        <li><span className="gl-sello ok"><Ico n="ok" t={12} />Verificado</span><span>2 fuentes o más</span></li>
        <li><span className="gl-sello uno">Una fuente</span><span>un solo lugar lo dice</span></li>
      </ul>
    </div>
  );
}
function Herramientas({ X, yo, filtro, setFiltro }) {
  const pon = (c) => setFiltro({ ...filtro, ...c, pag: 0 });
  const gru = (v, t, n) => (
    <button type="button" className="gl-gru" aria-pressed={filtro.g === v} onClick={() => pon({ g: v })}>
      {v !== 'todos' ? <span className={'gl-ec ' + v}>{t}</span> : <small>{t}</small>}<b>{miles(n)}</b>
    </button>
  );
  return (
    <div className="gl-herr">
      <label className="gl-busca"><Ico n="buscar" t={16} />
        <input type="search" value={filtro.q} onChange={(e) => pon({ q: e.target.value })} placeholder="Buscar rapero" aria-label="Buscar rapero" enterKeyHint="search" />
      </label>
      <div className="gl-grupos" role="group" aria-label="Grupo">
        {gru('todos', 'Todos', X.G.length)}{gru('pro', 'Pro', X.cnt.pro)}{gru('plaza', 'Plaza', X.cnt.plaza)}{gru('liga', 'Liga', X.cnt.liga)}
      </div>
      <select className="gl-sel" value={filtro.pais} onChange={(e) => pon({ pais: e.target.value })} aria-label="País">
        <option value="todos">Todos los países</option>
        {X.paises.map(([c, n]) => <option key={c || 'sin'} value={c}>{c ? nombrePais(c) : 'Sin país'} · {miles(n)}</option>)}
      </select>
      <button type="button" className="gl-tog" aria-pressed={filtro.sinProv} onClick={() => pon({ sinProv: !filtro.sinProv })}><i />Sin provisionales</button>
      {yo ? <button type="button" className="gl-lnk gl-mio" onClick={() => setFiltro({ g: 'todos', pais: 'todos', sinProv: false, q: '', pag: -1 })}>Ir a mi lugar · #{yo.pos}</button> : null}
    </div>
  );
}
function QueEs({ X }) {
  const C = [
    ['#', X.flechas ? 'Su puesto en la T1. Debajo, cuántos puestos subió o bajó desde el lunes anterior. Con 0 pts va «—».' : 'Su puesto en la T1. Desde el próximo lunes, debajo, cuántos puestos subió o bajó en la semana. Con 0 pts va «—».'],
    ['Rapero', 'Su grupo (Pro, Plaza o Liga), su país y por qué está ahí: su mejor batalla.'],
    ['Batallas', 'Cuántas de sus ' + X.mejores + ' mejores ya llenó. Con menos de 3 es «provisional»: su puesto todavía se mueve mucho.'],
    ['Puntos', 'Sus ' + X.mejores + ' mejores batallas más sus ' + X.mejoresTit + ' mejores títulos. Cómo vale cada batalla, en «¿Cómo funciona?», abajo.'],
  ];
  return (
    <details className="gl-qe"><summary>¿Qué es cada columna?</summary>
      <dl>{C.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}</dl>
    </details>
  );
}
function Rail({ X, liga, yo, D, abrir, setFiltro }) {
  const sub = X.flechas ? X.G.filter((g) => typeof g.mv === 'number' && g.mv > 0).sort((a, b) => b.mv - a.mv || a.i - b.i).slice(0, 4) : [];
  const plz = X.G.filter((g) => g.esc === 'plaza' && g.pos).slice(0, 5);
  const paisR = (yo && yo.cc) || (X.paises[0] && X.paises[0][0]) || '';
  const pais3 = paisR ? X.G.filter((g) => g.cc === paisR && g.pos).slice(0, 3) : [];
  const nPais = (X.paises.find((x) => x[0] === paisR) || [0, 0])[1];
  const lunes = proximoLunes(D.t);
  const Mini = ({ g, der, sub: s }) => (
    <div className="gl-mini"><CaraG liga={liga} g={g} />
      <button type="button" className="gl-mini-n" onClick={() => abrir(g)}><b><span>{nombre(g)}</span><Bandera cc={g.cc} cls="gl-flag" /></b><small>{s}</small></button>{der}</div>
  );
  return (
    <aside className="gl-rail">
      <section><div className="gl-sec-t"><h3>Los que más subieron</h3><small>Semana</small></div>
        {sub.length ? sub.map((g) => <Mini key={g.k} g={g} sub={'#' + g.pos} der={<Mov X={X} g={g} />} />)
          : <div className="gl-fecha-c"><b>{ddmm(lunes)}</b><p>{X.flechas ? 'Esta semana nadie subió puestos todavía.' : <>Esta es la <b>primera tabla</b> de la T1. El lunes sale la segunda y acá aparecen los que más puestos subieron.</>}</p></div>}
      </section>
      {plz.length ? (
        <section><div className="gl-sec-t"><h3>Lo mejor de plaza</h3><small>Fuera de la Liga</small></div>
          {plz.map((g) => <Mini key={g.k} g={g} sub={'#' + g.pos + ' · ' + n1(g.p) + ' pts'}
            der={<a className="gl-inv-ico" href="#/invitar" aria-label={'Invitar a ' + nombre(g) + ' a la Liga'} title="Invitar a la Liga"><Ico n="seguir" t={16} /></a>} />)}
          <p className="gl-rail-p">¿Conoces a alguno? Mándale tu link de <a className="gl-lnk-i" href="#/invitar">Invita y gana</a>.</p>
        </section>
      ) : null}
      {pais3.length ? (
        <section><div className="gl-sec-t"><h3>Lo mejor de {nombrePais(paisR)}</h3><small>{yo ? 'Tu país' : 'El país con más gente'}</small></div>
          {pais3.map((g) => <Mini key={g.k} g={g} sub={'#' + g.pos + ' · ' + n1(g.p) + ' pts'} der={<Etiq g={g} />} />)}
          <button type="button" className="gl-lnk" onClick={() => setFiltro({ g: 'todos', pais: paisR, sinProv: false, q: '', pag: 0 })}>Ver los {miles(nPais)} de {nombrePais(paisR)}</button>
        </section>
      ) : null}
      {X.noJugo.length ? (
        <section><div className="gl-sec-t"><h3>Todavía no jugaron en la T1</h3><small>Pros</small></div>
          {X.noJugo.map((g) => <Mini key={g.k} g={g} sub={ANTES[g.k] ? 'Ganó Red Bull Perú el 12/09, antes de la T1' : porTx((g.por || [])[0] || '')} der={<Etiq g={g} />} />)}
        </section>
      ) : null}
    </aside>
  );
}

// ── ¿CÓMO FUNCIONA? ──
function Como({ X, liga, D, verGrupo }) {
  const uno = X.G[0];
  const b = uno && uno.b[0];
  const x = b ? factores(X, b) : null;
  const fu = D.fu || {};
  const L = [['La Liga', 'eventos de Discord de la Liga y sus socios', 'liga'], ['YouTube', 'canales de plazas y ligas', 'youtube'], ['Freestylestats', 'llaves de torneos', 'fstats'],
    ['UrbanStreet', 'resultados de plazas', 'urbanstreet'], ['fms.tv', 'jornadas FMS, voto por voto', 'fms']].map(([n, s, k]) => [n, s, (fu[k] && fu[k].n) || 0]).filter((y) => y[2]);
  const mx = Math.max(1, ...L.map((y) => y[2]));
  const P = X.peso;
  const pesos = [[P.rb_internacional, 'Élite: Red Bull y FMS internacional, World Cup'], [P.fms_jornada, 'Pro nacional: jornadas FMS, finales nacionales de Red Bull'],
    [P.rb_regional, 'Regionales de Red Bull, plazas grandes e internacionales independientes'], [P.plaza, 'Plaza'], [P.liga, 'La Liga: la nuestra y sus socios', 1],
    [P.resto, 'El resto, y los eventos de la Liga de menos de 8']].filter((y) => y[0] != null);
  const ej = (v) => X.G.filter((g) => g.esc === v).slice(0, 3);
  const lunes = proximoLunes(D.t);
  const Grupo = ({ v, regla }) => (
    <div className="gl-grupo">
      <div className="gl-grupo-c"><span className={'gl-ec ' + v}>{GRUPO[v]}</span><b>{miles(X.cnt[v])}</b></div>
      <p>{regla}</p>
      <div className="gl-grupo-q">{ej(v).map((g) => <span key={g.k}><CaraG liga={liga} g={g} />{nombre(g)}</span>)}</div>
      <button type="button" className="gl-lnk" onClick={() => verGrupo(v)}>Ver los {miles(X.cnt[v])} en la tabla</button>
    </div>
  );
  return (
    <section className="gl-esc gl-como gl-in" id="gl-como">
      <div className="gl-sec-t"><h2>¿Cómo funciona?</h2><small>Se actualiza cada lunes · próxima: {diaTx(lunes)}</small></div>
      <div className="gl-como-in">
        <p className="gl-como-lede">Una sola tabla para todos los que rapean en español: la Liga, las plazas y los profesionales. <b>Cuenta sólo la T1, del 22/09 al 31/12:</b> lo de antes no suma, y todos arrancaron en cero. Cada batalla ganada vale según dónde fue, contra quién y en qué ronda.</p>
        {b ? (
          <div>
            <h3>Cómo se cuenta una batalla, con una de verdad</h3>
            <p className="gl-cuenta-t"><b>{nombre(uno)} le ganó a {rivalDe(X, b)}</b> {dondeTx(X, b)}.</p>
            <div className="gl-cuenta">
              <div><small>Peso del evento</small><b>{n2(x.peso)}</b><span>{x.tipo}</span></div><i>×</i>
              <div><small>Fuerza del rival</small><b>{n2(x.f)}</b><span>la de {rivalDe(X, b)}, sobre 10</span></div><i>×</i>
              <div><small>Resultado</small><b>{n2(x.res)}</b><span>{b[3] === 'GR' ? 'ganó con réplica' : 'ganó'}</span></div><i>×</i>
              <div><small>Ronda</small><b>{n2(x.rx)}</b><span>{RONDA[b[1]] || 'ronda'}</span></div><i>+</i>
              <div><small>Extras</small><b>{n1(x.extra)}</b><span>margen de los jueces o ganar fuera de su escena</span></div><i>=</i>
              <div className="tot"><small>Puntos</small><b>{n1(b[4])}</b><span>{b[5] >= 2 ? 'verificado · ' + b[5] + ' fuentes' : 'una fuente'}</span></div>
            </div>
          </div>
        ) : null}
        <ul className="gl-notas3">
          <li><span>×{X.mejores}</span><p><b>Cuentan tus {X.mejores} mejores batallas de la T1.</b> Así nadie sube sólo por jugar mucho. Una perdida cuenta 0 hasta que una victoria la reemplace.</p></li>
          <li><span>+{X.mejoresTit}</span><p><b>Y tus {X.mejoresTit} mejores títulos:</b> cada uno suma la mitad de lo que ganaste en ese camino, más un fijo por batalla ganada. Final, el 40 %; semifinal, el 20 %. El MVP de una jornada FMS cuenta como ganarla.</p></li>
          <li><span><s>vistas</s></span><p><b>No cuenta lo que no se gana rapeando:</b> vistas, seguidores, likes. Tampoco lo de antes del 22/09: Nekroos ganó Red Bull Perú el 12/09 y todavía no suma.</p></li>
        </ul>
        <div>
          <h3>Los tres grupos: dónde compite cada uno</h3>
          <div className="gl-escala" aria-hidden="true">{['pro', 'plaza', 'liga'].map((v) => <i key={v} className={v} style={{ flex: X.cnt[v] + ' 1 0' }}><b>{miles(X.cnt[v])}</b></i>)}</div>
          <div className="gl-tres">
            <Grupo v="pro" regla={<>Juega una liga <b>FMS</b> 2026/27, jugó las finales internacionales de <b>FMS o Red Bull 2026</b>, o es <b>campeón nacional de Red Bull</b> 2026/27.</>} />
            <Grupo v="plaza" regla={<>Todo lo de <b>afuera de la Liga</b> que no es Pro: plazas, torneos independientes, regionales y nacionales de Red Bull sin título.</>} />
            <Grupo v="liga" regla={<>Juega en los <b>eventos de Discord de la Liga</b> y sus socios, verificado con su perfil.</>} />
          </div>
          <p className="gl-txt">El grupo no cambia los puntos de nadie: dice dónde compite. Un Pro y alguien de la Liga se miden con la misma cuenta.</p>
        </div>
        <div className="gl-f3">
          <div><h3>El peso de cada evento</h3>
            <ol className="gl-pesos">{pesos.map(([v, t, c]) => <li key={t}><b>{n2(v)}</b><span>{t}{c ? <> <span className="gl-ec liga">Tu escena</span></> : null}</span></li>)}</ol></div>
          {L.length ? (
            <div><h3>De dónde salen los datos</h3>
              <div className="gl-fu-l">{L.map(([nn, s, v]) => <div key={nn} className="gl-fu"><b>{nn}<small>{s}</small></b><div className="gl-fu-t"><u style={{ width: ((v / mx) * 70).toFixed(1) + '%' }} /><span>{miles(v)}</span></div></div>)}</div>
              <p className="gl-txt">Batallas leídas esta semana. De YouTube se guarda el resultado, nunca las vistas. Con dos fuentes o más, el resultado lleva «verificado».</p></div>
          ) : null}
          <div className="gl-reporte"><h3>¿Ves un error?</h3>
            <p>Todo resultado lleva su fuente. Si uno está mal, avísale al staff en Discord Rap Español con el video o la llave: sale corregido en la tabla del lunes.</p>
            <p className="gl-mut2">Tabla del {diaTx(diaDe(D.t))}. Se recalcula cada lunes.</p></div>
        </div>
      </div>
    </section>
  );
}

// ── LA FICHA ──
function Camino({ X, g, tu }) {
  if (!g.jb) {
    return (
      <div className="gl-nojuega-f"><span className="gl-nojugo">Todavía no jugó en la T1</span><p>{ANTES[g.k] || 'Todavía no jugó una batalla de la T1 que leamos.'}</p>
        <p className="gl-fi-pie">Cuando juegue una jornada de FMS, una final de Red Bull o un evento que leamos, sus batallas aparecen acá y entra a la tabla con su puesto.</p></div>
    );
  }
  const evs = porEvento(g);
  const falta = g.nb - g.b.length;
  return (
    <div className="gl-camino">
      <div className="gl-sec-t"><h3>Por qué {tu ? 'estás' : 'está'} {g.pos ? 'en el #' + g.pos : 'acá'}</h3><small>{n1(g.pb)} pts por batallas · {n1(g.pt)} por títulos</small></div>
      {evs.map((x, k) => {
        const e = X.ev[x.e] || [];
        return (
          <div key={x.e} className="gl-ev">
            <div className="gl-ev-c"><b>{limpioEv(e[1])}</b><small>{TIPO[e[2]] || e[2]} · peso {n2(X.peso[e[2]] ?? X.peso.resto ?? 0)} · {fechaEv(e[3])}</small></div>
            {x.bat.map((b, j) => {
              const f = k === 0 && j === 0 ? factores(X, b) : null;
              return (
                <div key={j} className="gl-bat">
                  <p>{verbo(b[3], tu)} <b>{rivalDe(X, b)}</b>{b[1] && b[1] !== 'jornada' ? ' · ' + (RONDA[b[1]] || b[1]) : ''}</p><Sello nf={b[5] || 1} /><b>+{n1(b[4])}</b>
                  {f ? <span className="gl-fac"><span>{n2(f.peso)} {f.tipo.toLowerCase()}</span>× <span>{n2(f.f)} fuerza de {rivalDe(X, b)}</span>× <span>{n2(f.res)} {b[3] === 'GR' ? 'con réplica' : b[3] === 'PR' ? 'perdió ajustado' : 'ganó'}</span>× <span>{n2(f.rx)} {RONDA[b[1]] || 'ronda'}</span>{f.extra >= 0.05 ? <>+ <span>{n1(f.extra)} de extras</span></> : null}</span> : null}
                </div>
              );
            })}
            {x.tit ? <div className="gl-bat tit"><p>{PUESTO[x.tit[1]]}{x.tit[1] === 3 ? ' (entre los 4)' : ''}</p><span /><b>+{n1(x.tit[2])}</b></div> : null}
          </div>
        );
      })}
      {falta > 0 ? <p className="gl-fi-pie">Y {falta === 1 ? 'una batalla contada que no sumó' : falta + ' batallas contadas que no sumaron'} puntos (perdidas).</p> : null}
      <p className="gl-fi-pie">Cuentan las {X.mejores} mejores batallas de la T1 y los {X.mejoresTit} mejores títulos.</p>
    </div>
  );
}
function Ficha({ X, liga, g, yo, cerrar }) {
  const tu = !!yo && g === yo;
  const otro = X.G.find((x) => x !== g && norm(x.n) === norm(g.n));
  return (
    <div className="gl-ficha">
      <div className="gl-fi-cab"><CaraG liga={liga} g={g} cls="g" />
        <div className="gl-fi-n"><h2>{nombre(g)}</h2><p><Bandera cc={g.cc} cls="gl-flag" />{g.cc ? nombrePais(g.cc) : 'Sin país'} <Etiq g={g} /> <Marca g={g} /></p></div>
        <button type="button" className="gl-cerrar" onClick={cerrar} aria-label="Cerrar la ficha"><Ico n="cerrar" t={16} /></button>
      </div>
      <div className="gl-datos"><div><small>Puesto</small><b>{g.pos ? '#' + g.pos : '—'}</b></div><div><small>Puntos</small><b>{g.jb ? n1(g.p) : '—'}</b></div><div><small>Batallas jugadas</small><b>{g.jb || 0}</b></div></div>
      {g.jb ? <Diez g={g} mejores={X.mejores} /> : null}
      {g.esc === 'pro' && g.por && g.por.length ? (
        <div className="gl-espro"><span className="gl-pq-t">Por qué es pro</span><ul>{g.por.map((t) => <li key={t}>{porTx(t)}</li>)}</ul></div>
      ) : null}
      <Camino X={X} g={g} tu={tu} />
      {otro ? <p className="gl-homo">Hay otro <b>{nombre(otro)}</b> en la tabla: <Bandera cc={otro.cc} cls="gl-flag" /> {otro.cc ? nombrePais(otro.cc) : 'sin país'} · {GRUPO[otro.esc]}{otro.pos ? ' · #' + otro.pos : ''}. La bandera los separa.</p> : null}
      {tu ? null : g.esc === 'liga' ? (
        g.hk ? <div className="gl-homo"><b>Está en la Liga.</b> <a className="gl-lnk" href={'#/r/' + g.hk}>Ver su perfil</a></div> : null
      ) : (
        <div className="gl-invita"><h3>No está en la Liga</h3><p>Invítalo: si se une, sus batallas en la Liga también suman acá y puede pelear el Ranking de la T1.</p>
          <a className="btn" href="#/invitar"><Ico n="seguir" t={16} />Invitar a la Liga</a><small>Con tu link de Invita y gana: si entra, cuenta para ti.</small></div>
      )}
    </div>
  );
}

// ── «POR QUÉ ESTÁS #N Y CÓMO SUBIR» (el pop-up de los otros rankings, porque.jsx) ──
function PorQueEstas({ X, yo, sesion }) {
  const P = X.peso;
  const vPlaza = (P.plaza || 0) * 3 * 1.2;
  const vLiga = (P.liga || 0) * 3 * 1.2;
  if (!yo) {
    return (
      <div className="rk-pq-in">
        <section><span className="rk-pq-t">PARA ENTRAR</span><p>{sesion ? 'Juega una batalla de la T1 en un evento que leemos. Con una alcanza para aparecer.' : 'Entra con Discord: si ya jugaste en la T1, tu lugar aparece al toque.'}</p></section>
        <section><span className="rk-pq-t">CÓMO SUBIR</span>
          <ol className="rk-pq-pasos">
            <li>Juega en eventos que leemos: <b>la Liga</b> (peso {n2(P.liga)}), <b>una plaza</b> ({n2(P.plaza)}) o una <b>plaza grande</b> ({n2(P.rb_regional)}).</li>
            <li>Ganarle a alguien fuerte vale más: la fuerza del rival multiplica.</li>
            <li>Llega lejos: la final vale ×{n2(X.ronda.final || 2)} y la semi ×{n2(X.ronda.semifinal || 1.5)}. Si sales campeón, el título suma aparte.</li>
            <li>Cuentan tus {X.mejores} mejores: juega seguido para llenarlas.</li>
          </ol></section>
      </div>
    );
  }
  const arriba = yo.i > 0 ? X.G[yo.i - 1] : null;
  const best = (g) => (g.b[0] ? g.b[0][4] : 0);
  const tits = (g) => g.t.filter((t) => t[1] === 1).length;
  const b = yo.b[0];
  const f = b ? factores(X, b) : null;
  const notas = [];
  if (b) notas.push(<>Tu mejor batalla: <PorQue X={X} g={yo} tu />. Vale <b>{n1(b[4])}</b>: {n2(f.peso)} ({f.tipo.toLowerCase()}) × {n2(f.f)} (la fuerza de {rivalDe(X, b)}) × {b[1] === 'final' ? n2(f.rx) + ' por ser la final' : n2(f.rx) + ' por la ronda'}{f.extra >= 0.05 ? ', más ' + n1(f.extra) + ' de extras' : ''}.</>);
  yo.b.slice(1, 3).forEach((bb) => notas.push(<>{verbo(bb[3], true)} <b>{rivalDe(X, bb)}</b> {dondeTx(X, bb)}: <b>+{n1(bb[4])}</b>.</>));
  yo.t.filter((t) => t[1] === 1).slice(0, 2).forEach((t) => notas.push(<>Campeón de {limpioEv((X.ev[t[0]] || [])[1])}: <b>+{n1(t[2])}</b> por el título.</>));
  notas.push(<><b>La cuenta entera:</b> tus {yo.nb} batallas que cuentan suman <b>{n1(yo.pb)}</b> y tus títulos suman <b>{n1(yo.pt)}</b>: <b>{n1(yo.p)}</b>.</>);
  if (arriba) notas.push(<>{nombre(arriba)} está arriba por <b>{n1(arriba.p - yo.p)} pts</b>{arriba.b[0] ? <>: su mejor batalla fue {dondeTx(X, arriba.b[0]).replace(/^en /, '')}</> : null}.</>);
  const peor = yo.b.length < yo.nb ? 0 : Math.min(...yo.b.map((bb) => bb[4]));
  const falta = arriba ? arriba.p - yo.p : 0;
  const libres = X.mejores - yo.nb;
  const pasos = [
    libres > 0 ? <>Llena tus {X.mejores}: te {libres === 1 ? 'queda 1 lugar' : 'quedan ' + libres + ' lugares'} y cada victoria suma entera.</>
      : peor < 0.05 ? <>Tus {X.mejores} están llenos, pero hay batallas perdidas adentro: la próxima victoria reemplaza una y suma entera.</>
        : <>Tus {X.mejores} están llenos: una victoria nueva suma lo que le gane a tu peor batalla ({n1(peor)}).</>,
    <>Juega en una plaza: unos cuartos ganados contra alguien de fuerza 3 valen <b>{n1(vPlaza)}</b> en una plaza y <b>{n1(vLiga)}</b> en la Liga.</>,
    <>Ganarle a alguien más fuerte multiplica: la fuerza del rival va de 1 a 10.</>,
    arriba ? <>Para pasar a {nombre(arriba)} (#{arriba.pos}) te {falta < 0.05 ? 'alcanza con cualquier victoria' : <>faltan <b>{n1(falta)} pts</b></>}{falta >= 0.05 && falta < vLiga ? ': una victoria en cuartos de la Liga ya alcanza.' : falta >= 0.05 && falta < vPlaza ? ': una victoria en cuartos de una plaza alcanza.' : '.'}</> : <>Eres el #1: cuida tus {X.mejores} mejores.</>,
  ];
  const filas = arriba ? [['Puntos', yo.p, arriba.p, n1], ['Su mejor batalla', best(yo), best(arriba), n1], ['Batallas que cuentan', yo.nb, arriba.nb, (v) => v + ' de ' + X.mejores], ['Títulos', tits(yo), tits(arriba), String]] : [];
  return (
    <div className="rk-pq-in">
      <section><span className="rk-pq-t">TUS NÚMEROS</span>
        <dl className="rk-pq-dat n4"><div><dt>Puesto</dt><dd>#{yo.pos}</dd></div><div><dt>Puntos</dt><dd>{n1(yo.p)}</dd></div><div><dt>Batallas</dt><dd>{yo.nb}/{X.mejores}</dd></div><div><dt>Títulos</dt><dd>{tits(yo)}</dd></div></dl></section>
      {arriba ? (
        <section><span className="rk-pq-t">TÚ CONTRA {nombre(arriba).toUpperCase()} (#{arriba.pos})</span>
          <table className="rk-pq-vs"><thead><tr><th scope="col"><span className="rk-pq-oc">Qué</span></th><th scope="col">Tú</th><th scope="col">#{arriba.pos}</th></tr></thead>
            <tbody>{filas.map(([q, a, bb, fmt]) => <tr key={q}><th scope="row">{q}</th><td className={a > bb ? 'g' : ''}>{fmt(a)}</td><td className={bb > a ? 'g' : ''}>{fmt(bb)}</td></tr>)}</tbody></table></section>
      ) : null}
      <section><span className="rk-pq-t">POR QUÉ</span><ul className="rk-pq-l">{notas.map((t, k) => <li key={k}>{t}</li>)}</ul></section>
      <section><span className="rk-pq-t">CÓMO SUBIR</span><ol className="rk-pq-pasos">{pasos.map((t, k) => <li key={k}>{t}</li>)}</ol></section>
    </div>
  );
}

// ── un <dialog> que se abre solo al montarse y avisa al cerrarse (Esc, el fondo o la cruz) ──
function Dialogo({ cls, etiqueta, onCerrar, children }) {
  const d = useRef(null);
  useEffect(() => { if (d.current && !d.current.open) d.current.showModal(); }, []);
  const cerrar = () => { if (d.current) d.current.close(); };
  return (
    <dialog className={cls} ref={d} aria-label={etiqueta} onClose={onCerrar} onClick={(e) => { if (e.target === d.current) cerrar(); }}>
      {children(cerrar)}
    </dialog>
  );
}

// ── LA PÁGINA ──
export function RankingGlobal({ liga, dc, movil }) {
  const [D, mal, reintentar] = useGlobal();
  const X = useMemo(() => (D ? preparar(D, liga) : null), [D, liga]);
  const [ficha, setFicha] = useState(null);
  const [pq, setPq] = useState(false);
  const [filtro, setFiltro] = useState({ g: 'todos', pais: 'todos', sinProv: false, q: '', pag: 0 });
  const papel = useRef(null);
  const yoL = liga && liga.yo;
  const yo = X && yoL ? X.G.find((g) => g.esc === 'liga' && g.hk && g.hk === yoL.k && g.pos) || null : null;
  const sesion = !!(dc || yoL);
  if (mal) {
    return (
      <section className="gl-esc gl-in gl-cargando"><p>No pude cargar el ranking global.</p>
        <button type="button" className="btn gl-blanco" onClick={reintentar}>Reintentar</button></section>
    );
  }
  if (!X) return <section className="gl-esc gl-in gl-cargando" aria-busy="true"><p>Cargando el ranking global…</p></section>;
  const verGrupo = (v) => {
    setFiltro({ g: v, pais: 'todos', sinProv: false, q: '', pag: 0 });
    if (papel.current) papel.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const lunes = proximoLunes(D.t);
  return (
    <div className="gl">
      <section className="gl-esc gl-in gl-arriba">
        <div className="gl-top">
          <div className="gl-tit" data-tuto="gl-cab">
            <span className="tag">RANKING GLOBAL · {String(D.temporada || 't1').toUpperCase()}</span>
            <h1 className="gl-h1">Ranking global</h1>
            <p className="gl-lede">Todos los freestylers del habla hispana en una sola tabla: <b>los Pro</b>, <b>las plazas</b> y <b>la Liga</b>. El orden sale de las batallas de la T1: cuentan las {X.mejores} mejores de cada uno y sus {X.mejoresTit} mejores títulos.</p>
            <p className="gl-meta">{X.flechas ? 'Tabla del ' : 'Primera tabla: '}{diaTx(diaDe(D.t))} · cada lunes · próxima: {diaTx(lunes)} · <a className="gl-lnk-e" href="#gl-como" onClick={(e) => { e.preventDefault(); const r = e.currentTarget.getRootNode(); const c = r.getElementById ? r.getElementById('gl-como') : null; if (c) c.scrollIntoView({ behavior: 'smooth' }); }}>¿Cómo funciona?</a></p>
          </div>
          <Podio X={X} liga={liga} abrir={setFicha} />
        </div>
        <div className="gl-dos">
          <TuLugar X={X} liga={liga} yo={yo} sesion={sesion} movil={movil} abrir={setFicha} verPq={() => setPq(true)} />
          <Gigante X={X} liga={liga} yo={yo} abrir={setFicha} />
        </div>
      </section>
      <section className="gl-papel gl-in" aria-label="La tabla" ref={papel}>
        <div className="gl-sec-t"><h2>La tabla entera</h2><small>{miles(X.conPts)} con puntos · {miles(X.sinPts)} sin ganar todavía · {X.noJugo.length} sin jugar</small></div>
        <QueEs X={X} />
        <Herramientas X={X} yo={yo} filtro={filtro} setFiltro={setFiltro} />
        <div className="gl-tabla-y">
          <Tabla X={X} liga={liga} yo={yo} sesion={sesion} movil={movil} abrir={setFicha} filtro={filtro} setFiltro={setFiltro} />
          <Rail X={X} liga={liga} yo={yo} D={D} abrir={setFicha} setFiltro={setFiltro} />
        </div>
      </section>
      <Como X={X} liga={liga} D={D} verGrupo={verGrupo} />
      {ficha ? (
        <Dialogo key={ficha.k} cls="gl-lado" etiqueta={'Ficha de ' + nombre(ficha)} onCerrar={() => setFicha(null)}>
          {(cerrar) => <Ficha X={X} liga={liga} g={ficha} yo={yo} cerrar={cerrar} />}
        </Dialogo>
      ) : null}
      {pq ? (
        <Dialogo cls="pn-pop rk-pq-pop" etiqueta={yo ? 'Por qué estás #' + yo.pos + ' y cómo subir' : 'Cómo entrar y subir'} onCerrar={() => setPq(false)}>
          {(cerrar) => <>
            <PopCab ico="ranking" t={yo ? 'Por qué estás #' + yo.pos + ' y cómo subir' : 'Cómo entrar y subir'} sub={'Ranking global · ' + miles(X.conPts) + ' con puntos'} cerrar={cerrar} />
            <PorQueEstas X={X} yo={yo} sesion={sesion} />
          </>}
        </Dialogo>
      ) : null}
    </div>
  );
}
