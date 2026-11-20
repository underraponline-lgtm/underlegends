/**
 * 🧭 /setup — EL PASO A PASO DE UN SERVIDOR QUE ENTRA A LA LIGA (19/11/2026).
 *
 * Dlx, 19/11/2026, a la maqueta del /setup: «tus elecciones» (1A 2A 3A 4A 5A). O sea:
 *   1 · lo corren los admins del servidor (Gestionar servidor), y se vuelve a preguntar en cada clic;
 *   2 · NO crea canales ni roles: lo único que crea es la invitación permanente de la Liga a ese servidor;
 *   3 · tres plantillas: «Liga completa», «Lo básico» y «Sólo leer» (para los que tienen miedo de un bot de raid);
 *   4 · los puntos de Temporada los aprueba Dlx: al terminar le llega un DM (sólo a él) con «Que sumen · Tier 3» y
 *       «Todavía no», y lo mismo en su Dashboard. El servidor ve «Puntos de Temporada: en revisión»;
 *   5 · el anti-raid NO es un paso: el cierre nombra `/antiraid`.
 *
 * 🔑 UN SOLO MENSAJE EFÍMERO, CON COMPONENTES V2, QUE SE EDITA EN EL LUGAR. Cada clic contesta «tipo 6» (lo edito
 * después) y la vuelta se hace con el token de ESE clic, así que el mensaje sigue andando pasados los 15 minutos del
 * comando. El estado viaja en dos lados, a propósito:
 *   · el `custom_id` (`su:v1:<acción>[:<dato>]`, ≤ 100 letras): QUÉ se tocó. La `v1` es para poder cambiar la forma sin
 *     que un mensaje viejo haga otra cosa: uno de otra versión dice «vuelve a correr /setup»;
 *   · un borrador por servidor EN EL OBJETO (tabla `setup`, `setupOp()` en avisos.js), NO en KV: KV son ~1.000
 *     escrituras por día para toda la cuenta y un setup son quince clics. Lo aplicado se guarda en la misma fila
 *     (`hecho`) y KV se escribe UNA vez, al «Aplicar» (`cfg:<guild>`, el mismo de /settings y del panel del socio).
 *
 * ⚠️ NADA CAMBIA EN EL SERVIDOR HASTA EL PASO 5. Los pasos 1 a 4 sólo leen (permisos, roles, canales) y guardan el
 * borrador. «Aplicar» hace todo de una, y se puede reintentar sin duplicar: los mensajes de prueba y la invitación se
 * anotan en el objeto, la invitación se pide con `unique: false` (Discord devuelve la que ya hay) y el DM a Dlx sale
 * una sola vez por servidor (`dm` en `setupOp()`).
 *
 * ⚠️ ESTE ARCHIVO NO GUARDA NADA FUERA DE LAS FUNCIONES (la regla de worker.js): todo lo de un pedido viaja por argumento.
 *
 * Lo puro (plantillas, canales, permisos, ids, cada pantalla) se prueba sin Discord en `bot/setup_prueba.mjs`, que
 * además mide cada pantalla contra los topes de Discord: 40 componentes, 4.000 letras de texto, ids de 100.
 */
import { DUENO, APP_ID, NIVELES_CHAT, CFG_BASE, chatGeneralDe, categoriasStaff, PATRON_VIGIA, PATRON_INSC, STAFF,
  PATRON_VEREDICTOS, NO_VEREDICTOS, conNuevos } from './avisos.js';
// 🧱 las piezas V2 (el texto, el separador, el recuadro, la miniatura, la sección) y los colores de la marca viven en
// `bot/vista.js` desde el 20/11/2026: el resto del bot pasó a V2 con las mismas. Las de acá eran idénticas
import { T, SEP, caja, mini, seccion, COLOR } from './vista.js';

const API = 'https://discord.com/api/v10';
const UA = 'DiscordBot (https://underlegends.pages.dev, 1)';
const HUB = 'https://underlegends.pages.dev';
export const V2 = 1 << 15;
const EFIMERO = 1 << 6;
export const VERSION = 'v1';
//: los topes de Discord para un mensaje con componentes V2 (los mide `medir()`)
export const TOPES = { componentes: 40, letras: 4000, id: 100 };
//: un borrador que nadie tocó en una semana ya no se ofrece para retomar
export const BORRADOR_VIVE = 7 * 24 * 3600e3;

// ── 🔐 LOS PERMISOS, EN BigInt (el bitfield de Discord pasa de 2^53) ───────────────────────────────────────────────────
export const P = {
  INVITAR: 1n, ADMIN: 8n, SERVIDOR: 32n, VER: 1024n, ENVIAR: 2048n, LINKS: 16384n, ADJUNTAR: 32768n,
  HISTORIAL: 65536n, APODOS: 1n << 27n, EVENTOS: 1n << 33n,
};
const TODO = (1n << 60n) - 1n;
const big = (x) => { try { return BigInt(x || '0'); } catch (e) { return 0n; } };
const tiene = (bits, p) => (big(bits) & p) === p;

/** ¿Quien toca puede correr el setup? El dueño (Discord le da todos los bits), Administrador o Gestionar servidor. El
 *  `member.permissions` de la interacción ya viene CALCULADO por Discord: no hace falta preguntar nada. */
export function puedeSetup(i) {
  const p = big(i && i.member && i.member.permissions);
  return (p & P.ADMIN) !== 0n || (p & P.SERVIDOR) !== 0n;
}

/** Los permisos del bot en el SERVIDOR (no en un canal): @everyone más sus roles. Administrador es todo. */
export function permisosBase(gid, roles, misRoles) {
  let p = 0n;
  const mios = new Set((misRoles || []).map(String));
  for (const r of roles || []) {
    if (String(r.id) === String(gid) || mios.has(String(r.id))) p |= big(r.permissions);
  }
  return (p & P.ADMIN) ? TODO : p;
}

/** Los permisos del bot en UN canal: los del servidor con las excepciones del canal encima (@everyone, sus roles, él).
 *  Es la cuenta de la documentación de Discord; sin «Ver canal» no tiene nada ahí. */
export function permisosEnCanal(base, canal, gid, misRoles, yo = APP_ID) {
  if ((base & P.ADMIN) || base === TODO) return TODO;
  let p = base;
  const ow = (canal && canal.permission_overwrites) || [];
  const tipo = (o) => (o.type === 1 || o.type === 'member' ? 1 : 0);
  const ev = ow.find((o) => String(o.id) === String(gid));
  if (ev) p = (p & ~big(ev.deny)) | big(ev.allow);
  const mios = new Set((misRoles || []).map(String));
  let a = 0n, d = 0n;
  for (const o of ow) {
    if (tipo(o) === 0 && mios.has(String(o.id))) { a |= big(o.allow); d |= big(o.deny); }
  }
  p = (p & ~d) | a;
  const m = ow.find((o) => tipo(o) === 1 && String(o.id) === String(yo));
  if (m) p = (p & ~big(m.deny)) | big(m.allow);
  return (p & P.VER) ? p : 0n;
}

/**
 * Lo que el bot tiene y le falta, con el para qué de cada cosa (paso 1). `perm` = `{bits, admin, arriba, rol}`:
 * los bits en el servidor, si es Administrador, cuántos roles tiene encima el suyo y cómo se llama su rol.
 * Devuelve `{filas: [[icono, título, para qué]], bloquea, falta}`: LEER EL HISTORIAL FRENA (sin eso no ve eventos ni
 * llaves); lo demás se puede saltear, y escribir sólo hace falta si la plantilla escribe.
 */
export function resumenPermisos(perm, pl) {
  const b = big(perm && perm.bits);
  const admin = !!(perm && perm.admin) || (b & P.ADMIN) !== 0n || b === TODO;
  const filas = [];
  const falta = [];
  const fila = (ok, t, para, opcional) => {
    filas.push([ok ? '✅' : (opcional ? '❌' : '🔴'), t, para + (opcional && !ok ? ' · opcional' : '')]);
    if (!ok) falta.push(t);
  };
  if (admin) {
    filas.push(['✅', 'Es Administrador', 'tiene todo lo que necesita']);
  } else {
    fila(tiene(b, P.VER | P.HISTORIAL), 'Ver canales y leer el historial', 'para encontrar tus eventos, llaves y veredictos', false);
    fila(pl === 'leer' || tiene(b, P.ENVIAR | P.LINKS | P.ADJUNTAR), 'Enviar mensajes y adjuntar',
      pl === 'leer' ? 'con «Sólo leer» no hace falta' : 'el bot en vivo, los avisos y /card', true);
    fila(tiene(b, P.INVITAR), 'Crear invitación', 'la invitación permanente de la Liga a tu servidor', true);
    fila(tiene(b, P.APODOS), 'Gestionar apodos', 'el #N del ranking en el apodo', true);
    fila(tiene(b, P.SERVIDOR), 'Gestionar servidor', 'contar quién entra por la invitación de la Liga', true);
    fila(tiene(b, P.EVENTOS), 'Gestionar eventos', 'los eventos de Discord de tus torneos', true);
  }
  const arriba = Number((perm && perm.arriba) || 0);
  if (arriba > 0) {
    filas.push(['⚠️', `El rol del bot tiene ${arriba} ${arriba === 1 ? 'rol' : 'roles'} encima`,
      `Ajustes del servidor → Roles: arrastra «${String((perm && perm.rol) || 'Liga Global').slice(0, 40)}» arriba de los ` +
      'roles de tu gente (si no, no les puede poner el #N)']);
  }
  return { filas, bloquea: !admin && !tiene(b, P.VER | P.HISTORIAL), falta, admin };
}

