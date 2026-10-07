// LA LLAVE EN VIVO DE LA PÁGINA, CONTRA EL LECTOR DE PYTHON.
//
//     node bot/llave_vivo_prueba.mjs
//
// 🔑 EL CONTRATO: `bot/llaves_casos.json` guarda llaves reales y las rondas
// que `escuchar.rondas_de(traducir(plano(t)))` saca de cada una. Esto
// comprueba que `bot/paginas/llave_vivo.js` saque exactamente lo mismo. Lo
// corre CI junto con `python bot/llaves_casos.py --auto`: si se toca un lado
// solo, se pone rojo el otro. Ver el encabezado de `bot/llaves_casos.py`.
//
// ⚠️ SE CARGA EN UN CONTEXTO APARTE (`vm`), como un <script> más: el archivo
// es de la página, no un módulo, y así se prueba el mismo que se sirve.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
// en el Worker `crypto` es global; en Node 18 no (la clave del ciclo lo usa)
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const aqui = dirname(fileURLToPath(import.meta.url));
const ctx = {};
vm.createContext(ctx);
vm.runInContext(readFileSync(join(aqui, 'paginas', 'llave_vivo.js'), 'utf8'), ctx);
const LV = ctx.LlaveVivo;
let mal = 0;
const ok = (que, bien, detalle) => {
  if (!bien) mal++;
  console.log(`   ${bien ? '✅' : '🔴'} ${que}${!bien && detalle ? `\n      ${detalle}` : ''}`);
};
const js = (x) => JSON.stringify(x);

console.log('\n1 · las rondas, contra Python (bot/llaves_casos.json)\n');
const { casos } = JSON.parse(readFileSync(join(aqui, 'llaves_casos.json'), 'utf8'));
for (const c of casos) {
  const r = LV.rondasDe(LV.traducir(LV.plano(c.texto)));
  ok(c.que, js(r) === js(c.rondas), `JS:     ${js(r).slice(0, 300)}\n      Python: ${js(c.rondas).slice(0, 300)}`);
}

console.log('\n2 · lo que sólo hace la página: quién pasó, el campeón y el árbol\n');
const doom = '▪️ **⚖️[•CUARTOS DE FINAL•]📰**\n' +
  '▪️   [**FULLY🇨🇱&DXG🇲🇽**] 📰 [SCOT🇦🇷&TRRRR🇯🇲]\n' +
  '▪️   [**SNOW🇨🇴&VELATZ🇨🇱**] ⚖️ [CRONOX🇨🇱&KUNI🇦🇷]\n' +
  '▪️**📰[•SEMI - FINAL•]⚖️**\n' +
  '▪️   [**FULLY🇨🇱**&DXG🇲🇽] ⚖️ [**SNOW🇨🇴**&VELATZ🇨🇱]\n' +
  '▪️**👨🏻‍⚖️[•GRAN - FINAL•]🔚**\n' +
  '▪️   [FULLY🇨🇱&SNOW🇨🇴] 📰 [MAKMA🇻🇪&PRRR🇦🇴]\n' +
  '👨🏻‍⚖️ 𝄆 **__CAMPEÓN:__** @Fully🇨🇱&@Snow🇨🇴\n';
const L = LV.aLlave({ id: '9', canal: '8', g: '7', sv: 'FFA', pub: 0, ed: 0, texto: doom });
const R = (n) => (L && L.rondas.filter((x) => x.r === n)[0]) || { b: [] };
ok('la semi donde pasa uno de cada equipo: los que pasan contra los que no',
  js(R('Semifinales').b[0].slice(0, 2)) === js([['FULLY🇨🇱, SNOW🇨🇴', 'DXG🇲🇽, VELATZ🇨🇱'], 'FULLY🇨🇱, SNOW🇨🇴']),
  js(R('Semifinales').b[0]));
ok('los cuartos: pasan los que aparecen en la semi',
  R('Cuartos').b.map((b) => b[1]).join(' | ') === 'FULLY🇨🇱, DXG🇲🇽 | SNOW🇨🇴, VELATZ🇨🇱',
  R('Cuartos').b.map((b) => b[1]).join(' | '));
ok('el campeón, de la línea CAMPEÓN escrita con las menciones ya como nombres',
  R('Final').b[0][1] === 'FULLY🇨🇱, SNOW🇨🇴' && L.terminada, js(R('Final').b[0]));
ok('el árbol: la semi viene de los dos cuartos', js(R('Semifinales').b[0][3]) === js([0, 1]),
  js(R('Semifinales').b[0][3]));
ok('la ronda que se juega, en una llave sin final', LV.aLlave({ id: '1', texto:
  '# COPA\n`[ CUARTOS ]`\n⌞A1⌝ 🆚 ⌞B1⌝\n⌞C1⌝ 🆚 ⌞D1⌝\n`[ SEMIFINALES ]`\n⌞A1⌝ 🆚 ⌞C1⌝\n' }).enJuego === 'Semifinales');
