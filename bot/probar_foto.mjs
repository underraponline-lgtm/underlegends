/**
 * `/foto` CONTRA EL WORKER DE VERDAD, CON R2 Y EL CDN DE MENTIRA.
 *
 *   python bot/volcar_kv.py      (primero: baja KV a bot/_kv_volcado.json)
 *   node bot/probar_foto.mjs
 *
 * ⚠️ R2 Y EL CDN VAN SIMULADOS A PROPOSITO. Lo que hay que probar es **la
 * regla** —una por temporada, el pase la saltea, el sello se escribe después
 * de guardar— y eso no necesita escribir de verdad. Probarlo contra el
 * bucket real dejaría basura en `fotos/t1/` cada vez que corre.
 *
 * 🔴 LO QUE MAS IMPORTA ES EL ORDEN: si el sello se escribiera ANTES de que
 * el PUT salga bien, un 404 del CDN le gastaría a la persona su único cambio
 * de la temporada sin haberle cambiado nada. Eso se prueba explícitamente.
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

// alguien que SI esta en la Liga, sacado del volcado
const UNO = Object.keys(volcado).find((k) => k.startsWith('d:')).slice(2);
const CLAVE_UNO = volcado['d:' + UNO];
const NADIE = '222222222222222222';
const ROL_PASE = '1531136241171697807';

let kv, r2, enviados, cdnFalla;
const nuevoEntorno = () => {
  kv = Object.assign({}, volcado);
  r2 = {};
  enviados = [];
  cdnFalla = false;
  return {
    DISCORD_PUBLIC_KEY: CLAVE,
    TEMPORADA: 't1',
    KV: {
      get: async (k) => (k in kv ? kv[k] : null),
      put: async (k, v) => { kv[k] = v; },
    },
    CARTAS: { put: async (k, cuerpo, op) => { r2[k] = op; } },
  };
};

const tareas = [];
const ctx = { waitUntil: (p) => tareas.push(p) };

globalThis.fetch = async (u, op) => {
  const url = String(u);
  if (url.indexOf('cdn.discordapp.com') >= 0) {
    if (cdnFalla) return new Response('', { status: 404 });
    return new Response('imagen', { status: 200 });
  }
  if (url.indexOf('/webhooks/') >= 0) {
    enviados.push(JSON.parse(op.body).content);
    return new Response('{}', { status: 200 });
  }
  return new Response('{}', { status: 200 });
};

let RELOJ = Date.now();
Date.now = () => RELOJ;

async function pedir(env, objeto) {
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
  const d = JSON.parse(await r.text());
  while (tareas.length) await tareas.shift();          // el waitUntil
  return d;
}

const foto = (env, { id = UNO, hash = 'abc123', roles = [], dm = false } = {}) =>
  pedir(env, {
    type: 2,
    ...(dm
      ? { user: { id, avatar: hash } }
      : { guild_id: '841017460341604382', member: { user: { id, avatar: hash }, roles } }),
    data: { name: 'foto' },
  });

const txt = (r) => (r && r.data && r.data.content) || '';
const diferida = (r) => r && r.type === 5;

let mal = 0;
const caso = (etq, ok, detalle) => {
  console.log(`  ${ok ? '✅' : '🔴'}  ${etq}${detalle ? '   ' + detalle : ''}`);
  if (!ok) mal += 1;
};

console.log('\n══ EL CAMINO FELIZ ══\n');
let env = nuevoEntorno();
let r = await foto(env);
caso('contesta diferida (tipo 5), no un mensaje', diferida(r));
caso('guardó en fotos/t1/<clave>.webp', !!r2[`fotos/t1/${CLAVE_UNO}.webp`]);
caso('la guardó como image/webp',
     (r2[`fotos/t1/${CLAVE_UNO}.webp`] || {}).httpMetadata?.contentType === 'image/webp');
caso('dejó el sello en KV', !!kv[`foto:t1:${CLAVE_UNO}`]);
caso('le avisó a la persona', (enviados[0] || '').indexOf('Listo') >= 0);
caso('le dijo que queda congelada', (enviados[0] || '').indexOf('congelada') >= 0);

console.log('\n══ UNA POR TEMPORADA ══\n');
r = await foto(env);          // el mismo entorno: el sello ya está
caso('la segunda vez la corta', txt(r).indexOf('Ya elegiste') >= 0);
caso('no es diferida: contesta al toque', !diferida(r));
caso('explica POR QUE, no sólo que no', txt(r).indexOf('Histórica') >= 0);

console.log('\n══ EL PASE LA SALTEA ══\n');
r = await foto(env, { roles: [ROL_PASE] });
caso('con el rol del pase sí la cambia', diferida(r));
caso('y volvió a guardar', !!r2[`fotos/t1/${CLAVE_UNO}.webp`]);

console.log('\n══ LOS CASOS QUE NO TIENEN QUE PASAR ══\n');
env = nuevoEntorno();
r = await foto(env, { id: NADIE });
caso('a alguien que no está en la Liga lo manda a /card',
     txt(r).indexOf('`/card`') >= 0 && !diferida(r));
caso('   ...y no escribió nada', Object.keys(r2).length === 0);

env = nuevoEntorno();
r = await foto(env, { hash: null });
caso('sin foto en Discord no guarda el blob gris',
     txt(r).indexOf('inicial') >= 0 && Object.keys(r2).length === 0);

// 🔴 EL ORDEN DEL SELLO. Si se escribiera antes del PUT, este caso dejaría
// a la persona sin su cambio de la temporada por un 404 ajeno.
env = nuevoEntorno();
cdnFalla = true;
r = await foto(env);
caso('si el CDN falla, avisa', (enviados[0] || '').indexOf('404') >= 0);
caso('   ...y NO le gasta el cambio de la temporada',
     !kv[`foto:t1:${CLAVE_UNO}`],
     kv[`foto:t1:${CLAVE_UNO}`] ? '🔴 el sello quedó escrito igual' : '');
caso('   ...y no dejó nada en R2', Object.keys(r2).length === 0);

// 🔴 TODO ESTO CORRE EN UN `waitUntil`, DONDE UN ERROR NO LO VE NADIE. Sin
// try/catch, un fallo de R2 o de la cuota de KV dejaba a la persona mirando
// «está pensando…» para siempre: la respuesta diferida nunca llegaba. Y no
// hay log que mirar, porque los del Worker no salen de Cloudflare en el
// plan gratis.
console.log('\n══ CUANDO ALGO REVIENTA ADENTRO DEL waitUntil ══\n');

env = nuevoEntorno();
env.CARTAS.put = async () => { throw new Error('r2 caido'); };
r = await foto(env);
caso('si R2 falla, contesta igual', enviados.length > 0,
     enviados.length ? '' : '🔴 se quedaría en «pensando…»');
caso('   ...y dice que NO le gastó el cambio',
     (enviados[0] || '').indexOf('no te gasté') >= 0 ||
     (enviados[0] || '').indexOf('**no te gasté**') >= 0);
caso('   ...y no dejó el sello', !kv[`foto:t1:${CLAVE_UNO}`]);

env = nuevoEntorno();
env.KV.put = async () => { throw new Error('cuota de KV agotada'); };
r = await foto(env);
caso('si KV falla, contesta igual', enviados.length > 0);
// ⚠️ ESTE CASO NO ES «FALLO»: la foto SI se guardó y lo único que no quedó
// es la marca. Decir «no pude» sería mentir.
caso('   ...y dice que la foto SÍ quedó',
     (enviados[0] || '').indexOf('quedó guardada') >= 0);
caso('   ...y avisa que va a poder cambiarla de nuevo',
     (enviados[0] || '').indexOf('de nuevo') >= 0);
caso('   ...y la foto está en R2', !!r2[`fotos/t1/${CLAVE_UNO}.webp`]);

env = nuevoEntorno();
const fetchViejo = globalThis.fetch;
globalThis.fetch = async (u, op) => {
  if (String(u).indexOf('cdn.discordapp.com') >= 0) throw new Error('sin red');
  return fetchViejo(u, op);
};
r = await foto(env);
caso('si el CDN ni responde, contesta igual', enviados.length > 0);
caso('   ...y no escribió nada', Object.keys(r2).length === 0);
globalThis.fetch = fetchViejo;

console.log('\n══ SIN EL BINDING DE R2 ══\n');
env = nuevoEntorno();
delete env.CARTAS;
r = await foto(env);
caso('lo dice en vez de morir en silencio',
     txt(r).indexOf('enchufado') >= 0 && !diferida(r));

console.log('\n══ POR MENSAJE DIRECTO ══\n');
env = nuevoEntorno();
r = await foto(env, { dm: true });
caso('anda igual (la foto es personal, no de un servidor)', diferida(r));
env = nuevoEntorno();
kv[`foto:t1:${CLAVE_UNO}`] = '{}';
r = await foto(env, { dm: true, roles: [ROL_PASE] });
// ⚠️ EN UN DM NO HAY `member`, ASI QUE NO HAY ROLES. El pase sólo se puede
// leer adentro de DRA, y el comando tiene que comportarse como si no lo
// tuviera en vez de romperse buscando `member.roles`.
caso('en DM el pase no se puede leer, y no revienta',
     txt(r).indexOf('Ya elegiste') >= 0);

console.log('');
if (mal) { console.log(`🔴 ${mal} fallaron\n`); process.exit(1); }
console.log('✅ todo bien\n');