// ── 🧩 LAS TRES PLANTILLAS: lo que cada una pone en `cfg:<guild>` (las mismas claves de /settings y del panel) ─────────
export const PLANTILLAS = {
  completa: { et: 'Liga completa', emoji: '⭐',
    desc: 'en vivo en tu chat, avisos de rango, /card, #N en los apodos y aviso de cada evento' },
  basico: { et: 'Lo básico', emoji: '📋', desc: 'tus eventos y llaves cuentan, /card y avisos de rango; sin bot en vivo' },
  leer: { et: 'Sólo leer', emoji: '👁', desc: 'el bot lee tus anuncios y llaves y no escribe nada en tu servidor' },
};

/**
 * La configuración de una plantilla, con los canales del paso 3 (`c.ge`, el chat general). Sólo las claves que la
 * plantilla decide: las demás (el horario de silencio, el resumen de los lunes, el canal de una liga) quedan como estén.
 * ⚠️ «Sólo leer» apaga TODO lo que escribe solo en el servidor —también las batallas de liga, el resumen, el ascenso,
 * los eventos de Discord y la lectura diaria del chat general—: es la promesa de esa plantilla. Contestar un /card no es
 * escribir solo: eso lo pide alguien.
 */
export function cfgDePlantilla(pl, c) {
  const ge = String((c && c.ge) || '');
  if (pl === 'leer') {
    return { vivo: '', vivo_nivel: 'normal', avisos: '', nick: false, aviso_evento: 'no', canales: [], ganadores: false,
      ligas: 'no', resumen: '', ascenso: '', eventos_discord: false, leer_chat: false };
  }
  if (pl === 'basico') {
    return { vivo: '', vivo_nivel: 'normal', avisos: ge, nick: false, aviso_evento: 'no', canales: [], ganadores: false,
      ligas: 'no', leer_chat: true };
  }
  return { vivo: ge, vivo_nivel: 'normal', avisos: ge, nick: true, aviso_evento: '', canales: [], ganadores: true,
    ligas: '', leer_chat: true };
}

/** La configuración que queda: la de la plantilla con lo que se cambió en el paso 4 (`ov`) encima. */
export function cfgFinal(borr) {
  const b = borr || {};
  return Object.assign(cfgDePlantilla(b.pl || 'completa', b.c || {}), b.ov || {});
}

/** ¿El aviso de cada evento sale? '' va donde habla el bot en vivo (sin bot en vivo, a ningún lado), 'chat' al chat
 *  general, 'no' apagado (ver `canalesChat()` en avisos.js). */
export const avisoEventoPrendido = (cfg) => cfg.aviso_evento === 'chat' || (cfg.aviso_evento === '' && !!cfg.vivo);
const avisoEventoDe = (on, vivo) => (on ? (vivo ? '' : 'chat') : 'no');

/** Un clic del paso 4 sobre el borrador: devuelve el `ov` nuevo. `k`: vivo|avisos|nick|evento; `v`: el valor de un
 *  menú (cv, ca, cc, nv). */
export function tocar(borr, k, v) {
  const ahora = cfgFinal(borr);
  const ov = Object.assign({}, (borr && borr.ov) || {});
  const ge = String(((borr && borr.c) || {}).ge || '');
  const evOn = avisoEventoPrendido(ahora);
  if (k === 'vivo') {
    ov.vivo = ahora.vivo ? '' : (ge || '');
    ov.aviso_evento = avisoEventoDe(evOn, ov.vivo);
  } else if (k === 'cv') {
    ov.vivo = /^\d{15,22}$/.test(String(v || '')) ? String(v) : '';
    ov.aviso_evento = avisoEventoDe(evOn, ov.vivo);
  } else if (k === 'nv') {
    if (Object.prototype.hasOwnProperty.call(NIVELES_CHAT, v)) ov.vivo_nivel = v;
  } else if (k === 'avisos') {
    ov.avisos = ahora.avisos ? '' : (ge || ahora.vivo || '');
  } else if (k === 'ca') {
    ov.avisos = /^\d{15,22}$/.test(String(v || '')) ? String(v) : '';
  } else if (k === 'cc') {
    ov.canales = (Array.isArray(v) ? v : []).filter((x) => /^\d{15,22}$/.test(String(x))).map(String).slice(0, 10);
  } else if (k === 'nick') {
    ov.nick = !ahora.nick;
  } else if (k === 'evento') {
    ov.aviso_evento = avisoEventoDe(!evOn, ahora.vivo);
  }
  return ov;
}

// ── 📺 LOS CANALES: los busca solo, con los mismos nombres que ya usa el lector ─────────────────────────────────────
export const ROLES_CANAL = [['an', 'Anuncios de eventos'], ['in', 'Inscripciones'], ['ve', 'Veredictos'], ['ge', 'Chat general']];
const nfkd = (s) => String(s || '').normalize('NFKD');

/**
 * `{an, in, ve, ge}` (ids, '' si no hay): los anuncios por `PATRON_VIGIA` (o «anuncios» adentro de una categoría de
 * torneos, como FVS), las inscripciones por `PATRON_INSC`, los veredictos por `PATRON_VEREDICTOS` y el chat general con
 * `chatGeneralDe()`. Los mismos patrones del vigía (`descubrir()` en avisos.js), nunca los de staff: un setup que
 * eligiera otros canales que el lector haría que el admin vea una cosa y el bot lea otra.
 */
export function adivinarCanales(cs) {
  const lista = Array.isArray(cs) ? cs : [];
  const fuera = categoriasStaff(lista);
  const cat = new Map(lista.filter((c) => c && c.type === 4).map((c) => [String(c.id), nfkd(c.name)]));
  const texto = lista.filter((c) => c && (c.type === 0 || c.type === 5) && !fuera.has(String(c.parent_id || '')))
    .sort((a, b) => (a.position || 0) - (b.position || 0));
  const primero = (f) => { const c = texto.find((x) => f(nfkd(x.name), x)); return c ? String(c.id) : ''; };
  const an = primero((n) => !STAFF.test(n) && !PATRON_INSC.test(n) && PATRON_VIGIA.test(n))
    || primero((n, x) => !STAFF.test(n) && /anuncio/i.test(n) && PATRON_VIGIA.test(cat.get(String(x.parent_id || '')) || ''));
  const ins = primero((n) => !STAFF.test(n) && PATRON_INSC.test(n));
  const ve = primero((n) => PATRON_VEREDICTOS.test(n) && !NO_VEREDICTOS.test(n) && !/llave/i.test(n) && !STAFF.test(n));
  const ge = chatGeneralDe(lista, fuera) || '';
  return { an, in: ins, ve, ge: String(ge) };
}

/** Los canales donde el bot va a escribir con esta configuración, con para qué: ahí va el mensaje de prueba. */
export function canalesQueEscribe(cfg, c) {
  const out = [];
  const add = (id, que) => {
    if (!/^\d{15,22}$/.test(String(id || ''))) return;
    const ya = out.find((x) => x.id === String(id));
    if (ya) { if (!ya.que.includes(que)) ya.que.push(que); } else out.push({ id: String(id), que: [que] });
  };
  if (cfg.vivo) add(cfg.vivo, 'el bot en vivo');
  if (cfg.avisos) add(cfg.avisos, 'los avisos de rango');
  if (avisoEventoPrendido(cfg)) add(cfg.aviso_evento === 'chat' ? (cfg.vivo || (c && c.ge)) : cfg.vivo, 'el aviso de cada evento');
  if (cfg.ganadores && c && c.ge) add(c.ge, 'los ganadores de cada evento');
  return out;
}

/** El canal al que lleva la invitación de la Liga: bienvenida, reglas, el del sistema o el primero que ve @everyone.
 *  Lo mismo que `elegir_canal()` de bot/invitaciones.py: una invitación a un canal que el que llega no ve no sirve. */
export function canalInvitacion(guild, cs) {
  if (!guild) return null;
  const gid = String(guild.id || '');
  const ev = (guild.roles || []).find((r) => String(r.id) === gid);
  const base = big(ev && ev.permissions);
  const veTodos = (c) => {
    if (base & P.ADMIN) return true;
    let p = base;
    for (const o of c.permission_overwrites || []) if (String(o.id) === gid) p = (p & ~big(o.deny)) | big(o.allow);
    return (p & P.VER) !== 0n;
  };
  const texto = (cs || []).filter((c) => c && (c.type === 0 || c.type === 5) && veTodos(c))
    .sort((a, b) => (a.position || 0) - (b.position || 0));
  const nn = (s) => nfkd(s).replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
  const bien = texto.find((c) => /bienven|welcome/.test(nn(c.name)));
  if (bien) return bien;
  for (const id of [guild.rules_channel_id, guild.system_channel_id]) {
    const c = texto.find((x) => String(x.id) === String(id || ''));
    if (c) return c;
  }
  return texto[0] || null;
}

/** Una sigla de 2 a 6 letras que nadie use, de las iniciales del nombre. El ciclo la vuelve a mirar (`sigla_libre()` de
 *  bot/tiers.py) antes de escribirla: ésta es una propuesta, para que Dlx la vea en el DM. */
export function siglaPropuesta(nombre, usadas) {
  const usad = new Set([...(usadas || [])].map((x) => String(x).toUpperCase()));
  const limpio = nfkd(nombre).replace(/[̀-ͯ]/g, '').toUpperCase();
  const palabras = limpio.split(/[^A-Z0-9]+/).map((p) => p.replace(/[^A-Z]/g, '')).filter(Boolean);
  const ini = palabras.map((p) => p[0]).join('');
  const todo = palabras.join('');
  const cands = [];
  if (ini.length >= 2) cands.push(ini.slice(0, 6));
  for (const n of [3, 4, 5, 6]) if (todo.length >= n) cands.push(todo.slice(0, n));
  if (ini.length >= 2) for (const x of todo) cands.push(ini.slice(0, 5) + x);
  for (const c of cands) if (/^[A-Z]{2,6}$/.test(c) && !usad.has(c)) return c;
  const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const a of AZ) for (const b of AZ) if (!usad.has('SV' + a + b)) return 'SV' + a + b;
  return '';
}

