// 🛡️ EL ANTI-RAID (Dlx, 18/10/2026, después de que intentaran destruir DDF: «necesitamos que el bot tenga opciones anti
// raid en settings, algo opcional… pero que tenga un comando de setup solo para el propietario del servidor»). Eligió
// las cuatro partes, que AVISE con botones (decide el staff), y que mire también de madrugada.
//
// LO QUE PASÓ EN DDF (leído de su registro de auditoría, 17/10/2026): a las 22:49 ET alguien del staff le puso el rol
// «BOT» a una cuenta común que se hacía pasar por el bot de música Jockie («Jockie Music (Helper)», creada en julio);
// en cinco minutos expulsó a 49 personas y baneó a una, hasta que otro del staff la baneó. Por eso la regla más
// importante de la vigilancia no es contar expulsiones: es **avisar en el momento en que una cuenta que no es un bot
// recibe un rol con permisos de expulsar o banear**.
//
// LAS CUATRO PARTES (todas opcionales; las prende el DUEÑO del servidor con `/antiraid`):
//   1. ESCUDO: reglas de AutoMod que corre DISCORD, al instante y sin costo nuestro: menciones masivas, spam, odio y
//      links de invitación ajenos (las de los servidores de la Liga pasan). Bloquea, aísla y avisa.
//   2. OLEADA: el objeto mira cada minuto cuánta gente tiene el servidor; si entran muchos de golpe, avisa.
//   3. STAFF: el objeto lee cada minuto el registro de auditoría: expulsiones, baneos o borrados en masa, y un rol
//      peligroso para una cuenta que no es un bot. Avisa.
//   4. PÁNICO: pausa las invitaciones y los mensajes directos del servidor (lo trae Discord, hasta 24 h) y pone la
//      verificación al máximo; «abrir» lo deja como estaba.
// ⚠️ NUNCA ACTÚA SOLO: los avisos traen botones («Cerrar el servidor», «Sacarle los roles») y decide el staff.
//   5. 🤖 AUTOMÁTICO, EXPERIMENTAL (Dlx, 18/10/2026: «necesita una opción experimental llamada AUTOMÁTICO, el bot toma
//      decisiones si nadie está»). La única excepción a lo de arriba, y sólo si el dueño la prende: si NADIE toca un
//      botón de un aviso en `ESPERA_AUTO_MS`, el bot hace lo más seguro y reversible (`accionAuto()`): con una oleada
//      cierra el servidor; con un rol peligroso a una cuenta que no es un bot, se lo saca; con expulsiones, baneos o
//      borrados en masa o permisos peligrosos, le saca los roles a quien lo hace —y los guarda para devolverlos con un
//      botón—. Nunca expulsa ni banea, y no toca al dueño. «Alguien respondió» = el aviso ya no tiene todos sus botones.
// ⚠️ NUNCA POR MENSAJE DIRECTO (el bot no manda DMs): al canal que elige el dueño.

export const API = 'https://discord.com/api/v10';
export const AR_BASE = { canal: '', escudo: [], oleada: false, staff: false, cerrado: null, auto: false };

// 🔐 los permisos, en BigInt (el bitfield pasa de 2^53)
export const P = {
  ADMIN: 8n, EXPULSAR: 2n, BANEAR: 4n, CANALES: 16n, SERVIDOR: 32n, AUDITORIA: 128n, ROLES: 1n << 28n,
  WEBHOOKS: 1n << 29n, AISLAR: 1n << 40n,
};
//: un rol con alguno de éstos, dado a una cuenta que no es un bot, es lo que pasó en DDF
export const PELIGROSOS = P.ADMIN | P.EXPULSAR | P.BANEAR | P.CANALES | P.SERVIDOR | P.ROLES | P.WEBHOOKS;
//: cuántas expulsiones o baneos de UNA persona en `VENTANA_MS` son «en masa»; y borrados de canales o roles
export const MASIVO = 5;
export const BORRADOS = 3;
export const VENTANA_MS = 3 * 60 * 1000;
//: una oleada: tantas cuentas más en ~3 minutos (o el 2 % del servidor, lo que sea mayor)
export const OLEADA_MIN = 10;
//: lo mismo no se vuelve a avisar en este rato
export const REPETIR_MS = 20 * 60 * 1000;
//: el pánico dura esto si no se abre antes (Discord deja hasta 24 h)
export const PANICO_H = 6;
//: 🤖 AUTOMÁTICO: cuánto espera a que alguien toque un botón del aviso antes de actuar, y hasta cuándo lo sigue
//: intentando si Discord no contesta (después lo deja: ya pasó el momento)
export const ESPERA_AUTO_MS = 2 * 60 * 1000;
export const AUTO_TOPE_MS = 15 * 60 * 1000;
//: los roles que AUTOMÁTICO sacó se guardan esto, para «Devolver los roles»
export const DEVOLVER_MS = 7 * 24 * 3600e3;

