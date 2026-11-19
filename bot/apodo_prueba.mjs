// 🏷️ `bot/apodo.js` contra los casos de `bot/apodo_casos.json`, los mismos que pasa `python bot/apodo.py --auto`: el bot
// (/apodo) y el ciclo tienen que armar el mismo apodo, o el ciclo «corrige» cada media hora lo que el bot acaba de poner.
//   node bot/apodo_prueba.mjs
import { readFileSync } from 'node:fs';
import { ESTILOS, POR_DEFECTO, SOLO_NOMBRE, TOPE, armar, decidir, largo, nombreDe, piezasDe, soloNuestras } from './apodo.js';

const casos = JSON.parse(readFileSync(new URL('./apodo_casos.json', import.meta.url), 'utf8'));
let mal = 0;
const ok = (c, t, det) => { console.log((c ? '   ✅ ' : '   🔴 ') + t + (c || det === undefined ? '' : '  ' + det)); if (!c) mal++; };
console.log('\n══ 🏷️ EL APODO EN JS (bot/apodo.js) ══\n');
for (const c of casos.armar) {
  const sale = armar(c.estilo, c.nombre, c.piezas);
  ok(sale === c.sale, `${c.que} → «${c.sale}»`, `salió «${sale}»`);
  ok(largo(sale) <= TOPE, '   y entra en 32', largo(sale));
}
for (const c of casos.nombre) {
  const n = nombreDe(c.apodo), s = soloNuestras(c.apodo, casos.siglas, c.piezas);
  ok(n === c.nombre && s === c.nuestras, `«${c.apodo}» → «${c.nombre}», ${c.nuestras ? 'sólo marcas nuestras' : 'no sólo nuestras'}`, JSON.stringify([n, s]));
}
for (const c of casos.decidir) {
  const sale = decidir(c.actual, c.piezas, c.estilo, c.base, casos.siglas);
  ok(sale === c.sale, `${c.que} → ${JSON.stringify(c.sale)}`, `salió ${JSON.stringify(sale)}`);
}
ok(JSON.stringify(piezasDe([23, 40, 1, 'co', 'B-', 'FLB', 'Bloody'])) === JSON.stringify({ c: 23, t: 40, e: 1, b: 'co', r: 'B-', k: 'FLB' })
  && JSON.stringify(piezasDe([0, 3, -1, 'ar', '', '', 'Liberia'])) === JSON.stringify({ t: 3, b: 'ar' }), 'las piezas de KV, como objeto (-1 y 0 no van)');
ok(ESTILOS.map((e) => e[0]).join() === '1,2,3,4,5,6' && POR_DEFECTO === 1 && SOLO_NOMBRE === 6, 'seis estilos, el 1 por defecto y el 6 sin marcas');
ok(ESTILOS.every(([n, , ej]) => armar(n, 'Bloody', casos.bloody) === ej), 'los ejemplos de los estilos salen de armar() con las piezas de Bloody');
console.log('\n   ' + (mal ? '🔴 ' + mal + ' mal' : 'todo ok') + '\n');
process.exit(mal ? 1 : 0);
