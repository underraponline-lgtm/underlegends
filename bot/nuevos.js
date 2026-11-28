// 🐣 EL EVENTO DE NUEVOS, PASO 1: LA INSCRIPCIÓN (28/11/2026).
//
// Por qué existe: el 80 % de la gente juega un evento y no vuelve. Cuando Dlx les ofreció a mano a los nuevos «un evento
// sólo para los que empiezan», el 95 % dijo que sí, pero solo no lo podía organizar. Esto junta a los interesados solo y
// le avisa al staff cuando ya son 8. Lo decidido:
//   · SE JUEGA SIEMPRE EN DRA, y el panel vive en el canal que termina en «evento-nuevos» (todos lo ven, nadie escribe).
//   · ES PARA LOS QUE EMPIEZAN: 2 eventos o menos en la temporada (`jugo_temp`, lo que manda el ciclo con `racha_cfg.temp`,
//     como `tempJugo()` de bot/tienda.js). Quien no está en esa tabla no jugó: cuenta 0.
//   · NO PIDE ESTAR VERIFICADO: es justo para quien recién llega.
//   · UNA ANOTACIÓN DURA 21 DÍAS: el día y la hora todavía no están decididos, y una lista de hace dos meses le haría
//     convocar al staff a gente que ya se fue.
//   · CADA VEZ QUE LLEGA A UN MÚLTIPLO DE 8, UN mensaje en el canal privado del staff que termina en «recibidores», con
//     los nombres y sus menciones —sin que suene nadie— y lo mismo a la campana de Dlx.
//   · El día, la hora, el premio y quién lo conduce NO están decididos: acá no se agenda nada.
//
// ⚠️ EL PANEL ES UN SOLO MENSAJE QUE SE EDITA, nunca uno nuevo: el contador cambia con cada clic, y un mensaje por cambio
// sería una pared en un canal donde nadie puede escribir. Lo publica una vez el objeto (`nuevosPanel()`, a pedido de
// `herramientas/evento_nuevos_panel.py`) y queda anotado en `nuevos_panel`.
// ⚠️ NUNCA POR DM: todo lo que ve el jugador es la respuesta efímera del botón.
// ⚠️ Los botones son `evn:si` y `evn:no`, sin dueño: el panel es de todos y quién toca lo firma Discord.
import * as V from './vista.js';

export const CUPO = 8;
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

export function nuevosTablas(sql) {
  // quién se anotó, con qué nombre (el de Discord en ese momento) y cuándo: de ahí salen el vencimiento y el orden
  sql.exec('CREATE TABLE IF NOT EXISTS nuevos_anot (quien TEXT PRIMARY KEY, nombre TEXT NOT NULL, t INTEGER NOT NULL) WITHOUT ROWID');
  // el vencimiento corre cada hora: con el índice lee sólo lo que borra
  sql.exec('CREATE INDEX IF NOT EXISTS nuevos_anot_t ON nuevos_anot (t)');
}

/** El nombre que se ve: el apodo del servidor, el nombre global o el usuario (como lo muestra Discord), sin saltos. */
export function nombreDe(i) {
  const m = (i && i.member) || {};
  const u = m.user || (i && i.user) || {};
  return String(m.nick || u.global_name || u.username || 'Sin nombre').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Sin nombre';
}

/** «de 8», «de 16»…: el próximo grupo que se completa (con 0, el primero) */
export const meta = (n) => Math.max(CUPO, Math.ceil(n / CUPO) * CUPO);

/** 🐣 El panel del canal, en V2 y público. Lo arma el objeto al publicarlo y en cada cambio. */
export function panelMsg(n) {
  const lleno = n >= CUPO;
  return V.mensaje({ color: V.COLOR.verde, efimero: false, dentro: [
    V.T('## 🐣 Tu primer evento'),
    V.T('Un evento sólo para los que empiezan: nadie con más de ' + MAX_EVENTOS + ' eventos. Anótate y cuando seamos '
      + CUPO + ' te avisamos con el día y la hora.'),
    V.sep(),
    V.T('**Anotados: ' + n + ' de ' + meta(n) + '**'
      + (lleno ? '\n-# Ya somos ' + Math.floor(n / CUPO) * CUPO + ': el staff está armando el día y la hora.' : '')
      + '\n-# La anotación dura ' + DIAS + ' días.'),
  ], filas: [[V.boton('¡Quiero jugar!', 'evn:si', 3, { emoji: { name: '🙋' } }), V.boton('Ya no puedo', 'evn:no', 2)]] });
}

