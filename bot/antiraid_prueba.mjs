// 🛡️ LAS PRUEBAS DEL ANTI-RAID (18/10/2026). Primero lo puro de `bot/antiraid.js`; después la vuelta de cada minuto
// sobre el objeto de verdad (SQLite de Node, Discord falso) con lo que pasó en DDF el 17/10: una cuenta común con el
// rol «BOT» que expulsa a 49 en cinco minutos.
//
//     node bot/antiraid_prueba.mjs
import * as AR from './antiraid.js';

let fallas = 0;
const ok = (c, que, extra) => {
  if (c) console.log('  ✅ ' + que);
  else { fallas++; console.log('  ❌ ' + que + (extra ? '\n     ' + String(extra).slice(0, 400) : '')); }
};
const T = Date.parse('2026-10-17T22:49:00-04:00');
const sf = (t) => AR.snowflakeDe(t);

// ── lo puro ──────────────────────────────────────────────────────────────────────────────────────────────────────────
ok(AR.instante(sf(T)) === T, 'un snowflake vuelve al mismo instante');
ok(AR.oleada([[T - 3 * 60e3, 500], [T, 505]], T) === null && AR.oleada([[T - 3 * 60e3, 500], [T, 512]], T).entraron === 12,
  'oleada: 5 de más no es nada, 12 en tres minutos sí (el piso es 10)');
ok(AR.oleada([[T - 3 * 60e3, 2000], [T, 2030]], T) === null && !!AR.oleada([[T - 3 * 60e3, 2000], [T, 2040]], T),
  'oleada: en un servidor grande el umbral es el 2 % (40 de 2.000)');
ok(AR.oleada([[T, 500]], T) === null && AR.oleada([[T - 30e3, 400], [T, 500]], T) === null,
  'oleada: sin una muestra de hace 2 a 4 minutos no se compara');

const PELIG = new Set(['77']);
const U = { 9: { bot: false, username: 'jockiemusic.helper', global_name: 'Jockie Music (Helper)' }, 8: { bot: false, username: 'dominick' },
  5: { bot: true, username: 'mee6' } };
const dar = (id, quien, a, rol) => ({ id: sf(id), user_id: quien, target_id: a, action_type: 25,
  changes: [{ key: '$add', new_value: [{ id: rol, name: rol === '77' ? 'BOT' : 'Fan' }] }] });
ok(AR.riesgos([dar(T, '8', '9', '77')], U, PELIG, '1').map((r) => r.tipo + r.objetivo).join() === 'rol9',
  'un rol con permisos de expulsar a una cuenta que NO es un bot: aviso (lo de DDF)');
ok(AR.riesgos([dar(T, '8', '5', '77'), dar(T, '8', '9', '12')], U, PELIG, '1').length === 0,
  'el mismo rol a un bot de verdad, o un rol sin peligro a una persona: nada');
const echa = (n, quien, cada = 6e3, tipo = 20) => Array.from({ length: n }, (_, k) => ({ id: sf(T + k * cada), user_id: quien,
  target_id: String(100 + k), action_type: tipo }));
ok(AR.riesgos(echa(5, '9'), U, PELIG, '1').map((r) => r.tipo + r.n).join() === 'masivo5', 'cinco expulsiones en medio minuto: en masa');
ok(AR.riesgos(echa(5, '9', 60e3), U, PELIG, '1').length === 0, 'cinco en cinco minutos: no (la ventana es de 3)');
ok(AR.riesgos(echa(5, '1'), U, PELIG, '1').length === 0, 'lo que hace el propio bot no cuenta');
ok(AR.riesgos(echa(3, '8', 10e3, 12), U, PELIG, '1').map((r) => r.tipo).join() === 'borra', 'tres canales borrados seguidos: aviso');
ok(AR.riesgos([{ id: sf(T), user_id: '8', action_type: 21, options: { members_removed: '40' } }], U, PELIG, '1')
  .map((r) => r.tipo + r.n).join() === 'masivo40', 'una purga de 40: en masa, en una sola entrada');
const perm = (antes, despues, rol = '200') => ({ id: sf(T), user_id: '8', target_id: rol, action_type: 31,
  changes: [{ key: 'permissions', old_value: String(antes), new_value: String(despues) }] });
ok(AR.riesgos([perm(1024, 1024 | 8, '300')], U, PELIG, '1').map((r) => r.tipo + r.rol).join() === 'permiso300'
  && AR.riesgos([perm(8, 8 | 1024)], U, PELIG, '1').length === 0 && AR.riesgos([perm(0, 2048)], U, PELIG, '1').length === 0,
'un rol que GANA Administrador: aviso; uno que ya lo tenía, o que gana algo inocente: nada');
ok(AR.riesgos([{ id: sf(T), user_id: '8', target_id: '5', action_type: 28 }], U, PELIG, '1').map((r) => r.tipo).join() === 'bot',
  'se agregó un bot: aviso (informativo)');

