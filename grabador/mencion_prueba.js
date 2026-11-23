// 🧪 @ULAYA card (mencion.js), sin red y sin Discord: qué se lee de cada mensaje, qué se manda al Worker y qué se publica.
//
//     node mencion_prueba.js
import { leerMencion, cuerpo, Menciones, AYUDA } from './mencion.js';

let mal = 0;
const ok = (c, que, det = '') => { console.log((c ? '  ✅ ' : '  ❌ ') + que + (c || !det ? '' : '   ' + det)); if (!c) mal++; };
const BOT = '1550026808404217926', ROL = '1550000000000000001', A = '700000000000000001', B = '700000000000000002';
const L = (t) => JSON.stringify(leerMencion(t, BOT, ROL));

console.log('\nqué se pidió\n');
ok(L(`<@${BOT}> card`) === '{"cmd":"card"}', '«@ULAYA card»: tu carta', L(`<@${BOT}> card`));
ok(L(`<@!${BOT}>   Carta <@${A}>`) === `{"cmd":"card","quien":"${A}"}`, '«@ULAYA carta @alguien» (también con ! y mayúscula): la de esa persona');
ok(L(`<@&${ROL}> card`) === '{"cmd":"card"}', 'mencionando el ROL del bot también vale');
ok(L(`<@${BOT}> vs <@${A}>`) === `{"cmd":"versus","rival":"${A}"}`, '«@ULAYA vs @alguien»: el versus');
ok(L(`<@${BOT}> versus <@${A}> <@${B}> país`) === `{"cmd":"versus","rival":"${A}","contra":"${B}","carta":"pais"}`,
  '«@ULAYA versus @a @b país»: a contra b, con la carta de País (sin tilde también)');
ok(L(`<@${BOT}> vs`) === '{"cmd":"falta_rival"}', '«@ULAYA vs» sin nadie: se le pregunta contra quién');
ok(L(`<@${BOT}> ayuda`) === '{"cmd":"ayuda"}', '«@ULAYA ayuda»');
ok(L(`<@${BOT}> hola, cómo va`) === 'null' && L(`<@${A}> card`) === 'null' && L('card') === 'null',
  'una charla con el bot, una mención a otro o sin mención: nada (no contesta)');

console.log('\nlo que se publica\n');
const c = cuerpo({ flags: 64 | 32768, components: [{ type: 17 }], allowed_mentions: { parse: ['users'] }, tts: true }, '999');
ok(c.flags === 32768 && !c.tts && c.allowed_mentions.parse.length === 0 && c.allowed_mentions.replied_user === false
  && c.message_reference.message_id === '999' && c.message_reference.fail_if_not_exists === false,
  'como respuesta al mensaje, sin el flag de efímero y sin que suene nadie (tampoco quien preguntó)');

console.log('\nel camino entero, con un Discord y un Worker de mentira\n');
const pedidos = [];
globalThis.fetch = async (url, op = {}) => {
  pedidos.push({ url: String(url), metodo: op.method || 'GET', cuerpo: op.body ? JSON.parse(op.body) : null, h: op.headers || {} });
  if (String(url).endsWith('/mencion')) {
    const d = JSON.parse(op.body);
    return new Response(JSON.stringify(d.cmd === 'card' ? { ok: true, efimero: false, msg: { flags: 32768, components: [{ type: 12 }] } }
      : { ok: true, efimero: true, msg: { flags: 32832, components: [] } }), { status: 200 });
  }
  if (/\/channels\/\d+\/messages$/.test(String(url))) return new Response(JSON.stringify({ id: '555' }), { status: 200 });
  return new Response('{}', { status: 200 });
};
const usuarios = (ids) => new Map(ids.map((id) => [id, { id, username: 'u' + id.slice(-1), globalName: null, avatar: null }]));
const msj = (texto, ids, permisos = true, autor = A, bot = false) => ({
  id: '800000000000000' + String(pedidos.length).padStart(3, '0'), content: texto, webhookId: null,
  author: { id: autor, bot, username: 'ana', globalName: 'Ana', avatar: null },
  guild: { id: '900000000000000001', roles: { botRoleFor: () => ({ id: ROL }) }, members: { me: {} } },
  member: { nickname: null, roles: { cache: new Map([['111111111111111111', {}]]) } },
  channel: { id: '910000000000000001', permissionsFor: () => ({ has: () => permisos }) },
  mentions: { users: usuarios(ids), roles: new Map(), members: new Map() },
});
const M = new Menciones({ client: { user: { id: BOT } }, token: 't', vigia: 'https://w', clave: 'k', anotar: () => {} });
await M.recibir(msj(`<@${BOT}> card <@${B}>`, [BOT, B]));
const alW = pedidos.find((p) => p.url === 'https://w/mencion');
const pub = pedidos.find((p) => /\/messages$/.test(p.url));
ok(alW && alW.h['x-lg-ciclo'] === 'k' && alW.cuerpo.quien === B && alW.cuerpo.u.id === A && alW.cuerpo.otros[0].id === B
  && alW.cuerpo.roles[0] === '111111111111111111', 'al Worker: con la clave del ciclo, quién pide, a quién, y sus roles');
ok(pub && pub.metodo === 'POST' && pub.h.Authorization === 'Bot t' && pub.cuerpo.message_reference && pub.cuerpo.flags === 32768,
  'y se publica como respuesta, con el token del bot');
pedidos.length = 0;
await M.recibir(msj(`<@${BOT}> card`, [BOT]));
ok(pedidos.length === 0, 'la misma persona otra vez enseguida: nada (una mención cada 4 s)');
pedidos.length = 0;
await M.recibir(msj(`<@${BOT}> card`, [BOT], false, B));
ok(pedidos.length === 0, 'donde el bot no puede escribir ni leer el historial: no lo intenta (cada 403 cuenta contra la IP)');
await M.recibir(msj(`<@${BOT}> card`, [BOT], true, '700000000000000009', true));
ok(pedidos.length === 0, 'lo que escribe otro bot: nada');
await M.recibir(msj('card', [], true, '700000000000000008'));
ok(pedidos.length === 0, 'sin mencionar a ULAYA: nada (ni se llama al Worker)');
await M.recibir(msj(`<@${BOT}> ayuda`, [BOT], true, '700000000000000007'));
const ay = pedidos.find((p) => /\/messages$/.test(p.url));
ok(ay && JSON.stringify(ay.cuerpo).includes('Me puedes pedir') && !pedidos.some((p) => p.url.endsWith('/mencion')) && AYUDA.includes('@ULAYA vs'),
  '«@ULAYA ayuda» lo contesta el grabador solo, sin llamar al Worker');

console.log(mal ? `\n${mal} fallo(s)\n` : '\n  todo bien\n');
process.exit(mal ? 1 : 0);
