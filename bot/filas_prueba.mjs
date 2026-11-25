// ⚡ LA PRUEBA DE LAS FILAS DEL OBJETO (25/11/2026, Dlx: «Just do #1»): el 24/11 el objeto pasó sus 5 millones de filas
// leídas y la página falló de 3 a 7 PM ET. Lo que se cambió para que lea menos, sobre el objeto de verdad (SQLite de Node):
//   · lo que manda el ciclo (`jugo`): sólo se recalcula quien cambió (su racha, sus hitos, sus Tareas del Pase)
//   · `niveles()`: lo de cada uno queda en `niv`; se recalcula quien cambió o lo del día anterior, y da LO MISMO que `rachaDe()`
//   · las felicitaciones de un perfil (`aplPorK()`): un mapa de todos, que cuenta lo mismo que la consulta de antes
// node bot/filas_prueba.mjs
import * as A from './avisos.js';

let fallas = 0, bien = 0;
const ok = (c, t, extra) => {
  if (c) bien += 1;
  else { fallas += 1; console.log('  🔴 ' + t + (extra !== undefined ? '\n     ' + extra : '')); }
};

let DatabaseSync = null;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { DatabaseSync = null; }
if (!DatabaseSync) {
  console.log('  ⓘ sin node:sqlite (Node ' + process.version + '): las filas del objeto no se prueban');
  process.exit(0);
}
const db = new DatabaseSync(':memory:');
let lecturas = 0;
const sql = {
  exec(q, ...ps) {
    const t = String(q).trim();
    if (!ps.length && /;\s*\S/.test(t)) { db.exec(t); return { toArray: () => [], rowsWritten: 0 }; }
    const st = db.prepare(t);
    if (/^\s*(SELECT|WITH|PRAGMA)/i.test(t)) { lecturas += 1; const rows = st.all(...ps); return { toArray: () => rows, rowsWritten: 0 }; }
    const r = st.run(...ps);
    return { toArray: () => [], rowsWritten: Number(r.changes) };
  },
};
let paquete = null;
const o = new A.Avisos({ storage: { sql, setAlarm() {}, getAlarm() { return null; } }, blockConcurrencyWhile: async (f) => f() },
  { KV: { get: async (k) => (k === 'precios:resolucion' && paquete ? JSON.stringify(paquete) : null), put: async () => {} } });
await new Promise((r) => setTimeout(r, 5));

const ANA = '111111111111111111', BEA = '222222222222222222', CAMI = '333333333333333333';
const hoy = A.diaET ? A.diaET() : new Date().toISOString().slice(0, 10);
const dia = (n) => new Date(Date.parse(hoy + 'T12:00:00Z') - n * 86400000).toISOString().slice(0, 10);
const RCFG = { temp: 't1' };
let v = 0;
const mandar = async (jugo) => { v += 1; paquete = { v: 'p' + v, r: {}, jugo, rcfg: RCFG }; await o.resolverPrecios(Date.now()); };

// espías: cuántas veces se recalcula a alguien
let revisados = 0, calculados = 0;
const pr = o.paseRevisar.bind(o), nr = o.nivelRacha.bind(o);
o.paseRevisar = (q) => { revisados += 1; return pr(q); };
o.nivelRacha = (q) => { calculados += 1; return nr(q); };

// ── 1. lo del ciclo: la primera vez entran todos ──
const J1 = { [ANA]: ['ana', 3, [dia(2), dia(1), dia(0)]], [BEA]: ['bea', 1, [dia(5)]], [CAMI]: ['cami', 2, [dia(1)]] };
await mandar(J1);
ok(revisados === 3, 'la primera vez se revisa a los tres', revisados);

// ── 2. el mismo paquete con otra huella (cambió otra cosa del paquete): nadie se recalcula ──
revisados = 0;
await mandar(J1);
ok(revisados === 0, 'si a nadie le cambió nada, no se recalcula a nadie (antes: a los ~800 en cada cambio del paquete)', revisados);

// ── 3. a Bea le llega un día nuevo y a Cami un evento más: sólo ellas ──
revisados = 0;
await mandar({ [ANA]: J1[ANA], [BEA]: ['bea', 1, [dia(5), dia(0)]], [CAMI]: ['cami', 3, [dia(1)]] });
ok(revisados === 2, 'sólo se recalcula a quien le cambió algo (un día nuevo, un evento más)', revisados);