const dc = (env, ruta, op = {}) => fetch(API + ruta, {
  ...op,
  headers: {
    authorization: 'Bot ' + env.DISCORD_TOKEN, 'content-type': 'application/json',
    'x-audit-log-reason': encodeURIComponent('Liga Global · anti-raid'), ...(op.headers || {}),
  },
});

const tieneP = (bits, p) => { try { return (BigInt(bits || '0') & p) !== 0n; } catch (e) { return false; } };
export const instante = (snowflake) => Number((BigInt(snowflake) >> 22n) + 1420070400000n);

/** ¿Quien toca es el DUEÑO del servidor? Se pregunta a Discord cada vez: el panel es sólo suyo (Dlx). */
export async function esDueno(env, gid, uid) {
  const r = await dc(env, `/guilds/${gid}`);
  if (!r.ok) return null;
  const g = await r.json();
  return String(g.owner_id || '') === String(uid || '');
}

/** ¿Puede responder a un aviso? El dueño o un administrador (`member.permissions`, que Discord ya calcula). */
export function puedeResponder(i) {
  return tieneP(i.member && i.member.permissions, P.ADMIN);
}

/** Lo que el bot puede hacer acá, de `app_permissions` de la interacción: qué partes andan y cuáles no. */
export function faltan(appPerms) {
  const f = [];
  if (!tieneP(appPerms, P.ADMIN)) {
    if (!tieneP(appPerms, P.SERVIDOR)) f.push('**Gestionar servidor** (el escudo y el botón de pánico)');
    if (!tieneP(appPerms, P.AUDITORIA)) f.push('**Ver el registro de auditoría** (la vigilancia del staff)');
    if (!tieneP(appPerms, P.ROLES)) f.push('**Gestionar roles** (sacarle los roles a alguien desde un aviso)');
  }
  return f;
}

// ── el panel ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const ON = (x) => (x ? '🟢 prendido' : '🔴 apagado');
export function panel(nombre, cfg, appPerms) {
  const c = { ...AR_BASE, ...(cfg || {}) };
  const cerrado = c.cerrado && Date.parse(c.cerrado.hasta || '') > Date.now();
  const sinCanal = !c.canal;
  const falta = faltan(appPerms);
  const texto = [
    `## 🛡️ Anti-raid de ${nombre}`,
    'Sólo lo ve y lo cambia **el dueño del servidor**. Todo es opcional y, salvo con AUTOMÁTICO, **nunca actúa solo**: ' +
    'los avisos traen botones y decide el staff. Nada va por mensaje directo.',
    '',
    `**1 · Escudo de Discord** · ${ON(c.escudo && c.escudo.length)}`,
    '> Reglas de AutoMod que corre Discord, **al instante**: bloquea menciones masivas (5 o más), spam, insultos de odio ' +
    'y links de invitación a otros servidores (los de la Liga pasan). A quien menciona en masa o pega links lo aísla 10 ' +
    'minutos. Avisa en el canal.',
    `**2 · Alarma de oleada** · ${ON(c.oleada)}`,
    '> Si entran muchas cuentas de golpe, avisa con un botón para cerrar el servidor. Mira cada minuto, de día y de noche.',
    `**3 · Vigilancia del staff** · ${ON(c.staff)}`,
    '> Si alguien expulsa, banea o borra canales en masa —o le da un rol con permisos de banear a una cuenta que **no es ' +
    'un bot**, como pasó en DDF—, avisa con un botón para sacarle los roles. Lee el registro de auditoría cada minuto.',
    `**4 · Botón de pánico** · ${cerrado ? `🚨 **cerrado** hasta <t:${Math.floor(Date.parse(c.cerrado.hasta) / 1000)}:t>` : 'abierto'}`,
    `> Pausa las invitaciones y los mensajes directos del servidor (hasta ${PANICO_H} h) y pone la verificación al ` +
    'máximo. **Abrir** lo deja como estaba.',
    `**5 · AUTOMÁTICO** _(experimental)_ · ${ON(c.auto)}`,
    `> Si **nadie responde** un aviso en ${ESPERA_AUTO_MS / 60000} minutos, actúa: con una oleada cierra el servidor; si no, ` +
    'le saca los roles a la cuenta en peligro o a quien hace el daño (se devuelven con un botón). **Nunca expulsa ni banea**.',
    '',
    `**Canal de los avisos** · ${c.canal ? `<#${c.canal}>` : '**elegí uno abajo** (sin canal, la 2 y la 3 no pueden avisar)'}`,
    falta.length ? '\n⚠️ Al bot le falta: ' + falta.join(' · ') + '.' : '',
  ].filter((x, k, a) => x !== '' || a[k - 1] !== '').join('\n');
  const btn = (id, label, on, extra = {}) => ({ type: 2, style: on ? 2 : 1, label, custom_id: id, ...extra });
  return {
    content: texto,
    components: [
      { type: 1, components: [
        btn('ar:escudo', c.escudo && c.escudo.length ? 'Apagar el escudo' : 'Prender el escudo', c.escudo && c.escudo.length),
        btn('ar:oleada', c.oleada ? 'Apagar la alarma' : 'Prender la alarma de oleada', c.oleada, { disabled: sinCanal && !c.oleada }),
        btn('ar:staff', c.staff ? 'Apagar la vigilancia' : 'Prender la vigilancia del staff', c.staff, { disabled: sinCanal && !c.staff }),
        btn('ar:auto', c.auto ? 'Apagar AUTOMÁTICO' : 'Prender AUTOMÁTICO', c.auto, { disabled: !c.auto && (sinCanal || !(c.oleada || c.staff)) }),
      ] },
      { type: 1, components: [{
        type: 8, custom_id: 'ar:canal', placeholder: 'El canal de los avisos (uno que vea el staff)',
        min_values: 0, max_values: 1, channel_types: [0],
      }] },
      { type: 1, components: [cerrado
        ? { type: 2, style: 3, label: 'Abrir el servidor', custom_id: 'ar:abrir' }
        : { type: 2, style: 4, label: '🚨 Cerrar el servidor', custom_id: 'ar:cerrar' }] },
    ],
  };
}

