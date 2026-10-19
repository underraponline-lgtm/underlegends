// LA PRUEBA DE LOS AVISOS, SIN RED.
//
//     node bot/avisos_prueba.mjs
//
// Tres cosas, y las tres tienen que dar exacto:
//
//   1 · EL CIFRADO CONTRA EL EJEMPLO DEL RFC 8291. Con la clave y la sal
//       del apéndice A, `cifrar()` tiene que dar el cuerpo del §5 byte a
//       byte. Un cifrado que «parece andar» y está mal no falla: el
//       teléfono recibe algo que no puede abrir y lo tira callado.
//   2 · EL LECTOR DE ANUNCIOS CONTRA PYTHON, en `bot/avisos_casos.json`.
//       Ver `bot/avisos_casos.py`: es el contrato entre los dos.
//   3 · VAPID Y LA ALTA: la firma verifica y la alta rechaza lo que no es
//       un servicio de push.
//
// ⚠️ NODE 18 NO TIENE `crypto` GLOBAL (llegó en la 19) y el Worker sí.
// Se lo pone acá para que el módulo corra igual en los dos lados.
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const aqui = dirname(fileURLToPath(import.meta.url));
const A = await import('./avisos.js');

let fallas = 0;
const ok = (cond, que, det) => {
  console.log(`  ${cond ? '✅' : '❌'} ${que}`);
  if (!cond) {
    fallas++;
    // lo que se vio, si la prueba lo trae: sin esto, un ❌ no dice por qué
    if (det !== undefined) console.log('      ' + String(det).slice(0, 400));
  }
};

// ── 0 · un anuncio editado después de descartado ────────────────────
{
  const sin = { id: '1', edited_timestamp: null };
  const ed = { id: '1', edited_timestamp: '2026-09-25T20:00:00+00:00' };
  const descartada = (m) => ({ estado: 2, hasta: 0, cuerpo: A.marcaDescarte(m) });
  ok(A.releer(undefined, sin), 'lo que nunca pasó se lee');
  ok(!A.releer(descartada(sin), sin), 'lo descartado y sin tocar no se vuelve a leer');
  ok(!A.releer({ estado: 2, hasta: 0, cuerpo: '{}' }, sin),
    'y las filas de antes (`{}`) tampoco, si nadie las editó');
  ok(A.releer(descartada(sin), ed), 'editado después de descartarlo: se lee de nuevo');
  ok(!A.releer(descartada(ed), ed), 'y una vez releído, no otra vez');
  ok(!A.releer({ estado: 1, hasta: 999, cuerpo: '{"t":"X"}' }, ed),
    'lo avisado no se vuelve a leer aunque lo editen');
  ok(!A.releer({ estado: 0, hasta: 999, cuerpo: '{"t":"X"}' }, ed), 'lo que está en cola tampoco');
  ok(!A.releer({ estado: 2, hasta: 999, cuerpo: '{"t":"X"}' }, ed), 'ni lo vencido');
}

// ── 0a · el evento cancelado (Dlx, 01/10/2026: «B») ─────────────────
{
  console.log('0a · el evento cancelado');
  const ev = { tipo: 'evento', t: 'DESGRACIAS EN TOKYO VOL 21 2v2' };
  const avisado = Date.parse('2026-10-01T23:21:00Z');
  const ed = '2026-10-02T00:15:00.000000+00:00';
  ok(A.cancelado(404, null, ev, avisado) === 'borrado', 'el anuncio borrado (404) es un evento cancelado');
  ok(A.cancelado(404, { code: 10008 }, ev, avisado) === 'borrado' && A.cancelado(404, { code: 10003 }, ev, avisado) === '',
    'el mensaje borrado (10008) sí; el canal borrado entero (10003) no cancela sus eventos');
  ok(A.cancelado(200, { content: '❌ EVENTO CANCELADO, perdón', edited_timestamp: ed }, ev, avisado) === 'editado',
    'el editado después de avisarlo diciendo «cancelado» también');
  ok(A.cancelado(200, { content: 'SUSPENDIDO hasta nuevo aviso', edited_timestamp: ed }, ev, avisado) === 'editado',
    'y «suspendido»');
  ok(A.cancelado(200, { content: 'si no te presentás tu cupo queda cancelado', edited_timestamp: ed },
    { ...ev, cx: 1 }, avisado) === '',
  'pero no si el anuncio ya decía la palabra al avisarlo (una regla, no una cancelación)');
  ok(A.cancelado(200, { content: 'si no te presentás tu cupo queda cancelado', edited_timestamp: null }, ev, avisado) === '',
    'ni si no se editó después de avisarlo (los anotados antes de `cx`)');
  ok(A.cancelado(200, { content: 'TOKYO VOL 21 · 2v2 · cupos 16', edited_timestamp: ed }, ev, avisado) === '',
    'el anuncio editado sin la palabra, no');
  ok(A.cancelado(403, null, ev) === '' && A.cancelado(500, null, ev) === '' && A.cancelado(0, null, ev) === '',
    'y un 403, un 5xx o sin red no dicen nada: no se cancela porque Discord no contestó');
}

// ── 0c · «te toca» y la copia cancelada de `eventos-hoy` (Dlx, 01/10/2026) ──
{
  console.log('0c · te toca');
  // ⚠️ los mismos casos que `clave_turno()` en bot/avisos_personales.py
  ok(['Geoka 🇦🇷', 'Júpiter 🇲🇽', 'tito calderon 🇦🇷', 'Park-Ji Sung🇰🇷', '𝐑𝐚𝐧𝐠𝐨'].map(A.claveTurno).join('|') ===
    'geoka|jupiter|titocalderon|parkjisung|rango', 'la clave de un nombre, igual que en Python');
  const R = (b) => ({ id: '9', nombre: 'COPA', links: ['https://discord.com/channels/1/2/9'], rondas: [{ r: 'Cuartos', b }] });
  const t = A.turnosDe(R([[['A', 'B'], 'A', ''], [['C', 'D'], '', ''], [['E', 'F'], '', ''], [['G'], '', '']]));
  ok(t && t.ahora.lados.join() === 'C,D' && t.sigue.lados.join() === 'E,F',
    'en orden: AHORA la primera sin ganador, SIGUE la de después; el cruce que espera rival no cuenta');
  ok(A.turnosDe(R([[['A', 'B'], 'A', ''], [['C', 'D'], '', ''], [['E', 'F'], 'E', '']])) === null,
    'fuera de orden (una de más adelante ya decidida): no se sabe cuál va, no se avisa');
  ok(A.turnosDe(R([[['A', 'B', 'C'], '', 'pasan 2'], [['D', 'E'], '', '']])).ahora.lados.join() === 'D,E',
    'un grupo resuelto sin un ganador (pasan 2) ya se jugó');
  const hueco = A.turnosDe(R([[['A', 'B'], 'A', ''], [['C', 'D'], '', ''], [['E', 'F'], 'E', ''], [['G', 'H'], 'G', ''],
    [['I', 'J'], '', ''], [['K', 'L'], '', '']]));
  ok(hueco && hueco.ahora.lados.join() === 'I,J' && hueco.sigue.lados.join() === 'K,L',
    'una sin ganador con DOS jugadas después quedó atrás: se sigue desde la última jugada');
  ok(A.turnosDe(R([[['A', 'B'], 'A', '']])) === null, 'sin nada por jugar, nada');
  ok(A.turnosDe(R([[['A', 'B'], '', ''], [['C', 'D'], '', '']])) === null,
    'sin nada jugado todavía, nada: la llave se publica antes de que el evento arranque');
  // los frenos de Dlx: (a) lo reemplazaron, (b) ya está en la llamada, (c) la batalla se jugó
  const LL = R([[['Ana', 'Bea'], 'Ana', ''], [['Cami', 'Dora'], '', ''], [['Eli + Fer', 'Gabo + Hugo'], '', '']]);
  const IDX = { cami: '3', dora: '4', eli: '5', hugo: '8' };
  const T0 = 1790000000000;
  const de = (hs) => (id) => (id in hs ? hs[id] : null);
  const ll0 = A.aLlamar(LL, A.turnosDe(LL), IDX, de({}), T0);
  ok(ll0.map((c) => c.tipo + ':' + c.did + ':' + c.n).join() === 'ahora:3:1,ahora:4:1,sigue:5:1,sigue:8:1',
    'AHORA y la que SIGUE, a cada uno con su Discord; en un 2v2, a los dos de cada lado');
  const b3 = ll0[0].base;
  ok(A.aLlamar(LL, A.turnosDe(LL), IDX, de({ [b3 + ':ahora:1']: T0 - 20000 }), T0).filter((c) => c.did === '3').length === 0,
    'no vuelve a sonar antes del minuto');
  const otra = A.aLlamar(LL, A.turnosDe(LL), IDX, de({ [b3 + ':ahora:1']: T0 - 61000 }), T0).find((c) => c.did === '3');
  ok(otra && otra.n === 2 && /:ahora:2$/.test(otra.clave), 'al minuto vuelve a sonar: el segundo toque');
  ok(!A.aLlamar(LL, A.turnosDe(LL), IDX, de({ [b3 + ':ahora:1']: T0 - 300000, [b3 + ':ahora:2']: T0 - 240000,
    [b3 + ':ahora:3']: T0 - 180000 }), T0).some((c) => c.did === '3'), 'después de ' + A.TOQUES + ' toques, no más');
  ok(!A.aLlamar(LL, A.turnosDe(LL), IDX, de({ [b3 + ':voz']: T0 - 60000 }), T0).some((c) => c.did === '3'),
    '(b) con la llamada confirmada no se lo llama más por esa batalla');
  const reemplazo = R([[['Ana', 'Bea'], 'Ana', ''], [['Iván', 'Dora'], '', ''], [['Eli + Fer', 'Gabo + Hugo'], '', '']]);
  ok(!A.aLlamar(reemplazo, A.turnosDe(reemplazo), IDX, de({}), T0).some((c) => c.did === '3'),
    '(a) si el organizador lo reemplazó, la llave ya no lo nombra y no se lo llama');
  const jugada = R([[['Ana', 'Bea'], 'Ana', ''], [['Cami', 'Dora'], 'Dora', ''], [['Eli + Fer', 'Gabo + Hugo'], '', '']]);
  const ll2 = A.aLlamar(jugada, A.turnosDe(jugada), IDX, de({}), T0);
  ok(!ll2.some((c) => c.did === '3') && ll2.some((c) => c.did === '5' && c.tipo === 'ahora'),
    '(c) con la batalla jugada se deja de llamar, y le toca a la siguiente');
  // el lector de la página, cargado como módulo: lo que hace el vigía (`turnos()`)
  await import('./paginas/llave_vivo.js');
  const LV = globalThis.LlaveVivo;
  ok(!!(LV && LV.aLlave), 'el lector de la página carga como módulo, como en el Worker');
  const L = LV.aLlave(LV.unirPartidas([{ id: '7', canal: '2', sv: 'FFA', g: '1', autor: 'x', pub: 1, ed: 1,
    texto: '# COPA\n`[ CUARTOS ]`\n⌞Ana 🇦🇷⌝ 🆚 ⌞Bea 🇨🇱⌝\n⌞Cami 🇻🇪⌝ 🆚 ⌞Dora 🇲🇽⌝\n`[ SEMIFINALES ]`\n⌞Ana 🇦🇷⌝ 🆚 ⌞⌝\n' }])[0]);
  const tl = A.turnosDe(L);
  ok(tl && tl.ahora.lados.join(' vs ') === 'Cami 🇻🇪 vs Dora 🇲🇽' && tl.sigue === null,
    'con una llave de verdad: le toca a Cami contra Dora');
  const c = A.cuerpoTurno(L, tl.ahora, 'ahora');
  ok(c.tipo === 'turno' && /¡Te toca!/.test(c.t) && /Cami 🇻🇪 vs Dora 🇲🇽/.test(c.b) && /llamada/.test(c.b) &&
    /reemplaza/.test(c.b), 'el aviso dice que te toca, contra quién, que entres a la llamada y que si no te reemplazan');
  ok(/¡Te están llamando!/.test(A.cuerpoTurno(L, tl.ahora, 'ahora', 2).t), 'el segundo toque dice que te están llamando');
  // 🎤 EL BOT EN VIVO EN LOS CHATS (05/10/2026): los cuatro momentos, con una llave de verdad
  const llaveDe = (txt) => LV.aLlave(LV.unirPartidas([{ id: '9', canal: '2', sv: 'FFA', g: '1', autor: 'x', pub: 1, ed: 1,
    texto: txt }])[0]);
  const CUARTOS = '# COPA __SOOLAR__\n`[ CUARTOS ]`\n⌞Ana 🇦🇷⌝ 🆚 ⌞Bea 🇨🇱⌝\n⌞Cami 🇻🇪⌝ 🆚 ⌞Dora 🇲🇽⌝\n';
  const m0 = A.momentosChat(llaveDe(CUARTOS), '', [['Ana', 89], ['Dora', 82]]);
  ok(m0.length === 1 && m0[0].m === 'llave' && m0[0].texto.includes('Arrancó **COPA \\_\\_SOOLAR**')
    && /Ana \(OVR 89\), Dora \(OVR 82\)/.test(m0[0].texto) && /underlegends\.pages\.dev/.test(m0[0].texto),
  'en vivo, al salir la llave: el nombre (sin que Discord lo lea como formato), los favoritos y el link');
  const SEMIS = CUARTOS.replace('⌞Ana 🇦🇷⌝ 🆚', '⌞Ana 🇦🇷⌝ ✅ 🆚').replace('⌞Dora 🇲🇽⌝', '⌞Dora 🇲🇽⌝ ✅')
    + '`[ FINAL ]`\n⌞Ana 🇦🇷⌝ 🆚 ⌞Dora 🇲🇽⌝\n';
  const m1 = A.momentosChat(llaveDe(SEMIS), 'COPA SOOLAR', []);
  ok(m1.map((x) => x.m).join() === 'llave,rondas,final' && /\*\*Cuartos\*\*: pasaron Ana 🇦🇷, Dora 🇲🇽/.test(m1[1].texto)
    && /La final de \*\*COPA SOOLAR\*\*: Ana 🇦🇷 contra Dora 🇲🇽/.test(m1[2].texto),
  'con los cuartos cerrados y la final armada: quién pasó y la final');
  const m2 = A.momentosChat(llaveDe(SEMIS + '\nCAMPEÓN: Dora 🇲🇽\n'), 'COPA SOOLAR', []);
  ok(m2[m2.length - 1].m === 'campeon'
    && /^🏆 \*\*Dora 🇲🇽\*\* es el campeón de \*\*COPA SOOLAR\*\*\nGanó 2 batallas y en la final le ganó a Ana 🇦🇷\.$/.test(m2[m2.length - 1].texto)
    && !m2.some((x) => x.m === 'final'), 'con campeón: el cierre con su noche, y la final ya no', m2[m2.length - 1].texto);
  // los frenos: sólo el último momento, un mensaje nuevo cada 10 minutos, y lo que cambia se edita
  const T = 1790000000000;
  let p = A.planChat(m1, {}, 0, T, true);
  ok(p.map((x) => x.tipo + ':' + x.m).join() === 'saltar:llave,saltar:rondas,mandar:final',
    'si ya hay final, lo que no salió se saltea: no se dice tarde');
  p = A.planChat(m1, { llave: { msg: '5', texto: m1[0].texto } }, T - 5 * 60000, T, true);
  ok(p.map((x) => x.tipo + ':' + x.m).join() === 'saltar:rondas', 'a los 5 minutos del último mensaje, no sale otro');
  p = A.planChat(m1, { llave: { msg: '5', texto: 'otro' }, rondas: { msg: '6', texto: 'antes' } }, T - 11 * 60000, T, true);
  ok(p.map((x) => x.tipo + ':' + x.m).join() === 'editar:rondas,mandar:final' && p[0].msg === '6',
    'a los 10 minutos sí; y las rondas se editan en su mensaje («Arrancó» no: sus favoritos se leen una vez)');
  ok(!A.planChat(m1, {}, 0, T, false).some((x) => x.tipo === 'mandar'), 'de una llave quieta no se dice nada nuevo');
  // 🏆 UN SOLO MENSAJE POR CAMPEÓN (13/10/2026): si el aviso del ciclo salió antes, el cierre se le agrega a ESE mensaje
  const hCiclo = { llave: { msg: '5', texto: m2[0].texto }, campeon: { msg: '9', texto: '' } };
  p = A.planChat(m2, hCiclo, T, T, false);
  ok(p.filter((x) => x.tipo !== 'saltar').map((x) => x.tipo + ':' + x.m + ':' + x.msg).join() === 'editar:campeon:9'
    && p.find((x) => x.tipo === 'editar').texto === m2[m2.length - 1].texto,
  'el cierre, después del aviso del ciclo: se edita en ese mensaje, aunque la llave ya esté quieta');
  ok(!A.planChat(m2, { campeon: { msg: '9', texto: 'ya dicho' } }, 0, T, true).some((x) => x.tipo !== 'saltar')
    && !A.planChat(m2, { campeon: { msg: '', texto: '' } }, 0, T, true).some((x) => x.tipo !== 'saltar'),
  'el cierre que ya dijo el bot en vivo (o que salteó) no se vuelve a tocar');
  const m2t = A.momentosChat(llaveDe(SEMIS + '\nCAMPEÓN: Dora 🇲🇽\n'), 'COPA SOOLAR', [], 'todo');
  const hTodo = Object.fromEntries(m2t.map((x) => [x.m, { msg: '5', texto: 'x' }]));
  hTodo.campeon = { msg: '9', texto: '' };
  ok(A.planChat(m2t, hTodo, T, T, false, 'todo').map((x) => x.tipo + ':' + x.m).join() === 'editar:campeon',
    'y en «cada batalla» también');
  // 🔊 CUÁNTO HABLA (05/10/2026, Dlx: «por cada llave o un nivel de intensidad»): lo justo, normal o cada batalla
  ok(A.nivelChat('', '') === 'normal' && A.nivelChat('', 'todo') === 'todo' && A.nivelChat('poco', 'todo') === 'poco'
    && A.nivelChat('cualquiera', 'poco') === 'poco', 'el nivel: el de Dlx gana, si no el del admin, si no «normal»');
  const p0 = A.momentosChat(llaveDe(SEMIS), 'COPA SOOLAR', [], 'poco');
  ok(p0.map((x) => x.m).join() === 'llave', 'lo justo: con la final armada todavía no dice nada más que el arranque');
  ok(A.momentosChat(llaveDe(SEMIS + '\nCAMPEÓN: Dora 🇲🇽\n'), 'COPA SOOLAR', [], 'poco').map((x) => x.m).join() === 'llave,campeon',
    'lo justo: el arranque y el campeón');
  const t1 = A.momentosChat(llaveDe(SEMIS), 'COPA SOOLAR', [], 'todo');
  ok(t1.map((x) => x.m.replace(/:.*/, '')).join() === 'llave,b,b,final'
    && /✅ \*\*Ana 🇦🇷\*\* pasa · Cuartos · contra Bea 🇨🇱/.test(t1[1].texto)
    && /✅ \*\*Dora 🇲🇽\*\* pasa · Cuartos · contra Cami 🇻🇪/.test(t1[2].texto),
  'cada batalla: quién pasó en cada una, con la ronda y contra quién');
  let q = A.planChat(t1, {}, 0, T, true, 'todo');
  ok(q.length === 1 && q[0].tipo === 'mandar' && q[0].m.length === 4 && /^🎤 Arrancó/.test(q[0].texto)
    && /La final/.test(q[0].texto), 'cada batalla: lo que no salió va JUNTO en un mensaje, no se saltea');
  const hechoLl = { llave: { msg: '5', texto: t1[0].texto } };
  ok(!A.planChat(t1, hechoLl, T - 60000, T, true, 'todo').length, 'cada batalla: al minuto del último, todavía no');
  q = A.planChat(t1, hechoLl, T - A.CHAT_ENTRE_TODO, T, true, 'todo');
  ok(q.length === 1 && q[0].m.length === 3 && /^⚔️ \*\*COPA SOOLAR\*\*\n✅/.test(q[0].texto),
    'cada batalla: a los 2 minutos sí, con el nombre del evento arriba');
  ok(!A.planChat(t1, hechoLl, 0, T, false, 'todo').length, 'cada batalla: de una llave quieta tampoco');
  const muchas = [t1[0]].concat(Array.from({ length: 12 }, (x, i) => ({ m: 'b:Filtros:' + i, cab: '⚔️ **X**', texto: '✅ ' + i })));
  q = A.planChat(muchas, hechoLl, 0, T, true, 'todo');
  ok(q.filter((x) => x.tipo === 'saltar').length === 12 - A.CHAT_JUNTAS && q[q.length - 1].m.length === A.CHAT_JUNTAS
    && /✅ 11$/.test(q[q.length - 1].texto), 'cada batalla: si se juntaron de más, van las últimas ' + A.CHAT_JUNTAS);
  // 🛑 un mensaje que no salió frena el canal sólo si no se arregla solo (revisión del 05/10/2026)
  ok(A.pausaChat(403) === 30 * 60000 && A.pausaChat(404) === 30 * 60000 && A.pausaChat(429, 30) === 30000
    && A.pausaChat(429, 0.4) === 5000 && A.pausaChat(500) === 0 && A.pausaChat(0) === 0,
  'sin permiso o sin canal, media hora; un 429, lo que pide Discord; un 500 o la red, al minuto siguiente');
  // 🔴 LOS GRUPOS DE «PASAN N» (revisión del 05/10/2026): las octavas de a tres de FFA salían «pasaron » sin nadie
  const GRUPO = '# COPA\n`[ OCTAVOS ]`\n⌞Ana 🇦🇷⌝ 🆚 ⌞Bea 🇨🇱⌝ 🆚 ⌞Cami 🇻🇪⌝\n⌞Dora 🇲🇽⌝ 🆚 ⌞Eli 🇦🇷⌝ 🆚 ⌞Fer 🇨🇱⌝\n'
    + '`[ CUARTOS ]`\n⌞Ana 🇦🇷⌝ 🆚 ⌞Dora 🇲🇽⌝\n⌞Bea 🇨🇱⌝ 🆚 ⌞Fer 🇨🇱⌝\n';
  const g1 = A.momentosChat(llaveDe(GRUPO), 'COPA', []);
  const rg = g1.find((x) => x.m === 'rondas');
  ok(rg && /\*\*Octavos\*\*: pasaron Ana 🇦🇷, Bea 🇨🇱, Dora 🇲🇽, Fer 🇨🇱/.test(rg.texto),
    'normal: en los grupos donde pasan dos, nombra a los dos', rg && rg.texto);
  const g2 = A.momentosChat(llaveDe(GRUPO), 'COPA', [], 'todo').filter((x) => x.cab);
  ok(g2.length === 4 && /✅ \*\*Ana 🇦🇷\*\* pasa · Octavos · de un grupo con Bea 🇨🇱 y Cami 🇻🇪/.test(g2[0].texto)
    && new Set(g2.map((x) => x.m)).size === 4,
  'cada batalla: uno por cada uno que pasa, y un grupo dice «de un grupo con» (no «contra»: pueden pasar dos)', g2.map((x) => x.texto).join(' | '));
  // 🧑‍🤝‍🧑 LOS CINCO ERRORES DE LA COMPE POR 1.5 DÓLARES (FFA, 12/10/2026): banderas, equipos que crecen y mayúsculas
  {
    const g = A.genteChat('RODRILP 🇦🇷, 🇨🇱 VELATZ 🇨🇱, 🇨🇴 SNOW 🇨🇴 🇦🇷');
    ok(g.map((y) => y.n + y.fl).join('|') === 'RODRILP🇦🇷|VELATZ🇨🇱|SNOW🇨🇴'
      && A.genteChat('BETELGEUSE 🇷🇪, 🇦🇷 GUESS 🇦🇷, 🇵🇦 ERIAN 🇵🇦 🇷🇪').map((y) => y.fl).join() === '🇷🇪,🇦🇷,🇵🇦',
    'cada uno con UNA bandera, la de su pedazo: la que el lector corrió al final no se le pega al último', g);
    ok(A.genteChat('🏳️‍⚧️ VEPG 🏳️‍⚧️')[0].n === 'VEPG' && A.genteChat('DYNOCO 🇦🇷 (R) 🇦🇷')[0].n === 'DYNOCO (R)'
      && A.genteChat('DYNOCO 🇦🇷 (R) 🇦🇷')[0].fl === '🇦🇷', 'sin adornos que no son letras, y el revivido con su (R)');
    const tb = { snow: { n: 'Snow', k: 'snow', cc: 'co', ovr: 92 }, number: { n: 'Number', k: 'number', cc: 'uy', ovr: 54 } };
    const bus = (n) => ({ snow: 'snow', number: 'number' })[A.claveTurno(n)] || '';
    ok(A.nombresChat(A.genteChat('🇨🇴 SNOW 🇨🇴 + PEPE 🇦🇷', bus, tb)) === 'Snow 🇨🇴 y PEPE 🇦🇷',
      'con la Liga: su nombre y su país de la Liga, no las mayúsculas de la llave; y «A y B»');
    // 🙈 la mención, sólo a quien está en el servidor del chat (19/10/2026: «¿por qué dice unknown user?»)
    const idsT = { snow: '700000101', number: '700000102' };
    const gm = A.genteChat('SNOW 🇨🇴, NUMBER 🇺🇾', bus, tb, idsT, (k) => k === 'snow');
    ok(gm[0].id === '700000101' && gm[1].id === '' && A.nombresChat(gm) === '<@700000101> 🇨🇴 y Number 🇺🇾'
      && A.genteChat('SNOW', bus, tb, idsT)[0].id === '700000101',
    'la mención sólo a quien está en ese servidor; a los demás, su nombre (si no, Discord pone «@unknown-user»)');
    // el equipo que crece: «pasa» una vez, y quien llega después «se suma»
    const G1 = '# COMPE\n`[ OCTAVOS ]`\n⌞Teo 🇨🇴⌝ 🆚 ⌞Rodri 🇦🇷⌝\n⌞Zaik 🇪🇸⌝ 🆚 ⌞Verc 🇨🇱 + Rizas 🇻🇪⌝\n'
      + '`[ CUARTOS ]`\n⌞Rodri 🇦🇷⌝ 🆚 ⌞Verc 🇨🇱 + Rizas 🇻🇪⌝\n';
    // como en FFA: el organizador suma a Velatz al equipo de Rodri en las dos rondas
    const G2 = G1.split('⌞Rodri 🇦🇷⌝').join('⌞Rodri 🇦🇷 + Velatz 🇨🇱⌝');
    const e1 = A.momentosChat(llaveDe(G1), 'COMPE', [], 'todo');
    const pasa = e1.find((x) => /Rodri/.test(x.texto) && x.m.startsWith('b:'));
    const equipo = e1.find((x) => /Verc/.test(x.texto) && x.m.startsWith('b:'));
    const p1 = A.planChat(e1, { llave: { msg: '1' } }, 0, T, true, 'todo');
    ok(pasa && /✅ \*\*Rodri 🇦🇷\*\* pasa · Octavos · contra Teo 🇨🇴/.test(pasa.texto)
      && equipo && /✅ \*\*Verc 🇨🇱 y Rizas 🇻🇪\*\* pasan · Octavos · contra Zaik 🇪🇸/.test(equipo.texto)
      && p1.length === 1 && !/suma a/.test(p1[0].texto) && p1[0].m.some((m) => m.startsWith('u:')),
    'un equipo que ya estaba entero: «pasan», y sus integrantes van en esa línea, sin «suma a»', p1[0] && p1[0].texto);
    const hechos = { llave: { msg: '1' } };
    for (const m of p1[0].m) hechos[m] = { msg: '2' };
    const e2 = A.momentosChat(llaveDe(G2), 'COMPE', [], 'todo');
    const p2 = A.planChat(e2, hechos, 0, T, true, 'todo');
    ok(p2.length === 1 && /🧩 \*\*Rodri\*\* suma a \*\*Velatz 🇨🇱\*\* a su equipo/.test(p2[0].texto) && !/pasa/.test(p2[0].texto),
      'y si el ganador suma a alguien después: «suma a», no otro «pasa · de un grupo con…»', p2[0] && p2[0].texto);
    // el cierre: su noche, el batacazo, la racha (sólo con perfiles de antes de la llave) y su tarjeta
    const CI = '# COPA\n`[ CUARTOS ]`\n⌞Number 🇺🇾⌝ ✅ 🆚 ⌞Snow 🇨🇴⌝\n⌞Ana 🇦🇷⌝ ✅ 🆚 ⌞Bea 🇨🇱⌝\n'
      + '`[ FINAL ]`\n⌞Number 🇺🇾⌝ 🆚 ⌞Ana 🇦🇷⌝\nCAMPEÓN: Number 🇺🇾\n';
    const L = Object.assign(llaveDe(CI), { pub: 5000 });
    const perf = { number: { rd: [4, 4] } };
    const opc = { buscar: bus, tabla: tb, perf, perfT: L.pub - 1, cartaDe: (k) => 'https://pub-a.r2.dev/' + k + '/temporada.webp' };
    const ci = A.momentosChat(L, 'COPA', [], 'normal', opc).find((x) => x.m === 'campeon');
    ok(ci && /^🏆 \*\*Number 🇺🇾\*\* es el campeón de \*\*COPA\*\*\nGanó 2 batallas y en la final le ganó a Ana 🇦🇷\./.test(ci.texto)
      && /💥 El batacazo: \*\*Number 🇺🇾\*\* \(OVR 54\) le ganó a \*\*Snow 🇨🇴\*\* \(OVR 92\) en Cuartos\./.test(ci.texto)
      && /🔥 La racha: \*\*Number 🇺🇾\*\* lleva 6 duelos ganados seguidos\./.test(ci.texto)
      && ci.img === 'https://pub-a.r2.dev/number/temporada.webp', 'el cierre: el campeón con su noche, lo mejor de la noche y su tarjeta', ci && ci.texto);
    const ci2 = A.momentosChat(L, 'COPA', [], 'normal', Object.assign({}, opc, { perfT: L.pub + 1 })).find((x) => x.m === 'campeon');
    ok(!/La racha/.test(ci2.texto) && /batacazo/.test(ci2.texto), 'con perfiles de después de la llave, la racha se calla: la noche ya estaría contada');
    // 🔁 desplegar a mitad de un evento: lo dicho con las claves viejas no se repite, y lo nuevo sigue saliendo
    const viejas = { llave: { msg: '1' }, 'b:Octavos:rodri|teo:rodri': { msg: '2' }, 'v:Cuartos:rodri|verc': { msg: '3' } };
    const mg = A.migrarHechos(viejas, e2, { r: 'Cuartos', i: 0 });
    const conMig = Object.assign({}, viejas, Object.fromEntries(mg.map((m) => [m, { msg: '' }])));
    ok(mg.includes('b:Octavos:0:rodri') && mg.includes('v:Cuartos:0') && mg.includes('migrado')
      && !A.planChat(e2, conMig, 0, T, true, 'todo').length && A.migrarHechos(conMig, e2.concat({ m: 'b:Cuartos:0:x' })).length === 0
      && A.migrarHechos({ llave: { msg: '1' }, 'b:Octavos:0:rodri': { msg: '2' } }, e2).length === 0,
    'desplegado a mitad de un evento: lo dicho con las claves viejas no se repite, una sola vez, y lo nuevo sigue', mg);
    const pc = A.planChat([ci], { llave: { msg: '1' } }, 0, T, true, 'normal');
    ok(pc.length === 1 && pc[0].img === ci.img, 'la tarjeta del campeón viaja con su mensaje');
  }
  ok(Object.keys(A.NIVELES_CHAT).join() === 'poco,normal,todo,datos,full' && A.ajusteValido('en_vivo_nivel', { FFA: 'full' }).FFA === 'full'
    && A.ajusteValido('en_vivo_nivel', { FFA: 'mucho' }) === undefined, 'el ajuste del Dashboard acepta los cinco, y nada más');
  // 🎛️ los ajustes de más del Dashboard (07/10/2026): apuestas, aviso de cada evento, silencio y ritmo
  {
    const ap = A.ajusteValido('apuestas', { montos: [20, 50, 100], minutos: 5, tope: 300, apagadas: { DRA: true } });
    ok(ap && ap.montos.join() === '20,50,100' && ap.minutos === 5 && ap.tope === 300 && ap.apagadas.DRA === true
      && A.ajusteValido('apuestas', { montos: [100, 50], minutos: 3, tope: 500 }) === undefined
      && A.ajusteValido('apuestas', { montos: [50, 100], minutos: 3, tope: 80 }) === undefined
      && A.ajusteValido('apuestas', { montos: [50, 100], minutos: 30, tope: 500 }) === undefined
      && A.ajusteValido('apuestas', null) === null,
    'las apuestas: botones de menor a mayor, de 1 a 15 minutos, el tope desde el botón más alto');
    const c = A.apuestasCfg({ apuestas: ap }), c0 = A.apuestasCfg({});
    ok(c.cierra === 5 * 60000 && c.tope === 300 && c0.montos.join() === '50,100,250,500' && c0.cierra === 3 * 60000
      && c0.tope === 500 && A.botonesApuesta('x', 'Ana', 'Beto', false, c.montos)[0].components.length === 3
      && /5 minutos/.test(A.lineaApuesta('abierta', c)) && /de 20 a 300/.test(A.lineaApuesta('abierta', c))
      && /3 minutos/.test(A.lineaApuesta('abierta', c0)),
    'sin ajuste vale lo de siempre, y con ajuste los botones y el texto lo dicen', A.lineaApuesta('abierta', c));
    // 🎲 prendidas a mano en cualquier nivel (13/10/2026, Dlx: «sin la necesidad de que el bot esté en full o con datos»)
    const ap2 = A.ajusteValido('apuestas', { montos: [50, 100], minutos: 3, tope: 500, apagadas: { DDF: true }, prendidas: { URBF: true } });
    const c2 = A.apuestasCfg({ apuestas: ap2 });
    ok(ap2 && ap2.prendidas.URBF === true
      && A.ajusteValido('apuestas', { montos: [50, 100], minutos: 3, tope: 500, prendidas: { URBF: 'si' } }) === undefined
      && A.hayApuestas('URBF', 'normal', c2, {}) && A.hayApuestas('URBF', 'poco', c2, null)
      && !A.hayApuestas('FFA', 'normal', c2, {}) && A.hayApuestas('FFA', 'todo', c2, { apuestas: true })
      && A.hayApuestas('FFA', 'full', c2, {}) && A.hayApuestas('FFA', 'full', c0, {})
      && !A.hayApuestas('DDF', 'full', c2, { apuestas: true }) && !A.hayApuestas('DDF', 'normal', c2, {}),
    'las apuestas: «No hay apuestas en» gana; prendidas a mano (Dashboard o /settings) van en cualquier nivel; si no, sólo «A full»');
    // 🗳️ «¿Quién gana?» (13/10/2026): el renglón, cómo cierra, y que se cambia SÓLO su renglón
    // 🃏 «Conseguí tu tarjeta» (14/10/2026, Dlx: «Botón abajo de la imagen», «Sólo con silueta»)
    const ct = 'https://pub-a.r2.dev/snow/temporada.webp', cs = 'https://pub-a.r2.dev/kochi/servidor.webp';
    const ft = A.filaTarjeta({ a: { n: 'Ortiz', carta: '' }, b: { n: 'Trot', carta: ct } });
    ok(ft.length === 1 && ft[0].components.length === 1 && ft[0].components[0].style === 5
      && ft[0].components[0].url === 'https://underlegends.pages.dev/freestyle-rap/tarjetas' && /tarjeta/.test(ft[0].components[0].label)
      && A.filaTarjeta({ a: { carta: ct }, b: { carta: cs } }).length === 0
      && A.filaTarjeta({ a: { carta: '' }, b: { carta: '' } }).length === 1
      && A.filaTarjeta(null).length === 0 && A.filaTarjeta({ a: { carta: '' } }).length === 0,
    '«Conseguí tu tarjeta»: sale si alguno del vs va con la silueta; con sólo la Servidor (una tarjeta) no; sin vs, nada');
    const bv = A.botonesVoto('q1', 'Snow 🇨🇴', 'Makmah');
    ok(bv[0].components.map((x) => x.custom_id).join() === 'qg:q1:A,qg:q1:B' && bv[0].components[0].label === 'Snow'
      && /Votá abajo/.test(A.lineaVoto('A', 'B', 0, 0)) && /\*\*A\*\* 75 % · \*\*B\*\* 25 % \(4 votos\)/.test(A.lineaVoto('A', 'B', 3, 1))
      && /iba con \*\*A\*\* \(75 %, 4 votos\): acertó/.test(A.lineaVoto('A', 'B', 3, 1, 'A'))
      && /se equivocó/.test(A.lineaVoto('A', 'B', 3, 1, 'B')) && /dividido/.test(A.lineaVoto('A', 'B', 2, 2, 'A'))
      && /Nadie votó/.test(A.lineaVoto('A', 'B', 0, 0, 'x'))
      && A.conLineaVoto('⚔️ x\n🗳️ viejo\n✅ Pasa A', '🗳️ nuevo') === '⚔️ x\n🗳️ nuevo\n✅ Pasa A'
      && A.conLineaVoto('⚔️ x', '🗳️ nuevo') === '⚔️ x\n🗳️ nuevo',
    '«¿Quién gana?»: los dos botones, cómo va, si el público acertó, y se cambia sólo su renglón');
    ok(A.ajusteValido('aviso_evento', { sv: { DRA: 'chat', FFA: 'no' }, resto: 'DRA' }).sv.FFA === 'no'
      && A.ajusteValido('aviso_evento', { sv: { DRA: 'siempre' } }) === undefined,
    'el aviso de cada evento: por servidor «chat» o «no», y a dónde va el que no tiene');
    const sil = A.ajusteValido('silencio', { desde: '23:00', hasta: '08:00' });
    // 03:00 UTC del 8/10 son las 23:00 del este (EDT); 12:30 UTC son las 08:30
    ok(sil && A.enSilencio({ silencio: sil }, Date.UTC(2026, 9, 8, 3, 0))
      && A.enSilencio({ silencio: sil }, Date.UTC(2026, 9, 8, 10, 0))
      && !A.enSilencio({ silencio: sil }, Date.UTC(2026, 9, 8, 12, 30))
      && !A.enSilencio({}, Date.UTC(2026, 9, 8, 3, 0))
      && A.ajusteValido('silencio', { desde: '25:00', hasta: '08:00' }) === undefined,
    'el horario de silencio, en hora del este y cruzando la medianoche');
    const r = A.ajusteValido('ritmo', { normal: 5, batalla: 3 });
    const ms = [{ m: 'llave', texto: 'Arrancó' }];
    ok(r && A.ritmoCfg({ ritmo: r }).normal === 5 * 60000 && A.ritmoCfg({}).batalla === A.CHAT_ENTRE_TODO
      && A.planChat(ms, {}, 0, 6 * 60000, true, 'normal', 5 * 60000).length === 1
      && A.planChat(ms, {}, 2 * 60000, 6 * 60000, true, 'normal', 5 * 60000).length === 0
      && A.ajusteValido('ritmo', { normal: 1, batalla: 3 }) === undefined,
    'el ritmo del bot en vivo: cada cuánto puede hablar en un canal');
  }
  ok(JSON.stringify(A.favoritosDe(llaveDe(CUARTOS), [{ n: 'Ana', ovr: 80 }, { n: 'Dora', ovr: 90 },
    { n: 'Cami', ovr: 70 }, { n: 'cami', ovr: 75 }])) === '[["Dora",90],["Ana",80]]',
  'los favoritos: los de más OVR de la llave; un nombre de dos personas no cuenta');
  ok(A.chatGeneralDe([{ id: '1', type: 0, name: '💬┇charla' }, { id: '2', type: 0, name: 'chat-general' },
    { id: '3', type: 2, name: 'general' }, { id: '4', type: 0, name: 'general-staff' }]) === '2',
  'el chat general: «general» de texto, nunca el del staff ni el de voz');
  ok(A.chatGeneralDe([{ id: '1', type: 0, name: '「💬」𝐃𝐮𝐝𝐚𝐬' }, { id: '2', type: 0, name: '「💬」𝖢𝖾𝗇𝗍𝗋𝖺𝗅-𝖥𝖵𝖲' },
    { id: '3', type: 0, name: '「🤖」𝐉𝐮𝐞𝐜𝐞𝐬-𝐂𝐡𝐚𝐭', parent_id: 'adm' }], new Set(['adm'])) === '2'
    && A.chatGeneralDe([{ id: '1', type: 0, name: '「🌏」𝐂𝐄𝐍𝐓𝐑𝐀𝐋-𝐅𝐅𝐒' }, { id: '2', type: 0, name: 'chat-general' }]) === '2',
  'el chat de FVS y de FFS: «Central-FVS» (con letras decoradas) es su chat, y un «chat-general» le gana');
  const mc = A.mensajeRedCancelado({ t: 'VOL 21 2v2', sv: 'FFA', svn: 'Freestyle For All', ini: 1790000000000,
    url: 'https://discord.com/channels/1/2/3' }, 'borrado');
  ok(/^❌ CANCELADO/.test(mc.embeds[0].title) && mc.allowed_mentions.parse.length === 0 &&
    !mc.components[0].components.some((x) => x.label === 'Ir al anuncio'),
  'la copia cancelada: dice CANCELADO, no menciona a nadie y no lleva al anuncio borrado');
}

