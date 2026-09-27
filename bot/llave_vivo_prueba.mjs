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

console.log('\n3 · lo que guarda el vigía (bot/avisos.js)\n');
const { pareceLlave, conNombres } = await import('./avisos.js');
ok('una llave de verdad parece una llave', casos.every((c) => pareceLlave(c.texto)),
  casos.filter((c) => !pareceLlave(c.texto)).map((c) => c.que).join(', '));
ok('un anuncio no', !pareceLlave('# COPA DE PRUEBA\nMODALIDAD: 1vs1\nHORARIO: en media hora\nCUPOS: 16'));
ok('las menciones pasan a nombre, con el apodo del servidor primero',
  conNombres({ content: 'CAMPEÓN: <@1>🇨🇱&<@2>🇨🇴 y <@3>', mentions: [
    { id: '1', username: 'fullylo4ded', member: { nick: 'FULLY' } },
    { id: '2', username: 'snowzzz', global_name: 'Snow' }] }) === 'CAMPEÓN: @FULLY🇨🇱&@Snow🇨🇴 y <@3>');

console.log(mal ? `\n🔴 ${mal} mal\n` : '\n   todo ok\n');
process.exit(mal ? 1 : 0);
