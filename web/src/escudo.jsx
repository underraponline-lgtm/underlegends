// 🛡️ EL ESCUDO ARMADO DE UNA CREW (Dlx, 29/10/2026, al remake de las crews: «Me gusta todo»). Forma, símbolo y dos
// colores de un catálogo fijo: `esc:forma.simbolo.aaaaaa.bbbbbb`, guardado donde va el logo. Lo valida `escudoOk()` de
// bot/crews.js con los MISMOS catálogos: si se agrega una pieza, en los dos.
//
// 🧩 MÁS PIEZAS (Dlx, 16/11/2026: «crea más variaciones en los crews… da más variaciones para personalizados», y a la
// maqueta, «Sí, todo»): 8 formas, 21 símbolos (uno es la SIGLA de la crew), 16 colores, la DIVISIÓN del campo con un
// tercer color y el BORDE. El código largo es `esc:forma.simb.a.b.division.borde.c[.SIGLA]`; un escudo liso de borde
// fino se sigue guardando con el código corto, así que los de antes no cambian ni un píxel. La sigla la pone el objeto
// (`conSigla()` de bot/crews.js): la página manda el escudo sin ella.
//
// ⚠️ Una crew sin logo no lleva iniciales: lleva un escudo sacado de su nombre (`delNombre()`), siempre el mismo. Kraut y
// Fiore (2014): los grupos con logo sobreviven más, y sólo 3 de las 29 crews tenían uno. ⚠️ `delNombre()` elige SÓLO entre
// las piezas de antes (`*_ANTES`): si eligiera entre todas, a cada crew sin logo le cambiaría el escudo.

import { useId } from 'react';

export const FORMAS = {
  escudo: 'M50 4 L92 16 L92 52 C92 76 72 90 50 98 C28 90 8 76 8 52 L8 16 Z',
  circulo: 'M50 4 A46 46 0 1 1 49.9 4 Z',
  hexagono: 'M50 3 L92 27 L92 73 L50 97 L8 73 L8 27 Z',
  rombo: 'M50 2 L98 50 L50 98 L2 50 Z',
  estandarte: 'M12 4 H88 V96 L50 78 L12 96 Z',
  octagono: 'M32 4 H68 L96 32 V68 L68 96 H32 L4 68 V32 Z',
  redondo: 'M8 6 H92 V46 C92 72 74 88 50 97 C26 88 8 72 8 46 Z',
  biselado: 'M20 4 H80 L96 20 V80 L80 96 H20 L4 80 V20 Z',
};
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
  espadas: 'M26 26 L74 74 M74 26 L26 74 M22 66 L34 78 M66 78 L78 66',
  auriculares: 'M28 62 V50 a22 22 0 0 1 44 0 V62 M24 58 h8 v18 h-8 Z M68 58 h8 v18 h-8 Z',
  vinilo: 'M50 22 a28 28 0 1 1 -0.1 0 Z M50 44 a6 6 0 1 0 0.1 0 Z',
  ancla: 'M50 30 V78 M38 38 H62 M26 58 C28 72 40 78 50 78 C60 78 72 72 74 58 M50 20 a5 5 0 1 0 0.1 0',
  luna: 'M58 20 A30 30 0 1 0 80 64 A24 24 0 1 1 58 20 Z',
  sol: 'M50 38 a12 12 0 1 0 0.1 0 M50 20 V28 M50 72 V80 M20 50 H28 M72 50 H80 M29 29 L35 35 M65 65 L71 71 M71 29 L65 35 M35 65 L29 71',
  trofeo: 'M34 24 H66 V40 C66 52 58 58 50 58 C42 58 34 52 34 40 Z M46 58 H54 V70 H62 V76 H38 V70 H46 Z',
  dado: 'M26 26 H74 V74 H26 Z M38 33 a5 5 0 1 0 0.1 0 Z M62 57 a5 5 0 1 0 0.1 0 Z M50 45 a5 5 0 1 0 0.1 0 Z',
  laurel: 'M40 80 C20 70 16 46 28 24 M60 80 C80 70 84 46 72 24 M27 66 l-12 -6 M21 50 l-11 -9 M23 35 l-7 -12 M73 66 l12 -6 M79 50 l11 -9 M77 35 l7 -12',
  spray: 'M40 36 H60 V78 H40 Z M44 28 H56 V36 H44 Z M64 22 h4 M66 30 h6 M64 38 h4',
  // la sigla no es un dibujo: es el texto de la crew (`Escudo`)
  sigla: '',
};
// los de trazo (sin relleno); el resto, macizos. Y los que tienen agujeros (`evenodd`): ⚠️ sólo los nuevos, para que el
// ojo y la calavera de antes se sigan viendo igual
const TRAZO = new Set(['micro', 'espadas', 'auriculares', 'ancla', 'sol', 'laurel']);
const HUECOS = new Set(['vinilo', 'dado']);
export const esTrazo = (s) => TRAZO.has(s);
export const NOMBRE_SIMBOLO = { corona: 'Corona', micro: 'Micrófono', llama: 'Llama', rayo: 'Rayo', estrella: 'Estrella', calavera: 'Calavera',
  diamante: 'Diamante', ojo: 'Ojo', puno: 'Puño', alas: 'Alas', espadas: 'Espadas', auriculares: 'Auriculares', vinilo: 'Vinilo',
  ancla: 'Ancla', luna: 'Luna', sol: 'Sol', trofeo: 'Trofeo', dado: 'Dado', laurel: 'Laurel', spray: 'Spray', sigla: 'Tu sigla' };
