// El Inicio nuevo (Dlx, 29/09/2026: «1. B. 2. B»): reemplaza al de hoy y convive con el resto de la página, que
// sigue siendo app.js. Lo que sabe hacer la página de hoy —la cuenta, los visores de cartas y llaves, votar— se le
// pide a ella (ver `accion` en piezas.jsx); lo que el Inicio muestra lo lee de sus mismos datos.
import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DUENO, Liga, aQuienSigo, limpio, quienMira } from './liga.js';
import { pedirLigas } from './ligas_datos.js';
import { AvisoPromo, nombrePais } from './piezas.jsx';
import { Cabecera, Hero, Historias, Instalar, IrA, MENU, Tira, gruposHistorias, ordenHistorias } from './arriba.jsx';
import { LosQueMandan, Noticias } from './medio.jsx';
import { Menu, Merch, Pie, Subir, Tabbar, Visor } from './abajo.jsx';
import { Encuestas } from './encuestas.jsx';
import { Lobby } from './lobby.jsx';
import { SemanaComp } from './semana_comp.jsx';
import { MarcoSolo } from './marco_solo.jsx';
// 🧭 el tutorial (Dlx, 12/10/2026, «A … B … C … D … E. Dale»): quién es nuevo se decide al cargar (primera.js, chico);
// lo que se dibuja se baja sólo si hace falta
import { pasosEnInicio, quiereBienvenida, quiereTutorial } from './primera.js';
import { AvisoVersion } from './novedad.jsx';
// 📊 las secciones que se cuentan: la misma lista que `SECC_EV` de bot/avisos.js
const SECC = new Set(['inicio', 'eventos', 'ranking', 'competencias', 'inventario', 'publicaciones', 'tarjetas', 'ligas', 'salon', 'pase', 'tienda', 'socios', 'guia',
  'perfil', 'servidor', 'crew', 'crews', 'pais', 'cuenta', 'cambios',
  'i-historias', 'i-envivo', 'i-semana', 'i-ira', 'i-fechas', 'i-sebusca', 'i-noticias', 'i-encuestas', 'i-raperos',
  'i-panel', 'i-merch', 'i-numeros', 'p-eventos', 'p-ranking', 'p-mw', 'p-tarjetas', 'p-pase', 'p-tienda']);
// 👆 qué bloque del Inicio es cada toque: la puerta por su dirección, lo demás por el bloque que lo contiene
const PUERTA = { '#/eventos': 'p-eventos', '#/ranking': 'p-ranking', '#/ranking/mw': 'p-mw', '#/tarjetas': 'p-tarjetas',
  '#/pase': 'p-pase', '#/tienda': 'p-tienda' };
function queToco(el) {
  if (!el || !el.closest) return '';
  const pu = el.closest('.pu');
  if (pu) return PUERTA[pu.getAttribute('href')] || '';
  if (el.closest('.historias')) return 'i-historias';
  if (el.closest('.ir-a')) return 'i-ira';
  if (el.closest('#semana')) return 'i-semana';
  const s = el.closest('#envivo, #fechas, #sebusca, #noticias, #encuestas, #raperos, #panel, #merch, #numeros');
  if (s) return 'i-' + s.id;
  return el.closest('.escena') ? 'i-envivo' : '';
}
// 👆 QUÉ SE TOCA EN TODA LA PÁGINA (Dlx, 16/10/2026: «asegurate que todo esté trackeado, así vemos qué cosas se
// presionan más»). Cada toque de un botón o un link, en cualquier sección, como «sección:etiqueta»: el texto del botón
// sin números ni emojis, o adónde lleva el link. Se juntan y salen de a tandas (cada 15 s o al irse), así un toque no
// es un pedido. Nunca quién: el Worker sólo suma (`clics()` en bot/avisos.js)
const IR_A = { r: 'perfil', sv: 'servidor', crew: 'crew', pais: 'país', llave: 'llave', evento: 'evento' };
export function etiquetaClic(el) {
  if (!el || !el.getAttribute) return '';
  const dc = el.getAttribute('data-clic');
  if (dc) return dc.slice(0, 40);
  const href = el.getAttribute('href') || '';
  if (href && el.tagName === 'A') {
    if (/^https?:\/\//i.test(href) && !/underlegends\.pages\.dev/i.test(href)) {
      try { return '→ ' + new URL(href).hostname.replace(/^www\./, '').slice(0, 30); } catch (e) { return '→ afuera'; }
    }
    const seg = href.replace(/^https?:\/\/[^/]+/, '').replace(/^\/?#?\/?(freestyle-rap\/)?/, '').split(/[/?#]/)[0];
    return '→ ' + (IR_A[seg] || seg || 'inicio').slice(0, 30);
  }
  const t = String(el.getAttribute('aria-label') || el.textContent || '').replace(/\d+([.,]\d+)*/g, '#')
    // (con `u`, cada punto de c\u00F3digo por separado: el selector de variante y el unidor se van solos, a prop\u00F3sito)
    // eslint-disable-next-line no-misleading-character-class
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\uFE0F\u200D]/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const limpio = t.replace(/[^\p{L}\p{N} #·.,¿?¡!'()/&+_→«»-]/gu, '').trim().slice(0, 40);
  if (limpio && /\p{L}/u.test(limpio)) return limpio;
  const cl = String(el.getAttribute('class') || '').split(/\s+/)[0];
  return cl ? '.' + cl.replace(/[^a-z0-9-]/gi, '').slice(0, 30) : '';
}
const _CLICS = { c: {}, t: null };
function mandarClics() {
  if (_CLICS.t) { clearTimeout(_CLICS.t); _CLICS.t = null; }
  const c = _CLICS.c;
  _CLICS.c = {};
  if (!Object.keys(c).length) return;
  const cuerpo = JSON.stringify({ c });
  try {
    if (navigator.sendBeacon && navigator.sendBeacon('/api/avisos/clics', new Blob([cuerpo], { type: 'application/json' }))) return;
  } catch (e) { /* sin beacon, con fetch */ }
  fetch('/api/avisos/clics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: cuerpo, keepalive: true })
    .catch(() => {});
}
export function contarClic(seccion, el) {
  const e = etiquetaClic(el);
  const s = String(seccion || 'otra').replace(/[^a-z0-9-]/gi, '').toLowerCase().slice(0, 20) || 'otra';
  if (!e) return;
  const k = s + ':' + e;
  if (!_CLICS.c[k] && Object.keys(_CLICS.c).length >= 40) mandarClics();
  _CLICS.c[k] = Math.min(200, (_CLICS.c[k] || 0) + 1);
  if (!_CLICS.t) _CLICS.t = setTimeout(mandarClics, 15000);
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', mandarClics);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') mandarClics(); });
}
/** Anota una vez por día y por navegador (`lg:secc`, como las secciones). Lo que no está en `SECC` no se manda */
function anotarUnaVez(k) {
  // 📊 y la página de cada servidor (`sv-FFA`), para el panel de su dueño (19/10/2026): el objeto sólo acepta los que existen
  if (!SECC.has(k) && !/^sv-[A-Z]{2,6}$/.test(k)) return;
  try {
    const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
    let m = null;
    try { m = JSON.parse(localStorage.getItem('lg:secc') || 'null'); } catch (e) { m = null; }
    if (!m || m.dia !== hoy || !Array.isArray(m.s)) m = { dia: hoy, s: [] };
    if (m.s.includes(k)) return;
    m.s.push(k);
    localStorage.setItem('lg:secc', JSON.stringify(m));
    fetch('/api/avisos/seccion', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ev: k }), keepalive: true }).catch(() => {});
  } catch (e) { /* sin almacenamiento, no se cuenta */ }
}
const Tutorial = lazy(() => import('./tutorial.jsx').then((m) => ({ default: m.Tutorial })));
// 🎮 la pantalla de bienvenida (19/10/2026): se baja sólo para quien llega por primera vez
const Bienvenida = lazy(() => import('./bienvenida.jsx'));
const PrimerosPasos = lazy(() => import('./tutorial.jsx').then((m) => ({ default: m.PrimerosPasos })));
// 🔑 EL RANKING Y EVENTOS, EN SU PROPIO ARCHIVO: se bajan recién al abrirlos. Con los dos adentro, el JS del Inicio
// pasaba de 120 a 133 KB comprimido (02/10/2026), y el Inicio es lo que abre todo el mundo, en el celular
const Ranking = lazy(() => import('./ranking.jsx').then((m) => ({ default: m.Ranking })));
const Eventos = lazy(() => import('./eventos.jsx').then((m) => ({ default: m.Eventos })));
const Publicaciones = lazy(() => import('./publicaciones.jsx').then((m) => ({ default: m.Publicaciones })));
const Socios = lazy(() => import('./socios.jsx').then((m) => ({ default: m.Socios })));
const Guia = lazy(() => import('./guia.jsx').then((m) => ({ default: m.Guia })));
const Tarjetas = lazy(() => import('./tarjetas.jsx').then((m) => ({ default: m.Tarjetas })));
const Perfil = lazy(() => import('./perfil.jsx').then((m) => ({ default: m.Perfil })));
const Llave = lazy(() => import('./llave.jsx').then((m) => ({ default: m.Llave })));
const VisorCarta = lazy(() => import('./visor.jsx').then((m) => ({ default: m.VisorCarta })));
const Tienda = lazy(() => import('./tienda.jsx').then((m) => ({ default: m.Tienda })));
const Pase = lazy(() => import('./pase.jsx').then((m) => ({ default: m.Pase })));
// 🏟️ las Ligas, su propia sección desde el 16/10/2026 (eran una pestaña del Ranking): ver ligas.jsx
const LigasPagina = lazy(() => import('./ligas.jsx').then((m) => ({ default: m.LigasPagina })));
// 🏛️ el Salón de la fama (16/10/2026): ver salon.jsx
const SalonFama = lazy(() => import('./salon.jsx').then((m) => ({ default: m.SalonFama })));
// 🏆 las competencias de la semana (26/10/2026): ver competencias.jsx
const Competencias = lazy(() => import('./competencias.jsx').then((m) => ({ default: m.Competencias })));
// 🎒 el Inventario como página (26/10/2026): ver tags_inv.jsx
const PaginaInventario = lazy(() => import('./tags_inv.jsx').then((m) => ({ default: m.PaginaInventario })));
// 👥 las Crews, su propia sección desde el 19/10/2026 (eran una pestaña del Ranking): ver crewspagina.jsx
const CrewsPagina = lazy(() => import('./crewspagina.jsx').then((m) => ({ default: m.CrewsPagina })));
// 📊 el panel de los socios Tier 1 y 2, para el dueño de cada servidor (19/10/2026): ver socio.jsx
const PanelSocio = lazy(() => import('./socio.jsx').then((m) => ({ default: m.PanelSocio })));
// ⚡ lo que no hace falta para abrir el Inicio va aparte (la pasada del 04/10/2026: el paquete principal pasaba de los
// 130 KB comprimidos que se puso el remake): Mi cuenta, el changelog y la página de cada servidor
const Cuenta = lazy(() => import('./cuenta.jsx').then((m) => ({ default: m.Cuenta })));
// 🔒 el Dashboard del dueño (04/10/2026): perezoso, y la puerta la pone el servidor (ver dashboard.jsx)
const Dashboard = lazy(() => import('./dashboard.jsx').then((m) => ({ default: m.Dashboard })));
// 🏠 y en el Inicio, sólo para Dlx (el mismo archivo: se baja una vez)
const PanelDueno = lazy(() => import('./dashboard.jsx').then((m) => ({ default: m.PanelDueno })));

