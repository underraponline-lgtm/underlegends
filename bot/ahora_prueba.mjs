// 🎧 La prueba de «Ahora mismo» (28/11/2026), sin Discord, sin Cloudflare y sin red: qué canal es público, qué cuenta el
// grabador (y que no lleva nada de nadie), cuándo manda (sólo si cambió, uno por minuto, el latido), y en el objeto de
// verdad (SQLite de Node): sólo socios, nada de gente guardado, el vencimiento, el interruptor del socio (DRA siempre) y la
// puerta del Worker.
//
//     node bot/ahora_prueba.mjs
import * as G from '../grabador/ahora.js';
import * as AH from './ahora.js';

let fallas = 0, bien = 0;
const ok = (c, t, extra) => {
  if (c) bien += 1;
  else { fallas += 1; console.log('  🔴 ' + t + (extra !== undefined ? '\n     ' + extra : '')); }
};
const MIN = 60000;

// ── 1. público o privado ─────────────────────────────────────────────────────────────────────────────────────────────
const bits = (...xs) => xs.reduce((a, b) => a | b, 0n);
const permDe = (b) => ({ has: (x) => (b & x) === x });
ok(G.esPublico(bits(G.VER, G.CONECTAR)) && G.esPublico(permDe(bits(G.VER, G.CONECTAR, 1n << 11n))), '@everyone ve y se conecta: público');
ok(!G.esPublico(bits(G.CONECTAR)) && !G.esPublico(permDe(G.CONECTAR)), 'sin VER el canal: privado');
ok(!G.esPublico(bits(G.VER)) && !G.esPublico(permDe(G.VER)), 've pero no se puede conectar: privado');
ok(!G.esPublico(null) && !G.esPublico({ has() { throw new Error('x'); } }), 'sin permisos o con un error: privado');

// ── 2. un servidor de mentira, como lo da discord.js ─────────────────────────────────────────────────────────────────
const GUILD = '900000000000000001', OTRO = '900000000000000002', AJENO = '900000000000000003', DRA = '841017460341604382';
const PUB = '910000000000000001', PRIV = '910000000000000002', AFK = '910000000000000003', PUB2 = '910000000000000004', TXT = '910000000000000005';
const personas = (n, base) => Array.from({ length: n }, (_, i) => String(BigInt(base) + BigInt(i)));
let ids = 0;
const gente = new Map();   // id -> {username}
function guildFalso(id, estados) {
  const perms = { [PUB]: bits(G.VER, G.CONECTAR), [PUB2]: bits(G.VER, G.CONECTAR), [PRIV]: bits(G.CONECTAR), [AFK]: bits(G.VER, G.CONECTAR), [TXT]: bits(G.VER, G.CONECTAR) };
  const nombres = { [PUB]: 'Cypher abierto', [PUB2]: 'Entrenamiento', [PRIV]: 'Staff', [AFK]: 'AFK', [TXT]: 'general' };
  const tipo = { [TXT]: 0 };
  const everyone = { id };
  const canal = (cid) => ({ id: cid, name: nombres[cid], type: tipo[cid] ?? 2, permissionsFor: (r) => (r === everyone ? permDe(perms[cid]) : null) });
  return {
    id, afkChannelId: AFK, roles: { everyone },
    channels: { cache: new Map([PUB, PUB2, PRIV, AFK, TXT].map((c) => [c, canal(c)])) },
    voiceStates: { cache: new Map(estados.map((e) => {
      const uid = e.id || String(800000000000000000n + BigInt(++ids));
      gente.set(uid, 'persona_' + uid.slice(-3));
      return [uid, { id: uid, channelId: e.c, selfMute: !!e.mute, serverMute: false, selfDeaf: !!e.sordo, serverDeaf: false, suppress: false,
        member: { user: { id: uid, username: gente.get(uid), bot: !!e.bot }, displayName: 'Alias ' + uid.slice(-2) } }];
    })) },
  };
}
const est = (c, n, abiertos = n, extra = {}) => Array.from({ length: n }, (_, i) => Object.assign({ c, mute: i >= abiertos }, extra));
const g1 = guildFalso(GUILD, [...est(PUB, 5, 3), ...est(PRIV, 4), ...est(AFK, 3), ...est(PUB2, 1), ...est(PUB, 2, 2, { bot: true }), ...est(TXT, 2)]);
const desde = new Map();
let ll = G.llamadasDe(GUILD, G.plano(g1), desde, 1000);
ok(ll.length === 1 && ll[0].c === PUB && ll[0].p === 5 && ll[0].m === 3 && ll[0].n === 'Cypher abierto',
  'cuenta sólo el canal público: 5 personas, 3 con micro (los bots no cuentan)', JSON.stringify(ll));
