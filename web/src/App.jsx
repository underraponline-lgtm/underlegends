// La página (Dlx, 29/09/2026: «1. B. 2. B»). Nació como el Inicio nuevo, al lado de la página de hoy (`app.js`), y se
// fue quedando con todas las vistas; el 27/10/2026 app.js se borró (la tanda 4). La cañería —los datos, la cuenta,
// votar, la Tienda— sigue en scripts clásicos (bot/paginas/comun, cuenta, tienda, social, datos y nucleo.js): esto
// la lee de `window` y se entera de cada cambio envolviendo sus funciones (ver `envolver()`).
import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DUENO, Liga, aQuienSigo, limpio, quienMira } from './liga.js';
import { pedirLigas } from './ligas_datos.js';
import { BatallasAhora } from './ligas_ahora.jsx';
import { pedirCalendario, juntarCalendario } from './calendario_datos.js';
import { AvisoPromo, nombrePais } from './piezas.jsx';
import { Cabecera, EscenarioPrueba, Hero, Historias, Instalar, IrA, MENU, Tira, gruposHistorias, ordenHistorias } from './arriba.jsx';
import { LosQueMandan, Noticias } from './medio.jsx';
import { Menu, Merch, Pie, Subir, Tabbar, Visor } from './abajo.jsx';
import { Lobby } from './lobby.jsx';
import { PistaNuevos } from './nuevos.jsx';
// (SemanaComp, de semana_comp.jsx, ya no va en el Inicio: la reemplaza PnSemana del panel)
import { MarcoSolo } from './marco_solo.jsx';
// 🧭 el tutorial (Dlx, 12/10/2026, «A … B … C … D … E. Dale»): quién es nuevo se decide al cargar (primera.js, chico);
// lo que se dibuja se baja sólo si hace falta
import { irSinHistoria, pasosEnInicio, quiereBienvenida, quiereTutorial } from './primera.js';
import { ComoFunciona } from './comofunciona.jsx';
import { AvisoVersion } from './novedad.jsx';
import { PopTuVideo } from './tu_video.jsx';
import { FranjaMods } from './mods.jsx';
import { BotonModsFlot } from './mods_herramientas.jsx';
import { vistaMods } from './mods.js';
import { FichaHover } from './ficha.jsx';
import { pedirPrueba, prevElo } from './prueba_elo.js';
// 📊 las secciones que se cuentan: la misma lista que `SECC_EV` de bot/avisos.js
const SECC = new Set(['inicio', 'eventos', 'ranking', 'reels', 'competencias', 'inventario', 'publicaciones', 'tarjetas', 'ligas', 'salon', 'pase', 'tienda', 'invitar', 'socios', 'guia',
  'perfil', 'servidor', 'crew', 'crews', 'pais', 'cuenta', 'cambios',
  'i-historias', 'i-reels', 'i-envivo', 'i-semana', 'i-ira', 'i-fechas', 'i-sebusca', 'i-noticias', 'i-encuestas', 'i-raperos',
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
  const s = el.closest('#envivo, #reels, #fechas, #sebusca, #noticias, #encuestas, #raperos, #panel, #merch, #numeros');
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
/** 🙈 ¿Es el navegador de Dlx? Por su cuenta guardada (`lg:dc`) y no por `quienMira()`: la lente de Mods no lo cambia */
function esDuenoAca() {
  try { return String((JSON.parse(localStorage.getItem('lg:dc') || 'null') || {}).id || '') === DUENO; } catch (e) { return false; }
}
//: 👀 cada cuántos minutos avisa la pestaña que sigue abierta (`AQUI_MIN` de bot/avisos.js)
const AQUI_MIN = 4;
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
// 🛠️ EL REMAKE DE LAS PÁGINAS QUE FALTABAN (Dlx, 02/11/2026: «terminar de remakear las restantes»): las nuevas viven
// en `<página>2.jsx`. Estuvieron unas horas detrás de `?prev=remake` y salieron para todos el mismo día (Dlx: «Publica y
// haz todo… sube todo»; sus opiniones, después). Las viejas se borraron; lo que otras páginas les pedían prestado quedó
// en publicaciones.jsx, guia.jsx y servidor.jsx
// 📦 LAS PÁGINAS SE PRECARGAN, SIN CORRERLAS (16/11/2026, ver version.js). Con el nombre de cada pedazo cambiando en cada
// versión, la lista sale del build: `inicio/trozos.json` (lo escribe web/vite.config.js), y la pide la pantalla de carga
// cuando la página ya entró (`window.__lgPrecargar`, web/montar.py). Se BAJAN con `modulepreload`, como antes de la 5.67:
// la 5.67 las importaba, y eso CORRÍA las 21 páginas al entrar —cada una mete su CSS y su código arriba de todo—, un pico
// de trabajo justo al abrir el Inicio (Dlx, esa noche: «el inicio se mueve rapidísimo»). No van el Dashboard, el panel
// del socio ni verificarse: son de pocos (la lista ya viene sin ellos)
const pag = (f) => lazy(f);

/** 🔗 El canal del link por el que se llegó (`?de=urbanstreet` o `?utm_source=…`), o `''`. La misma regla que `CANAL` de
 *  bot/avisos.js: minúsculas, números y guiones, de 2 a 30 */
export function canalDe(busqueda) {
  try {
    const q = new URLSearchParams(busqueda || '');
    const c = String(q.get('de') || q.get('utm_source') || '').trim().toLowerCase();
    return /^[a-z0-9][a-z0-9-]{1,29}$/.test(c) ? c : '';
  } catch (e) { return ''; }
}
if (typeof window !== 'undefined') {
  window.__lgPrecargar = () => {
    try { const cx = navigator.connection; if (cx && (cx.saveData || /2g/.test(cx.effectiveType || ''))) return; } catch (e) { /* sigue */ }
    fetch('/inicio/trozos.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : [])).then((ps) => {
      (Array.isArray(ps) ? ps : []).forEach((f) => {
        if (!/^inicio-[\w.-]+\.js$/.test(f) || document.head.querySelector('link[href="/inicio/' + f + '"]')) return;
        const l = document.createElement('link'); l.rel = 'modulepreload'; l.href = '/inicio/' + f; document.head.appendChild(l);
      });
    }).catch(() => { /* sin la lista, cada página baja al abrirla */ });
  };
}
const Tutorial = pag(() => import('./tutorial.jsx').then((m) => ({ default: m.Tutorial })));
// 🎮 la pantalla de bienvenida (19/10/2026): se baja sólo para quien llega por primera vez
const Bienvenida = pag(() => import('./bienvenida.jsx'));
const PrimerosPasos = pag(() => import('./tutorial.jsx').then((m) => ({ default: m.PrimerosPasos })));
// 🔑 EL RANKING Y EVENTOS, EN SU PROPIO ARCHIVO: se bajan recién al abrirlos. Con los dos adentro, el JS del Inicio
// pasaba de 120 a 133 KB comprimido (02/10/2026), y el Inicio es lo que abre todo el mundo, en el celular
const Ranking = pag(() => import('./ranking.jsx').then((m) => ({ default: m.Ranking })));
const Eventos = pag(() => import('./eventos.jsx').then((m) => ({ default: m.Eventos })));
const Publicaciones = pag(() => import('./publicaciones2.jsx').then((m) => ({ default: m.Publicaciones })));
// 💬 la hoja de comentarios de una publicación, encima de cualquier página (21/11/2026): ver `HojaComentarios`
const HojaComentarios = pag(() => import('./publicaciones2.jsx').then((m) => ({ default: m.HojaComentarios })));
const Socios = pag(() => import('./socios2.jsx').then((m) => ({ default: m.Socios })));
// 🏟️ «Suma tu servidor» (19/11/2026): la página para el dueño de un servidor, dentro de Socios (`#/socios/sumar`)
const SumaTuServidor = pag(() => import('./sumar2.jsx').then((m) => ({ default: m.SumaTuServidor })));
const Guia = pag(() => import('./guia2.jsx').then((m) => ({ default: m.Guia })));
const Tarjetas = pag(() => import('./tarjetas.jsx').then((m) => ({ default: m.Tarjetas })));
const Perfil = pag(() => import('./perfil.jsx').then((m) => ({ default: m.Perfil })));
// 🪪 el perfil de cada uno del Ranking global (24/11/2026, `#/global/<clave>`): la interfaz del perfil de la Liga (perfil_global.jsx)
const PerfilGlobal = pag(() => import('./perfil_global.jsx').then((m) => ({ default: m.PerfilGlobal })));
// 🏆 y la de cada competencia (24/11/2026, `#/competencia/<clave>`): FMS, Red Bull, God Level… con la misma interfaz
const PaginaCompetencia = pag(() => import('./perfil_global.jsx').then((m) => ({ default: m.PaginaCompetencia })));
const Llave = pag(() => import('./llave.jsx').then((m) => ({ default: m.Llave })));
const VisorCarta = pag(() => import('./visor.jsx').then((m) => ({ default: m.VisorCarta })));
const Tienda = pag(() => import('./tienda2.jsx').then((m) => ({ default: m.Tienda })));
// 🎁 Invita y gana (17/11/2026): tu link de referido, el track y quién te invitó. Ver invitar.jsx y referidos.js
const Invitar = pag(() => import('./invitar.jsx').then((m) => ({ default: m.Invitar })));
// 🎬 Reels (24/11/2026): los shorts de las batallas, a pantalla completa en el celular. Ver reels.jsx
const Reels = pag(() => import('./reels.jsx').then((m) => ({ default: m.Reels })));
// y su fila en el Inicio, «Reels de la semana» (reels_fila.jsx): aparte, para que el Inicio no baje la página entera
const ReelsFila = pag(() => import('./reels_fila.jsx').then((m) => ({ default: m.ReelsFila })));
// 🖼️ y la miniatura de un link corto, para la foto de bot/og_links.py (og_link.jsx): sin nada alrededor, como la del marco
const OgLink = pag(() => import('./og_link.jsx').then((m) => ({ default: m.OgLink })));
const Pase = pag(() => import('./pase.jsx').then((m) => ({ default: m.Pase })));
// 🏟️ las Ligas, su propia sección desde el 16/10/2026 (eran una pestaña del Ranking): ver ligas.jsx
const LigasPagina = pag(() => import('./ligas.jsx').then((m) => ({ default: m.LigasPagina })));
// 🏛️ el Salón de la fama (16/10/2026): ver salon2.jsx
const SalonFama = pag(() => import('./salon2.jsx').then((m) => ({ default: m.SalonFama })));
// 🏆 las competencias de la semana (26/10/2026): ver competencias.jsx
const Competencias = pag(() => import('./competencias.jsx').then((m) => ({ default: m.Competencias })));
// 🎒 el Inventario como página (26/10/2026): ver tags_inv.jsx
const PaginaInventario = pag(() => import('./tags_inv.jsx').then((m) => ({ default: m.PaginaInventario })));
// 👥 las Crews, su propia sección desde el 19/10/2026 (eran una pestaña del Ranking): ver crewspagina.jsx
const CrewsPagina = pag(() => import('./crewspagina.jsx').then((m) => ({ default: m.CrewsPagina })));
// 📊 el panel de los socios, para el dueño de cada servidor (19/10/2026; el remake del 02/11, en socio2.jsx)
const PanelSocio = lazy(() => import('./socio2.jsx').then((m) => ({ default: m.PanelSocio })));
// ⚡ lo que no hace falta para abrir el Inicio va aparte (la pasada del 04/10/2026: el paquete principal pasaba de los
// 130 KB comprimidos que se puso el remake): Mi cuenta, el changelog y la página de cada servidor
const Cuenta = pag(() => import('./cuenta.jsx').then((m) => ({ default: m.Cuenta })));
// 🔒 el Dashboard del dueño (04/10/2026): perezoso, y la puerta la pone el servidor (ver dashboard.jsx)
const Dashboard = lazy(() => import('./dashboard.jsx').then((m) => ({ default: m.Dashboard })));
// 🏠 y en el Inicio, sólo para Dlx (el mismo archivo: se baja una vez)
const PanelDueno = lazy(() => import('./dashboard.jsx').then((m) => ({ default: m.PanelDueno })));
// 🛠️ la página Mods (20/11/2026): sólo para quien tiene algo para hacer ahí; la puerta de verdad la pone el Worker en cada pedido
const ModsPagina = pag(() => import('./mods_pag.jsx').then((m) => ({ default: m.ModsPagina })));

// 📣 EL AVISO DE LA PÁGINA (el Dashboard de Dlx, 04/10/2026): viaja con `/api/avisos/vivo`, que datos.js ya pide al
// abrir y cada pocos minutos (`window.VIVO.aviso`). Cada uno lo puede cerrar; uno nuevo vuelve a aparecer
function avisoDe() {
  const a = window.VIVO && window.VIVO.aviso;
  return a && a.texto && Date.parse(a.hasta) > Date.now() ? a : null;
}
function AvisoWeb({ aviso }) {
  const id = aviso ? aviso.texto + '|' + aviso.hasta : '';
  const [cerrado, setCerrado] = useState(() => { try { return localStorage.getItem('lg:aviso-cerrado') || ''; } catch (e) { return ''; } });
  // 📱 cerrado en otro dispositivo (web/src/sync_cuenta.js, 23/11/2026)
  useEffect(() => {
    const f = () => { try { setCerrado(localStorage.getItem('lg:aviso-cerrado') || ''); } catch (e) { /* igual */ } };
    window.addEventListener('lg:ui', f);
    return () => window.removeEventListener('lg:ui', f);
  }, []);
  if (!aviso || cerrado === id) return null;
  const cerrar = () => { setCerrado(id); try { localStorage.setItem('lg:aviso-cerrado', id); } catch (e) { /* igual se cierra */ } };
  return (
    <div className="aviso-web" role="status">
      <p>{aviso.texto}</p>
      <button type="button" aria-label="Cerrar el aviso" onClick={cerrar}>✕</button>
    </div>
  );
}
// ✅ verificarse, en su página (el remake del 02/11/2026: verificar.jsx, con el trámite de cuenta.jsx adentro)
const PaginaVerificar = lazy(() => import('./verificar.jsx').then((m) => ({ default: m.PaginaVerificar })));
const Cambios = pag(() => import('./cambios2.jsx').then((m) => ({ default: m.Cambios })));
// 🧰 el kit privado de cada servidor (17/11/2026): sólo con su link, `/freestyle-rap/kit/<código>` (ver kit.jsx)
const Kit = pag(() => import('./kit.jsx').then((m) => ({ default: m.Kit })));
const PerfilSv = pag(() => import('./entidad2.jsx').then((m) => ({ default: m.PerfilSv })));
const PaginaCrew = pag(() => import('./crew2.jsx').then((m) => ({ default: m.PaginaCrew })));
const AjustesCrew = pag(() => import('./crew2.jsx').then((m) => ({ default: m.AjustesCrew })));
const PaginaPais = pag(() => import('./entidad2.jsx').then((m) => ({ default: m.PaginaPais })));
// ⏳ mientras baja una página: la misma barrita que la pantalla de carga (`#lg-carga`), en chico
const Cargando = () => <div className="cargando" role="status"><span>Cargando…</span><i className="cargando-b" aria-hidden="true"><i /></i></div>;
import { VentanaVideo } from './video.jsx';
import { claseTema, guardarTemas, leerTemas } from './temas.js';
import { useCalma, useTapado } from './anima.js';
// 🐞 los errores de la página, al Dashboard (19/10/2026): los de cada sección y los que no agarra ninguna
import { escucharErrores, noEsGente, reportarError } from './errores.js';
import { esDeVersion, recargarPorVersion } from './version.js';
import Volver, { notarRuta } from './volver.jsx';
import { useAparecer } from './aparecer.js';
// 🎁 al cargar: el `?ref=` de un link de invitación, y mandarlo cuando haya cuenta (referidos.js)
import './referidos.js';
// 📱 lo visto o hecho en la página sigue a tu cuenta (23/11/2026): ver el módulo
import './sync_cuenta.js';

escucharErrores();

// ── el puente con la cañería (nucleo.js y compañía): cada vez que «pinta», avisa ──────────────────────────────
// ⚠️ Sus funciones son globales (scripts clásicos, sin módulo), y adentro se llaman por su nombre: si se cambia
// `window.pintaDatos`, las llamadas de los scripts pasan por el cambio. Se envuelven una sola vez. Desde la tanda 4
// (27/10/2026) no dibujan nada: existen para que salga el aviso. ⚠️ Renombrarlas deja a la página sorda sin fallar
function envolver(nombre, evento, avisar) {
  const f = window[nombre];
  if (typeof f !== 'function' || f.__inicio) return;
  const g = function () {
    const r = f.apply(this, arguments);
    try { if (!avisar || avisar()) window.dispatchEvent(new CustomEvent(evento)); } catch (e) { /* nada */ }
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
// 🔴 Y SÓLO SI CAMBIÓ LA CUENTA (10/11/2026): `pintaDatos()` llama a `pintaCuenta()` con CADA lobby nuevo, y cada
// `lg:cuenta` volvía a pedir la racha, el Pase, la crew y la bandeja —cuatro POST, sin caché: el Worker y el objeto— sin
// que nadie hubiera entrado ni salido. La firma es lo que guarda Mi cuenta al entrar, salir u olvidar (`lg:dc`,
// `lg:yo`), entero; si no se puede leer, avisa siempre (lo de antes). Lo que cambia sin cambiar de cuenta (la foto, las
// redes, «tu servidor») ya avisa por `lg:cuentaest`
let firmaCuentaVieja = firmaCuenta();
function firmaCuenta() {
  try { return (localStorage.getItem('lg:dc') || '') + '|' + (localStorage.getItem('lg:yo') || ''); } catch (e) { return null; }
}
envolver('pintaCuenta', 'lg:cuenta', () => {
  const f = firmaCuenta();
  if (f !== null && f === firmaCuentaVieja) return false;
  firmaCuentaVieja = f;
  return true;
});
envolver('guardarSigo', 'lg:sigo');
// 👤 Y LO DE MI CUENTA (02/10/2026): la foto, las redes, «tu servidor». cuenta.js llama a `pintaPopCuenta()` después
// de cada cambio, así que ése es el aviso
envolver('pintaPopCuenta', 'lg:cuentaest');
// 💰 Y EL PRECIO POR CABEZA (03/10/2026): el perfil nuevo muestra lo que vale cada cabeza y cómo salió tu precio, que
// viven en tienda.js (`valorCabezas()`, `PR_EST`, `BILL`); `pintaPrecios()` corre después de cada cambio
envolver('pintaPrecios', 'lg:precios');
// 👥 Y CUANDO LLEGAN LOS PERFILES (18/11/2026): `liga.persona()` lee `window.PERF` cuando se lo preguntan, pero lo que
// se calculó con la Liga de antes (los `useMemo` de cada página) no se volvía a preguntar hasta el minuto siguiente, y
// la gente de fuera de las 200 filas quedaba sin nombre ni cara. `perfiles()` (datos.js) avisa `lg:perfiles` al
// contestar, la llame quien la llame, y el App rehace la Liga una vez (ver `perfV`)
(function () {
  const f = window.perfiles;
  if (typeof f !== 'function' || f.__inicio) return;
  const g = function () {
    const r = f.apply(this, arguments);
    Promise.resolve(r).then((d) => { if (d) window.dispatchEvent(new Event('lg:perfiles')); }).catch(() => {});
    return r;
  };
  g.__inicio = true;
  window.perfiles = g;
})();

// ── el changelog: qué versión habías visto ANTES de abrirlo. nucleo.js la da por vista apenas lo abrís
// (`pintaCambios()`), y lo hace antes que esto. Si la página se abrió en `#/cambios`, ya pasó antes de que cargara
// este módulo: por eso el script del principio de index.html la guarda (`__cambiosVisto`, ver web/montar.py). Si se
// llega navegando, se toma justo antes de que nucleo.js la dé por vista
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
// 🔗 ¿ESTA VISITA ENTRÓ POR EL LINK DE UNA HISTORIA (`/freestyle-rap/?h=<id>`)? (18/11/2026) Para la bienvenida era el
// Inicio pelado: quien abría una historia compartida por primera vez iba a /bienvenida, el `?h=` se perdía y la historia
// no se abría. Quien entra por un link va directo a eso (primera.js). Se lee AL CARGAR: el visor saca el `?h=` de la
// dirección, y leerlo después mandaría a la bienvenida apenas cambiara de página
const CON_HISTORIA = (() => { try { return /[?&]h=/.test(location.search || ''); } catch (e) { return false; } })();
// ⏳ SI EL AVISO DE «NO PUDE CARGAR» SALIÓ ANTES DE QUE LLEGARA LA APP (18/11/2026): el plan B de index.html lo pone si a
// los 8 s de bajar todo la app no se montó. Como el plazo de 15 s de los datos (abajo), es «tardó», no «falló»: si los
// datos llegan, la página vuelve (ver el efecto de `lg-listo`)
try {
  if (document.documentElement.classList.contains('sin-pagina') && !window.__sinDatos) window.__sinPorPlazo = true;
} catch (e) { /* nada */ }

// 🔴 CADA SECCIÓN, AISLADA — la regla que tenía `pintaDatos()` de app.js: una que falla (un dato con otra forma) queda
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
  componentDidCatch(e) {
    // 🔄 un pedazo de otra versión: se recarga una vez y entra la nueva (ver version.js); si no, se cuenta como siempre
    if ((esDeVersion(e) && recargarPorVersion()) || window.__lgRecargando) return;
    console.error('[inicio:' + this.props.n + ']', e); reportarError(this.props.n, e);
  }
  // 🔁 Y VUELVE A PROBAR CON DATOS NUEVOS (21/11/2026, revisión de robustez): una sección que se rompía una vez quedaba
  // apagada toda la visita —la Cabecera, la barra de abajo, el menú o la llave en vivo, hasta recargar—, aunque el dato que
  // la rompió ya se hubiera ido. `reinicio` es la versión de lo que dibuja (el sello del lobby y el lugar; en la llave,
  // también lo en vivo): si cambia, se intenta de nuevo. ⚠️ Sólo si YA estaba rota antes de este cambio (`prevS.roto`):
  // si se rompe con los datos nuevos, no se reintenta con esos mismos, y no hay vuelta en bucle
  componentDidUpdate(prev, prevS) {
    if (this.state.roto && prevS.roto && prev.reinicio !== this.props.reinicio) this.setState({ roto: false });
  }
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

// si la página entera no puede dibujarse, el aviso de index.html: «No pude cargar los datos» y «Reintentar»
// (`__sinPagina()`, web/montar.py). Hasta la tanda 4 volvía la página vieja, que seguía escondida en el DOM
export class Respaldo extends Component {
  constructor(p) { super(p); this.state = { roto: false }; }
  static getDerivedStateFromError() { return { roto: true }; }
  componentDidCatch(e) {
    if ((esDeVersion(e) && recargarPorVersion()) || window.__lgRecargando) return;
    console.error('[inicio]', e);
    reportarError('inicio', e);
    if (window.__sinPagina) window.__sinPagina('Algo de la página se rompió.');
  }
  render() { return this.state.roto ? null : this.props.children; }
}

// lo que las votaciones necesitan de social.js: los votos, el mío y el estado (guardando, error)
function estadoEnc() {
  const w = window;
  const mio = w.ENC_MIO || {};
  const est = w.ENC_EST || {};
  const cuenta = (id) => (w.cuentaEnc ? w.cuentaEnc(id) : (w.ENC_V || {})[id] || {});
  const pie = (E, nombre) => {
    const e = est[E.id] || {};
    if (e.va) return 'Guardando tu voto…';
    if (e.error) return w.errorEnc ? w.errorEnc(e).replace(/<[^>]+>/g, '') : 'No pude guardar tu voto.';
    // 🔒 el ×2 y El Elegido, una vez por semana; los MES AWARDS se siguen cambiando hasta que cierran
    if (mio[E.id] && E.op.includes(mio[E.id])) {
      return 'Votaste por ' + nombre(mio[E.id]) + (E.tipo === 'x2' || E.tipo === 'elegido' ? '. Un voto por semana: ya quedó.' : '. Lo puedes cambiar hasta que cierre.');
    }
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
  // 📱 llegó lo de tu cuenta de otro dispositivo (sync_cuenta.js): se dibuja de nuevo con eso (el tutorial, lo nuevo…)
  const [, setUiN] = useState(0);
  useEffect(() => { const f = () => setUiN((n) => n + 1); window.addEventListener('lg:ui', f); return () => window.removeEventListener('lg:ui', f); }, []);
  // 🎨 el tema de base (Clara o Noche) y los colores de un servidor encima, o ninguno (13/10/2026): ver temas.js
  const [tema, setTema] = useState(() => leerTemas().base);
  const [temaSv, setTemaSv] = useState(() => leerTemas().sv);
  const [menu, setMenu] = useState(false);
  const [historia, setHistoria] = useState(null);
  // 💬 la publicación cuya hoja de comentarios está abierta encima de la página (`abrirComentarios()` de comentarios.jsx)
  const [hojaCm, setHojaCm] = useState(null);
  useEffect(() => {
    const f = (e) => setHojaCm((e && e.detail) || null);
    window.addEventListener('lg:hoja-cm', f);
    return () => window.removeEventListener('lg:hoja-cm', f);
  }, []);
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
  // ← la pila de «Volver» (volver.jsx): se anota antes de dibujar, así el botón ya sabe de dónde se vino
  notarRuta(hash);
  // ✨ las secciones suben al llegar (aparecer.js). 🔊 El toque de cada botón se sacó el mismo 25/11 (Dlx: «que no todos
  // los botones generen un sonido sino muy pocos, los importantes»): suenan sólo los momentos de la Tienda (sonidos.js)
  useAparecer();
  const [sigoV, setSigoV] = useState(0);
  // 🧭 pedir el tutorial (la Guía, el «¿Cómo funciona?», la pista de nuevos) avisa `lg:tour` con qué: cada pedido es un
  // número nuevo (ver `pedirRecorrido()` de primera.js)
  const [repite, setRepite] = useState({ n: 0, que: '' });
  useEffect(() => {
    const f = (e) => setRepite((r) => ({ n: r.n + 1, que: (e && e.detail) || 'elegir' }));
    window.addEventListener('lg:tour', f);
    return () => window.removeEventListener('lg:tour', f);
  }, []);
  const raiz = useRef(null);
  const paso = useRef(null);

  useEffect(() => {
    const datos = () => { setD(window.D || null); setAhora(new Date()); setYo(quienMira()); setEnc(estadoEnc()); };
    const votos = () => setEnc(estadoEnc());
    const vivo = () => { setVivoL(Object.assign({}, window.VIVO_L || {})); setAviso(avisoDe()); };
    const ruta = () => { setYo(quienMira()); setHash(rutaHash()); };
    const cuenta = () => setYo(quienMira());
    const sigo = () => setSigoV((v) => v + 1);
    // cambiar la hora, la zona o el formato en Ajustes: todo lo que tiene horas se vuelve a dibujar
    const ajustes = () => setAhora(new Date());
    window.addEventListener('lg:ajustes', ajustes);
    window.addEventListener('lg:cuenta', cuenta);
    // 🛠️ «Ver como» de Mods cambia quién mira (`quienMira()` de liga.js): la página se vuelve a armar
    window.addEventListener('lg:mods', cuenta);
    window.addEventListener('lg:sigo', sigo);
    window.addEventListener('lg:datos', datos);
    window.addEventListener('lg:enc', votos);
    window.addEventListener('lg:vivo', vivo);
    window.addEventListener('lg:ruta', ruta);
    window.addEventListener('hashchange', ruta);
    // `lg:dir`: atrás/adelante y los links `#/…` que ataja el script del principio (la dirección cambia sin recargar)
    window.addEventListener('lg:dir', ruta);
    window.addEventListener('storage', ruta);
    // 🔴 Y LA DIRECCIÓN TAMBIÉN: quien vuelve de Discord vuelve a `/#access_token=…` y cuenta.js la cambia con
    // replaceState (sin hashchange) al destino —`#/cuenta/verificar`—. Si eso pasó entre el primer dibujo y este
    // efecto, el Inicio se quedaba en la dirección vieja (01/10/2026, al probar «Cancelar» en Discord)
    ruta();
    // ⚠️ nucleo.js pudo pintar ENTRE que este módulo envolvió sus funciones y este efecto: el aviso salió sin nadie
    // escuchando. Se lee una vez lo que haya.
    if (window.D) datos();
    if (window.VIVO_L) vivo();
    // si los datos no llegan, el aviso de index.html («No pude cargar los datos»). Si `/api/lobby` contestó con un
    // error ya lo puso nucleo.js (`__sinDatos`); esto es para el que no contesta nunca
    const t0 = Date.now();
    const plazo = setInterval(() => {
      if (window.D || window.__sinDatos) { clearInterval(plazo); return; }
      if (Date.now() - t0 > 15000) {
        clearInterval(plazo);
        // ⏳ marcado como «tardó» (18/11/2026): nucleo.js no le pone plazo al lobby, así que puede llegar igual, y la
        // página quedaba escondida detrás del aviso con los datos ya puestos (ver el efecto de `lg-listo`)
        window.__sinPorPlazo = true;
        if (window.__sinPagina) window.__sinPagina('El servidor no contestó.');
      }
    }, 400);
    // ⏱️ EL RELOJ, SÓLO CON LA PESTAÑA A LA VISTA (21/11/2026, revisión de robustez): cada minuto rehacía la Liga y
    // redibujaba la página entera aunque nadie la mirara (una pestaña olvidada, el teléfono bloqueado). Escondida no
    // avanza; al volver a verla se pone al día de una, si ya pasó el minuto
    let ultTic = Date.now();
    const tic = () => { ultTic = Date.now(); setAhora(new Date()); };
    const reloj = setInterval(() => { if (!document.hidden) tic(); }, 60000);
    const alVolver = () => { if (!document.hidden && Date.now() - ultTic >= 60000) tic(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('lg:datos', datos); window.removeEventListener('lg:enc', votos);
      window.removeEventListener('lg:vivo', vivo); window.removeEventListener('lg:ruta', ruta);
      window.removeEventListener('hashchange', ruta); window.removeEventListener('storage', ruta);
      window.removeEventListener('lg:dir', ruta);
      window.removeEventListener('lg:cuenta', cuenta); window.removeEventListener('lg:sigo', sigo); window.removeEventListener('lg:mods', cuenta);
      window.removeEventListener('lg:ajustes', ajustes);
      clearInterval(plazo); clearInterval(reloj);
    };
  }, []);

  // 📊 UNA VISITA POR DÍA Y POR NAVEGADOR (Dlx, 04/10/2026: «cuántos están enganchados con el bot y la página»). El
  // navegador recuerda que ya avisó hoy (en hora del este, como todo); el vigía sólo suma un número. Sin almacenamiento
  // no se cuenta: si no, cada recarga sería una visita
  useEffect(() => {
    try {
      // 🤖 UN ROBOT NO ES GENTE (23/11/2026): las pruebas automáticas (Playwright: las de cada despliegue, las de cada
      // sesión) entran con un navegador limpio cada vez y contaban como una visita nueva. La semana del 16/11 sumó 2.481
      // contra ~525 visitas de Web Analytics. `navigator.webdriver` lo prende todo navegador manejado por un programa
      if (navigator.webdriver) return;
      // 🙈 ni el navegador de Dlx (23/11/2026: «I don't want my account to be counted»; ver `FUERA_DE_NUMEROS`)
      if (esDuenoAca()) return;
      const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
      // 📱 y su primera visita de la semana (lunes a domingo, hora del este): con eso el Dashboard cuenta navegadores
      // DISTINTOS por semana y no la suma de los días (`visitas_sem` en bot/avisos.js)
      const d0 = Date.parse(hoy + 'T12:00:00Z');
      const lunes = new Date(d0 - ((new Date(d0).getUTCDay() + 6) % 7) * 864e5).toISOString().slice(0, 10);
      const sem = localStorage.getItem('lg:visita_sem') !== lunes;
      const antes = localStorage.getItem('lg:visita') || '';
      const ya = antes === hoy;
      if (ya && !sem) return;
      // 🔁 hace cuántos días fue la visita anterior de este navegador (23/11/2026, «si los usuarios se quedan enganchados»):
      // va sólo ese número; -1 si es la primera. Lo que se guarda acá ya existía (`lg:visita`)
      const vu = /^\d{4}-\d{2}-\d{2}$/.test(antes) ? Math.round((Date.parse(hoy + 'T12:00:00Z') - Date.parse(antes + 'T12:00:00Z')) / 864e5) : -1;
      localStorage.setItem('lg:visita', hoy);
      if (sem) localStorage.setItem('lg:visita_sem', lunes);
      if (ya) {
        fetch('/api/avisos/visita', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sem: 1, ya: 1 }),
          keepalive: true }).catch(() => {});
        return;
      }
      // 🔗 y de qué link llegó (21/11/2026, el plan de alcance): `?de=<canal>` —o `utm_source`— en el link que se le pasa a
      // un medio, un aliado o un directorio. Va sólo el canal, nunca nada de quien mira; el primero queda en `lg:de` para
      // saber después de dónde llegó la gente que volvió a jugar. ⚠️ La regla del canal es `CANAL` de bot/avisos.js
      const de = canalDe(location.search);
      if (de && !localStorage.getItem('lg:de')) localStorage.setItem('lg:de', JSON.stringify({ de, dia: hoy }));
      fetch('/api/avisos/visita', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(Object.assign(de ? { de } : {}, sem ? { sem: 1 } : {}, vu >= -1 && vu <= 400 ? { vu } : {})), keepalive: true }).catch(() => {});
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
  // 🔁 Y SI /api/ligas FALLA, SE VUELVE A PEDIR (18/11/2026): no se pedía hasta el próximo lobby (otro `sello`), y Ligas se
  // quedaba en «Cargando…» (ligas.jsx) todo ese rato. Cada vez más espaciado (30 s, 1, 2, 4 y de ahí cada 5 min): el borde
  // guarda un error 15 s nada más (`delBorde()`, _worker.js), así que en una caída cada pestaña abierta llegaría al Worker
  // cada 30 s. `pedirLigas` ya suelta el pedido que falló, así que cada vuelta es un pedido nuevo
  useEffect(() => {
    if (!D || D.ligas) return undefined;
    let vivo = true, t = 0, espera = 30000;
    const pide = () => pedirLigas(D.sello).then((x) => {
      if (!vivo) return;
      if (x && x.lobby) setLigasL(x.lobby);
      else if (!x) { t = setTimeout(pide, espera); espera = Math.min(espera * 2, 300000); }
    });
    pide();
    return () => { vivo = false; clearTimeout(t); };
  }, [D && D.sello]); // eslint-disable-line react-hooks/exhaustive-deps
  // 📅 Y LA TEMPORADA ENTERA DEL CALENDARIO (29/10/2026, ver web/src/calendario_datos.js): el lobby trae 4 semanas, y al
  // abrir Eventos o una llave se pide el resto y se junta en `liga.d.calendario`. Una vez pedida, queda para toda la visita
  const [calE, setCalE] = useState(null);
  // (24/11/2026: el lobby trae 2 semanas; el panel del socio —«cuándo juega tu gente»— y el Dashboard miran 4)
  const pideCal = /^#\/(eventos|avisos|llave|socio|dashboard)(\/|\?|$)/.test(hash || '');
  useEffect(() => {
    if (!D || !D.cal_desde || (!pideCal && !calE)) return undefined;
    let vivo = true;
    pedirCalendario(D.sello).then((x) => { if (vivo && x) setCalE(x); });
    return () => { vivo = false; };
  }, [D && D.sello, pideCal]); // eslint-disable-line react-hooks/exhaustive-deps
  // 🧪 LA PRUEBA EN SOMBRA DEL ELO NUEVO (`?prev=elo`, ver prueba_elo.js): su `div` reemplaza al del lobby, sólo en
  // este navegador. Mientras nadie jugó desde que arrancó, no trae `d` y se queda el de siempre
  const [pruebaE, setPruebaE] = useState(null);
  useEffect(() => {
    if (!D || !prevElo()) return undefined;
    let vivo = true;
    pedirPrueba(D.sello).then((x) => { if (vivo) setPruebaE(x); });
    return () => { vivo = false; };
  }, [D && D.sello]); // eslint-disable-line react-hooks/exhaustive-deps
  const D2 = useMemo(() => {
    let d = D && !D.ligas && ligasL ? Object.assign({}, D, { ligas: ligasL }) : D;
    if (d && pruebaE && pruebaE.d) d = Object.assign({}, d, { div: pruebaE.d });
    return juntarCalendario(d, calE);
  }, [D, ligasL, calE, pruebaE]);
  // 🙋 TU FILA SI NO ESTÁS ENTRE LOS 200 DEL LOBBY (12/11/2026): viene en tu perfil (`/api/perfiles`, `p[k].f`), que se
  // pide sólo en ese caso. Sin esto, el panel, el inventario y tus cartas te trataban como a alguien que nunca jugó
  const [yoFila, setYoFila] = useState(null);
  const fueraDe200 = !!(D2 && yo.k && !(D2.tabla || []).some((r) => r.k === yo.k));
  useEffect(() => {
    if (!fueraDe200 || typeof window.perfiles !== 'function') return undefined;
    let vivo = true;
    Promise.resolve(window.perfiles()).then((d) => {
      const pp = d && d.p && d.p[yo.k];
      const f = pp && pp.f;
      // con tu puesto en el país y en la crew (`rk`) y el número de tu último evento (`ue`), que la fila no trae
      const ue = ((pp && pp.ev) || []).slice().sort((a, b) => (b[0] || 0) - (a[0] || 0))[0] || null;
      if (vivo && f && !f.solo) setYoFila(Object.assign({ k: yo.k, rk: pp.rk || null, ue }, f));
    }).catch(() => {});
    return () => { vivo = false; };
  }, [fueraDe200, yo.k]); // eslint-disable-line react-hooks/exhaustive-deps
  // 👥 los perfiles llegaron (`lg:perfiles`, ver arriba): la Liga se rehace UNA vez por cada `window.PERF` nuevo
  // (18/11/2026), así lo que se calculó con ella vuelve a preguntar por la gente de fuera de la tabla
  const [perfV, setPerfV] = useState(0);
  useEffect(() => {
    let visto = null;
    const f = () => { const p = window.PERF || null; if (p && p !== visto) { visto = p; setPerfV((v) => v + 1); } };
    window.addEventListener('lg:perfiles', f);
    f();
    return () => window.removeEventListener('lg:perfiles', f);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const liga = useMemo(() => (D2 ? new Liga(D2, muro, ahora, yo.k, aQuienSigo(), yoFila) : null), [D2, muro, ahora, yo, sigoV, yoFila, perfV]);
  // ⏳ con los datos, se va la pantalla de carga del HTML (`#lg-carga`, web/montar.py)
  useEffect(() => {
    if (!liga) return;
    const c = document.documentElement.classList;
    c.add('lg-listo');
    // ⏳ Y SI EL AVISO SALIÓ POR TARDAR, SE VA (18/11/2026): el lobby que llegaba pasados los 15 s (o la app pasados los
    // 8 s del plan B) llenaba la página, pero `sin-pagina` la dejaba escondida detrás de «No pude cargar» hasta tocar
    // «Reintentar». Con un error de verdad del lobby (`__sinDatos`) el aviso se queda. `lg-fuera` va porque la pantalla
    // de carga ya dejó de mirar (su `tic` se corta con `sin-pagina`): sin él volvía y tapaba la página para siempre.
    // Y `lg-sale` (18/11/2026, revisión): es lo que espera `useTapado()` (anima.js) para sacar `.app.tapado`; sin él las
    // animaciones quedaban en pausa en su primer cuadro —`.pg-entra` arranca en opacidad 0— y la página volvía en blanco
    if (c.contains('sin-pagina') && window.__sinPorPlazo && !window.__sinDatos) { c.remove('sin-pagina'); c.add('lg-sale', 'lg-fuera'); }
  }, [!!liga]);
  // el perfil de un servidor (#/sv/<SIGLA>)
  const mSv = /^#\/sv\/([^/?#]+)/i.exec(hash || '');
  let sv = null;
  // ⚠️ con try: un `%` suelto en la dirección tiraba URIError y el Inicio entero se caía al de respaldo
  if (mSv) { try { sv = decodeURIComponent(mSv[1]).toUpperCase(); } catch (e) { sv = mSv[1].toUpperCase(); } }
  // 🔤 `/sv/SNK` es Snake Rap: la sigla que se lee abre el mismo perfil que el código (`Liga.codigo()`)
  if (sv && liga) sv = liga.codigo(sv);
  // qué página: '' es el Inicio; `cambios` (01/10/2026) la primera que el Inicio nuevo le sacó a la de hoy
  const partes = (hash || '').replace(/^#\/?/, '').split('?')[0].split('/');
  // 🏟️ `#/ranking/ligas[/<id>]` es el link de antes del 16/10/2026 (Publicaciones, las historias, lo compartido): abre
  // la sección nueva, y la dirección pasa a ser la de ahora
  // 🧭 `#/misiones` no existía y caía al Inicio sin avisar (revisión 21/11): las Misiones viven en el Ranking. Mismo arreglo
  // que el de las ligas: se abre la de verdad y se corrige la dirección
  // 🎬 «VIDEOS» (25/11/2026, Dlx: «reels must be changed to videos»): la página se llama Videos y vive en `#/videos`; por
  // dentro sigue siendo `reels` (la sección que se cuenta, reels.jsx). Un link viejo `#/reels/…` abre lo mismo y la
  // dirección pasa a la de ahora
  const reelsViejo = partes[0] === 'reels';
  if (partes[0] === 'videos') partes[0] = 'reels';
  useEffect(() => {
    if (!reelsViejo) return;
    const r = '#/videos' + (partes.length > 1 ? '/' + partes.slice(1).join('/') : '');
    try { history.replaceState(history.state, '', window.urlLG ? window.urlLG(r) : r); } catch (e) { /* queda la dirección */ }
  }, [reelsViejo]); // eslint-disable-line react-hooks/exhaustive-deps
  const ligasVieja = (partes[0] === 'ranking' && partes[1] === 'ligas') || partes[0] === 'misiones';
  if (partes[0] === 'misiones') partes.splice(0, 1, 'ranking', 'misiones');
  else if (ligasVieja) partes.splice(0, 2, 'ligas');
  useEffect(() => {
    if (!ligasVieja) return;
    const r = '#/' + partes.join('/');
    try { history.replaceState(history.state, '', window.urlLG ? window.urlLG(r) : r); } catch (e) { /* queda la dirección */ }
  }, [ligasVieja]); // eslint-disable-line react-hooks/exhaustive-deps
  const pagina = /^(access_token|error)=/.test(partes[0] || '') ? '' : (partes[0] || '');
  // la crew de `#/crew/<clave>`, decodificada una vez y con try, como el servidor: un `%` suelto en un link compartido
  // tiraba URIError en el render del App y toda la página nueva caía a la de respaldo (revisión del 04/10/2026)
  let crewId = '', crewAj = null;
  // ⚙️ `#/crew/<id>/ajustes[/<sección>]`: los Ajustes de la crew, su propia página (el remake del 16/11/2026)
  if (pagina === 'crew') {
    const iA = partes.indexOf('ajustes', 2);
    const r = partes.slice(1, iA > 0 ? iA : undefined).join('/');
    try { crewId = decodeURIComponent(r); } catch (e) { crewId = r; }
    if (iA > 0) crewAj = partes[iA + 1] || '';
  }
  let ligaId = '';
  if (pagina === 'ligas' && partes[1]) { try { ligaId = decodeURIComponent(partes[1]); } catch (e) { ligaId = partes[1]; } }
  // 🎮 LA BIENVENIDA ES UNA PÁGINA, `/freestyle-rap/bienvenida` (Dlx, 12/11/2026: «haz que todo eso del intro sea una tab,
  // que si eres nuevo o pestaña privada te lleve automáticamente a esta desde la página Inicio»). Quien llega por
  // primera vez al Inicio —una pestaña privada lo es: el navegador no tiene nada guardado— va ahí solo, y quien vuelve
  // de Discord en el medio (el paso 2) también. Va EN EL MISMO LUGAR DEL HISTORIAL: con un paso nuevo, «atrás» lo
  // devolvía al Inicio y el Inicio lo volvía a mandar. Y como es una dirección, se puede abrir con un link
  // 🔗 Salvo que haya entrado por el link de una historia (`CON_HISTORIA`, 18/11/2026): ésa es su página, como un perfil
  useEffect(() => {
    if (pagina !== 'bienvenida' && !CON_HISTORIA && quiereBienvenida(yo.dc)) irSinHistoria('#/bienvenida');
  }, [pagina, yo.dc]);
  // la del menú: `#/duelos` es el Ranking, y `#/mundo` es Socios
  const paginaMenu = pagina === 'duelos' ? 'ranking' : pagina === 'avisos' ? 'eventos' : pagina === 'mundo' ? 'socios' : pagina;
  // 🔝 CADA PÁGINA ABRE ARRIBA (revisión del 04/11/2026). Era «¿estás en una de esta lista?»: de Publicaciones a Socios la
  // respuesta seguía siendo sí y no se movía, y la Tienda, el Changelog, las crews y los países no estaban. Se veía como
  // que el toque no hizo nada: Chile abría a 1.500 px, con el título fuera de la pantalla. El perfil y la llave van a su
  // lugar al abrir, y `#/avisos` baja hasta la campana
  // 🏠 EL INICIO TAMBIÉN (18/11/2026): su `lugar` es '' y el `lugar &&` lo dejaba afuera, así que tocar «Inicio» desde el
  // Ranking bajado a 2.300 px abría el Inicio a esa altura, en Noticias y no en las historias
  // 🏟️ y `socios/sumar` es otra página que Socios (19/11/2026): sin esto, el botón de Socios la abría a la altura del botón
const lugar = sv ? 'sv/' + sv : pagina === 'crew' || pagina === 'pais' || (pagina === 'socios' && partes[1] === 'sumar') ? pagina + '/' + (partes[1] || '') : paginaMenu;
  useEffect(() => {
    if (pagina !== 'r' && pagina !== 'llave' && pagina !== 'avisos') window.scrollTo(0, 0);
  }, [lugar]); // eslint-disable-line react-hooks/exhaustive-deps
  // 🔁 CON QUÉ VUELVE A PROBAR UNA SECCIÓN ROTA (21/11/2026, ver `Aislada`): el lobby nuevo (`sello`), otro lugar de la
  // página y los perfiles cuando llegan. Lo en vivo va aparte (`reVivo`) y sólo a lo que lo dibuja: cada llave con su
  // última edición, así no cambia con cada vuelta del vigía si nada se movió
  const vivoVer = useMemo(() => Object.keys(vivoL || {}).map((i) => i + ':' + ((vivoL[i] && (vivoL[i].ed || vivoL[i].pub)) || 0)).join(','), [vivoL]);
  const reinicio = ((D && D.sello) || '') + '|' + lugar + '|' + perfV;
  const reVivo = reinicio + '|' + vivoVer;
  // 📊 QUÉ SECCIONES SE ABREN (Dlx, 12/10/2026, el research «página sencilla»: medir antes de mover la tira). Cada
  // sección cuenta UNA vez por día y por navegador (`lg:secc`, en hora del este como la visita) y el vigía sólo suma un
  // número: nunca quién. La lista cerrada es `SECC_EV` de bot/avisos.js; lo que no está ahí no se manda
  const seccion = sv ? 'servidor' : pagina === '' ? 'inicio' : pagina === 'r' || pagina === 'global' || pagina === 'competencia' ? 'perfil' : paginaMenu;
  useEffect(() => { anotarUnaVez(seccion); if (sv) anotarUnaVez('sv-' + String(sv).toUpperCase()); }, [seccion, sv]);
  // 👀 «ESTOY EN LA PÁGINA» (23/11/2026, Dlx: «who is on the website right now», con nombre; lo dice /privacidad). La
  // pestaña avisa al abrir, al volver a ella, al cambiar de sección y cada `AQUI_MIN` minutos mientras se ve. Con tu cuenta,
  // la sesión (la cookie, que la página no ve) dice quién eres; sin cuenta, va sólo un código al azar de esta pestaña
  // (`sessionStorage`: se olvida al cerrarla). Ni los robots ni las vistas previas (`noEsGente()`), ni Dlx
  const aqui = useRef({ s: seccion, ult: 0, k: '' });
  aqui.current.s = seccion;
  useEffect(() => {
    if (noEsGente()) return undefined;
    const A = aqui.current;
    try {
      A.k = sessionStorage.getItem('lg:aqui') || '';
      if (!/^[a-z0-9]{10,24}$/.test(A.k)) {
        A.k = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        sessionStorage.setItem('lg:aqui', A.k);
      }
    } catch (e) { A.k = ''; }
    if (!A.k) return undefined;
    // `fin`: la dejaste de ver (otra pestaña, otra app, cerrar): ⏱️ con eso se sabe cuánto tiempo estuviste (Dlx, 23/11/2026:
    // «cuánto tiempo en la página se quedan usualmente»); sin él, quien se va a los 3 minutos parecería de 0
    A.avisar = (freno, fin) => {
      if ((!fin && document.visibilityState !== 'visible') || esDuenoAca() || Date.now() - A.ult < freno) return;
      A.ult = Date.now();
      const cuerpo = JSON.stringify({ k: A.k, s: A.s });
      try {
        if (fin && navigator.sendBeacon && navigator.sendBeacon('/api/avisos/aqui', new Blob([cuerpo], { type: 'application/json' }))) return;
      } catch (e) { /* sin beacon, con fetch */ }
      fetch('/api/avisos/aqui', { method: 'POST', headers: { 'content-type': 'application/json' }, body: cuerpo, keepalive: true }).catch(() => {});
    };
    A.avisar(0);
    const t = setInterval(() => A.avisar(0), AQUI_MIN * 60000);
    const vis = () => (document.visibilityState === 'hidden' ? A.avisar(15000, true) : A.avisar(60000));
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); A.avisar = null; };
  }, []);
  // al cambiar de sección, la nueva (con freno: quien recorre la página rápido no manda un aviso por toque)
  useEffect(() => { const A = aqui.current; const t = setTimeout(() => { if (A.avisar) A.avisar(30000); }, 3000); return () => clearTimeout(t); }, [seccion]);
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
  // 🔑 EL TÍTULO DE LA PESTAÑA. Lo ponía app.js con el <h1> de su vista vieja (así /mundo decía «El mundo» abriendo
  // Socios: recorrido del 03/10/2026); desde la tanda 4 (27/10/2026) lo pone esto, para todas. Los mismos nombres que
  // tenían las vistas viejas. El perfil y la llave ponen el suyo (perfil.jsx, llave.jsx): acá no se tocan, porque
  // este efecto corre DESPUÉS que el de ellas y lo pisaría
  const nombreSv = sv && liga && liga.svs[sv] ? liga.svs[sv].nombre || sv : sv;
  useEffect(() => {
    const crewT = pagina === 'crew' && liga ? (liga.d.crews || []).find((c) => (c.clave || c.crew) === crewId) : null;
    const t = sv ? nombreSv : pagina === 'socios' && partes[1] === 'sumar' ? 'Suma tu servidor' : pagina === 'socios' || pagina === 'mundo' ? 'Socios'
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
      : pagina === 'cuenta' || pagina === 'ajustes' ? 'Tu cuenta' : pagina === 'dashboard' ? 'Dashboard' : pagina === 'mods' ? 'Mods'
      // 🔎 el Ranking global, con lo que se escribe en Google («ranking freestyle 2026», autocompletado del 21/11/2026)
      : pagina === 'ranking' && partes[1] === 'global' ? 'Ranking global de freestyle 2026'
      : pagina === 'ranking' || pagina === 'duelos' ? 'Los rankings'
      : pagina === 'eventos' || pagina === 'avisos' ? 'Los eventos'
      : pagina === 'pase' ? 'Pase de rapero' : pagina === 'tienda' ? 'La tienda' : pagina === 'invitar' ? 'Invita y gana'
      : pagina === 'reels' ? 'Videos'
      : pagina === 'publicaciones' ? 'Publicaciones' : pagina === 'guia' ? 'Cómo funciona'
      : pagina === 'cambios' ? 'Changelog'
      : pagina === 'kit' ? 'El kit de tu servidor' : '';
    if (!sv && (pagina === 'r' || pagina === 'global' || pagina === 'competencia' || pagina === 'llave')) return undefined;
    // 🔎 LA PORTADA DICE LO QUE SE BUSCA (21/11/2026, el plan de alcance; Dlx: «dale»). «Liga Global de Freestyle» no lo
    // escribe nadie en Google y «Under Legends» se mezcla con un manhwa; «batallas de rap online» sí. La marca no cambia:
    // va como nombre del sitio en los datos estructurados (`seo()` de bot/paginas/_worker.js). El mismo título que index.html
    const poner = () => { document.title = t ? t + ' · Liga Global de Freestyle' : 'Batallas de rap online en español · Liga Global de Freestyle'; };
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
  // 📸 LAS HISTORIAS DE ALGUIEN DESDE SU PERFIL (17/11/2026, `historiasDePersona()` de arriba.jsx): el perfil arma su grupo
  // y lo abre en este mismo visor, así lo visto se guarda igual que en el Inicio
  const [propias, setPropias] = useState(null);
  useEffect(() => {
    window.lgVerHistorias = (g, desdeId) => { if (g && g.slides && g.slides.length) { setDesde(desdeId || ''); setPropias(g); } };
    return () => { delete window.lgVerHistorias; };
  }, []);
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

  // 🖼️ TU FONDO YA NO VA DE FONDO DE TU PÁGINA (17/11/2026). Desde el 13/10 se podía elegir «De fondo de mi página (lo veo
  // yo)», y pintaba tu portada detrás de cada escena: el Ranking, Eventos, Tu cuenta… Dlx: «en ranking, en mi cuenta,
  // aparece mi fondo de portada cuando no debería salir eso». Tu fondo va sólo en tu perfil (y en los lugares que se
  // elijan en «Tus fondos»)
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
  if (pagina === 'og' && partes[1] && partes[2]) {
    let id = partes.slice(2).join('/');
    try { id = decodeURIComponent(id); } catch (e) { /* tal cual */ }
    return <div className="app solo-og"><Suspense fallback={null}><OgLink liga={liga} tipo={partes[1]} id={id} /></Suspense></div>;
  }
  if (pagina === 'marco' && partes[1] && partes[2]) {
    // 🔤 la clave decodificada, como la del `og` de arriba (18/11/2026): Chromium codifica el camino y `tøkiø` llegaba
    // como `t%C3%B8ki%C3%B8`, que no está en los marcos ni en los efectos de carta: /card le saldría sin marco y sin aviso
    let km = partes[1];
    try { km = decodeURIComponent(km); } catch (e) { /* tal cual */ }
    return <div className="app solo-marco"><MarcoSolo liga={liga} k={km} cual={partes[2]} sv={partes[3] || ''} cc={(partes[4] || '').toLowerCase()} /></div>;
  }
  return (
    <div className={'app ' + claseTema(tema, temaSv) + calma} ref={raiz}>
      {/* ♿ «saltar al contenido» (04/10/2026, de la lista de Dlx): no se ve hasta que se llega con el teclado, y salta
          el menú de arriba. Lleva el foco, no sólo la vista: si no, el próximo Tab volvía al menú */}
      <a className="saltar" href="#contenido" onClick={(e) => {
        const r = raiz.current && raiz.current.getRootNode();
        const el = r && r.getElementById && r.getElementById('contenido');
        if (!el) return;
        e.preventDefault(); el.focus(); el.scrollIntoView({ block: 'start' });
      }}>Saltar al contenido</a>
      <div className="barra-ul" />
      <Aislada reinicio={reinicio} n="Cabecera"><Cabecera liga={liga} dc={yo.dc} pagina={paginaMenu} sv={sv || ''} onMenu={() => setMenu(true)} /></Aislada>
      <Aislada reinicio={reinicio} n="FranjaMods"><FranjaMods /></Aislada>
      {/* 📱 la M de Mods, sólo en el celular y donde hay algo para hacer (21/11/2026, mods_herramientas.jsx) */}
      <Aislada reinicio={reinicio} n="BotonModsFlot"><BotonModsFlot dc={yo.dc} k={(liga && liga.yo && liga.yo.k) || (yo.dc && yo.dc.clave) || ''} /></Aislada>
      {/* 🧪 la prueba en sombra del ELO nuevo (`?prev=elo`, prueba_elo.js): que se note que lo que ves no es lo de todos */}
      {prevElo() ? <p className="es-prueba-h" role="status">🧪 Prueba del ELO nuevo
        {pruebaE && pruebaE.desde ? ' · desde el ' + pruebaE.desde.slice(8, 10) + '/' + pruebaE.desde.slice(5, 7) : ''}
        {' · todos en 0 · sólo lo ves tú, no paga nada'}
        {/* ⚠️ «no llegó» y «nadie jugó» son cosas distintas: si el ciclo no la arma, no puede parecer una noche sin eventos */}
        {pruebaE && !pruebaE.desde ? ' · todavía no llegó del ciclo: abajo ves el ELO de siempre' : ''}
        {pruebaE && pruebaE.desde && !pruebaE.d ? ' · todavía nadie jugó: abajo ves el ELO de siempre' : ''}
        {' · '}<a href="?noprev=elo">quitar</a></p> : null}
      <Aislada reinicio={reinicio + (aviso ? '|' + aviso.texto + '|' + aviso.hasta : '')} n="AvisoWeb"><AvisoWeb aviso={aviso} /></Aislada>
      {/* 🆕 «hay una actualización» (13/10/2026): ver web/src/novedad.jsx */}
      <Aislada reinicio={reinicio} n="AvisoVersion"><AvisoVersion pagina={pagina} /></Aislada>
      {/* 🎬 «tu batalla ya tiene video» (25/11/2026): ver web/src/tu_video.jsx. Con la bienvenida, no; el tutorial abierto lo
          ve ella misma (espera a que no haya otra ventana). ⚠️ NO con `quiereTutorial()`: es «verdad» toda la primera semana,
          y justo los nuevos —el 42 % que juega una vez— no la verían nunca */}
      <Aislada reinicio={reinicio} n="TuVideo"><PopTuVideo muro={muro} yo={yo} pagina={pagina} ocupado={pagina === 'bienvenida'} /></Aislada>
      {pagina === 'bienvenida' ? <Aislada reinicio={reinicio} n="Bienvenida"><Suspense fallback={null}><Bienvenida liga={liga} dc={yo.dc} /></Suspense></Aislada> : null}
      {quiereTutorial() || repite.n ? <Aislada reinicio={reinicio} n="Tutorial"><Suspense fallback={null}><Tutorial liga={liga} dc={yo.dc} pagina={paginaMenu} sv={sv} pedido={repite} /></Suspense></Aislada> : null}
      {/* ❓ el «¿Cómo funciona?» de cada página con capítulo, y el aviso de que el tutorial es nuevo (comofunciona.jsx) */}
      <Aislada reinicio={reinicio} n="ComoFunciona"><ComoFunciona pagina={paginaMenu} /></Aislada>
      {/* ← volver a la página anterior de esta pestaña (25/11/2026, volver.jsx) */}
      <Aislada reinicio={reinicio} n="Volver"><Volver hash={hash} /></Aislada>
      <span id="contenido" tabIndex={-1} />
      {/* 🔑 UNA POR SERVIDOR, UNA POR LLAVE Y UNA POR PERSONA (18/11/2026), como las crews y los países: con la `key` fija,
          pasar de FFA a CEU dejaba puesto el filtro de «Su muro» (CEU sin esas publicaciones y sin chips: vacío), y de
          un perfil a otro la búsqueda de «Sus eventos» («0 de 4» sin buscador). Un `Aislada` roto rompía los siguientes.
          El perfil va sólo con la clave: `#/r/<k>/eventos` baja a la sección sin volver a montar */}
      {sv ? <Aislada reinicio={reinicio} key={'PerfilSv' + sv} n="PerfilSv" pagina><Suspense fallback={<Cargando />}><PerfilSv liga={liga} sv={sv} enc={enc} /></Suspense></Aislada>
        : pagina === 'cambios' ? <Aislada reinicio={reinicio} key="Cambios" n="Cambios" pagina><Suspense fallback={<Cargando />}><Cambios liga={liga} ver={partes[1] || null} antes={cambiosAntes} /></Suspense></Aislada>
        : pagina === 'kit' ? <Aislada reinicio={reinicio} key="Kit" n="Kit" pagina><Suspense fallback={<Cargando />}><Kit liga={liga} cod={partes[1] || ''} /></Suspense></Aislada>
        : pagina === 'socios' && partes[1] === 'sumar' ? <Aislada reinicio={reinicio} key="Sumar" n="Sumar" pagina><Suspense fallback={<Cargando />}><SumaTuServidor liga={liga} /></Suspense></Aislada>
        : pagina === 'socios' || pagina === 'mundo' ? <Aislada reinicio={reinicio} key="Socios" n="Socios" pagina><Suspense fallback={<Cargando />}><Socios liga={liga} /></Suspense></Aislada>
        : pagina === 'llave' && partes[1] ? <Aislada reinicio={reVivo} key={'Llave' + partes.slice(1).join('/')} n="Llave" pagina><Suspense fallback={<Cargando />}><Llave liga={liga} vivoL={vivoL} n={partes.slice(1).join('/')} raiz={raiz} dc={yo.dc} /></Suspense></Aislada>
        : pagina === 'tienda' ? <Aislada reinicio={reinicio} key="Tienda" n="Tienda" pagina><Suspense fallback={<Cargando />}><Tienda liga={liga} dc={yo.dc} /></Suspense></Aislada>
        : pagina === 'invitar' ? <Aislada reinicio={reinicio} key="Invitar" n="Invitar" pagina><Suspense fallback={<Cargando />}><Invitar liga={liga} dc={yo.dc} /></Suspense></Aislada>
        : pagina === 'reels' ? <Aislada reinicio={reinicio} key="Reels" n="Reels" pagina><Suspense fallback={<Cargando />}><Reels liga={liga} inicio={partes[1] || ''} /></Suspense></Aislada>
        : pagina === 'pase' ? <Aislada reinicio={reinicio} key="Pase" n="Pase" pagina><Suspense fallback={<Cargando />}><Pase liga={liga} dc={yo.dc} /></Suspense></Aislada>
        : pagina === 'crew' && partes[1] && crewAj !== null ? <Aislada reinicio={reinicio} key={'CrewAj' + partes[1]} n="CrewAj" pagina><Suspense fallback={<Cargando />}><AjustesCrew liga={liga} id={crewId} sec={crewAj} /></Suspense></Aislada>
        : pagina === 'crew' && partes[1] ? <Aislada reinicio={reinicio} key={'Crew' + partes[1]} n="Crew" pagina><Suspense fallback={<Cargando />}><PaginaCrew liga={liga} id={crewId} /></Suspense></Aislada>
        : pagina === 'pais' && partes[1] ? <Aislada reinicio={reinicio} key={'Pais' + partes[1]} n="Pais" pagina><Suspense fallback={<Cargando />}><PaginaPais liga={liga} cc={partes[1]} /></Suspense></Aislada>
        : pagina === 'r' && partes[1] ? <Aislada reinicio={reinicio} key={'Perfil' + partes[1]} n="Perfil" pagina><Suspense fallback={<Cargando />}><Perfil liga={liga} dc={yo.dc} k={partes[1]} tab={partes[2] || ''} /></Suspense></Aislada>
        : pagina === 'competencia' && partes[1] ? <Aislada reinicio={reinicio} key={'Competencia' + partes[1]} n="Competencia" pagina><Suspense fallback={<Cargando />}><PaginaCompetencia liga={liga} id={partes[1]} /></Suspense></Aislada>
        : pagina === 'global' && partes[1] ? <Aislada reinicio={reinicio} key={'PerfilGlobal' + partes[1]} n="PerfilGlobal" pagina><Suspense fallback={<Cargando />}><PerfilGlobal liga={liga} k={partes[1]} /></Suspense></Aislada>
        : pagina === 'salon' ? <Aislada reinicio={reinicio} key="Salon" n="Salon" pagina><Suspense fallback={<Cargando />}><SalonFama liga={liga} enc={enc} /></Suspense></Aislada>
        : pagina === 'competencias' ? <Aislada reinicio={reinicio} key="Competencias" n="Competencias" pagina><Suspense fallback={<Cargando />}><Competencias liga={liga} dc={yo.dc} sub={partes[1] || ''} /></Suspense></Aislada>
        : pagina === 'inventario' ? <Aislada reinicio={reinicio} key="Inventario" n="Inventario" pagina><Suspense fallback={<Cargando />}><PaginaInventario liga={liga} dc={yo.dc} carta={partes[1] || ''} ranura={partes[2] || ''} /></Suspense></Aislada>
        : pagina === 'crews' ? <Aislada reinicio={reinicio} key="Crews" n="Crews" pagina><Suspense fallback={<Cargando />}><CrewsPagina liga={liga} dc={yo.dc} qs={(hash || '').split('?')[1] || ''} /></Suspense></Aislada>
        : pagina === 'socio' ? <Aislada reinicio={reinicio} key="Socio" n="Socio" pagina><Suspense fallback={<Cargando />}><PanelSocio liga={liga} q={(hash || '').split('?')[1] || ''} /></Suspense></Aislada>
        : pagina === 'ligas' ? <Aislada reinicio={reinicio} key="Ligas" n="Ligas" pagina><Suspense fallback={<Cargando />}><LigasPagina liga={liga} id={ligaId} /></Suspense></Aislada>
        : pagina === 'tarjetas' ? <Aislada reinicio={reinicio} key="Tarjetas" n="Tarjetas" pagina><Suspense fallback={<Cargando />}><Tarjetas liga={liga} dc={yo.dc} tipo={partes[1] || ''} q={(hash || '').split('?')[1] || ''} /></Suspense></Aislada>
        : pagina === 'guia' ? <Aislada reinicio={reinicio} key="Guia" n="Guia" pagina><Suspense fallback={<Cargando />}><Guia liga={liga} dc={yo.dc} /></Suspense></Aislada>
        : pagina === 'publicaciones' ? <Aislada reinicio={reinicio} key="Publicaciones" n="Publicaciones" pagina><Suspense fallback={<Cargando />}><Publicaciones liga={liga} enc={enc} foco={partes[1] || ''} /></Suspense></Aislada>
        : pagina === 'eventos' || pagina === 'avisos' ? <Aislada reinicio={reVivo} key="Eventos" n="Eventos" pagina><Suspense fallback={<Cargando />}><Eventos liga={liga} vivoL={vivoL} dia={pagina === 'eventos' ? partes[1] || null : null} avisos={pagina === 'avisos'} /></Suspense></Aislada>
        // el Ranking (02/10/2026); `#/duelos` es el link viejo del de Duelos
        : pagina === 'ranking' || pagina === 'duelos' ? <Aislada reinicio={reinicio} key="Ranking" n="Ranking" pagina><Suspense fallback={<Cargando />}><Ranking liga={liga} sub={pagina === 'duelos' ? 'duelos' : partes[1] || 'temporada'} ver={partes[2] || ''} dc={yo.dc} raiz={raiz} /></Suspense></Aislada>
        // verificarse desde la página (01/10/2026), y Mi cuenta entera desde el 02/10 (Dlx: «me gusta cómo lo propusiste»)
        : pagina === 'cuenta' && partes[1] === 'verificar' ? <Aislada reinicio={reinicio} key="Verificar" n="Verificar" pagina><Suspense fallback={<Cargando />}><PaginaVerificar liga={liga} dc={yo.dc} /></Suspense></Aislada>
        : pagina === 'dashboard' ? <Aislada reinicio={reinicio} key="Dashboard" n="Dashboard" pagina><Suspense fallback={<Cargando />}><Dashboard dc={yo.dc} liga={liga} /></Suspense></Aislada>
        : pagina === 'mods' ? <Aislada reinicio={reinicio} key="Mods" n="Mods" pagina><Suspense fallback={<Cargando />}><ModsPagina dc={yo.dc} liga={liga} /></Suspense></Aislada>
        : pagina === 'cuenta' ? <Aislada reinicio={reinicio} key="Cuenta" n="Cuenta" pagina><Suspense fallback={<Cargando />}><Cuenta liga={liga} dc={yo.dc} parte={partes[1] || null} tema={tema} onTema={elegirTema} temaSv={temaSv} onTemaSv={elegirSv} /></Suspense></Aislada>
        : pagina === 'ajustes' ? <Aislada reinicio={reinicio} key="Ajustes" n="Ajustes" pagina><Suspense fallback={<Cargando />}><Cuenta liga={liga} dc={yo.dc} parte={partes[1] || null} tema={tema} onTema={elegirTema} temaSv={temaSv} onTemaSv={elegirSv} /></Suspense></Aislada> : <div className={'pg-entra' + (va ? ' va-' + va : '')} key="inicio">
        {/* 🐣 LAS MISIONES PARA NUEVOS, LO PRIMERO DEL INICIO (17/11/2026, Dlx a la maqueta, «Tus elecciones»): antes iban
            dentro del lobby, debajo de las historias, el escenario y la tira, y en un teléfono de 844 empezaban en y=1118.
            Sólo mientras dura tu semana (`pistaDe()` de nuevos.jsx: si no, no se dibuja y el Inicio queda como siempre) */}
        <Aislada reinicio={reinicio} n="PistaNuevos"><div className="nvp-arriba"><PistaNuevos liga={liga} dc={yo.dc} /></div></Aislada>
        {/* 🏠 el Dashboard, sólo para Dlx: si la cuenta del navegador no es la suya ni se baja (la puerta igual es el servidor) */}
        {yo.dc && String(yo.dc.id) === DUENO && !vistaMods() ? <Aislada reinicio={reinicio} n="PanelDueno"><Suspense fallback={null}><PanelDueno liga={liga} /></Suspense></Aislada> : null}
        <Aislada reinicio={reinicio} n="Historias"><Historias liga={liga} grupos={grupos} vistos={vistos || {}} onAbrir={setHistoria} /></Aislada>
        <Aislada reinicio={reVivo} n="Hero"><Hero liga={liga} vivoL={vivoL}><Aislada reinicio={reinicio} n="Tira"><Tira liga={liga} /></Aislada></Hero></Aislada>
        {(() => { try { return localStorage.getItem('lg:prev-escenario'); } catch (e) { return null; } })() ? <Aislada reinicio={reinicio} n="EscenarioPrueba"><EscenarioPrueba liga={liga} /></Aislada> : null}
        {/* 🔴 las batallas de liga que se están jugando (04/11/2026). Se apaga sola: casi siempre no se ve */}
        <Aislada reinicio={reinicio} n="LigasAhora"><BatallasAhora liga={liga} cls="sec" /></Aislada>
        {/* 🏆 la semana: en qué vas en cada competencia (26/10/2026, Dlx: «me gustan… las posiciones de los mini eventos»,
            y el Inicio, como está). Se apaga sola sin datos */}
        {/* 📅 y desde el 12/11/2026 vive en el panel, al lado de la Tienda (Dlx: «eso de la semana día 3 de 7 creo que
            deberíamos hacerlo un botón dentro del panel al costado de tienda»): ver `PnSemana` en panel.jsx */}
        {pasosEnInicio(yo.dc) ? <Aislada reinicio={reinicio} n="PrimerosPasos"><Suspense fallback={null}><PrimerosPasos liga={liga} dc={yo.dc} /></Suspense></Aislada> : null}
        {/* 🚪 EL INICIO ES UN LOBBY (Dlx, 13/10/2026: «que se sienta como un inicio, un home, un lobby»): el escenario,
            las puertas, y después todo lo de antes. ⚠️ NO SE SACA NADA SIN NÚMEROS (Dlx, el mismo día, al ver el Inicio
            de seis bloques: «enfoquémonos en cambiar, mejorar o mover; remover, al último de la lista»): volvieron los
            cinco, Se busca subió (le gusta en el Inicio) y Encuestas se achicó. Qué se toca acá lo cuenta `TOQUES` */}
        <Aislada reinicio={reinicio} n="IrA"><IrA raiz={raiz} /></Aislada>
        <Aislada reinicio={reinicio} n="Lobby"><Lobby liga={liga} dc={yo.dc} enc={enc} /></Aislada>
        <Aislada reinicio={reinicio} n="Instalar"><Instalar /></Aislada>
        {/* 🎬 Reels de la semana (24/11/2026): una fila más, sin sacar nada (reels_fila.jsx) */}
        <Aislada reinicio={reinicio} n="ReelsFila"><Suspense fallback={null}><ReelsFila /></Suspense></Aislada>
        {/* 🎮 con el lobby, cada dato una vez (Dlx, 13/10/2026, «3. A» y «4. A»): tu próximo evento va en el botón y la
            semana en la puerta de Eventos, y Se busca es el destacado amarillo; el tablero entero sigue en el Ranking.
            Por eso Fechas y el panel de Se busca ya no van acá. Y tampoco el panel de Misiones y el Pase (Dlx, 13/10/2026:
            «hay uno de panel pero abajo hay misiones y el pase de rapero… quita esa parte de abajo»): el Pase ya es una
            puerta y está en tu barra, y las Misiones viven en el Ranking. `Panel` de medio.jsx queda, sin usar */}
        <Aislada reinicio={reinicio} n="Noticias"><Noticias liga={liga} raiz={raiz} /></Aislada>
        {/* 🧪 `?prev=loultimo`: una novedad de cada tipo, con carta nueva y sin ella (`muestraLU()` de medio.jsx) */}
        {(() => { try { return localStorage.getItem('lg:prev-loultimo'); } catch (e) { return null; } })() ? <>
          <Aislada reinicio={reinicio} n="NoticiasPrueba"><Noticias liga={liga} raiz={raiz} prueba="todo" /></Aislada>
          <Aislada reinicio={reinicio} n="NoticiasPrueba2"><Noticias liga={liga} raiz={raiz} prueba="logro" /></Aislada></> : null}
        {/* 🗳️ Encuestas, Tus eventos y Divisiones ya no van acá (Dlx, 12/11/2026: «así borramos la parte de abajo que dice
            encuestas, tus eventos y divisiones»): las encuestas se votan en el Premio gratis de la fila de arriba (y en
            Publicaciones), tus eventos están en tu perfil y las divisiones en el Ranking. `Encuestas` queda, sin usar acá */}
        <Aislada reinicio={reinicio} n="LosQueMandan"><LosQueMandan liga={liga} dc={yo.dc} /></Aislada>
        <Aislada reinicio={reinicio} n="Merch"><Merch liga={liga} /></Aislada>
        {/* 📊 La Liga en números ya no va en el Inicio (Dlx, 13/10/2026: «QUITA LA liga en numeros de inicio»): vive en
            Socios, que es donde estaba desde la 2.87 además de acá */}
      </div>}
      <Aislada reinicio={reinicio} n="Pie"><Pie liga={liga} /></Aislada>
      <Aislada reinicio={reinicio} n="Tabbar"><Tabbar liga={liga} dc={yo.dc} pagina={paginaMenu} /></Aislada>
      {pagina && !sv ? <Aislada reinicio={reinicio} n="Subir"><Subir key={paginaMenu} /></Aislada> : null}
      <Aislada reinicio={reinicio} n="Menu"><Menu liga={liga} abierto={menu} onCerrar={() => setMenu(false)} tema={tema} onTema={elegirTema} temaSv={temaSv} pagina={paginaMenu} /></Aislada>
      {historia !== null ? <Aislada reinicio={reinicio} n="Visor"><Visor liga={liga} grupos={grupos} abierto={historia} onCerrar={() => { setDesde(''); cerrarHistoria(); }} onVisto={visto} vistos={vistos || {}} raiz={raiz} desde={desde} /></Aislada> : null}
      {hojaCm ? <Aislada reinicio={reinicio} key={'hcm' + hojaCm.id} n="HojaComentarios"><Suspense fallback={null}><HojaComentarios liga={liga} it={hojaCm} onCerrar={() => setHojaCm(null)} /></Suspense></Aislada> : null}
      {propias && historia === null ? <Aislada reinicio={reinicio} n="VisorPerfil"><Visor liga={liga} grupos={[propias]} abierto={0} onCerrar={() => { setDesde(''); setPropias(null); }} onVisto={visto} vistos={vistos || {}} raiz={raiz} desde={desde} /></Aislada> : null}
      <Aislada reinicio={reinicio} n="Video"><VentanaVideo /></Aislada>
      <Aislada reinicio={reinicio} n="AvisoPromo"><AvisoPromo /></Aislada>
      <Aislada reinicio={reinicio} n="FichaHover"><FichaHover liga={liga} /></Aislada>
      {carta ? <Aislada reinicio={reinicio} key={'c' + carta} n="VisorCarta"><Suspense fallback={null}><VisorCarta liga={liga} dc={yo.dc} k={String(carta).split('|')[0]} inicial={String(carta).split('|')[1] || ''} onCerrar={cerrarCarta} /></Suspense></Aislada> : null}
    </div>
  );
}
