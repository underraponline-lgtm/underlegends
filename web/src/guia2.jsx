// 📖 LA GUÍA, EL REMAKE (02/11/2026). Dlx: «terminar de remakear las restantes». Se ve con `?prev=remake` (App.jsx
// `REMAKE`); sin la marca sigue la de guia.jsx. Es la misma Guía —los textos son los de guia.jsx, importados: hay una
// sola copia— ordenada para buscarse en vez de leerse de punta a punta (8.500 px en la compu, 14.600 en el celular), con
// lo que dejó el research de 21st (scratchpad/remake2/research_tienda_salon_guia_socios.md):
// - UN BUSCADOR para toda la Guía que encuentra la RESPUESTA y no sólo la sección: las palabras, la semana, los TAG, las
//   preguntas, cada fila de los puntos, cada rango con su material y cada parte del OVR y del Score. Al tocar un
//   resultado cambia la pestaña de TAG, abre la banda o la pregunta, baja hasta la cosa y la marca.
// - UN ÍNDICE que sigue la lectura (indice.js, el mismo del Salón y de servidor/país/crew): en la compu, pegado a la
//   izquierda; en el celular, una fila de chips, y el primero es la lupa que vuelve al buscador.
// - LOS TAG COMO UN TABLERO DE RAREZAS: una banda por nivel y las fichas en grilla (eran 44 renglones de media pantalla).
// - LOS PESOS Y LOS RANGOS COMO BARRAS DE 100 %: el OVR y el Score en una barra cada uno, los rangos en una regla de 0 a 100.
// - LO DE CADA SEMANA EN FICHAS, con su cifra arriba; las palabras y las preguntas en dos columnas en la compu.
// ⚠️ EL ORDEN ES EL DE LA GUÍA DE HOY: el de «4. A» (Dlx, 02/10/2026) con los TAG después de las tarjetas, donde
// entraron el 19/10 («me gusta todo»). La crítica del remake propuso bajarlos; no se movieron: se achicaron en el celular.
// ⚠️ LOS NÚMEROS SALEN DE DONDE SE CALCULAN (`guia`, `requisitos`, `rangos` del payload, como en guia.jsx). Las cifras de
// las fichas de la semana son las mismas que dice su texto, al lado.
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import TAGS from './tags_catalogo.json';
import { norm, num } from './liga.js';
import { Carta, Ico, Medalla, PUESTO_MEDALLA } from './piezas.jsx';
import { MW_TIENDA, NOMBRE_EV, PALABRAS, PREGUNTAS, PUESTOS, SEMANA, pideLargo } from './guia.jsx';
import { useIndice } from './indice.js';
import CSS_PAGINA from './css/guia2.css?inline';
import { usarCss } from './css.js';

usarCss('guia2', CSS_PAGINA);

const PrimerosPasos = lazy(() => import('./tutorial.jsx').then((m) => ({ default: m.PrimerosPasos })));

// la cifra de cada cosa de la semana y cuándo pasa (lo mismo que dice su texto). Sin cifra donde no hay un número que
// diga algo: «Para siempre» en las Insignias y «📣» en Con tiempo repetían el título (crítica del 02/11/2026)
const CIFRA = {
  'Multiplicador': ['×0,5 a ×5', 'Lunes 11 AM'], 'Evento dorado': ['×3', 'Cada semana'], 'Guerra de servidores': ['×1,5', 'Cada semana'],
  'Copa de la Liga': ['×2', 'Cada semana'], 'Semillero': ['×1,5', 'Cada semana'], 'Meta de comunidad': ['+10 %', 'Lunes'],
  'Bonos': ['+1.500', 'Al jugar'], 'Clásico': ['+10 %', 'Al cruzarse'], 'Misiones': ['3 misiones', 'Lunes 11 AM'],
  'Ranking ELO': ['6 piedras', 'Cada lunes'], 'Pase de rapero': ['30 niveles', 'La temporada'], 'Premios de la semana': ['4 premios', 'Al cerrar la semana'],
};
const CARTAS_TAG = [['temporada', 'Temporada'], ['competitivo', 'Competitiva'], ['servidor', 'Servidor'], ['pais', 'País']];
const NIVELES = ['t1', 't2', 't3', 't4'];
// cuántos TAG se ven por banda antes de «Ver los N»: nueve en la compu (tres filas), cuatro en el celular. Y se corta
// sólo si quedan tres o más escondidos: «Ver los 11» para esconder dos era un botón para casi nada
const TOPE = { d: 9, m: 4 };
const corta = (n, tope) => n - tope >= 3;
const DURA = { temporada: 'esta temporada', siempre: 'para siempre', semana: 'esta semana', estado: 'mientras dure' };
// los colores de las partes de una barra de 100 %: los de la casa
const PARTES = ['var(--tinta)', 'var(--verde)', 'var(--magenta)', '#8A8F98', '#F2B705'];
const nombreTag = (t) => t.replace(' x%d', ' ×N').replace('%d', 'N');