ok('el SUB-CAMPEÓN nunca es el campeón',
  LV.lineaCampeon('SUB-CAMPEÓN: Pollo\nCAMPEÓN: Hassan') === 'Hassan' &&
  LV.lineaCampeon('SUB-CAMPEÓN: Pollo') === '');
ok('el nombre del evento, sin el subrayado de Discord',
  LV.titulo('## __ ↱<:x:1> • AGREEMENT: DOOMSDAY V.1 • <:x:1>↲__\n▪️ **[CUARTOS]**') === 'AGREEMENT DOOMSDAY V.1',
  LV.titulo('## __ ↱<:x:1> • AGREEMENT: DOOMSDAY V.1 • <:x:1>↲__\n▪️ **[CUARTOS]**'));
const partes = LV.unirPartidas([
  { id: '1553600767699583098', canal: 'c', autor: 'a', pub: 1000, ed: 2000,
    texto: '───● **SEMIFINAL** ●───\n●[ MCO ] <:ins:6> [ ZIGNOS ]\n───● **FINAL** ●───\n●[ ZIGNOS ] <:ins:6> [ JUANPA ]' },
  { id: '1553600655443107882', canal: 'c', autor: 'a', pub: 900, ed: 900,
    texto: '# SNAKE INSIGNIA\n───● **CUARTOS** ●───\n●[ MCO ] <:ins:6> [ PROSU ]' },
]);
ok('la llave partida en dos mensajes es una', partes.length === 1 && partes[0].id === '1553600655443107882' &&
  partes[0].rs.map((r) => r[0]).join(',') === 'CUARTOS,SEMIFINALES,FINAL', js(partes.map((p) => p.rs.map((r) => r[0]))));
// 🔴 FFA WORLD CUP (27/09/2026): la final con los dos en negrita y el campeón
// en un tercer mensaje, sólo el podio. Es el mismo caso que `escuchar.py`.
const wc = [
  { id: '1553929267509727264', canal: 'c', autor: 'a', pub: 1000, ed: 1000,
    texto: '# FFA WORLD CUP\n# OCTAVOS\n[NC🇦🇫] 🆚 [**FULLY🇨🇱**]\n[**SNOW🇨🇴**] 🆚 [MAKMA🇻🇪]\n' +
      '[ABYSSUS🇵🇦] 🆚 [**MOLUSCO🇦🇷**]\n[PICHULITA🇦🇷] 🆚 [**EZEE🇦🇷**]' },
  { id: '1553937058337398886', canal: 'c', autor: 'a', pub: 2000, ed: 2000,
    texto: '# SEMI FINAL\n[**FULLY🇨🇱**] 🆚 [MOLUSCO🇦🇷]\n[**SNOW🇨🇴**] 🆚 [EZEE🇦🇷]\n' +
      '# FINAL\n[**FULLY🇨🇱**] 🆚 [**SNOW🇨🇴**]' },
  { id: '1553966185043853344', canal: 'c', autor: 'a', pub: 3000, ed: 3000,
    texto: '│ CAMPEÓN: **FULLY🇨🇱** @FULLY\n│ SUBCAMPEÓN: SNOW🇨🇴 @Snow\n│ TERCER LUGAR: 🇦🇷EZEE @Ezee' },
];
const bwc = LV.unirPartidas(wc);
const lwc = bwc.length === 1 ? LV.aLlave(bwc[0]) : null;
const fwc = lwc && lwc.rondas.filter((x) => x.r === 'Final')[0];
ok('el podio en su propio mensaje se pega a su llave, y dice el campeón',
  bwc.length === 1 && fwc && fwc.b[0][1] === 'FULLY🇨🇱' && lwc.terminada, js(bwc.map((b) => b.id)));
ok('un podio que no nombra a un finalista no se pega',
  LV.unirPartidas([wc[0], wc[1], Object.assign({}, wc[2], { texto: wc[2].texto.replace(/FULLY/g, 'OTRO') })]).length === 2);
