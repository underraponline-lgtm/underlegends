/**
 * `/owner` CONTRA EL WORKER DE VERDAD Y EL KV DE VERDAD.
 *
 *   python bot/volcar_kv.py      (primero: baja KV a bot/_kv_volcado.json)
 *   node bot/probar_owner.mjs
 *
 * ⚠️ LO QUE ESTA PRUEBA TIENE QUE ENCONTRAR ES EL PORTERO, no el texto. Un
 * comando de dueño que conteste de más es el único error acá que no se
 * arregla después: lo que se filtró, se filtró. Por eso el primer caso no es
 * «¿anda?» sino «¿le contesta a otro?».
 *
 * ⚠️ Y SE PRUEBA CON DOS IDs DISTINTOS EN EL MISMO PAYLOAD. Discord manda el
 * usuario en `member.user.id` dentro de un servidor y en `user.id` por
 * mensaje directo; `idDe()` lee los dos. Un portero que mire sólo uno deja
 * la puerta abierta por el otro, y con un solo caso de prueba no se ve.
 */
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const AQUI = dirname(fileURLToPath(import.meta.url));
const { default: worker } = await import('./worker.js');

const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const par = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
const CLAVE = hex(await crypto.subtle.exportKey('raw', par.publicKey));

let volcado;
try {
  volcado = JSON.parse(readFileSync(join(AQUI, '_kv_volcado.json'), 'utf8'));
} catch {
  console.error('Falta bot/_kv_volcado.json. Corré antes:  python bot/volcar_kv.py');
  process.exit(1);
}

const DUENO = '739338101603696681';
const OTRO = '111111111111111111';

const env = {
  DISCORD_PUBLIC_KEY: CLAVE,
  KV: { get: async (k) => (k in volcado ? volcado[k] : null) },
};
const ctx = { waitUntil: () => {} };
globalThis.fetch = async () => new Response('{}', { status: 200 });

// el freno cortaría a la cuarta y acá no se está probando el freno
let RELOJ = Date.now();
Date.now = () => RELOJ;

async function pedir(objeto) {
  RELOJ += 60000;
  const cuerpo = JSON.stringify(objeto);
  const ts = String(Math.floor(RELOJ / 1000));
  const sig = hex(await crypto.subtle.sign(
    'Ed25519', par.privateKey, new TextEncoder().encode(ts + cuerpo)));
  const r = await worker.fetch(new Request('https://x/', {
    method: 'POST',
    headers: { 'x-signature-ed25519': sig, 'x-signature-timestamp': ts },
    body: cuerpo,
  }), env, ctx);
  return JSON.parse(await r.text());
}

/** `quien` decide DÓNDE va el id: en un servidor o por mensaje directo. */
const owner = (uid, sub, opciones, dm) => pedir({
  type: 2,
  ...(dm ? { user: { id: uid } } : {
    guild_id: '1502240676463218808',
    member: { user: { id: uid }, permissions: '8' },
  }),
  data: { name: 'owner', options: [{ name: sub, type: 1, options: opciones || [] }] },
});

const texto = (r) => (r && r.data && r.data.content) || '';
const efimero = (r) => !!(r && r.data && (r.data.flags & 64));

// ⚠️ `--ver` IMPRIME LOS PANELES EN VEZ DE AFIRMAR SOBRE ELLOS, y hace falta
// por algo que ninguna aserción encuentra: un panel puede pasar las catorce
// pruebas y leerse mal. Lo que se mira acá es el renglón largo, el bloque de
// código que se desborda en el teléfono y el número que quedó sin unidad.
if (process.argv.includes('--ver')) {
  for (const s of ['rangos', 'estado']) {
    console.log('\n' + '─'.repeat(70) + '  /owner ' + s + '\n');
    console.log(texto(await owner(DUENO, s)));
  }
  console.log('\n' + '─'.repeat(70) + '  /owner quien nombre:Konan\n');
  console.log(texto(await owner(DUENO, 'quien',
    [{ name: 'nombre', type: 3, value: 'Konan' }])));
  console.log('');
  process.exit(0);
}

let mal = 0;
const caso = (etq, ok, detalle) => {
  console.log(`  ${ok ? '✅' : '🔴'}  ${etq}${detalle ? '   ' + detalle : ''}`);
  if (!ok) mal += 1;
};

