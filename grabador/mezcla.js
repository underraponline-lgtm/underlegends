// 🎚️ JUNTAR LAS VOCES EN UN SOLO AUDIO, Y PARTIRLO SI NO ENTRA EN DISCORD. Lo hace ffmpeg.
//
// Las pistas de `PistaOpus` arrancan todas en el segundo 0 de la grabación, así que mezclar es sumarlas: `amix` sin
// normalizar (con `normalize` cada voz bajaría a 1/N y con 31 personas en la llamada no se oiría a nadie) y un
// limitador al final para que dos gritando juntos no saturen.
//
// ⚠️ La mejora del audio (ruido, volumen parejo entre voces) es para la tanda que sigue: primero se mide cómo suena
// una grabación de verdad.

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

/** Lo que dura un audio, en segundos. */
export function duracion(ruta) {
  return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', ruta])
    .toString().trim()) || 0;
}

/** Mezcla las pistas en `salida` (.ogg Opus). */
export async function mezclar(rutas, salida) {
  if (!rutas.length) throw new Error('no hay pistas');
  const ins = rutas.flatMap((r) => ['-i', r]);
  const filtro = rutas.length > 1
    ? `amix=inputs=${rutas.length}:duration=longest:normalize=0,alimiter=limit=0.95`
    : 'alimiter=limit=0.95';
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
