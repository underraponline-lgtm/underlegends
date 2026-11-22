// 🎧 LOS BEATS DE LAS HISTORIAS (21/11/2026). Dlx: «que algunas historias tengan como instrumentales, beats, sonidos».
//
// 🔑 HECHOS ACÁ, CON WEBAUDIO: ningún archivo y ningún beat de otro. Un instrumental bajado de internet es de alguien —y
// una página pública que lo toca sin permiso tiene un problema—; uno sintetizado en el navegador es nuestro, no pesa
// nada (este archivo) y no se baja nada. Tres estilos del freestyle, de bombo, caja, platillo, 808 y unas notas:
//   · `boombap` — 88 BPM con swing: el de los títulos y las felicitaciones
//   · `trap`    — 140 BPM, platillos de a 16 con redobles y un 808 largo: el chat que explota, el rango, tu servidor
//   · `drill`   — 142 BPM, platillos de a tres y un 808 que se desliza: los desafíos, el cara a cara, la polémica, las cazas
//
// ⚠️ EL SONIDO NECESITA UN TOQUE. Los navegadores no dejan sonar una página sola: el `AudioContext` arranca o se despierta
// con un gesto (abrir la historia lo es; en el iPhone, el primer toque adentro del visor: `despertar()`). Y se puede
// silenciar (`ponerMudo()`, guardado en este navegador como `lg:beats`): es lo primero que alguien busca cuando una
// página suena.
//
// El reloj es el de siempre para WebAudio: un `setInterval` corto que agenda las notas de los próximos 120 ms con la hora
// del propio audio, así el ritmo no se tropieza aunque la página esté ocupada.
//
// 🎚️ TANDA 2, EL MISMO DÍA: LOS BEATS DE VERDAD. Dlx: *«ahí a la sesión principal le añadí la lista de beatmakers
// permitidos… puedes usar beats así… pero también intenta integrar bien las instrumentales en las historias»*. Los
// recortes de los beatmakers con permiso (`datos/beatmakers.json`) viven en `bot/paginas/beats/` y su lista con el
// crédito en `beats_lista.json` (los hace `herramientas/beats_historias.py`). Cómo se integran:
//   · cada estilo tiene varios; el círculo elige uno (por su id: siempre el mismo para ese círculo, distinto entre
//     círculos) y, si la historia siguiente es del MISMO estilo, el beat sigue sonando: no vuelve a arrancar
//   · de un estilo a otro, y cuando un recorte se termina, se CRUZAN (`CRUCE` s): uno baja mientras el otro sube
//   · mantener apretada la historia pausa el beat (como la historia); la pestaña oculta, también
//   · lo que suena se dice en la historia, con el link a su video (`alCambiar()`): el crédito es parte del permiso
//   · sin recortes de un estilo, o si el archivo no baja, suena el sintetizado de arriba: nunca se queda mudo por eso
//
// ⏳ TANDA 3, LA HISTORIA ESPERA A SU CANCIÓN (21/11/2026). Dlx: *«las historias cargan algunas y está a medias de terminar y la
// canción no ha empezado»*. Cada recorte son ~520 KB y se decodifica entero antes de sonar: desde una PC baja en 0,7 s, en un
// celular varios segundos, y el reloj de la historia no lo esperaba. Ahora:
//   · `esperando()` dice si la historia pidió un beat que todavía no suena, y el visor no corre el reloj mientras tanto (con
//     un tope: ver `ESPERA_BEAT` en abajo.jsx). La barra y la canción arrancan juntas
//   · `precargar()` baja el de la historia que sigue (y el del círculo que tocas o tienes debajo del mouse) antes de llegar:
//     sólo los bytes, que no piden audio encendido. Con «ahorro de datos», no se adelanta nada
//   · entre una historia con beat y una sin, el audio se queda encendido y callado (`parar()`), y se apaga recién al cerrar
//     el visor (`apagar()`): volver a encenderlo sin un toque es lo que el iPhone puede no dejar
//
// 🍏 TANDA 4, EL IPHONE (22/11/2026). Dlx: *«en mi iphone no escucho el beat o a veces no… mi iphone tiene volumen pero no
// escucho nada»*. Dos causas, las dos sólo del iPhone:
//   · EL INTERRUPTOR DE SILENCIO. En iOS el audio de WebAudio es de la categoría «ambiente», y el modo silencio lo calla con
//     el volumen arriba (un video no: es «reproducción»). `prender()` pide «reproducción» mientras el visor está abierto
//     (`navigator.audioSession`, iOS 17 en adelante), como Instagram, y al cerrar vuelve a «auto». En un iOS más viejo hace
//     lo mismo un <audio> mudo en bucle (`/beats/silencio.wav`: de este sitio, que la CSP no deja `data:` en audio)
//   · EL TOQUE. En un celular, APOYAR el dedo no cuenta como gesto para encender audio: cuenta SOLTARLO o el click. El visor
//     lo despertaba al apoyar (`pointerdown`), así que con el audio dormido —al cerrar el visor se apaga, y bloquear el
//     teléfono lo deja «interrumpido»— no volvía a encenderse: la historia esperaba sus 4 s y seguía muda. Ahora lo prende
//     cualquier toque de la página mientras el visor está abierto, al soltar (`window`, abajo), también el que lo abre:
//     React termina de abrir el visor antes de que ese click llegue a `window`, así que ya hay qué prender