// ── 🆔 EL custom_id: `su:v1:<acción>[:<dato>]` ───────────────────────────────────────────────────────────────────────
export function idSu(a, x) {
  const id = ['su', VERSION, a].concat(x === undefined || x === '' ? [] : [String(x)]).join(':');
  if (id.length > TOPES.id) throw new Error('custom_id de más de 100: ' + id.slice(0, 40));
  return id;
}
/** `{a, x}` de un custom_id del setup, o `null` si no es uno de esta versión. */
export function leerSu(id) {
  const p = String(id || '').split(':');
  if (p[0] !== 'su' || p[1] !== VERSION || !p[2]) return null;
  return { a: p[2], x: p.slice(3).join(':') };
}

/** Del estado del objeto a quién es este servidor para la Liga: `socio` (ya está), `fuera` (registrado afuera: lo decide
 *  Dlx) o `nuevo`. `SERVIDORES` es la lista del Worker; `meta.liga`, los confirmados; `meta.nuevos`, los que entraron
 *  sin pasar por el código (este setup o el alta del Dashboard). */
export function estadoLiga(gid, meta, SERVIDORES) {
  const m = meta || {};
  const liga = Array.isArray(m.liga) ? m.liga : null;
  const todos = conNuevos(SERVIDORES || [], m);
  const s = todos.find((x) => String(x.guild || '') === String(gid));
  if (!s) return { es: 'nuevo', sv: '' };
  if (s.fuera || (liga && !liga.includes(s.sv))) return { es: 'fuera', sv: s.sv };
  return { es: 'socio', sv: s.sv, nombre: s.nombre };
}

