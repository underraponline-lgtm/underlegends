// 🎒 TU INVENTARIO, «EL VESTIDOR» (remake del 16/11/2026, con el estilo del Inicio).
//
// Dlx, 16/11/2026: «asegúrate que la pestaña de mi inventario funcione correctamente, y no sólo conmigo»; a la maqueta
// A/B, «una fusión, pero eso no es un remake… y no sólo hay tags sino más cosas»; a la v2 (el vestidor), «cuando tú
// seleccionas algo, un tag, ese tiene que cambiar de la tarjeta misma… como si estuviésemos cambiando la ropa a un
// personaje», «haz que todo sea removable… vamos a añadir más tags, efectos, fondos, colores, formas y marcos… que el
// inventario sea capaz de resistir todo eso», y «hazle un remake, usa el estilo nuevo de la página de inicio».
//   · TU CARTA EN VIVO (`cartaviva.jsx`): la de verdad, no una imagen con algo pegado encima. Tocar una pieza la cambia
//     ADENTRO de la carta, también una que todavía no tienes (probarla no es tenerla: Guardar sólo con lo tuyo).
//   · TRES SECCIONES: Cartas (TAG, marco, foto, estilo, efecto), Perfil (carta principal, fondo, frase, emblemas) y
//     Colección (insignias, títulos y marcos: lo que tienes y lo que te falta, y cómo se gana). «Por abrir» arriba.
//   · CADA PIEZA, DE UN CATÁLOGO: los TAGs salen de `tags_catalogo.json` (todos, no sólo los tuyos), los títulos y los
//     marcos del Pase. Una pieza nueva entra sola en su sección: el Inventario no tiene listas escritas a mano.
//   · AL INSTANTE EN LA PÁGINA, DESPUÉS EN DISCORD (Dlx: «se deberían notar en la página al instante, pero no
//     necesariamente al instante en Discord… para que estemos bien con los límites de nuestras herramientas»).
// Los 🎯 de estado no se guardan: salen solos mientras se cumplen, con «Automático».
//
// 🎭 EL ESCENARIO (v3, 16/11/2026, ~11:45 PM ET). Dlx: «remake INVENTARIO even more, like the design… see websites,
// games… fifa»; de la maqueta de tres caminos, «Escenario principalmente, pero quizás sacar cosas de los otros también».
// Lo que dicen los juegos (Valorant, Apex, Marvel Snap): LA CARTA ES LA ESTRELLA, grande y al centro, y la lista va
// abajo. Las ranuras a la izquierda dicen lo que tienes puesto (el banner de Apex); debajo de la carta, el nombre de la
// pieza en grande y cómo se gana (Valorant); pasar el mouse por una pieza te la prueba sin tocar nada (Discord, Steam);
// «Lo puesto / Probando» compara. De la C (Marvel Snap, Steam): la Colección con barras y el % de la Liga que tiene
// cada insignia.
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import CAT from './tags_catalogo.json';
import { pasePost, refrescarPases } from './pase.js';
import { Carta, Ico, accion } from './piezas.jsx';
import { FondoCaja, FotoCartaCaja } from './cuenta.jsx';
import CSS_PAGINA from './css/inventario.css?inline';
import { usarCss } from './css.js';
import { leerVisto, marcarVisto } from './inv_nuevos.js';
import { nombreMarco } from './marcos.jsx';
import { ValesPremium } from './vales.jsx';
import { CartaViva } from './cartaviva.jsx';
import { FraseEditor } from './frase.jsx';

usarCss('inventario', CSS_PAGINA);
// 🎭 tu estilo de juego (16/11/2026): su pestaña, en su propio pedazo (trae el catálogo con los íconos). Ver `juego.jsx`
const EstiloJuego = lazy(() => import('./juego.jsx'));

const CARTAS = [['temporada', 'Temporada'], ['competitivo', 'Competitiva'], ['servidor', 'Servidor'], ['pais', 'País']];
const GRUPO = { siempre: 'para siempre', temporada: 'de temporada', pase: 'edición limitada' };
const RAREZA = (CAT.niveles || {});
const NIVELES = ['t1', 't2', 't3', 't4'];
const TIER = { premium: 'Premium', plata: 'Plata', oro: 'Oro', embajador: 'Embajador' };
// 🖼️ los marcos del Pase premium, con el nivel que los da (`bot/pase.py` PREMIUM): para ver también los que faltan
// 🎁 y el Embajador (17/11/2026): no es del Pase, es la meta de 10 de Invita y gana (`nv` = 'ref'). El orden de «el mejor»
// es el de MARCOS en bot/avisos.js, al revés: el Oro primero (quien ya lo lleva no ve cambiar su carta sola)
const MARCOS_PASE = [['premium', 1], ['plata', 15], ['oro', 25], ['embajador', 'ref']];
const ORDEN_T = ['oro', 'embajador', 'plata', 'premium'];
const comoSeGana = (nv) => (nv === 'ref' ? '10 invitados en Invita y gana' : 'Nivel ' + nv + ' del premium');
// ✨ de dónde sale un título que no es del Pase (`titulo_de` del objeto, TITULOS_FUERA en bot/avisos.js; 17/11/2026)
const TIT_DE = { nuevo: ['Título de tu semana de nuevo.', 'De la semana de nuevo'], drop: ['Título de un Dragón Drop.', 'De un Dragón Drop'],
  ref: ['Título de Invita y gana: 3 invitados.', '3 invitados'] };
/** «El mejor»: el de nivel más alto que tengas, como `mejorMarco()` de bot/avisos.js */
const mejor = (ids) => ORDEN_T.map((t) => ids.find((id) => id.split(':')[1] === t)).find(Boolean) || '';
const sinNum = (t) => t.replace(' x%d', '').replace(' DE %d', '');
const EMOJI = /^((?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:️|‍|\p{Extended_Pictographic}|\p{Regional_Indicator})*)\s*/u;
function partir(texto) {
  const m = String(texto || '').match(EMOJI);
  return m ? [m[1], texto.slice(m[0].length)] : ['', String(texto || '')];
}

/**
 * Todos los TAGs de `carta`, los tuyos y los que no: `[{tag, texto, desc, grupo, nivel, mio}]`, los tuyos primero y de
 * la rareza más alta a la más baja. La llave (`tag`) es la de las piezas de la carta (`comun/piezas.py`)
 */
