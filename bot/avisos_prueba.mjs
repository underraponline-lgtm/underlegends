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
  ok(m2[m2.length - 1].m === 'campeon' && /Campeón de \*\*COPA SOOLAR\*\*: \*\*Dora 🇲🇽\*\*/.test(m2[m2.length - 1].texto)
    && !m2.some((x) => x.m === 'final'), 'con campeón: el campeón, y la final ya no');
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
  ok(JSON.stringify(A.favoritosDe(llaveDe(CUARTOS), [{ n: 'Ana', ovr: 80 }, { n: 'Dora', ovr: 90 },
    { n: 'Cami', ovr: 70 }, { n: 'cami', ovr: 75 }])) === '[["Dora",90],["Ana",80]]',
  'los favoritos: los de más OVR de la llave; un nombre de dos personas no cuenta');
  ok(A.chatGeneralDe([{ id: '1', type: 0, name: '💬┇charla' }, { id: '2', type: 0, name: 'chat-general' },
    { id: '3', type: 2, name: 'general' }, { id: '4', type: 0, name: 'general-staff' }]) === '2',
  'el chat general: «general» de texto, nunca el del staff ni el de voz');
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

// ── 3c · la postulación de /sumate (03/10/2026): qué se acepta y cómo le llega a Dlx ──
{
  console.log('3c · la postulación de /sumate');
  const v = A.validarPostulacion({ tipo: 'servidor', nombre: '  Rap\u0000 Zone  ', link: 'https://discord.gg/abc', miembros: '1.500',
    eventos: '99', mensaje: 'hola\r\n\r\n\r\n@everyone vengan' });
  ok(v.tipo === 'servidor' && v.nombre === 'Rap Zone' && v.miembros === 1500 && v.eventos === 50,
    'limpia el nombre y topea los números (50 eventos por semana como mucho)', JSON.stringify(v));
  ok(v.mensaje === 'hola\n\n@everyone vengan', 'el mensaje conserva los párrafos, sin pilas de líneas vacías');
  ok(A.validarPostulacion({ tipo: 'hacker', nombre: 'X Y' }).error === 'faltan', 'un tipo que no existe, no');
  ok(A.validarPostulacion({ tipo: 'marca', nombre: 'X' }).error === 'faltan', 'sin nombre, no');
  ok(A.validarPostulacion({ tipo: 'marca', nombre: 'Marca', link: 'javascript:alert(1)' }).error === 'faltan', 'un link que no es https, no');
  ok(A.validarPostulacion({ tipo: 'marca', nombre: 'Marca', eventos: 3 }).eventos === null, 'los eventos por semana, sólo de un servidor');
  const t = A.mensajePostulacion(v, '123456789012', 'hassan');
  ok(t.includes('<@123456789012>') && t.includes('Rap Zone') && t.includes('<https://discord.gg/abc>') && t.includes('> @everyone vengan'),
    'el DM dice quién (mención, que no suena: allowed_mentions vacío), qué, el link sin vista previa y el mensaje citado');
  const tm = A.mensajePostulacion(A.validarPostulacion({ tipo: 'otro', nombre: '[Hacé clic](https://malo.example)', mensaje: '**hola**' }), '1');
  ok(tm.includes('\\[Hacé clic\\]\\(https://malo.example\\)') && tm.includes('> \\*\\*hola\\*\\*'),
    'lo que escribió otro va sin Markdown: un link disfrazado en el nombre se ve como texto', tm);
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
  ok(r(['2026-10-01', '2026-10-02'], '2026-10-04').actual === 0 && r([], '2026-10-04').actual === 0,
    'con un día sin nada se corta, y sin días no hay racha');
  const y = r(['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-10-03', '2026-10-04'], '2026-10-04');
  ok(y.actual === 2 && y.maxima === 4 && y.hoy && y.inicio === '2026-10-03', 'la de ahora y la mejor son distintas');
  ok(r(['2026-10-31', '2026-11-01', '2026-11-02'], '2026-11-02').actual === 3 && r(['2026-12-31', '2027-01-01'], '2027-01-01').actual === 2,
    'el cambio de mes, de año y de horario no la cortan');
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
      && /Campeón de \*\*COPA SOOLAR\*\*: \*\*Dora 🇲🇽\*\*/.test(pedidos[2].b.content),
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
    globalThis.fetch = antesF;
  }
}

