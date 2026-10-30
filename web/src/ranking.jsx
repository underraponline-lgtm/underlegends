// El Ranking nuevo (`#/ranking/<sub>`). Dlx, 02/10/2026: «quiero que sigas con el remake de la página de… ranking»,
// y al ver la preview, «me encanta» (1.90). (La tabla de app.js quedó escondida debajo, de respaldo, hasta que app.js
// se borró el 27/10/2026.)
//
// 🔑 Y SUS CINCO IDEAS (Dlx, 02/10/2026: «1. me gusta … 5. listo»): las flechas de cuánto subió cada uno desde el
// lunes (`mv`, del ciclo), «NUEVO» a quien debutó esta semana (`nu`), los que tenés cerca, la fila que se abre ahí
// mismo y tu puesto como imagen para historias. La 6 —comparar— va con la página de Tarjetas.
//
// 🔑 LAS MISMAS REGLAS QUE `COL` Y `SUBS` DE app.js, porque mientras convivan tienen que decir lo mismo:
//   · cada ranking declara sus filas, su orden y sus columnas, y TODAS las columnas se ordenan
//   · lo vacío va al final, ordene como ordene: sin rango no es «el más bajo», es que no tiene el dato
//   · el número salta a quien está fuera de concurso: queda en su lugar, sin número
//   · la Temporada lleva su puesto oficial (`pos`, con empates); los demás, el lugar en ESTE ranking
// Si una regla cambia allá, cambia acá.
//
// Lo que agrega el remake (estructura, no pintura): el podio con las cartas de verdad, «tu lugar» siempre a la vista
// con «Encontrarme», los filtros de servidor, país y a quién seguís, y en el celular las columnas que entran.
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { MESES, limpio, norm, num, resultado, siglaDe, srcLogo, utc } from './liga.js';
import { Escudo, escudoDe } from './escudo.jsx';
import { Bandera, Cara, Carta, Chevron, Compartir, Ico, accion, enlace, nombrePais } from './piezas.jsx';
import { useDesliza } from './anima.js';
import { SeBusca } from './abajo.jsx';
import { W, aPng, armarYCompartir, carta, lienzo, pie } from './historia.js';
import { Divisiones } from './divisiones.jsx';
import { Misiones } from './misiones.jsx';
import { svElegido, useElegidos } from './elegidos.js';
import { Ascenso, useDetalle } from './ligas.jsx';
import { usePases } from './pase.js';
import { TierChip } from './crewpanel.jsx';
import CSS_PAGINA from './css/ranking.css?inline';
import { usarCss } from './css.js';

// 🎨 su CSS, con su pedazo (web/src/css/ranking.css)
usarCss('ranking', CSS_PAGINA);

const pct = (x) => parseFloat(String(x == null ? '' : x).replace(',', '.')) || 0;
const coma = (x, d = 1) => Number(x || 0).toFixed(d).replace('.', ',');
// 🔑 EL ORDEN DE UN MEDALLERO (el de app.js): oros, después platas, después bronces. Sumarlas diría que tres bronces
// valen más que un oro
const medallero = (a, b) => (b.oro || 0) - (a.oro || 0) || (b.seg || 0) - (a.seg || 0) || (b.ter || 0) - (a.ter || 0) || (b.pts || 0) - (a.pts || 0);
const NADA = <span className="rk-nada">—</span>;
const PUNTO = <span className="rk-nada">·</span>;

function fechaCorta(iso) {
  const d = new Date(String(iso || '') + 'T12:00:00');
  if (isNaN(d)) return String(iso || '');
  return d.getDate() + ' ' + MESES[d.getMonth()].slice(0, 3);
}

// ── el puesto: el 1 en verde agua, el 2 en magenta y el 3 en negro (la dirección «Calle»); sin número, «—» ──────────
function Num({ n, fc }) {
  if (!n) return <span className="rk-n sin" title={fc ? 'Fuera de concurso: todavía no es miembro de la Liga' : 'Sin puesto todavía'}>—</span>;
  return <span className={'rk-n' + (n <= 3 ? ' p' + n : '')}>{n}</span>;
}

