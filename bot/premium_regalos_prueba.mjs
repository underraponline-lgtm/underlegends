// 🎁 La prueba de los dos regalos del Pase Premium (28/11/2026), sobre el objeto de verdad (SQLite de Node), sin red:
//   · la prueba de PRUEBA_DIAS días: sin verificar no; verificado sí, una vez; usada, vencida, el aviso del día antes, el
//     Premium de temporada que no se toca, dos clics a la vez, mudarCuenta y «olvidarme»; y que cada «¿es Premium?»
//     respete el vencimiento (el Pase, los grabados, la página, el vale de campeón);
//   · la temporada por jugar un evento de nuevos: una vez por cuenta, el que ya era Premium guarda el vale, la prueba pasa a
//     temporada; y el ajuste `eventos_nuevos` del Dashboard.
//
//     node bot/premium_regalos_prueba.mjs
import * as PRG from './premium_regalos.js';
import * as GR from './grabados.js';

let fallas = 0, bien = 0;
const ok = (c, t, extra) => {
  if (c) bien += 1;
  else { fallas += 1; console.log('  🔴 ' + t + (extra !== undefined ? '\n     ' + extra : '')); }
};
const H = 3600000, DIA = 24 * H;
const relojReal = Date.now;
let AHORA = Date.UTC(2026, 10, 28, 18, 0);
Date.now = () => AHORA;

// ── el ajuste del Dashboard (sin objeto) ──────────────────────────────────────────────────────────────────────────
ok(JSON.stringify(PRG.ajusteNuevos({ 700: 1, 'a:1440000000000000001': 0 })) === '{"700":1,"a:1440000000000000001":0}', 'el ajuste: número o anuncio, 1 o 0');
ok(PRG.ajusteNuevos({ 700: 2 }) === undefined && PRG.ajusteNuevos({ raro: 1 }) === undefined && PRG.ajusteNuevos([1]) === undefined,
  'lo raro se rechaza entero');
ok(PRG.ajusteNuevos(null) === null, '«Deshacer» (null) vale');
ok(PRG.PRUEBA_DIAS === 14, 'la prueba dura 14 días (Dlx, 28/11/2026)');