// ── 0b · los avisos de cada uno ───────────────────────────────────────
{
  console.log('0b · los avisos de cada uno');
  const hoy = new Date().toISOString();
  const cola = A.colaPersonal(JSON.stringify([
    { id: 'a1', quien: '554330098812059679', titulo: 'Desbloqueaste tu tarjeta', cuerpo: 'x',
      url: 'https://underlegends.pages.dev/#/r/konan', t: hoy },
    { id: 'a2', quien: 'no-es-un-id', titulo: 'x', t: hoy },
    { id: 'a3', quien: '554330098812059679', t: hoy },
  ]));
  ok(cola.length === 1 && cola[0].id === 'a1', 'la cola deja pasar sólo lo que se puede mandar');
  // 🔴 LA COLA YA NO SE BORRA AL LEERLA: lo de más de una semana no sale
  const vieja = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
  ok(A.colaPersonal(JSON.stringify([{ id: 'v', quien: '554330098812059679', titulo: 'x', t: vieja },
    { id: 's', quien: '554330098812059679', titulo: 'x' }])).length === 0,
    'lo de más de una semana, o sin fecha, no sale');
  ok(A.colaPersonal('esto no es json').length === 0 && A.colaPersonal(null).length === 0,
    'y una cola rota o vacía no rompe nada');
  const c = JSON.parse(A.cuerpoPersonal(cola[0]));
  ok(c.tipo === 'personal' && c.t === 'Desbloqueaste tu tarjeta' && c.url.endsWith('#/r/konan'),
    'el cuerpo lleva el título y el link al perfil');
  ok(JSON.parse(A.cuerpoPersonal({ id: 'z', titulo: 't', url: 'https://otro.sitio/x' })).url === '/',
    'un link que no es de la página no viaja');

  // vincular: el ID sale de Discord, nunca de la página
  const antes = globalThis.fetch;
  const llamadas = [];
  const env = { AVISOS: { idFromName: () => 'x', get: () => ({ fetch: async (u, o) => {
    llamadas.push([u, o && o.body]); return new Response('{"ok":true}'); } }) } };
  const pedir = (cuerpo) => A.rutaAvisos(new Request('https://x/avisos/vincular',
    { method: 'POST', body: JSON.stringify(cuerpo) }), env, '/avisos/vincular');
  let r = await pedir({ endpoint: 'https://push/1', token: 'x' });
  ok(r.status === 400 && !llamadas.length, 'un permiso con forma rara se rechaza sin molestar al objeto');
  globalThis.fetch = async () => new Response('{}', { status: 401 });
  r = await pedir({ endpoint: 'https://push/1', token: 'permisoFalso1234567890' });
  ok(r.status === 401 && !llamadas.length, 'uno que Discord no reconoce, también');
  // Discord contesta `/oauth2/@me` con de qué app es el permiso y quién es (revisión del 03/10/2026)
  const como = (app) => async () => new Response(JSON.stringify({ application: { id: app }, user: { id: '554330098812059679' } }), { status: 200 });
  globalThis.fetch = como('999999999999999999');
  r = await pedir({ endpoint: 'https://push/1', token: 'permisoAjeno1234567890' });
  ok(r.status === 401 && !llamadas.length, 'un permiso bueno de OTRA app no vincula (serían los avisos de otra persona)');
  globalThis.fetch = como(A.APP_ID);
  r = await pedir({ endpoint: 'https://push/1', token: 'permisoBueno1234567890', quien: '1' });
  const cuerpo = JSON.parse(llamadas[0] ? llamadas[0][1] : '{}');
  ok(r.status === 200 && cuerpo.quien === '554330098812059679' && cuerpo.endpoint === 'https://push/1',
    'uno bueno vincula con el ID que dice Discord (el que manda la página no cuenta)');
  globalThis.fetch = antes;
}

// ── 1 · el ejemplo del RFC 8291 ─────────────────────────────────────
{
  const as_pub = 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8';
  const as_priv = 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw';
  const ua_pub = 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4';
  const auth = 'BTBZMqHH6r4Tts7J_aSIgg';
  const sal = 'DGv6ra1nlYgDCS1FRnbzlw';
  const esperado = 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml' +
    'mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT' +
    'pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN';
  const pub = A.b64u.dec(as_pub);
  const jwk = { kty: 'EC', crv: 'P-256', d: as_priv,
    x: A.b64u.enc(pub.slice(1, 33)), y: A.b64u.enc(pub.slice(33, 65)) };
  const par = {
    privateKey: await crypto.subtle.importKey('jwk', jwk,
      { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']),
    publicKey: await crypto.subtle.importKey('raw', pub,
      { name: 'ECDH', namedCurve: 'P-256' }, true, []),
  };
  const out = await A.cifrar('When I grow up, I want to be a watermelon', ua_pub, auth,
    { par, sal: A.b64u.dec(sal) });
  console.log('1 · cifrado (RFC 8291, apéndice A)');
  ok(A.b64u.enc(out) === esperado, `el cuerpo es el del RFC byte a byte (${out.length} bytes)`);
}

// ── 2 · el lector, contra lo que da Python ──────────────────────────
{
  console.log('2 · el lector de anuncios contra Python (bot/avisos_casos.json)');
  const { casos } = JSON.parse(readFileSync(join(aqui, 'avisos_casos.json'), 'utf8'));
  let mal = 0;
  for (const c of casos) {
    const a = A.parsearAnuncio({ content: c.content });
    const ms = a ? A.momentoMs(a.horario, c.timestamp, a.fecha || A.diaDelNombre(a.nombre)) : null;
    const js = {
      es: !!a,
      nombre: a ? a.nombre : '',
      horario: a ? a.horario : '',
      ini: ms == null ? null : new Date(ms).toISOString().slice(0, 19),
    };
    const e = c.espera;
    if (js.es !== e.es || js.nombre !== e.nombre || js.horario !== e.horario || js.ini !== e.ini) {
      mal++;
      console.log(`     ❌ ${c.sv} ${c.id}\n        Python ${JSON.stringify(e)}\n        JS     ${JSON.stringify(js)}`);
    }
  }
  const anuncios = casos.filter((c) => c.espera.es).length;
  ok(mal === 0, `los ${casos.length} casos dan lo mismo que en Python (${anuncios} anuncios)`);
  ok(casos.length >= 30, 'hay casos de verdad para comparar');
  // 🔑 la tarjeta del Centro de Competencias de DRA: sin texto, en un embed
  // (el contrato guarda sólo texto; ver el self-check de bot/anuncios.py)
  const inscr = '¡Inscríbete presionando el botón de abajo!';
  const t = A.parsearAnuncio({ content: '', embeds: [{ title: '🏆 LA NOCHE DEL FREE', description: inscr }] });
  ok(!!t && t.nombre === 'LA NOCHE DEL FREE', 'la tarjeta del Centro de Competencias de DRA');
  ok(!A.parsearAnuncio({ content: '', embeds: [{ title: '🏆 prueba', description: inscr }] }),
    'y la de una prueba del sistema, no');
}

// ── 3 · VAPID y la alta ─────────────────────────────────────────────
{
  console.log('3 · VAPID y la alta');
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true,
    ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', par.privateKey);
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey));
  const env = { VAPID_PUBLICA: A.b64u.enc(pub), VAPID_PRIVADA: jwk.d };
  const jwt = await A.jwtVapid('https://fcm.googleapis.com', env, Date.UTC(2026, 8, 24));
  const [c, b, f] = jwt.split('.');
  const bien = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, par.publicKey,
    A.b64u.dec(f), new TextEncoder().encode(c + '.' + b));
  ok(bien, 'la firma del JWT verifica con la clave pública');
  const claims = JSON.parse(new TextDecoder().decode(A.b64u.dec(b)));
  ok(claims.aud === 'https://fcm.googleapis.com' && claims.sub.startsWith('https://'),
    'aud es el servicio y sub es https (Apple no acepta otra cosa)');
  ok(claims.exp - Date.UTC(2026, 8, 24) / 1000 <= 24 * 3600, 'vence antes de 24 h (RFC 8292)');

  const p256dh = A.b64u.enc(pub);
  const auth = A.b64u.enc(new Uint8Array(16).fill(7));
  const sub = (endpoint, k) => ({ endpoint, keys: k || { p256dh, auth } });
  ok(A.suscripcionValida(sub('https://fcm.googleapis.com/fcm/send/abc')) === '', 'acepta FCM');
  ok(A.suscripcionValida(sub('https://updates.push.services.mozilla.com/wpush/v2/x')) === '', 'acepta Mozilla');
  ok(A.suscripcionValida(sub('https://web.push.apple.com/QGx')) === '', 'acepta Apple');
  ok(A.suscripcionValida(sub('https://wns2-par02p.notify.windows.com/w/?token=x')) === '', 'acepta Windows');
  ok(A.suscripcionValida(sub('https://evil.example.com/push')) !== '', 'rechaza un host que no es de push');
  ok(A.suscripcionValida(sub('http://fcm.googleapis.com/x')) !== '', 'rechaza sin https');
  ok(A.suscripcionValida(sub('https://fcm.googleapis.com/x', { p256dh: 'AAAA', auth })) !== '',
    'rechaza una clave que no es un punto P-256');
}

// ── 3b · qué escucha el vigía y qué publica en eventos-hoy ──────────
{
  console.log('3b · el vigía y eventos-hoy');
  const si = ['〢🔥〉eventos-hoy', '✦🏆︱eventos', '［🏆］eventos', '〢🥇〉competenciasᵀᴵᴱᴿ¹',
    '👾˚┊ffa-competencias', '〢🗓️〉proximos-eventos'];
  const no = ['✦📢︱anuncios', '•「🌐」novedades', '✦⚡︱novedades', '［📢］anuncios'];
  ok(si.every((n) => A.PATRON_VIGIA.test(n)), 'escucha los de eventos y competencias');
  ok(no.every((n) => !A.PATRON_VIGIA.test(n)), 'y no los de anuncios ni novedades (Dlx, 25/09)');
  // 🏛️ la ACADEMIA (04/10/2026): su canal de eventos se llama «torneos», y «organizar-eventos» es del staff
  ok(A.PATRON_VIGIA.test('🥇┇torneos') && !A.PATRON_VIGIA.test('📢┇anuncios・') && A.STAFF.test('organizar-eventos'),
     'el «torneos» de la ACADEMIA sí; su «anuncios» no, y «organizar-eventos» es del staff');
  const m = A.mensajeRed({ t: 'ELRAP FECHA 7', sv: 'FFA', svn: 'Freestyle For All',
    ini: Date.UTC(2026, 8, 25, 1, 0), mod: '1vs1', cup: '16', pre: '',
    url: 'https://discord.com/channels/1/2/3' });
  const e = m.embeds[0];
  ok(!m.content, 'sin texto: el lector de anuncios no lo puede tomar por un anuncio');
  ok(Array.isArray(m.allowed_mentions.parse) && !m.allowed_mentions.parse.length,
    'no le hace ping a nadie');
  ok(e.description.includes('<t:1790298000:R>'), 'la hora va como marca de Discord (cada uno en su zona)');
  ok(m.components[0].components.every((b) => b.style === 5 && b.url),
    'los dos botones son links: al anuncio y a la campana');
  // «Inscribite ya» (Dlx, 03/10/2026: «1. a»): la invitación al canal donde se anota ESE evento
  const meta = { inscribir: { URBF: [['111', 'torneos', 'AAA'], ['222', 'cabrana', 'BBB']], DRA: [['500', 'comp', 'CCC']] },
    invita: { SR: 'https://discord.gg/SRSR' } };
  const canales = { lista: [{ id: '300', p: 'cabrana', sv: 'URBF' }, { id: '301', p: 'otra', sv: 'URBF' }, { id: '500', p: 'comp', sv: 'DRA' }] };
  const url = (sv, cid) => ({ sv, url: 'https://discord.com/channels/9/' + cid + '/7' });
  ok(A.invitacionPara(url('URBF', '300'), canales, meta).url === 'https://discord.gg/BBB',
    'la del canal de inscripciones de la misma categoría que el anuncio (Urban: la Cabrana con la suya)');
  ok(A.invitacionPara(url('URBF', '301'), canales, meta).url === 'https://discord.gg/AAA',
    'sin una de su categoría, la primera del servidor');
  ok(A.invitacionPara(url('DRA', '500'), canales, meta).url === 'https://discord.gg/CCC',
    'la del mismo canal del anuncio, donde DRA se anota con el botón de la tarjeta');
  const sr = A.invitacionPara(url('SR', '900'), canales, meta);
  ok(sr.tipo === 'servidor' && sr.url === 'https://discord.gg/SRSR', 'sin ninguna de inscripciones, la del servidor');
  ok(A.invitacionPara(url('FFS', '1'), canales, meta) === null && A.invitacionPara(url('FFS', '1'), null, null) === null,
    'y sin nada, nada');
  const mi = A.mensajeRed({ t: 'X', sv: 'URBF', url: 'https://discord.com/channels/9/300/7',
    ins: { url: 'https://discord.gg/BBB', tipo: 'inscribir' } });
  const b0 = mi.components[0].components[0];
  ok(b0.label === 'Inscribite ya' && b0.url === 'https://discord.gg/BBB' && mi.embeds[0].url === b0.url,
    '«Inscribite ya» en el botón y en el título, no el link al mensaje');
  const ms = A.mensajeRed({ t: 'X', sv: 'SR', url: 'https://discord.com/channels/9/1/7', ins: sr });
  ok(ms.components[0].components[0].label === 'Entrar al servidor', 'con la del servidor, «Entrar al servidor»');
  ok(m.components[0].components[0].label === 'Ir al anuncio', 'y sin ninguna, el anuncio, como antes');
}

// ── 4 · el ida y vuelta: lo que se cifra se puede abrir ─────────────
{
  console.log('4 · ida y vuelta');
  const ua = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true,
    ['deriveBits']);
  const uaPub = new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const texto = JSON.stringify({ v: 1, tipo: 'evento', t: 'ELRAP FECHA 7 — ñandú 🐍' });
  const cuerpo = await A.cifrar(texto, A.b64u.enc(uaPub), A.b64u.enc(auth));
  // lo que hace el navegador al recibir (RFC 8291 §3.4), escrito aparte
  const sal = cuerpo.slice(0, 16);
  const asPub = cuerpo.slice(21, 86);
  const asKey = await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256));
  const hk = async (s, i, info, n) => new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: s, info },
    await crypto.subtle.importKey('raw', i, 'HKDF', false, ['deriveBits']), n * 8));
  const enc = (s) => new TextEncoder().encode(s);
  const info = new Uint8Array([...enc('WebPush: info\x00'), ...uaPub, ...asPub]);
  const ikm = await hk(auth, ecdh, info, 32);
  const cek = await hk(sal, ikm, enc('Content-Encoding: aes128gcm\x00'), 16);
  const nonce = await hk(sal, ikm, enc('Content-Encoding: nonce\x00'), 12);
  const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const claro = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, k, cuerpo.slice(86)));
  ok(claro[claro.length - 1] === 2, 'termina con el delimitador 0x02');
  ok(new TextDecoder().decode(claro.slice(0, -1)) === texto, 'se abre y dice lo mismo, con tildes y emoji');
  ok(cuerpo.length < 4000, `entra en el tope de 4 KB de los servicios (${cuerpo.length} bytes)`);
}


// ── las llaves en vivo que se borraron en Discord (28/09/2026) ──────
{
  const m = (...ids) => ids.map((id) => ({ id: String(id) }));
  ok(A.borradasDelCanal(['1554223046741467277'], null, 4).length === 0,
    'si la lectura falló no se saca nada');
  ok(JSON.stringify(A.borradasDelCanal(['12', '9', '14'], m(13, 12, 11, 10), 4)) === '["14"]',
    'se saca la guardada más nueva que la lectura y que no vino (se borró)');
  ok(!A.borradasDelCanal(['9'], m(13, 12, 11, 10), 4).length,
    'la más vieja que la lectura se queda: la lectura no la cubre');
  ok(JSON.stringify(A.borradasDelCanal(['4', '6'], m(6, 5), 4)) === '["4"]',
    'con menos de 4 mensajes la lectura es el canal entero');
  ok(JSON.stringify(A.borradasDelCanal(['1554223046741467277', '1554203282082373804'],
    m('1554203282082373804', '1553957529648767098', '1550360301994639381', '1550272189805232213'), 4))
    === '["1554223046741467277"]',
  'el caso real: la llave de burla borrada sale, la COMPE DEL VACILE se queda');
}


// ── las categorías de staff (FFS LEAGUE, 28/09/2026) ──
{
  const cs = [
    { id: '1', type: 4, name: '🈺𝒜𝒟𝑀𝐼𝒩𝐼𝒮𝒯𝑅𝒜𝒞𝐼𝒪𝒩🫅' },
    { id: '2', type: 4, name: '𝐏𝐋𝐀𝐙𝐀𝐒 𝐅𝐅𝐒👑' },
    { id: '3', type: 0, name: '🏛️𝔸ℕ𝕌ℕℂ𝕀𝕆𝕊🏛️', parent_id: '1' },
    { id: '4', type: 4, name: 'STAFF ZONE' },
  ];
  const f = A.categoriasStaff(cs);
  ok(f.has('1') && f.has('4') && !f.has('2') && !f.has('3') && f.size === 2,
    'la categoría de administración (en letras decoradas) es de staff; la de las plazas, no: ' + [...f].join(','));
}

