// 🎙️💎 La prueba de los eventos grabados con el Premium (28/11/2026), sin Discord, sin Cloudflare y sin red: quién oye qué
// (sin cuenta, su batalla, Premium por rol, por el objeto y vencido), el Range, el sello (que no se lee, no se toca y
// vence), el contrato con el motor (bot/grabados_casos.json, el mismo que lee bot/grabados.py --auto), el post del foro,
// y en el objeto de verdad (SQLite de Node): la lista, olvidarme, mudar la cuenta, la poda y el foro; y la puerta del
// Worker y la de la página (bot/paginas/_worker.js) con el audio servido por pedazos.
//
//     node bot/grabados_prueba.mjs
import fs from 'node:fs';
import * as GR from './grabados.js';

let fallas = 0, bien = 0;
const ok = (c, t, extra) => {
  if (c) bien += 1;
  else { fallas += 1; console.log('  🔴 ' + t + (extra !== undefined ? '\n     ' + String(extra).slice(0, 600) : '')); }
};
const DIA = 86400000, MIN = 60000;
const A = '111111111111111111', B = '222222222222222222', C = '333333333333333333', D = '444444444444444444', X = '555555555555555555';
const T0 = Date.UTC(2026, 10, 28, 22, 0);

// ── 1. la regla ──────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const ev = { hasta_e: T0 + 30 * DIA, hasta_p: T0 + 90 * DIA, hasta_v: T0 + 30 * DIA, partes: { c: '1', m: ['2'] }, mejor: { k: 'x' } };
  const b = { ids: [A, B], entera: { k: 'e' }, previa: { k: 'p' } };
  const ac = (tipo, quien, premium, o = {}) => GR.acceso(Object.assign({ tipo, quien, premium, b, ev, ahora: T0 }, o));
  ok(ac('previa', '', false).ok, 'sin cuenta: el adelanto de 30 s sí');
  ok(!ac('entera', '', false).ok && ac('entera', '', false).no === 'entrar', 'sin cuenta: la batalla entera no, y dice «entrá»');
  ok(ac('entera', A, false).ok && ac('entera', A, false).por === 'tuya', 'quien rapeó esa batalla la oye entera, gratis');
  ok(ac('entera', B, false).por === 'tuya', 'el rival también (su batalla es suya)');
  ok(!ac('entera', X, false).ok && ac('entera', X, false).no === 'premium', 'con cuenta y sin Premium, la de otros no: «premium»');
  ok(ac('entera', X, true).ok && ac('entera', X, true).por === 'premium', 'con Premium, cualquier batalla entera');
  ok(!ac('evento', A, false).ok && ac('evento', X, true).ok, 'la grabación completa: sólo Premium (ni el que rapeó)');
  ok(!ac('evento', '', false).ok && ac('evento', '', false).no === 'entrar', 'la grabación completa sin cuenta: «entrá»');
  ok(ac('mejor', '', false).ok, '«Lo mejor de la noche» es de todos (mejor_libre, lo de entrada)');
  ok(!ac('mejor', X, false, { cfg: Object.assign({}, GR.CFG0, { mejor_libre: false }) }).ok, 'con mejor_libre apagado, es del Premium');
  const tarde = T0 + 31 * DIA;
  ok(!ac('entera', A, false, { ahora: tarde }).ok && ac('entera', A, false, { ahora: tarde }).no === 'vencido', 'pasados los días de lo entero: vencido, también la suya');
  ok(!ac('entera', X, true, { ahora: tarde }).ok, '… y para el Premium');
  ok(ac('previa', '', false, { ahora: tarde }).ok, 'el adelanto sigue (dura más)');
  ok(!ac('previa', '', false, { ahora: T0 + 91 * DIA }).ok, 'y vence a su vez');
  ok(!ac('evento', X, true, { ahora: tarde }).ok, 'la grabación completa también vence');
  const ret = { ids: [], entera: null, previa: null, retirada: true };
  ok(ac('previa', '', false, { b: ret }).no === 'retirada' && ac('entera', X, true, { b: ret }).no === 'retirada', 'una batalla retirada (olvidarme) no se sirve a nadie');
  ok(ac('evento', X, true, { ev: Object.assign({}, ev, { sin_partes: true }) }).no === 'retirada', 'y la grabación completa de ese evento tampoco');
  ok(!GR.acceso({ tipo: 'entera', quien: A, b, ev: null }).ok, 'sin evento: no existe');
  ok(!ac('nada', A, true).ok, 'un tipo que no existe: no');

  ok(GR.premiumDe({ quien: X, roles: ['1054496803548049463'] }) && GR.premiumDe({ quien: X, roles: ['1563941336531607575'] }), 'Premium por rol: «Pase T» y «Pase Premium»');
  ok(!GR.premiumDe({ quien: X, roles: ['1206980203352690749'] }), 'otro rol no');
  ok(GR.premiumDe({ quien: X, rango: [T0 - DIA, null], ahora: T0 }), 'Premium por el objeto (pase_premium sin cierre)');
  ok(!GR.premiumDe({ quien: X, rango: [T0 - 2 * DIA, T0 - DIA], ahora: T0 }), 'Premium que ya se cerró: no');
  ok(!GR.premiumDe({ quien: X, rango: [T0 + DIA, null], ahora: T0 }), 'Premium que todavía no empieza: no');
  ok(!GR.premiumDe({ quien: '', roles: ['1054496803548049463'] }), 'sin cuenta nunca es Premium');
}