// ── 🖼️ LAS PANTALLAS (componentes V2: sin `content`, todo en un contenedor) ────────────────────────────────────────
const fila = (...c) => ({ type: 1, components: c.filter(Boolean) });
const boton = (label, a, x, style = 2, extra) => Object.assign({ type: 2, style, label, custom_id: idSu(a, x) }, extra || {});
const enlace = (label, url) => ({ type: 2, style: 5, label, url });
const canalSel = (a, x, def, placeholder, max = 1) => {
  const dv = (Array.isArray(def) ? def : [def]).filter((d) => /^\d{15,22}$/.test(String(d || ''))).slice(0, max)
    .map((id) => ({ id: String(id), type: 'channel' }));
  // ⚠️ `default_values` sólo con ids de canales que EXISTEN: uno borrado hace que Discord rechace el mensaje entero
  // (por eso los pasos 3 y 4 los filtran contra la lista de canales antes de llegar acá)
  return Object.assign({ type: 8, custom_id: idSu(a, x), channel_types: [0, 5], min_values: 0, max_values: max, placeholder },
    dv.length ? { default_values: dv } : {});
};
const mencion = (id) => (/^\d{15,22}$/.test(String(id || '')) ? `<#${id}>` : '—');
const cortar = (s, n) => (String(s || '').length > n ? String(s).slice(0, n - 1) + '…' : String(s || ''));
const limpiarNombre = (s) => cortar(String(s || 'tu servidor').replace(/[\\`*_~|>#[\]<@]/g, ''), 60);
export const iconoDe = (g) => (g && g.id && g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128` : '');

const PASOS = ['', 'PERMISOS', 'PLANTILLA', 'TUS CANALES', 'LO QUE HACE EL BOT', 'VER Y APLICAR', 'LISTO'];
/** La barra de avance en texto: hecho 🟩, éste 🟪, lo que falta ⬛. */
export function barra(n, listo) {
  return Array.from({ length: 6 }, (_, k) => (listo || k + 1 < n ? '🟩' : k + 1 === n ? '🟪' : '⬛')).join('');
}
const cabeza = (n, sub, listo) => T(`-# **PASO ${n} DE 6 · ${sub || PASOS[n]}**\n${barra(n, listo)}`);

/** El mensaje entero, para editar el original (PATCH) o contestar. */
export const mensaje = (contenedor) => ({ flags: V2, components: [contenedor], allowed_mentions: { parse: [] } });
/** Un aviso suelto en el mismo formato (V2), para cuando algo falla a mitad del setup. */
export const avisoV2 = (txt, extra) => mensaje(caja(COLOR.amar, [T(txt), extra || null]));

/** Paso 0: qué es y qué va a pasar. `v` = `{nombre, icono, borr, estado}`. */
export function paso0(v) {
  const socio = v.estado && v.estado.es === 'socio';
  const n = limpiarNombre(v.nombre);
  const intro = socio
    ? `### 🏆 ${n} ya es de la Liga Global\nEn 6 pasos dejas el bot a tu gusto: qué lee, dónde habla y qué hace en tu servidor.`
    : `### 🏆 Bienvenido a la Liga Global, ${n}\nEl ranking de los servidores de freestyle de Discord. En 6 pasos el bot ` +
      'queda listo: lee tus eventos y llaves, tu gente suma al ranking y tiene su carta.';
  const b = v.borr;
  const comps = [
    seccion(intro, mini(v.icono)),
    SEP,
    T(['**1** · Revisar los permisos del bot', '**2** · Elegir una plantilla', '-# Liga completa · Lo básico · Sólo leer',
      '**3** · Tus canales', '-# los busco solo, tú corriges', '**4** · Lo que hace el bot acá', '**5** · Ver todo y aplicar',
      socio ? '**6** · Listo' : '**6** · Listo: tu servidor entra a la Liga'].join('\n')),
  ];
  if (b) comps.push(T(`-# Quedó uno a medias en el paso ${Math.min(5, Math.max(1, b.paso || 1))}: puedes retomarlo.`));
  comps.push(b
    ? fila(boton('Retomar', 'retomar', '', 1), boton('Empezar de cero', 'nuevo'), enlace('Qué es la Liga', HUB + '/freestyle-rap/guia'))
    : fila(boton('Empezar', 'nuevo', '', 1), enlace('Qué es la Liga', HUB + '/freestyle-rap/guia')));
  comps.push(T('-# No se cambia nada en tu servidor hasta el paso 5. Tarda unos 2 minutos.'));
  return mensaje(caja(COLOR.mag, comps));
}

/** El link que vuelve a meter al bot con Administrador en ESE servidor (Discord sube el permiso de su rol). */
export const linkAdmin = (gid) => `https://discord.com/oauth2/authorize?client_id=${APP_ID}&permissions=8&integration_type=0` +
  `&scope=bot+applications.commands&guild_id=${gid}&disable_guild_select=true`;

/** 🤖 El bot no está en el servidor (el comando también se puede usar instalado en la cuenta, donde el bot no entró):
 *  sin él no hay nada que configurar, y anotar el servidor en la Liga sería anotar uno que el bot no puede leer. */
export function sinBot(gid) {
  return mensaje(caja(COLOR.amar, [
    T('### 🤖 Primero, el bot\nNo veo al bot de la Liga en este servidor. Agrégalo (con su rol propio y Administrador) y vuelve a tocar «Comprobar de nuevo».'),
    fila(enlace('Agregar el bot', linkAdmin(gid)), boton('Comprobar de nuevo', 'ir', 0)),
  ]));
}

/** Paso 1: los permisos. `v` = `{gid, perm, borr}`. */
export function paso1(v) {
  const r = resumenPermisos(v.perm, v.borr && v.borr.pl);
  const todo = !r.falta.length && !r.filas.some((f) => f[0] === '⚠️');
  const lineas = r.filas.map(([i, t, para]) => `${i} **${t}**\n-# ${para}`);
  if (!v.perm || v.perm.sinDatos) lineas.push('-# ⚠️ Discord no me dejó ver los roles: esto sale de los permisos del canal donde corriste el comando.');
  if (r.bloquea) lineas.push('🔴 Sin leer el historial el bot no ve tus eventos: dale ese permiso (o Administrador) y toca «Comprobar de nuevo».');
  // lo que falta se puede saltear (salvo leer); el rol bajo es un aviso, no algo que falte
  const sigue = r.falta.length
    ? boton('Seguir sin eso', 'seguir', '', 2, { disabled: r.bloquea })
    : boton('Siguiente', 'seguir', '', 1);
  return mensaje(caja(todo ? COLOR.verde : COLOR.amar, [
    cabeza(1),
    T(lineas.join('\n')),
    fila(r.admin ? null : enlace('Darle Administrador', linkAdmin(v.gid)), boton('Comprobar de nuevo', 'ir', 1), sigue,
      boton('Atrás', 'ir', 0)),
  ]));
}

/** Paso 2: la plantilla. */
export function paso2(v) {
  const pl = v.borr && v.borr.pl;
  return mensaje(caja(COLOR.mag, [
    cabeza(2),
    T('¿Cuánto quieres que haga el bot en tu servidor? Después cambias lo que quieras.'),
    fila({ type: 3, custom_id: idSu('pl'), placeholder: 'Elige una plantilla', min_values: 1, max_values: 1,
      options: Object.entries(PLANTILLAS).map(([k, p]) => ({ label: p.et, value: k, description: cortar(p.desc, 100),
        emoji: { name: p.emoji }, default: k === pl })) }),
    pl ? T(`-# ${PLANTILLAS[pl].emoji} **${PLANTILLAS[pl].et}**: ${PLANTILLAS[pl].desc}.`) : null,
    fila(boton('Siguiente', 'ir', 3, 1, { disabled: !pl }), boton('Atrás', 'ir', 1)),
  ]));
}

/** ¿El bot puede leer (y escribir, si hace falta) en ese canal? `''` si sí; si no, por qué. */
export function problemaCanal(canal, ctx, escribe) {
  if (!canal) return 'ese canal ya no existe';
  if (!ctx || ctx.base === undefined) return '';
  const p = permisosEnCanal(ctx.base, canal, ctx.gid, ctx.misRoles);
  if ((p & (P.VER | P.HISTORIAL)) !== (P.VER | P.HISTORIAL)) return 'el bot no puede leer ahí';
  if (escribe && (p & P.ENVIAR) === 0n) return 'el bot no puede escribir ahí';
  return '';
}

/** Paso 3: los canales, ya encontrados. `v` = `{borr, canales, ctx}` (`ctx` para revisar los permisos de cada uno). */
export function paso3(v) {
  const b = v.borr || {};
  const c = b.c || {};
  const ce = b.ce || {};
  const cs = new Map((v.canales || []).map((x) => [String(x.id), x]));
  const cfg = cfgFinal(b);
  const escribeGe = canalesQueEscribe(cfg, c).some((x) => x.id === String(c.ge || ''));
  const comps = [cabeza(3)];
  const algunoFalta = ROLES_CANAL.some(([k]) => !c[k]);
  comps.push(T(algunoFalta ? 'Encontré lo que pude. Corrige lo que esté mal y elige lo que falte.' : 'Los encontré solos. Corrige lo que esté mal.'));
  for (const [k, et] of ROLES_CANAL) {
    const id = String(c[k] || '');
    const existe = id && cs.has(id);
    let estado = !id ? 'no lo encontré: elígelo si tienes uno' : !existe ? '⚠️ ese canal ya no existe: elige otro'
      : ce[k] === 'e' ? 'elegido' : 'encontrado';
    const prob = existe ? problemaCanal(cs.get(id), v.ctx, k === 'ge' && escribeGe) : '';
    if (prob) estado = '⚠️ ' + prob;
    comps.push(T(`**${et}** · ${estado}`));
    comps.push(fila(canalSel('ch', k, existe ? id : '', 'Elige el canal de ' + et.toLowerCase())));
  }
  comps.push(T('-# 🔑 Tus llaves no hace falta elegirlas: el bot las encuentra por lo que dicen, en cualquier canal.'));
  comps.push(fila(boton('Siguiente', 'ir', 4, 1), boton('Atrás', 'ir', 2)));
  return mensaje(caja(COLOR.mag, comps));
}

/** Paso 4: lo que hace el bot, prellenado por la plantilla. `v` = `{borr, canales}`. */
export function paso4(v) {
  const b = v.borr || {};
  const cfg = cfgFinal(b);
  const ids = new Set((v.canales || []).map((x) => String(x.id)));
  const vale = (id) => (ids.size === 0 || ids.has(String(id)) ? id : '');
  const tg = (on, k) => boton(on ? 'Prendido' : 'Apagado', 'tg', k, on ? 3 : 2);
  const nivel = NIVELES_CHAT[cfg.vivo_nivel] ? cfg.vivo_nivel : 'normal';
  const comps = [cabeza(4)];
  if (b.pl === 'leer') comps.push(T('-# 👁 Con **Sólo leer** el bot no escribe nada en tu servidor. Prender algo de esto lo cambia.'));
  comps.push(seccion('🎙 **Bot en vivo**\n-# cuenta las batallas mientras se juegan', tg(!!cfg.vivo, 'vivo')));
  if (cfg.vivo) {
    comps.push(fila(canalSel('cv', '', vale(cfg.vivo), 'Dónde habla el bot en vivo')));
    comps.push(fila({ type: 3, custom_id: idSu('nv'), placeholder: 'Cuánto habla', min_values: 1, max_values: 1,
      options: Object.entries(NIVELES_CHAT).map(([k, [label, d]]) => ({ label, value: k, description: cortar(d, 100), default: k === nivel })) }));
  }
  comps.push(seccion('📈 **Avisos de rango**\n-# cuando alguien de acá sube de letra', tg(!!cfg.avisos, 'avisos')));
  if (cfg.avisos) comps.push(fila(canalSel('ca', '', vale(cfg.avisos), 'Dónde van los avisos de rango')));
  const cc = (cfg.canales || []).filter((x) => vale(x));
  comps.push(T('🃏 **/card** · ' + (cc.length ? `sólo en ${cc.length} ${cc.length === 1 ? 'canal' : 'canales'}` : 'en cualquier canal')));
  comps.push(fila(canalSel('cc', '', cc, '/card en cualquier canal (o elige dónde)', 10)));
  comps.push(seccion('#️⃣ **El puesto en el apodo**\n-# «#12 | Lucho» · cada uno lo puede apagar con /numeral', tg(!!cfg.nick, 'nick')));
  comps.push(seccion('📣 **Aviso de cada evento**\n-# el bot lo publica y lo va editando con la llave', tg(avisoEventoPrendido(cfg), 'evento')));
  comps.push(fila(boton('Siguiente', 'ir', 5, 1), boton('Atrás', 'ir', 3)));
  return mensaje(caja(COLOR.mag, comps));
}

/** Lo que dice cada configuración en una línea, para el paso 5 y el panel. */
export function enPalabras(cfg) {
  const p = [];
  p.push(cfg.vivo ? `bot en vivo en ${mencion(cfg.vivo)}` : 'sin bot en vivo');
  p.push(cfg.avisos ? `avisos de rango en ${mencion(cfg.avisos)}` : 'sin avisos de rango');
  p.push(cfg.nick ? '#N en los apodos' : 'sin #N en los apodos');
  p.push(avisoEventoPrendido(cfg) ? 'aviso de cada evento' : 'sin aviso de cada evento');
  p.push((cfg.canales || []).length ? `/card en ${cfg.canales.length} ${cfg.canales.length === 1 ? 'canal' : 'canales'}` : '/card en cualquier canal');
  return p.join(' · ');
}

/** Paso 5: ver todo y un solo «Aplicar». `v` = `{nombre, borr, estado, invCanal, invPuede}`. */
export function paso5(v) {
  const b = v.borr || {};
  const cfg = cfgFinal(b);
  const pl = PLANTILLAS[b.pl] || PLANTILLAS.completa;
  const escribe = canalesQueEscribe(cfg, b.c || {});
  const n = limpiarNombre(v.nombre);
  const es = (v.estado && v.estado.es) || 'nuevo';
  const l = [`💾 **Guardo tus ajustes** · plantilla ${pl.et}\n-# ${enPalabras(cfg)}`];
  l.push(escribe.length
    ? `🧪 **Un mensaje de prueba** en ${escribe.map((x) => mencion(x.id)).join(', ')}\n-# para ver que el bot puede escribir ahí; después lo borras`
    : '🧪 **Ningún mensaje de prueba**\n-# con esta configuración el bot no escribe solo en tu servidor');
  l.push(v.invCanal
    ? `🔗 **La invitación de la Liga a tu servidor** · no vence\n-# a ${mencion(v.invCanal)}${v.invPuede === false ? ' · ⚠️ falta «Crear invitación»: la creo cuando el bot lo tenga' : ''}`
    : '🔗 **La invitación de la Liga**\n-# ⚠️ no encontré un canal que vea todo el mundo: la crea el equipo después');
  if (es === 'socio') l.push(`✅ **${n} ya es de la Liga**\n-# no hace falta anotarlo: sólo se guardan los ajustes`);
  else if (es === 'fuera') l.push(`📝 **Le pido al equipo que sume ${n}**\n-# estaba registrado fuera de la Liga: lo decide el equipo`);
  else {
    l.push(`📝 **Anoto ${n} en la Liga** y le aviso al equipo\n-# tus eventos y llaves se leen desde la próxima vuelta del bot (unos 30 minutos)`);
    l.push('⏳ **Puntos de Temporada**\n-# los aprueba el equipo de la Liga: hasta entonces tus eventos se ven pero no suman');
  }
  return mensaje(caja(COLOR.mag, [
    cabeza(5),
    T('Esto es lo que va a pasar cuando toques **Aplicar**:'),
    T(l.join('\n')),
    fila(boton('Aplicar', 'aplicar', '', 3), boton('Atrás', 'ir', 4)),
  ]));
}

/** Mientras aplica: cada cosa con su estado. `items` = `[{t, sub, est}]` con `est` en ok|no|va|espera. */
export function aplicando(items, fin) {
  const ic = { ok: '✅', no: '❌', va: '⏳', espera: '▫️', salto: '➖' };
  const l = (items || []).map((x) => `${ic[x.est] || '▫️'} **${x.t}**${x.sub ? '\n-# ' + x.sub : ''}`);
  const algoMal = (items || []).some((x) => x.est === 'no');
  return mensaje(caja(algoMal && fin ? COLOR.amar : COLOR.mag, [
    cabeza(5, 'APLICANDO'),
    T(l.join('\n') || 'Arrancando…'),
    fin && algoMal ? T('-# Lo que salió bien ya quedó. «Reintentar» hace sólo lo que falta: no repite mensajes ni invitaciones.') : null,
    fin && algoMal ? fila(boton('Reintentar', 'aplicar', '', 1), boton('Seguir sin eso', 'ir', 6)) : null,
  ]));
}

/** Cómo están los puntos de Temporada de este servidor: `[icono, en pocas palabras]`. Un socio de antes del setup los
 *  tiene según su tier (`suma`, de la página); uno que entró con el setup, según lo que decidió Dlx (`dec`). */
export function puntos(v) {
  const es = (v.estado && v.estado.es) || 'nuevo';
  if (es === 'socio' && !(v.hecho && v.hecho.alta)) return v.suma === true ? ['✅', 'suman'] : ['➖', 'los decide tu tier'];
  if (v.dec && v.dec.si === true) return ['✅', 'aprobados'];
  if (v.dec && v.dec.si === false) return ['⏸️', 'todavía no'];
  return ['⏳', 'en revisión'];
}

/** Los «chips» del cierre, en código: Discord los dibuja como pastillas grises. */
export function chips(v) {
  const cfg = v.cfg || {};
  const es = (v.estado && v.estado.es) || 'nuevo';
  const [ic, txt] = puntos(v);
  const c = [es === 'fuera' ? '⏳ Entrar a la Liga: en revisión' : '✅ Eventos y llaves', es === 'fuera' ? '' : '✅ Tu página y tu kit',
    cfg.vivo ? '✅ Bot en vivo' : '', `${ic} Puntos de Temporada: ${txt}`];
  return c.filter(Boolean).map((x) => '`' + x + '`').join(' ');
}

/** Paso 6: listo. `v` = `{nombre, icono, cfg, estado, aviso, kit, dec, hecho}`. */
export function paso6(v) {
  const n = limpiarNombre(v.nombre);
  const es = (v.estado && v.estado.es) || 'nuevo';
  const titulo = es === 'fuera' ? `### 📝 Tu pedido para sumar ${n} le llegó a la Liga`
    : es === 'socio' && !(v.hecho && v.hecho.alta) ? `### ✅ ${n} quedó configurado` : `### ✅ ${n} ya está en la Liga Global`;
  const cuerpo = es === 'fuera' ? 'El equipo lo revisa y te aviso acá.'
    : es === 'socio' && !(v.hecho && v.hecho.alta) ? 'Tus ajustes ya valen: el bot los toma desde ahora.'
      : 'Desde la próxima vuelta del bot (unos 30 minutos) tus eventos se leen solos, tu gente puede verificarse y tener ' +
        'su carta, y tu servidor sale en la página.';
  const pend = es !== 'socio' || (v.hecho && v.hecho.alta);
  const nota = pend && !(v.dec && v.dec.si === true)
    ? (v.aviso ? `-# Los puntos de Temporada se prenden cuando el equipo de la Liga revise tu servidor. Te aviso en ${mencion(v.aviso)} apenas pase.`
      : '-# Los puntos de Temporada se prenden cuando el equipo de la Liga revise tu servidor. Lo ves volviendo a correr `/setup`.')
    : null;
  return mensaje(caja(COLOR.verde, [
    cabeza(6, '', true),
    seccion(`${titulo}\n${cuerpo}`, mini(v.icono)),
    T(chips(v)),
    nota ? T(nota) : null,
    SEP,
    T('Hay más en tu dashboard: horario de silencio, tus ligas, el resumen semanal y tu equipo de admins.\n' +
      '-# 🛡️ El anti-raid lo prende el dueño del servidor con **`/antiraid`**.'),
    fila(enlace('Abrir mi dashboard', HUB + '/freestyle-rap/socio'), v.kit ? enlace('Mi kit', v.kit) : null,
      boton('Cambiar algo', 'ir', 7)),
  ]));
}

/** Paso 7: si lo vuelven a correr, cómo está todo y entrar a un paso. `v` = `{nombre, hecho, cfg, perm, estado, dec,
 *  suma}`; `cfg` es lo que está en KV AHORA (lo pueden haber cambiado desde /settings o la página). */
export function paso7(v) {
  const h = v.hecho || {};
  const cfg = v.cfg || {};
  const c = h.c || {};
  const n = limpiarNombre(v.nombre);
  const cuando = h.t ? new Date(h.t).toLocaleDateString('es-AR', { timeZone: 'America/New_York', day: '2-digit', month: '2-digit' }) : '';
  const r = resumenPermisos(v.perm, h.pl);
  const arriba = Number((v.perm && v.perm.arriba) || 0);
  const [pIc, pTxt] = puntos(v);
  const l = [
    `${r.bloquea ? '🔴' : r.falta.length || arriba ? '⚠️' : '✅'} **Permisos**\n-# ` +
      (r.admin ? 'Administrador' : r.falta.length ? 'faltan: ' + r.falta.join(', ').toLowerCase() : 'tiene lo que necesita') +
      (arriba ? ` · el rol del bot tiene ${arriba} ${arriba === 1 ? 'rol' : 'roles'} encima` : ' · el rol del bot está arriba'),
    `${ROLES_CANAL.some(([k]) => c[k]) ? '✅' : '⚠️'} **Canales**\n-# ` +
      ROLES_CANAL.map(([k, et]) => et.toLowerCase().replace('anuncios de eventos', 'eventos') + ' ' + mencion(c[k])).join(' · '),
    `${cfg.vivo ? '✅' : '➖'} **Bot en vivo**\n-# ` +
      (cfg.vivo ? `en ${mencion(cfg.vivo)} · ${((NIVELES_CHAT[cfg.vivo_nivel] || NIVELES_CHAT.normal)[0]).toLowerCase()}` : 'apagado'),
    `⚙️ **Lo demás**\n-# avisos de rango ${cfg.avisos ? 'en ' + mencion(cfg.avisos) : 'apagados'} · #N ${cfg.nick ? 'prendido' : 'apagado'}` +
      ` · aviso de cada evento ${avisoEventoPrendido(cfg) ? 'prendido' : 'apagado'}`,
    `${pIc} **Puntos de Temporada**\n-# ${pTxt}`,
  ];
  const b = v.borr;
  return mensaje(caja(COLOR.verde, [
    T(`### ⚙️ ${n} · configurado` + (cuando ? `\n-# la última vez, el ${cuando}` + (h.por ? ` por <@${h.por}>` : '') : '')),
    T(l.join('\n')),
    fila({ type: 3, custom_id: idSu('cambiar'), placeholder: 'Cambiar un paso…', min_values: 1, max_values: 1,
      options: [['1', 'Permisos', 'volver a revisarlos'], ['2', 'Plantilla', 'Liga completa · Lo básico · Sólo leer'],
        ['3', 'Canales', 'eventos, inscripciones, veredictos, general'], ['4', 'Lo que hace el bot', 'en vivo, avisos, /card, #N']]
        .map(([value, label, description]) => ({ value, label, description })) }),
    // ⏯️ un cambio que quedó a medias (otro admin, o el mismo hace un rato) se retoma desde acá
    fila(enlace('Abrir mi dashboard', HUB + '/freestyle-rap/socio'),
      b ? boton(`Retomar el cambio (paso ${Math.min(5, Math.max(1, b.paso || 1))})`, 'retomar', '', 1) : null,
      boton('Empezar de nuevo', 'nuevo', '', 4)),
  ]));
}

/** El DM a Dlx (sólo a él): lo necesario para decidir y los botones. `v` = `{gid, nombre, icono, miembros, perm, pl,
 *  por, sigla, fuera, dec}`. Con `dec`, lo que ya decidió y el botón para cambiarlo. */
export function dmDlx(v) {
  const n = limpiarNombre(v.nombre);
  const r = resumenPermisos(v.perm, v.pl);
  const pl = PLANTILLAS[v.pl] || PLANTILLAS.completa;
  const datos = [`### 🆕 ${n} corrió /setup`,
    [v.miembros ? `${Number(v.miembros).toLocaleString('es-AR')} miembros` : '', r.admin ? 'el bot es Administrador'
      : r.falta.length ? 'al bot le falta: ' + r.falta.join(', ').toLowerCase() : 'el bot tiene lo que necesita',
    'plantilla ' + pl.et].filter(Boolean).join(' · '),
    `Lo corrió ${/^\d{15,22}$/.test(String(v.por || '')) ? `<@${v.por}>` : 'un admin'} · sigla propuesta **${v.sigla || '—'}**`,
    v.fuera ? '-# Estaba registrado **fuera de la Liga**: no entra solo. Si lo quieres adentro, súmalo desde el Dashboard.'
      : '-# Ya entró a la Liga. Falta tu respuesta: ¿sus eventos suman a la Temporada?'].join('\n');
  const dash = enlace('Verlo en el Dashboard', HUB + '/freestyle-rap/dashboard');
  const comps = [seccion(datos, mini(v.icono))];
  if (v.fuera) {
    comps.push(fila(dash));
  } else if (v.dec && typeof v.dec.si === 'boolean') {
    const cuando = v.dec.t ? new Date(v.dec.t).toLocaleString('es-AR', { timeZone: 'America/New_York', day: '2-digit', month: '2-digit', hour: 'numeric', minute: '2-digit' }) + ' ET' : '';
    comps.push(T(v.dec.si ? `✅ **Decidiste que sumen** (Tier 3)${cuando ? ' · ' + cuando : ''}\n-# El ciclo lo prende en su próxima vuelta y le avisa al servidor.`
      : `⏸️ **Todavía no**${cuando ? ' · ' + cuando : ''}\n-# Lo puedes cambiar acá o en el Dashboard.`));
    comps.push(fila(v.dec.si ? boton('Mejor todavía no', 'no', v.gid) : boton('Que sumen · Tier 3', 'si', v.gid, 3), dash));
  } else {
    comps.push(fila(boton('Que sumen · Tier 3', 'si', v.gid, 3), boton('Todavía no', 'no', v.gid), dash));
  }
  return mensaje(caja(COLOR.amar, comps));
}

/** 🤖 El DM a Dlx cuando AGREGAN el bot a un servidor (19/11/2026, ver `llego()`). Dlx: «directo, el bot me escribe x DM
 *  que lo agregaron a X servidor». Sin los botones de decidir: eso llega con el /setup, que es cuando hay plantilla,
 *  canales y sigla para mirar. `v` = `{gid, nombre, icono, miembros, por, estado}` (`estado` de `estadoLiga()`). */
export function dmLlego(v) {
  const n = limpiarNombre(v.nombre);
  const e = v.estado || { es: 'nuevo' };
  const quien = /^\d{15,22}$/.test(String(v.por || '')) ? `<@${v.por}>` : 'alguien';
  const datos = [`### 🤖 Agregaron el bot a ${n}`,
    [v.miembros ? `${Number(v.miembros).toLocaleString('es-AR')} miembros` : '', `lo agregó ${quien}`].filter(Boolean).join(' · '),
    e.es === 'socio' ? `-# Ya es socio de la Liga (**${e.sv}**): volvieron a poner el bot.`
      : e.es === 'fuera' ? `-# Está registrado **fuera de la Liga** (**${e.sv}**): no entra solo.`
        : '-# Todavía no es socio. Cuando un admin escriba /setup, te llega acá para que decidas si sus eventos suman.'].join('\n');
  return mensaje(caja(COLOR.verde, [seccion(datos, mini(v.icono)), fila(enlace('Verlo en el Dashboard', HUB + '/freestyle-rap/dashboard'))]));
}

/** Cuántos componentes, cuántas letras de texto y el id más largo de un mensaje: lo que Discord rechaza si se pasa. */
export function medir(msg) {
  let componentes = 0, letras = 0, idMax = 0;
  const ver = (c) => {
    if (!c || typeof c !== 'object') return;
    componentes += 1;
    if (c.type === 10) letras += String(c.content || '').length;
    if (c.custom_id) idMax = Math.max(idMax, String(c.custom_id).length);
    for (const x of c.components || []) ver(x);
    if (c.accessory) ver(c.accessory);
  };
  for (const c of (msg && msg.components) || []) ver(c);
  return { componentes, letras, idMax, cabe: componentes <= TOPES.componentes && letras <= TOPES.letras && idMax <= TOPES.id };
}

// ── 📝 EL BORRADOR ───────────────────────────────────────────────────────────────────────────────────────────────────
export const borradorNuevo = (uid) => ({ v: 1, paso: 1, pl: '', c: {}, ce: {}, ov: {}, por: String(uid || ''), t: Date.now() });
/** Para «Cambiar un paso…»: un borrador que arranca de lo que ya se aplicó. */
export const borradorDeHecho = (h, uid) => ({ v: 1, paso: 1, pl: (h && h.pl) || 'completa', c: Object.assign({}, (h && h.c) || {}),
  ce: Object.fromEntries(Object.keys((h && h.c) || {}).map((k) => [k, 'e'])), ov: Object.assign({}, (h && h.ov) || {}),
  adiv: true, por: String(uid || ''), t: Date.now() });
export const vigente = (b, ahora = Date.now()) => !!(b && b.v === 1 && ahora - (b.t || 0) < BORRADOR_VIVE);

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// LO QUE HABLA CON DISCORD Y CON EL OBJETO (el Worker)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Un pedido a Discord con el bot. ⏱️ UN 429 SE LEE: si pide esperar 2 s o menos, se espera y se repite UNA vez; más que
 *  eso, vuelve el 429 y quien llamó lo dice («Reintentar»). Esperar no gasta CPU. */
async function dc(env, ruta, op = {}) {
  const pedir = () => fetch(API + ruta, Object.assign({}, op, {
    headers: Object.assign({ Authorization: 'Bot ' + env.DISCORD_TOKEN, 'User-Agent': UA, 'content-type': 'application/json' }, op.headers || {}),
  }));
  let r = await pedir();
  if (r.status === 429) {
    const seg = Number(r.headers.get('retry-after')) || Number(((await r.clone().json().catch(() => ({}))) || {}).retry_after) || 5;
    if (seg <= 2) {
      await new Promise((ok) => setTimeout(ok, Math.ceil(seg * 1000)));
      r = await pedir();
    }
  }
  return r;
}

/** Al objeto (`setupOp()` en avisos.js). */
async function objeto(env, cuerpo) {
  try {
    const r = await env.AVISOS.get(env.AVISOS.idFromName('liga')).fetch('https://avisos/setup', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
    return await r.json();
  } catch (e) {
    return { error: 'red' };
  }
}

/** Editar el mensaje del clic (o del comando diferido) con el token de ESA interacción. */
const editar = (i, data) => fetch(`${API}/webhooks/${i.application_id}/${i.token}/messages/@original`, {
  method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data),
}).catch(() => null);

const diferir = (tipo) => new Response(JSON.stringify(tipo === 5 ? { type: 5, data: { flags: EFIMERO } } : { type: 6 }),
  { headers: { 'content-type': 'application/json' } });

/** El código del kit privado de un servidor: el mismo HMAC que `codigo()` de bot/kits.py. Sin la sal, sin link. */
export async function linkKit(env, gid) {
  if (!env || !env.FOTOS_SAL || !/^\d{15,22}$/.test(String(gid || ''))) return '';
  try {
    const enc = new TextEncoder();
    const k = await crypto.subtle.importKey('raw', enc.encode(env.FOTOS_SAL), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const s = new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode('kit:' + gid)));
    return HUB + '/freestyle-rap/kit/' + [...s].map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 20);
  } catch (e) {
    return '';
  }
}