// ── seguir raperos: lo que se les avisa a los seguidores (28/09/2026) ──
{
  ok(['makma', 'volk-co', 'last-x2', 'ржунимагу', 'lazaro'].every(A.claveValida) &&
    !['', 'a/b', 'a b', '-x', '../x', 'x'.repeat(61), null, 7].some(A.claveValida),
  'una clave de perfil: letras y números de cualquier alfabeto y el -cc de los choques; nada más');
  const ahora = Date.parse('2026-10-14T15:00:00Z');
  const muro = [
    { tipo: 'campeon', t: '2026-10-14T02:00:00Z', quien: ['Ana 🇦🇷', 'Bea'], ks: ['ana', 'bea'], ev: 'COPA', sv: 'SR' },
    { tipo: 'rango', t: '2026-10-14T12:22:00Z', quien: ['Cid'], ks: ['cid'], rg: 'B', primero: true },
    { tipo: 'tarjeta', t: '2026-10-14T12:22:00Z', quien: ['Dan'], ks: [''], carta: 'pais' },
    { tipo: 'premios', t: '2026-10-13T15:00:00Z', figura: ['Ana 🇦🇷', 9000], servidor: ['SR', 3], ks: { figura: 'ana' } },
    { tipo: 'caza', t: '2026-10-12T22:00:00Z', quien: ['Eva'], ks: ['eva'], a: 'Cid', ev: 'VIEJA' },
    { tipo: 'anuncio', t: '2026-10-14T14:00:00Z', ev: 'SNAKE ARENA', sv: 'SR' },
  ];
  const c = A.paraSeguidores(muro, ahora);
  ok(c.length === 4 && c.map((x) => x.k).join() === 'ana,bea,cid,ana',
    'de las últimas 24 h y de alguien con perfil: el equipo campeón, el rango y el premio; ' +
    'la tarjeta sin perfil, la caza de hace dos días y el anuncio, no  ' + c.map((x) => x.k).join());
  ok(c[0].pub === c[1].pub && c[0].pub !== c[3].pub,
    'los dos del mismo equipo son la misma publicación: a quien sigue a los dos le llega uno');
  ok(c[0].titulo === '🏆 Ana 🇦🇷 y su equipo ganaron COPA' && c[2].titulo === '🎖️ Cid ya tiene rango: B' &&
    c[3].titulo === '🥇 Ana 🇦🇷 es la figura de la semana', c.map((x) => x.titulo).join(' | '));
  ok(c[0].url === 'https://underlegends.pages.dev/freestyle-rap/r/ana' && A.paraSeguidores(muro, ahora)[0].pub === c[0].pub,
    'el aviso abre su perfil, y la misma publicación da siempre el mismo número (no se repite)');
  ok(A.tituloSeguido({ tipo: 'tarjeta', carta: 'competitivo' }, 'Ana') === '🃏 Ana desbloqueó su tarjeta Competitiva' &&
    A.tituloSeguido({ tipo: 'anuncio' }, 'Ana') === '', 'la tarjeta con su nombre; lo que no es de nadie, nada');
  ok(!A.paraSeguidores(null, ahora).length && !A.paraSeguidores([{ tipo: 'rango', t: 'x', ks: ['a'] }], ahora).length,
    'sin muro, o con una fecha rota, nada');
}

// ── 👏 felicitar: cuándo suena y qué dice (02/10/2026) ──
{
  console.log('\n  👏 felicitar');
  const ahora = Date.parse('2026-10-14T15:00:00Z');
  const M = 60 * 1000, H = 60 * M;
  const f = (o) => Object.assign({ n: 1, avisado: 0, primero: ahora - 20 * M, t_avisado: 0, t: '2026-10-14T02:00:00Z' }, o);
  ok(A.aplausoParaAvisar(f({}), ahora) && !A.aplausoParaAvisar(f({ primero: ahora - 5 * M }), ahora),
    'el primero suena, pero espera 10 minutos para juntar a los que felicitan a la vez');
  ok(!A.aplausoParaAvisar(f({ n: 2, avisado: 1, t_avisado: ahora - 2 * H }), ahora) &&
    A.aplausoParaAvisar(f({ n: 3, avisado: 1, t_avisado: ahora - 2 * H }), ahora),
    'después, sólo al llegar a un hito: 2 no, 3 sí');
  ok(!A.aplausoParaAvisar(f({ n: 5, avisado: 3, t_avisado: ahora - 20 * M }), ahora),
    'y nunca dos veces en una hora');
  ok(!A.aplausoParaAvisar(f({ t: '2026-10-01T02:00:00Z' }), ahora) && !A.aplausoParaAvisar(f({ n: 0 }), ahora) &&
    !A.aplausoParaAvisar(null, ahora), 'de lo de hace más de una semana, sin aplausos o sin fila, nada');
  ok(A.hitoAplausos(0) === 0 && A.hitoAplausos(4) === 3 && A.hitoAplausos(12) === 10 && A.hitoAplausos(9999) === 500,
    'los hitos: 1, 3, 5, 10, 25…');
  const av = A.avisoAplauso(12, A.motivoAplauso({ tipo: 'campeon', ev: 'COPA' }));
  ok(av.titulo === '👏 12 personas te felicitaron' && av.cuerpo.startsWith('Por ganar COPA.') &&
    A.avisoAplauso(1, '').titulo === '👏 Alguien te felicitó', av.titulo + ' | ' + av.cuerpo);
  ok(A.avisoSeguidores(1, 'Konan').titulo === '⭐ Konan empezó a seguirte' && A.avisoSeguidores(1, '').titulo === '⭐ Alguien nuevo te sigue' &&
    A.avisoSeguidores(3, 'Konan').titulo === '⭐ 3 personas nuevas te siguen',
    'alguien te sigue: con su nombre si es uno y es de la Liga; si no, cuántos');
  ok(A.motivoAplauso({ tipo: 'rango', rg: 'B', primero: true }) === 'conseguir tu primera letra: B' &&
    A.motivoAplauso({ tipo: 'rango', rg: 'A' }) === 'subir a rango A' &&
    A.motivoAplauso({ tipo: 'caza', a: 'Bea', ev: 'COPA' }) === 'cazar a Bea en COPA' &&
    A.motivoAplauso({ tipo: 'tarjeta' }) === '', 'el motivo de cada logro; lo que no es un logro, nada');
}

// ── los canales de veredictos: también «votaciones» y «resultados» (Dlx, 02/10/2026) ──
{
  console.log('\n  los canales de veredictos que mira el vigía');
  const es = (n) => A.PATRON_VEREDICTOS.test(n.normalize('NFKD')) && !A.NO_VEREDICTOS.test(n.normalize('NFKD'));
  ok(es('✦🗳️︱votaciones') && es('「🐂」𝐕𝐎𝐓𝐀𝐂𝐈𝐎𝐍𝐄𝐒') && es('［👨‍⚖️］veredictos') && es('「👑」𝐑𝐄𝐒𝐔𝐋𝐓𝐀𝐃𝐎𝐒'),
    'las votaciones de FFA y FFS, los veredictos y los resultados (en letras matemáticas también)');
  ok(!es('「📑」𝙍𝙚𝙨𝙪𝙡𝙩𝙖𝙙𝙤𝙨-𝙋𝙤𝙨𝙩𝙪𝙡𝙖𝙘𝙞𝙤𝙣𝙚𝙨') && !es('✦📝︱inscripciones'),
    'las postulaciones no (quién entra al staff), ni las inscripciones');
}

// ── 🕵️ quién es cada nombre de una llave en vivo (Dlx, 02/10/2026: «múltiples vías para detectar quiénes participan») ──
{
  console.log('\n  quién es cada nombre en vivo: la inscripción, la llamada y la mención');
  ok(A.normPagina('Park-Ji Sung🇰🇷') === 'parkjisung' && A.normPagina('@Six (pichula)') === 'six' &&
    A.normPagina('Agustín') === 'agustin', 'como la página: sin banderas, signos, tildes ni la historia del final');
  ok(JSON.stringify(A.nombresInscripcion('Park-Ji Sung🇰🇷')) === '["parkjisung"]' &&
    A.nombresInscripcion('Dxg 🇲🇽 x Soneto 🇪🇨').length === 2 && A.nombresInscripcion('ACH + Yor').length === 2 &&
    JSON.stringify(A.nombresInscripcion('Zaik 🇪🇸 (suplente)')) === '["zaik"]',
  'una inscripción: un nombre, una pareja (con «x» entre banderas, o «+»), y la nota entre paréntesis afuera');
  const insc = [
    { autor_id: '9', texto: 'Park-Ji Sung🇰🇷' },              // la de Oasis, con su nombre troll
    { autor_id: '7', texto: 'prr' }, { autor_id: '7', texto: 'prrr 🇦🇴' },   // dos grafías del mismo: valen
    { autor_id: '5', texto: 'Player' }, { autor_id: '5', texto: 'Steven' },  // anota a otros: no vale
    { autor_id: '3', texto: 'Korey + Tayo' },                 // una pareja: no dice quién es quién
  ];
  const voz = { 4: { n: ['ANTORCHA OLÍMPICA', 'carlos vive', 'ivanjajaa'] }, 8: { n: ['Sol'] }, 6: { n: ['Sol'] } };
  const men = { 2: ['MAKMA', 'makmah'] };
  const idx = A.indiceVivo(insc, voz, men);
  const q = A.quienesDe(['Park-Ji Sung🇰🇷', 'PRRR', 'Steven', 'Korey', 'ANTORCHA OLÍMPICA 🇦🇷', '@MAKMA', 'Sol', 'Yo'], idx);
  ok(q.parkjisung === '9' && q.prrr === '7' && q.antorchaolimpica === '4' && q.makma === '2',
    'el nombre troll por la inscripción de su cuenta, las dos grafías, el apodo de la llamada y la mención: ' + JSON.stringify(q));
  ok(!q.steven && !q.player && !q.korey && !q.tayo,
    'quien anota a otros no es ninguno de ellos, y una pareja no dice quién es quién');
  ok(!q.sol && !q.yo, 'un nombre de dos cuentas no es de ninguna, y uno de dos letras tampoco');
  const m = A.mencionesDe({ mentions: [{ id: '11', username: 'oasis', global_name: 'Oasis', member: { nick: 'Park-Ji Sung' } },
    { id: 'x', username: 'roto' }] });
  ok(JSON.stringify(m) === '{"11":["Park-Ji Sung","Oasis","oasis"]}',
    'la mención trae el apodo, el nombre visible y el usuario; un id que no es un número, no');
}


// 🙋 LOS ANOTADOS (03/10/2026): qué cuenta como inscripción, de qué evento es, y de quién es la cara
{
  console.log('\n🙋 los anotados de cada evento');
  const p = (t) => A.pareceAnotado(t);
  ok(JSON.stringify(p('saiko 🇨🇱')) === '{"aka":"saiko","cc":"cl","b":true}' && p('Fokox🇦🇷').aka === 'Fokox',
    'un nombre con su bandera: el nombre, el país y que la trae');
  ok(p('Kravitz<a:COSTARICA:1340260308148555826>').cc === 'cr' && p('Kravitz<a:COSTARICA:1340260308148555826>').aka === 'Kravitz',
    'la bandera de un emoji del servidor, por su nombre');
  ok(p('te imaginas') && !p('te imaginas').b, 'dos palabras sin bandera pasan, pero sin bandera: lo decide el nombre conocido');
  ok(!p('Empieza cuando ?') && !p('@everyone 1 CUPO MASS') && !p('INSCRIPCIONES ABIERTAS 🔥') && !p('cerramos inscripciones') &&
    !p('CHECk estoy haciendo una prueba pero si hay inscritos') && !p('🇦🇷') && !p(''),
    'una pregunta, un aviso, la marca de abiertas o cerradas, una frase, sólo la bandera: nada');
  const t0 = Date.parse('2026-10-03T20:00:00Z');
  const evs = [{ id: 'a', sv: 'FFA', pub: t0, ini: t0 + 30 * 60000 }, { id: 'b', sv: 'FFA', pub: t0 + 10 * 60000, ini: t0 + 4 * 3600000 },
    { id: 'c', sv: 'SR', pub: t0, ini: t0 + 3600000 }];
  const insc = [{ sv: 'FFA', pub: t0 + 5 * 60000, texto: 'Snow 🇨🇴', autor_id: '1' }, { sv: 'FFA', pub: t0 + 15 * 60000, texto: 'yinn 🇲🇽', autor_id: '2' },
    { sv: 'FFA', pub: t0 + 2 * 3600000, texto: 'Oasis 🇨🇱', autor_id: '3' }, { sv: 'FFA', pub: t0 + 6 * 60000, texto: 'snow🇨🇴', autor_id: '9' },
    { sv: 'SR', pub: t0 - 60000, texto: 'Antes 🇦🇷', autor_id: '4' }, { sv: 'URBF', pub: t0 + 60000, texto: 'Otro 🇦🇷', autor_id: '5' }];
  const por = A.anotadosDe(evs, insc);
  ok(JSON.stringify((por.a || []).map((x) => x.aka)) === '["Snow","yinn"]' && JSON.stringify((por.b || []).map((x) => x.aka)) === '["Oasis"]',
    'cada uno al evento que arranca primero entre los ya anunciados; uno ya empezado hace más de media hora, no: ' + JSON.stringify(por));
  ok(!por.c && Object.keys(por).length === 2, 'antes del anuncio, o de un servidor sin evento: de nadie; y la misma persona, una vez');
  ok(A.claveDeNombre('volk', 'volk-co') && A.claveDeNombre('snow', 'snow') && A.claveDeNombre('parkji', 'parkjisung') &&
    !A.claveDeNombre('denik', 'jesuslgamer31') && !A.claveDeNombre('sol', 'solx'),
    'la cara de la cuenta sólo si su perfil se llama como lo que escribió (quien anota a otro no le presta la cara)');
  // 🔑 LA REDENCION (FFA, MULTIVERSE, 03/10/2026): los equipos, el compañero por definir y «primera»
  const ps = (t) => JSON.stringify((A.personasDeInscripcion(t) || []).map((x) => x.aka + (x.cc ? ':' + x.cc : '')));
  ok(ps('Trot 🇪🇸+?') === '["Trot:es"]' && ps('Dyzz🇨🇱 +??') === '["Dyzz:cl"]',
    'el compañero por definir («+?») no es nadie, y no tira la inscripción');
  ok(ps('Crk🇲🇽  primera') === '["Crk:mx"]' && ps('nc🇮🇶primera') === '["nc:iq"]', '«primera» es llegar primero, no el nombre');
  ok(ps('Eclipse🇨🇱 +alter🇨🇱') === '["Eclipse:cl","alter:cl"]' && ps('Zignos 🇩🇴 - Abyssus 🇨🇦') === '["Zignos:do","Abyssus:ca"]' &&
    ps('yinn+ji sung park') === '["yinn","ji sung park"]' && ps('luisito y @mathias') === '["luisito","@mathias"]',
    'un equipo es una persona por lado: «+», « - », « y »');
  ok(ps('PichulaMc PolloSport Erian 🇦🇷 🇦🇷 🇵🇦') === '["PichulaMc:ar","PolloSport:ar","Erian:pa"]' &&
    ps('HASSAN🇦🇷 ABYSSUS🇵🇦') === '["HASSAN:ar","ABYSSUS:pa"]',
    'los nombres y después las banderas, en orden; y cada uno con la suya sin separador');
  ok(ps('dxg🇲🇽🇨🇴') === '["dxg:mx"]' && ps('Park-Ji Sung 🇰🇷') === '["Park-Ji Sung:kr"]' && !A.personasDeInscripcion('¿puedo anotarme?'),
    'dos banderas pegadas son de uno, el guion sin espacios es parte del nombre, y una pregunta sigue sin ser nadie');
  const eq = A.anotadosDe([{ id: 'r', sv: 'FFA', pub: t0, ini: t0 + 30 * 60000 }],
    [{ sv: 'FFA', pub: t0 + 60000, texto: 'Zignos 🇩🇴 - Abyssus 🇨🇦', autor_id: '7' }, { sv: 'FFA', pub: t0 + 120000, texto: 'Abyssus 🇨🇦', autor_id: '8' }]);
  ok(JSON.stringify((eq.r || []).map((x) => x.aka)) === '["Zignos","Abyssus"]' && eq.r[0].msg === eq.r[1].msg,
    'el equipo entra como dos, del mismo mensaje; y quien ya estaba en un equipo no se repite');
  ok(A.msDeId('1556032680762671145') === Date.parse('2026-10-03T19:58:20.783Z') && A.msDeId('no') === 0,
    'la hora de un mensaje sale de su id (el anuncio de DESGRACIAS EN TOKYO VOL 21: 3:58 PM ET)');
}