/** 📣 El aviso al staff: los anotados, en orden, con su mención (que no suena: `allowed_mentions` vacío). */
export function staffMsg(lista, hito) {
  const tope = 40;
  const filas = lista.slice(0, tope).map((x, k) => (k + 1) + '. ' + esc(x.nombre) + ' — <@' + x.quien + '>');
  if (lista.length > tope) filas.push('-# y ' + (lista.length - tope) + ' más');
  return V.mensaje({ color: V.COLOR.verde, efimero: false, menciones: { parse: [] }, dentro: [
    V.T('### 🐣 Ya hay ' + hito + ' anotados para el Evento de Nuevos'),
    V.T(filas.join('\n')),
    V.T('Pónganle día y hora.'),
  ] });
}

/** Lo que contesta el botón, efímero, a partir de lo que dijo el objeto (`nuevosAnotar()`). */
export function respuestaTxt(j) {
  const x = j || {};
  const cuantos = typeof x.n === 'number' ? '\n-# Anotados: ' + x.n + ' de ' + meta(x.n) + '.' : '';
  switch (x.estado) {
    case 'anotado': return '🐣 ¡Listo, estás anotado! Cuando seamos ' + CUPO + ' te avisamos en este canal con el día y la hora.' + cuantos;
    case 'ya': return '🐣 Ya estás anotado.' + cuantos;
    case 'jugo': return '🐣 Ya jugaste ' + x.eventos + ' eventos: este es para los que empiezan. ¡Mira los eventos de hoy en <#'
      + CANAL_EVENTOS_HOY + '>!';
    case 'quitado': return '👋 Listo, ya no estás anotado. Si cambias de idea, toca **¡Quiero jugar!** de nuevo.' + cuantos;
    case 'no_estaba': return 'No estabas anotado. Si quieres jugar, toca **¡Quiero jugar!**.';
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

const cuantos = (o) => Number((o.sql.exec('SELECT COUNT(*) AS n FROM nuevos_anot').toArray()[0] || {}).n) || 0;
const anotados = (o) => o.sql.exec('SELECT quien, nombre, t FROM nuevos_anot ORDER BY t, quien').toArray();

/** Borra lo de más de 21 días. Devuelve cuántas borró. */
export function vencer(o, ahora) {
  const viejos = o.sql.exec('SELECT quien FROM nuevos_anot WHERE t < ?', ahora - DIAS * DIA_MS).toArray();
  if (viejos.length) o.sql.exec('DELETE FROM nuevos_anot WHERE t < ?', ahora - DIAS * DIA_MS);
  return viejos.length;
}

const pedir = (o, ruta, op) => fetch(DC + ruta, Object.assign({}, op, {
  headers: { Authorization: 'Bot ' + o.env.DISCORD_TOKEN, 'User-Agent': UA, 'Content-Type': 'application/json' },
}));

/** Edita el contador del panel, si hay panel. Un PATCH, nunca un mensaje nuevo. Devuelve el estado de Discord (0 = nada). */
export async function editarPanel(o) {
  const p = o.leer('nuevos_panel') || {};
  if (!p.canal || !p.msg || !o.env || !o.env.DISCORD_TOKEN) return 0;
  try {
    const r = await pedir(o, `/channels/${p.canal}/messages/${p.msg}`, { method: 'PATCH', body: JSON.stringify(panelMsg(cuantos(o))) });
    return r.status;
  } catch (e) { return 0; }
}

/**
 * 📣 ¿Llegó a un múltiplo de 8 nuevo? Un mensaje al staff y a la campana de Dlx, UNA vez por múltiplo.
 * `nuevos_hito` guarda el último múltiplo avisado y QUIÉNES eran: si alguien sale y vuelve a entrar (7 → 8 con la misma
 * gente) no se avisa de nuevo —tocar los dos botones no le llena el canal al staff—; si el grupo cambió (salió uno y entró
 * otro, o se vencieron y llegaron otros), sí, con la lista nueva. Al bajar, el múltiplo baja con la cuenta.
 */
async function quizasAvisar(o, ahora, dueno) {
  const lista = anotados(o);
  const m = Math.floor(lista.length / CUPO) * CUPO;
  const h = o.leer('nuevos_hito') || { hito: 0, ids: [] };
  if (m < h.hito) { o.guardar('nuevos_hito', { hito: m, ids: h.ids || [] }); return false; }
  if (m === 0 || m === h.hito) return false;
  const ids = lista.map((x) => x.quien).sort();
  const antes = (h.ids || []).slice().sort();
  const mismo = ids.length === antes.length && ids.every((x, k) => x === antes[k]);
  o.guardar('nuevos_hito', { hito: m, ids, t: ahora });
  if (mismo) return false;
  const p = o.leer('nuevos_panel') || {};
  let url = '';
  if (p.staff && o.env && o.env.DISCORD_TOKEN) {
    try {
      const r = await pedir(o, `/channels/${p.staff}/messages`, { method: 'POST', body: JSON.stringify(staffMsg(lista, m)) });
      const j = r.ok ? await r.json().catch(() => ({})) : {};
      if (j.id) url = `https://discord.com/channels/${GUILD_DRA}/${p.staff}/${j.id}`;
    } catch (e) { /* la campana de Dlx igual */ }
  }
  if (o.aBandeja && dueno) {
    o.aBandeja(dueno, 'nuevos:' + m, 'liga', ('🐣 Ya hay ' + m + ' anotados para el Evento de Nuevos').slice(0, 120),
      (lista.slice(0, 12).map((x) => x.nombre).join(', ') + (lista.length > 12 ? '…' : '') + '. Pónganle día y hora.').slice(0, 240), url, '', ahora);
  }
  return true;
}

/**
 * 🙋 Un clic del panel: `{quien, nombre, accion: 'si'|'no'}` (quién lo dice el Worker, que lo leyó del clic firmado).
 * `dueno`: el Discord ID de Dlx (`DUENO` de avisos.js), para su campana.
 * `{ok, estado, n, eventos}`: anotado · ya · jugo (más de 2 eventos) · quitado · no_estaba. Después de cualquier cambio,
 * el contador del panel y, si toca, el aviso al staff.
 */
export async function anotar(o, d, ahora = Date.now(), dueno = '') {
  const quien = String((d && d.quien) || '');
  if (!QUIEN.test(quien) || !d || (d.accion !== 'si' && d.accion !== 'no')) return { error: 'faltan datos' };
  const vencidas = vencer(o, ahora);
  const esta = !!o.sql.exec('SELECT 1 AS x FROM nuevos_anot WHERE quien = ?', quien).toArray()[0];
  let estado = '', eventos = 0;
  if (d.accion === 'no') {
    estado = esta ? 'quitado' : 'no_estaba';
    if (esta) o.sql.exec('DELETE FROM nuevos_anot WHERE quien = ?', quien);
  } else if (esta) {
    estado = 'ya';
  } else {
    eventos = eventosDe(o, quien);
    if (eventos > MAX_EVENTOS) estado = 'jugo';
    else {
      const nombre = String(d.nombre || '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Sin nombre';
      o.sql.exec('INSERT INTO nuevos_anot (quien, nombre, t) VALUES (?, ?, ?)', quien, nombre, ahora);
      estado = 'anotado';
    }
  }
  const cambio = vencidas > 0 || estado === 'anotado' || estado === 'quitado';
  if (cambio) {
    await quizasAvisar(o, ahora, dueno);
    await editarPanel(o);
  }
  return { ok: true, estado, n: cuantos(o), eventos };
}

/** ⏰ Cada hora, desde el vigía: lo vencido se va y el contador del panel se pone al día (sólo si algo se fue). */
export async function vencerYEditar(o, ahora = Date.now(), dueno = '') {
  if (!vencer(o, ahora)) return 0;
  await quizasAvisar(o, ahora, dueno);
  await editarPanel(o);
  return 1;
}

/** 📋 Los anotados de hoy, para el Dashboard (con la clave del ciclo): nombre, ID, hace cuántos días y cuántos eventos. */
export function lista(o, ahora = Date.now()) {
  vencer(o, ahora);
  const l = anotados(o).map((x) => ({ quien: x.quien, nombre: x.nombre, dias: Math.floor((ahora - Number(x.t)) / DIA_MS),
    ev: eventosDe(o, x.quien) }));
  return { ok: true, n: l.length, cupo: CUPO, meta: meta(l.length), dias: DIAS, lista: l,
    panel: o.leer('nuevos_panel') || null, hito: (o.leer('nuevos_hito') || {}).hito || 0 };
}

/**
 * 📌 El panel: dónde está y dónde avisar al staff (`{canal, staff, msg?, publicar?}`, con la clave del ciclo).
 *   · con `msg`: se anota ese mensaje como el panel y se le pone el contador de hoy
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
    r = await pedir(o, `/channels/${canal}/messages`, { method: 'POST', body: JSON.stringify(panelMsg(cuantos(o))) });
    j = r.ok ? await r.json().catch(() => ({})) : {};
  } catch (e) { r = null; }
  if (!j.id) return { error: 'discord', estado: r ? r.status : 0 };
  p.msg = String(j.id);
  o.guardar('nuevos_panel', p);
  return { ok: true, msg: p.msg, nuevo: true };
}
