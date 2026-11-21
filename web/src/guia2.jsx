// 📖 LA GUÍA, EL REMAKE (02/11/2026). Dlx: «terminar de remakear las restantes»; para todos desde el mismo día («Publica
// y haz todo»). Es la misma Guía —los textos son los de guia.jsx, importados: hay una sola copia—.
//
// 🏁 6.80, CON LA ESTRUCTURA DE LA LLAVE (Dlx, 19/11/2026, «sigue remakeando todo» y, a la maqueta
// https://claude.ai/artifact/JFw5UULfTPgBBsEiTypcaN, «A + lo mejor de B»). Arriba, en la escena: el buscador con tres
// preguntas a mano, la franja de cuatro cifras, «Cómo empezar» como un camino (lo hecho tachado, lo que sigue en la pieza
// blanca) y TUS TARJETAS COMO LOMOS, con la carta grande en el que está abierto (de la B). Abajo, el papel en pestañas, y
// cada una dibuja su dato con su forma: los capítulos como una pista, LOS PUNTOS DENTRO DE UNA FRASE SOBRE VERDE (de la B)
// y como escalera, la regla de los rangos, la semana en carriles, los TAG por rareza con su ficha al costado, las
// palabras de la A a la Z y las preguntas que se llenan de tinta. Era una sola tira de 8.500 px con un índice al costado.
// ⚠️ EL BUSCADOR SIGUE ENCONTRANDO LA RESPUESTA y no sólo la sección: al tocar un resultado cambia de pestaña (o abre el
// lomo, la ficha del TAG o la pregunta), baja hasta la cosa y la marca.
// ⚠️ LOS NÚMEROS SALEN DE DONDE SE CALCULAN (`guia`, `requisitos`, `rangos` del payload, como en guia.jsx). Las cifras de
// la semana son las mismas que dice su texto, al lado.
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import TAGS from './tags_catalogo.json';
import { norm, num } from './liga.js';
import { Carta, Ico } from './piezas.jsx';
import { MW_TIENDA, NOMBRE_EV, PALABRAS, PREGUNTAS, PUESTOS, SEMANA, pideLargo, textoSemana } from './guia.jsx';
import { Franja } from './ranking_a.jsx';
import CSS_PAGINA from './css/guia2.css?inline';
import { usarCss } from './css.js';

usarCss('guia2', CSS_PAGINA);

const PrimerosPasos = lazy(() => import('./tutorial.jsx').then((m) => ({ default: m.PrimerosPasos })));
// 📖 el tutorial completo (13/11/2026, Dlx: «el completo en la guía tmb»): los nueve capítulos
const Capitulos = lazy(() => import('./tutorial.jsx').then((m) => ({ default: m.Capitulos })));