// 🎟️ EL PASE DE RAPERO SOBRE EL OBJETO DE VERDAD (05/10/2026): una Tarea es un nivel, cada nivel paga una vez, una
// cumplida no se pierde y sólo cuentan los miembros de DRA. Con `node:sqlite`, como el bot en vivo
{
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
    const ahora = Date.now(), DIA = 24 * 3600000;
    const hoy = new Date(ahora);
    const ini = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate() - 3, 15, 0);
    const fin = ini + 7 * DIA;
    const SEM = A.diaET(ini);
    const ANA = '111111111111111111', BEA = '222222222222222222', CAMI = '333333333333333333';
    const PREMIOS = Array.from({ length: 30 }, (_, i) => [i + 1, i + 1 === 30 ? 1000 : (i + 1) % 5 ? 200 : 500,
      { 5: 'insignia', 10: 'titulo', 15: 'insignia', 20: 'color', 25: 'titulo', 30: 'insignia' }[i + 1] || '',
      { 5: 'Pase Bronce', 10: 'De la casa', 15: 'Pase Plata', 20: '#F5C542', 25: 'Pilar de DRA', 30: 'Pase Oro' }[i + 1] || '']);
    const ciclo = (v, hechas) => o.paseCiclo({ v, cfg: { temp: 'prueba', niveles: 30, dias: 3, felicitar: 3,
      tareas: A.PASE_TAREAS.map((t) => [t, 'Tarea ' + t, '']), premios: PREMIOS }, sem: [[SEM, ini, fin]],
    miembros: [ANA, BEA], hechas });
    const tienda = (q) => sql.exec('SELECT id, monto FROM tienda WHERE quien = ? ORDER BY id', q).toArray();
    let r = ciclo('v1', { [ANA]: { [SEM]: [1, 0] }, [CAMI]: { [SEM]: [1, 1] } });
    let p = o.paseDe(ANA);
    ok(r.cambio && r.niveles === 1 && p.miembro && p.nivel === 1 && p.semana.tareas.find((t) => t.id === 'dra').hecha
      && tienda(ANA).length === 1 && tienda(ANA)[0].id === 'pase:prueba:' + ANA + ':1' && tienda(ANA)[0].monto === 200,
    'el Pase: Ana jugó en DRA, sube al nivel 1 y cobra sus 200 una vez');
    ok(ciclo('v1', {}).cambio === false && o.paseDe(CAMI).miembro === false && o.paseDe(CAMI).nivel === 0
      && !tienda(CAMI).length && o.paseDe(CAMI).semana.tareas.length === 5,
    'lo mismo del ciclo no se vuelve a guardar; Cami no es miembro de DRA: ve las Tareas, sin nivel ni Tienda');
    for (const d of [ini, ini + DIA, ini + 2 * DIA]) sql.exec('INSERT INTO activo (quien, dia) VALUES (?, ?)', ANA, A.diaET(d + 3 * 3600000));
    o.paseRevisar(ANA);
    for (const id of ['a1b2c3d4e5f6', 'a1b2c3d4e5f7']) o.aplaudir({ quien: ANA, pub: { id, tipo: 'campeon' } });
    p = o.paseDe(ANA);
    const fel = p.semana.tareas.find((t) => t.id === 'felicitar');
    ok(p.nivel === 2 && p.semana.tareas.find((t) => t.id === 'dias').hecha && !fel.hecha && fel.lleva === 2 && fel.meta === 3,
      'tres días seguidos es otra Tarea (nivel 2); dos aplausos de tres, todavía no');
    o.aplaudir({ quien: ANA, pub: { id: 'a1b2c3d4e5f8', tipo: 'campeon' } });
    ok(o.paseDe(ANA).nivel === 3 && o.leer('pase_v') === 'v1', 'el tercer aplauso la cumple: nivel 3');
    r = o.paseVivo({ quien: ANA, llave: '9' });
    ok(r.cuenta === false && o.paseDe(ANA).nivel === 3, 'sin nada en vivo, mirar no cuenta');
    sql.exec("INSERT INTO vivo (id, canal, sv, g, autor, pub, ed, texto, visto) VALUES ('9', '2', 'DRA', '1', 'x', ?, ?, 'llave', ?)",
      ahora - 60000, ahora, ahora);
    r = o.paseVivo({ quien: ANA, llave: '9' });
    const rb = o.paseVivo({ quien: BEA, llave: '9' });
    ok(r.cuenta && o.paseDe(ANA).nivel === 4 && rb.cuenta && o.paseDe(BEA).nivel === 1
      && o.paseVivo({ quien: CAMI, llave: '9' }).cuenta === false,
    'con una llave en vivo, mirarla cuenta (Ana 4, Bea 1); a Cami, que no es miembro, no');
    ciclo('v2', {});
    p = o.paseDe(ANA);
    ok(p.nivel === 4 && p.semana.tareas.find((t) => t.id === 'dra').hecha && tienda(ANA).length === 4,
      'el ciclo corrige la llave y Ana ya no jugó en DRA: la Tarea cumplida no se pierde, y nada se cobra dos veces');
    const b = sql.exec("SELECT titulo, url FROM bandeja WHERE quien = ? AND clave = 'pase:prueba'", ANA).toArray();
    ok(b.length === 1 && /Nivel 4/.test(b[0].titulo) && /\/freestyle-rap\/pase$/.test(b[0].url),
      'a la campana, uno solo que se pisa: «Nivel 4 del Pase»');
    const pr = o.pasePremios(o.paseDatos().cfg, 21);
    ok(pr.titulo === 'De la casa' && pr.color === '#F5C542' && pr.insignias.length === 2 && pr.insignias[1][1] === 'Pase Plata',
      'en el nivel 21: el título del 10, el color del 20 y dos insignias');
    sql.exec("INSERT INTO jugo_temp (quien, temp, k, eventos) VALUES (?, 'prueba', 'ana', 3)", ANA);
    const ps = o.pases().n;
    ok(ps.ana && ps.ana[0] === 4 && Object.keys(ps).length === 1,
      'para los perfiles, por clave: Ana nivel 4 (Bea no tiene perfil: no sale)');
  }
}

if (fallas) {
  console.log(`\n❌ ${fallas} prueba(s) fallaron`);
  process.exit(1);
}
console.log('\n✅ los avisos cifran como el RFC y leen como Python');
