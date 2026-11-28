// 📬🎨 CÓMO SE VE EL BUZÓN DE DRA (28/11/2026). Dlx: «Me gusta lo de buzones, pero falta más edición, visualización,
// imágenes. ¿Esos mensajes planos tú crees que están bonitos? Usa el estilo que usamos para anunciar eventos. El buzón
// debería tener botones que funcionen y que den algo».
//
// EL MENSAJE DEL HILO, de arriba a abajo (todo en UN recuadro magenta, las filas de botones debajo y afuera, la regla de
// bot/vista.js):
//   · la franja «TU BUZÓN · AVISOS» con el estilo de DRA (bot/buzon_img.py: negro, magenta, verde, las palabras con eco);
//   · «📬 @persona, esto es para ti» y cuántos avisos son;
//   · un aviso por sección: el título en negrita, una línea y la hora del este; al costado, su imagen —tu carta de
//     verdad en los de tu tarjeta y tu rango, el Drop en los de drops, y si no, el cuadrito de su clase—;
//   · «…y N avisos más en la campana» si no entran, y el pie (privado, se borra en 48 h);
//   · fila 1, LO QUE DA ALGO: «🎁 Reclama tu drop diario» (el único azul), «🛍️ La vitrina de hoy» y «🃏 Mi tarjeta»
//     (bot/buzon_botones.js); fila 2, los links de los avisos; fila 3, «✔️ Ya lo vi» y «🔕 No me avises más».
//
// ⚠️ NADA SE DIBUJA POR MENSAJE: las imágenes son las que ya están en R2 (`bot/buzon_img.js`, lo escribe
// `bot/buzon_img.py --publicar`) o las de siempre (las cartas, los GIF del Drop). Sin una, esa pieza no va: nunca una
// imagen rota.
// ⚠️ ENTRA EN DISCORD POR CONSTRUCCIÓN: si con todo pasa de 40 componentes o 4.000 letras, se van sacando avisos del
// final (quedan «en la campana») hasta que entre. Lo mide `V.medir()`, el mismo de bot/probar_local.mjs.
// ⚠️ Puras: sin estado y sin red. Las usa el objeto (la ronda) y bot/buzon_botones.js.
import * as V from './vista.js';
import * as IMG from './buzon_img.js';

export const R2 = 'https://pub-70d5821d06a8432c9cffd0c102195000.r2.dev';
//: los GIF del Drop (los de `/drops`: `gifDrop()` de worker.js, `herramientas/gif_drops.py`)
export const DROP_GIF = R2 + '/drops/gif/v2/';
export const ITEMS_MAX = 6;
//: los botones que dan algo (bot/buzon_botones.js)
export const ID = { drop: 'bzn:drop', vitrina: 'bzn:vit', tarjeta: 'bzn:card', visto: 'bzn:visto', no: 'bzn:no' };
//: las rarezas (las de los Dragón Drops y la Tienda: `RAREZA_NOMBRE` de worker.js, `web/src/tienda_rz.js`) y su color
export const RAREZAS = ['Maqueta', 'Mixtape', 'Vinilo', 'Disco de Oro', 'Micrófono de Oro', 'Disco de Diamante'];
export const RAREZA_COLOR = [0x9AA4B2, 0x29B298, 0x9B5CFF, 0xFF4F93, 0xF5C542, 0xBFF4FF];
const SLUG = (t) => String(t || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');
/** La URL del GIF de un Drop (la misma regla que `gifDrop()` de worker.js: lo prueba conectar_dra_prueba.mjs) */
export function gifDrop(anim, estado, r, titulo) {
  return DROP_GIF + anim + (estado === 'titulo' ? '-titulo-' + SLUG(titulo) : '-' + estado + '-' + r) + '.gif';
}

export const TXT = {
  hola: (id) => '### 📬 <@' + id + '>, esto es para ti',
  cuantos: (n) => '-# ' + (n === 1 ? '1 aviso nuevo' : n + ' avisos nuevos') + ' · lo mismo está en la campana de la página',
  mas: (n) => '…y ' + n + (n === 1 ? ' aviso más' : ' avisos más') + ' en la campana de la página.',
  pie: '-# 🔒 Este hilo es privado: sólo lo ves tú (y los moderadores). Se borra solo en 48 h.',
};

// ── la hora del este ────────────────────────────────────────────────────────────────────────────────────────────────
const PARTES_ET = (t) => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric',
  month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(new Date(t))
  .map((p) => [p.type, p.value]));
/** «28/11 · 3:05 PM ET» */
export function fechaET(t) {
  if (!Number.isFinite(Number(t)) || !Number(t)) return '';
  const p = PARTES_ET(Number(t));
  return p.day + '/' + p.month + ' · ' + p.hour + ':' + p.minute + ' ' + String(p.dayPeriod || '').toUpperCase() + ' ET';
}
/** «3:05 PM ET» */
export function horaET(t) {
  const p = PARTES_ET(Number(t));
  return p.hour + ':' + p.minute + ' ' + String(p.dayPeriod || '').toUpperCase() + ' ET';
}
/** `AAAAMMDD` del este: el `?v=` de una carta en el hilo (Discord guarda las imágenes por dirección) */
export const diaSello = (t) => { const p = PARTES_ET(t); return p.year + p.month + p.day; };
/** La próxima medianoche del este después de `t` (cuando sale el próximo drop del día). Con horario de verano o sin él */
export function medianocheET(t = Date.now()) {
  const p = PARTES_ET(t);
  for (const h of [4, 5]) {
    const x = Date.UTC(+p.year, +p.month - 1, +p.day + 1, h);
    const q = PARTES_ET(x);
    if (q.hour === '12' && q.minute === '00' && String(q.dayPeriod).toUpperCase() === 'AM') return x;
  }
  return Date.UTC(+p.year, +p.month - 1, +p.day + 1, 5);
}
/** «en 3 h 20 min» / «en 45 min» */
export function falta(ms) {
  const m = Math.max(1, Math.ceil(ms / 60000));
  return m < 60 ? 'en ' + m + ' min' : 'en ' + Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '');
}

