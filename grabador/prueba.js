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
import { execFileSync, spawnSync } from 'node:child_process';
import { PistaOpus, muestrasDe, crcOgg, SILENCIO } from './ogg.js';
import { mezclar, partir, sonoridad, ganancia, VOZ_LUFS } from './mezcla.js';
import { MedidorVoz, bandaDe } from './calidad.js';

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

/** Seis segundos de «voz» de prueba con un filtro y unos ajustes del codificador: los casos de calidad.js. */
function voz(nombre, filtro = 'anull', cod = ['-b:a', '64k']) {
  const f = path.join(dir, nombre + '.ogg');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=300:duration=6:sample_rate=48000',
    '-af', filtro, '-ac', '2', '-c:a', 'libopus', ...cod, '-frame_duration', '20', f]);
  return paquetesDe(f).slice(1);
}

/** Lo que mide calidad.js de una ventana con esos paquetes; `cae(i)` simula los que la red perdió. */
async function medir(paquetes, cae = () => false, m = new MedidorVoz('x')) {
  paquetes.forEach((p, i) => { if (!cae(i)) m.agregar(p, i * 20); });
  return m.ventana(dir);
}

/** LUFS de un tramo de un audio. */
function lufsEntre(ruta, a, b) {
  const t = path.join(dir, `tramo-${a}.ogg`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(a), '-to', String(b), '-i', ruta, '-c', 'copy', t]);
  return sonoridad(t);
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

// ── 🩺 cómo se escucha cada voz (calidad.js) ──
console.log('🩺 cómo se escucha cada voz');
ok(bandaDe(Buffer.from([0x00])) === 'NB' && bandaDe(Buffer.from([0x40])) === 'WB' && bandaDe(Buffer.from([0xe0])) === 'FB'
  && bandaDe(SILENCIO) === 'FB', 'la banda sale del primer byte del paquete');
const normal = voz('normal');
const rN = await medir(normal);
ok(rN.problema === null, `una voz normal no tiene problema (${rN.medida.db.toFixed(1)} dB, ${(rN.medida.perdida * 100).toFixed(1)} % perdido)`);
const rB = await medir(voz('bajo', 'volume=-18dB'));
ok(rB.problema === 'bajo', `una voz 18 dB más baja es «bajito» (${rB.medida.db?.toFixed(1)} dB)`);
const rS = await medir(voz('satura', 'volume=24dB,aformat=sample_fmts=s16'));
ok(rS.problema === 'satura', `una voz que pega en el tope «satura» (${rS.medida.db?.toFixed(1)} dB)`);
const rT = await medir(voz('telefono', 'anull', ['-b:a', '12k', '-cutoff', '4000']));
ok(rT.problema === 'telefono', `una voz en banda angosta es «calidad de teléfono» (${(rT.medida.angosta * 100).toFixed(0)} % angosta)`);
const rC = await medir(normal, (i) => i % 8 === 3);
ok(rC.problema === 'corta' && Math.abs(rC.medida.perdida - 0.125) < 0.02,
  `perder 1 de cada 8 paquetes «se corta» (${(rC.medida.perdida * 100).toFixed(1)} %)`);
// el corte de red de la prueba de arriba: diez paquetes atrasados que llegan juntos NO son pérdida
const mE = new MedidorVoz('e');
normal.forEach((p, i) => mE.agregar(p, i >= 100 && i < 110 ? 2200 : i * 20));
const rE = await mE.ventana(dir);
ok(rE.medida.perdida < 0.01, `un corte de red que después entrega todo no cuenta como pérdida (${(rE.medida.perdida * 100).toFixed(1)} %)`);
// el aviso: recién a la segunda ventana seguida, y una sola vez
const mA = new MedidorVoz('a');
const bajo = voz('bajo2', 'volume=-18dB');
const avisos = [];
for (let k = 0; k < 3; k++) avisos.push((await medir(bajo, () => false, mA)).avisar);
ok(avisos.join() === 'false,true,false', 'avisa a los 20 s del mismo problema, y una sola vez (' + avisos.join() + ')');
ok(mA.resumen().color === '🟡' && mA.resumen().peor === 'bajo', 'el informe lo da 🟡 bajito');

// ── 🎛️ cada voz al mismo volumen ──
console.log('🎛️ cada voz al mismo volumen');
const pf = new PistaOpus(path.join(dir, 'fuerte.ogg'), 5), pd = new PistaOpus(path.join(dir, 'floja.ogg'), 6);
voz('fuerte2', 'volume=6dB').forEach((p, i) => pf.agregar(p, i * 20));
voz('floja2', 'volume=-12dB').forEach((p, i) => pd.agregar(p, 7000 + i * 20));
pf.silencioHasta(13000); pd.silencioHasta(13000);
pf.cerrar(); pd.cerrar();
const lf = await sonoridad(pf.ruta), ld = await sonoridad(pd.ruta);
const cada = [{ db: ganancia(lf) }, { db: ganancia(ld) }];
const sale2 = path.join(dir, 'pareja.ogg');
await mezclar([pf.ruta, pd.ruta], sale2, cada);
const a1 = await lufsEntre(sale2, 1, 5), a2 = await lufsEntre(sale2, 8, 12);
ok(Math.abs(lf - ld) > 15, `las dos voces entran muy distintas (${lf.toFixed(1)} y ${ld.toFixed(1)} LUFS)`);
ok(Math.abs(a1 - a2) < 2 && Math.abs(a1 - VOZ_LUFS) < 3,
  `en la mezcla quedan parejas, cerca de ${VOZ_LUFS} (${a1.toFixed(1)} y ${a2.toFixed(1)} LUFS)`);
