// 🖼️ LA PRUEBA DE /perfil Y /vitrina (20/11/2026, la tanda 2 de los comandos), sin Discord, sin Cloudflare y sin GitHub.
//
//   node bot/perfil_img_prueba.mjs
//
// Dos partes. La primera pasa los comandos y los botones por el Worker DE VERDAD (`worker.fetch`, firmado como Discord) con
// un objeto de mentira que contesta `p:` y anota lo que se le pide: la imagen que hay sale pública y en V2 con su fila;
// la que falta, «Armando…» y un pedido; la vieja, ya y un pedido; los botones cambian en el mismo mensaje; los topes.
// La segunda, sobre el objeto de verdad (`Avisos` con SQLite de Node, si este Node lo trae): la cola, el freno por persona e
// imagen, la tarea una vez, la imagen que llega y edita las respuestas, lo que falla, y lo que se le pasa al ciclo.
import { webcrypto } from 'node:crypto';
import * as A from './avisos.js';
import { textoV2 as TX, piezas as PZ, medir as MEDIR, V2, EFIMERO } from './vista.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const { default: worker } = await import('./worker.js');

let fallas = 0, bien = 0;
const ok = (c, t, extra) => {
  if (c) { bien += 1; console.log('  ✅ ' + t); } else { fallas += 1; console.log('  🔴 ' + t + (extra !== undefined ? '\n     ' + JSON.stringify(extra).slice(0, 600) : '')); }
};
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const par = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
const R2 = 'https://pub-70d5821d06a8432c9cffd0c102195000.r2.dev';
const S = { a: 'a1a1a1a1a1', b: 'b2b2b2b2b2', c: 'c3c3c3c3c3', d: 'd4d4d4d4d4' };
const LARGA = 'z'.repeat(60);                    // la clave más larga que vale (`claveValida()`): el custom_id tiene que entrar

// ── el objeto de mentira: las `p:` y lo que se le pide ──
const P = {
  makmah: { n: 'Makmah', sv: 'FFA', cc: 've', ev: 122, cs: ['temporada', 'competitivo', 'servidor', 'pais'], svs: ['FFA'], svc: ['FFA'],
    im: [S.a, S.a, S.b, S.c].join('.') },        // el perfil al día; la vitrina, vieja (la de hoy es b, la que hay c)
  nc: { n: 'NC', sv: 'FFA', cc: 'ar', ev: 62, cs: ['temporada', 'servidor'], svs: ['FFA'], svc: ['FFA'] },     // sin imagen
  sincarta: { n: 'Sin Carta', sv: 'FFA', cc: 'ar', ev: 1, cs: [], svs: [], svc: [], im: [S.d, S.d, S.d, S.d].join('.') },
  [LARGA]: { n: 'Largo', sv: 'FFA', cc: 'ar', ev: 3, cs: ['temporada'], svs: ['FFA'], svc: ['FFA'], im: [S.a, S.a, S.a, S.a].join('.') },
};
const KV = { 'd:111': 'makmah', 'd:222': 'nc', 'd:333': 'sincarta', 'd:444': LARGA,
  meta: JSON.stringify({ sello: '202611200400', svs: [], bot_en: ['DRA', 'FFA'], req: {} }) };
let PEDIDOS = [];
let SOLTADOS = [];
// el id de la interacción que creó el mensaje (`interaction_metadata.id`): es lo que ata una espera a su mensaje
const REF = '900000000000000001';
const nid = () => String(100000000000000000 + Math.floor(Math.random() * 8e17));
let CONTESTA = () => ({ cola: true });
const objeto = {
  async fetch(url, opc) {
    const u = new URL(String(url));
    if (u.pathname === '/persona') {
      const k = (u.searchParams.get('k') || '').replace(/^p:/, '');
      return P[k] ? new Response(JSON.stringify(P[k])) : new Response('', { status: 404 });
    }
    if (u.pathname === '/img-pedir') {
      const d = JSON.parse(opc.body);
      PEDIDOS.push(d);
      return new Response(JSON.stringify(CONTESTA(d)));
    }
    if (u.pathname === '/img-soltar') {
      SOLTADOS.push(JSON.parse(opc.body).ref);
      return new Response('{"ok":true}');
    }
    return new Response('{}');
  },
};
const env = {
  DISCORD_PUBLIC_KEY: hex(await crypto.subtle.exportKey('raw', par.publicKey)),
  KV: { get: async (k) => (k in KV ? KV[k] : null), put: async () => {}, delete: async () => {} },
  AVISOS: { idFromName: () => 'liga', get: () => objeto },
};
// lo que el Worker manda por su cuenta (las ediciones de la respuesta)
let SALIDAS = [];
const fetch0 = globalThis.fetch;
globalThis.fetch = async (url, opc) => {
  SALIDAS.push({ url: String(url), metodo: (opc && opc.method) || 'GET', cuerpo: opc && opc.body ? JSON.parse(opc.body) : null });
  return new Response('{}', { status: 200 });
};
let RELOJ = Date.parse('2026-11-20T18:00:00Z');
const ahora0 = Date.now;
Date.now = () => RELOJ;
const pendientes = [];
const ctx = { waitUntil: (p) => pendientes.push(p) };
const esperar = async () => { await Promise.all(pendientes.splice(0)); };