const av = AR.aviso('300', { tipo: 'rol', quien: '8', objetivo: '9', rol: 'BOT' }, U);
const ids = av.components[0].components.map((b) => b.custom_id);
ok(ids.join() === 'ar:x:roles:300:9:8.9,ar:x:cerrar:300::8.9,ar:x:ok:300::8.9' && /no es un bot/.test(av.embeds[0].description)
  && /Jockie Music \(Helper\)/.test(av.embeds[0].description) && av.allowed_mentions.parse.length === 0,
'el aviso nombra a los dos, no menciona a nadie, y trae «sacarle los roles», «cerrar» y «ya lo vimos»');
ok(ids.every((x) => x.length <= 100), 'los custom_id entran en los 100 caracteres de Discord');
const largo = AR.aviso('300000000000000001', { tipo: 'rol', quien: '800000000000000008', objetivo: '900000000000000009', rol: 'X' }, U);
ok(largo.components[0].components.every((b) => b.custom_id.length <= 100), 'también con IDs de 18 cifras y los dos nombrados al final');

// ── la pasada de bugs del 19/10/2026: lo puro ──
const avF = AR.aviso('300', { tipo: 'masivo', quien: '8', n: 7 }, { 8: { username: 'x_y', global_name: '**ADMIN** [Soporte](https://mal.example)' } });
ok(!/\*\*ADMIN\*\*/.test(avF.embeds[0].description) && avF.embeds[0].description.includes('\\[Soporte\\](')
  && avF.embeds[0].description.includes('@x\\_y'), 'un nombre con formato no se dibuja en negrita ni como link', avF.embeds[0].description);
const crea = { id: sf(T), user_id: '8', target_id: '400', action_type: 30,
  changes: [{ key: 'name', new_value: 'Ayudante' }, { key: 'permissions', new_value: '8' }] };
const rs5 = AR.riesgos([crea, dar(T + 1000, '8', '9', '400')], U, PELIG, '1');
ok(rs5.map((r) => r.tipo).sort().join() === 'permiso,rol' && rs5.find((r) => r.tipo === 'permiso').nuevo
  && /creó el rol/.test(AR.aviso('300', rs5.find((r) => r.tipo === 'permiso'), U).embeds[0].description),
'un rol CREADO con Administrador avisa, y dárselo enseguida a una cuenta que no es un bot también', rs5.map((r) => r.tipo).join());
ok(AR.accionAuto({ tipo: 'masivo', quien: '5', n: 9 }, U) === null && AR.accionAuto({ tipo: 'masivo', quien: '9', n: 9 }, U).uid === '9'
  && AR.accionAuto({ tipo: 'rol', quien: '8', objetivo: '9' }, U).de === '8' && AR.accionAuto({ tipo: 'rol', quien: '8', objetivo: '9', viejo: true }, U) === null,
'AUTOMÁTICO no le saca los roles a un bot que expulsa (otro anti-raid), no actúa sobre lo viejo, y el rol recuerda quién lo dio');
ok(!/actúa AUTOMÁTICO/.test(AR.aviso('300', { tipo: 'masivo', quien: '5', n: 9 }, U, true).embeds[0].footer.text)
  && /actúa AUTOMÁTICO/.test(AR.aviso('300', { tipo: 'masivo', quien: '9', n: 9 }, U, true).embeds[0].footer.text),
'el pie del aviso dice la verdad: «actúa AUTOMÁTICO» sólo cuando va a actuar');

const rg = AR.reglas('555', ['discord.gg/abc'], false);
ok(rg.length === 4 && rg.map((r) => r.trigger_type).join() === '5,3,4,1'
  && rg.every((r) => r.actions.some((a) => a.type === 2 && a.metadata.channel_id === '555'))
  && rg.every((r) => !r.actions.some((a) => a.type === 3)),
'el escudo: cuatro reglas que avisan en el canal, y sin «aislar» si el bot no tiene ese permiso');
ok(AR.reglas('', [], true)[0].actions.some((a) => a.type === 3) && AR.reglas('', [], true)[2].actions.every((a) => a.type !== 3)
  && JSON.stringify(AR.reglas('', [], true)[2].trigger_metadata) === '{"presets":[3]}',
'con el permiso aísla a quien menciona en masa; la de odio sólo bloquea, y NO filtra groserías (es una liga de batallas)');
const inv = new RegExp(AR.reglas('', [])[3].trigger_metadata.regex_patterns[0].replace('(?i)', ''), 'i');
ok(inv.test('entren a discord.gg/xyz') && inv.test('https://discord.com/invite/AbC-1') && !inv.test('underlegends.pages.dev'),
  'la regla de invitaciones agarra discord.gg y discord.com/invite');

const pn = AR.panel('DDF', { canal: '', oleada: false }, '0');
const botonesPn = pn.components.flatMap((f) => f.components);
ok(/sólo el dueño|\*\*el dueño del servidor\*\*/.test(pn.content) && botonesPn.find((b) => b.custom_id === 'ar:oleada').disabled
  && /Gestionar servidor/.test(pn.content), 'el panel: sin canal no se prende la alarma, y dice qué permiso le falta al bot');