console.log('\n══ EL PORTERO ══\n');

for (const [comoEntra, dm] of [['en un servidor', false], ['por mensaje directo', true]]) {
  const r = await owner(OTRO, 'estado', [], dm);
  const t = texto(r);
  // ⚠️ NO ALCANZA CON QUE DIGA «no». Tiene que NO traer el dato: un mensaje
  // de rechazo que igual incluya el panel sería peor que no tener portero,
  // porque se vería bien.
  caso(`a otro usuario, ${comoEntra}, lo rechaza`,
       t.indexOf('Liga Global**, no de este servidor') >= 0);
  caso(`   ...y NO le filtra el panel`,
       t.indexOf('último pipeline') < 0 && t.indexOf('personas con carta') < 0);
}

for (const [comoEntra, dm] of [['en un servidor', false], ['por mensaje directo', true]]) {
  const r = await owner(DUENO, 'estado', [], dm);
  caso(`a Dlx ${comoEntra} le contesta`, texto(r).indexOf('La Liga, ahora mismo') >= 0);
}

console.log('\n══ LOS TRES SUBCOMANDOS ══\n');

const rg = await owner(DUENO, 'rangos');
const trg = texto(rg);
caso('rangos: dice que la fuente son los ocho', trg.indexOf('los **ocho**') >= 0);
caso('rangos: trae la tabla desde KV, no escrita',
     trg.indexOf('SSS 82') >= 0 && trg.indexOf('S 65') >= 0,
     volcado.meta && JSON.parse(volcado.meta).rangos
       ? '' : '(meta.rangos todavía no está en KV — falta correr subir_datos.py)');
caso('rangos: dice cuántos ven otra letra',
     /\d+ personas\*\* ven una letra/.test(trg) || trg.indexOf('coinciden') >= 0);

const es = await owner(DUENO, 'estado');
const tes = texto(es);
caso('estado: trae el sello del pipeline', tes.indexOf('último pipeline') >= 0);
caso('estado: trae los requisitos', tes.indexOf('Competitiva') >= 0);

const qn = await owner(DUENO, 'quien', [{ name: 'nombre', type: 3, value: 'Konan' }]);
const tqn = texto(qn);
caso('quien: encuentra a Konan por nombre', tqn.indexOf('`konan`') >= 0);
caso('quien: dice qué cartas tiene', tqn.indexOf('Cartas en R2') >= 0);

// ⚠️ EL NOMBRE CON TILDE ES EL CASO QUE ROMPE. `norm()` del Worker tiene que
// dar la misma clave que `comun/claves.py`; si no, esto contesta «no hay
// nada» de alguien que sí está, que es el bug más viejo de este bot.
const claves = Object.keys(volcado).filter((k) => k.startsWith('p:'));
const conTilde = claves.map((k) => k.slice(2)).find((k) => /[a-z]/.test(k)) || 'konan';
const qt = await owner(DUENO, 'quien', [{ name: 'nombre', type: 3, value: conTilde }]);
caso(`quien: «${conTilde}» sale de KV`, texto(qt).indexOf('No hay nada en KV') < 0);

const qx = await owner(DUENO, 'quien', [{ name: 'nombre', type: 3, value: 'NoExisteNadie' }]);
caso('quien: el que no está da un mensaje claro',
     texto(qx).indexOf('No hay nada en KV') >= 0);

const q0 = await owner(DUENO, 'quien', []);
caso('quien: sin argumentos pregunta de quién', texto(q0).indexOf('¿De quién?') >= 0);

console.log('\n══ QUE NO SE ESCAPE A UN CANAL ══\n');
for (const [etq, r] of [['rangos', rg], ['estado', es], ['quien', qn]]) {
  // ⚠️ SIN ESTO, `/owner` EN UN CANAL PÚBLICO LO VE TODO EL SERVIDOR. No es
  // un dato secreto, pero sí es ruido en un canal de cartas — y la respuesta
  // de `quien` trae el detalle de una persona que no lo pidió.
  caso(`${etq} contesta efímero`, efimero(r));
}

console.log('');
if (mal) {
  console.log(`🔴 ${mal} fallaron\n`);
  process.exit(1);
}
console.log('✅ todo bien\n');
