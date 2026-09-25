/**
 * Prueba el Worker SIN Discord, SIN Cloudflare y SIN credenciales.
 *
 *   node bot/probar_local.mjs
 *
 * ⚠️ POR QUÉ EXISTE. Discord no dice por qué rechaza una URL: dice «no se pudo
 * verificar» y nada más. Y la firma falla en silencio por dos motivos que se
 * parecen —verificar sobre el body ya parseado, o contestar 200 a una firma
 * mala—, así que sin esto la única forma de encontrarlos es a ciegas, cambiando
 * cosas y volviendo a pegar la URL.
 *
 * Acá se genera un par de claves de mentira, se firma un PING como lo firma
 * Discord, y se le pasa al mismo `fetch` que va a correr en producción.
 *
 * Es el mismo criterio que herramientas/puedo_generar.py: **correr la cosa de
 * verdad**, porque los dos errores de arriba pasan la lectura del código.
 */
import { webcrypto } from 'node:crypto';
// El canal de verificación, para no repetirlo en las pruebas: si cambia en el
// Worker, cambia acá solo. Es la única constante del Worker que estas pruebas
// leen directo — el resto entra por la puerta, como lo haría Discord.
import { VERIFICA } from './worker.js';
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const { default: worker } = await import('./worker.js');

const hex = (b) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');

// Un par Ed25519 de mentira: hace de "la app de Discord".
const par = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
const CLAVE_PUBLICA = hex(await crypto.subtle.exportKey('raw', par.publicKey));
// Un KV de mentira, con lo mismo que escribe bot/subir_datos.py.
// ⚠️ Sin esto el Worker revienta en la primera lectura -- y en produccion eso
// pasaria recien cuando alguien usa /card, no al desplegar.
const KV_FALSO = {
  // ⚠️ `sv` es DONDE ESTA y `svp` DONDE JUGO. Konan juega en TWR: su
  // `servidor.webp` lleva su puesto ahi, y las `sv-<codigo>` no.
  'p:konan':  JSON.stringify({ n: 'Konan', sv: 'TWR', svp: 'TWR', cc: 'ar', ev: 95 }),
  // ⚠️ UNA PERSONA APARTE PARA EL PUESTO, y no reusar a Konan. Konan es el
  // fixture de media docena de pruebas que dependen de que le FALTEN
  // servidores —la BLOQUEADA, la invitación—; darle los nueve las rompe
  // todas. «Veterano» es alguien del pool con todo subido, que es el caso que
  // hay que probar acá.
  'p:veterano': JSON.stringify({ n: 'Veterano', sv: 'DRA', svp: 'TWR', cc: 'ar', ev: 50,
                                 cs: ['temporada', 'competitivo', 'servidor', 'pais'],
                                 svs: ['DRA', 'FFA'],
                                 svc: ['DRA', 'EFA', 'FFA', 'FRZ', 'FTN', 'SR',
                                       'TFC', 'TWR', 'URBF'] }),
  'p:mingo':  JSON.stringify({ n: 'Mingo', sv: 'DRA', svp: 'DRA', cc: 'ar', ev: 4 }),
  // ⚠️ Mark es el caso de verdad: no tiene pais, asi que no tiene carta de
  // Pais. Su `cs` no la lleva, y el bot no puede dibujarle ese boton.
  'p:mark':   JSON.stringify({ n: 'Mark', sv: 'TFC', svp: 'TFC', cc: '', ev: 8,
                               cs: ['temporada', 'competitivo', 'servidor'] }),
  // ⚠️ DRAKO ES EL CASO DE LOS 331, y es distinto de todos los de arriba: NO
  // compitió, así que no tiene `servidor.webp` — tiene `sv-dra` y `sv-ffa` y
  // nada más. `cs:['servidor']` está para que el botón aparezca; si de ahí se
  // dedujera la URL, le saldría un hueco. Por eso manda `svc`.
  'p:drako':  JSON.stringify({ n: 'Lil Drako', sv: 'DRA', svp: '', cc: '', ev: 0,
                               cs: ['servidor'], svc: ['DRA', 'FFA'],
                               svs: ['DRA', 'FFA'],
                               bl: ['temporada', 'competitivo'] }),
  // ⚠️ IGUAL QUE VETERANO PERO **SIN LA COMPETITIVA**. Desde el
  // 22/09 `/card` abre en Competitivo cuando está desbloqueada, así
  // que para probar en qué SERVIDOR abre la Servidor hace falta
  // alguien que caiga en la Servidor. Sin esto, los dos tests de
  // «el puesto en la carta de Servidor» dejaban de mirar la Servidor.
  'p:jugador': JSON.stringify({ n: 'Jugador', sv: 'DRA', svp: 'TWR', cc: 'ar', ev: 6,
                                cs: ['temporada', 'servidor'],
                                svs: ['DRA', 'FFA'],
                                svc: ['DRA', 'EFA', 'FFA', 'FRZ', 'FTN', 'SR',
                                      'TFC', 'TWR', 'URBF'] }),
  // 🔴 EL QUE SE VERIFICO RECIEN: ESTA EN KV Y NO TIENE NINGUN DIBUJO.
  // `cs: []` **presente y vacio**, que no es lo mismo que `cs` ausente —
  // ese vale por «las cuatro», y Konan lo prueba tres bloques mas abajo.
  // El Worker junto los dos casos el 22/09/2026 y contestaba «esperá» a
  // todo el que viniera de KV viejo: 29 pruebas en rojo. Los dos fixtures
  // tienen que existir o la distincion se puede borrar sin que nada avise.
  'p:recien': JSON.stringify({ n: 'Recien', sv: 'DRA', svp: '', cc: 'ar', ev: 0,
                               cs: [], svc: [], svs: [] }),
  'd:999111': 'konan',
  'd:999222': 'drako',
  'd:999333': 'veterano',
  'd:999555': 'jugador',
  'd:999666': 'recien',
};
// ⚠️ `meta` va aparte y es MUTABLE porque `svs` es lo que enciende las cartas
// de los otros servidores cuando el pipeline las sube. Hay que poder probar
// los dos lados: sin el servidor en la lista el menú ofrece la invitación, y
// con él, la carta.
const META = {
  sello: '202609170400', gente: 138, req_competitivo: 10, svs: [],
  // los requisitos viajan a KV para que /help no pueda mentir
  // el bot solo esta en DRA y FFA: en los otros siete no puede saber
  // quien es miembro, y por eso no invita
  bot_en: ['DRA', 'FFA'],
  req: { temporada: { n: 1, que: 'PARTICIPACIÓN' },
         competitivo: { n: 10, que: 'EVENTOS' },
         pais: { n: 1, que: 'PAÍS ASIGNADO' } },
};
// ⚠️ EL WORKER AHORA ESCRIBE (anota a los desconocidos en `reg:<id>`), así que
// el KV de mentira necesita `put`. Se guarda lo escrito en PUESTO para poder
// afirmarlo, y `get` lo consulta primero para que el dedup se pueda probar.
const PUESTO = {};
const env = {
  DISCORD_PUBLIC_KEY: CLAVE_PUBLICA,
  KV: {
    get: async (k) => (k === 'meta' ? JSON.stringify(META)
                                    : (k in PUESTO ? PUESTO[k]
                                    : (k in KV_FALSO ? KV_FALSO[k] : null))),
    put: async (k, v) => { PUESTO[k] = v; },
    // ⚠️ `delete` FALTABA, y no era cosmético: `/numeral mostrar:True` lo llama
    // para borrar la preferencia. Sin él en el mock, el comando reventaba acá
    // y hubiera reventado igual en producción sin que nadie se enterara hasta
    // que alguien quisiera volver a mostrar su puesto.
    delete: async (k) => { delete PUESTO[k]; },
  },
};

// Los guild_id de verdad, de datos/servidores.json.
const G = { FFA: '1468472442925092958', DRA: '841017460341604382', AJENO: '55555' };

// ⚠️ EL RELOJ ES DE MENTIRA, Y ES LO QUE HACE PROBABLE EL FRENO AL SPAM.
// El freno cuenta cuántas veces alguien pidió algo en los últimos N segundos,
// y este archivo corre entero en menos de uno: sin esto, las pruebas de más
// abajo gastarían las ranuras de las de más arriba y fallarían por el orden
// en que están escritas, no por lo que miden. Con el reloj en la mano cada
// petición "pasa" un minuto salvo cuando se pide lo contrario.
let RELOJ = Date.now();
Date.now = () => RELOJ;

// Lo que el Worker manda por su cuenta después de contestar (la invitación).
let SEGUIMIENTOS = [];
// Los links reales de la tabla, para devolverlos después de las pruebas.
let ORIGINAL_INVITA = [];
globalThis.fetch = async (url, opc) => {
  SEGUIMIENTOS.push({ url: String(url), cuerpo: JSON.parse(opc.body) });
  return new Response('{}', { status: 200 });
};
// ⚠️ `ctx` no existe en las pruebas si no se lo pasa, y el Worker lo usa para
// waitUntil. Acá además se guardan las promesas para poder esperarlas.
const pendientes = [];
const ctx = { waitUntil: (p) => pendientes.push(p) };
const esperarSeguimientos = async () => { await Promise.all(pendientes.splice(0)); };

async function firmar(cuerpo, ts) {
  const s = await crypto.subtle.sign(
    'Ed25519', par.privateKey, new TextEncoder().encode(ts + cuerpo));
  return hex(s);
}

async function pedir(objeto, { romperFirma = false, romperCuerpo = false,
                               seguido = false } = {}) {
  // `seguido` = sin dejar pasar tiempo, o sea a propósito contra el freno.
  RELOJ += seguido ? 5 : 60000;
  const cuerpo = JSON.stringify(objeto);
  const ts = String(Math.floor(Date.now() / 1000));
  let sig = await firmar(cuerpo, ts);
  if (romperFirma) sig = sig.replace(/^../, sig.startsWith('00') ? '11' : '00');
  // ⚠️ El caso que importa: firma válida para OTRO cuerpo. Es exactamente lo
  // que pasa si alguien parsea y vuelve a serializar antes de verificar.
  const enviado = romperCuerpo ? cuerpo.replace('}', ' }') : cuerpo;
  const r = await worker.fetch(new Request('https://x/', {
    method: 'POST',
    headers: { 'x-signature-ed25519': sig, 'x-signature-timestamp': ts },
    body: enviado,
  }), env, ctx);
  let cuerpoResp = null;
  try { cuerpoResp = JSON.parse(await r.clone().text()); } catch { /* texto */ }
  return { status: r.status, json: cuerpoResp };
}

// ── Las pruebas ───────────────────────────────────────────────────────────
let mal = 0;
const ok = (nombre, cond, detalle = '') => {
  console.log(`  ${cond ? '✅' : '❌'}  ${nombre}${detalle ? '   ' + detalle : ''}`);
  if (!cond) mal++;
};

console.log('\nEL WORKER, SIN DISCORD Y SIN CLOUDFLARE\n');