// ── 2. el Range ──────────────────────────────────────────────────────────────────────────────────────────────────────
{
  ok(GR.rango(null) === null && GR.rango('') === null, 'sin Range: null');
  ok(JSON.stringify(GR.rango('bytes=0-99')) === '{"offset":0,"length":100}', 'bytes=0-99');
  ok(JSON.stringify(GR.rango('bytes=500-')) === '{"offset":500}', 'bytes=500-');
  ok(JSON.stringify(GR.rango('bytes=-200')) === '{"suffix":200}', 'bytes=-200');
  ok(GR.rango('bytes=9-3') === 'mal' && GR.rango('bytes=0-1,5-6') === 'mal' && GR.rango('items=0-1') === 'mal' && GR.rango('bytes=-') === 'mal', 'lo raro: «mal» (va entero)');
  ok(JSON.stringify(GR.tramo(GR.rango('bytes=0-99'), 1000)) === '[0,99]', 'tramo 0-99');
  ok(JSON.stringify(GR.tramo(GR.rango('bytes=900-5000'), 1000)) === '[900,999]', 'el final se recorta al tamaño');
  ok(JSON.stringify(GR.tramo(GR.rango('bytes=-200'), 1000)) === '[800,999]' && JSON.stringify(GR.tramo(GR.rango('bytes=-5000'), 1000)) === '[0,999]', 'sufijo');
  ok(GR.tramo(GR.rango('bytes=1000-'), 1000) === null, 'desde más allá del final: 416');
  ok(JSON.stringify(GR.tramo('mal', 1000)) === '[0,999]' && JSON.stringify(GR.tramo(null, 10)) === '[0,9]', 'sin rango o malo: entero');
  ok(GR.tramo(null, 0) === null, 'un archivo vacío no se sirve');
}

// ── 3. el sello ──────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const S = 'token-de-prueba';
  const t = await GR.sellar({ b: 'c', k: 'grab/ev-ab/1.m4a', s: 10, ct: 'audio/mp4' }, S, T0);
  const x = await GR.abrir(t, S, T0 + MIN);
  ok(x && x.k === 'grab/ev-ab/1.m4a' && x.s === 10, 'el sello se abre con el mismo secreto');
  ok(!t.includes('grab') && !Buffer.from(t.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('latin1').includes('grab/'), 'adentro no se lee la clave de R2');
  ok(await GR.abrir(t, S, T0 + GR.SELLO_MIN * MIN + 1) === null, 'a las 2 h vence');
  ok(await GR.abrir(t, 'otro', T0) === null, 'con otro secreto (el token rotado) no abre');
  const tocado = t.slice(0, 30) + (t[30] === 'A' ? 'B' : 'A') + t.slice(31);
  ok(await GR.abrir(tocado, S, T0) === null, 'un sello tocado no abre');
  ok(await GR.abrir('../../fotos', S, T0) === null && await GR.abrir('', S, T0) === null, 'basura no abre');
  const t2 = await GR.sellar({ k: 'x' }, S, T0);
  ok(t2 !== await GR.sellar({ k: 'x' }, S, T0), 'dos sellos de lo mismo no se parecen (IV al azar)');
}

