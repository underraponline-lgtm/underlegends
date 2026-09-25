/**
 * LOS AVISOS DE EVENTOS — la campana del hub.
 *
 * Cuando un servidor de la Liga anuncia un evento en su canal, a quien se
 * suscribió en `underlegends.pages.dev/#/avisos` le llega una notificación
 * al teléfono o a la compu, aunque no tenga Discord abierto.
 *
 * 🔴 TIENE QUE SER AL MINUTO, Y ESO LO DECIDIERON LOS DATOS. Medido el
 * 24/09/2026 sobre los 26 anuncios con hora de `datos/anuncios.json`:
 *
 *     anunciados con 15 min o menos de aviso    18 de 26
 *     con 30 min o menos                        23 de 26
 *     con más de una hora                        2 de 26
 *
 * O sea que «avisar 30 minutos antes» llega tarde casi siempre: el evento
 * se anuncia **ya** empezando. Lo que sirve es avisar en cuanto aparece el
 * anuncio. El ciclo lee los canales cada 15-30 min más lo que tarde
 * Actions en arrancar —el cron de GitHub dispara 1 de cada 9 veces—, así
 * que con él el aviso de un «EN 15» llegaría con el evento empezado. Es
 * la regla de `ESTADO.md`: *«un aviso de un evento que empezó hace una
 * hora es peor que no avisar»*.
 *
 * Por eso esto NO depende del ciclo: un Cron Trigger de Cloudflare
 * (`* * * * *`) le pide a Discord los últimos mensajes de cada canal de
 * eventos, y lo nuevo sale en el momento. Son 3 pedidos por minuto.
 *
 * ⚠️ NADA DE ESTO ESCRIBE EN KV. La cuota gratis de KV son 1.000
 * escrituras por día **para toda la cuenta**, y el 24/09/2026 se agotó
 * (1.117) y congeló el hub. Las suscripciones, lo ya avisado y el latido
 * viven en un Durable Object con SQLite: 100.000 filas escritas por día
 * gratis. El latido de cada minuto son 1.440.
 *
 * ⚠️ EL LECTOR DE ANUNCIOS ESTA DOS VECES, y es a propósito: el ciclo es
 * Python (`bot/anuncios.py`, `bot/cuando.py`) y un Worker no corre Python.
 * Lo que las ata es `bot/avisos_casos.json`: 57 casos —45 mensajes reales
 * de los canales y 12 bordes armados a mano— con lo que Python saca de
 * cada uno. `python bot/avisos_casos.py
 * --auto` comprueba que Python siga dando eso y `node
 * bot/avisos_prueba.mjs` que esto dé lo mismo. Si alguien cambia uno solo,
 * CI se pone rojo — que es la diferencia entre «dos copias» y «dos copias
 * que se desincronizan sin avisar», la forma que este repo ya documentó
 * cinco veces.
 *
 * ⚠️ LAS NOTIFICACIONES VAN CIFRADAS (RFC 8291, `aes128gcm`) y firmadas
 * con VAPID (RFC 8292). Verificado contra el ejemplo del propio RFC —ver
 * `bot/avisos_prueba.mjs`— antes de mandarle nada a nadie.
 */

export const CRON_VIGIA = '* * * * *';

const HUB = 'https://underlegends.pages.dev';
const DC = 'https://discord.com/api/v10';
// Discord pide este formato de User-Agent; sin él puede contestar 400.
const UA = 'DiscordBot (https://underlegends.pages.dev, 1)';

const MIN = 60 * 1000;
const HORA = 60 * MIN;

//: un anuncio SIN hora se avisa sólo si es de hace menos de esto. Pasado
//: ese rato ya no se sabe si el evento está por empezar o terminó.
const EDAD_SIN_HORA = 20 * MIN;
//: un evento que empezó hace menos de esto todavía se avisa («¡empieza
//: ahora!»); después, no. Es la regla de arriba con un número.
const GRACIA = 5 * MIN;
//: cuánto para atrás se mira en cada canal. Un anuncio más viejo que esto
//: no se avisa nunca, aunque su evento sea mañana.
const EDAD_MAX = 12 * HORA;
//: si el evento es en más de esto, además del aviso al anunciarse va un
//: recordatorio `ANTES` de que empiece.
const RECORDAR_SI_FALTA = 60 * MIN;
const ANTES = 30 * MIN;
//: cada cuánto se vuelven a buscar los canales de eventos por nombre.
const REDESCUBRIR = 6 * HORA;
//: 🔑 SOLO EVENTOS Y COMPETENCIAS. Dlx, 25/09/2026: *«solo eventos y
//: competencias»*. La primera versión usaba la búsqueda del hub
//: (`anuncio|novedad|torneo` también) y escuchaba 14 canales. Los de
//: anuncios y novedades los sigue leyendo el ciclo para el ranking y el
//: hub; el vigía, que sólo manda avisos, no los necesita.
export const PATRON_VIGIA = /evento|competenc/i;
//: si cambia qué canales se escuchan, la lista guardada se rehace ya y no
//: a las seis horas
// 3: los nombres se normalizan (NFKD) antes de compararlos; ver `vigilar()`
// 4: sólo los servidores confirmados de la Liga (`meta.liga`); ver `descubrir()`
// 5: Urban Freestyle le dio al bot su rol (25/09/2026) y «Data⋅Eventos»,
// que daba 403, ya se puede leer: se vuelve a buscar sin esperar las 6 h.
const CANALES_V = 5;
//: 🔑 DONDE SE RE-PUBLICAN LOS ANUNCIOS DE TODA LA LIGA. Dlx, 25/09/2026:
//: *«si, este es el canal 1500690475089399858»* — `〢🔥〉eventos-hoy` de
//: DRA, «eventos de toda la comunidad». Ver `publicar()`.
export const CANAL_RED = '1500690475089399858';
const HUB_AVISOS = 'https://underlegends.pages.dev/#/avisos';
//: cuántas notificaciones por invocación. El plan gratis da 50 subpedidos
//: por invocación: 20 envíos + 20 reintentos entran con margen.
const LOTE = 20;
const TOPE_SUBS = 20000;
//: 🔑 EL SERVIDOR DE PRUEBA. No existe en la Liga, la página no lo ofrece,
//: y un aviso de este servidor le llega SOLO a quien lo eligió a mano —ni
//: siquiera a quien pidió «todos»—. Lo usa `herramientas/probar_avisos.py`
//: para recorrer el camino de un anuncio de verdad sin molestar a nadie.
export const SV_PRUEBA = 'ZZZ';
const CADA_SIMULACRO = 5 * MIN;

// ═════════════════════════════════════════════════════════════════════
// EL LECTOR DE ANUNCIOS — port de `bot/anuncios.py` y `bot/cuando.py`
// ═════════════════════════════════════════════════════════════════════
//
// ⚠️ PYTHON Y JAVASCRIPT NO LEEN IGUAL LOS MISMOS REGEX, y por eso esto no
// es una copia literal. En Python `\s`, `\w` y `\b` son Unicode; en JS,
// `\w` y `\b` son ASCII aunque lleve la bandera `u`. Con el `\b` de JS,
// «ÑORGANIZADOR:» tendría un borde de palabra delante y en Python no. Se
// arman acá con las mismas clases que usa Python.

// los espacios de `str.isspace()`: incluye \x1c-\x1f y \x85, que el `\s`
// de JS no tiene, y no incluye U+FEFF, que el de JS sí.
const S = '[\\t\\n\\v\\f\\r\\x1c-\\x20\\x85\\xa0\\u1680\\u2000-\\u200a' +
          '\\u2028\\u2029\\u202f\\u205f\\u3000]';
const W = '[\\p{L}\\p{N}_]';
const NW = '[^\\p{L}\\p{N}_]';
// el `\b` de Python: una transición palabra/no-palabra, en cualquier sentido
const B = '(?:(?<=' + W + ')(?!' + W + ')|(?<!' + W + ')(?=' + W + '))';

const re = (fuente, banderas) => new RegExp(fuente, (banderas || '') + 'u');
const stripPy = (s) => String(s).replace(re('^' + S + '+|' + S + '+$', 'g'), '');
const largo = (s) => Array.from(s).length;

export const PATRON = /evento|anuncio|novedad|torneo|competenc/i;
export const PATRON_INSC = /inscrip|registro|anotad|convocat/i;
export const STAFF = /staff|moderat|admin/i;

const CAMPOS = {
  organizador: 'ORGANIZADOR',
  cupos: 'CUPOS',
  rango: 'RANGO',
  modalidad: 'MODALIDAD',
  premios: 'PREMIOS',
  horario: 'HORARIO|INICIO(?:' + S + '+DEL' + S + '+TORNEO)?',
};

const OTROS_CAMPOS = re(B + '(ORGANIZADOR|CUPOS|RANGO|MODALIDAD|PREMIOS|' +
  'HORARIO|JURADO|DJ|HOST|INDICACIONES|LINK)' + S + '*:', 'i');

