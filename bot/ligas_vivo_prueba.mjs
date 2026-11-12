// 🏟️ El lector de las batallas de liga en vivo: los mismos casos que el `--auto` de bot/ligas.py, y sus estados.
//     node bot/ligas_vivo_prueba.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
await import('./paginas/llave_vivo.js');
const V = await import('./ligas_vivo.js');

let fallas = 0;
const ok = (c, t) => { console.log((c ? '   ✅ ' : '   🔴 ') + t); if (!c) fallas++; };

const { casos } = JSON.parse(readFileSync(join(AQUI, 'ligas_vivo_casos.json'), 'utf8'));
for (const c of casos) {
  const bats = [];
  c.msgs.forEach((content, i) => V.leerMensajes(c.fam, [{ id: String(i + 1), t: '2026-11-04T00:0' + (i % 10) + ':00Z', content }], bats));
  // lo provisorio se decide al final, como en Python (`resolverU()`)
  bats.forEach((b) => V.resolverU(b, Date.parse('2026-11-05T00:00:00Z')));
  const res = bats.filter((b) => !b.df).map((b) => [b.a, b.b, b.gana, b.como]);
  ok(JSON.stringify(res) === JSON.stringify(c.res), c.n + (JSON.stringify(res) === JSON.stringify(c.res) ? '' : ' → ' + JSON.stringify(res)));
}

// el mismo título otra vez no es otra batalla, y una cerrada no se reabre
const b2 = [];
V.leerMensajes('U', [{ id: '1', t: '2026-11-04T00:00:00Z', content: '# ANA VS BETO' }, { id: '2', t: '2026-11-04T00:01:00Z', content: 'ANA GANA DIRECTO' },
  { id: '3', t: '2026-11-04T00:02:00Z', content: '# ANA VS BETO' }], b2);
ok(b2.length === 1 && b2[0].gana === 'ANA', 'el mismo título, otra vez, no es otra batalla');
const nv = V.leerMensajes('U', [{ id: '4', t: '2026-11-04T05:00:00Z', content: '# ANA VS BETO' }], b2);
ok(nv.length === 1 && b2.length === 2, 'horas después sí es otra: una revancha');

// 🔴 «por N puntos» espera: si en esos minutos llega la réplica, no vale
const b3 = [];
V.leerMensajes('U', [{ id: '1', t: '2026-11-04T00:00:00Z', content: '# ANA VS BETO' }, { id: '2', t: '2026-11-04T00:15:00Z', content: 'ANA Por 3 Puntos' }], b3);
ok(!b3[0].gana, 'por 3 puntos, recién leído, no cierra');
V.resolverU(b3[0], Date.parse('2026-11-04T00:20:00Z'));
ok(!b3[0].gana, 'a los 5 minutos, tampoco');
V.leerMensajes('U', [{ id: '3', t: '2026-11-04T00:21:00Z', content: '# REPLICA' }], b3);
V.resolverU(b3[0], Date.parse('2026-11-04T00:40:00Z'));
ok(!b3[0].gana && b3[0].rep, 'y si llega la réplica, ya no vale');
const b4 = [];
V.leerMensajes('U', [{ id: '1', t: '2026-11-04T00:00:00Z', content: '# ANA VS BETO' }, { id: '2', t: '2026-11-04T00:15:00Z', content: 'ANA Por 3 Puntos' }], b4);
V.resolverU(b4[0], Date.parse('2026-11-04T00:26:00Z'));
ok(b4[0].gana === 'ANA' && b4[0].como === 'directa', 'a los 10 minutos sin réplica, cierra');
const b5 = [];
V.leerMensajes('U', [{ id: '1', t: '2026-11-04T00:00:00Z', content: '# ANA VS BETO' }, { id: '2', t: '2026-11-04T00:15:00Z', content: 'BETO GANA DIRECTO' }], b5);
ok(b5[0].gana === 'BETO', '«GANA DIRECTO» cierra en el momento');

ok(V.titulosDe('# BLOODY 🇨🇴 <:vs:1> VARGAS 🇨🇴\ntexto').length === 1 && !V.titulosDe('# IMAGENES: 8x8').length && !V.titulosDe('').length,
  'en Visuales sólo cuenta el título con los dos; las imágenes y las temáticas, no');

