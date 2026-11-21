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
// 🩺 el informe del evento entero va por la parte de lo que habló (21/11/2026: 2 ventanas en 2 horas eran 🔴)
const colorCon = (ventanas, problemas) => { const m = new MedidorVoz('x'); Object.assign(m.total, { ventanas, problemas }); return m.resumen(); };
const c1 = colorCon(100, { corta: 2 }), c2 = colorCon(100, { corta: 12 }), c3 = colorCon(100, { corta: 30 }), c4 = colorCon(100, { bajo: 40 });
ok(c1.color === '🟢' && !c1.peor && c2.color === '🟡' && c2.peor === 'corta' && Math.abs(c2.parte - 0.12) < 1e-9
  && c3.color === '🔴' && c4.color === '🟡',
`20 s con cortes en un evento largo no lo pintan (🟢); el 12 % es 🟡 y el 30 %, 🔴; «bajito» nunca pasa de 🟡 (${[c1, c2, c3, c4].map((c) => c.color).join(' ')})`);

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
{
  const d = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(VOZ, 'cuenta.ogg')]).toString());
  ok(d > 2.5 && d < 3.6, `la cuenta suelta (para la prueba sin beat) dura ~3 s: cuatro golpes a 90 BPM (${d.toFixed(2)} s)`);
}
ok(['tres', 'dos', 'uno', 'tiempo'].every((p) => fs.existsSync(path.join(VOZ, 'cuenta', p + '.wav'))),
  'están las cuatro palabras de la cuenta que eligió Dlx (voz/cuenta/, la versión A)');
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
ok(bs.every((b) => paquetesDe(path.join(VOZ, 'beats', b.archivo)).every((p) => muestrasDe(p) === 960)),
  'cada beat va en paquetes de 20 ms (Discord lo manda sin recodificar)');
ok(bs.every((b) => b.titulo && b.beatmaker), 'cada beat tiene título y beatmaker para el crédito');

// 🥊 la cuenta adentro de cada beat (Dlx: «3 2 1… cuando la 4.ª barra va a acabar»)
console.log('🥊 la cuenta adentro del beat');
for (const b of bs) {
  const g = b.golpe_s, c = b.cuenta_s || [];
  const dur = dura(path.join(VOZ, 'beats', b.archivo));
  ok(c.length === 4 && c.every((t, i) => i === 0 || Math.abs(t - c[i - 1] - g) < 0.002)
    && Math.abs(b.entra_s - c[3] - g) < 0.002,
  `${b.titulo}: las cuatro palabras van golpe a golpe y el MC entra un golpe después de «¡Tiempo!»`);
  ok(Math.abs(b.entra_s - 0.03 - 16 * g) < 0.01, `${b.titulo}: antes de la entrada hay justo 4 barras (${(b.entra_s / (4 * g)).toFixed(2)})`);
  ok(dur - b.entra_s >= 20, `${b.titulo}: después de la entrada hay ${(dur - b.entra_s).toFixed(0)} s de beat (el micro escucha hasta 20)`);
  // cada palabra, contra el mismo golpe una barra antes, medido sobre el archivo que sale
  const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', path.join(VOZ, 'beats', b.archivo), '-ac', '1', '-ar', '8000',
    '-f', 's16le', '-'], { maxBuffer: 1 << 28 });
  const db = (a, z) => {
    let s = 0, n = 0;
    for (let i = Math.round(a * 8000); i < Math.round(z * 8000); i++) { const x = pcm.readInt16LE(2 * i); s += x * x; n++; }
    return 10 * Math.log10(s / n + 1e-9);
  };
  const sobre = c.map((t) => db(t - 0.03, t + 0.3) - db(t - 4 * g - 0.03, t - 4 * g + 0.3));
  ok(sobre.every((v) => v >= 6), `${b.titulo}: cada palabra se oye sobre el beat (${sobre.map((v) => '+' + v.toFixed(0)).join(' ')} dB)`);
}

