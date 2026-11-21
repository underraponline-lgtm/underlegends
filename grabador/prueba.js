// 🧪 EL SELF-CHECK DEL GRABADOR, SIN RED Y SIN DISCORD (necesita ffmpeg).
//
//     node prueba.js
//
// Arma con ffmpeg dos tonos de verdad en Opus (como los manda Discord: 48 kHz, estéreo, 20 ms), los pasa por
// `PistaOpus` como si fueran dos personas que hablan en momentos distintos —con un corte de red en el medio— y después
// le pregunta a ffmpeg dónde suena cada uno. Pasa si:
//   · las dos pistas duran lo mismo que la grabación (el silencio se rellenó)
//   · cada voz suena en su segundo y calla donde calla (lo que dice `suena()`, lejos de los bordes)
//   · el corte de red no corre la pista: los paquetes atrasados se escriben seguidos
//   · la mezcla de las dos (lo que hace `mezclar()` de index.js) se decodifica entera
// Si falta ffmpeg, lo dice y sale con 1: sin él no hay mezcla, así que en Railway tiene que estar (ver el Dockerfile).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { PistaOpus, muestrasDe, crcOgg, SILENCIO } from './ogg.js';
import { mezclar, partir } from './mezcla.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grabador-prueba-'));
let mal = 0;
const ok = (cond, que) => { console.log((cond ? '  ✅ ' : '  ❌ ') + que); if (!cond) mal++; };

try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); } catch (e) {
  console.log('❌ falta ffmpeg: sin él no hay mezcla');
  process.exit(1);
}

/** Los paquetes Opus de un .ogg (lector mínimo: junta los segmentos de cada página). */
function paquetesDe(ruta) {
  const b = fs.readFileSync(ruta);
  const out = [];
  let i = 0, partido = [];
  while (i < b.length) {
    if (b.toString('latin1', i, i + 4) !== 'OggS') throw new Error('no es Ogg en ' + i);
    const n = b[i + 26];
    const lazos = b.subarray(i + 27, i + 27 + n);
    let p = i + 27 + n;
    for (const l of lazos) {
      partido.push(b.subarray(p, p + l));
      p += l;
      if (l < 255) { out.push(Buffer.concat(partido)); partido = []; }
    }
    i = p;
  }
  return out.slice(2);       // sin OpusHead ni OpusTags
}

/** Un tono de `seg` segundos en paquetes Opus como los de Discord. */
function tono(hz, seg) {
  const f = path.join(dir, 'tono' + hz + '.ogg');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `sine=frequency=${hz}:duration=${seg}:sample_rate=48000`,
    '-ac', '2', '-c:a', 'libopus', '-b:a', '64k', '-frame_duration', '20', f]);
  return paquetesDe(f);
}

/** ¿Suena algo alrededor de cada instante de `ts` (±50 ms, RMS por encima de -40 dB)? Lejos de los bordes a
 * propósito: el codificador de prueba agrega su propio arranque y medir justo en el borde mide eso, no al grabador. */
function suena(ruta, ts) {
  const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', ruta, '-ac', '1', '-ar', '8000', '-f', 's16le', '-'],
    { maxBuffer: 1 << 28 });
  return ts.map((t) => {
    const i0 = Math.round((t - 0.05) * 8000), n = 800;
    let s = 0;
    for (let j = 0; j < n; j++) { const k = (i0 + j) * 2; const x = k + 1 < pcm.length ? pcm.readInt16LE(k) : 0; s += x * x; }
    return 20 * Math.log10(Math.sqrt(s / n) / 32768 + 1e-9) > -40 ? 1 : 0;
  }).join('');
}
const dura = (ruta) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', ruta]).toString().trim());

console.log('🎙️ el grabador, sin red');

// ── lo de base ──
ok(crcOgg(Buffer.from('OggS')) === 0x5fb0a94f, 'el CRC de Ogg es el del estándar');
ok(muestrasDe(SILENCIO) === 960, 'el paquete de silencio dura 20 ms');
// ffmpeg da 51: el primero es el arranque del codificador. Se usan 50, un segundo justo
const a = tono(440, 1).slice(0, 50), b = tono(880, 1).slice(0, 50);
ok(a.length === 50 && a.every((p) => muestrasDe(p) === 960), 'los paquetes de prueba son de 20 ms, como los de Discord');

// ── dos personas: A habla en el segundo 0,5 y en el 3; B en el 2 con un corte de red de 200 ms en el medio ──
const pa = new PistaOpus(path.join(dir, 'a.ogg'), 1);
const pb = new PistaOpus(path.join(dir, 'b.ogg'), 2);
a.forEach((p, i) => pa.agregar(p, 500 + i * 20));
a.forEach((p, i) => pa.agregar(p, 3000 + i * 20));
b.forEach((p, i) => {
  // del paquete 20 al 29 la red se trabó: llegan los diez juntos, 200 ms tarde
  const t = 2000 + i * 20;
  pb.agregar(p, i >= 20 && i < 30 ? 2000 + 30 * 20 : t);
});
pb.silencioHasta(4000);      // la grabación terminó en el segundo 4: la pista de B se rellena hasta ahí
pa.cerrar(); pb.cerrar();
ok(Math.abs(dura(pa.ruta) - 4.0) < 0.06, 'la pista de A dura lo que la grabación (' + dura(pa.ruta).toFixed(2) + ' s)');
ok(Math.abs(dura(pb.ruta) - 4.0) < 0.06, 'la de B también, con el corte de red adentro (' + dura(pb.ruta).toFixed(2) + ' s)');

//: los instantes que se miran, y qué tiene que sonar en cada uno
const T = [0.2, 1.0, 1.8, 2.1, 2.5, 2.9, 3.1, 3.5];
const esperoA = '01000011', esperoB = '00011100';
ok(suena(pa.ruta, T) === esperoA, 'A suena de 0,5 a 1,5 y de 3 a 4 (' + suena(pa.ruta, T) + ')');
ok(suena(pb.ruta, T) === esperoB, 'B suena de 2 a 3, sin correrse por el corte de red (' + suena(pb.ruta, T) + ')');

// ── la mezcla ──
const sale = path.join(dir, 'mezcla.ogg');
await mezclar([pa.ruta, pb.ruta], sale);
ok(Math.abs(dura(sale) - 4.0) < 0.1, 'la mezcla dura 4 s (' + dura(sale).toFixed(2) + ')');
const esperoM = [...esperoA].map((x, i) => String(Number(x) | Number(esperoB[i]))).join('');
ok(suena(sale, T) === esperoM, 'en la mezcla suenan las dos, cada una en su lugar (' + suena(sale, T) + ')');

// ── partirla para Discord: tres partes de ~1,4 s, que juntas dan lo mismo ──
const partes = await partir(sale, Math.ceil(fs.statSync(sale).size / 2.5));
ok(partes.length >= 2, 'una mezcla más grande que el tope sale en partes (' + partes.length + ')');
ok(Math.abs(partes.reduce((s, p) => s + dura(p), 0) - dura(sale)) < 0.15, 'las partes suman lo que la mezcla');

fs.rmSync(dir, { recursive: true, force: true });
console.log(mal ? `\n❌ ${mal} mal` : '\n✅ todo bien');
process.exit(mal ? 1 : 0);