import LISTA from './beats_lista.json';

const VOL = 0.3;
const MUDO = 'lg:beats';
let ctx = null;
let master = null;
let comp = null;
let ruidoB = null;
let reloj = 0;
let actual = '';
let paso = 0;
let proximo = 0;
//: el estilo que pidió la historia que se ve ('' = nada): el de verdad o el sintetizado
let quiere = '';
//: el estilo que se oye de verdad ('' = nada todavía): lo que `esperando()` compara con `quiere`
let sonando = '';
//: el visor está abierto: el audio se queda encendido aunque la historia de ahora no traiga beat (lo apaga `apagar()`)
let encendido = false;

// 🍏 (tanda 4) el iPhone, y el iPad que se hace pasar por Mac
const IOS = typeof navigator !== 'undefined' && (/iP(hone|ad|od)/.test(navigator.userAgent || '') ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
let mudoHtml = null;
/** La categoría del audio de la página en iOS 17+: 'playback' suena con el modo silencio; 'auto' es la de siempre */
function sesion(tipo) {
  try { if (typeof navigator !== 'undefined' && navigator.audioSession) navigator.audioSession.type = tipo; } catch (e) { /* sin la API */ }
}
/** 🍏 Prende el audio: tiene que pasar ADENTRO de un toque (al soltar el dedo o en un click). Ver la tanda 4, arriba */
export function prender() {
  if (mudo()) return;
  sesion('playback');
  if (!abrir()) return;
  if (ctx.state !== 'running' && ctx.state !== 'closed' && !document.hidden) ctx.resume().catch(() => {});
  if (IOS && !(typeof navigator !== 'undefined' && navigator.audioSession)) {
    try {
      if (!mudoHtml) {
        mudoHtml = new Audio('/beats/silencio.wav');
        mudoHtml.loop = true;
        mudoHtml.preload = 'auto';
        mudoHtml.setAttribute('x-webkit-airplay', 'deny');
      }
      const pr = mudoHtml.play();
      if (pr && pr.catch) pr.catch(() => {});
    } catch (e) { /* sin <audio> */ }
  }
}
function soltarSesion() {
  sesion('auto');
  if (mudoHtml) { try { mudoHtml.pause(); } catch (e) { /* ya estaba */ } }
}
// cada toque de la página, al soltar, prende el audio si el visor lo está usando (y no hace nada si no)
if (typeof window !== 'undefined') {
  ['pointerup', 'touchend', 'click', 'keydown'].forEach((ev) => window.addEventListener(ev, () => { if (quiere || encendido) prender(); }, { passive: true }));
  // (para medirlo desde afuera: en qué estado está el audio, qué pide la historia y qué categoría tiene la página)
  window.__beat = () => ({ audio: ctx ? ctx.state : '', quiere, sonando, encendido, sesion: (navigator.audioSession || {}).type || '',
    mudoHtml: mudoHtml ? (mudoHtml.paused ? 'quieto' : 'sonando') : '' });
}

export const mudo = () => { try { return localStorage.getItem(MUDO) === '0'; } catch (e) { return false; } };
export function ponerMudo(v) {
  try { localStorage.setItem(MUDO, v ? '0' : '1'); } catch (e) { /* sin guardar: vale para esta visita */ }
  if (v) { parar(); soltarSesion(); }
}

function abrir() {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  ctx = new AC();
  // 🍏 el iPhone deja sonar un contexto recién después de que algo suena adentro del toque: una muestra en silencio
  try { const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0); } catch (e) { /* sin audio */ }
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(comp).connect(ctx.destination);
  // el ruido blanco de la caja y los platillos, una vez
  ruidoB = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = ruidoB.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // con la pestaña oculta, quieto; al volver, sigue
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else if (quiere || encendido) ctx.resume().catch(() => {});
  });
  return ctx;
}

