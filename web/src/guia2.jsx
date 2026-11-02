// 📖 LA GUÍA, EL REMAKE (02/11/2026). Dlx: «terminar de remakear las restantes». Se ve con `?prev=remake` (App.jsx
// `REMAKE`); sin la marca sigue la de guia.jsx. Es la misma Guía —los textos son los de guia.jsx, importados: hay una
// sola copia— ordenada para buscarse en vez de leerse de punta a punta (8.500 px en la compu, 14.600 en el celular), con
// lo que dejó el research de 21st (scratchpad/remake2/research_tienda_salon_guia_socios.md):
// - UN BUSCADOR para toda la Guía (las palabras, la semana, los TAG, las preguntas…): lo encuentra y te lleva.
// - UN ÍNDICE NUMERADO que sigue la lectura: en la compu, pegado a la izquierda; en el celular, una fila de chips.
// - LOS TAG COMO UN TABLERO DE RAREZAS: una banda por nivel y las fichas en grilla (eran 44 renglones de media pantalla).
// - LOS PESOS Y LOS RANGOS COMO BARRAS DE 100 %: el OVR y el Score en una barra cada uno, los rangos en una regla de 0 a 100.
// - LO DE CADA SEMANA EN FICHAS, con su cifra y cuándo pasa; las palabras y las preguntas en dos columnas en la compu.
// ⚠️ LOS NÚMEROS SALEN DE DONDE SE CALCULAN (`guia`, `requisitos`, `rangos` del payload, como en guia.jsx). Las cifras de
// las fichas de la semana son las mismas que dice su texto, al lado.
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import TAGS from './tags_catalogo.json';
import { norm, num } from './liga.js';
import { Carta, Ico, Medalla, PUESTO_MEDALLA } from './piezas.jsx';
import { MW_TIENDA, NOMBRE_EV, PALABRAS, PREGUNTAS, PUESTOS, SEMANA, pideLargo } from './guia.jsx';
import CSS_PAGINA from './css/guia2.css?inline';
import { usarCss } from './css.js';

usarCss('guia2', CSS_PAGINA);

const PrimerosPasos = lazy(() => import('./tutorial.jsx').then((m) => ({ default: m.PrimerosPasos })));

// la cifra de cada cosa de la semana y cuándo pasa (lo mismo que dice su texto)
const CIFRA = {
  'Multiplicador': ['×0,5 a ×5', 'Lunes 11 AM'], 'Evento dorado': ['×3', 'Cada semana'], 'Guerra de servidores': ['×1,5', 'Cada semana'],
  'Copa de la Liga': ['×2', 'Cada semana'], 'Semillero': ['×1,5', 'Cada semana'], 'Meta de comunidad': ['+10 %', 'Lunes'],
  'Bonos': ['+1.500', 'Al jugar'], 'Clásico': ['+10 %', 'Al cruzarse'], 'Misiones': ['3', 'Lunes 11 AM'],
  'Ranking ELO': ['6 piedras', 'Cada lunes'], 'Pase de rapero': ['30 niveles', 'La temporada'], 'Premios de la semana': ['4', 'Al cerrar la semana'],
  'Insignias': ['Para siempre', 'Al ganarlas'], 'Con tiempo': ['📣', '12 h antes'],
};
const CARTAS_TAG = [['temporada', 'Temporada'], ['competitivo', 'Competitiva'], ['servidor', 'Servidor'], ['pais', 'País']];
const NIVELES = ['t1', 't2', 't3', 't4'];
const TOPE_TAGS = 9;
const DURA = { temporada: 'esta temporada', siempre: 'para siempre', semana: 'esta semana', estado: 'mientras dure' };
// los colores de las partes de una barra de 100 %: los de la casa
const PARTES = ['var(--tinta)', 'var(--verde)', 'var(--magenta)', '#8A8F98', '#F2B705'];