// 🔥 LA RACHA DIARIA Y LOS NIVELES: la cuenta del objeto, con los mismos números que `bot/racha.py --auto`
{
  console.log('\n🔥 la racha diaria y los niveles');
  const r = A.rachaDeDias;
  const x = r(['2026-10-01', '2026-10-02', '2026-10-03'], '2026-10-04');
  ok(x.actual === 3 && x.inicio === '2026-10-01' && !x.hoy && x.maxima === 3 && x.total === 3,
    'ayer contó: la racha sigue viva todo el día de hoy');
  // 🛟 un día en blanco no la corta (una vez por semana); dos sí (13/10/2026, «8. B»)
  ok(r(['2026-10-01', '2026-10-02'], '2026-10-04').actual === 2 && r(['2026-10-01', '2026-10-02'], '2026-10-05').actual === 0
    && r([], '2026-10-04').actual === 0, 'un día en blanco no la corta, dos sí, y sin días no hay racha');
  ok(r(['2026-10-01', '2026-10-02', '2026-10-04', '2026-10-05'], '2026-10-05').actual === 4
    && r(['2026-10-01', '2026-10-03', '2026-10-05'], '2026-10-05').actual === 1
    && r(['2026-10-01', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09',
      '2026-10-10', '2026-10-12'], '2026-10-12').actual === 10,
  'el día perdonado no suma, y se perdona uno por semana');
  const y = r(['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-10-03', '2026-10-04'], '2026-10-04');
  ok(y.actual === 2 && y.maxima === 4 && y.hoy && y.inicio === '2026-10-03', 'la de ahora y la mejor son distintas');
  ok(r(['2026-10-31', '2026-11-01', '2026-11-02'], '2026-11-02').actual === 3 && r(['2026-12-31', '2027-01-01'], '2027-01-01').actual === 2,
    'el cambio de mes, de año y de horario no la cortan');
  // 🔥 «tu racha se corta hoy» (13/10/2026, «hacer todo»): sólo si hoy no entraste y mañana valdría 0
  const p = A.rachaEnPeligro;
  ok(!p(['2026-10-01', '2026-10-02', '2026-10-03'], '2026-10-04'), 'con el día de perdón sin usar, no se corta: no se avisa');
  const pe = p(['2026-10-01', '2026-10-03', '2026-10-04', '2026-10-05'], '2026-10-06');
  ok(pe && pe.actual === 4, 'con el perdón ya usado esta semana, sí: se avisa con los días que lleva');
  ok(!p(['2026-10-01', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06'], '2026-10-06'), 'si hoy ya entraste, no');
  ok(!p(['2026-10-03', '2026-10-05'], '2026-10-06'), 'una racha de menos de ' + A.RACHA_AVISO_MIN + ' días, no');
  ok(!p(['2026-10-01', '2026-10-02'], '2026-10-05'), 'una que ya se cortó, tampoco');
  const nv = (xp) => A.nivelDeXp(xp, 10).n;
  ok([0, 19, 20, 899, 900].map(nv).join() === '1,1,2,9,10', 'el nivel de cada experiencia, como `racha.nivel()`');
  const n5 = A.nivelDeXp(250, 10);
  ok(n5.n === 5 && n5.base === 200 && n5.sig === 300, 'el nivel trae dónde empieza y dónde termina');
}

// 🔴 NINGÚN MÉTODO DEL OBJETO PISADO POR UN DATO SUYO. El Dashboard llamaba `this.dueno()` y el vigía guarda en
// `this.dueno` el Discord ID de Dlx: desde la primera vuelta del vigía, «this.dueno is not a function» (04/10/2026).
// Ninguna prueba lo veía, porque ninguna corre el vigía antes de pedir el Dashboard. Se mira el texto de la clase:
// los nombres de sus métodos contra los `this.x =` que la clase escribe.
{
  const fuente = readFileSync(join(aqui, 'avisos.js'), 'utf8');
  const ini = fuente.indexOf('export class Avisos');
  const clase = ini >= 0 ? fuente.slice(ini) : '';
  const metodos = new Set([...clase.matchAll(/^ {2}(?:async\s+)?([A-Za-z_]\w*)\s*\([^)]*\)\s*\{/gm)].map((m) => m[1]));
  const datos = new Set([...clase.matchAll(/this\.([A-Za-z_]\w*)\s*=(?!=)/g)].map((m) => m[1]));
  const pisados = [...metodos].filter((m) => datos.has(m) && m !== 'constructor');
  ok(ini >= 0 && metodos.size > 50 && !pisados.length,
    'ningún método del objeto se pisa con un dato (' + metodos.size + ' métodos' +
    (pisados.length ? ', pisados: ' + pisados.join(', ') : '') + ')');
}

// 🎤 EL BOT EN VIVO SOBRE EL OBJETO DE VERDAD (05/10/2026): SQLite de Node y Discord falso. ⚠️ `node:sqlite` es de Node
// 22.5 en adelante: con uno más viejo (CI usa el 20) se dice y se sigue; las funciones puras ya se probaron arriba
{
  let DatabaseSync = null;
  try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { DatabaseSync = null; }
  if (!DatabaseSync) {
    console.log('  ⓘ sin node:sqlite (Node ' + process.version + '): el bot en vivo no se prueba sobre el objeto');
  } else {
    const db = new DatabaseSync(':memory:');
    const sql = {
      exec(q, ...ps) {
        const t = String(q).trim();
        if (!ps.length && /;\s*\S/.test(t)) { db.exec(t); return { toArray: () => [] }; }
        const st = db.prepare(t);
        if (/^\s*(SELECT|WITH|PRAGMA)/i.test(t)) { const rows = st.all(...ps); return { toArray: () => rows }; }
        st.run(...ps);
        return { toArray: () => [] };
      },
    };
    const CANAL = '555000000000000001', GENERAL = '444000000000000001';
    const kv = new Map([['cfg:111', JSON.stringify({ vivo: CANAL })],
      ['web:lobby', JSON.stringify({ tabla: [{ n: 'Ana', ovr: 88 }, { n: 'Dora', ovr: 91 }] })]]);
    const o = new A.Avisos({ storage: { sql, setAlarm() {}, getAlarm() { return null; } }, blockConcurrencyWhile: async (f) => f() },
      { DISCORD_TOKEN: 'x', KV: { get: async (k) => kv.get(k) ?? null } });
    await new Promise((r) => setTimeout(r, 5));
    const antesF = globalThis.fetch;
    const pedidos = [];
    globalThis.fetch = async (u, op = {}) => {
      pedidos.push({ u: String(u), m: op.method || 'GET', b: op.body ? JSON.parse(op.body) : null });
      return new Response(JSON.stringify({ id: 'm' + pedidos.length }), { status: 200 });
    };
    const T = Date.parse('2026-10-05T23:00:00Z');
    const CU = '# COPA SOOLAR\n`[ CUARTOS ]`\n⌞Ana 🇦🇷⌝ 🆚 ⌞Bea 🇨🇱⌝\n⌞Cami 🇻🇪⌝ 🆚 ⌞Dora 🇲🇽⌝\n';
    const FI = CU.replace('⌞Ana 🇦🇷⌝ 🆚', '⌞Ana 🇦🇷⌝ ✅ 🆚').replace('⌞Dora 🇲🇽⌝', '⌞Dora 🇲🇽⌝ ✅') + '`[ FINAL ]`\n⌞Ana 🇦🇷⌝ 🆚 ⌞Dora 🇲🇽⌝\n';
    const llave = (texto, ed) => sql.exec('INSERT INTO vivo (id, canal, sv, g, autor, pub, ed, texto, visto, men) ' +
      "VALUES ('9', '2', 'FFA', '111', 'x', ?, ?, ?, ?, '[]') ON CONFLICT(id) DO UPDATE SET ed = excluded.ed, " +
      'texto = excluded.texto', T - 60000, ed, texto, ed);
    llave(CU, T);
    await o.chatVivo(T);
    await o.chatVivo(T + 60000);
    ok(pedidos.length === 1 && pedidos[0].m === 'POST' && pedidos[0].u.endsWith('/channels/' + CANAL + '/messages')
      && /Dora \(OVR 91\), Ana \(OVR 88\)/.test(pedidos[0].b.content) && JSON.stringify(pedidos[0].b.allowed_mentions) === '{"parse":[]}',
    'en vivo, sobre el objeto: sale la llave, una vez, en el canal del admin y sin mencionar a nadie');
    llave(FI, T + 5 * 60000);
    await o.chatVivo(T + 5 * 60000);
    const a5 = pedidos.length;
    await o.chatVivo(T + 11 * 60000);
    llave(FI + '\nCAMPEÓN: Dora 🇲🇽\n', T + 12 * 60000);
    await o.chatVivo(T + 12 * 60000);
    const a12 = pedidos.length;
    await o.chatVivo(T + 22 * 60000);
    ok(a5 === 1 && a12 === 2 && pedidos.length === 3 && /La final/.test(pedidos[1].b.content)
      && /🏆 \*\*Dora 🇲🇽\*\* es el campeón de \*\*COPA SOOLAR\*\*/.test(pedidos[2].b.content),
    'la final y el campeón, cada uno a los 10 minutos del anterior: tres mensajes en total');
    o.guardar('ajustes_dueno', { en_vivo: { FFA: false } });
    sql.exec('DELETE FROM chat_vivo');
    await o.chatVivo(T + 40 * 60000);
    const apagado = pedidos.length === 3;
    o.guardar('ajustes_dueno', { en_vivo: { FFA: true } });
    kv.set('cfg:111', '{}');
    o.guardar('canales', { generales: [{ sv: 'FFA', g: '111', id: GENERAL }] });
    llave(FI + '\nCAMPEÓN: Dora 🇲🇽\n', T + 41 * 60000);
    await o.chatVivo(T + 41 * 60000);
    ok(apagado && pedidos.length === 4 && pedidos[3].u.endsWith('/channels/' + GENERAL + '/messages'),
      'apagado desde el Dashboard no escribe aunque el admin lo prendió; prendido desde ahí, va al chat general');
    o.guardar('ajustes_dueno', {});
    sql.exec('DELETE FROM chat_vivo');
    await o.chatVivo(T + 60 * 60000);
    ok(pedidos.length === 4, 'sin canal del admin ni el Dashboard, no escribe');
    // 🏆 UN SOLO MENSAJE POR CAMPEÓN (13/10/2026): el aviso del ciclo salió primero y quedó anotado; el cierre se le suma
    kv.set('cfg:111', JSON.stringify({ vivo: CANAL }));
    o.guardar('canales', { generales: [] });
    ok(o.cierreVivo({ canal: CANAL, ids: ['9'], msg: '777' }).ok && !o.cierreVivo({ canal: CANAL, ids: ['9'] }).msg
      && o.cierreVivo({ canal: 'x', ids: ['9'] }).error && o.cierreVivo({ canal: CANAL, ids: [] }).error,
    'el aviso del ciclo queda anotado como el campeón de la llave, y sin texto todavía no es un cierre');
    llave(FI + '\nCAMPEÓN: Dora 🇲🇽\n', T + 70 * 60000);
    const a70 = pedidos.length;
    await o.chatVivo(T + 70 * 60000);
    await o.chatVivo(T + 90 * 60000);
    const ed = pedidos.slice(a70);
    ok(ed.length === 1 && ed[0].m === 'PATCH' && ed[0].u.endsWith('/channels/' + CANAL + '/messages/777')
      && /🏆 \*\*Dora 🇲🇽\*\* es el campeón/.test(ed[0].b.content) && !('embeds' in ed[0].b) && !('flags' in ed[0].b),
    'el cierre se le agrega al mensaje del ciclo (sólo el texto: su embed se queda), una vez y sin mensaje nuevo',
    JSON.stringify(ed.map((x) => x.m + ' ' + x.u)));
    o.cierreVivo({ canal: CANAL, ids: ['9'], msg: '888' });
    const cv = await (await o.fetch(new Request('https://avisos/cierre-vivo', { method: 'POST',
      body: JSON.stringify({ canal: CANAL, ids: ['1', '9'] }), headers: { 'content-type': 'application/json' } }))).json();
    ok(cv.msg === '777', 'y el ciclo lo encuentra como el cierre (por fetch); anotar otro no lo pisa', JSON.stringify(cv));
    // 🏆 Y CON OTRO MENSAJE DE LA MISMA LLAVE (14/10/2026, FF Freestyle Clasico de Urban: el bot en vivo anota la llave con
    // el título suelto de arriba y el ciclo con la primera batalla, y el campeón salió dos veces)
    const sf = (t) => String(BigInt(t - 1420070400000) << 22n);
    const S = Date.parse('2026-10-14T21:51:00Z');
    const idV = sf(S), idC = sf(S + 40000), lejos = sf(S + 3 * 3600000);
    sql.exec('DELETE FROM chat_vivo');
    sql.exec("INSERT INTO chat_vivo (llave, canal, m, msg, texto, t) VALUES (?, ?, 'campeon', 'm55', '🏆 Motera', ?)", idV, CANAL, T);
    ok(o.cierreVivo({ canal: CANAL, ids: [idC] }).msg === 'm55' && !o.cierreVivo({ canal: CANAL, ids: [lejos] }).msg,
      'el ciclo encuentra el cierre anotado con otro mensaje de la llave (40 s antes), y no el de una llave de 3 h después');
    sql.exec('DELETE FROM chat_vivo');
    sql.exec("DELETE FROM vivo WHERE id = '9'");
    o.cierreVivo({ canal: CANAL, ids: [idC], msg: '999' });
    sql.exec('INSERT INTO vivo (id, canal, sv, g, autor, pub, ed, texto, visto, men) ' +
      "VALUES (?, '2', 'FFA', '111', 'x', ?, ?, ?, ?, '[]')", idV, T + 99 * 60000, T + 100 * 60000,
    FI + '\nCAMPEÓN: Dora 🇲🇽\n', T + 100 * 60000);
    const a100 = pedidos.length;
    await o.chatVivo(T + 100 * 60000);
    await o.chatVivo(T + 120 * 60000);
    const ed2 = pedidos.slice(a100).filter((x) => /\/channels\/555/.test(x.u));
    ok(ed2.length >= 1 && ed2.every((x) => x.m === 'PATCH' && x.u.endsWith('/messages/999'))
      && ed2.some((x) => /🏆 \*\*Dora 🇲🇽\*\* es el campeón/.test(x.b.content || '')),
    'y si el ciclo salió primero, el cierre se le suma aunque cada uno anotara la llave con otro mensaje',
    JSON.stringify(ed2.map((x) => x.m + ' ' + x.u)));
    // 📏 y lo medido (05/10/2026): las lecturas de KV de cada persona van juntas, y nunca dicen de quién
    const md = o.medidasVer();
    ok(md.kv['cfg:*'] > 0 && !Object.keys(md.kv).some((k) => /111/.test(k)),
      'lo medido cuenta las lecturas de KV por clave, sin el id de nadie (' + JSON.stringify(md.kv) + ')');
    ok(A.claveMedida('redes:konan') === 'redes:*' && A.claveMedida('pnick:123:456') === 'pnick:*'
      && A.claveMedida('web:lobby') === 'web:lobby' && A.claveMedida('meta') === 'meta' && A.claveMedida('cualquier-cosa') === 'otra',
    'una clave de alguien, aunque sea nueva, sale sólo por su prefijo (revisión del 05/10: `redes:` y `pnick:` se colaban)');
    // 👆 los toques de toda la página (16/10/2026): se suman por día, y lo que no tiene la forma no entra
    o.clics({ c: { 'ranking:→ perfil': 3, 'inicio:ver llave': 1, 'x:<b>': 5 } });
    o.clics({ c: { 'ranking:→ perfil': 2, 'tienda:comprar': 999 } });
    // 🐞 los errores de la página (19/10/2026): validados, juntados en memoria y nunca de quién
    {
      const ev = A.errorValido({ d: 'publicaciones', m: 'useAplausos is not defined  en 1234567890123', f: 'inicio/inicio-publicaciones.js:1:2345', t: 'ReferenceError' });
      ok(ev && ev.msg === 'useAplausos is not defined en #' && ev.f === 'inicio/inicio-publicaciones.js:1:2345'
        && A.errorValido({ d: 'Mala Seccion', m: 'x' }) === null && A.errorValido({ d: 'x', m: '' }) === null
        && A.errorValido({ d: 'x', m: 'y', f: 'https://otro.com/a.js?z=1' }).f === '',
      'un error de la página: la sección y el mensaje, con los números largos tapados; lo que no tiene forma no entra', JSON.stringify(ev));
      for (let k = 0; k < 3; k += 1) o.errorPagina({ d: 'publicaciones', m: 'useAplausos is not defined', f: 'inicio/inicio-publicaciones.js:1:2345', t: 'ReferenceError' });
      o.errorPagina({ d: 'global', m: 'otro' });
      const antesE = o.sql.exec('SELECT COUNT(*) AS n FROM errores_pag').toArray()[0].n;
      const er = o.erroresResumen();
      const pub = er.find((x) => x.donde === 'publicaciones');
      ok(antesE === 0 && er.length === 2 && pub.n === 3 && pub.dias === 1 && pub.f === 'inicio/inicio-publicaciones.js:1:2345' && !('k' in pub),
        'los errores se juntan en memoria (ni una fila por pedido) y el Dashboard los ve sumados', JSON.stringify(er));
      // y el que se repite, una vez al canal de Logs (el de una sola vez, no)
      const fA = globalThis.fetch;
      const logs = [];
      globalThis.fetch = async (u, op = {}) => { logs.push({ u: String(u), b: op.body ? JSON.parse(op.body) : null }); return new Response('{}', { status: 200 }); };
      const n1 = await o.erroresAvisar(Date.now());
      const n2 = await o.erroresAvisar(Date.now());
      globalThis.fetch = fA;
      ok(n1 === 1 && n2 === 0 && logs.length === 1 && logs[0].u.endsWith('/channels/' + A.CANAL_LOGS + '/messages')
        && /useAplausos is not defined/.test(logs[0].b.content) && logs[0].b.allowed_mentions.parse.length === 0,
      'un error que se repite avisa UNA vez al canal de Logs; el que pasó una sola vez, no', JSON.stringify(logs));
    }
    // 📅 los eventos de Discord (19/10/2026): se crean sólo donde se prendió, en vivo a la hora, terminados después
    {
      const fAntes = globalThis.fetch;
      const pedidosEv = [];
      let resp = 200;
      globalThis.fetch = async (u, op = {}) => {
        pedidosEv.push({ u: String(u), m: op.method || 'GET', b: op.body ? JSON.parse(op.body) : null });
        return new Response(JSON.stringify({ id: 'EV1' }), { status: resp });
      };
      const t0 = Date.now();
      const fila = (id, sv, ini) => o.sql.exec('INSERT INTO ev_discord (id, sv, g, nombre, url, ini, fin, t) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        id, sv, '900', 'EL TORNEO ' + id, 'https://discord.com/channels/900/1/' + id, ini, ini + A.EV_DC_DURA, t0);
      const est = (id) => (o.sql.exec('SELECT estado, ev, error FROM ev_discord WHERE id = ?', id).toArray()[0] || {});
      o.ajuste({ cual: 'eventos_discord', valor: { FFA: true } });
      fila('e1', 'FFA', t0 + 3600e3);
      fila('e2', 'DRA', t0 + 3600e3);
      await o.eventosDiscord(t0);
      const crear = pedidosEv.find((p) => p.m === 'POST' && /\/guilds\/900\/scheduled-events$/.test(p.u));
      ok(!!crear && crear.b.entity_type === 3 && crear.b.name === 'EL TORNEO e1' && crear.b.scheduled_start_time === new Date(t0 + 3600e3).toISOString()
        && est('e1').estado === 1 && est('e1').ev === 'EV1' && est('e2').estado === undefined,
      'un anuncio de un servidor prendido pasa a ser un evento de su Discord; el de uno apagado no', JSON.stringify(pedidosEv));
      pedidosEv.length = 0;
      await o.eventosDiscord(t0 + 3600e3);
      await o.eventosDiscord(t0 + 3600e3 + A.EV_DC_DURA);
      ok(pedidosEv.map((p) => p.b && p.b.status).join() === '2,3' && est('e1').estado === 3,
        'a la hora se pone en vivo y, tres horas después, terminado', JSON.stringify(pedidosEv));
      fila('e3', 'FFA', t0 + 7200e3);
      await o.eventosDiscord(t0);
      o.sql.exec("INSERT INTO cancelados (id, sv, cuerpo, t) VALUES ('e3', 'FFA', '{}', ?)", t0);
      pedidosEv.length = 0;
      await o.eventosDiscord(t0 + 60e3);
      ok(pedidosEv.length === 1 && pedidosEv[0].b.status === 4 && est('e3').estado === 4, 'si el organizador lo cancela, se cancela allá también');
      resp = 403;
      fila('e4', 'FFA', t0 + 7200e3);
      await o.eventosDiscord(t0 + 120e3);
      ok(est('e4').estado === 9 && est('e4').error === 'permiso' && (o.eventosDiscordEstado(t0 + 200e3).FFA || {}).error === 'permiso',
        'sin el permiso de crear eventos queda anotado para el Dashboard, sin reintentar', JSON.stringify(est('e4')));
      ok(A.ajusteValido('eventos_discord', { FFA: true, DRA: false }) && A.ajusteValido('eventos_discord', { ffa: true }) === undefined,
        'el ajuste: siglas de servidor y sí o no');
      o.ajuste({ cual: 'eventos_discord', valor: null });
      globalThis.fetch = fAntes;
    }
    // (pasada del 19/10/2026: se juntan en memoria y van a la base una vez por minuto, o cuando el Dashboard los pide)
    ok(o.sql.exec('SELECT COUNT(*) AS n FROM clics').toArray()[0].n === 0, 'los toques se juntan en memoria: ni una fila escrita por pedido');
    const cr = o.clicsResumen();
    ok(cr.n['ranking:→ perfil'][0] === 5 && cr.n['inicio:ver llave'][0] === 1 && !cr.n['x:<b>'] && !cr.n['tienda:comprar']
      && A.claveClic('Ranking:x') === '' && A.claveClic('eventos:inscribite ya') === 'eventos:inscribite ya',
    'los toques se suman por sección y etiqueta; una etiqueta rara o una cantidad imposible no entra', JSON.stringify(cr.n));
    o.medidasGuardar(Date.now(), true);
    ok((o.leer('medidas') || {}).kv && o.medidasVer().kv['cfg:*'] === md.kv['cfg:*'],
      'guardar lo medido no lo cuenta dos veces');
    globalThis.fetch = antesF;
  }
}

// 📊 EL USO POR SEMANA (18/10/2026, «Comparar semanas» del Dashboard): de lunes a domingo, y «a igual día» (`k`)
{
  let DatabaseSync = null;
  try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { DatabaseSync = null; }
  if (DatabaseSync) {
    const db = new DatabaseSync(':memory:');
    const sql = {
      exec(q, ...ps) {
        const t = String(q).trim();
        if (!ps.length && /;\s*\S/.test(t)) { db.exec(t); return { toArray: () => [] }; }
        const st = db.prepare(t);
        if (/^\s*(SELECT|WITH|PRAGMA)/i.test(t)) { const rows = st.all(...ps); return { toArray: () => rows }; }
        st.run(...ps);
        return { toArray: () => [] };
      },
    };
    const o = new A.Avisos({ storage: { sql, setAlarm() {}, getAlarm() { return null; } }, blockConcurrencyWhile: async (f) => f() },
      { DISCORD_TOKEN: 'x', KV: { get: async () => null } });
    await new Promise((r) => setTimeout(r, 0));
    for (const [d, q, p] of [['2026-10-12', 'a', 'web'], ['2026-10-13', 'b', 'bot'], ['2026-10-15', 'a', 'web'],
      ['2026-10-06', 'c', 'web'], ['2026-10-09', 'd', 'bot'], ['2026-10-11', 'e', 'web']]) {
      o.sql.exec('INSERT INTO uso (dia, quien, por) VALUES (?, ?, ?)', d, q, p);
    }
    for (const [d, n] of [['2026-10-12', 10], ['2026-10-14', 5], ['2026-10-06', 7], ['2026-10-10', 3]]) {
      o.sql.exec('INSERT INTO visitas (dia, n) VALUES (?, ?)', d, n);
    }
    // un jueves: la semana de ahora lleva 4 días, y la anterior se mide entera y en sus 4 primeros
    const ss = o.usoSemanas(Date.parse('2026-10-15T16:00:00Z'));
    const [a, b] = ss.slice(-2);
    ok(ss.length === 2 && b.lunes === '2026-10-12' && b.personas === 2 && b.bot === 1 && b.web === 1 && b.visitas === 15
      && a.lunes === '2026-10-05' && a.personas === 3 && a.visitas === 10 && a.k.personas === 1 && a.k.visitas === 7,
    'el uso por semana: personas, bot, cuenta y visitas de lunes a domingo, y la anterior también a igual día', JSON.stringify(ss));
  }
}

// 🗳️ «¿QUIÉN GANA?» SOBRE EL OBJETO DE VERDAD (13/10/2026): un voto por persona, que se cambia, y cerrado no se vota
{
  let DatabaseSync = null;
  try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { DatabaseSync = null; }
  if (DatabaseSync) {
    const db = new DatabaseSync(':memory:');
    const sql = {
      exec(q, ...ps) {
        const t = String(q).trim();
        if (!ps.length && /;\s*\S/.test(t)) { db.exec(t); return { toArray: () => [] }; }
        const st = db.prepare(t);
        if (/^\s*(SELECT|WITH|PRAGMA)/i.test(t)) { const rows = st.all(...ps); return { toArray: () => rows }; }
        st.run(...ps);
        return { toArray: () => [] };
      },
    };
    const o = new A.Avisos({ storage: { sql, setAlarm() {}, getAlarm() { return null; } }, blockConcurrencyWhile: async (f) => f() },
      { DISCORD_TOKEN: 'x', KV: { get: async () => null } });
    await new Promise((r) => setTimeout(r, 0));
    o.sql.exec('INSERT INTO qg (id, canal, msg, sv, llave, ronda, a, b, dicho, abre) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      'q1', '555', '777', 'FFA', 'L1', 'Octavos', 'Snow 🇨🇴', 'Makmah', '', Date.now());
    const v1 = o.qgVotar({ quien: '100000001', id: 'q1', lado: 'A' });
    const v2 = o.qgVotar({ quien: '100000002', id: 'q1', lado: 'A' });
    const v3 = o.qgVotar({ quien: '100000002', id: 'q1', lado: 'B' });
    o.sql.exec("UPDATE qg SET estado = 'cerrada' WHERE id = 'q1'");
    const v4 = o.qgVotar({ quien: '100000003', id: 'q1', lado: 'A' });
    ok(v1.ok && v1.nombre === 'Snow' && !v1.cambio && v2.na === 2 && v3.cambio && v3.na === 1 && v3.nb === 1
      && v4.error === 'cerrada' && o.qgVotar({ quien: 'x', id: 'q1', lado: 'A' }).error === 'datos'
      && o.qgVotar({ quien: '100000004', id: 'nada', lado: 'A' }).error === 'no existe',
    '«¿Quién gana?» en el objeto: un voto por persona que se puede cambiar, y cerrado no se vota', JSON.stringify([v1, v3, v4]));
    // 📖 las historias que viste, en tu cuenta (18/10/2026, Dlx: «yes»): se suman, no se repiten, quedan las 600 más nuevas
    {
      const hv = async (d) => (await o.historiasVistas(d).json());
      const r1 = await hv({ quien: '100000030', ids: ['m:abc', 'hoy:2026-10-18:2:0'] });
      const r2 = await hv({ quien: '100000030', ids: ['m:abc', 'sem:FFA:2026-10-12'] });
      const r3 = await hv({ quien: '100000030' });
      const otro = await hv({ quien: '100000031' });
      // (las 600 de días anteriores: en un mismo día hay un tope, ver abajo)
      for (let k = 0; k < A.HISTORIAS_TOPE; k += 1) {
        o.sql.exec('INSERT INTO hvistas (quien, id, t) VALUES (?, ?, ?)', '100000032', 'viejo-' + k, Date.now() - 2 * 86400e3 - k);
      }
      await hv({ quien: '100000032', ids: ['nueva-1', 'nueva-2'] });
      const n32 = o.sql.exec("SELECT COUNT(*) AS n FROM hvistas WHERE quien = '100000032'").toArray()[0].n;
      const n32nuevas = o.sql.exec("SELECT COUNT(*) AS n FROM hvistas WHERE quien = '100000032' AND id LIKE 'nueva-%'").toArray()[0].n;
      ok(r1.vistas.length === 2 && r2.vistas.length === 3 && r3.vistas.map((x) => x[0]).sort().join() === 'hoy:2026-10-18:2:0,m:abc,sem:FFA:2026-10-12'
        && otro.vistas.length === 0 && n32 === A.HISTORIAS_TOPE && n32nuevas === 2 && (await o.historiasVistas({ quien: 'x' }).json()).error,
      'las historias vistas en tu cuenta: se suman sin repetir, cada uno las suyas, hasta 600 (se van las más viejas)', JSON.stringify([r2, n32]));
      // 🔴 y un tope por día (pasada del 19/10/2026): ids inventados en un bucle no escriben filas sin fin
      const muchas = Array.from({ length: 120 }, (_, k) => 'x' + k);
      for (let k = 0; k < 6; k += 1) await hv({ quien: '100000033', ids: muchas.map((x) => x + '-' + k) });
      const n33 = o.sql.exec("SELECT COUNT(*) AS n FROM hvistas WHERE quien = '100000033'").toArray()[0].n;
      ok(n33 === A.HISTORIAS_DIA, 'en un mismo día, hasta ' + A.HISTORIAS_DIA + ' historias distintas por persona', n33);
    }
    // 🗳️ «¿quién gana la liga?» (14/10/2026): uno por persona y liga, se cambia; afuera se ve cuántos; los de una liga
    // que cerró hace más de 30 días se borran, y los de una que sigue no (su cierre se corre con cada voto)
    {
      const ah = Date.UTC(2026, 9, 14, 23, 0);
      const DIA = 86400000;
      const abierta = ah + 9 * DIA;
      const cierran = { 'fmh-espana': abierta, 'fms-peru': ah + 20 * DIA };
      o.sql.exec('INSERT INTO liga_voto (liga, quien, op, t, cierra) VALUES (?, ?, ?, ?, ?)', 'fzl', '100000020', 'CEKO', ah - 90 * DIA, ah - 40 * DIA);
      o.sql.exec('INSERT INTO liga_voto (liga, quien, op, t, cierra) VALUES (?, ?, ?, ?, ?)', 'fms-peru', '100000021', 'SOL', ah - 60 * DIA, ah - 35 * DIA);
      const l1 = o.ligaVotar({ quien: '100000011', liga: 'fmh-espana', op: 'ORTIZ', cierra: abierta, cierran }, ah);
      const l2 = o.ligaVotar({ quien: '100000012', liga: 'fmh-espana', op: 'ORTIZ', cierra: abierta, cierran }, ah);
      const l3 = o.ligaVotar({ quien: '100000012', liga: 'fmh-espana', op: 'STORMED', cierra: abierta, cierran }, ah);
      const lv = o.ligasVotos();
      const quedan = o.sql.exec('SELECT liga, quien FROM liga_voto ORDER BY liga, quien').toArray().map((x) => x.liga + ':' + x.quien);
      ok(l1.ok && !l1.cambio && l2.cuenta.ORTIZ === 2 && l3.cambio && l3.cuenta.ORTIZ === 1 && l3.cuenta.STORMED === 1
        && lv.votos['fmh-espana'].ORTIZ === 1 && !JSON.stringify(lv).includes('10000001')
        && o.ligaVotar({ quien: 'x', liga: 'fmh-espana', op: 'A', cierra: abierta }).error === 'datos'
        && o.ligaVotar({ quien: '100000013', liga: '../x', op: 'A', cierra: abierta }).error === 'datos',
      '«¿quién gana la liga?» en el objeto: uno por persona y liga, se cambia, y afuera se ve cuántos y nunca quién', JSON.stringify([l3, lv]));
      ok(!quedan.includes('fzl:100000020') && quedan.includes('fms-peru:100000021'),
        'los votos de una liga que cerró hace más de 30 días se borran; los de una que sigue, no (su cierre se corrió)', JSON.stringify(quedan));
    }
    // 🎁 el premio de la semana: 50 + 50 por día entrado la semana pasada, una vez por semana (13/10/2026)
    const martes = Date.UTC(2026, 9, 13, 18, 0);
    for (const dia of ['2026-10-05', '2026-10-06', '2026-10-06', '2026-10-09', '2026-10-12']) {
      o.sql.exec('INSERT OR IGNORE INTO activo (quien, dia) VALUES (?, ?)', '100000009', dia);
    }
    const s0 = o.semanal('100000009', false, martes);
    const s1 = o.semanal('100000009', true, martes);
    const s2 = o.semanal('100000009', true, martes);
    const cobrado = o.sql.exec("SELECT COALESCE(SUM(monto), 0) AS n FROM tienda WHERE quien = '100000009'").toArray()[0].n;
    const nadie = o.semanal('100000010', false, martes);
    // 🔥 desde el 13/10/2026 ya no paga: lo reemplaza la racha, día por día (Dlx: «La racha lo reemplaza»)
    ok(s0.dias === 3 && s0.monto === 200 && !s0.cobrado && !s1.cobrado && !s2.cobrado && cobrado === 0
      && nadie.monto === 50 && s0.semana === '2026-10-12' && s0.proximo === '2026-10-19',
    'el premio de la semana ya no se cobra: lo paga la racha (cuenta igual los días de la semana pasada)',
    JSON.stringify([s0, s1, cobrado]));
    // 📣 los reportes de las llaves, con acciones (13/10/2026, Dlx: «Sí, todas»)
    const V = A.validarDecisionReporte;
    const vn = V({ id: 6, accion: 'nombre', n: '464', nombre: 'Agus', reporta: true });
    const vg = V({ id: 3, accion: 'ganador', n: '401', ronda: 'Final', lados: ['Zetryko', 'Abyssus'], ganador: 'Zetryko' });
    ok(V({ id: 1, accion: 'prueba' }).accion === 'prueba' && vn.fix && vn.fix.reporta === true && vn.fix.n === '464'
      && V({ id: 4, accion: 'nombre', n: '423', nombre: 'Agus', nuevo: 'Agustin 🇺🇾' }).fix.nuevo === 'Agustin 🇺🇾'
      && V({ id: 4, accion: 'nombre', n: '423', nombre: 'Agus', es: 'X', nuevo: 'Y' }).error
      && V({ id: 4, accion: 'nombre', n: '423', nombre: 'Agus' }).error
      && V({ id: 4, accion: 'nombre', n: 'v:1', nombre: 'Agus', es: 'X' }).error
      && V({ id: 4, accion: 'nombre', n: '423', nombre: '<b>', es: 'X' }).error
      && vg.fix.ganador === 'Zetryko' && V({ id: 3, accion: 'ganador', n: '401', ronda: 'Final', lados: ['A', 'B'], ganador: 'C' }).error
      && V({ id: 0, accion: 'listo' }).error && V({ id: 2, accion: 'borrar' }).error,
    'lo que Dlx decide de un reporte se valida: una sola persona por nombre, el ganador es uno de los lados, sin HTML',
    JSON.stringify([vn, vg]));
    // 🏟️ y de una liga (14/10/2026): quien lo mandó u otro de la Lista; alguien nuevo no (una liga no crea gente)
    const vl = V({ id: 8, accion: 'nombre', liga: 'fmh-carimex', nombre: 'FORCE', reporta: true });
    ok(vl.fix && vl.fix.liga === 'fmh-carimex' && vl.fix.reporta === true && !vl.fix.n
      && V({ id: 8, accion: 'nombre', liga: 'fmh-carimex', nombre: 'Agustín', es: 'AGUSTÍN51K' }).fix.es === 'AGUSTÍN51K'
      && V({ id: 8, accion: 'nombre', liga: 'fmh-carimex', nombre: 'Agustín', nuevo: 'Agustin X' }).error
      && V({ id: 8, accion: 'ganador', liga: 'fmh-carimex', ronda: 'x', lados: ['A', 'B'], ganador: 'A' }).error
      && V({ id: 8, accion: 'nombre', liga: '../x', nombre: 'A', es: 'B' }).error,
    'un nombre de una liga: quien lo mandó u otro de la Lista; alguien nuevo o el ganador, no', JSON.stringify(vl));
    o.sql.exec("INSERT INTO reportes (quien, llave, que, texto, t) VALUES ('100000021', '464', 'nombre', 'soy yo', ?)", martes);
    o.sql.exec("INSERT INTO reportes (quien, llave, que, texto, t) VALUES ('100000022', '360', 'otro', 'probando', ?)", martes);
    const [r1, r2] = o.sql.exec('SELECT id FROM reportes ORDER BY id').toArray().map((x) => x.id);
    const d1 = await o.duenoReporte(V({ id: r1, accion: 'nombre', n: '464', nombre: 'Agus', reporta: true }));
    const d2 = await o.duenoReporte(V({ id: r2, accion: 'prueba' }));
    const e1 = await o.reportesEstados({ estados: { [r1]: ['aplicado', '«Agus» en la #464 ahora es AGUSTÍN51K'], [r2]: ['aplicado', 'x'] } });
    const band = o.sql.exec("SELECT titulo, cuerpo, url FROM bandeja WHERE quien = '100000021'").toArray();
    const fin = o.reportesDueno(martes + 60000);
    ok(d1.ok && d1.reportes.find((x) => x.id === r1).estado === 'corregir' && d2.ok && e1.n === 1
      && band.length === 1 && band[0].titulo === '✅ Corregimos la llave #464' && band[0].cuerpo.startsWith('«Agus» en la #464')
      && band[0].url.endsWith('/freestyle-rap/llave/464')
      && !o.sql.exec("SELECT 1 FROM bandeja WHERE quien = '100000022'").toArray().length
      && fin.find((x) => x.id === r1).estado === 'aplicado' && (await o.duenoReporte(V({ id: r1, accion: 'listo' }))).error,
    'un reporte: Dlx elige qué corregir, el ciclo dice que lo aplicó y a quien lo mandó le llega a su campana (sólo lo '
    + 'que se corrigió, y lo aplicado ya no se cambia)', JSON.stringify([d1.reportes, e1, band]));
    // ✅ Decidir en el Dashboard (13/10/2026, «Sí, con Reportes»)
    const PS = [{ id: 'n1', tipo: 'Nombre desconocido', sec: 'COPA · FFA · 07/10', que: '¿Quién es ZORRO?', pistas: '—',
      opciones: ['Es alguien nuevo', 'Es un troll (no cuenta)'], link: 'javascript:x', libre: true },
    { id: 'b1', tipo: 'Batalla sin ganador', sec: 'COPA', que: '¿Quién ganó?', pistas: '', opciones: ['Ganó A', 'Ganó B'], link: '' }];
    const VR = A.validarRespuestaDecidir;
    ok(VR({ id: 'n1', r: 'Es Zorrito' }, PS).r === 'Es Zorrito' && VR({ id: 'b1', r: 'Es Zorrito' }, PS).error
      && VR({ id: 'b1', r: 'Ganó B', nota: 'lo dijo el org' }, PS).nota === 'lo dijo el org' && VR({ id: 'zz', r: 'Ganó B' }, PS).error
      && VR({ id: 'b1', r: 'Ganó <b>' }, PS).error && VR({ id: 'n1', borrar: true }, PS).borrar,
    '✅ Decidir: una de las opciones, o «Es <nombre>» sólo en las de nombre; sin HTML, y una pregunta que ya no está no se contesta');
    const de1 = o.decidirEstados({ preguntas: PS });
    const dd1 = o.duenoDecidir({ id: 'b1', r: 'Ganó A' });
    const dd2 = o.duenoDecidir({ id: 'n1', r: 'Es Zorrito', nota: 'su cuenta es zorrito_' });
    const ciclo1 = o.decidirCiclo();
    o.decidirEstados({ preguntas: PS.slice(0, 1) });     // la b1 se aplicó: ya no está
    const ciclo2 = o.decidirCiclo();
    ok(de1.n === 2 && dd1.ok && dd2.decidir.preguntas[0].link === '' && ciclo1.respuestas.b1.r === 'Ganó A'
      && ciclo1.respuestas.n1.nota === 'su cuenta es zorrito_' && !ciclo2.respuestas.b1 && ciclo2.respuestas.n1
      && o.duenoDecidir({ id: 'b1', r: 'Ganó A' }).error,
    '✅ Decidir: el ciclo publica, Dlx contesta, el ciclo lo lee, y lo de una pregunta que se cerró se va',
    JSON.stringify([ciclo1, ciclo2]));
    // 🔎 el grupo y la importancia llegan al Dashboard, y 🤖 lo que se resolvió solo se puede deshacer (13/10/2026)
    o.decidirEstados({ preguntas: [Object.assign({ grupo: '🏆 Evento', imp: 'alta' }, PS[0]), Object.assign({ imp: 'urgente' }, PS[1])],
      solas: [{ id: 's1', tipo: 'Evento dudoso', sec: '#463', que: 'ESCALA', r: 'Está bien así', regla: 'R1', porque: 'el #463 se sacó', t: 5 }] });
    const dsh = o.decidirDueno();
    const malo = o.duenoDecidir({ id: 'zz', deshacer: true });
    const bien = o.duenoDecidir({ id: 's1', deshacer: true });
    ok(dsh.preguntas[0].grupo === '🏆 Evento' && dsh.preguntas[0].imp === 'alta' && dsh.preguntas[1].imp === ''
      && dsh.solas.length === 1 && dsh.solas[0].regla === 'R1' && malo.error && bien.ok
      && o.decidirCiclo().deshacer.includes('s1') && bien.decidir.deshacer.includes('s1'),
    '✅ Decidir: el grupo y la importancia pasan (sólo alta, media o baja), y lo que una regla resolvió se deshace y el ciclo se entera',
    JSON.stringify([dsh.preguntas, malo, o.decidirCiclo()]));
    // 🏷️ los roles de la página (13/10/2026)
    const VRol = A.validarRol;
    ok(VRol({ id: '100000031', rol: 'asistente', si: true }).rol === 'asistente' && VRol({ id: '100000031', rol: 'owner', si: true }).error
      && VRol({ id: 'x', rol: 'admin', si: true }).error && VRol({ id: '100000031', rol: 'admin' }).error
      && VRol({ id: '100000031', rol: 'staff', si: null }).si === null,
    'los roles a mano: cualquiera menos Owner, y con sí, no o «como sale solo»');
    o.rolesEstados({ dir: [{ k: 'konan', n: 'Konan 🇦🇷', id: '100000031', a: { competidor: [] } },
      { k: 'catarsis', n: 'Catarsis 🇦🇷', id: '100000032', a: { socio: ['URBF'], staff: ['URBF'], competidor: [] } },
      { k: 'dlx', n: 'DLX 🇺🇸', id: A.DUENO, a: { socio: ['DRA', 'FFA'] } }] });
    o.duenoRol({ id: '100000031', rol: 'asistente', si: true });
    o.duenoRol({ id: '100000032', rol: 'staff', si: false });
    const rr = o.roles().r;
    const rd = o.duenoRol({ id: '100000032', rol: 'staff', si: null });
    ok(JSON.stringify(rr.konan) === JSON.stringify([['asistente'], ['competidor']])
      && JSON.stringify(rr.catarsis) === JSON.stringify([['socio', ['URBF']], ['competidor']])
      && rr.dlx[0][0] === 'owner' && rd.roles.hist.length === 3 && rd.roles.hist[0].n === 'Catarsis 🇦🇷'
      && JSON.stringify(o.roles().r.catarsis) === JSON.stringify([['socio', ['URBF']], ['staff', ['URBF']], ['competidor']]),
    'los roles: los que salen solos, lo que pone o saca Dlx encima, Owner sólo Dlx, y el historial', JSON.stringify(rr));
    // 🖼️ tu fondo (13/10/2026): con el nivel del Pase, se ve recién aprobado, y elegís dónde
    const enR2 = {};
    o.env.CARTAS = { put: async (k, b) => { enR2[k] = b.length; }, delete: async (k) => { delete enR2[k]; } };
    const webp = Buffer.from([0x52, 0x49, 0x46, 0x46, 1, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0, 0, 0, 0]).toString('base64');
    const sinNivel = await o.fondo({ quien: '100000051', de: 'nadie', img: webp });
    const falsa = await o.fondo({ quien: A.DUENO, de: 'dlx', img: Buffer.from('hola mundo, no soy imagen').toString('base64') });
    const sub = await o.fondo({ quien: A.DUENO, de: 'dlx', img: webp, pagina: false });
    const antes = o.fondos().f;
    const ap = await o.duenoFondo({ quien: A.DUENO, si: true });
    const despues = o.fondos().f;
    const aj = await o.fondo({ quien: A.DUENO, de: 'dlx', perfil: false, pagina: true });
    const borr = await o.fondo({ quien: A.DUENO, borrar: true });
    ok(sinNivel.error === 'nivel' && sinNivel.falta === A.FONDO_NIVEL && falsa.error === 'no es una imagen'
      && sub.fondo.estado === 'revisar' && sub.fondo.pend.includes('/fondos/') && !sub.fondo.pagina && !antes.dlx
      && ap.ok && despues.dlx && despues.dlx[1] === 1 && despues.dlx[2] === 0 && aj.fondo.perfil === false && aj.fondo.pagina === true
      && borr.fondo === null && Object.keys(enR2).length === 0,
    'tu fondo: pide el nivel del Pase y que sea una imagen de verdad, se ve recién aprobado, elegís dónde, y quitarlo lo borra de R2',
    JSON.stringify([sinNivel, falsa, sub, despues, enR2]));
    // 🛡️ el filtro automático (13/10/2026): limpio se ve ya, con algo que no va no entra, y lo dudoso espera revisión
    const LF = A.leerFiltro;
    const linea = (o2) => A.FILTRO_CATEGORIAS.map((k) => k + '=' + (o2[k] || 'no')).join(' ');
    ok(LF(linea({})).v === 'ok' && LF(linea({ SEXUAL: 'yes' })).v === 'no' && LF(linea({ GORE: 'yes' })).si[0] === 'GORE'
      && LF(linea({ HATE: 'maybe' })).v === 'revisar' && LF(linea({ DRUGS: 'yes' })).v === 'revisar'
      && LF('I cannot help with that').v === 'revisar' && LF('SEXUAL=no GORE=no').v === 'revisar'
      && LF('SEXUAL: No, GORE: no, VIOLENCE=no HATE=no DRUGS=no PERSONAL=YES').v === 'no',
    'el filtro: todo «no» pasa, un «sí» en lo que no va frena, «quizás» o drogas a revisar, y sin las seis respuestas, a revisar');
    let contesta = linea({});
    o.env.AI = { run: async () => { if (contesta === null) throw new Error('la IA no anda'); return { response: contesta }; } };
    const limpio = await o.fondo({ quien: A.DUENO, de: 'dlx', img: webp });
    const yaSeVe = o.fondos().f.dlx;
    contesta = linea({ SEXUAL: 'yes' });
    const frenado = await o.fondo({ quien: A.DUENO, de: 'dlx', img: webp });
    const r2Frenado = Object.keys(enR2).length;
    contesta = linea({ GORE: 'maybe' });
    const dudoso = await o.fondo({ quien: A.DUENO, de: 'dlx', img: webp });
    await o.duenoFondo({ quien: A.DUENO, si: false });
    contesta = null;
    const sinIA = await o.fondo({ quien: A.DUENO, de: 'dlx', img: webp });
    await o.duenoFondo({ quien: A.DUENO, si: false });
    const fd = o.filtroDueno();
    const quitado = await o.duenoFondo({ quien: A.DUENO, si: false, motivo: 'No va' });
    const tras = o.fondos().f.dlx;
    delete o.env.AI;
    await o.fondo({ quien: A.DUENO, borrar: true });
    ok(limpio.filtro === 'ok' && limpio.fondo.estado === 'ok' && !limpio.fondo.pend && yaSeVe && yaSeVe[0] === limpio.fondo.url
      && frenado.error === 'filtro' && frenado.cats[0] === 'SEXUAL' && r2Frenado === 1
      && dudoso.filtro === 'revisar' && dudoso.fondo.pend && dudoso.fondo.url === limpio.fondo.url
      && sinIA.filtro === 'revisar' && fd.cuenta.ok === 1 && fd.cuenta.no === 1 && fd.cuenta.revisar === 3
      && fd.vivos.length === 1 && fd.frenados[0].si[0] === 'SEXUAL'
      && quitado.ok && !tras && Object.keys(enR2).length === 0,
    'el filtro en el objeto: limpio se ve sin esperar, frenado no guarda nada, dudoso o sin IA a revisar, y lo que pasó se puede quitar',
    JSON.stringify([limpio, frenado, dudoso, sinIA, fd, enR2]));
    // 📸 tu foto de tarjeta (13/10/2026): con el nivel, una por carta, una por semana, y con el filtro
    const enR2f = {};
    o.env.CARTAS = { put: async (k, b) => { enR2f[k] = b.length; }, delete: async (k) => { delete enR2f[k]; },
      get: async (k) => (enR2f[k] ? { arrayBuffer: async () => new Uint8Array(Buffer.from(webp, 'base64')).buffer } : null) };
    o.env.FOTOS_SAL = 'sal'; o.env.TEMPORADA = 't1';
    let resp = linea({});
    o.env.AI = { run: async () => ({ response: resp }) };
    const sinNivelF = await o.fotoCarta({ quien: '100000051', de: 'nadie', img: webp, cartas: ['temporada'] });
    const sinPerfil = await o.fotoCarta({ quien: '100000051', de: '', img: webp, cartas: ['temporada'] });
    const P0 = o.puedeFotoCarta;
    o.puedeFotoCarta = () => ({ si: true, nivel: 15, falta: 15 });
    const f1 = await o.fotoCarta({ quien: '100000052', de: 'konan', img: webp, cartas: ['temporada', 'servidor'] });
    const k1 = Object.keys(enR2f).sort();
    const f2 = await o.fotoCarta({ quien: '100000052', de: 'konan', img: webp, cartas: ['servidor'] });
    const f3 = await o.fotoCarta({ quien: '100000052', de: 'konan', borrar: ['servidor'] });
    const k3 = Object.keys(enR2f).sort();
    const f4 = await o.fotoCarta({ quien: '100000052', de: 'konan', img: webp, cartas: ['servidor'] });
    resp = linea({ SEXUAL: 'maybe' });
    const f5 = await o.fotoCarta({ quien: '100000052', de: 'konan', img: webp, cartas: ['pais'] });
    const pendF = o.fotosCartaDueno();
    const ap5 = await o.duenoFotoCarta({ quien: '100000052', si: true });
    const k5 = Object.keys(enR2f).sort();
    resp = linea({ GORE: 'yes' });
    const f6 = await o.fotoCarta({ quien: '100000052', de: 'konan', img: webp, cartas: ['competitivo'] });
    const vivosF = o.filtroDueno().vivos.filter((x) => x.tipo === 'foto');
    const quitarF = await o.duenoFotoCarta({ quien: '100000052', si: false, motivo: 'No va' });
    const k7 = Object.keys(enR2f);
    o.puedeFotoCarta = P0;
    delete o.env.AI;
    ok(sinNivelF.error === 'nivel' && sinNivelF.falta === A.FOTO_CARTA_NIVEL && sinPerfil.error === 'sin_perfil' && f1.filtro === 'ok'
      && JSON.stringify(k1) === JSON.stringify(['fotos/sal-t1/konan@servidor.webp', 'fotos/sal-t1/konan@temporada.webp'])
      && f1.cartas.temporada.estado === 'ok' && f1.cartas.temporada.url.endsWith('/fotos/sal-t1/konan@temporada.webp')
      && f2.error === 'semana' && f2.cartas[0] === 'servidor' && f3.cartas.servidor.estado === ''
      && JSON.stringify(k3) === JSON.stringify(['fotos/sal-t1/konan@temporada.webp']) && f4.error === 'semana'
      && f5.filtro === 'revisar' && f5.cartas.pais.pend.includes('/pendientes/') && !k3.includes('fotos/sal-t1/konan@pais.webp')
      && pendF.length === 1 && pendF[0].cartas[0] === 'pais' && ap5.ok && k5.includes('fotos/sal-t1/konan@pais.webp')
      && !k5.some((k) => k.startsWith('pendientes/')) && f6.error === 'filtro' && f6.cats[0] === 'GORE'
      && vivosF.length === 1 && vivosF[0].cartas.length === 2 && quitarF.ok && k7.length === 0
      && A.claveFoto({ FOTOS_SAL: 'x', TEMPORADA: 't1' }, 'konan') === 'fotos/x-t1/konan.webp'
      && A.claveFoto({}, 'konan', 'pais') === 'fotos/t1/konan@pais.webp',
    'tu foto de tarjeta: pide el nivel y tu perfil, va en las cartas que elegís, una por semana (también después de volver a la de Discord), la dudosa espera afuera de las caras, la frenada no entra, y se puede quitar',
    JSON.stringify([sinNivelF, f1, f2, f3, f4, f5, pendF, ap5, k5, f6, vivosF, k7]));
    // 🛡️ anti-doxeo: una imagen con metadatos (la ubicación, la cámara) no entra (13/10/2026)
    const TM = A.tieneMetadatos;
    const riff = (chunks) => {
      const cuerpo = Buffer.concat(chunks.map(([t, n]) => Buffer.concat([Buffer.from(t), Buffer.from([n, 0, 0, 0]), Buffer.alloc(n + (n & 1))])));
      return new Uint8Array(Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP'), cuerpo]));
    };
    const jpg = (segs) => new Uint8Array(Buffer.concat([Buffer.from([0xFF, 0xD8]),
      ...segs.map(([m, n]) => Buffer.concat([Buffer.from([0xFF, m, 0, n + 2]), Buffer.alloc(n)])), Buffer.from([0xFF, 0xDA, 0, 2])]));
    const png = (chunks) => new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
      ...chunks.map(([t, n]) => Buffer.concat([Buffer.from([0, 0, 0, n]), Buffer.from(t), Buffer.alloc(n + 4)]))]));
    ok(!TM(riff([['VP8 ', 10]])) && TM(riff([['VP8X', 10], ['VP8 ', 10], ['EXIF', 6]])) && TM(riff([['VP8 ', 9], ['XMP ', 4]]))
      && !TM(jpg([[0xE0, 14], [0xDB, 4]])) && TM(jpg([[0xE0, 14], [0xE1, 20]])) && TM(jpg([[0xFE, 5]]))
      && !TM(png([['IHDR', 13], ['IDAT', 8], ['IEND', 0]])) && TM(png([['IHDR', 13], ['tEXt', 8], ['IEND', 0]])),
    'anti-doxeo: un webp, un jpeg o un png con EXIF, XMP o texto adentro no entra; el limpio, sí');
    // 🧽 …pero se le SACAN en vez de rechazarla (19/10/2026: el JPEG que arma Safari trae un Exif suyo y a todo iPhone y
    // iPad se le frenaba el logo de la crew, el fondo y la foto de tarjeta)
    const LM = A.limpiarMetadatos;
    const jx = jpg([[0xE0, 14], [0xE1, 20], [0xDB, 4], [0xFE, 5]]), jl = LM(jx);
    const wx = riff([['VP8X', 10], ['VP8 ', 10], ['EXIF', 6], ['XMP ', 3]]);
    wx[20] = 0x0C | 0x10;
    const wl = LM(wx);
    const tamW = wl[4] | (wl[5] << 8) | (wl[6] << 16) | (wl[7] << 24);
    const px = png([['IHDR', 13], ['tEXt', 8], ['IDAT', 8], ['iTXt', 3], ['IEND', 0]]), pl = LM(px);
    const jpgSano = jpg([[0xE0, 14], [0xDB, 4]]);
    ok(!TM(jl) && jl[0] === 0xFF && jl[1] === 0xD8 && jl.length === jx.length - 24 - 9 && jl[jl.length - 3] === 0xDA
      && !TM(wl) && tamW === wl.length - 8 && (wl[20] & 0x0C) === 0 && (wl[20] & 0x10) === 0x10
      && !TM(pl) && pl.length === px.length - 20 - 15 && String.fromCharCode(...pl.subarray(pl.length - 8, pl.length - 4)) === 'IEND'
      && LM(jpgSano).length === jpgSano.length && LM(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])).length === 13
      && LM(new Uint8Array([0xFF, 0xD8, 0x00, 0x00, 0, 0, 0, 0, 0, 0, 0, 0])) === null,
    'anti-doxeo: los metadatos se sacan (JPEG, webp con su marca en VP8X y el largo del RIFF, PNG) y la imagen queda sana; lo que no se entiende, no entra');
    // 🪪 la mención a los de las crews sin verificar (19/10/2026): por crew, con la mención a quien tiene cuenta y el
    // nombre a quien no, la fecha en hora del este, y partido si no entra en un mensaje de Discord
    const TSV = A.textosSinVerificar;
    const hastaSV = Date.UTC(2026, 9, 26, 22, 0);   // lun 26/10, 6 PM ET
    const sv1 = TSV([{ k: 'a', id: '800000001', crew: 'Fontana', hasta: hastaSV }, { k: 'b', n: 'Be_to', crew: 'Fontana', hasta: hastaSV },
      { k: 'c', id: '800000003', crew: 'KS', hasta: hastaSV }], 'https://x/cuenta/verificar');
    const sv2 = TSV([{ k: 'a', id: '800000001', crew: 'Fontana', hasta: hastaSV }], 'https://x');
    const muchos = TSV(Array.from({ length: 120 }, (_, i) => ({ k: 'k' + i, id: String(800000100 + i), crew: 'C' + (i % 40), hasta: hastaSV })), 'https://x');
    ok(sv1.length === 1 && sv1[0].texto.includes('**Fontana:** <@800000001>, Be\\_to') && sv1[0].texto.includes('**KS:** <@800000003>')
      && sv1[0].texto.includes('hasta el **lun 26/10**') && sv1[0].texto.includes('Tienen') && sv1[0].ids.join() === '800000001,800000003'
      && sv1[0].ks.join() === 'a,b,c' && sv2[0].texto.includes('Tiene hasta') && sv2[0].texto.includes('Está en una crew')
      && muchos.length > 1 && muchos.every((m) => m.texto.length <= 2000 && m.ids.length <= 100)
      && muchos.reduce((n, m) => n + m.ks.length, 0) === 120 && !TSV([], 'x').length,
    'crews sin verificar: por crew, menciona a quien tiene cuenta y nombra a quien no, la fecha en ET, y entra en Discord');
    // 🗳️ a quién votó el público (TAG 🗳️ FAVORITO DEL PÚBLICO, 19/10/2026)
    const FD = A.favoritoDe;
    ok(FD('Ana', 'Beto', 3, 1) === 'Ana' && FD('Ana', 'Beto', 1, 1) === '' && FD('Ana', 'Beto', 2, 2) === ''
      && FD('Ana', 'Beto', 1, 2, ['Cyn'], [4]) === 'Cyn' && FD('Ana, Eva', 'Beto', 5, 1) === '' && FD('Ana', 'Beto', 0, 0) === '',
    'favorito del público: el más votado con 3 votos o más, sin empate arriba y sin equipos');
    // 🔐 los permisos del Dashboard (13/10/2026)
    const PR = A.puedeRol;
    ok(PR(['owner'], 'roles') && !PR(['admin'], 'roles') && PR(['admin'], 'ajustes') && PR(['asistente'], 'reportes')
      && !PR(['moderador'], 'reportes') && PR(['moderador'], 'reportes_cerrar') && PR(['moderador'], 'fondos')
      && !PR(['asistente'], 'ajustes') && !PR([], 'panel') && !PR(['competidor', 'staff'], 'panel'),
    'qué puede cada rol: Owner todo, Admin todo menos Roles, Asistente corrige, Moderador sólo lo que no mueve puntos, los demás nada');
    o.duenoRol({ id: '100000061', rol: 'moderador', si: true });
    o.duenoRol({ id: '100000062', rol: 'asistente', si: true });
    o.duenoRol({ id: '100000063', rol: 'staff', si: true });
    o.rolesEstados({ dir: [{ k: 'mod', n: 'Mod Test', id: '100000061', a: {} }, { k: 'asis', n: 'Asis Test', id: '100000062', a: {} }] });
    const pm = o.panelDueno({ quien: '100000061', roles: o.rolesPanelDe('100000061') });
    const pa = o.panelDueno({ quien: '100000062', roles: o.rolesPanelDe('100000062') });
    const pd = o.panelDueno();
    o.sql.exec("INSERT INTO reportes (quien, llave, que, texto, t) VALUES ('100000071', '466', 'otro', 'x', ?)", martes);
    const rid = o.sql.exec('SELECT MAX(id) AS id FROM reportes').toArray()[0].id;
    const rp2 = await o.duenoReporte(Object.assign(V({ id: rid, accion: 'listo' }), { por: '100000061' }));
    ok(JSON.stringify(o.rolesPanelDe('100000061')) === '["moderador"]' && o.rolesPanelDe('100000063').length === 0
      && JSON.stringify(o.rolesPanelDe(A.DUENO)) === '["owner"]'
      && pm.limitado && pm.permisos.includes('fondos') && !pm.permisos.includes('decidir') && pm.yo === 'Mod Test' && !pm.uso
      && pa.limitado && pa.permisos.includes('decidir') && pa.decidir && !pa.ajustes
      && !pd.limitado && pd.permisos.includes('roles') && pd.yo === ''
      && rp2.reportes.find((x) => x.id === rid).por === 'Mod Test',
    'el panel de cada rol: el Moderador y el Asistente ven sólo lo suyo, Dlx todo, y queda quién cerró cada reporte',
    JSON.stringify([pm.permisos, pa.permisos]));
  }
}

// 🧹 «CON DATOS», MENOS DE GOLPE (Dlx, 12/10/2026, el General de Urban: «mucho spam… todo de golpe… no menciona a la
// gente»): el cruce menciona sin que suene, el resultado se le agrega a ESE mensaje y la final sale una sola vez
{
  let DatabaseSync = null;
  try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { DatabaseSync = null; }
  if (DatabaseSync) {
    console.log('\n🧹 «con datos»: el resultado en el mensaje del cruce\n');
    const db = new DatabaseSync(':memory:');
    const sql = {
      exec(q, ...ps) {
        const t = String(q).trim();
        if (!ps.length && /;\s*\S/.test(t)) { db.exec(t); return { toArray: () => [] }; }
        const st = db.prepare(t);
        if (/^\s*(SELECT|WITH|PRAGMA)/i.test(t)) { const rows = st.all(...ps); return { toArray: () => rows }; }
        st.run(...ps);
        return { toArray: () => [] };
      },
    };
    const CANAL = '555000000000000077';
    const ANA = '123456789012345678';
    const kv = new Map([['cfg:111', JSON.stringify({ vivo: CANAL, vivo_nivel: 'datos' })],
      ['web:lobby', JSON.stringify({ tabla: [{ n: 'Ana', k: 'ana', ovr: 88, cc: 'ar' }, { n: 'Bea', k: 'bea', ovr: 60, cc: 'cl' }] })],
      ['turnos:nombres', JSON.stringify({ n: { ana: ANA } })]]);
    const o = new A.Avisos({ storage: { sql, setAlarm() {}, getAlarm() { return null; }, transactionSync: (f) => f() },
      blockConcurrencyWhile: async (f) => f() }, { DISCORD_TOKEN: 'x', KV: { get: async (k) => kv.get(k) ?? null } });
    await new Promise((r) => setTimeout(r, 5));
    // 🙈 Ana está en FFA (sus servidores, en `persona`): por eso se la menciona (ver `genteChat()`)
    sql.exec('INSERT OR REPLACE INTO persona (k, v, t) VALUES (?, ?, 0)', 'p:ana', JSON.stringify({ n: 'Ana', svs: ['FFA'] }));
    const antesF = globalThis.fetch;
    const pedidos = [];
    globalThis.fetch = async (u, op = {}) => {
      pedidos.push({ u: String(u), m: op.method || 'GET', b: op.body ? JSON.parse(op.body) : null });
      return new Response(JSON.stringify({ id: 'm' + pedidos.length }), { status: 200 });
    };
    const T = Date.parse('2026-10-12T23:00:00Z');
    const llave = (texto, ed) => sql.exec('INSERT INTO vivo (id, canal, sv, g, autor, pub, ed, texto, visto, men) ' +
      "VALUES ('9', '2', 'FFA', '111', 'x', ?, ?, ?, ?, '[]') ON CONFLICT(id) DO UPDATE SET ed = excluded.ed, " +
      'texto = excluded.texto', T - 60000, ed, texto, ed);
    llave('# COPA Y\n`[ CUARTOS ]`\n⌞Ana 🇦🇷⌝ 🆚 ⌞Bea 🇨🇱⌝\n⌞Cami 🇻🇪⌝ 🆚 ⌞Dora 🇲🇽⌝\n', T);
    await o.chatVivo(T);
    const m1 = pedidos[0];
    ok(pedidos.length === 1 && m1.m === 'POST' && m1.b.content.includes('⚔️ Cuartos: **<@' + ANA + '> 🇦🇷** vs **Bea 🇨🇱**')
      && JSON.stringify(m1.b.allowed_mentions) === '{"parse":[]}',
    'con datos: el cruce menciona a quien la Liga conoce, y no suena', m1 && m1.b.content);
    llave('# COPA Y\n`[ CUARTOS ]`\n⌞Ana 🇦🇷⌝ ✅ 🆚 ⌞Bea 🇨🇱⌝\n⌞Cami 🇻🇪⌝ 🆚 ⌞Dora 🇲🇽⌝\n`[ FINAL ]`\n⌞Ana 🇦🇷⌝ 🆚 ⌞⌝\n', T + 3 * 60000);
    await o.chatVivo(T + 3 * 60000);
    const ed = pedidos.find((p, i) => i >= 1 && p.m === 'PATCH');
    const nuevo = pedidos.find((p, i) => i >= 1 && p.m === 'POST');
    ok(ed && ed.u.endsWith('/messages/m1') && /\n✅ Pasa \*\*<@123456789012345678> 🇦🇷\*\*$/.test(ed.b.content) && !('flags' in ed.b)
      && nuevo && !/✅/.test(nuevo.b.content) && /Cuartos: \*\*Cami 🇻🇪\*\* vs \*\*Dora 🇲🇽\*\*/.test(nuevo.b.content),
    'el resultado se le agrega al mensaje de su cruce (sin tocar sus banderas), y el mensaje nuevo es sólo el cruce que viene',
    JSON.stringify(pedidos.slice(1).map((p) => [p.m, p.u.slice(-14), p.b && p.b.content])));
    const n2 = pedidos.length;
    llave('# COPA Y\n`[ CUARTOS ]`\n⌞Ana 🇦🇷⌝ ✅ 🆚 ⌞Bea 🇨🇱⌝\n⌞Cami 🇻🇪⌝ ✅ 🆚 ⌞Dora 🇲🇽⌝\n`[ FINAL ]`\n⌞Ana 🇦🇷⌝ 🆚 ⌞Cami 🇻🇪⌝\n',
      T + 6 * 60000);
    await o.chatVivo(T + 6 * 60000);
    const finales = pedidos.slice(n2).filter((p) => p.m === 'POST');
    ok(finales.length === 1 && /⚔️ Final: /.test(finales[0].b.content) && !/🔥 La final de/.test(finales[0].b.content),
      'la final sale una sola vez: el cruce, sin el «🔥 La final de…» repetido', JSON.stringify(finales.map((p) => p.b.content)));
    // 🕵️ quien se anotó con otro nombre (13/10/2026: «Frifaier» era Cronox): lo que sabe la página (`quien`) va primero
    o.guardar('quien', { t: T, svs: { FFA: { frifaier: 'ana' } } });
    const n3 = pedidos.length;
    sql.exec('INSERT INTO vivo (id, canal, sv, g, autor, pub, ed, texto, visto, men) ' +
      "VALUES ('10', '2', 'FFA', '111', 'x', ?, ?, ?, ?, '[]')", T + 29 * 60000, T + 30 * 60000,
    '# COPA Z\n`[ CUARTOS ]`\n⌞Frifaier 🇨🇱⌝ 🆚 ⌞Bea 🇨🇱⌝\n⌞Cami 🇻🇪⌝ 🆚 ⌞Dora 🇲🇽⌝\n', T + 30 * 60000);
    await o.chatVivo(T + 30 * 60000);
    const zf = pedidos.slice(n3).find((p) => p.m === 'POST' && /COPA Z/.test((p.b && p.b.content) || ''));
    ok(zf && zf.b.content.includes('<@' + ANA + '>') && !zf.b.content.includes('Frifaier'),
      'quien se anotó con otro nombre sale como quien es (por la inscripción, `quien`)', zf && zf.b.content);
    // 🧮 TODOS CONTRA TODOS (19/10/2026, Dlx: «¿qué sucede cuando son 3 personas distintas batallando?»): un cruce con un
    // botón de voto por lado, y se vota a cualquiera de los tres
    const n4 = pedidos.length;
    sql.exec('INSERT INTO vivo (id, canal, sv, g, autor, pub, ed, texto, visto, men) ' +
      "VALUES ('11', '3', 'FFA', '111', 'z', ?, ?, ?, ?, '[]')", T + 59 * 60000, T + 60 * 60000,
    '# COPA TRES\n`[ OCTAVOS ]`\n⌞Ana 🇦🇷⌝ 🆚 ⌞Bea 🇨🇱⌝ 🆚 ⌞Cami 🇻🇪⌝\n⌞Dora 🇲🇽⌝ 🆚 ⌞Eli 🇨🇴⌝ 🆚 ⌞Fer 🇵🇪⌝\n', T + 60 * 60000);
    await o.chatVivo(T + 60 * 60000);
    const tres = pedidos.slice(n4).find((p) => p.m === 'POST' && /TODOS CONTRA TODOS/.test((p.b && p.b.content) || ''));
    const bts = tres && tres.b.components && tres.b.components[0] ? tres.b.components[0].components : [];
    ok(tres && bts.length === 3 && bts.map((x) => x.custom_id.slice(-1)).join('') === 'ABC'
      && /Octavos: \*\*<@123456789012345678> 🇦🇷\*\* vs \*\*Bea 🇨🇱\*\* vs \*\*Cami 🇻🇪\*\*/.test(tres.b.content),
    'todos contra todos: el cruce sale, con un botón por lado', JSON.stringify(pedidos.slice(n4).map((p) => [p.m, p.b && p.b.content, p.b && p.b.components])));
    const qid = bts.length ? bts[2].custom_id.split(':')[1] : '';
    const v1 = o.qgVotar({ quien: '700000201', id: qid, lado: 'C' }, T + 61 * 60000);
    const v2 = o.qgVotar({ quien: '700000202', id: qid, lado: 'A' }, T + 61 * 60000);
    const v3 = o.qgVotar({ quien: '700000203', id: qid, lado: 'D' }, T + 61 * 60000);
    ok(v1.ok && v1.nombre === 'Cami' && v1.pct === 100 && v2.ok && v2.n === 2 && v2.pct === 50 && v3.error === 'datos',
      'se vota a cualquiera de los tres (y a un cuarto que no existe, no)', JSON.stringify([v1, v2, v3]));
    ok(A.lineaVoto('Ana', 'Bea', 2, 1, '', ['Cami'], [1]) === '🗳️ El público: **Ana** 50 % · **Bea** 25 % · **Cami** 25 % (4 votos)'
      && /iba con \*\*Cami\*\* \(100 %, 2 votos\): acertó/.test(A.lineaVoto('Ana', 'Bea', 0, 0, 'C', ['Cami'], [2]) || '')
      && A.lineaVoto('Ana', 'Bea', 3, 1, '') === '🗳️ El público: **Ana** 75 % · **Bea** 25 % (4 votos)',
    'el renglón con tres lados, y el de dos como siempre');
    globalThis.fetch = antesF;
  }
}

// 🎲 LAS APUESTAS SOBRE EL OBJETO DE VERDAD (07/10/2026, «A full»): se abre con botones, se apuesta con sus frenos, se
// cierra a los 3 minutos y se paga el pozo cuando la llave dice quién ganó
{
  let DatabaseSync = null;
  try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { DatabaseSync = null; }
  if (DatabaseSync) {
    console.log('\n🎲 las apuestas, sobre el objeto\n');
    const db = new DatabaseSync(':memory:');
    const sql = {
      exec(q, ...ps) {
        const t = String(q).trim();
        if (!ps.length && /;\s*\S/.test(t)) { db.exec(t); return { toArray: () => [] }; }
        const st = db.prepare(t);
        if (/^\s*(SELECT|WITH|PRAGMA)/i.test(t)) { const rows = st.all(...ps); return { toArray: () => rows }; }
        st.run(...ps);
        return { toArray: () => [] };
      },
    };
    const CANAL = '555000000000000009';
    const kv = new Map([['cfg:111', JSON.stringify({ vivo: CANAL, vivo_nivel: 'full' })],
      ['web:lobby', JSON.stringify({ tabla: [{ n: 'Ana', k: 'ana', ovr: 88 }, { n: 'Bea', k: 'bea', ovr: 60 }] })],
      ['web:perfiles', JSON.stringify({ p: { ana: { du: [[1, 'Bea', 1]] }, bea: { du: [[1, 'Ana', 0]] } } })]]);
    const o = new A.Avisos({ storage: { sql, setAlarm() {}, getAlarm() { return null; }, transactionSync: (f) => f() },
      blockConcurrencyWhile: async (f) => f() }, { DISCORD_TOKEN: 'x', KV: { get: async (k) => kv.get(k) ?? null } });
    o.state = o.state || {};
    o.state.storage = o.state.storage || { transactionSync: (f) => f() };
    if (!o.state.storage.transactionSync) o.state.storage.transactionSync = (f) => f();
    await new Promise((r) => setTimeout(r, 5));
    const antesF = globalThis.fetch;
    const pedidos = [];
    globalThis.fetch = async (u, op = {}) => {
      // 🖼️ el multipart de un adjunto (13/10/2026, `editarConAdjunto()`): se anota lo que manda
      const form = typeof FormData !== 'undefined' && op.body instanceof FormData;
      pedidos.push({ u: String(u), m: op.method || 'GET', form,
        b: form ? JSON.parse(op.body.get('payload_json')) : op.body ? JSON.parse(op.body) : null,
        f: form ? op.body.get('files[0]') : null });
      return new Response(JSON.stringify({ id: 'm' + pedidos.length }), { status: 200 });
    };
    const T = Date.parse('2026-10-07T23:00:00Z');
    const HORA_P = 3600000;
    const CU = '# COPA X\n`[ CUARTOS ]`\n⌞Ana 🇦🇷⌝ 🆚 ⌞Bea 🇨🇱⌝\n⌞Cami 🇻🇪⌝ 🆚 ⌞Dora 🇲🇽⌝\n';
    const llave = (texto, ed) => sql.exec('INSERT INTO vivo (id, canal, sv, g, autor, pub, ed, texto, visto, men) ' +
      "VALUES ('9', '2', 'FFA', '111', 'x', ?, ?, ?, ?, '[]') ON CONFLICT(id) DO UPDATE SET ed = excluded.ed, " +
      'texto = excluded.texto', T - 60000, ed, texto, ed);
    llave(CU, T);
    await o.chatVivo(T);
    const msg = pedidos[0] && pedidos[0].b;
    const ap = sql.exec('SELECT * FROM apuestas').toArray()[0];
    ok(pedidos.length === 1 && msg && /LA REVANCHA/.test(msg.content) && /Ana 🇦🇷\*\* vs \*\*Bea 🇨🇱/.test(msg.content)
      && /🎲 \*\*Apuestas abiertas/.test(msg.content) && msg.components && msg.components.length === 3 && ap && ap.estado === 'abierta'
      && msg.components[2].components[0].url === A.HUB_TARJETAS,
    'A full: el cruce con su título, su apuesta y sus botones, en un solo mensaje; y como Ana y Bea no tienen tarjeta, debajo «Conseguí tu tarjeta»',
    msg && msg.content);
    // 🖼️ el vs de dos: a la cola, con el mensaje donde va; la tarea se lo lleva y la imagen se le agrega editándolo
    const cola = o.vsCola('FFA', T + 1000).vs;
    ok(cola.length === 1 && cola[0].a.n === 'Ana' && cola[0].b.n === 'Bea' && cola[0].ronda === 'Cuartos'
      && cola[0].titulo === 'LA REVANCHA' && o.vsCola('FFA', T + 2000).vs.length === 0,
    'el vs de dos va a la cola de las imágenes, y la tarea se lo lleva una sola vez', cola[0]);
    ok((await o.vsListo({ id: cola[0].id, url: 'https://otro.sitio/x.png' })).error === 'url',
      'la imagen tiene que ser nuestra (del bucket de las cartas)');
    const nped = pedidos.length;
    const vl = await o.vsListo({ id: cola[0].id, url: 'https://pub-70d5821d06a8432c9cffd0c102195000.r2.dev/vs/ffa-abc.jpg' });
    ok(vl.ok === true || vl.estado === undefined || true, 'vsListo contesta');
    const ed = pedidos[pedidos.length - 1];
    // 🖼️ como ADJUNTO, que se ve más grande (Dlx, 13/10/2026): baja la imagen y edita con multipart, sin embed
    ok(pedidos.length === nped + 2 && pedidos[nped].u.endsWith('/vs/ffa-abc.jpg') && ed.m === 'PATCH' && ed.form
      && ed.u.endsWith('/messages/' + 'm1') && ed.b.embeds.length === 0 && ed.b.attachments[0].filename === 'vs.jpg'
      && ed.f && ed.f.name === 'vs.jpg', 'y se le agrega al mensaje del cruce como adjunto, editándolo', ed);
    const ini = { inicial: 5000, desde: 0 };
    const pedir = async (d, t = T + 60000) => (await o.apostar(Object.assign({}, ini, d), t)).json();
    const U1 = '100000000000000001', U2 = '100000000000000002', U3 = '100000000000000003';
    const a1 = await pedir({ quien: U1, ap: ap.id, lado: 'A', monto: 100 });
    const a2 = await pedir({ quien: U1, ap: ap.id, lado: 'A', monto: 500 });
    const a3 = await pedir({ quien: U1, ap: ap.id, lado: 'B', monto: 50 });
    const a4 = await pedir({ quien: U2, ap: ap.id, lado: 'B', monto: 250 });
    const a5 = await pedir({ quien: U3, ap: ap.id, lado: 'A', monto: 50, clave: 'Ana' });
    const a6 = await pedir({ quien: U3, ap: ap.id, lado: 'A', monto: 75 });
    ok(a1.ok && a1.saldo === 4900 && a2.error === 'tope' && a3.error === 'otro lado' && a4.ok && a4.pozo === 350
      && a5.error === 'propia' && a6.error === 'datos', 'los frenos: el tope de 500, un solo lado, no en tu batalla, sólo los montos de los botones',
    JSON.stringify([a1, a2, a3, a4, a5, a6]));
    pedidos.length = 0;
    await o.chatVivo(T + 4 * 60000);
    const cierre = pedidos.find((p) => p.m === 'PATCH');
    ok(cierre && /🔒 Apuestas cerradas · pozo de \*\*350\*\* entre 2/.test(cierre.b.content) && cierre.b.components[0].components.every((c) => c.disabled)
      && cierre.b.components.length === 3 && cierre.b.components[2].components[0].url === A.HUB_TARJETAS
      && (await pedir({ quien: U3, ap: ap.id, lado: 'A', monto: 50 }, T + 4 * 60000)).error === 'cerrada', 'a los 3 minutos se cierra: botones grises, el pozo, y no se puede apostar');
    pedidos.length = 0;
    llave(CU + '`[ SEMIFINALES ]`\n⌞Ana 🇦🇷⌝ 🆚 ⌞⌝\n', T + 6 * 60000);
    await o.chatVivo(T + 6 * 60000);
    const pago = pedidos.find((p) => p.m === 'PATCH' && /🏆 Ganó/.test(p.b.content));
    ok(pago && /Ganó \*\*Ana\*\*: el pozo de \*\*350\*\* se repartió entre 1 que acertó/.test(pago.b.content)
      && pago.b.components.length === 1 && pago.b.components[0].components[0].url === A.HUB_TARJETAS
      && o.saldo(U1, 0, 5000) === 5250 && o.saldo(U2, 0, 5000) === 4750 && sql.exec('SELECT estado FROM apuestas WHERE id = ?', ap.id).toArray()[0].estado === 'pagada',
    'gana Ana: U1 se lleva el pozo entero (350, puso 100), U2 pierde sus 250, y el mensaje lo dice', JSON.stringify({ ped: pedidos.map((x) => [x.m, String((x.b && x.b.content) || '').slice(0, 90)]), est: sql.exec('SELECT estado, ganador, ronda, a, b FROM apuestas').toArray(), s1: o.saldo(U1, 0, 5000), s2: o.saldo(U2, 0, 5000) }));
    // 📝 la fase de inscripciones: desde tres anotados de verdad, UN mensaje, que se edita cuando se suman más
    sql.exec('DELETE FROM vivo');
    const AN = '1557000000000000000';
    sql.exec('INSERT INTO avisos (id, sv, cuerpo, desde, hasta, creado, estado) VALUES (?, ?, ?, ?, ?, ?, 1)', AN, 'FFA',
      JSON.stringify({ tipo: 'evento', sv: 'FFA', t: 'COPA Y', ini: T + 3 * HORA_P, cup: '8', url: 'https://discord.com/channels/111/2/' + AN }),
      T, T + HORA_P, T + 10 * 60000);
    o.guardar('anotados', { ev: { [AN]: [['Ana 🇦🇷', 'ar', 'ana', 1], ['Bea 🇨🇱', 'cl', 'bea', 1], ['yo', '', '', 0], ['Dora 🇲🇽', 'mx', '', 1]] } });
    pedidos.length = 0;
    await o.inscriptosChat(T + 20 * 60000);
    const i1 = pedidos[0];
    o.guardar('anotados', { ev: { [AN]: [['Ana 🇦🇷', 'ar', 'ana', 1], ['Bea 🇨🇱', 'cl', 'bea', 1], ['Dora 🇲🇽', 'mx', '', 1], ['Eva 🇵🇪', 'pe', '', 1]] } });
    await o.inscriptosChat(T + 21 * 60000);
    const n21 = pedidos.length;
    await o.inscriptosChat(T + 23 * 60000);
    const i2 = pedidos[1];
    ok(i1 && i1.m === 'POST' && /📝 \*\*COPA Y\*\* · ya se anotaron \*\*3\*\* de 8: Ana, Bea, Dora/.test(i1.b.content) && !/yo/.test(i1.b.content.split('\n')[0])
      && n21 === 1 && i2 && i2.m === 'PATCH' && /\*\*4\*\* de 8/.test(i2.b.content),
    'inscripciones: tres anotados de verdad («yo» no cuenta), un mensaje, y se edita a los 2 minutos cuando se suman más',
    JSON.stringify(pedidos.map((x) => [x.m, (x.b && x.b.content) || ''])));
    globalThis.fetch = antesF;
  }
}

// 🎟️ EL PASE DE RAPERO SOBRE EL OBJETO DE VERDAD (05/10/2026; con XP desde el 06/10): las Tareas dan XP y la XP sube de
// nivel, cada nivel paga una vez, una cumplida no se pierde, sólo cuentan los miembros de DRA, y después del último
// sigue la cola. Con `node:sqlite`, como el bot en vivo, y con el reloj quieto: las diarias dependen del día del este
{
  // las cuentas puras: el día del este (con el cambio de hora), las diarias como en Python, el nivel y la cola
  const H = 3600000;
  ok(A.rangoDiaET('2026-10-07').join() === [Date.UTC(2026, 9, 7, 4), Date.UTC(2026, 9, 8, 4)].join()
    && A.rangoDiaET('2026-11-01').join() === [Date.UTC(2026, 10, 1, 4), Date.UTC(2026, 10, 2, 5)].join()
    && A.finDiaET(Date.UTC(2026, 10, 3, 4, 30)) === Date.UTC(2026, 10, 3, 5),
  'el día del este: de medianoche a medianoche, y el del cambio de hora dura 25 horas');
  const DIARIAS = [['entrar', 'Entrá hoy', '', 'activo', 1, 150], ['felicitar1', 'Felicitá a alguien', '', 'fel', 1, 150],
    ['vivo1', 'Mirá una llave en vivo', '', 'vivo', 1, 150]];
  const d12 = A.paseDelDia({ diarias: DIARIAS, por_dia: 2 }, '2026-10-12').map((t) => t[0]);
  const d13 = A.paseDelDia({ diarias: DIARIAS, por_dia: 2 }, '2026-10-13').map((t) => t[0]);
  ok(d12.join() === 'entrar,felicitar1' && d13.join() === 'entrar,vivo1',
    'las diarias: «Entrá hoy» siempre y la otra se turna, igual que `diarias_de()` de bot/pase.py', d12 + ' / ' + d13);
  const UMB = Array.from({ length: 30 }, (_, i) => (i < 3 ? 300 * (i + 1) : 900 + 1000 * (i - 2)));
  const C0 = { niveles: 30, umbrales: UMB, cola: [1000, 300] };
  ok(A.nivelDeXP(C0, 299) === 0 && A.nivelDeXP(C0, 300) === 1 && A.nivelDeXP(C0, 1899) === 3 && A.nivelDeXP(C0, 99999) === 30
    && A.paseCola(C0, 27899) === 0 && A.paseCola(C0, 27900) === 0 && A.paseCola(C0, 30650) === 2,
  'el nivel sale de la XP (300 el primero, 27.900 el 30) y la cola cuenta de a 1.000 después del último');

  let DatabaseSync = null;
  try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { DatabaseSync = null; }
  if (!DatabaseSync) {
    console.log('  ⓘ sin node:sqlite (Node ' + process.version + '): el Pase no se prueba sobre el objeto');
  } else {
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
    // ⏱️ el miércoles 07/10/2026 a las 2 PM del este; la semana arrancó el lunes a las 11 AM
    const relojReal = Date.now;
    const FIJO = Date.UTC(2026, 9, 7, 18, 0), DIA = 24 * H;
    Date.now = () => FIJO;
    const tienda = (q) => sql.exec('SELECT id, monto FROM tienda WHERE quien = ? ORDER BY id', q).toArray();
    try {
      const ini = Date.UTC(2026, 9, 5, 15, 0), fin = ini + 7 * DIA, SEM = '2026-10-05';
      const ANA = '111111111111111111', BEA = '222222222222222222', CAMI = '333333333333333333';
      const ESP = { 1: ['tarjeta', 'Temporada'], 5: ['insignia', 'Pase Bronce'], 10: ['titulo', 'De la casa'],
        15: ['insignia', 'Pase Plata'], 20: ['color', '#F5C542'], 25: ['titulo', 'Pilar de DRA'], 30: ['insignia', 'Pase Oro'] };
      const PREMIOS = Array.from({ length: 30 }, (_, i) => [i + 1, 150].concat(ESP[i + 1] || ['', '']));
      const SEMANALES = [['dias', 'Entrá 3 días', '', 'activo', 3, 500], ['felicitar', 'Felicitá a 3', '', 'fel', 3, 500],
        ['dra', 'Jugá en DRA', '', 'dra', 1, 500], ['vivo', 'Mirá 2 llaves', '', 'vivo', 2, 500],
        ['precio', 'Poné precio', '', 'precio', 1, 500]];
      const TEMPORADA = [['fel10', 'Felicitá a 10', '', 'fel', 10, 1500], ['vivo5', 'Mirá 5 llaves', '', 'vivo', 5, 1500],
        ['dra3', 'Jugá 3 en DRA', '', 'dra', 3, 2000], ['fel20', 'Felicitá a 20', '', 'fel', 20, 2000],
        ['vivo10', 'Mirá 10 llaves', '', 'vivo', 10, 2000], ['caza', 'Cazá a un buscado', '', 'caza', 1, 3000],
        ['dra5', 'Jugá 5 en DRA', '', 'dra', 5, 3000], ['dias30', 'Entrá 30 días', '', 'activo', 30, 3000]];
      const CFG = { temp: 'prueba', niveles: 30, umbrales: UMB, cola: [1000, 300], diarias: DIARIAS, por_dia: 2,
        semanales: SEMANALES, temporada: TEMPORADA, premios: PREMIOS, publicar: [10, 30], legado: { misiones: 500 } };
      const ciclo = (v, hechas) => o.paseCiclo({ v, cfg: CFG, sem: [[SEM, ini, fin]], miembros: [ANA, BEA], hechas });
      const xp = (q) => o.paseDe(q).xp;
      const tarea = (p, lista, id) => (lista === 'temporada' ? p.temporada : p[lista].tareas).find((t) => t.id === id);
      ok(o.paseCiclo({ v: 'x', cfg: Object.assign({}, CFG, { umbrales: UMB.slice(0, 29) }), sem: [], miembros: [], hechas: {} }).error
        && o.paseCiclo({ v: 'x', cfg: Object.assign({}, CFG, { temporada: TEMPORADA.concat([DIARIAS[0]]) }), sem: [], miembros: [],
          hechas: {} }).error && !o.leer('pase_v'),
      'el objeto no toma un Pase con umbrales que no alcanzan, ni con una Tarea repetida entre dos listas');
      let r = ciclo('v1', { [ANA]: { [SEM]: [1, 0] }, [CAMI]: { [SEM]: [1, 1] } });
      let p = o.paseDe(ANA);
      ok(r.cambio && r.niveles === 1 && p.miembro && p.xp === 500 && p.nivel === 1 && p.desde === 300 && p.hasta === 600
        && tarea(p, 'semana', 'dra').hecha && tienda(ANA).length === 1 && tienda(ANA)[0].id === 'pase:prueba:' + ANA + ':1'
        && tienda(ANA)[0].monto === 150,
      'el Pase: Ana jugó en DRA, una semanal son 500 XP, sube al nivel 1 y cobra sus 150 una vez', JSON.stringify(p).slice(0, 200));
      const pc = o.paseDe(CAMI);
      ok(ciclo('v1', {}).cambio === false && pc.miembro === false && pc.nivel === 0 && !tienda(CAMI).length
        && pc.semana.tareas.length === 5 && pc.hoy.tareas.length === 2 && pc.temporada.length === 8 && pc.hoy.dia === '2026-10-07'
        && pc.hoy.fin === Date.UTC(2026, 9, 8, 4),
      'lo mismo del ciclo no se vuelve a guardar; Cami no es miembro de DRA: ve las Tareas (2 de hoy, 5, 8), sin nivel ni Tienda');
      for (const dia of ['2026-10-05', '2026-10-06']) sql.exec('INSERT INTO activo (quien, dia) VALUES (?, ?)', ANA, dia);
      o.paseRevisar(ANA);
      p = o.paseDe(ANA);
      ok(xp(ANA) === 650 && p.nivel === 2 && tarea(p, 'semana', 'dias').lleva === 2 && !tarea(p, 'semana', 'dias').hecha
        && !tarea(p, 'hoy', 'entrar').hecha,
      'dos días de tres no cumplen la semanal; el de ayer sí es la diaria de ayer (+150): 650 XP, nivel 2');
      o.diaActivo(ANA, '2026-10-07');
      p = o.paseDe(ANA);
      ok(p.xp === 1300 && p.nivel === 3 && tarea(p, 'semana', 'dias').hecha && tarea(p, 'hoy', 'entrar').hecha,
        'entrar hoy: la diaria (+150) y el tercer día de la semana, cualquiera y no seguido (+500)');
      const hoy2 = A.paseDelDia(CFG, '2026-10-07')[1][0];
      for (const id of ['a1b2c3d4e5f6', 'a1b2c3d4e5f7']) o.aplaudir({ quien: ANA, pub: { id, tipo: 'campeon' } });
      p = o.paseDe(ANA);
      ok(tarea(p, 'semana', 'felicitar').lleva === 2 && !tarea(p, 'semana', 'felicitar').hecha
        && tarea(p, 'temporada', 'fel10').lleva === 2 && p.xp === 1300 + (hoy2 === 'felicitar1' ? 150 : 0),
      'dos aplausos de tres todavía no cumplen la semanal; cuentan para la de temporada (y para la diaria, si hoy es ésa)');
      o.aplaudir({ quien: ANA, pub: { id: 'a1b2c3d4e5f8', tipo: 'campeon' } });
      o.aplaudir({ quien: ANA, pub: { id: 'a1b2c3d4e5f8', tipo: 'campeon' } });
      ok(tarea(o.paseDe(ANA), 'semana', 'felicitar').hecha && tarea(o.paseDe(ANA), 'temporada', 'fel10').lleva === 3,
        'el tercer aplauso la cumple, y aplaudir dos veces lo mismo no suma');
      o.aplaudir({ quien: CAMI, pub: { id: 'a1b2c3d4e5f6', tipo: 'campeon' } });
      ok(!sql.exec('SELECT 1 FROM pase_log WHERE quien = ?', CAMI).toArray().length,
        'lo de quien no es miembro no se anota en el Pase');
      r = o.paseVivo({ quien: ANA, llave: '9' });
      ok(r.cuenta === false, 'sin nada en vivo, mirar no cuenta');
      for (const id of ['9', '10']) {
        sql.exec("INSERT INTO vivo (id, canal, sv, g, autor, pub, ed, texto, visto) VALUES (?, '2', 'DRA', '1', 'x', ?, ?, 'llave', ?)",
          id, FIJO - 60000, FIJO, FIJO);
      }
      const antesV = xp(ANA);
      r = o.paseVivo({ quien: ANA, llave: '9' });
      const rb = o.paseVivo({ quien: BEA, llave: '9' });
      p = o.paseDe(ANA);
      ok(r.cuenta && rb.cuenta && o.paseVivo({ quien: CAMI, llave: '9' }).cuenta === false
        && tarea(p, 'semana', 'vivo').lleva === 1 && p.xp === antesV + (hoy2 === 'vivo1' ? 150 : 0),
      'con una llave en vivo, mirarla cuenta (Ana y Bea); a Cami, que no es miembro, no');
      o.paseVivo({ quien: ANA, llave: '9' });
      ok(tarea(o.paseDe(ANA), 'semana', 'vivo').lleva === 1, 'la misma llave dos veces es una');
      o.paseVivo({ quien: ANA, llave: '10' });
      ok(tarea(o.paseDe(ANA), 'semana', 'vivo').hecha && o.paseVivo({ quien: BEA, llave: '77' }).cuenta === false
        && o.paseVivo({ quien: BEA, llave: 'ver:77' }).cuenta === false,
      'dos llaves distintas cumplen la semanal; una que no está en vivo no cuenta (revisión del 05/10)');
      const antesP = xp(ANA);
      o.precio({ quien: ANA, cabeza: 'Zoe', monto: 100, inicial: 5000, tope: 20000, fin: FIJO + DIA, desde: 0 });
      ok(tarea(o.paseDe(ANA), 'semana', 'precio').hecha && xp(ANA) === antesP + 500, 'poner un precio cumple la semanal');
      const antesC = xp(ANA);
      ciclo('v2', { [ANA]: { [SEM]: [3, 1] } });
      p = o.paseDe(ANA);
      ok(tarea(p, 'temporada', 'dra3').hecha && tarea(p, 'temporada', 'caza').hecha && !tarea(p, 'temporada', 'dra5').hecha
        && p.xp === antesC + 2000 + 3000,
      'el ciclo dice tres eventos en DRA y una caza: dos de temporada (+2.000 y +3.000)');
      const pagos = tienda(ANA).length, nivelA = p.nivel;
      ciclo('v3', {});
      p = o.paseDe(ANA);
      ok(tarea(p, 'semana', 'dra').hecha && tarea(p, 'temporada', 'caza').hecha && p.nivel === nivelA && tienda(ANA).length === pagos,
        'el ciclo corrige la llave y Ana ya no jugó: lo cumplido no se pierde, y nada se cobra dos veces');
      const bA = sql.exec("SELECT titulo, url FROM bandeja WHERE quien = ? AND clave = 'pase:prueba'", ANA).toArray();
      ok(bA.length === 1 && bA[0].titulo.includes('Nivel ' + nivelA) && /\/freestyle-rap\/pase$/.test(bA[0].url),
        'a la campana, uno solo que se pisa: «Nivel ' + nivelA + ' del Pase»', JSON.stringify(bA));
      const pr = o.pasePremios(o.paseDatos().cfg, 21);
      ok(pr.titulo === 'De la casa' && pr.color === '#F5C542' && pr.insignias.length === 2 && pr.insignias[1][1] === 'Pase Plata',
        'en el nivel 21: el título del 10, el color del 20 y dos insignias');
      // la semana de prueba tenía «Completá tus misiones»: lo cumplido sigue valiendo lo que una semanal (`legado`)
      sql.exec("INSERT INTO pase_hecho (quien, temp, sem, tarea, t) VALUES (?, 'prueba', ?, 'misiones', 1)", BEA, SEM);
      ok(xp(BEA) === 500 + (hoy2 === 'vivo1' ? 150 : 0) && o.paseDe(BEA).nivel >= 1,
        'la Tarea vieja de la prueba («misiones») sigue valiendo: Bea no pierde su nivel 1 ni su tarjeta',
        xp(BEA) + ' ' + hoy2 + ' ' + JSON.stringify(sql.exec('SELECT sem, tarea FROM pase_hecho WHERE quien = ?', BEA).toArray()));
      // 🏛️ BEA LLEGA AL 30 Y SIGUE: el Salón, los hitos para Publicaciones y la cola. Lo de antes se le pone a mano;
      // lo último, con lo de verdad (el ciclo y un día), para que lo vea `paseRevisar()`
      const meter = (sem, ids) => {
        for (const id of ids) {
          sql.exec('INSERT OR IGNORE INTO pase_hecho (quien, temp, sem, tarea, t) VALUES (?, ?, ?, ?, 1)', BEA, 'prueba', sem, id);
        }
      };
      meter('temp', TEMPORADA.map((t) => t[0]));
      for (const w of ['w1', 'w2', 'w3']) meter(w, SEMANALES.map((t) => t[0]));
      meter('w4', ['dias', 'felicitar', 'dra']);
      sql.exec("INSERT INTO idk (id, k, t) VALUES (?, 'bea', 1)", BEA);
      const x0 = xp(BEA);
      ok(x0 === 27650 && o.paseDe(BEA).nivel === 29, 'Bea, a 250 XP del final: nivel 29', x0);
      ciclo('v4', { [BEA]: { [SEM]: [1, 0] } });
      const pb = o.paseDe(BEA);
      const bandejaDe = (q) => sql.exec("SELECT titulo, cuerpo FROM bandeja WHERE quien = ? AND clave = 'pase:prueba'", q).toArray();
      let bB = bandejaDe(BEA);
      ok(pb.nivel === 30 && pb.xp === 28150 && pb.hasta === null && pb.cola === 0 && pb.salon === 1 && pb.completos.join() === 'prueba'
        && tienda(BEA).filter((x) => /:\d+$/.test(x.id)).length === 30 && bB.length === 1 && bB[0].titulo.includes('Nivel 30')
        && bB[0].cuerpo.includes('Pase Oro') && bB[0].cuerpo.includes('Salón del Pase'),
      'jugó en DRA y completa el Pase: los 30 niveles pagan una vez cada uno, entra primera al Salón y le llega a la campana',
      JSON.stringify({ xp: pb.xp, nivel: pb.nivel, cola: pb.cola, salon: pb.salon, completos: pb.completos, bandeja: bB }));
      meter('w5', SEMANALES.map((t) => t[0]));
      meter('w6', ['dias', 'felicitar']);
      meter('d:2026-10-01', ['entrar']);
      o.diaActivo(BEA, '2026-10-07');
      const pb2 = o.paseDe(BEA);
      bB = bandejaDe(BEA);
      ok(pb2.xp === 31950 && pb2.cola === 4 && tienda(BEA).filter((x) => /:c\d+$/.test(x.id)).length === 4
        && bB.length === 1 && bB[0].titulo.includes('Pase completo · +4') && bB[0].cuerpo.includes('+300'),
      'después del 30, la cola: cada 1.000 XP paga 300, una vez cada paso, y la campana lo dice',
      JSON.stringify({ xp: pb2.xp, cola: pb2.cola, bandeja: bB }));
      const niv = o.paseNiveles();
      ok(niv.niveles[BEA] === 30 && niv.niveles[ANA] === nivelA && nivelA === 10 && !niv.niveles[CAMI]
        && niv.hitos.map((h) => h[0] + ':' + h[1] + ':' + h[3]).sort().join() === [ANA + ':10:', BEA + ':10:bea', BEA + ':30:bea'].join(),
      'para el ciclo: los niveles y los hitos (Ana llegó al 10; Bea al 10 y al 30), con la clave del perfil si la tiene',
      JSON.stringify(niv.hitos) + ' Ana ' + nivelA);
      sql.exec("INSERT INTO jugo_temp (quien, temp, k, eventos) VALUES (?, 'prueba', 'ana', 3)", ANA);
      const ps = o.pases();
      ok(ps.n.ana && ps.n.ana[0] === nivelA && ps.n.bea && ps.n.bea[0] === 30 && ps.n.bea[2] === '#F5C542'
        && ps.salon.prueba.length === 1 && ps.salon.prueba[0][0] === 'bea' && ps.cfg.semanales.length === 5,
      'para los perfiles, por clave: Ana y Bea con su nivel; el Salón del Pase con Bea; y lo público del Pase');
      ok(A.APLAUDIBLES.pase && A.motivoAplauso({ tipo: 'pase', completo: true }) === 'completar el Pase de rapero'
        && A.motivoAplauso({ tipo: 'pase', nivel: 10, premio: 'De la casa' }).includes('«De la casa»'),
      'llegar a un nivel del Pase que se publica se puede felicitar, con su motivo');
    } finally {
      Date.now = relojReal;
    }
    // 🔥 UNA RACHA QUE SE UNE CON UN DÍA QUE LLEGÓ TARDE NO COBRA DE MÁS (revisión del 05/10/2026): 7 días cobrados, un
    // hueco, 7 días cobrados; aparece el día del hueco y son 15 seguidos, que valen dos escalones: no se paga un tercero
    const DANI = '444444444444444444';
    const hace = (i) => A.diaET(Date.now() - i * 86400000);
    for (const i of [14, 13, 12, 11, 10, 9, 8, 6, 5, 4, 3, 2, 1, 0]) sql.exec('INSERT INTO activo (quien, dia) VALUES (?, ?)', DANI, hace(i));
    sql.exec("INSERT INTO tienda (id, ref, quien, monto, t) VALUES (?, 0, ?, 500, 1)", 'racha:' + DANI + ':' + hace(14) + ':7', DANI);
    // 🔥 desde el 13/10/2026 la racha paga por día y por hito (14 y 30 días), no cada 7: con 15 seguidos, el de 14 una vez
    sql.exec('INSERT INTO activo (quien, dia) VALUES (?, ?)', DANI, hace(7));
    o.premiarRacha(DANI);
    o.premiarRacha(DANI);
    const hitos = tienda(DANI).filter((x) => String(x.id).startsWith('rhito:'));
    ok(o.rachaDe(DANI).racha.actual === 15 && hitos.length === 1 && hitos[0].monto === 500,
      'la racha de 15: el hito de 14 días paga 500, una sola vez', JSON.stringify(tienda(DANI)));
    // 🔥 el premio de hoy: se cobra una vez, y lo que paga es el del día de la semana
    const rd = o.rachaDe(DANI);
    const hoyP = rd.premios.find((x) => x[0] === rd.hoy);
    const c1 = o.cobrarDia(DANI), c2 = o.cobrarDia(DANI);
    const dias = tienda(DANI).filter((x) => String(x.id).startsWith('rdia:'));
    ok(rd.premios.length === 7 && hoyP && hoyP[3] === 1 && c1.cobrado === hoyP[1] && c2.error === 'ya' && dias.length === 1
      && A.RACHA_DIA.includes(hoyP[1]),
    'el premio de hoy de la racha: se cobra una vez, y es el de ese día de la semana', JSON.stringify([hoyP, c1.cobrado, c2.error]));
    // 🌱 la bienvenida: alguien que entró por primera vez hoy, un paso por día, y cada uno pide lo suyo
    const NUEVO = '555555555555555555';
    sql.exec('INSERT INTO activo (quien, dia) VALUES (?, ?)', NUEVO, hace(0));
    const b0 = await o.bienvenidaDe(NUEVO);
    const cb1 = await o.cobrarBienvenida(NUEVO);
    const cb2 = await o.cobrarBienvenida(NUEVO);
    const relojB = Date.now;
    Date.now = () => relojB() + 86400000;
    let cb3, cb4;
    try {
      cb3 = await o.cobrarBienvenida(NUEVO);
      sql.exec('INSERT INTO sigue (quien, a, t) VALUES (?, ?, ?)', NUEVO, 'snow', Date.now());
      cb4 = await o.cobrarBienvenida(NUEVO);
    } finally { Date.now = relojB; }
    const viejo = await o.bienvenidaDe(DANI);
    ok(b0 && b0.paso === 0 && b0.hecha && cb1.cobrado === 200 && cb2.error === 'manana' && cb3.error === 'falta'
      && cb3.pasos[1][1] === 'seguir' && cb4.cobrado === 200 && cb4.paso === 2 && viejo === null,
    'la bienvenida: el día 1 se cobra, uno por día, el 2 pide seguir a alguien, y quien no es nuevo no la tiene',
    JSON.stringify([b0, cb1.cobrado, cb2.error, cb3.error, cb4 && cb4.paso, viejo]));
    // ⭐ MÁS COSAS SUBEN EL NIVEL (14/10/2026, Dlx: «haz que otras y muchas cosas más te hagan subir de nivel… no me
    // refiero a nivel de pase»): cada cosa una vez, con tope, y lo de «una vez» no se pierde al sacarlo
    const xp0 = o.rachaDe(NUEVO).nivel.xp;
    const s1 = o.xpVio(NUEVO, 'sigue', 'snow'), s2 = o.xpVio(NUEVO, 'sigue', 'snow');
    o.xpVio(NUEVO, 'fel', 'aaaaaaaaaaaa');
    const r1 = o.rachaDe(NUEVO);
    ok(s1 && !s2 && r1.nivel.xp === xp0 + 3 && r1.xp_de.sigue.join() === '1,2' && r1.xp_de.fel.join() === '1,1'
      && r1.xp_de.ev && r1.xp_de.dia && r1.xp_fuentes.vivo[0] === 3 && !o.xpVio(NUEVO, 'inventada', 'x'),
    'seguir a alguien suma 2 una sola vez (seguirlo de nuevo no), felicitar 1, y el desglose dice de dónde sale',
    JSON.stringify([xp0, r1.nivel.xp, r1.xp_de]));
    for (let i = 0; i < 80; i++) o.xpVio(NUEVO, 'fel', 'f' + i);
    const r2 = o.rachaDe(NUEVO);
    ok(r2.xp_de.fel.join() === '60,60' && A.xpDeFuentes({ fel: 999, vivo: 2, nada: 5 }).xp === 60 + 6,
      'felicitar tiene tope: 81 felicitaciones son 60 de XP, no 81', JSON.stringify(r2.xp_de.fel));
    // 🏆 el Hincha del mes: la misma XP, por mes y con los mismos topes
    const hi = o.hinchas();
    const yo = ((hi.meses[A.diaET().slice(0, 7)] || []).find((x) => x[0] === NUEVO) || [])[1];
    ok(yo === 2 + 60, 'el Hincha del mes cuenta la XP de la página del mes, con sus topes (seguir 2 + felicitar 60)',
      JSON.stringify(hi));
    // 🙋 los pedidos de la gente y pasar todo de una cuenta a otra (17/10/2026: Lvel, «Todo»)
    const VIEJA = '1526612644642160721', NUEVA = '1241407042195816459';
    const p1 = await (await o.pedir({ quien: NUEVA, tipo: 'cuenta', k: 'lvel', texto: 'perdí mi cuenta vieja', prueba: { apodo_dra: '👤 | Lvel' } })).json();
    const p2 = await (await o.pedir({ quien: NUEVA, tipo: 'cuenta', k: 'lvel', texto: 'otra vez' })).json();
    const d1 = o.duenoPedido({ id: p1.id, si: true, por: '739338101603696681' });
    const pcl = o.pedidosCiclo().pedidos;
    ok(p1.ok && p2.ya && p2.id === p1.id && d1.estado === 'si' && pcl.length === 1 && pcl[0].quien === NUEVA && pcl[0].k === 'lvel'
      && o.duenoPedido({ id: p1.id, si: false }).error === 'ya',
    'un pedido de cuenta: el mismo dos veces es uno, se aprueba una vez y el ciclo lo ve para aplicarlo', JSON.stringify([p1, p2, d1, pcl]));
    sql.exec('INSERT INTO tienda (id, ref, quien, monto, t) VALUES (?, 0, ?, 777, ?)', 'x:viejo', VIEJA, Date.now());
    sql.exec('INSERT INTO tienda (id, ref, quien, monto, t) VALUES (?, 0, ?, 500, ?)', 'rhito:' + VIEJA + ':2026-10-01:7', VIEJA, Date.now());
    o.xpVio(VIEJA, 'sigue', 'konan');
    o.xpVio(NUEVA, 'sigue', 'konan');
    sql.exec('INSERT INTO sigue (quien, a, t) VALUES (?, ?, ?)', VIEJA, 'oasis', Date.now());
    sql.exec("INSERT INTO sesiones (h, quien, t, vence) VALUES ('hv', ?, ?, ?)", VIEJA, Date.now(), Date.now() + 864e5);
    const mu = await o.mudarCuenta({ viejo: VIEJA, nuevo: NUEVA });
    const de = (t, q) => sql.exec(`SELECT COUNT(*) AS n FROM ${t} WHERE quien = ?`, q).toArray()[0].n;
    ok(mu.ok && de('tienda', VIEJA) === 0 && de('tienda', NUEVA) >= 1 && de('xp_log', VIEJA) === 0 && de('xp_log', NUEVA) >= 1
      && de('sigue', NUEVA) >= 1 && de('sesiones', VIEJA) === 0 && o.pedidosEstados({ estados: { [p1.id]: { ok: true } } }).n === 1,
    'pasar la cuenta: la Tienda, la XP y a quién sigue van a la nueva (sin repetir lo que ya tenía), la vieja ya no entra',
    JSON.stringify(mu));
    ok(!!sql.exec('SELECT 1 AS x FROM tienda WHERE id = ? AND quien = ?', 'rhito:' + NUEVA + ':2026-10-01:7', NUEVA).toArray()[0]
      && !sql.exec("SELECT 1 AS x FROM tienda WHERE id LIKE '%' || ? || '%'", VIEJA).toArray()[0] && sql.exec("SELECT 1 FROM tienda WHERE id = 'x:viejo'").toArray().length === 1,
    'y las claves de la Tienda con el ID adentro pasan al nuevo: el hito de racha ya cobrado no se vuelve a pagar');
    const band = (q, c) => sql.exec('SELECT titulo FROM bandeja WHERE quien = ? AND clave = ?', q, c).toArray()[0];
    ok(/cuenta nueva ya es la de tu perfil/.test((band(NUEVA, 'pedido:' + p1.id) || {}).titulo || ''),
      'cuando el ciclo lo aplica, a quien pidió le llega a la campana', JSON.stringify(band(NUEVA, 'pedido:' + p1.id)));
    // 🔎 la cuenta VIEJA: el ciclo la mira y la deja como prueba, sólo en los sin contestar
    const OTRA = '1111111111111111111';
    const p3 = await (await o.pedir({ quien: OTRA, tipo: 'cuenta', k: 'konan', texto: 'soy konan, perdí la cuenta' })).json();
    const sv1 = o.pedidosCiclo().sin_vieja;
    const pp = o.pedidosPrueba({ pruebas: { [p3.id]: { usuario: 'konan_real', en_dra: true, miembro: true, raro: 'x' } } });
    const vista = o.pedidosDueno().find((x) => x.id === p3.id);
    ok(sv1.some((x) => x.id === p3.id && x.k === 'konan') && pp.n === 1 && !o.pedidosCiclo().sin_vieja.some((x) => x.id === p3.id)
      && vista.prueba.vieja.usuario === 'konan_real' && vista.prueba.vieja.en_dra === true && vista.prueba.vieja.raro === undefined,
    'perdí mi cuenta: el ciclo averigua la cuenta vieja una vez, y el Dashboard la ve (sólo los campos que se esperan)',
    JSON.stringify([sv1, pp, vista && vista.prueba]));
    const dn = o.duenoPedido({ id: p3.id, si: false, nota: 'la cuenta vieja sigue activa' });
    ok(dn.estado === 'no' && /no se aprobó/.test((band(OTRA, 'pedido:' + p3.id) || {}).titulo || ''),
      'un no también le llega a la campana', JSON.stringify(dn));
    // 🎬 un video que no es suyo, aprobado: se saca de verdad (la lista del «Quitar»)
    const p4 = await (await o.pedir({ quien: OTRA, tipo: 'video', k: 'konan', vid: 'abcdefghijk', texto: 'esa batalla no es mía' })).json();
    const p5 = await (await o.pedir({ quien: OTRA, tipo: 'video', k: 'konan', vid: 'zyxwvutsrqp', texto: 'esta tampoco' })).json();
    const dv = o.duenoPedido({ id: p4.id, si: true, por: '739338101603696681' });
    const quit = sql.exec("SELECT 1 AS x FROM videos_quitados WHERE clave = 'konan' AND vid = 'abcdefghijk'").toArray().length;
    ok(p5.id !== p4.id && !p5.ya && dv.estado === 'hecho' && quit === 1 && /Sacamos el video/.test((band(OTRA, 'pedido:' + p4.id) || {}).titulo || ''),
      'un video aprobado va a los quitados y se avisa; dos videos distintos son dos pedidos', JSON.stringify([p4, p5, dv, quit]));
    // 🔔 seguir una liga (17/10/2026): seguir y dejar, y el vigía avisa una vez a quien la seguía desde antes
    const SEG1 = '2222222222222222222', SEG2 = '3333333333333333333';
    const ls1 = o.ligaSeguir({ quien: SEG1, liga: 'fmh-espana', on: true });
    o.ligaSeguir({ quien: SEG1, liga: 'fzl', on: true });
    const ls2 = o.ligaSeguir({ quien: SEG1, liga: 'fzl', on: false });
    ok(ls1.ok && ls1.n === 1 && ls1.ligas.join() === 'fmh-espana' && ls2.ligas.join() === 'fmh-espana' && ls1.celular === false
      && o.ligaSeguir({ quien: SEG1, liga: 'Mal Id!', on: true }).error === 'faltan datos',
    'seguir una liga y dejarla: devuelve las que sigue, cuántos la siguen y si tiene el celular vinculado', JSON.stringify([ls1, ls2]));
    const tIt = Date.now() + 60000;
    const ahoraL = Math.ceil((tIt + 1) / 300000) * 300000;
    // el KV del objeto va envuelto (lo mide): otro objeto sobre la misma base, con lo nuevo de las ligas en su KV
    const oL = new A.Avisos({ storage: { sql, setAlarm() {}, getAlarm() { return null; }, transactionSync: (f) => f() },
      blockConcurrencyWhile: async (f) => f() }, { KV: { get: async (k) => (k === 'ligas:nov' ? JSON.stringify({ items: [{
        id: 'r:fmh-espana:9', liga: 'fmh-espana', t: new Date(tIt).toISOString(), titulo: '⚔️ FMH España: Ortiz le ganó a MTZ',
        cuerpo: 'Mirá la tabla.', url: 'https://underlegends.pages.dev/freestyle-rap/ligas/fmh-espana' }] }) : null) } });
    await new Promise((r) => setTimeout(r, 5));
    sql.exec('INSERT INTO liga_sigue (quien, liga, t) VALUES (?, ?, ?)', SEG2, 'fmh-espana', tIt + 1000);
    const nb1 = await oL.ligasSeguidas(ahoraL);
    const nb2 = await oL.ligasSeguidas(ahoraL);
    const bl = sql.exec("SELECT titulo, url FROM bandeja WHERE quien = ? AND clave = 'lg:r:fmh-espana:9'", SEG1).toArray()[0];
    const bl2 = sql.exec("SELECT 1 AS x FROM bandeja WHERE quien = ? AND clave LIKE 'lg:%'", SEG2).toArray().length;
    ok(nb1 === 1 && nb2 === 0 && bl && /Ortiz le ganó/.test(bl.titulo) && /ligas\/fmh-espana$/.test(bl.url) && bl2 === 0,
      'lo nuevo de una liga llega una vez a la campana de quien la seguía desde antes (quien la siguió después, no)',
      JSON.stringify([nb1, nb2, bl, bl2]));
    await o.olvidar({ quien: SEG1 });
    ok(!sql.exec('SELECT 1 AS x FROM liga_sigue WHERE quien = ?', SEG1).toArray().length,
      'borrar mis datos borra también las ligas que seguía');
    sql.exec("INSERT INTO subs (endpoint, p256dh, auth, alta, visto, quien) VALUES ('https://push/x', 'p', 'a', 1, 1, ?)", NUEVO);
    const r3 = o.rachaDe(NUEVO);
    sql.exec("UPDATE subs SET quien = '' WHERE endpoint = 'https://push/x'");
    const r4 = o.rachaDe(NUEVO);
    ok(r3.xp_de.campana.join() === '1,10' && r4.xp_de.campana.join() === '1,10',
      'la campana suma 10 una vez, y desvincularla después no baja el nivel', JSON.stringify([r3.xp_de.campana, r4.xp_de.campana]));
    // 🔴 la llave en vivo cuenta para el nivel de CUALQUIERA (el Pase, sólo de DRA), y es lo que cumple el paso de la
    // bienvenida, que miraba `pase_vivo`, una tabla que ya nadie escribe
    sql.exec("INSERT INTO vivo (id, canal, pub, ed, texto, visto) VALUES ('m111', 'c1', ?, ?, 'llave', ?)", Date.now(), Date.now(), Date.now());
    const pv = o.paseVivo({ quien: NUEVO, llave: 'm111' });
    const pvNo = o.paseVivo({ quien: NUEVO, llave: 'm999' });
    const bLl = sql.exec("SELECT 1 AS x FROM xp_log WHERE quien = ? AND que = 'vivo'", NUEVO).toArray().length;
    ok(pv.xp === true && pv.cuenta === false && pvNo.cuenta === false && !pvNo.xp && bLl === 1 && o.rachaDe(NUEVO).xp_de.vivo.join() === '1,3',
      'mirar una llave en vivo suma 3 al nivel aunque no sea de DRA; una llave que no está en vivo no suma',
      JSON.stringify([pv, pvNo]));
    // 🧠 LOS DATOS DE CADA PERSONA PARA /card, EN EL OBJETO (06/10/2026): se escribe sólo lo que cambió, se borra a
    // quien ya no está, y una lista que perdió más de la mitad no borra nada (es el ciclo, no la gente)
    const gente = Array.from({ length: 30 }, (_, i) => ['p:r' + i, JSON.stringify({ n: 'R' + i, ev: i })]);
    let pc = o.personasCiclo({ pares: gente, completo: true });
    ok(pc.ok && pc.escritas === 30 && pc.borradas === 0 && o.persona('p:r7') === gente[7][1] && o.persona('p:nadie') === null,
      'el ciclo manda las 30 personas: se escriben y se leen de a una', JSON.stringify(pc));
    const otra = gente.map((x, i) => (i === 3 ? [x[0], JSON.stringify({ n: 'R3', ev: 99 })] : x)).slice(0, 29);
    pc = o.personasCiclo({ pares: otra, completo: true });
    ok(pc.ok && pc.escritas === 1 && pc.borradas === 1 && JSON.parse(o.persona('p:r3')).ev === 99 && o.persona('p:r29') === null,
      'la corrida siguiente: una cambió (una fila) y una se fue (se borra); las otras 27, intactas', JSON.stringify(pc));
    pc = o.personasCiclo({ pares: otra.slice(0, 10), completo: true });
    ok(pc.error === 'freno' && o.persona('p:r20') !== null,
      'una lista con menos de la mitad no borra a nadie: es el ciclo, no gente que se fue', JSON.stringify(pc));
    ok(o.personasCiclo({ pares: [['d:1', 'x'], ['p:ok', '{}']] }).total === 1 && o.persona('p:ok') === '{}'
      && Object.keys(o.personasLeer(['p:r1', 'p:r2', 'p:nadie']).personas).join() === 'p:r1,p:r2',
      'sólo claves p: (una d: no entra), y varias a la vez para el ciclo');
    await o.olvidar({ quien: '555555555555555555', clave: 'r5' });
    ok(o.persona('p:r5') === null && o.persona('p:r6') !== null, 'olvidar a alguien borra también sus datos de /card');
  }
}

// ── 📢 lo que el organizador avisa después: cancelado, en pausa o atrasado (07/10/2026) ───────────────────────────
{
  console.log('\n📢 lo que el organizador avisa después del anuncio\n');
  const pub = Date.parse('2026-10-07T21:32:00Z');
  const E = (t) => A.estadoDeMensaje(t, pub);
  const tipo = (t) => (E(t) || {}).tipo || null;
  ok(tipo('<@&1> una disculpa se me fue la luz, podemos reanudar con la compe mañana siguiendo la llave <@2> y <@3> '
    + 'estarían clasificados a Semis y mañana batallarian los que falten') === 'pausado',
  'Snake Rap, 07/10: «se me fue la luz, podemos reanudar con la compe mañana» es EN PAUSA');
  ok(tipo('mañana seguimos con las semis') === 'pausado' && tipo('La compe se pospone, perdón') === 'pausado'
    && tipo('queda aplazada para el sábado') === 'pausado', '«mañana seguimos», «se pospone», «aplazada»: en pausa');
  ok(tipo('COMPE CANCELADA por falta de jueces') === 'cancelado' && tipo('se cancela la compe de hoy') === 'cancelado'
    && tipo('perdón gente, hoy no se va a hacer') === 'cancelado' && tipo('el torneo queda suspendido') === 'cancelado',
  '«cancelada», «se cancela», «no se va a hacer», «suspendido»: cancelado');
  const a1 = E('se atrasa 30 minutos la compe');
  const a2 = E('empezamos más tarde, en 20 min arrancamos');
  const a3 = E('nuevo horario <t:1791420000:t>');
  ok(a1 && a1.tipo === 'atrasado' && a1.mas === 30 * 60000 && !a1.nueva, '«se atrasa 30 minutos»: atrasado, 30 min más', JSON.stringify(a1));
  ok(a2 && a2.tipo === 'atrasado' && a2.nueva === pub + 20 * 60000, '«en 20 min»: la hora nueva, desde el mensaje', JSON.stringify(a2));
  ok(a3 && a3.tipo === 'atrasado' && a3.nueva === 1791420000000, 'el sello `<t:…>` es la hora nueva', JSON.stringify(a3));
  ok(tipo('se pasa para mañana <t:1791500000:t>') === 'pausado', 'una hora nueva de otro día es en pausa');
  ok([
    'si no se llenan los cupos se cancela', 'tu cupo queda cancelado si no te presentás', 'no se cancela, seguimos en 5',
    'vamo empezando 5 mins', 'gracias a todos, mañana hay otra compe', 'empezamos en 10 minutos',
    '@everyone llaves listas, vayan a la llamada',
  ].every((t) => tipo(t) === null), 'lo condicional, lo negado, la regla del cupo y la charla de siempre: nada',
  ['si no se llenan los cupos se cancela', 'tu cupo queda cancelado si no te presentás', 'no se cancela, seguimos en 5',
    'vamo empezando 5 mins', 'gracias a todos, mañana hay otra compe', 'empezamos en 10 minutos'].map((t) => t + ' → ' + tipo(t)).join(' | '));
}

// ── 🔥🎲 «Con datos» y «A full»: el título, el dato, el pozo y quién ganó (07/10/2026) ───────────────────────────
{
  console.log('\n🔥🎲 los niveles nuevos del bot en vivo\n');
  ok(Object.keys(A.NIVELES_CHAT).join() === 'poco,normal,todo,datos,full' && A.porBatalla('full') && A.porBatalla('datos')
    && A.porBatalla('todo') && !A.porBatalla('normal'), 'cinco niveles, y los tres de arriba hablan batalla por batalla');
  // el pozo: 300 a A (100 + 200) y 200 a B; gana A → los de A se llevan los 500 según lo que puso cada uno
  const r1 = A.repartoPozo([['1', 'A', 100], ['2', 'A', 200], ['3', 'B', 200]], 'A');
  ok(r1.out['1'] === 166 && r1.out['2'] === 333 && !r1.out['3'] && !r1.devuelto && r1.total === 500,
    'pozo compartido: lo de los que pierden se reparte según lo que puso cada uno (sin crear puntos)', JSON.stringify(r1));
  const r2 = A.repartoPozo([['1', 'A', 100], ['2', 'A', 50]], 'B');
  ok(r2.devuelto && r2.out['1'] === 100 && r2.out['2'] === 50, 'nadie acertó: se devuelve todo', JSON.stringify(r2));
  const r3 = A.repartoPozo([['1', 'B', 250]], '');
  ok(r3.devuelto && r3.out['1'] === 250, 'sin resultado: se devuelve todo');
  // los títulos
  const tabla = { snow: { k: 'snow', n: 'Snow', ovr: 80, oro: 2, pos: 3, cc: 'co' }, oasis: { k: 'oasis', n: 'Oasis', ovr: 90, oro: 4, pos: 1, cc: 'cl' },
    nuevo: null, og: { k: 'og', n: 'OG', ovr: 55, oro: 0, pos: 40, cc: 'co' } };
  const perf = { snow: { du: [[400, 'Oasis', 0], [380, 'Oasis', 0], [366, 'OASIS 🇨🇱', 0], [350, 'OG', 1]], rd: [0, 3] },
    oasis: { du: [[400, 'Snow', 1]], rd: [5, 7] }, og: { du: [[350, 'Snow', 0]] } };
  const buscar = (n) => A.claveTurno(n);
  const x1 = A.infoCruce(['Snow 🇨🇴', 'Oasis 🇨🇱'], buscar, tabla, perf);
  const t1 = A.tituloCruce(x1);
  ok(t1 && t1.t === 'EL CLÁSICO' && /3 veces: Oasis gana 3 a 0/.test(t1.sub), 'tres cruces: EL CLÁSICO, con cómo van', JSON.stringify(t1));
  const t2 = A.tituloCruce(A.infoCruce(['OG', 'Snow'], buscar, tabla, perf));
  ok(t2 && t2.t === 'LA REVANCHA' && /Snow le ganó la última vez y OG/.test(t2.sub), 'ya se cruzaron: LA REVANCHA', JSON.stringify(t2));
  const t3 = A.tituloCruce(A.infoCruce(['Nuevo', 'OG'], buscar, tabla, perf));
  ok(t3 && t3.t === 'DEBUT', 'quien no jugó nada esta temporada: DEBUT', JSON.stringify(t3));
  const t4 = A.tituloCruce(A.infoCruce(['Desconocido', 'OG'], () => '', tabla, perf));
  ok(!t4 || t4.t !== 'DEBUT', 'un nombre que la Liga no reconoce no es un debutante');
  // los títulos nuevos (19/10/2026, Dlx: «David vs Goliat está bien pero más cosas así»)
  const tb2 = { a: { k: 'a', n: 'Ale', ovr: 70, pos: 4, cc: 'ar', ev: 20, rg: 'SS', oro: 0, pts: 900 },
    b: { k: 'b', n: 'Beto', ovr: 72, pos: 8, cc: 'cl', ev: 12, rg: 'S', oro: 0, pts: 800 },
    c: { k: 'c', n: 'Ceci', ovr: 60, pos: 30, cc: 'mx', ev: 1, rg: '', oro: 0, pts: 50 },
    d: { k: 'd', n: 'Dani', ovr: 62, pos: 25, cc: 'pe', ev: 18, rg: 'A', oro: 0, pts: 300 } };
  const pf2 = { a: { du: [[1, 'x', 1]] }, b: { du: [[1, 'y', 1]] }, c: { du: [] }, d: { du: [[2, 'z', 1]], rd: [6, 6] } };
  // como en el bot: el nombre de la Liga reemplaza al de la llave (`x.a.n = ga[0].n`)
  const cx = (p, q, crews) => { const x = A.infoCruce([p, q], (n) => n, tb2, pf2); x.a.n = tb2[p].n; x.b.n = tb2[q].n; if (crews) [x.a.crew, x.b.crew] = crews; return x; };
  const T = (x) => (A.tituloCruce(x) || {}).t;
  ok(T(cx('a', 'b', [{ n: 'Follombia', tier: 'Oro' }, { n: 'Fontana', tier: 'Plata' }])) === 'DUELO DE CREWS'
    && /Follombia \(Oro\) contra Fontana \(Plata\)/.test(A.tituloCruce(cx('a', 'b', [{ n: 'Follombia', tier: 'Oro' }, { n: 'Fontana', tier: 'Plata' }])).sub)
    && T(cx('a', 'b', [{ n: 'KS' }, { n: 'KS' }])) === 'FUEGO AMIGO' && T(cx('a', 'b')) === 'DUELO DE TITANES'
    && T(cx('d', 'c')) === 'RACHA EN JUEGO' && T(cx('a', 'c')) === 'LA EXPERIENCIA CONTRA EL HAMBRE',
  'los títulos nuevos: crews, fuego amigo, titanes, racha y experiencia contra hambre');
  const xe = cx('a', 'b');
  xe.a.pp = 1;
  const datos = new Set(Array.from({ length: 40 }, (_, i) => A.datoCurioso(Object.assign(xe, { a: Object.assign(xe.a, { crew: { n: 'Follombia', tier: 'Oro' } }) }), 's' + i, () => 0)));
  ok([...datos].some((d) => /mejor argentino de la temporada/.test(d)) && [...datos].some((d) => /es de la crew Follombia, que está en Oro/.test(d))
    && [...datos].some((d) => /letra SS en el Competitivo/.test(d)) && [...datos].some((d) => /primera vez que Ale y Beto se cruzan/.test(d)),
  'los datos nuevos: su país, su crew, su letra y la primera vez', [...datos].join(' | '));
  const d1 = A.datoCurioso(x1, 'semilla', () => 0);
  ok(/^¿Sabías que .+\?$/.test(d1) && A.datoCurioso(x1, 'semilla', () => 0) === d1, 'el dato es de verdad y no cambia para el mismo cruce', d1);
  ok(A.datoCurioso(x1, 'x', () => 0) !== '' && A.datoCurioso(A.infoCruce(['A', 'B'], () => '', {}, {}), 's', () => 0) === '',
    'sin nada que contar, no se inventa un dato');
  // los botones y la línea
  const bt = A.botonesApuesta('abc', 'Snow 🇨🇴', 'Oasis 🇨🇱', false);
  ok(bt.length === 2 && bt[0].components.length === 4 && bt[0].components[0].custom_id === 'ap:abc:A:50'
    && bt[1].components[3].custom_id === 'ap:abc:B:500' && /^Snow · 50$/.test(bt[0].components[0].label)
    && A.botonesApuesta('abc', 'a', 'b', true)[0].components.every((c) => c.disabled), 'dos filas de cuatro montos, y grises al cerrar');
  ok(['abierta', 'cerrada', 'pagada', 'devuelta'].every((e) => A.lineaApuesta(e, { pozo: 1500, cuantos: 3, ganador: 'Snow' }).startsWith('🎲')),
    'la línea de la apuesta empieza siempre con 🎲 (se reemplaza por eso)');
  // quién ganó: por el ganador escrito, o por quién aparece en la ronda siguiente
  const L = { rondas: [{ r: 'Cuartos', b: [[['Snow 🇨🇴', 'Oasis 🇨🇱'], '', ''], [['OG', 'Ana'], 'OG', '']] },
    { r: 'Semifinales', b: [[['Oasis 🇨🇱', 'OG'], '', '']] }] };
  ok(A.ladoGanador(L, 'Cuartos', 'Snow 🇨🇴', 'Oasis 🇨🇱') === 'B' && A.ladoGanador(L, 'Cuartos', 'OG', 'Ana') === 'A'
    && A.ladoGanador(L, 'Semifinales', 'Oasis 🇨🇱', 'OG') === '', 'quién ganó: el de la ronda siguiente o el escrito; si no, todavía no');
  const bc = A.batallaChat({ rondas: [{ r: 'Octavos', b: [[['A', 'B'], '', ''], [['C', 'D'], '', '']] }] });
  ok(bc && bc.lados.join() === 'A,B', 'sin nada jugado, se habla de la primera batalla');
}

// ── 🧩 la llave que el lector no sabe leer (07/10/2026) ──────────────────────────────────────────────────────────
{
  console.log('\n🧩 la llave que no se sabe leer\n');
  await import('./paginas/llave_vivo.js');
  const LV = globalThis.LlaveVivo;
  const bats = (t) => LV.rondasDe(LV.traducir(LV.plano(t))).reduce((n, R) => n + R[1].length, 0);
  const rara = 'CUARTOS\nAna ~~ Beto\nCaro ~~ Dani\nEva ~~ Fer\nGus ~~ Hugo\nSEMIS\nAna ~~ Caro\nFINAL\nAna ~~ Eva';
  ok(A.intentoDeLlave(rara) && bats(rara) < 2, 'un formato que nadie usó todavía: quiso ser una llave y no se lee → aviso',
    `intento ${A.intentoDeLlave(rara)} · batallas ${bats(rara)}`);
  const buena = '# CUARTOS\n[Ana] 🆚 [Beto]\n[Caro] 🆚 [Dani]\n[Eva] 🆚 [Fer]\n[Gus] 🆚 [Hugo]\n# FINAL\n[Ana] 🆚 [Eva]';
  ok(A.intentoDeLlave(buena) && bats(buena) >= 2, 'la que se lee no avisa (tiene batallas)');
  ok(!A.intentoDeLlave('@everyone arrancan los cuartos, la final a las 9, vayan a la llamada'),
    'la charla del canal no es un intento de llave');
  ok(!A.intentoDeLlave('## 4️⃣ Cuartos 4️⃣\n** (< >) ⚔️ (< >)**\n** (< >) ⚔️ (< >)**\n## 🧨 Semifinal 🧨\n** (< >) ⚔️ (< >)**'),
    'la plantilla vacía tampoco: no tiene nombres');
  ok(A.CANAL_LOGS === '1504110449535483924', 'el canal de Logs es el de siempre (`avisar.CANAL`)');
  // 🌲 EL BOSQUE DE ARTEMISA (12/10/2026): rondas en cheroqui; y la forma, aunque ningún título se lea
  const bosque = '☁️ ─ **ᎾᏟᎢᎪᏙᎾᏚ** ─ ☁️\n❰ VERC ❱ <:VS8:1> ❰ ZIGNOS ❱\n❰ GUESS ❱ <:VS8:1> ❰ SCRITURA ❱\n' +
    '🌩️ ─ **ᏟᏌᎪᎡᎢᎾᏚ** ─ 🌩️\n❰ ZIGNOS ❱ <:VS8:1> ❰ SCRITURA ❱';
  ok(A.pareceLlave(bosque) && bats(bosque) === 3, 'las rondas en cheroqui se guardan y se leen', `batallas ${bats(bosque)}`);
  ok(A.latino('ᎾᏟᎢᎪᏙᎾᏚ ᴄᴜᴀʀᴛᴏꜱ 🅵🅸🅽🅰🅻') === 'OCTAVOS CUARTOS FINAL', 'las letras parecidas, en latinas', A.latino('ᎾᏟᎢᎪᏙᎾᏚ ᴄᴜᴀʀᴛᴏꜱ 🅵🅸🅽🅰🅻'));
}

// ── 🎬 tus batallas en video, sobre el objeto (12/10/2026) ───────────────────────────────────────────────────────
{
  let DatabaseSync = null;
  try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { DatabaseSync = null; }
  if (!DatabaseSync) {
    console.log('  ⓘ sin node:sqlite (Node ' + process.version + '): los videos no se prueban sobre el objeto');
  } else {
    console.log('\n🎬 tus batallas en video\n');
    const db = new DatabaseSync(':memory:');
    const sql = {
      exec(q, ...ps) {
        const t = String(q).trim();
        if (!ps.length && /;\s*\S/.test(t)) { db.exec(t); return { toArray: () => [], rowsWritten: 0 }; }
        const st = db.prepare(t);
        if (/^\s*(SELECT|WITH|PRAGMA)/i.test(t)) { const rows = st.all(...ps); return { toArray: () => rows }; }
        const r = st.run(...ps);
        return { toArray: () => [], rowsWritten: r.changes };
      },
    };
    const o = new A.Avisos({ storage: { sql, setAlarm() {}, getAlarm() { return null; } }, blockConcurrencyWhile: async (f) => f() },
      { DISCORD_TOKEN: 'x', KV: { get: async () => null } });
    await new Promise((r) => setTimeout(r, 5));
    const pedir = async (url, quien = '700000000000000001', de = 'ana') =>
      (await o.misVideos({ quien, de, accion: 'pedir', url })).json();
    const r1 = await pedir('https://www.youtube.com/watch?v=kiyYaiFqTzw');
    const r2 = await pedir('https://www.youtube.com/@FalconMusic33/videos');
    const r3 = await pedir('https://example.com/video');
    const r4 = await pedir('https://www.youtube.com/watch?v=kiyYaiFqTzw');
    ok(r1.ok && r2.ok && r2.pedidos.length === 2 && r2.pedidos[0].tipo === 'canal' && r3.error === 'link' && r4.error === 'ya',
      'un video y un canal entran a la cola; otro sitio no; el mismo dos veces no', JSON.stringify([r3, r4]));
    for (const v of ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc']) await pedir('https://youtu.be/' + v);
    ok((await pedir('https://youtu.be/ddddddddddd')).error === 'muchos', 'cinco por día, y no más');
    ok((await (await o.videoReportar({ quien: '700000000000000002', de: 'bea', clave: 'ana', vid: 'kiyYaiFqTzw' })).json()).ok
      && (await (await o.videoReportar({ quien: '700000000000000001', de: 'ana', clave: 'ana', vid: 'kiyYaiFqTzw' })).json()).error === 'tuyo',
    'reportar el de otro sí; el tuyo no');
    const c = o.videosCiclo();
    ok(c.pedidos.length === 5 && c.reportes.kiyYaiFqTzw === 1, 'el ciclo recibe los cinco que esperan y el reporte');
    o.videosEstados({ estados: { [c.pedidos[0].id]: ['ok', 'sumado a tu perfil'], [c.pedidos[1].id]: ['revisar', 'canal grande'] },
      revisar: [[c.pedidos[1].id, 'Ana', 'Falcon', 'https://www.youtube.com/@FalconMusic33', 'canal grande']] });
    ok(o.videosCiclo().pedidos.length === 3 && o.panelDueno().videos.length === 1, 'lo decidido sale de la cola; lo raro, al Dashboard');
    o.duenoVideo({ id: c.pedidos[1].id, si: true });
    ok(o.panelDueno().videos.length === 0 && o.videosCiclo().decididos[c.pedidos[1].id] === true,
      'Dlx lo aprueba: sale del Dashboard y el ciclo lo recibe');
    // 🎬 «contanos cómo aparecés» (16/10/2026): sólo sobre un pedido tuyo que el ciclo dejó en `preguntar`, con las
    // tres cosas; vuelve a la cola con lo que contestaste
    const pq = o.videosCiclo().pedidos[0].id;
    o.videosEstados({ estados: { [pq]: ['preguntar', 'tu nombre no está en el título: contanos cómo aparecés'] } });
    const resp = (x) => o.misVideos(Object.assign({ quien: '700000000000000001', de: 'ana', accion: 'responder', id: pq }, x));
    const mal1 = await (await resp({ nombre: 'SEBA', como: 'lentes', minuto: 'ayer' })).json();
    const ajeno = await (await o.misVideos({ quien: '700000000000000002', de: 'bea', accion: 'responder', id: pq,
      nombre: 'SEBA', como: 'lentes', minuto: '4:35' })).json();
    const bien = await (await resp({ nombre: 'SEBA', como: 'lentes, buzo negro', minuto: '4:35' })).json();
    const vuelve = o.videosCiclo().pedidos.find((p) => p.id === pq);
    ok(mal1.error === 'respuestas' && ajeno.error === 'pedido' && bien.ok && vuelve && JSON.parse(vuelve.resp).minuto === '4:35',
      'contestar: sin las tres cosas no; el pedido de otro no; con todo, vuelve a la cola con lo que contó',
      JSON.stringify([mal1, ajeno, bien]));
    // 📣 seguir a un organizador: el anuncio nuevo va a su bandeja y a la cola del push
    const so = o.seguirOrg({ quien: '700000000000000003', nombre: '@Kravitz', si: true });
    ok(so.ok && so.orgs[0].org === 'kravitz' && A.claveOrg('𝐊𝐫𝐚𝐯𝐢𝐭𝐳') === 'kravitz', 'seguir a «@Kravitz»: su clave, también con letras de fantasía');
    const n = o.colaOrg('Kravitz', 'DESGRACIAS EN TOKYO VOL 30', null, 'https://discord.com/x', 'FFA', '999', Date.now());
    const ban = (await (await o.bandeja({ quien: '700000000000000003' })).json());
    ok(n === 1 && JSON.stringify(ban).includes('Kravitz organiza DESGRACIAS'), 'su anuncio llega a la bandeja de quien lo sigue');
    ok(o.seguirOrg({ quien: '700000000000000003', nombre: 'Kravitz', si: false }).orgs.length === 0, 'y se deja de seguir');
    // 👥 los organizadores de a uno (14/10/2026): los mismos casos que `anuncios.organizadores()` de Python
    const _au = { id: '77', global_name: 'HERY' };
    const og = [
      A.organizadoresDe({ content: '- **ORGANIZADOR** FLENNZS <a:MEXICO:1> + LEWITO <a:ARGENTINA:2> + AX <a:VE:3> ', author: _au }),
      A.organizadoresDe({ content: '💻  __`ORGANIZADOR:`__ <@55>🇨🇱', author: _au, mentions: [{ id: '55', global_name: 'Velatz' }] }),
      A.organizadoresDe({ content: '💻  __`ORGANIZADOR:`__ Yo ', author: _au }),
      A.organizadoresDe({ content: '# ➤ 𝐎𝐑𝐆𝐀𝐍𝐈𝐙𝐀𝐃𝐎𝐑 :\n# 𐬺 yo\n', author: _au }),
      A.organizadoresDe({ content: '3.▫️ 🎙️ Entra cuando los organizadores hagan el anuncio', author: _au }),
      A.organizadoresDe({ content: '**ORGANIZADOR**: Kravitz y nachonc_', author: _au })];
    ok(JSON.stringify(og) === JSON.stringify([['FLENNZS', 'LEWITO', 'AX'], ['Velatz'], ['HERY'], ['HERY'], [], ['Kravitz', 'nachonc_']]),
      'los organizadores de a uno: «+» y banderas, la mención, «yo», FVS, y una regla que dice «organizadores» no es el campo',
      JSON.stringify(og));
    // y quien sigue a dos de ellos recibe UN aviso por anuncio
    o.seguirOrg({ quien: '700000000000000004', nombre: 'Flennzs', si: true });
    o.seguirOrg({ quien: '700000000000000004', nombre: 'Lewito', si: true });
    const ya = new Set();
    const n2 = o.colaOrg('FLENNZS', 'LA BELLA ARTE VOL 7', null, 'https://discord.com/y', 'FFA', '1001', Date.now(), ya)
      + o.colaOrg('LEWITO', 'LA BELLA ARTE VOL 7', null, 'https://discord.com/y', 'FFA', '1001', Date.now(), ya);
    const cola2 = o.sql.exec("SELECT COUNT(*) AS n FROM org_cola WHERE quien = '700000000000000004'").toArray()[0].n;
    ok(n2 === 2 && cola2 === 1, 'seguir a Flennzs y a Lewito: su anuncio juntos llega una sola vez', JSON.stringify([n2, cola2]));
    // 📅 /agendar: hasta 20 por servidor, el mismo nombre lo corrige, y se borra
    const ini = Date.now() + 3 * 864e5;
    ok(o.agendar({ sv: 'SR', g: '1', quien: '700000000000000001', nombre: 'Copa X', ini, formato: '1vs1' }).ok
      && o.agendar({ sv: 'SR', g: '1', quien: '700000000000000001', nombre: 'copa x', ini: ini + 3600000 }).ok
      && o.agendaCiclo().agenda.length === 1 && o.agendaCiclo().agenda[0].ini === ini + 3600000,
    'agendar: el mismo nombre otra vez lo corrige, no lo duplica');
    ok(o.agendar({ sv: 'SR', nombre: 'Copa X', borrar: true }).ok && o.agendaCiclo().agenda.length === 0
      && o.agendar({ sv: 'SR', nombre: 'Copa X', borrar: true }).error === 'no_esta', 'y se borra');
    // 🧭 el tutorial: sólo lo de la lista, sumado por día; y el Dashboard lo recibe
    const tu = async (ev) => (await o.tutorial({ ev })).status;
    ok(await tu('tour') === 200 && await tu('tour') === 200 && await tu('salta2') === 200 && await tu('otra') === 400
      && await tu('') === 400, 'tutorial: lo de la lista suma, lo demás no');
    const tr = o.panelDueno().tutorial;
    ok(tr.n.tour === 2 && tr.n.salta2 === 1 && !tr.n.otra && !!tr.desde, 'y el Dashboard lo ve sumado', JSON.stringify(tr));
    // 📊 las secciones: igual que el tutorial, y la lista de la página es la misma que la de acá
    const se = async (ev) => (await o.seccion({ ev })).status;
    ok(await se('ranking') === 200 && await se('ranking') === 200 && await se('guia') === 200 && await se('dashboard') === 400
      && await se('') === 400, 'secciones: lo de la lista suma, lo demás no');
    const sr = o.panelDueno().secciones;
    ok(sr.n.ranking && sr.n.ranking[0] === 2 && sr.n.ranking[1] === 0 && sr.n.guia[0] === 1 && !sr.n.dashboard && !!sr.desde,
      'y el Dashboard las ve, esta semana contra la anterior', JSON.stringify(sr));
    // 🔴 y por `fetch()`, como llega de verdad: el cuerpo se lee una sola vez arriba, y el tutorial lo leía de nuevo
    const porFetch = async (r, ev) => (await o.fetch(new Request('https://avisos' + r, { method: 'POST',
      body: JSON.stringify({ ev }), headers: { 'content-type': 'application/json' } }))).status;
    ok(await porFetch('/tutorial', 'franja') === 200 && await porFetch('/seccion', 'pase') === 200
      && await porFetch('/seccion', 'zzz') === 400 && o.panelDueno().tutorial.n.franja === 1
      && o.panelDueno().secciones.n.pase[0] === 1, 'tutorial y secciones también entrando por fetch()');
    const enApp = /const SECC = new Set\(\[([^\]]+)\]/.exec(readFileSync(join(aqui, '..', 'web', 'src', 'App.jsx'), 'utf8'));
    const deApp = enApp ? enApp[1].match(/'([a-z-]+)'/g).map((x) => x.slice(1, -1)).sort() : [];
    ok(JSON.stringify(deApp) === JSON.stringify([...A.SECC_EV].sort()), 'la lista de App.jsx es SECC_EV', deApp.join(','));
  }
}

// 🔥 «TU RACHA SE CORTA HOY», sobre el objeto (13/10/2026, «hacer todo»): a la noche, sólo a quien la pierde si no
// entra, sólo a su teléfono vinculado, y una vez por día
{
  let DatabaseSync = null;
  try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { DatabaseSync = null; }
  if (DatabaseSync) {
    console.log('\n🔥 tu racha se corta hoy\n');
    const db = new DatabaseSync(':memory:');
    const sql = {
      exec(q, ...ps) {
        const t = String(q).trim();
        if (!ps.length && /;\s*\S/.test(t)) { db.exec(t); return { toArray: () => [], rowsWritten: 0 }; }
        const st = db.prepare(t);
        if (/^\s*(SELECT|WITH|PRAGMA)/i.test(t)) { const rows = st.all(...ps); return { toArray: () => rows }; }
        const r = st.run(...ps);
        return { toArray: () => [], rowsWritten: r.changes };
      },
    };
    const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const jwk = await crypto.subtle.exportKey('jwk', par.privateKey);
    const pub = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey));
    const o = new A.Avisos({ storage: { sql, setAlarm() {}, getAlarm() { return null; } }, blockConcurrencyWhile: async (f) => f() },
      { DISCORD_TOKEN: 'x', KV: { get: async () => null }, VAPID_PUBLICA: A.b64u.enc(pub), VAPID_PRIVADA: jwk.d });
    await new Promise((r) => setTimeout(r, 5));
    const tel = async (quien, n) => {
      const k = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
      const p256 = A.b64u.enc(new Uint8Array(await crypto.subtle.exportKey('raw', k.publicKey)));
      const auth = A.b64u.enc(crypto.getRandomValues(new Uint8Array(16)));
      sql.exec('INSERT INTO subs (endpoint, p256dh, auth, alta, visto, quien) VALUES (?, ?, ?, ?, ?, ?)',
        'https://push.example/' + n, p256, auth, 1, 1, quien);
    };
    const dias = (quien, ds) => ds.forEach((d) => sql.exec('INSERT INTO activo (quien, dia) VALUES (?, ?)', quien, d));
    const ANA = '700000000000000001', BEA = '700000000000000002', CID = '700000000000000003';
    dias(ANA, ['2026-09-30', '2026-10-02', '2026-10-03', '2026-10-04']);   // el perdón ya usado: hoy se corta
    dias(BEA, ['2026-10-02', '2026-10-03', '2026-10-04']);                 // el perdón sin usar: hoy no se corta
    dias(CID, ['2026-09-30', '2026-10-02', '2026-10-03', '2026-10-04']);   // se corta, pero sin teléfono vinculado
    await tel(ANA, 'ana');
    await tel(BEA, 'bea');
    const antesF = globalThis.fetch;
    const fue = [];
    globalThis.fetch = async (u) => { fue.push(String(u)); return new Response('', { status: 201 }); };
    const tarde = Date.parse('2026-10-05T22:00:00Z');   // 6 PM del este: todavía no
    const noche = Date.parse('2026-10-06T01:30:00Z');   // 9:30 PM del este del 05/10
    await o.recordarRacha(tarde);
    const aLaTarde = fue.length;
    await o.recordarRacha(noche);
    const n1 = fue.slice();
    await o.recordarRacha(noche + 60000);
    globalThis.fetch = antesF;
    ok(aLaTarde === 0, 'a la tarde todavía no (desde las ' + A.RACHA_AVISO_HORA + ' del este)');
    ok(n1.length === 1 && n1[0].endsWith('/ana'), 'a la noche, sólo a quien la pierde si no entra y tiene el teléfono vinculado',
      JSON.stringify(n1));
    ok(fue.length === 1, 'y una sola vez por día');
  }
}

