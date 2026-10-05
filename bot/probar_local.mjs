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
// el número de la app de Discord: `discordDe()` sólo acepta permisos suyos (revisión del 03/10/2026)
import { APP_ID } from './avisos.js';
// lo que contesta Discord con un permiso: `/oauth2/@me` trae de qué app es y quién es; lo demás, el usuario solo
const comoDiscord = (url, u, app = APP_ID) => new Response(JSON.stringify(String(url).endsWith('/oauth2/@me')
  ? { application: { id: app }, user: u } : u), { status: 200 });
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
  // 🔑 LAS LIBRES (Dlx, 29/09/2026, «Dale»): en la Lista, jugó, y NO pasa el
  // portón. Tiene la Temporada y la Servidor; su ID va en `dn:`, que lee sólo
  // la carta, y no en `d:`, que abre la cuenta. Lo escribe `subir_datos.py`.
  'p:libre': JSON.stringify({ n: 'Libre', sv: 'FFA', svp: 'FFA', cc: 'cl', ev: 2, nv: 1,
                              cs: ['temporada', 'servidor'], svs: ['FFA'],
                              svc: ['FFA'] }),
  'dn:999777': 'libre',
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
     // la Liga vive en /freestyle-rap desde el 01/10/2026 (ver `rutaLG()` en web/montar.py)
     cp?.url === 'https://underlegends.pages.dev/freestyle-rap/avisos', cp?.url || '');
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
  // ⚠️ CUÁNTOS, DE LA TABLA Y NO ESCRITO: eran nueve hasta FFS (28/09/2026). 🚪 Menos los que no son de la Liga
  // (`fuera`: TFC y EFA, Dlx 04/10/2026), que no salen
  // (y desde el 05/10/2026 TWR, FTN y FRZ: el bot no está ahí). ⚠️ SALVO EL QUE SE ESTÁ MOSTRANDO: Konan tiene su
  // carta de la pre-temporada en TWR, y esa opción se queda para que el menú la marque y se pueda volver
  const deLaLiga = (await import('./worker.js')).SERVIDORES.filter((s) => !s.fuera);
  const opts = select(c)?.options || [];
  ok('lista todos los servidores de la Liga, más el que se está mostrando',
     opts.length === deLaLiga.length + 1 && opts.some((o) => o.value === 'TWR' && o.default),
     `${opts.length} de ${deLaLiga.length} + TWR`);
  ok('y no los que no son de la Liga (TFC, EFA, FTN, FRZ)',
     !opts.some((o) => ['TFC', 'EFA', 'FTN', 'FRZ'].includes(o.value)));
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
  // ⚠️ SE PIDE EL CAMINO, NO LA FRASE. Lo que no puede faltar es cómo
  // verificarse. Afirmar el texto entero haría fallar la prueba por una coma.
  const c = r.json?.data?.content || '';
  ok('un ID desconocido avisa en vez de reventar', c.includes('Verificate en la página'), c.slice(0, 48));
  // 🔑 DESDE EL 01/10/2026 ES UN BOTÓN, A LA PÁGINA (Dlx: «que esto te
  // redirija, y que te entres a DRA automáticamente»). Antes eran dos —la
  // invitación y el canal de DRA—, y la página hace los dos pasos.
  const bs = (r.json?.data?.components || []).flatMap(f => f.components || []);
  // 📅 y desde el 04/10/2026 también «Ver los próximos eventos»; y desde el 05/10/2026 el Pase, porque la Temporada
  // es la recompensa de su nivel 1 (Dlx: «C»). Primero verificarse: sin eso, ninguna tarjeta
  ok('y le da TRES botones: verificarse en la página, el Pase y los próximos eventos', bs.length === 3 &&
     (bs[0]?.url || '') === 'https://underlegends.pages.dev/cuenta/verificar' &&
     /\/freestyle-rap\/pase$/.test(bs[1]?.url || '') && /\/freestyle-rap\/eventos$/.test(bs[2]?.url || ''),
     bs.map(b => b.label + ' ' + b.url).join(' · '));
  ok('y dice los dos pasos: verificarse (la Servidor) y la primera Tarea del Pase (la Temporada)',
     /Todavía no tenés tarjeta/.test(c) && /Verificate en la página/.test(c) && /\*\*Servidor\*\*/.test(c) &&
     /Tarea del Pase/.test(c) && /\*\*Temporada\*\*/.test(c), c.slice(0, 90));
  ok('que dice que si no está en DRA, la página lo mete', /te mete/.test(c), c.slice(-120));
}
{
  // ⚠️ EL MISMO CASO PERO PARADO EN DRA: el mismo botón, sin prometerle que
  // lo mete (ya está adentro: la interacción vino de ahí).
  const r = await pedir({ type: 2, guild_id: G.DRA,
    member: { user: { id: '000000' } }, data: { name: 'card' } });
  const c = r.json?.data?.content || '';
  ok('parado en DRA también va a la página, sin «te mete»',
     c.includes('Verificate en la página') && !/te mete/.test(c), c.slice(-90));
  const bs = (r.json?.data?.components || []).flatMap(f => f.components || []);
  ok('y le quedan verificarse, el Pase y los próximos eventos', bs.length === 3 &&
     /\.dev\/cuenta\/verificar$/.test(bs[0]?.url || ''), bs.map(b => b.label).join(' · '));
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
  ok('si el bot no lo conoce, dice que la tarjeta es de quien juega y ofrece el nombre',
     /todavía no tiene tarjeta/.test(c) && c.includes('nombre:') && !/admin/.test(c), c.slice(0, 60));
  ok('y no le manda a ÉL la invitación, que es de otro',
     !c.includes('discord.gg/'), c.slice(0, 60));
  // 🔴 elegirse a uno mismo en `quien:` es «yo» (Adriagner, 04/10/2026): segunda persona, no «su nombre»
  const r2 = await pedir({ type: 2, guild_id: '1', member: { user: { id: '777333' } },
    data: { name: 'card', options: [{ name: 'quien', type: 6, value: '777333' }] } });
  const c2 = r2.json?.data?.content || '';
  ok('elegirse a uno mismo en «quien» contesta como a uno mismo', /Todavía no tenés tarjeta/.test(c2) && !/su nombre/.test(c2),
     c2.slice(0, 60));
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
  ok('se le dice que lo que falta es verificarse (y la primera Tarea del Pase)',
     /Para verificarte/.test(txt) && /Tarea del Pase/.test(txt), txt.slice(0, 52));
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
  ok('y los otros salen bloqueados', op.length - libres.length === op.length - 2 && op.length > 2,
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
// 🔑 LOS DE ESTAS PRUEBAS TIENEN NÚMERO EN EL COMPETITIVO (`c.n` en `p:`): desde
// el 29/09/2026 el «#» es sólo de ellos (`vs.c.n`) (Dlx: «ÚNICAMENTE a las personas que
// están en el competitivo»). El que no tiene, más abajo.
PUESTO['p:bloody'] = JSON.stringify({ n: 'Bloody', vs: { c: { sc: 60.1, n: 22 } } });
for (const u of ['777002', '777003', '777004', '777005', '777006']) PUESTO['d:' + u] = 'bloody';

{
  const r = await pedir(cmdPuesto(G.FFA, '777009'));
  ok('sin número en el Competitivo, /numeral explica cómo se consigue y no guarda nada',
     /10 eventos/.test(texto(r)) && /Todavía no tenés número/.test(texto(r)) && leerNick(G.FFA, '777009') === null,
     texto(r).slice(0, 90));
}
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
{
  // 🎤 el bot en vivo (05/10/2026): apagado hasta que el admin elige el canal, y vaciarlo lo apaga
  const r0 = await pedir(clickCfg(G.FFA, ADMIN, 'cfg:nick', []));
  ok('el bot en vivo arranca apagado', /El bot en vivo\*\* · \*\*apagado\*\*/.test(texto(r0))
     && JSON.stringify(r0.json).includes('cfg:vivo'));
  await pedir(clickCfg(G.FFA, ADMIN, 'cfg:nick', []));
  const r = await pedir(clickCfg(G.FFA, ADMIN, 'cfg:vivo', ['777888']));
  const cfgVivo = JSON.parse((await env.KV.get('cfg:' + G.FFA)) || '{}');
  ok('el admin elige el canal del bot en vivo y se guarda', /El bot en vivo\*\* · <#777888>/.test(texto(r)) && cfgVivo.vivo === '777888');
  const r2 = await pedir(clickCfg(G.FFA, ADMIN, 'cfg:vivo', []));
  ok('y vaciándolo se apaga', /El bot en vivo\*\* · \*\*apagado\*\*/.test(texto(r2))
     && JSON.parse((await env.KV.get('cfg:' + G.FFA)) || '{}').vivo === '');
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
      get: () => ({ fetch: async (url, opc) => { if (/\/(uso|medir)$/.test(String(url))) return new Response('{"ok":true}');
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
  // 🔴 un permiso de OTRA app no entra (revisión del 03/10/2026): Discord lo da por bueno en /users/@me
  globalThis.fetch = async (url) => comoDiscord(url, { id: '555000111222333444', username: 'konan_' }, '999999999999999999');
  r = await cuenta('permisoAjeno1234567890');
  ok('un permiso bueno de OTRA app de Discord no entra (sería entrar como esa persona)', r.status === 401 && r.json.error === 'discord',
     JSON.stringify(r.json));
  globalThis.fetch = async (url) => comoDiscord(url,
    { id: '555000111222333444', username: 'konan_', global_name: 'Konan', avatar: 'abc' });
  r = await cuenta('permisoBueno1234567890');
  ok('uno bueno de alguien de la Liga devuelve su rapero', r.status === 200 &&
     r.json.rapero === 'Konan' && r.json.av === '555000111222333444/abc', JSON.stringify(r.json));
  // 🔴 Y SUS CARTAS: quien tiene carta y no jugó la temporada no está en el
  // ranking, y la página le decía «todavía no tenés tarjeta» (Dlx, 25/09).
  ok('y su clave y sus cartas, para mostrarlas aunque no esté en el ranking',
     r.json.clave === 'konan' && Array.isArray(r.json.cs) && Array.isArray(r.json.bl),
     JSON.stringify({ clave: r.json.clave, cs: r.json.cs, bl: r.json.bl }));
  globalThis.fetch = async (url) => comoDiscord(url, { id: '999000111222333444', username: 'nadie' });
  r = await cuenta('permisoBueno1234567890');
  ok('y de alguien que no está, entra igual y sin rapero', r.status === 200 && r.json.rapero === '' &&
     r.json.n === 'nadie');
  globalThis.fetch = antes;
  delete PUESTO['d:555000111222333444'];
}

console.log('\nEL PROXY DE PAGES DEJA PASAR TODO LO QUE LA PÁGINA PIDE\n');

// 🔴 EL 25/09/2026 LAS TRES RUTAS NUEVAS DE «MI CUENTA» ANDABAN ACÁ Y NO EN LA
// PÁGINA: estas pruebas llaman al Worker directo, y el proxy de Pages
// (`paginas/_worker.js`) sólo deja pasar una lista cerrada. Dlx lo vio con una
// captura: «No pude leer tus redes». Esto saca de app.js y campana.js cada
// `/api/…` que la página pide y prueba que el proxy lo mande al Worker.
{
  const { readFileSync, readdirSync } = await import('node:fs');
  // ⚠️ Y LA PÁGINA NUEVA (revisión del 03/10/2026): el Inicio de React (`paginas/inicio/*.js`, lo construido) y el
  // service worker también piden `/api/…` —la postulación de /sumate, el muro—, y esto sólo leía app.js y campana.js.
  // Con las dos comillas: el build escribe "…"
  const nuevos = readdirSync(new URL('paginas/inicio/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => 'paginas/inicio/' + f);
  const src = ['paginas/app.js', 'paginas/campana.js', 'paginas/sw.js', ...nuevos]
    .map((f) => readFileSync(new URL(f, import.meta.url), 'utf8')).join('\n');
  const rutas = new Set((src.match(/['"]\/api\/[a-z0-9/._-]*[a-z0-9]['"]/gi) || []).map((x) => x.slice(1, -1)));
  // campana.js las arma como '/api/avisos/' + ruta: `pedir('alta', …)`
  for (const m of src.matchAll(/pedir\('([a-z]+)'/g)) rutas.add('/api/avisos/' + m[1]);
  const { default: proxy } = await import('./paginas/_worker.js');
  const antes = globalThis.fetch;
  let llego = null;
  globalThis.fetch = async (u) => { llego = String(u); return new Response('{}', { status: 200 }); };
  const envP = { ASSETS: { fetch: async () => new Response('<html>', { status: 200 }) } };
  ok('encontré las rutas que pide la página', rutas.size >= 8, [...rutas].join(' '));
  for (const r of [...rutas].sort()) {
    let pasa = false;
    for (const metodo of ['POST', 'GET']) {
      llego = null;
      await proxy.fetch(new Request('https://underlegends.pages.dev' + r,
        { method: metodo, body: metodo === 'POST' ? '{}' : undefined }), envP);
      if (llego && llego.startsWith('https://liga-global-bot')) { pasa = true; break; }
    }
    ok('el proxy deja pasar ' + r, pasa);
  }
  globalThis.fetch = antes;
}

console.log('\nMIS REDES EN MI PERFIL\n');

{
  const { redesPublicas } = await import('./worker.js');
  const conex = [
    { type: 'instagram', name: 'konan.rap', visibility: 1 },
    { type: 'twitter', name: 'konan_x', visibility: 1 },
    { type: 'youtube', id: 'UC123', name: 'Konan TV', visibility: 1 },
    { type: 'tiktok', name: 'escondido', visibility: 0 },
    { type: 'steam', name: 'konan_gamer', visibility: 1 },
  ];
  const pub = redesPublicas(conex);
  ok('sólo las públicas y de redes que sirven (Steam no, la oculta no)',
     pub.map((r) => r.t).join(',') === 'instagram,x,youtube', JSON.stringify(pub));
  ok('cada una con su link', pub[0].u === 'https://www.instagram.com/konan.rap/' &&
     pub[1].u === 'https://x.com/konan_x' && pub[2].u === 'https://www.youtube.com/channel/UC123',
     JSON.stringify(pub.map((r) => r.u)));

  const redes = async (cuerpo) => {
    const r = await worker.fetch(new Request('https://x/cuenta/redes', {
      method: 'POST', body: JSON.stringify(cuerpo),
    }), env, ctx);
    return { status: r.status, json: JSON.parse(await r.text()) };
  };
  const antes = globalThis.fetch;
  const discord = (sinPermiso, id = '555000111222333555') => async (url) => (String(url).endsWith('/connections')
    ? (sinPermiso ? new Response('{}', { status: 403 }) : new Response(JSON.stringify(conex), { status: 200 }))
    : comoDiscord(url, { id, username: 'konan_' }));
  let r = await redes({ token: 'x' });
  ok('un permiso con forma rara se rechaza', r.status === 400);
  globalThis.fetch = discord(true);
  r = await redes({ token: 'permisoBueno1234567890' });
  ok('sin el permiso de conexiones, lo dice', r.status === 403 && r.json.error === 'permiso');
  globalThis.fetch = discord(false);
  r = await redes({ token: 'permisoBueno1234567890' });
  ok('sin perfil en la Liga no se guarda nada', r.status === 409 && r.json.error === 'sin_perfil');
  PUESTO['d:555000111222333555'] = 'konan';
  r = await redes({ token: 'permisoBueno1234567890' });
  ok('con perfil: ofrece las públicas y dice que no guardó ninguna',
     r.status === 200 && r.json.publicas.length === 3 && r.json.guardadas.length === 0);
  r = await redes({ token: 'permisoBueno1234567890', mostrar: ['instagram:konan.rap', 'tiktok:escondido'] });
  ok('guarda sólo las elegidas que siguen públicas (la oculta no entra)',
     r.status === 200 && r.json.guardadas.length === 1 && JSON.parse(PUESTO['redes:konan']).redes.length === 1,
     PUESTO['redes:konan']);
  // 🔴 KV SON 1.000 ESCRITURAS POR DÍA PARA TODA LA CUENTA (revisión del 25/09/2026)
  const guardado = PUESTO['redes:konan'];
  r = await redes({ token: 'permisoBueno1234567890', mostrar: ['instagram:konan.rap'] });
  ok('guardar lo mismo otra vez no escribe KV', r.status === 200 && PUESTO['redes:konan'] === guardado);
  r = await redes({ token: 'permisoBueno1234567890', mostrar: [] });
  ok('y «Quitar» las saca (y se acuerda de cuántas veces cambió hoy)', r.status === 200 &&
     JSON.parse(PUESTO['redes:konan']).redes.length === 0 && JSON.parse(PUESTO['redes:konan']).n === 2,
     PUESTO['redes:konan']);
  // lo guardado con el formato de antes —la lista sola— se sigue leyendo
  PUESTO['redes:konan'] = JSON.stringify([{ t: 'instagram', n: 'konan.rap', u: 'https://www.instagram.com/konan.rap/' }]);
  r = await redes({ token: 'permisoBueno1234567890' });
  ok('el formato viejo (la lista sola) se sigue leyendo', r.status === 200 && r.json.guardadas.length === 1,
     JSON.stringify(r.json.guardadas));
  // lo que dejó de ser público se saca al mirar
  PUESTO['redes:konan'] = JSON.stringify({ redes: [{ t: 'tiktok', n: 'escondido', u: 'https://www.tiktok.com/@escondido' }],
    d: '2026-01-01', n: 1, t: 1 });
  r = await redes({ token: 'permisoBueno1234567890' });
  ok('lo que ya no es público en Discord sale del perfil al mirar', r.status === 200 &&
     r.json.guardadas.length === 0 && JSON.parse(PUESTO['redes:konan']).redes.length === 0, PUESTO['redes:konan']);
  // el tope del día, con otra persona (el freno por minuto es por persona)
  globalThis.fetch = discord(false, '555000111222333777');
  PUESTO['d:555000111222333777'] = 'otro';
  PUESTO['redes:otro'] = JSON.stringify({ redes: [], d: new Date().toISOString().slice(0, 10), n: 10, t: Date.now() });
  r = await redes({ token: 'permisoBueno1234567890', mostrar: ['instagram:konan.rap'] });
  ok('diez cambios por día: el once no escribe', r.status === 429 && r.json.error === 'tope' &&
     JSON.parse(PUESTO['redes:otro']).redes.length === 0, JSON.stringify(r.json));
  // y el freno por minuto
  let frenada = null;
  for (let i = 0; i < 8 && !frenada; i++) {
    const x = await redes({ token: 'permisoBueno1234567890' });
    if (x.status === 429 && x.json.error === 'espera') frenada = i;
  }
  ok('y más de seis pedidos por minuto se frenan', frenada !== null, String(frenada));
  globalThis.fetch = antes;
  delete PUESTO['d:555000111222333555'];
  delete PUESTO['d:555000111222333777'];
  delete PUESTO['redes:otro'];
}

console.log('\nLA FOTO DESDE LA PÁGINA\n');

{
  const puestoR2 = [];
  env.CARTAS = { put: async (k, cuerpo) => { puestoR2.push(k); } };
  const foto = async (cuerpo) => {
    const r = await worker.fetch(new Request('https://x/cuenta/foto', {
      method: 'POST', body: JSON.stringify(cuerpo),
    }), env, ctx);
    return { status: r.status, json: JSON.parse(await r.text()) };
  };
  const antes = globalThis.fetch;
  const discord = (avatar) => async (url) => (String(url).includes('cdn.discordapp.com')
    ? new Response('imagen', { status: 200 })
    : String(url).includes('/guilds/') ? new Response(JSON.stringify({ roles: [] }), { status: 200 })
    : comoDiscord(url, { id: '555000111222333666', username: 'k', avatar }));
  let r = await foto({ token: 'x' });
  ok('un permiso con forma rara se rechaza', r.status === 400);
  globalThis.fetch = discord('abc');
  r = await foto({ token: 'permisoBueno1234567890' });
  ok('sin tarjeta en la Liga no hay dónde ponerla', r.status === 409 && r.json.error === 'sin_perfil');
  PUESTO['d:555000111222333666'] = 'konan';
  globalThis.fetch = discord(null);
  r = await foto({ token: 'permisoBueno1234567890' });
  ok('sin foto en Discord no se guarda el gris', r.status === 422 && r.json.error === 'sin_foto');
  globalThis.fetch = discord('abc');
  r = await foto({ token: 'permisoBueno1234567890' });
  ok('primero muestra cuál quedaría, sin guardar nada', r.status === 200 && r.json.estado === 'puede' &&
     /avatars\/555000111222333666\/abc\.webp\?size=256/.test(r.json.vista || '') && !puestoR2.length,
     JSON.stringify(r.json));
  r = await foto({ token: 'permisoBueno1234567890', confirmar: true });
  ok('con «usar esta foto» la guarda en R2 y anota el uso de la temporada',
     r.status === 200 && r.json.ok && puestoR2.length === 1 && !!PUESTO['foto:t1:konan'],
     JSON.stringify(r.json));
  r = await foto({ token: 'permisoBueno1234567890', confirmar: true });
  ok('y la segunda vez de la temporada, no (sin el pase de DRA)',
     r.status === 403 && r.json.error === 'usado' && puestoR2.length === 1);
  // 🔑 «cambios ilimitados hasta el 9» (Dlx, 25/09/2026)
  delete PUESTO['foto:t1:konan'];
  env.FOTO_LIBRE_HASTA = new Date(Date.now() + 5 * 864e5).toISOString();
  r = await foto({ token: 'permisoBueno1234567890' });
  ok('en el cambio libre lo dice, con la fecha', r.json.libre === true && !!r.json.libre_hasta,
     JSON.stringify(r.json));
  r = await foto({ token: 'permisoBueno1234567890', confirmar: true });
  ok('y se guarda sin gastar el cambio de la temporada', r.status === 200 && r.json.libre &&
     !PUESTO['foto:t1:konan']);
  // lo que se cambió antes de que termine el cambio libre no cuenta después
  env.FOTO_LIBRE_HASTA = '2026-01-01T04:00:00Z';
  PUESTO['foto:t1:konan'] = JSON.stringify({ hash: 'viejo', ts: Date.parse('2025-12-20T00:00:00Z') });
  r = await foto({ token: 'permisoBueno1234567890' });
  ok('una marca de antes del fin del cambio libre no gasta nada', r.json.estado === 'puede',
     JSON.stringify(r.json));
  delete env.FOTO_LIBRE_HASTA;
  globalThis.fetch = antes;
  delete PUESTO['d:555000111222333666'];
  delete PUESTO['foto:t1:konan'];
  delete env.CARTAS;
}

console.log('\n/WEBSITE Y /NOTIFY\n');

{
  const r = await pedir({ type: 2, guild_id: G.FFA, channel_id: '1',
                          member: { user: { id: '700900' } }, data: { name: 'website' } });
  const bots = (r.json?.data?.components || []).flatMap((f) => f.components || []);
  ok('/website deja el botón a la página', bots.some((b) => /underlegends\.pages\.dev/.test(b.url || '')),
     JSON.stringify(r.json?.data));
  // 🔴 SIN DMs: Dlx, 25/09/2026, «no debería usar el bot para enviarte DMs,
  // sino activar la notificación al celular o dispositivo». Y se elige en
  // Discord: «seleccionar los servidores o para todos».
  const r2 = await pedir({ type: 2, guild_id: G.FFA, channel_id: '1',
                           member: { user: { id: '700901' } }, data: { name: 'notify' } });
  const b2 = (r2.json?.data?.components || []).flatMap((f) => f.components || []);
  const act = (bs) => bs.find((b) => b.style === 5) || {};
  ok('/notify en FFA viene con FFA elegido y el botón lleva a la campana con eso',
     /underlegends\.pages\.dev\/freestyle-rap\/avisos\/FFA$/.test(act(b2).url || ''), JSON.stringify(b2).slice(0, 160));
  ok('trae el menú de servidores y «Todos»', b2.some((b) => b.custom_id === 'ntf:svs') &&
     b2.some((b) => b.custom_id === 'ntf:todos'));
  ok('y dice que es para el celular o la compu', /celular o compu/.test(texto(r2)), texto(r2).slice(0, 80));
  const r3 = await pedir({ type: 2, user: { id: '700902' }, data: { name: 'notify' } });
  const b3 = (r3.json?.data?.components || []).flatMap((f) => f.components || []);
  ok('fuera de un servidor de la Liga, todos', /\/freestyle-rap\/avisos\/todos$/.test(act(b3).url || ''), JSON.stringify(b3).slice(0, 160));
  const r4 = await pedir({ type: 3, guild_id: G.FFA, member: { user: { id: '700903' } },
                           data: { custom_id: 'ntf:svs', component_type: 3, values: ['FFA', 'SR'] } });
  const b4 = (r4.json?.data?.components || []).flatMap((f) => f.components || []);
  ok('elegir en el menú redibuja el panel con la elección en el link',
     r4.json?.type === 7 && /\/freestyle-rap\/avisos\/FFA,SR$/.test(act(b4).url || ''), act(b4).url);
  const r5 = await pedir({ type: 3, guild_id: G.FFA, member: { user: { id: '700904' } },
                           data: { custom_id: 'ntf:todos', component_type: 2 } });
  ok('«Todos» deja el link en todos y se saca el botón',
     /\/freestyle-rap\/avisos\/todos$/.test(act((r5.json?.data?.components || []).flatMap((f) => f.components || [])).url || '') &&
     !(r5.json?.data?.components || []).flatMap((f) => f.components || []).some((b) => b.custom_id === 'ntf:todos'));
  const r6 = await pedir({ type: 3, guild_id: G.FFA, member: { user: { id: '700905' } },
                           data: { custom_id: 'ntf:off', component_type: 2 } });
  ok('un botón de un panel viejo (el de los DMs) muestra el de ahora',
     r6.json?.type === 7 && /celular o compu/.test(texto(r6)));
  const { panelNotify } = await import('./worker.js');
  const p7 = panelNotify('FFA', ['DRA', 'SR'], null);
  ok('si el vigía no escucha ese servidor, no lo ofrece y lo dice',
     !p7.components[0].components[0].options.some((o) => o.value === 'FFA') && /Todavía no se escuchan/.test(p7.content));
  ok('y nadie queda anotado a DMs: el único link es la página',
     b2.filter((b) => b.style === 5).every((b) => /^https:\/\/underlegends\.pages\.dev\//.test(b.url)));
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
  // de 3 a 11 AM ET no corre nada (Dlx, 25/09/2026): la primera es la de las 11:22
  ok('de madrugada, la de las 11:22', v2 && v2.toISOString() === '2026-09-25T15:22:00.000Z',
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

console.log('\nVERIFICARSE DESDE LA PÁGINA, ENTRANDO A DRA\n');

{
  // 🔑 Dlx, 01/10/2026: «que te entres a DRA automáticamente», el país elegido
  // en la página (su «A») y el Miembro, del ciclo (su otra «A»).
  const P = { guild: G.DRA, rol: 'MIEMBRO', paises: { R_AR: 'ar', R_US: 'us', R_CL: 'cl' },
              revisa: ['700699'] };
  // un Discord de mentira: de quién es cada permiso, quién está en DRA y todo lo que se le pidió
  const USUARIOS = {
    permisoNuevo1234567890: { id: '700601', username: 'nuevo', global_name: 'Nuevo' },
    permisoChile1234567890: { id: '700602', username: 'chileno', global_name: 'Chileno' },
    permisoDosBand12345678: { id: '700603', username: 'dos', global_name: 'Dos 🇦🇷🇨🇱' },
    permisoRevisa123456789: { id: '700699', username: 'revisado', global_name: 'Revisado' },
    permisoKonan1234567890: { id: '999111', username: 'konan', global_name: 'Konan' },
    permisoBaja12345678901: { id: '700650', username: 'baja', global_name: 'Baja' },
    permisoLleno1234567890: { id: '700660', username: 'lleno', global_name: 'Lleno' },
  };
  const DRA = {
    700602: { roles: ['R_CL'], pending: false, user: { id: '700602', username: 'chileno' } },
    700603: { roles: [], pending: false, nick: '', user: { id: '700603', username: 'dos', global_name: 'Dos 🇦🇷🇨🇱' } },
    700699: { roles: [], pending: false, user: { id: '700699', username: 'revisado' } },
  };
  const LLAMADAS = [];
  let entrarDa = null;   // lo que contesta el PUT de entrar, cuando no es lo normal
  let usuariosDa = 200;
  const antes = globalThis.fetch;
  globalThis.fetch = async (url, opc = {}) => {
    const u = String(url), m = String(opc.method || 'GET').toUpperCase(), hs = opc.headers || {};
    LLAMADAS.push({ u, m, hs, body: opc.body ? JSON.parse(opc.body) : null });
    if (u.endsWith('/users/@me') || u.endsWith('/oauth2/@me')) {
      if (usuariosDa !== 200) return new Response('{"message":"x"}', { status: usuariosDa });
      const tok = String(hs.Authorization || '').replace(/^Bearer /, '');
      const yo = USUARIOS[tok];
      if (!yo) return new Response('{"message":"401: Unauthorized"}', { status: 401 });
      // el permiso de OTRA app (`otra:` adelante): Discord lo da por bueno, y `discordDe()` lo tiene que rechazar
      const app = tok.startsWith('otra') ? '999999999999999999' : APP_ID;
      return new Response(JSON.stringify(u.endsWith('/oauth2/@me') ? { application: { id: app }, user: yo } : yo), { status: 200 });
    }
    const mr = u.match(/\/guilds\/(\d+)\/members\/(\d+)(?:\/roles\/(\w+))?$/);
    if (!mr) return new Response('{}', { status: 404 });
    const [, , id, rol] = mr;
    if (rol && m === 'PUT') {
      if (!DRA[id]) return new Response('{"code":10007}', { status: 404 });
      DRA[id].roles.push(rol);
      return new Response(null, { status: 204 });
    }
    if (m === 'PUT') {
      if (entrarDa) return new Response(JSON.stringify(entrarDa.cuerpo || {}), { status: entrarDa.status });
      if (DRA[id]) return new Response(null, { status: 204 });
      DRA[id] = { roles: [], pending: true, user: { id, username: 'x' } };
      return new Response(JSON.stringify(DRA[id]), { status: 201 });
    }
    return DRA[id] ? new Response(JSON.stringify(DRA[id]), { status: 200 })
      : new Response('{"message":"Unknown Member","code":10007}', { status: 404 });
  };
  env.DISCORD_TOKEN = 'x';
  META.porton = P;
  const ver = async (cuerpo, seguido = false) => {
    RELOJ += seguido ? 5 : 60000;
    const r = await worker.fetch(new Request('https://x/cuenta/verificar', { method: 'POST',
      body: JSON.stringify(cuerpo) }), env, ctx);
    let j = null;
    try { j = JSON.parse(await r.text()); } catch (e) { j = null; }
    return { status: r.status, json: j || {} };
  };
  const pusoRol = (id) => LLAMADAS.filter((l) => l.m === 'PUT' && l.u.indexOf('/members/' + id + '/roles/') >= 0);
  try {
    let r = await ver({ token: 'corto' });
    ok('un permiso con forma rara se rechaza sin preguntarle a Discord', r.status === 400 && !LLAMADAS.length);
    r = await ver({ token: 'permisoQueNoExiste12345' });
    ok('un permiso que Discord no reconoce: 401', r.status === 401 && r.json.error === 'discord');

    // 1 · quien no está en DRA: el bot lo mete, y entra pendiente
    LLAMADAS.length = 0;
    r = await ver({ token: 'permisoNuevo1234567890' });
    const entro = LLAMADAS.find((l) => l.m === 'PUT' && /\/members\/700601$/.test(l.u));
    ok('fuera de DRA: el bot lo mete, con su permiso', r.status === 200 && r.json.entro === true && entro &&
       entro.body.access_token === 'permisoNuevo1234567890' && /^Bot /.test(entro.hs.Authorization),
       JSON.stringify(r.json));
    ok('sin ningún rol en el cuerpo: entra pendiente y el país va después', entro && !('roles' in entro.body));
    ok('y el registro de auditoría de DRA dice de dónde vino', entro && /underlegends/.test(
      decodeURIComponent(entro.hs['X-Audit-Log-Reason'] || '')));
    ok('la página se entera de que falta aceptar las reglas, y de los países para elegir',
       r.json.pendiente === true && r.json.completo === false && r.json.opciones.join() === 'ar,cl,us',
       JSON.stringify(r.json));
    // 2 · pendiente y elige país: no se le pone nada todavía
    LLAMADAS.length = 0;
    r = await ver({ token: 'permisoNuevo1234567890', pais: 'ar' });
    ok('🔴 pendiente: el país NO se pone (un rol puede saltearse las reglas de DRA)',
       r.status === 200 && r.json.pendiente && !r.json.puso && !pusoRol('700601').length, JSON.stringify(r.json));
    ok('ni se lo vuelve a meter: ya está', !LLAMADAS.some((l) => l.m === 'PUT'));
    await esperarSeguimientos();
    ok('y pendiente no se anota: el ciclo no lo busca todavía', !PUESTO['reg:700601']);
    // 3 · aceptó las reglas: ahora sí
    DRA['700601'].pending = false;
    r = await ver({ token: 'permisoNuevo1234567890' });
    ok('aceptó las reglas y no tiene país: lo pide', !r.json.pendiente && !r.json.paises.length &&
       !r.json.completo && !pusoRol('700601').length, JSON.stringify(r.json));
    r = await ver({ token: 'permisoNuevo1234567890', pais: 'ar' });
    ok('elige Argentina: el bot le pone ESE rol de DRA, y una sola vez',
       r.json.puso === 'ar' && r.json.paises.join() === 'ar' && r.json.completo === true &&
       pusoRol('700601').length === 1 && /\/roles\/R_AR$/.test(pusoRol('700601')[0].u), JSON.stringify(r.json));
    await esperarSeguimientos();
    const reg = JSON.parse(PUESTO['reg:700601'] || '{}');
    ok('completo: queda anotado como «yo», así la vuelta del ciclo lo encuentra',
       reg.id === '700601' && reg.por === 'yo' && reg.sv === 'DRA', JSON.stringify(reg));
    ok('y dice cuándo es esa vuelta', /^\d{4}-\d\d-\d\dT\d\d:(22|52):00/.test(r.json.vuelta || ''), r.json.vuelta);
    r = await ver({ token: 'permisoNuevo1234567890', pais: 'cl' });
    ok('con rol de país ya puesto, otro país no se pone: cambiarlo es cosa de DRA',
       pusoRol('700601').length === 1 && r.json.paises.join() === 'ar' && !r.json.puso);

    // 4 · los que ya estaban en DRA
    LLAMADAS.length = 0;
    r = await ver({ token: 'permisoChile1234567890', pais: 'ar' });
    ok('ya en DRA con su rol de Chile: no se lo mete ni se le toca el país',
       r.json.entro === false && r.json.paises.join() === 'cl' && !LLAMADAS.some((l) => l.m === 'PUT'),
       JSON.stringify(r.json));
    r = await ver({ token: 'permisoDosBand12345678' });
    ok('dos banderas en el nombre y ningún rol: dos países, y se pueden arreglar acá',
       r.json.paises.length === 2 && r.json.porRol === false && !r.json.completo, JSON.stringify(r.json));
    r = await ver({ token: 'permisoDosBand12345678', pais: 'cl' });
    ok('elige uno: el rol gana sobre las banderas, como en pais_por_rol',
       r.json.puso === 'cl' && r.json.paises.join() === 'cl', JSON.stringify(r.json));
    r = await ver({ token: 'permisoRevisa123456789', pais: 'ar' });
    await esperarSeguimientos();
    ok('a quien revisa un admin: el país sí, pero no se anota ni se le promete nada',
       r.json.revisa === true && !r.json.completo && !PUESTO['reg:700699'], JSON.stringify(r.json));
    ok('🔴 y el rol de Miembro no lo pone nunca la página: lo da el ciclo',
       !LLAMADAS.some((l) => /\/roles\/MIEMBRO$/.test(l.u)));
    r = await ver({ token: 'permisoChile1234567890', pais: 'zz' });
    ok('un país que DRA no tiene: 400, sin tocar nada', r.status === 400 && r.json.error === 'pais');

    // 5 · lo que no es el camino normal
    LLAMADAS.length = 0;
    r = await ver({ token: 'permisoKonan1234567890' });
    ok('quien ya está cargado (`d:`): «listo», sin mirar DRA', r.json.listo === true &&
       !LLAMADAS.some((l) => /\/guilds\//.test(l.u)));
    PUESTO['olvido:700650'] = '1';
    r = await ver({ token: 'permisoBaja12345678901' });
    ok('quien borró sus datos no vuelve con un toque: ni entra a DRA', r.json.olvido === true &&
       !LLAMADAS.some((l) => /\/members\/700650/.test(l.u)));
    delete PUESTO['olvido:700650'];
    entrarDa = { status: 400, cuerpo: { code: 30001, message: 'Maximum number of guilds reached (100)' } };
    r = await ver({ token: 'permisoLleno1234567890' });
    ok('con el máximo de servidores lo dice («lleno»)', r.status === 403 && r.json.error === 'lleno');
    entrarDa = { status: 403, cuerpo: { code: 40007, message: 'The user is banned from this guild.' } };
    r = await ver({ token: 'permisoLleno1234567890' });
    ok('si DRA no lo deja entrar, «no_deja»', r.status === 403 && r.json.error === 'no_deja');
    entrarDa = { status: 403, cuerpo: { code: 50001, message: 'Missing Access' } };
    r = await ver({ token: 'permisoLleno1234567890' });
    ok('un permiso sin «unirse a servidores»: «permiso», para pedirlo de nuevo',
       r.status === 403 && r.json.error === 'permiso');
    entrarDa = null;
    usuariosDa = 429;
    r = await ver({ token: 'permisoChile1234567890' });
    ok('si Discord frena (429): 503, no «permiso malo»', r.status === 503 && r.json.error === 'discord_ocupado');
    usuariosDa = 200;
    delete META.porton;
    r = await ver({ token: 'permisoChile1234567890' });
    ok('sin el portón en KV no inventa: 503 «porton»', r.status === 503 && r.json.error === 'porton');
    META.porton = P;
    let frenada = null;
    for (let k = 0; k < 8 && !frenada; k++) {
      const x = await ver({ token: 'permisoChile1234567890' }, true);
      if (x.status === 429) frenada = x;
    }
    ok('y lleva el freno de Mi cuenta (escribe en Discord)', frenada && frenada.json.error === 'espera');
    // el proxy de Pages la deja pasar
    const { default: proxy } = await import('./paginas/_worker.js');
    let fue = null;
    globalThis.fetch = async (u) => { fue = String(u); return new Response('{"ok":true}', { status: 200 }); };
    await proxy.fetch(new Request('https://underlegends.pages.dev/api/cuenta/verificar', { method: 'POST',
      body: '{"token":"x"}' }), { ASSETS: { fetch: async () => new Response('<html>', { status: 200 }) } });
    ok('el proxy de la página la manda al Worker', !!fue && /\/cuenta\/verificar$/.test(fue), fue);
  } finally {
    globalThis.fetch = antes;
    delete env.DISCORD_TOKEN;
    delete META.porton;
  }
}

console.log('\nTU CARTA SIN TU FOTO\n');

{
  // 📸 Dlx, 01/10/2026, con la captura de MILICA: «que le aparezca la opción…
  // para verificarse a través del website». Sólo a quien pide SU carta.
  const antes = globalThis.fetch, antesR2 = env.CARTAS;
  const R2 = {}, puestos = [], mandados = [];
  env.CARTAS = {
    head: async (k) => (k in R2 ? { key: k } : null),
    put: async (k) => { puestos.push(k); R2[k] = 1; },
  };
  let cdn = 200;
  globalThis.fetch = async (url, opc = {}) => {
    const u = String(url);
    if (u.includes('cdn.discordapp.com')) return new Response(cdn === 200 ? 'webp' : '', { status: cdn });
    if (u.includes('/webhooks/')) mandados.push(JSON.parse(opc.body));
    return new Response('{}', { status: 200 });
  };
  const pedirMia = async (id, avatar, extra = {}) => {
    mandados.length = 0;
    const r = await pedir(Object.assign({ type: 2, guild_id: G.FFA, application_id: 'app', token: 'tk',
      member: { user: { id, avatar } }, data: { name: 'card' } }, extra));
    await esperarSeguimientos();
    return r;
  };
  try {
    let r = await pedirMia('999111', 'abc123');
    ok('la carta sale igual, pública', r.json?.type === 4 && !(r.json?.data?.flags & 64));
    ok('verificado, con foto en Discord y sin la de la temporada: se la guarda ya',
       puestos.includes('fotos/t1/konan.webp'), JSON.stringify(puestos));
    ok('y se lo dice sólo a él, con la hora en la de quien lee',
       mandados.length === 1 && (mandados[0].flags & 64) && /ya la guardé/.test(mandados[0].content) &&
       /<t:\d+:t>/.test(mandados[0].content), JSON.stringify(mandados));
    ok('🔴 la primera foto NO gasta el cambio de la temporada', !PUESTO['foto:t1:konan']);
    r = await pedirMia('999111', 'abc123');
    ok('con la foto ya guardada, ni un mensaje ni otra escritura', !mandados.length &&
       puestos.filter((k) => k === 'fotos/t1/konan.webp').length === 1);
    delete R2['fotos/t1/konan.webp'];
    puestos.length = 0;
    r = await pedirMia('999111', null);
    ok('sin foto en Discord: que se ponga una, sin guardar el gris de Discord',
       !puestos.length && mandados.length === 1 && /no tenés foto en Discord/.test(mandados[0].content));
    cdn = 404;
    r = await pedirMia('999111', 'muerto');
    ok('si el CDN no la da, se calla: la carta ya salió y el ciclo reintenta', !puestos.length && !mandados.length);
    cdn = 200;
    r = await pedirMia('999777', 'abc123');
    const b = (mandados[0]?.components?.[0]?.components || [])[0] || {};
    ok('sin verificar: «verificate en la página», con el botón (lo que pidió Dlx)',
       mandados.length === 1 && /verificados en DRA/.test(mandados[0].content) &&
       b.url === 'https://underlegends.pages.dev/cuenta/verificar' && !puestos.length, JSON.stringify(mandados));
    r = await pedirMia('999555', 'abc123', { data: { name: 'card', options: [{ name: 'nombre', value: 'Konan' }] } });
    ok('la carta de OTRO: ningún aviso, ninguna foto', !mandados.length && !puestos.length);
  } finally {
    globalThis.fetch = antes;
    env.CARTAS = antesR2;
  }
}

console.log('\nLAS LIBRES: LA TEMPORADA Y LA SERVIDOR, SIN VERIFICAR\n');

{
  // su propia carta, por su ID, que está en `dn:` y no en `d:`
  let r = await pedir({ type: 2, guild_id: G.FFA, member: { user: { id: '999777' } },
    data: { name: 'card' } });
  let c = r.json?.data?.components;
  ok('/card encuentra a quien está en `dn:`', r.json?.type === 4 && !!galeria(c),
     (r.json?.data?.content || '').slice(0, 80));
  ok('y abre en su Servidor', (galeria(c)?.items?.[0]?.media?.url || '').includes('/libre/'),
     galeria(c)?.items?.[0]?.media?.url || '');
  const bs = botones(c);
  ok('están los cuatro botones', bs.length === 4, bs.map(b => b.label).join());
  const conCandado = bs.filter(b => b.emoji && b.emoji.name === '🔒').map(b => b.label).sort();
  ok('la Competitiva y la de País llevan candado', conCandado.join() === 'Competitiva,País',
     conCandado.join());
  ok('la Temporada y la Servidor no', bs.filter(b => !b.emoji).map(b => b.label).sort().join() ===
     'Servidor,Temporada');
  ok('la fila no pasa de cinco', (filaBotones(c)?.components || []).length <= 5);

  // el candado, apretado por el dueño: «verificate», sin tocar la carta
  r = await pedir({ type: 3, guild_id: G.FFA, data: { custom_id: 'c:libre:competitivo:999777' },
    member: { user: { id: '999777' } } });
  let txt = r.json?.data?.content || '';
  ok('el candado contesta aparte (4), no pisa la carta', r.json?.type === 4, `type ${r.json?.type}`);
  ok('y es efímero', ((r.json?.data?.flags || 0) & (1 << 6)) !== 0);
  ok('le dice que es de los verificados', txt.includes('verificados') && txt.includes('Competitiva'), txt);
  ok('y cómo verificarse, con el botón', (r.json?.data?.components?.[0]?.components || [])
     .some(b => b.label === 'Verificarme en la página'));

  // las libres sí cambian la carta
  r = await pedir({ type: 3, guild_id: G.FFA, data: { custom_id: 'c:libre:temporada:999777' },
    member: { user: { id: '999777' } } });
  ok('la Temporada sí se abre (7)', r.json?.type === 7 &&
     (galeria(r.json?.data?.components)?.items?.[0]?.media?.url || '').includes('/libre/temporada.webp'));

  // la carta de otro: el candado habla de ÉL, no del que mira
  r = await pedir({ type: 2, guild_id: G.FFA, member: { user: { id: '999111' } },
    data: { name: 'card', options: [{ name: 'nombre', value: 'Libre' }] } });
  ok('por nombre también sale', r.json?.type === 4 && botones(r.json?.data?.components).length === 4);
  r = await pedir({ type: 3, guild_id: G.FFA, data: { custom_id: 'c:libre:pais:999111' },
    member: { user: { id: '999111' } } });
  txt = r.json?.data?.content || '';
  ok('en la de otro, dice que ÉL no se verificó', txt.includes('**Libre** todavía no se verificó'), txt);

  // elegido en el selector
  r = await pedir({ type: 2, guild_id: G.FFA, member: { user: { id: '999111' } },
    data: { name: 'card', options: [{ name: 'quien', value: '999777' }] } });
  ok('y elegido en el selector, por su `dn:`', r.json?.type === 4 && !!galeria(r.json?.data?.components),
     (r.json?.data?.content || '').slice(0, 80));

  // /versus: la Competitiva no es «no tiene carta», es «no se verificó»
  r = await pedir({ type: 2, guild_id: G.FFA, member: { user: { id: '999333' } },
    data: { name: 'versus', options: [{ name: 'rival', value: '999777' },
                                      { name: 'carta', value: 'competitivo' }] } });
  txt = r.json?.data?.content || '';
  ok('/versus en Competitiva: «todavía no se verificó»', txt.includes('todavía no se verificó'), txt);
  r = await pedir({ type: 2, guild_id: G.FFA, member: { user: { id: '999777' } },
    data: { name: 'versus', options: [{ name: 'rival', value: '999333' },
                                      { name: 'carta', value: 'competitivo' }] } });
  txt = r.json?.data?.content || '';
  ok('y si es él: «vos todavía no te verificaste»', txt.includes('Vos todavía no te verificaste'), txt);

  // lo de la cuenta sigue siendo de los verificados
  r = await pedir({ type: 2, guild_id: G.FFA, member: { user: { id: '999777', avatar: 'abc' } },
    data: { name: 'foto' } });
  txt = r.json?.data?.content || '';
  ok('/foto: no es «no estás en la Liga», es «verificate»', txt.includes('verificado en DRA') &&
     !txt.includes('no estás en la Liga'), txt);
  r = await pedir({ type: 2, guild_id: G.FFA, member: { user: { id: '999777' } },
    data: { name: 'verificar' } });
  txt = r.json?.data?.content || '';
  ok('/verificar no le dice «ya estás verificado»', !txt.includes('Ya estás verificado'), txt.slice(0, 80));
  await esperarSeguimientos();
  ok('y no lo vuelve a anotar en la cola: ya está en la Lista', !('reg:999777' in PUESTO));
}

console.log('\n/borrar-mis-datos\n');

{
  // 🔑 Dlx, 27/09/2026: «podríamos hacer un comando para delete-my-data».
  const ID = '700800';
  PUESTO['d:' + ID] = 'borrame';
  PUESTO['p:borrame'] = '{"n":"Borrame"}';
  PUESTO['redes:borrame'] = '{"redes":[]}';
  const r2 = new Set(['borrame/temporada.webp', 'borrame/sv-ffa.webp', 'fotos/t1/borrame.webp',
    'fotos/t1/otro.webp', 'otro/temporada.webp', 'borrame-co/temporada.webp']);
  const soltados = [];
  const envAntes = { CARTAS: env.CARTAS, AVISOS: env.AVISOS };
  // como R2: con `delimiter`, las «carpetas» van en `delimitedPrefixes` (la foto se busca por temporada, 04/10/2026)
  env.CARTAS = {
    list: async ({ prefix, delimiter }) => {
      const ks = [...r2].filter((k) => k.startsWith(prefix));
      if (!delimiter) return { objects: ks.map((key) => ({ key })), truncated: false };
      const pre = new Set();
      const objects = [];
      ks.forEach((k) => {
        const i = k.slice(prefix.length).indexOf(delimiter);
        if (i >= 0) pre.add(k.slice(0, prefix.length + i + 1)); else objects.push({ key: k });
      });
      return { objects, delimitedPrefixes: [...pre], truncated: false };
    },
    head: async (k) => (r2.has(k) ? { key: k } : null),
    delete: async (ks) => { for (const k of [].concat(ks)) r2.delete(k); },
  };
  env.AVISOS = { idFromName: () => 'liga', get: () => ({ fetch: async (url, opc) => { if (/\/(uso|medir)$/.test(String(url))) return new Response('{"ok":true}');
    soltados.push([String(url), JSON.parse(opc.body).quien]);
    return new Response('{"ok":true,"soltados":2}', { status: 200 });
  } }) };
  const boton = (quien, cid) => pedir({ type: 3, guild_id: G.DRA, channel_id: '1',
    member: { user: { id: quien } }, data: { custom_id: cid } });

  let r = await pedir({ type: 2, guild_id: G.DRA, channel_id: '1',
                        member: { user: { id: ID } }, data: { name: 'borrar-mis-datos' } });
  const ids = JSON.stringify(r.json?.data?.components || []);
  ok('pregunta antes, sólo a quien lo pidió, con los dos botones',
     r.json?.data?.flags === 64 && ids.includes('baja:si::' + ID) && ids.includes('baja:no::' + ID),
     ids.slice(0, 120));
  r = await boton('700801', 'baja:si::' + ID);
  ok('el botón de otro no borra nada', /de otra persona/.test(texto(r)) && PUESTO['d:' + ID] === 'borrame',
     texto(r));
  r = await boton(ID, 'baja:no::' + ID);
  ok('«Cancelar» no borra nada', /no borré nada/.test(texto(r)) && PUESTO['d:' + ID] === 'borrame', texto(r));
  r = await boton(ID, 'baja:si::' + ID);
  ok('borra sus claves de KV', !('d:' + ID in PUESTO) && !('p:borrame' in PUESTO) && !('redes:borrame' in PUESTO),
     Object.keys(PUESTO).filter((k) => k.includes('borrame') || k.includes(ID)).join(','));
  ok('borra sus cartas y su foto, y nada de otro (tampoco «borrame-co»)',
     [...r2].sort().join(',') === 'borrame-co/temporada.webp,fotos/t1/otro.webp,otro/temporada.webp',
     [...r2].join(','));
  ok('suelta sus avisos por la ruta de adentro', soltados.length === 1 && soltados[0][0].endsWith('/olvidar') &&
     soltados[0][1] === ID, JSON.stringify(soltados));
  ok('deja la marca de baja, sin nombre', !!PUESTO['olvido:' + ID] && !/borrame/i.test(PUESTO['olvido:' + ID]),
     PUESTO['olvido:' + ID]);
  ok('y lo dice', /Listo/.test(texto(r)) && /no te vuelva a sumar/.test(texto(r)), texto(r));
  // quien se dio de baja no se vuelve a anotar con un /card suelto
  delete PUESTO['reg:' + ID];
  await pedir({ type: 2, guild_id: G.DRA, channel_id: '1', member: { user: { id: ID } }, data: { name: 'card' } });
  await esperarSeguimientos();
  ok('un /card después de la baja no lo vuelve a anotar', !('reg:' + ID in PUESTO));
  // 🔴 LAS LIBRES (`dn:`): la auditoría del 01/10/2026 encontró que esto no
  // les borraba nada en el momento, porque leía sólo `d:`
  const IDN = '700810';
  PUESTO['dn:' + IDN] = 'librebaja';
  PUESTO['p:librebaja'] = '{"n":"Librebaja","nv":1}';
  r2.add('librebaja/temporada.webp');
  r2.add('librebaja/servidor.webp');
  r = await boton(IDN, 'baja:si::' + IDN);
  ok('a quien está en la Lista sin verificar también le borra todo, en el momento',
     !('dn:' + IDN in PUESTO) && !('p:librebaja' in PUESTO) && ![...r2].some((k) => k.startsWith('librebaja/')),
     Object.keys(PUESTO).filter((k) => k.includes('librebaja') || k.includes(IDN)).join(',') + ' · ' + [...r2].join(','));
  // 🔴 la cuenta EXTRA de alguien (`dx:`, la segunda de Monet) borra su llave y nada más (revisión del 04/10/2026)
  const IDX = '700820';
  PUESTO['dx:' + IDX] = 'dueno';
  PUESTO['p:dueno'] = '{"n":"Dueño","nv":1}';
  r2.add('dueno/temporada.webp');
  r2.add('fotos/t1/dueno.webp');
  r = await boton(IDX, 'baja:si::' + IDX);
  ok('la cuenta extra borra sólo su llave: el perfil, las cartas y la foto de la otra cuenta quedan',
     !('dx:' + IDX in PUESTO) && 'p:dueno' in PUESTO && r2.has('dueno/temporada.webp') && r2.has('fotos/t1/dueno.webp') &&
     !!PUESTO['olvido:' + IDX],
     Object.keys(PUESTO).filter((k) => k.includes('dueno') || k.includes(IDX)).join(',') + ' · ' + [...r2].join(','));
  delete PUESTO['p:dueno'];
  env.CARTAS = envAntes.CARTAS;
  env.AVISOS = envAntes.AVISOS;
  delete PUESTO['olvido:' + ID];
  delete PUESTO['olvido:' + IDN];
  delete PUESTO['olvido:' + IDX];
}

console.log('\nLAS ENCUESTAS\n');

{
  // 🔑 Dlx, 27/09/2026: «1. A. 2. A». Vota cualquiera que entre con Discord
  // (con una cuenta de más de 30 días) y en el ×2 nadie vota a su servidor.
  // Qué se vota lo deja el ciclo en KV (bot/encuestas.py); quién vota lo dice
  // Discord, nunca la página.
  const A = await import('./avisos.js');
  const idDe = (ms, n = 7) => String((BigInt(ms - 1420070400000) << 22n) + BigInt(n));
  const VIEJO = idDe(Date.parse('2020-01-01T00:00:00Z'));
  const NUEVO = idDe(RELOJ - 5 * 86400000);
  ok('el ID de Discord dice cuándo se creó la cuenta',
     Math.abs(A.creadaEn(VIEJO) - Date.parse('2020-01-01T00:00:00Z')) < 1000 && A.creadaEn('x') === 0);
  const abre = new Date(RELOJ + 6 * 3600000).toISOString();
  const defs = { lista: [
    { id: 'x2:2026-10-05', tipo: 'x2', hasta: abre, op: ['DRA', 'FFA', 'SR', 'URBF'] },
    { id: 'mw:2026-09-28', tipo: 'elegido', hasta: abre, op: ['Hassan', 'Zeta'] },
    { id: 'mw:2026-09-27', tipo: 'elegido', hasta: new Date(RELOJ - 60000).toISOString(), op: ['Hassan'] },
  ], sv: { [VIEJO]: 'FFA' }, yo: { [VIEJO]: 'Zeta' } };
  const v = (enc, op, id) => A.validarVoto(defs, { enc, op }, id || VIEJO, RELOJ);
  ok('un voto bueno vale', JSON.stringify(v('x2:2026-10-05', 'SR')) === '{"enc":"x2:2026-10-05","op":"SR"}');
  // 🔑 Dlx, 28/09/2026: «3. B y C» — en el ×2 cualquiera vota a cualquiera
  ok('a tu servidor, también (desde el 28/09)', !v('x2:2026-10-05', 'FFA').error);
  ok('a vos, no; a otro, sí', v('mw:2026-09-28', 'Zeta').error === 'vos' && !v('mw:2026-09-28', 'Hassan').error);
  ok('lo que ya cerró, no', v('mw:2026-09-27', 'Hassan').error === 'cerrada');
  ok('lo que no está en la lista, no', v('mw:2026-09-28', 'Otro').error === 'opcion' &&
     v('nada', 'x').error === 'no_existe');
  ok('una cuenta de hace 5 días, no, y dice desde cuándo puede',
     v('x2:2026-10-05', 'SR', NUEVO).error === 'nueva' && !!v('x2:2026-10-05', 'SR', NUEVO).desde);
  ok('sin lo que dejó el ciclo en KV, nada vale',
     A.validarVoto(null, { enc: 'x2:2026-10-05', op: 'SR' }, VIEJO, RELOJ).error === 'no_existe');

  // 📣 «¿algo está mal en esta llave?» (Dlx, 28/09/2026: «ok»): mismo portón que el voto
  const rep = (d, id) => A.validarReporte(d, id || VIEJO, RELOJ);
  ok('un reporte bueno vale, de una llave cargada o en vivo',
     JSON.stringify(rep({ llave: '370', que: 'ganador', texto: '  la ganó  Paria ' })) ===
       '{"llave":"370","que":"ganador","texto":"la ganó Paria","batalla":""}' &&
     !rep({ llave: 'v:1554310239942213663', que: 'gente' }).error);
  ok('lo que no es una llave, no es una razón o es muy largo, no',
     rep({ llave: '../x', que: 'ganador' }).error === 'llave' && rep({ llave: '370', que: 'x' }).error === 'que' &&
     rep({ llave: '370', que: 'ganador', texto: 'x'.repeat(301) }).error === 'largo');
  ok('«otra cosa» sin decir qué, no', rep({ llave: '370', que: 'otro', texto: ' ' }).error === 'texto');
  ok('y una cuenta de hace 5 días, no, como el voto',
     rep({ llave: '370', que: 'ganador' }, NUEVO).error === 'nueva');

  // la ruta entera: Discord, KV y el objeto
  const antesF = globalThis.fetch, antesA = env.AVISOS;
  const alObjeto = [];
  env.AVISOS = { idFromName: () => 'liga', get: () => ({ fetch: async (url, opc) => { if (/\/(uso|medir)$/.test(String(url))) return new Response('{"ok":true}');
    alObjeto.push([String(url), opc && opc.body ? JSON.parse(opc.body) : null]);
    return new Response('{"ok":true,"cuenta":{"SR":1},"t":1}', { status: 200 });
  } }) };
  PUESTO.encuestas = JSON.stringify(defs);
  globalThis.fetch = async (u) => (/\/(users|oauth2)\/@me$/.test(String(u))
    ? new Response(JSON.stringify(String(u).endsWith('/oauth2/@me') ? { application: { id: APP_ID }, user: { id: VIEJO, username: 'x' } } : { id: VIEJO, username: 'x' }), { status: 200 })
    : new Response('{}', { status: 404 }));
  const votarR = async (cuerpo) => {
    const r = await worker.fetch(new Request('https://x/avisos/votar', { method: 'POST',
      body: JSON.stringify(cuerpo) }), env, ctx);
    return { status: r.status, json: JSON.parse(await r.text()) };
  };
  let r = await votarR({ token: 'x', enc: 'x2:2026-10-05', op: 'SR' });
  ok('un permiso con forma rara se rechaza sin preguntarle a Discord', r.status === 400 && !alObjeto.length);
  r = await votarR({ token: 'permisoBueno1234567890', enc: 'x2:2026-10-05', op: 'FFA' });
  ok('a su servidor, también: llega al objeto (Dlx, 28/09: «3. B y C»)', r.status === 200 &&
     alObjeto.length === 1 && alObjeto[0][1].op === 'FFA', JSON.stringify(r.json));
  alObjeto.length = 0;
  r = await votarR({ token: 'permisoBueno1234567890', enc: 'x2:2026-10-05', op: 'SR', quien: '111111111111111111' });
  ok('uno bueno llega al objeto con el ID que dijo Discord, no con el que mandó la página',
     r.status === 200 && alObjeto.length === 1 && alObjeto[0][0].endsWith('/votar') &&
     alObjeto[0][1].quien === VIEJO && alObjeto[0][1].op === 'SR', JSON.stringify(alObjeto));
  globalThis.fetch = async () => new Response('{"message":"401: Unauthorized"}', { status: 401 });
  r = await votarR({ token: 'permisoFalso1234567890', enc: 'x2:2026-10-05', op: 'SR' });
  ok('un permiso que Discord no reconoce: 401', r.status === 401 && r.json.error === 'discord');
  // cuántos votos: se le pregunta al objeto, que nunca dice quién
  alObjeto.length = 0;
  r = await worker.fetch(new Request('https://x/avisos/encuestas'), env, ctx);
  ok('/avisos/encuestas le pregunta al objeto', r.status === 200 && alObjeto.length === 1 &&
     alObjeto[0][0].endsWith('/encuestas'));
  globalThis.fetch = antesF;
  env.AVISOS = antesA;
  delete PUESTO.encuestas;
}

console.log('\nLA SESIÓN: ENTRAR CON DISCORD UNA VEZ\n');

{
  // 🔴 Dlx, 28/09/2026: «cada vez que presiono para votar me redirige a
  // DISCORD… lo hice miles de veces». Ahora entrar deja una sesión (cookie
  // HttpOnly, 30 días) y un Discord que no contesta NO es un permiso malo.
  const idDe = (ms, n = 3) => String((BigInt(ms - 1420070400000) << 22n) + BigInt(n));
  const VIEJO = idDe(Date.parse('2018-03-01T00:00:00Z'));
  const SES = 'a'.repeat(43);
  const antesF = globalThis.fetch, antesA = env.AVISOS;
  const alObjeto = [];
  env.AVISOS = { idFromName: () => 'liga', get: () => ({ fetch: async (url, opc) => { if (/\/(uso|medir)$/.test(String(url))) return new Response('{"ok":true}');
    const u = String(url), b = opc && opc.body ? JSON.parse(opc.body) : null;
    alObjeto.push([u, b]);
    if (u.endsWith('/sesion/nueva')) return new Response(JSON.stringify({ ses: SES, vence: RELOJ + 1 }), { status: 200 });
    if (u.endsWith('/sesion/quien')) return b && b.ses === SES ? new Response(JSON.stringify({ quien: VIEJO }),
      { status: 200 }) : new Response('{"error":"no"}', { status: 404 });
    return new Response('{"ok":true,"cuenta":{"SR":1},"t":1}', { status: 200 });
  } }) };
  PUESTO.encuestas = JSON.stringify({ lista: [{ id: 'x2:1', tipo: 'x2', hasta: new Date(RELOJ + 3600000).toISOString(),
    op: ['SR', 'FFA'] }], sv: {}, yo: {} });
  let discordDa = 200;
  globalThis.fetch = async (u) => (/\/(users|oauth2)\/@me$/.test(String(u))
    ? new Response(discordDa === 200 ? JSON.stringify(String(u).endsWith('/oauth2/@me') ? { application: { id: APP_ID }, user: { id: VIEJO, username: 'x' } } : { id: VIEJO, username: 'x' }) : '{"message":"x"}',
      { status: discordDa })
    : new Response('{}', { status: 404 }));
  const votarS = async (cuerpo, ses) => {
    const r = await worker.fetch(new Request('https://x/avisos/votar', { method: 'POST', body: JSON.stringify(cuerpo),
      headers: ses ? { 'x-lg-ses': ses } : {} }), env, ctx);
    return { status: r.status, json: JSON.parse(await r.text()) };
  };
  let r = await votarS({ enc: 'x2:1', op: 'SR' });
  ok('sin permiso y sin sesión: 401 «sin_sesion» (la página va a Discord una vez)',
     r.status === 401 && r.json.error === 'sin_sesion' && !alObjeto.length, JSON.stringify(r.json));
  r = await votarS({ enc: 'x2:1', op: 'SR' }, SES);
  ok('con la sesión vota, sin preguntarle a Discord, y con el ID de la sesión',
     r.status === 200 && alObjeto.some(([u, b]) => u.endsWith('/votar') && b.quien === VIEJO), JSON.stringify(alObjeto));
  r = await votarS({ enc: 'x2:1', op: 'SR' }, 'b'.repeat(43));
  ok('con una sesión que no existe: 401', r.status === 401 && r.json.error === 'sin_sesion');
  discordDa = 429;
  r = await votarS({ enc: 'x2:1', op: 'SR', token: 'permisoBueno1234567890' });
  ok('si Discord frena (429), 503 «discord_ocupado» y NO 401: nadie vuelve a autorizar por eso',
     r.status === 503 && r.json.error === 'discord_ocupado', JSON.stringify(r.json));
  // entrar: /cuenta deja la cookie
  discordDa = 200;
  alObjeto.length = 0;
  let rc = await worker.fetch(new Request('https://x/cuenta', { method: 'POST',
    body: JSON.stringify({ token: 'permisoBueno1234567890' }) }), env, ctx);
  const ck = rc.headers.get('set-cookie') || '';
  ok('entrar con Discord deja la sesión en una cookie HttpOnly, Strict y sólo para /api',
     rc.status === 200 && ck.startsWith('lg_ses=' + SES) && /HttpOnly/.test(ck) && /SameSite=Strict/.test(ck) &&
     /Path=\/api/.test(ck) && /Max-Age=2592000/.test(ck), ck);
  discordDa = 503;
  rc = await worker.fetch(new Request('https://x/cuenta', { method: 'POST',
    body: JSON.stringify({ token: 'permisoBueno1234567890' }) }), env, ctx);
  ok('y si Discord no contesta al entrar, también 503 y no «permiso malo»', rc.status === 503);
  // salir: la borra
  alObjeto.length = 0;
  rc = await worker.fetch(new Request('https://x/cuenta/salir', { method: 'POST', body: '{}',
    headers: { 'x-lg-ses': SES } }), env, ctx);
  ok('«Salir» borra la sesión del objeto y la cookie', rc.status === 200 &&
     /Max-Age=0/.test(rc.headers.get('set-cookie') || '') && alObjeto.some(([u, b]) => u.endsWith('/sesion/fin') &&
       b.ses === SES));
  // el proxy de Pages: la cookie va al Worker como x-lg-ses, y el Set-Cookie vuelve
  const { default: proxy } = await import('./paginas/_worker.js');
  let fue = null;
  globalThis.fetch = async (u, opc) => {
    fue = { u: String(u), h: (opc && opc.headers) || {} };
    return new Response('{"ok":true}', { status: 200, headers: { 'set-cookie': 'lg_ses=' + SES + '; Path=/api' } });
  };
  const envP = { ASSETS: { fetch: async () => new Response('<html>', { status: 200 }) } };
  await proxy.fetch(new Request('https://underlegends.pages.dev/api/avisos/votar', { method: 'POST', body: '{}',
    headers: { cookie: 'otra=1; lg_ses=' + SES } }), envP);
  ok('el proxy le pasa la sesión al Worker (x-lg-ses)', fue && fue.h['x-lg-ses'] === SES, JSON.stringify(fue));
  const rp = await proxy.fetch(new Request('https://underlegends.pages.dev/api/cuenta', { method: 'POST',
    body: '{"token":"x"}' }), envP);
  ok('y el Set-Cookie del Worker le llega al navegador', (rp.headers.get('set-cookie') || '').startsWith('lg_ses='));
  await proxy.fetch(new Request('https://underlegends.pages.dev/api/avisos/votar', { method: 'POST', body: '{}' }), envP);
  ok('sin cookie, no inventa ninguna sesión', fue && !fue.h['x-lg-ses']);
  globalThis.fetch = antesF;
  env.AVISOS = antesA;
  delete PUESTO.encuestas;
}

console.log('\nEL PRECIO POR CABEZA\n');

{
  // 🔑 Dlx, 27-28/09/2026: Puntos de Tienda, 5.000 para todos, tope 20.000
  // por cabeza, vuelve si nadie caza; «1. Ambos. 2. B». Los números llegan del
  // ciclo por KV (`precios`, ver bot/precios.py); acá no hay ninguno escrito.
  const A = await import('./avisos.js');
  const idDe = (ms, n = 9) => String((BigInt(ms - 1420070400000) << 22n) + BigInt(n));
  const VIEJO = idDe(Date.parse('2019-05-01T00:00:00Z'));
  const cfg = { cabezas: ['Ana', 'Bea'], yo: { [VIEJO]: 'Bea' }, fin: new Date(RELOJ + 86400000).toISOString(),
    desde: '', inicial: 5000, min: 500, paso: 100, tope: 20000 };
  const v = (d, id) => A.validarPrecio(cfg, d, id || VIEJO, RELOJ);
  const bueno = v({ cabeza: 'Ana', monto: 1500 });
  ok('un precio bueno vale, con los números que dejó el ciclo',
     bueno.cabeza === 'Ana' && bueno.monto === 1500 && bueno.inicial === 5000 && bueno.tope === 20000 &&
     bueno.fin === Date.parse(cfg.fin), JSON.stringify(bueno));
  ok('a vos mismo, no', v({ cabeza: 'Bea', monto: 1000 }).error === 'vos');
  ok('a quien no juega la temporada (o es fuera de concurso), no', v({ cabeza: 'Zoe', monto: 1000 }).error === 'cabeza');
  ok('menos del mínimo, o no de a 100, no', v({ cabeza: 'Ana', monto: 400 }).error === 'monto' &&
     v({ cabeza: 'Ana', monto: 550 }).error === 'monto' && v({ cabeza: 'Ana', monto: '1e3' }).error === 'monto');
  ok('una cuenta nueva, no', v({ cabeza: 'Ana', monto: 1000 }, idDe(RELOJ - 86400000)).error === 'nueva');
  ok('terminada la semana, no', A.validarPrecio(cfg, { cabeza: 'Ana', monto: 1000 }, VIEJO,
     Date.parse(cfg.fin) + 1).error === 'cerrada');
  ok('sin los números del ciclo, nada (no se inventa un tope)',
     A.validarPrecio({ cabezas: ['Ana'], fin: cfg.fin }, { cabeza: 'Ana', monto: 1000 }, VIEJO, RELOJ).error === 'todavia');

  // la ruta entera: Discord, KV y el objeto
  const antesF = globalThis.fetch, antesA = env.AVISOS;
  const alObjeto = [];
  env.AVISOS = { idFromName: () => 'liga', get: () => ({ fetch: async (url, opc) => { if (/\/(uso|medir)$/.test(String(url))) return new Response('{"ok":true}');
    alObjeto.push([String(url), opc && opc.body ? JSON.parse(opc.body) : null]);
    return new Response('{"ok":true,"saldo":3500}', { status: 200 });
  } }) };
  PUESTO.precios = JSON.stringify(cfg);
  globalThis.fetch = async (u) => (/\/(users|oauth2)\/@me$/.test(String(u))
    ? new Response(JSON.stringify(String(u).endsWith('/oauth2/@me') ? { application: { id: APP_ID }, user: { id: VIEJO, username: 'x' } } : { id: VIEJO, username: 'x' }), { status: 200 })
    : new Response('{}', { status: 404 }));
  const pedirP = async (ruta, cuerpo) => {
    const r = await worker.fetch(new Request('https://x/avisos/' + ruta, { method: 'POST',
      body: JSON.stringify(cuerpo) }), env, ctx);
    return { status: r.status, json: JSON.parse(await r.text()) };
  };
  let r = await pedirP('precio', { token: 'permisoBueno1234567890', cabeza: 'Ana', monto: 1500, quien: '42424242424' });
  ok('un precio llega al objeto con el ID de Discord, no con el de la página, y con los números del ciclo',
     r.status === 200 && alObjeto.length === 1 && alObjeto[0][0].endsWith('/precio') &&
     alObjeto[0][1].quien === VIEJO && alObjeto[0][1].monto === 1500 && alObjeto[0][1].tope === 20000,
     JSON.stringify(alObjeto));
  r = await pedirP('precio', { token: 'permisoBueno1234567890', cabeza: 'Bea', monto: 1500 });
  ok('a sí mismo: 403, y no llega al objeto', r.status === 403 && alObjeto.length === 1);
  r = await pedirP('billetera', { token: 'permisoBueno1234567890' });
  ok('la billetera: pregunta al objeto por ese ID, con lo de arranque', r.status === 200 && alObjeto.length === 2 &&
     alObjeto[1][0].endsWith('/billetera') && alObjeto[1][1].quien === VIEJO && alObjeto[1][1].inicial === 5000);
  globalThis.fetch = async () => new Response('{"message":"401: Unauthorized"}', { status: 401 });
  r = await pedirP('billetera', { token: 'permisoFalso1234567890' });
  ok('sin un permiso que Discord reconozca, no hay billetera', r.status === 401 && alObjeto.length === 2);
  alObjeto.length = 0;
  r = await worker.fetch(new Request('https://x/avisos/precios'), env, ctx);
  ok('/avisos/precios le pregunta al objeto (lo público: nunca quién puso)', r.status === 200 &&
     alObjeto.length === 1 && alObjeto[0][0].endsWith('/precios'));
  globalThis.fetch = antesF;
  env.AVISOS = antesA;
  delete PUESTO.precios;
}

console.log('\nSEGUIR RAPEROS\n');

{
  // 🔑 Dlx, 28/09/2026: «sí, hay que hacer eso». Quién sigue lo dice Discord
  // (o la sesión); a quién, la página; tu perfil, KV (`d:<id>`).
  const idDe = (ms, n = 5) => String((BigInt(ms - 1420070400000) << 22n) + BigInt(n));
  const VIEJO = idDe(Date.parse('2019-02-01T00:00:00Z'));
  const SES = 'c'.repeat(43);
  const antesF = globalThis.fetch, antesA = env.AVISOS;
  const alObjeto = [];
  env.AVISOS = { idFromName: () => 'liga', get: () => ({ fetch: async (url, opc) => { if (/\/(uso|medir)$/.test(String(url))) return new Response('{"ok":true}');
    const u = String(url), b = opc && opc.body ? JSON.parse(opc.body) : null;
    alObjeto.push([u, b]);
    if (u.endsWith('/sesion/quien')) return b && b.ses === SES ? new Response(JSON.stringify({ quien: VIEJO }),
      { status: 200 }) : new Response('{"error":"no"}', { status: 404 });
    return new Response('{"ok":true,"sigo":["ana"],"n":{"ana":1}}', { status: 200 });
  } }) };
  PUESTO['d:' + VIEJO] = 'bea';
  globalThis.fetch = async () => new Response('{"message":"401: Unauthorized"}', { status: 401 });
  const pedirS = async (ruta, cuerpo, ses) => {
    const r = await worker.fetch(new Request('https://x/avisos/' + ruta, { method: 'POST', body: JSON.stringify(cuerpo),
      headers: ses ? { 'x-lg-ses': ses } : {} }), env, ctx);
    return { status: r.status, json: JSON.parse(await r.text()) };
  };
  let r = await pedirS('seguir', { a: 'ana', quien: '42424242424' }, SES);
  const al = alObjeto.filter(([u]) => u.endsWith('/seguir'));
  ok('seguir llega al objeto con el ID de la sesión (no el de la página) y con tu perfil de KV',
     r.status === 200 && al.length === 1 && al[0][1].quien === VIEJO && al[0][1].de === 'bea' &&
     JSON.stringify(al[0][1].a) === '["ana"]' && al[0][1].si === true, JSON.stringify(al));
  r = await pedirS('seguir', { a: 'ana', si: false }, SES);
  ok('dejar de seguir va con si:false', r.status === 200 && alObjeto.filter(([u]) => u.endsWith('/seguir'))[1][1].si === false);
  alObjeto.length = 0;
  r = await pedirS('seguir', { a: '../x' }, SES);
  ok('una clave que no es de perfil: 400, sin preguntarle a nadie', r.status === 400 && !alObjeto.length);
  r = await pedirS('seguir', { a: Array(61).fill('ana') }, SES);
  ok('más de 60 de una vez: 400', r.status === 400 && !alObjeto.length);
  r = await pedirS('seguir', { a: 'ana' });
  ok('sin sesión ni permiso: 401 «sin_sesion» y no llega al objeto',
     r.status === 401 && r.json.error === 'sin_sesion' && !alObjeto.some(([u]) => u.endsWith('/seguir')));
  r = await pedirS('sigo', {}, SES);
  ok('a quién seguís: con tu ID y tu perfil', r.status === 200 &&
     alObjeto.some(([u, b]) => u.endsWith('/sigo') && b.quien === VIEJO && b.de === 'bea'));
  alObjeto.length = 0;
  r = await worker.fetch(new Request('https://x/avisos/seguidores'), env, ctx);
  ok('/avisos/seguidores le pregunta al objeto (lo público: cuántos, nunca quién)',
     r.status === 200 && alObjeto.length === 1 && alObjeto[0][0].endsWith('/seguidores'));
  // el proxy de Pages: las tres pasan, con la sesión en los POST
  const { default: proxy } = await import('./paginas/_worker.js');
  let fue = null;
  globalThis.fetch = async (u, opc) => {
    fue = { u: String(u), h: (opc && opc.headers) || {}, cf: opc && opc.cf };
    return new Response('{"ok":true}', { status: 200 });
  };
  const envP = { ASSETS: { fetch: async () => new Response('<html>', { status: 200 }) } };
  await proxy.fetch(new Request('https://underlegends.pages.dev/api/avisos/seguir', { method: 'POST', body: '{"a":"ana"}',
    headers: { cookie: 'lg_ses=' + SES } }), envP);
  ok('el proxy deja pasar /seguir con la sesión', fue && fue.u.endsWith('/avisos/seguir') && fue.h['x-lg-ses'] === SES);
  await proxy.fetch(new Request('https://underlegends.pages.dev/api/avisos/seguidores'), envP);
  ok('y /seguidores, con un minuto en el borde', fue && fue.u.endsWith('/avisos/seguidores') && fue.cf &&
     fue.cf.cacheTtl === 60);
  globalThis.fetch = antesF;
  env.AVISOS = antesA;
  delete PUESTO['d:' + VIEJO];
}

console.log('\n👏 FELICITAR\n');

{
  // 🔑 Dlx, 02/10/2026: «algo más para que enganche a las personas o interactivo». Quién felicita lo dice Discord (o
  // la sesión); qué publicación, el muro de KV —nunca la página—; tus perfiles, KV (`d:` y `dn:`).
  const idDe = (ms, n = 7) => String((BigInt(ms - 1420070400000) << 22n) + BigInt(n));
  const VIEJO = idDe(Date.parse('2019-04-01T00:00:00Z'));
  const NUEVO = idDe(RELOJ - 3 * 86400000);
  const SES = 'e'.repeat(43), SES_N = 'f'.repeat(43);
  const antesF = globalThis.fetch, antesA = env.AVISOS;
  const alObjeto = [];
  env.AVISOS = { idFromName: () => 'liga', get: () => ({ fetch: async (url, opc) => { if (/\/(uso|medir)$/.test(String(url))) return new Response('{"ok":true}');
    const u = String(url), b = opc && opc.body ? JSON.parse(opc.body) : null;
    alObjeto.push([u, b]);
    if (u.endsWith('/sesion/quien')) {
      const q = b && b.ses === SES ? VIEJO : b && b.ses === SES_N ? NUEVO : '';
      return q ? new Response(JSON.stringify({ quien: q }), { status: 200 }) : new Response('{"error":"no"}', { status: 404 });
    }
    return new Response('{"ok":true,"n":4}', { status: 200 });
  } }) };
  PUESTO['web:muro'] = JSON.stringify({ items: [
    { id: 'aaaaaaaaaaaa', tipo: 'campeon', t: '2026-10-01T04:20:41Z', quien: ['Oasis', 'Bea'], ks: ['oasis', 'bea'], ev: 'TOKYO' },
    { id: 'bbbbbbbbbbbb', tipo: 'tarjeta', t: '2026-10-01T04:20:41Z', quien: ['Ana'], ks: ['ana'], carta: 'pais' },
    { id: 'cccccccccccc', tipo: 'rango', t: '2026-10-01T04:20:41Z', quien: ['Cid'], ks: ['cid'], rg: 'B' },
  ] });
  PUESTO['dn:' + VIEJO] = 'bea';
  globalThis.fetch = async () => new Response('{"message":"401: Unauthorized"}', { status: 401 });
  const pedirF = async (cuerpo, ses) => {
    const r = await worker.fetch(new Request('https://x/avisos/felicitar', { method: 'POST', body: JSON.stringify(cuerpo),
      headers: ses ? { 'x-lg-ses': ses } : {} }), env, ctx);
    return { status: r.status, json: JSON.parse(await r.text()) };
  };
  let r = await pedirF({ id: 'cccccccccccc', quien: '42424242424' }, SES);
  const al = alObjeto.filter(([u]) => u.endsWith('/aplaudir'));
  ok('felicitar llega al objeto con el ID de la sesión (no el de la página) y la publicación sacada del muro',
     r.status === 200 && al.length === 1 && al[0][1].quien === VIEJO && al[0][1].pub.id === 'cccccccccccc' &&
     al[0][1].pub.motivo === 'subir a rango B' && JSON.stringify(al[0][1].pub.ks) === '["cid"]', JSON.stringify(al));
  alObjeto.length = 0;
  r = await pedirF({ id: 'aaaaaaaaaaaa' }, SES);
  ok('a uno mismo no (su perfil, aunque no esté verificado: dn:): 403 «vos»',
     r.status === 403 && r.json.error === 'vos' && !alObjeto.some(([u]) => u.endsWith('/aplaudir')));
  r = await pedirF({ id: 'bbbbbbbbbbbb' }, SES);
  ok('una carta nueva no es un logro: 400', r.status === 400 && r.json.error === 'no_se_felicita');
  r = await pedirF({ id: 'dddddddddddd' }, SES);
  ok('lo que no está en el muro: 404', r.status === 404 && r.json.error === 'no_existe');
  r = await pedirF({ id: 'cccccccccccc' }, SES_N);
  ok('una cuenta de Discord de menos de 30 días no felicita, y se le dice desde cuándo',
     r.status === 403 && r.json.error === 'nueva' && !!r.json.desde);
  r = await pedirF({ id: '../x' }, SES);
  ok('un id que no es de publicación: 400, sin preguntarle a nadie', r.status === 400 && r.json.error === 'faltan datos');
  r = await pedirF({ id: 'cccccccccccc' });
  ok('sin sesión ni permiso: 401 «sin_sesion»', r.status === 401 && r.json.error === 'sin_sesion' &&
     !alObjeto.some(([u]) => u.endsWith('/aplaudir')));
  alObjeto.length = 0;
  r = await worker.fetch(new Request('https://x/avisos/aplausos'), env, ctx);
  ok('/avisos/aplausos le pregunta al objeto (cuántos, nunca quién)',
     r.status === 200 && alObjeto.length === 1 && alObjeto[0][0].endsWith('/aplausos'));
  r = await worker.fetch(new Request('https://x/avisos/aplaudir', { method: 'POST', body: '{"quien":"1","pub":{}}' }), env, ctx);
  ok('la ruta de adentro (`/aplaudir`) no existe desde afuera', r.status === 404);
  const { default: proxy } = await import('./paginas/_worker.js');
  let fue = null;
  globalThis.fetch = async (u, opc) => {
    fue = { u: String(u), h: (opc && opc.headers) || {}, cf: opc && opc.cf };
    return new Response('{"ok":true}', { status: 200 });
  };
  const envP = { ASSETS: { fetch: async () => new Response('<html>', { status: 200 }) } };
  await proxy.fetch(new Request('https://underlegends.pages.dev/api/avisos/felicitar', { method: 'POST',
    body: '{"id":"cccccccccccc"}', headers: { cookie: 'lg_ses=' + SES } }), envP);
  ok('el proxy deja pasar /felicitar con la sesión', fue && fue.u.endsWith('/avisos/felicitar') && fue.h['x-lg-ses'] === SES);
  await proxy.fetch(new Request('https://underlegends.pages.dev/api/avisos/aplausos'), envP);
  ok('y /aplausos, con 30 s en el borde', fue && fue.u.endsWith('/avisos/aplausos') && fue.cf && fue.cf.cacheTtl === 30);
  // 🔔 la bandeja: con la sesión, y el «visto» pasa tal cual (nunca otro quien)
  await proxy.fetch(new Request('https://underlegends.pages.dev/api/avisos/bandeja', { method: 'POST', body: '{"visto":true}',
    headers: { cookie: 'lg_ses=' + SES } }), envP);
  ok('el proxy deja pasar /bandeja con la sesión', fue && fue.u.endsWith('/avisos/bandeja') && fue.h['x-lg-ses'] === SES);
  globalThis.fetch = async () => new Response('{"message":"401: Unauthorized"}', { status: 401 });
  alObjeto.length = 0;
  const pedirB = async (cuerpo, ses) => {
    const rr = await worker.fetch(new Request('https://x/avisos/bandeja', { method: 'POST', body: JSON.stringify(cuerpo),
      headers: ses ? { 'x-lg-ses': ses } : {} }), env, ctx);
    return { status: rr.status, json: JSON.parse(await rr.text()) };
  };
  r = await pedirB({ visto: true, quien: '42424242424' }, SES);
  const ab = alObjeto.filter(([u]) => u.endsWith('/bandeja'));
  ok('la bandeja llega al objeto con el ID de la sesión (no el de la página) y el visto',
     r.status === 200 && ab.length === 1 && ab[0][1].quien === VIEJO && ab[0][1].visto === true, JSON.stringify(ab));
  alObjeto.length = 0;
  r = await pedirB({});
  ok('sin sesión: 401 «sin_sesion», y no llega al objeto', r.status === 401 && r.json.error === 'sin_sesion' &&
     !alObjeto.some(([u]) => u.endsWith('/bandeja')));
  // 🤝 la postulación de /sumate (03/10/2026): validada afuera, con el ID de la sesión, y sin sesión no pasa
  const pedirS = async (cuerpo, ses) => {
    const rr = await worker.fetch(new Request('https://x/avisos/sumate', { method: 'POST', body: JSON.stringify(cuerpo),
      headers: ses ? { 'x-lg-ses': ses } : {} }), env, ctx);
    return { status: rr.status, json: JSON.parse(await rr.text()) };
  };
  alObjeto.length = 0;
  r = await pedirS({ tipo: 'servidor', nombre: 'Rap Zone', link: 'https://discord.gg/abc', eventos: '2', quien: '42424242424' }, SES);
  const ps = alObjeto.filter(([u]) => u.endsWith('/sumate'));
  ok('la postulación llega al objeto con el ID de la sesión (no el de la página), ya validada',
     r.status === 200 && ps.length === 1 && ps[0][1].quien === VIEJO && ps[0][1].p.nombre === 'Rap Zone' && ps[0][1].p.eventos === 2,
     JSON.stringify(ps));
  alObjeto.length = 0;
  r = await pedirS({ tipo: 'servidor', nombre: 'x' }, SES);
  ok('sin nombre: 400 con qué falta, y no llega al objeto', r.status === 400 && r.json.error === 'faltan' && !alObjeto.length);
  r = await pedirS({ tipo: 'servidor', nombre: 'Rap Zone' });
  ok('sin sesión: 401, y no llega al objeto', r.status === 401 && !alObjeto.length);
  globalThis.fetch = async (u, opc) => {
    fue = { u: String(u), h: (opc && opc.headers) || {} };
    return new Response('{"ok":true}', { status: 200 });
  };
  await proxy.fetch(new Request('https://underlegends.pages.dev/api/avisos/sumate', { method: 'POST', body: '{"tipo":"otro","nombre":"X Y"}',
    headers: { cookie: 'lg_ses=' + SES } }), envP);
  ok('el proxy deja pasar /sumate con la sesión', fue && fue.u.endsWith('/avisos/sumate') && fue.h['x-lg-ses'] === SES);
  globalThis.fetch = antesF;
  env.AVISOS = antesA;
  delete PUESTO['web:muro'];
  delete PUESTO['dn:' + VIEJO];
}

console.log('\n«TU SERVIDOR»\n');

{
  // 🔑 Dlx, 28/09/2026: «La idea es q la gente decida por su cuenta» y
  // «1. A 2. A»: en Mi cuenta, uno por temporada como la foto.
  const idDe = (ms, n = 6) => String((BigInt(ms - 1420070400000) << 22n) + BigInt(n));
  const VIEJO = idDe(Date.parse('2019-03-01T00:00:00Z'));
  const SES = 'd'.repeat(43);
  const antesF = globalThis.fetch, antesA = env.AVISOS;
  const antesT = env.TEMPORADA, antesL = env.FOTO_LIBRE_HASTA;
  env.TEMPORADA = 't1';
  env.FOTO_LIBRE_HASTA = '2026-10-09T04:00:00Z';
  const alObjeto = [];
  env.AVISOS = { idFromName: () => 'liga', get: () => ({ fetch: async (url, opc) => { if (/\/(uso|medir)$/.test(String(url))) return new Response('{"ok":true}');
    const u = String(url), b = opc && opc.body ? JSON.parse(opc.body) : null;
    alObjeto.push([u, b]);
    if (u.endsWith('/sesion/quien')) return b && b.ses === SES ? new Response(JSON.stringify({ quien: VIEJO }),
      { status: 200 }) : new Response('{"error":"no"}', { status: 404 });
    return new Response('{"ok":true,"sv":"FFA"}', { status: 200 });
  } }) };
  PUESTO['d:' + VIEJO] = 'bea';
  globalThis.fetch = async () => new Response('{"message":"401: Unauthorized"}', { status: 401 });
  const pedirM = async (cuerpo, ses) => {
    const r = await worker.fetch(new Request('https://x/avisos/mi-servidor', { method: 'POST',
      body: JSON.stringify(cuerpo), headers: ses ? { 'x-lg-ses': ses } : {} }), env, ctx);
    return { status: r.status, json: JSON.parse(await r.text()) };
  };
  let r = await pedirM({ sv: 'FFA', quien: '42424242424' }, SES);
  const al = alObjeto.filter(([u]) => u.endsWith('/mi-servidor'));
  ok('elegir llega al objeto con el ID de la sesión, tu perfil, la temporada y la ventana libre de la foto',
     r.status === 200 && al.length === 1 && al[0][1].quien === VIEJO && al[0][1].de === 'bea' &&
     al[0][1].sv === 'FFA' && al[0][1].temporada === 't1' &&
     al[0][1].libre_hasta === Date.parse('2026-10-09T04:00:00Z'), JSON.stringify(al));
  r = await pedirM({}, SES);
  ok('sin servidor, sólo lo lee', r.status === 200 &&
     alObjeto.filter(([u]) => u.endsWith('/mi-servidor'))[1][1].sv === undefined);
  alObjeto.length = 0;
  r = await pedirM({ sv: 'ffa; drop' }, SES);
  ok('un servidor con forma rara: 400, sin preguntarle a nadie', r.status === 400 && !alObjeto.length);
  r = await pedirM({ sv: 'SR' });
  ok('sin sesión ni permiso: 401 y no llega al objeto', r.status === 401 &&
     !alObjeto.some(([u]) => u.endsWith('/mi-servidor')));
  alObjeto.length = 0;
  r = await worker.fetch(new Request('https://x/avisos/servidores'), env, ctx);
  ok('/avisos/servidores le pregunta al objeto (lo público: el servidor de cada perfil)',
     r.status === 200 && alObjeto.length === 1 && alObjeto[0][0].endsWith('/servidores'));
  const { default: proxy } = await import('./paginas/_worker.js');
  let fue = null;
  globalThis.fetch = async (u, opc) => {
    fue = { u: String(u), h: (opc && opc.headers) || {}, cf: opc && opc.cf };
    return new Response('{"ok":true}', { status: 200 });
  };
  const envP = { ASSETS: { fetch: async () => new Response('<html>', { status: 200 }) } };
  await proxy.fetch(new Request('https://underlegends.pages.dev/api/avisos/mi-servidor', { method: 'POST',
    body: '{"sv":"FFA"}', headers: { cookie: 'lg_ses=' + SES } }), envP);
  ok('el proxy deja pasar /mi-servidor con la sesión', fue && fue.u.endsWith('/avisos/mi-servidor') &&
     fue.h['x-lg-ses'] === SES);
  await proxy.fetch(new Request('https://underlegends.pages.dev/api/avisos/servidores'), envP);
  ok('y /servidores, con un minuto en el borde', fue && fue.u.endsWith('/avisos/servidores') && fue.cf &&
     fue.cf.cacheTtl === 60);
  // 🙈 «ocultar mi foto» (02/10/2026): lo mismo que «tu servidor», con un sí/no
  globalThis.fetch = async () => new Response('{"message":"401: Unauthorized"}', { status: 401 });
  alObjeto.length = 0;
  const pedirF = async (cuerpo, ses) => {
    const r = await worker.fetch(new Request('https://x/avisos/mi-foto', { method: 'POST',
      body: JSON.stringify(cuerpo), headers: ses ? { 'x-lg-ses': ses } : {} }), env, ctx);
    return { status: r.status };
  };
  r = await pedirF({ ocultar: true, quien: '42424242424' }, SES);
  const af = alObjeto.filter(([u]) => u.endsWith('/mi-foto'));
  ok('ocultar la foto llega al objeto con el ID de la sesión (no el que manda la página)',
     r.status === 200 && af.length === 1 && af[0][1].quien === VIEJO && af[0][1].ocultar === true, JSON.stringify(af));
  r = await pedirF({}, SES);
  ok('sin «ocultar», sólo lo lee', r.status === 200 && alObjeto.filter(([u]) => u.endsWith('/mi-foto'))[1][1].ocultar === undefined);
  alObjeto.length = 0;
  r = await pedirF({ ocultar: 'sí' }, SES);
  ok('un «ocultar» que no es sí/no: 400, sin preguntarle a nadie', r.status === 400 && !alObjeto.length);
  r = await pedirF({ ocultar: true });
  ok('sin sesión ni permiso: 401 y no llega al objeto', r.status === 401 && !alObjeto.some(([u]) => u.endsWith('/mi-foto')));
  globalThis.fetch = async (u, opc) => {
    fue = { u: String(u), h: (opc && opc.headers) || {}, cf: opc && opc.cf };
    return new Response('{"ok":true}', { status: 200 });
  };
  await proxy.fetch(new Request('https://underlegends.pages.dev/api/avisos/mi-foto', { method: 'POST',
    body: '{"ocultar":true}', headers: { cookie: 'lg_ses=' + SES } }), envP);
  ok('el proxy deja pasar /mi-foto con la sesión', fue && fue.u.endsWith('/avisos/mi-foto') && fue.h['x-lg-ses'] === SES);
  globalThis.fetch = antesF;
  env.AVISOS = antesA;
  env.TEMPORADA = antesT;
  env.FOTO_LIBRE_HASTA = antesL;
  delete PUESTO['d:' + VIEJO];
}


console.log('\n«EL DASHBOARD DEL DUEÑO»\n');
{
  // 🔒 Dlx, 04/10/2026: «la única manera de iniciar sesión ahí es con mi cuenta». La puerta es el servidor
  const { DUENO } = await import('./avisos.js');
  const SES_D = 'g'.repeat(43), SES_O = 'h'.repeat(43);
  const antesF = globalThis.fetch, antesA = env.AVISOS;
  const alObjeto = [];
  env.AVISOS = { idFromName: () => 'liga', get: () => ({ fetch: async (url, opc) => { if (/\/(uso|medir)$/.test(String(url))) return new Response('{"ok":true}');
    const u = String(url), b = opc && opc.body ? JSON.parse(opc.body) : null;
    alObjeto.push([u, b]);
    if (u.endsWith('/sesion/quien')) {
      return b && b.ses === SES_D ? new Response(JSON.stringify({ quien: DUENO }), { status: 200 })
        : b && b.ses === SES_O ? new Response(JSON.stringify({ quien: '562063579545600007' }), { status: 200 })
          : new Response('{"error":"no"}', { status: 404 });
    }
    return new Response('{"uso":{"semana":{}},"dias":[],"sistema":{}}', { status: 200 });
  } }) };
  globalThis.fetch = async () => new Response('{"message":"401: Unauthorized"}', { status: 401 });
  const pedirD = async (ses) => {
    const r = await worker.fetch(new Request('https://x/avisos/dueno', { method: 'POST', body: '{}',
      headers: ses ? { 'x-lg-ses': ses } : {} }), env, ctx);
    return { status: r.status, json: JSON.parse(await r.text()) };
  };
  let r = await pedirD(SES_D);
  ok('el dueño entra: llega al objeto y vuelve lo del Dashboard', r.status === 200 && !!r.json.uso &&
     alObjeto.some(([u]) => u.endsWith('/dueno')));
  alObjeto.length = 0;
  r = await pedirD(SES_O);
  ok('otra cuenta: 403 y no llega al objeto', r.status === 403 && r.json.error === 'no' && !alObjeto.some(([u]) => u.endsWith('/dueno')));
  r = await pedirD();
  ok('sin sesión: 401 y no llega al objeto', r.status === 401 && !alObjeto.some(([u]) => u.endsWith('/dueno')));
  // (que el estado público no trae el uso se prueba sobre el objeto de verdad: acá el objeto es de mentira)
  globalThis.fetch = antesF;
  env.AVISOS = antesA;
}

console.log('\n«LA RACHA DIARIA Y LOS NIVELES»\n');
{
  // 🔥 Dlx, 04/10/2026. Tu racha va con tu sesión y pedirla cuenta el día (pasa por `quienPide()`, que anota el uso);
  // la de cada perfil es pública y va por clave, nunca por Discord ID
  const SES = 'k'.repeat(43), YO = '562063579545600007';
  const antesF = globalThis.fetch, antesA = env.AVISOS;
  const alObjeto = [];
  env.AVISOS = { idFromName: () => 'liga', get: () => ({ fetch: async (url, opc) => {
    const u = String(url), b = opc && opc.body ? JSON.parse(opc.body) : null;
    alObjeto.push([u, b]);
    if (u.endsWith('/uso')) return new Response('{"ok":true}');
    if (u.endsWith('/sesion/quien')) {
      return b && b.ses === SES ? new Response(JSON.stringify({ quien: YO }), { status: 200 }) : new Response('{"error":"no"}', { status: 404 });
    }
    if (u.endsWith('/niveles')) return new Response('{"t":1,"n":{"ana":[3,5]}}', { status: 200 });
    return new Response(JSON.stringify({ racha: { actual: 5 }, nivel: { n: 3 } }), { status: 200 });
  } }) };
  globalThis.fetch = async () => new Response('{"message":"401: Unauthorized"}', { status: 401 });
  const pedir = async (ses) => {
    const r = await worker.fetch(new Request('https://x/avisos/racha', { method: 'POST', body: '{}',
      headers: ses ? { 'x-lg-ses': ses } : {} }), env, ctx);
    return { status: r.status, json: JSON.parse(await r.text()) };
  };
  let r = await pedir(SES);
  const aRacha = alObjeto.find(([u]) => u.endsWith('/racha'));
  ok('con sesión: llega al objeto con SU Discord ID, y el día se anota antes',
     r.status === 200 && r.json.racha.actual === 5 && aRacha && aRacha[1].quien === YO &&
     alObjeto.findIndex(([u]) => u.endsWith('/uso')) < alObjeto.findIndex(([u]) => u.endsWith('/racha')));
  alObjeto.length = 0;
  r = await pedir();
  ok('sin sesión: 401 y no llega al objeto', r.status === 401 && !alObjeto.some(([u]) => u.endsWith('/racha')));
  const g = await worker.fetch(new Request('https://x/avisos/niveles'), env, ctx);
  ok('los niveles de los perfiles: públicos, por clave', g.status === 200 && JSON.parse(await g.text()).n.ana[0] === 3);
  globalThis.fetch = antesF;
  env.AVISOS = antesA;
}

console.log('\n«LOS AJUSTES DEL DASHBOARD»\n');
{
  // ⚙️ Dlx, 04/10/2026: «todo y muchas más cosas». La misma puerta que el Dashboard, y el valor se valida ANTES de
  // llegar al objeto. Lo que el objeto hace con cada ajuste se prueba sobre el de verdad (SQLite)
  const { DUENO, claveCiclo } = await import('./avisos.js');
  const SES_D = 'g'.repeat(43), SES_O = 'h'.repeat(43);
  const antesF = globalThis.fetch, antesA = env.AVISOS, antesT = env.DISCORD_TOKEN;
  env.DISCORD_TOKEN = 'token-de-prueba';
  const alObjeto = [];
  env.AVISOS = { idFromName: () => 'liga', get: () => ({ fetch: async (url, opc) => { if (/\/(uso|medir)$/.test(String(url))) return new Response('{"ok":true}');
    const u = String(url), b = opc && opc.body ? JSON.parse(opc.body) : null;
    alObjeto.push([u, b]);
    if (u.endsWith('/sesion/quien')) {
      return b && b.ses === SES_D ? new Response(JSON.stringify({ quien: DUENO }), { status: 200 })
        : b && b.ses === SES_O ? new Response(JSON.stringify({ quien: '562063579545600007' }), { status: 200 })
          : new Response('{"error":"no"}', { status: 404 });
    }
    return new Response('{"ok":true,"ajustes":{}}', { status: 200 });
  } }) };
  globalThis.fetch = async () => new Response('{"message":"401: Unauthorized"}', { status: 401 });
  const pedirA = async (ses, cuerpo) => {
    const r = await worker.fetch(new Request('https://x/avisos/dueno/ajuste', { method: 'POST', body: JSON.stringify(cuerpo),
      headers: ses ? { 'x-lg-ses': ses } : {} }), env, ctx);
    return { status: r.status, json: JSON.parse(await r.text()) };
  };
  const alAjuste = () => alObjeto.filter(([u]) => u.endsWith('/ajuste')).map(([, b]) => b);
  let r = await pedirA(SES_D, { cual: 'campana_pausada', valor: true });
  ok('el dueño pausa la campana: llega al objeto ya validado', r.status === 200 &&
     JSON.stringify(alAjuste()) === '[{"cual":"campana_pausada","valor":true}]');
  alObjeto.length = 0;
  r = await pedirA(SES_D, { cual: 'multiplicadores', valor: { semana: '2026-10-12', sv: { FFA: 9 } } });
  const r2 = await pedirA(SES_D, { cual: 'cualquiera', valor: 1 });
  ok('un factor fuera de rango o un ajuste que no existe: 400, y no llega al objeto',
     r.status === 400 && r2.status === 400 && !alAjuste().length);
  r = await pedirA(SES_O, { cual: 'campana_pausada', valor: true });
  ok('otra cuenta: 403 y no llega al objeto', r.status === 403 && !alAjuste().length);
  r = await pedirA(null, { cual: 'campana_pausada', valor: true });
  ok('sin sesión: 401', r.status === 401 && !alAjuste().length);
  const pedirC = async (k) => (await worker.fetch(new Request('https://x/avisos/ajustes', { headers: k ? { 'x-lg-ciclo': k } : {} }), env, ctx)).status;
  const sinClave = await pedirC(''), malClave = await pedirC('x'.repeat(64));
  ok('los ajustes para el ciclo: sin su clave «no existe» y no llega al objeto',
     sinClave === 404 && malClave === 404 && !alObjeto.some(([u]) => u.endsWith('/ajustes')));
  ok('con la clave del ciclo, sí', await pedirC(await claveCiclo(env.DISCORD_TOKEN)) === 200 && alObjeto.some(([u]) => u.endsWith('/ajustes')));
  globalThis.fetch = antesF;
  env.AVISOS = antesA;
  if (antesT === undefined) delete env.DISCORD_TOKEN; else env.DISCORD_TOKEN = antesT;
}

console.log('\n«LOS ANUNCIOS QUE SON UNA IMAGEN»\n');
{
  // 🖼️ Dlx, 05/10/2026: «¿no puedes hacer una forma para detectar lo que dicen las imágenes?». Sólo para el ciclo y
  // sólo imágenes de Discord; la IA de verdad se prueba arriba, acá se prueba la puerta
  const { claveCiclo } = await import('./avisos.js');
  const antesF = globalThis.fetch, antesT = env.DISCORD_TOKEN, antesAI = env.AI;
  env.DISCORD_TOKEN = 'token-de-prueba';
  const vistos = [];
  env.AI = { run: async (modelo, d) => { vistos.push([modelo, d]); return { response: 'VALHALLA VOL1\n7PM CHILE\nDOMINGO 4 DE OCTUBRE' }; } };
  globalThis.fetch = async () => new Response('no', { status: 404 });
  const IMG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
  const pedirO = async (k, cuerpo) => {
    const r = await worker.fetch(new Request('https://x/avisos/ocr', { method: 'POST', body: cuerpo,
      headers: k ? { 'x-lg-ciclo': k, 'content-type': 'image/jpeg' } : { 'content-type': 'image/jpeg' } }), env, ctx);
    return { status: r.status, json: JSON.parse(await r.text()) };
  };
  const k = await claveCiclo(env.DISCORD_TOKEN);
  let r = await pedirO('', IMG);
  const r2 = await pedirO('x'.repeat(64), IMG);
  ok('sin la clave del ciclo «no existe», y la IA no se toca', r.status === 404 && r2.status === 404 && !vistos.length);
  r = await pedirO(k, new TextEncoder().encode('<html>no soy una imagen</html>'));
  const r3 = await pedirO(k, new Uint8Array(800000).fill(0xff));
  ok('con la clave, lo que no es una imagen: 400; una de más de 700 KB: 413, y la IA no se toca',
     r.status === 400 && r3.status === 413 && !vistos.length);
  r = await pedirO(k, IMG);
  ok('con la clave y un afiche: el texto, renglón por renglón',
     r.status === 200 && r.json.texto.startsWith('VALHALLA VOL1') && vistos.length === 1
     && /^data:image\/jpeg;base64,/.test(vistos[0][1].messages[0].content[1].image_url.url));
  env.AI = { run: async () => ({ response: 'NADA' }) };
  r = await pedirO(k, IMG);
  ok('«NADA» es sin texto', r.status === 200 && r.json.texto === '');
  delete env.AI;
  r = await pedirO(k, IMG);
  ok('sin el binding de la IA: 503, no un error adentro', r.status === 503);
  globalThis.fetch = antesF;
  if (antesAI === undefined) delete env.AI; else env.AI = antesAI;
  if (antesT === undefined) delete env.DISCORD_TOKEN; else env.DISCORD_TOKEN = antesT;
}

console.log('\n«EL PASE DE RAPERO»\n');
{
  // 🎟️ 05/10/2026: el tuyo y «miré una llave en vivo» van con tu sesión, y el `quien` lo pone ella; lo del ciclo, con su
  // clave. Ninguno puede entrar por el reenvío del final de `rutaAvisos()`, que pasa el cuerpo tal cual
  const { claveCiclo } = await import('./avisos.js');
  const SES = 'p'.repeat(43), YO = '562063579545600009', OTRO = '562063579545600010';
  const antesF = globalThis.fetch, antesA = env.AVISOS, antesT = env.DISCORD_TOKEN;
  env.DISCORD_TOKEN = 'token-de-prueba';
  const alObjeto = [];
  env.AVISOS = { idFromName: () => 'liga', get: () => ({ fetch: async (url, opc) => {
    const u = String(url), b = opc && opc.body ? JSON.parse(opc.body) : null;
    alObjeto.push([u, b]);
    if (u.endsWith('/uso')) return new Response('{"ok":true}');
    if (u.endsWith('/sesion/quien')) {
      return b && b.ses === SES ? new Response(JSON.stringify({ quien: YO }), { status: 200 }) : new Response('{"error":"no"}', { status: 404 });
    }
    if (u.endsWith('/pases')) return new Response('{"t":1,"n":{"ana":[7,"",""]}}', { status: 200 });
    return new Response('{"ok":true,"nivel":3}', { status: 200 });
  } }) };
  globalThis.fetch = async () => new Response('{"message":"401: Unauthorized"}', { status: 401 });
  const pedir = async (ruta, cuerpo, h = {}) => {
    const r = await worker.fetch(new Request('https://x/avisos/' + ruta, { method: 'POST', body: JSON.stringify(cuerpo), headers: h }), env, ctx);
    return { status: r.status, json: JSON.parse(await r.text()) };
  };
  let r = await pedir('pase', { quien: OTRO }, { 'x-lg-ses': SES });
  const aPase = alObjeto.find(([u]) => u.endsWith('/pase'));
  ok('tu Pase, con sesión: al objeto va TU Discord ID, aunque el cuerpo diga otro',
     r.status === 200 && aPase && aPase[1].quien === YO);
  alObjeto.length = 0;
  r = await pedir('pase', { quien: OTRO });
  ok('sin sesión: 401 y no llega al objeto', r.status === 401 && !alObjeto.some(([u]) => u.endsWith('/pase')));
  r = await pedir('pase-vivo', { llave: '1424242424242424242' }, { 'x-lg-ses': SES });
  const aVivo = alObjeto.find(([u]) => u.endsWith('/pase-vivo'));
  ok('«miré una llave en vivo», con sesión: con tu ID y la llave', r.status === 200 && aVivo && aVivo[1].quien === YO
     && aVivo[1].llave === '1424242424242424242');
  alObjeto.length = 0;
  r = await pedir('pase-vivo', { llave: '<script>' }, { 'x-lg-ses': SES });
  ok('una llave que no es un id: 400', r.status === 400 && !alObjeto.some(([u]) => u.endsWith('/pase-vivo')));
  const CICLO = { v: 'abc', cfg: { temp: 'prueba' }, sem: [], miembros: [YO], hechas: {} };
  r = await pedir('pase-ciclo', CICLO);
  const r2 = await pedir('pase-ciclo', CICLO, { 'x-lg-ciclo': 'x'.repeat(64) });
  ok('lo del ciclo sin su clave: «no existe», y no llega al objeto',
     r.status === 404 && r2.status === 404 && !alObjeto.some(([u]) => u.endsWith('/pase-ciclo')));
  r = await pedir('pase-ciclo', CICLO, { 'x-lg-ciclo': await claveCiclo(env.DISCORD_TOKEN) });
  const aCiclo = alObjeto.find(([u]) => u.endsWith('/pase-ciclo'));
  ok('con la clave del ciclo: llega tal cual', r.status === 200 && aCiclo && aCiclo[1].v === 'abc' && aCiclo[1].miembros[0] === YO);
  const g = await worker.fetch(new Request('https://x/avisos/pases'), env, ctx);
  ok('el Pase de los perfiles: público, por clave', g.status === 200 && JSON.parse(await g.text()).n.ana[0] === 7);
  globalThis.fetch = antesF;
  env.AVISOS = antesA;
  if (antesT === undefined) delete env.DISCORD_TOKEN; else env.DISCORD_TOKEN = antesT;
}

console.log(mal ? `\n${mal} fallo(s)\n` : '\nTodo bien: la firma es lo único que hay que probar contra Discord.\n');
process.exit(mal ? 1 : 0);