ok(!ll.some((x) => x.c === PRIV), 'el canal privado (staff) no sale aunque tenga gente');
ok(!ll.some((x) => x.c === AFK), 'la llamada AFK no sale');
ok(!ll.some((x) => x.c === PUB2), `con menos de ${G.MIN_GENTE} personas no es una llamada`);
ok(!ll.some((x) => x.c === TXT), 'un canal que no es de voz no sale');
const sordos = G.llamadasDe(GUILD, G.plano(guildFalso(GUILD, [...est(PUB, 2, 2, { sordo: true })])), new Map(), 1000);
ok(sordos[0] && sordos[0].p === 2 && sordos[0].m === 0, 'ensordecido cuenta como persona pero no como micro abierto');
const otra = G.llamadasDe(GUILD, G.plano(g1), desde, 5000);
ok(otra[0].d === 1000, '«desde» no se mueve mientras la llamada sigue');
G.llamadasDe(GUILD, G.plano(guildFalso(GUILD, [])), desde, 6000);
ok(!desde.size, 'cuando se vacía, se olvida su «desde»');
ll = G.llamadasDe(GUILD, G.plano(g1), desde, 9000);
ok(ll[0].d === 9000, 'y si vuelve, vuelve de cero');
ok(JSON.stringify(Object.keys(ll[0]).sort()) === '["c","d","m","n","p"]', 'cada llamada es canal, nombre, personas, micros y desde: nada más', JSON.stringify(ll[0]));