// ── 1 · el escudo: las reglas de AutoMod ─────────────────────────────────────────────────────────────────────────────
/** Las cuatro reglas. `canal` recibe el aviso; `pasan` son las invitaciones que no se bloquean (las de la Liga). */
export function reglas(canal, pasan = [], puedeAislar = true) {
  const bloquear = { type: 1, metadata: { custom_message: 'Bloqueado por el anti-raid de la Liga Global.' } };
  const avisar = canal ? [{ type: 2, metadata: { channel_id: String(canal) } }] : [];
  // ⏱️ aislar pide «Aislar temporalmente a miembros»: sin ese permiso Discord rechaza la regla entera, así que se omite
  const aislar = puedeAislar ? [{ type: 3, metadata: { duration_seconds: 600 } }] : [];
  const base = { event_type: 1, enabled: true };
  return [
    { ...base, name: 'Liga Global · menciones masivas', trigger_type: 5,
      trigger_metadata: { mention_total_limit: 5, mention_raid_protection_enabled: true }, actions: [bloquear, ...avisar, ...aislar] },
    { ...base, name: 'Liga Global · spam', trigger_type: 3, actions: [bloquear, ...avisar] },
    { ...base, name: 'Liga Global · odio', trigger_type: 4, trigger_metadata: { presets: [3] }, actions: [bloquear, ...avisar] },
    { ...base, name: 'Liga Global · invitaciones ajenas', trigger_type: 1,
      trigger_metadata: { regex_patterns: ['(?i)discord(?:\\.gg|(?:app)?\\.com/invite)/[a-z0-9-]+'], allow_list: pasan.slice(0, 100) },
      actions: [bloquear, ...avisar, ...aislar] },
  ];
}

/** Prende el escudo: crea las reglas que puede. `{ids, ya}`: las creadas y las que el servidor ya tenía de ese tipo. */
export async function prenderEscudo(env, gid, canal, pasan, puedeAislar) {
  const ids = [], ya = [];
  for (const r of reglas(canal, pasan, puedeAislar)) {
    const res = await dc(env, `/guilds/${gid}/auto-moderation/rules`, { method: 'POST', body: JSON.stringify(r) });
    if (res.ok) ids.push(String((await res.json()).id));
    else ya.push(r.name.replace('Liga Global · ', ''));
  }
  return { ids, ya };
}

export async function apagarEscudo(env, gid, ids) {
  for (const id of ids || []) await dc(env, `/guilds/${gid}/auto-moderation/rules/${id}`, { method: 'DELETE' });
}

// ── 4 · el pánico ────────────────────────────────────────────────────────────────────────────────────────────────────
export async function cerrar(env, gid, horas = PANICO_H) {
  const g = await (await dc(env, `/guilds/${gid}`)).json().catch(() => ({}));
  const hasta = new Date(Date.now() + horas * 3600e3).toISOString();
  const a = await dc(env, `/guilds/${gid}/incident-actions`, {
    method: 'PUT', body: JSON.stringify({ invites_disabled_until: hasta, dms_disabled_until: hasta }) });
  const v = await dc(env, `/guilds/${gid}`, { method: 'PATCH', body: JSON.stringify({ verification_level: 4 }) });
  return { ok: a.ok || v.ok, invitaciones: a.ok, verificacion: v.ok, hasta, nivel: Number.isInteger(g.verification_level) ? g.verification_level : 1 };
}

export async function abrir(env, gid, nivel) {
  const a = await dc(env, `/guilds/${gid}/incident-actions`, {
    method: 'PUT', body: JSON.stringify({ invites_disabled_until: null, dms_disabled_until: null }) });
  const v = await dc(env, `/guilds/${gid}`, { method: 'PATCH', body: JSON.stringify({ verification_level: Number.isInteger(nivel) ? nivel : 1 }) });
  return { ok: a.ok || v.ok };
}

/** Le saca todos los roles a alguien (desde un aviso). Falla si su rol está más arriba que el del bot. */
export async function sacarRoles(env, gid, uid) {
  const r = await dc(env, `/guilds/${gid}/members/${uid}`, { method: 'PATCH', body: JSON.stringify({ roles: [] }) });
  return { ok: r.ok, estado: r.status };
}