/** Lo que cada pantalla pide de Discord y de KV, una sola vez por clic (`una()` guarda la promesa). */
function contexto(i, env) {
  const gid = String(i.guild_id || '');
  const m = {};
  const una = (k, f) => m[k] || (m[k] = f().catch(() => null));
  const json = async (r) => (r && r.ok ? r.json() : null);
  const cx = {
    gid,
    guild: () => una('g', async () => json(await dc(env, `/guilds/${gid}?with_counts=true`))),
    miembro: () => una('m', async () => json(await dc(env, `/guilds/${gid}/members/${APP_ID}`))),
    canales: () => una('c', async () => { const x = await json(await dc(env, `/guilds/${gid}/channels`)); return Array.isArray(x) ? x : null; }),
    meta: () => una('meta', async () => JSON.parse((await env.KV.get('meta', { cacheTtl: 60 })) || '{}') || {}),
    cfgCrudo: () => una('cfg', async () => { const t = await env.KV.get('cfg:' + gid); return t ? JSON.parse(t) : {}; }),
    lobby: () => una('lobby', async () => JSON.parse((await env.KV.get('web:lobby', { cacheTtl: 300 })) || '{}') || {}),
  };
  /** `{bits, admin, arriba, rol, base, misRoles}`: lo del servidor sale de los roles; si Discord no los da, de los permisos
   *  que trajo el clic (`app_permissions`, que son los del canal donde se tocó) */
  cx.perm = () => una('perm', async () => {
    const [g, mb] = await Promise.all([cx.guild(), cx.miembro()]);
    if (!g || !mb || !Array.isArray(g.roles)) {
      const b = big(i.app_permissions);
      return { bits: String(b), admin: (b & P.ADMIN) !== 0n, arriba: 0, rol: '', sinDatos: true };
    }
    const misRoles = (mb.roles || []).map(String);
    const base = permisosBase(gid, g.roles, misRoles);
    const pos = new Map(g.roles.map((r) => [String(r.id), Number(r.position) || 0]));
    const alto = Math.max(0, ...misRoles.map((r) => pos.get(r) || 0));
    const arriba = g.roles.filter((r) => (Number(r.position) || 0) > alto).length;
    const suyo = g.roles.find((r) => r.tags && String(r.tags.bot_id || '') === APP_ID)
      || g.roles.filter((r) => misRoles.includes(String(r.id))).sort((a, b) => (b.position || 0) - (a.position || 0))[0];
    return { bits: String(base), admin: (base & P.ADMIN) !== 0n || base === TODO, arriba, rol: (suyo && suyo.name) || '', base, misRoles };
  });
  return cx;
}