// ── 3. el grabador entero, con un Worker de mentira ──────────────────────────────────────────────────────────────────
let envios = [];
let contesta = { ok: true, acepta: [GUILD, OTRO, DRA] };
let estado = 200;
const fetchFalso = async (url, op = {}) => {
  envios.push({ url: String(url), h: op.headers || {}, cuerpo: op.body });
  return new Response(JSON.stringify(contesta), { status: estado });
};
const guilds = new Map([[GUILD, g1], [OTRO, guildFalso(OTRO, [])], [AJENO, guildFalso(AJENO, est(PUB, 4))]]);
const A = new G.AhoraMismo({ client: { guilds: { cache: guilds } }, vigia: 'https://w', clave: 'k', fetch: fetchFalso });
let T = Date.UTC(2026, 10, 28, 22, 0);
ok(await A.tic(T) && envios.length === 1, 'la primera vuelta manda');
const e0 = envios[0];
ok(e0.url === 'https://w/ahora' && e0.h['x-lg-ciclo'] === 'k', 'a /ahora del Worker, con la clave del ciclo');
const cuerpo0 = JSON.parse(e0.cuerpo);
ok(cuerpo0.g[GUILD] && cuerpo0.g[AJENO], 'antes de saber cuáles son socios, manda todos los que tienen llamadas');
const todo = e0.cuerpo;
const filtrado = [...gente].filter(([id, n]) => todo.includes(id) || todo.includes(n) || todo.includes('Alias'));
ok(!filtrado.length, 'NI UN ID NI UN NOMBRE de persona en lo que sale (' + gente.size + ' personas en las llamadas)', JSON.stringify(filtrado.slice(0, 3)));
envios = [];
ok(!(await A.tic(T + 15000)) && !envios.length, 'sin cambios, 15 s después: nada');
// cambia el número de micros
g1.voiceStates.cache.values().next().value.selfMute = true;
g1.voiceStates.cache.values().next().value.selfMute = false;
const vs = [...g1.voiceStates.cache.values()].find((v) => v.channelId === PUB && !v.member.user.bot && !v.selfMute);
vs.selfMute = true;
ok(!(await A.tic(T + 30000)) && !envios.length, 'cambió, pero hace menos de 60 s del último envío: espera');
ok(await A.tic(T + 61000) && envios.length === 1, 'pasado el minuto, manda el cambio');
const c1 = JSON.parse(envios[0].cuerpo);
ok(c1.g[GUILD][0].m === 2 && !c1.g[AJENO], 'con el micro nuevo, y ya sólo los socios (`acepta` de la respuesta)', JSON.stringify(c1));
envios = [];
ok(!(await A.tic(T + 61000 + 5 * MIN)) && !envios.length, 'sin cambios a los 5 min: nada');
ok(await A.tic(T + 61000 + G.LATIDO_S * 1000) && envios.length === 1, `sin cambios a los ${G.LATIDO_S / 60} min: el latido`);
// se vacía todo
envios = [];
for (const k of [...g1.voiceStates.cache.keys()]) g1.voiceStates.cache.delete(k);
let t2 = T + 61000 + G.LATIDO_S * 1000 + MIN + 1000;
ok(await A.tic(t2) && JSON.stringify(JSON.parse(envios[0].cuerpo).g) === '{}', 'cuando no queda ninguna, manda la foto vacía (el objeto borra)');
envios = [];
ok(!(await A.tic(t2 + G.LATIDO_S * 1000 + 1000)) && !envios.length, 'y sin llamadas no hay latido: no hay nada que vencer');
// el Worker se cae: no reintenta en cada vuelta
for (const e of est(PUB, 3)) { const id = String(800000000000000000n + BigInt(++ids)); g1.voiceStates.cache.set(id, { id, channelId: e.c, member: { user: { bot: false } } }); }
estado = 503;
envios = [];
let t3 = t2 + 2 * G.LATIDO_S * 1000;
ok(!(await A.tic(t3)) && envios.length === 1, 'el Worker no contesta: no cuenta como enviado');
ok(!(await A.tic(t3 + 15000)) && envios.length === 1, 'y no reintenta en cada vuelta (cada 403 o 5xx cuenta)');
estado = 200;
ok(await A.tic(t3 + 61000) && envios.length === 2, 'reintenta al minuto, y llega');

