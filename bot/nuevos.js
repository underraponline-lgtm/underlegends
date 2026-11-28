// 🐣 PARA LOS NUEVOS: LA INSCRIPCIÓN (28/11/2026).
//
// Por qué existe: el 80 % de la gente juega un evento y no vuelve. Cuando Dlx les ofreció a mano a los nuevos «un evento
// sólo para los que empiezan», el 95 % dijo que sí, pero solo no lo podía organizar. Esto junta a los interesados solo y
// le avisa al staff cuando ya hay grupo. Lo decidido:
//   · SE JUEGA SIEMPRE EN DRA, y el panel vive en el canal que termina en «evento-nuevos» (todos lo ven, nadie escribe).
//   · NO ES SÓLO UNA COMPETENCIA (Dlx, 28/11/2026: «no necesariamente hacer eventos de nuevos, necesariamente
//     competencias; puede ser dinámicas, cyphers, entrenamiento, etc.»): son varias ACTIVIDADES, cada una con su botón,
//     su contador y su tamaño de grupo. Viven en UNA tabla, `ACTIVIDADES`, acá abajo: para cambiar un tamaño o sumar una,
//     se toca esa tabla y nada más. Uno puede estar en varias a la vez.
//   · ES PARA LOS QUE EMPIEZAN: 2 eventos o menos en la temporada (`jugo_temp`, lo que manda el ciclo con `racha_cfg.temp`,
//     como `tempJugo()` de bot/tienda.js). Quien no está en esa tabla no jugó: cuenta 0.
//   · NO PIDE ESTAR VERIFICADO: es justo para quien recién llega.
//   · CADA ANOTACIÓN DURA 21 DÍAS (cada actividad la suya): el día y la hora todavía no están decididos, y una lista de
//     hace dos meses le haría convocar al staff a gente que ya se fue.
//   · CADA VEZ QUE UNA ACTIVIDAD LLEGA A UN MÚLTIPLO DE SU GRUPO, UN mensaje en el canal privado del staff que termina en
//     «recibidor» (`•「🚪」recibidor`), con los nombres y sus menciones —sin que suene nadie— y lo mismo a la campana de Dlx.
//   · El día, la hora, el premio y quién lo conduce NO están decididos: acá no se agenda nada.
//
// ⚠️ EL PANEL ES UN SOLO MENSAJE QUE SE EDITA, nunca uno nuevo: los contadores cambian con cada clic, y un mensaje por
// cambio sería una pared en un canal donde nadie puede escribir. Lo publica una vez el objeto (`panel()`, a pedido de
// `herramientas/evento_nuevos_panel.py`) y queda anotado en `nuevos_panel`.
// ⚠️ NUNCA POR DM: todo lo que ve el jugador es la respuesta efímera del botón.
// ⚠️ Los botones son `evn:<actividad>` (entra o sale de esa, alternando) y `evn:no` (sale de todas), sin dueño: el panel
// es de todos y quién toca lo firma Discord. `evn:si` era el único botón del primer panel (la competencia): sigue
// queriendo decir «Competencia», para que un panel viejo que quedó en el canal no se rompa.
//
// 🔁 Y DESDE EL MISMO 28/11/2026, UN SEGUNDO PANEL: «DE REGRESO», PARA LOS INACTIVOS (Dlx: «quizás canales diferentes
// para ellos»). Es el mismo mecanismo con OTRA tabla de actividades (`ACTIVIDADES_VUELVE`) y otra regla para entrar:
//   · ES PARA LOS INACTIVOS POR NUESTRA REGLA: jugaron en la temporada y hace 45 días o más que no juegan en ningún socio.
//     La regla vive en `bot/inactivos.py`; el ciclo le manda al objeto quiénes son (con los primerizos, campo `inact`) y
//     el objeto los guarda en `regreso_inact` (`regresoCiclo()`). Quien no está ahí no se anota; si el ciclo todavía no
//     mandó nada, no se sabe y lo dice.
//   · EL PANEL VIVE EN EL CANAL QUE TERMINA EN «de-regreso» (EVENTOS DRA), que sólo ven el rol Inactivo y el staff
//     (`herramientas/evento_nuevos_panel.py --vuelve`).
//   · LOS BOTONES SON `evn:v-<actividad>` y `evn:v-no`: el mismo prefijo `evn` (el Worker no cambia), y la `v-` dice el
//     panel. Las tablas, aparte: `regreso_anot`, `regreso_panel`, `regreso_hito`.
//   · EL DÍA QUE ALGUIEN CRUZA LOS 45, UN aviso en su campana (una vez: la clave lleva el día de su último evento), que
//     el buzón de hilos privados de DRA lee (bot/buzon.js). Nunca por DM.
import * as V from './vista.js';