/** La primera respuesta del comando: el mensaje efímero YA en V2, con un «un momento», y la pantalla de verdad se edita
 *  encima. ⚠️ No es el «pensando» (tipo 5): así la edición nunca tiene que CAMBIAR el mensaje a V2, sólo reemplazar
 *  componentes de un mensaje que ya lo es. */
export const cargando = () => new Response(JSON.stringify({ type: 4, data: { flags: EFIMERO | V2,
  components: [caja(COLOR.mag, [T('⏳ Un momento: miro tu servidor…')])], allowed_mentions: { parse: [] } } }),
{ headers: { 'content-type': 'application/json' } });

/** `/setup`: el mensaje ya, y la pantalla cuando el objeto y Discord contestan. `h` trae lo del Worker. */
export function comando(i, env, ctx, h) {
  if (!i.guild_id) return h.aviso('`/setup` va **adentro del servidor** que quieres sumar a la Liga.');
  if (!puedeSetup(i)) {
    return h.aviso('El `/setup` lo corren los **admins** del servidor (Administrador o *Gestionar servidor*).');
  }
  h.luego(ctx, correr(i, env, h, { a: 'abrir', x: '' }));
  return cargando();
}

/** Los clics: `su:v1:…`. Los del DM de Dlx (`si`/`no`) sólo él; los demás, un admin de ESE servidor, en cada clic. */
export function componente(i, env, ctx, h) {
  const s = leerSu(i.data && i.data.custom_id);
  if (!s) return h.aviso('Ese botón es de una versión vieja del `/setup`: vuelve a correr **`/setup`** y sigue desde ahí.');
  const yo = h.idDe(i);
  const esperar = h.frenado(yo, 'click');
  if (esperar) return h.espera(esperar);
  if (s.a === 'si' || s.a === 'no') {
    if (yo !== DUENO) return h.aviso('Esto lo decide el equipo de la Liga.');
    h.luego(ctx, decidir(i, env, s));
    return diferir(6);
  }
  if (!i.guild_id) return h.aviso('Esto va adentro de un servidor.');
  if (!puedeSetup(i)) return h.aviso('Ya no tienes permiso para configurar este servidor (hace falta Administrador o *Gestionar servidor*).');
  h.luego(ctx, correr(i, env, h, s));
  return diferir(6);
}