const pnA = AR.panel('DDF', { canal: '555', staff: true, auto: true }, '8');
ok(botonesPn.find((b) => b.custom_id === 'ar:auto').disabled && /AUTOMÁTICO/.test(pnA.content) && /Nunca expulsa ni banea/.test(pnA.content) && pnA.content.length < 1800
  && pnA.components[0].components.find((b) => b.custom_id === 'ar:auto').label === 'Apagar AUTOMÁTICO',
'AUTOMÁTICO en el panel: sin canal ni avisos prendidos no se prende, y dice que nunca expulsa ni banea');
ok(AR.faltan('8').length === 0 && AR.faltan(String((1n << 28n) | 128n | 32n)).length === 0, 'con Administrador o los tres permisos, no falta nada');
ok(AR.puedeResponder({ member: { permissions: '8' } }) && !AR.puedeResponder({ member: { permissions: String(1n << 28n) } }),
  'los botones de un aviso: sólo un admin (o el dueño, que tiene todo)');

// ── la vuelta de cada minuto, sobre el objeto ────────────────────────────────────────────────────────────────────────
let DatabaseSync = null;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { DatabaseSync = null; }
if (!DatabaseSync) {
  console.log('  ⓘ sin node:sqlite (Node ' + process.version + '): la vuelta no se prueba sobre el objeto');
} else {
  const A = await import('./avisos.js');
  const db = new DatabaseSync(':memory:');
  const sql = {
    exec(q, ...ps) {
      const t = String(q).trim();
      if (!ps.length && /;\s*\S/.test(t)) { db.exec(t); return { toArray: () => [] }; }
      const st = db.prepare(t);
      if (/^\s*(SELECT|WITH|PRAGMA)/i.test(t)) { const rows = st.all(...ps); return { toArray: () => rows }; }
      st.run(...ps);
      return { toArray: () => [] };
    },
  };
  const o = new A.Avisos({ storage: { sql, setAlarm() {}, getAlarm() { return null; } }, blockConcurrencyWhile: async (f) => f() },
    { DISCORD_TOKEN: 'x', KV: { get: async () => null } });
  await new Promise((r) => setTimeout(r, 5));
  const G = '300000000000000001', CANAL = '555000000000000001';
  let miembros = 600;
  let registro = [];
  const pedidos = [];
  const antesF = globalThis.fetch;
  globalThis.fetch = async (u, op = {}) => {
    const url = String(u);
    pedidos.push({ u: url, m: op.method || 'GET', b: op.body ? JSON.parse(op.body) : null });
    if (url.includes('with_counts')) return new Response(JSON.stringify({ approximate_member_count: miembros }));
    if (url.endsWith('/roles')) return new Response(JSON.stringify([{ id: '77', permissions: '6' }, { id: '12', permissions: '1024' }]));
    if (url.includes('/audit-logs')) {
      const desde = BigInt(new URL(url).searchParams.get('after') || '0');
      const nuevas = registro.filter((e) => BigInt(e.id) > desde);
      return new Response(JSON.stringify({ audit_log_entries: nuevas, users: Object.entries(U).map(([id, x]) => ({ id, ...x })) }));
    }
    return new Response(JSON.stringify({ id: 'm' + pedidos.length }));
  };
  // nadie lo prendió: la vuelta no le pide nada a Discord
  await o.antiraidVuelta(T);
  ok(pedidos.length === 0, 'sin ningún servidor con el anti-raid, la vuelta no hace ni un pedido');
  ok(o.antiraidGuardar({ gid: G, cfg: { canal: CANAL, oleada: true, staff: true, escudo: ['x', '123456'], raro: 1 } }).cfg.escudo.join() === '123456'
    && !('raro' in o.antiraidCfg(G)) && o.antiraidGuardar({ gid: 'abc', cfg: {} }).error === 'datos',
  'lo elegido se guarda validado: IDs de verdad y ningún campo de más');
  await o.antiraidVuelta(T);                           // primera vuelta: marca desde dónde leer
  ok(!pedidos.some((p) => p.u.includes('/audit-logs')), 'la primera vuelta no lee el registro: lo de antes de prenderlo no se avisa');
  // 22:50: le dan el rol BOT a la cuenta falsa; 22:51 a 22:53, expulsa
  registro = [dar(T + 60e3, '8', '9', '77'), ...echa(12, '9', 10e3).map((e, k) => ({ ...e, id: sf(T + 70e3 + k * 10e3) }))];
  const n0 = pedidos.length;
  await o.antiraidVuelta(T + 3 * 60e3);
  const mand = pedidos.slice(n0).filter((p) => p.m === 'POST' && p.u.endsWith('/channels/' + CANAL + '/messages'));
  const titulos = mand.map((p) => p.b.embeds[0].title);
  ok(titulos.length === 2 && titulos.some((x) => /rol peligroso/.test(x)) && titulos.some((x) => /en masa/.test(x)),
    'la vuelta avisa las dos cosas de DDF: el rol a una cuenta que no es un bot y las expulsiones en masa', titulos.join(' | '));
  const medAr = o.medidasVer().antiraid || {};
  ok(medAr.rol === 1 && medAr.masivo === 1, 'y queda medido en el estado del objeto (antes `medir` no tenía dónde guardarlo)', JSON.stringify(medAr));
  const n1 = pedidos.length;
  registro.push(...echa(3, '9', 5e3).map((e, k) => ({ ...e, id: sf(T + 4 * 60e3 + k * 5e3) })));
  await o.antiraidVuelta(T + 5 * 60e3);
  ok(!pedidos.slice(n1).some((p) => p.m === 'POST' && p.u.includes('/channels/')), 'lo mismo no se vuelve a avisar en la vuelta siguiente');
  // una oleada: 600 → 640 en tres minutos
  miembros = 640;
  const n2 = pedidos.length;
  await o.antiraidVuelta(T + 6 * 60e3);
  ok(pedidos.slice(n2).some((p) => p.m === 'POST' && p.b && p.b.embeds && /muchas cuentas/.test(p.b.embeds[0].title)),
    'entran 40 en tres minutos: avisa la oleada');
  // el pánico vence solo y vuelve la verificación
  o.antiraidGuardar({ gid: G, cfg: { canal: CANAL, cerrado: { hasta: new Date(T + 7 * 60e3).toISOString(), nivel: 1 } } });
  const n3 = pedidos.length;
  await o.antiraidVuelta(T + 8 * 60e3);
  const despues = pedidos.slice(n3);
  ok(despues.some((p) => p.m === 'PATCH' && p.b && p.b.verification_level === 1) && !o.antiraidCfg(G).cerrado
    && despues.some((p) => p.m === 'PUT' && p.u.endsWith('/incident-actions')),
  'el cierre vencido se abre solo: la verificación vuelve a como estaba');
  // la vuelta corre también de madrugada (el vigía dormido), y en su propio pedido
  o.antiraidGuardar({ gid: G, cfg: { canal: CANAL, oleada: true } });
  const n4 = pedidos.length;
  const rutas = [];
  const envO = { AVISOS: { idFromName: () => 'liga', get: () => ({ fetch: (u, op) => { rutas.push(new URL(u).pathname); return o.fetch(new Request(u, op)); } }) } };
  await A.vigilar(envO, [], '', true);
  ok(pedidos.slice(n4).some((p) => p.u.includes('with_counts')), 'de madrugada el vigía duerme, pero el anti-raid mira igual');
  ok(rutas.sort().join() === '/antiraid-vuelta,/vigilar',
    'el cron llama al vigía y al anti-raid por separado (cada uno con su presupuesto de pedidos y su candado)', rutas.join());

  // ── 🤖 AUTOMÁTICO (Dlx, 18/10/2026: «el bot toma decisiones si nadie está») ──
  const msgs = {};
  let nM = 0;
  const p2 = [];
  const miembroRoles = { 9: ['77', '55'] };
  globalThis.fetch = async (u, op = {}) => {
    const url = String(u);
    const m = op.method || 'GET';
    const b = op.body ? JSON.parse(op.body) : null;
    p2.push({ u: url, m, b });
    if (url.endsWith('/roles')) return new Response(JSON.stringify([{ id: '77', permissions: '6' }]));
    if (url.includes('/audit-logs')) {
      const desde = BigInt(new URL(url).searchParams.get('after') || '0');
      return new Response(JSON.stringify({ audit_log_entries: registro.filter((e) => BigInt(e.id) > desde),
        users: Object.entries(U).map(([id, x]) => ({ id, ...x })) }));
    }
    if (url.endsWith('/channels/' + CANAL + '/messages') && m === 'POST') { const id = String(700 + (++nM)); msgs[id] = b; return new Response(JSON.stringify({ id })); }
    const mm = /\/channels\/\d+\/messages\/(\d+)$/.exec(url);
    if (mm) {
      if (m === 'PATCH') msgs[mm[1]] = { ...msgs[mm[1]], ...b };
      return msgs[mm[1]] ? new Response(JSON.stringify(msgs[mm[1]])) : new Response('{}', { status: 404 });
    }
    if (/\/guilds\/\d+$/.test(url)) return new Response(JSON.stringify({ owner_id: '1', verification_level: 1 }));
    const mb = /\/members\/(\d+)$/.exec(url);
    if (mb && m === 'GET') return new Response(JSON.stringify({ roles: miembroRoles[mb[1]] || [] }));
    return new Response('{}');
  };
  o.antiraidGuardar({ gid: G, cfg: { canal: CANAL, staff: true, auto: true } });
  ok(o.antiraidCfg(G).auto === true, 'AUTOMÁTICO se guarda');
  const T2 = T + 40 * 60e3;
  registro = [dar(T2 - 90e3, '8', '9', '77')];
  await o.antiraidVuelta(T2 - 60e3);
  ok(!Object.values(msgs).some((x) => x.embeds), 'al volver a prender la vigilancia arranca de cero: lo de mientras estaba apagada no se avisa');
  registro = [dar(T2 - 30e3, '8', '9', '77')];
  await o.antiraidVuelta(T2);
  const avAuto = Object.entries(msgs).find(([, x]) => x.embeds && /rol peligroso/.test(x.embeds[0].title));
  ok(!!avAuto && /actúa AUTOMÁTICO/.test(avAuto[1].embeds[0].footer.text), 'con AUTOMÁTICO el aviso lo dice al pie');
  const q0 = p2.length;
  await o.antiraidVuelta(T2 + 60e3);
  ok(!p2.slice(q0).some((p) => p.m === 'PATCH' && p.u.includes('/members/')), 'al minuto todavía espera al staff');
  await o.antiraidVuelta(T2 + 2 * 60e3);
  const sacada = p2.slice(q0).find((p) => p.m === 'PATCH' && p.u.endsWith('/members/9'));
  const avDespues = msgs[avAuto[0]];
  const bsDespues = avDespues.components[0].components.map((b) => b.custom_id);
  ok(!!sacada && sacada.b.roles.length === 0 && /AUTOMÁTICO/.test(avDespues.embeds[0].description)
    && bsDespues[0] === 'ar:x:devolver:' + G + ':9' && !bsDespues.some((x) => x.startsWith('ar:x:roles:')),
  'a los dos minutos sin respuesta le saca los roles a la cuenta falsa, lo dice en el aviso y deja «Devolver los roles»', bsDespues.join());
  // (el ID de prueba es corto: `antiraidDevolver()` sólo acepta IDs de verdad, así que se mira lo guardado)
  ok(JSON.stringify(JSON.parse(sql.exec('SELECT est FROM antiraid WHERE gid = ?', G).toArray()[0].est).dev['9'].roles) === '["77","55"]'
    && o.antiraidDevolver({ gid: G, uid: '9' }).error === 'datos', 'y guarda los roles que tenía (y no se los da a un ID que no es de Discord)');
  // si alguien respondió (el aviso ya no tiene todos sus botones), no hace nada
  registro.push(dar(T2 + 3 * 60e3, '8', '9', '77'), { ...dar(T2 + 3 * 60e3 + 1, '8', '6', '77'), id: sf(T2 + 3 * 60e3 + 500) });
  U[6] = { bot: false, username: 'otro' };
  await o.antiraidVuelta(T2 + 4 * 60e3);
  const av2 = Object.entries(msgs).filter(([, x]) => x.embeds && /rol peligroso/.test(x.embeds[0].title) && /otro/.test(x.embeds[0].description));
  ok(av2.length === 1, 'otro aviso, por otra cuenta', Object.keys(msgs).join());
  msgs[av2[0][0]].components = [{ type: 1, components: [msgs[av2[0][0]].components[0].components[1]] }];
  const q1 = p2.length;
  await o.antiraidVuelta(T2 + 7 * 60e3);
  ok(!p2.slice(q1).some((p) => p.m === 'PATCH' && p.u.endsWith('/members/6')), 'si alguien tocó un botón, AUTOMÁTICO no hace nada');
  // sin AUTOMÁTICO, nunca
  o.antiraidGuardar({ gid: G, cfg: { canal: CANAL, staff: true } });
  registro.push({ ...dar(T2 + 8 * 60e3, '8', '7', '77'), id: sf(T2 + 8 * 60e3) });
  U[7] = { bot: false, username: 'tercero' };
  const q2 = p2.length;
  await o.antiraidVuelta(T2 + 9 * 60e3);
  await o.antiraidVuelta(T2 + 12 * 60e3);
  ok(!p2.slice(q2).some((p) => p.m === 'PATCH' && p.u.includes('/members/')), 'apagado, avisa y espera al staff para siempre');
  ok(AR.accionAuto({ tipo: 'bot', quien: '8', objetivo: '5' }) === null && AR.accionAuto({ tipo: 'oleada' }).que === 'cerrar',
    'un bot agregado no lo toca; una oleada, cierra');

  // ── el comando y los botones, de punta a punta ──
  const DUENO_G = '800000000000000001', OTRO = '800000000000000002';
  const env = { DISCORD_TOKEN: 'x', AVISOS: { idFromName: () => 'liga', get: () => ({ fetch: (u, op) => o.fetch(new Request(u, op)) }) } };
  const promesas = [];
  const h = { luego: (ctx, p) => promesas.push(p), idDe: (i) => i.member.user.id, aviso: (t) => ({ aviso: t }), nombre: 'DDF',
    pasan: ['discord.gg/liga'] };
  globalThis.fetch = async (u, op = {}) => {
    const url = String(u);
    if (url.startsWith('https://avisos/')) return antesF(u, op);
    pedidos.push({ u: url, m: op.method || 'GET', b: op.body ? JSON.parse(op.body) : null });
    if (/\/guilds\/\d+$/.test(url) && (op.method || 'GET') === 'GET') return new Response(JSON.stringify({ owner_id: DUENO_G, verification_level: 1 }));
    if (url.endsWith('/auto-moderation/rules')) return new Response(JSON.stringify({ id: String(900000000 + pedidos.length) }));
    if (url.endsWith('/invites')) return new Response(JSON.stringify([{ code: 'propia' }]));
    return new Response(JSON.stringify({ id: 'm' }));
  };
  const inter = (uid, extra = {}) => ({ guild_id: G, application_id: 'app', token: 'tok', app_permissions: '8',
    member: { user: { id: uid }, permissions: '8' }, ...extra });
  const editados = () => pedidos.filter((p) => p.u.includes('/messages/@original')).map((p) => p.b);
  let r = AR.comando(inter(OTRO), env, {}, h);
  await Promise.all(promesas.splice(0));
  ok((await r.json()).type === 5 && /sólo el dueño/.test(editados().pop().content), '`/antiraid` de un admin que no es el dueño: no le abre el panel');
  r = AR.comando(inter(DUENO_G), env, {}, h);
  await Promise.all(promesas.splice(0));
  ok(/Anti-raid de DDF/.test(editados().pop().content), 'el dueño abre su panel');
  const n5 = pedidos.length;
  r = AR.componente(inter(DUENO_G, { data: { custom_id: 'ar:escudo' } }), env, {}, h);
  await Promise.all(promesas.splice(0));
  const reglasPuestas = pedidos.slice(n5).filter((p) => p.m === 'POST' && p.u.endsWith('/auto-moderation/rules'));
  ok((await r.json()).type === 6 && reglasPuestas.length === 4 && o.antiraidCfg(G).escudo.length === 4
    && reglasPuestas[3].b.trigger_metadata.allow_list.join() === 'discord.gg/liga,discord.gg/propia',
  'prender el escudo crea las cuatro reglas, deja pasar las invitaciones de la Liga y las del servidor, y lo guarda');
  r = AR.componente(inter(OTRO, { data: { custom_id: 'ar:escudo' } }), env, {}, h);
  await Promise.all(promesas.splice(0));
  ok(o.antiraidCfg(G).escudo.length === 4, 'un admin que no es el dueño no lo puede apagar');
  const noAdmin = inter(OTRO, { data: { custom_id: 'ar:x:cerrar:' + G }, member: { user: { id: OTRO }, permissions: '0' } });
  ok(/dueño o un admin/.test(AR.componente(noAdmin, env, {}, h).aviso), 'el botón «cerrar» de un aviso no lo usa cualquiera');
  ok(/otro servidor/.test(AR.componente(inter(DUENO_G, { data: { custom_id: 'ar:x:cerrar:999999999' } }), env, {}, h).aviso),
    'ni desde otro servidor');

  // ── la pasada de bugs del 19/10/2026: los botones ──
  const aparteDe = () => pedidos.filter((p) => p.m === 'POST' && /\/webhooks\/app\/tok$/.test(p.u)).map((p) => p.b.content);
  const ROL_ALTO = '600000000000000001';
  AR.componente(inter(OTRO, { data: { custom_id: 'ar:x:ok:' + G + '::' + OTRO },
    message: { embeds: [{ description: 'x' }], components: [{ type: 1, components: [{ custom_id: 'ar:x:ok:' + G + '::' + OTRO }] }] } }), env, {}, h);
  await Promise.all(promesas.splice(0));
  ok(/habla de vos/.test(aparteDe().pop() || ''), 'la cuenta de la que habla el aviso no lo puede contestar (si no, apagaba AUTOMÁTICO)');
  const msgOk = { embeds: [{ description: 'aviso' }], components: [{ type: 1, components: [
    { custom_id: 'ar:x:devolver:' + G + ':900000000000000009' }, { custom_id: 'ar:x:ok:' + G }] }] };
  AR.componente(inter(DUENO_G, { data: { custom_id: 'ar:x:ok:' + G }, message: msgOk }), env, {}, h);
  await Promise.all(promesas.splice(0));
  ok(editados().pop().components[0].components.map((b) => b.custom_id).join() === 'ar:x:devolver:' + G + ':900000000000000009',
    '«Ya lo vimos» saca los botones del aviso pero deja «Devolver los roles»');
  const VICT = '900000000000000007';
  AR.componente(inter(OTRO, { data: { custom_id: 'ar:x:roles:' + G + ':' + VICT }, message: msgOk }), env, {}, h);
  await Promise.all(promesas.splice(0));
  ok(!pedidos.some((p) => p.m === 'PATCH' && p.u.endsWith('/members/' + VICT)) && /rol más alto/.test(aparteDe().pop() || ''),
    'un admin sin un rol más alto no usa al bot para sacarle los roles a otro');
  const conRoles = inter(OTRO, { data: { custom_id: 'ar:x:roles:' + G + ':' + VICT }, message: msgOk,
    member: { user: { id: OTRO }, permissions: '8', roles: [ROL_ALTO] } });
  const fAntes = globalThis.fetch;
  globalThis.fetch = async (u, op = {}) => {
    if (/\/guilds\/\d+$/.test(String(u)) && (op.method || 'GET') === 'GET') {
      pedidos.push({ u: String(u), m: 'GET', b: null });
      return new Response(JSON.stringify({ owner_id: DUENO_G, roles: [{ id: ROL_ALTO, position: 5 }] }));
    }
    return fAntes(u, op);
  };
  AR.componente(conRoles, env, {}, h);
  await Promise.all(promesas.splice(0));
  globalThis.fetch = fAntes;
  ok(pedidos.some((p) => p.m === 'PATCH' && p.u.endsWith('/members/' + VICT)), 'con un rol más alto, sí');

  // ── la pasada de bugs del 19/10/2026: la vuelta ──
  o.antiraidGuardar({ gid: G, cfg: { canal: CANAL } });   // el de arriba, apagado: que no se mezcle
  const G2 = '300000000000000002', C2 = '555000000000000002';
  const m3 = {};
  let nM3 = 0;
  const p3 = [];
  const audit3 = { status: 200, entradas: [] };
  const miembro3 = { status: 200, roles: ['77'] };
  let abrirOk = true;
  globalThis.fetch = async (u, op = {}) => {
    const url = String(u);
    const m = op.method || 'GET';
    const b = op.body ? JSON.parse(op.body) : null;
    p3.push({ u: url, m, b });
    if (url.endsWith('/roles')) return new Response(JSON.stringify([{ id: '77', permissions: '6' }]));
    if (url.includes('/audit-logs')) {
      if (audit3.status !== 200) return new Response('{}', { status: audit3.status });
      const desde = BigInt(new URL(url).searchParams.get('after') || '0');
      return new Response(JSON.stringify({ audit_log_entries: audit3.entradas.filter((e) => BigInt(e.id) > desde),
        users: Object.entries(U).map(([id, x]) => ({ id, ...x })) }));
    }
    if (url.endsWith('/incident-actions') || (/\/guilds\/\d+$/.test(url) && m === 'PATCH')) return new Response('{}', { status: abrirOk ? 200 : 403 });
    if (url.endsWith('/channels/' + C2 + '/messages') && m === 'POST') { const id = String(900 + (++nM3)); m3[id] = b; return new Response(JSON.stringify({ id })); }
    const mm = /\/channels\/\d+\/messages\/(\d+)$/.exec(url);
    if (mm) {
      if (m === 'PATCH') m3[mm[1]] = { ...m3[mm[1]], ...b };
      return m3[mm[1]] ? new Response(JSON.stringify(m3[mm[1]])) : new Response('{}', { status: 404 });
    }
    if (/\/guilds\/\d+$/.test(url)) return new Response(JSON.stringify({ owner_id: '1', verification_level: 1 }));
    const mb = /\/members\/(\d+)$/.exec(url);
    if (mb && m === 'GET') return new Response(JSON.stringify({ roles: miembro3.roles }), { status: miembro3.status });
    return new Response('{}');
  };
  const est2 = () => JSON.parse(sql.exec('SELECT est FROM antiraid WHERE gid = ?', G2).toArray()[0].est);
  const nuevos = (k) => Object.entries(m3).slice(k).map(([, x]) => x);
  const patchMiembro = (uid, desde) => p3.slice(desde).some((p) => p.m === 'PATCH' && p.u.endsWith('/members/' + uid));
  o.antiraidGuardar({ gid: G2, cfg: { canal: C2, staff: true, auto: true } });
  o.antiraidGuardar({ gid: G2, cfg: { cerrado: { hasta: new Date(Date.now() + 3600e3).toISOString(), nivel: 2 } }, solo: ['cerrado'] });
  ok(o.antiraidCfg(G2).staff === true && o.antiraidCfg(G2).auto === true && o.antiraidCfg(G2).canal === C2 && o.antiraidCfg(G2).cerrado.nivel === 2,
    'guardar un campo no pisa los demás (el panel ya no deshace lo que hizo AUTOMÁTICO mientras tanto)');
  o.antiraidGuardar({ gid: G2, cfg: { cerrado: null }, solo: ['cerrado'] });
  const T3 = T + 120 * 60e3;
  await o.antiraidVuelta(T3);
  // sin permiso para el registro: avisa una vez que está ciega, y no vuelve a preguntar por 10 minutos
  audit3.status = 403;
  let k = Object.keys(m3).length;
  await o.antiraidVuelta(T3 + 60e3);
  const qAud = p3.length;
  await o.antiraidVuelta(T3 + 2 * 60e3);
  ok(nuevos(k).filter((x) => /ciega/.test(x.content || '')).length === 1 && !p3.slice(qAud).some((p) => p.u.includes('/audit-logs')),
    'sin permiso para el registro avisa UNA vez que la vigilancia está ciega, y espera 10 minutos para volver a probar');
  // vuelve el permiso: lo de hace 10 minutos se avisa, pero sin AUTOMÁTICO
  audit3.status = 200;
  audit3.entradas = [dar(T3 + 2 * 60e3, '8', '9', '77')];
  k = Object.keys(m3).length;
  await o.antiraidVuelta(T3 + 12 * 60e3);
  const viejo = nuevos(k).find((x) => x.embeds && /rol peligroso/.test(x.embeds[0].title));
  ok(!!viejo && /no lo vio a tiempo/.test(viejo.embeds[0].description) && !/actúa AUTOMÁTICO/.test(viejo.embeds[0].footer.text)
    && !Object.keys(est2().pend || {}).length, 'lo que llegó tarde se avisa igual, pero AUTOMÁTICO no actúa sobre eso');
  // un aviso BORRADO no es un aviso respondido
  audit3.entradas.push(dar(T3 + 13 * 60e3, '8', '41', '77'));
  k = Object.keys(m3).length;
  await o.antiraidVuelta(T3 + 14 * 60e3);
  const idBorrado = Object.keys(m3).slice(k).find((id) => m3[id].embeds && /41/.test(m3[id].embeds[0].description));
  delete m3[idBorrado];
  let q = p3.length;
  k = Object.keys(m3).length;
  await o.antiraidVuelta(T3 + 16.5 * 60e3);
  ok(!!idBorrado && patchMiembro('41', q) && nuevos(k).some((x) => /AUTOMÁTICO/.test(x.content || '') && /no estaba/.test(x.content || '')
    && x.components[0].components[0].custom_id.startsWith('ar:x:devolver:')),
  'borrar el aviso no apaga AUTOMÁTICO: actúa y lo dice en un mensaje nuevo, con «Devolver los roles»');
  // sin poder leer sus roles, no se los saca
  audit3.entradas.push(dar(T3 + 17 * 60e3, '8', '42', '77'));
  k = Object.keys(m3).length;
  await o.antiraidVuelta(T3 + 18 * 60e3);
  const id42 = Object.keys(m3).slice(k).find((id) => m3[id].embeds && /42/.test(m3[id].embeds[0].description));
  miembro3.status = 500;
  q = p3.length;
  await o.antiraidVuelta(T3 + 20.5 * 60e3);
  miembro3.status = 200;
  ok(!patchMiembro('42', q) && /no pudo leer los roles/.test(m3[id42].embeds[0].description) && !(est2().dev || {})['42'],
    'si no puede leer los roles de alguien, no se los saca (no habría qué devolver)');
  // el rol que dio el dueño no se deshace
  audit3.entradas.push(dar(T3 + 21 * 60e3, '1', '44', '77'));
  k = Object.keys(m3).length;
  await o.antiraidVuelta(T3 + 22 * 60e3);
  const id44 = Object.keys(m3).slice(k).find((id) => m3[id].embeds && /44/.test(m3[id].embeds[0].description));
  q = p3.length;
  await o.antiraidVuelta(T3 + 24.5 * 60e3);
  ok(!patchMiembro('44', q) && /lo dio el dueño/.test(m3[id44].embeds[0].description), 'un rol que dio el dueño, AUTOMÁTICO no lo deshace');
  // dos avisos de la misma persona: una sola acción esperando
  const t25 = T3 + 25 * 60e3;
  audit3.entradas.push(...Array.from({ length: 5 }, (_, j) => ({ id: sf(t25 + j * 5e3), user_id: '43', target_id: String(500 + j), action_type: 20 })),
    ...Array.from({ length: 3 }, (_, j) => ({ id: sf(t25 + 30e3 + j * 5e3), user_id: '43', target_id: String(600 + j), action_type: 12 })));
  k = Object.keys(m3).length;
  await o.antiraidVuelta(T3 + 26 * 60e3);
  const titulos43 = nuevos(k).filter((x) => x.embeds).map((x) => x.embeds[0].title);
  const pend43 = Object.values(est2().pend || {}).filter((p) => p.a && p.a.uid === '43');
  ok(titulos43.length === 2 && pend43.length === 1, 'expulsa y borra en masa: dos avisos, pero una sola acción esperando', titulos43.join(' | '));
  // los roles guardados se suman: una segunda acción (ya sin roles) no pisa los que tenía
  sql.exec('UPDATE antiraid SET est = ? WHERE gid = ?', JSON.stringify({ ...est2(), dev: { 43: { roles: ['77', '88'], t: T3 } } }), G2);
  miembro3.roles = [];
  await o.antiraidVuelta(T3 + 28.5 * 60e3);
  miembro3.roles = ['77'];
  ok(JSON.stringify(((est2().dev || {})['43'] || {}).roles) === '["77","88"]', 'una segunda acción sobre la misma persona no borra los roles guardados',
    JSON.stringify(est2().dev));
  // el cierre vencido que no se pudo abrir sigue cerrado, avisa una vez y reintenta a los 10 minutos
  o.antiraidGuardar({ gid: G2, cfg: { cerrado: { hasta: new Date(T3 + 29 * 60e3).toISOString(), nivel: 1 } }, solo: ['cerrado'] });
  abrirOk = false;
  k = Object.keys(m3).length;
  await o.antiraidVuelta(T3 + 30 * 60e3);
  q = p3.length;
  await o.antiraidVuelta(T3 + 31 * 60e3);
  const reintento = p3.slice(q).some((p) => p.u.endsWith('/incident-actions'));
  ok(!!o.antiraidCfg(G2).cerrado && nuevos(k).filter((x) => /no pude abrir/.test(x.content || '')).length === 1 && !reintento,
    'si no pudo abrir, sigue cerrado (no se olvida del nivel de antes), avisa una vez y no insiste cada minuto');
  abrirOk = true;
  await o.antiraidVuelta(T3 + 41 * 60e3);
  ok(!o.antiraidCfg(G2).cerrado, 'a los 10 minutos vuelve a probar, y abre');
  // el bot ya no está en el servidor: una hora sin preguntar
  audit3.status = 404;
  await o.antiraidVuelta(T3 + 42 * 60e3);
  q = p3.length;
  await o.antiraidVuelta(T3 + 43 * 60e3);
  ok(!p3.slice(q).length, 'si Discord dice que el servidor no existe (sacaron al bot), deja de preguntar una hora');
  globalThis.fetch = antesF;
}

if (fallas) {
  console.log(`\n❌ ${fallas} prueba(s) del anti-raid fallaron`);
  process.exit(1);
}
console.log('\n✅ el anti-raid avisa lo de DDF, una vez, y sólo actúa solo con AUTOMÁTICO');