export function limpio(s) {
  return String(s == null ? '' : s)
    .replace(/<a?:(\w+):\d+>/g, '')
    .replace(/<#\d+>|<@!?&?\d+>/g, '');
}

function valor(v) {
  let s = String(v == null ? '' : v)
    .replace(/__([^\n]*?)__/g, '$1')
    .replace(/\*\*([^\n]*?)\*\*/g, '$1');
  s = stripPy(s).replace(/^`+|`+$/g, '').replace(/^[ *]+|[ *]+$/g, '');
  // el adorno que quedó sin par: como `_valor()` de Python
  s = s.replace(/^[ *_`~]+/, '');
  s = stripPy(s.replace(re('(?:\\*\\*|__|`|~~)+' + S + '*$'), ''));
  if (OTROS_CAMPOS.test(s)) return '';
  if (!re(W).test(s)) return '';
  return s;
}

export function campo(texto, nombre) {
  const t = limpio(texto);
  const n = '(?:' + nombre + ')';
  let m = re('`' + S + '*' + n + S + '*:' + S + '*([^`\\n]*)`', 'i').exec(t);
  if (m && stripPy(m[1])) return stripPy(m[1]);
  m = re('`' + S + '*' + n + S + '*:?' + S + '*`__?' + S + '*([^\\n]*)', 'i').exec(t);
  if (m && stripPy(m[1])) return valor(m[1]);
  m = re(B + n + '[*_~ \\t]*:[*_~ \\t]*([^\\n]+)', 'i').exec(t);
  return m ? valor(m[1]) : '';
}

// `str.splitlines()`: más cortes que `\n` a secas
const LINEAS = new RegExp('\r\n|[\n\r\x0b\x0c\x1c\x1d\x1e\x85\u2028\u2029]');
const ES_CAMPO = re('^' + S + '*[A-ZÁÉÍÓÚÑ]+' + S + '*:');
const ADORNO = re('^' + '[^\\p{L}\\p{N}_¿¡]+|[^\\p{L}\\p{N}_)\\]!?.]+$', 'g');

// ── el lector ancho: el anuncio de cada servidor, como lo escribe ────────
//
// 🔴 EL MISMO DE `bot/anuncios.py` —ver su encabezado de esta parte—. Dlx,
// 25/09/2026: «cada sv tiene su forma de hacer sus cosas como anunciar».
// Medido sobre 263 mensajes de los 10 canales: DRA no avisaba NINGÚN evento.

const VOCAB = [
  [['INICIO', 'DEL', 'TORNEO'], 'horario', 1],
  [['INICIO', 'DEL', 'EVENTO'], 'horario', 1],
  [['HORA', 'DE', 'INSCRIPCIONES'], 'inscripciones', 9],
  [['HORA', 'DE', 'INSCRIPCION'], 'inscripciones', 9],
  [['HORA', 'INSCRIPCIONES'], 'inscripciones', 9],
  [['HORA', 'INSCRIPCION'], 'inscripciones', 9],
  [['HORARIO', 'CONFIRMADO'], 'horario', 2],
  [['ORGANIZADO', 'POR'], 'organizador', 9],
  [['FORMATO', 'DE', 'COMPETENCIA'], 'modalidad', 9],
  [['INICIO'], 'horario', 1],
  [['HORARIOS'], 'horario', 2],
  [['HORARIO'], 'horario', 2],
  [['CUANDO'], 'horario', 2],
  [['ARRANCA'], 'horario', 2],
  [['COMIENZA'], 'horario', 2],
  [['EMPIEZA'], 'horario', 2],
  [['HORA'], 'horario', 3],
  [['FECHA'], 'fecha', 9],
  [['DIA'], 'fecha', 9],
  [['ORGANIZADORES'], 'organizador', 9],
  [['ORGANIZADORA'], 'organizador', 9],
  [['ORGANIZADOR'], 'organizador', 9],
  [['ORGANIZACION'], 'organizador', 9],
  [['ORGANIZACIOR'], 'organizador', 9],
  [['ORGANIZADO'], 'organizador', 9],
  [['ORGANIZA'], 'organizador', 9],
  [['CUPOS'], 'cupos', 9],
  [['CUPO'], 'cupos', 9],
  [['RANGOS'], 'rango', 9],
  [['RANGO'], 'rango', 9],
  [['MODALIDAD'], 'modalidad', 9],
  [['FORMATO'], 'modalidad', 9],
  [['PREMIOS'], 'premios', 9],
  [['PREMIO'], 'premios', 9],
  [['RECOMPENSA'], 'premios', 9],
  [['JURADOS'], 'jurado', 9],
  [['JURADO'], 'jurado', 9],
  [['JUECES'], 'jurado', 9],
  [['JUEZ'], 'jurado', 9],
  [['DJ'], 'dj', 9],
  [['HOST'], 'host', 9],
  [['INSCRIPCIONES'], 'inscripciones', 9],
  [['INSCRIPCION'], 'inscripciones', 9],
  [['TORNEO'], 'titulo', 9],
];

const NO_TITULOS = ['SUPLENTES', 'CLASIFICADOS', 'RESULTADOS', 'FELICIDADES',
  'CANCELAD', 'POSTERGAD', 'SE CANCELA', 'LLAVE', 'BRACKET'];

const NS = '[^' + S.slice(1);
const MARCAS = /<a?:\w+:\d+>|<@!?&?\d+>|<#\d+>|<t:-?\d+(?::[a-zA-Z])?>/g;
const MARCA_ES = re('\\p{M}');

/** `↝**__𝐂𝐔𝐏𝐎𝐒__**: ♾️` -> `CUPOS :`, como `norm_linea()` de Python. */
export function normLinea(s) {
  const t = String(s == null ? '' : s).replace(MARCAS, ' ').normalize('NFKD');
  let out = '';
  for (const c of Array.from(t)) {
    if (MARCA_ES.test(c)) continue;
    for (const u of Array.from(c.toUpperCase())) {
      out += (u >= 'A' && u <= 'Z') || (u >= '0' && u <= '9') || u === ':' ? u : ' ';
    }
  }
  return out.split(' ').filter(Boolean).join(' ');
}

const toks = (nl) => nl.replace(/:/g, ' : ').split(' ').filter(Boolean);

/** `[tipo, prioridad, palabras]` si la línea normalizada es un campo. */
export function campoLinea(nl) {
  const t = toks(nl);
  for (const [pal, tipo, pri] of VOCAB) {
    if (pal.every((p, i) => t[i] === p)) {
      const resto = t.slice(pal.length);
      if (tipo === 'titulo' && (!resto.length || resto[0] !== ':')) return null;
      if (!resto.length || resto[0] === ':' || resto.length <= 8) return [tipo, pri, pal.length];
      return null;
    }
  }
  return null;
}

function dosPuntos(s) {
  let dentro = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '<') dentro++;
    else if (c === '>' && dentro) dentro--;
    else if ((c === ':' || c === '：') && !dentro) return i;
  }
  return -1;
}

function valorLinea(raw, k, siguientes) {
  const r = limpio(raw);
  const i = dosPuntos(r);
  if (i >= 0) {
    const v = valor(r.slice(i + 1));
    if (v) return v;
  } else {
    const resto = toks(normLinea(r)).slice(k).join(' ');
    if (resto) return resto;
  }
  for (const s of siguientes.slice(0, 3)) {
    if (stripPy(s)) {
      if (campoLinea(normLinea(s))) return '';
      return valor(limpio(s));
    }
  }
  return '';
}

/** `{tipo: valor}` de las líneas que son campos. Ver `campos_lineas()`. */
export function camposLineas(texto) {
  const lineas = String(texto == null ? '' : texto).split(LINEAS);
  const out = {};
  const pri = {};
  for (let i = 0; i < lineas.length; i++) {
    const c = campoLinea(normLinea(lineas[i]));
    if (!c) continue;
    const [tipo, p, k] = c;
    if (tipo in out && (tipo !== 'horario' || pri[tipo] <= p)) continue;
    out[tipo] = valorLinea(lineas[i], k, lineas.slice(i + 1));
    pri[tipo] = p;
  }
  return out;
}

/** La tarjeta del Centro de Competencias de DRA: `🏆 NOMBRE` en un embed. */
function tarjeta(m) {
  for (const e of (m && m.embeds) || []) {
    const t = stripPy(String((e && e.title) || ''));
    if (t.startsWith('🏆') && normLinea(e.description).includes('INSCRIB')) {
      return Array.from(stripPy(t.slice('🏆'.length))).slice(0, 70).join('');
    }
  }
  return '';
}

function sinMd(l) {
  let s = String(l == null ? '' : l);
  for (const x of ['**', '__', '~~', '`', '*']) s = s.split(x).join('');
  return stripPy(stripPy(s).replace(/^[#>-]+/, ''));
}

const stripBordes = (s, cs) => {
  const a = Array.from(s);
  let i = 0;
  let j = a.length;
  while (i < j && cs.includes(a[i])) i++;
  while (j > i && cs.includes(a[j - 1])) j--;
  return a.slice(i, j).join('');
};
const LINK = re('@everyone|@here|https?://' + NS + '+|<t:-?\\d+(?::[a-zA-Z])?>', 'g');
const VACIO_EN_CAJA = re('[\\[(][^\\p{L}\\p{N}_\\[\\]()]*[\\])]', 'g');

/** Una línea -> el título limpio, o `''`. Ver `_titulo()` de Python. */
function titulo(l) {
  let s = sinMd(l).replace(LINK, '');
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ0-9]/.test(s)) return '';
  if (s.includes('╎')) {
    const partes = s.split('╎').map(stripPy).filter(Boolean);
    // el PRIMERO de los más largos, como `max(..., key=len)`
    if (partes.length) s = partes.reduce((a, b) => (largo(b) > largo(a) ? b : a));
  }
  for (const [a, b] of [['『', '』'], ['「', '」'], ['〈', '〉']]) {
    const i = s.indexOf(a);
    const j = i >= 0 ? s.indexOf(b, i + 1) : -1;
    if (i >= 0 && j > i) { s = s.slice(i + 1, j); break; }
  }
  s = s.replace(VACIO_EN_CAJA, ' ');
  s = stripBordes(s.replace(ADORNO, ''), '_ ');
  if (s.startsWith('(') && s.endsWith(')')) s = stripPy(s.slice(1, -1));
  if (s.endsWith(')') && !s.includes('(')) s = s.slice(0, -1);
  if (s.endsWith(']') && !s.includes('[')) s = s.slice(0, -1);
  s = stripBordes(s.replace(ADORNO, ''), '_ ').normalize('NFKC');
  return largo(s) >= 3 ? Array.from(s.replace(re(S + '+', 'g'), ' ')).slice(0, 70).join('') : '';
}

export function nombreDe(texto) {
  for (const l of limpio(texto).split(LINEAS)) {
    if (campoLinea(normLinea(l))) continue;
    if (ES_CAMPO.test(sinMd(l))) continue;
    const t = titulo(l);
    if (t) return t;
  }
  return '';
}

/** Un mensaje -> un anuncio, o `null` si no parece uno. Ver `parsear()`. */
export function parsearAnuncio(m) {
  const txt = (m && m.content) || '';
  const anchos = camposLineas(txt);
  const tj = stripPy(txt) ? '' : tarjeta(m);
  const nombre = tj || titulo(anchos.titulo || '') || nombreDe(txt);
  const p = {};
  for (const k of Object.keys(CAMPOS)) p[k] = campo(txt, CAMPOS[k]);
  // la plantilla manda donde la hay; el lector ancho completa
  for (const k of Object.keys(p)) if (!p[k] && anchos[k]) p[k] = anchos[k];
  // 🔴 LA FIRMA SON DOS CAMPOS PRESENTES, como en Python
  const tipos = new Set(Object.keys(p).filter((k) => p[k]));
  for (const k of Object.keys(anchos)) if (k !== 'titulo') tipos.add(k);
  if (tj) { tipos.add('tarjeta'); tipos.add('boton'); }
  if ((tipos.has('horario') || tipos.has('fecha')) &&
      (txt.includes('@everyone') || txt.includes('@here'))) tipos.add('mencion');
  if (tipos.size < 2 || !nombre) return null;
  const n = normLinea(nombre);
  if (NO_TITULOS.some((x) => n.startsWith(x)) || n === 'PRUEBA') return null;
  return {
    nombre, horario: p.horario, modalidad: p.modalidad,
    cupos: p.cupos, premios: p.premios, organizador: p.organizador,
  };
}

const EN = re(B + 'en' + S + '+(\\d{1,3})' + S +
  '*(m|min|mins|minuto|minutos|h|hs|hr|hrs|hora|horas)?' + B, 'i');
const MEDIA = re(B + 'en' + S + '+media' + S + '+hora' + B, 'i');
const AHORA = re(B + '(ahora|ya|empez(ando|amos)|arrancamos|comenzamos|en' +
  S + '+vivo)' + B, 'i');
const HORAS = ['h', 'hs', 'hr', 'hrs', 'hora', 'horas'];
const TOPE_MIN = 60 * 12;
const MARCA = /<t:(\d{9,11})(?::[tTdDfFR])?>/;

/** Minutos desde el anuncio hasta el evento; `null` si no se sabe. */
export function desfase(horario) {
  const t = stripPy(horario == null ? '' : horario);
  if (!t) return null;
  if (MEDIA.test(t)) return 30;
  const m = EN.exec(t);
  if (m) {
    const n = parseInt(m[1], 10);
    const u = (m[2] || '').toLowerCase();
    const mins = HORAS.includes(u) ? n * 60 : n;
    return mins > 0 && mins <= TOPE_MIN ? mins : null;
  }
  if (AHORA.test(t)) return 0;
  return null;
}

/**
 * Cuándo arranca, en milisegundos UTC; `null` si no se puede saber.
 * `publicado` es el `timestamp` del mensaje, tal cual lo da Discord.
 *
 * ⚠️ EL MENSAJE SE CORTA AL SEGUNDO, como `cuando[:19]` en Python: sin
 * eso las dos versiones difieren en los milisegundos y la prueba de
 * paridad no puede decir si están de acuerdo.
 */
export function momentoMs(horario, publicado) {
  const mk = MARCA.exec(String(horario || ''));
  if (mk) return parseInt(mk[1], 10) * 1000;
  const d = desfase(horario);
  if (d == null) return null;
  const t = Date.parse(String(publicado || '').slice(0, 19) + 'Z');
  return Number.isNaN(t) ? null : t + d * MIN;
}

// ═════════════════════════════════════════════════════════════════════
// WEB PUSH — RFC 8291 (cifrado) y RFC 8292 (VAPID)
// ═════════════════════════════════════════════════════════════════════

export const b64u = {
  enc(bytes) {
    let s = '';
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  dec(str) {
    let s = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
};
const utf8 = (s) => new TextEncoder().encode(s);
function junta(...partes) {
  const out = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of partes) { out.set(p, o); o += p.length; }
  return out;
}

async function hkdf(sal, ikm, info, bytes) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: sal, info }, k, bytes * 8));
}