// ── 2 y 3 · lo que mira el objeto cada minuto ────────────────────────────────────────────────────────────────────────
/** ¿Una oleada? `muestras` son `[[t, miembros]]` de los últimos minutos (la última es la de ahora). */
export function oleada(muestras, ahora = Date.now()) {
  if (!muestras || muestras.length < 2) return null;
  const [, n] = muestras[muestras.length - 1];
  const antes = muestras.filter(([t]) => ahora - t <= 4 * 60 * 1000 && ahora - t >= 2 * 60 * 1000);
  if (!antes.length) return null;
  const n0 = Math.min(...antes.map(([, x]) => x));
  const umbral = Math.max(OLEADA_MIN, Math.ceil(n0 * 0.02));
  return n - n0 >= umbral ? { entraron: n - n0, umbral } : null;
}

/**
 * Lo raro del registro de auditoría. `entradas` son las nuevas; `usuarios` los que manda Discord con ellas
 * (`{id: {bot, username, global_name}}`); `peligrosos` los IDs de roles con permisos peligrosos; `yo` el ID del bot.
 * Devuelve `[{tipo, quien, n, objetivo, rol}]`: `masivo` (expulsa o banea en masa), `borra` (canales o roles),
 * `rol` (un rol peligroso para una cuenta que no es un bot) y `bot` (se agregó un bot).
 */
export function riesgos(entradas, usuarios, peligrosos, yo, ventana = VENTANA_MS) {
  const out = [];
  const por = {};
  for (const e of entradas || []) {
    if (!e || String(e.user_id) === String(yo)) continue;
    const t = instante(e.id);
    const q = String(e.user_id || '');
    const x = por[q] = por[q] || { echa: [], borra: [] };
    if (e.action_type === 20 || e.action_type === 22) x.echa.push(t);
    // la purga es UNA entrada con cuántos sacó
    if (e.action_type === 21 && Number((e.options || {}).members_removed || 0) >= MASIVO) {
      out.push({ tipo: 'masivo', quien: q, n: Number(e.options.members_removed) });
    }
    if (e.action_type === 12 || e.action_type === 32) x.borra.push(t);
    if (e.action_type === 25) {
      const u = usuarios[String(e.target_id)] || {};
      const puestos = ((e.changes || []).find((c) => c.key === '$add') || {}).new_value || [];
      const malo = puestos.find((r) => peligrosos.has(String(r.id)));
      if (malo && !u.bot) out.push({ tipo: 'rol', quien: q, objetivo: String(e.target_id), rol: malo.name || '' });
    }
    if (e.action_type === 28) out.push({ tipo: 'bot', quien: q, objetivo: String(e.target_id) });
    // un rol que GANA permisos peligrosos (el otro camino: darle «Administrador» a @everyone o a un rol que ya tienen)
    if (e.action_type === 31) {
      const c = (e.changes || []).find((x) => x.key === 'permissions') || {};
      let antes = 0n, despues = 0n;
      try { antes = BigInt(c.old_value || '0'); despues = BigInt(c.new_value || '0'); } catch (er) { /* sin cambio de permisos */ }
      if ((despues & PELIGROSOS & ~antes) !== 0n) out.push({ tipo: 'permiso', quien: q, rol: String(e.target_id) });
    }
  }
  const enVentana = (ts, k) => ts.sort((a, b) => a - b).some((t, i) => i + k - 1 < ts.length && ts[i + k - 1] - t <= ventana);
  for (const [q, x] of Object.entries(por)) {
    if (x.echa.length >= MASIVO && enVentana(x.echa, MASIVO)) out.push({ tipo: 'masivo', quien: q, n: x.echa.length });
    if (x.borra.length >= BORRADOS && enVentana(x.borra, BORRADOS)) out.push({ tipo: 'borra', quien: q, n: x.borra.length });
  }
  return out;
}

