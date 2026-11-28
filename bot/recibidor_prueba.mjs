// 🚪 La prueba del recibidor de DRA (28/11/2026), sin Discord, sin Cloudflare y sin red: el prefiltro (el del Worker y la
// copia del grabador, iguales), el clasificador sobre los ejemplos y sobre preguntas que no están en la tabla, la etiqueta
// de la IA, los mensajes (la respuesta fija, el aviso y el aviso ya recibido), la parte del grabador con un Discord y un
// Worker de mentira, y sobre el objeto de verdad (SQLite de Node): los frenos, el tope de la IA, el primero que toca
// gana, y el Pase Premium a los 3 que jugaron, una sola vez.
//
//     node bot/recibidor_prueba.mjs
import * as RC from './recibidor.js';
import * as G from '../grabador/recibidor.js';

let fallas = 0, bien = 0;
const ok = (c, t, extra) => {
  if (c) bien += 1;
  else { fallas += 1; console.log('  🔴 ' + t + (extra !== undefined ? '\n     ' + extra : '')); }
};
const H = 3600000, DIA = 24 * H;
const relojReal = Date.now;
let AHORA = Date.UTC(2026, 10, 28, 18, 0);
Date.now = () => AHORA;
const fetchReal = globalThis.fetch;

// ── 1. el prefiltro ─────────────────────────────────────────────────────────────────────────────────────────────────
const PREGUNTAS = Object.entries(RC.EJEMPLOS).filter(([et]) => et !== 'nada').flatMap(([, l]) => l);
// preguntas de verdad que NO están en la tabla: con faltas, sin tildes, con jerga
const FUERA = [
  ['hola buenas, ¿cómo me inscribo?', 'inscribirse'], ['komo ago para entrar al torneo?', 'inscribirse'],
  ['donde me puedo anotar pa las batallas', 'inscribirse'], ['bro como me inscrivo al evento de hoy?', 'inscribirse'],
  ['alguien sabe como se participa', 'inscribirse'], ['cómo me registro para competir?', 'inscribirse'],
  ['ola q tal, como entro a jugar?', 'inscribirse'], ['wey como participo en la liga', 'inscribirse'],
  ['¿cuándo hay evento?', 'cuando'], ['a q hora es la batalla de hoy', 'cuando'], ['hoy hay evento??', 'cuando'],
  ['kuando es el proximo evento', 'cuando'],
  ['soy nuevo, como juego?', 'primer_evento'], ['buenas soy nueva aca, como empiezo?', 'primer_evento'],
  ['nunca he jugado un evento como hago', 'primer_evento'],
  ['como me verifico en el server?', 'verificarse'], ['no puedo verificarme ayuda', 'verificarse'],
  ['como saco mi tarjeta?', 'tarjeta'], ['como consigo mi carta', 'tarjeta'],
  ['que es la liga global?', 'como_funciona'], ['como funciona la liga?', 'como_funciona'],
];
const NO_PASAN = ['jajaja', 'buenas noches gente', 'qué tal el clima', 'gg', 'alguien vio el partido?', 'hola a todos 👋',
  'xd', 'que buen beat', 'la llamada está buenísima', 'x'.repeat(301) + ' como me inscribo'];
ok(PREGUNTAS.every((t) => RC.prefiltro(t)), 'el prefiltro deja pasar todos los ejemplos de la tabla',
  PREGUNTAS.filter((t) => !RC.prefiltro(t)).join(' · '));
ok(FUERA.every(([t]) => RC.prefiltro(t)), 'y las preguntas de verdad que no están en la tabla (con faltas y jerga)',
  FUERA.filter(([t]) => !RC.prefiltro(t)).map((x) => x[0]).join(' · '));
ok(NO_PASAN.every((t) => !RC.prefiltro(t)), 'la charla no pasa (ni un mensaje de más de 300 letras)',
  NO_PASAN.filter((t) => RC.prefiltro(t)).join(' · '));
const TODOS = PREGUNTAS.concat(FUERA.map((x) => x[0]), NO_PASAN, RC.EJEMPLOS.nada);
ok(TODOS.every((t) => RC.prefiltro(t) === G.prefiltro(t)) && String(RC.TEMA) === String(G.TEMA) && String(RC.PREGUNTA) === String(G.PREGUNTA),
  'el prefiltro del grabador es el mismo que el del Worker (las dos copias)');

// ── 2. el clasificador ──────────────────────────────────────────────────────────────────────────────────────────────
const mal = [];
for (const [et, l] of Object.entries(RC.EJEMPLOS)) for (const t of l) { const c = RC.clasificar(t); if (c.etiqueta !== et) mal.push(t + ' → ' + c.etiqueta); }
ok(!mal.length, 'cada ejemplo de la tabla sale con su etiqueta', mal.join(' · '));
const n = Object.values(RC.EJEMPLOS).reduce((a, l) => a + l.length, 0);
ok(n >= 80, 'la tabla tiene ' + n + ' ejemplos (al menos 80)');
const malF = FUERA.filter(([t, et]) => { const c = RC.clasificar(t); return c.etiqueta !== et; });
ok(!malF.length, 'las preguntas de afuera de la tabla salen con su etiqueta (' + FUERA.length + ')',
  malF.map(([t, et]) => t + ' → ' + RC.clasificar(t).etiqueta + ' (era ' + et + ')').join(' · '));
const seguras = FUERA.filter(([t]) => RC.clasificar(t).seguro).length;
ok(seguras >= FUERA.length * 0.7, `y sin IA: ${seguras} de ${FUERA.length} salen «seguras» (no gastan la IA)`);
ok(RC.clasificar('alguien juega free fire?').etiqueta === 'nada' && RC.clasificar('alguien juega free fire?').seguro,
  'otro juego: «nada», seguro (no se le pregunta a la IA)');
ok(!RC.clasificar('quiero jugar').seguro, '«quiero jugar» sola queda en duda: la decide la IA');
ok(RC.sonido('inscrivo') === RC.sonido('inscribo') && [...RC.palabras('Cómo me INSCRIVO???')].join() === [...RC.palabras('como me inscribo')].join(),
  'las faltas no cambian nada: inscrivo = inscribo, tildes y mayúsculas tampoco');