/**
 * 🎛️ LAS ACTIVIDADES: `id` (va en el botón y en la tabla: corto y para siempre), `emoji`, `nombre` y `grupo` (cada cuántos
 * se le avisa al staff). El orden es el de los botones. Dlx, 28/11/2026.
 */
export const ACTIVIDADES = [
  { id: 'comp', emoji: '⚔️', nombre: 'Competencia', grupo: 8 },
  { id: 'cypher', emoji: '🎤', nombre: 'Cypher', grupo: 4 },
  { id: 'din', emoji: '🎲', nombre: 'Dinámica', grupo: 6 },
  { id: 'entr', emoji: '🧠', nombre: 'Entrenamiento', grupo: 3 },
];
/**
 * 🔁 LAS DE «DE REGRESO»: su propia tabla, así un tamaño o una actividad se cambia sin tocar la de los nuevos. Arrancan
 * iguales a las de los nuevos; lo que cambie, lo decide Dlx acá.
 */
export const ACTIVIDADES_VUELVE = [
  { id: 'comp', emoji: '⚔️', nombre: 'Competencia', grupo: 8 },
  { id: 'cypher', emoji: '🎤', nombre: 'Cypher', grupo: 4 },
  { id: 'din', emoji: '🎲', nombre: 'Dinámica', grupo: 6 },
  { id: 'entr', emoji: '🧠', nombre: 'Entrenamiento', grupo: 3 },
];
//: la del primer panel (`evn:si`) y la de las filas de antes de que hubiera actividades
export const ACT_VIEJA = 'comp';
export const MAX_EVENTOS = 2;
export const DIAS = 21;
//: 🔁 los días sin jugar de la regla (el número vive en `bot/inactivos.py`, `DIAS`: acá sólo se muestra y se usa para
//: el aviso del día en que se cruza) y cuántos días después todavía se avisa (`AVISO_DIAS` de allá)
export const VUELVE_DIAS = 45;
export const VUELVE_AVISO_DIAS = 3;
//: 🔁 el aviso en la campana el día que alguien cruza los 45 (lo lee el buzón de hilos privados)
export const VUELVE_AVISAR = true;
//: lo que va delante de la actividad en el botón del panel «De regreso»: `evn:v-comp`, `evn:v-no`
export const PRE_VUELVE = 'v-';
//: el canal de `eventos-hoy` de DRA (`CANAL_RED` en avisos.js): a donde va quien ya no es nuevo
export const CANAL_EVENTOS_HOY = '1500690475089399858';
export const GUILD_DRA = '841017460341604382';
/** las tablas con `quien`: se mudan con la cuenta (`mudarCuenta()`) y se borran con «olvidarme» (`olvidar()`) */
export const TABLAS_QUIEN = ['nuevos_anot', 'regreso_anot', 'regreso_inact'];

