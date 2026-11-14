// 🤝 «Unirme a los Tier 1» (`cuentaUnirse()` de bot/worker.js), sin Cloudflare y sin Discord: `fetch` simulado.
// Dlx, 13/11/2026: «Yes, the safe way». Lo que se prueba es lo que pide la Developer Policy de Discord: sólo los servidores
// que la persona eligió (y que son los Tier 1 de la Liga), con SU permiso, y nada guardado. Y que cada respuesta de Discord
// se traduzca bien: entró, ya estaba, cuenta llena, el bot sin «Crear invitación», permiso vencido.
//
//     node bot/unirse_prueba.mjs
import { cuentaUnirse, SERVIDORES } from './worker.js';
import { APP_ID } from './avisos.js';

let malos = 0;
const ok = (c, msg) => { if (!c) malos += 1; console.log('   ' + (c ? '✅' : '🔴') + ' ' + msg); };
const gid = (sv) => SERVIDORES.find((s) => s.sv === sv).guild;
const RESP = {
  [gid('FFA')]: [201, null], [gid('DDF')]: [204, null], [gid('ACAD')]: [403, { code: 50013 }], [gid('SR')]: [201, null],
  [gid('FRZ')]: [403, { code: 40007 }],
};
// 🏅 el lobby que deja el ciclo: los Tier 1 con `cu.c`, los Tier 3 sin él (como en Socios)
const LOBBY = { svs: ['FFA', 'DDF', 'ACAD', 'SR', 'URBF', 'CH', 'FRZ', 'FVS', 'DRA'].map((sv) => ({ sv, tier: 1, cu: { t: 1, c: 1 } }))
  .concat(['FDS', 'DDS', 'LKR', 'FFS'].map((sv) => ({ sv, tier: 3, cu: { t: 1, c: 0, min: 8 } }))) };
let puts = [];
let llena = false;
let sinPermiso = false;
let usuario = '111222333444555666';
let scopes = ['identify', 'guilds.join'];
let lobby = LOBBY;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.endsWith('/oauth2/@me')) {
    return new Response(JSON.stringify({ application: { id: APP_ID }, user: { id: usuario }, scopes }), { status: 200 });
  }
  const m = /\/guilds\/(\d+)\/members\/(\d+)$/.exec(u);
  if (m && init.method === 'PUT') {
    puts.push({ guild: m[1], user: m[2], body: JSON.parse(init.body || '{}'), bot: init.headers && init.headers.Authorization });
    if (llena) return new Response(JSON.stringify({ code: 30001 }), { status: 400 });
    if (sinPermiso) return new Response(JSON.stringify({ code: 50025 }), { status: 401 });
    const [st, cuerpo] = RESP[m[1]] || [201, null];
    return new Response(cuerpo ? JSON.stringify(cuerpo) : null, { status: st });
  }
  return new Response('{}', { status: 404 });
};
const env = { DISCORD_TOKEN: 'BOT.FALSO', KV: { get: async (k, tipo) => (k === 'web:lobby' && lobby ? (tipo === 'json' ? lobby : JSON.stringify(lobby)) : null) } };
const pedir = async (cuerpo) => {
  const r = await cuentaUnirse(new Request('https://x/cuenta/unirse', { method: 'POST', body: JSON.stringify(cuerpo) }), env);
  return [r.status, await r.json()];
};

console.log('\n🤝 unirse a los Tier 1');
// 1 · lo que eligió, y nada más
let [st, j] = await pedir({ token: 'PERMISOFALSO_1234567890', svs: ['FFA', 'DDF', 'ACAD', 'SR', 'FRZ', 'TWR', 'NOEX', 'FDS', 'ffa'] });
ok(st === 200 && j.ok, 'contesta bien');
ok(j.res.FFA === 'ok' && j.res.DDF === 'ya' && j.res.SR === 'ok', 'entró · ya estaba · entró: ' + JSON.stringify(j.res));
ok(j.res.ACAD === 'sin_permiso', 'ACAD sin «Crear invitación» para el bot (50013): ' + j.res.ACAD);
ok(j.res.FRZ === 'no_deja', 'FRZ no lo deja entrar (40007): ' + j.res.FRZ);
ok(j.res.TWR === 'no' && j.res.NOEX === 'no', 'un servidor que ya no es socio (TWR, `fuera`) o que no existe: no se toca');
ok(j.res.FDS === 'no', 'un Tier 3 (FDS) pedido a mano: no, el permiso se pidió para los Tier 1 (13/11/2026)');
ok(puts.length === 5 && !puts.some((p) => p.guild === gid('TWR') || p.guild === gid('FDS')),
  'cinco pedidos a Discord, uno por cada Tier 1 elegido (y «ffa» repetido no cuenta dos veces)');
