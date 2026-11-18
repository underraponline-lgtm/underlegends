// 🐉 EL ESCENARIO DE LOS DRAGÓN DROPS (17/11/2026). La maqueta que Dlx aprobó (tres animaciones, cinco cofres, partículas,
// sonido, la pantalla de cada premio y «Te llevaste»), llevada a la página. Pantalla completa, en un <dialog> propio que se
// abre con showModal() encima de todo, también de la ventana de los drops.
//
//   mostrarDrops(host, cola, { abrir, alCerrar, cofres })
//     host     dónde se cuelga el <dialog> (un elemento o el shadow root de la página)
//     cola     filas de `cerrados` (`/api/avisos/drops`): {id, origen, min, t, tipo, cofre?}. La primera se abre ya; las
//              demás, con «Abrir otro (N)» del resumen
//     abrir    (id) => Promise de lo que contesta `/api/avisos/drop-abrir` (ver el contrato en bot/avisos.js, `dropAbrir()`)
//     alCerrar (resumen) => se llama una vez al cerrar, con {abiertos, puntos}
//     cofres   opcional: `cofres` de `/api/avisos/drops`, de ahí salen los nombres de los cofres
//   devuelve { cerrar }
//
// ⚠️ EL SERVIDOR DECIDE TODO EN EL PRIMER TOQUE: `abrir(id)` se llama ahí, y la animación sube toque a toque hasta lo que
// salió y nunca muestra algo más alto. Drop → se transforma; Star → la escama azul; Nido → el huevo, que se parte en `n`;
// cofre → el cofre de rap (0–3) o el Tesoro del Dragón (4), que sube en los toques que dice `sube` y trae `nuevos`, que se
// abren acá mismo uno detrás del otro.
// ⚠️ Vive en el shadow root de la página: nada de `document.querySelector`, todo se busca adentro del propio <dialog>.
// Lo que quedó fuera de la maqueta: el panel de opciones, la billetera de mentira, las tablas, el «Sobre dragón» (los sobres
// son para un minijuego) y el cofre «de tesoro» para 0–3.
import CSS from './css/drops_show.css?inline';
import { usarCss } from './css.js';
import { quieto } from './anima.js';

const W = typeof window !== 'undefined' ? window : {};
const fmt = new Intl.NumberFormat('es-AR');

//: las seis rarezas (la sexta, el Disco de Diamante, sólo sale del Nido)
const RZ = [
  { n: 'Maqueta', c: '#9AA4B2', claro: '#E4E9F0', d: '#4A5260', b1: '#C9D0DA', b2: '#3A414D', ojo: '#F2F6FA' },
  { n: 'Mixtape', c: '#29B298', claro: '#A4F5E2', d: '#0B5A4C', b1: '#55DCC0', b2: '#08463B', ojo: '#8DFFE8' },
  { n: 'Vinilo', c: '#9B5CFF', claro: '#DCC8FF', d: '#46179E', b1: '#BD92FF', b2: '#2E0E70', ojo: '#EADBFF' },
  { n: 'Disco de Oro', c: '#FF4F93', claro: '#FFC6DC', d: '#9A1050', b1: '#FF8DB9', b2: '#6E0A39', ojo: '#FFE2EE' },
  { n: 'Micrófono de Oro', c: '#F5C542', claro: '#FFF2BF', d: '#9A6400', b1: '#FFE07A', b2: '#7E4C00', ojo: '#FFF6CF' },
  { n: 'Disco de Diamante', c: '#BFF4FF', claro: '#FFFFFF', d: '#5B4BB5', b1: '#2E2366', b2: '#05040C', ojo: '#FFFFFF', prisma: true },
];
const PRISMA = ['#E9FBFF', '#C9B8FF', '#FFD3F0', '#FFF4BF', '#C2FFE5', '#A6EBFF'];
const MAX = RZ.length - 1;
//: los cofres, de menos a más (el `t` de `cofre5:<t>:`). Del 0 al 3 son los de rap; el 4, el Tesoro del Dragón, es la marca
const CF = [
  { n: 'Cajón de discos', mat: 'madera', c: '#D08C4A', claro: '#F6D2A2', d: '#5A3412', b1: '#E8AC6A', b2: '#3A1E08' },
  { n: 'Flight case', mat: 'hierro', c: '#8FA3B8', claro: '#E3ECF4', d: '#36465A', b1: '#BACADB', b2: '#1C2733' },
  { n: 'Baúl de los objetos', mat: 'oro', c: '#F5C542', claro: '#FFF2BF', d: '#9A6400', b1: '#FFE07A', b2: '#7E4C00' },
  { n: 'Funda del Campeón', mat: 'campeon', c: '#E41373', claro: '#FF9CC4', d: '#5A0628', b1: '#FF5A9C', b2: '#2A0313' },
  { n: 'Tesoro del Dragón', mat: 'tesoro', c: '#BFF4FF', claro: '#FFFFFF', d: '#5B4BB5', b1: '#2E2366', b2: '#05040C', prisma: true },
];
const TIPOS = { drop: 'Dragón Drop', star: 'Star Dragon', nido: 'Nido de dragón' };
//: qué animación lleva cada tipo (Dlx, 16/11)
const ANIM = { drop: 'transforma', nido: 'huevo', star: 'escama' };
const TOPE = 10000;
const tCofre = (t) => Math.max(0, Math.min(CF.length - 1, Math.round(Number(t) || 0)));
const tRz = (r) => Math.max(0, Math.min(MAX, Math.round(Number(r) || 0)));
const nPts = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0);
const tipoDe = (it) => (it && (it.tipo === 'cofre' || it.tipo === 'nido' || it.tipo === 'star') ? it.tipo : 'drop');
const azarEntre = (n) => Math.floor(Math.random() * n);
let uid = 0;
const nid = () => 'dsw' + (++uid) + 'x';

/* ---------------------------------------------------------------- el sonido: todo sintetizado con Web Audio */
//: «sonido siempre» (Dlx): suena salvo que lo silencies con el botón de arriba, y se acuerda en este navegador
const LLAVE_SON = 'lg:drops-sonido';
function leerMudo() { try { return W.localStorage.getItem(LLAVE_SON) === '0'; } catch (e) { return false; } }
function guardarMudo(m) { try { W.localStorage.setItem(LLAVE_SON, m ? '0' : '1'); } catch (e) { /* sin almacenamiento: dura esta vez */ } }
const Son = (() => {
  let A = null;
  let mudo = leerMudo();
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const CURVA = (() => { const k = 28, c = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; c[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); } return c; })();
  function armar(c) {
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 8; comp.attack.value = 0.002; comp.release.value = 0.2;
    const master = c.createGain(); master.gain.value = 0.85;
    comp.connect(master); master.connect(c.destination);
    const out = c.createGain(); out.connect(comp);
    const eco = c.createDelay(1); eco.delayTime.value = 0.14;
    const fb = c.createGain(); fb.gain.value = 0.3;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3600;
    const wet = c.createGain(); wet.gain.value = 0.32;
    eco.connect(lp); lp.connect(fb); fb.connect(eco); lp.connect(wet); wet.connect(comp);
    const n = c.sampleRate * 2, ruido = c.createBuffer(1, n, c.sampleRate), ch = ruido.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1;
    return { c, out, eco, ruido, master };
  }
  function init() {
    if (mudo) return;
    if (A) { if (A.c.state === 'suspended') A.c.resume().catch(() => {}); return; }
    const AC = W.AudioContext || W.webkitAudioContext;
    if (!AC) return;
    try { A = armar(new AC()); } catch (e) { A = null; }
  }
  const t0 = () => A.c.currentTime + 0.006;
  function env(g, t, at, pico, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(pico, t + at); g.gain.exponentialRampToValueAtTime(0.0001, t + at + dec); }
  function tono(f, t, dur, tipo, pico, f2, conEco) {
    const c = A.c, o = c.createOscillator(), g = c.createGain();
    o.type = tipo || 'sine'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    env(g, t, 0.006, pico || 0.2, dur); o.connect(g); g.connect(A.out); if (conEco) g.connect(A.eco);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function soplo(t, dur, f1, f2, pico, tipo, q) {
    const c = A.c, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = A.ruido; f.type = tipo || 'bandpass'; f.Q.value = q || 1;
    f.frequency.setValueAtTime(f1, t); f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    env(g, t, Math.min(0.04, dur * 0.3), pico || 0.2, dur); s.connect(f); f.connect(g); g.connect(A.out);
    s.start(t, Math.random() * 1.2); s.stop(t + dur + 0.1);
  }
  const BASE = [72, 74, 76, 79, 81, 84];
  const F = {
    tap() { const t = t0(); tono(210, t, 0.11, 'sine', 0.45, 70); soplo(t, 0.035, 4000, 2500, 0.12, 'highpass', 0.7); },
    carga() { const t = t0(); soplo(t, 0.24, 400, 2600, 0.4, 'bandpass', 1.5); },
    grieta() { const t = t0(); for (let i = 0; i < 5; i++) tono(1800 + Math.random() * 2200, t + i * 0.018, 0.03, 'square', 0.06); soplo(t, 0.09, 5000, 2500, 0.25, 'highpass', 1); },
    nada() { const t = t0(); tono(150, t, 0.16, 'sine', 0.42, 55); tono(330, t + 0.02, 0.07, 'triangle', 0.08, 250); soplo(t, 0.12, 900, 300, 0.1, 'lowpass', 0.7); },
    sube(r, fuerte) {
      const t = t0(), b = BASE[r];
      const ns = fuerte ? [0, 4, 7, 12].concat(r >= 3 ? [16, 19] : []) : [0, 7];
      ns.forEach((n, i) => { tono(hz(b + n), t + i * 0.055, fuerte ? 0.5 : 0.22, 'triangle', 0.13, null, true); tono(hz(b + n + 12), t + i * 0.055, fuerte ? 0.35 : 0.15, 'sine', 0.05, null, true); });
      soplo(t, fuerte ? 0.4 : 0.2, 2600, 500, fuerte ? 0.16 : 0.08, 'bandpass', 0.8);
    },
    parte() { const t = t0(); tono(420, t, 0.09, 'sine', 0.32, 900); tono(560, t + 0.08, 0.09, 'sine', 0.3, 1300); soplo(t, 0.25, 3000, 600, 0.12); },
    rugido() {
      const c = A.c, t = t0();
      const o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), pre = c.createGain(), ws = c.createWaveShaper(), f = c.createBiquadFilter(), g = c.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(96, t); o.frequency.linearRampToValueAtTime(68, t + 1.0);
      lfo.frequency.value = 22; lg.gain.value = 12; lfo.connect(lg); lg.connect(o.frequency);
      pre.gain.value = 0.6; ws.curve = CURVA;
      f.type = 'lowpass'; f.Q.value = 4; f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(380, t + 1.0);
      o.connect(pre); pre.connect(ws); ws.connect(f); f.connect(g); g.connect(A.out); env(g, t, 0.08, 0.28, 1.0);
      o.start(t); lfo.start(t); o.stop(t + 1.2); lfo.stop(t + 1.2);
      soplo(t, 1.0, 700, 220, 0.22, 'bandpass', 1.2);
    },
    fuego() { const t = t0(); soplo(t, 1.05, 180, 1600, 0.3, 'bandpass', 0.5); soplo(t + 0.05, 0.9, 3000, 900, 0.12, 'highpass', 0.7); for (let i = 0; i < 14; i++) tono(600 + Math.random() * 2500, t + Math.random() * 0.9, 0.02, 'square', 0.03); },
    brillo() { const t = t0(); for (let i = 0; i < 10; i++) tono(hz(96 + [0, 4, 7, 11, 12, 16][i % 6]), t + i * 0.06, 0.4, 'sine', 0.06, null, true); soplo(t, 1.1, 8000, 3000, 0.06, 'highpass', 0.5); },
    abrirCarga() { const t = t0(); soplo(t, 0.55, 300, 4000, 0.45, 'bandpass', 1.4); tono(140, t, 0.55, 'sawtooth', 0.09, 520); },
    rompe() { const t = t0(); soplo(t, 0.3, 7000, 1800, 0.32, 'highpass', 0.8); for (let i = 0; i < 8; i++) tono(1400 + Math.random() * 3000, t + i * 0.022, 0.05, 'square', 0.045); },
    boom() { const t = t0(); tono(120, t, 0.7, 'sine', 0.6, 32); soplo(t, 0.6, 1400, 90, 0.35, 'lowpass', 0.6); },
    entra() { const t = t0(); soplo(t, 0.38, 500, 2800, 0.1, 'bandpass', 1); tono(130, t + 0.36, 0.16, 'sine', 0.45, 48); },
    scratch() {
      const c = A.c, t = t0(), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = A.ruido; f.type = 'bandpass'; f.Q.value = 3.5;
      f.frequency.setValueCurveAtTime(new Float32Array([700, 2600, 500, 2200, 800, 1800]), t, 0.28);
      env(g, t, 0.01, 1.4, 0.28); s.connect(f); f.connect(g); g.connect(A.out); s.start(t, Math.random()); s.stop(t + 0.35);
    },
    tic(p) { const t = t0(); tono(900 + p * 1100, t, 0.035, 'square', 0.04); },
    ding(r) { const t = t0(), b = BASE[r] + 12; [0, 7, 12].forEach((n, i) => tono(hz(b + n), t + i * 0.03, 0.6, 'sine', 0.09, null, true)); },
    fanfarria(r) {
      const t = t0(), b = BASE[Math.min(MAX, r)] - 12, a1 = [0, 4, 7], a2 = [0, 4, 7, 12].concat(r >= 3 ? [16] : []);
      a1.forEach((n) => tono(hz(b + n), t, 0.14, 'triangle', 0.1));
      a2.forEach((n) => tono(hz(b + n + 5), t + 0.15, 0.16, 'triangle', 0.1));
      a2.forEach((n) => { tono(hz(b + n + 12), t + 0.32, 0.9, 'triangle', 0.1, null, true); tono(hz(b + n), t + 0.32, 0.9, 'sawtooth', 0.02); });
    },
    suspenso() { const t = t0(); tono(hz(55), t, 0.7, 'sawtooth', 0.09, hz(67)); soplo(t, 0.7, 300, 2500, 0.32, 'bandpass', 2); },
    clank() { const t = t0(); [1240, 1873, 2650].forEach((f, i) => tono(f, t, 0.24 - i * 0.05, 'sine', 0.12, null, true)); soplo(t, 0.06, 3000, 1500, 0.3, 'bandpass', 2); tono(160, t, 0.12, 'square', 0.06, 80); },
    monedas() { const t = t0(); for (let i = 0; i < 14; i++) { const f = 2200 + Math.random() * 2400; tono(f, t + i * 0.045 + Math.random() * 0.02, 0.09, 'sine', 0.07, null, true); tono(f * 1.5, t + i * 0.045, 0.06, 'sine', 0.03); } },
    tapa() { const t = t0(); soplo(t, 0.4, 600, 3500, 0.35, 'bandpass', 1.2); tono(90, t, 0.5, 'sine', 0.5, 40); },
  };
  const api = {
    init,
    mudo: () => mudo,
    ponerMudo(m) {
      mudo = !!m; guardarMudo(mudo);
      if (A) { try { A.master.gain.setTargetAtTime(mudo ? 0 : 0.85, A.c.currentTime, 0.02); } catch (e) { /* sigue */ } }
      if (!mudo) init();
    },
  };
  Object.keys(F).forEach((k) => { api[k] = (...a) => { if (!A || mudo) return; try { F[k](...a); } catch (e) { /* sin sonido, sigue */ } }; });
  return api;
})();

