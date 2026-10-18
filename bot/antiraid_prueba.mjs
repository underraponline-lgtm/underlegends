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
ok(ids.join() === 'ar:x:roles:300:9,ar:x:cerrar:300,ar:x:ok:300' && /no es un bot/.test(av.embeds[0].description)
  && /Jockie Music \(Helper\)/.test(av.embeds[0].description) && av.allowed_mentions.parse.length === 0,
'el aviso nombra a los dos, no menciona a nadie, y trae «sacarle los roles», «cerrar» y «ya lo vimos»');
ok(ids.every((x) => x.length <= 100), 'los custom_id entran en los 100 caracteres de Discord');

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
  // la vuelta corre también de madrugada (el vigía dormido)
  o.antiraidGuardar({ gid: G, cfg: { canal: CANAL, oleada: true } });
  const n4 = pedidos.length;
  await o.vigilar({ servidores: [], dueno: '', dormido: true });
  ok(pedidos.slice(n4).some((p) => p.u.includes('with_counts')), 'de madrugada el vigía duerme, pero el anti-raid mira igual');

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
  globalThis.fetch = antesF;
}

if (fallas) {
  console.log(`\n❌ ${fallas} prueba(s) del anti-raid fallaron`);
  process.exit(1);
}
console.log('\n✅ el anti-raid avisa lo de DDF, una vez, y nunca actúa solo');