/** Dlx decide desde su DM: lo anota el objeto (el ajuste `setup_suma`, el mismo del Dashboard) y el DM cambia. */
async function decidir(i, env, s) {
  const gid = String(s.x || '');
  const r = await objeto(env, { op: 'decidir', g: gid, si: s.a === 'si', por: DUENO });
  if (!r.ok) return editar(i, avisoV2(r.error === 'no existe' ? 'Ese servidor ya no está en la lista del /setup.' : 'No pude anotarlo: prueba de nuevo en un minuto.'));
  const x = r.hecho || {};
  return editar(i, dmDlx({ gid, nombre: x.nombre, icono: x.icono, miembros: x.miembros, perm: x.perm, pl: x.pl, por: x.por,
    sigla: x.sigla, fuera: x.es === 'fuera', dec: r.dec }));
}

/** Una vuelta: lee el estado, aplica el clic sobre el borrador, lo guarda y dibuja la pantalla que toca. */
async function correr(i, env, h, s) {
  const gid = String(i.guild_id);
  const uid = h.idDe(i);
  try {
    const est = await objeto(env, { op: 'leer', g: gid });
    if (est.error) return editar(i, avisoV2('No pude leer cómo va tu setup: prueba de nuevo en un minuto.'));
    const cx = contexto(i, env);
    const hecho = est.hecho && est.hecho.t ? est.hecho : null;
    let borr = vigente(est.borr) ? est.borr : null;
    let paso = 0;
    const vals = (i.data && i.data.values) || [];
    if (s.a === 'abrir') {
      paso = hecho ? 7 : 0;
    } else if (s.a === 'nuevo') {
      borr = borradorNuevo(uid);
      paso = 1;
    } else if (s.a === 'retomar') {
      paso = borr ? Math.min(5, Math.max(1, borr.paso || 1)) : 0;
    } else if (s.a === 'aplicar') {
      if (!borr) return editar(i, await pantalla(hecho ? 7 : 0, null, hecho, est.dec, cx, i, env, h));
      return aplicar(i, env, h, cx, borr, hecho, est.dec);
    } else if (s.a === 'cambiar') {
      borr = borradorDeHecho(hecho, uid);
      paso = Math.min(4, Math.max(1, Number(vals[0]) || 1));
    } else {
      if (!borr && !(s.a === 'ir' && ['0', '6', '7'].includes(s.x))) borr = hecho ? borradorDeHecho(hecho, uid) : borradorNuevo(uid);
      if (s.a === 'ir') paso = Math.min(7, Math.max(0, Number(s.x) || 0));
      else if (s.a === 'seguir') { borr.sin_perm = true; paso = 2; }
      else if (s.a === 'pl') { if (PLANTILLAS[vals[0]]) { borr.pl = vals[0]; borr.ov = {}; } paso = 2; }
      else if (s.a === 'ch') {
        if (ROLES_CANAL.some(([k]) => k === s.x)) {
          borr.c = Object.assign({}, borr.c || {}, { [s.x]: /^\d{15,22}$/.test(String(vals[0] || '')) ? String(vals[0]) : '' });
          borr.ce = Object.assign({}, borr.ce || {}, { [s.x]: 'e' });
          borr.adiv = true;
        }
        paso = 3;
      } else if (s.a === 'tg') { borr.ov = tocar(borr, s.x); paso = 4; }
      else if (s.a === 'cv' || s.a === 'ca' || s.a === 'nv') { borr.ov = tocar(borr, s.a, vals[0]); paso = 4; }
      else if (s.a === 'cc') { borr.ov = tocar(borr, 'cc', vals); paso = 4; }
      else paso = 0;
    }
    if (borr && paso >= 1 && paso <= 5) {
      if (paso >= 3 && !borr.adiv) {
        const cs = await cx.canales();
        if (cs) { borr.c = adivinarCanales(cs); borr.ce = {}; borr.adiv = true; }
      }
      if (paso >= 3 && !borr.pl) borr.pl = 'completa';
      borr.paso = paso;
      borr.t = Date.now();
      await objeto(env, { op: 'borrador', g: gid, borr });
    }
    return editar(i, await pantalla(paso, borr, hecho, est.dec, cx, i, env, h));
  } catch (e) {
    return editar(i, avisoV2('Algo falló en el `/setup`: prueba de nuevo. Si se repite, avísale a la Liga.'));
  }
}

/** Arma la pantalla `paso` con lo que pide (cada una pide lo suyo de Discord, y nada más). */
async function pantalla(paso, borr, hecho, dec, cx, i, env, h) {
  const [g, mb] = await Promise.all([cx.guild(), cx.miembro()]);
  if (!g || !mb) return sinBot(cx.gid);
  const nombre = (g && g.name) || 'tu servidor';
  const icono = iconoDe(g);
  if (paso === 1) return paso1({ gid: cx.gid, perm: await cx.perm(), borr });
  if (paso === 2) return paso2({ borr });
  if (paso === 3 || paso === 4) {
    const [cs, perm] = await Promise.all([cx.canales(), cx.perm()]);
    const ctxP = perm && perm.base !== undefined ? { base: perm.base, gid: cx.gid, misRoles: perm.misRoles } : null;
    return paso === 3 ? paso3({ borr, canales: cs || [], ctx: ctxP }) : paso4({ borr, canales: cs || [] });
  }
  if (paso === 5) {
    const [cs, perm, meta] = await Promise.all([cx.canales(), cx.perm(), cx.meta()]);
    const inv = (hecho && hecho.inv && hecho.inv.canal_id) ? { id: hecho.inv.canal_id } : canalInvitacion(g, cs || []);
    let invPuede = true;
    if (inv && perm && perm.base !== undefined && cs) {
      const c = cs.find((x) => String(x.id) === String(inv.id));
      invPuede = !!c && (permisosEnCanal(perm.base, c, cx.gid, perm.misRoles) & P.INVITAR) !== 0n;
    }
    return paso5({ nombre, borr, estado: estadoLiga(cx.gid, meta, h.SERVIDORES), invCanal: inv ? String(inv.id) : '', invPuede });
  }
  if ((paso === 6 || paso === 7) && hecho) {
    const [perm, meta, crudo, lobby] = await Promise.all([cx.perm(), cx.meta(), cx.cfgCrudo(), cx.lobby()]);
    const estado = estadoLiga(cx.gid, meta, h.SERVIDORES);
    const cfg = Object.assign({}, CFG_BASE, crudo || {});
    if (paso === 6) {
      return paso6({ nombre, icono, cfg, estado, aviso: hecho.aviso || '', kit: estado.es === 'fuera' ? '' : await linkKit(env, cx.gid),
        dec, hecho, suma: sumaDe(lobby, estado.sv) });
    }
    return paso7({ nombre, hecho, cfg, perm, estado, dec, suma: sumaDe(lobby, estado.sv), borr: vigente(borr) ? borr : null });
  }
  const meta = await cx.meta();
  return paso0({ nombre, icono, borr: paso === 0 && borr && borr.paso ? borr : null, estado: estadoLiga(cx.gid, meta, h.SERVIDORES) });
}

/** ¿Los eventos de este socio suman a la Temporada? De lo que ya dice la página (`web:lobby`, `cu.t`); `null` si no se sabe. */
function sumaDe(lobby, sv) {
  const x = ((lobby && lobby.svs) || []).find((y) => y && y.sv === sv);
  return x && x.cu ? !!x.cu.t : null;
}

/**
 * «Aplicar»: todo de una, contado en vivo en el mismo mensaje. Se puede repetir sin duplicar nada (ver el encabezado).
 * Pedidos: el objeto ~6, Discord ~12 y las ediciones del mensaje ~6: lejos de los 50 de una invocación.
 */
