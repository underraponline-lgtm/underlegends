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

console.log('\n3 · lo que guarda el vigía (bot/avisos.js)\n');
const { pareceLlave, conNombres } = await import('./avisos.js');
ok('una llave de verdad parece una llave', casos.every((c) => pareceLlave(c.texto)),
  casos.filter((c) => !pareceLlave(c.texto)).map((c) => c.que).join(', '));
ok('un anuncio no', !pareceLlave('# COPA DE PRUEBA\nMODALIDAD: 1vs1\nHORARIO: en media hora\nCUPOS: 16'));
ok('el podio suelto sí, para que la página lo pegue a su llave',
  pareceLlave('│ CAMPEÓN: **FULLY🇨🇱** @FULLY\n│ SUBCAMPEÓN: SNOW🇨🇴') && pareceLlave('𝐂𝐀𝐌𝐏𝐄𝐎́𝐍: X'));
ok('las menciones pasan a nombre, con el apodo del servidor primero',
  conNombres({ content: 'CAMPEÓN: <@1>🇨🇱&<@2>🇨🇴 y <@3>', mentions: [
    { id: '1', username: 'fullylo4ded', member: { nick: 'FULLY' } },
    { id: '2', username: 'snowzzz', global_name: 'Snow' }] }) === 'CAMPEÓN: @FULLY🇨🇱&@Snow🇨🇴 y <@3>');

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

console.log(mal ? `\n🔴 ${mal} mal\n` : '\n   todo ok\n');
process.exit(mal ? 1 : 0);