// ── 🎙️👀 los micrófonos y el público de las llamadas en vivo (vivo.js, 21/11/2026) ──
console.log('\n🎙️👀 las llamadas en vivo: micrófonos y público\n');
{
  const V = await import('./vivo.js');
  const A = await import('../bot/avisos.js');
  ok(V.claveCiclo('abc') === await A.claveCiclo('abc'), 'la clave del ciclo da lo mismo que la del Worker');
  const e = (id, canal, x = {}) => Object.assign({ id, canal, bot: false, mute: false, selfMute: false, deaf: false, selfDeaf: false, suppress: false }, x);
  const est = [e('3', 'c1'), e('1', 'c1', { selfMute: true }), e('2', 'c1', { selfDeaf: true }), e('9', 'c1', { bot: true }),
    e('4', 'c2'), e('5', 'c2', { suppress: true }), e('6', null), e('7', 'afk')];
  const m = V.microfonos(est);
  ok(m.ab.join() === '3,4,7' && m.en.join() === '1,2,3,4,5,7',
    'micrófonos: abiertos sin silenciar, ensordecer ni escenario; en la llamada, todos menos los bots (como en_llamada.py)');
  ok([...V.llamadasDelEvento(est, ['c2', 'c9'], 'afk')].join() === 'c2,c9', 'con las llamadas de competencia conocidas, ésas');
  ok([...V.llamadasDelEvento(est, null, 'afk')].join() === 'c1', 'sin conocerlas, la que tiene más gente (sin bots ni la de AFK)');
  ok(V.oyentes(est, new Set(['c1'])).join() === '1,3', 'el público: silenciado vale, ensordecido no, los bots no');
  const T = Date.parse('2026-11-21T21:00:00Z');
  const ll = [{ id: '1000001', g: '111111', sv: 'FFA', ed: T - 10 * 60000 }, { id: '1000002', g: '111111', sv: 'FFA', ed: T - 5 * 60000 },
    { id: '1000003', g: '222222', sv: 'DRA', ed: T - 4 * 3600000 }, { id: 'x', g: '333333', ed: T }, { id: '1000004', g: '444444', sv: 'CH', pub: T - 60 * 60000 }];
  const j3 = V.enJuego(ll, T, 3), j45 = V.enJuego(ll, T, 0.75);
  ok(Object.keys(j3).sort().join() === '111111,444444' && j3['111111'].llave === '1000002' && j3['444444'].sv === 'CH',
    'en juego: la llave más nueva de cada servidor, de las últimas 3 horas');
  ok(Object.keys(j45).join() === '111111', 'para el público, sólo la tocada hace menos de 45 minutos');

  // una vuelta entera, con un Discord y un Worker de mentira
  const vs = (id, ch, x = {}) => ({ id, channelId: ch, member: { user: { bot: !!x.bot } }, serverMute: false, selfMute: !!x.mudo,
    serverDeaf: false, selfDeaf: !!x.sordo, suppress: false });
  const voz = new Map([['701', vs('701', 'comp')], ['702', vs('702', 'comp', { mudo: true })], ['703', vs('703', 'comp', { sordo: true })],
    ['704', vs('704', 'charla')], ['799', vs('799', 'comp', { bot: true })]]);
  const client = { on() {}, guilds: { cache: new Map([['111111', { id: '111111', afkChannelId: 'afk', voiceStates: { cache: voz } }]]) } };
  const pedidos = [];
  let falla = false;
  const fetchFalso = async (url, op = {}) => {
    const ruta = String(url).replace(V.VIGIA, '');
    pedidos.push({ ruta, h: op.headers || {}, b: op.body ? JSON.parse(op.body) : null });
    if (ruta === '/avisos/vivo') return new Response(JSON.stringify({ llaves: [{ id: '1000002', g: '111111', sv: 'FFA', ed: Date.now() - 60000 }] }));
    if (falla) return new Response('{}', { status: 500 });
    return new Response(JSON.stringify({ ok: true, premiados: 0 }));
  };
  const L = new V.LlamadasVivo({ client, token: 'abc', canalesDe: () => null, anotar: () => {}, fetch: fetchFalso });
  const t0 = Date.now();
  await L.minuto(t0);
  const mic = pedidos.find((p) => p.ruta === '/avisos/voz-vivo');
  ok(mic && mic.h['x-lg-ciclo'] === V.claveCiclo('abc') && mic.b.g['111111'].sv === 'FFA' && mic.b.g['111111'].ab.join() === '701,704'
    && mic.b.g['111111'].en.join() === '701,702,703,704',
  'los micrófonos van al objeto con la clave del ciclo, en el formato de en_llamada.py', JSON.stringify(mic && mic.b));
  await L.minuto(t0 + 20000);   // (en la prueba es un minuto más del público: en Railway, minuto() va cada 60 s)
  ok(pedidos.filter((p) => p.ruta === '/avisos/voz-vivo').length === 1, 'sin cambios, no se repite antes del latido');
  for (let i = 1; i <= 4; i++) await L.minuto(t0 + i * 60000);
  ok(!pedidos.some((p) => p.ruta === '/avisos/publico'), 'a los 4 minutos, la tanda del público todavía se junta');
  falla = true;
  await L.minuto(t0 + 5 * 60000);
  const p1 = pedidos.filter((p) => p.ruta === '/avisos/publico').pop();
  ok(p1 && p1.b.llave === '1000002' && p1.b.min['701'] === 7 && p1.b.min['702'] === 7 && !('703' in p1.b.min) && !('704' in p1.b.min)
    && !('799' in p1.b.min) && L.tandas.size === 1,
  'a los 5 minutos sale la tanda: los de la llamada del evento (silenciado vale; ensordecido, en otro canal o bot, no)', JSON.stringify(p1 && p1.b));
  falla = false;
  await L.minuto(t0 + 6 * 60000);
  const p2 = pedidos.filter((p) => p.ruta === '/avisos/publico').pop();
  ok(p2 && p2.b.tanda === p1.b.tanda && p2.b.min['701'] === 8 && L.tandas.size === 0,
    'si no llegó, sale de nuevo con el MISMO id (el objeto no la cuenta dos veces) y lo de ese minuto adentro');
}