async function pedir(obj) {
  RELOJ += 60000;
  const cuerpo = JSON.stringify(obj);
  const ts = String(Math.floor(RELOJ / 1000));
  const sig = hex(await crypto.subtle.sign('Ed25519', par.privateKey, new TextEncoder().encode(ts + cuerpo)));
  const r = await worker.fetch(new Request('https://x/', { method: 'POST', headers: { 'x-signature-ed25519': sig, 'x-signature-timestamp': ts }, body: cuerpo }), env, ctx);
  await esperar();
  return JSON.parse(await r.text());
}
const G = '1468472442925092958';           // FFA
const comando = (nombre, yo, ops) => ({ type: 2, id: nid(), application_id: '1489029633960312923', token: 'tok-' + 'x'.repeat(30),
  guild_id: G, channel_id: '777', member: { user: { id: yo, username: 'u' + yo }, roles: [], permissions: '0' }, data: { name: nombre, options: ops || [] } });
const clic = (yo, cid, mensaje) => ({ type: 3, id: nid(), application_id: '1489029633960312923', token: 'tok-' + 'y'.repeat(30),
  guild_id: G, channel_id: '777', member: { user: { id: yo, username: 'u' + yo }, roles: [], permissions: '0' },
  message: Object.assign({ id: '1', timestamp: new Date(RELOJ - 60000).toISOString(), flags: V2, interaction_metadata: { id: REF } }, mensaje || {}),
  data: { custom_id: cid, component_type: 2 } });
const galeria = (m) => PZ(m, 12).map((g) => ((g.items || [])[0] || {}).media && g.items[0].media.url).filter(Boolean);
const botones = (m) => PZ(m, 2);
const filaPi = (m) => botones(m).filter((b) => String(b.custom_id || '').startsWith('pi:'));
const apagadoPi = (m) => filaPi(m).filter((b) => b.disabled);
const forma = (m) => MEDIR(m, { azules: Infinity });

