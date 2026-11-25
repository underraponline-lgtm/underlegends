// 🔊 LOS SONIDOS DE LA PÁGINA (25/11/2026). Dlx: «agregar sonidos cuando se abren los regalos o sonidos en general… donde
// veas, en cualquier parte de la página web». Sintetizados con Web Audio, como los del escenario de los drops
// (drops_show.js): no hay archivos que bajar, pesan cero y suenan igual en todos lados.
// - `tap`: un toque corto y bajito al apretar cualquier botón o link (App.jsx lo escucha en la raíz de la página).
// - Los momentos: `sacude` (la caja que tiembla), `pop` (se abre), `premio` (lo que salió, distinto para cada cosa),
//   `compra`, `ok` y `error`.
// - Se apagan en Ajustes («Sonidos», `lg:ajustes`.mudo, por navegador). El navegador no deja sonar nada antes del primer
//   toque: por eso todo nace de un toque, y el contexto de audio se arma recién ahí.
const W = typeof window !== 'undefined' ? window : {};
let A = null;
let ultTap = 0;

export function mudo() {
  try { const aj = W.AJ || JSON.parse(localStorage.getItem('lg:ajustes') || 'null') || {}; return !!aj.mudo; } catch (e) { return false; }
}
function audio() {
  if (mudo()) return null;
  if (A) { if (A.c.state === 'suspended') A.c.resume().catch(() => {}); return A; }
  const AC = W.AudioContext || W.webkitAudioContext;
  if (!AC) return null;
  try {
    const c = new AC();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 6;
    const m = c.createGain(); m.gain.value = 0.55;
    comp.connect(m); m.connect(c.destination);
    const n = c.sampleRate, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    A = { c, out: comp, ruido: b };
  } catch (e) { A = null; }
  return A;
}
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
function env(g, t, at, pico, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(pico, t + at); g.gain.exponentialRampToValueAtTime(0.0001, t + at + dec); }
function tono(f, t, dur, tipo, pico, f2) {
  const c = A.c, o = c.createOscillator(), g = c.createGain();
  o.type = tipo || 'sine'; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  env(g, t, 0.004, pico, dur); o.connect(g); g.connect(A.out); o.start(t); o.stop(t + dur + 0.05);
}
function soplo(t, dur, f1, f2, pico, tipo, q) {
  const c = A.c, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = A.ruido; f.type = tipo || 'bandpass'; f.Q.value = q || 1;
  f.frequency.setValueAtTime(f1, t); f.frequency.exponentialRampToValueAtTime(f2, t + dur);
  env(g, t, Math.min(0.02, dur * 0.3), pico, dur); s.connect(f); f.connect(g); g.connect(A.out);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
const SON = {
  tap() { const t = A.c.currentTime + 0.003; tono(1150, t, 0.04, 'sine', 0.05, 680); },
  sacude() { const t = A.c.currentTime + 0.003; for (let i = 0; i < 3; i++) { soplo(t + i * 0.1, 0.05, 1600, 2800, 0.12, 'bandpass', 5); tono(300 + i * 40, t + i * 0.1, 0.05, 'triangle', 0.05); } },
  pop() { const t = A.c.currentTime + 0.003; soplo(t, 0.14, 6000, 1300, 0.3, 'highpass', 0.8); tono(560, t, 0.2, 'sine', 0.3, 130); },
  // lo que salió: la pieza con descuento (tres notas), Puntos (monedas), un Drop (un golpe que sube), gratis (la fanfarria)
  premio(k) {
    const t = A.c.currentTime + 0.003;
    if (k === 'gratis') {
      [72, 76, 79, 84, 88, 91].forEach((m, i) => { tono(hz(m), t + i * 0.07, 0.5, 'triangle', 0.13); tono(hz(m + 12), t + i * 0.07, 0.35, 'sine', 0.05); });
      soplo(t + 0.1, 1.2, 9000, 3000, 0.06, 'highpass', 0.5);
    } else if (k === 'pdt') {
      [0, 0.09, 0.18].forEach((d, i) => { tono(hz(88 + i * 3), t + d, 0.18, 'square', 0.04); tono(hz(95 + i * 3), t + d + 0.03, 0.22, 'sine', 0.07); });
    } else if (k === 'drop') {
      tono(110, t, 0.45, 'sine', 0.45, 45); soplo(t + 0.05, 0.6, 300, 2400, 0.12, 'bandpass', 1.2); tono(hz(67), t + 0.25, 0.4, 'triangle', 0.1, hz(79));
    } else {
      [76, 79, 83].forEach((m, i) => tono(hz(m), t + i * 0.08, 0.32, 'triangle', 0.12));
    }
  },
  compra() { const t = A.c.currentTime + 0.003; tono(hz(91), t, 0.12, 'triangle', 0.12); tono(hz(96), t + 0.08, 0.4, 'triangle', 0.14); soplo(t, 0.08, 7000, 4000, 0.08, 'highpass', 1); },
  ok() { const t = A.c.currentTime + 0.003; tono(hz(79), t, 0.14, 'sine', 0.12); tono(hz(86), t + 0.09, 0.22, 'sine', 0.12); },
  error() { const t = A.c.currentTime + 0.003; tono(180, t, 0.09, 'square', 0.05); tono(140, t + 0.11, 0.14, 'square', 0.05); },
};
/** Suena `nombre` (si no está apagado en Ajustes). Nunca rompe nada: sin audio, no pasa nada */
export function sonar(nombre, ...arg) {
  if (!SON[nombre] || !audio()) return;
  try { SON[nombre](...arg); } catch (e) { /* sin sonido */ }
}
/** El toque de cualquier botón: uno cada 60 ms como mucho (un toque dispara pointerdown en varias capas) */
export function sonarTap() {
  const t = Date.now();
  if (t - ultTap < 60) return;
  ultTap = t;
  sonar('tap');
}