/** El aviso, con sus botones. `gid` va en el botón: el aviso se contesta sólo desde su custom_id. */
export function aviso(gid, r, usuarios = {}, auto = false) {
  const nom = (id) => { const u = usuarios[id] || {}; return (u.global_name || u.username || 'alguien') + (u.username ? ` (@${u.username})` : '') + ` · <@${id}>`; };
  const cerrar = { type: 2, style: 4, label: '🚨 Cerrar el servidor', custom_id: `ar:x:cerrar:${gid}` };
  const listo = { type: 2, style: 2, label: 'Ya lo vimos', custom_id: `ar:x:ok:${gid}` };
  const sacar = (uid) => ({ type: 2, style: 4, label: 'Sacarle los roles', custom_id: `ar:x:roles:${gid}:${uid}` });
  let titulo, texto, botones;
  if (r.tipo === 'oleada') {
    titulo = '🌊 Están entrando muchas cuentas';
    texto = `Entraron **${r.entraron}** en los últimos minutos. Si no esperaban gente, puede ser un raid: cerrar pausa las invitaciones y los mensajes directos y sube la verificación.`;
    botones = [cerrar, listo];
  } else if (r.tipo === 'rol') {
    titulo = '⚠️ Un rol peligroso para una cuenta que no es un bot';
    texto = `${nom(r.quien)} le dio el rol **${r.rol}** a ${nom(r.objetivo)}, que **no es un bot**: con ese rol puede expulsar, banear o ` +
      'administrar. Si es un moderador nuevo, toquen «Ya lo vimos»; si es una cuenta que se hace pasar por un bot, así empezó el raid a DDF.';
    botones = [sacar(r.objetivo), cerrar, listo];
  } else if (r.tipo === 'masivo') {
    titulo = '🚨 Expulsiones o baneos en masa';
    texto = `${nom(r.quien)} expulsó o baneó a **${r.n}** personas en pocos minutos.`;
    botones = [sacar(r.quien), cerrar, listo];
  } else if (r.tipo === 'permiso') {
    titulo = '⚠️ Un rol ganó permisos peligrosos';
    texto = `${nom(r.quien)} le dio permisos de administrar, expulsar o banear al rol <@&${r.rol}>${r.rol === gid ? ' (**@everyone**: todo el servidor)' : ''}.`;
    botones = [sacar(r.quien), cerrar, listo];
  } else if (r.tipo === 'borra') {
    titulo = '🚨 Borrados en masa';
    texto = `${nom(r.quien)} borró **${r.n}** canales o roles en pocos minutos.`;
    botones = [sacar(r.quien), cerrar, listo];
  } else {
    titulo = '🤖 Se agregó un bot';
    texto = `${nom(r.quien)} agregó a ${nom(r.objetivo)}. Si nadie lo esperaba, revisen qué permisos tiene.`;
    botones = [sacar(r.objetivo), listo];
  }
  return {
    embeds: [{ title: titulo, description: texto, color: r.tipo === 'bot' ? 0xE5B800 : 0xE41373,
      footer: { text: 'Anti-raid de la Liga Global · ' + (auto && accionAuto(r)
        ? `decide el staff; si nadie responde en ${ESPERA_AUTO_MS / 60000} minutos, actúa AUTOMÁTICO` : 'decide el staff') } }],
    components: [{ type: 1, components: botones }],
    allowed_mentions: { parse: [] },
  };
}

// ── 5 · 🤖 AUTOMÁTICO ────────────────────────────────────────────────────────────────────────────────────────────────
/** Qué hace AUTOMÁTICO con un aviso que nadie respondió: lo más seguro y reversible, o `null` (un bot agregado, nada). */
export function accionAuto(r) {
  if (!r) return null;
  if (r.tipo === 'oleada') return { que: 'cerrar' };
  if (r.tipo === 'rol' && r.objetivo) return { que: 'roles', uid: String(r.objetivo) };
  if (['masivo', 'borra', 'permiso'].includes(r.tipo) && r.quien) return { que: 'roles', uid: String(r.quien) };
  return null;
}

/** Cuántos botones tiene un mensaje: si el aviso tiene menos que al mandarlo, alguien ya lo respondió. */
export const botonesDe = (m) => ((m && m.components) || []).reduce((n, f) => n + ((f && f.components) || []).length, 0);

/**
 * AUTOMÁTICO actúa. Devuelve `{ok, linea, botones, cerrado?, dev?}`: la línea que se agrega al aviso, los botones para
 * deshacer («Abrir el servidor», «Devolver los roles») y lo que hay que guardar.
 */
export async function actuar(env, gid, acc) {
  const min = ESPERA_AUTO_MS / 60000;
  if (acc.que === 'cerrar') {
    const c = await cerrar(env, gid);
    return c.ok ? { ok: true, cerrado: { hasta: c.hasta, nivel: c.nivel },
      linea: `🤖 **AUTOMÁTICO**: nadie respondió en ${min} minutos y cerré el servidor hasta <t:${Math.floor(Date.parse(c.hasta) / 1000)}:t>.`,
      botones: [{ type: 2, style: 3, label: 'Abrir el servidor', custom_id: `ar:x:abrir:${gid}` }] }
      : { ok: false, linea: '🤖 AUTOMÁTICO quiso cerrar el servidor y no pudo: el bot necesita **Gestionar servidor**.', botones: [] };
  }
  const g = await (await dc(env, `/guilds/${gid}`)).json().catch(() => ({}));
  if (String(g.owner_id || '') === acc.uid) return { ok: false, linea: '🤖 AUTOMÁTICO no toca al dueño del servidor.', botones: [] };
  const m = await dc(env, `/guilds/${gid}/members/${acc.uid}`);
  const roles = m.ok ? ((((await m.json().catch(() => ({}))) || {}).roles) || []).map(String) : [];
  const s = await sacarRoles(env, gid, acc.uid);
  if (!s.ok) {
    return { ok: false, botones: [], linea: `🤖 AUTOMÁTICO quiso sacarle los roles a <@${acc.uid}> y no pudo: ` +
      (s.estado === 403 ? 'su rol está más arriba que el del bot, o el bot no tiene **Gestionar roles**.' : 'Discord no lo dejó.') };
  }
  return { ok: true, dev: { uid: acc.uid, roles },
    linea: `🤖 **AUTOMÁTICO**: nadie respondió en ${min} minutos y le saqué los roles a <@${acc.uid}>` +
      (roles.length ? ` (${roles.length}). Si fue un error, «Devolver los roles».` : '.'),
    botones: roles.length ? [{ type: 2, style: 2, label: 'Devolver los roles', custom_id: `ar:x:devolver:${gid}:${acc.uid}` }] : [] };
}

