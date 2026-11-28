// 🚪 EL RECIBIDOR (28/11/2026). En DRA la gente nueva escribe «hola, ¿cómo me inscribo?» en el chat y nadie contesta.
//
// Lo decidido (Dlx, 28/11/2026):
//   · SÓLO DRA por ahora, y sólo el chat general y «💡 dudas». Lo escucha el grabador de Railway (grabador/recibidor.js),
//     que le manda acá el mensaje con la clave del ciclo (`/recibidor`, como `/mencion`).
//   · LA RESPUESTA ES FIJA. La IA sólo ELIGE una etiqueta de `ETIQUETAS`, nunca escribe texto: lo que se publica sale de
//     `RESPUESTAS`, que es lo único que hay que tocar para cambiar lo que dice el bot.
//   · Primero un clasificador sin IA (`clasificar()`, con los ejemplos de `EJEMPLOS`); la IA sólo si queda en duda, con un
//     modelo chico, una respuesta de pocas letras y un tope por día (`IA_POR_DIA`): los 10.000 neuronas gratis por día son
//     de TODA la cuenta y los comparte el OCR de los afiches.
//   · Y AVISA A LOS RECIBIDORES (rol `ROL_RECIBIDOR`, que ve el canal privado •「🚪」recibidor), para que también lo reciba
//     una persona: «Lo recibo yo» (`rcb:<mensaje>`), el primero que toca se lo queda.
//   · Y «👋 SALUDAR» (Dlx, 28/11/2026: «eso de saludar podría servir en recibidor y chat general»), como el de YAGPDB:
//     el botón va en la respuesta al nuevo y en el aviso de los recibidores (`rsal:<nuevo>:<canal>`; YAGPDB usa
//     `saludar_<id>`, no chocan). Cualquiera menos el nuevo, una vez cada uno y hasta `SALUDOS_MAX` por nuevo en
//     `SALUDO_DIAS` días; el saludo sale en el canal donde preguntó, con el GIF y el botón otra vez, y sólo le suena a él.
//   · EL PREMIO: el Pase Premium de la temporada para quien reciba a `PREMIUM_N` personas que jueguen su primer evento
//     dentro de los `CUENTA_DIAS` días después de recibirlas (`revisar()`, una vez por hora desde el vigía).
//
// ⚠️ NUNCA SE GUARDA EL TEXTO DEL MENSAJE. El objeto guarda sólo IDs, la etiqueta y la hora. El texto pasa por acá una
// vez (para elegir la etiqueta y armar el extracto del aviso del canal privado) y se va.
// ⚠️ NADA SUENA: la respuesta menciona sólo a quien preguntó (es una respuesta a su mensaje) y el aviso, a nadie.
// ⚠️ NUNCA POR DM.
import * as V from './vista.js';

export const GUILD_DRA = '841017460341604382';
export const ROL_RECIBIDOR = '1576263321013723377';
export const PAGINA = 'https://underlegends.pages.dev';
export const PAGINA_EVENTOS = PAGINA + '/freestyle-rap/eventos';
export const PAGINA_GUIA = PAGINA + '/freestyle-rap/guia';
export const PAGINA_TARJETAS = PAGINA + '/freestyle-rap/tarjetas';

// ═══ ✏️ LO QUE DICE EL BOT. Dlx: se cambia acá y en ningún otro lado ═════════════════════════════════════════════════
// `botones`: cuáles links van debajo, en orden. `eventos`, `nuevos` y `verificar` son canales de DRA (el grabador los
// busca por nombre); si alguno no se encuentra, ese botón no va. `pagina`, `guia`, `tarjetas` y `vincular` son de la web.
export const RESPUESTAS = {
  inscribirse: {
    texto: '¡Hola, bienvenido! 👋 Cada evento se anuncia en el canal de eventos: el anuncio dice el día, la hora y cómo '
      + 'inscribirte. En la página tienes el calendario de todos los servidores, en tu hora.\n'
      + '¿Es tu primera vez? Hay un **Evento de Nuevos**, sólo para los que empiezan: anótate en su canal.',
    botones: ['eventos', 'pagina', 'nuevos'],
  },
  cuando: {
    texto: '¡Hola! 👋 Los eventos se anuncian en el canal de eventos apenas un servidor los arma, y en la página está el '
      + 'calendario de todos, en tu hora. Activa la campana ahí y te avisamos cuando arranque uno.',
    botones: ['eventos', 'pagina'],
  },
  primer_evento: {
    texto: '¡Bienvenido! 🐣 Si nunca jugaste, empieza por el **Evento de Nuevos**: es sólo para los que recién llegan, '
      + 'nadie con más de 2 eventos. Anótate en su canal y te avisamos cuando estemos todos.',
    botones: ['nuevos', 'eventos'],
  },
  verificarse: {
    texto: '¡Hola! 👋 Verificarte es un toque: entra a la página con tu Discord y te dice qué te falta. Si tienes dudas, '
      + 'mira el canal de verificación.',
    botones: ['vincular', 'verificar'],
  },
  tarjeta: {
    texto: '¡Hola! 🃏 Las tarjetas salen al verificarte: la de tu **Servidor** apenas te verificas y la de **Temporada** '
      + 'con el nivel 1 del Pase. Después la pides con `/card` o `@ULAYA card`.',
    botones: ['vincular', 'tarjetas'],
  },
  como_funciona: {
    texto: '¡Bienvenido! 👋 La Liga Global junta los eventos de freestyle de muchos servidores en un solo ranking: cada '
      + 'evento que juegas suma para tu temporada. En la Guía está todo explicado.',
    botones: ['guia', 'eventos'],
  },
  // 👋 las tres que sólo salen del «¿Tienes una duda?» de la bienvenida (`DUDAS`; el clasificador no las elige)
  // ⚠️ mirado contra lo de hoy (28/11/2026): los canales de voz de CYPHERS Y ENTRENAMIENTO, lo que dice la bienvenida del
  // Evento de Nuevos, bot/ascenso.py y la página (Ligas, Ranking → Ascensos), y la plantilla que usa #postulaciones
  cyphers: {
    texto: '¡Hola! 🎙️ En DRA hay cyphers de voz: uno general, uno de primeros pasos, uno intermedio y uno avanzado. Entra '
      + 'cuando quieras y súmate a quien esté. Si prefieres uno armado con gente que recién empieza, en el **Evento de '
      + 'Nuevos** puedes elegir cypher y se arma solo cuando se junta el grupo.',
    botones: ['primeros', 'nuevos'],
  },
  ligas: {
    texto: '¡Hola! 🏟️ Las ligas son de los servidores socios: cada una tiene sus fechas, su tabla y sus campeones. Para '
      + 'ascender a la liga de un servidor sumas sus **puntos de ascenso** jugando sus competencias, y cada servidor tiene su '
      + 'propia regla. En la página tienes las ligas y la tabla de ascenso de cada servidor, al día.',
    botones: ['ligas_web', 'ascenso', 'ligas_canal'],
  },
  staff: {
    texto: '¡Hola! 💼 Para postularte al staff (DJ, jurado, host…) escribe en el canal de postulaciones con la plantilla: tu '
      + 'nombre, tu AKA, tu país, el rol al que te postulas, tu experiencia y tu disponibilidad. El equipo la lee y te '
      + 'contesta ahí mismo.',
    botones: ['postulaciones'],
  },
};
//: 👋 el «¿Tienes una duda?» de la bienvenida (grabador/bienvenida.js `DUDAS` arma el menú): cada opción, su respuesta
export const DUDAS = { competir: 'inscribirse', cuando: 'cuando', cyphers: 'cyphers', ligas: 'ligas', verificar: 'verificarse',
  staff: 'staff', liga: 'como_funciona' };
//: cómo se ve cada etiqueta en el aviso de los recibidores
export const NOMBRE_ETIQUETA = { inscribirse: 'cómo inscribirse', cuando: 'cuándo hay evento', primer_evento: 'su primer evento',
  verificarse: 'verificarse', tarjeta: 'su tarjeta', como_funciona: 'qué es la Liga' };