ok('ni a una llave que no llegó a la final', LV.unirPartidas([wc[0], wc[2]]).length === 2);
// 🔑 LO QUE EL CICLO YA SABÍA Y LA PÁGINA NO (28/09/2026), medido sobre las 74
// llaves reales guardadas: el campeón que no engancha, y la cuenta de gente.
const fin = (t) => { const x = LV.aLlave({ id: '1', texto: t }); return x && x.rondas[x.rondas.length - 1].b[0][1]; };
const semis = '# COPA\n`[ SEMIFINALES ]`\n⌞PRR 🇦🇴⌝ 🆚 ⌞ZETA⌝\n⌞SEBITA 🇱🇷⌝ 🆚 ⌞OMEGA⌝\n`[ FINAL ]`\n⌞PRR 🇦🇴⌝ 🆚 ⌞SEBITA 🇱🇷⌝\n';
ok('el campeón con otro alias lo dice el SUB-CAMPEÓN: el otro lado (DESGRACIAS EN TOKYO VOL 11)',
  fin(semis + '# 🥇 𝄆 CAMPEÓN: JOVEN ALA 🇦🇴\n🥈 𝄆 SUB-CAMPEÓN: SEBITA 🇱🇷') === 'PRR 🇦🇴',
  fin(semis + '# 🥇 𝄆 CAMPEÓN: JOVEN ALA 🇦🇴\n🥈 𝄆 SUB-CAMPEÓN: SEBITA 🇱🇷'));
ok('pero no si la línea del segundo nombra a los dos',
  fin(semis + 'CAMPEÓN: JOVEN ALA\nSUB-CAMPEÓN: [SEBITA] [PRR]') === '');
ok('el equipo campeón partido en dos renglones (EL RAP FECHA 5)',
  fin('# COPA\n`[ FINAL ]`\n⌞makma + tam⌝ 🆚 ⌞Hassan🇪🇬 + Neo🇦🇷(pollo)⌝\n' +
    '**__CAMPEON:__**Hassan🇪🇬 +\nNeo🇦🇷(pollo)\n**__SUBCAMPEON: __**makma + tam') === 'Hassan🇪🇬, Neo🇦🇷(pollo)');
ok('y el nombre en el renglón de abajo, nunca el del segundo',
  fin(semis + 'CAMPEÓN DEL TORNEO 🏆\nSEBITA 🇱🇷') === 'SEBITA 🇱🇷' &&
  fin(semis + 'CAMPEÓN 🏆 :\nSEGUNDO 🥈 : SEBITA') === '');
const cuenta = (t) => LV.aLlave({ id: '1', texto: t }).participantes;
ok('la gente sin el paréntesis: `gekto(chianluka+makma)` es una persona más las de adentro que no están',
  cuenta('# COPA\n`[ CUARTOS ]`\n⌞gekto(chianluka+makma)⌝ 🆚 ⌞nhp⌝\n⌞makma⌝ 🆚 ⌞luz⌝\n`[ FINAL ]`\n⌞gekto⌝ 🆚 ⌞makma⌝\n') === 5,
  cuenta('# COPA\n`[ CUARTOS ]`\n⌞gekto(chianluka+makma)⌝ 🆚 ⌞nhp⌝\n⌞makma⌝ 🆚 ⌞luz⌝\n`[ FINAL ]`\n⌞gekto⌝ 🆚 ⌞makma⌝\n'));
ok('y el que revive ocupa dos lugares de la primera ronda (COMPE DEL VACILE 1)',
  cuenta('# COPA\n`[ CUARTOS ]`\n⌞A⌝ 🆚 ⌞B⌝\n⌞C⌝ 🆚 ⌞D⌝\n⌞E⌝ 🆚 ⌞F⌝\n⌞C⌝ 🆚 ⌞G⌝\n') === 8);
// 🔑 el equipo con UN nombre en un 2VS2 (Dlx, 29/09/2026: «TEAM VENECIA no es un participante»)
const v16 = '# ▪️ [•CUARTOS DE FINAL•]\n▪️   [JOTA P 🇻🇪 + IGUANA 🇵🇪] 🆚 [TEAM VENECIA 🇲🇦 🇻🇪]\n' +
  '▪️   [27 🇺🇸 + PIYI 🇲🇽] 🆚 [SOUL B 🇨🇱 + CHAR 🇨🇴]\n▪️   [PARIA SIN REMEDIO 🇧🇲 + OASIS 🇨🇱] 🆚 [VANDU 🇨🇦 + MAKMA 🇻🇪]\n' +
  '▪️   [ELSOLAR 🇨🇴 + METORITO 🇲🇽] 🆚 [SNOW 🇨🇴 + NC 🇦🇷]\n';
const lv16 = LV.aLlave({ id: '1', texto: v16 });
ok('TEAM VENECIA va como equipo sin integrantes (`sin`), y cuenta dos para la escala',
  JSON.stringify(lv16.sin) === JSON.stringify(['TEAM VENECIA 🇲🇦 🇻🇪']) && lv16.participantes === 16,
  JSON.stringify([lv16.sin, lv16.participantes]));
ok('en un 1vs1 no hay equipos', !LV.aLlave({ id: '1', texto: '# CUARTOS\n[A] 🆚 [B]\n[C] 🆚 [D]\n' }).sin.length);

console.log('\n3 · lo que guarda el vigía (bot/avisos.js)\n');
const { pareceLlave, conNombres } = await import('./avisos.js');
ok('una llave de verdad parece una llave', casos.every((c) => pareceLlave(c.texto)),
  casos.filter((c) => !pareceLlave(c.texto)).map((c) => c.que).join(', '));
