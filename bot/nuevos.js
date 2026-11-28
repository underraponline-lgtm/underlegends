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
//: la del primer panel (`evn:si`) y la de las filas de antes de que hubiera actividades
export const ACT_VIEJA = 'comp';
export const MAX_EVENTOS = 2;
export const DIAS = 21;
//: el canal de `eventos-hoy` de DRA (`CANAL_RED` en avisos.js): a donde va quien ya no es nuevo
export const CANAL_EVENTOS_HOY = '1500690475089399858';
export const GUILD_DRA = '841017460341604382';
/** las tablas con `quien`: se mudan con la cuenta (`mudarCuenta()`) y se borran con «olvidarme» */
export const TABLAS_QUIEN = ['nuevos_anot'];

const DIA_MS = 24 * 3600 * 1000;
const QUIEN = /^[0-9]{5,25}$/;
const DC = 'https://discord.com/api/v10';
const UA = 'DiscordBot (https://underlegends.pages.dev, 1)';
// el mismo escape que `escMd()` de avisos.js: un nombre con `*` o `_` no rompe la lista del staff
const esc = (s) => String(s || '').replace(/([\\*_~|`>])/g, '\\$1');
const POR_ID = new Map(ACTIVIDADES.map((a) => [a.id, a]));
export const actividad = (id) => POR_ID.get(id === 'si' ? ACT_VIEJA : id) || null;
/** ¿Lo que trae el botón (`evn:<esto>`) es algo que el objeto entiende? `no`, `si` o una actividad */
export const accionValida = (x) => x === 'no' || !!actividad(x);
const titulo = (a) => a.emoji + ' ' + a.nombre;

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
}

/** El nombre que se ve: el apodo del servidor, el nombre global o el usuario (como lo muestra Discord), sin saltos. */
export function nombreDe(i) {
  const m = (i && i.member) || {};
  const u = m.user || (i && i.user) || {};
  return String(m.nick || u.global_name || u.username || 'Sin nombre').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Sin nombre';
}

/** «de 8», «de 16»…: el próximo grupo que se completa (con 0, el primero) */
export const meta = (n, grupo) => Math.max(grupo, Math.ceil(n / grupo) * grupo);

/** 🐣 El panel del canal, en V2 y público: `cuentas` es `{actividad: anotados}`. Lo arma el objeto al publicarlo y en cada cambio. */
export function panelMsg(cuentas) {
  const c = cuentas || {};
  const lineas = ACTIVIDADES.map((a) => {
    const n = Number(c[a.id]) || 0;
    return titulo(a) + ' · **' + n + ' de ' + meta(n, a.grupo) + '**' + (n >= a.grupo ? ' · ¡hay grupo! el staff está armando el día' : '');
  });
  const botones = ACTIVIDADES.map((a) => V.boton(a.nombre, 'evn:' + a.id, 3, { emoji: { name: a.emoji } }))
    .concat([V.boton('Ya no puedo', 'evn:no', 2)]);
  const filas = [];
  for (let k = 0; k < botones.length; k += 5) filas.push(botones.slice(k, k + 5));
  return V.mensaje({ color: V.COLOR.verde, efimero: false, filas, dentro: [
    V.T('## 🐣 Para los nuevos'),
    V.T('Actividades sólo para los que empiezan: nadie con más de ' + MAX_EVENTOS + ' eventos. Anótate en las que quieras'
      + ' y cuando se arme el grupo te avisamos con el día y la hora.'),
    V.sep(),
    V.T(lineas.join('\n') + '\n-# Toca una para entrar o salir. La anotación dura ' + DIAS + ' días.'),
  ] });
}

/** 📣 El aviso al staff: los anotados a esa actividad, en orden, con su mención (que no suena: `allowed_mentions` vacío). */
export function staffMsg(lista, hito, act) {
  const a = actividad(act) || actividad(ACT_VIEJA);
  const tope = 40;
  const filas = lista.slice(0, tope).map((x, k) => (k + 1) + '. ' + esc(x.nombre) + ' — <@' + x.quien + '>');
  if (lista.length > tope) filas.push('-# y ' + (lista.length - tope) + ' más');
  return V.mensaje({ color: V.COLOR.verde, efimero: false, menciones: { parse: [] }, dentro: [
    V.T('### 🐣 Ya hay ' + hito + ' anotados para ' + titulo(a)),
    V.T('-# Para los nuevos · grupos de ' + a.grupo),
    V.T(filas.join('\n')),
    V.T('Pónganle día y hora.'),
  ] });
}

/** Lo que contesta el botón, efímero, a partir de lo que dijo el objeto (`anotar()`): qué pasó y en cuáles está ahora. */
export function respuestaTxt(j) {
  const x = j || {};
  const a = actividad(x.act);
  const mias = (x.mias || []).map(actividad).filter(Boolean);
  const estoy = mias.length ? '\n-# Ahora estás en: ' + mias.map(titulo).join(' · ') + '.' : '\n-# Ya no estás en ninguna.';
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

/** `{actividad: anotados}`, todas (las que no tienen a nadie, en 0) */
export function cuentas(o) {
  const c = Object.fromEntries(ACTIVIDADES.map((a) => [a.id, 0]));
  for (const f of o.sql.exec('SELECT act, COUNT(*) AS n FROM nuevos_anot GROUP BY act').toArray()) if (f.act in c) c[f.act] = Number(f.n) || 0;
  return c;
}
const anotados = (o, act) => o.sql.exec('SELECT quien, nombre, t FROM nuevos_anot WHERE act = ? ORDER BY t, quien', act).toArray();
const misActs = (o, quien) => {
  const m = new Set(o.sql.exec('SELECT act FROM nuevos_anot WHERE quien = ?', quien).toArray().map((f) => f.act));
  return ACTIVIDADES.filter((a) => m.has(a.id)).map((a) => a.id);
};

/** Borra lo de más de 21 días. Devuelve las actividades que perdieron a alguien. */
export function vencer(o, ahora) {
  const hasta = ahora - DIAS * DIA_MS;
  const acts = [...new Set(o.sql.exec('SELECT act FROM nuevos_anot WHERE t < ?', hasta).toArray().map((f) => f.act))];
  if (acts.length) o.sql.exec('DELETE FROM nuevos_anot WHERE t < ?', hasta);
  return acts;
}

const pedir = (o, ruta, op) => fetch(DC + ruta, Object.assign({}, op, {
  headers: { Authorization: 'Bot ' + o.env.DISCORD_TOKEN, 'User-Agent': UA, 'Content-Type': 'application/json' },
}));

/** Edita los contadores del panel, si hay panel. Un PATCH, nunca un mensaje nuevo. Devuelve el estado de Discord (0 = nada). */
export async function editarPanel(o) {
  const p = o.leer('nuevos_panel') || {};
  if (!p.canal || !p.msg || !o.env || !o.env.DISCORD_TOKEN) return 0;
  try {
    const r = await pedir(o, `/channels/${p.canal}/messages/${p.msg}`, { method: 'PATCH', body: JSON.stringify(panelMsg(cuentas(o))) });
    return r.status;
  } catch (e) { return 0; }
}

/**
 * 📣 ¿Esa actividad llegó a un múltiplo nuevo de su grupo? Un mensaje al staff y a la campana de Dlx, UNA vez por múltiplo.
 * `nuevos_hito` guarda, por actividad, el último múltiplo avisado y QUIÉNES eran: si alguien sale y vuelve a entrar (7 → 8
 * con la misma gente) no se avisa de nuevo —tocar el botón dos veces no le llena el canal al staff—; si el grupo cambió
 * (salió uno y entró otro, o se vencieron y llegaron otros), sí, con la lista nueva. Al bajar, el múltiplo baja con la cuenta.
 */
async function quizasAvisar(o, act, ahora, dueno) {
  const a = actividad(act);
  if (!a) return false;
  const lista = anotados(o, a.id);
  const m = Math.floor(lista.length / a.grupo) * a.grupo;
  let todos = o.leer('nuevos_hito') || {};
  // la primera versión guardaba uno solo, `{hito, ids}`: era el de la competencia
  if (typeof todos.hito === 'number') todos = { [ACT_VIEJA]: { hito: todos.hito, ids: todos.ids || [] } };
  const h = todos[a.id] || { hito: 0, ids: [] };
  const guardar = (v) => o.guardar('nuevos_hito', Object.assign({}, todos, { [a.id]: v }));
  if (m < h.hito) { guardar({ hito: m, ids: h.ids || [] }); return false; }
  if (m === 0 || m === h.hito) return false;
  const ids = lista.map((x) => x.quien).sort();
  const antes = (h.ids || []).slice().sort();
  const mismo = ids.length === antes.length && ids.every((x, k) => x === antes[k]);
  guardar({ hito: m, ids, t: ahora });
  if (mismo) return false;
  const p = o.leer('nuevos_panel') || {};
  let url = '';
  if (p.staff && o.env && o.env.DISCORD_TOKEN) {
    try {
      const r = await pedir(o, `/channels/${p.staff}/messages`, { method: 'POST', body: JSON.stringify(staffMsg(lista, m, a.id)) });
      const j = r.ok ? await r.json().catch(() => ({})) : {};
      if (j.id) url = `https://discord.com/channels/${GUILD_DRA}/${p.staff}/${j.id}`;
    } catch (e) { /* la campana de Dlx igual */ }
  }
  if (o.aBandeja && dueno) {
    o.aBandeja(dueno, 'nuevos:' + a.id + ':' + m, 'liga', ('🐣 Ya hay ' + m + ' anotados para ' + titulo(a)).slice(0, 120),
      (lista.slice(0, 12).map((x) => x.nombre).join(', ') + (lista.length > 12 ? '…' : '') + '. Pónganle día y hora.').slice(0, 240), url, '', ahora);
  }
  return true;
}