//: los botones: el texto, el emoji y de dónde sale el link
const BOTONES = {
  eventos: ['Eventos de hoy', '📅'], nuevos: ['Evento de Nuevos', '🐣'], verificar: ['Verificación', '✅'],
  pagina: ['Calendario', '🗓️', PAGINA_EVENTOS], guia: ['La Guía', '📖', PAGINA_GUIA], tarjetas: ['Tarjetas', '🃏', PAGINA_TARJETAS],
  vincular: ['Verificarme', '🔗', V.URL_VINCULAR],
  primeros: ['Cypher primeros pasos', '🌱'], ligas_canal: ['El foro de ligas', '🏟️'], postulaciones: ['Postulaciones', '💼'],
  ligas_web: ['Las ligas', '🏆', PAGINA + '/freestyle-rap/ligas'], ascenso: ['El ascenso', '📈', PAGINA + '/freestyle-rap/ranking/ascensos'],
};
// los textos del botón «Lo recibo yo»
export const TXT = {
  solo_recibidores: 'Esto es de los **Recibidores** de DRA: pídele el rol a Dlx si quieres recibir a la gente nueva.',
  vencida: 'Esa pregunta ya es vieja: no se puede recibir.',
  propio: 'No te puedes recibir a ti mismo 🙂',
  fallo: 'No pude anotarlo: prueba de nuevo en un minuto.',
  ya: (id) => '✋ Ya lo recibe <@' + id + '>.',
  saludo_propio: 'No puedes saludarte a ti mismo 🙂',
  saludo_ya: 'Ya lo saludaste 👋',
  saludo_tope: 'Ya lo saludaron 4 personas esta semana: ¡gracias igual! 🙌',
  saludo_listo: (canal) => '👋 Listo: lo saludaste en <#' + canal + '>.',
  saludo_texto: (quien, nuevo) => '👋 <@' + quien + '> le da la bienvenida a <@' + nuevo + '>',
  tuyo: '✋ Listo: lo recibes tú. Salúdalo en el chat 🙌\n-# Si juega su primer evento en los próximos 14 días, te cuenta para el Pase Premium.',
};

// ═══ los números ═══════════════════════════════════════════════════════════════════════════════════════════════════
export const ETIQUETAS = ['inscribirse', 'cuando', 'primer_evento', 'verificarse', 'tarjeta', 'como_funciona', 'nada'];
export const IA_MODELO = '@cf/meta/llama-3.2-1b-instruct';
export const IA_POR_DIA = 80;
export const IA_TOKENS = 8;
export const MAX_LARGO = 300;
export const PERSONA_MS = 24 * 3600 * 1000;      // una respuesta por persona cada 24 h
export const CANAL_MS = 90 * 1000;               // y una por canal cada 90 s
export const PREMIUM_N = 3;
export const CUENTA_DIAS = 14;
export const SALUDOS_MAX = 4;                    // saludos por persona nueva…
export const SALUDO_DIAS = 7;                    // …en 7 días
export const SALUDO_GIF = 'https://media1.tenor.com/m/_bUHqFfLUhIAAAAd/freestyle-music.gif';
export const PREGUNTA_DIAS = 30;                // cuánto se guarda una pregunta (sus IDs) para poder recibirla
const DIA_MS = 24 * 3600 * 1000;
const SNOW = /^\d{15,22}$/;

// ═══ el texto ══════════════════════════════════════════════════════════════════════════════════════════════════════
const sinTilde = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// ⚠️ EL PREFILTRO ESTÁ COPIADO EN grabador/recibidor.js (el grabador se despliega solo, sin bot/): `recibidor_prueba.mjs`
// revienta si los dos contestan distinto sobre los ejemplos. Si se toca uno, se toca el otro.
// Hace falta las dos cosas: un TEMA (inscribirse, jugar, evento, carta…) y algo de PREGUNTA (¿?, cómo, dónde, quiero…)
export const TEMA = /inscri[bvp]|anot[aeo]|regist|rejist|particip|partisip|\bentr[aeo]|\bun[io]r|\bme uno\b|\bjug|\bjueg|compet|compit|event|ivent|torne|batall|bataya|\bliga\b|\bcart[ai]|tarjet|\bcard\b|verifi|berifi|\brol\b|miembro|\bnuev[oa]s?\b|primer|empez|empie|\bsum[oa]r?me\b|\bsumo\b|\btir[ao]r?\b|\bcompe\b|cypher|llamada|\bcanal|\bbracket|\blista\b|\bcupo\b|perfil|\bficha\b|winrate|\brango|\bpuntos\b|\btiers?\b|formato|reglas|jurad|\bpase\b|\bnivel\b|calendario|horario|\bfinal\b|playoff|\bserver\b|servidor|under legends|ulaya|dinamica|microfono|\bstats\b|\bdrops?\b/;
export const PREGUNTA = /[?¿]|\bc?omo\b|\bkomo\b|\bcmo\b|\bdonde\b|\bdnd\b|\bcuando\b|\bkuando\b|\bse puede\b|\bpuedo\b|\bsabe\b|\bquiero\b|\bkiero\b|\bhay\b|\bay\b|\bque es\b|\bque hora\b|\bhago\b|\bago\b|\binfo\b|\bayuda\b|\bnunca\b|\bsoy nuev|\bprimera vez\b|\bq hay\b|\bque hay\b|\bq hora\b|\bno me deja\b|\bque trata\b|\bq\b|\bonde\b|\bquien\b|\bpasen\b|\bcuale?s?\b|\bpor que\b|\bme da\b|\balguien\b|\bnecesito\b|\bya empezo\b|\bdias de\b|\bpa ver\b|\bhoy se\b|\bahorita\b|\bahora mismo\b|\blink\b|\bformulario\b|\bno me sale\b|\bno aparece\b|\bno veo\b|\bcomando\b|\bexplica\b/;
/** ¿Vale la pena mirarlo? Barato: dos regex sobre el texto sin tildes. */
export function prefiltro(texto) {
  const t = sinTilde(texto);
  if (!t.trim() || t.length > MAX_LARGO) return false;
  return TEMA.test(t) && PREGUNTA.test(t);
}

/** Cómo suena una palabra: tolera faltas comunes (inscrivo, ago, kuando, rejistro, berifico) */
export function sonido(p) {
  return p.replace(/(.)\1+/g, '$1').replace(/h/g, '').replace(/qu/g, 'k').replace(/c(?=[ei])/g, 's').replace(/c/g, 'k')
    .replace(/z/g, 's').replace(/v/g, 'b').replace(/w/g, 'u').replace(/y$/, 'i');
}
// las raíces que importan, para que «juego» y «jugar», o «inscribo» e «inscripción», sean lo mismo
const RAIZ = [[/^inskri/, 'inskri'], [/^anot/, 'anot'], [/^re[gj]istr/, 'rejistr'], [/^partisip/, 'partisip'], [/^jueg|^jug/, 'jug'],
  [/^kompet|^kompit/, 'kompet'], [/^ebent|^ibent/, 'ebent'], [/^torne/, 'torne'], [/^batal|^bataia/, 'batal'], [/^liga/, 'liga'],
  [/^kart|^tarjet|^kard$/, 'karta'], [/^berifik/, 'berifik'], [/^entr[aeo]/, 'entra'], [/^unir|^uno$/, 'unir'], [/^nueb/, 'nueb'],
  [/^primer/, 'primer'], [/^nunk/, 'nunk'], [/^komo$|^kmo$|^omo$/, 'komo'], [/^dond|^dnd$/, 'donde'], [/^kuand|^kndo$/, 'kuando'],
  [/^oras?$/, 'ora'], [/^oi$/, 'oi'], [/^funsion/, 'funsion'], [/^trata/, 'trata'], [/^ag[oa]$|^aser$/, 'aser'], [/^pued|^pod/, 'poder'],
  [/^kier|^kere/, 'kerer'], [/^empes|^empies/, 'empesar'], [/^sum[oa]/, 'sumar'], [/^inisi/, 'empesar'],
  [/^konsig|^obten|^tengo$|^tener$|^sak/, 'sakar'], [/^pid|^pedir/, 'pedir'], [/^gan[oae]/, 'ganar'], [/^miembr/, 'miembro']];
const NADA = new Set(['ola', 'olas', 'oli', 'buenas', 'buenos', 'buen', 'dias', 'tardes', 'noches', 'a', 'al', 'de', 'del', 'la', 'el',
  'lo', 'los', 'las', 'me', 'mi', 'mis', 'te', 'tu', 'yo', 'se', 'ke', 'k', 'un', 'una', 'unos', 'unas', 'i', 'e', 'o', 'en',
  'para', 'pa', 'por', 'kon', 'sin', 'es', 'soi', 'esta', 'estoi', 'alguien', 'sabe', 'saben', 'porfa', 'porfabor', 'xfa', 'pls',
  'plis', 'bro', 'ermano', 'ermanos', 'gente', 'sikos', 'sikas', 'pana', 'panas', 'wei', 'men', 'amigo', 'amigos', 'grasias',
  'bueno', 'bien', 'ai', 'ia', 'eso', 'esto', 'aki', 'aka', 'saludos', 'mas', 'mui', 'tambien', 'solo', 'algo', 'ase', 'ok',
  'pues', 'pero', 'si', 'no', 'ps', 'xd', 'jaja', 'jajaja', 'q', 'le', 'les', 'su', 'sus', 'este', 'esa', 'ese']);
