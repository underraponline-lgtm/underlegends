// 🤝 «Unirme a los Tier 1» (`cuentaUnirse()` de bot/worker.js), sin Cloudflare y sin Discord: `fetch` simulado.
// Dlx, 13/11/2026: «Yes, the safe way». Lo que se prueba es lo que pide la Developer Policy de Discord: sólo los servidores
// que la persona eligió (y que son socios de la Liga), con SU permiso, y nada guardado. Y que cada respuesta de Discord se
// traduzca bien: entró, ya estaba, cuenta llena, el bot sin «Crear invitación», permiso vencido.
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
let puts = [];
let llena = false;
let sinPermiso = false;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.endsWith('/oauth2/@me')) {
    return new Response(JSON.stringify({ application: { id: APP_ID }, user: { id: '111222333444555666' }, scopes: ['identify', 'guilds.join'] }), { status: 200 });
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
const env = { DISCORD_TOKEN: 'BOT.FALSO', KV: { get: async () => null } };
const pedir = async (cuerpo) => {
  const r = await cuentaUnirse(new Request('https://x/cuenta/unirse', { method: 'POST', body: JSON.stringify(cuerpo) }), env);
  return [r.status, await r.json()];
};

console.log('\n🤝 unirse a los Tier 1');
// 1 · lo que eligió, y nada más
let [st, j] = await pedir({ token: 'PERMISOFALSO_1234567890', svs: ['FFA', 'DDF', 'ACAD', 'SR', 'FRZ', 'TWR', 'NOEX', 'ffa'] });
ok(st === 200 && j.ok, 'contesta bien');
ok(j.res.FFA === 'ok' && j.res.DDF === 'ya' && j.res.SR === 'ok', 'entró · ya estaba · entró: ' + JSON.stringify(j.res));
ok(j.res.ACAD === 'sin_permiso', 'ACAD sin «Crear invitación» para el bot (50013): ' + j.res.ACAD);
ok(j.res.FRZ === 'no_deja', 'FRZ no lo deja entrar (40007): ' + j.res.FRZ);
ok(j.res.TWR === 'no' && j.res.NOEX === 'no', 'un servidor que ya no es socio (TWR, `fuera`) o que no existe: no se toca');
ok(puts.length === 5 && !puts.some((p) => p.guild === gid('TWR')), 'cinco pedidos a Discord, uno por cada elegido que es socio (y «ffa» repetido no cuenta dos veces)');
ok(puts.every((p) => p.body.access_token === 'PERMISOFALSO_1234567890' && p.user === '111222333444555666' && p.bot === 'Bot BOT.FALSO'),
  'con SU permiso, a SU cuenta, y el bot del lado de Liga');
// 2 · cuenta llena: los que siguen no se intentan
puts = []; llena = true;
[st, j] = await pedir({ token: 'PERMISOFALSO_2234567890', svs: ['FFA', 'DDF', 'SR'] });
ok(Object.values(j.res).every((x) => x === 'lleno') && puts.length === 1, 'cuenta llena (30001): lo dice para todos y para después del primero (' + puts.length + ' pedido)');
llena = false;
// 3 · el permiso no trae guilds.join o venció
puts = []; sinPermiso = true;
[st, j] = await pedir({ token: 'PERMISOFALSO_3234567890', svs: ['FFA', 'DDF'] });
ok(Object.values(j.res).every((x) => x === 'permiso') && puts.length === 1, 'sin el permiso (401): «permiso» y no insiste');
sinPermiso = false;
// 4 · lo que no se acepta
[st, j] = await pedir({ token: 'corto', svs: ['FFA'] });
ok(st === 400 && j.error === 'token', 'un permiso inválido: 400');
[st, j] = await pedir({ token: 'PERMISOFALSO_4234567890', svs: [] });
ok(st === 400 && j.error === 'nada', 'sin servidores elegidos: 400');
// 5 · el freno: tres intentos cada diez minutos por persona (ya van tres)
[st, j] = await pedir({ token: 'PERMISOFALSO_5234567890', svs: ['FFA'] });
ok(st === 429 && j.error === 'espera', 'el cuarto intento en diez minutos: 429 (' + st + ')');

console.log('\n' + (malos ? '🔴 ' + malos + ' con problemas' : '   unirse: todo bien'));
if (malos) process.exit(1);