// ── las imágenes de cada aviso ──────────────────────────────────────────────────────────────────────────────────────
const CARTAS = [['temporada', /temporada/i], ['competitivo', /competitiv/i], ['servidor', /servidor/i], ['pais', /pa[ií]s/i]];
/** Qué carta va al costado de un aviso de tu tarjeta o tu rango: la que nombra, o la que abriría `/card` (la Competitiva
 *  si la tiene, si no la Servidor). `''` si no tiene ninguna */
export function cartaDeAviso(it, cs) {
  const tiene = (c) => !Array.isArray(cs) || cs.includes(c);
  const txt = String((it && it.titulo) || '') + ' ' + String((it && it.cuerpo) || '');
  for (const [c, re] of CARTAS) if (re.test(txt) && tiene(c)) return c;
  if (/rango/i.test(txt) && tiene('competitivo')) return 'competitivo';
  if (!Array.isArray(cs)) return 'servidor';
  return ['competitivo', 'servidor', 'temporada', 'pais'].find((c) => cs.includes(c)) || '';
}
/**
 * La imagen al costado de un aviso: tu carta de verdad (los `personal`, con tu clave), el Drop (los `drops`), y si no, el
 * cuadrito de su clase que ya está en R2. `''` = sin imagen. `ctx`: `{clave, cs, ahora}`; `img`: el mapa de bot/buzon_img.js
 */
export function miniDe(it, ctx = {}, img = IMG) {
  const tipo = String((it && it.tipo) || '');
  if (tipo === 'personal' && /^[\p{L}\p{N}-]{1,60}$/u.test(String(ctx.clave || ''))) {
    const c = cartaDeAviso(it, ctx.cs);
    if (c) return R2 + '/' + encodeURIComponent(ctx.clave) + '/' + c + '.webp?v=' + diaSello(ctx.ahora || Date.now());
  }
  if (tipo === 'drops') return gifDrop('drop', 'entra', 0);
  const C = (img && img.CUADROS) || {};
  return C[tipo] || C.personal || '';
}
export const franja = (k, img = IMG) => String(((img && img.FRANJAS) || {})[k] || '');

// ── el mensaje del hilo ─────────────────────────────────────────────────────────────────────────────────────────────
/** La fila de lo que da algo: un solo azul, el drop */
export const filaRegalos = () => [
  V.boton('Reclama tu drop diario', ID.drop, 1, { emoji: { name: '🎁' } }),
  V.boton('La vitrina de hoy', ID.vitrina, 2, { emoji: { name: '🛍️' } }),
  V.boton('Mi tarjeta', ID.tarjeta, 2, { emoji: { name: '🃏' } }),
];

function armar(quien, items, n, ctx, img) {
  const lista = items.slice(0, n);
  const ban = franja('avisos', img);
  const dentro = [ban ? V.galeria({ media: { url: ban }, description: 'Under Legends · tu buzón' }) : null,
    V.T(TXT.hola(quien) + '\n' + TXT.cuantos(items.length)), V.sep()];
  for (const it of lista) {
    const linea = String(it.cuerpo || '').split('\n')[0].slice(0, 200);
    const cuando = fechaET(it.t);
    const txt = '**' + String(it.titulo || '').slice(0, 120) + '**' + (linea ? '\n' + linea : '') + (cuando ? '\n-# ' + cuando : '');
    dentro.push(V.seccion(txt, V.mini(miniDe(it, ctx, img))));
  }
  if (items.length > n) dentro.push(V.T(TXT.mas(items.length - n)));
  dentro.push(V.sep(), V.T(TXT.pie));
  return {
    flags: V.V2,
    components: [V.caja(V.COLOR.mag, dentro), V.fila(filaRegalos()), V.fila(ctx.links || []),
      V.fila(V.boton('Ya lo vi', ID.visto, 3, { emoji: { name: '✔️' } }), V.boton('No me avises más', ID.no, 2, { emoji: { name: '🔕' } }))]
      .filter(Boolean),
    allowed_mentions: { users: [String(quien)] },
  };
}

/**
 * 📬 El mensaje del hilo: los avisos de la campana juntos (lo más nuevo arriba, como los pasa la ronda), cada uno con su
 * imagen, y los tres botones que dan algo. `ctx`: `{clave, cs, ahora, links}` (`links`: los botones de link de los
 * avisos, `botonesDe()` de bot/buzon.js). Siempre entra en Discord: si no, muestra menos avisos.
 */
export function mensajeHilo(quien, items, ctx = {}, img = IMG) {
  let n = Math.min(items.length, ITEMS_MAX);
  let m = armar(quien, items, n, ctx, img);
  while (n > 1 && V.medir(m).problemas.some((p) => /componentes|letras/.test(p))) m = armar(quien, items, --n, ctx, img);
  return m;
}
