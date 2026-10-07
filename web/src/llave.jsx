// 🏆 LA LLAVE, NUEVA (Dlx, 03/10/2026: «1. A 2. A 3. A» al plan de lo que falta del remake, la llave primero, y la 2:
// «arriba el podio, y abajo el cuadro de a una ronda por pantalla, deslizando —Octavos → Cuartos → Semis → Final—, como
// en las apps de fútbol. Tocás un nombre y se marca su camino»). Reemplaza la ventana de app.js (`abrirLlave()`), que
// Dlx había pedido mejorar (*«la sección de llaves tiene que mejorar bastante»*): ahora es una página, con su
// dirección (`#/llave/<n>`, y `#/llave/v:<id>` la que se está jugando), así que se comparte y el «atrás» del celular
// vuelve a donde estabas.
// ⚠️ LAS MISMAS REGLAS QUE LA DE APP.JS, una por una: el cuadro sale de `b[3]` (de qué batallas vienen los lados, lo
// arma `llaves_web.enlazar()`) y lo que no engancha se dibuja igual, en su columna; un 5 vidas es un tablero y no un
// cuadro; la nave de funa es una lista con ❌; un equipo va junto, y sin perfil si la llave no dice quiénes son
// (`L.sin`); el Clásico, el 🎯 del Most Wanted, los puntos por puesto y «¿Algo está mal?». En la compu, el cuadro
// entero con sus ramas (en espejo si entra), como antes.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PAIS, capital, limpio, norm, num } from './liga.js';
import { Bandera, Cara, Compartir, enlace } from './piezas.jsx';
import { completar, enOrden, esArbol, jugado } from './arriba.jsx';
import { vioVivo, vivoPendiente } from './pase.js';

const MEDALLA = { Campeón: '🥇', Subcampeón: '🥈', Tercero: '🥉', Cuarto: '🎖️' };
const ORD_P = ['Campeón', 'Subcampeón', 'Tercero', 'Cuarto', 'Semifinal', 'Cuartos', 'Octavos', 'Dieciseisavos', 'R32'];
const PREVIAS = ['Filtros', 'Clasificatorias', 'Preliminares'];
const BANDERAS = /[\u{1F1E6}-\u{1F1FF}]/gu;

// un lado, siempre como texto: en vivo un equipo puede venir como lista
const texto = (z) => (typeof z === 'string' ? z : (z || []).join(', '));
const normB = (b) => [(b[0] || []).map(texto), texto(b[1]), String(b[2] || ''), Array.isArray(b[3]) ? b[3] : []];
// los integrantes de un lado («a, b, c» es un equipo)
// los integrantes de un lado: la llave procesada escribe «A, B» y la en vivo «A + B» (LA REDENCION, 03/10/2026)
const partes = (s) => String(s || '').split(/\s*[,+&]\s*/).filter(Boolean);
const miembros = (x) => String(x || '').split(/[,+&]/).map((s) => s.replace(BANDERAS, '').trim().toLowerCase()).filter(Boolean);
const comparten = (a, b) => { const mb = miembros(b); return miembros(a).some((x) => mb.includes(x)); };
const gana = (b, s) => !!b[1] && (b[1] === s || comparten(b[1], s));

// «Denik 🇵🇪» -> «Denik» y la bandera aparte (`conBanderas()` de app.js): en Windows el emoji son dos letras sueltas.
// Un país que la Liga no conoce no se dibuja: dos letras no dicen nada
function sinBanderas(x) {
  const ccs = [];
  let txt = '';
  let par = '';
  for (const ch of String(x || '')) {
    const c = ch.codePointAt(0);
    if (c >= 0x1F1E6 && c <= 0x1F1FF) {
      par += String.fromCharCode(c - 0x1F1E6 + 97);
      if (par.length === 2) { if (PAIS[par]) ccs.push(par); par = ''; }
    } else txt += ch;
  }
  return { txt: limpio(txt), ccs };
}
const clave = (x) => norm(sinBanderas(x).txt).replace(/[^\p{L}\p{N}]/gu, '');

// cuánto hace de algo, en palabras («hace 3 min»)
function hace(t) {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return 'recién';
  if (m < 60) return 'hace ' + m + ' min';
  const h = Math.floor(m / 60);
  return 'hace ' + h + (h === 1 ? ' hora' : ' horas');
}

// ── las llaves que no viajan en el lobby (las más viejas): se piden todas una vez, como `llaveVieja()` de app.js ──
let TODAS = null;
function pedirTodas() {
  if (!TODAS) {
    // ⚠️ lo que falla NO se guarda (revisión del 04/10/2026): un pedido que no llegó quedaba como respuesta para toda la
    // visita, y cada llave vieja que se abría después decía «link mal copiado». La próxima vez se pide de nuevo
    TODAS = fetch('/api/llaves', { headers: { accept: 'application/json' } })
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((t) => (t && t.llaves) || t || {})
      .catch(() => { TODAS = null; return null; });
  }
  return TODAS;
}

