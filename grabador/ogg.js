// 🎙️ CADA VOZ, UN ARCHIVO OGG OPUS QUE ARRANCA CON LA GRABACIÓN.
//
// Discord manda el audio de cada persona en paquetes Opus de 20 ms, y SÓLO mientras habla: cuando calla no llega nada.
// Si se escribieran los paquetes uno detrás del otro, los silencios desaparecerían y cada pista se iría adelantando, así
// que al juntarlas las voces no coincidirían. Por eso cada pista empieza en el segundo 0 de la grabación y los huecos se
// rellenan con paquetes de silencio de 3 bytes (`SILENCIO`): una hora callado ocupa ~0,7 MB y todas las pistas duran
// lo mismo, así que mezclarlas es sumarlas (`ffmpeg amix`), sin calcular desfasajes.
//
// ⚠️ NO SE DECODIFICA NADA: se guardan los paquetes tal como llegan. Así el grabador casi no gasta CPU (que es lo que se
// paga en Railway) y la calidad es la que mandó Discord.
//
// ⚠️ EL RELOJ ES LA LLEGADA, PERO SÓLO ENTRE RÁFAGAS. Dentro de una ráfaga (paquetes a menos de `RAFAGA_MS` uno del
// otro) se escriben seguidos aunque lleguen con saltos: un corte de red de 200 ms trae después los paquetes atrasados
// todos juntos, y si se anclaran a su llegada la pista quedaría corrida para siempre. Cada ráfaga nueva se vuelve a
// anclar a la hora de llegada, así que el error no se acumula: dura como mucho hasta la próxima pausa.

import fs from 'node:fs';

//: un paquete Opus de 20 ms de silencio, estéreo (TOC 0xFC: CELT banda completa, 20 ms, estéreo, un cuadro)
export const SILENCIO = Buffer.from([0xfc, 0xff, 0xfe]);
//: muestras por segundo: Opus en Discord siempre va a 48 kHz
export const HZ = 48000;
//: menos que esto entre dos paquetes es la misma ráfaga (ver arriba)
export const RAFAGA_MS = 300;
//: cuántos paquetes entran como mucho en una página (~1 s de audio): cada página es una escritura a disco
const POR_PAGINA = 50;

// ── el CRC de Ogg (polinomio 0x04C11DB7, sin reflejar, arranca en 0) ──
const TABLA = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let r = i << 24;
  for (let j = 0; j < 8; j++) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1;
  TABLA[i] = r >>> 0;
}
export function crcOgg(buf) {
  let c = 0;
  for (let i = 0; i < buf.length; i++) c = ((c << 8) ^ TABLA[((c >>> 24) ^ buf[i]) & 0xff]) >>> 0;
  return c >>> 0;
}

/** Cuántas muestras (a 48 kHz) trae un paquete Opus, leyendo su primer byte (RFC 6716 §3.1). */
export function muestrasDe(p) {
  if (!p || !p.length) return 0;
  const conf = p[0] >> 3;
  let ms;
  if (conf < 12) ms = [10, 20, 40, 60][conf % 4];        // SILK
  else if (conf < 16) ms = [10, 20][conf % 2];           // híbrido
  else ms = [2.5, 5, 10, 20][conf % 4];                  // CELT
  const c = p[0] & 3;
  const cuadros = c === 0 ? 1 : c < 3 ? 2 : (p.length > 1 ? p[1] & 0x3f : 0);
  return Math.round(cuadros * ms * HZ / 1000);
}

/** Una página Ogg. `tipo`: 2 = la primera, 4 = la última, 0 = las demás. */
function pagina(serie, nro, granulo, paquetes, tipo) {
  const lazos = [];
  for (const p of paquetes) {
    let n = p.length;
    while (n >= 255) { lazos.push(255); n -= 255; }
    lazos.push(n);
  }
  const cab = Buffer.alloc(27 + lazos.length);
  cab.write('OggS', 0, 'latin1');
  cab[4] = 0;
  cab[5] = tipo;
  cab.writeBigInt64LE(BigInt(granulo), 6);
  cab.writeUInt32LE(serie >>> 0, 14);
  cab.writeUInt32LE(nro >>> 0, 18);
  cab.writeUInt32LE(0, 22);
  cab[26] = lazos.length;
  for (let i = 0; i < lazos.length; i++) cab[27 + i] = lazos[i];
  const todo = Buffer.concat([cab, ...paquetes]);
  todo.writeUInt32LE(crcOgg(todo), 22);
  return todo;
}