// 📣 EL AVISO DE LA PÁGINA (el Dashboard de Dlx, 04/10/2026): viaja con `/api/avisos/vivo`, que app.js ya pide al
// abrir y cada pocos minutos (`window.VIVO.aviso`). Cada uno lo puede cerrar; uno nuevo vuelve a aparecer
function avisoDe() {
  const a = window.VIVO && window.VIVO.aviso;
  return a && a.texto && Date.parse(a.hasta) > Date.now() ? a : null;
}
function AvisoWeb({ aviso }) {
  const id = aviso ? aviso.texto + '|' + aviso.hasta : '';
  const [cerrado, setCerrado] = useState(() => { try { return localStorage.getItem('lg:aviso-cerrado') || ''; } catch (e) { return ''; } });
  if (!aviso || cerrado === id) return null;
  const cerrar = () => { setCerrado(id); try { localStorage.setItem('lg:aviso-cerrado', id); } catch (e) { /* igual se cierra */ } };
  return (
    <div className="aviso-web" role="status">
      <p>{aviso.texto}</p>
      <button type="button" aria-label="Cerrar el aviso" onClick={cerrar}>✕</button>
    </div>
  );
}
const PaginaVerificar = lazy(() => import('./cuenta.jsx').then((m) => ({ default: m.PaginaVerificar })));
const Cambios = lazy(() => import('./cambios.jsx').then((m) => ({ default: m.Cambios })));
const PerfilSv = lazy(() => import('./servidor.jsx').then((m) => ({ default: m.PerfilSv })));
const PaginaCrew = lazy(() => import('./grupo.jsx').then((m) => ({ default: m.PaginaCrew })));
const PaginaPais = lazy(() => import('./grupo.jsx').then((m) => ({ default: m.PaginaPais })));
// ⏳ mientras baja una página: la misma barrita que la pantalla de carga (`#lg-carga`), en chico
const Cargando = () => <div className="cargando" role="status"><span>Cargando…</span><i className="cargando-b" aria-hidden="true"><i /></i></div>;
import { VentanaVideo } from './video.jsx';
import { claseTema, guardarTemas, leerTemas } from './temas.js';
import { urlFondo, useFondos } from './fondos.js';
import { useCalma, useTapado } from './anima.js';
// 🐞 los errores de la página, al Dashboard (19/10/2026): los de cada sección y los que no agarra ninguna
import { escucharErrores, reportarError } from './errores.js';

escucharErrores();

// ── el puente con app.js: cada vez que pinta, avisa ──────────────────────────────────────────────
// ⚠️ Las funciones de app.js son globales (script clásico, sin módulo), y adentro se llaman por su nombre: si se
// cambia `window.pintaDatos`, las llamadas de app.js pasan por el cambio. Se envuelven una sola vez.
function envolver(nombre, evento) {
  const f = window[nombre];
  if (typeof f !== 'function' || f.__inicio) return;
  const g = function () {
    const r = f.apply(this, arguments);
    try { window.dispatchEvent(new CustomEvent(evento)); } catch (e) { /* nada */ }
    return r;
  };
  g.__inicio = true;
  window[nombre] = g;
}
envolver('pintaDatos', 'lg:datos');
envolver('pintaEncuestas', 'lg:enc');
envolver('pintaVivo', 'lg:vivo');
envolver('ir', 'lg:ruta');
// 🔴 ENTRAR CON DISCORD TERMINA SOLO: `volverDeDiscord()` guarda la cuenta cuando vuelve un fetch y llama a
// `pintaCuenta()`, sin `ir()` ni datos nuevos. Sin esto el Inicio seguía mostrando «Entrar» (30/09/2026, revisión).
// Y a quién seguís lo guarda siempre `guardarSigo()`.
envolver('pintaCuenta', 'lg:cuenta');
envolver('guardarSigo', 'lg:sigo');
// 👤 Y LO DE MI CUENTA (02/10/2026): la foto, las redes, «tu servidor». app.js vuelve a pintar su ventana después de
// cada cambio —aunque esté cerrada—, así que ése es el aviso. Ver `nuevaCuenta()` en app.js
envolver('pintaPopCuenta', 'lg:cuentaest');
// 💰 Y EL PRECIO POR CABEZA (03/10/2026): el perfil nuevo muestra lo que vale cada cabeza y cómo salió tu precio, que
// viven en app.js (`valorCabezas()`, `PR_EST`, `BILL`); `pintaPrecios()` corre después de cada cambio
envolver('pintaPrecios', 'lg:precios');