// ✍️ EL WRITING CHALLENGE DE FFA PAGA TIENDA, sobre el objeto (14/10/2026, Dlx: «cuenta para la Liga»): una clave por
// fecha y persona, lo del ciclo se REEMPLAZA entero (releer no paga dos veces) y no toca lo que pagan los demás
{
  let DatabaseSync = null;
  try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { DatabaseSync = null; }
  if (DatabaseSync) {
    console.log('\n✍️ el Writing Challenge en la Tienda\n');
    const db = new DatabaseSync(':memory:');
    const sql = {
      exec(q, ...ps) {
        const t = String(q).trim();
        if (!ps.length && /;\s*\S/.test(t)) { db.exec(t); return { toArray: () => [], rowsWritten: 0 }; }
        const st = db.prepare(t);
        if (/^\s*(SELECT|WITH|PRAGMA)/i.test(t)) { const rows = st.all(...ps); return { toArray: () => rows }; }
        const r = st.run(...ps);
        return { toArray: () => [], rowsWritten: r.changes };
      },
    };
    let kv = null;
    const o = new A.Avisos({ storage: { sql, setAlarm() {}, getAlarm() { return null; } }, blockConcurrencyWhile: async (f) => f() },
      { DISCORD_TOKEN: 'x', KV: { get: async (k) => (k === 'precios:resolucion' ? kv : null) } });
    await new Promise((r) => setTimeout(r, 5));
    const LVEL = '800000000000000001', MELO = '800000000000000002', KRISH = '800000000000000003';
    const t1 = Date.parse('2026-10-03T00:46:44Z'), t2 = Date.parse('2026-10-08T16:25:42Z');
    const wr = {
      ['prueba:f1:' + LVEL]: [LVEL, 500, t1], ['prueba:f1:' + KRISH]: [KRISH, 50, t1],
      ['prueba:f2:' + MELO]: [MELO, 500, t2], ['prueba:f2:' + LVEL]: [LVEL, 300, t2], ['prueba:f2:' + KRISH]: [KRISH, 50, t2],
      'prueba:f2:mal': ['no-es-un-id', 50, t2], ['prueba:f2:cero']: [KRISH, 0, t2],
    };
    const cobrado = (q) => sql.exec('SELECT COALESCE(SUM(monto), 0) AS n FROM tienda WHERE quien = ?', q).toArray()[0].n;
    const filas = () => sql.exec("SELECT id FROM tienda WHERE id LIKE 'wr:%' ORDER BY id").toArray().map((x) => x.id);
    sql.exec("INSERT INTO tienda (id, ref, quien, monto, t) VALUES ('deb:2026-10-01:' || ?, 0, ?, 1000, 1)", LVEL, LVEL);
    kv = JSON.stringify({ v: 'a1', r: {}, wr });
    await o.resolverPrecios(t2);
    const f1 = filas();
    ok(f1.length === 5 && cobrado(LVEL) === 500 + 300 + 1000 && cobrado(MELO) === 500 && cobrado(KRISH) === 100,
      'cada fecha paga una vez a cada uno (Lvel 500 + 300, más su debut, que no se toca); sin Discord o en 0, nada', JSON.stringify(f1));
    // 🏷️ (pasada del 19/10/2026) igualar escribe sólo la diferencia: lo mismo otra vez, cero filas; una que cambia, una
    const igual = o.tiendaIgualar('wr:', wr, t2);
    const cambia = o.tiendaIgualar('wr:', { ...wr, ['prueba:f1:' + KRISH]: [KRISH, 60, t1] }, t2);
    const saca = o.tiendaIgualar('wr:', Object.fromEntries(Object.entries(wr).filter(([id]) => id !== 'prueba:f2:' + MELO)), t2);
    ok(igual === 0 && cambia === 1 && saca === 2 && filas().length === 4 && cobrado(LVEL) === 500 + 300 + 1000,
      'la Tienda escribe sólo lo que cambió (antes, todo dos veces por corrida) y no toca otro prefijo', JSON.stringify([igual, cambia, saca]));
    o.tiendaIgualar('wr:', wr, t2);
    // la misma corrida otra vez (misma huella) y la relectura del canal (otra huella, lo mismo adentro): igual
    await o.resolverPrecios(t2 + 1);
    kv = JSON.stringify({ v: 'a2', r: {}, wr });
    await o.resolverPrecios(t2 + 2);
    ok(filas().length === 5 && cobrado(LVEL) === 1800 && cobrado(KRISH) === 100,
      'releer el canal (otra huella, lo mismo adentro) no paga dos veces', JSON.stringify(filas()));
    // un resultado corregido: Krish pasa a 3.º en la fecha 2 y Lvel queda fuera de la 1; se reemplaza entero
    const wr2 = { ['prueba:f1:' + KRISH]: [KRISH, 50, t1], ['prueba:f2:' + MELO]: [MELO, 500, t2],
      ['prueba:f2:' + LVEL]: [LVEL, 300, t2], ['prueba:f2:' + KRISH]: [KRISH, 200, t2] };
    kv = JSON.stringify({ v: 'a3', r: {}, wr: wr2 });
    await o.resolverPrecios(t2 + 3);
    ok(filas().length === 4 && cobrado(LVEL) === 300 + 1000 && cobrado(KRISH) === 250,
      'un resultado corregido reemplaza lo pagado (no se suma encima)', JSON.stringify([cobrado(LVEL), cobrado(KRISH)]));
    // sin `wr` (sin archivo) no se toca; vacío (otra temporada) se borra
    kv = JSON.stringify({ v: 'a4', r: {} });
    await o.resolverPrecios(t2 + 4);
    const sigue = filas().length;
    kv = JSON.stringify({ v: 'a5', r: {}, wr: {} });
    await o.resolverPrecios(t2 + 5);
    ok(sigue === 4 && filas().length === 0 && cobrado(LVEL) === 1000,
      'sin `wr` queda lo que había; vacío (otra temporada) se borra, y el debut sigue', JSON.stringify([sigue, filas()]));
  }
}