export const NOMBRE_FORMA = { escudo: 'Escudo', circulo: 'Círculo', hexagono: 'Hexágono', rombo: 'Rombo', estandarte: 'Estandarte',
  octagono: 'Octágono', redondo: 'Escudo redondo', biselado: 'Biselado' };
export const COLORES = ['e41373', '29b298', 'f2b705', '2f6fdb', 'e5484d', '9b5cff', '0e0e10', 'f6f6f6', 'ff7a1a', '5fc8c0',
  'c9a227', 'b8bcc4', '7a1f3d', '1b2a4a', '9be22d', 'ff8fc7'];
// la división del campo: lo que se pinta con el tercer color, recortado por la forma
export const DIVISIONES = {
  liso: '',
  partido: 'M0 0 H50 V100 H0 Z',
  cortado: 'M0 0 H100 V50 H0 Z',
  banda: 'M0 0 H30 L100 70 V100 H70 L0 30 Z',
  franja: 'M36 0 H64 V100 H36 Z',
  chevron: 'M0 70 L50 40 L100 70 V100 L50 70 L0 100 Z',
  cuartelado: 'M0 0 H50 V50 H0 Z M50 50 H100 V100 H50 Z',
};
export const NOMBRE_DIVISION = { liso: 'Liso', partido: 'Partido', cortado: 'Cortado', banda: 'Banda', franja: 'Franja',
  chevron: 'Chevrón', cuartelado: 'Cuartelado' };
export const BORDES = ['fino', 'grueso', 'doble'];
export const NOMBRE_BORDE = { fino: 'Fino', grueso: 'Grueso', doble: 'Doble' };

// las de antes de la tanda del 16/11/2026: de acá sale `delNombre()`
const FORMAS_ANTES = ['escudo', 'circulo', 'hexagono', 'rombo'];
const SIMBOLOS_ANTES = ['corona', 'micro', 'llama', 'rayo', 'estrella', 'calavera', 'diamante', 'ojo', 'puno', 'alas'];
const COLORES_ANTES = COLORES.slice(0, 10);

const ESC_RE = /^esc:([a-z]+)\.([a-z]+)\.([0-9a-f]{6})\.([0-9a-f]{6})(?:\.([a-z]+)\.([a-z]+)\.([0-9a-f]{6}))?(?:\.([\p{Lu}\p{Lo}\p{N}]{2,4}))?$/u;

/** `{forma, simb, a, b, div, borde, c, sigla}` de un logo `esc:…`, o `null` si no es uno (o trae una pieza que no está
 *  en el catálogo). El código corto da `div: 'liso'`, `borde: 'fino'` y `c` igual al símbolo. */