/**
 * 🙋 Un clic del panel: `{quien, nombre, accion}` (quién lo dice el Worker, que lo leyó del clic firmado). `accion` es una
 * actividad (entra si no estaba, sale si estaba), `si` (la competencia, del primer panel) o `no` (sale de todas).
 * `dueno`: el Discord ID de Dlx (`DUENO` de avisos.js), para su campana.
 * `{ok, estado, act, mias, cuentas, eventos}`: anotado · quitado · jugo (más de 2 eventos) · todo_quitado · no_estaba.
 * Después de cualquier cambio, los contadores del panel y, si toca, el aviso al staff.
 */
export async function anotar(o, d, ahora = Date.now(), dueno = '') {
  const quien = String((d && d.quien) || '');
  if (!QUIEN.test(quien) || !d || !accionValida(d.accion)) return { error: 'faltan datos' };
  const tocadas = new Set(vencer(o, ahora));
  let estado = '', eventos = 0, act = '';
  if (d.accion === 'no') {
    const mias = misActs(o, quien);
    estado = mias.length ? 'todo_quitado' : 'no_estaba';
    if (mias.length) o.sql.exec('DELETE FROM nuevos_anot WHERE quien = ?', quien);
    for (const x of mias) tocadas.add(x);
  } else {
    act = actividad(d.accion).id;
    const esta = !!o.sql.exec('SELECT 1 AS x FROM nuevos_anot WHERE quien = ? AND act = ?', quien, act).toArray()[0];
    if (esta) {
      o.sql.exec('DELETE FROM nuevos_anot WHERE quien = ? AND act = ?', quien, act);
      estado = 'quitado';
      tocadas.add(act);
    } else {
      eventos = eventosDe(o, quien);
      if (eventos > MAX_EVENTOS) estado = 'jugo';
      else {
        const nombre = String(d.nombre || '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Sin nombre';
        o.sql.exec('INSERT INTO nuevos_anot (quien, act, nombre, t) VALUES (?, ?, ?, ?)', quien, act, nombre, ahora);
        estado = 'anotado';
        tocadas.add(act);
      }
    }
  }
  if (tocadas.size) {
    for (const x of tocadas) await quizasAvisar(o, x, ahora, dueno);
    await editarPanel(o);
  }
  return { ok: true, estado, act, mias: misActs(o, quien), cuentas: cuentas(o), eventos };
}

/** ⏰ Cada hora, desde el vigía: lo vencido se va y los contadores del panel se ponen al día (sólo si algo se fue). */
export async function vencerYEditar(o, ahora = Date.now(), dueno = '') {
  const acts = vencer(o, ahora);
  if (!acts.length) return 0;
  for (const x of acts) await quizasAvisar(o, x, ahora, dueno);
  await editarPanel(o);
  return acts.length;
}

/** 📋 Los anotados de hoy, para el Dashboard (con la clave del ciclo): por actividad, nombre, ID, hace cuántos días y cuántos eventos. */
export function lista(o, ahora = Date.now()) {
  vencer(o, ahora);
  const hitos = o.leer('nuevos_hito') || {};
  const acts = ACTIVIDADES.map((a) => {
    const l = anotados(o, a.id).map((x) => ({ quien: x.quien, nombre: x.nombre, dias: Math.floor((ahora - Number(x.t)) / DIA_MS),
      ev: eventosDe(o, x.quien) }));
    return { id: a.id, emoji: a.emoji, nombre: a.nombre, grupo: a.grupo, n: l.length, meta: meta(l.length, a.grupo), lista: l,
      hito: (hitos[a.id] || {}).hito || 0 };
  });
  const gente = Number((o.sql.exec('SELECT COUNT(DISTINCT quien) AS n FROM nuevos_anot').toArray()[0] || {}).n) || 0;
  return { ok: true, n: gente, dias: DIAS, actividades: acts, panel: o.leer('nuevos_panel') || null };
}

/**
 * 📌 El panel: dónde está y dónde avisar al staff (`{canal, staff, msg?, publicar?}`, con la clave del ciclo).
 *   · con `msg`: se anota ese mensaje como el panel y se le ponen los contadores de hoy
 *   · con `publicar`: si ya hay un panel en ese canal y sigue ahí, se EDITA; si no, se publica UNO y se anota
 *   · sin nada: sólo se anotan los canales
 * ⚠️ El mensaje lo arma el objeto (`panelMsg()`) y no la herramienta: el panel vive en un solo lugar.
 */
export async function panel(o, d) {
  const sf = /^[0-9]{15,25}$/;
  const canal = String((d && d.canal) || ''), staff = String((d && d.staff) || '');
  if (!sf.test(canal) || (staff && !sf.test(staff)) || (d.msg && !sf.test(String(d.msg)))) return { error: 'faltan datos' };
  const antes = o.leer('nuevos_panel') || {};
  const p = { canal, staff: staff || antes.staff || '', msg: antes.canal === canal ? antes.msg || '' : '' };
  if (d.msg) p.msg = String(d.msg);
  if (!o.env || !o.env.DISCORD_TOKEN) return { error: 'sin token' };
  if (d.msg || (d.publicar && p.msg)) {
    o.guardar('nuevos_panel', p);
    const st = await editarPanel(o);
    if (st === 200) return { ok: true, msg: p.msg, editado: true };
    // 404: el panel que estaba anotado ya no existe; con `publicar` se publica otro
    if (!(d.publicar && st === 404 && !d.msg)) return { error: 'discord', estado: st, msg: p.msg };
    p.msg = '';
  }
  if (!d.publicar) { o.guardar('nuevos_panel', p); return { ok: true, msg: p.msg || '', anotado: true }; }
  let r = null, j = {};
  try {
    r = await pedir(o, `/channels/${canal}/messages`, { method: 'POST', body: JSON.stringify(panelMsg(cuentas(o))) });
    j = r.ok ? await r.json().catch(() => ({})) : {};
  } catch (e) { r = null; }
  if (!j.id) return { error: 'discord', estado: r ? r.status : 0 };
  p.msg = String(j.id);
  o.guardar('nuevos_panel', p);
  return { ok: true, msg: p.msg, nuevo: true };
}