// el texto plano de algo de React (las respuestas de las preguntas traen links y código), para buscarlo
function plano(n) {
  if (n == null || typeof n === 'boolean') return '';
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  if (Array.isArray(n)) return n.map(plano).join('');
  return n.props ? plano(n.props.children) : '';
}
const irA = (id) => {
  const el = document.getElementById('inicio-nuevo');
  const s = el && el.shadowRoot ? el.shadowRoot.getElementById('gx-' + id) : null;
  if (s) window.scrollTo({ top: s.getBoundingClientRect().top + window.scrollY - 64, behavior: 'smooth' });
};
// la palabra buscada, marcada
function Marca({ t, q }) {
  if (!q) return t;
  const i = norm(t).indexOf(q);
  if (i < 0) return t;
  return <>{t.slice(0, i)}<mark>{t.slice(i, i + q.length)}</mark>{t.slice(i + q.length)}</>;
}

// una ficha de la semana: en el celular el texto se corta en tres renglones y se abre a pedido
function Ficha({ t, d, c }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <li className={abierta ? 'abierta' : ''}>
      {c ? <span className="gx-cifra"><b>{c[0]}</b><small>{c[1]}</small></span> : null}
      <h3>{t}</h3><p>{d}</p>
      <button type="button" className="gx-leer" aria-expanded={abierta} onClick={() => setAbierta(!abierta)}>{abierta ? 'Leer menos' : 'Leer más'}</button>
    </li>
  );
}

function Seccion({ id, n, titulo, bajada, children }) {
  return (
    <section className="gx-sec" id={'gx-' + id} aria-labelledby={'gx-t-' + id} data-sec={id}>
      <h2 className="gx-h" id={'gx-t-' + id}><span className="gx-num">{String(n).padStart(2, '0')}</span>{titulo}</h2>
      {bajada ? <p className="gx-baj">{bajada}</p> : null}
      {children}
    </section>
  );
}

// 🏷️ los TAG de cada tarjeta, por rareza: una banda por nivel y sus fichas
function Tags({ liga }) {
  const [cual, setCual] = useState('temporada');
  const [de, setDe] = useState(null);
  // las bandas largas, abiertas a pedido (tres filas en la compu; la de Épico de Temporada son 24)
  const [abiertas, setAbiertas] = useState({});
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
        const xs0 = lista.map((x, i) => [x, i]).filter(([x]) => x[1] === nv);
        if (!xs0.length) return null;
        const clave = cual + nv;
        const corta = xs0.length > TOPE_TAGS && !abiertas[clave];
        // el tuyo siempre a la vista, aunque la banda esté corta
        const xs = corta ? xs0.filter(([, i], j) => j < TOPE_TAGS || (yo && yo[col] === i)) : xs0;
        return (
          <div key={nv} className={'gx-banda gx-nv' + nv.slice(1)}>
            <div className="gx-banda-t"><b>{(TAGS.niveles || {})[nv] || nv}</b><small>{xs0.length}</small></div>
            <ul className="gx-fichas">
              {xs.map(([[t, , pide, dura], i]) => (
                <li key={t} className={yo && yo[col] === i ? 'tuyo' : ''}>
                  <span className={'gx-tag gx-nv' + nv.slice(1)}>{t.replace(' x%d', ' ×N').replace('%d', 'N')}</span>
                  <p>{pide}</p>
                  <small>{DURA[dura] || ''}{de ? (DURA[dura] ? ' · ' : '') + (cuantos[i] === 1 ? '1 lo tiene' : cuantos[i] + ' lo tienen') : ''}{yo && yo[col] === i ? ' · el tuyo' : ''}</small>
                </li>
              ))}
            </ul>
            {xs0.length > TOPE_TAGS ? <button type="button" className="gx-mas" aria-expanded={!corta}
              onClick={() => setAbiertas((a) => ({ ...a, [clave]: !a[clave] }))}>{corta ? 'Ver los ' + xs0.length : 'Ver menos'}</button> : null}
          </div>
        );
      })}
      <p className="gx-nota">Cada tarjeta muestra uno solo: el primero que cumples, de arriba abajo. El mismo hecho no sale en dos tarjetas tuyas.</p>
    </>
  );
}

