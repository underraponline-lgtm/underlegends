/**
 * 🎞️ EL DROP DE DISCORD DE PUNTA A PUNTA (20/11/2026): el Worker de verdad (`worker.js`, con la firma de Discord) contra
 * el objeto de verdad (`avisos.js`, sobre el SQLite de Node). Dlx: «fijate que funcione completamente».
 *
 *   node bot/drop_discord_prueba.mjs            todo, sin red
 *   node bot/drop_discord_prueba.mjs --r2       además pide a R2 cada GIF que el Worker mostró (red)
 *
 * Por cada drop: «Abrir un Drop» (lo abre el objeto y la respuesta llega por el PATCH de Discord), los cuatro «Tap» con el
 * botón que dejó la pantalla anterior, y «Abrir». Se mira que la rareza nunca baje, que termine en la que guardó el objeto,
 * que el premio que se lee sea el que se pagó, que se pague UNA vez, y que cada GIF tenga el nombre que graba
 * herramientas/gif_drops.py. ⚠️ `node:sqlite`: Node 22.5 o más (sin él, avisa y no prueba).
 */
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto) globalThis.crypto = webcrypto;

let DatabaseSync = null;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { DatabaseSync = null; }
if (!DatabaseSync) {
  console.log('ⓘ sin node:sqlite (Node ' + process.version + '): no se prueba');
  process.exit(0);
}
const A = await import('./avisos.js');
const { default: worker } = await import('./worker.js');

const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const par = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
const CLAVE = hex(await crypto.subtle.exportKey('raw', par.publicKey));

// ── el objeto, sobre SQLite en memoria ─────────────────────────────────────────────────────────────────────────────
const db = new DatabaseSync(':memory:');
const sql = {
  exec(q, ...ps) {
    const t = String(q).trim();
    if (!ps.length && /;\s*\S/.test(t)) { db.exec(t); return { toArray: () => [], rowsWritten: 0 }; }
    const st = db.prepare(t);
    if (/^\s*(SELECT|WITH|PRAGMA)/i.test(t)) { const rows = st.all(...ps); return { toArray: () => rows }; }
    const r = st.run(...ps);
    return { toArray: () => [], rowsWritten: Number(r.changes) };
  },
};
const kvObj = new Map();
const o = new A.Avisos({ storage: { sql, setAlarm() {}, getAlarm() { return null; } }, blockConcurrencyWhile: async (f) => f() },
  { DISCORD_TOKEN: 'x', KV: { get: async (k) => kvObj.get(k) ?? null, put: async (k, v) => { kvObj.set(k, v); } } });
await new Promise((r) => setTimeout(r, 5));

// ── el Worker, con su KV de mentira y el objeto de arriba ─────────────────────────────────────────────────────────
const KV = new Map();
const env = {
  DISCORD_PUBLIC_KEY: CLAVE,
  KV: { get: async (k) => KV.get(k) ?? null, put: async (k, v) => { KV.set(k, v); }, delete: async (k) => { KV.delete(k); } },
  AVISOS: { idFromName: () => 'liga', get: () => ({ fetch: (url, init) => o.fetch(new Request(url, init)) }) },
};
// lo que el Worker le manda a Discord después de contestar (el PATCH del mensaje)
const fetchReal = globalThis.fetch;
const parches = [];
globalThis.fetch = async (url, op = {}) => {
  if (/discord\.com\/api\/v10\/webhooks\//.test(String(url))) {
    parches.push({ url: String(url), metodo: op.method, cuerpo: JSON.parse(op.body || '{}') });
    return new Response('{}', { status: 200 });
  }
  return new Response('{}', { status: 404 });
};
const pendientes = [];
const ctx = { waitUntil: (p) => pendientes.push(p) };
let RELOJ = Date.now();
const ahoraReal = Date.now;
Date.now = () => RELOJ;

async function pedir(objeto) {
  RELOJ += 60000;                       // cada toque, un minuto después: el freno de clics no entra en la prueba
  const cuerpo = JSON.stringify(objeto);
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = hex(await crypto.subtle.sign('Ed25519', par.privateKey, new TextEncoder().encode(ts + cuerpo)));
  const r = await worker.fetch(new Request('https://x/', { method: 'POST', headers: { 'x-signature-ed25519': sig, 'x-signature-timestamp': ts }, body: cuerpo }), env, ctx);
  await Promise.all(pendientes.splice(0));
  let j = null;
  try { j = JSON.parse(await r.text()); } catch (e) { j = null; }
  return j;
}
const QUIEN = '700970000000000001';
// el mensaje del botón es V2 y efímero (como lo deja el Worker desde los comandos en V2): así se prueba el camino de hoy
const boton = (cid) => pedir({ type: 3, id: 'i' + RELOJ, application_id: A.APP_ID, token: 'tok' + RELOJ, guild_id: '841017460341604382', channel_id: '1',
  member: { user: { id: QUIEN } }, message: { id: 'm1', flags: 64 | 32768 }, data: { custom_id: cid, component_type: 2 } });