const DIA_MS = 24 * 3600 * 1000;
const QUIEN = /^[0-9]{5,25}$/;
const DC = 'https://discord.com/api/v10';
const UA = 'DiscordBot (https://underlegends.pages.dev, 1)';
// el mismo escape que `escMd()` de avisos.js: un nombre con `*` o `_` no rompe la lista del staff
const esc = (s) => String(s || '').replace(/([\\*_~|`>])/g, '\\$1');
const POR_ID = new Map(ACTIVIDADES.map((a) => [a.id, a]));
const POR_ID_V = new Map(ACTIVIDADES_VUELVE.map((a) => [a.id, a]));
export const actividad = (id) => POR_ID.get(id === 'si' ? ACT_VIEJA : id) || null;
/** 🔁 la actividad de «De regreso» con ese id (sin la `v-`) */
export const actividadVuelve = (id) => POR_ID_V.get(id) || null;
/** ¿Lo que trae el botón (`evn:<esto>`) es algo que el objeto entiende? `no`, `si`, una actividad, o lo mismo con `v-` */
export const accionValida = (x) => {
  const s = String(x || '');
  if (s.startsWith(PRE_VUELVE)) { const r = s.slice(PRE_VUELVE.length); return r === 'no' || !!actividadVuelve(r); }
  return s === 'no' || !!actividad(s);
};
const titulo = (a) => a.emoji + ' ' + a.nombre;

// ── 🔁 los dos paneles: lo que cambia entre uno y otro ──────────────────────────────────────────────────────────────
const TIPOS = {
  nuevos: { tipo: 'nuevos', acts: ACTIVIDADES, act: actividad, tabla: 'nuevos_anot', panelK: 'nuevos_panel',
    hitoK: 'nuevos_hito', pre: '', emoji: '🐣', nombre: 'Para los nuevos', bandeja: 'nuevos:' },
  vuelve: { tipo: 'vuelve', acts: ACTIVIDADES_VUELVE, act: actividadVuelve, tabla: 'regreso_anot', panelK: 'regreso_panel',
    hitoK: 'regreso_hito', pre: PRE_VUELVE, emoji: '🔁', nombre: 'De regreso', bandeja: 'regreso-hito:' },
};
const tipoDe = (t) => TIPOS[t === 'vuelve' ? 'vuelve' : 'nuevos'];
/** `[tipo, acción sin la v-]` de lo que trae el botón */
const partirAccion = (x) => {
  const s = String(x || '');
  return s.startsWith(PRE_VUELVE) ? [TIPOS.vuelve, s.slice(PRE_VUELVE.length)] : [TIPOS.nuevos, s];
};

export function nuevosTablas(sql) {
  // 🔁 LA DE ANTES ERA UNA FILA POR PERSONA (la primera versión, del mismo 28/11, sólo la competencia): se pasa a una por
  // persona y actividad, y lo que había queda en la competencia. SQLite no cambia una clave primaria: se copia y se renombra
  // (preguntando con un SELECT y no con PRAGMA: el objeto no deja usar todos los PRAGMA)
  let existe = false, conAct = false;
  try { sql.exec('SELECT quien FROM nuevos_anot LIMIT 1').toArray(); existe = true; } catch (e) { existe = false; }
  if (existe) { try { sql.exec('SELECT act FROM nuevos_anot LIMIT 1').toArray(); conAct = true; } catch (e) { conAct = false; } }
  if (existe && !conAct) {
    sql.exec('CREATE TABLE IF NOT EXISTS nuevos_anot2 (quien TEXT NOT NULL, act TEXT NOT NULL, nombre TEXT NOT NULL, ' +
      't INTEGER NOT NULL, PRIMARY KEY (quien, act)) WITHOUT ROWID');
    sql.exec('INSERT OR IGNORE INTO nuevos_anot2 (quien, act, nombre, t) SELECT quien, ?, nombre, t FROM nuevos_anot', ACT_VIEJA);
    sql.exec('DROP INDEX IF EXISTS nuevos_anot_t');
    sql.exec('DROP TABLE nuevos_anot');
    sql.exec('ALTER TABLE nuevos_anot2 RENAME TO nuevos_anot');
  }
  // quién se anotó a qué, con qué nombre (el de Discord en ese momento) y cuándo: de ahí salen el vencimiento y el orden
  sql.exec('CREATE TABLE IF NOT EXISTS nuevos_anot (quien TEXT NOT NULL, act TEXT NOT NULL, nombre TEXT NOT NULL, ' +
    't INTEGER NOT NULL, PRIMARY KEY (quien, act)) WITHOUT ROWID');
  // el vencimiento corre cada hora y el contador cuenta por actividad: con los índices leen sólo lo suyo
  sql.exec('CREATE INDEX IF NOT EXISTS nuevos_anot_t ON nuevos_anot (t)');
  sql.exec('CREATE INDEX IF NOT EXISTS nuevos_anot_act ON nuevos_anot (act, t)');
  // 🔁 «De regreso»: lo mismo, y quiénes son inactivos hoy (del ciclo: `regresoCiclo()`), con el día de su último evento
  sql.exec('CREATE TABLE IF NOT EXISTS regreso_anot (quien TEXT NOT NULL, act TEXT NOT NULL, nombre TEXT NOT NULL, ' +
    't INTEGER NOT NULL, PRIMARY KEY (quien, act)) WITHOUT ROWID');
  sql.exec('CREATE INDEX IF NOT EXISTS regreso_anot_t ON regreso_anot (t)');
  sql.exec('CREATE INDEX IF NOT EXISTS regreso_anot_act ON regreso_anot (act, t)');
  sql.exec('CREATE TABLE IF NOT EXISTS regreso_inact (quien TEXT PRIMARY KEY, ult TEXT NOT NULL, t INTEGER NOT NULL) WITHOUT ROWID');
}

/** El nombre que se ve: el apodo del servidor, el nombre global o el usuario (como lo muestra Discord), sin saltos. */
export function nombreDe(i) {
  const m = (i && i.member) || {};
  const u = m.user || (i && i.user) || {};
  return String(m.nick || u.global_name || u.username || 'Sin nombre').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Sin nombre';
}

/** «de 8», «de 16»…: el próximo grupo que se completa (con 0, el primero) */
export const meta = (n, grupo) => Math.max(grupo, Math.ceil(n / grupo) * grupo);

function panelDe(k, cuentas, intro, pie) {
  const c = cuentas || {};
  const lineas = k.acts.map((a) => {
    const n = Number(c[a.id]) || 0;
    return titulo(a) + ' · **' + n + ' de ' + meta(n, a.grupo) + '**' + (n >= a.grupo ? ' · ¡hay grupo! el staff está armando el día' : '');
  });
  const botones = k.acts.map((a) => V.boton(a.nombre, 'evn:' + k.pre + a.id, 3, { emoji: { name: a.emoji } }))
    .concat([V.boton('Ya no puedo', 'evn:' + k.pre + 'no', 2)]);
  const filas = [];
  for (let j = 0; j < botones.length; j += 5) filas.push(botones.slice(j, j + 5));
  return V.mensaje({ color: V.COLOR.verde, efimero: false, filas, dentro: [
    V.T('## ' + k.emoji + ' ' + k.nombre),
    V.T(intro),
    V.sep(),
    V.T(lineas.join('\n') + '\n-# ' + pie),
  ] });
}

/** 🐣 El panel del canal, en V2 y público: `cuentas` es `{actividad: anotados}`. Lo arma el objeto al publicarlo y en cada cambio. */
export function panelMsg(cuentas) {
  return panelDe(TIPOS.nuevos, cuentas, 'Actividades sólo para los que empiezan: nadie con más de ' + MAX_EVENTOS + ' eventos.'
    + ' Anótate en las que quieras y cuando se arme el grupo te avisamos con el día y la hora.',
  'Toca una para entrar o salir. La anotación dura ' + DIAS + ' días.');
}

/** 🔁 El panel «De regreso», igual de público, con sus actividades y sus botones `evn:v-…` */
export function panelVuelveMsg(cuentas) {
  return panelDe(TIPOS.vuelve, cuentas, 'Hace un tiempo que no juegas y te guardamos un lugar. Actividades sólo para los que'
    + ' vuelven: anótate en las que quieras y cuando se arme el grupo te avisamos con el día y la hora. Volver es más fácil'
    + ' con otros que también vuelven.',
  'Toca una para entrar o salir. La anotación dura ' + DIAS + ' días.');
}
const panelMsgDe = (k, c) => (k.tipo === 'vuelve' ? panelVuelveMsg(c) : panelMsg(c));

/** 📣 El aviso al staff: los anotados a esa actividad, en orden, con su mención (que no suena: `allowed_mentions` vacío). */
export function staffMsg(lista, hito, act, tipo) {
  const k = tipoDe(tipo);
  const a = k.act(act) || k.act(ACT_VIEJA);
  const tope = 40;
  const filas = lista.slice(0, tope).map((x, j) => (j + 1) + '. ' + esc(x.nombre) + ' — <@' + x.quien + '>');
  if (lista.length > tope) filas.push('-# y ' + (lista.length - tope) + ' más');
  return V.mensaje({ color: V.COLOR.verde, efimero: false, menciones: { parse: [] }, dentro: [
    V.T('### ' + k.emoji + ' Ya hay ' + hito + ' anotados para ' + titulo(a)),
    V.T('-# ' + k.nombre + ' · grupos de ' + a.grupo),
    V.T(filas.join('\n')),
    V.T('Pónganle día y hora.'),
  ] });
}

/** Lo que contesta el botón, efímero, a partir de lo que dijo el objeto (`anotar()`): qué pasó y en cuáles está ahora. */
export function respuestaTxt(j) {
  const x = j || {};
  const k = tipoDe(x.tipo);
  const a = k.act(x.act);
  const mias = (x.mias || []).map(k.act).filter(Boolean);
  const estoy = mias.length ? '\n-# Ahora estás en: ' + mias.map(titulo).join(' · ') + '.' : '\n-# Ya no estás en ninguna.';
  if (k.tipo === 'vuelve') {
    switch (x.estado) {
      case 'anotado': return '🔁 ¡Qué bueno verte! Te anotaste en **' + (a ? titulo(a) : 'la actividad') + '**: cuando se arme el'
        + ' grupo te avisamos en este canal con el día y la hora.' + estoy;
      case 'quitado': return '👋 Listo, saliste de **' + (a ? titulo(a) : 'la actividad') + '**.' + estoy;
      case 'activo': return '🔁 Esto es para los que vuelven después de ' + VUELVE_DIAS + ' días o más sin jugar, y tú jugaste hace'
        + ' poco. ¡Mira los eventos de hoy en <#' + CANAL_EVENTOS_HOY + '>!';
      case 'sin_dato': return 'Todavía no puedo saber si esto es para ti: prueba de nuevo en una hora.';
      case 'todo_quitado': return '👋 Listo, saliste de todas. Si cambias de idea, toca la que quieras de nuevo.';
      case 'no_estaba': return 'No estabas anotado en ninguna. Toca la que quieras para entrar.';
      default: return 'No pude anotarlo: prueba de nuevo en un minuto.';
    }
  }
  switch (x.estado) {
    case 'anotado': return '🐣 ¡Listo! Te anotaste en **' + (a ? titulo(a) : 'la actividad') + '**: cuando se arme el grupo te avisamos'
      + ' en este canal con el día y la hora.' + estoy;
    case 'quitado': return '👋 Listo, saliste de **' + (a ? titulo(a) : 'la actividad') + '**.' + estoy;
    case 'jugo': return '🐣 Ya jugaste ' + x.eventos + ' eventos: esto es para los que empiezan. ¡Mira los eventos de hoy en <#'
      + CANAL_EVENTOS_HOY + '>!';
    case 'todo_quitado': return '👋 Listo, saliste de todas. Si cambias de idea, toca la que quieras de nuevo.';
    case 'no_estaba': return 'No estabas anotado en ninguna. Toca la que quieras para entrar.';
    default: return 'No pude anotarlo: prueba de nuevo en un minuto.';
  }
}

// ── lo que hace el objeto (`o` es el Durable Object: `o.sql`, `o.leer`, `o.guardar`, `o.aBandeja`, `o.env`) ──────────

/** Los eventos de la temporada en curso de esa persona: la temporada con que el ciclo los escribió (`racha_cfg.temp`). */
export function eventosDe(o, quien) {
  let temp = 'prueba';
  try { const r = o.leer('racha_cfg'); if (r && r.temp) temp = String(r.temp); } catch (e) { /* la de arranque */ }
  try {
    const f = o.sql.exec('SELECT eventos FROM jugo_temp WHERE quien = ? AND temp = ?', quien, temp).toArray()[0];
    return f ? Number(f.eventos) || 0 : 0;
  } catch (e) { return 0; }
}

/**
 * 🔁 ¿Es inactivo por nuestra regla? `{estado: 'si'|'activo'|'sin_dato', ult?}`: lo que mandó el ciclo la última vez
 * (`regresoCiclo()`). Sin nada del ciclo todavía, no se sabe (no se adivina).
 */
export function inactivoDe(o, quien) {
  let cfg = null;
  try { cfg = o.leer('regreso_cfg'); } catch (e) { cfg = null; }
  if (!cfg || !cfg.t) return { estado: 'sin_dato' };
  const f = o.sql.exec('SELECT ult FROM regreso_inact WHERE quien = ?', quien).toArray()[0];
  return f ? { estado: 'si', ult: f.ult } : { estado: 'activo' };
}

/** `{actividad: anotados}`, todas (las que no tienen a nadie, en 0) */
export function cuentas(o, tipo) {
  const k = tipoDe(tipo);
  const c = Object.fromEntries(k.acts.map((a) => [a.id, 0]));
  for (const f of o.sql.exec(`SELECT act, COUNT(*) AS n FROM ${k.tabla} GROUP BY act`).toArray()) if (f.act in c) c[f.act] = Number(f.n) || 0;
  return c;
}
const anotados = (o, act, k = TIPOS.nuevos) => o.sql.exec(`SELECT quien, nombre, t FROM ${k.tabla} WHERE act = ? ORDER BY t, quien`, act).toArray();
const misActs = (o, quien, k = TIPOS.nuevos) => {
  const m = new Set(o.sql.exec(`SELECT act FROM ${k.tabla} WHERE quien = ?`, quien).toArray().map((f) => f.act));
  return k.acts.filter((a) => m.has(a.id)).map((a) => a.id);
};

/** Borra lo de más de 21 días. Devuelve las actividades que perdieron a alguien. */
export function vencer(o, ahora, tipo) {
  const k = tipoDe(tipo);
  const hasta = ahora - DIAS * DIA_MS;
  const acts = [...new Set(o.sql.exec(`SELECT act FROM ${k.tabla} WHERE t < ?`, hasta).toArray().map((f) => f.act))];
  if (acts.length) o.sql.exec(`DELETE FROM ${k.tabla} WHERE t < ?`, hasta);
  return acts;
}

const pedir = (o, ruta, op) => fetch(DC + ruta, Object.assign({}, op, {
  headers: { Authorization: 'Bot ' + o.env.DISCORD_TOKEN, 'User-Agent': UA, 'Content-Type': 'application/json' },
}));

/** Edita los contadores del panel, si hay panel. Un PATCH, nunca un mensaje nuevo. Devuelve el estado de Discord (0 = nada). */
export async function editarPanel(o, tipo) {
  const k = tipoDe(tipo);
  const p = o.leer(k.panelK) || {};
  if (!p.canal || !p.msg || !o.env || !o.env.DISCORD_TOKEN) return 0;
  try {
    const r = await pedir(o, `/channels/${p.canal}/messages/${p.msg}`, { method: 'PATCH', body: JSON.stringify(panelMsgDe(k, cuentas(o, k.tipo))) });
    return r.status;
  } catch (e) { return 0; }
}

/**
 * 📣 ¿Esa actividad llegó a un múltiplo nuevo de su grupo? Un mensaje al staff y a la campana de Dlx, UNA vez por múltiplo.
 * `nuevos_hito` guarda, por actividad, el último múltiplo avisado y QUIÉNES eran: si alguien sale y vuelve a entrar (7 → 8
 * con la misma gente) no se avisa de nuevo —tocar el botón dos veces no le llena el canal al staff—; si el grupo cambió
 * (salió uno y entró otro, o se vencieron y llegaron otros), sí, con la lista nueva. Al bajar, el múltiplo baja con la cuenta.
 * (El panel «De regreso» lo mismo, con `regreso_hito`.)
 */
async function quizasAvisar(o, act, ahora, dueno, k = TIPOS.nuevos) {
  const a = k.act(act);
  if (!a) return false;
  const lista = anotados(o, a.id, k);
  const m = Math.floor(lista.length / a.grupo) * a.grupo;
  let todos = o.leer(k.hitoK) || {};
  // la primera versión guardaba uno solo, `{hito, ids}`: era el de la competencia
  if (typeof todos.hito === 'number') todos = { [ACT_VIEJA]: { hito: todos.hito, ids: todos.ids || [] } };
  const h = todos[a.id] || { hito: 0, ids: [] };
  const guardar = (v) => o.guardar(k.hitoK, Object.assign({}, todos, { [a.id]: v }));
  if (m < h.hito) { guardar({ hito: m, ids: h.ids || [] }); return false; }
  if (m === 0 || m === h.hito) return false;
  const ids = lista.map((x) => x.quien).sort();
  const antes = (h.ids || []).slice().sort();
  const mismo = ids.length === antes.length && ids.every((x, j) => x === antes[j]);
  guardar({ hito: m, ids, t: ahora });
  if (mismo) return false;
  const p = o.leer(k.panelK) || {};
  let url = '';
  if (p.staff && o.env && o.env.DISCORD_TOKEN) {
    try {
      const r = await pedir(o, `/channels/${p.staff}/messages`, { method: 'POST', body: JSON.stringify(staffMsg(lista, m, a.id, k.tipo)) });
      const j = r.ok ? await r.json().catch(() => ({})) : {};
      if (j.id) url = `https://discord.com/channels/${GUILD_DRA}/${p.staff}/${j.id}`;
    } catch (e) { /* la campana de Dlx igual */ }
  }
  if (o.aBandeja && dueno) {
    o.aBandeja(dueno, k.bandeja + a.id + ':' + m, 'liga', (k.emoji + ' Ya hay ' + m + ' anotados para ' + titulo(a)).slice(0, 120),
      (lista.slice(0, 12).map((x) => x.nombre).join(', ') + (lista.length > 12 ? '…' : '') + '. Pónganle día y hora.').slice(0, 240), url, '', ahora);
  }
  return true;
}