// 🏅 cuántos puntos da cada puesto: la tabla en la compu, y en el celular una columna por vez
function Puntos({ P }) {
  const escs = ['16+', '8-15', '4-7'].filter((e) => ((P.tablas || {})[e] || []).length);
  const [esc, setEsc] = useState(escs[0]);
  const vale = (e, p) => { const r = (P.tablas[e] || []).find((x) => x[0] === p); return r ? r[1] : null; };
  const filas = PUESTOS.filter((p) => escs.some((e) => vale(e, p) != null));
  return (
    <div className="gx-pts">
      <div>
        <div className="gx-esc-b" role="tablist" aria-label="Cuánta gente juega la llave">
          {escs.map((e) => <button key={e} type="button" role="tab" aria-selected={e === esc} className={e === esc ? 'on' : ''} onClick={() => setEsc(e)}>{NOMBRE_EV[e]}</button>)}
        </div>
        <table className="gx-tabla" data-esc={esc}>
          <thead><tr><th>Puesto</th>{escs.map((e) => <th key={e} className={e === esc ? 'on' : ''}>{NOMBRE_EV[e]}<small>raperos</small></th>)}</tr></thead>
          <tbody>{filas.map((p) => (
            <tr key={p}><td><Medalla p={PUESTO_MEDALLA[p]} />{p}{p === 'Semifinal' ? <small>cuando no se juega el tercer puesto</small> : null}</td>
              {escs.map((e) => <td key={e} className={e === esc ? 'on' : ''}>{vale(e, p) == null ? '—' : num(vale(e, p))}</td>)}</tr>
          ))}</tbody>
        </table>
      </div>
      <ul className="gx-notas">
        <li><b>Depende de cuánta gente juega</b>: ganar una llave de 16 vale más que ganar una de 6.</li>
        <li><b>Por equipos</b>: los puntos del puesto se reparten entre los integrantes.</li>
        {(P.walkin || []).length ? <li><b>Walk-in</b>: quien entra salteando rondas cobra {P.walkin.map((w, i) => w[1] + ' % con ' + w[0] + (i === P.walkin.length - 1 ? ' o más' : '') + (w[0] === 1 ? ' ronda' : ' rondas')).join(', ')}.</li> : null}
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

// 🔠 los ocho rangos en una regla de 0 a 100: cada letra ocupa lo que mide su tramo
function Regla({ rangos }) {
  const xs = rangos.slice().sort((a, b) => (a.min || 0) - (b.min || 0));
  return (
    <div className="gx-regla">
      <div className="gx-regla-b">
        {xs.map((r, i) => {
          const desde = r.min || 0;
          const hasta = i < xs.length - 1 ? xs[i + 1].min : 100;
          return (
            <div key={r.r} className="gx-regla-s" style={{ width: Math.max(4, hasta - desde) + '%', '--c': r.color }} title={r.r + ' · ' + (r.min ? r.min + ' o más' : 'el resto')}>
              <b>{r.r}</b><small>{desde}</small>
            </div>
          );
        })}
      </div>
      <p className="gx-nota">El Score va de 0 a 100. Cada letra empieza en su número: {xs.slice().reverse().map((r) => r.r + (r.min ? ' ' + r.min : ' el resto')).join(' · ')}.</p>
    </div>
  );
}

export function Guia({ liga, dc }) {
  const G = liga.d.guia || {};
  const P = G.puntos || {};
  const reqs = liga.d.requisitos || [];
  const rangos = liga.d.rangos || [];
  const [q0, setQ] = useState('');
  const q = norm(q0).trim();
  const [act, setAct] = useState('empezar');
  const conRango = (liga.d.tabla || []).filter((f) => f.rg).length;
  const ejemplo = (id) => liga.oficiales().find((f) => (f.c || []).includes(id));
  const nTags = Object.values(TAGS.cat || {}).reduce((a, l) => a + l.length, 0);
  const secciones = [
    ['empezar', 'Cómo empezar', 5], reqs.length ? ['tarjetas', 'Tus tarjetas', reqs.length] : null, ['tags', 'Los TAG', nTags],
    (P.tablas ? ['puntos', 'Puntos por puesto', PUESTOS.length] : null), rangos.length ? ['rangos', 'Rangos, OVR y Score', rangos.length] : null,
    ['mw', 'Most Wanted y Tienda', MW_TIENDA.length], ['semana', 'Lo de cada semana', SEMANA.length], ['palabras', 'Las palabras', PALABRAS.length],
    ['preguntas', 'Preguntas', PREGUNTAS.length],
  ].filter(Boolean);
  const num0 = (id) => secciones.findIndex((s) => s[0] === id) + 1;
  // 🔎 todo lo que se puede buscar, en texto plano
  const todo = useMemo(() => [
    ...PALABRAS.map(([t, d]) => ['palabras', t, d]), ...SEMANA.map(([t, d]) => ['semana', t, d]),
    ...MW_TIENDA.map(([t, d]) => ['mw', t, d.replace('{MW}', '')]), ...PREGUNTAS.map(([t, a]) => ['preguntas', t, plano(a)]),
    ...reqs.map((x) => ['tarjetas', x.titulo, x.mide + ' ' + (x.pide || []).map(pideLargo).join(' · ')]),
    ...CARTAS_TAG.flatMap(([c, n]) => ((TAGS.cat || {})[c] || []).map((x) => ['tags', x[0].replace(' x%d', ' ×N').replace('%d', 'N') + ' · ' + n, x[2]])),
  ], [reqs]);
  const res = q.length >= 2 ? todo.filter(([, t, d]) => norm(t).includes(q) || norm(d).includes(q)).slice(0, 30) : [];
  const nombreSec = Object.fromEntries(secciones.map(([id, t]) => [id, t]));
  // 🧭 qué sección se está leyendo: la que cruza el tercio de arriba de la pantalla
  useEffect(() => {
    const host = document.getElementById('inicio-nuevo');
    const raiz = host && host.shadowRoot;
    if (!raiz || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) setAct(e.target.getAttribute('data-sec')); });
    }, { rootMargin: '-25% 0px -70% 0px' });
    raiz.querySelectorAll('.gx-sec').forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [secciones.length]);
  const indice = (cls) => (
    <ol className={cls}>
      {secciones.map(([id, t, n], i) => (
        <li key={id}><button type="button" className={act === id ? 'on' : ''} aria-current={act === id ? 'true' : undefined} onClick={() => irA(id)}>
          <span className="gx-num">{String(i + 1).padStart(2, '0')}</span><b>{t}</b><small>{n}</small></button></li>
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
            <input type="search" value={q0} onChange={(e) => setQ(e.target.value)} placeholder="Busca en la Guía: OVR, Most Wanted, /card…"
              aria-label="Buscar en la Guía" enterKeyHint="search" />
          </label>
        </section>
      </div>
      <nav className="gx-chips" aria-label="Secciones de la Guía">{indice('gx-chips-l')}</nav>
      <div className="gx-t2">
        <aside className="gx-rail" aria-label="Índice de la Guía">
          <small className="gx-rail-t">EN ESTA GUÍA</small>
          {indice('gx-rail-l')}
        </aside>
        <div className="gx-cuerpo">
          {q.length >= 2 ? (
            <section className="gx-res" aria-live="polite">
              <h2 className="gx-res-t">{res.length ? (res.length === 1 ? '1 resultado' : res.length + (res.length === 30 ? '+' : '') + ' resultados') : 'Nada'} para «{q0.trim()}»
                <button type="button" className="gx-res-x" onClick={() => setQ('')}>Borrar</button></h2>
              {res.length ? (
                <ul>{res.map(([sec, t, d], i) => (
                  <li key={sec + t + i}><button type="button" onClick={() => irA(sec)}>
                    <small>{nombreSec[sec] || sec}</small><b><Marca t={t} q={q} /></b>
                    <span>{(() => { const j = norm(d).indexOf(q); const a = Math.max(0, j - 50); return (a ? '…' : '') + d.slice(a, a + 150) + (d.length > a + 150 ? '…' : ''); })()}</span>
                  </button></li>
                ))}</ul>
              ) : <p className="gx-nota">Prueba con otra palabra, o mira las <button type="button" className="gx-link" onClick={() => { setQ(''); irA('preguntas'); }}>preguntas frecuentes</button>.</p>}
            </section>
          ) : null}

          <Seccion id="empezar" n={num0('empezar')} titulo="Cómo empezar" bajada="Cinco pasos, y ninguno pide jugar: se tildan solos a medida que los haces.">
            <Suspense fallback={null}><PrimerosPasos liga={liga} dc={dc} enGuia /></Suspense>
          </Seccion>

          {reqs.length ? (
            <Seccion id="tarjetas" n={num0('tarjetas')} titulo="Tus tarjetas" bajada="Cada una pide algo distinto, porque cada una mide algo distinto. Mientras no llegues, sale la bloqueada con cuánto falta.">
              <div className="gx-cartas">
                {reqs.map((x) => {
                  const f = ejemplo(x.id);
                  return (
                    <article key={x.id} className="gx-carta">
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

          <Seccion id="tags" n={num0('tags')} titulo="Los TAG de las tarjetas" bajada="El cartelito de abajo de cada tarjeta: de los cuatro niveles, el legendario es el más difícil.">
            <Tags liga={liga} />
          </Seccion>

          {P.tablas ? (
            <Seccion id="puntos" n={num0('puntos')} titulo="Cuántos puntos da cada puesto">
              <Puntos P={P} />
            </Seccion>
          ) : null}

          {rangos.length ? (
            <Seccion id="rangos" n={num0('rangos')} titulo="Rangos, OVR y Score" bajada={conRango ? 'El rango sale del Score competitivo y es uno solo por persona: da igual en todas tus tarjetas.'
              : 'El rango sale del Score competitivo, y para tenerlo hacen falta 10 eventos en la temporada.'}>
              <Regla rangos={rangos} />
              <div className="gx-dos">
                {(G.ovr || []).length ? (
                  <div className="gx-pesos"><h3>El OVR<small>de 40 a 99 · ordena la temporada</small></h3>
                    <Barra partes={G.ovr.map((x) => [x[0], x[1]])} />
                    <p className="gx-nota">Cada parte se compara con la mejor de la temporada.</p></div>
                ) : null}
                {(G.score || []).length ? (
                  <div className="gx-pesos"><h3>El Score<small>de 0 a 100 · da el rango</small></h3>
                    <Barra partes={G.score.map((x) => [x[1], x[3], x[2]])} />
                    {(G.conf || []).length ? <p className="gx-nota">Y se multiplica por la <b>confianza</b>, que premia jugar más: {G.conf.map((c, i) => c[1] + ' % ' + (i === G.conf.length - 1 ? 'desde ' : 'con ') + c[0] + (c[0] === 1 ? ' evento' : ' eventos')).join(', ')}.</p> : null}
                  </div>
                ) : null}
              </div>
            </Seccion>
          ) : null}

          <Seccion id="mw" n={num0('mw')} titulo="Most Wanted, encuestas y Tienda">
            <dl className="gx-glos">{MW_TIENDA.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d.replace('{MW}', G.mw ? ' (' + G.mw + ')' : '')}</dd></div>)}</dl>
          </Seccion>

          <Seccion id="semana" n={num0('semana')} titulo="Lo de cada semana" bajada="Lo que cambia los puntos semana a semana, y lo que se gana.">
            <ul className="gx-semana">{SEMANA.map(([t, d]) => <Ficha key={t} t={t} d={d} c={CIFRA[t]} />)}</ul>
          </Seccion>

          <Seccion id="palabras" n={num0('palabras')} titulo="Las palabras de la Liga">
            <dl className="gx-glos">{PALABRAS.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}</dl>
          </Seccion>

          <Seccion id="preguntas" n={num0('preguntas')} titulo="Preguntas frecuentes">
            <div className="gx-faq">{PREGUNTAS.map(([t, a]) => <details key={t}><summary>{t}</summary><p>{a}</p></details>)}</div>
          </Seccion>
        </div>
      </div>
    </>
  );
}