const VI = await import('./vista.js');
const gifDe = (m) => ((VI.piezas(m, 12)[0] || {}).items || [{}])[0]?.media?.url || '';
const txt = (m) => VI.textoV2(m);
const botones = (m) => VI.piezas(m, 2);

let mal = 0, bien = 0;
const ok = (t, c, det = '') => { if (c) bien++; else { mal++; console.log('  ❌ ' + t + (det ? '   ' + det : '')); } };
const RZ = ['Maqueta', 'Mixtape', 'Vinilo', 'Disco de Oro', 'Micrófono de Oro'];
//: la rareza que dice la pantalla: «### Dragón Drop · Mixtape»
const rzDe = (m) => RZ.findIndex((n) => txt(m).includes('· ' + n + '\n'));
const gifs = new Set();
const nombreGif = (u) => (/\/drops\/gif\/v1\/([a-z0-9-]+)\.gif(\?|$)/.exec(String(u || '')) || [])[1] || '';
const NOMBRES = new Set();
for (const [anim, rs] of [['drop', [0, 1, 2, 3, 4]], ['star', [2, 3, 4]]]) {
  for (const r of rs) {
    for (const e of ['entra', 'nada', 'listo', 'abre']) NOMBRES.add(`${anim}-${e}-${r}`);
    if (r > rs[0]) NOMBRES.add(`${anim}-sube-${r}`);
  }
  for (const ts of Object.values(A.DROP_TITULOS)) for (const t of ts) {
    NOMBRES.add(`${anim}-titulo-${t.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`);
  }
}

// ── el recorrido entero, para muchos drops y stars ──────────────────────────────────────────────────────────────
async function recorrer(tipo, n) {
  const vistos = { rz: new Set(), titulos: 0 };
  for (let i = 0; i < n; i++) {
    const origen = (tipo === 'star' ? 'star:prueba:' : 'prueba:') + tipo + i;
    o.dropDar(QUIEN, origen, tipo === 'star' ? 2 : 0);
    const fila = sql.exec('SELECT id FROM drops WHERE quien = ? AND origen = ?', QUIEN, origen).toArray()[0];
    parches.length = 0;
    const r0 = await boton('dd:' + tipo + ':x:' + QUIEN);
    ok('«Abrir un ' + tipo + '» contesta enseguida (Discord corta a los 3 s)', r0 && [4, 5, 6].includes(r0.type), JSON.stringify(r0));
    const p0 = parches.at(-1);
    ok('y edita el mensaje con la primera pantalla (PATCH @original)', p0 && p0.metodo === 'PATCH' && /messages\/@original$/.test(p0.url), JSON.stringify(parches).slice(0, 300));
    if (!p0) continue;
    let pant = p0.cuerpo;
    const guardado = sql.exec('SELECT abierto, rareza, premio, min FROM drops WHERE id = ?', fila.id).toArray()[0];
    const fin = guardado.rareza;
    let prev = rzDe(pant);
    const urls = [gifDe(pant)];
    ok('ya está abierto en el objeto al mostrar la primera pantalla', guardado.abierto === 1);
    ok('la primera pantalla: el GIF de la llegada en la rareza de partida', nombreGif(gifDe(pant)) === `${tipo}-entra-${prev}`, gifDe(pant));
    ok('un Star arranca en Vinilo o más; un Drop en Maqueta', tipo === 'star' ? prev >= 2 : prev === 0, String(prev));
    gifs.add(gifDe(pant));
    for (let k = 1; k <= 4; k++) {
      const b = botones(pant)[0] || {};
      ok(`el botón ${k} es «Tap»`, b.label === 'Tap' && String(b.custom_id).length <= 100, JSON.stringify(b));
      const r = await boton(b.custom_id);
      ok(`el toque ${k} pisa el mismo mensaje al instante (tipo 7)`, r && r.type === 7 && r.data && gifDe(r.data), JSON.stringify(r).slice(0, 300));
      pant = r.data;
      const ahora = rzDe(pant);
      const g = nombreGif(gifDe(pant));
      gifs.add(gifDe(pant));
      urls.push(gifDe(pant));
      ok(`toque ${k}: la rareza nunca baja ni pasa lo que salió`, ahora >= prev && ahora <= fin, `${prev}→${ahora} (fin ${fin})`);
      ok(`toque ${k}: el GIF dice lo que pasó`, ahora > prev ? g === `${tipo}-sube-${ahora}` : (k === 4 ? g === `${tipo}-listo-${ahora}` : g === `${tipo}-nada-${ahora}`), `${g} ${prev}→${ahora}`);
      ok(`toque ${k}: los puntitos cuentan los toques`, (txt(pant).match(/●/g) || []).length === k, txt(pant));
      prev = ahora;
    }
    ok('cada pantalla con su dirección (un GIF que se ve una vez no se repite con la misma)', new Set(urls).size === urls.length, urls.join(' '));
    ok('después del cuarto toque está en lo que salió', prev === fin, `${prev} vs ${fin}`);
    const ba = botones(pant)[0] || {};
    ok('y el botón es «Abrir»', ba.label === 'Abrir' && /:5\./.test(ba.custom_id), JSON.stringify(ba));
    parches.length = 0;
    const ra = await boton(ba.custom_id);
    ok('«Abrir» contesta «ya va» sobre el mismo mensaje (tipo 6)', ra && ra.type === 6, JSON.stringify(ra));
    const pa = parches.at(-1);
    ok('y lo edita con el premio (PATCH @original)', pa && /messages\/@original$/.test(pa.url), JSON.stringify(parches).slice(0, 300));
    if (!pa) continue;
    const pr = JSON.parse(guardado.premio || '{}');
    const gA = nombreGif(gifDe(pa.cuerpo));
    gifs.add(gifDe(pa.cuerpo));
    ok('el GIF de la apertura es el de lo que salió (o el del título)', pr.titulo ? new RegExp(`^${tipo}-titulo-`).test(gA) : gA === `${tipo}-abre-${fin}`, gA + ' ' + JSON.stringify(pr));
    const tx = txt(pa.cuerpo);
    ok('el texto dice la rareza y el premio que se guardó', tx.includes(RZ[fin]) && (pr.titulo ? tx.includes('«' + pr.titulo + '»') : true)
      && (pr.puntos ? tx.includes(String(pr.puntos).replace(/\B(?=(\d{3})+(?!\d))/g, '.')) : true), tx + ' ' + JSON.stringify(pr));
    const pagos = sql.exec("SELECT COUNT(*) AS n FROM tienda WHERE quien = ? AND id = ?", QUIEN, 'drop:' + fila.id).toArray()[0].n;
    ok('se pagó una sola vez (aunque se pidió dos veces)', pr.puntos ? pagos === 1 : pagos === 0, `${pagos} pago(s) de ${pr.puntos}`);
    // y volver a tocar un botón viejo no paga ni cambia nada
    await boton(ba.custom_id);
    const pagos2 = sql.exec("SELECT COUNT(*) AS n FROM tienda WHERE quien = ? AND id = ?", QUIEN, 'drop:' + fila.id).toArray()[0].n;
    ok('tocar «Abrir» otra vez no vuelve a pagar', pagos2 === pagos);
    vistos.rz.add(fin);
    if (pr.titulo) vistos.titulos++;
  }
  return vistos;
}