// ── ⚔️ cada batalla en la grabación (batallas.js, 21/11/2026) ──
console.log('\n⚔️ cada batalla en la grabación\n');
{
  const B = await import('./batallas.js');
  const { cortar, duracion } = await import('./mezcla.js');
  // una noche de mentira (en segundos): Ana y Bea pelean de 100 a 340, turnos de 60 s; el host habla entre turnos;
  // Cami y Dora de 400 a 640; antes, Ana y Bea charlan un poco (20 a 40) y Eva tiene el micrófono con ruido
  const h = new B.Habla();
  const habla = (id, a, b) => { for (let ms = a * 1000; ms < b * 1000; ms += 20) h.agregar(id, ms); };
  habla('ana', 20, 24); habla('bea', 30, 33);
  habla('ana', 100, 160); habla('host', 160, 165); habla('bea', 165, 225); habla('host', 225, 228);
  habla('ana', 228, 285); habla('bea', 288, 340);
  habla('host', 345, 360);
  habla('cami', 400, 460); habla('dora', 465, 525); habla('cami', 528, 585); habla('dora', 588, 640);
  for (let t = 0; t < 700; t += 30) habla('eva', t, t + 2);
  const seg = h.segundos();
  ok(seg.ana === 4 + 60 + 57 && seg.bea === 3 + 60 + 52, 'quién habló cuánto, de los paquetes (un hueco de más de 300 ms corta)');
  const ab = B.ubicar([['ana'], ['bea']], h.t, 700);
  const cd = B.ubicar([['cami'], ['dora']], h.t, 700);
  ok(ab && ab.desde >= 90 && ab.desde <= 100 && ab.hasta >= 340 && ab.hasta <= 360, `Ana vs Bea: de ${ab && B.mmss(ab.desde)} a ${ab && B.mmss(ab.hasta)} (pelearon de 1:40 a 5:40)`);
  ok(cd && cd.desde >= 390 && cd.desde <= 400 && cd.hasta >= 640 && cd.hasta <= 660, `Cami vs Dora: de ${cd && B.mmss(cd.desde)} a ${cd && B.mmss(cd.hasta)} (de 6:40 a 10:40)`);
  ok(B.ubicar([['ana'], ['cami']], h.t, 700) === null, 'dos que nunca pelearon entre sí no dan ninguna batalla');
  ok(B.ubicar([['ana'], ['nadie']], h.t, 700) === null && B.ubicar([['ana']], h.t, 700) === null,
    'con un solo lado conocido no se puede ubicar');
  ok(B.ubicar([['ana'], ['eva']], h.t, 700) === null, 'un micrófono con ruido no arma una batalla con nadie');
  const llaves = [{ id: '1', nombre: 'COPA', rondas: [{ r: 'Cuartos', b: [
    { gano: 'Cami', lados: [[{ n: 'Cami', id: 'cami' }], [{ n: 'Dora', id: 'dora' }]] },
    { gano: 'Ana', lados: [[{ n: 'Ana', id: 'ana' }], [{ n: 'Bea', id: 'bea' }]] },
    { gano: '', lados: [[{ n: 'Fio', id: '' }], [{ n: 'Gus', id: '' }]] }] }] }];
  const todas = B.ubicarTodas(llaves, h.t, 700);
  ok(todas.length === 2 && todas[0].nombres.join() === 'Ana,Bea' && todas[1].nombres.join() === 'Cami,Dora',
    'todas las de la llave que se pueden ubicar, en el orden en que se jugaron (no el de la llave)');
  // un MC que gana y sigue: Ana le gana a Bea (100 a 340) y pelea con Cami enseguida (360 a 600, abre Ana)
  const h2 = new B.Habla();
  const habla2 = (id, a, b) => { for (let ms = a * 1000; ms < b * 1000; ms += 20) h2.agregar(id, ms); };
  habla2('ana', 100, 160); habla2('bea', 165, 225); habla2('ana', 228, 285); habla2('bea', 288, 340); habla2('host', 342, 358);
  habla2('ana', 360, 420); habla2('cami', 425, 485); habla2('ana', 488, 545); habla2('cami', 548, 600);
  const dos = B.ubicarTodas([{ id: '2', rondas: [{ r: 'Octavos', b: [{ lados: [[{ n: 'Ana', id: 'ana' }], [{ n: 'Bea', id: 'bea' }]] }] },
    { r: 'Cuartos', b: [{ lados: [[{ n: 'Ana', id: 'ana' }], [{ n: 'Cami', id: 'cami' }]] }] }] }], h2.t, 700);
  ok(dos.length === 2 && dos[0].hasta <= dos[1].desde && dos[0].hasta >= 330 && dos[0].hasta <= 370 && dos[1].desde >= 330
    && dos[1].desde <= 370 && dos[0].desde <= 100 && dos[1].hasta >= 600,
  `un MC que pelea dos seguidas: no se pisan y el corte cae entre las dos (${dos.map((b) => B.mmss(b.desde) + '–' + B.mmss(b.hasta)).join(', ')})`);
  ok(B.mmss(65) === '1:05' && B.mmss(3725) === '1:02:05' && B.nombreClip({ r: 'Cuartos', nombres: ['Ánà 🇦🇷', 'Bea + Ñoño'] })
    === 'cuartos-ana-vs-bea-nono.ogg', 'los minutos y el nombre del archivo, sin tildes ni símbolos');
  // el corte, con ffmpeg de verdad sobre 12 s de audio
  const src = path.join(dir, 'corte_src.ogg'), sal = path.join(dir, 'corte_sal.ogg');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=f=440:d=12', '-c:a', 'libopus', '-b:a', '64k', src]);
  await cortar(src, 3, 8, sal);
  const d = duracion(sal);
  ok(Math.abs(d - 5) < 0.3, `cortar(): de 3 a 8 s da ${d.toFixed(2)} s, sin volver a codificar`);
}

fs.rmSync(dir, { recursive: true, force: true });
console.log(mal ? `\n❌ ${mal} mal` : '\n✅ todo bien');
process.exit(mal ? 1 : 0);
