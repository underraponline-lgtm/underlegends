// 🎟️ La prueba de lo del Pase del 25/10/2026, sobre el objeto de verdad (SQLite de Node): la semana de gracia, la
// bienvenida, las especiales, la XP doble, la meta de la crew, el premium (+20 %, la fila que cobra de una vez) y el
// sorteo. Lo de antes del Pase lo prueba avisos_prueba.mjs. node bot/pase_prueba.mjs
import * as A from './avisos.js';

let fallas = 0, bien = 0;
const ok = (c, t, extra) => {
  if (c) bien += 1;
  else { fallas += 1; console.log('  🔴 ' + t + (extra !== undefined ? '\n     ' + extra : '')); }
};

let DatabaseSync = null;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { DatabaseSync = null; }
if (!DatabaseSync) {
  console.log('  ⓘ sin node:sqlite (Node ' + process.version + '): el Pase no se prueba sobre el objeto');
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

const H = 3600000, DIA = 24 * H;
const relojReal = Date.now;
// ⏱️ el miércoles 28/10/2026 a las 2 PM del este (UTC−4); la semana arrancó el lunes 26 a las 11 AM
let AHORA = Date.UTC(2026, 9, 28, 18, 0);
Date.now = () => AHORA;
const ANA = '111111111111111111', BEA = '222222222222222222', CAMI = '333333333333333333', DANI = '444444444444444444';
const W1 = '2026-10-19', W2 = '2026-10-26';
const i1 = Date.UTC(2026, 9, 19, 15, 0), i2 = i1 + 7 * DIA, f2 = i2 + 7 * DIA;
const UMB = Array.from({ length: 30 }, (_, i) => (i < 3 ? 300 * (i + 1) : 900 + 1000 * (i - 2)));
const DIARIAS = [['entrar', 'Entra hoy', '', 'activo', 1, 150], ['sigue1', 'Sigue a un rapero', '', 'sigue', 1, 150],
  ['felicitar1', 'Felicita a alguien', '', 'fel', 1, 150]];
const SEMANALES = [['dias', 'Entra 3 días', '', 'activo', 3, 500], ['felicitar', 'Felicita a 3', '', 'fel', 3, 500]];
const TEMPORADA = [['fel10', 'Felicita a 10', '', 'fel', 10, 1500]];
const BIENVENIDA = [['bfel', 'Felicita a alguien', '', 'fel', 1, 200], ['bsigue3', 'Sigue a 3', '', 'sigue', 3, 200],
  ['bvoto', 'Vota', '', 'voto', 1, 200]];
// la especial: el martes 27, de 6 PM a medianoche del este
const EI = Date.UTC(2026, 9, 27, 22, 0), EF = EI + 6 * H;
const PREMIOS = Array.from({ length: 30 }, (_, i) => [i + 1, 150, '', '']);
const PREMIUM = Array.from({ length: 30 }, (_, i) => [i + 1, 150].concat({ 1: ['marco', 'Premium'], 5: ['fondo', 'perfil'],
  7: ['color', 'elegir'], 10: ['titulo', 'Del Pase'] }[i + 1] || ['', '']));
const CFG = { temp: 'prueba', niveles: 30, umbrales: UMB, cola: [1000, 300], diarias: DIARIAS, por_dia: 2, semanales: SEMANALES,
  temporada: TEMPORADA, premios: PREMIOS, publicar: [10, 30], bienvenida: BIENVENIDA,
  especiales: [['halloween', 'Halloween', '', 'fel', 2, 1000, EI, EF]], doble: [[i2, f2, 2]], gracia_desde: W1,
  crew: [300, 5, 10, 60], boost: 20, premium: PREMIUM };
let v = 0;
const ciclo = (extra = {}) => o.paseCiclo(Object.assign({ v: 'v' + (++v), cfg: CFG, sem: [[W1, i1, i2], [W2, i2, f2]],
  miembros: [ANA, BEA, CAMI], hechas: {} }, extra));
const fel = (q, t, ref) => sql.exec("INSERT OR IGNORE INTO pase_log (quien, temp, que, ref, t) VALUES (?, 'prueba', 'fel', ?, ?)",
  q, ref, t);
const hechas = (q) => sql.exec('SELECT sem, tarea, t FROM pase_hecho WHERE quien = ? ORDER BY sem, tarea', q).toArray();
const tienda = (q) => sql.exec('SELECT id, monto FROM tienda WHERE quien = ? ORDER BY id', q).toArray();

try {
  // ── la configuración nueva entra entera, y lo raro se tira ──
  let r = ciclo();
  const C = o.paseDatos().cfg;
  ok(r.ok && C.bienvenida.length === 3 && C.especiales[0][6] === EI && C.especiales[0][7] === EF && C.doble[0][2] === 2
    && C.gracia_desde === W1 && C.crew.join() === '300,5,10,60' && C.boost === 20 && C.premium[0][2] === 'marco'
    && C.xp.bfel === 200 && C.xp.halloween === 1000 && C.xp.crew === 300,
  'la configuración del 25/10: bienvenida, especiales con su ventana, XP doble, gracia, crew, boost y fila premium', JSON.stringify(r));
  ok(o.paseCiclo({ v: 'x1', cfg: Object.assign({}, CFG, { bienvenida: BIENVENIDA.concat([SEMANALES[0]]) }), sem: [], miembros: [],
    hechas: {} }).error && o.paseCiclo({ v: 'x2', cfg: Object.assign({}, CFG, { especiales: [['crew', 'x', '', 'fel', 1, 1, EI, EF]] }),
    sem: [], miembros: [], hechas: {} }).error,
  'un id repetido entre la bienvenida y las semanales, o una Tarea que se llama «crew», no se toma');

  // ── la XP doble: lo cumplido esta semana vale el doble; lo de la anterior, lo de siempre ──
  sql.exec("INSERT INTO pase_hecho (quien, temp, sem, tarea, t) VALUES (?, 'prueba', ?, 'dias', ?)", DANI, W1, i1 + DIA);
  sql.exec("INSERT INTO pase_hecho (quien, temp, sem, tarea, t) VALUES (?, 'prueba', ?, 'dias', ?)", DANI, W2, i2 + DIA);
  ok(o.paseXP(DANI, o.paseDatos().cfg) === 500 + 1000, 'la XP doble: la semanal de la semana doble da 1.000, la otra 500');

  // ── la semana de gracia: Ana felicitó 1 la semana pasada y 2 esta; la semanal de la pasada se cumple ahora ──
  fel(ANA, i1 + 2 * DIA, 'a1');
  fel(ANA, EI + H, 'a2');
  fel(ANA, EI + 2 * H, 'a3');
  let p = o.paseDe(ANA);
  const hA = hechas(ANA);
  ok(hA.some((x) => x.sem === W1 && x.tarea === 'felicitar') && !hA.some((x) => x.sem === W2 && x.tarea === 'felicitar')
    && p.gracia && p.gracia.tareas.map((t) => t.id).join() === 'dias',
    'la gracia: lo que hizo esta semana completa la semanal que le faltó la pasada, y paga en SU semana', JSON.stringify(hA));
  // y la especial: dos felicitaciones el martes 27 entre las 6 PM y la medianoche
  ok(hA.some((x) => x.sem === 'e:halloween' && x.tarea === 'halloween') && p.especiales[0].hecha && p.especiales[0].ini === EI,
    'la especial: dos felicitaciones adentro de su ventana la cumplen');
  ok(hA.some((x) => x.sem === 'bien' && x.tarea === 'bfel') && !hA.some((x) => x.tarea === 'bsigue3')
    && p.bienvenida.find((t) => t.id === 'bfel').hecha && !p.bienvenida.find((t) => t.id === 'bvoto').hecha,
  'la bienvenida: «felicita a alguien» cumplida al aparecer; seguir y votar, todavía no');

  // Bea: le falta la semanal de la semana pasada y no hizo nada esta: la gracia se le muestra
  fel(BEA, i1 + DIA, 'b1');
  p = o.paseDe(BEA);
  ok(p.gracia && p.gracia.id === W1 && p.gracia.fin === i2 + 7 * DIA && p.gracia.tareas.some((t) => t.id === 'felicitar'),
    'la página le muestra a Bea la semanal que todavía puede salvar, y hasta cuándo', JSON.stringify(p.gracia));
  // lo de antes de `gracia_desde` no se paga para atrás
  ok(o.paseCiclo({ v: 'g' + v, cfg: Object.assign({}, CFG, { gracia_desde: W2 }), sem: [[W1, i1, i2], [W2, i2, f2]],
    miembros: [ANA, BEA, CAMI], hechas: {} }).ok && !o.paseDe(CAMI).gracia, 'una semana anterior a `gracia_desde`: sin gracia');
  ciclo();

  // ── el premium: Ana recibe el rol; cobra de una vez la fila premium de los niveles que ya pasó ──
  AHORA += 60000;
  const nivelA = o.paseDe(ANA).nivel;
  const antesXP = o.paseXP(ANA, o.paseDatos().cfg);
  r = ciclo({ premium: [ANA] });
  const pagosP = tienda(ANA).filter((x) => /:p\d+$/.test(x.id));
  const bP = sql.exec("SELECT titulo FROM bandeja WHERE quien = ? AND clave = 'pase-premium:prueba'", ANA).toArray();
  ok(nivelA >= 1 && pagosP.length === nivelA && bP.length === 1 && o.paseDe(ANA).premium && o.paseDe(ANA).premium.hasta === null,
    'desbloquear el premium paga ya los ' + nivelA + ' niveles de la fila premium y avisa por la campana',
    JSON.stringify({ nivelA, pagosP, bP }));
  ok(o.paseXP(ANA, o.paseDatos().cfg) === antesXP, 'el +20 % no es para atrás: lo cumplido antes del rol vale lo mismo');
  AHORA += H;
  fel(ANA, AHORA - 1000, 'a4');
  sql.exec("INSERT INTO pase_hecho (quien, temp, sem, tarea, t) VALUES (?, 'prueba', 'd:2026-10-28', 'felicitar1', ?)", ANA, AHORA);
  ok(o.paseXP(ANA, o.paseDatos().cfg) === antesXP + Math.round(150 * 2 * 1.2),
    'con el premium y en la semana doble: 150 × 2 × 1,2 = 360', o.paseXP(ANA, o.paseDatos().cfg) - antesXP);
  ciclo({ premium: [ANA] });
  ok(tienda(ANA).filter((x) => /:p\d+$/.test(x.id)).length === pagosP.length, 'el mismo rol otra vez no cobra dos veces');
  // le sacan el rol: su XP de ese rato no cambia, pero lo nuevo ya no lleva el +20 %
  o.paseRevisar(ANA);
  const conRol = o.paseXP(ANA, o.paseDatos().cfg);
  AHORA += H;
  ciclo({ premium: [] });
  ok(o.paseDe(ANA).premium.hasta === AHORA && o.paseXP(ANA, o.paseDatos().cfg) === conRol, 'sin el rol: lo ganado se queda',
    JSON.stringify([o.paseDe(ANA).premium, AHORA, o.paseXP(ANA, o.paseDatos().cfg), conRol]));
  ciclo({ premium: [ANA] });
  ok(o.paseDe(ANA).premium.hasta === null && sql.exec("SELECT COUNT(*) AS n FROM bandeja WHERE quien = ? AND clave = 'pase-premium:prueba'",
    ANA).toArray()[0].n === 1, 'y si vuelve, vuelve el +20 % (sin otro aviso)');
  // 🖼️ los marcos: el del nivel 1 entró al inventario al cobrar la fila premium, y se queda aunque le saquen el rol
  sql.exec("INSERT OR IGNORE INTO idk (id, k, t) VALUES (?, 'ana', 1)", ANA);
  ok(o.marcosDe(ANA).tienes.map((x) => x[0]).join() === 'prueba:premium' && o.marcosPublicos().ana
    && o.marcosPublicos().ana[0] === 'prueba:premium' && o.marcosPublicos().ana[1] === 'camiseta' && o.marcosPublicos().ana[2] === 1,
  'el marco Premium entra al inventario de Ana, y su carta lo lleva (camiseta por defecto, serie 1)', JSON.stringify(o.marcosPublicos()));
  ok(o.marcoElige({ quien: ANA, marco: 'prueba:oro', estilo: 'cadena' }).error === 'no lo tienes'
    && o.marcoElige({ quien: ANA, marco: 'prueba:premium', estilo: 'cadena' }).ok && o.marcosPublicos().ana[1] === 'cadena'
    && o.marcoElige({ quien: ANA, marco: 'ninguno', estilo: 'cadena' }).ok && !o.marcosPublicos().ana
    && o.marcoElige({ quien: ANA, marco: '', estilo: 'cadena' }).ok && o.marcosPublicos().ana && A.mejorMarco(['t1:plata', 't1:oro', 't2:premium']) === 't1:oro',
  'elegir: sólo un marco que tengas, el estilo de la Servidor, o «ninguno»; sin elegir, el mejor');
  const pr = o.pasePremios(o.paseDatos().cfg, 8, ANA);
  ok(pr.premium && pr.marco === 'Premium' && !pr.titulo, 'en el nivel 8 con premium: el marco Premium, todavía sin el título');
  ok(A.PASE_COLORES.includes('#29B298') && o.paseColorPoner({ quien: BEA, color: '#29B298' }).error === 'premium',
    'el color premium: sin el premium, no');

  // ── los avisos del Pase: apagados de entrada, se prenden y se apagan ──
  ok(!o.paseDe(BEA).aviso && o.paseAvisoPoner({ quien: BEA, si: true }).si && o.paseDe(BEA).aviso
    && o.paseAvisoPoner({ quien: BEA, si: 'si' }).error, 'los avisos del Pase: apagados hasta que se prenden');

  // ── la crew: Ana, Bea y Cami en «Los del Barrio»; meta = máx(10, 5 × 3) = 15 Tareas en la semana ──
  sql.exec("INSERT INTO crews (id, nombre, norm, creada, t) VALUES ('c1', 'Los del Barrio', 'losdelbarrio', 1, 1)");
  for (const [k, q] of [['ana', ANA], ['bea', BEA], ['cami', CAMI]]) {
    sql.exec("INSERT INTO crew_miembros (k, crew, rol, quien, desde) VALUES (?, 'c1', 'miembro', ?, 1)", k, q);
  }
  const s2 = [W2, i2, f2];
  let c = o.paseCrew(ANA, s2, o.paseDatos());
  ok(c && c.meta === 15 && c.n === 3 && c.hechas < 15, 'la meta de la crew: 15 Tareas entre los tres', JSON.stringify(c));
  for (let j = 0; j < 15; j++) {
    sql.exec("INSERT OR IGNORE INTO pase_hecho (quien, temp, sem, tarea, t) VALUES (?, 'prueba', ?, ?, ?)", CAMI, 'x' + j, 't' + j, i2 + H);
  }
  o.paseRevisar(BEA);
  c = o.paseCrew(ANA, s2, o.paseDatos());
  ok(c.hechas >= 15 && hechas(BEA).some((x) => x.sem === W2 && x.tarea === 'crew') && o.paseDe(BEA).crew.cobrada,
    'la crew llegó: Bea cobra sus 300 XP al aparecer (en la semana doble, 600)');
  ok(o.paseCrew(ANA, s2, o.paseDatos()).hechas === c.hechas, 'la Tarea de la crew no cuenta para la meta de la crew');

  // Ana completa la semana pasada (las dos semanales), para el sorteo
  sql.exec("INSERT OR IGNORE INTO pase_hecho (quien, temp, sem, tarea, t) VALUES (?, 'prueba', ?, 'dias', ?)", ANA, W1, i1 + DIA);
  // ── el sorteo: Dlx lo programa; entrar da 1 + las semanas completas (máx 3); a la hora, uno solo y repetible ──
  o.guardar('ajustes_dueno', { pase_sorteo: A.ajusteValido('pase_sorteo', { id: 'premium-t1', cierra: '2026-10-30T22:00:00Z',
    sorteo: '2026-10-31T00:00:00Z' }) });
  ok(A.ajusteValido('pase_sorteo', { id: 'x y', cierra: '2026-10-30', sorteo: '2026-10-31' }) === undefined
    && A.ajusteValido('pase_sorteo', { id: 'abc', cierra: '2026-11-01', sorteo: '2026-10-31' }) === undefined
    && A.ajusteValido('pase_sorteo', null) === null, 'el ajuste del sorteo: id limpio y cierra antes de sortear');
  sql.exec("INSERT OR IGNORE INTO idk (id, k, t) VALUES (?, 'ana', 1)", ANA);
  sql.exec("INSERT INTO idk (id, k, t) VALUES (?, 'bea', 1)", BEA);
  const eA = o.sorteoEntrar({ quien: ANA }), eB = o.sorteoEntrar({ quien: BEA });
  ok(eA.ok && eA.mio === 2 && eB.mio === 1 && eB.sorteo.personas === 2 && eB.sorteo.boletos === 3
    && o.sorteoEntrar({ quien: DANI }).error === 'miembro',
  'entrar al sorteo: Ana con 2 boletos (completó la semana pasada), Bea con 1; quien no es del Pase, no', JSON.stringify([eA.mio, eB.mio]));
  ok(await o.sortear(AHORA) === null && !o.sorteoDe('').resultado, 'antes de la hora no se sortea');
  AHORA = Date.parse('2026-10-31T00:00:30Z');
  ok(o.sorteoEntrar({ quien: CAMI }).error === 'cerrado', 'después del cierre no se entra');
  const g = await o.sortear(AHORA);
  const sd = o.sorteoDe(BEA);
  ok([ANA, BEA].includes(g) && sd.resultado && sd.resultado.personas === 2 && sd.resultado.boletos === 3
    && ['ana', 'bea'].includes(sd.resultado.k) && sd.resultado.yo === (g === BEA) && !JSON.stringify(sd).includes(ANA)
    && await o.sortear(AHORA + 60000) === null,
  'a la hora: un ganador, una sola vez, y lo público dice la clave del perfil, nunca un Discord ID', JSON.stringify(sd));
  // la cuenta es repetible: SHA-256 de «id:lista ordenada» módulo los boletos
  const { createHash } = await import('node:crypto');
  const lista = [ANA + 'x2', BEA + 'x1'].sort().join(',');
  const hex = createHash('sha256').update('premium-t1:' + lista).digest('hex');
  let i = Number(BigInt('0x' + hex) % 3n);
  const esperado = [[ANA, 2], [BEA, 1]].sort((a, b) => (a[0] < b[0] ? -1 : 1)).find(([, n]) => (i < n ? true : ((i -= n), false)))[0];
  ok(sd.resultado.semilla === hex && g === esperado, 'cualquiera puede repetir la cuenta con la semilla y la lista');

  // 🎟️ el rol al ganador lo pone el bot (`sorteoRol()`): sólo con `rol_regalo` en la configuración, una vez, y con
  // Discord caído se reintenta en la vuelta siguiente del vigía
  const antesF = globalThis.fetch;
  const pedidos = [];
  let estado = 500;
  globalThis.fetch = async (u, op = {}) => { pedidos.push([String(u), op.method]); return new Response(null, { status: estado }); };
  o.env.DISCORD_TOKEN = 'x';
  try {
    ok(await o.sorteoRol(AHORA) === 0 && !pedidos.length, 'sin `rol_regalo` en la configuración, no toca Discord');
    CFG.rol_regalo = '1563941336531607575';
    ciclo({ premium: [ANA] });
    await o.sorteoRol(AHORA);
    const rol0 = o.sorteoDe('').resultado.rol;
    estado = 204;
    await o.sorteoRol(AHORA);
    const n = pedidos.length;
    await o.sorteoRol(AHORA);
    const bG = sql.exec("SELECT titulo FROM bandeja WHERE quien = ? AND clave = 'sorteo:premium-t1'", g).toArray();
    ok(rol0 === 0 && o.sorteoDe('').resultado.rol === 1 && n === 2 && pedidos.length === 2
      && pedidos[1][0].endsWith('/guilds/841017460341604382/members/' + g + '/roles/1563941336531607575') && pedidos[1][1] === 'PUT'
      && bG.length === 1,
    'el bot le pone el rol «Pase Premium» al ganador: reintenta si Discord falla, una sola vez si sale, y le avisa por la campana',
    JSON.stringify({ rol0, pedidos, bG }));
  } finally {
    globalThis.fetch = antesF;
  }

  // ── el fondo: el nivel 5 del perfil, el premium desde su 5, o quien ya lo tenía ──
  sql.exec("INSERT INTO fondos (quien, estado, t) VALUES (?, 'ok', 1)", CAMI);
  ok(A.FONDO_NIVEL === 5 && o.puedeFondo(CAMI).si && !o.puedeFondo(DANI).si, 'el fondo: quien ya lo tenía lo conserva; sin nada, no');
} finally {
  Date.now = relojReal;
}

if (fallas) {
  console.log(`\n❌ ${fallas} prueba(s) del Pase fallaron (${bien} bien)`);
  process.exit(1);
}
console.log(`✅ el Pase del 25/10: ${bien} pruebas`);