// ── 4. el objeto de verdad ───────────────────────────────────────────────────────────────────────────────────────────
let DatabaseSync = null;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { DatabaseSync = null; }
if (!DatabaseSync) {
  console.log('  ⓘ sin node:sqlite (Node ' + process.version + '): el objeto no se prueba');
} else {
  const Av = await import('./avisos.js');
  const db = new DatabaseSync(':memory:');
  const sql = {
    exec(q, ...ps) {
      const t = String(q).trim();
      if (!ps.length && /;\s*\S/.test(t)) { db.exec(t); return { toArray: () => [], rowsWritten: 0 }; }
      const st = db.prepare(t);
      if (/^\s*(SELECT|WITH|PRAGMA)/i.test(t)) { const rows = st.all(...ps); return { toArray: () => rows, rowsWritten: 0 }; }
      const r = st.run(...ps);
      return { toArray: () => [], rowsWritten: Number(r.changes) };
    },
  };
  const cfg = { ['cfg:' + OTRO]: JSON.stringify({ ahora_mismo: false }), ['cfg:' + DRA]: JSON.stringify({ ahora_mismo: false }) };
  const relojReal = Date.now;
  let AHORA = Date.UTC(2026, 10, 28, 22, 0);
  Date.now = () => AHORA;
  const o = new Av.Avisos({ storage: { sql, setAlarm() {}, getAlarm() { return null; } }, blockConcurrencyWhile: async (f) => f() },
    { KV: { get: async (k) => cfg[k] || null } });
  await new Promise((r) => setTimeout(r, 5));
  o.guardar('guilds', { FFA: GUILD, SR: OTRO, DRA });
  const poner = async (g) => (await o.fetch(new Request('https://avisos/ahora-poner', { method: 'POST', body: JSON.stringify({ g }) }))).json();
  const leer = async () => (await o.fetch(new Request('https://avisos/ahora-leer'))).json();
  const C = (c, p, m, extra = {}) => Object.assign({ c, n: 'Cypher', p, m, d: AHORA - 20 * MIN }, extra);

  let r = await poner({ [GUILD]: [C(PUB, 6, 4, { quien: ['800000000000000001'], nombres: ['Ana'] })], [AJENO]: [C(PUB, 9, 9)],
    [OTRO]: [C(PUB, 3, 1)], [DRA]: [C(PUB2, 4, 2)] });
  ok(r.ok && r.acepta && r.acepta.includes(GUILD) && !r.acepta.includes(AJENO), 'el objeto contesta qué guilds son socios', JSON.stringify(r));
  let L = await leer();
  ok(L.ll.length === 2 && L.ll[0].sv === 'FFA' && L.ll[0].p === 6 && L.ll[0].m === 4 && L.ll[1].sv === 'DRA',
    'la página ve FFA y DRA, las más llenas primero', JSON.stringify(L));
  ok(!L.ll.some((x) => x.g === AJENO), 'un servidor que no es socio no se guarda');
  ok(!L.ll.some((x) => x.sv === 'SR'), 'un socio con «Ahora mismo» apagado no aparece');
  ok(L.ll.some((x) => x.sv === 'DRA'), 'DRA aparece siempre, aunque su cfg diga que no');
  const filas = sql.exec('SELECT * FROM ahora').toArray();
  const crudo = JSON.stringify(filas);
  ok(!crudo.includes('800000000000000001') && !crudo.includes('Ana') && !crudo.includes('quien'),
    'lo que venga de más (ids o nombres de gente) no se guarda', crudo);
  ok(Object.keys(L.ll[0]).sort().join() === 'c,d,g,m,n,p,sv', 'la página recibe servidor, guild, canal, nombre, personas, micros y desde', JSON.stringify(L.ll[0]));

  // lo raro se limpia
  r = await poner({ [GUILD]: [C('abc', 5, 1), C(PUB, 0, 0), C(PUB2, 3, 7, { n: '‮ Sala\n  de\tespera  ', d: AHORA + 3600000 })] });
  L = await leer();
  ok(L.ll.length === 1 && L.ll[0].c === PUB2 && L.ll[0].m === 3 && L.ll[0].n === 'Sala de espera' && L.ll[0].d === AHORA,
    'un canal sin id o sin nadie no entra; micros > personas, el nombre sucio y la hora del futuro se acomodan', JSON.stringify(L.ll));
  ok(!L.ll.some((x) => x.sv === 'DRA'), 'la foto es entera: un servidor que ya no viene se borra');

  // el vencimiento
  await poner({ [GUILD]: [C(PUB, 5, 2)] });
  AHORA += AH.CADUCA_MS - 1000;
  ok((await leer()).ll.length === 1, 'a los 14 min sin latido todavía se ve');
  AHORA += 2000;
  ok((await leer()).ll.length === 0, 'a los 15 min sin latido se vence (Railway caído no deja llamadas para siempre)');
  await poner({ [GUILD]: [C(PUB, 5, 2)] });
  ok((await leer()).ll.length === 1, 'con el latido vuelve');

  // el interruptor desde el panel del socio
  ok(Av.socioAjusteValido('ahora_mismo', false, []) === false && Av.socioAjusteValido('ahora_mismo', true, []) === true
    && Av.socioAjusteValido('ahora_mismo', 'no', []) === undefined, 'el panel acepta `ahora_mismo` sólo como sí o no');
  cfg['cfg:' + GUILD] = JSON.stringify({ ahora_mismo: false });
  AH.borrar(o, GUILD);
  ok((await leer()).ll.length === 0, 'apagado: su fila se va en el momento');
  o.cfgChat.delete(GUILD);
  await poner({ [GUILD]: [C(PUB, 5, 2)] });
  ok((await leer()).ll.length === 0, 'y el grabador puede seguir mandando: no vuelve a aparecer');
  delete cfg['cfg:' + GUILD];
  o.cfgChat.delete(GUILD);
  await poner({ [GUILD]: [C(PUB, 5, 2)] });
  ok((await leer()).ll.length === 1, 'prendido de nuevo, vuelve');
  // un socio que deja de serlo
  o.guardar('guilds', { SR: OTRO, DRA });
  ok((await leer()).ll.length === 0, 'un servidor que deja de ser socio desaparece aunque quede su fila');
  ok((await o.fetch(new Request('https://avisos/ahora-poner', { method: 'POST', body: '"x"' }))).status === 400, 'sin la forma de siempre: 400');
  Date.now = relojReal;
}