/* ---------------------------------------------------------------- los dibujos */
const EGG = 'M120 14C170 14 204 96 204 152C204 208 166 246 120 246C74 246 36 208 36 152C36 96 70 14 120 14Z';
const GP = [[40, 134], [60, 124], [80, 141], [99, 121], [119, 143], [139, 119], [158, 139], [177, 123], [200, 133]];
const stopsDe = (cols) => cols.map((c, i) => `<stop offset="${(i / (cols.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

//: las escamas del huevo: filas de «U» de abajo hacia arriba, así cada fila de arriba tapa el borde de la de abajo
const ESCAMAS_HUEVO = (() => {
  let s = '';
  for (let fila = 13, y = 246; fila >= 0; fila--, y -= 19) {
    const off = fila % 2 ? 20 : 0;
    for (let x = 16 - off; x < 226; x += 40) s += `<path stroke="none" d="M${x} ${y - 20}V${y}q20 36 40 0V${y - 20}z"/><path fill="none" d="M${x} ${y}q20 36 40 0"/>`;
  }
  return s;
})();
//: los cuernos y las espinas: van detrás del cuerpo, así la base queda tapada
const ESPINAS = 'M106 24L120 -16L134 24Z M80 52Q58 22 52 -10Q84 10 104 34Z M160 52Q182 22 188 -10Q156 10 136 34Z M44 108Q18 96 4 80Q22 116 38 136Z M196 108Q222 96 236 80Q218 116 202 136Z M38 168Q14 164 2 152Q18 184 42 194Z M202 168Q226 164 238 152Q222 184 198 194Z';
function svgHuevo(r, g, osc, mitad) {
  const R = RZ[r], u = nid(), prisma = R.prisma && !osc;
  const borde = osc ? R.c : '#0B0B0E';
  const base = osc ? '#060508' : prisma ? '#5B4BB5' : R.d;
  const escA = osc ? ['#050407', '#2A2433'] : prisma ? ['#8C7BE0', '#E9FBFF'] : [R.d, R.c];
  const borEsc = osc ? R.c : prisma ? '#FFFFFF' : R.claro;
  const espC = osc ? ['#2A2433', '#060508'] : prisma ? ['#FFFFFF', '#8C7BE0'] : [R.claro, R.d];
  let grieta = '';
  if (g > 0 && !mitad) {
    const lo = [4, 3, 2, 1, 0][g], hi = [4, 5, 6, 7, 8][g], w = [0, 2.2, 4, 6.5, 9.5][g];
    const seg = GP.slice(lo, hi + 1);
    const pol = seg.map(([x, y]) => `${x},${y - w}`).concat(seg.slice().reverse().map(([x, y]) => `${x},${y + w}`)).join(' ');
    grieta = `<clipPath id="${u}c"><polygon points="${pol}"/></clipPath>
      <polygon points="${pol}" fill="#050308"/>
      <g clip-path="url(#${u}c)"><ellipse cx="120" cy="132" rx="62" ry="26" fill="${R.ojo}" opacity=".9" filter="url(#${u}b)"/>
        <g class="dsw-ojo"><ellipse cx="120" cy="132" rx="36" ry="20" fill="url(#${u}i)"/><ellipse cx="120" cy="132" rx="4.5" ry="19" fill="#050308"/></g></g>
      <polyline points="${seg.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${R.ojo}" stroke-width="${(1 + g * 0.6).toFixed(1)}" stroke-linejoin="round" filter="url(#${u}b)"/>`;
  }
  let corte = '';
  if (mitad) {
    const linea = GP.map((p) => p.join(',')).join(' '), inv = GP.slice().reverse().map((p) => p.join(',')).join(' ');
    corte = mitad === 'arriba' ? `-40,-40 280,-40 280,133 ${inv} -40,133` : `-40,133 ${linea} 280,133 280,300 -40,300`;
  }
  const cuerpo = `<path d="${ESPINAS}" fill="url(#${u}k)" stroke="${borde}" stroke-width="5" stroke-linejoin="round"/>
    <path d="${EGG}" fill="${base}"/>
    <g clip-path="url(#${u}h)">
      <g fill="url(#${u}s)" stroke="${borEsc}" stroke-opacity="${osc ? 0.45 : 0.55}" stroke-width="2.6">${ESCAMAS_HUEVO}</g>
      <rect width="240" height="260" fill="url(#${u}o)"/>
      <ellipse cx="84" cy="70" rx="34" ry="52" fill="url(#${u}l)" transform="rotate(-20 84 70)"/>${grieta}</g>
    <path d="${EGG}" fill="none" stroke="${borde}" stroke-width="7"/>`;
  return `<svg class="${mitad ? 'dsw-mitad' : ''}" viewBox="0 0 240 260" aria-hidden="true"><defs>
    <linearGradient id="${u}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${escA[0]}"/><stop offset="1" stop-color="${escA[1]}"/></linearGradient>
    <linearGradient id="${u}k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${espC[0]}"/><stop offset="1" stop-color="${espC[1]}"/></linearGradient>
    <linearGradient id="${u}o" x1="0" y1="0" x2="1" y2="1"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${osc ? 0.5 : 0.38}"/></linearGradient>
    <radialGradient id="${u}l"><stop offset="0" stop-color="#fff" stop-opacity="${osc ? 0.18 : 0.5}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <radialGradient id="${u}i"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="${R.ojo}"/><stop offset="1" stop-color="${osc ? R.c : R.d}"/></radialGradient>
    <filter id="${u}b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
    <clipPath id="${u}h"><path d="${EGG}"/></clipPath>${mitad ? `<clipPath id="${u}m"><polygon points="${corte}"/></clipPath>` : ''}</defs>
    ${mitad ? `<g clip-path="url(#${u}m)">${cuerpo}</g>` : cuerpo}</svg>`;
}

function carrete(x, y) {
  const dientes = [0, 60, 120, 180, 240, 300].map((a) => `<rect x="${x - 1.5}" y="${y - 12}" width="3" height="5" fill="#0B0B0E" transform="rotate(${a} ${x} ${y})"/>`).join('');
  return `<g class="dsw-gira-r"><circle cx="${x}" cy="${y}" r="13" fill="#F1F1F4"/><circle cx="${x}" cy="${y}" r="5" fill="#0B0B0E"/>${dientes}</g>`;
}
function svgCasete(r, txt, osc) {
  const R = RZ[r], u = nid();
  const cuerpo = osc ? '#141118' : r === 0 ? '#CDD3DB' : R.c, borde = osc ? R.c : '#0B0B0E';
  const tornillos = [[30, 56], [210, 56], [30, 164], [210, 164]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="${borde}"/>`).join('');
  return `<svg viewBox="0 0 240 260" aria-hidden="true"><defs><linearGradient id="${u}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".4"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
    <g transform="translate(0 20)">
      <rect x="14" y="40" width="212" height="140" rx="12" fill="${cuerpo}" stroke="${borde}" stroke-width="7"/>
      <rect x="18" y="44" width="204" height="66" rx="9" fill="url(#${u}g)"/>
      <rect x="34" y="56" width="172" height="62" rx="5" fill="${osc ? '#1F1A26' : '#F6F2E8'}" stroke="${borde}" stroke-width="4"/>
      <text x="120" y="82" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="900" font-style="italic" font-size="21" fill="${osc ? R.c : '#0B0B0E'}" letter-spacing="1">${txt}</text>
      <line x1="46" y1="94" x2="194" y2="94" stroke="${osc ? R.c : R.d}" stroke-width="3"/>
      <line x1="46" y1="106" x2="150" y2="106" stroke="${osc ? R.c : R.d}" stroke-width="3" opacity=".6"/>
      <rect x="66" y="124" width="108" height="34" rx="6" fill="#0B0B0E"/>${carrete(94, 141)}${carrete(146, 141)}
      <path d="M60 180L76 162H164L180 180Z" fill="${osc ? '#0B0B0E' : '#2A2A33'}" stroke="${borde}" stroke-width="5" stroke-linejoin="round"/>${tornillos}
    </g></svg>`;
}
function svgDisco(r, mat, osc) {
  const R = RZ[r], u = nid();
  const base = osc ? ['#2A2433', '#060508'] : mat === 'oro' ? ['#FFF0A8', '#E2A812', '#7E5200'] : ['#34343C', '#08080A'];
  const prisma = mat === 'diamante' && !osc;
  const surco = mat === 'oro' ? '#6A4400' : '#FFFFFF', op = mat === 'oro' ? 0.4 : prisma ? 0.6 : 0.09;
  const borde = osc ? R.c : '#0B0B0E';
  const facetas = prisma ? '<path d="M120 26L84 92L120 130L156 92Z M16 130L84 92 M224 130L156 92 M120 130L60 214 M120 130L180 214 M120 234L120 168" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2.5"/>' : '';
  return `<svg viewBox="0 0 240 260" aria-hidden="true"><defs>
      <radialGradient id="${u}g" cx=".4" cy=".35" r=".78">${stopsDe(base)}</radialGradient>
      <linearGradient id="${u}p" x1="0" y1="0" x2="1" y2="1">${stopsDe(PRISMA)}</linearGradient></defs>
    <circle cx="120" cy="130" r="104" fill="url(#${u}${prisma ? 'p' : 'g'})"/>
    <g class="dsw-gira">
      ${[94, 84, 74, 64, 54].map((rr) => `<circle cx="120" cy="130" r="${rr}" fill="none" stroke="${surco}" stroke-opacity="${op}" stroke-width="1.6"/>`).join('')}
      ${facetas}
      <circle cx="120" cy="130" r="38" fill="${osc ? '#0B0B0E' : R.c}" stroke="#0B0B0E" stroke-width="4"/>
      <text x="120" y="141" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="900" font-style="italic" font-size="30" fill="${osc ? R.c : '#0B0B0E'}">UL</text>
      <circle cx="120" cy="130" r="4.5" fill="#0B0B0E"/>
    </g>
    <path d="M120 130L42 70A100 100 0 0 1 80 38Z" fill="#fff" opacity="${mat === 'vinilo' || osc ? 0.12 : 0.32}"/>
    <path d="M120 130L198 190A100 100 0 0 1 160 222Z" fill="#fff" opacity="${mat === 'vinilo' || osc ? 0.08 : 0.22}"/>
    <circle cx="120" cy="130" r="104" fill="none" stroke="${borde}" stroke-width="7"/></svg>`;
}
function svgMicro(r, osc) {
  const R = RZ[r], u = nid();
  const oro = osc ? ['#2A2433', '#141118', '#050407'] : ['#FFF2BF', '#E2A812', '#7E5200'];
  const borde = osc ? R.c : '#0B0B0E', onda = osc ? R.c : '#fff';
  return `<svg viewBox="0 0 240 260" aria-hidden="true"><defs>
      <linearGradient id="${u}g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${oro[2]}"/><stop offset=".35" stop-color="${oro[0]}"/><stop offset=".7" stop-color="${oro[1]}"/><stop offset="1" stop-color="${oro[2]}"/></linearGradient>
      <radialGradient id="${u}r" cx=".38" cy=".32" r=".8">${stopsDe(oro)}</radialGradient>
      <pattern id="${u}m" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0H9M0 0V9" stroke="${osc ? R.c : '#5A3A00'}" stroke-opacity=".55" stroke-width="2"/></pattern>
      <clipPath id="${u}c"><circle cx="120" cy="84" r="54"/></clipPath></defs>
    <path class="dsw-onda" d="M40 46a96 96 0 0 0 0 78M24 32a120 120 0 0 0 0 106" fill="none" stroke="${onda}" stroke-width="6" stroke-linecap="round"/>
    <path class="dsw-onda" d="M200 46a96 96 0 0 1 0 78M216 32a120 120 0 0 1 0 106" fill="none" stroke="${onda}" stroke-width="6" stroke-linecap="round"/>
    <path d="M96 138H144L133 236Q120 248 107 236Z" fill="url(#${u}g)" stroke="${borde}" stroke-width="6" stroke-linejoin="round"/>
    <rect x="90" y="128" width="60" height="20" rx="4" fill="#0B0B0E" stroke="${borde}" stroke-width="3"/>
    <rect x="112" y="168" width="16" height="26" rx="3" fill="${osc ? '#0B0B0E' : R.c}" stroke="${borde}" stroke-width="3"/>
    <circle cx="120" cy="84" r="54" fill="url(#${u}r)"/>
    <g clip-path="url(#${u}c)"><rect x="60" y="24" width="120" height="120" fill="url(#${u}m)"/><rect x="60" y="80" width="120" height="10" fill="#0B0B0E" opacity=".35"/></g>
    <ellipse cx="100" cy="60" rx="14" ry="20" fill="#fff" opacity="${osc ? 0.15 : 0.5}" transform="rotate(-30 100 60)"/>
    <circle cx="120" cy="84" r="54" fill="none" stroke="${borde}" stroke-width="7"/></svg>`;
}
//: la estrella del Star Dragon, centrada en (120, 132)
const ESTRELLA = (() => { const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? 22 : 52; pts.push((120 + Math.cos(a) * rr).toFixed(1) + ',' + (132 + Math.sin(a) * rr).toFixed(1)); } return pts.join(' '); })();
//: la escama: cinco que se pisan como en la piel (la principal al medio; las de arriba le pisan los hombros)
const escPath = (x, y, w, h) => `M${x} ${y + h * 0.24}Q${x + w / 2} ${y - h * 0.1} ${x + w} ${y + h * 0.24}C${x + w} ${y + h * 0.58} ${x + w * 0.64} ${y + h * 0.78} ${x + w / 2} ${y + h}C${x + w * 0.36} ${y + h * 0.78} ${x} ${y + h * 0.58} ${x} ${y + h * 0.24}Z`;
const ESCAMAS = [[14, 160, 104, 126, 'abajo'], [122, 160, 104, 126, 'abajo'], [45, 98, 150, 188, 'principal'], [6, 40, 112, 126, 'arriba'], [122, 40, 112, 126, 'arriba'], [66, 0, 108, 118, 'cima']];
function svgEscama(r, osc, star) {
  const R = RZ[r], u = nid(), prisma = R.prisma && !osc;
  const luz = osc ? '#3A3346' : prisma ? '#F4FDFF' : R.claro, med = osc ? '#17131E' : prisma ? '#C9B8FF' : R.c;
  const som = osc ? '#040306' : prisma ? '#7A6AD0' : R.d;
  const borde = star ? '#5CC8FF' : osc ? R.c : '#0B0B0E';
  const una = ([x, y, w, h, cual], i) => {
    const d = escPath(x, y, w, h), cx = x + w / 2, prin = cual === 'principal';
    const vetas = [-0.34, -0.2, 0.2, 0.34].map((k) => `M${cx} ${y + h * 0.1}Q${cx + w * k * 0.7} ${y + h * 0.42} ${cx + w * k * 1.25} ${y + h * 0.86}`).join('');
    return `<clipPath id="${u}k${i}"><path d="${d}"/></clipPath>
      <path d="${d}" fill="url(#${u}g)"/>
      <g clip-path="url(#${u}k${i})">
        <path d="${vetas}" fill="none" stroke="${osc ? R.c : '#000'}" stroke-opacity="${osc ? 0.28 : 0.2}" stroke-width="2"/>
        <ellipse cx="${x + w * 0.3}" cy="${y + h * 0.3}" rx="${w * 0.2}" ry="${h * 0.24}" fill="url(#${u}h)" opacity="${prin ? 1 : 0.45}" transform="rotate(-18 ${x + w * 0.3} ${y + h * 0.3})"/>
        ${prisma ? `<path d="${d}" fill="url(#${u}p)" opacity=".3"/>` : ''}
        ${prin ? '' : `<path d="${d}" fill="#000" opacity="${osc ? 0.45 : cual === 'abajo' ? 0.5 : cual === 'cima' ? 0.44 : 0.38}"/>`}
      </g>
      <path d="${escPath(x + w * 0.09, y + h * 0.08, w * 0.82, h * 0.85)}" fill="none" stroke="${osc ? R.c : luz}" stroke-opacity="${osc ? 0.35 : prin ? 0.6 : 0.3}" stroke-width="2"/>
      <path d="M${cx} ${y + h * 0.05}L${cx - w * 0.04} ${y + h * 0.5}L${cx} ${y + h * 0.97}Z" fill="#fff" opacity="${osc ? 0.14 : prin ? 0.42 : 0.24}"/>
      <path d="M${cx} ${y + h * 0.05}L${cx + w * 0.04} ${y + h * 0.5}L${cx} ${y + h * 0.97}Z" fill="#000" opacity="${osc ? 0.4 : 0.26}"/>
      <path d="${d}" fill="none" stroke="${prin ? borde : osc ? R.c : '#0B0B0E'}" stroke-opacity="${prin || !osc ? 1 : 0.5}" stroke-width="${prin ? (star ? 9 : 7) : osc ? 4 : 6}" stroke-linejoin="round"/>${star && prin ? `<path d="${d}" fill="none" stroke="#0B0B0E" stroke-width="3"/>` : ''}`;
  };
  const emblema = star
    ? `<g transform="translate(120 200) scale(.5) translate(-120 -132)"><polygon points="${ESTRELLA}" fill="#5CC8FF" stroke="#0B0B0E" stroke-width="10" stroke-linejoin="round"/></g>`
    : `<text x="122" y="217" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="900" font-style="italic" font-size="40" fill="#fff" opacity="${osc ? 0.12 : 0.4}">UL</text>
       <text x="119" y="215" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="900" font-style="italic" font-size="40" fill="${osc ? R.c : som}">UL</text>`;
  const partes = ESCAMAS.map((e, i) => una(e, i) + (e[4] === 'principal' ? emblema : ''));
  return `<svg viewBox="0 0 240 260" aria-hidden="true"><defs>
      <linearGradient id="${u}g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${luz}"/><stop offset=".49" stop-color="${med}"/><stop offset=".51" stop-color="${som}"/><stop offset="1" stop-color="${med}"/></linearGradient>
      <radialGradient id="${u}h"><stop offset="0" stop-color="#fff" stop-opacity="${osc ? 0.16 : 0.62}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      ${prisma ? `<linearGradient id="${u}p" x1="0" y1="1" x2="1" y2="0">${PRISMA.map((c, i) => `<stop offset="${(i / 5).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>` : ''}
      <clipPath id="${u}c">${ESCAMAS.map((e) => `<path d="${escPath(...e)}"/>`).join('')}</clipPath></defs>
    <g transform="translate(120 130) scale(.88) translate(-120 -142)">${partes.join('')}
    <g clip-path="url(#${u}c)"><g class="dsw-brillo"><rect x="-70" y="-30" width="44" height="360" fill="#fff" opacity=".35" transform="rotate(18 120 142)"/></g></g></g></svg>`;
}

//: los cofres de rap (Lil Drako: «los baúles de las competencias donde sacan los objetos, un porta discos, lo que cubre al
//: disco de vinilo»). Cada uno con su `.dsw-tapa` (lo que vuela al abrir) y, si tiene, su `.dsw-cerr`. `et`: lo que dice la
//: placa del baúl (17/11/2026: la Caja del Nuevo usa su material y decía «OBJETOS»)
function svgCofreRap(t, g, et) {
  const C = CF[t], u = nid(), m = C.mat, luz = Math.min(1, g * 0.3);
  const brillo = (y) => `<rect x="30" y="${y}" width="180" height="28" fill="${C.claro}" opacity="${luz.toFixed(2)}" filter="url(#${u}b)"/>`;
  const defs = `<defs><filter id="${u}b" x="-30%" y="-200%" width="160%" height="500%"><feGaussianBlur stdDeviation="7"/></filter>
    <linearGradient id="${u}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E0A466"/><stop offset=".55" stop-color="#A8652C"/><stop offset="1" stop-color="#6B3B14"/></linearGradient>
    <linearGradient id="${u}o" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF0A8"/><stop offset=".5" stop-color="#E2A812"/><stop offset="1" stop-color="#8A5A00"/></linearGradient>
    <linearGradient id="${u}f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF4F93"/><stop offset=".6" stop-color="#7A0B3F"/><stop offset="1" stop-color="#1A0410"/></linearGradient></defs>`;
  const esquinas = (x1, y1, x2, y2, c) => [[x1, y1, 1, 1], [x2, y1, -1, 1], [x1, y2, 1, -1], [x2, y2, -1, -1]]
    .map(([x, y, a, b]) => `<path d="M${x} ${y + 22 * b}V${y}H${x + 22 * a}" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="square"/>`).join('');
  if (m === 'madera') {   // el cajón de discos: las fundas asoman y salen volando
    const fundas = [['#E41373', -9, 62], ['#F5C542', -3, 100], ['#29B298', 4, 138], ['#9B5CFF', 10, 176]]
      .map(([c, rot, x]) => `<g transform="rotate(${rot} ${x} 118)"><rect x="${x - 27}" y="52" width="54" height="72" fill="${c}" stroke="#0B0B0E" stroke-width="4"/><circle cx="${x}" cy="82" r="15" fill="#0B0B0E"/><circle cx="${x}" cy="82" r="5" fill="#F6F2E8"/></g>`).join('');
    return `<svg viewBox="0 0 240 260" aria-hidden="true">${defs}
      <g class="dsw-tapa">${fundas}</g>${brillo(98)}
      <g class="dsw-cuerpo"><rect x="28" y="110" width="184" height="118" rx="6" fill="url(#${u}m)" stroke="#0B0B0E" stroke-width="7"/>
        <rect x="42" y="134" width="156" height="9" fill="#3A1E08" opacity=".6"/><rect x="42" y="170" width="156" height="9" fill="#3A1E08" opacity=".6"/>
        <rect x="94" y="194" width="52" height="15" rx="7.5" fill="#2A1404" stroke="#0B0B0E" stroke-width="3"/>
        <text x="120" y="163" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="900" font-size="17" letter-spacing="3" fill="#2A1404" opacity=".75">DISCOS</text></g></svg>`;
  }
  if (m === 'hierro') {   // el flight case: tapa con manija, esquinas de metal y el cierre de mariposa
    const stick = '<g transform="rotate(-8 70 182)"><rect x="46" y="168" width="52" height="26" fill="#E41373" stroke="#0B0B0E" stroke-width="3"/><text x="72" y="187" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="900" font-style="italic" font-size="15" fill="#fff">UL</text></g><g transform="rotate(6 168 186)"><rect x="140" y="174" width="58" height="24" fill="#F5C542" stroke="#0B0B0E" stroke-width="3"/><text x="169" y="191" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="900" font-size="12" fill="#0B0B0E">LIGA</text></g>';
    return `<svg viewBox="0 0 240 260" aria-hidden="true">${defs}
      <g class="dsw-cuerpo"><rect x="24" y="126" width="192" height="102" rx="6" fill="#24252C" stroke="#0B0B0E" stroke-width="7"/>
        <rect x="31" y="133" width="178" height="88" rx="3" fill="none" stroke="#8FA3B8" stroke-width="3"/>${esquinas(31, 133, 209, 221, '#DDE6EE')}${stick}</g>${brillo(116)}
      <g class="dsw-tapa"><path d="M98 80V64H142V80" fill="none" stroke="#0B0B0E" stroke-width="10"/><path d="M98 80V64H142V80" fill="none" stroke="#C9D3DC" stroke-width="4"/>
        <rect x="24" y="78" width="192" height="50" rx="6" fill="#2C2D35" stroke="#0B0B0E" stroke-width="7"/>
        <rect x="31" y="85" width="178" height="36" rx="3" fill="none" stroke="#8FA3B8" stroke-width="3"/>${esquinas(31, 85, 209, 121, '#DDE6EE')}
        <text x="120" y="112" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="900" font-size="20" letter-spacing="4" fill="#DDE6EE" opacity=".9">UL</text></g>
      <g class="dsw-cerr"><rect x="104" y="116" width="32" height="24" rx="4" fill="#DDE6EE" stroke="#0B0B0E" stroke-width="4"/><circle cx="120" cy="128" r="4" fill="#0B0B0E"/></g></svg>`;
  }
  if (m === 'oro') {   // el baúl de los objetos: negro con herrajes dorados
    const TAPA = 'M26 130V100Q26 80 46 78H194Q214 80 214 100V130Z';
    return `<svg viewBox="0 0 240 260" aria-hidden="true">${defs}
      <g class="dsw-cuerpo"><rect x="26" y="126" width="188" height="102" rx="6" fill="#17141C" stroke="#0B0B0E" stroke-width="7"/>
        <rect x="46" y="128" width="16" height="98" fill="url(#${u}o)" stroke="#0B0B0E" stroke-width="4"/><rect x="178" y="128" width="16" height="98" fill="url(#${u}o)" stroke="#0B0B0E" stroke-width="4"/>
        <rect x="28" y="206" width="184" height="12" fill="url(#${u}o)" stroke="#0B0B0E" stroke-width="4"/>${esquinas(33, 133, 207, 221, '#F5C542')}</g>${brillo(116)}
      <g class="dsw-tapa"><path d="${TAPA}" fill="#211C29" stroke="#0B0B0E" stroke-width="7" stroke-linejoin="round"/>
        <rect x="46" y="80" width="16" height="50" fill="url(#${u}o)" stroke="#0B0B0E" stroke-width="4"/><rect x="178" y="80" width="16" height="50" fill="url(#${u}o)" stroke="#0B0B0E" stroke-width="4"/>
        <rect x="70" y="90" width="100" height="24" fill="url(#${u}o)" stroke="#0B0B0E" stroke-width="4"/>
        <text x="120" y="107" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="900" font-size="12" letter-spacing="1" fill="#0B0B0E">${esc(et || 'OBJETOS')}</text></g>
      <g class="dsw-cerr"><rect x="104" y="114" width="32" height="38" rx="5" fill="#F5C542" stroke="#0B0B0E" stroke-width="5"/><circle cx="120" cy="129" r="5" fill="#0B0B0E"/><rect x="118" y="129" width="4" height="12" fill="#0B0B0E"/></g></svg>`;
  }
  // la funda del Campeón: el disco de oro asoma arriba y sale girando al abrir; el sello «T1» hace de cerradura
  return `<svg viewBox="0 0 240 260" aria-hidden="true">${defs}
    <g class="dsw-tapa"><circle cx="120" cy="96" r="62" fill="url(#${u}o)" stroke="#0B0B0E" stroke-width="6"/>
      ${[52, 42, 32].map((rr) => `<circle cx="120" cy="96" r="${rr}" fill="none" stroke="#6A4400" stroke-opacity=".45" stroke-width="2"/>`).join('')}
      <circle cx="120" cy="96" r="20" fill="#E41373" stroke="#0B0B0E" stroke-width="4"/><circle cx="120" cy="96" r="4" fill="#0B0B0E"/></g>${brillo(86)}
    <g class="dsw-cuerpo"><rect x="36" y="100" width="168" height="128" fill="url(#${u}f)" stroke="#0B0B0E" stroke-width="7"/>
      <rect x="46" y="110" width="148" height="108" fill="none" stroke="#F5C542" stroke-opacity=".7" stroke-width="2.5"/>
      <path d="M96 168L104 140L120 156L136 140L144 168Z" fill="#F5C542" stroke="#0B0B0E" stroke-width="4" stroke-linejoin="round"/>
      <text x="120" y="200" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="900" font-style="italic" font-size="20" fill="#F5C542">CAMPEÓN</text></g>
    <g class="dsw-cerr"><circle cx="186" cy="118" r="18" fill="#F5C542" stroke="#0B0B0E" stroke-width="4"/><text x="186" y="124" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="900" font-size="16" fill="#0B0B0E">T1</text></g></svg>`;
}
//: el Tesoro del Dragón (el 4): oscuro, con cuernos y gemas de prisma. Es la marca, por eso no es «de rap»
function svgTesoro(g) {
  const C = CF[4], u = nid();
  const cols = ['#3A3346', '#17131E', '#040306'], banda = `url(#${u}p)`, luz = Math.min(1, g * 0.3);
  const gemas = `<path d="M120 70L134 90L120 110L106 90Z" fill="url(#${u}p)" stroke="#0B0B0E" stroke-width="4"/><path d="M76 84L84 94L76 104L68 94Z" fill="url(#${u}p)" stroke="#0B0B0E" stroke-width="3"/><path d="M164 84L172 94L164 104L156 94Z" fill="url(#${u}p)" stroke="#0B0B0E" stroke-width="3"/>`;
  const cuernos = `<path d="M46 98Q14 66 34 26Q44 62 70 82Z" fill="url(#${u}p)" stroke="#0B0B0E" stroke-width="5" stroke-linejoin="round"/><path d="M194 98Q226 66 206 26Q196 62 170 82Z" fill="url(#${u}p)" stroke="#0B0B0E" stroke-width="5" stroke-linejoin="round"/>`;
  const TAPA = 'M30 130V104Q30 52 120 52Q210 52 210 104V130Z';
  return `<svg viewBox="0 0 240 260" aria-hidden="true"><defs>
      <linearGradient id="${u}c" x1="0" y1="0" x2="0" y2="1">${stopsDe(cols)}</linearGradient>
      <linearGradient id="${u}p" x1="0" y1="0" x2="1" y2="1">${stopsDe(PRISMA)}</linearGradient>
      <clipPath id="${u}k"><path d="${TAPA}"/></clipPath>
      <filter id="${u}b" x="-30%" y="-200%" width="160%" height="500%"><feGaussianBlur stdDeviation="7"/></filter></defs>
    <rect x="30" y="118" width="180" height="24" fill="${C.claro}" opacity="${luz.toFixed(2)}" filter="url(#${u}b)"/>
    <g class="dsw-cuerpo">
      <rect x="30" y="128" width="180" height="100" rx="8" fill="url(#${u}c)" stroke="#0B0B0E" stroke-width="7"/>
      <rect x="48" y="130" width="16" height="96" fill="${banda}" stroke="#0B0B0E" stroke-width="4"/>
      <rect x="176" y="130" width="16" height="96" fill="${banda}" stroke="#0B0B0E" stroke-width="4"/>
      <rect x="32" y="206" width="176" height="12" fill="${banda}" stroke="#0B0B0E" stroke-width="4"/>
    </g>
    <g class="dsw-tapa">${cuernos}
      <path d="${TAPA}" fill="url(#${u}c)"/>
      <g clip-path="url(#${u}k)"><rect x="48" y="40" width="16" height="92" fill="${banda}" stroke="#0B0B0E" stroke-width="4"/><rect x="176" y="40" width="16" height="92" fill="${banda}" stroke="#0B0B0E" stroke-width="4"/>
        <ellipse cx="92" cy="72" rx="34" ry="10" fill="#fff" opacity=".18" transform="rotate(-12 92 72)"/></g>
      ${gemas}
      <path d="${TAPA}" fill="none" stroke="#0B0B0E" stroke-width="7" stroke-linejoin="round"/>
      ${luz > 0 ? `<line x1="36" y1="130" x2="204" y2="130" stroke="${C.claro}" stroke-width="${(2 + g * 1.5).toFixed(1)}" opacity="${luz.toFixed(2)}"/>` : ''}
    </g>
    <g class="dsw-cerr"><rect x="104" y="112" width="32" height="40" rx="5" fill="#E9FBFF" stroke="#0B0B0E" stroke-width="5"/><circle cx="120" cy="128" r="5" fill="#0B0B0E"/><rect x="118" y="128" width="4" height="13" fill="#0B0B0E"/></g>
  </svg>`;
}
const GRIETAS_ESC = '<svg class="dsw-mitad dsw-gr" viewBox="0 0 240 260" aria-hidden="true"><g fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M120 130L96 92L104 64L88 30"/><path d="M120 130L160 104L182 112L204 88"/><path d="M120 130L110 176L126 206L118 238"/><path d="M120 130L72 146L52 132L30 150"/><path d="M120 130L168 168L192 158"/></g></svg>';

function svgMoneda(k) {
  const u = nid(), pos = k === 1 ? [[100, 100]] : k === 3 ? [[66, 120], [134, 120], [100, 82]] : [[52, 132], [100, 138], [148, 132], [76, 92], [124, 92]];
  const s = k === 1 ? 1 : k === 3 ? 0.72 : 0.6;
  const una = ([x, y]) => `<g transform="translate(${x} ${y}) scale(${s})"><circle r="86" fill="url(#${u}m)" stroke="#0B0B0E" stroke-width="9"/><circle r="64" fill="none" stroke="#8A5A00" stroke-width="5" stroke-opacity=".6"/><text y="24" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="900" font-style="italic" font-size="64" fill="#8A5A00">UL</text><ellipse cx="-28" cy="-38" rx="18" ry="28" fill="#fff" opacity=".5" transform="rotate(-35 -28 -38)"/></g>`;
  return `<svg viewBox="0 0 200 200" aria-hidden="true"><defs><radialGradient id="${u}m" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#FFF3B8"/><stop offset=".55" stop-color="#F5C542"/><stop offset="1" stop-color="#B07A00"/></radialGradient></defs>${pos.map(una).join('')}</svg>`;
}
const cintaHTML = (txt, R) => `<div class="dsw-cinta-b"><div class="dsw-cinta${R.prisma ? ' dsw-prisma' : ''}" style="--c:${R.c}">${esc(txt)}</div></div>`;
const CANDADO = (on) => `<svg viewBox="0 0 24 32" aria-hidden="true"><path d="${on ? 'M7 15V10a5 5 0 0 1 10 0v5' : 'M7 15V8a5 5 0 0 1 10 0'}" fill="none" stroke="#0B0B0E" stroke-width="5"/><path d="${on ? 'M7 15V10a5 5 0 0 1 10 0v5' : 'M7 15V8a5 5 0 0 1 10 0'}" fill="none" stroke="${on ? '#F5C542' : '#4A4A55'}" stroke-width="2.6"/><rect x="3.5" y="14" width="17" height="15" rx="3" fill="${on ? '#F5C542' : '#2B2B33'}" stroke="#0B0B0E" stroke-width="2.4"/><circle cx="12" cy="21" r="2" fill="#0B0B0E"/></svg>`;
const LLAMA = (on) => `<svg viewBox="0 0 24 32" aria-hidden="true"><path d="M12 1.5C13.6 7 21 10.5 21 19.5a9 9 0 0 1-18 0c0-4.2 2.2-7.3 4.4-9.2.1 3.3 1.3 5.2 3.1 6.1C9.4 11.3 10.4 6 12 1.5z" fill="${on ? '#FF7A1A' : '#2B2B33'}" stroke="#0B0B0E" stroke-width="2.4" stroke-linejoin="round"/>${on ? '<path d="M12 14c1.2 3 5 4.6 5 8.3a5 5 0 0 1-10 0c0-2.2 1.4-3.6 2.6-4.6.3 1.6 1 2.6 2 3-.6-2.4-.4-4.6.4-6.7z" fill="#FFD34D"/>' : ''}</svg>`;
const ICO_SON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
const ICO_MUDO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9l6 6M22 9l-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
const ICO_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
const ICO_TITULO = (R) => `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M2 10H38L33 20L38 30H2L7 20Z" fill="${R.c}" stroke="#0B0B0E" stroke-width="2.5" stroke-linejoin="round"/></svg>`;

const PLANTILLA = `
  <div class="dsw-esc dsw-v-transforma">
    <div class="dsw-fondo"></div><div class="dsw-escamas"></div><div class="dsw-rayos"></div><div class="dsw-velo"></div>
    <div class="dsw-cab"><small class="dsw-sub">Dragón Drop</small><h2 class="dsw-rz">Maqueta</h2></div>
    <div class="dsw-objs"></div>
    <div class="dsw-pie"><p class="dsw-pips-t"></p><div class="dsw-pips"></div><p class="dsw-pista"></p></div>
    <button type="button" class="dsw-toque" aria-label="Tocar"></button>
    <section class="dsw-capa dsw-premio" hidden aria-live="polite">
      <p class="dsw-pr-cuenta"></p><p class="dsw-pr-et"></p><div class="dsw-pr-ico"></div>
      <p class="dsw-pr-nombre"></p><p class="dsw-pr-num"></p><p class="dsw-pr-chip"></p><p class="dsw-pr-tope"></p>
    </section>
    <section class="dsw-capa dsw-rs" hidden aria-live="polite">
      <h2 class="dsw-rs-t">Te llevaste</h2><ul class="dsw-rs-lista"></ul><p class="dsw-rs-nota"></p><div class="dsw-rs-bot"></div>
    </section>
    <section class="dsw-capa dsw-err" hidden role="alert">
      <h2 class="dsw-rs-t">No se pudo abrir</h2><p class="dsw-err-tx"></p>
      <div class="dsw-rs-bot"><button type="button" class="dsw-b dsw-b-blanco dsw-err-ok">Cerrar</button></div>
    </section>
    <div class="dsw-flash"></div>
  </div>
  <div class="dsw-fxcapa"></div>
  <canvas class="dsw-fx"></canvas>
  <div class="dsw-ctl">
    <button type="button" class="dsw-ctl-b dsw-mudo"></button>
    <button type="button" class="dsw-ctl-b dsw-x" aria-label="Cerrar">${ICO_X}</button>
  </div>`;

//: el CSS va en la raíz donde se cuelga (el shadow root de la página): `usarCss` lo pone en el orden de las páginas, y si
//: el host vive en otra raíz (una prueba, otra página) se pone ahí
function ponerCss(raiz) {
  usarCss('drops-show', CSS);
  try {
    if (raiz && raiz.querySelector && !raiz.querySelector('style[data-css="drops-show"]')) {
      const st = document.createElement('style');
      st.dataset.css = 'drops-show';
      st.textContent = CSS;
      (raiz.head || raiz).appendChild(st);
    }
  } catch (e) { /* sin raíz: igual se ve, sin estilo */ }
}

/** 🐉 Abre `cola` (filas de `cerrados`) a pantalla completa. Ver el encabezado. */
export function mostrarDrops(host, cola, { abrir, alCerrar, cofres } = {}) {
  const casa = host || document.body;
  const raiz = casa.getRootNode ? casa.getRootNode() : document;
  ponerCss(raiz);
  const calma = (() => { try { return quieto() || !!(raiz.querySelector && raiz.querySelector('.app.calma')); } catch (e) { return false; } })();
  const dlg = document.createElement('dialog');
  dlg.className = 'dsw' + (calma ? ' dsw-calma' : '');
  dlg.setAttribute('aria-label', 'Abrir Dragón Drops');
  dlg.innerHTML = PLANTILLA;
  casa.appendChild(dlg);
  const $ = (s) => dlg.querySelector(s);
  const escEl = $('.dsw-esc'), objsEl = $('.dsw-objs'), rzEl = $('.dsw-rz'), subEl = $('.dsw-sub'), pistaEl = $('.dsw-pista'), cabEl = $('.dsw-cab');
  const toqueEl = $('.dsw-toque'), capaFx = $('.dsw-fxcapa'), premioEl = $('.dsw-premio'), rsEl = $('.dsw-rs'), errEl = $('.dsw-err');
  const mudoEl = $('.dsw-mudo');

  const lista = (Array.isArray(cola) ? cola : []).filter((x) => x && x.id != null);
  let ic = 0;
  const abiertos = [];
  let puntosTodos = 0;
  const S = { v: 'transforma', tipo: 'drop', osc: false, star: false, r: 0, n: 1, fin: 0, finN: 1, plan: [], toque: 0, grieta: 0,
    maxT: 4, cofre: 0, base: 0, pal: null, item: null, res: null, fila: [], acum: [], puntos: 0, notas: [], extra: null,
    fase: '', ocupado: false, cola: false, saltar: false, premios: [], ip: 0, vivo: true, calma };
  const T = (ms) => (S.calma ? Math.round(ms * 0.55) : ms);
  const espera = (ms) => new Promise((r) => setTimeout(r, T(ms)));
  const nombreCofre = (t) => (cofres && cofres[t] && cofres[t].n) || CF[t].n;
  // 🐣 un cofre que no es de `COFRES` (17/11/2026: la Caja del Nuevo, `abrirCajaNuevo()` de drops.jsx) trae su nombre en
  // la fila (`nombre`) y se dibuja con el material del cofre `t`. Si sube, pasa a llamarse como el cofre al que subió
  const nombreDe = (t) => (S.item && S.item.tipo === 'cofre' && S.item.nombre && tCofre(S.item.cofre) === t ? String(S.item.nombre) : nombreCofre(t));
  //: y lo que dice su placa (`etiqueta`), con la misma regla
  const etiquetaDe = (t) => (S.item && S.item.tipo === 'cofre' && S.item.etiqueta && tCofre(S.item.cofre) === t ? String(S.item.etiqueta) : '');

  /* ------------------------------------------------ las partículas (un canvas para todo) */
  const fx = { c: $('.dsw-fx'), g: null, ps: [], va: false, t: 0, w: 0, h: 0 };
  function fxTam() {
    const dpr = Math.min(2, W.devicePixelRatio || 1);
    fx.w = dlg.clientWidth || W.innerWidth; fx.h = dlg.clientHeight || W.innerHeight;
    fx.c.width = Math.round(fx.w * dpr); fx.c.height = Math.round(fx.h * dpr); fx.c.style.width = fx.w + 'px'; fx.c.style.height = fx.h + 'px';
    fx.g = fx.c.getContext('2d'); if (fx.g) fx.g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const sprites = {};
  function sprite(col) {
    if (sprites[col]) return sprites[col];
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, col); gr.addColorStop(0.45, col + '88'); gr.addColorStop(1, col + '00');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (sprites[col] = c);
  }
  const colFuego = (t) => (t < 0.12 ? '#FFFFFF' : t < 0.3 ? '#FFE27A' : t < 0.55 ? '#FF9A1F' : t < 0.8 ? '#E8441A' : '#6A1C10');
  function emitir(p) { if (!S.vivo || !fx.g) return; p.vida0 = p.vida0 || p.vida; fx.ps.push(p); if (!fx.va) { fx.va = true; fx.t = 0; requestAnimationFrame(paso); } }
  function paso(t) {
    if (!S.vivo) { fx.va = false; fx.ps = []; return; }
    const dt = fx.t ? Math.min(0.05, (t - fx.t) / 1000) : 0.016; fx.t = t;
    const g = fx.g; g.clearRect(0, 0, fx.w, fx.h);
    fx.ps = fx.ps.filter((p) => (p.vida -= dt) > 0);
    for (const p of fx.ps) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.grav || 0) * dt;
      if (p.roce) { const k = Math.max(0, 1 - p.roce * dt); p.vx *= k; p.vy *= k; }
      p.rot = (p.rot || 0) + (p.vr || 0) * dt; dibujar(g, p);
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    if (fx.ps.length) requestAnimationFrame(paso); else { fx.va = false; g.clearRect(0, 0, fx.w, fx.h); }
  }
  function dibujar(g, p) {
    const a = Math.max(0, Math.min(1, p.vida / p.vida0));
    if (p.k === 'chispa') {
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = a; g.strokeStyle = p.col; g.lineWidth = p.ancho; g.lineCap = 'round';
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); g.stroke();
    } else if (p.k === 'trozo') {
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = Math.min(1, a * 1.6);
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.col; g.strokeStyle = '#0B0B0E'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(-p.s, -p.s * 0.6); g.lineTo(p.s, -p.s * 0.2); g.lineTo(-p.s * 0.2, p.s); g.closePath(); g.fill(); g.stroke(); g.restore();
    } else if (p.k === 'humo') {
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = a * 0.6;
      const s = p.s * (2.2 - a * 0.9); g.drawImage(sprite(p.col || '#EDEDF2'), p.x - s, p.y - s, s * 2, s * 2);
    } else if (p.k === 'fuego' || p.k === 'brasa') {
      g.globalCompositeOperation = 'lighter';
      const sp = sprite(p.k === 'brasa' ? p.col : colFuego(1 - a));
      g.globalAlpha = p.k === 'brasa' ? a : a * 0.9;
      const s = p.s * (p.k === 'fuego' ? 0.6 + (1 - a) * 0.9 : 1); g.drawImage(sp, p.x - s, p.y - s, s * 2, s * 2);
    } else if (p.k === 'nota') {
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = Math.min(1, a * 1.5);
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.font = `900 ${p.s}px Archivo, sans-serif`; g.textAlign = 'center';
      g.lineWidth = 6; g.strokeStyle = '#0B0B0E'; g.strokeText(p.t, 0, 0); g.fillStyle = p.col; g.fillText(p.t, 0, 0); g.restore();
    } else if (p.k === 'moneda') {
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = Math.min(1, a * 2);
      g.save(); g.translate(p.x, p.y); g.scale(Math.max(0.15, Math.abs(Math.cos(p.rot))), 1);
      g.fillStyle = '#F5C542'; g.strokeStyle = '#0B0B0E'; g.lineWidth = 2.5;
      g.beginPath(); g.arc(0, 0, p.s, 0, 6.283); g.fill(); g.stroke();
      g.fillStyle = '#FFF3B8'; g.beginPath(); g.arc(-p.s * 0.3, -p.s * 0.3, p.s * 0.35, 0, 6.283); g.fill(); g.restore();
    } else if (p.k === 'brillo') {
      g.globalCompositeOperation = 'lighter'; const tw = Math.sin((1 - a) * Math.PI); g.globalAlpha = tw; g.fillStyle = p.col;
      const s = p.s * (0.4 + tw * 0.6), x = p.x, y = p.y;
      g.beginPath(); g.moveTo(x, y - s); g.quadraticCurveTo(x, y, x + s, y); g.quadraticCurveTo(x, y, x, y + s); g.quadraticCurveTo(x, y, x - s, y); g.quadraticCurveTo(x, y, x, y - s); g.fill();
    }
  }
  const cuantas = (n) => (S.calma ? Math.ceil(n / 3) : n);

  /* ------------------------------------------------ efectos de escena (coordenadas del propio <dialog>) */
  const giros = () => [...objsEl.querySelectorAll('.dsw-giro')];
  const cajas = () => [...objsEl.querySelectorAll('.dsw-obj')];
  function rel(b) { const o = dlg.getBoundingClientRect(); return { x: b.left - o.left + b.width / 2, y: b.top - o.top + b.height / 2, w: b.width }; }
  function centros() { return cajas().map((el) => rel(el.getBoundingClientRect())); }
  function chispas(n, cols, cs) {
    (cs || centros()).forEach((c) => { for (let i = 0; i < cuantas(n); i++) { const a = Math.random() * 6.283, v = (220 + Math.random() * 520) * (c.w / 300 + 0.4);
      emitir({ k: 'chispa', x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, grav: 380, roce: 1.6, vida: 0.45 + Math.random() * 0.45, col: cols[i % cols.length], ancho: 2 + Math.random() * 3 }); } });
  }
  function trozos(cols) {
    centros().forEach((c) => { for (let i = 0; i < cuantas(18); i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 3.6, v = 300 + Math.random() * 600;
      emitir({ k: 'trozo', x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, grav: 1300, roce: 0.4, vida: 1.1, s: (6 + Math.random() * 12) * (c.w / 260 + 0.3), rot: Math.random() * 6, vr: (Math.random() - 0.5) * 18, col: cols[i % cols.length] }); } });
  }
  function polvo() {
    centros().forEach((c) => { for (let i = 0; i < cuantas(8); i++) { const lado = i % 2 ? 1 : -1;
      emitir({ k: 'humo', x: c.x + lado * c.w * 0.18, y: c.y + c.w * 0.46, vx: lado * (60 + Math.random() * 120), vy: -20 - Math.random() * 40, roce: 2, vida: 0.6, s: 8 + Math.random() * 10 * (c.w / 260 + 0.4) }); } });
  }
  function notas() {
    const R = RZ[S.r]; centros().forEach((c) => { for (let i = 0; i < cuantas(12); i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 3, v = 260 + Math.random() * 420;
      emitir({ k: 'nota', t: ['♪', '♫', '♬'][i % 3], x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, grav: 500, roce: 0.6, vida: 1.2, s: 28 + Math.random() * 26 * (c.w / 260 + 0.3), rot: (Math.random() - 0.5), vr: (Math.random() - 0.5) * 4, col: i % 2 ? '#fff' : R.prisma ? PRISMA[i % 6] : R.claro }); } });
  }
  const intervalos = new Set();
  function fuego() {
    const cy = (centros()[0] || { y: fx.h * 0.5 }).y, dur = T(900), ini = performance.now();
    const iv = setInterval(() => {
      const p = (performance.now() - ini) / dur; if (p >= 1 || !S.vivo) { clearInterval(iv); intervalos.delete(iv); return; }
      const x = -0.15 * fx.w + p * 1.3 * fx.w;
      for (let i = 0; i < (S.calma ? 3 : 9); i++) emitir({ k: 'fuego', x: x + (Math.random() - 0.5) * 60, y: cy + (Math.random() - 0.5) * fx.h * 0.34, vx: 500 + Math.random() * 400, vy: -40 - Math.random() * 120, roce: 1.2, vida: 0.55 + Math.random() * 0.4, s: 40 + Math.random() * 60 });
    }, 16);
    intervalos.add(iv);
  }
  function prisma() { for (let i = 0; i < cuantas(44); i++) setTimeout(() => emitir({ k: 'brillo', x: Math.random() * fx.w, y: Math.random() * fx.h * 0.92, vx: 0, vy: -12, vida: 0.75, s: 8 + Math.random() * 20, col: PRISMA[i % PRISMA.length] }), Math.random() * T(1000)); }
  function lluviaMonedas(n, cs) {
    (cs || centros()).forEach((c) => { for (let i = 0; i < cuantas(n); i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.7, v = 480 + Math.random() * 520;
      emitir({ k: 'moneda', x: c.x, y: c.y - c.w * 0.08, vx: Math.cos(a) * v, vy: Math.sin(a) * v, grav: 1400, roce: 0.3, vida: 1.5, s: 7 + Math.random() * 6 * (c.w / 260 + 0.4), rot: Math.random() * 6, vr: (Math.random() - 0.5) * 16 }); } });
  }
  function capaDe(clase, estilo, cuadros, ms, easing) {
    const el = document.createElement('i'); el.className = clase; Object.assign(el.style, estilo); capaFx.appendChild(el);
    el.animate(cuadros, { duration: T(ms), easing }).finished.then(() => el.remove(), () => el.remove());
  }
  function haz() {
    centros().forEach((c) => capaDe('dsw-haz', { left: (c.x - c.w * 0.36) + 'px', width: (c.w * 0.72) + 'px', top: '0px', height: Math.max(0, c.y - c.w * 0.05) + 'px' },
      [{ transform: 'scaleY(0)', opacity: 1 }, { transform: 'scaleY(1)', opacity: 1, offset: 0.35 }, { transform: 'scaleY(1)', opacity: 0 }], 1100, 'ease-out'));
  }
  let brasasIv = null;
  function brasas(on) {
    if (brasasIv) { clearInterval(brasasIv); intervalos.delete(brasasIv); }
    brasasIv = null;
    if (!on || S.calma) return;
    brasasIv = setInterval(() => { const R = S.pal || RZ[S.r]; centros().forEach((c, i) => { if (S.n > 2 && Math.random() < 0.5) return;
      emitir({ k: 'brasa', x: c.x + (Math.random() - 0.5) * c.w * 0.8, y: c.y + c.w * 0.36, vx: (Math.random() - 0.5) * 30, vy: -60 - Math.random() * 90, vida: 1.6, s: 5 + Math.random() * 7, col: R.prisma ? PRISMA[(i + azarEntre(6)) % 6] : R.claro }); }); }, 150);
    intervalos.add(brasasIv);
  }
  function anillo(fuerza, col) {
    centros().forEach((c) => capaDe('dsw-anillo', { left: c.x + 'px', top: c.y + 'px', width: c.w + 'px', height: c.w + 'px', borderColor: col || '#fff' },
      [{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 1, borderWidth: '18px' }, { transform: `translate(-50%,-50%) scale(${(1.6 + fuerza * 1.4).toFixed(2)})`, opacity: 0, borderWidth: '2px' }], 520, 'cubic-bezier(.1,.8,.3,1)'));
  }
  function luz() {
    centros().forEach((c) => capaDe('dsw-luz', { left: c.x + 'px', top: c.y + 'px', width: c.w + 'px', height: c.w + 'px' },
      [{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(3.2)', opacity: 0 }], 700, 'ease-out'));
  }
  function destello(alfa, dur) { $('.dsw-flash').animate([{ opacity: alfa }, { opacity: 0 }], { duration: dur || T(340), easing: 'ease-out' }); }
  function temblor(r) {
    if (S.calma) return;
    const a = r >= 5 ? 14 : r >= 4 ? 10 : 6;
    escEl.animate([0, 1, 2, 3, 4, 5, 6].map((i) => ({ transform: i === 6 ? 'none' : `translate(${(Math.random() - 0.5) * 2 * a}px,${(Math.random() - 0.5) * 2 * a}px)` })), { duration: T(380) });
  }
  const sacude = (s) => [0, -4, 4, -7, 7, -10, 10, -13, 0].map((d, i) => ({ transform: `rotate(${d}deg) scale(${(1 + (s - 1) * (i / 8)).toFixed(3)})` }));
  const todas = (els, fn) => Promise.all(els.map((el) => fn(el).finished.catch(() => {})));

  /* ------------------------------------------------ las tres animaciones y el cofre */
  const OBJ_T = ['DEMO', 'MIXTAPE'];
  const oscuro = () => S.osc && S.r < MAX;
  const VAR = {
    huevo: {
      pista: 'Toca el huevo',
      svg: (r) => svgHuevo(r, S.grieta, oscuro()),
      async cargar() {
        await todas(giros(), (el) => el.animate([{ transform: 'none' }, { transform: 'translateY(5%) scale(1.08,.88)' }, { transform: 'translateY(-3%) scale(.94,1.07) rotate(-5deg)' }, { transform: 'scale(1.03,.98) rotate(4deg)' }, { transform: 'none' }], { duration: T(240), easing: 'ease-out' }));
        repintar(); Son.grieta(); chispas(6, ['#fff', RZ[S.r].ojo]);
      },
      async cambiar(nr, ultimo) {
        const els = giros();
        els.forEach((el) => el.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(3.4) saturate(0)' }, { filter: 'brightness(1)' }], { duration: T(ultimo ? 360 : 200) }));
        await espera(ultimo ? 110 : 60); repintar();
        await todas(els, (el) => el.animate([{ transform: 'scale(1.16)' }, { transform: 'scale(.97)', offset: 0.6 }, { transform: 'none' }], { duration: T(ultimo ? 380 : 200), easing: 'cubic-bezier(.2,.9,.3,1.2)' }));
      },
      async nada() { await todas(giros(), (el) => el.animate([{ transform: 'none' }, { transform: 'rotate(-7deg)' }, { transform: 'rotate(6deg)' }, { transform: 'rotate(-3deg)' }, { transform: 'none' }], { duration: T(320) })); },
      async abrir() {
        const els = giros();
        await todas(els, (el) => el.animate(sacude(1.12), { duration: T(560), easing: 'ease-in' }));
        els.forEach((el) => {
          el.innerHTML = svgHuevo(S.r, 4, oscuro(), 'arriba') + svgHuevo(S.r, 4, oscuro(), 'abajo');
          const [a, b] = el.querySelectorAll('svg');
          a.animate([{ transform: 'none', opacity: 1 }, { transform: 'translate(-14%,-70%) rotate(-38deg)', opacity: 0 }], { duration: T(640), easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' });
          b.animate([{ transform: 'none', opacity: 1 }, { transform: 'translate(6%,22%) rotate(10deg) scale(.92)', opacity: 0 }], { duration: T(640), easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' });
        });
        const R = RZ[S.r]; luz(); trozos(oscuro() ? ['#1A1622', R.c] : R.prisma ? PRISMA : [R.c, R.claro, R.d]); chispas(30, ['#fff', R.ojo, R.c]);
      },
    },
    transforma: {
      pista: 'Toca el drop',
      svg: (r) => (r <= 1 ? svgCasete(r, OBJ_T[r], oscuro()) : r === 4 ? svgMicro(r, oscuro()) : svgDisco(r, r === 2 ? 'vinilo' : r === 3 ? 'oro' : 'diamante', oscuro())),
      async cargar() {
        const disco = S.r >= 2 && S.r !== 4;
        if (disco) Son.scratch();
        await todas(giros(), (el) => el.animate(disco
          ? [{ transform: 'none' }, { transform: 'rotate(-40deg)' }, { transform: 'rotate(16deg)' }, { transform: 'rotate(-28deg)' }, { transform: 'none' }]
          : [{ transform: 'none' }, { transform: 'translateX(-5%) rotate(-5deg) scale(1.04)' }, { transform: 'translateX(5%) rotate(5deg) scale(1.06)' }, { transform: 'translateX(-2%)' }, { transform: 'none' }], { duration: T(270), easing: 'ease-in-out' }));
      },
      async cambiar(nr, ultimo) {
        const els = giros();
        await todas(els, (el) => el.animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(.2) rotate(160deg)', opacity: 0 }], { duration: T(ultimo ? 170 : 110), easing: 'ease-in', fill: 'forwards' }));
        repintar();
        await todas(els, (el) => { el.getAnimations().forEach((a) => a.cancel());
          return el.animate([{ transform: 'scale(.3) rotate(-120deg)', opacity: 0 }, { transform: 'scale(1.18) rotate(8deg)', opacity: 1, offset: 0.65 }, { transform: 'none', opacity: 1 }], { duration: T(ultimo ? 420 : 220), easing: 'cubic-bezier(.2,.9,.3,1.2)' }); });
      },
      async nada() { await todas(giros(), (el) => el.animate([{ transform: 'none' }, { transform: 'translateY(-6%) rotate(-6deg)' }, { transform: 'translateY(2%) rotate(5deg)' }, { transform: 'none' }], { duration: T(320) })); },
      async abrir() {
        const els = giros();
        await todas(els, (el) => el.animate([{ transform: 'none' }, { transform: 'scale(1.06) rotate(-8deg)', offset: 0.2 }, { transform: 'scale(1.12) rotate(8deg)', offset: 0.4 }, { transform: 'scale(1.2) rotate(-10deg)', offset: 0.6 }, { transform: 'scale(1.34) rotate(720deg)', opacity: 1 }], { duration: T(640), easing: 'ease-in' }));
        els.forEach((el) => { el.style.opacity = 0; });
        const R = RZ[S.r]; luz(); notas(); trozos(oscuro() ? ['#1A1622', R.c] : R.prisma ? PRISMA : [R.c, R.claro, '#fff']);
      },
    },
    escama: {
      pista: 'Toca la escama',
      svg: (r) => svgEscama(r, oscuro(), S.star),
      async cargar() { await todas(giros(), (el) => el.animate([{ transform: 'none' }, { transform: 'rotateY(-30deg) rotateX(12deg) scale(.95)' }, { transform: 'rotateY(10deg) scale(1.03)' }, { transform: 'none' }], { duration: T(240), easing: 'ease-out' })); },
      async cambiar(nr, ultimo) {
        const els = giros(), vueltas = ultimo ? (nr >= 3 ? 2 : 1) : 0;
        await todas(els, (el) => el.animate([{ transform: 'rotateY(0deg)' }, { transform: `rotateY(${90 + 360 * vueltas}deg)` }], { duration: T(ultimo ? 160 + 150 * vueltas : 110), easing: 'ease-in', fill: 'forwards' }));
        repintar();
        await todas(els, (el) => { el.getAnimations().forEach((a) => a.cancel());
          return el.animate([{ transform: 'rotateY(-90deg)' }, { transform: 'rotateY(14deg)', offset: 0.7 }, { transform: 'rotateY(0deg)' }], { duration: T(ultimo ? 340 : 170), easing: 'ease-out' }); });
      },
      async nada() { await todas(giros(), (el) => el.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(70deg)' }, { transform: 'rotateY(-25deg)' }, { transform: 'rotateY(8deg)' }, { transform: 'rotateY(0deg)' }], { duration: T(380), easing: 'ease-out' })); },
      async abrir() {
        const els = giros();
        els.forEach((el) => el.insertAdjacentHTML('beforeend', GRIETAS_ESC));
        objsEl.querySelectorAll('.dsw-gr path').forEach((p, i) => { p.style.strokeDasharray = '160'; p.animate([{ strokeDashoffset: 160 }, { strokeDashoffset: 0 }], { duration: T(460), delay: T(i * 40), fill: 'forwards', easing: 'ease-out' }); });
        await todas(els, (el) => el.animate(sacude(1.1), { duration: T(580), easing: 'ease-in' }));
        els.forEach((el) => { el.style.opacity = 0; });
        const R = RZ[S.r]; luz(); trozos(oscuro() ? ['#1A1622', R.c] : R.prisma ? PRISMA : [R.c, R.claro, '#fff']); chispas(28, ['#fff', R.claro, R.c]);
      },
    },
    cofre: {
      get pista() { return S.cofre === 4 ? 'Toca el cofre' : 'Tócalo'; },
      svg: () => (S.cofre === 4 ? svgTesoro(S.grieta) : svgCofreRap(S.cofre, S.grieta, etiquetaDe(S.cofre))),
      async cargar() {
        await todas(giros(), (el) => el.animate([{ transform: 'none' }, { transform: 'translateY(-14%) scale(.95,1.07) rotate(-3deg)' }, { transform: 'translateY(0) scale(1.07,.9)' }, { transform: 'scale(.98,1.03) rotate(2deg)' }, { transform: 'none' }], { duration: T(320), easing: 'ease-out' }));
        repintar(); polvo(); chispas(8, ['#fff', CF[S.cofre].claro]);
      },
      async cambiar() {
        const els = giros();
        els.forEach((el) => el.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(3.4) saturate(0)' }, { filter: 'brightness(1)' }], { duration: T(380) }));
        await espera(120); repintar();
        await todas(els, (el) => el.animate([{ transform: 'scale(1.18)' }, { transform: 'scale(.96)', offset: 0.6 }, { transform: 'none' }], { duration: T(400), easing: 'cubic-bezier(.2,.9,.3,1.2)' }));
      },
      async nada() { await todas(giros(), (el) => el.animate([{ transform: 'none' }, { transform: 'rotate(-4deg)' }, { transform: 'rotate(4deg)' }, { transform: 'rotate(-2deg)' }, { transform: 'none' }], { duration: T(260) })); },
      async abrir() {
        const els = giros();
        await todas(els, (el) => el.animate(sacude(1.08), { duration: T(560), easing: 'ease-in' }));
        Son.tapa(); Son.monedas();
        els.forEach((el) => {
          const tapa = el.querySelector('.dsw-tapa'), cerr = el.querySelector('.dsw-cerr');
          if (tapa) tapa.animate([{ transform: 'none', opacity: 1 }, { transform: 'translate(-6%,-150%) rotate(-24deg)', opacity: 0 }], { duration: T(620), easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' });
          if (cerr) cerr.animate([{ transform: 'none', opacity: 1 }, { transform: 'translate(30%,160%) rotate(70deg)', opacity: 0 }], { duration: T(560), easing: 'cubic-bezier(.4,0,.8,.6)', fill: 'forwards' });
        });
        const C = CF[S.cofre]; haz(); luz(); lluviaMonedas(26); chispas(26, C.prisma ? PRISMA : ['#fff', C.claro, '#F5C542']);
      },
    },
  };
  const V = () => VAR[S.v];

  /* ------------------------------------------------ el escenario */
  function ponerRareza(r, pop) {
    S.r = r; const R = RZ[r]; S.pal = R;
    escEl.style.setProperty('--c', R.c); escEl.style.setProperty('--c1', R.b1); escEl.style.setProperty('--c2', R.b2);
    escEl.style.setProperty('--rayos', [0.06, 0.16, 0.26, 0.38, 0.55, 0.7][r]);
    escEl.classList.toggle('dsw-prisma', !!R.prisma);
    rzEl.textContent = R.n; rzEl.classList.toggle('dsw-prisma', !!R.prisma);
    if (pop) saltaTitulo();
  }
  function ponerCofre(t, pop) {
    S.cofre = t; const C = CF[t]; S.pal = C;
    escEl.style.setProperty('--c', C.c); escEl.style.setProperty('--c1', C.b1); escEl.style.setProperty('--c2', C.b2);
    escEl.style.setProperty('--rayos', [0.1, 0.2, 0.4, 0.55, 0.7][t]);
    escEl.classList.toggle('dsw-prisma', !!C.prisma);
    rzEl.textContent = nombreDe(t); rzEl.classList.toggle('dsw-prisma', !!C.prisma);
    if (pop) saltaTitulo();
  }
  function saltaTitulo() { rzEl.animate([{ transform: 'scale(1.5) rotate(-4deg)', opacity: 0.2 }, { transform: 'scale(.94) rotate(1deg)', opacity: 1, offset: 0.6 }, { transform: 'none', opacity: 1 }], { duration: T(380), easing: 'cubic-bezier(.2,.9,.3,1.3)' }); }
  //: el nombre más largo y la palabra más larga deciden el tamaño, así el título no salta al cambiar de rareza
  const NOMBRES = RZ.map((R) => R.n).concat(CF.map((C, t) => nombreCofre(t)));
  const LARGO = NOMBRES.reduce((a, n) => (n.length > a.length ? n : a), '');
  const PALABRA = NOMBRES.flatMap((n) => n.split(' ')).reduce((a, w) => (w.length > a.length ? w : a), '');
  function medirTitulo() {
    const ancho0 = escEl.clientWidth;
    if (!ancho0) return;
    const max = ancho0 - 44, viejo = rzEl.textContent;
    let s = Math.min(84, Math.max(30, ancho0 * 0.11));
    const pon = () => { rzEl.style.fontSize = s + 'px'; rzEl.style.setProperty('--trazo', Math.max(4, Math.round(s * 0.1)) + 'px'); };
    //: el ancho del TEXTO, no el de la caja (que siempre es el del escenario)
    const ancho = () => { const rg = document.createRange(); rg.selectNodeContents(rzEl); return rg.getBoundingClientRect().width; };
    rzEl.style.whiteSpace = 'nowrap'; rzEl.style.minHeight = ''; rzEl.textContent = LARGO; pon();
    while (ancho() > max && s > 40) { s -= 2; pon(); }
    if (ancho() > max) {
      rzEl.textContent = PALABRA; s = 60; pon();
      while (ancho() > max && s > 26) { s -= 2; pon(); }
      rzEl.style.whiteSpace = 'normal'; rzEl.style.minHeight = Math.ceil(2 * s * 0.98) + 'px';
    }
    rzEl.textContent = viejo;
    objsEl.style.top = Math.round(cabEl.offsetTop + cabEl.offsetHeight + 10) + 'px';
  }
  function medidas() {
    const n = S.n, w = objsEl.clientWidth - 24, h = objsEl.clientHeight;
    const cols = n === 1 ? 1 : n === 2 ? 2 : n === 4 ? (w > h * 1.3 ? 4 : 2) : 4, filas = Math.ceil(n / cols);
    const tam = Math.max(56, Math.min(340, (w / cols) * 0.9, (h / filas) * 0.92 * (240 / 260)));
    objsEl.style.setProperty('--cols', cols); objsEl.style.setProperty('--tam', Math.floor(tam) + 'px');
  }
  function pintarObjs(nacen) {
    medidas();
    objsEl.innerHTML = Array.from({ length: S.n }, (_, i) => `<div class="dsw-obj"><div class="dsw-vaiven" style="animation-delay:-${(i * 0.37).toFixed(2)}s"><div class="dsw-giro">${V().svg(S.r)}</div></div></div>`).join('');
    if (nacen) cajas().forEach((el, i) => el.animate([{ transform: 'scale(.15) rotate(-30deg)', opacity: 0 }, { transform: 'scale(1.14)', opacity: 1, offset: 0.6 }, { transform: 'none', opacity: 1 }], { duration: T(420), delay: T(i * 45), easing: 'cubic-bezier(.2,.9,.3,1.2)', fill: 'backwards' }));
  }
  function repintar() { giros().forEach((el) => { el.innerHTML = V().svg(S.r); }); }
  function pips() {
    const quedan = S.maxT - S.toque, enToques = S.fase === 'toques' || S.fase === 'entrada', cofre = S.v === 'cofre';
    const ico = cofre ? CANDADO : LLAMA, cosa = cofre ? ['candado', 'candados'] : ['oportunidad', 'oportunidades'];
    $('.dsw-pips').innerHTML = enToques ? Array.from({ length: S.maxT }, (_, i) => `<i class="dsw-pip${i === S.toque ? ' dsw-actual' : ''}">${ico(i >= S.toque)}</i>`).join('') : '';
    $('.dsw-pips-t').textContent = enToques ? (quedan === 1 ? `Queda 1 ${cosa[0]}` : `Quedan ${quedan} ${cosa[1]}`) : '';
  }
  function pista(t, late) { pistaEl.textContent = t; pistaEl.classList.toggle('dsw-late', !!late); }
  function verEscena(si) { objsEl.style.visibility = si ? '' : 'hidden'; cabEl.style.visibility = si ? '' : 'hidden'; }
  function fase(f) { S.fase = f; dlg.dataset.fase = f; }

  /** El plan de toques: las subidas y las partidas se reparten al azar entre los 4 toques. Lo que salió ya está decidido. */
  function planear(subidas, partes) {
    const sube = [0, 0, 0, 0], parte = [false, false, false, false];
    for (let i = 0; i < subidas; i++) sube[azarEntre(4)]++;
    [0, 1, 2, 3].sort(() => Math.random() - 0.5).slice(0, partes).forEach((i) => { parte[i] = true; });
    return sube.map((s, i) => ({ sube: s, parte: parte[i] }));
  }

  //: lo que se abre: un drop, un Nido, un Star o un cofre (que trae drops que se abren después, en fila)
  function siguienteDeCola(conEntrada) {
    const it = lista[ic++];
    S.fila = []; S.acum = []; S.puntos = 0; S.notas = []; S.extra = null;
    return empezar(it, conEntrada);
  }
  async function empezar(item, conEntrada) {
    brasas(false); S.item = item; S.res = null;
    const t = tipoDe(item);
    S.tipo = t;
    S.v = t === 'cofre' ? 'cofre' : ANIM[t];
    S.osc = t === 'nido'; S.star = t === 'star';
    S.n = 1; S.finN = 1; S.toque = 0; S.grieta = 0; S.premios = []; S.ip = 0; S.cola = false; S.plan = [];
    if (t === 'cofre') S.maxT = 3;
    else { S.maxT = 4; S.base = tRz(Math.max(Number(item.min) || 0, S.osc ? 1 : 0, S.star ? 2 : 0)); }
    escEl.classList.toggle('dsw-nido', S.osc); escEl.classList.remove('dsw-listo');
    escEl.className = escEl.className.replace(/\bdsw-v-\w+/g, '').trim() + ' dsw-v-' + S.v;
    premioEl.hidden = true; rsEl.hidden = true; errEl.hidden = true; verEscena(true);
    if (t === 'cofre') ponerCofre(tCofre(item.cofre), false); else ponerRareza(S.base, false);
    subEl.textContent = t === 'cofre' ? 'Cofre' : TIPOS[t];
    toqueEl.setAttribute('aria-label', t === 'cofre' ? 'Tocar el cofre' : 'Tocar el ' + TIPOS[t]);
    fase('entrada'); pintarObjs(false); pips(); pista('');
    if (conEntrada) {
      Son.entra();
      await todas(cajas(), (el) => el.animate([{ transform: 'translateY(-75vh) scale(.35) rotate(-40deg)', opacity: 0 }, { transform: 'translateY(0) scale(1.05,.9)', opacity: 1, offset: 0.72 }, { transform: 'translateY(-4%) scale(.97,1.04)', offset: 0.86 }, { transform: 'none', opacity: 1 }], { duration: T(720), easing: 'cubic-bezier(.3,.1,.3,1)', fill: 'backwards' }));
      if (!S.vivo) return;
      polvo();
    }
    fase('toques'); pips(); pista(V().pista);
    try { toqueEl.focus({ preventScroll: true }); } catch (e) { /* sigue */ }
  }

  //: lo que contestó el objeto, acomodado para la animación: hasta dónde sube, en cuántos se parte y en qué toques
  function preparar(r) {
    if (S.v === 'cofre') {
      const desde = tCofre(r.desde != null ? r.desde : S.cofre), fin = Math.max(desde, tCofre(r.cofre != null ? r.cofre : desde));
      if (desde !== S.cofre) { ponerCofre(desde, false); repintar(); }
      let c = desde;
      S.plan = [0, 1, 2].map((i) => { const s = r.sube && r.sube[i] && c < fin ? 1 : 0; c += s; return { sube: s, parte: false }; });
      //: si `sube` no alcanza para llegar a `cofre`, lo que falta sube en el último toque (y nunca pasa de ahí)
      if (c < fin) S.plan[2].sube += fin - c;
      S.fin = fin;
      return;
    }
    const fin = tRz(r.rareza);
    if (S.base > fin) { S.base = fin; ponerRareza(fin, false); repintar(); }
    S.fin = fin;
    let partes = 0;
    if (S.osc) {
      const n = Number(r.n) || (Array.isArray(r.premios) ? r.premios.length : 1) || 1;
      partes = Math.max(0, Math.min(3, Math.round(Math.log2(n))));
    }
    S.finN = Math.pow(2, partes);
    S.plan = planear(fin - S.r, partes);
  }
  function pedir(id) {
    try { return Promise.resolve(typeof abrir === 'function' ? abrir(id) : null); } catch (e) { return Promise.reject(e); }
  }

  async function hacerToque() {
    S.grieta = Math.min(4, S.grieta + 1);
    Son.tap(); if (S.v === 'cofre') Son.clank(); else Son.carga();
    const carga = V().cargar();
    if (!S.res) {
      const lento = setTimeout(() => { if (S.vivo && !S.res) pista('Abriendo…'); }, 350);
      let r = null;
      try { r = (await Promise.all([pedir(S.item.id), carga]))[0]; } catch (e) { r = null; }
      clearTimeout(lento);
      if (!S.vivo) return;
      if (!r || !r.ok) { await carga; mostrarError(); return; }
      S.res = r; abiertos.push(r);
      preparar(r);
    } else await carga;
    if (!S.vivo) return;
    const p = S.plan[S.toque] || { sube: 0, parte: false };
    if (S.v === 'cofre') {
      if (p.sube) { for (let k = 0; k < p.sube; k++) await subirCofre(Math.min(S.fin, S.cofre + 1)); } else { Son.nada(); await V().nada(); }
    } else if (p.sube || p.parte) {
      for (let k = 1; k <= p.sube; k++) await subir(Math.min(S.fin, S.r + 1), k === p.sube);
      if (p.parte) await partir();
    } else { Son.nada(); polvo(); await V().nada(); }
    if (!S.vivo) return;
    S.toque++; pips();
    if (S.toque >= S.maxT || (S.v !== 'cofre' && S.r === MAX && S.n === S.finN)) listo(); else pista('Toca otra vez');
  }
  async function subir(nr, ultimo) {
    Son.sube(nr, ultimo);
    anillo(ultimo ? 1 : 0.55); destello(ultimo ? 0.85 : 0.5);
    ponerRareza(nr, true);
    const R = RZ[nr];
    await V().cambiar(nr, ultimo);
    chispas(ultimo ? 26 : 10, R.prisma ? PRISMA : ['#fff', R.claro, R.c]);
    if (ultimo && nr >= 3) temblor(nr);
    if (ultimo && nr === 4) { Son.fuego(); Son.rugido(); fuego(); await espera(650); }
    if (ultimo && nr === 5) { Son.brillo(); Son.rugido(); prisma(); await espera(800); }
    await espera(ultimo ? 220 : 60);
  }
  async function subirCofre(nc) {
    Son.sube(Math.min(MAX, nc + 1), true);
    anillo(1); destello(0.85);
    ponerCofre(nc, true); subEl.textContent = '¡El cofre subió!';
    const C = CF[nc];
    await V().cambiar(nc, true);
    chispas(26, C.prisma ? PRISMA : ['#fff', C.claro, C.c]); temblor(nc + 1);
    await espera(260); subEl.textContent = 'Cofre';
  }
  async function partir() {
    Son.parte(); destello(0.6); anillo(1.2, RZ[S.r].claro);
    S.n *= 2; subEl.textContent = 'Nido ×' + S.n;
    pintarObjs(true);
    await espera(460);
  }
  function listo() {
    fase('listo'); pips(); pista('Toca para abrir', true);
    escEl.classList.add('dsw-listo'); brasas(S.v === 'cofre' ? S.cofre >= 2 : S.r >= 3);
  }
  //: el texto del tope suave de la semana, si a esta apertura le tocó (lo que pasa de 10.000 va a la mitad)
  function notaTope(r, cosa) {
    const sin = nPts(r.sin_tope), con = nPts(r.puntos);
    if (!r.sin_tope || sin <= con) return '';
    const de = nPts(r.semana && r.semana.de) || TOPE;
    return `Esta semana ya pasaste los ${fmt.format(de)} Puntos: ${cosa} va a la mitad (eran ${fmt.format(sin)}).`;
  }
  async function romper() {
    fase('abriendo'); escEl.classList.remove('dsw-listo'); brasas(false); pista('');
    Son.abrirCarga();
    await V().abrir();
    Son.rompe(); Son.boom(); destello(1, T(520)); temblor(S.v === 'cofre' ? S.cofre + 1 : S.r);
    if (S.v === 'cofre') { await abrirCofre(); return; }
    const r = S.res, rr = S.fin;
    const premios = S.osc && Array.isArray(r.premios) && r.premios.length
      ? r.premios.map((p) => ({ puntos: nPts(p && p.puntos), titulo: p && !p.repe ? p.titulo || '' : '', repe: (p && p.repe) || '', r: rr }))
      : [{ puntos: nPts(r.puntos), titulo: r.titulo || '', r: rr }];
    const total = r.puntos != null ? nPts(r.puntos) : premios.reduce((s, p) => s + p.puntos, 0);
    S.puntos += total; puntosTodos += total;
    const nota = notaTope(r, S.osc ? 'este Nido' : 'este drop');
    if (nota) { premios[premios.length - 1].nota = nota; S.notas.push(nota); }
    S.premios = premios; S.ip = 0;
    await espera(380);
    if (!S.vivo) return;
    verEscena(false);
    await mostrarPremio();
  }

  function fichaDrop(it) {
    const t = tipoDe(it), nido = t === 'nido', min = tRz(Math.max(Number(it.min) || 0, nido ? 1 : 0, t === 'star' ? 2 : 0)), R = RZ[min];
    return `<div class="dsw-cf-ficha${nido ? ' dsw-nido' : ''}" style="--c:${R.prisma ? '#C9B8FF' : t === 'star' ? '#5CC8FF' : R.c}"><span>?</span><small>${nido ? 'Nido' : t === 'star' ? 'Star' : 'Drop'}</small><em>${min ? 'desde ' + R.n : 'al azar'}</em></div>`;
  }
  //: el cofre abierto: los Puntos que trae y los drops de adentro, que se abren después uno detrás del otro
  async function abrirCofre() {
    const r = S.res, pts = nPts(r.puntos);
    // 🏷️ `titulo` y `ya` (17/11/2026, la Caja del Nuevo): un título que trae el cofre, y lo que trajo y ya abriste antes
    S.extra = { cofre: nombreDe(S.cofre), puntos: pts, c: S.cofre, titulo: String(r.titulo || ''), ya: Array.isArray(r.ya) ? r.ya.map(String) : [] };
    S.puntos += pts; puntosTodos += pts;
    const nota = notaTope(r, 'este cofre');
    if (nota) S.notas.push(nota);
    S.fila = (Array.isArray(r.nuevos) ? r.nuevos : []).filter((x) => x && x.id != null);
    await espera(380);
    if (!S.vivo) return;
    verEscena(false);
    fase('premio-anim'); S.saltar = false;
    const ico = $('.dsw-pr-ico'), num = $('.dsw-pr-num'), nom = $('.dsw-pr-nombre');
    premioEl.hidden = false; $('.dsw-pr-cuenta').textContent = ''; $('.dsw-pr-et').textContent = nombreDe(S.cofre);
    $('.dsw-pr-chip').textContent = ''; $('.dsw-pr-tope').textContent = nota; num.textContent = ''; num.classList.remove('dsw-chico');
    ico.classList.remove('dsw-silueta');
    ico.innerHTML = S.fila.length ? `<div class="dsw-cf-fila">${S.fila.map(fichaDrop).join('')}</div>` : '<i class="dsw-pr-rayos"></i>' + svgMoneda(5);
    nom.textContent = !S.fila.length ? '' : S.fila.length === 1 ? 'Adentro: 1 drop' : `Adentro: ${S.fila.length} drops`;
    const fichas = [...ico.querySelectorAll('.dsw-cf-ficha')];
    fichas.forEach((f) => { f.style.opacity = 0; });
    for (const f of fichas) {
      f.style.opacity = '';
      const fin = getComputedStyle(f).transform;
      f.animate([{ transform: 'translateY(60%) scale(.3) rotate(-30deg)', opacity: 0 }, { transform: 'translateY(-8%) scale(1.12)', opacity: 1, offset: 0.65 }, { transform: fin === 'none' ? 'none' : fin }], { duration: T(380), easing: 'cubic-bezier(.2,.9,.3,1.2)' });
      Son.parte(); await espera(S.saltar ? 40 : 180);
    }
    if (pts) { num.classList.add('dsw-chico'); await contar(num, pts); num.textContent += ' Puntos'; Son.ding(Math.min(MAX, S.cofre + 1)); }
    if (!S.vivo) return;
    if (S.extra.titulo) {
      const chip = $('.dsw-pr-chip');
      chip.textContent = 'Título «' + S.extra.titulo + '»'; chip.classList.remove('dsw-prisma'); chip.style.removeProperty('--c');
      chip.animate([{ transform: 'rotate(-4deg) scale(1.8)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: T(300), easing: 'cubic-bezier(.3,1.4,.5,1)' });
      Son.brillo();
    }
    if (S.fila.length) { fase('contenido'); pista(S.fila.length === 1 ? 'Toca para abrir el drop' : 'Toca para abrir los drops', true); }
    else { S.premios = []; S.ip = 0; fase('premio'); pista('Toca para seguir', true); }
  }
  async function contar(el, n) {
    const dur = T(450 + Math.min(1000, n / 10)), ini = performance.now(); let ult = 0;
    await new Promise((res) => {
      const f = (t) => {
        if (!S.vivo) { res(); return; }
        const p = S.saltar ? 1 : Math.min(1, (t - ini) / dur), v = Math.round((1 - Math.pow(1 - p, 3)) * n);
        el.textContent = '+' + fmt.format(v);
        if (t - ult > 55 && p < 1) { Son.tic(p); ult = t; }
        if (p < 1) requestAnimationFrame(f); else res();
      };
      requestAnimationFrame(f);
    });
  }
  async function mostrarPremio() {
    fase('premio-anim'); S.saltar = false;
    const p = S.premios[S.ip], R = RZ[p.r], ico = $('.dsw-pr-ico'), num = $('.dsw-pr-num'), nom = $('.dsw-pr-nombre'), chip = $('.dsw-pr-chip');
    premioEl.hidden = false;
    $('.dsw-pr-cuenta').textContent = S.premios.length > 1 ? `${S.ip + 1} de ${S.premios.length}` : '';
    $('.dsw-pr-tope').textContent = '';
    chip.textContent = R.n; chip.classList.toggle('dsw-prisma', !!R.prisma); chip.style.setProperty('--c', R.c);
    num.textContent = ''; num.classList.remove('dsw-chico'); nom.textContent = ''; pista('');
    const rel0 = () => rel(ico.getBoundingClientRect());
    if (p.titulo) {
      $('.dsw-pr-et').textContent = 'Título exclusivo';
      ico.innerHTML = '<i class="dsw-pr-rayos"></i>' + cintaHTML(p.titulo, R);
      ico.classList.add('dsw-silueta'); nom.textContent = '¿Qué será?';
      ico.animate([{ transform: 'scale(.3) rotate(-20deg)', opacity: 0 }, { transform: 'scale(1.08) rotate(3deg)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: T(420), easing: 'cubic-bezier(.2,.9,.3,1.2)' });
      Son.suspenso();
      await espera(S.saltar ? 120 : 780);
      if (!S.vivo) return;
      destello(0.9); Son.fanfarria(Math.min(MAX, p.r + 1)); Son.brillo();
      ico.classList.remove('dsw-silueta'); ico.insertAdjacentHTML('beforeend', '<span class="dsw-sello">¡Nuevo!</span>');
      ico.querySelector('.dsw-sello').animate([{ transform: 'rotate(10deg) scale(2.6)', opacity: 0 }, { transform: 'rotate(10deg) scale(1)', opacity: 1 }], { duration: T(260), easing: 'cubic-bezier(.3,1.4,.5,1)' });
      ico.animate([{ transform: 'scale(1.25)' }, { transform: 'none' }], { duration: T(360), easing: 'cubic-bezier(.2,.9,.3,1.3)' });
      chispas(30, R.prisma ? PRISMA : ['#fff', R.claro, R.c], [rel0()]);
      nom.textContent = 'Se pone en tu perfil';
      if (p.puntos) { await espera(320); num.classList.add('dsw-chico'); await contar(num, p.puntos); num.textContent += ' Puntos'; Son.ding(p.r); }
    } else {
      $('.dsw-pr-et').textContent = 'Puntos de Tienda';
      if (p.repe) nom.textContent = `Ya tienes «${p.repe}»: va en Puntos`;
      ico.classList.remove('dsw-silueta');
      ico.innerHTML = '<i class="dsw-pr-rayos"></i>' + svgMoneda(p.r <= 1 ? 1 : p.r <= 3 ? 3 : 5);
      ico.animate([{ transform: 'translateY(-60%) scale(.6)', opacity: 0 }, { transform: 'translateY(4%) scale(1.06,.94)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: T(420), easing: 'cubic-bezier(.3,.1,.3,1)' });
      Son.tap();
      await espera(220);
      await contar(num, p.puntos);
      Son.fanfarria(p.r);
      const c = rel0(); c.w *= 0.8; chispas(18, ['#FFF3B8', '#F5C542', '#fff'], [c]);
    }
    if (!S.vivo) return;
    if (p.nota) $('.dsw-pr-tope').textContent = p.nota;
    fase('premio'); pista('Toca para seguir', true);
  }
  async function siguiente() {
    if (S.ip < S.premios.length - 1) { S.ip++; await mostrarPremio(); return; }
    S.acum.push(...S.premios); S.premios = [];
    if (S.fila.length) { premioEl.hidden = true; await empezar(S.fila.shift(), true); return; }
    await resumen();
  }
  async function resumen() {
    fase('resumen-anim'); pista(''); brasas(false); pips();
    premioEl.hidden = true; rsEl.hidden = false; verEscena(false);
    const items = [];
    if (S.extra && S.extra.titulo) items.push({ txt: `Título «${S.extra.titulo}»`, R: { c: CF[S.extra.c].c, n: 'Se pone en tu perfil' } });
    S.acum.forEach((p) => { if (p.titulo) items.push({ txt: `Título «${p.titulo}»`, p, R: RZ[p.r] }); });
    ((S.extra && S.extra.ya) || []).forEach((t) => items.push({ txt: t, R: { c: '#5CC8FF', n: 'Ya los abriste' } }));
    const mejor = S.acum.reduce((m, p) => Math.max(m, p.r), 0);
    const de = S.acum.filter((p) => p.puntos).length + (S.extra && S.extra.puntos ? 1 : 0);
    // 🏷️ un cofre con su propio nombre (la Caja del Nuevo) lo lleva también acá: decía «Baúl de los objetos» (17/11/2026)
    const Rp = S.acum.length ? RZ[mejor] : S.extra ? Object.assign({}, CF[S.extra.c], { n: S.extra.cofre || CF[S.extra.c].n }) : RZ[0];
    if (S.puntos || !items.length) items.push({ txt: `+${fmt.format(S.puntos)} Puntos`, puntos: S.puntos, R: Rp, de });
    rsEl.dataset.puntos = String(S.puntos);
    $('.dsw-rs-t').textContent = S.extra ? 'Te llevaste · ' + S.extra.cofre : 'Te llevaste';
    $('.dsw-rs-nota').textContent = S.notas.length ? `Parte fue a la mitad: esta semana ya pasaste los ${fmt.format(nPts(abiertos.length && abiertos[abiertos.length - 1].semana && abiertos[abiertos.length - 1].semana.de) || TOPE)} Puntos.` : '';
    const listaEl = $('.dsw-rs-lista');
    listaEl.classList.toggle('dsw-muchos', items.length > 4);
    listaEl.innerHTML = items.map((it) => `<li class="dsw-rs-i" style="--c:${it.R.prisma ? '#C9B8FF' : it.R.c}"><span class="dsw-ic">${it.puntos != null ? svgMoneda(1) : ICO_TITULO(it.R)}</span><span><b>${esc(it.txt)}</b><small>${it.de > 1 ? `de ${it.de} premios` : esc(it.R.n)}</small></span></li>`).join('');
    const quedan = lista.length - ic;
    const bot = $('.dsw-rs-bot');
    bot.innerHTML = (quedan > 0 ? `<button type="button" class="dsw-b dsw-b-blanco dsw-otro">Abrir otro (${quedan})</button>` : '')
      + `<button type="button" class="dsw-b ${quedan > 0 ? 'dsw-b-negro' : 'dsw-b-blanco'} dsw-listo-b">Listo</button>`;
    bot.style.visibility = 'hidden';
    const otro = bot.querySelector('.dsw-otro');
    if (otro) otro.addEventListener('click', () => { if (S.fase !== 'fin' || recien()) return; Son.init(); siguienteDeCola(true); });
    bot.querySelector('.dsw-listo-b').addEventListener('click', () => { if (!recien()) cerrar(); });
    rsEl.scrollTop = 0;
    const lis = [...listaEl.children];
    for (let i = 0; i < lis.length; i++) {
      lis[i].animate([{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.1)', opacity: 1, offset: 0.6 }, { transform: 'none', opacity: 1 }], { duration: T(300), easing: 'cubic-bezier(.2,.9,.3,1.2)', fill: 'backwards' });
      Son.tic(i / Math.max(1, lis.length)); await espera(lis.length > 6 ? 70 : 120);
      if (!S.vivo) return;
    }
    //: los Puntos suman contando y llueven monedas (la maqueta los mandaba volando a una billetera que acá no hay)
    const ultimo = lis[lis.length - 1];
    if (S.puntos && ultimo) {
      const b = ultimo.querySelector('b');
      Son.monedas();
      const c = rel(ultimo.querySelector('.dsw-ic').getBoundingClientRect());
      lluviaMonedas(18, [c]); chispas(14, ['#FFF3B8', '#F5C542', '#fff'], [c]);
      await contar(b, S.puntos);
      b.textContent += ' Puntos';
    }
    if (!S.vivo) return;
    bot.style.visibility = ''; fase('fin'); S.botonesEn = performance.now();
    try { bot.querySelector('button').focus({ preventScroll: true }); } catch (e) { /* sigue */ }
  }
  //: quien viene tocando rápido no tiene que caer en un botón que acaba de aparecer debajo del dedo
  const recien = () => performance.now() - (S.botonesEn || 0) < 450;
  function mostrarError() {
    fase('error'); brasas(false); escEl.classList.remove('dsw-listo'); pista(''); S.toque = S.maxT; pips();
    premioEl.hidden = true; rsEl.hidden = true; verEscena(false);
    $('.dsw-err-tx').textContent = S.extra
      ?'Se cortó la conexión. Los drops que faltan siguen en tu lista: prueba de nuevo en un momento.'
      : 'Se cortó la conexión o algo falló. Tu drop sigue en tu lista: prueba de nuevo en un momento.';
    errEl.hidden = false; S.botonesEn = performance.now();
    try { $('.dsw-err-ok').focus({ preventScroll: true }); } catch (e) { /* sigue */ }
  }

  /* ------------------------------------------------ los toques */
  async function tocar() {
    if (!S.vivo) return;
    Son.init();
    if (S.fase === 'premio-anim') { S.saltar = true; return; }
    if (S.ocupado) { if (S.fase === 'toques') S.cola = true; return; }
    S.ocupado = true; dlg.dataset.ocupado = '1';
    try {
      let otra = true;
      while (otra && S.vivo) {
        S.cola = false;
        if (S.fase === 'toques') await hacerToque();
        else if (S.fase === 'listo') await romper();
        else if (S.fase === 'premio') await siguiente();
        else if (S.fase === 'contenido') { premioEl.hidden = true; await empezar(S.fila.shift(), true); }
        otra = S.cola && S.fase === 'toques';
      }
    } catch (e) {
      if (S.vivo) mostrarError();
    } finally { S.ocupado = false; delete dlg.dataset.ocupado; }
  }
  let porPuntero = false;
  toqueEl.addEventListener('pointerdown', (e) => { if (e.button > 0) return; porPuntero = true; tocar(); });
  toqueEl.addEventListener('click', () => { if (porPuntero) { porPuntero = false; return; } tocar(); });
  $('.dsw-err-ok').addEventListener('click', () => { if (!recien()) cerrar(); });
  $('.dsw-x').addEventListener('click', () => cerrar());
  function pintarMudo() {
    const m = Son.mudo();
    mudoEl.innerHTML = m ? ICO_MUDO : ICO_SON;
    mudoEl.setAttribute('aria-pressed', String(m));
    mudoEl.setAttribute('aria-label', m ? 'Activar el sonido' : 'Silenciar');
    mudoEl.title = m ? 'Activar el sonido' : 'Silenciar';
  }
  mudoEl.addEventListener('click', () => { Son.ponerMudo(!Son.mudo()); pintarMudo(); });
  pintarMudo();
  dlg.addEventListener('keydown', (e) => { if (!e.ctrlKey && !e.metaKey && !e.altKey) dlg.classList.add('dsw-teclado'); }, true);
  dlg.addEventListener('pointerdown', () => dlg.classList.remove('dsw-teclado'), true);

  /* ------------------------------------------------ abrir y cerrar */
  const alMedir = () => { if (!S.vivo) return; fxTam(); medirTitulo(); medidas(); };
  W.addEventListener('resize', alMedir);
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); cerrar(); });
  dlg.addEventListener('close', () => cerrar());
  function cerrar() {
    if (!S.vivo) return;
    S.vivo = false;
    brasas(false);
    intervalos.forEach((iv) => clearInterval(iv)); intervalos.clear();
    fx.ps = [];
    W.removeEventListener('resize', alMedir);
    try { if (dlg.open) dlg.close(); } catch (e) { /* sigue */ }
    dlg.remove();
    if (typeof alCerrar === 'function') { try { alCerrar({ abiertos: abiertos.slice(), puntos: puntosTodos }); } catch (e) { /* sigue */ } }
  }

  try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); dlg.classList.add('dsw-sin-modal'); }
  fxTam(); medirTitulo();
  //: con la fuente de respaldo el título mide otra cosa: se vuelve a medir cuando llega Archivo
  try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(alMedir); } catch (e) { /* sigue */ }
  Son.init();
  if (!lista.length) { mostrarError(); return { cerrar }; }
  siguienteDeCola(true);
  return { cerrar };
}

/**
 * 🐣 EL MOMENTO DE UN DÍA COMPLETO (17/11/2026, Dlx a la maqueta, «Tus elecciones»: al completar un día de las misiones
 * para nuevos, «Día N de 7 · completo», lo que ganaste y lo que abre mañana). El mismo escenario que los drops —fondo,
 * escamas, rayos y el «Te llevaste»— pero sin toques: se ve, se va solo a los `dur` ms (salvo que lo toques o lo mires
 * con el teclado; con `dur: 0`, nunca) y se cierra con cualquier toque, la ✕ o Escape. Sin sonido: llega sin que lo pidas.
 *
 *   mostrarMomento(host, { sub, titulo, lista, nota, botones, pal, dur })
 *     lista    [{txt, small, tipo}] — `tipo`: pdt · titulo · drop · star · cofre (con `t`) · caja
 *     botones  [{txt, fn, blanco}] — cada uno cierra el momento y después llama a `fn`
 *     pal      {c, c1, c2} los colores del fondo (los de un cofre)
 *   devuelve una Promise que se cumple al cerrarse
 */
export function mostrarMomento(host, { sub = '', titulo = '', lista = [], nota = '', botones = [], pal = null, dur = 6500 } = {}) {
  const casa = host || document.body;
  const raiz = casa.getRootNode ? casa.getRootNode() : document;
  ponerCss(raiz);
  const calma = (() => { try { return quieto() || !!(raiz.querySelector && raiz.querySelector('.app.calma')); } catch (e) { return false; } })();
  const P = pal || CF[3];
  const ico = (x) => (x.tipo === 'pdt' ? svgMoneda(1) : x.tipo === 'drop' ? svgCasete(1, 'MIXTAPE', false) : x.tipo === 'star' ? svgEscama(2, false, true)
    : x.tipo === 'cofre' || x.tipo === 'caja' ? svgCofreRap(tCofre(x.t != null ? x.t : 2), 0, x.tipo === 'caja' ? 'NUEVO' : '') : ICO_TITULO({ c: P.c }));
  const dlg = document.createElement('dialog');
  dlg.className = 'dsw dsw-momento' + (calma ? ' dsw-calma' : '');
  dlg.setAttribute('aria-label', titulo ? sub + ': ' + titulo : sub);
  dlg.innerHTML = `
    <div class="dsw-esc" style="--c:${P.c};--c1:${P.b1 || P.c};--c2:${P.b2 || '#0B0B0E'};--rayos:.32">
      <div class="dsw-fondo"></div><div class="dsw-escamas"></div><div class="dsw-rayos"></div><div class="dsw-velo"></div>
      <section class="dsw-capa dsw-rs" aria-live="polite">
        ${sub ? `<p class="dsw-pr-cuenta">${esc(sub)}</p>` : ''}
        <h2 class="dsw-rs-t">${esc(titulo)}</h2>
        ${lista.length ? `<ul class="dsw-rs-lista">${lista.map((x) => `<li class="dsw-rs-i" style="--c:${P.c}"><span class="dsw-ic">${ico(x)}</span><span><b>${esc(x.txt)}</b>${x.small ? `<small>${esc(x.small)}</small>` : ''}</span></li>`).join('')}</ul>` : ''}
        ${nota ? `<p class="dsw-rs-nota">${esc(nota)}</p>` : ''}
        <div class="dsw-rs-bot">${(botones.length ? botones : [{ txt: 'Seguir', blanco: true }]).map((b, i) => `<button type="button" class="dsw-b ${b.blanco || i === 0 ? 'dsw-b-blanco' : 'dsw-b-negro'}" data-i="${i}">${esc(b.txt)}</button>`).join('')}</div>
      </section>
      <div class="dsw-flash"></div>
    </div>
    <div class="dsw-ctl"><button type="button" class="dsw-ctl-b dsw-x" aria-label="Cerrar">${ICO_X}</button></div>`;
  casa.appendChild(dlg);
  const $ = (s) => dlg.querySelector(s);
  let vivo = true, quieta = false, reloj = null, fin = null;
  const listo = new Promise((r) => { fin = r; });
  const cerrar = (luego) => {
    if (!vivo) return;
    vivo = false;
    clearTimeout(reloj);
    try { if (dlg.open) dlg.close(); } catch (e) { /* sigue */ }
    dlg.remove();
    fin();
    if (typeof luego === 'function') { try { luego(); } catch (e) { /* sigue */ } }
  };
  //: tocarlo o llegar con el teclado lo deja quieto: quien lo está leyendo no lo pierde a la mitad
  const quedarse = () => { if (!quieta) { quieta = true; clearTimeout(reloj); } };
  dlg.querySelectorAll('.dsw-rs-bot button').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const B = (botones.length ? botones : [{}])[Number(b.dataset.i) || 0] || {};
    cerrar(B.fn);
  }));
  $('.dsw-x').addEventListener('click', () => cerrar());
  $('.dsw-rs').addEventListener('click', (e) => { if (e.target === e.currentTarget) cerrar(); });
  dlg.addEventListener('keydown', quedarse, true);
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); cerrar(); });
  dlg.addEventListener('close', () => cerrar());
  try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); dlg.classList.add('dsw-sin-modal'); }
  //: `dur: 0`, no se va solo (la Caja: hay algo que elegir)
  if (dur > 0) reloj = setTimeout(() => { if (!quieta) cerrar(); }, dur);
  // la entrada: el destello, el título que salta y los premios uno detrás del otro (como el «Te llevaste»)
  if (!calma) {
    try {
      $('.dsw-flash').animate([{ opacity: 0.85 }, { opacity: 0 }], { duration: 420, easing: 'ease-out' });
      $('.dsw-rs-t').animate([{ transform: 'scale(1.5) rotate(-4deg)', opacity: 0.2 }, { transform: 'scale(.94) rotate(1deg)', opacity: 1, offset: 0.6 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.2,.9,.3,1.3)' });
      dlg.querySelectorAll('.dsw-rs-i').forEach((li, i) => li.animate([{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.1)', opacity: 1, offset: 0.6 }, { transform: 'none', opacity: 1 }],
        { duration: 300, delay: 260 + i * 120, easing: 'cubic-bezier(.2,.9,.3,1.2)', fill: 'backwards' }));
    } catch (e) { /* sin animaciones, igual se ve */ }
  }
  try { $('.dsw-rs-bot button').focus({ preventScroll: true }); } catch (e) { /* sigue */ }
  return listo;
}
