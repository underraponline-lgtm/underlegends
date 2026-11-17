// 🎭 La prueba del ESTILO DE JUEGO (16/11/2026), sobre el objeto de verdad (SQLite de Node): elegir la primera vez, UN
// cambio por temporada, el que dejas queda desbloqueado, volver a uno viejo, el dueño sin tope, lo que no está en el
// catálogo, cuántos eligió cada estilo y lo que lee el ciclo. node bot/juego_prueba.mjs
import * as A from './avisos.js';

let fallas = 0, bien = 0;
const ok = (c, t, extra) => {
  if (c) bien += 1;
  else { fallas += 1; console.log('  🔴 ' + t + (extra !== undefined ? '\n     ' + JSON.stringify(extra) : '')); }
};

let DatabaseSync = null;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { DatabaseSync = null; }
if (!DatabaseSync) {
  console.log('  ⓘ sin node:sqlite (Node ' + process.version + '): el estilo de juego no se prueba sobre el objeto');
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

const ANA = '111111111111111111', BEA = '222222222222222222';
const elige = (quien, juego, temp = 't1') => o.juegoElige({ quien, juego, temp });

try {
  ok(A.JUEGOS.length === 18 && new Set(A.JUEGOS).size === 18, 'son 18 estilos, sin repetir', A.JUEGOS);
  let r = o.juegoMio(ANA, 't1');
  ok(r.ok && r.juego === '' && r.puede === true && r.viejos.length === 0, 'sin elegir: nada, y puede elegir', r);

  r = elige(ANA, 'punchline');
  ok(r.ok && r.juego === 'punchline' && r.puede === true && r.cuantos.punchline === 1,
    'la primera vez es libre: no gasta el cambio de la temporada', r);
  r = elige(ANA, 'punchline');
  ok(r.ok && r.juego === 'punchline' && r.puede === true, 'elegir el mismo no cambia nada', r);

  r = elige(ANA, 'flow');
  ok(r.ok && r.juego === 'flow' && r.puede === false && r.viejos.join() === 'punchline' && !r.cuantos.punchline && r.cuantos.flow === 1,
    'el cambio de la temporada: el que dejas queda desbloqueado y ya no puedes cambiar', r);
  r = elige(ANA, 'burla');
  ok(r.error === 'ya', 'un segundo cambio en la misma temporada no entra', r);
  ok(o.juegoMio(ANA, 't1').juego === 'flow', '…y lo elegido sigue igual');

  r = elige(ANA, 'punchline', 't2');
  ok(r.ok && r.juego === 'punchline' && r.viejos.join() === 'flow' && r.puede === false,
    'otra temporada, otro cambio: volver a uno viejo también lo es, y sale de los viejos', r);
  ok(o.juegoMio(ANA, 't3').puede === true, 'y en la temporada siguiente puede cambiar de nuevo');

  ok(elige(BEA, 'inventado').error === 'faltan datos' && elige('abc', 'flow').error === 'faltan datos'
    && elige(BEA, 'flow', 'T 1').error === 'faltan datos', 'lo que no está en el catálogo, un quien raro o una temporada rara no entran');

  r = elige(A.DUENO, 'frio');
  r = elige(A.DUENO, 'showman');
  r = elige(A.DUENO, 'cazafla');
  ok(r.ok && r.juego === 'cazafla' && r.dueno === true && r.puede === true, 'el dueño cambia cuantas veces quiera', r);

  elige(BEA, 'punchline');
  ok(o.juegoMio(BEA, 't1').cuantos.punchline === 2, 'cuántos eligió cada estilo cuenta a todos');

  // el ciclo: la clave como la de los TAGs (`claveDe()`), y el dueño como `dlx`
  sql.exec('INSERT INTO idk (id, k, t) VALUES (?, ?, ?)', ANA, 'ana', Date.now());
  const c = o.juegosCiclo();
  ok(c.ok && c.elegidos.ana && c.elegidos.ana.juego === 'punchline' && c.elegidos.ana.viejos.join() === 'flow'
    && c.elegidos[A.DUENO_K] && c.elegidos[A.DUENO_K].juego === 'cazafla' && !Object.values(c.elegidos).some((x) => x.juego === undefined),
    'el ciclo recibe {clave: {juego, viejos}}; quien no tiene clave todavía no va', c);
  ok(!('bea' in c.elegidos) && Object.keys(c.elegidos).length === 2, 'sin clave no hay a quién dibujarle la carta: queda afuera', c);
} catch (e) {
  fallas += 1;
  console.log('  🔴 la prueba reventó: ' + (e && e.stack));
}
if (fallas) {
  console.log(`\n❌ ${fallas} prueba(s) del estilo de juego fallaron (${bien} bien)`);
  process.exit(1);
}
console.log(`✅ el estilo de juego: ${bien} pruebas`);
