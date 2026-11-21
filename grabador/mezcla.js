// 🎚️ JUNTAR LAS VOCES EN UN SOLO AUDIO, Y PARTIRLO SI NO ENTRA EN DISCORD. Lo hace ffmpeg.
//
// Las pistas de `PistaOpus` arrancan todas en el segundo 0 de la grabación, así que mezclar es sumarlas: `amix` sin
// normalizar (con `normalize` cada voz bajaría a 1/N y con 31 personas en la llamada no se oiría a nadie) y un
// limitador al final para que dos gritando juntos no saturen.
//
// 🎛️ CADA VOZ AL MISMO VOLUMEN ANTES DE SUMAR (21/11/2026; Dlx: «¿hay algo que se pueda hacer para personas que se
// escuchan mal?»). `sonoridad()` mide cada pista en LUFS —con compuerta, así el silencio rellenado no cuenta— y
// `mezclar()` le aplica la ganancia que la lleva a `VOZ_LUFS` (la música de los bots, a `MUSICA_LUFS`: queda debajo de
// las voces), con un tope de ±`GANANCIA_MAX`: una voz casi muda subida 30 dB sería sólo ruido. Antes, un pasa-altos
// a 80 Hz saca el retumbe (golpes al micrófono, ventiladores) que no es voz. Y al final un limitador a −1 dB: la
// prueba del 21/11 tenía el pico en +0,2 dB.
//
// ⚠️ NO HAY REDUCCIÓN DE RUIDO A PROPÓSITO: Discord ya la hace (Krisp) antes de mandar, y la medición de la prueba dio
// −91 dB entre frase y frase. Sumar otra encima suele dejar la voz «con agua».

import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';

//: la calidad de la mezcla: Opus estéreo a 64 kbps ≈ 29 MB por hora
export const KBPS = 64;

function ffmpeg(args) {
  return new Promise((ok, mal) => {
    const p = spawn('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', mal);
    p.on('close', (c) => (c === 0 ? ok() : mal(new Error('ffmpeg ' + c + ': ' + err.slice(-400)))));
  });
}

/** ⚔️ Un pedazo de un audio, de `desde` a `hasta` segundos, sin volver a codificar (`batallas.js`). */
export async function cortar(ruta, desde, hasta, salida) {
  await ffmpeg(['-ss', String(Math.max(0, desde)), '-i', ruta, '-t', String(Math.max(1, hasta - desde)), '-c', 'copy', salida]);
  return salida;
}

/** Lo que dura un audio, en segundos. */
export function duracion(ruta) {
  return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', ruta])
    .toString().trim()) || 0;
}

export const VOZ_LUFS = -19;
export const MUSICA_LUFS = -27;
export const GANANCIA_MAX = 15;

/** La sonoridad integrada de un audio (LUFS), o null si no tiene nada que medir. */
export function sonoridad(ruta) {
  return new Promise((ok) => {
    const p = spawn('ffmpeg', ['-nostats', '-i', ruta, '-af', 'ebur128', '-f', 'null', '-'], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; if (err.length > 2e6) err = err.slice(-1e5); });
    p.on('error', () => ok(null));
    p.on('close', () => {
      const m = err.slice(err.lastIndexOf('Summary:')).match(/I:\s*(-?[0-9.]+) LUFS/);
      const v = m ? Number(m[1]) : null;
      ok(v == null || v <= -69 ? null : v);
    });
  });
}

/** La ganancia (dB) que lleva una pista de `lufs` al objetivo, con su tope. */
export function ganancia(lufs, musica = false) {
  if (lufs == null) return 0;
  const g = (musica ? MUSICA_LUFS : VOZ_LUFS) - lufs;
  return Math.max(-GANANCIA_MAX, Math.min(GANANCIA_MAX, Math.round(g * 10) / 10));
}

/**
 * Mezcla las pistas en `salida` (.ogg Opus). `cada` (opcional, en el mismo orden): `{ db, musica }` — la ganancia de
 * esa pista y si es la música de un bot (a ésa no se le corta el grave).
 */
export async function mezclar(rutas, salida, cada = []) {
  if (!rutas.length) throw new Error('no hay pistas');
  const ins = rutas.flatMap((r) => ['-i', r]);
  const prep = rutas.map((_, i) => {
    const c = cada[i] || {};
    return `[${i}:a]${c.musica ? '' : 'highpass=f=80,'}volume=${(c.db || 0).toFixed(1)}dB[v${i}]`;
  });
  const todas = rutas.map((_, i) => `[v${i}]`).join('');
  const filtro = prep.join(';') + ';' + todas
    + (rutas.length > 1 ? `amix=inputs=${rutas.length}:duration=longest:normalize=0,` : 'anull,')
    // 🔊 −2 dBFS (21/11/2026): con 0,89 (−1 dB) la grabación de DESGRACIAS EN TOKYO VOL 32 dio +0,3 dBFS de pico verdadero
    // y 4 muestras al tope en 2 horas: Opus pasa un poco el límite que le llega. Inaudible, pero el margen va antes del códec
    + 'alimiter=limit=0.79:level=false';
  await ffmpeg([...ins, '-filter_complex', filtro, '-ac', '2', '-c:a', 'libopus', '-b:a', KBPS + 'k', salida]);
  return salida;
}

/**
 * Parte un audio en pedazos de menos de `tope` bytes, cortando por tiempo (sin volver a codificar). Devuelve las rutas.
 * Si ya entra, devuelve `[ruta]`.
 */
export async function partir(ruta, tope) {
  const peso = fs.statSync(ruta).size;
  if (peso <= tope) return [ruta];
  const seg = Math.max(1, Math.floor(duracion(ruta) * (tope * 0.9) / peso));
  const base = ruta.replace(/\.ogg$/, '');
  await ffmpeg(['-i', ruta, '-f', 'segment', '-segment_time', String(seg), '-reset_timestamps', '1', '-c', 'copy',
    base + '_parte%02d.ogg']);
  const dir = path.dirname(ruta), pre = path.basename(base) + '_parte';
  return fs.readdirSync(dir).filter((f) => f.startsWith(pre)).sort().map((f) => path.join(dir, f));
}