const pico = Number(spawnSync('ffmpeg', ['-nostats', '-i', sale2, '-af',
  'astats=measure_overall=Peak_level:measure_perchannel=none', '-f', 'null', '-']).stderr.toString()
  .match(/Peak level dB: (-?[0-9.]+)/)?.[1] ?? 99);
ok(pico < 0, `nada pasa del tope (pico ${pico.toFixed(1)} dB)`);

// ── 🎙️ la voz de la prueba de micro ──
console.log('🎙️ la voz de la prueba de micro');
const { FRASES } = await import('./microfono.js');
const VOZ = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'voz');
const faltan = FRASES.filter((k) => !fs.existsSync(path.join(VOZ, k + '.ogg')));
ok(!faltan.length, 'están las ' + FRASES.length + ' frases' + (faltan.length ? ' (faltan: ' + faltan.join(', ') + ')' : ''));
const textos = JSON.parse(fs.readFileSync(path.join(VOZ, 'frases.json'), 'utf8'));
ok(FRASES.every((k) => k === 'cuenta' || textos[k]), 'cada frase tiene su texto en frases.json (la cuenta se arma aparte)');
ok(!Object.entries(textos).some(([k, v]) => k !== '_leeme' && /beat/i.test(v)), 'en lo que dice ULAYA va «bit», no «beat» (Piper lo lee como se escribe)');
ok(Math.abs(Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(VOZ, 'cuenta.ogg')]).toString()) - 3.4) < 0.3,
  'la cuenta «Tres. Dos. Uno. ¡Tiempo!» dura ~3,4 s, una palabra por segundo');
const de20 = FRASES.filter((k) => !faltan.includes(k)).every((k) => paquetesDe(path.join(VOZ, k + '.ogg')).every((p) => muestrasDe(p) === 960));
ok(de20, 'todas en paquetes de 20 ms: Discord las recibe sin volver a codificar');
// el mismo camino que usa @discordjs/voice al hablar: Ogg Opus -> reproductor, sin codificador de Opus instalado
const { createAudioPlayer, createAudioResource, StreamType, AudioPlayerStatus, entersState, NoSubscriberBehavior } = await import('@discordjs/voice');
const rep = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
let sono = false;
try {
  rep.play(createAudioResource(fs.createReadStream(path.join(VOZ, 'bien.ogg')), { inputType: StreamType.OggOpus }));
  await entersState(rep, AudioPlayerStatus.Playing, 5000);
  await entersState(rep, AudioPlayerStatus.Idle, 15000);
  sono = true;
} catch (e) { /* abajo */ }
ok(sono, 'el reproductor de Discord pasa una frase de punta a punta');
rep.stop();

// ── 🚦 los límites de la prueba de micro ──
console.log('🚦 los límites');
const { limite, textoLimite, beats, POR_PERSONA_HORA, ENTRE_PRUEBAS_S, POR_SERVIDOR_HORA } = await import('./microfono.js');
const T0 = 1_000_000_000_000, MIN = 60000;
ok(limite([], [], T0) === null, 'la primera prueba pasa');
ok(limite([T0 - 30000], [], T0)?.por === 'seguido', `dos pruebas en menos de ${ENTRE_PRUEBAS_S} s: «espera un minuto»`);
const tres = Array.from({ length: POR_PERSONA_HORA }, (_, i) => T0 - (50 - i * 10) * MIN);
const lp = limite(tres, [], T0);
ok(lp?.por === 'persona' && Math.round(lp.en / MIN) === 10, `la ${POR_PERSONA_HORA + 1}.ª en la hora no pasa, y dice cuánto falta (${Math.round((lp?.en || 0) / MIN)} min)`);
ok(limite(tres.map((t) => t - 61 * MIN), [], T0) === null, 'las de hace más de una hora ya no cuentan');
const sv = Array.from({ length: POR_SERVIDOR_HORA }, (_, i) => T0 - i * MIN);
ok(limite([], sv, T0)?.por === 'servidor', `${POR_SERVIDOR_HORA} en una hora en el servidor: no entra nadie más`);
ok(/10 min/.test(textoLimite(lp, '123')) && textoLimite(lp, '123').includes('<@123>'), 'el aviso del límite lo menciona y dice los minutos');
// los beats: cada uno con permiso (en datos/beatmakers.json o de uso libre), de ~30 s y en paquetes de 20 ms
const permisos = JSON.parse(fs.readFileSync(path.join(VOZ, '..', '..', 'datos', 'beatmakers.json'), 'utf8')).beatmakers.map((b) => b.nombre);
const bs = beats();
ok(bs.every((b) => b.uso_libre || permisos.includes(b.beatmaker)),
  `los ${bs.length} beats son de beatmakers con permiso o de uso libre`);
ok(bs.every((b) => { const ps = paquetesDe(path.join(VOZ, 'beats', b.archivo)); return ps.length > 1300 && ps.every((p) => muestrasDe(p) === 960); }),
  'cada beat dura ~30 s y va en paquetes de 20 ms (Discord lo manda sin recodificar)');
ok(bs.every((b) => b.titulo && b.beatmaker), 'cada beat tiene título y beatmaker para el crédito');

fs.rmSync(dir, { recursive: true, force: true });
console.log(mal ? `\n❌ ${mal} mal` : '\n✅ todo bien');
process.exit(mal ? 1 : 0);