// ── 3. la etiqueta de la IA ─────────────────────────────────────────────────────────────────────────────────────────
ok(RC.validar('inscribirse') === 'inscribirse' && RC.validar(' Cuando.') === 'cuando' && RC.validar('Etiqueta: tarjeta') === 'tarjeta'
  && RC.validar('"primer_evento"') === 'primer_evento' && RC.validar('COMO_FUNCIONA') === 'como_funciona',
  'lo que dice la IA se lee aunque traiga mayúsculas, un punto, comillas o «Etiqueta:»');
ok(RC.validar('¡Hola! Para inscribirte...') === 'nada' && RC.validar('') === 'nada' && RC.validar('inscribirse_ya') === 'nada'
  && RC.validar(null) === 'nada' && RC.validar('borrar todo') === 'nada', 'lo que no es una etiqueta de la lista: nada');
ok(Object.keys(RC.RESPUESTAS).every((k) => RC.ETIQUETAS.includes(k) || Object.values(RC.DUDAS).includes(k))
  && RC.ETIQUETAS.filter((k) => k !== 'nada').every((k) => RC.RESPUESTAS[k]) && Object.values(RC.DUDAS).every((k) => RC.RESPUESTAS[k]),
  'cada etiqueta (menos «nada») y cada opción del «¿Tienes una duda?» de la bienvenida tiene su respuesta fija, y ninguna sobra');
{
  const llamadas = [];
  const env = { AI: { run: async (m, x) => { llamadas.push([m, x]); return { response: ' tarjeta.' }; } } };
  const et = await RC.preguntarIA(env, 'como hago lo de la carta esa');
  const x = llamadas[0] && llamadas[0][1];
  ok(et === 'tarjeta' && llamadas[0][0] === RC.IA_MODELO && x.max_tokens <= 10 && x.temperature === 0 && x.messages[0].role === 'system',
    'la IA: modelo chico, pocas letras, temperatura 0 y la lista de etiquetas en el sistema');
  ok(await RC.preguntarIA({ AI: { run: async () => { throw new Error('x'); } } }, 'hola') === 'nada' && await RC.preguntarIA({}, 'x') === 'nada',
    'si la IA falla o no está: nada');
}