// el texto plano de algo de React (las respuestas de las preguntas traen links y código), para buscarlo
function plano(n) {
  if (n == null || typeof n === 'boolean') return '';
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  if (Array.isArray(n)) return n.map(plano).join('');
  return n.props ? plano(n.props.children) : '';
}
const raiz = () => { const h = document.getElementById('inicio-nuevo'); return h && h.shadowRoot; };
// la palabra buscada, marcada
function Marca({ t, q }) {
  if (!q) return t;
  const i = norm(t).indexOf(q);
  if (i < 0) return t;
  return <>{t.slice(0, i)}<mark>{t.slice(i, i + q.length)}</mark>{t.slice(i + q.length)}</>;
}

// una ficha de la semana: la cifra arriba y el texto entero (en el celular era una columna de 84 px que no alcanzaba
// para «30 niveles» y un «Leer más» en cada una: catorce toques para leer la sección)
function Ficha({ id, t, d, c }) {
  return (
    <li id={id}>
      {c ? <span className="gx-cifra"><b>{c[0]}</b><small>{c[1]}</small></span> : null}
      <h3>{t}</h3><p>{d}</p>
    </li>
  );
}

function Seccion({ id, titulo, bajada, children }) {
  return (
    <section className="gx-sec" id={'gx-' + id} aria-labelledby={'gx-t-' + id}>
      <h2 className="gx-h" id={'gx-t-' + id}>{titulo}</h2>
      {bajada ? <p className="gx-baj">{bajada}</p> : null}
      {children}
    </section>
  );
}