export function leerEscudo(logo) {
  const m = ESC_RE.exec(String(logo || '').normalize('NFC'));
  if (!m || !FORMAS[m[1]] || SIMBOLOS[m[2]] === undefined || !COLORES.includes(m[3]) || !COLORES.includes(m[4])) return null;
  const e = { forma: m[1], simb: m[2], a: m[3], b: m[4], div: 'liso', borde: 'fino', c: m[4], sigla: m[8] || '' };
  if (m[5] !== undefined) {
    if (DIVISIONES[m[5]] === undefined || !BORDES.includes(m[6]) || !COLORES.includes(m[7])) return null;
    Object.assign(e, { div: m[5], borde: m[6], c: m[7] });
  }
  return e;
}
/** El código para guardar. Sin la sigla: la pone el objeto. Liso y fino, el corto de siempre. */
export function codigoEscudo(e) {
  const corto = 'esc:' + e.forma + '.' + e.simb + '.' + e.a + '.' + e.b;
  const div = e.div || 'liso', borde = e.borde || 'fino';
  return div === 'liso' && borde === 'fino' ? corto : corto + '.' + div + '.' + borde + '.' + (e.c || e.b);
}

function hash(s) {
  let h = 2166136261;
  for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** El escudo de una crew sin logo: sale del nombre, así que es siempre el mismo. ⚠️ `>>>` y no `>>`: con `>>` el
 *  índice sale negativo y el símbolo, `undefined`. */
export function delNombre(nombre) {
  const h = hash(String(nombre || '').toLowerCase().trim());
  const e = { forma: FORMAS_ANTES[h % FORMAS_ANTES.length], simb: SIMBOLOS_ANTES[(h >>> 3) % SIMBOLOS_ANTES.length],
    a: COLORES_ANTES[(h >>> 7) % COLORES_ANTES.length], b: COLORES_ANTES[(h >>> 11) % COLORES_ANTES.length], div: 'liso', borde: 'fino', sigla: '' };
  if (e.b === e.a) e.b = e.a === 'f6f6f6' ? '0e0e10' : 'f6f6f6';
  e.c = e.b;
  return e;
}

/** El escudo dibujado. `e`: lo de `leerEscudo()`. Ocupa la caja que le den (100 × 100 de viewBox). `sigla`: la que se ve
 *  mientras se arma (la del código manda cuando ya está guardado). */
export function Escudo({ e, titulo, sigla }) {
  const id = 'esc' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const trazo = TRAZO.has(e.simb);
  const div = DIVISIONES[e.div || 'liso'];
  const c = '#' + (e.c || e.b);
  const borde = e.borde || 'fino';
  const txt = String(e.sigla || sigla || '').slice(0, 4);
  const tam = txt.length <= 2 ? 36 : txt.length === 3 ? 29 : 23;
  return (
    <svg className="cw-esc" viewBox="0 0 100 100" role={titulo ? 'img' : undefined} aria-label={titulo || undefined} aria-hidden={titulo ? undefined : 'true'}>
      {div ? <defs><clipPath id={id}><path d={FORMAS[e.forma]} /></clipPath></defs> : null}
      <path d={FORMAS[e.forma]} fill={'#' + e.a} />
      {div ? <path d={div} fill={c} clipPath={'url(#' + id + ')'} /> : null}
      <path d={FORMAS[e.forma]} fill="none" stroke="#030304" strokeWidth={borde === 'grueso' ? 8 : 4} strokeLinejoin="round" />
      {borde === 'doble' ? <path d={FORMAS[e.forma]} fill="none" stroke={c} strokeWidth="3" strokeLinejoin="round"
        transform="translate(50 50) scale(0.84) translate(-50 -50)" /> : null}
      {e.simb === 'sigla' ? (
        <text x="50" y="50" dy="0.35em" textAnchor="middle" fontSize={tam} fontWeight="900" fill={'#' + e.b} stroke="#030304"
          strokeWidth="2" paintOrder="stroke" style={{ fontFamily: 'inherit', letterSpacing: '-0.02em' }}>{txt || '?'}</text>
      ) : (
        <path d={SIMBOLOS[e.simb]} fill={trazo ? 'none' : '#' + e.b} fillRule={HUECOS.has(e.simb) ? 'evenodd' : undefined} stroke={'#' + e.b}
          strokeWidth={trazo ? 6 : 2} strokeLinejoin="round" strokeLinecap="round" />
      )}
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
