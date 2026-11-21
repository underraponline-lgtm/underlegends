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

export const mudo = () => { try { return localStorage.getItem(MUDO) === '0'; } catch (e) { return false; } };
export function ponerMudo(v) {
  try { localStorage.setItem(MUDO, v ? '0' : '1'); } catch (e) { /* sin guardar: vale para esta visita */ }
  if (v) parar();
}

function abrir() {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  ctx = new AC();
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
    else if (actual) ctx.resume().catch(() => {});
  });
  return ctx;
}

/** Despierta el audio desde un gesto (el iPhone lo pide adentro del toque). */
export function despertar() {
  if (ctx && ctx.state === 'suspended' && actual) ctx.resume().catch(() => {});
}

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

/** Toca ese estilo (o lo deja sonando si ya es ese). Sin estilo, o silenciado, para. */
export function tocar(estilo) {
  if (!estilo || !ESTILOS[estilo] || mudo()) { parar(); return; }
  if (!abrir()) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  if (actual === estilo && reloj) return;
  const t = ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t);
  // de otro estilo, un respiro corto en vez de cortar en seco
  master.gain.linearRampToValueAtTime(actual && actual !== estilo ? 0.0001 : master.gain.value, t + 0.12);
  master.gain.linearRampToValueAtTime(VOL, t + 0.6);
  actual = estilo;
  paso = 0;
  proximo = t + 0.14;
  if (!reloj) reloj = setInterval(programar, 25);
}

/** Baja el volumen y para. */
export function parar() {
  if (!ctx || !actual) return;
  const t = ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t);
  master.gain.linearRampToValueAtTime(0.0001, t + 0.35);
  actual = '';
  const r = reloj;
  setTimeout(() => { if (!actual) { clearInterval(r); if (reloj === r) reloj = 0; ctx.suspend().catch(() => {}); } }, 420);
}