/** Despierta el audio desde un gesto (el iPhone lo pide adentro del toque). También el «interrumpido» de iOS */
export function despertar() {
  if (quiere || encendido) prender();
}
/** Mantener apretada la historia: el beat espera con ella. */
export function pausar() { if (ctx && quiere) ctx.suspend().catch(() => {}); }
export function seguir() { if (ctx && quiere && !document.hidden && ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume().catch(() => {}); }

// ── los instrumentos ──
const env = (g, t, pico, cae) => {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(pico, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + cae);
};

function bombo(t, v = 1) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(160, t);
  o.frequency.exponentialRampToValueAtTime(48, t + 0.11);
  env(g, t, 0.95 * v, 0.38);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.42);
}

function ruido(t, dur, filtro, f, q, pico) {
  const s = ctx.createBufferSource();
  s.buffer = ruidoB;
  const fl = ctx.createBiquadFilter();
  fl.type = filtro;
  fl.frequency.value = f;
  fl.Q.value = q;
  const g = ctx.createGain();
  env(g, t, pico, dur);
  s.connect(fl).connect(g).connect(master);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}

function caja(t, v = 1) {
  ruido(t, 0.2, 'bandpass', 1900, 0.9, 0.55 * v);
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(210, t);
  o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
  env(g, t, 0.35 * v, 0.12);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.15);
}

// la palma del trap: tres golpes de ruido muy juntos
function palma(t, v = 1) {
  [0, 0.011, 0.023].forEach((d, i) => ruido(t + d, i === 2 ? 0.16 : 0.03, 'bandpass', 1500, 1.1, 0.5 * v));
}

function plato(t, v = 1, abierto = false) {
  ruido(t, abierto ? 0.22 : 0.045, 'highpass', 7500, 0.7, 0.22 * v);
}

// el 808: un seno largo, un poco saturado, que puede deslizarse a otra nota
const SAT = (() => {
  const c = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const x = (i / 128) - 1; c[i] = Math.tanh(2.2 * x); }
  return c;
})();
function ochocientos(t, f, dur, v = 1, hasta = 0) {
  const o = ctx.createOscillator();
  const sh = ctx.createWaveShaper();
  sh.curve = SAT;
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(f * 1.9, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
  if (hasta) o.frequency.setTargetAtTime(hasta, t + dur * 0.45, 0.05);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.55 * v, t + 0.006);
  g.gain.setTargetAtTime(0.0001, t + dur * 0.7, dur * 0.18);
  o.connect(sh).connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.3);
}