let DatabaseSync = null;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { DatabaseSync = null; }
if (!DatabaseSync) {
  console.log('  ⓘ sin node:sqlite (Node ' + process.version + '): el objeto no se prueba');
} else {
  const A = await import('./avisos.js');
  ok(A.ajusteValido('eventos_nuevos', { 12: 1 }) && A.ajusteValido('eventos_nuevos', { 12: 5 }) === undefined, 'el Worker valida `eventos_nuevos`');
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
  const al = async (ruta, d) => (await o.fetch(new Request('https://avisos/' + ruta, { method: 'POST', body: JSON.stringify(d) }))).json();

  const V = '700000000000000001', V2 = '700000000000000002', NOV = '700000000000000003', ROL = '700000000000000004',
    VIEJO = '700000000000000005', NUEVA = '700000000000000006', ROLC = '700000000000000007', N1 = '700000000000000011',
    N2 = '700000000000000012', N3 = '700000000000000013';
  const UMB = Array.from({ length: 30 }, (_, i) => 100 * (i + 1));
  const CFG = { temp: 'prueba', niveles: 30, umbrales: UMB, cola: [1000, 300], diarias: [['entrar', 'Entra hoy', '', 'activo', 1, 150]],
    por_dia: 2, semanales: [], temporada: [], premios: [], publicar: [10, 30], bienvenida: [], especiales: [], doble: [], boost: 20,
    premium: [[1, 100, 'titulo', 'Prueba VIP'], [2, 100, 'reaccion', '🔥']] };
  const s0 = AHORA - 3 * DIA;
  let vv = 0;
  const miembros = [V, V2, ROL, VIEJO, NUEVA, ROLC, N1, N2, N3];
  const ciclo = (premium, extra = {}) => o.paseCiclo(Object.assign({ v: 'v' + (++vv), cfg: CFG, sem: [['2026-11-23', s0, s0 + 60 * DIA]],
    miembros, hechas: {}, premium }, extra));
  ok(ciclo([ROL, ROLC]).ok, 'el Pase entra, con dos Premium por el rol');
  ciclo([ROL]);                                             // ROLC pierde el rol: su rango se cierra
  const bandeja = (q, clave) => sql.exec('SELECT titulo, cuerpo, url FROM bandeja WHERE quien = ? AND clave = ?', q, clave).toArray()[0];
  // un poco de XP para que la fila premium tenga algo que cobrar
  sql.exec("INSERT INTO pase_hecho (quien, temp, sem, tarea, t) VALUES (?, 'prueba', 'd:2026-11-28', 'entrar', ?)", V, AHORA - H);
  sql.exec("INSERT INTO pase_hecho (quien, temp, sem, tarea, t) VALUES (?, 'prueba', 'd:2026-11-27', 'entrar', ?)", V, AHORA - DIA);
  o.pxpOlvidar();

  // ── 1. quién puede ──────────────────────────────────────────────────────────────────────────────────────────────
  let e = await al('premium-prueba', { quien: NOV });
  ok(!e.puede && e.por === 'verificar' && e.verificar === '#/cuenta/verificar', 'sin verificar: no, y dice cómo verificarse', JSON.stringify(e));
  e = await al('premium-prueba', { quien: NOV, si: true });
  ok(e.error === 'verificar' && !sql.exec('SELECT 1 FROM premium_prueba WHERE quien = ?', NOV).toArray().length, 'y reclamarla sin verificar no da nada');
  ok((await al('premium-prueba', {})).por === 'cuenta', 'sin cuenta: entrar con Discord');
  e = await al('premium-prueba', { quien: ROL });
  ok(!e.puede && e.por === 'ya_premium', 'quien ya tiene el Premium de la temporada no la necesita');
  e = await al('premium-prueba', { quien: ROLC });
  ok(!e.puede && e.por === 'ya_tuviste', 'quien lo tuvo esta temporada y se le cerró, tampoco (no se le pisa su rango)');
  ok((await al('premium-prueba', { quien: A.DUENO })).por === 'ya_premium', 'el dueño ya lo tiene todo');
  e = await al('premium-prueba', { quien: V });
  ok(e.puede && e.dias === 14, 'verificado y sin usar: puede, 14 días');

  // ── 2. reclamarla ─────────────────────────────────────────────────────────────────────────────────────────────────
  e = await al('premium-prueba', { quien: V, si: true });
  const pr = o.pasePremium(V, 'prueba');
  const FIN = AHORA + 14 * DIA;
  ok(e.ok && !e.puede && e.por === 'usada' && e.activa, 'reclamada: ok, y ya figura como usada y activa', JSON.stringify(e));
  ok(pr && pr[0] === AHORA && pr[1] === AHORA + 14 * DIA, 'es un rango de 14 días en `pase_premium`', JSON.stringify(pr));
  const b1 = bandeja(V, 'prueba-premium');
  ok(b1 && b1.titulo === '🎁 Tienes 14 días de Pase Premium' && /pase\/premium$/.test(b1.url), 'el aviso a la campana', JSON.stringify(b1));
  ok(o.premiumSigue(V, 'prueba') && GR.premiumObjeto(o, V, AHORA), 'activa: Premium para el Pase y para los grabados');
  ok(o.titulosDe(V).includes('Prueba VIP') && o.reaccionesDe(V).includes('🔥'), 'activa: los títulos y las reacciones de la fila premium');
  let P = o.paseDe(V);
  ok(P.premium && P.premium.hasta === null && P.premium.prueba === AHORA + 14 * DIA && P.prueba.por === 'usada',
    'la página la ve como Premium (`hasta: null`) y sabe cuándo termina', JSON.stringify(P.premium));
  ok(o.valesDe(V).premium === false, 'con la prueba, un vale de campeón NO se guarda: se puede usar');
  // una Tarea durante la prueba: vale +20 %
  sql.exec("INSERT INTO pase_hecho (quien, temp, sem, tarea, t) VALUES (?, 'prueba', 'd:2026-11-29', 'entrar', ?)", V, AHORA + DIA);
  o.pxpOlvidar();
  o.premiarPase(V);
  const cobradoP = sql.exec("SELECT COUNT(*) AS n FROM tienda WHERE quien = ? AND id LIKE 'pase:prueba:%:p%'", V).toArray()[0].n;
  ok(cobradoP >= 1, 'cobró la fila premium de los niveles que ya tenía');

  // ── 3. una sola vez ───────────────────────────────────────────────────────────────────────────────────────────────
  const [x1, x2] = await Promise.all([al('premium-prueba', { quien: V2, si: true }), al('premium-prueba', { quien: V2, si: true })]);
  ok([x1, x2].filter((x) => x.ok).length === 1 && [x1, x2].some((x) => x.error === 'usada'), 'dos clics a la vez: una sola prueba',
    JSON.stringify([x1, x2]));
  e = await al('premium-prueba', { quien: V, si: true });
  ok(e.error === 'usada' && o.pasePremium(V, 'prueba')[1] === AHORA + 14 * DIA, 'otra vez: «usada», y el rango no se mueve');

  // ── 4. el aviso del día antes ─────────────────────────────────────────────────────────────────────────────────────
  ok(PRG.revisar(o, AHORA) === 0 && !bandeja(V, 'prueba-premium-fin'), 'recién reclamada no se avisa nada');
  AHORA += 13 * DIA + 2 * H;                               // faltan 22 h
  ok(PRG.revisar(o, AHORA) >= 1 && /termina mañana/.test((bandeja(V, 'prueba-premium-fin') || {}).titulo || ''), 'a menos de un día: «termina mañana»');
  ok(PRG.revisar(o, AHORA) === 0, 'y una sola vez');

  // ── 5. vencida ────────────────────────────────────────────────────────────────────────────────────────────────────
  AHORA += 23 * H;                                         // pasó el final
  P = o.paseDe(V);
  ok(!o.premiumSigue(V, 'prueba') && !GR.premiumObjeto(o, V, AHORA), 'vencida: ni el Pase ni los grabados');
  ok(GR.acceso({ tipo: 'evento', quien: V, premium: GR.premiumObjeto(o, V, AHORA), ev: { partes: 1, hasta_v: AHORA + DIA } }).no === 'premium',
    'el evento grabado entero vuelve a pedir Premium');
  ok(!o.titulosDe(V).includes('Prueba VIP') && !o.reaccionesDe(V).includes('🔥'), 'vencida: sin los títulos ni las reacciones premium');
  ok(P.premium && P.premium.hasta === FIN && !P.premium.prueba, 'la página ya no la ve como Premium (`hasta` con fecha)', JSON.stringify(P.premium));
  ok(P.prueba.por === 'usada' && !P.prueba.activa, 'y dice que la prueba ya se usó');
  ok(o.paseColorPoner({ quien: V, color: (A.PASE_COLORES || ['#F5C542'])[0] }).error === 'premium', 'el color premium ya no se elige');
  ok(sql.exec("SELECT COUNT(*) AS n FROM tienda WHERE quien = ? AND id LIKE 'pase:prueba:%:p%'", V).toArray()[0].n === cobradoP,
    'lo cobrado de la fila premium se queda (y no se cobra más)');
  ok(o.paseXP(V, o.paseDatos().cfg) === 150 + 150 + Math.round(150 * 1.2), 'la XP de más ganada durante la prueba no se pierde', String(o.paseXP(V, o.paseDatos().cfg)));
  ok((await al('premium-prueba', { quien: V })).por === 'usada', 'vencida: no se puede reclamar de nuevo');

  // ── 6. el Premium de temporada no se toca ─────────────────────────────────────────────────────────────────────────
  ok(o.premiumSigue(ROL, 'prueba') && o.premiumSigue(ROLC, 'prueba'), 'el rol y el rol que se fue: como hasta hoy');
  ciclo([ROL, V2]);
  ok(o.pasePremium(V2, 'prueba')[1] === null, 'quien en la prueba recibe el rol: queda Premium de temporada (sin vencimiento)');

  // ── 7. mudarCuenta y olvidarme ────────────────────────────────────────────────────────────────────────────────────
  await al('premium-prueba', { quien: VIEJO, si: true });
  const m = await o.mudarCuenta({ viejo: VIEJO, nuevo: NUEVA });
  ok(m && !(m.fallas || []).includes('premium_prueba'), 'mudarCuenta pasa la prueba', JSON.stringify(m && m.fallas));
  ok((await al('premium-prueba', { quien: NUEVA })).por === 'usada' && !sql.exec('SELECT 1 FROM premium_prueba WHERE quien = ?', VIEJO).toArray().length,
    'la cuenta nueva ya la usó (una por persona, también después de mudarse)');
  await o.olvidar({ quien: NUEVA });
  ok(!sql.exec('SELECT 1 FROM premium_prueba WHERE quien = ?', NUEVA).toArray().length, '«olvidarme» la borra');

  // ── 8. el evento de nuevos ────────────────────────────────────────────────────────────────────────────────────────
  sql.exec("INSERT OR REPLACE INTO idk (id, k, t) VALUES (?, 'kn1', 1), (?, 'krol', 1), (?, 'kn3', 1)", N1, ROL, N3);
  await al('premium-prueba', { quien: N3, si: true });       // N3 está en su prueba
  let r = ciclo([ROL], { nuevos_prem: [{ q: N1, ll: '700' }, { q: ROL, ll: '700' }, { q: N3, ll: '700' }, { q: 'raro', ll: '700' }] });
  ok(r.ok && r.nuevos_prem === 3, 'el ciclo trae a los que jugaron: tres de verdad (lo raro afuera)', JSON.stringify(r));
  const vale = (q) => sql.exec('SELECT * FROM premium_vale WHERE origen = ?', 'nuevos:prueba:' + q).toArray()[0];
  ok(vale(N1) && vale(N1).usado_por === N1 && o.pasePremium(N1, 'prueba')[1] === null, 'el que jugó: la temporada entera, con el vale como usado');
  ok(/primer evento/.test((bandeja(N1, 'nuevos-prem:prueba') || {}).titulo || ''), 'y el aviso «🐣 Jugaste tu primer evento…»');
  ok(vale(ROL) && !vale(ROL).usado_temp && /Inventario/.test((bandeja(ROL, 'nuevos-prem:prueba') || {}).cuerpo || ''),
    'quien ya era Premium de temporada: el vale queda en su Inventario (como el recibidor)');
  ok(vale(N3) && vale(N3).usado_por === N3 && o.pasePremium(N3, 'prueba')[1] === null, 'quien estaba en la prueba: pasa a la temporada entera');
  ciclo([ROL], { nuevos_prem: [{ q: N1, ll: '701' }] });
  ok(sql.exec("SELECT COUNT(*) AS n FROM premium_vale WHERE origen LIKE 'nuevos:%'").toArray()[0].n === 3, 'jugar otro: no da otro (una vez por temporada)');
  // N2 tiene la prueba vencida y juega: la temporada se le abre
  await al('premium-prueba', { quien: N2, si: true });
  AHORA += 15 * DIA;
  ok(!o.premiumSigue(N2, 'prueba'), 'N2: la prueba venció');
  ciclo([ROL], { nuevos_prem: [{ q: N2, ll: '702' }] });
  ok(o.premiumSigue(N2, 'prueba') && o.pasePremium(N2, 'prueba')[1] === null, 'y al jugar un evento de nuevos vuelve a ser Premium, toda la temporada');
}

Date.now = relojReal;
console.log(fallas ? '\n  🔴 los regalos del Premium: ' + fallas + ' mal, ' + bien + ' bien\n' : '\n  ✅ los regalos del Premium: ' + bien + ' bien\n');
process.exit(fallas ? 1 : 0);