/**
 * El cuerpo cifrado de una notificación (RFC 8291 §3, con `aes128gcm`).
 *
 * `fijo` es SOLO para la prueba contra el ejemplo del RFC: la clave
 * efímera y la sal. En uso real las dos son nuevas en cada mensaje.
 */
export async function cifrar(texto, p256dh, auth, fijo) {
  const uaPub = b64u.dec(p256dh);
  const secreto = b64u.dec(auth);
  const sal = fijo ? fijo.sal : crypto.getRandomValues(new Uint8Array(16));
  const as = fijo ? fijo.par : await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey(
    'raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(secreto, ecdh,
    junta(utf8('WebPush: info\x00'), uaPub, asPub), 32);
  const cek = await hkdf(sal, ikm, utf8('Content-Encoding: aes128gcm\x00'), 16);
  const nonce = await hkdf(sal, ikm, utf8('Content-Encoding: nonce\x00'), 12);
  const clave = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // 0x02: «último registro, sin relleno» (RFC 8188 §2)
  const claro = junta(typeof texto === 'string' ? utf8(texto) : texto,
    new Uint8Array([2]));
  const cifrado = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce }, clave, claro));
  // cabecera: sal (16) · tamaño de registro (4) · largo del id (1) · id (65)
  const cab = new Uint8Array(86);
  cab.set(sal, 0);
  new DataView(cab.buffer).setUint32(16, 4096);
  cab[20] = 65;
  cab.set(asPub, 21);
  return junta(cab, cifrado);
}

async function clavePrivada(env) {
  const pub = b64u.dec(env.VAPID_PUBLICA);
  return crypto.subtle.importKey('jwk', {
    kty: 'EC', crv: 'P-256', d: env.VAPID_PRIVADA,
    x: b64u.enc(pub.slice(1, 33)), y: b64u.enc(pub.slice(33, 65)),
  }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

/**
 * El JWT de VAPID para un servicio de push (`aud` = su origen).
 *
 * ⚠️ VENCE EN UNA HORA. El RFC permite hasta 24, pero Apple es la más
 * estricta de las tres y se firma uno por lote de todas formas.
 * ⚠️ `sub` ES LA URL DEL HUB, no un mail: Apple pide `mailto:` o `https:`
 * y un mail acá sería un dato personal viajando en cada notificación.
 */
export async function jwtVapid(aud, env, ahora = Date.now()) {
  const cab = b64u.enc(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const cuerpo = b64u.enc(utf8(JSON.stringify(
    { aud, exp: Math.floor(ahora / 1000) + 3600, sub: HUB })));
  const firma = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, await clavePrivada(env),
    utf8(cab + '.' + cuerpo)));
  return cab + '.' + cuerpo + '.' + b64u.enc(firma);
}

/**
 * Manda UNA notificación y devuelve el estado HTTP.
 *
 * ⚠️ `0` Y `-1` NO SON LO MISMO. `0` es que no hubo red —se reintenta—;
 * `-1` es que falló ACÁ: la clave VAPID, el cifrado, una URL rota. Con un
 * solo código, una clave mal cargada se vería como «Google no contesta».
 */
async function empujar(sub, texto, opc, env, jwts, detalle) {
  let h, cuerpo;
  try {
    const aud = new URL(sub.endpoint).origin;
    // una firma por servicio y por lote, no una por persona
    if (!jwts.has(aud)) jwts.set(aud, jwtVapid(aud, env));
    h = {
      TTL: String(opc.ttl),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      Authorization: `vapid t=${await jwts.get(aud)}, k=${env.VAPID_PUBLICA}`,
      // ⚠️ `high` despierta al teléfono aunque esté ahorrando batería:
      // es un aviso con hora, no un boletín.
      Urgency: opc.urgencia || 'high',
    };
    // 🔴 APPLE RECHAZA EL `Topic` Y RECHAZA EL AVISO ENTERO. Medido el
    // 25/09/2026 con el iPhone de Dlx: `400 {"reason":"BadWebPushTopic"}`
    // para «ev1552973488204152833» y también para «ev5967769», cortos y sólo
    // letras y números. «Mandar una de prueba» no lleva `Topic`, y por eso
    // eso sí le llegaba y los avisos de eventos no: NINGÚN aviso del lote le
    // había llegado nunca a un iPhone. A Apple va sin él; Google lo usa para
    // que un aviso nuevo reemplace al viejo si el teléfono estaba apagado.
    if (opc.topic && !/(^|\.)push\.apple\.com$/.test(new URL(sub.endpoint).hostname)) {
      h.Topic = opc.topic;
    }
    cuerpo = await cifrar(texto, sub.p256dh, sub.auth);
  } catch (e) {
    return -1;
  }
  try {
    const r = await fetch(sub.endpoint, { method: 'POST', headers: h, body: cuerpo });
    // 🔑 LA RAZÓN DEL RECHAZO, NO SÓLO EL NÚMERO. El 25/09/2026 el iPhone de
    // Dlx recibía «Mandar una de prueba» y no los avisos del lote: dos 400
    // sin texto no dicen qué encabezado no le gustó al servicio de push.
    if (detalle && r.status >= 400) {
      let razon = '';
      try { razon = (await r.text()).slice(0, 160); } catch (e) { razon = ''; }
      let host = '';
      try { host = new URL(sub.endpoint).hostname; } catch (e) { host = ''; }
      detalle.push({ host, estado: r.status, razon });
    }
    return r.status;
  } catch (e) {
    return 0;
  }
}

// 🔴 SOLO 404 Y 410 BORRAN. La primera versión borraba también con 403
// —«es de otra clave»— y eso es un gatillo para vaciar la tabla: un JWT
// mal firmado por un bug nuestro hace que Google conteste 403 a TODOS, y
// en una sola vuelta se iban todas las suscripciones. 404/410 dicen que
// esa suscripción no existe más; 403 dice que algo está mal, quizás acá.
const MUERTA = (e) => e === 404 || e === 410;

// ═════════════════════════════════════════════════════════════════════
// LA RE-PUBLICACION EN `eventos-hoy`
// ═════════════════════════════════════════════════════════════════════

/**
 * El mensaje que el bot deja en `eventos-hoy` por cada anuncio nuevo.
 *
 * ⚠️ SOLO EMBED, SIN TEXTO. El lector de anuncios —el de acá y el de
 * Python— lee `content`; un mensaje sin texto no se puede confundir con un
 * anuncio, y así el eco del bot no vuelve a entrar como evento nuevo.
 * ⚠️ LA HORA VA COMO MARCA DE DISCORD (`<t:…>`): cada uno la ve en su
 * zona —Dlx en hora del este, el resto de la Liga en la suya—.
 * ⚠️ SIN MENCIONES (`allowed_mentions: []`): esto no hace ping a nadie; el
 * ping de rol de cada servidor sigue siendo el suyo.
 */
export function mensajeRed(c) {
  const seg = c.ini ? Math.floor(c.ini / 1000) : 0;
  const lineas = [`**${c.svn || c.sv}** · ${c.sv}`];
  if (seg) lineas.push(`⏰ Empieza <t:${seg}:R> · <t:${seg}:t>`);
  const extra = [c.mod && `🎤 ${c.mod}`, c.cup && `🎟️ cupos: ${c.cup}`,
    c.pre && `🏅 ${c.pre}`].filter(Boolean);
  if (extra.length) lineas.push(extra.join(' · '));
  return {
    allowed_mentions: { parse: [] },
    embeds: [{
      title: ('🏆 ' + (c.t || 'Nuevo evento')).slice(0, 256),
      url: c.url,
      description: lineas.join('\n').slice(0, 4000),
      color: 0x29B298,
      footer: { text: 'Liga Global · se publica solo, al minuto de anunciarse',
        icon_url: HUB + '/aviso.png' },
    }],
    components: [{
      type: 1,
      components: [
        { type: 2, style: 5, label: 'Ir al anuncio', url: c.url },
        { type: 2, style: 5, label: 'Avisos en tu teléfono', emoji: { name: '🔔' }, url: HUB_AVISOS },
      ],
    }],
  };
}

// 🔴 LOS AVISOS POR MENSAJE DIRECTO SE SACARON (25/09/2026). `/notify`
// nació esa mañana mandando DMs, y Dlx lo corrigió a la tarde: *«no debería
// usar el bot para enviarte DMs, sino activar la notificación al celular o
// dispositivo»*. Se fueron con 0 anotados. Ahora `/notify` lleva a la campana
// de la página con el servidor ya elegido (`#/avisos/<SV>`, ver `campana.js`),
// y el único camino de un aviso es el push de este objeto.

// ═════════════════════════════════════════════════════════════════════
// LA ALTA: qué suscripción se acepta
// ═════════════════════════════════════════════════════════════════════

// ⚠️ SOLO SERVICIOS DE PUSH DE VERDAD. Sin esto, el Worker sería un
// cañón: cualquiera podría registrar una URL suya y hacer que le peguemos
// cada vez que hay un evento.
const SERVICIOS = [
  /^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/, /\.push\.apple\.com$/,
  /\.notify\.windows\.com$/,
];

export function suscripcionValida(sub) {
  if (!sub || typeof sub.endpoint !== 'string' || sub.endpoint.length > 1024) {
    return 'falta el endpoint';
  }
  let u;
  try { u = new URL(sub.endpoint); } catch (e) { return 'endpoint roto'; }
  if (u.protocol !== 'https:') return 'endpoint sin https';
  if (!SERVICIOS.some((r) => r.test(u.hostname))) return 'no es un servicio de push';
  const k = sub.keys || {};
  let p, a;
  try { p = b64u.dec(k.p256dh); a = b64u.dec(k.auth); } catch (e) { return 'claves rotas'; }
  if (p.length !== 65 || p[0] !== 4) return 'p256dh inválida';
  if (a.length !== 16) return 'auth inválida';
  return '';
}

// ═════════════════════════════════════════════════════════════════════
// LO QUE VE EL WORKER
// ═════════════════════════════════════════════════════════════════════

const json = (d, estado = 200, cache = 0) => new Response(JSON.stringify(d), {
  status: estado,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': cache ? `public, max-age=${cache}` : 'no-store',
  },
});

