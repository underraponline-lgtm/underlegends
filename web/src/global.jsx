// 🌍 EL RANKING GLOBAL (21/11/2026): todos los que rapean en español en una sola tabla —los Pro, las plazas y la Liga—,
// para compararte con los gigantes y descubrir a los del under.
//
// 🥊 LA VELADA (v3, 21/11/2026): Dlx eligió *«A + Arma un bloque»* de la maqueta v3. La página es una cartelera de
// boxeo: el afiche con el podio recortado encima del título, **tu pelea** pegada al afiche (tú contra el de arriba, lo
// que te falta y tus 10 batallas como talones), el gigante cara a cara, la tabla entera en papel y, abajo, «¿Cómo
// funciona?» con una batalla de verdad desarmada y una que armas tú y entra en tus 10 echando a la más chica.
//
// 🔑 LOS DATOS SON UN ESTÁTICO: `/global.json`, que escribe `bot/global_ranking.py` cada lunes (global.yml) y Pages sirve
// gratis. Se baja sólo al abrir esta pestaña. La página no calcula puntos: los lee, y explica con los mismos números
// (`formula` viaja en el json: si cambia un peso, la explicación y el bloque que armas cambian solos).
// ⚠️ La gente de afuera NO es de la Liga: sus claves (`k`) no son las de la tabla de la Liga. Sólo los de la Liga (`esc`
// 'liga') tienen cara y perfil acá (`hk`, por `liga.quien()`); a los demás, su foto (`ft`) o la inicial. Nunca
// `avNombre()` por nombre: un «Snow» de plaza heredaría la cara del «Snow» de la Liga.
// ⚠️ `b` trae sólo las batallas que suman (`pts > 0`, global_ranking.py): las que faltan para llegar a `nb` son perdidas
// que cuentan 0. Por eso un talón roto es «perdida» y nunca «otra sin detalle».
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
const cap1 = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const min1 = (s) => (/^(Jornada|Final|Regional|Internacional|Plaza|Otro)\b/.test(s || '') ? s[0].toLowerCase() + s.slice(1) : s);
const quieto = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

const GRUPO = { pro: 'Pro', plaza: 'Plaza', liga: 'Liga' };
const TIPO = {
  rb_internacional: 'Red Bull internacional', fms_internacional: 'FMS internacional', world_cup: 'World Cup', fms_jornada: 'Jornada FMS',
  rb_nacional: 'Final nacional de Red Bull', rb_regional: 'Regional de Red Bull', plazas_final: 'Final de plazas', independiente: 'Internacional independiente',
  plaza: 'Plaza', liga: 'Liga', liga_chica: 'Liga, evento chico', resto: 'Otro',
};
// el grupo de un evento, para la trama del bloque y de la barra del gigante: 2 macizo (pro), 1 rayado (plaza), 0 punteado (Liga)
const PRO_EV = ['rb_internacional', 'fms_internacional', 'world_cup', 'fms_jornada', 'rb_nacional'];
const grupoEv = (tipo) => (/^liga/.test(tipo || '') ? 0 : PRO_EV.includes(tipo) ? 2 : 1);
const RONDA = { final: 'final', semifinal: 'semi', cuartos: 'cuartos', octavos: 'octavos', jornada: 'jornada', grupos: 'grupos', '16avos': '16avos', tercer: '3.er puesto', repechaje: 'repechaje', filtro: 'filtro' };
const ART = { final: 'la final', semifinal: 'la semi', cuartos: 'los cuartos', octavos: 'los octavos', '16avos': 'los 16avos', grupos: 'la fase de grupos', repechaje: 'el repechaje', tercer: 'el 3.er puesto', filtro: 'el filtro' };
const PUESTO = { 1: 'Campeón', 2: 'Finalista', 3: 'Semifinal', MVP: 'MVP de la jornada' };
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
      // ⏳ CON PLAZO (21/11/2026, revisión de robustez): colgado, el pedido no fallaba nunca y la página no llegaba a decir
      // que no pudo (`mal`) ni a dejar reintentar. A los 20 s se corta (`AbortController` + `setTimeout`, no
      // `AbortSignal.timeout`: Safari viejo) y es un fallo más: se suelta, y el próximo intento vuelve a pedir
      const ctl = typeof AbortController === 'function' ? new AbortController() : null;
      const plazo = setTimeout(() => { if (ctl) ctl.abort(); }, 20000);
      const este = fetch('/global.json', { cache: 'no-cache', signal: ctl ? ctl.signal : undefined })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .finally(() => clearTimeout(plazo));
      pedido = este;
      este.then((d) => { este.listo = d; }, () => { if (pedido === este) pedido = null; });
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
/** sus 10 como talones: las que suman (de mayor a menor), las perdidas que cuentan 0 y los lugares libres */
function bloques(g, mejores) {
  const bat = g.b.map((b, j) => ({ t: 'b', j, pts: b[4], b }));
  for (let k = g.b.length; k < g.nb; k++) bat.push({ t: 'p', j: k, pts: 0 });
  return { bat, libres: Math.max(0, mejores - g.nb) };
}
const best = (g) => (g.b[0] ? g.b[0][4] : 0);