function opciones(carta, yo) {
  const out = [];
  for (const [t, n, p, g] of (CAT.cat && CAT.cat[carta]) || []) {
    if (g !== 'siempre' && g !== 'temporada') continue;
    const x = ((yo.ganados || {})[carta] || {})[t];
    const mio = !!(yo.dueno || (x && (g === 'siempre' || x[1] === yo.temp)));
    out.push({ tag: t, texto: x ? x[0] : sinNum(t), desc: p, grupo: g, nivel: n, mio });
  }
  // ✨ los títulos del Pase que van en esta carta (`titulo_carta`): los tuyos y los que faltan
  const tc = yo.titulo_carta || {};
  const tuyos = new Set(yo.titulos || []);
  const deEsta = Object.keys(tc).length ? Object.keys(tc).filter((x) => tc[x] === carta) : (yo.titulos || []);
  for (const tit of deEsta) {
    out.push({ tag: 'pase:' + tit, texto: '✨ ' + tit.toUpperCase(), desc: (TIT_DE[(yo.titulo_de || {})[tit]] || ['Título del Pase de rapero.'])[0], grupo: 'pase', nivel: 't1', mio: !!(yo.dueno || tuyos.has(tit)) });
  }
  return out.sort((a, b) => (b.mio - a.mio) || (NIVELES.indexOf(a.nivel) - NIVELES.indexOf(b.nivel)));
}

const CAND = <svg className="ves-cand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="1" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>;

/** Un cuadro elegible: el ícono pintado por rareza, el nombre y debajo la rareza (o qué le falta). ⚠️ La rareza va como
 *  `r-t1`…: `.t3` a secas choca con una regla global del shadow root y desarmaba el grupo Raro (medido el 16/11/2026) */
// 🔠 la palabra más larga de un nombre (`--n`), para que la letra del cuadro baje lo justo y entre entera: «CAZARRECOMPENSAS»
// se salía de su cuadro en el celular (17/11/2026). Sin guion: la regla de la 5.69 (no se cortan a la mitad) sigue
const largoDe = (n) => { const w = typeof n === 'string' ? Math.max(0, ...n.split(/\s+/).map((x) => x.length)) : 0; return w >= 10 ? { '--n': w } : undefined; };
function Cuadro({ on, puesto, prueba, nuevo, mio = true, ic, nombre, rar, pie, nivel = '', onClick, onVer, children }) {
  // 🖱️ pasar el mouse = probártelo en la carta, sin tocar el borrador (Discord y Steam: la vista previa antes de elegir)
  const ver = onVer && FINO ? { onMouseEnter: () => onVer(true), onMouseLeave: () => onVer(false), onFocus: () => onVer(true), onBlur: () => onVer(false) } : {};
  return (
    <button type="button" role="radio" aria-checked={!!on} onClick={onClick} {...ver}
      className={'ves-q' + (nivel ? ' r-' + nivel : '') + (mio ? '' : ' bloq') + (on ? ' on' : '') + (prueba ? ' prueba' : '')}>
      {puesto ? <i className="ves-pu">Puesto</i> : nuevo ? <i className="ves-nv" aria-label="Nuevo" /> : null}
      {mio ? null : CAND}
      {children || <span className="ves-qi" aria-hidden="true">{ic}</span>}
      <b style={largoDe(nombre)}>{nombre}</b>
      {rar ? <small>{rar}</small> : null}
      {pie ? <em className="ves-pie">{pie}</em> : null}
    </button>
  );
}

/** Con mouse de verdad: en el celular un toque ya es elegir, y un «hover» falso dejaría la carta probándose algo */
const FINO = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/** La ficha de lo que tocaste: qué es, cómo se gana y si es tuyo */
function Ficha({ o }) {
  if (!o) return null;
  const [ic, txt] = partir(o.texto);
  return (
    <div className={'ves-ficha ' + (o.nivel ? 'r-' + o.nivel : '') + (o.mio ? '' : ' bloq')}>
      <span className="ves-qi" aria-hidden="true">{ic || txt.charAt(0)}</span>
      <div>
        <em>{RAREZA[o.nivel] || ''}{o.nivel && GRUPO[o.grupo] ? ' · ' + GRUPO[o.grupo] : ''}{o.mio ? ' · lo tienes' : ''}</em>
        <b>{txt}</b>
        {o.mio ? (o.desc ? <p>{o.desc}</p> : null) : <p className="ves-falta">{CAND}<span><b>Cómo se gana:</b> {o.desc || 'todavía no se sabe'}</span></p>}
      </div>
    </div>
  );
}

/** Un título de sección con la raya blanca de arriba, como «Lo último» del Inicio */
const Titulo = ({ children, extra }) => <div className="ves-h"><h3>{children}</h3>{extra || null}</div>;

/** La barra de lo que se completa: `n` de `de` */
const Barra = ({ n, de, c }) => (
  <i className="ves-barra" aria-hidden="true"><u style={{ width: (de ? (100 * n) / de : 0) + '%', background: c || undefined }} /></i>
);

/**
 * 🎒 SIN CARTAS TODAVÍA: lo que ve casi todo el que entra. Qué le falta para la primera y, si ya ganó TAGs, cuáles lo
 * esperan (se ganan con o sin carta, y se ponen en cuanto la tenga)
 */
function SinCartas({ yo, k }) {
  const ganados = [];
  for (const [c, n] of CARTAS) for (const o of opciones(c, Object.assign({}, yo, { dueno: false, titulos: [] }))) if (o.mio) ganados.push(Object.assign({ carta: n }, o));
  const ver = ganados.slice(0, 8);
  return (
    <section className="ves-sin" aria-label="Todavía no tienes cartas">
      <div className="ves-sin-cab">
        <span className="ves-sin-ic" aria-hidden="true"><Ico n="tarjetas" t={26} /></span>
        <div><b>Todavía no tienes cartas</b><p>Tu TAG, tu marco y tu foto van sobre tus cartas. Las primeras dos se desbloquean en dos pasos:</p></div>
      </div>
      <ol className="ves-pasos">
        <li><i>1</i><span><b>Verifícate</b><small>Discord Rap Español, rol Miembro y tu país · tu carta de Servidor</small></span>
          <a className="ves-btn blanco" href="#/cuenta/verificar">Verificarme</a></li>
        <li><i>2</i><span><b>Tu primera Tarea del Pase</b><small>Tu carta de Temporada</small></span>
          <a className="ves-btn" href="#/pase">Ver el Pase</a></li>
      </ol>
      {ganados.length ? (
        <>
          <p className="ves-p"><b>{ganados.length === 1 ? 'Ya ganaste un TAG' : 'Ya ganaste ' + ganados.length + ' TAGs'}</b> jugando:
            {ganados.length === 1 ? ' te espera' : ' te esperan'} acá para ponérselos a tus cartas en cuanto las tengas.</p>
          <div className="ves-grid">
            {ver.map((o) => {
              const [ic, txt] = partir(o.texto);
              return <Cuadro key={o.carta + o.tag} nivel={o.nivel} ic={ic || txt.charAt(0)} nombre={txt} rar={o.carta} onClick={() => {}} />;
            })}
          </div>
          {ganados.length > ver.length ? <p className="ves-nota">Y {ganados.length - ver.length} más.</p> : null}
        </>
      ) : null}
      <a className="ves-lnk" href={k ? '#/tarjetas' : '#/guia'}>{k ? 'Ver qué me falta para cada carta →' : 'Cómo funciona →'}</a>
    </section>
  );
}