// la cifra de cada cosa de la semana y cuándo pasa (lo mismo que dice su texto). Sin cifra donde no hay un número que
// diga algo: «Para siempre» en las Insignias y «📣» en Con tiempo repetían el título (crítica del 02/11/2026)
const CIFRA = {
  'Multiplicador': ['×0,5 a ×5', 'Lunes 11 AM'], 'Evento dorado': ['×3', 'Cada semana'], 'Guerra de servidores': ['×1,5', 'Cada semana'],
  'Copa de la Liga': ['×2', 'Cada semana'], 'Semillero': ['×1,5', 'Cada semana'], 'Meta de comunidad': ['+10 %', 'Lunes'],
  'Bonos': ['+1.500', 'Al jugar'], 'Clásico': ['+10 %', 'Al cruzarse'], 'Misiones': ['3 misiones', 'Lunes 11 AM'],
  'Ranking ELO': ['6 piedras', 'Cada lunes'], 'Pase de rapero': ['30 niveles', 'La temporada'], 'Premios de la semana': ['4 premios', 'Al cerrar la semana'],
};
// 📅 en qué carril de la semana va cada cosa: lo que dice su propio texto. Lo que no está acá va a «Toda la temporada»
const CARRIL = {
  'Multiplicador': 'lun', 'Misiones': 'lun', 'Ranking ELO': 'lun', 'Meta de comunidad': 'lun', 'Evento dorado': 'sem', 'Guerra de servidores': 'sem',
  'Copa de la Liga': 'sem', 'Semillero': 'sem', 'Bonos': 'jug', 'Clásico': 'jug', 'Premios de la semana': 'cie',
};
const CARRILES = [
  [['lun', 'El lunes, 11 AM', 'arranca']], [['sem', 'Toda la semana', 'en cada servidor']],
  [['jug', 'Cada vez que juegas', 'en el momento'], ['cie', 'Al cerrar la semana', 'el lunes siguiente']],
];
const CARTAS_TAG = [['temporada', 'Temporada'], ['competitivo', 'Competitiva'], ['servidor', 'Servidor'], ['pais', 'País']];
const NIVELES = ['t1', 't2', 't3', 't4'];
const DURA = { temporada: 'Dura esta temporada', siempre: 'Para siempre', semana: 'Esta semana', estado: 'Mientras dure' };
// los colores de las partes de una barra de 100 %: los de la casa
const PARTES = ['var(--tinta)', 'var(--verde)', 'var(--magenta)', '#8A8F98', '#F2B705'];
const nombreTag = (t) => t.replace(' x%d', ' ×N').replace('%d', 'N');
// las pestañas del papel, y en cuál vive cada sección que el buscador conoce («tarjetas» y «empezar» están arriba)
const PESTANAS = [['basico', 'Lo básico'], ['puntos', 'Puntos y rangos'], ['semana', 'La semana'], ['tags', 'Los TAG'], ['palabras', 'Palabras'], ['preguntas', 'Preguntas']];
const PESTANA_DE = { aprende: 'basico', mw: 'basico', puntos: 'puntos', rangos: 'puntos', semana: 'semana', tags: 'tags', palabras: 'palabras', preguntas: 'preguntas' };
const NOMBRE_SEC = { aprende: 'Aprende la Liga', empezar: 'Cómo empezar', tarjetas: 'Tus tarjetas', tags: 'Los TAG', puntos: 'Puntos por puesto',
  rangos: 'Rangos, OVR y Score', mw: 'Most Wanted y Tienda', semana: 'Lo de cada semana', palabras: 'Las palabras', preguntas: 'Preguntas' };

// el texto plano de algo de React (las respuestas de las preguntas traen links y código), para buscarlo
function plano(n) {
  if (n == null || typeof n === 'boolean') return '';
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  if (Array.isArray(n)) return n.map(plano).join('');
  return n.props ? plano(n.props.children) : '';
}
const raiz = () => { const h = document.getElementById('inicio-nuevo'); return h && h.shadowRoot; };
// bajar hasta algo de la Guía: con aire arriba, que la barra de la página no lo tape
const bajarA = (el) => { if (el) window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 90), behavior: 'smooth' }); };
// la palabra buscada, marcada
function Marca({ t, q }) {
  if (!q) return t;
  const i = norm(t).indexOf(q);
  if (i < 0) return t;
  return <>{t.slice(0, i)}<mark>{t.slice(i, i + q.length)}</mark>{t.slice(i + q.length)}</>;
}

// 🃏 TUS TARJETAS COMO LOMOS (de la B): la abierta con su carta grande y lo que pide; las otras, de canto
function Lomos({ liga, reqs, ab, setAb }) {
  const a = reqs.find((x) => x.id === ab) || reqs[0];
  const ejemplo = (id) => liga.oficiales().find((f) => (f.c || []).includes(id));
  return (
    <div className="gx-lomos">
      {reqs.map((x) => {
        if (x !== a) {
          return (
            <button key={x.id} id={'gx-car-' + x.id} type="button" className="gx-lomo" onClick={() => setAb(x.id)} aria-label={'Ver la tarjeta ' + x.titulo}>
              <span>{x.titulo}</span></button>
          );
        }
        const f = ejemplo(x.id);
        return (
          <div key={x.id} id={'gx-car-' + x.id} className="gx-lomo ab">
            {f ? <span className="gx-lomo-cw"><Carta liga={liga} k={f.k} cual={x.id} cls="gx-lomo-c" abre={false} /></span> : <span className="gx-lomo-cw gx-sin" aria-hidden="true">?</span>}
            <div><h3>{x.titulo}</h3><p>{x.mide}</p><ul>{(x.pide || []).map((p) => <li key={p}>{pideLargo(p)}</li>)}</ul></div>
          </div>
        );
      })}
      <span className="gx-lomo t2" title="Histórica y Prime: todas tus temporadas juntas, llegan con la Temporada 2"><span>T2 · Histórica y Prime</span></span>
    </div>
  );
}