// una nota de teclado: triángulo y seno juntos, con un filtro que la apaga
function nota(t, f, dur, v = 1, brillo = 2400) {
  const fl = ctx.createBiquadFilter();
  fl.type = 'lowpass';
  fl.frequency.setValueAtTime(brillo, t);
  fl.frequency.exponentialRampToValueAtTime(400, t + dur);
  const g = ctx.createGain();
  env(g, t, 0.09 * v, dur);
  fl.connect(g).connect(master);
  for (const [tipo, m] of [['triangle', 1], ['sine', 2]]) {
    const o = ctx.createOscillator();
    o.type = tipo;
    o.frequency.value = f * m;
    o.connect(fl);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const en = (patron, s) => patron[s] === 'x';
const suave = (patron, s) => patron[s] === 'o';

// ── los estilos: un compás son 16 semicorcheas ──
const ESTILOS = {
  boombap: {
    bpm: 88, swing: 0.16, compases: 4,
    // La menor: La, Fa, Do, Mi
    raiz: [45, 41, 48, 40],
    acordes: [[57, 60, 64], [53, 57, 60, 64], [55, 60, 64], [52, 56, 59]],
    tocar(t, c, s, seg) {
      const K = c % 2 ? 'x.......x.x.....' : 'x.....x...x...o.';
      const S = '....x.......x...';
      if (en(K, s)) { bombo(t); ochocientos(t, hz(this.raiz[c] - 12) * 2, seg * 3, 0.45); }
      if (suave(K, s)) bombo(t, 0.5);
      if (en(S, s)) caja(t);
      if (s % 2 === 0) plato(t, s % 4 ? 0.6 : 0.9);
      if (s === 14 && c === 3) plato(t, 0.7, true);
      if (s === 0 || s === 10) this.acordes[c].forEach((m, i) => nota(t + i * 0.012, hz(m), seg * 6, 0.9, 2000));
    },
  },
  trap: {
    bpm: 140, swing: 0, compases: 2,
    // Do# menor
    notas: [37, 37, 40, 35],
    tocar(t, c, s, seg) {
      const K = c ? 'x.....x....x..x.' : 'x......x..x.....';
      if (en(K, s)) { bombo(t, 0.8); ochocientos(t, hz(this.notas[(c * 2 + (s >= 8 ? 1 : 0)) % 4]), seg * 5, 1); }
      if (s === 8) palma(t);
      // los platillos de a 16, con el redoble al final del segundo compás
      if (c === 1 && s >= 12) { plato(t, 0.7); plato(t + seg / 2, 0.55); if (s >= 14) plato(t + seg / 4, 0.4); } else plato(t, s % 4 === 2 ? 0.45 : 0.75);
      // la campanita: arriba y poca
      const mel = c ? { 0: 73, 3: 76, 6: 71 } : { 0: 73, 3: 80, 6: 76, 10: 73 };
      if (mel[s]) nota(t, hz(mel[s]), seg * 2.5, 0.75, 5200);
    },
  },
  drill: {
    bpm: 142, swing: 0, compases: 2,
    tocar(t, c, s, seg) {
      const K = c ? '..x.......x..x..' : 'x.........x.....';
      const S = c ? '........x.....x.' : '........x.......';
      if (en(K, s)) {
        bombo(t, 0.75);
        // el 808 que se desliza: Sol# que sube a Si, o baja a Fa#
        if (s === 0 || s === 2) ochocientos(t, hz(32), seg * 7, 1, hz(c ? 30 : 35));
        else ochocientos(t, hz(c ? 35 : 32), seg * 3, 0.85);
      }
      if (en(S, s)) caja(t, 0.95);
      // platillos de a tres (el balanceo del drill)
      if (s % 3 === 0) plato(t, 0.7);
      if (s === 15) plato(t + seg / 2, 0.5);
      // dos notas oscuras: medio tono de distancia
      const mel = c ? { 0: 68, 4: 67, 8: 68, 11: 71 } : { 0: 68, 4: 67, 8: 68, 12: 64 };
      if (mel[s]) nota(t, hz(mel[s]), seg * 3, 0.7, 1500);
    },
  },
};
export const ESTILOS_BEAT = Object.keys(ESTILOS);

function programar() {
  const E = ESTILOS[actual];
  if (!E || !ctx) return;
  const seg = 60 / E.bpm / 4;
  while (proximo < ctx.currentTime + 0.12) {
    const i = paso % (16 * E.compases);
    const s = i % 16;
    E.tocar(proximo + (s % 2 ? E.swing * seg : 0), Math.floor(i / 16), s, seg);
    proximo += seg;
    paso += 1;
  }
}

/** El sintetizado: toca ese estilo (o lo deja sonando si ya es ese). */
function sintesis(estilo) {
  if (!ESTILOS[estilo] || !abrir()) return;
  if (actual === estilo && reloj) return;
  const t = ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t);
  // de otro estilo, un respiro corto en vez de cortar en seco
  master.gain.linearRampToValueAtTime(actual && actual !== estilo ? 0.0001 : master.gain.value, t + 0.12);
  master.gain.linearRampToValueAtTime(VOL, t + 0.6);
  actual = estilo;
  sonando = estilo;
  paso = 0;
  proximo = t + 0.14;
  if (!reloj) reloj = setInterval(programar, 25);
}

function pararSintesis() {
  if (!ctx || !actual) return;
  const t = ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t);
  master.gain.linearRampToValueAtTime(0.0001, t + 0.35);
  actual = '';
  const r = reloj;
  setTimeout(() => { if (!actual) { clearInterval(r); if (reloj === r) reloj = 0; } }, 420);
}

