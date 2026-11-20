// 🏟️ La prueba de la tanda B del plan de los tiers (20/11/2026), sobre el objeto de verdad (SQLite de Node): seguir a un
// servidor y su aviso (sin repetir el de la campana), el evento flojo una hora antes, los suplentes que pasan a titular y
// el premio del padrino cuando su invitado juega su primer evento.
// node bot/tanda_b_prueba.mjs
import * as A from './avisos.js';

let fallas = 0, bien = 0;
const ok = (c, t, extra) => {
  if (c) bien += 1;
  else { fallas += 1; console.log('  🔴 ' + t + (extra !== undefined ? '\n     ' + JSON.stringify(extra) : '')); }
};

let DatabaseSync = null;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { DatabaseSync = null; }
if (!DatabaseSync) {
  console.log('  ⓘ sin node:sqlite (Node ' + process.version + '): la tanda B no se prueba sobre el objeto');
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

const ANA = '111111111111111111', BEA = '222222222222222222', CAM = '333333333333333333', DAN = '444444444444444444';
// un mediodía en el este: fuera de cualquier horario de silencio
const AHORA = Date.UTC(2026, 10, 20, 17, 0, 0);
const sub = (quien, svs, n) => sql.exec('INSERT INTO subs (endpoint, p256dh, auth, svs, alta, visto, quien) VALUES (?, ?, ?, ?, ?, ?, ?)',
  'https://push.example/' + n, 'p', 'a', svs, AHORA, AHORA, quien);
const cola = (clave) => sql.exec('SELECT quien FROM org_cola WHERE clave = ? ORDER BY quien', clave).toArray().map((r) => r.quien);
const band = (quien, clave) => sql.exec('SELECT titulo FROM bandeja WHERE quien = ? AND clave = ?', quien, clave).toArray()[0];

try {
  // ── 🏟️ seguir a un servidor
  let r = o.seguirSv({ quien: ANA, sv: 'ffa' });
  ok(r.ok && r.svs.join() === 'FFA', 'seguir: en mayúsculas', r);
  o.seguirSv({ quien: BEA, sv: 'FFA' });
  o.seguirSv({ quien: CAM, sv: 'FFA' });
  ok(o.seguirSv({ quien: ANA, sv: 'nada!' }).error === 'servidor' && o.seguirSv({ quien: 'x', sv: 'FFA' }).error === 'faltan datos',
    'un servidor raro o una cuenta rara: no');
  ok(o.seguidoresSv('FFA') === 3, 'el dueño ve cuántos lo siguen');
  ok(o.seguirSv({ quien: CAM, sv: 'FFA', si: false }).svs.length === 0 && o.seguidoresSv('FFA') === 2, 'dejar de seguir');
  ok(o.seguirSv({ quien: ANA, accion: 'ver' }).svs.join() === 'FFA', 'ver los que sigues');
  // Ana tiene la campana de todos los servidores en su teléfono; Bea la tiene sólo de DRA
  sub(ANA, '', 1);
  sub(BEA, '|DRA|', 2);
  const n = o.colaSv('FFA', 'GRISELDA TIME', 'https://discord.com/channels/1/2/3', 'FFA', '900', AHORA, new Set());
  ok(n === 2 && band(ANA, 'sv:900') && band(BEA, 'sv:900'), 'el anuncio: a la bandeja de los dos que lo siguen', n);
  ok(cola('sv900').join() === BEA, 'el push sólo a quien no lo recibe ya por la campana de ese teléfono', cola('sv900'));
  const ya = new Set([BEA]);
  o.colaSv('FFA', 'OTRO', '', 'FFA', '901', AHORA, ya);
  ok(!band(BEA, 'sv:901'), 'quien ya recibió el aviso de su organizador no recibe otro del servidor');

  // ── 🔥 el evento flojo
  const ev = (id, sv, ini, cup) => sql.exec('INSERT INTO avisos (id, sv, cuerpo, desde, hasta, creado) VALUES (?, ?, ?, ?, ?, ?)', id, sv,
    JSON.stringify({ tipo: 'evento', sv, t: 'EVENTO ' + id, ini, cup, url: 'https://discord.com/channels/1/2/' + id }), AHORA, ini + 3600000, AHORA - 3600000);
  ev('1001', 'FFA', AHORA + 60 * 60000, '16');
  ev('1002', 'FFA', AHORA + 60 * 60000, '16');
  ev('1003', 'FFA', AHORA + 3 * 3600000, '16');
  ev('1004', 'FFA', AHORA + 58 * 60000, '');
  o.guardar('tiers', { t: '', servidores: [{ sv: 'FFA', frec: [ANA, BEA, CAM, 'no-es-id'] }] });
  o.guardar('anotados', { t: AHORA, ev: { 1001: Array(5).fill(['x', '', '', 0]), 1002: Array(9).fill(['x', '', '', 0]), 1004: Array(7).fill(['x', '', '', 0]) } });
  o.guardar('anotados_id', { t: AHORA, ev: { 1001: [CAM] } });
  const av = o.eventoFlojo(AHORA);
  ok(cola('flojo1001').join() === [ANA, BEA].join(), 'flojo (5 de 16): a los que juegan seguido ahí, menos al que ya se anotó', cola('flojo1001'));
  ok(!cola('flojo1002').length, 'con la mitad de los cupos (9 de 16) no es flojo');
  ok(!cola('flojo1003').length, 'falta más de una hora: todavía no mira');
  ok(cola('flojo1004').length === 3, 'sin cupos en el anuncio, el piso es ' + A.FLOJO_SIN_CUPOS + ' (7 anotados)', cola('flojo1004'));
  ok(av === 5 && /tiene lugar/.test((band(ANA, 'flojo:1001') || {}).titulo || ''), 'y a la bandeja', av);
  ok(o.eventoFlojo(AHORA + 60000) === 0, 'un aviso por evento: la vuelta siguiente no repite');

  // ── 🪑 los suplentes
  const E = [{ id: '2001', sv: 'FFA', ini: AHORA + 2 * 3600000, n: 'LA COPA', url: 'https://discord.com/channels/1/2/2001', cup: '2' }];
  const y = (a, aka) => ({ autor: a, aka });
  o.suplentes(E, { 2001: [y(ANA, 'Ana'), y(BEA, 'Bea'), y(CAM, 'Cam'), y(DAN, 'Dan')] }, AHORA);
  ok(JSON.stringify(o.leer('suplentes')['2001']) === JSON.stringify([CAM + '|Cam', DAN + '|Dan']), 'con 2 cupos, Cam y Dan son suplentes, en orden',
    o.leer('suplentes'));
  ok((o.leer('anotados_id').ev['2001'] || []).length === 4, 'los Discord IDs de cada evento, aparte (no viajan a la página)');
  o.suplentes(E, { 2001: [y(ANA, 'Ana'), y(CAM, 'Cam'), y(DAN, 'Dan')] }, AHORA + 60000);
  ok(band(CAM, 'sup:2001:' + CAM) && cola('sup2001').join() === CAM && !band(DAN, 'sup:2001:' + DAN),
    'Bea se borró: Cam pasa a titular y le avisa; Dan sigue de suplente', cola('sup2001'));
  o.suplentes(E, { 2001: [y(ANA, 'Ana'), y(CAM, 'Cam'), y(DAN, 'Dan')] }, AHORA + 120000);
  ok(cola('sup2001').length === 1, 'no le vuelve a avisar');

  // ── 🥇 el padrino
  sql.exec('INSERT INTO referidos (quien, de, temp, t, cumple, n) VALUES (?, ?, ?, ?, 1, 1)', DAN, ANA, 't1', AHORA);
  sql.exec('INSERT INTO referidos (quien, de, temp, t, cumple, n) VALUES (?, ?, ?, ?, 0, 0)', CAM, ANA, 't1', AHORA);
  ok(!o.refJugo(DAN, 0, AHORA), 'sin jugar todavía, nada');
  ok(o.refJugo(DAN, 1, AHORA), 'su primer evento: el premio');
  const pdt = sql.exec("SELECT monto FROM tienda WHERE quien = ? AND id LIKE 'refj:%'", ANA).toArray();
  const dr = sql.exec("SELECT 1 FROM drops WHERE quien = ? AND origen = ?", ANA, 'refj:' + DAN).toArray();
  ok(pdt.length === 1 && pdt[0].monto === A.REF_JUGO_PDT && dr.length === 1 && band(ANA, 'ref:jugo:' + DAN),
    'a quien invitó: ' + A.REF_JUGO_PDT + ' Puntos de Tienda, un Drop y el aviso', { pdt, dr });
  ok(!o.refJugo(DAN, 3, AHORA) && sql.exec("SELECT COUNT(*) AS n FROM tienda WHERE id LIKE 'refj:%'").toArray()[0].n === 1,
    'una sola vez por invitado');
  ok(!o.refJugo(CAM, 2, AHORA), 'el que todavía no cuenta (sin verificarse o sin el nivel 1) no paga');

  // ── ⭐ calificar el evento
  sql.exec('INSERT INTO ev_gente (ev, sv, ini, q) VALUES (?, ?, ?, ?)', '700', 'FFA', AHORA - 3600000, JSON.stringify([ANA, BEA]));
  ok(o.calificar({ quien: ANA, ev: '700', accion: 'ver' }).puede === true && o.calificar({ quien: CAM, ev: '700', accion: 'ver' }).puede === false,
    'puede calificar quien jugó; el resto no');
  r = o.calificar({ quien: ANA, ev: '700', nota: 5 });
  ok(r.ok && r.nota === 5 && r.drop === true, 'la primera vez: su nota y un Drop', r);
  r = o.calificar({ quien: ANA, ev: '700', nota: 4 });
  ok(r.ok && r.nota === 4 && r.drop === false, 'cambiarla vale, pero no da otro Drop', r);
  ok(o.calificar({ quien: CAM, ev: '700', nota: 5 }).error === 'no_jugaste' && o.calificar({ quien: ANA, ev: '701', nota: 5 }).error === 'cerrado'
    && o.calificar({ quien: BEA, ev: '700', nota: 9 }).error === 'nota', 'quien no jugó, un evento cerrado o una nota rara: no');
  o.calificar({ quien: BEA, ev: '700', nota: 2 });
  const ns = o.notasSv('FFA');
  ok(ns.length === 1 && ns[0][0] === '700' && ns[0][1] === 2 && ns[0][2] === 3, 'el dueño ve cuántos calificaron y el promedio, nunca quién', ns);
  // el ciclo reemplaza quién jugó: lo que sale ya no se puede calificar
  // el mismo objeto (la misma base), con lo que el ciclo deja en KV
  const o2 = new A.Avisos({ storage: { sql, setAlarm() {}, getAlarm() { return null; } }, blockConcurrencyWhile: async (f) => f() },
    { KV: { get: async (k) => (k === 'precios:resolucion' ? JSON.stringify({ v: 'x1', r: {}, evg: { 702: ['DRA', AHORA, [CAM], 'LA NOCHE'] } }) : null) } });
  await new Promise((res) => setTimeout(res, 5));
  await o2.resolverPrecios(AHORA);
  ok(o.calificar({ quien: ANA, ev: '700', accion: 'ver' }).puede === false && o.calificar({ quien: CAM, ev: '702', accion: 'ver' }).puede === true,
    'el ciclo manda quién jugó los últimos días y lo de antes cierra');
  ok(/LA NOCHE/.test((band(CAM, 'cal:702') || {}).titulo || '') && !band(ANA, 'cal:702'), 'al que jugó un evento nuevo, el aviso en la bandeja para calificarlo');
} catch (e) {
  fallas += 1;
  console.log('  🔴 se cayó: ' + (e && e.stack || e));
}
console.log((fallas ? '  🔴 ' + fallas + ' mal' : '  ✅ la tanda B') + ' · ' + bien + ' bien');
process.exit(fallas ? 1 : 0);