// 🏷️ los TAG de cada tarjeta, por rareza: una banda por nivel y sus fichas. Qué pestaña y qué bandas están abiertas
// viene de arriba: el buscador las cambia para llevarte a un TAG
function Tags({ liga, cual, setCual, abiertas, setAbiertas }) {
  const [de, setDe] = useState(null);
  useEffect(() => {
    let vivo = true;
    fetch('/api/tags', { headers: { accept: 'application/json' } }).then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo) setDe((d && d.de) || null); }).catch(() => { if (vivo) setDe(null); });
    return () => { vivo = false; };
  }, []);
  const col = CARTAS_TAG.findIndex(([c]) => c === cual);
  const lista = (TAGS.cat || {})[cual] || [];
  const cuantos = lista.map(() => 0);
  Object.values(de || {}).forEach((v) => { const i = (v || [])[col]; if (i >= 0 && i < cuantos.length) cuantos[i] += 1; });
  const yo = liga.yo && de ? (de[liga.yo.k] || null) : null;
  const mios = yo ? CARTAS_TAG.map(([c, n], j) => [n, yo[j] >= 0 ? ((TAGS.cat[c] || [])[yo[j]] || [])[0] : '']).filter((x) => x[1]) : [];
  return (
    <>
      {mios.length ? <div className="gx-tuyos"><b>Los tuyos hoy</b>{mios.map(([n, t]) => <span key={n}><small>{n}</small>{t.replace('%d', '')}</span>)}</div> : null}
      <div className="gx-tabs" role="tablist" aria-label="Los TAG de cada tarjeta">
        {CARTAS_TAG.map(([c, n]) => (
          <button key={c} type="button" role="tab" aria-selected={c === cual} className={c === cual ? 'on' : ''} onClick={() => setCual(c)}>
            {n}<small>{((TAGS.cat || {})[c] || []).length}</small></button>
        ))}
      </div>
      {NIVELES.map((nv) => {
        const xs = lista.map((x, i) => [x, i]).filter(([x]) => x[1] === nv);
        if (!xs.length) return null;
        const clave = cual + nv;
        const abierta = !!abiertas[clave];
        const cm = corta(xs.length, TOPE.m);
        const cd = corta(xs.length, TOPE.d);
        return (
          <div key={nv} className={'gx-banda gx-nv' + nv.slice(1) + (abierta ? ' abierta' : '')}>
            <div className="gx-banda-t"><b>{(TAGS.niveles || {})[nv] || nv}</b><small>{xs.length}</small></div>
            <ul className="gx-fichas">
              {xs.map(([[t, , pide, dura], i], j) => {
                // el tuyo siempre a la vista, aunque la banda esté corta
                const tuyo = yo && yo[col] === i;
                const cls = [tuyo ? 'tuyo' : '', !tuyo && cm && j >= TOPE.m ? 'm-extra' : '', !tuyo && cd && j >= TOPE.d ? 'd-extra' : ''].filter(Boolean).join(' ');
                return (
                  <li key={t} id={'gx-tag-' + cual + '-' + i} className={cls || undefined}>
                    <span className={'gx-tag gx-nv' + nv.slice(1)}>{nombreTag(t)}</span>
                    <p>{pide}</p>
                    <small>{DURA[dura] || ''}{de ? (DURA[dura] ? ' · ' : '') + (cuantos[i] === 1 ? '1 lo tiene' : cuantos[i] + ' lo tienen') : ''}{tuyo ? ' · el tuyo' : ''}</small>
                  </li>
                );
              })}
            </ul>
            {cm || cd ? <button type="button" className={'gx-mas' + (cm ? ' m' : '') + (cd ? ' d' : '')} aria-expanded={abierta}
              onClick={() => setAbiertas((a) => ({ ...a, [clave]: !a[clave] }))}>{abierta ? 'Ver menos' : 'Ver los ' + xs.length}</button> : null}
          </div>
        );
      })}
    </>
  );
}

// 🏅 cuántos puntos da cada puesto: la tabla en la compu, y en el celular una columna por vez (sin las filas que en
// esa no existen: en una llave de 4 a 7 no hay octavos)
const SIN = { '16+': 'sin-16', '8-15': 'sin-8', '4-7': 'sin-4' };
function Puntos({ P }) {
  const escs = ['16+', '8-15', '4-7'].filter((e) => ((P.tablas || {})[e] || []).length);
  const [esc, setEsc] = useState(escs[0]);
  const vale = (e, p) => { const r = (P.tablas[e] || []).find((x) => x[0] === p); return r ? r[1] : null; };
  const filas = PUESTOS.filter((p) => escs.some((e) => vale(e, p) != null));
  return (
    <div className="gx-pts">
      <div>
        {/* ⚠️ `gx-escala` y no `gx-esc`: ésa es la de la portada, y `.app .gx-esc{display:none}` la escondía entera */}
        <div className="gx-escala">
          <small id="gx-escala-t">Raperos en la llave</small>
          <div className="gx-esc-b" role="tablist" aria-labelledby="gx-escala-t">
            {escs.map((e) => <button key={e} type="button" role="tab" aria-selected={e === esc} className={e === esc ? 'on' : ''} onClick={() => setEsc(e)}>{NOMBRE_EV[e]}</button>)}
          </div>
        </div>
        <table className="gx-tabla" data-esc={esc}>
          <thead><tr><th>Puesto</th>{escs.map((e) => <th key={e} className={e === esc ? 'on' : ''}>{NOMBRE_EV[e]}<small>raperos</small></th>)}</tr></thead>
          <tbody>{filas.map((p) => (
            <tr key={p} id={'gx-pts-' + p} className={escs.filter((e) => vale(e, p) == null).map((e) => SIN[e]).join(' ') || undefined}>
              <td><Medalla p={PUESTO_MEDALLA[p]} />{p}{p === 'Semifinal' ? <small>cuando no se juega el tercer puesto</small> : null}</td>
              {escs.map((e) => <td key={e} className={e === esc ? 'on' : ''}>{vale(e, p) == null ? '—' : num(vale(e, p))}</td>)}</tr>
          ))}</tbody>
        </table>
      </div>
      <ul className="gx-notas">
        <li><b>Depende de cuánta gente juega</b>: ganar una llave de 16 vale más que ganar una de 6.</li>
        <li><b>Por equipos</b>: los puntos del puesto se reparten entre los integrantes.</li>
        {(P.walkin || []).length ? <li><b>Walk-in</b>: quien entra saltándose rondas cobra {P.walkin.map((w, i) => w[1] + ' % con ' + w[0] + (i === P.walkin.length - 1 ? ' o más' : '') + (w[0] === 1 ? ' ronda' : ' rondas')).join(', ')}.</li> : null}
        {P.revivido != null ? <li><b>Revivido</b>: su primer puesto entero y el {P.revivido} % del puesto final.</li> : null}
      </ul>
    </div>
  );
}