// 🏅 LOS PUNTOS: la frase sobre verde (de la B) y la escalera de cada puesto, para la llave que elijas
function Puntos({ P }) {
  const escs = ['16+', '8-15', '4-7'].filter((e) => ((P.tablas || {})[e] || []).length);
  const [esc, setEsc] = useState(escs[0]);
  const vale = (e, p) => { const r = (P.tablas[e] || []).find((x) => x[0] === p); return r ? r[1] : null; };
  const filas = PUESTOS.map((p) => [p, vale(esc, p)]).filter((x) => x[1] != null).sort((a, b) => a[1] - b[1]);
  const max = Math.max(1, ...filas.map((x) => x[1]));
  const b = (p) => (vale(esc, p) != null ? <b>{num(vale(esc, p))}</b> : null);
  return (
    <div className="gx-verde">
      <div className="gx-verde-tx">
        <div className="gx-esc-b" role="tablist" aria-label="Raperos en la llave">
          {escs.map((e) => <button key={e} type="button" role="tab" aria-selected={e === esc} className={e === esc ? 'on' : ''} onClick={() => setEsc(e)}>{NOMBRE_EV[e]}<small>raperos</small></button>)}
        </div>
        <p className="gx-frase">Ganar una llave de {NOMBRE_EV[esc]} vale {b('Campeón')}. Llegar a la final, {b('Subcampeón')}.{vale(esc, 'Cuartos') != null ? <> Caer en cuartos, {b('Cuartos')}.</> : null}</p>
      </div>
      <div className="gx-escalera" style={{ '--n': filas.length }} role="img" aria-label={filas.map(([p, v]) => p + ' ' + num(v)).join(', ')}>
        {filas.map(([p, v], i) => (
          <div key={p} id={'gx-pts-' + p} className={'gx-esc-c' + (i === filas.length - 1 ? ' top' : '')}>
            <span className="ar"><b>{num(v)}</b><i style={{ '--h': Math.round(100 * v / max) + '%' }} /></span>
            <small>{p}{p === 'Semifinal' ? '*' : ''}</small>
          </div>
        ))}
      </div>
      <ul className="gx-notas">
        <li><b>Depende de cuánta gente juega</b>: ganar una llave de 16 vale más que ganar una de 6.</li>
        <li><b>Por equipos</b>: los puntos del puesto se reparten entre los integrantes.</li>
        {(P.walkin || []).length ? <li><b>Walk-in</b>: quien entra saltándose rondas cobra {P.walkin.map((w, i) => w[1] + ' % con ' + w[0] + (i === P.walkin.length - 1 ? ' o más' : '') + (w[0] === 1 ? ' ronda' : ' rondas')).join(', ')}.</li> : null}
        {P.revivido != null ? <li><b>Revivido</b>: su primer puesto entero y el {P.revivido} % del puesto final.</li> : null}
        {vale(esc, 'Semifinal') != null ? <li><b>* Semifinal</b>: cuando no se juega el tercer puesto.</li> : null}
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

// 🔠 el material viaja como identificador (MATERIAL de comun/rangos.py: 'rubi', sin tilde) y la Guía lo pegaba tal cual:
// «A rubi». Se escribe acá y no en rangos.py, que entra en la huella de las cuatro cartas (18/11/2026)
const MAT_TX = { rubi: 'rubí' };
const matTx = (m) => MAT_TX[m] || m || '';

// 🔠 los ocho rangos en una regla de 0 a 100: cada letra ocupa lo que mide su tramo, y abajo su material (el de su tarjeta)
function Regla({ rangos }) {
  const xs = rangos.slice().sort((a, b) => (a.min || 0) - (b.min || 0));
  const ancho = (i) => Math.max(4, (i < xs.length - 1 ? xs[i + 1].min : 100) - (xs[i].min || 0));
  return (
    <div className="gx-regla">
      <div className="gx-regla-b">
        {xs.map((r, i) => (
          <div key={r.r} id={'gx-rg-' + r.r} className="gx-regla-s" style={{ width: ancho(i) + '%', '--c': r.color }} title={r.r + ' · ' + (r.min ? r.min + ' o más' : 'el resto')}>
            <b>{r.r}</b><small>{r.min || 0}</small>
          </div>
        ))}
      </div>
      {xs.some((r) => r.mat) ? <div className="gx-regla-m" aria-hidden="true">{xs.map((r, i) => <span key={r.r} style={{ width: ancho(i) + '%' }}>{matTx(r.mat)}</span>)}</div> : null}
      {xs.some((r) => r.mat) ? <p className="gx-oculto">Cada letra tiene su material, el de su tarjeta: {xs.map((r) => r.r + ' ' + matTx(r.mat)).join(' · ')}.</p> : null}
    </div>
  );
}

// ✂️ EN EL CELULAR, LA PRIMERA FRASE Y «MÁS» (19/11/2026, el pulido de la Guía: Dlx, «Pulir la de hoy»). «La semana»
// medía 2.751 px a 390, cada tarjeta con su texto entero. En la compu se lee todo (el CSS esconde «Más»); el buscador la
// abre sola: `llevar()` le manda `gx-abrir` al elemento que encontró
function Abrible({ id, cls, texto, children, pie }) {
  const [ab, setAb] = useState(false);
  const yo = useRef(null);
  useEffect(() => {
    const el = yo.current;
    if (!el) return undefined;
    const f = () => setAb(true);
    el.addEventListener('gx-abrir', f);
    return () => el.removeEventListener('gx-abrir', f);
  }, []);
  // la primera frase («. » y no un punto de miles); si lo que sigue es corto, va entero
  const j = texto.search(/\.\s/);
  const a = j > 0 && texto.length - j > 40 ? texto.slice(0, j + 1) : texto;
  const resto = texto.slice(a.length);
  return (
    <div ref={yo} id={id} className={cls + ' gx-abr' + (ab ? ' abierto' : '')}>
      {children}
      <p className="gx-cor">{a}{resto ? <><span className="gx-resto">{resto}</span>{' '}
        <button type="button" className="gx-mas" onClick={() => setAb(true)} aria-expanded={ab}>Más</button></> : null}</p>
      {pie}
    </div>
  );
}

// 🎯 MOST WANTED, ENCUESTAS Y TIENDA, EN TARJETAS (19/11/2026, el pulido): eran cinco párrafos sin nada que mirar. Cada
// una con su cifra y adónde ir. ⚠️ Las cifras son las que dice su texto en MW_TIENDA (guia.jsx): si cambia una, la otra;
// la de Most Wanted sale del payload (`guia.mw`, los buscados de esta semana)
const MW_CIFRA = {
  'Most Wanted': [null, 'buscados esta semana', '#/ranking/mw', 'Ver los buscados'],
  'El Elegido': ['3', 'votos y entra al próximo', '#/publicaciones', 'Votar'],
  'El ×2 votado': ['×2', 'como mínimo, el más votado', '#/publicaciones', 'Votar'],
  'Puntos de Tienda': ['5.000', 'para arrancar', '#/tienda', 'Ir a la Tienda'],
  'Precio por cabeza': ['1.º', 'que le gane, se los lleva', '#/tienda', 'Poner un precio'],
};
function MwTienda({ mw }) {
  return (
    <div className="gx-mwc">
      {MW_TIENDA.map(([t, d], i) => {
        const c = MW_CIFRA[t] || [];
        const fig = t === 'Most Wanted' ? (mw ? num(mw) : null) : c[0];
        return (
          <Abrible key={t} id={'gx-mw-' + i} cls="gx-mw" texto={d.replace('{MW}', mw ? ' (' + mw + ')' : '')}
            pie={c[2] ? <a className="gx-mw-a" href={c[2]}>{c[3]} <Ico n="flecha" t={14} /></a> : null}>
            {fig ? <span className="gx-mw-f">{fig}<small>{c[1]}</small></span> : null}
            <b className="gx-mw-t">{t}</b>
          </Abrible>
        );
      })}
    </div>
  );
}

// 📅 LA SEMANA EN CARRILES: lo que arranca el lunes, lo que dura toda la semana, lo que pasa al jugar y lo que se cobra al
// cerrar; abajo, lo de toda la temporada
function Semana({ et }) {
  const item = (x, i) => {
    const t = x[0];
    const c = CIFRA[t];
    return <Abrible key={t} id={'gx-sem-' + i} cls="gx-it" texto={textoSemana(x, et)}>{c ? <span className="x">{c[0]}</span> : null}<b>{t}</b></Abrible>;
  };
  const de = (k) => SEMANA.map((x, i) => [x, i]).filter(([x]) => (CARRIL[x[0]] || 'tem') === k);
  return (
    <>
      <div className="gx-carriles">
        {CARRILES.map((g) => (
          <div key={g[0][0]} className="gx-carril">
            {g.map(([k, t, s]) => de(k).length ? (
              <div key={k}><h3>{t}<small>{s}</small></h3>{de(k).map(([x, i]) => item(x, i))}</div>
            ) : null)}
          </div>
        ))}
      </div>
      {de('tem').length ? <div className="gx-temporada"><h3>Toda la temporada</h3>{de('tem').map(([x, i]) => item(x, i))}</div> : null}
    </>
  );
}

// 🏷️ LOS TAG POR RAREZA (una fila por nivel, como una tier list) con la ficha del elegido al costado: qué pide, cuánto dura,
// cuántos lo tienen y cómo sale abajo de la carta
function Tags({ liga, cual, setCual, sel, setSel }) {
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
  // el elegido: el que tocaste, si no el tuyo, si no el primero
  const i0 = sel[cual] != null ? sel[cual] : yo && yo[col] >= 0 ? yo[col] : 0;
  const x = lista[i0] || lista[0];
  const nombreCarta = (CARTAS_TAG.find(([c]) => c === cual) || [])[1];
  return (
    <>
      {mios.length ? <div className="gx-tuyos"><b>Los tuyos hoy</b>{mios.map(([n, t]) => <span key={n}><small>{n}</small>{nombreTag(t)}</span>)}</div> : null}
      <div className="gx-tabs" role="tablist" aria-label="Los TAG de cada tarjeta">
        {CARTAS_TAG.map(([c, n]) => (
          <button key={c} type="button" role="tab" aria-selected={c === cual} className={c === cual ? 'on' : ''} onClick={() => setCual(c)}>
            {n}<small>{((TAGS.cat || {})[c] || []).length}</small></button>
        ))}
      </div>
      <div className="gx-tl">
        <div>
          {NIVELES.map((nv) => {
            const xs = lista.map((t, i) => [t, i]).filter(([t]) => t[1] === nv);
            if (!xs.length) return null;
            return (
              <div key={nv} className={'gx-tl-f gx-nv' + nv.slice(1)}>
                <div className="gx-tl-r"><b>{(TAGS.niveles || {})[nv] || nv}</b><small>{xs.length} TAG</small></div>
                <div className="gx-tl-x">
                  {xs.map(([[t], i]) => (
                    <button key={t} id={'gx-tag-' + cual + '-' + i} type="button" aria-pressed={i === i0}
                      className={'gx-st' + (i === i0 ? ' on' : '') + (yo && yo[col] === i ? ' tuyo' : '')} onClick={() => setSel((s) => ({ ...s, [cual]: i }))}>
                      {nombreTag(t)}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {x ? (
          <aside className="gx-tl-d" aria-live="polite">
            <span className="gx-tl-k">{(TAGS.niveles || {})[x[1]] || x[1]} · {nombreCarta}</span>
            <b className="gx-tl-n">{nombreTag(x[0])}</b>
            <div className="gx-tl-c"><small>Así sale abajo de tu carta</small><span className={'gx-pill gx-nv' + x[1].slice(1)}>{nombreTag(x[0])}</span></div>
            <p>{x[2]}</p>
            <small>{DURA[x[3]] || ''}{de ? (DURA[x[3]] ? ' · ' : '') + (cuantos[i0] === 1 ? '1 lo tiene hoy' : cuantos[i0] + ' lo tienen hoy') : ''}{yo && yo[col] === i0 ? ' · es el tuyo' : ''}</small>
          </aside>
        ) : null}
      </div>
    </>
  );
}

// 🔤 LAS PALABRAS DE LA A A LA Z: la letra grande y las suyas; las letras de arriba bajan a la suya
function Palabras() {
  const por = {};
  PALABRAS.forEach(([t, d], i) => { const l = norm(t)[0].toUpperCase(); (por[l] = por[l] || []).push([t, d, i]); });
  const ls = Object.keys(por).sort();
  return (
    <>
      <nav className="gx-az" aria-label="Ir a una letra">
        {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => (
          <button key={l} type="button" disabled={!por[l]} onClick={() => { const r = raiz(); bajarA(r && r.getElementById('gx-letra-' + l)); }}>{l}</button>
        ))}
      </nav>
      <div className="gx-letras">
        {ls.map((l) => (
          <div key={l} id={'gx-letra-' + l} className="gx-letra">
            <b aria-hidden="true">{l}</b>
            <dl>{por[l].map(([t, d, i]) => <div key={t} id={'gx-pal-' + i}><dt>{t}</dt><dd>{d}</dd></div>)}</dl>
          </div>
        ))}
      </div>
    </>
  );
}

export function Guia({ liga, dc }) {
  const G = liga.d.guia || {};
  // 🪨 desde la T2 el Ranking ELO es el de temporada (el lobby trae `et` en las divisiones)
  const esT2 = !!(liga.d.div && liga.d.div.et);
  const P = G.puntos || {};
  const reqs = liga.d.requisitos || [];
  const rangos = liga.d.rangos || [];
  const [q0, setQ] = useState('');
  const q = norm(q0).trim();
  const [tab, setTab] = useState('basico');
  const [cual, setCual] = useState('temporada');
  const [sel, setSel] = useState({});
  const [lomo, setLomo] = useState(reqs[0] ? reqs[0].id : null);
  const caja = useRef(null);
  const conRango = (liga.d.tabla || []).filter((f) => f.rg).length;
  const confTxt = (G.conf || []).map((c, i) => c[1] + ' % ' + (i === G.conf.length - 1 ? 'desde ' : 'con ') + c[0] + (c[0] === 1 ? ' evento' : ' eventos')).join(', ');
  const ntag = CARTAS_TAG.reduce((t, [c]) => t + (((TAGS.cat || {})[c] || []).length), 0);
  const rgs = rangos.slice().sort((a, b) => (a.min || 0) - (b.min || 0));
  const tabla16 = (P.tablas || {})['16+'] || [];
  const primero = (e) => { const r = ((P.tablas || {})[e] || []).find((x) => x[0] === 'Campeón'); return r ? num(r[1]) : null; };
  // la franja: cuatro cifras con su porqué, todas de donde se calculan
  const franja = [
    tabla16.length ? { l: 'Ganar una llave de 16 o más', v: primero('16+'), em: 'pts', c: [primero('8-15') ? 'la de 8 a 15, ' + primero('8-15') : '', primero('4-7') ? 'la de 4 a 7, ' + primero('4-7') : ''].filter(Boolean).join('; ') || 'el campeón' } : null,
    rgs.length ? { l: 'Los rangos', v: rgs.length, em: 'de ' + rgs[0].r + ' a ' + rgs[rgs.length - 1].r, c: 'salen del Score competitivo, desde los 10 eventos' } : null,
    ntag ? { l: 'Los TAG', v: ntag, em: 'en 4 tarjetas', c: 'cada tarjeta muestra uno solo: el primero que cumples' } : null,
    { l: 'Cada lunes, 11 AM ET', v: CIFRA.Multiplicador[0], c: 'el multiplicador de cada servidor para esa semana' },
  ].filter(Boolean);
  // 🔎 todo lo que se puede buscar, en texto plano, y adónde lleva: [sección, título, texto, {id, tag, lomo, faq}]
  const todo = useMemo(() => {
    const porEsc = (p) => ['16+', '8-15', '4-7'].map((e) => {
      const r = ((P.tablas || {})[e] || []).find((x) => x[0] === p);
      return r ? NOMBRE_EV[e] + ' raperos: ' + num(r[1]) : '';
    }).filter(Boolean).join(' · ');
    return [
      ...PALABRAS.map(([t, d], i) => ['palabras', t, d, { id: 'gx-pal-' + i }]),
      ...SEMANA.map((x, i) => ['semana', x[0], textoSemana(x, esT2), { id: 'gx-sem-' + i }]),
      ...MW_TIENDA.map(([t, d], i) => ['mw', t, d.replace('{MW}', ''), { id: 'gx-mw-' + i }]),
      ...PREGUNTAS.map(([t, a], i) => ['preguntas', t, plano(a), { id: 'gx-faq-' + i }]),
      ...reqs.map((x) => ['tarjetas', x.titulo, x.mide + ' ' + (x.pide || []).map(pideLargo).join(' · '), { id: 'gx-car-' + x.id, lomo: x.id }]),
      ...(P.tablas ? PUESTOS.map((p) => ['puntos', p + ' · puntos', porEsc(p), { id: 'gx-pts-' + p }]).filter((x) => x[2]) : []),
      ...rgs.map((r, i) => ['rangos', 'Rango ' + r.r + (r.mat ? ' · ' + matTx(r.mat) : ''),
        r.min ? 'Desde ' + r.min + ' de Score.' : 'Menos de ' + ((rgs[i + 1] || {}).min || '') + ' de Score.', { id: 'gx-rg-' + r.r }]),
      ...(G.ovr || []).map((x) => ['rangos', 'OVR · ' + x[0], x[1] + ' % del OVR. Cada parte se compara con la mejor de la temporada.', { id: 'gx-ovr' }]),
      ...(G.score || []).map((x) => ['rangos', 'Score · ' + x[1], x[3] + ' % del Score. ' + (x[2] || ''), { id: 'gx-score' }]),
      ...(confTxt ? [['rangos', 'Confianza', 'Multiplica el Score y premia jugar más: ' + confTxt + '.', { id: 'gx-conf' }]] : []),
      ...CARTAS_TAG.flatMap(([c, n]) => ((TAGS.cat || {})[c] || []).map((x, i) => ['tags', nombreTag(x[0]) + ' · ' + n, x[2], { id: 'gx-tag-' + c + '-' + i, tag: [c, i] }])),
    ];
  }, [reqs, rgs, G, P, confTxt]);
  // primero lo que lo dice en el título
  const res = q.length >= 2 ? todo.filter(([, t, d]) => norm(t).includes(q) || norm(d).includes(q))
    .sort((a, b) => (norm(b[1]).includes(q) ? 1 : 0) - (norm(a[1]).includes(q) ? 1 : 0)).slice(0, 30) : [];
  // llevar a una cosa: su pestaña, su lomo, su TAG o su pregunta abierta, y una marca que dura un rato
  const llevar = (sec, dst) => {
    if (PESTANA_DE[sec]) setTab(PESTANA_DE[sec]);
    if (dst && dst.lomo) setLomo(dst.lomo);
    if (dst && dst.tag) { setCual(dst.tag[0]); setSel((s) => ({ ...s, [dst.tag[0]]: dst.tag[1] })); }
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const r = raiz();
      const el = r && dst && dst.id ? r.getElementById(dst.id) : null;
      if (el && el.tagName === 'DETAILS') el.open = true;
      // lo que en el celular va recortado a su primera frase, abierto (ver `Abrible`)
      if (el) el.dispatchEvent(new Event('gx-abrir'));
      bajarA(el || (r && r.getElementById('gx-papel')));
      if (el) {
        el.classList.remove('gx-flash');
        el.getBoundingClientRect();
        el.classList.add('gx-flash');
        setTimeout(() => el.classList.remove('gx-flash'), 2400);
      }
    }));
  };
  const pregunta = (i) => llevar('preguntas', { id: 'gx-faq-' + i });
  return (
    <>
      <div className="escena gx-esc" style={{ '--mo-c': '#E41373', '--mo-o': 0.85 }}>
        <section className="gx-cab rka">
          <div className="gx-cabeza">
            <div className="gx-cab-tx">
              <span className="tag">GUÍA · {liga.temp}</span>
              <h1 className="hero-ev largo">Cómo funciona</h1>
              <p className="hero-p">Cómo empezar, qué pide cada tarjeta, cuántos puntos da cada puesto, de dónde sale tu rango y qué significa cada palabra.</p>
            </div>
            <div className="gx-bus">
              <label className="gx-busca">
                <Ico n="buscar" t={20} />
                <input ref={caja} type="search" value={q0} onChange={(e) => setQ(e.target.value)} placeholder="Busca: OVR, Most Wanted, /card…"
                  aria-label="Buscar en la Guía" enterKeyHint="search" />
              </label>
              {q.length >= 2 ? (
                <section className="gx-res" aria-live="polite">
                  <h2 className="gx-res-t">{res.length ? (res.length === 1 ? '1 resultado' : res.length + (res.length === 30 ? '+' : '') + ' resultados') : 'Nada'} para «{q0.trim()}»
                    <button type="button" className="gx-res-x" onClick={() => setQ('')}>Borrar</button></h2>
                  {res.length ? (
                    <ul>{res.map(([sec, t, d, dst], i) => (
                      <li key={sec + t + i}><button type="button" onClick={() => llevar(sec, dst)}>
                        <small>{NOMBRE_SEC[sec] || sec}</small><b><Marca t={t} q={q} /></b>
                        <span>{(() => { const j = norm(d).indexOf(q); const a = Math.max(0, j - 50); return (a ? '…' : '') + d.slice(a, a + 150) + (d.length > a + 150 ? '…' : ''); })()}</span>
                      </button></li>
                    ))}</ul>
                  ) : <p className="gx-nota">Prueba con otra palabra, o mira las <button type="button" className="gx-link" onClick={() => { setQ(''); llevar('preguntas', null); }}>preguntas frecuentes</button>.</p>}
                </section>
              ) : (
                <div className="gx-atajos" aria-label="Lo que más se pregunta">
                  {PREGUNTAS.slice(0, 3).map(([t], i) => <button key={t} type="button" onClick={() => pregunta(i)}>{t}</button>)}
                </div>
              )}
            </div>
          </div>
          <Franja items={franja} />
          <div className="gx-dos">
            <div className="rka-caja gx-emp">
              <h2 className="rka-h">Cómo empezar<small>ninguno pide jugar</small></h2>
              <Suspense fallback={null}><PrimerosPasos liga={liga} dc={dc} enGuia /></Suspense>
            </div>
            {reqs.length ? (
              <div className="rka-caja gx-tj">
                <h2 className="rka-h">Tus tarjetas<small>qué pide cada una · toca un lomo</small></h2>
                <Lomos liga={liga} reqs={reqs} ab={lomo} setAb={setLomo} />
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <section className="sec gx-papel rka-papel" id="gx-papel">
        <div className="rka-pes gx-pes" role="tablist" aria-label="Qué ver de la Guía">
          {PESTANAS.map(([id, t]) => {
            const n = { basico: 9, puntos: rgs.length, semana: SEMANA.length, tags: ntag, palabras: PALABRAS.length, preguntas: PREGUNTAS.length }[id];
            return <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{t}{n ? <small>{n}</small> : null}</button>;
          })}
        </div>

        {tab === 'basico' ? (
          <div className="gx-p">
            <div className="gx-pista" id="gx-aprende"><Suspense fallback={null}><Capitulos /></Suspense></div>
            <h3 className="gx-sub" id="gx-mw">Most Wanted, encuestas y Tienda</h3>
            <MwTienda mw={G.mw} />
          </div>
        ) : null}

        {tab === 'puntos' ? (
          <div className="gx-p">
            {P.tablas ? <Puntos P={P} /> : null}
            {rgs.length ? (
              <div id="gx-rangos">
                <h3 className="gx-sub">Los rangos, de 0 a 100 de Score</h3>
                <p className="gx-nota">{conRango ? 'El rango sale del Score competitivo y es uno solo por persona: da igual en todas tus tarjetas.'
                  : 'El rango sale del Score competitivo, y para tenerlo hacen falta 10 eventos en la temporada.'}</p>
                <Regla rangos={rgs} />
                <div className="gx-dos-p">
                  {(G.ovr || []).length ? (
                    <div className="gx-pesos" id="gx-ovr"><h4>El OVR<small>de 40 a 99 · ordena la temporada</small></h4>
                      <Barra partes={G.ovr.map((x) => [x[0], x[1]])} />
                      <p className="gx-nota">Cada parte se compara con la mejor de la temporada.</p></div>
                  ) : null}
                  {(G.score || []).length ? (
                    <div className="gx-pesos" id="gx-score"><h4>El Score<small>de 0 a 100 · da el rango</small></h4>
                      <Barra partes={G.score.map((x) => [(x[0] ? x[0] + ' ' : '') + x[1], x[3], x[2]])} />
                      {confTxt ? <p className="gx-nota" id="gx-conf">Y se multiplica por la <b>confianza</b>, que premia jugar más: {confTxt}.</p> : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === 'semana' ? (
          <div className="gx-p" id="gx-semana">
            <p className="gx-nota">Lo que cambia los puntos semana a semana, y cuándo pasa. La semana arranca el lunes a las 11 AM (hora del este).</p>
            <Semana et={esT2} />
          </div>
        ) : null}

        {tab === 'tags' ? (
          <div className="gx-p" id="gx-tags">
            <p className="gx-nota">El cartelito de abajo de cada tarjeta. Cada una muestra uno solo: el primero que cumples, de arriba abajo —en la de Servidor,
              «Visitante ilustre» y «De visita» van antes que todos—, y el mismo hecho no sale en dos tarjetas tuyas.</p>
            <Tags liga={liga} cual={cual} setCual={setCual} sel={sel} setSel={setSel} />
          </div>
        ) : null}

        {tab === 'palabras' ? <div className="gx-p" id="gx-palabras"><Palabras /></div> : null}

        {tab === 'preguntas' ? (
          <div className="gx-p gx-faq" id="gx-preguntas">
            {PREGUNTAS.map(([t, a], i) => <details key={t} id={'gx-faq-' + i}><summary>{t}</summary><p>{a}</p></details>)}
          </div>
        ) : null}
      </section>
    </>
  );
}