// ── 📈 SEMANA A SEMANA (Dlx, 19/10/2026, «me gustan todas», a «Sparkline» de 21st): cuánto sumó cada uno en cada
// semana de la temporada, de `/api/semanas` (`_semanas_de()` de bot/subir_web.py: va aparte del lobby, que ya está al
// tope). Se pide una vez por sesión, sólo en el Ranking de Temporada; la última barra es esta semana hasta hoy ────────
let SEM = null, semPidiendo = null;
function useSemanas(activo) {
  const [s, setS] = useState(SEM);
  useEffect(() => {
    if (!activo || SEM) return undefined;
    let vivo = true;
    semPidiendo = semPidiendo || fetch('/api/semanas', { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null);
    semPidiendo.then((j) => { if (j && j.g) SEM = j; if (vivo) setS(SEM); });
    return () => { vivo = false; };
  }, [activo]);
  return s;
}
function Tendencia({ g, lunes }) {
  if (!g || !g.length) return NADA;
  const max = Math.max(...g, 1);
  const tit = 'Puntos por semana: ' + g.map((v, i) => (lunes && lunes[i] ? fechaCorta(lunes[i]) + ' ' : '') + num(v)).join(' · ');
  // 🗣️ con el número de esta semana al lado (Dlx, 20/10/2026: «es difícil de entender si primera vez lo ves»): las
  // barritas solas no dicen qué miden; «+40» en magenta, sí —y es lo que ordena la columna
  const hoy = g[g.length - 1] || 0;
  return (
    <span className="rk-ten-c" title={tit} aria-label={tit}>
      <span className="rk-ten">
        {g.map((v, i) => <i key={i} className={i === g.length - 1 ? 'ult' : ''} style={{ height: Math.max(2, Math.round((16 * v) / max)) + 'px' }} />)}
      </span>
      <small className="rk-ten-n">{hoy ? '+' + num(hoy) : '0'}</small>
    </span>
  );
}

// 📈 la misma historia, con sus números y sus fechas: va en la fila abierta, donde hay lugar para explicarla
function Semanas({ g, lunes }) {
  if (!g || !g.length) return null;
  const max = Math.max(...g, 1);
  return (
    <>
      <span className="rk-det-t">SEMANA A SEMANA</span>
      <ol className="rk-det-sem" aria-label="Puntos que sumó cada semana de la temporada">
        {g.map((v, i) => (
          <li key={i} className={i === g.length - 1 ? 'ult' : ''}>
            <b>{v ? '+' + num(v) : '0'}</b>
            <i style={{ height: Math.max(3, Math.round((34 * v) / max)) + 'px' }} />
            <small>{i === g.length - 1 ? 'esta sem.' : lunes && lunes[i] ? fechaCorta(lunes[i]) : 'sem. ' + (i + 1)}</small>
          </li>
        ))}
      </ol>
      <p className="rk-det-c">Cuánto sumó en cada semana de la temporada; la magenta es esta semana, hasta hoy.</p>
    </>
  );
}

// ── ▲▼ cuánto subió desde el lunes (`mv` del ciclo: la foto del lunes, `foto_semana()` de bot/subir_web.py). La
// flecha es un triángulo dibujado, no un carácter; el número dice cuántos puestos ──────────────────────────────────
function Mov({ mv, largo = false }) {
  if (!mv) return null;
  const n = Math.abs(mv);
  const que = (mv > 0 ? 'subió ' : 'bajó ') + n + (n === 1 ? ' puesto' : ' puestos') + ' desde el lunes';
  return (
    <span className={'rk-mv ' + (mv > 0 ? 'sube' : 'baja')} title={que}>
      <i aria-hidden="true" />{n}{largo ? ' esta semana' : null}<span className="rk-sr">{' (' + que + ')'}</span>
    </span>
  );
}

// ── quién: la cara, el nombre (el link a su perfil), la bandera y, abajo, su servidor y su crew ─────────────────────
function Quien({ x, f }) {
  const { liga } = x;
  const t = liga.T[f.k];
  const crew = limpio((t && t.crew) || f.crew || '');
  const mio = !!x.yoK && f.k === x.yoK;
  const sigo = !mio && x.sigo.has(f.k);
  // «NUEVO»: su primer evento es de esta semana (`nu`, ver `debutantes()` de bot/subir_web.py). Va en todas las
  // listas de gente: en Duelos la fila es otra, así que se mira la de la tabla
  const nuevo = !!((t || f).nu);
  const nombre = limpio(f.n);
  return (
    <span className="rk-q">
      <Cara liga={liga} k={f.k} nombre={f.n} cls="cara rk-cara" lazy />
      <span className="rk-qn">
        <span className="rk-qa">
          {f.k ? <a href={'#/r/' + encodeURIComponent(f.k)}>{nombre}</a> : <b>{nombre}</b>}
          <Bandera cc={f.cc} cls="rk-flag" />
        </span>
        {/* las etiquetas van ANTES del servidor y la crew: al final se las comía el «…» de una crew larga en el celular */}
        <small>{mio ? <em className="rk-vos">TÚ</em> : sigo ? <em className="rk-sigo">SIGUES</em> : null}
          {nuevo ? <em className="rk-nuevo">NUEVO</em> : null}<span className="rk-qx">{[siglaDe(svElegido(liga, x.eleg, f.k)), crew].filter(Boolean).join(' · ')}</span></small>
        {/* 📊 la barra: sus puntos contra el que más sumó (la maqueta C; se puede sacar si no convence) */}
        {x.barra && x.maxPts ? <i className="rk-bar" style={{ '--w': Math.round(1000 * (t || f).pts / x.maxPts) / 10 + '%' }} title={num((t || f).pts) + ' de ' + num(x.maxPts) + ' puntos del que más sumó'} /> : null}
      </span>
    </span>
  );
}

function Pais({ x, f }) {
  return (
    <span className="rk-q">
      <Bandera cc={f.cc} cls="rk-gflag" />
      <span className="rk-qn">
        <span className="rk-qa"><a href={'#/pais/' + f.cc}>{nombrePais(f.cc)}</a></span>
        {x.miCc === f.cc ? <small><em className="rk-vos">TU PAÍS</em></small> : null}
      </span>
    </span>
  );
}

function LogoCrew({ c, cls }) {
  const [mal, setMal] = useState(false);
  // 🛡️ el escudo armado, o el de su nombre si no tiene logo (escudo.jsx, 29/10/2026)
  const e = escudoDe(c.logo, limpio(c.crew));
  if (e) return <span className={cls + ' con-esc'}><Escudo e={e} /></span>;
  if (c.logo && !mal) return <img className={cls} alt="" src={srcLogo(c.logo)} loading="lazy" onError={() => setMal(true)} />;
  return <span className={cls + ' ini'}>{limpio(c.crew).slice(0, 2).toUpperCase()}</span>;
}

function Crew({ x, f }) {
  const mia = x.miCrew && limpio(f.crew).toLowerCase() === x.miCrew;
  return (
    <span className="rk-q">
      <LogoCrew c={f} cls="rk-clogo" />
      <span className="rk-qn">
        <span className="rk-qa"><a href={'#/crew/' + encodeURIComponent(f.clave || f.crew)}>{limpio(f.crew)}</a></span>
        <small>{f.rk === 0 ? 'SIN PUESTO: LE FALTAN RAPEROS' : ''}{mia ? <em className="rk-vos">TU CREW</em> : null}</small>
      </span>
    </span>
  );
}

// 🔑 CADA COLUMNA DICE CÓMO SE MUESTRA (`v`) Y CÓMO SE ORDENA (`s`); `tc` es su nombre corto, para el celular.
// `txt` ordena de la A a la Z; el resto, de mayor a menor (el `COL` de app.js)
const COL = {
  // ⚠️ EL `#` ORDENA POR MÉRITO (`o`), no por `pos`: quien está fuera de concurso no tiene `pos` y se iría al fondo
  pos: { t: '#', cls: 'c-pos', s: (f) => f.o || f.pos,
    v: (f) => <span className="rk-posc"><Num n={f.fc ? 0 : f.pos} fc={f.fc} />{f.mv ? <Mov mv={f.mv} /> : null}</span> },
  i: { t: '#', cls: 'c-pos', s: (f) => f._o || f._i, v: (f) => <Num n={f._i} fc={f.fc} /> },
  n: { t: 'Rapero', cls: 'c-n', txt: 1, s: (f) => norm(limpio(f.n)), v: (f, x) => <Quien x={x} f={f} /> },
  ovr: { t: 'OVR', tit: 'El número de la temporada, de 40 a 99', s: (f) => f.ovr || 0, v: (f) => (f.ovr ? f.ovr : NADA) },
  // ⚠️ EL RANGO SE ORDENA POR SCORE, que es de donde sale: por letra, «SSS» quedaría abajo de «S»
  rg: { t: 'Rango', tit: 'La letra, de E a SSS: sale del Score y aparece con 10 eventos', s: (f) => (f.rg ? f.sc || 0 : ''),
    v: (f, x) => (f.rg ? <span className="rg rk-rg" style={{ background: x.liga.colorRg(f.rg) }}>{f.rg}</span> : NADA) },
  sc: { t: 'Score', tit: 'El número del Competitivo, de 0 a 100', s: (f) => f.sc || 0, v: (f) => (f.sc ? coma(f.sc) : NADA) },
  pts: { t: 'Puntos', tc: 'Pts', tit: 'Cada evento suma según el puesto y cuánta gente jugó', s: (f) => f.pts || 0, v: (f) => num(f.pts) },
  // 📈 la tendencia: se ordena por lo que sumó esta semana (la última barra)
  ten: { t: 'Esta semana', tc: 'Sem.', tit: 'Lo que sumó esta semana; las barritas, cada semana de la temporada',
    s: (f) => (((SEM && SEM.g[f.k]) || []).slice(-1)[0] || 0), v: (f, x) => <Tendencia g={x.sem && x.sem.g[f.k]} lunes={x.sem && x.sem.lunes} /> },
  ev: { t: 'Eventos', tc: 'Ev', tit: 'Eventos jugados en la temporada', s: (f) => f.ev || 0, v: (f) => f.ev || 0 },
  wr: { t: 'Win%', tit: 'Duelos ganados sobre duelos jugados', s: (f) => (f.wr ? pct(f.wr) : ''), v: (f) => (f.wr ? Math.round(pct(f.wr)) + '%' : NADA) },
  racha: { t: 'Racha', tit: 'La que lleva ahora / la más larga de la temporada',
    s: (f) => { const r = f.rch || [0, 0]; return r[0] * 1000 + r[1]; },
    v: (f) => { const r = f.rch || [0, 0]; return r[1] ? <span className={'rk-rch' + (r[0] ? ' viva' : '')}>{r[0]}<span>/{r[1]}</span></span> : NADA; } },
  ract: { t: 'Ahora', tit: 'Eventos seguidos que lleva ahora', s: (f) => (f.rch || [0])[0],
    v: (f) => { const r = (f.rch || [0])[0]; return r ? <span className="rk-rch viva">{r}</span> : 0; } },
  rmax: { t: 'La más larga', tc: 'Máx.', tit: 'La racha más larga de la temporada', s: (f) => (f.rch || [0, 0])[1], v: (f) => (f.rch || [0, 0])[1] },
  ult: { t: 'Último evento', tit: 'Cómo le fue la última vez que jugó, y cuándo', s: (f) => (f.ult || [])[0] || '',
    v: (f) => { const u = f.ult || []; return u[0] ? <span className="rk-ult"><b>{resultado(u[1], true)}</b><small>{fechaCorta(u[0])}</small></span> : NADA; } },
  caz: { t: 'Cazó', tit: 'Most Wanted: a cuántos cazó', s: (f) => f.caz || 0, v: (f, x) => (x.mw ? f.caz || 0 : NADA) },
  czd: { t: 'Cazado', tit: 'Most Wanted: cuántas veces lo cazaron', s: (f) => f.czd || 0, v: (f, x) => (x.mw ? f.czd || 0 : NADA) },
  sob: { t: 'Sobrevivió', tit: 'Most Wanted: cuántas veces sobrevivió', s: (f) => f.sob || 0, v: (f, x) => (x.mw ? f.sob || 0 : NADA) },
  mis: { t: 'Misiones', tit: 'Lo sumado con las misiones de la semana en la temporada', s: (f) => f.mis || 0, v: (f) => (f.mis ? num(f.mis) : NADA) },
  // ✍️ el Writing Challenge de FFA (Dlx, 14/10/2026: «cuenta para la Liga»): lo sumado por sus fechas, `bot/writing.py`
  wch: { t: 'Writing', tit: 'Lo sumado en el Writing Challenge de FFA en la temporada', s: (f) => f.wch || 0, v: (f) => (f.wch ? num(f.wch) : NADA) },
  mwp: { t: 'Cobró', tit: 'Puntos cobrados en Most Wanted', s: (f) => f.pts || 0, v: (f) => (f.pts ? num(f.pts) : NADA) },
  mwc: { t: 'Cazó', tit: 'A cuántos buscados cazó', s: (f) => f.caz || 0, v: (f) => f.caz || NADA },
  mwz: { t: 'Cazado', tit: 'Cuántas veces lo cazaron', s: (f) => f.czd || 0, v: (f) => f.czd || NADA },
  mws: { t: 'Sobrevivió', tc: 'Sobr.', tit: 'Cuántas veces sobrevivió siendo buscado', s: (f) => f.sob || 0, v: (f) => f.sob || NADA },
  g: { t: 'Ganados', tc: 'Gan.', s: (f) => f.g || 0, v: (f) => f.g || 0 },
  t: { t: 'Jugados', tc: 'Jug.', s: (f) => f.t || 0, v: (f) => f.t || 0 },
  wrd: { t: '%', tit: 'Ganados sobre jugados', s: (f) => (f.t ? f.g / f.t : 0), v: (f) => (f.t ? Math.round((100 * f.g) / f.t) + '%' : NADA) },
  oro: { t: '1.º', tit: 'Primeros puestos', s: (f) => f.oro || 0, v: (f) => f.oro || PUNTO },
  seg: { t: '2.º', tit: 'Segundos puestos', s: (f) => f.seg || 0, v: (f) => f.seg || PUNTO },
  ter: { t: '3.º', tit: 'Terceros puestos', s: (f) => f.ter || 0, v: (f) => f.ter || PUNTO },
  sem: { t: 'Semis', tit: 'Semifinales jugadas', s: (f) => f.sem || 0, v: (f) => f.sem || PUNTO },
  pais: { t: 'País', cls: 'c-n', txt: 1, s: (f) => norm(nombrePais(f.cc)), v: (f, x) => <Pais x={x} f={f} /> },
  np: { t: 'Raperos', tc: 'Rap.', s: (f) => f.n || 0, v: (f) => f.n || 0 },
  prom: { t: 'Por rapero', tit: 'Puntos por cada rapero de ese país', s: (f) => (f.n ? f.pts / f.n : 0), v: (f) => (f.n ? num(Math.round(f.pts / f.n)) : NADA) },
  crew: { t: 'Crew', cls: 'c-n', txt: 1, s: (f) => norm(limpio(f.crew)), v: (f, x) => <Crew x={x} f={f} /> },
  nc: { t: 'Raperos', tc: 'Rap.', s: (f) => f.n || 0, v: (f) => f.n || 0 },
  // 🏆 el tier de la crew (19/10/2026, bot/crews_tiers.py): se ordena de Leyenda a Bronce
  tier: { t: 'Tier', s: (f) => f.tier || 0, v: (f, x) => <TierChip n={f.tier || 0} T={x.liga.d.crews_tiers} chico /> },
  mejor: { t: 'Su mejor', tit: 'El mejor de la crew en la temporada', txt: 1, cls: 'c-izq', s: (f) => norm(limpio(f.mejor)),
    v: (f, x) => { const t = f.mejor ? x.liga.fila(f.mejor) : null; return t ? <a className="rk-lnk" href={'#/r/' + encodeURIComponent(t.k)}>{limpio(f.mejor)}</a> : limpio(f.mejor || ''); } },
};

// 🔑 CADA RANKING DICE SUS FILAS, SU ORDEN Y SUS COLUMNAS (el `SUBS` de app.js). `movil` son las que entran en un
// celular; `valor` es con qué se mide la distancia al de arriba en «tu lugar»; `dato`, lo que dice el podio debajo de
// la carta (lo que la carta NO dice: Dlx, 01/10/2026, «la tarjeta ya tiene esa info»)
// 📈 LOS ASCENSOS: un servidor por vez (sus chips), con la tabla del perfil de su liga (`Ascenso`, ligas.jsx). Las tablas
// viajan en el detalle de las ligas (`/api/ligas`), que se pide al abrir esta vista; el lobby sólo dice cuáles hay
function Ascensos({ liga }) {
  const mapa = (liga.d.ligas && liga.d.ligas.asc) || {};
  const svs = Object.keys(mapa);
  const [sv, setSv] = useState(svs[0] || '');
  const det = useDetalle(liga.d.ligas ? liga.d.ligas.t : null);
  const elegido = mapa[sv] ? sv : svs[0];
  const dest = (mapa[elegido] || [])[1];
  const A = dest && det[dest] && det[dest].asc;
  const miK = (window.DC && window.DC.clave) || (liga.yo && liga.yo.k) || '';
  return (
    <div className="rk-asc">
      {svs.length > 1 ? (
        <div className="rk-chips" role="group" aria-label="El servidor">
          {svs.map((s) => (
            <button key={s} type="button" className={s === elegido ? 'on' : ''} aria-pressed={s === elegido} onClick={() => setSv(s)}>
              <img alt="" src={liga.logo(s)} />{siglaDe(s)} · {mapa[s][0]}
            </button>
          ))}
        </div>
      ) : null}
      {A ? (
        <>
          <h3 className="rk-asc-t">Ascenso a la {A.n}</h3>
          <Ascenso A={A} h={{ miK }} />
          <p className="rk-asc-l"><a className="te-link" href={'#/ligas/' + encodeURIComponent(dest)}>Ver la {A.n} →</a></p>
        </>
      ) : <div className="cargando">Cargando…</div>}
    </div>
  );
}

const SUBS = {
  temporada: {
    et: 'Temporada', filas: (L) => L.d.tabla || [], orden: 'pos',
    // 🔑 LAS COLUMNAS DEL RANKING OFICIAL (Dlx, 25/09/2026: racha, último evento, cazó, cazado, sobrevivió y misiones)
    cols: ['pos', 'n', 'ovr', 'rg', 'pts', 'ten', 'ev', 'racha', 'ult', 'caz', 'czd', 'sob', 'mis', 'wch'], movil: ['pos', 'n', 'ovr', 'pts'],
    baj: <>El orden sale del <b>OVR</b>, el mismo número que lleva la carta de Temporada. Las flechas, cuántos puestos subió o bajó cada uno desde el lunes. <b>Esta semana</b>: lo que sumó desde el lunes, y en barritas cada semana de la temporada.</>,
    // ⚠️ SIN `dato`: los puntos ya están en la carta (Dlx, 02/10/2026: «quitar eso de puntos porque la tarjeta ya
    // lo dice»). El escalón lleva sólo el número
    valor: [(f) => f.ovr || 0, 'OVR'], podio: 'temporada', final: 16,
  },
  competitivo: {
    et: 'Competitivo', filas: (L) => (L.d.tabla || []).filter((f) => f.rg), orden: 'sc',
    cols: ['i', 'n', 'rg', 'sc', 'ev', 'wr'], movil: ['i', 'n', 'rg', 'sc'],
    baj: <>Ordenado por <b>Score</b>, que mide la calidad y no la cantidad. De ahí sale el rango, el mismo en todas las cartas.</>,
    // sin `dato` tampoco: la carta Competitiva tiene el Score en grande
    valor: [(f) => f.sc || 0, 'de Score', 1], podio: 'competitivo', final: 16,
    vacio: (L) => {
      const pide = req(L, 'competitivo') || 10;
      const c = (L.d.tabla || []).slice().sort((a, b) => (b.ev || 0) - (a.ev || 0))[0];
      return <>El Competitivo pide participar en <b>{pide} eventos</b> de cualquier servidor asociado a la Liga Global, en la temporada, y todavía no llegó nadie.{c ? <> El más cerca: <b>{limpio(c.n)}</b>, con {c.ev}.</> : null}</>;
    },
  },
  duelos: {
    et: 'Duelos', filas: (L) => L.d.duelos || [], orden: 'g',
    cols: ['i', 'n', 'g', 't', 'wrd'], movil: ['i', 'n', 'g', 't', 'wrd'],
    // la regla es de Dlx (21/09, reconfirmada el 24/09): los triples no cuentan
    baj: <>Las batallas <b>uno contra uno</b> de las llaves: los triples y las de equipos no cuentan. Se ordena por <b>ganados</b>, porque un 1 de 1 da 100&nbsp;% y no dice nada.</>,
    valor: [(f) => f.g || 0, ['duelo', 'duelos']], dato: (f) => f.g + ' DE ' + f.t,
  },
  podios: {
    et: 'Podios', filas: (L) => (L.d.tabla || []).filter((f) => (f.oro || 0) + (f.seg || 0) + (f.ter || 0) > 0), orden: medallero,
    cols: ['i', 'n', 'oro', 'seg', 'ter', 'sem', 'pts'], movil: ['i', 'n', 'oro', 'seg', 'ter'],
    baj: <>Como un medallero: primero los oros, después las platas y después los bronces. Quien no subió al podio no aparece.</>,
    dato: (f) => (f.oro || 0) + ' · ' + (f.seg || 0) + ' · ' + (f.ter || 0),
  },
  rachas: {
    et: 'Rachas', filas: (L) => (L.d.tabla || []).filter((f) => ((f.rch || [])[1] || 0) > 0), orden: 'racha',
    cols: ['i', 'n', 'ract', 'rmax', 'ult', 'ev'], movil: ['i', 'n', 'ract', 'rmax'],
    baj: <>Eventos seguidos llegando arriba de la llave: la <b>final</b> si es de menos de 16, la <b>semifinal</b> de 16 a 31 y <b>cuartos</b> de 32 a 63.</>,
    valor: [(f) => (f.rch || [0])[0], 'de racha'], dato: (f) => (f.rch || [0])[0] + ' SEGUIDOS',
  },
  // 🎤 QUIÉN PARTICIPÓ MÁS (Dlx, 07/10/2026: «en Ranking agrega la sección de eventos… las personas que participaron
  // más»). Los eventos jugados en la temporada, en todos los servidores; a igual cantidad, el de más puntos
  eventos: {
    et: 'Eventos', filas: (L) => (L.d.tabla || []).filter((f) => (f.ev || 0) > 0),
    orden: (a, b) => ((b.ev || 0) - (a.ev || 0)) || ((b.pts || 0) - (a.pts || 0)),
    cols: ['i', 'n', 'ev', 'ult', 'pts'], movil: ['i', 'n', 'ev', 'ult'],
    baj: <>Quién <b>participó más</b>: los eventos jugados en la temporada, en todos los servidores. A igual cantidad, el que tiene más puntos.</>,
    valor: [(f) => f.ev || 0, ['evento', 'eventos']], dato: (f) => f.ev + (f.ev === 1 ? ' EVENTO' : ' EVENTOS'),
  },
  paises: {
    et: 'Países', grupo: 'pais', filas: (L) => L.d.paises || [], sinChips: 1, nombre: (f) => nombrePais(f.cc), orden: 'pts',
    cols: ['i', 'pais', 'np', 'pts', 'prom'], movil: ['i', 'pais', 'np', 'pts'], que: ['país', 'países'],
    baj: <>Por los puntos que hizo su gente en la temporada.</>,
    valor: [(f) => f.pts || 0, 'pts'], dato: (f) => num(f.pts) + ' PTS',
  },
  crews: {
    et: 'Crews', grupo: 'crew', filas: (L) => L.d.crews || [], sinChips: 1, nombre: (f) => limpio(f.crew),
    orden: (a, b) => ((b.rk !== 0) - (a.rk !== 0)) || (b.pts - a.pts) || (b.n - a.n), sinPuesto: (f) => f.rk === 0,
    cols: ['i', 'crew', 'tier', 'nc', 'pts', 'mejor'], movil: ['i', 'crew', 'tier', 'pts'], que: ['crew', 'crews'],
    baj: <>Por los puntos que suman. Para tener puesto una crew necesita <b>tres raperos</b> en la temporada: las que no llegan se ven, sin número. Y cada lunes, como en el fútbol, cada crew <b>sube, baja o se mantiene de tier</b> según lo que sumó en la semana. Para armar una o sumarte, <a className="te-link" href="#/crews">la página de crews</a>.</>,
    valor: [(f) => f.pts || 0, 'pts'], dato: (f) => num(f.pts) + ' PTS',
  },
  mw: {
    et: 'Most Wanted', filas: (L) => (L.d.mw && L.d.mw.caz) || [], orden: 'mwp',
    hay: (L) => !!(L.d.mw && (L.d.mw.b || []).length),
    siNo: <><b>Most Wanted</b>: quién cazó, quién fue cazado y quién sobrevivió. Suma a tu Temporada y arranca pronto.</>,
    cols: ['i', 'n', 'mwp', 'mwc', 'mwz', 'mws'], movil: ['i', 'n', 'mwp', 'mwc'],
    baj: <>Los <b>cazadores</b>: lo que cobraron cazando buscados y sobreviviendo. Suma a los <b>Puntos</b> de la Temporada; al Competitivo, nunca.</>,
    valor: [(f) => f.pts || 0, 'pts'], dato: (f) => num(f.pts) + ' PTS',
    vacio: () => <>Todavía nadie cazó a un buscado. Los de esta semana están en el <a className="te-link" href="#/">Inicio</a>.</>,
  },
  // lo que todavía no existe: arriba una línea (`corto`) y abajo qué va a ser, sin repetirlo
  // 🎯 las misiones de la semana (05/10/2026): su propia vista (`Misiones`), como las divisiones
  misiones: {
    et: 'Misiones', propia: Misiones, filas: () => [], orden: () => 0, hay: (L) => !!L.d.mis,
    siNo: <><b>Misiones</b>: tres por semana, las mismas para todos, que se cumplen jugando y suman a tu Temporada. Las primeras arrancan el lunes a las 11 AM.</>,
    baj: <>Tres por semana, las mismas para todos: se cumplen <b>jugando</b> y cada una suma a tu <b>Temporada</b>. Las tres juntas dan un bono.</>,
  },
  // 📈 LOS ASCENSOS (Dlx, 17/10/2026: «quizás crear uno que diga RANKING ASCENSOS en la página de rankings»): el
  // ranking de ascenso de cada servidor, al día (`bot/ascenso.py`). Su propia vista (`Ascensos`): un servidor por vez
  ascensos: {
    et: 'Ascensos', propia: Ascensos, filas: () => [], orden: () => 0,
    hay: (L) => !!(L.d.ligas && L.d.ligas.asc && Object.keys(L.d.ligas.asc).length),
    siNo: <><b>Ascensos</b>: el ranking de ascenso de cada servidor que tiene ligas, al día.</>,
    baj: <>El ranking de <b>ascenso</b> de cada servidor, al día: su tabla oficial más lo que se jugó después, con <b>sus</b> reglas. Lo oficial lo decide su staff.</>,
  },
  // 🏟️ las divisiones de la semana (04/10/2026): su propia vista (`Divisiones`), no la tabla de los demás
  divisiones: {
    // ⚠️ `orden` tiene que estar aunque no haya tabla: `armar()` busca su columna en `COL` y sin él revienta
    et: 'Divisiones', propia: Divisiones, filas: () => [], orden: () => 0, hay: (L) => !!L.d.div,
    siNo: <><b>Divisiones</b>: una tabla por semana, de a 30. Juegas un evento y entras en Sexta; los cinco primeros de cada grupo suben y ganan Puntos de Tienda, y los cinco últimos bajan.</>,
    baj: <>Una tabla por semana, de a 30: juegas un evento y entras. Los <b>primeros</b> de cada grupo suben de división y ganan <b>Puntos de Tienda</b>; los últimos bajan.</>,
  },
};
// 📈 DESDE EL 02/11/2026 LAS DIVISIONES SON EL RANKING ELO (Dlx, 26/10/2026: «divisiones ahora serían Ranking ELO»): el
// ciclo lo avisa con `div.m === 'elo'` y acá cambian el nombre y la explicación. La ruta sigue siendo
// `#/ranking/divisiones` —es la que circula— y `#/ranking/elo` lleva ahí
const DIV_ELO = {
  et: 'Ranking ELO',
  baj: <>Como el Ranked de Brawl Stars: tu rango sale de tu <b>ELO</b>, de Hierro a Mítico, y subes o bajas con cada batalla 1v1. Se mira cada lunes; llegar por primera vez a cada rango paga <b>Puntos de Tienda</b>.</>,
};
export const subDe = (liga, id) => (id === 'divisiones' && liga && liga.d.div && liga.d.div.m === 'elo' ? { ...SUBS.divisiones, ...DIV_ELO } : SUBS[id]);
export const RANKINGS = ['temporada', 'divisiones', 'competitivo', 'duelos', 'podios', 'rachas', 'eventos', 'paises', 'crews', 'ascensos', 'mw', 'misiones'];

function req(L, id) {
  const q = (L.d.requisitos || []).find((x) => x.id === id);
  const m = q && /(\d+)/.exec((q.pide || [])[0] || '');
  return m ? Number(m[1]) : 0;
}

// ⚠️ LO VACÍO VA AL FINAL, ordene como ordene; y a igual valor manda el orden de este ranking, no el azar del `sort`
function ordenadas(fs, id, desc) {
  const c = COL[id];
  if (!c) return fs;
  const d = desc ? -1 : 1;
  return fs.map((f, i) => [f, i]).sort((A, B) => {
    let x = c.s(A[0]);
    let y = c.s(B[0]);
    x = x == null ? '' : x; y = y == null ? '' : y;
    if ((x === '') !== (y === '')) return x === '' ? 1 : -1;
    const r = (typeof x === 'string' || typeof y === 'string') ? String(x).localeCompare(String(y), 'es') : x - y;
    return r * d || A[1] - B[1];
  }).map((P) => P[0]);
}

// las filas en el orden de este ranking, con su lugar: `_o` contando a todos, `_i` el número (salta a quien está
// fuera de concurso). ⚠️ COPIAS: las filas son las de `window.D`, y app.js les escribe sus propios `_o` e `_i`
function armar(liga, cfg) {
  let base = cfg.filas(liga).map((f) => Object.assign({}, f));
  if (typeof cfg.orden === 'function') base.sort(cfg.orden);
  else base = ordenadas(base, cfg.orden, !COL[cfg.orden].txt && cfg.orden !== 'pos');
  let nro = 0;
  base.forEach((f, i) => {
    f._o = i + 1;
    f._i = (cfg.sinPuesto && cfg.sinPuesto(f)) || f.fc ? 0 : ++nro;
  });
  return base;
}
// el número que se muestra: la Temporada, el oficial; los demás, el de este ranking
const numero = (cfg, f) => (cfg.orden === 'pos' ? (f.fc ? 0 : f.pos) : f._i);
const clave = (f) => f.k || f.cc || f.crew || f.n;

// ── el podio: las cartas de verdad paradas en su escalón, el 1 en el medio ─────────────────────────────────────────
function Podio({ liga, cfg, top, sem }) {
  return (
    <ol className={'rk-podio' + (cfg.grupo ? ' grupos' : '')} aria-label={'Podio de ' + cfg.et}>
      {top.map((f, i) => {
        let vis;
        let nombre = null;
        let nota = null;
        if (cfg.grupo === 'pais') {
          vis = <a className="rk-pvis" href={'#/pais/' + f.cc}><Bandera cc={f.cc} cls="rk-pflag" /></a>;
          nombre = nombrePais(f.cc);
        } else if (cfg.grupo === 'crew') {
          vis = <a className="rk-pvis" href={'#/crew/' + encodeURIComponent(f.clave || f.crew)}><LogoCrew c={f} cls="rk-plogo" /></a>;
          nombre = limpio(f.crew);
        } else {
          const t = liga.T[f.k];
          const cual = cfg.podio === 'competitivo' && t && (t.c || []).includes('competitivo') ? 'competitivo' : 'temporada';
          vis = <Carta liga={liga} k={f.k} cual={cual} cls="rk-ci" />;
          // ⏳ mientras la carta se redibuja, su número puede no coincidir con este orden: se dice
          if (liga.cartaVieja(f.k, cual)) nota = <small className="rk-pnota">SE ESTÁ REDIBUJANDO</small>;
        }
        return (
          <li key={clave(f)} className={'rk-p p' + (i + 1)}>
            <div className="rk-pv">{vis}{nota}</div>
            <div className="rk-ped">
              <span className="rk-ped-n">{numero(cfg, f) || i + 1}</span>
              {nombre ? <b>{nombre}</b> : null}
              {cfg.dato ? <small>{cfg.dato(f)}</small> : null}
              {/* 📈 lo que sumó esta semana: lo único que la tarjeta no dice (Dlx, 20/10/2026: «no pongas información que
                  la tarjeta ya tiene»; el nombre y el OVR están en la tarjeta) */}
              {sem && sem.g && sem.g[f.k] ? (() => { const v = sem.g[f.k][sem.g[f.k].length - 1] || 0; return <small className={'rk-psem' + (v ? '' : ' q')}>{v ? '+' + num(v) : '0'} esta semana</small>; })() : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ¿la pantalla es de celular? (el mismo corte de 900 px que el resto de la página)
function useMovil() {
  const q = '(max-width: 899px)';
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q).matches : false);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(q);
    const f = () => setM(mq.matches);
    if (mq.addEventListener) mq.addEventListener('change', f); else mq.addListener(f);
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', f); else mq.removeListener(f); };
  }, []);
  return m;
}

// ── 2 · LOS QUE TENÉS CERCA: el de arriba, vos y el de abajo, con cuánto los separa. Dlx, 02/10/2026: «me gusta».
// Es lo que hace volver a mirar: a quién pasás si ganás el próximo ─────────────────────────────────────────────────
function distancia(cfg, a, b) {
  if (!cfg.valor) return null;
  const [val, u, dec] = cfg.valor;
  const d = val(a) - val(b);
  if (d <= 0) return null;
  return (dec ? coma(d, dec) : num(d)) + ' ' + (Array.isArray(u) ? u[d === 1 ? 0 : 1] : u);
}
// ── 🪪 LA TIRA «TÚ», ADENTRO DEL ESCENARIO (la maqueta C v5 del Ranking, Dlx, 20/10/2026: «algo corto de vos…
// el Verme en la lista podría estar mucho mejor… un botón mejorado ahí mismo»): tu foto, tu puesto, a cuánto estás del
// de arriba, quién tienes arriba y abajo en chips, y el botón «Ver mi fila». Reemplaza a «Los que tenés cerca» (que
// vivía debajo de los filtros) y a la invitación a entrar con Discord. En tú, no en vos (Dlx: «nada argentino») ──────
function TuTira({ x, cfg, base, iYo, lugar, yo, dc, encontrarme, tira }) {
  const { liga } = x;
  if (!yo && !dc) {
    return (
      <div className="rk-tu invita" ref={tira}>
        <span className="rk-tu-l"><Ico n="yo" t={22} /><b>Entra con Discord y te marcamos en cada ranking.</b></span>
        <button type="button" className="btn verde chico rk-tu-btn" onClick={accion.cuenta}>Entrar</button>
      </div>
    );
  }
  if (!lugar) {
    return (
      <div className="rk-tu invita" ref={tira}>
        <span className="rk-tu-l"><Ico n="yo" t={22} /><b>Todavía no estás en este ranking: juega un evento y apareces.</b></span>
      </div>
    );
  }
  const f = iYo >= 0 ? base[iYo] : null;
  const n = f ? numero(cfg, f) : 0;
  const nombreDe = (g) => (cfg.grupo === 'pais' ? nombrePais(g.cc) : cfg.grupo === 'crew' ? limpio(g.crew) : limpio(g.n));
  const arriba = f && n ? base.slice(0, iYo).reverse().find((g) => numero(cfg, g)) : null;
  const abajo = f && n ? base.slice(iYo + 1).find((g) => numero(cfg, g)) : null;
  const dA = arriba ? distancia(cfg, arriba, f) : null;
  const dB = abajo ? distancia(cfg, f, abajo) : null;
  // la frase: a cuánto estás del de arriba (y si está a un evento, que se note)
  let frase = lugar.txt;
  if (n && arriba && dA) {
    const [val] = cfg.valor;
    const d = val(arriba) - val(f);
    frase = 'A ' + dA + ' de ' + nombreDe(arriba) + ', el #' + numero(cfg, arriba) + (d <= 2 && !cfg.grupo ? ': si ganas el próximo, lo pasas.' : '.');
  } else if (n && !arriba) frase = 'Eres el #1' + (abajo && dB ? ': le sacas ' + dB + ' a ' + nombreDe(abajo) + '.' : '.');
  const chip = (g, d, cls, txt) => (
    <span className={'rk-tu-chip ' + cls}><i aria-hidden="true" />
      {cfg.grupo === 'pais' ? <Bandera cc={g.cc} cls="rk-tu-flag" /> : cfg.grupo === 'crew' ? <LogoCrew c={g} cls="rk-tu-logo" /> : <Cara liga={liga} k={g.k} nombre={g.n} cls="cara rk-tu-cara" />}
      <b>{nombreDe(g)}</b>{txt ? <em>{txt}</em> : null}</span>
  );
  return (
    <div className="rk-tu" ref={tira}>
      <div className="rk-tu-l">
        {lugar.cara}
        <span className="rk-tu-n"><Num n={n} fc={f && f.fc} /></span>
        <span className="rk-tu-t"><small>{lugar.quien}{lugar.mov ? <> · <Mov mv={lugar.mov} largo /></> : n ? ' · igual que el lunes' : ''}</small><b>{frase}</b></span>
      </div>
      {arriba || abajo ? (
        <div className="rk-tu-chips">
          {arriba ? chip(arriba, dA, 'up', dA ? 'a ' + dA : null) : null}
          {abajo ? chip(abajo, dB, 'dn', dB ? 'le sacas ' + dB : null) : null}
        </div>
      ) : null}
      {lugar.verificar ? <a className="btn verde chico rk-tu-btn" href="#/cuenta/verificar">Verificarme</a>
        : lugar.ir ? <button type="button" className="btn verde chico rk-tu-btn" onClick={encontrarme}>Ver mi fila ↓</button> : null}
    </div>
  );
}

// ── 📱 LA LISTA DEL CELULAR, EN FILAS DE DOS RENGLONES (Taste, app-screens §12: «tables become lists of two-line rows»;
// la maqueta C v5). Línea 1: puesto, foto, nombre, bandera y servidor; línea 2: lo que importa de este ranking; a la
// derecha, el número que ordena. Tocar la fila la abre, como en la tabla. «Todos los datos» vuelve a la tabla entera ──
function ListaCel({ x, cfg, vis, abierta, setAbierta, miFila, corteK, directoK, sinFiltro, perf, sub }) {
  const { liga } = x;
  const ids = (cfg.movil || cfg.cols).filter((id) => !['pos', 'i', 'n'].includes(id));
  const lead = ids[0];
  const resto = ids.slice(1);
  return (
    <ol className="rk-lista">
      {vis.map((f) => {
        const k = clave(f);
        const ab = abierta === k;
        const t = liga.T[f.k] || f;
        const mio = k === miFila;
        const sem = x.sem && x.sem.g && x.sem.g[f.k] ? x.sem.g[f.k][x.sem.g[f.k].length - 1] || 0 : null;
        const puede = cfg.grupo || f.k;
        const cl = ['rk-fila', mio ? 'yo' : '', f.fc ? 'fc' : '', cfg.sinPuesto && cfg.sinPuesto(f) ? 'chica' : '', ab ? 'abierta' : ''].filter(Boolean).join(' ');
        return (
          <Fragment key={k}>
            <li data-c={k} className={cl} aria-expanded={puede ? ab : undefined}
              onClick={puede ? (e) => { if (!e.target.closest('a, button')) setAbierta(ab ? null : k); } : undefined}>
              <span className="rk-fila-n">{COL[cfg.cols[0]].v(f, x)}</span>
              <span className="rk-fila-q">{COL.n.v(f, x)}
                <small className="rk-fila-2">
                  {sub === 'temporada'
                    ? <>{num(f.pts)} pts · <em className={sem ? 'sem' : 'q'}>{sem ? '+' + num(sem) : '0'}</em> esta semana</>
                    : resto.map((id) => <span key={id}>{COL[id].tc || COL[id].t} {COL[id].v(f, x)}</span>)}
                </small>
              </span>
              <span className="rk-fila-d">
                <b className="rk-fila-v">{lead ? COL[lead].v(f, x) : null}</b>
                {sub === 'temporada' ? <span className="rk-fila-r">{COL.rg.v(f, x)}</span> : null}
              </span>
            </li>
            {ab ? <li className="rk-fila-det"><Detalle x={x} cfg={cfg} f={f} perf={perf} /></li> : null}
            {directoK === k && sinFiltro ? <li className="rk-fila-corte directo"><a href="#/ligas/superliga"><Ico n="copa" t={14} /> Hasta acá clasifican directo a la Superliga</a></li> : null}
            {corteK === k && sinFiltro ? <li className="rk-fila-corte"><a href={'#/ligas/' + (sub === 'competitivo' ? 'superliga' : 'clausura')}><Ico n="copa" t={14} /> Hasta acá clasifican a la {sub === 'competitivo' ? 'Superliga' : 'Clausura'} de la {liga.temp}</a></li> : null}
          </Fragment>
        );
      })}
    </ol>
  );
}

// ── ⚔️ TÚ CONTRA ÉSE, POR CATEGORÍAS (a «Us vs Them» de 21st; la maqueta C): al abrir una fila, seis categorías con una
// barra por lado y quién gana cada una. Sólo con cuenta y sobre otra persona ─────────────────────────────────────────
function Versus({ x, a, b }) {
  const sem = (f) => (x.sem && x.sem.g && x.sem.g[f.k] ? x.sem.g[f.k][x.sem.g[f.k].length - 1] || 0 : 0);
  const wr = (f) => Math.round(pct(f.wr) || 0);
  const cats = [['OVR', a.ovr || 0, b.ovr || 0, (v) => String(v)], ['Puntos', a.pts || 0, b.pts || 0, num], ['Esta semana', sem(a), sem(b), (v) => (v ? '+' + num(v) : '0')],
    ['Eventos', a.ev || 0, b.ev || 0, String], ['Win%', wr(a), wr(b), (v) => v + '%'], ['Racha', (a.rch || [0])[0], (b.rch || [0])[0], String]];
  const gana = cats.filter(([, v1, v2]) => v1 > v2).length;
  const peor = cats.filter(([, v1, v2]) => v2 > v1).sort((p, q) => (q[2] - q[1]) / (q[2] || 1) - (p[2] - p[1]) / (p[2] || 1))[0];
  return (
    <div className="rk-vs">
      <div className="rk-vs-cab"><Cara liga={x.liga} k={a.k} nombre={a.n} cls="cara rk-vs-cara" /><b>TÚ CONTRA {limpio(b.n).toUpperCase()}</b><Cara liga={x.liga} k={b.k} nombre={b.n} cls="cara rk-vs-cara" /></div>
      {cats.map(([t, v1, v2, fmt]) => {
        const m = Math.max(v1, v2, 1);
        return (
          <div className="rk-vs-f" key={t}>
            <b className={'rk-vs-n' + (v1 > v2 ? ' g' : '')}>{fmt(v1)}</b>
            <i className={'rk-vs-b l' + (v1 > v2 ? ' g' : '')} style={{ '--w': Math.round(100 * v1 / m) + '%' }} />
            <span className="rk-vs-t">{t}</span>
            <i className={'rk-vs-b r' + (v2 > v1 ? ' g' : '')} style={{ '--w': Math.round(100 * v2 / m) + '%' }} />
            <b className={'rk-vs-n' + (v2 > v1 ? ' g' : '')}>{fmt(v2)}</b>
          </div>
        );
      })}
      <p className="rk-det-c">Ganas {gana} de {cats.length} categorías.{peor ? ' Lo que más te separa: ' + peor[0].toLowerCase() + '.' : ''}</p>
    </div>
  );
}

// 🏆 LA GRAN FINAL DE LA T1 (Dlx, 12/10/2026): clasifican los 16 primeros CON NÚMERO de Temporada y de Competitivo,
// dos torneos, y quien está en los dos juega los dos. Desde el 16/10/2026 tienen nombre: la del Competitivo es la
// SUPERLIGA y la de la Temporada la CLAUSURA, cada una con su página en Ligas (ligas.jsx, `topCierre()` los cuenta igual). Fecha y nombre los anuncia Dlx: hasta entonces, sólo con la
// vista previa `?prev=fin` (`lg:prev-fin`).
// ✅ PARA TODOS DESDE EL 13/10/2026 (Dlx, a «¿la muestro a todos?»: «mostrarla ya a todos»)
function verFinal() {
  return true;
}
function clasificados(cfg, base) {
  if (!cfg.final || !verFinal()) return null;
  const out = [];
  for (const f of base) {
    if (out.length >= cfg.final) break;
    if (numero(cfg, f)) out.push(f);
  }
  return out;
}

// ── 4 · LA FILA QUE SE ABRE AHÍ MISMO: sus números, sus últimos eventos y de dónde salen sus puntos, sin salir del
// ranking (Dlx, 02/10/2026: «me gusta»). El historial es el de `/api/perfiles`, el mismo que usa su perfil: se pide
// una vez, con `perfiles()` de app.js, la primera vez que se abre una fila ──────────────────────────────────────────
function Detalle({ x, cfg, f, perf }) {
  const { liga } = x;
  const pub = usePases();
  if (cfg.grupo) {
    const gente = cfg.grupo === 'pais' ? ((liga.paisDe(f.cc) || {}).gente || [])
      : (f.gente || []).map((n) => liga.fila(n)).filter(Boolean).sort((a, b) => (a.o || 999) - (b.o || 999));
    const href = cfg.grupo === 'pais' ? '#/pais/' + f.cc : '#/crew/' + encodeURIComponent(f.clave || f.crew);
    return (
      <div className="rk-det-in">
        <div className="rk-det-l">
          <span className="rk-det-t">SU GENTE{gente.length ? ' · ' + gente.length : ''}</span>
          {gente.length ? (
            <ol className="rk-det-g">
              {gente.slice(0, 6).map((g) => (
                <li key={g.k}><a href={'#/r/' + encodeURIComponent(g.k)}><Num n={g.fc ? 0 : g.pos} fc={g.fc} />
                  <Cara liga={liga} k={g.k} nombre={g.n} cls="cara rk-det-cara" /><b>{limpio(g.n)}</b><small>{num(g.pts)} pts</small></a></li>
              ))}
            </ol>
          ) : <p className="rk-det-c">Nadie con puesto todavía.</p>}
          <div className="rk-det-acc"><a className="btn negro chico" href={href}>Ver {cfg.grupo === 'pais' ? nombrePais(f.cc) : limpio(f.crew)}</a></div>
        </div>
      </div>
    );
  }
  const t = liga.T[f.k] || f;
  const P = perf && perf.p ? perf.p[f.k] : null;
  const E = (perf && perf.e) || {};
  const evs = perf ? ((P && P.ev) || []).map(([n, puesto, pts]) => ({ n, puesto, pts, e: E[n] || E[String(n)] || [] }))
    .sort((a, b) => String(b.e[2] || '').localeCompare(String(a.e[2] || ''))) : null;
  // 🃏 LA CARTA DE ESTE RANKING (26/10/2026: «cada página con su carta»): el Competitivo y los Duelos abren la Competitiva,
  // la Temporada la de Temporada; en los demás, la carta principal que eligió, y si no eligió, la Temporada
  const tiene = (c) => (t.c || []).includes(c);
  const deAca = cfg.podio || (cfg.et === 'Duelos' ? 'competitivo' : '');
  const cp = pub && pub.cp ? pub.cp[f.k] : '';
  const cual = deAca && tiene(deAca) ? deAca : cp && tiene(cp) ? cp : tiene('temporada') ? 'temporada' : (t.c || [])[0];
  return (
    <div className="rk-det-in">
      {cual ? <div className="rk-det-carta"><Carta liga={liga} k={f.k} cual={cual} cls="rk-det-ci" /></div> : null}
      <div className="rk-det-l">
        <dl className="rk-det-n">
          <div><dt>OVR</dt><dd>{t.ovr || '—'}</dd></div>
          <div><dt>Puntos</dt><dd>{num(t.pts)}</dd></div>
          <div><dt>Eventos</dt><dd>{t.ev || 0}</dd></div>
          <div><dt>Podios</dt><dd>{t.pod || 0}</dd></div>
          {t.wr ? <div><dt>Win%</dt><dd>{Math.round(pct(t.wr))}%</dd></div> : null}
        </dl>
        {x.yoK && x.yoK !== f.k && liga.T[x.yoK] && !cfg.grupo ? <Versus x={x} a={liga.T[x.yoK]} b={t} /> : null}
        {x.sem && x.sem.g[f.k] ? <Semanas g={x.sem.g[f.k]} lunes={x.sem.lunes} /> : null}
        <span className="rk-det-t">SUS EVENTOS{evs && evs.length ? ' · ' + evs.length : ''}</span>
        {evs === null ? <p className="rk-det-c">Cargando…</p> : !evs.length ? <p className="rk-det-c">Todavía no jugó en la temporada.</p> : (
          <ol className="rk-det-e">
            {evs.slice(0, 5).map((ev) => (
              <li key={ev.n}>
                <button type="button" className="sin-boton" onClick={() => accion.llave(ev.n)}>
                  <span className="rk-det-ev"><b>{limpio(ev.e[0] || 'Evento ' + ev.n)}</b><small>{[ev.e[1] ? siglaDe(ev.e[1]) : '', ev.e[4]].filter(Boolean).join(' · ')}</small></span>
                  <span className={'rk-det-r' + (ev.puesto === 'Campeón' ? ' campeon' : '')}>{resultado(ev.puesto, true)}<small>+{num(ev.pts)} pts</small></span>
                </button>
              </li>
            ))}
          </ol>
        )}
        <div className="rk-det-acc">
          <a className="btn negro chico" href={'#/r/' + encodeURIComponent(f.k)}>Ver su perfil</a>
          {evs && evs.length > 5 ? <span className="rk-det-mas">y {evs.length - 5} eventos más en su perfil</span> : null}
        </div>
      </div>
    </div>
  );
}

// ── 5 · TU PUESTO COMO IMAGEN PARA HISTORIAS (Dlx, 02/10/2026: «listo»): 1080×1920, con tu carta de verdad parada en
// su escalón, y el menú de compartir del celular (Instagram, WhatsApp…) o, en la compu, el archivo. El marco, la carta
// y el compartir viven en historia.js, que también usa el campeón de Eventos ─────────────────────────────────────────
async function imagenPuesto(liga, cfg, f, n) {
  const { c, g, letra } = await lienzo();
  letra(700, 34, true); g.fillStyle = '#A5A5A0';
  g.fillText(('LIGA GLOBAL · ' + liga.temp + ' · RANKING').toUpperCase(), 72, 132);
  let px = 116;
  letra(900, px, false);
  while (px > 60 && g.measureText(cfg.et.toUpperCase()).width > W - 144) { px -= 6; letra(900, px, false); }
  g.fillStyle = '#F6F6F6'; g.fillText(cfg.et.toUpperCase(), 72, 132 + 24 + px * 0.9);
  // la carta: la de esta categoría si la tiene (la Competitiva en el Competitivo), si no la de Temporada
  const t = liga.T[f.k] || {};
  const cual = cfg.podio === 'competitivo' && (t.c || []).includes('competitivo') ? 'competitivo' : 'temporada';
  const y0 = 330;
  const ch = await carta(g, letra, liga, f.k, f.n, cual, W / 2, y0, 600, 900);
  // el escalón con el puesto: el 1 en verde agua, el 2 en magenta, el resto en blanco
  const ye = y0 + ch + 28;
  const col = n === 1 ? ['#29B298', '#030304'] : n === 2 ? ['#E41373', '#FFFFFF'] : ['#F6F6F6', '#030304'];
  g.fillStyle = col[0]; g.fillRect((W - 600) / 2, ye, 600, 250);
  letra(900, n > 99 ? 150 : 190, false); g.fillStyle = col[1]; g.textAlign = 'center';
  g.fillText('#' + n, W / 2, ye + 195);
  // cuánto subió esta semana (sólo la Temporada lo sabe)
  if (cfg.podio === 'temporada' && t.mv) {
    const sube = t.mv > 0;
    const txt = (sube ? 'SUBIÓ ' : 'BAJÓ ') + Math.abs(t.mv) + (Math.abs(t.mv) === 1 ? ' PUESTO' : ' PUESTOS') + ' ESTA SEMANA';
    letra(700, 36, true); g.textAlign = 'left';
    const w = g.measureText(txt).width + 44;
    const xm = (W - w) / 2;
    const ym = ye + 250 + 78;
    g.fillStyle = sube ? '#29B298' : '#E41373';
    g.beginPath();
    if (sube) { g.moveTo(xm, ym - 4); g.lineTo(xm + 28, ym - 4); g.lineTo(xm + 14, ym - 28); } else { g.moveTo(xm, ym - 28); g.lineTo(xm + 28, ym - 28); g.lineTo(xm + 14, ym - 4); }
    g.closePath(); g.fill();
    g.fillStyle = '#F6F6F6'; g.fillText(txt, xm + 44, ym);
  }
  await pie(g, letra);
  return aPng(c);
}
function BotonHistoria({ liga, cfg, f, n }) {
  const [est, setEst] = useState('');
  const hacer = () => {
    if (est === 'armando') return;
    armarYCompartir(() => imagenPuesto(liga, cfg, f, n), 'mi-puesto-' + (f.k || 'liga') + '.png',
      'Estoy #' + n + ' en ' + cfg.et + ' de la Liga Global. ' + enlace('#/ranking'), setEst, 'ranking');
  };
  const txt = est === 'armando' ? 'Armando la imagen…' : est === 'bajada' ? 'Imagen guardada' : est === 'error' ? 'No pude armarla' : 'Mi puesto para historias';
  return (
    <button type="button" className="btn verde chico rk-hist" onClick={hacer} aria-busy={est === 'armando'} aria-live="polite">
      <Ico n="compartir" t={18} /><span>{txt}</span>
    </button>
  );
}

const VER = 50;

// `ver`: lo que va después del ranking en la dirección: qué abre su vista propia (lo usaban las Ligas, que desde el
// 16/10/2026 son su propia sección: `#/ranking/ligas` lleva a `#/ligas`, en App.jsx)
export function Ranking({ liga, sub: subRuta, ver: abre = '', dc, raiz }) {
  const ruta = subRuta === 'elo' ? 'divisiones' : subRuta;
  const [sub, setSub] = useState(SUBS[ruta] ? ruta : 'temporada');
  const deslizaRk = useDesliza(sub, RANKINGS);
  useEffect(() => { setSub(SUBS[ruta] ? ruta : 'temporada'); }, [ruta]);
  const [orden, setOrden] = useState(null);
  const [q, setQ] = useState('');
  const [sv, setSv] = useState('');
  const [cc, setCc] = useState('');
  const [soloSigo, setSoloSigo] = useState(false);
  const [soloNuevos, setSoloNuevos] = useState(false);
  const [abierta, setAbierta] = useState(null);
  const [perf, setPerf] = useState(() => (typeof window !== 'undefined' && window.PERF) || null);
  const [ver, setVer] = useState(VER);
  const [todas, setTodas] = useState(false);
  const [irA, setIrA] = useState(null);
  const [yoVisible, setYoVisible] = useState(false);
  const [tiraVisible, setTiraVisible] = useState(false);
  const tira = useRef(null);
  const [tb, setTb] = useState(0);
  const movil = useMovil();
  const nav = useRef(null);
  const tabla = useRef(null);
  const tabs = useRef(null);

  // 🏠 de dónde es cada uno, sólo si lo eligió (Dlx, 12/10/2026). Ver elegidos.js
  const eleg = useElegidos();
  const cfg = subDe(liga, sub) || SUBS.temporada;
  const pronto = cfg.pronto || (cfg.hay && !cfg.hay(liga) ? cfg.siNo : null);
  const mwOn = !!((liga.d.mw && (liga.d.mw.b || []).length) || (liga.d.tabla || []).some((f) => f.caz || f.czd || f.sob));
  const yo = liga.yo;
  const miCrewF = yo ? liga.crewDe(yo) : null;
  const sem = useSemanas(sub === 'temporada');
  // 📊 la barra bajo cada nombre, sólo en la Temporada: sus puntos contra el que más sumó
  const maxPts = useMemo(() => (liga.d.tabla || []).reduce((m, f) => Math.max(m, f.pts || 0), 0), [liga]);
  const x = {
    liga, mw: mwOn, yoK: yo ? yo.k : '', sigo: new Set(liga.sigue || []), eleg, sem,
    miCc: yo ? yo.cc : '', miCrew: miCrewF ? limpio(miCrewF.crew).toLowerCase() : '',
    barra: sub === 'temporada', maxPts,
  };

  const base = useMemo(() => (pronto ? [] : armar(liga, cfg)), [liga, sub, pronto]); // eslint-disable-line react-hooks/exhaustive-deps
  // 🏆 los que clasifican al torneo de cierre (ver `clasificados()`), y la fila después de la cual va la línea
  const clas = useMemo(() => clasificados(cfg, base), [base, sub]); // eslint-disable-line react-hooks/exhaustive-deps
  const corteK = clas && clas.length === cfg.final ? clave(clas[clas.length - 1]) : null;
  // 🏆 Y EN EL COMPETITIVO, DESPUÉS DEL 4º, LOS QUE VAN DIRECTO A LA SUPERLIGA (Dlx, 16/10/2026: «crear una línea donde
  // dice clasifica directo a la superliga… después del top 4»): del 5º al 16º van al duelo a muerte
  const directoK = sub === 'competitivo' && clas && clas.length > 4 ? clave(clas[3]) : null;

  // al cambiar de ranking: orden, búsqueda y «ver más» vuelven a cero (los filtros de servidor y país se quedan:
  // quien mira «sólo FFA» quiere seguir viendo FFA en Duelos)
  useEffect(() => { setOrden(null); setVer(VER); setTodas(false); setAbierta(null); }, [sub]);
  // el historial de cada uno (`/api/perfiles`), la primera vez que se abre una fila: lo pide app.js y lo guarda
  useEffect(() => {
    if (!abierta || perf || typeof window.perfiles !== 'function') return undefined;
    let vivo = true;
    window.perfiles().then((d) => { if (vivo && d) setPerf(d); });
    return () => { vivo = false; };
  }, [abierta, perf]);

  // los servidores y países que hay en ESTE ranking: un filtro que no filtra nada no se dibuja
  const svs = useMemo(() => [...new Set(base.map((f) => f.sv).filter(Boolean))].sort(), [base]);
  const ccs = useMemo(() => [...new Set(base.map((f) => f.cc).filter(Boolean))].sort((a, b) => nombrePais(a).localeCompare(nombrePais(b), 'es')), [base]);
  const filtros = !cfg.sinChips;
  const qn = norm(q).trim();
  const fs0 = base.filter((f) => {
    if (filtros) {
      if (sv && f.sv !== sv) return false;
      if (cc && f.cc !== cc) return false;
      if (soloSigo && !x.sigo.has(f.k)) return false;
      if (soloNuevos && !(liga.T[f.k] || f).nu) return false;
    }
    if (qn && norm(cfg.nombre ? cfg.nombre(f) : limpio(f.n)).indexOf(qn) < 0) return false;
    return true;
  });
  const fs = orden ? ordenadas(fs0, orden.col, orden.desc) : fs0;
  const filtrando = !!(qn || (filtros && (sv || cc || soloSigo || soloNuevos)));
  // 3 · cuántos debutaron esta semana en ESTE ranking: con alguno, su chip
  const nuevos = filtros ? base.filter((f) => (liga.T[f.k] || f).nu).length : 0;
  const vis = filtrando ? fs : fs.slice(0, ver);
  const cols = (movil && !todas ? cfg.movil : cfg.cols) || [];
  const act = orden ? orden.col : cols[0];
  const desc = orden ? orden.desc : false;
  const ordenar = (id) => {
    const c = COL[id];
    setOrden((o) => (o && o.col === id ? { col: id, desc: !o.desc } : { col: id, desc: !c.txt && id !== 'pos' && id !== 'i' }));
  };

  // el podio: los tres primeros con número (la Temporada, por su puesto oficial)
  const top = base.filter((f) => numero(cfg, f)).slice(0, 3);
  // las flechas de arriba: el ranking de al lado en la tira, salteando los que todavía no existen (Misiones, Ligas) o
  // no tienen con qué (Most Wanted sin buscados); al final vuelve al principio
  const vivos = RANKINGS.filter((id) => !SUBS[id].pronto && !(SUBS[id].hay && !SUBS[id].hay(liga)));
  const ix = RANKINGS.indexOf(sub);
  const vecino = (d) => {
    for (let k = 1; k < RANKINGS.length; k += 1) {
      const id = RANKINGS[(ix + d * k + 2 * RANKINGS.length) % RANKINGS.length];
      if (vivos.includes(id)) return id;
    }
    return null;
  };
  const antes = vecino(-1);
  const despues = vecino(1);

  // ── tu lugar ──
  let lugar = null;
  let miFila = null;
  let iYo = -1;
  if (!pronto && yo) {
    const esMio = cfg.grupo === 'pais' ? (f) => yo.cc && f.cc === yo.cc
      : cfg.grupo === 'crew' ? (f) => x.miCrew && limpio(f.crew).toLowerCase() === x.miCrew
        : (f) => f.k === yo.k;
    const i = base.findIndex(esMio);
    const cara = cfg.grupo === 'pais' ? <Bandera cc={yo.cc} cls="rk-lflag" /> : cfg.grupo === 'crew' && miCrewF ? <LogoCrew c={miCrewF} cls="rk-llogo" />
      : <Cara liga={liga} k={yo.k} nombre={yo.n} cls="cara rk-lcara" />;
    const quien = cfg.grupo === 'pais' ? 'TU PAÍS · ' + nombrePais(yo.cc).toUpperCase() : cfg.grupo === 'crew' && miCrewF ? 'TU CREW · ' + limpio(miCrewF.crew).toUpperCase() : 'TU LUGAR · ' + limpio(yo.n).toUpperCase();
    if (i >= 0) {
      const f = base[i];
      miFila = clave(f);
      iYo = i;
      const n = numero(cfg, f);
      let txt;
      if (!n) {
        txt = f.fc ? 'Fuera de concurso: verifícate en Discord Rap Español y tienes número'
          : cfg.grupo === 'crew' ? 'Sin puesto: una crew necesita tres raperos en la temporada' : 'Sin puesto todavía';
      } else {
        // el de arriba con número (la Temporada tiene empates: con el mismo número, «empatado»)
        const arriba = base.slice(0, i).reverse().find((g) => numero(cfg, g));
        if (!arriba) txt = 'Estás primero';
        else if (numero(cfg, arriba) === n) txt = 'Empatado en el #' + n;
        else if (cfg.valor) {
          const [val, u, dec] = cfg.valor;
          const d = val(arriba) - val(f);
          // la unidad, en singular si es uno: «a 1 duelo», no «a 1 duelos»
          const unidad = Array.isArray(u) ? u[d === 1 ? 0 : 1] : u;
          txt = d > 0 ? 'A ' + (dec ? coma(d, dec) : num(d)) + ' ' + unidad + ' del #' + numero(cfg, arriba) : 'Empatado con el #' + numero(cfg, arriba);
        } else txt = '1.º ×' + (f.oro || 0) + ' · 2.º ×' + (f.seg || 0) + ' · 3.º ×' + (f.ter || 0);
      }
      lugar = { cara, quien, n, txt, ir: true, verificar: !n && f.fc, mov: sub === 'temporada' ? f.mv || 0 : 0 };
    } else if (sub === 'competitivo' && !yo.rg) {
      const falta = Math.max(0, (req(liga, 'competitivo') || 10) - (yo.ev || 0));
      lugar = { cara, quien, n: 0, txt: falta ? 'Te falta participar en ' + falta + (falta === 1 ? ' evento' : ' eventos') + ' más, de cualquier servidor de la Liga, para tu letra' : 'Tu letra llega con la próxima corrida' };
    } else if (!cfg.grupo) {
      const no = { duelos: 'Todavía no jugaste un duelo uno contra uno', podios: 'Todavía no subiste a un podio', rachas: 'Todavía sin racha', mw: 'Todavía no cazaste a ningún buscado' }[sub];
      if (no) lugar = { cara, quien, n: 0, txt: no };
    }
  }

  // «tu lugar» se esconde mientras tu fila está a la vista. ⚠️ Se vuelve a mirar cuando cambia QUÉ filas se dibujan
  // (no en cada dibujo: el observador avisa al empezar, y con eso de dependencia era un bucle)
  const vistas = vis.map(clave).join('|') + '#' + cols.join(',');
  useEffect(() => {
    if (!miFila || !tabla.current || !window.IntersectionObserver) { setYoVisible(false); return undefined; }
    const tr = tabla.current.querySelector('[data-c="' + String(miFila).replace(/["\\]/g, '') + '"]');
    if (!tr) { setYoVisible(false); return undefined; }
    const io = new IntersectionObserver((es) => setYoVisible(es.some((e) => e.isIntersecting)), { threshold: 0.6 });
    io.observe(tr);
    return () => io.disconnect();
  }, [miFila, vistas]);
  useEffect(() => {
    if (!tira.current || !window.IntersectionObserver) { setTiraVisible(false); return undefined; }
    const io = new IntersectionObserver((es) => setTiraVisible(es.some((e) => e.isIntersecting)), { threshold: 0.3 });
    io.observe(tira.current);
    return () => io.disconnect();
  }, [sub, pronto]);

  // el alto de la barra de abajo del celular: «tu lugar» va justo encima
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

  // «Encontrarme»: saca los filtros que te esconden, muestra hasta tu fila, baja hasta ella y la marca
  const encontrarme = () => {
    if (!miFila) return;
    if (!base.some((f) => clave(f) === miFila)) return;
    const visible = fs.findIndex((f) => clave(f) === miFila);
    if (visible < 0) { setQ(''); setSv(''); setCc(''); setSoloSigo(false); setSoloNuevos(false); }
    const idx = (visible < 0 ? (orden ? ordenadas(base, orden.col, orden.desc) : base) : fs).findIndex((f) => clave(f) === miFila);
    setVer((v) => Math.max(v, idx + 10));
    setIrA(miFila + ':' + Date.now());
  };
  useEffect(() => {
    if (!irA || !tabla.current) return undefined;
    const k = irA.slice(0, irA.lastIndexOf(':'));
    const tr = tabla.current.querySelector('[data-c="' + k.replace(/["\\]/g, '') + '"]');
    if (!tr) return undefined;
    tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    tr.classList.remove('brilla');
    void tr.offsetWidth; // eslint-disable-line no-void
    tr.classList.add('brilla');
    const t = setTimeout(() => tr.classList.remove('brilla'), 2200);
    return () => clearTimeout(t);
  }, [irA]);

  // cambiar de ranking: como app.js, con `replaceState` (es un filtro de la vista, no otra vista: «atrás» no recorre
  // las pestañas). Si la tira ya estaba pegada arriba —estabas lejos, en la tabla—, se vuelve al podio del nuevo
  const elegir = (id) => {
    setSub(id);
    try { history.replaceState(history.state, '', window.urlLG ? window.urlLG('#/ranking/' + id) : '#/ranking/' + id); } catch (e) { /* queda la dirección */ }
    const n = nav.current;
    if (n && n.getBoundingClientRect().top <= 1 && window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'auto' });
  };
  // la pestaña elegida, a la vista en la tira
  useEffect(() => {
    const t = tabs.current;
    const b = t && t.querySelector('a.on');
    if (b && t.scrollWidth > t.clientWidth) t.scrollTo({ left: Math.max(0, b.offsetLeft - (t.clientWidth - b.offsetWidth) / 2), behavior: 'smooth' });
  }, [sub]);

  // la fase de la temporada: lo que dice la página de hoy en su cabecera (`pintaFase()` de app.js)
  const fase = liga.d.fase || {};
  const ar = fase.arranca ? utc(fase.arranca + 'T12:00:00Z') : null;
  const te = fase.termina ? utc(fase.termina + 'T12:00:00Z') : null;
  let estado = '';
  if (ar && liga.ahora < ar && !isNaN(ar)) estado = 'Fase de prueba · la ' + liga.temp + ' arranca el ' + ar.getUTCDate() + ' de ' + MESES[ar.getUTCMonth()];
  else if (te && liga.ahora <= te && !isNaN(te)) estado = liga.temp + ' en juego · termina el ' + te.getUTCDate() + ' de ' + MESES[te.getUTCMonth()];
  const hace = liga.d.sello ? liga.cuando(liga.d.sello) : '';
  const que = cfg.que || ['rapero', 'raperos'];
  const fcs = base.filter((f) => f.fc).length;
  const vacioTxt = cfg.vacio ? cfg.vacio(liga)
    : !(liga.d.tabla || []).length ? <>La temporada recién arranca: el ranking se llena con el primer evento. Los próximos están en el <a className="te-link" href="#/eventos">calendario</a>.</>
      : 'Todavía no hay nadie en este ranking.';

  return (
    <>
      <nav className="rk-subs" aria-label="Rankings" ref={nav}>
        <div className="rk-subs-in" ref={tabs}>
          {/* 🧹 SÓLO LAS QUE TIENEN DATOS (Dlx, 12/10/2026, el research «página sencilla»: «hacé todo menos los dos
              puntos que chocan»): las «PRONTO» sumaban opciones sin nada detrás, contra la regla de no dibujar nada
              vacío. Aparecen solas con su primer dato. La que se abrió por un link se ve igual, con su explicación */}
          {RANKINGS.filter((id) => id === sub || !(SUBS[id].pronto || (SUBS[id].hay && !SUBS[id].hay(liga)))).map((id) => {
            const s = subDe(liga, id);
            const pr = s.pronto || (s.hay && !s.hay(liga));
            return (
              <a key={id} href={'#/ranking/' + id} className={(id === sub ? 'on' : '') + (pr ? ' pronto' : '')} aria-current={id === sub ? 'page' : undefined}
                onClick={(e) => { e.preventDefault(); elegir(id); }}>
                {s.et}{pr ? <i>{s.cuando || 'PRONTO'}</i> : null}
              </a>
            );
          })}
        </div>
      </nav>
      <div className="escena rk-esc" style={{ '--mo-c': '#E41373', '--mo-o': 0.9 }}>
        {/* las flechas, como las del escenario del Inicio (Dlx, 02/10/2026: «arrows… in the black space like we have in
            INICIO»): al ranking de al lado, salteando los que todavía no existen. Sólo en la compu */}
        {antes && despues && antes !== sub ? <>
          <a className="mo-fl izq rk-flecha" href={'#/ranking/' + antes} aria-label={'Ranking anterior: ' + subDe(liga, antes).et} title={subDe(liga, antes).et}><Chevron /></a>
          <a className="mo-fl der rk-flecha" href={'#/ranking/' + despues} aria-label={'Ranking siguiente: ' + subDe(liga, despues).et} title={subDe(liga, despues).et}><Chevron /></a>
        </> : null}
        <section className="rk-cab" id="rk-cab" ref={deslizaRk}>
          <div className="rk-tx">
            <span className="tag">RANKING · {liga.temp}</span>
            <h1 className="hero-ev largo">{cfg.et}</h1>
            <p className="hero-p">{pronto ? cfg.corto || 'Arranca pronto.' : cfg.baj}</p>
            {!pronto && (estado || hace) ? <p className="rk-meta">{estado}{estado && hace ? <br /> : null}{hace ? 'Actualizado ' + hace : ''}</p> : null}
            {!pronto && base.length ? <div className="hero-acc"><Compartir cls="btn borde chico" url={enlace('#/ranking/' + sub)} texto={'El ranking de ' + cfg.et + ' de la Liga Global'} etiqueta="Compartir el ranking" /></div> : null}
          </div>
          {top.length ? <Podio liga={liga} cfg={cfg} top={top} sem={sub === 'temporada' ? sem : null} /> : null}
          {!pronto && base.length ? <TuTira x={x} cfg={cfg} base={base} iYo={iYo} lugar={lugar} yo={yo} dc={dc} encontrarme={encontrarme} tira={tira} /> : null}
        </section>
      </div>
      {/* 🎯 los buscados de esta semana, arriba de quién cazó a quién (vivían en el Inicio hasta el 13/10/2026) */}
      {sub === 'mw' ? <SeBusca liga={liga} aca /> : null}
      <section className="sec rk-sec" id="rk-tabla">
        {pronto ? (
          <div className="rk-pronto"><span className="tag-pronto">{cfg.cuando ? 'TEMPORADA 2' : 'PRÓXIMAMENTE'}</span><p>{pronto}</p>
            {cfg.ejemplos ? <ul className="rk-ej" aria-label="Por ejemplo">{cfg.ejemplos.map(([ic, t]) => <li key={t}><Ico n={ic} t={22} /><b>{t}</b><small>suma a tu Temporada</small></li>)}</ul> : null}
          </div>
        ) : cfg.propia ? <cfg.propia liga={liga} ver={abre} /> : (
          <>
            {/* con el ranking vacío (el día que arranca la temporada) no hay qué buscar ni qué filtrar */}
            {base.length ? <div className="rk-fil">
              <div className="rk-fil-top">
              <label className="rk-buscar"><Ico n="buscar" t={18} />
                <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={'Buscar ' + que[0]} aria-label={'Buscar ' + que[0]} enterKeyHint="search" />
              </label>
              {/* 📱 Resumen · Todos los datos (Dlx, 20/10/2026: «en el celular agregar una opción ahí arriba para ver todos
                  los datos»): vivía abajo de todo como «Todas las columnas» */}
              {movil && cfg.movil && cfg.cols.length > cfg.movil.length ? (
                <div className="rk-seg" role="group" aria-label="Qué ver">
                  <button type="button" className={!todas ? 'on' : ''} aria-pressed={!todas} onClick={() => setTodas(false)}>Resumen</button>
                  <button type="button" className={todas ? 'on' : ''} aria-pressed={todas} onClick={() => setTodas(true)}>Todos los datos</button>
                </div>
              ) : null}
              </div>
              {filtros && (svs.length > 1 || ccs.length > 1 || x.sigo.size || nuevos) ? (
                <div className="rk-chips" role="group" aria-label="Filtrar">
                  <button type="button" className={!sv && !cc && !soloSigo && !soloNuevos ? 'on' : ''} aria-pressed={!sv && !cc && !soloSigo && !soloNuevos}
                    onClick={() => { setSv(''); setCc(''); setSoloSigo(false); setSoloNuevos(false); }}>Todos</button>
                  {nuevos ? <button type="button" className={'rk-chip-nuevo' + (soloNuevos ? ' on' : '')} aria-pressed={soloNuevos}
                    onClick={() => setSoloNuevos(!soloNuevos)} title="Los que jugaron su primer evento esta semana">Nuevos · {nuevos}</button> : null}
                  {x.sigo.size ? <button type="button" className={soloSigo ? 'on' : ''} aria-pressed={soloSigo} onClick={() => setSoloSigo(!soloSigo)}>A quién sigues</button> : null}
                  {svs.length > 1 ? svs.map((s) => (
                    <button type="button" key={s} className={sv === s ? 'on' : ''} aria-pressed={sv === s} onClick={() => setSv(sv === s ? '' : s)}>
                      <img alt="" src={liga.logo(s)} />{siglaDe(s)}
                    </button>
                  )) : null}
                  {ccs.length > 1 ? (
                    <label className={'rk-sel' + (cc ? ' on' : '')}>
                      <select value={cc} onChange={(e) => setCc(e.target.value)} aria-label="País">
                        <option value="">País</option>
                        {ccs.map((c) => <option key={c} value={c}>{nombrePais(c)}</option>)}
                      </select>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                    </label>
                  ) : null}
                </div>
              ) : null}
            </div> : null}
            {/* ❔ qué es cada columna (Dlx, 12/10/2026, el research «página sencilla»): los títulos de `COL`, que
                en la compu se ven al pasar el mouse y en el celular no se veían nunca */}
            {base.length && fs.length && cols.some((id) => COL[id].tit) ? (
              <details className="rk-qe">
                <summary>¿Qué es cada columna?</summary>
                <dl>{cols.filter((id) => COL[id].tit).map((id) => <div key={id}><dt>{COL[id].t}</dt><dd>{COL[id].tit}</dd></div>)}</dl>
              </details>
            ) : null}
            {!base.length ? <p className="rk-vacio">{vacioTxt}</p>
              : !fs.length ? (
                <p className="rk-vacio">Nadie con ese filtro. <button type="button" className="rk-lnk" onClick={() => { setQ(''); setSv(''); setCc(''); setSoloSigo(false); setSoloNuevos(false); }}>Sacar los filtros</button></p>
              ) : (
                <div className={'rk-tw' + (todas && movil ? ' todas' : '') + (movil && !todas ? ' lista' : '')} ref={tabla}>
                  {movil && !todas ? (
                    <ListaCel x={x} cfg={cfg} vis={vis} abierta={abierta} setAbierta={setAbierta} miFila={miFila} corteK={corteK} directoK={directoK}
                      sinFiltro={!orden && !q && !sv && !cc && !soloSigo && !soloNuevos} perf={perf} sub={sub} />
                  ) : (
                  <table className="rk-t">
                    <thead>
                      <tr>
                        {cols.map((id) => {
                          const c = COL[id];
                          const on = id === act;
                          return (
                            <th key={id} scope="col" className={(c.cls || '') + (on ? ' on ' + (desc ? 'desc' : 'asc') : '')} aria-sort={on ? (desc ? 'descending' : 'ascending') : undefined}>
                              <button type="button" title={c.tit || undefined} onClick={() => ordenar(id)}>{movil && c.tc ? c.tc : c.t}<i className="rk-fl" aria-hidden="true" /></button>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="aparece">
                      {vis.map((f) => {
                        const k = clave(f);
                        const sinFiltro = !orden && !q && !sv && !cc && !soloSigo && !soloNuevos;
                        const esCorte = corteK === k && sinFiltro;
                        const esDirecto = directoK === k && sinFiltro;
                        const ab = abierta === k;
                        const cl = [k === miFila ? 'yo' : '', f.fc ? 'fc' : '', cfg.sinPuesto && cfg.sinPuesto(f) ? 'chica' : '', ab ? 'abierta' : ''].filter(Boolean).join(' ');
                        const puede = cfg.grupo || f.k;
                        return (
                          <Fragment key={k}>
                            {/* 4 · tocar la fila la abre ahí mismo; el nombre sigue siendo el link a su perfil (teclado, otra pestaña) */}
                            <tr data-c={k} className={cl || undefined} aria-expanded={puede ? ab : undefined}
                              onClick={puede ? (e) => { if (!e.target.closest('a, button')) setAbierta(ab ? null : k); } : undefined}>
                              {cols.map((id) => <td key={id} className={((COL[id].cls || '') + (id === act && id !== 'pos' && id !== 'i' ? ' on' : '')).trim() || undefined}>{COL[id].v(f, x)}</td>)}
                            </tr>
                            {ab ? (
                              <tr className="rk-det"><td colSpan={cols.length}><Detalle x={x} cfg={cfg} f={f} perf={perf} /></td></tr>
                            ) : null}
                            {esDirecto ? (
                              <tr className="rk-corte directo"><td colSpan={cols.length}><a href="#/ligas/superliga"><Ico n="copa" t={14} /> Hasta acá clasifican directo a la Superliga · del 5º al 16º, al duelo a muerte</a></td></tr>
                            ) : null}
                            {esCorte ? (
                              <tr className="rk-corte"><td colSpan={cols.length}><a href={'#/ligas/' + (sub === 'competitivo' ? 'superliga' : 'clausura')}><Ico n="copa" t={14} /> Hasta acá clasifican a la {sub === 'competitivo' ? 'Superliga' : 'Clausura'} de la {liga.temp || 'T1'}</a></td></tr>
                            ) : null}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                  )}
                </div>
              )}
            {base.length ? (
              <div className="rk-pie">
                <span>{fs.length === base.length ? base.length + ' ' + (base.length === 1 ? que[0] : que[1]) : fs.length + ' de ' + base.length}
                  {fcs ? ' · ' + (base.length - fcs) + ' en concurso' : ''}</span>
                <span className="rk-pie-acc">
                  {!filtrando && fs.length > vis.length ? <button type="button" className="btn borde2 chico" onClick={() => setVer(fs.length)}>Ver {fs.length === base.length ? 'los ' + fs.length : 'todos'}</button> : null}
                </span>
              </div>
            ) : null}
            {fcs ? (
              <p className="rk-nota">En el <b>#</b>, <b>—</b> es <b>fuera de concurso</b>: todavía no es miembro de la Liga (tiene que estar en Discord Rap Español y verificarse). Sus puntos cuentan igual; el número es de los miembros.
                {sub === 'temporada' ? (mwOn && liga.d.mis ? '' : mwOn ? ' Misiones arranca el lunes: hasta entonces su columna va en —.' : liga.d.mis ? ' Most Wanted arranca pronto: hasta entonces su columna va en —.' : ' Most Wanted y Misiones arrancan pronto: hasta entonces sus columnas van en —.') : ''}</p>
            ) : null}
          </>
        )}
      </section>
      {lugar ? (
        <aside className={'rk-lugar' + (lugar.ir && (yoVisible || tiraVisible) ? ' oculto' : '')} style={{ '--rk-tb': tb + 'px' }} aria-label="Tu lugar">
          {lugar.cara}
          <span className="rk-ln"><Num n={lugar.n} /></span>
          <span className="rk-lt"><small>{lugar.quien}{lugar.mov ? <> · <Mov mv={lugar.mov} largo /></> : null}</small><b>{lugar.txt}</b></span>
          {lugar.verificar ? <a className="btn verde chico" href="#/cuenta/verificar">Verificarme</a>
            : lugar.ir ? <button type="button" className="btn verde chico" onClick={encontrarme}>Encontrarme</button> : null}
        </aside>
      ) : null}
    </>
  );
}