// 📏 una barra de 100 % partida en sus pesos, con la leyenda abajo
function Barra({ partes }) {
  return (
    <>
      <div className="gx-barra" role="img" aria-label={partes.map((p) => p[0] + ' ' + p[1] + ' %').join(', ')}>
        {partes.map((p, i) => <i key={p[0]} style={{ width: p[1] + '%', background: PARTES[i % PARTES.length] }} />)}
      </div>
      <ul className="gx-ley">{partes.map((p, i) => (
        <li key={p[0]}><i style={{ background: PARTES[i % PARTES.length] }} /><span><b>{p[0]}</b>{p[2] ? <small>{p[2]}</small> : null}</span><em>{p[1]} %</em></li>
      ))}</ul>
    </>
  );
}

// 🔠 los ocho rangos en una regla de 0 a 100: cada letra ocupa lo que mide su tramo. Abajo, el material de cada una,
// que es el de su tarjeta (lo decía la Guía de antes y se había perdido)
function Regla({ rangos }) {
  const xs = rangos.slice().sort((a, b) => (a.min || 0) - (b.min || 0));
  return (
    <div className="gx-regla">
      <div className="gx-regla-b">
        {xs.map((r, i) => {
          const desde = r.min || 0;
          const hasta = i < xs.length - 1 ? xs[i + 1].min : 100;
          return (
            <div key={r.r} id={'gx-rg-' + r.r} className="gx-regla-s" style={{ width: Math.max(4, hasta - desde) + '%', '--c': r.color }} title={r.r + ' · ' + (r.min ? r.min + ' o más' : 'el resto')}>
              <b>{r.r}</b><small>{desde}</small>
            </div>
          );
        })}
      </div>
      {xs.some((r) => r.mat) ? <p className="gx-nota">Cada letra tiene su material, el de su tarjeta: {xs.map((r) => r.r + ' ' + (r.mat || '')).join(' · ')}.</p> : null}
    </div>
  );
}

const SECCIONES = (reqs, P, rangos) => [
  ['empezar', 'Cómo empezar'], reqs.length ? ['tarjetas', 'Tus tarjetas'] : null, ['tags', 'Los TAG'],
  P.tablas ? ['puntos', 'Puntos por puesto'] : null, rangos.length ? ['rangos', 'Rangos, OVR y Score'] : null,
  ['mw', 'Most Wanted y Tienda'], ['semana', 'Lo de cada semana'], ['palabras', 'Las palabras'], ['preguntas', 'Preguntas'],
].filter(Boolean);

