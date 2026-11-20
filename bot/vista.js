/**
 * 🧱 LAS PIEZAS DE LOS MENSAJES DEL BOT, EN COMPONENTES V2 (tanda 1 del rediseño, 20/11/2026).
 *
 * Dlx, 20/11/2026, a la maqueta de los comandos rehechos: «B» (la portada en todos), «2A» (el color de tu rango en lo tuyo,
 * el del servidor en lo del servidor, sin color en lo del bot, rojo sólo en lo que borra), «3A» (`/card` sola, como el
 * 17/09), «4A» (el versus con las dos cartas), «5A» (los errores en un recuadro chico, sin color) y «6C» (un Drop bueno se
 * puede mostrar en el canal), y «que sea más visual».
 *
 * 🔑 UN SOLO LUGAR PARA LAS PIEZAS. Vivían adentro de `bot/setup.js` (el `/setup` fue el primero en V2) y el resto del bot
 * mandaba texto suelto: lo que se arma acá lo usan el Worker, el `/setup` y el anti-raid. Si una pieza cambia, cambia acá.
 *
 * Las reglas de la forma, que prueban `bot/probar_local.mjs` y `medir()`:
 *   · todo adentro de UN recuadro (`caja()`), con la franja de su familia arriba (`portada()`), salvo `/card` (sin recuadro),
 *     `/borrar-mis-datos` (rojo y sin franja), los errores (`avisoMsg()`: sin franja ni color) y lo que ya trae su imagen
 *     (`/llave`, `/afiche`, el versus, la animación del Drop);
 *   · las FILAS de botones van debajo y afuera del recuadro (como el bot en vivo desde la 7.01). Adentro, un botón sólo al
 *     costado de lo que toca (el accesorio de una sección);
 *   · un solo botón azul por mensaje (salvo `/card` y `/versus`, que siguen la regla de su fila: la carta que miras, gris);
 *   · con el flag V2 no hay `content` ni `embeds`: Discord rechaza el mensaje entero.
 *
 * ⚠️ NADA DE ESTADO ACÁ (la regla de worker.js): son funciones puras.
 * ⚠️ Y NINGÚN COLOR DE RANGO NI DE SERVIDOR: llegan como dato (`meta.rangos.color`, `colorChat()`). Los de acá son los de
 *    la marca (el magenta y el verde de las portadas) y el rojo de lo que borra.
 */

export const V2 = 1 << 15;          // 32768 IS_COMPONENTS_V2
export const EFIMERO = 1 << 6;      // 64    sólo lo ve quien lo pidió
//: los topes de Discord para un mensaje con componentes V2
export const TOPES = { componentes: 40, letras: 4000, id: 100, porFila: 5, opciones: 25, galeria: 10 };
//: la marca (los de las portadas) y el rojo de lo que no se deshace
export const COLOR = { mag: 0xE41373, verde: 0x29B298, amar: 0xF5C542, rojo: 0xDA373C };

// ── 🧱 las piezas ────────────────────────────────────────────────────────────────────────────────────────────────────
export const T = (content) => ({ type: 10, content });
export const SEP = { type: 14, divider: true, spacing: 1 };
/** Un separador; `grande`, con más aire. */
export const sep = (grande) => ({ type: 14, divider: true, spacing: grande ? 2 : 1 });
/** El recuadro. `color` null = sin color (lo del bot). Las piezas vacías se caen solas. */
export const caja = (color, comps) => Object.assign({ type: 17 }, color != null ? { accent_color: color } : {},
  { components: comps.filter(Boolean) });
/** Una miniatura, o nada: sin dato no hay pieza (nunca una imagen rota). */
export const mini = (url) => (url ? { type: 11, media: { url } } : null);
/** Una sección: el texto con su accesorio al costado (una miniatura o un botón). Sin accesorio, el texto solo. */
export const seccion = (texto, acc) => (acc ? { type: 9, components: [T(texto)], accessory: acc } : T(texto));
/** Una galería con hasta 10 imágenes; sin ninguna, nada. */
export const galeria = (...urls) => {
  const items = urls.flat().filter(Boolean).slice(0, TOPES.galeria)
    .map((u) => (typeof u === 'string' ? { media: { url: u } } : u));
  return items.length ? { type: 12, items } : null;
};
/** Una fila de botones (hasta cinco); vacía, nada. */
export const fila = (...c) => {
  const cs = c.flat().filter(Boolean).slice(0, TOPES.porFila);
  return cs.length ? { type: 1, components: cs } : null;
};
export const boton = (label, custom_id, style = 2, extra) => Object.assign({ type: 2, style, label, custom_id }, extra || {});
export const enlace = (label, url, emoji) => Object.assign({ type: 2, style: 5, label, url }, emoji ? { emoji: { name: emoji } } : {});