{
  const r = await pedir({ type: 1 });
  ok('un PING firmado devuelve PONG', r.status === 200 && r.json?.type === 1,
     `status ${r.status}, type ${r.json?.type}`);
}
{
  const r = await pedir({ type: 1 }, { romperFirma: true });
  ok('una firma INVÁLIDA devuelve 401', r.status === 401,
     `status ${r.status}` + (r.status === 200
       ? '  ← Discord rechaza la URL aunque el PONG esté bien' : ''));
}
{
  const r = await pedir({ type: 1 }, { romperCuerpo: true });
  ok('firma válida para OTRO cuerpo devuelve 401', r.status === 401,
     `status ${r.status}` + (r.status === 200
       ? '  ← es el bug de parsear antes de verificar' : ''));
}
{
  const r = await worker.fetch(new Request('https://x/', {
    method: 'POST', body: '{"type":1}',
  }), env);
  ok('sin cabeceras de firma devuelve 401', r.status === 401, `status ${r.status}`);
}
{
  const r = await pedir({
    type: 2, guild_id: '123456789', data: { name: 'ping' },
  });
  const d = r.json?.data;
  ok('/ping contesta un mensaje', r.status === 200 && r.json?.type === 4);
  ok('/ping es EFÍMERO', (d?.flags & (1 << 6)) !== 0,
     `flags ${d?.flags}` + (d?.flags ? '' : '  ← lo vería todo el canal'));
  ok('/ping nombra el servidor', (d?.content || '').includes('123456789'));
}
{
  const r = await pedir({ type: 2, data: { name: 'noexiste' } });
  ok('un comando desconocido no revienta', r.status === 200 && r.json?.type === 4);
}
{
  const r = await worker.fetch(new Request('https://x/'), env);
  ok('GET responde algo legible', r.status === 200);
}

// ── /card y los componentes ───────────────────────────────────────────────
const V2 = 1 << 15, EF = 1 << 6;
const galeria = (c) => (c || []).find(x => x.type === 12);
const filas   = (c) => (c || []).filter(x => x.type === 1);
// ⚠️ LOS BOTONES DE CARTA SON LOS QUE TIENEN `custom_id`. En la misma fila
// va la campana de avisos, que es un link (estilo 5) y no una carta: si se
// contara, «son cuatro botones» daría cinco y «todos apagados» mentiría,
// porque un link no vence y no se apaga.
const filaBotones = (c) => filas(c).find(f => f.components[0].type === 2);
const botones = (c) => { const f = filaBotones(c);
                         return f ? f.components.filter(b => b.custom_id) : []; };
const campana = (c) => { const f = filaBotones(c);
                         return f ? f.components.find(b => b.style === 5) : null; };
const select  = (c) => { const f = filas(c).find(f => f.components[0].type === 3);
                         return f ? f.components[0] : null; };

console.log('\nLA CARTA\n');

{
  const r = await pedir({ type: 2, guild_id: '1', member: { user: { id: '999111' } },
    data: { name: 'card', options: [{ name: 'nombre', value: 'Konan' }] } });
  const d = r.json?.data, c = d?.components;
  ok('/card contesta', r.status === 200 && r.json?.type === 4);
  // ⚠️ Sin este flag Discord ignora `components` y manda un mensaje vacío.
  ok('lleva el flag Components V2', (d?.flags & V2) !== 0, `flags ${d?.flags}`);
  // ⚠️ LA CARTA ES PUBLICA desde el 17/09/2026: la ve todo el canal.
  ok('la carta NO es efímera', (d?.flags & EF) === 0, `flags ${d?.flags}`);
  // ⚠️ El flag V2 DESACTIVA content y embeds: si van, Discord rechaza el body.
  ok('NO manda content ni embeds', !d?.content && !d?.embeds,
     (d?.content || d?.embeds) ? '← el flag V2 los prohíbe' : '');
  ok('trae una galería con la imagen', !!galeria(c)?.items?.[0]?.media?.url,
     galeria(c)?.items?.[0]?.media?.url || '');
  // ⚠️ ABRE EN LA SERVIDOR AUNQUE TENGA LA COMPETITIVA. Konan tiene 95
  // eventos, o sea que el 16/09 esto abría en Competitivo. Dlx lo cambió el
  // 17/09: la Servidor es la default para todos, siempre.
  ok('abre SIEMPRE en la Servidor', (galeria(c)?.items?.[0]?.media?.url || '').includes('/servidor.webp'),
     galeria(c)?.items?.[0]?.media?.url || '');
  ok('son cuatro botones', botones(c).length === 4);
  const act = botones(c).filter(b => b.disabled);
  ok('exactamente UNO apagado', act.length === 1, act.map(b=>b.label).join());
  ok('el apagado es el de la carta activa', act[0]?.label === 'Servidor');
  ok('el apagado va GRIS (estilo 2)', act[0]?.style === 2, `estilo ${act[0]?.style}`);
  ok('los otros tres NO son grises', botones(c).filter(b=>!b.disabled).every(b=>b.style===1),
     'si todos fueran grises, la única diferencia sería la opacidad');
  ok('y con la Servidor activa VIENE el menú', select(c) !== null);
  // 🔔 decidido el 21/09: el permiso se pide donde ya están
  const cp = campana(c);
  ok('abajo va la campana de avisos', !!cp, cp ? cp.label : 'no está');
  ok('y es un LINK al hub, no un botón que gaste interacción',
     cp?.type === 2 && cp?.style === 5 && !cp?.custom_id &&
     cp?.url === 'https://underlegends.pages.dev/#/avisos', cp?.url || '');
  ok('la fila no pasa de cinco', (filaBotones(c)?.components || []).length <= 5);
}

{
  // Una carta que NO es la Servidor: ahí el menú no va
  const r = await pedir({ type: 3, guild_id: G.FFA, data: { custom_id: 'c:konan:pais:999111' },
    member: { user: { id: '999111' } } });
  ok('SIN menú en las otras tres', select(r.json?.data?.components) === null);
}

{
  // Clickear el botón Servidor
  const r = await pedir({ type: 3, guild_id: G.FFA, data: { custom_id: 'c:konan:servidor:999111' }, member: { user: { id: '999111' } } });
  const c = r.json?.data?.components;
  // ⚠️ tipo 7 = pisa el MISMO mensaje. Con tipo 4 saldría uno nuevo cada click.
  ok('el botón contesta con ACTUALIZAR (7)', r.json?.type === 7, `type ${r.json?.type}`);
  ok('ahora SÍ aparece el menú', select(c) !== null);
  ok('el menú va en su propia fila', filas(c).length === 2,
     'un select no comparte Action Row con botones');
  ok('lista los nueve servidores', select(c)?.options?.length === 9,
     `${select(c)?.options?.length}`);
  // ⚠️ EL «BLOQUEADA» VOLVIÓ, PERO SIGNIFICA OTRA COSA. El del 16/09 era un
  // requisito de eventos y se saco porque mentia. El de ahora (Dlx, 19/09)
  // dice simplemente que ESA PERSONA no tiene carta de ese servidor — que es
  // verdad y es el dato que el que mira necesita.
  ok('los que NO tienen carta dicen BLOQUEADA',
     select(c)?.options?.filter(o => !/^(TWR)$/.test(o.value))
       .every(o => o.label.includes('BLOQUEADA')) === true,
     select(c)?.options?.map(o=>o.label).join(' · '));
  ok('y el que SÍ tiene carta no lo dice',
     !select(c)?.options?.find(o=>o.value==='TWR')?.label.includes('BLOQUEADA'));
  ok('tampoco queda el texto del requisito de eventos',
     select(c)?.options?.every(o => !/Te falta/.test(o.description)) === true);
  // ⚠️ YA NO SE DICE «Tu servidor». Dlx, 19/09/2026: eliminar que una persona
  // «sea» de un servidor — el sv salia del argmax de las 7 columnas y le
  // asignaba Fontana a alguien que solo jugo en DRA.
  ok('NINGUNA opción dice «Tu servidor»',
     select(c)?.options?.every(o => !/Tu servidor/.test(o.description || '')) === true);
  ok('pero donde estás parado sí se marca, aunque esté bloqueada',
     select(c)?.options?.find(o=>o.value==='FFA')?.description?.startsWith('Estás acá'),
     select(c)?.options?.find(o=>o.value==='FFA')?.description);
  ok('el servidor actual va marcado', select(c)?.options?.filter(o=>o.default).length === 1);
  // ⚠️ TWR es el servidor de Konan -> va su carta real
  ok('en SU servidor va su carta real', (galeria(c)?.items?.[0]?.media?.url||'').includes('/konan/servidor.webp'),
     galeria(c)?.items?.[0]?.media?.url || '');
}

// ── El servidor de donde te convocaron ────────────────────────────────────
console.log('\nDE DÓNDE TE CONVOCARON\n');

{
  // ⚠️ Konan es de TWR. En FFA, y con las cartas por servidor ya subidas, su
  // /card tiene que abrir en FFA: es la regla de Dlx del 17/09.
  META.svs = ['FFA'];
  const r = await pedir({ type: 2, guild_id: G.FFA, member: { user: { id: '999111' } },
    data: { name: 'card' } });
  const c = r.json?.data?.components;
  const u = galeria(c)?.items?.[0]?.media?.url || '';
  ok('en FFA abre en la carta de FFA', u.includes('/konan/sv-ffa.webp'), u);
  ok('y el menú marca FFA', select(c)?.options?.find(o=>o.default)?.value === 'FFA');
  META.svs = [];
}
{
  // ⚠️ Y SIN ESAS CARTAS CAE EN LA PROPIA, que es la única que existe hoy en
  // R2. Sin esta pregunta el menú devolvería una URL que no está: Discord
  // muestra un hueco y no avisa.
  const r = await pedir({ type: 2, guild_id: G.FFA, member: { user: { id: '999111' } },
    data: { name: 'card' } });
  const u = galeria(r.json?.data?.components)?.items?.[0]?.media?.url || '';
  ok('sin esas cartas todavía, cae en la propia', u.includes('/konan/servidor.webp'), u);
}
{
  // Un servidor que no es de la Liga (alguien metió el bot en el suyo)
  const r = await pedir({ type: 2, guild_id: G.AJENO, member: { user: { id: '999111' } },
    data: { name: 'card' } });
  const u = galeria(r.json?.data?.components)?.items?.[0]?.media?.url || '';
  ok('en un servidor ajeno usa el tuyo', u.includes('/konan/servidor.webp'), u);
}

// ── Elegir un servidor donde no estás ─────────────────────────────────────
console.log('\nLA INVITACIÓN\n');