// ── el ancho de la pantalla: en la compu el cuadro entero, en el celular de a una ronda ──
function useCompu() {
  const q = () => (window.matchMedia ? window.matchMedia('(min-width: 900px)').matches : true);
  const [si, setSi] = useState(q);
  useEffect(() => {
    const f = () => setSi(q());
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return si;
}

// ── un nombre: su cara, su nombre y su bandera. Tocarlo marca su camino ──
function Nombre({ x, f }) {
  if (f) return <><span className="lk-n">{capital(limpio(f.n))}</span><Bandera cc={f.cc} cls="lk-flag" /></>;
  const { txt, ccs } = sinBanderas(x);
  return <><span className="lk-n">{capital(txt || x)}</span>{ccs.map((cc) => <Bandera key={cc} cc={cc} cls="lk-flag" />)}</>;
}
function Persona({ ctx, x, conCara = true, perdio = false }) {
  const f = ctx.fila(x);
  if (!f && ctx.esSin(x)) {
    return <span className="lk-p lk-eqn" title="Un equipo de este evento: la llave no dice quiénes son, así que no suma puntos">{sinBanderas(x).txt}<small>equipo</small></span>;
  }
  const id = ctx.idDe(x);
  const on = ctx.sigo === id;
  return (
    <button type="button" className={'lk-p' + (on ? ' on' : '')} aria-pressed={on} onClick={() => ctx.seguir(id)}>
      {conCara ? <Cara liga={ctx.liga} k={f ? f.k : ''} nombre={f ? f.n : sinBanderas(x).txt} cls="lk-cara" /> : null}
      <Nombre x={x} f={f} />
      {ctx.marca(x, f, perdio)}
    </button>
  );
}

// ── un lado de una batalla: una persona o un equipo (las caras juntas, adelante) ──
function Lado({ ctx, b, s, copa, alto, pasa }) {
  const ms = partes(s);
  const eq = ms.length > 1;
  const g = gana(b, s) || pasa;
  const perdio = !!b[1] && !g;
  const sigue = !!ctx.sigo && ms.some((m) => ctx.idDe(m) === ctx.sigo);
  const cls = 'lk-l' + (g ? (copa ? ' copa' : ' g') : (b[1] ? ' x' : '')) + (eq ? ' eq' : '') + (sigue ? ' sigue' : '');
  return (
    <div className={cls} style={alto ? { height: alto } : undefined}>
      {eq ? <span className="lk-caras">{ms.map((m, i) => { const f = ctx.fila(m); return <Cara key={i} liga={ctx.liga} k={f ? f.k : ''} nombre={f ? f.n : sinBanderas(m).txt} cls="lk-cara" />; })}</span> : null}
      <span className="lk-ns">{ms.map((m, i) => <Persona key={i} ctx={ctx} x={m} conCara={!eq} perdio={perdio} />)}</span>
      {g ? <span className="lk-ok" aria-label={copa ? 'Campeón' : 'Pasó'}>{copa ? '🏆' : '✓'}</span> : null}
    </div>
  );
}

// 🔑 LO QUE LA LLAVE NO DICE CON UN NOMBRE, CON UNA ETIQUETA (`etiquetasNota()` de app.js): revivido, walk-in,
// pokémon, refuerzo, el tercero que dio el podio, cuántos pasan de un grupo y el Clásico. Y el estado: AHORA, SIGUE
function etiquetas(ctx, b, est, copa) {
  const out = [];
  if (est === 'ahora') out.push(['AHORA', 'ahora']);
  else if (est === 'sigue') out.push(['SIGUE', 'sig']);
  else if (est === 'singan') out.push(['SIN GANADOR', 'sg']);
  const s = b[2];
  const t = /pasan (\d+)/.exec(s);
  if (t) out.push([t[1] === '0' ? 'No pasó nadie' : 'Pasan ' + t[1], '']);
  if (/revivid/i.test(s)) out.push(['Revivido', '']);
  if (/walk-?in/i.test(s)) out.push(['Walk-in', '']);
  if (/pok[eé]mon/i.test(s)) out.push(['Pokémon', '']);
  if (/refuerzo/i.test(s)) out.push(['Refuerzo', '']);
  if (/^podio/i.test(s)) out.push(['Por el podio', '']);
  const c = ctx.clasico(b);
  if (c) out.push(['🤜 Clásico ' + c[2] + '–' + c[3], 'cl', 'Ya se cruzaron ' + (c[2] + c[3]) + ' veces (' + limpio(c[0]) + ' ' + c[2] + '–' + c[3] + ' ' + limpio(c[1]) + '). El que gana suma +10 %.']);
  if (copa && b[1]) out.push(['🏆 Campeón', 'copa']);
  return out;
}

// ── una batalla: sus lados, quién pasó y sus etiquetas ──
function Batalla({ ctx, b, est, copa, style, altos, pasan }) {
  const ls = b[0];
  const et = etiquetas(ctx, b, est, copa);
  const sigue = !!ctx.sigo && ls.some((s) => partes(s).some((m) => ctx.idDe(m) === ctx.sigo));
  return (
    <div className={'lk-b' + (est ? ' ' + est : '') + (sigue ? ' sigue' : '') + (ls.length ? '' : ' vacio') + (copa ? ' fin' : '')}
      style={style} title={b[2] || undefined}>
      {et.length ? <div className="lk-et">{et.map((x, i) => <span key={i} className={x[1]} title={x[2]}>{x[0]}</span>)}</div> : null}
      {ls.map((s, i) => <Lado key={i} ctx={ctx} b={b} s={s} copa={copa} alto={altos ? altos[i] : 0} pasa={!!pasan && pasan(s)} />)}
      {ls.length === 1 ? <div className="lk-l vac" style={altos ? { height: altos[1] } : undefined}><em>{b[1] ? 'pasa directo' : 'por definir'}</em></div> : null}
      {!ls.length ? <><div className="lk-l vac" style={altos ? { height: altos[0] } : undefined}><em>{ctx.cerrada ? '—' : 'por jugarse'}</em></div>
        <div className="lk-l vac" style={altos ? { height: altos[1] } : undefined}><em /></div></> : null}
    </div>
  );
}

// ── EN EL CELULAR: una ronda por pantalla, deslizando, con las pestañas arriba ──
// 🔴 EL ALTO ES EL DE LA RONDA QUE SE MIRA: con el de la más alta (los Octavos), la Final quedaba con un hueco enorme
// abajo (Dlx no quiere huecos grandes)
function Pista({ ctx, rondas, ter, inicial, vale }) {
  const pista = useRef(null);
  const cols = useRef([]);
  const [act, setAct] = useState(inicial);
  const [alto, setAlto] = useState(null);
  const ir = useCallback((i, suave) => {
    const el = pista.current;
    const c = cols.current[i];
    if (el && c) el.scrollTo({ left: c.offsetLeft - el.offsetLeft - parseFloat(getComputedStyle(el).paddingLeft || '0'), behavior: suave ? 'smooth' : 'auto' });
  }, []);
  useLayoutEffect(() => { ir(inicial, false); setAct(inicial); }, [inicial, ir]);
  // la pestaña de la ronda a la vista, a la vista en su fila (la de la Final quedaba cortada a la derecha)
  const tabs = useRef(null);
  useEffect(() => {
    const t = tabs.current;
    const b = t && t.children[act];
    if (b && t.scrollWidth > t.clientWidth) t.scrollTo({ left: Math.max(0, b.offsetLeft - t.offsetLeft - 16), behavior: 'smooth' });
  }, [act]);
  // la ronda que quedó a la vista
  useEffect(() => {
    const el = pista.current;
    if (!el) return undefined;
    let r = 0;
    const f = () => {
      cancelAnimationFrame(r);
      r = requestAnimationFrame(() => {
        const x = el.scrollLeft;
        let mejor = 0;
        let d0 = Infinity;
        cols.current.forEach((c, i) => {
          if (!c) return;
          const d = Math.abs(c.offsetLeft - el.offsetLeft - parseFloat(getComputedStyle(el).paddingLeft || '0') - x);
          if (d < d0) { d0 = d; mejor = i; }
        });
        setAct(mejor);
      });
    };
    el.addEventListener('scroll', f, { passive: true });
    return () => { el.removeEventListener('scroll', f); cancelAnimationFrame(r); };
  }, []);
  // el alto de la ronda a la vista (y si cambia: una llave en vivo que se completa)
  useEffect(() => {
    const c = cols.current[act];
    if (!c) return undefined;
    const medir = () => setAlto(c.offsetHeight);
    medir();
    if (!window.ResizeObserver) return undefined;
    const ro = new ResizeObserver(medir);
    ro.observe(c);
    return () => ro.disconnect();
  }, [act, rondas]);
  const tiene = (R) => !!ctx.sigo && R.b.some((b) => b[0].some((s) => partes(s).some((m) => ctx.idDe(m) === ctx.sigo)));
  const ult = rondas.length - 1;
  return (
    <>
      <div className="lk-tabs" role="tablist" aria-label="Rondas" ref={tabs}>
        {rondas.map((R, i) => {
          const v = vale[i];
          return (
            <button key={i} type="button" role="tab" aria-selected={i === act} className={(i === act ? 'on' : '') + (tiene(R) || (i === ult && ter && tiene(ter)) ? ' mio' : '')}
              onClick={() => { setAct(i); ir(i, true); }}>
              <b>{R.r}</b>{v ? <small>{v}</small> : null}
            </button>
          );
        })}
      </div>
      <div className={'lk-pista' + (ctx.sigo ? ' siguiendo' : '')} ref={pista} style={alto ? { height: alto } : undefined}>
        {rondas.map((R, i) => (
          <div key={i} className="lk-col" ref={(el) => { cols.current[i] = el; }} role="tabpanel" aria-label={R.r}>
            {R.b.map((b, j) => <Batalla key={j} ctx={ctx} b={b} est={ctx.est(i, j)} copa={i === ult && R.b.length === 1} pasan={ctx.pasan(i)} />)}
            {i === ult && ter ? (
              <>
                <h4 className="lk-ter">Tercer puesto</h4>
                {ter.b.map((b, j) => <Batalla key={'t' + j} ctx={ctx} b={b} est={!b[1] && b[0].length >= 2 && ctx.cerrada ? 'singan' : ''} />)}
              </>
            ) : null}
          </div>
        ))}
      </div>
      {rondas.length > 1 ? <p className="lk-guia">{act < ult ? 'Deslizá para ver ' + rondas[act + 1].r + ' →' : '← Deslizá para ver las rondas de antes'}</p> : null}
    </>
  );
}

// ── EN LA COMPU: el cuadro entero, con sus ramas (`cuadro()` de app.js, con las mismas cuentas) ──
// ⚠️ EN ESPEJO SÓLO SI SE PUEDE: la final en el medio y una mitad de cada lado pide una final con dos ramas. Si no,
// de izquierda a derecha. Y lo que no engancha (un walk-in, un revivido) se dibuja igual, en su columna, sin rama
function Arbol({ ctx, rondas: rs, ter, vale }) {
  const caja = useRef(null);
  const [ancho, setAncho] = useState(1100);
  useLayoutEffect(() => {
    const el = caja.current;
    if (!el) return undefined;
    const medir = () => setAncho(el.clientWidth || 1100);
    medir();
    if (!window.ResizeObserver) return undefined;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // en espejo la final va en el medio: si no entra, se arranca mirándola (una vez)
  const centrar = useRef(true);
  const enEspejo = useRef(false);
  useLayoutEffect(() => {
    const el = caja.current;
    if (!centrar.current || !el || el.scrollWidth <= el.clientWidth) return;
    centrar.current = false;
    if (enEspejo.current) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  });
  const n = rs.length;
  const G = 34;
  const FILA = 32;
  const LINEA = 24;
  const PAD = 3;
  const SEP = 22;
  const nm = (s) => partes(s).length || 1;
  const altoLado = (s) => Math.max(FILA, 8 + LINEA * nm(s));
  const altos = (b) => (b[0].length ? b[0].map(altoLado).concat(b[0].length < 2 ? [FILA] : []) : [FILA, FILA]);
  const alto = (b) => PAD * 2 + altos(b).reduce((a, x) => a + x, 0);
  const hijos = (r, i) => (r ? ((rs[r].b[i] || [])[3] || []).filter((j) => rs[r - 1].b[j]) : []);
  const conPadre = {};
  rs.forEach((R, r) => R.b.forEach((b, i) => hijos(r, i).forEach((j) => { conPadre[(r - 1) + ':' + j] = 1; })));
  const pos = {};
  const colocar = (r, i, cur, lado) => {
    // ⚠️ UNA VEZ: de un grupo donde pasan dos salen dos ramas; la segunda no lo vuelve a dibujar
    if (pos[r + ':' + i]) return null;
    const ys = hijos(r, i).map((j) => colocar(r - 1, j, cur, lado)).filter((v) => v != null);
    let y;
    if (!ys.length) {
      const h = alto(rs[r].b[i]);
      y = cur.y + h / 2;
      cur.y += h + SEP;
    } else y = (Math.min(...ys) + Math.max(...ys)) / 2;
    pos[r + ':' + i] = { r, i, y, lado };
    return y;
  };
  const fin = hijos(n - 1, 0);
  // 🔴 Y SÓLO SI ENTRA: una de octavos en espejo son siete columnas, y a 1.333 px los filtros y la otra punta quedaban
  // cortados a los costados. De izquierda a derecha es más alta pero se ve entera, y bajar es lo natural
  const anchoDe = (cols) => Math.floor((ancho + G) / cols - G);
  const espejo = n >= 3 && rs[n - 1].b.length === 1 && fin.length === 2 && anchoDe(2 * n - 1) >= 150;
  enEspejo.current = espejo;
  const ncol = espejo ? 2 * n - 1 : n;
  const W = Math.max(156, Math.min(232, anchoDe(ncol)));
  const curI = { y: 0 };
  const curD = { y: 0 };
  if (espejo) {
    colocar(n - 2, fin[0], curI, 'i');
    colocar(n - 2, fin[1], curD, 'd');
  } else rs[n - 1].b.forEach((b, i) => colocar(n - 1, i, curI, 'i'));
  rs.forEach((R, r) => R.b.forEach((b, i) => {
    const k = r + ':' + i;
    if (pos[k] || conPadre[k] || (espejo && r === n - 1)) return;
    const cur = espejo && curD.y < curI.y ? curD : curI;
    colocar(r, i, cur, cur === curD ? 'd' : 'i');
  }));
  const HI = Math.max(0, curI.y - SEP);
  const HD = Math.max(0, curD.y - SEP);
  const H = Math.max(HI, HD);
  Object.values(pos).forEach((p) => { p.y += espejo ? (H - (p.lado === 'd' ? HD : HI)) / 2 : 0; });
  if (espejo) pos[(n - 1) + ':0'] = { r: n - 1, i: 0, lado: 'c', y: (pos[(n - 2) + ':' + fin[0]].y + pos[(n - 2) + ':' + fin[1]].y) / 2 };
  const TOPE = 54;
  const col = (p) => (p.lado === 'd' ? 2 * (n - 1) - p.r : p.r);
  const X = (p) => col(p) * (W + G);
  const campeon = (rs[n - 1].b[0] || [])[1] || '';
  const conSigo = (b) => !!ctx.sigo && b[0].some((s) => partes(s).some((m) => ctx.idDe(m) === ctx.sigo));
  const cajas = [];
  const lineas = [];
  let fondo = TOPE + H;
  Object.keys(pos).forEach((k) => {
    const p = pos[k];
    const b = rs[p.r].b[p.i];
    const copa = p.r === n - 1 && rs[n - 1].b.length === 1;
    const h = alto(b);
    cajas.push(<Batalla key={k} ctx={ctx} b={b} est={ctx.est(p.r, p.i)} copa={copa} altos={altos(b)} pasan={ctx.pasan(p.r)}
      style={{ position: 'absolute', left: X(p), top: Math.round(TOPE + p.y - h / 2), width: W, height: h }} />);
    hijos(p.r, p.i).forEach((j) => {
      const c = pos[(p.r - 1) + ':' + j];
      if (!c) return;
      const x1 = c.lado === 'd' ? X(c) : X(c) + W;
      const x2 = c.lado === 'd' ? X(p) + W : X(p);
      const y1 = TOPE + c.y;
      const y2 = TOPE + p.y;
      const xm = (x1 + x2) / 2;
      const hijo = rs[c.r].b[c.i];
      const oro = !!campeon && comparten(hijo[1], campeon) && comparten(b[1], campeon);
      const sig = conSigo(hijo) && conSigo(b) && ctx.sigoPasa(hijo);
      lineas.push(<path key={c.r + ':' + c.i + '>' + k} className={(oro ? 'oro' : '') + (sig ? ' sigue' : '')} d={'M' + x1 + ' ' + y1 + 'H' + xm + 'V' + y2 + 'H' + x2} />);
    });
  });
  const pf = pos[(n - 1) + ':0'];
  if (ter && pf) {
    const bt = ter.b[0];
    const ht = alto(bt);
    const yt = TOPE + pf.y + alto(rs[n - 1].b[0]) / 2 + 64 + ht / 2;
    cajas.push(<span key="tl" className="lk-rl sub" style={{ left: X(pf), width: W, top: Math.round(yt - ht / 2 - 30) }}>Tercer puesto</span>);
    cajas.push(<Batalla key="t" ctx={ctx} b={bt} est={!bt[1] && bt[0].length >= 2 && ctx.cerrada ? 'singan' : ''} altos={altos(bt)}
      style={{ position: 'absolute', left: X(pf), top: Math.round(yt - ht / 2), width: W, height: ht }} />);
    fondo = Math.max(fondo, yt + ht / 2);
  }
  for (let c = 0; c < ncol; c += 1) {
    const r = espejo && c > n - 1 ? 2 * (n - 1) - c : c;
    cajas.push(<span key={'r' + c} className="lk-rl" style={{ left: c * (W + G), width: W }}><b>{rs[r].r}</b>{vale[r] ? <small>{vale[r]}</small> : null}</span>);
  }
  const anchoT = ncol * (W + G) - G;
  const altoT = Math.ceil(fondo + 12);
  return (
    <div className="lk-arbol-caja" ref={caja}>
      <div className={'lk-arbol' + (ctx.sigo ? ' siguiendo' : '')} style={{ width: anchoT, height: altoT }}>
        <svg width={anchoT} height={altoT} aria-hidden="true">{lineas}</svg>
        {cajas}
      </div>
    </div>
  );
}

// 🔑 UN EVENTO DE VIDAS NO ES UNA LLAVE (Dlx, 28/09/2026: «formato tipo 5 vidas, como la Red Bull 5 Vidas»): cada
// batalla le saca una vida al que pierde y el que gana se queda. Arriba las vidas de cada uno; abajo, las batallas en
// el orden en que se pelearon. ⚠️ EL LUGAR LO DA EL MOTOR (`L.tabla`); en vivo, los que siguen en pie primero
function vidasDe(L) {
  const rs = ((L && L.rondas) || []).filter((R) => (R.b || []).length);
  const m = rs.length === 1 && /^(\d+)\s*vidas?$/i.exec(String(rs[0].r || '').trim());
  return m ? +m[1] : 0;
}
function Vidas({ ctx, L, N }) {
  const bs = ((L.rondas || []).find((R) => (R.b || []).length).b || []).map(normB);
  const perd = {};
  const cae = {};
  const sale = [];
  const perdedor = (b) => {
    if (!b[1] || b[0].length !== 2) return null;
    const p = b[0].filter((s) => !gana(b, s));
    return p.length === 1 ? p[0] : null;
  };
  bs.forEach((b, i) => {
    b[0].forEach((s) => { if (!(s in perd)) perd[s] = 0; });
    const p = perdedor(b);
    if (p == null) { sale.push(null); return; }
    perd[p] += 1;
    if (perd[p] === N) cae[p] = i + 1;
    sale.push([p, perd[p]]);
  });
  const gente = Object.keys(perd);
  const lugar = {};
  (L.tabla || []).forEach((r, i) => gente.forEach((s) => { if (!(s in lugar) && comparten(r[0], s)) lugar[s] = i; }));
  const ordenVivo = (s) => (cae[s] ? 1000 - cae[s] : perd[s]);
  gente.sort((a, b) => ((L.tabla || []).length ? (a in lugar ? lugar[a] : 99) - (b in lugar ? lugar[b] : 99) : ordenVivo(a) - ordenVivo(b)));
  return (
    <div className={'lk-vd' + (ctx.sigo ? ' siguiendo' : '')}>
      <ol className="lk-vd-t">
        {gente.map((s, i) => (
          <li key={s} className={(cae[s] ? '' : 'pie') + (partes(s).some((m) => ctx.idDe(m) === ctx.sigo) ? ' sigue' : '')}>
            <b className="lk-vd-l">{i + 1}.º</b>
            <span className="lk-vd-n"><Persona ctx={ctx} x={s} /></span>
            <span className="lk-vd-cs" aria-label={(N - perd[s]) + ' de ' + N + ' vidas'}>
              {Array.from({ length: N }, (_, k) => <i key={k} className={k < N - perd[s] ? '' : 'x'}>{k < N - perd[s] ? '♥' : '♡'}</i>)}
            </span>
            <small>{cae[s] ? 'cayó en la batalla ' + cae[s] : '🏆 en pie'}</small>
          </li>
        ))}
      </ol>
      <h3 className="lk-h">Batalla por batalla<small>{bs.length} batallas</small></h3>
      <div className="lk-vd-bs">
        {bs.map((b, i) => {
          const x = sale[i];
          const ult = x && x[1] === N;
          const sigue = !!ctx.sigo && b[0].some((s) => partes(s).some((m) => ctx.idDe(m) === ctx.sigo));
          return (
            <div key={i} className={'lk-b' + (sigue ? ' sigue' : '')} title={b[2] || undefined}>
              <div className="lk-et"><span className="num">Batalla {i + 1}</span>{L.veredictos && b[2] ? <span>{b[2]}</span> : null}</div>
              {b[0].map((s, j) => (
                <div key={j} className={'lk-l' + (gana(b, s) ? ' g' : (b[1] ? ' x' : ''))}>
                  <span className="lk-ns"><Persona ctx={ctx} x={s} perdio={!!b[1] && !gana(b, s)} /></span>
                  {gana(b, s) ? <span className="lk-ok" aria-label="Ganó y se queda">✓</span>
                    : x && x[0] === s ? <span className={'lk-vd-m' + (ult ? ' ult' : '')}>{ult ? 'sin vidas' : '−1 ♥ · le quedan ' + (N - x[1])}</span> : null}
                </div>
              ))}
              {x ? null : <p className="lk-vd-sin">{/réplica/.test(b[2] || '') ? 'Réplica: se vuelve a pelear.' : L.vivo && i === bs.length - 1 ? 'Se está votando.' : 'Sin ganador: no le sacó vida a nadie.'}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 🔑 LA FASE DE UNA NAVE DE FUNA (cypher; Dlx, 29/09/2026): una lista con ❌ en los que cayeron, sin orden
function Funa({ ctx, L }) {
  const fs = (L && L.funa) || [];
  if (!fs.length) return null;
  const quedan = fs.filter((x) => !x[1]).length;
  // 🔑 RONDA POR RONDA, SI LA LLAVE LO DICE (Dlx, 03/10/2026, con la NAVE DE EXTERMINACIÓN: «¿podrías dar más detalles?
  // no siempre va a haber muchos detalles, pero en este caso sí»). «ELIMINADO #3» es en qué ronda cayó: cada ronda con
  // los suyos, y al final los que siguen. Sin números, la lista de siempre
  const rs = [...new Set(fs.filter((x) => x[1] && x[2]).map((x) => x[2]))].sort((a, b) => a - b);
  if (rs.length) {
    const sinNum = fs.filter((x) => x[1] && !x[2]);
    const siguen = fs.filter((x) => !x[1]);
    const fila = (et, xs, cls) => (
      <li key={et} className={'lk-fr ' + (cls || '')}>
        <b className="lk-fr-n">{et}<small>{cls === 'siguen' ? xs.length + (xs.length === 1 ? ' sigue' : ' siguen') : xs.length + (xs.length === 1 ? ' cayó' : ' cayeron')}</small></b>
        <ul>{xs.map((x, i) => <li key={i} className={x[1] ? 'cae' : ''}><Persona ctx={ctx} x={x[0]} perdio={!!x[1]} /></li>)}</ul>
      </li>
    );
    return (
      <div className="lk-funa con-rondas">
        <h3 className="lk-h">Fase de eliminación<small>{fs.length} raperos · {rs.length} rondas · {quedan === 1 ? 'queda 1' : 'quedan ' + quedan}</small></h3>
        <ol>
          {rs.map((r) => fila('Ronda ' + r, fs.filter((x) => x[1] && x[2] === r)))}
          {sinNum.length ? fila('Sin ronda', sinNum) : null}
          {siguen.length ? fila('A la llave', siguen, 'siguen') : null}
        </ol>
      </div>
    );
  }
  return (
    <div className="lk-funa">
      <h3 className="lk-h">Fase de eliminación<small>{fs.length} raperos · {quedan === fs.length ? 'se juega' : 'quedan ' + quedan}</small></h3>
      <ul>
        {fs.map((x, i) => (
          <li key={i} className={x[1] ? 'cae' : ''}><Persona ctx={ctx} x={x[0]} perdio={!!x[1]} />{x[1] ? <i className="lk-cae" title="Cayó en la fase">❌</i> : null}</li>
        ))}
      </ul>
    </div>
  );
}

// ── quien se sigue: abajo, fija, con cómo le fue y su perfil ──
function Barra({ ctx, tb }) {
  if (!ctx.sigo) return null;
  const k = ctx.sigo.indexOf('k:') === 0 ? ctx.sigo.slice(2) : '';
  const f = k ? ctx.liga.T[k] : null;
  const nombre = f ? limpio(f.n) : ctx.nombres[ctx.sigo] || '';
  const p = ctx.pts[ctx.sigo];
  const res = p ? (MEDALLA[p[0]] ? MEDALLA[p[0]] + ' ' + p[0] : 'Quedó en ' + p[0]) + ' · ' + num(p[1]) + ' pts'
    : ctx.L.vivo ? 'Se juega ahora' : 'Sin puntos en esta llave';
  return (
    <aside className="lk-barra" style={{ '--lk-tb': tb + 'px' }} aria-live="polite">
      <Cara liga={ctx.liga} k={k} nombre={nombre} cls="lk-bcara" />
      <span className="lk-bt"><b>{nombre}</b><small>{res}</small></span>
      {k ? <a className="btn verde chico" href={'#/r/' + encodeURIComponent(k)}>Perfil</a> : null}
      <button type="button" className="lk-bx" onClick={() => ctx.seguir('')} aria-label="Dejar de seguir">×</button>
    </aside>
  );
}

// ── ¿algo está mal en esta llave? Lo revisa la Liga, nunca por DM (Dlx, 28/09/2026: «ok») ──
const REP_QUE = [['ganador', 'El ganador está mal'], ['gente', 'Falta o sobra alguien'], ['nombre', 'Un nombre está mal'], ['otro', 'Otra cosa']];
function Reporte({ n }) {
  const [abierto, setAbierto] = useState(false);
  const [que, setQue] = useState('');
  const [txt, setTxt] = useState('');
  const [est, setEst] = useState('');
  const [va, setVa] = useState(false);
  const [ok, setOk] = useState(false);
  if (ok) return <p className="lk-rep-ok">✓ ¡Gracias! Lo revisa la Liga.</p>;
  if (!abierto) return <button type="button" className="btn borde2 chico" onClick={() => setAbierto(true)}>¿Algo está mal en esta llave?</button>;
  const enviar = () => {
    const t = txt.replace(/\s+/g, ' ').trim();
    if (!que || va) return;
    if (que === 'otro' && t.length < 3) { setEst('Contá qué pasó.'); return; }
    if (!window.conCuenta) { setEst('No pude mandarlo. Probá de nuevo en un rato.'); return; }
    setVa(true);
    setEst('');
    window.conCuenta('/api/avisos/reportar', { llave: String(n), que, texto: t }).then((j) => {
      setVa(false);
      if (j && j.ok) { setOk(true); return; }
      const e = (j && j.error) || '';
      setEst((window.errorCuenta && window.errorCuenta(e)) || (j && j.status === 401 ? 'Para reportar, entrá con Discord desde Mi cuenta.'
        : e === 'nueva' ? 'Tu cuenta de Discord es muy nueva para reportar.'
          : e === 'tope' ? 'Ya mandaste varios hoy: probá mañana.' : 'No pude mandarlo. Probá de nuevo en un rato.'));
    }).catch(() => { setVa(false); setEst('No pude mandarlo. Probá de nuevo en un rato.'); });
  };
  return (
    <div className="lk-rep">
      <p className="lk-rep-t">Contanos qué está mal y lo revisa la Liga.</p>
      <div className="lk-rep-q" role="group" aria-label="Qué está mal">
        {REP_QUE.map(([id, et]) => <button key={id} type="button" aria-pressed={que === id} className={que === id ? 'on' : ''} onClick={() => setQue(id)}>{et}</button>)}
      </div>
      <textarea aria-label="Qué está mal en la llave" maxLength={300} rows={3} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={'Qué batalla y qué pasó' + (que === 'otro' ? '' : ' (si querés)')} />
      <div className="lk-rep-pie">
        <button type="button" className="btn verde chico" disabled={!que || va} onClick={enviar}>{va ? 'Enviando…' : 'Enviar'}</button>
        <span aria-live="polite">{est}</span>
      </div>
      <p className="lk-rep-nota">Se guarda con tu cuenta de Discord 30 días, para revisarlo.</p>
    </div>
  );
}

// ── la página ──
export function Llave({ liga, vivoL, n: n0, raiz, dc }) {
  let n = n0;
  try { n = decodeURIComponent(n0); } catch (e) { /* tal cual */ }
  const enVivo = String(n).indexOf('v:') === 0;
  const deLobby = enVivo ? (vivoL || {})[String(n).slice(2)] : (liga.d.llaves || {})[n];
  const [vieja, setVieja] = useState(undefined);
  useEffect(() => {
    if (deLobby || enVivo) return undefined;
    let vivo = true;
    setVieja(undefined);
    pedirTodas().then((t) => { if (vivo) setVieja((t && t[n]) || null); });
    return () => { vivo = false; };
  }, [n, deLobby, enVivo]);
  const L = deLobby || vieja || null;
  // 🎟️ «MIRÁ UNA LLAVE EN VIVO», la Tarea del Pase (05/10/2026): con tu cuenta y después de 20 segundos con la llave
  // abierta —tocarla y volver no es mirarla—. Si no sos miembro de DRA, el servidor no la cuenta
  const seJuega = enVivo && !!L && !!L.vivo && !L.terminada;
  // ✅ Y DICE SI CONTÓ (Dlx, 07/10/2026: «ya lo hice pero no recibo nada»): una llave terminada y una que se juega se
  // veían igual, y la Tarea no decía nada en ninguno de los dos casos
  const [contoPase, setContoPase] = useState(false);
  useEffect(() => {
    setContoPase(false);
    if (!dc || !seJuega) return undefined;
    const t = setTimeout(() => vioVivo(String(n).slice(2)).then((r) => { if (r && r.cuenta) setContoPase(true); }), 20000);
    return () => clearTimeout(t);
  }, [dc && dc.id, seJuega, n]);
  const tareaVivo = dc && !seJuega ? vivoPendiente() : null;
  const [sigo, setSigo] = useState('');
  useEffect(() => { window.scrollTo(0, 0); setSigo(''); }, [n]);
  useEffect(() => {
    if (!L) return undefined;
    const poner = () => { document.title = (limpio(L.nombre) || 'La llave') + ' · Liga Global de Freestyle'; };
    poner();
    const r = setTimeout(poner, 0);
    return () => clearTimeout(r);
  }, [L]);
  // el alto de la barra de abajo del celular: la de quien se sigue va justo encima (como «tu lugar» del Ranking)
  const [tb, setTb] = useState(0);
  useEffect(() => {
    const medir = () => {
      const r = raiz && raiz.current;
      const b = r && r.querySelector('.tabbar');
      setTb(b && b.offsetParent !== null ? b.offsetHeight : 0);
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [raiz]);
  const compu = useCompu();
  const seguir = useCallback((id) => setSigo((s) => (s === id || !id ? '' : id)), []);

  // todo lo que sale de la llave, una vez por llave (y por quién se sigue)
  const base = useMemo(() => {
    if (!L) return null;
    const fila = (x) => liga.fila(x);
    const idDe = (x) => { const f = fila(x); return f ? 'k:' + f.k : 'n:' + clave(x); };
    const nombres = {};
    // 🔑 EL EQUIPO QUE LA LLAVE NOMBRA CON UN SOLO NOMBRE Y NADIE SABE QUIÉNES SON (`sin`, del lector; Dlx, 29/09/2026:
    // «TEAM VENECIA no es un participante… es un equipo»): sin cara, sin perfil y sin puntos. Sin el paréntesis
    const sinP = (x) => clave(String(x || '').replace(/[(（][^()（）]*[)）]/g, ''));
    const sinK = new Set((L.sin || []).map(sinP));
    const esSin = (x) => sinK.has(sinP(x));
    // los puntos y el lugar de cada uno en esta llave (la barra de quien se sigue)
    const pts = {};
    (L.tabla || []).forEach((r) => partes(r[0]).forEach((m) => {
      const id = r[3] && partes(r[0]).length === 1 ? 'k:' + r[3] : idDe(m);
      pts[id] = [r[1], r[2]];
      nombres[id] = sinBanderas(m).txt;
    }));
    // 🔑 MOST WANTED EN LA LLAVE (Dlx, 27/09/2026): el que cazaron ACÁ lleva 🎯 en la batalla que perdió; en una en
    // vivo, el buscado suelto lleva 🎯 y su recompensa
    const mw = liga.d.mw || {};
    const cazas = (mw.ce && mw.ce[String(n)]) || [];
    const cazado = {};
    cazas.forEach((c) => { const f = fila(c[0]); cazado[f ? f.k : c[0]] = c; });
    const mwDe = (x) => { const f = fila(x); return (mw.b || []).find((y) => y.n === x || (f && y.k === f.k)) || null; };
    const marca = (x, f, perdio) => {
      const k = f ? f.k : x;
      if (cazado[k]) return perdio ? <i className="lk-mw cz" title={'Lo cazaron acá (' + cazado[k][1] + ')'}>🎯</i> : null;
      const y = L.vivo && mwDe(x);
      return y && y.e === 'suelto' ? <i className="lk-mw" title={'Buscado · ' + y.cn + ' · ' + num(y.v) + ' pts'}>🎯</i> : null;
    };
    // en una en vivo, quiénes de los buscados juegan: es la invitación a cazar
    const aca = [];
    if (L.vivo) {
      const visto = {};
      (L.rondas || []).forEach((R) => (R.b || []).forEach((b) => (b[0] || []).map(texto).forEach((s) => partes(s).forEach((m) => {
        const y = mwDe(m);
        if (y && y.e === 'suelto' && !visto[y.n]) { visto[y.n] = 1; aca.push(y); }
      }))));
    }
    // 🔑 EL CLÁSICO: los mismos dos, cruzándose en su tercer evento o más. En vivo, con lo que llevan
    const clasico = (b) => {
      const ls = b[0] || [];
      if (ls.length !== 2 || /[,+]/.test(ls[0] + ls[1])) return null;
      const [a, c] = ls;
      const x = (L.clasicos || []).find((y) => (y[0] === a && y[1] === c) || (y[0] === c && y[1] === a));
      if (x) return x[0] === a ? [a, c, x[2], x[3]] : [a, c, x[3], x[2]];
      const R = liga.d.rivales;
      if (L.vivo && R) {
        const fa = fila(a);
        const fc = fila(c);
        const r = fa && fc && R[[fa.k, fc.k].sort().join('|')];
        if (r) return [a, c, r[fa.k] || 0, r[fc.k] || 0];
      }
      return null;
    };
    // las rondas: la principal (sin el tercer puesto) y el tercer puesto aparte
    const rs = (L.rondas || []).map((R) => ({ r: R.r, b: (R.b || []).map(normB) })).filter((R) => R.b.length);
    const ter = rs.find((R) => R.r === 'Tercer puesto') || null;
    let prin = rs.filter((R) => R.r !== 'Tercer puesto');
    const cerrada = !L.vivo || !!L.terminada;
    // 🔑 EN VIVO, LA LLAVE COMPLETA: las rondas que faltan y los cruces que no se jugaron, vacíos (`completar()` del
    // escenario), con sus ramas. Sólo si se arma como árbol: si no, cada cruce en el orden en que vino
    if (!cerrada) {
      const previas = prin.filter((R) => PREVIAS.includes(R.r));
      const cuadro = prin.filter((R) => !PREVIAS.includes(R.r));
      const todas = completar(cuadro);
      if (todas !== cuadro && esArbol(todas)) {
        const llenas = todas.map((R, i) => ({ r: R.r, b: R.b.map((b, j) => { const x = normB(b); if (i) x[3] = [2 * j, 2 * j + 1]; return x; }) }));
        prin = previas.concat(llenas);
      }
    }
    // los puntos de quedar afuera en cada ronda: el mismo número para todos, o nada
    const ptsM = {};
    (L.tabla || []).forEach((t) => miembros(t[0]).forEach((m) => { ptsM[m] = t[2]; }));
    const valeR = (R) => {
      const vs = [];
      R.b.forEach((b) => b[0].forEach((s) => { if (b[1] && gana(b, s)) return; miembros(s).forEach((m) => { if (ptsM[m] != null) vs.push(ptsM[m]); }); }));
      return vs.length && vs.every((v) => v === vs[0]) ? vs[0] : null;
    };
    const ult = prin.length - 1;
    const final = ult >= 0 && prin[ult].b.length === 1 ? prin[ult].b[0] : null;
    const ptsCamp = (() => {
      if (!final || !final[1]) return '';
      const ps = miembros(final[1]).map((m) => ptsM[m]).filter((v) => v != null);
      if (!ps.length) return '';
      const lo = Math.min(...ps);
      const hi = Math.max(...ps);
      return lo === hi ? num(hi) : num(lo) + '–' + num(hi);
    })();
    const vale = prin.map((R, i) => {
      const v = valeR(R);
      const t = v != null ? num(v) + ' pts' : '';
      return i === ult && final && ptsCamp ? (t ? t + ' · ' : '') + '🏆 ' + ptsCamp : t;
    });
    // quiénes pasaron de un grupo donde pasan varios: los que aparecen en la ronda siguiente
    const pasanDe = prin.map((R, i) => {
      if (!prin[i + 1] || !R.b.some((b) => /pasan [2-9]/.test(b[2]))) return null;
      const sig = new Set();
      prin[i + 1].b.forEach((b) => b[0].forEach((s) => miembros(s).forEach((m) => sig.add(m))));
      return (s) => miembros(s).some((m) => sig.has(m));
    });
    // AHORA y SIGUE, sólo si se juega en orden (`enOrden()`): si no, no se sabe cuál se está jugando. Jugado es con
    // ganador o con alguno de sus lados ya en la ronda siguiente (`jugado()`: en un grupo de tres pueden pasar dos)
    const pend = [];
    if (!cerrada && enOrden(prin)) prin.forEach((R, i) => R.b.forEach((b, j) => { if (!jugado(prin, i, b) && b[0].length >= 2) pend.push(i + ':' + j); }));
    const est = (i, j) => {
      const b = prin[i] && prin[i].b[j];
      if (!b) return '';
      if (pend[0] === i + ':' + j) return 'ahora';
      if (pend[1] === i + ':' + j) return 'sigue';
      return cerrada && !jugado(prin, i, b) && b[0].length >= 2 ? 'singan' : '';
    };
    // la ronda con la que abre el celular: la que se está jugando; terminada, la primera
    const enJuego = prin.findIndex((R, i) => R.b.some((b) => !jugado(prin, i, b) && b[0].length >= 2));
    const inicial = !cerrada && enJuego >= 0 ? enJuego : 0;
    // el nombre de cada uno, para la barra de quien se sigue (también los que no están en la tabla de la llave)
    prin.concat(ter ? [ter] : []).forEach((R) => R.b.forEach((b) => b[0].forEach((s) => partes(s).forEach((m) => {
      const id = idDe(m);
      if (!nombres[id]) nombres[id] = sinBanderas(m).txt;
    }))));
    (L.funa || []).forEach((x) => { const id = idDe(x[0]); if (!nombres[id]) nombres[id] = sinBanderas(x[0]).txt; });
    return { fila, idDe, nombres, esSin, pts, marca, cazas, aca, clasico, prin, ter, cerrada, vale, pasanDe, est, inicial, final };
  }, [L, liga, n]);

  if (!L) {
    if (!enVivo && vieja === undefined) return <div className="cargando">Buscando la llave…</div>;
    return (
      <section className="sec lk-sec">
        <div className="sec-t"><h2>{enVivo ? 'Esa llave ya no se está jugando' : 'Esa llave no está'}</h2></div>
        <p className="pronto-p">{enVivo ? 'Terminó o se borró: cuando el ciclo la procese, va a estar en Eventos con sus puntos.'
          : 'Puede ser de otra temporada, o el link está mal copiado.'} <a className="te-link" href="#/eventos">Ver los eventos</a></p>
      </section>
    );
  }
  const ctx = Object.assign({}, base, {
    liga, L, n, sigo, seguir,
    pasan: (i) => base.pasanDe[i] || null,
    // una rama es del camino de quien se sigue si esa persona pasó de la batalla de abajo
    sigoPasa: (b) => !!b[1] && partes(b[1]).some((m) => base.idDe(m) === sigo),
  });

  // ── la ficha: formato, rango, cuándo, cuántos, quién organizó y el premio (Dlx, 25/09/2026: «mostrar el formato…
  // pandillas, 1v1, el rango») ──
  const sv = liga.svs[L.sv] || {};
  const inf = L.info || {};
  const pas = (liga.d.pasados || []).find((p) => String(p.llave) === String(n));
  const cal = (liga.d.calendario || []).find((c) => String(c.ll) === String(n));
  const mod = inf.mod || (pas && pas.modalidad) || '';
  const rgo = inf.rg || (pas && pas.rango) || '';
  const org = inf.org || (pas && pas.org) || '';
  const fOrg = org ? liga.fila(org) : null;
  const mR = /^Rango (\w+)$/.exec(String(rgo || ''));
  const asc = sv.rangos && mR && sv.rangos[mR[1]] ? sv.rangos[mR[1]].map((p, i) => (i < 3 ? (i + 1) + '°' : '4°') + ' ' + num(p)).join(' · ') : '';
  const mult = L.vivo ? liga.multSv(L.sv) : null;
  const cuando = cal ? liga.dia(cal.t) : L.vivo ? '' : L.fecha;
  const dia = cal ? liga.diaClave(cal.t) : (L.dia || '');
  // ── el podio ──
  const puesto = (p) => (L.tabla || []).filter((r) => r[1] === p);
  const podio = [['Campeón', '🥇', 'p1'], ['Subcampeón', '🥈', 'p2'], ['Tercero', '🥉', 'p3']].map(([p, m, c]) => {
    const rs = puesto(p);
    if (!rs.length) return null;
    // ⚠️ UN EQUIPO NO SIEMPRE SUMA PAREJO: en GENESIS el revivido se llevó 3000 y sus compañeros 2500
    const ps = rs.map((r) => +r[2] || 0);
    const lo = Math.min(...ps);
    const hi = Math.max(...ps);
    return { p, m, c, rs, pts: lo === hi ? num(hi) : num(lo) + ' a ' + num(hi) };
  }).filter(Boolean);
  // ── los puntos, por puesto ──
  const grupos = {};
  const orden = [];
  (L.tabla || []).forEach((r) => { if (!grupos[r[1]]) { grupos[r[1]] = []; orden.push(r[1]); } grupos[r[1]].push(r); });
  orden.sort((a, b) => { const x = ORD_P.indexOf(a); const y = ORD_P.indexOf(b); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y); });
  const N = vidasDe(L);
  const hayR = base.prin.length > 0;
  const fechaEv = cal ? '#/eventos/' + liga.diaClave(cal.t) : dia ? '#/eventos/' + dia : '#/eventos';
  return (
    <>
      <div className="escena lk-esc" style={{ '--mo-c': sv.color || '#E41373', '--mo-o': 0.85, '--mo-c2': '#29B298' }}>
        <section className="lk-cab">
          <a className="lk-volver" href={fechaEv}>‹ Eventos</a>
          <div className="lk-cab-in">
            {L.sv && liga.logo(L.sv) ? <img className="lk-logo" src={liga.logo(L.sv)} alt="" width="56" height="56" /> : null}
            <div className="lk-cab-tx">
              <span className="tag">{L.vivo ? (L.terminada ? 'TERMINÓ · ' : '● EN VIVO · ') : (cuando ? cuando.toUpperCase() + ' · ' : '')}{(sv.nombre || L.sv || '').toUpperCase()}</span>
              {/* una palabra muy larga («EXTERMINACION») se partía en el celular («EXTERMINAC / ION»): más chica */}
              <h1 className={'hero-ev largo lk-tit' + (Math.max(0, ...String(limpio(L.nombre) || '').split(/\s+/).map((w) => w.length)) >= 11 ? ' pal-larga' : '')}>{limpio(L.nombre) || 'La llave'}</h1>
            </div>
          </div>
          <ul className="lk-datos">
            {mod ? <li>🎤 {mod}</li> : null}
            {rgo ? <li title={asc ? 'Puntos de ascenso en ' + (sv.nombre || L.sv) + ' (no en la Liga): ' + asc : undefined}>{rgo}{asc ? <small> · {asc}</small> : null}</li> : null}
            {L.participantes ? <li>{L.participantes} raperos</li> : null}
            {org ? <li>organizó {fOrg ? <a href={'#/r/' + encodeURIComponent(fOrg.k)}>{limpio(fOrg.n)}</a> : <b>{limpio(org)}</b>}</li> : null}
            {inf.pre ? <li>🏅 {inf.pre}</li> : null}
            {mult && mult !== 1 ? <li className="lk-mult">×{String(mult).replace('.', ',')} esta semana</li> : null}
          </ul>
          {L.vivo ? (
            <p className="lk-vivo">{L.terminada ? 'Terminó: los puntos llegan cuando el ciclo la procese' : (L.enJuego || 'En juego') + ' en juego'}
              {' · se actualiza sola cada minuto · último cambio ' + hace(L.ed || L.pub || Date.now())}</p>
          ) : null}
          {contoPase ? <p className="lk-pase si" role="status">✓ Contó para tu Pase: miraste esta llave en vivo</p> : null}
          {tareaVivo ? <p className="lk-pase">🎟️ Tu Tarea «{tareaVivo.t}» cuenta con una llave que se esté jugando, y ésta ya terminó. Las que se juegan están en <a href="#/">En vivo, en el Inicio</a>.</p> : null}
          {/* 🔝 ARRIBA DE TODO (Dlx, 03/10/2026: «estas cosas dentro de la llave deberían estar arriba de todo, no
              debajo»): ir a Discord, compartir y avisar si algo está mal. Estaban al pie, después del cuadro entero */}
          <div className="lk-acc-b">
            {(L.links || []).map((u, i, t) => <a key={u} className="btn borde2 chico" href={u} target="_blank" rel="noopener noreferrer">{t.length > 1 ? 'Llave ' + (i + 1) : 'La llave en Discord'} ↗</a>)}
            {L.vivo ? null : <Compartir cls="btn borde2 chico" url={enlace('#/llave/' + encodeURIComponent(n))} texto={'La llave de ' + limpio(L.nombre)} etiqueta="Compartir" />}
            <Reporte n={n} />
          </div>
        </section>
        {podio.length ? (
          <ol className={'lk-podio n' + podio.length} aria-label="El podio">
            {podio.map((x) => (
              <li key={x.p} className={'lk-pd ' + x.c}>
                <span className="lk-pd-caras">{x.rs.map((r, i) => { const f = base.fila(r[0]); return <Cara key={i} liga={liga} k={f ? f.k : ''} nombre={f ? f.n : sinBanderas(r[0]).txt} cls="lk-pd-cara" />; })}</span>
                <span className="lk-pd-ns">{x.rs.map((r, i) => <Persona key={i} ctx={ctx} x={r[0]} conCara={false} />)}</span>
                <small>{x.m} {x.p} · {x.pts} pts</small>
              </li>
            ))}
          </ol>
        ) : null}
        {base.cazas.length || base.aca.length ? (
          <div className="lk-mwtx">
            {base.cazas.map((c, i) => <p key={i}>🎯 Acá cazaron a <b>{limpio(c[0])}</b> ({c[1]}): {c[2].length ? <>cobró <b>{c[2].map(limpio).join(' y ')}</b></> : 'no cobró nadie'}.</p>)}
            {base.aca.length ? <p>🎯 {base.aca.length === 1 ? 'Juega un buscado' : 'Juegan ' + base.aca.length + ' buscados'}: {base.aca.map((y, i) => <span key={i}>{i ? ', ' : ''}<b>{limpio(y.n)}</b> ({y.cn}, {num(y.v)} pts)</span>)}. Quien le gane, cobra.</p> : null}
          </div>
        ) : null}
        {/* 🔝 los puntos, también arriba: cerrados, son un renglón; lo que se vino a ver es la llave */}
        {orden.length ? (
          <details className="lk-pts lk-pts-top">
            <summary><span>Los puntos de esta llave</span><small>{(L.tabla || []).length}</small></summary>
            <div className="lk-pgs">
              {orden.map((g) => (
                <div key={g} className="lk-pg">
                  <h4>{MEDALLA[g] ? MEDALLA[g] + ' ' : ''}{g}<small>{grupos[g].length}</small></h4>
                  <ul>
                    {grupos[g].map((r, i) => {
                      const f = r[3] ? liga.T[r[3]] : base.fila(r[0]);
                      return <li key={i}>{f ? <a href={'#/r/' + encodeURIComponent(f.k)}><Nombre x={r[0]} f={f} /></a> : <span><Nombre x={r[0]} /></span>}<b>{num(r[2])}</b></li>;
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>

      {/* 🎨 LA LLAVE, SOBRE LA PIEL (Dlx, 03/10/2026). En blanco: «es muy blanco eso de las llaves página»; en negro:
          «ahora está muy negro… todo». El escenario negro arriba y el cuadro sobre la piel (`--caja`, el color de lo ya
          jugado, que a Dlx le gusta), con las casillas en blanco encima */}
      <section className="sec lk-sec piel">
        <div className="sec-t"><h2>{N ? N + ' vidas' : 'La llave'}</h2>{L.participantes ? <span className="lk-sub">{L.participantes} raperos</span> : null}</div>
        {hayR || (L.funa || []).length ? <p className="lk-ayuda">{N ? 'Cada batalla le saca una vida al que pierde y el que gana se queda. Con ' + N + ' derrotas quedás afuera.' : 'Tocá un nombre y se marca su camino.'}</p> : null}
        <Funa ctx={ctx} L={L} />
        {N ? <Vidas ctx={ctx} L={L} N={N} />
          : !hayR ? ((L.funa || []).length ? null : <p className="pronto-p">Esta llave todavía no tiene batallas.</p>)
            : compu ? <Arbol ctx={ctx} rondas={base.prin} ter={base.ter} vale={base.vale} />
              : <Pista ctx={ctx} rondas={base.prin} ter={base.ter} inicial={base.inicial} vale={base.vale} />}
        <Barra ctx={ctx} tb={tb} />
      </section>
    </>
  );
}