const RUTAS = {
  '/avisos/clave': 'GET', '/avisos/estado': 'GET',
  '/avisos/alta': 'POST', '/avisos/baja': 'POST', '/avisos/probar': 'POST',
  '/avisos/simular': 'POST',
  // 🔑 los avisos de cada uno: ver `vincular()` y `personales()` del objeto
  '/avisos/vincular': 'POST', '/avisos/desvincular': 'POST',
};

const elObjeto = (env) => env.AVISOS.get(env.AVISOS.idFromName('liga'));

/**
 * `/avisos/*` del Worker. Lo llama el proxy de Pages (`/api/avisos/*`).
 *
 * ⚠️ UNA LISTA CERRADA DE RUTAS Y METODOS. El `POST /` del Worker son las
 * interacciones de Discord, con su firma; nada de acá puede caer ahí.
 */
export async function rutaAvisos(req, env, ruta) {
  const metodo = RUTAS[ruta];
  if (!metodo) return json({ error: 'no existe' }, 404);
  if (req.method !== metodo) return json({ error: 'método no permitido' }, 405);
  if (ruta === '/avisos/clave') {
    return env.VAPID_PUBLICA ? json({ clave: env.VAPID_PUBLICA }, 200, 3600)
      : json({ error: 'los avisos todavía no tienen clave' }, 503);
  }
  if (!env.AVISOS) return json({ error: 'los avisos todavía no están enchufados' }, 503);
  // 🔑 VINCULAR UN DISPOSITIVO A UNA PERSONA: el Discord ID sale de Discord
  // —con el permiso que la página trae de entrar con Discord—, nunca de la
  // página. Así nadie puede anotarse los avisos de otro.
  if (ruta === '/avisos/vincular') {
    const crudo = await req.text();
    if (crudo.length > 4096) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo); } catch (e) { d = null; }
    const t = String((d && d.token) || '');
    if (!d || typeof d.endpoint !== 'string' || !/^[A-Za-z0-9._-]{10,300}$/.test(t)) {
      return json({ error: 'faltan datos' }, 400);
    }
    let u = null;
    try {
      const r = await fetch(`${DC}/users/@me`, { headers: { Authorization: 'Bearer ' + t, 'User-Agent': UA } });
      if (r.ok) u = await r.json();
    } catch (e) { u = null; }
    if (!u || !u.id) return json({ error: 'discord' }, 401);
    return elObjeto(env).fetch('https://avisos/vincular', {
      method: 'POST', body: JSON.stringify({ endpoint: d.endpoint, quien: String(u.id) }),
      headers: { 'content-type': 'application/json' },
    });
  }
  const sub = ruta.slice('/avisos'.length);
  if (metodo === 'GET') return elObjeto(env).fetch('https://avisos' + sub);
  const cuerpo = await req.text();
  if (cuerpo.length > 4096) return json({ error: 'demasiado grande' }, 413);
  return elObjeto(env).fetch('https://avisos' + sub, {
    method: 'POST', body: cuerpo, headers: { 'content-type': 'application/json' },
  });
}

// ── los avisos de cada uno ─────────────────────────────────────────────
// 🔑 Dlx, 25/09/2026, a las ideas de Mi cuenta: «todas». La cuarta: que te
// llegue un aviso cuando te pasa algo a vos —subiste de rango, desbloqueaste
// una tarjeta—. Los arma el ciclo (`bot/avisos_personales.py`) y los deja en
// KV; el vigía los lee cada minuto y los manda a los dispositivos que esa
// persona vinculó.
//
// ⚠️ POR KV Y NO POR UNA RUTA: una ruta para que el ciclo le hable al Worker
// habría pedido un secreto compartido nuevo, y los tokens nuevos quedaron
// para el final (Dlx). El ciclo ya escribe KV con su llave.
export const COLA_PERSONAL = 'avisos:personales';

/** La cola que dejó el ciclo, con sólo lo que se puede mandar. */
export function colaPersonal(crudo) {
  let c = null;
  try { c = JSON.parse(crudo || 'null'); } catch (e) { c = null; }
  if (!Array.isArray(c)) return [];
  return c.filter((a) => a && typeof a.id === 'string' && /^[0-9]{5,25}$/.test(String(a.quien || '')) &&
    typeof a.titulo === 'string' && a.titulo).slice(0, 200);
}

/** Lo que viaja al teléfono: lo lee `armar()` de `paginas/sw.js`. */
export function cuerpoPersonal(a) {
  const url = /^https:\/\/underlegends\.pages\.dev\//.test(String(a.url || '')) ? a.url : '/';
  return JSON.stringify({ v: 1, tipo: 'personal', id: String(a.id).slice(0, 40),
    t: String(a.titulo).slice(0, 120), b: String(a.cuerpo || '').slice(0, 240), url });
}

/** Lo que corre el cron de cada minuto. */
/**
 * Lo que se guarda de un mensaje descartado: su última edición.
 *
 * ⚠️ `{}` SI NUNCA SE EDITÓ, que es lo que se guardaba antes: así las
 * filas viejas no se vuelven a leer todas de golpe al desplegar.
 */
export function marcaDescarte(m) {
  const ed = m && m.edited_timestamp ? String(m.edited_timestamp) : '';
  return ed ? JSON.stringify({ ed }) : '{}';
}

/**
 * ¿Se vuelve a leer un mensaje que ya pasó por el vigía?
 *
 * 🔴 UN ANUNCIO QUE SE ARMA EN DOS PASOS NO SONABA NUNCA. Se publica
 * la imagen sola —o «📢 SE VIENE…»— y a los dos minutos se edita con el
 * horario y los cupos; el vigía ya lo había descartado y no lo miraba más
 * (auditoría del 25/09/2026). Ahora, si se editó después de descartarlo,
 * se lee de nuevo.
 *
 * ⚠️ SÓLO LO DESCARTADO AL LEERLO (`desde = hasta = 0`). Lo avisado, lo
 * que está en cola y lo vencido no se vuelven a mirar nunca: una edición
 * no puede hacer sonar dos veces el mismo evento.
 */
export function releer(fila, m) {
  if (!fila) return true;
  if (Number(fila.estado) !== 2 || Number(fila.hasta) !== 0) return false;
  return String(fila.cuerpo || '') !== marcaDescarte(m);
}

/**
 * La marca del disparador del ciclo (el cron de :22 y :52 del Worker).
 * `true` si quedó guardada.
 *
 * 🔑 EN EL OBJETO Y NO EN KV. Eran dos escrituras de KV por disparo
 * —`cron:arranco` y `cron:ultimo`—, ~70 por día de una cuota de 1.000
 * para toda la cuenta que se pasó tres días de siete (20, 22 y 24/09).
 * Es el mismo motivo por el que el vigía late acá: el objeto tiene cien
 * veces más cupo. Se leen en `/avisos/estado` → `disparador`.
 *
 * ⚠️ INTERNA: no está en `RUTAS`, así que desde afuera no se puede
 * escribir. Sólo la llama el `scheduled` del Worker.
 */
export async function marcarDisparo(env, cual, v) {
  if (!env.AVISOS) return false;
  try {
    const r = await elObjeto(env).fetch('https://avisos/disparo', {
      method: 'POST', body: JSON.stringify({ cual, v }),
      headers: { 'content-type': 'application/json' },
    });
    return r.ok;
  } catch (e) {
    return false;
  }
}

export async function vigilar(env, servidores, dueno) {
  if (!env.AVISOS) return;
  await elObjeto(env).fetch('https://avisos/vigilar', {
    method: 'POST', body: JSON.stringify({ servidores, dueno: dueno || '' }),
    headers: { 'content-type': 'application/json' },
  });
}

// ═════════════════════════════════════════════════════════════════════
// EL OBJETO: suscripciones, lo avisado y el latido
// ═════════════════════════════════════════════════════════════════════
//
// ⚠️ UNO SOLO PARA TODA LA LIGA (`idFromName('liga')`). A este tamaño —el
// padrón entero son 870 personas— un objeto alcanza de sobra, y uno solo
// es lo que hace atómico el «¿ya avisé este mensaje?»: dos minutos que se
// pisan no pueden avisar dos veces.