{
  // ⚠️ SIN LINK CARGADO NO SE MANDA NINGUNA INVITACIÓN, y eso es lo primero
  // que hay que fijar: hoy `datos/servidores.json` los tiene todos vacíos.
  // La primera versión contestaba «todavía no tengo el link, pedíselo a un
  // admin», que el que lo lee no puede accionar — o sea ruido, en CADA
  // cambio de servidor.
  const r = await pedir({ type: 3, guild_id: G.FFA, application_id: 'app', token: 'tok',
    data: { custom_id: 's:konan::999111', values: ['DRA'] }, member: { user: { id: '999111' } } });
  const t = r.json?.data?.content || '';
  ok('sin link cargado no promete nada', !/invitaci|admin/.test(t), t.slice(0, 48));
  ok('pero sí dice que la carta no está', /no tengo tu carta/.test(t), t.slice(0, 48));
}
{
  // ⚠️ CON el link cargado, la invitación ES la respuesta cuando no hay carta.
  // ⚠️ SE GUARDA LO QUE HABIA, no se restaura a ''. La primera versión dejaba
  // los dos en cadena vacía al terminar, y el día que la tabla tuvo links de
  // verdad la prueba de que las dos copias coinciden empezó a fallar — por
  // culpa de esta prueba, no de una deriva. Un test que ensucia el módulo
  // tiene que dejarlo como estaba, no como cree que estaba.
  const { SERVIDORES } = await import('./worker.js');
  ORIGINAL_INVITA = SERVIDORES.map(s => s.invita);
  SERVIDORES.find(s => s.sv === 'DRA').invita = 'https://discord.gg/prueba';
  SERVIDORES.find(s => s.sv === 'SR').invita = 'https://discord.gg/prueba2';
  const r = await pedir({ type: 3, guild_id: G.FFA, application_id: 'app', token: 'tok',
    data: { custom_id: 's:konan::999111', values: ['DRA'] }, member: { user: { id: '999111' } } });
  const d = r.json?.data;
  ok('elegir un servidor sin carta NO pisa el mensaje', r.json?.type === 4,
     `type ${r.json?.type}` + (r.json?.type === 7 ? '  ← borraría la carta pública' : ''));
  ok('y contesta con la invitación', /Entrá por acá/.test(d?.content || ''),
     (d?.content || '').slice(0, 48));
  // ⚠️ EL LINK VIVE EN EL BOTÓN, NO EN EL TEXTO, desde el 18/09/2026. Se
  // comprueba la forma entera —estilo 5, con `url` y SIN `custom_id`— porque
  // un botón de link mal armado no falla al mandarse: Discord lo rechaza, el
  // aviso no llega, y desde acá parecería que la invitación simplemente no se
  // envió. Con `custom_id` además Discord esperaría una respuesta que nadie
  // va a dar, y la persona vería «esta interacción falló».
  const bs = (d?.components || []).flatMap(f => f.components || []);
  const link = bs.find(b => (b.url || '').includes('discord.gg/prueba'));
  ok('lleva el link, y en un botón', !!link, bs.map(b => b.label).join(' · '));
  // ⚠️ Y SOLO SI LA CARTA ES TUYA. Dlx, 19/09/2026: miraba la carta de Sombra,
  // elegia FRZ y el bot le decia «¿no estás adentro? entrá por acá» — a ÉL,
  // que sí está. El que no está en FRZ es Sombra. Le hablaba al equivocado.
  {
    const r2 = await pedir({ type: 3, guild_id: G.FFA, application_id: 'app', token: 'tok',
      data: { custom_id: 's:konan::777222', values: ['DRA'] },
      member: { user: { id: '777222' } } });   // 777222 NO es konan
    const c2 = r2.json?.data?.content || '';
    const b2 = (r2.json?.data?.components || []).flatMap(f => f.components || []);
    ok('mirando la carta de OTRO, no te invitan a vos',
       !/Entrá por acá/.test(c2) && !b2.some(b => (b.url || '').includes('discord.gg/')),
       c2.slice(0, 60));
    ok('y dice de quién es la carta que falta', /Konan/.test(c2) && /DRA/.test(c2),
       c2.slice(0, 60));
  }
  ok('el botón es de link y no pide respuesta',
     link?.style === 5 && link?.type === 2 && !link?.custom_id,
     `style ${link?.style}  custom_id ${link?.custom_id ?? '(ninguno)'}`);
  ok('la invitación es efímera', (d?.flags & EF) !== 0);
  ok('nombra el servidor', (d?.content || '').includes('DRA'));
}
{
  // ⚠️ NO SE INVITA A DONDE YA ESTÁS, aunque la carta todavía no exista.
  // Pasó en la primera prueba real: elegir FFA parado en FFA contestaba
  // «¿no estás adentro? entrá por acá». La falta de CARTA y la falta de
  // PERTENENCIA son dos cosas distintas y caían en la misma rama.
  const r = await pedir({ type: 3, guild_id: G.FFA, application_id: 'app', token: 'tok',
    data: { custom_id: 's:konan::999111', values: ['FFA'] }, member: { user: { id: '999111' } } });
  const t = r.json?.data?.content || '';
  ok('sin carta pero estando ahí, NO invita', !/Entrá por acá|invitaci/.test(t),
     t.slice(0, 48));
  ok('y dice que la está generando', /generando/.test(t), t.slice(0, 48));
}
{
  // Lo mismo con tu propio servidor: si tu carta dice TWR, estás en TWR.
  const r = await pedir({ type: 3, guild_id: G.FFA, application_id: 'app', token: 'tok',
    data: { custom_id: 's:konan::999111', values: ['TWR'] }, member: { user: { id: '999111' } } });
  ok('el propio tampoco pide invitación',
     r.json?.type === 7, `type ${r.json?.type}`);
}
{
  // ⚠️ CON la carta, van las dos cosas: la carta pisa el mensaje y la
  // invitación sale aparte, por el webhook de la interacción.
  //
  // ⚠️ EL SERVIDOR DE ESTE CASO TIENE QUE SER UNO DONDE EL BOT ESTÉ. Antes
  // era SR, y desde que la invitación exige `bot_en` eso dejó de invitar —
  // con razón: en SR el bot no puede saber si la persona está adentro. Se usa
  // FFA, y se pide parado en DRA para que `sv !== aqui`.
  META.svs = ['SR', 'FFA'];
  SEGUIMIENTOS = [];
  const r = await pedir({ type: 3, guild_id: G.DRA, application_id: 'app', token: 'tok',
    data: { custom_id: 's:konan::999111', values: ['FFA'] }, member: { user: { id: '999111' } } });
  await esperarSeguimientos();
  const c = r.json?.data?.components;
  ok('con carta, el menú sí actualiza (7)', r.json?.type === 7);
  ok('muestra la carta de ESE servidor',
     (galeria(c)?.items?.[0]?.media?.url||'').includes('/sv-ffa.webp'),
     galeria(c)?.items?.[0]?.media?.url || '');
  ok('el botón Servidor sigue apagado',
     botones(c).find(b=>b.label==='Servidor')?.disabled === true);
  ok('y la invitación sale por separado', SEGUIMIENTOS.length === 1,
     `${SEGUIMIENTOS.length} mensaje(s)`);
  ok('va al webhook de la interacción, no a la API con token de bot',
     (SEGUIMIENTOS[0]?.url || '').includes('/webhooks/app/tok'), SEGUIMIENTOS[0]?.url);
  ok('y también es efímera', (SEGUIMIENTOS[0]?.cuerpo?.flags & EF) !== 0);
}
{
  // ⚠️ EL TUYO NO PIDE INVITACIÓN: si tu carta dice TWR, estás en TWR.
  SEGUIMIENTOS = [];
  await pedir({ type: 3, guild_id: G.FFA, application_id: 'app', token: 'tok',
    data: { custom_id: 's:konan::999111', values: ['TWR'] }, member: { user: { id: '999111' } } });
  await esperarSeguimientos();
  ok('tu propio servidor no manda invitación', SEGUIMIENTOS.length === 0);
}
{
  // ⚠️ NI DONDE ESTÁS PARADO: es el único servidor donde Discord PRUEBA que
  // estás, porque de ahí vino la interacción.
  SEGUIMIENTOS = [];
  await pedir({ type: 3, guild_id: G.FFA, application_id: 'app', token: 'tok',
    data: { custom_id: 's:konan::999111', values: ['FFA'] }, member: { user: { id: '999111' } } });
  await esperarSeguimientos();
  ok('donde ya estás tampoco', SEGUIMIENTOS.length === 0);
  META.svs = [];
  // ⚠️ SE DESHACE LO QUE ESTAS PRUEBAS LE METIERON AL MÓDULO. Los links de
  // arriba se escriben sobre el `SERVIDORES` de verdad —es el mismo objeto—,
  // así que sin esto la prueba de que las dos copias de la tabla coinciden
  // falla por culpa de una prueba, no de una deriva real. Pasó dos veces.
  const { SERVIDORES: SV } = await import('./worker.js');
  SV.forEach((s, n) => { s.invita = ORIGINAL_INVITA[n]; });
}

{
  const r = await pedir({ type: 2, guild_id: '1',
    data: { name: 'card', options: [{ name: 'nombre', value: 'NoExiste' }] } });
  ok('alguien sin cartas no revienta', r.status === 200 && r.json?.type === 4);
}

// ── KV: quien sos, y el requisito ─────────────────────────────────────────
console.log('\nLOS DATOS\n');

{
  // ⚠️ /card SIN argumento: el bot te reconoce por tu Discord ID
  const r = await pedir({ type: 2, guild_id: '1',
    member: { user: { id: '999111' } }, data: { name: 'card' } });
  const u = galeria(r.json?.data?.components)?.items?.[0]?.media?.url || '';
  ok('sin argumento te reconoce por tu Discord ID', u.includes('/konan/'), u);
}
{
  const r = await pedir({ type: 2, guild_id: '1',
    member: { user: { id: '000000' } }, data: { name: 'card' } });
  // ⚠️ SE PIDE EL CAMINO, NO LA FRASE. Lo que no puede faltar es cómo entrar:
  // desde un guild que no es de la Liga va la invitación a DRA más la URL del
  // canal. Afirmar el texto entero haría fallar la prueba por una coma.
  const c = r.json?.data?.content || '';
  ok('un ID desconocido avisa en vez de reventar', c.includes('DRA'), c.slice(0, 48));
  // ⚠️ SON DOS BOTONES Y EL ORDEN IMPORTA. El canal de verificación no se ve
  // hasta estar adentro, así que «Verificarme» antes de entrar lleva a una
  // pantalla vacía. Discord los dibuja de izquierda a derecha.
  const bs = (r.json?.data?.components || []).flatMap(f => f.components || []);
  ok('y le da los dos botones, entrar y verificarse', bs.length === 2,
     bs.map(b => b.label).join(' · '));
  ok('primero entrar, después verificarse',
     (bs[0]?.url || '').includes('discord.gg/') &&
     (bs[1]?.url || '').includes('/channels/'),
     `${bs[0]?.label} → ${bs[1]?.label}`);
}
{
  // ⚠️ EL MISMO CASO PERO PARADO EN DRA, Y TIENE QUE CONTESTAR DISTINTO. Una
  // mención `<#id>` sólo se dibuja para quien ya ve ese canal: adentro es un
  // link con el nombre del canal, y afuera sería una mención rota. Por eso
  // afuera va la URL completa. Si alguien "simplifica" el helper a un solo
  // texto, la mitad de la gente recibe algo que no se puede clickear.
  const r = await pedir({ type: 2, guild_id: G.DRA,
    member: { user: { id: '000000' } }, data: { name: 'card' } });
  const c = r.json?.data?.content || '';
  ok('parado en DRA le menciona el canal', c.includes(`<#${VERIFICA.canal}>`),
     c.slice(-50));
  const bs = (r.json?.data?.components || []).flatMap(f => f.components || []);
  ok('y le queda UN solo botón, el de verificarse', bs.length === 1,
     bs.map(b => b.label).join(' · '));
  ok('y NO le manda la invitación a donde ya está',
     !c.includes('discord.gg/') && !bs.some(b => (b.url || '').includes('discord.gg/')),
     'la interacción vino de DRA: ya está adentro');
}
{
  // ⚠️ Mingo tiene 4 eventos y Konan 95, y los dos abren igual: la Servidor
  // ya no depende de cuántos eventos tengas. Lo que cambia es el servidor.
  const r = await pedir({ type: 2, guild_id: G.AJENO,
    data: { name: 'card', options: [{ name: 'nombre', value: 'Mingo' }] } });
  const c = r.json?.data?.components;
  const u = galeria(c)?.items?.[0]?.media?.url || '';
  ok('con 4 eventos abre igual en la SERVIDOR', u.includes('/mingo/servidor.webp'), u);
  ok('y su servidor sale de KV, no del guild', select(c)?.options?.find(o=>o.default)?.value === 'DRA');
}
{
  const r = await pedir({ type: 3, guild_id: '1',
    data: { custom_id: 'c:nadie:pais:999111' }, member: { user: { id: '999111' } } });
  ok('un boton de alguien que ya no esta avisa',
     (r.json?.data?.content || '').includes('ya no está'));
}

// ── Los botones son del que pidió la carta ────────────────────────────────
console.log('\nDE QUIÉN SON LOS BOTONES\n');

