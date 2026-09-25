/**
 * Registra los comandos en Discord. Se corre A MANO, y sólo cuando cambian.
 *
 *   node bot/registrar.mjs                 -> al servidor de prueba (INSTANTÁNEO)
 *   node bot/registrar.mjs --sv=DRA        -> a ESE servidor de la tabla (INSTANTÁNEO)
 *   node bot/registrar.mjs --global        -> a todos (tarda hasta 1 hora)
 *   node bot/registrar.mjs --borrar        -> deja la lista vacía
 *   node bot/registrar.mjs --invitar       -> los links para meterlo, no toca nada
 *
 * ⚠️ METERLO EN UN SERVIDOR SON **DOS** COSAS, Y LA SEGUNDA NO AVISA. El link
 *    de invitación lo mete; los comandos se registran aparte. Con comandos
 *    por servidor, entrar a uno nuevo y no volver a correr esto deja al bot
 *    adentro y mudo: aparece en la lista de miembros y `/card` no existe.
 *    Por eso `--invitar` imprime el paso dos al lado de cada link, y por eso
 *    `--global` es el que no se puede olvidar: se corre una vez y cubre a los
 *    nueve, incluidos los que todavía no entraron.
 *
 * ⚠️ ES EL ÚNICO LUGAR DONDE APARECE EL TOKEN, y el Worker no lo usa nunca.
 *    Con interacciones por HTTP, el bot no necesita el token en marcha: cada
 *    petición viene firmada y se contesta en la misma respuesta.
 *
 * ⚠️ EL TOKEN NO SE ESCRIBE ACÁ NI SE PEGA EN UN CHAT. Va en `.env`, en la
 *    raíz del proyecto, que ya está en .gitignore:
 *
 *        DISCORD_APP_ID=...
 *        DISCORD_TOKEN=...
 *        DISCORD_GUILD_PRUEBA=...
 *
 *    Si alguna vez entra al historial de git, no alcanza con borrarlo en el
 *    commit siguiente: hay que REGENERARLO en el portal de Discord.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SERVIDORES } from './worker.js';

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)));

// .env sin dependencias: son tres líneas de `CLAVE=valor`.
function entorno() {
  const env = { ...process.env };
  const f = join(RAIZ, '.env');
  if (existsSync(f)) {
    for (const linea of readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = linea.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

// ── Dónde se puede usar cada comando ──────────────────────────────────────
// Dlx, 19/09/2026: «¿cómo puedo usar la app en DMs? veo que hay una opción
// para activar el bot en DMs también».
//
//   integration_types  0 = instalada en un SERVIDOR · 1 = en tu CUENTA
//   contexts           0 = en un servidor · 1 = en el DM con el bot
//                      2 = en cualquier otro DM o grupo
//
// ⚠️ ESTO SÓLO VALE CON `--global`. Un comando registrado por servidor no
// puede llevar `integration_types` ni `contexts` —Discord devuelve 400—, y
// tiene sentido: un comando que vive en un servidor no puede existir en un DM.
// Por eso se sacan solos más abajo cuando el registro es por servidor.
//
// ⚠️ Y HACE FALTA ADEMÁS PRENDER LA INSTALACIÓN EN CUENTA A NIVEL APP, que es
// otra llamada (`PATCH /applications/@me`). Sin eso los comandos se registran
// bien y el botón «Add to My Apps» no aparece: se registra algo que nadie
// puede instalar. Lo hace `--global` solo.
const EN_TODOS_LADOS = { integration_types: [0, 1], contexts: [0, 1, 2] };
// ⚠️ `/numeral` NO va en DM y no es un olvido: cambia tu apodo EN UN SERVIDOR,
// y en un DM no hay servidor del que hablar. Declarándolo sólo en `contexts:
// [0]`, Discord ni lo ofrece ahí, que es mejor que ofrecerlo y contestar que
// no se puede.
const SOLO_EN_SERVIDOR = { integration_types: [0, 1], contexts: [0] };

// ── Los comandos ──────────────────────────────────────────────────────────
// type 1 = slash · type 2 = click derecho en una PERSONA · type 3 = en un MENSAJE
//
// ⚠️ LOS TRES ENTRAN POR EL MISMO ENDPOINT. El click derecho no es una
// integración aparte: es el mismo PUT y el mismo handler, con otro `type`.
// Por eso reemplazan al prefijo sin costar arquitectura — ver CLAUDE.bot.md.
const COMANDOS = [
  {
    name: 'ping',
    type: 1,
    description: '¿está vivo el bot?',
    ...EN_TODOS_LADOS,
  },
  {
    // 🔑 Dlx, 25/09/2026: «correcto». Mira en vivo lo que pide el portón y
    // dice qué falta. No da el rol: eso sigue siendo del ciclo.
    name: 'verificar',
    type: 1,
    description: 'qué te falta para tener tu tarjeta, mirado en Discord ahora mismo',
    ...EN_TODOS_LADOS,
  },
  {
    // 🔑 Dlx, 25/09/2026: «activar las notificaciones de este servidor… ahí
    // te dejará las opciones». Los avisos de eventos, por DM.
    name: 'notify',
    type: 1,
    description: 'avisos de eventos por mensaje directo: elegí de qué servidores',
    ...EN_TODOS_LADOS,
  },
  {
    name: 'website',
    type: 1,
    description: 'el link a la página de la Liga Global',
    ...EN_TODOS_LADOS,
  },
  {
    name: 'help',
    type: 1,
    description: 'qué hace el bot y cómo se usa cada comando',
    ...EN_TODOS_LADOS,
    // ⚠️ `choices` Y NO TEXTO LIBRE. Con una lista cerrada Discord la
    // autocompleta y el valor no puede venir mal escrito, así que el handler
    // no tiene que adivinar qué quiso decir «/help cart».
    options: [
      {
        name: 'comando',
        type: 3,
        description: 'de cuál querés el detalle',
        required: false,
        choices: [
          { name: '/card', value: 'card' },
          { name: '/verificar', value: 'verificar' },
          { name: '/notify', value: 'notify' },
          { name: '/website', value: 'website' },
          { name: '/versus', value: 'versus' },
          { name: '/foto', value: 'foto' },
          { name: '/numeral', value: 'numeral' },
          { name: '/settings', value: 'settings' },
          { name: '/ping', value: 'ping' },
        ],
      },
    ],
  },
  {
    name: 'card',
    type: 1,
    description: 'la carta de alguien',
    ...EN_TODOS_LADOS,
    // ⚠️ SE PIDE POR PERSONA, NO POR NOMBRE. Dlx, 19/09/2026: «si puedes
    // eliminar eso de /card por nombre». El `nombre` existía para los que no
    // tenían su Discord ID cargado —eran 37 de 138— y esa era su única razón
    // de ser. Hoy hay 486 IDs en el padrón y 443 en KV, así que el selector
    // los encuentra; lo que queda del `nombre` es una manera de escribir mal
    // el de otro y llevarse una carta ajena o un «no lo tengo».
    //
    // ⚠️ SI VUELVE A HACER FALTA, el handler del Worker todavía lo entiende:
    // se destapa agregando la opción acá. No hay que reescribir nada.
    options: [
      {
        name: 'quien',
        type: 6,
        description: 'elegí a la persona (si no ponés nada, sos vos)',
        required: false,
      },
    ],
  },
  {
    name: 'versus',
    type: 1,
    description: 'quién gana entre dos, en la categoría que elijas',
    ...EN_TODOS_LADOS,
    // ⚠️ SIN OPCIÓN DE NOMBRE, POR LA MISMA RAZÓN QUE `/card`. Dlx, 19/09:
    // *«si puedes eliminar eso de /card por nombre»* — escribir mal el de otro
    // te trae una carta ajena o un «no lo tengo». El handler del Worker igual
    // entiende `rival_nombre` y `contra_nombre`: se destapan agregándolos acá,
    // sin tocar código.
    options: [
      {
        name: 'rival',
        type: 6,
        description: 'contra quién',
        required: true,
      },
      {
        // ⚠️ `carta` ES UNA SOLA PARA LOS DOS, Y ESO ES EL COMANDO.
        // Dlx, 20/09/2026: *«no se puede competitivo vs temporada, tiene que
        // ser una»*. Es la primera regla del proyecto —«el número de cada
        // carta mide lo que esa carta mide»—: Temporada lleva el OVR de
        // temporada y Competitiva el Score, que ni comparten escala. Con UNA
        // opción para las dos cartas, la combinación mixta no se puede ni
        // escribir.
        name: 'carta',
        type: 3,
        description: 'cuál de las cuatro (por defecto, la de servidor)',
        required: false,
        choices: [
          { name: 'Servidor', value: 'servidor' },
          { name: 'Temporada', value: 'temporada' },
          { name: 'Competitiva', value: 'competitivo' },
          { name: 'País', value: 'pais' },
        ],
      },
      {
        // va último para que el uso corto —`/versus rival:@alguien`— quede a
        // un campo de distancia y no haya que pasar por éste.
        name: 'contra',
        type: 6,
        description: 'quién va del otro lado (si no ponés nada, sos vos)',
        required: false,
      },
    ],
  },
  {
    name: 'numeral',
    type: 1,
    description: 'mostrá u ocultá tu #N del ranking en tu apodo, en ESTE servidor',
    ...SOLO_EN_SERVIDOR,
    // ⚠️ SIN `mostrar` CONTESTA CÓMO ESTÁ. Un toggle a ciegas obliga a
    // acordarse de en qué quedó, y la preferencia es por servidor: la misma
    // persona puede tenerlo prendido en DRA y apagado en FFA.
    options: [
      {
        name: 'mostrar',
        type: 5,                       // BOOLEAN
        description: 'True lo muestra · False lo oculta · sin nada, te digo cómo está',
        required: false,
      },
    ],
  },
  {
    name: 'settings',
    type: 1,
    description: 'ajustes de la Liga en ESTE servidor (admins)',
    ...SOLO_EN_SERVIDOR,
    // ⚠️ `default_member_permissions` NO REEMPLAZA AL CHEQUEO DEL WORKER, lo
    // acompaña. Esto sólo hace que Discord le ESCONDA el comando a quien no
    // tiene el permiso — es comodidad, no seguridad: una interacción se puede
    // mandar igual contra el endpoint. El que decide es `puedeAjustar()`.
    // '268435464' = ADMINISTRATOR (8) | MANAGE_ROLES (1<<28).
    default_member_permissions: '268435464',
  },
  {
    name: 'foto',
    type: 1,
    description: 'usá tu foto de Discord actual como la de tus cartas (una por temporada)',
    // ⚠️ SIN OPCIONES A PROPOSITO. La foto que se guarda es la que tenés
    // puesta AHORA en Discord, y eso ya viene en el payload firmado — pedir
    // un adjunto o una URL sería dejar que alguien suba cualquier imagen a
    // la carta, que es otra cosa y necesita moderación.
    //
    // ⚠️ Y VA TAMBIEN POR MENSAJE DIRECTO. Es una preferencia personal, no
    // algo de un servidor: no lleva SOLO_EN_SERVIDOR.
    //
    // 🔴 Ojo con el rol del pase (`ROL_PASE` en el Worker): sólo se puede
    // leer cuando el comando se corre DENTRO de DRA, porque los roles vienen
    // en `member` y en un DM no hay `member`. Quien tenga el pase y quiera
    // usarlo tiene que correrlo ahí.
  },
  {
    name: 'owner',
    type: 1,
    description: 'la Liga Global por dentro (sólo Dlx)',
    // ⚠️ ESTO ESCONDE EL COMANDO, NO LO PROTEGE. `'8'` = ADMINISTRATOR, así
    // que Discord se lo oculta de la lista a cualquiera que no sea admin —
    // pero en un mensaje directo no se aplica, y el admin de OTRO servidor lo
    // vería igual. El candado de verdad es `esDueno()` en el Worker, que
    // compara contra el ID que Discord firmó. Los dos, a propósito: uno
    // limpia la lista, el otro decide.
    default_member_permissions: '8',
    options: [
      {
        name: 'rangos',
        type: 1,                       // SUB_COMMAND
        description: 'los ocho tramos, y cuántos ven otra letra en el ranking',
      },
      {
        name: 'estado',
        type: 1,
        description: 'el sello del pipeline, cuánta gente y qué hay arriba',
      },
      {
        // 🔴 EL QUE CONTESTA «¿por qué éste no tiene carta?». Lee la MISMA
        // clave de KV que sirve `/card`, así que no puede decir una cosa
        // distinta de la que ve la persona.
        name: 'quien',
        type: 1,
        description: 'qué tiene alguien en KV, y qué le falta',
        options: [
          { name: 'quien', type: 6, description: 'elegilo de la lista', required: false },
          { name: 'nombre', type: 3, description: 'o escribí su nombre de competencia', required: false },
        ],
      },
    ],
  },
  // Próximos, cuando el Worker los conteste:
  // { name: 'perfil', type: 1, description: 'las cuatro cartas de alguien',
  //   options: [{ name: 'quien', type: 3, description: 'el rapero',
  //               required: false, autocomplete: true }] },
  // { name: 'Carta', type: 2 },   // click derecho en la persona
];

const args = process.argv.slice(2);
const global = args.includes('--global');
const borrar = args.includes('--borrar');
const invitar = args.includes('--invitar');
const soloListar = args.includes('--listar');
const pedido = (args.find(a => a.startsWith('--sv=')) || '').slice(5).toUpperCase();

// 🔴 UN FLAG DESCONOCIDO CORTA, Y ANTES NO. Este script REGISTRA comandos
// en Discord por defecto, así que cualquier cosa que no entienda caía en el
// camino de escritura: `--listar`, que no existía, terminaba haciendo un
// `PUT` de los comandos por servidor. Pasó dos veces, y la primera duplicó
// cinco comandos en FFA, un servidor en vivo.
//
// ⚠️ La trampa es que **no fallaba**: imprimía la lista correcta, porque un
// PUT devuelve lo que quedó. El síntoma de haber escrito sin querer era
// exactamente el resultado que se esperaba de una lectura.
//
// Para un script cuyo default es escribir en producción, lo correcto es
// que sólo pase lo que se entiende.
const CONOCIDOS = ['--global', '--borrar', '--invitar', '--listar'];
const raros = args.filter(a => !CONOCIDOS.includes(a) && !a.startsWith('--sv='));
if (raros.length) {
  console.error(`No conozco: ${raros.join(' ')}`);
  console.error(`   Los que hay: ${CONOCIDOS.join(' ')} --sv=<CODIGO>`);
  console.error('   No toqué nada. Este script registra comandos de verdad,');
  console.error('   así que con un flag que no entiendo no hace nada.');
  process.exit(1);
}

const env = entorno();
const APP = env.DISCORD_APP_ID;
const TOKEN = env.DISCORD_TOKEN;

// ⚠️ EL SERVIDOR SALE DE LA TABLA DEL WORKER, NO DE OTRA LISTA. Los nueve
// guild ID ya viven en `SERVIDORES`, que es lo que el bot usa en marcha para
// saber desde dónde lo llamaron. Copiarlos acá sería el error que este
// proyecto ya se comió tres veces: la decisión en un lado y el código
// leyéndola de otro. Si mañana entra un servidor, se agrega ahí y esto lo ve.
const DE_TABLA = pedido ? SERVIDORES.find(s => s.sv === pedido) : null;
if (pedido && !DE_TABLA) {
  console.error(`No conozco el servidor "${pedido}".`);
  console.error('   Los de la tabla: ' + SERVIDORES.map(s => s.sv).join(', '));
  process.exit(1);
}
if (DE_TABLA && !DE_TABLA.guild) {
  console.error(`${pedido} está en la tabla pero sin guild ID.`);
  process.exit(1);
}
const GUILD = DE_TABLA ? DE_TABLA.guild : env.DISCORD_GUILD_PRUEBA;

// ── `--invitar`: los links, y qué falta después de cada uno ───────────────
// No toca nada. Mete el bot con `permissions=0`: no pide un solo permiso, que
// es justo el argumento para que un servidor aliado lo acepte.
//
// ⚠️ VAN LOS DOS SCOPES. Con `applications.commands` solo, los comandos
// entran pero el bot NO se hace miembro del servidor — así que no aparece en
// la lista, `/guilds/{id}/members/search` da 403 y no se le pueden buscar los
// Discord ID a esa gente. El `bot` es el que lo hace entrar de verdad.
if (invitar) {
  const SCOPE = 'bot+applications.commands';
  const base = `https://discord.com/oauth2/authorize?client_id=${APP}&permissions=0&scope=${SCOPE}`;
  let dentro = null;
  if (TOKEN) {
    const r = await fetch('https://discord.com/api/v10/users/@me/guilds',
                          { headers: { Authorization: `Bot ${TOKEN}` } });
    if (r.ok) dentro = new Set((await r.json()).map(g => g.id));
  }
  console.log('\nLINK GENÉRICO (elegís el servidor en el momento):');
  console.log('   ' + base + '\n');
  // ⚠️ INSTALARLA EN TU CUENTA ES OTRO LINK, no una opción del de arriba.
  // `integration_type=1` y SIN el scope `bot`: no entra a ningún servidor, se
  // engancha a tu usuario y los comandos te siguen a DMs y a cualquier lado.
  console.log('EN TU CUENTA, para usarla en DMs y donde sea (no entra a ningún servidor):');
  console.log(`   https://discord.com/oauth2/authorize?client_id=${APP}` +
              '&integration_type=1&scope=applications.commands\n');
  console.log('UNO POR SERVIDOR (ya viene elegido):\n');
  for (const s of SERVIDORES) {
    if (!s.guild) continue;
    const esta = dentro ? (dentro.has(s.guild) ? 'ADENTRO' : 'falta  ') : '   ?   ';
    console.log(`  ${esta}  ${s.sv.padEnd(5)} ${s.nombre}`);
    console.log(`           ${base}&guild_id=${s.guild}&disable_guild_select=true`);
  }
  // ⚠️ ESTE AVISO DECÍA QUE HABÍA QUE REGISTRAR LOS COMANDOS DESPUÉS DE
  // INVITAR, y desde el 19/09/2026 ya no: están registrados **global**, así
  // que en un servidor nuevo existen solos. Dejarlo habría mandado a correr un
  // `--sv=` que hoy CREA DUPLICADOS —un comando por servidor y otro global se
  // dibujan los dos, y Dlx ya vio dos `/card` en la lista—.
  console.log('\n✅ NO HAY PASO DOS: los comandos están registrados GLOBAL, así');
  console.log('   que en cuanto el bot entre, `/card` funciona ahí solo.');
  console.log('\n⚠️ PERO SÍ HAY QUE VOLVER A MEDIR QUIÉN ESTÁ ADENTRO. El Worker');
  console.log('   no se lo pregunta a Discord en vivo —serían 10 ms por botón—:');
  console.log('   lee `meta.bot_en` y `p:<n>.svs`, que se miden desde acá.');
  console.log('   Hasta que corras esto, la carta de ese servidor sigue');
  console.log('   bloqueada con «el bot todavía no está ahí»:\n');
  console.log('      python herramientas/servidores_de.py --json');
  console.log('      python bot/subir_datos.py\n');
  process.exit(0);
}

const faltan = [];
if (!APP) faltan.push('DISCORD_APP_ID');
if (!TOKEN) faltan.push('DISCORD_TOKEN');
if (!global && !GUILD) faltan.push('DISCORD_GUILD_PRUEBA (o corré con --global o --sv=)');
if (faltan.length) {
  console.error('Falta en .env:\n  ' + faltan.join('\n  '));
  console.error('\nEl .env va en la raíz del proyecto y ya está ignorado por git.');
  process.exit(1);
}

// ── Instalación en cuenta: el paso que no avisa ───────────────────────────
// ⚠️ REGISTRAR LOS COMANDOS CON `integration_types:[0,1]` NO ALCANZA. Eso dice
// «este comando se puede usar instalado en una cuenta», pero la APP tiene que
// declarar aparte que acepta ese tipo de instalación. Sin esto el PUT sale
// 200, los comandos quedan bien, y el link de «Add to My Apps» simplemente no
// existe: se registró algo que nadie puede instalar, y no hay ningún error
// que lo diga.
if (global && !borrar) {
  const r = await fetch('https://discord.com/api/v10/applications/@me', {
    method: 'PATCH',
    headers: { 'Authorization': `Bot ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      integration_types_config: {
        0: { oauth2_install_params: { scopes: ['bot', 'applications.commands'],
                                      permissions: '0' } },
        // 🔴 `permissions: '0'` VA SÍ O SÍ, TAMBIÉN ACÁ. Omitiéndolo, Discord
        // guarda el STRING `"None"` en su lugar, y el cliente de celular
        // revienta al abrir la pantalla de autorizar: hace `BigInt("None")` y
        // tira «can't convert string to bigint». La app se cierra entera.
        // Una instalación en cuenta no pide permisos de servidor —por eso uno
        // no piensa en mandarlo— pero el campo tiene que existir igual.
        1: { oauth2_install_params: { scopes: ['applications.commands'],
                                      permissions: '0' } },
      },
    }),
  });
  if (r.ok) {
    console.log('✅ la app acepta instalación en SERVIDOR y en CUENTA (DMs)');
  } else {
    console.error(`⚠️ no pude prender la instalación en cuenta: ${r.status}`);
    console.error('   ' + (await r.text()).slice(0, 200));
    console.error('   Los comandos se registran igual, pero el botón «Add to My');
    console.error('   Apps» no va a aparecer hasta que esto funcione.');
  }
}

const url = global
  ? `https://discord.com/api/v10/applications/${APP}/commands`
  : `https://discord.com/api/v10/applications/${APP}/guilds/${GUILD}/commands`;

// ⚠️ UN COMANDO POR SERVIDOR NO PUEDE LLEVAR `integration_types` NI
// `contexts`: Discord contesta 400. Se sacan acá en vez de tener dos listas de
// comandos, que es la forma exacta en que este proyecto ya perdió decisiones
// —la decisión en un lado y el código leyéndola de otro—.
const paraGuild = (c) => {
  const { integration_types, contexts, ...resto } = c;
  return resto;
};
// 🔴 `--listar` SOLO LEE, Y ANTES NO EXISTIA. Cualquier flag desconocido
// caia en el camino normal y hacia un `PUT`: correr
// `node bot/registrar.mjs --listar` para *mirar* qué hay registrado
// **registraba los comandos por servidor**. Paso dos veces —la primera
// duplicó cinco comandos en FFA, un servidor en vivo—.
//
// ⚠️ Y NO FALLABA: imprimía la lista correcta, porque un PUT devuelve lo
// que quedó. O sea que el síntoma de haber escrito sin querer era
// exactamente el resultado que se esperaba de una lectura.
//
// Por eso ahora hay un modo de sólo lectura y, más abajo, **cualquier flag
// que el script no conozca lo corta antes de tocar nada**.
if (soloListar) {
  const rl = await fetch(url, { headers: { Authorization: `Bot ${TOKEN}` } });
  if (!rl.ok) {
    console.error(`Discord dijo ${rl.status}: ${(await rl.text()).slice(0, 200)}`);
    process.exit(1);
  }
  const hay = await rl.json();
  console.log(`\nHAY en ${global ? 'GLOBAL' : `el servidor ${GUILD}`}: ` +
              `${hay.length} comando(s)  (no se tocó nada)`);
  for (const c of hay) console.log(`  /${c.name}`);
  if (!global && hay.length) {
    console.log('\n⚠️ Los comandos POR SERVIDOR le ganan a los globales con el');
    console.log('   mismo nombre, así que este servidor NO ve los cambios que');
    console.log('   se desplieguen en global. Para dejarlo con los globales:');
    console.log('   node bot/registrar.mjs --borrar');
  }
  console.log('');
  process.exit(0);
}

const cuerpo = borrar ? [] : (global ? COMANDOS : COMANDOS.map(paraGuild));

const r = await fetch(url, {
  method: 'PUT',
  headers: {
    'Authorization': `Bot ${TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(cuerpo),
});

const txt = await r.text();
if (!r.ok) {
  console.error(`Discord dijo ${r.status}:`);
  console.error(txt);
  if (r.status === 401) {
    console.error('\n-> 401 es el token. Revisá DISCORD_TOKEN en .env.');
  }
  if (r.status === 403) {
    console.error('\n-> 403 suele ser que el bot no está en ese servidor, o que');
    console.error('   lo invitaste sin el scope `applications.commands`.');
  }
  process.exit(1);
}

const quedaron = JSON.parse(txt);
console.log(
  `${borrar ? 'Borrados' : 'Registrados'} en ` +
  `${global ? 'GLOBAL' : (DE_TABLA ? `${DE_TABLA.sv} (${DE_TABLA.nombre})` : `el servidor ${GUILD}`)}: ` +
  `${quedaron.length} comando(s)`);
for (const c of quedaron) {
  const tipo = { 1: '/', 2: 'click derecho en persona → ', 3: 'click derecho en mensaje → ' }[c.type] || '';
  console.log(`  ${tipo}${c.name}`);
}
if (global) {
  console.log('\n⚠️ En global puede tardar hasta una hora en aparecer.');
  console.log('   Para probar, conviene sin --global: es instantáneo.');
}
