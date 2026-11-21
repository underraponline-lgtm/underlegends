// 🩺 CÓMO SE ESCUCHA CADA VOZ, MIENTRAS SE GRABA (21/11/2026).
//
// Dlx, después de la primera prueba: *«¿hay algo que se pueda hacer para personas que se escuchan mal?… y quizás que
// el bot te avise en vivo que no se te escucha tan bien»*, y a cómo avisar: *«En el chat de la llamada»* — una vez por
// persona por evento, y sólo si el problema dura `SOSTENIDO` ventanas seguidas (20 s).
//
// CUATRO PROBLEMAS, Y CÓMO SE MIDE CADA UNO:
//   · se corta      — paquetes que faltan adentro de una ráfaga (llegan menos de los que el tiempo pide). Sin decodificar
//   · teléfono      — el Discord de esa persona manda banda angosta (≤ 6 kHz): lo dice el primer byte de cada paquete
//   · bajo          — el volumen de la voz (sólo los tramos con voz) por debajo de `BAJO_DB`
//   · satura        — la voz casi tan fuerte como su propio pico (`SATURA_DB`), o pegada a −1 dB: el micrófono
//                     distorsiona y eso no se arregla después.
//                     ⚠️ Opus NO conserva el recorte: una onda que en el origen pega contra el techo sale decodificada
//                     con el pico en −2,2 dB y la media en −4,2 (medido el 21/11). Contar muestras al tope daba 0 %.
// Los dos últimos piden oír el audio: cada `VENTANA_S` se escriben los últimos segundos de esa voz en un .ogg chico y
// ffmpeg lo decodifica (~30 ms de CPU por voz y ventana). Nada de librerías de Opus nuevas.
//
// ⚠️ LOS UMBRALES SON DE ARRANQUE, NO MEDIDOS EN UN EVENTO: salen de lo normal para voz (−20 dBFS de RMS, 0 cortes) y
// de la prueba del 21/11 (Dlx: −14,7 dB, 0,001 % al tope, 12 kHz, sin cortes → 🟢). Con el primer evento de verdad se
// miran los números de todos (`resumen()`) y se ajustan.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { PistaOpus, muestrasDe, HZ, RAFAGA_MS } from './ogg.js';

export const VENTANA_S = 10;
export const SOSTENIDO = 2;          // ventanas seguidas con el mismo problema antes de avisar (2 × 10 s = 20 s)
export const VOZ_MIN_S = 4;          // una ventana con menos voz que esto no se juzga
export const NIVEL_MIN_S = 2;        // y el volumen, sólo con esto de voz audible adentro (no un clic)
export const BAJO_DB = -32;          // RMS de la voz (sólo tramos con voz) por debajo de esto: «bajito»
export const SATURA_DB = -10;        // RMS de la voz por encima de esto: satura (la prueba de Dlx dio −14,7, fuerte y limpia)
export const SATURA_FRAC = 0.005;    // o más de 0,5 % de las muestras con voz por encima de −1 dB
export const CORTA_FRAC = 0.08;      // más de 8 % de paquetes perdidos adentro de las ráfagas: se corta
export const TELEFONO_FRAC = 0.5;    // más de la mitad de los paquetes en banda angosta: calidad de teléfono
// 🩺 EL INFORME DEL EVENTO ENTERO va por la parte de lo que habló cada uno (ver `resumen()`): un problema cuenta desde el
// 10 % de sus ventanas juzgadas, y «se corta» o «satura» es 🔴 desde el 25 %
export const PARTE_AMARILLO = 0.10;
export const PARTE_ROJO = 0.25;

/** La banda de audio que dice el primer byte de un paquete Opus (RFC 6716 §3.1). */
export function bandaDe(p) {
  const c = p[0] >> 3;
  if (c < 12) return ['NB', 'MB', 'WB'][Math.floor(c / 4)];        // SILK
  if (c < 16) return c < 14 ? 'SWB' : 'FB';                         // híbrido
  return ['NB', 'WB', 'SWB', 'FB'][Math.floor((c - 16) / 4)];       // CELT
}
const angosta = (b) => b === 'NB' || b === 'MB';