{
  const r = await pedir({ type: 2, guild_id: '1', member: { user: { id: '999111' } },
    data: { name: 'card', options: [{ name: 'nombre', value: 'Konan' }] } });
  const b = botones(r.json?.data?.components)[0];
  ok('el custom_id lleva quién pidió la carta', (b?.custom_id || '').endsWith(':999111'),
     b?.custom_id || '');
  ok('y entra en los 100 chars de Discord', (b?.custom_id || '').length <= 100,
     `${(b?.custom_id || '').length} chars`);
}
{
  // ⚠️ OTRA persona clickea el botón de un mensaje público
  const r = await pedir({ type: 3, guild_id: '1', member: { user: { id: '777222' } },
    data: { custom_id: 'c:konan:pais:999111' } });
  const d = r.json?.data;
  ok('otra persona NO puede usar tus botones',
     (d?.content || '').includes('otra persona'), d?.content ? '' : 'le cambió la carta');
  // ⚠️ y el aviso SI es efímero: si no, cada click ajeno ensucia el canal
  ok('y el aviso sale efímero', (d?.flags & EF) !== 0);
  ok('el mensaje original NO se toca', r.json?.type === 4,
     `type ${r.json?.type}` + (r.json?.type === 7 ? '  ← 7 pisaría la carta ajena' : ''));
}
{
  const r = await pedir({ type: 3, guild_id: '1', member: { user: { id: '999111' } },
    data: { custom_id: 'c:konan:pais:999111' } });
  ok('el dueño sí puede', r.json?.type === 7);
}

// ── El sello que rompe la caché de Discord ────────────────────────────────
console.log('\nLA CACHE DE DISCORD\n');

{
  const r = await pedir({ type: 2, guild_id: '1', member: { user: { id: '999111' } },
    data: { name: 'card' } });
  const u = galeria(r.json?.data?.components)?.items?.[0]?.media?.url || '';
  // ⚠️ Sin esto, regenerar una carta no cambia lo que Discord muestra: cachea
  // por URL y la clave en R2 es estable a proposito. Paso el 17/09/2026.
  ok('la URL lleva el sello', u.includes('?v=202609170400'), u);
}
{
  // ⚠️ y el boton tambien: si devolviera la URL pelada, cambiar de carta
  // mostraria la version vieja cacheada
  const r = await pedir({ type: 3, guild_id: '1', member: { user: { id: '999111' } },
    data: { custom_id: 'c:konan:temporada:999111' } });
  const u = galeria(r.json?.data?.components)?.items?.[0]?.media?.url || '';
  ok('los botones también lo llevan', u.includes('?v=202609170400'), u);
}

// ── Las tres maneras de pedir una carta ───────────────────────────────────
console.log('\nTRES MANERAS DE PEDIR\n');

{
  // 1. el selector de usuarios (type 6): llega el ID, no el nombre
  const r = await pedir({ type: 2, guild_id: '1', member: { user: { id: '777222' } },
    data: { name: 'card', options: [{ name: 'quien', type: 6, value: '999111' }] } });
  const u = galeria(r.json?.data?.components)?.items?.[0]?.media?.url || '';
  ok('el selector encuentra por Discord ID', u.includes('/konan/'), u);
}
{
  // ⚠️ alguien que el bot no conoce: el selector no lo puede encontrar, y hay
  // que decirlo con el motivo, no con un "no existe" que suena a que no
  // compite. Acá NO va el link de verificación: el que lee el mensaje no es
  // el que tiene que verificarse, es quien preguntó por otro. Mandarle a él
  // la invitación sería decirle que entre a un servidor donde ya está.
  const r = await pedir({ type: 2, guild_id: '1', member: { user: { id: '777222' } },
    data: { name: 'card', options: [{ name: 'quien', type: 6, value: '555000' }] } });
  const c = r.json?.data?.content || '';
  ok('si el bot no lo conoce, lo anotó y ofrece el nombre',
     /anot/i.test(c) && c.includes('nombre:'), c.slice(0, 60));
  ok('y no le manda a ÉL la invitación, que es de otro',
     !c.includes('discord.gg/'), c.slice(0, 60));
}
{
  // 2. por nombre — para esos 37 que no salen en el selector
  const r = await pedir({ type: 2, guild_id: '1', member: { user: { id: '777222' } },
    data: { name: 'card', options: [{ name: 'nombre', value: 'Konan' }] } });
  const u = galeria(r.json?.data?.components)?.items?.[0]?.media?.url || '';
  ok('por nombre también', u.includes('/konan/'), u);
}
{
  // 3. sin nada: sos vos
  const r = await pedir({ type: 2, guild_id: '1', member: { user: { id: '999111' } },
    data: { name: 'card' } });
  const u = galeria(r.json?.data?.components)?.items?.[0]?.media?.url || '';
  ok('sin argumentos, sos vos', u.includes('/konan/'), u);
}
{
  // ⚠️ El selector MANDA sobre el nombre: si alguien pone los dos, gana el ID,
  // que es el que no se puede equivocar.
  const r = await pedir({ type: 2, guild_id: '1', member: { user: { id: '777222' } },
    data: { name: 'card', options: [
      { name: 'quien', type: 6, value: '999111' },
      { name: 'nombre', value: 'Mingo' }] } });
  const u = galeria(r.json?.data?.components)?.items?.[0]?.media?.url || '';
  ok('con los dos, manda el selector', u.includes('/konan/'), u);
}

// ── Quien no tiene las cuatro cartas ──────────────────────────────────────
console.log(`
CUANDO FALTA UNA CARTA
`);

{
  // ⚠️ MARK NO TIENE PAIS, asi que no tiene carta de Pais: «sin dato no hay
  // pieza». El Worker construye la URL con el nombre y no consulta nada, asi
  // que le dibujaba el boton igual y al apretarlo salia un hueco — Discord no
  // avisa de una imagen que no carga.
  const r = await pedir({ type: 2, guild_id: G.FFA, member: { user: { id: '999111' } },
    data: { name: 'card', options: [{ name: 'nombre', value: 'Mark' }] } });
  const c = r.json?.data?.components;
  const et = botones(c).map(b => b.label);
  ok('a Mark no se le dibuja el boton de Pais', !et.includes('País'), et.join(' · '));
  ok('y si los otros tres', et.length === 3, `${et.length}`);
}
{
  // Un boton viejo, de un mensaje que sigue en el canal, pidiendo esa carta
  const r = await pedir({ type: 3, guild_id: G.FFA, member: { user: { id: '999111' } },
    data: { custom_id: 'c:mark:pais:999111' } });
  ok('un boton viejo a una carta que no esta, avisa', r.json?.type === 4,
     `type ${r.json?.type}`);
  ok('y no pisa el mensaje con un hueco',
     /no tiene carta/.test(r.json?.data?.content || ''),
     (r.json?.data?.content || '').slice(0, 44));
}
{
  // Konan si las tiene: el `cs` ausente vale por "las cuatro" (KV viejo)
  const r = await pedir({ type: 2, guild_id: G.FFA, member: { user: { id: '999111' } },
    data: { name: 'card' } });
  ok('sin `cs` en KV se asume que estan las cuatro',
     botones(r.json?.data?.components).length === 4);
}
{
  // 🔴 EL OTRO LADO DE LO MISMO: `cs: []` presente y vacio. Es quien se
  // acaba de verificar —entra a KV apenas pasa el porton, sus PNG salen
  // en el ciclo siguiente— y sin esta rama se le manda la URL de una
  // carta que no existe: cuadro roto y cero botones, porque `tiene()`
  // los apaga todos.
  const r = await pedir({ type: 2, guild_id: G.FFA, member: { user: { id: '999666' } },
    data: { name: 'card' } });
  const txt = r.json?.data?.content || '';
  ok('con `cs: []` se dice que espere, no se manda una imagen rota',
     /todav[ií]a no est[aá]n dibujadas/i.test(txt), txt.slice(0, 52));
  ok('y no es «no existís»: dice que YA está en la Liga',
     /ya est[aá]s en la liga/i.test(txt), txt.slice(0, 52));
}

// ── La tabla de servidores está en dos lugares ────────────────────────────
console.log(`
LOS BOTONES SE APAGAN SOLOS
`);

// Un mensaje como el que manda Discord en cada click, con su última edición.
// ⚠️ Los componentes son los de VERDAD: el Worker lee de ahí qué carta se está
// viendo y qué servidor está elegido, así que una prueba con componentes
// inventados no probaría el camino que corre en producción.
const mensajeDe = (d, hace) => ({
  id: '1234567890123456789',
  edited_timestamp: new Date(RELOJ - hace).toISOString(),
  components: d?.components || [],
});

{
  // Se pide una carta para tener sus componentes de verdad
  const r0 = await pedir({ type: 2, guild_id: G.FFA, member: { user: { id: '999111' } },
    data: { name: 'card' } });
  const comps = r0.json?.data;

  // ── recién tocada: sigue andando ──────────────────────────────────────
  const vivo = await pedir({ type: 3, guild_id: G.FFA, application_id: 'app', token: 'tok',
    member: { user: { id: '999111' } },
    message: mensajeDe(comps, 2 * 60 * 1000),
    data: { custom_id: 'c:konan:pais:999111' } });
  ok('tocada hace 2 min: los botones andan', vivo.json?.type === 7);
  ok('y no apaga nada', botones(vivo.json?.data?.components).filter(b => b.disabled).length === 1,
     'sólo la que estás viendo va gris');

  // ── quieta hace media hora: se apaga ──────────────────────────────────
  SEGUIMIENTOS = [];
  const muerto = await pedir({ type: 3, guild_id: G.FFA, application_id: 'app', token: 'tok',
    member: { user: { id: '999111' } },
    message: mensajeDe(comps, 30 * 60 * 1000),
    data: { custom_id: 'c:konan:pais:999111' } });
  await esperarSeguimientos();
  const bs = botones(muerto.json?.data?.components);
  ok('quieta hace 30 min: contesta ACTUALIZAR', muerto.json?.type === 7);
  ok('TODOS los botones quedan apagados', bs.length > 0 && bs.every(b => b.disabled),
     `${bs.filter(b => b.disabled).length} de ${bs.length}`);
  ok('y el menú también', select(muerto.json?.data?.components)?.disabled === true);
  ok('el porqué sale aparte y efímero', SEGUIMIENTOS.length === 1 &&
     (SEGUIMIENTOS[0]?.cuerpo?.flags & EF) !== 0);
  ok('lo dice con palabras', /apagué los botones/.test(SEGUIMIENTOS[0]?.cuerpo?.content || ''),
     (SEGUIMIENTOS[0]?.cuerpo?.content || '').slice(0, 40));

  // ⚠️ REDIBUJA LA QUE SE ESTABA VIENDO, NO LA DEL BOTÓN. El custom_id dice a
  // dónde querías ir; apagar tiene que dejar el mensaje como estaba.
  const u = galeria(muerto.json?.data?.components)?.items?.[0]?.media?.url || '';
  ok('redibuja la carta que se veía, no la del botón', u.includes('/servidor.webp'),
     u.split('/').slice(-2).join('/'));
}
{
  // ⚠️ SIN `message` NO SE APAGA. No poder medir la inactividad no es lo mismo
  // que estar inactiva: apagar por no saber seria romper lo que funciona.
  const r = await pedir({ type: 3, guild_id: G.FFA, member: { user: { id: '999111' } },
    data: { custom_id: 'c:konan:pais:999111' } });
  ok('sin datos del mensaje, no vence', r.json?.type === 7,
     'la carta sigue andando');
}
{
  // El reloj se reinicia con cada click que prospera, no con la edad del
  // mensaje: un mensaje viejo recien tocado sigue vivo.
  const r0 = await pedir({ type: 2, guild_id: G.FFA, member: { user: { id: '999111' } },
    data: { name: 'card' } });
  const r = await pedir({ type: 3, guild_id: G.FFA, member: { user: { id: '999111' } },
    message: { id: '900000000000000000',             // creado en 2021
               edited_timestamp: new Date(RELOJ - 1000).toISOString(),
               components: r0.json?.data?.components || [] },
    data: { custom_id: 'c:konan:temporada:999111' } });
  ok('mide INACTIVIDAD, no la edad del mensaje', r.json?.type === 7,
     'un mensaje de 2021 recién tocado sigue vivo');
}