// ── 4. el contrato con el motor ──────────────────────────────────────────────────────────────────────────────────────
const CASOS = JSON.parse(fs.readFileSync(new URL('./grabados_casos.json', import.meta.url), 'utf-8'));
{
  const R = GR.limpiarRegistro(CASOS.registro);
  ok(!R.error && R.batallas.length === 2, 'el registro del motor entra entero (2 batallas: la sin archivos no venía)', JSON.stringify(R).slice(0, 300));
  ok(R.batallas[0].ids.join() === [A, B].join() && R.batallas[1].ids.join() === [A, C, D].join(), 'los IDs de cada batalla, del 2vs2 también');
  ok(R.batallas[0].entera.k === CASOS.registro.batallas[0].entera.k && R.batallas[0].detp.s === 900, 'las claves y los pesos pasan tal cual');
  ok(R.partes && R.partes.m.length === 2 && R.mejor && R.mejor.dur === 215, 'la grabación completa (Logs) y lo mejor de la noche');
  ok(R.ll === '701' && R.sv === 'FFA' && R.bk === 'c', 'llave, servidor y bucket');
  const malo = JSON.parse(JSON.stringify(CASOS.registro));
  malo.batallas[0].entera.k = 'fotos/t1/konan.webp';
  malo.batallas[0].ids.push('nope', A);
  malo.batallas[0].espia = 'x';
  malo.batallas[1].previa = { k: 'grab/../../x.m4a', s: 1 };
  const M = GR.limpiarRegistro(malo);
  ok(!M.batallas[0].entera, 'una clave fuera de grab/ no entra: un sello nunca abre una carta ni una foto');
  ok(M.batallas[0].ids.join() === [A, B].join(), 'lo que no es un ID se cae y no se repite');
  ok(!('espia' in M.batallas[0]), 'lo que sobra no se copia');
  ok(!M.batallas[1].previa, 'una clave con ../ no entra');
  ok(GR.limpiarRegistro({ ev: 'x', ll: 'abc' }).error && GR.limpiarRegistro({ ev: '../x', ll: '1' }).error && GR.limpiarRegistro({ ev: 'x', ll: '1', batallas: [] }).error,
    'sin llave, con un evento raro o sin nada: no');
  ok(GR.cfgValida({ dias_entera: 30, foro: true }) && !GR.cfgValida({ dias_entera: 0 }) && !GR.cfgValida({ foro: 'si' })
    && !GR.cfgValida({ dias_entera: 60, dias_previa: 10 }), 'la config: días de 1 a 365, sí/no, y el adelanto no dura menos que lo entero');
}