/** El aviso después de que AUTOMÁTICO actuó: su línea abajo, sin el botón de lo que ya hizo y con el de deshacer. */
export function tras(m, acc, x) {
  const hecho = acc.que === 'cerrar' ? 'ar:x:cerrar:' : 'ar:x:roles:';
  const emb = ((m && m.embeds) || []).map((e, k) => (k ? e : { ...e, description: String(e.description || '') + '\n\n' + x.linea }));
  const viejos = ((((m && m.components) || [])[0] || {}).components || []).filter((b) => !x.ok || !String(b.custom_id || '').startsWith(hecho));
  const bs = [...x.botones, ...viejos].slice(0, 5);
  return { embeds: emb, components: bs.length ? [{ type: 1, components: bs }] : [], allowed_mentions: { parse: [] } };
}

// el objeto lo usa para pedir a Discord con el mismo encabezado
export const pedir = dc;
export { tieneP };
/** El snowflake de un instante: la marca desde donde se empieza a leer el registro de auditoría. */
export const snowflakeDe = (t) => ((BigInt(Math.floor(t)) - 1420070400000n) << 22n).toString();
/** La clave de un aviso, para no repetirlo. */
export const claveAviso = (r) => [r.tipo, r.quien || '', r.objetivo || '', r.rol || ''].join(':');

// ═════════════════════════════════════════════════════════════════════
// LO QUE CONTESTA EL WORKER: `/antiraid` y sus botones
// ═════════════════════════════════════════════════════════════════════
// ⚠️ TODO VA DIFERIDO: preguntarle a Discord quién es el dueño y crear cuatro reglas puede pasar de los 3 segundos que
// tiene una interacción. Se contesta «pensando» (5) o «actualizo» (6) y se edita el mensaje original.
const objeto = (env) => env.AVISOS.get(env.AVISOS.idFromName('liga'));
async function leerCfg(env, gid) {
  const r = await objeto(env).fetch('https://avisos/antiraid-leer', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ gid }) });
  const j = await r.json().catch(() => ({}));
  return { ...AR_BASE, ...(j.cfg || {}) };
}
async function guardarCfg(env, gid, cfg) {
  const r = await objeto(env).fetch('https://avisos/antiraid-guardar', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ gid, cfg }) });
  return r.ok;
}
const editar = (i, data) => fetch(`${API}/webhooks/${i.application_id}/${i.token}/messages/@original`, {
  method: 'PATCH', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ allowed_mentions: { parse: [] }, ...data }) });
const aparte = (i, txt) => fetch(`${API}/webhooks/${i.application_id}/${i.token}`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ content: txt, flags: 64, allowed_mentions: { parse: [] } }) });
const diferir = (tipo, efimero) => new Response(JSON.stringify(efimero ? { type: tipo, data: { flags: 64 } } : { type: tipo }),
  { headers: { 'content-type': 'application/json' } });
export async function mandar(env, canal, cuerpo) {
  return dc(env, `/channels/${canal}/messages`, { method: 'POST', body: JSON.stringify({ allowed_mentions: { parse: [] }, ...cuerpo }) });
}
/** Las invitaciones que el escudo deja pasar: las de la Liga y las del propio servidor (con su URL personalizada). */
async function invitacionesPropias(env, gid) {
  const out = [];
  try {
    const r = await dc(env, `/guilds/${gid}/invites`);
    if (r.ok) for (const x of (await r.json()) || []) if (x.code) out.push('discord.gg/' + x.code);
    const g = await dc(env, `/guilds/${gid}/vanity-url`);
    if (g.ok) { const v = await g.json(); if (v.code) out.push('discord.gg/' + v.code); }
  } catch (e) { /* sin las propias, pasan las de la Liga */ }
  return out;
}

/** `/antiraid`: el panel, sólo para el dueño. `h` trae lo del Worker: `luego`, `idDe`, `aviso`, `nombre`, `pasan`. */
export function comando(i, env, ctx, h) {
  const gid = i.guild_id;
  if (!gid) return h.aviso('`/antiraid` va **adentro del servidor** que querés proteger.');
  h.luego(ctx, (async () => {
    try {
      const es = await esDueno(env, gid, h.idDe(i));
      if (es === null) return editar(i, { content: 'No pude preguntarle a Discord quién es el dueño del servidor: probá en un rato.' });
      if (!es) return editar(i, { content: '🛡️ El anti-raid lo configura **sólo el dueño del servidor**.' });
      return editar(i, panel(h.nombre, await leerCfg(env, gid), i.app_permissions));
    } catch (e) { return editar(i, { content: 'Algo falló al abrir el anti-raid: probá en un rato.' }); }
  })());
  return diferir(5, true);
}