// ── 🎚️ LOS BEATS DE VERDAD ──
const RAIZ = '/beats/';
//: el volumen de los recortes (vienen todos en −16 LUFS) y cuánto dura el cruce de uno a otro
const VOL_REAL = 0.55;
const CRUCE = 0.9;
let real = null;               // {estilo, i, src, g, fin}
let vigia = 0;
let turno = 0;
const bufs = new Map();
const oyentes = new Set();
let info = null;

/** Quién suena (`{t, b, u}`: título, beatmaker y su video), para el crédito de la historia. Devuelve cómo dejar de oír. */
export function alCambiar(fn) {
  oyentes.add(fn);
  fn(info);
  return () => { oyentes.delete(fn); };
}
const avisar = (x) => {
  if (info === x) return;
  info = x;
  oyentes.forEach((f) => { try { f(x); } catch (e) { /* un oyente roto no frena el beat */ } });
};
// 🔊 TANDA 5, LAS PROMOS SUENAN (22/11/2026). Dlx: *«B, que suenen en sus promos y tmb en otras historias o publicaciones
// así como instagram que algunas tienen sonido»*. Lo que la gente de la Liga promociona en los canales de promoción vive
// en R2 (lo deja ahí `herramientas/sonidos_promos.py`, que corre desde una PC: YouTube no deja bajar desde GitHub):
//   · `promos`: un recorte por video. Una historia o publicación de promo pide el estilo `'p:<id del video>'` y suena con
//     SU canción (la única de su lista); si el video no tiene recorte, no suena
//   · `beats`: los instrumentales con estilo, que se suman a los de `beats_lista.json` para todas las historias
// La lista se pide una vez (`cargarExtras()`, como mucho una por hora) al abrir las historias o Publicaciones; quien la
// necesita se entera con `alExtras()`. R2 deja pedirla desde la página (CORS) y la CSP la deja en `connect-src`
const R2 = 'https://pub-70d5821d06a8432c9cffd0c102195000.r2.dev/';
let extras = null;
let pidiendoX = null;
const oyentesX = new Set();
const deR2 = (p) => Object.assign({}, p, { src: R2 + p.a });
const lista = (estilo) => {
  if (String(estilo || '').startsWith('p:')) {
    const p = extras && extras.promos && extras.promos[estilo.slice(2)];
    return p ? [deR2(p)] : [];
  }
  const xs = (LISTA && LISTA[estilo]) || [];
  const ys = (extras && extras.beats && extras.beats[estilo]) || [];
  return ys.length ? xs.concat(ys.map(deR2)) : xs;
};
/** De dónde se baja un recorte: R2 (los de las promos) o `/beats/` de la página */
const url = (p) => p.src || RAIZ + p.a;
const hashS = (s) => { let h = 7; for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
export const hayReales = (estilo) => lista(estilo).length > 0;
/** ¿Ese video de una promo tiene su recorte para sonar? */
export const hayPista = (id) => !!(id && extras && extras.promos && extras.promos[id]);
/** La ficha del recorte de una promo (`{t, b, u, i?}`), para mostrar qué suena antes de tocarlo */
export const pistaDe = (id) => (hayPista(id) ? extras.promos[id] : null);
/** Pide la lista de R2 (una vez; si falla, la próxima vez que alguien la pida). Devuelve la promesa */
export function cargarExtras() {
  if (extras) return Promise.resolve(extras);
  if (pidiendoX) return pidiendoX;
  const v = Math.floor(Date.now() / 3600000);
  pidiendoX = fetch(R2 + 'sonidos/lista.json?v=' + v)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      if (j && j.promos) {
        extras = j;
        oyentesX.forEach((f) => { try { f(); } catch (e) { /* un oyente roto no frena al resto */ } });
      }
      return extras;
    })
    .catch(() => null)
    .finally(() => { pidiendoX = null; });
  return pidiendoX;
}
/** Avisa cuando llega la lista de R2. Devuelve cómo dejar de oír */
export function alExtras(fn) { oyentesX.add(fn); return () => { oyentesX.delete(fn); }; }