const vD = await recorrer('drop', 60);
const vS = await recorrer('star', 30);
console.log('  rarezas vistas · Drop: ' + [...vD.rz].sort().map((r) => RZ[r]).join(', ') + ` (${vD.titulos} con título) · Star: ` + [...vS.rz].sort().map((r) => RZ[r]).join(', ') + ` (${vS.titulos} con título)`);

// ── cada nombre posible, por la regla: el Worker sólo pide los que existen ─────────────────────────────────────────
const W = await import('./worker.js');
const pedibles = new Set();
for (const anim of ['drop', 'star']) {
  const rs = anim === 'star' ? [2, 3, 4] : [0, 1, 2, 3, 4];
  for (const base of rs) for (const fin of rs) {
    if (fin < base) continue;
    for (let m = 0; m < 16; m++) {
      const plan = [0, 1, 2, 3].map((b) => (m >> b) & 1);
      if (plan.reduce((a, b) => a + b, 0) !== fin - base) continue;
      const e = { anim, id: 1, base, fin, plan };
      pedibles.add(nombreGif(gifDe(W.pantallaDrop(e, 0, W.gifDrop(anim, 'entra', base)))));
      for (let k = 1; k <= 4; k++) pedibles.add(nombreGif(gifDe(W.toqueDrop(Object.assign({}, e, { k })))));
    }
    pedibles.add(`${anim}-abre-${fin}`);
  }
  for (const [r, ts] of Object.entries(A.DROP_TITULOS)) if (Number(r) >= rs[0] && Number(r) <= 4) for (const t of ts) pedibles.add(nombreGif(W.gifDrop(anim, 'titulo', Number(r), t)));
}
const faltan = [...pedibles].filter((n) => !NOMBRES.has(n));
ok('cada GIF que el Worker puede pedir es uno de los que se graban', !faltan.length, faltan.join(', '));

if (process.argv.includes('--r2')) {
  Date.now = ahoraReal;
  const malos = [];
  for (const n of pedibles) {
    const u = W.gifDrop('drop', 'x', 0).replace(/drop-x-0\.gif$/, n + '.gif');
    const r = await fetchReal(u, { method: 'HEAD' }).catch((e) => ({ status: 'error ' + e.message, headers: new Map() }));
    if (r.status !== 200 || !/gif/.test(String(r.headers.get('content-type')))) malos.push(n + ' ' + r.status);
  }
  ok(`los ${pedibles.size} GIF que se pueden pedir están en R2`, !malos.length, malos.join(', '));
}

console.log(`\n${mal ? '🔴 ' + mal + ' mal' : '✅ todo bien'} (${bien} comprobaciones)`);
process.exit(mal ? 1 : 0);