// ── el changelog: qué versión habías visto ANTES de abrirlo. app.js la da por vista apenas dibuja el suyo, que sigue
// dibujándose escondido, y lo hace antes que esto. Si la página se abrió en `#/cambios`, ya pasó antes de que cargara
// este módulo: por eso el script del principio de index.html la guarda (`__cambiosVisto`, ver web/montar.py). Si se
// llega navegando, se toma justo antes de que app.js vuelva a pintar el suyo
let cambiosAntes = (() => {
  if (typeof window.__cambiosVisto === 'string') return window.__cambiosVisto;
  try { return JSON.parse(localStorage.getItem('lg:cambios')) || ''; } catch (e) { return ''; }
})();
(function () {
  const f = window.pintaCambios;
  if (typeof f !== 'function' || f.__inicio) return;
  const g = function () {
    if (typeof window.CAMBIOS_VISTO === 'string') cambiosAntes = window.CAMBIOS_VISTO;
    return f.apply(this, arguments);
  };
  g.__inicio = true;
  window.pintaCambios = g;
})();

// las vistas de la página de hoy que ya dibuja el Inicio nuevo: la vieja sigue escondida, de respaldo. La misma lista
// que `PROPIAS` de web/montar.py (el script del principio de index.html). `ranking` desde el 02/10/2026 (Dlx: «me
// encanta»), con `duelos`, el alias viejo que abre el de Duelos; `eventos` desde la 1.93 (Dlx: «sí, publícalo»), con
// `avisos`, el link de la campana, que baja hasta ella; `publicaciones` desde la 1.99 (Dlx, 02/10: «me gusta pero que
// lo de encuestas no sea lo primero que uno vea»); `socios` (lo que era Mundo, y `mundo` lo sigue abriendo) y `guia`
// desde la 2.02 (Dlx, 03/10/2026: «1. A 2. A»); `tarjetas` desde la 2.08 (Dlx, 03/10/2026: «1. A 2. A 3. A»); `r`, el
// perfil de cada rapero, desde la 2.09 (Dlx, 03/10/2026: «1. A 2. A»)
// `llave` desde la 2.10 (Dlx, 03/10/2026: «1. A»): la llave nueva es una página; `tienda` y `pase` desde la 2.12 («A.»)
const PROPIAS = { cambios: 1, ranking: 1, duelos: 1, eventos: 1, avisos: 1, publicaciones: 1, socios: 1, mundo: 1, guia: 1, tarjetas: 1, r: 1, llave: 1,
  tienda: 1, pase: 1, crew: 1, pais: 1 };
const esPropia = (p) => !!PROPIAS[p];
// 🔍 UNA PREVIEW SE PRENDE CON UN LINK: `?prev=sum` deja `lg:prev-sum` en este navegador (y `?noprev=sum` la apaga),
// para que Dlx la pruebe sin tocar la consola. No es un secreto: las previews sólo esconden lo que falta aprobar
try {
  const mp = /[?&]prev=([a-z]{2,12})\b/.exec(location.search);
  const mn = /[?&]noprev=([a-z]{2,12})\b/.exec(location.search);
  if (mp) localStorage.setItem('lg:prev-' + mp[1], '1');
  if (mn) localStorage.removeItem('lg:prev-' + mn[1]);
} catch (e) { /* sin almacenamiento, sin preview */ }
// 🗑️ /sumate se fue el 13/10/2026 (Dlx: «descartado… nosotros elegimos manualmente a qué servidores el bot puede entrar
// y asociarnos»): una dirección vieja a /sumate cae en el Inicio, como cualquier ruta que no existe
// 🎮 el lobby como en los juegos (13/10/2026): con `?prev=lobby` hasta que Dlx lo vio, y desde las 3 AM para todos
// (Dlx: «1. yes»). Las puertas de la 2.87 (`Puertas` de medio.jsx) y Fechas quedan en el código, sin usar