console.log('\nLOS DOS SERVIDORES.JSON\n');

{
  // ⚠️ ES LA FORMA QUE MÁS VECES ROMPIÓ ESTE PROYECTO: la decisión existe en
  // un lugar y el código la lee de otro. Acá no se puede evitar la copia —un
  // Worker no lee archivos del repo— así que lo que se puede es que **avise**.
  const { readFileSync } = await import('node:fs');
  const { SERVIDORES } = await import('./worker.js');
  const disco = JSON.parse(readFileSync(
    new URL('../datos/servidores.json', import.meta.url), 'utf8')).servidores;

  const enDisco = Object.keys(disco).sort();
  const enWorker = SERVIDORES.map(s => s.sv).sort();
  ok('los mismos servidores en los dos', enDisco.join() === enWorker.join(),
     enDisco.join() === enWorker.join() ? `${enDisco.length}`
       : `disco: ${enDisco.join()}  ·  worker: ${enWorker.join()}`);

  const distintos = SERVIDORES.filter(s => disco[s.sv] && (
    disco[s.sv].guild_id !== s.guild ||
    disco[s.sv].invitacion !== s.invita ||
    disco[s.sv].nombre !== s.nombre));
  ok('y con los mismos guild, nombre e invitación', distintos.length === 0,
     distintos.map(s => s.sv).join());

  // ⚠️ EL CANAL DE VERIFICACIÓN ES LA MISMA COPIA Y EL MISMO RIESGO. Si se
  // separan, el bot manda a la gente a un canal que ya no es, y eso no falla
  // en ningún lado: la mención sale rota y nadie se entera de este lado.
  const { canales } = JSON.parse(readFileSync(
    new URL('../datos/servidores.json', import.meta.url), 'utf8'));
  const { VERIFICA } = await import('./worker.js').then(m => ({
    VERIFICA: m.VERIFICA }));
  // `canalDisco` y no `enDisco`: ese nombre ya está tomado unas líneas arriba
  // por la lista de servidores, y en el mismo bloque.
  const canalDisco = ((canales || {})[VERIFICA.sv] || {}).verificacion;
  const msjDisco = ((canales || {})[VERIFICA.sv] || {}).verificacion_mensaje;
  ok('el canal de verificación es el mismo en los dos',
     canalDisco === VERIFICA.canal,
     `disco: ${canalDisco}  ·  worker: ${VERIFICA.canal}`);
  ok('y el mensaje también', msjDisco === VERIFICA.mensaje,
     `disco: ${msjDisco}  ·  worker: ${VERIFICA.mensaje}`);

  // ⚠️ LOS DOS ID SON DISTINTOS, Y CONFUNDIRLOS YA COSTÓ UNA VUELTA. Si
  // alguien vuelve a pegar el link del mensaje en el campo del canal, la
  // mención `<#...>` sale rota para todos los que están en DRA — que es
  // justamente donde más se va a leer.
  ok('y no son el mismo número', VERIFICA.canal !== VERIFICA.mensaje,
     'el del mensaje en el campo del canal rompe la mención');
}

// ── El freno al spam ──────────────────────────────────────────────────────
console.log('\nEL FRENO AL SPAM\n');

{
  // ⚠️ Se usa un ID nuevo en cada bloque porque el freno cuenta POR PERSONA:
  // con uno compartido, lo que mide la prueba es el orden del archivo.
  const YO = '424242';
  const tiros = [];
  for (let k = 0; k < 6; k++) {
    tiros.push(await pedir({ type: 2, guild_id: G.FFA, member: { user: { id: YO } },
      data: { name: 'card', options: [{ name: 'nombre', value: 'Konan' }] } },
      { seguido: true }));
  }
  const pasaron = tiros.filter(r => r.json?.type === 4 &&
    !/Pará un poco/.test(r.json?.data?.content || '')).length;
  ok('/card seguido se corta a las cuatro', pasaron === 4, `pasaron ${pasaron} de 6`);
  const frenado = tiros[5];
  ok('y el quinto avisa cuánto falta',
     /Pará un poco/.test(frenado.json?.data?.content || ''),
     (frenado.json?.data?.content || '').slice(0, 40));
  ok('el aviso dice los segundos', /\*\*\d+ s\*\*/.test(frenado.json?.data?.content || ''));
  ok('y es efímero', (frenado.json?.data?.flags & EF) !== 0,
     'si no, el freno al spam sería spam');
}
{
  // ⚠️ SI SE DEJA PASAR LA VENTANA, VUELVE A ANDAR. Un freno que no se
  // suelta es una expulsión, y esto tiene que molestar sólo mientras dura.
  const YO = '424243';
  for (let k = 0; k < 6; k++) {
    await pedir({ type: 2, guild_id: G.FFA, member: { user: { id: YO } },
      data: { name: 'card' } }, { seguido: true });
  }
  const r = await pedir({ type: 2, guild_id: G.FFA, member: { user: { id: YO } },
    data: { name: 'card', options: [{ name: 'nombre', value: 'Konan' }] } });
  ok('pasado el minuto vuelve a andar',
     !/Pará un poco/.test(r.json?.data?.content || ''),
     (r.json?.data?.content || '').slice(0, 40));
}
{
  // ⚠️ EL BOTÓN TIENE LA MANO MÁS SUELTA, y no es arbitrario: contesta con
  // ACTUALIZAR, así que pisa el mismo mensaje y el canal no crece. El que
  // ensucia es `/card`, que crea uno público cada vez.
  const YO = '424244';
  const tiros = [];
  for (let k = 0; k < 12; k++) {
    tiros.push(await pedir({ type: 3, guild_id: G.FFA, member: { user: { id: YO } },
      data: { custom_id: `c:konan:temporada:${YO}` } }, { seguido: true }));
  }
  const pasaron = tiros.filter(r => r.json?.type === 7).length;
  ok('los clicks se cortan a los diez', pasaron === 10, `pasaron ${pasaron} de 12`);
  // ⚠️ Y EL FRENO NO PISA LA CARTA. Con tipo 7 el castigo por apurarse sería
  // borrarle la carta a quien la pidió, que es lo contrario de lo que hace falta.
  ok('el freno NO toca el mensaje público', tiros[11].json?.type === 4,
     `type ${tiros[11].json?.type}`);
}
{
  // ⚠️ EL FRENO ES POR PERSONA. Si fuera global, el primero que se entusiasma
  // deja sin bot a todo el servidor — y con ocho servidores, a toda la Liga.
  const A = '424245', B = '424246';
  for (let k = 0; k < 6; k++) {
    await pedir({ type: 2, guild_id: G.FFA, member: { user: { id: A } },
      data: { name: 'card' } }, { seguido: true });
  }
  const r = await pedir({ type: 2, guild_id: G.FFA, member: { user: { id: B } },
    data: { name: 'card', options: [{ name: 'nombre', value: 'Konan' }] } },
    { seguido: true });
  ok('frenar a uno no frena a los demás',
     !/Pará un poco/.test(r.json?.data?.content || ''));
}

// ── SE ANOTA A QUIEN EL BOT NO CONOCE ─────────────────────────────────────
// Dlx, 19/09/2026: que el ID no se pierda cuando alguien corre /card y no está
// cargado. El Worker lo deja en `reg:<id>`; un script local lo vuelca al Sheet.
console.log('\nSE ANOTA A QUIEN EL BOT NO CONOCE\n');

{
  // El caso de Lil Drako: corre /card sin argumentos, el bot no lo tiene.
  const r = await pedir({ type: 2, guild_id: G.FFA, data: { name: 'card' },
    member: { nick: '🐉 | Lil Drako',
              user: { id: '900001', username: 'lildrako', global_name: 'Drako' } } });
  await esperarSeguimientos();
  ok('al desconocido le dice que lo anotó', /anot/i.test(r.json?.data?.content || ''),
     (r.json?.data?.content || '').slice(0, 40));
  const guardado = PUESTO['reg:900001'] ? JSON.parse(PUESTO['reg:900001']) : null;
  ok('y su ID quedó en la cola `reg:`', !!guardado, guardado ? 'reg:900001' : 'no se anotó');
  ok('con su apodo del servidor, que es el que sirve para matchear',
     guardado?.nick === '🐉 | Lil Drako', guardado?.nick);
  ok('y el servidor de donde vino', guardado?.sv === 'FFA', guardado?.sv);
  // 🔑 #11 de Dlx (25/09/2026): quien se anota a sí mismo entra solo a la
  // Lista, y eso lo decide `por` — ver `sheet/registrar_ids.py`.
  ok('y que se anotó él mismo (`por: yo`)', guardado?.por === 'yo', guardado?.por);
}
{
  // Elegís en el selector a alguien que no está: SU id lo tenemos, se anota.
  const r = await pedir({ type: 2, guild_id: G.DRA,
    member: { user: { id: '999111' } },
    data: { name: 'card', options: [{ name: 'quien', type: 6, value: '900002' }],
            resolved: { users: { '900002': { id: '900002', username: 'targetguy',
                                             global_name: 'Target' } },
                        members: { '900002': { nick: '🐉 | Target' } } } } });
  await esperarSeguimientos();
  ok('al elegir a un desconocido, también se anota su id',
     !!PUESTO['reg:900002'], PUESTO['reg:900002'] ? 'reg:900002' : 'no');
  const g = PUESTO['reg:900002'] ? JSON.parse(PUESTO['reg:900002']) : {};
  ok('sale del `resolved`, no del que preguntó', g.user === 'targetguy', g.user);
  // ⚠️ buscar a alguien no es pedir entrar: a un tercero lo decide un admin
  ok('y que lo nombró otro (`por: otro`)', g.por === 'otro', g.por);
  // 🔴 y si después se anota él mismo, pasa a `yo` (auditoría del 25/09):
  // si no, no entra solo a la Lista aunque `/card` le diga que sí
  await pedir({ type: 2, guild_id: G.DRA, data: { name: 'card' },
    member: { nick: '🐉 | Target', user: { id: '900002', username: 'targetguy' } } });
  await esperarSeguimientos();
  const g2 = PUESTO['reg:900002'] ? JSON.parse(PUESTO['reg:900002']) : {};
  ok('si después se anota él mismo, la cola pasa a `por: yo`', g2.por === 'yo', g2.por);
}
{
  // ⚠️ DEDUP: un conocido NO se re-anota. Konan tiene `d:999111`.
  const antes = Object.keys(PUESTO).length;
  await pedir({ type: 2, guild_id: G.FFA, member: { user: { id: '999111' } },
    data: { name: 'card' } });
  await esperarSeguimientos();
  ok('a un conocido NO se lo anota', Object.keys(PUESTO).length === antes,
     'la cola no creció');
}
{
  // 🔴 EL QUE YA ESTA CARGADO EN EL PADRON Y NO SE VERIFICO EN DRA.
  // Desde KV se ve igual que un desconocido —los dos faltan de `p:`— y
  // hasta el 22/09/2026 se le decia «un admin te va a cargar», que es
  // prometerle algo ya hecho: puede esperar para siempre a alguien sin
  // nada que hacer. Medido con Xclusivo, el unico que quedo en la cola
  // despues de vaciarla.
  META.cargados = ['900777'];
  const antes = Object.keys(PUESTO).length;
  const r = await pedir({ type: 2, guild_id: G.FFA, member: { user: { id: '900777' } },
    data: { name: 'card' } });
  await esperarSeguimientos();
  const txt = r.json?.data?.content || '';
  ok('al que ya está cargado NO se le promete un admin',
     !/un admin te va a cargar/i.test(txt), txt.slice(0, 52));
  ok('se le dice que lo que falta es verificarse',
     /verificarte en dra/i.test(txt), txt.slice(0, 52));
  // ⚠️ Y NO SE LO ENCOLA: una cola con trabajo que no existe se deja de mirar.
  ok('y no entra a la cola `reg:`', Object.keys(PUESTO).length === antes,
     'la cola no creció');
  delete META.cargados;
}
{
  // El otro lado: sin `cargados` en meta —KV mas viejo que este codigo—
  // se hace lo de antes. Equivocarse hacia anotar de mas cuesta una
  // linea en la cola; hacia anotar de menos, perder a alguien.
  const r = await pedir({ type: 2, guild_id: G.FFA, member: { user: { id: '900778' } },
    data: { name: 'card' } });
  await esperarSeguimientos();
  ok('sin `cargados` en KV se sigue anotando como antes',
     /te anot/i.test(r.json?.data?.content || '') && !!PUESTO['reg:900778'],
     (r.json?.data?.content || '').slice(0, 40));
}