// 🚦 los estados
const T = 1_000_000_000;
const M = 60_000;
const t = (estado, ini, ult, se, ahora) => V.transicion({ estado, ini, ult }, Object.assign({ titulo: false, beat: false, voz: 0, conocidos: 0 }, se), ahora).estado;
ok(t('candidata', T, T, { titulo: true }, T + M) === 'arranca', 'candidata + título en Veredictos: arranca');
ok(t('candidata', T, T, { voz: 2, conocidos: 2 }, T + M) === 'arranca', 'candidata + los dos en la llamada: arranca');
ok(t('candidata', T, T, { beat: true }, T + M) === 'arranca', 'candidata + un beat: arranca');
ok(t('candidata', T, T, { conocidos: 2 }, T + 10 * M) === 'candidata', 'candidata sin señal: no se muestra');
ok(t('candidata', T, T, { conocidos: 2 }, T + 46 * M) === 'olvidar', 'candidata a los 45 minutos: se olvida');
ok(t('arranca', T, T, { beat: true }, T + M) === 'juego', 'arranca + un beat: en juego');
ok(t('juego', T, T, { conocidos: 2 }, T + 5 * M) === 'juego', 'cinco minutos sin señal: sigue en juego');
ok(t('juego', T, T, { conocidos: 2 }, T + 13 * M) === 'espera', 'doce sin señal y los dos fuera de la llamada: falta el resultado');
ok(t('juego', T, T, { conocidos: 0 }, T + 13 * M) === 'espera', 'sin saber quiénes son, doce sin beats: falta el resultado');
ok(t('juego', T, T, { voz: 1, conocidos: 2 }, T + 40 * M) === 'juego', 'uno de los dos en la llamada: en juego, aunque no suene nada');
ok(t('espera', T, T, { beat: true }, T + 20 * M) === 'juego', 'la réplica: de esperar vuelve a jugarse');
ok(t('espera', T, T, { conocidos: 2 }, T + 61 * M) === 'sinres', 'una hora esperando: sin resultado, que lo lea el ciclo');
ok(t('juego', T, T + 170 * M, { conocidos: 2 }, T + 181 * M) === 'sinres', 'a las tres horas se deja de seguir');

// 🗒️ lo que se dice y lo que se muestra
const tx = V.textoArranca('FMH Tricolor', 5, '**Bloody 🇨🇴** vs **Vargas 🇨🇴**', ['🔥 **EL CLÁSICO**']);
ok(tx.startsWith('🔴 **FMH Tricolor** · Jornada 5\n⚔️ **Bloody 🇨🇴** vs **Vargas 🇨🇴** · está arrancando\n🔥'), 'el mensaje al arrancar');
const tf = V.textoFinal(tx, 'Bloody', 'directa');
ok(tf.startsWith('🏁 **FMH Tricolor**') && !tf.includes('está arrancando') && tf.endsWith('🏆 Ganó **Bloody**, directo') && tf.includes('EL CLÁSICO'), 'el mismo mensaje, al terminar');
ok(V.textoFinal(tx, 'Vargas', 'replica').endsWith('en la réplica') && V.textoSinResultado(tx, 'https://x/y').includes('<https://x/y>'), 'en réplica, y sin un cierre que se pueda leer');
const F = (estado, ini, d) => ({ liga: 'fmh-x', estado, ini, d: Object.assign({ n: 'FMH X', sv: 'URBF', a: 'A', b: 'B' }, d) });
const pg = V.paraPagina([F('candidata', 5), F('vieja', 5), F('sinres', 5), F('terminada', 9, { fin: 1000, gana: 'A', como: 'directa', na: 'Ana' }), F('terminada', 8, { fin: 1000 - 21 * M }), F('juego', 7, { ida: '123' }), F('espera', 8)], 1000);
ok(pg.length === 3 && pg[0].e === 'espera' && pg[1].e === 'juego' && pg[2].gana === 'Ana' && !JSON.stringify(pg).includes('123'),
  'la página: ni las candidatas ni las viejas, lo que se juega primero, lo terminado 20 minutos, y sin IDs de nadie');