// ── 4. los mensajes ─────────────────────────────────────────────────────────────────────────────────────────────────
const LINKS = { eventos: '1500690475089399858', nuevos: '1500000000000000001', verificar: '1500000000000000002' };
const urls = (m) => JSON.stringify(m).match(/https:\/\/[^"]+/g) || [];
{
  const r = RC.respuesta('inscribirse', LINKS);
  ok(r.flags === 32768 && urls(r).some((u) => u.endsWith('/841017460341604382/' + LINKS.eventos)) && urls(r).includes(RC.PAGINA_EVENTOS)
    && urls(r).some((u) => u.endsWith('/' + LINKS.nuevos)), 'la respuesta: V2, pública, con el canal de eventos, la página y el de nuevos');
  const sin = RC.respuesta('verificarse', {});
  ok(!urls(sin).some((u) => u.includes('discord.com/channels')) && urls(sin).length === 1, 'sin el ID de un canal, ese botón no va (no un link roto)');
  const voseo = /\b(vos|tenés|podés|querés|sabés|anotate|fijate|mirá|entrá|sos)\b/i;
  ok(Object.values(RC.RESPUESTAS).every((x) => !voseo.test(x.texto)) && !voseo.test(Object.values(RC.TXT).map((x) => (typeof x === 'function' ? x('1') : x)).join(' ')),
    'todo lo que se publica va con «tú», nunca «vos»');
  ok(Object.values(RC.RESPUESTAS).every((x) => x.texto.length < 500), 'las respuestas son cortas (menos de 500 letras)');
  const largo = 'a'.repeat(50) + ' **negrita** _x_ @everyone <@123456789012345678>\n' + 'b'.repeat(200);
  const a = RC.avisoMsg({ canal: '1111111111111111111', msg: '2222222222222222222', texto: largo, etiqueta: 'cuando' });
  const txt = JSON.stringify(a);
  const ex = RC.extracto(largo);
  ok(ex.length <= 130 && !ex.includes('\n') && ex.includes('\\*\\*negrita') && ex.endsWith('…'),
    'el extracto: una línea, hasta 120 letras (con sus escapes), sin que los * rompan el mensaje');
  ok(txt.includes('"custom_id":"rcb:2222222222222222222"') && txt.includes('/1111111111111111111/2222222222222222222')
    && JSON.stringify(a.allowed_mentions) === '{"parse":[]}' && txt.includes('Alguien nuevo preguntó en <#1111111111111111111>')
    && txt.includes('cuándo hay evento'), 'el aviso: «Lo recibo yo», «Ir al mensaje», el tema, y no suena nadie');
  const r1 = RC.avisoRecibido(a, '3333333333333333333');
  const r2 = RC.avisoRecibido(r1, '4444444444444444444');
  const t2 = JSON.stringify(r2);
  ok(JSON.stringify(r1).includes('✋ Lo recibe <@3333333333333333333>') && (t2.match(/✋ Lo recibe/g) || []).length === 1
    && t2.includes('"disabled":true') && t2.includes('Ir al mensaje') && JSON.stringify(r1.allowed_mentions) === '{"parse":[]}'
    && t2.includes(ex.slice(0, 20)), 'ya recibido: «✋ Lo recibe <@id>» una sola vez, el botón apagado, el link y el extracto siguen');
}

// ── 5. el grabador, con un Discord y un Worker de mentira ───────────────────────────────────────────────────────────
{
  const C = G.resolver([{ id: '1', name: '💬・chat-general', type: 0 }, { id: '2', name: '💡 dudas', type: 0 }, { id: '3', name: '•「🚪」recibidor', type: 0 },
    { id: '4', name: '📢・eventos', type: 5 }, { id: '5', name: '📅・eventos-hoy', type: 0 }, { id: '6', name: '✦🐣・evento-nuevos', type: 0 },
    { id: '7', name: '✅・verifícate-aquí', type: 0 }, { id: '8', name: '𝐜𝐡𝐚𝐭 𝐠𝐞𝐧𝐞𝐫𝐚𝐥', type: 0 }, { id: '9', name: 'chat-general', type: 2 },
    { id: '10', name: 'recibidores-voz', type: 2 }, { id: '11', name: 'chat-general-ingles', type: 0 }]);
  ok([...C.escucha].sort().join() === '1,2,8' && C.aviso === '3' && C.eventos === '5' && C.nuevos === '6' && C.verificar === '7',
    'los canales por nombre (NFKD, también en negrita matemática): escucha chat general y dudas, avisa en recibidor, '
    + '«eventos-hoy» gana a «eventos», y los de voz no cuentan', JSON.stringify(Object.assign({}, C, { escucha: [...C.escucha] })));
  const f = new G.Freno(1000, 2);
  f.marcar('a', 0);
  ok(!f.puede('a', 500) && f.puede('a', 1000) && f.puede('b', 0), 'el freno: espera lo suyo, y otro no se frena');
  f.marcar('b', 0); f.marcar('c', 0);
  ok(f.m.size === 2 && f.puede('a', 1), 'y tiene tope: el más viejo se va');
  ok(G.esNuevo(AHORA - 10 * DIA, AHORA) && !G.esNuevo(AHORA - 61 * DIA, AHORA) && !G.esNuevo(undefined, AHORA) && !G.esNuevo(null, AHORA),
    'nuevo = en DRA hace menos de 60 días (sin la fecha, no)');

  const pedidos = [];
  let contesta = { ok: true, etiqueta: 'inscribirse', responder: RC.respuesta('inscribirse', LINKS), aviso: RC.avisoMsg({ canal: '1', msg: '9', texto: 'x', etiqueta: 'inscribirse' }) };
  globalThis.fetch = async (url, op = {}) => {
    pedidos.push({ url: String(url), metodo: op.method || 'GET', cuerpo: op.body ? JSON.parse(op.body) : null, h: op.headers || {} });
    if (String(url).endsWith('/recibidor')) return new Response(JSON.stringify(contesta), { status: 200 });
    return new Response('{"id":"1"}', { status: 200 });
  };
  const log = [];
  const BOT = '1550026808404217926';
  const canales = new Map([['3', { id: '3', permissionsFor: () => ({ has: () => true }) }]]);
  const guild = { id: G.GUILD_DRA, members: { me: {} }, channels: { cache: { get: (id) => canales.get(id), values: () => [
    { id: '1', name: '💬・chat-general', type: 0 }, { id: '3', name: '•「🚪」recibidor', type: 0 }, { id: '5', name: 'eventos-hoy', type: 0 }].values() } } };
  const cliente = { user: { id: BOT }, guilds: { cache: new Map([[G.GUILD_DRA, guild]]) } };
  const R = new G.Recibidor({ client: cliente, token: 't', vigia: 'https://w', clave: 'k', anotar: (...x) => log.push(x.join(' ')) });
  R.canales();
  let k = 0;
  const msj = (texto, o = {}) => ({ id: '80000000000000' + String(++k).padStart(4, '0'), content: texto, webhookId: null, system: false,
    author: { id: o.autor || '700000000000000001', bot: !!o.bot }, guild: o.guild || guild,
    member: { joinedTimestamp: o.unido === undefined ? AHORA - 3 * DIA : o.unido },
    channel: { id: o.canal || '1', permissionsFor: () => ({ has: () => o.permisos !== false }) },
    mentions: { users: new Map((o.menciones || []).map((x) => [x, {}])) } });
  const SECRETO = 'como me inscribo al evento mi nombre es Fulanito';
  await R.recibir(msj(SECRETO));
  const alW = pedidos.find((p) => p.url === 'https://w/recibidor');
  const resp = pedidos.find((p) => p.url.endsWith('/channels/1/messages'));
  const av = pedidos.find((p) => p.url.endsWith('/channels/3/messages'));
  ok(alW && alW.h['x-lg-ciclo'] === 'k' && alW.cuerpo.texto === SECRETO && alW.cuerpo.autor === '700000000000000001' && alW.cuerpo.canal === '1'
    && alW.cuerpo.msg && alW.cuerpo.unido === AHORA - 3 * DIA && alW.cuerpo.links.eventos === '5',
  'al Worker: con la clave del ciclo, el texto, quién, dónde, qué mensaje, desde cuándo está y los canales de los links');
  ok(resp && resp.h.Authorization === 'Bot t' && resp.cuerpo.message_reference.message_id === alW.cuerpo.msg
    && JSON.stringify(resp.cuerpo.allowed_mentions) === '{"parse":[],"replied_user":true}' && resp.cuerpo.flags === 32768,
  'la respuesta: contestando al mensaje, sólo le suena a quien preguntó');
  ok(av && JSON.stringify(av.cuerpo.allowed_mentions) === '{"parse":[]}' && JSON.stringify(av.cuerpo).includes('rcb:'),
    'y el aviso en •「🚪」recibidor, sin que suene nadie');
  ok(log.length && log.every((l) => !l.includes('Fulanito') && !l.includes('inscribo')), 'el log: ni el texto ni el nombre', log.join(' | '));
  const cuantos = () => pedidos.filter((p) => p.url === 'https://w/recibidor').length;
  let antes = cuantos();
  await R.recibir(msj('y cuando hay evento?'));
  ok(cuantos() === antes, 'la misma persona otra vez: nada (una consulta cada 10 min, una respuesta cada 24 h)');
  await R.recibir(msj('como me inscribo?', { autor: '700000000000000002' }));
  ok(cuantos() === antes, 'otra persona en el mismo canal enseguida: nada (90 s por canal)');
  AHORA += 91000;
  for (const [t, o, que] of [['como me inscribo?', { bot: true, autor: '7000000000000000a1' }, 'un bot'],
    ['como me inscribo?', { unido: AHORA - 90 * DIA, autor: '7000000000000000a2' }, 'alguien de hace 90 días'],
    ['como me inscribo?', { unido: null, autor: '7000000000000000a3' }, 'sin la fecha de entrada'],
    ['como me inscribo?', { canal: '99', autor: '7000000000000000a4' }, 'otro canal'],
    ['como me inscribo?', { guild: { id: '900000000000000001' }, autor: '7000000000000000a5' }, 'otro servidor'],
    ['como me inscribo?', { permisos: false, autor: '7000000000000000a6' }, 'un canal donde no puede escribir'],
    ['<@' + BOT + '> card como me inscribo', { menciones: [BOT], autor: '7000000000000000a7' }, 'una mención al bot (es de mencion.js)'],
    ['jajaja que buena', { autor: '7000000000000000a8' }, 'la charla'],
    ['como me inscribo ' + 'x'.repeat(300), { autor: '7000000000000000a9' }, 'más de 300 letras']]) {
    antes = cuantos();
    await R.recibir(msj(t, o));
    ok(cuantos() === antes, 'no se le pregunta al Worker: ' + que);
  }
  contesta = { ok: true, nada: true };
  const n0 = pedidos.length;
  await R.recibir(msj('quiero jugar', { autor: '700000000000000003' }));
  ok(pedidos.length === n0 + 1 && R.persona.puede('700000000000000003', AHORA) && R.canal.puede('1', AHORA),
    'si el Worker dice «nada»: no se publica nada, y ni la persona ni el canal quedan frenados 24 h / 90 s');
  globalThis.fetch = fetchReal;
}

// ── 6. el objeto de verdad ──────────────────────────────────────────────────────────────────────────────────────────
let DatabaseSync = null;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { DatabaseSync = null; }
if (!DatabaseSync) {
  console.log('  ⓘ sin node:sqlite (Node ' + process.version + '): el objeto no se prueba');
} else {
  const A = await import('./avisos.js');
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
  const al = async (ruta, d) => (await o.fetch(new Request('https://avisos/' + ruta, { method: 'POST', body: JSON.stringify(d) }))).json();
  const NUEVO = (x) => '60000000000000000' + x, REC = '500000000000000001', REC2 = '500000000000000002', MSG = (x) => '9000000000000000' + String(x).padStart(3, '0');
  const C1 = '100000000000000001', C2 = '100000000000000002';

  // las preguntas y los frenos
  let r = await al('recibidor-pedir', { msg: MSG(1), nuevo: NUEVO(1), canal: C1, etiqueta: 'inscribirse' });
  ok(r.estado === 'anotado' && r.etiqueta === 'inscribirse', 'una pregunta con etiqueta: se anota');
  const fila = sql.exec("SELECT * FROM rcb_pregunta WHERE msg = ?", MSG(1)).toArray()[0];
  ok(fila && Object.keys(fila).sort().join() === 'canal,etiqueta,msg,nuevo,t', 'y se guardan sólo IDs, la etiqueta y la hora (nunca el texto)',
    JSON.stringify(fila));
  r = await al('recibidor-pedir', { msg: MSG(2), nuevo: NUEVO(1), canal: C2, etiqueta: 'cuando' });
  ok(r.estado === 'espera' && r.por === 'persona', 'la misma persona en 24 h: espera (aunque sea otro canal)');
  r = await al('recibidor-pedir', { msg: MSG(3), nuevo: NUEVO(2), canal: C1, etiqueta: 'cuando' });
  ok(r.estado === 'espera' && r.por === 'canal', 'otra persona en el mismo canal en 90 s: espera');
  AHORA += 91000;
  r = await al('recibidor-pedir', { msg: MSG(3), nuevo: NUEVO(2), canal: C1, etiqueta: 'cuando' });
  ok(r.estado === 'anotado', 'pasados los 90 s, sí');
  r = await al('recibidor-pedir', { msg: MSG(4), nuevo: NUEVO(3), canal: C2, etiqueta: 'nada' });
  ok(r.estado === 'nada' && !sql.exec('SELECT 1 FROM rcb_pregunta WHERE msg = ?', MSG(4)).toArray().length, '«nada»: no se anota (no frena a nadie)');
  r = await al('recibidor-pedir', { msg: MSG(5), nuevo: NUEVO(3), canal: C2, etiqueta: 'borrar_todo' });
  ok(r.estado === 'nada', 'una etiqueta que no está en la lista vale «nada»');
  ok((await al('recibidor-pedir', { msg: 'x', nuevo: NUEVO(3), canal: C2 })).error, 'sin IDs de verdad: error');

  // el tope de la IA
  let si = 0, no = 0;
  for (let x = 0; x < RC.IA_POR_DIA + 5; x++) {
    const p = await al('recibidor-pedir', { msg: MSG(100 + x), nuevo: NUEVO(4), canal: C2, ia: true });
    if (p.estado === 'ia' && p.permiso) si++; else if (p.estado === 'ia') no++;
  }
  ok(si === RC.IA_POR_DIA && no === 5, `la IA: ${RC.IA_POR_DIA} por día y después no`, si + ' / ' + no);
  AHORA += DIA;
  r = await al('recibidor-pedir', { msg: MSG(200), nuevo: NUEVO(4), canal: C2, ia: true });
  ok(r.estado === 'ia' && r.permiso, 'al otro día (hora del este) vuelve a haber cupo');

  // «Lo recibo yo»: el primero gana
  r = await al('recibidor-reclamar', { msg: MSG(1), quien: REC });
  ok(r.estado === 'tuyo' && r.recibidor === REC, 'el primero que toca: es suyo');
  r = await al('recibidor-reclamar', { msg: MSG(1), quien: REC2 });
  ok(r.estado === 'otro' && r.recibidor === REC, 'el segundo: «ya lo recibe» el primero');
  r = await al('recibidor-reclamar', { msg: MSG(1), quien: REC });
  ok(r.estado === 'tuyo' && r.ya, 'el mismo otra vez: sigue siendo suyo, sin repetir');
  ok((await al('recibidor-reclamar', { msg: MSG(999), quien: REC })).error === 'vencida', 'una pregunta que no está: vencida');
  ok((await al('recibidor-reclamar', { msg: MSG(1), quien: NUEVO(1) })).error === 'propio', 'recibirse a uno mismo: no');

  // 👋 los que ENTRAN (la bienvenida del grabador, grabador/bienvenida.js): su fila para «Lo recibo yo», que no frena nada
  const E1 = '610000000000000001', E2 = '610000000000000002', CB = '100000000000000009';
  ok((await al('recibidor-entro', { canal: CB, nuevos: [E1, E2] })).n === 2, 'los que entraron: una fila por persona');
  ok((await al('recibidor-entro', { canal: CB, nuevos: Array.from({ length: 26 }, (_, i) => '6200000000000000' + String(i).padStart(2, '0')) })).error
    && (await al('recibidor-entro', { canal: 'x', nuevos: [E1] })).error, 'más de 25, o sin canal de verdad: error');
  r = await al('recibidor-pedir', { msg: MSG(300), nuevo: E1, canal: CB, etiqueta: 'cuando' });
  ok(r.estado === 'anotado', 'quien entró y pregunta enseguida: la respuesta NO espera (la fila de la entrada no cuenta para los frenos)', JSON.stringify(r));
  r = await al('recibidor-reclamar', { msg: E2, quien: REC });
  ok(r.estado === 'tuyo' && r.nuevo === E2, '«Lo recibo yo» del aviso de entrada (`rcb:<su id>`): es tuyo, y dice a quién');
  r = await al('recibidor-reclamar', { msg: E1, quien: REC2 });
  ok(r.estado === 'tuyo' && r.nuevo === E1 && (await al('recibidor-reclamar', { msg: MSG(300), quien: REC })).estado === 'otro',
    'y es la MISMA persona por su entrada o por su pregunta: la recibe uno solo');
  const env0 = { AVISOS: { idFromName: () => 'x', get: () => ({ fetch: (u, op) => o.fetch(new Request(u, op)) }) } };
  const re = await RC.rutaEntro(new Request('https://w/recibidor-entro', { method: 'POST', body: JSON.stringify({ g: RC.GUILD_DRA, canal: CB, nuevos: ['610000000000000003'] }) }), env0);
  const reMal = await RC.rutaEntro(new Request('https://w/recibidor-entro', { method: 'POST', body: JSON.stringify({ g: '1', canal: CB, nuevos: ['610000000000000003'] }) }), env0);
  ok(re.status === 200 && (await re.json()).n === 1 && reMal.status === 400, 'la ruta del Worker: sólo DRA');

  // el premio: el Pase de la temporada «prueba» y los eventos con la misma
  const UMB = Array.from({ length: 30 }, (_, i) => (i < 3 ? 300 * (i + 1) : 900 + 1000 * (i - 2)));
  const CFG = { temp: 'prueba', niveles: 30, umbrales: UMB, cola: [1000, 300], diarias: [['entrar', 'Entra hoy', '', 'activo', 1, 150]],
    por_dia: 2, semanales: [['dias', 'Entra 3 días', '', 'activo', 3, 500]], temporada: [], premios: [], publicar: [10, 30], bienvenida: [],
    especiales: [], doble: [], boost: 20, premium: [] };
  const s0 = AHORA - 3 * DIA;
  let v = 0;
  const ciclo = (premium) => o.paseCiclo({ v: 'v' + (++v), cfg: CFG, sem: [['2026-11-23', s0, s0 + 7 * DIA]], miembros: [REC, REC2], hechas: {}, premium });
  ok(ciclo([]).ok, 'el Pase de prueba entra');
  o.guardar('racha_cfg', { temp: 'prueba' });
  const jugar = (q, ev) => sql.exec('INSERT OR REPLACE INTO jugo_temp (quien, temp, k, eventos) VALUES (?, ?, ?, ?)', q, 'prueba', 'k' + q.slice(-3), ev);
  // otros dos nuevos que pregunta y REC recibe (y uno que ya había jugado, y otro que recibe REC2 y juega tarde)
  const preguntar = async (x) => { AHORA += 91000; return al('recibidor-pedir', { msg: MSG(x), nuevo: NUEVO(x), canal: C1, etiqueta: 'inscribirse' }); };
  for (const x of [11, 12, 13, 14]) ok((await preguntar(x)).estado === 'anotado', 'pregunta ' + x);
  jugar(NUEVO(13), 2);                                    // el 13 ya había jugado antes de que lo reciban
  for (const x of [11, 12, 13]) await al('recibidor-reclamar', { msg: MSG(x), quien: REC });
  await al('recibidor-reclamar', { msg: MSG(14), quien: REC2 });
  ok(sql.exec('SELECT cuenta FROM rcb_recibe WHERE nuevo = ?', NUEVO(13)).toArray()[0].cuenta === -1, 'quien ya había jugado no le cuenta a nadie');
  jugar(NUEVO(1), 1); jugar(NUEVO(11), 1);
  AHORA += H;
  let cont = await RC.revisar(o, AHORA, A.DUENO);
  ok(cont === 2 && RC.contados(o, REC, 'prueba') === 2, 'a la hora: los dos que jugaron su primer evento le cuentan a REC', cont);
  ok(!sql.exec("SELECT 1 FROM premium_vale WHERE origen LIKE 'rcbprem:%'").toArray().length, 'con 2, todavía no hay premio');
  // el 14 juega a los 15 días: tarde
  AHORA += 15 * DIA;
  jugar(NUEVO(14), 1);
  jugar(NUEVO(12), 1);
  cont = await RC.revisar(o, AHORA, A.DUENO);
  ok(cont === 0 && RC.contados(o, REC2, 'prueba') === 0, 'pasados los 14 días ya no cuenta (ni el 12 ni el 14)');
  // un 4.º que REC recibe y juega a tiempo
  ok((await preguntar(15)).estado === 'anotado', 'pregunta 15');
  await al('recibidor-reclamar', { msg: MSG(15), quien: REC });
  AHORA += 2 * DIA;
  jugar(NUEVO(15), 1);
  cont = await RC.revisar(o, AHORA, A.DUENO);
  const prem = o.pasePremium(REC, 'prueba');
  const vale = sql.exec("SELECT * FROM premium_vale WHERE origen = 'rcbprem:prueba:" + REC + "'").toArray()[0];
  const band = sql.exec("SELECT titulo, cuerpo FROM bandeja WHERE quien = ? AND clave = 'rcbprem:prueba'", REC).toArray();
  ok(cont === 1 && RC.contados(o, REC, 'prueba') === 3 && prem && prem[1] == null && vale && vale.usado_por === REC && vale.usado_temp === 'prueba'
    && band.length === 1 && /3 personas que ya jugaron/.test(band[0].titulo) && /Pase Premium de esta temporada es tuyo/.test(band[0].cuerpo),
  'con 3: el Pase Premium de la temporada, el vale como usado por su cuenta y el aviso en la campana', JSON.stringify({ prem, vale, band }));
  ok(!(await RC.premiar(o, REC, AHORA, A.DUENO)) && sql.exec("SELECT COUNT(*) AS n FROM premium_vale WHERE origen LIKE 'rcbprem:%'").toArray()[0].n === 1,
    'una sola vez: volver a mirar no da otro');
  ciclo([]);
  ok(o.pasePremium(REC, 'prueba')[1] == null, 'y la cuenta del rol de premium del ciclo no se lo cierra (no tiene el rol)');
  // quien YA tenía el premium por el rol: el vale queda en su Inventario, sin usar
  const REC3 = '500000000000000003';
  ciclo([REC3]);
  sql.exec("INSERT OR REPLACE INTO idk (id, k, t) VALUES (?, 'rec3', ?)", REC3, AHORA);
  for (const x of [21, 22, 23]) {
    sql.exec("INSERT INTO rcb_recibe (nuevo, msg, recibidor, t, ev0, cuenta, temp, cuenta_t) VALUES (?, ?, ?, ?, 0, 1, 'prueba', ?)", NUEVO(x), MSG(x), REC3, AHORA, AHORA);
  }
  ok(await RC.premiar(o, REC3, AHORA, A.DUENO), 'REC3, que ya tenía el premium por el rol, también llega a 3');
  const v3 = sql.exec("SELECT * FROM premium_vale WHERE origen = 'rcbprem:prueba:" + REC3 + "'").toArray()[0];
  ok(v3 && v3.k === 'rec3' && !v3.usado_temp && !v3.usado_por, 'y su vale queda SIN usar en su Inventario, para otra temporada', JSON.stringify(v3));
  ok(!(await RC.premiar(o, A.DUENO, AHORA, A.DUENO)), 'el dueño ya tiene todo: no se le da nada');

  // ── 7. la ruta del Worker y el botón, contra el objeto de verdad ─────────────────────────────────────────────────
  const iaLlamadas = [];
  let iaDice = 'primer_evento';
  const env = { AVISOS: { idFromName: () => 'liga', get: () => ({ fetch: (url, op) => o.fetch(new Request(url, op)) }) },
    AI: { run: async (m, x) => { iaLlamadas.push(x); return { response: iaDice }; } } };
  const pedirR = async (d) => (await RC.ruta(new Request('https://w/recibidor', { method: 'POST', body: JSON.stringify(d) }), env)).json();
  AHORA += DIA;
  o.guardar('rcb_ia', {});
  let w = await pedirR({ texto: 'hola, como me inscribo?', g: RC.GUILD_DRA, canal: C1, autor: NUEVO(31), msg: MSG(31), links: LINKS });
  ok(w.ok && w.etiqueta === 'inscribirse' && w.responder && w.aviso && !iaLlamadas.length, 'una pregunta clara: la respuesta fija y el aviso, sin gastar la IA');
  AHORA += 91000;
  w = await pedirR({ texto: 'quiero jugar', canal: C1, autor: NUEVO(32), msg: MSG(32), links: LINKS });
  ok(w.ok && w.etiqueta === 'primer_evento' && iaLlamadas.length === 1, 'una en duda: elige la IA (una llamada)', JSON.stringify(w));
  AHORA += 91000;
  iaDice = 'Claro, te explico: para inscribirte…';
  w = await pedirR({ texto: 'alguien sabe algo del torneo?', canal: C1, autor: NUEVO(33), msg: MSG(33) });
  ok(w.ok && w.nada && !sql.exec('SELECT 1 FROM rcb_pregunta WHERE msg = ?', MSG(33)).toArray().length,
    'si la IA escribe en vez de elegir: nada, y no se anota', JSON.stringify(w));
  const antesIA = iaLlamadas.length;
  w = await pedirR({ texto: 'jajaja que buena', canal: C1, autor: NUEVO(34), msg: MSG(34) });
  ok(w.nada && w.motivo === 'prefiltro' && iaLlamadas.length === antesIA, 'la charla: ni el objeto ni la IA');
  w = await pedirR({ texto: 'como me inscribo', g: '900000000000000001', canal: C1, autor: NUEVO(35), msg: MSG(35) });
  ok(w.ok === false, 'de otro servidor: no');

  // el botón
  const pedidos = [];
  globalThis.fetch = async (url, op = {}) => { pedidos.push({ url: String(url), metodo: op.method, cuerpo: op.body ? JSON.parse(op.body) : null }); return new Response('{}'); };
  const avisoPub = RC.avisoMsg({ canal: C1, msg: MSG(31), texto: 'hola, como me inscribo?', etiqueta: 'inscribirse' });
  const clic = (quien, roles) => ({ type: 3, application_id: 'app', token: 'tok', guild_id: RC.GUILD_DRA, message: avisoPub,
    member: { user: { id: quien }, roles }, data: { custom_id: 'rcb:' + MSG(31) } });
  const esperas = [];
  const ctx = { waitUntil: (p) => esperas.push(p) };
  let resp = await (RC.boton(clic('500000000000000009', ['1']), env, ctx, A.DUENO)).json();
  ok(resp.type === 4 && (resp.data.flags & 64) && JSON.stringify(resp).includes('Recibidores') && !esperas.length,
    'sin el rol de Recibidor: un aviso que ve sólo él, y no se toca nada');
  resp = await (RC.boton(clic(REC, [RC.ROL_RECIBIDOR]), env, ctx, A.DUENO)).json();
  await Promise.all(esperas.splice(0));
  const ed = pedidos.find((p) => p.metodo === 'PATCH' && p.url.endsWith('/webhooks/app/tok/messages/@original'));
  ok(resp.type === 6 && ed && JSON.stringify(ed.cuerpo).includes('✋ Lo recibe <@' + REC + '>') && JSON.stringify(ed.cuerpo.allowed_mentions) === '{"parse":[]}'
    && pedidos.some((p) => p.metodo === 'POST' && JSON.stringify(p.cuerpo).includes('lo recibes tú')),
  'con el rol: «ya va» (tipo 6), el aviso editado («✋ Lo recibe», sin que suene) y un «lo recibes tú» que ve sólo él');
  pedidos.length = 0;
  resp = await (RC.boton(clic(A.DUENO, []), env, ctx, A.DUENO)).json();
  await Promise.all(esperas.splice(0));
  ok(resp.type === 6 && pedidos.some((p) => p.metodo === 'POST' && JSON.stringify(p.cuerpo).includes('Ya lo recibe <@' + REC + '>')
    && (p.cuerpo.flags & 64)), 'Dlx sin el rol puede tocar, y como llegó segundo: «Ya lo recibe…», sólo para él');
  globalThis.fetch = fetchReal;

  // ── 8. por la puerta del Worker de verdad: la ruta pide la clave del ciclo, y el botón llega firmado ─────────────
  const { createHash, webcrypto } = await import('node:crypto');
  const { default: worker } = await import('./worker.js');
  const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
  const par = await webcrypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const envW = Object.assign({}, env, { DISCORD_TOKEN: 'tok', DISCORD_PUBLIC_KEY: hex(await webcrypto.subtle.exportKey('raw', par.publicKey)),
    KV: { get: async () => null, put: async () => {} } });
  const cuerpoR = JSON.stringify({ texto: 'como me inscribo?', canal: C2, autor: NUEVO(41), msg: MSG(41) });
  let rw = await worker.fetch(new Request('https://w/recibidor', { method: 'POST', body: cuerpoR }), envW, { waitUntil() {} });
  ok(rw.status === 403, '/recibidor sin la clave del ciclo: 403');
  AHORA += 91000;
  rw = await worker.fetch(new Request('https://w/recibidor', { method: 'POST', body: cuerpoR,
    headers: { 'x-lg-ciclo': createHash('sha256').update('lg-ciclo:tok').digest('hex') } }), envW, { waitUntil() {} });
  const jw = await rw.json();
  ok(rw.status === 200 && jw.ok && jw.etiqueta === 'inscribirse' && jw.responder, 'y con la clave, la respuesta fija', JSON.stringify(jw).slice(0, 200));
  const pedidos2 = [];
  globalThis.fetch = async (url, op = {}) => { pedidos2.push({ url: String(url), metodo: op.method, cuerpo: op.body ? JSON.parse(op.body) : null }); return new Response('{}'); };
  const esperas2 = [];
  const clicW = async (quien, roles) => {
    AHORA += 60000;
    const cuerpo = JSON.stringify({ type: 3, id: '1', application_id: 'app', token: 'tok2', guild_id: RC.GUILD_DRA, channel_id: '3',
      message: RC.avisoMsg({ canal: C2, msg: MSG(41), texto: 'como me inscribo?', etiqueta: 'inscribirse' }),
      member: { user: { id: quien, username: 'x' }, roles }, data: { custom_id: 'rcb:' + MSG(41), component_type: 2 } });
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = hex(await webcrypto.subtle.sign('Ed25519', par.privateKey, new TextEncoder().encode(ts + cuerpo)));
    const res = await worker.fetch(new Request('https://w/', { method: 'POST', headers: { 'x-signature-ed25519': sig, 'x-signature-timestamp': ts },
      body: cuerpo }), envW, { waitUntil: (p) => esperas2.push(p) });
    await Promise.all(esperas2.splice(0));
    return res.json();
  };
  let jc = await clicW('500000000000000008', []);
  ok(jc.type === 4 && (jc.data.flags & 64), 'el botón por el Worker: sin el rol, el aviso que ve sólo él', JSON.stringify(jc).slice(0, 200));
  jc = await clicW(REC2, [RC.ROL_RECIBIDOR]);
  ok(jc.type === 6 && pedidos2.some((p) => p.metodo === 'PATCH' && JSON.stringify(p.cuerpo).includes('✋ Lo recibe <@' + REC2 + '>')),
    'con el rol: tipo 6 y el aviso editado con quién lo recibe', JSON.stringify(jc).slice(0, 200));

  // ── 9. 👋 saludar ────────────────────────────────────────────────────────────────────────────────────────────────
  const NV = NUEVO(51), CS = C1;
  const resS = RC.respuesta('inscribirse', LINKS, RC.GUILD_DRA, { nuevo: NV, canal: CS });
  const avS = RC.avisoMsg({ canal: CS, msg: MSG(51), texto: 'como me inscribo', etiqueta: 'inscribirse', nuevo: NV });
  const idS = 'rsal:' + NV + ':' + CS;
  ok(JSON.stringify(resS).includes('"custom_id":"' + idS + '"') && JSON.stringify(avS).includes('"custom_id":"' + idS + '"')
    && !JSON.stringify(resS).includes('saludar_') && JSON.parse(JSON.stringify(resS)).components[1].components.length <= 5,
  '«👋 Saludar» va en la respuesta al nuevo y en el aviso (rsal:, no el saludar_ de YAGPDB), sin pasar de 5 botones por fila');
  ok(JSON.stringify(RC.avisoRecibido(avS, REC)).includes('"custom_id":"' + idS + '"') && !/"custom_id":"rsal[^}]*"disabled"/.test(JSON.stringify(RC.avisoRecibido(avS, REC))),
    'y después de «Lo recibo yo» el de saludar sigue andando (sólo se apaga el de recibir)');
  const sm = RC.saludoMsg(REC, NV, CS);
  ok(JSON.stringify(sm).includes('👋 <@' + REC + '> le da la bienvenida a <@' + NV + '>') && JSON.stringify(sm).includes(RC.SALUDO_GIF)
    && JSON.stringify(sm).includes(idS) && JSON.stringify(sm.allowed_mentions) === JSON.stringify({ parse: [], users: [NV] }),
  'el saludo: quién saluda a quién, el GIF, el botón otra vez, y sólo le suena al nuevo');
  // en el objeto
  const S = (quien, extra) => al('recibidor-saludar', Object.assign({ nuevo: NV, quien }, extra || {}));
  ok((await S(NV)).error === 'propio', 'saludarse a uno mismo: no');
  const quienes = ['400000000000000001', '400000000000000002', '400000000000000003', '400000000000000004', '400000000000000005'];
  const r1 = await S(quienes[0]);
  ok(r1.ok && r1.n === 1 && (await S(quienes[0])).error === 'ya', 'el primero saluda; el mismo otra vez, no');
  for (const q of quienes.slice(1, 4)) await S(q);
  ok((await S(quienes[4])).error === 'tope', 'el 5.º no: hasta 4 saludos por persona nueva');
  ok((await S(quienes[3], { deshacer: true })).ok && (await S(quienes[4])).ok, 'deshacer uno (Discord no lo publicó) libera el lugar');
  AHORA += 8 * DIA;
  ok((await S(quienes[0])).ok, 'a los 7 días se puede volver a saludar');
  await RC.revisar(o, AHORA, A.DUENO);
  ok(sql.exec('SELECT COUNT(*) AS n FROM rcb_saludo').toArray()[0].n === 1, 'y la vuelta de cada hora borra los saludos de más de 7 días');
  // el botón
  const pedS = [];
  let publicar = true;
  globalThis.fetch = async (url, op = {}) => {
    pedS.push({ url: String(url), metodo: op.method, h: op.headers || {}, cuerpo: op.body ? JSON.parse(op.body) : null });
    return new Response('{}', { status: String(url).includes('/channels/') && !publicar ? 403 : 200 });
  };
  const envS = Object.assign({}, env, { DISCORD_TOKEN: 'tokbot' });
  const clicS = async (quien, canalClic, nuevo = NUEVO(52)) => {
    const esperasS = [];
    const res = await (RC.saludarBoton({ type: 3, application_id: 'app', token: 'tk', guild_id: RC.GUILD_DRA, channel_id: canalClic,
      member: { user: { id: quien }, roles: [] }, data: { custom_id: 'rsal:' + nuevo + ':' + CS } }, envS, { waitUntil: (p) => esperasS.push(p) })).json();
    await Promise.all(esperasS);
    return res;
  };
  let rs = await clicS(NUEVO(52), CS);
  ok(rs.type === 4 && (rs.data.flags & 64) && JSON.stringify(rs).includes('No puedes saludarte a ti mismo'), 'el nuevo toca su propio botón: «No puedes saludarte a ti mismo», sólo para él');
  pedS.length = 0;
  rs = await clicS(REC, CS);
  const pub = pedS.find((p) => p.url.endsWith('/channels/' + CS + '/messages'));
  ok(rs.type === 6 && pub && pub.h.Authorization === 'Bot tokbot' && JSON.stringify(pub.cuerpo.allowed_mentions) === JSON.stringify({ parse: [], users: [NUEVO(52)] })
    && !pedS.some((p) => p.url.includes('/webhooks/')), 'desde el chat: tipo 6 y el saludo en el canal donde preguntó, con el token del bot (sin «Listo» aparte)');
  pedS.length = 0;
  rs = await clicS(REC2, '3');
  ok(pedS.some((p) => p.url.endsWith('/channels/' + CS + '/messages')) && pedS.some((p) => p.url.includes('/webhooks/') && JSON.stringify(p.cuerpo).includes('lo saludaste en <#' + CS + '>')),
    'desde el canal de los recibidores: el saludo sale en el chat del nuevo, y un «Listo» que ve sólo quien tocó');
  pedS.length = 0;
  rs = await clicS(REC2, '3');
  ok(pedS.some((p) => p.url.includes('/webhooks/') && JSON.stringify(p.cuerpo).includes('Ya lo saludaste')) && !pedS.some((p) => p.url.includes('/channels/')),
    'el mismo otra vez: «Ya lo saludaste», y no se publica nada');
  publicar = false;
  pedS.length = 0;
  await clicS('400000000000000009', CS);
  ok(!sql.exec('SELECT 1 FROM rcb_saludo WHERE nuevo = ? AND quien = ?', NUEVO(52), '400000000000000009').toArray().length
    && pedS.some((p) => p.url.includes('/webhooks/')), 'si Discord no deja publicar: el saludo no cuenta y se le avisa');
  publicar = true;
  // y por el Worker de verdad, firmado
  const firmadoS = async (quien) => {
    AHORA += 60000;
    const cuerpo = JSON.stringify({ type: 3, id: '2', application_id: 'app', token: 'tok3', guild_id: RC.GUILD_DRA, channel_id: CS,
      member: { user: { id: quien, username: 'x' }, roles: [] }, data: { custom_id: 'rsal:' + NUEVO(53) + ':' + CS, component_type: 2 } });
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = hex(await webcrypto.subtle.sign('Ed25519', par.privateKey, new TextEncoder().encode(ts + cuerpo)));
    const esp = [];
    const res = await worker.fetch(new Request('https://w/', { method: 'POST', headers: { 'x-signature-ed25519': sig, 'x-signature-timestamp': ts },
      body: cuerpo }), Object.assign({}, envW, { DISCORD_TOKEN: 'tok' }), { waitUntil: (p) => esp.push(p) });
    await Promise.all(esp);
    return res.json();
  };
  pedS.length = 0;
  const fw = await firmadoS(REC);
  ok(fw.type === 6 && pedS.some((p) => p.url.endsWith('/channels/' + CS + '/messages')), 'por el Worker de verdad: el clic firmado saluda', JSON.stringify(fw).slice(0, 150));

  // ── 10. olvidarme y mudar la cuenta ─────────────────────────────────────────────────────────────────────────────
  const cuenta = (q, c, v) => sql.exec(`SELECT COUNT(*) AS n FROM ${q} WHERE ${c} = ?`, v).toArray()[0].n;
  const antesREC = RC.contados(o, REC, 'prueba');
  ok(cuenta('rcb_recibe', 'nuevo', NUEVO(11)) === 1 && cuenta('rcb_pregunta', 'nuevo', NUEVO(11)) === 1, 'antes de olvidar: el 11 tiene su pregunta y su fila');
  await o.olvidar({ quien: NUEVO(11) });
  ok(!cuenta('rcb_recibe', 'nuevo', NUEVO(11)) && !cuenta('rcb_pregunta', 'nuevo', NUEVO(11)) && RC.contados(o, REC, 'prueba') === antesREC,
    'olvidarme: el recibido se va (su ID y su pregunta), y a su recibidor no se le descuenta lo ganado');
  await S('400000000000000007');
  RC.olvidar(o, '400000000000000007');
  ok(!cuenta('rcb_saludo', 'quien', '400000000000000007'), 'y los saludos que dio');
  // mudar: REC pasa a una cuenta nueva y no cobra el premio dos veces
  const RECN = '500000000000000077';
  const r0 = await o.mudarCuenta({ viejo: REC, nuevo: RECN });
  ok(r0.ok && !r0.fallas.length && RC.contados(o, RECN, 'prueba') === antesREC && !RC.contados(o, REC, 'prueba')
    && sql.exec("SELECT 1 FROM premium_vale WHERE origen = 'rcbprem:prueba:" + RECN + "'").toArray().length
    && !sql.exec("SELECT 1 FROM premium_vale WHERE origen = 'rcbprem:prueba:" + REC + "'").toArray().length,
  'mudar la cuenta: lo recibido y la marca del premio pasan a la nueva', JSON.stringify(r0));
  ok(!(await RC.premiar(o, RECN, AHORA, A.DUENO)), 'y la cuenta nueva no lo vuelve a cobrar');
  globalThis.fetch = fetchReal;
}

Date.now = relojReal;
console.log(fallas ? `\n  🔴 ${fallas} fallo(s), ${bien} bien\n` : `\n  ✅ el recibidor: ${bien} bien\n`);
process.exit(fallas ? 1 : 0);