// ── 6. el objeto de verdad ───────────────────────────────────────────────────────────────────────────────────────────
// un R2 de mentira: get con rango, head, delete
function bucketFalso() {
  const m = new Map();
  return {
    m, borradas: [],
    async put(k, b) { m.set(k, new Uint8Array(b)); },
    async head(k) { const b = m.get(k); return b ? { size: b.length } : null; },
    async get(k, op) {
      const b = m.get(k);
      if (!b) return null;
      const r = op && op.range;
      if (!r) return { body: b, size: b.length };
      // como R2: el sufijo vuelve como sufijo; desde más allá del final, error
      if (r.suffix != null) return { body: b.slice(Math.max(0, b.length - r.suffix)), size: b.length, range: { suffix: r.suffix } };
      if (r.offset >= b.length) throw new Error('InvalidRange');
      const o0 = r.offset, l = Math.min(r.length != null ? r.length : b.length, b.length - o0);
      return { body: b.slice(o0, o0 + l), size: b.length, range: { offset: o0, length: l } };
    },
    async delete(ks) { for (const k of [].concat(ks)) { this.borradas.push(k); m.delete(k); } },
  };
}
let DatabaseSync = null;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { DatabaseSync = null; }
if (!DatabaseSync) {
  console.log('  ⓘ sin node:sqlite (Node ' + process.version + '): el objeto no se prueba');
} else {
  const Av = await import('./avisos.js');
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
  const relojReal = Date.now;
  const fetchReal = globalThis.fetch;
  let AHORA = T0;
  Date.now = () => AHORA;
  const CARTAS = bucketFalso();
  const env = { KV: { get: async () => null }, CARTAS, DISCORD_TOKEN: 'token-de-prueba' };
  const o = new Av.Avisos({ storage: { sql, setAlarm() {}, getAlarm() { return null; } }, blockConcurrencyWhile: async (f) => f() }, env);
  await new Promise((r) => setTimeout(r, 5));
  // el Pase con su temporada interna, y el premium del objeto
  o.guardar('pase_v', '1');
  o.guardar('pase', { cfg: { temp: 'prueba', umbrales: [0, 300] } });
  sql.exec('INSERT INTO pase_premium (quien, temp, desde, hasta) VALUES (?, ?, ?, NULL)', X, 'prueba', T0 - DIA);
  sql.exec('INSERT INTO pase_premium (quien, temp, desde, hasta) VALUES (?, ?, ?, ?)', C, 'prueba', T0 - 3 * DIA, T0 - DIA);
  // los archivos del caso, con bytes de verdad
  for (const b of CASOS.registro.batallas) for (const q of ['entera', 'previa', 'det', 'detp']) {
    if (b[q]) await CARTAS.put(b[q].k, Uint8Array.from({ length: b[q].s }, (_, i) => i % 251));
  }
  // el registro: lo que tiene sólo la clave pasa por la puerta del Worker; el objeto lo guarda
  const pedirO = async (ruta, cuerpo) => (await o.fetch(new Request('https://avisos/' + ruta, { method: 'POST', body: JSON.stringify(cuerpo) }))).json();
  let r = await pedirO('grabados-registrar', CASOS.registro);
  ok(r.ok && r.batallas === 2 && r.partes === 2 && !r.foro, 'el objeto guarda el evento (y el foro está apagado: no publica)', JSON.stringify(r));
  // Discord de mentira para los adjuntos de Logs
  let pedidosDc = 0;
  const exHex = Math.floor((T0 + DIA) / 1000).toString(16);
  const dcFalso = async (u) => {
    pedidosDc += 1;
    const m = /messages\/(\d+)/.exec(u)[1];
    return new Response(JSON.stringify({ attachments: [
      { filename: 'grabacion-2026-11-27-parte1.ogg', size: 9000000, url: `https://cdn.discordapp.com/attachments/1504110449535483924/${m}/grabacion-2026-11-27-parte1.ogg?ex=${exHex}&is=1&hm=ab` },
      { filename: 'habla.json', size: 10, url: `https://cdn.discordapp.com/attachments/1504110449535483924/${m}/habla.json?ex=1` }] }), { status: 200 });
  };
  const L = async (quien) => GR.lista(o, { ll: '701', quien }, AHORA, dcFalso);
  let l = await L('');
  ok(l.hay && l.yo === 'anon' && l.batallas.every((b) => b.nivel === 'previa' && b.a && /p\.m4a$/.test(b.a.k)), 'sin cuenta: el adelanto de cada batalla', JSON.stringify(l.batallas));
  ok(l.partes.length === 0 && l.evento && !l.evento.ok && l.evento.no === 'entrar', 'sin cuenta: la grabación completa, cerrada («entrá»)');
  ok(l.mejor && l.mejor.k.endsWith('mejor.m4a'), 'sin cuenta: lo mejor de la noche sí');
  ok(pedidosDc === 0, 'sin Premium no se le pregunta nada a Discord');
  l = await L(B);
  ok(l.yo === 'libre' && l.batallas[0].nivel === 'entera' && l.batallas[0].por === 'tuya' && l.batallas[0].tuya, 'Bea: su batalla (octavos) entera');
  ok(l.batallas[1].nivel === 'previa' && l.batallas[1].no === 'premium', 'Bea: la final, que no rapeó, sólo 30 s («premium»)');
  l = await L(A);
  ok(l.batallas.every((b) => b.nivel === 'entera' && b.por === 'tuya'), 'Ana rapeó las dos (la final en 2vs2): las dos enteras');
  ok(l.partes.length === 0, 'pero la grabación completa no: es del Premium');
  l = await L(X);
  ok(l.yo === 'premium' && l.batallas.every((b) => b.nivel === 'entera' && b.por === 'premium'), 'Premium por el objeto: todo entero');
  ok(l.partes.length === 2 && l.partes.every((p) => p.u.startsWith('https://cdn.discordapp.com/') && /grabacion-/.test(p.u)), 'Premium: las partes de Logs (sólo los grabacion-*.ogg)', JSON.stringify(l.partes));
  ok(pedidosDc === 2, 'un pedido a Discord por mensaje');
  await L(X);
  ok(pedidosDc === 2, 'la segunda vez, del guardado (el link de Discord dura un día)');
  l = await L(C);
  ok(l.yo === 'libre' && l.batallas[0].nivel === 'previa', 'Cata tuvo el Premium y se le cerró: vuelve a lo gratis (su final, entera)');
  ok(l.batallas[1].nivel === 'entera' && l.batallas[1].por === 'tuya', '… su final sí, entera: la rapeó');
  l = await L(Av.DUENO);
  ok(l.yo === 'premium', 'el dueño tiene todo');
  l = await GR.lista(o, { ll: '701', quien: D, roles: ['1563941336531607575'] }, AHORA, dcFalso);
  ok(l.yo === 'premium', 'Premium por el rol de Discord, si viene (una interacción)');
  l = await GR.lista(o, { ll: '702', quien: X }, AHORA, dcFalso);
  ok(l.ok && !l.hay, 'una llave sin grabación: «no hay»');
  ok((await GR.lista(o, { ll: 'x' })).error, 'una llave rara: error');

  // la puerta del Worker: la lista sellada y el audio por pedazos
  const envW = Object.assign({}, env, { AVISOS: { idFromName: () => 'x', get: () => ({ fetch: (u, init) => o.fetch(new Request(u, init)) }) } });
  const sesion = (q) => async () => q;
  const w = await GR.ruta(new Request('https://w/grabados?ll=701'), envW, null, false, sesion(B));
  const W = await w.json();
  const crudo = JSON.stringify(W);
  ok(w.status === 200 && w.headers.get('cache-control') === 'no-store', 'la lista no se guarda en ningún borde');
  ok(!crudo.includes('grab/') && !crudo.includes(A) && !crudo.includes(B) && !crudo.includes('r2.dev') && !('bk' in W), 'la lista no lleva claves de R2, IDs ni el bucket', crudo.slice(0, 300));
  ok(W.batallas[0].url.startsWith(GR.RUTA_AUDIO) && W.batallas[0].det.startsWith(GR.RUTA_AUDIO) && W.batallas[0].nivel === 'entera', 'cada batalla trae su link sellado');
  const sello = (u) => u.slice(GR.RUTA_AUDIO.length);
  const a1 = await GR.servir(new Request('https://w/a', { headers: { range: 'bytes=0-99' } }), envW, sello(W.batallas[0].url));
  const b1 = new Uint8Array(await a1.arrayBuffer());
  ok(a1.status === 206 && a1.headers.get('content-range') === 'bytes 0-99/1500000' && b1.length === 100 && b1[99] === 99,
    'Range 0-99: 206 con sus 100 bytes', a1.status + ' ' + a1.headers.get('content-range') + ' ' + b1.length);
  ok(a1.headers.get('accept-ranges') === 'bytes' && a1.headers.get('content-type') === 'audio/mp4' && /private/.test(a1.headers.get('cache-control')), 'acepta pedazos, es audio y es privado');
  const a2 = await GR.servir(new Request('https://w/a'), envW, sello(W.batallas[0].url));
  ok(a2.status === 200 && a2.headers.get('content-length') === '1500000' && (await a2.arrayBuffer()).byteLength === 1500000, 'sin Range: entero, 200');
  const a3 = await GR.servir(new Request('https://w/a', { headers: { range: 'bytes=-10' } }), envW, sello(W.batallas[0].url));
  ok(a3.status === 206 && a3.headers.get('content-range') === 'bytes 1499990-1499999/1500000' && (await a3.arrayBuffer()).byteLength === 10, 'los últimos 10 bytes');
  const a4 = await GR.servir(new Request('https://w/a', { headers: { range: 'bytes=999999-' } }), envW, sello(W.batallas[1].url));
  ok(a4.status === 416, 'más allá del final: 416', a4.status);
  const a5 = await GR.servir(new Request('https://w/a', { method: 'HEAD', headers: { range: 'bytes=10-19' } }), envW, sello(W.batallas[0].url));
  ok(a5.status === 206 && a5.headers.get('content-length') === '10' && (await a5.text()) === '', 'HEAD con Range: sólo los encabezados');
  const det = await GR.servir(new Request('https://w/a'), envW, sello(W.batallas[0].det));
  ok(det.status === 200 && /json/.test(det.headers.get('content-type')), 'la letra va por el mismo camino, como json');
  ok((await GR.servir(new Request('https://w/a'), envW, sello(W.batallas[0].url).slice(0, -2) + 'xx')).status === 410, 'un sello tocado: 410');
  AHORA += GR.SELLO_MIN * MIN + 1;
  ok((await GR.servir(new Request('https://w/a'), envW, sello(W.batallas[0].url))).status === 410, 'un sello de hace más de 2 h: 410 (no hay link permanente)');
  AHORA = T0;
  ok((await GR.servir(new Request('https://w/a', { method: 'POST' }), envW, sello(W.batallas[0].url))).status === 405, 'el audio sólo se lee');
  // la grabación completa, desde Discord, sin tocar R2
  globalThis.fetch = async (u, init) => {
    if (String(u).startsWith('https://discord.com/')) return dcFalso(u);
    ok(String(u).startsWith('https://cdn.discordapp.com/attachments/') && init.headers.range === 'bytes=0-9', 'al CDN de Discord, con el mismo Range');
    return new Response(new Uint8Array(10), { status: 206, headers: { 'content-range': 'bytes 0-9/9000000', 'content-length': '10' } });
  };
  const wp = await (await GR.ruta(new Request('https://w/grabados?ll=701'), envW, null, false, sesion(X))).json();
  ok(wp.partes.length === 2 && wp.partes[0].url.startsWith(GR.RUTA_AUDIO) && !JSON.stringify(wp).includes('discordapp'), 'Premium: las partes también selladas (el link de Discord no sale)');
  const ap = await GR.servir(new Request('https://w/a', { headers: { range: 'bytes=0-9' } }), envW, sello(wp.partes[0].url));
  ok(ap.status === 206 && ap.headers.get('content-range') === 'bytes 0-9/9000000' && ap.headers.get('content-type') === 'audio/ogg', 'la parte se reenvía por pedazos');
  globalThis.fetch = fetchReal;
  // lo del motor, sólo con la clave
  ok((await GR.ruta(new Request('https://w/grabados/registrar', { method: 'POST', body: '{}' }), envW, null, false, sesion(''))).status === 403, 'registrar sin la clave del ciclo: 403');
  ok((await GR.ruta(new Request('https://w/grabados/registrar', { method: 'POST', body: 'x'.repeat(GR.MAX_CUERPO + 1) }), envW, null, true, sesion(''))).status === 413, 'demasiado grande: 413');
  ok((await GR.ruta(new Request('https://w/grabados?ll=701', { method: 'POST' }), envW, null, false, sesion(''))).status === 405, 'la lista es GET');

  // el vencimiento: lo entero a los 30 días, el adelanto a los 90
  AHORA = T0 + 31 * DIA;
  const n1 = await GR.podar(o, AHORA);
  l = await L(A);
  ok(n1 === 3 && l.hay && l.batallas.every((b) => b.nivel === 'previa'), 'a los 31 días: lo entero se borró de R2 y queda el adelanto, también para el que rapeó', n1 + ' ' + JSON.stringify(l.batallas));
  ok(!CARTAS.m.has(CASOS.registro.batallas[0].entera.k) && CARTAS.m.has(CASOS.registro.batallas[0].previa.k), 'en R2: fuera lo entero, queda el adelanto');
  AHORA = T0 + 91 * DIA;
  await GR.podar(o, AHORA);
  l = await L(X);
  ok(!l.hay && !CARTAS.m.has(CASOS.registro.batallas[0].previa.k) && !sql.exec('SELECT * FROM grab_b').toArray().length, 'a los 91 días: no queda nada');
  AHORA = T0;

  // olvidarme y mudar la cuenta
  for (const b of CASOS.registro.batallas) for (const q of ['entera', 'previa', 'det', 'detp']) if (b[q]) await CARTAS.put(b[q].k, new Uint8Array(10));
  await pedirO('grabados-registrar', CASOS.registro);
  GR.mudar(o, B, X);
  l = await L(X);
  ok(l.batallas[0].tuya, 'la cuenta que se muda se lleva «su batalla»');
  CARTAS.borradas = [];
  await o.olvidar({ quien: A });
  l = await L(X);
  ok(l.batallas.every((b) => b.nivel === 'cerrada' && b.no === 'retirada'), 'olvidarme (Ana): sus dos batallas se retiran para todos', JSON.stringify(l.batallas));
  ok(CARTAS.borradas.length === 6 && !CARTAS.m.has(CASOS.registro.batallas[1].entera.k), 'y se borran de R2 (sus 6 piezas)', CARTAS.borradas.length);
  ok(!sql.exec('SELECT ids FROM grab_b').toArray().some((f) => f.ids.includes(A)), 'su ID ya no está en el índice');
  ok(l.evento === null && l.partes.length === 0, 'y la grabación completa de ese evento ya no se sirve (ni al Premium)');

  // la config y el foro
  r = await pedirO('grabados-config', { dias_entera: 0 });
  ok(r.error, 'config mala: no');
  r = await pedirO('grabados-config', {});
  ok(r.cfg && r.cfg.foro === false && r.cfg.dias_entera === 30, 'la config de entrada');
  await pedirO('grabados-registrar', Object.assign({}, CASOS.registro, { ev: 'otro-ev', ll: '703' }));
  // 📚 la historia para el foro (un post por servidor lo arma bot/grabados_foro.py): no se poda con los audios
  let H = await pedirO('grabados-foro-datos', {});
  ok(H.ok && H.cfg.foro === false && H.eventos.some((e) => e.ev === 'otro-ev' && e.ll === '703' && e.sv === 'FFA' && e.n === 2 && e.yt === ''),
    'la historia tiene cada evento: servidor, llave, nombre, día y cuántas batallas', JSON.stringify(H.eventos).slice(0, 300));
  ok(!JSON.stringify(H).includes(A) && !JSON.stringify(H).includes('grab/'), 'sin IDs de nadie ni claves de R2');
  r = await pedirO('grabados-youtube', { ll: '703', yt: 'dQw4w9WgXcQ' });
  ok(r.ok && r.n === 1, 'el video de YouTube del evento, por su llave (el pase a no listado)');
  r = await pedirO('grabados-youtube', { ev: 'otro-ev', yt: 'abcdefghijk' });
  ok(r.ok && r.n === 1, '… o por su evento (el motor, al subirlo)');
  ok((await pedirO('grabados-youtube', { ev: 'otro-ev', yt: 'https://youtu.be/x' })).error, 'un id de YouTube con otra forma: no');
  await pedirO('grabados-registrar', Object.assign({}, CASOS.registro, { ev: 'otro-ev', ll: '703', nombre: 'VOL 41' }));
  H = await pedirO('grabados-foro-datos', {});
  ok(H.eventos.find((e) => e.ev === 'otro-ev').yt === 'abcdefghijk' && H.eventos.find((e) => e.ev === 'otro-ev').nombre === 'VOL 41',
    'registrar de nuevo actualiza el evento y no pierde su video');
  AHORA = T0 + 200 * DIA;
  await GR.podar(o, AHORA);
  AHORA = T0;
  H = await pedirO('grabados-foro-datos', {});
  ok(!sql.exec('SELECT * FROM grab_ev').toArray().length && H.eventos.length >= 1, 'pasados los 90 días se van los audios, la historia del foro queda');
  ok((await pedirO('grabados-foro-guardar', { sv: 'FFA', hilo: '1590000000000000001', mensajes: ['1590000000000000001', '1590000000000000002', 'x'], huella: 'abc' })).ok,
    'el estado de un post: el hilo y sus mensajes');
  ok((await pedirO('grabados-foro-guardar', { sv: 'ffa; drop', hilo: '1' })).error, 'un servidor o un hilo raros: no');
  H = await pedirO('grabados-foro-datos', {});
  ok(H.posts.length === 1 && H.posts[0].mensajes.join() === '1590000000000000001,1590000000000000002' && H.posts[0].huella === 'abc', 'y vuelve con la historia');
  r = await pedirO('grabados-config', { foro: true });
  ok(r.cfg.foro === true && (await pedirO('grabados-foro-datos', {})).cfg.foro === true, 'Dlx lo prende y el armador del foro se entera');
  await pedirO('grabados-config', { foro: false });
  ok((await GR.ruta(new Request('https://w/grabados/foro-datos', { method: 'POST', body: '{}' }), envW, null, false, sesion(''))).status === 403,
    'la historia sólo con la clave del ciclo');
  Date.now = relojReal;
}