/** «#C77DFF» o «C77DFF» → número, o null si no es un color. */
export const deHex = (s) => {
  const h = String(s == null ? '' : s).replace('#', '');
  return /^[0-9a-f]{6}$/i.test(h) ? parseInt(h, 16) : null;
};

// ── 🖼️ LAS PORTADAS: una franja de 1200×300 por familia ──────────────────────────────────────────────────────────────
// Las dibuja `herramientas/portadas_discord.py` en `bot/paginas/discord/` y las sirve Pages (que se despliega solo al
// pushear `bot/paginas/`): no tocan R2 ni el presupuesto del Worker. ⚠️ Discord guarda las imágenes POR DIRECCIÓN: si se
// redibujan, se sube `PORTADA_V` o seguirá mostrando las de antes.
export const PAGINAS = 'https://underlegends.pages.dev';
export const PORTADA_V = '1';
export const FAMILIAS = {
  cartas: 'Tus cartas', tienda: 'Tienda', drops: 'Dragón Drops', crews: 'Crews', cuenta: 'Tu cuenta', eventos: 'Eventos',
  ajustes: 'Ajustes', ayuda: 'Liga Global', antiraid: 'Anti-raid', apodo: 'Tu apodo',
};
export const urlPortada = (familia) => (FAMILIAS[familia] ? `${PAGINAS}/discord/portada-${familia}.png?v=${PORTADA_V}` : '');
/** La franja, como primera pieza del recuadro. */
export const portada = (familia) => {
  const u = urlPortada(familia);
  return u ? { type: 12, items: [{ media: { url: u }, description: 'Under Legends · ' + FAMILIAS[familia] }] } : null;
};

// ── ✉️ EL MENSAJE ENTERO ─────────────────────────────────────────────────────────────────────────────────────────────
/**
 * `{color, familia, dentro, filas, efimero, arriba, menciones}`:
 *   dentro    lo del recuadro (texto, secciones, separadores, galerías)
 *   filas     las filas de botones o menús, debajo y AFUERA del recuadro (cada una, un array de botones o una fila hecha)
 *   arriba    lo que va antes del recuadro, afuera (la mención de una invitación: así le suena)
 *   menciones el `allowed_mentions`; por defecto no suena nadie
 */
export function mensaje(o) {
  const x = o || {};
  const comps = [];
  for (const a of x.arriba || []) if (a) comps.push(typeof a === 'string' ? T(a) : a);
  comps.push(caja(x.color == null ? null : x.color, [x.familia ? portada(x.familia) : null].concat(x.dentro || [])));
  for (const f of x.filas || []) {
    const r = Array.isArray(f) ? fila(...f) : f;
    if (r && r.components && r.components.length) comps.push(r);
  }
  return { flags: V2 | (x.efimero ? EFIMERO : 0), components: comps, allowed_mentions: x.menciones || { parse: [] } };
}

/** 🚧 El aviso: un error, el freno al spam, «eso es de otra persona». Recuadro chico, sin color ni franja, efímero. */
export const avisoMsg = (txt, botones) => mensaje({ dentro: [T(String(txt == null ? '' : txt).slice(0, 3900))],
  filas: [botones || []], efimero: true });

/** ⏳ El primer mensaje de algo que tarda: ya en V2, para que la edición sólo reemplace piezas (la regla del `/setup`). */
export const momentoMsg = (familia, efimero = true, color = null, txt = '⏳ Un momento…') =>
  mensaje({ familia, color, dentro: [T('-# ' + txt)], efimero });