/** Los botones: `ar:<acción>` del panel (sólo el dueño) y `ar:x:<acción>:<gid>[:<uid>]` de un aviso (dueño o admin). */
export function componente(i, env, ctx, h) {
  const p = String((i.data && i.data.custom_id) || '').split(':');
  return p[1] === 'x' ? deAviso(i, env, ctx, h, p) : delPanel(i, env, ctx, h, p[1]);
}

function delPanel(i, env, ctx, h, que) {
  const gid = i.guild_id;
  if (!gid) return h.aviso('Esto va adentro de un servidor.');
  const vals = (i.data && i.data.values) || [];
  h.luego(ctx, (async () => {
    try {
      const es = await esDueno(env, gid, h.idDe(i));
      if (!es) {
        return aparte(i, es === null ? 'No pude preguntarle a Discord quién es el dueño: probá en un rato.'
          : '🛡️ El anti-raid lo cambia **sólo el dueño del servidor**.');
      }
      const cfg = await leerCfg(env, gid);
      const ap = i.app_permissions;
      const aisla = tieneP(ap, P.ADMIN) || tieneP(ap, P.AISLAR);
      const nota = [];
      const pasan = async () => [...new Set([...(h.pasan || []), ...(await invitacionesPropias(env, gid))])];
      if (que === 'escudo') {
        if (cfg.escudo && cfg.escudo.length) {
          await apagarEscudo(env, gid, cfg.escudo);
          cfg.escudo = [];
          nota.push('Escudo apagado: borré sus reglas.');
        } else if (!tieneP(ap, P.ADMIN) && !tieneP(ap, P.SERVIDOR)) {
          nota.push('⚠️ Para el escudo el bot necesita **Gestionar servidor**.');
        } else {
          const { ids, ya } = await prenderEscudo(env, gid, cfg.canal, await pasan(), aisla);
          cfg.escudo = ids;
          nota.push(`Escudo prendido: ${ids.length} ${ids.length === 1 ? 'regla' : 'reglas'} de AutoMod.` +
            (ya.length ? ` No pude crear: ${ya.join(', ')} (o el servidor ya tiene una de ese tipo —Discord deja una sola— o al bot le falta un permiso).` : ''));
        }
      } else if (que === 'oleada') {
        cfg.oleada = !cfg.oleada && !!cfg.canal;
      } else if (que === 'staff') {
        if (!cfg.staff && !tieneP(ap, P.ADMIN) && !tieneP(ap, P.AUDITORIA)) {
          nota.push('⚠️ Para vigilar al staff el bot necesita **Ver el registro de auditoría**.');
        } else cfg.staff = !cfg.staff && !!cfg.canal;
      } else if (que === 'auto') {
        if (!cfg.auto && (!cfg.canal || !(cfg.oleada || cfg.staff))) {
          nota.push('🤖 AUTOMÁTICO actúa sobre los avisos: primero prendé la alarma de oleada o la vigilancia del staff.');
        } else {
          cfg.auto = !cfg.auto;
          nota.push(cfg.auto ? '🤖 AUTOMÁTICO prendido (experimental): si nadie responde un aviso en ' + (ESPERA_AUTO_MS / 60000) +
            ' minutos, el bot hace lo más seguro.' : 'AUTOMÁTICO apagado: los avisos vuelven a esperar al staff.');
        }
      } else if (que === 'canal') {
        const nuevo = String(vals[0] || '');
        if (nuevo && nuevo !== cfg.canal) {
          const r = await mandar(env, nuevo, {
            content: '🛡️ Acá van a llegar los avisos del **anti-raid de la Liga Global**. Los botones de cada aviso los puede usar el dueño o un admin.' });
          if (!r.ok) {
            nota.push('⚠️ No puedo escribir en <#' + nuevo + '>: dale al bot permiso de ver y escribir ahí, y elegilo otra vez.');
          } else {
            cfg.canal = nuevo;
            // las reglas avisan en un canal: si cambia, se rehacen
            if (cfg.escudo && cfg.escudo.length) {
              await apagarEscudo(env, gid, cfg.escudo);
              cfg.escudo = (await prenderEscudo(env, gid, nuevo, await pasan(), aisla)).ids;
            }
          }
        } else if (!nuevo) {
          cfg.canal = '';
          cfg.oleada = false;
          cfg.staff = false;
          cfg.auto = false;
        }
      } else if (que === 'cerrar') {
        const c = await cerrar(env, gid);
        if (c.ok) {
          cfg.cerrado = { hasta: c.hasta, nivel: (cfg.cerrado && cfg.cerrado.nivel) ?? c.nivel };
          nota.push('🚨 Servidor cerrado' + (c.invitaciones ? '' : ' (las invitaciones no se pudieron pausar)') +
            (c.verificacion ? '' : ' (la verificación no se pudo subir)') + '.');
          if (cfg.canal) {
            await mandar(env, cfg.canal, { content: `🚨 <@${h.idDe(i)}> cerró el servidor con el anti-raid: invitaciones y mensajes ` +
              `directos en pausa y verificación al máximo, hasta <t:${Math.floor(Date.parse(c.hasta) / 1000)}:t>.` });
          }
        } else nota.push('⚠️ No pude cerrar: el bot necesita **Gestionar servidor**.');
      } else if (que === 'abrir') {
        const a = await abrir(env, gid, cfg.cerrado && cfg.cerrado.nivel);
        if (a.ok) {
          cfg.cerrado = null;
          nota.push('Servidor abierto otra vez, como estaba.');
        } else nota.push('⚠️ No pude abrir: el bot necesita **Gestionar servidor**.');
      }
      await guardarCfg(env, gid, cfg);
      const pn = panel(h.nombre, cfg, ap);
      return editar(i, { ...pn, content: pn.content + (nota.length ? '\n\n' + nota.map((x) => '> ' + x).join('\n') : '') });
    } catch (e) { return aparte(i, 'Algo falló: probá de nuevo.'); }
  })());
  return diferir(6);
}