// ── la ruta, siempre como `#/…` aunque la dirección sea /freestyle-rap/… (01/10/2026): la lee `rutaLG()`, del script
// del principio de index.html (web/montar.py). Lo que vuelve de Discord (`#access_token=…`) va tal cual ──
function rutaHash() {
  const h = location.hash || '';
  if (/^#(access_token|error)=/.test(h) || !window.rutaLG) return h;
  return '#/' + window.rutaLG();
}

// ── ¿la ruta es el Inicio? La misma regla que `ir()` de app.js: vacío, `#/` o algo que no es una vista ──
function esInicio() {
  const h = rutaHash();
  if (/^#(access_token|error)=/.test(h)) return true;
  const r = h.replace(/^#\/?/, '').split('?')[0];
  const p = r.split('/')[0];
  if (!p) return true;
  if (esPropia(p)) return true;
  const alias = { avisos: 1, duelos: 1, llave: 1 };
  if (alias[p]) return false;
  return !document.querySelector('section.vista[data-vista="' + p.replace(/"/g, '') + '"]');
}
function marcarRuta() {
  document.documentElement.classList.toggle('ini-nuevo', esInicio() && !window.__inicioSinDatos);
}

// 🔴 CADA SECCIÓN, AISLADA — la regla de `pintaDatos()` de app.js: una que falla (un dato con otra forma) queda
// sin dibujar y el resto del Inicio sale igual. El error queda en la consola con el nombre de la sección.
// ➡️ hacia dónde entra la página que se está montando ('der', 'izq' o '' la primera vez): lo calcula el App en cada
// dibujo (`vaHacia()`) y cada página lo toma UNA vez, al montarse —si lo leyera en cada dibujo, cambiar de pestaña
// adentro de la página le cambiaría la animación y la volvería a correr—
let vaPagina = '';
function vaHacia(previo, clave, i, hondo) {
  if (!previo || previo.k === clave) return previo ? previo.va : '';
  // al menú de más a la derecha, desde la derecha; a algo de adentro (un perfil, una liga), también; al volver, al revés
  if (previo.i === i) return hondo > previo.hondo ? 'der' : hondo < previo.hondo ? 'izq' : 'der';
  if (previo.i < 0 || i < 0) return i < 0 ? 'der' : 'izq';
  return i > previo.i ? 'der' : 'izq';
}

class Aislada extends Component {
  constructor(p) { super(p); this.state = { roto: false }; this.va = vaPagina; }
  static getDerivedStateFromError() { return { roto: true }; }
  componentDidCatch(e) { console.error('[inicio:' + this.props.n + ']', e); reportarError(this.props.n, e); }
  render() {
    // 🎞️ una PÁGINA entra con su transición (`.pg-entra`, vivo.css): como va con `key` por página, cambiar de sección la
    // vuelve a montar y la animación corre de nuevo (Dlx, 17/10/2026: «mejores transiciones, animaciones… tampoco tan
    // exagerado, pero hasta ahora no he visto animaciones»)
    if (!this.state.roto) return this.props.pagina ? <div className={'pg-entra' + (this.va ? ' va-' + this.va : '')}>{this.props.children}</div> : this.props.children;
    // ⚠️ una PÁGINA rota no queda en blanco: dice qué pasó y deja recargar (un pedazo chico, en cambio, se apaga)
    return this.props.pagina ? <section className="sec"><p className="pronto-p">No pude cargar esta parte de la página.{' '}
      <button type="button" className="btn borde2 chico" onClick={() => location.reload()}>Recargar</button></p></section> : null;
  }
}

// si el Inicio entero no puede dibujarse, se vuelve al de la página de hoy, que sigue en el DOM
export class Respaldo extends Component {
  constructor(p) { super(p); this.state = { roto: false }; }
  static getDerivedStateFromError() { return { roto: true }; }
  componentDidCatch(e) {
    console.error('[inicio]', e);
    reportarError('inicio', e);
    window.__inicioSinDatos = true;
    document.documentElement.classList.remove('ini-nuevo');
    // lo viejo vuelve a la vista y hay que dibujarlo: mientras mandaba esto, app.js no lo dibujó (`mandaLoNuevo()`)
    if (window.__pintarViejo) window.__pintarViejo();
  }
  render() { return this.state.roto ? null : this.props.children; }
}

// ¿app.js ya dijo que no pudo cargar? Escribe su aviso en la primera vista (el Inicio de hoy)
function fallaronLosDatos() {
  const v = document.querySelector('main .vista');
  return !!(v && /No pude cargar los datos/.test(v.textContent || ''));
}


// lo que las votaciones necesitan de app.js: los votos, el mío y el estado (guardando, error)
function estadoEnc() {
  const w = window;
  const mio = w.ENC_MIO || {};
  const est = w.ENC_EST || {};
  const cuenta = (id) => (w.cuentaEnc ? w.cuentaEnc(id) : (w.ENC_V || {})[id] || {});
  const pie = (E, nombre) => {
    const e = est[E.id] || {};
    if (e.va) return 'Guardando tu voto…';
    if (e.error) return w.errorEnc ? w.errorEnc(e).replace(/<[^>]+>/g, '') : 'No pude guardar tu voto.';
    if (mio[E.id] && E.op.includes(mio[E.id])) return 'Votaste por ' + nombre(mio[E.id]) + '. Lo puedes cambiar hasta que cierre.';
    return (w.DC ? 'Toca una opción para votar.' : 'Para votar entras con Discord: toca una opción.') + ' Nadie ve a quién votaste.';
  };
  const yoDiscord = w.DC && w.DC.clave ? w.DC.clave : null;
  return { mio, est, cuenta, pie, yoDiscord };
}

export default function App() {
  const [D, setD] = useState(() => window.D || null);
  const [muro, setMuro] = useState(null);
  const [vivoL, setVivoL] = useState(() => window.VIVO_L || null);
  const [aviso, setAviso] = useState(avisoDe);
  const [enc, setEnc] = useState(estadoEnc);
  const [ahora, setAhora] = useState(() => new Date());
  // 🎨 el tema de base (Clara o Noche) y los colores de un servidor encima, o ninguno (13/10/2026): ver temas.js
  const [tema, setTema] = useState(() => leerTemas().base);
  const [temaSv, setTemaSv] = useState(() => leerTemas().sv);
  const [menu, setMenu] = useState(false);
  const [historia, setHistoria] = useState(null);
  // 🃏 la tarjeta abierta (la ventana nueva): la pide cualquier parte con `accion.carta()`, que avisa `lg:carta`
  const [carta, setCarta] = useState(null);
  useEffect(() => {
    const f = (e) => setCarta((e && e.detail) || null);
    window.addEventListener('lg:carta', f);
    return () => window.removeEventListener('lg:carta', f);
  }, []);
  const cerrarCarta = useCallback(() => setCarta(null), []);
  // las historias vistas quedan vistas aunque recargues (Dlx, 30/09: «me gustan todas», la C). 🔴 HISTORIA POR
  // HISTORIA desde el 02/10/2026 (`lg:historias2`: {id de la historia: cuándo}): antes era una marca por círculo
  // (`lg:historias`), y con algo nuevo volvías a ver todo. `null` hasta pasar lo viejo a lo nuevo (ver abajo)
  const [vistos, setVistos] = useState(() => { try { return JSON.parse(localStorage.getItem('lg:historias2')) || null; } catch (e) { return null; } });
  const [yo, setYo] = useState(quienMira);
  // 📖 con «Entrar con Discord», lo visto en las historias va también a tu cuenta (ver `mandarVistas`)
  const yoRef = useRef(null);
  yoRef.current = yo && yo.dc && yo.dc.id ? String(yo.dc.id) : null;
  const [hash, setHash] = useState(rutaHash);
  const [sigoV, setSigoV] = useState(0);
  // 🧭 «Ver el recorrido otra vez» (la Guía) avisa `lg:tour`: cada pedido es un número nuevo
  const [repite, setRepite] = useState(0);
  useEffect(() => {
    const f = () => setRepite((n) => n + 1);
    window.addEventListener('lg:tour', f);
    return () => window.removeEventListener('lg:tour', f);
  }, []);
  const raiz = useRef(null);
  const paso = useRef(null);

  useEffect(() => {
    const datos = () => { setD(window.D || null); setAhora(new Date()); setYo(quienMira()); setEnc(estadoEnc()); marcarRuta(); };
    const votos = () => setEnc(estadoEnc());
    const vivo = () => { setVivoL(Object.assign({}, window.VIVO_L || {})); setAviso(avisoDe()); };
    const ruta = () => { marcarRuta(); setYo(quienMira()); setHash(rutaHash()); };
    const cuenta = () => setYo(quienMira());
    const sigo = () => setSigoV((v) => v + 1);
    // cambiar la hora, la zona o el formato en Ajustes: todo lo que tiene horas se vuelve a dibujar
    const ajustes = () => setAhora(new Date());
    window.addEventListener('lg:ajustes', ajustes);
    window.addEventListener('lg:cuenta', cuenta);
    window.addEventListener('lg:sigo', sigo);
    window.addEventListener('lg:datos', datos);
    window.addEventListener('lg:enc', votos);
    window.addEventListener('lg:vivo', vivo);
    window.addEventListener('lg:ruta', ruta);
    window.addEventListener('hashchange', ruta);
    // `lg:dir`: atrás/adelante y los links `#/…` que ataja el script del principio (la dirección cambia sin recargar)
    window.addEventListener('lg:dir', ruta);
    window.addEventListener('storage', ruta);
    // 🔴 Y LA DIRECCIÓN TAMBIÉN: quien vuelve de Discord vuelve a `/#access_token=…` y app.js la cambia con
    // replaceState (sin hashchange) al destino —`#/cuenta/verificar`—. Si eso pasó entre el primer dibujo y este
    // efecto, el Inicio se quedaba en la dirección vieja (01/10/2026, al probar «Cancelar» en Discord)
    ruta();
    // ⚠️ app.js pudo pintar ENTRE que este módulo envolvió sus funciones y este efecto: el aviso salió sin nadie
    // escuchando. Se lee una vez lo que haya.
    if (window.D) datos();
    if (window.VIVO_L) vivo();
    // si los datos no llegan, se vuelve a la página de hoy: su error («No pude cargar los datos») es el que se ve
    const t0 = Date.now();
    const plazo = setInterval(() => {
      if (window.D) { clearInterval(plazo); return; }
      if (fallaronLosDatos() || Date.now() - t0 > 15000) {
        clearInterval(plazo); window.__inicioSinDatos = true; marcarRuta(); if (window.__pintarViejo) window.__pintarViejo();
      }
    }, 400);
    const reloj = setInterval(() => setAhora(new Date()), 60000);
    return () => {
      window.removeEventListener('lg:datos', datos); window.removeEventListener('lg:enc', votos);
      window.removeEventListener('lg:vivo', vivo); window.removeEventListener('lg:ruta', ruta);
      window.removeEventListener('hashchange', ruta); window.removeEventListener('storage', ruta);
      window.removeEventListener('lg:dir', ruta);
      window.removeEventListener('lg:cuenta', cuenta); window.removeEventListener('lg:sigo', sigo);
      window.removeEventListener('lg:ajustes', ajustes);
      clearInterval(plazo); clearInterval(reloj);
    };
  }, []);

  // 📊 UNA VISITA POR DÍA Y POR NAVEGADOR (Dlx, 04/10/2026: «cuántos están enganchados con el bot y la página»). El
  // navegador recuerda que ya avisó hoy (en hora del este, como todo); el vigía sólo suma un número. Sin almacenamiento
  // no se cuenta: si no, cada recarga sería una visita
  useEffect(() => {
    try {
      const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
      if (localStorage.getItem('lg:visita') === hoy) return;
      localStorage.setItem('lg:visita', hoy);
      fetch('/api/avisos/visita', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', keepalive: true })
        .catch(() => {});
    } catch (e) { /* sin almacenamiento, no se cuenta */ }
  }, []);

  // el muro (Lo último y las historias): lo pide el Inicio, cada 5 minutos con la pestaña a la vista
  useEffect(() => {
    let vivo = true;
    const pedir = () => fetch('/api/muro', { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null)).then((m) => { if (vivo && m) setMuro(m); }).catch(() => {});
    pedir();
    const t = setInterval(() => { if (document.visibilityState === 'visible') pedir(); }, 300000);
    return () => { vivo = false; clearInterval(t); };
  }, []);

  const elegirTema = useCallback((t) => setTema(t), []);
  const elegirSv = useCallback((s) => setTemaSv(s || ''), []);
  // se guardan juntos (y así el valor viejo `sv:FFA`, de la primera versión, queda como Noche + FFA)
  useEffect(() => { guardarTemas(tema, temaSv); }, [tema, temaSv]);
  // los de los servidores son oscuros: la página de afuera va de noche también
  useEffect(() => { document.documentElement.classList.toggle('ini-noche', tema === 'noche'); }, [tema]);
  const cerrarHistoria = useCallback(() => setHistoria(null), []);
  // ⚠️ CON TOPE: cada historia nueva es una clave; quedan las 600 más recientes (el muro trae 80)
  const guardarVistos = (n) => {
    const ks = Object.keys(n);
    if (ks.length > 600) ks.sort((a, b) => n[a] - n[b]).slice(0, ks.length - 600).forEach((k) => delete n[k]);
    try { localStorage.setItem('lg:historias2', JSON.stringify(n)); } catch (e) { /* sin guardar */ }
    return n;
  };
  // 📖 LO VISTO SIGUE A TU CUENTA (Dlx, 18/10/2026: «tengo mi cuenta en muchos dispositivos», y a «¿lo visto sigue a tu
  // cuenta?»: «yes»). Con «Entrar con Discord», cada historia que ves va también a tu cuenta (de a varias, a los pocos
  // segundos o al irte) y al abrir la página se suma lo que viste en los otros dispositivos. Sin cuenta, sólo acá
  const pendientes = useRef(new Set());
  const mandarVistas = useCallback((alIrse) => {
    // de a 30 (la página manda hasta 4 KB por pedido: 120 de 200 letras no entraban) y sin las que no se pueden guardar
    const ids = [...pendientes.current].filter((x) => x.length <= 200).slice(0, 30);
    [...pendientes.current].filter((x) => x.length > 200).forEach((x) => pendientes.current.delete(x));
    if (!ids.length || !yoRef.current) return;
    ids.forEach((x) => pendientes.current.delete(x));
    // si no se pudo (sin red o el servidor caído), vuelven a la cola; si el pedido estaba mal, no se insiste
    const volver = () => ids.forEach((x) => pendientes.current.add(x));
    fetch('/api/avisos/historias', { method: 'POST', keepalive: !!alIrse, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids }) }).then((r) => { if (r.status >= 500) volver(); }).catch(volver);
  }, []);
  const timerVistas = useRef(0);
  const visto = useCallback((id) => setVistos((v) => {
    if (!id || (v && v[id])) return v;
    pendientes.current.add(id);
    clearTimeout(timerVistas.current);
    timerVistas.current = setTimeout(() => mandarVistas(false), 4000);
    return guardarVistos(Object.assign({}, v || {}, { [id]: Date.now() }));
  }), [mandarVistas]);
  // al irse (cambiar de app, cerrar la pestaña), lo que quedó sin mandar
  useEffect(() => {
    const f = () => { if (document.visibilityState === 'hidden') mandarVistas(true); };
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, [mandarVistas]);
  // al abrir con tu cuenta: se suma lo que viste en los otros dispositivos. La primera vez en este dispositivo, sube
  // también lo que ya habías visto acá (las 120 más nuevas)
  const cuentaId = yo && yo.dc && yo.dc.id ? String(yo.dc.id) : '';
  useEffect(() => {
    if (!cuentaId || vistos === null) return undefined;
    let vivo = true;
    let subir = [];
    try {
      if (localStorage.getItem('lg:hv-subido') !== cuentaId) {
        subir = Object.entries(vistos).filter((x) => x[0].length <= 200).sort((a, b) => b[1] - a[1]).slice(0, 30).map((x) => x[0]);
      }
    } catch (e) { subir = []; }
    fetch('/api/avisos/historias', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids: subir }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j || !Array.isArray(j.vistas)) return;
        try { localStorage.setItem('lg:hv-subido', cuentaId); } catch (e) { /* la próxima vez sube de nuevo: no pasa nada */ }
        if (!vivo) return;
        setVistos((v) => {
          const n = Object.assign({}, v || {});
          let cambio = false;
          j.vistas.forEach((x) => { if (Array.isArray(x) && typeof x[0] === 'string' && !n[x[0]]) { n[x[0]] = Number(x[1]) || Date.now(); cambio = true; } });
          return cambio ? guardarVistos(n) : v;
        });
      })
      .catch(() => { /* sin la cuenta, lo de este dispositivo */ });
    return () => { vivo = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuentaId, vistos === null]);

  // 🏟️ LAS LIGAS LLEGAN APARTE (25/10/2026, ver web/src/ligas_datos.js): con cada lobby nuevo se piden una vez y se ponen
  // en `liga.d.ligas`, así quien las lee no cambia. Mientras no llegan, cada sección de ligas se apaga sola
  const [ligasL, setLigasL] = useState(null);
  useEffect(() => {
    if (!D || D.ligas) return undefined;
    let vivo = true;
    pedirLigas(D.sello).then((x) => { if (vivo && x && x.lobby) setLigasL(x.lobby); });
    return () => { vivo = false; };
  }, [D && D.sello]); // eslint-disable-line react-hooks/exhaustive-deps
  const D2 = useMemo(() => (D && !D.ligas && ligasL ? Object.assign({}, D, { ligas: ligasL }) : D), [D, ligasL]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const liga = useMemo(() => (D2 ? new Liga(D2, muro, ahora, yo.k, aQuienSigo()) : null), [D2, muro, ahora, yo, sigoV]);
  // ⏳ con los datos, se va la pantalla de carga del HTML (`#lg-carga`, web/montar.py)
  useEffect(() => { if (liga) document.documentElement.classList.add('lg-listo'); }, [!!liga]);
  // el perfil de un servidor (#/sv/<SIGLA>): app.js no conoce la ruta y la deja en el Inicio, y acá se dibuja el perfil
  const mSv = /^#\/sv\/([^/?#]+)/i.exec(hash || '');
  let sv = null;
  // ⚠️ con try: un `%` suelto en la dirección tiraba URIError y el Inicio entero se caía al de respaldo
  if (mSv) { try { sv = decodeURIComponent(mSv[1]).toUpperCase(); } catch (e) { sv = mSv[1].toUpperCase(); } }
  // 🔤 `/sv/SNK` es Snake Rap: la sigla que se lee abre el mismo perfil que el código (`Liga.codigo()`)
  if (sv && liga) sv = liga.codigo(sv);
  useEffect(() => { if (sv) window.scrollTo(0, 0); }, [sv]);
  const enRanking = /^#\/(ranking|duelos|eventos|publicaciones|socios|mundo|guia|tarjetas|ligas|salon|crews|competencias|inventario)(\/|$|\?)/.test(hash || '');
  useEffect(() => { if (enRanking) window.scrollTo(0, 0); }, [enRanking]);
  // qué página: '' es el Inicio; `cambios` (01/10/2026) la primera que el Inicio nuevo le sacó a la de hoy
  const partes = (hash || '').replace(/^#\/?/, '').split('?')[0].split('/');
  // 🏟️ `#/ranking/ligas[/<id>]` es el link de antes del 16/10/2026 (Publicaciones, las historias, lo compartido): abre
  // la sección nueva, y la dirección pasa a ser la de ahora
  const ligasVieja = partes[0] === 'ranking' && partes[1] === 'ligas';
  if (ligasVieja) partes.splice(0, 2, 'ligas');
  useEffect(() => {
    if (!ligasVieja) return;
    const r = '#/' + partes.join('/');
    try { history.replaceState(history.state, '', window.urlLG ? window.urlLG(r) : r); } catch (e) { /* queda la dirección */ }
  }, [ligasVieja]); // eslint-disable-line react-hooks/exhaustive-deps
  const pagina = /^(access_token|error)=/.test(partes[0] || '') ? '' : (partes[0] || '');
  // la crew de `#/crew/<clave>`, decodificada una vez y con try, como el servidor: un `%` suelto en un link compartido
  // tiraba URIError en el render del App y toda la página nueva caía a la de respaldo (revisión del 04/10/2026)
  let crewId = '';
  if (pagina === 'crew') { const r = partes.slice(1).join('/'); try { crewId = decodeURIComponent(r); } catch (e) { crewId = r; } }
  let ligaId = '';
  if (pagina === 'ligas' && partes[1]) { try { ligaId = decodeURIComponent(partes[1]); } catch (e) { ligaId = partes[1]; } }
  // la del menú: `#/duelos` es el Ranking, y `#/mundo` es Socios
  const paginaMenu = pagina === 'duelos' ? 'ranking' : pagina === 'avisos' ? 'eventos' : pagina === 'mundo' ? 'socios' : pagina;
  // 📊 QUÉ SECCIONES SE ABREN (Dlx, 12/10/2026, el research «página sencilla»: medir antes de mover la tira). Cada
  // sección cuenta UNA vez por día y por navegador (`lg:secc`, en hora del este como la visita) y el vigía sólo suma un
  // número: nunca quién. La lista cerrada es `SECC_EV` de bot/avisos.js; lo que no está ahí no se manda
  const seccion = sv ? 'servidor' : pagina === '' ? 'inicio' : pagina === 'r' ? 'perfil' : paginaMenu;
  useEffect(() => { anotarUnaVez(seccion); if (sv) anotarUnaVez('sv-' + String(sv).toUpperCase()); }, [seccion, sv]);
  // 👆 Y TODO LO QUE SE TOCA, EN CUALQUIER SECCIÓN (16/10/2026): ver `contarClic()`
  useEffect(() => {
    const f = (e) => {
      const t = e.composedPath ? e.composedPath()[0] : e.target;
      const el = t && t.closest ? t.closest('a, button, [role="button"], [role="tab"], summary, select') : null;
      if (el) contarClic(seccion, el);
    };
    window.addEventListener('click', f, true);
    return () => window.removeEventListener('click', f, true);
  }, [seccion]);
  // 👆 los toques del Inicio: sólo lo que se toca (un link, un botón, una burbuja), y sólo en el Inicio
  // ⚠️ en la ventana y no en `raiz`: al montar, el Inicio todavía no está dibujado (espera los datos) y el efecto no
  // vuelve a correr. El toque llega del shadow root, así que lo tocado es `composedPath()[0]`, no `e.target`
  useEffect(() => {
    if (pagina !== '' || sv) return undefined;
    const f = (e) => {
      const t = e.composedPath ? e.composedPath()[0] : e.target;
      const el = t && t.closest ? t.closest('a, button, [role="button"], summary, .h') : null;
      if (el) anotarUnaVez(queToco(el));
    };
    window.addEventListener('click', f, true);
    return () => window.removeEventListener('click', f, true);
  }, [pagina, sv]);
  // 🔑 EL TÍTULO DE LA PESTAÑA de lo que dibuja esta app y app.js no conoce: app.js lo pone con el <h1> de su vista
  // vieja, así que /mundo decía «El mundo» abriendo Socios, y Socios, Sumate, cada servidor, Mi cuenta y Ajustes
  // quedaban con el genérico (recorrido del 03/10/2026). Corre después de `ir()` de app.js, así que gana
  const nombreSv = sv && liga && liga.svs[sv] ? liga.svs[sv].nombre || sv : sv;
  // ⚠️ también cuando llegan los datos (`liga`), y un instante después: app.js vuelve a poner el suyo al pintarlos
  useEffect(() => {
    const crewT = pagina === 'crew' && liga ? (liga.d.crews || []).find((c) => (c.clave || c.crew) === crewId) : null;
    const t = sv ? nombreSv : pagina === 'socios' || pagina === 'mundo' ? 'Socios'
      : pagina === 'tarjetas' ? 'Tarjetas'
      : pagina === 'salon' ? 'Salón de la fama'
      : pagina === 'competencias' ? ({ mini: 'Mini eventos', ligas: 'Las ligas' }[partes[1]] || 'Competencias')
      : pagina === 'crews' ? 'Crews'
      : pagina === 'inventario' ? 'Inventario'
      : pagina === 'socio' ? 'Panel de tu servidor'
      : pagina === 'ligas' ? ({ superliga: 'Superliga', clausura: 'Clausura' }[ligaId] || (ligaId && liga && (liga.ligas().find((x) => x.id === ligaId) || {}).n) || 'Ligas')
      : crewT ? limpio(crewT.crew)
      : pagina === 'pais' && liga && (liga.d.tabla || []).some((f) => String(f.cc).toLowerCase() === String(partes[1]).toLowerCase())
        ? nombrePais(String(partes[1]).toLowerCase())
      : pagina === 'cuenta' || pagina === 'ajustes' ? 'Tu cuenta' : pagina === 'dashboard' ? 'Dashboard' : '';
    if (!t) return undefined;
    const poner = () => { document.title = t + ' · Liga Global de Freestyle'; };
    poner();
    const r = setTimeout(poner, 0);
    return () => clearTimeout(r);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, sv, nombreSv, liga, hash]);
  // ⚠️ fuera de las secciones aisladas: si armar las historias fallaba, se caía el Inicio entero al de respaldo
  const gruposBase = useMemo(() => {
    if (!liga) return [];
    try { return gruposHistorias(liga); } catch (e) { console.error('[inicio] las historias:', e); return []; }
  }, [liga]);
  // 🔁 lo ya visto al final de la fila, como Instagram (Dlx, 04/10/2026): con la foto de lo visto de cuando el visor
  // estaba CERRADO, para que los círculos no se corran mientras mirás (el visor sigue al suyo por su ID igual)
  const [vistosFila, setVistosFila] = useState(vistos);
  useEffect(() => { if (historia === null) setVistosFila(vistos); }, [historia, vistos]);
  const grupos = useMemo(() => ordenHistorias(gruposBase, vistosFila || {}), [gruposBase, vistosFila]);
  // 🔗 UNA HISTORIA POR SU LINK (`/freestyle-rap/?h=<id>`, el «Compartir» del visor; Dlx, 18/10/2026, a las ideas de
  // historias: «todas»): abre el visor en esa historia, una sola vez, y saca el `?h=` de la dirección (recargar no la
  // vuelve a abrir). Si ya no está, queda el Inicio
  const hLink = (() => { try { return new URLSearchParams((hash || '').split('?')[1] || '').get('h') || ''; } catch (e) { return ''; } })();
  const hUsado = useRef('');
  const [desde, setDesde] = useState('');
  // 🔴 ESPERA AL MURO (pasada del 19/10/2026): casi todas las historias que se comparten salen del muro, que llega después
  // del lobby; el link se gastaba con los círculos de los servidores y no abría nada. Si en 8 s no aparece, se deja
  const [hTarde, setHTarde] = useState(false);
  useEffect(() => {
    if (!hLink) return undefined;
    const t = setTimeout(() => setHTarde(true), 8000);
    return () => clearTimeout(t);
  }, [hLink]);
  useEffect(() => {
    if (!hLink || hUsado.current === hLink || !grupos.length) return;
    const i = grupos.findIndex((g) => g.slides.some((s) => s.id === hLink));
    if (i < 0 && muro === null && !hTarde) return;
    hUsado.current = hLink;
    try { history.replaceState(history.state, '', window.urlLG ? window.urlLG('#/' + partes.join('/')) : '#/' + partes.join('/')); } catch (e) { /* queda */ }
    if (i >= 0) { setDesde(hLink); setHistoria(i); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hLink, grupos, muro, hTarde]);
  // lo que ya habías visto con la marca vieja (una por círculo) pasa una vez a la nueva, así nadie vuelve a ver todo
  useEffect(() => {
    if (vistos !== null || !grupos.length) return;
    let viejo = {};
    try { viejo = JSON.parse(localStorage.getItem('lg:historias')) || {}; } catch (e) { viejo = {}; }
    const n = {};
    const t0 = Date.now();
    grupos.forEach((g) => {
      const v = String(viejo[g.id] || '');
      if (v) g.slides.forEach((s) => { if (v === g.firma || (/^\d/.test(v) && s.t && s.t <= v)) n[s.id] = t0; });
    });
    setVistos(guardarVistos(n));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vistos, grupos]);

  // 🖼️ tu fondo, de fondo de tu propia página, si lo elegiste y está aprobado (13/10/2026). Antes del `return` de abajo:
  // un hook después de un return condicional cambia la cuenta de hooks
  const fondosAp = useFondos();
  const fYo = liga && liga.yo && fondosAp ? fondosAp[liga.yo.k] : null;
  const miFondo = fYo && fYo[2] ? urlFondo(fYo[0]) : '';
  // 🧘 «Menos animaciones», a la raíz: el CSS de la página vive acá adentro y no ve la clase de <html> (anima.js)
  const calma = (useCalma() ? ' calma' : '') + (useTapado() ? ' tapado' : '');
  // ➡️ de dónde a dónde: el orden del menú, y «más hondo» si es algo de adentro (`#/ligas/<id>`, `#/r/<clave>`)
  const iMenu = MENU.findIndex(([, h2]) => h2 === '#/' + paginaMenu);
  const hondo = paginaMenu === 'ranking' ? 0 : partes.slice(1).filter(Boolean).length;
  const claveVa = paginaMenu + (hondo ? '/' + partes.slice(1).join('/') : '');
  const va = vaHacia(paso.current, claveVa, iMenu, hondo);
  if (!paso.current || paso.current.k !== claveVa) paso.current = { k: claveVa, i: iMenu, hondo, va };
  vaPagina = va;
  if (!liga) return <div className={'app ' + claseTema(tema, temaSv) + calma}><div className="barra-ul" /><div className="cargando">Cargando la Liga…</div></div>;
  // 🖼️ la carta sola con su marco, para la foto de `bot/con_marco.py`: nada alrededor (ver marco_solo.jsx)
  if (pagina === 'marco' && partes[1] && partes[2]) {
    return <div className="app solo-marco"><MarcoSolo liga={liga} k={partes[1]} cual={partes[2]} sv={partes[3] || ''} cc={(partes[4] || '').toLowerCase()} /></div>;
  }
  return (
    <div className={'app ' + claseTema(tema, temaSv) + calma + (miFondo ? ' con-fondo' : '')} ref={raiz} style={miFondo ? { '--mi-fondo': miFondo } : undefined}>
      {/* ♿ «saltar al contenido» (04/10/2026, de la lista de Dlx): no se ve hasta que se llega con el teclado, y salta
          el menú de arriba. Lleva el foco, no sólo la vista: si no, el próximo Tab volvía al menú */}
      <a className="saltar" href="#contenido" onClick={(e) => {
        const r = raiz.current && raiz.current.getRootNode();
        const el = r && r.getElementById && r.getElementById('contenido');
        if (!el) return;
        e.preventDefault(); el.focus(); el.scrollIntoView({ block: 'start' });
      }}>Saltar al contenido</a>
      <div className="barra-ul" />
      <Aislada n="Cabecera"><Cabecera liga={liga} dc={yo.dc} pagina={paginaMenu} onMenu={() => setMenu(true)} /></Aislada>
      <Aislada n="AvisoWeb"><AvisoWeb aviso={aviso} /></Aislada>
      {/* 🆕 «hay una actualización» (13/10/2026): ver web/src/novedad.jsx */}
      <Aislada n="AvisoVersion"><AvisoVersion pagina={pagina} /></Aislada>
      {quiereBienvenida(yo.dc) ? <Aislada n="Bienvenida"><Suspense fallback={null}><Bienvenida liga={liga} dc={yo.dc} /></Suspense></Aislada> : null}
      {quiereTutorial() || repite ? <Aislada n="Tutorial"><Suspense fallback={null}><Tutorial liga={liga} dc={yo.dc} pagina={paginaMenu} sv={sv} repite={repite} /></Suspense></Aislada> : null}
      <span id="contenido" tabIndex={-1} />
      {sv ? <Aislada key="PerfilSv" n="PerfilSv" pagina><Suspense fallback={<Cargando />}><PerfilSv liga={liga} sv={sv} enc={enc} /></Suspense></Aislada>
        : pagina === 'cambios' ? <Aislada key="Cambios" n="Cambios" pagina><Suspense fallback={<Cargando />}><Cambios liga={liga} ver={partes[1] || null} antes={cambiosAntes} /></Suspense></Aislada>
        : pagina === 'socios' || pagina === 'mundo' ? <Aislada key="Socios" n="Socios" pagina><Suspense fallback={<Cargando />}><Socios liga={liga} /></Suspense></Aislada>
        : pagina === 'llave' && partes[1] ? <Aislada key="Llave" n="Llave" pagina><Suspense fallback={<Cargando />}><Llave liga={liga} vivoL={vivoL} n={partes.slice(1).join('/')} raiz={raiz} dc={yo.dc} /></Suspense></Aislada>
        : pagina === 'tienda' ? <Aislada key="Tienda" n="Tienda" pagina><Suspense fallback={<Cargando />}><Tienda liga={liga} dc={yo.dc} /></Suspense></Aislada>
        : pagina === 'pase' ? <Aislada key="Pase" n="Pase" pagina><Suspense fallback={<Cargando />}><Pase liga={liga} dc={yo.dc} /></Suspense></Aislada>
        : pagina === 'crew' && partes[1] ? <Aislada key={'Crew' + partes[1]} n="Crew" pagina><Suspense fallback={<Cargando />}><PaginaCrew liga={liga} id={crewId} /></Suspense></Aislada>
        : pagina === 'pais' && partes[1] ? <Aislada key={'Pais' + partes[1]} n="Pais" pagina><Suspense fallback={<Cargando />}><PaginaPais liga={liga} cc={partes[1]} /></Suspense></Aislada>
        : pagina === 'r' && partes[1] ? <Aislada key="Perfil" n="Perfil" pagina><Suspense fallback={<Cargando />}><Perfil liga={liga} dc={yo.dc} k={partes[1]} tab={partes[2] || ''} /></Suspense></Aislada>
        : pagina === 'salon' ? <Aislada key="Salon" n="Salon" pagina><Suspense fallback={<Cargando />}><SalonFama liga={liga} enc={enc} /></Suspense></Aislada>
        : pagina === 'competencias' ? <Aislada key="Competencias" n="Competencias" pagina><Suspense fallback={<Cargando />}><Competencias liga={liga} dc={yo.dc} sub={partes[1] || ''} /></Suspense></Aislada>
        : pagina === 'inventario' ? <Aislada key="Inventario" n="Inventario" pagina><Suspense fallback={<Cargando />}><PaginaInventario liga={liga} dc={yo.dc} carta={partes[1] || ''} ranura={partes[2] || ''} /></Suspense></Aislada>
        : pagina === 'crews' ? <Aislada key="Crews" n="Crews" pagina><Suspense fallback={<Cargando />}><CrewsPagina liga={liga} dc={yo.dc} qs={(hash || '').split('?')[1] || ''} /></Suspense></Aislada>
        : pagina === 'socio' ? <Aislada key="Socio" n="Socio" pagina><Suspense fallback={<Cargando />}><PanelSocio liga={liga} q={(hash || '').split('?')[1] || ''} /></Suspense></Aislada>
        : pagina === 'ligas' ? <Aislada key="Ligas" n="Ligas" pagina><Suspense fallback={<Cargando />}><LigasPagina liga={liga} id={ligaId} /></Suspense></Aislada>
        : pagina === 'tarjetas' ? <Aislada key="Tarjetas" n="Tarjetas" pagina><Suspense fallback={<Cargando />}><Tarjetas liga={liga} dc={yo.dc} tipo={partes[1] || ''} q={(hash || '').split('?')[1] || ''} /></Suspense></Aislada>
        : pagina === 'guia' ? <Aislada key="Guia" n="Guia" pagina><Suspense fallback={<Cargando />}><Guia liga={liga} dc={yo.dc} /></Suspense></Aislada>
        : pagina === 'publicaciones' ? <Aislada key="Publicaciones" n="Publicaciones" pagina><Suspense fallback={<Cargando />}><Publicaciones liga={liga} enc={enc} /></Suspense></Aislada>
        : pagina === 'eventos' || pagina === 'avisos' ? <Aislada key="Eventos" n="Eventos" pagina><Suspense fallback={<Cargando />}><Eventos liga={liga} vivoL={vivoL} dia={pagina === 'eventos' ? partes[1] || null : null} avisos={pagina === 'avisos'} /></Suspense></Aislada>
        // el Ranking (02/10/2026); `#/duelos` es el link viejo del de Duelos
        : pagina === 'ranking' || pagina === 'duelos' ? <Aislada key="Ranking" n="Ranking" pagina><Suspense fallback={<Cargando />}><Ranking liga={liga} sub={pagina === 'duelos' ? 'duelos' : partes[1] || 'temporada'} ver={partes[2] || ''} dc={yo.dc} raiz={raiz} /></Suspense></Aislada>
        // verificarse desde la página (01/10/2026), y Mi cuenta entera desde el 02/10 (Dlx: «me gusta cómo lo propusiste»)
        : pagina === 'cuenta' && partes[1] === 'verificar' ? <Aislada key="Verificar" n="Verificar" pagina><Suspense fallback={<Cargando />}><PaginaVerificar liga={liga} dc={yo.dc} /></Suspense></Aislada>
        : pagina === 'dashboard' ? <Aislada key="Dashboard" n="Dashboard" pagina><Suspense fallback={<Cargando />}><Dashboard dc={yo.dc} liga={liga} /></Suspense></Aislada>
        : pagina === 'cuenta' ? <Aislada key="Cuenta" n="Cuenta" pagina><Suspense fallback={<Cargando />}><Cuenta liga={liga} dc={yo.dc} parte={partes[1] || null} tema={tema} onTema={elegirTema} temaSv={temaSv} onTemaSv={elegirSv} /></Suspense></Aislada>
        : pagina === 'ajustes' ? <Aislada key="Ajustes" n="Ajustes" pagina><Suspense fallback={<Cargando />}><Cuenta liga={liga} dc={yo.dc} parte={partes[1] || null} tema={tema} onTema={elegirTema} temaSv={temaSv} onTemaSv={elegirSv} /></Suspense></Aislada> : <div className={'pg-entra' + (va ? ' va-' + va : '')} key="inicio">
        {/* 🏠 el Dashboard, sólo para Dlx: si la cuenta del navegador no es la suya ni se baja (la puerta igual es el servidor) */}
        {yo.dc && String(yo.dc.id) === DUENO ? <Aislada n="PanelDueno"><Suspense fallback={null}><PanelDueno liga={liga} /></Suspense></Aislada> : null}
        <Aislada n="Historias"><Historias liga={liga} grupos={grupos} vistos={vistos || {}} onAbrir={setHistoria} /></Aislada>
        <Aislada n="Hero"><Hero liga={liga} vivoL={vivoL}><Aislada n="Tira"><Tira liga={liga} /></Aislada></Hero></Aislada>
        {/* 🏆 la semana: en qué vas en cada competencia (26/10/2026, Dlx: «me gustan… las posiciones de los mini eventos»,
            y el Inicio, como está). Se apaga sola sin datos */}
        <Aislada n="SemanaComp"><SemanaComp liga={liga} dc={yo.dc} /></Aislada>
        {pasosEnInicio(yo.dc) ? <Aislada n="PrimerosPasos"><Suspense fallback={null}><PrimerosPasos liga={liga} dc={yo.dc} /></Suspense></Aislada> : null}
        {/* 🚪 EL INICIO ES UN LOBBY (Dlx, 13/10/2026: «que se sienta como un inicio, un home, un lobby»): el escenario,
            las puertas, y después todo lo de antes. ⚠️ NO SE SACA NADA SIN NÚMEROS (Dlx, el mismo día, al ver el Inicio
            de seis bloques: «enfoquémonos en cambiar, mejorar o mover; remover, al último de la lista»): volvieron los
            cinco, Se busca subió (le gusta en el Inicio) y Encuestas se achicó. Qué se toca acá lo cuenta `TOQUES` */}
        <Aislada n="IrA"><IrA raiz={raiz} /></Aislada>
        <Aislada n="Lobby"><Lobby liga={liga} dc={yo.dc} /></Aislada>
        <Aislada n="Instalar"><Instalar /></Aislada>
        {/* 🎮 con el lobby, cada dato una vez (Dlx, 13/10/2026, «3. A» y «4. A»): tu próximo evento va en el botón y la
            semana en la puerta de Eventos, y Se busca es el destacado amarillo; el tablero entero sigue en el Ranking.
            Por eso Fechas y el panel de Se busca ya no van acá. Y tampoco el panel de Misiones y el Pase (Dlx, 13/10/2026:
            «hay uno de panel pero abajo hay misiones y el pase de rapero… quita esa parte de abajo»): el Pase ya es una
            puerta y está en tu barra, y las Misiones viven en el Ranking. `Panel` de medio.jsx queda, sin usar */}
        <Aislada n="Noticias"><Noticias liga={liga} raiz={raiz} /></Aislada>
        <Aislada n="Encuestas"><Encuestas liga={liga} enc={enc} dc={yo.dc} corta /></Aislada>
        <Aislada n="LosQueMandan"><LosQueMandan liga={liga} dc={yo.dc} /></Aislada>
        <Aislada n="Merch"><Merch liga={liga} /></Aislada>
        {/* 📊 La Liga en números ya no va en el Inicio (Dlx, 13/10/2026: «QUITA LA liga en numeros de inicio»): vive en
            Socios, que es donde estaba desde la 2.87 además de acá */}
      </div>}
      <Aislada n="Pie"><Pie liga={liga} /></Aislada>
      <Aislada n="Tabbar"><Tabbar liga={liga} dc={yo.dc} pagina={paginaMenu} /></Aislada>
      {pagina && !sv ? <Aislada n="Subir"><Subir key={paginaMenu} /></Aislada> : null}
      <Aislada n="Menu"><Menu liga={liga} abierto={menu} onCerrar={() => setMenu(false)} tema={tema} onTema={elegirTema} temaSv={temaSv} /></Aislada>
      {historia !== null ? <Aislada n="Visor"><Visor liga={liga} grupos={grupos} abierto={historia} onCerrar={() => { setDesde(''); cerrarHistoria(); }} onVisto={visto} vistos={vistos || {}} raiz={raiz} desde={desde} /></Aislada> : null}
      <Aislada n="Video"><VentanaVideo /></Aislada>
      <Aislada n="AvisoPromo"><AvisoPromo /></Aislada>
      {carta ? <Aislada key={'c' + carta} n="VisorCarta"><Suspense fallback={null}><VisorCarta liga={liga} dc={yo.dc} k={String(carta).split('|')[0]} inicial={String(carta).split('|')[1] || ''} onCerrar={cerrarCarta} /></Suspense></Aislada> : null}
    </div>
  );
}