ok('un anuncio no', !pareceLlave('# COPA DE PRUEBA\nMODALIDAD: 1vs1\nHORARIO: en media hora\nCUPOS: 16'));
ok('la nave de funa sí, desde la fase (sin 🆚 todavía)',
  pareceLlave('[ NAVE DE FUNA ]\n[ FASE DE ELIMINACIÓN ]\n> ⌞ Dnk🇦🇷 ⌝ ❌\n> ⌞ Heat🇵🇷 ⌝\n> ⌞ Sombra🇵🇷 ⌝\n> ⌞ Blue🇵🇦 ⌝ ❌') &&
  !pareceLlave('# NAVE DE FUNA el viernes\nInscripciones abiertas\nCUPOS: 16'));
ok('el podio suelto sí, para que la página lo pegue a su llave',
  pareceLlave('│ CAMPEÓN: **FULLY🇨🇱** @FULLY\n│ SUBCAMPEÓN: SNOW🇨🇴') && pareceLlave('𝐂𝐀𝐌𝐏𝐄𝐎́𝐍: X'));
ok('las menciones pasan a nombre, con el apodo del servidor primero',
  conNombres({ content: 'CAMPEÓN: <@1>🇨🇱&<@2>🇨🇴 y <@3>', mentions: [
    { id: '1', username: 'fullylo4ded', member: { nick: 'FULLY' } },
    { id: '2', username: 'snowzzz', global_name: 'Snow' }] }) === 'CAMPEÓN: @FULLY🇨🇱&@Snow🇨🇴 y <@3>');

// 🔑 LAS INSCRIPCIONES, CADA MINUTO (Dlx, 29/09/2026: «tienes que estar
// chequeando las inscripciones constantemente»)
{
  const { svsInscribiendo, claveCiclo } = await import('./avisos.js');
  const H0 = 3600000, T = Date.UTC(2026, 8, 29, 1, 0);
  const s = svsInscribiendo([JSON.stringify({ tipo: 'evento', sv: 'FFA', ini: T + 10 * H0 }),
    JSON.stringify({ tipo: 'evento', sv: 'SR', ini: T + 14 * H0 }),
    JSON.stringify({ tipo: 'evento', sv: 'URBF', ini: T - 6 * H0 }), 'no es json'], T);
  ok('se leen las inscripciones de un evento anunciado de acá a 12 h, no de uno a 14 h ni de uno terminado',
    [...s].join(',') === 'FFA', [...s].join(','));
  const k1 = await claveCiclo('token-uno'), k2 = await claveCiclo('token-dos');
  ok('la clave del ciclo sale del token: la misma siempre, y otra con otro token',
    k1.length === 64 && k1 === await claveCiclo('token-uno') && k1 !== k2);
}

console.log('\n4 · los veredictos en vivo (5 vidas)\n');
const { svsEnVivo, veredictosALeer } = await import('./avisos.js');
const H = 3600000, T0 = Date.UTC(2026, 8, 27, 21, 30);
const vivos = svsEnVivo([JSON.stringify({ tipo: 'evento', sv: 'SR', ini: T0 }),
  JSON.stringify({ tipo: 'evento', sv: 'FFA', ini: T0 + 3 * H }),
  JSON.stringify({ tipo: 'antes', sv: 'URBF', ini: T0 }), 'no es json'], T0 + H);
ok('en vivo: el que empezó hace una hora, no el de dentro de dos ni el recordatorio',
  [...vivos].join(',') === 'SR', [...vivos].join(','));
const lista = [{ id: 'sr1', sv: 'SR' }, { id: 'u1', sv: 'URBF' }, { id: 'u2', sv: 'URBF' }, { id: 'u3', sv: 'URBF' }];
ok('se leen sólo los canales de un servidor en vivo',
  veredictosALeer(lista, new Set(['SR']), new Set(), 7).map((c) => c.id).join(',') === 'sr1');
ok('y el que tuvo mensajes hace poco, aunque su evento no figure',
  veredictosALeer(lista, new Set(), new Set(['u2']), 7).map((c) => c.id).join(',') === 'u2');
const r1 = veredictosALeer(lista, new Set(['URBF']), new Set(), 0, 2).map((c) => c.id);
const r2 = veredictosALeer(lista, new Set(['URBF']), new Set(), 1, 2).map((c) => c.id);
ok('con más canales que el tope, rotan de un minuto al otro', r1.length === 2 && r2.length === 2 &&
  r1.join() !== r2.join(), r1.join() + ' / ' + r2.join());