function deAviso(i, env, ctx, h, p) {
  const [, , que, gid, uid] = p;
  if (!gid || i.guild_id !== gid) return h.aviso('Ese aviso es de otro servidor.');
  if (!puedeResponder(i)) return h.aviso('Los botones del anti-raid los usan el dueño o un admin.');
  h.luego(ctx, (async () => {
    try {
      const quien = h.idDe(i);
      let linea = '', ok = true;
      if (que === 'cerrar') {
        const cfg = await leerCfg(env, gid);
        const c = await cerrar(env, gid);
        ok = c.ok;
        if (ok) {
          cfg.cerrado = { hasta: c.hasta, nivel: (cfg.cerrado && cfg.cerrado.nivel) ?? c.nivel };
          await guardarCfg(env, gid, cfg);
          linea = `🚨 <@${quien}> cerró el servidor hasta <t:${Math.floor(Date.parse(c.hasta) / 1000)}:t> (se abre con \`/antiraid\`).`;
        } else linea = '⚠️ No pude cerrar: el bot necesita **Gestionar servidor**.';
      } else if (que === 'roles' && /^\d{5,25}$/.test(uid || '')) {
        const s = await sacarRoles(env, gid, uid);
        ok = s.ok;
        linea = ok ? `🧹 <@${quien}> le sacó los roles a <@${uid}>.`
          : `⚠️ No pude sacarle los roles a <@${uid}>: ${s.estado === 403
            ? 'su rol está más arriba que el del bot, o el bot no tiene **Gestionar roles**' : 'Discord no me dejó'}.`;
      } else if (que === 'abrir') {
        const cfg = await leerCfg(env, gid);
        const a = await abrir(env, gid, cfg.cerrado && cfg.cerrado.nivel);
        ok = a.ok;
        if (ok) {
          cfg.cerrado = null;
          await guardarCfg(env, gid, cfg);
          linea = `🔓 <@${quien}> abrió el servidor otra vez.`;
        } else linea = '⚠️ No pude abrir: el bot necesita **Gestionar servidor**.';
      } else if (que === 'devolver' && /^\d{5,25}$/.test(uid || '')) {
        // 🤖 los roles que sacó AUTOMÁTICO: los guardó el objeto
        const r = await objeto(env).fetch('https://avisos/antiraid-devolver', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ gid, uid }) });
        const roles = (((await r.json().catch(() => ({}))) || {}).roles || []).map(String).filter((x) => /^\d{5,25}$/.test(x) && x !== gid);
        if (!roles.length) {
          ok = false;
          linea = `⚠️ No tengo guardados los roles de <@${uid}>: hay que devolvérselos a mano.`;
        } else {
          const s = await dc(env, `/guilds/${gid}/members/${uid}`, { method: 'PATCH', body: JSON.stringify({ roles }) });
          ok = s.ok;
          linea = ok ? `↩️ <@${quien}> le devolvió los roles a <@${uid}>.`
            : `⚠️ No pude devolverle los roles a <@${uid}>: ${s.status === 403 ? 'alguno está más arriba que el del bot' : 'Discord no me dejó'}.`;
        }
      } else if (que === 'ok') {
        linea = `✅ <@${quien}> lo vio.`;
      } else return aparte(i, 'No sé qué botón es ése.');
      const m = i.message || {};
      const emb = (m.embeds || []).map((e, k) => (k ? e : { ...e, description: String(e.description || '') + '\n\n' + linea }));
      // el botón usado se va (y todos, con «Ya lo vimos»); si falló, queda para reintentar
      const botones = que === 'ok' ? [] : ((((m.components || [])[0] || {}).components) || [])
        .filter((b) => !ok || !String(b.custom_id || '').startsWith('ar:x:' + que + ':'));
      return editar(i, { embeds: emb, components: botones.length ? [{ type: 1, components: botones }] : [] });
    } catch (e) { return aparte(i, 'Algo falló: probá de nuevo.'); }
  })());
  return diferir(6);
}