// los bytes, aparte de lo decodificado: bajarlos no pide audio encendido, así que se pueden adelantar (`precargar()`).
// La clave es la dirección entera: los de la página y los de R2 conviven
const crudos = new Map();
function bajar(a) {
  if (!crudos.has(a)) {
    crudos.set(a, fetch(a).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); }));
    // ocho como mucho (son ~520 KB cada uno)
    if (crudos.size > 8) crudos.delete(crudos.keys().next().value);
    crudos.get(a).catch(() => crudos.delete(a));
  }
  return crudos.get(a);
}

function cargar(a) {
  if (!bufs.has(a)) {
    // una copia: decodificar se queda con el ArrayBuffer, y el mismo recorte puede tener que decodificarse otra vez
    bufs.set(a, bajar(a).then((ab) => new Promise((res, rej) => ctx.decodeAudioData(ab.slice(0), res, rej))));
    // como mucho cuatro en memoria (uno decodificado son ~15 MB)
    if (bufs.size > 4) bufs.delete(bufs.keys().next().value);
    bufs.get(a).catch(() => bufs.delete(a));
  }
  return bufs.get(a);
}

/** ⏭️ Baja de antes el recorte que va a sonar en una historia de ese estilo y ese círculo (el mismo que elegiría `tocar()`).
 * Silenciado, sin recortes o con «ahorro de datos», nada. */
export function precargar(estilo, semilla) {
  const xs = lista(estilo);
  if (!xs.length || mudo()) return;
  try { if (navigator.connection && navigator.connection.saveData) return; } catch (e) { /* sin el dato */ }
  bajar(url(xs[hashS(semilla) % xs.length])).catch(() => {});
}

/** ⏳ ¿La historia pidió un beat que todavía no se oye? (bajando, decodificando o con el audio sin encender). El visor
 * no corre el reloj mientras tanto, con un tope. Silenciado o sin beat, nunca espera. */
export function esperando() {
  if (!quiere || mudo()) return false;
  return sonando !== quiere || !ctx || ctx.state !== 'running';
}

function soltarReal(cruce) {
  if (!real || !ctx) return;
  const r = real;
  real = null;
  const t = ctx.currentTime;
  r.g.gain.cancelScheduledValues(t);
  r.g.gain.setValueAtTime(Math.max(0.0001, r.g.gain.value), t);
  r.g.gain.linearRampToValueAtTime(0.0001, t + cruce);
  try { r.src.stop(t + cruce + 0.05); } catch (e) { /* ya paró */ }
}

async function ponerReal(estilo, i) {
  const xs = lista(estilo);
  const p = xs[i % xs.length];
  const yo = ++turno;
  let buf;
  try { buf = await cargar(url(p)); } catch (e) {
    // el archivo no bajó: el sintetizado, para que la historia no quede muda
    if (yo === turno && quiere === estilo) { soltarReal(CRUCE); avisar(null); sintesis(estilo); }
    return;
  }
  if (yo !== turno || quiere !== estilo || !ctx) return;          // mientras bajaba, se pidió otra cosa
  pararSintesis();
  soltarReal(CRUCE);
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(VOL_REAL, t + CRUCE);
  src.connect(g).connect(ctx.destination);
  src.start(t);
  sonando = estilo;
  real = { estilo, i, src, g, fin: t + buf.duration };
  avisar({ t: p.t, b: p.b, u: p.u });
  // el que sigue de este estilo, bajando de antes
  if (xs.length > 1) cargar(url(xs[(i + 1) % xs.length])).catch(() => {});
  // ⏱️ cuando éste se termina, se cruza con el siguiente. Con la hora del audio y no con un `setTimeout`: pausado (la
  // historia apretada, la pestaña oculta) el audio no avanza, y un reloj de pared cruzaría a destiempo
  if (!vigia) {
    vigia = setInterval(() => {
      if (!real || !ctx) { clearInterval(vigia); vigia = 0; return; }
      if (ctx.currentTime >= real.fin - CRUCE - 0.2 && quiere === real.estilo && !real.cruzando) {
        real.cruzando = true;
        ponerReal(real.estilo, real.i + 1);
      }
    }, 250);
  }
}