console.log('\nLOS 331 QUE NO COMPITIERON: SU CARTA SALE IGUAL\n');

// Drako corriendo /card desde donde se le pase. En un DM no hay `guild_id`.
const cardDe = (guild) => ({
  type: 2, ...(guild ? { guild_id: guild, member: { user: { id: '999222' } } }
                     : { user: { id: '999222' } }),
  data: { name: 'card' },
});
const urlDe = (r) => {
  const c = r.json?.data?.components || [];
  const gal = c.find(x => x.type === 12);
  return gal?.items?.[0]?.media?.url || '';
};
const menuDe = (r) => {
  const c = r.json?.data?.components || [];
  const fila = c.find(x => x.type === 1 && x.components?.[0]?.type === 3);
  return fila?.components?.[0]?.options || [];
};

{
  const r = await pedir(cardDe(G.DRA));
  ok('a quien NO compitió le sale su carta igual', /drako\/sv-dra\.webp/.test(urlDe(r)),
     urlDe(r).split('/').slice(-1)[0]);
  ok('y NUNCA `servidor.webp`, que él no tiene', !/servidor\.webp/.test(urlDe(r)),
     'con `cs:[servidor]` para el botón, deducir la URL de ahí daba un hueco');
}
{
  const r = await pedir(cardDe(G.FFA));
  ok('en FFA le sale la de FFA', /drako\/sv-ffa\.webp/.test(urlDe(r)),
     urlDe(r).split('/').slice(-1)[0]);
}
{
  // 🔴 EL CASO QUE PREGUNTÓ DLX: «en DMS cómo funcionaría, Drako qué carta
  // mostraría?». No hay `guild_id`, así que sale su `sv`, que es el PRIMERO
  // de los servidores donde está — DRA adelante, porque ahí vive la Liga.
  const r = await pedir(cardDe(null));
  ok('por mensaje directo sale la del primero donde está',
     /drako\/sv-dra\.webp/.test(urlDe(r)), urlDe(r).split('/').slice(-1)[0]);
}
{
  const r = await pedir(cardDe(G.DRA));
  const op = menuDe(r);
  const libres = op.filter(o => !/BLOQUEADA/.test(o.label)).map(o => o.value);
  ok('el menú le abre SÓLO los dos servidores que tiene',
     libres.join(',') === 'DRA,FFA', libres.join(', ') || '(ninguno)');
  ok('y los otros siete salen bloqueados', op.length - libres.length === 7,
     `${op.length - libres.length} de ${op.length}`);
}
{
  // ⚠️ `meta.svs` ESTÁ VACÍO A PROPÓSITO EN EL FIXTURE. Con 469 personas la
  // intersección se vacía de verdad, así que si el menú dependiera de ella
  // Drako no tendría NINGÚN servidor abierto. Que igual tenga dos es la
  // prueba de que la pregunta pasó a ser por persona.
  const r = await pedir(cardDe(G.DRA));
  ok('aunque `meta.svs` esté vacío, porque la pregunta es por persona',
     menuDe(r).some(o => o.value === 'DRA' && !/BLOQUEADA/.test(o.label)));
}
{
  // Y el de siempre no se rompe: Konan tiene su `servidor.webp`.
  const r = await pedir({ type: 2, guild_id: G.DRA,
                          member: { user: { id: '999111' } }, data: { name: 'card' } });
  ok('el que SÍ compitió sigue yendo a su carta propia',
     /konan\/servidor\.webp/.test(urlDe(r)), urlDe(r).split('/').slice(-1)[0]);
}

console.log('\n«NO EXISTE» Y «TODAVÍA NO» SON DOS COSAS\n');

const botonesDe = (r) => {
  const c = r.json?.data?.components || [];
  const fila = c.find(x => x.type === 1 && x.components?.[0]?.type === 2);
  return (fila?.components || []).filter(b => b.custom_id).map(b => b.label);
};

{
  const r = await pedir(cardDe(G.DRA));
  const bs = botonesDe(r);
  ok('a Drako le salen los botones de lo que TODAVÍA no tiene',
     bs.includes('Temporada') && bs.includes('Competitiva'), bs.join(' · '));
  ok('y NO el de País, que no puede tener', !bs.includes('País'),
     'sin dato no hay pieza: esa regla no cambió');
}
{
  // apretar Temporada le tiene que dar la BLOQUEADA, no un hueco
  const r = await pedir({ type: 3, guild_id: G.DRA,
                          member: { user: { id: '999222' } },
                          data: { custom_id: 'c:drako:temporada:999222' } });
  ok('y el botón lleva a la Bloqueada de ESA carta',
     /drako\/bloq-temporada\.webp/.test(urlDe(r)),
     urlDe(r).split('/').slice(-1)[0]);
}
{
  const r = await pedir({ type: 3, guild_id: G.DRA,
                          member: { user: { id: '999222' } },
                          data: { custom_id: 'c:drako:competitivo:999222' } });
  ok('cada carta tiene la suya, con su propio «cuánto falta»',
     /drako\/bloq-competitivo\.webp/.test(urlDe(r)),
     'una genérica tendría que elegir un número y mentir en el otro botón');
}
{
  // ⚠️ MARK ES EL CASO QUE NO CAMBIA: no tiene país, no tiene bloqueada de
  // País, y su botón sigue sin dibujarse.
  const r = await pedir({ type: 3, guild_id: G.DRA,
                          member: { user: { id: '999111' } },
                          data: { custom_id: 'c:mark:servidor:999111' } });
  ok('a Mark le sigue faltando el botón de País', !botonesDe(r).includes('País'),
     botonesDe(r).join(' · '));
}

console.log('\nNUNCA UNA URL QUE NO ESTÁ\n');

{
  // 🔴 SOTO SE FUE DE LOS DOS SERVIDORES después de que le dibujaran la carta:
  // `sv` vacío y una sola carta, la de DRA. Pedida desde FFA, la cadena de
  // caídas terminaba en «el servidor donde estás parado» y armaba
  // `soto/sv-ffa.webp`, que no existe. Discord no avisa de una imagen rota.
  KV_FALSO['p:soto'] = JSON.stringify({ n: 'Soto', sv: '', svp: '', cc: '',
                                        ev: 0, cs: ['servidor'], svc: ['DRA'] });
  KV_FALSO['d:999444'] = 'soto';
  const r = await pedir({ type: 2, guild_id: G.FFA,
                          member: { user: { id: '999444' } }, data: { name: 'card' } });
  ok('cae en una carta que SÍ tiene, no en la del canal',
     /soto\/sv-dra\.webp/.test(urlDe(r)), urlDe(r).split('/').slice(-1)[0]);
  ok('y nunca arma la de un servidor que no tiene',
     !/sv-ffa/.test(urlDe(r)), 'una URL de R2 que no está deja un hueco mudo');
}

console.log('\nLOS DOS NORMALIZADORES TIENEN QUE DAR LO MISMO\n');

{
  // 🔴 Python ESCRIBE las claves de KV y el Worker las BUSCA. Si no coinciden,
  // la carta existe y el bot dice que no. El caso real: **Ржунимагу**, que con
  // `[^a-z0-9]` quedaba en la cadena vacía.
  //
  // Los valores esperados salen de correr `norm()` de Python sobre los mismos
  // diez nombres — están pegados acá porque un test no puede importar Python,
  // pero si alguien toca cualquiera de los dos, esto se cae.
  const norm = (s) => String(s).normalize('NFD').toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
  const esperado = {
    'Ржунимагу': 'ржунимагу', 'Ññ': 'nn', 'Konan': 'konan',
    'Lil Drako': 'lildrako', '7': '7', 'Ac3nto': 'ac3nto',
    'José María': 'josemaria', 'MC-Arepa': 'mcarepa', '日本語': '日本語',
    'Val ⚡': 'val',
  };
  const mal = Object.entries(esperado).filter(([k, v]) => norm(k) !== v);
  ok('coinciden con los de Python en los diez casos', mal.length === 0,
     mal.map(([k, v]) => `${k}: ${norm(k)} != ${v}`).join(' · ') || '10 de 10');
  ok('un nombre sin letras ASCII no queda vacío', norm('Ржунимагу').length > 0,
     'vacío significa buscar la clave `p:` y no encontrar a nadie');
}

console.log('\nEN QUÉ CARTA ABRE /card\n');

// 🔴 LA REGLA FUE Y VOLVIÓ, así que se prueba en vez de recordarse:
//   16/09  si tiene la Competitiva desbloqueada, abre ahí
//   17/09  Dlx: la Servidor es la default para todos, siempre
//   22/09  Dlx: «servidor siempre disponible y la default… a menos
//          que competitivo esté abierto»
{
  const r = await pedir({ type: 2, guild_id: G.DRA,
                          member: { user: { id: '999333' } }, data: { name: 'card' } });
  ok('con la Competitiva abierta, abre ahí',
     /veterano\/competitivo\.webp/.test(urlDe(r)), urlDe(r).split('/').slice(-1)[0]);
}
{
  const r = await pedir({ type: 2, guild_id: G.DRA,
                          member: { user: { id: '999555' } }, data: { name: 'card' } });
  ok('sin la Competitiva, abre en la Servidor',
     /jugador\/sv-dra\.webp/.test(urlDe(r)), urlDe(r).split('/').slice(-1)[0]);
}

console.log('\nEL PUESTO EN LA CARTA DE SERVIDOR\n');

{
  // 🔴 Konan juega en TWR. Parado en TWR tiene que ver su carta PROPIA, que es
  // la única que lleva su `pos_sv` — las `sv-<código>` lo ponen en cero.
  const r = await pedir({ type: 2, guild_id: '1115145044127666196',
                          member: { user: { id: '999555' } }, data: { name: 'card' } });
  ok('en el servidor donde jugó, va su carta con puesto',
     /jugador\/servidor\.webp/.test(urlDe(r)), urlDe(r).split('/').slice(-1)[0]);
}
{
  const r = await pedir({ type: 2, guild_id: G.DRA,
                          member: { user: { id: '999555' } }, data: { name: 'card' } });
  ok('en otro servidor, la de ese servidor y sin puesto',
     /jugador\/sv-dra\.webp/.test(urlDe(r)), urlDe(r).split('/').slice(-1)[0]);
}
{
  // ⚠️ Drako no jugó en ninguno: `svp` vacío, así que NUNCA le toca
  // `servidor.webp` — que además no tiene.
  const r = await pedir(cardDe(G.DRA));
  ok('quien no jugó nunca va a `servidor.webp`', !/servidor\.webp/.test(urlDe(r)),
     urlDe(r).split('/').slice(-1)[0]);
}

console.log('\nLA INVITACIÓN: SÓLO A QUIEN NO ESTÁ\n');

