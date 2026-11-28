// 📬✅ La prueba del paso 9 del plan del sábado (28/11/2026): conectar la página y DRA. Sin Discord, sin Cloudflare y sin
// red, sobre el objeto de verdad (SQLite de Node):
//   · el buzón en hilos privados (bot/buzon.js): lee la MISMA bandeja que la campana, junta todo en un hilo, uno por
//     persona cada 24 h, se borra a las 48 h, «No me avises más» (en el hilo y en la página), «Ya lo vi» marca visto
//     también en la página, lo visto en la página no sale, lo que salió no vuelve, sólo Miembros, el tope por ronda, el
//     horario, los drops sin abrir una vez por semana, «olvidarme» y mudar la cuenta; y el mensaje entra en Discord;
//   · los botones del hilo por el Worker (`botonWorker()`), con un Discord de mentira: nunca abre un DM;
//   · verificarse en la página: el portón de KV con los roles de bot/verificar_dc.js encima (bot/verificar_web.js).
//
//     node bot/conectar_dra_prueba.mjs
import * as BZ from './buzon.js';
import * as VW from './verificar_web.js';
import * as VD from './verificar_dc.js';
import * as V from './vista.js';

let fallas = 0, bien = 0;
const ok = (c, t, extra) => {
  if (c) bien += 1;
  else { fallas += 1; console.log('  🔴 ' + t + (extra !== undefined ? '\n     ' + extra : '')); }
};
const H = 3600000, DIA = 24 * H;

// ── 1. verificarse en la página: una sola tabla de roles ────────────────────────────────────────────────────────────
const portonKV = { guild: VD.GUILD_DRA, rol: VD.ROL_MIEMBRO, invitado: VD.ROL_INVITADO, revisa: ['123456789012345678'],
  paises: Object.fromEntries(VD.PAISES.map((p) => [p[3], p[0]]).concat([[VD.ROL_BRASIL, 'br']])) };