// ── 5. la puerta del Worker ──────────────────────────────────────────────────────────────────────────────────────────
{
  const llegaron = [];
  const env = { AVISOS: { idFromName: () => 'id', get: () => ({ fetch: async (u, op = {}) => {
    llegaron.push({ u: String(u), m: op.method || 'GET' });
    return new Response(JSON.stringify({ t: 1, ll: [] }), { status: 200 });
  } }) } };
  let r = await AH.ruta(new Request('https://w/ahora', { method: 'POST', body: '{"g":{}}' }), env, false);
  ok(r.status === 403 && !llegaron.length, 'mandar sin la clave del ciclo: 403, y no llega al objeto');
  r = await AH.ruta(new Request('https://w/ahora', { method: 'POST', body: 'x'.repeat(AH.MAX_CUERPO + 1) }), env, true);
  ok(r.status === 413, 'un envío gigante: 413');
  r = await AH.ruta(new Request('https://w/ahora', { method: 'POST', body: '{"g":{}}' }), env, true);
  ok(r.status === 200 && llegaron[0].u.endsWith('/ahora-poner'), 'con la clave: al objeto');
  r = await AH.ruta(new Request('https://w/ahora'), env, false);
  ok(r.status === 200 && llegaron[1].u.endsWith('/ahora-leer') && /max-age=20/.test(r.headers.get('cache-control')),
    'leer es público y se puede guardar', r.headers.get('cache-control'));
  r = await AH.ruta(new Request('https://w/ahora', { method: 'DELETE' }), env, true);
  ok(r.status === 405, 'otro método: 405');
  // y el Worker de verdad la atiende (sin la clave, un POST no pasa)
  const { default: worker } = await import('./worker.js');
  const envW = Object.assign({ KV: { get: async () => null, put: async () => {} }, DISCORD_TOKEN: 't' }, env);
  r = await worker.fetch(new Request('https://liga-global-bot.x/ahora', { method: 'POST', body: '{"g":{}}' }), envW, { waitUntil() {} });
  ok(r.status === 403, 'el Worker: POST /ahora sin la clave, 403', r.status);
  r = await worker.fetch(new Request('https://liga-global-bot.x/ahora'), envW, { waitUntil() {} });
  ok(r.status === 200 && Array.isArray((await r.json()).ll), 'el Worker: GET /ahora, la lista', r.status);
}

// ── 6. el proxy de la página ─────────────────────────────────────────────────────────────────────────────────────────
{
  const { default: proxy } = await import('./paginas/_worker.js');
  const f0 = globalThis.fetch;
  let llego = null;
  globalThis.fetch = async (u) => { llego = String(u); return new Response('{"t":1,"ll":[]}', { status: 200 }); };
  const envP = { ASSETS: { fetch: async () => new Response('<html>', { status: 200 }) } };
  let r = await proxy.fetch(new Request('https://underlegends.pages.dev/api/ahora'), envP, { waitUntil() {} });
  ok(r.status === 200 && llego && llego.endsWith('/ahora'), 'el proxy de la página deja pasar GET /api/ahora', llego);
  llego = null;
  r = await proxy.fetch(new Request('https://underlegends.pages.dev/api/ahora', { method: 'POST', body: '{}' }), envP, { waitUntil() {} });
  ok(r.status === 405 && !llego, 'y un POST no: sólo el grabador escribe, y directo al Worker');
  globalThis.fetch = f0;
}

console.log(fallas ? `\n  ${fallas} fallo(s), ${bien} bien\n` : `\n  ✅ «Ahora mismo»: ${bien} de ${bien}\n`);
process.exit(fallas ? 1 : 0);