// la SNAKE ARENA VOL. 2 recortada, con jueces de mentira: el título de cada
// batalla, los votos (con y sin negrita, uno con `#`) y un juez que vota con
// una imagen (sin texto)
let n = 0;
const fila = (autor, texto) => ({ id: String(1553883626993881189n + BigInt(++n)), canal: 'ver', sv: 'SR', g: 'g',
  autor, pub: T0 + n * 60000, ed: T0 + n * 60000, texto });
const bat = (a, b, votos) => [fila('org', '# 🇦🇷 ' + a + ' <:VS2:1> ' + b + ' 🇦🇷')].concat(votos.map((v, i) =>
  fila('j' + i, v ? (i % 2 ? '🇦🇷 ' + v : '**' + v + ' 🇦🇷**') : '')));
const ver = [].concat(
  bat('DELUXE', 'FAZER', ['FAZER', 'DELUXE', 'FAZER']),
  bat('LHYON', 'FAZER', ['LHYON', 'LHYON', '']),
  bat('LHYON', 'DTR', ['DTR', 'DTR', 'LHYON']),
  bat('DELUXE', 'FAZER', ['DELUXE', 'DELUXE', '']),
  bat('DELUXE', 'JIMMY', ['JIMMY', 'DELUXE', '']),
  bat('DELUXE', 'LHYON', ['# ***DELUXE***', 'DELUXE', '']),
  // la bandera del otro lado del nombre: es la misma persona
  [fila('org', '# DELUXE 🇦🇷 <:VS2:1> 🇦🇷 DTR')], bat('DELUXE', 'DTR', ['DTR', 'DTR', '']).slice(1));
const Lv = LV.veredictos(ver);
const bv = Lv.length === 1 ? Lv[0].rondas[0].b : [];
ok('una tanda de veredictos con la misma pareja otra vez, no seguida, es un 5 vidas',
  Lv.length === 1 && Lv[0].rondas[0].r === '5 vidas' && Lv[0].participantes === 5, js(Lv.map((L) => L.rondas[0].r)));
// los nombres quedan como los escribió el título, con su bandera: se comparan sin ella
const gv = bv.map((b) => LV.norm(b[1]));
ok('gana la mayoría de los votos, con o sin negrita', gv.slice(0, 4).join(',') === 'fazer,lhyon,dtr,deluxe',
  gv.join(','));
ok('un empate lo desempata el que siguió peleando (el ganador se queda)', gv[4] === 'deluxe' &&
  /siguió/.test(bv[4][2]), js(bv[4]));
ok('`# ***DELUXE***` es un voto, no una batalla', bv.length === 7 && gv[5] === 'deluxe', js(bv[5]));
ok('«DELUXE 🇦🇷» y «🇦🇷 DELUXE» son la misma persona: un solo nombre en toda la tanda',
  Lv.length === 1 && Lv[0].participantes === 5 && bv[6][0][0] === bv[0][0][0], js(bv[6]));
ok('una llave no es un 5 vidas: la réplica va seguida', LV.veredictos([].concat(
  bat('A', 'B', ['A', 'B', '']), bat('A', 'B', ['A', 'A', '']), bat('A', 'C', ['C', 'C', '']))).length === 0);
// 🔴 la MAÑANA DE LLUVIA VOL 1 de FFA (07/10/2026): una llave votada ronda por ronda, con un título mal escrito
// («JUPITER vs RAYO» en cuartos) que repite la pareja de la semi. El que gana no se queda: no es un 5 vidas
ok('una llave votada con un título mal escrito no es un 5 vidas', LV.veredictos([].concat(
  bat('JUPITER', 'RAYO', ['JUPITER']), bat('SCOT', 'ZA', ['ZA']), bat('TROT', 'ALDRE', ['ALDRE']),
  bat('PROMETHEUS', 'RAYO', ['RAYO']), bat('JUPITER', 'RAYO', ['JUPITER']), bat('ZA', 'ALDRE', ['ZA']),
  bat('RAYO', 'ALDRE', ['RAYO']), bat('ZA', 'JUPITER', ['ZA']))).length === 0);

// 🔑 EL CONTRATO CON PYTHON: `escuchar.veredictos()` carga los 5 vidas en el
// ciclo (Dlx, 28/09/2026: «A y b»), así que la página tiene que armar LAS
// MISMAS batallas con los mismos ganadores. Los casos son reales, con los
// autores tapados: ver `python bot/llaves_casos.py --veredictos`.
console.log('\n5 · los veredictos, contra Python (bot/llaves_casos.json)\n');
for (const c of JSON.parse(readFileSync(join(aqui, 'llaves_casos.json'), 'utf8')).veredictos || []) {
  const r = LV.veredictos(c.filas).map((L) => ({ n: L.participantes, ronda: L.rondas[0].r, terminada: L.terminada,
    batallas: L.rondas[0].b.map((x) => [x[0], x[1], x[2]]) }));
  ok(c.que, js(r) === js(c.eventos), `JS:     ${js(r).slice(0, 400)}\n      Python: ${js(c.eventos).slice(0, 400)}`);
}