export class Avisos {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sql = state.storage.sql;
    state.blockConcurrencyWhile(async () => {
      this.sql.exec(`
        CREATE TABLE IF NOT EXISTS subs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          endpoint TEXT NOT NULL UNIQUE,
          p256dh TEXT NOT NULL,
          auth TEXT NOT NULL,
          svs TEXT NOT NULL DEFAULT '',
          alta INTEGER NOT NULL,
          visto INTEGER NOT NULL,
          enviados INTEGER NOT NULL DEFAULT 0,
          fallos INTEGER NOT NULL DEFAULT 0,
          prueba INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS avisos (
          id TEXT PRIMARY KEY,
          sv TEXT NOT NULL DEFAULT '',
          cuerpo TEXT NOT NULL,
          desde INTEGER NOT NULL,
          hasta INTEGER NOT NULL,
          creado INTEGER NOT NULL,
          cursor INTEGER NOT NULL DEFAULT 0,
          estado INTEGER NOT NULL DEFAULT 0,
          enviados INTEGER NOT NULL DEFAULT 0,
          fallos INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS estado (k TEXT PRIMARY KEY, v TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS claves (
          clave TEXT PRIMARY KEY,
          id TEXT NOT NULL,
          t INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS posts (
          id TEXT PRIMARY KEY,
          cuerpo TEXT NOT NULL,
          creado INTEGER NOT NULL,
          hecho INTEGER NOT NULL DEFAULT 0,
          intentos INTEGER NOT NULL DEFAULT 0,
          msg TEXT NOT NULL DEFAULT '',
          error TEXT NOT NULL DEFAULT ''
        );
      `);
      // 🔴 LA TABLA DE LOS DMs DE `/notify` SE BORRA: se sacaron el mismo día
      // que nacieron, con 0 anotados. Estado que ya no lee nadie es estado
      // que alguien va a creer que sirve. (La columna `cursor_dm` de `avisos`
      // queda donde ya existía: no la lee nada.)
      this.sql.exec('DROP TABLE IF EXISTS dms');
      // 🔑 LOS AVISOS DE CADA UNO (25/09/2026): de quién es cada dispositivo
      // —si lo vinculó entrando con Discord— y qué aviso personal ya salió.
      // `ADD COLUMN` falla si ya está: es la migración de una sola vez.
      try { this.sql.exec("ALTER TABLE subs ADD COLUMN quien TEXT NOT NULL DEFAULT ''"); } catch (e) { /* ya estaba */ }
      this.sql.exec('CREATE TABLE IF NOT EXISTS hechos (id TEXT PRIMARY KEY, t INTEGER NOT NULL)');
    });
  }

  leer(k) {
    const r = this.sql.exec('SELECT v FROM estado WHERE k = ?', k).toArray()[0];
    if (!r) return null;
    try { return JSON.parse(r.v); } catch (e) { return null; }
  }

  guardar(k, v) {
    this.sql.exec('INSERT INTO estado (k, v) VALUES (?, ?) ' +
      'ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, JSON.stringify(v));
  }

  async fetch(req) {
    const ruta = new URL(req.url).pathname;
    try {
      if (ruta === '/vigilar') return json(await this.vigilar(await req.json()));
      if (ruta === '/estado') return json(this.estado(), 200, 20);
      const d = await req.json().catch(() => null);
      if (!d) return json({ error: 'no es JSON' }, 400);
      if (ruta === '/alta') return this.alta(d);
      if (ruta === '/baja') return this.baja(d);
      if (ruta === '/probar') return this.probar(d);
      if (ruta === '/simular') return this.simular();
      if (ruta === '/vincular') return this.vincular(d);
      if (ruta === '/desvincular') return this.desvincular(d);
      if (ruta === '/disparo') {
        if (d.cual !== 'arranco' && d.cual !== 'ultimo') return json({ error: 'no existe' }, 404);
        this.guardar('disparo_' + d.cual, d.v || {});
        return json({ ok: true });
      }
      return json({ error: 'no existe' }, 404);
    } catch (e) {
      this.guardar('ultimo_error', { t: Date.now(), ruta, error: String(e).slice(0, 200) });
      return json({ error: 'falló adentro' }, 500);
    }
  }

  // ── los canales ──────────────────────────────────────────────────────
  //
  // ⚠️ SE BUSCAN POR NOMBRE, COMO EN `anuncios.canales()`, y no se piden.
  // Una lista de IDs escrita a mano envejece sola: el día que un servidor
  // renombra o mueve su canal, el lector deja de leer y no falla.
  async descubrir(servidores, ahora) {
    const lista = [];
    let sinAcceso = 0;
    // 🔴 SÓLO LOS SERVIDORES DE LA LIGA. Dlx, 25/09/2026, después de una
    // alerta por un canal de TFC: «Olvida TFC, ya te dije que no está». La
    // lista es `confirmado` de `datos/servidores.json`, que viaja en `meta`
    // (`liga`); sin ella —una `meta` vieja— se escucha lo de siempre.
    try {
      const liga = (JSON.parse((await this.env.KV.get('meta')) || '{}').liga) || null;
      if (Array.isArray(liga) && liga.length) {
        servidores = (servidores || []).filter((s) => liga.indexOf(s.sv) >= 0);
      }
    } catch (e) { /* sin meta, la lista entera */ }
    // 🔴 QUIÉN SOY, PARA NO LEERME. El bot publica en `eventos-hoy`, que es
    // también un canal que este vigía escucha: sin esto, su propia
    // re-publicación podría volver a entrar como anuncio nuevo.
    let yo = '';
    try {
      const r = await fetch(`${DC}/users/@me`, {
        headers: { Authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'User-Agent': UA },
      });
      if (r.status === 200) yo = (await r.json()).id || '';
    } catch (e) { yo = ''; }
    for (const s of servidores || []) {
      if (!s.guild) continue;
      const r = await fetch(`${DC}/guilds/${s.guild}/channels`, {
        headers: { Authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'User-Agent': UA },
      });
      if (r.status !== 200) { sinAcceso++; continue; }
      for (const c of await r.json()) {
        if (c.type !== 0 && c.type !== 5) continue;
        // 🔴 NORMALIZADO, O LAS LETRAS DECORADAS NO MATCHEAN. Urban Freestyle
        // (25/09/2026) llama a su canal «「🏆」𝙀𝙫𝙚𝙣𝙩𝙤𝙨»: son letras matemáticas
        // (U+1D400 y siguientes), no «Eventos», y /evento/ no las encuentra.
        // No falla: el servidor queda sin avisos y nadie se entera. NFKD las
        // vuelve letras comunes, como en `anuncios.py`.
        const n = (c.name || '').normalize('NFKD');
        // los de staff también dicen «evento», y el bot los lee
        if (STAFF.test(n) || PATRON_INSC.test(n) || !PATRON_VIGIA.test(n)) continue;
        lista.push({ id: c.id, nombre: n, sv: s.sv, svn: s.nombre || s.sv, g: s.guild });
      }
    }
    const canales = { t: ahora, v: CANALES_V, yo, lista, sin_acceso: sinAcceso };
    // ⚠️ UNA BUSQUEDA QUE NO ENCONTRO NADA NO PISA A UNA QUE SÍ. Si Discord
    // contestó mal a todo, quedarse sin canales es dejar de avisar callado.
    const antes = this.leer('canales');
    if (!lista.length && antes && antes.lista && antes.lista.length) {
      antes.t = ahora;
      antes.fallo = 'la última búsqueda no encontró canales';
      this.guardar('canales', antes);
      return antes;
    }
    this.guardar('canales', canales);
    return canales;
  }

  // ── el latido ────────────────────────────────────────────────────────
  async vigilar(d) {
    const ahora = Date.now();
    if (!this.env.DISCORD_TOKEN) {
      this.guardar('vigia', { t: ahora, error: 'el Worker no tiene DISCORD_TOKEN' });
      return { ok: false };
    }
    // 🔴 SI DISCORD DICE 401, SE PARA UNA HORA. Un token revocado haría
    // 4.320 pedidos rechazados por día, y Discord banea la IP por pedidos
    // inválidos — la IP de Cloudflare, compartida con el resto del bot.
    const previo = this.leer('vigia') || {};
    if (previo.pausa && ahora < previo.pausa) return { ok: false, pausa: true };

    let canales = this.leer('canales');
    if (!canales || !canales.lista || !canales.lista.length ||
        canales.v !== CANALES_V || ahora - (canales.t || 0) > REDESCUBRIR) {
      canales = await this.descubrir(d && d.servidores, ahora);
    }
    this.yo = canales.yo || '';
    this.dueno = (d && d.dueno) || '';
    let leidos = 0, nuevos = 0, pausa = 0;
    const errores = [];
    // ⚠️ LOS CANALES SE PIDEN A LA VEZ, NO UNO DETRAS DEL OTRO. La primera
    // corrida encontró 14 —la búsqueda por nombre es la misma de
    // `anuncios.canales()`, así que el vigía escucha lo mismo que el hub
    // muestra— y en fila eran ~2 s por minuto esperando a Discord. Cada
    // canal es otro bucket de su límite, así que no se pisan.
    const respuestas = await Promise.all((canales.lista || []).map(async (c) => {
      try {
        const r = await fetch(`${DC}/channels/${c.id}/messages?limit=10`, {
          headers: { Authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'User-Agent': UA },
        });
        return { c, estado: r.status, msgs: r.status === 200 ? await r.json() : null };
      } catch (e) {
        return { c, estado: 0, msgs: null };
      }
    }));
    // 🔴 UN 403 NO ES UNA FALLA DEL VIGÍA: es un canal que ese servidor no le
    // deja leer al bot. Con los nombres normalizados (25/09/2026) apareció
    // «🎉│EVENTOS» de TFC, que antes no se reconocía, y el vigía lo contaba
    // como error cada minuto: `ok` en falso y una alerta a Dlx por algo que
    // no se arregla acá. Se saca de la lista hasta el próximo redescubrimiento
    // y queda anotado en `sin_leer`, para que se vea cuál es.
    const sinLeer = [];
    for (const { c, estado, msgs } of respuestas) {
      if (estado === 401) { pausa = ahora + HORA; continue; }
      if (estado === 403) { sinLeer.push(c); continue; }
      if (!msgs) { errores.push(`${c.sv} ${c.nombre}: ${estado || 'sin red'}`); continue; }
      leidos += msgs.length;
      for (const m of msgs) if (this.anotar(m, c, ahora)) nuevos++;
    }
    if (pausa) errores.push('401: el token no sirve; se reintenta en una hora');
    if (sinLeer.length) {
      const fuera = sinLeer.map((c) => c.id);
      canales.lista = (canales.lista || []).filter((c) => fuera.indexOf(c.id) < 0);
      canales.sin_leer = (canales.sin_leer || []).concat(sinLeer.map((c) => `${c.sv} ${c.nombre}`))
        .filter((x, i, t) => t.indexOf(x) === i);
      this.guardar('canales', canales);
    }
    if (this.dmPrueba) {
      const p = this.dmPrueba;
      this.dmPrueba = null;
      await this.avisarDueno(p);
    }
    // la re-publicación en `eventos-hoy` va en el mismo minuto
    if (!pausa) await this.publicar(ahora);
    // lo avisado se guarda dos días: alcanza para no repetir y no crece
    if (!previo.limpio || ahora - previo.limpio > HORA) {
      this.sql.exec('DELETE FROM avisos WHERE creado < ?', ahora - 2 * 24 * HORA);
      this.sql.exec('DELETE FROM claves WHERE t < ?', ahora - 2 * 24 * HORA);
      this.sql.exec('DELETE FROM posts WHERE creado < ?', ahora - 7 * 24 * HORA);
    }
    this.guardar('vigia', {
      t: ahora, canales: (canales.lista || []).length, leidos, nuevos, errores,
      pausa: pausa || undefined,
      limpio: (!previo.limpio || ahora - previo.limpio > HORA) ? ahora : previo.limpio,
    });
    if (nuevos) await this.despertar(ahora);
    // 🔑 los avisos de cada uno. Nunca frena al vigía: ver `personales()`
    try { await this.personales(ahora); } catch (e) {
      this.guardar('personales', { t: ahora, error: String(e).slice(0, 120) });
    }
    return { ok: !errores.length, leidos, nuevos, errores };
  }

  /** ¿Hay que avisar este mensaje? Lo anota y dice si era nuevo. */
  anotar(m, c, ahora) {
    const publicado = Date.parse(String(m.timestamp || '').slice(0, 19) + 'Z');
    if (Number.isNaN(publicado) || ahora - publicado > EDAD_MAX) return false;
    // ⚠️ ANTES DE LEERLO, ¿YA ESTA? Cada minuto se vuelven a pedir los
    // mismos diez mensajes; parsear los diez es gastar CPU en nada.
    // 🔴 SALVO QUE SE HAYA EDITADO DESPUÉS DE DESCARTARLO. Ver `releer()`.
    const fila = this.sql.exec('SELECT estado, hasta, cuerpo FROM avisos WHERE id = ?',
      m.id).toArray()[0];
    if (!releer(fila, m)) return false;
    if (fila) this.sql.exec('DELETE FROM avisos WHERE id = ?', m.id);
    // lo que publicó el propio bot —la re-publicación de `eventos-hoy`— no
    // es un anuncio: es el eco de uno
    if (this.yo && m.author && m.author.id === this.yo) return false;
    // lo que no se avisa se anota igual —vacío y cerrado— para no volver
    // a leerlo en el minuto siguiente
    const descartar = () => {
      this.sql.exec('INSERT OR IGNORE INTO avisos (id, sv, cuerpo, desde, hasta, ' +
        'creado, estado) VALUES (?, ?, ?, ?, ?, ?, 2)', m.id, c.sv, marcaDescarte(m),
      0, 0, ahora);
      return false;
    };
    const a = parsearAnuncio(m);
    // 🧪 LA PRUEBA DE DLX, DESDE UN CANAL DE VERDAD. El 25/09/2026 escribió
    // «Probando…» en los eventos de FFA para ver si le llegaba el aviso, y
    // no le llegó nada — con razón: no es un anuncio, y lo que no tiene
    // forma de anuncio no le suena el teléfono a nadie. Pero la prueba que
    // quería hacer es justo la que faltaba: la cadena entera, desde el
    // mensaje en Discord hasta el teléfono.
    //
    // ⚠️ SÓLO SUYO Y SÓLO A QUIEN ELIGIÓ «PRUEBAS» (`SV_PRUEBA`): el filtro
    // de `lote()` no se lo manda a nadie más, y no va a `eventos-hoy`.
    if (!a && this.dueno && m.author && m.author.id === this.dueno) {
      const txt = String(m.content || '').trim().toLowerCase();
      if (txt.startsWith('prueba') || txt.startsWith('probando')) {
        descartar();
        return this.prueba(c, m, ahora);
      }
    }
    if (!a) return descartar();
    const ini = momentoMs(a.horario, m.timestamp);
    // 🔴 LA REGLA: tarde es peor que nunca
    if (ini != null ? ini < ahora - GRACIA : ahora - publicado > EDAD_SIN_HORA) {
      return descartar();
    }
    // 🔴 EL MISMO EVENTO EN DOS CANALES AVISA UNA VEZ. `eventos-hoy` de DRA
    // junta eventos de toda la comunidad: si alguien copia ahí el anuncio
    // de FFA, son dos mensajes distintos del mismo evento. Se reconoce por
    // el nombre y la hora de arranque —redondeada a 10 minutos, porque
    // «EN 15» publicado con un minuto de diferencia da un minuto distinto—.
    const clave = a.nombre.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '') + '|' +
      (ini != null ? Math.round(ini / (10 * MIN)) : '');
    if (this.sql.exec('SELECT 1 FROM claves WHERE clave = ? AND t > ?', clave,
      ahora - EDAD_MAX).toArray().length) {
      return descartar();
    }
    this.sql.exec('INSERT OR REPLACE INTO claves (clave, id, t) VALUES (?, ?, ?)',
      clave, m.id, ahora);
    const cuerpo = {
      v: 1, tipo: 'evento', id: m.id, t: a.nombre, sv: c.sv, svn: c.svn, ini,
      mod: a.modalidad.slice(0, 60), cup: a.cupos.slice(0, 40),
      pre: a.premios.slice(0, 60),
      url: `https://discord.com/channels/${c.g}/${c.id}/${m.id}`,
    };
    const hasta = ini != null ? ini + GRACIA : publicado + EDAD_SIN_HORA;
    this.sql.exec('INSERT OR IGNORE INTO avisos (id, sv, cuerpo, desde, hasta, creado) ' +
      'VALUES (?, ?, ?, ?, ?, ?)', m.id, c.sv, JSON.stringify(cuerpo), ahora, hasta, ahora);
    // y a la cola de `eventos-hoy`, salvo que el anuncio haya salido de ahí
    if (c.id !== CANAL_RED) {
      this.sql.exec('INSERT OR IGNORE INTO posts (id, cuerpo, creado) VALUES (?, ?, ?)',
        m.id, JSON.stringify(cuerpo), ahora);
    }
    // 🔑 Y SI FALTA MAS DE UNA HORA, UN RECORDATORIO. Snake Rap anuncia
    // con horas —«INICIO DEL TORNEO: <t:…>»— y el aviso de las 12 del
    // mediodía no sirve de nada a las 4:30 de la tarde.
    if (ini != null && ini - ahora > RECORDAR_SI_FALTA) {
      this.sql.exec('INSERT OR IGNORE INTO avisos (id, sv, cuerpo, desde, hasta, ' +
        'creado) VALUES (?, ?, ?, ?, ?, ?)', m.id + ':antes', c.sv,
      JSON.stringify({ ...cuerpo, tipo: 'antes' }), ini - ANTES, ini + GRACIA, ahora);
    }
    return true;
  }

  /** 🧪 El aviso de una prueba de Dlx. Ver `anotar()`. */
  prueba(c, m, ahora) {
    const id = 'prueba:' + m.id;
    const cuerpo = {
      v: 1, tipo: 'evento', id, t: 'Prueba: leí tu mensaje', sv: SV_PRUEBA,
      svn: (c.svn || c.sv) + ' · ' + c.nombre, ini: null,
      mod: 'así te llega cada evento de verdad', cup: '', pre: '',
      url: `https://discord.com/channels/${c.g}/${c.id}/${m.id}`,
    };
    this.sql.exec('INSERT OR IGNORE INTO avisos (id, sv, cuerpo, desde, hasta, creado) ' +
      'VALUES (?, ?, ?, ?, ?, ?)', id, SV_PRUEBA, JSON.stringify(cuerpo), ahora,
    ahora + 15 * MIN, ahora);
    // 🔴 UNA PRUEBA QUE NO LLEGA TIENE QUE DECIR POR QUÉ. El 25/09/2026 Dlx
    // escribió «Probando…» dos veces y no le llegó nada, sin ninguna señal:
    // sus dispositivos se anotaron con «Todos», que a propósito NO incluye
    // las pruebas. Ahora el bot le contesta por DM qué leyó y a cuántos
    // dispositivos con 🧪 Pruebas lo mandó — y si son cero, cómo activarlo.
    const n = this.sql.exec('SELECT COUNT(*) AS n FROM subs WHERE instr(svs, ?) > 0',
      '|' + SV_PRUEBA + '|').toArray()[0].n;
    this.dmPrueba = { n, c, texto: String(m.content || '').trim().slice(0, 40), t: m.timestamp };
    return true;
  }

  /** El DM al dueño con el resultado de su prueba. Ver `prueba()`. */
  async avisarDueno(p) {
    if (!this.dueno || !this.env.DISCORD_TOKEN) return;
    const h = { Authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'User-Agent': UA,
      'content-type': 'application/json' };
    let hora = '';
    try {
      hora = new Date(Date.parse(p.t)).toLocaleTimeString('es-AR', {
        timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }) + ' ET';
    } catch (e) { hora = ''; }
    const donde = (p.c.svn || p.c.sv) + ' · ' + p.c.nombre;
    const texto = p.n
      ? `🧪 Leí tu «${p.texto}» en ${donde} (${hora}) y te la mandé a **${p.n} ` +
        `dispositivo${p.n === 1 ? '' : 's'}** con 🧪 Pruebas. Si en alguno no apareció, ` +
        'abrí ahí <https://underlegends.pages.dev/#/avisos> y tocá «Mandar una de ' +
        'prueba»: te dice si es el navegador o el sistema.'
      : `🧪 Leí tu «${p.texto}» en ${donde} (${hora}), pero **ningún dispositivo tiene ` +
        '🧪 Pruebas** marcado, así que no se la mandé a nadie. En cada dispositivo abrí ' +
        '<https://underlegends.pages.dev/#/avisos>, tocá «🧪 Pruebas» y volvé a escribir ' +
        '«probando».';
    try {
      const r = await fetch(`${DC}/users/@me/channels`, { method: 'POST', headers: h,
        body: JSON.stringify({ recipient_id: this.dueno }) });
      if (r.status !== 200) {
        this.guardar('ultimo_error', { t: Date.now(), ruta: 'dm-prueba', error: 'canal ' + r.status });
        return;
      }
      const ch = await r.json();
      const r2 = await fetch(`${DC}/channels/${ch.id}/messages`, { method: 'POST', headers: h,
        body: JSON.stringify({ content: texto, allowed_mentions: { parse: [] } }) });
      if (r2.status !== 200) {
        this.guardar('ultimo_error', { t: Date.now(), ruta: 'dm-prueba', error: 'mensaje ' + r2.status });
      }
    } catch (e) {
      this.guardar('ultimo_error', { t: Date.now(), ruta: 'dm-prueba', error: String(e).slice(0, 200) });
    }
  }

  /**
   * Lo que falta publicar en `eventos-hoy`, de a cinco por minuto.
   *
   * ⚠️ TRES INTENTOS Y MEDIA HORA COMO MUCHO, y nunca con el evento
   * empezado: la misma regla que las notificaciones —tarde es peor que
   * nunca—. Si Discord dice que no, queda anotado en `estado` por qué.
   */
  async publicar(ahora) {
    const pend = this.sql.exec('SELECT id, cuerpo FROM posts WHERE hecho = 0 AND ' +
      'intentos < 3 AND creado > ? ORDER BY creado LIMIT 5', ahora - 30 * MIN).toArray();
    for (const p of pend) {
      let c = null;
      try { c = JSON.parse(p.cuerpo); } catch (e) { c = null; }
      if (!c || (c.ini && c.ini < ahora - GRACIA)) {
        this.sql.exec('UPDATE posts SET hecho = 2 WHERE id = ?', p.id);
        continue;
      }
      let estado = 0, msg = '';
      try {
        const r = await fetch(`${DC}/channels/${CANAL_RED}/messages`, {
          method: 'POST',
          headers: {
            Authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'User-Agent': UA,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(mensajeRed(c)),
        });
        estado = r.status;
        if (estado === 200) msg = (await r.json()).id || '';
        else msg = (await r.text()).slice(0, 160);
      } catch (e) {
        msg = String(e).slice(0, 160);
      }
      if (estado === 200) {
        this.sql.exec('UPDATE posts SET hecho = 1, msg = ? WHERE id = ?', msg, p.id);
      } else {
        this.sql.exec('UPDATE posts SET intentos = intentos + 1, error = ? WHERE id = ?',
          `${estado} ${msg}`.slice(0, 200), p.id);
      }
    }
  }

  async despertar(ahora) {
    const r = this.sql.exec('SELECT MIN(desde) AS d FROM avisos WHERE estado = 0')
      .toArray()[0];
    if (!r || r.d == null) return;
    const cuando = Math.max(ahora, r.d);
    const hay = await this.state.storage.getAlarm();
    if (hay == null || hay > cuando) await this.state.storage.setAlarm(cuando);
  }

  // ── el envío ─────────────────────────────────────────────────────────
  //
  // ⚠️ POR ALARMAS Y NO EN EL MISMO PEDIDO. Cada alarma es una invocación
  // nueva, con sus propios 50 subpedidos: la alarma manda un lote y, si
  // quedan, se vuelve a poner. 1.000 suscripciones son 50 alarmas seguidas
  // de ~1 s. Y si una alarma revienta, Cloudflare la reintenta sola.
  async alarm() {
    const ahora = Date.now();
    const av = this.sql.exec('SELECT * FROM avisos WHERE estado = 0 AND desde <= ? ' +
      'ORDER BY desde LIMIT 1', ahora).toArray()[0];
    if (av) {
      try {
        await this.lote(av, ahora);
      } catch (e) {
        // 🔴 UN AVISO QUE REVIENTA SE CIERRA. Si quedara pendiente, la
        // alarma se volvería a poner al instante con el mismo aviso, y así
        // para siempre: un bucle que gasta los 100.000 pedidos del día.
        this.sql.exec('UPDATE avisos SET estado = 3 WHERE id = ?', av.id);
        this.guardar('ultimo_error', { t: ahora, ruta: 'alarm', id: av.id,
          error: String(e).slice(0, 200) });
      }
    }
    await this.despertar(Date.now());
  }

  async lote(av, ahora) {
    // 🔴 VENCIDO NO SE MANDA. Si el Worker estuvo caído y el evento ya
    // empezó, el aviso se descarta en vez de llegar tarde.
    if (ahora > av.hasta) {
      this.sql.exec('UPDATE avisos SET estado = 2 WHERE id = ?', av.id);
      return;
    }
    const subs = this.sql.exec('SELECT id, endpoint, p256dh, auth FROM subs ' +
      // «todos» ('') recibe todo MENOS el servidor de prueba
      "WHERE id > ? AND ((svs = '' AND ? != ?) OR instr(svs, ?) > 0) ORDER BY id LIMIT ?",
    av.cursor, av.sv, SV_PRUEBA, '|' + av.sv + '|', LOTE).toArray();
    if (!subs.length) {
      this.sql.exec('UPDATE avisos SET estado = 1 WHERE id = ?', av.id);
      this.guardar('ultimo_aviso', { t: ahora, id: av.id, sv: av.sv,
        enviados: av.enviados, fallos: av.fallos });
      return;
    }
    // ⚠️ EL TTL ES LO QUE FALTA PARA QUE VENZA. Si el teléfono está
    // apagado y se prende con el evento terminado, el servicio de push lo
    // tira: la notificación no llega tarde, no llega.
    const ttl = Math.max(60, Math.min(Math.floor((av.hasta - ahora) / 1000), 12 * 3600));
    const opc = { ttl, topic: 'ev' + av.id.replace(/\D/g, '').slice(-20) };
    const jwts = new Map();
    const detalle = [];
    let estados = await Promise.all(
      subs.map((s) => empujar(s, av.cuerpo, opc, this.env, jwts, detalle)));
    // un reintento para lo que falló por el otro lado (0, 429, 5xx)
    const otra = estados.map((e, i) => (e === 0 || e === 429 || e >= 500 ? i : -1))
      .filter((i) => i >= 0);
    if (otra.length) {
      const re2 = await Promise.all(
        otra.map((i) => empujar(subs[i], av.cuerpo, opc, this.env, jwts, detalle)));
      estados = estados.slice();
      otra.forEach((i, j) => { estados[i] = re2[j]; });
    }
    let ok = 0, mal = 0;
    this.state.storage.transactionSync(() => {
      estados.forEach((e, i) => {
        const s = subs[i];
        if (e >= 200 && e < 300) {
          ok++;
          this.sql.exec('UPDATE subs SET enviados = enviados + 1 WHERE id = ?', s.id);
        } else if (MUERTA(e)) {
          mal++;
          this.sql.exec('DELETE FROM subs WHERE id = ?', s.id);
        } else {
          mal++;
          this.sql.exec('UPDATE subs SET fallos = fallos + 1 WHERE id = ?', s.id);
        }
      });
      this.sql.exec('UPDATE avisos SET cursor = ?, enviados = enviados + ?, ' +
        'fallos = fallos + ? WHERE id = ?', subs[subs.length - 1].id, ok, mal, av.id);
    });
    if (mal) {
      this.guardar('ultimo_fallo', { t: ahora, id: av.id,
        estados: estados.filter((e) => !(e >= 200 && e < 300)).slice(0, 10),
        detalle: detalle.slice(0, 6) });
    }
  }

  // ── la gente ─────────────────────────────────────────────────────────
  alta(d) {
    const sub = d.sub || {};
    const mal = suscripcionValida(sub);
    if (mal) return json({ error: mal }, 400);
    const svs = Array.isArray(d.svs)
      ? d.svs.map((x) => String(x).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6))
        .filter(Boolean).slice(0, 12)
      : null;
    const ahora = Date.now();
    const texto = svs && svs.length ? '|' + svs.join('|') + '|' : '';
    // 🔑 `anterior`: el navegador cambió la suscripción por su cuenta
    // (`pushsubscriptionchange`). Se reemplaza la fila vieja y se
    // conservan sus servidores elegidos.
    if (d.anterior && typeof d.anterior === 'string') {
      const vieja = this.sql.exec('SELECT id FROM subs WHERE endpoint = ?', d.anterior)
        .toArray()[0];
      if (vieja) {
        this.sql.exec('DELETE FROM subs WHERE endpoint = ? AND id != ?', sub.endpoint, vieja.id);
        this.sql.exec('UPDATE subs SET endpoint = ?, p256dh = ?, auth = ?, visto = ?' +
          (svs ? ', svs = ?' : '') + ' WHERE id = ?',
        ...[sub.endpoint, sub.keys.p256dh, sub.keys.auth, ahora]
          .concat(svs ? [texto] : [], [vieja.id]));
        return json({ ok: true, svs: this.svsDe(sub.endpoint) });
      }
    }
    const hay = this.sql.exec('SELECT svs FROM subs WHERE endpoint = ?', sub.endpoint)
      .toArray()[0];
    if (!hay) {
      const n = this.sql.exec('SELECT COUNT(*) AS n FROM subs').toArray()[0].n;
      if (n >= TOPE_SUBS) return json({ error: 'lleno' }, 503);
    }
    this.sql.exec('INSERT INTO subs (endpoint, p256dh, auth, svs, alta, visto) ' +
      'VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET ' +
      'p256dh = excluded.p256dh, auth = excluded.auth, visto = excluded.visto' +
      (svs ? ', svs = excluded.svs' : ''),
    sub.endpoint, sub.keys.p256dh, sub.keys.auth, texto, ahora, ahora);
    return json({ ok: true, svs: this.svsDe(sub.endpoint) });
  }

  /** Este dispositivo es de esta persona. Sólo lo llama `rutaAvisos`, con el ID de Discord. */
  vincular(d) {
    if (typeof d.endpoint !== 'string' || !/^[0-9]{5,25}$/.test(String(d.quien || ''))) {
      return json({ error: 'faltan datos' }, 400);
    }
    const r = this.sql.exec('UPDATE subs SET quien = ? WHERE endpoint = ?', String(d.quien), d.endpoint);
    if (!r.rowsWritten) return json({ error: 'esa suscripción no está anotada' }, 404);
    return json({ ok: true });
  }

  desvincular(d) {
    if (typeof d.endpoint !== 'string') return json({ error: 'falta el endpoint' }, 400);
    this.sql.exec("UPDATE subs SET quien = '' WHERE endpoint = ?", d.endpoint);
    return json({ ok: true });
  }

  /**
   * La cola de avisos personales que dejó el ciclo en KV.
   *
   * ⚠️ CADA UNO SALE UNA VEZ: se anota en `hechos` ANTES de mandarlo, así
   * una cola que no se pudo borrar —o que el ciclo reescribió con lo viejo
   * adentro— no vuelve a sonar.
   *
   * ⚠️ SIN VÍNCULO NO HAY AVISO: la cola lleva el Discord ID y sólo le llega
   * a los dispositivos que esa persona vinculó. El resto se descarta.
   */
  async personales(ahora) {
    const crudo = await this.env.KV.get(COLA_PERSONAL);
    if (!crudo) return 0;
    const cola = colaPersonal(crudo);
    let enviados = 0, sinVinculo = 0;
    for (const a of cola) {
      const id = 'yo:' + a.id;
      if (this.sql.exec('SELECT id FROM hechos WHERE id = ?', id).toArray()[0]) continue;
      this.sql.exec('INSERT OR IGNORE INTO hechos (id, t) VALUES (?, ?)', id, ahora);
      const subs = this.sql.exec('SELECT id, endpoint, p256dh, auth FROM subs WHERE quien = ?',
        String(a.quien)).toArray();
      if (!subs.length) { sinVinculo++; continue; }
      const cuerpo = cuerpoPersonal(a);
      const estados = await Promise.all(subs.map((s) => empujar(s, cuerpo,
        { ttl: 24 * 3600, topic: 'yo' + String(a.id).replace(/[^A-Za-z0-9]/g, '').slice(-20) },
        this.env, new Map())));
      estados.forEach((e, i) => {
        if (e >= 200 && e < 300) enviados++;
        else if (MUERTA(e)) this.sql.exec('DELETE FROM subs WHERE id = ?', subs[i].id);
      });
    }
    this.sql.exec('DELETE FROM hechos WHERE t < ?', ahora - 30 * 24 * HORA);
    try { await this.env.KV.delete(COLA_PERSONAL); } catch (e) { /* `hechos` evita repetir */ }
    this.guardar('personales', { t: ahora, cola: cola.length, enviados, sin_vinculo: sinVinculo });
    return enviados;
  }

  /** Para `estado()`. ⚠️ Con try: si esto fallara, `/avisos/estado` daría 500
   * y `bot/alertar.py` leería al vigía como caído. */
  estadoPersonales() {
    try {
      return {
        vinculados: this.sql.exec("SELECT COUNT(*) AS n FROM subs WHERE quien != ''").toArray()[0].n,
        ultima: this.leer('personales'),
      };
    } catch (e) {
      return { error: String(e).slice(0, 80) };
    }
  }

  svsDe(endpoint) {
    const r = this.sql.exec('SELECT svs FROM subs WHERE endpoint = ?', endpoint).toArray()[0];
    return r ? r.svs.split('|').filter(Boolean) : [];
  }

  baja(d) {
    if (typeof d.endpoint !== 'string') return json({ error: 'falta el endpoint' }, 400);
    this.sql.exec('DELETE FROM subs WHERE endpoint = ?', d.endpoint);
    return json({ ok: true });
  }

  async probar(d) {
    const s = typeof d.endpoint === 'string' && this.sql.exec(
      'SELECT id, endpoint, p256dh, auth, prueba FROM subs WHERE endpoint = ?', d.endpoint)
      .toArray()[0];
    if (!s) return json({ error: 'esa suscripción no está anotada' }, 404);
    const ahora = Date.now();
    if (ahora - s.prueba < 30 * 1000) return json({ error: 'esperá unos segundos' }, 429);
    this.sql.exec('UPDATE subs SET prueba = ? WHERE id = ?', ahora, s.id);
    const estado = await empujar(s, JSON.stringify({ v: 1, tipo: 'prueba', t: 'Avisos activados' }),
      { ttl: 300, urgencia: 'high' }, this.env, new Map());
    if (MUERTA(estado)) this.sql.exec('DELETE FROM subs WHERE id = ?', s.id);
    return json({ ok: estado >= 200 && estado < 300, estado });
  }

  /**
   * Un anuncio de mentira del servidor de prueba, por el camino de verdad:
   * la cola, la alarma, el lote, el filtro, el TTL. `probar()` manda
   * directo y no pasa por nada de eso.
   *
   * ⚠️ UNO CADA CINCO MINUTOS COMO MUCHO, por el id. Cualquiera puede
   * llamarlo, pero sólo le llega a quien eligió `ZZZ` a mano, y no más
   * seguido que esto.
   */
  async simular() {
    const ahora = Date.now();
    const id = 'sim:' + Math.floor(ahora / CADA_SIMULACRO);
    const cuerpo = {
      v: 1, tipo: 'evento', id, t: 'PRUEBA DEL VIGIA', sv: SV_PRUEBA, svn: 'Prueba',
      ini: ahora + 15 * MIN, mod: '1vs1', cup: '16', pre: '', url: HUB + '/#/avisos',
    };
    const antes = this.sql.exec('SELECT 1 FROM avisos WHERE id = ?', id).toArray().length;
    if (antes) return json({ error: 'ya hubo uno en estos cinco minutos' }, 429);
    this.sql.exec('INSERT INTO avisos (id, sv, cuerpo, desde, hasta, creado) ' +
      'VALUES (?, ?, ?, ?, ?, ?)', id, SV_PRUEBA, JSON.stringify(cuerpo), ahora,
    ahora + 15 * MIN, ahora);
    await this.despertar(ahora);
    return json({ ok: true, id });
  }

  // ── lo que se puede preguntar desde afuera ───────────────────────────
  //
  // ⚠️ SIN UN SOLO ENDPOINT. Cuántos, cuándo y qué; nunca a quién.
  estado() {
    const ahora = Date.now();
    const v = this.leer('vigia') || {};
    const c = this.leer('canales') || {};
    // ⚠️ SIN LO DE PRUEBA: ni los dispositivos de `probar_avisos.py` ni
    // sus simulacros. La página muestra «último aviso» y «N dispositivos»,
    // y un «PRUEBA DEL VIGIA» ahí sería mentirle a quien mira.
    const n = this.sql.exec("SELECT COUNT(*) AS n FROM subs WHERE svs != ?",
      '|' + SV_PRUEBA + '|').toArray()[0].n;
    const dia = this.sql.exec("SELECT COUNT(*) AS n, COALESCE(SUM(enviados), 0) AS e " +
      "FROM avisos WHERE creado > ? AND cuerpo != '{}' AND sv != ?",
    ahora - 24 * HORA, SV_PRUEBA).toArray()[0];
    const ult = this.sql.exec("SELECT id, sv, cuerpo, creado, estado, enviados, fallos " +
      "FROM avisos WHERE cuerpo != '{}' AND sv != ? ORDER BY creado DESC LIMIT 1",
    SV_PRUEBA).toArray()[0];
    let tit = '';
    try { tit = ult ? JSON.parse(ult.cuerpo).t || '' : ''; } catch (e) { tit = ''; }
    // ⚠️ EL ULTIMO ERROR SE MUESTRA, no sólo se guarda. Un error que se
    // anota donde nadie lo puede leer es un error callado con más pasos.
    const err = this.leer('ultimo_error');
    const fallo = this.leer('ultimo_fallo');
    // 🔑 POR SERVICIO DE PUSH, SIN UN SOLO ENDPOINT: cuántos de Google
    // (Chrome, Edge, Samsung, Opera), de Mozilla, de Apple, de Windows.
    // Nació con Opera GX, que se anota y no recibe: así se ve por dónde
    // entró cada navegador sin saber de quién es.
    const servicios = {};
    for (const r of this.sql.exec('SELECT endpoint FROM subs WHERE svs != ?',
      '|' + SV_PRUEBA + '|').toArray()) {
      let h = 'otro';
      try { h = new URL(r.endpoint).hostname; } catch (e) { h = 'otro'; }
      const k = /googleapis/.test(h) ? 'google' : /mozilla/.test(h) ? 'mozilla'
        : /apple/.test(h) ? 'apple' : /windows/.test(h) ? 'windows' : 'otro';
      servicios[k] = (servicios[k] || 0) + 1;
    }
    const post = this.sql.exec('SELECT hecho, msg, error, creado FROM posts ' +
      'ORDER BY creado DESC LIMIT 1').toArray()[0];
    // 🔑 LAS PRUEBAS, APARTE: cuántos dispositivos las reciben y cómo salió la
    // última. Sin esto, una prueba que no llega no deja rastro (25/09/2026).
    const conPrueba = this.sql.exec('SELECT COUNT(*) AS n FROM subs WHERE instr(svs, ?) > 0',
      '|' + SV_PRUEBA + '|').toArray()[0].n;
    const up = this.sql.exec('SELECT creado, estado, enviados, fallos FROM avisos ' +
      'WHERE sv = ? ORDER BY creado DESC LIMIT 1', SV_PRUEBA).toArray()[0];
    return {
      servicios,
      pruebas: {
        dispositivos: conPrueba,
        ultima: up ? { t: new Date(up.creado).toISOString(), estado: up.estado,
          enviados: up.enviados, fallos: up.fallos } : null,
      },
      ultima_republicacion: post ? { t: new Date(post.creado).toISOString(),
        ok: post.hecho === 1, error: post.error || '' } : null,
      ultimo_error: err ? { t: new Date(err.t).toISOString(), ruta: err.ruta, error: err.error } : null,
      ultimo_fallo: fallo ? { t: new Date(fallo.t).toISOString(), estados: fallo.estados,
        detalle: fallo.detalle || [] } : null,
      ok: !!v.t && ahora - v.t < 5 * MIN && !(v.errores || []).length,
      cron: CRON_VIGIA,
      // 🔑 EL DISPARADOR DEL CICLO: cuándo arrancó y cómo le fue al último
      // intento. Lo lee `bot/alertar.py`. Ver `marcarDisparo()`.
      disparador: {
        arranco: this.leer('disparo_arranco'),
        ultimo: this.leer('disparo_ultimo'),
      },
      vigia: {
        t: v.t ? new Date(v.t).toISOString() : null,
        hace_s: v.t ? Math.round((ahora - v.t) / 1000) : null,
        leidos: v.leidos || 0, errores: v.errores || [], error: v.error || '',
        pausa: v.pausa ? new Date(v.pausa).toISOString() : null,
        canales: (c.lista || []).map((x) => ({ sv: x.sv, svn: x.svn, nombre: x.nombre })),
        // los que el servidor no le deja leer al bot: no son una falla
        sin_leer: c.sin_leer || [],
      },
      suscripciones: n,
      // 🔑 los avisos de cada uno: cuántos dispositivos están vinculados a
      // una persona y cómo salió la última cola
      personales: this.estadoPersonales(),
      ultimas_24h: { avisos: dia.n, enviados: dia.e },
      ultimo: ult ? {
        t: new Date(ult.creado).toISOString(), sv: ult.sv, titulo: tit,
        enviados: ult.enviados, fallos: ult.fallos,
        estado: ['pendiente', 'enviado', 'vencido'][ult.estado] || '',
      } : null,
    };
  }
}