/** Toca ese estilo (o lo deja sonando si ya es ese): uno de verdad si hay, el sintetizado si no. `semilla` elige cuál
 * (el id del círculo). Sin estilo, o silenciado, para. */
export function tocar(estilo, semilla) {
  const promo = String(estilo || '').startsWith('p:');
  if (!estilo || (!ESTILOS[estilo] && !promo) || mudo()) { parar(); return; }
  if (!abrir()) return;
  quiere = estilo;
  encendido = true;
  if (ctx.state !== 'running' && ctx.state !== 'closed' && !document.hidden) ctx.resume().catch(() => {});
  const xs = lista(estilo);
  // (una promo sin su recorte no suena: no hay un sintetizado que la reemplace)
  if (!xs.length) { if (promo) { parar(); return; } soltarReal(CRUCE); avisar(null); sintesis(estilo); return; }
  // el mismo estilo que ya suena: sigue, no vuelve a arrancar
  if (real && real.estilo === estilo) return;
  ponerReal(estilo, hashS(semilla) % xs.length);
}

/** Baja el volumen y para, con el audio encendido: la historia que sigue puede traer otro beat (ver la tanda 3, arriba). */
export function parar() {
  quiere = '';
  sonando = '';
  turno++;
  if (!ctx) return;
  soltarReal(0.4);
  pararSintesis();
  avisar(null);
}

/** 🍏 Al abrir el visor (tanda 4): el audio se va a usar aunque la primera historia no traiga beat. Así el MISMO toque
 * que lo abre lo prende (el oyente de `window`), y la historia con beat que llega sola después ya lo encuentra prendido:
 * antes se prendía recién ahí, sin toque, y el iPhone lo dejaba dormido */
export function visorAbierto() { encendido = true; ponerDueno(''); }

// 🔊 (tanda 5) LAS PUBLICACIONES QUE SUENAN: cuál suena ahora (`dueno`, su id), para que su pastilla «♫» se vea prendida
// y las demás no. Una sola a la vez; abrir las historias o cerrar todo la apaga
let dueno = '';
const oyentesD = new Set();
function ponerDueno(x) {
  if (dueno === x) return;
  dueno = x;
  oyentesD.forEach((f) => { try { f(x); } catch (e) { /* un oyente roto no frena al resto */ } });
}
export const duenoActual = () => dueno;
/** Avisa cuál publicación suena ('' = ninguna). Devuelve cómo dejar de oír */
export function alDueno(fn) { oyentesD.add(fn); return () => { oyentesD.delete(fn); }; }
/** Que suene una publicación: adentro del toque de su pastilla (el iPhone lo pide así). Silenciado, lo desilencia: tocar
 * «♫» es pedir sonido */
export function sonarPublicacion(id, estilo) {
  if (mudo()) ponerMudo(false);
  // cada publicación con SU beat: en las historias el mismo estilo sigue sonando de una a otra; acá, cambiar de
  // publicación es pedir otra cosa
  if (dueno && dueno !== id) parar();
  ponerDueno(id);
  encendido = true;
  prender();
  tocar(estilo, id);
}
export function callarPublicacion() { if (dueno) apagar(); }

/** Al cerrar el visor: para y apaga el audio, que no gaste nada con la página quieta. */
export function apagar() {
  parar();
  encendido = false;
  ponerDueno('');
  soltarSesion();
  setTimeout(() => { if (!quiere && ctx) ctx.suspend().catch(() => {}); }, 600);
}