console.log('\n🖼️ /perfil y /vitrina, por el Worker\n');
try {
  // 1 · la imagen que hay y es la de hoy: pública, V2, la galería y la fila; sin pedir nada
  PEDIDOS = []; SALIDAS = [];
  let r = await pedir(comando('perfil', '111'));
  let d = r.data || {};
  ok(r.type === 4 && (d.flags & V2) && !(d.flags & EFIMERO), '/perfil: pública y en V2', r);
  ok(galeria(d)[0] === R2 + '/perfil/makmah.webp?v=' + S.a, 'la imagen de R2 con su sello en la dirección (Discord guarda por dirección)', galeria(d));
  ok(!PZ(d, 17).length, 'sin recuadro: la imagen sola, como /card');
  const fp = filaPi(d);
  ok(fp.map((b) => b.label).join('·') === 'Perfil·Vitrina·Cartas' && apagadoPi(d).length === 1 && apagadoPi(d)[0].label === 'Perfil'
    && apagadoPi(d)[0].style === 2 && fp.filter((b) => !b.disabled).every((b) => b.style === 1),
    'la fila: Perfil gris y apagado (el que se ve), Vitrina y Cartas en azul', fp.map((b) => [b.label, b.style, !!b.disabled]));
  const lk = botones(d).find((b) => b.style === 5);
  ok(lk && lk.label === 'Abrir en la página' && lk.url === 'https://underlegends.pages.dev/freestyle-rap/r/makmah', '«Abrir en la página», al perfil', lk);
  ok(!forma(d).problemas.length, 'entra en los topes de Discord', forma(d));
  ok(!PEDIDOS.length && !SALIDAS.filter((x) => /webhooks/.test(x.url)).length, 'al día: no le pide nada al objeto ni edita nada', PEDIDOS);
  ok(fp.every((b) => b.custom_id === 'pi:' + b.custom_id[3] + ':makmah:111'), 'los botones son de quien lo pidió (`pi:<letra>:<clave>:<id>`)', fp.map((b) => b.custom_id));

  // 2 · la vitrina vieja: la que hay YA, y la nueva pedida (sin «Armando»); si el kit ya la tenía, se pone enseguida
  PEDIDOS = []; SALIDAS = [];
  CONTESTA = () => ({ listo: S.b });
  r = await pedir(comando('vitrina', '111'));
  d = r.data || {};
  ok(galeria(d)[0] === R2 + '/vitrina/makmah.webp?v=' + S.c, 'vieja: contesta ya con la que hay', galeria(d));
  ok(PEDIDOS.length === 1 && PEDIDOS[0].a === S.b && PEDIDOS[0].tipo === 'vitrina' && PEDIDOS[0].armando === false && PEDIDOS[0].k === 'makmah'
    && /^tok-/.test(PEDIDOS[0].token), 'y le pide la de hoy al objeto, una vez, con el permiso para editar', PEDIDOS);
  const ed = SALIDAS.filter((x) => /webhooks\/.*\/messages\/@original/.test(x.url) && x.metodo === 'PATCH');
  ok(ed.length === 1 && galeria(ed[0].cuerpo)[0] === R2 + '/vitrina/makmah.webp?v=' + S.b && apagadoPi(ed[0].cuerpo)[0].label === 'Vitrina',
    'la que armó el kit ya era la de hoy: la respuesta se edita con ella', ed.map((x) => galeria(x.cuerpo)));

  // 3 · sin imagen: «Armando…» y un pedido; si queda en la cola, no se edita (la edita el objeto cuando llegue)
  PEDIDOS = []; SALIDAS = [];
  CONTESTA = () => ({ cola: true });
  r = await pedir(comando('perfil', '222'));
  d = r.data || {};
  ok(!galeria(d).length && /Armando el perfil de \*\*NC\*\*/.test(TX(d)) && !(d.flags & EFIMERO), 'sin imagen: «Armando el perfil de NC…», público (es el que se va a editar)', TX(d));
  ok(apagadoPi(d).length === 1 && apagadoPi(d)[0].label === 'Perfil' && !forma(d).problemas.length, 'con su fila y en los topes', forma(d));
  ok(PEDIDOS.length === 1 && PEDIDOS[0].armando === true && PEDIDOS[0].a === '' && PEDIDOS[0].n === 'NC', 'y el pedido, una vez', PEDIDOS);
  ok(!SALIDAS.filter((x) => /webhooks/.test(x.url)).length, 'en la cola: la respuesta no se toca (la edita el objeto)');

  // 3b · el freno: lo dice en la misma respuesta
  for (const [res, txt] of [[{ limite: true }, /muchas veces hoy/], [{ espera: 300000 }, /se está armando/], [{ lleno: true }, /muchas imágenes en camino/], [{ muchas: true }, /varias imágenes en camino/], [{ error: 'x' }, /no puedo armarla/]]) {
    PEDIDOS = []; SALIDAS = [];
    CONTESTA = () => res;
    await pedir(comando('vitrina', '222'));
    const e2 = SALIDAS.filter((x) => /webhooks\/.*@original/.test(x.url));
    ok(PEDIDOS.length === 1 && e2.length === 1 && txt.test(TX(e2[0].cuerpo)) && filaPi(e2[0].cuerpo).length >= 2,
      'sin imagen y con freno (' + Object.keys(res)[0] + '): la respuesta lo dice, con su fila', e2.map((x) => TX(x.cuerpo)));
  }
  CONTESTA = () => ({ cola: true });

  // 4 · los botones: Vitrina, Cartas (lo de /card con la fila debajo), una carta, y Perfil otra vez — todo en el mismo mensaje
  PEDIDOS = []; SALIDAS = []; SOLTADOS = [];
  const cmd0 = comando('perfil', '111');
  let m0 = (await pedir(cmd0)).data;
  r = await pedir(clic('111', 'pi:v:makmah:111', m0));
  ok(r.type === 7 && galeria(r.data)[0] === R2 + '/vitrina/makmah.webp?v=' + S.c && apagadoPi(r.data)[0].label === 'Vitrina',
    'Vitrina: cambia en el mismo mensaje (tipo 7), Vitrina apagado', [r.type, galeria(r.data)]);
  // (revisión del 20/11) la espera es de ESE mensaje: la del clic lleva el id de la interacción que lo creó
  ok(PEDIDOS.length === 1 && PEDIDOS[0].ref === REF, 'el pedido de un clic va atado a su mensaje (`ref`)', PEDIDOS.map((x) => x.ref));
  r = await pedir(clic('111', 'pi:c:makmah:111', r.data));
  ok(SOLTADOS.length === 1 && SOLTADOS[0] === REF, 'Cartas suelta lo que el mensaje esperaba: la vitrina que llegue no la pisa', SOLTADOS);
  const cartas = r.data;
  const cBot = botones(cartas).filter((b) => String(b.custom_id || '').startsWith('c:'));
  ok(r.type === 7 && cBot.length >= 2 && apagadoPi(cartas)[0].label === 'Cartas' && /\/makmah\/competitivo\.webp/.test(galeria(cartas)[0] || ''),
    'Cartas: lo de /card (abre en la Competitiva) con la fila de /perfil debajo, Cartas apagado', [galeria(cartas), apagadoPi(cartas).map((b) => b.label)]);
  ok(!forma(cartas).problemas.length && forma(cartas).idMax <= 100, 'las cartas con la fila entran en los topes', forma(cartas));
  r = await pedir(clic('111', 'c:makmah:temporada:111', cartas));
  ok(r.type === 7 && /\/makmah\/temporada\.webp/.test(galeria(r.data)[0] || '') && apagadoPi(r.data).length === 1 && apagadoPi(r.data)[0].label === 'Cartas',
    'una carta desde ahí: la fila de /perfil se queda para volver', [galeria(r.data), apagadoPi(r.data).map((b) => b.label)]);
  r = await pedir(clic('111', 'pi:p:makmah:111', r.data));
  ok(r.type === 7 && galeria(r.data)[0] === R2 + '/perfil/makmah.webp?v=' + S.a && apagadoPi(r.data)[0].label === 'Perfil', 'y Perfil, de vuelta', galeria(r.data));
  ok(SOLTADOS.length === 2 && SOLTADOS[1] === REF, 'un Perfil que ya está al día también suelta la espera', SOLTADOS);
  // un comando nuevo no suelta nada (no tiene mensaje de antes) y su pedido va con el id de su interacción
  PEDIDOS = []; SOLTADOS = [];
  const cmd1 = comando('perfil', '222');
  await pedir(cmd1);
  ok(!SOLTADOS.length && PEDIDOS.length === 1 && PEDIDOS[0].ref === cmd1.id, 'el «Armando…» de un comando queda atado a ese comando', PEDIDOS.map((x) => x.ref));
  // y una /card de siempre no gana la fila
  r = await pedir(comando('card', '111'));
  const rc = await pedir(clic('111', 'c:makmah:temporada:111', r.data));
  ok(!filaPi(rc.data).length, 'una /card de siempre sigue sin la fila de /perfil', filaPi(rc.data));

  // 5 · de otra persona: no
  r = await pedir(clic('999', 'pi:v:makmah:111', m0));
  ok(r.type === 4 && (r.data.flags & EFIMERO) && /la pidió otra persona/.test(TX(r.data)), 'los botones de otro: un aviso que ve sólo él', TX(r.data));

  // 6 · sin datos: lo dice claro
  r = await pedir(comando('perfil', '555'));
  ok(r.type === 4 && (r.data.flags & EFIMERO) && /todavía no estás en la Liga del bot/i.test(TX(r.data)), 'quien no está en la Liga: qué le falta', TX(r.data));
  r = await pedir(comando('vitrina', '111', [{ name: 'nombre', type: 3, value: 'Nadie Así' }]));
  ok(r.type === 4 && (r.data.flags & EFIMERO) && /No encuentro a \*\*Nadie Así\*\*/.test(TX(r.data)), 'un nombre que no existe: lo dice', TX(r.data));
  r = await pedir(comando('perfil', '111', [{ name: 'quien', type: 6, value: '888' }]));
  ok(r.type === 4 && /<@888> todavía no está en la Liga/.test(TX(r.data)), 'a alguien sin datos: lo dice', TX(r.data));
  r = await pedir(comando('perfil', '111', [{ name: 'nombre', type: 3, value: 'NC' }]));
  ok(r.type === 4 && /Armando el perfil de \*\*NC\*\*/.test(TX(r.data)) && filaPi(r.data)[0].custom_id.endsWith(':111'),
    'por nombre: el de esa persona, con los botones de quien lo pidió', filaPi(r.data).map((b) => b.custom_id));
  r = await pedir(comando('perfil', '333'));
  ok(filaPi(r.data).map((b) => b.label).join('·') === 'Perfil·Vitrina', 'sin cartas: no hay botón «Cartas» (sin dato no hay pieza)', filaPi(r.data).map((b) => b.label));

  // 7 · los topes con la clave más larga
  r = await pedir(comando('perfil', '444'));
  ok(forma(r.data).idMax <= 100 && !forma(r.data).problemas.length && filaPi(r.data).every((b) => b.custom_id.length <= 100),
    'con una clave de 60 letras el custom_id entra en 100', forma(r.data));

  // 8 · vencida (10 minutos quieta): la misma vista, apagada
  const viejo = Object.assign({}, m0, { timestamp: new Date(RELOJ - 30 * 60000).toISOString() });
  RELOJ += 0;
  r = await pedir(Object.assign(clic('111', 'pi:v:makmah:111', viejo), { message: Object.assign({ id: '1', flags: V2, timestamp: new Date(RELOJ - 30 * 60000).toISOString() }, m0) }));
  ok(r.type === 7 && filaPi(r.data).every((b) => b.disabled) && galeria(r.data)[0] === R2 + '/perfil/makmah.webp?v=' + S.a,
    'quieta hace rato: la misma imagen con los botones apagados', [r.type, filaPi(r.data).map((b) => !!b.disabled)]);

  // 9 · /help los muestra
  r = await pedir(comando('help', '111'));
  const opciones = PZ(r.data, 3).flatMap((x) => x.options || []).map((o) => o.value);
  ok(opciones.includes('perfil') && opciones.includes('vitrina') && opciones.length <= 25 && /`\/perfil`/.test(TX(r.data)), '/help: están en el índice y en el menú', opciones);
  r = await pedir(Object.assign(clic('111', 'hp:ver', r.data), { data: { custom_id: 'hp:ver', component_type: 3, values: ['vitrina'] } }));
  ok(/\/vitrina/.test(TX(r.data)) && /trofeos/.test(TX(r.data)), '/help: la página de /vitrina', TX(r.data).slice(0, 120));
} catch (e) {
  fallas += 1;
  console.log('  🔴 se cayó: ' + (e && e.stack || e));
}