/**
 * 🙋 Un clic del panel: `{quien, nombre, accion}` (quién lo dice el Worker, que lo leyó del clic firmado). `accion` es una
 * actividad (entra si no estaba, sale si estaba), `si` (la competencia, del primer panel) o `no` (sale de todas); con
 * `v-` delante, lo mismo en el panel «De regreso».
 * `dueno`: el Discord ID de Dlx (`DUENO` de avisos.js), para su campana.
 * `{ok, estado, act, mias, cuentas, eventos}`: anotado · quitado · jugo (más de 2 eventos) · todo_quitado · no_estaba;
 * en «De regreso» (`tipo: 'vuelve'`), en vez de `jugo`: activo (jugó hace poco) · sin_dato (el ciclo todavía no mandó).
 * Después de cualquier cambio, los contadores del panel y, si toca, el aviso al staff.
 */
export async function anotar(o, d, ahora = Date.now(), dueno = '') {
  const quien = String((d && d.quien) || '');
  if (!QUIEN.test(quien) || !d || !accionValida(d.accion)) return { error: 'faltan datos' };
  const [k, accion] = partirAccion(d.accion);
  const tocadas = new Set(vencer(o, ahora, k.tipo));
  let estado = '', eventos = 0, act = '';
  if (accion === 'no') {
    const mias = misActs(o, quien, k);
    estado = mias.length ? 'todo_quitado' : 'no_estaba';
    if (mias.length) o.sql.exec(`DELETE FROM ${k.tabla} WHERE quien = ?`, quien);
    for (const x of mias) tocadas.add(x);
  } else {
    act = k.act(accion).id;
    const esta = !!o.sql.exec(`SELECT 1 AS x FROM ${k.tabla} WHERE quien = ? AND act = ?`, quien, act).toArray()[0];
    if (esta) {
      o.sql.exec(`DELETE FROM ${k.tabla} WHERE quien = ? AND act = ?`, quien, act);
      estado = 'quitado';
      tocadas.add(act);
    } else {
      let puede = true;
      if (k.tipo === 'vuelve') {
        const ina = inactivoDe(o, quien);
        if (ina.estado !== 'si') { estado = ina.estado; puede = false; }
      } else {
        eventos = eventosDe(o, quien);
        if (eventos > MAX_EVENTOS) { estado = 'jugo'; puede = false; }
      }
      if (puede) {
        const nombre = String(d.nombre || '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Sin nombre';
        o.sql.exec(`INSERT INTO ${k.tabla} (quien, act, nombre, t) VALUES (?, ?, ?, ?)`, quien, act, nombre, ahora);
        estado = 'anotado';
        tocadas.add(act);
      }
    }
  }
  if (tocadas.size) {
    for (const x of tocadas) await quizasAvisar(o, x, ahora, dueno, k);
    await editarPanel(o, k.tipo);
  }
  const out = { ok: true, estado, act, mias: misActs(o, quien, k), cuentas: cuentas(o, k.tipo), eventos };
  if (k.tipo === 'vuelve') out.tipo = 'vuelve';
  return out;
}

/** ⏰ Cada hora, desde el vigía: lo vencido se va y los contadores del panel se ponen al día (sólo si algo se fue). Los dos paneles. */
export async function vencerYEditar(o, ahora = Date.now(), dueno = '') {
  let n = 0;
  for (const k of [TIPOS.nuevos, TIPOS.vuelve]) {
    const acts = vencer(o, ahora, k.tipo);
    if (!acts.length) continue;
    for (const x of acts) await quizasAvisar(o, x, ahora, dueno, k);
    await editarPanel(o, k.tipo);
    n += acts.length;
  }
  return n;
}

function listaDe(o, ahora, k) {
  vencer(o, ahora, k.tipo);
  const hitos = o.leer(k.hitoK) || {};
  const acts = k.acts.map((a) => {
    const l = anotados(o, a.id, k).map((x) => ({ quien: x.quien, nombre: x.nombre, dias: Math.floor((ahora - Number(x.t)) / DIA_MS),
      ev: eventosDe(o, x.quien) }));
    return { id: a.id, emoji: a.emoji, nombre: a.nombre, grupo: a.grupo, n: l.length, meta: meta(l.length, a.grupo), lista: l,
      hito: (hitos[a.id] || {}).hito || 0 };
  });
  const gente = Number((o.sql.exec(`SELECT COUNT(DISTINCT quien) AS n FROM ${k.tabla}`).toArray()[0] || {}).n) || 0;
  return { n: gente, actividades: acts, panel: o.leer(k.panelK) || null };
}

/**
 * 📋 Los anotados de hoy, para el Dashboard (con la clave del ciclo): por actividad, nombre, ID, hace cuántos días y cuántos
 * eventos. Lo de «De regreso» va en `vuelve`, con cuántos inactivos mandó el ciclo (`inactivos`) y cuándo (`cfg`).
 */
export function lista(o, ahora = Date.now()) {
  const nu = listaDe(o, ahora, TIPOS.nuevos);
  const vu = listaDe(o, ahora, TIPOS.vuelve);
  let cfg = null;
  try { cfg = o.leer('regreso_cfg'); } catch (e) { cfg = null; }
  vu.inactivos = Number((o.sql.exec('SELECT COUNT(*) AS n FROM regreso_inact').toArray()[0] || {}).n) || 0;
  vu.cfg = cfg;
  return { ok: true, n: nu.n, dias: DIAS, actividades: nu.actividades, panel: nu.panel, vuelve: vu };
}

/**
 * 📌 El panel: dónde está y dónde avisar al staff (`{canal, staff, msg?, publicar?, tipo?}`, con la clave del ciclo).
 *   · con `msg`: se anota ese mensaje como el panel y se le ponen los contadores de hoy
 *   · con `publicar`: si ya hay un panel en ese canal y sigue ahí, se EDITA; si no, se publica UNO y se anota
 *   · sin nada: sólo se anotan los canales
 *   · `tipo: 'vuelve'`: el panel «De regreso» (el suyo, en otro canal)
 * ⚠️ El mensaje lo arma el objeto (`panelMsg()`) y no la herramienta: el panel vive en un solo lugar.
 */
export async function panel(o, d) {
  const sf = /^[0-9]{15,25}$/;
  const k = tipoDe(d && d.tipo);
  const canal = String((d && d.canal) || ''), staff = String((d && d.staff) || '');
  if (!sf.test(canal) || (staff && !sf.test(staff)) || (d.msg && !sf.test(String(d.msg)))) return { error: 'faltan datos' };
  const antes = o.leer(k.panelK) || {};
  const p = { canal, staff: staff || antes.staff || '', msg: antes.canal === canal ? antes.msg || '' : '' };
  if (d.msg) p.msg = String(d.msg);
  if (!o.env || !o.env.DISCORD_TOKEN) return { error: 'sin token' };
  if (d.msg || (d.publicar && p.msg)) {
    o.guardar(k.panelK, p);
    const st = await editarPanel(o, k.tipo);
    if (st === 200) return { ok: true, msg: p.msg, editado: true };
    // 404: el panel que estaba anotado ya no existe; con `publicar` se publica otro
    if (!(d.publicar && st === 404 && !d.msg)) return { error: 'discord', estado: st, msg: p.msg };
    p.msg = '';
  }
  if (!d.publicar) { o.guardar(k.panelK, p); return { ok: true, msg: p.msg || '', anotado: true }; }
  let r = null, j = {};
  try {
    r = await pedir(o, `/channels/${canal}/messages`, { method: 'POST', body: JSON.stringify(panelMsgDe(k, cuentas(o, k.tipo))) });
    j = r.ok ? await r.json().catch(() => ({})) : {};
  } catch (e) { r = null; }
  if (!j.id) return { error: 'discord', estado: r ? r.status : 0 };
  p.msg = String(j.id);
  o.guardar(k.panelK, p);
  return { ok: true, msg: p.msg, nuevo: true };
}

/** El aviso de la campana del día en que alguien cruza los 45 (lo lee el buzón de hilos privados de DRA). Puro. */
export function avisoVuelve(dias, canalPanel) {
  return {
    titulo: '🔁 Te guardamos un lugar',
    cuerpo: ('Hace ' + dias + ' días que no juegas. En DRA hay actividades sólo para los que vuelven: anótate en el canal'
      + ' «De regreso» y juegas con otros que también vuelven.').slice(0, 240),
    url: canalPanel ? `https://discord.com/channels/${GUILD_DRA}/${canalPanel}` : 'https://underlegends.pages.dev/freestyle-rap/eventos',
  };
}

/**
 * 🔁 Lo que manda el ciclo (`inact` de `/primerizos-ciclo`, de bot/inactivos.py): `[[discord_id, días sin jugar,
 * 'YYYY-MM-DD' del último evento]]`, la lista ENTERA de hoy. Se escribe sólo lo que cambió (entró, salió o se corrigió
 * su último evento), así una vuelta sin cambios no escribe ni una fila. A quien entra con a lo sumo `VUELVE_DIAS +
 * VUELVE_AVISO_DIAS` días, un aviso en su campana, UNA vez (la clave lleva el día de su último evento: si vuelve y otro
 * día se va de nuevo, es otro aviso). `{ok, n, entran, salen, avisos}`.
 */
export function regresoCiclo(o, lista, ahora = Date.now()) {
  if (!Array.isArray(lista)) return { error: 'datos' };
  const nuevo = new Map();
  for (const f of lista.slice(0, 5000)) {
    const q = String((f && f[0]) || ''), dias = Number(f && f[1]), ult = String((f && f[2]) || '');
    if (QUIEN.test(q) && Number.isFinite(dias) && /^\d{4}-\d{2}-\d{2}$/.test(ult)) nuevo.set(q, { dias, ult });
  }
  const antes = new Map(o.sql.exec('SELECT quien, ult FROM regreso_inact').toArray().map((f) => [f.quien, f.ult]));
  let entran = 0, salen = 0, avisos = 0;
  const panelV = o.leer('regreso_panel') || {};
  for (const [q, v] of nuevo) {
    const ya = antes.get(q);
    if (ya === v.ult) continue;
    o.sql.exec('INSERT OR REPLACE INTO regreso_inact (quien, ult, t) VALUES (?, ?, ?)', q, v.ult, ahora);
    if (ya !== undefined) continue;
    entran++;
    if (!VUELVE_AVISAR || v.dias > VUELVE_DIAS + VUELVE_AVISO_DIAS || !o.aBandeja) continue;
    const clave = 'regreso:' + v.ult;
    let hay = false;
    try { hay = !!o.sql.exec('SELECT 1 AS x FROM bandeja WHERE quien = ? AND clave = ?', q, clave).toArray()[0]; } catch (e) { hay = false; }
    if (hay) continue;
    const a = avisoVuelve(v.dias, panelV.canal);
    try { o.aBandeja(q, clave, 'personal', a.titulo, a.cuerpo, a.url, '', ahora); avisos++; } catch (e) { /* la campana no frena la lista */ }
  }
  for (const q of antes.keys()) {
    if (nuevo.has(q)) continue;
    o.sql.exec('DELETE FROM regreso_inact WHERE quien = ?', q);
    salen++;
  }
  const previo = o.leer('regreso_cfg') || {};
  // la fila del estado se escribe sólo si cambió algo o pasó una hora (así «cuándo mandó el ciclo» sigue vivo sin
  // escribir cada media hora)
  if (entran || salen || previo.n !== nuevo.size || !previo.t || ahora - previo.t > 3600 * 1000) {
    o.guardar('regreso_cfg', { t: ahora, n: nuevo.size });
  }
  return { ok: true, n: nuevo.size, entran, salen, avisos };
}

/** «Olvidarme»: sus anotaciones a los dos paneles y su fila de inactivo. */
export function olvidar(o, quien) {
  for (const t of TABLAS_QUIEN) { try { o.sql.exec(`DELETE FROM ${t} WHERE quien = ?`, String(quien)); } catch (e) { /* sin la tabla */ } }
}