// 🔑 LA NAVE DE FUNA (Dlx, 29/09/2026): la fase de eliminación y el podio con
// medallas, igual que `escuchar.funa_de()` y `escuchar.medallas_de()`.
console.log('\n6 · la nave de funa, contra Python (bot/llaves_casos.json)\n');
for (const c of JSON.parse(readFileSync(join(aqui, 'llaves_casos.json'), 'utf8')).funa || []) {
  // y en qué ronda cayó cada uno («ELIMINADO #3»), igual que `escuchar.funa_rondas()`
  const r = { fase: LV.funaDe(c.texto), medallas: LV.medallasDe(c.texto), rondas: LV.funaRondas(c.texto) };
  const e = { fase: c.fase, medallas: c.medallas, rondas: c.rondas === undefined ? null : c.rondas };
  ok(c.que, js(r) === js(e), `JS:     ${js(r).slice(0, 400)}\n      Python: ${js(e).slice(0, 400)}`);
  const L = LV.aLlave({ id: '1', texto: c.texto });
  ok('  y la llave la trae: la fase entera y el plantel de todos',
    L && L.funa && L.funa.length === c.fase.length && L.participantes >= c.fase.length,
    js(L && [L.funa && L.funa.length, L.participantes]));
}
const soloFase = LV.aLlave({ id: '1', texto: '[ FASE DE ELIMINACIÓN ]\n⌞A⌝ ❌\n⌞B⌝\n⌞C⌝ ❌\n⌞D⌝\n' });
ok('una nave de funa se ve desde la fase, antes de la final',
  soloFase && soloFase.funa.length === 4 && soloFase.enJuego === 'Fase de eliminación', js(soloFase && soloFase.enJuego));
const conMedalla = LV.aLlave({ id: '1', texto: 'nave de funa:\n1 - [A] ❌\n2 - [B]\n3 - [C] ❌\n4 - [D]\nFinal\n[B] 🆚 [D]\n🥇 D\n🥈 B' });
ok('y la final sin «CAMPEÓN» toma el 🥇 del podio', conMedalla && conMedalla.terminada &&
  conMedalla.rondas[conMedalla.rondas.length - 1].b[0][1] === 'D', js(conMedalla && conMedalla.rondas));

// 🔑 LA LLAVE COMO SE JUGÓ, DE #VEREDICTOS (Dlx, 02/10/2026: «el orden verdadero de las llaves… estaba en el canal
// de veredictos»): la página arma LA MISMA llave que `escuchar.llaves_de_veredictos()`. Ver `python bot/llaves_casos.py
// --llaves-v`.
console.log('\n7 · la llave de #veredictos, contra Python (bot/llaves_casos.json)\n');
for (const c of JSON.parse(readFileSync(join(aqui, 'llaves_casos.json'), 'utf8')).llaves_v || []) {
  const r = LV.llavesDeVeredictos(c.filas).map((L) => L.batallas);
  ok(c.que, js(r) === js(c.llaves), `JS:     ${js(r).slice(0, 600)}\n      Python: ${js(c.llaves).slice(0, 600)}`);
}