// Drako: está en DRA y en FFA. Elige un servidor desde el selector.
const eligeSv = (guild, sv, uid = '999222', quien = 'drako') => ({
  type: 3, ...(guild ? { guild_id: guild, member: { user: { id: uid } } }
                     : { user: { id: uid } }),
  data: { custom_id: `s:${quien}:x:${uid}`, values: [sv] },
});
const hayInvitacion = (r) => /Entrá por acá|Entrar a/.test(JSON.stringify(r.json || {}));

{
  // 🔴 EL BUG QUE REPORTÓ DRAKO: está en FFA y le ofrecían entrar a FFA.
  const r = await pedir(eligeSv(null, 'FFA'));
  ok('a quien YA está en FFA no se le ofrece entrar', !hayInvitacion(r),
     '`g.sv` dejó de ser «tu servidor» y la pregunta quedó mal hecha');
}
{
  const r = await pedir(eligeSv(G.DRA, 'FFA'));
  ok('tampoco parado en DRA', !hayInvitacion(r));
}
{
  // ⚠️ Y AL QUE NO ESTÁ, SÍ. Konan no tiene `svs`, o sea KV viejo: se cae al
  // criterio de antes en vez de quedarse mudo.
  const r = await pedir(eligeSv(G.DRA, 'FFA', '999111', 'konan'));
  ok('con una clave de KV vieja se sigue invitando', hayInvitacion(r),
     'sin `svs` no se puede saber, y callarse sería perder la función');
}
{
  // ⚠️ EL BOT NO ESTÁ EN TWR: no sabemos si Drako está, así que no se invita.
  const r = await pedir(eligeSv(G.DRA, 'TWR'));
  ok('a un servidor donde el bot NO está, no se invita', !hayInvitacion(r),
     'ofrecerle entrar a alguien que ya entró, sin poder verificarlo');
}

console.log('\n/help — Y QUE NO SE PUEDA DESACTUALIZAR\n');

const ayuda = (cual) => ({
  type: 2, guild_id: G.DRA, member: { user: { id: '666001' } },
  data: cual ? { name: 'help', options: [{ name: 'comando', type: 3, value: cual }] }
             : { name: 'help' },
});
const txt = (r) => r.json?.data?.content || '';

{
  const r = await pedir(ayuda());
  const t = txt(r);
  ok('sin argumento lista los comandos',
     ['/card', '/numeral', '/settings', '/ping'].every(c => t.includes(c)));
  ok('y dice cómo pedir el detalle', /\/help comando:/.test(t));
  ok('es efímero', (r.json?.data?.flags & 64) === 64,
     'un manual en el canal es ruido para los demás');
}
{
  // 🔴 EL QUE IMPORTA: los números salen de KV, no del código.
  const r = await pedir(ayuda('card'));
  const t = txt(r);
  ok('la ayuda de /card saca los requisitos de `meta`',
     /1 participación/i.test(t) && /10 eventos/i.test(t), 'no están escritos en el Worker');
  ok('y si cambian en el Sheet, cambia sola', !/2 eventos/i.test(t),
     'el 19/09 la Temporada dejó de pedir 2 eventos: un texto a mano seguiría diciéndolo');
}
{
  const guardado = META.req;
  delete META.req;
  const r = await pedir(ayuda('card'));
  ok('sin `meta.req` dice que no sabe, en vez de inventar un número',
     /no pude leer/i.test(txt(r)));
  META.req = guardado;
}
{
  const r = await pedir(ayuda('numeral'));
  ok('la de /numeral explica la precedencia', /le gana/i.test(txt(r)),
     'es la parte que nadie adivina');
}
{
  const r = await pedir(ayuda('settings'));
  ok('la de /settings dice que es para admins', /admins/i.test(txt(r)));
}

console.log('\nEL «#N» DEL APODO: EL SERVIDOR DECIDE, LA PERSONA MANDA\n');

// Un `/numeral` de alguien que hoy lleva «#22 | Bloody» en el servidor que se
// le pase. El apodo viaja en `member.nick`, igual que en Discord de verdad.
const cmdPuesto = (guild, uid, valor, nick = '#22 | Bloody') => ({
  type: 2, guild_id: guild,
  member: { nick, user: { id: uid }, permissions: '0' },
  data: valor === undefined
    ? { name: 'numeral' }
    : { name: 'numeral', options: [{ name: 'mostrar', type: 5, value: valor }] },
});
const texto = (r) => r.json?.data?.content || '';
const leerNick = (g, u) => { try { return JSON.parse(PUESTO[`pnick:${g}:${u}`]); }
                             catch { return null; } };

{
  const r = await pedir({ type: 2, user: { id: '777001' }, data: { name: 'numeral' } });
  ok('por mensaje directo avisa que va adentro de un servidor',
     /adentro de un servidor/i.test(texto(r)));
}
{
  const r = await pedir(cmdPuesto(G.FFA, '777002'));
  ok('sin argumento dice cómo está', /a la vista/i.test(texto(r)));
  ok('y de dónde sale esa decisión', /servidor/i.test(texto(r)),
     'sin tocar nada, rige lo del servidor');
}
{
  const r = await pedir(cmdPuesto(G.FFA, '777003', false));
  const v = leerNick(G.FFA, '777003');
  ok('apagarlo guarda la elección con el guild adentro', !!v, 'pnick:<guild>:<id>');
  ok('y guarda `on:false`, no la sola presencia de la clave', v && v.on === false,
     'la presencia no distingue «lo apagó» de «nunca eligió»');
  ok('y se acuerda del apodo con el número', v && v.antes === '#22 | Bloody',
     'prender de nuevo necesita el número, y el Worker no tiene el ranking');
}
{
  // ⚠️ EL CASO QUE JUSTIFICA LA CLAVE POR SERVIDOR.
  const r = await pedir(cmdPuesto(G.DRA, '777003'));
  ok('apagado en FFA, en DRA sigue a la vista', /a la vista/i.test(texto(r)));
}
{
  // 🔴 EL TEXTO NOMBRABA `/puesto`, QUE NO EXISTE: el comando se llama
  // `/numeral` desde que se registró. Quien copiaba el ejemplo recibía
  // «comando desconocido» de Discord.
  const r = await pedir(cmdPuesto(G.FFA, '777004'));
  ok('el ejemplo para cambiarlo nombra un comando que existe',
     /\/numeral mostrar:/.test(texto(r)) && !/\/puesto/.test(texto(r)), texto(r).slice(-80));
}
{
  // 🔴 SIN CUPO DE KV SE DICE, Y EL APODO NO SE TOCA. El 24/09/2026 a las
  // 7 PM ET la cuota diaria se agotó y el Worker tiró 5 excepciones: una
  // escritura sin `try` es «la aplicación no respondió».
  const put = env.KV.put;
  env.KV.put = async () => { throw new Error('KV put() limit exceeded for the day.'); };
  const r = await pedir(cmdPuesto(G.FFA, '777005', false));
  env.KV.put = put;
  ok('sin cupo de KV, /numeral contesta y dice que no guardó',
     /no pude guardar tu elecci/i.test(texto(r)) && /limit exceeded/.test(texto(r)), texto(r));
  ok('y no anota nada a medias', leerNick(G.FFA, '777005') === null);
}

console.log('\nLOS TRES ESTADOS: SIN ELEGIR / PRENDIDO / APAGADO\n');

const cmdSettings = (guild, perms, uid = '888001') => ({
  type: 2, guild_id: guild,
  member: { user: { id: uid }, permissions: perms },
  data: { name: 'settings' },
});
const clickCfg = (guild, perms, cid, valores) => ({
  type: 3, guild_id: guild,
  member: { user: { id: '888001' }, permissions: perms },
  data: { custom_id: cid, ...(valores ? { values: valores } : {}) },
});
const ADMIN = '8', NADIE = '0', SOLO_ROLES = '268435456';

{
  const r = await pedir(cmdSettings(G.DRA, NADIE));
  ok('un usuario común no puede abrir /settings', /admins/i.test(texto(r)));
  ok('y se le dice qué SÍ puede hacer', /\/numeral/.test(texto(r)),
     'una negativa sin salida deja a la persona sin saber adónde ir');
}
{
  const r = await pedir(cmdSettings(G.DRA, SOLO_ROLES));
  ok('con «Gestionar roles» alcanza', /Ajustes de la Liga/.test(texto(r)));
}
{
  const r = await pedir(cmdSettings(G.DRA, ADMIN));
  ok('un admin ve el panel', /Ajustes de la Liga/.test(texto(r)));
  ok('y arranca con el #N activado', /activado/.test(texto(r)),
     'un servidor que nunca lo abrió se comporta como antes de que existiera');
  ok('los canales arrancan en «todos»', /todos/.test(texto(r)));
  ok('es efímero', (r.json?.data?.flags & 64) === 64);
}
{
  const r = await pedir(clickCfg(G.DRA, ADMIN, 'cfg:nick'));
  ok('el botón apaga el #N del servidor', /apagado/.test(texto(r)));
  ok('y PISA el mismo mensaje en vez de mandar otro', r.json?.type === 7,
     'tres ajustes dejarían tres paneles contradictorios');
}
{
  const r = await pedir(clickCfg(G.FFA, NADIE, 'cfg:nick'));
  ok('sin permiso, el click tampoco pasa', /no tenés permiso/i.test(texto(r)),
     'efímero nunca fue un control de acceso');
}
{
  // 🔴 LA REGLA DE DLX: el servidor está apagado, pero 777004 nunca eligió.
  const r = await pedir(cmdPuesto(G.DRA, '777004'));
  ok('quien NUNCA eligió sigue al servidor', /oculto/i.test(texto(r)),
     'DRA quedó apagado en el click de arriba');
}
{
  // ...y 777005 lo prende a propósito: a partir de ahí, gana él.
  await pedir(cmdPuesto(G.DRA, '777005', true));
  const r = await pedir(cmdPuesto(G.DRA, '777005'));
  ok('quien lo prendió a mano lo conserva aunque el servidor esté apagado',
     /a la vista/i.test(texto(r)), 'es lo suyo, le gana al servidor');
  ok('y el mensaje dice que es por elección suya', /vos/i.test(texto(r)));
}
{
  // ⚠️ Y PRENDERLO CUANDO YA SE VE **IGUAL SE GUARDA**: hoy se ve igual, pero
  // blinda el apodo contra un futuro apagón del servidor.
  const r = await pedir(cmdPuesto(G.FFA, '777006', true));
  const v = leerNick(G.FFA, '777006');
  ok('pedirlo cuando ya se veía igual deja constancia', v && v.on === true,
     'sin esto no habría forma de blindar el apodo antes de que lo apaguen');
}

console.log('\nLOS CANALES DONDE SE PUEDE PEDIR LA CARTA\n');

{
  await pedir(clickCfg(G.FFA, ADMIN, 'cfg:canales', ['555001', '555002']));
  const r = await pedir({ type: 2, guild_id: G.FFA, channel_id: '555999',
                          member: { user: { id: '999111' } }, data: { name: 'card' } });
  ok('en un canal no permitido, /card no sale', /Acá no/.test(texto(r)));
  ok('y dice en cuáles sí', /555001/.test(texto(r)),
     '«acá no» sin decir dónde manda a adivinar');
}
{
  const r = await pedir({ type: 2, guild_id: G.FFA, channel_id: '555001',
                          member: { user: { id: '999111' } }, data: { name: 'card' } });
  ok('en un canal permitido sale normal', r.json?.type === 4 && !texto(r));
}
{
  await pedir(clickCfg(G.FFA, ADMIN, 'cfg:canales', []));
  const r = await pedir({ type: 2, guild_id: G.FFA, channel_id: '555999',
                          member: { user: { id: '999111' } }, data: { name: 'card' } });
  ok('vaciando la lista vuelve a andar en cualquiera', r.json?.type === 4 && !texto(r),
     'sin `min_values:0` el servidor quedaba encerrado en su propia config');
}
{
  const r = await pedir(clickCfg(G.DRA, ADMIN, 'cfg:avisos', ['666777']));
  ok('el canal de avisos de rango se guarda', /666777/.test(texto(r)));
}