/** Las palabras que cuentan de un texto, ya pasadas por `sonido()` y su raíz */
export function palabras(texto) {
  const t = sinTilde(texto).replace(/<[@#][!&]?\d+>/g, ' ').replace(/https?:\/\/\S+/g, ' ').replace(/[^a-z0-9ñ\s]/g, ' ');
  const out = new Set();
  for (const p0 of t.split(/\s+/)) {
    if (!p0) continue;
    let p = sonido(p0.replace(/ñ/g, 'n'));
    if (!p || NADA.has(p)) continue;
    const r = RAIZ.find(([re]) => re.test(p));
    out.add(r ? r[1] : p.slice(0, 6));
  }
  return out;
}

// ═══ ✏️ LOS EJEMPLOS DEL CLASIFICADOR: cómo pregunta la gente de verdad (con sus faltas). Uno nuevo se suma acá ══════
// `nada` también tiene los suyos: lo que pasa el prefiltro y no es una pregunta de alguien nuevo (otro juego, la charla
// de un evento), para no gastar la IA en eso.
export const EJEMPLOS = {
  inscribirse: ['como me inscribo', 'como me inscribo a un evento', 'como me anoto', 'donde me inscribo', 'donde me anoto',
    'como participo', 'como participo en un evento', 'como entro al evento', 'como entro a la batalla', 'como juego un evento',
    'quiero jugar un evento', 'quiero participar', 'como me uno al torneo', 'como me registro', 'puedo participar',
    'se puede participar', 'como compito', 'como hago para jugar', 'como hago para participar', 'quiero competir',
    'como me sumo al evento', 'como son las inscripciones', 'como entro a la liga', 'quiero entrar a la liga',
    'como ago pa jugar', 'komo me inscrivo', 'donde hay que anotarse', 'como me anoto pa la batalla', 'alguien sabe como me inscribo',
    'como juego en la liga', 'como se juega', 'quiero batallar', 'puedo jugar', 'como me apunto al torneo',
    'como entro al torneo', 'como hago para entrar al evento'],
  cuando: ['cuando hay evento', 'cuando hay eventos', 'a que hora es el evento', 'hay evento hoy', 'cuando es el proximo torneo',
    'cuando empieza la batalla', 'a que hora empieza', 'hay batallas hoy', 'cuando juegan', 'cuando hay liga', 'que dia hay evento',
    'cuando es el proximo evento', 'a que hora es la batalla', 'hoy hay torneo', 'kuando ay evento', 'cuando arranca el evento'],
  primer_evento: ['soy nuevo como juego', 'soy nuevo', 'soy nueva', 'nunca jugue un evento', 'es mi primera vez', 'primera vez que entro',
    'soy nuevo como participo', 'soy nuevo como me inscribo', 'nuevo aca como empiezo', 'recien entro como juego', 'nunca he competido',
    'quiero empezar a competir', 'como empiezo', 'nunca jugue', 'soy nuevo en esto de las batallas', 'nunca he jugado un evento',
    'primera vez en una batalla'],
  verificarse: ['como me verifico', 'donde me verifico', 'como verifico mi cuenta', 'no puedo verificarme', 'como me verifico aca',
    'como saco el rol de miembro', 'como obtengo el rol', 'como me hago miembro', 'no me deja verificar', 'como berifico'],
  tarjeta: ['como saco mi carta', 'como tengo mi tarjeta', 'donde veo mi carta', 'como consigo la tarjeta', 'como hago la card',
    'como pido mi carta', 'como saco mi tarjeta', 'como tener carta', 'quiero mi carta', 'como se saca la carta'],
  como_funciona: ['que es la liga', 'que es la liga global', 'como funciona la liga', 'de que trata la liga', 'como funciona esto de la liga',
    'como funcionan los eventos', 'que es esto de la liga', 'como funciona el ranking de la liga'],
  nada: ['alguien juega free fire', 'quien juega fortnite', 'alguien para jugar minecraft', 'alguien quiere jugar valorant',
    'jugamos lol', 'quien gano la batalla', 'quien gano el evento', 'como quedo el evento', 'que buena batalla', 'alguien juega roblox',
    'quien gano la liga', 'quien quiere jugar', 'alguien juega cod'],
};
// 🗣️ las de Gemini que trajo Dlx (28/11/2026: «las 100 formas de preguntar»), normalizadas. Las que el clasificador
// no reconocía como su etiqueta o no pasaban el prefiltro quedaron afuera (ver la prueba).
export const EJEMPLOS_GEMINI = {"inscribirse": ["como me anoto a las batallas", "onde me inscribo bro", "como entro a la compe", "quiero tirar hoy como le hago", "donde me registro pa batallar", "pasen link de inscripcion", "como juego el torneo", "hay cupo pa tirar hoy", "q tengo q hacer pa competir", "como me meto a la lista", "donde mando mis datos pa la liga", "se puede anotar todavia", "quien me anota", "donde me postulo pa tirar free", "q canal es pa inscribirse", "bro quiero entrar a la liga como hago", "como participo en los torneos", "formulario de inscripcion", "como entro al bracket", "hay q pagar pa inscribirse o es gratis"], "como_funciona": ["q es under legends", "de q trata la liga", "alguien me explica la dinamica", "como suman los puntos", "esto es por discord o por donde se tira", "cuales son las reglas de las batallas", "que es el pase de temporada", "hay jurados o vota la gente", "como subo de nivel aqui", "te banean si pierdes o como es el formato"], "cuando": ["cuando hay evento", "a q hora empieza hoy", "hoy se tira", "cuando es la proxima compe", "hay torneo ahorita", "dias de evento", "donde veo el calendario de fechas", "q dias se compite", "estan tirando ahorita en algun canal", "cuando abren inscripciones pa la proxima fecha", "hoy hay cypher o compe oficial", "cuando juega la liga", "ya empezo el evento de hoy", "a que hora abren llamada pa rapear", "en q servidor toca hoy"], "primer_evento": ["como funciona esto bro soy nuevo", "soy nuevo no entiendo nada q hago primero", "cuando es el evento de nuevos", "ya entre al discord y ahora que hago"], "tarjeta": ["como saco mi carta tipo fifa", "como veo mi tarjeta de freestyle", "onde creo mi perfil", "comando pa ver mi tarjeta", "como me pongo foto en la carta", "por que no me sale mi tarjeta en la pagina", "como subo las stats de mi carta", "donde veo mi rango y mis puntos", "como consigo mi card de ulaya", "link de la pagina pa ver mi perfil", "que comando uso en el bot pa ver mis batallas", "como cambio mi aka en la tarjeta", "como se consiguen los drops de la carta", "mi perfil no aparece en la pagina", "donde veo el top ranking de tarjetas", "como personalizo mi ficha", "quien disena las tarjetas o salen solas", "donde sale mi winrate", "como reclamo mi tarjeta"], "verificarse": ["como me verifico", "no puedo escribir donde me verifico", "como me dan el rol de competidor", "reaccione al emoji y no me da rol", "donde esta el canal de verificacion", "como activo mi cuenta en el server", "q comando pongo pa verificarme", "necesito microfono pa verificarme", "alguien me da rol de freestyler porfa", "soy nuevo no me deja hablar en los canales", "donde acepto las reglas", "que rol necesito pa tirar en las salas", "me sale canal bloqueado como entro", "ayuda no veo los canales de voz", "como me registro con el bot ulaya", "hay que pasar prueba de audio pa verificarse", "que hago en el canal de bienvenida pa pasar"]};
for (const [et, l] of Object.entries(EJEMPLOS_GEMINI)) for (const t of l) if (!EJEMPLOS[et].includes(t)) EJEMPLOS[et].push(t);
const PRIORIDAD = ['primer_evento', 'verificarse', 'tarjeta', 'inscribirse', 'cuando', 'como_funciona', 'nada'];
const TABLA = Object.entries(EJEMPLOS).flatMap(([et, l]) => l.map((e) => ({ et, p: palabras(e) }))).filter((x) => x.p.size);

/**
 * 🏷️ La etiqueta sin IA: cuánto de cada ejemplo está en el mensaje (`|ejemplo ∩ mensaje| / |ejemplo|`), el mejor de cada
 * etiqueta. `seguro` = un ejemplo entero de 2 palabras o más está adentro, y ninguna otra etiqueta empata con uno igual
 * de largo. Si no, `seguro: false` y el Worker le pregunta a la IA (o, sin cupo, usa `etiqueta` si `puntos` llega a .5).
 */
export function clasificar(texto) {
  const m = palabras(texto);
  const mejor = {};
  for (const x of TABLA) {
    let n = 0;
    for (const p of x.p) if (m.has(p)) n++;
    const s = n / x.p.size;
    const b = mejor[x.et];
    if (!b || s > b.s || (s === b.s && x.p.size > b.largo)) mejor[x.et] = { s, largo: x.p.size };
  }
  // a igual puntaje y largo, la etiqueta de más arriba en `PRIORIDAD` (quien dice que nunca jugó y pregunta cómo se
  // inscribe va al Evento de Nuevos, que también dice cómo inscribirse)
  const orden = Object.entries(mejor).sort((a, b) => b[1].s - a[1].s || b[1].largo - a[1].largo
    || PRIORIDAD.indexOf(a[0]) - PRIORIDAD.indexOf(b[0]));
  if (!orden.length) return { etiqueta: 'nada', seguro: false, puntos: 0 };
  const [et, b] = orden[0];
  const segundo = orden[1] && orden[1][1];
  // un empate entre dos etiquetas de verdad lo resuelve `PRIORIDAD`; un empate con «nada» queda en duda (lo ve la IA)
  const empata = segundo && segundo.s === b.s && segundo.largo === b.largo && (et === 'nada' || orden[1][0] === 'nada');
  return { etiqueta: et, seguro: b.s === 1 && b.largo >= 2 && !empata, puntos: b.s };
}

/** Lo que dijo la IA (o cualquiera) → una etiqueta de la lista. Lo que no es, `nada`. */
export function validar(x) {
  const t = sinTilde(x).trim();
  if (ETIQUETAS.includes(t)) return t;
  // los modelos chicos a veces suman un punto, comillas o «Etiqueta: …»: vale la primera que aparezca entera
  const m = /[a-z_]+/g;
  let p;
  while ((p = m.exec(t))) if (ETIQUETAS.includes(p[0])) return p[0];
  return 'nada';
}

export const IA_SISTEMA = 'Clasificas mensajes del chat de Discord de una liga de batallas de freestyle rap. Contesta SOLO una '
  + 'etiqueta, sin nada más:\ninscribirse = pregunta cómo anotarse o participar en un evento\ncuando = pregunta cuándo o a qué '
  + 'hora hay evento\nprimer_evento = dice que es nuevo o que nunca jugó\nverificarse = pregunta cómo verificarse o sacar el rol\n'
  + 'tarjeta = pregunta por su carta o tarjeta\ncomo_funciona = pregunta qué es la liga o cómo funciona\nnada = cualquier otra '
  + 'cosa (charla, otro juego, no es una pregunta)';
/** La IA elige UNA etiqueta. Cualquier error, `nada`. */
export async function preguntarIA(env, texto) {
  if (!env || !env.AI) return 'nada';
  try {
    const r = await env.AI.run(IA_MODELO, { messages: [{ role: 'system', content: IA_SISTEMA },
      { role: 'user', content: String(texto || '').slice(0, MAX_LARGO) }], max_tokens: IA_TOKENS, temperature: 0 });
    return validar((r && (r.response || r.result || '')) || '');
  } catch (e) { return 'nada'; }
}

// ═══ los mensajes ══════════════════════════════════════════════════════════════════════════════════════════════════
const canalUrl = (g, c) => 'https://discord.com/channels/' + g + '/' + c;
/** 👋 El botón de saludar a `nuevo`; el saludo sale en `canal` (donde preguntó), toque donde se toque */
export const botonSaludo = (nuevo, canal) => V.boton('Saludar', 'rsal:' + nuevo + ':' + canal, 1, { emoji: { name: '👋' } });

/**
 * La respuesta fija de una etiqueta, con sus links. `links`: `{eventos, nuevos, verificar}` (IDs de canales de DRA).
 * `saludo`: `{nuevo, canal}` para sumar «👋 Saludar» (sin eso, no va).
 */
export function respuesta(etiqueta, links = {}, g = GUILD_DRA, saludo = null) {
  const r = RESPUESTAS[etiqueta];
  if (!r) return null;
  const botones = [];
  for (const b of r.botones) {
    const [txt, emoji, url] = BOTONES[b] || [];
    if (!txt) continue;
    const u = url || (SNOW.test(String((links || {})[b] || '')) ? canalUrl(g, links[b]) : '');
    if (u) botones.push(V.enlace(txt, u, emoji));
  }
  const sal = saludo && SNOW.test(String(saludo.nuevo || '')) && SNOW.test(String(saludo.canal || ''))
    ? [botonSaludo(saludo.nuevo, saludo.canal)] : [];
  return V.mensaje({ color: V.COLOR.verde, efimero: false, dentro: [V.T(r.texto)], filas: [botones.slice(0, 5 - sal.length).concat(sal)],
    sinVincular: true });
}

/** El extracto del aviso: una línea, sin saltos, hasta 120 letras, sin que los `*` o `_` rompan nada */
export function extracto(texto) {
  let t = String(texto || '').replace(/\s+/g, ' ').trim();
  if (t.length > 120) t = t.slice(0, 119).trimEnd() + '…';
  return t.replace(/([\\*_~|`>])/g, '\\$1');
}

/** 🚪 El aviso para el canal de los recibidores. Sin menciones que suenen: `<#canal>` no suena y `allowed_mentions` va vacío. */
export function avisoMsg({ g = GUILD_DRA, canal, msg, texto, etiqueta, nuevo = '' }) {
  return V.mensaje({ color: V.COLOR.verde, efimero: false, dentro: [
    V.T('### 🚪 Alguien nuevo preguntó en <#' + canal + '>'),
    V.T('> ' + extracto(texto)),
    V.T('-# Tema: ' + (NOMBRE_ETIQUETA[etiqueta] || etiqueta) + ' · el bot ya le contestó. Recíbelo tú también 🙌'),
  ], filas: [[V.boton('Lo recibo yo', 'rcb:' + msg, 3, { emoji: { name: '✋' } }),
    SNOW.test(String(nuevo)) ? botonSaludo(nuevo, canal) : null, V.enlace('Ir al mensaje', canalUrl(g, canal) + '/' + msg, '↗️')]] });
}

/** 👋 El saludo: quién saluda a quién, el GIF y el botón otra vez. Sólo le suena al nuevo. */
export function saludoMsg(quien, nuevo, canal) {
  return { flags: V.V2, components: [V.T(TXT.saludo_texto(quien, nuevo)), V.galeria(SALUDO_GIF), V.fila(botonSaludo(nuevo, canal))],
    allowed_mentions: { parse: [], users: [String(nuevo)] } };
}

/**
 * El aviso después de que alguien lo recibió: el mismo mensaje (las piezas que vinieron en el clic), con «✋ Lo recibe
 * <@id>» al final del recuadro y el botón apagado. Sin que suene nadie.
 * 👋 Con VARIOS «Lo recibo yo» en el mismo aviso (el de los que entraron juntos, grabador/bienvenida.js): sólo se apaga el
 * tocado (`cid`) y la línea dice a quién (`✋ <@quien> recibe a <@nuevo>`); los demás siguen libres.
 */
export function avisoRecibido(message, quien, cid = '', nuevo = '') {
  const comps = JSON.parse(JSON.stringify((message && message.components) || []));
  let rcbs = 0;
  for (const c of comps) for (const b of (c && c.type === 1 && c.components) || []) if (b.type === 2 && /^rcb:/.test(String(b.custom_id || ''))) rcbs++;
  const varios = rcbs > 1 && /^rcb:/.test(cid) && SNOW.test(String(nuevo));
  const linea = varios ? '✋ <@' + quien + '> recibe a <@' + nuevo + '>' : '✋ Lo recibe <@' + quien + '>';
  const vieja = varios ? (t) => t.endsWith('recibe a <@' + nuevo + '>') : (t) => /^✋ Lo recibe/.test(t);
  for (const c of comps) {
    if (c.type === 17 && Array.isArray(c.components)) {
      c.components = c.components.filter((x) => !(x.type === 10 && vieja(String(x.content || ''))));
      c.components.push({ type: 10, content: linea });
    }
    if (c.type === 1 && Array.isArray(c.components)) {
      c.components = c.components.map((b) => (b.type === 2 && /^rcb:/.test(String(b.custom_id || '')) && (!varios || b.custom_id === cid)
        ? { type: 2, style: 2, label: 'Recibido', custom_id: b.custom_id, disabled: true, emoji: { name: '✋' } } : b));
    }
  }
  if (!comps.some((c) => c.type === 17)) comps.unshift(V.caja(V.COLOR.verde, [V.T(linea)]));
  return { flags: V.V2, components: comps, allowed_mentions: { parse: [] } };
}

// ═══ el objeto (`o` es el Durable Object: `o.sql`, `o.leer`, `o.guardar`, `o.aBandeja`, `o.pasePremium`…) ═══════════
export function recibidorTablas(sql) {
  // 🔒 sin el texto: quién preguntó, dónde, qué etiqueta y cuándo (para el freno de 24 h y para poder recibirla)
  sql.exec('CREATE TABLE IF NOT EXISTS rcb_pregunta (msg TEXT PRIMARY KEY, nuevo TEXT NOT NULL, canal TEXT NOT NULL, ' +
    'etiqueta TEXT NOT NULL, t INTEGER NOT NULL) WITHOUT ROWID');
  sql.exec('CREATE INDEX IF NOT EXISTS rcb_pregunta_nuevo ON rcb_pregunta (nuevo, t)');
  sql.exec('CREATE INDEX IF NOT EXISTS rcb_pregunta_canal ON rcb_pregunta (canal, t)');
  sql.exec('CREATE INDEX IF NOT EXISTS rcb_pregunta_t ON rcb_pregunta (t)');
  // ✋ quién recibió a quién: UNA fila por persona nueva (la recibe uno solo). `ev0` son sus eventos al recibirla; `cuenta`:
  // 0 esperando · 1 jugó su primer evento a tiempo (cuenta para el premio de `recibidor`, en la temporada `temp`) ·
  // -1 ya había jugado antes (no cuenta)
  sql.exec('CREATE TABLE IF NOT EXISTS rcb_recibe (nuevo TEXT PRIMARY KEY, msg TEXT NOT NULL, recibidor TEXT NOT NULL, ' +
    "t INTEGER NOT NULL, ev0 INTEGER NOT NULL DEFAULT 0, cuenta INTEGER NOT NULL DEFAULT 0, temp TEXT NOT NULL DEFAULT '', " +
    'cuenta_t INTEGER) WITHOUT ROWID');
  sql.exec('CREATE INDEX IF NOT EXISTS rcb_recibe_t ON rcb_recibe (cuenta, t)');
  sql.exec('CREATE INDEX IF NOT EXISTS rcb_recibe_quien ON rcb_recibe (recibidor, temp, cuenta)');
  // 👋 quién saludó a quién y cuándo: el tope de `SALUDOS_MAX` en `SALUDO_DIAS` días, y uno por persona
  sql.exec('CREATE TABLE IF NOT EXISTS rcb_saludo (nuevo TEXT NOT NULL, quien TEXT NOT NULL, t INTEGER NOT NULL, ' +
    'PRIMARY KEY (nuevo, quien)) WITHOUT ROWID');
  sql.exec('CREATE INDEX IF NOT EXISTS rcb_saludo_t ON rcb_saludo (t)');
}

/**
 * 👋 Un saludo (`/recibidor-saludar`, sólo del Worker): `{nuevo, quien}`. `{ok, n}` si vale, o `{error: 'propio' | 'ya'
 * | 'tope' | 'faltan datos'}`. Con `deshacer`, borra el de `quien` (si Discord no dejó publicarlo, no cuenta).
 */
export function saludar(o, d, ahora = Date.now()) {
  const nuevo = String((d && d.nuevo) || ''), quien = String((d && d.quien) || '');
  if (!SNOW.test(nuevo) || !SNOW.test(quien)) return { error: 'faltan datos' };
  if (d.deshacer) { o.sql.exec('DELETE FROM rcb_saludo WHERE nuevo = ? AND quien = ?', nuevo, quien); return { ok: true }; }
  if (nuevo === quien) return { error: 'propio' };
  const desde = ahora - SALUDO_DIAS * DIA_MS;
  if (fila(o, 'SELECT 1 AS x FROM rcb_saludo WHERE nuevo = ? AND quien = ? AND t > ?', nuevo, quien, desde)) return { error: 'ya' };
  const n = Number((fila(o, 'SELECT COUNT(*) AS n FROM rcb_saludo WHERE nuevo = ? AND t > ?', nuevo, desde) || {}).n) || 0;
  if (n >= SALUDOS_MAX) return { error: 'tope' };
  o.sql.exec('INSERT OR REPLACE INTO rcb_saludo (nuevo, quien, t) VALUES (?, ?, ?)', nuevo, quien, ahora);
  return { ok: true, n: n + 1 };
}

/**
 * 🗑️ «Olvidarme»: sus preguntas, sus saludos (dados y recibidos) y a quién recibió. Si era un recibido que ya le contó a su
 * recibidor, la fila queda SIN su ID (al recibidor no se le descuenta lo que ganó); si era recibidor, lo suyo se suelta.
 */
export function olvidar(o, quien) {
  quien = String(quien || '');
  if (!SNOW.test(quien)) return;
  o.sql.exec('DELETE FROM rcb_pregunta WHERE nuevo = ?', quien);
  o.sql.exec('DELETE FROM rcb_saludo WHERE nuevo = ? OR quien = ?', quien, quien);
  o.sql.exec("UPDATE rcb_recibe SET nuevo = 'borrado:' || lower(hex(randomblob(8))), msg = '' WHERE nuevo = ? AND cuenta = 1", quien);
  o.sql.exec('DELETE FROM rcb_recibe WHERE nuevo = ? OR recibidor = ?', quien, quien);
}

/**
 * 🔀 Para `mudarCuenta()`: todo lo suyo pasa a la cuenta nueva, también la marca de su premio (`rcbprem:<temp>:<id>`):
 * con el ID viejo, la cuenta nueva llegaba a 3 de nuevo y lo volvía a cobrar. Lo que choca con algo de la nueva, queda
 * lo de la nueva.
 */
export function mudar(o, viejo, nuevo) {
  viejo = String(viejo || ''); nuevo = String(nuevo || '');
  if (!SNOW.test(viejo) || !SNOW.test(nuevo) || viejo === nuevo) return;
  for (const [t, c] of [['rcb_pregunta', 'nuevo'], ['rcb_recibe', 'nuevo'], ['rcb_saludo', 'nuevo'], ['rcb_saludo', 'quien']]) {
    o.sql.exec(`UPDATE OR IGNORE ${t} SET ${c} = ? WHERE ${c} = ?`, nuevo, viejo);
    o.sql.exec(`DELETE FROM ${t} WHERE ${c} = ?`, viejo);
  }
  o.sql.exec('UPDATE rcb_recibe SET recibidor = ? WHERE recibidor = ?', nuevo, viejo);
  for (const r of o.sql.exec("SELECT origen FROM premium_vale WHERE origen LIKE 'rcbprem:%'").toArray()) {
    const p = String(r.origen).split(':');
    if (p.length === 3 && p[2] === viejo) o.sql.exec('UPDATE OR IGNORE premium_vale SET origen = ? WHERE origen = ?', p[0] + ':' + p[1] + ':' + nuevo, r.origen);
  }
}

const fila = (o, q, ...p) => o.sql.exec(q, ...p).toArray()[0] || null;
/** El día de hoy en hora del este, para el tope de la IA */
export const diaET = (ahora = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(ahora));
/** La temporada con que se guarda el Pase (`paseDatos().cfg.temp`); si no hay Pase todavía, la de los eventos */
function temporada(o) {
  try { const P = o.paseDatos ? o.paseDatos() : null; if (P && P.cfg && P.cfg.temp) return String(P.cfg.temp); } catch (e) { /* sigue */ }
  try { const r = o.leer('racha_cfg'); if (r && r.temp) return String(r.temp); } catch (e) { /* sigue */ }
  return '';
}
/** Los eventos de la temporada en curso de esa persona (`jugo_temp`, con la temporada que escribió el ciclo) */
function eventosDe(o, quien) {
  let temp = 'prueba';
  try { const r = o.leer('racha_cfg'); if (r && r.temp) temp = String(r.temp); } catch (e) { /* la de arranque */ }
  try { const f = fila(o, 'SELECT eventos FROM jugo_temp WHERE quien = ? AND temp = ?', quien, temp); return f ? Number(f.eventos) || 0 : 0; } catch (e) { return 0; }
}

/**
 * 📨 Una pregunta (`/recibidor-pedir`, sólo del Worker): `{msg, nuevo, canal, etiqueta?, ia?}`.
 *   · `espera`: esa persona ya tuvo respuesta en 24 h, o el canal en 90 s (no se contesta)
 *   · con `etiqueta` de la lista: se anota (sin el texto) y `anotado`; con `nada`, `nada` y no se anota
 *   · sin etiqueta y con `ia`: `{estado: 'ia', permiso}`, y si hay permiso se cuenta contra el tope del día
 */
export function pedir(o, d, ahora = Date.now()) {
  const msg = String((d && d.msg) || ''), nuevo = String((d && d.nuevo) || ''), canal = String((d && d.canal) || '');
  if (!SNOW.test(msg) || !SNOW.test(nuevo) || !SNOW.test(canal)) return { error: 'faltan datos' };
  if (fila(o, 'SELECT 1 AS x FROM rcb_pregunta WHERE msg = ?', msg)) return { estado: 'espera', por: 'mensaje' };
  // 👋 la fila de cuando ENTRÓ (`entro()`, etiqueta `entro`) no es una pregunta: no le frena la primera respuesta
  if (fila(o, "SELECT 1 AS x FROM rcb_pregunta WHERE nuevo = ? AND t > ? AND etiqueta != 'entro'", nuevo, ahora - PERSONA_MS)) return { estado: 'espera', por: 'persona' };
  if (fila(o, "SELECT 1 AS x FROM rcb_pregunta WHERE canal = ? AND t > ? AND etiqueta != 'entro'", canal, ahora - CANAL_MS)) return { estado: 'espera', por: 'canal' };
  const et = d.etiqueta == null ? null : validar(d.etiqueta);
  if (et === 'nada') return { estado: 'nada' };
  if (et) {
    o.sql.exec('INSERT OR IGNORE INTO rcb_pregunta (msg, nuevo, canal, etiqueta, t) VALUES (?, ?, ?, ?, ?)', msg, nuevo, canal, et, ahora);
    return { estado: 'anotado', etiqueta: et };
  }
  if (!d.ia) return { estado: 'nada' };
  const hoy = diaET(ahora);
  const c = o.leer('rcb_ia') || {};
  const n = c.dia === hoy ? Number(c.n) || 0 : 0;
  if (n >= IA_POR_DIA) return { estado: 'ia', permiso: false, n };
  o.guardar('rcb_ia', { dia: hoy, n: n + 1 });
  return { estado: 'ia', permiso: true, n: n + 1 };
}

/**
 * 👋 Gente que ENTRÓ a DRA (`/recibidor-entro`, del grabador: grabador/bienvenida.js), para que «Lo recibo yo» sirva
 * también con quien todavía no preguntó nada. `{canal, nuevos: [id]}`: una fila por persona en `rcb_pregunta`, con la
 * persona como `msg` (la clave de `rcb:<msg>`: un ID de usuario nunca es el de un mensaje) y la etiqueta `entro`, que
 * `pedir()` no cuenta para sus frenos. Si entra dos veces, vale la última. Hasta 25 por vez.
 */
export function entro(o, d, ahora = Date.now()) {
  const canal = String((d && d.canal) || '');
  const nuevos = Array.isArray(d && d.nuevos) ? d.nuevos.map(String).filter((x) => SNOW.test(x)) : [];
  if (!SNOW.test(canal) || !nuevos.length || nuevos.length > 25) return { error: 'faltan datos' };
  for (const n of nuevos) {
    o.sql.exec("INSERT OR REPLACE INTO rcb_pregunta (msg, nuevo, canal, etiqueta, t) VALUES (?, ?, ?, 'entro', ?)", n, n, canal, ahora);
  }
  return { ok: true, n: nuevos.length };
}

/**
 * ✋ «Lo recibo yo» (`/recibidor-reclamar`, sólo del Worker, que ya miró el rol): `{msg, quien}`. El primero gana.
 * `{estado: 'tuyo' | 'otro', recibidor}`, o `{error: 'vencida' | 'propio' | 'faltan datos'}`.
 * Una persona nueva la recibe UNO solo: si ya la recibió alguien (por esta pregunta o por otra) y sigue en sus 14 días
 * o ya contó, es de ése. Si se le vencieron sin jugar, la puede recibir otro.
 */
export async function reclamar(o, d, ahora = Date.now(), dueno = '') {
  const msg = String((d && d.msg) || ''), quien = String((d && d.quien) || '');
  if (!SNOW.test(msg) || !SNOW.test(quien)) return { error: 'faltan datos' };
  const p = fila(o, 'SELECT nuevo FROM rcb_pregunta WHERE msg = ?', msg);
  if (!p) return { error: 'vencida' };
  if (p.nuevo === quien) return { error: 'propio' };
  const r = fila(o, 'SELECT recibidor, t, cuenta FROM rcb_recibe WHERE nuevo = ?', p.nuevo);
  if (r && (Number(r.cuenta) !== 0 || Number(r.t) > ahora - CUENTA_DIAS * DIA_MS)) {
    return { estado: r.recibidor === quien ? 'tuyo' : 'otro', recibidor: r.recibidor, ya: true, nuevo: p.nuevo };
  }
  const ev0 = eventosDe(o, p.nuevo);
  o.sql.exec('INSERT INTO rcb_recibe (nuevo, msg, recibidor, t, ev0, cuenta, temp) VALUES (?, ?, ?, ?, ?, ?, ?) ' +
    "ON CONFLICT(nuevo) DO UPDATE SET msg = excluded.msg, recibidor = excluded.recibidor, t = excluded.t, ev0 = excluded.ev0, " +
    "cuenta = excluded.cuenta, temp = excluded.temp, cuenta_t = NULL", p.nuevo, msg, quien, ahora, ev0, ev0 > 0 ? -1 : 0, '');
  // por si ya llegó a los que pide (una persona que contó en otra vuelta y el premio no se pudo dar)
  try { await premiar(o, quien, ahora, dueno); } catch (e) { /* el vigía lo vuelve a mirar */ }
  return { estado: 'tuyo', recibidor: quien, nuevo: p.nuevo };
}

/**
 * ⏰ Cada hora, desde el vigía: los recibidos de los últimos 14 días que todavía esperan (con el índice, sólo ésos) y si
 * ya jugaron su primer evento. Al que juega se le cuenta a su recibidor en la temporada de hoy; al que llega a
 * `PREMIUM_N`, el premio. Y lo viejo se va: las preguntas de más de 30 días. Devuelve cuántos contaron.
 * ⚠️ Corre cada hora y el ciclo manda los eventos cada media: la ventana tiene 2 h de gracia para que un primer evento
 * jugado en la última hora del día 14 no se pierda entre una vuelta y la otra.
 */
export async function revisar(o, ahora = Date.now(), dueno = '') {
  o.sql.exec('DELETE FROM rcb_pregunta WHERE t < ?', ahora - PREGUNTA_DIAS * DIA_MS);
  o.sql.exec('DELETE FROM rcb_saludo WHERE t < ?', ahora - SALUDO_DIAS * DIA_MS);
  const esperan = o.sql.exec('SELECT nuevo, recibidor, ev0 FROM rcb_recibe WHERE cuenta = 0 AND t > ?',
    ahora - CUENTA_DIAS * DIA_MS - 2 * 3600000).toArray();
  if (!esperan.length) return 0;
  const temp = temporada(o);
  if (!temp) return 0;
  const tocados = new Set();
  let n = 0;
  for (const r of esperan) {
    if (eventosDe(o, r.nuevo) <= Number(r.ev0)) continue;
    o.sql.exec('UPDATE rcb_recibe SET cuenta = 1, temp = ?, cuenta_t = ? WHERE nuevo = ? AND cuenta = 0', temp, ahora, r.nuevo);
    tocados.add(r.recibidor);
    n++;
  }
  for (const q of tocados) { try { await premiar(o, q, ahora, dueno); } catch (e) { /* la próxima vuelta */ } }
  return n;
}

/** Cuántos le cuentan a un recibidor en la temporada `temp` */
export const contados = (o, quien, temp) => Number((fila(o, 'SELECT COUNT(*) AS n FROM rcb_recibe WHERE recibidor = ? AND temp = ? AND cuenta = 1',
  quien, temp) || {}).n) || 0;

/**
 * 💎 Con `PREMIUM_N` personas que ya jugaron en la temporada: el Pase Premium de esa temporada, UNA vez (el vale
 * `rcbprem:<temp>:<id>` es la marca: si ya está, no se hace nada). Por el mismo camino que los vales de los campeones de
 * liga (`premium_vale` + `pase_premium`, ver `valeUsar()` de avisos.js): el vale va como usado por esa cuenta en esta
 * temporada, así la cuenta del rol de premium del ciclo (`paseCiclo()`) no se lo cierra. Si ya tenía el premium (por el
 * rol), el vale queda SIN usar en su Inventario, para la temporada que elija. Devuelve `true` si lo dio ahora.
 */
export async function premiar(o, quien, ahora = Date.now(), dueno = '') {
  if (!SNOW.test(String(quien)) || quien === dueno) return false;
  const P = o.paseDatos ? o.paseDatos() : null;
  const temp = P && P.cfg && P.cfg.temp ? String(P.cfg.temp) : '';
  if (!temp || contados(o, quien, temp) < PREMIUM_N) return false;
  const origen = 'rcbprem:' + temp + ':' + quien;
  if (fila(o, 'SELECT 1 AS x FROM premium_vale WHERE origen = ?', origen)) return false;
  const pr = o.pasePremium(quien, temp);
  // 🎁 la prueba de 14 días no cuenta como «ya lo tenía»: la temporada entera se le da igual (`premiumTemporada()`)
  const yaPrem = o.premiumTemporada ? !!o.premiumTemporada(quien, temp, ahora) : !!(pr && (pr[1] == null || pr[1] > ahora));
  const k = (o.claveDe && o.claveDe(quien)) || '';
  const motivo = 'Recibiste a ' + PREMIUM_N + ' personas nuevas que jugaron';
  const url = PAGINA + '/freestyle-rap/pase';
  if (yaPrem && k) {
    o.sql.exec('INSERT OR IGNORE INTO premium_vale (origen, k, motivo, dado) VALUES (?, ?, ?, ?)', origen, k, motivo, ahora);
    o.aBandeja(quien, 'rcbprem:' + temp, 'pase', '🚪 Recibiste a ' + PREMIUM_N + ' personas que ya jugaron',
      'Ya tenías el Pase Premium: te guardamos uno en tu Inventario para la temporada que elijas.', url, '', ahora);
    return true;
  }
  o.sql.exec('INSERT OR IGNORE INTO premium_vale (origen, k, motivo, dado, usado_temp, usado_por, usado_t) VALUES (?, ?, ?, ?, ?, ?, ?)',
    origen, k, motivo, ahora, temp, quien, ahora);
  if (!yaPrem) {
    o.sql.exec('INSERT INTO pase_premium (quien, temp, desde, hasta) VALUES (?, ?, ?, NULL) ON CONFLICT(quien, temp) ' +
      'DO UPDATE SET hasta = NULL', quien, temp, ahora);
    try { o.premiarPase(quien); } catch (e) { /* lo cobra con su próxima Tarea */ }
  }
  o.aBandeja(quien, 'rcbprem:' + temp, 'pase', '🚪 Recibiste a ' + PREMIUM_N + ' personas que ya jugaron',
    'El Pase Premium de esta temporada es tuyo.', url, '', ahora);
  return true;
}

// ═══ el Worker ═════════════════════════════════════════════════════════════════════════════════════════════════════
const alObjeto = (env, ruta, cuerpo) => env.AVISOS.get(env.AVISOS.idFromName('liga')).fetch('https://avisos/' + ruta, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo || {}),
}).then((r) => r.json()).catch(() => ({ error: 'red' }));
const json = (x, st = 200) => new Response(JSON.stringify(x), { status: st, headers: { 'content-type': 'application/json; charset=utf-8' } });

/**
 * 📨 `/recibidor` (sólo con la clave del ciclo: la del grabador). `{texto, canal, autor, msg, unido, g, links}`.
 * `{ok, responder?, aviso?, etiqueta?}`: `responder` es la respuesta fija (el grabador la publica como respuesta al
 * mensaje) y `aviso` el mensaje para el canal de los recibidores. Sin nada que responder, `{ok: true, nada: true}`.
 * ⚠️ El texto no se guarda en ningún lado ni se escribe en el log.
 */
export async function ruta(req, env) {
  let d = null;
  try { d = await req.json(); } catch (e) { d = null; }
  const texto = String((d && d.texto) || '');
  if (!d || String(d.g || GUILD_DRA) !== GUILD_DRA || !SNOW.test(String(d.canal || '')) || !SNOW.test(String(d.autor || ''))
    || !SNOW.test(String(d.msg || '')) || texto.length > MAX_LARGO) return json({ ok: false, error: 'datos' }, 400);
  const nada = (motivo) => json({ ok: true, nada: true, motivo });
  if (!prefiltro(texto)) return nada('prefiltro');
  const c = clasificar(texto);
  const base = { msg: String(d.msg), nuevo: String(d.autor), canal: String(d.canal) };
  let et = c.seguro ? c.etiqueta : null;
  let r = await alObjeto(env, 'recibidor-pedir', Object.assign({}, base, et ? { etiqueta: et } : { ia: true }));
  if (!r || r.error) return json({ ok: false, error: 'objeto' }, 502);
  if (r.estado === 'ia') {
    // sin cupo de IA, lo que dijo el clasificador si llegó a la mitad; si no, nada
    et = validar(r.permiso ? await preguntarIA(env, texto) : (c.puntos >= 0.5 ? c.etiqueta : 'nada'));
    if (et === 'nada') return nada(r.permiso ? 'ia' : 'sin_ia');
    r = await alObjeto(env, 'recibidor-pedir', Object.assign({}, base, { etiqueta: et }));
    if (!r || r.error) return json({ ok: false, error: 'objeto' }, 502);
  }
  if (r.estado !== 'anotado') return nada(r.estado === 'espera' ? 'espera_' + r.por : r.estado);
  const links = d.links && typeof d.links === 'object' ? d.links : {};
  return json({ ok: true, etiqueta: r.etiqueta, responder: respuesta(r.etiqueta, links, GUILD_DRA, { nuevo: base.nuevo, canal: base.canal }),
    aviso: avisoMsg({ canal: base.canal, msg: base.msg, texto, etiqueta: r.etiqueta, nuevo: base.nuevo }) });
}

/**
 * 👋 `/recibidor-entro` (sólo con la clave del ciclo: la del grabador, grabador/bienvenida.js). `{g, canal, nuevos}`: los
 * que entraron a DRA, para que el «Lo recibo yo» del aviso de los recibidores tenga a quién (`entro()`). `{ok, n}`.
 */
export async function rutaEntro(req, env) {
  let d = null;
  try { d = await req.json(); } catch (e) { d = null; }
  if (!d || String(d.g || '') !== GUILD_DRA || !SNOW.test(String(d.canal || '')) || !Array.isArray(d.nuevos)
    || !d.nuevos.length || d.nuevos.length > 25 || !d.nuevos.every((x) => SNOW.test(String(x)))) return json({ ok: false, error: 'datos' }, 400);
  const r = await alObjeto(env, 'recibidor-entro', { canal: String(d.canal), nuevos: d.nuevos.map(String) });
  return r && r.ok ? json({ ok: true, n: r.n }) : json({ ok: false, error: 'objeto' }, 502);
}

const API = 'https://discord.com/api/v10';
const luego =(ctx, p) => { if (ctx && ctx.waitUntil) ctx.waitUntil(p); else p.catch(() => {}); };
const responder = (tipo, data) => new Response(JSON.stringify(data === undefined ? { type: tipo } : { type: tipo, data }),
  { headers: { 'content-type': 'application/json' } });
/** ¿Puede recibir? El rol de Recibidor en DRA, o el dueño */
export const puedeRecibir = (i, dueno) => {
  const id = (i && i.member && i.member.user && i.member.user.id) || (i && i.user && i.user.id) || '';
  if (dueno && id === dueno) return true;
  return !!(i && i.guild_id === GUILD_DRA && i.member && Array.isArray(i.member.roles) && i.member.roles.includes(ROL_RECIBIDOR));
};

/**
 * ✋ El botón `rcb:<mensaje>` del aviso. Quién puede lo mira acá (los roles vienen firmados en el clic); el primero gana
 * en el objeto. «Ya va» sin mensaje nuevo (tipo 6) —el objeto puede estar dormido y Discord corta a los 3 s— y después
 * se edita el aviso («✋ Lo recibe <@id>», sin que suene) y, a quien llegó tarde, un «Ya lo recibe…» que ve sólo él.
 */
export function boton(i, env, ctx, dueno = '') {
  const id = (i.member && i.member.user && i.member.user.id) || (i.user && i.user.id) || '';
  const msg = String(((i.data && i.data.custom_id) || '').split(':')[1] || '');
  const solo = (txt) => responder(4, V.avisoMsg(txt));
  if (!puedeRecibir(i, dueno)) return solo(TXT.solo_recibidores);
  if (!SNOW.test(id) || !SNOW.test(msg)) return solo(TXT.fallo);
  const editar = (data) => fetch(`${API}/webhooks/${i.application_id}/${i.token}/messages/@original`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }).catch(() => {});
  const aparte = (txt) => fetch(`${API}/webhooks/${i.application_id}/${i.token}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(V.avisoMsg(txt)) }).catch(() => {});
  luego(ctx, (async () => {
    const j = await alObjeto(env, 'recibidor-reclamar', { msg, quien: id });
    if (j && j.recibidor) await editar(avisoRecibido(i.message, j.recibidor, String((i.data && i.data.custom_id) || ''), j.nuevo));
    if (j && j.estado === 'tuyo' && !j.ya) await aparte(TXT.tuyo);
    else if (j && j.estado === 'otro') await aparte(TXT.ya(j.recibidor));
    else if (!j || j.error) await aparte(TXT[j && j.error] || TXT.fallo);
  })());
  return responder(6);
}

/**
 * 👋 El botón `rsal:<nuevo>:<canal>`, en la respuesta al nuevo, en el aviso de los recibidores y en cada saludo.
 * Cualquiera de DRA menos el nuevo. «Ya va» (tipo 6) y después: el objeto lo cuenta y el saludo sale con el token del bot
 * en `canal` (donde preguntó), sonándole sólo al nuevo. Tocado desde otro canal (el de los recibidores), un «Listo» que ve
 * sólo quien tocó. Si Discord no deja publicar, el saludo no cuenta.
 */
export function saludarBoton(i, env, ctx) {
  const id = (i.member && i.member.user && i.member.user.id) || '';
  const [, nuevo, canal] = String((i.data && i.data.custom_id) || '').split(':');
  const solo = (txt) => responder(4, V.avisoMsg(txt));
  if (i.guild_id !== GUILD_DRA || !SNOW.test(id) || !SNOW.test(String(nuevo)) || !SNOW.test(String(canal))) return solo(TXT.fallo);
  if (id === nuevo) return solo(TXT.saludo_propio);
  const aparte = (txt) => fetch(`${API}/webhooks/${i.application_id}/${i.token}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(V.avisoMsg(txt)) }).catch(() => {});
  luego(ctx, (async () => {
    const j = await alObjeto(env, 'recibidor-saludar', { nuevo, quien: id });
    if (!j || !j.ok) { await aparte((j && TXT['saludo_' + j.error]) || TXT.fallo); return; }
    let r = null;
    try {
      r = await fetch(`${API}/channels/${canal}/messages`, { method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: 'Bot ' + env.DISCORD_TOKEN },
        body: JSON.stringify(saludoMsg(id, nuevo, canal)) });
    } catch (e) { r = null; }
    if (!r || !r.ok) {
      await alObjeto(env, 'recibidor-saludar', { nuevo, quien: id, deshacer: true });
      await aparte(TXT.fallo);
      return;
    }
    if (i.channel_id !== canal) await aparte(TXT.saludo_listo(canal));
  })());
  return responder(6);
}

// ═══ 👋 la bienvenida de DRA (grabador/bienvenida.js): «¿Tienes una duda?» y «🎁 Reclamar premio» ══════════════════════
/**
 * El valor de cada opción del menú lleva los canales que su respuesta necesita (el Worker no los conoce: los busca el
 * grabador por nombre), así no hace falta guardar nada: `<clave>:<eventos>:<nuevos>:<verificar>:<extra>`, y `extra` es el
 * canal propio de esa respuesta (el cypher de primeros pasos, el foro de ligas o el de postulaciones).
 */
export function dudaMsg(valor, g = GUILD_DRA) {
  const [clave, eventos, nuevos, verificar, extra] = String(valor || '').split(':');
  const et = DUDAS[clave];
  const m = et ? respuesta(et, { eventos, nuevos, verificar, primeros: extra, ligas_canal: extra, postulaciones: extra }, g) : null;
  if (!m) return V.avisoMsg(TXT.fallo);
  m.flags = (Number(m.flags) || 0) | V.EFIMERO;
  return m;
}
/** 👋 `bvd:faq`, el menú «¿Tienes una duda?»: la respuesta fija, que ve sólo quien preguntó */
export function dudaBoton(i) {
  return responder(4, dudaMsg(((i.data && i.data.values) || [])[0], i.guild_id || GUILD_DRA));
}

const fechaET = (t) => new Intl.DateTimeFormat('es', { timeZone: 'America/New_York', day: 'numeric', month: 'long' }).format(new Date(t));
const DIAS_PRUEBA = 14;
/**
 * 🎁 Lo que contesta «Reclamar premio» según lo que dijo el objeto (`/premium-prueba` de bot/premium_regalos.js: la prueba
 * del Pase Premium, una por cuenta y sólo verificados). `verificar` es el canal de #verificate-aqui (viene en el botón).
 */
export function premioMsg(j, verificar = '', g = GUILD_DRA) {
  const pase = V.enlace('Abrir mi Pase', PAGINA + '/freestyle-rap/pase/premium', '🎟️');
  const dias = Number(j && j.dias) || DIAS_PRUEBA;
  const hasta = j && Number(j.hasta) ? fechaET(Number(j.hasta)) : '';
  if (j && j.ok) {
    return V.avisoMsg('🎁 ¡Listo! Tienes **' + dias + ' días de Pase Premium**' + (hasta ? ', hasta el ' + hasta : '') + '. '
      + 'Tus Tareas dan más XP mientras dure.', [pase]);
  }
  const por = String((j && (j.por || j.error)) || '');
  if (por === 'verificar') {
    return V.avisoMsg('Primero verifícate' + (SNOW.test(String(verificar)) ? ' en <#' + verificar + '>' : '') + ': eliges tu país y '
      + 'tu AKA. Después vuelve a tocar «Reclamar premio» y son tuyos ' + dias + ' días de Pase Premium.',
    [SNOW.test(String(verificar)) ? V.enlace('Verificarme', canalUrl(g, verificar), '✅') : V.enlace('Verificarme', V.URL_VINCULAR, '🔗')]);
  }
  if (por === 'usada') {
    return V.avisoMsg(j.activa ? '🎁 Ya tienes tu prueba del Pase Premium' + (hasta ? ': te dura hasta el ' + hasta : '') + '.'
      : 'Ya usaste tu prueba del Pase Premium: es una por cuenta.', [pase]);
  }
  if (por === 'ya_premium') return V.avisoMsg('💎 Ya tienes el Pase Premium esta temporada.', [pase]);
  if (por === 'ya_tuviste') return V.avisoMsg('Ya tuviste el Pase Premium esta temporada, y la prueba es para quien no lo tuvo.', [pase]);
  if (por === 'sin_temporada') return V.avisoMsg('El Pase todavía no arrancó: vuelve cuando empiece la temporada.');
  return V.avisoMsg(TXT.fallo);
}
/**
 * 🎁 `bvp:<canal de verificar>`, «Reclamar premio» de la bienvenida: reclama la prueba del Pase Premium PARA QUIEN TOCA (no
 * para el de la bienvenida: es una por cuenta). «Ya va» (tipo 6: el objeto puede estar dormido y Discord corta a los 3 s)
 * y la respuesta, que ve sólo quien tocó.
 */
export function premioBoton(i, env, ctx) {
  const id = (i.member && i.member.user && i.member.user.id) || '';
  const verificar = String(((i.data && i.data.custom_id) || '').split(':')[1] || '');
  if (i.guild_id !== GUILD_DRA || !SNOW.test(id)) return responder(4, V.avisoMsg(TXT.fallo));
  luego(ctx, (async () => {
    const j = await alObjeto(env, 'premium-prueba', { quien: id, si: true });
    await fetch(`${API}/webhooks/${i.application_id}/${i.token}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(premioMsg(j, verificar)) }).catch(() => {});
  })());
  return responder(6);
}