/** Cuántos lazos (bytes de la tabla de segmentos) ocupa un paquete. */
const lazosDe = (p) => Math.floor(p.length / 255) + 1;

export class PistaOpus {
  /**
   * @param {string} ruta  el .ogg que se escribe
   * @param {number} serie el número de serie del flujo (cualquiera, distinto por pista)
   */
  constructor(ruta, serie = (Math.random() * 0xffffffff) >>> 0) {
    this.ruta = ruta;
    this.serie = serie;
    this.fd = fs.openSync(ruta, 'w');
    this.nro = 0;
    this.muestras = 0;          // cuántas muestras hay escritas (lo que dura la pista)
    this.ultimo = -Infinity;    // ms de la llegada del último paquete de verdad
    this.cola = [];
    this.bytes = 0;
    this.paquetes = 0;          // paquetes de voz (sin contar el relleno)
    const cabeza = Buffer.alloc(19);
    cabeza.write('OpusHead', 0, 'latin1');
    cabeza[8] = 1;              // versión
    cabeza[9] = 2;              // canales: Discord manda estéreo
    cabeza.writeUInt16LE(0, 10);        // pre-skip: no se sabe con qué se codificó, así que nada
    cabeza.writeUInt32LE(HZ, 12);
    cabeza.writeInt16LE(0, 16);
    cabeza[18] = 0;             // mapeo 0: mono o estéreo
    this._escribir(pagina(this.serie, this.nro++, 0, [cabeza], 2));
    const vendor = Buffer.from('underlegends grabador', 'utf8');
    const tags = Buffer.alloc(8 + 4 + vendor.length + 4);
    tags.write('OpusTags', 0, 'latin1');
    tags.writeUInt32LE(vendor.length, 8);
    vendor.copy(tags, 12);
    tags.writeUInt32LE(0, 12 + vendor.length);
    this._escribir(pagina(this.serie, this.nro++, 0, [tags], 0));
  }

  _escribir(b) {
    fs.writeSync(this.fd, b);
    this.bytes += b.length;
  }

  _volcar(tipo = 0) {
    if (!this.cola.length && tipo !== 4) return;
    this._escribir(pagina(this.serie, this.nro++, this.muestras, this.cola, tipo));
    this.cola = [];
  }

  _meter(p) {
    const lazos = this.cola.reduce((n, q) => n + lazosDe(q), 0);
    if (this.cola.length >= POR_PAGINA || lazos + lazosDe(p) > 255) this._volcar();
    this.cola.push(p);
    this.muestras += muestrasDe(p);
  }

  /** Rellena con silencio hasta `ms` desde el arranque (redondeando hacia abajo a 20 ms). */
  silencioHasta(ms) {
    const meta = Math.floor(ms * HZ / 1000);
    const n = Math.floor((meta - this.muestras) / 960);
    for (let i = 0; i < n; i++) this._meter(SILENCIO);
  }

  /** Un paquete de Discord que llegó a los `ms` del arranque. */
  agregar(p, ms) {
    if (!p || !p.length) return;
    if (ms - this.ultimo > RAFAGA_MS) this.silencioHasta(ms);
    this.ultimo = ms;
    this.paquetes++;
    this._meter(Buffer.from(p));
  }

  /** Lo que dura la pista, en segundos. */
  get segundos() {
    return this.muestras / HZ;
  }

  cerrar() {
    if (this.fd == null) return;
    this._volcar(4);
    fs.closeSync(this.fd);
    this.fd = null;
  }
}