// ── la segunda parte: el objeto de verdad ──
let DatabaseSync = null;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { DatabaseSync = null; }
if (!DatabaseSync) {
  console.log('\n  ⓘ sin node:sqlite (Node ' + process.version + '): el objeto no se prueba acá');
} else {
  console.log('\n🖼️ /perfil y /vitrina, en el objeto\n');
  // un objeto de verdad sobre su propia base en memoria
  const nuevoObjeto = () => {
    const db0 = new DatabaseSync(':memory:');
    const sql0 = {
      exec(q, ...ps) {
        const t = String(q).trim();
        if (!ps.length && /;\s*\S/.test(t)) { db0.exec(t); return { toArray: () => [], rowsWritten: 0 }; }
        const st = db0.prepare(t);
        if (/^\s*(SELECT|WITH|PRAGMA)/i.test(t)) { const rows = st.all(...ps); return { toArray: () => rows, rowsWritten: 0 }; }
        const r0 = st.run(...ps);
        return { toArray: () => [], rowsWritten: Number(r0.changes) };
      },
    };
    const o0 = new A.Avisos({ storage: { sql: sql0, setAlarm() {}, getAlarm() { return null; } }, blockConcurrencyWhile: async (f) => f() },
      { KV: { get: async () => null, put: async () => {}, delete: async () => {} }, GH_TOKEN: 'gh-de-mentira', GH_REPO: 'liga/prueba' });
    return { o: o0, sql: sql0, db: db0 };
  };
  const { o, sql, db } = nuevoObjeto();
  await new Promise((res) => setTimeout(res, 5));
  try {
    const t0 = Date.parse('2026-11-20T18:00:00Z');
    const pide = (k, tipo, extra) => Object.assign({ k, tipo, a: '', token: 'tok-' + 'q'.repeat(30), app: '1489029633960312923', dueno: '111111111111111111', n: k, cartas: true, armando: true }, extra || {});
    SALIDAS = [];
    let x = await o.imgPedir(pide('makmah', 'perfil'), t0);
    const disp = () => SALIDAS.filter((s) => /actions\/workflows\/kit\.yml\/dispatches/.test(s.url));
    ok(x.cola && disp().length === 1 && disp()[0].cuerpo.inputs.tipo === 'img' && disp()[0].cuerpo.inputs.sv === 'UL',
      'el primer pedido: a la cola y la tarea del kit, una vez (tipo img, «UL»)', [x, disp().map((s) => s.cuerpo)]);
    x = await o.imgPedir(pide('makmah', 'perfil', { token: 'tok-' + 'w'.repeat(30) }), t0 + 5000);
    ok(x.cola && disp().length === 1, 'el mismo otra vez mientras espera: se suma el mensaje, no otra tarea', [x, disp().length]);
    x = await o.imgPedir(pide('nc', 'vitrina'), t0 + 10000);
    ok(x.cola && disp().length === 1, 'otra persona dentro de los 75 s: a la cola, la tarea ya va (se lleva toda la cola)', disp().length);
    await o.imgDespachar(t0 + 10000 + A.IMG_ENTRE);
    ok(disp().length === 2, 'el vigía, pasados los 75 s y con cola: prende otra', disp().length);
    const cola = o.imgCola(t0 + 20000);
    ok(cola.img.length === 2 && cola.img.some((y) => y.k === 'makmah' && y.tipo === 'perfil') && cola.img.some((y) => y.k === 'nc' && y.tipo === 'vitrina')
      && !o.imgCola(t0 + 21000).img.length, 'la tarea se lleva la cola (y pasa a «dibujando»: la siguiente no la repite)', cola);
    SALIDAS = [];
    x = await o.imgListo({ hechas: [{ k: 'makmah', tipo: 'perfil', sello: S.a }], fallas: [{ k: 'nc', tipo: 'vitrina' }] }, t0 + 60000);
    const eds = SALIDAS.filter((s) => /webhooks\/1489029633960312923\/tok-.*\/messages\/@original/.test(s.url) && s.metodo === 'PATCH');
    const conImg = eds.filter((s) => galeria(s.cuerpo)[0] === R2 + '/perfil/makmah.webp?v=' + S.a);
    ok(x.ok && x.n === 1 && conImg.length === 2 && conImg.every((s) => apagadoPi(s.cuerpo)[0].label === 'Perfil' && filaPi(s.cuerpo)[0].custom_id === 'pi:p:makmah:111111111111111111'),
      'llegó: las dos respuestas que la esperaban se editan con la imagen y su fila', [x, eds.map((s) => [galeria(s.cuerpo), filaPi(s.cuerpo).map((b) => [b.custom_id, b.disabled])])]);
    const malo = eds.filter((s) => /No pude armar la vitrina de \*\*nc\*\*/.test(TX(s.cuerpo)));
    ok(malo.length === 1, 'la que falló: su «Armando…» lo dice', eds.map((s) => TX(s.cuerpo)));
    ok(!(await o.imgListo({ hechas: [{ k: 'makmah', tipo: 'perfil', sello: S.a }] }, t0 + 61000)).editadas, 'ya editadas: no se editan dos veces');
    x = await o.imgPedir(pide('makmah', 'perfil', { a: S.a }), t0 + 70000);
    ok(x.listo === S.a, 'la que armó el kit es la de hoy: el Worker la pone sin pedir otra', x);
    x = await o.imgPedir(pide('makmah', 'perfil', { a: S.b }), t0 + 80000);
    ok(x.espera > 0, 'cambió otra vez a los pocos minutos: el freno (una cada 10 minutos)', x);
    x = await o.imgPedir(pide('nc', 'vitrina', { a: S.b }), t0 + 90000);
    ok(x.espera > 0, 'la que falló tampoco se repite enseguida', x);
    // seis por día por persona e imagen
    let t = t0 + 60 * 60000, ult = null;
    for (let i = 0; i < 6; i++) {
      t += A.IMG_ESPERA + 1000;
      ult = await o.imgPedir(pide('otro', 'perfil', { a: 'e' + String(i).repeat(9) }), t);
      if (ult.cola) o.imgCola(t + 1); // la tarea se la lleva
      if (ult.cola) await o.imgListo({ hechas: [{ k: 'otro', tipo: 'perfil', sello: 'e' + String(i).repeat(9) }] }, t + 2);
    }
    t += A.IMG_ESPERA + 1000;
    ult = await o.imgPedir(pide('otro', 'perfil', { a: 'f' + '0'.repeat(9) }), t);
    ok(ult.limite === true, 'seis por día por persona e imagen: la séptima, no', ult);
    // el tope de la cola
    const t2 = t0 + 2 * 86400000;
    // (de gente distinta: una sola persona tiene su propio tope, `IMG_POR_PERSONA`)
    for (let i = 0; i < A.IMG_COLA_MAX; i++) await o.imgPedir(pide('p' + i, 'vitrina', { dueno: '20000000000000' + String(i).padStart(4, '0') }), t2 + i);
    x = await o.imgPedir(pide('uno-mas', 'vitrina'), t2 + 100);
    ok(x.lleno === true, 'con ' + A.IMG_COLA_MAX + ' esperando, la cola no crece', x);
    // lo que se le pasa al ciclo
    const h = o.imgHechas();
    ok(h.hechas.some((y) => y[0] === 'p' && y[1] === 'makmah' && y[2] === S.a && /^\d{4}-\d{2}-\d{2}$/.test(y[3])), 'el ciclo sabe lo que armó el kit (`img-hechas`)', h.hechas.slice(0, 3));
    // lo raro, no
    ok((await o.imgPedir({ k: 'Con Espacio', tipo: 'perfil' })).error === 'datos' && (await o.imgPedir({ k: 'ana', tipo: 'otra' })).error === 'datos',
      'una clave o un tipo raros: no');
    const antes = SALIDAS.length;
    x = await o.imgListo({ hechas: [{ k: 'makmah', tipo: 'perfil', sello: 'https://otro.sitio/x.png' }] }, t2 + 200);
    ok(x.n === 0 && SALIDAS.length === antes, 'de la tarea llega sólo un sello: una dirección no entra (la arma el objeto)', x);
    // la tarea que se cayó: vuelve a la cola a los 4 minutos
    const t3 = t2 + 1000;
    o.imgCola(t3);
    await o.imgDespachar(t3 + 5 * 60000);
    ok(Number(sql.exec("SELECT COUNT(*) AS n FROM img_cola WHERE estado = 'espera'").toArray()[0].n) > 0, 'una tarea que se cayó: lo suyo vuelve a la cola a los 4 minutos');

    // ── 🔁 la revisión del 20/11/2026, sobre un objeto nuevo ──
    console.log('\n🔁 la revisión\n');
    // ⚡ 2 · el índice, y el vigía barato cuando no hay nada
    const idx = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'img_cola'").all().map((y) => y.name);
    const plan = db.prepare("EXPLAIN QUERY PLAN SELECT 1 FROM img_cola WHERE estado IN ('espera', 'dibujando') LIMIT 1").all().map((y) => y.detail).join(' | ');
    const plan2 = db.prepare("EXPLAIN QUERY PLAN SELECT por FROM img_cola WHERE estado IN ('espera', 'dibujando')").all().map((y) => y.detail).join(' | ');
    ok(idx.includes('img_cola_estado') && /img_cola_estado/.test(plan) && /img_cola_estado/.test(plan2),
      'img_cola tiene índice por estado: el «¿hay algo?» del vigía y la cuenta de lo pendiente lo usan', [idx, plan, plan2]);
    const { o: q, sql: sq } = nuevoObjeto();
    await new Promise((res) => setTimeout(res, 5));
    const T = Date.parse('2026-11-21T18:00:00Z');
    // (como texto: 3e17 + n pierde el n, pasa la precisión de un número de JS)
    const yo = (n) => '30000000000000' + String(n).padStart(4, '0');
    const R = (n) => '91000000000000' + String(n).padStart(4, '0');
    SALIDAS = [];
    await q.imgDespachar(T);
    ok(!SALIDAS.length, 'sin nada esperando, el vigía no pide nada afuera');
    // 7 · tope por quien pide
    let y1 = [];
    for (const k of ['a1', 'a2', 'a3', 'a4']) y1.push(await q.imgPedir(pide(k, 'perfil', { dueno: yo(1), ref: R(1) }), T + 1000));
    const y2 = await q.imgPedir(pide('a4', 'perfil', { dueno: yo(2) }), T + 2000);
    ok(y1.slice(0, 3).every((y) => y.cola) && y1[3].muchas === true && y2.cola,
      'una persona puede tener ' + A.IMG_POR_PERSONA + ' pendientes: la cuarta, «muchas»; otra persona, sí', [y1, y2]);
    // 4 · un clic de vista suelta la espera de su mensaje
    await q.imgPedir(pide('b1', 'perfil', { dueno: yo(3), ref: R(3) }), T + 3000);
    ok(q.imgSoltar({ ref: R(3) }).n === 1, 'soltar: la espera de ese mensaje se va');
    await q.imgPedir(pide('b2', 'perfil', { dueno: yo(4), ref: R(4) }), T + 3000);
    await q.imgPedir(pide('b2', 'vitrina', { dueno: yo(4), ref: R(4) }), T + 3500);
    const delR4 = sq.exec('SELECT tipo FROM img_msj WHERE ref = ?', R(4)).toArray().map((y) => y.tipo);
    ok(JSON.stringify(delR4) === '["v"]', 'el mismo mensaje pide otra vista: espera sólo la nueva', delR4);
    q.imgCola(T + 4000);
    SALIDAS = [];
    let z = await q.imgListo({ hechas: [{ k: 'b1', tipo: 'perfil', sello: S.a }, { k: 'b2', tipo: 'perfil', sello: S.a }] }, T + 60000);
    ok(z.n === 2 && z.editadas === 0 && !SALIDAS.length, 'llegan las dos: ninguna pisa un mensaje que cambió de vista', [z, SALIDAS.length]);
    // 6 · todo «Armando…» termina a tiempo
    await q.imgPedir(pide('c1', 'perfil', { dueno: yo(5), ref: R(5), n: 'Ce' }), T + 5000);
    SALIDAS = [];
    await q.imgDespachar(T + 5000 + A.IMG_PLAZO - 60000);
    const antesPlazo = SALIDAS.filter((s) => /webhooks/.test(s.url)).length;
    await q.imgDespachar(T + 5000 + A.IMG_PLAZO + 1000);
    const np = SALIDAS.filter((s) => /webhooks/.test(s.url) && /No pude armar el perfil de \*\*Ce\*\*/.test(TX(s.cuerpo)));
    ok(!antesPlazo && np.length === 1 && A.IMG_PLAZO < A.IMG_TOKEN && !sq.exec("SELECT 1 FROM img_msj WHERE k = 'c1'").toArray().length,
      'un «Armando…» sin imagen a los ' + A.IMG_PLAZO / 60000 + ' min: «no pude», antes de que venza el permiso (' + A.IMG_TOKEN / 60000 + ')', [antesPlazo, np.length]);
    const seis = [];
    for (let i = 0; i < 6; i++) seis.push(await q.imgPedir(pide('d1', 'vitrina', { dueno: yo(6), ref: R(60 + i) }), T + 6000 + i));
    ok(seis.slice(0, 5).every((y) => y.cola) && seis[5].espera > 0,
      'el sexto «Armando…» de la misma imagen no queda colgado: se le contesta ya', seis);
    // 8 · el tope de pedidos salientes por llamada
    const { o: w, sql: sw } = nuevoObjeto();
    await new Promise((res) => setTimeout(res, 5));
    for (let j = 0; j < 12; j++) {
      for (let m = 0; m < 5; m++) await w.imgPedir(pide('e' + j, 'perfil', { dueno: yo(100 + j), ref: R(100 + j * 10 + m) }), T + j * 10 + m);
    }
    w.imgCola(T + 1000);
    w.imgCola(T + 1001);
    SALIDAS = [];
    z = await w.imgListo({ hechas: Array.from({ length: 12 }, (_, j) => ({ k: 'e' + j, tipo: 'perfil', sello: S.a })) }, T + 60000);
    const v1 = SALIDAS.length;
    SALIDAS = [];
    await w.imgDespachar(T + 120000);
    const v2 = SALIDAS.length;
    SALIDAS = [];
    await w.imgDespachar(T + 180000);
    const v3 = SALIDAS.length;
    const quedan = Number(sw.exec('SELECT COUNT(*) AS n FROM img_msj').toArray()[0].n);
    ok(z.n === 12 && v1 <= A.IMG_EDICIONES && v2 <= A.IMG_EDICIONES + 1 && v1 + v2 + v3 === 60 && !quedan,
      '60 respuestas esperando: de a ' + A.IMG_EDICIONES + ' por llamada como mucho, y el vigía entrega el resto (' + [v1, v2, v3].join(' + ') + ')', [v1, v2, v3, quedan]);
    // 5 · quien pidió que lo olviden
    const { o: u, sql: su } = nuevoObjeto();
    await new Promise((res) => setTimeout(res, 5));
    await u.imgPedir(pide('zeta', 'perfil', { dueno: yo(7), ref: R(7) }), T);
    await u.imgPedir(pide('omega', 'vitrina', { dueno: yo(8), ref: R(8) }), T);
    const tomadas = u.imgCola(T + 1000).img.map((y) => y.k);
    await u.olvidar({ quien: yo(70), clave: 'zeta' });
    SALIDAS = [];
    z = await u.imgListo({ hechas: [{ k: 'zeta', tipo: 'perfil', sello: S.a }, { k: 'omega', tipo: 'vitrina', sello: S.b }] }, T + 60000);
    ok(tomadas.includes('zeta') && JSON.stringify(z.borrar) === '["perfil/zeta.webp"]' && z.n === 1
      && !su.exec("SELECT 1 FROM img_cola WHERE k = 'zeta'").toArray().length && !su.exec("SELECT 1 FROM img_msj WHERE k = 'zeta'").toArray().length,
      'pidió que lo olviden mientras se dibujaba: no se anota y la tarea la borra de R2', z);
    ok((await u.imgPedir(pide('zeta', 'perfil', { dueno: yo(9) }), T + 70000)).error === 'olvido' && !u.imgHechas().hechas.some((y) => y[1] === 'zeta'),
      'y no vuelve a la cola ni a lo que se le pasa al ciclo');
    await u.imgPedir(pide('omega', 'perfil', { dueno: yo(10) }), T + 80000);
    await u.olvidar({ quien: yo(71), clave: 'omega' });
    ok(!u.imgCola(T + 90000).img.length, 'olvidado con algo en la cola: la cola no lo entrega');
  } catch (e) {
    fallas += 1;
    console.log('  🔴 se cayó: ' + (e && e.stack || e));
  }
}

Date.now = ahora0;
globalThis.fetch = fetch0;
console.log('\n' + (fallas ? '🔴 ' + fallas + ' falla(s), ' + bien + ' bien' : '✅ /perfil y /vitrina: ' + bien + ' de ' + bien) + '\n');
process.exit(fallas ? 1 : 0);
