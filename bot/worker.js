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
import { Avisos, CRON_VIGIA, rutaAvisos, vigilar, pedirDM } from './avisos.js';
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
const ESTILO = { PRIMARIO: 1, SECUNDARIO: 2 };

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
  { sv: 'DRA', nombre: 'Discord Rap Español', guild: '841017460341604382', invita: 'https://discord.gg/SFVnEmVnKz' },
  { sv: 'FFA', nombre: 'Freestyle For All', guild: '1468472442925092958', invita: 'https://discord.gg/4TBvDP2Chm' },
  { sv: 'TWR', nombre: 'The Warren Rap', guild: '1115145044127666196', invita: 'https://discord.gg/fytxhaTCVj' },
  { sv: 'TFC', nombre: 'The Freestyle Corpo', guild: '1043611686524944404', invita: 'https://discord.gg/grUBFhsFFa' },
  { sv: 'SR', nombre: 'Snake Rap', guild: '492346406976356374', invita: 'https://discord.gg/qhKcQgU47v' },
  { sv: 'FTN', nombre: 'Fontana', guild: '1331924080835694655', invita: 'https://discord.gg/U5q5C8XnD9' },
  { sv: 'FRZ', nombre: 'Freestyle Zone', guild: '838593179187544064', invita: 'https://discord.gg/D3JZKM96zc' },
  { sv: 'URBF', nombre: 'Urban Freestyle Battles', guild: '1467763447117778989', invita: 'https://discord.gg/vThvc9f5xy' },
  { sv: 'EFA', nombre: 'EFA', guild: '1222746296377675867', invita: 'https://discord.gg/DDc3SqE8ax' },
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
      const [ya, cola] = await Promise.all([
        env.KV.get('d:' + id), env.KV.get('reg:' + id),
      ]);
      if (ya) return;                         // ya cargado
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
    const clave = await env.KV.get('d:' + u.value);
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
function carta(quien, g, cual, sv, dueno, m, aqui, apagado) {
  const enSv = cual === 'servidor';
  const v = m && m.sello;
  const svAhora = enSv ? svQueVa(g, sv, aqui, m) : ((g && g.sv) || '');

  const componentes = [
    {
      type: COMP.GALERIA,
      items: [{
        media: { url: bloqueada(g, cual) ? urlCarta(quien, 'bloq-' + cual, v)
                      : enSv ? urlServidor(quien, svAhora, propiaDe(g), v)
                             : urlCarta(quien, cual, v) },
        description: `Carta ${cual} de ${(g && g.n) || quien}`,
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
      components: CARTAS.filter(c => tiene(g, c.id)).map(c => ({
        type: COMP.BOTON,
        style: c.id === cual ? ESTILO.SECUNDARIO : ESTILO.PRIMARIO,
        label: c.et,
        custom_id: `c:${quien}:${c.id}:${dueno}`,
        disabled: apagado || c.id === cual,
      })).concat(botonAvisos(CARTAS.filter(c => tiene(g, c.id)).length)),
    },
  ];

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
        placeholder: 'Elegí un servidor',
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
        options: SERVIDORES.map(s => {
          const tiene = hayCarta(g, s.sv, m);
          const suyo = (g && g.n) || quien;
          const botAhi = !m || !m.bot_en || m.bot_en.indexOf(s.sv) >= 0;
          const base = tiene ? s.nombre
            : botAhi ? `${suyo} no está en ${s.sv}`
                     : `el bot todavía no está en ${s.sv}: no puedo saberlo`;
          return {
            label: tiene ? s.sv : `${s.sv} · 🔒 BLOQUEADA`,
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
  return componentes;
}

// 🔴 NO MUESTRA LAS TARJETAS: DICE QUIÉN GANA. Dlx, 20/09/2026: *«la idea es
// que no muestre las tarjetas. La cosa es hacer quién gana básicamente»*.
// Nació dibujando las dos cartas lado a lado y eso era otra cosa — dos
// imágenes y que cada uno leyera los números. Acá el bot los lee y contesta.
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

function versus(a, ga, b, gb, cual, dueno, m, aqui) {
  const def = VS[cual] || VS.servidor;
  const va = ((ga && ga.vs) || {})[def.k] || null;
  const vb = ((gb && gb.vs) || {})[def.k] || null;
  const na = corto((ga && ga.n) || a, 11), nb = corto((gb && gb.n) || b, 11);
  const et = (CARTAS.find(c => c.id === cual) || {}).et || cual;

  // ⚠️ SIN NÚMEROS NO SE INVENTA UN EMPATE. Pasa con los 331 que tienen carta
  // de Servidor y nunca compitieron: el pipeline no les manda `vs`, y decir
  // «empatan» sería afirmar que midieron lo mismo.
  if (!va || !vb) {
    const quien = !va ? na : nb;
    return {
      content: `**${na}** vs **${nb}** · ${et}\n\n` +
        `No tengo números de **${quien}** en esta categoría, así que no puedo ` +
        'decir quién gana.',
      components: botonesVs(a, ga, b, gb, cual, dueno),
    };
  }

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

  let veredicto;
  if (da === null || db === null || da === db) {
    veredicto = `🤝 **Empatan** en ${etC}`;
  } else {
    veredicto = `🏆 Gana **${(sgC > 0 ? da > db : da < db) ? na : nb}**`;
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
  return {
    content: `⚔️ **${na}** vs **${nb}** · ${et}\n\n${veredicto}\n` +
      '```\n' + lineas.join('\n') + '\n```\n' +
      marcador + nota,
    components: botonesVs(a, ga, b, gb, cual, dueno),
  };
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

// ⚠️ EL VERSUS NO USA V2 Y NO ES UN DESCUIDO. El flag V2 **desactiva
// `content`**, y este mensaje ES texto: una tabla dentro de un bloque de
// código. Las tarjetas van por `responder()` porque son una galería sin nada
// escrito al lado; esto va por acá porque es exactamente lo contrario.
// Mezclar los dos mundos hace que Discord rechace el payload entero sin decir
// cuál de los dos campos sobraba.
//
// ⚠️ Y VA PÚBLICO, sin EFIMERO: es la misma decisión que la carta —Dlx,
// 17/09— y además un versus que sólo ve quien lo pidió no tiene gracia.
const responderTexto = (tipo, d) => new Response(JSON.stringify({
  type: tipo,
  data: { content: d.content, components: d.components },
}), { headers: { 'content-type': 'application/json' } });

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
const AVISOS_URL = 'https://underlegends.pages.dev/#/avisos';
const HUB_URL = 'https://underlegends.pages.dev';
const botonAvisos = (ocupados) => (ocupados < 5
  ? [{ type: 2, style: 5, label: 'Avisos', emoji: { name: '🔔' }, url: AVISOS_URL }]
  : []);

const filaDe = (botones) =>
  (botones && botones.length) ? [{ type: 1, components: botones.slice(0, 5) }] : [];

const aviso = (txt, botones) => new Response(JSON.stringify({
  type: RESPONDE.MENSAJE,
  data: { flags: EFIMERO, content: txt, components: filaDe(botones) },
}), { headers: { 'content-type': 'application/json' } });

// ⚠️ EL FRENO CONTESTA CON UN MENSAJE NUEVO Y EFÍMERO (tipo 4), NUNCA CON
// ACTUALIZAR. Con el 7 la respuesta pisaría la carta pública y el castigo por
// apurarse sería borrarle la carta a quien la pidió — que es exactamente lo
// que el freno quiere evitar. Es la misma razón que el aviso de «esa carta la
// pidió otra persona».
const espera = (seg) => aviso(
  `Pará un poco 🙂 Probá de nuevo en **${seg} s**.`);

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
    texto: `**${s.sv}** · ${s.nombre}\n¿No estás adentro? Entrá por acá 👇`,
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

// Devuelve `{texto, botones}`: el camino entero en un par de clicks.
//
// ⚠️ EL ORDEN DE LOS BOTONES NO ES ESTÉTICO. Primero entrar, después
// verificarse: el canal de verificación **no se ve hasta estar adentro**, así
// que un «Verificarme» apretado antes de entrar lleva a una pantalla vacía.
// Discord los dibuja de izquierda a derecha y así se leen.
// 🔑 QUIEN SE ANOTA A SÍ MISMO ENTRA SOLO (25/09/2026, #11 de Dlx), si
// Discord sabe su país. Si no —o si su nombre se parece al de alguien que ya
// está— lo decide un admin, que es lo que este texto prometía siempre.
const YA_TE_ANOTE = 'Ya te anoté ✍️ — si Discord sabe tu país (bandera en ' +
  'tu apodo o un rol de país), entrás a la Liga solo en menos de una hora; ' +
  'si no, te carga un admin.';

// «Verificate…» -> «verificate…», para seguir una frase
const minuscula = (t) => (t ? t.charAt(0).toLowerCase() + t.slice(1) : t);

function comoVerificarse(aqui) {
  const s = SV_DE(VERIFICA.sv);
  if (!s) return { texto: '', botones: [] };
  const url = s.guild
    ? `https://discord.com/channels/${s.guild}/${VERIFICA.canal}` +
      (VERIFICA.mensaje ? `/${VERIFICA.mensaje}` : '')
    : '';
  const botones = [];
  // Estando adentro no hace falta invitarlo: la interacción vino de ahí, o
  // sea que Discord ya probó que está.
  if (aqui !== VERIFICA.sv && s.invita) {
    botones.push(botonLink(`Entrar a ${s.sv}`, s.invita));
  }
  if (url) botones.push(botonLink('Verificarme', url));
  // La mención sólo se dibuja para quien ya ve el canal, así que adentro va
  // la mención y afuera el nombre del servidor. El link ya está en el botón.
  const texto = aqui === VERIFICA.sv
    ? `Verificate en <#${VERIFICA.canal}> 👇`
    : `Entrá a **${s.nombre}** y verificate ahí 👇`;
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

const seguir = (i, txt, botones) =>
  fetch(`https://discord.com/api/v10/webhooks/${i.application_id}/${i.token}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      flags: EFIMERO, content: txt, components: filaDe(botones) }),
  });

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
const FRENO = { comando: [4, 30000], click: [10, 10000] };

function frenado(id, tipo) {
  if (!id) return 0;
  const [cuantas, ventana] = FRENO[tipo];
  const ahora = Date.now();
  const clave = tipo + ':' + id;
  const previos = (VISTOS.get(clave) || []).filter(t => ahora - t < ventana);
  if (previos.length >= cuantas) {
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
        'X-Audit-Log-Reason': 'Liga Global: /numeral',
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
  let u = null;
  try {
    const r = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: 'Bearer ' + t } });
    if (r.ok) u = await r.json();
  } catch (e) { u = null; }
  if (!u || !u.id) return new Response('{"error":"discord"}', { status: 401, headers: h });
  // ⚠️ EL RAPERO SALE DEL MISMO LUGAR QUE `/card`: `d:<id>` existe sólo para
  // quien pasa el portón. Quien no está, entra igual y la página le dice qué
  // le falta.
  let rapero = '';
  try {
    const clave = await env.KV.get('d:' + u.id);
    if (clave) rapero = (JSON.parse((await env.KV.get('p:' + clave)) || '{}').n) || '';
  } catch (e) { rapero = ''; }
  return new Response(JSON.stringify({ id: u.id, n: u.global_name || u.username || '',
    av: u.avatar ? u.id + '/' + u.avatar : '', rapero }), { headers: h });
}

// ── /notify: los avisos de eventos por DM ─────────────────────────────────
// 🔑 Dlx, 25/09/2026: «activar las notificaciones de este servidor… ahí te
// dejará las opciones en vez de que lo haga en el website». Se eligen acá; los
// guarda y los manda el mismo objeto que la campana de la página
// (`bot/avisos.js`), en la misma cola.
//
// ⚠️ EL PANEL SE ARMA DE LO QUE CONTESTA EL OBJETO (`/dm/ver`), no de una
// lista escrita acá: los servidores que se pueden elegir son los que el vigía
// escucha, igual que en la página.
export function panelNotify(v, aqui) {
  const svs = v.servidores || [];
  const nombre = (sv) => (svs.find((s) => s.sv === sv) || {}).svn || sv;
  const todos = v.activo && !v.svs.length;
  const elegidos = !v.activo ? [] : todos ? svs.map((s) => s.sv) : v.svs;
  const estado = !v.activo ? '🔕 **Apagados.**'
    : todos ? '🔔 **Activados** para todos los servidores de la Liga.'
      : '🔔 **Activados** para ' + v.svs.map(nombre).join(', ') + '.';
  const lineas = ['## 🔔 Avisos de eventos por mensaje directo',
    'Cuando un servidor de la Liga anuncia un evento, te escribo por DM al minuto.',
    '', estado];
  if (v.error === 'dm') {
    lineas.push('', '⚠️ **No te puedo mandar mensajes directos.** En el servidor: tocá su ' +
      'nombre → **Ajustes de privacidad** → activá **Mensajes directos**, y volvé a elegir.');
  } else if (v.error === 'lleno') {
    lineas.push('', '⚠️ Ya no entra nadie más por ahora. Probá los avisos de la página.');
  }
  const filas = [];
  if (svs.length) {
    filas.push({ type: COMP.FILA, components: [{
      type: COMP.SELECT, custom_id: 'ntf:svs', placeholder: 'Elegí de qué servidores',
      min_values: 1, max_values: svs.length,
      options: svs.map((s) => ({ label: s.svn, value: s.sv, default: elegidos.indexOf(s.sv) >= 0 })),
    }] });
  }
  const botones = [];
  // «de este servidor»: si se pide adentro de uno de la Liga, ése va primero
  if (aqui && svs.some((s) => s.sv === aqui) && elegidos.indexOf(aqui) < 0) {
    botones.push({ type: COMP.BOTON, style: ESTILO.PRIMARIO, label: 'Activar ' + nombre(aqui),
      custom_id: 'ntf:sv:' + aqui });
  }
  if (!todos) {
    botones.push({ type: COMP.BOTON, style: botones.length ? ESTILO.SECUNDARIO : ESTILO.PRIMARIO,
      label: 'Todos los servidores', custom_id: 'ntf:todos' });
  }
  if (v.activo) {
    botones.push({ type: COMP.BOTON, style: ESTILO.SECUNDARIO, label: 'Apagar', custom_id: 'ntf:off' });
  }
  if (botones.length) filas.push({ type: COMP.FILA, components: botones });
  filas.push({ type: COMP.FILA, components: [botonLink('Avisos en la página', AVISOS_URL)] });
  return { content: lineas.join('\n'), components: filas };
}

// ── Los ajustes del servidor ──────────────────────────────────────────────
// Dlx, 19/09/2026: «un comando settings que funcione con botones que solo los
// dueños del servidor o los que tengan manage roles o admins puedan usar».
const claveCfg = (gid) => `cfg:${gid}`;

// ⚠️ EL DEFAULT ES «PRENDIDO Y SIN RESTRICCIONES», y eso es una decisión: un
// servidor que nunca abrió `/settings` tiene que comportarse como se comportaba
// antes de que `/settings` existiera. Si el default fuera apagado, sumar esta
// pantalla le cambiaría el apodo a gente de servidores que no pidieron nada.
const CFG_BASE = { nick: true, canales: [], avisos: '' };

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

// El panel: texto arriba y una fila por ajuste. Se usa igual para abrirlo y
// para redibujarlo después de cada click, así que el estado sale siempre de
// `cfg` y nunca del `custom_id`.
function panelAjustes(sv, cfg) {
  const canales = cfg.canales && cfg.canales.length
    ? cfg.canales.map(c => `<#${c}>`).join(' ')
    : '**todos**';
  const avisos = cfg.avisos ? `<#${cfg.avisos}>` : '**ninguno**';
  const texto = [
    `## ⚙️ Ajustes de la Liga en **${sv}**`,
    '',
    `**#N del ranking en el apodo** · ${cfg.nick ? '🟢 activado' : '🔴 apagado'}`,
    cfg.nick
      ? '> Se le pone el número a todos, salvo a quien lo haya apagado con `/numeral`.'
      : '> No se le pone a nadie, salvo a quien lo haya pedido con `/numeral`.',
    '',
    `**Canales donde se puede usar \`/card\`** · ${canales}`,
    '> Vacío = en cualquiera.',
    '',
    `**Avisos de cambio de rango** · ${avisos}`,
    '> Dónde anunciar cuando alguien sube o baja de rango.',
  ].join('\n');

  return {
    content: texto,
    components: [
      { type: COMP.FILA, components: [{
        type: COMP.BOTON,
        style: cfg.nick ? ESTILO.SECUNDARIO : ESTILO.PRIMARIO,
        label: cfg.nick ? 'Apagar el #N para el servidor' : 'Activar el #N para el servidor',
        custom_id: 'cfg:nick',
      }] },
      { type: COMP.FILA, components: [{
        type: 8,                       // CHANNEL_SELECT
        custom_id: 'cfg:canales',
        placeholder: 'Canales donde se puede usar /card (vacío = todos)',
        // ⚠️ `min_values: 0` ES LO QUE DEJA VOLVER ATRÁS. Sin eso no hay
        // manera de sacar la restricción una vez puesta: el menú exige
        // elegir al menos uno y el servidor queda encerrado en su propia
        // configuración.
        min_values: 0, max_values: 10,
        channel_types: [0],            // sólo texto
      }] },
      { type: COMP.FILA, components: [{
        type: 8,
        custom_id: 'cfg:avisos',
        placeholder: 'Canal para avisar cambios de rango (vacío = ninguno)',
        min_values: 0, max_values: 1,
        channel_types: [0],
      }] },
    ],
  };
}

const responderPanel = (tipo, p) => new Response(JSON.stringify({
  type: tipo,
  data: { flags: EFIMERO, content: p.content, components: p.components },
}), { headers: { 'content-type': 'application/json' } });

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

async function eleccionNick(env, gid, uid) {
  try {
    const v = await env.KV.get(claveNick(gid, uid));
    if (!v) return null;                       // nunca eligió
    return JSON.parse(v);
  } catch (e) {
    return null;
  }
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
  return [linea('temporada', 'Temporada'), linea('competitivo', 'Competitiva'),
          linea('pais', 'País'), linea('servidor', 'Servidor')].join('\n');
}

const AYUDA = {
  card: (m) => [
    '## `/card` — la tarjeta',
    'Sin poner nada, es la tuya. Con `quien:` es la de esa persona.',
    '',
    'Cada uno tiene hasta **cuatro caras**, y los botones de abajo las cambian.',
    'La de **Servidor** trae además un menú para ver la de cada servidor.',
    '',
    '**Qué hace falta para cada una**',
    requisitos(m),
    '',
    'Si todavía no llegás a una, el botón igual aparece: te lleva a una ' +
    'tarjeta que dice **cuánto te falta**. El botón sólo desaparece cuando la ' +
    'tarjeta no se puede emitir — por ejemplo País sin país cargado.',
    '',
    '⚠️ Y para tener tarjeta hace falta **estar en DRA y verificarte ahí**.',
  ].join('\n'),

  versus: () => [
    '## `/versus` — quién gana',
    '`/versus rival:@alguien` los enfrenta y te dice quién gana.',
    'Con `contra:` elegís vos a los dos, así que sirve para armar un cruce ' +
    'entre otras dos personas.',
    '',
    '`carta:` elige la categoría. Por defecto es la de **Servidor**, y los ' +
    'botones de abajo la cambian sin volver a tirar el comando.',
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

  numeral: () => [
    '## `/numeral` — tu `#N` en el apodo',
    '`/numeral` solo te dice cómo está hoy.',
    '`/numeral mostrar:True` lo muestra · `/numeral mostrar:False` lo oculta.',
    '',
    '**Es por servidor**: podés llevarlo en DRA y no en FFA.',
    '',
    '⚠️ **Tu decisión le gana a la del servidor.** Si un admin apaga el `#N` ' +
    'para todos con `/settings`, a vos no te lo tocan si alguna vez lo ' +
    'elegiste a mano. Y al revés: si nunca usaste este comando, seguís lo ' +
    'que diga el servidor.',
    '',
    'Por eso pedir `/numeral mostrar:True` cuando el número **ya se ve** no es ' +
    'al pedo: deja constancia de que lo querés, y eso te protege de un ' +
    'apagón posterior.',
  ].join('\n'),

  // ⚠️ SIN ARGUMENTOS A PROPOSITO. El handler de `/help` mira la aridad
  // (`f.length`) para decidir si vale la pena gastar una lectura de KV, y
  // este texto no dice ningún número que pueda cambiar. Declararlo con un
  // parámetro que no se usa haría que cada `/help comando:foto` leyera KV
  // de gusto.
  foto: () => [
    '## `/foto` — la cara de tus tarjetas',
    'Corré `/foto` y se guarda **la que tenés puesta en Discord ahora**.',
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
    '· Si no tenés foto puesta, **no se guarda nada** — tu tarjeta va con la ' +
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
    '· **`#N` del ranking en el apodo** — prendido o apagado para todo el ' +
    'servidor. Es el valor por defecto: quien haya elegido con `/numeral` ' +
    'conserva lo suyo.',
    '· **Canales donde se puede usar `/card`** — vacío es en cualquiera.',
    '· **Avisos de cambio de rango** — a qué canal anunciarlos.',
  ].join('\n'),

  notify: () => [
    '## `/notify` — los avisos de eventos por mensaje directo',
    'Elegís de qué servidores de la Liga y, cuando uno anuncia un evento, te ' +
    'escribo por DM al minuto. Adentro de un servidor, el primer botón activa ' +
    'ése. Se cambia o se apaga con el mismo comando.',
    '',
    'Para que te lleguen, el servidor tiene que dejar que te escriban por DM ' +
    '(sus **Ajustes de privacidad**).',
  ].join('\n'),

  website: () => [
    '## `/website` — la página de la Liga',
    'Te deja el link a la página: rankings, perfiles, llaves y calendario.',
  ].join('\n'),

  verificar: () => [
    '## `/verificar` — qué te falta para tu tarjeta',
    'Mira en este momento, en Discord Rap Español, las tres cosas que hacen ' +
    'falta: estar en el servidor, el rol **Miembro** y un **país**. Te dice ' +
    'cuál falta y cómo arreglarlo.',
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
    'Esto. Con `comando:` te cuento uno en detalle.',
  ].join('\n'),
};

const AYUDA_INDICE = [
  '# Liga Global',
  'Las tarjetas de la Liga, adentro de Discord.',
  '',
  '· **`/card`** — tu tarjeta, o la de quien elijas',
  '· **`/verificar`** — qué te falta para tener tu tarjeta',
  '· **`/notify`** — avisos de eventos por mensaje directo',
  '· **`/website`** — la página de la Liga',
  '· **`/versus`** — quién gana entre dos, en la categoría que elijas',
  '· **`/foto`** — usá tu foto de Discord en tus tarjetas ' +
  '*(una por temporada, libre hasta que arranque)*',
  '· **`/numeral`** — mostrá u ocultá tu `#N` en tu apodo *(en un servidor)*',
  '· **`/settings`** — los ajustes del servidor *(admins)*',
  '· **`/ping`** — ¿está vivo?',
  '',
  'Para el detalle de uno: **`/help comando:card`**',
].join('\n');

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
const salFotos = (env) => (env && env.FOTOS_SAL) || '';
const claveFoto = (env, quien) =>
  `fotos/${salFotos(env) ? salFotos(env) + '-' : ''}${temporadaDe(env)}/${quien}.webp`;
const claveUso = (env, quien) => `foto:${temporadaDe(env)}:${quien}`;

// El rol de DRA que deja cambiarla cuando quiera. Dlx, 20/09/2026.
const ROL_PASE = '1531136241171697807';
const tienePase = (i) =>
  !!(i.member && i.member.roles && i.member.roles.indexOf(ROL_PASE) >= 0);

async function guardarFoto(env, i, quien, id, hash) {
  // ⚠️ SE BAJA Y SE GUARDA EN STREAMING: `res.body` va directo a R2 sin
  // pasar por memoria ni por un decodificador. Esperar la red no gasta CPU;
  // parsear sí, y acá no se parsea nada.
  //
  // 🔴 TODO ESTO CORRE ADENTRO DE UN `waitUntil`, Y AHI UN ERROR NO LO VE
  // NADIE. Sin los try/catch de abajo, un fallo del CDN, de R2 o de la
  // cuota de KV dejaba a la persona mirando «está pensando…» **para
  // siempre**: la respuesta diferida nunca se contestaba y Discord terminaba
  // diciendo que la aplicación no respondió. No hay log que mirar —los del
  // Worker no salen de Cloudflare en el plan gratis— así que el único lugar
  // donde el error puede aparecer es en el mensaje a la persona.
  let r;
  try {
    r = await fetch(urlAvatar(id, hash));
  } catch (e) {
    return seguir(i, 'No pude llegar al CDN de Discord (`' +
                     String(e).slice(0, 50) + '`). Probá de nuevo en un rato.');
  }
  if (!r.ok) {
    // 🔴 PASA DE VERDAD, Y NO ES UN ERROR NUESTRO. Medido el 20/09/2026:
    // `ropomc` tiene un hash que la lista de miembros de Discord devuelve y
    // que el CDN ya no sirve — 404 en los cuatro formatos. O sea que ni el
    // dato fresco de Discord garantiza un hash vivo.
    return seguir(i, 'Discord no me dio tu foto (`' + r.status + '`).\n' +
                  'Suele arreglarse volviéndotela a poner en Discord y ' +
                  'probando de nuevo.');
  }
  try {
    await env.CARTAS.put(claveFoto(env, quien), r.body, {
      httpMetadata: { contentType: 'image/webp' },
    });
  } catch (e) {
    return seguir(i, 'No pude guardar tu foto (`' + String(e).slice(0, 60) +
                     '`). Probá de nuevo en un rato — **no te gasté** el ' +
                     'cambio de la temporada.');
  }
  // ⚠️ EL SELLO SE ESCRIBE **DESPUES** DE GUARDAR. Al revés, un fallo del
  // CDN le gastaría a la persona su único cambio de la temporada sin haberle
  // cambiado nada.
  //
  // 🔴 Y SU FALLO SE CUENTA APARTE, porque el estado que deja es distinto:
  // acá la foto **ya está guardada** y lo único que no quedó es la marca de
  // que la usaste. Decir «no pude» sería mentir —la foto está— y decir
  // «listo» escondería que vas a poder cambiarla otra vez.
  //
  // ⚠️ Es el caso realista: KV son **1.000 escrituras por día** y una sola
  // corrida del pipeline se come el 47 %.
  // 🔴 NO SE ANOTA EL USO SI LA TEMPORADA NO ARRANCÓ. Si se anotara,
  // quien acomoda su perfil ahora empezaría la T1 **con su cambio ya
  // gastado**, sin haberla jugado.
  //
  // Y eso contradice el motivo del límite: existe porque la Histórica
  // necesita la cara que cada uno tenía **en cada temporada**. La que
  // cuenta para la T1 es la que tenga cuando la T1 esté corriendo; lo
  // que cambie antes no deja historia que proteger.
  //
  // ⚠️ La misma `meta.arrancada` que decide si el límite rige decide si
  // se anota. Las dos preguntas tienen que contestarse igual o el
  // contador se llena en un mundo donde todavía no cuenta.
  let arranco = true;
  try {
    const m0 = await env.KV.get('meta');
    arranco = m0 ? (JSON.parse(m0).arrancada !== false) : true;
  } catch (e) { /* ante la duda, se anota: es el lado conservador */ }
  if (!arranco) {
    return seguir(i, '📸 Tu foto **quedó guardada**.\n' +
                     'La temporada todavía no arrancó, así que podés ' +
                     'cambiarla las veces que quieras hasta que empiece.');
  }
  try {
    await env.KV.put(claveUso(env, quien),
                     JSON.stringify({ hash, ts: Date.now() }));
  } catch (e) {
    return seguir(i, '📸 Tu foto **quedó guardada**.\n' +
                     '⚠️ Pero no pude anotar que ya usaste tu cambio de la ' +
                     'temporada (`' + String(e).slice(0, 40) + '`), así que ' +
                     '`/foto` te va a dejar cambiarla de nuevo. Avisale a Dlx.');
  }
  return seguir(i,
    '📸 Listo: ésa es tu foto de la **' + temporadaDe(env).toUpperCase() + '**.\n' +
    '· Queda **congelada**: aunque cambies la de Discord, tus cartas de esta ' +
    'temporada siguen con ésta.\n' +
    '· Se ve en la próxima vez que se dibujen tus cartas.');
}

// ── /owner — lo GLOBAL, y sólo Dlx ────────────────────────────────────────
// ⚠️ NO SE LLAMA `/config`, Y EL MOTIVO NO ES EL NOMBRE. Dlx, 20/09/2026:
// *«eso de config es para los admins de cada server. Esos son configuraciones
// locales para el servidor. Esto de la liga global es algo global. Ponlo como
// /owner y solo yo»*. `/settings` ya es lo de cada servidor; dos comandos
// parecidos con alcances distintos es exactamente cómo alguien termina
// tocando algo global creyendo que toca lo suyo.
const DUENO = '739338101603696681';

// ⚠️ `default_member_permissions` NO ES EL CANDADO: ES LA CORTINA. Esconde el
// comando de la lista a quien no es admin y nada más — en un mensaje directo
// no se aplica, y el admin de cualquier servidor lo vería igual. El control
// es esta comparación, del lado del Worker, contra el ID que **Discord
// firmó**. Por eso vive acá y no en el registro.
const esDueno = (i) => idDe(i) === DUENO;

const marca = (sello) => {
  // `sello` viene como AAAAMMDDHHMM, de la máquina que corrió el pipeline
  const t = String(sello || '');
  if (t.length !== 12) return '(sin sello)';
  return `${t.slice(6, 8)}/${t.slice(4, 6)} ${t.slice(8, 10)}:${t.slice(10, 12)}`;
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
    '**Dónde vive el rango** _(checklist al 20/09/2026 — desde acá el bot no ' +
    'puede mirar ni el Sheet ni los roles)_',
    '· ✅ `comun/rangos.py` — la fuente',
    '· ✅ las cuatro cartas — salen de ahí',
    '· ✅ `sync.py` — desde el 20/09 saca la letra del **Score**, no de la columna',
    '· ⬜ la columna `Rango` del Sheet — sale sola con el Sheet nuevo',
    '· ⬜ la Guía — se reescribe con el Sheet',
    '· ⬜ `Index.html` del Apps Script — **a mano**, tiene seis pintados',
    '· ⬜ **los roles de Discord** — **a mano**: faltan `SSS` y `SS`, y hay ' +
    'que reasignar',
    '',
    '🔴 Los roles son **lo único irreversible de cara al público**: la gente ' +
    'ya lleva el suyo puesto. Van **antes** de que arranque la T1 — a mitad ' +
    'serían personas viendo cambiar su letra sin haber competido.',
  ].join('\n');
}

function panelEstado(m) {
  if (!m || !m.sello) return '_No pude leer `meta` de KV._';
  const L = [
    '## La Liga, ahora mismo',
    '```',
    `último pipeline     ${marca(m.sello)}`,
    `personas con carta  ${m.gente != null ? m.gente : '?'}`,
    `con Discord ID      ${m.con_id != null ? m.con_id : '?'}` +
      (m.gente ? `  (${Math.round(100 * m.con_id / m.gente)} %)` : ''),
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

const COMANDOS = {
  async help(i, env, ctx) {
    const op = ((i.data && i.data.options) || []).find(o => o.name === 'comando');
    if (!op) return aviso(AYUDA_INDICE);
    const f = AYUDA[String(op.value).toLowerCase()];
    // ⚠️ El valor viene de una lista cerrada de Discord, así que esto no
    // debería pasar nunca — pero «no debería» no es «no puede», y contestar
    // el índice es más útil que un error.
    if (!f) return aviso(AYUDA_INDICE);
    // ⚠️ SÓLO LA AYUDA DE `/card` LEE KV, porque es la única que dice números
    // que pueden cambiar. Las otras tres son texto fijo y no gastan una
    // lectura por curiosidad.
    const m = f.length ? JSON.parse((await env.KV.get('meta')) || '{}') : null;
    return aviso(f(m));
  },

  async foto(i, env, ctx) {
    const { id, hash } = avatarDe(i);
    const quien = id ? await env.KV.get('d:' + id) : null;
    if (!quien) {
      return aviso('Todavía no estás en la Liga, así que no hay carta donde ' +
                   'poner la foto.\nProbá `/card` y te anoto.');
    }
    if (!hash) {
      // ⚠️ NO SE GUARDA EL BLOB GRIS. Discord da un avatar por defecto para
      // el que nunca se puso foto; guardarlo haría que la carta dibuje ese
      // gris en vez de la inicial gigante con el color del rango, que es
      // mejor carta.
      return aviso('No tenés foto puesta en Discord — tu carta va con la ' +
                   'inicial, que con el color de tu rango queda bien.\n' +
                   'Si te ponés una, volvé y corré `/foto`.');
    }
    // ⚠️ SI NO HAY BINDING DE R2 EL COMANDO NO PUEDE HACER NADA, y conviene
    // decirlo en vez de fallar adentro del `waitUntil` — ahí el error no lo
    // ve nadie y la persona se queda mirando «está pensando…».
    if (!env.CARTAS) {
      return aviso('El guardado de fotos todavía no está enchufado. ' +
                   'Avisale a Dlx.');
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
    const meta0 = await env.KV.get('meta');
    const arrancada = meta0 ? (JSON.parse(meta0).arrancada !== false) : true;
    const usado = arrancada && await env.KV.get(claveUso(env, quien));
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
    luego(ctx, guardarFoto(env, i, quien, id, hash));
    return new Response(JSON.stringify({
      type: RESPONDE.PENSANDO, data: { flags: EFIMERO },
    }), { headers: { 'content-type': 'application/json' } });
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
                   'Los ajustes de acá son `/settings`; tu puesto en el apodo, ' +
                   '`/numeral`.');
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
      const crudo = await env.KV.get('p:' + clave);
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
      return aviso(L.join('\n'));
    }

    // ⚠️ UNA SOLA LECTURA PARA LOS OTROS DOS, y es la misma clave que lee
    // `/card`: si `meta` estuviera vieja, estos paneles la muestran vieja
    // también — que es exactamente lo que hay que poder ver.
    const m = JSON.parse((await env.KV.get('meta')) || '{}');
    if (sub.name === 'rangos') return aviso(panelRangos(m));
    return aviso(panelEstado(m));
  },

  ping(i) {
    return aviso(
      '🏓 **Liga Global** responde.\n' +
      `· servidor \`${i.guild_id || '(fuera de un servidor)'}\`\n` +
      '· la firma Ed25519 validó\n' +
      '· esto salió de un Worker, sin nada prendido entre comando y comando');
  },

  async notify(i, env, ctx) {
    const v = await pedirDM(env, '/dm/ver', { usuario: idDe(i) });
    if (!v || v.error) return aviso('Los avisos no están andando ahora. Probá en un rato.');
    return responderPanel(RESPONDE.MENSAJE, panelNotify(v, aquiEs(i.guild_id)));
  },

  // 🔑 Dlx, 25/09/2026: «/website, que te redirigiría a la página».
  async website(i, env, ctx) {
    return aviso('🌐 **La Liga Global**: los rankings, el perfil de cada rapero, las llaves ' +
                 'de cada evento y el calendario.', [botonLink('Abrir la página', HUB_URL)]);
  },

  async verificar(i, env, ctx) {
    const yo = idDe(i);
    const [ya, mCrudo] = await Promise.all([env.KV.get('d:' + yo), env.KV.get('meta')]);
    if (ya) return aviso('Ya estás verificado ✅ — tu tarjeta sale con `/card`.');
    let mm = null;
    try { mm = mCrudo ? JSON.parse(mCrudo) : null; } catch (e) { mm = null; }
    const P = mm && mm.porton;
    const v = comoVerificarse(aquiEs(i.guild_id));
    const d = datosDe(i, yo);
    // ⚠️ SIN EL PORTÓN EN KV O SIN EL TOKEN NO SE PUEDE MIRAR: se hace lo de
    // `/card`, que es anotar y explicar. Un comando que no puede contestar lo
    // que promete igual deja a la persona un paso más cerca.
    if (!P || !P.guild || !env.DISCORD_TOKEN) {
      anotar(env, ctx, yo, d.nick, d.user, d.glob, i.guild_id, 'yo');
      return aviso(YA_TE_ANOTE + '\n\n' + v.texto, v.botones);
    }
    const { estado, miembro } = await miembroDra(env, P.guild, yo);
    if (!miembro && estado !== 404) {
      return aviso('No pude mirar Discord Rap Español ahora mismo (contestó ' + estado +
                   '). Probá de nuevo en un rato.');
    }
    const dg = diagnostico(miembro, P);
    const unPais = dg.paises.length === 1;
    const si = (b) => (b ? '✅' : '❌');
    const lista = [
      `${si(dg.enDra)} Estar en **Discord Rap Español**`,
      `${si(dg.rol)} Tener el rol **Miembro** ahí`,
      `${si(unPais)} Tener un país` + (unPais ? ' ' + emojiBandera(dg.paises[0]) : ''),
    ].join('\n');
    if (!dg.enDra) {
      return aviso('Para tener tarjeta hace falta estar en **Discord Rap Español**, y ahí ' +
                   'no te encuentro.\n\n' + lista + '\n\n' + v.texto +
                   '\nCuando entres, volvé a escribir `/verificar`.', v.botones);
    }
    if (dg.paises.length > 1) {
      return aviso(lista + '\n\nTenés **' + dg.paises.length + ' países** en DRA (' +
                   dg.paises.map(emojiBandera).join(' ') + '): dejá uno solo y volvé a ' +
                   'escribir `/verificar`.');
    }
    if (!unPais) {
      return aviso(lista + '\n\nNo encuentro tu **país** en DRA. Elegí tu rol de país ' +
                   'ahí, o poné tu bandera en el apodo, y volvé a escribir `/verificar`.');
    }
    // lo tuyo está completo: lo que falta lo hace el ciclo
    if ((P.revisa || []).indexOf(String(yo)) >= 0) {
      return aviso(lista + '\n\nLo tuyo está completo. Tu caso lo revisa un admin: no ' +
                   'hace falta que hagas nada más.');
    }
    anotar(env, ctx, yo, d.nick, d.user, d.glob, i.guild_id, 'yo');
    const vuelta = proximaVuelta(Date.now());
    const hora = vuelta ? horaEste(vuelta.toISOString()).replace(/^\S+ /, '') : '';
    const cuando = hora ? ` La próxima vuelta arranca a las **${hora}**.` : '';
    return aviso(lista + '\n\n' + (dg.rol
      ? 'Estás verificado en DRA ✅. Tu tarjeta sale cuando el bot te cargue: en menos ' +
        'de una hora.'
      : 'Lo tuyo está completo ✅. El rol de **Miembro** te lo da el bot solo, y con él ' +
        'sale tu tarjeta: en menos de una hora.') + cuando);
  },

  async card(i, env, ctx) {
    // ⚠️ EL CANAL SE CHEQUEA ANTES DE TODO. Si el servidor limitó dónde se
    // puede usar, no tiene sentido buscar a nadie en KV para después decir que
    // acá no. Y el aviso NOMBRA los canales permitidos: «no se puede acá» sin
    // decir dónde sí manda a la persona a adivinar.
    if (i.guild_id) {
      const cfg = await ajustes(env, i.guild_id);
      if (cfg.canales.length && cfg.canales.indexOf(i.channel_id) < 0) {
        return aviso('Acá no se pueden pedir cartas. Probá en ' +
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
    if (porUsuario) {
      quien = await env.KV.get('d:' + porUsuario.value);
      comoDije = `<@${porUsuario.value}>`;
      if (!quien) {
        // La persona elegida no está cargada, pero SU ID lo tenemos acá mismo
        // (es el valor del selector) — se anota para no perderlo.
        const d = datosDe(i, porUsuario.value);
        anotar(env, ctx, porUsuario.value, d.nick, d.user, d.glob, i.guild_id, 'otro');
        return aviso(`${comoDije} todavía no está en la Liga — lo anoté para ` +
                     'que un admin lo cargue.\n' +
                     'Si sabés su nombre de competencia: `/card nombre:<su nombre>`.');
      }
    } else if (porNombre) {
      quien = norm(porNombre.value);
      comoDije = `**${porNombre.value}**`;
    } else {
      quien = await quienEs(i, env);
      comoDije = 'vos';
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
          return aviso('Ya estás cargado en la Liga ✅ — no hace falta que ' +
                       'nadie te agregue.\n\nLo que falta es **verificarte ' +
                       'en DRA**:\n• si ya estás en DRA y Discord sabe tu ' +
                       'país (bandera en tu apodo o un rol de país), el bot ' +
                       'te verifica solo en la próxima vuelta (~30 min);\n' +
                       '• si no, ' + minuscula(v.texto) +
                       '\n\nUna vez verificado, tu tarjeta sale sola.', v.botones);
        }
        const d = datosDe(i, yo);
        anotar(env, ctx, yo, d.nick, d.user, d.glob, i.guild_id, 'yo');
        return aviso(YA_TE_ANOTE + '\n\n' +
                     'Para tener carta hace falta **estar en DRA** y ' +
                     '**verificarte** ahí; si ya estás en DRA, eso también ' +
                     'sale solo.\n' + v.texto +
                     '\n\nSi ya competís y esto te parece un error, probá ' +
                     '`/card nombre:<tu nombre>`.', v.botones);
      }
    }
    const [crudo, meta] = await Promise.all([
      env.KV.get('p:' + quien), env.KV.get('meta'),
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
    const algunaCarta = sinCs || g.cs.length || (g.bl && g.bl.length);
    if (!algunaCarta) {
      return aviso(`${comoDije === 'vos' ? 'Ya estás' : comoDije + ' ya está'}` +
                   ' en la Liga ✅ — pero las cartas todavía no están ' +
                   'dibujadas.\nSe generan solas en la próxima vuelta del ' +
                   'ciclo; probá de nuevo en un rato.');
    }
    const abre = ((g.cs || []).indexOf('competitivo') >= 0)
      ? 'competitivo' : 'servidor';
    return responder(RESPONDE.MENSAJE,
      carta(quien, g, abre, null, idDe(i), m, aquiEs(i.guild_id)));
  },

  async versus(i, env, ctx) {
    // el mismo portero que `/card`: si el servidor limitó dónde, se corta acá
    // antes de gastar dos lecturas de KV.
    if (i.guild_id) {
      const cfg = await ajustes(env, i.guild_id);
      if (cfg.canales.length && cfg.canales.indexOf(i.channel_id) < 0) {
        return aviso('Acá no se pueden pedir cartas. Probá en ' +
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
        anotar(env, ctx, rival.id, d.nick, d.user, d.glob, i.guild_id, 'otro');
      }
      return aviso(`${rival.como} todavía no está en la Liga — lo anoté para ` +
                   'que un admin lo cargue.');
    }
    // ⚠️ `contra` ES OPCIONAL Y POR DEFECTO SOS VOS. Que se pueda enfrentar a
    // dos terceros no es un lujo: la mitad de los usos son de un organizador
    // armando un cruce entre otras dos personas.
    const mio = pedido || { clave: await quienEs(i, env), como: 'vos' };
    if (!mio.clave) {
      if (!pedido) {
        const d = datosDe(i, idDe(i));
        anotar(env, ctx, idDe(i), d.nick, d.user, d.glob, i.guild_id, 'yo');
        const vf = comoVerificarse(aquiEs(i.guild_id));
        return aviso(YA_TE_ANOTE + '\n\n' +
                     'Para tener carta hace falta **estar en DRA** y ' +
                     '**verificarte** ahí; si ya estás en DRA, eso también ' +
                     'sale solo.\n' + vf.texto, vf.botones);
      }
      if (mio.id) {
        const d = datosDe(i, mio.id);
        anotar(env, ctx, mio.id, d.nick, d.user, d.glob, i.guild_id, 'otro');
      }
      return aviso(`${mio.como} todavía no está en la Liga — lo anoté.`);
    }
    // ⚠️ UNO CONTRA SÍ MISMO NO ES UN EMPATE, ES UN ERROR DE TIPEO. Dibujarlo
    // sale «bien» —dos veces la misma carta— y por eso conviene cortarlo: el
    // que lo ve cree que el comando hizo lo que pidió.
    if (mio.clave === rival.clave) {
      return aviso('Ésa es la misma persona de los dos lados 🙂');
    }

    const [ca, cb, meta] = await Promise.all([
      env.KV.get('p:' + mio.clave), env.KV.get('p:' + rival.clave), env.KV.get('meta'),
    ]);
    if (!ca) return aviso(`No tengo cartas de ${mio.como}.`);
    if (!cb) return aviso(`No tengo cartas de ${rival.como}.`);
    const ga = JSON.parse(ca), gb = JSON.parse(cb);
    const m = meta ? JSON.parse(meta) : {};
    const aqui = aquiEs(i.guild_id);

    const cual = String(val('carta') || 'servidor');
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
                   'Probá con otra categoría.');
    }
    return responderTexto(RESPONDE.MENSAJE,
      versus(mio.clave, ga, rival.clave, gb, cual, idDe(i), m, aqui));
  },

  // ⚠️ SE GUARDA EL APODO ANTERIOR, no un «1». Apagar es fácil —se le saca el
  // «#N | »— pero volver a prenderlo necesita el NÚMERO, y el Worker no tiene
  // el ranking: eso vive en el Sheet. Guardando el apodo entero se restaura
  // exacto sin que el Worker tenga que saber nada del Sheet, y si el puesto
  // cambió mientras tanto lo corrige la próxima corrida del sincronizador.
  async settings(i, env, ctx) {
    const gid = i.guild_id;
    if (!gid) return aviso('`/settings` va **adentro del servidor** que querés configurar.');
    if (!puedeAjustar(i)) {
      return aviso('Esto lo manejan los **admins** del servidor (o quien tenga ' +
                   '*Gestionar roles*).\n' +
                   'Lo tuyo se cambia con `/numeral` — y tu elección le gana a la ' +
                   'del servidor.');
    }
    const cfg = await ajustes(env, gid);
    return responderPanel(RESPONDE.MENSAJE,
      panelAjustes(aquiEs(gid) || 'este servidor', cfg));
  },

  async numeral(i, env, ctx) {
    const gid = i.guild_id;
    const uid = idDe(i);
    if (!gid) {
      return aviso('Este comando va **adentro de un servidor**: la preferencia es ' +
                   'de cada uno por separado, así que podés llevar el puesto en ' +
                   'DRA y no en FFA.');
    }
    const sv = aquiEs(gid) || 'este servidor';
    const [mio, cfg] = await Promise.all([eleccionNick(env, gid, uid), ajustes(env, gid)]);
    // lo que rige hoy: lo tuyo si elegiste, si no lo del servidor
    const ahoraOn = mio ? !!mio.on : cfg.nick !== false;

    const op = ((i.data && i.data.options) || []).find(o => o.name === 'mostrar');
    if (!op) {
      const porque = mio
        ? 'porque **vos** lo elegiste — le gana a lo que diga el servidor.'
        : `porque es lo que tiene puesto el servidor (nadie lo cambió a mano).`;
      return aviso(`En **${sv}** tu puesto está **${ahoraOn ? 'a la vista' : 'oculto'}**, ` +
                   porque + '\nPara cambiarlo: `/numeral mostrar:True` o ' +
                   '`/numeral mostrar:False`.');
    }
    const quiere = !!op.value;
    // ⚠️ AUNQUE COINCIDA CON LO QUE YA SE VE, SE GUARDA. «Está a la vista
    // porque el servidor lo quiere» y «está a la vista porque vos lo pediste»
    // se ven igual hoy y se comportan distinto mañana: lo segundo sobrevive a
    // que un admin lo apague. Cortar acá con «no cambié nada» le negaría a
    // alguien la única forma de blindar su apodo.
    const yaEraMio = mio && !!mio.on === quiere;

    const actual = (i.member && i.member.nick) || '';
    const destino = quiere
      ? ((mio && mio.antes) || actual)   // el que tenía guardado, si lo hay
      : sinPuesto(actual);

    // 🔴 SI KV NO ESCRIBE, SE DICE Y NO SE TOCA EL APODO. El 24/09/2026 a
    // las 7 PM ET la cuota diaria de escrituras se agotó y el Worker tiró 5
    // excepciones: una escritura sin `try` convierte «hoy no hay cupo» en
    // «la aplicación no respondió», que no dice nada. Y el apodo NO se
    // cambia: sin la elección guardada, la próxima sincronización lo
    // devolvería a lo que diga el servidor.
    try {
      await env.KV.put(claveNick(gid, uid), JSON.stringify({
        on: quiere,
        // se conserva el apodo con «#N» para poder devolverlo al prenderlo
        antes: quiere ? ((mio && mio.antes) || actual) : actual,
        ts: Date.now(),
      }));
    } catch (e) {
      return aviso('No pude guardar tu elección (`' + String(e).slice(0, 60) +
                   '`), así que no te toqué el apodo. Probá de nuevo en un rato.');
    }

    if (yaEraMio && destino === actual) {
      return aviso(`En **${sv}** tu puesto ya estaba **${quiere ? 'a la vista' : 'oculto'}** ` +
                   'por elección tuya — lo dejé como estaba.');
    }

    const res = await cambiarApodo(env, gid, uid, destino);
    const que = quiere ? 'se va a ver' : 'queda oculto';
    if (res === 'ok') {
      return aviso(`Listo: en **${sv}** tu puesto **${que}**.\n` +
                   `Tu apodo ahora es \`${destino || '(sin apodo)'}\`.`);
    }
    if (res === 'sin-token') {
      // ⚠️ DECIR A QUÉ VA A QUEDAR, no sólo que va a cambiar. Sin el apodo
      // destino la persona no puede ponérselo a mano si no quiere esperar, y
      // «se actualiza más tarde» sin decir a qué es media respuesta.
      return aviso(`Anotado: en **${sv}** tu puesto **${que}**.\n` +
                   `Tu apodo va a quedar \`${destino || '(sin apodo)'}\`.\n` +
                   '⏳ Se aplica en la próxima sincronización — el bot no cambia ' +
                   'apodos por sí mismo, a propósito. Si no querés esperar, ' +
                   'ponételo vos.');
    }
    // ⚠️ LA PREFERENCIA QUEDA GUARDADA AUNQUE EL APODO FALLE, y eso es lo que
    // se quiere: al dueño del servidor y a quien tenga un rol más alto que el
    // del bot, Discord no les deja tocar el apodo nunca. Si además se
    // descartara la preferencia, esa persona no podría elegir jamás.
    return aviso(`Anotado: en **${sv}** tu puesto **${que}**.\n` +
                 `⚠️ Pero no pude cambiarte el apodo (\`${res}\`). Suele ser porque ` +
                 'sos el dueño del servidor o tenés un rol más alto que el del bot: ' +
                 `ponelo a mano como \`${destino || '(sin el #)'}\`.`);
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
const UL_PNG = 'data:image/png;base64,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';

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
// 🌙 LA MADRUGADA, MÁS DESPACIO. Dlx, 25/09/2026: «después de las 3am EST
// hasta las 11am EST que haya un retraso de cada 4 horas… a esas horas en
// sí los eventos no hay ninguno». De 3 a 11 AM ET el ciclo corre a las 6:52
// y a las 10:52 y nada más. El vigía de los avisos sigue cada minuto.
// ⚠️ La misma ventana está en `bot/madrugada.py`, y su self-check compara
// esta línea: si se cambia una sola, CI se pone rojo.
export const MADRUGADA = { desde: 3, hasta: 11, horas: [6, 10] };

export function tocaCiclo(fecha) {
  const p = {};
  for (const x of new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
  }).formatToParts(fecha)) p[x.type] = x.value;
  const h = Number(p.hour);
  const m = Number(p.minute);
  if (h < MADRUGADA.desde || h >= MADRUGADA.hasta) return true;
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
  async scheduled(evento, env, ctx) {
    // 🔑 EL CRON DE CADA MINUTO ES OTRO: el vigía de los avisos de eventos.
    //
    // ⚠️ SE VA ANTES DE TOCAR KV, y no es un detalle. Las dos marcas de
    // abajo son dos escrituras por disparo: con este cron serían 2.880 por
    // día, casi el triple de la cuota gratis de TODA la cuenta, que ya se
    // agotó una vez y congeló el hub. El vigía deja su latido en el Durable
    // Object —ver `/avisos/estado`—, que tiene cien veces más cupo.
    if (evento.cron === CRON_VIGIA) {
      await vigilar(env, SERVIDORES.map((s) => ({ sv: s.sv, nombre: s.nombre, guild: s.guild })),
        DUENO);
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
    try {
      await env.KV.put('cron:arranco', JSON.stringify(
        { t: new Date().toISOString(), cron: evento.cron || '' }));
    } catch (e) { /* si ni esto anda, el problema es el binding */ }
    await (async () => {
      const t = new Date().toISOString();
      if (!env.GH_TOKEN || !env.GH_REPO) {
        await env.KV.put('cron:ultimo', JSON.stringify(
          { t, ok: false, por: 'sin GH_TOKEN o GH_REPO en el Worker' }));
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
      // ⚠️ CON `try`, como `cron:arranco`: el disparo ya salió, y sin
      // cupo de KV esta marca era una excepción en cada corrida del día
      // (el 24/09/2026 a las 7 PM ET). Que la marca falte ya es la señal.
      try {
        await env.KV.put('cron:ultimo', JSON.stringify({
          t, ok: estado === 204, estado, cuerpo,
          cron: evento.cron || '',
        }));
      } catch (e) { /* sin cupo: la marca vieja ya dice que algo pasó */ }
    })();
  },

  async fetch(req, env, ctx) {
    // 🔑 LOS AVISOS, ANTES QUE NADA, Y POR RUTA EXACTA. El `POST /` de abajo
    // son las interacciones de Discord y verifican firma; `/avisos/*` es
    // una lista cerrada de cinco rutas que nunca llega hasta ahí.
    const camino = new URL(req.url).pathname;
    if (camino.startsWith('/avisos/')) return rutaAvisos(req, env, camino);
    // 🔑 «MI CUENTA» CON DISCORD: ver `cuentaDiscord()`
    if (camino === '/cuenta' && req.method === 'POST') return cuentaDiscord(req, env);

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
      if (ruta === '/perfiles') {
        const crudo = await env.KV.get('web:perfiles');
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
          return new Response('El lobby todavía no se armó. Corré `bot/subir_web.py --aplicar`.',
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
      return new Response('firma invalida', { status: 401 });
    }

    const i = JSON.parse(crudo);

    if (i.type === RECIBE.PING) {
      return new Response(JSON.stringify({ type: RESPONDE.PONG }),
        { headers: { 'content-type': 'application/json' } });
    }

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

    if (i.type === RECIBE.COMPONENTE) {
      // ⚠️ TODO EL ESTADO VIENE EN EL custom_id. El Worker no busca nada, y
      // por eso dos personas en servidores distintos no se pisan. Además un
      // botón que se contesta sólo desde su custom_id NO CADUCA: el token de
      // la interacción muere a los 15 min, pero cada click trae uno nuevo.
      const id = (i.data && i.data.custom_id) || '';
      const [que, quien, extra, dueno] = id.split(':');

      // ── El panel de ajustes ────────────────────────────────────────────
      // ⚠️ SE VUELVE A CHEQUEAR EL PERMISO EN CADA CLICK, no sólo al abrir.
      // El panel es efímero y en principio sólo lo ve quien lo pidió, pero el
      // permiso puede haberle sido quitado entre que lo abrió y que apretó, y
      // «efímero» nunca fue un control de acceso. El chequeo es local, no
      // cuesta una consulta.
      if (que === 'cfg') {
        if (!i.guild_id) return aviso('Esto va adentro de un servidor.');
        if (!puedeAjustar(i)) {
          return aviso('Ya no tenés permiso para tocar los ajustes del servidor.');
        }
        const cfg = await ajustes(env, i.guild_id);
        const vals = (i.data && i.data.values) || [];
        if (quien === 'nick') cfg.nick = !cfg.nick;
        else if (quien === 'canales') cfg.canales = vals.slice(0, 10);
        else if (quien === 'avisos') cfg.avisos = vals[0] || '';
        else return aviso('No sé qué ajuste es ése.');
        // ⚠️ Mismo motivo que en `/numeral`: sin `try`, un día sin cupo
        // de KV es «la aplicación no respondió» y el admin no sabe si quedó.
        try {
          await env.KV.put(claveCfg(i.guild_id), JSON.stringify(cfg));
        } catch (e) {
          return aviso('No pude guardar el ajuste (`' + String(e).slice(0, 60) +
                       '`): quedó como estaba. Probá de nuevo en un rato.');
        }
        // ⚠️ SE REDIBUJA EL MISMO MENSAJE (tipo 7), no se manda uno nuevo. Un
        // panel que deja un mensaje por click convierte tres ajustes en tres
        // paneles contradictorios, y el último no es necesariamente el que
        // está abajo.
        return responderPanel(RESPONDE.ACTUALIZAR,
          panelAjustes(aquiEs(i.guild_id) || 'este servidor', cfg));
      }

      // ── /notify: los servidores de los avisos por DM ───────────────────
      // ⚠️ LO GUARDA EL OBJETO DE LOS AVISOS, y quien toca es siempre quien
      // pidió el panel: es efímero y cada click trae su propio ID.
      if (que === 'ntf') {
        const esperarN = frenado(idDe(i), 'click');
        if (esperarN) return espera(esperarN);
        const yo = idDe(i);
        let d = null;
        if (quien === 'off') d = { usuario: yo, apagar: true };
        else if (quien === 'todos') d = { usuario: yo, svs: [] };
        else if (quien === 'svs') d = { usuario: yo, svs: (i.data && i.data.values) || [] };
        else if (quien === 'sv') {
          const v0 = await pedirDM(env, '/dm/ver', { usuario: yo }) || {};
          d = { usuario: yo, svs: v0.activo && (v0.svs || []).length ? v0.svs.concat([extra]) : [extra] };
        }
        if (!d) return aviso('No sé qué hacer con eso.');
        const v = await pedirDM(env, '/dm/poner', d);
        if (!v || v.error === 'usuario' || !v.servidores) {
          return aviso('Los avisos no están andando ahora. Probá en un rato.');
        }
        return responderPanel(RESPONDE.ACTUALIZAR, panelNotify(v, aquiEs(i.guild_id)));
      }

      // ── Los botones del versus ─────────────────────────────────────────
      // `v:<a>:<carta>:<dueño>:<b>` — cinco partes, una más que los demás,
      // porque un versus son DOS personas. El estado sigue viviendo entero en
      // el custom_id: el Worker no se acuerda de nada entre click y click.
      if (que === 'v') {
        const rival = id.split(':')[4] || '';
        if (dueno && idDe(i) !== dueno) {
          return aviso('Ese versus lo pidió otra persona.\n' +
                       'Tirá `/versus` y tenés el tuyo, con tus propios botones.');
        }
        const esperar2 = frenado(idDe(i), 'click');
        if (esperar2) return espera(esperar2);
        const [ca, cb, meta] = await Promise.all([
          env.KV.get('p:' + quien), env.KV.get('p:' + rival), env.KV.get('meta'),
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
                       'Tirá `/versus` de nuevo y te salen las que tienen los dos.');
        }
        if (extra === 'servidor' && !svDeAmbos(ga, gb, aqui, m)) {
          return aviso('Ya no comparten ningún servidor, así que las dos cartas ' +
                       'saldrían de lugares distintos.');
        }
        return responderTexto(RESPONDE.ACTUALIZAR,
          versus(quien, ga, rival, gb, extra, dueno, m, aqui));
      }

      if (que !== 'c' && que !== 's') {
        return aviso('No sé qué hacer con ese componente.');
      }
      // ⚠️ LOS BOTONES SON DEL QUE PIDIO LA CARTA, y el dueño viaja en el
      // custom_id igual que todo lo demas: el Worker no tiene que buscar
      // quien mando el mensaje original. Sin esto, en un mensaje publico
      // cualquiera te cambia la carta delante de todos.
      if (dueno && idDe(i) !== dueno) {
        return aviso('Esa carta la pidió otra persona.\n' +
                     'Tirá `/card` y tenés la tuya, con tus propios botones.');
      }
      // ⚠️ El freno del click va DESPUÉS del dueño: si fuera antes, el que
      // machaca botones ajenos gastaría las ranuras del dueño.
      const esperar = frenado(idDe(i), 'click');
      if (esperar) return espera(esperar);
      // ⚠️ El sello también acá: si el botón devolviera la URL sin `?v=`,
      // cambiar de carta mostraría la versión cacheada vieja.
      const [crudo, meta] = await Promise.all([
        env.KV.get('p:' + quien), env.KV.get('meta'),
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
          'apagué los botones.\nTirá `/card` y tenés una nueva.'));
        return responder(RESPONDE.ACTUALIZAR,
          carta(quien, g, cual, svEnPantalla(i), dueno, m, aqui, true));
      }

      if (que === 'c') {
        // ⚠️ UN BOTÓN VIEJO PUEDE PEDIR UNA CARTA QUE YA NO ESTÁ. El mensaje
        // queda en el canal para siempre y su custom_id no caduca: si mañana
        // alguien pierde su carta de País —se queda sin país en el Sheet— el
        // botón de ayer sigue apretándose. Sin esto, devolvería un hueco.
        if (!tiene(g, extra)) {
          return aviso(`${g.n || quien} no tiene carta de **${extra}**.\n` +
                       'Tirá `/card` de nuevo y te salen las que sí tiene.');
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
      const yoSoy = await env.KV.get('d:' + idDe(i));
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
          ? `Todavía no tengo tu carta de **${sv}**: la estoy generando. Probá en un rato.`
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