// ── 6b. el «Escuchar» del staff, sellado (28/11/2026: el link de cdn.discordapp.com no sonaba por `media-src`) ──────────
{
  const S = 'token-de-prueba';
  const u = 'https://cdn.discordapp.com/attachments/1504110449535483924/1580000000000000001/grabacion-2026-11-27-parte1.ogg?ex=6a1b2c3d&is=1&hm=ab';
  const l = await GR.linkAdjunto(u, 9000000, S, T0);
  const x = await GR.abrir(l.slice(GR.RUTA_AUDIO.length), S, T0 + MIN);
  ok(l.startsWith(GR.RUTA_AUDIO) && !l.includes('discordapp') && x && x.u === u && x.ct === 'audio/ogg', 'el staff recibe la grabación sellada, por el Worker');
  ok(await GR.linkAdjunto('https://evil.example/grabacion-x.ogg', 1, S) === '' && await GR.linkAdjunto(u.replace('grabacion-', 'habla-'), 1, S) === ''
    && await GR.linkAdjunto(u, 1, '') === '', 'sólo adjuntos grabacion-*.ogg de Discord, y con secreto');
  const fuente = fs.readFileSync(new URL('./avisos.js', import.meta.url), 'utf-8');
  const tramo = fuente.slice(fuente.indexOf("if (accion === 'grabacion')"), fuente.indexOf("if (accion !== 'corregir'"));
  ok(tramo.includes('GR.linkAdjunto(') && !/url: a\.url/.test(tramo), 'socioLlave() ya no le da a la página el link de Discord');
}