async function aplicar(i, env, h, cx, borr, hecho, dec) {
  const gid = cx.gid;
  const uid = h.idDe(i);
  const lk = await objeto(env, { op: 'candado', g: gid });
  if (!lk.ok) {
    return editar(i, avisoV2('⏳ Ya se está aplicando (otro clic, o alguien más del staff). Espera un momento y mira cómo quedó.',
      fila(boton('Ver cómo quedó', 'ir', 7))));
  }
  const items = [];
  const pintar = (fin) => editar(i, aplicando(items, fin));
  try {
    const cfg = cfgFinal(borr);
    const pl = PLANTILLAS[borr.pl] ? borr.pl : 'completa';
    const [g, cs, perm, meta, mb] = await Promise.all([cx.guild(), cx.canales(), cx.perm(), cx.meta(), cx.miembro()]);
    if (!g || !mb) return editar(i, sinBot(gid));
    const estado = estadoLiga(gid, meta, h.SERVIDORES);
    const nombre = (g && g.name) || 'tu servidor';
    const escribe = canalesQueEscribe(cfg, borr.c || {});
    const itAj = { t: 'Guardo tus ajustes', sub: 'plantilla ' + PLANTILLAS[pl].et, est: 'va' };
    items.push(itAj);
    const itPr = escribe.map((x) => ({ id: x.id, t: 'Mensaje de prueba en ' + mencion(x.id), sub: '', est: 'espera' }));
    items.push(...itPr);
    const itInv = { t: 'La invitación de la Liga a tu servidor', sub: '', est: 'espera' };
    items.push(itInv);
    const itAlta = estado.es === 'socio' ? null : { t: `Anoto ${limpiarNombre(nombre)} en la Liga`, sub: '', est: 'espera' };
    if (itAlta) items.push(itAlta);
    await pintar(false);

    // 1 · los ajustes: UNA escritura de KV, y sólo si algo cambió. Se suma a lo que ya había (el horario de silencio,
    // el canal de una liga…: lo que el setup no toca queda como estaba)
    const crudo = (await cx.cfgCrudo()) || {};
    const nuevo = Object.assign({}, crudo, cfg);
    if (JSON.stringify(nuevo) !== JSON.stringify(crudo)) {
      try {
        await env.KV.put('cfg:' + gid, JSON.stringify(nuevo));
      } catch (e) {
        // 🔴 sin cupo de KV (pasó el 24/09/2026): sin ajustes guardados no se sigue, para no anotar un servidor a medias
        itAj.est = 'no';
        itAj.sub = 'no pude guardar (Cloudflare se quedó sin escrituras por hoy): «Reintentar» en unas horas';
        return pintar(true);
      }
    }
    itAj.est = 'ok';
    itAj.t = 'Guardé tus ajustes';
    itAj.sub = 'plantilla ' + PLANTILLAS[pl].et + ' · ' + ROLES_CANAL.filter(([k]) => (borr.c || {})[k]).length + ' canales';
    await pintar(false);

    // 2 · un mensaje de prueba por canal, UNA vez por canal (lo ya probado en un setup anterior no se repite)
    const pruebas = Object.assign({}, (hecho && hecho.pruebas) || {});
    for (const it of itPr) {
      const x = escribe.find((y) => y.id === it.id);
      if (pruebas[it.id]) { it.est = 'ok'; it.sub = 'ya lo había probado'; continue; }
      const r = await dc(env, `/channels/${it.id}/messages`, { method: 'POST', body: JSON.stringify({
        content: `🧪 **Prueba de la Liga Global.** Desde este canal voy a escribir ${x.que.join(' y ')}. Si lees esto, el ` +
          'bot puede escribir acá: ya puedes borrar este mensaje.', allowed_mentions: { parse: [] } }) });
      if (r.ok) { pruebas[it.id] = String(((await r.json().catch(() => ({}))) || {}).id || '1'); it.est = 'ok'; it.sub = 'ya lo puedes borrar'; }
      else { it.est = 'no'; it.sub = r.status === 429 ? 'Discord me pidió esperar: «Reintentar» en un minuto' : 'no puedo escribir ahí: dale al bot permiso de ver y enviar mensajes en ese canal'; }
    }
    if (itPr.length) await pintar(false);

    // 3 · la invitación permanente: la que ya hay, o una nueva con `unique: false` (Discord devuelve la equivalente)
    let inv = (hecho && hecho.inv && hecho.inv.codigo) ? hecho.inv : null;
    if (inv) { itInv.est = 'ok'; itInv.sub = 'discord.gg/' + inv.codigo + ' · no vence'; }
    else {
      const c = canalInvitacion(g, cs || []);
      if (!c) { itInv.est = 'no'; itInv.sub = 'no encontré un canal que vea todo el mundo: la crea el equipo de la Liga'; }
      else {
        const r = await dc(env, `/channels/${c.id}/invites`, { method: 'POST',
          headers: { 'X-Audit-Log-Reason': encodeURIComponent('Liga Global: la invitación permanente de la Liga (/setup)') },
          body: JSON.stringify({ max_age: 0, max_uses: 0, temporary: false, unique: false }) });
        if (r.ok) {
          const j = (await r.json().catch(() => ({}))) || {};
          if (j.code) {
            inv = { codigo: String(j.code), canal: String(c.name || '').slice(0, 80), canal_id: String(c.id), t: Date.now() };
            itInv.est = 'ok';
            itInv.sub = 'discord.gg/' + inv.codigo + ' · no vence';
          } else { itInv.est = 'no'; itInv.sub = 'Discord no me dio el código: «Reintentar»'; }
        } else {
          itInv.est = 'no';
          itInv.sub = r.status === 403 ? 'al bot le falta «Crear invitación»: la crea el ciclo cuando lo tenga' : 'Discord dijo ' + r.status + ': «Reintentar»';
        }
      }
    }
    await pintar(false);

    // 4 · lo aplicado, en el objeto: de acá lo leen el ciclo (el alta), el vigía (los canales elegidos) y el Dashboard
    const usadas = conNuevos(h.SERVIDORES || [], meta).flatMap((x) => [x.sv, x.sigla].filter(Boolean));
    const sigla = (hecho && hecho.sigla) || siglaPropuesta(nombre, usadas);
    const aviso = canalesQueEscribe(cfg, borr.c || {}).map((x) => x.id)[0] || '';
    const rr = resumenPermisos(perm, pl);
    const nuevoHecho = { t: Date.now(), por: uid, pl, c: borr.c || {}, ov: borr.ov || {}, cfg, nombre: cortar(nombre, 100),
      icono: iconoDe(g), miembros: (g && g.approximate_member_count) || 0, sigla, aviso, pruebas, inv,
      perm: { admin: rr.admin, faltan: rr.falta, arriba: (perm && perm.arriba) || 0 }, es: estado.es,
      alta: estado.es === 'socio' ? undefined : { t: Date.now() } };
    // el borrador se borra sólo si todo salió: si no, «Reintentar» lo necesita (y no repite lo que ya está en `hecho`)
    const gu = await objeto(env, { op: 'hecho', g: gid, hecho: nuevoHecho, limpiar: !items.some((x) => x.est === 'no') });
    if (itAlta) {
      itAlta.est = gu.ok ? 'ok' : 'no';
      itAlta.t = gu.ok ? (estado.es === 'fuera' ? 'Le pedí al equipo que sume ' : 'Anoté ') + limpiarNombre(nombre) + (estado.es === 'fuera' ? '' : ' en la Liga') : itAlta.t;
      itAlta.sub = gu.ok ? (estado.es === 'fuera' ? 'lo decide el equipo de la Liga' : 'entra en la próxima vuelta del bot · sigla ' + sigla) : 'no pude anotarlo: «Reintentar»';
    }
    // 5 · el DM a Dlx, UNA vez por servidor (el objeto lo reserva antes de mandar y lo suelta si falla)
    if (gu.ok && estado.es !== 'socio') {
      const cl = await objeto(env, { op: 'dm', g: gid });
      if (cl.ok) {
        const ok = await mandarDlx(env, dmDlx({ gid, nombre, icono: iconoDe(g), miembros: nuevoHecho.miembros, perm: nuevoHecho.perm,
          pl, por: uid, sigla, fuera: estado.es === 'fuera', dec: null }));
        await objeto(env, { op: 'dm-fin', g: gid, ok });
      }
    }
    // algo salió mal: queda la lista con «Reintentar» (hace sólo lo que falta) y «Seguir sin eso» (el cierre)
    if (items.some((x) => x.est === 'no')) return pintar(true);
    const kit = estado.es === 'fuera' ? '' : await linkKit(env, gid);
    return editar(i, paso6({ nombre, icono: iconoDe(g), cfg, estado, aviso, kit, dec: (gu && gu.dec) || dec, hecho: gu.hecho || nuevoHecho,
      suma: estado.es === 'socio' ? sumaDe(await cx.lobby(), estado.sv) : null }));
  } catch (e) {
    items.push({ t: 'Algo falló a mitad de camino', sub: 'lo que ya está hecho no se repite: «Reintentar»', est: 'no' });
    return pintar(true);
  } finally {
    await objeto(env, { op: 'soltar', g: gid });
  }
}

/** 📨 El DM a Dlx. ⚠️ SÓLO A ÉL: `herramientas/sin_dm.py` pone rojo a CI si un DM va a otra persona. */
async function mandarDlx(env, msg) {
  try {
    const h0 = { Authorization: 'Bot ' + env.DISCORD_TOKEN, 'User-Agent': UA, 'content-type': 'application/json' };
    const r = await fetch(`${API}/users/@me/channels`, { method: 'POST', headers: h0,
      body: JSON.stringify({ recipient_id: DUENO }) });
    if (r.status !== 200) return false;
    const ch = await r.json();
    const r2 = await fetch(`${API}/channels/${ch.id}/messages`, { method: 'POST', headers: h0, body: JSON.stringify(msg) });
    return r2.ok;
  } catch (e) {
    return false;
  }
}

/** 🤖 AGREGARON EL BOT A UN SERVIDOR (19/11/2026): el `APPLICATION_AUTHORIZED` que Discord le manda a
 *  `/eventos-discord` (ver `eventosDiscord()` en worker.js), con `data` = `{integration_type, user, guild}`.
 *  ⚠️ UNA VEZ POR SERVIDOR CADA 6 HORAS (`llego:<gid>` en KV): quien saca y vuelve a poner el bot probando permisos no
 *  le llena el DM a Dlx. Se anota ANTES de mandar, así un reintento de Discord no lo duplica; si el DM falla, se borra
 *  para que el próximo aviso sí llegue. Devuelve `true` si lo mandó. */
export async function llego(env, d, h) {
  const g = (d && d.guild) || {};
  const gid = String(g.id || '');
  if (!/^\d{15,22}$/.test(gid) || (d && d.integration_type !== 0)) return false;
  const clave = 'llego:' + gid;
  if (await env.KV.get(clave)) return false;
  await env.KV.put(clave, '1', { expirationTtl: 6 * 3600 });
  // el bot ya está adentro, así que puede preguntar cuántos son (el evento no lo trae)
  let miembros = g.approximate_member_count;
  try {
    const r = await dc(env, `/guilds/${gid}?with_counts=true`);
    if (r.ok) miembros = (await r.json()).approximate_member_count || miembros;
  } catch (e) { /* sin el número, el DM sale igual */ }
  let meta = {};
  try { meta = JSON.parse((await env.KV.get('meta', { cacheTtl: 60 })) || '{}') || {}; } catch (e) { meta = {}; }
  const ok = await mandarDlx(env, dmLlego({ gid, nombre: g.name, icono: iconoDe(g), miembros,
    por: d.user && d.user.id, estado: estadoLiga(gid, meta, (h && h.SERVIDORES) || []) }));
  if (!ok) await env.KV.delete(clave).catch(() => null);
  return ok;
}