// 🎬 LA NOCHE DE BLOODY vs VARGAS, SOBRE EL OBJETO DE VERDAD: SQLite de Node y un Discord falso
let DatabaseSync = null;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { DatabaseSync = null; }
if (!DatabaseSync) {
  console.log('  ⓘ sin node:sqlite (Node ' + process.version + '): el vigía no se prueba sobre el objeto');
} else {
  const A = await import('./avisos.js');
  const db = new DatabaseSync(':memory:');
  const sql = {
    exec(q, ...ps) {
      const t0 = String(q).trim();
      if (!ps.length && /;\s*\S/.test(t0)) { db.exec(t0); return { toArray: () => [] }; }
      const st = db.prepare(t0);
      if (/^\s*(SELECT|WITH|PRAGMA)/i.test(t0)) { const rows = st.all(...ps); return { toArray: () => rows }; }
      st.run(...ps);
      return { toArray: () => [] };
    },
  };
  const G = '111', VER = '201', VIS = '202', BEAT = '203', VOZ = '204', CHAT = '555000000000000001', GK = '222', VERK = '301';
  const BL = '700000000000000001', VA = '700000000000000002';
  const kv = new Map([
    ['ligas:vigia', JSON.stringify({ lista: [
      { id: 'fmh-tricolor', n: 'FMH Tricolor', sv: 'URBF', g: G, fam: 'U', ver: VER, vis: VIS, beat: BEAT, voz: VOZ },
      { id: 'lkr-fms-tricolor', n: 'FMS Tricolor LKR', sv: 'LKR', g: GK, fam: 'K', ver: VERK, vis: '', beat: '', voz: '' }] })],
    // 🔴 en «Con datos», el nivel de verdad de Urban: en «Normal» no se arma el título, y así esta prueba no vio que reventaba
    ['cfg:' + G, JSON.stringify({ vivo: CHAT, vivo_nivel: 'datos' })],
    ['web:lobby', JSON.stringify({ tabla: [{ n: 'Bloody', k: 'bloody', ovr: 90, sc: 60, rg: 'A', cc: 'co' }, { n: 'Vargas', k: 'vargas', ovr: 70, sc: 40, rg: 'B', cc: 'co' }] })],
    ['turnos:nombres', JSON.stringify({ bloody: BL, vargas: VA })],
  ]);
  const o = new A.Avisos({ storage: { sql, setAlarm() {}, getAlarm() { return null; } }, blockConcurrencyWhile: async (f) => f() },
    { DISCORD_TOKEN: 'x', KV: { get: async (k) => kv.get(k) ?? null } });
  await new Promise((r) => setTimeout(r, 5));
  o.indiceNombres = async () => ({ bloody: BL, vargas: VA });
  const canales = { [VER]: [], [VIS]: [], [BEAT]: [], [VOZ]: [], [VERK]: [] };
  let nid = 1000n;
  const T0 = Date.parse('2026-11-04T23:48:00Z');
  const pub = (c, content, min) => { nid += 1n; canales[c].push({ id: String(nid), timestamp: new Date(T0 + min * M).toISOString(), content }); };
  const enVoz = new Set();
  const mandados = [];
  const editados = [];
  const antesF = globalThis.fetch;
  globalThis.fetch = async (u0, op = {}) => {
    const u = String(u0);
    const js = (x, status = 200) => new Response(JSON.stringify(x), { status });
    let mm;
    if ((mm = /\/guilds\/(\d+)\/channels$/.exec(u))) {
      return js(Object.keys(canales).map((id) => ({ id, last_message_id: canales[id].length ? canales[id][canales[id].length - 1].id : '1' })));
    }
    if ((mm = /\/voice-states\/(\d+)$/.exec(u))) return enVoz.has(mm[1]) ? js({ channel_id: VOZ }) : js({ code: 10065 }, 404);
    if ((mm = /\/channels\/(\d+)\/messages\?limit=\d+&after=(\d+)$/.exec(u))) {
      return js(canales[mm[1]].filter((m) => BigInt(m.id) > BigInt(mm[2])).reverse().slice(0, 30));
    }
    if (op.method === 'PATCH') { editados.push(JSON.parse(op.body)); return js({ id: 'x' }); }
    if (op.method === 'POST') { const b = JSON.parse(op.body); mandados.push(b); return js({ id: '9' + mandados.length }); }
    return js({}, 404);
  };
  const vuelta = (min) => o.ligasVuelta(T0 + min * M);
  const estadoDe = () => sql.exec('SELECT estado, datos FROM liga_vivo ORDER BY ini').toArray().map((f) => f.estado);

  await vuelta(-5);
  ok(!estadoDe().length && !mandados.length, 'la primera vuelta sólo anota dónde está cada canal: lo de antes ya pasó');

  // 6:48 PM: el mismo título en Visuales y Veredictos
  pub(VIS, '# <:FMH:1> BLOODY 🇨🇴 <:vs:2> VARGAS 🇨🇴 <:FMH:1>', 0);
  pub(VER, '# <:FMH:1> BLOODY 🇨🇴 <:vs:2> VARGAS 🇨🇴 <:FMH:1>', 0);
  await vuelta(0);
  ok(estadoDe().join() === 'arranca' && mandados.length === 1 && /🔴 \*\*FMH Tricolor\*\*/.test(mandados[0].content) && /está arrancando/.test(mandados[0].content)
    && JSON.stringify(mandados[0].allowed_mentions) === '{"parse":[]}', 'el título en los dos canales es UNA batalla: arranca, y sale una vez en el chat sin mencionar a nadie', );
  ok(!(o.leer('ligas_vivo').errores || []).length && !o.leer('ligas_vivo').ult_error, 'sin errores: ' + JSON.stringify(o.leer('ligas_vivo').errores));
  ok(sql.exec('SELECT COUNT(*) AS n FROM vs_cola').toArray()[0].n === 1 && (mandados[0].components || []).length >= 2, 'en «Con datos» lleva el VS y sus botones');
  const vsL = JSON.parse(sql.exec('SELECT datos FROM vs_cola').toArray()[0].datos);
  ok(vsL.liga && vsL.liga.id === 'fmh-tricolor' && vsL.liga.n === 'FMH Tricolor' && vsL.a.k === 'bloody',
    'el VS llega a la cola marcado como de liga, con la clave de cada uno: así se dibuja como afiche con sus cartas de liga');
  await vuelta(1);
  ok(mandados.length === 1, 'y no se repite');
  ok(o.ligasAhora(T0 + M)[0].txt === 'Está arrancando' && !JSON.stringify(o.ligasAhora(T0 + M)).includes(BL), 'la página lo ve, sin IDs de nadie');

  // 6:49 las imágenes en Visuales: no son otra batalla. 6:50 el primer beat
  pub(VIS, '# <:FMH:1> IMAGENES: 8x8 <:FMH:1>', 1);
  pub(BEAT, 'm!p https://open.spotify.com/x', 2);
  await vuelta(2);
  ok(estadoDe().join() === 'juego', 'un beat: se está jugando, y las imágenes no son otra batalla');

  // 7:05 el veredicto, y sigue sonando: «por 3 puntos» espera
  pub(VER, '**BLOODY 🇨🇴 : 36**\nVARGAS 🇨🇴: 33\n# BLOODY 🇨🇴 Por 3 Puntos Brother', 17);
  pub(BEAT, 'm!s', 17);
  await vuelta(17);
  ok(estadoDe().join() === 'juego' && !editados.length, '«Por 3 Puntos» todavía no cierra: puede venir la réplica');
  pub(VER, '# <:FMH:1> PTB TOTAL X3 <:FMH:1>\n**BLOODY 🇨🇴 : 108**\nVARGAS 🇨🇴: 99', 19);
  await vuelta(19);
  await vuelta(30);
  ok(estadoDe().join() === 'terminada' && editados.length === 1 && /🏁 \*\*FMH Tricolor/.test(editados[0].content) && /🏆 Ganó \*\*Bloody\*\*, directo/.test(editados[0].content),
    'a los 10 minutos sin réplica cierra, EDITANDO el mismo mensaje: ' + (editados[0] || {}).content);
  const pg1 = o.ligasAhora(T0 + 30 * M)[0];
  ok(pg1.e === 'terminada' && pg1.gana === 'Bloody', 'la página: terminó, con su ganador');
  ok(!o.ligasAhora(T0 + 60 * M).length, 'y a los 20 minutos se va de «ahora»');

  // una candidata: sólo Visuales. Con los dos en la llamada, arranca. Sin nada, se olvida
  pub(VIS, '# ANA VS BETO', 40);
  await vuelta(40);
  ok(estadoDe().includes('candidata') && mandados.length === 1, 'sólo el título en Visuales: candidata, y no se dice nada');
  await vuelta(86);
  ok(!estadoDe().includes('candidata'), 'a los 45 minutos sin señal se olvida');
  pub(VIS, '# BLOODY VS VARGAS', 300);
  await vuelta(300);
  enVoz.add(BL);
  await vuelta(301);
  ok(mandados.length === 2 && estadoDe().includes('arranca'), 'con uno de los dos en la llamada: arranca, y sale');
  enVoz.clear();
  await vuelta(314);
  ok(estadoDe().includes('espera'), 'doce minutos sin señal y los dos fuera de la llamada: falta el resultado');
  ok(o.ligasAhora(T0 + 314 * M)[0].txt === 'Falta el resultado', 'y la página lo dice');
  await vuelta(375);
  ok(estadoDe().includes('sinres') && editados.some((e) => /El resultado sale en la página/.test(e.content)), 'una hora sin resultado: lo dice en el mismo mensaje y lo deja al ciclo');

  // LKR: el título sale casi con el cierre. En «normal» no habla
  const nMand = mandados.length;
  pub(VERK, '# MAKMA vs MATTHIAS', 400);
  await vuelta(400);
  ok(estadoDe().includes('definiendo') && mandados.length === nMand, 'LKR: título, y no se anuncia nada');
  pub(VERK, '# MAKMA :28\n\n# MATTHIAS: 25', 402);
  pub(VERK, '# MAKMA +3PTO', 402);
  await vuelta(403);
  ok(estadoDe().filter((x) => x === 'terminada').length === 2 && mandados.length === nMand, 'LKR: cierra, y sin canal del bot en vivo no dice nada');

  globalThis.fetch = antesF;
}

if (fallas) { console.log('\n🔴 ' + fallas + ' fallas'); process.exit(1); }
console.log('\n✅ el lector de las ligas en vivo');