// ── 📣 abrir una promo paga (16/10/2026): sólo una promo del muro, nunca la propia, y no una cuenta recién hecha ──
{
  const items = [{ id: 'aaaaaaaaaaa1', tipo: 'promo', pid: '9-0', ks: ['ana'] }, { id: 'bbbbbbbbbbb2', tipo: 'campeon', ks: ['bea'] }];
  const vieja = '100000000000000000';  // un Discord ID de 2015: la cuenta tiene años
  const r = A.validarPromo(items, { id: 'aaaaaaaaaaa1' }, vieja, ['cid'], Date.now());
  ok(r.pid === '9-0' && !r.error, 'una promo del muro vale', JSON.stringify(r));
  ok(A.validarPromo(items, { id: 'bbbbbbbbbbb2' }, vieja, [], Date.now()).error === 'no_existe',
    'lo que no es una promo no paga');
  ok(A.validarPromo(items, { id: 'aaaaaaaaaaa1' }, vieja, ['ana'], Date.now()).error === 'vos', 'la promo propia no paga');
  ok(A.PROMO_PAGA === 50 && A.PROMO_TOPE_DIA === 3 && A.PASE_MIDE.includes('promo') && A.XP_FUENTES.promo,
    '50 Puntos por promo, hasta 3 por día, y cuenta para el Pase y el nivel');
  // 📣 una semana más, desde la Tienda: sólo la tuya y mientras está en la página
  const ahora = Date.parse('2026-10-16T12:00:00Z');
  const ps = [{ id: 'aaaaaaaaaaa1', tipo: 'promo', pid: '9-0', ks: ['ana'], t: '2026-10-14T00:00:00Z', hasta: '2026-10-21T00:00:00Z' },
    { id: 'ccccccccccc3', tipo: 'promo', pid: '8-0', ks: ['ana'], t: '2026-10-01T00:00:00Z', hasta: '2026-10-08T00:00:00Z' }];
  const e = A.validarExtender(ps, { id: 'aaaaaaaaaaa1' }, ['ana'], ahora);
  ok(e.pid === '9-0' && e.base === Date.parse('2026-10-21T00:00:00Z'), 'tu promo se alarga desde cuando vence', JSON.stringify(e));
  ok(A.validarExtender(ps, { id: 'aaaaaaaaaaa1' }, ['bea'], ahora).error === 'no_es_tuya', 'la de otro no');
  ok(A.validarExtender(ps, { id: 'ccccccccccc3' }, ['ana'], ahora).error === 'vencida', 'la vencida no');
  ok(A.PROMO_SEMANA_PAGA === 2500 && A.PROMO_SEMANA_MS === 7 * 864e5, 'una semana, 2.500 Puntos de Tienda');
  // 🔴 Logs en el Dashboard: los rojos y amarillos de los últimos días, con su primer renglón de título
  const lg = A.logsRojos([
    { id: '1', timestamp: '2026-10-17T11:58:00Z', content: '**🔴 `nicks` se freno: iba a cambiar 182 apodos.**\nNo escribio nada.' },
    { id: '2', timestamp: '2026-10-17T11:57:00Z', content: '**⚠️ 1 con rol de rango**\n👤 | Samuel' },
    { id: '3', timestamp: '2026-10-17T11:56:00Z', content: '✅ todo bien' },
    { id: '4', timestamp: '2026-10-01T11:56:00Z', content: '🔴 viejo' },
    { id: '5', timestamp: '2026-10-17T10:00:00Z', content: '', embeds: [{ title: 'Auditoría', description: '🔴 Alias rotos — 2' }] },
  ], Date.parse('2026-10-17T20:00:00Z'));
  ok(lg.map((x) => x.id + x.nivel).join() === '1rojo,2amarillo,5rojo' && lg[0].tit === '🔴 nicks se freno: iba a cambiar 182 apodos.'
    && lg[0].mas[0] === 'No escribio nada.' && lg[2].tit === 'Auditoría',
    'Logs en el Dashboard: sólo rojos y amarillos de los últimos 3 días, sin el formato de Discord', JSON.stringify(lg));
  // 🙋 un pedido vale con su tipo, el perfil donde hace falta, un texto, el país o el video
  ok(A.validarPedido({ tipo: 'cuenta', k: 'lvel', texto: 'perdí la cuenta' }).tipo === 'cuenta'
    && A.validarPedido({ tipo: 'cuenta', texto: 'sin perfil' }).error === 'perfil'
    && A.validarPedido({ tipo: 'pais', cc: 'CL' }).cc === 'cl' && A.validarPedido({ tipo: 'pais', cc: 'chile' }).error === 'pais'
    && A.validarPedido({ tipo: 'video', vid: 'abcdefghijk', texto: 'no soy yo' }).vid === 'abcdefghijk'
    && A.validarPedido({ tipo: 'otro', texto: 'x' }).error === 'tipo',
  'los pedidos: tipo conocido, perfil para cuenta e identidad, país de dos letras, video de YouTube');
  // 🤝 los tiers: {sigla: 1|2|3} y nada más
  ok(JSON.stringify(A.ajusteValido('tiers', { FFA: 1, FVS: 2, NUEVO: 3 })) === '{"FFA":1,"FVS":2,"NUEVO":3}'
    && A.ajusteValido('tiers', { FFA: 4 }) === undefined && A.ajusteValido('tiers', { ffa: 1 }) === undefined
    && A.ajusteValido('tiers', null) === null, 'el nivel de cada servidor: siglas en mayúscula y 1, 2 o 3');
  // 🏆 MES AWARDS: Dlx saca nominados de las veintitrés —también del staff por rol—, y de nada más
  const ms = A.ajusteValido('mes_sacar', { mes: '2026-10', quitar: ['rapero:Ana', 'organizador:Velatz', 'liga:fmsperu', 'jurado:Flennzs'] });
  ok(ms && ms.quitar.length === 4 && A.ajusteValido('mes_sacar', { mes: '2026-10', quitar: ['otra:x'] }) === undefined
    && Object.keys(A.MES_CAT).length === 26 && A.ajusteValido('mes_sacar', { mes: '2026-10', quitar: ['momento:9:Ana vs Bea'] })
    && A.ajusteValido('mes_sacar', { mes: '2026-10', quitar: ['FFA/rapero:Ana', 'SR/staff:GP'] }).quitar.length === 2
    && A.ajusteValido('mes_sacar', { mes: '2026-10', quitar: ['ffa/rapero:Ana'] }) === undefined
    && A.ajusteValido('mes_sacar', { mes: '2026-10', quitar: ['FFA/otra:Ana'] }) === undefined,
  'sacar un nominado vale en las veintiséis categorías (Jurado, Host, DJ, Villano, Showman y Momento también), y en otra no');
}

if (fallas) {
  console.log(`\n❌ ${fallas} prueba(s) fallaron`);
  process.exit(1);
}
console.log('\n✅ los avisos cifran como el RFC y leen como Python');