/** Un mensaje de antes (texto + filas) pasado a V2, para lo que todavía arma `{content, components}`. */
export function aV2(d, efimero = true, familia = null, color = null) {
  if (d && d.flags !== undefined && (d.flags & V2)) return d;
  const filas = ((d && d.components) || []).filter((c) => c && c.type === 1);
  const txt = String((d && d.content) || '').trim();
  return mensaje({ familia, color, dentro: txt ? [T(txt.slice(0, 3900))] : [T('-# …')], filas, efimero });
}

export const respuesta = (tipo, data) => new Response(JSON.stringify(data === undefined ? { type: tipo } : { type: tipo, data }),
  { headers: { 'content-type': 'application/json' } });

// ── 📏 LO QUE SE MIDE ────────────────────────────────────────────────────────────────────────────────────────────────
/** El texto que se ve de un mensaje (los Text Display, adentro de todo), o el `content` de uno de antes. */
export function textoV2(m) {
  if (!m) return '';
  const out = [];
  if (typeof m.content === 'string' && m.content) out.push(m.content);
  const ver = (c) => {
    if (!c || typeof c !== 'object') return;
    if (c.type === 10) out.push(String(c.content || ''));
    for (const x of c.components || []) ver(x);
    if (c.accessory) ver(c.accessory);
  };
  for (const c of m.components || []) ver(c);
  for (const e of m.embeds || []) out.push([e.title, e.description].filter(Boolean).join('\n'));
  return out.join('\n');
}

/** Todos los componentes de un tipo (o de varios), en cualquier nivel. */
export function piezas(m, tipos) {
  const ts = [].concat(tipos);
  const out = [];
  const ver = (c) => {
    if (!c || typeof c !== 'object') return;
    if (ts.includes(c.type)) out.push(c);
    for (const x of c.components || []) ver(x);
    if (c.accessory) ver(c.accessory);
  };
  for (const c of (m && m.components) || []) ver(c);
  return out;
}

/**
 * Lo que Discord aguanta y lo que decidió Dlx, de un mensaje: `{componentes, letras, idMax, problemas}`. `problemas` vacío
 * es que entra. `o.azules`: cuántos botones azules se permiten (1; `/card` y `/versus` pasan `Infinity`).
 */
export function medir(m, o = {}) {
  const problemas = [];
  let componentes = 0, letras = 0, idMax = 0;
  const ver = (c, adentro) => {
    if (!c || typeof c !== 'object') return;
    componentes += 1;
    if (c.type === 10) letras += String(c.content || '').length;
    if (c.custom_id) idMax = Math.max(idMax, String(c.custom_id).length);
    if (c.type === 1) {
      if (adentro) problemas.push('una fila de botones adentro del recuadro');
      if ((c.components || []).length > TOPES.porFila) problemas.push('más de 5 en una fila');
    }
    if ((c.type === 3) && (c.options || []).length > TOPES.opciones) problemas.push('más de 25 opciones en un menú');
    if (c.type === 12 && (!(c.items || []).length || c.items.length > TOPES.galeria)) problemas.push('una galería con 0 o más de 10');
    if (c.type === 2 && c.style !== 5 && !c.custom_id) problemas.push('un botón sin custom_id');
    if (c.type === 2 && c.style === 5 && !/^https:\/\//.test(String(c.url || ''))) problemas.push('un link sin https');
    for (const x of c.components || []) ver(x, adentro || c.type === 17);
    if (c.accessory) ver(c.accessory, adentro || c.type === 17);
  };
  for (const c of (m && m.components) || []) ver(c, false);
  const v2 = !!(m && (Number(m.flags) & V2));
  if (v2 && (m.content || (m.embeds && m.embeds.length))) problemas.push('content o embeds con el flag V2');
  if (componentes > TOPES.componentes) problemas.push(componentes + ' componentes (el tope es 40)');
  if (letras > TOPES.letras) problemas.push(letras + ' letras (el tope es 4.000)');
  if (idMax > TOPES.id) problemas.push('un custom_id de ' + idMax + ' (el tope es 100)');
  const azules = piezas(m, 2).filter((b) => b.style === 1 && !b.disabled).length;
  if (azules > (o.azules === undefined ? 1 : o.azules)) problemas.push(azules + ' botones azules');
  return { componentes, letras, idMax, azules, problemas };
}
