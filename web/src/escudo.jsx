// 🛡️ EL ESCUDO ARMADO DE UNA CREW (Dlx, 29/10/2026, al remake de las crews: «Me gusta todo»). Forma, símbolo y dos
// colores de un catálogo fijo: `esc:forma.simbolo.aaaaaa.bbbbbb`, guardado donde va el logo. Lo valida `escudoOk()` de
// bot/crews.js con los MISMOS catálogos: si se agrega una pieza, en los dos.
//
// ⚠️ Una crew sin logo no lleva iniciales: lleva un escudo sacado de su nombre (`delNombre()`), siempre el mismo. Kraut y
// Fiore (2014): los grupos con logo sobreviven más, y sólo 3 de las 29 crews tenían uno.

export const FORMAS = {
  escudo: 'M50 4 L92 16 L92 52 C92 76 72 90 50 98 C28 90 8 76 8 52 L8 16 Z',
  circulo: 'M50 4 A46 46 0 1 1 49.9 4 Z',
  hexagono: 'M50 3 L92 27 L92 73 L50 97 L8 73 L8 27 Z',
  rombo: 'M50 2 L98 50 L50 98 L2 50 Z',
};
// `micro` es de trazo (sin relleno); el resto, macizos
export const SIMBOLOS = {
  corona: 'M24 64 L28 36 L40 50 L50 30 L60 50 L72 36 L76 64 Z M26 70 H74 V76 H26 Z',
  micro: 'M42 24 a8 8 0 0 1 16 0 V50 a8 8 0 0 1 -16 0 Z M34 46 a16 16 0 0 0 32 0 M50 62 V74 M40 76 H60',
  llama: 'M50 22 C60 36 68 42 66 56 C64 68 56 76 50 76 C42 76 34 68 34 58 C34 48 42 46 44 36 C48 44 50 44 50 22 Z',
  rayo: 'M56 20 L36 54 H50 L44 80 L66 44 H52 Z',
  estrella: 'M50 20 L58 42 L82 42 L62 56 L70 80 L50 66 L30 80 L38 56 L18 42 L42 42 Z',
  calavera: 'M30 48 a20 20 0 1 1 40 0 V60 H62 V70 H38 V60 H30 Z M40 46 a5 5 0 1 0 0.1 0 M60 46 a5 5 0 1 0 0.1 0',
  diamante: 'M32 34 H68 L80 48 L50 80 L20 48 Z',
  ojo: 'M18 50 C30 32 70 32 82 50 C70 68 30 68 18 50 Z M50 41 a9 9 0 1 0 0.1 0',
  puno: 'M32 46 V36 a5 5 0 0 1 10 0 V44 M42 44 V32 a5 5 0 0 1 10 0 V44 M52 44 V34 a5 5 0 0 1 10 0 V46 M62 46 V40 a5 5 0 0 1 10 0 V58 C72 70 64 78 52 78 H44 C36 78 30 70 30 60 V50 Z',
  alas: 'M50 64 C40 52 26 50 16 36 C30 38 38 40 50 50 C62 40 70 38 84 36 C74 50 60 52 50 64 Z',
};
export const NOMBRE_SIMBOLO = { corona: 'Corona', micro: 'Micrófono', llama: 'Llama', rayo: 'Rayo', estrella: 'Estrella', calavera: 'Calavera',
  diamante: 'Diamante', ojo: 'Ojo', puno: 'Puño', alas: 'Alas' };
export const NOMBRE_FORMA = { escudo: 'Escudo', circulo: 'Círculo', hexagono: 'Hexágono', rombo: 'Rombo' };
export const COLORES = ['e41373', '29b298', 'f2b705', '2f6fdb', 'e5484d', '9b5cff', '0e0e10', 'f6f6f6', 'ff7a1a', '5fc8c0'];

/** `{forma, simb, a, b}` de un logo `esc:…`, o `null` si no es uno (o trae una pieza que no está en el catálogo). */
export function leerEscudo(logo) {
  const m = /^esc:([a-z]+)\.([a-z]+)\.([0-9a-f]{6})\.([0-9a-f]{6})$/.exec(String(logo || ''));
  if (!m || !FORMAS[m[1]] || !SIMBOLOS[m[2]] || !COLORES.includes(m[3]) || !COLORES.includes(m[4])) return null;
  return { forma: m[1], simb: m[2], a: m[3], b: m[4] };
}
export const codigoEscudo = (e) => 'esc:' + e.forma + '.' + e.simb + '.' + e.a + '.' + e.b;

function hash(s) {
  let h = 2166136261;
  for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** El escudo de una crew sin logo: sale del nombre, así que es siempre el mismo. ⚠️ `>>>` y no `>>`: con `>>` el
 *  índice sale negativo y el símbolo, `undefined`. */
export function delNombre(nombre) {
  const h = hash(String(nombre || '').toLowerCase().trim());
  const f = Object.keys(FORMAS), s = Object.keys(SIMBOLOS);
  const e = { forma: f[h % f.length], simb: s[(h >>> 3) % s.length], a: COLORES[(h >>> 7) % COLORES.length], b: COLORES[(h >>> 11) % COLORES.length] };
  if (e.b === e.a) e.b = e.a === 'f6f6f6' ? '0e0e10' : 'f6f6f6';
  return e;
}

/** El escudo dibujado. `e`: `{forma, simb, a, b}`. Ocupa la caja que le den (100 × 100 de viewBox). */
export function Escudo({ e, titulo }) {
  const trazo = e.simb === 'micro';
  return (
    <svg className="cw-esc" viewBox="0 0 100 100" role={titulo ? 'img' : undefined} aria-label={titulo || undefined} aria-hidden={titulo ? undefined : 'true'}>
      <path d={FORMAS[e.forma]} fill={'#' + e.a} stroke="#030304" strokeWidth="4" strokeLinejoin="round" />
      <path d={SIMBOLOS[e.simb]} fill={trazo ? 'none' : '#' + e.b} stroke={'#' + e.b} strokeWidth={trazo ? 6 : 2}
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** El escudo de una crew: el armado si lo tiene, si no el de su nombre. `null` si su logo es una imagen. */
export function escudoDe(logo, nombre) {
  if (logo && !/^esc:/.test(logo)) return null;
  return leerEscudo(logo) || delNombre(nombre);
}

/** La sigla que sugiere un nombre: las iniciales si son varias palabras, si no las tres primeras letras. */
export function sugerirSigla(nombre) {
  const ps = String(nombre || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .split(/\s+/).filter(Boolean);
  const s = ps.length > 1 ? ps.map((w) => w[0]).join('') : (ps[0] || '').slice(0, 3);
  return s.slice(0, 4).toUpperCase();
}

/** La tinta que se lee sobre un color: negra sobre los claros, blanca sobre los oscuros. */
export function tinta(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#F6F6F6';
  const n = parseInt(m[1], 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 150 ? '#030304' : '#F6F6F6';
}