// 🧩 las ranuras de tus cartas: `[id, etiqueta]`. «Efecto» todavía no existe: va con candado y lo dice
const RANURAS = [['tag', 'TAG'], ['marco', 'Marco'], ['foto', 'Foto'], ['estilo', 'Estilo'], ['efecto', 'Efecto']];
// la carta, la estrella: 330 en la compu (la del escenario de la maqueta), 250 en el celular
const anchoDe = () => (typeof window !== 'undefined' && window.innerWidth < 760 ? Math.min(250, window.innerWidth - 110) : 330);
const PERFIL_R = [['fondo', 'Fondo', 'El fondo de tu perfil'], ['frase', 'Frase', 'Debajo de tu nombre'], ['emblemas', 'Emblemas', 'Al lado de tu nombre'],
  ['juego', 'Estilo de juego', 'Cómo rapeas']];

export function Inventario({ liga, dc, carta0 = '', ranura0 = '' }) {
  const [yo, setYo] = useState(undefined);
  const [mk, setMk] = useState(null);
  const [sec, setSec] = useState(['principal', 'fondo', 'frase', 'emblemas'].includes(ranura0) ? 'perfil' : ranura0 === 'coleccion' ? 'col'
    : ranura0 === 'juego' ? 'juego' : 'cartas');
  const [carta, setCarta] = useState(CARTAS.some(([c]) => c === carta0) ? carta0 : 'temporada');
  const [ran, setRan] = useState(RANURAS.some(([r]) => r === ranura0) ? ranura0 : 'tag');
  const [filtro, setFiltro] = useState('todos');
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState(null);
  const [ocup, setOcup] = useState('');
  const [msg, setMsg] = useState('');
  const [estado, setEstado] = useState('buscando');
  const [perf, setPerf] = useState(null);
  // 🎭 «Lo puesto» / «Probando», y lo que el mouse está mostrando (`{campo, v}`): eso no entra al borrador
  const [ver, setVer] = useState('prob');
  const [hov, setHov] = useState(null);
  const tHov = useRef(0);
  // 🏅 cuánta gente de la Liga tiene cada insignia: `{n, de: {id: cuántos}}`, de los perfiles
  const [pct, setPct] = useState(null);
  // 👗 TUS LOOKS GUARDADOS (17/11/2026, Dlx: «haz lo de los looks guardados también»; de la B de la maqueta: Rocket
  // League y Fortnite). `null` si el Worker no los sabe todavía: entonces la fila no se dibuja (sin dato no hay pieza)
  const [looks, setLooks] = useState(null);
  const [lookOn, setLookOn] = useState(-1);
  const [nombreNuevo, setNombreNuevo] = useState(null);
  const [borrarN, setBorrarN] = useState(-1);
  const [lookMsg, setLookMsg] = useState('');
  useEffect(() => { if (dc) pasePost('looks', {}).then((d) => setLooks(d && d._ok && Array.isArray(d.looks) ? d : null)); }, [dc]);
  // 👀 el borrador: `tags` por carta, `marco`, `estilo` y `principal`; lo que no está, es lo guardado
  const [bor, setBor] = useState({ tags: {} });
  const [visto] = useState(leerVisto);
  const [ancho, setAncho] = useState(anchoDe);
  useEffect(() => {
    const f = () => setAncho(anchoDe());
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  useEffect(() => {
    pasePost('tags-mios', {}).then((d) => setYo(d && d._ok ? d : null));
    pasePost('marcos', {}).then((d) => setMk(d && d._ok ? d : null));
  }, []);
  useEffect(() => { if (yo) marcarVisto(yo); }, [yo]);
  const k = (dc && dc.clave) || (yo && yo.k) || '';
  // 🃏 tus cartas también desde tu perfil (quien está en la Liga sin competir), y tus insignias para la Colección
  useEffect(() => {
    if (!k || typeof window.perfiles !== 'function') return undefined;
    let vivo = true;
    Promise.resolve(window.perfiles()).then((d) => {
      if (vivo && d && d.p) {
        const de = {};
        const todos = Object.values(d.p);
        for (const x of todos) for (const i of x.ins || []) de[i[0]] = (de[i[0]] || 0) + 1;
        setPct({ n: todos.length, de });
      }
      const p = d && d.p && d.p[k];
      if (!vivo || !p) return;
      // su fila, para que `Carta` encuentre la imagen: `cartaUrl()` la busca en `liga.T` o `liga.X` (`fuera()`)
      if (p.f && Array.isArray(p.f.c) && !(liga.T && liga.T[k]) && !(liga.X && liga.X[k])) liga.fuera(Object.assign({ k }, p.f));
      setPerf(p);
    }).catch(() => {});
    return () => { vivo = false; };
  }, [k, liga]);
  const tienes = useMemo(() => {
    const f = (liga.T && liga.T[k]) || (liga.X && liga.X[k]);
    const c = new Set([...((f && f.c) || []), ...((perf && perf.f && perf.f.c) || []), ...((dc && dc.cs) || [])]);
    return CARTAS.filter(([x]) => c.has(x));
  }, [liga, k, dc, perf]);
  useEffect(() => { if (tienes.length && !tienes.some(([x]) => x === carta)) setCarta(tienes[0][0]); }, [tienes]); // eslint-disable-line react-hooks/exhaustive-deps
  const nCambios = Object.keys(bor.tags).length + ('marco' in bor || 'estilo' in bor ? 1 : 0) + ('principal' in bor ? 1 : 0);
  useEffect(() => {
    if (!nCambios) return undefined;
    const f = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', f);
    return () => window.removeEventListener('beforeunload', f);
  }, [nCambios]);

  if (!dc) {
    return (
      <div className="ves"><section className="ves-sin"><div className="ves-sin-cab"><span className="ves-sin-ic" aria-hidden="true"><Ico n="tarjetas" t={26} /></span>
        <div><b>Tu inventario</b><p>Tus TAGs, tus marcos y tus cartas, en un solo lugar. Entra con Discord para verlo.</p></div></div>
        <button type="button" className="ves-btn blanco" onClick={accion.entrar}>Entrar con Discord</button></section></div>
    );
  }
  if (yo === undefined) return <div className="ves"><p className="ves-nota">Buscando tu inventario…</p></div>;
  if (!yo) return <div className="ves"><p className="ves-nota">No pude leer tu inventario. Entra con Discord y prueba de nuevo.</p></div>;

  const cartas = tienes;
  const sinCartas = !cartas.length;
  const nombre = (CARTAS.find(([x]) => x === carta) || [])[1] || '';
  const ops = opciones(carta, yo);
  const mias = ops.filter((o) => o.mio);
  const elG = (yo.elegidos || {})[carta] || 'auto';
  const el = carta in bor.tags ? bor.tags[carta] : elG;
  const q = busca.trim().toLowerCase();
  const vistos = ops.filter((o) => (filtro === 'todos' || (filtro === 'mios' ? o.mio : !o.mio))
    && (!q || o.texto.toLowerCase().includes(q) || (o.desc || '').toLowerCase().includes(q)));
  const marcos = (mk && mk.tienes) || [];
  const idsMarcos = marcos.map(([id]) => id);
  const marcoG = (mk && mk.elegido) || '';
  const estiloG = (mk && mk.estilo) || 'camiseta';
  const principalG = yo.principal || '';
  const marcoAhora = 'marco' in bor ? bor.marco : marcoG;
  const estiloAhora = 'estilo' in bor ? bor.estilo : estiloG;
  const principalAhora = 'principal' in bor ? bor.principal : principalG;
  const temp = yo.temp || 't1';
  // el marco que se prueba sobre la carta (con la forma de `marcosPublicos()`): `null` sin marco
  const marcoDe = (m) => (m === 'ninguno' || (!m && !idsMarcos.length) ? null : [m || mejor(idsMarcos), estiloAhora, (mk && mk.serie) || 0]);
  const marcoVer = !('marco' in bor || 'estilo' in bor) ? undefined : marcoDe(marcoAhora);
  // 🎭 lo que muestra la carta: lo guardado («Lo puesto»), o el borrador con lo que el mouse está tocando encima
  const tagCarta = ver === 'puesto' ? elG : hov && hov.campo === 'tag' ? hov.v : el;
  const marcoCarta = ver === 'puesto' ? undefined : hov && hov.campo === 'marco' ? marcoDe(hov.v) : marcoVer;
  // pasar por una pieza: un respiro antes de mostrarla, así barrer la grilla con el mouse no hace parpadear la carta
  const verPieza = (campo, v) => (on) => {
    clearTimeout(tHov.current);
    tHov.current = setTimeout(() => setHov(on ? { campo, v } : null), on ? 90 : 140);
  };
  const esNuevo = (clave) => !!visto && !visto.has(clave);
  const bloqueado = Object.entries(bor.tags).some(([c, t]) => t !== 'auto' && !(opciones(c, yo).find((o) => o.tag === t) || {}).mio)
    || ('marco' in bor && !!bor.marco && bor.marco !== 'ninguno' && !idsMarcos.includes(bor.marco));

  // tocar = probar, también lo que no tienes: lo igual a lo guardado sale del borrador
  const probar = (campo, v, guardado, enCarta = carta) => {
    setVer('prob');
    setBor((b) => {
      const n = { ...b, tags: { ...b.tags } };
      if (campo === 'tag') { if (v === guardado) delete n.tags[enCarta]; else n.tags[enCarta] = v; }
      else if (v === guardado) delete n[campo]; else n[campo] = v;
      return n;
    });
  };
  const cancelar = () => { setBor({ tags: {} }); setMsg(''); setSel(null); setVer('prob'); setLookOn(-1); };

  // 👗 lo que llevas ahora en todas tus cartas (lo guardado con lo que estás probando encima): eso es lo que se guarda
  const lookAhora = () => {
    const tags = {};
    for (const [c] of cartas) tags[c] = c in bor.tags ? bor.tags[c] : (yo.elegidos || {})[c] || 'auto';
    return { tags, marco: marcoAhora, estilo: estiloAhora };
  };
  const mismoLook = (a, b) => cartas.every(([c]) => ((a.tags || {})[c] || 'auto') === ((b.tags || {})[c] || 'auto'))
    && (a.marco === undefined || a.marco === b.marco) && (a.estilo === undefined || a.estilo === b.estilo);
  // ponerse un look: va al borrador, como si hubieras tocado cada pieza; Guardar revisa que sea tuyo
  const ponerLook = (L) => {
    const n = { tags: {} };
    for (const [c] of cartas) {
      const v = (L.look.tags || {})[c];
      if (v && v !== ((yo.elegidos || {})[c] || 'auto')) n.tags[c] = v;
    }
    if (typeof L.look.marco === 'string' && L.look.marco !== marcoG) n.marco = L.look.marco;
    if ((L.look.estilo === 'camiseta' || L.look.estilo === 'cadena') && L.look.estilo !== estiloG) n.estilo = L.look.estilo;
    setBor(n); setVer('prob'); setHov(null); setLookOn(L.n); setMsg(''); setLookMsg(''); setBorrarN(-1);
  };
  const guardarLook = async () => {
    setOcup('look');
    const d = await pasePost('look-guardar', { nombre: (nombreNuevo || '').trim(), look: lookAhora() });
    setOcup('');
    if (d && d._ok) { setLooks(d); setLookOn(d.guardado); setNombreNuevo(null); setLookMsg('Look guardado: un toque y te lo pones.'); }
    else setLookMsg(d && d.error === 'lleno' ? 'Ya tienes ' + ((looks && looks.max) || 5) + ' looks: borra uno para guardar otro.' : 'No pude guardar el look. Prueba de nuevo.');
  };
  const borrarLook = async (n) => {
    setOcup('look');
    const d = await pasePost('look-borrar', { n });
    setOcup('');
    setBorrarN(-1);
    if (d && d._ok) { setLooks(d); if (lookOn === n) setLookOn(-1); } else setLookMsg('No pude borrarlo. Prueba de nuevo.');
  };
  const guardar = async () => {
    setOcup('guardar');
    const avisos = [];
    let ok = true;
    for (const [c, tag] of Object.entries(bor.tags)) {
      const d = await pasePost('tag-elige', { carta: c, tag });
      if (d && d._ok) setYo(d);
      else {
        ok = false;
        avisos.push(d && d.error === 'no lo tienes' ? 'Ese TAG todavía no es tuyo.' : d && d.error === 'ese título va en otra carta'
          ? 'Ese título va en otra carta.' : 'Un TAG no se pudo guardar.');
      }
    }
    if ('marco' in bor || 'estilo' in bor) {
      const d = await pasePost('marco-elige', { marco: marcoAhora, estilo: estiloAhora });
      if (d && d._ok) setMk(d); else { ok = false; avisos.push('El marco no se pudo guardar.'); }
    }
    if ('principal' in bor) {
      const d = await pasePost('carta-principal', { carta: principalAhora });
      if (d && d._ok) setYo(d); else { ok = false; avisos.push('La carta principal no se pudo guardar.'); }
    }
    refrescarPases();
    setOcup('');
    setBor({ tags: {} });
    setSel(null);
    // ⚡ en la página, al instante; en /card y en la imagen que ven los demás, cuando se vuelve a dibujar
    setMsg(ok ? 'Guardado: ya se ve en tu carta. En /card y en la imagen que ven los demás se actualiza en un rato.'
      : 'Se guardó una parte. ' + [...new Set(avisos)].join(' '));
  };

  const claveNueva = (o) => (o.grupo === 'pase' ? o.tag.replace(/^pase:/, 'pase|') : carta + '|' + o.tag);
  const nuevos = ops.filter((o) => o.mio && esNuevo(claveNueva(o)));
  const vistosF = filtro === 'nuevos' ? vistos.filter((o) => nuevos.includes(o)) : vistos;

  // 🏷️ los TAGs: una sola grilla (la rareza va en el borde de arriba de cada cuadro), lo tuyo primero
  const cajonTag = () => (
    <>
      <div className="ves-barra-f">
        <div className="ves-fil" role="radiogroup" aria-label="Qué TAGs ver">
          {[['todos', 'Todos', ops.length], ['mios', 'Tuyos', mias.length], ['faltan', 'Por ganar', ops.length - mias.length], ['nuevos', 'Nuevos', nuevos.length]]
            .filter(([id, , c]) => id !== 'nuevos' || c).map(([id, n, c]) => (
              <button key={id} type="button" role="radio" aria-checked={filtro === id} className={filtro === id ? 'on' : ''} onClick={() => setFiltro(id)}>{n}<em>{c}</em></button>
            ))}
        </div>
        {ops.length > 12 ? <input className="ves-busca" type="search" placeholder="Buscar un TAG…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar un TAG" /> : null}
      </div>
      <div className="ves-grid" role="radiogroup" aria-label={'El TAG de tu ' + nombre}>
        {filtro === 'todos' || filtro === 'mios' ? (
          <Cuadro nivel="auto" on={el === 'auto'} puesto={elG === 'auto'} prueba={bor.tags[carta] === 'auto'} ic="🎯" nombre="Automático" rar="El de hoy"
            onVer={verPieza('tag', 'auto')} onClick={() => { setSel(null); probar('tag', 'auto', elG); }} />
        ) : null}
        {vistosF.map((o) => {
          const [ic, txt] = partir(o.texto);
          return (
            <Cuadro key={o.tag} nivel={o.nivel} mio={o.mio} on={el === o.tag} puesto={elG === o.tag} prueba={bor.tags[carta] === o.tag}
              nuevo={o.mio && esNuevo(claveNueva(o))} ic={ic || txt.charAt(0)} nombre={txt} rar={o.mio ? RAREZA[o.nivel] : 'Por ganar'}
              onVer={verPieza('tag', o.tag)} onClick={() => { setSel(o.tag); probar('tag', o.tag, elG); }} />
          );
        })}
      </div>
      {q && !vistosF.length ? <p className="ves-nota">Ningún TAG dice «{busca}».</p> : null}
    </>
  );

  const cajonMarco = () => (
    <>
      <p className="ves-p">El marco va alrededor de <b>tus cuatro cartas</b>, en la página y en /card.</p>
      <div className="ves-grid" role="radiogroup" aria-label="El marco de tus cartas">
        <Cuadro on={!marcoAhora && !!idsMarcos.length} puesto={!marcoG && !!idsMarcos.length} ic="⭐" nombre="El mejor" rar="Automático"
          mio={!!idsMarcos.length} onVer={verPieza('marco', '')} onClick={() => probar('marco', '', marcoG)} />
        {MARCOS_PASE.map(([t, nv]) => {
          const id = idsMarcos.find((x) => x.split(':')[1] === t) || temp + ':' + t;
          const mio = idsMarcos.includes(id);
          return (
            <Cuadro key={t} mio={mio} on={marcoAhora === id} puesto={marcoG === id} prueba={bor.marco === id} nombre={nombreMarco(id) || 'Marco ' + TIER[t]}
              rar={mio ? 'Marco ' + TIER[t] : comoSeGana(nv)} onVer={verPieza('marco', id)} onClick={() => probar('marco', id, marcoG)}>
              <span className="ves-qi" aria-hidden="true"><i className={'ves-sw ' + t} /></span>
            </Cuadro>
          );
        })}
        <Cuadro on={marcoAhora === 'ninguno'} puesto={marcoG === 'ninguno'} ic="▢" nombre="Sin marco" rar="Como siempre" onVer={verPieza('marco', 'ninguno')} onClick={() => probar('marco', 'ninguno', marcoG)} />
      </div>
    </>
  );

  const cajon = () => {
    if (ran === 'tag') return cajonTag();
    if (ran === 'marco') return cajonMarco();
    if (ran === 'foto') return <Suspense fallback={<p className="ves-nota">Cargando…</p>}><FotoCartaCaja dc={dc} /></Suspense>;
    if (ran === 'estilo') {
      return (
        <>
          <p className="ves-p">Cómo se viste tu carta de <b>Servidor</b> cuando lleva marco.</p>
          <div className="ves-grid" role="radiogroup" aria-label="El estilo de tu carta de Servidor">
            {((mk && mk.estilos) || ['camiseta', 'cadena']).map((e) => (
              <Cuadro key={e} on={estiloAhora === e} puesto={estiloG === e} ic={e === 'cadena' ? '⛓️' : '👕'} nombre={e === 'cadena' ? 'La cadena' : 'La camiseta'}
                rar={e === 'cadena' ? 'Estilo' : 'Tus colores'} onClick={() => { setCarta('servidor'); probar('estilo', e, estiloG); }} />
            ))}
          </div>
        </>
      );
    }
    return <div className="ves-ficha bloq"><span className="ves-qi" aria-hidden="true">✨</span><div><em>Pronto</em><b>Efectos</b>
      <p className="ves-falta">{CAND}<span>Brillos y animaciones para tu carta, en la página y en Discord. Llegan con la Tienda.</span></p></div></div>;
  };

  const valor = {
    tag: el === 'auto' ? 'Automático' : partir((ops.find((o) => o.tag === el) || {}).texto || '')[1] || 'Automático',
    marco: marcoAhora === 'ninguno' ? 'Sin marco' : marcoAhora ? nombreMarco(marcoAhora) : idsMarcos.length ? 'El mejor' : 'Ninguno todavía',
    foto: 'Tu foto', estilo: estiloAhora === 'cadena' ? 'La cadena' : 'La camiseta', efecto: 'Pronto',
  };
  const cuantos = { tag: mias.length + '/' + ops.length, marco: idsMarcos.length + '/' + MARCOS_PASE.length };
  const ranuras = RANURAS.filter(([r]) => r !== 'estilo' || cartas.some(([c]) => c === 'servidor'));

  // 🏅 la colección: insignias (de tu perfil), títulos y marcos
  const insCat = (liga.d && liga.d.insignias) || [];
  const insMias = new Set(((perf && perf.ins) || []).map((x) => x[0]));
  const titulos = Object.keys(yo.titulo_carta || {});
  const titMios = new Set(yo.titulos || []);
  const tagsTot = CARTAS.reduce((a, [c]) => a + opciones(c, yo).filter((o) => o.mio).length, 0);
  const tagsCat = CARTAS.reduce((a, [c]) => a + opciones(c, yo).length, 0);
  // «lo tiene el 3,8 %»; debajo de 1, con un decimal más, y nadie es «nadie todavía»
  const enPct = (x) => (!x ? 'nadie todavía' : 'lo tiene el ' + String(x < 0.01 ? (100 * x).toFixed(2) : x < 0.1 ? (100 * x).toFixed(1) : Math.round(100 * x)).replace('.', ',') + ' %');

  // 🎭 LA FICHA DE DEBAJO DE LA CARTA: la pieza que se está viendo —la que tiene el mouse encima, la que tocaste o la
  // puesta—, su nombre en grande y cómo se gana (Valorant: el nombre de la carta abajo, en grande)
  const etRan = (RANURAS.find(([r]) => r === ran) || [])[1] || '';
  const nomMarco = (m) => (m === 'ninguno' ? 'Sin marco' : m ? nombreMarco(m) || 'Marco' : idsMarcos.length ? 'El mejor' : 'Sin marco');
  let foco;
  if (ran === 'tag') {
    const t = tagCarta;
    foco = t === 'auto'
      ? { texto: '🎯 Automático', desc: 'Sale solo el TAG de estado de hoy (TOP 10, EN LLAMAS…). Si hoy no tienes ninguno, va sin TAG.', mio: true, nivel: '' }
      : { ...(ops.find((o) => o.tag === t) || { texto: t, mio: true }) };
    foco.cambia = t !== elG;
  } else if (ran === 'marco') {
    const m = ver === 'puesto' ? marcoG : hov && hov.campo === 'marco' ? hov.v : marcoAhora;
    const tier = (m || '').split(':')[1] || '';
    const mio = !m || m === 'ninguno' ? (m === 'ninguno' || !!idsMarcos.length) : idsMarcos.includes(m);
    const nv = (MARCOS_PASE.find(([x]) => x === tier) || [])[1];
    foco = { texto: '🖼️ ' + nomMarco(m), mio, nivel: tier === 'oro' || tier === 'embajador' ? 't1' : tier ? 't2' : '', cambia: m !== marcoG,
      desc: mio ? 'Va alrededor de tus cuatro cartas, en la página y en /card.' : nv === 'ref' ? 'Se gana con 10 invitados en Invita y gana.' : 'Nivel ' + nv + ' del Pase premium.' };
  } else if (ran === 'foto') {
    foco = { texto: '📸 Tu foto', desc: 'La de tu carta. Se cambia abajo, una vez por temporada.', mio: true };
  } else if (ran === 'estilo') {
    foco = { texto: estiloAhora === 'cadena' ? '⛓️ La cadena' : '👕 La camiseta', desc: 'Cómo se viste tu carta de Servidor cuando lleva marco.', mio: true, cambia: 'estilo' in bor };
  } else {
    foco = { texto: '✨ Efectos', desc: 'Brillos y animaciones para tu carta, en la página y en Discord. Llegan con la Tienda.', mio: false, pronto: true };
  }
  const fichaEm = [RAREZA[foco.nivel], GRUPO[foco.grupo], foco.mio && foco.nivel ? 'lo tienes' : ''].filter(Boolean).join(' · ') || 'Tu ' + etRan.toLowerCase();

  return (
    <div className="ves">
      <header className="ves-cab">
        <div>
          <span className="ves-ceja">Lo tuyo</span>
          <h2>Inventario</h2>
          <p>Toca una pieza y tu carta se la prueba. Guardas cuando te guste.{yo.dueno ? ' · 👑 como dueño, tienes todo desbloqueado' : ''}</p>
        </div>
        <dl className="ves-num">
          <div><dt>TAGs</dt><dd>{tagsTot}</dd></div>
          <div><dt>Marcos</dt><dd>{idsMarcos.length}</dd></div>
          <div><dt>Insignias</dt><dd>{insMias.size}<small>/{insCat.length}</small></dd></div>
        </dl>
      </header>

      {/* 🎁 por abrir: el Pase premium de campeón de liga, arriba de todo (sin ninguno, no se dibuja) */}
      <ValesPremium />

      <div className="ves-sec" role="tablist" aria-label="Qué miras">
        {[['cartas', 'Cartas', sinCartas ? 'Ninguna todavía' : cartas.length + ' de 4'], ['perfil', 'Perfil', 'Fondo, frase y más'],
          ['juego', 'Estilo de juego', 'Cómo rapeas'], ['col', 'Colección', insMias.size + ' insignias']].map(([id, n, s]) => (
          <button key={id} type="button" role="tab" aria-selected={sec === id} className={sec === id ? 'on' : ''} onClick={() => { setSec(id); setSel(null); }}>
            <b>{n}</b><small>{s}</small></button>
        ))}
      </div>
      {msg ? <p className="ves-msg" role="status">{msg}</p> : null}

      {sec === 'cartas' && sinCartas ? <SinCartas yo={yo} k={k} /> : null}
      {sec === 'cartas' && !sinCartas ? (
        <div className="ves-a">
          {/* 🎭 el escenario: las ranuras a la izquierda, tu carta al centro y tus cartas a la derecha (en el celular,
              tus cartas arriba, la carta y las ranuras en una fila que se desliza) */}
          <section className="ves-esc" data-fondo={etRan}>
            <nav className="ves-rail" aria-label="Qué le cambias">
              <span className="ves-rk">Tu carta</span>
              {ranuras.map(([id, et]) => {
                const sg = (id === 'tag' && carta in bor.tags) || (id === 'marco' && 'marco' in bor) || (id === 'estilo' && 'estilo' in bor);
                return (
                  <button key={id} type="button" aria-pressed={ran === id} className={'ves-rn' + (ran === id ? ' on' : '') + (id === 'efecto' ? ' lk' : '') + (sg ? ' sg' : '')}
                    onClick={() => { setRan(id); setSel(null); setHov(null); }}>
                    <b>{et}{id === 'tag' && nuevos.length ? <i className="ves-pt" aria-label="hay nuevos" /> : null}{cuantos[id] ? <em>{cuantos[id]}</em> : null}</b>
                    <small>{valor[id]}</small>
                  </button>
                );
              })}
              <span className="ves-rk">Tu perfil</span>
              {PERFIL_R.map(([id, et, s]) => (
                <button key={id} type="button" className="ves-rn va" onClick={() => { setSec(id === 'juego' ? 'juego' : 'perfil'); setSel(null); }}><b>{et}</b><small>{s}</small></button>
              ))}
              <span className="ves-rk">Colección</span>
              <button type="button" className="ves-rn va" onClick={() => { setSec('col'); setSel(null); }}><b>Insignias</b><small>{insMias.size} de {insCat.length}</small></button>
            </nav>
            <div className="ves-mid">
              <div className="ves-carta">
                {nCambios && ver === 'prob' ? <span className="ves-vp">Probando</span> : null}
                <CartaViva liga={liga} k={k} cual={carta} ancho={ancho} piezas={{ tag: tagCarta }} marco={marcoCarta} onEstado={setEstado} cls="ves-ci" />
              </div>
              {estado === 'imagen' ? <p className="ves-nota ves-aun">Tu carta se arma en vivo desde su próximo dibujo: hasta entonces, lo que pruebas se ve acá abajo.</p> : null}
              <div className={'ves-info' + (foco.nivel ? ' r-' + foco.nivel : '')} aria-live="polite">
                <em>{fichaEm}</em>
                <b>{partir(foco.texto)[1]}</b>
                {foco.desc ? <p>{foco.mio ? foco.desc : <>{CAND}<span><span className="ves-cg">{foco.pronto ? 'Pronto:' : 'Cómo se gana:'}</span> {foco.desc}</span></>}</p> : null}
                {foco.cambia !== undefined ? <span className={'ves-est ' + (foco.cambia ? 'prob' : 'ok')}>{foco.cambia ? (foco.mio ? 'Sin guardar' : 'Probando') : 'Puesto'}</span> : null}
              </div>
              {nCambios ? (
                <div className="ves-cmp" role="radiogroup" aria-label="Qué ver en tu carta">
                  {[['puesto', 'Lo puesto'], ['prob', 'Probando']].map(([id, n]) => (
                    <button key={id} type="button" role="radio" aria-checked={ver === id} className={ver === id ? 'on' : ''} onClick={() => { setVer(id); setHov(null); }}>{n}</button>
                  ))}
                </div>
              ) : null}
            </div>
            <aside className="ves-mazo" role="tablist" aria-label="Qué carta vistes">
              <span className="ves-rk">Cartas</span>
              {cartas.map(([c, n]) => (
                <button key={c} type="button" role="tab" aria-selected={carta === c} className={carta === c ? 'on' : ''}
                  onClick={() => { setCarta(c); setSel(null); setBusca(''); setHov(null); }}>
                  <span className="ves-mi"><Carta liga={liga} k={k} cual={c} cls="ves-mci" abre={false} /></span>
                  <small>{n}{principalAhora === c ? ' ★' : ''}{c in bor.tags ? <i className="ves-pt" aria-label="sin guardar" /> : null}</small>
                </button>
              ))}
            </aside>
          </section>
          {looks ? (
            <section className="ves-looks" aria-label="Tus looks">
              <div className="ves-looks-h"><b>Tus looks</b><small>{looks.looks.length ? 'un toque y te lo pones en todas tus cartas' : 'guarda lo que llevas y vuelve a ponértelo de un toque'}</small></div>
              <div className="ves-looks-l">
                {looks.looks.map((L) => {
                  const tg = (L.look.tags || {})[carta] || 'auto';
                  const txt = tg === 'auto' ? 'Automático' : partir((ops.find((o) => o.tag === tg) || {}).texto || tg)[1];
                  const puesto = mismoLook(L.look, { tags: Object.fromEntries(cartas.map(([c]) => [c, (yo.elegidos || {})[c] || 'auto'])), marco: marcoG, estilo: estiloG });
                  return borrarN === L.n ? (
                    <div key={L.n} className="ves-look borrar"><b>¿Borrar «{L.nombre}»?</b>
                      <span><button type="button" className="ves-btn" disabled={!!ocup} onClick={() => borrarLook(L.n)}>Sí, borrar</button>
                        <button type="button" className="ves-btn" onClick={() => setBorrarN(-1)}>No</button></span></div>
                  ) : (
                    <div key={L.n} className={'ves-look' + (lookOn === L.n && nCambios ? ' on' : '') + (puesto ? ' puesto' : '')}>
                      <button type="button" className="ves-look-b" onClick={() => ponerLook(L)} aria-label={'Ponerme el look ' + L.nombre}>
                        {puesto ? <i className="ves-pu">Puesto</i> : null}
                        <b>{L.nombre}</b><small>{txt}{L.look.marco !== undefined ? ' · ' + nomMarco(L.look.marco) : ''}</small>
                      </button>
                      <button type="button" className="ves-look-x" onClick={() => setBorrarN(L.n)} aria-label={'Borrar el look ' + L.nombre}>✕</button>
                    </div>
                  );
                })}
                {nombreNuevo !== null ? (
                  <form className="ves-look nuevo" onSubmit={(e) => { e.preventDefault(); guardarLook(); }}>
                    <input value={nombreNuevo} maxLength={24} placeholder={'Look ' + (looks.looks.length + 1)} aria-label="Nombre del look"
                      onChange={(e) => setNombreNuevo(e.target.value)} autoFocus />
                    <span><button type="submit" className="ves-btn blanco" disabled={!!ocup}>{ocup === 'look' ? 'Guardando…' : 'Guardar'}</button>
                      <button type="button" className="ves-btn" onClick={() => setNombreNuevo(null)}>Cancelar</button></span>
                  </form>
                ) : looks.looks.length < (looks.max || 5) ? (
                  <button type="button" className="ves-look mas" disabled={bloqueado} onClick={() => { setNombreNuevo(''); setLookMsg(''); }}
                    title={bloqueado ? 'Lo que estás probando todavía no es tuyo' : undefined}>
                    + Guardar look{bloqueado ? <small>con piezas tuyas</small> : null}</button>
                ) : null}
              </div>
              {lookMsg ? <p className="ves-nota" role="status">{lookMsg}</p> : null}
            </section>
          ) : null}
          <section className="ves-abajo" aria-label="Lo que le pones a tu carta">
            <Titulo extra={<small className="ves-de">{ran === 'tag' || ran === 'marco' ? (FINO ? 'pasa el mouse o toca para probártelo' : 'toca para probártelo') : 'tu ' + nombre}</small>}>
              {etRan}{ran === 'tag' ? ' de tu ' + nombre : ''}</Titulo>
            {cajon()}
          </section>
        </div>
      ) : null}

      {sec === 'perfil' ? (
        <div className="ves-perfil">
          {!sinCartas ? (
            <section className="ves-panel">
              <Titulo>Tu carta principal</Titulo>
              <p className="ves-p">La que te representa: sale primero en /card, en tu perfil y en el ranking.</p>
              <div className="ves-grid cartas" role="radiogroup" aria-label="Tu carta principal">
                <Cuadro on={!principalAhora} puesto={!principalG} ic="🎯" nombre="La de siempre" rar="Según dónde" onClick={() => probar('principal', '', principalG)} />
                {cartas.map(([c, n]) => (
                  <Cuadro key={c} on={principalAhora === c} puesto={principalG === c} nombre={n} onClick={() => probar('principal', c, principalG)}>
                    <span className="ves-qc" aria-hidden="true"><Carta liga={liga} k={k} cual={c} cls="ves-qci" abre={false} /></span>
                  </Cuadro>
                ))}
              </div>
            </section>
          ) : null}
          <section className="ves-panel"><Titulo>Tus fondos</Titulo><Suspense fallback={<p className="ves-nota">Cargando…</p>}><FondoCaja dc={dc} liga={liga} /></Suspense></section>
          {k ? <section className="ves-panel"><Titulo>Tu frase</Titulo><FraseEditor k={k} /></section> : null}
          {k ? (
            <section className="ves-panel"><Titulo>Tus emblemas</Titulo>
              <p className="ves-p">Se eligen mirando tu perfil: tócalos al lado de tu nombre y marca los que quieres que se vean.</p>
              <a className="ves-btn" href={'#/r/' + encodeURIComponent(k)}>Ir a mi perfil</a></section>
          ) : null}
        </div>
      ) : null}

      {sec === 'juego' ? (
        <section className="ves-panel ancha">
          <Titulo>Tu estilo de juego</Titulo>
          <Suspense fallback={<p className="ves-nota">Cargando…</p>}><EstiloJuego dc={dc} Cuadro={Cuadro} Titulo={Titulo} /></Suspense>
        </section>
      ) : null}

      {sec === 'col' ? (
        <div className="ves-col">
          {/* 📊 lo que tienes de todo lo que hay (de la C de la maqueta: Marvel Snap y Steam) */}
          <div className="ves-prog ancha">
            {[[tagsTot, tagsCat, 'TAGs', 'en tus cuatro cartas'], [idsMarcos.length, MARCOS_PASE.length, 'Marcos', 'del Pase premium y de Invita y gana'],
              [insMias.size, insCat.length, 'Insignias', 'de la temporada'], [titulos.filter((x) => titMios.has(x) || yo.dueno).length, titulos.length, 'Títulos', 'del Pase, los drops y más']]
              .filter(([, de]) => de).map(([n, de, et, s]) => (
                <div key={et} className="ves-pr"><b>{n}<small> / {de}</small></b><span>{et}</span><Barra n={n} de={de} /><small>{s}</small></div>
              ))}
          </div>
          <section className="ves-panel ancha">
            <Titulo extra={<span className="ves-de">{pct ? 'el % es cuánta gente de la Liga la tiene' : insMias.size + ' de ' + insCat.length}</span>}>Insignias</Titulo>
            {sel && sel.startsWith('in:') ? (() => {
              const x = insCat.find((i) => i[0] === sel.slice(3));
              return x ? <Ficha o={{ texto: x[1] + ' ' + x[2], desc: x[3], mio: insMias.has(x[0]) }} /> : null;
            })() : null}
            <div className="ves-grid">
              {[...insCat].sort((a, b) => insMias.has(b[0]) - insMias.has(a[0])).map(([id, ic, n]) => (
                <Cuadro key={id} mio={insMias.has(id)} on={sel === 'in:' + id} ic={ic} nombre={n} rar={insMias.has(id) ? 'La tienes' : 'Por ganar'}
                  pie={pct && pct.n ? enPct((pct.de[id] || 0) / pct.n) : ''} onClick={() => setSel('in:' + id)} />
              ))}
            </div>
          </section>
          {titulos.length ? (
            <section className="ves-panel">
              <Titulo extra={<span className="ves-de">{titulos.filter((t) => titMios.has(t) || yo.dueno).length} de {titulos.length}</span>}>Títulos</Titulo>
              <p className="ves-p">Cada uno va en una carta y se pone como su TAG: tócalo para probártelo.</p>
              <div className="ves-grid">
                {titulos.map((t) => {
                  const c = yo.titulo_carta[t];
                  const mio = titMios.has(t) || !!yo.dueno;
                  const en = (CARTAS.find(([x]) => x === c) || [])[1] || '';
                  return <Cuadro key={t} mio={mio} nivel="t1" ic="✨" nombre={t} rar={mio ? 'En tu ' + en : (TIT_DE[(yo.titulo_de || {})[t]] || [0, 'Del Pase'])[1]}
                    onClick={() => {
                      if (!cartas.some(([x]) => x === c)) return;
                      setSec('cartas'); setCarta(c); setRan('tag'); setSel('pase:' + t);
                      probar('tag', 'pase:' + t, (yo.elegidos || {})[c] || 'auto', c);
                    }} />;
                })}
              </div>
            </section>
          ) : null}
          <section className="ves-panel">
            <Titulo extra={<span className="ves-de">{idsMarcos.length} de {MARCOS_PASE.length}</span>}>Marcos</Titulo>
            <p className="ves-p">Del Pase premium y de Invita y gana: tócalo para probártelo en tus cartas.</p>
            <div className="ves-grid">
              {MARCOS_PASE.map(([t, nv]) => {
                const mio = idsMarcos.some((x) => x.split(':')[1] === t);
                return <Cuadro key={t} mio={mio} nombre={'Marco ' + TIER[t]} rar={mio ? 'Lo tienes' : comoSeGana(nv)}
                  onClick={() => { if (sinCartas) return; setSec('cartas'); setRan('marco'); probar('marco', idsMarcos.find((x) => x.split(':')[1] === t) || temp + ':' + t, marcoG); }}>
                  <span className="ves-qi" aria-hidden="true"><i className={'ves-sw ' + t} /></span></Cuadro>;
              })}
            </div>
          </section>
        </div>
      ) : null}

      {/* 💾 la barra de guardar: con cambios, pegada abajo, con tu carta chica para ver lo que pruebas */}
      {nCambios ? (
        <div className="ves-guardar" role="region" aria-label="Cambios sin guardar">
          {sec === 'cartas' && !sinCartas ? <span className="ves-gmini" aria-hidden="true"><CartaViva liga={liga} k={k} cual={carta} ancho={46} piezas={{ tag: el }} marco={marcoVer} /></span> : null}
          <span className="ves-gtx">
            {bloqueado ? <><b>Lo estás probando</b> · todavía no es tuyo: en su ficha dice cómo se gana</>
              : <><b>{nCambios === 1 ? '1 cambio' : nCambios + ' cambios'}</b> sin guardar</>}
          </span>
          <button type="button" className="ves-btn" disabled={!!ocup} onClick={cancelar}>{bloqueado ? 'Volver' : 'Cancelar'}</button>
          {!bloqueado ? <button type="button" className="ves-btn blanco" disabled={!!ocup} onClick={guardar}>{ocup === 'guardar' ? 'Guardando…' : 'Guardar'}</button> : null}
        </div>
      ) : null}
    </div>
  );
}

/** La página: `#/inventario/<carta>/<ranura>` */
export function PaginaInventario({ liga, dc, carta, ranura }) {
  return <Inventario liga={liga} dc={dc} carta0={carta || ''} ranura0={ranura || ''} />;
}
