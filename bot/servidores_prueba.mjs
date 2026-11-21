// 🫂 La prueba de «gente de la Liga en tus mismos servidores» (21/11/2026), sobre el objeto de verdad (SQLite de Node):
// guardar la lista de cada uno, que se reemplace al volver a entrar, que un servidor grande no cuente, que nunca salgan
// los servidores y que los hashes no lleven el ID. node bot/servidores_prueba.mjs
import * as A from './avisos.js';

let fallas = 0, bien = 0;
const ok = (c, t, extra) => {
  if (c) bien += 1;
  else { fallas += 1; console.log('  🔴 ' + t + (extra !== undefined ? '\n     ' + extra : '')); }
};

let DatabaseSync = null;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { DatabaseSync = null; }
if (!DatabaseSync) {
  console.log('  ⓘ sin node:sqlite (Node ' + process.version + '): no se prueba sobre el objeto');
  process.exit(0);
}
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
const o = new A.Avisos({ storage: { sql, setAlarm() {}, getAlarm() { return null; } }, blockConcurrencyWhile: async (f) => f() },
  { KV: { get: async () => null } });
await new Promise((r) => setTimeout(r, 5));
const j = async (r) => JSON.parse(await r.text());

// lo que hace `guardarServidores()` con la lista de Discord: hashear y sacar DRA y FFA. Se prueba con un objeto falso
const mandados = [];
const env = { AVISOS: {}, };
const objetoReal = o;
// `elObjeto(env)` usa `env.AVISOS.idFromName/get`: se arma uno que le pasa el pedido al objeto de la prueba
env.AVISOS = { idFromName: () => 'x', get: () => ({ fetch: async (url, init) => {
  mandados.push(JSON.parse(init.body));
  return objetoReal.fetch(new Request(url, init));
} }) };
const g = (...ids) => ids.map((id) => ({ id: String(id), name: 'Servidor ' + id }));
await A.guardarServidores(env, '111111', g(900001, 900002, 900003, '841017460341604382'), ['841017460341604382']);
const m0 = mandados[0] || {};
ok(m0.quien === '111111' && Array.isArray(m0.g) && m0.g.length === 3 && m0.g.every((x) => /^[0-9a-f]{16}$/.test(x)),
  'se guardan 3 huellas de 16 letras: DRA (en `fuera`) no va', JSON.stringify(m0));
ok(!JSON.stringify(mandados).includes('900001') && !JSON.stringify(mandados).includes('Servidor'),
  'al objeto no llega ni el ID ni el nombre de ningún servidor');

// cuatro personas: 222 comparte dos servidores con 111, 333 uno, 444 ninguno
await A.guardarServidores(env, '222222', g(900001, 900002, 900009));
await A.guardarServidores(env, '333333', g(900003));
await A.guardarServidores(env, '444444', g(900099));
const pide = (quien) => o.fetch(new Request('https://avisos/mis-servidores', { method: 'POST', body: JSON.stringify({ quien }) }));
let r = await j(await pide('111111'));
ok(r.tengo === 3 && JSON.stringify(r.gente) === JSON.stringify([['222222', 2], ['333333', 1]]),
  'a 111 le salen 222 (en 2 servidores) y 333 (en 1), en ese orden, y no 444', JSON.stringify(r));
ok(!JSON.stringify(r).match(/[0-9a-f]{16}/), 'la respuesta no trae las huellas de los servidores', JSON.stringify(r));

// volver a entrar reemplaza la lista: 222 se fue de 900002
await A.guardarServidores(env, '222222', g(900001));
r = await j(await pide('111111'));
ok(JSON.stringify(r.gente) === JSON.stringify([['222222', 1], ['333333', 1]]) || JSON.stringify(r.gente) === JSON.stringify([['333333', 1], ['222222', 1]]),
  'volver a entrar reemplaza la lista: 222 ya comparte uno solo', JSON.stringify(r));

// un servidor con más de SRV_TOPE de la Liga no cuenta (un servidor grande de freestyle no es un círculo)
for (let i = 0; i < A.SRV_TOPE + 1; i++) await A.guardarServidores(env, String(5000000 + i), g(900777));
await A.guardarServidores(env, '111111', g(900001, 900777));
r = await j(await pide('111111'));
ok(JSON.stringify(r.gente) === JSON.stringify([['222222', 1]]), 'el servidor con ' + (A.SRV_TOPE + 1) + ' de la Liga no cuenta', JSON.stringify(r));

// sin lista, nada; y con datos malos, 400
r = await j(await pide('999999'));
ok(r.tengo === 0 && r.gente.length === 0, 'quien no dio el permiso no ve a nadie', JSON.stringify(r));
const malo = await o.fetch(new Request('https://avisos/srv-guardar', { method: 'POST', body: JSON.stringify({ quien: 'x', g: ['zz'] }) }));
ok(malo.status === 400, 'sin un Discord ID válido no guarda nada', malo.status);

console.log(fallas ? '\n  ' + fallas + ' mal, ' + bien + ' bien' : '\n  todo bien (' + bien + ')');
process.exit(fallas ? 1 : 0);
