// 🗂️ Los botones de los foros de DRA (bot/foros.js), sin Discord ni R2: `node bot/foros_prueba.mjs`.
// La otra punta —que lo que se publica sólo usa estos `que`— la mira `python bot/foros_dra.py --auto`.
import { QUE, leerId, respuesta, botonWorker, INFO_R2 } from './foros.js';

let mal = 0;
const ok = (c, que) => { console.log((c ? '  ✓ ' : '  ✗ ') + que); if (!c) mal++; };

const ahora = Date.UTC(2026, 10, 28, 20, 0, 0);
const u = (h) => Math.floor(ahora / 1000) + h * 3600;
const INFO = {
  tiers: '### 🚀 Cómo sube', sumar: '### 🤝 Cómo se suma', crear: '### 🛡️ Crear', crews_tiers: '### 📈 Cómo suben',
  bot: 'https://discord.com/oauth2/authorize?x', guia_sumar: 'https://underlegends.pages.dev/freestyle-rap/socios/sumar',
  sv: { SR: { n: 'Snake Rap', p: 'https://underlegends.pages.dev/freestyle-rap/sv/SNK',
    ev: [['Vieja', u(-5), ''], ['Recién', u(-0.2), ''], ['La de mañana', u(20), 'https://discord.com/channels/1/2/3']] },
  FFA: { n: 'Freestyle For All', p: 'https://x/ffa', ev: [] } },
  crews: { Follombia: { n: 'Follombia', p: 'https://x/c', unir: 'Es con pedido', pedir: true, tier: 'Está en Diamante' },
    KS: { n: 'KS', p: 'https://x/ks', unir: 'Sólo por invitación', pedir: false, tier: 'Está en Oro' } },
  ligas: { 'snake-generations': { n: 'Snake League Generations', p: 'https://x/l', tabla: '🥇 **Road** · 18 pts' } },
};

ok(QUE.length === 8 && INFO_R2 === 'paneles/foros/info.json', 'los ocho `que` y el lugar de R2');
ok(JSON.stringify(leerId('fo:ev:SR')) === '["ev","SR"]' && JSON.stringify(leerId('fo:tiers')) === '["tiers",""]', 'lee el custom_id');
ok(JSON.stringify(leerId('fo:cu:Desierto de Atacama')) === '["cu","Desierto de Atacama"]', 'una crew con espacios');
ok(leerId('cw:si:x:y') === null && leerId('fo:borrar:x') === null, 'lo que no es de acá, no');

const ev = respuesta(INFO, 'ev', 'SR', ahora);
ok(!ev.texto.includes('Vieja') && ev.texto.includes('Recién') && ev.texto.includes('La de mañana'), 'los eventos: sin los que ya pasaron (con media hora de gracia)');
ok(ev.texto.includes('<t:' + u(20) + ':F>') && ev.texto.includes('[el anuncio](https://discord.com/channels/1/2/3)'), 'con la hora de Discord y el anuncio');
const sin = respuesta(INFO, 'ev', 'FFA', ahora);
ok(/no tiene eventos/.test(sin.texto) && sin.botones.some((b) => /eventos/.test(b.url)), 'sin eventos: lo dice y lleva al calendario');
const cu = respuesta(INFO, 'cu', 'Follombia', ahora);
ok(cu.botones[0].custom_id === 'fo:cp:Follombia' && cu.botones[0].style === 1, '«Cómo unirme» trae «Pedir entrar» si se puede');
ok(!respuesta(INFO, 'cu', 'KS', ahora).botones.some((b) => b.custom_id), 'y no lo trae si es sólo por invitación');
ok(JSON.stringify(respuesta(INFO, 'cp', 'Follombia', ahora)) === '{"accion":"unirme","crew":"Follombia"}', '«Pedir entrar» es /crew unirme');
ok(respuesta(INFO, 'ct', '_', ahora).texto === INFO.crews_tiers && respuesta(INFO, 'ct', 'KS', ahora).texto === 'Está en Oro', 'el tier: general o de una crew');
ok(respuesta(INFO, 'lt', 'snake-generations', ahora).texto.includes('Road'), 'la tabla de una liga');
ok(respuesta(INFO, 'sumar', '', ahora).botones.length === 2 && respuesta(INFO, 'tiers', '', ahora).texto === INFO.tiers, 'sumar y ascender');
ok(/no pude/.test(respuesta(null, 'tiers', '', ahora).texto) && /no pude/.test(respuesta(INFO, 'lt', 'no-existe', ahora).texto),
  'sin info o sin lo pedido: un aviso, nunca un error');
for (const q of QUE) {
  const r = respuesta(INFO, q, q === 'ev' ? 'SR' : q === 'lt' ? 'snake-generations' : q === 'ct' ? '_' : 'Follombia', ahora);
  const bs = r.botones || [];
  ok(r.accion || (r.texto.length <= 3900 && bs.length <= 5 && bs.every((b) => b.label.length <= 80 && (b.url ? /^https:/.test(b.url) : b.custom_id.length <= 100))),
    'los topes de Discord: ' + q);
}

// el clic entero, con R2 y el Worker simulados
const env = { CARTAS: { get: async (k) => (k === INFO_R2 ? { json: async () => INFO } : null) } };
const dijo = [];
const ayuda = { aviso: (t, b) => { dijo.push(['aviso', t, b]); return 'r'; }, crewUnirme: (c) => { dijo.push(['unirme', c]); return 'u'; } };
await botonWorker({ data: { custom_id: 'fo:tiers' } }, env, null, ayuda);
await botonWorker({ data: { custom_id: 'fo:cp:Follombia' } }, env, null, ayuda);
await botonWorker({ data: { custom_id: 'fo:nada' } }, env, null, ayuda);
await botonWorker({ data: { custom_id: 'fo:tiers' } }, {}, null, ayuda);
ok(dijo[0][1] === INFO.tiers && dijo[1][0] === 'unirme' && dijo[1][1] === 'Follombia', 'el clic: lee R2 y contesta; «Pedir entrar» va a /crew unirme');
ok(/ya no anda/.test(dijo[2][1]) && /no pude/.test(dijo[3][1]), 'un botón desconocido o sin R2: un aviso');

console.log(mal ? '\n' + mal + ' mal' : '\ntodo bien');
process.exit(mal ? 1 : 0);
