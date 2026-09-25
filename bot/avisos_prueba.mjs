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
const ok = (cond, que) => {
  console.log(`  ${cond ? '✅' : '❌'} ${que}`);
  if (!cond) fallas++;
};

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
    const ms = a ? A.momentoMs(a.horario, c.timestamp) : null;
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

if (fallas) {
  console.log(`\n❌ ${fallas} prueba(s) fallaron`);
  process.exit(1);
}
console.log('\n✅ los avisos cifran como el RFC y leen como Python');
