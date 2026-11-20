/**
 * LIGA GLOBAL — el Worker.
 *
 * Contesta las interacciones de Discord. El porqué de cada decisión está en
 * CLAUDE.bot.md; acá va sólo lo que hace falta leyendo este archivo.
 *
 * ⚠️ NINGÚN DATO DE UNA PETICIÓN VIVE FUERA DE fetch().
 *
 *   (Hasta el 17/09/2026 esto decía «no hay estado fuera de fetch, ni uno», y
 *   dejó de ser cierto cuando entró el freno al spam. La regla verdadera
 *   siempre fue ésta: lo que no puede vivir afuera es lo que pertenece a
 *   ALGUIEN. El freno guarda «este ID hizo N clicks», que no es de nadie en
 *   el sentido que importa acá — ver su comentario, más abajo.)
 *
 *   Cloudflare REUTILIZA el isolate entre peticiones, y una misma instancia
 *   atiende VARIAS A LA VEZ: mientras una espera un await, entra otra. Una
 *   variable de módulo la comparten todas.
 *
 *   Su propia documentación lo dice —«no uses ni mutes estado global»— y el
 *   ejemplo que usan es literalmente nuestro caso:
 *
 *       let usuarioActual = null;              // ☠️
 *       usuarioActual = leerNombre(req);       // Pepito la pisa acá
 *       await env.KV.get(usuarioActual);       // y vos leés la de él
 *
 *   Dlx preguntó exactamente esto: «¿qué pasa si Pepito y yo usamos el comando
 *   en servidores distintos casi al mismo tiempo?». No se pisan **porque no hay
 *   nada que pisar**, y eso se sostiene sólo mientras este archivo no guarde
 *   nada. Todo viaja en el request: quién preguntó, en qué servidor, qué botón
 *   tocó (en su custom_id) y a dónde vuelve (su token).
 *
 * ⚠️ 10 ms DE CPU POR PETICIÓN. Esperar red no gasta; parsear sí.
 */

// ── Los avisos de eventos (la campana del hub) ────────────────────────────
// Viven en su propio módulo porque tienen su propio estado —un Durable
// Object— y porque Node los prueba sin levantar el Worker entero. Ver
// `bot/avisos.js`. La clase TIENE que exportarse desde el módulo principal:
// Cloudflare busca ahí las clases de los Durable Objects.
import { anotarUso, DUENO, NIVELES_CHAT, CFG_BASE, claveMedida, claveFoto, claveCiclo, APP_ID, claveValida, quienPide } from './avisos.js';
// 🎨 el color de cada servidor y su ícono, los mismos del bot en vivo y de `eventos-hoy` (nunca escritos acá)
import { colorChat, visualRed, DROP_TITULOS } from './avisos.js';
import { Avisos, CRON_VIGIA, rutaAvisos, vigilar, marcarDisparo, olvidarAvisos, discordDe, sesionNueva,
  sesionFin, sesionDe, cookieSesion, SESION_DIAS } from './avisos.js';
// 🛡️ el anti-raid (18/10/2026): `/antiraid` y sus botones. La vuelta de cada minuto vive en el objeto (avisos.js)
import * as AR from './antiraid.js';
import * as AP from './apodo.js';
// 👥 las crews (19/10/2026): la forma de comparar nombres, la misma que el objeto
import { normCrew } from './crews.js';
// 🧭 /setup (19/11/2026): el paso a paso de un servidor que entra a la Liga. Todo en `bot/setup.js`; el borrador y lo
// aplicado viven en el objeto (`setupOp()` de avisos.js)
import * as SU from './setup.js';
// 🧱 las piezas de los mensajes en Componentes V2 (20/11/2026, el rediseño de los comandos): un solo lugar, `bot/vista.js`
import * as V from './vista.js';
export { Avisos };

// ── Tipos de Discord, con nombre para que se lea ──────────────────────────
const RECIBE = { PING: 1, COMANDO: 2, COMPONENTE: 3, AUTOCOMPLETAR: 4, MODAL: 5 };
const RESPONDE = {
  PONG: 1,
  MENSAJE: 4,          // un mensaje nuevo
  PENSANDO: 5,         // "está pensando…", da 15 min para el follow-up
  ACTUALIZAR: 7,       // PISA el mensaje del botón. El que usan las cartas
};
const COMP = { FILA: 1, BOTON: 2, SELECT: 3, TEXTO: 10, GALERIA: 12 };
const ESTILO = { PRIMARIO: 1, SECUNDARIO: 2, PELIGRO: 4 };

const EFIMERO = 1 << 6;       // 64    sólo lo ve quien lo pidió
const V2 = 1 << 15;           // 32768 IS_COMPONENTS_V2

// ── Las cartas ────────────────────────────────────────────────────────────
const R2 = 'https://pub-70d5821d06a8432c9cffd0c102195000.r2.dev';

// ⚠️ LA URL SE CONSTRUYE, NO SE CONSULTA. La clave en R2 es estable
// —`konan/pais.png`— justamente para esto: el Worker la arma con el nombre y
// no necesita buscar nada. Con un hash en el nombre del archivo haría falta una
// consulta por botón, y son 10 ms para todo.
// ⚠️ EL `?v=` NO ES ADORNO: ES LO ÚNICO QUE ROMPE LA CACHÉ DE DISCORD.
// Discord cachea las imágenes **por URL**, y la clave en R2 es estable a
// propósito —para que el Worker pueda construirla sin consultar nada—. O sea
// que si el pipeline regenera una carta, Discord sigue sirviendo la vieja.
//
// PASÓ EL 17/09/2026, tal cual: se subió la carta de Konan con su foto y
// Discord siguió mostrando la de antes de que existieran los avatares. El
// archivo en R2 estaba bien; lo que estaba viejo era la caché.
//
// El sello viene de `meta` en KV, lo escribe el pipeline UNA VEZ POR CORRIDA
// —no uno por carta— y R2 lo ignora: sirve el objeto igual.
// ⚠️ .webp Y NO .png, DESDE EL 17/09/2026. La carta es foto + degradés, o sea
// el peor caso de PNG: 72.560 colores distintos y sólo el 57,7% de los píxeles
// igual a su vecino. Medido: 1.095 KB en PNG contra **138 KB** en WebP q90,
// con una diferencia media de 1,24 sobre 255 por canal. Dlx miró los dos al
// 100% y el mapa de diferencia: «la verdad yo lo veo igual».
//
// No es cosmética: son 1,99 GB contra 250 MB en R2, y en un teléfono con datos
// es la diferencia entre que la carta aparezca y que «a veces no cargue» —que
// es como Dlx lo reportó—. `pub-*.r2.dev` además no cachea en el borde, así
// que cada pedido baja el archivo entero.
const urlCarta = (quien, carta, v) =>
  `${R2}/${quien}/${carta}.webp${v ? '?v=' + v : ''}`;

// ⚠️ LA CARTA DE **TU** SERVIDOR Y LA DE OTRO NO SE GUARDAN IGUAL, y no es
// un capricho: son cosas distintas.
//
//   <quien>/servidor.png       la tuya. La genera el pipeline para las 138.
//   <quien>/sv-<codigo>.png    la MISMA carta con los colores y el escudo de
//                              otro servidor, y sin el puesto —ese número es
//                              el único que no se puede saber de un servidor
//                              donde no jugaste—. Son 138 × 8 y todavía no
//                              están: hasta que estén, `hayCarta()` manda al
//                              menú por el camino de la invitación.
//
// ⚠️ Y HASTA EL 17/09 ESTO ERA OTRA COSA: `sv-<codigo>.png` era la
// **Bloqueada** ovalada de ese servidor. Dejó de serlo cuando Dlx sacó el
// requisito de la Servidor. La clave no cambió, el dibujo sí.
const urlServidor = (quien, sv, suyo, v) =>
  (sv && suyo && sv.toUpperCase() === String(suyo).toUpperCase())
    ? urlCarta(quien, 'servidor', v)
    : `${R2}/${quien}/sv-${String(sv).toLowerCase()}.webp${v ? '?v=' + v : ''}`;

// ⚠️ «COMPETITIVA», NO «COMPETITIVO». Dlx, 19/09/2026: «es tarjeta competitiva
// no competitivo». Las cuatro concuerdan con «tarjeta», que es femenino. El
// `id` sigue siendo `competitivo` porque es la clave de R2 y de KV: cambiarlo
// renombraría 138 objetos para arreglar una letra que sólo se lee en el botón.
const CARTAS = [
  { id: 'temporada', et: 'Temporada' },
  { id: 'competitivo', et: 'Competitiva' },
  { id: 'servidor', et: 'Servidor' },
  { id: 'pais', et: 'País' },
];

// ⚠️ NO TODO EL MUNDO TIENE LAS CUATRO, Y EL BOTÓN NO PUEDE MENTIR.
// **Mark no tiene carta de País** porque no tiene país: «sin dato no hay
// pieza», su carta no se emite a propósito y lo dice `CLAUDE.md`. El Worker
// construye la URL con el nombre y no consulta nada, así que le dibujaba el
// botón igual y al apretarlo salía un hueco — Discord no avisa de una imagen
// que no carga.
//
// `g.cs` viene de KV y lo escribe el pipeline midiendo el inventario de R2.
// Si falta —KV viejo— se asume que están las cuatro, que es como se
// comportaba antes.
//
// ⚠️ Y SE QUITA EL BOTÓN, NO SE APAGA. Gris y apagado ya quiere decir «ésta
// es la que estás viendo»; usarlo también para «ésta no existe» le da dos
// significados al mismo aspecto. Sin dato no hay pieza, también acá.
const tiene = (g, id) => !g || !g.cs || g.cs.indexOf(id) >= 0
  || (!!g.bl && g.bl.indexOf(id) >= 0);

// 🔴 «NO EXISTE» Y «TODAVÍA NO» SON DOS COSAS, y hasta el 19/09/2026 se veían
// igual: las dos hacían desaparecer el botón. Dlx, mirando la carta de Lil
// Drako: *«faltan los otros botones no?»*.
//
//   no existe   -> Mark no tiene país. Su carta no se emite a propósito
//                  —«sin dato no hay pieza»— y el botón se saca. Eso NO cambia.
//   todavía no  -> a Drako le faltan 2 eventos para la Temporada. Hay algo que
//                  mostrar: la Bloqueada, que dice exactamente cuánto falta.
//
// `g.bl` son las bloqueadas que esa persona tiene subidas. Un botón que lleva
// a «te faltan 2 eventos» explica; uno ausente no explica nada.
const bloqueada = (g, id) => !!(g && g.bl && g.bl.indexOf(id) >= 0
                                && !(g.cs && g.cs.indexOf(id) >= 0));

// Los de la Hermandad. Sale de `datos/servidores.json`, que es el que manda:
// acá está copiado porque el Worker no puede leer archivos del repo.
//
// ⚠️ `guild` ES LO QUE HACE ANDAR «LA CARTA DEL SERVIDOR DONDE ESCRIBISTE».
// La interacción trae `guild_id` y sin esta tabla ese número no significa
// nada. Los que están vacíos todavía no tienen el bot adentro.
//
// ⚠️ `invita` ES EL LINK QUE SE MANDA CUANDO ALGUIEN MIRA UN SERVIDOR DONDE
// NO ESTÁ. Discord **nunca** le dice a un bot de interacciones HTTP en qué
// otros servidores está una persona —eso es del gateway, con el intent de
// miembros—, así que la única señal disponible es «no es donde estás parado
// ni el tuyo». Ver `invitacion()`.
// ⚠️ LOS NUEVE SE VERIFICARON, NO SE COPIARON. Cada par (invitación, guild)
// se cruzó por dos caminos: `GET /invites/<código>` dice a qué guild lleva de
// verdad, y **el id contiene su propia fecha** —los 42 bits altos de un
// snowflake son milisegundos desde 2015—, así que se puede comparar contra el
// «Est.» de la invitación sin preguntarle a nadie. Siete de siete al mes.
//
// 🔴 URBF ES EL QUE LA COMPROBACIÓN ATRAPÓ: el link que venía en la lista
// llevaba a `[VFA] VIRTUAL FREESTYLE ARENA` (Jun 2025) y su id era de Feb
// 2026 — dos servidores distintos. Dlx pasó el link nuevo y ese sí coincide.
// Sin cruzar invitación contra id se habría cargado un invite a otro servidor,
// y el bot habría mandado gente al lugar equivocado sin fallar nunca.
export const SERVIDORES = [
  { sv: 'DRA', nombre: 'Discord Rap Español', guild: '841017460341604382', invita: 'https://discord.gg/5jUM3WXDXe' },
  { sv: 'FFA', nombre: 'Freestyle For All', guild: '1468472442925092958', invita: 'https://discord.gg/JrmE78qdMd' },
  { sv: 'TWR', nombre: 'The Warren Rap', guild: '1115145044127666196', invita: 'https://discord.gg/fytxhaTCVj', fuera: true },
  // 🚪 `fuera`: registrado pero no de la Liga, así que no sale en el menú de la Servidor (Dlx, 04/10/2026). Ver
  // `en_la_liga` en `datos/servidores.json`, que es el que manda
  { sv: 'TFC', nombre: 'The Freestyle Corpo', guild: '1043611686524944404', invita: 'https://discord.gg/grUBFhsFFa', fuera: true },
  // 🔤 `sigla`: la que se lee, cuando no es el código (Dlx, 03/10/2026: SNK y URB). Ver `datos/servidores.json`.
  // ⚠️ AL FINAL del objeto: `bot/desplegar.py` lee `sv`, `nombre` y `guild` en ese orden y los compara con el json
  { sv: 'SR', nombre: 'Snake Rap', guild: '492346406976356374', invita: 'https://discord.gg/EME4p3RhAp', sigla: 'SNK' },
  { sv: 'FTN', nombre: 'Fontana', guild: '1331924080835694655', invita: 'https://discord.gg/U5q5C8XnD9', fuera: true },
  // 🌀 FREESTYLE ZONE (14/10/2026): de la Liga (Dlx: «asegurate que sea bien integrado a la Liga Global»). Ya tenía su
  // carta de la pre-temporada
  { sv: 'FRZ', nombre: 'Freestyle Zone', guild: '838593179187544064', invita: 'https://discord.gg/T8bPfa8Vr8', sigla: 'FRZ' },
  { sv: 'URBF', nombre: 'Urban Freestyle', guild: '1467763447117778989', invita: 'https://discord.gg/WSXBZDumBb', sigla: 'URB' },
  { sv: 'EFA', nombre: 'EFA', guild: '1222746296377675867', invita: 'https://discord.gg/DDc3SqE8ax', fuera: true },
  // 🟣 FFS (28/09/2026): de la Liga (Dlx: «A · sí, como los otros cuatro»). Sin invitación
  // todavía —no tiene URL propia y el bot no puede listar las suyas—: con `invita`
  // vacío el bot no manda nada, que es lo que dice `datos/servidores.json`.
  // 🃏 SIN CARTA DESDE EL 15/11/2026: es Tier 3 desde el 20/10 (Dashboard) y Dlx, a «¿la carta de Servidor de FFS se
  // queda?»: «Sacarla». Como FDS, LKR, DDS y CEU (`sinCarta`); su camiseta sale también de `que_cambio.SERVIDORES`
  { sv: 'FFS', nombre: 'FFS League', guild: '1367688812892913774', invita: 'https://discord.gg/whrjpJUfuz', sinCarta: true },
  // 🌌 DDF (03/10/2026): de la Liga (Dlx: «Haz todo lo necesario para que esta sea una buena inclusión»), con la
  // invitación permanente que creó el bot (`bot/invitaciones.py`)
  { sv: 'DDF', nombre: 'Dimensión del Freestyle', guild: '1469009547971526659', invita: 'https://discord.gg/9jxbKT9Hfv' },
  // 🏛️ LA ACADEMIA (04/10/2026): de la Liga (Dlx: «prepara todo para implementarlos en la liga como se debe»),
  // con la invitación permanente que crea el bot (`bot/invitaciones.py`)
  { sv: 'ACAD', nombre: 'Academia de Rap', guild: '765045834647339038', invita: 'https://discord.gg/tyYC4XejPA', sigla: 'LCW' },
  // 🆚 FVS (12/10/2026): de la Liga (Dlx: «asegurate que sea bien integrada completamente»), con la invitación
  // permanente que creó el bot (`bot/invitaciones.py`) a su «Bienvenida»
  { sv: 'FVS', nombre: 'Freestyle Versus', guild: '1283205153624952975', invita: 'https://discord.gg/dG9dJtZ5y7', sigla: 'FVS' },
  // 🎙️ FDS (20/10/2026): socio Tier 3 (Dlx: «no cuentes para la Liga Global nada aún»): su página, sus dos ligas y sus
  // eventos promocionados, SIN carta de Servidor —por eso `sinCarta`: no va en el menú de /card, donde saldría bloqueada
  // para todo el mundo—. La invitación permanente la creó el bot (`bot/invitaciones.py`)
  { sv: 'FDS', nombre: 'Freestyle Discord Series', guild: '1489848581203689535', invita: 'https://discord.gg/uTpFjBYEDR', sigla: 'FDS', sinCarta: true },
  // 👑 LKR (21/10/2026): socio Tier 3, dado de alta por Dlx desde el Dashboard y completado a mano como FDS: su página,
  // sus dos ligas (Champions League y FMS Plaza Underground) y el panel de su dueño, SIN carta de Servidor (`sinCarta`)
  { sv: 'LKR', nombre: 'LATÍN KING RAP', guild: '1558611504046153750', invita: 'https://discord.gg/sxjg9uaM26', sigla: 'LKR', sinCarta: true },
  // ⚡ CYPHERHOOD (05/11/2026): Tier 1 (Dlx: «asegurate que este integrado completamente en la liga global», «son tier 1
  // x cierto»), con la invitación permanente que creó el bot (`bot/invitaciones.py`)
  { sv: 'CH', nombre: 'Cypherhood', guild: '1074328197400887388', invita: 'https://discord.gg/GxKa9EBqEY', sigla: 'CYH' },
  // 🎤 DISCORD STYLE (06/11/2026): socio Tier 3, dado de alta por Dlx desde el Dashboard y completado a mano como LKR el
  // 08/11: su página y sus eventos, SIN carta de Servidor (`sinCarta`)
  { sv: 'DDS', nombre: 'Discord Style', guild: '1443770831598649528', invita: 'https://discord.gg/HTERZJAcYR', sigla: 'DDS', sinCarta: true },
  // 🖤 FMS CEUTA (15/11/2026): socio Tier 3 (Dlx: «asegurate de incluir este servidor como tier 3»), sumado con
  // `herramientas/sumar_servidor.py --tier 3`: su página, sus eventos y su liga, SIN carta de Servidor (`sinCarta`)
  { sv: 'CEU', nombre: 'FMS Ceuta', guild: '1513624656538636459', invita: 'https://discord.gg/mmXHVpUajm', sigla: 'CEU', sinCarta: true },
  // ♟️ CHEZZTYLE (19/11/2026): socio Tier 3 (Dlx: «mete este servidor, tag es versatilidad como tier 3»), SIN carta de Servidor
  { sv: 'CHZ', nombre: 'Chezztyle', guild: '1408218254803075203', invita: 'https://discord.gg/35kjKdthJf', sigla: 'CHZ', sinCarta: true },
];

const SV_DE = (sv) => SERVIDORES.find(s => s.sv === String(sv || '').toUpperCase());

// De qué servidor de la Liga es este guild de Discord, o null si no es de la
// Liga (alguien metió el bot en un servidor suyo, o es un mensaje directo).
const aquiEs = (gid) => (SERVIDORES.find(s => s.guild && s.guild === gid) || {}).sv || null;

// ⚠️ LA SERVIDOR NO SE BLOQUEA NUNCA. Dlx, 17/09/2026: «el servidor siempre
// va a estar desbloqueado, quiero que ese sea el default, pero que muestre el
// servidor de donde ha sido convocado». Eso deroga el requisito de «1 evento
// en {sv}» que había entrado el 16/09 y que es lo que dibujaba los
// (BLOQUEADA) del menú.
//
// Lo que sí falta es el DIBUJO: `<quien>/servidor.png` —la del servidor
// propio— está para las 138; las de los otros ocho se van subiendo por tanda.
// Por eso el Worker pregunta si esa carta existe antes de mandarla.
//
// ⚠️ ES UNA LISTA, NO UN SÍ/NO, Y ESO SE APRENDIÓ A LOS GOLPES. Primero fue
// `meta.por_servidor` booleano, y no servía: con FFA subido y TWR no, el
// booleano tiene que decir `false` —o el menú manda a una URL que no está— y
// entonces FFA tampoco anda, que era justo lo que había que arreglar. Las
// tandas se suben de a un servidor, así que la respuesta es **cuáles**.
//
// `meta.svs` lo escribe `bot/subir_datos.py` MIDIENDO el inventario de R2,
// no a mano. Un servidor entra sólo si lo tienen las 138: a medias, el que
// falta ve un hueco y Discord no avisa de eso.
// 🔴 Y DESDE EL 19/09/2026 LA PREGUNTA ES **POR PERSONA**, no global.
// `meta.svs` es la INTERSECCIÓN: un servidor entraba sólo si lo tenían las
// 138. Con las 469 de hoy la intersección se vacía —los 331 que entraron con
// la Servidor desbloqueada tienen DRA y FFA y nada más— y el menú quedaría con
// los nueve bloqueados para todo el mundo. `g.svc` dice qué tiene ESTA
// persona, medido contra el inventario de R2.
//
// ⚠️ `meta.svs` SE QUEDA DE RESPALDO, no por cariño: si el Worker se despliega
// antes que la corrida de `subir_datos.py`, las claves viejas no traen `svc` y
// sin el respaldo el menú se apagaría entero. Se puede sacar cuando las 469
// claves estén escritas.
const hayCarta = (g, sv, m) => {
  if (!sv) return false;
  const s = String(sv).toUpperCase();
  if (g && g.svc) return g.svc.indexOf(s) >= 0;
  if (g && String(g.sv || '').toUpperCase() === s) return true;
  return !!(m && m.svs && m.svs.indexOf(s) >= 0);
};

// ⚠️ `<quien>/servidor.webp` SÓLO EXISTE PARA LOS QUE COMPITIERON. Los 331 que
// entraron con la Servidor desbloqueada tienen `sv-dra` y `sv-ffa` y ninguna
// carta «propia», así que mandarlos a `servidor.webp` da un hueco — y Discord
// no avisa de una imagen que no carga. `g.cs` ya dice qué tipos de carta hay.
//
// ⚠️ SI `cs` NO ESTÁ, SE ASUME QUE SÍ LA TIENE. Es la misma convención que
// `tiene()` de más arriba —«si falta, KV viejo, se asume que están las
// cuatro»— y no es cosmética: con la regla al revés, una clave escrita antes
// de este cambio manda a TODO el mundo a `sv-<código>.webp` y los 138 que sí
// tienen su carta propia dejan de verla. Ausente es «no sé», no «no».
//
// 🔴 SON DOS PREGUNTAS DISTINTAS Y CONFUNDIRLAS ROMPE A LOS 331.
//   «¿tiene alguna carta de servidor?»  -> el BOTÓN   -> `cs`
//   «¿existe `<quien>/servidor.webp`?»  -> la URL     -> otra cosa
// A Lil Drako hay que ponerle `cs:['servidor']` para que el botón aparezca,
// porque cartas de servidor tiene dos. Pero `servidor.webp` NO tiene, así que
// decidir la URL con `cs` le daría un hueco.
//
// 🔴 Y LA CARTA PROPIA ES LA DE `svp`, NO LA DE `sv`. Esto costó un bug real.
// Durante unas horas esto devolvía `null` siempre que hubiera `svc`, o sea que
// el Worker servía `sv-<código>` a todo el mundo. Parecía más simple, y lo que
// hacía era **quitarle el puesto a los 138**: `con_camiseta()` —en
// `03_Servidor/generar.py`— pone `pos_sv = 0` en las cartas de otro servidor,
// porque tu posición dentro de un servidor donde no jugaste no existe.
//
//   `sv`   dónde ESTÁS            -> lo dice Discord, decide qué carta abrir
//   `svp`  dónde JUGASTE          -> el argmax del Sheet, el único servidor
//                                    donde tu `pos_sv` es un número de verdad
//
// `servidor.webp` sólo vale cuando se está mirando `svp`. Para cualquier otro
// servidor va `sv-<código>`, sin puesto, que es la verdad.
//
// ⚠️ Sin `svp` —clave de KV vieja— se cae a `sv` y a la regla de antes:
// ausente es «no sé», no «no».
const propiaDe = (g) => {
  if (!g) return null;
  if (g.svp !== undefined) return g.svp || null;
  return (!g.cs || g.cs.indexOf('servidor') >= 0) ? (g.sv || null) : null;
};

// En qué servidor abre la Servidor, por orden:
//   1. el que se eligió en el menú
//   2. DONDE ESCRIBISTE, si de ahí hay carta            <- la regla de Dlx
//   3. el tuyo, que es el único que siempre está dibujado
// 🔴 LAS ÚLTIMAS CAÍDAS NO MIRABAN SI LA CARTA EXISTE, y eso deja un hueco.
// **Soto** se fue de DRA y de FFA después de que le dibujaran su carta: quedó
// con `sv: ""` y una sola carta, la de DRA. Pedida desde FFA, la cadena caía
// en `aqui` —«el servidor donde estás parado»— y armaba `soto/sv-ffa.webp`,
// que no está. Discord no avisa de una imagen que no carga: sale el hueco y
// nadie se entera.
//
// Ahora cada candidato pasa por `hayCarta()` antes de ganar, y si ninguno
// sirve se usa la PRIMERA que la persona tenga de verdad. Las dos caídas
// ciegas del final se quedan para el caso sin datos —KV viejo—, que es el
// único donde no hay nada mejor que adivinar.
const svQueVa = (g, sv, aqui, m) => sv
  || (hayCarta(g, aqui, m) ? aqui : null)
  || (hayCarta(g, g && g.sv, m) ? g.sv : null)
  || (g && g.svc && g.svc[0])
  || (g && g.sv) || aqui || SERVIDORES[0].sv;

// ⚠️ LOS DATOS VIVEN EN KV, UNA CLAVE POR PERSONA. No un blob con las 138:
// esperar red no gasta CPU, pero `JSON.parse` sí, y son 10 ms para todo. Con
// `p:konan` se lee un valor chico y se parsea un objeto.
//
//     p:<nombre>       { n, sv, cc, ev }
//     d:<discord_id>   a qué nombre corresponde ese ID
//     meta             el sello de la corrida y el requisito vigente
//
// Lo escribe `bot/subir_datos.py`. El Worker SÓLO LEE: los límites de
// escritura de KV son 1.000 por día y ese presupuesto es del pipeline.

// Misma normalización que `sheet/construir_padron.py` y `comun/respaldo.py`.
// ⚠️ Si las dos dejan de coincidir, el Worker busca claves que no existen y
// contesta «no tengo cartas» de gente que sí está. Son tres líneas en dos
// idiomas y no hay manera de que una avise sobre la otra.
// 🔴 TIENE QUE DAR LO MISMO QUE `norm()` DE PYTHON, que es quien ESCRIBE las
// claves de KV. El de Python se queda con lo que `c.isalnum()` acepta, o sea
// letras y números **de cualquier alfabeto**; éste se quedaba con `[a-z0-9]` y
// tiraba todo lo demás. Para **Ржунимагу** eso da la cadena vacía: la clave
// existe en KV como `p:ржунимагу` y el Worker la buscaba como `p:`. El bot
// contestaba «no tengo cartas de Ржунимагу» teniéndolas.
//
// ⚠️ Hoy sólo lo usa el camino de `/card nombre:`, que está desactivado — pero
// el handler sigue vivo y su propio comentario dice que se destapa agregando
// la opción. Dejarlo roto es dejar una mina con la mecha puesta.
//
// `\p{L}\p{N}` con la bandera `u` es el equivalente de `isalnum()`: después de
// NFD las tildes quedan como marcas combinantes (categoría Mn), que ninguno de
// los dos acepta, así que los dos las tiran igual.
//
// ⚠️ EL `|| 'sinnombre'` NO ES ADORNO: es la ultima diferencia que quedaba
// contra Python. `comun/claves.clave()` nunca devuelve vacio a proposito —«dos
// vacios distintos darian la misma clave otra vez»— y esta linea si lo hacia,
// asi que un nombre sin ninguna letra ni digito se guardaba como `sinnombre` y
// se buscaba como ``. Hoy no lo cumple ninguno de los 870 nombres reales, o
// sea que no hay nadie roto; se empareja igual porque el caso que rompe es
// SIEMPRE el que todavia no existe, y porque un solo lado con fallback es
// justo la forma de bug que este proyecto ya se comio tres veces.
const norm = (s) => String(s).normalize('NFD').toLowerCase()
  .replace(/[^\p{L}\p{N}]/gu, '') || 'sinnombre';

// El ID de quien mando la interaccion, sea comando o click.
const idDe = (i) => (i.member && i.member.user && i.member.user.id)
                 || (i.user && i.user.id) || '';

async function quienEs(i, env) {
  // El ID de quien usó el comando: en un servidor viene en `member.user`, y
  // por mensaje directo en `user`.
  const uid = idDe(i);
  return uid ? await env.KV.get('d:' + uid) : null;
}

// 🔑 LAS LIBRES (Dlx, 29/09/2026, «Dale»): la Temporada y la Servidor son de
// todos los que jugaron y están en la Lista, verificados o no; la Competitiva
// y la de País siguen pidiendo el portón. Quien no lo pasa tiene su ID en
// `dn:` y no en `d:`, a propósito: `d:` abre todo lo de la cuenta —/foto,
// Mis redes, seguir, los avisos personales— y eso sigue siendo de los
// verificados. Por eso `dn:` lo leen SÓLO las cartas (`/card`, `/versus` y
// sus botones) y nunca `quienEs()`.
//
// ⚠️ `d:` PRIMERO: es la de casi todos, así que la segunda lectura la paga
// sólo quien no está verificado.
// 🧠 LOS DATOS DE UNA PERSONA (`p:<clave>`), DEL DURABLE OBJECT DESDE EL 06/10/2026: en KV se comían el cupo de
// escrituras (unas 230 por corrida contra 1.000 por día). Si el objeto no la tiene o no contesta, de KV, donde quedan
// las de antes: mejor un dato de hace un rato que un /card que no anda. Esperar al objeto no gasta CPU
async function leerP(env, clave) {
  if (!clave) return null;
  if (env.AVISOS) {
    try {
      const r = await env.AVISOS.get(env.AVISOS.idFromName('liga')).fetch(
        'https://avisos/persona?k=' + encodeURIComponent('p:' + clave));
      if (r.ok) return await r.text();
    } catch (e) { /* sin objeto: KV */ }
  }
  return env.KV.get('p:' + clave);
}

async function claveCarta(env, id) {
  if (!id) return null;
  // 🔑 y la cuenta EXTRA de alguien (`dx:`, `subir_datos.cuentas_extra()`, 04/10/2026): abre sus cartas y nada más
  return (await env.KV.get('d:' + id)) || (await env.KV.get('dn:' + id)) || (await env.KV.get('dx:' + id));
}
const quienEsCarta = (i, env) => claveCarta(env, idDe(i));

// ¿Esta carta le falta por no estar verificado? Sólo a quien vino con `nv`
// (lo pone `bot/subir_datos.py`), y nunca la Temporada ni la Servidor. Es la
// `LIBRES` de `bot/verificados.py`: si cambia allá, cambia acá.
const LIBRES = ['temporada', 'servidor'];
const sinVerificar = (g, id) => !!(g && g.nv) && LIBRES.indexOf(id) < 0;
// «la Competitiva», pero «la de País»
const laDe = (id) => (id === 'pais' ? 'la de **País**'
  : `la **${(CARTAS.find(c => c.id === id) || {}).et || id}**`);

// ── Se anota a quien el bot no conoce, para que NO SE PIERDA ────────────────
// Dlx, 19/09/2026: «no puedes hacer q automaticamente registre su ID en el
// sheet minimamente?». Sí — pero no desde acá directo, y el porqué es la
// propiedad entera del bot:
//
// ⚠️ EL WORKER NO ESCRIBE EN EL SHEET Y NO VA A EMPEZAR. Escribir en el Google
// Sheet pide la clave de la cuenta de servicio, que es privada. Meterla acá
// pondría una llave con acceso al Sheet en el borde y tira abajo el «cero
// secretos», que es justo lo que deja que un servidor aliado agregue el bot
// sin riesgo. Lo que el Worker SÍ puede es escribir en su PROPIO KV. Así que
// el ID va a una cola `reg:<id>` y `sheet/registrar_ids.py` —local, con creds,
// gateado con --aplicar— la vuelca al Operativo.
//
// ⚠️ NO ES INSTANTÁNEO EN EL SHEET Y NO HACE FALTA. La persona tampoco tiene
// carta hasta la próxima corrida del pipeline (hay que generarla y subirla),
// así que escribir el Sheet al toque no adelantaría nada.
//
// ⚠️ DEDUP CONTRA LA CUOTA. KV da 1000 escrituras/día. Se lee antes: si ya
// tiene `d:` (cargado) o ya está en `reg:`, no se escribe. Leer es barato
// (100k/día). Y va en waitUntil: nunca demora la respuesta de 3 segundos.
// 🔑 `por`: 'yo' si se anotó quien usó el comando, 'otro' si lo nombró
// alguien más. Desde el 25/09/2026 quien se anota a sí mismo entra solo a la
// Lista (`sheet/registrar_ids.py`, #11 de Dlx); a un tercero lo sigue
// decidiendo un admin, porque buscar a alguien no es pedir entrar.
function anotar(env, ctx, id, nick, user, glob, guild, por) {
  if (!id || !ctx || !ctx.waitUntil) return;
  ctx.waitUntil((async () => {
    try {
      const [ya, yaN, yaX, cola, baja] = await Promise.all([
        env.KV.get('d:' + id), env.KV.get('dn:' + id), env.KV.get('dx:' + id), env.KV.get('reg:' + id),
        env.KV.get('olvido:' + id),
      ]);
      // ya cargado: verificado (`d:`), en la Lista sin verificar (`dn:`, las
      // LIBRES del 29/09/2026) o la cuenta extra de alguien (`dx:`). Anotarlo
      // sería trabajo para nadie.
      if (ya || yaN || yaX) return;
      // 🔴 QUIEN BORRÓ SUS DATOS NO SE VUELVE A ANOTAR con un `/card` suelto:
      // `/borrar-mis-datos` promete que no lo sumamos solo. Vuelve si se lo
      // pide a un admin (`bot/olvidar.py --volver`).
      if (baja) return;
      if (cola) {
        // 🔴 SI ANTES LO NOMBRÓ OTRO Y AHORA SE ANOTA ÉL, SE REESCRIBE: con
        // `por: 'otro'` no entra solo a la Lista, y el texto de `/card` le
        // acaba de decir que sí (auditoría del 25/09/2026). Es una
        // escritura más sólo en ese caso.
        let antes = null;
        try { antes = JSON.parse(cola); } catch (e) { antes = null; }
        if (!(por === 'yo' && (!antes || antes.por !== 'yo'))) return;
      }
      await env.KV.put('reg:' + id, JSON.stringify({
        id, nick: nick || '', user: user || '', glob: glob || '',
        guild: guild || '', sv: aquiEs(guild) || '', ts: Date.now(),
        por: por || '',
      }));
    } catch (e) { /* best-effort: anotar NUNCA rompe /card */ }
  })());
}

// Los datos de una persona que vino en el payload, para anotarla. En el
// selector la persona elegida viaja en `data.resolved`; el que corre el
// comando, en `member`.
const datosDe = (i, id) => {
  const r = (i.data && i.data.resolved) || {};
  const u = (r.users && r.users[id]) || {};
  const mem = (r.members && r.members[id]) || {};
  if (u.id || mem.nick) return { nick: mem.nick || '', user: u.username || '', glob: u.global_name || '' };
  const yo = (i.member && i.member.user) || i.user || {};
  return { nick: (i.member && i.member.nick) || '', user: yo.username || '', glob: yo.global_name || '' };
};

// Quién es la persona que pidieron en una opción del comando: `{clave, como}`,
// o null si no la nombraron.
//
// ⚠️ ES LA MISMA REGLA DE TRES CAMINOS QUE `/card`, SACADA APARTE PORQUE
// `/versus` LA NECESITA DOS VECES. Copiarla habría sido la cuarta vez que en
// este proyecto la misma decisión vive en dos lugares — y la forma en que se
// rompe es conocida: un lado aprende a resolver algo y el otro no.
//
//   elegiste a alguien en el selector -> por su Discord ID (`d:<id>`)
//   escribiste un nombre              -> por nombre normalizado
//   no pusiste nada                   -> null, y decide el que llama
//
// ⚠️ El selector no se puede equivocar de nombre pero sólo encuentra a quien
// tenga su ID cargado: hoy **444 de 469**. Por eso la opción de texto no es
// redundante, es el único camino para los otros 25.
async function quienPidieron(env, i, ops, optUsuario, optNombre) {
  const u = ops.find(o => o.name === optUsuario);
  if (u) {
    const clave = await claveCarta(env, u.value);
    return { clave, como: `<@${u.value}>`, id: u.value };
  }
  const n = ops.find(o => o.name === optNombre);
  if (n) return { clave: norm(n.value), como: `**${n.value}**` };
  return null;
}

// ── Armar el mensaje ──────────────────────────────────────────────────────
// ⚠️ SIN EMBED Y SIN TEXTO. Dlx: «la imagen y los botones, no dentro de un
// embed» y «tampoco plain text, porque el plain text muestra la info de la
// tarjeta». La carta ya dice el nombre, el rango y el número: repetirlo al
// lado sería el mismo dato en dos lugares.
//
// ⚠️ Y el flag V2 DESACTIVA `content` y `embeds`. Es uno o el otro.
// 🏟️ LA CARTA DE LIGA (27/10/2026): una por liga que juega, la mejor primero en `g.lg` = `[[liga, nombre, sello, ovr,
// puesto]]` (`bot/subir_datos.py`, de `05_Liga/ciclo.py`). Dlx: «que únicamente ellos… les aparezca el botón» y «más de 1
// tarjeta de liga… un dropdown… por default verían la mejor». La imagen: `<clave>/liga-<liga>.webp?v=<sello>`
const ligasDe = (g) => (g && Array.isArray(g.lg) ? g.lg : []);
const ligaDe = (g, lid) => { const l = ligasDe(g); return l.find(x => x[0] === lid) || l[0] || null; };

/** 🖼️ LA IMAGEN DE UNA CARTA, en un solo lugar: la de `/card` y las dos del versus salen de acá (20/11/2026). `svAhora`:
 *  el servidor que se muestra (la Servidor); `lg`: la liga (la de liga). */
function urlImagen(quien, g, cual, svAhora, m, lg) {
  // ⚡ y la de su último redibujo a pedido (`vr`): sin esto Discord seguiría mostrando la de antes de su caché
  const v = m && m.sello ? m.sello + (g && g.vr ? '-' + g.vr : '') : '';
  // 🖼️ con su marco en la imagen, si tiene la foto con el marco que lleva hoy (`mi`, ver bot/con_marco.py). La de
  // Servidor, sólo la suya: la de otro servidor es otra carta
  const conMarco = (c) => !!(g && Array.isArray(g.mi) && g.mi.includes(c));
  if (lg) return urlCarta(quien, 'liga-' + lg[0], lg[2]);
  if (bloqueada(g, cual)) return urlCarta(quien, 'bloq-' + cual, v);
  if (cual === 'servidor') {
    const urlSv = urlServidor(quien, svAhora, propiaDe(g), v);
    return conMarco('servidor') && urlSv === urlCarta(quien, 'servidor', v) ? urlCarta(quien, 'servidor-m', v) : urlSv;
  }
  return urlCarta(quien, conMarco(cual) ? cual + '-m' : cual, v);
}

function carta(quien, g, cual, sv, dueno, m, aqui, apagado) {
  const enSv = cual === 'servidor';
  const enLiga = cual === 'liga';
  const lg = enLiga ? ligaDe(g, sv) : null;
  const svAhora = enSv ? svQueVa(g, sv, aqui, m) : ((g && g.sv) || '');
  const componentes = [
    {
      type: COMP.GALERIA,
      items: [{
        media: { url: urlImagen(quien, g, cual, svAhora, m, lg) },
        description: lg ? `Carta de liga de ${(g && g.n) || quien} en ${lg[1]}` : `Carta ${cual} de ${(g && g.n) || quien}`,
      }],
    },
    {
      type: COMP.FILA,
      // ⚠️ EL BOTÓN DE LA CARTA QUE ESTÁS VIENDO VA APAGADO Y GRIS, y hace de
      // etiqueta: es lo que reemplaza al texto que se sacó. Y ahorra un
      // request, porque pedir la carta que ya estás viendo se evita en el
      // cliente en vez de que el Worker tenga que contestarlo.
      //
      // ⚠️ Los otros tres NO pueden ser grises: si todos son Secundario, la
      // única diferencia es el 50% de opacidad del deshabilitado, y sobre el
      // gris de Discord casi no se ve. El contraste tiene que venir del color.
      //
      // 🔑 Y LAS DE QUIEN NO SE VERIFICÓ VAN CON CANDADO (las LIBRES,
      // 29/09/2026). La Competitiva y la de País no le faltan por jugar sino
      // por verificarse: es un «todavía no», no un «no existe», así que el
      // botón está y al apretarlo lo dice, sin cambiar la carta.
      components: CARTAS.filter(c => tiene(g, c.id) || sinVerificar(g, c.id)).map(c => Object.assign({
        type: COMP.BOTON,
        style: c.id === cual ? ESTILO.SECUNDARIO : ESTILO.PRIMARIO,
        label: c.et,
        custom_id: `c:${quien}:${c.id}:${dueno}`,
        disabled: apagado || c.id === cual,
      }, sinVerificar(g, c.id) ? { emoji: { name: '🔒' } } : {}))
        // 🏟️ «Liga», sólo si tiene alguna (sin carta de liga, el botón no existe: sin dato no hay pieza)
        .concat(ligasDe(g).length ? [{ type: COMP.BOTON, style: enLiga ? ESTILO.SECUNDARIO : ESTILO.PRIMARIO, label: 'Liga',
          custom_id: `c:${quien}:liga:${dueno}`, disabled: apagado || enLiga }] : [])
        .concat(botonAvisos(CARTAS.filter(c => tiene(g, c.id) || sinVerificar(g, c.id)).length + (ligasDe(g).length ? 1 : 0))),
    },
  ];
  // 🏟️ con más de una carta de liga, el menú para elegir cuál; la mejor primero (y elegida si no se eligió otra)
  if (enLiga && lg && ligasDe(g).length > 1) {
    componentes.push({
      type: COMP.FILA,
      components: [{
        type: COMP.SELECT,
        custom_id: `l:${quien}::${dueno}`,
        disabled: !!apagado,
        placeholder: 'Elige una liga',
        options: ligasDe(g).slice(0, 25).map((x, k) => ({
          label: String(x[1]).slice(0, 100),
          value: x[0],
          // 👑 la del dueño no tiene puesto ni OVR (no juega ninguna): «—»
          description: (x[4] ? x[4] + '.º · OVR ' + x[3] + (k === 0 ? ' · la mejor' : '') : '—').slice(0, 100),
          default: x[0] === lg[0],
        })),
      }],
    });
  }

  // ⚠️ EL MENÚ APARECE SÓLO CON LA SERVIDOR ACTIVA. En las otras tres no se
  // dibuja, así que los componentes del mensaje cambian según la carta — con
  // el tipo 7 eso es normal, se manda el array nuevo. Y un select ocupa SU
  // PROPIA fila: no comparte Action Row con botones.
  if (enSv) {
    componentes.push({
      type: COMP.FILA,
      components: [{
        type: COMP.SELECT,
        custom_id: `s:${quien}::${dueno}`,
        disabled: !!apagado,
        placeholder: 'Elige un servidor',
        // ⚠️ LOS NUEVE SIEMPRE ESTÁN, Y LOS QUE NO TIENEN CARTA DICEN
        // «BLOQUEADA» EN LA ETIQUETA. Dlx, 19/09/2026: *«todas las opciones
        // deberían aparecer ahí... y el título debería decir como BLOQUEADA»*.
        //
        // ⚠️ Y EL CANDADO ES DE LA PERSONA DE LA CARTA, NO DEL QUE MIRA. Antes
        // elegir un servidor sin carta contestaba «¿no estás adentro? entrá por
        // acá» — hablándole al que clickeó. Si Dlx mira la carta de Sombra y
        // elige FRZ, el que no está en FRZ es **Sombra**, y Dlx sí está: el
        // mensaje le hablaba a la persona equivocada. Por eso el estado se
        // muestra acá, en la opción, y dice de quién es la carta.
        // 🔴 «BLOQUEADA» TIENE QUE DECIR **POR QUÉ**, y hay dos motivos
        // distintos que se veían igual. Dlx, 19/09/2026: «Drako está en otros
        // servidores, ¿por qué está bloqueada?» — y tenía razón: está en TFC,
        // SR y TWR. Lo que pasa es que **el bot no está en esos servidores**,
        // así que Discord no le deja preguntar quién es miembro. No es que
        // Drako no esté; es que no se puede saber.
        //
        //   el bot no está ahí   -> «el bot todavía no está en TWR»
        //   el bot sí, vos no    -> «no estás en FFA»
        //
        // Decirle «no tiene carta» a las dos era describir el síntoma que ve
        // el bot en vez de la causa que le importa a la persona.
        // 🚪 sin los que no son de la Liga (`fuera`: TFC y EFA, Dlx 04/10/2026) ni aquellos donde el bot no está y
        // salían siempre bloqueados (TWR, FTN y FRZ, Dlx 05/10/2026: «a»)
        // ⚠️ SALVO EL QUE SE ESTÁ MOSTRANDO: quien tiene su carta de la pre-temporada en TWR la ve al abrir /card, y
        // sin su opción el menú no marcaba ninguna ni dejaba volver a ella
        // 🎙️ ni los que no tienen carta de Servidor (`sinCarta`: FDS, Tier 3, 20/10/2026)
        options: SERVIDORES.filter(s => (!s.fuera && !s.sinCarta) || s.sv === svAhora).map(s => {
          const tiene = hayCarta(g, s.sv, m);
          const suyo = (g && g.n) || quien;
          const botAhi = !m || !m.bot_en || m.bot_en.indexOf(s.sv) >= 0;
          const base = tiene ? s.nombre
            : botAhi ? `${suyo} no está en ${s.sigla || s.sv}`
                     : `el bot todavía no está en ${s.sigla || s.sv}: no puedo saberlo`;
          return {
            label: tiene ? (s.sigla || s.sv) : `${s.sigla || s.sv} · 🔒 BLOQUEADA`,
            value: s.sv,
            // «Estás acá» se conserva aunque esté bloqueada: son dos datos
            // distintos —dónde estás vos y de quién es la carta— y los dos
            // sirven. Lo que ya NO se dice es «Tu servidor»: Dlx pidió
            // eliminar que una persona «sea» de un servidor.
            description: ((aqui === s.sv ? 'Estás acá · ' : '') + base).slice(0, 100),
            default: s.sv === svAhora,
          };
        }),
      }],
    });
  }
  // ✏️ LA PUERTA 4 DEL INVENTARIO (Dlx, 26/10/2026, a la maqueta: «cinco puertas, 1, 3, 4 y 5»): un link que abre el
  // Inventario de la página en ESTA carta. La carta es pública, así que lo ve todo el canal: dice «la tuya» porque
  // cada uno abre la suya (la página sabe quién eres por tu cuenta, no por el link)
  if (!enLiga) {
    componentes.push({ type: COMP.FILA, components: [Object.assign(botonLink('Personalizar la tuya', URL_INVENTARIO + '/' + cual),
      { emoji: { name: '✏️' } })] });
  }
  return componentes;
}

// 🔴 DICE QUIÉN GANA, Y DESDE EL 20/11/2026 TAMBIÉN MUESTRA LAS DOS CARTAS. Dlx, 20/09/2026: *«la idea es que no
// muestre las tarjetas. La cosa es hacer quién gana básicamente»*; y a la maqueta de los comandos (20/11/2026), «4A»:
// las dos cartas lado a lado, ARRIBA de la tabla. La tabla y el veredicto siguen siendo lo que contesta: las cartas son
// las mismas de `/card` (`urlImagen()`), así que no se dibuja nada nuevo.
//
// ⚠️ CADA CATEGORÍA COMPARA **SU** NÚMERO, y por eso la categoría es una sola
// para los dos. Es la primera regla del proyecto —«el número de cada carta
// mide lo que esa carta mide»— y es lo que hace imposible el cruce mixto:
// Temporada va en OVR y Competitiva en Score, que ni comparten escala.
//
//   Temporada    OVR de temporada   + los CINCO de su fórmula
//   Competitiva  Score              + las CINCO dimensiones
//   País         OVR Nacional       + tu puesto en tu país
//   Servidor     tu puesto ahí      + eventos
//
// ⚠️ LAS SUB-STATS NO SON CINCO ELEGIDAS A GUSTO. En Temporada son
// exactamente las de la fórmula del OVR —PTS 36% · EVT 20% · WR 16% · POD 16%
// · CAZ 12%— y en Competitiva las cinco dimensiones que multiplican el Score.
// Así la tabla **explica** el veredicto en vez de acompañarlo.
//
// 🔴 Y LA SERVIDOR NO VA POR OVR PORQUE NO TIENE OVR PROPIO. Medido:
// `03_Servidor/generar.py:136` lo toma prestado del pool de Temporada —está
// comentado ahí mismo como «los cuatro prestados»—, así que un versus de
// Servidor por OVR daría **exactamente** el mismo resultado que uno de
// Temporada y las dos categorías dejarían de medir cosas distintas.
const VS = {
  temporada: {
    k: 't', cabeza: ['OVR', 'ovr', 1],
    filas: [['Puntos', 'pts', 1], ['Eventos', 'ev', 1], ['Win %', 'wr', 1],
            ['Podios', 'pod', 1], ['Cazados', 'caz', 1]],
  },
  competitivo: {
    k: 'c', cabeza: ['Score', 'sc', 1],
    filas: [['Eficiencia', 'ef', 1], ['Consistencia', 'co', 1],
            ['Dominancia', 'dm', 1], ['Racha', 'te', 1], ['Diversidad', 'di', 1]],
  },
  pais: {
    // ⚠️ EL PUESTO SE MUESTRA PERO SE COMPARA POR `arc`. Konan es 1 de 33 en
    // Argentina y Bloody 6 de 25 en Colombia: el 1 y el 6 no se restan. El
    // cuarto elemento de la fila es «mostrá esto, compará aquello», y es el
    // mismo recurso que usa Servidor.
    k: 'p', cabeza: ['OVR Nacional', 'ovr', 1],
    filas: [['Puesto en tu país', 'pos', 1, 'arc']],
  },
  servidor: {
    // ⚠️ EL QUE DECIDE ES EL PERCENTIL, EL QUE SE MUESTRA ES EL PUESTO.
    // «1/18» contra «14/79» son puestos en poblaciones distintas y el número
    // más chico no es el mejor: ser 1 de 18 y ser 1 de 79 no es lo mismo.
    // `arc_sv` los pone en la misma escala. El puesto va igual porque es lo
    // que la persona reconoce de su tarjeta, y cuando los dos servidores son
    // distintos el mensaje lo aclara en vez de dejarlo implícito.
    k: 's', cabeza: ['Puesto', 'pos', 1, 'arc'], porPercentil: true,
    filas: [['Eventos', 'ev', 1]],
  },
};

// «1/33» -> 1 ·  «71.0» -> 71  ·  null -> null
const vsNum = (x) => {
  if (x === null || x === undefined || x === '') return null;
  const n = parseFloat(String(x).split('/')[0]);
  return Number.isFinite(n) ? n : null;
};

// Cómo se ve el valor en la tabla: el puesto entero, los números como vinieron.
// ⚠️ SI UNA COLUMNA TIENE DECIMAL, LAS DOS LO MUESTRAN. Un «71» al lado de
// un «54.5» se lee como dos precisiones distintas del mismo dato, y en una
// tabla alineada a la derecha además desalinea la coma. Se decide por FILA
// y no por valor: es la fila la que tiene una unidad.
const vsTxt = (x, dec) => {
  if (x === null || x === undefined || x === '') return '—';
  const n = typeof x === 'number' ? x : parseFloat(x);
  return (dec && Number.isFinite(n) && String(x).indexOf('/') < 0)
    ? n.toFixed(1) : String(x);
};

// ⚠️ SE RECORTAN LOS NOMBRES A 11 Y NO SE DEJA QUE LA TABLA CREZCA. Un bloque
// de código en Discord no hace wrap: con un nombre largo la fila se sale y en
// el celular se corta sin avisar. 11 entran los que hay hoy —el más largo del
// padrón es «MauzzitoEmeces»— con margen.
const corto = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));

/** La cuenta del versus, sin dibujarla: `{na, nb, et, sinNumeros, quien}` o `{na, nb, et, lineas, veredicto, ganador,
 *  marcador, nota}` (`ganador`: 'a', 'b' o null si empatan). La dibujan `versus()` (V2) y `versusTexto()` (la de antes). */
function tablaVs(a, ga, b, gb, cual) {
  const def = VS[cual] || VS.servidor;
  const va = ((ga && ga.vs) || {})[def.k] || null;
  const vb = ((gb && gb.vs) || {})[def.k] || null;
  const na = corto((ga && ga.n) || a, 11), nb = corto((gb && gb.n) || b, 11);
  const et = (CARTAS.find(c => c.id === cual) || {}).et || cual;

  // ⚠️ SIN NÚMEROS NO SE INVENTA UN EMPATE. Pasa con los 331 que tienen carta
  // de Servidor y nunca compitieron: el pipeline no les manda `vs`, y decir
  // «empatan» sería afirmar que midieron lo mismo.
  if (!va || !vb) return { na, nb, et, sinNumeros: true, quien: !va ? na : nb };

  // ⚠️ EL VEREDICTO Y EL MARCADOR DE LA FILA TIENEN QUE SALIR DE LA MISMA
  // CUENTA. La primera versión los separaba: la fila «Puesto» comparaba
  // `1/18` contra `14/79` —o sea el puesto crudo, que es la comparación
  // injusta— y el veredicto usaba el percentil. Los dos decían Konan por
  // casualidad; el día que no coincidan, el mensaje se contradice solo.
  //
  // El cuarto elemento de una fila es **con qué comparar** cuando no es lo
  // mismo que lo que se muestra. Se muestra el puesto, que es lo que la
  // persona reconoce de su tarjeta, y se compara el percentil, que es lo
  // único que pone dos poblaciones distintas en la misma escala.
  const cmp = (f, v) => vsNum(v[f[3] || f[1]]);
  const [etC, kC, sgC] = def.cabeza;
  const da = cmp(def.cabeza, va), db = cmp(def.cabeza, vb);

  const filas = [def.cabeza].concat(def.filas);
  const ancho = Math.max(...filas.map(f => f[0].length));
  const col = Math.max(na.length, nb.length, 6);
  let ga_ = 0, gb_ = 0;
  const lineas = [
    ' '.repeat(ancho + 4) + na.padStart(col) + '   ' + nb.padStart(col),
  ];
  for (const f of filas) {
    const xa = cmp(f, va), xb = cmp(f, vb);
    let mA = ' ', mB = ' ';
    if (xa !== null && xb !== null && xa !== xb) {
      const ganaA = f[2] > 0 ? xa > xb : xa < xb;
      if (ganaA) { mA = '▸'; } else { mB = '◂'; }
      // ⚠️ LA CABEZA NO ENTRA EN EL CONTEO. Es el veredicto, no un voto: si
      // contara, el «Konan 5 · Bloody 1» estaría diciendo dos veces lo mismo
      // y un 3-3 con la cabeza a favor de uno se leería como empate.
      if (f !== def.cabeza) { if (ganaA) ga_++; else gb_++; }
    }
    // ¿esta fila necesita decimal? Si cualquiera de los dos lo trae, los dos.
    const dec = [va[f[1]], vb[f[1]]].some(
      v => typeof v === 'number' && !Number.isInteger(v));
    lineas.push(f[0].padEnd(ancho) + '  ' + mA + ' ' + vsTxt(va[f[1]], dec).padStart(col)
                + ' ' + mB + ' ' + vsTxt(vb[f[1]], dec).padStart(col));
  }

  let veredicto, ganador = null;
  if (da === null || db === null || da === db) {
    veredicto = `🤝 **Empatan** en ${etC}`;
  } else {
    ganador = (sgC > 0 ? da > db : da < db) ? 'a' : 'b';
    veredicto = `🏆 Gana **${ganador === 'a' ? na : nb}**`;
  }
  // ⚠️ EL AVISO DE LAS POBLACIONES DISTINTAS VA SÓLO CUANDO LO SON. Ponerlo
  // siempre lo convierte en ruido que nadie lee, y justo el día que importa
  // tampoco se lee.
  const pA = String(va.pos || '').split('/')[1], pB = String(vb.pos || '').split('/')[1];
  const nota = (def.cabeza[3] === 'arc' || (def.filas[0] || [])[3] === 'arc') && pA && pB && pA !== pB
    ? `\n-# Son grupos de distinto tamaño (${pA} y ${pB}), así que el puesto ` +
      'se compara por percentil, no por el número.'
    : '';

  // ⚠️ EL CONTEO SOLO SI HAY SUB-STATS QUE CONTAR. Con una sola fila
  // debajo de la cabeza, un «0 · 0» no dice nada y ocupa un renglón.
  const marcador = (ga_ + gb_) ? `-# ${na} ${ga_} · ${nb} ${gb_}` : '';
  return { na, nb, et, lineas, veredicto, ganador, marcador, nota };
}

/** 🗄️ El versus de antes, en texto: sólo para los botones de un mensaje que nació sin el flag V2 (ver `legado()`). */
function versusTexto(a, ga, b, gb, cual, dueno) {
  const t = tablaVs(a, ga, b, gb, cual);
  if (t.sinNumeros) {
    return { content: `**${t.na}** vs **${t.nb}** · ${t.et}\n\nNo tengo números de **${t.quien}** en esta categoría, así que no puedo ` +
      'decir quién gana.', components: botonesVs(a, ga, b, gb, cual, dueno) };
  }
  return { content: `⚔️ **${t.na}** vs **${t.nb}** · ${t.et}\n\n${t.veredicto}\n` + '```\n' + t.lineas.join('\n') + '\n```\n' +
    t.marcador + t.nota, components: botonesVs(a, ga, b, gb, cual, dueno) };
}

/**
 * ⚔️ EL VERSUS EN V2 (Dlx, 20/11/2026, «4A»): público, en un recuadro del color del rango de QUIEN GANA (sin color si
 * empatan o si no tiene letra), con las dos cartas lado a lado arriba —las de `/card`— y abajo la tabla y «🏆 Gana X».
 * Los botones de categoría van debajo y afuera, con la regla de `/card`: la que estás mirando, gris y apagada.
 */
function versus(a, ga, b, gb, cual, dueno, m, aqui) {
  const t = tablaVs(a, ga, b, gb, cual);
  const sv = cual === 'servidor' ? svDeAmbos(ga, gb, aqui, m) : null;
  const img = (q, g, n) => ({ media: { url: urlImagen(q, g, cual, cual === 'servidor' ? svQueVa(g, sv, aqui, m) : ((g && g.sv) || ''), m, null) },
    description: `Carta ${cual} de ${n}` });
  const color = t.ganador === 'a' ? colorRango(m, ga && ga.rg) : t.ganador === 'b' ? colorRango(m, gb && gb.rg) : null;
  const dentro = [V.galeria(img(a, ga, t.na), img(b, gb, t.nb)), V.T(`### ${t.na} vs ${t.nb} · ${t.et}`)];
  if (t.sinNumeros) {
    dentro.push(V.T(`No tengo números de **${t.quien}** en esta categoría, así que no puedo decir quién gana.`));
  } else {
    dentro.push(V.T('```\n' + t.lineas.join('\n') + '\n```'));
    dentro.push(V.T(t.veredicto + (t.marcador ? '\n' + t.marcador : '') + t.nota));
  }
  return { flags: V2, components: [V.caja(color, dentro)].concat(botonesVs(a, ga, b, gb, cual, dueno).filter((f) => f.components.length)),
    allowed_mentions: { parse: [] } };
}

// ⚠️ SÓLO LAS CATEGORÍAS QUE TIENEN LOS DOS, Y DESBLOQUEADAS. Es `tieneReal()`
// aplicado dos veces: un botón que lleva a medio versus no se dibuja, la misma
// regla que en `carta()`.
//
// ⚠️ EL BOTÓN CAMBIA LAS DOS A LA VEZ, que es todo el punto. El custom_id
// lleva los dos nombres, así que el Worker no se acuerda de nada entre click y
// click — igual que `carta()`.
const botonesVs = (a, ga, b, gb, cual, dueno) => [{
  type: COMP.FILA,
  components: CARTAS.filter(c => tieneReal(ga, c.id) && tieneReal(gb, c.id))
    .map(c => ({
      type: COMP.BOTON,
      style: c.id === cual ? ESTILO.SECUNDARIO : ESTILO.PRIMARIO,
      label: c.et,
      custom_id: `v:${a}:${c.id}:${dueno}:${b}`,
      disabled: c.id === cual,
    })),
}];

// 🔴 UN VERSUS NECESITA LA CARTA DE VERDAD, NO EL CANDADO. `tiene()` contesta
// que sí también cuando lo único que hay es la Bloqueada —a propósito: para
// `/card` el candado ES algo que mostrar, porque dice cuánto te falta—. Pero
// enfrentar una carta real contra un candado no compara nada: de un lado hay
// un OVR y del otro «te faltan 2 eventos», que es el progreso de esa persona y
// no un resultado.
//
// ⚠️ LO ENCONTRÓ `bot/simular.mjs` EN SU PRIMERA CORRIDA, no la lectura del
// código. En pantalla se ve perfecto —dos cartas de la misma categoría, lado a
// lado, las dos existen en R2— y por eso el chequeo que lo agarró no fue «¿la
// URL existe?» sino «¿las dos son la MISMA categoría?». La respuesta era
// `temporada` contra `bloq-temporada`.
const tieneReal = (g, id) => tiene(g, id) && !bloqueada(g, id);

// El servidor donde los DOS tienen carta. El de este canal manda; si alguno no
// la tiene ahí, se cae al primero que compartan.
//
// ⚠️ DEVUELVE null CUANDO NO COMPARTEN NINGUNO, y el que llama tiene que
// contestar eso en palabras. Elegir igual uno de los dos armaría una URL que
// no existe, y Discord una imagen que no carga la muestra como un hueco mudo:
// es el mismo agujero que ya costó `soto/sv-ffa.webp`.
const svDeAmbos = (ga, gb, aqui, m) => {
  if (aqui && hayCarta(ga, aqui, m) && hayCarta(gb, aqui, m)) return aqui;
  const suyos = (ga && ga.svc) || [];
  return suyos.find(s => hayCarta(ga, s, m) && hayCarta(gb, s, m)) || null;
};

// ⚠️ LA CARTA ES PUBLICA: la ve todo el canal. Dlx, 17/09/2026.
// Sin el flag EFIMERO queda en el chat como cualquier mensaje — y por eso
// hace falta lo de abajo: si los botones fueran de cualquiera, el primero
// que pase te cambia la carta de tu propio mensaje.
const responder = (tipo, componentes) => new Response(JSON.stringify({
  type: tipo,
  data: { flags: V2, components: componentes },
}), { headers: { 'content-type': 'application/json' } });

// 🗄️ EL VERSUS DE ANTES ERA TEXTO (sin V2), y desde el 20/11/2026 va en V2 con las dos cartas. Esto queda SÓLO para
// los botones de un versus viejo, que sigue en el canal: un mensaje que nació sin el flag se edita sin el flag.
// ⚠️ Y VA PÚBLICO, sin EFIMERO: es la misma decisión que la carta —Dlx, 17/09—.
const responderTexto = (tipo, d) => new Response(JSON.stringify({
  type: tipo,
  data: { content: d.content, components: d.components },
}), { headers: { 'content-type': 'application/json' } });

// ── 🧱 LAS RESPUESTAS EN V2 (20/11/2026) ─────────────────────────────────────────────────────────────────────────────
// Todo mensaje nuevo del bot sale con el flag V2 y en un recuadro (`bot/vista.js`). ⚠️ El flag NO se le pone a un mensaje
// que nació sin él (los paneles, versus e invitaciones de antes, que siguen en el chat): `legado()` lo dice, mirando las
// banderas del mensaje que trae el clic. Sin banderas (no debería pasar), se toma como nuevo.
const responderV2 = (tipo, data) => V.respuesta(tipo, data);
const legado = (i) => !!(i && i.message && typeof i.message.flags === 'number' && !(i.message.flags & V2));
const esEfimero = (i) => !!(i && i.message && (Number(i.message.flags) & EFIMERO));
/** Pisa el mensaje del clic (tipo 7) con uno V2; si ese mensaje es de antes (sin el flag), manda uno nuevo y efímero. */
const editarAqui = (i, data) => (legado(i)
  ? responderV2(RESPONDE.MENSAJE, Object.assign({}, data, { flags: V2 | EFIMERO }))
  : responderV2(RESPONDE.ACTUALIZAR, data));
/** Edita la respuesta de esta interacción (la de un comando, o el mensaje del botón tras un tipo 6). */
const editarOriginal = (i, data) => fetch(`https://discord.com/api/v10/webhooks/${i.application_id}/${i.token}/messages/@original`, {
  method: 'PATCH', headers: { 'content-type': 'application/json' },
  body: JSON.stringify(Object.assign({ allowed_mentions: { parse: [] } }, data,
    data && data.flags !== undefined ? { flags: Number(data.flags) & ~EFIMERO } : {})),
}).catch(() => {});

// 🎨 EL COLOR DE TU RANGO, del dato: `meta.rangos.color` lo escribe `bot/subir_datos.py` desde `comun/rangos.py`. Sin el
// dato (un `meta` de antes) o sin letra (menos de 10 eventos), el recuadro va sin color: sin dato no hay pieza
const colorRango = (m, rg) => (rg && m && m.rangos && m.rangos.color ? V.deHex(m.rangos.color[rg]) : null);
const leerMeta = async (env) => { try { return JSON.parse((await env.KV.get('meta', { cacheTtl: 300 })) || '{}') || {}; } catch (e) { return {}; } };
/** Quién es por su Discord ID: `{clave, g, m}` (su ficha y el meta), lo que piden el color y el nombre de un panel. */
async function personaDe(env, did) {
  let clave = '', g = null;
  const [c, m] = await Promise.all([claveCarta(env, did).catch(() => null), leerMeta(env)]);
  clave = c || '';
  if (clave) { try { g = JSON.parse((await leerP(env, clave)) || 'null'); } catch (e) { g = null; } }
  return { clave, g, m: m || {} };
}
// 🙂 TU CARA AL COSTADO: la foto congelada de la temporada (R2, la de tus cartas) si está; si no, tu avatar de Discord, que
// viene en el pedido firmado; si no hay ninguna, nada. ⚠️ Sólo en lo que ves tú (efímero): la dirección de la foto no
// se adivina (lleva sal) y no tiene que quedar a la vista de un canal.
async function caraDe(env, i, clave) {
  if (clave && env.CARTAS) {
    try {
      const k = claveFoto(env, clave);
      const h = await env.CARTAS.head(k);
      if (h) return `${R2}/${k}?v=${encodeURIComponent(String(h.etag || h.size || '1')).slice(0, 40)}`;
    } catch (e) { /* sin R2, la de Discord */ }
  }
  const { id, hash } = avatarDe(i);
  return id && hash ? `https://cdn.discordapp.com/avatars/${id}/${hash}.webp?size=128` : '';
}
const nombreDe = (g, clave) => String((g && g.n) || clave || '').replace(/[`*_~|<>@]/g, '');
/**
 * La ficha de un comando: la franja de su familia, el título (con la cara o el escudo al costado), lo de adentro y las
 * filas de botones afuera. `cuerpo`: textos, `'—'` (un separador) o piezas hechas.
 */
function ficha(o) {
  const cabeza = o.cabeza || ((o.titulo ? '### ' + o.titulo : '') + (o.sub ? (o.titulo ? '\n' : '') + '-# ' + o.sub : ''));
  const dentro = [cabeza ? V.seccion(cabeza, o.acc || V.mini(o.cara)) : null];
  for (const c of o.cuerpo || []) dentro.push(c === '—' ? V.SEP : typeof c === 'string' ? (c ? V.T(c) : null) : c);
  return V.mensaje({ color: o.color, familia: o.fam === undefined ? null : o.fam, dentro, filas: o.filas || [],
    efimero: o.efimero !== false, arriba: o.arriba, menciones: o.menciones });
}

// ⚠️ UN BOTÓN DE LINK NO ES UN BOTÓN. Estilo 5, lleva `url` y **no lleva
// `custom_id`**: Discord lo dibuja como botón pero al apretarlo abre el link
// sin mandarle nada al bot. O sea que no gasta interacción, no pasa por el
// freno al spam, no puede vencer y no hay handler que escribir. Es la forma
// barata de que un link se vea como una acción.
//
// ⚠️ Y NO VAN EN LOS MENSAJES DE CARTA. Esos usan Components V2 (`V2`), que
// deshabilita `content`; los avisos son mensajes normales, donde `content` y
// `components` conviven como siempre. Mezclar los dos mundos es lo que hace
// que Discord rechace el payload entero sin decir cuál de los dos campos
// sobraba.
const botonLink = (label, url) => ({ type: 2, style: 5, label, url });

// 🔔 LA CAMPANA VA DEBAJO DE LA CARTA. Decidido el 21/09/2026 (ver
// `ESTADO.md`, «avisarle a la gente fuera de Discord»): *«el cuello de
// botella no es el canal, es el permiso — y se pide donde ya están:
// alguien tira /card, ve su tarjeta, y abajo va el botón»*.
//
// ⚠️ ES DE LINK (estilo 5), así que no gasta interacción ni pasa por el
// freno. Y SÓLO SI HAY LUGAR: una fila lleva cinco botones y Discord
// rechaza el mensaje entero con el sexto. El día que haya cinco cartas,
// la campana se cae sola en vez de romper `/card`.
// la Liga vive en /freestyle-rap desde el 01/10/2026 (los `/#/…` viejos siguen andando: los traduce la página)
const AVISOS_URL = 'https://underlegends.pages.dev/freestyle-rap/avisos';
const HUB_URL = 'https://underlegends.pages.dev';
const botonAvisos = (ocupados) => (ocupados < 5
  ? [{ type: 2, style: 5, label: 'Avisos', emoji: { name: '🔔' }, url: AVISOS_URL }]
  : []);

// (la fila de botones de los mensajes de antes, `filaDe()`, se fue el 20/11/2026: las arma `V.fila()` de bot/vista.js)

/** 🗳️ Anota el voto y devuelve el texto para quien votó. */
async function votoChat(env, did, id, lado) {
  let j = {};
  try {
    const r = await env.AVISOS.get(env.AVISOS.idFromName('liga')).fetch('https://avisos/qg-votar', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quien: did, id, lado }),
    });
    j = await r.json();
  } catch (e) { j = { error: 'red' }; }
  if (j.ok) {
    // 🧮 con N lados (un «todos contra todos») el total y el porcentaje los da el objeto
    const n = typeof j.n === 'number' ? j.n : (j.na || 0) + (j.nb || 0);
    const pct = typeof j.pct === 'number' ? j.pct : n ? Math.round((100 * (j.lado === 'A' ? j.na : j.nb)) / n) : 0;
    return '🗳️ ' + (j.cambio ? 'Cambiaste tu voto: ahora vas con' : 'Votaste por') + ' **' + j.nombre + '**, que tiene el '
      + pct + ' % de ' + n + (n === 1 ? ' voto' : ' votos') + '. En el mensaje se ve en un minuto.';
  }
  return '🗳️ ' + ({ cerrada: 'Ese voto ya cerró: la batalla se jugó.', 'no existe': 'Ese voto ya no existe.' }[j.error]
    || 'No pude anotar tu voto: prueba de nuevo.');
}

/** 🎲 Lo que hace falta para apostar: la configuración y de quién es la cuenta. `null` si no están listas. */
async function datosApuesta(env, did) {
  let cfg = null;
  try { cfg = JSON.parse((await env.KV.get('precios', { cacheTtl: 60 })) || 'null'); } catch (e) { cfg = null; }
  if (!cfg || !Number.isInteger(cfg.inicial)) return null;
  let clave = '';
  try { clave = (await claveCarta(env, did)) || ''; } catch (e) { clave = ''; }
  return { clave, inicial: cfg.inicial, desde: Date.parse(cfg.desde || '') || 0 };
}

const milesChat = (v) => String(Math.round(v || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** 🎲 Anota la apuesta y devuelve el texto. `libre`: el monto lo escribió cada uno en el modal. */
async function apuestaChat(env, did, ap, lado, monto, c, libre) {
  let j = {};
  try {
    const r = await env.AVISOS.get(env.AVISOS.idFromName('liga')).fetch('https://avisos/apostar', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quien: did, ap, lado, monto, clave: c.clave, inicial: c.inicial, desde: c.desde, libre }),
    });
    j = await r.json();
  } catch (e) { j = { error: 'red' }; }
  const mil = milesChat;
  if (j.ok) {
    return `🎲 Apostaste **${mil(j.monto)}** a **${j.nombre}**` + (j.total > j.monto ? ` (vas ${mil(j.total)} en total)` : '')
      + `. El pozo ya es de **${mil(j.pozo)}** entre ${j.cuantos}; cierra <t:${Math.floor(j.cierra / 1000)}:R>.`
      + `\nTe quedan **${mil(j.saldo)}** Puntos de Tienda.`;
  }
  const por = {
    cerrada: 'Las apuestas de esa batalla ya cerraron.',
    'no existe': 'Esa apuesta ya no existe.',
    propia: 'No puedes apostar en tu propia batalla.',
    'otro lado': `Ya apostaste a **${j.nombre || 'el otro'}**: en una batalla se apuesta a un solo lado.`,
    tope: `El tope es ${mil(j.tope || 500)} por batalla: te quedan ${mil(j.queda)}.`,
    saldo: `No te alcanza: tienes ${mil(j.saldo)} Puntos de Tienda.`,
  };
  return '🎲 ' + (por[j.error] || 'No pude anotar la apuesta: prueba de nuevo.');
}

/** 🎲 Quien escribió 0: no apostó, y se le recuerda cuánto tiene. */
async function saldoChat(env, did, ap, c) {
  try {
    const r = await env.AVISOS.get(env.AVISOS.idFromName('liga')).fetch('https://avisos/apuesta-info', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quien: did, ap, clave: c.clave, inicial: c.inicial, desde: c.desde }),
    });
    const j = await r.json();
    return typeof j.saldo === 'number' ? `No apostaste: sigues con **${milesChat(j.saldo)}** Puntos de Tienda.` : 'No apostaste.';
  } catch (e) { return 'No apostaste.'; }
}

// ── 🌙 «Tu nota» y «Perfiles», al pie del aviso de ganadores (18/11/2026) ──────────────────────────────────────────────
// Dlx eligió los botones con las visitas de 7 días: «Tu nota» le muestra a quien toca SU nota, por qué la sacó, su ELO y
// su puesto (y «Consigue tu tarjeta» si no la tiene: Tarjetas tuvo 28 visitas, así que va ahí y no como botón para
// todos); «Perfiles», los del podio. Los dos leen UNA clave de KV, `noche:<n>`, que el aviso escribe al mandarse
// (`bot/aviso_ganadores.py` → `bot/noche.py ficha()`): ni un cálculo acá, ni una escritura.
const mdNoche = (s) => String(s == null ? '' : s).replace(/([\\*_~`|>])/g, '\\$1').replace(/@/g, '@\u200b');
const notaNoche = (v) => (Math.round(Number(v || 0) * 10) / 10).toFixed(1).replace('.', ',');
const deltaNoche = (d) => {
  const x = Number(d || 0);
  const t = Math.abs(x) < 0.1 && x !== 0 ? Math.abs(x).toFixed(2) : Math.abs(x).toFixed(1);
  return (x < 0 ? '−' : '+') + t.replace('.', ',');
};
const PUESTO_NOCHE = { 'Campeón': '🏆', 'Subcampeón': '🥈', 'Tercero': '🥉', 'Semifinal': '🥉', 'Cuarto': '🎖️' };

/** 🎯 El texto de «Tu nota» para `yo` (su Discord ID), y sus botones; `null` si no jugó esa noche (o no está vinculado). */
export function tuNotaNoche(f, yo) {
  const p = ((f && f.p) || []).find((x) => x.d && String(x.d) === String(yo));
  if (!p) return null;
  const t = [`🎯 **Tu nota en ${mdNoche(f.t)}: ${notaNoche(p.nota)}**${p.mvp ? ' · ⭐ MVP de la noche' : ''}`];
  const linea = [];
  if (p.pos) linea.push(`${PUESTO_NOCHE[p.pos] || '▫️'} ${mdNoche(p.pos)}`);
  if (p.elo && p.elo.length === 2) {
    const dl = p.elo[1] - p.elo[0];
    linea.push(`ELO ${milesChat(p.elo[0])} → **${milesChat(p.elo[1])}** (${dl > 0 ? '▲ +' + dl : dl < 0 ? '▼ ' + dl : '='})`);
  }
  if (p.pts && Number(p.pts)) linea.push(`+${milesChat(Number(p.pts))} pts`);
  if (linea.length) t.push(linea.join(' · '));
  if (p.bat) t.push('🔥 **Batacazo de la noche**');
  if (p.eq) t.push('-# Es la nota de tu equipo: la comparten todos.');
  const por = (p.por || []).filter((r) => r && r[0]);
  if (por.length) {
    t.push('-# Todos arrancan en 6,0 por jugar. Lo que sumó y restó:');
    for (const [r, d] of por.slice(0, 12)) t.push(`• ${mdNoche(r)} **${deltaNoche(d)}**`);
  }
  const botones = [];
  if (!p.carta) {
    t.push('🃏 Todavía no tienes tarjeta: consíguela en la página.');
    botones.push({ type: 2, style: 5, label: 'Consigue tu tarjeta', emoji: { name: '🃏' }, url: HUB_URL + '/freestyle-rap/tarjetas' });
  } else if (p.k) {
    botones.push({ type: 2, style: 5, label: 'Tu perfil', emoji: { name: '👤' }, url: HUB_URL + '/freestyle-rap/r/' + encodeURIComponent(p.k) });
  }
  botones.push({ type: 2, style: 5, label: 'La llave', emoji: { name: '📋' }, url: HUB_URL + '/freestyle-rap/llave/' + encodeURIComponent(f.ev) });
  return { texto: t.join('\n').slice(0, 1990), botones };
}

/** 👤 «Perfiles»: los del podio de esa noche (y el MVP y el del batacazo), un botón a cada perfil. */
export function perfilesNoche(f) {
  const perf = ((f && f.perf) || []).filter((x) => x && x[1]).slice(0, 5);
  const por = Object.fromEntries(((f && f.p) || []).map((x) => [x.k, x]));
  const t = [`👤 **Los perfiles de la noche de ${mdNoche(f.t)}**`];
  for (const [n, k] of perf) {
    const x = por[k] || {};
    t.push(`${PUESTO_NOCHE[x.pos] || '▫️'} **${mdNoche(n)}** · ${notaNoche(x.nota)}${x.mvp ? ' · ⭐ MVP' : ''}${x.bat ? ' · 🔥 Batacazo' : ''}`);
  }
  const botones = perf.map(([n, k]) => ({ type: 2, style: 5, label: String(n).slice(0, 80),
    url: HUB_URL + '/freestyle-rap/r/' + encodeURIComponent(k) }));
  return { texto: t.join('\n').slice(0, 1990), botones };
}

// 🚧 EL AVISO, EN UN RECUADRO CHICO Y SIN COLOR (Dlx, 20/11/2026: «5A»). Es la respuesta de ~140 lugares —errores, el
// freno, «eso es de otra persona»—: se cambió acá y no en cada uno. Sin franja: la franja no va nunca en un error
const aviso = (txt, botones) => responderV2(RESPONDE.MENSAJE, V.avisoMsg(txt, botones));

// ⚠️ EL FRENO CONTESTA CON UN MENSAJE NUEVO Y EFÍMERO (tipo 4), NUNCA CON
// ACTUALIZAR. Con el 7 la respuesta pisaría la carta pública y el castigo por
// apurarse sería borrarle la carta a quien la pidió — que es exactamente lo
// que el freno quiere evitar. Es la misma razón que el aviso de «esa carta la
// pidió otra persona».
const espera = (seg) => aviso(
  `**Para un poco** 🙂\n-# Prueba de nuevo en **${seg} s**.`);

// ── La invitación ─────────────────────────────────────────────────────────
// ⚠️ EL BOT NO PUEDE SABER EN QUÉ SERVIDORES ESTÁS, y conviene tenerlo claro
// antes de leer la regla: con interacciones por HTTP, Discord manda el guild
// donde escribiste y NADA MÁS. Saber el resto pide el gateway y el intent de
// miembros, que es justo lo que este bot no pide —ver CLAUDE.bot.md—.
//
// Así que la señal es la que hay: **ni es donde estás parado, ni es el tuyo**.
// Si elegís TWR estando en FFA y tu carta dice TFC, lo más probable es que no
// estés en TWR, y ahí va el link. Es una suposición, y por eso el mensaje
// pregunta («¿no estás adentro?») en vez de afirmar.
// 🔴 ESTO PREGUNTABA POR `g.sv` Y ESO DEJÓ DE SER «TU SERVIDOR» EL 19/09/2026.
// La versión vieja era `sv !== g.sv`, o sea «¿es distinto de tu único
// servidor?». Cuando `g.sv` pasó a ser sólo **el default para los mensajes
// directos**, la pregunta quedó mal hecha: Lil Drako tiene `svs: [DRA, FFA]`,
// elige FFA, y como `FFA !== DRA` el bot le ofrecía **entrar a un servidor
// donde ya está**. Lo reportó él mismo.
//
// La pregunta correcta es la que ahora se puede contestar: ¿está en ese
// servidor? `g.svs` lo dice, medido contra Discord.
//
// ⚠️ Y SI EL BOT NO ESTÁ EN ESE SERVIDOR, NO SE INVITA. No es que sepamos que
// no está: es que **no podemos saberlo**, y ofrecerle entrar a alguien que ya
// entró es justo el bug de arriba, una versión más difícil de detectar porque
// nadie lo puede verificar. Además la carta de ese servidor está bloqueada
// igual hasta que el bot entre, así que la invitación no destrabaría nada.
const quiereEntrar = (g, sv, aqui, m) => {
  if (!sv || sv === aqui) return false;          // estás parado ahí
  if (m && m.bot_en && m.bot_en.indexOf(sv) < 0) return false;   // no sabemos
  if (g && g.svs) return g.svs.indexOf(sv) < 0;  // lo sabemos: sólo si NO está
  // KV viejo, sin `svs`: se vuelve al criterio de antes, que es lo único que
  // hay. Peor que el nuevo, mejor que no contestar.
  return sv !== (g && String(g.sv || '').toUpperCase());
};

// ⚠️ SIN LINK NO HAY MENSAJE, Y ES A PROPOSITO. La primera version contestaba
// «todavía no tengo el link de invitación de ese servidor, pedíselo a un
// admin». Eso le sirve a quien mantiene el bot y a nadie más: la persona que
// eligió TWR en el menú no puede hacer nada con esa frase, y la recibiría en
// CADA cambio de servidor. Un aviso que el que lo lee no puede accionar es
// ruido. Que falten links se dice donde corresponde —`bot/verificar.py`—, no
// en la cara de quien mira una carta.
// ⚠️ DEVUELVE `{texto, botones}` Y NO UNA CADENA, desde el 18/09/2026. Dlx:
// «¿no puede generar un botón donde ahí esté todo?». El link pelado obliga a
// leer una URL y decidir; el botón dice qué va a pasar antes de apretarlo.
function invitacion(sv) {
  const s = SV_DE(sv);
  if (!s || !s.invita) return null;
  return {
    texto: `**${s.sv}** · ${s.nombre}\n¿No estás adentro? Entra por acá 👇`,
    botones: [botonLink(`Entrar a ${s.sv}`, s.invita)],
  };
}

// La invitación que corresponde mandar, o null si no corresponde ninguna.
const invitaSi = (g, sv, aqui, m) =>
  quiereEntrar(g, sv, aqui, m) ? invitacion(sv) : null;

// ⚠️ LA PUERTA DE ENTRADA A LA LIGA ES DRA, Y ES UNA REGLA DE LA LIGA, NO DEL
// BOT. Dlx, 18/09/2026: «aquellos q no estan en DRA significa que perderan su
// tarjeta. Necesitan estar en DRA y ser verificados para tener acceso».
//
// ⚠️ ESTE MENSAJE PASÓ A SER EL QUE MÁS GENTE VA A LEER, y por eso se
// reescribió. Mientras el bot vivía sólo en FFA, quien tiraba `/card` era casi
// siempre alguien del pool. Con DRA adentro la cuenta se dio vuelta: son miles
// de personas y 109 tienen carta. El texto viejo —«te falta el **Discord ID**
// en el Sheet Operativo»— le daba a entender a un desconocido que ya estaba
// anotado y que había un trámite pendiente. Le contestaba al caso raro.
//
// ⚠️ Y CAMBIA SEGÚN DE DÓNDE VENGA, que es toda la gracia. Una mención de
// canal `<#id>` sólo se dibuja para quien YA puede ver ese canal: a alguien
// que no está en DRA le queda una mención rota, que es peor que no poner
// nada. Desde DRA va la mención —clickeable y con el nombre—; desde afuera va
// la invitación más la URL completa, que después de entrar lleva al mismo
// lugar. Al que ya está en DRA y pregunta desde otro servidor le llega la
// invitación igual, y eso no molesta: Discord le dice que ya es miembro.
//
// ⚠️ EL CANAL ESTÁ ACÁ Y EN `datos/servidores.json`, como todo lo demás de la
// tabla, y `probar_local.mjs` compara los dos. El Worker no lee archivos del
// repo, así que la copia es inevitable; lo que no es inevitable es que se
// separen sin que nadie se entere.
//
// ⚠️ SON DOS ID Y NO UNO, Y LA DIFERENCIA SE DESCUBRIÓ A LOS GOLPES. Dlx pasó
// `1514898497265078423` como «el canal» y daba **404 Unknown Channel**. No era
// permisos —un canal sin acceso contesta **403**, y se probó— sino que ese
// número es el **mensaje** de YAGPDB que pide la verificación, adentro del
// canal. El link que copia Discord con «Copiar enlace del mensaje» termina en
// el id del mensaje, y el de «Copiar ID del canal» no.
//
// Que sean dos sale ganando: desde afuera la URL puede apuntar **al mensaje**,
// así la persona cae en la instrucción y no en un canal donde hay que buscarla.
export const VERIFICA = {
  sv: 'DRA',
  canal: '1506094409438199988',
  mensaje: '1514898497265078423',
};

// 🔑 QUIEN SE ANOTA A SÍ MISMO ENTRA SOLO (25/09/2026, #11 de Dlx), si
// Discord sabe su país. Si no —o si su nombre se parece al de alguien que ya
// está— lo decide un admin.
//
// 🔴 PERO «TE ANOTÉ» NO ES «YA TENÉS TARJETA» (Dlx, 04/10/2026, con la captura de
// Adriagner: «el hecho de que el bot reconozca unas personas no significa que esas
// personas tengan su tarjeta automáticamente»). Las tarjetas son de quien JUEGA:
// anotarlo deja su ID y su país listos para el día que juegue, nada más. El texto de
// antes decía «entrás a la Liga solo en menos de una hora», y se leía como «en una
// hora tenés tu carta».
const YA_TE_ANOTE = 'Todavía no tienes tarjeta 🃏 — se consiguen en dos pasos, y los dos son tuyos.\n\n' +
  '✍️ Ya te anoté: si Discord sabe tu país (bandera en tu apodo o un rol de país), ' +
  'quedas en la Lista en menos de una hora; si no, te lo pido en la página.';
// 📅 adónde ir a jugar: la página de Eventos, con los que vienen y cómo anotarse
const URL_EVENTOS = 'https://underlegends.pages.dev/freestyle-rap/eventos';
const botonEventos = () => ({ type: 2, style: 5, label: 'Ver los próximos eventos', url: URL_EVENTOS });

// 🔑 QUÉ PIDE CADA CARTA (Dlx, 05/10/2026: «si alguien nuevo usa el comando, que le diga que tiene que verificarse
// en la página… y así desbloquea la tarjeta de servidor para cada sv que él se encuentre», «C», «nivel 1»). Sin
// verificarse, ninguna; la Temporada es la recompensa del nivel 1 del Pase. Lo dicen `/card` y `/versus` con
// `dosPasos()` (era el texto `QUE_PIDE` hasta el 20/11/2026, que además decía «Cumplí»: voseo); la regla vive en
// `bot/verificados.puede()`
// 🎟️ el Pase, donde están las Tareas de la semana
const URL_PASE = 'https://underlegends.pages.dev/freestyle-rap/pase';
// 🎒 el Inventario (26/10/2026): `/<carta>` lo abre en esa carta
const URL_INVENTARIO = 'https://underlegends.pages.dev/freestyle-rap/inventario';

/**
 * 🃏 «TODAVÍA NO TIENES TARJETA», COMO DOS FILAS CON SU BOTÓN (Dlx, 20/11/2026, la maqueta): lo que hoy eran 800 letras
 * pasa a dos pasos, cada uno con su botón al costado —el de verificarse y el del Pase—, y lo demás en letra chica. Es lo
 * que decía `QUE_PIDE`, en ficha. `{aqui, titulo, sub, nota, eventos}`: `nota` va al pie; `eventos`, «Ver los próximos».
 */
function dosPasos(o) {
  const enDra = o.aqui === VERIFICA.sv;
  return ficha({ fam: 'cartas', titulo: o.titulo, sub: o.sub,
    cuerpo: ['—',
      V.seccion('**1 · Verifícate en la página**\n-# Se desbloquea tu **Servidor**, la de cada servidor donde estás.' +
        (enDra ? '' : ' Si no estás en **Discord Rap Español**, la página te mete.'), V.enlace('Verificarme', URL_VERIFICAR)),
      V.seccion('**2 · Cumple tu primera Tarea del Pase de rapero**\n-# Se desbloquea tu **Temporada**. Si todavía no jugaste, ' +
        'sale con «—» y se llena con tu primer evento.', V.enlace('Ver el Pase', URL_PASE)),
      '—',
      '-# La **Competitiva** pide 10 eventos y la de **País**, 3 cruces nacionales y 3 internacionales (en un 1 contra 1 o en ' +
        'un triple).' + (o.nota ? '\n-# ' + o.nota : '')],
    filas: [o.eventos ? [botonEventos()] : []] });
}
const ANOTE_CORTO = '✍️ Ya te anoté: si Discord sabe tu país (bandera en tu apodo o un rol de país), quedas en la Lista en ' +
  'menos de una hora; si no, te lo pido en la página.';
/** Lo que no puede esperar al objeto dormido (~4 s en frío): lo que llegue antes de `ms`, o `siNo`. Lo que no llegó sigue
 *  en el fondo (y despierta al objeto para lo que viene). */
const aTiempo = (p, ms, siNo) => Promise.race([Promise.resolve(p).catch(() => siNo),
  new Promise((r) => setTimeout(() => r(siNo), ms))]);

// «Verificate…» -> «verificate…», para seguir una frase
const minuscula = (t) => (t ? t.charAt(0).toLowerCase() + t.slice(1) : t);

// 🔑 DESDE EL 01/10/2026, A LA PÁGINA. Dlx, con la captura de un `/card` que
// decía «todavía no estás verificado»: «en vez de que le aparezca así, haz que
// la gente se verifique por la página web, así más rápido, y que esto te
// redirija, y que te entres a DRA automáticamente». La página te mete en DRA si
// no estás, te pide el país y te anota (`cuentaVerificar()`): el camino entero
// en un botón. Antes eran dos —entrar a DRA y después su canal—, y el orden de
// los dos era la mitad de este comentario.
//
// ⚠️ UN SOLO BOTÓN, también estando en DRA: adentro te falta lo mismo (el país,
// las reglas) y la página lo dice igual. El canal de DRA sigue existiendo
// (`VERIFICA`), para quien prefiera hacerlo allá. Devuelve `{texto, botones}`.
const URL_VERIFICAR = HUB_URL + '/cuenta/verificar';
function comoVerificarse(aqui) {
  const s = SV_DE(VERIFICA.sv);
  const nombre = (s && s.nombre) || 'Discord Rap Español';
  const botones = [botonLink('Verificarme en la página', URL_VERIFICAR)];
  const texto = aqui === VERIFICA.sv
    ? 'Verifícate en la página, en un toque: te pide tu país y te dice qué te falta 👇'
    : `Verifícate en la página, en un toque: si no estás en **${nombre}** te mete, ` +
      'te pide tu país y te dice qué te falta 👇';
  return { texto, botones };
}

// ⚠️ UNA INTERACCIÓN SE CONTESTA UNA SOLA VEZ. Para mandar la carta **y** la
// invitación hace falta un segundo mensaje, que va por el webhook de la
// interacción. No usa el token del bot: va firmado con el `token` que vino en
// el propio payload, así que el Worker sigue sin conocerlo.
//
// ⚠️ Y VA CON waitUntil: la respuesta a Discord tiene 3 segundos. Si se
// esperara este fetch, un servidor lento haría fallar la carta entera.
function luego(ctx, promesa) {
  if (ctx && ctx.waitUntil) ctx.waitUntil(promesa);
  else promesa.catch(() => {});
}

// 🧱 en V2 (20/11/2026): un mensaje aparte, efímero, en el mismo recuadro chico que `aviso()`. `data` en vez de texto: uno
// ya armado (`ficha()`)
const seguir = (i, txt, botones, data) =>
  fetch(`https://discord.com/api/v10/webhooks/${i.application_id}/${i.token}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data || V.avisoMsg(txt, botones)),
  });

// ═══ 🛍️🐉 LA TIENDA Y LOS DROPS EN DISCORD (Discord, tanda 1, 17/11/2026) ═══════════════════════════════════════════
// Dlx: «comandos nuevos: /inventario + /equipar, /billetera + /drops, /vincular. No /tienda» y «en Discord se abren el
// Drop común y el Star; Nido, cofres y Tesoro mandan a la página». Todo es de quien tocó (Discord lo firma: `idDe(i)`) y
// se lo contesta sólo a él (efímero). Los datos son los del objeto, por Discord ID, igual que en la página.
//
// ⚠️ EL OBJETO PUEDE ESTAR DORMIDO (~4 s en frío): se contesta «pensando» (tipo 5) y se edita después, como `/foto`.
const RANURA_NOMBRE = { aro: 'Aro', deco: 'Decoración', nom: 'Nombre', carta: 'Efecto de carta', perfil: 'Perfil',
  fp: 'Fondo · tu perfil', fv: 'Fondo · VS del Inicio', fe: 'Fondo · escenario de tu carta', fd: 'Fondo · VS de Discord',
  ff: 'Fondo · tu ficha', fr: 'Fondo · tu fila del ranking' };
const RAREZA_NOMBRE = ['Maqueta', 'Mixtape', 'Vinilo', 'Disco de Oro', 'Micrófono de Oro', 'Disco de Diamante'];
const URL_DROPS = HUB_URL + '/freestyle-rap/?drops=1';
const URL_TIENDA = HUB_URL + '/freestyle-rap/tienda';
const URL_VINCULAR = HUB_URL + '/cuenta/verificar';

const alObjeto = (env, ruta, cuerpo) => env.AVISOS.get(env.AVISOS.idFromName('liga')).fetch('https://avisos/' + ruta, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo || {}),
}).then((r) => r.json()).catch(() => ({ error: 'red' }));

/**
 * «Un momento» ya, y el mensaje (efímero) cuando `trabajo()` termina: un mensaje V2 (`ficha()`).
 *
 * ⚠️ NO ES EL «PENSANDO» (tipo 5) DESDE EL 20/11/2026: el primer mensaje sale YA en V2 —con la franja de su familia y un
 * «⏳ Un momento…»— y la edición reemplaza sus piezas. Es la regla del `/setup` (`cargando()`): así la edición nunca tiene
 * que CAMBIAR el formato de un mensaje, que Discord no deja deshacer. `familia`: la franja que lleva desde el primer momento.
 */
function pensandoYEditar(i, ctx, trabajo, familia = null) {
  luego(ctx, (async () => {
    let data;
    try { data = await trabajo(); } catch (e) { data = V.avisoMsg('No pude: prueba de nuevo en un minuto.'); }
    await editarOriginal(i, V.aV2(data, true));
  })());
  return responderV2(RESPONDE.MENSAJE, V.momentoMsg(familia, true));
}

/** «Ya va» sin mensaje nuevo (tipo 6), y el MISMO mensaje del botón editado cuando `trabajo()` termina (un mensaje V2).
 *  Para lo que pide el objeto desde un botón que tiene que cambiar su propio mensaje (abrir el Drop, el menú de /equipar).
 *  ⚠️ Un mensaje de antes (sin el flag) no se edita: se le contesta con uno nuevo (`pensandoYEditar()`) */
function actualizarLuego(i, ctx, trabajo, familia = null) {
  if (legado(i)) return pensandoYEditar(i, ctx, trabajo, familia);
  luego(ctx, (async () => {
    let data;
    try { data = await trabajo(); } catch (e) { data = V.avisoMsg('No pude: prueba de nuevo en un minuto.'); }
    await editarOriginal(i, V.aV2(data, true));
  })());
  return V.respuesta(6);
}

// ── 🎞️ EL DROP SE ABRE A TOQUES, CON LA ANIMACIÓN DE LA PÁGINA (20/11/2026) ─────────────────────────────────────────
// Dlx: «abrir un drop debería generar como un gif de la animación del drop moviéndose poco a poco y si le das click al
// botón tap, ahí evoluciona, o no, así como el real drop de la página es, y puedes presionar 4 veces… Y al finalizar
// cambia el gif a abrir uno… y ahí consigues la recompensa». Como en la página (`drops_show.js`): el objeto decide TODO
// al abrir (y paga en ese momento: si alguien deja de tocar, lo suyo ya es suyo); los cuatro toques sólo muestran cómo
// sube hasta lo que salió, y «Abrir» lo rompe. Los GIF son la animación de la página grabada
// (`herramientas/gif_drops.py`) y viven en R2: un Worker no dibuja.
// ⚠️ TODO EL ESTADO VA EN EL BOTÓN, como el resto del bot: `dt:<d|s>:<id>:<toques>.<base>.<fin>.<plan>`, donde `plan`
// son cuatro dígitos (si sube o no en cada toque). Un toque contesta al instante (tipo 7) sin preguntarle nada a nadie;
// «Abrir» le vuelve a pedir el drop al objeto, que lo devuelve tal cual porque ya está abierto (`ya`): el premio nunca
// sale del botón.
const DROP_GIF = R2 + '/drops/gif/v1/';
//: el color de cada rareza, el de la página (`RZ` en drops_show.js)
const DROP_COLOR = [0x9AA4B2, 0x29B298, 0x9B5CFF, 0xFF4F93, 0xF5C542];
const DROP_TOQUES = 4;
const slugGif = (t) => String(t || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** La URL del GIF: `<anim>-<estado>-<rareza>` o `<anim>-titulo-<título>` (los nombres los arma `nombres()` del grabador) */
export function gifDrop(anim, estado, r, titulo) {
  return DROP_GIF + anim + (estado === 'titulo' ? '-titulo-' + slugGif(titulo) : '-' + estado + '-' + r) + '.gif';
}
/** En qué toques sube: `subidas` toques distintos de los cuatro, al azar (nunca dos en uno: como mucho son cuatro) */
export function planDrop(subidas, azar) {
  const plan = [0, 0, 0, 0], libres = [0, 1, 2, 3];
  for (let k = 0; k < Math.min(subidas, DROP_TOQUES); k++) plan[libres.splice(Math.floor(azar() * libres.length) % libres.length, 1)[0]] = 1;
  return plan;
}
/** `{anim, id, k, base, fin, plan}` de un `dt:` (`k`: el toque, del 1 al 4, o 5 = «Abrir»), o `null` si no se entiende */
export function leerDt(id) {
  const m = /^dt:([ds]):(\d{1,12}):([1-5])\.([0-4])\.([0-4])\.([01]{4})$/.exec(String(id || ''));
  if (!m) return null;
  const e = { anim: m[1] === 's' ? 'star' : 'drop', id: Number(m[2]), k: Number(m[3]), base: Number(m[4]), fin: Number(m[5]), plan: [...m[6]].map(Number) };
  return e.base > e.fin ? null : e;
}
const dtDe = (e, k) => `dt:${e.anim === 'star' ? 's' : 'd'}:${e.id}:${k}.${e.base}.${e.fin}.${e.plan.join('')}`;
//: la rareza después de `k` toques
const rzTrasToques = (e, k) => Math.min(e.fin, e.base + e.plan.slice(0, k).reduce((a, b) => a + b, 0));
/** Una pantalla del Drop, en V2 (20/11/2026): el GIF arriba —la animación ES la portada, sin franja—, la rareza que se ve,
 *  los toques y el botón, debajo y afuera. El recuadro lleva el color de la rareza, el de la página (`RZ` en drops_show.js) */
export function pantallaDrop(e, k, gif) {
  const r = rzTrasToques(e, k), listo = k >= DROP_TOQUES;
  const pips = Array.from({ length: DROP_TOQUES }, (_, i) => (i < k ? '●' : '○')).join(' ');
  const que = e.anim === 'star' ? 'Star Dragon' : 'Dragón Drop';
  const pista = listo ? '¡Listo! Toca **Abrir** y mira lo que te llevas.'
    : k === 0 ? 'Toca **Tap**: con cada toque puede subir de rareza.' : 'Toca otra vez.';
  const boton = listo
    ? { type: COMP.BOTON, style: 3, label: 'Abrir', emoji: { name: '🐉' }, custom_id: dtDe(e, DROP_TOQUES + 1) }
    : { type: COMP.BOTON, style: ESTILO.PRIMARIO, label: 'Tap', emoji: { name: '👆' }, custom_id: dtDe(e, k + 1) };
  return V.mensaje({ color: DROP_COLOR[r] || DROP_COLOR[0], efimero: true,
    dentro: [V.galeria({ media: { url: gif }, description: que + ' · ' + RAREZA_NOMBRE[r] }),
      V.T('### ' + que + ' · ' + RAREZA_NOMBRE[r] + '\n' + pista + '\n-# ' + pips)],
    filas: [[boton]] });
}
/** Un toque (el `k`-ésimo, del 1 al 4): si sube, el GIF de la subida; si no, se sacude. Con el cuarto, brilla */
export function toqueDrop(e) {
  const k = e.k, antes = rzTrasToques(e, k - 1), ahora = rzTrasToques(e, k);
  const gif = k >= DROP_TOQUES && ahora === antes ? gifDrop(e.anim, 'listo', ahora)
    : ahora > antes ? gifDrop(e.anim, 'sube', ahora) : gifDrop(e.anim, 'nada', ahora);
  return pantallaDrop(e, k, gif);
}

const tipoDeDrop = (o) => (/^star:/.test(String(o || '')) ? 'star' : /^nido:/.test(String(o || '')) ? 'nido' : /^cofre5:/.test(String(o || '')) ? 'cofre' : 'drop');
const plural = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);
//: el arte del Drop que usa la página (los GIF de `herramientas/gif_drops.py`): la llegada del común, en Maqueta
const ARTE_DROP = () => gifDrop('drop', 'entra', 0);

/** 🐉 Lo de `/drops` (Dlx, 20/11/2026, la maqueta): cada tipo en su fila con su botón al costado, un solo azul (el que
 *  más tienes). El Drop y el Star se abren acá y cambian ESTE mensaje; el Nido y los cofres, en la página */
async function panelDrops(env, did, i) {
  const [j, yo] = await Promise.all([alObjeto(env, 'drops', { quien: did }), personaDe(env, did)]);
  if (!j || !j.ok) return V.avisoMsg('No pude ver tus drops: prueba de nuevo en un minuto.');
  const cerr = (j.cerrados || []).map((x) => Object.assign({}, x, { t: x.tipo || tipoDeDrop(x.origen) }));
  const cuenta = (t) => cerr.filter((x) => x.t === t).length;
  const traba = j.miembro === false;
  const meritos = cerr.filter((x) => /merito/.test(String(x.origen || ''))).length;
  const color = colorRango(yo.m, yo.g && yo.g.rg);
  const nom = nombreDe(yo.g, yo.clave);
  if (!cerr.length) {
    return ficha({ fam: 'drops', color, titulo: 'No tienes drops para abrir', acc: V.mini(ARTE_DROP()),
      sub: 'Se ganan con la barra del día en la página, jugando y ganando eventos.',
      filas: [[V.enlace('Abrir la página', URL_DROPS)]] });
  }
  const puede = (t) => cerr.some((x) => x.t === t && !(traba && /merito/.test(String(x.origen || ''))));
  const nD = cuenta('drop'), nS = cuenta('star'), nN = cuenta('nido'), nC = cuenta('cofre');
  // un solo azul: el de lo que más tienes para abrir acá
  const azul = puede('drop') && (nD >= nS || !puede('star')) ? 'drop' : puede('star') ? 'star' : '';
  const linea = (n, uno, que, acc) => (n ? V.seccion(`**${uno}** × ${n}\n-# ${que}`, acc) : null);
  const abrir = (t, n) => (puede(t) ? V.boton(n > 1 ? 'Abrir uno' : 'Abrir', 'dd:' + t + ':x:' + did, azul === t ? 1 : 2) : null);
  return ficha({ fam: 'drops', color, titulo: plural(cerr.length, 'drop', 'drops') + ' para abrir', acc: V.mini(ARTE_DROP()),
    sub: nom ? 'Los Dragón Drops de ' + nom : 'Tus Dragón Drops',
    cuerpo: ['—',
      linea(nD, 'Drop', 'De Maqueta a Micrófono de Oro', abrir('drop', nD)),
      linea(nS, 'Star', 'La escama azul: desde Vinilo', abrir('star', nS)),
      linea(nN, 'Nido', 'Se abre en la página, con su animación', V.enlace('Abrir', URL_DROPS)),
      linea(nC, 'Cofre', 'Se abre en la página, con su animación', V.enlace('Abrir', URL_DROPS)),
      traba && meritos ? '🔒 ' + plural(meritos, 'lo ganaste', 'los ganaste') + ' compitiendo: se abren siendo **Miembro de DRA**. ' +
        'Vincula tu cuenta con **`/vincular`** y quedan listos.' : ''],
    filas: [[V.enlace('Abrir en la página', URL_DROPS)]] });
}

/** 🐉 Abre el primer Drop o Star cerrado de quien tocó y dice qué salió */
async function abrirDropChat(env, did, tipo) {
  const j = await alObjeto(env, 'drops', { quien: did });
  if (!j || !j.ok) return V.avisoMsg('No pude ver tus drops: prueba de nuevo en un minuto.');
  const traba = j.miembro === false;
  const cerr = (j.cerrados || []).filter((x) => (x.tipo || tipoDeDrop(x.origen)) === tipo);
  const x = cerr.find((y) => !(traba && /merito/.test(String(y.origen || ''))));
  if (!x) {
    if (cerr.length && traba) return V.avisoMsg('🔒 Ése lo ganaste compitiendo: se abre siendo **Miembro de DRA**. Vincula tu cuenta con **`/vincular`**.');
    return V.avisoMsg(tipo === 'star' ? 'No te quedan Stars para abrir.' : 'No te quedan Drops para abrir.', [botonLink('Ver mis drops', URL_DROPS)]);
  }
  const r = await alObjeto(env, 'drop-abrir', { quien: did, id: Number(x.id) });
  if (!r || !r.ok) {
    return V.avisoMsg(r && r.error === 'vincula' ? '🔒 Ése se abre siendo **Miembro de DRA**: `/vincular`.' : 'No pude abrirlo: prueba de nuevo en un minuto.');
  }
  // 🎞️ ya está abierto y pagado; lo que sigue es la animación (ver `pantallaDrop()`). Arranca en la rareza mínima del
  // drop (un Star, en Vinilo) y sube en los toques que diga el plan, hasta lo que salió
  const fin = Math.max(0, Math.min(4, Number(r.rareza) || 0));
  const base = Math.min(fin, Math.max(Number(x.min) || 0, tipo === 'star' ? 2 : 0));
  const azar = () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; };
  const e = { anim: tipo === 'star' ? 'star' : 'drop', id: Number(x.id), base, fin, plan: planDrop(fin - base, azar) };
  return pantallaDrop(e, 0, gifDrop(e.anim, 'entra', base));
}

/** 🐉 «Abrir», después de los cuatro toques: el premio (el objeto lo devuelve tal cual: ya está abierto), el GIF de la
 *  apertura y lo que queda por abrir */
async function premioDropChat(env, did, e) {
  const tipo = e.anim === 'star' ? 'star' : 'drop';
  const [r, j] = await Promise.all([alObjeto(env, 'drop-abrir', { quien: did, id: e.id }), alObjeto(env, 'drops', { quien: did })]);
  if (!r || !r.ok) {
    return V.avisoMsg('No pude mostrarlo: prueba de nuevo en un minuto. Lo que te salió ya es tuyo.', [botonLink('Ver mis drops', URL_DROPS)]);
  }
  const cerr = ((j && j.cerrados) || []).filter((y) => (y.tipo || tipoDeDrop(y.origen)) === tipo);
  const fin = Math.max(0, Math.min(4, Number(r.rareza) || 0));
  return textoPremioDrop(r, tipo, cerr.length, did, r.titulo ? gifDrop(e.anim, 'titulo', fin, r.titulo) : gifDrop(e.anim, 'abre', fin));
}

//: 🌟 desde Vinilo un Drop se puede mostrar en el canal (Dlx, 20/11/2026: «6C»)
const DROP_MOSTRAR = 2;
/** Lo que te llevaste, en una frase. */
const premioDe = (r) => (r.titulo ? 'el título **«' + r.titulo + '»**' + (r.puntos ? ' y **+' + milesChat(r.puntos) + '** Puntos de Tienda' : '')
  : '**+' + milesChat(r.puntos) + '** Puntos de Tienda');
/** El botón «Mostrarlo en el canal»: `dm:<d|s>:<rareza>:<puntos>:<título>` (el título, por su lugar en `DROP_TITULOS`) */
const idMostrar = (r, tipo) => {
  const t = r.titulo ? (DROP_TITULOS[r.rareza] || []).indexOf(r.titulo) : -1;
  return ['dm', tipo === 'star' ? 's' : 'd', Number(r.rareza) || 0, Math.max(0, Math.round(Number(r.puntos) || 0)), t >= 0 ? t : '-'].join(':');
};
/** Lo que te salió (efímero): la apertura arriba, lo que te llevas abajo, y los botones afuera (abrir otro, mostrarlo en el
 *  canal si es bueno, la página). `quedan`: los que siguen cerrados; `gif`: la apertura (sin él, sólo el texto) */
export function textoPremioDrop(r, tipo, quedan, did, gif) {
  const nom = r.nombre || RAREZA_NOMBRE[r.rareza] || '';
  const fin = Math.max(0, Math.min(4, Number(r.rareza) || 0));
  const uno = tipo === 'star' ? 'Star' : 'Drop', varios = tipo === 'star' ? 'Stars' : 'Drops';
  const bots = [];
  if (quedan > 0) bots.push({ type: COMP.BOTON, style: ESTILO.PRIMARIO, label: tipo === 'star' ? 'Abrir otro Star' : 'Abrir otro Drop', custom_id: 'dd:' + tipo + ':x:' + did });
  if (fin >= DROP_MOSTRAR) bots.push(V.boton('Mostrarlo en el canal', idMostrar(r, tipo), ESTILO.SECUNDARIO, { emoji: { name: '📣' } }));
  bots.push(botonLink('Ver en la página', URL_DROPS));
  return V.mensaje({ color: DROP_COLOR[fin], efimero: true, filas: [bots],
    dentro: [gif ? V.galeria({ media: { url: gif }, description: uno + ' abierto: ' + nom }) : null,
      V.T('### 🐉 ' + uno + ' abierto: ' + nom + '\nTe llevas ' + premioDe(r) + '.'
        + (r.sin_tope ? '\n-# Esta semana ya pasaste el tope: lo de arriba de 10.000 va a la mitad.' : '')
        + (quedan > 0 ? '\n-# Te ' + (quedan === 1 ? 'queda ' : 'quedan ') + plural(quedan, uno, varios) + '.' : ''))] });
}

/** 📣 «Mostrarlo en el canal»: lo mismo, público y sin que suene nadie (la mención dice quién, no avisa). Todo sale del
 *  botón: no hay nada que leer, así que contesta al toque. `null` si el botón no se entiende */
export function mostrarDrop(cid, did) {
  const m = /^dm:([ds]):([0-4]):(\d{1,9}):(\d|-)$/.exec(String(cid || ''));
  if (!m || !/^\d{5,25}$/.test(String(did || ''))) return null;
  const star = m[1] === 's', rz = Number(m[2]);
  if (rz < DROP_MOSTRAR) return null;
  const titulo = m[4] === '-' ? '' : ((DROP_TITULOS[rz] || [])[Number(m[4])] || '');
  const r = { rareza: rz, puntos: Number(m[3]), titulo };
  const anim = star ? 'star' : 'drop';
  const que = star ? 'un Star Dragon' : 'un Dragón Drop';
  return V.mensaje({ color: DROP_COLOR[rz], efimero: false, menciones: { parse: [] },
    dentro: [V.galeria({ media: { url: titulo ? gifDrop(anim, 'titulo', rz, titulo) : gifDrop(anim, 'abre', rz) }, description: RAREZA_NOMBRE[rz] }),
      V.T('### <@' + did + '> abrió ' + que + ': ' + RAREZA_NOMBRE[rz] + '\nSe lleva ' + premioDe(r) + '.')],
    filas: [[botonLink('Abrir los míos', URL_DROPS)]] });
}

/** 💰 Lo de `/billetera` (la maqueta): el número grande arriba, con tu cara al costado y el color de tu rango */
async function panelBilletera(env, did, i) {
  const [c, yo] = await Promise.all([datosApuesta(env, did), personaDe(env, did)]);
  if (!c) return V.avisoMsg('La billetera todavía no está lista: prueba en un rato.');
  const [j, cara] = await Promise.all([alObjeto(env, 'billetera', { quien: did, inicial: c.inicial, desde: c.desde }), caraDe(env, i, yo.clave)]);
  if (!j || !j.ok) return V.avisoMsg('No pude ver tu billetera: prueba de nuevo en un minuto.');
  const ahora = Date.now();
  const act = (j.mios || []).filter((m) => !m.estado && m.fin > ahora);
  const enJuego = act.reduce((a, m) => a + (Number(m.monto) || 0), 0);
  const nom = nombreDe(yo.g, yo.clave);
  return ficha({ fam: 'tienda', color: colorRango(yo.m, yo.g && yo.g.rg), titulo: milesChat(j.saldo) + ' Puntos de Tienda', cara,
    sub: nom ? 'La billetera de ' + nom : 'Tu billetera',
    cuerpo: ['—', ['Cobrado cazando esta temporada: **' + milesChat(j.cobrado) + '**',
      act.length ? 'En juego: **' + milesChat(enJuego) + '** en ' + plural(act.length, 'cabeza', 'cabezas') + ' (si nadie las caza, vuelven)' : '',
      '-# Se ganan jugando, entrando cada día, con el Pase, cazando y con los Dragón Drops.'].filter(Boolean).join('\n')],
    filas: [[botonLink('Ir a la Tienda', URL_TIENDA), V.boton('Mis drops', 'dd:mis:x:' + did, ESTILO.SECUNDARIO)]] });
}

/** 🎒 `/tienda` del objeto para quien tocó (su clave, si está verificado, y la billetera) */
async function tiendaDe(env, did) {
  const c = await datosApuesta(env, did);
  let de = '';
  try { de = (await env.KV.get('d:' + did)) || ''; } catch (e) { de = ''; }
  return alObjeto(env, 'tienda', Object.assign({ quien: did, de }, c ? { inicial: c.inicial, desde: c.desde } : {}));
}

//: cuántos lugares entran como fila con su botón (cada uno son tres piezas: con todo el resto, 9 entran en las 40)
const INV_FILAS = 9;
/** 🎒 Lo de `/inventario` (la maqueta): cada lugar en su fila, con lo puesto y un botón al costado que abre lo de
 *  `/equipar` para ese lugar en ESTE mensaje */
async function panelInventario(env, did, i) {
  const [S, yo] = await Promise.all([tiendaDe(env, did), personaDe(env, did)]);
  if (!S || !S.ok || !S.yo) return V.avisoMsg(S && S.ok && !S.abierta ? 'La Tienda todavía no abrió.' : 'No pude ver tu inventario: prueba de nuevo en un minuto.');
  const P = (S.cat && S.cat.piezas) || {};
  const inv = (S.yo.inv || []).filter((x) => P[x.p]);
  const puesto = S.yo.puesto || {};
  const color = colorRango(yo.m, yo.g && yo.g.rg);
  const cara = await caraDe(env, i, yo.clave);
  if (!inv.length) {
    return ficha({ fam: 'tienda', color, cara, titulo: 'Todavía no tienes nada de la Tienda',
      sub: 'Tienes **' + milesChat(S.yo.saldo) + '** Puntos de Tienda para estrenar.', filas: [[botonLink('Ir a la Tienda', URL_TIENDA)]] });
  }
  const por = {};
  for (const x of inv) { const r = P[x.p].c; por[r] = (por[r] || 0) + 1; }
  const lugares = Object.keys(RANURA_NOMBRE).filter((r) => por[r]).concat(Object.keys(por).filter((r) => !RANURA_NOMBRE[r]));
  const filas = lugares.slice(0, INV_FILAS).map((r) => {
    const p = puesto[r] && P[puesto[r]];
    const txt = '**' + (RANURA_NOMBRE[r] || r) + '** · ' + por[r] + '\n-# ' + (p ? 'Puesto: **' + p.n + '**' : 'Sin poner');
    return RANURA_NOMBRE[r] ? V.seccion(txt, V.boton(p ? 'Cambiar' : 'Ponerme uno', 'eq:' + r + ':ver:' + did, ESTILO.SECUNDARIO)) : V.T(txt);
  });
  const resto = lugares.slice(INV_FILAS);
  return ficha({ fam: 'tienda', color, cara, titulo: 'Tu inventario',
    sub: plural(inv.length, 'pieza', 'piezas') + ' de la Tienda · te quedan **' + milesChat(S.yo.saldo) + '** Puntos',
    cuerpo: ['—'].concat(filas, resto.length ? ['-# Y también: ' + resto.map((r) => (RANURA_NOMBRE[r] || r) + ' ' + por[r]).join(' · ') + '.'] : []),
    filas: [[botonLink('Tu Inventario', URL_INVENTARIO), botonLink('La Tienda', URL_TIENDA)]] });
}

/** 🎽 Lo de `/equipar que:<ranura>` (la maqueta): el lugar, lo puesto y el menú debajo. Elegir cambia ESTE mensaje (y lo
 *  dice en `nota`) */
async function panelEquipar(env, did, ranura, i, nota) {
  const [S, yo] = await Promise.all([tiendaDe(env, did), personaDe(env, did)]);
  if (!S || !S.ok || !S.yo) return V.avisoMsg('No pude ver lo tuyo: prueba de nuevo en un minuto.');
  const P = (S.cat && S.cat.piezas) || {};
  const mias = (S.yo.inv || []).filter((x) => P[x.p] && P[x.p].c === ranura);
  const ahora = (S.yo.puesto || {})[ranura] || '';
  const nombre = RANURA_NOMBRE[ranura] || ranura;
  const color = colorRango(yo.m, yo.g && yo.g.rg);
  const cara = await caraDe(env, i, yo.clave);
  if (!mias.length) {
    return ficha({ fam: 'tienda', color, cara, titulo: nombre, sub: 'Todavía no tienes nada de **' + nombre + '**.',
      cuerpo: [nota || ''], filas: [[botonLink('Ver en la Tienda', URL_TIENDA)]] });
  }
  const opciones = mias.slice(0, 24).map((x) => ({ label: String(P[x.p].n).slice(0, 100), value: x.p, default: x.p === ahora }));
  if (ahora) opciones.push({ label: 'Quitar lo que tengo puesto', value: '-' });
  return ficha({ fam: 'tienda', color, cara, titulo: nombre,
    sub: ahora && P[ahora] ? 'Puesto ahora: **' + P[ahora].n + '**' : 'No tienes nada puesto acá.',
    cuerpo: [nota || ''],
    filas: [{ type: COMP.FILA, components: [{ type: COMP.SELECT, custom_id: 'eq:' + ranura + ':x:' + did, placeholder: 'Elige qué ponerte', options: opciones }] }] });
}

/** 🎽 Ponerse (o sacarse) lo elegido en el menú de `/equipar`: `{ok, texto}` */
async function ponerChat(env, did, ranura, pieza) {
  const c = await datosApuesta(env, did);
  let de = '';
  try { de = (await env.KV.get('d:' + did)) || ''; } catch (e) { de = ''; }
  const j = await alObjeto(env, 'tienda-accion', Object.assign({ accion: 'poner', ranura, pieza: pieza === '-' ? '' : pieza, quien: did, de },
    c ? { inicial: c.inicial, desde: c.desde } : {}));
  if (!j || !j.ok) {
    const por = { verificate: 'Primero verifícate: **`/vincular`**.', no_la_tienes: 'Ésa no es tuya.', ranura: 'Eso no va ahí.' };
    return { ok: false, texto: por[j && j.error] || 'No pude ponértelo: prueba de nuevo en un minuto.' };
  }
  return { ok: true, texto: pieza === '-' ? '✅ Listo: te lo quité.' : '✅ **Listo, te lo pusiste.** Se ve en la página en unos minutos' + (ranura === 'carta' ? ', y en `/card` cuando se rehaga tu carta.' : '.') };
}

// ── Los botones se apagan solos ───────────────────────────────────────────
// Dlx, 17/09/2026: «después de cierta inactividad, que todos se desactiven o
// que ya no funcionen para la persona que escribió el comando».
//
// ⚠️ SIN GUARDAR NADA, Y NO POR ELEGANCIA: un botón que no caduca es
// justamente lo que `CLAUDE.bot.md` celebraba —«el token de la interacción
// muere a los 15 min, pero cada click trae uno nuevo»—. Para caducarlo hace
// falta saber CUÁNDO fue la última vez, y eso es estado... salvo que ya venga
// en el payload.
//
// **Viene.** El mensaje llega entero en cada click, con `edited_timestamp` —y
// cada click nuestro es una edición, porque respondemos con ACTUALIZAR—. O
// sea que Discord lleva la cuenta de la actividad por nosotros.
//
//   editado    la última vez que alguien tocó un botón (tipo 7 = edición)
//   creado     si nunca se tocó: `timestamp`, o el snowflake del id
//
// ⚠️ Y MIDE INACTIVIDAD, NO EDAD. Cada click que prospera reinicia el reloj;
// el aviso de «esa carta la pidió otra persona» NO, porque contesta efímero y
// no edita. Que un ajeno no pueda mantenerte la carta viva es correcto.
const VENCE = 10 * 60 * 1000;

const SNOWFLAKE_CERO = 1420070400000;        // 2015-01-01, la época de Discord

function ultimoToque(i) {
  const m = (i && i.message) || {};
  if (m.edited_timestamp) return Date.parse(m.edited_timestamp);
  if (m.timestamp) return Date.parse(m.timestamp);
  if (m.id) {
    // los 42 bits altos del id son milisegundos desde la época de Discord
    try { return Number(BigInt(m.id) >> 22n) + SNOWFLAKE_CERO; } catch { /* id raro */ }
  }
  return NaN;
}

// ⚠️ NaN NO VENCE. Si el payload no trajera ninguna de las tres cosas, la
// comparación daría false y la carta sigue andando. Es la decisión correcta:
// no poder medir la inactividad no es lo mismo que estar inactiva, y apagar
// botones por no saber sería romper lo que funciona.
const vencida = (i, ahora) => {
  const t = ultimoToque(i);
  return !isNaN(t) && (ahora - t) > VENCE;
};

// ⚠️ QUÉ CARTA SE ESTÁ VIENDO, leída del propio mensaje. El `custom_id` del
// botón clickeado dice a dónde querés ir, no dónde estás. Y para apagar hay
// que redibujar LA MISMA, no otra. Se saca del único botón deshabilitado, que
// es el que hace de etiqueta — o sea de un dato que escribimos nosotros, no
// de algo que Discord pueda cambiar de forma.
function cartaEnPantalla(i) {
  for (const fila of (i.message && i.message.components) || []) {
    for (const c of fila.components || []) {
      if (c.type === COMP.BOTON && c.disabled && typeof c.custom_id === 'string') {
        const p = c.custom_id.split(':');
        if (p[0] === 'c' && p[2]) return p[2];
      }
    }
  }
  return null;
}

function svEnPantalla(i) {
  for (const fila of (i.message && i.message.components) || []) {
    for (const c of fila.components || []) {
      if (c.type === COMP.SELECT) {
        const d = (c.options || []).find(o => o.default);
        if (d) return d.value;
      }
    }
  }
  return null;
}

// ── El freno al spam ──────────────────────────────────────────────────────
// ⚠️ ESTE ES EL ÚNICO ESTADO DE MÓDULO DEL ARCHIVO, Y ES A PROPÓSITO.
// La regla de arriba prohíbe guardar en el módulo datos DE UNA PETICIÓN,
// porque otra los pisa y terminás leyendo la carta de otro. Acá no se guarda
// nada de nadie: sólo «este ID hizo N cosas en los últimos T ms». Si dos
// peticiones lo tocan a la vez, el peor caso es contar una de más o una de
// menos, y no hay dato ajeno que se pueda filtrar.
//
// ⚠️ ES APROXIMADO A PROPÓSITO. Cloudflare corre muchos isolates y cada uno
// lleva su propia cuenta, así que alguien repartido entre varios pasaría más
// veces. No importa para lo que hay que frenar: las interacciones salen de
// los datacenters de Discord, o sea que la ráfaga de una misma persona cae en
// el mismo puñado de colos.
//
// ⚠️ LA ALTERNATIVA ERA KV Y NO SERVÍA: son 1.000 ESCRITURAS POR DÍA. Un
// freno que escribe en cada click se come el presupuesto del pipeline —que es
// el que de verdad necesita escribir— antes del mediodía.
const VISTOS = new Map();
const TOPE_MAPA = 5000;

// (cuántas, en cuántos ms)
// ⚠️ LOS DOS NÚMEROS SON DISTINTOS PORQUE EL DAÑO ES DISTINTO. `/card` crea
// un mensaje PÚBLICO cada vez: diez comandos son diez cartas en el canal, y
// eso es lo que ensucia. Un botón contesta con ACTUALIZAR, o sea que pisa el
// mismo mensaje: aunque lo aprietes cien veces el canal no crece, y lo único
// que cuesta son peticiones. Por eso el click tiene la mano más suelta.
// ⏱️ cuánto espera el botón de elegir (`ve`) el saldo antes de abrir el modal sin él: Discord corta a los 3 s
const ESPERA_MODAL = 1500;

const FRENO = { comando: [4, 30000], click: [10, 10000],
  // 🔴 MI CUENTA ESCRIBE KV, y KV son 1.000 escrituras por día para toda la
  // cuenta: sin freno, alguien con su permiso de Discord podía agotarlas
  // guardando y quitando redes en un bucle, y el ciclo se quedaba sin poder
  // escribir el lobby (revisión del 25/09/2026). Seis por minuto por persona.
  cuenta: [6, 60000],
  // 🔴 Y LO QUE TAMBIÉN ESCRIBE KV (revisión del 04/10/2026): el panel de ajustes guardaba en cada click, y anotar a
  // un tercero desde `/card quien:` o `/versus` era una escritura por persona nombrada. Por persona y por isolate
  ajuste: [5, 60000], otro: [3, 3600000],
  // 🤝 unirte a los Tier 1 (13/11/2026): un pedido son hasta 9 llamadas a Discord con el bot; tres intentos cada diez minutos
  unirse: [3, 600000] };

function frenado(id, tipo) {
  if (!id) return 0;
  const [cuantas, ventana] = FRENO[tipo];
  const ahora = Date.now();
  const clave = tipo + ':' + id;
  const previos = (VISTOS.get(clave) || []).filter(t => ahora - t < ventana);
  if (previos.length >= cuantas) {
    // 🛡️ queda en los registros del Worker (`observability` en bot/desplegar.py): sin esto el abuso no dejaba rastro
    console.warn('[seguridad] freno: ' + tipo);
    return Math.max(1, Math.ceil((ventana - (ahora - previos[0])) / 1000));
  }
  previos.push(ahora);
  // ⚠️ El Map se poda: un isolate vive horas y el bot es público, así que sin
  // esto la memoria crece con cada persona que lo use y nunca baja.
  if (VISTOS.size > TOPE_MAPA) VISTOS.delete(VISTOS.keys().next().value);
  VISTOS.set(clave, previos);
  return 0;
}

// ── La firma ──────────────────────────────────────────────────────────────
// ⚠️ SE VERIFICA SOBRE EL BODY CRUDO. Es el error clásico y falla en silencio:
// si se hace JSON.parse y después JSON.stringify, el texto cambia —espacios,
// orden, escapes— la firma no valida, y Discord sólo dice «no se pudo
// verificar la URL» sin decir por qué.
function deHex(s) {
  const b = new Uint8Array(s.length / 2);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(s.substr(i * 2, 2), 16);
  return b;
}

async function importarClave(hex) {
  const bytes = deHex(hex);
  try {
    return await crypto.subtle.importKey('raw', bytes, 'Ed25519', false, ['verify']);
  } catch {
    return await crypto.subtle.importKey(
      'raw', bytes, { name: 'NODE-ED25519', namedCurve: 'NODE-ED25519' },
      false, ['verify']);
  }
}

async function firmaValida(req, crudo, clavePublica) {
  const sig = req.headers.get('x-signature-ed25519');
  const ts = req.headers.get('x-signature-timestamp');
  if (!sig || !ts || !clavePublica) return false;
  try {
    const clave = await importarClave(clavePublica);
    return await crypto.subtle.verify(
      clave.algorithm.name, clave, deHex(sig),
      new TextEncoder().encode(ts + crudo));
  } catch {
    return false;
  }
}

// 🤖 AGREGARON EL BOT A UN SERVIDOR (19/11/2026). Dlx: «directo, el bot me escribe x DM que lo agregaron a X servidor».
// Discord lo avisa con un Webhook Event (`APPLICATION_AUTHORIZED`) en esta ruta, `POST /eventos-discord`. Se configura
// UNA vez en el portal de desarrolladores (la app → Webhooks → Events: la URL `<worker>/eventos-discord`, prendido y con
// el evento «Application Authorized»). Viene firmado igual que las interacciones, con la misma clave pública.
// ⚠️ OTRA RUTA Y NO `POST /`: en las interacciones el tipo 1 es el PING, y acá el PING es el 0 y el 1 es un evento.
// ⚠️ SE CONTESTA 204 YA, SIEMPRE: si Discord no recibe un 2xx en 3 segundos reintenta, y si falla seguido apaga los
// eventos. El DM va detrás (`SU.llego()`, que también deduplica). Lo que no es un servidor —instalar la app en una
// cuenta (`integration_type` 1)— no avisa nada.
async function eventosDiscord(req, env, ctx) {
  const crudo = await req.text();
  if (!await firmaValida(req, crudo, env.DISCORD_PUBLIC_KEY)) return new Response('firma invalida', { status: 401 });
  let b = null;
  try { b = JSON.parse(crudo); } catch (e) { b = null; }
  const ev = b && b.type === 1 ? b.event || {} : {};
  const d = ev.data || {};
  if (ev.type === 'APPLICATION_AUTHORIZED' && d.integration_type === 0 && d.guild && d.guild.id) {
    ctx.waitUntil(SU.llego(env, d, ayudaSU()).catch((e) => console.error('[eventos] el DM del servidor nuevo:', e)));
  }
  return new Response(null, { status: 204 });
}

// ── Los comandos ──────────────────────────────────────────────────────────
// ── El «#N» del apodo: prendido o apagado, POR SERVIDOR ───────────────────
// Dlx, 19/09/2026: «una funcion local o sea por servidor que te deje activar y
// desactivar tu posicion o sea el # X».
//
// ⚠️ ES POR SERVIDOR A PROPÓSITO, y por eso la clave lleva el guild: se puede
// llevar el puesto en DRA y no en FFA. Una preferencia global sería otra cosa
// y no es lo que se pidió.
// (la clave `pnick:` y su lector viven más arriba, junto a los ajustes: el
// «#N» efectivo se decide cruzando la elección de la persona con la del
// servidor, así que las dos cosas tienen que leerse juntas)
const MARCA_PUESTO = /^\s*#\s*\d+\s*\|\s*/;
const sinPuesto = (nick) => String(nick || '').replace(MARCA_PUESTO, '').trim();

// ⚠️ CAMBIAR UN APODO PIDE EL TOKEN, Y EL WORKER LO TIENE desde el 19/09/2026,
// como `secret_text`. Dlx: «no es a propósito, yo te los di para que lo
// guardes hasta que terminemos todo esto y ahí sí lo reiniciamos el token».
//
// ⚠️ PERO LA PREFERENCIA SE GUARDA EN KV IGUAL, y eso no es redundancia: el
// apodo es lo que se ve hoy, KV es lo que hace que siga así. Sin la clave
// `poff:`, la próxima corrida de `sincronizar_puesto.py` le devolvería el
// «#N» a quien pidió que se lo saquen.
//
// ⚠️ Y EL TOKEN ES OPCIONAL A PROPÓSITO. Si el binding no está —el día que se
// rote y todavía no esté cargado— el comando no se rompe: anota la preferencia
// y avisa que se aplica en la próxima corrida. Mismo reparto que `anotar()`
// con la cola `reg:`.
async function cambiarApodo(env, gid, uid, nick) {
  if (!env.DISCORD_TOKEN) return 'sin-token';
  try {
    const r = await fetch(`https://discord.com/api/v10/guilds/${gid}/members/${uid}`, {
      method: 'PATCH',
      headers: {
        'Authorization': 'Bot ' + env.DISCORD_TOKEN,
        'Content-Type': 'application/json',
        'X-Audit-Log-Reason': 'Liga Global: /apodo',
      },
      // `null` borra el apodo y deja el nombre de la cuenta. Cadena vacía no
      // sirve: Discord la rechaza.
      body: JSON.stringify({ nick: nick || null }),
    });
    return r.ok ? 'ok' : 'error ' + r.status;
  } catch (e) {
    return 'error';
  }
}

// ── /verificar ────────────────────────────────────────────────────────────
// 🔑 QUÉ TE FALTA PARA TENER TARJETA, MIRADO EN VIVO. Dlx, 25/09/2026, a
// «¿armo /verificar?»: «correcto». Mira en Discord Rap Español lo mismo que
// el portón del ciclo —estar adentro, el rol de Miembro y un país— y dice
// cuál falta, con palabras y con el botón que lo arregla.
//
// ⚠️ NO DA EL ROL, Y ES A PROPÓSITO. Lo da `bot/autoverificar.py` en cada
// vuelta, con sus topes y con la lista de a quién no (trolls, `no_verificar`,
// olvidados). Si también lo diera el Worker, las reglas de identidad vivirían
// en dos lugares —la deriva que este repo persigue— y la tarjeta igual
// saldría recién en la vuelta siguiente, que es cuando el ciclo carga a la
// persona en KV. Lo que sí hace es ANOTARLA, así esa vuelta la encuentra.
//
// ⚠️ EL PORTÓN LLEGA POR KV (`meta.porton`), NO ESTÁ ESCRITO ACÁ: el
// servidor, el rol, los roles de país y a quién revisa un admin los publica
// `bot/subir_datos.py` en cada corrida, desde donde viven.

// El minuto en que arranca la próxima vuelta del ciclo: `:22` y `:52`, menos
// lo que `tocaCiclo()` frena de madrugada.
export function proximaVuelta(ahora) {
  const t = Math.floor(ahora / 60000) * 60000;
  for (let k = 1; k <= 24 * 60; k++) {
    const x = new Date(t + k * 60000);
    // en UTC: el este corre en horas enteras, así que el minuto es el mismo
    const m = x.getUTCMinutes();
    if ((m === 22 || m === 52) && tocaCiclo(x)) return x;
  }
  return null;
}

// «Juan 🇦🇷🔥» -> ['ar']: las banderas escritas en un nombre, sin repetir
export function banderasEn(txt) {
  const out = [];
  let par = '';
  for (const ch of String(txt || '')) {
    const c = ch.codePointAt(0);
    if (c >= 0x1F1E6 && c <= 0x1F1FF) {
      par += String.fromCharCode(c - 0x1F1E6 + 97);
      if (par.length === 2) {
        if (out.indexOf(par) < 0) out.push(par);
        par = '';
      }
    } else {
      par = '';
    }
  }
  return out;
}

// 'ar' -> 🇦🇷
const emojiBandera = (cc) => String.fromCodePoint(
  0x1F1E6 + cc.charCodeAt(0) - 97, 0x1F1E6 + cc.charCodeAt(1) - 97);

// Qué tiene un miembro de DRA (`null` = no está). Sin red: se prueba solo.
//
// ⚠️ EL PAÍS SE LEE EN EL ORDEN DE `sheet/pais_por_rol.decidir()`: Estados
// Unidos si aparece, después los roles de país de DRA, después las banderas
// del apodo. Lo que ese módulo mira además —los roles de FFA y Snake Rap, el
// país fijado a mano— no llega acá: por eso, sin país, el texto dice «no lo
// encuentro en DRA» y no «no tenés».
export function diagnostico(miembro, porton) {
  if (!miembro) return { enDra: false, rol: false, paises: [] };
  const roles = miembro.roles || [];
  const tabla = (porton && porton.paises) || {};
  const porRol = [];
  roles.forEach((r) => {
    if (tabla[r] && porRol.indexOf(tabla[r]) < 0) porRol.push(tabla[r]);
  });
  const u = miembro.user || {};
  const porNombre = banderasEn([miembro.nick, u.global_name, u.username].join(' '));
  let paises = porRol.length ? porRol : porNombre;
  if (porRol.indexOf('us') >= 0 || porNombre.indexOf('us') >= 0) paises = ['us'];
  return { enDra: true, rol: roles.indexOf(porton && porton.rol) >= 0, paises };
}

// El miembro de DRA, con el token del bot. `estado` 404 = no está adentro.
async function miembroDra(env, guild, uid) {
  try {
    const r = await fetch(`https://discord.com/api/v10/guilds/${guild}/members/${uid}`, {
      headers: { 'Authorization': 'Bot ' + env.DISCORD_TOKEN },
    });
    if (!r.ok) return { estado: r.status, miembro: null };
    return { estado: 200, miembro: await r.json() };
  } catch (e) {
    return { estado: -1, miembro: null };
  }
}

// ✅ EL MIEMBRO DE DRA AL MOMENTO (Dlx, 12/10/2026, a «/verificar con todo completo»: «A y B»). Hasta acá lo daba sólo el
// ciclo (`bot/autoverificar.py`), y quien tenía todo de su lado leía «en menos de una hora» sin nada que hacer. Ahora,
// con lo mismo que pide el ciclo —estar en DRA, un solo país y no estar en la lista de revisión (`porton.revisa`, la
// de `autoverificar._saltear()`)—, lo da el Worker en el momento, desde /verificar y desde la página. Le saca el
// Invitado, como el ciclo. La tarjeta igual sale con la vuelta siguiente: se dibuja ahí.
// ⚠️ Sólo si el portón dice qué rol es (`porton.rol`, un ID): sin eso no se le da nada a nadie.
async function darMiembro(env, P, uid, razon) {
  if (!P || !/^\d{5,25}$/.test(String(P.rol || '')) || !/^\d{5,25}$/.test(String(P.guild || ''))) return false;
  const h = { 'Authorization': 'Bot ' + env.DISCORD_TOKEN, 'X-Audit-Log-Reason': encodeURIComponent(razon) };
  const base = `${DC_API}/guilds/${P.guild}/members/${uid}/roles/`;
  try {
    const r = await fetch(base + P.rol, { method: 'PUT', headers: h });
    if (r.status !== 204) return false;
    if (/^\d{5,25}$/.test(String(P.invitado || ''))) {
      try { await fetch(base + P.invitado, { method: 'DELETE', headers: h }); } catch (e) { /* queda el Invitado */ }
    }
    return true;
  } catch (e) {
    return false;
  }
}

// ── «Mi cuenta» con Discord ───────────────────────────────────────────────
// 🔑 Dlx, 25/09/2026: «creo que sería mejor meter el login de Discord». SIN
// SECRETO DE CLIENTE: la app de la Liga no tiene uno guardado y generarlo es
// crear un token nuevo, que quedó para el final. Discord le da al navegador
// un permiso que sólo lee la identidad (`identify`, flujo implícito) y acá
// se le pregunta a Discord de quién es: el navegador no puede inventar el ID.
//
// ⚠️ NO SE GUARDA NADA: el permiso se usa una vez y se tira. Lo que la página
// recuerda —quién sos— vive en su `localStorage` y no autoriza nada acá.
async function cuentaDiscord(req, env) {
  const h = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  let d = null;
  try { d = await req.json(); } catch (e) { d = null; }
  const t = String((d && d.token) || '');
  if (!/^[A-Za-z0-9._-]{10,300}$/.test(t)) {
    return new Response('{"error":"token"}', { status: 400, headers: h });
  }
  // 🔴 CON `discordDe()`: un Discord que no contesta (429, 5xx) no es un
  // permiso malo, y esto antes decía «discord» igual. Ver `discordDe()`.
  const q = await discordDe(t);
  if (q.error === 'ocupado') return new Response('{"error":"discord_ocupado"}', { status: 503, headers: h });
  const u = q.u;
  if (!u || !u.id) return new Response('{"error":"discord"}', { status: 401, headers: h });
  // 🔑 Y LA SESIÓN: entrar una vez alcanza para votar, poner precios y ver la
  // billetera `SESION_DIAS` días, sin volver a Discord (Dlx, 28/09/2026: «me
  // sigue preguntando y redirigiéndome»). Ver `sesionNueva()` en avisos.js.
  const ses = await sesionNueva(env, u.id);
  if (ses && ses.ses) h['set-cookie'] = cookieSesion(ses.ses, SESION_DIAS * 86400);
  // ⚠️ EL RAPERO SALE DE `d:<id>`, que existe sólo para quien pasa el portón.
  // Quien no está, entra igual y la página le dice qué le falta.
  //
  // 🔑 Y NO LEE `dn:` A PROPÓSITO (las LIBRES, 29/09/2026): `/card` sí, porque
  // la Temporada y la Servidor son de todos los de la Lista, pero la cuenta
  // —foto, redes, seguir, avisos— sigue siendo de los verificados.
  //
  // 🔴 Y CON SUS CARTAS, NO SÓLO EL NOMBRE. La página buscaba al rapero en el
  // ranking de la temporada, y quien tiene carta pero todavía no jugó la T1
  // no está ahí: Dlx, 25/09/2026, con su carta de Servidor, leyó «todavía no
  // tenés tarjeta en la Liga». Es lo mismo que `/card` ya le muestra a
  // cualquiera, así que no se expone nada nuevo.
  let rapero = '';
  let yo = {};
  try {
    const clave = await env.KV.get('d:' + u.id);
    if (clave) {
      const p = JSON.parse((await leerP(env, clave)) || '{}');
      rapero = p.n || '';
      yo = { clave, cs: p.cs || [], bl: p.bl || [], ev: p.ev || 0, sv: p.sv || '', cc: p.cc || '',
        // en qué servidores está: «tus próximos eventos» de Mi cuenta son los de ahí
        svs: p.svs || [] };
    }
  } catch (e) { rapero = ''; yo = {}; }
  // 👀 y quien NO está verificado, a quién mira como propio (ver `cuentaMira()`): sólo para marcarle su lugar
  const mira = rapero ? '' : await miraDe(env, u.id);
  return new Response(JSON.stringify(Object.assign({ id: u.id, n: u.global_name || u.username || '',
    av: u.avatar ? u.id + '/' + u.avatar : '', rapero }, rapero ? yo : {}, mira ? { mira } : {})), { headers: h });
}

// ── 👀 A QUIÉN MIRA COMO PROPIO QUIEN NO ESTÁ VERIFICADO (Dlx, 13/11/2026: «que en el ranking uno muestre la posición
// arriba de cada uno, sin o al estar verificado»). La clave de su `dn:` (o `dx:`, su cuenta extra), que hasta hoy leía
// sólo `/card`, y SÓLO para que el Ranking le marque su lugar: la página la guarda aparte (`lg:mira`) y no en `lg:yo`,
// así no abre nada de la cuenta —foto, redes, seguir, avisos—, que sigue siendo de los verificados (`d:`). Para quien
// ya había entrado antes de esto, `/cuenta/mira` la da con la sesión, sin volver a Discord.
async function miraDe(env, id) {
  if (!id || await env.KV.get('d:' + id)) return '';
  return (await env.KV.get('dn:' + id)) || (await env.KV.get('dx:' + id)) || '';
}
async function cuentaMira(req, env) {
  const h = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  const id = await sesionDe(env, req);
  // 🔑 sin sesión (venció a los 30 días) es 401, no «sin perfil»: la página lo guardaba un día y le decía «no encontramos
  // tu perfil» a alguien que sí tiene `dn:` (13/11/2026)
  if (!id) return new Response(JSON.stringify({ error: 'sesion' }), { status: 401, headers: h });
  return new Response(JSON.stringify({ mira: await miraDe(env, id) }), { headers: h });
}

// ── 🤝 UNIRTE A LOS SERVIDORES TIER 1 CON UN TOQUE (Dlx, 13/11/2026: «Yes, the safe way»). Lo mismo que hace «Verificarme»
// con DRA (`cuentaVerificar()`): el bot te suma con el permiso `guilds.join` que diste recién, y el permiso se tira. Hecho
// como pide la Developer Policy de Discord (8/7/2024): «adding the account to a server» pide informar claramente y un
// permiso explícito (regla 1), y no se puede inflar la cantidad de miembros (regla 13). Por eso:
// - el permiso se pide APARTE, sólo al tocar el botón (`urlLogin('u')`, con `prompt=consent`): entrar sigue pidiendo `identify`;
// - TÚ ELIGES los servidores en la página antes de ir a Discord, y sólo esos viajan acá;
// - NO HAY PREMIO por unirse (ni Puntos de Tienda ni XP): sería pagar por miembros;
// - sólo los socios de la Liga (`SERVIDORES`, sin los `fuera`) y nunca los que pidieron no recibir gente así (`UNIRSE_NO`).
// El bot necesita «Crear invitación» en cada servidor: sin eso Discord contesta 50013 y la página ofrece su invitación
const UNIRSE_NO = new Set([]);
const RAZON_UNIRSE = encodeURIComponent('Se unió desde underlegends.pages.dev, con su permiso');
export async function cuentaUnirse(req, env) {
  const h = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  const json = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: h });
  let d = null;
  try { d = await req.json(); } catch (e) { d = null; }
  const t = String((d && d.token) || '');
  if (!/^[A-Za-z0-9._-]{10,300}$/.test(t)) return json({ error: 'token' }, 400);
  const pide = [...new Set((Array.isArray(d && d.svs) ? d.svs : []).map((x) => String(x || '').toUpperCase()))]
    .filter((x) => /^[A-Z0-9]{2,6}$/.test(x)).slice(0, 15);
  if (!pide.length) return json({ error: 'nada' }, 400);
  if (!env.DISCORD_TOKEN) return json({ error: 'bot' }, 503);
  const q = await discordDe(t);
  if (q.error === 'ocupado') return json({ error: 'discord_ocupado' }, 503);
  const u = q.u;
  if (!u || !u.id) return json({ error: 'discord' }, 401);
  const esperar = frenado(u.id, 'unirse');
  if (esperar) return json({ error: 'espera', s: esperar }, 429);
  // 🔑 el permiso tiene que traer `guilds.join`: sin él fallarían todos, así que se dice antes de probar ninguno (13/11/2026)
  if (Array.isArray(q.scopes) && !q.scopes.includes('guilds.join')) {
    return json({ ok: true, res: Object.fromEntries(pide.map((sv) => [sv, 'permiso'])) });
  }
  // 🏅 SÓLO LOS TIER 1 (13/11/2026): los mismos que la página ofrece, `svs[].cu.c` del lobby que deja el ciclo (Socios
  // 4.98). El permiso se pidió para ésos: un pedido armado a mano con un Tier 3 no lo usa para otro. Una lectura y un
  // parseo por pedido (233 KB: ~2 ms medido, 3 el peor) —se piden 3 cada 10 min, y sólo después de la pantalla de
  // Discord—, y sin lobby no se suma a nadie
  // 🥈 POR SU TIER Y NO POR `cu.c` (19/11/2026): desde ese día el Tier 2 también cuenta para el Competitivo, y lo único que
  // no tiene es justamente esto (Dlx: «No tendrían ese de que el bot les agregue a todos los servidores… tier 1 únicamente»)
  const lobby = await env.KV.get('web:lobby', 'json').catch(() => null);
  const t1 = new Set(((lobby && Array.isArray(lobby.svs)) ? lobby.svs : []).filter((s) => s && s.tier === 1).map((s) => String(s.sv)));
  const bot = { 'Authorization': 'Bot ' + env.DISCORD_TOKEN, 'X-Audit-Log-Reason': RAZON_UNIRSE, 'content-type': 'application/json' };
  const res = {};
  for (const sv of pide) {
    const S = SERVIDORES.find((x) => x.sv === sv && x.guild && !x.fuera);
    if (!t1.size) { res[sv] = 'error'; continue; }
    if (!S || UNIRSE_NO.has(sv) || !t1.has(sv)) { res[sv] = 'no'; continue; }
    let r = null;
    try {
      r = await fetch(`${DC_API}/guilds/${S.guild}/members/${u.id}`, { method: 'PUT', headers: bot, body: JSON.stringify({ access_token: t }) });
    } catch (e) { r = null; }
    if (!r) { res[sv] = 'error'; continue; }
    // 201: entró · 204: ya estaba
    if (r.status === 201 || r.status === 204) { res[sv] = r.status === 201 ? 'ok' : 'ya'; continue; }
    let c = 0;
    try { c = Number((await r.json()).code) || 0; } catch (e) { c = 0; }
    // 30001: tu cuenta está en el máximo de servidores · 40007: ese servidor no te deja entrar (te echaron) · 50013: al bot le
    // falta «Crear invitación» ahí · 401: el permiso se venció · 403 (p. ej. 50001, el bot no está ahí): ESE servidor, y
    // se sigue con los demás —el permiso ya se miró arriba, así que un 403 no es del permiso (13/11/2026) · 429: esperar
    res[sv] = c === 30001 ? 'lleno' : c === 40007 ? 'no_deja' : c === 50013 ? 'sin_permiso' : r.status === 429 ? 'espera'
      : r.status === 401 ? 'permiso' : r.status === 403 ? 'sin_permiso' : 'error';
    // con la cuenta llena o sin el permiso, los que siguen fallarían igual
    if (res[sv] === 'lleno' || res[sv] === 'permiso') {
      for (const x of pide) if (!res[x]) res[x] = res[sv];
      break;
    }
  }
  // 👋 LA BIENVENIDA (20/11/2026, el plan de los tiers): en cada servidor donde ENTRÓ recién (201), si su dueño la prendió
  // (`bienvenida` de `cfg:<guild>`, un canal), el bot lo saluda ahí. Menciona sólo a quien entró. Nunca frena la respuesta
  for (const sv of pide) {
    if (res[sv] !== 'ok') continue;
    const S = SERVIDORES.find((x) => x.sv === sv && x.guild);
    try {
      const cfg = S ? await env.KV.get('cfg:' + S.guild, 'json') : null;
      const canal = String((cfg && cfg.bienvenida) || '');
      if (!/^[0-9]{15,22}$/.test(canal)) continue;
      await fetch(`${DC_API}/channels/${canal}/messages`, { method: 'POST', headers: bot,
        body: JSON.stringify({ content: '👋 ¡Bienvenido, <@' + u.id + '>! Llegó desde la **Liga Global** con «Unirme a los Tier 1». Pasen y salúdenlo.',
          allowed_mentions: { users: [String(u.id)] } }) });
    } catch (e) { /* la bienvenida no frena la respuesta */ }
  }
  return json({ ok: true, res });
}

// ── 🔗 Los roles vinculados de Discord ─────────────────────────────────────
// 🔑 Dlx, 19/10/2026: «dale», a «los roles vinculados (Linked Roles): el rango de la Liga en el perfil de Discord». Un
// servidor arma un rol con requisitos —«Rango de la Liga ≥ 5», «Verificado en la Liga»— y Discord se lo da a quien
// cumple. Discord abre `/vincular` (`bot/paginas/vincular/`), la página pide el permiso `role_connections.write` y
// esto escribe los datos de la Liga de esa persona con SU permiso. Los datos que se pueden pedir los registra
// `bot/roles_vinculados.py` (una vez, con el bot).
//
// ⚠️ SIN GUARDAR NINGÚN PERMISO, como entrar con Discord: se usa y se tira. Por eso los datos se actualizan cuando la
// persona vuelve a `/vincular` (Discord no deja escribirlos sin un permiso suyo), y la página lo dice.
// ⚠️ LA LETRA LA CALCULA EL CICLO (`rg` del registro, de `comun.rangos.letra_de()`): acá sólo se ordena. Escribir los
// umbrales en el Worker sería el sexto lugar donde vive el rango.
const ORDEN_RG = ['E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
export async function cuentaRol(req, env) {
  const h = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  const json = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: h });
  let d = null;
  try { d = await req.json(); } catch (e) { d = null; }
  const t = String((d && d.token) || '');
  const q = await discordDe(t);
  if (q.error === 'ocupado') return json({ error: 'discord_ocupado' }, 503);
  if (!q.u) return json({ error: 'discord' }, 401);
  const u = q.u;
  let rapero = '', ev = 0, rg = '', verif = false;
  try {
    const clave = await env.KV.get('d:' + u.id);
    if (clave) {
      verif = true;
      const p = JSON.parse((await leerP(env, clave)) || '{}');
      rapero = p.n || '';
      ev = Number(p.ev) || 0;
      rg = ORDEN_RG.includes(p.rg) ? p.rg : '';
    }
  } catch (e) { /* sin sus datos: sale como no verificado */ }
  let nivel = 0;
  if (env.AVISOS) {
    try {
      const r = await env.AVISOS.get(env.AVISOS.idFromName('liga')).fetch('https://avisos/rol-datos', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quien: u.id }) });
      nivel = Number(((await r.json()) || {}).nivel) || 0;
    } catch (e) { nivel = 0; }
  }
  const datos = { rango: rg ? ORDEN_RG.indexOf(rg) + 1 : 0, eventos: ev, nivel, verificado: verif ? 1 : 0 };
  const r = await fetch(`${DC_API}/users/@me/applications/${APP_ID}/role-connection`, {
    method: 'PUT', headers: { Authorization: 'Bearer ' + t, 'content-type': 'application/json' },
    body: JSON.stringify({ platform_name: 'Liga Global', platform_username: String(rapero || u.global_name || u.username || '').slice(0, 100),
      metadata: Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, String(v)])) }) });
  // sin el permiso de escribir los roles vinculados (se entró sólo con «identify»): la página lo vuelve a pedir
  if (r.status === 401 || r.status === 403) return json({ error: 'permiso' }, 403);
  if (!r.ok) return json({ error: 'discord', estado: r.status }, 502);
  return json({ ok: true, rapero, rango: rg, eventos: ev, nivel, verificado: verif });
}

// ── Verificarse desde la página ───────────────────────────────────────────
// 🔑 Dlx, 01/10/2026: «haz que la gente se verifique por la página web, así
// más rápido, y que te entres a DRA automáticamente al hacer eso». Es
// `/verificar` más dos cosas que el comando no puede hacer:
//
//   1. METERTE EN DRA. Con el permiso `guilds.join`, que la página pide sólo
//      para esto, el bot te agrega (`PUT /guilds/{dra}/members/{vos}`: su
//      token y tu permiso, de la misma app). Si ya estás, no se toca nada.
//   2. PONERTE EL PAÍS (Dlx: «A»). Se elige en la página y el bot pone ese
//      rol de DRA. SÓLO A QUIEN NO TIENE ROL DE PAÍS: el que ya tiene uno no
//      se toca, porque cambiar de país es cosa de DRA.
//
// 🔴 Y NUNCA ANTES DE QUE ACEPTES LAS REGLAS DE DRA. DRA tiene pantalla de
// reglas: quien entra queda «pendiente» hasta aceptarlas allá, y un rol puesto
// por un bot a alguien pendiente puede saltearse esa pantalla. Las reglas de
// DRA son de DRA: mientras estés pendiente, la página te manda a aceptarlas y
// recién después te pone el país. Medido el 01/10/2026 con la API: su
// bienvenida no pregunta el país, así que sin esto nadie nuevo lo tendría.
//
// ⚠️ EL ROL DE MIEMBRO NO LO DA ESTO (Dlx: «A»), por lo mismo que no lo da
// `/verificar`: lo da `bot/autoverificar.py` con sus topes y su lista de a
// quién no. Lo que sí hace es ANOTARTE, así esa vuelta te encuentra.
//
// ⚠️ EL PERMISO SE USA Y SE TIRA, como el de entrar: acá no se guarda nada.
const DC_API = 'https://discord.com/api/v10';
// lo que lee un admin de DRA en el registro de auditoría
const RAZON_WEB = encodeURIComponent('Se verificó en underlegends.pages.dev');

export async function cuentaVerificar(req, env, ctx) {
  const h = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  const json = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: h });
  let d = null;
  try { d = await req.json(); } catch (e) { d = null; }
  const t = String((d && d.token) || '');
  if (!/^[A-Za-z0-9._-]{10,300}$/.test(t)) return json({ error: 'token' }, 400);
  const q = await discordDe(t);
  if (q.error === 'ocupado') return json({ error: 'discord_ocupado' }, 503);
  const u = q.u;
  if (!u || !u.id) return json({ error: 'discord' }, 401);
  const esperar = frenado(u.id, 'cuenta');
  if (esperar) return json({ error: 'espera', s: esperar }, 429);
  const [ya, baja, mCrudo] = await Promise.all([
    env.KV.get('d:' + u.id), env.KV.get('olvido:' + u.id), env.KV.get('meta')]);
  if (ya) return json({ listo: true });
  // 🔴 quien borró sus datos no vuelve con un toque: `/borrar-mis-datos`
  // promete que no lo sumamos solo (ver `anotar()`)
  if (baja) return json({ olvido: true });
  let mm = null;
  try { mm = mCrudo ? JSON.parse(mCrudo) : null; } catch (e) { mm = null; }
  const P = mm && mm.porton;
  if (!P || !P.guild || !env.DISCORD_TOKEN) return json({ error: 'porton' }, 503);
  const tabla = P.paises || {};
  const opciones = Object.keys(tabla).map((r) => tabla[r])
    .filter((c, i, xs) => xs.indexOf(c) === i).sort();
  const cc = String((d && d.pais) || '').toLowerCase();
  const rolPais = /^[a-z]{2}$/.test(cc) ? (Object.keys(tabla).find((r) => tabla[r] === cc) || '') : '';
  if (cc && !rolPais) return json({ error: 'pais', opciones }, 400);

  let { estado, miembro } = await miembroDra(env, P.guild, u.id);
  if (!miembro && estado !== 404) return json({ error: 'dra', estado }, 503);
  const bot = { 'Authorization': 'Bot ' + env.DISCORD_TOKEN, 'X-Audit-Log-Reason': RAZON_WEB };
  let entro = false;
  if (!miembro) {
    // ⚠️ SIN `roles` EN EL CUERPO: entra pendiente y el país va después
    let r = null;
    try {
      r = await fetch(`${DC_API}/guilds/${P.guild}/members/${u.id}`, {
        method: 'PUT', headers: Object.assign({ 'content-type': 'application/json' }, bot),
        body: JSON.stringify({ access_token: t }) });
    } catch (e) { r = null; }
    if (!r) return json({ error: 'dra', estado: -1 }, 503);
    if (r.status === 201) {
      entro = true;
      try { miembro = await r.json(); } catch (e) { miembro = null; }
    }
    // 204: ya estaba (entró entre las dos preguntas). Y un 201 sin cuerpo se vuelve a mirar
    if (!miembro && (r.status === 201 || r.status === 204)) {
      ({ miembro } = await miembroDra(env, P.guild, u.id));
    }
    if (!miembro) {
      if (r.status === 201 || r.status === 204) return json({ error: 'dra', estado: -1 }, 503);
      let c = 0;
      try { c = Number((await r.json()).code) || 0; } catch (e) { c = 0; }
      // 30001: ya está en el máximo de servidores · 40007: DRA no lo deja entrar
      // · 401/403: el permiso no trae `guilds.join` (o se venció)
      const e = c === 30001 ? 'lleno' : c === 40007 ? 'no_deja'
        : (r.status === 401 || r.status === 403) ? 'permiso' : 'entrar';
      return json({ error: e, estado: r.status }, e === 'entrar' ? 502 : 403);
    }
  }
  const pendiente = miembro.pending === true;
  const conRol = (miembro.roles || []).filter((r) => tabla[r]);
  let dg = diagnostico(miembro, P);
  let puso = '';
  if (rolPais && !pendiente && !conRol.length && dg.paises.length !== 1) {
    let ok = false;
    try {
      const r = await fetch(`${DC_API}/guilds/${P.guild}/members/${u.id}/roles/${rolPais}`,
        { method: 'PUT', headers: bot });
      ok = r.status === 204;
    } catch (e) { ok = false; }
    if (!ok) return json({ error: 'rol', opciones }, 502);
    miembro.roles = (miembro.roles || []).concat(rolPais);
    puso = cc;
    dg = diagnostico(miembro, P);
  }
  const revisa = (P.revisa || []).indexOf(String(u.id)) >= 0;
  const completo = !pendiente && dg.paises.length === 1 && !revisa;
  // lo tuyo está completo: el Miembro en el momento (`darMiembro()`), y el ciclo hace la tarjeta: para eso te anota
  let dimos = false, ya_corre = false;
  if (completo) {
    if (!dg.rol && await darMiembro(env, P, u.id, 'Liga Global: se verificó en la página (en DRA + país)')) {
      dimos = true;
      dg = Object.assign({}, dg, { rol: true });
    }
    anotar(env, ctx, u.id, miembro.nick || '', u.username || '', u.global_name || '', P.guild, 'yo');
    // ▶️ Y EL CICLO EN ESE MOMENTO (13/11/2026, Dlx: «yinn se verificó pero no aparece que se ha verificado… creo que
    // debería actualizarse al instante»): yinn se verificó a las 2:04 AM, dos minutos después de una corrida, y su
    // perfil, el ranking y sus tarjetas esperaban a la siguiente. La misma puerta que el botón del Dashboard (`cicloAMano()`,
    // una vez cada 10 minutos). ⚠️ De madrugada no: ahí no hay ciclo (`enMadrugada()`), y la página ya dice la vuelta
    // (y nunca tumba la verificación: si el objeto no está, queda la vuelta de siempre)
    if (!enMadrugada(new Date(Date.now())) && env.AVISOS) {
      try {
        luego(ctx, env.AVISOS.get(env.AVISOS.idFromName('liga')).fetch('https://avisos/ciclo-verificar', { method: 'POST', body: '{}' })
          .then((r) => r.json()).catch(() => null));
        ya_corre = true;
      } catch (e) { ya_corre = false; }
    }
  }
  const vuelta = proximaVuelta(Date.now());
  return json({
    enDra: true, entro, pendiente, rol: dg.rol, paises: dg.paises,
    // con varios países: si alguno es rol, se arregla en DRA; si son banderas del nombre, eligiendo acá
    porRol: conRol.length > 0, puso, revisa, completo, dimos, corre: ya_corre,
    vuelta: vuelta ? vuelta.toISOString() : '', opciones,
  });
}

// ── «Mis redes» en el perfil: las conexiones PÚBLICAS de Discord ─────────
// 🔑 Dlx, 25/09/2026, a las ideas de Mi cuenta: «todas». La primera era ésta:
// usar las conexiones que Discord ya tiene (Instagram, TikTok, YouTube…) y
// que se vean en el perfil de cada uno.
//
// ⚠️ SÓLO LAS QUE LA PERSONA YA MUESTRA EN SU PERFIL DE DISCORD
// (`visibility: 1`) Y SÓLO LAS QUE ELIGE: la página las ofrece y se guardan
// cuando toca «Guardar». Nada se publica sin ese toque, y «Quitar» las borra.
//
// ⚠️ EL PERMISO ES OTRO QUE EL DE ENTRAR: `identify connections`, pedido
// desde «Mis redes». Entrar con Discord sigue pidiendo sólo `identify`.
//
// ⚠️ SE GUARDA SÓLO PARA QUIEN TIENE PERFIL EN LA LIGA (`d:<id>`): una red
// sin perfil donde mostrarse sería un dato suelto de alguien. Va a
// `redes:<clave>` y el ciclo la suma a `web:perfiles` (`subir_web.py`).
const REDES_DC = {
  instagram: (c) => 'https://www.instagram.com/' + encodeURIComponent(c.name) + '/',
  tiktok: (c) => 'https://www.tiktok.com/@' + encodeURIComponent(c.name),
  youtube: (c) => 'https://www.youtube.com/channel/' + encodeURIComponent(c.id),
  twitter: (c) => 'https://x.com/' + encodeURIComponent(c.name),
  twitch: (c) => 'https://www.twitch.tv/' + encodeURIComponent(c.name),
  spotify: (c) => 'https://open.spotify.com/user/' + encodeURIComponent(c.id),
  reddit: (c) => 'https://www.reddit.com/user/' + encodeURIComponent(c.name),
  bluesky: (c) => 'https://bsky.app/profile/' + encodeURIComponent(c.name),
};
export function redesPublicas(cs) {
  return (Array.isArray(cs) ? cs : [])
    .filter((c) => c && c.visibility === 1 && REDES_DC[c.type] && (c.type === 'youtube' ||
      c.type === 'spotify' ? c.id : c.name))
    .map((c) => ({ t: c.type === 'twitter' ? 'x' : c.type, n: String(c.name || '').slice(0, 60),
      u: REDES_DC[c.type](c) }))
    .slice(0, 8);
}
async function cuentaRedes(req, env) {
  const h = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  let d = null;
  try { d = await req.json(); } catch (e) { d = null; }
  const t = String((d && d.token) || '');
  if (!/^[A-Za-z0-9._-]{10,300}$/.test(t)) {
    return new Response('{"error":"token"}', { status: 400, headers: h });
  }
  const auth = { headers: { Authorization: 'Bearer ' + t } };
  let u = null, cs = null;
  try {
    // quién es, por `discordDe()`: el permiso tiene que ser de esta app (revisión del 03/10/2026)
    const [q, rc] = await Promise.all([
      discordDe(t),
      fetch('https://discord.com/api/v10/users/@me/connections', auth)]);
    u = q.u || null;
    // sin el permiso de conexiones Discord contesta 401/403: se dice cuál falta
    if (u && (rc.status === 401 || rc.status === 403)) {
      return new Response('{"error":"permiso"}', { status: 403, headers: h });
    }
    if (rc.ok) cs = await rc.json();
  } catch (e) { u = null; }
  if (!u || !u.id || !cs) return new Response('{"error":"discord"}', { status: 401, headers: h });
  const clave = await env.KV.get('d:' + u.id);
  if (!clave) return new Response('{"error":"sin_perfil"}', { status: 409, headers: h });
  const esperar = frenado(u.id, 'cuenta');
  if (esperar) return new Response(JSON.stringify({ error: 'espera', s: esperar }), { status: 429, headers: h });
  const publicas = redesPublicas(cs);
  const k = 'redes:' + clave;
  // lo guardado: `{redes, d, n, t}` (antes era la lista sola)
  let previo = null;
  try { previo = JSON.parse((await env.KV.get(k)) || 'null'); } catch (e) { previo = null; }
  const antes = Array.isArray(previo) ? previo : (previo && previo.redes) || [];
  const hoy = new Date().toISOString().slice(0, 10);
  const usadas = previo && !Array.isArray(previo) && previo.d === hoy ? (previo.n || 0) : 0;
  const id = (r) => r.t + ':' + r.n;
  const igual = (a, b) => a.map(id).join('|') === b.map(id).join('|');
  const guardar = async (lista) => {
    if (igual(lista, antes)) return true;               // sin cambios, sin escritura
    if (usadas >= 10) return false;                     // diez cambios por día y por persona
    await env.KV.put(k, JSON.stringify({ redes: lista, d: hoy, n: usadas + 1, t: Date.now() }));
    return true;
  };
  const vivas = new Set(publicas.map(id));
  if (!Array.isArray(d.mostrar)) {
    // 🔴 LO QUE YA NO ES PÚBLICO SE SACA AL MIRAR. Si alguien oculta una red en
    // Discord —o le cambia el usuario—, el perfil seguía mostrando la vieja, y
    // la página no ofrecía «Quitar» porque ya no tenía redes públicas.
    const siguen = antes.filter((r) => vivas.has(id(r)));
    try { await guardar(siguen); } catch (e) { /* se reintenta la próxima vez */ }
    return new Response(JSON.stringify({ clave, publicas, guardadas: siguen }), { headers: h });
  }
  // ⚠️ SÓLO LAS QUE SIGUEN PÚBLICAS: lo que manda la página se cruza con lo
  // que Discord dice ahora, así no se puede guardar una red ajena ni una oculta
  const quiero = new Set(d.mostrar.map(String).slice(0, 20));
  const elegidas = publicas.filter((r) => quiero.has(id(r)));
  try {
    if (!(await guardar(elegidas))) {
      return new Response('{"error":"tope"}', { status: 429, headers: h });
    }
  } catch (e) {
    return new Response('{"error":"kv"}', { status: 503, headers: h });
  }
  // ⭐ mostrar tus redes sube el nivel, una vez (14/10/2026, `XP_FUENTES`). Si el objeto no contesta, no pasa nada
  if (elegidas.length && env.AVISOS) {
    try {
      await env.AVISOS.get(env.AVISOS.idFromName('liga')).fetch('https://avisos/xp-vio', {
        method: 'POST', body: JSON.stringify({ quien: u.id, que: 'redes' }), headers: { 'content-type': 'application/json' } });
    } catch (e) { /* sin nivel esta vez */ }
  }
  return new Response(JSON.stringify({ clave, publicas, guardadas: elegidas }), { headers: h });
}

// ── la foto desde la página: lo mismo que `/foto` ─────────────────────────
// 🔑 Dlx, 25/09/2026: «¿podrías hacer que se pueda cambiar la foto desde la
// página web de la tarjeta también? Esto respetando lo de 1 vez por
// temporada». Es `/foto` con otra puerta: la misma regla (`meta.arrancada`,
// `claveUso`, el pase de DRA), el mismo guardado (`fotoAR2()`) y la misma
// cara —la global de Discord, no la de un servidor—.
//
// ⚠️ LA CARA SALE DE DISCORD, NO DE LA PÁGINA: el hash viene de `/users/@me`
// con el permiso de entrar. Nadie puede subir otra imagen ni la de otro.
//
// ⚠️ EN DOS PASOS: sin `confirmar` sólo dice qué foto quedaría y si se puede
// (la página la muestra y pregunta); con `confirmar`, la guarda.
async function cuentaFoto(req, env) {
  const h = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  const res = (d, estado = 200) => new Response(JSON.stringify(d), { status: estado, headers: h });
  let d = null;
  try { d = await req.json(); } catch (e) { d = null; }
  const t = String((d && d.token) || '');
  if (!/^[A-Za-z0-9._-]{10,300}$/.test(t)) return res({ error: 'token' }, 400);
  // quién es, por `discordDe()`: el permiso tiene que ser de esta app (revisión del 03/10/2026)
  let u = null;
  try { u = (await discordDe(t)).u || null; } catch (e) { u = null; }
  if (!u || !u.id) return res({ error: 'discord' }, 401);
  const quien = await env.KV.get('d:' + u.id);
  if (!quien) return res({ error: 'sin_perfil' }, 409);
  // ⚠️ CON FRENO: guardar son una escritura de R2 y, después del 9/10, una de
  // KV. Quien tiene el pase de DRA la cambia cuando quiere, no en un bucle.
  if (d.confirmar && frenado(u.id, 'cuenta')) return res({ error: 'espera' }, 429);
  // el blob gris por defecto no se guarda: ver `/foto`
  if (!u.avatar) return res({ error: 'sin_foto' }, 422);
  if (!env.CARTAS) return res({ error: 'sin_r2' }, 503);
  const arranco = await temporadaArrancada(env);
  const usado = arranco && await fotoUsada(env, quien);
  let pase = false;
  if (usado) {
    const dra = SV_DE('DRA');
    const { miembro } = dra ? await miembroDra(env, dra.guild, u.id) : { miembro: null };
    pase = !!(miembro && (miembro.roles || []).indexOf(ROL_PASE) >= 0);
  }
  const temporada = temporadaDe(env).toUpperCase();
  const puede = !usado || pase;
  if (!d.confirmar) {
    return res({ estado: puede ? 'puede' : 'usado', libre: !arranco, pase, temporada,
      libre_hasta: libreHastaTexto(env),
      vista: urlAvatar(u.id, u.avatar).replace('size=1024', 'size=256') });
  }
  if (!puede) return res({ error: 'usado', temporada }, 403);
  const r = await fotoAR2(env, quien, u.id, u.avatar, arranco);
  return res(Object.assign({ temporada, libre_hasta: libreHastaTexto(env) }, r), r.ok ? 200 : 502);
}

// ── /notify: los avisos de eventos, en el celular o la compu ─────────────
// 🔴 SIN DMs. Dlx, 25/09/2026: *«no debería usar el bot para enviarte DMs,
// sino activar la notificación al celular o dispositivo»*. Nació por DM esa
// misma mañana y se sacó con 0 anotados.
//
// 🔑 SE ELIGE EN DISCORD Y SE ACTIVA CON UN TOQUE. Y después: *«que te dé la
// opción para activar las notificaciones desde Discord… y seleccionar los
// servidores o para todos»*. El permiso de notificaciones lo da el navegador
// del dispositivo —ningún bot puede darlo por vos—, así que lo que se hace
// acá es todo lo demás: el menú elige los servidores y el botón abre la
// campana con esa elección ya puesta (`#/avisos/FFA,SR` o `#/avisos/todos`,
// ver `campana.js`). Si ese dispositivo ya estaba activado, el mismo botón
// cambia los servidores.
//
// ⚠️ NO SE GUARDA NADA ACÁ: la elección viaja en el link. Por eso el panel no
// necesita al objeto de los avisos más que para saber qué se escucha.
//
// ⚠️ SÓLO OFRECE LOS SERVIDORES QUE EL VIGÍA ESCUCHA (`escuchados`). Un
// «avisos de TWR» sin un canal de TWR escuchado sería prometer avisos que no
// van a salir. Si el objeto no contesta, se ofrecen todos: la página valida.
export function panelNotify(aqui, escuchados, elegidos) {
  const lista = (escuchados && escuchados.length ? escuchados : SERVIDORES.filter((x) => !x.fuera).map((x) => x.sv))
    .map((sv) => SERVIDORES.find((x) => x.sv === sv) || { sv, nombre: sv });
  const nombre = (sv) => (lista.find((x) => x.sv === sv) || SERVIDORES.find((x) => x.sv === sv) ||
    { nombre: sv }).nombre;
  const hay = (sv) => lista.some((x) => x.sv === sv);
  // lo elegido en el menú; si todavía no se tocó, el servidor donde se escribió
  const sel = Array.isArray(elegidos) ? elegidos.filter(hay) : aqui && hay(aqui) ? [aqui] : [];
  const todos = !sel.length || sel.length >= lista.length;
  const botones = [];
  if (!todos) {
    botones.push({ type: COMP.BOTON, style: ESTILO.SECUNDARIO, label: 'Todos los servidores',
      custom_id: 'ntf:todos' });
  }
  botones.push(Object.assign(botonLink('Activar', AVISOS_URL + '/' + (todos ? 'todos' : sel.join(','))),
    { emoji: { name: '🔔' } }));
  // 🧱 en V2 (20/11/2026): la franja de Eventos, lo que hace en el recuadro y el menú y «Activar» debajo, afuera
  return V.mensaje({ familia: 'eventos', efimero: true, dentro: [
    V.T('### Avisos de eventos en tu celular o compu\n-# Cuando un servidor de la Liga anuncia un evento, te llega un aviso ' +
      'al minuto, aunque no tengas Discord abierto.'),
    V.SEP,
    V.T('**Elegidos:** ' + (todos ? 'todos los servidores.' : sel.map((sv) => '**' + nombre(sv) + '**').join(', ') + '.') +
      '\n1. Cámbialos con el menú si quieres.\n2. Toca **Activar**: se abre la página y aceptas las notificaciones. Listo.'),
    V.T('-# 📱 **En iPhone**, antes: Safari → **Compartir** → **Agregar a inicio**, y abre la Liga desde ese ícono. Se activa ' +
      'una vez en cada dispositivo; si ya lo tenías, **Activar** cambia los servidores.'),
    aqui && !hay(aqui) ? V.T(`⚠️ Todavía no se escuchan los eventos de **${nombre(aqui)}**.`) : null,
  ], filas: [
    { type: COMP.FILA, components: [{
      type: COMP.SELECT, custom_id: 'ntf:svs', placeholder: 'Elige de qué servidores',
      min_values: 1, max_values: lista.length,
      options: lista.map((x) => ({ label: x.nombre, value: x.sv, default: !todos && sel.indexOf(x.sv) >= 0 })),
    }] },
    botones,
  ] });
}

async function escuchados(env) {
  try {
    const r = await rutaAvisos(new Request('https://x/avisos/estado'), env, '/avisos/estado');
    const c = ((await r.json()).vigia || {}).canales || [];
    return c.length ? [...new Set(c.map((x) => x.sv))] : null;
  } catch (e) {
    return null;
  }
}

// ── Los ajustes del servidor ──────────────────────────────────────────────
// Dlx, 19/09/2026: «un comando settings que funcione con botones que solo los
// dueños del servidor o los que tengan manage roles o admins puedan usar».
const claveCfg = (gid) => `cfg:${gid}`;

// ⚠️ EL DEFAULT ES «PRENDIDO Y SIN RESTRICCIONES», y eso es una decisión: un
// servidor que nunca abrió `/settings` tiene que comportarse como se comportaba
// antes de que `/settings` existiera. Si el default fuera apagado, sumar esta
// pantalla le cambiaría el apodo a gente de servidores que no pidieron nada.
// 🎤 `vivo`: el canal donde el bot cuenta en vivo los eventos de la Liga (05/10/2026). Vacío = apagado: nunca escribe
// en un servidor que no lo pidió (ver `chatVivo()` en avisos.js). 🔊 `vivo_nivel`: cuánto habla ahí
// (`NIVELES_CHAT`, 05/10/2026); sin elegir, «normal», lo de siempre
// 📈 `ascenso`: el canal donde el bot mantiene su ranking de ascenso al día (17/10/2026). Vacío = apagado, como `vivo`
// (`CFG_BASE` vive en avisos.js desde el 19/10/2026: el panel del socio en la página escribe el mismo `cfg:<guild>`)

async function ajustes(env, gid) {
  if (!gid) return { ...CFG_BASE };
  try {
    const c = await env.KV.get(claveCfg(gid));
    return c ? { ...CFG_BASE, ...JSON.parse(c) } : { ...CFG_BASE };
  } catch (e) {
    return { ...CFG_BASE };          // KV caído no puede apagarle el bot a nadie
  }
}

// ⚠️ EL DUEÑO NO SE CHEQUEA APARTE. `member.permissions` de una interacción ya
// viene CALCULADO por Discord, y al dueño le da todos los bits — así que
// pedir ADMINISTRATOR o MANAGE_ROLES lo incluye. Compararlo contra
// `guild.owner_id` sería una consulta más para saber algo que ya está acá.
//
// ⚠️ VA EN BigInt Y NO EN Number. El bitfield de permisos de Discord pasa de
// 2^53 —los permisos nuevos viven arriba de ese bit— así que con `parseInt` los
// de más arriba se redondean y el chequeo empieza a mentir. Es el mismo
// problema que los snowflakes en una celda numérica del Sheet.
const PERM_ADMIN = 8n;                  // ADMINISTRATOR
const PERM_ROLES = 268435456n;          // MANAGE_ROLES
function puedeAjustar(i) {
  try {
    const p = BigInt((i.member && i.member.permissions) || '0');
    return (p & PERM_ADMIN) !== 0n || (p & PERM_ROLES) !== 0n;
  } catch (e) {
    return false;
  }
}

// El panel (Dlx, 20/11/2026, la maqueta): una sección por ajuste, con su estado y su botón al costado; los menús de canal se
// abren al tocar «Elegir» (`panelElegir()`). Un solo azul: lo que está apagado y conviene prender (el bot en vivo). Se usa
// igual para abrirlo y para redibujarlo después de cada click, así que el estado sale siempre de `cfg` y nunca del
// `custom_id`.
function panelAjustes(sv, cfg) {
  const canales = cfg.canales && cfg.canales.length
    ? cfg.canales.map(c => `<#${c}>`).join(' ')
    : '**todos**';
  const avisos = cfg.avisos ? `<#${cfg.avisos}>` : '**ninguno**';
  const nivel = NIVELES_CHAT[cfg.vivo_nivel] ? cfg.vivo_nivel : 'normal';
  const vivo = cfg.vivo ? `<#${cfg.vivo}> · habla: **${NIVELES_CHAT[nivel][0].toLowerCase()}**` : '**apagado**';
  const linea = (t, sub, b) => V.seccion(t + '\n-# ' + sub, b);
  return V.mensaje({ familia: 'ajustes', efimero: true, dentro: [
    V.T(`### Ajustes de la Liga en ${sv}\n-# Lo ven y lo cambian los admins del servidor (o quien tenga *Gestionar roles*).`),
    V.SEP,
    linea(`**Las marcas de la Liga en el apodo** · ${cfg.nick ? '🟢 activadas' : '🔴 apagadas'}`, cfg.nick
      ? 'Quien no eligió nada lleva su #N y su crew (`#23 | FLB | Nombre`). Cada uno lo cambia con `/apodo`.'
      : 'Quien no eligió nada queda con su nombre solo. Cada uno puede elegir su estilo con `/apodo`.',
    V.boton(cfg.nick ? 'Apagar' : 'Prender', 'cfg:nick', ESTILO.SECUNDARIO)),
    linea(`**Dónde se usa \`/card\`** · ${canales}`, 'Vacío = en cualquiera.', V.boton('Elegir', 'cfg:elegir:canales', ESTILO.SECUNDARIO)),
    linea(`**Avisos de cambio de rango** · ${avisos}`, 'Dónde anunciar cuando alguien sube o baja de rango.',
      V.boton('Elegir', 'cfg:elegir:avisos', ESTILO.SECUNDARIO)),
    linea(`**El bot en vivo** · ${vivo}`, 'Durante un evento de la Liga en este servidor, cuenta en ese canal cómo va. ' +
      'Nunca menciona a nadie.', V.boton(cfg.vivo ? 'Cambiar' : 'Prender', 'cfg:elegir:vivo', cfg.vivo ? ESTILO.SECUNDARIO : ESTILO.PRIMARIO)),
    // 🎲 siempre, en todos los niveles (11/11/2026, ver `hayApuestas()` en avisos.js): no hay botón
    V.T('**Apuestas** · siempre\n-# Con el bot en vivo, antes de cada batalla se puede apostar con Puntos de Tienda, y el pozo ' +
      'se reparte entre los que aciertan. Desde la Liga se pueden apagar para un servidor.'),
    linea(`**El ascenso de sus ligas** · ${cfg.ascenso ? `<#${cfg.ascenso}>` : '**apagado**'}`,
      'El bot mantiene su ranking de ascenso al día en ese canal.', V.boton('Elegir', 'cfg:asc', ESTILO.SECUNDARIO)),
  ], filas: [
    // 📣 lo que hasta el 16/11/2026 estaba sólo en la página (el aviso de cada evento, las ligas, el resumen): su panel
    [V.boton('Más canales', 'cfg:mas', ESTILO.SECUNDARIO, { emoji: { name: '📣' } })],
  ] });
}

// ⚙️ LOS MENÚS DE CANAL, CADA UNO EN SU SUBPANEL (20/11/2026): se abren con «Elegir» y, al elegir, se vuelve al panel.
// ⚠️ `min_values: 0` ES LO QUE DEJA VOLVER ATRÁS: sin eso no hay manera de sacar la restricción una vez puesta.
// ⚠️ Sin `default_values`: un canal borrado hace que Discord rechace el mensaje entero (lo elegido se ve en el texto).
const ELEGIR = {
  canales: ['Dónde se usa /card', 'Los canales donde se pueden pedir cartas. Vacío = en cualquiera.',
    () => [{ type: 8, custom_id: 'cfg:canales', placeholder: 'Canales donde se puede usar /card (vacío = todos)',
      min_values: 0, max_values: 10, channel_types: [0] }]],
  avisos: ['Avisos de cambio de rango', 'El canal donde se anuncia cuando alguien sube o baja de rango. Vacío = ninguno.',
    () => [{ type: 8, custom_id: 'cfg:avisos', placeholder: 'Canal para avisar cambios de rango (vacío = ninguno)',
      min_values: 0, max_values: 1, channel_types: [0] }]],
  vivo: ['El bot en vivo', 'Durante un evento de la Liga en este servidor, cuenta en ese canal cómo va. Cuánto habla: ' +
    '**lo justo** (el arranque y el campeón), **normal** (además quién pasa cada ronda y la final; como mucho un mensaje ' +
    'cada 10 minutos) o **cada batalla** (quién gana cada una apenas se sabe; como mucho uno cada 2 minutos). Nunca ' +
    'menciona a nadie. Vacío = apagado.',
    (cfg, nivel) => [{ type: 8, custom_id: 'cfg:vivo', placeholder: 'Canal del bot en vivo (vacío = apagado)',
      min_values: 0, max_values: 1, channel_types: [0] }, {
      type: COMP.SELECT, custom_id: 'cfg:nivel', placeholder: 'Cuánto habla el bot en vivo', min_values: 1, max_values: 1,
      options: Object.entries(NIVELES_CHAT).map(([v, [label, description]]) => ({ label, value: v, description, default: v === nivel })),
    }]],
};
function panelElegir(cfg, que) {
  const e = ELEGIR[que];
  if (!e) return null;
  const nivel = NIVELES_CHAT[cfg.vivo_nivel] ? cfg.vivo_nivel : 'normal';
  const ahora = que === 'canales' ? (cfg.canales && cfg.canales.length ? cfg.canales.map((c) => `<#${c}>`).join(' ') : '**todos**')
    : que === 'avisos' ? (cfg.avisos ? `<#${cfg.avisos}>` : '**ninguno**')
      : (cfg.vivo ? `<#${cfg.vivo}> · habla: **${NIVELES_CHAT[nivel][0].toLowerCase()}**` : '**apagado**');
  return V.mensaje({ familia: 'ajustes', efimero: true, dentro: [V.T(`### ${e[0]}\nAhora: ${ahora}\n-# ${e[1]}`)],
    filas: e[2](cfg, nivel).map((c) => ({ type: COMP.FILA, components: [c] }))
      .concat([[V.boton('‹ Volver a los ajustes', 'cfg:volver', ESTILO.SECUNDARIO)]]) });
}

// ── 📈 EL ASCENSO DE SUS LIGAS (Dlx, 17/10/2026: «crear un ascenso actualizado para cada servidor para sus ligas. Que
// sea opción y se ponga en /settings») ──────────────────────────────────────────────────────────────────────────────
// Lo hace el ciclo (`bot/ascenso.py`): su tabla oficial más lo que vino después, con SUS reglas. Acá sólo se elige el
// canal. Qué servidores tienen las reglas cargadas lo dice `meta.asc` (`{sv: [liga, id en la página]}`, del ciclo):
// sin reglas se puede elegir igual, pero el panel lo dice —no promete algo que todavía no hace—
async function panelAscenso(env, gid, cfg) {
  const sv = aquiEs(gid);
  let asc = {};
  try { asc = (JSON.parse((await env.KV.get('meta', { cacheTtl: 300 })) || '{}') || {}).asc || {}; } catch (e) { asc = {}; }
  const [liga, destino] = (sv && asc[sv]) || [];
  const nombre = (SERVIDORES.find((s) => s.sv === sv) || {}).nombre || 'este servidor';
  return V.mensaje({ familia: 'ajustes', efimero: true, dentro: [
    V.T('### El ascenso de sus ligas, al día\n' + (liga
      ? `Ya tenemos las reglas de **${nombre}**: el ascenso a la **${liga}**.`
      : 'Todavía no tenemos las reglas del ascenso de este servidor: pásale su tabla y sus rangos a **@itsdlx**.')),
    V.T('-# El bot parte de **su tabla oficial** y le suma lo que vino después —las compes con su rango, con **sus** ' +
      'puntos—. Mantiene **un solo mensaje** en el canal que elijan: lo edita cuando cambia algo y nunca menciona a ' +
      'nadie. Lo que no sabe (una compe sin rango publicado) no suma y lo dice. La tabla oficial sigue siendo la de ustedes.'),
    V.SEP,
    V.T(`**Canal** · ${cfg.ascenso ? `<#${cfg.ascenso}>` : '**apagado**'}` +
      (liga && destino ? `\n-# También está en la página: ${HUB_URL}/freestyle-rap/ligas/${destino}` : '')),
  ], filas: [
    { type: COMP.FILA, components: [{
      type: 8,                       // CHANNEL_SELECT
      custom_id: 'cfg:asc_canal',
      placeholder: 'Canal del ascenso (vacío = apagado)',
      min_values: 0, max_values: 1,
      channel_types: [0],
    }] },
    [V.boton('‹ Volver a los ajustes', 'cfg:volver', ESTILO.SECUNDARIO)],
  ] });
}

// ── 📣 MÁS CANALES (Dlx, 16/11/2026: «todo», a que /settings tenga lo mismo que el panel del socio en la página) ─────
// El aviso de cada evento, el canal de las batallas de liga (o apagarlas) y el del resumen de los lunes: el mismo
// `cfg:<guild>` que escribe la página (`socioAjustes()` en avisos.js), así lo último que se toque es lo que vale. El canal
// de UNA liga en particular sigue en la página: un menú por liga no entra en un mensaje de Discord
function panelMas(cfg) {
  const ae = cfg.aviso_evento === 'chat' || cfg.aviso_evento === 'no' ? cfg.aviso_evento : '';
  const ligas = cfg.ligas === 'no' ? '**apagadas**' : cfg.ligas ? `<#${cfg.ligas}>` : '**donde habla el bot en vivo**';
  return V.mensaje({ familia: 'ajustes', efimero: true, dentro: [
    V.T('### Más canales\n-# Lo mismo que el panel del servidor en la página.'),
    V.SEP,
    V.T(`**El aviso de cada evento** · ${ae === 'no' ? '**apagado**' : ae === 'chat' ? '**en el chat general**' : '**donde habla el bot en vivo**'}` +
      '\n-# Un mensaje cuando arranca cada evento de este servidor, con su nivel, que se edita solo. Nunca menciona a nadie.'),
    V.T(`**Las batallas de sus ligas** · ${ligas}` +
      '\n-# Cada batalla de liga con su VS, mientras se juega. Una liga en particular a otro canal se elige en la página, en el panel del servidor.'),
    V.T(`**El resumen de los lunes** · ${cfg.resumen ? `<#${cfg.resumen}>` : '**ninguno**'}` +
      '\n-# Los lunes a las 12 del mediodía (hora del este): cómo le fue a este servidor en la semana.'),
  ], filas: [
    { type: COMP.FILA, components: [{
      type: COMP.SELECT, custom_id: 'cfg:aviso_evento', placeholder: 'Dónde va el aviso de cada evento', min_values: 1, max_values: 1,
      options: [['vivo', 'Donde habla el bot en vivo'], ['chat', 'En el chat general'], ['no', 'Apagado']]
        .map(([v, label]) => ({ label, value: v, default: (ae || 'vivo') === v })),
    }] },
    { type: COMP.FILA, components: [{
      type: 8, custom_id: 'cfg:ligas', placeholder: 'Canal de las batallas de liga (vacío = donde habla en vivo)',
      min_values: 0, max_values: 1, channel_types: [0],
    }] },
    { type: COMP.FILA, components: [{
      type: 8, custom_id: 'cfg:resumen', placeholder: 'Canal del resumen de los lunes (vacío = ninguno)',
      min_values: 0, max_values: 1, channel_types: [0],
    }] },
    [V.boton('‹ Volver a los ajustes', 'cfg:volver', ESTILO.SECUNDARIO),
      V.boton(cfg.ligas === 'no' ? 'Prender las batallas de liga' : 'Apagar las batallas de liga', 'cfg:ligas_no', ESTILO.SECUNDARIO)],
  ] });
}

// 🛡️ lo que `bot/antiraid.js` toma del Worker: cómo diferir, quién tocó, el nombre del servidor y las invitaciones de la
// Liga (el escudo las deja pasar: un anuncio de un servidor aliado no es spam)
const ayudaAR = (i) => ({
  luego, idDe, aviso,
  nombre: (SERVIDORES.find((s) => s.guild && s.guild === i.guild_id) || {}).nombre || 'este servidor',
  pasan: SERVIDORES.map((s) => String(s.invita || '').replace(/^https?:\/\//, '')).filter(Boolean),
});

// 🧭 lo que `bot/setup.js` toma del Worker: cómo diferir, quién tocó, el freno y la lista de servidores escrita acá
// (`meta.nuevos` le suma los que entraron sin pasar por el código: ver `conNuevos()` de avisos.js)
const ayudaSU = () => ({ luego, idDe, aviso, espera, frenado, SERVIDORES });

// 🧱 un panel (efímero y en V2, 20/11/2026): `p` es un mensaje armado (`ficha()`, `V.mensaje()`), o uno de antes con
// `{content, components}`, que se pasa a V2. En un clic (tipo 7) sobre un panel de antes, va uno nuevo (`editarAqui()`)
const responderPanel = (tipo, p, i) => {
  const data = Object.assign(V.aV2(p, true), { flags: V2 | EFIMERO });
  return tipo === RESPONDE.ACTUALIZAR && i ? editarAqui(i, data) : responderV2(tipo, data);
};

// ── El «#N» efectivo: lo del usuario gana, y si no eligió manda el servidor ─
// Dlx, 19/09/2026: «si un usuario estaba en on y después yo lo apago, gana el
// usuario y conserva su apodo, porque eso es algo suyo. Si no lo usaron,
// siguen lo que deciden los admins».
//
// 🔴 POR ESO SON **TRES** ESTADOS Y NO DOS, y es todo el diseño. La primera
// versión guardaba `poff:<guild>:<id>` y usaba la PRESENCIA de la clave como
// «apagado»: eso no distingue «lo prendió a propósito» de «nunca lo tocó», y
// sin esa distinción la regla de Dlx no se puede escribir. Ahora la clave
// guarda `on: true|false` y NO EXISTIR es el tercer estado.
const claveNick = (gid, uid) => `pnick:${gid}:${uid}`;
// cuánto queda a la vista la pregunta de una llave después de contestada la última batalla (ver `dud`)
const BORRAR_PREGUNTA_MS = 20000;

async function eleccionNick(env, gid, uid) {
  try {
    const v = await env.KV.get(claveNick(gid, uid));
    if (!v) return null;                       // nunca eligió
    return JSON.parse(v);
  } catch (e) {
    return null;
  }
}

// 🏷️ TU «#N» EN EL APODO, DESDE TU PERFIL (Dlx, 21/10/2026: «haz que en mi perfil estén configuraciones extras, por
// ejemplo activar el numeral en X servidores, o activarlo generalmente, o desactivarlo»). Lo mismo que `/numeral`, pero
// de todos los servidores a la vez y desde la página: escribe la MISMA clave (`pnick:<guild>:<id>`, `{on}`), así que
// `herramientas/sincronizar_puesto.py --ciclo` la aplica en la próxima vuelta y tu elección le sigue ganando a la del
// servidor. Quién pide lo dice Discord (`quienPide`); sólo verificados (`d:`), porque el «#» es del Competitivo.
// ⚠️ NO TOCA EL APODO ACÁ: sin el apodo de hoy de cada servidor (un pedido a Discord por servidor) se lo pondría a
// ciegas; lo hace el ciclo, que ya los baja. Y sólo escribe lo que cambia: cada clave es una escritura del cupo de KV
async function numeralPagina(req, env) {
  const h = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  const json = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: h });
  if (req.method !== 'POST') return json({ error: 'metodo' }, 405);
  const crudo = await req.text();
  if (crudo.length > 2048) return json({ error: 'demasiado grande' }, 413);
  let d = null;
  try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
  if (!d || typeof d !== 'object' || (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token)))) return json({ error: 'faltan datos' }, 400);
  const q = await quienPide(req, env, d);
  if (!q.id) return json({ error: q.error }, q.estado);
  let de = '';
  try { de = (await env.KV.get('d:' + q.id)) || ''; } catch (e) { de = ''; }
  if (!claveValida(de)) return json({ error: 'sin_verificar' }, 403);
  const svs = SERVIDORES.filter((s) => s.guild);
  // cambiar: `{guild: true|false}`, sólo guilds de la Liga
  if (d.cambiar && typeof d.cambiar === 'object') {
    for (const [gid, on] of Object.entries(d.cambiar).slice(0, svs.length)) {
      if (!aquiEs(gid) || typeof on !== 'boolean') continue;
      const prev = await eleccionNick(env, gid, q.id);
      if (prev && !!prev.on === on) continue;
      try {
        await env.KV.put(claveNick(gid, q.id), JSON.stringify({ on, antes: (prev && prev.antes) || '', ts: Date.now() }));
      } catch (e) {
        return json({ error: 'kv', detalle: String(e).slice(0, 60) }, 503);
      }
    }
  }
  let numero = 0;
  try { numero = ((JSON.parse((await leerP(env, de)) || '{}').vs || {}).c || {}).n || 0; } catch (e) { numero = 0; }
  const out = await Promise.all(svs.map(async (s) => {
    const [mio, cfg] = await Promise.all([eleccionNick(env, s.guild, q.id), ajustes(env, s.guild)]);
    return { sv: s.sv, n: s.nombre, gid: s.guild, mio: mio ? !!mio.on : null, sv_on: cfg.nick !== false };
  }));
  return json({ ok: true, numero, svs: out });
}

// 🏷️ TU APODO, DESDE TU PERFIL (18/11/2026): lo mismo que `/apodo` —la misma clave, `apodo:<id>`— pero sin servidor, así
// que no cambia el apodo acá: lo aplica el ciclo en su próxima vuelta, en todos. Devuelve los seis estilos armados con
// tus piezas (las de `apodos`, las que deja `herramientas/sincronizar_puesto.py`) para que la página los muestre como van
// a quedar. Sólo verificados (`d:`), como el /numeral de antes
async function apodoPagina(req, env) {
  const h = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  const json = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: h });
  if (req.method !== 'POST') return json({ error: 'metodo' }, 405);
  const crudo = await req.text();
  if (crudo.length > 2048) return json({ error: 'demasiado grande' }, 413);
  let d = null;
  try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
  if (!d || typeof d !== 'object' || (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token)))) return json({ error: 'faltan datos' }, 400);
  const q = await quienPide(req, env, d);
  if (!q.id) return json({ error: q.error }, q.estado);
  let de = '';
  try { de = (await env.KV.get('d:' + q.id)) || ''; } catch (e) { de = ''; }
  if (!claveValida(de)) return json({ error: 'sin_verificar' }, 403);
  let mio = null;
  let todo = null;
  try {
    const [m, a] = await Promise.all([env.KV.get('apodo:' + q.id), env.KV.get('apodos')]);
    mio = m ? JSON.parse(m) : null;
    todo = a ? JSON.parse(a) : null;
  } catch (e) { mio = mio || null; }
  const quiere = d.estilo == null ? null : AP.estiloValido(d.estilo);
  if (d.estilo != null && !quiere) return json({ error: 'estilo' }, 400);
  if (quiere && (!mio || AP.estiloValido(mio.e) !== quiere)) {
    try {
      await env.KV.put('apodo:' + q.id, JSON.stringify({ e: quiere, ts: Date.now() }));
      mio = { e: quiere };
    } catch (e) {
      return json({ error: 'kv', detalle: String(e).slice(0, 60) }, 503);
    }
  }
  const fila = todo && todo.p ? todo.p[q.id] : null;
  const p = AP.piezasDe(fila);
  const base = (fila && fila[6]) || '';
  const estilos = AP.ESTILOS.map(([n, t, ej]) => {
    const sale = p && base ? AP.armar(n, base, p) : '';
    // «te falta esa pieza»: la marca de ESE estilo (sin rango, el 5 sale igual que el 1 con la crew sola)
    const falta = !!p && n !== AP.SOLO_NOMBRE && !AP.adelante(n, p);
    return { n, t, ej, sale, falta };
  });
  return json({ ok: true, estilo: AP.estiloValido(mio && mio.e), defecto: AP.POR_DEFECTO, piezas: !!p, estilos });
}

// ── /help ─────────────────────────────────────────────────────────────────
// ⚠️ LOS REQUISITOS NO ESTÁN ESCRITOS ACÁ: SALEN DE `meta.req`, que el
// pipeline escribe desde `comun/requisitos.py`. Un texto de ayuda a mano se
// desactualiza el día que cambia una regla y **no avisa** — el 19/09 la
// Temporada pasó de «2 eventos» a «1 participación» y un help hardcodeado ya
// estaría mintiendo. Si `meta.req` falta —KV viejo— se dice que no se sabe, en
// vez de inventar un número.
function requisitos(m) {
  const r = m && m.req;
  if (!r) return '_(no pude leer los requisitos ahora mismo)_';
  // ⚠️ SE DICEN TODAS LAS CONDICIONES, NO LA PRIMERA. País pide tres
  // —bandera, 3 duelos nacionales y 3 internacionales— y hasta el
  // 22/09/2026 acá llegaba sólo la primera, que es la bandera: el help
  // decía «1 bandera asignada» y la tarjeta pedía duelos. `todos` puede
  // no estar si KV es más viejo que este código, y entonces se cae a lo
  // de antes en vez de quedarse sin línea.
  const linea = (id, et) => {
    const q = r[id];
    if (!q) return `· **${et}** — sin requisito`;
    const cs = Array.isArray(q.todos) && q.todos.length
      ? q.todos.map(([n, que]) => `${n} ${String(que).toLowerCase()}`)
      : [`${q.n} ${String(q.que).toLowerCase()}`];
    return `· **${et}** — ${cs.join(' + ')}`;
  };
  // 🔑 LA SERVIDOR Y LA TEMPORADA NO SALEN DEL META DESDE EL 05/10/2026 (2.41, Dlx: «C», «4. nivel 1»): las abre el
  // portón —verificarse— y la Temporada además el nivel 1 del Pase. El meta seguía diciendo «1 participación» y «sin
  // requisito», que era la regla del 29/09. Es lo mismo que dice `dosPasos()`
  return ['· **Servidor** — verificarte en la página, entrando con Discord',
          '· **Temporada** — verificarte y tu primera Tarea del Pase de rapero (el nivel 1)',
          linea('competitivo', 'Competitiva') + ' · y verificarte',
          linea('pais', 'País') + ' · y verificarte'].join('\n');
}

const AYUDA = {
  agendar: () => [
    '## `/agendar` — un evento en el calendario de la Liga',
    'Agenda un evento de este servidor con **día** (`18/10`), **hora** (`20:00`) y el **país** de esa hora: sale en el ' +
    'calendario de la página y cada uno lo ve en su hora.',
    '',
    'Con **12 horas o más** de anticipación, quienes lo juegan suman **+10 %** en la Temporada, y al organizador le ' +
    'cuenta doble para el Organizador de la semana.',
    'Para sacarlo: `/agendar nombre:<el mismo> borrar:True`. Es para el **staff y los organizadores** del servidor.',
  ].join('\n'),
  afiche: () => [
    '## `/afiche` — el afiche del evento',
    'Toma el **último anuncio de este servidor** (de las últimas 48 horas) y lo dibuja como una imagen cuadrada, con el ' +
    'logo del servidor, lista para compartir.',
    '',
    'Es para el **staff y los organizadores** del servidor. Tarda uno o dos minutos: la imagen aparece en la misma respuesta.',
  ].join('\n'),
  llave: () => [
    '## `/llave` — la llave como imagen',
    'Toma la **última llave de este servidor** (de las últimas 48 horas) y la dibuja como cuadro, con el campeón si ya lo hay.',
    '',
    'Sale como la leyó el bot: si algo se ve mal, es que se leyó mal y conviene avisar.',
    'Es para el **staff y los organizadores** del servidor. Tarda uno o dos minutos.',
  ].join('\n'),
  card: (m) => [
    '## `/card` — la tarjeta',
    'Sin poner nada, es la tuya. Con `quien:` es la de esa persona.',
    'O sin escribir nada: click derecho en la persona → **Apps** → **Carta**.',
    '',
    'Cada uno tiene hasta **cuatro caras**, y los botones de abajo las cambian.',
    'La de **Servidor** trae además un menú para ver la de cada servidor.',
    '',
    '**Qué hace falta para cada una**',
    requisitos(m),
    '',
    'Si todavía no llegas a una, el botón igual aparece: te lleva a una ' +
    'tarjeta que dice **cuánto te falta**. El botón sólo desaparece cuando la ' +
    'tarjeta no se puede emitir — por ejemplo País sin país cargado.',
    '',
    '⚠️ Sin verificarte no hay tarjetas: `/verificar` te dice qué te falta.',
  ].join('\n'),

  versus: () => [
    '## `/versus` — quién gana',
    '`/versus rival:@alguien` los enfrenta y te dice quién gana.',
    'Con `contra:` eliges tú a los dos, así que sirve para armar un cruce ' +
    'entre otras dos personas.',
    '',
    '`carta:` elige la categoría. Por defecto, la **Competitiva** si la tienen los dos (si no, la de **Servidor**), y los ' +
    'botones de abajo la cambian sin volver a tirar el comando. Arriba salen las dos cartas.',
    '',
    '**Cada categoría compara su propio número**',
    '· **Temporada** — el OVR, y los cinco que lo forman',
    '· **Competitiva** — el Score, y las cinco dimensiones',
    '· **País** — el OVR Nacional, y tu puesto en tu país',
    '· **Servidor** — tu puesto ahí, y los eventos',
    '',
    '**Una sola categoría para los dos, y no es un capricho.**',
    'El número de cada tarjeta mide lo que esa tarjeta mide: Temporada lleva ' +
    'el OVR y Competitiva lleva el Score. No comparten escala, así que ' +
    'enfrentarlas sería restar dos cosas distintas.',
    '',
    '⚠️ Los puestos se comparan **por percentil**. Ser 1 de 18 y ser 1 de ' +
    '79 no es lo mismo, así que el número más chico no gana solo por serlo.',
    '',
    'Sólo aparecen las categorías que tienen **los dos**, y desbloqueadas.',
  ].join('\n'),

  apodo: () => [
    '## `/apodo` — cómo va tu apodo en Discord',
    '`/apodo` solo te muestra los seis estilos con lo tuyo. `/apodo estilo:` elige uno:',
    ...AP.ESTILOS.map(([n, t, ej]) => `**${n}** · ${t} — \`${ej}\`` + (n === AP.POR_DEFECTO ? ' *(el de siempre)*' : '')),
    '',
    'La sigla de tu crew va sola si tienes; lo que no tienes no aparece (sin 10 eventos no hay #N ni rango).',
    'Vale para **todos los servidores de la Liga**: acá cambia al toque y en los demás, en la próxima vuelta del bot.',
    '',
    '⚠️ **Tu elección le gana a la del servidor.** Si un admin apaga las marcas con `/settings`, a ti no te tocan ' +
    'si elegiste un estilo.',
  ].join('\n'),

  // ⚠️ SIN ARGUMENTOS A PROPOSITO. El handler de `/help` mira la aridad
  // (`f.length`) para decidir si vale la pena gastar una lectura de KV, y
  // este texto no dice ningún número que pueda cambiar. Declararlo con un
  // parámetro que no se usa haría que cada `/help comando:foto` leyera KV
  // de gusto.
  foto: () => [
    '## `/foto` — la cara de tus tarjetas',
    'Corre `/foto` y se guarda **la que tienes puesta en Discord ahora**.',
    '',
    '⚠️ **Va una por temporada, y queda congelada.** Después de elegirla, ' +
    'aunque cambies tu foto de Discord, tus tarjetas de esta temporada ' +
    'siguen con ésa.',
    '',
    '· **Mientras la temporada no arrancó, cambiala las veces que quieras.** ' +
    'El límite empieza a contar cuando alguien compite: antes de eso no hay ' +
    'historia que congelar.',
    '',
    'No es un capricho: la tarjeta **Histórica** necesita la cara que tenías ' +
    'en *cada* temporada, no la última. Si se pisara, tus tarjetas de la T1 ' +
    'perderían su cara el día que arranque la T2.',
    '',
    '· Se toma tu **foto global** de Discord, no la que te pusiste en un ' +
    'servidor: la tarjeta es una sola para todos.',
    '· Si no tienes foto puesta, **no se guarda nada** — tu tarjeta va con la ' +
    'inicial, que con el color de tu rango queda bien.',
    '· Se ve la próxima vez que se dibujen tus tarjetas.',
    '',
    '🔒 Antes se pedía al CDN de Discord con un enlace que **caducaba** ' +
    'cuando cambiabas de foto, y la tarjeta se quedaba sin cara. Guardada ' +
    'así, eso no pasa más.',
  ].join('\n'),

  settings: () => [
    '## `/settings` — los ajustes del servidor',
    'Sólo para **admins** o quien tenga *Gestionar roles*. Va con botones.',
    '',
    '· **Las marcas de la Liga en el apodo** (el `#N` y la crew) — prendidas o apagadas para todo el ' +
    'servidor. Es el valor por defecto: quien haya elegido su estilo con `/apodo` ' +
    'conserva lo suyo.',
    '· **Canales donde se puede usar `/card`** — vacío es en cualquiera.',
    '· **Avisos de cambio de rango** — a qué canal anunciarlos.',
    '· **El bot en vivo** — en qué canal cuenta los eventos de la Liga en este ' +
    'servidor mientras se juegan (la llave, cada ronda, la final y el campeón). ' +
    'Vacío es apagado; no menciona a nadie.',
  ].join('\n'),

  antiraid: () => [
    '## `/antiraid` — el anti-raid del servidor',
    'Sólo para **el dueño del servidor**. Todo es opcional y, salvo con AUTOMÁTICO, **nunca actúa solo**: avisa en el ' +
    'canal que elijas, con botones, y decide el staff.',
    '',
    '· **Escudo de Discord** — reglas de AutoMod: menciones masivas, spam, insultos de odio y links de invitación ajenos ' +
    '(los de la Liga pasan).',
    '· **Alarma de oleada** — si entran muchas cuentas de golpe.',
    '· **Vigilancia del staff** — expulsiones, baneos o borrados en masa, y un rol peligroso para una cuenta que no es un bot.',
    '· **Botón de pánico** — pausa las invitaciones y los mensajes directos y sube la verificación; «abrir» lo deja como estaba.',
    '· **AUTOMÁTICO** _(experimental)_ — si nadie responde un aviso en 2 minutos, hace lo más seguro: cierra el servidor o ' +
    'le saca los roles a quien hace el daño (se devuelven con un botón). Nunca expulsa ni banea.',
  ].join('\n'),

  notify: () => [
    '## `/notify` — los avisos de eventos en tu celular o compu',
    'Te da el link para activar los avisos en ese dispositivo, con el servidor ' +
    'donde lo escribiste ya elegido. Cuando anuncia un evento, te llega un aviso ' +
    'al minuto aunque no tengas Discord abierto.',
    '',
    'En iPhone, primero agrega la página a tu pantalla de inicio (Safari → ' +
    'Compartir → Agregar a inicio). Se apagan o se cambian en la misma página.',
  ].join('\n'),

  drops: () => [
    '## `/drops` — tus Dragón Drops',
    'Cuántos tienes para abrir. El **Drop** y el **Star** se abren acá mismo; los Nidos y los cofres, en la página.',
    'Los que ganas compitiendo se abren siendo Miembro de DRA (`/vincular`).',
  ].join('\n'),
  billetera: () => [
    '## `/billetera` — tus Puntos de Tienda',
    'Cuántos tienes, lo cobrado cazando y lo que tienes en juego. Sólo lo ves tú.',
  ].join('\n'),
  inventario: () => [
    '## `/inventario` — lo tuyo de la Tienda',
    'Lo que compraste y lo que tienes puesto. Sólo lo ves tú.',
  ].join('\n'),
  equipar: () => [
    '## `/equipar` — ponerte algo de la Tienda',
    'Eliges el lugar (aro, nombre, carta, un fondo…) y después la pieza. Se ve en la página en unos minutos.',
  ].join('\n'),
  vincular: () => [
    '## `/vincular` — tu cuenta con tu perfil de la Liga',
    'Para que tus premios y tus drops sean tuyos: entras con Discord en la página y te suma a DRA.',
  ].join('\n'),
  website: () => [
    '## `/website` — la página de la Liga',
    'Te deja el link a la página: rankings, perfiles, llaves y calendario.',
  ].join('\n'),

  verificar: () => [
    '## `/verificar` — qué te falta para verificarte',
    'Mira en este momento, en Discord Rap Español, las tres cosas que hacen ' +
    'falta: estar en el servidor, el rol **Miembro** y un **país**. Te dice ' +
    'cuál falta y cómo arreglarlo. Verificado se abre tu **Servidor**; con tu ' +
    'primera Tarea del Pase, tu **Temporada**; y la Competitiva y la de País, ' +
    'con su requisito. Sin verificar, ninguna.',
    '',
    'El rol de Miembro lo da el bot solo, en su vuelta de cada media hora: no ' +
    'hace falta pedírselo a nadie.',
  ].join('\n'),

  ping: () => [
    '## `/ping` — ¿está vivo?',
    'Contesta desde el Worker y dice si la firma validó. Sirve para saber si ' +
    'el bot está andando cuando algo no responde.',
  ].join('\n'),

  help: () => [
    '## `/help`',
    'Esto. Con `comando:` te cuento uno en detalle, o lo eliges en el menú de abajo.',
  ].join('\n'),

  crew: () => [
    '## `/crew` — tu crew',
    '· **`/crew ver`** — tu crew (o la de quien elijas): cuántos son, el Líder y tu rango ahí.',
    '· **`/crew invitar`** — invita a alguien: le llega en el canal, con «Aceptar». También con click derecho en la ' +
    'persona → **Apps** → **Invitar a mi crew**.',
    '· **`/crew unirme`** — pide entrar a una crew por su nombre.',
    '· **`/crew link`** — un link para entrar directo, sin pedir permiso (para 1, 5 o 10 personas, dura 7 días).',
    '· **`/crew salir`** — te vas de tu crew. Después esperas 7 días para entrar a otra.',
    '',
    'Las crews se arman en la página: crear una cuesta Puntos de Tienda y son de los Miembros verificados de DRA, hasta 20.',
  ].join('\n'),

  setup: () => [
    '## `/setup` — sumar el servidor a la Liga',
    'Para los **admins** (Administrador o *Gestionar servidor*). En seis pasos: los permisos del bot, una plantilla ' +
    '(Liga completa · Lo básico · Sólo leer), tus canales, lo que hace el bot acá, ver todo y aplicar.',
    '',
    'No cambia nada en tu servidor hasta el paso 5, y no crea canales ni roles.',
  ].join('\n'),

  'borrar-mis-datos': () => [
    '## `/borrar-mis-datos` — borrar lo tuyo de la Liga',
    'Borra, ahora y para siempre, tu perfil, tus tarjetas, tu foto, tus redes, tus votos y el vínculo de tus avisos, y ' +
    'deja anotado que no te vuelva a sumar solo. Primero te pregunta, con dos botones.',
  ].join('\n'),
};

// 🧭 EL ÍNDICE EN GRUPOS Y UN MENÚ PARA CADA COMANDO (Dlx, 20/11/2026, la maqueta): hoy eran 1.289 letras en una lista.
// Elegir en el menú cambia ESTE mensaje (`hp:ver`). Suma `/crew` y «Invitar a mi crew», que no estaban.
const AYUDA_GRUPOS = [
  ['Tus cartas', ['card', 'versus'], 'y en el perfil de alguien, «Carta»'],
  ['Tu cuenta', ['verificar', 'vincular', 'foto', 'apodo', 'notify', 'borrar-mis-datos']],
  ['Tienda y drops', ['billetera', 'inventario', 'equipar', 'drops']],
  ['Crews', ['crew'], 'y en el perfil de alguien, «Invitar a mi crew»'],
  ['Para el staff', ['agendar', 'llave', 'afiche', 'settings', 'setup', 'antiraid']],
  ['La Liga', ['website', 'help', 'ping']],
];
//: lo que hace cada uno, en el menú (hasta 100 letras)
const AYUDA_CORTA = {
  card: 'tu tarjeta, o la de quien elijas', versus: 'quién gana entre dos, en la categoría que elijas',
  verificar: 'qué te falta para verificarte', vincular: 'tu cuenta con tu perfil de la Liga', foto: 'tu foto de Discord en tus tarjetas',
  apodo: 'cómo va tu apodo en los servidores', notify: 'los avisos de eventos en tu celular o compu',
  'borrar-mis-datos': 'borra tu perfil, tus tarjetas y tu foto', billetera: 'tus Puntos de Tienda', inventario: 'lo tuyo de la Tienda',
  equipar: 'ponerte algo de la Tienda', drops: 'tus Dragón Drops: el Drop y el Star se abren acá', crew: 'tu crew: verla, invitar, entrar o salir',
  agendar: 'un evento en el calendario de la Liga', llave: 'la última llave, como imagen', afiche: 'el afiche del último anuncio',
  settings: 'los ajustes del servidor (admins)', setup: 'sumar el servidor a la Liga, paso a paso (admins)',
  antiraid: 'el anti-raid del servidor (el dueño)', website: 'la página de la Liga', help: 'esto', ping: '¿está vivo?',
};
/** El menú de la ayuda, con `actual` elegido. */
const menuAyuda = (actual) => ({ type: COMP.FILA, components: [{ type: COMP.SELECT, custom_id: 'hp:ver',
  placeholder: 'Ver cómo se usa un comando', min_values: 1, max_values: 1,
  options: [{ label: 'El índice', value: 'indice', description: 'Todos los comandos, en grupos', default: actual === 'indice' }]
    .concat(AYUDA_GRUPOS.flatMap((g) => g[1]).filter((k) => AYUDA[k]).slice(0, 24)
      .map((k) => ({ label: '/' + k, value: k, description: String(AYUDA_CORTA[k] || '').slice(0, 100), default: k === actual }))) }] });
const enlacesAyuda = () => [botonLink('La página', HUB_URL + '/freestyle-rap/'), botonLink('La Guía', HUB_URL + '/freestyle-rap/guia')];
function ayudaIndice() {
  return ficha({ fam: 'ayuda', titulo: 'Liga Global en Discord', sub: 'Lo que puedes hacer con el bot. Elige un comando abajo para ver cómo se usa.',
    cuerpo: ['—', AYUDA_GRUPOS.map(([g, ks, extra]) => `**${g}** · ` + ks.map((k) => '`/' + k + '`').join(' · ') + (extra ? ' · ' + extra : ''))
      .join('\n')],
    filas: [menuAyuda('indice'), enlacesAyuda()] });
}
/** La página de un comando: su texto de `AYUDA`, con el mismo menú para ir a otro. */
function ayudaPagina(k, m) {
  const txt = AYUDA[k](m).replace(/^## /, '### ');
  return ficha({ fam: 'ayuda', cuerpo: [txt], filas: [menuAyuda(k), enlacesAyuda()] });
}

// ── /foto — la cara, congelada por temporada ──────────────────────────────
// 🔴 ESTO MATA EL BUG MAS VIEJO DEL PROYECTO. La columna `av` del Sheet
// guarda una URL del CDN con un hash que Discord invalida cuando la persona
// cambia su foto: medido, de 20 avatares quedaban 9 vivos. Guardada como
// archivo propio en R2, esa URL no vence nunca.
//
// ⚠️ Y EL WORKER NO NECESITA EL TOKEN DEL BOT PARA ESTO. El hash del avatar
// **viene en el payload que Discord firmó** (`member.user.avatar`). O sea
// que en el momento en que alguien corre un comando, el bot tiene delante su
// cara actual sin preguntarle a nadie.
// 🔴 NO SE ESCRIBE ACA: LA INYECTA `bot/desplegar.py` desde
// `comun/temporada.py`, que es el unico lugar. Escrita en los dos lados, el
// dia que arranque la T2 alguna se queda en 't1' y **no avisa** — sale una
// carta valida con la cara de la temporada pasada, que es la peor clase de
// error de este proyecto.
//
// ⚠️ El `|| 't1'` no es un segundo valor: es lo que hace que un despliegue
// viejo sin el binding siga andando en vez de escribir en `fotos/undefined/`.
const temporadaDe = (env) => (env && env.TEMPORADA) || 't1';

// ⚠️ EL AVATAR **GLOBAL**, NO EL DEL SERVIDOR. Discord manda los dos:
// `member.avatar` es el que se puso en ESE servidor y `user.avatar` es el
// suyo. La carta es una sola para los nueve servidores, así que la foto
// tiene que ser una sola — si saliera la del servidor, la misma persona
// tendría cuatro caras según dónde la miren.
const avatarDe = (i) => {
  const u = (i.member && i.member.user) || i.user || {};
  return { id: u.id, hash: u.avatar || null };
};

// ⚠️ SE PIDE `.webp` Y NO `.png`, y no es por el peso solo: es porque el
// Worker **no puede re-codificar**. Convertir una imagen son milisegundos de
// CPU y el presupuesto son 10. Discord la sirve ya en webp, así que esto es
// un caño: se baja y se guarda, sin abrir el archivo.
//
// ⚠️ `?size=1024` ES UN TOPE, NO UN PEDIDO. Medido el 20/09/2026: el CDN
// devuelve lo que la persona subió y no agranda. Konan sube a 256 y ahí se
// queda aunque se pida 4096.
//
// ⚠️ LA QUE GUARDA ESTO PESA MENOS QUE LA DEL LOTE, y está medido: la webp
// de Discord difiere 0,87–1,17/255 del PNG original y la de `bot/fotos.py`
// (PIL q90) difiere 0,55–0,71. Las dos por debajo del 1,24 que `a_webp.py`
// midió y que Dlx miró —«lo veo igual»—. Si alguna vez molesta,
// `python bot/fotos.py --bajar --todas` las normaliza a todas.
const urlAvatar = (id, hash) =>
  `https://cdn.discordapp.com/avatars/${id}/${hash}.webp?size=1024`;

// 🔴 LA SAL VA EN LA RUTA, Y SIN ELLA LA CARA DE CUALQUIERA SE BAJA
// SABIENDO SU NOMBRE. El bucket de R2 es **público** —tiene que serlo: las
// cartas se muestran en Discord y Discord las trae desde su proxy— así que
// `fotos/t1/<quien>.webp` era una URL adivinable a la cara de una persona.
//
// ⚠️ No es que la cara sea secreta: es su avatar de Discord. Lo que agregaba
// R2 es **permanencia y enlazabilidad**, una copia fuera de contexto que
// sobrevive a que la persona se vaya. Ver `comun/temporada.sal_fotos()`.
//
// ⚠️ Y ALCANZA CON QUE NO SE ADIVINE porque el bucket **no se enumera**:
// medido, pedir `/fotos/` devuelve 404.
//
// ⚠️ EL `|| ''` MANTIENE LA RUTA VIEJA si el binding no está, igual que
// `temporadaDe`. Un despliegue sin el valor escribe donde escribía antes en
// vez de crear una carpeta nueva y perder las caras.
// 📸 `claveFoto(env, quien, carta)` vive en avisos.js desde el 13/10/2026: la foto propia de cada carta la escribe el
// objeto, y la clave tiene que salir del mismo lugar para los dos
const claveUso = (env, quien) => `foto:${temporadaDe(env)}:${quien}`;

// El rol de DRA que deja cambiarla cuando quiera. Dlx, 20/09/2026.
const ROL_PASE = '1531136241171697807';
const tienePase = (i) =>
  !!(i.member && i.member.roles && i.member.roles.indexOf(ROL_PASE) >= 0);

/**
 * Bajar la cara de Discord, guardarla en R2 y anotar el uso de la temporada.
 * Lo usan `/foto` (`guardarFoto`) y la página (`cuentaFoto`): la misma regla y
 * el mismo guardado por las dos puertas. Devuelve lo que pasó, sin textos:
 * cada puerta lo cuenta a su manera.
 *
 * ⚠️ SE BAJA Y SE GUARDA EN STREAMING: `res.body` va directo a R2 sin pasar
 * por memoria ni por un decodificador. Esperar la red no gasta CPU; parsear
 * sí, y acá no se parsea nada.
 *
 * ⚠️ EL USO SE ANOTA **DESPUÉS** DE GUARDAR, y sólo si la temporada arrancó:
 * ver los comentarios de `guardarFoto`.
 */
async function fotoAR2(env, quien, id, hash, arranco) {
  let r;
  try {
    r = await fetch(urlAvatar(id, hash));
  } catch (e) {
    return { ok: false, paso: 'cdn', error: String(e).slice(0, 50) };
  }
  if (!r.ok) return { ok: false, paso: 'cdn', estado: r.status };
  try {
    await env.CARTAS.put(claveFoto(env, quien), r.body, {
      httpMetadata: { contentType: 'image/webp' },
    });
  } catch (e) {
    return { ok: false, paso: 'r2', error: String(e).slice(0, 60) };
  }
  // 📸 y tus cartas se redibujan ya con ella (13/11/2026): el objeto pide el redibujo como el Inventario. Nunca frena
  try {
    await env.AVISOS.get(env.AVISOS.idFromName('liga')).fetch('https://avisos/redibujo-foto', { method: 'POST',
      body: JSON.stringify({ quien: String(id) }), headers: { 'content-type': 'application/json' } });
  } catch (e) { /* queda para el ciclo, como antes */ }
  if (!arranco) return { ok: true, libre: true };
  try {
    // ⚠️ QUIEN YA TIENE SU USO ANOTADO NO SE VUELVE A ANOTAR: es el del pase de
    // DRA, que cambia cuando quiere. Cada anotación es una escritura de KV.
    if (await fotoUsada(env, quien)) return { ok: true, anotado: true };
    await env.KV.put(claveUso(env, quien), JSON.stringify({ hash, ts: Date.now() }));
  } catch (e) {
    return { ok: true, anotado: false, error: String(e).slice(0, 40) };
  }
  return { ok: true, anotado: true };
}

/**
 * 📸 TU CARTA SIN TU FOTO. Dlx, 01/10/2026, con la captura del `/card` de
 * MILICA (una «M» gigante donde iba su cara): «todavía hay algunas personas
 * sin su foto… en vez de que le aparezca esto, que le aparezca la opción, o
 * sea el link en un botón o como sea, para verificarse a través del website».
 *
 * Sólo a quien pide SU carta, y en un mensaje que ve sólo esa persona: la
 * carta pública no cambia. Tres casos:
 *   · sin verificar (`nv`) → la foto es de la cuenta, y la cuenta de los
 *     verificados (lo mismo que dice `/foto`): «verificate en la página»,
 *     con el botón
 *   · verificado y con foto en Discord → se la guarda ya. La primera NO
 *     gasta el cambio de la temporada (`fotoAR2(…, false)`): no es cambiar
 *     la foto, es la que el ciclo le tenía que haber guardado
 *   · verificado sin foto en Discord → que se ponga una: el ciclo la toma
 *     sola (`fotos.para_el_ciclo()`)
 *
 * 🔴 LA CAUSA ERA OTRA Y ESTÁ ARREGLADA APARTE: las fotos se bajaban a mano
 * y la última vez fue el 20/09, así que 24 verificados con foto en Discord
 * tenían la tarjeta con la inicial. Ahora es un paso del ciclo (2f).
 *
 * ⚠️ VA EN `waitUntil`: preguntarle a R2 no demora la carta. Y si algo falla
 * no dice nada: la carta ya salió, y el ciclo vuelve a intentar.
 */
async function avisoFoto(env, i, quien, g) {
  if (!env.CARTAS || !quien) return;
  // 🔴 sólo la cuenta de la Lista (`d:` o `dn:`): desde la cuenta EXTRA de alguien (`dx:`) esto guardaba el avatar de
  // ESA cuenta como la foto de la carta (revisión del 04/10/2026)
  const yo = idDe(i);
  try {
    if (!yo || !((await env.KV.get('d:' + yo)) || (await env.KV.get('dn:' + yo)))) return;
  } catch (e) {
    return;
  }
  try {
    if (await env.CARTAS.head(claveFoto(env, quien))) return;
  } catch (e) {
    return;
  }
  if (g && g.nv) {
    const v = comoVerificarse(aquiEs(i.guild_id));
    return seguir(i, '📸 Tu tarjeta va sin tu foto: la foto es de los verificados en ' +
                     'DRA. ' + v.texto, v.botones);
  }
  const { id, hash } = avatarDe(i);
  if (!hash) {
    return seguir(i, '📸 Tu tarjeta va con tu inicial porque no tienes foto en Discord. ' +
                     'Ponte una y el bot la toma sola en la próxima vuelta.');
  }
  const res = await fotoAR2(env, quien, id, hash, false);
  if (!res.ok) return;
  const vuelta = proximaVuelta(Date.now());
  // `<t:…:t>`: Discord la muestra en la hora de quien la lee
  // (con `vuelta` por si el redibujo no sale: el ciclo la toma igual)
  return seguir(i, '📸 Tu tarjeta no tenía tu foto: **ya la guardé**. Se vuelve a dibujar en unos minutos' +
                   (vuelta ? ' (a más tardar a las <t:' + Math.floor(vuelta.getTime() / 1000) + ':t>)' : '') + '.');
}

// 🔑 HASTA CUÁNDO LA FOTO ES LIBRE: el instante que `bot/desplegar.py` saca
// de `comun/temporada.py` (`FOTO_LIBRE`). Dlx, 25/09/2026: «Sí. O sea hay
// cambios ilimitados hasta el 9». Sin el binding, 0: la regla de antes.
const libreHasta = (env) => Date.parse((env && env.FOTO_LIBRE_HASTA) || '') || 0;
const libreHastaTexto = (env) => {
  const t = libreHasta(env);
  // ⚠️ SÓLO MIENTRAS CORRE: después del 9/10 la foto también es libre si el
  // pool está vacío (el reset del 5/10), y ahí «hasta el 9 de octubre» mentía
  if (!t || Date.now() >= t) return '';
  try {
    return new Intl.DateTimeFormat('es', { timeZone: 'America/New_York', day: 'numeric',
      month: 'long' }).format(new Date(t - 60000));
  } catch (e) {
    return '';
  }
};

/** ¿Ya usó su cambio de la temporada? Ver `/foto`.
 *
 * ⚠️ SÓLO CUENTA EL QUE SE HIZO CON EL LÍMITE RIGIENDO. Durante la fase de
 * prueba el límite ya corría —el 25/09/2026 había dos marcas, dlx y makmah—
 * y Dlx decidió que hasta el fin de la ventana libre (`FOTO_LIBRE` en
 * comun/temporada.py: el 16/10 desde que el arranque pasó al 12) es libre: esas marcas no gastan nada. Una
 * marca sin fecha sí cuenta: ante la duda, el lado conservador. */
async function fotoUsada(env, quien) {
  const v = await env.KV.get(claveUso(env, quien));
  if (!v) return false;
  let ts = 0;
  try { ts = Number(JSON.parse(v).ts) || 0; } catch (e) { ts = 0; }
  return !(ts && ts < libreHasta(env));
}

/** `meta.arrancada`: ¿rige el límite de una foto por temporada? Ver `/foto`. */
async function temporadaArrancada(env) {
  // 🔑 el cambio libre de Dlx: hasta esa fecha, no rige
  if (Date.now() < libreHasta(env)) return false;
  try {
    const m0 = await env.KV.get('meta');
    return m0 ? (JSON.parse(m0).arrancada !== false) : true;
  } catch (e) {
    return true;   // ante la duda, rige: es el lado conservador
  }
}

async function guardarFoto(env, i, quien, id, hash) {
  //
  // 🔴 TODO ESTO CORRE ADENTRO DE UN `waitUntil`, Y AHI UN ERROR NO LO VE
  // NADIE. Sin los try/catch de abajo, un fallo del CDN, de R2 o de la
  // cuota de KV dejaba a la persona mirando «está pensando…» **para
  // siempre**: la respuesta diferida nunca se contestaba y Discord terminaba
  // diciendo que la aplicación no respondió. No hay log que mirar —los del
  // Worker no salen de Cloudflare en el plan gratis— así que el único lugar
  // donde el error puede aparecer es en el mensaje a la persona.
  const arranco0 = await temporadaArrancada(env);
  const res = await fotoAR2(env, quien, id, hash, arranco0);
  if (!res.ok && res.paso === 'cdn' && res.error) {
    return V.avisoMsg('No pude llegar al CDN de Discord (`' + res.error + '`). Prueba de nuevo en un rato.');
  }
  if (!res.ok && res.paso === 'cdn') {
    // 🔴 PASA DE VERDAD, Y NO ES UN ERROR NUESTRO. Medido el 20/09/2026:
    // `ropomc` tiene un hash que la lista de miembros de Discord devuelve y
    // que el CDN ya no sirve — 404 en los cuatro formatos. O sea que ni el
    // dato fresco de Discord garantiza un hash vivo.
    return V.avisoMsg('Discord no me dio tu foto (`' + res.estado + '`).\nSuele arreglarse volviéndotela a poner en Discord y ' +
      'probando de nuevo.');
  }
  if (!res.ok) {
    return V.avisoMsg('No pude guardar tu foto (`' + res.error + '`). Prueba de nuevo en un rato — **no te gasté** el ' +
      'cambio de la temporada.');
  }
  // ⚠️ EL SELLO SE ESCRIBE **DESPUES** DE GUARDAR (`fotoAR2()`): al revés, un fallo del CDN le gastaría a la persona su
  // único cambio de la temporada sin haberle cambiado nada. 🔴 Y su fallo se cuenta aparte: la foto **ya está guardada**
  // y lo único que no quedó es la marca. 🔴 Y NO SE ANOTA SI LA TEMPORADA NO ARRANCÓ (`res.libre`): quien acomoda su
  // perfil ahora empezaría la T1 con su cambio ya gastado.
  // 🙂 la foto recién guardada, al costado (`?v=` del momento: Discord guarda las imágenes por dirección)
  const yo = await personaDe(env, id);
  const f = (titulo, sub, cuerpo) => ficha({ fam: 'cuenta', color: colorRango(yo.m, yo.g && yo.g.rg), titulo, sub, cuerpo,
    cara: env.CARTAS ? `${R2}/${claveFoto(env, quien)}?v=${Date.now()}` : '' });
  if (res.libre) {
    const hasta = libreHastaTexto(env);
    return f('Tu foto quedó guardada 📸', hasta
      ? 'Hasta el **' + hasta + '** puedes cambiarla las veces que quieras.'
      : 'La temporada todavía no arrancó, así que puedes cambiarla las veces que quieras hasta que empiece.');
  }
  if (!res.anotado) {
    return f('Tu foto quedó guardada 📸', null, ['⚠️ Pero no pude anotar que ya usaste tu cambio de la temporada (`' + res.error +
      '`), así que `/foto` te va a dejar cambiarla de nuevo. Avísale a Dlx.']);
  }
  return f('Listo: ésa es tu foto de la ' + temporadaDe(env).toUpperCase() + ' 📸', 'Se ve la próxima vez que se dibujen tus cartas.',
    ['Queda **congelada**: aunque cambies la de Discord, tus cartas de esta temporada siguen con ésta.']);
}

// ── /owner — lo GLOBAL, y sólo Dlx ────────────────────────────────────────
// ⚠️ NO SE LLAMA `/config`, Y EL MOTIVO NO ES EL NOMBRE. Dlx, 20/09/2026:
// *«eso de config es para los admins de cada server. Esos son configuraciones
// locales para el servidor. Esto de la liga global es algo global. Ponlo como
// /owner y solo yo»*. `/settings` ya es lo de cada servidor; dos comandos
// parecidos con alcances distintos es exactamente cómo alguien termina
// tocando algo global creyendo que toca lo suyo.
// 🔒 `DUENO` viene de avisos.js: el mismo para `/owner` y para el Dashboard

// ⚠️ `default_member_permissions` NO ES EL CANDADO: ES LA CORTINA. Esconde el
// comando de la lista a quien no es admin y nada más — en un mensaje directo
// no se aplica, y el admin de cualquier servidor lo vería igual. El control
// es esta comparación, del lado del Worker, contra el ID que **Discord
// firmó**. Por eso vive acá y no en el registro.
const esDueno = (i) => idDe(i) === DUENO;

const marca = (sello) => {
  // `sello` viene como AAAAMMDDHHMM en UTC (`subir_datos.py`), y se muestra
  // en hora del este, como todo lo que lee Dlx. Antes salía la hora UTC
  // pelada, sin decir que lo era: cuatro horas de diferencia sin aviso.
  const t = String(sello || '');
  if (t.length !== 12) return '(sin sello)';
  return horaEste(`${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T` +
                  `${t.slice(8, 10)}:${t.slice(10, 12)}:00Z`) || '(sin sello)';
};

const tablaRg = (u) => (u || []).map((x) => `${x[0]} ${x[1]}`).join(' · ');

function panelRangos(m) {
  const r = m && m.rangos;
  if (!r) {
    // ⚠️ NO SE INVENTA LA TABLA. Si `meta.rangos` no está es que el pipeline
    // todavía no corrió desde que se agregó — y escribir los ocho a mano acá
    // sería crear la quinta copia, que es el error que este panel existe para
    // cerrar.
    return ['_Todavía no hay `rangos` en KV._',
            'Salen de `comun/rangos.py` en la próxima corrida de ' +
            '`bot/subir_datos.py`.'].join('\n');
  }
  return [
    '## Los rangos — la fuente son los **ocho**',
    '```',
    'la carta   ' + tablaRg(r.umbral) + ' · E resto',
    'el Sheet   ' + tablaRg(r.viejo) + ' · E resto',
    '```',
    r.desfase
      ? `🔴 **${r.desfase} personas** ven una letra en el ranking y **otra en ` +
        'su carta**.'
      : '✅ Nadie ve una letra distinta: el Sheet y la carta coinciden.',
    '',
    '⚠️ Ese número **no está escrito acá**: se vuelve a medir en cada corrida ' +
    'del pipeline. Baja solo cuando el Sheet adopte los ocho, y vuelve a ' +
    'subir solo si alguien los separa.',
    '',
    '**Dónde vive el rango** _(al 20/11/2026 — desde acá el bot no puede mirar los roles: los pregunta ' +
    '`herramientas/roles_de_rango.py` en la auditoría semanal)_',
    '· ✅ `comun/rangos.py` — la fuente, con los ocho y sus colores',
    '· ✅ las cuatro cartas y los mensajes del bot — salen de ahí',
    '· ✅ la columna `Rango` de las vitrinas — se calcula (`rankings.rangos_de()`), con la puerta de 10 eventos',
    '· ✅ **los roles de Discord** — los ocho, de `Rango SSS` a `Rango E` (verificado el 23/09/2026)',
    '· ✅ `Index.html` del Apps Script — retirado el 24/09/2026: manda a la página',
    '· ⬜ la Guía vieja del Sheet — seis tramos; la de la página ya dice ocho',
    '',
    '⚠️ Si alguna vez se mueven los umbrales, va **antes** de que arranque una temporada: a mitad serían personas viendo ' +
    'cambiar su letra sin haber competido.',
  ].join('\n');
}

function panelEstado(m, disp) {
  if (!m || !m.sello) return '_No pude leer `meta` de KV._';
  // ⚠️ EL SELLO YA NO ES «EL ÚLTIMO PIPELINE»: desde el 25/09/2026 `meta` no
  // se reescribe si la corrida no subió cartas (ver `subir_datos.py`,
  // `--mismas-cartas`). Lo que dice si el ciclo está vivo es el disparador,
  // que vive en el Durable Object (`marcarDisparo()`).
  const u = disp && disp.ultimo;
  const L = [
    '## La Liga, ahora mismo',
    '```',
    `cartas al día del   ${marca(m.sello)}`,
    `último disparo      ${u && u.t ? horaEste(u.t) + (u.ok ? ' · ok' : ' · FALLÓ ' + (u.estado || '')) : '(sin dato)'}`,
    `personas con carta  ${m.gente != null ? m.gente : '?'}`,
    `con Discord ID      ${m.con_id != null ? m.con_id : '?'}` +
      (m.gente && m.con_id != null ? `  (${Math.round(100 * m.con_id / m.gente)} %)` : ''),
    '```',
  ];
  if (m.con_id != null && m.gente && m.con_id < m.gente) {
    // ⚠️ ESTE ES EL NÚMERO QUE DECIDE SI `/card quien:@alguien` ANDA. Sin ID
    // el selector no los encuentra y sólo llegan escribiendo el nombre.
    L.push(`⚠️ A **${m.gente - m.con_id}** no los encuentra el selector de ` +
           '`/card quien:` — sólo por nombre.');
  }
  L.push('', '**Los requisitos que hay en KV**', requisitos(m));
  if (m.svs && m.svs.length) {
    L.push('', '**Servidores con su carta arriba**  ' + m.svs.join(' · '));
  }
  if (m.bot_en && m.bot_en.length) {
    L.push('**El bot es miembro de**  ' + m.bot_en.join(' · '));
  }
  return L.join('\n');
}

// ── /borrar-mis-datos ──────────────────────────────────────────────────
// 🔑 Dlx, 27/09/2026: «podríamos hacer un comando para delete-my-data». Es lo
// que promete la política de privacidad (underlegends.pages.dev/privacidad.html):
// cada uno borra lo suyo sin tener que pedírselo a nadie.
//
// ⚠️ PRIMERO PREGUNTA, CON DOS BOTONES. Borrar no se deshace, y un comando se
// aprieta sin querer. El estado va entero en el `custom_id`, como en el resto
// de los botones: `baja:si::<id>` o `baja:no::<id>`.
export function panelBaja(id) {
  // 🟥 EL ÚNICO RECUADRO ROJO DEL BOT, Y SIN FRANJA (Dlx, 20/11/2026, la maqueta): es lo único que no se deshace
  return V.mensaje({ color: V.COLOR.rojo, efimero: true, dentro: [
    V.T('### Borrar tus datos de la Liga\n-# Ahora y para siempre: no se puede deshacer.'),
    V.SEP,
    V.T('Esto borra:\n' +
      '- tu perfil y tus tarjetas (también las de cada servidor),\n' +
      '- tu foto de las tarjetas,\n' +
      '- tus redes guardadas, tus votos en las encuestas, a quién felicitaste y el vínculo de tus avisos.\n\n' +
      'Además queda anotado que **no te vuelva a sumar solo**. Tus resultados en ' +
      'eventos quedan en el historial de la Liga; si quieres que cambiemos tu ' +
      'nombre ahí, pídeselo a un admin.\n' +
      '-# Si después quieres volver, también se lo pides a un admin.'),
  ], filas: [[
    { type: COMP.BOTON, style: ESTILO.PELIGRO, label: 'Borrar mis datos', custom_id: `baja:si::${id}` },
    { type: COMP.BOTON, style: ESTILO.SECUNDARIO, label: 'Cancelar', custom_id: `baja:no::${id}` },
  ]] });
}

/**
 * Borra lo de esa persona y la anota como baja. Devuelve lo que borró.
 *
 * ⚠️ EL ID SALE DE LA INTERACCIÓN FIRMADA, nunca de un texto: nadie puede
 * borrar a otro.
 *
 * ⚠️ LA MARCA `olvido:<id>` ES LO QUE DURA. El ciclo la lee en cada corrida
 * (`bot/olvidar.py traer()`) y el portón deja afuera a quien la tiene
 * (`verificados.pasa()`): sin ella, la corrida siguiente le volvería a dibujar
 * todo. Va SIN nombre: para no sumarlo alcanza con el ID.
 *
 * ⚠️ R2 SE BUSCA LISTANDO, no armando la clave: una persona puede tener sus
 * cartas bajo una grafía vieja de su nombre (ver `bot/olvidar.py`). Las cartas
 * viven en `<clave>/…` y la foto en `fotos/<…>/<clave>.webp`.
 */
export async function borrarMisDatos(env, id) {
  const hecho = { clave: '', kv: 0, r2: 0, avisos: null };
  // 🔴 Y TAMBIÉN `dn:`. Desde las LIBRES (29/09/2026) quien está en la Lista
  // sin verificar tiene sus cartas bajo `dn:<id>`, y esto leía sólo `d:`: no
  // encontraba su clave y no borraba nada en el momento, aunque el mensaje
  // decía que sí. Lo encontró la auditoría legal del 01/10.
  // 🔴 LA BAJA PRIMERO (revisión del 04/10/2026): se escribía al final, y si algo fallaba en el medio —R2 no contesta,
  // se pasan los 3 s de Discord— la corrida siguiente volvía a sumar a la persona que había pedido salir
  await env.KV.put('olvido:' + id, JSON.stringify({ t: Date.now() }));
  const [cd, cdn] = await Promise.all([env.KV.get('d:' + id), env.KV.get('dn:' + id)]);
  // ⚠️ SÓLO LA CUENTA DE LA LISTA (`d:` o `dn:`). La cuenta EXTRA de alguien (`dx:`, la segunda de Monet) borra su
  // llave y nada más: el perfil, las cartas y la foto son de la otra cuenta, que no pidió nada
  const clave = cd || cdn;
  hecho.clave = clave || '';
  const kv = ['d:' + id, 'dn:' + id, 'dx:' + id];
  if (clave) kv.push('p:' + clave, 'redes:' + clave, claveUso(env, clave));
  for (const k of kv) {
    try { await env.KV.delete(k); hecho.kv++; } catch (e) { /* se sigue con lo demás */ }
  }
  if (clave && env.CARTAS) {
    try {
      const borrar = [];
      let cursor;
      do {
        const l = await env.CARTAS.list({ prefix: clave + '/', cursor, limit: 1000 });
        for (const o of l.objects) borrar.push(o.key);
        cursor = l.truncated ? l.cursor : undefined;
      } while (cursor);
      // la foto, una por temporada: las carpetas de `fotos/` (pocas) y su archivo, sin listar todas las fotos
      const ts = await env.CARTAS.list({ prefix: 'fotos/', delimiter: '/' });
      for (const t of ts.delimitedPrefixes || []) {
        if (await env.CARTAS.head(t + clave + '.webp')) borrar.push(t + clave + '.webp');
      }
      for (let j = 0; j < borrar.length; j += 1000) {
        await env.CARTAS.delete(borrar.slice(j, j + 1000));
      }
      hecho.r2 = borrar.length;
    } catch (e) { hecho.r2 = 0; }
  }
  // 🧠 y sus datos de /card, que viven en el objeto desde el 06/10/2026: le pasa la clave para que los borre
  hecho.avisos = await olvidarAvisos(env, id, clave);
  return hecho;
}

// ── 🧰 EL KIT DEL ORGANIZADOR: /afiche y /llave (Dlx, 12/10/2026: «crear un comando ÚNICAMENTE para aquellos que tienen
// rol de staff u organizador en cada servidor»). El Worker no dibuja —no corre Chromium—: contesta «lo estoy armando»,
// guarda en el objeto el permiso para editar ESA respuesta y prende `.github/workflows/kit.yml`, que dibuja con
// `bot/kit.py` y le devuelve la imagen al objeto (`kitListo()`). ⚠️ EL PERMISO NO VIAJA A LA TAREA: el repo es público
// y sus datos de entrada se ven desde afuera; con él, cualquiera podría escribir como ULAYA en ese canal.
const ROLES_STAFF = /staff|organiz|moderad|\bmods?\b|admin|host|jurad|evento/i;
const _rolesCache = new Map();
async function rolesDe(gid, env) {
  const c = _rolesCache.get(gid);
  if (c && Date.now() - c.t < 10 * 60000) return c.r;
  try {
    const r = await fetch(`https://discord.com/api/v10/guilds/${gid}/roles`, { headers: { Authorization: 'Bot ' + env.DISCORD_TOKEN } });
    if (!r.ok) return c ? c.r : [];
    const roles = await r.json();
    _rolesCache.set(gid, { t: Date.now(), r: Array.isArray(roles) ? roles : [] });
    return Array.isArray(roles) ? roles : [];
  } catch (e) { return c ? c.r : []; }
}
// staff: Dlx, un permiso de staff (admin, gestionar servidor o gestionar mensajes), o un rol que lo diga en el nombre
// —los nombres van en negrita matemática en DRA («𝐑𝐚𝐧𝐠𝐨»): NFKD antes de buscar—
async function esStaff(i, env) {
  if (idDe(i) === DUENO) return true;
  const p = BigInt((i.member && i.member.permissions) || '0');
  if ((p & 8n) !== 0n || (p & 32n) !== 0n || (p & 8192n) !== 0n) return true;
  const mios = new Set((i.member && i.member.roles) || []);
  if (!mios.size || !env.DISCORD_TOKEN) return false;
  const roles = await rolesDe(i.guild_id, env);
  return roles.some((r) => mios.has(r.id) && ROLES_STAFF.test(String(r.name || '').normalize('NFKD')));
}
async function kit(i, env, ctx, tipo) {
  const sv = aquiEs(i.guild_id);
  if (!sv) return aviso('`/' + tipo + '` funciona en los servidores de la Liga.');
  if (!(await esStaff(i, env))) return aviso('`/' + tipo + '` es para el staff y los organizadores del servidor.');
  if (!env.GH_TOKEN || !env.GH_REPO || !env.AVISOS) return aviso('Ahora no puedo armarla: prueba en un rato.');
  const id = [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join('');
  // 🧱 en V2 y con el color del servidor (20/11/2026): el primer mensaje ya lo es, así la imagen de `kitListo()` (avisos.js)
  // sólo reemplaza piezas. Sin franja: cuando llega, la imagen es la portada
  const color = colorChat(sv);
  const msg = (txt) => V.mensaje({ color, efimero: false, dentro: [V.T(txt)] });
  const editar = (txt) => editarOriginal(i, msg(txt));
  const armando = '🧰 Armando ' + (tipo === 'afiche' ? 'el afiche del último anuncio' : 'la última llave') + ' de ' + sv +
    '… en uno o dos minutos aparece acá.';
  luego(ctx, (async () => {
    try {
      const g = await env.AVISOS.get(env.AVISOS.idFromName('liga')).fetch('https://avisos/kit', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, token: i.token, app: i.application_id, tipo, sv }),
      });
      const gd = await g.json().catch(() => ({}));
      if (gd.error === 'espera') return editar('Ya hay una en camino en este servidor: espera un minuto y pídela de nuevo.');
      if (!gd.ok) return editar('Ahora no puedo armarla: prueba en un rato.');
      const r = await fetch(`https://api.github.com/repos/${env.GH_REPO}/actions/workflows/kit.yml/dispatches`, {
        method: 'POST',
        headers: { 'User-Agent': 'liga-global-bot', Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + env.GH_TOKEN,
          'content-type': 'application/json' },
        body: JSON.stringify({ ref: 'main', inputs: { tipo, sv, id } }),
      });
      if (r.status !== 204) return editar('Ahora no puedo armarla: prueba en un rato.');
      return null;
    } catch (e) { return editar('Ahora no puedo armarla: prueba en un rato.'); }
  })());
  return responderV2(RESPONDE.MENSAJE, msg(armando));
}

// ── 📅 /agendar (Dlx, 12/10/2026, «5. D»: «casi no hay eventos futuros… la mayoría anuncian eventos instantáneos»).
// El staff de un servidor agenda un evento con día, hora y el país de esa hora; queda en el objeto (`agendar()`), el
// ciclo lo pasa al calendario como un anuncio más (`bot/agenda.py`) y, con 12 horas o más, suma +10 %.
// ⚠️ LAS ZONAS SON LAS DE `cuando.ZONA_BANDERA` (bot/cuando.py), más el este de Estados Unidos
export const ZONAS_AGENDA = { AR: 'America/Argentina/Buenos_Aires', BO: 'America/La_Paz', CL: 'America/Santiago', CO: 'America/Bogota', CR: 'America/Costa_Rica', CU: 'America/Havana', DO: 'America/Santo_Domingo', EC: 'America/Guayaquil', ES: 'Europe/Madrid', GT: 'America/Guatemala', HN: 'America/Tegucigalpa', MX: 'America/Mexico_City', NI: 'America/Managua', PA: 'America/Panama', PE: 'America/Lima', PR: 'America/Puerto_Rico', PY: 'America/Asuncion', SV: 'America/El_Salvador', UY: 'America/Montevideo', VE: 'America/Caracas', US: 'America/New_York' };
/** El instante UTC (ms) de `d/m` a `h:mi` en la zona `z`, del año que corresponda (el próximo si esa fecha ya pasó). */
export function utcDeZona(dia, mes, h, mi, z, ahora = Date.now()) {
  const enZona = (ms) => {
    const p = {};
    new Intl.DateTimeFormat('en-US', { timeZone: z, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric',
      minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date(ms)).forEach((x) => { p[x.type] = Number(x.value); });
    return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute);
  };
  const año = new Date(ahora).getUTCFullYear();
  for (const y of [año, año + 1]) {
    const pared = Date.UTC(y, mes - 1, dia, h, mi);
    let t = pared - (enZona(pared) - pared);
    t -= enZona(t) - pared;                            // una segunda vuelta por si el cambio de hora cae en el medio
    if (t > ahora - 3 * 3600000) return t;
  }
  return null;
}

// ── 👥 LAS CREWS EN EL BOT (Dlx, 19/10/2026: «en la página principalmente, pero también en el bot») ─────────────────────
// Lo rápido: ver una crew, invitar, pedir entrar y salir. Armarla y manejarla (rangos, representantes, cómo se entra)
// es de la página. Las reglas son las de bot/crews.js —el objeto decide—; acá sólo se arma el pedido con quién sos
// (Discord lo firma) y tu perfil (`d:`, sólo verificados).
// 🔑 LA INVITACIÓN SALE EN EL CANAL, con botones que sólo el invitado puede tocar (`cw:si|no:<crew>:<su id>`): el bot no
// manda DMs. Se lo menciona —eso sí le suena— y nadie más puede aceptar por él.
const ERRORES_CREW = {
  verificate: 'Las crews son de los Miembros de Discord Rap Español: primero verifícate (`/verificar`).',
  ya_en_crew: 'Ya está en esa crew.',
  no_recibe: 'Esa persona no recibe invitaciones mientras está en su crew.',
  no_verificado: 'Esa persona todavía no es Miembro verificado de DRA: las crews son sólo de verificados.',
  espera: 'Saliste de una crew hace poco: hay que esperar 7 días para entrar a otra.',
  llena: 'La crew está llena: son 20 como máximo.',
  solo_invitacion: 'A esa crew se entra sólo por invitación.',
  sin_invitacion: 'Esa invitación ya no está (vencen a la semana).',
  rol: 'Tu rango en la crew no te deja hacer eso.',
  lider_pasa_primero: 'Eres el Líder: antes de irte (o de cambiarte de crew), pásale el liderazgo a alguien desde la página de tu crew.',
  sin_crew: 'No estás en ninguna crew.',
  no_existe: 'Esa crew ya no existe.',
  espera_dia: 'Ya hiciste mucho de esto hoy: prueba mañana.',
  links_max: 'Tu crew ya tiene 5 links abiertos: borra uno desde la página de la crew para armar otro.',
  saldo: 'No te alcanzan los Puntos de Tienda.',
};
const textoCrew = (j) => ((j && j.error) === 'requisitos' ? 'Esa crew pide ' + (j.falta || []).join(' y ') + ': todavía no llegas.'
  : ERRORES_CREW[(j && j.error) || ''] || 'Ahora no pude: prueba en un rato.');
const urlCrew = (id) => HUB_URL + '/freestyle-rap/crew/' + encodeURIComponent(id);
const publicoConMencion = (data) => new Response(JSON.stringify({ type: RESPONDE.MENSAJE, data }),
  { headers: { 'content-type': 'application/json' } });

async function crewAvisos(env, ruta, cuerpo) {
  const objeto = env.AVISOS.get(env.AVISOS.idFromName('liga'));
  const r = await objeto.fetch('https://avisos' + ruta, cuerpo ? {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo),
  } : undefined);
  return r.json().catch(() => ({}));
}
async function crewPerfil(env, id) {
  try { const k = await env.KV.get('d:' + id); return claveValida(k) ? k : ''; } catch (e) { return ''; }
}
async function crewNombre(env, k) {
  try { const p = JSON.parse((await leerP(env, k)) || 'null'); if (p && p.n) return String(p.n).replace(/[`*_~|<>@]/g, ''); } catch (e) { /* la clave */ }
  return k;
}
const crewDeK = (todas, k) => ((todas && todas.crews) || []).find((c) => (c.gente || []).some((g) => g[0] === k)) || null;
/** ⏳ La primera semana de una crew nueva (bot/crews.js `crewVencer()`), en una línea: la hora la pone Discord, en la de
 *  quien lee. `''` si ya quedó o es de la Liga. */
function crewSemana(c, todas) {
  if (!c || !c.vence) return '';
  const falta = Math.max(0, 1 + (((todas && todas.prueba) || {}).sumar || 2) - (c.gente || []).length);
  const s = Math.floor(c.vence / 1000);
  return '\n⏳ Crew nueva: le falta' + (falta === 1 ? ' 1 persona' : 'n ' + falta + ' personas') + ' antes del <t:' + s + ':f> (<t:' + s +
    ':R>) o se borra.';
}

// 🎨 EL COLOR DE UNA CREW: el primero de su escudo armado (`esc:forma.simbolo.aaaaaa…`, bot/crews.js); sin escudo, el
// verde de la Liga. 🛡️ Y SU LOGO AL COSTADO sólo si es una imagen (el escudo armado lo dibuja la página: acá no hay
// imagen, así que no va: sin dato no hay pieza)
const colorCrew = (c) => {
  const m = /^esc:[a-z]+\.[a-z]+\.([0-9a-f]{6})\./.exec(String((c && c.logo) || ''));
  return m ? parseInt(m[1], 16) : V.COLOR.verde;
};
const logoCrew = (c) => (/^https:\/\//.test(String((c && c.logo) || '')) ? String(c.logo) : '');
const linkCrew = (mia, r) => ficha({ fam: 'crews', color: colorCrew(mia), acc: V.mini(logoCrew(mia)),
  titulo: 'Tu link para entrar a ' + mia.nombre,
  sub: (r.max ? 'Para ' + r.max + (r.max === 1 ? ' persona' : ' personas') : 'Hasta que se llene') + ', dura 7 días. Con este link se ' +
    'entra directo, sin pedir permiso.',
  cuerpo: [urlCrew(mia.id) + '?u=' + r.cod], filas: [[botonLink('Abrir', urlCrew(mia.id) + '?u=' + r.cod)]] });

async function crewComando(i, env, sub, op) {
  const id = idDe(i);
  if (!id) return aviso('No pude saber quién eres.');
  const esperar = frenado(id, 'comando');
  if (esperar) return espera(esperar);
  if (!env.AVISOS) return aviso('Ahora no puedo: prueba en un rato.');
  const de = await crewPerfil(env, id);
  const todas = await crewAvisos(env, '/crews');
  const lasCrews = [{ type: 2, style: 5, label: 'Las crews', url: HUB_URL + '/freestyle-rap/ranking/crews' }];
  if (sub === 'ver') {
    const t = op.quien || id;
    const k = t === id ? de : await crewPerfil(env, t);
    const c = k ? crewDeK(todas, k) : null;
    if (!c) {
      return responderV2(RESPONDE.MENSAJE, ficha({ fam: 'crews', titulo: t === id ? 'No estás en ninguna crew' : 'Sin crew',
        sub: (t === id ? '' : '<@' + t + '> no está en ninguna crew. ') + 'Las crews se arman en la página.', filas: [lasCrews] }));
    }
    const lid = (c.gente.find((g) => g[1] === 'lider') || [])[0];
    const rol = (c.gente.find((g) => g[0] === k) || [])[1] || '';
    const ROL = { lider: 'Líder', colider: 'Colíder', veterano: 'Veterano', miembro: 'Miembro' };
    // 🧱 la maqueta: el escudo al costado y los números en una línea; «Mi link para entrar», si la crew es la tuya
    return responderV2(RESPONDE.MENSAJE, ficha({ fam: 'crews', color: colorCrew(c), acc: V.mini(logoCrew(c)),
      cabeza: '### ' + c.nombre + (c.sigla ? '  `' + c.sigla + '`' : '') + '\n' + c.gente.length + ' de ' + (todas.max || 20) +
        (lid ? ' · Líder: **' + (await crewNombre(env, lid)) + '**' : '') + (c.desc ? '\n> ' + c.desc : '') +
        (rol ? '\n-# ' + (t === id ? 'Eres ' : '<@' + t + '> es ') + ROL[rol] + '.' : '') + crewSemana(c, todas),
      filas: [[{ type: 2, style: 5, label: 'Ver la crew', url: urlCrew(c.id) },
        t === id && rol ? V.boton('Mi link para entrar', 'cw:link:1:' + id, ESTILO.SECUNDARIO) : null]] }));
  }
  if (sub === 'invitar') {
    const t = String(op.quien || '');
    if (!t) return aviso('¿A quién?');
    if (t === id) return aviso('No te puedes invitar a ti.');
    if (!de) return aviso(ERRORES_CREW.verificate);
    const mia = crewDeK(todas, de);
    if (!mia) return aviso('No estás en ninguna crew: arma la tuya en la página.', [{ type: 2, style: 5, label: 'Mi crew', url: HUB_URL + '/cuenta/crew' }]);
    const a = await crewPerfil(env, t);
    if (!a) return aviso('<@' + t + '> todavía no está verificado: las crews son de los Miembros de Discord Rap Español.');
    const r = await crewAvisos(env, '/crew', { accion: 'invitar', quien: id, de, a });
    if (!r.ok) return aviso(textoCrew(r));
    if (r.ya) return aviso('Ya invitaste a <@' + t + '>: la invitación sigue en pie una semana.');
    if (!r.invitado) return aviso('✅ <@' + t + '> ya había pedido entrar: entró a **' + mia.nombre + '**.');
    // (pública y con la mención: es la única forma de que le llegue sin un DM. La mención va ARRIBA y AFUERA del
    // recuadro, y es la única que suena: `allowed_mentions` la nombra a ella sola)
    return publicoConMencion(ficha({ fam: 'crews', efimero: false, color: colorCrew(mia), acc: V.mini(logoCrew(mia)),
      arriba: ['<@' + t + '>'], menciones: { users: [t] },
      cabeza: '### ' + (await crewNombre(env, de)) + ' te invita a ' + mia.nombre + '\n-# Crew' + (mia.sigla ? ' `' + mia.sigla + '`' : '') +
        ' · ' + mia.gente.length + ' de ' + (todas.max || 20) + ' · tienes una semana para contestar',
      filas: [[
        { type: 2, style: ESTILO.PRIMARIO, label: 'Aceptar', custom_id: ('cw:si:' + mia.id + ':' + t).slice(0, 100) },
        { type: 2, style: ESTILO.SECUNDARIO, label: 'No, gracias', custom_id: ('cw:no:' + mia.id + ':' + t).slice(0, 100) },
        { type: 2, style: 5, label: 'Ver la crew', url: urlCrew(mia.id) },
      ]] }));
  }
  if (sub === 'unirme') {
    if (!de) return aviso(ERRORES_CREW.verificate);
    const q = normCrew(op.nombre);
    const c = ((todas && todas.crews) || []).find((x) => normCrew(x.nombre) === q || normCrew(x.id) === q);
    if (!c) return aviso('No encontré una crew con ese nombre.', lasCrews);
    // 🔴 YA EN OTRA CREW (encontrado al capturar, 20/11/2026): el objeto contesta `ya_en_crew` y se le decía «Ya está en
    // esa crew.», el texto de invitar, en tercera persona y con la crew equivocada. Se dice cuál es la tuya y qué hacer
    const mia = crewDeK(todas, de);
    if (mia) {
      return aviso(mia.id === c.id ? 'Ya estás en **' + c.nombre + '**.'
        : 'Ya estás en **' + mia.nombre + '**: para entrar a **' + c.nombre + '**, primero sal de la tuya con `/crew salir`.');
    }
    const r = await crewAvisos(env, '/crew', { accion: 'pedir', quien: id, de, crew: c.id });
    if (!r.ok) return aviso(r.error === 'ya_en_crew' ? 'Ya estás en una crew: para entrar a otra, primero sal de la tuya con `/crew salir`.' : textoCrew(r));
    return responderV2(RESPONDE.MENSAJE, ficha({ fam: 'crews', color: colorCrew(c), acc: V.mini(logoCrew(c)),
      titulo: r.pedido ? 'Pediste entrar a ' + c.nombre : 'Entraste a ' + c.nombre + ' ✅',
      sub: r.pedido ? 'Te avisamos en la campana de la página cuando te acepten.' : null,
      filas: [[{ type: 2, style: 5, label: 'Ver la crew', url: urlCrew(c.id) }]] }));
  }
  // 🔗 un link de invitación, desde Discord (19/10/2026, Dlx: «me gusta todo»): los links se comparten acá, y hasta
  // ahora se armaban sólo en la página. Con él se entra directo (`link_unirse` en bot/crews.js)
  if (sub === 'link') {
    if (!de) return aviso(ERRORES_CREW.verificate);
    const mia = crewDeK(todas, de);
    if (!mia) return aviso('No estás en ninguna crew: arma la tuya en la página.', [{ type: 2, style: 5, label: 'Mi crew', url: HUB_URL + '/cuenta/crew' }]);
    const max = [1, 5, 10, 0].includes(Number(op.para)) ? Number(op.para) : 1;
    const r = await crewAvisos(env, '/crew', { accion: 'link_crear', quien: id, de, max });
    if (!r.ok) return aviso(textoCrew(r));
    return responderV2(RESPONDE.MENSAJE, linkCrew(mia, r));
  }
  if (sub === 'salir') {
    const c = de ? crewDeK(todas, de) : null;
    if (!c) return aviso(ERRORES_CREW.sin_crew);
    // 🟥 lo que no se deshace en una semana: rojo y sin franja, como /borrar-mis-datos
    return responderV2(RESPONDE.MENSAJE, V.mensaje({ color: V.COLOR.rojo, efimero: true,
      dentro: [V.T('### ¿Salir de ' + c.nombre + '?\n-# Después esperas 7 días para entrar a otra.')],
      filas: [[{ type: 2, style: ESTILO.PELIGRO, label: 'Sí, salir', custom_id: 'cw:salir:x:' + id },
        V.boton('Cancelar', 'cw:quedar:x:' + id, ESTILO.SECUNDARIO)]] }));
  }
  return aviso('No conozco esa opción.');
}

/** 👥 Los botones `cw:` (la invitación, «sí, salir», «Cancelar» y «Mi link para entrar»): sólo los toca la persona del
 *  botón. ⚠️ Una invitación de antes (sin el flag V2) se contesta como antes: un mensaje no cambia de formato */
async function crewBoton(i, env, que, crew, dueno) {
  const id = idDe(i);
  if (!dueno || id !== dueno) return aviso(que === 'salir' || que === 'quedar' || que === 'link' ? 'Ese botón es de otra persona.' : 'Esa invitación es para otra persona.');
  const esperar = frenado(id, 'click');
  if (esperar) return espera(esperar);
  if (que === 'quedar') return editarAqui(i, V.avisoMsg('Listo: sigues en tu crew.'));
  if (!env.AVISOS) return aviso('Ahora no puedo: prueba en un rato.');
  const de = await crewPerfil(env, id);
  if (que === 'link') {
    const todas = await crewAvisos(env, '/crews');
    const mia = de ? crewDeK(todas, de) : null;
    if (!mia) return aviso(ERRORES_CREW.sin_crew);
    const r = await crewAvisos(env, '/crew', { accion: 'link_crear', quien: id, de, max: [1, 5, 10, 0].includes(Number(crew)) ? Number(crew) : 1 });
    if (!r.ok) return aviso(textoCrew(r));
    return responderV2(RESPONDE.MENSAJE, linkCrew(mia, r));
  }
  if (que === 'salir') {
    const r = await crewAvisos(env, '/crew', { accion: 'salir', quien: id, de });
    if (!r.ok) return aviso(textoCrew(r));
    return editarAqui(i, V.avisoMsg(r.cerrada ? 'Listo: la crew se cerró.' : '👋 Saliste de la crew. En 7 días puedes entrar a otra.'));
  }
  const r = await crewAvisos(env, '/crew', { accion: 'responder', quien: id, de, crew, si: que === 'si' });
  if (!r.ok) return aviso(textoCrew(r));
  const todas = await crewAvisos(env, '/crews');
  const c = ((todas && todas.crews) || []).find((x) => x.id === crew);
  const nombre = c ? c.nombre : crew;
  const texto = que === 'si' ? '✅ <@' + id + '> entró a la crew **' + nombre + '**.' : 'La invitación a **' + nombre + '** quedó sin aceptar.';
  const botones = que === 'si' ? [{ type: 2, style: 5, label: 'Ver la crew', url: urlCrew(crew) }] : [];
  if (legado(i)) {
    return responderV2(RESPONDE.ACTUALIZAR, { content: texto, allowed_mentions: { parse: [] },
      components: botones.length ? [{ type: 1, components: botones }] : [] });
  }
  return responderV2(RESPONDE.ACTUALIZAR, ficha({ fam: 'crews', efimero: false, color: c ? colorCrew(c) : V.COLOR.verde,
    acc: V.mini(logoCrew(c)), cabeza: texto, filas: [botones] }));
}

// 🏷️ /apodo (Dlx, 18/11/2026: «en vez del comando de numeración sea otro… que tengas opciones e incluso para
// combinar»). Seis estilos listos (`bot/apodo.js`), uno para todos los servidores de la Liga: se guarda en
// `apodo:<id>` y se aplica AL TOQUE en este servidor —con las piezas que deja el ciclo en `apodos`, el mismo nombre
// base y el mismo `decidir()` que `herramientas/sincronizar_puesto.py`, así la vuelta siguiente no lo «corrige»— y en
// los demás, en esa vuelta. Sin `estilo:` muestra los seis con lo tuyo.
// 🧱 Y DESDE EL 20/11/2026 (la maqueta) los seis se ven armados con lo tuyo y se eligen en un MENÚ (`apo:`), que cambia
// este mismo mensaje: ya no hace falta volver a escribir `/apodo estilo:`. Devuelve `{msg}` o `{aviso}`.
async function apodoPanel(i, env, nuevo) {
  const gid = i.guild_id;
  const uid = idDe(i);
  const sv = aquiEs(gid) || 'este servidor';
  let todo = null;
  let mio = null;
  try {
    const [a, m] = await Promise.all([env.KV.get('apodos'), env.KV.get('apodo:' + uid)]);
    todo = a ? JSON.parse(a) : null;
    mio = m ? JSON.parse(m) : null;
  } catch (e) { todo = todo || null; }
  const [viejo, cfg, meta] = await Promise.all([eleccionNick(env, gid, uid), ajustes(env, gid), leerMeta(env)]);
  const fila = todo && todo.p ? todo.p[uid] : null;
  const p = AP.piezasDe(fila);
  const siglas = (todo && todo.s) || [];
  let actual = (i.member && i.member.nick) || '';
  const u0 = (i.member && i.member.user) || {};
  const base = (fila && fila[6]) || AP.nombreDe(actual) || u0.global_name || u0.username || '';
  let hecho = '';
  if (nuevo) {
    const n = AP.estiloValido(nuevo) || AP.POR_DEFECTO;
    // 🔴 SI KV NO ESCRIBE, SE DICE Y NO SE TOCA EL APODO (como el /numeral de antes): sin la elección guardada, la
    // próxima vuelta lo devolvería a lo que diga el servidor
    if (!mio || AP.estiloValido(mio.e) !== n) {
      try {
        await env.KV.put('apodo:' + uid, JSON.stringify({ e: n, ts: Date.now() }));
      } catch (e) {
        return { aviso: 'No pude guardar tu elección (`' + String(e).slice(0, 60) + '`), así que no te toqué el apodo. ' +
                        'Prueba de nuevo en un rato.' };
      }
    }
    mio = { e: n };
    const nombreEstilo = (AP.ESTILOS.find((e) => e[0] === n) || [])[1] || '';
    if (!todo) {
      hecho = `Anotado: estilo **${n}** (${nombreEstilo}). ⏳ Te lo pongo en la próxima vuelta del bot, en todos los servidores.`;
    } else {
      const destino = AP.decidir(actual, p, n, base, siglas);
      if ((destino || '') === actual) {
        hecho = `Listo: estilo **${n}** (${nombreEstilo}). En **${sv}** tu apodo ya era \`${actual || '(sin apodo)'}\`.` +
          (p ? '' : '\nTodavía no tienes piezas para el apodo (crew, #N, puesto…): cuando las tengas, aparecen solas.');
      } else {
        const res = await cambiarApodo(env, gid, uid, destino);
        if (res === 'ok') {
          hecho = `Listo: estilo **${n}** (${nombreEstilo}).\nTu apodo en **${sv}** ahora es \`${destino || '(sin apodo)'}\`; ` +
            'en los demás servidores de la Liga, en la próxima vuelta del bot.';
          actual = destino || '';
        } else if (res === 'sin-token') {
          hecho = `Anotado: estilo **${n}** (${nombreEstilo}). Tu apodo va a quedar \`${destino || '(sin apodo)'}\`.\n` +
            '⏳ Se aplica en la próxima vuelta del bot. Si no quieres esperar, póntelo tú.';
        } else {
          // ⚠️ LA ELECCIÓN QUEDA GUARDADA AUNQUE EL APODO FALLE: al dueño del servidor y a quien tenga un rol más alto que
          // el del bot, Discord no les deja tocar el apodo nunca
          hecho = `Anotado: estilo **${n}** (${nombreEstilo}).\n⚠️ Pero no pude cambiarte el apodo acá (\`${res}\`). Suele ser ` +
            'porque eres el dueño del servidor o tienes un rol más alto que el del bot: ' +
            `ponlo a mano como \`${destino || '(sin apodo)'}\`.`;
        }
      }
    }
  }
  // lo que rige hoy: lo tuyo (/apodo), si no tu /numeral de antes acá, si no el servidor, si no el 1
  const rige = AP.estiloValido(mio && mio.e) || (viejo ? (viejo.on ? AP.POR_DEFECTO : AP.SOLO_NOMBRE)
    : cfg.nick !== false ? AP.POR_DEFECTO : AP.SOLO_NOMBRE);
  const porque = mio && AP.estiloValido(mio.e) ? 'lo elegiste tú' : viejo ? 'lo elegiste con el `/numeral` de antes'
    : cfg.nick !== false ? 'es el de siempre' : `${sv} apagó las marcas`;
  const sale = (n) => (p ? AP.armar(n, base, p) : base);
  const lineas = AP.ESTILOS.map(([n, t]) => {
    const falta = p && n !== AP.SOLO_NOMBRE && !AP.adelante(n, p) ? ' *(te falta esa pieza)*' : '';
    return `${n === rige ? '▶' : '·'} **${n}** · ${t} — \`${sale(n) || '(sin apodo)'}\`${falta}`;
  });
  const nombreRige = (AP.ESTILOS.find((e) => e[0] === rige) || [])[1] || '';
  // 🎨 el color de tu letra: la pieza `r` del apodo (`B-` → B), la misma que sale en el estilo 5
  const letra = p && p.r ? String(p.r).replace(/[^A-Z]/g, '') : '';
  return { msg: ficha({ fam: 'apodo', color: colorRango(meta, letra),
    cabeza: `### Tu apodo en ${sv}\n\`${actual || '(sin apodo)'}\`\n-# Va con el estilo **${rige}** · ${nombreRige} (${porque}). ` +
      'Vale para todos los servidores de la Liga.',
    cuerpo: [hecho, '—', lineas.join('\n')],
    filas: [{ type: COMP.FILA, components: [{ type: COMP.SELECT, custom_id: 'apo:x:x:' + uid, placeholder: 'Cambiar de estilo',
      min_values: 1, max_values: 1,
      options: AP.ESTILOS.map(([n, t]) => ({ label: `${n} · ${t}`, value: String(n), default: n === rige,
        description: String(sale(n) || '(sin apodo)').slice(0, 100) })) }] }] }) };
}

const COMANDOS = {
  // 👥 /crew ver|invitar|unirme|link|salir (ver arriba `crewComando`)
  async crew(i, env) {
    const sub = ((i.data && i.data.options) || [])[0] || {};
    const op = Object.fromEntries((sub.options || []).map((o) => [o.name, o.value]));
    return crewComando(i, env, sub.name, op);
  },
  // 🖱️ click derecho en una persona → Apps → Invitar a mi crew
  async 'Invitar a mi crew'(i, env) {
    return crewComando(i, env, 'invitar', { quien: i.data && i.data.target_id });
  },
  async agendar(i, env) {
    const sv = aquiEs(i.guild_id);
    if (!sv) return aviso('`/agendar` funciona en los servidores de la Liga.');
    if (!(await esStaff(i, env))) return aviso('`/agendar` es para el staff y los organizadores del servidor.');
    if (!env.AVISOS) return aviso('Ahora no puedo agendarlo: prueba en un rato.');
    const op = Object.fromEntries(((i.data && i.data.options) || []).map((o) => [o.name, o.value]));
    const nombre = String(op.nombre || '').replace(/[`*_~|<>@]/g, '').trim().slice(0, 80);
    if (!nombre) return aviso('Falta el nombre del evento.');
    const objeto = env.AVISOS.get(env.AVISOS.idFromName('liga'));
    if (op.borrar) {
      const r = await objeto.fetch('https://avisos/agendar', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sv, borrar: true, nombre }) });
      const d = await r.json().catch(() => ({}));
      if (!d.ok) return aviso('No encontré **' + nombre + '** agendado en este servidor.');
      return responderV2(RESPONDE.MENSAJE, ficha({ fam: 'eventos', color: colorChat(sv), titulo: 'Saqué ' + nombre + ' de la agenda',
        sub: 'Ya no sale en el calendario de la Liga.' }));
    }
    const fm = /^\s*(\d{1,2})\s*[\/.-]\s*(\d{1,2})\s*$/.exec(String(op.dia || ''));
    const hm = /^\s*(\d{1,2})(?:\s*[:.h]\s*(\d{2}))?\s*(?:hs?)?\s*$/i.exec(String(op.hora || ''));
    const z = ZONAS_AGENDA[String(op.pais || '')];
    if (!fm || +fm[1] < 1 || +fm[1] > 31 || +fm[2] < 1 || +fm[2] > 12) return aviso('El día va como **dd/mm**: `18/10`.');
    if (!hm || +hm[1] > 23 || (hm[2] && +hm[2] > 59)) return aviso('La hora va de **0 a 23**, como `20:00`.');
    if (!z) return aviso('Elige el país de esa hora.');
    const ini = utcDeZona(+fm[1], +fm[2], +hm[1], +(hm[2] || 0), z);
    if (!ini || ini - Date.now() > 300 * 24 * 3600000) return aviso('Esa fecha ya pasó.');
    if (ini - Date.now() > 60 * 24 * 3600000) return aviso('Se puede agendar hasta dos meses adelante.');
    const r = await objeto.fetch('https://avisos/agendar', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sv, g: String(i.guild_id || ''), quien: idDe(i), nombre, ini,
        formato: String(op.formato || '').replace(/[`*_~|<>@]/g, '').slice(0, 30) }) });
    const d = await r.json().catch(() => ({}));
    if (d.error === 'muchos') return aviso('Este servidor ya tiene 20 eventos agendados: borra alguno con `borrar: True`.');
    if (!d.ok) return aviso('Ahora no puedo agendarlo: prueba en un rato.');
    const s = Math.floor(ini / 1000);
    const conTiempo = ini - Date.now() >= 12 * 3600000;
    // 🧱 la maqueta: el evento como título, la hora de Discord (cada uno la ve en la suya) y el ícono del servidor
    const ico = (visualRed(sv, await leerMeta(env), Date.now()) || {}).ico || '';
    return responderV2(RESPONDE.MENSAJE, ficha({ fam: 'eventos', color: colorChat(sv), acc: V.mini(ico),
      cabeza: '### Agendado: ' + nombre + '\n<t:' + s + ':F> · <t:' + s + ':R>',
      cuerpo: ['—', '-# Cada uno lo ve en su hora. Sale en el calendario de la Liga en la próxima media hora.' +
        (conTiempo ? ' Con 12 horas o más de anticipación, quienes lo juegan suman **+10 %**.' : '')] }));
  },
  async afiche(i, env, ctx) { return kit(i, env, ctx, 'afiche'); },
  async llave(i, env, ctx) { return kit(i, env, ctx, 'llave'); },
  // 🖱️ click derecho en una persona → Apps → Carta (Dlx, 08/10/2026): es `/card quien:<esa persona>`. Discord manda
  // a quién en `target_id`, con sus datos en `resolved` como el selector de `/card`, así que `datosDe()` los encuentra
  async Carta(i, env, ctx) {
    const t = i.data && i.data.target_id;
    i.data.options = t ? [{ name: 'quien', type: 6, value: t }] : [];
    return COMANDOS.card(i, env, ctx);
  },

  async 'borrar-mis-datos'(i, env, ctx) {
    const id = idDe(i);
    if (!id) return aviso('No pude saber quién eres.');
    return responderPanel(RESPONDE.MENSAJE, panelBaja(id));
  },

  async help(i, env, ctx) {
    const op = ((i.data && i.data.options) || []).find(o => o.name === 'comando');
    const k = op ? String(op.value).toLowerCase() : '';
    // ⚠️ El valor viene de una lista cerrada de Discord, así que esto no
    // debería pasar nunca — pero «no debería» no es «no puede», y contestar
    // el índice es más útil que un error.
    if (!k || !AYUDA[k]) return responderV2(RESPONDE.MENSAJE, ayudaIndice());
    // ⚠️ SÓLO LA AYUDA DE `/card` LEE KV, porque es la única que dice números
    // que pueden cambiar. Las otras son texto fijo y no gastan una
    // lectura por curiosidad.
    const m = AYUDA[k].length ? JSON.parse((await env.KV.get('meta')) || '{}') : null;
    return responderV2(RESPONDE.MENSAJE, ayudaPagina(k, m));
  },

  async foto(i, env, ctx) {
    const { id, hash } = avatarDe(i);
    const quien = id ? await env.KV.get('d:' + id) : null;
    if (!quien) {
      // 🔑 LAS LIBRES (29/09/2026): quien está en la Lista sin verificar ya
      // tiene la Temporada y la Servidor, pero la foto es de la cuenta, y la
      // cuenta sigue siendo de los verificados. «No estás en la Liga» le
      // mentiría.
      if (id && await env.KV.get('dn:' + id)) {
        return aviso('La foto se cambia estando **verificado en DRA**: ' +
                     '`/verificar` te dice qué te falta.');
      }
      return aviso('Todavía no estás en la Liga, así que no hay carta donde ' +
                   'poner la foto.\nPrueba `/card` y te anoto.');
    }
    if (!hash) {
      // ⚠️ NO SE GUARDA EL BLOB GRIS. Discord da un avatar por defecto para
      // el que nunca se puso foto; guardarlo haría que la carta dibuje ese
      // gris en vez de la inicial gigante con el color del rango, que es
      // mejor carta.
      return aviso('No tienes foto puesta en Discord — tu carta va con la ' +
                   'inicial, que con el color de tu rango queda bien.\n' +
                   'Si te pones una, vuelve y corre `/foto`.');
    }
    // ⚠️ SI NO HAY BINDING DE R2 EL COMANDO NO PUEDE HACER NADA, y conviene
    // decirlo en vez de fallar adentro del `waitUntil` — ahí el error no lo
    // ve nadie y la persona se queda mirando «está pensando…».
    if (!env.CARTAS) {
      return aviso('El guardado de fotos todavía no está enchufado. ' +
                   'Avísale a Dlx.');
    }
    // 🔴 MIENTRAS LA TEMPORADA NO ARRANCÓ, CAMBIAR LA CARA ES LIBRE.
    // Dlx, 22/09/2026: *«cuando el plazo está abierto no hay necesidad de
    // que el usuario necesite el rol especial en DRA, pero cuando la
    // temporada haya iniciado sí es necesario»*.
    //
    // El límite de una por temporada existe porque **la Histórica necesita
    // la cara que cada uno tenía en cada temporada**. Antes de que haya
    // competido nadie no hay historia que proteger: el límite no defiende
    // nada y sólo estorba a quien está terminando de armar su perfil.
    //
    // ⚠️ SALE DE `meta.arrancada`, QUE SE DERIVA DEL POOL. No es una fecha
    // escrita a mano acá: `bot/subir_datos.py` la calcula como «hay alguien
    // en el pool de temporada», o sea «alguien compitió». El día del primer
    // evento esto se cierra solo, sin que nadie tenga que acordarse.
    //
    // ⚠️ Y EL ROL SIGUE SIENDO EL QUE SALTEA EL LÍMITE cuando sí rige. No
    // cambia de significado: cambia cuándo hace falta.
    const arrancada = await temporadaArrancada(env);
    const usado = arrancada && await fotoUsada(env, quien);
    const pase = tienePase(i);
    if (usado && !pase) {
      // ⚠️ SE DICE POR QUÉ Y HASTA CUÁNDO. «No podés» a secas deja a la
      // persona sin saber si es un bug o una regla.
      return aviso('Ya elegiste tu foto de la **' + temporadaDe(env).toUpperCase() +
                   '** y va una por temporada 📸\n' +
                   'Es a propósito: la Histórica necesita la cara que tenías ' +
                   'en cada temporada, no la última.\n' +
                   'Se vuelve a abrir cuando arranque la que sigue.');
    }
    // ⚠️ RESPUESTA DIFERIDA: bajar del CDN y escribir en R2 puede pasarse de
    // los 3 segundos que da Discord. Con el tipo 5 hay 15 minutos.
    return pensandoYEditar(i, ctx, () => guardarFoto(env, i, quien, id, hash), 'cuenta');
  },

  async owner(i, env, ctx) {
    // ⚠️ EL PORTERO VA PRIMERO Y NO GASTA UNA LECTURA. Chequear después de
    // leer KV sería pagar la consulta igual, que es justo lo que un comando
    // de dueño no tiene por qué permitirle a cualquiera.
    if (!esDueno(i)) {
      // ⚠️ NO SE CONTESTA «no tenés permiso» A SECAS. El que llega acá casi
      // siempre es un admin buscando los ajustes de SU servidor, y mandarlo
      // al comando correcto resuelve el caso sin que tenga que preguntar.
      return aviso('`/owner` es de la **Liga Global**, no de este servidor.\n' +
                   'Los ajustes de acá son `/settings`; tu apodo, ' +
                   '`/apodo`.');
    }
    const sub = (((i.data && i.data.options) || [])[0]) || {};
    const arg = (n) => {
      const o = (sub.options || []).find((x) => x.name === n);
      return o && o.value;
    };

    if (sub.name === 'quien') {
      // 🔴 EL SUBCOMANDO QUE MÁS SE VA A USAR: «¿por qué éste no tiene carta?».
      // Hoy esa pregunta se contesta abriendo el volcado de KV en la máquina
      // de Dlx. Acá se contesta desde el teléfono y —lo que importa— con **la
      // misma lectura** que hace `/card`, así que no puede discrepar de lo
      // que la persona ve.
      const porUsuario = arg('quien');
      const porNombre = arg('nombre');
      if (!porUsuario && !porNombre) return aviso('¿De quién? `quien:` o `nombre:`.');
      let clave = porNombre ? norm(porNombre) : null;
      if (porUsuario) {
        clave = await env.KV.get('d:' + porUsuario);
        if (!clave) {
          return aviso(`<@${porUsuario}> **no tiene su Discord ID cargado**.\n` +
                       'Por eso no lo encuentra `/card quien:` — a esa persona ' +
                       'sólo se llega escribiendo el nombre. Se carga en el ' +
                       'Operativo.');
        }
      }
      const crudo = await leerP(env, clave);
      if (!crudo) {
        return aviso('No hay nada en KV bajo `p:' + clave + '`.\n' +
                     '⚠️ La clave se normaliza igual acá que en el pipeline ' +
                     '(`comun/claves.py`, verificado contra el JS por ' +
                     '`herramientas/claves_js_vs_py.py`). Si el nombre existe ' +
                     'en el Sheet y esto no lo encuentra, el que falta es el ' +
                     '**pool**, no la clave.');
      }
      const g = JSON.parse(crudo);
      const L = [
        '## `' + clave + '`',
        '```',
        `sv  (donde estás)  ${g.sv || '—'}`,
        `svp (el del pool)  ${g.svp || '—'}`,
        `país               ${g.cc || '—'}`,
        `eventos            ${g.ev != null ? g.ev : '—'}`,
        '```',
        '**Cartas en R2**  ' + ((g.cs && g.cs.length) ? g.cs.join(' · ') : '_ninguna_'),
      ];
      if (g.svc && g.svc.length) L.push('**Camisetas**  ' + g.svc.join(' · '));
      if (g.bl && g.bl.length) L.push('**Bloqueadas subidas**  ' + g.bl.join(' · '));
      if (g.svs) {
        L.push('**Está en**  ' + (g.svs.join(' · ') || '_ningún servidor conocido_'));
      }
      if (g.vs) {
        // ⚠️ EL NÚMERO DE CADA CARTA SALE DE `VS`, NO DE UNA LISTA ACÁ.
        // `vs` guarda seis campos por categoría y sólo uno es *el* número —
        // la primera regla del proyecto, «el número de cada carta mide lo que
        // esa carta mide». Cuál es, ya lo dice `VS[...].cabeza`, que es lo
        // mismo que usa `/versus` para decidir quién gana. Escribirlo de
        // nuevo acá sería que este panel y el comando pudieran discrepar.
        const n = Object.keys(VS)
          .filter((c) => g.vs[VS[c].k])
          .map((c) => `${VS[c].cabeza[0]} ${g.vs[VS[c].k][VS[c].cabeza[1]]}`);
        if (n.length) L.push('**Los números de `/versus`**  ' + n.join(' · '));
      }
      // ⚠️ LO QUE FALTA SE DICE APARTE DE LO QUE HAY. Una lista de lo que
      // tiene deja al que mira restando de memoria contra las cuatro, y la
      // pregunta que trajo a alguien hasta acá es siempre la de lo que falta.
      const faltan = ['temporada', 'competitivo', 'pais', 'servidor']
        .filter((c) => (g.cs || []).indexOf(c) < 0);
      if (faltan.length) L.push('', '⚠️ **Sin carta:** ' + faltan.join(' · '));
      return responderV2(RESPONDE.MENSAJE, ficha({ fam: 'ayuda', color: colorRango(await leerMeta(env), g.rg),
        cuerpo: [L.join('\n').replace(/^## /, '### ')] }));
    }

    // ⚠️ UNA SOLA LECTURA PARA LOS OTROS DOS, y es la misma clave que lee
    // `/card`: si `meta` estuviera vieja, estos paneles la muestran vieja
    // también — que es exactamente lo que hay que poder ver.
    const m = JSON.parse((await env.KV.get('meta')) || '{}');
    const fichaOwner = (txt) => responderV2(RESPONDE.MENSAJE, ficha({ fam: 'ayuda', cuerpo: [String(txt).replace(/^## /, '### ')] }));
    if (sub.name === 'rangos') return fichaOwner(panelRangos(m));
    let disp = null;
    try {
      const r = await rutaAvisos(new Request('https://x/avisos/estado'), env, '/avisos/estado');
      disp = (await r.json()).disparador || null;
    } catch (e) { disp = null; }
    return fichaOwner(panelEstado(m, disp));
  },

  // 🐉 /drops — los tuyos para abrir; el Drop y el Star se abren acá (Discord, tanda 1)
  drops(i, env, ctx) {
    const did = idDe(i);
    return pensandoYEditar(i, ctx, () => panelDrops(env, did, i), 'drops');
  },
  // 💰 /billetera — tus Puntos de Tienda
  billetera(i, env, ctx) {
    const did = idDe(i);
    return pensandoYEditar(i, ctx, () => panelBilletera(env, did, i), 'tienda');
  },
  // 🎒 /inventario — lo de la Tienda que tienes y lo que tienes puesto
  inventario(i, env, ctx) {
    const did = idDe(i);
    return pensandoYEditar(i, ctx, () => panelInventario(env, did, i), 'tienda');
  },
  // 🎽 /equipar que:<lugar> — un menú con lo tuyo de ese lugar
  equipar(i, env, ctx) {
    const did = idDe(i);
    const ranura = String(((i.data.options || []).find((o) => o.name === 'que') || {}).value || '');
    if (!RANURA_NOMBRE[ranura]) return aviso('Elige un lugar: aro, decoración, nombre, carta, perfil o un fondo.');
    return pensandoYEditar(i, ctx, () => panelEquipar(env, did, ranura, i), 'tienda');
  },
  // 🔗 /vincular — tu cuenta de Discord con tu perfil de la Liga (para que tus premios y drops sean tuyos)
  async vincular(i, env, ctx) {
    const did = idDe(i);
    let k = '';
    try { k = (await env.KV.get('d:' + did)) || ''; } catch (e) { k = ''; }
    if (k) {
      // 🎨 el color de tu rango y tu cara, si llegan a tiempo (el objeto puede estar dormido: sin ellos, igual contesta)
      const [crudo, m, cara] = await Promise.all([aTiempo(leerP(env, k), 1200, null), leerMeta(env), aTiempo(caraDe(env, i, k), 1200, '')]);
      let g = null;
      try { g = JSON.parse(crudo || 'null'); } catch (e) { g = null; }
      return responderV2(RESPONDE.MENSAJE, ficha({ fam: 'cuenta', color: colorRango(m, g && g.rg), cara, titulo: 'Tu cuenta ya está vinculada ✅',
        sub: 'En la Liga eres **' + k + '**: tus premios y tus drops van directo a ti.',
        filas: [[botonLink('Tu perfil', HUB_URL + '/freestyle-rap/r/' + encodeURIComponent(k))]] }));
    }
    return responderV2(RESPONDE.MENSAJE, ficha({ fam: 'cuenta', cara: await caraDe(env, i, ''), titulo: 'Vincula tu cuenta',
      sub: 'Para que tus premios y tus Dragón Drops sean tuyos.',
      cuerpo: ['El botón te lleva a la página: entras con Discord y te suma a **DRA**, el servidor de la Liga.\n-# Si después te ' +
        'vas de DRA, lo que ganaste queda guardado hasta que vuelvas.'],
      filas: [[botonLink('Vincular mi cuenta', URL_VINCULAR)]] }));
  },
  ping(i) {
    return responderV2(RESPONDE.MENSAJE, ficha({ fam: 'ayuda', titulo: 'La Liga responde 🏓',
      cuerpo: [`Servidor \`${i.guild_id || '(fuera de un servidor)'}\` · la firma Ed25519 validó.\n` +
        '-# Esto salió de un Worker, sin nada prendido entre comando y comando.'] }));
  },

  // 🔑 Ver `panelNotify()`. Los servidores escuchados salen del estado del
  // objeto de los avisos; si no contesta, se ofrece igual (la campana valida).
  async notify(i, env, ctx) {
    return responderPanel(RESPONDE.MENSAJE, panelNotify(aquiEs(i.guild_id), await escuchados(env), null));
  },

  // 🔑 Dlx, 25/09/2026: «/website, que te redirigiría a la página».
  async website(i, env, ctx) {
    return responderV2(RESPONDE.MENSAJE, ficha({ fam: 'ayuda', titulo: 'La Liga Global',
      sub: 'Los rankings, el perfil de cada rapero, las llaves de cada evento y el calendario.',
      filas: [[botonLink('Abrir la página', HUB_URL + '/freestyle-rap/')]] }));
  },

  async verificar(i, env, ctx) {
    const yo = idDe(i);
    const [ya, mCrudo] = await Promise.all([env.KV.get('d:' + yo), env.KV.get('meta')]);
    let mm = null;
    try { mm = mCrudo ? JSON.parse(mCrudo) : null; } catch (e) { mm = null; }
    // 🧱 la ficha de /verificar (la maqueta): los requisitos como una lista que se tilda, y lo que pasa después en letra chica
    const fv = (titulo, sub, cuerpo, botones, extra) => responderV2(RESPONDE.MENSAJE,
      ficha(Object.assign({ fam: 'cuenta', titulo, sub, cuerpo, filas: [botones || []] }, extra || {})));
    if (ya) {
      const [crudo, cara] = await Promise.all([aTiempo(leerP(env, ya), 1200, null), aTiempo(caraDe(env, i, ya), 1200, '')]);
      let g = null;
      try { g = JSON.parse(crudo || 'null'); } catch (e) { g = null; }
      return fv('Ya estás verificado ✅', 'Tu tarjeta sale con `/card`.', [], [], { color: colorRango(mm, g && g.rg), cara });
    }
    const P = mm && mm.porton;
    const v0 = comoVerificarse(aquiEs(i.guild_id));
    // 🧱 sin el «👇» (el botón ya está abajo) y con la lista que se tilda, quedan los tres ✅/❌: como mucho tres emoji
    const v = Object.assign({}, v0, { texto: v0.texto.replace(/ 👇$/, '.') });
    const d = datosDe(i, yo);
    const cara = await caraDe(env, i, '');
    // ⚠️ SIN EL PORTÓN EN KV O SIN EL TOKEN NO SE PUEDE MIRAR: se hace lo de
    // `/card`, que es anotar y explicar. Un comando que no puede contestar lo
    // que promete igual deja a la persona un paso más cerca.
    if (!P || !P.guild || !env.DISCORD_TOKEN) {
      anotar(env, ctx, yo, d.nick, d.user, d.glob, i.guild_id, 'yo');
      return fv('Todavía no tienes tarjeta', null, [YA_TE_ANOTE.replace(/^Todavía no tienes tarjeta 🃏 — s/, 'S'), v.texto], v.botones, { cara });
    }
    const { estado, miembro } = await miembroDra(env, P.guild, yo);
    if (!miembro && estado !== 404) {
      return aviso('No pude mirar Discord Rap Español ahora mismo (contestó ' + estado +
                   '). Prueba de nuevo en un rato.');
    }
    let dg = diagnostico(miembro, P);
    // 🔗 «B»: el botón de la página va siempre, también cuando no te falta nada: ahí se ve cómo va
    const aLaPagina = [botonLink('Síguelo en la página', URL_VERIFICAR)];
    const unPais = dg.paises.length === 1;
    const si = (b) => (b ? '✅' : '❌');
    const lista = [
      `${si(dg.enDra)} Estar en **Discord Rap Español**`,
      `${si(dg.rol)} Tener el rol **Miembro** ahí`,
      `${si(unPais)} Tener un país` + (unPais ? ' ' + emojiBandera(dg.paises[0]) : ''),
    ].join('\n');
    if (!dg.enDra) {
      return fv('Te falta entrar a Discord Rap Español', 'Para verificarte hace falta estar en **Discord Rap Español**, y ahí ' +
        'no te encuentro.', [lista, '—', v.texto], v.botones, { cara });
    }
    if (dg.paises.length > 1) {
      return fv('Tienes ' + dg.paises.length + ' países en DRA', null, [lista, 'Tienes **' + dg.paises.length + ' países** en DRA (' +
        dg.paises.map(emojiBandera).join(' ') + '): deja uno solo y vuelve a escribir `/verificar`.'], aLaPagina, { cara });
    }
    if (!unPais) {
      // 🔑 y desde el 01/10/2026 se elige en la página: el bot te pone el rol
      return fv('Te falta tu país', null, [lista, 'No encuentro tu **país** en DRA. Elígelo en la página y el bot te pone el ' +
        'rol (o elige tu rol de país en DRA, o pon tu bandera en el apodo, y vuelve a escribir `/verificar`).'], v.botones, { cara });
    }
    // las reglas de DRA sin aceptar: Discord no deja darle roles a quien no entró del todo
    if (miembro && miembro.pending === true) {
      return fv('Te falta aceptar las reglas de DRA', null, [lista, 'Te falta **aceptar las reglas de DRA**: Discord te las ' +
        'muestra al abrir el servidor, es un toque. Después vuelve a escribir `/verificar`.'], aLaPagina, { cara });
    }
    if ((P.revisa || []).indexOf(String(yo)) >= 0) {
      return fv('Lo tuyo está completo', null, [lista, 'Lo tuyo está completo. Tu caso lo revisa un admin: no hace falta que ' +
        'hagas nada más.'], aLaPagina, { cara });
    }
    // ✅ «A»: lo tuyo está completo y te falta el Miembro: te lo damos ahora (`darMiembro()`), no en la vuelta del ciclo
    let dimos = false;
    if (!dg.rol && await darMiembro(env, P, yo, 'Liga Global: /verificar (en DRA + país)')) {
      dimos = true;
      dg = Object.assign({}, dg, { rol: true });
    }
    const lista2 = dimos ? lista.replace('❌ Tener el rol **Miembro** ahí', '✅ Tener el rol **Miembro** ahí') : lista;
    anotar(env, ctx, yo, d.nick, d.user, d.glob, i.guild_id, 'yo');
    const vuelta = proximaVuelta(Date.now());
    const hora = vuelta ? horaEste(vuelta.toISOString()).replace(/^\S+ /, '') : '';
    const cuando = hora ? `\n-# La próxima vuelta arranca a las **${hora}**.` : '';
    return fv(dimos || dg.rol ? 'Ya estás verificado' : 'Lo tuyo está completo', null, [lista2, '—', (dimos
      ? '¡Listo! Te dimos el rol de **Miembro** en DRA: ya estás verificado. Tu tarjeta sale cuando el bot te ' +
        'cargue, en menos de una hora.'
      : dg.rol
        ? 'Estás verificado en DRA. Tu tarjeta sale cuando el bot te cargue: en menos de una hora.'
        : 'El rol de **Miembro** te lo da el bot solo, y con él sale tu tarjeta: en ' +
          'menos de una hora.') + cuando], aLaPagina, { cara });
  },

  async card(i, env, ctx) {
    // ⚠️ EL CANAL SE CHEQUEA ANTES DE TODO. Si el servidor limitó dónde se
    // puede usar, no tiene sentido buscar a nadie en KV para después decir que
    // acá no. Y el aviso NOMBRA los canales permitidos: «no se puede acá» sin
    // decir dónde sí manda a la persona a adivinar.
    if (i.guild_id) {
      const cfg = await ajustes(env, i.guild_id);
      if (cfg.canales.length && cfg.canales.indexOf(i.channel_id) < 0) {
        return aviso('Acá no se pueden pedir cartas. Prueba en ' +
                     cfg.canales.map(c => `<#${c}>`).join(' · ') + '.');
      }
    }
    const ops = i.data.options || [];
    const porUsuario = ops.find(o => o.name === 'quien');     // type 6 = USER
    const porNombre = ops.find(o => o.name === 'nombre');     // type 3 = STRING

    // ⚠️ TRES MANERAS, Y EL ORDEN IMPORTA.
    //   1. elegiste a alguien en el selector -> se busca por SU Discord ID
    //   2. escribiste un nombre              -> se busca por nombre
    //   3. no pusiste nada                   -> sos VOS, por tu propio ID
    //
    // El selector no se puede equivocar de nombre, pero sólo encuentra a quien
    // tenga su ID cargado en el Operativo: hoy 101 de 138. Por eso el nombre
    // sigue estando — no es redundancia, es el único camino para los otros 37.
    let quien, comoDije;
    // 🔴 ELEGIRSE A UNO MISMO EN `quien:` ES «YO». Adriagner lo hizo (04/10/2026) y el bot le contestó como a
    // otro —«@Adriagner todavía no está en la Liga… si sabés SU nombre»—, en tercera persona y anotándolo como
    // «otro». Es el mismo pedido que `/card` solo
    if (porUsuario && String(porUsuario.value) !== String(idDe(i))) {
      quien = await claveCarta(env, porUsuario.value);
      comoDije = `<@${porUsuario.value}>`;
      if (!quien) {
        // La persona elegida no está cargada, pero SU ID lo tenemos acá mismo
        // (es el valor del selector) — se anota para no perderlo.
        const d = datosDe(i, porUsuario.value);
        if (!frenado(idDe(i), 'otro')) anotar(env, ctx, porUsuario.value, d.nick, d.user, d.glob, i.guild_id, 'otro');
        // 🔴 sin «un admin lo carga»: lo que le falta es jugar (ver `YA_TE_ANOTE`)
        return aviso(`${comoDije} todavía no tiene tarjeta: se consiguen verificándose en la página y con la ` +
                     'primera Tarea del **Pase de rapero**.\n' +
                     'Si jugó con otro nombre: `/card nombre:<ese nombre>`.');
      }
    } else if (porNombre) {
      quien = norm(porNombre.value);
      comoDije = `**${porNombre.value}**`;
    } else {
      quien = await quienEsCarta(i, env);
      comoDije = 'tú';
      if (!quien) {
        // El caso de la captura de Lil Drako: corrió /card, el bot no lo tenía.
        // Se lo anota con su ID y su apodo del servidor para que no se pierda.
        //
        // 🔴 SALVO QUE YA ESTE CARGADO. Desde KV, «no está en el padrón» y
        // «está en el padrón y no se verificó en DRA» se ven idénticos:
        // los dos faltan de `p:`. A los dos se les decía *«Ya te anoté —
        // un admin te va a cargar»*, y al segundo eso es prometerle algo
        // ya hecho: no le falta un admin, le falta **verificarse**, que
        // es suyo. Puede esperar para siempre a alguien sin nada que
        // hacer. `meta.cargados` trae los que están en esa situación.
        //
        // ⚠️ Y TAMPOCO SE LO ENCOLA. La cola `reg:` es para que un admin
        // cargue gente; meter ahí a quien ya está cargado la llena de
        // trabajo que no existe, y una cola con ruido se deja de mirar.
        const yo = idDe(i);
        const mCrudo = await env.KV.get('meta');
        let mm = null;
        try { mm = mCrudo ? JSON.parse(mCrudo) : null; } catch (e) { mm = null; }
        // ⚠️ `cargados` puede faltar si KV es más viejo que este código:
        // entonces se hace lo de antes, que es anotar. Equivocarse hacia
        // anotar de más sólo cuesta una línea en la cola; hacia anotar de
        // menos, perder a alguien que sí hacía falta cargar.
        const cargado = mm && Array.isArray(mm.cargados)
                        && mm.cargados.indexOf(String(yo)) >= 0;
        const v = comoVerificarse(aquiEs(i.guild_id));
        // 🔑 «ESO LO HACÉS VOS» DEJÓ DE SER CIERTO EL 25/09/2026 para quien
        // ya está en DRA con su país: `bot/autoverificar.py` le da el
        // Miembro solo (#9 de Dlx). Para el resto sigue siendo suyo.
        if (cargado) {
          // 🔑 DESDE LAS LIBRES (29/09/2026) NO TODO ES VERIFICARSE: quien
          // está en la Lista y todavía no jugó tiene la Temporada y la
          // Servidor en cuanto juegue. Verificarse es para las otras dos.
          // 🔑 Y DESDE EL 05/10/2026, SIN VERIFICARSE NINGUNA: los dos pasos de `dosPasos()`
          return responderV2(RESPONDE.MENSAJE, dosPasos({ aqui: aquiEs(i.guild_id), titulo: 'Ya estás cargado en la Liga ✅',
            sub: 'No hace falta que nadie te agregue: te faltan estos dos pasos, y los dos son tuyos.',
            nota: 'Para verificarte: si ya estás en DRA y Discord sabe tu país (bandera en tu apodo o un rol de país), el bot te ' +
              'verifica solo en la próxima vuelta (~30 min); si no, ' + minuscula(v.texto).replace(/ 👇$/, '') + '.' }));
        }
        const d = datosDe(i, yo);
        anotar(env, ctx, yo, d.nick, d.user, d.glob, i.guild_id, 'yo');
        return responderV2(RESPONDE.MENSAJE, dosPasos({ aqui: aquiEs(i.guild_id), titulo: 'Todavía no tienes tarjeta',
          sub: 'Se consiguen en dos pasos, y los dos son tuyos.', eventos: true,
          nota: ANOTE_CORTO + ' ¿Jugaste con otro nombre? `/card nombre:<ese nombre>`' }));
      }
    }
    const [crudo, meta] = await Promise.all([
      leerP(env, quien), env.KV.get('meta'),
    ]);
    if (!crudo) return aviso(`No tengo cartas de ${comoDije}.`);
    const g = JSON.parse(crudo);
    const m = meta ? JSON.parse(meta) : {};
    // ⚠️ LA SERVIDOR ES LA DEFAULT, **SALVO QUE LA COMPETITIVA ESTÉ
    // ABIERTA**. Esta regla fue y volvió, así que conviene el orden:
    //
    //   16/09  si tiene la Competitiva desbloqueada, abre ahí
    //   17/09  Dlx: la Servidor es la default para todos, siempre
    //   22/09  Dlx: «servidor siempre disponible y la default… a menos
    //          que competitivo esté abierto»
    //
    // O sea que vuelve la del 16/09 como excepción sobre la del 17/09:
    // la Servidor sigue sin bloquearse nunca y sigue siendo el piso —
    // lo que cambia es que quien se ganó la Competitiva abre ahí.
    //
    // ⚠️ SE PREGUNTA POR `cs` Y NO POR EL REQUISITO. `cs` es la lista
    // de cartas que esa persona **tiene emitidas**: incluye el
    // requisito y además que el dibujo exista. Mirar sólo el requisito
    // abriría en una carta que todavía no está subida.
    // 🔴 ESTÁ EN KV Y TODAVÍA NO TIENE NINGUNA CARTA. Es el caso de quien
    // acaba de verificarse: desde el 22/09/2026 el pipeline lo mete en KV
    // apenas pasa el portón —para que `/card` sepa quién es sin esperar
    // una hora— pero sus PNG se dibujan en el ciclo siguiente.
    //
    // ⚠️ SIN ESTO SE LE MANDA UNA IMAGEN ROTA. `abre` caería en
    // 'servidor', `carta()` construiría su URL y R2 devolvería 404;
    // encima `tiene()` saca los cuatro botones, así que quedaría un
    // embed con un cuadro roto y nada más. Medido con «Jun», que se
    // verificó hoy mientras se revisaba esto.
    //
    // ⚠️ Y NO ES «no estás en la Liga»: sí está. Lo que falta es el
    // dibujo, que tarda lo que tarde el ciclo. Decirlo es la diferencia
    // entre «esperá» y «no existís».
    //
    // 🔴 `cs` AUSENTE Y `cs: []` NO SON LO MISMO, y la primera version de
    // esta guarda los junto. Ausente es **KV viejo**, escrito por un pipeline
    // que todavia no mandaba el campo, y vale por «las cuatro» — hay una
    // prueba que lo dice con todas las letras desde antes que esto
    // existiera. Vacio es «se verifico recien y no hay ningun dibujo».
    // Tratar el ausente como vacio le contesta «esperá» a alguien que
    // tiene sus cuatro cartas subidas.
    //
    // ⚠️ Y LO DIJERON LAS PRUEBAS, NO LA PRODUCCION. En KV hoy no hay
    // ninguna fila sin `cs`, asi que no se le rompio a nadie; lo que se
    // rompio fue **la guardia**: 29 pruebas en rojo durante horas, que
    // es todo cambio posterior al Worker viajando sin red.
    const sinCs = !Array.isArray(g.cs);
    // 🏟️ quien sólo tiene carta de liga (la tiene todo el que juega una, 27/10/2026) también tiene /card: abre ésa
    const soloLiga = !sinCs && !g.cs.length && !(g.bl && g.bl.length) && ligasDe(g).length > 0;
    const algunaCarta = sinCs || g.cs.length || (g.bl && g.bl.length) || soloLiga;
    if (!algunaCarta) {
      return aviso(`${comoDije === 'tú' ? 'Ya estás' : comoDije + ' ya está'}` +
                   ' en la Liga ✅ — pero las cartas todavía no están ' +
                   'dibujadas.\nSe generan solas en la próxima vuelta del ' +
                   'ciclo; prueba de nuevo en un rato.');
    }
    // 🎙️ EN UN SERVIDOR SIN CARTA DE SERVIDOR (`sinCarta`: FDS, LKR), LA TEMPORADA (Dlx, 20/10/2026: «los servidores sin
    // tarjeta de servidor, su tarjeta default debería ser temporada… aunque éstas no cuenten para ello»). Abrir ahí la
    // Servidor mostraría la de OTRO servidor, y la Competitiva pide 10 eventos que en un Tier 3 no se juegan
    const aquiSv = SV_DE(aquiEs(i.guild_id));
    const temp = sinCs || (g.cs || []).indexOf('temporada') >= 0;
    // 🃏 Y SI ELIGIÓ SU CARTA PRINCIPAL (26/10/2026, `cartaPrincipal()` del objeto, viene en `cp`), ésa primero
    const cp = String(g.cp || '');
    const abre = soloLiga ? 'liga'
      : cp && tiene(g, cp) && !bloqueada(g, cp) && !(cp === 'servidor' && aquiSv && aquiSv.sinCarta) ? cp
      : aquiSv && aquiSv.sinCarta && temp ? 'temporada'
        : ((g.cs || []).indexOf('competitivo') >= 0) ? 'competitivo' : 'servidor';
    // 📸 tu carta sin tu foto: un aviso que ves sólo vos (ver `avisoFoto()`)
    if (comoDije === 'tú' || (porUsuario && String(porUsuario.value) === String(idDe(i)))) {
      luego(ctx, avisoFoto(env, i, quien, g));
    }
    return responder(RESPONDE.MENSAJE,
      carta(quien, g, abre, null, idDe(i), m, aquiEs(i.guild_id)));
  },

  async versus(i, env, ctx) {
    // el mismo portero que `/card`: si el servidor limitó dónde, se corta acá
    // antes de gastar dos lecturas de KV.
    if (i.guild_id) {
      const cfg = await ajustes(env, i.guild_id);
      if (cfg.canales.length && cfg.canales.indexOf(i.channel_id) < 0) {
        return aviso('Acá no se pueden pedir cartas. Prueba en ' +
                     cfg.canales.map(c => `<#${c}>`).join(' · ') + '.');
      }
    }
    const ops = (i.data && i.data.options) || [];
    const val = (n) => { const o = ops.find(x => x.name === n); return o && o.value; };

    // ⚠️ LOS DOS EN PARALELO. Son dos lecturas de KV que no dependen una de la
    // otra; en serie se suman las dos esperas y acá el presupuesto es 10 ms.
    const [rival, pedido] = await Promise.all([
      quienPidieron(env, i, ops, 'rival', 'rival_nombre'),
      quienPidieron(env, i, ops, 'contra', 'contra_nombre'),
    ]);
    if (!rival) return aviso('¿Contra quién? `/versus rival:@alguien`.');
    if (!rival.clave) {
      // ⚠️ SE LO ANOTA, IGUAL QUE EN `/card`. La persona existe en Discord y su
      // ID viene en el payload: dejarla pasar sin anotarla desperdicia el único
      // momento en que el bot la tiene delante. Hoy son 25 de 469 sin ID.
      if (rival.id) {
        const d = datosDe(i, rival.id);
        if (!frenado(idDe(i), 'otro')) anotar(env, ctx, rival.id, d.nick, d.user, d.glob, i.guild_id, 'otro');
      }
      return aviso(`${rival.como} todavía no tiene tarjeta: se consiguen verificándose en la página y con la ` +
                   'primera Tarea del **Pase de rapero**.');
    }
    // ⚠️ `contra` ES OPCIONAL Y POR DEFECTO SOS VOS. Que se pueda enfrentar a
    // dos terceros no es un lujo: la mitad de los usos son de un organizador
    // armando un cruce entre otras dos personas.
    const mio = pedido || { clave: await quienEsCarta(i, env), como: 'tú' };
    if (!mio.clave) {
      if (!pedido) {
        const d = datosDe(i, idDe(i));
        anotar(env, ctx, idDe(i), d.nick, d.user, d.glob, i.guild_id, 'yo');
        return responderV2(RESPONDE.MENSAJE, dosPasos({ aqui: aquiEs(i.guild_id), titulo: 'Todavía no tienes tarjeta',
          sub: 'Para un versus hace falta la tuya: se consigue en dos pasos, y los dos son tuyos.', eventos: true, nota: ANOTE_CORTO }));
      }
      if (mio.id) {
        const d = datosDe(i, mio.id);
        anotar(env, ctx, mio.id, d.nick, d.user, d.glob, i.guild_id, 'otro');
      }
      return aviso(`${mio.como} todavía no tiene tarjeta: se consiguen verificándose en la página y con la primera ` +
                   'Tarea del **Pase de rapero**.');
    }
    // ⚠️ UNO CONTRA SÍ MISMO NO ES UN EMPATE, ES UN ERROR DE TIPEO. Dibujarlo
    // sale «bien» —dos veces la misma carta— y por eso conviene cortarlo: el
    // que lo ve cree que el comando hizo lo que pidió.
    if (mio.clave === rival.clave) {
      return aviso('Ésa es la misma persona de los dos lados 🙂');
    }

    const [ca, cb, meta] = await Promise.all([
      leerP(env, mio.clave), leerP(env, rival.clave), env.KV.get('meta'),
    ]);
    if (!ca) return aviso(`No tengo cartas de ${mio.como}.`);
    if (!cb) return aviso(`No tengo cartas de ${rival.como}.`);
    const ga = JSON.parse(ca), gb = JSON.parse(cb);
    const m = meta ? JSON.parse(meta) : {};
    const aqui = aquiEs(i.guild_id);

    // 🃏 SIN ELEGIR, LA COMPETITIVA SI LA TIENEN LOS DOS (26/10/2026: «el vs con la carta que corresponde»): un cruce se
    // mide en el Competitivo, que es lo que esa carta muestra. Si no, la de Servidor, como siempre
    const cual = String(val('carta') || (tieneReal(ga, 'competitivo') && tieneReal(gb, 'competitivo') ? 'competitivo' : 'servidor'));
    // ⚠️ SE DICE **QUIÉN** DE LOS DOS NO LA TIENE. «No se puede comparar esa
    // carta» deja a la persona probando las otras tres a ver cuál pega; con el
    // nombre, ya sabe. Es la misma lección del candado del selector: el
    // mensaje tiene que hablar de la persona correcta.
    // ⚠️ «NO LA TIENE» Y «TODAVÍA NO LA DESBLOQUEÓ» SON DOS COSAS. Es la misma
    // distinción que el bot ya hace con los botones de `/card`: Mark no tiene
    // País porque no tiene país —eso no cambia nunca— y a Drako le faltan dos
    // eventos para la Temporada —eso cambia el mes que viene—. Decirle «no
    // tiene» al segundo lo manda a pensar que está mal cargado.
    const faltan = [[mio, ga], [rival, gb]].filter(([, g]) => !tieneReal(g, cual));
    if (faltan.length) {
      const et = (CARTAS.find(c => c.id === cual) || {}).et || cual;
      const juntas = CARTAS.filter(c => tieneReal(ga, c.id) && tieneReal(gb, c.id));
      return aviso(
        faltan.map(([q, g]) => bloqueada(g, cual)
          ? `${q.como} todavía no desbloqueó la **${et}** — le falta competir.`
          // 🔑 las LIBRES: no le falta competir, le falta verificarse
          : sinVerificar(g, cual)
            ? (q.como === 'tú' ? 'Tú todavía no te verificaste' : `${q.como} todavía no se verificó`) +
              ` en DRA, y ${laDe(cual)} es de los verificados.`
          : `${q.como} no tiene carta de **${et}**.`).join('\n') +
        (juntas.length
          ? '\nLas que tienen los dos: ' + juntas.map(c => `**${c.et}**`).join(' · ') + '.'
          : '\nNo comparten ninguna carta desbloqueada, así que no hay versus posible.'));
    }
    // ⚠️ Y SI ES LA SERVIDOR, TIENEN QUE COMPARTIR UN SERVIDOR. `tiene()` sólo
    // dice que cada uno tiene ALGUNA carta de servidor, no que sea la misma.
    if (cual === 'servidor' && !svDeAmbos(ga, gb, aqui, m)) {
      return aviso(`${mio.como} y ${rival.como} no comparten ningún servidor, ` +
                   'así que las dos cartas saldrían de lugares distintos.\n' +
                   'Prueba con otra categoría.');
    }
    return responderV2(RESPONDE.MENSAJE, versus(mio.clave, ga, rival.clave, gb, cual, idDe(i), m, aqui));
  },

  // ⚠️ SE GUARDA EL APODO ANTERIOR, no un «1». Apagar es fácil —se le saca el
  // «#N | »— pero volver a prenderlo necesita el NÚMERO, y el Worker no tiene
  // el ranking: eso vive en el Sheet. Guardando el apodo entero se restaura
  // exacto sin que el Worker tenga que saber nada del Sheet, y si el puesto
  // cambió mientras tanto lo corrige la próxima corrida del sincronizador.
  async settings(i, env, ctx) {
    const gid = i.guild_id;
    if (!gid) return aviso('`/settings` va **adentro del servidor** que quieres configurar.');
    if (!puedeAjustar(i)) {
      return aviso('Esto lo manejan los **admins** del servidor (o quien tenga ' +
                   '*Gestionar roles*).\n' +
                   'Tu apodo se cambia con `/apodo` — y tu elección le gana a la ' +
                   'del servidor.');
    }
    const cfg = await ajustes(env, gid);
    return responderPanel(RESPONDE.MENSAJE,
      panelAjustes(aquiEs(gid) || 'este servidor', cfg));
  },

  // 🛡️ /antiraid — sólo el dueño del servidor (Dlx, 18/10/2026). Todo en `bot/antiraid.js`
  antiraid(i, env, ctx) {
    return AR.comando(i, env, ctx, ayudaAR(i));
  },

  // 🧭 /setup — los admins del servidor (Dlx, 19/11/2026: «tus elecciones», 1A 2A 3A 4A 5A). Todo en `bot/setup.js`.
  // ⚠️ `/settings` sigue igual: el setup escribe el mismo `cfg:<guild>`, así que lo último que se toque es lo que vale
  setup(i, env, ctx) {
    return SU.comando(i, env, ctx, ayudaSU());
  },

  async apodo(i, env, ctx) {
    if (!i.guild_id) return aviso('`/apodo` va **adentro de un servidor de la Liga**: ahí te cambio el apodo al toque.');
    const op = ((i.data && i.data.options) || []).find((o) => o.name === 'estilo');
    const r = await apodoPanel(i, env, op ? op.value : 0);
    return r.aviso ? aviso(r.aviso) : responderV2(RESPONDE.MENSAJE, r.msg);
  },

  // ⏳ el comando de antes: Discord tarda un rato en sacarlo de la lista de cada servidor
  numeral() {
    return aviso('`/numeral` ahora es **`/apodo`**: eliges cómo va tu apodo —con tu #N, tu crew, tu puesto de la ' +
                 'Temporada, tu ELO, tu bandera o solo tu nombre—.');
  },
};

/* ════════════════════════════════════════════════════════════════════
   EL LOBBY WEB. Una prueba chica, pedida por Dlx el 23/09/2026:
   «quizás haya una forma de crear una pagina web gratis sin hosting…
   un minihub online aparte de discord, como un lugar de feed o lobby».

   🔴 NO CALCULA NADA, Y ESE ES EL PUNTO. El Worker tiene **10 ms de CPU
   por request** —el límite que manda en todo el proyecto— así que
   armar un ranking leyendo 45 claves de KV por visita está fuera de
   presupuesto. `bot/subir_web.py` deja el payload masticado en UNA
   clave (`web:lobby`, 3.7 KB) una vez por ciclo, y acá se lee y se
   pega en un template. Es la misma regla que ya sigue `/card`.

   ⚠️ LA CUENTA ATRÁS LA CORRE EL NAVEGADOR, con el reloj de quien
   mira. El payload trae el **instante** en ISO; si trajera «faltan 30
   min» mentiría desde el segundo uno, porque se escribe una vez por
   hora. Es lo mismo que aprendió `getProximos()` en el Apps Script.
   ════════════════════════════════════════════════════════════════════ */
const UL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAMAAABrrFhUAAAASFBMVEX49vdPwasptJopspgpspcpsZcjt5l7hpMdhHHnGnhcJ0TnE3XkE3TkE3PkE3LSE2vHCmEGBQcDBQUDAwUDAwQDAwMDAQIBAQB0KQ4gAAAWQUlEQVR42u2d6YKjuA6FHVLOSkiZQPL+b3olGQIGL7IxJHV7+DHTS1V1zockb5Is9v/mczheb/SIf1z/PwlAFoP+fxGALPaD/n8RQLG/D/o/A0A6no3e/1j/tgB6nYXj2a8PQh5M/ZsBIGGdTvjVyfIYX7ASBXmQpv5NALy1a+EKnrp5TZ6mxj/XIN4UVtFfbgqgt3iplXdqn23T1PAoevBXddM+u7/UHGTvE6u+/5UB6De/J+0k71l3T2N7ur/TX0kU9hrCivpXBKBfvUTx2sSdwm0gGm0L2hLyMLDqXwsAqf/pxD/Z0icUngOE5Qws/r8WALJ8fPVNovgJhKdmsCweOPSvAID8HtQ/tdk3Sx/tDsCARoa89r8CAP3yVU3qm0wPcISfpxaYgVN/XgDk+fDyX682n/qRHSSbgVt/TgDdy4cPmlt9z+CJ4UDGI/Dozwegk5/V9B1mEItAHo5O/bkAvOWvp75nEI0A9JdO/ZkAbCXfRJBDfxYA8Po3kz9GsJfL9WcAgNa/pfwBAccPQP/Np385gA/INxAE9Vde/UsBwMAvT83m8t8IAn6A+qvbigD0628+IL9D4PcDhv5FAOD1k/U3H3tgauTxAzna/l8DAL7++iPWbxhBDeOBTNafDgCCP7z+9qPyCUGDRmCJBDz9yQC099cf148IwAgsbsDTnwoArO4bXn9HoMXhQCbpTwOgzb/+Ev39cGC4AVd/EgA0/+b1NfK1G7wMN2DrTwFA5t98lX5tBIMb8PUnANDm33zdQ24gY/XHAyD9qmm+lYCM0x8LAMNf+43vX88LnxAK4/RHAsDJ79eMftZJEYRC6/Z/HgAY/r9o9LOHwvu1uq0EgML/F8vHR70uVRQB8f+lHwnE2YD4P9MfTUB8Xn89ebYlIGL0qzXEN89ZssxCCFEExAffP515Yi6IGjKllM4lcR4vsdjEEBAf04/qKRHmcDi8E+Xg15BYcEEIdjvg7cABAe5YIJjzn9z69bY2iC+Ox+P9fsfPAv+7w+8kUKAj5ucMQQ3EmAS4o6Fgzv9z+78+2wHt1RUf+ixX/SAFMAVKr5kgqF8nySZwvVWZAKD+zO+/xc1cfPlHMgDQXpU4gcX/EARkIGebjgAAtiKaB5NAJgAr6H/2YQ/N/QB7OQABzKCfw5cI5N4hGBsBAjgwPw2TgODor5t6hWMdcPJnlx2KsQ+9YfhcyOB+lJODBwCwOx54TvBoXr8MAoKz/n/mnwC14/TQRpEtHO/XEYJrCX7wY24+I4C7lIq1IH20ikFAfHgCXPdZkapD0Mu/0WhAR++XdyRAF6jufCdgTAfCALZYANTdkf8BajnoE4P5o/rRCUQPALLduU6gh4JlAPIHQF8KFAwNmM4AsbA8HuRkE15HzxOkO90LphNwAqEI6W833M0ABJTQUV5H+sd+iC4AsfLIdQIgEAoD4ptWwDV47YkISAMAugF9EAIAVi25TgCBMBAGRN4AsHRZWxOB611aN+Oa5okAyus9wgQu6RkiMQFAS35ianP/NElJ4kTgfrBux8KwqS2gYsfBYBgQ/hkAK9Z0i/qnnte8n5ZYxEKgEx4YAq0EGiUp5zPCBACBNwz4LIDlADSCPZ99uQ88eoLf1QfVLzKFKAKng5wDwMHgAnD2tOt9jTEBVZUpADgOQHMYEi/ljpY157Ki53Y+09oWITTPZwCBuSX2PuKaxQGloOoTJkkxUSDgBMLnAJx3T+JBeklL2eEfqvQ693xHCJQ/7lZu7Io969fFkfMCGWkFjA9HnDHzTQAejxOI1BGAljOoHsTDwvuuH5Bcjlc0N8RwBgawuG/n2lutuTVix9OS7jBk5MLRFwyUt4i5QPN4qXgXCDhAt6GDdk+bOHAmSRP3oy0vu0IGsLJtDfX41qFu7tLFjv27aBKrxdwFCX32K66Jns1yJxDuKZB7BMA3p/OVQfqBlvQFRU1c1s4IlBUubCGfclIE864OHJfNag7h/NfrNcYHPOtCkWIA8OZ06YbezRhlKsIfFSYBkk/ppCP1teq176eF06yyWSQQNRK6TUC49Lv3QHBF4i7ewc82HnVgXQubOH1KSVf8Q+qXVAgfZHlDH+ASeDjXBCIhArb2xLyReQ7yK5jTvLf2hrqfpTWx+K/E+IA7DoqUKQBkJElnnvYB9/e09cOuFsnXWzogv1V5iiDRBG4R4wAScDiBFUBoEViP8nEs3w3j1K3f1QAzfcvvI0eeOuDjvTjx9+poWcgFwJgDegnAkIhLtko7v5Zf45QptuzPMx5gIYSMWay74qAFwA9nF6B+tR4CGAfg9YN8/Y7YBR7Tn3OQbgb3qMlg4zABkboKpnwcZxyAjTvj9afI38ud2MHZwL5wQI4KAi4TEMnbQHXtIoB1iuj9fex/vi4yqd5T4LOTdgSxABr75pBI3waB8OYgQJ8NlqH1O1wUCZHvpxCiQ3CwOALOw6IA2E1A2CIAK7jqUgVXFDx1BzpdCmtK5P/ZCwGr6s4KCquvPvn6HfuDItEAas+LhQ976U5zdOZe2sCHAM5V1SE4zP0g9tDKagIWF2DtAz3dc6FREKHczUT9HQBAUCGCXTEzglgA1rmASBsCPH5t6O+ydxMnOwighF2FDsHUCKJ37W0rApGyE/5OSx7W6G79yZO9ogOAWQOawCQSRAOAuByyADoLZ23cSmOXxqq/XaQfptS7DgAuqgnBxA3iz23amQmIhJ1QY8sKOkaMVBr6m0X6Qd5OiH5DtzeCQzH9tHEmcPEDkIwxcPL+IXtokPnzM3hQ/VqmfwgC/c5KaSXQ1ItGQpGwDDL0w473yeCRTz/6gBj29MENbATqZZMhERkCjcBGBqMGE9A8ek7LF76yoIFw2GSeEZC036AixgFVelwAefoPwx6NsQjseHV/ZA4Asli88CcTOI9soKyOJgGcD8uoCr5pGBRxHmAYdvfldW8CMmsA0ATElMB5YgOw7JCnV/r2qIg6DTQMe5Q+RmqNAKBy6IeoKjWBUSBAAsNoiMmGh4gyTvABdwwI5oOYhv1+4fosazwtaeMdwN5ctMAwgCuCstQQwAZoPjAyEsglQzfgToonPiBiPMDmAP02sVwyAgzdNLvjoRGBvdAI4MC1xFkxjQWTXVjJN4KpD4gIDzAMezxlIMHDWVJsBJTy3W6zyx8d+Xjxg5EQEJzPqP7cr4+LMQHIqTowezmgDzi6yoamwebUdmwupDjVAHQPpkvXc7LLmxx/f3EodsJ8dsW0U05nBIxZ0WRFJPgeMHUANfmrkQHwAegmPNR2sdE9RvHU3QyhcCS+3w0Mdrtp+gTuwaERSE5Hi4kPCPYsaBoBL0YOr0obAromPGYizfwHFKixKHY72BWw7RRThiUYwYHR0edhLgmFuQ6IMIDaGDFep5Q5AKY8tLPaEARgOSIYjo8d/dKvR+0HAQTmUbFgZwRMDMD8YizlaJvYEOgoxLcBCB2U6JZ5dw4C0wf4AEwDmK0aX24Djq1Eq18p82idO4MIAo3NXAACg2Bbn9wGQNufTaQHODd00gCQG5wZCMzJoGBuBUzfqwcWH4CjEil5JUVuoBF4pwXjICASPKDAEKhcT2P79JZW8jjxHr6rdi25E3rnQqLWsTuZC/sAE4DxUuhIxv0oyz6A5TIBnL+P60UNf0tdS9JoUOp6m4Nrx9AFwBcCDA+A4fjieU67+affWR45/ibD/RYtpnUDCcy4d/kpzgRmAAJbzMZHEqHH3LZ6H3P6nstLZQKgW0hUkHHvOjh7jEtpBG8hYCwDVgYAM+IlAMC3YP8UksjcPj1eDgheCDCmJusCoOxRzJdOvYaE8tSu7hBgBgEugPEr8Qk5xgM4jgEAasw1d7OVnAOFO2VnuYdBKwAVBaByPPezE4DrW+jEowcAU0O/ccmCmUPneaPj9ZDgxMDamAbqLZryXFqec+UG4P2WnAAgh87rAToKzgG454E0NzVjwNmed1n6APi+ZQLg6PQuDgDwgUD2yOMdBQU3BsotAZydrsIEADW3PkGjYUDEx8BNAJxd3sUBQAW3ygvg8u0AStePZgEIrWzUXwbAmgyYO3YsAN708Mf3ADiE6ynCuSNzAN4F/nR9/kkAJ+WpqGFvcI8OBwRnGvD6HgCXF9ZU7RcW/Y8mAoI7DfgWAK1qVegitnD21JApMgBomUuhT1uAwtdReDPvOZlOvxMAp7ph7wd+GAC8vlHVUWLVezsDwJ8IhgEc5aoAmuH6LashcFK9XjEApvsTYTXT/YzMAOqh8tBmCAwPGMbBdQCodQEMtadPqDydGQLDA+IA1NEA2snO+AoAGqchcDxgbQDTPb11AHQQ2g5CbwicMWB1AJPDkfUADI0Zh+spGfneNgCKCaDgqHmeNgQwVKMrKsw8qbZZEwDl7ATUTM7HVgfQ9SPQd9YyqiiWAMBqtrCaybdsAGAUEepmVQCFZKgxawW2AtCPDUkA2EGwy+D1qzFnj1sCiMyYTZkISQaASUbJ3wYwa+siWQDGB+p/HcAkb4+KeUJqxtgy7gjlud4gGsCsmIehZuQEGfcE81xwEg1gMrErWACGnPGcm6J5CLyiNkRmSUuQjsVQg67TlVLkPBfI0uNwBkDWLTNFjgDsWGreTpD1XCAPgRkAf47cdHXnusllumjvvjGvBWQgYNsUfa0BoK+myXo0xm506N8Wr9gHI7akpYO9J8t0sO5S/jKfDS7udTs7GIlJkvOawGy20vVPyHw4upRA/OGo5T4/qwlY9q3oe3MDWHjhQSyA+TDgMgHLfJUOMnIfj7Oq3DMCsASBadM094QdbSB7fsAyJ3hkALC3dA50rFhqnfeTGYBc0PTeliITTJZn3erq2Lp95c8QWWgCNgDcZHFfHHSsWVcBkG4C42RhwSwZs2XvWttnbgUglAXDLRwT++QgQFd7fxJAsg/E5wo7ynjmYWBTAMlLAgcA/w+zFnHMCGwIYMHlF/Z0eRkfBPAxL7jcFkCqD9gKJsJR0F4NOAmEfwKAtWQmrnB0Uqf1MQCqXRoC2ACcPmAS2BZAYhR0AfBPLJwVsQaBLkdoAuBJU+Eyd65w8jBgLZwM7Il46ll1taIHQLcWcPS2ptY4WwJwlM4m+4BhA1YAYHIEoHQAwL9U2wFIrB73VYUPBHoAdTyAOgXAM+HGVjeAUAMFd0kzVazSD6VPKcwfpF5Hh6gBQI8sfDAylOHuzeJbfVdDbK99EXGnhLecETo90x1Z1awONACAGoS9nSYIwKi/ttRut5F91qOaqPg6I3RuYAkCnP0QNoDQE5MfFdtGx7IzOOvgUHUfMyYEGDOHhQCO4dNzdxsdRiMlb0mv1FfFTX2gVo3whoDz+MUtBBBOH/A0Ugr7QLCzA7pBFwZb9b5A7ejxAK1rGDbcAG7YRcr3JHlAZDO1UFW3vjRS2+JLN5l4aQdwhsAOgAoDuFX+J8kDph0lg83EAlVrEo2A3sWxG6KULgJ1XnRELnNhAbiV7ufMTKB5TO+kFlEXLDM6G6ARaM36zjHtm04D0ADq8TGK98u9HEVMimhSS000gb0M1y5Pm5/59BsekArAvgiLbqkZ3mViNreYEPDooU+uMgFgecDttqStLrfFz7gDHvaD9H7y8YtLBkAGkKGtbui0gWkCeCkc3EOGo1M16ghq/+SXxQC4HmC5izm6tTa3YTh1wKPL5f36TQNYBCDcYDjYWpvu2Ap2lmZ3eMEbh47jW9Wtn1wtB3CrEkNgSnv9mCY/eAkfmMHNyQA84DhZOSYA4IZANesrnXLBQlzXfLqRTqIZXG9zCPDJj8poKJgI4Jg0DU68YoPOymOaxpIZkB1MIGCj6Mt0+ywBAD8Ehq/Y4DWYj24b3DG464tIAUT3i6n+JAB8D+BcsvLDumLgFN84ek++gBTgKUv87/E4+9RpAObbcOyblpIuWoKW4inNviTdyXko+i09+PWMdQIA7iSAedES75aJ9JaHshsfHaiTAYQ9gHvVVsI9I6nXJ1hIJwGYbsItu2yNd9lWBgLWHJd4AFwP4F+3xzt39l65mN7qJxVAcBocceEi88zJuG0pzQFaDwD+U83Porg3raVeutpHwjb9IjHX2bavlxijG1/8zcNin9iEo7tKLjEQ4E3y1n+hAxDzcHaDZzdrhC9ebtl37u1lPv3BfoKJ5yGxFy+zsxDx1sWEy1TdQSYNQMgDoq/eDly+bt7DHnuhKt5G4ul3mgJABXdxYi9f56dgYdH+RfIR6Csl3D+7VZfoJ6TfYwBOABFpiBALle86dot8n3G1r/gnpF85z2V8AE7sMmVoX6GbmHgZ6OshTsF7QFT0U0dvhDEAROUhYgcP3b/D0d5KdjcJwW0yeaqfm6XX7YYBhNLGpgjAdPuuRvNm8pTPcYI7UjeXTw7gmVgL72Q9qlbfaGYzvUwA2iAq6HrUbC0/4AB+C4hOxtV9XLCRy8l4MHUHrxCoPyDf7wABF0hISO+a2cweXm+T/M/DctFsDICkVESdsadi8/dW0e+ZAjEAMA6KvvxRr4D+AIDlZcqf1n8J6A8CkIX6uwRQf2hDSSxsUfzNj3GXSCqA6Cvev0h/MACyAIzvVv1rBsDQzwFwSC/R/PIAyHMBzP7M1MDqC/WHgyAlgf89AjQAZACg64GqP0dATRNCU2eCXS0M/DD1lwgozgDIWQu8a4Gq6/0PEYjQ718OjyoC/xIB+KC/XP3eDRGjJvTvEIjS79sTnNRF/xUCcfo9u8KjetC/RCDG/70HIzP9NBZ8/WgYq995NGbtEgS5bUDg8d3znypKv+t0GEt/bBmJSKD5WgKPBuZ/cfodCRJY/2bPycQ54be6waPlzn9DOUJU/+dKS73+fmko1OE/Ur81Tc75/r+aQOTw50mU9Oun4fD7AsEDGsTdE/RbkqWhDDzwcygUfpcRYH3mNUX/vF4grJ9C4Xe5AZn/LUX/rGSGo793g/bxNaNfkvvbqsb6RhAMAtfLlxgBZBwkmv+8ctTVLthayYxu0KjveP23VP1m9XiE/m5poD49M8bXXyW//gmAOP1AoEQj+KQfQNoBvP4l+scAYvW/I8Gn/ADGfrXs9RsAEvTTgHjHOcEH/OCBY//vtVymfwCQpF8bAfnBY3v5S63fAJCqn4aD7RHgv3e5xS99nACsbaIj/ADHg80QPDD2wcz/tlx+B6BYpF/7wX0rBGT8IP+aQ34HIN3+N0cwyM+jHwEUjssS4kMBIVhzUFSPzPIBAKR15tDfIagwHK5kBuj6NPBnlA8ADodM+glBCSOCNoNHbvUNqoeBL6t8tIB8+keeAO/qkY/BA02/Jdu/ZVWPAPLq7xBoM8hjB6QeX/4t98vXAK7ZfyQgwM+qGbSLDAG+udXqK3z5+eUDgNsqD0UDZEAQlHo84lc6OsVcafXlKurXA9AzuP52ECAkKK4t0Je+OvEY9q5rqV8VQO8L19sbAjgEiXu4Xzr8pa6aIvHVdS3L3waA7gGIEK73XyxvU6Per49x2dNjVC4Gv71cfrHvDBp+tfIHXBtA3wjxqin8UpmfUo9ZcVz7IOEgXWu/3tYXvxWAdzfIroVMdQcSmkX/4O+HHjP0xRt9sK0AjDDcyqvr6bpmbvmRtgXg7w76kY/yGQBf9PwH4D8A/wH4t5//AQgHyYDCbzHwAAAAAElFTkSuQmCC';

/* ════════════════════════════════════════════════════════════════════
   LA PIEL DE UNDER LEGENDS. Dlx, 23/09/2026: «que tenga un estilo
   futuristic pero tradicional», con la portada de la marca al lado.

   Los colores NO se eligieron a ojo: salen de contar los píxeles del
   logo. Teal #29B298 (27 %), magenta #E41373 (26 %), negro #030304
   (42 %) y el blanco #F6F6F6 de la píldora. Las dos sombras —#0D3A31 y
   #470C25— son las que la propia portada usa detrás del wordmark.

   ⚠️ LA TRAMA ES TEXTO, NO UNA IMAGEN. Es el recurso de la portada:
   «UNDER LEGENDS» repetido, una fila sólida y la siguiente contorneada.
   Hecho con `-webkit-text-stroke` no pesa un byte de red y escala con
   el ancho, así que en un teléfono se ve igual de tramado que en un
   monitor. Una textura en PNG habría que servirla, cachearla y mandarla
   al doble para retina.

   ⚠️ Y VA `position:fixed` A PROPOSITO: queda quieta mientras el
   ranking se desplaza por encima. Si scrollara con el contenido, la
   trama competiría con la tabla en vez de sostenerla.

   ⚠️ «FUTURISTA PERO TRADICIONAL» SE RESOLVIO CON GEOMETRIA, NO CON
   BRILLOS. Lo tradicional es la tipografía: negra, mayúscula, maciza,
   sin degradés dentro de las letras. Lo futurista es el corte — cada
   panel tiene una esquina biselada con `clip-path` y un filo de 3 px
   que va de teal a magenta. Glow y blur habrían tapado la marca, que
   es de tinta plana.
   ════════════════════════════════════════════════════════════════════ */
const LOBBY_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800;900&family=Barlow+Condensed:wght@600;700&display=swap');
:root{--ng:#030304;--pan:#0A0A0D;--tl:#29B298;--mg:#E41373;
--tls:#0D3A31;--mgs:#470C25;--bl:#F6F6F6;--tx:#EDEDF2;--tx2:#7E8B89;
--bd:#1A2523;--oro:#FFD24A;--pla:#D8DEE8;--bro:#C98A4B}
*{margin:0;padding:0;box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{background:var(--ng);color:var(--tx);
font:15px/1.5 Archivo,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
min-height:100vh;overflow-x:hidden}

/* ── la trama del wordmark ── */
.trama{position:fixed;inset:-6vh -14vw;z-index:0;pointer-events:none;
display:flex;flex-direction:column;justify-content:space-between;
font:900 clamp(34px,6.4vw,70px)/1.02 Archivo,sans-serif;
letter-spacing:-.025em;white-space:nowrap;user-select:none}
.trama i{display:block;font-style:normal}
.trama i:nth-child(4n+1){color:var(--mg);opacity:.16}
.trama i:nth-child(4n+2){color:transparent;-webkit-text-stroke:1.5px var(--tl);opacity:.30}
.trama i:nth-child(4n+3){color:var(--tl);opacity:.13}
.trama i:nth-child(4n+4){color:transparent;-webkit-text-stroke:1.5px var(--mg);opacity:.26}
.velo{position:fixed;inset:0;z-index:1;pointer-events:none;
background:radial-gradient(120% 78% at 50% 22%,rgba(3,3,4,.30),rgba(3,3,4,.90) 62%,#030304 100%)}

main{position:relative;z-index:2;max-width:880px;margin:0 auto;padding:26px 16px 40px}

/* ── cabecera ── */
header{display:flex;align-items:center;gap:16px;margin-bottom:8px}
.ul{width:82px;height:82px;flex:0 0 auto;border-radius:3px;
background:url(${UL_PNG}) center/cover;
box-shadow:0 0 0 2px var(--ng),0 0 0 4px rgba(41,178,152,.55),0 10px 28px rgba(0,0,0,.7)}
.tit{min-width:0}
h1{font:900 clamp(28px,7vw,46px)/.92 Archivo,sans-serif;letter-spacing:-.03em;
text-transform:uppercase}
h1 em{font-style:normal;color:var(--mg);
text-shadow:3px 3px 0 var(--tls),-1px -1px 0 rgba(41,178,152,.85)}
.era{display:inline-flex;align-items:center;gap:7px;background:var(--bl);
color:var(--tl);border-radius:999px;padding:3px 12px 3px 9px;margin-bottom:7px;
font:800 .62rem/1 Archivo,sans-serif;letter-spacing:.16em;text-transform:uppercase}
.era b{font-weight:900;font-size:.86rem;letter-spacing:.04em}
.sub{color:var(--tx2);font:600 .74rem/1.4 'Barlow Condensed',Archivo,sans-serif;
letter-spacing:.20em;text-transform:uppercase;margin-top:7px}
.sub s{text-decoration:none;color:var(--tl)}

/* ── paneles ── */
.blk{position:relative;background:linear-gradient(180deg,#0C0C10,#070709);
border:1px solid var(--bd);margin-top:20px;padding:16px 16px 14px;
clip-path:polygon(0 0,calc(100% - 18px) 0,100% 18px,100% 100%,18px 100%,0 calc(100% - 18px))}
.blk::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;
background:linear-gradient(90deg,var(--tl),var(--mg))}
.blk h2{font:900 .70rem/1 Archivo,sans-serif;letter-spacing:.22em;
text-transform:uppercase;color:var(--tx2);margin-bottom:12px}
.blk h2 span{color:var(--tl)}

/* ── lo que viene ── */
.ev{display:flex;justify-content:space-between;gap:14px;align-items:center;
padding:11px 0;border-top:1px solid var(--bd)}
.ev>span:first-child{min-width:0;flex:1 1 auto}
.ev>.reloj{flex:0 0 auto}
.ev:first-of-type{border-top:0;padding-top:2px}
.ev b{display:block;font:800 .96rem/1.2 Archivo,sans-serif;letter-spacing:-.01em}
.ev small{display:block;color:var(--tx2);margin-top:3px;
font:600 .68rem/1 'Barlow Condensed',sans-serif;letter-spacing:.14em;
text-transform:uppercase}
.reloj{font:900 1.30rem/1 Archivo,sans-serif;color:var(--tl);white-space:nowrap;
font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.reloj.vivo{color:var(--mg);font-size:.86rem;letter-spacing:.14em;
display:inline-flex;align-items:center;gap:7px}
.reloj.vivo::before{content:'';width:9px;height:9px;border-radius:50%;
background:var(--mg);animation:lat 1.1s ease-in-out infinite}
@keyframes lat{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.72)}}

/* ── tabla ── */
table{width:100%;border-collapse:collapse}
th{font:800 .62rem/1 Archivo,sans-serif;letter-spacing:.16em;color:var(--tx2);
text-transform:uppercase;text-align:right;padding:0 8px 9px;white-space:nowrap}
th:nth-child(1),th:nth-child(2){text-align:left}
td{padding:9px 8px;border-top:1px solid var(--bd);text-align:right;
font-variant-numeric:tabular-nums;font-weight:500}
td:nth-child(1){text-align:left;width:46px;color:var(--tx2);
font:900 .90rem/1 Archivo,sans-serif}
td:nth-child(2){text-align:left;font-weight:800;letter-spacing:-.01em}
tbody tr:nth-child(1) td{background:rgba(228,19,115,.07)}
tbody tr:nth-child(1) td:nth-child(1){color:var(--oro);
box-shadow:inset 3px 0 0 var(--mg)}
tbody tr:nth-child(2) td:nth-child(1){color:var(--pla);
box-shadow:inset 3px 0 0 var(--tl)}
tbody tr:nth-child(3) td:nth-child(1){color:var(--bro);
box-shadow:inset 3px 0 0 rgba(246,246,246,.5)}
.rg{display:inline-block;min-width:30px;padding:2px 7px;
border:1px solid var(--bd);border-radius:2px;background:#0E1614;
font:900 .70rem/1.3 Archivo,sans-serif;text-align:center}
.sv{font:700 .70rem/1 'Barlow Condensed',sans-serif;letter-spacing:.12em;
color:var(--tx2)}
/* ⚠️ LA BANDERA NO SE DIBUJA EN TODAS PARTES. Windows no trae la
   fuente de banderas, así que ahí el emoji cae a las dos letras
   («VE», «AR»). Eso NO se tapa: se le da forma de etiqueta, para que
   el caso de respaldo se lea como una sigla de país y no como un
   glitch. En teléfono sale la bandera y esto no se nota. */
.cc{display:inline-block;min-width:1.5em;margin-right:7px;font-style:normal;
font:700 .68rem/1 'Barlow Condensed',sans-serif;letter-spacing:.06em;
color:var(--tx2);vertical-align:.08em}

.pie{color:var(--tx2);text-align:center;margin-top:20px;
font:600 .64rem/1.6 'Barlow Condensed',sans-serif;letter-spacing:.18em;
text-transform:uppercase}
.vacio{color:var(--tx2);font-size:.85rem;font-weight:500}

@media(max-width:560px){
main{padding:18px 12px 32px}
header{gap:12px}.ul{width:62px;height:62px}
th:nth-child(4),td:nth-child(4){display:none}
.reloj{font-size:1.06rem}}
@media(prefers-reduced-motion:reduce){.reloj.vivo::before{animation:none}}`;

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* `ar` -> 🇦🇷 — el mismo truco que `lobby._bandera()` */
function bandera(cc) {
  cc = String(cc || '').trim().toLowerCase();
  if (cc.length !== 2 || !/^[a-z]{2}$/.test(cc)) return '';
  return String.fromCodePoint(...[...cc].map(c => 0x1F1E6 + c.charCodeAt(0) - 97));
}

/* Las filas de la trama. Cada una arranca corrida, como en la portada:
   si todas empezaran alineadas se leería una grilla y no una textura. */
function trama(n) {
  const P = 'UNDER LEGENDS ';
  let out = '';
  for (let i = 0; i < n; i++) {
    out += `<i style="margin-left:${-((i * 7) % 24)}%">${P.repeat(6)}</i>`;
  }
  return `<div class="trama" aria-hidden="true">${out}</div><div class="velo"></div>`;
}

// 🕐 EN HORA DEL ESTE, como todo lo que lee Dlx (24/09/2026: *«I told you to
// refer everything as my local time zone EST»*). Este pie decía «… UTC».
// ⚠️ CON `timeZone` Y NO CON UN -4 ESCRITO: de noviembre a marzo es -5, y
// un desfase fijo miente medio año sin avisar.
// 🌙 LA MADRUGADA, SIN CICLO. Dlx, 25/09/2026: «después de las 3am EST
// hasta las 11am EST que haya un retraso de cada 4 horas… a esas horas en
// sí los eventos no hay ninguno», y el mismo día: «durante las 3am EST y
// 11am EST no se hará ninguna sincronización para ahorrar más». De 3 a 11
// AM ET no corre el ciclo: la última es la de las 2:52 y la siguiente la de
// las 11:22.
// 🌙 Y DESDE EL 27/09/2026 TAMPOCO EL VIGÍA. Dlx: «eso de detección de LLAVES
// en vivo que sea apagado entre las 3am y 11am, que siga eso de las
// notificaciones también y el cron». Hasta ese día el vigía de los avisos
// seguía cada minuto; ahora duerme en la misma ventana. Ver `enMadrugada()`.
// ⚠️ La misma ventana está en `bot/madrugada.py`, y su self-check compara
// esta línea: si se cambia una sola, CI se pone rojo.
export const MADRUGADA = { desde: 3, hasta: 11, horas: [] };

function horaEsteDe(fecha) {
  const p = {};
  for (const x of new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
  }).formatToParts(fecha)) p[x.type] = x.value;
  return { h: Number(p.hour), m: Number(p.minute) };
}

/** ¿Es de madrugada, en hora del este? El vigía duerme; el ciclo, casi. */
export function enMadrugada(fecha) {
  const { h } = horaEsteDe(fecha);
  return h >= MADRUGADA.desde && h < MADRUGADA.hasta;
}

export function tocaCiclo(fecha) {
  if (!enMadrugada(fecha)) return true;
  const { h, m } = horaEsteDe(fecha);
  return MADRUGADA.horas.includes(h) && m >= 30;
}

export function horaEste(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const p = {};
  for (const x of new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', day: '2-digit', month: '2-digit',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).formatToParts(new Date(t))) p[x.type] = x.value;
  return `${p.day}/${p.month} ${p.hour}:${p.minute} ${p.dayPeriod} ET`;
}

function paginaLobby(d) {
  /* 🔴 LA COLUMNA DE RANGO SE CAE SI NO LA TIENE NADIE. Hoy el
     requisito son 10 eventos y el máximo del pool es 2, así que salían
     45 pastillas con un punto adentro: una columna entera ocupando
     ancho —el escaso, el del teléfono— para no decir nada. No se
     borra del código: vuelve sola el día que alguien llegue a 10. */
  const hayRg = (d.tabla || []).some(f => f.rg);
  const filas = (d.tabla || []).map(f => `<tr>
<td>${esc(f.pos)}</td>
<td><i class="cc">${bandera(f.cc) || esc(String(f.cc || '').toUpperCase())}</i>${esc(f.n)}</td>
${hayRg ? `<td><span class="rg"${f.rgc ? ` style="color:${esc(f.rgc)};border-color:${esc(f.rgc)}44"` : ''}>${esc(f.rg || '·')}</span></td>` : ''}
<td class="sv">${esc(f.sv)}</td>
<td>${Number(f.pts || 0).toLocaleString('es')}</td>
<td>${esc(f.ev)}</td></tr>`).join('');

  const evs = (d.proximos || []).length
    ? d.proximos.map(e => `<div class="ev">
<span><b>${esc(e.nombre)}</b><small>${esc(e.sv)}${e.cupos ? ' &middot; ' + esc(e.cupos) : ''}</small></span>
<span class="reloj" data-t="${esc(e.cuando)}">&middot;</span></div>`).join('')
    : '<p class="vacio">No hay ninguno anunciado con hora por ahora.</p>';

  return `<!DOCTYPE html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#030304">
<meta name="description" content="Liga Global — el lobby de Under Legends: lo que viene y el ranking de la temporada.">
<link rel="icon" href="${UL_PNG}">
<title>Liga Global — Lobby</title><style>${LOBBY_CSS}</style></head><body>
${trama(11)}
<main>
<header>
  <div class="ul" role="img" aria-label="Under Legends"></div>
  <div class="tit">
    <span class="era">LA NUEVA <b>ERA</b></span>
    <h1>Liga <em>Global</em></h1>
    <p class="sub">Temporada <s>${esc(d.temporada || '')}</s> &middot; ${esc(d.gente || 0)} raperos</p>
  </div>
</header>

<section class="blk"><h2><span>&#9201;</span> Lo que viene</h2>${evs}</section>

<section class="blk"><h2><span>&#127942;</span> Ranking de temporada</h2>
<table><thead><tr><th>#</th><th>Rapero</th>${hayRg ? '<th>Rg</th>' : ''}<th>Sv</th><th>Puntos</th><th>Ev</th></tr></thead>
<tbody>${filas || `<tr><td colspan="${hayRg ? 6 : 5}" class="vacio">Todav&iacute;a no hay nadie.</td></tr>`}</tbody></table></section>

<p class="pie">Se actualiza solo &middot; datos del ${esc(horaEste(d.sello || ''))}</p>
</main>

<script>
/* El reloj es del navegador: el payload trae el instante, no los minutos. */
function pinta(){
  var ahora=Date.now();
  document.querySelectorAll('.reloj').forEach(function(el){
    var t=Date.parse(el.dataset.t+'Z');
    if(isNaN(t)){el.textContent='';return}
    var f=t-ahora;
    if(f<=0){el.textContent='EN VIVO';el.classList.add('vivo');return}
    el.classList.remove('vivo');
    var s=Math.floor(f/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60),q=s%60;
    var dd=function(n){return (n<10?'0':'')+n};
    el.textContent=h?h+':'+dd(m)+':'+dd(q):m+':'+dd(q);
  });
}
pinta();setInterval(pinta,1000);
</script></body></html>`;
}

// ── La puerta ─────────────────────────────────────────────────────────────
// 📏 LAS LECTURAS DE KV DEL WORKER, POR RUTA (05/10/2026). KV pasó de 32.000 lecturas por día a 63.000 en una semana,
// contra un techo gratis de 100.000, y el objeto lee sólo unas 200 por hora: el resto sale de acá. Cada lectura se
// cuenta bajo su ruta y su clave (las de cada persona, juntas: nunca de quién) y cada isolate le pasa lo suyo al objeto
// cada 5 minutos, que lo suma a `medidas` (`/avisos/estado`). Medir antes de arreglar.
// ⚠️ `t` arranca en 0: en un Worker la hora del arranque del isolate es 0, y la primera vuelta con algo contado manda
const MED_KV = { n: {}, t: 0 };
function kvMedido(env, ctx, ruta) {
  if (!env || !env.KV) return env;
  const kv = env.KV;
  const r = String(ruta || '').replace(/^\/avisos\//, '/a/').slice(0, 30);
  const medido = {
    get: (k, o) => { const c = r + ' ' + claveMedida(k); MED_KV.n[c] = (MED_KV.n[c] || 0) + 1; return kv.get(k, o); },
    put: (...a) => kv.put(...a), delete: (...a) => kv.delete(...a), list: (...a) => kv.list(...a),
    getWithMetadata: (...a) => kv.getWithMetadata(...a),
  };
  if (ctx && ctx.waitUntil && env.AVISOS && Date.now() - MED_KV.t > 5 * 60000 && Object.keys(MED_KV.n).length) {
    const n = MED_KV.n;
    MED_KV.n = {};
    MED_KV.t = Date.now();
    ctx.waitUntil(env.AVISOS.get(env.AVISOS.idFromName('liga')).fetch('https://avisos/medir', {
      method: 'POST', body: JSON.stringify({ kv: n }), headers: { 'content-type': 'application/json' },
    }).catch(() => {}));
  }
  return new Proxy(env, { get: (t, p) => (p === 'KV' ? medido : t[p]) });
}

// 🛡️ UN FRENO POR IP (Dlx, 14/10/2026: «Las dos», a «contra un DDoS que agote la cuota gratis»: este freno y, cuando
// haya, un dominio propio con la regla de Cloudflare). Medido ese día desde afuera: 60 pedidos seguidos a la API pasaban
// todos. ⚠️ LO QUE ARREGLA Y LO QUE NO: en el plan gratis un pedido que llega acá ya cuenta para los 100.000 del día
// aunque se lo rechace; lo que este freno corta es lo de atrás —el Worker, el objeto y KV—, así que una IP que inunda
// gasta la mitad y no toca los datos. Lo que frena ANTES de contar es la regla de Cloudflare de un dominio propio.
// ⚠️ Es por isolate (la memoria de esta copia del código en ese datacenter), no global: frena a una IP que manda
// muchísimos, no a un ataque desde miles de IPs (eso lo frena Cloudflare). El techo deja de sobra a una página normal
// (unos 10 pedidos al abrirla) y a muchos detrás de la misma IP (una escuela, un celular con CGNAT)
/** La IP para contar: IPv4 entera; IPv6 por su bloque /64, que es lo que tiene una casa o un celular (adentro de él
 * se cambia de dirección gratis, y contarlas sueltas dejaría pasar a quien las rota) */
const bloqueIP = (ip) => {
  const x = String(ip || '');
  if (x.indexOf(':') < 0) return x;
  const p = x.split(':');
  return p.slice(0, 4).join(':') + '::/64';
};
/**
 * 🛡️ ¿Este pedido es de la página (underlegends.pages.dev)? (10/11/2026) Por dos cosas que pone Cloudflare: `cf-worker`
 * con su nombre y la IP de los Workers. Medido ese día con un eco (httpbin) desde la página: llega `Cf-Worker:
 * underlegends.pages.dev` desde `2a06:98c0:3600::103`, y si la página manda OTRO `cf-worker`, Cloudflare lo pisa con el
 * suyo — o sea que ningún Worker se puede hacer pasar por ella. Y quien llama de afuera no tiene la IP de un Worker:
 * `cf-connecting-ip` sale de la conexión. Las dos juntas, sin inventar ninguna clave nueva
 */
export const PAGINA_CF = 'underlegends.pages.dev';
export const esIPWorker = (ip) => String(ip || '').startsWith('2a06:98c0:');
export const dePagina = (cw, ip) => cw === PAGINA_CF && esIPWorker(ip);
const LIMITE_IP = { max: 240, ventana: 60000, tope: 5000 };
const POR_IP = new Map();
/** ¿Esa IP ya pasó su techo en este minuto? Cuenta este pedido */
function demasiados(ip, ahora = Date.now()) {
  if (!ip) return false;
  let x = POR_IP.get(ip);
  if (!x || ahora - x.t0 >= LIMITE_IP.ventana) {
    x = { t0: ahora, n: 0 };
    POR_IP.set(ip, x);
    // la memoria se poda: un isolate vive horas
    if (POR_IP.size > LIMITE_IP.tope) {
      for (const [k, v] of POR_IP) if (ahora - v.t0 >= LIMITE_IP.ventana) POR_IP.delete(k);
      if (POR_IP.size > LIMITE_IP.tope) POR_IP.clear();
    }
  }
  x.n++;
  if (x.n === LIMITE_IP.max + 1) console.warn('[seguridad] freno por IP: más de ' + LIMITE_IP.max + ' pedidos en un minuto');
  return x.n > LIMITE_IP.max;
}
/**
 * 🛡️ ¿Esa clave (`ip:` o `pag:` + IP) pasó su techo? Con el binding de Cloudflare (`FRENO_IP`, 240 por minuto) y, si
 * falla, el de memoria (`demasiados()`).
 * 🔴 MEDIDO EL 14/10/2026 EN PRODUCCIÓN, Y FRENA MENOS DE LO QUE PROMETE: el binding anda en el plan gratis (300 llamadas
 * en un mismo pedido: 241 pasan y 59 no), pero su contador es de CADA MÁQUINA del datacenter y se sincroniza tarde. Una
 * ráfaga de una sola IP (480 pedidos en 40 s, desde IAD) se repartió entre muchas máquinas y no recibió un solo 429. Sirve
 * contra quien insiste desde una máquina; contra una inundación de verdad, lo que frena es la regla de límite de
 * Cloudflare de un DOMINIO PROPIO, que corta antes de que el pedido llegue acá y cuente para los 100.000 del día
 */
async function frenoIP(env, clave) {
  if (!clave) return false;
  if (env && env.FRENO_IP) {
    try { return !(await env.FRENO_IP.limit({ key: clave })).success; } catch (e) { /* el de memoria */ }
  }
  return demasiados(clave);
}
const muchos = () => new Response('{"error":"demasiados"}', { status: 429,
  headers: { 'content-type': 'application/json; charset=utf-8', 'retry-after': '60', 'cache-control': 'no-store',
    'x-content-type-options': 'nosniff' } });

export default {
  // ══════════════════════════════════════════════════════════════════
  // 🔴 EL CRON DE GITHUB DISPARA 1 DE CADA 9 VECES, Y NO ES ARREGLABLE
  // DESDE ADENTRO.
  //
  // Medido el 24/09/2026 sobre las 54 ranuras horarias desde el 22/09:
  //
  //     el ciclo ya estaba corriendo       26  (48 %)
  //     libres, y el cron disparó           3
  //     libres, y GitHub no disparó        25
  //
  // La primera mitad era nuestra —una corrida de dos horas se come las
  // ranuras siguientes— y ya está arreglada: el ciclo se partió en dos
  // trabajos y la compresión de las webp pasó de 2.5 s a 0.3 s por carta.
  //
  // La segunda no: `schedule` en Actions es **best effort** y GitHub lo
  // descarta bajo carga. De las ranuras LIBRES disparó el **11 %**. A las
  // 2:07am de ese día, con el runner vacío y nada en cola, no disparó.
  //
  // ⚠️ POR ESO EL DISPARADOR VIVE ACÁ. Un Cron Trigger de Cloudflare sí es
  // puntual, entra en el plan gratis, y este Worker ya está desplegado.
  //
  // ⚠️ Y VA OFFSET 15 MINUTOS del de GitHub (`7,37` allá, `22,52` acá) a
  // propósito. No se reemplaza al de GitHub: se le suma. Con los dos vivos
  // el ciclo arranca cada 15 min, y si uno muere entero sigue cada 30. Un
  // disparo de más no cuesta nada —el `concurrency` del workflow lo pone
  // en fila— y en un repo público los minutos son gratis.
  //
  // ⚠️ DEJA RASTRO EN KV SIEMPRE, no sólo cuando falla. Un disparador
  // que sólo escribe al fallar es indistinguible de uno muerto: las dos
  // cosas se ven como silencio. Con `cron:ultimo` la auditoría puede
  // preguntar «¿disparó en la última hora?», que es la pregunta que
  // importa. Es la regla de este repo — *lo que no se pregunta no se
  // entera de que dejó de andar*.
  async scheduled(evento, env0, ctx) {
    // 📏 las lecturas de KV del cron, contadas como las de las rutas (ver `kvMedido()`)
    const env = kvMedido(env0, ctx, 'cron ' + ((evento && evento.cron) || ''));
    // 🔑 EL CRON DE CADA MINUTO ES OTRO: el vigía de los avisos de eventos.
    //
    // ⚠️ SE VA ANTES DE TOCAR KV, y no es un detalle. Las dos marcas de
    // abajo son dos escrituras por disparo: con este cron serían 2.880 por
    // día, casi el triple de la cuota gratis de TODA la cuenta, que ya se
    // agotó una vez y congeló el hub. El vigía deja su latido en el Durable
    // Object —ver `/avisos/estado`—, que tiene cien veces más cupo.
    if (evento.cron === CRON_VIGIA) {
      // 🌙 DE 3 A 11 AM ET DUERME: no lee anuncios ni llaves (ver
      // `MADRUGADA`). Igual pasa por el objeto, que deja el latido con
      // `dormido` —quieto a propósito no es caído— sin tocar Discord.
      await vigilar(env, SERVIDORES.map((s) => ({ sv: s.sv, nombre: s.nombre, guild: s.guild })),
        DUENO, enMadrugada(new Date(evento.scheduledTime || Date.now())));
      return;
    }
    // 🌙 DE MADRUGADA, DOS CORRIDAS Y NO DIECISÉIS. Ver `tocaCiclo()`. Se va
    // antes de las marcas de KV: una madrugada quieta no gasta escrituras.
    if (!tocaCiclo(new Date(evento.scheduledTime || Date.now()))) return;
    // 🔴 `ctx.waitUntil` EN UN `scheduled` TIRABA EL TRABAJO ENTERO, Y ESE
    // ERA EL BUG. La primera versión hacía `ctx.waitUntil(async () => {…})`
    // y devolvía enseguida: el cron **no dejaba rastro en cuatro slots
    // seguidos** —dos ventanas de 30 min— con el handler desplegado, la
    // agenda registrada y el `workflow_dispatch` contestando 204 cuando lo
    // probaba desde afuera.
    //
    // Un `scheduled` ya tiene su propia vida; no necesita que le extiendan
    // ninguna. Envolverlo en `waitUntil` y volver agrega una forma de
    // perder el trabajo que no hacía falta — y **no falla**: la invocación
    // figura como exitosa y no hace nada. Con `await` funciona:
    //
    //     cron:arranco   4:52:45am
    //     cron:ultimo    4:52:45am · ok, HTTP 204
    //     y el ciclo arrancó a las 4:52am
    //
    // ⚠️ Y LA MARCA VA **PRIMERO**, que es lo que dejó verlo. Con la
    // escritura sólo al final, «no disparó» y «disparó y murió antes de
    // llegar» se ven exactamente igual: silencio. Las dos claves separan
    // esas dos preguntas y por eso se quedan las dos.
    //
    // 🔑 LAS DOS MARCAS VAN AL DURABLE OBJECT, no a KV: eran ~70 escrituras
    // por día de las 1.000 de la cuenta. Ver `marcarDisparo()` en
    // `avisos.js`. ⚠️ KV QUEDA DE RESPALDO: si el objeto no contesta, la
    // marca se escribe donde estaba antes, porque una marca que se pierde
    // es exactamente el silencio que estas dos claves existen para evitar.
    const marcar = async (cual, v) => {
      if (await marcarDisparo(env, cual, v)) return;
      try {
        await env.KV.put('cron:' + cual, JSON.stringify(v));
      } catch (e) { /* sin objeto y sin cupo: el problema es el binding */ }
    };
    await marcar('arranco', { t: new Date().toISOString(), cron: evento.cron || '' });
    await (async () => {
      const t = new Date().toISOString();
      if (!env.GH_TOKEN || !env.GH_REPO) {
        await marcar('ultimo', { t, ok: false, por: 'sin GH_TOKEN o GH_REPO en el Worker' });
        return;
      }
      let estado = 0;
      let cuerpo = '';
      try {
        const r = await fetch(
          `https://api.github.com/repos/${env.GH_REPO}` +
          '/actions/workflows/ciclo.yml/dispatches',
          {
            method: 'POST',
            headers: {
              // ⚠️ GitHub RECHAZA sin User-Agent, con un 403 que no dice
              // que el problema es el encabezado.
              'User-Agent': 'liga-global-bot',
              'Accept': 'application/vnd.github+json',
              'Authorization': `Bearer ${env.GH_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ref: 'main' }),
          });
        estado = r.status;
        // 204 es el éxito; cualquier otra cosa trae un cuerpo que explica
        if (estado !== 204) cuerpo = (await r.text()).slice(0, 180);
      } catch (e) {
        cuerpo = String(e).slice(0, 180);
      }
      // ⚠️ `marcar()` no tira: sin cupo de KV esta marca era una excepción
      // en cada corrida del día (el 24/09/2026 a las 7 PM ET).
      await marcar('ultimo', {
        t, ok: estado === 204, estado, cuerpo,
        cron: evento.cron || '',
      });
    })();
  },

  async fetch(req, env0, ctx) {
    // 🔑 LOS AVISOS, ANTES QUE NADA, Y POR RUTA EXACTA. El `POST /` de abajo
    // son las interacciones de Discord y verifican firma; `/avisos/*` es
    // una lista cerrada de cinco rutas que nunca llega hasta ahí.
    const camino = new URL(req.url).pathname;
    // 🛡️ EL FRENO POR IP (14/10/2026, ver `demasiados()`), para quien llama al Worker directo. No a las interacciones de
    // Discord (`POST /`: vienen firmadas y desde Discord), ni a lo que pide la página (`cf-worker`: el subpedido de
    // underlegends.pages.dev, que ya pasó por su propio freno), ni al ciclo (`x-lg-ciclo`, que se valida en cada ruta)
    // ⚠️ y no a las IP de Cloudflare (`2a06:98c0:…`): un subpedido de un Worker sale con ésas, así que contarlas sería
    // frenar a toda la página junta. Lo que pide la página trae la IP de quien mira (`x-lg-ip`, ver `ipDe()` en
    // paginas/_worker.js) y se cuenta por ésa
    // 🔴 LOS DOS ENCABEZADOS SE COMPRUEBAN (pasada del 19/10/2026): cualquiera que llamara directo podía mandar un
    // `x-lg-ciclo` cualquiera y saltarse el freno, o un `x-lg-ip` distinto en cada pedido y no frenarse nunca. Ahora
    // `x-lg-ip` vale sólo si el pedido viene de un Worker (`cf-worker`: el subpedido de la página), y el ciclo se salta
    // el freno sólo con SU clave (`claveCiclo()`)
    // 🔴 Y ESO NO ALCANZABA (pasada del 09/11/2026): `cf-worker` lo manda CUALQUIER Worker de Cloudflare, así que otro
    // Worker sin `x-lg-ip` no se frenaba nunca (la clave quedaba vacía), y con un `x-lg-ip` distinto en cada pedido era
    // una persona nueva cada vez. Justo lo que repetiría el 09/11 a propósito: miles de pedidos a lo que más lee el objeto.
    // Ahora la página se reconoce por las DOS cosas que pone Cloudflare y nadie más puede poner (`dePagina()`), y otro
    // Worker se frena entero, por su zona
    const ipQ = req.headers.get('cf-connecting-ip') || '';
    const cw = req.headers.get('cf-worker') || '';
    const pagina = dePagina(cw, ipQ);
    const ipPag = pagina ? (req.headers.get('x-lg-ip') || '') : '';
    const claveIP = ipPag ? 'pag:' + bloqueIP(ipPag)
      // la página sin la IP de quien mira (el lobby y lo de KV que Pages guarda en su borde): ya pasó por el freno de
      // Pages. Las vistas previas y los links cortos traen x-lg-ip desde el 18/11/2026 y se cuentan arriba
      : pagina ? ''
        // otro Worker: todos sus pedidos juntos, por la zona que le pone Cloudflare (no la puede cambiar)
        : esIPWorker(ipQ) ? 'w:' + (cw || '?')
          : ipQ ? 'ip:' + bloqueIP(ipQ) : '';
    let esCiclo = false;
    const kc = req.headers.get('x-lg-ciclo') || '';
    if (kc && env0.DISCORD_TOKEN) { try { esCiclo = kc === await claveCiclo(env0.DISCORD_TOKEN); } catch (e) { esCiclo = false; } }
    // 🤖 `/eventos-discord` tampoco: los eventos de Discord vienen firmados y desde Discord, como las interacciones
    if (!(req.method === 'POST' && (camino === '/' || camino === '/eventos-discord')) && !esCiclo && claveIP
      && await frenoIP(env0, claveIP)) return muchos();
    // 📏 cada lectura de KV, contada por ruta (ver `kvMedido()`)
    const env = kvMedido(env0, ctx, req.method === 'POST' && camino === '/' ? 'interaccion' : camino);
    if (camino === '/avisos/numeral') return numeralPagina(req, env);
    if (camino === '/avisos/apodo') return apodoPagina(req, env);
    if (camino.startsWith('/avisos/')) return rutaAvisos(req, env, camino);
    // 🔑 «MI CUENTA» CON DISCORD: ver `cuentaDiscord()`
    if (camino === '/cuenta' && req.method === 'POST') return cuentaDiscord(req, env);
    // 🔑 «SALIR» CIERRA LA SESIÓN: la borra del objeto y la cookie del navegador
    if (camino === '/cuenta/salir' && req.method === 'POST') {
      await sesionFin(env, req);
      return new Response('{"ok":true}', { headers: { 'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store', 'set-cookie': cookieSesion('', 0) } });
    }
    if (camino === '/cuenta/redes' && req.method === 'POST') return cuentaRedes(req, env);
    if (camino === '/cuenta/foto' && req.method === 'POST') return cuentaFoto(req, env);
    // 🔑 verificarse desde la página, entrando a DRA (01/10/2026)
    if (camino === '/cuenta/verificar' && req.method === 'POST') return cuentaVerificar(req, env, ctx);
    // 🔗 los roles vinculados de Discord (19/10/2026)
    if (camino === '/cuenta/rol' && req.method === 'POST') return cuentaRol(req, env);
    // 👀 a quién mira como propio quien no está verificado, con su sesión (13/11/2026, ver `cuentaMira()`)
    if (camino === '/cuenta/mira' && req.method === 'POST') return cuentaMira(req, env);
    // 🤝 unirte a los Tier 1 que elegiste, con tu permiso (13/11/2026, ver `cuentaUnirse()`)
    if (camino === '/cuenta/unirse' && req.method === 'POST') return cuentaUnirse(req, env);
    // 🤖 agregaron el bot a un servidor: el DM a Dlx (19/11/2026, ver `eventosDiscord()`)
    if (camino === '/eventos-discord' && req.method === 'POST') return eventosDiscord(req, env, ctx);

    if (req.method === 'GET') {
      const ruta = camino;
      // 🔑 LOS PERFILES: una lectura de KV y se reenvía crudo, igual que el
      // lobby con `?json=1`. Los pide la página cuando se abre un perfil.
      // 🔑 EL CALENDARIO DE LA LIGA PARA GOOGLE/APPLE, tal cual está en KV
      if (ruta === '/calendario.ics') {
        const crudo = await env.KV.get('web:ics');
        return new Response(crudo || 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n', {
          headers: {
            'content-type': 'text/calendar; charset=utf-8',
            'cache-control': 'public, max-age=900',
            'access-control-allow-origin': '*',
          },
        });
      }
      // 🔑 Y TODAS LAS LLAVES, IGUAL: la página las pide sólo cuando un link
      // `#/llave/<n>` apunta a una que ya no viaja en el lobby
      // 🔑 Y EL MURO DE PUBLICACIONES (28/09/2026), igual: se pide al abrir la
      // vista, así no viaja en cada visita. Lo arma `bot/muro.py`
      // 🏟️ Y EL DETALLE DE LAS LIGAS (14/10/2026), igual: las fechas y el flyer de cada una, al abrir Ligas
      // (`ligas.separar()` en bot/ligas.py: el lobby ya estaba al tope de lo que pesa)
      // 🏛️ Y EL SALÓN DE LA FAMA (16/10/2026): los MES AWARDS —qué se vota, cómo va el mes y los ganadores—, al abrir
      // el Salón (`bot/mes_awards.py`)
      // 🏷️ Y LOS TAGS DE CADA UNO (19/10/2026), al abrir la Guía (`sheet/catalogo_tags.py`)
      // 🏆 Y LAS COMPETENCIAS DE LA SEMANA (26/10/2026): la Copa, la Liga de 10 y la Rapid (`bot/competencias.py`)
      // ⚔️ Y EL RANKING DE DUELOS (29/10/2026), al abrir Duelos: el lobby se pasó de su tope (`bot/subir_web.py`)
      // 📅 Y LA TEMPORADA ENTERA DEL CALENDARIO (29/10/2026), al abrir Eventos o una llave: el lobby trae sólo 4 semanas
      // ⚔️ Y LAS ÚLTIMAS BATALLAS DEL RANKING ELO (09/11/2026), al abrir Divisiones: el lobby se pasó de su tope otra vez
      if (ruta === '/perfiles' || ruta === '/llaves' || ruta === '/muro' || ruta === '/ligas' || ruta === '/salon' || ruta === '/tags' || ruta === '/semanas'
        || ruta === '/competencias' || ruta === '/duelos' || ruta === '/calendario' || ruta === '/divisiones') {
        const crudo = await env.KV.get(ruta === '/llaves' ? 'web:llaves' : ruta === '/muro' ? 'web:muro'
          : ruta === '/ligas' ? 'web:ligas' : ruta === '/salon' ? 'web:salon' : ruta === '/tags' ? 'web:tags' : ruta === '/semanas' ? 'web:semanas'
            : ruta === '/competencias' ? 'web:competencias' : ruta === '/duelos' ? 'web:duelos'
              : ruta === '/calendario' ? 'web:calendario' : ruta === '/divisiones' ? 'web:divisiones' : 'web:perfiles');
        return new Response(crudo || '{}', {
          status: crudo ? 200 : 404,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'public, max-age=60',
            'access-control-allow-origin': '*',
          },
        });
      }
      if (ruta === '/lobby' || ruta === '/lobby/') {
        // ⚠️ UNA lectura de KV y un template. Nada más entra en 10 ms.
        const crudo = await env.KV.get('web:lobby');
        if (!crudo) {
          return new Response('El lobby todavía no se armó. Corre `bot/subir_web.py --aplicar`.',
            { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
        }
        // 🔑 `?json=1` DEVUELVE EL PAYLOAD CRUDO, sin dibujar nada. Es lo
        // que pide `underlegends.pages.dev`, que arma la página entera en
        // el navegador de quien mira: acá el Worker sólo reenvía lo que
        // ya está en KV, o sea **cero parseo y cero template**. Es el
        // camino más barato que puede tener esta ruta, y el que deja el
        // presupuesto de 10 ms casi entero.
        if (new URL(req.url).searchParams.get('json')) {
          return new Response(crudo, {
            headers: {
              'content-type': 'application/json; charset=utf-8',
              'cache-control': 'public, max-age=60',
              // ⚠️ SIN ESTO LA PAGINA NO PUEDE LEERLO. Pages y el Worker
              // son dos orígenes distintos; hoy el pedido pasa por el
              // proxy de Pages —que no necesita CORS— pero el día que
              // alguien lo llame directo desde el navegador, la falta de
              // esta cabecera se ve como «no cargó» sin decir por qué.
              'access-control-allow-origin': '*',
            },
          });
        }
        let d;
        try { d = JSON.parse(crudo); }
        catch (e) { return new Response('el payload no es JSON', { status: 500 }); }
        return new Response(paginaLobby(d), {
          headers: {
            'content-type': 'text/html; charset=utf-8',
            // ⚠️ 60 s: el ciclo escribe una vez por hora, pero la cuenta
            // atrás la corre el navegador, así que una copia de un
            // minuto no envejece nada que se vea.
            'cache-control': 'public, max-age=60',
          },
        });
      }
      return new Response('Liga Global — el endpoint está vivo. Discord entra por POST.',
        { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
    if (req.method !== 'POST') return new Response('nope', { status: 405 });

    const crudo = await req.text();                    // UNA vez, como texto

    if (!await firmaValida(req, crudo, env.DISCORD_PUBLIC_KEY)) {
      // 401 es obligatorio: Discord PRUEBA que rechaces una firma inválida
      // antes de aceptar la URL. Con 200 la rechaza aunque el PONG esté bien.
      console.warn('[seguridad] firma de Discord inválida');
      return new Response('firma invalida', { status: 401 });
    }

    const i = JSON.parse(crudo);

    if (i.type === RECIBE.PING) {
      return new Response(JSON.stringify({ type: RESPONDE.PONG }),
        { headers: { 'content-type': 'application/json' } });
    }

    // 📊 cada persona que usa el bot cuenta, una vez por día (ver `anotarUso()` en avisos.js, Dlx 04/10/2026). Con
    // waitUntil: Discord da 3 segundos para contestar y esto no los espera
    const usa = idDe(i);
    if (usa && ctx && ctx.waitUntil) ctx.waitUntil(anotarUso(env, usa, 'bot'));

    if (i.type === RECIBE.COMANDO) {
      // ⚠️ EL FRENO VA DESPUÉS DE LA FIRMA Y ANTES DE KV. Después, porque una
      // ráfaga sin firmar tiene que morir en el 401 y no ocupar una ranura de
      // nadie. Antes, porque frenar recién después de leer KV sería pagar la
      // lectura igual, que es lo que el freno quiere evitar.
      const esperar = frenado(idDe(i), 'comando');
      if (esperar) return espera(esperar);
      const fn = COMANDOS[i.data && i.data.name];
      return fn ? await fn(i, env, ctx) : aviso(`No conozco \`/${i.data && i.data.name}\`.`);
    }

    // ── 🗳️🎲 El modal de elegir: `vm:<voto>:<lado>:<apuesta>`. El voto va siempre; la apuesta, si escribió más de 0 ──────
    if (i.type === RECIBE.MODAL) {
      const [que, qg, lado, ap] = String((i.data && i.data.custom_id) || '').split(':');
      if (que !== 'vm') return aviso('Ya no pude leer eso: prueba de nuevo.');
      const esperarVm = frenado(idDe(i), 'click');
      if (esperarVm) return espera(esperarVm);
      const did = idDe(i);
      if (!did) return aviso('No pude saber quién eres: prueba de nuevo.');
      const fila = ((i.data.components || [])[0] || {}).components || [];
      const escrito = String((fila[0] || {}).value || '').replace(/[^0-9]/g, '');
      const monto = escrito ? Math.min(Number(escrito), 1e6) : 0;
      // ⏱️ «PENSANDO» PRIMERO Y LA RESPUESTA DESPUÉS (12/11/2026): son tres pedidos seguidos al objeto y a KV, y Discord da
      // la interacción por fallida a los 3 s (ver el `ve` de abajo, donde pasó). Con el aviso diferido hay 15 minutos
      // 🧱 y desde el 20/11/2026 el «un momento» ya va en V2, en el recuadro chico de `aviso()`, y la edición lo reemplaza
      const editar = (txt) => editarOriginal(i, V.avisoMsg(txt));
      luego(ctx, (async () => {
        let txt = '';
        try {
          const voto = await votoChat(env, did, qg, lado);
          const c = await datosApuesta(env, did);
          if (!monto) txt = voto + (c ? '\n' + await saldoChat(env, did, ap, c) : '');
          else if (!c) txt = voto + '\nLas apuestas todavía no están listas: prueba en un rato.';
          else txt = voto + '\n' + await apuestaChat(env, did, ap, lado, monto, c, true);
        } catch (e) { txt = 'No pude anotarlo: prueba de nuevo.'; }
        await editar(txt);
      })());
      return responderV2(RESPONDE.MENSAJE, V.momentoMsg(null, true));
    }

    if (i.type === RECIBE.COMPONENTE) {
      // ⚠️ TODO EL ESTADO VIENE EN EL custom_id. El Worker no busca nada, y
      // por eso dos personas en servidores distintos no se pisan. Además un
      // botón que se contesta sólo desde su custom_id NO CADUCA: el token de
      // la interacción muere a los 15 min, pero cada click trae uno nuevo.
      const id = (i.data && i.data.custom_id) || '';
      const [que, quien, extra, dueno] = id.split(':');

      // ── 🗳️ «¿Quién gana?» (13/10/2026): `qg:<id>:<A|B>`, un voto por persona y sin plata ───────────────────
      // Quién vota es quien tocó (Discord lo firma); el objeto lo anota (`qgVotar()`) y la respuesta la ve sólo él. El
      // mensaje se actualiza con cómo va en la vuelta siguiente del vigía (`qgRevisar()`)
      // ── 👥 las crews (19/10/2026): `cw:si|no:<crew>:<invitado>` y `cw:salir:x:<quien>` (ver `crewBoton`) ──────────
      if (que === 'cw') return crewBoton(i, env, quien, extra, dueno);

      // ── 🧭 el /setup (19/11/2026): `su:v1:<acción>[:<dato>]`. El permiso se vuelve a mirar en cada clic, y los botones
      // del DM de Dlx (`su:v1:si|no:<guild>`) sólo los usa él (ver `componente()` en bot/setup.js)
      if (que === 'su') return SU.componente(i, env, ctx, ayudaSU());

      // ── 🌙 «Tu nota» y «Perfiles» del aviso de ganadores (`nn:<nota|perf>:<n>`, 18/11/2026): sólo a quien toca ─────
      if (que === 'nn') {
        const yo = idDe(i);
        const esperarN = frenado(yo, 'click');
        if (esperarN) return espera(esperarN);
        let f = null;
        if (!/^\d{1,7}$/.test(extra || '')) return aviso('Ese botón ya no anda.');
        try { f = JSON.parse((await env.KV.get('noche:' + extra)) || 'null'); } catch (e) { f = null; }
        const llave = [{ type: 2, style: 5, label: 'La llave', emoji: { name: '📋' }, url: HUB_URL + '/freestyle-rap/llave/' + encodeURIComponent(extra || '') }];
        if (!f) return aviso('🌙 Esa noche ya no está guardada (duran 30 días): las notas de todos siguen en **La llave**.', llave);
        if (quien === 'perf') {
          const pf = perfilesNoche(f);
          return aviso(pf.texto, pf.botones);
        }
        const tn = tuNotaNoche(f, yo);
        if (!tn) {
          return aviso(`🎯 No te encuentro en **${mdNoche(f.t)}**. Si jugaste, puede que tu cuenta no esté vinculada: usa **\`/vincular\`**. Las notas de todos están en **La llave**.`, llave);
        }
        return aviso(tn.texto, tn.botones);
      }

      // ── 🎞️ los toques del Drop (`dt:`, ver `pantallaDrop()`): el mensaje es efímero, así que sólo lo toca su dueño, y
      // el premio lo vuelve a leer el objeto con quien toca (`drop-abrir` pide el id Y la persona) ─────────────────────
      if (que === 'dt') {
        const yo = idDe(i);
        const esperarT = frenado(yo, 'click');
        if (esperarT) return espera(esperarT);
        const e = leerDt(id);
        if (!e) return aviso('Ese botón ya no anda: usa **`/drops`**.');
        // del 1 al 4 son los toques; el 5 es «Abrir», que le pide el premio al objeto (puede estar dormido: tipo 6 y después)
        if (e.k > DROP_TOQUES) return actualizarLuego(i, ctx, () => premioDropChat(env, yo, e));
        return editarAqui(i, toqueDrop(e));
      }

      // ── 📣 «Mostrarlo en el canal» (`dm:`, 20/11/2026, Dlx: «6C»): lo que te salió, público y sin que suene nadie. El botón
      // vive en tu mensaje efímero, así que sólo lo toca su dueño; todo lo que se muestra viene en el botón ────────────
      if (que === 'dm') {
        const yo = idDe(i);
        const esperarM = frenado(yo, 'click');
        if (esperarM) return espera(esperarM);
        const msg = mostrarDrop(id, yo);
        if (!msg) return aviso('Ese botón ya no anda: usa **`/drops`**.');
        return responderV2(RESPONDE.MENSAJE, msg);
      }

      // ── 🐉 «Abrir un Drop / Star» (`dd:<drop|star>:x:<dueño>`) y 🎽 el menú de `/equipar` (`eq:<lugar>:x:<dueño>`) ─
      // Discord, tanda 1. Con dueño, sólo él; sin dueño (el aviso del evento, tanda 2), cada uno abre los suyos
      if (que === 'dd' || que === 'eq') {
        const yo = idDe(i);
        const esperarD = frenado(yo, 'click');
        if (esperarD) return espera(esperarD);
        if (dueno && dueno !== yo) return aviso('Eso es de otra persona: usa **`/drops`** para ver los tuyos.');
        // 🎁 «Abrir mis premios» (el aviso de ganadores, 19/11/2026: Dlx, «ver mis recompensas en un solo botón en vez de 6»):
        // sin dueño; a quien lo toca, SUS drops para abrir, como `/drops` (efímero)
        // 🧱 DESDE SU PANEL (efímero), EL CLIC CAMBIA ESE MISMO MENSAJE (20/11/2026): antes cada clic de `/drops` o de
        // `/equipar` dejaba un mensaje nuevo. Desde un mensaje público (el aviso de ganadores), uno nuevo y sólo para ti
        const abrirEn = (trabajo, fam) => (esEfimero(i) ? actualizarLuego(i, ctx, trabajo, fam) : pensandoYEditar(i, ctx, trabajo, fam));
        if (que === 'dd' && quien === 'mis') return abrirEn(() => panelDrops(env, yo, i), 'drops');
        // 🥚 el Nido del campeón (el aviso de ganadores, 18/11/2026) no se abre en Discord: a él solo, el link de la página
        if (que === 'dd' && quien === 'nido') return aviso('🥚 Tu **Nido** se abre en la página, con su animación: ' + HUB_URL + '/freestyle-rap/?drops=1');
        if (que === 'dd') return (quien === 'drop' || quien === 'star') ? abrirEn(() => abrirDropChat(env, yo, quien), null) : aviso('Ese botón ya no anda.');
        // 🎒 «Cambiar» o «Ponerme uno» del inventario (`eq:<lugar>:ver:<dueño>`): el menú de ese lugar, en el mismo mensaje
        if (extra === 'ver') {
          if (!RANURA_NOMBRE[quien]) return aviso('Ese botón ya no anda: usa **`/equipar`**.');
          return abrirEn(() => panelEquipar(env, yo, quien, i), 'tienda');
        }
        const val = ((i.data && i.data.values) || [])[0] || '';
        if (!RANURA_NOMBRE[quien] || !val) return aviso('Ese menú ya no anda: usa **`/equipar`** de nuevo.');
        return abrirEn(async () => {
          const res = await ponerChat(env, yo, quien, val);
          return panelEquipar(env, yo, quien, i, res.texto);
        }, 'tienda');
      }

      // ── 📊 «Ver estadísticas» de un cruce (02/11/2026, el remake del VS): `vx:<id>` ─────────────────────────────
      // Dlx: «un botón para enviar un mensaje efímero con las estadísticas». La ficha ya la calculó el vigía al armar el
      // vs (`fichaVs()` en avisos.js) y está en el objeto: acá sólo se lee —una consulta, sin tocar KV— y la ve quien tocó
      // ── 👤 «Ver perfiles» de un cruce: `vp:<id>`. Los dos, con su cara, y sólo para quien tocó ──────────────────
      if (que === 'vp') {
        const esperarVp = frenado(idDe(i), 'click');
        if (esperarVp) return espera(esperarVp);
        let j = {};
        try {
          const r = await env.AVISOS.get(env.AVISOS.idFromName('liga')).fetch('https://avisos/vs-perfiles', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: quien }),
          });
          j = await r.json();
        } catch (e) { j = { error: 'red' }; }
        if (j.ok && j.comps) {
          return new Response(JSON.stringify({ type: RESPONDE.MENSAJE, data: { flags: EFIMERO | V2, components: j.comps } }), { headers: { 'content-type': 'application/json' } });
        }
        return aviso('👤 ' + (j.error === 'no existe' ? 'Los perfiles de ese cruce ya no están: duran dos días.' : 'No pude traer los perfiles: prueba de nuevo en un rato.'));
      }

      if (que === 'vx') {
        const esperarVx = frenado(idDe(i), 'click');
        if (esperarVx) return espera(esperarVx);
        let j = {};
        try {
          const r = await env.AVISOS.get(env.AVISOS.idFromName('liga')).fetch('https://avisos/vs-ficha', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: quien, todo: extra === 'mas' }),
          });
          j = await r.json();
        } catch (e) { j = { error: 'red' }; }
        if (j.ok && j.comps) {
          // 📊 la ficha en su caja (`fichaComponentes()` de avisos.js): con V2 no hay `content`, va todo en componentes
          // 📱 «Ver todo» y «Ver menos» cambian el mismo mensaje (tipo 7): el primero es uno nuevo, sólo para quien tocó
          const todo = extra === 'mas';
          const [lTodo, lLlave] = j.ctl || [todo ? 'Ver menos' : 'Ver todo', 'La llave'];
          const fila1 = [{ type: 2, style: 2, label: lTodo, emoji: { name: todo ? '🔼' : '🔽' }, custom_id: 'vx:' + quien + ':' + (todo ? 'menos' : 'mas') },
            { type: 2, style: 5, label: lLlave, emoji: { name: '🏆' }, url: HUB_URL + '/freestyle-rap/eventos' }];
          return new Response(JSON.stringify({ type: extra ? 7 : RESPONDE.MENSAJE, data: { flags: EFIMERO | V2,
            components: j.comps.concat([{ type: 1, components: fila1 }], (j.links || []).length ? [{ type: 1, components: j.links }] : []) } }),
          { headers: { 'content-type': 'application/json' } });
        }
        return aviso('📊 ' + (j.error === 'no existe' ? 'Las estadísticas de ese cruce ya no están: duran dos días.'
          : 'No pude traer las estadísticas: prueba de nuevo en un rato.'));
      }

      if (que === 'qg') {
        const esperarQg = frenado(idDe(i), 'click');
        if (esperarQg) return espera(esperarQg);
        const did = idDe(i);
        if (!did) return aviso('No pude saber quién eres: prueba de nuevo.');
        return aviso(await votoChat(env, did, quien, extra));
      }

      // ── 🗳️🎲 Elegir a uno: `ve:<voto>:<lado>:<apuesta>` (04/11/2026) ────────────────────────────────────
      // Con la apuesta abierta y plata en la billetera, abre el modal. Si no, es un voto y listo: un modal para escribir 0 sobra
      if (que === 've') {
        const esperarVe = frenado(idDe(i), 'click');
        if (esperarVe) return espera(esperarVe);
        const did = idDe(i);
        if (!did) return aviso('No pude saber quién eres: prueba de nuevo.');
        // ⏱️ EL MODAL SALE A TIEMPO AUNQUE EL OBJETO DUERMA (12/11/2026). La primera apuesta de verdad —Dlx, ACADEMIA, 5:42 PM—
        // no llegó: KV + el objeto recién despertado (se duerme a los 10 s, ver CLAUDE.md) tardaron ~4 s, Discord da la
        // interacción por fallida a los 3, y no se anotó ni el voto. Ahora se espera lo que se sepa en `ESPERA_MODAL`; si no
        // llega, el modal sale igual sin el saldo en el título —el envío (`vm`) valida todo: cerrada, propia, saldo— y el
        // pedido sigue en el fondo, así el objeto ya está despierto cuando se manda
        const pedir = (async () => {
          const c = await datosApuesta(env, did);
          if (!c) return { sinCuenta: true };
          const r = await env.AVISOS.get(env.AVISOS.idFromName('liga')).fetch('https://avisos/apuesta-info', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ quien: did, ap: dueno, clave: c.clave, inicial: c.inicial, desde: c.desde }),
          });
          return await r.json();
        })().catch(() => ({ fallo: true }));
        luego(ctx, pedir);
        const info = await Promise.race([pedir, new Promise((r) => setTimeout(() => r(null), ESPERA_MODAL))]);
        // 🎲 SIEMPRE SE ABRE, EN 0 (Dlx, 11/11/2026: «cada vez que presiones por quién va a ganar, automáticamente se abra eso de
        // apostar, por default 0, y que se pueda cambiar… para introducir ese sistema»). Sin Puntos o ya en el tope también: así
        // todos ven que se puede apostar. Sólo vota directo si la apuesta cerró, si es su propia batalla o si no tiene cuenta
        if (info && (info.sinCuenta || info.fallo || !info.abierta || info.propia)) return aviso(await votoChat(env, did, quien, extra));
        const mil = (v) => String(Math.round(v || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        // 🏷️ el nombre del ranking, corto: un equipo que no entra va «Liberia +1» (`etiquetaLado()` en avisos.js). Sin la
        // respuesta del objeto, el del botón que se tocó
        const delBoton = (((i.message && i.message.components) || []).flatMap((f) => f.components || [])
          .find((b) => b.custom_id === id) || {}).label || '';
        const nom = String(info ? (extra === 'A' ? info.ea || info.a : info.eb || info.b) : delBoton || 'él');
        const corto = nom.length > 12 ? nom.slice(0, 11) + '…' : nom;
        // ⚠️ el título y la etiqueta de un modal van hasta 45 caracteres
        return new Response(JSON.stringify({ type: 9, data: { custom_id: 'vm:' + quien + ':' + extra + ':' + dueno,
          title: ('Votas por ' + corto + (info ? ' · Tienes ' + mil(info.saldo) + ' Puntos' : '')).slice(0, 45),
          components: [{ type: 1, components: [{ type: 4, custom_id: 'monto', style: 1, required: true, min_length: 1, max_length: 6, value: '0',
            // 🎲 sin tope (11/11/2026, Dlx: «que no haya nivel max de apuesta»): lo que tienes ya está en el título
            label: (!info ? '¿Cuánto apuestas? 0 = sólo votar'
              : info.saldo <= 0 ? 'Todavía no tienes Puntos: deja 0 y votas'
                : info.ya ? 'Ya pusiste ' + mil(info.ya) + '. ¿Cuánto más? 0 = nada' : '¿Cuánto apuestas? Sin tope · 0 = nada').slice(0, 45) }] }] } }),
        { headers: { 'content-type': 'application/json' } });
      }

      // ── 🎲 Una apuesta en vivo (07/10/2026, el nivel «A full» del bot en vivo) ──────────
      // `ap:<id>:<lado>:<monto>`. Quién apuesta es quien tocó (Discord lo firma); el objeto valida todo —abierta, monto,
      // tope, saldo, que no sea su propia batalla— y la respuesta la ve sólo él. Los Puntos de Tienda son los de su cuenta
      if (que === 'ap') {
        const esperarAp = frenado(idDe(i), 'click');
        if (esperarAp) return espera(esperarAp);
        const did = idDe(i);
        const c = did ? await datosApuesta(env, did) : null;
        if (!c) return aviso('Las apuestas todavía no están listas: prueba en un rato.');
        return aviso(await apuestaChat(env, did, quien, extra, Number(dueno), c, false));
      }

      // ── 🏁 Lo que el lector no entendió de una llave (12/10/2026) ───────
      // Dlx: «hazlo interactivo, osea con 2 botones y menciona al organizador», y después: «al finalizar el evento…
      // tampoco tantas preguntas… con botones o con menú». El ciclo (`bot/finales.py`) contesta a la llave en su
      // canal: una batalla de dos con dos botones, varias con un menú por batalla. `dud:<llave>:<organizador>:<n.º de
      // pregunta>` y, en el botón, `:<lado>` (en el menú el lado es lo elegido). Lo marca el organizador, el staff del
      // servidor (administrar mensajes, el servidor o administrador) o Dlx. Queda en el objeto —el ciclo lo pasa a
      // `datos/decisiones.json`— y la pregunta se tacha del mensaje: la fila sale y abajo queda quién ganó.
      if (que === 'dud') {
        const esperarF = frenado(idDe(i), 'click');
        if (esperarF) return espera(esperarF);
        const did = idDe(i);
        let perm = 0n;
        try { perm = BigInt((i.member && i.member.permissions) || '0'); } catch (e) { perm = 0n; }
        const staff = (perm & 8n) !== 0n || (perm & 32n) !== 0n || (perm & 8192n) !== 0n;
        if (!did || (did !== extra && did !== DUENO && !staff)) {
          return aviso(`Esta pregunta es para <@${extra}>, que publicó la llave, o para el staff del servidor: ellos saben quién ganó.`);
        }
        const partes = id.split(':');
        const nro = String(partes[3] || ''), menu = i.data && i.data.component_type === 3;
        const v = menu ? String(((i.data && i.data.values) || [])[0] || '') : String(partes[4] || '');
        let nombre = '', cual = '';
        const filas = (i.message && i.message.components) || [];
        for (const fila of filas) {
          for (const c of fila.components || []) {
            if (menu && c.custom_id === id) {
              cual = String(c.placeholder || '');
              nombre = String(((c.options || []).find((o) => o.value === v) || {}).label || '');
            } else if (!menu && c.custom_id === id) nombre = String(c.label || '');
          }
        }
        if (!/^\d{1,2}$/.test(nro) || !/^[a-z]$/.test(v) || !nombre) return aviso('No encontré esa opción: prueba de nuevo.');
        let j = {};
        try {
          const r = await env.AVISOS.get(env.AVISOS.idFromName('liga')).fetch('https://avisos/final', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ k: `${quien}:${nro}`, v, nombre, quien: did }),
          });
          j = await r.json();
        } catch (e) { j = { error: 'red' }; }
        if (!j.ok && !j.ya) return aviso('No pude anotarlo: prueba de nuevo en un rato.');
        const quedan = filas.filter((f) => !(f.components || []).some((c) => c.custom_id === id
          || (!menu && String(c.custom_id || '').startsWith(`dud:${quien}:${extra}:${nro}:`))));
        const linea = `✅ ${cual ? cual + ' → ' : ''}**${j.ya || nombre}** — lo marcó <@${j.quien || did}>.`;
        const texto = `${String((i.message && i.message.content) || '')}\n${linea}`
          + (quedan.length ? '' : '\n¡Gracias! Ya está: en un rato los resultados entran al ranking de la Liga.');
        // 🧹 CONTESTADA LA ÚLTIMA, LA PREGUNTA SE VA SOLA (Dlx, 22/10/2026: «este mensaje debería desaparecer una vez que
        // la respuesta ya está»). Unos segundos después, para que quien la marcó alcance a ver el «¡Gracias!». Es un
        // mensaje del bot y lo borra el bot; lo marcado ya quedó en el objeto, y de ahí va a `datos/decisiones.json`
        if (!quedan.length && env.DISCORD_TOKEN && i.channel_id && i.message && i.message.id && ctx && ctx.waitUntil) {
          ctx.waitUntil((async () => {
            await new Promise((r) => setTimeout(r, BORRAR_PREGUNTA_MS));
            try {
              await fetch(`https://discord.com/api/v10/channels/${i.channel_id}/messages/${i.message.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bot ${env.DISCORD_TOKEN}`, 'X-Audit-Log-Reason': 'Liga Global: pregunta contestada' },
              });
            } catch (e) { /* si no se pudo, queda tachada como antes */ }
          })());
        }
        return new Response(JSON.stringify({
          type: RESPONDE.ACTUALIZAR,
          data: { content: texto.slice(0, 1990), components: quedan, allowed_mentions: { parse: [] } },
        }), { headers: { 'content-type': 'application/json' } });
      }

      // ── 🛡️ el anti-raid: el panel (sólo el dueño) y los botones de cada aviso (dueño o admin) ─────────────────────
      if (que === 'ar') {
        const esperarAR = frenado(idDe(i), 'ajuste');
        if (esperarAR) return espera(esperarAR);
        return AR.componente(i, env, ctx, ayudaAR(i));
      }

      // ── El panel de ajustes ────────────────────────────────────────────
      // ⚠️ SE VUELVE A CHEQUEAR EL PERMISO EN CADA CLICK, no sólo al abrir.
      // El panel es efímero y en principio sólo lo ve quien lo pidió, pero el
      // permiso puede haberle sido quitado entre que lo abrió y que apretó, y
      // «efímero» nunca fue un control de acceso. El chequeo es local, no
      // cuesta una consulta.
      if (que === 'cfg') {
        if (!i.guild_id) return aviso('Esto va adentro de un servidor.');
        if (!puedeAjustar(i)) {
          return aviso('Ya no tienes permiso para tocar los ajustes del servidor.');
        }
        const esperarA = frenado(idDe(i), 'ajuste');
        if (esperarA) return espera(esperarA);
        const cfg = await ajustes(env, i.guild_id);
        const antesCfg = JSON.stringify(cfg);
        const vals = (i.data && i.data.values) || [];
        // 📈 abrir el panel del ascenso, o volver: no cambian nada
        if (quien === 'asc') return responderPanel(RESPONDE.ACTUALIZAR, await panelAscenso(env, i.guild_id, cfg), i);
        if (quien === 'mas') return responderPanel(RESPONDE.ACTUALIZAR, panelMas(cfg), i);
        // ⚙️ «Elegir»: el menú de ese canal en su subpanel (20/11/2026). No cambia nada todavía
        if (quien === 'elegir') {
          return responderPanel(RESPONDE.ACTUALIZAR, panelElegir(cfg, extra) || panelAjustes(aquiEs(i.guild_id) || 'este servidor', cfg), i);
        }
        if (quien === 'volver') {
          return responderPanel(RESPONDE.ACTUALIZAR, panelAjustes(aquiEs(i.guild_id) || 'este servidor', cfg), i);
        }
        if (quien === 'nick') cfg.nick = !cfg.nick;
        else if (quien === 'apuestas') cfg.apuestas = cfg.apuestas !== true;
        else if (quien === 'canales') cfg.canales = vals.slice(0, 10);
        else if (quien === 'avisos') cfg.avisos = vals[0] || '';
        else if (quien === 'vivo') cfg.vivo = vals[0] || '';
        else if (quien === 'nivel' && NIVELES_CHAT[vals[0]]) cfg.vivo_nivel = vals[0];
        else if (quien === 'asc_canal') cfg.ascenso = vals[0] || '';
        // 📣 los de «Más canales» (16/11/2026): los mismos valores que guarda la página (`socioAjusteValido()` en avisos.js)
        else if (quien === 'aviso_evento') cfg.aviso_evento = vals[0] === 'chat' || vals[0] === 'no' ? vals[0] : '';
        else if (quien === 'ligas') cfg.ligas = vals[0] || '';
        else if (quien === 'ligas_no') cfg.ligas = cfg.ligas === 'no' ? '' : 'no';
        else if (quien === 'resumen') cfg.resumen = vals[0] || '';
        else return aviso('No sé qué ajuste es ése.');
        // ⚠️ Mismo motivo que en `/numeral`: sin `try`, un día sin cupo
        // de KV es «la aplicación no respondió» y el admin no sabe si quedó.
        try {
          // sin cambios, sin escritura: elegir otra vez los mismos canales no gasta cupo
          if (JSON.stringify(cfg) !== antesCfg) await env.KV.put(claveCfg(i.guild_id), JSON.stringify(cfg));
        } catch (e) {
          return aviso('No pude guardar el ajuste (`' + String(e).slice(0, 60) +
                       '`): quedó como estaba. Prueba de nuevo en un rato.');
        }
        // ⚠️ SE REDIBUJA EL MISMO MENSAJE (tipo 7), no se manda uno nuevo. Un
        // panel que deja un mensaje por click convierte tres ajustes en tres
        // paneles contradictorios, y el último no es necesariamente el que
        // está abajo.
        if (quien === 'asc_canal') return responderPanel(RESPONDE.ACTUALIZAR, await panelAscenso(env, i.guild_id, cfg), i);
        if (['aviso_evento', 'ligas', 'ligas_no', 'resumen'].includes(quien)) return responderPanel(RESPONDE.ACTUALIZAR, panelMas(cfg), i);
        return responderPanel(RESPONDE.ACTUALIZAR,
          panelAjustes(aquiEs(i.guild_id) || 'este servidor', cfg), i);
      }

      // ── /borrar-mis-datos: la confirmación ─────────────────────────────
      // ⚠️ SÓLO QUIEN LO PIDIÓ: el mensaje es efímero, pero «efímero» nunca fue
      // un control de acceso. El ID del dueño viaja en el `custom_id`.
      if (que === 'baja') {
        if (!dueno || idDe(i) !== dueno) return aviso('Ese botón es de otra persona.');
        const esperarB = frenado(idDe(i), 'click');
        if (esperarB) return espera(esperarB);
        if (quien !== 'si') {
          return responderPanel(RESPONDE.ACTUALIZAR,
            { content: 'Listo, no borré nada.', components: [] }, i);
        }
        let h;
        try {
          h = await borrarMisDatos(env, dueno);
        } catch (e) {
          return responderPanel(RESPONDE.ACTUALIZAR, { content: 'No pude terminar de ' +
            'borrar (`' + String(e).slice(0, 60) + '`). Prueba de nuevo en un rato: lo ' +
            'que ya se borró no vuelve.', components: [] }, i);
        }
        return responderPanel(RESPONDE.ACTUALIZAR, {
          content: '✅ **Listo.** ' + (h.clave
            ? 'Borré tu perfil, ' + (h.r2 ? h.r2 + ' archivo(s) entre tarjetas y foto' : 'tus tarjetas') +
              ', tus redes, tus votos y el vínculo de tus avisos. '
            : 'No tenías perfil en la Liga; igual solté tus avisos y borré tus votos. ') +
            'Quedó anotado que no te vuelva a sumar solo.\n' +
            '-# La página se pone al día en la próxima vuelta del ciclo (menos de una hora).',
          components: [],
        }, i);
      }

      // ── /notify: el menú de servidores y «Todos» ───────────────────────
      // ⚠️ NO SE GUARDA NADA: el panel se redibuja con la elección en el link
      // de «Activar». Un panel viejo (el de los DMs, con `ntf:sv:X` u
      // `ntf:off`) se cambia por el de ahora en el mismo mensaje.
      if (que === 'ntf') {
        const esperarN = frenado(idDe(i), 'click');
        if (esperarN) return espera(esperarN);
        const elegidos = quien === 'svs' ? ((i.data && i.data.values) || [])
          : quien === 'todos' ? [] : null;
        return responderPanel(RESPONDE.ACTUALIZAR,
          panelNotify(aquiEs(i.guild_id), await escuchados(env), elegidos), i);
      }

      // ── Los botones del versus ─────────────────────────────────────────
      // `v:<a>:<carta>:<dueño>:<b>` — cinco partes, una más que los demás,
      // porque un versus son DOS personas. El estado sigue viviendo entero en
      // el custom_id: el Worker no se acuerda de nada entre click y click.
      if (que === 'v') {
        const rival = id.split(':')[4] || '';
        if (dueno && idDe(i) !== dueno) {
          return aviso('Ese versus lo pidió otra persona.\n' +
                       'Tira `/versus` y tienes el tuyo, con tus propios botones.');
        }
        const esperar2 = frenado(idDe(i), 'click');
        if (esperar2) return espera(esperar2);
        const [ca, cb, meta] = await Promise.all([
          leerP(env, quien), leerP(env, rival), env.KV.get('meta'),
        ]);
        if (!ca || !cb) return aviso('Ese versus ya no está disponible.');
        const ga = JSON.parse(ca), gb = JSON.parse(cb);
        const m = meta ? JSON.parse(meta) : {};
        const aqui = aquiEs(i.guild_id);
        // ⚠️ MISMO CHEQUEO QUE EN EL COMANDO, Y NO ES REDUNDANTE. El mensaje
        // queda en el canal para siempre y su custom_id no caduca: si mañana
        // uno de los dos pierde esa carta, el botón de hoy se sigue
        // apretando. Sin esto devolvería un hueco, que Discord no avisa.
        if (!tieneReal(ga, extra) || !tieneReal(gb, extra)) {
          return aviso('Uno de los dos ya no tiene esa carta desbloqueada.\n' +
                       'Tira `/versus` de nuevo y te salen las que tienen los dos.');
        }
        if (extra === 'servidor' && !svDeAmbos(ga, gb, aqui, m)) {
          return aviso('Ya no comparten ningún servidor, así que las dos cartas ' +
                       'saldrían de lugares distintos.');
        }
        // 🗄️ un versus de antes (texto, sin el flag) se sigue editando como texto: un mensaje no cambia de formato
        if (legado(i)) return responderTexto(RESPONDE.ACTUALIZAR, versusTexto(quien, ga, rival, gb, extra, dueno));
        return responderV2(RESPONDE.ACTUALIZAR, versus(quien, ga, rival, gb, extra, dueno, m, aqui));
      }

      // ── 🏷️ el menú de `/apodo` (`apo:x:x:<dueño>`, 20/11/2026): elige el estilo y cambia este mismo mensaje ────────
      if (que === 'apo') {
        if (!i.guild_id) return aviso('Esto va adentro de un servidor de la Liga.');
        if (dueno && idDe(i) !== dueno) return aviso('Ese menú es de otra persona: tira `/apodo` y tienes el tuyo.');
        const esperarAp = frenado(idDe(i), 'click');
        if (esperarAp) return espera(esperarAp);
        const r = await apodoPanel(i, env, Number(((i.data && i.data.values) || [])[0]) || 0);
        return r.aviso ? aviso(r.aviso) : editarAqui(i, r.msg);
      }

      // ── 🧭 el menú de `/help` (`hp:ver`, 20/11/2026): cada comando en el mismo mensaje ────────────────────────────────
      if (que === 'hp') {
        const esperarH = frenado(idDe(i), 'click');
        if (esperarH) return espera(esperarH);
        const k = String(((i.data && i.data.values) || [])[0] || 'indice');
        if (k === 'indice' || !AYUDA[k]) return editarAqui(i, ayudaIndice());
        return editarAqui(i, ayudaPagina(k, AYUDA[k].length ? await leerMeta(env) : null));
      }

      if (que !== 'c' && que !== 's' && que !== 'l') {
        return aviso('No sé qué hacer con ese componente.');
      }
      // ⚠️ LOS BOTONES SON DEL QUE PIDIO LA CARTA, y el dueño viaja en el
      // custom_id igual que todo lo demas: el Worker no tiene que buscar
      // quien mando el mensaje original. Sin esto, en un mensaje publico
      // cualquiera te cambia la carta delante de todos.
      if (dueno && idDe(i) !== dueno) {
        return aviso('Esa carta la pidió otra persona.\n' +
                     'Tira `/card` y tienes la tuya, con tus propios botones.');
      }
      // ⚠️ El freno del click va DESPUÉS del dueño: si fuera antes, el que
      // machaca botones ajenos gastaría las ranuras del dueño.
      const esperar = frenado(idDe(i), 'click');
      if (esperar) return espera(esperar);
      // ⚠️ El sello también acá: si el botón devolviera la URL sin `?v=`,
      // cambiar de carta mostraría la versión cacheada vieja.
      const [crudo, meta] = await Promise.all([
        leerP(env, quien), env.KV.get('meta'),
      ]);
      if (!crudo) return aviso('Esa carta ya no está disponible.');
      const g = JSON.parse(crudo);
      const m = meta ? JSON.parse(meta) : {};
      const aqui = aquiEs(i.guild_id);

      // ⚠️ VENCIDA: SE APAGA LA CARTA Y SE EXPLICA APARTE. El tipo 7 redibuja
      // LA MISMA carta con todo deshabilitado —así el mensaje queda en un
      // estado correcto para siempre, no sólo «no responde»— y el porqué va
      // en un efímero, porque una interacción se contesta una sola vez.
      //
      // ⚠️ Se redibuja con `carta()` y no devolviendo `i.message.components`
      // tal cual: lo que Discord manda de vuelta trae campos que agregó él
      // —proxy_url, width, alto— y reenviarlos puede hacer que rechace la
      // edición. Del mensaje se leen sólo dos cosas, y las dos las escribimos
      // nosotros: qué carta se ve y qué servidor está elegido.
      if (vencida(i, Date.now())) {
        const cual = cartaEnPantalla(i) || extra;
        luego(ctx, seguir(i, 'Esa carta ya estaba quieta hace rato, así que le ' +
          'apagué los botones.\nTira `/card` y tienes una nueva.'));
        return responder(RESPONDE.ACTUALIZAR,
          carta(quien, g, cual, svEnPantalla(i), dueno, m, aqui, true));
      }

      // 🏟️ la carta de liga: el botón abre la mejor; el menú, la elegida. Un botón viejo puede pedir una que ya no está
      if ((que === 'c' && extra === 'liga') || que === 'l') {
        const lid = que === 'l' ? String((i.data.values || [])[0] || '') : '';
        if (!ligasDe(g).length || (lid && !ligasDe(g).some(x => x[0] === lid))) {
          return aviso(`${g.n || quien} no tiene esa carta de liga.\n` +
                       'Tira `/card` de nuevo y te salen las que sí tiene.');
        }
        return responder(RESPONDE.ACTUALIZAR, carta(quien, g, 'liga', lid || null, dueno, m, aqui));
      }
      if (que === 'c') {
        // 🔑 EL CANDADO DE LAS LIBRES (29/09/2026): la Competitiva y la de
        // País de quien no se verificó. No cambia la carta —no hay otra que
        // mostrar—: contesta aparte y efímero qué falta, y a quién le habla
        // depende de si la carta es del que aprieta.
        if (sinVerificar(g, extra)) {
          const yo = await quienEsCarta(i, env);
          if (yo && yo === quien) {
            const v = comoVerificarse(aqui);
            return aviso('🔒 L' + laDe(extra).slice(1) + ' es de los verificados en DRA — tu ' +
                         '**Temporada** y tu **Servidor** ya están. `/verificar` ' +
                         'te dice qué te falta:\n• si ya estás en DRA y Discord ' +
                         'sabe tu país (bandera en tu apodo o un rol de país), el ' +
                         'bot te verifica solo en la próxima vuelta (~30 min);\n' +
                         '• si no, ' + minuscula(v.texto), v.botones);
          }
          return aviso(`🔒 **${g.n || quien}** todavía no se verificó en DRA, así ` +
                       `que no tiene ${laDe(extra)}: es de los verificados.`);
        }
        // ⚠️ UN BOTÓN VIEJO PUEDE PEDIR UNA CARTA QUE YA NO ESTÁ. El mensaje
        // queda en el canal para siempre y su custom_id no caduca: si mañana
        // alguien pierde su carta de País —se queda sin país en el Sheet— el
        // botón de ayer sigue apretándose. Sin esto, devolvería un hueco.
        if (!tiene(g, extra)) {
          return aviso(`${g.n || quien} no tiene carta de **${extra}**.\n` +
                       'Tira `/card` de nuevo y te salen las que sí tiene.');
        }
        return responder(RESPONDE.ACTUALIZAR,
          carta(quien, g, extra, null, dueno, m, aqui));
      }
      const sv = String((i.data.values || [])[0] || '').toUpperCase();
      // ⚠️ ELEGIR UN SERVIDOR DONDE NO ESTÁS DEVUELVE LA INVITACIÓN, no un
      // candado. Es el cambio de Dlx del 17/09: la Servidor no se bloquea, y
      // lo que falta cuando la carta de TWR no te sale no es un evento — es
      // estar en TWR.
      //
      // Dos caminos, y la diferencia importa:
      //   · si esa carta EXISTE  -> va la carta (tipo 7) y la invitación se
      //                             manda aparte, efímera, sin tocar el canal
      //   · si NO existe todavía -> la invitación ES la respuesta (tipo 4) y
      //                             el mensaje público se queda como estaba.
      //                             Mandar una URL de R2 que no está deja una
      //                             imagen rota, y Discord no avisa.
      // ⚠️ ¿LA CARTA ES DEL QUE ESTÁ CLICKEANDO? De eso depende a quién se le
      // habla. Una lectura de KV en el camino del click: son 100.000 por día
      // y se usan 4.500, así que cuesta nada y evita mandarle a Dlx una
      // invitación que era para Sombra.
      const yoSoy = await quienEsCarta(i, env);
      const esMia = !!yoSoy && yoSoy === quien;
      const suyo = (g && g.n) || quien;

      if (!hayCarta(g, sv, m)) {
        if (!SV_DE(sv)) return aviso('No conozco ese servidor.');
        // La invitación SÓLO si la carta es tuya: al que mira la carta de otro
        // no le sirve que lo inviten a un servidor donde probablemente ya está.
        const inv = esMia ? invitaSi(g, sv, aqui, m) : null;
        if (inv) {
          return aviso(`Todavía no tengo tu carta de **${sv}**.\n\n${inv.texto}`,
                       inv.botones);
        }
        return aviso(esMia
          ? `Todavía no tengo tu carta de **${sv}**: la estoy generando. Prueba en un rato.`
          : `**${suyo}** no tiene carta de **${sv}** 🔒`);
      }
      const inv = esMia ? invitaSi(g, sv, aqui, m) : null;
      if (inv) luego(ctx, seguir(i, inv.texto, inv.botones));
      return responder(RESPONDE.ACTUALIZAR,
        carta(quien, g, 'servidor', sv, dueno, m, aqui));
    }

    return aviso('No sé qué hacer con eso.');
  },
};
