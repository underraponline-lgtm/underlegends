// 👗 La prueba de los LOOKS GUARDADOS (17/11/2026), sobre el objeto de verdad (SQLite de Node): guardar en el primero
// libre, pisar uno, el tope, borrar, el nombre limpio, lo que no tiene forma de look y que cada uno ve sólo los suyos.
// node bot/looks_prueba.mjs
import * as A from './avisos.js';

let fallas = 0, bien = 0;
const ok = (c, t, extra) => {
  if (c) bien += 1;
  else { fallas += 1; console.log('  🔴 ' + t + (extra !== undefined ? '\n     ' + JSON.stringify(extra) : '')); }
};

let DatabaseSync = null;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { DatabaseSync = null; }
if (!DatabaseSync) {
  console.log('  ⓘ sin node:sqlite (Node ' + process.version + '): los looks no se prueban sobre el objeto');
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
const L1 = { tags: { competitivo: '🧊 SANGRE FRÍA', temporada: 'auto' }, marco: 't1:oro', estilo: 'cadena' };

try {
  let r = o.looksDe(ANA);
  ok(r.ok && r.looks.length === 0 && r.max === A.MAX_LOOKS, 'sin looks: la lista vacía y el tope', r);

  r = o.lookGuardar({ quien: ANA, nombre: 'Finales', look: L1 });
  ok(r.ok && r.guardado === 0 && r.looks.length === 1 && r.looks[0].nombre === 'Finales'
    && r.looks[0].look.tags.competitivo === '🧊 SANGRE FRÍA' && r.looks[0].look.marco === 't1:oro', 'guardar uno: va al primero libre', r);
  r = o.lookGuardar({ quien: ANA, look: { marco: 'ninguno' } });
  ok(r.guardado === 1 && r.looks[1].nombre === 'Look 2', 'sin nombre: «Look 2»', r);
  r = o.lookGuardar({ quien: ANA, n: 0, nombre: 'Finales 2', look: { tags: { pais: 'auto' } } });
  ok(r.guardado === 0 && r.looks.length === 2 && r.looks[0].nombre === 'Finales 2' && !r.looks[0].look.tags.competitivo,
    'con `n` pisa ese lugar, entero', r);

  for (let i = 0; i < 3; i++) o.lookGuardar({ quien: ANA, look: { estilo: 'camiseta' } });
  ok(o.looksDe(ANA).looks.length === A.MAX_LOOKS, 'se llena hasta el tope');
  r = o.lookGuardar({ quien: ANA, look: { estilo: 'camiseta' } });
  ok(r.error === 'lleno', 'lleno: no pisa ninguno sin que digas cuál', r);

  r = o.lookBorrar({ quien: ANA, n: 1 });
  ok(r.looks.length === A.MAX_LOOKS - 1 && !r.looks.some((x) => x.n === 1), 'borrar uno', r);
  r = o.lookGuardar({ quien: ANA, look: { marco: '' } });
  ok(r.guardado === 1, 'y su lugar vuelve a estar libre', r);

  ok(o.looksDe(BEA).looks.length === 0, 'cada uno ve sólo los suyos');
  ok(o.lookGuardar({ quien: BEA, look: { tags: { x: 'y' }, marco: 'javascript:alert(1)', estilo: 'traje' } }).error === 'faltan datos',
    'un look sin nada que tenga forma de look no entra');
  ok(o.lookGuardar({ quien: 'abc', look: L1 }).error === 'faltan datos' && o.lookBorrar({ quien: BEA, n: 'x' }).error === 'faltan datos',
    'un quien raro o un `n` raro no entran');
  r = o.lookGuardar({ quien: BEA, nombre: '  <b>muy\nlargo</b> con más de veinticuatro letras  ', look: { tags: { pais: '<img>', temporada: 'ok' } } });
  ok(r.ok && r.looks[0].nombre.length <= 24 && !/[<>\n]/.test(r.looks[0].nombre) && !r.looks[0].look.tags.pais && r.looks[0].look.tags.temporada === 'ok',
    'el nombre sale limpio y corto, y una llave con < no entra', r);
} catch (e) {
  fallas += 1;
  console.log('  🔴 reventó: ' + (e && e.stack || e));
}
console.log((fallas ? '🔴 ' : '✅ ') + 'los looks guardados: ' + bien + ' bien' + (fallas ? ', ' + fallas + ' mal' : ''));
process.exit(fallas ? 1 : 0);