ok(puts.every((p) => p.body.access_token === 'PERMISOFALSO_1234567890' && p.user === '111222333444555666' && p.bot === 'Bot BOT.FALSO'),
  'con SU permiso, a SU cuenta, y el bot del lado de Liga');
// 2 · cuenta llena: los que siguen no se intentan
puts = []; llena = true;
[st, j] = await pedir({ token: 'PERMISOFALSO_2234567890', svs: ['FFA', 'DDF', 'SR'] });
ok(Object.values(j.res).every((x) => x === 'lleno') && puts.length === 1, 'cuenta llena (30001): lo dice para todos y para después del primero (' + puts.length + ' pedido)');
llena = false;
// 3 · el permiso se venció en el medio
puts = []; sinPermiso = true;
[st, j] = await pedir({ token: 'PERMISOFALSO_3234567890', svs: ['FFA', 'DDF'] });
ok(Object.values(j.res).every((x) => x === 'permiso') && puts.length === 1, 'el permiso vencido (401): «permiso» y no insiste');
sinPermiso = false;
// 4 · lo que no se acepta
[st, j] = await pedir({ token: 'corto', svs: ['FFA'] });
ok(st === 400 && j.error === 'token', 'un permiso inválido: 400');
[st, j] = await pedir({ token: 'PERMISOFALSO_4234567890', svs: [] });
ok(st === 400 && j.error === 'nada', 'sin servidores elegidos: 400');
// 5 · el freno: tres intentos cada diez minutos por persona (ya van tres)
[st, j] = await pedir({ token: 'PERMISOFALSO_5234567890', svs: ['FFA'] });
ok(st === 429 && j.error === 'espera', 'el cuarto intento en diez minutos: 429 (' + st + ')');

// 6 · un permiso SIN `guilds.join`: se dice antes de probar ninguno (otra persona: la de arriba ya está frenada)
usuario = '222333444555666777'; scopes = ['identify']; puts = [];
[st, j] = await pedir({ token: 'PERMISOFALSO_6234567890', svs: ['FFA', 'DDF', 'SR'] });
ok(Object.values(j.res).every((x) => x === 'permiso') && puts.length === 0, 'sin `guilds.join` en el permiso: «permiso» para todos y cero pedidos (' + puts.length + ')');
scopes = ['identify', 'guilds.join'];
// 7 · un 403 que no es del permiso (50001: el bot no está en ese servidor) es de ESE servidor: los demás se prueban
puts = []; RESP[gid('DDF')] = [403, { code: 50001 }];
[st, j] = await pedir({ token: 'PERMISOFALSO_7234567890', svs: ['DDF', 'FFA', 'SR'] });
ok(j.res.DDF === 'sin_permiso' && j.res.FFA === 'ok' && j.res.SR === 'ok' && puts.length === 3,
  'un 403 de un servidor (50001) no corta a los demás: ' + JSON.stringify(j.res));
RESP[gid('DDF')] = [204, null];
// 8 · sin el lobby no se sabe cuáles son Tier 1: no se suma a nadie
puts = []; lobby = null;
[st, j] = await pedir({ token: 'PERMISOFALSO_8234567890', svs: ['FFA'] });
ok(j.res.FFA === 'error' && puts.length === 0, 'sin lobby en KV: «No se pudo» y ningún pedido a Discord');
lobby = LOBBY;

console.log('\n' + (malos ? '🔴 ' + malos + ' con problemas' : '   unirse: todo bien'));
if (malos) process.exit(1);