// ── piezas ──
// 📸 la cara: los de la Liga, la de Discord (su perfil); los de afuera, la que subió global_fotos.py a R2 (`ft`), y si la
// imagen no carga, la inicial
function CaraG({ liga, g, cls = '', grande = false }) {
  const [mal, setMal] = useState(false);
  if (g.esc === 'liga' && g.hk) return <Cara liga={liga} k={g.hk} nombre={g.n} cls={'gl-cara liga ' + cls} lazy grande={grande} />;
  if (g.ft && !mal) {
    return <span className={'gl-cara foto ' + (g.esc === 'pro' ? 'pro ' : '') + cls}><img alt="" src={g.ft} loading="lazy" decoding="async" onError={() => setMal(true)} /></span>;
  }
  return <span className={'gl-cara ini ' + (g.esc === 'pro' ? 'pro ' : '') + cls} aria-hidden="true">{inicial(g)}</span>;
}
// 🎭 el retrato de fms.tv (396×520, fondo transparente) recortado arriba: abajo trae el nombre pintado, y ese lo dice la
// banda. Sin retrato, la cara grande
function Rto({ liga, g, gris = false }) {
  const [mal, setMal] = useState(false);
  if (g.fr && !mal) return <span className={'gl-rto' + (gris ? ' gris' : '')}><img alt="" src={g.fr} loading="lazy" decoding="async" onError={() => setMal(true)} /></span>;
  return <span className="gl-rto sin"><CaraG liga={liga} g={g} cls="gl-cxl" grande /></span>;
}
function Etiq({ g }) {
  if (g.esc === 'pro') return <span className="gl-ec pro" title={'Es pro porque: ' + (g.por || []).map(porTx).join('. ')}>Pro</span>;
  return <span className={'gl-ec ' + g.esc}>{GRUPO[g.esc]}</span>;
}
function Marca({ g }) {
  if (!g.jb) return <span className="gl-nojugo">Todavía no jugó en la T1</span>;
  if (g.nb < 3) return <span className="gl-prov" title="Menos de 3 batallas contadas: su puesto todavía se mueve mucho">Provisional</span>;
  return null;
}
function Diez({ g, solo = false, mejores = 10 }) {
  const ganadas = Math.min(g.nb, g.b.length);
  const t = g.nb + ' de ' + mejores + ' batallas contadas: ' + ganadas + ' que suman' + (g.nb - ganadas ? ', ' + (g.nb - ganadas) + ' perdidas (0 pts)' : '');
  return (
    <span className={'gl-b10' + (solo ? ' solo' : '')} title={t}>
      <span aria-hidden="true">{Array.from({ length: mejores }, (_, k) => <i key={k} className={k < ganadas ? 'si' : k < g.nb ? 'per' : ''} />)}</span>
      {solo ? null : <b>{g.nb} de {mejores}</b>}
    </span>
  );
}
const Sello = ({ nf }) => (nf >= 2 ? <span className="gl-sello ok"><Ico n="ok" t={12} />Verificado</span> : <span className="gl-sello uno">Una fuente</span>);
function Mov({ g }) {
  const m = g.mv;
  if (!g.pos || m == null) return null;
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
function verbo(r, tu, min = false) {
  const v = { G: tu ? 'Le ganaste a' : 'Le ganó a', GR: tu ? 'Le ganaste con réplica a' : 'Le ganó con réplica a', PR: tu ? 'Perdiste ajustado con' : 'Perdió ajustado con' }[r] || (tu ? 'Le ganaste a' : 'Le ganó a');
  return min ? v[0].toLowerCase() + v.slice(1) : v;
}
/** por qué está en ese puesto: su mejor batalla (y el título de ese evento si lo ganó) */
function PorQue({ X, g, tu = false, min = false }) {
  if (!g.jb) return ANTES[g.k] || 'Todavía no jugó una batalla de la T1 que leamos.';
  const b = g.b[0];
  if (!b) {
    const t = g.t[0];
    if (t) return (tu ? 'Fuiste ' : 'Fue ') + PUESTO[t[1]].toLowerCase() + ' en ' + limpioEv((X.ev[t[0]] || [])[1]);
    return (tu ? 'Jugaste ' : 'Jugó ') + plural(g.jb, 'batalla', 'batallas') + ' y todavía no ' + (tu ? 'ganaste' : 'ganó') + ' ninguna';
  }
  const camp = g.t.find((t) => t[0] === b[0] && t[1] === 1);
  return <>{verbo(b[3], tu, min)} <b>{rivalDe(X, b)}</b> {dondeTx(X, b)}{camp ? (tu ? ' y te llevaste el título' : ' y se llevó el título') : ''}</>;
}
/** la misma, corta, para la fila del celular: sin el nombre del evento */
function PorQueC({ X, g, tu = false }) {
  const b = g.b[0];
  if (!g.jb || !b) return <PorQue X={X} g={g} tu={tu} />;
  const camp = g.t.find((t) => t[0] === b[0] && t[1] === 1);
  return <>{verbo(b[3], tu)} <b>{rivalDe(X, b)}</b>{ART[b[1]] ? ' en ' + ART[b[1]] : ''}{camp ? (tu ? ' y te llevaste el título' : ' y se llevó el título') : ''}</>;
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
/** la cuenta de una batalla, desarmada en piezas con nombre */
function Factores({ X, b, tu = false }) {
  const f = factores(X, b);
  return (
    <span className="gl-fac">
      <span>{n2(f.peso)} {min1(f.tipo)}</span>×<span>{n2(f.f)} fuerza de {rivalDe(X, b)}</span>×
      <span>{n2(f.res)} {b[3] === 'GR' ? 'con réplica' : b[3] === 'PR' ? (tu ? 'perdiste ajustado' : 'perdió ajustado') : (tu ? 'ganaste' : 'ganó')}</span>×
      <span>{n2(f.rx)} {RONDA[b[1]] || 'ronda'}</span>{f.extra >= 0.05 ? <>+<span>{n1(f.extra)} de extras</span></> : null}
    </span>
  );
}

// ── 1 · EL AFICHE: el título enorme y el podio recortado pisándolo ──
/** la banda de cada uno: el número, el nombre entero, bandera y grupo, y los puntos */
function Banda({ g, tu = false }) {
  return (
    <span className="gl-banda"><b className="gl-num">{g.pos}</b><b className="gl-bnom">{nombre(g)}</b>
      <span className="gl-bq"><Bandera cc={g.cc} cls="gl-flag" /><Etiq g={g} />{tu ? <span className="gl-tu">Tú</span> : null}</span>
      <em>{n1(g.p)}<small>pts</small></em></span>
  );
}
function Fig({ liga, g, p, abrir }) {
  return (
    <button type="button" className={'gl-fig p' + p} onClick={() => abrir(g)}>
      <Rto liga={liga} g={g} gris={p !== 1} />
      <Banda g={g} />
    </button>
  );
}
function Afiche({ X, D, liga, abrir, irComo }) {
  const top = X.G.filter((g) => g.pos).slice(0, 3);
  const tem = String(D.temporada || 't1').replace(/^t/i, '');
  return (
    <section className="gl-esc gl-in gl-af">
      <div className="gl-af-c">
        <div className="gl-af-t"><span className="tag" data-tuto="gl-cab">Temporada {tem}</span>
          <h1 className="gl-h1"><span>Ranking</span><span>global</span></h1></div>
        {top.length === 3 ? (
          <div className="gl-mont" role="group" aria-label="El podio">
            <Fig liga={liga} g={top[1]} p={2} abrir={abrir} /><Fig liga={liga} g={top[2]} p={3} abrir={abrir} /><Fig liga={liga} g={top[0]} p={1} abrir={abrir} />
          </div>
        ) : null}
        <div className="gl-af-l">
          <p className="gl-lede">{'Los Pro, las plazas y la Liga en una sola tabla. Cuentan las ' + X.mejores + ' mejores batallas de cada uno en la T1 y sus ' + X.mejoresTit + ' mejores títulos.'}</p>
          <p className="gl-fecha">{(X.flechas ? 'Tabla del ' : 'Primera tabla el ') + ddmm(diaDe(D.t)) + '; se actualiza cada lunes.'} <a className="gl-lnk gl-lnk-c" href="#gl-como" onClick={irComo}>¿Cómo funciona?</a></p>
        </div>
      </div>
    </section>
  );
}

// ── 2 · TU PELEA: tú contra el de arriba, pegada al afiche ──
function Esq({ liga, g, tu, onClick }) {
  return (
    <button type="button" className={'gl-esq ' + (tu ? 'gl-tuyo' : 'gl-rival')} onClick={onClick}>
      <CaraG liga={liga} g={g} cls="gl-cvs" />
      <b>{tu ? 'Tú' : nombre(g)}</b>
      <span><Bandera cc={g.cc} cls="gl-flag" /><Etiq g={g} />#{g.pos}</span>
    </button>
  );
}
function Cerca({ liga, g, yo, el, abrir, verPq }) {
  const mia = yo && g === yo;
  const d = yo ? g.p - yo.p : 0;
  return (
    <button type="button" className={'gl-pre' + (mia ? ' yo' : '') + (el && g === el ? ' gl-arriba' : '')} onClick={() => (mia ? verPq() : abrir(g))}>
      <span className="gl-pre-n"><Pos g={g} /></span>
      <CaraG liga={liga} g={g} />
      <span className="gl-pre-q"><b>{nombre(g)}</b><Bandera cc={g.cc} cls="gl-flag" /><Etiq g={g} />{mia ? <span className="gl-tu">Tú</span> : <Marca g={g} />}</span>
      <span className="gl-pre-l" aria-hidden="true" />
      <span className="gl-pre-p">{n1(g.p)}</span>
      {yo ? <span className="gl-pre-d">{mia ? '' : Math.abs(d) < 0.05 ? '=' : (d > 0 ? '+' : '−') + n1(Math.abs(d))}</span> : null}
    </button>
  );
}
function Talones({ X, g }) {
  const B = bloques(g, X.mejores);
  return (
    <ol className="gl-tal">
      {B.bat.map((x) => (x.t === 'b' ? (
        <li key={'b' + x.j} className="gl-ticket"><small>{cap1(RONDA[x.b[1]] || 'batalla')}</small><b>+{n1(x.pts)}</b><span>{rivalDe(X, x.b)}</span></li>
      ) : (
        <li key={'p' + x.j} className="gl-ticket roto"><small>Perdida</small><b>0</b><span>la reemplaza la próxima</span></li>
      )))}
      {Array.from({ length: B.libres }, (_, k) => <li key={'l' + k} className="gl-ticket libre"><small>Libre</small><b>—</b><span>suma entera</span></li>)}
    </ol>
  );
}
function TuPelea({ X, liga, yo, sesion, movil, abrir, verPq }) {
  if (!yo) {
    const o = X.liga1;
    const top = X.G.filter((g) => g.esc === 'liga' && g.pos).slice(0, movil ? 4 : 8);
    const txt = !sesion
      ? ['Tu esquina está vacía', 'Entra con Discord y te mostramos tu pelea: tú contra el que está justo arriba, entre los ' + miles(X.G.length) + '.']
      : ['Todavía no tienes pelea', 'Entras con tu primera batalla de la T1 en la Liga, una plaza, Red Bull o FMS.'];
    return (
      <section className="gl-esc gl-pel-s">
        <div className="gl-pel-cab gl-in"><h2>Tu pelea</h2><span>{sesion ? 'Sin batallas en la T1' : 'Sin cuenta'}</span></div>
        <div className="gl-pel gl-in">
          <div className="gl-est">
            {o ? (
              <div className="gl-rinc">
                <span className="gl-esq gl-tuyo"><span className="gl-cara gl-cvs gl-vacia" aria-hidden="true">?</span><b>Tú</b></span>
                <span className="gl-vs" aria-hidden="true">vs</span>
                <Esq liga={liga} g={o} onClick={() => abrir(o)} />
              </div>
            ) : null}
            <div className="gl-sinlugar"><h3>{txt[0]}</h3><p>{txt[1]}</p>
              {sesion ? <a className="btn gl-blanco gl-sombra" href="#/eventos">Ver los próximos eventos</a>
                : <button type="button" className="btn gl-blanco gl-sombra" onClick={accion.entrar}>Entrar con Discord</button>}
            </div>
          </div>
          {top.length ? (
            <div className="gl-pel-d"><div><h3 className="gl-ch">Los mejores de la Liga<small>de {miles(X.cnt.liga)}</small></h3>
              <div className="gl-pre-l0">{top.map((g) => <Cerca key={g.k} liga={liga} g={g} abrir={abrir} verPq={verPq} />)}</div></div></div>
          ) : null}
        </div>
      </section>
    );
  }
  const r = movil ? 3 : 4;
  const cerca = X.G.slice(Math.max(0, yo.i - r), yo.i + r + 1).filter((g) => g.pos);
  const arr = yo.i > 0;
  const el = arr ? X.G[yo.i - 1] : (X.G[yo.i + 1] && X.G[yo.i + 1].pos ? X.G[yo.i + 1] : null);
  const dif = el ? Math.abs(el.p - yo.p) : 0;
  const b = yo.b[0];
  const quedan = 3 - yo.nb;
  const gan = yo.b.length;
  const per = yo.nb - gan;
  const libres = Math.max(0, X.mejores - yo.nb);
  const resumen = [plural(gan, 'que suma', 'que suman')].concat(per ? [plural(per, 'perdida', 'perdidas')] : [], libres ? [plural(libres, 'libre', 'libres')] : []).join(', ');
  return (
    <section className="gl-esc gl-pel-s">
      <div className="gl-pel-cab gl-in"><h2>Tu pelea</h2><span>#{yo.pos} de {miles(X.conPts)}</span></div>
      <div className="gl-pel gl-in">
        <div className="gl-est">
          <div className="gl-rinc">
            <Esq liga={liga} g={yo} tu onClick={verPq} />
            {el ? <><span className="gl-vs" aria-hidden="true">vs</span><Esq liga={liga} g={el} onClick={() => abrir(el)} /></> : null}
          </div>
          {el ? (
            <div className="gl-pes">
              <div><small>Tú</small><b>{n1(yo.p)}</b></div>
              <div className="gl-dif"><small>{arr ? 'Te faltan' : 'Le llevas'}</small><b>{n1(dif)}</b><span>{arr ? <>pts para pasar a {nombre(el)}</> : 'pts al #2'}</span></div>
              <div><small>{nombre(el)}</small><b>{n1(el.p)}</b></div>
            </div>
          ) : null}
          {b ? <p className="gl-mejor"><span>Tu mejor victoria</span><PorQue X={X} g={yo} tu min />. <b>+{n1(b[4])}</b></p> : null}
          {quedan > 0 ? <p className="gl-falta">{'Te ' + (quedan === 1 ? 'falta 1 batalla contada' : 'faltan ' + quedan + ' batallas contadas') + ' para dejar de ser provisional.'}</p> : null}
          <div><button type="button" className="btn gl-blanco gl-sombra" onClick={verPq}><Ico n="guia" t={16} />{'Por qué estás #' + yo.pos + ' y cómo subir'}</button></div>
        </div>
        <div className="gl-pel-d"><div><h3 className="gl-ch">Los que tienes cerca</h3>
          <div className="gl-pre-l0" role="list">{cerca.map((g) => <Cerca key={g.k} liga={liga} g={g} yo={yo} el={arr ? el : null} abrir={abrir} verPq={verPq} />)}</div></div></div>
        <div className="gl-diez"><h3 className="gl-ch">{'Tus ' + X.mejores + ' batallas'}<small>{resumen}</small></h3><Talones X={X} g={yo} /></div>
      </div>
    </section>
  );
}

// ── 3 · COMPÁRATE CON UN GIGANTE: cara a cara ──
function Lado({ liga, g, tu, onClick }) {
  return <button type="button" className={'gl-lad' + (tu !== undefined ? ' yo' : '')} onClick={onClick}><Rto liga={liga} g={g} /><Banda g={g} tu={tu} /></button>;
}
function Gigante({ X, liga, yo, abrir, verPq }) {
  const [sel, setSel] = useState(X.gig.length > 1 ? 1 : 0);
  const g = X.gig[Math.min(sel, X.gig.length - 1)];
  const R = yo || X.liga1;
  if (!g || !R) return null;
  const evs = porEvento(g);
  const gb = best(g);
  const yb = best(R);
  const veces = yb ? Math.round(gb / yb) : 0;
  const tope = X.liga1 ? X.liga1.p : 0;
  const filas = [['Puesto', g.pos, R.pos, (v) => '#' + v, -1], ['Puntos', g.p, R.p, n1, 1], ['Mejor batalla', gb, yb, n1, 1],
    ['Batallas que cuentan', g.nb, R.nb, (v) => v + ' de ' + X.mejores, 1], ['Puntos por títulos', g.pt, R.pt, n1, 1]].filter((f) => f[1] || f[2]);
  const td = (a, b, s, fmt) => <td className={(a - b) * s > 0 ? 'gana' : ''}>{fmt(a)}</td>;
  const base = <>Su mejor batalla vale <b>{n1(gb)} pts</b>{yb ? <>; {yo ? <>la tuya, {n1(yb)}: una suya vale como {miles(veces)} tuyas</> : <>la mejor de {nombre(R)}, {n1(yb)}: una de {nombre(g)} vale como {miles(veces)} de {nombre(R)}</>}</> : null}.</>;
  let honesto;
  if (g.p <= tope) honesto = <>{base} Está al alcance si sigues ganando.</>;
  else if (yo && R === X.liga1) honesto = <>{base} <b>Tú eres el techo de la Liga hoy ({n1(tope)}).</b> Para pasarlo hacen falta resultados en eventos grandes: plazas fuertes, Red Bull, FMS.</>;
  else honesto = <>{base} <b>Con la Liga sola no lo alcanzarías:</b> nadie de la Liga pasó de {n1(tope)}. Hacen falta plazas fuertes, Red Bull o FMS.</>;
  const por = (g.por || [])[0];
  // la barra y la lista: macizo lo pro, rayado lo de plaza (la misma trama en los dos)
  const pl = (x) => (grupoEv((X.ev[x.e] || [])[2]) === 1 ? 'pl' : undefined);
  return (
    <section className="gl-esc gl-in gl-gig">
      <div className="gl-sec-t gl-gig-cab"><h2>Compárate con un gigante</h2>
        {X.gig.length > 1 ? (
          <div className="gl-chips" role="group" aria-label="Elegir gigante">
            {X.gig.map((x, k) => (
              <button key={x.k} type="button" className="gl-chip" aria-pressed={x === g} onClick={() => setSel(k)}><CaraG liga={liga} g={x} />{nombre(x)} <small>#{x.pos}</small></button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="gl-med">
        <Lado liga={liga} g={g} onClick={() => abrir(g)} />
        <table className="gl-cinta"><tbody>{filas.map(([q, a, b, fmt, s]) => <tr key={q}>{td(a, b, s, fmt)}<th scope="row">{q}</th>{td(b, a, s, fmt)}</tr>)}</tbody></table>
        <Lado liga={liga} g={R} tu={!!yo} onClick={() => (yo ? verPq() : abrir(R))} />
      </div>
      <div className="gl-med-pie">
        <div>
          <h3 className="gl-ch">De dónde salieron sus {n1(g.p)}</h3>
          <div className="gl-cin-ev" aria-hidden="true">{evs.map((x) => <i key={x.e} className={pl(x)} style={{ flex: x.pts.toFixed(2) + ' 1 0' }} />)}</div>
          <ol className="gl-ev-l">{evs.map((x) => <li key={x.e}><i className={pl(x)} /><span>{limpioEv((X.ev[x.e] || [])[1])}</span><b>{n1(x.pts)}</b></li>)}</ol>
          <div className="gl-lugares">
            <div className="gl-lug-f"><b>{nombre(g)}</b><Diez g={g} mejores={X.mejores} /></div>
            <div className="gl-lug-f"><b>{yo ? 'Tú' : nombre(R)}</b><Diez g={R} mejores={X.mejores} /></div>
          </div>
        </div>
        <div className="gl-med-d">
          <div className="gl-dist"><b>{n1(g.p - R.p)}</b><span>pts de distancia</span></div>
          {por ? <p className="gl-espro-l">{'Es pro porque: ' + porTx(por)}</p> : null}
          <p className="gl-honesto">{honesto}</p>
        </div>
      </div>
    </section>
  );
}

// ── 4 · LA TABLA ENTERA (el papel) ──
function Fila({ X, liga, g, yo, movil, abrir }) {
  const mia = yo && g === yo;
  return (
    <button type="button" className={'gl-fila' + (g.pos && g.pos <= 3 ? ' p' + g.pos : '') + (mia ? ' yo' : '')} onClick={() => abrir(g)}>
      <span className="gl-f-pos"><b className={g.pos ? '' : 'cero'}><Pos g={g} /></b>{X.flechas ? <Mov g={g} /> : null}</span>
      <span className="gl-f-q"><CaraG liga={liga} g={g} />
        <span className="gl-f-tx">
          <span className="gl-f-n"><b>{nombre(g)}</b><Bandera cc={g.cc} cls="gl-flag" /><Etiq g={g} />{mia ? <span className="gl-tu">Tú</span> : null}<Marca g={g} /><span className="gl-f-l" aria-hidden="true" /></span>
          <span className="gl-f-por">{movil ? <PorQueC X={X} g={g} tu={mia} /> : <PorQue X={X} g={g} tu={mia} />}</span>
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
  const corte = yoEn >= 0 && !vis.includes(yo) ? Math.abs(yoEn - (yoEn > de ? de + tam : de)) : 0;
  return (
    <div className="gl-tb">
      <div className="gl-tb-cab" aria-hidden="true"><span>#</span><span>Rapero</span><span>Batallas</span><span>Puntos</span><span /></div>
      {vis.length ? vis.map((g) => <Fila key={g.k} X={X} liga={liga} g={g} yo={yo} movil={movil} abrir={abrir} />)
        : <p className="gl-vacio">{filtro.q.trim() ? <>Nadie se llama «<b>{filtro.q.trim()}</b>» con esos filtros. Prueba con otra parte del nombre o con «Todos».</> : 'Nadie con esos filtros. Prueba con otro país o con «Todos».'}</p>}
      {vis.length && yoEn >= 0 && !vis.includes(yo) ? (
        <>
          <div className="gl-corte">{plural(corte, 'puesto', 'puestos') + ' más ' + (yoEn > de ? 'abajo' : 'arriba')}</div>
          <Fila X={X} liga={liga} g={yo} yo={yo} movil={movil} abrir={abrir} />
        </>
      ) : null}
      {vis.length && !yo ? (
        <div className="gl-fila-cta">{sesion ? <><b>Tu fila va acá</b> con tu primera batalla de la T1.</>
          : <><b>Tu fila va acá.</b> Entra con Discord y queda fija abajo de la tabla, estés donde estés.</>}</div>
      ) : null}
      <div className="gl-pag">
        <span>{L.length ? miles(de + 1) + '–' + miles(Math.min(de + tam, L.length)) + ' de ' + miles(L.length) : '0 de 0'}</span>
        <div>
          <button type="button" className="btn gl-borde chico" disabled={pag === 0} onClick={() => ir(-1)}>Anterior</button>
          <button type="button" className="btn gl-borde chico" disabled={pag >= npag - 1} onClick={() => ir(1)}>Siguiente</button>
        </div>
      </div>
      <ul className="gl-ley" aria-label="Qué significa cada marca">
        <li><span className="gl-ley-g"><span className="gl-ec pro">Pro</span><span className="gl-ec plaza">Plaza</span><span className="gl-ec liga">Liga</span></span><span>su grupo</span></li>
        {X.liga1 ? <li><Diez g={X.liga1} solo mejores={X.mejores} /><span>{'sus ' + X.mejores + ' batallas: suma, perdida, libre'}</span></li> : null}
        {X.prov ? <li><span className="gl-prov">Provisional</span><span>menos de 3 batallas</span></li> : null}
        {X.flechas ? <li><span className="gl-mov sube">▲3</span><span className="gl-mov baja">▼2</span><span>puestos desde el lunes anterior</span></li> : null}
        <li><span className="gl-sello ok"><Ico n="ok" t={12} />Verificado</span><span>2 fuentes o más</span></li>
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
        {X.paises.map(([c, n]) => <option key={c || 'sin'} value={c}>{c ? nombrePais(c) : 'Sin país'} ({miles(n)})</option>)}
      </select>
      {X.prov ? <button type="button" className="gl-tog" aria-pressed={filtro.sinProv} onClick={() => pon({ sinProv: !filtro.sinProv })}><i />Sin provisionales</button> : null}
      {yo ? <button type="button" className="gl-lnk gl-mio" onClick={() => setFiltro({ g: 'todos', pais: 'todos', sinProv: false, q: '', pag: -1 })}>{'Ir a mi lugar (#' + yo.pos + ')'}</button> : null}
    </div>
  );
}
function QueEs({ X }) {
  const C = [
    ['#', X.flechas ? 'Su puesto en la T1 y, debajo, cuántos puestos subió o bajó desde el lunes anterior. Con 0 pts va «—».' : 'Su puesto en la T1. Con 0 pts va «—».'],
    ['Rapero', 'Su grupo (Pro, Plaza o Liga), su país y su mejor victoria.'],
    ['Batallas', 'Cuántas de sus ' + X.mejores + ' mejores ya llenó. Con menos de 3 es «provisional»: su puesto todavía se mueve mucho.'],
    ['Puntos', 'Sus ' + X.mejores + ' mejores batallas más sus ' + X.mejoresTit + ' mejores títulos.'],
  ];
  return (
    <details className="gl-qe"><summary>¿Qué es cada columna?</summary>
      <dl>{C.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}</dl>
    </details>
  );
}
function Mini({ liga, g, sub, der, abrir }) {
  return (
    <div className="gl-mini"><CaraG liga={liga} g={g} />
      <button type="button" className="gl-mini-n" onClick={() => abrir(g)}><b><span>{nombre(g)}</span><Bandera cc={g.cc} cls="gl-flag" /></b><small>{sub}</small></button>{der}</div>
  );
}
function Rail({ X, liga, yo, abrir, setFiltro }) {
  const sub = X.flechas ? X.G.filter((g) => typeof g.mv === 'number' && g.mv > 0).sort((a, b) => b.mv - a.mv || a.i - b.i).slice(0, 4) : [];
  const plz = X.G.filter((g) => g.esc === 'plaza' && g.pos).slice(0, 6);
  const paisR = (yo && yo.cc) || (X.paises[0] && X.paises[0][0]) || '';
  const paisL = paisR ? X.G.filter((g) => g.cc === paisR && g.pos).slice(0, 5) : [];
  const nPais = (X.paises.find((x) => x[0] === paisR) || [0, 0])[1];
  const lugar = (g) => '#' + g.pos + ', ' + n1(g.p) + ' pts';
  return (
    <aside className="gl-rail">
      {sub.length ? (
        <section><div className="gl-sec-t"><h3>Los que más subieron</h3><small>Esta semana</small></div>
          {sub.map((g) => <Mini key={g.k} liga={liga} g={g} sub={'#' + g.pos} der={<Mov g={g} />} abrir={abrir} />)}
        </section>
      ) : null}
      {plz.length ? (
        <section><div className="gl-sec-t"><h3>Lo mejor de plaza</h3><small>Fuera de la Liga</small></div>
          {plz.map((g) => <Mini key={g.k} liga={liga} g={g} sub={lugar(g)} abrir={abrir}
            der={<a className="gl-inv-ico" href="#/invitar" aria-label="Invitar a la Liga" title="Invitar a la Liga"><Ico n="seguir" t={16} /></a>} />)}
          <p className="gl-rail-p">¿Conoces a alguno? Mándale tu link de <a className="gl-lnk-i" href="#/invitar">Invita y gana</a>.</p>
        </section>
      ) : null}
      {paisL.length ? (
        <section><div className="gl-sec-t"><h3>Lo mejor de {nombrePais(paisR)}</h3><small>{yo ? 'Tu país' : 'El país con más gente'}</small></div>
          {paisL.map((g) => <Mini key={g.k} liga={liga} g={g} sub={lugar(g)} der={<Etiq g={g} />} abrir={abrir} />)}
          {nPais > paisL.length ? <button type="button" className="gl-lnk" onClick={() => setFiltro({ g: 'todos', pais: paisR, sinProv: false, q: '', pag: 0 })}>Ver los {miles(nPais)} de {nombrePais(paisR)}</button> : null}
        </section>
      ) : null}
      {X.noJugo.length ? (
        <section><div className="gl-sec-t"><h3>Pros que todavía no jugaron</h3><small>En la T1</small></div>
          {X.noJugo.map((g) => <Mini key={g.k} liga={liga} g={g} sub={ANTES[g.k] ? 'Ganó Red Bull Perú el 12/09, antes de la T1' : porTx((g.por || [])[0] || '')} der={<Etiq g={g} />} abrir={abrir} />)}
        </section>
      ) : null}
    </aside>
  );
}

// ── 5 · ¿CÓMO FUNCIONA?: una batalla de verdad desarmada, y una que armas tú ──
const ARMA_RES = [['G', 'Ganó'], ['GR', 'Con réplica'], ['PR', 'Perdió ajustado']];
const ARMA_F = [2, 3, 5, 8];
/** qué pasa en sus 10 con la batalla nueva: entra si hay lugar libre o si le gana a la más chica, que sale */
function armaEntra(X, R, pts) {
  const B = bloques(R, X.mejores);
  const cont = B.bat.map((x) => ({ ...x }));
  let fuera = null;
  let entra = true;
  if (B.libres <= 0) {
    let mn = Infinity;
    let j0 = -1;
    cont.forEach((x, j) => { if (x.pts < mn) { mn = x.pts; j0 = j; } });
    if (j0 >= 0 && pts > mn) fuera = cont.splice(j0, 1)[0];
    else entra = false;
  }
  if (entra) cont.push({ t: 'n', j: -1, pts });
  cont.sort((a, b) => b.pts - a.pts);
  const tot = R.p - (fuera ? fuera.pts : 0) + (entra ? pts : 0);
  let puesto = 1;
  for (const g of X.G) if (g !== R && g.p > tot) puesto++;
  return { cont, fuera, entra, tot, puesto, libres: Math.max(0, X.mejores - cont.length) };
}
function Seg({ t, k, ops, val, pon }) {
  return (
    <div><small>{t}</small>
      <div className="gl-seg" role="group" aria-label={t}>
        {ops.map(([v, tx]) => <button key={String(v)} type="button" aria-pressed={String(val) === String(v)} onClick={() => pon(k, v)}>{tx}</button>)}
      </div>
    </div>
  );
}
function Arma({ X, yo, movil }) {
  const P = X.peso;
  const EV = [['liga', 'Liga', P.liga], ['plaza', 'Plaza', P.plaza], ['independiente', 'Plaza grande', P.independiente ?? P.rb_regional], ['fms_jornada', 'Pro nacional', P.fms_jornada]].filter((x) => x[2] != null);
  const RON = [['octavos', 'Octavos'], ['cuartos', 'Cuartos'], ['semifinal', 'Semi'], ['final', 'Final']].map(([k, t]) => [k, t, X.ronda[k] || 1]);
  const [A, setA] = useState({ ev: 'plaza', ronda: 'cuartos', res: 'G', f: 3 });
  const [vez, setVez] = useState(0);
  const prev = useRef(null);
  const blq = useRef(null);
  const nuevo = useRef(null);
  const sale = useRef(null);
  const ev = EV.find((x) => x[0] === A.ev) || EV[0] || ['', '', 0];
  const rx = (RON.find((x) => x[0] === A.ronda) || RON[0])[2];
  const res = RES[A.res] || 1;
  const alto = A.f * res * rx;
  const pts = ev[2] * alto;
  const w = Math.max(ev[2] * (movil ? 46 : 52), 3);
  const h = Math.max(alto * (movil ? 11 : 13), 3);
  // 🎞️ el movimiento: sólo transform y opacidad, ≤ 250 ms, la salida (140) más corta que la entrada (200/220). El bloque
  // crece desde su tamaño de antes (FLIP), la nueva cae en su lugar y la que sale se va. Sin movimiento, nada de esto
  useLayoutEffect(() => {
    if (!vez || quieto()) return;
    const b = blq.current;
    if (b && prev.current) {
      b.style.transition = 'none';
      b.style.transform = 'scale(' + (prev.current.w / w).toFixed(3) + ',' + (prev.current.h / h).toFixed(3) + ')';
      void b.offsetWidth;
      b.style.transition = '';
      b.style.transform = '';
    }
    const s = sale.current;
    if (s) { s.style.transition = 'none'; s.classList.remove('fuera'); void s.offsetWidth; s.style.transition = ''; s.classList.add('fuera'); }
    const n = nuevo.current;
    if (n) {
      n.style.transition = 'none'; n.style.transform = 'translateY(-14px)'; n.style.opacity = '0';
      void n.offsetWidth;
      n.style.transition = ''; n.style.transform = ''; n.style.opacity = '';
    }
  }, [vez]);
  const R = yo || X.liga1;
  if (!R || !EV.length) return null;
  const pon = (k, v) => { prev.current = { w, h }; setA((a) => ({ ...a, [k]: v })); setVez((x) => x + 1); };
  const x = armaEntra(X, R, pts);
  const quien = yo ? 'tus ' + X.mejores : 'los ' + X.mejores + ' de ' + nombre(R);
  const real = X.G[0] && X.G[0].b[0] ? X.G[0] : null;
  const rb = real ? real.b[0] : null;
  const fueraTx = !x.entra ? <><b>No entra:</b> {(yo ? 'tu' : 'su') + ' batalla más chica vale más.'}</>
    : x.fuera ? (x.fuera.t === 'p' ? 'Sale la perdida (0).' : 'Sale la de ' + n1(x.fuera.pts) + '.') : 'Entra en un lugar libre.';
  const sigue = x.puesto === R.pos ? (yo ? 'sigues #' : 'sigue #') + x.puesto : <>{'del #' + R.pos + ' al '}<b>{'#' + x.puesto}</b></>;
  const nek = X.porK.get('nekroos');
  return (
    <div className="gl-ar">
      <div className="gl-ar-ctl"><h3>{yo ? 'Arma una batalla tuya' : 'Arma una batalla'}</h3>
        <Seg t="Dónde (el peso)" k="ev" ops={EV.map(([v, tt, p]) => [v, tt + ' ' + n2(p)])} val={A.ev} pon={pon} />
        <Seg t="Fuerza del rival" k="f" ops={ARMA_F.map((v) => [v, String(v)])} val={A.f} pon={pon} />
        <Seg t="Resultado" k="res" ops={ARMA_RES} val={A.res} pon={pon} />
        <Seg t="Ronda" k="ronda" ops={RON.map(([v, tt]) => [v, tt])} val={A.ronda} pon={pon} />
      </div>
      <div className="gl-ar-der">
        {rb ? (
          <div className="gl-ar-real"><p><span>Una de verdad:</span> <b>{nombre(real)}</b> {verbo(rb[3], false, true)} <b>{rivalDe(X, rb)}</b> {dondeTx(X, rb)}.</p>
            <p className="gl-ar-cuenta"><Factores X={X} b={rb} /><span className="gl-ar-igual">= <b>{n1(rb[4])}</b> pts</span></p></div>
        ) : null}
        <div className="gl-ar-dib">
          <div className="gl-ar-lienzo" style={{ width: Math.round(w + 2) + 'px', height: Math.round(h + 2) + 'px' }}>
            <i ref={blq} className={'gl-blq g' + grupoEv(A.ev)} style={{ width: w.toFixed(1) + 'px', height: h.toFixed(1) + 'px' }} />
          </div>
          <div className="gl-ar-cotas">
            <p>Alto (fuerza × resultado × ronda): {A.f} × {n2(res)} × {n2(rx)} = <b>{n2(alto)}</b></p>
            <p>Ancho (el peso): <b>{n2(ev[2])}</b></p>
            <p className="gl-ar-area">Ancho por alto: <b>{n1(pts)}</b> pts</p>
          </div>
        </div>
        <div className="gl-ar-res"><h3>{'Entra en ' + quien}</h3>
          <ol className="gl-ar-diez" aria-label={'Así quedan ' + quien}>
            {x.cont.map((y) => <li key={y.t + y.j} ref={y.t === 'n' ? nuevo : undefined} className={y.t === 'n' ? 'nuevo' : y.t === 'p' ? 'per' : ''}>{y.t === 'p' ? '0' : n1(y.pts)}</li>)}
            {Array.from({ length: x.libres }, (_, k) => <li key={'l' + k} className="lib">libre</li>)}
          </ol>
          {x.fuera ? <span ref={sale} className="gl-ar-sale fuera" aria-hidden="true">{x.fuera.t === 'p' ? '0' : n1(x.fuera.pts)}</span> : null}
          <p aria-live="polite">{fueraTx}{x.entra ? <>{' Total: ' + n1(R.p) + ' → '}<b>{n1(x.tot)}</b>, {sigue}.</> : null}</p>
        </div>
        <ul className="gl-ar-notas">
          <li><b>{'Cuentan ' + (yo ? 'tus ' : 'sus ') + X.mejores + ' mejores:'}</b> la nueva entra si le gana a la más chica.</li>
          <li><b>{(yo ? 'Tus ' : 'Sus ') + X.mejoresTit + ' mejores títulos suman aparte:'}</b> la mitad de lo que se ganó en ese camino, más un fijo por batalla. Final, el 40 %; semi, el 20 %.</li>
          <li><b>No cuentan</b> <s>las vistas</s> {'ni nada de antes del 22/09' + (nek ? ': Nekroos ganó Red Bull Perú el 12/09 y todavía no suma.' : '.')}</li>
        </ul>
      </div>
    </div>
  );
}
function Como({ X, D, yo, movil, verGrupo }) {
  const fu = D.fu || {};
  const L = [['La Liga', 'eventos de Discord de la Liga y sus socios', 'liga'], ['YouTube', 'canales de plazas y ligas', 'youtube'], ['Freestylestats', 'llaves de torneos', 'fstats'],
    ['UrbanStreet', 'resultados de plazas', 'urbanstreet'], ['fms.tv', 'jornadas FMS, voto por voto', 'fms']].map(([n, s, k]) => [n, s, (fu[k] && fu[k].n) || 0]).filter((y) => y[2]);
  const mx = Math.max(1, ...L.map((y) => y[2]));
  const P = X.peso;
  const pesos = [[P.rb_internacional, 'Élite: Red Bull y FMS internacional, World Cup'], [P.fms_jornada, 'Pro nacional: jornadas FMS, finales nacionales de Red Bull'],
    [P.rb_regional, 'Regionales de Red Bull, plazas grandes e internacionales independientes'], [P.plaza, 'Plaza'], [P.liga, 'La Liga: la nuestra y sus socios', 1],
    [P.resto, 'El resto, y los eventos de la Liga de menos de 8']].filter((y) => y[0] != null);
  const lunes = proximoLunes(D.t);
  const REGLA = {
    pro: <>Juega una liga <b>FMS</b> 2026/27, jugó las finales internacionales de <b>FMS o Red Bull 2026</b>, o es <b>campeón nacional de Red Bull</b> 2026/27.</>,
    plaza: <>Todo lo de <b>afuera de la Liga</b> que no es Pro: plazas, torneos independientes, regionales y nacionales de Red Bull sin título.</>,
    liga: <>Juega en los <b>eventos de Discord de la Liga</b> y sus socios, verificado con su perfil.</>,
  };
  return (
    <section className="gl-esc gl-in gl-como" id="gl-como">
      <div className="gl-sec-t"><h2>¿Cómo funciona?</h2><small>{'Próxima tabla: ' + diaTx(lunes)}</small></div>
      <div className="gl-como-in">
        <p className="gl-como-lede">Cuenta sólo la T1, del 22/09 al 31/12: todos arrancaron en cero. Cada batalla ganada vale según <b>dónde fue</b>, <b>contra quién</b>, <b>cómo</b> y <b>en qué ronda</b>.</p>
        <Arma X={X} yo={yo} movil={movil} />
        <div>
          <h3>Los tres grupos</h3>
          <ul className="gl-grl">
            {['pro', 'plaza', 'liga'].map((v) => (
              <li key={v}><span className={'gl-ec ' + v}>{GRUPO[v]}</span><b>{miles(X.cnt[v])}</b><p>{REGLA[v]}</p>
                <button type="button" className="gl-lnk" onClick={() => verGrupo(v)}>Ver en la tabla</button></li>
            ))}
          </ul>
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
function Record({ g }) {
  const R = {};
  let gan = 0;
  for (const b of g.b) {
    if (b[3] === 'PR') continue;
    gan++;
    const k = ['final', 'semifinal', 'cuartos', 'octavos'].includes(b[1]) ? b[1] : 'otras';
    R[k] = (R[k] || 0) + 1;
  }
  const per = g.nb - gan;
  const ord = [['final', 'Finales'], ['semifinal', 'Semis'], ['cuartos', 'Cuartos'], ['octavos', 'Octavos'], ['otras', 'Otras']].filter(([k]) => R[k]);
  const rayas = (n, cls) => Array.from({ length: n }, (_, j) => <i key={j} className={cls} />);
  return (
    <div className="gl-rec"><div><small>Récord</small><b>{gan}–{per}</b></div>
      <ol aria-label="Ganadas por ronda">
        {ord.map(([k, t]) => <li key={k}><small>{t}</small><span aria-hidden="true">{rayas(R[k])}</span><b>{R[k]}</b></li>)}
        {per ? <li><small>Perdidas</small><span aria-hidden="true">{rayas(per, 'p')}</span><b>{per}</b></li> : null}
      </ol>
    </div>
  );
}
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
      <div className="gl-sec-t"><h3>{'Por qué ' + (tu ? 'estás' : 'está') + ' ' + (g.pos ? 'en el #' + g.pos : 'acá')}</h3><small>{n1(g.pb) + ' pts por batallas y ' + n1(g.pt) + ' por títulos'}</small></div>
      {evs.map((x, k) => {
        const e = X.ev[x.e] || [];
        return (
          <div key={x.e} className="gl-ev">
            <div className="gl-ev-c"><b>{limpioEv(e[1])}</b><small>{(TIPO[e[2]] || e[2]) + ', peso ' + n2(X.peso[e[2]] ?? X.peso.resto ?? 0) + ', ' + fechaEv(e[3])}</small></div>
            {x.bat.map((b, j) => (
              <div key={j} className="gl-bat">
                <p>{verbo(b[3], tu)} <b>{rivalDe(X, b)}</b>{b[1] && b[1] !== 'jornada' && ART[b[1]] ? ' en ' + ART[b[1]] : ''}</p><Sello nf={b[5] || 1} /><b>+{n1(b[4])}</b>
                {k === 0 && j === 0 ? <Factores X={X} b={b} tu={tu} /> : null}
              </div>
            ))}
            {x.tit ? <div className="gl-bat tit"><p>{PUESTO[x.tit[1]] + (x.tit[1] === 3 ? ' (entre los 4)' : '')}</p><span /><b>+{n1(x.tit[2])}</b></div> : null}
          </div>
        );
      })}
      {falta > 0 ? <p className="gl-fi-pie">{'Y ' + (falta === 1 ? 'una batalla contada que no sumó' : falta + ' batallas contadas que no sumaron') + ' puntos (perdidas).'}</p> : null}
      <p className="gl-fi-pie">{'Cuentan las ' + X.mejores + ' mejores batallas de la T1 y los ' + X.mejoresTit + ' mejores títulos.'}</p>
    </div>
  );
}
function Ficha({ X, liga, g, yo, cerrar }) {
  const tu = !!yo && g === yo;
  const otro = X.G.find((x) => x !== g && norm(x.n) === norm(g.n));
  const b = g.b[0];
  return (
    <div className="gl-ficha">
      <div className="gl-fi-top"><Rto liga={liga} g={g} />
        <div className="gl-fi-n"><h2>{nombre(g)}</h2><p><Bandera cc={g.cc} cls="gl-flag" />{g.cc ? nombrePais(g.cc) : 'Sin país'} <Etiq g={g} />{g.jb ? <> <Marca g={g} /></> : null}</p></div>
        <button type="button" className="gl-cerrar" onClick={cerrar} aria-label="Cerrar la ficha"><Ico n="cerrar" t={16} /></button>
      </div>
      <div className="gl-datos"><div><small>Puesto</small><b>{g.pos ? '#' + g.pos : '—'}</b></div><div><small>Puntos</small><b>{g.jb ? n1(g.p) : '—'}</b></div><div><small>Jugadas</small><b>{g.jb || 0}</b></div></div>
      {g.jb && g.nb ? <Record g={g} /> : null}
      {b ? <p className="gl-mejor"><span>{tu ? 'Tu mejor victoria' : 'Su mejor victoria'}</span><PorQue X={X} g={g} tu={tu} min />. <b>+{n1(b[4])}</b></p> : null}
      {g.esc === 'pro' && g.por && g.por.length ? (
        <div className="gl-espro"><span className="gl-pq-t">Por qué es pro</span><ul>{g.por.map((t) => <li key={t}>{porTx(t)}</li>)}</ul></div>
      ) : null}
      <Camino X={X} g={g} tu={tu} />
      {otro ? <p className="gl-homo">Hay otro <b>{nombre(otro)}</b> en la tabla: <Bandera cc={otro.cc} cls="gl-flag" /> {otro.cc ? nombrePais(otro.cc) : 'sin país'}, {GRUPO[otro.esc]}{otro.pos ? ', #' + otro.pos : ''}. La bandera los separa.</p> : null}
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
  const tits = (g) => g.t.filter((t) => t[1] === 1).length;
  const b = yo.b[0];
  const f = b ? factores(X, b) : null;
  const notas = [];
  if (b) notas.push(<>Tu mejor batalla: <PorQue X={X} g={yo} tu min />. Vale <b>{n1(b[4])}</b>: {n2(f.peso)} ({min1(f.tipo)}) × {n2(f.f)} (la fuerza de {rivalDe(X, b)}) × {b[1] === 'final' ? n2(f.rx) + ' por ser la final' : n2(f.rx) + ' por la ronda'}{f.extra >= 0.05 ? ', más ' + n1(f.extra) + ' de extras' : ''}.</>);
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
  const filas = arriba ? [['Puntos', yo.p, arriba.p, n1], ['Mejor batalla', best(yo), best(arriba), n1], ['Batallas que cuentan', yo.nb, arriba.nb, (v) => v + ' de ' + X.mejores], ['Puntos por títulos', yo.pt, arriba.pt, n1]] : [];
  const B = bloques(yo, X.mejores);
  const T = yo.t.slice(0, X.mejoresTit);
  return (
    <div className="rk-pq-in">
      <section><span className="rk-pq-t">TUS NÚMEROS</span>
        <dl className="rk-pq-dat n4"><div><dt>Puesto</dt><dd>#{yo.pos}</dd></div><div><dt>Puntos</dt><dd>{n1(yo.p)}</dd></div><div><dt>Batallas</dt><dd>{yo.nb}/{X.mejores}</dd></div><div><dt>Títulos</dt><dd>{tits(yo)}</dd></div></dl></section>
      <section><span className="rk-pq-t">{'TUS ' + X.mejores + ' BATALLAS, UNA POR UNA'}</span>
        <table className="gl-tt"><thead><tr><th scope="col">#</th><th scope="col">Ronda</th><th scope="col">Batalla</th><th scope="col">Pts</th></tr></thead>
          <tbody>
            {B.bat.map((x, k) => (x.t === 'b' ? (
              <tr key={'b' + x.j}><td>{k + 1}</td><td>{RONDA[x.b[1]] || '—'}</td><td>{verbo(x.b[3], true)} <b>{rivalDe(X, x.b)}</b><br /><small>{limpioEv((X.ev[x.b[0]] || [])[1])}</small></td><td>{n1(x.pts)}</td></tr>
            ) : (
              <tr key={'p' + x.j} className="per"><td>{k + 1}</td><td>—</td><td>Perdida: la reemplaza tu próxima victoria</td><td>0</td></tr>
            )))}
            {Array.from({ length: B.libres }, (_, j) => <tr key={'l' + j} className="lib"><td>{B.bat.length + j + 1}</td><td>—</td><td>Libre</td><td>—</td></tr>)}
            {T.map((t, j) => <tr key={'t' + j} className="tit"><td>T</td><td>{PUESTO[t[1]]}</td><td>{limpioEv((X.ev[t[0]] || [])[1])}</td><td>{n1(t[2])}</td></tr>)}
          </tbody>
          <tfoot><tr><td /><td colSpan={2}>Total</td><td>{n1(yo.p)}</td></tr></tfoot></table></section>
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
  const ir = (el) => { if (el) el.scrollIntoView({ behavior: quieto() ? 'auto' : 'smooth', block: 'start' }); };
  const verGrupo = (v) => { setFiltro({ g: v, pais: 'todos', sinProv: false, q: '', pag: 0 }); ir(papel.current); };
  const irComo = (e) => { e.preventDefault(); const r = e.currentTarget.getRootNode(); ir(r.getElementById ? r.getElementById('gl-como') : null); };
  const verPq = () => setPq(true);
  const lunes = proximoLunes(D.t);
  const cuenta = [miles(X.conPts) + ' con puntos'].concat(X.sinPts ? [miles(X.sinPts) + ' sin ganar todavía'] : [], X.noJugo.length ? [X.noJugo.length + ' sin jugar'] : []);
  return (
    <div className="gl">
      <Afiche X={X} D={D} liga={liga} abrir={setFicha} irComo={irComo} />
      <TuPelea X={X} liga={liga} yo={yo} sesion={sesion} movil={movil} abrir={setFicha} verPq={verPq} />
      <Gigante X={X} liga={liga} yo={yo} abrir={setFicha} verPq={verPq} />
      <section className="gl-papel gl-in" aria-label="La tabla" ref={papel}>
        <div className="gl-prog-c"><h2>La tabla entera</h2><p>{(cuenta.length > 1 ? cuenta.slice(0, -1).join(', ') + ' y ' + cuenta[cuenta.length - 1] : cuenta[0]) + '.'}</p></div>
        {X.flechas ? null : <p className="gl-flechas">{'Las flechas de la semana y «los que más subieron» arrancan el lunes ' + ddmm(lunes) + '.'}</p>}
        <QueEs X={X} />
        <Herramientas X={X} yo={yo} filtro={filtro} setFiltro={setFiltro} />
        <div className="gl-tabla-y">
          <Tabla X={X} liga={liga} yo={yo} sesion={sesion} movil={movil} abrir={setFicha} filtro={filtro} setFiltro={setFiltro} />
          <Rail X={X} liga={liga} yo={yo} abrir={setFicha} setFiltro={setFiltro} />
        </div>
      </section>
      <Como X={X} D={D} yo={yo} movil={movil} verGrupo={verGrupo} />
      {ficha ? (
        <Dialogo key={ficha.k} cls="gl-lado" etiqueta={'Ficha de ' + nombre(ficha)} onCerrar={() => setFicha(null)}>
          {(cerrar) => <Ficha X={X} liga={liga} g={ficha} yo={yo} cerrar={cerrar} />}
        </Dialogo>
      ) : null}
      {pq ? (
        <Dialogo cls="pn-pop rk-pq-pop" etiqueta={yo ? 'Por qué estás #' + yo.pos + ' y cómo subir' : 'Cómo entrar y subir'} onCerrar={() => setPq(false)}>
          {(cerrar) => <>
            <PopCab ico="ranking" t={yo ? 'Por qué estás #' + yo.pos + ' y cómo subir' : 'Cómo entrar y subir'} sub={yo ? 'Tus ' + X.mejores + ' batallas, una por una' : 'Todavía no estás en este ranking'} cerrar={cerrar} />
            <PorQueEstas X={X} yo={yo} sesion={sesion} />
          </>}
        </Dialogo>
      ) : null}
    </div>
  );
}
