// 🎤 LA CARA DE QUIEN NO TIENE FOTO, EN LA PÁGINA (25/11/2026). Dlx: «asegurate que en el ranking global hayan imagenes de
// todos». De los 1.261 del Ranking global, 159 tenían foto (fms.tv y Freestylestats: YouTube y UrbanStreet no traen una por
// persona) y el resto iba con la inicial. Ahora va la misma silueta de rapero que llevan las cartas sin foto (Dlx,
// 03/10/2026: «usar una silueta de un rapero en negro»), con la MISMA figura que su carta: `comun/sin_foto.cual()` elige
// una de cuatro por el nombre, y esto hace la misma cuenta.
//
// ⚠️ LAS FIGURAS NO SE DIBUJAN ACÁ: son `bot/paginas/sin_foto/<n>.svg`, que escribe `herramientas/sin_foto_web.py` desde
// `comun/sin_foto.py`. Ese script también comprueba (en CI) que esta cuenta dé lo mismo que la de Python.

export const N_FIGURAS = 4;

// SHA-1 (sólo para elegir la figura: nada de seguridad depende de esto)
function sha1(bytes) {
  const n = bytes.length, len = ((n + 9 + 63) >> 6) << 6, m = new Uint8Array(len);
  m.set(bytes);
  m[n] = 0x80;
  const dv = new DataView(m.buffer);
  dv.setUint32(len - 4, (n * 8) >>> 0);
  dv.setUint32(len - 8, Math.floor((n * 8) / 2 ** 32));
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  for (let o = 0; o < len; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 80; i++) { const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]; w[i] = (x << 1) | (x >>> 31); }
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      const f = i < 20 ? (b & c) | (~b & d) : i < 40 ? b ^ c ^ d : i < 60 ? (b & c) | (b & d) | (c & d) : b ^ c ^ d;
      const k = i < 20 ? 0x5a827999 : i < 40 ? 0x6ed9eba1 : i < 60 ? 0x8f1bbcdc : 0xca62c1d6;
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0;
      e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = t;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  return [h0, h1, h2, h3, h4];
}

/** Qué figura le toca a un nombre: la de `comun/sin_foto.cual()` (sin tildes, banderas ni mayúsculas). Sin nombre, la 0. */
export function figuraDe(nombre) {
  const s = [...String(nombre || '').normalize('NFKD').toLowerCase()].filter((ch) => /[\p{L}\p{N}]/u.test(ch)).join('');
  if (!s) return 0;
  // el resto del número entero de 160 bits entre 4 es el de sus últimos 32 (2^32 es múltiplo de 4)
  return sha1(new TextEncoder().encode(s))[4] % N_FIGURAS;
}

/** La dirección de la silueta de alguien. */
export const siluetaDe = (nombre) => '/sin_foto/' + figuraDe(nombre) + '.svg';
