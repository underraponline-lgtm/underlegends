// 🏛️ La prueba de la tanda C del plan de los tiers (20/11/2026), sobre el objeto de verdad (SQLite de Node): los eventos de
// estilo que marca el dueño de un Tier 1 o 2 desde su panel, y el consejo de socios (propuesta, un voto por servidor, cierre,
// mayoría y las 48 h de veto).
// node bot/tanda_c_prueba.mjs
import * as A from './avisos.js';

let fallas = 0, bien = 0;
const ok = (c, t, extra) => {
  if (c) bien += 1;
  else { fallas += 1; console.log('  🔴 ' + t + (extra !== undefined ? '\n     ' + JSON.stringify(extra) : '')); }
};

let DatabaseSync = null;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { DatabaseSync = null; }
if (!DatabaseSync) {
  console.log('  ⓘ sin node:sqlite (Node ' + process.version + '): la tanda C no se prueba sobre el objeto');
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

const DLX = A.DUENO;
o.guardar('tiers', { t: '', servidores: [{ sv: 'AAA', tier: 2 }, { sv: 'BBB', tier: 1 }, { sv: 'CCC', tier: 3 }] });

try {
  // ── 🎭 los eventos de estilo desde el panel
  let r = await o.socioStaff({ quien: DLX, sv: 'AAA', que: 'estilo', accion: 'ver' });
  ok(r.ok && r.tier === 2 && r.puede === true, 'un Tier 2 puede marcar eventos de estilo', r);
  r = await o.socioStaff({ quien: DLX, sv: 'AAA', que: 'estilo', accion: 'marcar', id: 'a:123456789012345678', es: 'flow' });
  ok(r.ok && r.marcados['a:123456789012345678'] === 'flow', 'marcar uno de sus eventos con un estilo', r);
  ok((await o.socioStaff({ quien: DLX, sv: 'AAA', que: 'estilo', accion: 'marcar', id: 'a:1', es: 'flow' })).error === 'datos'
    && (await o.socioStaff({ quien: DLX, sv: 'AAA', que: 'estilo', accion: 'marcar', id: '12', es: 'nada' })).error === 'datos',
    'una clave o un estilo raros: no');
  ok((await o.socioStaff({ quien: DLX, sv: 'CCC', que: 'estilo', accion: 'marcar', id: '12', es: 'flow' })).error === 'tier'
    && (await o.socioStaff({ quien: DLX, sv: 'CCC', que: 'estilo', accion: 'ver' })).puede === false, 'un Tier 3 no da estilos');
  ok(JSON.stringify(o.leer('estilo_socios')) === JSON.stringify({ AAA: { 'a:123456789012345678': 'flow' } }), 'queda para el ciclo, por servidor');
  r = await o.socioStaff({ quien: DLX, sv: 'AAA', que: 'estilo', accion: 'quitar', id: 'a:123456789012345678' });
  ok(r.ok && !Object.keys(r.marcados).length && !o.leer('estilo_socios').AAA, 'desmarcarlo');
  ok((await o.socioStaff({ quien: '999999999999999999', sv: 'AAA', que: 'estilo', accion: 'ver' })).error === 'no', 'quien no es del staff no entra');

  // ── 🏛️ el consejo de socios
  r = o.consejoDueno({ accion: 'crear', titulo: '¿Sumamos una liga de 2v2?', texto: 'Una por mes.' });
  ok(r.ok && r.lista.length === 1 && r.lista[0].estado === 'abierta' && r.lista[0].total === 2 && JSON.stringify(r.votan) === '["AAA","BBB"]',
    'Dlx propone y votan los Tier 1 y 2 (no el 3)', r);
  const id = r.lista[0].id;
  r = await o.socioStaff({ quien: DLX, sv: 'AAA', que: 'consejo', accion: 'votar', id, r: 'si' });
  ok(r.ok && r.lista[0].mio === 'si' && r.lista[0].votaron === 1 && r.lista[0].estado === 'abierta', 'un voto por servidor', r);
  r = await o.socioStaff({ quien: DLX, sv: 'AAA', que: 'consejo', accion: 'votar', id, r: 'no' });
  ok(r.lista[0].mio === 'no' && r.lista[0].votaron === 1, 'mientras está abierta, se puede cambiar (sigue siendo uno)', r.lista[0]);
  ok((await o.socioStaff({ quien: DLX, sv: 'CCC', que: 'consejo', accion: 'votar', id, r: 'si' })).error === 'tier', 'un Tier 3 no vota');
  await o.socioStaff({ quien: DLX, sv: 'AAA', que: 'consejo', accion: 'votar', id, r: 'si' });
  r = await o.socioStaff({ quien: DLX, sv: 'BBB', que: 'consejo', accion: 'votar', id, r: 'si' });
  ok(r.lista[0].estado === 'veto' && r.lista[0].si === 2, 'votaron todos y ganó el sí: cierra y empiezan las 48 h de veto', r.lista[0]);
  ok((await o.socioStaff({ quien: DLX, sv: 'BBB', que: 'consejo', accion: 'votar', id, r: 'no' })).error === 'cerrada', 'cerrada, ya no se vota');
  const c = sql.exec('SELECT id, titulo, texto, t, cierra, veto FROM consejo WHERE id = ?', id).toArray()[0];
  const tard = Date.now() + A.CONSEJO_VETO + 60000;
  ok(o.consejoDe(c, tard, o.consejoVotan()).estado === 'aprobada', 'sin veto en 48 h: aprobada');
  r = o.consejoDueno({ accion: 'vetar', id });
  ok(r.ok && r.lista[0].estado === 'vetada', 'Dlx la veta dentro de las 48 h', r.lista[0]);
  // una que pierde por tiempo
  r = o.consejoDueno({ accion: 'crear', titulo: 'Otra' });
  const id2 = r.lista[0].id;
  await o.socioStaff({ quien: DLX, sv: 'AAA', que: 'consejo', accion: 'votar', id: id2, r: 'no' });
  const c2 = sql.exec('SELECT id, titulo, texto, t, cierra, veto FROM consejo WHERE id = ?', id2).toArray()[0];
  ok(o.consejoDe(c2, Date.now() + A.CONSEJO_DIAS * 86400000 + 1000, o.consejoVotan()).estado === 'no_paso', 'cerró por tiempo con más «no»: no pasó');
  ok(o.consejoDueno({ accion: 'vetar', id: id2 }).error === 'fuera_de_plazo', 'no se veta lo que está abierto o no pasó');
  ok(o.consejoDueno({ accion: 'crear', titulo: '' }).error === 'falta el título', 'sin título no se propone');

  // ── 🎟️🤝🆕 los ajustes del Tier 1
  const pv = A.ajusteValido('pases_t1', { BBB: { mes: '2026-11', n: 2, ev: ['a:123456789012345678', '700', '700'] } });
  ok(pv && pv.BBB.n === 2 && pv.BBB.ev.length === 2, 'los Pases de un Tier 1: cuántos y en qué eventos (sin repetir)', pv);
  ok(A.ajusteValido('pases_t1', { BBB: { mes: '2026-11', n: 99, ev: [] } }) === undefined
    && A.ajusteValido('pases_t1', { BBB: { mes: 'nov', n: 1, ev: [] } }) === undefined
    && A.ajusteValido('pases_t1', { BBB: { mes: '2026-11', n: 1, ev: ['x'] } }) === undefined, 'un número, un mes o un evento raros: no');
  ok(JSON.stringify(A.ajusteValido('alianzas', { BBB: ['AAA', 'CCC'] })) === '{"BBB":["AAA","CCC"]}'
    && A.ajusteValido('alianzas', { BBB: ['BBB'] }) === undefined, 'la Alianza: con quién va (no consigo mismo)');
  ok(A.ajusteValido('lo_nuevo_t1', [{ texto: 'El aviso de evento flojo', hasta: '2026-11-30' }]).length === 1
    && A.ajusteValido('lo_nuevo_t1', [{ texto: '', hasta: '2026-11-30' }]) === undefined, 'lo nuevo primero: el texto y hasta cuándo');

  // ── 🏆 la semanal del Tier 1: vale desde su semana, no para atrás
  const cfg = { semanales: [['dias'], ['t1']], semanales_desde: { t1: 1000 } };
  ok(o.semanalesDe(cfg, 999).map((t) => t[0]).join() === 'dias' && o.semanalesDe(cfg, 1000).map((t) => t[0]).join() === 'dias,t1'
    && o.semanalesDe({ semanales: [['dias']] }, 0).length === 1, 'la semanal del Tier 1 cuenta desde su semana: ni se paga ni pide boletos para atrás');
} catch (e) {
  fallas += 1;
  console.log('  🔴 se cayó: ' + (e && e.stack || e));
}
console.log((fallas ? '  🔴 ' + fallas + ' mal' : '  ✅ la tanda C') + ' · ' + bien + ' bien');
process.exit(fallas ? 1 : 0);