console.log('\nEL DISPARADOR DEL CICLO: LAS MARCAS VAN AL OBJETO, NO A KV\n');

{
  // 🔑 ERAN ~70 ESCRITURAS DE KV POR DÍA (`cron:arranco` y `cron:ultimo`
  // en cada disparo de :22 y :52), de una cuota de 1.000 que se pasó tres
  // días de siete. Ahora van al Durable Object, y KV queda de respaldo.
  const antesFetch = globalThis.fetch;
  const marcas = [];
  const kvPuestas = [];
  const envD = {
    ...env, GH_TOKEN: 'x', GH_REPO: 'a/b',
    KV: { ...env.KV, put: async (k) => { kvPuestas.push(k); } },
    AVISOS: {
      idFromName: () => 'liga',
      get: () => ({ fetch: async (url, opc) => {
        marcas.push(JSON.parse(opc.body).cual);
        return new Response('{"ok":true}', { status: 200 });
      } }),
    },
  };
  let disparos = 0;
  globalThis.fetch = async () => { disparos++; return new Response(null, { status: 204 }); };
  // 2:22 PM ET: fuera de la madrugada, así que toca ciclo
  await worker.scheduled({ cron: '22,52 * * * *', scheduledTime: Date.parse('2026-09-25T18:22:00Z') },
    envD, ctx);
  ok('dispara el ciclo', disparos === 1);
  ok('las dos marcas van al objeto', marcas.join(',') === 'arranco,ultimo', marcas.join(','));
  ok('y KV no gasta ni una escritura', kvPuestas.length === 0, kvPuestas.join(','));
  envD.AVISOS = { idFromName: () => 'liga',
    get: () => ({ fetch: async () => { throw new Error('caído'); } }) };
  await worker.scheduled({ cron: '22,52 * * * *', scheduledTime: Date.parse('2026-09-25T18:52:00Z') },
    envD, ctx);
  ok('si el objeto no contesta, las marcas caen en KV', kvPuestas.join(',') === 'cron:arranco,cron:ultimo',
     kvPuestas.join(','));
  // 🌙 5:22 AM ET es madrugada: no dispara y no marca nada
  marcas.length = 0; kvPuestas.length = 0; disparos = 0;
  await worker.scheduled({ cron: '22,52 * * * *', scheduledTime: Date.parse('2026-09-25T09:22:00Z') },
    envD, ctx);
  ok('de madrugada no dispara ni gasta', disparos === 0 && !marcas.length && !kvPuestas.length);
  globalThis.fetch = antesFetch;
}

{
  // 🔑 `/owner estado`: el sello en hora del este (antes salía UTC pelado),
  // y el último disparo del ciclo, que ahora vive en el Durable Object.
  const antes = env.AVISOS;
  env.AVISOS = {
    idFromName: () => 'liga',
    get: () => ({ fetch: async () => new Response(JSON.stringify({
      disparador: { ultimo: { t: '2026-09-25T18:22:05Z', ok: true, estado: 204 } },
    }), { status: 200 }) }),
  };
  const r = await pedir({
    type: 2, user: { id: '739338101603696681' },
    data: { name: 'owner', options: [{ name: 'estado', type: 1 }] },
  });
  env.AVISOS = antes;
  const t = r.json?.data?.content || '';
  ok('/owner estado dice el último disparo, en hora del este',
     /último disparo\s+25\/09 2:22 PM ET · ok/.test(t), t.split('\n').slice(2, 5).join(' | '));
  ok('y el sello de las cartas también en ET, no en UTC pelado',
     /cartas al día del\s+\d\d\/\d\d \d{1,2}:\d\d [AP]M ET/.test(t));
}

console.log('\nMI CUENTA CON DISCORD\n');

{
  const cuenta = async (token) => {
    const r = await worker.fetch(new Request('https://x/cuenta', {
      method: 'POST', body: JSON.stringify({ token }),
    }), env, ctx);
    return { status: r.status, json: JSON.parse(await r.text()) };
  };
  const antes = globalThis.fetch;
  let r = await cuenta('x');
  ok('un permiso con forma rara se rechaza sin preguntarle a Discord', r.status === 400);
  globalThis.fetch = async () => new Response('{"message":"401: Unauthorized"}', { status: 401 });
  r = await cuenta('permisoFalso1234567890');
  ok('uno que Discord no reconoce, también', r.status === 401 && r.json.error === 'discord');
  PUESTO['d:555000111222333444'] = 'konan';
  globalThis.fetch = async () => new Response(JSON.stringify(
    { id: '555000111222333444', username: 'konan_', global_name: 'Konan', avatar: 'abc' }), { status: 200 });
  r = await cuenta('permisoBueno1234567890');
  ok('uno bueno de alguien de la Liga devuelve su rapero', r.status === 200 &&
     r.json.rapero === 'Konan' && r.json.av === '555000111222333444/abc', JSON.stringify(r.json));
  globalThis.fetch = async () => new Response(JSON.stringify(
    { id: '999000111222333444', username: 'nadie' }), { status: 200 });
  r = await cuenta('permisoBueno1234567890');
  ok('y de alguien que no está, entra igual y sin rapero', r.status === 200 && r.json.rapero === '' &&
     r.json.n === 'nadie');
  globalThis.fetch = antes;
  delete PUESTO['d:555000111222333444'];
}

console.log('\n/WEBSITE Y /NOTIFY\n');

{
  const r = await pedir({ type: 2, guild_id: G.FFA, channel_id: '1',
                          member: { user: { id: '700900' } }, data: { name: 'website' } });
  const bots = (r.json?.data?.components || []).flatMap((f) => f.components || []);
  ok('/website deja el botón a la página', bots.some((b) => /underlegends\.pages\.dev/.test(b.url || '')),
     JSON.stringify(r.json?.data));
  const r2 = await pedir({ type: 2, guild_id: G.FFA, channel_id: '1',
                           member: { user: { id: '700901' } }, data: { name: 'notify' } });
  ok('/notify sin los avisos enchufados lo dice, no revienta', /no están andando/.test(texto(r2)), texto(r2));
  const { panelNotify } = await import('./worker.js');
  const svs = [{ sv: 'FFA', svn: 'Freestyle For All' }, { sv: 'SR', svn: 'Snake Rap' }];
  const p1 = panelNotify({ activo: false, svs: [], servidores: svs }, 'FFA');
  const b1 = p1.components.flatMap((f) => f.components);
  ok('adentro de FFA, el primer botón activa FFA', b1.some((b) => b.custom_id === 'ntf:sv:FFA'));
  const p2 = panelNotify({ activo: true, svs: [], servidores: svs }, 'FFA');
  ok('con todos activados dice «todos» y ofrece apagar', /todos los servidores/.test(p2.content) &&
     p2.components.flatMap((f) => f.components).some((b) => b.custom_id === 'ntf:off'));
  const p3 = panelNotify({ activo: false, svs: [], servidores: svs, error: 'dm' }, '');
  ok('si Discord no deja escribirle, explica cómo abrir los DMs', /Mensajes directos/.test(p3.content));
}

console.log('\n/VERIFICAR\n');

{
  const { diagnostico, banderasEn, proximaVuelta } = await import('./worker.js');
  const P = { guild: G.DRA, rol: 'MIEMBRO', paises: { R_AR: 'ar', R_US: 'us', R_CL: 'cl' },
              revisa: ['700700'] };
  ok('las banderas de un apodo, sin repetir', JSON.stringify(banderasEn('Juan 🇦🇷🔥🇦🇷')) === '["ar"]');
  const d1 = diagnostico(null, P);
  ok('fuera de DRA: nada', !d1.enDra && !d1.rol && !d1.paises.length);
  const d2 = diagnostico({ roles: ['R_AR'], user: { username: 'x' } }, P);
  ok('en DRA con rol de país y sin Miembro', d2.enDra && !d2.rol && d2.paises.join() === 'ar');
  const d3 = diagnostico({ roles: ['MIEMBRO', 'R_AR', 'R_CL'], user: {} }, P);
  ok('dos roles de país son dos', d3.rol && d3.paises.length === 2);
  const d4 = diagnostico({ roles: ['R_CL'], nick: 'Ana 🇺🇸', user: {} }, P);
  ok('Estados Unidos gana si aparece, como en pais_por_rol', d4.paises.join() === 'us');
  const d5 = diagnostico({ roles: [], nick: 'Ana 🇵🇪', user: {} }, P);
  ok('sin rol de país, la bandera del apodo', d5.paises.join() === 'pe');
  const v1 = proximaVuelta(Date.parse('2026-09-25T16:30:00Z'));   // 12:30 PM ET
  ok('de día, la vuelta de :52', v1 && v1.toISOString() === '2026-09-25T16:52:00.000Z',
     v1 && v1.toISOString());
  const v2 = proximaVuelta(Date.parse('2026-09-25T08:00:00Z'));   // 4:00 AM ET
  ok('de madrugada, la de las 6:52', v2 && v2.toISOString() === '2026-09-25T10:52:00.000Z',
     v2 && v2.toISOString());

  // el comando entero, con un miembro de mentira en DRA
  const antes = globalThis.fetch;
  const pedirVer = async (id, miembro, estado) => {
    globalThis.fetch = async (url) => (String(url).indexOf('/members/') >= 0
      ? new Response(JSON.stringify(miembro || {}), { status: estado || 200 })
      : new Response('{}', { status: 200 }));
    env.DISCORD_TOKEN = 'x';
    META.porton = P;
    try {
      return await pedir({ type: 2, guild_id: G.DRA, channel_id: '1',
                           member: { user: { id } }, data: { name: 'verificar' } });
    } finally {
      globalThis.fetch = antes;
      delete env.DISCORD_TOKEN;
      delete META.porton;
    }
  };
  let r = await pedirVer('700001', null, 404);
  ok('fuera de DRA: lo dice y ofrece entrar', /no te encuentro/.test(texto(r)), texto(r));
  r = await pedirVer('700002', { roles: [], user: { username: 'sinpais' } });
  ok('sin país: lo pide', /No encuentro tu \*\*país\*\*/.test(texto(r)), texto(r));
  r = await pedirVer('700003', { roles: ['R_AR', 'R_CL'], user: {} });
  ok('dos países: pide dejar uno', /dejá uno solo/.test(texto(r)), texto(r));
  r = await pedirVer('700004', { roles: ['R_AR'], user: {} });
  ok('completo sin Miembro: el bot se lo da, y dice cuándo',
     /te lo da el bot solo/.test(texto(r)) && /próxima vuelta arranca/.test(texto(r)), texto(r));
  await esperarSeguimientos();
  ok('y lo anota en la cola, para que esa vuelta lo encuentre', !!PUESTO['reg:700004']);
  r = await pedirVer('700700', { roles: ['R_AR'], user: {} });
  ok('a quien revisa un admin no se le promete el rol', /lo revisa un admin/.test(texto(r)), texto(r));
  r = await pedir({ type: 2, guild_id: G.DRA, channel_id: '1',
                    member: { user: { id: '700005' } }, data: { name: 'verificar' } });
  ok('sin token ni portón, hace lo de /card: anota y explica', /Ya te anoté/.test(texto(r)), texto(r));
}

console.log(mal ? `\n${mal} fallo(s)\n` : '\nTodo bien: la firma es lo único que hay que probar contra Discord.\n');
process.exit(mal ? 1 : 0);