export function Guia({ liga, dc }) {
  const G = liga.d.guia || {};
  const P = G.puntos || {};
  const reqs = liga.d.requisitos || [];
  const rangos = liga.d.rangos || [];
  const [q0, setQ] = useState('');
  const q = norm(q0).trim();
  const [cual, setCual] = useState('temporada');
  const [abiertas, setAbiertas] = useState({});
  const caja = useRef(null);
  const conRango = (liga.d.tabla || []).filter((f) => f.rg).length;
  const ejemplo = (id) => liga.oficiales().find((f) => (f.c || []).includes(id));
  const secciones = SECCIONES(reqs, P, rangos);
  const { act, ir, tira, hay } = useIndice(secciones.map(([id]) => 'gx-' + id), 70);
  const confTxt = (G.conf || []).map((c, i) => c[1] + ' % ' + (i === G.conf.length - 1 ? 'desde ' : 'con ') + c[0] + (c[0] === 1 ? ' evento' : ' eventos')).join(', ');
  // 🔎 todo lo que se puede buscar, en texto plano, y adónde lleva: [sección, título, texto, {id, pestaña, banda}]
  const todo = useMemo(() => {
    const porEsc = (p) => ['16+', '8-15', '4-7'].map((e) => {
      const r = ((P.tablas || {})[e] || []).find((x) => x[0] === p);
      return r ? NOMBRE_EV[e] + ' raperos: ' + num(r[1]) : '';
    }).filter(Boolean).join(' · ');
    const rgs = rangos.slice().sort((a, b) => (a.min || 0) - (b.min || 0));
    return [
      ...PALABRAS.map(([t, d], i) => ['palabras', t, d, { id: 'gx-pal-' + i }]),
      ...SEMANA.map(([t, d], i) => ['semana', t, d, { id: 'gx-sem-' + i }]),
      ...MW_TIENDA.map(([t, d], i) => ['mw', t, d.replace('{MW}', ''), { id: 'gx-mw-' + i }]),
      ...PREGUNTAS.map(([t, a], i) => ['preguntas', t, plano(a), { id: 'gx-faq-' + i }]),
      ...reqs.map((x) => ['tarjetas', x.titulo, x.mide + ' ' + (x.pide || []).map(pideLargo).join(' · '), { id: 'gx-car-' + x.id }]),
      ...(P.tablas ? PUESTOS.map((p) => ['puntos', p + ' · puntos', porEsc(p), { id: 'gx-pts-' + p }]).filter((x) => x[2]) : []),
      ...rgs.map((r, i) => ['rangos', 'Rango ' + r.r + (r.mat ? ' · ' + r.mat : ''),
        r.min ? 'Desde ' + r.min + ' de Score.' : 'Menos de ' + ((rgs[i + 1] || {}).min || '') + ' de Score.', { id: 'gx-rg-' + r.r }]),
      ...(G.ovr || []).map((x) => ['rangos', 'OVR · ' + x[0], x[1] + ' % del OVR. Cada parte se compara con la mejor de la temporada.', { id: 'gx-ovr' }]),
      ...(G.score || []).map((x) => ['rangos', 'Score · ' + x[1], x[3] + ' % del Score. ' + (x[2] || ''), { id: 'gx-score' }]),
      ...(confTxt ? [['rangos', 'Confianza', 'Multiplica el Score y premia jugar más: ' + confTxt + '.', { id: 'gx-conf' }]] : []),
      ...CARTAS_TAG.flatMap(([c, n]) => ((TAGS.cat || {})[c] || []).map((x, i) => ['tags', nombreTag(x[0]) + ' · ' + n, x[2],
        { id: 'gx-tag-' + c + '-' + i, tab: c, banda: c + x[1] }])),
    ];
  }, [reqs, rangos, G, P, confTxt]);
  // primero lo que lo dice en el título
  const res = q.length >= 2 ? todo.filter(([, t, d]) => norm(t).includes(q) || norm(d).includes(q))
    .sort((a, b) => (norm(b[1]).includes(q) ? 1 : 0) - (norm(a[1]).includes(q) ? 1 : 0)).slice(0, 30) : [];
  const nombreSec = Object.fromEntries(secciones.map(([id, t]) => [id, t]));
  // llevar a una cosa: la pestaña de su TAG, su banda abierta o su pregunta abierta, y una marca que dura un rato
  const llevar = (sec, dst) => {
    if (dst && dst.tab) setCual(dst.tab);
    if (dst && dst.banda) setAbiertas((a) => ({ ...a, [dst.banda]: true }));
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const r = raiz();
      const el = r && dst && dst.id ? r.getElementById(dst.id) : null;
      if (el && el.tagName === 'DETAILS') el.open = true;
      ir('gx-' + sec, el);
      if (el) {
        el.classList.remove('gx-flash');
        el.getBoundingClientRect();
        el.classList.add('gx-flash');
        setTimeout(() => el.classList.remove('gx-flash'), 2400);
      }
    }));
  };
  // la lupa del índice: vuelve al buscador (desde la mitad de la Guía quedaba a 2.700 px)
  const buscar = () => {
    const b = caja.current;
    if (!b) return;
    window.scrollTo({ top: Math.max(0, b.getBoundingClientRect().top + window.scrollY - 140), behavior: 'smooth' });
    setTimeout(() => b.focus({ preventScroll: true }), 450);
  };
  const indice = (cls, t) => (
    <ol className={cls} ref={t}>
      <li><button type="button" className="gx-lupa" aria-label="Buscar en la Guía" onClick={buscar}><Ico n="buscar" t={18} /><b>Buscar</b></button></li>
      {secciones.filter(([id]) => hay.includes('gx-' + id)).map(([id, tt]) => (
        <li key={id}><button type="button" className={act === 'gx-' + id ? 'on' : ''} aria-current={act === 'gx-' + id ? 'true' : undefined} onClick={() => ir('gx-' + id)}>
          <b>{tt}</b></button></li>
      ))}
    </ol>
  );
  return (
    <>
      <div className="escena gx-esc" style={{ '--mo-c': '#E41373', '--mo-o': 0.85 }}>
        <section className="gx-hero">
          <div className="gx-hero-tx">
            <span className="tag">GUÍA · {liga.temp}</span>
            <h1 className="hero-ev largo">Cómo funciona</h1>
            <p className="hero-p">Cómo empezar, qué pide cada tarjeta, cuántos puntos da cada puesto, de dónde sale tu rango y qué significa cada palabra.</p>
          </div>
          <label className="gx-busca">
            <Ico n="buscar" t={20} />
            <input ref={caja} type="search" value={q0} onChange={(e) => setQ(e.target.value)} placeholder="Busca en la Guía: OVR, Most Wanted, /card…"
              aria-label="Buscar en la Guía" enterKeyHint="search" />
          </label>
        </section>
      </div>
      <nav className="gx-chips" aria-label="Secciones de la Guía">{indice('gx-chips-l', tira)}</nav>
      <div className="gx-t2">
        <aside className="gx-rail" aria-label="Índice de la Guía">
          {indice('gx-rail-l')}
        </aside>
        <div className="gx-cuerpo">
          {q.length >= 2 ? (
            <section className="gx-res" aria-live="polite">
              <h2 className="gx-res-t">{res.length ? (res.length === 1 ? '1 resultado' : res.length + (res.length === 30 ? '+' : '') + ' resultados') : 'Nada'} para «{q0.trim()}»
                <button type="button" className="gx-res-x" onClick={() => setQ('')}>Borrar</button></h2>
              {res.length ? (
                <ul>{res.map(([sec, t, d, dst], i) => (
                  <li key={sec + t + i}><button type="button" onClick={() => llevar(sec, dst)}>
                    <small>{nombreSec[sec] || sec}</small><b><Marca t={t} q={q} /></b>
                    <span>{(() => { const j = norm(d).indexOf(q); const a = Math.max(0, j - 50); return (a ? '…' : '') + d.slice(a, a + 150) + (d.length > a + 150 ? '…' : ''); })()}</span>
                  </button></li>
                ))}</ul>
              ) : <p className="gx-nota">Prueba con otra palabra, o mira las <button type="button" className="gx-link" onClick={() => { setQ(''); ir('gx-preguntas'); }}>preguntas frecuentes</button>.</p>}
            </section>
          ) : null}

          <Seccion id="empezar" titulo="Cómo empezar" bajada="Cinco pasos, y ninguno pide jugar: se tildan solos a medida que los haces.">
            <Suspense fallback={null}><PrimerosPasos liga={liga} dc={dc} enGuia /></Suspense>
          </Seccion>

          {reqs.length ? (
            <Seccion id="tarjetas" titulo="Tus tarjetas" bajada="Cada una pide algo distinto, porque cada una mide algo distinto. Mientras no llegues, sale la bloqueada con cuánto falta.">
              <div className="gx-cartas">
                {reqs.map((x) => {
                  const f = ejemplo(x.id);
                  return (
                    <article key={x.id} id={'gx-car-' + x.id} className="gx-carta">
                      {f ? <Carta liga={liga} k={f.k} cual={x.id} cls="gx-carta-c" abre={false} /> : <span className="gx-carta-c gx-sin" aria-hidden="true">?</span>}
                      <div><h3>{x.titulo}</h3><p>{x.mide}</p><ul>{(x.pide || []).map((p) => <li key={p}>{pideLargo(p)}</li>)}</ul></div>
                    </article>
                  );
                })}
                <article className="gx-carta prox"><span className="gx-carta-c gx-sin" aria-hidden="true">T2</span>
                  <div><h3>Histórica y Prime</h3><p>Todas tus temporadas juntas.</p><ul><li>Llegan con la Temporada 2</li></ul></div></article>
              </div>
            </Seccion>
          ) : null}

          {/* ⚠️ la regla de cuál sale va arriba y con su excepción: agrupados por rareza, «de arriba abajo» no vale para la
              de Servidor, cuya cascada arranca con un Raro y un Común (tags_catalogo.json) */}
          <Seccion id="tags" titulo="Los TAG de las tarjetas" bajada={<>El cartelito de abajo de cada tarjeta. Cada una muestra uno solo: el primero que cumples, de arriba
            abajo —en la de Servidor, «Visitante ilustre» y «De visita» van antes que todos—, y el mismo hecho no sale en dos tarjetas tuyas.</>}>
            <Tags liga={liga} cual={cual} setCual={setCual} abiertas={abiertas} setAbiertas={setAbiertas} />
          </Seccion>

          {P.tablas ? (
            <Seccion id="puntos" titulo="Cuántos puntos da cada puesto">
              <Puntos P={P} />
            </Seccion>
          ) : null}

          {rangos.length ? (
            <Seccion id="rangos" titulo="Rangos, OVR y Score" bajada={conRango ? 'El rango sale del Score competitivo y es uno solo por persona: da igual en todas tus tarjetas.'
              : 'El rango sale del Score competitivo, y para tenerlo hacen falta 10 eventos en la temporada.'}>
              <Regla rangos={rangos} />
              <div className="gx-dos">
                {(G.ovr || []).length ? (
                  <div className="gx-pesos" id="gx-ovr"><h3>El OVR<small>de 40 a 99 · ordena la temporada</small></h3>
                    <Barra partes={G.ovr.map((x) => [x[0], x[1]])} />
                    <p className="gx-nota">Cada parte se compara con la mejor de la temporada.</p></div>
                ) : null}
                {(G.score || []).length ? (
                  <div className="gx-pesos" id="gx-score"><h3>El Score<small>de 0 a 100 · da el rango</small></h3>
                    <Barra partes={G.score.map((x) => [(x[0] ? x[0] + ' ' : '') + x[1], x[3], x[2]])} />
                    {confTxt ? <p className="gx-nota" id="gx-conf">Y se multiplica por la <b>confianza</b>, que premia jugar más: {confTxt}.</p> : null}
                  </div>
                ) : null}
              </div>
            </Seccion>
          ) : null}

          <Seccion id="mw" titulo="Most Wanted, encuestas y Tienda">
            <dl className="gx-glos">{MW_TIENDA.map(([t, d], i) => <div key={t} id={'gx-mw-' + i}><dt>{t}</dt><dd>{d.replace('{MW}', G.mw ? ' (' + G.mw + ')' : '')}</dd></div>)}</dl>
          </Seccion>

          <Seccion id="semana" titulo="Lo de cada semana" bajada="Lo que cambia los puntos semana a semana, y lo que se gana.">
            <ul className="gx-semana">{SEMANA.map(([t, d], i) => <Ficha key={t} id={'gx-sem-' + i} t={t} d={d} c={CIFRA[t]} />)}</ul>
          </Seccion>

          <Seccion id="palabras" titulo="Las palabras de la Liga">
            <dl className="gx-glos">{PALABRAS.map(([t, d], i) => <div key={t} id={'gx-pal-' + i}><dt>{t}</dt><dd>{d}</dd></div>)}</dl>
          </Seccion>

          <Seccion id="preguntas" titulo="Preguntas frecuentes">
            <div className="gx-faq">{PREGUNTAS.map(([t, a], i) => <details key={t} id={'gx-faq-' + i}><summary>{t}</summary><p>{a}</p></details>)}</div>
          </Seccion>
        </div>
      </div>
    </>
  );
}