ok(VW.diferencias(portonKV).length === 0, 'el portón de KV de hoy y la tabla del panel dicen lo mismo', VW.diferencias(portonKV).join(' · '));
const viejo = Object.assign({}, portonKV, { rol: '1', invitado: '2', paises: { [VD.PAISES[0][3]]: VD.PAISES[0][0] } });
const P = VW.porton(viejo);
ok(P.rol === VD.ROL_MIEMBRO && P.invitado === VD.ROL_INVITADO, 'si el portón de KV se queda viejo, el Miembro y el Invitado son los de verificar_dc.js');
ok(Object.keys(P.paises).length === 1 && P.revisa[0] === '123456789012345678', 'los países y a quién revisa un admin quedan del portón');
ok(Object.keys(VW.porton({ guild: VD.GUILD_DRA }).paises).length === VD.PAISES.length, 'un portón sin países usa los 21 del menú');
ok(VW.porton(null) === null && VW.porton({ guild: '1', rol: '9' }).rol === '9', 'sin portón no se inventa uno; otro servidor, no se toca');
ok(viejo.rol === '1', 'y no cambia el objeto de KV que le pasaron');
// 🔗 y el portón que arma el ciclo (`bot/subir_datos.py`: verificados.py, servidores.json y pais_por_rol.py) dice lo mismo
// que la tabla del panel: si alguno de los dos se mueve solo, rojo
try {
  const { execFileSync } = await import('node:child_process');
  const py = process.platform === 'win32' ? 'python' : 'python3';
  const cod = 'import sys,json,os;sys.path[:0]=["bot","sheet"];import verificados as V,pais_por_rol as PR;' +
    's=json.load(open(os.path.join("datos","servidores.json"),encoding="utf-8"));' +
    'print(json.dumps({"guild":V.GUILD_DRA,"rol":V.ROL_MIEMBRO,"paises":PR.ROLES,' +
    '"invitado":((s.get("canales") or {}).get("DRA") or {}).get("rol_invitado","")}))';
  const real = JSON.parse(execFileSync(py, ['-c', cod], { encoding: 'utf-8', env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' }) }));
  ok(VW.diferencias(real).length === 0, 'el portón del ciclo (verificados.py, servidores.json, pais_por_rol.py) = la tabla del panel',
    VW.diferencias(real).join(' · '));
} catch (e) {
  ok(false, 'no pude leer el portón del ciclo con Python', String(e).slice(0, 200));
}

// ── 2. el mensaje del hilo ──────────────────────────────────────────────────────────────────────────────────────────
const Q = '111111111111111111';
const muchos = Array.from({ length: 9 }, (_, i) => ({ clave: 'k' + i, tipo: i % 2 ? 'personal' : 'drops', titulo: '🃏 Aviso ' + i,
  cuerpo: 'x'.repeat(240), url: i % 2 ? '/freestyle-rap/tarjetas' : '', t: i }));
const m = BZ.mensajeHilo(Q, muchos);
const md = V.medir(m);
ok(!md.problemas.length, 'el mensaje entra en Discord (V2, botones, letras)', md.problemas.join(' · '));
ok(JSON.stringify(m.allowed_mentions) === JSON.stringify({ users: [Q] }), 'sólo le suena a esa persona');
ok(V.textoV2(m).includes('<@' + Q + '>') && V.textoV2(m).includes('3 avisos más'), 'la menciona, y lo que no entra queda «en la campana»');
const links = V.piezas(m, 2).filter((b) => b.style === 5);
ok(links.every((b) => /^https:\/\//.test(b.url)) && links.length <= 5 && new Set(links.map((b) => b.url)).size === links.length,
  'los links: absolutos, sin repetir, hasta 5 (con «Próximos eventos»)');
ok(V.piezas(m, 2).some((b) => b.custom_id === 'bzn:visto') && V.piezas(m, 2).some((b) => b.custom_id === 'bzn:no'), '«Ya lo vi» y «No me avises más»');
ok(!/[0-9]{15}/.test(BZ.nombreHilo()), 'el nombre del hilo no lleva ningún ID');

// ── 3. el objeto de verdad ──────────────────────────────────────────────────────────────────────────────────────────
let DatabaseSync = null;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { DatabaseSync = null; }
if (!DatabaseSync) {
  console.log('  ⓘ sin node:sqlite (Node ' + process.version + '): el objeto no se prueba');
} else {
  const relojReal = Date.now;
  let AHORA = Date.UTC(2026, 10, 28, 18, 0);    // 1 PM ET
  Date.now = () => AHORA;
  const A = await import('./avisos.js');
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
  const ID = (x) => '22222222222222222' + x;
  const NO_MIEMBRO = '333333333333333333';
  o.guardar('pase_v', 'p1');
  o.guardar('pase', { miembros: [ID(1), ID(2), ID(3), ID(4), ID(5)] });
  o._pase = null;
  // encendido sólo en la prueba: `ronda()` toma `encendido` por parámetro; por la ruta, con la constante (apagada)
  const R = (op = {}) => BZ.ronda(o, AHORA, Object.assign({ encendido: true, solo: [], prueba: false }, op));
  // a la próxima 1 PM del este (las rondas abren de 12 a 22 ET)
  const aLaTarde = () => { AHORA += H; while (BZ.horaET(AHORA) !== 13) AHORA += H; };
  const marcar = (r) => BZ.hecho(o, { abiertos: r.abrir.map((x, i) => ({ rid: x.rid, hilo: '70000000000000000' + i + String(AHORA).slice(-3) })) }, AHORA);

  ok(BZ.ENCENDIDO === false, 'para todos, el buzón sigue APAGADO (espera el OK de Dlx)');
  ok(BZ.DLX === A.DUENO && BZ.PRUEBA.solo.join() === A.DUENO, 'la prueba de hoy es sólo con Dlx (el mismo `DUENO` de avisos.js)');
  const fin = BZ.PRUEBA.hasta;
  ok(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(fin))
    === '11/28/26, 11:59:59 PM', 'y termina sola a las 11:59 PM ET del 28/11');
  ok(BZ.estado(fin - 1000).encendido && BZ.estado(fin - 1000).prueba && !BZ.estado(fin + 1000).encendido && !BZ.estado(fin + 1000).solo.length,
    'antes, prendido sólo para Dlx; un segundo después, apagado sin desplegar nada');
  let r = BZ.ronda(o, fin + 1000);
  ok(r.encendido === false && !r.abrir.length, 'terminada la prueba, la ronda no hace nada');

  // avisos de la campana: dos para ID1 (van juntos), uno de un tipo que no va, uno de un no Miembro, uno ya visto
  o.aBandeja(ID(1), 'yo:1', 'personal', '🃏 Desbloqueaste tu tarjeta Servidor', 'Pídela con /card.', '/freestyle-rap/tarjetas', '', AHORA - H);
  o.aBandeja(ID(1), 'libre:9', 'libre', '⚔️ Te retaron a una batalla libre', '', '/freestyle-rap/', '', AHORA - 2 * H);
  o.aBandeja(ID(1), 'ap:3', 'aplauso', '👏 3 te felicitaron', '', '/freestyle-rap/publicaciones', '', AHORA - H);
  o.aBandeja(NO_MIEMBRO, 'yo:2', 'personal', '🃏 Desbloqueaste tu tarjeta', '', '', '', AHORA - H);
  o.aBandeja(ID(2), 'yo:3', 'personal', '📈 Subiste a rango A', '', '', '', AHORA - H);
  sql.exec('UPDATE bandeja SET visto = 1 WHERE quien = ?', ID(2));
  o.aBandeja(ID(3), 'yo:viejo', 'personal', '📈 Viejo', '', '', '', AHORA - 3 * DIA);

  r = R({ simular: true });
  ok(r.abrir.length === 1 && r.abrir[0].quien === ID(1), 'simular: sólo ID1 (el otro no es Miembro, el de ID2 ya lo vio en la página, el de ID3 tiene más de 48 h)',
    JSON.stringify(r.abrir.map((x) => x.quien)));
  ok(!sql.exec('SELECT 1 FROM buzon_hilo').toArray().length, 'y simular no anota nada');
  r = R();
  ok(r.abrir.length === 1 && r.abrir[0].n === 2, 'los dos avisos de ID1 van JUNTOS en un hilo (el aplauso no va)', JSON.stringify(r.abrir));
  ok(V.textoV2(r.abrir[0].msg).includes('Te retaron') && V.textoV2(r.abrir[0].msg).includes('Desbloqueaste'), 'el mensaje los trae a los dos');
  ok(R().espera === true, 'otra ronda en la misma hora: espera');
  marcar(r);
  const hilo1 = sql.exec('SELECT hilo FROM buzon_hilo WHERE quien = ?', ID(1)).toArray()[0].hilo;
  ok(/^\d{15,}$/.test(hilo1), 'el ciclo confirma el hilo');

  // un aviso nuevo para ID1 dentro de las 24 h: espera; a las 24 h, otro hilo SÓLO con lo nuevo
  AHORA += 2 * H;
  o.aBandeja(ID(1), 'yo:4', 'personal', '📈 Subiste a rango B', '', '', '', AHORA);
  // la campana vuelve a marcar como NUEVO un aviso que ya salió (la misma clave, un paso nuevo): sale otra vez
  o.aBandeja(ID(1), 'libre:9', 'libre', '⚔️ Falta que digas quién ganó', '', '/freestyle-rap/', '', AHORA);
  const sinCambio = sql.exec("SELECT t FROM bandeja WHERE quien = ? AND clave = 'yo:1'", ID(1)).toArray()[0].t;
  r = R();
  ok(!r.abrir.length, 'dentro de las 24 h, no se abre otro hilo para la misma persona');
  AHORA += 22 * H + 60000;
  r = R();
  const t2 = r.abrir[0] && V.textoV2(r.abrir[0].msg);
  ok(r.abrir.length === 1 && r.abrir[0].n === 2 && t2.includes('rango B') && t2.includes('Falta que digas') && !t2.includes('Desbloqueaste'),
    'a las 24 h, un hilo nuevo con lo que esperaba (lo nuevo y lo que la campana volvió a marcar nuevo), sin repetir lo que no cambió',
    JSON.stringify(r.abrir.map((x) => x.n)) + ' ' + sinCambio);
  marcar(r);

  // «Ya lo vi» en el hilo: visto también en la página
  r = await al('buzon', { fase: 'boton', accion: 'visto', quien: ID(1), hilo: hilo1 });
  const vistas = sql.exec("SELECT clave, visto FROM bandeja WHERE quien = ? AND clave IN ('yo:1','libre:9')", ID(1)).toArray();
  ok(r.ok && r.n === 2 && vistas.every((x) => x.visto === 1), '«Ya lo vi» en el hilo los marca vistos en la campana de la página');
  ok((await al('buzon', { fase: 'boton', accion: 'visto', quien: ID(2), hilo: hilo1 })).error === 'ajeno', 'el hilo de otro: no');
  ok((await al('buzon', { fase: 'boton', accion: 'visto', quien: ID(1), hilo: '999999999999999999' })).error === 'vencido', 'un hilo que no está: vencido');

  // a las 48 h, se borra
  AHORA += 25 * H;
  r = R();
  ok(r.borrar.length === 1 && r.borrar[0].hilo === hilo1, 'a las 48 h, el primer hilo va para borrar (el segundo todavía no)');
  BZ.hecho(o, { borrados: r.borrar.map((x) => x.rid) }, AHORA);
  ok(!R({ forzar: true }).borrar.length, 'y una vez borrado no se pide otra vez');

  // «No me avises más»: en el hilo y desde la página
  o.aBandeja(ID(4), 'yo:5', 'personal', '🏅 Ya tienes rango: C', '', '', '', AHORA);
  r = await al('buzon', { fase: 'boton', accion: 'no', quien: ID(1), hilo: hilo1 });
  ok(r.ok && r.buzon.si === false, '«No me avises más» en el hilo: apagado');
  o.aBandeja(ID(1), 'yo:6', 'personal', '📉 Ahora eres rango C', '', '', '', AHORA);
  AHORA += H;
  r = R();
  ok(!r.abrir.some((x) => x.quien === ID(1)) && r.abrir.some((x) => x.quien === ID(4)), 'quien lo apagó no recibe hilos; los demás sí');
  marcar(r);
  let p = await al('bandeja', { quien: ID(1), buzon: true });
  ok(p.ok && p.buzon.si === true && p.buzon.encendido === false, 'desde la página se vuelve a prender (y la página sabe que para él todavía no arrancó)');
  ok(BZ.pagina(o, A.DUENO, null, BZ.PRUEBA.hasta - 1000).buzon.encendido === true, 'durante la prueba, para Dlx la página dice que ya anda');
  p = await al('bandeja', { quien: ID(5), buzon: false });
  ok(p.buzon.si === false && (await al('bandeja', { quien: ID(5), buzon: null })).buzon.si === false, 'y se apaga desde la página');
  const band = await al('bandeja', { quien: ID(1) });
  ok(band.ok && Array.isArray(band.items) && !('buzon' in band), 'la bandeja de siempre no cambia');

  // el fallido se suelta y vuelve
  AHORA += DIA + H;
  o.aBandeja(ID(3), 'yo:7', 'personal', '🃏 Desbloqueaste tu tarjeta Temporada', '', '', '', AHORA);
  r = R();
  const de3 = r.abrir.find((x) => x.quien === ID(3));
  ok(de3, 'ID3 tiene un aviso: va');
  BZ.hecho(o, { fallidos: [de3.rid] }, AHORA);
  AHORA += H;
  r = R();
  ok(r.abrir.some((x) => x.quien === ID(3)), 'si Discord no lo dejó salir, vuelve en la ronda siguiente (no cuenta como su hilo del día)');
  marcar(r);

  // el tope por ronda y el horario
  const muchosIds = Array.from({ length: BZ.TOPE_RONDA + 5 }, (_, i) => '4444444444444' + String(10000 + i));
  o.guardar('pase', { miembros: muchosIds });
  o.guardar('pase_v', 'p2');
  o._pase = null;
  aLaTarde();
  for (const q of muchosIds) o.aBandeja(q, 'yo:x', 'personal', '🃏 Tarjeta', '', '', '', AHORA - H);
  r = R();
  ok(r.abrir.length === BZ.TOPE_RONDA, 'a lo sumo ' + BZ.TOPE_RONDA + ' hilos nuevos por ronda, para todos');
  marcar(r);
  AHORA += H;
  ok(R().abrir.length === 5, 'y los demás, en la ronda siguiente');
  let noche = AHORA + 2 * H;
  while (BZ.horaET(noche) !== 1) noche += H;   // 1 AM ET
  ok(BZ.ronda(o, noche, { encendido: true, solo: [] }).fuera_de_hora === true, 'de noche no se abren hilos');

  // sólo las cuentas de prueba
  AHORA += DIA - 3 * H;
  aLaTarde();
  for (const q of muchosIds) o.aBandeja(q, 'yo:y', 'personal', '🃏 Otra', '', '', '', AHORA - H);
  r = R({ solo: [muchosIds[0]] });
  ok(r.abrir.length === 1 && r.abrir[0].quien === muchosIds[0], 'con `SOLO`, sólo esas cuentas (la prueba antes de abrirlo)');

  // sin la lista de miembros, nadie
  o.guardar('pase', { miembros: [] });
  o.guardar('pase_v', 'p3');
  o._pase = null;
  AHORA += 2 * H;
  ok(R().sin_miembros === true, 'sin la lista de miembros del Pase, no se le escribe a nadie');

  // 🐉 los drops sin abrir: una vez por semana, a la bandeja (y de ahí a los dos lados)
  o.guardar('pase', { miembros: [ID(6)] });
  o.guardar('pase_v', 'p4');
  o._pase = null;
  const ID6 = ID(6);
  sql.exec('INSERT INTO drops (quien, origen, t) VALUES (?, ?, ?)', ID6, 'ev:1', AHORA - 2 * DIA);
  sql.exec('INSERT INTO drops (quien, origen, t) VALUES (?, ?, ?)', ID6, 'ev:2', AHORA - 2 * DIA);
  aLaTarde();
  r = R();
  const dr = sql.exec("SELECT titulo, tipo FROM bandeja WHERE quien = ? AND clave LIKE 'bz-drops:%'", ID6).toArray();
  ok(dr.length === 1 && dr[0].titulo.includes('2 Dragón Drops') && dr[0].tipo === 'drops', 'los drops sin abrir entran a la campana (una vez)');
  ok(r.abrir.length === 1 && V.piezas(r.abrir[0].msg, 2).some((b) => b.url === BZ.URL_DROPS), 'y salen en el hilo con «Abrir tus drops»');
  marcar(r);
  AHORA += 2 * H;
  BZ.recordarDrops(o, AHORA, new Set([ID6]), []);
  ok(sql.exec("SELECT COUNT(*) AS n FROM bandeja WHERE quien = ? AND clave LIKE 'bz-drops:%'", ID6).toArray()[0].n === 1, 'en la misma semana, no se repite');

  // «olvidarme» y mudar la cuenta
  const N1 = '555555555555555551', N2 = '555555555555555552';
  BZ.pagina(o, ID(4), false, AHORA);
  BZ.mudar(o, ID(4), N1);
  ok(sql.exec('SELECT COUNT(*) AS n FROM buzon_no WHERE quien = ?', N1).toArray()[0].n === 1 &&
     sql.exec('SELECT COUNT(*) AS n FROM buzon_hilo WHERE quien = ?', ID(4)).toArray()[0].n === 0 &&
     sql.exec('SELECT COUNT(*) AS n FROM buzon_enviado WHERE quien = ?', ID(4)).toArray()[0].n === 0, 'mudar la cuenta: lo de la vieja pasa a la nueva');
  await al('mudar-cuenta', { viejo: N1, nuevo: N2 });
  ok(sql.exec('SELECT COUNT(*) AS n FROM buzon_no WHERE quien = ?', N2).toArray()[0].n === 1, 'y por `mudarCuenta()` del objeto, también');
  const vivosAntes = sql.exec("SELECT COUNT(*) AS n FROM buzon_hilo WHERE quien = ? AND borrado = 0 AND hilo != ''", N2).toArray()[0].n;
  BZ.olvidar(o, N2);
  ok(['buzon_no', 'buzon_enviado'].every((t) => !sql.exec(`SELECT 1 FROM ${t} WHERE quien = ?`, N2).toArray().length) &&
     !sql.exec('SELECT 1 FROM buzon_hilo WHERE quien = ?', N2).toArray().length, '«olvidarme»: no queda nada con su ID');
  ok(vivosAntes === 0 || R({ forzar: true }).borrar.length >= vivosAntes, 'y sus hilos vivos se borran de Discord en la ronda siguiente');
  // 🧪 la simulación de hoy: un aviso de cada clase, sólo a Dlx, y que se pueda limpiar
  const D = A.DUENO;
  const tPrueba = BZ.PRUEBA.hasta - 5 * H;   // 6:59 PM ET del 28/11
  AHORA = tPrueba;                           // el reloj del objeto, en la tarde de la prueba
  o.guardar('pase', { miembros: [D] });
  o.guardar('pase_v', 'p5');
  o._pase = null;
  ok(BZ.simular(o, { quien: ID(1) }, tPrueba).error === 'solo_prueba', 'simular a otra cuenta que no es la de la prueba: no');
  ok(BZ.simular(o, {}, BZ.PRUEBA.hasta + 1000).error === 'apagado', 'terminada la prueba, simular no deja avisos sueltos en la campana');
  const sim = await al('buzon', { fase: 'simular' });
  ok(sim.ok && sim.n === BZ.SIMULACION.length && sim.quien === D, 'por la ruta: los ' + BZ.SIMULACION.length + ' avisos simulados, en la campana de Dlx');
  const clases = new Set(BZ.SIMULACION.map((x) => x[1]));
  ok(Object.keys(BZ.TIPOS).every((t) => clases.has(t)), 'hay uno de CADA clase que el buzón lleva a Discord', Object.keys(BZ.TIPOS).filter((t) => !clases.has(t)).join());
  const campana = await al('bandeja', { quien: D });
  ok(campana.items.filter((x) => x.clave.startsWith('sim:')).length === BZ.SIMULACION.length && campana.nuevas >= BZ.SIMULACION.length,
    'y se ven en la campana de la página como nuevos, igual que los de verdad');
  const rs = BZ.ronda(o, tPrueba, { forzar: true });
  ok(rs.prueba && rs.abrir.length === 1 && rs.abrir[0].quien === D && rs.abrir[0].rid.startsWith('sim:'),
    'la ronda de la prueba (sin horario): UN hilo para Dlx, marcado como simulado');
  ok(rs.abrir[0].n === BZ.SIMULACION.length && V.textoV2(rs.abrir[0].msg).includes((BZ.SIMULACION.length - BZ.ITEMS_MAX) + ' avisos más'),
    'todos juntos: el hilo muestra ' + BZ.ITEMS_MAX + ' y el resto queda en la campana (la regla de juntar)');
  for (const m2 of [rs.abrir[0].msg]) ok(!V.medir(m2).problemas.length, 'y el mensaje entra en Discord', V.medir(m2).problemas.join());
  BZ.hecho(o, { abiertos: [{ rid: rs.abrir[0].rid, hilo: '880000000000000001' }] }, tPrueba);
  // otra tanda antes de las 24 h: espera, y lo dice
  BZ.simular(o, { tanda: 2 }, tPrueba + H);
  const r24 = BZ.ronda(o, tPrueba + H, { forzar: true });
  ok(!r24.abrir.length && r24.en24.length === 1 && r24.en24[0].libre === tPrueba + BZ.PERSONA_MS, 'una tanda más en menos de 24 h: espera, y dice desde cuándo');
  ok((await al('buzon', { fase: 'boton', accion: 'visto', quien: D, hilo: '880000000000000001' })).n === BZ.SIMULACION.length,
    '«Ya lo vi» en el hilo simulado: los marca vistos en la página');
  ok((await al('buzon', { fase: 'boton', accion: 'no', quien: D, hilo: '880000000000000001' })).buzon.si === false, '«No me avises más» también se prueba');
  const li = await al('buzon', { fase: 'limpiar' });
  ok(li.ok && li.borrar.length === 1 && li.borrar[0].hilo === '880000000000000001', '--limpiar-simulacion: devuelve el hilo para borrarlo de Discord');
  ok(!sql.exec("SELECT 1 FROM bandeja WHERE clave LIKE 'sim:%'").toArray().length &&
     !sql.exec("SELECT 1 FROM buzon_hilo WHERE rid LIKE 'sim:%'").toArray().length &&
     !sql.exec('SELECT 1 FROM buzon_no WHERE quien = ?', D).toArray().length, 'y no queda nada simulado (ni el «No me avises más» de la prueba)');
  const rt = BZ.simular(o, { tanda: 2 }, tPrueba + 2 * H);
  const r3 = BZ.ronda(o, tPrueba + 2 * H, { forzar: true });
  ok(rt.n === BZ.SIM_TANDA && r3.abrir.length === 1 && r3.abrir[0].n === BZ.SIM_TANDA && !V.textoV2(r3.abrir[0].msg).includes('avisos más'),
    'limpio, otra tanda de ' + BZ.SIM_TANDA + ' sale ya, entera en el hilo');
  BZ.limpiarSimulacion(o, {}, tPrueba + 2 * H);
  Date.now = relojReal;

  // ── 4. los botones por el Worker, con un Discord de mentira ────────────────────────────────────────────────────────
  const pedidos = [];
  const fetchReal = globalThis.fetch;
  globalThis.fetch = async (u, op) => { pedidos.push([String(u), op && op.method]); return new Response('{}', { status: 200 }); };
  const env = { AVISOS: { idFromName: () => 'x', get: () => ({ fetch: (u, op) => o.fetch(new Request(u, op)) }) } };
  const espera = [];
  const ctx = { waitUntil: (p) => espera.push(p) };
  const i = { application_id: 'app', token: 'tok', channel_id: hilo1, member: { user: { id: ID(1) } }, data: { custom_id: 'bzn:si' } };
  const resp = BZ.botonWorker(i, env, ctx);
  await Promise.all(espera);
  ok((await resp.json()).type === 6, 'el botón contesta «ya va» enseguida (Discord corta a los 3 s)');
  ok(pedidos.length === 1 && pedidos[0][0].endsWith('/webhooks/app/tok') && pedidos[0][1] === 'POST', 'y la respuesta sale aparte, sólo para quien tocó');
  ok(!pedidos.some(([u]) => u.includes('users/@me')), 'nunca abre un DM');
  globalThis.fetch = fetchReal;
}

console.log(`\n  conectar_dra_prueba: ${bien} bien${fallas ? `, 🔴 ${fallas} mal` : ''}\n`);
process.exit(fallas ? 1 : 0);