export const TEXTOS = {
  bajo: (m) => `🎙️ <@${m}> se te escucha **bajito**. Sube tu volumen de entrada (Ajustes de usuario → Voz y video) `
    + 'o acércate al micrófono.',
  satura: (m) => `🎙️ <@${m}> tu micrófono **satura**: la voz se distorsiona. Baja el volumen de entrada (Ajustes de `
    + 'usuario → Voz y video) o aléjate un poco del micrófono.',
  corta: (m) => `🎙️ <@${m}> se te **corta** el audio: a tu conexión se le pierden pedazos. Si puedes, cierra `
    + 'descargas u otras apps, o acércate al wifi.',
  telefono: (m) => `🎙️ <@${m}> tu audio llega con **calidad de teléfono**: tu Discord está mandando poco. Suele ser la `
    + 'conexión o el ahorro de datos del celular.',
};
const ORDEN = ['corta', 'satura', 'bajo', 'telefono'];   // si hay dos, se avisa el que más se nota

function ffmpegPcm(ruta) {
  return new Promise((ok, mal) => {
    const p = spawn('ffmpeg', ['-v', 'error', '-i', ruta, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'],
      { stdio: ['ignore', 'pipe', 'ignore'] });
    const trozos = [];
    p.stdout.on('data', (d) => trozos.push(d));
    p.on('error', mal);
    p.on('close', (c) => (c === 0 ? ok(Buffer.concat(trozos)) : mal(new Error('ffmpeg ' + c))));
  });
}

/** El nivel de un PCM de 16 kHz: RMS de los tramos de 20 ms con voz (> −50 dB) y la fracción de muestras al tope. */
export function nivelDe(pcm) {
  const n = Math.floor(pcm.length / 2), tramo = 320;
  let suma = 0, conVoz = 0, tope = 0;
  for (let i = 0; i + tramo <= n; i += tramo) {
    let s = 0, t = 0;
    for (let j = 0; j < tramo; j++) {
      const x = pcm.readInt16LE((i + j) * 2);
      s += x * x;
      if (x >= 29205 || x <= -29205) t++;       // ≥ −1 dB del tope
    }
    if (Math.sqrt(s / tramo) / 32768 > 0.00316) { suma += s; conVoz += tramo; tope += t; }   // −50 dB
  }
  if (!conVoz) return { db: null, tope: 0, voz_s: 0 };
  return { db: 20 * Math.log10(Math.sqrt(suma / conVoz) / 32768), tope: tope / conVoz, voz_s: conVoz / 16000 };
}

export class MedidorVoz {
  constructor(id) {
    this.id = id;
    this.anillo = [];            // los paquetes de la última ventana (para oírlos)
    this.ultimo = -Infinity;
    this.tramo = null;
    this.v = this._cero();       // lo de esta ventana
    this.total = { voz_s: 0, rec: 0, esp: 0, angosta: 0, paq: 0, dbs: [], tope: 0, ventanas: 0, problemas: {} };
    this.racha = { problema: null, n: 0 };
    this.avisado = false;
  }

  _cero() { return { rec: 0, esp: 0, angosta: 0, paq: 0 }; }

  // ⚠️ LA PÉRDIDA SE MIDE POR TRAMO, NO PAQUETE A PAQUETE. Un corte de red de 200 ms entrega después los paquetes
  // atrasados todos juntos: mirando el hueco entre dos llegadas eso parece medio segundo perdido, y no se perdió nada.
  // Un tramo es una racha de paquetes de una misma ráfaga y una misma ventana: lo esperado es lo que va de la primera
  // llegada a la última (más un paquete), y lo recibido, lo que llegó. Con el corte adentro, las dos cosas dan igual.
  _cerrarTramo() {
    const t = this.tramo;
    if (!t) return;
    this.v.esp += ((t.ult - t.ini) * HZ) / 1000 + t.ultM;
    this.v.rec += t.rec;
    this.tramo = null;
  }

  /** Un paquete que llegó a los `ms` de la grabación (lo mismo que recibe `PistaOpus.agregar`). */
  agregar(p, ms) {
    const m = muestrasDe(p);
    if (!this.tramo || ms - this.ultimo > RAFAGA_MS) {
      this._cerrarTramo();
      this.tramo = { ini: ms, ult: ms, ultM: m, rec: 0 };
    }
    this.tramo.rec += m;
    this.tramo.ult = ms;
    this.tramo.ultM = m;
    this.ultimo = ms;
    this.v.paq++;
    if (angosta(bandaDe(p))) this.v.angosta++;
    this.anillo.push(p);
  }

  /**
   * Cierra la ventana: mide y dice qué problema hay (o `null`). `dir` es dónde escribir el .ogg de un momento.
   * Devuelve `{ problema, avisar }`: `avisar` es true la primera vez que un problema se sostiene `SOSTENIDO` ventanas.
   */
  async ventana(dir) {
    this._cerrarTramo();
    const v = this.v, paquetes = this.anillo;
    this.v = this._cero();
    this.anillo = [];
    const voz_s = paquetes.reduce((s, p) => s + muestrasDe(p), 0) / HZ;
    if (voz_s < VOZ_MIN_S) return { problema: null, avisar: false };
    let nivel = { db: null, tope: 0 };
    const f = path.join(dir, `.medir-${this.id}.ogg`);
    try {
      const pista = new PistaOpus(f);
      paquetes.forEach((p, i) => pista.agregar(p, i * 20));
      pista.cerrar();
      nivel = nivelDe(await ffmpegPcm(f));
      // ⚠️ un clic o una risa de 50 ms no es «tu voz»: medida sobre la prueba del 21/11, dos ventanas con sólo un ruido
      // así salían «bajito» (−37,8 dB). El volumen se juzga con `NIVEL_MIN_S` de voz de verdad, o no se juzga
      if (nivel.voz_s < NIVEL_MIN_S) nivel = { db: null, tope: 0 };
    } catch (e) { /* sin nivel esta vez: se juzga con lo demás */ } finally { fs.rmSync(f, { force: true }); }
    const medida = {
      perdida: v.esp > 0 ? Math.max(0, 1 - v.rec / v.esp) : 0,
      angosta: v.paq ? v.angosta / v.paq : 0,
      db: nivel.db, tope: nivel.tope,
    };
    const t = this.total;
    t.voz_s += voz_s; t.rec += v.rec; t.esp += v.esp; t.angosta += v.angosta; t.paq += v.paq; t.ventanas++;
    if (nivel.db != null) { t.dbs.push(nivel.db); t.tope = Math.max(t.tope, nivel.tope); }
    const problema = juzgar(medida);
    if (problema) t.problemas[problema] = (t.problemas[problema] || 0) + 1;
    this.racha = problema && problema === this.racha.problema ? { problema, n: this.racha.n + 1 } : { problema, n: problema ? 1 : 0 };
    const avisar = !!problema && !this.avisado && this.racha.n >= SOSTENIDO;
    if (avisar) this.avisado = true;
    this.ultimaMedida = medida;
    return { problema, avisar, medida };
  }

  /** Para el informe de la entrega: 🟢/🟡/🔴 y por qué. */
  resumen() {
    const t = this.total;
    const db = t.dbs.length ? t.dbs.reduce((a, b) => a + b, 0) / t.dbs.length : null;
    const perdida = t.esp > 0 ? Math.max(0, 1 - t.rec / t.esp) : 0;
    // 🩺 PARA EL EVENTO ENTERO PESA CUÁNTO DE LO QUE HABLÓ (21/11/2026, el primer evento real: DESGRACIAS EN TOKYO VOL
    // 32, 1 h 55 min). Con «dos ventanas en todo el evento» salían 🔴 «se corta» tres personas que perdieron el 2–3 % en
    // total: 20 s sueltos en dos horas. Ahora el problema cuenta si fue al menos el `PARTE_AMARILLO` de sus ventanas
    // juzgadas (y como mínimo `SOSTENIDO`), y «se corta» o «satura» es 🔴 desde el `PARTE_ROJO`. El aviso en vivo no cambia:
    // ése sigue saliendo con 20 s seguidos (`ventana()`)
    const parte = (p) => (t.ventanas ? (t.problemas[p] || 0) / t.ventanas : 0);
    const peor = ORDEN.find((p) => (t.problemas[p] || 0) >= SOSTENIDO && parte(p) >= PARTE_AMARILLO) || null;
    const grave = peor && (peor === 'corta' || peor === 'satura') && parte(peor) >= PARTE_ROJO;
    return { voz_s: t.voz_s, db, perdida, angosta: t.paq ? t.angosta / t.paq : 0, tope: t.tope, peor, parte: peor ? parte(peor) : 0,
      color: !t.ventanas ? '⚪' : grave ? '🔴' : peor ? '🟡' : '🟢' };
  }
}

/** Qué problema muestra una medida, el que más se nota primero (`ORDEN`), o null. */
export function juzgar(m) {
  const hay = {
    corta: m.perdida > CORTA_FRAC,
    satura: (m.db != null && m.db > SATURA_DB) || m.tope > SATURA_FRAC,
    bajo: m.db != null && m.db < BAJO_DB,
    telefono: m.angosta > TELEFONO_FRAC,
  };
  return ORDEN.find((p) => hay[p]) || null;
}

export const NOMBRE_PROBLEMA = { corta: 'se corta', satura: 'satura', bajo: 'bajito', telefono: 'calidad de teléfono' };
export const carpetaMedir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'medir-'));