// 🔑 ¿DE QUÉ ANUNCIO ES ESTA LLAVE? (`LlaveVivo.deEvento()`, 05/10/2026). FFA anunció «DESGRACIAS EN TOKYO VOL 23 1v1»
// y su llave dice «VOL 22 1v1»: por nombre no se juntan —a propósito— y la HUÉRFANA sí, con las reglas de
// `_huerfanas()` de sheet/llaves_web.py. El texto y los anuncios son los de esa tarde.
console.log('\n8 · la llave huérfana: el título copiado de la edición anterior\n');
{
  const ms = (iso) => Date.parse(iso + 'Z');
  const llave = LV.aLlave(LV.unirPartidas([{ id: '1556736745129639998', canal: '9', sv: 'FFA', g: '1', autor: 'x',
    pub: ms('2026-10-05T18:36:00'), ed: ms('2026-10-05T18:57:00'),
    texto: '**__ ↱🉐 | DESGRACIAS EN TOKYO VOL 22 1v1|  🉐 ↲__**\n\n**[•OCTAVOS DE FINAL•]**\n\n' +
      '▪️   [NC 🇦🇷] 🆚 [1200 🇰🇷] 🆚 [MAJIZTRAL 🇨🇴]\n▪️   [KEIDER 🇧🇷] 🆚 [BENJIXO 🇱🇸] 🆚 [OG 🇻🇪]\n' +
      '▪️   [] 🆚 [] 🆚 []\n\n▪️ **[•CUARTOS DE FINAL•]**\n\n▪️   [] 🆚 []\n\n▪️**[• FINAL•]**\n\n▪️ [] 🆚 []\n' }])[0]);
  const link = (id) => 'https://discord.com/channels/1/2/' + id;
  const v23 = { nombre: 'DESGRACIAS EN TOKYO VOL 23 1v1', sv: 'FFA', cuando: '2026-10-05T18:29:40',
    link: link('1556727593766617089'), mod: '1v1' };
  const anuncios = [v23,
    { nombre: 'DESGRACIAS EN TOKYO VOL 22', sv: 'FFA', cuando: '2026-10-05T02:57:00', link: link('1556492935757828148'), mod: 'pandilla' },
    { nombre: 'lapalera del edi', sv: 'FFA', cuando: '2026-10-05T06:58:00', link: link('1556557525598470155'), mod: '1v1' }];
  const ctx = { anuncios, todas: [llave] };
  ok('la llave se lee: dos batallas de a tres', llave && llave.rondas[0].b.length === 2 && llave.rondas[0].b[0][0].length === 3,
    js(llave && llave.rondas));
  ok('por nombre no: «VOL 22» contra «VOL 23» son dos ediciones', !LV.porNombre(v23, [llave]));
  ok('con la huérfana sí: es la única de esa serie, publicada después del anuncio', LV.deEvento(v23, [llave], ctx) === llave);
  ok('y ningún otro anuncio se la lleva', anuncios.slice(1).every((a) => !LV.deEvento(a, [llave], ctx)));
  const v22hoy = { nombre: 'DESGRACIAS EN TOKYO VOL 22 1v1', sv: 'FFA', cuando: '2026-10-05T18:20:00', link: '', mod: '1v1' };
  const ctx2 = { anuncios: anuncios.concat([v22hoy]), todas: [llave] };
  ok('si el «VOL 22» también se anunció a horario, la llave es de ése',
    LV.deEvento(v22hoy, [llave], ctx2) === llave && !LV.deEvento(v23, [llave], ctx2));
  const otra = Object.assign({}, llave, { id: '2', pub: llave.pub + 60000 });
  ok('con dos candidatas no elige', !LV.deEvento(v23, [llave], { anuncios, todas: [llave, otra] }));
  const equipos = Object.assign({}, llave, { rondas: [{ r: 'Octavos', b: [[['A, B', 'C, D'], '', '', []], [['E, F', 'G, H'], '', '', []]] }] });
  ok('un 1v1 no se lleva una llave de equipos', !LV.deEvento(v23, [equipos], { anuncios, todas: [equipos] }));
  const v24 = { nombre: 'DESGRACIAS EN TOKYO VOL 24 1v1', sv: 'FFA', cuando: '2026-10-05T18:31:00', link: '', mod: '1v1' };
  ok('publicada después del SIGUIENTE anuncio de la serie, no', !LV.deEvento(v23, [llave], { anuncios: anuncios.concat([v24]), todas: [llave] }));
  ok('sin contexto, sólo por nombre (como antes)', !LV.deEvento(v23, [llave]));
  ok('el parecido de la serie es el de difflib', Math.abs(LV.parecido('desgraciasentokyovol', 'desgraciasentokiovol') - 0.95) < 1e-9);
  // 🔴 LA ASIGNACIÓN ENTERA (revisión del 05/10/2026): la VOL 22 a la 1 PM con su llave, y la VOL 23 a las 5 PM con una
  // llave que COPIÓ el título «VOL 22». Preguntando de a uno, la 22 podía llevarse la de la 23 y la 23 quedaba sin nada
  {
    const texto22 = '**DESGRACIAS EN TOKYO VOL 22 1v1**\n[OCTAVOS]\n[A] 🆚 [B]\n[C] 🆚 [D]\n[FINAL]\n[A] 🆚 [C]\n';
    const mk = (id, pub) => LV.aLlave(LV.unirPartidas([{ id, canal: '9', sv: 'FFA', g: '1', autor: 'x' + id, pub, ed: pub, texto: texto22 }])[0]);
    const real22 = mk('5001', ms('2026-10-05T17:05:00'));
    const copia = mk('5002', ms('2026-10-05T21:05:00'));
    const a22 = { nombre: 'DESGRACIAS EN TOKYO VOL 22 1v1', sv: 'FFA', cuando: '2026-10-05T17:00:00', link: link('1556711315865600000'), mod: '1v1' };
    const a23 = { nombre: 'DESGRACIAS EN TOKYO VOL 23 1v1', sv: 'FFA', cuando: '2026-10-05T21:00:00', link: link('1556771713843200000'), mod: '1v1' };
    const todasL = [real22, copia];
    const c3 = { anuncios: [a22, a23], todas: todasL };
    const r = LV.asignar([a22, a23], todasL);
    ok('el mismo día: la 22 se lleva la suya (la más cerca en el tiempo) y la 23 la que copió el título',
      r.deLlave['5001'] === a22 && r.deLlave['5002'] === a23, js(Object.keys(r.deLlave)));
    ok('y la página pregunta lo mismo de a una llave', LV.deEvento(a23, [copia], c3) === copia
      && LV.deEvento(a22, [real22], c3) === real22 && LV.deEvento(a22, [copia], c3) === null);
    ok('un anuncio sin hora se mide desde que se publicó', LV.porNombre(Object.assign({}, a22, { cuando: null }), [real22]) === real22);
  }
  // 🔴 EL ANUNCIO QUE SE CONTRADICE (FFA, 05/10/2026, en vivo): «DESGRACIAS EN TOKYO VOL 24 2v2» con la modalidad «1v1»
  // —copiada de la VOL 23— y una llave de equipos titulada «VOL 24». Por la modalidad sola, el «1v1» no se la llevaba
  {
    const t24 = '# __ ↱🉐 | DESGRACIAS EN TOKYO VOL 24 |  🉐️ ↲__\n[OCTAVOS]\n[A, B] 🆚 [C, D]\n[E, F] 🆚 [G, H]\n';
    const L24 = LV.aLlave(LV.unirPartidas([{ id: '1556774086049533993', canal: '9', sv: 'FFA', g: '1', autor: 'x',
      pub: 1791234265000, ed: 1791235707000, texto: t24 }])[0]);
    const a24 = { nombre: 'DESGRACIAS EN TOKYO VOL 24 2v2', sv: 'FFA', cuando: '2026-10-05T20:46:17',
      link: link('1556761970554708040'), mod: '1v1' };
    ok('la llave de equipos es de equipos', LV.formaLlave(L24) === 'equipos', LV.formaLlave(L24));
    ok('el anuncio que se contradice no tiene forma, y se lleva su llave',
      LV.formaDelAnuncio(a24) === '' && LV.deEvento(a24, [L24], { anuncios: [a24], todas: [L24] }) === L24);
    ok('el nombre sólo anula: sin modalidad, sin forma; y si coinciden, descarta como antes',
      LV.formaDelAnuncio({ nombre: 'COPA 2v2', mod: '' }) === '' &&
      !LV.deEvento(Object.assign({}, a24, { nombre: 'DESGRACIAS EN TOKYO VOL 24 1v1' }), [L24], { anuncios: [], todas: [L24] }));
  }
  // 🔴 UNA LLAVE ES DE UN SOLO EVENTO (05/10/2026): «COPA SOOLAR» a las 3:39 PM y «COPA SOOLAR 2» a las 7:41 PM, las
  // dos de FFA; la llave en vivo de la 2 no puede ser también de la 1 (un número contra ninguno no choca)
  {
    const cs1 = { nombre: 'COPA SOOLAR', sv: 'FFA', cuando: '2026-10-04T19:39:40', link: link('1556386595580682261'), mod: '1v1' };
    const cs2 = { nombre: 'COPA SOOLAR 2', sv: 'FFA', cuando: '2026-10-04T23:41:34', link: link('1556447470379208749'), mod: '1v1' };
    const L2 = { id: '7002', sv: 'FFA', nombre: 'COPA SOOLAR 2', pub: ms('2026-10-04T23:50:00'), ed: ms('2026-10-05T00:30:00'),
      rondas: [{ r: 'Octavos', b: [[['A', 'B'], '', '', []], [['C', 'D'], '', '', []]] }] };
    const r = LV.asignar([cs1, cs2], [L2]);
    ok('la llave en vivo de la 2 es sólo de la 2', r.porAnuncio.length === 1 && r.porAnuncio[0][0] === cs2,
      js(r.porAnuncio.map((x) => x[0].nombre)));
    ok('y la página no se la da a la 1', !LV.deEvento(cs1, [L2], { anuncios: [cs1, cs2], todas: [L2] })
      && LV.deEvento(cs2, [L2], { anuncios: [cs1, cs2], todas: [L2] }) === L2);
    const rep2 = Object.assign({}, cs2, { nombre: 'COPA SOOLAR 2 (HOY)', link: link('1556447470379208800') });
    const r2 = LV.asignar([cs2, rep2], [L2]);
    ok('el mismo evento anunciado dos veces: los dos anuncios la llevan', r2.porAnuncio.length === 2, js(r2.porAnuncio.length));
  }
  ok('la serie: sin números, sin modalidad y sin la temporada del organizador',
    LV.serie('DESGRACIAS EN TOKYO VOL 23 1v1') === 'desgraciasentokyovol' && LV.serie('COMPE DEL VACILE T2 #1') === 'compedelvacile',
    js([LV.serie('DESGRACIAS EN TOKYO VOL 23 1v1'), LV.serie('COMPE DEL VACILE T2 #1')]));
}

console.log(mal ? `\n🔴 ${mal} mal\n` : '\n   todo ok\n');
process.exit(mal ? 1 : 0);