// ── 7. la puerta de la página (bot/paginas/_worker.js) ───────────────────────────────────────────────────────────────
{
  const P = (await import('./paginas/_worker.js')).default;
  const fetchReal = globalThis.fetch;
  const vistos = [];
  globalThis.fetch = async (u, init) => {
    vistos.push([String(u), init]);
    if (String(u).includes('/grabados/a/')) return new Response(new Uint8Array(4), { status: 206, headers: { 'content-type': 'audio/mp4', 'content-range': 'bytes 0-3/10', 'content-length': '4', 'accept-ranges': 'bytes', 'set-cookie': 'x=1' } });
    return new Response('{"ok":true,"hay":false}', { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const ses = 'S'.repeat(40);
  const r1 = await P.fetch(new Request('https://underlegends.pages.dev/api/grabados?ll=701', { headers: { cookie: 'lg_ses=' + ses } }), { ASSETS: { fetch: () => new Response('asset') } }, { waitUntil() {} });
  ok(r1.status === 200 && vistos[0][0].endsWith('/grabados?ll=701') && vistos[0][1].headers['x-lg-ses'] === ses && r1.headers.get('cache-control') === 'no-store',
    'la página pide la lista con la sesión y sin borde', JSON.stringify(vistos[0]).slice(0, 200));
  const r2 = await P.fetch(new Request('https://underlegends.pages.dev/api/grabados/a/ABC', { headers: { range: 'bytes=0-3' } }), { ASSETS: { fetch: () => new Response('asset') } }, { waitUntil() {} });
  ok(r2.status === 206 && vistos[1][0].endsWith('/grabados/a/ABC') && vistos[1][1].headers.range === 'bytes=0-3' && r2.headers.get('content-range') === 'bytes 0-3/10',
    'el audio pasa con su Range y vuelve 206', JSON.stringify(vistos[1]).slice(0, 200));
  ok(!r2.headers.get('set-cookie') && r2.headers.get('x-content-type-options') === 'nosniff', 'del audio no pasa nada más que lo de un audio');
  const r3 = await P.fetch(new Request('https://underlegends.pages.dev/api/grabados/a/ABC', { method: 'POST' }), { ASSETS: { fetch: () => new Response('asset') } }, { waitUntil() {} });
  ok(r3.status === 405 || r3.status === 403, 'y no se le manda nada', r3.status);
  globalThis.fetch = fetchReal;
}

console.log((fallas ? '🔴 ' + fallas + ' fallas' : '✅ todo bien') + ' · grabados: ' + bien + ' comprobaciones');
process.exit(fallas ? 1 : 0);