// ── 4. niveles(): da lo mismo que rachaDe(), y la segunda vez no recalcula ──
const N1 = o.niveles().n;
const igual = [[ANA, 'ana'], [BEA, 'bea'], [CAMI, 'cami']].every(([q, k]) => {
  const x = o.rachaDe(q);
  return N1[k] && N1[k][0] === x.nivel.n && N1[k][1] === x.racha.actual;
});
ok(igual, 'niveles() da el mismo nivel y la misma racha que rachaDe()', JSON.stringify(N1));
calculados = 0;
const N2 = o.niveles().n;
ok(calculados === 0 && JSON.stringify(N2) === JSON.stringify(N1), 'la segunda vez sale de lo guardado, sin recalcular', calculados);

// ── 5. un día nuevo de Ana (entra a la página): sólo ella se recalcula ──
o.sql.exec('DELETE FROM activo WHERE quien = ? AND dia = ?', ANA, dia(0));
o.diaActivo(ANA, dia(0));
calculados = 0;
const N3 = o.niveles().n;
ok(calculados === 1 && N3.ana[1] === o.rachaDe(ANA).racha.actual, 'un día nuevo de alguien lo recalcula a él solo', calculados);

// ── 6. quien ya no viene en la temporada sale de la tabla, como con el DELETE de antes ──
await mandar({ [ANA]: J1[ANA], [BEA]: ['bea', 1, [dia(5), dia(0)]] });
ok(!o.sql.exec('SELECT 1 AS x FROM jugo_temp WHERE quien = ?', CAMI).toArray().length && !('cami' in o.niveles().n),
  'quien ya no viene en lo del ciclo sale de la temporada');

// ── 7. las felicitaciones: el mapa cuenta lo mismo que la consulta de antes ──
const ins = (q, ...p) => o.sql.exec(q, ...p);
ins("INSERT INTO aplaudidas (id, tipo, quien, ks, motivo, t, primero) VALUES ('p1', 'campeon', '[]', '[\"ana\",\"bea\"]', '', 1, 0)");
ins("INSERT INTO aplaudidas (id, tipo, quien, ks, motivo, t, primero) VALUES ('p2', 'rango', '[]', '[\"ana\"]', '', 1, 0)");
ins("INSERT INTO aplaudidas (id, tipo, quien, ks, motivo, t, primero) VALUES ('p3', 'rango', '[]', '[\"cami\"]', '', 1, 0)");
for (const [id, q] of [['p1', 'x1'], ['p1', 'x2'], ['p1', 'x3'], ['p2', 'x1'], ['p3', 'x9']]) ins('INSERT INTO aplausos (id, quien, t) VALUES (?, ?, 1)', id, q);
ins("INSERT INTO aplausos_rec (id, ks, n) VALUES ('p1', '[\"ana\",\"bea\"]', 5)");
ins("INSERT INTO aplausos_rec (id, ks, n) VALUES ('p9', '[\"bea\"]', 2)");
const viejo = (k) => {
  const like = '%"' + k + '"%';
  const r = o.sql.exec('SELECT SUM(n) AS n FROM (SELECT r.id, MAX(r.n, COALESCE(l.c, 0)) AS n FROM aplausos_rec r ' +
    'LEFT JOIN (SELECT id, COUNT(*) AS c FROM aplausos GROUP BY id) l ON l.id = r.id WHERE r.ks LIKE ? ' +
    'UNION ALL SELECT p.id, COUNT(*) AS n FROM aplausos a JOIN aplaudidas p ON p.id = a.id WHERE p.ks LIKE ? ' +
    'AND p.id NOT IN (SELECT id FROM aplausos_rec) GROUP BY p.id)', like, like).toArray()[0];
  return (r && r.n) || 0;
};
const M = o.aplPorK();
ok(['ana', 'bea', 'cami', 'nadie'].every((k) => (M[k] || 0) === viejo(k)), 'las felicitaciones de cada perfil: las mismas que la consulta de antes',
  JSON.stringify({ mapa: M, antes: { ana: viejo('ana'), bea: viejo('bea'), cami: viejo('cami') } }));

console.log((fallas ? '🔴 ' : '✅ ') + bien + ' de ' + (bien + fallas) + ' bien · las filas del objeto');
process.exit(fallas ? 1 : 0);
