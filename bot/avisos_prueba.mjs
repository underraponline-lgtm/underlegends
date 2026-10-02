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
  globalThis.fetch = async () => new Response(JSON.stringify({ id: '554330098812059679' }), { status: 200 });
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
    const ms = a ? A.momentoMs(a.horario, c.timestamp, a.fecha) : null;
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


if (fallas) {
  console.log(`\n❌ ${fallas} prueba(s) fallaron`);
  process.exit(1);
}
console.log('\n✅ los avisos cifran como el RFC y leen como Python');
