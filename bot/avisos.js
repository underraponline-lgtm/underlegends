/**
 * LOS AVISOS DE EVENTOS — la campana del hub.
 *
 * Cuando un servidor de la Liga anuncia un evento en su canal, a quien se
 * suscribió en `underlegends.pages.dev/freestyle-rap/avisos` le llega una notificación
 * al teléfono o a la compu, aunque no tenga Discord abierto.
 *
 * 🔴 TIENE QUE SER AL MINUTO, Y ESO LO DECIDIERON LOS DATOS. Medido el
 * 24/09/2026 sobre los 26 anuncios con hora de `datos/anuncios.json`:
 *
 *     anunciados con 15 min o menos de aviso    18 de 26
 *     con 30 min o menos                        23 de 26
 *     con más de una hora                        2 de 26
 *
 * O sea que «avisar 30 minutos antes» llega tarde casi siempre: el evento
 * se anuncia **ya** empezando. Lo que sirve es avisar en cuanto aparece el
 * anuncio. El ciclo lee los canales cada 15-30 min más lo que tarde
 * Actions en arrancar —el cron de GitHub dispara 1 de cada 9 veces—, así
 * que con él el aviso de un «EN 15» llegaría con el evento empezado. Es
 * la regla de `ESTADO.md`: *«un aviso de un evento que empezó hace una
 * hora es peor que no avisar»*.
 *
 * Por eso esto NO depende del ciclo: un Cron Trigger de Cloudflare
 * (`* * * * *`) le pide a Discord los últimos mensajes de cada canal de
 * eventos, y lo nuevo sale en el momento. Son 3 pedidos por minuto.
 *
 * ⚠️ NADA DE ESTO ESCRIBE EN KV. La cuota gratis de KV son 1.000
 * escrituras por día **para toda la cuenta**, y el 24/09/2026 se agotó
 * (1.117) y congeló el hub. Las suscripciones, lo ya avisado y el latido
 * viven en un Durable Object con SQLite: 100.000 filas escritas por día
 * gratis. El latido de cada minuto son 1.440.
 *
 * ⚠️ EL LECTOR DE ANUNCIOS ESTA DOS VECES, y es a propósito: el ciclo es
 * Python (`bot/anuncios.py`, `bot/cuando.py`) y un Worker no corre Python.
 * Lo que las ata es `bot/avisos_casos.json`: 57 casos —45 mensajes reales
 * de los canales y 12 bordes armados a mano— con lo que Python saca de
 * cada uno. `python bot/avisos_casos.py
 * --auto` comprueba que Python siga dando eso y `node
 * bot/avisos_prueba.mjs` que esto dé lo mismo. Si alguien cambia uno solo,
 * CI se pone rojo — que es la diferencia entre «dos copias» y «dos copias
 * que se desincronizan sin avisar», la forma que este repo ya documentó
 * cinco veces.
 *
 * ⚠️ LAS NOTIFICACIONES VAN CIFRADAS (RFC 8291, `aes128gcm`) y firmadas
 * con VAPID (RFC 8292). Verificado contra el ejemplo del propio RFC —ver
 * `bot/avisos_prueba.mjs`— antes de mandarle nada a nadie.
 */

// 🛡️ el anti-raid (18/10/2026): su lógica y lo que contesta el Worker viven en `bot/antiraid.js`; acá, la vuelta de cada minuto
import * as AR from './antiraid.js';
import * as CW from './crews.js';

export const CRON_VIGIA = '* * * * *';

const HUB = 'https://underlegends.pages.dev';
//: 🖼️ el bucket público de R2 (el de las cartas): ahí van los fondos (13/10/2026)
const R2_PUB = 'https://pub-70d5821d06a8432c9cffd0c102195000.r2.dev';
const DC = 'https://discord.com/api/v10';
// Discord pide este formato de User-Agent; sin él puede contestar 400.
const UA = 'DiscordBot (https://underlegends.pages.dev, 1)';

const MIN = 60 * 1000;
const HORA = 60 * MIN;

//: un anuncio SIN hora se avisa sólo si es de hace menos de esto. Pasado
//: ese rato ya no se sabe si el evento está por empezar o terminó.
const EDAD_SIN_HORA = 20 * MIN;
//: un evento que empezó hace menos de esto todavía se avisa («¡empieza
//: ahora!»); después, no. Es la regla de arriba con un número.
const GRACIA = 5 * MIN;
//: cuánto para atrás se mira en cada canal. Un anuncio más viejo que esto
//: no se avisa nunca, aunque su evento sea mañana.
const EDAD_MAX = 12 * HORA;
//: si el evento es en más de esto, además del aviso al anunciarse va un
//: recordatorio `ANTES` de que empiece.
const RECORDAR_SI_FALTA = 60 * MIN;
const ANTES = 30 * MIN;
//: cada cuánto se vuelven a buscar los canales de eventos por nombre.
const REDESCUBRIR = 6 * HORA;
//: 🔑 SOLO EVENTOS Y COMPETENCIAS. Dlx, 25/09/2026: *«solo eventos y
//: competencias»*. La primera versión usaba la búsqueda del hub
//: (`anuncio|novedad|torneo` también) y escuchaba 14 canales. Los de
//: anuncios y novedades los sigue leyendo el ciclo para el ranking y el
//: hub; el vigía, que sólo manda avisos, no los necesita.
//: 🏛️ Y «torneo»: el canal de eventos de la ACADEMIA (04/10/2026) se llama «🥇┇torneos», en su categoría
//: «COMPES / EVENTOS». Medido en los siete servidores de la Liga: es el único canal con «torneo», así que
//: no suma ningún canal de anuncios o novedades de los otros —la regla de Dlx sigue igual—
export const PATRON_VIGIA = /evento|competenc|torneo/i;
//: si cambia qué canales se escuchan, la lista guardada se rehace ya y no
//: a las seis horas
// 3: los nombres se normalizan (NFKD) antes de compararlos; ver `vigilar()`
// 4: sólo los servidores confirmados de la Liga (`meta.liga`); ver `descubrir()`
// 5: Urban Freestyle le dio al bot su rol (25/09/2026) y «Data⋅Eventos»,
// que daba 403, ya se puede leer: se vuelve a buscar sin esperar las 6 h.
// 6: también los canales de VEREDICTOS (28/09/2026); ver `veredictos()`.
// 7: entra FFS, sin las categorías de sus ligas (`meta.fuera`, 28/09/2026).
// 9: y los de «votaciones» y «resultados» (02/10/2026): ver `PATRON_VEREDICTOS`.
// 10: cada canal con su categoría (`p`), para «Inscribite ya» (03/10/2026). Ver `invitacionPara()`
// 11: «torneo» en `PATRON_VIGIA`, y «organiz» en `STAFF` (la ACADEMIA, 04/10/2026)
// 12: el chat general de cada servidor, para el bot en vivo (05/10/2026). Ver `chatGeneralDe()`
// 13: «anuncios» adentro de una categoría de torneos (FVS, 12/10/2026). Ver `descubrir()`
// 14: «central» también es el chat general (FVS y FFS, 12/10/2026). Ver `chatGeneralDe()`
const CANALES_V = 14;

//: 🔑 LOS CANALES DE VEREDICTOS. Dlx, 28/09/2026: *«tienes que estar
//: pendiente de todos los canales de eventos cuando hay un evento en vivo…
//: en veredictos está todo lo que pasó»*. Snake Rap juega sus 5 vidas ahí,
//: sin llave. Se descubren por nombre —los que dicen «llave» ya los lee
//: `llaves()`— y se leen SÓLO mientras su servidor tiene un evento en juego:
//: Urban Freestyle tiene ocho, y leerlos siempre sería gastar el minuto.
//: 🔴 Y NO SÓLO «VEREDICTOS» (02/10/2026): FFA juega en `✦🗳️︱votaciones`, y ahí estaba la llave verdadera de la DOS
//: GENERACIONES VOL 2; FFS tiene `VOTACIONES` y `RESULTADOS`. Dlx: *«cuando hay eventos en vivo en X servidor, tienes que
//: estar atento a los canales de eventos también, respectivamente»*. Las «postulaciones» no: es quién entra al staff.
//: ⚠️ Es la misma regla que `escuchar.VEREDICTOS` y `NO_VEREDICTOS`: si cambia una, cambia la otra
export const PATRON_VEREDICTOS = /veredict|votaci|resultad/i;
export const NO_VEREDICTOS = /postulaci/i;
//: cuántos canales de veredictos se leen como mucho por minuto
export const VER_TOPE = 6;
//: un servidor está «en vivo» desde 15 min antes del arranque hasta 5 h después
const VER_ANTES = 15 * MIN;
const VER_DESPUES = 5 * HORA;

/**
 * La firma de la lista de servidores de la Liga en `meta`: `liga` y `fuera`.
 * 🔑 Si cambia, el vigía vuelve a buscar canales en el momento (ver `vigilar()`).
 */
export function firmaLiga(meta) {
  const m = meta || {};
  return JSON.stringify([Array.isArray(m.liga) ? m.liga : [], (m.fuera && typeof m.fuera === 'object') ? m.fuera : {}]);
}

// 🔑 LAS INSCRIPCIONES, CADA MINUTO. Dlx, 29/09/2026: «cuando anuncian un
// evento, tienes que estar chequeando las inscripciones constantemente». Los
// organizadores LIMPIAN el canal después del evento —el de FFA no tenía ni un
// mensaje de la noche de la VOL 16 2VS2 a la mañana siguiente—, y el ciclo lo
// lee cada media hora: lo que se anota y se borra en el medio se perdía. El
// vigía los lee mientras un servidor tiene un evento anunciado o en juego y
// los guarda (`inscritos`); el ciclo los suma (`bot/anuncios.py`).
const INSC_ANTES = 12 * HORA;
const INSC_DESPUES = 5 * HORA;
//: cuántos canales de inscripciones por minuto: comparte los 50 subpedidos
const INSC_TOPE = 4;
//: cuánto se guarda: alcanza para que el ciclo los lea aunque falle un día
const INSC_GUARDA = 3 * 24 * HORA;

/** Los servidores que se están anotando: un evento anunciado de acá a 12 h, o en juego. */
export function svsInscribiendo(cuerpos, ahora) {
  const out = new Set();
  for (const c of cuerpos || []) {
    let d = null;
    try { d = typeof c === 'string' ? JSON.parse(c) : c; } catch (e) { d = null; }
    if (!d || d.tipo !== 'evento' || d.ini == null || !d.sv) continue;
    if (d.ini - INSC_ANTES <= ahora && ahora <= d.ini + INSC_DESPUES) out.add(d.sv);
  }
  return out;
}

/**
 * La clave con que el ciclo pide lo que el vigía guardó (`/avisos/inscritos`).
 * ⚠️ SALE DEL TOKEN DEL BOT, QUE LOS DOS YA TIENEN: no es un secreto nuevo (los
 * tokens nuevos, al final: Dlx). Esa ruta trae Discord IDs y no es pública.
 * ⚠️ El ciclo la calcula en `bot/clave_ciclo.py`, con el MISMO prefijo: su `--auto` lee esta línea y se pone rojo
 * si no coinciden. El prefijo no es secreto; cambiarlo invalida una clave filtrada sin tocar el token (13/10/2026).
 */
const PREFIJO_CICLO = 'lg-ciclo:';
export async function claveCiclo(token) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(PREFIJO_CICLO + String(token || '')));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * 🔴 EL EVENTO QUE SE CANCELA. Dlx, 01/10/2026: «B» —que diga «Cancelado» y le avise a quien activó la campana para
 * ese servidor—. Esa noche FFA anunció DESGRACIAS EN TOKYO VOL 21 2v2 para las 7:20 PM y lo borró: la campana ya
 * había sonado y nadie supo que no se hacía.
 *
 * `estado` es lo que contestó Discord al pedir el anuncio (`GET /channels/<c>/messages/<id>`) y `m` el mensaje.
 * Borrado (404), o editado diciendo «cancelado» o «suspendido». ⚠️ La palabra sólo cuenta si el anuncio NO la traía
 * cuando se avisó (`cx` del cuerpo): «si no te presentás, tu cupo queda cancelado» es una regla, no una cancelación,
 * y FFS anunció en broma «EL Q SE INSCRIBE SE CANCELA LA COMPE». ⚠️ Y cualquier otra respuesta (un 403, un 5xx, la
 * red) no dice nada: no se cancela un evento porque Discord no contestó.
 */
export const CANCELADO = /\bcancelad[oa]s?\b|\bsuspendid[oa]s?\b|\bse\s+cancel[aó]\b/i;

//: sin alguna de estas, `estadoDeMensaje()` no tiene nada que leer: el vigía relee cada minuto los mismos mensajes
export const PISTA_ESTADO = /cancel|suspend|anulad|pospon|pospuest|aplaz|reprogram|posterg|pausa|atras|retras|demor|tarde|horario|reanud|retom|contin|seguimos|sigue|ma[ñn]ana|otro d[ií]a|no se|<t:\d/i;
/**
 * 📢 LO QUE EL ORGANIZADOR AVISA DESPUÉS DEL ANUNCIO, EN UN MENSAJE APARTE (Dlx, 07/10/2026: *«asegurate de q el bot
 * pueda entender cuando pasa estas situaciones… lit el evento se canceló o se va a atrasar»*). GALLOS DEL UNDER AMATEUR
 * I (Snake Rap) se cortó en cuartos —*«una disculpa se me fue la luz, podemos reanudar con la compe mañana siguiendo la
 * llave»*— y la página lo seguía dando EN VIVO: `cancelado()` sólo mira el anuncio mismo, borrado o editado.
 *
 *   cancelado   «se cancela», «cancelada», «suspendido», «no se hace / no se va a jugar», «queda anulado»
 *   pausado     sigue OTRO día: «reanudamos / seguimos / continuamos … mañana», «se pospone», «aplazado», «reprogramado»
 *   atrasado    el MISMO día, más tarde: «se atrasa», «retraso», «empezamos más tarde», «nuevo horario»
 *
 * `{ tipo, nueva, mas }` o `null`. `nueva` es la hora nueva sólo si la dice de una forma que no depende de la zona de
 * nadie —`<t:…>` o «en N minutos / horas», contado desde `pub`—; `mas`, cuánto se corre («se atrasa 30 min»), contado
 * desde la hora del evento. ⚠️ No son un aviso: lo condicional («si no se llenan los cupos se cancela»), lo negado («no
 * se cancela») y la regla de siempre («tu cupo queda cancelado si no te presentás»).
 */
export function estadoDeMensaje(texto, pub) {
  const crudo = String(texto || '');
  const s = crudo.replace(/<(?:@[!&]?|#)\d+>|<a?:\w+:\d+>|https?:\/\/\S+/g, ' ')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ');
  const pubMs = Number(pub) || 0;
  if (/\bsi\s+(?:no\b|nadie|hay\s+poc|faltan?)[^.!?\n]{0,60}\b(?:cancel|suspend|pospon|aplaz|atras|retras)/.test(s)) return null;
  if (/\bno\s+(?:se\s+|esta\s+|va\s+a\s+ser\s+)?(?:cancel|suspend|pospon|aplaz|atras|retras)/.test(s)) return null;
  // la hora nueva: el sello de Discord, o «en N minutos / horas» desde el mensaje
  const sello = /<t:(\d{9,11})(?::[a-zA-Z])?>/.exec(crudo);
  const enN = /\ben\s+(\d{1,3})\s*(min|minutos?|mins?|m|horas?|hs?|h)\b/.exec(s) || (/\ben\s+media\s+hora\b/.test(s) ? [0, '30', 'min'] : null);
  const desdeAhora = enN && pubMs ? pubMs + Number(enN[1]) * (/^h/.test(enN[2]) ? 3600000 : 60000) : 0;
  const nueva = sello ? Number(sello[1]) * 1000 : desdeAhora;
  const corre = /\b(?:atras\w*|retras\w*|demor\w*|corre\w*|pospon\w*|pausa\w*)\s+(?:de\s+|unos?\s+|por\s+)?(\d{1,3})\s*(min|minutos?|mins?|m|horas?|hs?|h)\b/.exec(s);
  const mas = corre ? Number(corre[1]) * (/^h/.test(corre[2]) ? 3600000 : 60000) : 0;
  const otroDia = /\b(?:manana|pasado\s+manana|otro\s+dia|la\s+proxima\s+semana|el\s+(?:lunes|martes|miercoles|jueves|viernes|sabado|domingo))\b/;
  const sigueOtro = new RegExp('\\b(?:reanud\\w*|retom\\w*|continu\\w*|seguimos|seguir\\w*|sigue\\w*|termin\\w*|batallar\\w*|jugamos|se\\s+juega\\w*|se\\s+hace\\w*|terminamos)\\b[^.!?\\n]{0,80}' + otroDia.source
    + '|' + otroDia.source + '[^.!?\\n]{0,40}\\b(?:reanud\\w*|retom\\w*|continu\\w*|seguimos|sigue\\w*|termin\\w*|batallar\\w*|jugamos|se\\s+juega\\w*)\\b');
  const posterga = /\b(?:se\s+pospone|pospuest[oa]s?|posponemos|pospondr\w*|aplaz\w*|reprogram\w*|posterg\w*|en\s+pausa|pausad[oa]s?|pausamos)\b/;
  const atrasa = /\b(?:se\s+atras\w*|atrasad[oa]s?|atrasamos|retras\w*|demor\w*|se\s+corre\s+(?:la\s+hora|el\s+horario|la\s+compe)|(?:empez|arranc|comenz|inici)\w*\s+(?:un\s+poco\s+)?mas\s+tarde|nuevo\s+horario|nueva\s+hora|cambio\s+de\s+(?:hora|horario))\b/;
  const cancela = /\b(?:se\s+cancel\w*|cancelad[oa]s?|cancelamos|cancelo|suspendid[oa]s?|se\s+suspende\w*|suspendemos|no\s+se\s+(?:va\s+a\s+)?(?:hace|hara|hacer|realiza\w*|juega|jugara|jugar)\b|queda\s+anulad[oa]|anulad[oa])/;
  // ⚠️ «tu cupo queda cancelado», «inscripción cancelada»: la regla de siempre, no el evento
  const cupo = /\b(?:cupo|cupos|inscripcion\w*|participacion|lugar)\b[^.!?\n]{0,30}\b(?:cancelad|anulad)/;
  const tardeOtroDia = nueva && pubMs && nueva - pubMs > 18 * 3600000;
  if (sigueOtro.test(s) || (posterga.test(s) && !mas && !desdeAhora) || tardeOtroDia) {
    return { tipo: 'pausado', nueva: tardeOtroDia ? nueva : 0, mas: 0 };
  }
  if (atrasa.test(s) || (posterga.test(s) && (mas || desdeAhora))) return { tipo: 'atrasado', nueva, mas };
  if (cancela.test(s) && !cupo.test(s)) return { tipo: 'cancelado', nueva: 0, mas: 0 };
  return null;
}
/** Un código corto y estable de un texto (dos FNV-1a de 32 bits): para comparar sin mostrar lo que es (ver `vivo()`). */
export function codigoDe(s) {
  let a = 0x811c9dc5, b = 0x5bd1e995;
  const t = String(s);
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x5bd1e995) ^ (b >>> 15);
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

export function cancelado(estado, m, cuerpo, avisado) {
  // 🔴 SÓLO EL MENSAJE QUE NO EXISTE (código 10008). Discord también contesta 404 cuando se borró el CANAL entero
  // (10003): un servidor que rehace su canal de eventos cancelaba todos sus eventos anotados (revisión del 03/10/2026).
  // Sin cuerpo (`m` nulo), el 404 se sigue leyendo como borrado, que es lo que dice casi siempre
  if (estado === 404) return !m || m.code == null || m.code === 10008 ? 'borrado' : '';
  if (estado !== 200 || !m || (cuerpo && cuerpo.cx)) return '';
  // 🔴 Y EDITADO DESPUÉS DE AVISARLO: un anuncio anotado antes de que existiera `cx` no dice si la palabra ya estaba;
  // sin una edición posterior, la palabra es del texto de siempre
  const ed = m.edited_timestamp ? Date.parse(String(m.edited_timestamp).slice(0, 19) + 'Z') : NaN;
  if (!(ed > (avisado || 0))) return '';
  return CANCELADO.test(String(m.content || '')) ? 'editado' : '';
}

// ═════════════════════════════════════════════════════════════════════
// 🎤 «TE TOCA» (Dlx, 01/10/2026: «podrías arrancar eso que te avisen por la web cuando te toque»)
// ═════════════════════════════════════════════════════════════════════
//
// Cada minuto el vigía lee las llaves en vivo con el lector de la página (`paginas/llave_vivo.js`, subido como un
// módulo más del Worker: las mismas reglas que se ven). A quien pelea la batalla de AHORA le llega «¡Te toca!», y a quien
// pelea la que SIGUE, «Sos el próximo»: sólo a quien vinculó la campana con su Discord (`subs.quien`, como los avisos de
// cada uno), nunca por DM.
//
// 🔑 «¡TE TOCA!» SUENA HASTA QUE PASE ALGO (Dlx, el mismo día: «si no viene durante un tiempo esa misma persona es
// reemplazada por el mismo organizador… no hay necesidad de seguir llamándolo. Otra forma para parar esto es cuando
// confirmas que el usuario está en la llamada compitiendo»). Vuelve a sonar cada minuto, hasta `TOQUES` veces, y se
// deja de llamar a alguien:
//   (a) cuando ya no está en la llave: el organizador lo reemplazó. Sale solo: la llave se lee de nuevo cada minuto
//       y sólo se llama a quien la llave nombra; a quien entró en su lugar le llega su propio aviso;
//   (b) cuando está en la llamada: se le pregunta a Discord antes de cada aviso (`enLaLlamada()`), y con un sí no se
//       lo vuelve a llamar por esa batalla;
//   (c) cuando su batalla ya tiene ganador.
//
// ⚠️ NO ANTES DE QUE SE JUEGUE LA PRIMERA. La llave se publica antes de que el evento arranque, y ahí la primera
// batalla parece la de AHORA: se avisa recién cuando hay una batalla decidida.
// ⚠️ SÓLO SI SE SABE CUÁL VA. Dlx, el mismo día: «a veces se hacen batallas de otras llaves antes que la anterior».
// Con una batalla de más adelante decidida justo antes que una de más atrás, no se sabe cuál va: no se avisa (ver
// `turnosDe()`, que deja pasar el hueco cuando ya quedó claramente atrás).
// ⚠️ Y SÓLO CON UN NOMBRE QUE NO DEJA DUDAS: el nombre de la llave se busca en el índice que arma el ciclo con la Lista y
// los alias (`turnos:nombres` en KV, ver `bot/avisos_personales.py`). Si no está, o es de dos personas, no se avisa.

/** La clave de un nombre para el índice de turnos. ⚠️ La misma que `clave_turno()` de `bot/avisos_personales.py`. */
export function claveTurno(n) {
  return String(n || '').replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').normalize('NFKD')
    .replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
}

/**
 * La batalla de AHORA y la que SIGUE de una llave en vivo (`LlaveVivo.aLlave()`), o `null` si no se puede saber: no va
 * en orden, o ya no queda nada por jugar. Una batalla cuenta si tiene dos lados o más; está jugada si tiene ganador o se
 * resolvió sin uno (`pasan N`).
 */
export function turnosDe(L) {
  const orden = [];
  for (const R of (L && L.rondas) || []) {
    (R.b || []).forEach((b, i) => {
      const lados = (b[0] || []).filter(Boolean);
      if (lados.length < 2) return;
      orden.push({ r: R.r, i, lados, hecha: !!b[1] || /^pasan \d/.test(String(b[2] || '')) });
    });
  }
  let ult = -1;
  orden.forEach((x, k) => { if (x.hecha) ult = k; });
  // ⚠️ sin nada jugado todavía: la llave se publica antes de que el evento arranque
  if (ult < 0) return null;
  // 🔑 UNA BATALLA SIN GANADOR QUE QUEDÓ ATRÁS. Con UNA jugada después puede ser la que se postergó y va ahora —no se
  // sabe: no se avisa—; con DOS o más, el organizador no la marcó o no se jugó, y la llave sigue desde la última
  // jugada. ⚠️ La página es más estricta (`enOrden()` de `web/src/arriba.jsx`: cualquier hueco apaga su «AHORA»), y
  // acá no alcanzaba: «Dos Generaciones Un Destino Vol 2» (FFA, 01/10/2026) terminó con dos batallas de octavos sin
  // ganador. Revelada batalla por batalla, con la regla de la página el bot avisaba 4 de sus 15; con ésta, 10 —la
  // primera nunca, ver arriba—. Cada hueco cuesta las dos batallas que se jugaron justo después.
  for (let k = 0; k < ult; k++) {
    if (!orden[k].hecha && orden.slice(k + 1).filter((x) => x.hecha).length < 2) return null;
  }
  const pend = orden.slice(ult + 1);
  if (!pend.length) return null;
  return { ahora: pend[0], sigue: pend[1] || null };
}

/**
 * A quién llamar este minuto: `[{did, tipo, bat, base, clave, n}]`. `t` sale de `turnosDe(L)`, `idx` es el índice de
 * nombres y `hecho(id)` dice cuándo se anotó esa clave en `hechos` (o `null`). Los frenos (a), (b) y (c) de arriba:
 * (a) y (c) salen de que sólo se mira a quien la llave nombra hoy en AHORA o en la que SIGUE; (b) es la clave `…:voz`.
 */
export function aLlamar(L, t, idx, hecho, ahora) {
  const out = [];
  if (!L || !t) return out;
  for (const [tipo, bat] of [['ahora', t.ahora], ['sigue', t.sigue]]) {
    if (!bat) continue;
    const quienes = new Set();
    for (const lado of bat.lados) {
      for (const m of String(lado).split(/\s*[,+&]\s*/)) {
        const did = (idx || {})[claveTurno(m)];
        if (did) quienes.add(String(did));
      }
    }
    for (const did of quienes) {
      const base = 'turno:' + L.id + ':' + claveTurno(bat.r) + ':' + bat.i + ':' + did;
      if (hecho(base + ':voz') != null) continue;
      if (tipo === 'sigue') {
        if (hecho(base + ':sigue') == null) out.push({ did, tipo, bat, base, clave: base + ':sigue', n: 1 });
        continue;
      }
      let n = 0, ult = 0;
      for (let k = 1; k <= TOQUES; k++) {
        const h = hecho(base + ':ahora:' + k);
        if (h == null) break;
        n = k; ult = h;
      }
      if (n >= TOQUES || (n && ahora - ult < ENTRE_TOQUES)) continue;
      out.push({ did, tipo, bat, base, clave: base + ':ahora:' + (n + 1), n: n + 1 });
    }
  }
  return out;
}

// ── el bot en vivo, en el chat de cada servidor ────────────────────────
// 🎤 Dlx, 04/10/2026: *«quién ganará, datos extras… para que se enganche la gente»*, prendido por servidor; y el 05/10,
// a «¿en qué canal escribe?»: *«2. A»* (el chat general). Habla en CUATRO MOMENTOS de cada llave —cuando sale, al
// cerrar cada ronda (un solo mensaje que se va editando), la final y el campeón— y cuando algo cambia, edita.
// 🛑 LOS FRENOS, los de la propuesta que aprobó: nunca menciona a nadie (`allowed_mentions` vacío); como mucho UN
// mensaje nuevo cada 10 minutos por servidor; sólo donde el admin eligió el canal con `/settings` —o Dlx lo prendió
// desde el Dashboard—, y si lo apagan, para en el momento. Y lo que quedó atrás no se dice tarde: si ya hay final, la
// ronda que no llegó a salir se saltea; y de una llave quieta hace más de media hora no se dice nada nuevo.
export const CHAT_ENTRE = 10 * MIN;
export const CHAT_FRESCA = 30 * MIN;
// 🔊 CUÁNTO HABLA (05/10/2026, Dlx: «quisiera que sea por cada llave o que haya un nivel de intensidad de que el bot
// hable por cada evento en vivo»). Lo elige el admin con /settings (`vivo_nivel` en `cfg:<guild>`) y Dlx desde el
// Dashboard (`en_vivo_nivel`, que gana). Sin elegir, «normal»: lo de siempre. En «cada batalla» dice quién pasó en cada
// una apenas la llave lo muestra —si se juntan varias, en el mismo mensaje— y el freno baja a uno cada 2 minutos: sigue
// sin mencionar a nadie, y lo que cambia se dice en un mensaje NUEVO solo si pasaron esos 2 minutos.
// ⚙️ LO QUE UN SERVIDOR PUEDE AJUSTAR (`cfg:<guild>` en KV): lo escribe `/settings` en el Worker y, desde el 19/10/2026,
// el panel del socio en la página (`socioAjustes()` del objeto): el mismo lugar, así lo último que se toque en cualquiera
// de los dos es lo que vale. ⚠️ EL DEFAULT ES «PRENDIDO Y SIN RESTRICCIONES», y eso es una decisión: un servidor que nunca
// abrió `/settings` tiene que comportarse como antes de que `/settings` existiera (ver el comentario en worker.js)
// `aviso_evento`: dónde va el aviso de cada evento, elegido por el dueño desde su panel (19/10/2026): '' donde habla el
// bot en vivo, 'chat' en su chat general siempre, 'no' apagado. Lo del Dashboard para ese servidor gana (`canalesChat()`)
export const CFG_BASE = { nick: true, canales: [], avisos: '', vivo: '', vivo_nivel: 'normal', ascenso: '', aviso_evento: '' };

export const NIVELES_CHAT = {
  poco: ['Lo justo', 'Cuando arranca y el campeón'],
  normal: ['Normal', 'El arranque, quién pasa cada ronda, la final y el campeón'],
  todo: ['Cada batalla', 'Además, quién gana cada batalla apenas se sabe'],
  // 🔥🎲 Dlx, 07/10/2026: «un nuevo nivel de intensidad mayor, que hayan 5 o 7»: los dos de arriba hablan también de la
  // batalla que VIENE (`batallaChat()`), con su título, un «¿sabías que…?» y, en el último, las apuestas
  // ⚠️ La descripción va en el menú de /settings, y Discord rechaza el menú entero con más de 100 letras
  datos: ['Con datos', 'Además, el cruce que viene con su título (EL CLÁSICO…), un «¿sabías que…?» y los anotados'],
  full: ['A full', 'Todo eso y apuestas con Puntos de Tienda, con botones en el mismo mensaje'],
};
/** ¿Este nivel habla batalla por batalla? «Cada batalla» y los dos de arriba. */
export const porBatalla = (n) => n === 'todo' || n === 'datos' || n === 'full';
export const CHAT_ENTRE_TODO = 2 * MIN;
//: 🖼️ el vs: la tarea se prende como mucho una vez cada tanto por servidor (se lleva todos los que esperan), y lo que
//: no se dibujó en `VS_VENCE` ya no va: esa batalla ya se jugó
export const VS_ENTRE = 75 * 1000;
export const VS_VENCE = 8 * MIN;
//: en «cada batalla», lo que se juntó sin decir se dice hasta este tanto; lo de antes ya es viejo
export const CHAT_JUNTAS = 8;
/** El nivel que vale: el de Dlx, si eligió; si no, el del admin; si no, «normal». */
export const nivelChat = (dash, admin) => (NIVELES_CHAT[dash] ? dash : NIVELES_CHAT[admin] ? admin : 'normal');
//: pedidos a Discord por minuto para esto: comparte los 50 subpedidos del vigía
export const CHAT_TOPE = 2;
const WEB_EVENTOS = 'https://underlegends.pages.dev/freestyle-rap/eventos';
/** Un nombre tal cual, sin que Discord lo lea como formato (`__X__`, `*`, `~`). */
export const escMd = (s) => String(s || '').replace(/([\\*_~|`>])/g, '\\$1');
const batallasDe = (R) => ((R && R.b) || []).filter((b) => (b[0] || []).filter(Boolean).length >= 2);
const jugadaChat = (b) => !!b[1] || /^pasan \d/.test(String(b[2] || ''));

/** Quién pasó en la batalla `b` de la ronda `k`: el ganador, o los del grupo que aparecen en la ronda siguiente. */
function pasaronChat(rondas, k, b) {
  if (b[1]) return [b[1]];
  const sig = new Set();
  for (const x of batallasDe(rondas[k + 1])) for (const lado of x[0] || []) sig.add(claveTurno(lado));
  return (b[0] || []).filter((lado) => lado && sig.has(claveTurno(lado)));
}

const BANDERAS_RE = /[\u{1F1E6}-\u{1F1FF}]{2}/gu;
// los adornos que no son letras: 🏳️‍⚧️, los tonos de piel, el selector de variante y las etiquetas de las banderas
const EMOJIS_RE = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}]/gu;
/** El emoji de la bandera de un país (`ar` → 🇦🇷); `''` si no es un código. */
export const banderaDe = (cc) => (/^[a-z]{2}$/i.test(String(cc || ''))
  ? String.fromCodePoint(...[...String(cc).toUpperCase()].map((c) => 0x1F1E6 + c.charCodeAt(0) - 65)) : '');

/**
 * 🧑‍🤝‍🧑 LA GENTE DE UN LADO DE LA LLAVE, PARA EL CHAT: `[{n, fl, k}]`, cada uno una vez y con UNA bandera (Dlx,
 * 12/10/2026: «arreglá los 5 errores»). El organizador de FFA escribe «🇦🇷 RODRILP 🇦🇷 + 🇨🇱 VELATZ 🇨🇱» y el lector
 * corre la primera bandera al final del lado, así que el chat decía «🇵🇦 ERIAN 🇵🇦 🇷🇪»: la de Betelgeuse, pegada a
 * Erian. Cada uno se queda con la bandera que más se repite en SU pedazo; y si la Liga lo conoce (`buscar`, la tabla),
 * con su nombre y su país de la Liga, no con las mayúsculas de la llave.
 */
export function genteChat(lado, buscar, tabla, ids, enSv) {
  const out = [];
  for (const seg of String(lado || '').split(/\s*[,+&]\s*/)) {
    const fls = seg.match(BANDERAS_RE) || [];
    const cuenta = new Map();
    for (const f of fls) cuenta.set(f, (cuenta.get(f) || 0) + 1);
    let fl = '';
    for (const f of fls) if (!fl || cuenta.get(f) > cuenta.get(fl)) fl = f;
    const rev = /\(\s*r\s*\)/i.test(seg);
    let n = seg.replace(BANDERAS_RE, ' ').replace(EMOJIS_RE, ' ').replace(/\(\s*r\s*\)/gi, ' ').replace(/\s+/g, ' ').trim();
    if (!n) continue;
    const k = buscar ? buscar(n) || '' : '';
    const f = k && tabla ? tabla[k] : null;
    // 🔔 su cuenta, si la Liga la conoce (`turnos:nombres`, el índice de «te toca»): por cómo lo escribe la llave o por
    // su nombre de la Liga
    let id = ids ? String(ids[claveTurno(n)] || (f && f.n ? ids[claveTurno(f.n)] : '') || '') : '';
    // 🙈 SÓLO A QUIEN ESTÁ EN ESE SERVIDOR (19/10/2026, Dlx con una captura de FFA: «¿por qué dice unknown user?»). La
    // mención de alguien que no está en el servidor del chat Discord la dibuja «@unknown-user»: con `enSv` (sus servidores,
    // de `persona`) se escribe su nombre en vez de mencionarlo. Sin saber quién es (`k`), tampoco se menciona
    if (id && enSv && !enSv(k)) id = '';
    if (f && f.n) {
      n = sinBandera(f.n);
      fl = banderaDe(f.cc) || fl;
    }
    out.push({ n: n + (rev ? ' (R)' : ''), fl, k, id: /^\d{5,25}$/.test(id) ? id : '' });
  }
  return out;
}
/** «A, B y C». */
const conY = (xs) => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1]);
/**
 * 🔔 Un nombre para el chat: la MENCIÓN de su cuenta si la conocemos (Dlx, 12/10/2026: «no menciona a la gente»), y si
 * no, su nombre. ⚠️ La mención no suena: todos los mensajes van con `allowed_mentions` vacío, así que se ve y se toca
 * (abre su perfil de Discord) sin notificar a nadie. El freno de «nunca molestar» sigue en pie.
 */
export const nombreChat = (y) => (y.id ? '<@' + y.id + '>' : escMd(y.n));
/** Los nombres de `genteChat()`, cada uno con su bandera: «RodriLP 🇦🇷, Velatz 🇨🇱 y Snow 🇨🇴». */
export const nombresChat = (gs) => conY(gs.map((y) => nombreChat(y) + (y.fl ? ' ' + y.fl : '')));
//: el batacazo del cierre: tantos puntos de OVR de diferencia, o más
export const BATACAZO = 10;
//: la racha del cierre: tantos duelos ganados seguidos, o más
export const RACHA_CHAT = 5;

/**
 * 🏆 EL CIERRE (Dlx, 12/10/2026: «B y C juntos», «un solo mensaje»): el campeón con su noche —cuántas ganó y a quién
 * le ganó la final—, su tarjeta (la imagen va en el mensaje) y lo mejor de la noche: el batacazo (el de menos OVR que le
 * ganó al de más) y la racha de duelos más larga. ⚠️ La racha suma lo de esta noche a la de antes SÓLO si los perfiles
 * son de antes de la llave (`perfT`): si el ciclo ya cargó el evento, la noche estaría contada dos veces, y se calla.
 */
function cierreChat(L, rondas, fb, tit, opc, gente, rival) {
  const quien = (y) => y.k || claveTurno(y.n);
  const camp = gente(fb[1]);
  const lider = camp[0] ? quien(camp[0]) : '';
  const varios = camp.length > 1;
  let ganadas = 0;
  rondas.forEach((R, k) => batallasDe(R).forEach((b) => {
    if (lider && pasaronChat(rondas, k, b).some((g) => gente(g).some((y) => quien(y) === lider))) ganadas++;
  }));
  const otros = (fb[0] || []).filter((x) => x && x !== fb[1]).map(rival);
  const lineas = ['🏆 **' + nombresChat(camp) + '** ' + (varios ? 'son los campeones' : 'es el campeón') + ' de **' + tit + '**'];
  if (ganadas) {
    lineas.push((varios ? 'Ganaron ' : 'Ganó ') + ganadas + (ganadas === 1 ? ' batalla' : ' batallas')
      // «a el equipo de…» es «al equipo de…»
      + (otros.length ? ' y en la final le ' + (varios ? 'ganaron' : 'ganó') + ' ' + ('a ' + conY(otros)).replace(/^a el /, 'al ') : '') + '.');
  }
  const tabla = opc.tabla || {};
  const ovr = (y) => (y && y.k && tabla[y.k] && tabla[y.k].ovr) || 0;
  const conRacha = !!(opc.perf && opc.perfT && L && L.pub && opc.perfT < L.pub);
  const racha = new Map();
  let bat = null;
  rondas.forEach((R) => batallasDe(R).forEach((b) => {
    const lados = (b[0] || []).filter(Boolean);
    if (lados.length !== 2 || !b[1]) return;
    const [ga, gb] = lados.map(gente);
    if (ga.length !== 1 || gb.length !== 1) return;
    const gano = b[1] === lados[0] ? ga[0] : b[1] === lados[1] ? gb[0] : null;
    if (!gano) return;
    const perdio = gano === ga[0] ? gb[0] : ga[0];
    const d = ovr(perdio) - ovr(gano);
    if (ovr(gano) && ovr(perdio) && d >= BATACAZO && (!bat || d > bat.d)) bat = { d, g: gano, p: perdio, r: R.r };
    if (!conRacha) return;
    for (const y of [gano, perdio]) {
      if (y.k && !racha.has(y.k)) {
        const p = opc.perf[y.k];
        racha.set(y.k, [y, (p && Array.isArray(p.rd) && Number(p.rd[0])) || 0]);
      }
    }
    if (gano.k) racha.get(gano.k)[1]++;
    if (perdio.k) racha.get(perdio.k)[1] = 0;
  }));
  const mejor = [];
  if (bat) {
    mejor.push('💥 El batacazo: **' + nombresChat([bat.g]) + '** (OVR ' + ovr(bat.g) + ') le ganó a **' + nombresChat([bat.p])
      + '** (OVR ' + ovr(bat.p) + ') en ' + bat.r + '.');
  }
  const top = [...racha.values()].sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= RACHA_CHAT) mejor.push('🔥 La racha: **' + nombresChat([top[0]]) + '** lleva ' + top[1] + ' duelos ganados seguidos.');
  if (mejor.length) lineas.push('', '✨ **Lo mejor de la noche**', ...mejor);
  const img = !varios && camp[0] && camp[0].k && opc.cartaDe ? opc.cartaDe(camp[0].k) : '';
  return Object.assign({ m: 'campeon', texto: lineas.join('\n') }, img ? { img } : {});
}

/**
 * Lo que el bot diría HOY de la llave `L` (`LlaveVivo.aLlave()`), en orden: `[{m, texto}]`, con `m` = llave, rondas,
 * final, campeon o —en «cada batalla»— `b:<ronda>:<quiénes>`, una por batalla jugada (con `cab`, el título para cuando
 * van juntas). `nombre` es el del evento, `fav` los favoritos, `[[nombre, ovr], …]` ya ordenados, y `nivel` uno de
 * `NIVELES_CHAT`. `opc` = `{buscar, tabla, perf, perfT, cartaDe}` (`datosCruce()`): con eso cada uno sale con su nombre de
 * la Liga y el cierre trae lo mejor de la noche y la tarjeta del campeón; sin eso, como lo escribe la llave.
 */
export function momentosChat(L, nombre, fav, nivel = 'normal', opc = {}) {
  const out = [];
  const rondas = (L && L.rondas) || [];
  if (!rondas.some((R) => batallasDe(R).length)) return out;
  const gente = (lado) => genteChat(lado, opc.buscar, opc.tabla, opc.ids, opc.enSv);
  // un rival: su nombre, o «el equipo de …» si son varios
  const rival = (lado) => { const gs = gente(lado); return (gs.length > 1 ? 'el equipo de ' : '') + nombresChat(gs); };
  const tit = escMd(String(nombre || (L && L.nombre) || 'el evento').replace(/^[\s_*~]+|[\s_*~]+$/g, ''));
  const n = (L && L.participantes) || 0;
  out.push({ m: 'llave', texto: '🎤 Arrancó **' + tit + '**' + (n ? ' · ' + n + ' en la llave' : '')
    + ((fav || []).length ? ' · los favoritos: ' + fav.slice(0, 3).map(([q, o]) => escMd(q) + ' (OVR ' + o + ')').join(', ') : '')
    + '\nSeguila en vivo: <' + WEB_EVENTOS + '>' });
  const F = rondas.find((R) => /^final$/i.test(String(R.r || '')));
  const fb = F ? batallasDe(F)[0] : null;
  if (porBatalla(nivel)) {
    // 🔑 UN MOMENTO POR CADA UNO QUE PASA, no por batalla (revisión del 05/10/2026): en un grupo donde pasan dos, el
    // organizador escribe a uno en la ronda siguiente y al rato al otro. Con un momento por batalla salía «A pasa ·
    // contra B y C» y, cuando aparecía B, ya estaba dicho. Así sale «A pasa» y después «B pasa», y ninguno miente.
    // Menos la final: la cuenta el campeón
    // 🧩 Y UN EQUIPO QUE CRECE NO ES OTRA BATALLA (12/10/2026, la COMPE POR 1.5 DÓLARES de FFA): el ganador del grupo
    // suma gente después, y como la clave llevaba los nombres, cada uno que se sumaba volvía a decir «RODRILP, VELATZ
    // pasa · de un grupo con…». Ahora la clave es la batalla (su lugar en la ronda) y el primero del equipo; quien estaba
    // cuando se dijo «pasa» va en esa línea, y quien llega después sale como «suma a» (`de`: ver `planChatTodo()`)
    rondas.forEach((R, k) => {
      if (R === F) return;
      // ⚠️ `i` es su lugar en la ronda tal cual (`R.b`), el mismo que usa el cruce (`v:` en `chatVivo()`): así el
      // resultado sabe a qué mensaje de cruce agregarse
      (R.b || []).forEach((b, i) => {
        const lados = (b[0] || []).filter(Boolean);
        if (lados.length < 2 || !jugadaChat(b)) return;
        for (const g of pasaronChat(rondas, k, b)) {
          const gs = gente(g);
          if (!gs.length) continue;
          const base = 'b:' + R.r + ':' + i + ':' + (gs[0].k || claveTurno(gs[0].n));
          const otros = lados.filter((x) => x !== g).map(rival);
          // un mano a mano dice contra quién; un grupo, con quiénes (de ahí puede pasar más de uno)
          const resto = !otros.length ? '' : lados.length === 2 ? ' · contra ' + otros[0] : ' · de un grupo con ' + conY(otros);
          const cab = '⚔️ **' + tit + '**';
          out.push({ m: base, cab, bi: R.r + ':' + i, texto: '✅ **' + nombresChat(gs) + '** ' + (gs.length > 1 ? 'pasan' : 'pasa') + ' · ' + R.r + resto,
            // lo que se le agrega al mensaje del cruce cuando ya salió: los nombres ya están arriba, alcanza con quién
            res: '✅ ' + (gs.length > 1 ? 'Pasan' : 'Pasa') + ' **' + nombresChat(gs) + '**' });
          for (const y of gs.slice(1)) {
            out.push({ m: 'u:' + R.r + ':' + i + ':' + (y.k || claveTurno(y.n)), de: base, cab,
              texto: '🧩 **' + nombreChat(gs[0]) + '** suma a **' + nombresChat([y]) + '** a su equipo' });
          }
        }
      });
    });
  } else if (nivel !== 'poco') {
    // ⚠️ quién pasó, con los grupos de «pasan N» también: su `b[1]` está vacío y la ronda salía «pasaron » sin nadie
    // (las octavas de a tres de FFA, revisión del 05/10/2026). Es `pasaronChat()`, la misma de «cada batalla»
    const cerradas = rondas.filter((R) => !/^final$|tercer/i.test(String(R.r || '')) && batallasDe(R).length
      && batallasDe(R).every(jugadaChat));
    if (cerradas.length) {
      // un equipo va entre paréntesis: «pasaron (RodriLP, Velatz y Snow), Guty»
      const uno = (g) => { const gs = gente(g); return gs.length > 1 ? '(' + nombresChat(gs) + ')' : nombresChat(gs); };
      out.push({ m: 'rondas', texto: '⏱️ **' + tit + '**\n' + cerradas.map((R) => '**' + R.r + '**: pasaron '
        + batallasDe(R).flatMap((b) => pasaronChat(rondas, rondas.indexOf(R), b)).map(uno).join(', ')).join('\n') });
    }
  }
  if (fb && !fb[1] && nivel !== 'poco') {
    out.push({ m: 'final', texto: '🔥 La final de **' + tit + '**: ' + fb[0].filter(Boolean).map(rival).join(' contra ') });
  }
  if (fb && fb[1]) out.push(cierreChat(L, rondas, fb, tit, opc, gente, rival));
  return out;
}

/**
 * «Cada batalla»: TODO lo que no salió va junto en un mensaje nuevo —el arranque, las batallas, la final, el campeón—,
 * si la llave se movió hace poco y pasaron `CHAT_ENTRE_TODO` del último. Lo que se juntó de más (`CHAT_JUNTAS`) ya es
 * viejo y se saltea, salvo el campeón y la final, que van siempre. `m` del mandar es la lista de momentos que lleva.
 */
/**
 * 🏆 UN SOLO MENSAJE POR CAMPEÓN (Dlx, 13/10/2026, con los dos del campeón uno abajo del otro en el chat de FFA: «we have
 * to avoid making duplications of the same thing… combine these two into one»). Casi siempre el cierre sale primero y
 * el ciclo le agrega su embed editándolo (`avisar.evento()`); si el ciclo llegó antes, su mensaje queda anotado como el
 * «campeon» de la llave SIN texto (`cierreVivo()`), y el cierre se le agrega a ESE mensaje en vez de salir aparte. Una
 * edición del bot en vivo sólo cambia el texto: el embed del ciclo, con los puntos y la tarjeta, se queda.
 */
export function cierreDelCiclo(x, h) {
  return !!(x && x.m === 'campeon' && h && h.msg && !h.texto);
}

/** hasta cuánto pueden distar el mensaje con el que el bot en vivo anota una llave y el que anota el ciclo */
export const CIERRE_CERCA_MS = 60 * 60000;

/**
 * 🏆 EL «CAMPEON» DE LA LLAVE, AUNQUE CADA LADO LA ANOTE CON OTRO MENSAJE (14/10/2026, Dlx, con el campeón dos veces en el
 * chat de Urban: «arreglá esto»). Urban escribe la llave de a una batalla por mensaje, con un título suelto arriba
 * («=== FF Freestyle Clasico VOL. 1 ==="): el bot en vivo la anota con ESE mensaje (`L.id`, el primero de la tanda) y
 * el ciclo con el de la primera batalla (`datos/llaves_links.json`). Eran dos números y el cruce por igualdad no los
 * juntó nunca: el aviso salió aparte 23 minutos después del cierre. De `filas` (`{llave, msg, texto}` del canal), la del
 * mismo mensaje, y si no hay, la más cercana en el tiempo (el ID de Discord lo dice) a menos de `CIERRE_CERCA_MS`.
 * ⚠️ Una sola hora de margen: dos eventos del mismo servidor que ARRANCAN con menos de una hora de diferencia y terminan
 * los dos son raros, y aun así gana el más cercano.
 */
export function campeonCerca(filas, ids, ventana = CIERRE_CERCA_MS) {
  const ts = [].concat(ids || []).map(String).filter(Boolean);
  const fs = (filas || []).filter((f) => f && f.llave);
  const exacto = fs.find((f) => ts.includes(String(f.llave)));
  if (exacto) return exacto;
  // por cercanía, sólo entre IDs de Discord de verdad
  const snow = (x) => /^\d{15,25}$/.test(String(x));
  const tl = ts.filter(snow).map(creadaEn);
  let mejor = null, dmin = Infinity;
  for (const f of fs.filter((x) => snow(x.llave))) {
    const t = creadaEn(f.llave);
    const d = tl.length ? Math.min(...tl.map((x) => Math.abs(x - t))) : Infinity;
    if (d <= ventana && d < dmin) { mejor = f; dmin = d; }
  }
  return mejor;
}

function planChatTodo(ms, hechos, ultimo, ahora, fresca, entre = CHAT_ENTRE_TODO) {
  const h = hechos || {};
  // 🏆 el cierre, en el mensaje que ya mandó el ciclo (ver `cierreDelCiclo()`)
  const ed = ms.filter((x) => cierreDelCiclo(x, h[x.m])).map((x) => ({ tipo: 'editar', m: x.m, texto: x.texto, msg: h[x.m].msg }));
  const pend = ms.filter((x) => !h[x.m]);
  if (!pend.length || !fresca || ahora - (ultimo || 0) < entre) return ed;
  // 🧩 quien ya estaba en el equipo cuando se dice su «pasa» va en esa línea: no tiene una propia
  const conLider = pend.filter((x) => x.de && !h[x.de]);
  const propias = pend.filter((x) => !conLider.includes(x));
  const bats = propias.filter((x) => x.cab);
  const viejas = new Set(bats.slice(0, Math.max(0, bats.length - CHAT_JUNTAS)));
  const plan = [...viejas].map((x) => ({ tipo: 'saltar', m: x.m }));
  const viejasM = new Set([...viejas].map((x) => x.m));
  for (const x of conLider) if (viejasM.has(x.de)) plan.push({ tipo: 'saltar', m: x.m });
  const van = propias.filter((x) => !viejas.has(x));
  if (!van.length) return plan;
  const junto = conLider.filter((x) => !viejasM.has(x.de)).map((x) => x.m);
  const cab = !van.some((x) => x.m === 'llave') && van.find((x) => x.cab);
  const img = (van.find((x) => x.img) || {}).img;
  const vs = (van.find((x) => x.vs) || {}).vs;
  plan.push(Object.assign({ tipo: 'mandar', m: van.map((x) => x.m).concat(junto),
    texto: (cab ? [cab.cab] : []).concat(van.map((x) => x.texto)).join('\n') }, img ? { img } : {}, vs ? { vs } : {}));
  return ed.concat(plan);
}

/**
 * Qué hacer con los momentos `ms` de una llave en un canal: `[{tipo, m, texto, msg}]`, con `tipo` = mandar, editar o
 * saltar. `hechos` es `{m: {msg, texto}}` (lo ya mandado; `msg` vacío = salteado), `ultimo` el último mensaje NUEVO del
 * bot en ese canal y `fresca` si la llave se movió hace poco. Sólo se manda el ÚLTIMO momento: los anteriores que no
 * salieron se saltean. En «cada batalla» (`nivel` = todo), ver `planChatTodo()`.
 */
export function planChat(ms, hechos, ultimo, ahora, fresca, nivel = 'normal', entre = 0) {
  if (porBatalla(nivel)) return planChatTodo(ms, hechos, ultimo, ahora, fresca, entre || CHAT_ENTRE_TODO);
  const plan = [];
  const meta = ms[ms.length - 1];
  for (const x of ms) {
    const h = (hechos || {})[x.m];
    if (h) {
      // ⚠️ SÓLO SE EDITA EL DE LAS RONDAS, que es el que crece. «Arrancó» lleva los favoritos, que se leen una vez al
      // mandarlo (el lobby pesa): recalcularlo sin ellos los borraba al minuto siguiente (lo encontró la prueba)
      if (x.m === 'rondas' && h.msg && h.texto !== x.texto) plan.push({ tipo: 'editar', m: x.m, texto: x.texto, msg: h.msg });
      else if (cierreDelCiclo(x, h)) plan.push({ tipo: 'editar', m: x.m, texto: x.texto, msg: h.msg });
      continue;
    }
    if (x !== meta) plan.push({ tipo: 'saltar', m: x.m });
    else if (fresca && ahora - (ultimo || 0) >= (entre || CHAT_ENTRE)) {
      plan.push(Object.assign({ tipo: 'mandar', m: x.m, texto: x.texto }, x.img ? { img: x.img } : {}));
    }
  }
  return plan;
}

/**
 * 🛑 CUÁNTO ESPERA UN CANAL DESPUÉS DE UN MENSAJE QUE NO SALIÓ, en ms (revisión del 05/10/2026). Antes cualquier falla
 * lo frenaba media hora: un 500 suelto justo en «🏆 Campeón» y, para cuando volvía, la llave ya no estaba fresca y el
 * campeón no se decía nunca. Media hora sólo si no se arregla solo —sin permiso (403) o el canal no existe (404)—; un
 * 429 espera lo que Discord pide (`retry_after`, en segundos); un 5xx o la red se reintentan al minuto siguiente.
 */
/**
 * 🔁 LAS CLAVES DE ANTES DEL 12/10/2026 llevaban los nombres de la batalla (`b:Octavos:ana|bea:ana`, `v:Cuartos:a|b`);
 * las de ahora, su lugar en la ronda (`b:Octavos:0:ana`, `v:Cuartos:3`). Una llave que ya venía hablando cuando se
 * desplegó el cambio vería todo lo dicho como nuevo y lo repetiría: si en `hechos` hay alguna de las de antes, lo de
 * las batallas que hoy no está en `hechos` se da por dicho —y la batalla que viene (`bat`), por anunciada—. ⚠️ UNA SOLA
 * VEZ por llave (`migrado`): si no, cada minuto daba por dicho lo nuevo y el bot se callaba hasta el final. Devuelve las
 * claves a anotar como salteadas.
 */
export function migrarHechos(hechos, ms, bat) {
  const h = hechos || {};
  if (h.migrado || !Object.keys(h).some((m) => /^[bv]:[^:]*:(?!\d+(?::|$))/.test(m))) return [];
  const out = (ms || []).filter((x) => /^[buv]:/.test(x.m) && !h[x.m]).map((x) => x.m);
  if (bat && !h['v:' + bat.r + ':' + bat.i]) out.push('v:' + bat.r + ':' + bat.i);
  return out.concat('migrado');
}

export function pausaChat(estado, retryAfter) {
  if (estado === 403 || estado === 404) return 30 * MIN;
  if (estado === 429) return Math.min(10 * MIN, Math.max(5000, Math.round((Number(retryAfter) || 0) * 1000)));
  return 0;
}

/** Los favoritos de una llave: los tres de más OVR entre los que juegan (`tabla` es la del lobby), con el nombre como
 *  lo escribe la llave. Un nombre que en la tabla es de dos personas no cuenta: no se adivina quién es. */
export function favoritosDe(L, tabla) {
  const ovr = new Map();
  const dobles = new Set();
  for (const f of tabla || []) {
    const k = f && f.n ? claveTurno(f.n) : '';
    if (!k) continue;
    if (ovr.has(k)) dobles.add(k);
    if (f.ovr) ovr.set(k, f.ovr);
  }
  const vistos = new Map();
  for (const R of (L && L.rondas) || []) {
    for (const b of R.b || []) {
      for (const lado of b[0] || []) {
        for (const q of String(lado || '').split(/\s*[,+&]\s*/)) {
          const k = claveTurno(q);
          if (k && ovr.has(k) && !dobles.has(k) && !vistos.has(k)) {
            vistos.set(k, [q.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').trim(), ovr.get(k)]);
          }
        }
      }
    }
  }
  return [...vistos.values()].sort((a, b) => b[1] - a[1]).slice(0, 3);
}

// ═════════════════════════════════════════════════════════════════════
// 🔥🎲 «CON DATOS» Y «A FULL» (Dlx, 07/10/2026: «podrías hacer apuestas, con puntos de la tienda en vivo… en chat
// general… podrías decir cosas aleatorias… EL CLÁSICO, etc… datos interesantes como… sabías que tal usuario X…»).
// Las apuestas, como las decidió: «Botones en el chat», «Pozo compartido», «Hasta 500, cierra a los 3 min»
// ═════════════════════════════════════════════════════════════════════
export const AP_MONTOS = [50, 100, 250, 500];
export const AP_TOPE = 500;
export const AP_CIERRA = 3 * MIN;

// 🎛️ MÁS AJUSTES DEL DASHBOARD (Dlx, 07/10/2026: «dame más configuraciones», y a la lista: «Apuestas», «Aviso de cada
// evento», «Horario de silencio»). Sin ajuste vale lo de siempre: los de arriba, `CHAT_ENTRE` y `CHAT_ENTRE_TODO`

/** Las apuestas como las dejó Dlx: `{montos, cierra (ms), tope, apagadas: {SV: true}, prendidas: {SV: true}}` */
export function apuestasCfg(aj) {
  const a = (aj && aj.apuestas) || {};
  return {
    montos: Array.isArray(a.montos) && a.montos.length ? a.montos : AP_MONTOS,
    cierra: (Number(a.minutos) || AP_CIERRA / MIN) * MIN,
    tope: Number(a.tope) || AP_TOPE,
    apagadas: (a.apagadas && typeof a.apagadas === 'object') ? a.apagadas : {},
    prendidas: (a.prendidas && typeof a.prendidas === 'object') ? a.prendidas : {},
  };
}

/**
 * 🎲 ¿HAY APUESTAS EN ESE SERVIDOR? Dlx, 13/10/2026: «que se pueda apostar sin la necesidad de que el bot esté en full o
 * con datos, pero que se requiera manualmente encenderlo desde el dashboard o desde settings». En orden: «No hay
 * apuestas en» del Dashboard gana siempre; después, PRENDIDAS A MANO —Dlx en el Dashboard (`prendidas`) o el admin del
 * servidor con /settings (`apuestas` en `cfg:<guild>`)—, en cualquier nivel; y si no, como hasta hoy: sólo «A full».
 * Con el bot en vivo apagado en ese servidor no hay chat donde ponerlas, así que tampoco hay apuestas.
 */
export function hayApuestas(sv, nivel, apc, cfg) {
  if (apc.apagadas[sv]) return false;
  if (apc.prendidas[sv] || (cfg && cfg.apuestas === true)) return true;
  return nivel === 'full';
}

/** Cada cuánto puede hablar el bot en vivo en un canal, en ms: `normal` (y lo justo) y `batalla` (cada batalla y más) */
export function ritmoCfg(aj) {
  const r = (aj && aj.ritmo) || {};
  return { normal: (Number(r.normal) || CHAT_ENTRE / MIN) * MIN, batalla: (Number(r.batalla) || CHAT_ENTRE_TODO / MIN) * MIN };
}

/** 🌙 El horario de silencio: de `desde` a `hasta` (hora del este, «HH:MM») el bot en vivo no habla en los chats. Puede
 *  cruzar la medianoche (23:00 a 08:00). Lo que pasó mientras tanto no se cuenta tarde: al terminar, sigue desde ahí */
export function enSilencio(aj, ahora = Date.now()) {
  const s = aj && aj.silencio;
  if (!s || !s.desde || !s.hasta || s.desde === s.hasta) return false;
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit',
    hourCycle: 'h23' }).format(new Date(ahora));
  return s.desde < s.hasta ? (p >= s.desde && p < s.hasta) : (p >= s.desde || p < s.hasta);
}
const milesAp = (v) => String(Math.round(v || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const sinBandera = (n) => String(n || '').replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').replace(/\s+/g, ' ').trim();

/**
 * 🪪 Los mensajes que mencionan a los de las crews que no están verificados (19/10/2026, `crewVerificar()` de
 * bot/crews.js): por crew, con la mención a quien tiene cuenta y el nombre a quien no —sin ID no se puede mencionar—,
 * partidos si no entran en un mensaje. `personas`: `[{k, id, n, crew, hasta}]`. Devuelve `[{texto, ids, ks}]`.
 */
export function textosSinVerificar(personas, url) {
  const ps = (personas || []).filter((p) => p && p.k);
  if (!ps.length) return [];
  const hasta = Math.min(...ps.map((p) => Number(p.hasta) || Infinity));
  const d = diaET(Number.isFinite(hasta) ? hasta : Date.now());
  const fecha = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][new Date(d + 'T12:00:00Z').getUTCDay()] + ' ' + d.slice(8, 10) + '/' + d.slice(5, 7);
  const uno = ps.length === 1;
  const cab = '🪪 **Crews: falta verificarse**';
  const pie = (uno ? 'Está en una crew de la Liga y todavía no se verificó' : 'Están en una crew de la Liga y todavía no se verificaron')
    + ' en Discord Rap Español. ' + (uno ? 'Tiene' : 'Tienen') + ' hasta el **' + fecha + '**: si no, ' + (uno ? 'sale' : 'salen')
    + ' de la crew, y mientras tanto no ' + (uno ? 'suma' : 'suman') + ' para el ranking ni el tier.\n👉 Cómo verificarse: <' + url + '>';
  const porCrew = new Map();
  for (const p of ps) {
    const c = String(p.crew || '');
    if (!porCrew.has(c)) porCrew.set(c, []);
    porCrew.get(c).push(p);
  }
  const out = [];
  let cur = null;
  for (const [c, gs] of porCrew) {
    const linea = ('**' + escMd(c) + ':** ' + gs.map((p) => (p.id ? '<@' + p.id + '>' : escMd(p.n || p.k))).join(', ')).slice(0, 1400);
    if (!cur || cab.length + pie.length + cur.lineas.join('\n').length + linea.length + 4 > 1900 || cur.ids.length + gs.length > 90) {
      cur = { lineas: [], ids: [], ks: [] };
      out.push(cur);
    }
    cur.lineas.push(linea);
    for (const p of gs) {
      cur.ks.push(p.k);
      if (p.id) cur.ids.push(p.id);
    }
  }
  return out.map((m) => ({ texto: cab + '\n' + m.lineas.join('\n') + '\n' + pie, ids: m.ids, ks: m.ks }));
}

/** La batalla de la que se habla: la de AHORA (`turnosDe()`) o, sin nada jugado todavía, la primera de la llave. */
export function batallaChat(L) {
  const t = turnosDe(L);
  if (t) return t.ahora;
  for (const R of (L && L.rondas) || []) {
    for (const [i, b] of (R.b || []).entries()) {
      const lados = (b[0] || []).filter(Boolean);
      if (lados.length < 2) continue;
      return b[1] || /^pasan \d/.test(String(b[2] || '')) ? null : { r: R.r, i, lados, hecha: false };
    }
  }
  return null;
}

/**
 * Lo que se sabe de un cruce de DOS lados, para su título y su dato: `{a, b, h2h}`. Cada lado es `{n, k, f, du, rd}` —el
 * nombre sin bandera, su clave, su fila de la tabla (`f`), sus duelos (`du`, `[n, rival, ganó]`) y su racha de duelos
 * (`rd`)—; `h2h` es `{ga, gb, ult}`: cuántas ganó cada uno entre ellos y quién ganó la última ('a', 'b' o ''). `buscar`
 * da la clave de un nombre de llave (o ''), `tabla` las filas por clave y `perf` los perfiles (`/api/perfiles`).
 */
/**
 * 🧾 Una persona para el vs de los otros formatos (2v2, 1v3, 8v1, todos contra todos): lo mismo que un lado del mano a
 * mano —el OVR, el Score, la letra, los últimos 5 duelos y la racha— (19/10/2026, Dlx: «más algo de info como los de
 * 1v1»). `dc` es lo de `datosCruce()`: la tabla, los perfiles y las cartas.
 */
export function personaVs(y, dc) {
  const f = (y.k && (dc.tabla || {})[y.k]) || {};
  const pf = (y.k && (dc.perf || {})[y.k]) || null;
  const forma = ((pf && pf.du) || []).slice().sort((p, q) => Number(p[0]) - Number(q[0])).slice(-5).map((d) => (d[2] ? 'G' : 'P')).join('');
  return { n: y.n, fl: y.fl, k: y.k, ovr: f.ovr || 0, sc: f.sc || 0, rg: f.rg || '', forma, racha: (pf && pf.rd && pf.rd[0]) || 0,
    carta: y.k && dc.cartaDe ? dc.cartaDe(y.k) : '' };
}

export function infoCruce(lados, buscar, tabla, perf) {
  const lado = (n) => {
    const k = buscar(n) || '';
    const p = (k && (perf || {})[k]) || null;
    return { n: sinBandera(n), k, f: (k && (tabla || {})[k]) || null, du: (p && p.du) || [], rd: (p && p.rd) || null, hay: !!p };
  };
  const a = lado(lados[0]);
  const b = lado(lados[1]);
  let ga = 0, gb = 0, ult = '', un = -1;
  for (const d of a.du) {
    if (!b.k || buscar(d[1]) !== b.k) continue;
    if (d[2]) ga++; else gb++;
    if (Number(d[0]) >= un) { un = Number(d[0]); ult = d[2] ? 'a' : 'b'; }
  }
  return { a, b, h2h: { ga, gb, ult } };
}

const GENTILICIO = { ar: 'ARGENTINO', cl: 'CHILENO', co: 'COLOMBIANO', mx: 'MEXICANO', pe: 'PERUANO', ve: 'VENEZOLANO',
  uy: 'URUGUAYO', ec: 'ECUATORIANO', es: 'ESPAÑOL', bo: 'BOLIVIANO', py: 'PARAGUAYO', cu: 'CUBANO', do: 'DOMINICANO',
  gt: 'GUATEMALTECO', hn: 'HONDUREÑO', cr: 'COSTARRICENSE', pa: 'PANAMEÑO', pr: 'BORICUA', sv: 'SALVADOREÑO', ni: 'NICA' };

/**
 * El título de un cruce, si se gana uno: `{t, sub}` o `null`. En orden: EL CLÁSICO (tres cruces o más), LA REVANCHA
 * (ya se cruzaron), DUELO DE CREWS (cada uno de una crew), FUEGO AMIGO (los dos de la misma), DUELO DE CAMPEONES (los
 * dos ganaron un evento), DUELO DE TITANES (los dos en el top 10), DAVID CONTRA GOLIAT (20 de OVR o más de diferencia),
 * RACHA EN JUEGO (uno viene de 5 duelos ganados o más), LA EXPERIENCIA CONTRA EL HAMBRE (15 eventos o más contra 2 o
 * menos), DEBUT (uno no jugó nada en la temporada), DUELO DE ÉLITE (los dos con letra S o más) y el duelo del mismo
 * país. ⚠️ DEBUT sólo con un nombre que la Liga reconoce (`hay`): uno que no se pudo identificar no es un debutante.
 * ⚠️ La crew (`crew: {n, tier}`) la pone quien llama, del objeto (19/10/2026, Dlx: «más cosas así… David vs Goliat
 * está bien pero más cosas»): sin ella, esos dos no salen
 */
export function tituloCruce(x) {
  const { a, b, h2h } = x;
  const fa = a.f || {}, fb = b.f || {};
  const tot = h2h.ga + h2h.gb;
  if (tot >= 3) {
    return { t: 'EL CLÁSICO', sub: 'se cruzaron ' + tot + ' veces: ' + (h2h.ga === h2h.gb ? 'van ' + h2h.ga + ' a ' + h2h.gb
      : (h2h.ga > h2h.gb ? a.n : b.n) + ' gana ' + Math.max(h2h.ga, h2h.gb) + ' a ' + Math.min(h2h.ga, h2h.gb)) };
  }
  if (tot >= 1 && h2h.ult) {
    const [g, p] = h2h.ult === 'a' ? [a, b] : [b, a];
    return { t: 'LA REVANCHA', sub: g.n + ' le ganó la última vez y ' + p.n + ' viene por la revancha' };
  }
  const cr = (y) => (y.crew ? y.crew.n + (y.crew.tier ? ' (' + y.crew.tier + ')' : '') : '');
  if (a.crew && b.crew && a.crew.n !== b.crew.n) return { t: 'DUELO DE CREWS', sub: cr(a) + ' contra ' + cr(b) };
  if (a.crew && b.crew && a.crew.n === b.crew.n) return { t: 'FUEGO AMIGO', sub: 'los dos son de ' + a.crew.n };
  if ((fa.oro || 0) >= 1 && (fb.oro || 0) >= 1) return { t: 'DUELO DE CAMPEONES', sub: 'los dos ya ganaron un evento esta temporada' };
  if (fa.pos && fb.pos && fa.pos <= 10 && fb.pos <= 10) {
    return { t: 'DUELO DE TITANES', sub: 'el #' + Math.min(fa.pos, fb.pos) + ' contra el #' + Math.max(fa.pos, fb.pos) + ' de la temporada' };
  }
  if (fa.ovr && fb.ovr && Math.abs(fa.ovr - fb.ovr) >= 20) {
    const [g, d] = fa.ovr > fb.ovr ? [a, b] : [b, a];
    return { t: 'DAVID CONTRA GOLIAT', sub: d.n + ' (OVR ' + d.f.ovr + ') contra ' + g.n + ' (OVR ' + g.f.ovr + ')' };
  }
  const rach = [a, b].filter((y) => y.rd && y.rd[0] >= 5).sort((p, q) => q.rd[0] - p.rd[0])[0];
  if (rach) return { t: 'RACHA EN JUEGO', sub: rach.n + ' viene de ganar ' + rach.rd[0] + ' duelos seguidos: ¿quién lo frena?' };
  if (fa.ev && fb.ev && Math.max(fa.ev, fb.ev) >= 15 && Math.min(fa.ev, fb.ev) <= 2) {
    const [v, n] = fa.ev > fb.ev ? [a, b] : [b, a];
    return { t: 'LA EXPERIENCIA CONTRA EL HAMBRE', sub: v.n + ' lleva ' + v.f.ev + ' eventos; ' + n.n + ', ' + n.f.ev };
  }
  const nuevo = [a, b].find((y) => y.k && !y.hay && !y.f);
  if (nuevo) return { t: 'DEBUT', sub: nuevo.n + ' juega su primer evento de la temporada' };
  const elite = ['S', 'SS', 'SSS'];
  if (elite.includes(fa.rg) && elite.includes(fb.rg)) return { t: 'DUELO DE ÉLITE', sub: 'letra ' + fa.rg + ' contra letra ' + fb.rg };
  if (fa.cc && fa.cc === fb.cc) return { t: 'DUELO ' + (GENTILICIO[fa.cc] || 'ENTRE COMPATRIOTAS'), sub: '' };
  return null;
}

/**
 * Un «¿sabías que…?» de verdad sobre uno de los dos, o `''`: su racha, su puesto (en la temporada y en su país), sus
 * títulos y podios, sus duelos, su crew y su tier, su letra, lo que cazó en Most Wanted, sus Misiones, que nunca le pudo
 * ganar al otro, que es la primera vez que se cruzan o el precio por su cabeza (`cabeza(lado)`, en Puntos de Tienda).
 * El mismo cruce da siempre el mismo dato (`semilla`), así no cambia si se vuelve a armar el mensaje. `y.pp` es su
 * puesto en su país (lo pone quien llama, con la tabla)
 */
export function datoCurioso(x, semilla, cabeza) {
  const c = [];
  for (const y of [x.a, x.b]) {
    const f = y.f || {};
    if (y.rd && y.rd[0] >= 3) c.push(y.n + ' viene de ganar ' + y.rd[0] + ' duelos seguidos');
    if (f.pos && f.pos <= 10) c.push(y.n + ' es el #' + f.pos + ' de la temporada');
    if (y.pp && y.pp <= 3 && f.cc && GENTILICIO[f.cc]) {
      c.push(y.n + (y.pp === 1 ? ' es el mejor ' : ' es el #' + y.pp + ' ') + GENTILICIO[f.cc].toLowerCase() + ' de la temporada');
    }
    if ((f.oro || 0) >= 2) c.push(y.n + ' ya ganó ' + f.oro + ' eventos esta temporada');
    const pod = (f.oro || 0) + (f.seg || 0) + (f.ter || 0);
    if (pod >= 3) c.push(y.n + ' lleva ' + pod + ' podios esta temporada');
    if (y.du.length >= 6) c.push(y.n + ' ganó ' + y.du.filter((d) => d[2]).length + ' de sus ' + y.du.length + ' duelos de la temporada');
    if ((f.ev || 0) >= 10) c.push(y.n + ' ya jugó ' + f.ev + ' eventos esta temporada');
    if (y.crew) c.push(y.n + ' es de la crew ' + y.crew.n + (y.crew.tier ? ', que está en ' + y.crew.tier : ''));
    if (['SSS', 'SS', 'S'].includes(f.rg)) c.push(y.n + ' tiene letra ' + f.rg + ' en el Competitivo');
    if ((f.caz || 0) >= 1) c.push(y.n + ' ya cazó ' + (f.caz === 1 ? 'a un buscado' : f.caz + ' buscados') + ' en Most Wanted');
    if ((f.sob || 0) >= 1) c.push(y.n + ' sobrevivió ' + (f.sob === 1 ? 'una vez' : f.sob + ' veces') + ' siendo buscado en Most Wanted');
    if ((f.mis || 0) >= 2000) c.push(y.n + ' sumó ' + milesAp(f.mis) + ' puntos con las Misiones de la semana');
    const v = cabeza ? cabeza(y) : 0;
    if (v > 0) c.push('por la cabeza de ' + y.n + ' hay ' + milesAp(v) + ' Puntos de Tienda: el que le gane se los lleva');
  }
  const { ga, gb } = x.h2h;
  if (ga + gb >= 2 && (!ga || !gb)) {
    const [g, p] = ga ? [x.a, x.b] : [x.b, x.a];
    c.push(p.n + ' nunca le pudo ganar a ' + g.n + ' (' + (ga + gb) + ' de ' + (ga + gb) + ')');
  }
  // la primera vez: sólo si la Liga sabe quiénes son los dos y conoce los duelos de alguno
  if (!ga && !gb && x.a.k && x.b.k && (x.a.du.length || x.b.du.length) && c.length) {
    c.push('es la primera vez que ' + x.a.n + ' y ' + x.b.n + ' se cruzan esta temporada');
  }
  if (!c.length) return '';
  let h = 0;
  for (const ch of String(semilla)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return '¿Sabías que ' + c[h % c.length] + '?';
}

/** La línea de la apuesta en el mensaje del cruce, según cómo esté. ⚠️ Siempre empieza con 🎲: se reemplaza por eso */
export function lineaApuesta(estado, d = {}) {
  if (estado === 'abierta') {
    const mins = Math.round((d.cierra || AP_CIERRA) / MIN), ms = d.montos || AP_MONTOS;
    return '🎲 **Apuestas abiertas ' + mins + (mins === 1 ? ' minuto' : ' minutos') + '**: toca a quién y cuánto, de '
      + milesAp(ms[0]) + ' a ' + milesAp(d.tope || AP_TOPE) + ' Puntos de Tienda. Lo de los que pierden se reparte entre '
      + 'los que aciertan.';
  }
  if (estado === 'cerrada') return '🎲 🔒 Apuestas cerradas · pozo de **' + milesAp(d.pozo) + '** entre ' + (d.cuantos || 0);
  if (estado === 'pagada') {
    return '🎲 🏆 Ganó **' + escMd(d.ganador || '') + '**: el pozo de **' + milesAp(d.pozo) + '** se repartió entre '
      + (d.cuantos || 0) + (d.cuantos === 1 ? ' que acertó' : ' que acertaron');
  }
  return '🎲 ↩️ ' + (d.porque || 'Sin resultado') + ': se devolvió lo apostado';
}

/**
 * 🖼️ UNA IMAGEN NUESTRA COMO ADJUNTO Y NO ADENTRO DE UN EMBED (13/10/2026, Dlx: «si la imagen no está en un embed es más
 * grande… si lo es, hacelo»). Lo es: Discord muestra un adjunto más grande que la imagen de un embed —que va adentro de
 * la tarjeta, con su borde de color y sus márgenes— y en el celular a todo el ancho. Baja la imagen (de R2, nuestra) y
 * EDITA el mensaje con multipart, sacándole el embed si tenía. Devuelve la respuesta de Discord, o `null` si no pudo
 * bajarla o mandarla: quien llama vuelve al embed de antes, así nunca queda sin imagen.
 */
export async function editarConAdjunto(urlApi, urlImg, nombre, extra, headers) {
  let img = null;
  try { img = await fetch(urlImg); } catch (e) { img = null; }
  if (!img || !img.ok) return null;
  const buf = await img.arrayBuffer();
  if (!buf.byteLength || buf.byteLength > 8 * 1024 * 1024) return null;
  const png = /\.png$/i.test(nombre);
  const fd = new FormData();
  fd.append('payload_json', JSON.stringify(Object.assign({ embeds: [], attachments: [{ id: 0, filename: nombre }],
    allowed_mentions: { parse: [] } }, extra || {})));
  fd.append('files[0]', new Blob([buf], { type: png ? 'image/png' : 'image/jpeg' }), nombre);
  try {
    // sin content-type: lo pone FormData con su separador
    return await fetch(urlApi, { method: 'PATCH', headers: headers || {}, body: fd });
  } catch (e) { return null; }
}

/** Los botones de una apuesta: una fila por lado, con los cuatro montos. `cerrada` los deja grises */
export function botonesApuesta(id, a, b, cerrada, montos = AP_MONTOS) {
  const corto = (n) => { const s = sinBandera(n); return s.length > 14 ? s.slice(0, 13) + '…' : s; };
  return [['A', a, 1], ['B', b, 4]].map(([lado, n, estilo]) => ({
    type: 1,
    components: montos.map((m, i) => ({ type: 2, style: estilo, disabled: !!cerrada,
      label: (i ? '' : corto(n) + ' · ') + m, custom_id: 'ap:' + id + ':' + lado + ':' + m })),
  }));
}

// ═════════════════════════════════════════════════════════════════════
// 🗳️ «¿QUIÉN GANA?», VOTADO POR EL PÚBLICO Y SIN PLATA (13/10/2026, Dlx a las ideas del vs: «me gustan todas»). En el
// mensaje del cruce de «Con datos» y «A full» que NO lleva apuestas —con apuestas serían dos juegos de botones, y la
// apuesta ya dice a quién le tiene fe la gente—: dos botones, un voto por persona que se puede cambiar, y el renglón
// «🗳️ El público…» se edita con cómo va (una edición no le suena a nadie). Cuando la llave dice quién pasó —o a los
// `QG_VENCE`— cierra: dice si el público acertó y se van los botones. Ver `qgVotar()` y `qgRevisar()`
// ═════════════════════════════════════════════════════════════════════
export const QG_VENCE = 30 * MIN;
export const QG_TOPE = 6;
/** 🗳️ los votos que hacen falta para que el público tenga un favorito en un cruce (TAG 🗳️ FAVORITO DEL PÚBLICO) */
export const QG_FAV_MIN = 3;

//: las letras de cada lado del voto: dos en un mano a mano, hasta cinco (un renglón de botones de Discord) en un
//: «todos contra todos» —1v1v1, 1v1v1v1— (19/10/2026, Dlx: «¿qué sucede cuando son 3 personas distintas batallando?»)
export const LADOS_VOTO = ['A', 'B', 'C', 'D', 'E'];

/** Los botones del voto, uno por lado con su nombre: `a`, `b` y los de `mas` (los lados C, D, E). */
export function botonesVoto(id, a, b, mas = []) {
  const lados = [a, b].concat(mas || []).slice(0, LADOS_VOTO.length);
  const tope = lados.length > 2 ? 18 : 30;
  const corto = (n) => { const s = sinBandera(n); return s.length > tope ? s.slice(0, tope - 1) + '…' : s || '¿?'; };
  return [{ type: 1, components: lados.map((n, i) => ({
    type: 2, style: 2, emoji: { name: '🗳️' }, label: corto(n), custom_id: 'qg:' + id + ':' + LADOS_VOTO[i] })) }];
}

// ═════════════════════════════════════════════════════════════════════
// 🃏 «CONSEGUÍ TU TARJETA» DEBAJO DEL VS (Dlx, 14/10/2026: «xq algunos tienen una tarjeta diferente o sin tarjetas?
// Quizás ahí deberíamos agregar botones como obtén tu tarjeta?», y a cómo: «Botón abajo de la imagen» y «Sólo con
// silueta»). El vs muestra la mejor tarjeta de cada uno y quien no tiene ninguna sale con la silueta: es justo el
// momento en que se ve la falta al lado de una tarjeta de verdad. Un link, el mismo para todos —Discord no deja
// personalizarlo—, a Tarjetas, donde «Las tuyas» le dice a cada uno qué le falta. Con sólo la Servidor NO sale: esa
// persona ya tiene tarjeta. ⚠️ Las ediciones que cambian botones (cerrar la apuesta, cerrar el voto) lo vuelven a
// poner (`filaTarjetaDe()`): un PATCH con `components` reemplaza la lista entera
// ═════════════════════════════════════════════════════════════════════
export const HUB_TARJETAS = HUB + '/freestyle-rap/tarjetas';

/** La fila del botón si a alguno de los dos lados del vs le falta tarjeta (`[]` si no, o si no es un vs). */
export function filaTarjeta(vs) {
  // 🧩 con grupos (2v2, 1v3, todos contra todos): si a alguno le falta
  if (vs && Array.isArray(vs.grupos)) {
    if (!vs.grupos.some((g) => (g || []).some((y) => y && !y.carta))) return [];
    return [{ type: 1, components: [{ type: 2, style: 5, label: 'Consigue tu tarjeta', emoji: { name: '🃏' }, url: HUB_TARJETAS }] }];
  }
  if (!vs || !vs.a || !vs.b || (vs.a.carta && vs.b.carta)) return [];
  return [{ type: 1, components: [{ type: 2, style: 5, label: 'Consigue tu tarjeta', emoji: { name: '🃏' }, url: HUB_TARJETAS }] }];
}

/** El renglón del voto: cómo va, o —con `ganador` (la letra del lado, o 'x' sin resultado)— si el público acertó.
 *  `mas` y `nmas`: los lados de más de un «todos contra todos» y sus votos (ver `LADOS_VOTO`). */
export function lineaVoto(a, b, na, nb, ganador, mas = [], nmas = []) {
  const lados = [a, b].concat(mas || []).map((x) => escMd(sinBandera(x)));
  const ns = [na || 0, nb || 0].concat((mas || []).map((_, i) => Number((nmas || [])[i]) || 0));
  const n = ns.reduce((x, y) => x + y, 0);
  if (!n) return ganador ? '🗳️ Nadie votó quién ganaba' : '🗳️ ¿Quién gana? Vota abajo: sin plata, para ver qué dice el público';
  // los porcentajes suman 100: el último se lleva lo que falta del redondeo (en un mano a mano, como siempre)
  const pc = ns.map((x) => Math.round((100 * x) / n));
  pc[pc.length - 1] = 100 - pc.slice(0, -1).reduce((x, y) => x + y, 0);
  const votos = n + (n === 1 ? ' voto' : ' votos');
  if (!ganador) return '🗳️ El público: ' + lados.map((l, i) => '**' + l + '** ' + pc[i] + ' %').join(' · ') + ' (' + votos + ')';
  const max = Math.max(...ns);
  if (ns.filter((x) => x === max).length > 1) {
    return '🗳️ El público estaba dividido: ' + (lados.length === 2 ? pc[0] + ' a ' + pc[1] : pc.join(' · ')) + ' (' + votos + ')';
  }
  const fav = ns.indexOf(max);
  return '🗳️ El público iba con **' + lados[fav] + '** (' + pc[fav] + ' %, ' + votos + '): '
    + (ganador === 'x' ? 'sin resultado' : ganador === LADOS_VOTO[fav] ? 'acertó' : 'se equivocó');
}

/** El texto del mensaje con el renglón del voto cambiado, o agregado al final si no estaba. */
export function conLineaVoto(texto, linea) {
  const ls = String(texto || '').split('\n');
  const i = ls.findIndex((l) => l.startsWith('🗳️'));
  if (i >= 0) ls[i] = linea; else ls.push(linea);
  return ls.join('\n');
}

/**
 * EL POZO COMPARTIDO: `{out: {quien: cobra}, devuelto, total}`. `ap` es `[[quien, lado, monto]]`. Lo de los que pierden se
 * reparte entre los que aciertan, según cuánto puso cada uno, y el bot no crea ni quema puntos —lo que sobra del redondeo
 * se pierde—. Sin nadie en el lado ganador (o sin ganador, `''`), se devuelve todo.
 */
export function repartoPozo(ap, ganador) {
  const total = ap.reduce((s, x) => s + x[2], 0);
  const w = ap.filter((x) => x[1] === ganador).reduce((s, x) => s + x[2], 0);
  const out = {};
  if (!w) {
    for (const [q, , m] of ap) out[q] = (out[q] || 0) + m;
    return { out, devuelto: true, total };
  }
  for (const [q, l, m] of ap) if (l === ganador) out[q] = (out[q] || 0) + Math.floor((m * total) / w);
  return { out, devuelto: false, total };
}

/** Qué lado de la apuesta ganó su batalla en la llave `L`: 'A', 'B' o '' (todavía no se sabe). */
/**
 * 🗳️ A quién votó el público en un cruce: el nombre con más votos, si hay `QG_FAV_MIN` o más y no hay empate arriba;
 * `''` si no. Un lado de equipo («Ana, Beto») no es una persona: no tiene favorito. Para el TAG 🗳️ FAVORITO DEL
 * PÚBLICO de la Temporada (19/10/2026), que cuenta cuántas veces le pasó a cada uno (`favoritos()` del objeto).
 */
export function favoritoDe(a, b, na, nb, mas = [], nmas = []) {
  const lados = [[a, Number(na) || 0], [b, Number(nb) || 0]].concat((mas || []).map((x, i) => [x, Number((nmas || [])[i]) || 0]));
  const total = lados.reduce((s, x) => s + x[1], 0);
  if (total < QG_FAV_MIN) return '';
  const orden = lados.slice().sort((x, y) => y[1] - x[1]);
  if (orden.length > 1 && orden[0][1] === orden[1][1]) return '';
  const n = String(orden[0][0] || '').trim();
  return n && !n.includes(',') ? n : '';
}

export function ladoGanador(L, ronda, a, b, mas = []) {
  const rondas = (L && L.rondas) || [];
  // 🧮 con N lados (un «todos contra todos»): la letra del que pasó, o '' si todavía no se sabe
  const kl = [a, b].concat(mas || []).map(claveTurno);
  for (let k = 0; k < rondas.length; k++) {
    if (rondas[k].r !== ronda) continue;
    for (const bt of batallasDe(rondas[k])) {
      const ks = (bt[0] || []).map(claveTurno);
      if (!kl.every((x) => ks.includes(x))) continue;
      const pas = pasaronChat(rondas, k, bt).map(claveTurno);
      if (pas.length !== 1) return '';
      const i = kl.indexOf(pas[0]);
      return i >= 0 ? LADOS_VOTO[i] : '';
    }
  }
  return '';
}

/** El chat general de un servidor entre sus canales (`GET /guilds/{g}/channels`), o `''`: «general» antes que «chat»
 *  y que «charla» o «central», sólo de texto y nunca del staff.
 *
 *  🆚 «CENTRAL» (12/10/2026): FVS llama a su chat «「💬」Central-FVS» y FFS el suyo «「🌏」CENTRAL-FFS», con el nombre
 *  del servidor y sin «chat» ni «general», así que los dos quedaban sin chat y el bot en vivo no tenía dónde hablar
 *  aunque Dlx lo prendiera. Medido en los ocho de la Liga: sólo esos dos canales dicen «central» (la categoría
 *  «CENTRAL» del staff de DRA es una categoría, no un canal), y va con el puntaje más bajo para que un «general» o
 *  un «chat» le ganen siempre. */
export function chatGeneralDe(cs, fuera) {
  let mejor = '', puntos = 0;
  for (const c of cs || []) {
    if (c.type !== 0 || (fuera && fuera.has(String(c.parent_id || '')))) continue;
    const n = String(c.name || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (STAFF.test(n) || /\bbots?\b|comando|clip|meme|media|beat/.test(n)) continue;
    const p = /\bgeneral\b/.test(n) ? 3 : /\bchat\b/.test(n) ? 2 : /\bcharla\b|\bcentral\b/.test(n) ? 1 : 0;
    if (p > puntos) { mejor = String(c.id); puntos = p; }
  }
  return mejor;
}

/** El aviso: «¡Te toca!» (y «¡Te están llamando!» las veces siguientes) o «Sos el próximo», con la batalla y adónde
 *  ir (la llave, en Discord). */
export function cuerpoTurno(L, bat, tipo, n = 1) {
  const vs = bat.lados.join(' vs ');
  const evento = String((L && L.nombre) || 'la llave').slice(0, 60);
  return {
    v: 1, tipo: 'turno', id: (L && L.id) || '',
    t: (tipo !== 'ahora' ? '⏳ Eres el próximo · ' : n > 1 ? '🎤 ¡Te están llamando! · ' : '🎤 ¡Te toca! · ') + evento,
    b: tipo === 'ahora'
      ? `${vs} (${bat.r}). Entra a la llamada: si no llegas, el organizador te reemplaza.`
      : `Después de la batalla que se está jugando: ${vs} (${bat.r}). Ve entrando a la llamada.`,
    url: ((L && L.links) || [])[0] || HUB + '/freestyle-rap/',
  };
}

/** La copia de `eventos-hoy` de un evento que se canceló (Dlx, 01/10/2026: «A», que la edite). Ver `mensajeRed()`. */
export function mensajeRedCancelado(c, por) {
  const seg = c.ini ? Math.floor(c.ini / 1000) : 0;
  const lineas = [`**${c.svn || c.sv}** · ${c.sv}`];
  if (seg) lineas.push(`~~Era <t:${seg}:t>~~`);
  lineas.push(por === 'editado' ? 'El servidor lo marcó como cancelado.'
    : por === 'mensaje' ? 'El organizador avisó que se cancela.' : 'El servidor borró el anuncio: el evento no se hace.');
  return {
    allowed_mentions: { parse: [] },
    embeds: [{
      title: ('❌ CANCELADO · ' + (c.t || 'evento')).slice(0, 256),
      description: lineas.join('\n').slice(0, 4000),
      color: 0xE41373,
      footer: { text: 'Liga Global · se publica solo, al minuto de anunciarse', icon_url: HUB + '/aviso.png' },
    }],
    // el anuncio borrado ya no existe: sin «Ir al anuncio»
    components: [{
      type: 1,
      components: [
        ...((por === 'editado' || por === 'mensaje') && c.url ? [{ type: 2, style: 5, label: 'Ir al anuncio', url: c.url }] : []),
        { type: 2, style: 5, label: 'Avisos en tu teléfono', emoji: { name: '🔔' }, url: HUB_AVISOS },
      ],
    }],
  };
}

/** Los servidores con un evento en juego, de los anuncios que anotó el vigía. */
export function svsEnVivo(cuerpos, ahora) {
  const out = new Set();
  for (const c of cuerpos || []) {
    let d = null;
    try { d = typeof c === 'string' ? JSON.parse(c) : c; } catch (e) { d = null; }
    if (!d || d.tipo !== 'evento' || d.ini == null || !d.sv) continue;
    if (d.ini - VER_ANTES <= ahora && ahora <= d.ini + VER_DESPUES) out.add(d.sv);
  }
  return out;
}

/**
 * Qué canales de veredictos leer este minuto: los que tuvieron mensajes hace
 * poco, siempre; y los de un servidor en vivo, rotando, hasta `tope`.
 */
export function veredictosALeer(lista, vivos, calientes, minuto, tope = VER_TOPE) {
  const cal = (lista || []).filter((c) => calientes.has(c.id));
  const resto = (lista || []).filter((c) => !calientes.has(c.id) && vivos.has(c.sv));
  const n = Math.max(0, tope - cal.length);
  const ini = resto.length && n ? (minuto * n) % resto.length : 0;
  return cal.slice(0, tope).concat(resto.slice(ini).concat(resto.slice(0, ini)).slice(0, n));
}
//: 🔑 DONDE SE RE-PUBLICAN LOS ANUNCIOS DE TODA LA LIGA. Dlx, 25/09/2026:
//: *«si, este es el canal 1500690475089399858»* — `〢🔥〉eventos-hoy` de
//: DRA, «eventos de toda la comunidad». Ver `publicar()`.
export const CANAL_RED = '1500690475089399858';
//: 🧩 el canal de Logs —«LIGA GLOBAL» en DRA—, el mismo que `avisar.CANAL` de Python: lo de rutina que tiene que ver
//: Dlx. `alertar.py --auto` comprueba que los dos digan lo mismo
export const CANAL_LOGS = '1504110449535483924';
//: 🔴 el servidor del canal de Logs (DRA), para el link a cada aviso desde el Dashboard
export const GUILD_LOGS = '841017460341604382';

// ── 🙋 LOS PEDIDOS DE LA GENTE (Dlx, 17/10/2026: «deberíamos hacer un sistema de reportes… ¿qué pasa si alguien pierde
// acceso a su cuenta de Discord y tiene una nueva?»; a las preguntas: aprueba «Vos o un Moderador», al aprobar pasa
// «Todo» —Puntos de Tienda, XP, Pase, seguidores, foto, fondo, servidor, redes— y se puede pedir también «ese no soy yo /
// mi nombre está mal», «mi país o mi bandera están mal» y «un video que no es mío»). Lo pide la persona desde Mi cuenta
// con SU Discord; el Dashboard lo muestra con las pruebas; lo aprobado de cuenta y de país lo aplica el ciclo
// (`bot/pedidos.py`: la Lista, y `mudarCuenta()` acá)
//: los tipos, como los dice la página
export const PEDIDO_TIPOS = { cuenta: 'Perdí mi cuenta de Discord', identidad: 'Ese no soy yo / mi nombre está mal',
  pais: 'Mi país o mi bandera están mal', video: 'Un video que no es mío' };
//: cuántos sin resolver puede tener cada uno, y cuánto se guarda lo resuelto
export const PEDIDO_TOPE = 3;
export const PEDIDO_DIAS = 30;

/** ¿Vale este pedido? `{tipo, k, texto, cc, vid}` limpio, o `{error}`. Pura: la prueba `bot/avisos_prueba.mjs`. */
export function validarPedido(d) {
  if (!d || typeof d !== 'object' || !PEDIDO_TIPOS[d.tipo]) return { error: 'tipo' };
  const k = String(d.k || '');
  if (k && !claveValida(k)) return { error: 'perfil' };
  if ((d.tipo === 'cuenta' || d.tipo === 'identidad') && !k) return { error: 'perfil' };
  const texto = String(d.texto || '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, 400);
  if (texto.length < 3 && d.tipo !== 'pais') return { error: 'texto' };
  const cc = String(d.cc || '').toLowerCase();
  if (d.tipo === 'pais' && !/^[a-z]{2}$/.test(cc)) return { error: 'pais' };
  const vid = String(d.vid || '');
  if (d.tipo === 'video' && !/^[A-Za-z0-9_-]{11}$/.test(vid)) return { error: 'video' };
  return { tipo: d.tipo, k, texto, cc: d.tipo === 'pais' ? cc : '', vid: d.tipo === 'video' ? vid : '' };
}
//: cuántos días de Logs mira el Dashboard
export const LOGS_DIAS = 3;

/**
 * 🔴 Los avisos en rojo y en amarillo de los mensajes de Logs: `[{id, t, nivel, tit, mas}]`, del más nuevo al más
 * viejo, de los últimos `LOGS_DIAS` días. `tit` es su primer renglón y `mas` los que siguen (hasta siete). Pura, sin
 * red: la prueba `bot/avisos_prueba.mjs`.
 */
export function logsRojos(ms, ahora) {
  const out = [];
  for (const m of Array.isArray(ms) ? ms : []) {
    const t = Date.parse((m && m.timestamp) || '');
    if (!(ahora - t < LOGS_DIAS * DIA_MS)) continue;
    let txt = String(m.content || '');
    for (const e of m.embeds || []) {
      txt += '\n' + (e.title || '') + '\n' + (e.description || '') + (e.fields || []).map((f) => '\n' + f.name + ': ' + f.value).join('');
    }
    const nivel = txt.includes('🔴') ? 'rojo' : txt.includes('⚠️') || txt.includes('⚠') ? 'amarillo' : '';
    if (!nivel) continue;
    const ls = txt.split('\n').map((s) => s.replace(/\*\*|__|`/g, '').trim()).filter(Boolean);
    out.push({ id: String(m.id), t: m.timestamp, nivel, tit: ls[0].slice(0, 200), mas: ls.slice(1, 8).map((s) => s.slice(0, 200)) });
  }
  return out.slice(0, 25);
}

/**
 * 🧩 ¿ESTO QUISO SER UNA LLAVE? (Dlx, 07/10/2026, las mejoras: «dale, haz todo»). La de Snake Rap de esa tarde —`(< A >)
 * ⚔️ (< B >)`— estuvo 45 minutos sin que el bot ni la página la vieran, y nada avisó: un formato que el lector no conoce
 * no falla, se saltea. Dos rondas distintas nombradas y cuatro renglones con dos nombres o más (sin contar los de las
 * rondas). ⚠️ La plantilla vacía (`(< >) ⚔️ (< >)`) y la charla del canal («arrancan los cuartos, la final a las 9») no.
 */
/**
 * 🧭 LO QUE CUENTA EL TUTORIAL (12/10/2026, web/src/primera.js): `tour` lo vio, `tour_fin` lo terminó, `salta0`…`salta4`
 * lo cortó en ese paso (0 es la bienvenida), `repite` lo volvió a pedir desde la Guía, `franja` llegó por un link y vio
 * la invitación, `franja_si` la tocó, `pasos` vio los primeros pasos en el Inicio y `pasos_fin` los completó
 */
export const TUTO_EV = new Set(['tour', 'tour_fin', 'salta0', 'salta1', 'salta2', 'salta3', 'salta4', 'repite', 'franja',
  'franja_si', 'pasos', 'pasos_fin',
  // 🎮 la pantalla de bienvenida (19/10/2026, web/src/bienvenida.jsx): la vieron, tocaron «Unirme», volvieron al paso 2,
  // la terminaron o la dejaron para otro momento
  'bienv', 'bienv_unirse', 'bienv_paso2', 'bienv_listo', 'bienv_luego']);

/**
 * 📊 QUÉ SECCIONES SE ABREN (Dlx, 12/10/2026, el research «página sencilla»: «hacé todo menos los dos puntos que
 * chocan»; el primer punto era medir antes de mover nada). Cada navegador cuenta cada sección UNA vez por día
 * (web/src/App.jsx, `lg:secc`) y acá sólo se suma un número por sección y por día: nunca quién. Es lo que hace falta
 * para ordenar la tira de abajo por uso de verdad y no por intuición
 */
export const SECC_EV = new Set(['inicio', 'eventos', 'ranking', 'publicaciones', 'tarjetas', 'ligas', 'salon', 'pase', 'tienda', 'socios',
  'guia', 'perfil', 'servidor', 'crew', 'crews', 'pais', 'cuenta', 'cambios',
  // 👆 y QUÉ SE TOCA EN EL INICIO (Dlx, 13/10/2026: «añadir eso de saber qué clickea la gente, y después tomar
  // decisiones así de drásticas»): `i-` cada bloque, `p-` cada puerta. Mismo trato: una vez por navegador y por día
  'i-historias', 'i-envivo', 'i-semana', 'i-ira', 'i-fechas', 'i-sebusca', 'i-noticias', 'i-encuestas', 'i-raperos',
  'i-panel', 'i-merch', 'i-numeros', 'p-eventos', 'p-ranking', 'p-mw', 'p-tarjetas', 'p-pase', 'p-tienda']);

/**
 * 👆 QUÉ SE TOCA EN TODA LA PÁGINA (Dlx, 16/10/2026: «asegurate que todo esté trackeado, así vemos qué cosas se
 * presionan más»). Cada toque de un botón o un link llega como «sección:etiqueta» —`ranking:ver llave`,
 * `inicio:→ perfil`— y acá se suma por día, nunca quién. La etiqueta la arma la página (`etiquetaClic()` de
 * web/src/App.jsx): el texto del botón sin números ni emojis, o adónde lleva el link. Esto valida la forma.
 */
export function claveClic(k) {
  const s = String(k || '');
  return s.length <= 64 && /^[a-z0-9-]{1,20}:[\p{L}\p{N} #·.,¿?¡!'()\/&+_→«»-]{1,40}$/u.test(s) ? s : '';
}
/** cuántas etiquetas distintas por día, como mucho: más que eso es ruido o alguien jugando con la ruta */
export const CLICS_MAX_K = 1500;

/**
 * 🐞 UN ERROR DE LA PÁGINA (Dlx, 19/10/2026: «ok», a que los errores de la página lleguen al Dashboard). Lo manda
 * web/src/errores.js: en qué parte (`d`), el mensaje (`m`), dónde del código (`f`, `inicio/x.js:1:234`) y su tipo
 * (`t`). Nada de nadie: los números largos se tapan acá también, por si la página no lo hizo. `null` si no tiene forma.
 */
export function errorValido(d) {
  if (!d || typeof d !== 'object') return null;
  const donde = typeof d.d === 'string' && /^[a-z0-9:_-]{1,40}$/.test(d.d) ? d.d : '';
  const msg = typeof d.m === 'string' ? d.m.replace(/\s+/g, ' ').replace(/\d{5,}/g, '#').trim().slice(0, 200) : '';
  const f = typeof d.f === 'string' && /^[\w./-]{1,60}:\d{1,7}:\d{1,7}$/.test(d.f) ? d.f : '';
  const tipo = typeof d.t === 'string' && /^[A-Za-z]{1,30}$/.test(d.t) ? d.t : '';
  return donde && msg ? { donde, msg, f, tipo } : null;
}
/** cuántos errores distintos por día, como mucho (la ruta es pública: lo de más es ruido o alguien jugando) */
export const ERRORES_DIA = 100;

/** 📣 La clave de un organizador: sin la arroba, en minúsculas y sólo letras y números (`latino()` para las de fantasía). */
export function claveOrg(nombre) {
  return latino(String(nombre || '').replace(/^[@!\s]+/, '')).toLowerCase().replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '').slice(0, 40);
}

/**
 * \ud83d\udc65 LOS ORGANIZADORES DE UN ANUNCIO, DE A UNO: `anuncios.organizadores()` de Python, para seguirlos (Dlx, 14/10/2026:
 * \u00abque los organizadores tengan su foto y perfil\u00bb). \u00abFLENNZS \ud83c\uddf2\ud83c\uddfd + LEWITO \ud83c\udde6\ud83c\uddf7 + AX \ud83c\uddfb\ud83c\uddea\u00bb son tres: quien sigue a Flennzs
 * no se enteraba, porque el aviso buscaba \u00abflennzslewitoax\u00bb. Las banderas y los emojis separan, la menci\u00f3n es el nombre
 * que Discord manda en `mentions`, \u00abyo\u00bb es quien public\u00f3, y el valor puede venir en el rengl\u00f3n de abajo (FVS). Lo que no
 * est\u00e1 separado no se parte. S\u00f3lo nombres: lo resuelve `claveOrg()`, como el \u2606 de la p\u00e1gina.
 */
export function organizadoresDe(m) {
  const au = (m && m.author) || {};
  const autor = String((m && m.member && m.member.nick) || au.global_name || au.username || '').trim();
  const men = {};
  for (const x of (m && m.mentions) || []) men[String(x.id)] = String(x.global_name || x.username || '');
  const ls = String((m && m.content) || '').split('\n').map((l) => [...l].map((c) => {
    const p = c.codePointAt(0);
    return p >= 0x1D400 && p <= 0x1D7FF ? c.normalize('NFKC') : c;
  }).join(''));
  const ETQ = /ORGANIZ(?:ADOR(?:ES|A)?|ACI[O\u00d3]N|ADO(?:\s+POR)?|A)\b/i;
  let linea = '';
  for (let j = 0; j < ls.length; j++) {
    const e = ETQ.exec(ls[j]);
    // la etiqueta abre el rengl\u00f3n: \u00abEntra cuando los organizadores hagan el anuncio\u2026\u00bb es una regla
    if (e && !/\p{L}/u.test(ls[j].slice(0, e.index))) {
      linea = ls[j].slice(e.index + e[0].length);
      if (!/[\p{L}\p{N}]/u.test(linea.replace(/<a?:\w+:\d+>/g, '')) && j + 1 < ls.length) linea = ls[j + 1];
      break;
    }
  }
  // 🔴 como en Python (pasada del 19/10/2026): el selector de variante y el unidor de los emojis adelante, y la mención de un
  // ROL o de un canal, que no es nadie (antes el `&` la partía y su número quedaba como organizador)
  linea = linea.replace(/^[\s*_`~:|>\u21e2\u2192\u219d#\u27a4\u25b8\u25ba\u2514\u251c\u2570\u2508\ud802\udf3a\ufe0f\u200d-]+/u, '')
    .replace(/<@&\d+>|<#\d+>/g, ' + ')
    .replace(/<@!?(\d+)>/g, (_, id) => ' + ' + (men[id] || '') + ' + ')
    .replace(/<a?:\w+:\d+>/g, ' + ').replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, ' + ');
  const out = [];
  for (let p of linea.split(/\s+-\s+|\s*[,/|&+]\s*|\s+y\s+/)) {
    p = p.replace(/[*`~]|__/g, '').replace(/^[\s.:!@\u00b7\u2022~#\u27a4\u25b8\u25ba\u2514\u251c\u2570\u2508\ud802\udf3a\ufe0f\u200d]+|[\s.:\ufe0f\u200d]+$/gu, '');
    // ni la conjunción suelta ni la etiqueta misma («… y <@&rol> ORGANIZADOR»)
    if (/^(?:y|e|and)$/i.test(p) || new RegExp('^(?:' + ETQ.source + ')$', 'i').test(p)) continue;
    if (/^(?:capaz\s+)?@?yo\b/i.test(p)) p = autor;
    p = p.replace(/[\p{So}\p{Sk}\p{Cf}]/gu, '').trim();
    if (p && /[\p{L}\p{N}]/u.test(p) && p.length <= 32 && !/^(?:@?(?:everyone|here)|tod[oa]s?|-+|\?+)$/i.test(p)
      && !out.some((x) => x.toLowerCase() === p.toLowerCase())) out.push(p);
  }
  return out.slice(0, 6);
}

//: 🌲 `escuchar.PARECIDAS`, la MISMA cadena (la compara el self-check de Python): las letras de otros alfabetos que
//: imitan a las latinas. EL BOSQUE DE ARTEMISA (Snake Rap, 12/10/2026) escribió sus rondas `ᎾᏟᎢᎪᏙᎾᏚ`, en cheroqui, y
//: ni `pareceLlave()` ni `intentoDeLlave()` la veían: ni se guardaba en vivo ni avisaba que no se podía leer
export const PARECIDAS = 'ᎠDᎡRᎢTᎥiᎩYᎪAᎫJᎬEᎯAᎳWᎶGᎷMᎸFᎻHᎾOᏀGᏁNᏂhᏃZᏆIᏌUᏏbᏒRᏔWᏕSᏙVᏚSᏞLᏟCᏢPᏦKᏫOᏳGᏴBᏵGᴀAʙBᴄCᴅDᴇEꜰFɢGʜHɪIᴊJᴋKʟLᴍMɴNᴏOᴘPǫQʀRꜱSᴛTᴜUᴠVᴡWʏYᴢZᗩAᗅAᗷBᑕCᗪDᗞDᗴEᖴFᕼHᒍJᒪLᗰMᑎNᑭPᑫQᖇRᔕSᑌUᐯVᗯW᙭XᘔZꓐBꓑPꓓDꓔTꓖGꓗKꓙJꓚCꓜZꓝFꓟMꓠNꓡLꓢSꓣRꓦVꓧHꓪWꓫXꓬYꓮAꓰEꓲIꓳOꓴUАAВBСCЕEЁEНHІIЈJКKМMОOРPЅSТTХXУYҮYИNЯRШWДAЭEаaеeоoрpсcуyхxіiјjѕsԁdԛqԝwӄkиnяrΑAΒBΕEΖZΗHΙIΚKΜMΝNΟOΡPΤTΥYΧXΛAΔAΣEΞEΘOϴOοoνvαaιiκkτtυuϲcϳjβBεeηnρpωwօoսuռnցgզqքpաwհhոnՈUՕOԼLƈcɖdɛeʄfɠgɦhɨiʝjʍmʊuʋvʐzȶt';
const PARECE = new Map();
for (let i = 0; i < PARECIDAS.length; i += 2) PARECE.set(PARECIDAS[i], PARECIDAS[i + 1]);
/** El texto en NFKD y con las letras parecidas en latinas, para buscar palabras (`OCTAVOS`, `FINAL`). */
export function latino(texto) {
  const t = String(texto || '').replace(/[\u{1F150}-\u{1F169}\u{1F170}-\u{1F189}](?:\uFE0F?[\u{1F150}-\u{1F169}\u{1F170}-\u{1F189}])+/gu,
    (run) => Array.from(run.replace(/\uFE0F/g, ''), (ch) => {
      const c = ch.codePointAt(0);
      return String.fromCharCode(0x41 + c - (c >= 0x1F170 ? 0x1F170 : 0x1F150));
    }).join(''));
  return Array.from(t.normalize('NFKD').replace(/[\u0305\u0332-\u0338\u033F]/g, ''), (ch) => {
    const c = ch.codePointAt(0);
    const u = (c >= 0xAB70 && c <= 0xABBF) || (c >= 0x13F8 && c <= 0x13FD) ? ch.toUpperCase() : ch;
    return PARECE.get(u) || u;
  }).join('');
}

/** 🌲 Cuántos renglones traen un «vs» (🆚, `vs`, `versus` o un emoji propio que lo dice) entre dos nombres. */
export function conVs(s) {
  return String(s || '').split('\n').filter((l) => /🆚|\bvs\b|<a?:\w*vs\w*:\d+>|\bversus\b/iu.test(l)
    && (l.replace(/<a?:\w+:\d+>|<[@#][!&]?\d+>/g, ' ').match(/\p{L}{2,}/gu) || []).length >= 2).length;
}

export function intentoDeLlave(texto) {
  const s = latino(texto).replace(/[̀-ͯ]/g, '');
  const RONDA = /\b(filtros?|clasificatoria|octavos|cuartos|semi\s*-?\s*finale?s?|semis|gran\s*-?\s*final|final)\b/gi;
  const rondas = new Set((s.match(RONDA) || []).map((x) => x.toLowerCase().replace(/[^a-z]/g, '').replace(/^gran/, '')
    .replace(/^semis?finale?s?$|^semis$/, 'semi').replace(/^filtros$/, 'filtro')));
  // 🌲 O LA FORMA, aunque ningún título se lea (EL BOSQUE DE ARTEMISA, 12/10/2026: rondas en cheroqui, y no avisó
  // nadie): cuatro renglones o más con un «vs» entre dos nombres. Si `LlaveVivo` igual le saca batallas, no se avisa
  if (rondas.size < 2) return conVs(s) >= 4;
  const esRonda = new RegExp(RONDA.source, 'i');
  const conNombres = s.split('\n').filter((l) => !esRonda.test(l)
    && (l.replace(/<a?:\w+:\d+>|<[@#][!&]?\d+>/g, ' ').match(/\p{L}{2,}/gu) || []).length >= 2);
  return conNombres.length >= 4;
}
const HUB_AVISOS = 'https://underlegends.pages.dev/freestyle-rap/avisos';
//: a dónde lleva el aviso de un evento cancelado: el calendario, en la pestaña de la página si hay una (`sw.js`)
const HUB_EVENTOS = '/freestyle-rap/eventos';
//: cuántos anuncios se le preguntan a Discord cada 2 minutos para ver si se cancelaron (ver `cancelaciones()`)
const CANCELA_TOPE = 4;
//: cuántos pedidos de «te toca» por minuto —la pregunta a Discord y los envíos—: comparte los 50 subpedidos (ver `turnos()`)
export const TOPE_TURNOS = 8;
//: cuántas veces suena «¡Te toca!» por batalla y persona, y cada cuánto: una por minuto (el vigía corre cada minuto;
//: 50 s y no 60 para que un minuto un poco corto no se saltee un toque)
export const TOQUES = 3;
const ENTRE_TOQUES = 50 * 1000;
//: una llave que nadie tocó en 40 minutos no está en juego (el evento terminó o se cortó): no se llama a nadie
const LLAVE_QUIETA = 40 * 60 * 1000;
//: cuántas notificaciones por invocación. El plan gratis da 50 subpedidos
//: por invocación: 20 envíos + 20 reintentos entran con margen.
const LOTE = 20;
const TOPE_SUBS = 20000;
//: cuántos dispositivos nuevos por hora, entre todos (ver `alta()`): hoy se anotan un puñado por día
const ALTAS_HORA = 60;
//: 🔑 EL SERVIDOR DE PRUEBA. No existe en la Liga, la página no lo ofrece,
//: y un aviso de este servidor le llega SOLO a quien lo eligió a mano —ni
//: siquiera a quien pidió «todos»—. Lo usa `herramientas/probar_avisos.py`
//: para recorrer el camino de un anuncio de verdad sin molestar a nadie.
export const SV_PRUEBA = 'ZZZ';
const CADA_SIMULACRO = 5 * MIN;

// ═════════════════════════════════════════════════════════════════════
// EL LECTOR DE ANUNCIOS — port de `bot/anuncios.py` y `bot/cuando.py`
// ═════════════════════════════════════════════════════════════════════
//
// ⚠️ PYTHON Y JAVASCRIPT NO LEEN IGUAL LOS MISMOS REGEX, y por eso esto no
// es una copia literal. En Python `\s`, `\w` y `\b` son Unicode; en JS,
// `\w` y `\b` son ASCII aunque lleve la bandera `u`. Con el `\b` de JS,
// «ÑORGANIZADOR:» tendría un borde de palabra delante y en Python no. Se
// arman acá con las mismas clases que usa Python.

// los espacios de `str.isspace()`: incluye \x1c-\x1f y \x85, que el `\s`
// de JS no tiene, y no incluye U+FEFF, que el de JS sí.
const S = '[\\t\\n\\v\\f\\r\\x1c-\\x20\\x85\\xa0\\u1680\\u2000-\\u200a' +
          '\\u2028\\u2029\\u202f\\u205f\\u3000]';
const W = '[\\p{L}\\p{N}_]';
const NW = '[^\\p{L}\\p{N}_]';
// el `\b` de Python: una transición palabra/no-palabra, en cualquier sentido
const B = '(?:(?<=' + W + ')(?!' + W + ')|(?<!' + W + ')(?=' + W + '))';

const re = (fuente, banderas) => new RegExp(fuente, (banderas || '') + 'u');
const stripPy = (s) => String(s).replace(re('^' + S + '+|' + S + '+$', 'g'), '');
const largo = (s) => Array.from(s).length;

export const PATRON = /evento|anuncio|novedad|torneo|competenc/i;
export const PATRON_INSC = /inscrip|registro|anotad|convocat/i;
export const STAFF = /staff|moderat|admin|organiz/i;  // 🏛️ «organizar-eventos» de la ACADEMIA (04/10/2026): del staff

/**
 * Los ids de las CATEGORÍAS de staff de un servidor: `STAFF` sobre su nombre,
 * normalizado. El filtro miraba sólo el nombre del canal, y FFS LEAGUE (entró
 * el 28/09/2026) guarda «𝔸ℕ𝕌ℕℂ𝕀𝕆𝕊» adentro de «🈺𝒜𝒟𝑀𝐼𝒩𝐼𝒮𝒯𝑅𝒜𝒞𝐼𝒪𝒩🫅».
 * Lo mismo que `escuchar.categorias_staff()` del ciclo. Pura.
 */
export function categoriasStaff(canales) {
  return new Set((canales || []).filter((c) => c && c.type === 4 && STAFF.test(String(c.name || '').normalize('NFKD')))
    .map((c) => String(c.id)));
}

const CAMPOS = {
  organizador: 'ORGANIZADOR',
  cupos: 'CUPOS',
  rango: 'RANGO',
  modalidad: 'MODALIDAD',
  premios: 'PREMIOS',
  horario: 'HORARIO|INICIO(?:' + S + '+DEL' + S + '+TORNEO)?',
};

const OTROS_CAMPOS = re(B + '(ORGANIZADOR|CUPOS|RANGO|MODALIDAD|PREMIOS|' +
  'HORARIO|JURADO|DJ|HOST|INDICACIONES|LINK)' + S + '*:', 'i');

export function limpio(s) {
  // entre dos cifras sueltas el emoji es el «vs» (`1<:escudo_dc:…>1`, DDF): `anuncios._limpio()`
  return String(s == null ? '' : s)
    .replace(/(^|[^\d])([1-9])[ \t]*<a?:\w+:\d+>[ \t]*([1-9])(?!\d)/g, '$1$2vs$3')
    .replace(/<a?:(\w+):\d+>/g, '')
    .replace(/<#\d+>|<@!?&?\d+>/g, '');
}

function valor(v) {
  let s = String(v == null ? '' : v)
    .replace(/__([^\n]*?)__/g, '$1')
    .replace(/\*\*([^\n]*?)\*\*/g, '$1');
  s = stripPy(s).replace(/^`+|`+$/g, '').replace(/^[ *]+|[ *]+$/g, '');
  // el adorno que quedó sin par: como `_valor()` de Python
  s = s.replace(/^[ *_`~]+/, '');
  s = stripPy(s.replace(re('(?:\\*\\*|__|`|~~)+' + S + '*$'), ''));
  if (OTROS_CAMPOS.test(s)) return '';
  if (!re(W).test(s)) return '';
  // «:infinity:» adentro de un código, como `_valor()` de Python (03/10/2026)
  return s.replace(/:infinity:/g, '∞');
}

export function campo(texto, nombre) {
  const t = limpio(texto);
  const n = '(?:' + nombre + ')';
  let m = re('`' + S + '*' + n + S + '*:' + S + '*([^`\\n]*)`', 'i').exec(t);
  if (m && stripPy(m[1])) return stripPy(m[1]).replace(/:infinity:/g, '∞');
  m = re('`' + S + '*' + n + S + '*:?' + S + '*`__?' + S + '*([^\\n]*)', 'i').exec(t);
  if (m && stripPy(m[1])) return valor(m[1]);
  m = re(B + n + '[*_~ \\t]*:[*_~ \\t]*([^\\n]+)', 'i').exec(t);
  return m ? valor(m[1]) : '';
}

// `str.splitlines()`: más cortes que `\n` a secas
const LINEAS = new RegExp('\r\n|[\n\r\x0b\x0c\x1c\x1d\x1e\x85\u2028\u2029]');
const ES_CAMPO = re('^' + S + '*[A-ZÁÉÍÓÚÑ]+' + S + '*:');
const ADORNO = re('^' + '[^\\p{L}\\p{N}_¿¡]+|[^\\p{L}\\p{N}_)\\]!?.]+$', 'g');

// ── el lector ancho: el anuncio de cada servidor, como lo escribe ────────
//
// 🔴 EL MISMO DE `bot/anuncios.py` —ver su encabezado de esta parte—. Dlx,
// 25/09/2026: «cada sv tiene su forma de hacer sus cosas como anunciar».
// Medido sobre 263 mensajes de los 10 canales: DRA no avisaba NINGÚN evento.

const VOCAB = [
  [['INICIO', 'DEL', 'TORNEO'], 'horario', 1],
  [['INICIO', 'DEL', 'EVENTO'], 'horario', 1],
  [['HORA', 'DE', 'INSCRIPCIONES'], 'inscripciones', 9],
  [['HORA', 'DE', 'INSCRIPCION'], 'inscripciones', 9],
  [['HORA', 'INSCRIPCIONES'], 'inscripciones', 9],
  [['HORA', 'INSCRIPCION'], 'inscripciones', 9],
  [['HORARIO', 'CONFIRMADO'], 'horario', 2],
  // 🔴 antes que FECHA y DIA, como en Python: ver `VOCAB` de bot/anuncios.py
  [['FECHA', 'Y', 'HORARIO'], 'horario', 2],
  [['FECHA', 'Y', 'HORA'], 'horario', 2],
  [['DIA', 'Y', 'HORARIO'], 'horario', 2],
  [['DIA', 'Y', 'HORA'], 'horario', 2],
  [['ORGANIZADO', 'POR'], 'organizador', 9],
  [['FORMATO', 'DE', 'COMPETENCIA'], 'modalidad', 9],
  // 🌀 FREESTYLE ZONE (FRZ, 14/10/2026): «⏳ | **EL TORNEO COMIENZA EN 10 MINUTOS**», sin dos puntos y con dos palabras
  // delante: como en `VOCAB` de bot/anuncios.py
  [['EL', 'TORNEO', 'COMIENZA'], 'horario', 2],
  [['EL', 'TORNEO', 'EMPIEZA'], 'horario', 2],
  [['EL', 'TORNEO', 'ARRANCA'], 'horario', 2],
  [['EL', 'EVENTO', 'COMIENZA'], 'horario', 2],
  [['EL', 'EVENTO', 'EMPIEZA'], 'horario', 2],
  [['EL', 'EVENTO', 'ARRANCA'], 'horario', 2],
  [['INICIO'], 'horario', 1],
  [['HORARIOS'], 'horario', 2],
  [['HORARIO'], 'horario', 2],
  [['CUANDO'], 'horario', 2],
  [['ARRANCA'], 'horario', 2],
  [['COMIENZA'], 'horario', 2],
  [['EMPIEZA'], 'horario', 2],
  [['HORA'], 'horario', 3],
  [['FECHA'], 'fecha', 9],
  [['DIA'], 'fecha', 9],
  [['ORGANIZADORES'], 'organizador', 9],
  [['ORGANIZADORA'], 'organizador', 9],
  [['ORGANIZADOR'], 'organizador', 9],
  [['ORGANIZACION'], 'organizador', 9],
  [['ORGANIZACIOR'], 'organizador', 9],
  [['ORGANIZADO'], 'organizador', 9],
  [['ORGANIZA'], 'organizador', 9],
  [['CUPOS'], 'cupos', 9],
  [['CUPO'], 'cupos', 9],
  [['RANGOS'], 'rango', 9],
  [['RANGO'], 'rango', 9],
  [['MODALIDAD'], 'modalidad', 9],
  [['FORMATO'], 'modalidad', 9],
  [['PREMIOS'], 'premios', 9],
  [['PREMIO'], 'premios', 9],
  [['RECOMPENSA'], 'premios', 9],
  // 🆚 FVS (12/10/2026): «𝐁𝐄𝐍𝐄𝐅𝐈𝐂𝐈𝐎𝐒» y abajo «puntos de ascenso» (`anuncios.VOCAB`)
  [['BENEFICIOS'], 'premios', 9],
  [['BENEFICIO'], 'premios', 9],
  [['JURADOS'], 'jurado', 9],
  [['JURADO'], 'jurado', 9],
  [['JUECES'], 'jurado', 9],
  [['JUEZ'], 'jurado', 9],
  [['DJ'], 'dj', 9],
  [['HOST'], 'host', 9],
  [['INSCRIPCIONES'], 'inscripciones', 9],
  [['INSCRIPCION'], 'inscripciones', 9],
  [['TORNEO'], 'titulo', 9],
];

const NO_TITULOS = ['SUPLENTES', 'CLASIFICADOS', 'RESULTADOS', 'FELICIDADES',
  'CANCELAD', 'POSTERGAD', 'SE CANCELA', 'LLAVE', 'BRACKET'];

const NS = '[^' + S.slice(1);
const MARCAS = /<a?:\w+:\d+>|<@!?&?\d+>|<#\d+>|<t:-?\d+(?::[a-zA-Z])?>/g;
const MARCA_ES = re('\\p{M}');

/** `↝**__𝐂𝐔𝐏𝐎𝐒__**: ♾️` -> `CUPOS :`, como `norm_linea()` de Python. */
export function normLinea(s) {
  const t = String(s == null ? '' : s).replace(MARCAS, ' ').normalize('NFKD');
  let out = '';
  for (const c of Array.from(t)) {
    if (MARCA_ES.test(c)) continue;
    for (const u of Array.from(c.toUpperCase())) {
      out += (u >= 'A' && u <= 'Z') || (u >= '0' && u <= '9') || u === ':' ? u : ' ';
    }
  }
  return out.split(' ').filter(Boolean).join(' ');
}

const toks = (nl) => nl.replace(/:/g, ' : ').split(' ').filter(Boolean);

/** `[tipo, prioridad, palabras]` si la línea normalizada es un campo. */
export function campoLinea(nl) {
  const t = toks(nl);
  for (const [pal, tipo, pri] of VOCAB) {
    if (pal.every((p, i) => t[i] === p)) {
      const resto = t.slice(pal.length);
      if (tipo === 'titulo' && (!resto.length || resto[0] !== ':')) return null;
      if (!resto.length || resto[0] === ':' || resto.length <= 8) return [tipo, pri, pal.length];
      return null;
    }
  }
  return null;
}

// 🔴 «# HORARIOS PARA LA FINAL NACIONAL ALBICELESTE 🕚» (URBF, 02/10/2026) no es un horario: es el título de un mensaje
// para confirmar asistencia. Sin dos puntos, tres palabras o más y ningún número ni marca de hora, es una frase. Lo
// mismo que `_frase()` de bot/anuncios.py
function frase(raw, c) {
  if (!c || c[0] !== 'horario') return false;
  const resto = toks(normLinea(raw)).slice(c[2]);
  return resto.length >= 3 && resto[0] !== ':' && !/[0-9]/.test(resto.join('')) &&
    !String(raw == null ? '' : raw).includes('<t:');
}

/** El campo de una línea cruda, salvo que sea una frase: `campo_de()` de Python. */
export function campoDe(raw) {
  const c = campoLinea(normLinea(raw));
  return frase(raw, c) ? null : c;
}

function dosPuntos(s) {
  let dentro = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '<') dentro++;
    else if (c === '>' && dentro) dentro--;
    else if ((c === ':' || c === '：') && !dentro) return i;
  }
  return -1;
}

function valorLinea(raw, k, siguientes) {
  const r = limpio(raw);
  const i = dosPuntos(r);
  if (i >= 0) {
    const v = valor(r.slice(i + 1));
    if (v) return v;
  } else {
    const resto = toks(normLinea(r)).slice(k).join(' ');
    if (resto) return resto;
  }
  for (const s of siguientes.slice(0, 3)) {
    if (stripPy(s)) {
      if (campoDe(s)) return '';
      return valor(limpio(s));
    }
  }
  return '';
}

/** `{tipo: valor}` de las líneas que son campos. Ver `campos_lineas()`. */
export function camposLineas(texto) {
  const lineas = String(texto == null ? '' : texto).split(LINEAS);
  const out = {};
  const pri = {};
  for (let i = 0; i < lineas.length; i++) {
    const c = campoDe(lineas[i]);
    if (!c) continue;
    const [tipo, p, k] = c;
    if (tipo in out && (tipo !== 'horario' || pri[tipo] <= p)) continue;
    out[tipo] = valorLinea(lineas[i], k, lineas.slice(i + 1));
    pri[tipo] = p;
  }
  return out;
}

/** La tarjeta del Centro de Competencias de DRA: `🏆 NOMBRE` en un embed. */
function tarjeta(m) {
  for (const e of (m && m.embeds) || []) {
    const t = stripPy(String((e && e.title) || ''));
    if (t.startsWith('🏆') && normLinea(e.description).includes('INSCRIB')) {
      return Array.from(stripPy(t.slice('🏆'.length))).slice(0, 70).join('');
    }
  }
  return '';
}

function sinMd(l) {
  let s = String(l == null ? '' : l);
  for (const x of ['**', '__', '~~', '`', '*']) s = s.split(x).join('');
  return stripPy(stripPy(s).replace(/^[#>-]+/, ''));
}

const stripBordes = (s, cs) => {
  const a = Array.from(s);
  let i = 0;
  let j = a.length;
  while (i < j && cs.includes(a[i])) i++;
  while (j > i && cs.includes(a[j - 1])) j--;
  return a.slice(i, j).join('');
};
const LINK = re('@everyone|@here|https?://' + NS + '+|<t:-?\\d+(?::[a-zA-Z])?>', 'g');
const VACIO_EN_CAJA = re('[\\[(][^\\p{L}\\p{N}_\\[\\]()]*[\\])]', 'g');

/** Una línea -> el título limpio, o `''`. Ver `_titulo()` de Python. */
function titulo(l) {
  let s = sinMd(l).replace(LINK, '');
  // y la letra decorada es letra: «# 𝐅𝐎𝐑 𝐅𝐀𝐈𝐓𝐇» (FVS), como `anuncios._titulo()`
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ0-9]/.test(s.normalize('NFKC'))) return '';
  if (s.includes('╎')) {
    const partes = s.split('╎').map(stripPy).filter(Boolean);
    // el PRIMERO de los más largos, como `max(..., key=len)`
    if (partes.length) s = partes.reduce((a, b) => (largo(b) > largo(a) ? b : a));
  }
  for (const [a, b] of [['『', '』'], ['「', '」'], ['〈', '〉']]) {
    const i = s.indexOf(a);
    const j = i >= 0 ? s.indexOf(b, i + 1) : -1;
    if (i >= 0 && j > i) { s = s.slice(i + 1, j); break; }
  }
  s = s.replace(VACIO_EN_CAJA, ' ');
  s = stripBordes(s.replace(ADORNO, ''), '_ ');
  if (s.startsWith('(') && s.endsWith(')')) s = stripPy(s.slice(1, -1));
  if (s.endsWith(')') && !s.includes('(')) s = s.slice(0, -1);
  if (s.endsWith(']') && !s.includes('[')) s = s.slice(0, -1);
  s = stripBordes(s.replace(ADORNO, ''), '_ ').normalize('NFKC');
  return largo(s) >= 3 ? Array.from(s.replace(re(S + '+', 'g'), ' ')).slice(0, 70).join('') : '';
}

export function nombreDe(texto) {
  // `anuncios.nombre_de()`: el valor de un campo en el renglón de abajo no es el título, el título de puros emojis
  // («# 👀👀👀 #», FVS) queda de reserva, y una oración no es un nombre
  let valorAbajo = false, reserva = '';
  for (const l of limpio(texto).split(LINEAS)) {
    if (!reserva && /^\s*#/.test(l) && !/[\p{L}\p{N}]/u.test(l.replace(/#/g, '')) && /[\u{1F300}-\u{1FAFF}]/u.test(l)) {
      reserva = Array.from(l.replace(/[#\s]+/g, '')).slice(0, 20).join('');
      continue;
    }
    const c = campoDe(l);
    if (c) { valorAbajo = !valorLinea(l, c[2], []); continue; }
    if (valorAbajo && l.trim()) { valorAbajo = false; continue; }
    if (ES_CAMPO.test(sinMd(l))) continue;
    const t = titulo(l);
    if (t && !(t.split(/\s+/).filter(Boolean).length >= 6 && /\.\s*$|\.\s+[^\P{L}]|\.\s+\(/u.test(t))) return t;
  }
  return reserva;
}

/** Un mensaje -> un anuncio, o `null` si no parece uno. Ver `parsear()`. */
export function parsearAnuncio(m) {
  const txt = (m && m.content) || '';
  const anchos = camposLineas(txt);
  const tj = stripPy(txt) ? '' : tarjeta(m);
  const nombre = tj || titulo(anchos.titulo || '') || nombreDe(txt);
  const p = {};
  for (const k of Object.keys(CAMPOS)) p[k] = campo(txt, CAMPOS[k]);
  // la plantilla manda donde la hay; el lector ancho completa
  for (const k of Object.keys(p)) if (!p[k] && anchos[k]) p[k] = anchos[k];
  // 🔴 LA FIRMA SON DOS CAMPOS PRESENTES, como en Python
  const tipos = new Set(Object.keys(p).filter((k) => p[k]));
  for (const k of Object.keys(anchos)) if (k !== 'titulo') tipos.add(k);
  if (tj) { tipos.add('tarjeta'); tipos.add('boton'); }
  if ((tipos.has('horario') || tipos.has('fecha')) &&
      (txt.includes('@everyone') || txt.includes('@here'))) tipos.add('mencion');
  if (tipos.size < 2 || !nombre) return null;
  const n = normLinea(nombre);
  if (NO_TITULOS.some((x) => n.startsWith(x)) || n === 'PRUEBA') return null;
  // sin horario, la marca de Discord de cualquier parte (como en Python)
  if (!p.horario) {
    const mk = /<t:\d{9,11}(?::[tTfFR])?>/.exec(txt);
    if (mk) p.horario = mk[0];
  }
  return {
    nombre, horario: p.horario, modalidad: p.modalidad,
    cupos: p.cupos, premios: p.premios, organizador: p.organizador,
    fecha: p.fecha || anchos.fecha || '',
  };
}

const EN = re(B + 'en' + S + '+(\\d{1,3})' + S +
  '*(m|min|mins|minuto|minutos|h|hs|hr|hrs|hora|horas)?' + B, 'i');
const MEDIA = re(B + 'en' + S + '+media' + S + '+hora' + B, 'i');
// y `YAYAYA` y `RIGHT NOW!` (DDF): `cuando._AHORA`
const AHORA = re(B + '(ahora|(?:ya)+a*|empez(ando|amos)|arrancamos|comenzamos|en' +
  S + '+vivo|right' + S + '+now)' + B, 'i');
const HORAS = ['h', 'hs', 'hr', 'hrs', 'hora', 'horas'];
const TOPE_MIN = 60 * 12;
const MARCA = /<t:(\d{9,11})(?::[tTdDfFR])?>/;

// 🔑 «22:30 🇨🇱» ES UNA HORA: la bandera dice de dónde. El mismo mapa y las
// mismas reglas que `cuando.hora_bandera()` en Python — el contrato
// (bot/avisos_casos.json) los compara. ⚠️ Sin EE.UU.: tiene varios husos.
export const ZONA_BANDERA = {
  AR: 'America/Argentina/Buenos_Aires', BO: 'America/La_Paz',
  BR: 'America/Sao_Paulo', CL: 'America/Santiago', CO: 'America/Bogota',
  CR: 'America/Costa_Rica', CU: 'America/Havana', DO: 'America/Santo_Domingo',
  EC: 'America/Guayaquil', ES: 'Europe/Madrid', GT: 'America/Guatemala',
  HN: 'America/Tegucigalpa', MX: 'America/Mexico_City', NI: 'America/Managua',
  PA: 'America/Panama', PE: 'America/Lima', PR: 'America/Puerto_Rico',
  PY: 'America/Asuncion', SV: 'America/El_Salvador', UY: 'America/Montevideo',
  VE: 'America/Caracas',
};
// 🔑 EL PAÍS ESCRITO, CUANDO NO HAY BANDERA (04/10/2026): «4 PM COLOMBIA» (el Red Bull de Urban salió sin hora en la
// página) y «ARRANCA 7PM CHILE» (la ACADEMIA). Sin tildes y en mayúsculas. El mismo mapa que `cuando.PAIS_NOMBRE`
export const PAIS_NOMBRE = {
  ARGENTINA: 'AR', ARG: 'AR', BOLIVIA: 'BO', BRASIL: 'BR', CHILE: 'CL', COLOMBIA: 'CO',
  'COSTA RICA': 'CR', CUBA: 'CU', 'REPUBLICA DOMINICANA': 'DO', ECUADOR: 'EC', ESPANA: 'ES',
  GUATEMALA: 'GT', HONDURAS: 'HN', MEXICO: 'MX', NICARAGUA: 'NI', PANAMA: 'PA', PERU: 'PE',
  'PUERTO RICO': 'PR', PARAGUAY: 'PY', 'EL SALVADOR': 'SV', URUGUAY: 'UY', VENEZUELA: 'VE',
};
/** El código del primer país escrito con todas las letras («4 PM COLOMBIA» -> `CO`), o `null` */
export function paisEscrito(texto) {
  const t = sinTildes(texto);
  let mejor = null;
  for (const [nombre, cc] of Object.entries(PAIS_NOMBRE)) {
    const m = new RegExp('\\b' + nombre + '\\b').exec(t);
    if (m && (!mejor || m.index < mejor[0])) mejor = [m.index, cc];
  }
  return mejor ? mejor[1] : null;
}
const BANDERA_RE = /([\u{1F1E6}-\u{1F1FF}])([\u{1F1E6}-\u{1F1FF}])/u;
const HHMM_RE = /(?<![\d/])(\d{1,2})[:.h](\d{2})(?!\d)\s*(?:([ap])\.?\s*m\b\.?)?/i;
const HH_RE = /(?<![\d/:])(\d{1,2})\s*(?:(hs|hrs|h)\b|([ap])\.?\s*m\b\.?)/i;
// el día de la semana, con domingo en 0 como `getDay()`
const DIAS_JS = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
const DIA_MS = 24 * HORA;

// ── 📊 CUÁNTA GENTE USA EL BOT Y LA PÁGINA (Dlx, 04/10/2026: «en stats mostrá cuántas personas usaron o
// interactuaron con el bot… para ver cuántos están enganchados con el bot y la página web») ──────────────────────
// Personas distintas por día: quién usó el bot (comandos, botones, menús) y quién hizo algo en la página con su
// cuenta. Es su ID de Discord y el día, nada más, y se borra a los `USO_DIAS`. Las visitas sin cuenta se cuentan sin
// guardar nada de nadie: el navegador avisa una vez por día (`lg:visita`) y acá sólo sube un número.
export const USO_DIAS = 35;
/** El día en hora del este, `AAAA-MM-DD`: el de quien mira la Liga, no el de UTC */
// 🎁 EL PREMIO DE LA SEMANA (ver `semanal()` del objeto): 50 Puntos de Tienda de base y 50 por cada día que entraste la
// semana pasada, hasta 400
export const SEM_BASE = 50;
export const SEM_DIA = 50;
export const SEM_TOPE = 400;
/** El lunes (`AAAA-MM-DD`) de la semana de un día del este (`AAAA-MM-DD`), y correrlo `n` días. */
export function lunesDe(dia) {
  const d = new Date(String(dia) + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export function masDias(dia, n) {
  const d = new Date(String(dia) + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** Cuánto paga el premio de la semana con `dias` días entrados la semana pasada. */
export function montoSemanal(dias) {
  return Math.min(SEM_TOPE, SEM_BASE + SEM_DIA * Math.max(0, Math.min(7, Number(dias) || 0)));
}

export function diaET(t = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(t));
}
// ⚡ una vez por persona, por día y por instancia: el resto de los toques del día no vuelven a preguntarle al objeto
const USADOS = new Set();
let usadosDia = '';
export async function anotarUso(env, quien, por) {
  if (!env || !env.AVISOS || !/^[0-9]{5,25}$/.test(String(quien || '')) || (por !== 'bot' && por !== 'web')) return;
  const dia = diaET();
  if (dia !== usadosDia) { USADOS.clear(); usadosDia = dia; }
  const k = quien + ':' + por;
  if (USADOS.has(k)) return;
  USADOS.add(k);
  try {
    await env.AVISOS.get(env.AVISOS.idFromName('liga')).fetch('https://avisos/uso', {
      method: 'POST', body: JSON.stringify({ quien: String(quien), por, dia }), headers: { 'content-type': 'application/json' },
    });
  } catch (e) { USADOS.delete(k); }
}

// ── 🔥 LA RACHA DIARIA Y LOS NIVELES (Dlx, 04/10/2026: «¿un daily streak? al conectarse en cualquier parte de la
// Liga Global» y «¿quizás hasta niveles? para ver qué tan antiguo eres») ──────────────────────────────────────────────
// Un día cuenta si usaste el bot, hiciste algo en la página con tu cuenta o jugaste un evento. Las reglas y los
// números viven en `bot/racha.py` y llegan con lo del precio por cabeza (`racha_cfg`); estos son los de arranque.
export const RACHA_CFG = { cada: 7, premio: 500, xp_ev: 10, xp_dia: 2, paso: 10, desde: 0 };

// 🔥 LA RACHA CON SU PREMIO DE CADA DÍA (Dlx, 13/10/2026: «que este daily streak tenga sus propias recompensas… y hacer
// así también uno especial para los nuevos»; a la propuesta, «La racha lo reemplaza» —al premio de la semana— y «Así, con
// tareas»). De lunes a domingo, en el este: cada día que entrás cobrás el de ese día —el que no se cobró ese día, no se
// cobra después— y el domingo es un cofre si entraste al menos `COFRE_DIAS` días de la semana (si no, paga como el
// sábado). Junta lo que pagaban el premio de la semana (hasta 400) y el de la racha cada 7 días (500): una semana entera
// son 900, igual que antes, pero se cobra de a un día. Sin azar: el azar entra cuando Dlx diga
export const RACHA_DIA = [50, 50, 100, 100, 150, 150, 300];
export const COFRE_DIAS = 5;
//: los hitos de una racha, una vez por racha (se cobran solos, y avisan a la campana)
export const RACHA_HITOS = [[14, 500], [30, 1000]];
// 🌱 «TUS PRIMEROS 7 DÍAS»: en vez de la racha, para quien entró por primera vez hace menos de `BIENVENIDA_DIAS` días. Siete
// pasos, uno por día como mucho, cada uno con algo chico que hacer —es el tutorial, con premio— y más grandes que la racha
export const BIENVENIDA = [[200, 'entrar', 'Entra a la Liga'], [200, 'seguir', 'Sigue a un rapero'],
  [300, 'campana', 'Activa la campana de avisos'], [300, 'llave', 'Mira una llave en vivo'], [400, 'verificar', 'Verifícate'],
  [400, 'anotarse', 'Anótate a un evento'], [500, 'listo', 'Completa tu primera semana']];
export const BIENVENIDA_DIAS = 14;
// ⭐ LO QUE SUBE EL NIVEL, ADEMÁS DE JUGAR Y ENTRAR (Dlx, 14/10/2026: «haz que otras y muchas cosas más te hagan subir de
// nivel acá… ojo, no me refiero a nivel de pase, eso es otra cosa»). El nivel es el de `nivelDeXp()`: el de tu perfil, el
// que desbloquea los temas (`web/src/temas.js`). `[XP por vez, hasta cuántas veces, para qué]`. Cada cosa cuenta UNA vez
// (`xp_log`: seguir a la misma persona dos veces es una) y con tope, así no se sube tocando un botón: jugar sigue siendo
// lo que más da (10 por evento). Las de «una vez» se miran también en su tabla, así lo hecho antes de esto cuenta
export const XP_FUENTES = {
  fel: [1, 60, 'Felicitar una publicación'],
  promo: [2, 60, 'Abrir una promo'],
  sigue: [2, 25, 'Seguir a un rapero'],
  voto: [2, 30, 'Votar en una encuesta'],
  qg: [1, 60, 'Votar en «¿Quién gana?»'],
  apuesta: [2, 30, 'Apostar en una batalla en vivo'],
  vivo: [3, 40, 'Mirar una llave en vivo'],
  precio: [2, 25, 'Poner precio a una cabeza'],
  reporte: [5, 20, 'Reportar un error que se corrigió'],
  tarea: [1, 200, 'Cumplir una Tarea del Pase'],
  campana: [10, 1, 'Activar la campana de avisos'],
  redes: [5, 1, 'Mostrar tus redes en el perfil'],
  fondo: [5, 1, 'Ponerle fondo a tu perfil'],
  foto: [5, 1, 'Ponerle foto a una tarjeta'],
};
/** ⭐ La XP de lo que no es jugar ni entrar, con lo que lleva de cada fuente: `{xp, de: {que: [veces, xp]}}` */
export function xpDeFuentes(cuentas) {
  const de = {};
  let xp = 0;
  for (const [que, [vale, tope]] of Object.entries(XP_FUENTES)) {
    const n = Math.min(Number(cuentas[que]) || 0, tope);
    if (!n) continue;
    de[que] = [n, n * vale];
    xp += n * vale;
  }
  return { xp, de };
}
// 🎟️ lo que el Pase sabe contar: el «qué mide» de cada Tarea (`MIDE` en `bot/pase.py`). `dra` (eventos jugados en
// DRA) y `caza` (buscados cazados) los manda el ciclo; los días (`activo`), las felicitaciones y las llaves en vivo
// (`pase_log`) y los precios (`precios`) los ve pasar el objeto
//: 🏠 `voto`, `apuesta` y `sigue`: las Tareas que reemplazan a las de DRA mientras DRA no organice (`pase.SIN_DRA`)
export const PASE_MIDE = ['activo', 'fel', 'vivo', 'precio', 'dra', 'caza', 'voto', 'apuesta', 'sigue', 'promo'];
const diaNum = (s) => Math.round(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / DIA_MS);
//: «hasta el final de la temporada», para las cuentas de temporada (un número y no `Infinity`: va a SQLite)
const SIEMPRE = Number.MAX_SAFE_INTEGER;
/** El instante en que termina el día del este que contiene `t`: la medianoche siguiente, en ms */
export function finDiaET(t = Date.now()) {
  const d = diaET(t);
  const base = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + 1, 4, 0);
  // a las 4 AM UTC ya es el día siguiente con el horario de verano (UTC−4); sin él (UTC−5), una hora después
  return diaET(base) === d ? base + HORA : base;
}
/** `[inicio, fin)` en ms del día del este `AAAA-MM-DD` */
export function rangoDiaET(dia) {
  const mediodia = Date.UTC(+dia.slice(0, 4), +dia.slice(5, 7) - 1, +dia.slice(8, 10), 16, 30);
  return [finDiaET(mediodia - DIA_MS), finDiaET(mediodia)];
}
/**
 * 🎟️ Las diarias del Pase de un día `AAAA-MM-DD`: la primera siempre, y las demás se turnan día por día.
 * ⚠️ LA MISMA CUENTA QUE `diarias_de()` DE `bot/pase.py`: el día como número elige
 */
export function paseDelDia(cfg, dia) {
  const ds = (cfg && cfg.diarias) || [];
  if (!ds.length) return [];
  const resto = ds.slice(1);
  const n = Math.min(Math.max(1, (cfg && cfg.por_dia) || 1) - 1, resto.length);
  const k = diaNum(dia);
  return [ds[0]].concat(Array.from({ length: n }, (_, j) => resto[(k + j) % resto.length]));
}
/** El nivel de una XP: cuántos umbrales alcanza, con tope */
export function nivelDeXP(cfg, xp) {
  let n = 0;
  for (const u of (cfg && cfg.umbrales) || []) if (xp >= u) n++;
  return Math.min(n, (cfg && cfg.niveles) || n);
}
/** Cuántos pasos de la cola lleva una XP: lo que sumó después del último nivel, de a `cola[0]` */
export function paseCola(cfg, xp) {
  const u = (cfg && cfg.umbrales) || [];
  if (!cfg || !cfg.cola || !(cfg.cola[0] > 0) || !u.length || xp < u[u.length - 1]) return 0;
  return Math.min(1000, Math.floor((xp - u[u.length - 1]) / cfg.cola[0]));
}
/**
 * `{actual, maxima, total, inicio, hoy}` de los días `AAAA-MM-DD` de alguien, en orden y sin repetir.
 * La racha sigue viva todo el día de hoy si ayer contó; `inicio` es el primer día de la de ahora.
 * 🛟 Y AGUANTA UN DÍA SIN ENTRAR, UNA VEZ POR SEMANA (Dlx, 13/10/2026, «8. B» del research de los lobbies: «que aguante
 * un día sin entrar»). Es el protector de Duolingo sin comprarlo: un día suelto en blanco no la corta si en los 7 días
 * de antes no se perdonó otro. El día perdonado no suma (la racha cuenta días jugados), y sólo se puede salvar hoy:
 * con ayer en blanco, sigue viva hoy si el perdón de la semana está libre
 */
export const RACHA_PERDON = 7;
export function rachaDeDias(dias, hoy) {
  let maxima = 0, run = 0, prev = null, inicio = '', perdon = null;
  for (const d of dias) {
    const n = diaNum(d);
    if (prev !== null && n === prev + 1) run++;
    else if (prev !== null && n === prev + 2 && (perdon === null || n - perdon > RACHA_PERDON)) { run++; perdon = n; }
    else { run = 1; inicio = d; perdon = null; }
    if (run > maxima) maxima = run;
    prev = n;
  }
  const h = diaNum(hoy);
  const viva = prev !== null && (prev === h || prev === h - 1
    || (prev === h - 2 && (perdon === null || h - perdon > RACHA_PERDON)));
  // 🛡 `gracia`: si el día de perdón de esta semana sigue libre (Dlx, 25/10/2026: «ya existe, sólo mostrarlo»)
  return { actual: viva ? run : 0, maxima, total: dias.length, inicio: viva ? inicio : '', hoy: prev === h,
    gracia: viva && (perdon === null || h - perdon > RACHA_PERDON) };
}
/**
 * 🔥 «TU RACHA SE CORTA HOY» (Dlx, 13/10/2026: «hacer todo», del research de enganche: el recordatorio de la racha es
 * la palanca más fuerte de Duolingo). La racha de `dias` está viva hoy, todavía no entraste, es de `RACHA_AVISO_MIN`
 * días o más y, si hoy no entrás, mañana vale 0: o sea que el día de perdón de esta semana ya se usó. Si todavía lo
 * tenés, no se corta y no se avisa —decir «se corta» sería mentir—. Devuelve la racha (`rachaDeDias()`) o `null`.
 */
export const RACHA_AVISO_MIN = 3;
export function rachaEnPeligro(dias, hoy) {
  const r = rachaDeDias(dias, hoy);
  if (r.hoy || r.actual < RACHA_AVISO_MIN) return null;
  const manana = new Date((diaNum(hoy) + 1) * DIA_MS).toISOString().slice(0, 10);
  return rachaDeDias(dias, manana).actual === 0 ? r : null;
}
/** La hora del este, «HH:MM» (como `enSilencio()`) */
const horaET = (t = Date.now()) => new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', hour: '2-digit',
  minute: '2-digit', hourCycle: 'h23' }).format(new Date(t));
//: desde qué hora del este se avisa la racha: con tiempo para entrar antes de la medianoche, y no a la tarde, cuando
//: todavía puede entrar solo
export const RACHA_AVISO_HORA = '20:00';

/** El nivel con esa experiencia: `{n, xp, base, sig}`. Para el nivel N hacen falta `paso · N · (N − 1)` (`racha.nivel()`) */
export function nivelDeXp(xp, paso = RACHA_CFG.paso) {
  let n = 1;
  while (paso * (n + 1) * n <= xp) n++;
  return { n, xp, base: paso * n * (n - 1), sig: paso * (n + 1) * n };
}

const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
function diaDe(texto) {
  const t = sinTildes(texto);
  for (let i = 0; i < DIAS_JS.length; i++) {
    if (new RegExp('\\b' + DIAS_JS[i] + '\\b').test(t)) return i;
  }
  return null;
}
/** `cuando.dia_del_nombre()`: el día de la semana que dice el NOMBRE del anuncio, o `''`: la fecha cuando el anuncio
 *  no trae una aparte («( DOMINGO - MAÑANA )» en el título de la FAT BATTLES Fecha 4, 12/10/2026) */
export function diaDelNombre(nombre) {
  const d = diaDe(nombre);
  return d == null ? '' : DIAS_JS[d];
}
function horaDe(texto) {
  const t = String(texto || '');
  let h, mi, ap;
  const m = HHMM_RE.exec(t);
  if (m) { h = parseInt(m[1], 10); mi = parseInt(m[2], 10); ap = (m[3] || '').toLowerCase(); } else {
    const n = HH_RE.exec(t);
    if (!n) return null;
    h = parseInt(n[1], 10); mi = 0; ap = (n[3] || '').toLowerCase();
  }
  if (ap === 'p' && h < 12) h += 12;
  else if (ap === 'a' && h === 12) h = 0;
  return h >= 0 && h <= 23 && mi >= 0 && mi <= 59 ? [h, mi] : null;
}
// la hora de pared de `ms` en esa zona, como si fuera UTC, y el día de la semana
function pared(zona, ms) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: zona, hourCycle: 'h23', year: 'numeric',
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short' });
  const p = {};
  for (const x of f.formatToParts(new Date(ms))) p[x.type] = x.value;
  return { ms: Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second),
    wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) };
}
// una hora de pared de esa zona (dada como si fuera UTC) -> el instante UTC
function deLaPared(zona, paredMs) {
  const t1 = paredMs - (pared(zona, paredMs).ms - paredMs);
  return paredMs - (pared(zona, t1).ms - t1);
}
export function horaBandera(horario, publicado, fecha) {
  const t = String(horario || '');
  const b = BANDERA_RE.exec(t);
  const hm = horaDe(t);
  if (!hm) return null;
  // la bandera gana; sin bandera, el país escrito («4 PM COLOMBIA»)
  const cc = b ? String.fromCharCode(b[1].codePointAt(0) - 0x1F1E6 + 65, b[2].codePointAt(0) - 0x1F1E6 + 65)
    : paisEscrito(t);
  if (!cc) return null;
  const zona = ZONA_BANDERA[cc];
  const pub = Date.parse(String(publicado || '').slice(0, 19) + 'Z');
  if (!zona || Number.isNaN(pub)) return null;
  let dia = diaDe(t);
  const f = String(fecha || '').trim();
  if (dia == null && f) {
    dia = diaDe(f);
    if (dia == null && !/^hoy\b/i.test(f)) return null;
  }
  const loc = pared(zona, pub);
  const hoy = loc.ms - (loc.ms % DIA_MS);
  let base = hoy + (dia != null ? ((dia - loc.wd + 7) % 7) * DIA_MS : 0);
  let cand = deLaPared(zona, base + (hm[0] * 60 + hm[1]) * MIN);
  if (cand < pub - HORA) {
    base += (dia != null ? 7 : 1) * DIA_MS;
    cand = deLaPared(zona, base + (hm[0] * 60 + hm[1]) * MIN);
  }
  if (dia == null && cand - pub > 18 * HORA) return null;
  return cand;
}

/** Minutos desde el anuncio hasta el evento; `null` si no se sabe. */
export function desfase(horario) {
  const t = stripPy(horario == null ? '' : horario);
  if (!t) return null;
  if (MEDIA.test(t)) return 30;
  const m = EN.exec(t);
  if (m) {
    const n = parseInt(m[1], 10);
    const u = (m[2] || '').toLowerCase();
    const mins = HORAS.includes(u) ? n * 60 : n;
    return mins > 0 && mins <= TOPE_MIN ? mins : null;
  }
  if (AHORA.test(t)) return 0;
  return null;
}

/**
 * Cuándo arranca, en milisegundos UTC; `null` si no se puede saber.
 * `publicado` es el `timestamp` del mensaje, tal cual lo da Discord.
 *
 * ⚠️ EL MENSAJE SE CORTA AL SEGUNDO, como `cuando[:19]` en Python: sin
 * eso las dos versiones difieren en los milisegundos y la prueba de
 * paridad no puede decir si están de acuerdo.
 */
export function momentoMs(horario, publicado, fecha) {
  const mk = MARCA.exec(String(horario || ''));
  if (mk) return parseInt(mk[1], 10) * 1000;
  const d = desfase(horario);
  // «22:30 🇨🇱»: ver `horaBandera()`, igual que `cuando.hora_bandera()`
  if (d == null) return horaBandera(horario, publicado, fecha);
  const t = Date.parse(String(publicado || '').slice(0, 19) + 'Z');
  return Number.isNaN(t) ? null : t + d * MIN;
}

// ═════════════════════════════════════════════════════════════════════
// WEB PUSH — RFC 8291 (cifrado) y RFC 8292 (VAPID)
// ═════════════════════════════════════════════════════════════════════

export const b64u = {
  enc(bytes) {
    let s = '';
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  dec(str) {
    let s = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
};
const utf8 = (s) => new TextEncoder().encode(s);
function junta(...partes) {
  const out = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of partes) { out.set(p, o); o += p.length; }
  return out;
}

async function hkdf(sal, ikm, info, bytes) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: sal, info }, k, bytes * 8));
}

/**
 * El cuerpo cifrado de una notificación (RFC 8291 §3, con `aes128gcm`).
 *
 * `fijo` es SOLO para la prueba contra el ejemplo del RFC: la clave
 * efímera y la sal. En uso real las dos son nuevas en cada mensaje.
 */
export async function cifrar(texto, p256dh, auth, fijo) {
  const uaPub = b64u.dec(p256dh);
  const secreto = b64u.dec(auth);
  const sal = fijo ? fijo.sal : crypto.getRandomValues(new Uint8Array(16));
  const as = fijo ? fijo.par : await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey(
    'raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(secreto, ecdh,
    junta(utf8('WebPush: info\x00'), uaPub, asPub), 32);
  const cek = await hkdf(sal, ikm, utf8('Content-Encoding: aes128gcm\x00'), 16);
  const nonce = await hkdf(sal, ikm, utf8('Content-Encoding: nonce\x00'), 12);
  const clave = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // 0x02: «último registro, sin relleno» (RFC 8188 §2)
  const claro = junta(typeof texto === 'string' ? utf8(texto) : texto,
    new Uint8Array([2]));
  const cifrado = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce }, clave, claro));
  // cabecera: sal (16) · tamaño de registro (4) · largo del id (1) · id (65)
  const cab = new Uint8Array(86);
  cab.set(sal, 0);
  new DataView(cab.buffer).setUint32(16, 4096);
  cab[20] = 65;
  cab.set(asPub, 21);
  return junta(cab, cifrado);
}

async function clavePrivada(env) {
  const pub = b64u.dec(env.VAPID_PUBLICA);
  return crypto.subtle.importKey('jwk', {
    kty: 'EC', crv: 'P-256', d: env.VAPID_PRIVADA,
    x: b64u.enc(pub.slice(1, 33)), y: b64u.enc(pub.slice(33, 65)),
  }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

/**
 * El JWT de VAPID para un servicio de push (`aud` = su origen).
 *
 * ⚠️ VENCE EN UNA HORA. El RFC permite hasta 24, pero Apple es la más
 * estricta de las tres y se firma uno por lote de todas formas.
 * ⚠️ `sub` ES LA URL DEL HUB, no un mail: Apple pide `mailto:` o `https:`
 * y un mail acá sería un dato personal viajando en cada notificación.
 */
export async function jwtVapid(aud, env, ahora = Date.now()) {
  const cab = b64u.enc(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const cuerpo = b64u.enc(utf8(JSON.stringify(
    { aud, exp: Math.floor(ahora / 1000) + 3600, sub: HUB })));
  const firma = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, await clavePrivada(env),
    utf8(cab + '.' + cuerpo)));
  return cab + '.' + cuerpo + '.' + b64u.enc(firma);
}

/**
 * Manda UNA notificación y devuelve el estado HTTP.
 *
 * ⚠️ `0` Y `-1` NO SON LO MISMO. `0` es que no hubo red —se reintenta—;
 * `-1` es que falló ACÁ: la clave VAPID, el cifrado, una URL rota. Con un
 * solo código, una clave mal cargada se vería como «Google no contesta».
 */
async function empujar(sub, texto, opc, env, jwts, detalle) {
  let h, cuerpo;
  try {
    const aud = new URL(sub.endpoint).origin;
    // una firma por servicio y por lote, no una por persona
    if (!jwts.has(aud)) jwts.set(aud, jwtVapid(aud, env));
    h = {
      TTL: String(opc.ttl),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      Authorization: `vapid t=${await jwts.get(aud)}, k=${env.VAPID_PUBLICA}`,
      // ⚠️ `high` despierta al teléfono aunque esté ahorrando batería:
      // es un aviso con hora, no un boletín.
      Urgency: opc.urgencia || 'high',
    };
    // 🔴 APPLE RECHAZA EL `Topic` Y RECHAZA EL AVISO ENTERO. Medido el
    // 25/09/2026 con el iPhone de Dlx: `400 {"reason":"BadWebPushTopic"}`
    // para «ev1552973488204152833» y también para «ev5967769», cortos y sólo
    // letras y números. «Mandar una de prueba» no lleva `Topic`, y por eso
    // eso sí le llegaba y los avisos de eventos no: NINGÚN aviso del lote le
    // había llegado nunca a un iPhone. A Apple va sin él; Google lo usa para
    // que un aviso nuevo reemplace al viejo si el teléfono estaba apagado.
    if (opc.topic && !/(^|\.)push\.apple\.com$/.test(new URL(sub.endpoint).hostname)) {
      h.Topic = opc.topic;
    }
    cuerpo = await cifrar(texto, sub.p256dh, sub.auth);
  } catch (e) {
    return -1;
  }
  try {
    const r = await fetch(sub.endpoint, { method: 'POST', headers: h, body: cuerpo });
    // 🔑 LA RAZÓN DEL RECHAZO, NO SÓLO EL NÚMERO. El 25/09/2026 el iPhone de
    // Dlx recibía «Mandar una de prueba» y no los avisos del lote: dos 400
    // sin texto no dicen qué encabezado no le gustó al servicio de push.
    if (detalle && r.status >= 400) {
      let razon = '';
      try { razon = (await r.text()).slice(0, 160); } catch (e) { razon = ''; }
      let host = '';
      try { host = new URL(sub.endpoint).hostname; } catch (e) { host = ''; }
      detalle.push({ host, estado: r.status, razon });
    }
    return r.status;
  } catch (e) {
    return 0;
  }
}

// 🔴 SOLO 404 Y 410 BORRAN. La primera versión borraba también con 403
// —«es de otra clave»— y eso es un gatillo para vaciar la tabla: un JWT
// mal firmado por un bug nuestro hace que Google conteste 403 a TODOS, y
// en una sola vuelta se iban todas las suscripciones. 404/410 dicen que
// esa suscripción no existe más; 403 dice que algo está mal, quizás acá.
const MUERTA = (e) => e === 404 || e === 410;

// ═════════════════════════════════════════════════════════════════════
// LA RE-PUBLICACION EN `eventos-hoy`
// ═════════════════════════════════════════════════════════════════════

/**
 * El mensaje que el bot deja en `eventos-hoy` por cada anuncio nuevo.
 *
 * ⚠️ SOLO EMBED, SIN TEXTO. El lector de anuncios —el de acá y el de
 * Python— lee `content`; un mensaje sin texto no se puede confundir con un
 * anuncio, y así el eco del bot no vuelve a entrar como evento nuevo.
 * ⚠️ LA HORA VA COMO MARCA DE DISCORD (`<t:…>`): cada uno la ve en su
 * zona —Dlx en hora del este, el resto de la Liga en la suya—.
 * ⚠️ SIN MENCIONES (`allowed_mentions: []`): esto no hace ping a nadie; el
 * ping de rol de cada servidor sigue siendo el suyo.
 */
export function mensajeRed(c) {
  const seg = c.ini ? Math.floor(c.ini / 1000) : 0;
  const lineas = [`**${c.svn || c.sv}** · ${c.sv}`];
  if (seg) lineas.push(`⏰ Empieza <t:${seg}:R> · <t:${seg}:t>`);
  const extra = [c.mod && `🎤 ${c.mod}`, c.cup && `🎟️ cupos: ${c.cup}`,
    c.pre && `🏅 ${c.pre}`].filter(Boolean);
  if (extra.length) lineas.push(extra.join(' · '));
  // 🔑 «INSCRIBITE YA», NO EL LINK AL MENSAJE (Dlx, 03/10/2026: «que sea el link de invitación al canal… el de
  // inscripciones mejor… porque la gente no puede entrar de esa forma»): un link a un mensaje sólo abre si ya estás en
  // ese servidor, y quien mira `eventos-hoy` casi nunca lo está. `c.ins` lo pone `publicar()` (ver `invitacionPara()`);
  // sin invitación al canal de inscripciones, la del servidor; sin ninguna, el anuncio, como antes
  const ins = c.ins && c.ins.url ? c.ins : null;
  const boton = ins && ins.tipo === 'inscribir' ? { type: 2, style: 5, label: 'Inscribite ya', emoji: { name: '✍️' }, url: ins.url }
    : ins ? { type: 2, style: 5, label: 'Entrar al servidor', url: ins.url }
      : { type: 2, style: 5, label: 'Ir al anuncio', url: c.url };
  return {
    allowed_mentions: { parse: [] },
    embeds: [{
      title: ('🏆 ' + (c.t || 'Nuevo evento')).slice(0, 256),
      url: boton.url,
      description: lineas.join('\n').slice(0, 4000),
      color: 0x29B298,
      footer: { text: 'Liga Global · se publica solo, al minuto de anunciarse',
        icon_url: HUB + '/aviso.png' },
    }],
    components: [{
      type: 1,
      components: [
        boton,
        { type: 2, style: 5, label: 'Avisos en tu teléfono', emoji: { name: '🔔' }, url: HUB_AVISOS },
      ],
    }],
  };
}

/**
 * Adónde lleva «Inscribite ya»: la invitación permanente al canal donde se anota ESE evento. Primero la del mismo canal
 * del anuncio (DRA se anota con el botón de la tarjeta, ahí mismo); si no, la del canal de inscripciones de la misma
 * categoría —Urban tiene uno para sus torneos y otro para la Red Bull Cabrana—; si no, la primera del servidor. Sin
 * ninguna, la invitación del servidor (`tipo: 'servidor'`). Las crea `bot/invitaciones.py --inscripciones` y viajan en
 * `meta` (`inscribir`: `{sv: [[canal, categoría, código]]}`; `invita`: `{sv: url}`).
 */
export function invitacionPara(c, canales, meta) {
  const cid = (/\/channels\/\d+\/(\d+)/.exec(String((c && c.url) || '')) || [])[1] || '';
  const ch = ((canales && canales.lista) || []).find((x) => String(x.id) === cid) || null;
  const p = ch ? String(ch.p || '') : '';
  const ops = ((meta && meta.inscribir) || {})[c && c.sv] || [];
  const o = ops.find((x) => String(x[0]) === cid) || ops.find((x) => p && String(x[1]) === p) || ops[0];
  if (o && o[2]) return { url: 'https://discord.gg/' + o[2], tipo: 'inscribir' };
  const inv = ((meta && meta.invita) || {})[c && c.sv];
  return inv ? { url: inv, tipo: 'servidor' } : null;
}

// 🔴 LOS AVISOS POR MENSAJE DIRECTO SE SACARON (25/09/2026). `/notify`
// nació esa mañana mandando DMs, y Dlx lo corrigió a la tarde: *«no debería
// usar el bot para enviarte DMs, sino activar la notificación al celular o
// dispositivo»*. Se fueron con 0 anotados. Ahora `/notify` lleva a la campana
// de la página con el servidor ya elegido (`#/avisos/<SV>`, ver `campana.js`),
// y el único camino de un aviso es el push de este objeto.

// ═════════════════════════════════════════════════════════════════════
// LA ALTA: qué suscripción se acepta
// ═════════════════════════════════════════════════════════════════════

// ⚠️ SOLO SERVICIOS DE PUSH DE VERDAD. Sin esto, el Worker sería un
// cañón: cualquiera podría registrar una URL suya y hacer que le peguemos
// cada vez que hay un evento.
const SERVICIOS = [
  /^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/, /\.push\.apple\.com$/,
  /\.notify\.windows\.com$/,
];

export function suscripcionValida(sub) {
  if (!sub || typeof sub.endpoint !== 'string' || sub.endpoint.length > 1024) {
    return 'falta el endpoint';
  }
  let u;
  try { u = new URL(sub.endpoint); } catch (e) { return 'endpoint roto'; }
  if (u.protocol !== 'https:') return 'endpoint sin https';
  if (!SERVICIOS.some((r) => r.test(u.hostname))) return 'no es un servicio de push';
  const k = sub.keys || {};
  let p, a;
  try { p = b64u.dec(k.p256dh); a = b64u.dec(k.auth); } catch (e) { return 'claves rotas'; }
  if (p.length !== 65 || p[0] !== 4) return 'p256dh inválida';
  if (a.length !== 16) return 'auth inválida';
  return '';
}

// ═════════════════════════════════════════════════════════════════════
// LO QUE VE EL WORKER
// ═════════════════════════════════════════════════════════════════════

const json = (d, estado = 200, cache = 0) => new Response(JSON.stringify(d), {
  status: estado,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': cache ? `public, max-age=${cache}` : 'no-store',
  },
});

const RUTAS = {
  '/avisos/clave': 'GET', '/avisos/estado': 'GET',
  // 🔑 las llaves que se están jugando, para la página (ver `llaves()` del objeto)
  '/avisos/vivo': 'GET',
  '/avisos/alta': 'POST', '/avisos/baja': 'POST', '/avisos/probar': 'POST',
  '/avisos/simular': 'POST',
  // 🔑 los avisos de cada uno: ver `vincular()` y `personales()` del objeto
  '/avisos/vincular': 'POST', '/avisos/desvincular': 'POST',
  // 🔑 las encuestas de la página: ver `validarVoto()` y `votar()` del objeto
  '/avisos/encuestas': 'GET', '/avisos/votar': 'POST',
  // 🗳️ «¿quién gana la liga?» (14/10/2026): cuántos votos lleva cada uno, y votar. Ver `validarVotoLiga()` y `ligaVotar()`
  '/avisos/ligas-votos': 'GET', '/avisos/liga-votar': 'POST',
  // 🔔 seguir una liga (17/10/2026): la campana avisa cuando hay resultados o una fecha nueva. Ver `ligaSeguir()`
  '/avisos/liga-seguir': 'POST', '/avisos/mis-ligas': 'POST',
  // 🔑 un error en una llave (Dlx, 28/09/2026: «ok»): ver `validarReporte()` y `reportar()`
  '/avisos/reportar': 'POST',
  // 🔑 el precio por cabeza: ver `validarPrecio()`, `precio()` y `billetera()`
  '/avisos/precios': 'GET', '/avisos/precio': 'POST', '/avisos/billetera': 'POST',
  // 🔑 seguir raperos: ver `seguir()`, `sigo()`, `seguidores()` y `seguidos()`
  '/avisos/seguir': 'POST', '/avisos/sigo': 'POST', '/avisos/seguidores': 'GET',
  // 📖 las historias que viste, en tu cuenta (18/10/2026): ver `historiasVistas()` del objeto
  '/avisos/historias': 'POST',
  // 🔑 «tu servidor»: elegirlo en Mi cuenta, y cuál eligió cada perfil. Ver `miServidor()`
  '/avisos/mi-servidor': 'POST', '/avisos/servidores': 'GET',
  // 👥 LAS CREWS QUE ARMA LA GENTE (19/10/2026, bot/crews.js): todas (pública), una acción, la tuya; lo del dueño, y las
  // 34 de antes, una vez, con la clave del ciclo
  '/avisos/crews': 'GET', '/avisos/crew': 'POST', '/avisos/crew-mia': 'POST', '/avisos/dueno/crew': 'POST',
  '/avisos/crews-sembrar': 'POST',
  // 🪪 los de las crews que no están verificados, con la clave del ciclo (`bot/crews_verificar.py`)
  '/avisos/crews-verificar': 'POST',
  // 🏆 el cierre de los tiers de las crews, a la campana de su gente (`bot/crews_tiers.py`, con la clave del ciclo)
  '/avisos/crews-tiers': 'POST',
  // 📊 el panel de un socio Tier 1 o 2, para su dueño (19/10/2026). Ver `panelSocio()` del objeto
  '/avisos/panel-socio': 'POST',
  // ⚙️ los ajustes del bot de ese servidor, desde el panel del socio (19/10/2026). Ver `socioAjustes()` del objeto
  '/avisos/socio-ajustes': 'POST',
  // 🗳️ a quién votó el público como ganador en el bot en vivo, sumado por nombre (público: sin ningún Discord ID)
  '/avisos/favoritos': 'GET',
  // 📊 una visita sin cuenta, una vez por día y por navegador (04/10/2026). Ver `visita()` del objeto
  '/avisos/visita': 'POST',
  // 🧭 el tutorial (12/10/2026): qué vio y qué terminó un navegador, sin nada de nadie. Ver `tutorial()` del objeto
  '/avisos/tutorial': 'POST',
  // 📊 qué secciones se abren (12/10/2026): una por navegador y por día, sin nada de nadie. Ver `seccion()` del objeto
  '/avisos/seccion': 'POST',
  // 👆 qué se toca en toda la página (16/10/2026): la sección y el nombre del botón, sumados, sin nada de nadie
  '/avisos/clics': 'POST',
  // 🐞 un error de la página, para el Dashboard (19/10/2026): nunca de quién
  '/avisos/error': 'POST',
  // 🔒 el Dashboard del dueño (04/10/2026): ver `/avisos/dueno` en `rutaAvisos()`
  '/avisos/dueno': 'POST',
  // 🔴 lo que avisó el canal de Logs, para el Dashboard (`logsRojos()`)
  '/avisos/dueno-logs': 'POST',
  // 🙋 LOS PEDIDOS DE LA GENTE (17/10/2026): perdí mi cuenta, ese no soy yo, mi país, un video que no es mío. Ver `pedir()`
  '/avisos/pedido': 'POST', '/avisos/mis-pedidos': 'POST', '/avisos/dueno-pedido': 'POST',
  // y para el ciclo, con su clave: lo aprobado que hay que aplicar, cómo salió, y pasar lo de una cuenta a otra
  '/avisos/pedidos-ciclo': 'GET', '/avisos/pedidos-estados': 'POST', '/avisos/mudar-cuenta': 'POST',
  // y lo que el ciclo averiguó de la cuenta VIEJA de un «perdí mi cuenta» (`pedidosPrueba()`)
  '/avisos/pedidos-prueba': 'POST',
  // 🤝 el puntaje de cada servidor para «Los tiers» del Dashboard (`bot/tiers.py`): lo manda el ciclo, con su clave
  '/avisos/tiers-ciclo': 'POST',
  // 🔁 quién jugó una sola vez y quién se enfrió, con nombre (`bot/primerizos.py`, con su clave): sólo al Dashboard
  '/avisos/primerizos-ciclo': 'POST',
  // 🧪 y a quién se avisó y quién quedó sin aviso, para medir si sirve (con su clave)
  '/avisos/vuelve-ciclo': 'GET',
  // 🔁 y avisarle a uno de ésos por su campana, con un texto de la lista (`PLANTILLAS_VUELVE`): ver `avisoVuelve()`
  '/avisos/dueno/vuelve': 'POST',
  // 🤝 el anti-raid que prende Dlx en un servidor (con la clave del ciclo): ver `antiraidDlx()`
  '/avisos/antiraid-dlx': 'POST',
  // ⚙️ un ajuste del Dashboard (sólo Dlx) y los ajustes para el ciclo (con su clave)
  '/avisos/dueno/ajuste': 'POST', '/avisos/ajustes': 'GET',
  // ▶️ correr el ciclo ahora, desde el Dashboard (sólo Dlx): ver `cicloAMano()`
  '/avisos/dueno/ciclo': 'POST',
  // 🙈 «ocultar mi foto»: en Mi cuenta → Privacidad. Ver `miFoto()`
  '/avisos/mi-foto': 'POST',
  // 👏 felicitar un logro de Publicaciones, y cuántos lleva cada uno: ver `validarAplauso()` y `aplaudir()`
  '/avisos/felicitar': 'POST', '/avisos/aplausos': 'GET',
  // 📣 abrir una promo paga Tienda y XP: ver `validarPromo()` y `promoVio()`
  '/avisos/promo-vio': 'POST',
  // 📣 una semana más de tu promo, desde la Tienda (`validarExtender()`, `promoExtender()`); y hasta cuándo va cada una
  '/avisos/promo-extender': 'POST', '/avisos/promos-extra': 'GET',
  // 🏆 cuánta gente abrió cada promo, para la Promo del mes (`bot/mes_otros.py`). Nunca quién
  '/avisos/promos-vistas': 'GET',
  // 🔔 el panel de la campana: lo que se te avisó, con tu sesión. Ver `bandeja()`
  '/avisos/bandeja': 'POST',
  // 🔥 tu racha diaria y tu nivel, con tu sesión; y el nivel y la racha de cada perfil. Ver `rachaDe()` y `niveles()`
  '/avisos/racha': 'POST', '/avisos/niveles': 'GET',
  // 🎁 el premio de la semana, con tu sesión: ver `semanal()`
  '/avisos/semanal': 'POST',
  // 🔑 las inscripciones que guardó el vigía, para el ciclo: con `claveCiclo()`
  '/avisos/inscritos': 'GET',
  // 🖼️ el texto de un anuncio que es una imagen, para el ciclo: con `claveCiclo()`. Ver `textoDeImagen()`
  '/avisos/ocr': 'POST',
  // 🎟️ el Pase de rapero: el tuyo y «miré una llave en vivo», con tu sesión; el nivel de cada perfil; y lo del ciclo,
  // con su clave. Ver `paseDe()`, `paseVivo()`, `pases()` y `paseCiclo()`
  '/avisos/pase': 'POST', '/avisos/pase-vivo': 'POST', '/avisos/pases': 'GET', '/avisos/pase-ciclo': 'POST',
  // 🎟️ (25/10/2026) tus avisos del Pase y tu color premium, con tu sesión; el sorteo del premium (público) y entrar a él
  '/avisos/pase-avisos': 'POST', '/avisos/pase-color': 'POST', '/avisos/sorteo': 'POST', '/avisos/sorteo-entrar': 'POST',
  // 🖼️ tus marcos de carta y elegir cuál llevar, con tu sesión
  '/avisos/marcos': 'POST', '/avisos/marco-elige': 'POST',
  // 🏷️ tus TAGs y elegir cuál lleva cada carta (con tu sesión), y el inventario del ciclo (con su clave)
  '/avisos/tags-mios': 'POST', '/avisos/tag-elige': 'POST', '/avisos/tags-ciclo': 'POST',
  // 🎟️ quién tiene nivel en el Pase, para el ciclo (la Temporada es el premio del nivel 1): con `claveCiclo()`
  '/avisos/pase-niveles': 'GET',
  // 🧠 los datos de cada persona para /card, que viven en el objeto desde el 06/10/2026: los escribe y los lee el
  // ciclo, con `claveCiclo()`. Ver `personasCiclo()`
  '/avisos/personas-ciclo': 'POST', '/avisos/personas-leer': 'GET',
  // 💬 el chat de cada servidor, donde habla el bot en vivo: el ciclo manda ahí el aviso de cada evento. Ver `canalesChat()`
  '/avisos/chat-canales': 'GET',
  // 🏆 el cierre del bot en vivo y el aviso del ciclo, en UN mensaje (13/10/2026): con `claveCiclo()`. Ver `cierreVivo()`
  '/avisos/cierre-vivo': 'POST',
  // 🏁 quién ganó cada final que se preguntó con botones, para el ciclo: con `claveCiclo()`. Ver `finalElegir()`
  '/avisos/finales': 'GET',
  // 🧰 la imagen de /afiche o /llave ya dibujada (`bot/kit.py`), con `claveCiclo()`. Ver `kitListo()`
  '/avisos/kit-listo': 'POST',
  // 🖼️ los vs que esperan su imagen y la imagen ya dibujada (`bot/kit.py --tipo vs`), con `claveCiclo()`. Ver `vsCola()`
  '/avisos/vs-cola': 'GET', '/avisos/vs-listo': 'POST',
  // 🎬 tus batallas en video (12/10/2026): pedir un link o un canal, ver tus pedidos y quitar uno, con tu sesión y
  // verificado; reportar el de otro; lo del ciclo, con su clave; y aprobar lo raro, sólo Dlx. Ver `misVideos()`
  '/avisos/mis-videos': 'POST', '/avisos/video-reportar': 'POST',
  '/avisos/videos-ciclo': 'GET', '/avisos/videos-estados': 'POST', '/avisos/dueno/video': 'POST',
  // 📅 lo agendado con /agendar, para el ciclo: con su clave. Ver `agendar()`
  '/avisos/agenda-ciclo': 'GET',
  // 🏆 el Hincha del mes (`bot/mes_otros.py`): quién más participó en la página, para el ciclo y con su clave
  '/avisos/hinchas': 'GET',
  // 📣 qué hacer con un reporte de una llave (13/10/2026, Dlx: «Sí, todas»): lo decide Dlx desde el Dashboard y el
  // ciclo, con su clave, avisa lo que aplicó. Ver `validarDecisionReporte()`, `duenoReporte()` y `reportesEstados()`
  '/avisos/dueno/reporte': 'POST', '/avisos/reportes-estados': 'POST',
  // 👀 quién está mirando qué caso de Pendientes (25/10/2026). Ver `duenoViendo()`
  '/avisos/dueno/viendo': 'POST',
  // 🗂️ la ficha de una persona para el staff, y las notas del staff sobre ella (25/10/2026). Ver `duenoFicha()`
  '/avisos/dueno/ficha': 'POST', '/avisos/dueno/nota': 'POST',
  // ✅ Decidir en el Dashboard (13/10/2026, Dlx: «Sí, con Reportes»): el ciclo publica las preguntas y lee lo
  // contestado, con su clave; Dlx contesta. Ver `validarRespuestaDecidir()`, `decidirEstados()` y `duenoDecidir()`
  '/avisos/decidir-ciclo': 'GET', '/avisos/decidir-estados': 'POST', '/avisos/dueno/decidir': 'POST',
  // 🏷️ los roles de cada uno en la página (13/10/2026): los ve cualquiera; el ciclo manda los que salen solos, con su
  // clave, y Dlx pone o saca. Ver `roles()`, `rolesEstados()` y `duenoRol()`
  '/avisos/roles': 'GET', '/avisos/roles-estados': 'POST', '/avisos/dueno/rol': 'POST',
  // 🖼️ tu fondo (13/10/2026): subirlo y elegir dónde se ve (con tu sesión), los aprobados (cualquiera) y revisarlos (Dlx).
  // Ver `fondo()`, `fondos()` y `duenoFondo()`
  '/avisos/fondo': 'POST', '/avisos/mi-fondo': 'POST', '/avisos/fondos': 'GET', '/avisos/dueno/fondo': 'POST',
  // 📸 tu foto de tarjeta (13/10/2026). Ver `fotoCarta()`
  '/avisos/foto-carta': 'POST', '/avisos/mi-foto-carta': 'POST', '/avisos/dueno/foto-carta': 'POST',
  // 📣 seguir a un organizador, con tu sesión. Ver `seguirOrg()`
  '/avisos/seguir-org': 'POST',
};

// ── los anuncios que son una imagen ────────────────────────────────────
// 🖼️ Dlx, 05/10/2026: *«¿no puedes hacer una forma para detectar lo que dicen las imágenes?»*. La ACADEMIA anuncia
// con un afiche y nada más («@everyone» y la imagen): VALHALLA VOL1 —7 PM Chile, domingo 4 de octubre, 10 dólares—
// no llegó ni al calendario. La imagen la lee la IA de Cloudflare (el binding `AI`, sin token nuevo: lo pone
// `bot/desplegar.py`) y el texto vuelve al ciclo, que lo pasa por el mismo lector que a cualquier anuncio
// (`bot/anuncios.py`).
//
// ⚠️ SÓLO CON LA CLAVE DEL CICLO, y la imagen la manda el ciclo: él la baja de Discord achicada (640 px de ancho en
// JPEG, el proxy de Discord lo hace) y la sube en el cuerpo. 🔴 EL WORKER NO PUEDE BAJARLA: el proxy de Discord le
// contesta 403 a Cloudflare (medido el 05/10/2026). Y los 2,8 MB del original costarían CPU que el Worker no tiene.
export const OCR_MAX = 700000;
/** El tipo de una imagen por sus primeros bytes (JPEG, PNG o WebP), o `''`: el `content-type` lo pone quien manda. */
export function tipoImagen(b) {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length > 12 && String.fromCharCode(b[0], b[1], b[2], b[3]) === 'RIFF'
      && String.fromCharCode(b[8], b[9], b[10], b[11]) === 'WEBP') return 'image/webp';
  return '';
}
export const OCR_MODELO = '@cf/meta/llama-4-scout-17b-16e-instruct';
export const OCR_PEDIDO = 'Copia TODO el texto que se lee en esta imagen, renglón por renglón y tal cual está escrito '
  + '(mayúsculas, números, horas, fechas, signos). No describas la imagen ni agregues nada tuyo. '
  + 'Si no hay texto, contesta NADA.';
// 🏆 LA LLAVE QUE ES UNA IMAGEN (Dlx, 07/10/2026: «ya deberías poder reconocer las imágenes, ¿no?»): la IA la copia en
// el formato que lee `bot/escuchar.py` —las rondas, o las dos llaves de la doble eliminación con «MATCH N: A vs B»— y
// el ciclo la lee como cualquier otra. Sólo transcribe: quién ganó lo decide el lector por dónde sigue cada uno
export const OCR_PEDIDO_LLAVE = 'Esta imagen es la llave (bracket) de un torneo. Copia cada cruce que tenga nombres, '
  + 'con los nombres EXACTAMENTE como están escritos, en este formato y nada más:\n'
  + 'el título del torneo en el primer renglón, si se ve;\n'
  + 'si es de doble eliminación, un renglón «WINNER BRACKET» y abajo «MATCH 1: A vs B» por cada cruce, en orden de '
  + 'número; después «LOSER BRACKET» con los suyos; después «GRAN FINAL» con el suyo (o los dos, si hay revancha). '
  + 'Cada MATCH va UNA sola vez: la gran final es la que juegan el que ganó la llave de ganadores y el que ganó la de '
  + 'perdedores, aunque esté dibujada al lado de otra;\n'
  + 'si es de eliminación simple, el nombre de cada ronda (OCTAVOS, CUARTOS, SEMIFINALES, FINAL) UNA sola vez, y abajo '
  + 'todos sus cruces «A vs B», aunque la llave esté dibujada en dos mitades;\n'
  + 'SÓLO si la imagen tiene escrita la palabra CAMPEÓN (o GANADOR o WINNER) con un nombre, un último renglón '
  + '«CAMPEÓN: nombre». Quién ganó la final NO se deduce: si no está escrito, ese renglón no va.\n'
  + 'Un cruce sin nombres no se escribe. Un lado vacío se escribe «?». No inventes nombres ni describas la imagen. '
  + 'Si no es la llave de un torneo, contesta NADA.';

//: la segunda pregunta, cuando la copia de una llave trae campeón (ver `textoDeImagen()`)
export const OCR_VERIFICA_CAMPEON = '¿Esta imagen tiene ESCRITA la palabra CAMPEÓN, CAMPEON, GANADOR o WINNER? '
  + 'Responde sólo SI o NO.';

export async function textoDeImagen(env, buf, cual = 'afiche') {
  const tipo = tipoImagen(buf);
  if (!tipo) throw new Error('no es una imagen');
  const llave = cual === 'llave';
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  const sal = await env.AI.run(OCR_MODELO, {
    messages: [{ role: 'user', content: [
      { type: 'text', text: llave ? OCR_PEDIDO_LLAVE : OCR_PEDIDO },
      { type: 'image_url', image_url: { url: 'data:' + tipo + ';base64,' + btoa(bin) } },
    ] }],
    max_tokens: llave ? 1500 : 600, temperature: 0,
  });
  let t = String((sal && (sal.response != null ? sal.response : (sal.result || {}).response)) || '').trim();
  // 🔴 LA IA INVENTA AL CAMPEÓN (12/10/2026): la llave de MATANZA DE DIOSES del Ciclo 16 (Snake Rap) anunciaba la final
  // Rubik vs Zeta ANTES de jugarse, sin ningún campeón dibujado, y la copia terminó en «CAMPEÓN: Rubik». Con un campeón
  // inventado el evento entra al ranking con el podio equivocado. Si la copia trae campeón, una segunda pregunta, corta
  // y de sí o no, sobre la misma imagen: si la palabra no está escrita, ese renglón se va
  if (llave && /CAMPE[OÓ]N\s*:/i.test(t)) {
    const v = await env.AI.run(OCR_MODELO, {
      messages: [{ role: 'user', content: [
        { type: 'text', text: OCR_VERIFICA_CAMPEON },
        { type: 'image_url', image_url: { url: 'data:' + tipo + ';base64,' + btoa(bin) } },
      ] }],
      max_tokens: 5, temperature: 0,
    });
    const r = String((v && (v.response != null ? v.response : (v.result || {}).response)) || '').trim();
    if (!/^s[ií]/i.test(r)) t = t.split('\n').filter((l) => !/CAMPE[OÓ]N\s*:/i.test(l)).join('\n');
  }
  return { texto: /^nada\.?$/i.test(t) ? '' : t.slice(0, 3000), modelo: OCR_MODELO };
}

// ── seguir raperos ─────────────────────────────────────────────────────
// 🔑 Dlx, 28/09/2026, a «¿guardar de verdad a quién seguís?»: *«sí, hay que
// hacer eso»*. Seguir existía desde el 25/09 (`lg:sigo`) pero quedaba en el
// navegador: nadie sabía que lo seguías y no te llegaba nada. Ahora, con
// «Entrar con Discord», se guarda en el objeto (tabla `sigue`), cuenta
// seguidores y te avisa por la campana —NUNCA por DM— cuando alguien que
// seguís sale en Publicaciones: ganó, subió de rango, desbloqueó una tarjeta…
//
// ⚠️ AFUERA SE VE CUÁNTOS, NUNCA QUIÉN: `/avisos/seguidores` cuenta. Quién te
// sigue lo ve sólo el dueño (`sigo()`), y sólo los que son raperos.
// ⚠️ SIN KV NUEVO: qué pasó y de quién lo lee el vigía del muro que el ciclo
// ya sube (`web:muro`, con la clave de cada persona: ver `bot/muro.py`).

//: cuántos puede seguir una persona
export const SIGUE_TOPE = 200;
//: de cuántas horas atrás se avisa una publicación a quien sigue a esa persona
export const SIGUE_HORAS = 24;
//: 🔔 el id de una liga (`bot/ligas.py`: `fmh-espana`, `fzl`)
export const LIGA_ID = /^[a-z0-9][a-z0-9-]{1,39}$/;
//: cuántas ligas puede seguir una persona (hoy son 13: alcanza para todas)
export const LIGAS_SEGUIR_TOPE = 30;
//: cuántos envíos al celular por vuelta del vigía, como `TOPE_SEGUIDOS`
export const TOPE_LIGAS = 8;
//: cuántos envíos por invocación del vigía: comparte los 50 subpedidos
export const TOPE_SEGUIDOS = 8;
// ⭐ «ALGUIEN TE SIGUE» (Dlx, 02/10/2026: «que le lleguen las notificaciones, además de cuando te sigan…»): a quien
// siguen le llega un aviso de la página, nunca por DM. Ver `avisarSeguidores()`.
//: espera esto antes de avisar: junta a los que siguen a la vez, y un seguir-y-dejar no suena
export const SEGUIDOR_ESPERA = 10 * MIN;
//: y a la misma persona, como mucho un aviso por hora (lo que llega en el medio sale junto en el siguiente)
export const SEGUIDOR_ENTRE = HORA;
//: cuántos envíos por invocación del vigía
export const TOPE_NUEVOS_SEGUIDORES = 6;

/**
 * Lo que dice el aviso de «alguien te sigue». El nombre, sólo si es uno solo y es de la Liga: es lo mismo que esa
 * persona ve en Mi cuenta (quién te sigue, si es rapero); si no, cuántos.
 */
export function avisoSeguidores(n, nombre) {
  const t = n === 1 ? (nombre ? `⭐ ${nombre} empezó a seguirte` : '⭐ Alguien nuevo te sigue') : `⭐ ${n} personas nuevas te siguen`;
  return { titulo: t.slice(0, 120), cuerpo: 'Toca para ver quién te sigue.' };
}
//: lo que dice cada tarjeta en un aviso, como `NOMBRE` de `bot/avisos_personales.py`
const CARTA_AVISO = { temporada: 'de Temporada', competitivo: 'Competitiva', pais: 'de País', servidor: 'de Servidor' };

/**
 * ¿Es la clave de un perfil (`#/r/<clave>`)? Letras y números de cualquier
 * alfabeto —`comun/claves.py`— y el `-cc` de dos personas con el mismo
 * nombre (`_choques()` de `bot/subir_web.py`).
 */
export function claveValida(k) {
  return typeof k === 'string' && k.length >= 1 && k.length <= 60 && /^[\p{L}\p{N}][\p{L}\p{N}-]*$/u.test(k);
}

/** Un número corto y estable para un texto (FNV-1a de 32 bits). */
function huella(s) {
  let h = 0x811c9dc5;
  for (const ch of String(s)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/** El título del aviso de una publicación del muro, para quien sigue a `n`; `''` si no se avisa. */
export function tituloSeguido(x, n, rol) {
  const ev = String(x.ev || '').slice(0, 60);
  const t = x.tipo === 'campeon' ? `🏆 ${n} ${(x.quien || []).length > 1 ? 'y su equipo ganaron' : 'ganó'} ${ev}`
    : x.tipo === 'rango' ? (x.primero ? `🎖️ ${n} ya tiene rango: ${x.rg}` : `⬆️ ${n} subió a rango ${x.rg}`)
      : x.tipo === 'tarjeta' ? (CARTA_AVISO[x.carta] ? `🃏 ${n} desbloqueó su tarjeta ${CARTA_AVISO[x.carta]}` : '')
        : x.tipo === 'caza' ? `🎯 ${n} cazó a ${x.a}${ev ? ' en ' + ev : ''}`
          : x.tipo === 'sobrevivio' ? `🛡️ ${n} sobrevivió al Most Wanted`
            : x.tipo === 'elegido' ? `🗳️ ${n} es El Elegido del Most Wanted`
              : x.tipo === 'precio' ? `💰 ${n} cobró el precio por la cabeza de ${x.a}`
                : x.tipo === 'pase' ? (x.completo ? `🎟️ ${n} completó el Pase de rapero`
                  : `🎟️ ${n} llegó al nivel ${x.nivel} del Pase de rapero`)
                : x.tipo === 'mesaward' ? (MES_CAT[x.cat] && x.cat !== 'servidor' ? `🏆 ${n} ganó ${MES_CAT[x.cat]}` : '')
                : x.tipo === 'ligahito' ? (x.que === 'campeon' ? `🏅 ${n} es campeón de ${String(x.ln || '').slice(0, 50)}`
                  : x.que === 'invicto' ? `💎 ${n} lleva ${x.pg || 5} ganadas sin perder en ${String(x.ln || '').slice(0, 50)}`
                    : x.que === 'punta' ? `🔝 ${n} tomó la punta de ${String(x.ln || '').slice(0, 50)}` : '')
                : x.tipo === 'premios' ? ({ figura: `🥇 ${n} es la figura de la semana`,
                  revelacion: `🌟 ${n} es la revelación de la semana`,
                  cazador: `🎯 ${n} es el cazador de la semana` })[rol] || '' : '';
  return t.slice(0, 120);
}

/**
 * De las publicaciones del muro, lo que se les avisa a los seguidores: lo de
 * las últimas `SIGUE_HORAS` que es de alguien con perfil. Uno por persona de
 * cada publicación: `{pub, k, t, titulo, cuerpo, url}`; `pub` es la
 * publicación, para que a quien sigue a dos del mismo equipo le llegue UNO.
 * Pura, sin red: la prueba `bot/avisos_prueba.mjs`.
 */
export function paraSeguidores(items, ahora) {
  const out = [];
  const desde = ahora - SIGUE_HORAS * HORA;
  for (const x of Array.isArray(items) ? items : []) {
    const t = Date.parse((x && x.t) || '');
    if (!x || !x.ks || !(t >= desde && t <= ahora + HORA)) continue;
    const pares = Array.isArray(x.ks) ? x.ks.map((k, i) => [k, (x.quien || [])[i], ''])
      : Object.keys(x.ks).map((r) => [x.ks[r], (Array.isArray(x[r]) ? x[r][0] : '') || '', r]);
    const pub = huella([x.tipo, x.t, x.ev || '', x.rg || '', x.carta || '', x.a || '', JSON.stringify(x.ks)].join('|'));
    for (const [k, n, rol] of pares) {
      if (!claveValida(k) || typeof n !== 'string' || !n) continue;
      const titulo = tituloSeguido(x, n, rol);
      if (!titulo) continue;
      out.push({ pub, k, t, titulo, cuerpo: `Sigues a ${n} en la Liga · toca para ver su perfil`.slice(0, 240),
        url: 'https://underlegends.pages.dev/freestyle-rap/r/' + encodeURIComponent(k) });
    }
  }
  return out;
}

// ── 👏 felicitar ───────────────────────────────────────────────────────
// 🔑 Dlx, 02/10/2026, a Publicaciones: «quizás algo más para que enganche a
// las personas o interactivo», y con el plan, «Dale, me gusta como lo tienes
// planeado». Un toque en un logro del muro —campeón, rango, Most Wanted—
// cuenta UNO por persona, y a quien felicitan le llega un aviso de la página
// con cuántos fueron: lo manda el vigía (`avisarAplausos()`), NUNCA por DM.
//
// ⚠️ AFUERA SE VE CUÁNTOS, NUNCA QUIÉN, y a quien felicitan tampoco se le dice.
// ⚠️ LA PUBLICACIÓN LA DICE EL MURO, NO LA PÁGINA: el id sale de `bot/muro.py`
// (`id_de()`) y se busca en `web:muro`; lo que no está ahí no se felicita.
// ⚠️ DE QUIÉN ES CADA NOMBRE lo dice el índice de «te toca» (`turnos:nombres`),
// y sólo se avisa si esa cuenta es la del perfil de la publicación (`d:`/`dn:`):
// ante la duda no se avisa, porque «te felicitaron» a otro es peor que nada.

//: lo que se puede felicitar. Una carta nueva le toca a todo el que juega una vez: no es un logro
export const APLAUDIBLES = { campeon: 1, rango: 1, caza: 1, sobrevivio: 1, pase: 1, sorteo: 1, ligahito: 1, mesaward: 1 };
//: 🏆 las categorías de los MES AWARDS, como las dice un aviso (`bot/mes_awards.py`)
export const MES_CAT = { rapero: 'el Rapero del mes', revelacion: 'la Revelación del mes', batalla: 'la Batalla del mes',
  servidor: 'el Servidor del mes',
  // 🏆 las de «Ver las demás nominaciones» (`bot/mes_otros.py`); sus ganadores salen juntos (`cat: 'otras'`)
  organizador: 'el Organizador del mes', staff: 'el Staff del mes', duelista: 'el Duelista del mes',
  cazador: 'el Cazador del mes', batacazo: 'el Batacazo del mes', imparable: 'el Imparable del mes',
  evento: 'el Evento del mes', promo: 'la Promo del mes', publicacion: 'la Publicación del mes', crew: 'la Crew del mes',
  pais: 'el País del mes', liga: 'la Liga del mes',
  // «Y más»
  hincha: 'el Hincha del mes', clasico: 'el Clásico del mes', sobreviviente: 'el Sobreviviente del mes',
  constante: 'el Constante del mes',
  // 🎧 el staff por rol (18/10/2026, Dlx: «agrega staff por separado»), en su bloque del Salón
  jurado: 'el Jurado del mes', host: 'el Host del mes', dj: 'el DJ del mes',
  // 🎲 las de carácter, al azar de momento (18/10/2026, Dlx: «que sea random de momento»)
  villano: 'el Villano del mes', showman: 'el Showman del mes', momento: 'el Momento del mes' };
//: cuánto se guarda un aplauso (el muro trae lo de los últimos 21 días)
export const APLAUSOS_DIAS = 30;
//: cuándo vuelve a sonar: la primera vez, y cuando llega a cada uno de éstos
export const HITOS_APLAUSO = [1, 3, 5, 10, 25, 50, 100, 250, 500];
//: el primer aviso espera un poco, para que los que felicitan juntos lleguen en uno
export const APLAUSO_ESPERA = 10 * MIN;
//: y entre un aviso y el siguiente de la misma publicación, por lo menos esto
export const APLAUSO_ENTRE = HORA;
//: de una publicación más vieja que esto ya no se avisa
export const APLAUSO_AVISA_DIAS = 7;
//: cuántos envíos por invocación del vigía: comparte los 50 subpedidos
export const TOPE_APLAUSOS = 6;

/** Por qué se felicita, para el aviso («Por ganar COPA»). */
export function motivoAplauso(x) {
  const ev = String((x && x.ev) || '').slice(0, 60);
  const t = !x ? '' : x.tipo === 'campeon' ? `ganar ${ev || 'un evento'}`
    : x.tipo === 'rango' ? (x.primero ? `conseguir tu primera letra: ${x.rg}` : `subir a rango ${x.rg}`)
      : x.tipo === 'caza' ? `cazar a ${x.a}${ev ? ' en ' + ev : ''}`
        : x.tipo === 'sobrevivio' ? 'sobrevivir al Most Wanted'
          : x.tipo === 'pase' ? (x.completo ? 'completar el Pase de rapero'
            : `llegar al nivel ${x.nivel} del Pase${x.premio ? ': «' + String(x.premio).slice(0, 40) + '»' : ''}`)
          : x.tipo === 'sorteo' ? 'ganar el sorteo del Pase premium'
            // 🏟️ lo de las ligas de los servidores (`bot/ligas.py`, 16/10/2026)
            : x.tipo === 'mesaward' ? (String(x.cat || '').startsWith('sv:') ? `ganar los MES AWARDS de ${String(x.cat).slice(3, 9)}`
              : `ganar ${MES_CAT[x.cat] || 'los MES AWARDS'}`)
            : x.tipo === 'ligahito' ? (x.que === 'campeon' ? `ganar ${String(x.ln || 'una liga').slice(0, 50)}`
              : x.que === 'invicto' ? `llegar invicto a ${x.pg || 5} en ${String(x.ln || 'su liga').slice(0, 50)}`
                : x.que === 'punta' ? `tomar la punta de ${String(x.ln || 'su liga').slice(0, 50)}` : '') : '';
  return t.slice(0, 100);
}

/**
 * ¿Vale este aplauso? `{id, tipo, quien, ks, motivo, t}` —lo que el objeto
 * guarda de la publicación— si vale; `{error, estado}` si no. `items` es el
 * muro de KV, `id` el Discord ID que dijo Discord y `mios` sus perfiles (`d:`
 * y `dn:`). Pura, sin red: la prueba `bot/probar_local.mjs`.
 */
export function validarAplauso(items, d, id, mios, ahora) {
  const x = (Array.isArray(items) ? items : []).find((it) => it && it.id === (d && d.id));
  if (!x) return { error: 'no_existe', estado: 404 };
  if (!APLAUDIBLES[x.tipo]) return { error: 'no_se_felicita', estado: 400 };
  const creada = creadaEn(id);
  if (!creada || ahora - creada < EDAD_MIN_DIAS * DIA_MS) {
    return { error: 'nueva', estado: 403, desde: new Date(creada + EDAD_MIN_DIAS * DIA_MS).toISOString() };
  }
  const ks = Array.isArray(x.ks) ? x.ks.map((k) => (claveValida(k) ? k : '')) : [];
  if ((mios || []).some((k) => k && ks.indexOf(k) >= 0)) return { error: 'tú', estado: 403 };
  return { id: x.id, tipo: x.tipo, quien: (x.quien || []).slice(0, 8).map((n) => String(n).slice(0, 60)),
    ks: ks.slice(0, 8), motivo: motivoAplauso(x), t: String(x.t || '').slice(0, 30) };
}

// ── 📣 ABRIR UNA PROMO PAGA (Dlx, 16/10/2026: «dar puntos y puntos de tienda a aquellos que… dan click», y a las
// preguntas: «mirá la historia y detectá cuando da click en ir al enlace de la promo», XP del Pase y Puntos de Tienda,
// «50 por promo, hasta 3 por día»). Una vez por promo y por persona, con su Discord, y nunca la propia. ⚠️ Se paga ABRIR
// la promo —el link o el video—, nunca un like ni una suscripción: eso es lo que YouTube castiga. Qué promo, el muro que
// dejó el ciclo (`web:muro`, tipo `promo`), nunca la página
//: cuántos Puntos de Tienda paga abrir una promo, cuántas pagan por día y cuánto se guarda qué abrió cada uno
export const PROMO_PAGA = 50;
export const PROMO_TOPE_DIA = 3;
export const PROMO_DIAS = 30;

/**
 * ¿Vale abrir esta promo? `{id, pid, sv}` si vale, `{error, estado}` si no. `items` es el muro de KV, `id` el Discord ID
 * y `mios` sus perfiles (`d:` y `dn:`): la promo propia no paga. Pura, sin red: la prueba `bot/avisos_prueba.mjs`.
 */
export function validarPromo(items, d, id, mios, ahora) {
  const x = (Array.isArray(items) ? items : []).find((it) => it && it.id === (d && d.id) && it.tipo === 'promo');
  if (!x) return { error: 'no_existe', estado: 404 };
  const creada = creadaEn(id);
  if (!creada || ahora - creada < EDAD_MIN_DIAS * DIA_MS) return { error: 'nueva', estado: 403 };
  const ks = Array.isArray(x.ks) ? x.ks.map((k) => (claveValida(k) ? k : '')) : [];
  if ((mios || []).some((k) => k && ks.indexOf(k) >= 0)) return { error: 'tú', estado: 403 };
  return { id: x.id, pid: String(x.pid || x.id).slice(0, 60) };
}

// ── 📣 UNA SEMANA MÁS DE TU PROMO (Dlx, 16/10/2026: «las promociones en la página web duran una semana, a menos que sea
// solicitado manualmente en la tienda», y a la pregunta, «1 semana más: 2.500 PdT»). Sólo la tuya —la que comparte tu
// perfil—, sólo mientras está en la página, y se puede volver a pagar cuando vuelva a vencer. El ciclo lee hasta cuándo
// va cada una (`/avisos/promos-extra`) y la deja en el muro (`bot/promos.py`)
//: lo que cuesta, y cuánto suma
export const PROMO_SEMANA_PAGA = 2500;
export const PROMO_SEMANA_MS = 7 * DIA_MS;

/**
 * ¿Puede alargar esta promo? `{pid, base}` si sí —`base`, cuándo vence hoy—, `{error, estado}` si no. `items` es el muro
 * de KV y `mios` las claves de sus perfiles (`d:` y `dn:`): tiene que ser una de las que comparte él. Pura, sin red.
 */
export function validarExtender(items, d, mios, ahora) {
  const x = (Array.isArray(items) ? items : []).find((it) => it && it.id === (d && d.id) && it.tipo === 'promo');
  if (!x) return { error: 'no_existe', estado: 404 };
  const ks = Array.isArray(x.ks) ? x.ks.map((k) => (claveValida(k) ? k : '')) : [];
  if (!(mios || []).some((k) => k && ks.indexOf(k) >= 0)) return { error: 'no_es_tuya', estado: 403 };
  const base = Date.parse(x.hasta || '') || (Date.parse(x.t || '') + PROMO_SEMANA_MS) || 0;
  if (!base || base <= ahora) return { error: 'vencida', estado: 409 };
  return { pid: String(x.pid || x.id).slice(0, 60), base };
}

/** El hito más alto que ya alcanzó `n` (0 si ninguno). */
export function hitoAplausos(n) {
  let h = 0;
  for (const x of HITOS_APLAUSO) if (n >= x) h = x;
  return h;
}

/**
 * ¿Le toca aviso a esta publicación? `f` es la fila del objeto: `n` aplausos,
 * `avisado` (cuántos había en el último aviso), `primero` y `t_avisado` (ms) y
 * `t` (cuándo pasó). Suena con el primero —esperando `APLAUSO_ESPERA` para
 * juntar a los que felicitan a la vez— y al llegar a cada hito, nunca dos
 * veces en `APLAUSO_ENTRE`. Pura: `bot/avisos_prueba.mjs`.
 */
export function aplausoParaAvisar(f, ahora) {
  if (!f || !(f.n > 0) || hitoAplausos(f.n) <= hitoAplausos(f.avisado || 0)) return false;
  const t = Date.parse(f.t || '');
  if (!(ahora - t <= APLAUSO_AVISA_DIAS * DIA_MS)) return false;
  if (!f.avisado) return ahora - (f.primero || 0) >= APLAUSO_ESPERA;
  return ahora - (f.t_avisado || 0) >= APLAUSO_ENTRE;
}

/** Lo que dice el aviso: cuántos —nunca quiénes— y por qué. */
export function avisoAplauso(n, motivo) {
  return {
    titulo: n === 1 ? '👏 Alguien te felicitó' : `👏 ${n} personas te felicitaron`,
    cuerpo: (motivo ? `Por ${motivo}. ` : '') + 'Toca para verlo en Publicaciones.',
  };
}

// ── las encuestas de la página ─────────────────────────────────────────
// 🔑 Dlx, 27/09/2026: *«eso de que los buscados lo elige la gente es
// peak»*, en la página, y a quién vota: *«1. A. 2. A»* —cualquiera que entre
// con Discord—. En el ×2, desde el 28/09 cualquiera vota a cualquiera
// (*«3. B y C»*: ver `validarVoto()`). Qué se vota lo decide
// el ciclo (`bot/encuestas.py`) y lo deja en KV; acá se valida cada voto
// contra eso y se guarda en el objeto, uno por Discord ID.
//
// ⚠️ EL ID SALE DE DISCORD, NUNCA DE LA PÁGINA: igual que `vincular`.
// ⚠️ AFUERA SE VE CUÁNTOS, NUNCA QUIÉN: `/avisos/encuestas` cuenta votos.

//: una cuenta de Discord más nueva que esto no vota: es lo único que frena
//: las cuentas hechas para votar, y a la gente de la Liga no le pesa
export const EDAD_MIN_DIAS = 30;
//: cuánto se guarda un voto: el ciclo lee el resultado al cerrar
export const VOTOS_DIAS = 30;

/** Cuándo se creó una cuenta de Discord: está en su ID (un «snowflake»). */
export function creadaEn(id) {
  return /^[0-9]{5,25}$/.test(String(id || '')) ? Number(BigInt(String(id)) >> 22n) + 1420070400000 : 0;
}

/**
 * ¿Vale este voto? `{enc, op}` si vale, `{error, estado}` si no.
 *
 * `defs` es lo que dejó el ciclo en KV (`encuestas`: `lista`, y de qué
 * servidor es cada uno en `sv` y quién es en `yo`), `d` lo que mandó la
 * página y `id` el Discord ID que devolvió Discord. Pura, sin red: la
 * prueba `bot/probar_local.mjs`.
 */
export function validarVoto(defs, d, id, ahora) {
  const e = ((defs && Array.isArray(defs.lista)) ? defs.lista : []).find((x) => x && x.id === d.enc);
  if (!e) return { error: 'no_existe', estado: 404 };
  if (!(ahora < Date.parse(e.hasta))) return { error: 'cerrada', estado: 409 };
  if (!Array.isArray(e.op) || e.op.indexOf(d.op) < 0) return { error: 'opcion', estado: 400 };
  const creada = creadaEn(id);
  if (!creada || ahora - creada < EDAD_MIN_DIAS * DIA_MS) {
    return { error: 'nueva', estado: 403, desde: new Date(creada + EDAD_MIN_DIAS * DIA_MS).toISOString() };
  }
  // 🔑 EN EL ×2 CUALQUIERA VOTA A CUALQUIERA, también al suyo. Dlx,
  // 28/09/2026: «3. B y C». Hasta ese día nadie podía votar a «su servidor»
  // (el que más jugó); ahora «tu servidor» lo elige cada uno y no frena el voto.
  if (e.tipo === 'elegido' && ((defs.yo || {})[id] || '') === d.op) return { error: 'tú', estado: 403 };
  // 🏟️ LOS MES AWARDS DE UN SERVIDOR LOS VOTAN SUS JUGADORES (Dlx, 18/10/2026: «cada Tier 1 con los suyos… los votan sus
  // jugadores»): la encuesta trae `sv` y el ciclo deja en `solo` quién jugó ahí ese mes (`mes_awards.votantes()`). Sin
  // esa lista, nadie: antes eso que cualquiera
  if (e.sv) {
    const s = (defs.solo || {})[e.id];
    if (!Array.isArray(s) || s.indexOf(id) < 0) return { error: 'no_jugo', estado: 403, sv: e.sv };
  }
  return { enc: e.id, op: d.op };
}

// ── 🗳️ «¿QUIÉN GANA LA LIGA?» ──────────────────────────────────────────
// 🔑 Dlx, 14/10/2026: «Encuesta ¿quién gana la liga?»: se vota en la página (uno por persona, se cambia), con los
// porcentajes al lado de la tabla, y cierra cuando la liga termina. Qué se vota —las ligas, sus tablas y hasta cuándo— lo
// deja el ciclo en KV (`ligas:votar`, `ligas.para_kv()` en bot/ligas.py); quién vota lo dice Discord (la sesión), como en
// las encuestas; el objeto guarda uno por persona y liga (tabla `liga_voto`). ⚠️ Afuera se ve cuántos, nunca quién.
//: 📖 las historias que vio cada uno: cuántas se guardan, cuántos días y cuántas se mandan de una vez
//: 📅 los eventos de Discord (`eventosDiscord()`): cuánto dura cada uno (Discord pide hora de fin en los de afuera) y
//: cuántos pedidos a Discord por vuelta del vigía
export const EV_DC_DURA = 3 * 60 * 60 * 1000;
export const EV_DC_POR_VUELTA = 3;
export const HISTORIAS_TOPE = 600;
export const HISTORIAS_DIAS = 30;
export const HISTORIAS_LOTE = 120;
//: cuántas historias distintas por persona en 24 h (la página muestra unas decenas por día)
export const HISTORIAS_DIA = 400;
//: los votos de una liga se borran a los tantos días de que cierra su encuesta (lo dice la página de privacidad)
export const LIGA_VOTOS_DIAS = 30;

/**
 * ¿Vale este voto de «¿quién gana la liga?»? `{liga, op, cierra, cierran}` si vale, `{error, estado}` si no. `defs` es
 * lo que dejó el ciclo en KV (`{lista: [{id, hasta, op}]}`), `d` lo que mandó la página (`{liga, op}`) y `id` el Discord
 * ID que dio la sesión. `cierran`: hasta cuándo va cada liga abierta, para que el objeto sepa cuándo borrar sus votos.
 * Pura, sin red: la prueba `bot/probar_local.mjs`.
 */
export function validarVotoLiga(defs, d, id, ahora) {
  const lista = (defs && Array.isArray(defs.lista)) ? defs.lista : [];
  const e = lista.find((x) => x && x.id === (d && d.liga));
  if (!e) return { error: 'no_existe', estado: 404 };
  const hasta = Date.parse(e.hasta);
  if (!(ahora < hasta)) return { error: 'cerrada', estado: 409 };
  if (!Array.isArray(e.op) || typeof d.op !== 'string' || e.op.indexOf(d.op) < 0) return { error: 'opcion', estado: 400 };
  const creada = creadaEn(id);
  if (!creada || ahora - creada < EDAD_MIN_DIAS * DIA_MS) {
    return { error: 'nueva', estado: 403, desde: new Date(creada + EDAD_MIN_DIAS * DIA_MS).toISOString() };
  }
  const cierran = {};
  for (const x of lista) {
    const h = x && typeof x.id === 'string' ? Date.parse(x.hasta) : NaN;
    if (Number.isFinite(h) && /^[a-z0-9-]{2,40}$/.test(x.id)) cierran[x.id] = h;
  }
  return { liga: e.id, op: d.op, cierra: hasta, cierran };
}

// ── un error en una llave ──────────────────────────────────────────────
// 🔑 Dlx, 28/09/2026, a «"Reportar un error" en cada llave: quien ve mal su
// batalla la marca desde la página y va a ✅ Decidir, nunca por DM»: *«ok»*.
// Quién reporta lo dice Discord (la sesión); el objeto guarda y deja los
// últimos en KV (`reportes`), y el ciclo los pone en ✅ Decidir, en la sección
// de su evento (`bot/reportes.py`). ⚠️ Nunca por DM, y una cuenta de menos de
// 30 días no reporta, como no vota.
//: qué se puede reportar. Viaja la clave; el texto de cada una lo pone la página
export const QUE_REPORTE = {
  ganador: 'El ganador está mal', gente: 'Falta o sobra alguien',
  nombre: 'Un nombre está mal', otro: 'Otra cosa',
  // 🚩 REPORTAR USUARIO (Dlx, 21/10/2026, al remake del perfil: «que se pueda reportar… en los 3 puntos, o sea reportar
  // usuario»): su frase, su foto, su nombre o lo que publicó. Llave `perfil:<clave>`, siempre con texto
  perfil: 'Algo de su perfil',
};
//: cuántos reportes puede mandar una persona en 24 h
export const REPORTE_TOPE = 5;
//: cuántos viajan en la cola de KV para el ciclo
const REPORTES_COLA = 50;
//: cuántos días vive un reporte, con su evidencia (13/10/2026: eran 30). Lo mismo dice la página de privacidad
export const REPORTE_VIDA_DIAS = 14;

/**
 * ¿Vale este reporte? `{llave, que, texto, batalla}` si vale, `{error, estado}`
 * si no. `llave` es el número del evento, o `v:<mensaje>` para una llave en
 * vivo que todavía no tiene número. Pura, sin red: `bot/probar_local.mjs`.
 */
export function validarReporte(d, id, ahora) {
  const llave = String((d && d.llave) || '');
  // 🏟️ y `liga:<id>`, un nombre de una liga (14/10/2026, Dlx: «Sí, a Reportes»): sólo «un nombre» u «otra cosa»
  // 🚩 y `perfil:<clave>` (21/10/2026): un usuario, sólo con `que: 'perfil'`
  const perfil = llave.startsWith('perfil:');
  if (perfil ? !claveValida(llave.slice(7)) : !/^(\d{1,6}|v:\d{15,22}|liga:[a-z0-9-]{2,40})$/.test(llave)) return { error: 'llave', estado: 400 };
  const que = String((d && d.que) || '');
  if (!Object.prototype.hasOwnProperty.call(QUE_REPORTE, que)) return { error: 'que', estado: 400 };
  if (llave.startsWith('liga:') && que !== 'nombre' && que !== 'otro') return { error: 'que', estado: 400 };
  if (perfil !== (que === 'perfil')) return { error: 'que', estado: 400 };
  const texto = String((d && d.texto) || '').replace(/\s+/g, ' ').trim();
  if (texto.length > 300) return { error: 'largo', estado: 413 };
  // «otra cosa» —y un usuario— sin decir qué no se puede revisar
  if ((que === 'otro' || perfil) && texto.length < 3) return { error: 'texto', estado: 400 };
  const batalla = String((d && d.batalla) || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const creada = creadaEn(id);
  if (!creada || ahora - creada < EDAD_MIN_DIAS * DIA_MS) {
    return { error: 'nueva', estado: 403, desde: new Date(creada + EDAD_MIN_DIAS * DIA_MS).toISOString() };
  }
  return { llave, que, texto, batalla };
}

/**
 * 📣 ¿VALE LO QUE DLX DECIDIÓ DE UN REPORTE? (13/10/2026, a «¿qué acciones puedo hacer acá?»: *«Sí, todas»*).
 * `{id, accion, fix}` si vale, `{error}` si no. Pura, sin red: `bot/avisos_prueba.mjs`.
 *
 * · `listo` y `prueba` lo cierran (`fix` null).
 * · `nombre`: en el evento `n`, el nombre `nombre` de la llave era otra persona: quien lo reportó (`reporta`), una
 *   de la Lista (`es`) o alguien que no está (`nuevo`). Sólo una de las tres.
 * · `ganador`: en el evento `n`, la batalla de `ronda` entre `lados` la ganó `ganador` (uno de los lados).
 * Lo aplica el ciclo (`bot/reportes.py --corregir`), que valida además contra la Lista y la llave de verdad.
 */
export function validarDecisionReporte(d) {
  const v = decisionReporte0(d);
  if (v.error) return v;
  // 🔎 POR QUÉ SE CIERRA (25/10/2026, el research del Dashboard: el motivo de cierre de Battlefy, para saber qué parte del
  // bot falla más). Una de una lista fija; sin causa vale igual (un Dashboard viejo abierto en otro navegador), y la
  // corrección la trae sola: un nombre es un nombre mal leído; un ganador, la llave mal leída, salvo que se diga otra
  const c = String((d && d.causa) || '');
  if (c && !CAUSAS_REPORTE.includes(c)) return { error: 'causa' };
  const causa = v.accion === 'prueba' ? 'prueba' : c || (v.accion === 'nombre' ? 'nombre_bot' : v.accion === 'ganador' ? 'llave_bot' : '');
  return Object.assign({}, v, { causa });
}
//: por qué se cerró un reporte: el bot leyó mal un nombre, el bot leyó mal la llave, se equivocó el organizador, estaba bien
// o era una prueba. El Dashboard los cuenta (`causasDueno()`): cuál sube primero es lo que hay que arreglar primero
export const CAUSAS_REPORTE = ['nombre_bot', 'llave_bot', 'organizador', 'no_corresponde', 'prueba'];
//: 🗂️ LAS ETIQUETAS DE UNA NOTA DEL STAFF (25/10/2026, el research: «notas con pocas etiquetas fijas», como las Mod Notes
// de Reddit). La sanción puede tener fecha de fin: es informativa, no frena nada sola
export const NOTA_ETIQUETAS = ['nota', 'ayuda', 'aviso', 'sancion'];
/** 🗂️ ¿Vale una nota nueva? `{k, et, texto, dias}` o `{error}`. Pura (`bot/avisos_prueba.mjs`). Borrar es `{borrar: id}`. */
export function validarNota(d) {
  if (d && Number.isInteger(Number(d.borrar)) && Number(d.borrar) > 0 && !d.texto) return { borrar: Number(d.borrar) };
  const k = String((d && d.k) || '');
  if (!/^[a-z0-9]{1,40}$/.test(k)) return { error: 'falta quién' };
  const et = String((d && d.et) || 'nota');
  if (!NOTA_ETIQUETAS.includes(et)) return { error: 'etiqueta' };
  const texto = String((d && d.texto) || '').replace(/\s+/g, ' ').trim();
  if (!texto || texto.length > 300 || /[<>]/.test(texto)) return { error: 'el texto: de 1 a 300 letras, sin < >' };
  const dias = Number((d && d.dias) || 0);
  if (![0, 1, 3, 7, 30].includes(dias) || (dias && et !== 'sancion')) return { error: 'la fecha de fin' };
  return { k, et, texto, dias };
}
//: 🔁 LO QUE LE LLEGA A QUIEN SE AVISA QUE VUELVA (25/10/2026, el research del Dashboard: la lista de primerizos y
// enfriados, con una acción que nunca es un DM). Textos fijos: el staff elige uno, no lo escribe. `[título, cuerpo, link]`
// 🧪 EL GRUPO SIN AVISO (25/10/2026, el research: «contra un grupo de 10–20 % elegido al azar que no la recibe»; Dlx:
// «haz todas»). A uno de cada ~7 de la lista no se le avisa nunca, para comparar cuántos vuelven solos. Por sorteo FIJO
// de su clave (no cambia de un día al otro, ni depende de quién mire): si no, «el grupo» se rearmaría en cada vuelta
export const CONTROL_VUELVE = 15;
export function enControlVuelve(k) {
  let h = 2166136261;
  for (const c of String(k || '')) h = Math.imul(h ^ c.codePointAt(0), 16777619) >>> 0;
  return h % 100 < CONTROL_VUELVE;
}
export const PLANTILLAS_VUELVE = {
  evento: ['🎤 Te esperamos en el próximo evento', 'Esta semana hay eventos en los servidores de la Liga: mira el calendario y anótate.', '/freestyle-rap/eventos'],
  pase: ['🎟️ Tu Pase de rapero te espera', 'Juega un evento esta semana y suma XP en tu Pase: las tareas diarias y semanales también suman.', '/freestyle-rap/pase'],
  crew: ['👥 Súmate a una crew', 'Las crews juegan juntas, se apoyan en las llaves y suben de tier cada semana.', '/freestyle-rap/crews'],
};
function decisionReporte0(d) {
  const id = Number(d && d.id);
  if (!Number.isInteger(id) || id < 1) return { error: 'falta el reporte' };
  const accion = String((d && d.accion) || '');
  if (accion === 'listo' || accion === 'prueba') return { id, accion, fix: null };
  // un texto corto, de una línea y sin `<>`: va a una hoja y a la campana de alguien
  const txt = (x, max) => {
    const t = String(x == null ? '' : x).replace(/\s+/g, ' ').trim();
    return t && t.length <= max && !/[<>]/.test(t) ? t : '';
  };
  // 🏟️ UN NOMBRE DE UNA LIGA (14/10/2026): era alguien de la Lista o quien lo reportó. El ciclo lo vuelve el AKA de ESE
  // servidor (`por_servidor` de akas_a_mano.json, `reportes.corregir_liga()`): alguien nuevo no, porque una liga no
  // crea gente
  const liga = String((d && d.liga) || '');
  if (liga) {
    if (!/^[a-z0-9-]{2,40}$/.test(liga) || accion !== 'nombre') return { error: 'falta la liga' };
    const nombre = txt(d.nombre, 80);
    if (!nombre) return { error: 'falta el nombre' };
    if (d.reporta === true) return { id, accion, fix: { tipo: 'nombre', liga, nombre, reporta: true } };
    const es = txt(d.es, 60);
    if (!es) return { error: 'elige de quién es' };
    return { id, accion, fix: { tipo: 'nombre', liga, nombre, es } };
  }
  const n = String((d && d.n) || '');
  if (!/^\d{1,6}$/.test(n)) return { error: 'falta el evento' };
  if (accion === 'nombre') {
    const nombre = txt(d.nombre, 80);
    if (!nombre) return { error: 'falta el nombre' };
    if (d.reporta === true) return { id, accion, fix: { tipo: 'nombre', n, nombre, reporta: true } };
    const es = txt(d.es, 60), nuevo = txt(d.nuevo, 40);
    if (!!es === !!nuevo) return { error: 'elige de quién es' };
    return { id, accion, fix: es ? { tipo: 'nombre', n, nombre, es } : { tipo: 'nombre', n, nombre, nuevo } };
  }
  if (accion === 'ganador') {
    const ronda = txt(d.ronda, 30), ganador = txt(d.ganador, 120);
    const lados = Array.isArray(d.lados) ? d.lados.map((x) => txt(x, 120)).filter(Boolean) : [];
    if (!ronda || lados.length < 2 || lados.length > 6 || !lados.includes(ganador)) return { error: 'falta la batalla' };
    return { id, accion, fix: { tipo: 'ganador', n, ronda, lados, ganador } };
  }
  return { error: 'no sé qué hacer' };
}

// 🏷️ LOS ROLES DE LA PÁGINA (13/10/2026). Dlx: «en cada perfil aparezca el rol de cada uno… competidor, organizador,
// staff, o roles superiores ÚNICAMENTE decididos por mí: Moderador de la página web, asistente, Admin y owner únicamente
// yo», y «el título de socio para los owners de los servidores asociados». En el orden en que se muestran: primero los
// que pone Dlx, después los que salen solos (`bot/roles.py`). Owner es sólo Dlx: no se pone ni se saca
export const ORDEN_ROLES = ['owner', 'admin', 'asistente', 'moderador', 'socio', 'staff', 'organizador', 'jurado', 'host', 'competidor'];
//: los que Dlx puede poner o sacar a mano (todos menos owner)
export const ROLES_A_MANO = ORDEN_ROLES.filter((r) => r !== 'owner');

// 🔐 QUÉ PUEDE CADA ROL EN EL DASHBOARD (13/10/2026). Dlx, a la tabla de qué hace cada uno: Asistente *«directo, con
// historial»*; Moderador, lo que no mueve puntos; Admin, todo el Dashboard menos los Roles; Owner (Dlx), todo. Cada acción
// queda con quién la hizo (`por`). Staff y Organizador vienen después (su servidor; sugerencias de sus eventos)
export const PERMISOS = {
  panel: ['admin', 'asistente', 'moderador'],
  ajustes: ['admin'], ciclo: ['admin'],
  reportes: ['admin', 'asistente'],
  reportes_cerrar: ['admin', 'asistente', 'moderador'],
  decidir: ['admin', 'asistente'],
  videos: ['admin', 'asistente', 'moderador'],
  fondos: ['admin', 'asistente', 'moderador'],
  roles: [],
};
//: ¿esos roles pueden hacer eso? Owner, todo
export const puedeRol = (roles, que) => (roles || []).includes('owner') || (roles || []).some((r) => (PERMISOS[que] || []).includes(r));
//: los roles que abren el Dashboard (los que pone Dlx)
const ROLES_PANEL = ['admin', 'asistente', 'moderador'];

// 🖼️ TU FONDO (13/10/2026). Dlx, a «una imagen propia para tu cuenta para el fondo»: «Sí, y mientras tanto con el Pase
// gratis», y dónde se ve, «ambos pero que sea personalizable… que él decida, pero por default en ambos». Se desbloquea con
// el nivel `FONDO_NIVEL` del Pase de rapero; se ve recién cuando lo aprueba Dlx (hay menores en la Liga); y cada uno elige
// si va en su perfil, de fondo de su propia página, o los dos
export const FONDO_NIVEL = 5;
// 🖼️ los marcos de carta, de menos a más, y los estilos de la carta de Servidor (Dlx, 25/10/2026: «Las 2. Una elige»)
export const MARCOS = ['premium', 'plata', 'oro'];
export const MARCO_ESTILOS = ['camiseta', 'cadena'];
// 🏷️ las cartas que llevan TAG elegible (25/10/2026)
export const TAG_CARTAS = ['temporada', 'competitivo', 'servidor', 'pais'];
/** El mejor marco de una lista `['t1:premium', 't1:oro']`: el de más nivel y, a igual nivel, el de la temporada más nueva */
export function mejorMarco(xs) {
  return (xs || []).slice().sort((a, b) => (MARCOS.indexOf(b.split(':')[1]) - MARCOS.indexOf(a.split(':')[1])) || (b < a ? -1 : 1))[0] || '';
}
// 🎨 los colores de nombre que puede elegir quien tiene el premium (el nivel 7 de su fila): los de la Liga y el dorado
export const PASE_COLORES = ['#F5C542', '#29B298', '#E41373', '#8FE8FF', '#B98CFF', '#FF7A45', '#F6F6F6'];
// 🔔 desde qué hora del domingo (este) sale el aviso semanal del Pase
export const PASE_AVISO_HORA = '17:00';
//: el tope de cada imagen (la página la achica a 1600×640 en webp antes de mandarla) y cuántas por día
export const FONDO_TOPE = 600 * 1024;

/**
 * 🛡️ ¿TRAE METADATOS? (13/10/2026, la pasada de seguridad: «anti doxx»). Una foto del celular puede llevar adentro la
 * UBICACIÓN de donde se sacó (EXIF con GPS), el modelo del teléfono o un nombre (XMP). La página la limpia al achicarla
 * —el canvas no copia nada de eso—, pero alguien que le pegue directo a la API podría mandarla tal cual: por eso se
 * mira acá, por la estructura de cada formato y no buscando texto suelto, y si trae algo, no entra. Pura.
 */
export function tieneMetadatos(b) {
  if (!b || b.length < 12) return false;
  const tag = (i, n) => String.fromCharCode(...b.subarray(i, i + n));
  if (tag(0, 4) === 'RIFF' && tag(8, 4) === 'WEBP') {
    // los trozos de un webp: cuatro letras y el largo; EXIF y XMP son los de los metadatos
    for (let i = 12; i + 8 <= b.length;) {
      const t = tag(i, 4);
      if (t === 'EXIF' || t === 'XMP ') return true;
      const n = b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] << 24);
      if (n < 0) return true;
      i += 8 + n + (n & 1);
    }
    return false;
  }
  if (b[0] === 0x89 && tag(1, 3) === 'PNG') {
    for (let i = 8; i + 8 <= b.length;) {
      const n = ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
      const t = tag(i + 4, 4);
      if (t === 'eXIf' || t === 'tEXt' || t === 'iTXt' || t === 'zTXt') return true;
      if (t === 'IEND') return false;
      i += 12 + n;
    }
    return false;
  }
  if (b[0] === 0xFF && b[1] === 0xD8) {
    // los segmentos de un jpeg hasta los datos: APP1 (EXIF o XMP), APP13 (Photoshop) y COM (un comentario)
    for (let i = 2; i + 4 <= b.length;) {
      if (b[i] !== 0xFF) return false;
      const m = b[i + 1];
      if (m === 0xDA) return false;
      if (m === 0xE1 || m === 0xED || m === 0xFE) return true;
      i += 2 + ((b[i + 2] << 8) | b[i + 3]);
    }
    return false;
  }
  return false;
}

/**
 * 🧽 SACARLE LOS METADATOS EN VEZ DE RECHAZARLA (19/10/2026, Dlx desde su iPad: «no me deja crear crew por esto»).
 * Safari no sabe hacer webp desde un canvas, así que la página le manda un JPEG, y el JPEG que arma Safari (ImageIO)
 * trae un bloque Exif suyo —el tamaño y el espacio de color, sin ubicación—. `tieneMetadatos()` rechazaba cualquier
 * Exif, así que a todo iPhone y iPad se le frenaban el logo, el fondo y la foto de tarjeta con «trae datos escondidos».
 * Ahora se le quitan los mismos bloques que `tieneMetadatos()` mira —APP1, APP13 y comentarios del JPEG; EXIF y XMP
 * del webp (con su marca en VP8X); eXIf y los textos del PNG— y se guarda la limpia: lo que se quería evitar (la
 * ubicación en una imagen pública) no se guarda nunca. Devuelve la imagen limpia, la misma si no traía nada, o `null`
 * si su estructura no se entiende. Pura.
 */
export function limpiarMetadatos(b) {
  if (!b || b.length < 12) return b;
  const tag = (i, n) => String.fromCharCode(...b.subarray(i, i + n));
  const unir = (partes) => {
    const out = new Uint8Array(partes.reduce((a, p) => a + p.length, 0));
    let i = 0;
    for (const p of partes) { out.set(p, i); i += p.length; }
    return out;
  };
  if (b[0] === 0xFF && b[1] === 0xD8) {
    const partes = [b.subarray(0, 2)];
    for (let i = 2; i + 4 <= b.length;) {
      if (b[i] !== 0xFF) return null;
      const m = b[i + 1];
      // desde los datos de la imagen (SOS) va entero: lo que se saca vive antes
      if (m === 0xDA) { partes.push(b.subarray(i)); return unir(partes); }
      const n = (b[i + 2] << 8) | b[i + 3];
      if (n < 2 || i + 2 + n > b.length) return null;
      if (m !== 0xE1 && m !== 0xED && m !== 0xFE) partes.push(b.subarray(i, i + 2 + n));
      i += 2 + n;
    }
    return null;
  }
  if (b[0] === 0x89 && tag(1, 3) === 'PNG') {
    const partes = [b.subarray(0, 8)];
    for (let i = 8; i + 12 <= b.length;) {
      const n = ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
      const t = tag(i + 4, 4);
      if (i + 12 + n > b.length) return null;
      if (t !== 'eXIf' && t !== 'tEXt' && t !== 'iTXt' && t !== 'zTXt') partes.push(b.subarray(i, i + 12 + n));
      i += 12 + n;
      if (t === 'IEND') return unir(partes);
    }
    return null;
  }
  if (tag(0, 4) === 'RIFF' && tag(8, 4) === 'WEBP') {
    const partes = [];
    for (let i = 12; i + 8 <= b.length;) {
      const t = tag(i, 4);
      const n = (b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] << 24)) >>> 0;
      const fin = i + 8 + n + (n & 1);
      if (i + 8 + n > b.length) return null;
      if (t !== 'EXIF' && t !== 'XMP ') {
        const c = b.slice(i, Math.min(fin, b.length));
        // VP8X dice qué trae: sin el bit de EXIF (0x08) ni el de XMP (0x04), o un lector estricto los busca
        if (t === 'VP8X' && c.length > 8) c[8] &= ~0x0C;
        partes.push(c);
      }
      i = fin;
    }
    const cuerpo = unir(partes);
    const out = new Uint8Array(12 + cuerpo.length);
    out.set(b.subarray(0, 12));
    out.set(cuerpo, 12);
    const tam = 4 + cuerpo.length;
    out[4] = tam & 255; out[5] = (tam >> 8) & 255; out[6] = (tam >> 16) & 255; out[7] = (tam >>> 24) & 255;
    return out;
  }
  return b;
}
const FONDO_POR_DIA = 5;
//: cuántos días queda a la vista en el Dashboard lo que aprobó el filtro, con «Quitar»
const FILTRO_VISTA_DIAS = 3;

// 📸 TU FOTO DE TARJETA (13/10/2026). Dlx: «¿también podemos agregar la opción de foto personalizable de la tarjeta y
// quizás la opción de cambiarla para cada tarjeta? … agrega un filtro a eso también», y a las tres preguntas: «Nivel 15
// gratis», «Una por tarjeta» y «Una por semana». Una imagen propia en vez de la de Discord, en las cartas que elijas;
// pasa por el mismo filtro que el fondo (`filtrarImagen()`), y cada carta se cambia como mucho una vez por semana
export const FOTO_CARTA_NIVEL = 15;
//: la página la achica a 768×768 en webp; esto es el tope que se acepta
export const FOTO_CARTA_TOPE = 500 * 1024;
export const FOTO_CARTA_SEMANA = 7 * 864e5;
//: las cartas con cara, con los nombres del sello (`bot/que_cambio.TODAS`) y de R2 (`<clave>@<carta>.webp`)
export const CARTAS_FOTO = ['temporada', 'competitivo', 'servidor', 'pais'];

/**
 * 🔑 LA CLAVE DE R2 DE UNA CARA: `fotos/<sal>-<temporada>/<clave>.webp`, y con `carta`, la propia de esa carta
 * (`<clave>@<carta>.webp`). Vivía en worker.js; se mudó acá para que el objeto y el Worker escriban en el mismo lugar.
 * ⚠️ El `@` va en la MISMA carpeta a propósito: el espejo del ciclo (`bot/fotos.espejo()`) y el sello
 * (`fotos.etags()`) la ven sin cambiar nada, y `comun/respaldo.foto(nombre, carta)` la prefiere a la de Discord.
 * ⚠️ El `|| ''` y el `|| 't1'` mantienen la ruta vieja si un despliegue no trae los bindings.
 */
export const claveFoto = (env, quien, carta = '') => `fotos/${(env && env.FOTOS_SAL) ? env.FOTOS_SAL + '-' : ''}`
  + `${(env && env.TEMPORADA) || 't1'}/${quien}${carta ? '@' + carta : ''}.webp`;

/**
 * 🛡️ EL FILTRO AUTOMÁTICO DE LOS FONDOS (Dlx, 13/10/2026: «que eso de fondos no necesite eso de pendientes… pero que
 * también tenga un filtro, como Facebook hace, para evitar que haya cosas gore o NSFW… un filtro automático»).
 *
 * Cada fondo pasa por la IA de Cloudflare (la misma de los afiches, `OCR_MODELO`) ANTES de guardarse. Contesta sí, no o
 * «quizás» por categoría, y con eso:
 *   - todo «no»                         → se ve al instante, sin esperar a nadie;
 *   - un «sí» en algo que no va         → no entra, y se le dice por qué (no se guarda ni un byte);
 *   - un «quizás», drogas, o la IA no contesta → queda para revisar en el Dashboard, como antes.
 * O sea que los pendientes no desaparecen: quedan para lo que la IA no sabe, que es donde hace falta una persona.
 *
 * ⚠️ UNA IA SE EQUIVOCA PARA LOS DOS LADOS. Por eso: «quizás» va a revisar y no a aprobar; ante la duda en una categoría
 * se le pide «maybe», no «no»; y lo que el filtro aprobó queda tres días a la vista en el Dashboard con «Quitar»
 * (`fondosDueno()`), que es lo que hace Facebook también: filtro automático y gente mirando lo que se escapó.
 */
export const FILTRO_CATEGORIAS = ['SEXUAL', 'GORE', 'VIOLENCE', 'HATE', 'DRUGS', 'PERSONAL'];
//: lo que con un «sí» no entra; las drogas van a revisar (la cultura del rap las muestra, y lo decide una persona)
export const FILTRO_NO = ['SEXUAL', 'GORE', 'VIOLENCE', 'HATE', 'PERSONAL'];
//: cómo se le dice a quien la subió (y en el Dashboard)
export const FILTRO_TEXTO = { SEXUAL: 'contenido sexual o desnudos', GORE: 'sangre, heridas o muerte',
  VIOLENCE: 'violencia', HATE: 'símbolos o mensajes de odio', DRUGS: 'drogas',
  PERSONAL: 'datos personales a la vista (documentos, direcciones, teléfonos)' };
export const FILTRO_PEDIDO = 'You moderate images for a website whose users include teenagers. A user wants this image '
  + 'as the background of their public profile. For EACH category answer yes, no or maybe, on ONE line, exactly like '
  + 'this:\nSEXUAL=no GORE=no VIOLENCE=no HATE=no DRUGS=no PERSONAL=no\n'
  + 'SEXUAL: nudity, exposed breasts, genitals or buttocks, lingerie or underwear posing, sexual acts or sexually '
  + 'suggestive poses, sexual drawings, hentai.\n'
  + 'GORE: blood, open wounds, injuries, corpses, mutilation, self-harm.\n'
  + 'VIOLENCE: real people being hurt, threatened or killed, torture, executions, terrorism. A drawn or posed weapon '
  + 'alone is no.\n'
  + 'HATE: nazi or other hate symbols, racist or hateful imagery or text.\n'
  + 'DRUGS: drugs or drug use shown prominently.\n'
  + 'PERSONAL: readable personal data: ID documents, home addresses, phone numbers, emails, license plates, bank cards.\n'
  + 'If you are not sure about a category, answer maybe for it. Answer only that line.';

/** Lo que contestó la IA → `{v: 'ok'|'no'|'revisar', si: [..], quizas: [..]}`. Pura. Sin las seis, a revisar. */
export function leerFiltro(texto) {
  const r = {};
  for (const m of String(texto || '').matchAll(/\b(SEXUAL|GORE|VIOLENCE|HATE|DRUGS|PERSONAL)\s*[=:]\s*(yes|no|maybe)\b/gi)) {
    const k = m[1].toUpperCase();
    if (!(k in r)) r[k] = m[2].toLowerCase();
  }
  const si = FILTRO_CATEGORIAS.filter((k) => r[k] === 'yes');
  const quizas = FILTRO_CATEGORIAS.filter((k) => r[k] === 'maybe');
  const faltan = FILTRO_CATEGORIAS.filter((k) => !(k in r));
  if (si.some((k) => FILTRO_NO.includes(k))) return { v: 'no', si, quizas };
  if (si.length || quizas.length || faltan.length) return { v: 'revisar', si, quizas, faltan };
  return { v: 'ok', si, quizas };
}

/** Pasa la imagen (`b64`, ya en base64) por la IA y devuelve el veredicto de `leerFiltro()`, con lo que contestó. */
export async function filtrarImagen(env, b64, tipo) {
  const sal = await env.AI.run(OCR_MODELO, {
    messages: [{ role: 'user', content: [
      { type: 'text', text: FILTRO_PEDIDO },
      { type: 'image_url', image_url: { url: 'data:' + tipo + ';base64,' + b64 } },
    ] }],
    max_tokens: 40, temperature: 0,
  });
  const t = String((sal && (sal.response != null ? sal.response : (sal.result || {}).response)) || '').trim();
  return Object.assign(leerFiltro(t), { crudo: t.slice(0, 200) });
}

/** ¿Vale este cambio de rol? `{id, rol, si}` (`si`: true lo pone, false lo saca, null vuelve a lo automático). Pura. */
export function validarRol(d) {
  const id = String((d && d.id) || '');
  if (!/^\d{5,25}$/.test(id)) return { error: 'falta la persona' };
  const rol = String((d && d.rol) || '');
  if (!ROLES_A_MANO.includes(rol)) return { error: 'ese rol no se pone a mano' };
  if (d.si !== true && d.si !== false && d.si !== null) return { error: 'falta si va o no' };
  return { id, rol, si: d.si };
}

/**
 * ✅ ¿VALE ESTA RESPUESTA A UNA PREGUNTA DE ✅ DECIDIR? `{id, r, nota}` (o `{id, borrar: true}`) si vale, `{error}` si
 * no. La respuesta tiene que ser una de las opciones de esa pregunta, o «Es <nombre>» en una de nombre (`libre`):
 * lo mismo que se elige o se escribe en la hoja. La interpreta el ciclo (`decidir.interpretar()`). Pura.
 */
export function validarRespuestaDecidir(d, preguntas, solas) {
  const id = String((d && d.id) || '');
  // 🤖 deshacer lo que una regla resolvió sola: tiene que ser una de las que el ciclo dijo que resolvió
  if (d && d.deshacer === true) {
    return (solas || []).some((x) => x && x.id === id) ? { id, deshacer: true } : { error: 'eso no lo resolvió una regla' };
  }
  const p = (preguntas || []).find((x) => x && x.id === id);
  if (!p) return { error: 'esa pregunta ya no está' };
  if (d.borrar === true) return { id, borrar: true };
  const r = String(d.r == null ? '' : d.r).replace(/\s+/g, ' ').trim();
  const nota = String(d.nota == null ? '' : d.nota).replace(/\s+/g, ' ').trim().slice(0, 300);
  if (/[<>]/.test(r + nota)) return { error: 'sin < ni >' };
  if (!(p.opciones || []).includes(r) && !(p.libre && /^Es \S.{0,58}$/.test(r))) return { error: 'esa respuesta no es una de las opciones' };
  return { id, r, nota };
}

// ── el precio por cabeza ───────────────────────────────────────────────
// 🔑 Dlx, 27 y 28/09/2026: *«PUNTOS de TIENDA… que todos empecemos con 5k»*,
// *«si nadie lo caza, vuelve»*, *«sí 20k»* y *«1. Ambos. 2. B»*: el que caza
// cobra Tienda y Temporada, y billetera tiene cualquiera que entre con
// Discord. Las reglas y los números viven en `bot/precios.py` y llegan por KV
// (`precios`): acá no se escribe ninguno, así están en un solo lugar.
// ⚠️ AFUERA SE VE CUÁNTO VALE CADA CABEZA, NUNCA QUIÉN PUSO.

/**
 * ¿Vale este precio? `{cabeza, monto, fin, desde, inicial, tope}` si vale,
 * `{error, estado}` si no. El saldo y el tope los mira el objeto (`precio()`).
 * Pura, sin red: la prueba `bot/probar_local.mjs`.
 */
export function validarPrecio(cfg, d, id, ahora) {
  if (!cfg || !Array.isArray(cfg.cabezas) || !Number.isInteger(cfg.inicial) || !Number.isInteger(cfg.tope) ||
      !Number.isInteger(cfg.min) || !Number.isInteger(cfg.paso)) return { error: 'todavia', estado: 503 };
  const fin = Date.parse(cfg.fin || '');
  if (!(ahora < fin)) return { error: 'cerrada', estado: 409 };
  if (cfg.cabezas.indexOf(d.cabeza) < 0) return { error: 'cabeza', estado: 400 };
  // un número de verdad: «1e3» o «1000» en texto no son un monto
  const m = typeof d.monto === 'number' ? d.monto : NaN;
  if (!Number.isInteger(m) || m < cfg.min || m % cfg.paso !== 0) {
    return { error: 'monto', estado: 400, min: cfg.min, paso: cfg.paso };
  }
  const creada = creadaEn(id);
  if (!creada || ahora - creada < EDAD_MIN_DIAS * DIA_MS) {
    return { error: 'nueva', estado: 403, desde: new Date(creada + EDAD_MIN_DIAS * DIA_MS).toISOString() };
  }
  if (((cfg.yo || {})[id] || '') === d.cabeza) return { error: 'tú', estado: 403 };
  return { cabeza: d.cabeza, monto: m, fin, desde: Date.parse(cfg.desde || '') || 0, inicial: cfg.inicial,
    tope: cfg.tope };
}

/**
 * Quién es el dueño de un permiso de la página, preguntándole a Discord:
 * `{id, u}` si vale, `{error: 'token'}` si Discord dice que no, y
 * `{error: 'ocupado'}` si Discord no contesta o frena (429, 5xx, la red).
 *
 * 🔴 «OCUPADO» NO ES UN PERMISO MALO, y confundirlos armaba un ciclo. Dlx,
 * 28/09/2026: *«cada vez que presiono para votar me redirige a DISCORD para
 * autorizar mi cuenta… lo hice miles de veces»*. Todo lo que no fuera 200 se
 * leía como «permiso malo», la página lo mandaba a autorizar de nuevo, volvía,
 * Discord volvía a frenar… Ahora la página sabe cuál de las dos es.
 */
// 🔴 EL PERMISO TIENE QUE SER DE ESTA APP (revisión del 03/10/2026). La identidad salía de `/users/@me` con el token
// que manda la página, y Discord contesta eso con el token de CUALQUIER app que tenga «identify»: una página ajena
// donde alguien entró con su Discord podía mandarnos ese token y entrar acá como esa persona —su sesión de 30 días,
// sus Puntos de Tienda, su voto, sus avisos—. `/oauth2/@me` dice de qué app es el permiso, y trae al usuario.
// ⚠️ Es el mismo número que `DC_APP` de bot/paginas/app.js (el `client_id` del login): público, no un secreto
export const APP_ID = '1550026808404217926';
// 🔒 EL DUEÑO DE LA LIGA: su Discord ID. Abre el Dashboard (`/avisos/dueno`) y los comandos `/owner`. Es público —es
// un ID— y vive acá para que el Worker y el objeto lean el mismo
export const DUENO = '739338101603696681';
// 👑 y su perfil (/r/dlx, sus cartas en R2 bajo `dlx/`): no juega, así que `claveDe()` no siempre lo encuentra
export const DUENO_K = 'dlx';
// ⚙️ LOS AJUSTES DEL DASHBOARD (Dlx, 04/10/2026: «todo y muchas más cosas»): lo que sólo cambia el dueño. Viven en el
// objeto (`ajustes()`), los escribe `/avisos/dueno/ajuste` (sólo Dlx) y los leen el vigía, el ciclo (`/avisos/ajustes`,
// con su clave) y la página (sólo el aviso, adentro de `/avisos/vivo`)
//   campana_pausada   bool: no sale ningún aviso (los de eventos de ese rato se descartan; los personales esperan)
//   multiplicadores   {semana, sv: {SV: factor}}: los de la semana a mano, encima del sorteo (los aplica el ciclo)
//   aviso_web         {texto, hasta}: un aviso arriba de la página, para todos, hasta esa hora. Viaja con `/vivo`,
//                     que la página ya pide al abrir y cada pocos minutos: no suma ningún pedido
//   en_vivo           {SV: bool}: el bot en el chat de cada servidor durante un evento (llega con esa función)
//   en_vivo_nivel     {SV: poco|normal|todo}: cuánto habla ahí (`NIVELES_CHAT`); gana sobre el que eligió su admin
//   eventos_discord   {SV: bool}: en qué servidores cada anuncio pasa a ser un EVENTO de Discord (`eventosDiscord()`,
//                     19/10/2026). Sin elegir, apagado: se crea en el servidor de otro y se ve allá
//   avisos_nivel      poco|normal|todo: cuánto dice el aviso de cada evento en el canal de la Liga (`NIVELES_AVISO`,
//                     lo lee el ciclo: `bot/aviso_evento.py`). Sin elegir, «normal»
export const FACTORES = [0.5, 1, 1.5, 2, 3, 5];
// 📣 EL AVISO DE CADA EVENTO (Dlx, 07/10/2026: «para la liga global, pero añade nivel de intensidad»). Los mismos tres
// que `NIVELES` de bot/aviso_evento.py: si se cambia uno, se cambia en los dos
export const NIVELES_AVISO = {
  poco: ['Lo justo', 'El evento, el campeón y cuántos jugaron'],
  normal: ['Normal', 'Además el podio con sus puntos y la tarjeta del campeón'],
  todo: ['Todo', 'Además quién subió en el ranking, quién debutó, las insignias, los rangos y la sorpresa'],
};
/**
 * ⚙️ Un ajuste del bot que pide el dueño desde su panel (`socioAjustes()` del objeto): los mismos de `/settings` (ver
 * `CFG_BASE`) más `eventos_discord`. Devuelve el valor limpio o `undefined`. Un canal vale sólo si está en la lista de
 * canales de texto de ESE servidor (`canales`, de Discord): el dueño no puede apuntar el bot a un canal de otro. Pura:
 * la prueba `bot/avisos_prueba.mjs`.
 */
export function socioAjusteValido(cual, valor, canales) {
  const ids = new Set((canales || []).map((c) => String(c.id)));
  if (cual === 'nick' || cual === 'apuestas' || cual === 'eventos_discord') return typeof valor === 'boolean' ? valor : undefined;
  if (cual === 'vivo_nivel') return Object.prototype.hasOwnProperty.call(NIVELES_CHAT, valor) ? valor : undefined;
  if (cual === 'aviso_evento') return (valor === '' || valor === null) ? '' : (valor === 'chat' || valor === 'no') ? valor : undefined;
  if (cual === 'avisos' || cual === 'vivo' || cual === 'ascenso') {
    if (valor === '' || valor === null) return '';
    return typeof valor === 'string' && ids.has(valor) ? valor : undefined;
  }
  if (cual === 'canales') {
    if (!Array.isArray(valor) || valor.length > 10) return undefined;
    const out = [];
    for (const v of valor) {
      if (typeof v !== 'string' || !ids.has(v)) return undefined;
      if (!out.includes(v)) out.push(v);
    }
    return out;
  }
  return undefined;
}

/** 🎛️ los beneficios que se prenden y apagan por servidor (los mismos de `BENEFICIOS` en bot/tiers.py) */
export const BENEFICIOS_SV = ['pagina', 'calendario', 'ligas', 'panel', 'suma', 'duelos'];

export function ajusteValido(cual, valor) {
  // ↩️ `null` vale en todos (25/10/2026): «Deshacer» del historial vuelve a poner lo de antes, y antes de tocarlo por
  // primera vez lo de antes es `null`; estos cuatro lo rechazaban con un 400 «valor»
  if (cual === 'campana_pausada') return valor === null ? null : typeof valor === 'boolean' ? valor : undefined;
  // 🎟️ el sorteo del Pase premium (25/10/2026): `{id, cierra, sorteo}` (ISO), o `null` para sacarlo. Cierra antes de sortear
  if (cual === 'pase_sorteo') {
    if (valor === null) return null;
    const id = String((valor && valor.id) || ''), c = Date.parse((valor && valor.cierra) || ''), so = Date.parse((valor && valor.sorteo) || '');
    if (!/^[a-z0-9-]{3,30}$/.test(id) || !Number.isFinite(c) || !Number.isFinite(so) || c > so) return undefined;
    return { id, cierra: new Date(c).toISOString(), sorteo: new Date(so).toISOString() };
  }
  // 👥 las crews (19/10/2026): cuánto cuesta crear una (Puntos de Tienda) y cómo se arma su ranking (`{modo, n}`)
  if (cual === 'crew_precio') return CW.precioValido(valor);
  // 💸 y cuánto cuesta cambiarle el nombre (o la sigla) y el logo (Dlx, 19/10/2026: «cuesta plata»)
  if (cual === 'crew_precio_nombre' || cual === 'crew_precio_logo') return CW.precioValido(valor);
  if (cual === 'crews_ranking') return CW.rankingValido(valor);
  // 🏆 los números de los tiers de las crews (`bot/crews_tiers.py` los lee): `{sube, baja, juegan}`, `null` = los de siempre
  if (cual === 'crews_tiers_num') return CW.tiersValidos(valor);
  // 🤝 el nivel de cada servidor (`bot/tiers.py`, Dlx 18/10/2026): `{sigla: 1|2|3}`. El ciclo lo copia a datos/niveles.json
  // 👑 el dueño de cada socio para su panel, cuando el de Discord no es (19/10/2026, «lo corregís vos»): `{sigla: [ids]}`
  if (cual === 'socios_duenos') {
    if (valor === null) return null;
    if (!valor || typeof valor !== 'object' || Array.isArray(valor) || Object.keys(valor).length > 60) return undefined;
    const out = {};
    for (const [k, v] of Object.entries(valor)) {
      if (!/^[A-Z]{2,6}$/.test(k) || !Array.isArray(v) || v.length > 3 || !v.every((x) => /^[0-9]{15,22}$/.test(String(x)))) return undefined;
      if (v.length) out[k] = [...new Set(v.map(String))];
    }
    return out;
  }
  // ✋ las promos a mano (Dlx, 20/10/2026: «agregar y qué cosas añadir o borrar manualmente en PROMO»): las que agrega,
  // `[{u, quien, sv, dias, t}]`, y los links que saca. Las aplica `bot/promos.py`
  if (cual === 'promos_mano') {
    if (valor === null) return null;
    if (!Array.isArray(valor) || valor.length > 30) return undefined;
    const out = [];
    for (const x of valor) {
      const u = String((x && x.u) || '').trim(), q = String((x && x.quien) || '').trim(), sv = String((x && x.sv) || '');
      const d = x && x.dias, t = String((x && x.t) || '');
      if (!/^https:\/\/[^\s]{6,300}$/.test(u) || q.length > 40 || (sv && !/^[A-Z]{2,6}$/.test(sv)) || !Number.isInteger(d) || d < 1 || d > 30
        || !Number.isFinite(Date.parse(t))) return undefined;
      out.push({ u, quien: q, sv, dias: d, t: new Date(Date.parse(t)).toISOString() });
    }
    return out;
  }
  if (cual === 'promos_quitar') {
    if (valor === null) return null;
    if (!Array.isArray(valor) || valor.length > 200 || !valor.every((u) => /^https:\/\/[^\s]{6,300}$/.test(String(u)))) return undefined;
    return [...new Set(valor.map(String))];
  }
  // 🎛️ los beneficios de cada servidor (20/10/2026): `{sigla: {beneficio: bool}}`, los seis de `bot/tiers.py` BENEFICIOS
  if (cual === 'beneficios') {
    if (valor === null) return null;
    if (!valor || typeof valor !== 'object' || Array.isArray(valor) || Object.keys(valor).length > 60) return undefined;
    const out = {};
    for (const [k, v] of Object.entries(valor)) {
      if (!/^[A-Z]{2,6}$/.test(k) || !v || typeof v !== 'object' || Array.isArray(v)) return undefined;
      const b = {};
      for (const [n, x] of Object.entries(v)) {
        if (!BENEFICIOS_SV.includes(n) || typeof x !== 'boolean') return undefined;
        b[n] = x;
      }
      out[k] = b;
    }
    return out;
  }
  // ➕ los servidores que Dlx da de alta (20/10/2026): `{sigla: {n, g, t, tag}}`; el ciclo los suma (`bot/tiers.py altas()`)
  if (cual === 'altas') {
    if (valor === null) return null;
    if (!valor || typeof valor !== 'object' || Array.isArray(valor) || Object.keys(valor).length > 30) return undefined;
    const out = {};
    for (const [k, v] of Object.entries(valor)) {
      if (!/^[A-Z]{2,6}$/.test(k) || !v || typeof v !== 'object') return undefined;
      const n = String(v.n || '').trim(), g = String(v.g || ''), tag = String(v.tag || '').trim();
      if (!n || n.length > 60 || !/^[0-9]{15,22}$/.test(g) || ![1, 2, 3].includes(v.t) || tag.length > 24) return undefined;
      out[k] = tag ? { n, g, t: v.t, tag } : { n, g, t: v.t };
    }
    return out;
  }
  if (cual === 'tiers') {
    if (valor === null) return null;
    if (!valor || typeof valor !== 'object' || Array.isArray(valor) || Object.keys(valor).length > 60) return undefined;
    const out = {};
    for (const [k, v] of Object.entries(valor)) {
      if (!/^[A-Z]{2,6}$/.test(k) || ![1, 2, 3].includes(v)) return undefined;
      out[k] = v;
    }
    return out;
  }
  // 🏆 los nominados que Dlx saca de los MES AWARDS antes de que abra la votación (`bot/mes_awards.py`): `{mes, quitar}`
  if (cual === 'mes_sacar') {
    if (valor === null) return null;
    if (!valor || typeof valor !== 'object' || !/^\d{4}-\d{2}$/.test(String(valor.mes || '')) || !Array.isArray(valor.quitar)
      || valor.quitar.length > 80) return undefined;
    const q = [];
    for (const x of valor.quitar) {
      const s = String(x || '');
      // 🏟️ `cat:op` los de la Liga y `SV/cat:op` los de cada servidor (18/10/2026)
      const m = /^(?:([A-Z]{2,6})\/)?([a-z]{3,14}):.{1,80}$/.exec(s);
      // (`hasOwn`: «constructor» pasa la expresión y está en cualquier objeto, pasada del 19/10/2026)
      if (!m || !Object.hasOwn(MES_CAT, m[2])) return undefined;
      if (!q.includes(s)) q.push(s);
    }
    return { mes: valor.mes, quitar: q };
  }
  if (cual === 'multiplicadores') {
    if (valor === null) return null;
    if (!valor || typeof valor !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(String(valor.semana || ''))) return undefined;
    const sv = {};
    for (const [k, f] of Object.entries(valor.sv || {})) {
      // los de `FACTORES` y también el que ya tenía la semana (×2,25 con la guerra): de ×0,5 a ×5, hasta 3 decimales
      const x = Number(f);
      if (!/^[A-Z]{2,6}$/.test(k) || !(x >= 0.5 && x <= 5) || Math.abs(Math.round(x * 1000) - x * 1000) > 1e-6) return undefined;
      sv[k] = Math.round(x * 1000) / 1000;
    }
    if (Object.keys(sv).length > 20) return undefined;
    // `t`: desde cuándo vale (el ciclo lo aplica desde ahí, no a la semana entera: ver `a_mano()` de multiplicadores.py)
    return Object.keys(sv).length ? { semana: valor.semana, sv, t: new Date().toISOString() } : null;
  }
  if (cual === 'aviso_web') {
    if (valor === null) return null;
    const texto = String((valor && valor.texto) || '').trim().slice(0, 240);
    const hasta = Date.parse((valor && valor.hasta) || '');
    if (!texto || !hasta || hasta < Date.now()) return undefined;
    return { texto, hasta: new Date(Math.min(hasta, Date.now() + 30 * DIA_MS)).toISOString() };
  }
  if (cual === 'en_vivo') {
    if (valor === null) return null;
    if (!valor || typeof valor !== 'object') return undefined;
    const out = {};
    for (const [k, v] of Object.entries(valor)) {
      if (!/^[A-Z]{2,6}$/.test(k) || typeof v !== 'boolean') return undefined;
      out[k] = v;
    }
    return out;
  }
  if (cual === 'eventos_discord') {
    if (valor === null) return null;
    if (!valor || typeof valor !== 'object') return undefined;
    const out = {};
    for (const [k, v] of Object.entries(valor)) {
      if (!/^[A-Z]{2,6}$/.test(k) || typeof v !== 'boolean') return undefined;
      out[k] = v;
    }
    return out;
  }
  if (cual === 'avisos_nivel') {
    if (valor === null) return null;
    return Object.prototype.hasOwnProperty.call(NIVELES_AVISO, valor) ? valor : undefined;
  }
  if (cual === 'en_vivo_nivel') {
    if (valor === null) return null;
    if (!valor || typeof valor !== 'object') return undefined;
    const out = {};
    for (const [k, v] of Object.entries(valor)) {
      if (!/^[A-Z]{2,6}$/.test(k) || !Object.prototype.hasOwnProperty.call(NIVELES_CHAT, v)) return undefined;
      out[k] = v;
    }
    return out;
  }
  // 🎛️ LOS DE MÁS (07/10/2026): `null` vuelve a lo de siempre. Ver `apuestasCfg()`, `ritmoCfg()`, `enSilencio()` y
  // `canalesChat()`
  if (cual === 'apuestas') {
    if (valor === null) return null;
    if (!valor || typeof valor !== 'object') return undefined;
    // de 2 a 4 botones, de menor a mayor, de 10 a 5.000; de 1 a 15 minutos; el tope, desde el botón más alto
    const montos = (Array.isArray(valor.montos) ? valor.montos : []).map(Number);
    if (montos.length < 2 || montos.length > 4 || montos.some((m, i) => !Number.isInteger(m) || m < 10 || m > 5000
        || (i && m <= montos[i - 1]))) return undefined;
    const minutos = Number(valor.minutos), tope = Number(valor.tope);
    if (!Number.isInteger(minutos) || minutos < 1 || minutos > 15) return undefined;
    if (!Number.isInteger(tope) || tope < montos[montos.length - 1] || tope > 20000) return undefined;
    const apagadas = {}, prendidas = {};
    for (const [k, v] of Object.entries(valor.apagadas || {})) {
      if (!/^[A-Z]{2,6}$/.test(k) || v !== true) return undefined;
      apagadas[k] = true;
    }
    // 🎲 prendidas a mano, en cualquier nivel del bot en vivo (13/10/2026, ver `hayApuestas()`)
    for (const [k, v] of Object.entries(valor.prendidas || {})) {
      if (!/^[A-Z]{2,6}$/.test(k) || v !== true) return undefined;
      prendidas[k] = true;
    }
    return { montos, minutos, tope, apagadas, prendidas };
  }
  if (cual === 'aviso_evento') {
    if (valor === null) return null;
    if (!valor || typeof valor !== 'object') return undefined;
    const sv = {};
    for (const [k, v] of Object.entries(valor.sv || {})) {
      if (!/^[A-Z]{2,6}$/.test(k) || (v !== 'no' && v !== 'chat')) return undefined;
      sv[k] = v;
    }
    const resto = String(valor.resto || '');
    if (resto && !/^[A-Z]{2,6}$/.test(resto)) return undefined;
    return { sv, resto };
  }
  if (cual === 'silencio') {
    if (valor === null) return null;
    const hh = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!valor || !hh.test(String(valor.desde || '')) || !hh.test(String(valor.hasta || ''))
        || valor.desde === valor.hasta) return undefined;
    return { desde: valor.desde, hasta: valor.hasta };
  }
  if (cual === 'ritmo') {
    if (valor === null) return null;
    const n = Number(valor && valor.normal), b = Number(valor && valor.batalla);
    if (!Number.isInteger(n) || n < 3 || n > 30 || !Number.isInteger(b) || b < 1 || b > 10) return undefined;
    return { normal: n, batalla: b };
  }
  return undefined;
}
// 🛡️ LOS PERMISOS INVENTADOS NO LLEGAN A DISCORD (04/10/2026, la lista de seguridad de Dlx). Cada permiso falso era un
// 401 de Discord, y Discord bloquea un rato la IP que junta muchos (10.000 en 10 minutos): con el vigía, los apodos y
// verificar saliendo por las mismas IPs de Cloudflare, un script con permisos al azar podía dejar mudo al bot. Dos
// frenos, en la memoria de cada instancia (no gastan KV): un permiso que ya falló no se vuelve a preguntar en 10
// minutos, y si en un minuto fallan más de `FALSOS_MIN`, los permisos que no se conocen esperan ese minuto con
// «Discord ocupado» —la página no manda a nadie a autorizar de nuevo—. Uno bueno recién traído pasa igual.
const FALSOS = new Map();
const FALSOS_MIN = 30;
let falsosMin = { t: 0, n: 0 };
function falso(t) {
  const ahora = Date.now();
  if (FALSOS.size > 5000) FALSOS.clear();
  FALSOS.set(t, ahora + 10 * 60000);
  if (ahora - falsosMin.t > 60000) falsosMin = { t: ahora, n: 0 };
  if (++falsosMin.n === FALSOS_MIN + 1) console.warn('[seguridad] más de ' + FALSOS_MIN + ' permisos de Discord falsos en un minuto: frenado');
  return { error: 'token' };
}
export async function discordDe(t) {
  if (!/^[A-Za-z0-9._-]{10,300}$/.test(String(t || ''))) return { error: 'token' };
  const ahora = Date.now();
  if ((FALSOS.get(t) || 0) > ahora) return { error: 'token' };
  if (falsosMin.n > FALSOS_MIN && ahora - falsosMin.t < 60000) return { error: 'ocupado' };
  try {
    const r = await fetch(`${DC}/oauth2/@me`, { headers: { Authorization: 'Bearer ' + t, 'User-Agent': UA } });
    if (r.status === 401 || r.status === 403) return falso(t);
    if (!r.ok) return { error: 'ocupado', estado: r.status };
    const a = await r.json();
    if (!a || !a.application || String(a.application.id || '') !== APP_ID) return falso(t);
    const u = a.user;
    return u && /^[0-9]{5,25}$/.test(String(u.id || '')) ? { id: String(u.id), u } : { error: 'token' };
  } catch (e) {
    return { error: 'ocupado' };
  }
}

// ── la sesión: entrar una vez ───────────────────────────────────────────
// 🔑 Dlx, 28/09/2026, con el ciclo de arriba: el permiso de Discord vivía
// sólo en la memoria de la página, así que cada visita era otro viaje a
// Discord para votar. Ahora, al entrar con Discord (`/cuenta`), el objeto
// anota una SESIÓN de `SESION_DIAS` y el navegador la guarda en una cookie
// que el JS de la página no puede leer (HttpOnly, SameSite=Strict, sólo
// `/api`). El proxy de Pages la pasa al Worker como `x-lg-ses`.
//
// ⚠️ SIN SECRETO NUEVO (los tokens nuevos quedaron para el final): la sesión
// es un número al azar que sólo existe en el objeto, no una firma. Y el
// objeto guarda su hash, no el número: una copia de la base no sirve para
// entrar.
export const SESION_DIAS = 30;
export const COOKIE = 'lg_ses';

/** El `Set-Cookie` de la sesión; con `segundos` 0, la borra. */
export function cookieSesion(ses, segundos) {
  return `${COOKIE}=${ses}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${segundos}`;
}

async function alObjetoSesion(env, sub, cuerpo) {
  if (!env.AVISOS) return null;
  try {
    const r = await elObjeto(env).fetch('https://avisos/sesion/' + sub, {
      method: 'POST', body: JSON.stringify(cuerpo), headers: { 'content-type': 'application/json' },
    });
    return r.ok ? await r.json() : null;
  } catch (e) {
    return null;
  }
}

/** Una sesión nueva para ese Discord ID: `{ses, vence}`, o `null`. */
export async function sesionNueva(env, quien) {
  if (!/^[0-9]{5,25}$/.test(String(quien || ''))) return null;
  return alObjetoSesion(env, 'nueva', { quien: String(quien) });
}

const sesDe = (req) => {
  const s = String((req && req.headers && req.headers.get('x-lg-ses')) || '');
  return /^[A-Za-z0-9_-]{30,100}$/.test(s) ? s : '';
};

/** El Discord ID de la sesión de este pedido, o `''`. */
export async function sesionDe(env, req) {
  const ses = sesDe(req);
  if (!ses) return '';
  const r = await alObjetoSesion(env, 'quien', { ses });
  return r && /^[0-9]{5,25}$/.test(String(r.quien || '')) ? String(r.quien) : '';
}

/** Cierra la sesión de este pedido («Salir»). */
export async function sesionFin(env, req) {
  const ses = sesDe(req);
  return ses ? alObjetoSesion(env, 'fin', { ses }) : null;
}

/**
 * Quién pide: con un permiso de Discord recién traído (`token`), o con su
 * sesión. `{id}` o `{error, estado}`: 401 si hay que entrar con Discord, 503
 * si Discord no contesta (y entonces NO se manda a nadie a autorizar).
 */
export async function quienPide(req, env, d) {
  const t = String((d && d.token) || '');
  const q = t ? await discordDe(t) : { id: await sesionDe(env, req) };
  if (q.id) { await anotarUso(env, q.id, 'web'); return { id: q.id }; }
  if (q.error === 'ocupado') return { error: 'discord_ocupado', estado: 503 };
  return { error: t ? 'discord' : 'sin_sesion', estado: 401 };
}

const elObjeto = (env) => env.AVISOS.get(env.AVISOS.idFromName('liga'));

// ═════════════════════════════════════════════════════════════════════
// LAS LLAVES EN VIVO
// ═════════════════════════════════════════════════════════════════════
//
// 🔑 Dlx, 27/09/2026: «llaves en vivo… como las notificaciones, que se
// chequean cada 1 minuto». El vigía ya lee Discord cada minuto: ahora también
// los canales de llaves de la Liga, y guarda el texto de cada llave que se
// está jugando. NO LA LEE: el lector son dos mil líneas de reglas y el Worker
// tiene 10 ms. La lee la página, con `bot/paginas/llave_vivo.js`.
//
// ⚠️ UN CANAL SE LEE CADA MINUTO SÓLO SI ESTÁ «CALIENTE» —tuvo una llave en
// las últimas 3 horas—; los demás, uno cada cinco minutos, para enterarse
// cuando arranca una. Así el vigía no gasta pedidos cuando no se juega nada.

//: cuántas horas se muestra una llave después de su último cambio
export const VIVO_HORAS = 6;
/** cuántos mensajes se le piden a cada canal de llaves por lectura */
export const VIVO_LEE = 4;
// 🔔 el estado de un aviso que no salió —la campana estaba pausada, o el evento ya había empezado— pero que ES un
// evento: no lo toma la alarma (sólo el 0) y no lo filtra nadie que pregunte `estado != 2` (ver `lote()`)
export const NO_SALIO = 4;

// 📏 CÓMO SE ANOTA UNA CLAVE DE KV EN `medidas`, que es público (`/avisos/estado`): las globales con su nombre y las
// de alguien —una persona o un servidor— sólo por su prefijo. Al revés que antes, que era una lista de prefijos
// personales: una clave nueva se colaba con el dueño adentro —`redes:<perfil>`, `pnick:<guild>:<id>`— (revisión del
// 05/10/2026). La usan el objeto y el Worker (`kvMedido()`)
const KV_GLOBALES = /^(meta|web:[a-z]+|turnos:nombres|precios|precios:resolucion|encuestas)$/;
export function claveMedida(k) {
  const s = String(k || '');
  const i = s.indexOf(':');
  return KV_GLOBALES.test(s) ? s : i < 0 ? 'otra' : s.slice(0, Math.min(i, 20)) + ':*';
}

/**
 * 🔴 LAS LLAVES QUE SE BORRARON EN DISCORD, SE BORRAN ACÁ. El vigía guarda
 * cada llave hasta `VIVO_HORAS` y no recibe los borrados: el 28/09/2026 una
 * llave de burla —«PLAYER ES CACORRO», en las llaves de Urban Freestyle— se
 * borró a los minutos y la página la siguió mostrando «en vivo» al lado de
 * la de verdad.
 *
 * La lectura trae los `limite` mensajes más nuevos del canal, así que todo
 * lo guardado que sea MÁS NUEVO que el más viejo de la lectura tendría que
 * estar ahí: si no está, lo borraron. Si trajo menos de `limite`, la lectura
 * es el canal entero. Si falló (`msgs` no es una lista), no se sabe nada y no
 * se toca nada. Devuelve los ids a sacar.
 */
export function borradasDelCanal(guardadas, msgs, limite) {
  if (!Array.isArray(msgs)) return [];
  const ids = new Set(msgs.map((m) => String(m.id)));
  let piso = null;
  try {
    for (const m of msgs) {
      const n = BigInt(String(m.id));
      if (piso === null || n < piso) piso = n;
    }
  } catch (e) {
    return [];
  }
  return guardadas.map(String).filter((id) => {
    if (ids.has(id)) return false;
    if (msgs.length < limite) return true;
    try { return piso !== null && BigInt(id) > piso; } catch (e) { return false; }
  });
}
//: cuántos canales de llaves se leen como mucho por minuto
export const VIVO_TOPE = 4;

/** ¿Parece una llave? Barato: una ronda y al menos dos batallas o marcos. */
export function pareceLlave(texto) {
  // ⚠️ CON LAS LETRAS DE FANTASÍA EN LETRAS COMUNES: Snake Rap escribe sus
  // rondas `𝙲𝚄𝙰𝚁𝚃𝙾𝚂` y `𝙵𝙸𝙽𝙰𝙻`, y sin esto sus llaves no se guardaban nunca
  // 🌲 y las parecidas de otros alfabetos (`latino()`): `ᎾᏟᎢᎪᏙᎾᏚ` es OCTAVOS
  const s = latino(texto);
  // 🔑 Y EL PODIO SUELTO: a veces el campeón va en un mensaje aparte (FFA
  // WORLD CUP, 27/09/2026) y la página lo pega a su llave (`unirPartidas()`
  // de `llave_vivo.js`). Sin guardarlo, la final quedaba «en juego» siempre.
  if (/CAMPEON|\b(?:1\s*(?:ER|RO)|PRIMER)\s+PUESTO/i.test(s.replace(/[\u0300-\u036f]/g, ''))) return true;
  // \ud83d\udd11 LA NAVE DE FUNA, desde la fase: una lista con \u274c y sin \ud83c\udd9a todav\u00eda (Dlx,
  // 29/09/2026). La p\u00e1gina la lee con `funaDe()` de `llave_vivo.js`.
  // y la de EXTERMINACI\u00d3N (03/10/2026), que marca a cada uno con \u00abELIMINADO #N\u00bb en vez de \u274c: sin eso, una lista de la
  // fase sin los adornos de esa llave no se guardaba (revisi\u00f3n del 04/10/2026)
  if (/fase\s+de\s+eliminaci|nave\s+de\s+funa|exterminaci|aniquilaci|c[iy]pher/i.test(s) &&
      (s.match(/[\u231d\]\u300d\u300f\u274c]/g) || []).length +
      (s.match(/\bELIM\w{0,4}NAD[OA]S?\b/gi) || []).length >= 4) return true;
  // 🐍 y los marcos y «vs» de `escuchar.MARCOS_MAS` / `VS_ENTRE` (07/10/2026): Snake Rap escribió `(< A >) ⚔️ (< B >)`
  // y la llave no se guardaba —ninguna marca de las de antes—, así que ni el bot ni la página la vieron en vivo.
  // ⚠️ `s` va en NFKD: `［］` ya llega como `[]`
  // 🌲 y sin ninguna ronda legible, la FORMA: cuatro renglones con «vs» o más. Se guarda y la página la lee por bloques
  // (`rondasPorForma()` de `llave_vivo.js`); si no le saca batallas, no muestra nada
  if (conVs(s) >= 4) return true;
  return /(filtros?|clasificatoria|octavos|cuartos|semi|final)/i.test(s) &&
    (s.match(/🆚|\bvs\b|<a?:\w*vs\w*:\d+>|⌝|\]|」|〉|>\s*\)|[】〕》⟩⟧〗⦘❱❯❭❩❫❳❵⟫⟭⟯⦆〙〛⸩⁆]|[\u{2694}\u{1F5E1}\u{2716}\u{2715}\u{2717}\u{26A1}\u{1F4A5}\u{1F94A}\u{1F91C}\u{1F52A}]|\b(?:versus|vrs|contra)\b/giu) || []).length >= 2;
}

/** El texto con cada `<@id>` como `@Nombre`: Discord manda quién es cada mención. */
export function conNombres(m) {
  const n = {};
  for (const u of (m && m.mentions) || []) {
    const x = (u.member && u.member.nick) || u.global_name || u.username || '';
    if (u.id && x) n[u.id] = x;
  }
  return String((m && m.content) || '').replace(/<@!?(\d+)>/g, (t, id) => (n[id] ? '@' + n[id] : t));
}

// ── 🕵️ QUIÉN ES CADA NOMBRE DE UNA LLAVE EN VIVO (02/10/2026) ───────────────────────────────────────────────────
// Dlx: «te dije múltiples vías para detectar quiénes participan: las inscripciones dentro del canal de inscritos,
// quiénes están en las llamadas y los veredictos… asegúrate de que en vivo se mejore más aún… esto es lo más difícil de
// este sistema, reconocer a las personas, y más cuando hacen esas cosas troll». El ciclo ya cruzaba esas pistas, pero
// cada media hora y para la planilla; la llave en vivo sólo sabía los nombres de la tabla y los alias. Ahora el vigía,
// cada minuto y sólo con llaves en vivo, dice de qué cuenta es cada nombre:
//   · la INSCRIPCIÓN de la propia cuenta en ese servidor, con un solo nombre —y no la de quien anota a otros: la regla
//     de `decidir._inscritos()`—;
//   · la LLAMADA de ese servidor (`voz:<SV>`, ver `bot/en_llamada.py`): el apodo, el nombre visible o el usuario;
//   · la MENCIÓN de la llave: lo que Discord trae de cada `<@ID>`.
// ⚠️ SÓLO EL NOMBRE EXACTO (sin banderas ni tildes) Y DE UNA SOLA CUENTA: dos cuentas para un nombre no son ninguna.
// ⚠️ Y A LA PÁGINA VA EL PERFIL, NUNCA EL ID: de la cuenta al perfil por `d:`/`dn:`, las claves de `/card`.

const HISTORIA_VIVO = /\s*[(（][^()（）]*[)）]?\s*$/u;

/** El nombre como lo compara la página (`normNombre()` de app.js), sin la historia `(…)` del final. */
export function normPagina(s) {
  return String(s || '').replace(HISTORIA_VIVO, '').normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

/** Los nombres de una inscripción, como `decidir._nombres_insc()`: sin la nota entre paréntesis, partidos por `+ & , /`,
 *  «y», «e» y la bandera que separa dos nombres. */
export function nombresInscripcion(texto) {
  const t = String(texto || '').replace(/\(.*?\)|\(.*$/g, ' ');
  const out = [];
  for (const p of t.split(/\s*(?:\+|&|,|\/|\by\b|\be\b)\s*/i)) {
    for (const q of p.split(/(?:[\u{1F1E6}-\u{1F1FF}]{2}\s*)+(?=[^\s\u{1F1E6}-\u{1F1FF}])/u)) {
      const n = normPagina(q);
      if (n.length >= 2) out.push(n);
    }
  }
  return out;
}

/** `{id: [apodo, nombre visible, usuario]}` de las menciones de un mensaje (`escuchar.menciones_de()`). */
export function mencionesDe(m) {
  const out = {};
  for (const u of (m && m.mentions) || []) {
    if (!u || !/^\d+$/.test(String(u.id || ''))) continue;
    const ns = [(u.member && u.member.nick) || '', u.global_name || '', u.username || ''].filter(Boolean);
    if (ns.length) out[u.id] = ns;
  }
  return out;
}

/** `Map(nombre normalizado -> Set(cuentas))` con las tres pistas. Ver el encabezado de esta sección. */
export function indiceVivo(inscritos, voz, menciones) {
  const idx = new Map();
  const poner = (n, id) => {
    const k = normPagina(n);
    if (k.length < 3 || !id) return;
    if (!idx.has(k)) idx.set(k, new Set());
    idx.get(k).add(String(id));
  };
  const por = new Map();
  for (const x of inscritos || []) {
    const id = String((x && x.autor_id) || '');
    const ns = nombresInscripcion(x && x.texto);
    if (!/^\d+$/.test(id) || ns.length !== 1) continue;
    if (!por.has(id)) por.set(id, []);
    por.get(id).push(ns[0]);
  }
  // dos grafías del mismo («prr» y «prrr») valen; dos nombres distintos desde una cuenta son alguien anotando a otros
  for (const [id, ns] of por) {
    const corto = ns.reduce((a, b) => (b.length < a.length ? b : a));
    if (ns.every((n) => n.indexOf(corto) >= 0)) ns.forEach((n) => poner(n, id));
  }
  for (const [id, e] of Object.entries(voz || {})) for (const n of (e && e.n) || []) poner(n, id);
  for (const [id, ns] of Object.entries(menciones || {})) for (const n of ns || []) poner(n, id);
  return idx;
}

/** `{nombre normalizado: cuenta}` de los nombres que tienen UNA sola cuenta en el índice. */
export function quienesDe(nombres, idx) {
  const out = {};
  for (const n of nombres || []) {
    const k = normPagina(n);
    const s = idx.get(k);
    if (k.length >= 3 && s && s.size === 1) out[k] = [...s][0];
  }
  return out;
}

// ── 🙋 LOS ANOTADOS DE CADA EVENTO, ANTES DE LA LLAVE (03/10/2026, Dlx: «que se PREVEA las personas que se han
// inscrito», y al plan: «Me gusta tu A»: «12 anotados» con las caras en la tarjeta del evento, sólo lo que parece una
// inscripción) ──
// 🔑 LA REGLA ES LA DEL CICLO (`es_inscripcion()` de bot/anuncios.py, medida sobre el canal de FFA): anotarse es decir
// quién sos, con tu bandera o con un nombre que la Liga ya conoce, y una pregunta nunca es una inscripción. Acá se
// saca lo que NO puede ser —una pregunta, un aviso del organizador, una frase— y se marca si trae bandera; lo del
// nombre conocido lo decide la página, que es la que tiene el padrón (`Liga.anotados()`).
/**
 * Las PERSONAS de una inscripción, `[{aka, cc, b}]`, o `null` si no parece una. Cada una pasa por `pareceAnotado()`.
 *
 * 🔑 LA REDENCION (FFA, MULTIVERSE, 03/10/2026) trajo lo que la primera versión no sabía leer —Dlx: «me gusta el
 * sistema de inscripciones… pero hay algunas fallas»—:
 *   «Trot 🇪🇸+?», «Dyzz🇨🇱 +??»           el compañero por definir no es nadie, y NO tira la inscripción: el «?»
 *                                          la descartaba entera, y Trot no aparecía
 *   «Crk🇲🇽  primera», «nc🇮🇶primera»       «primera» es llegar primero, no el nombre
 *   «Eclipse🇨🇱 +alter🇨🇱», «Zignos 🇩🇴 - Abyssus 🇨🇦», «yinn+ji sung park»
 *                                          un equipo: una persona por lado (`+`, `&`, `,`, ` y `, ` - ` con espacios:
 *                                          «Park-Ji Sung» es uno)
 *   «PichulaMc PolloSport Erian 🇦🇷 🇦🇷 🇵🇦»   los nombres primero y las banderas después, en el mismo orden
 *   «HASSAN🇦🇷 ABYSSUS🇵🇦»                  cada uno con su bandera, sin separador
 * ⚠️ Dos banderas pegadas son de UNA persona (`dxg🇲🇽🇨🇴`), como en `escuchar._equipo_de_banderas()`.
 */
export function personasDeInscripcion(texto) {
  let t = String(texto || '').trim();
  if (!t || /@everyone|@here|<@&\d+>/.test(t)) return null;
  if (/inscrip/i.test(t) && /abiert|cerrad|se abren|se cierran|abrimos|cerramos/i.test(t)) return null;
  t = t.replace(/\s*[+&]\s*[?¿]+/g, ' ');
  if (/[?¿]/.test(t)) return null;
  t = t.replace(/(^|[^\p{L}\p{N}])(?:primer[oa]?|1r[oa]|first)(?![\p{L}\p{N}])/giu, '$1 ').trim();
  const RI = '\\p{Regional_Indicator}';
  const partes = [];
  for (const p0 of t.split(/\s*[+&,]\s*|\s+-\s+|\s+y\s+/iu)) {
    const p = p0.trim();
    if (!p) continue;
    const banderas = p.match(new RegExp(RI + RI, 'gu')) || [];
    const sueltas = banderas.length >= 2 && !new RegExp(RI + RI + RI + RI, 'u').test(p);
    // nombres primero, banderas después y tantas como nombres
    const m = sueltas && new RegExp('^([^' + '\\p{Regional_Indicator}' + ']+?)\\s*((?:' + RI + RI + '\\s*)+)$', 'u').exec(p);
    const nombres = m ? m[1].trim().split(/\s+/) : [];
    if (m && nombres.length === banderas.length) {
      nombres.forEach((n, i) => partes.push(n + ' ' + banderas[i]));
    } else if (sueltas) {
      // cada uno con su bandera: se corta después de cada bandera que sigue un nombre
      for (const q of p.split(new RegExp('(?<=' + RI + RI + ')\\s*(?=[\\p{L}\\p{N}])', 'u'))) partes.push(q);
    } else {
      partes.push(p);
    }
  }
  const out = partes.slice(0, 8).map(pareceAnotado).filter(Boolean);
  return out.length ? out : null;
}

export function pareceAnotado(texto) {
  const t = String(texto || '').trim();
  if (!t || t.indexOf('?') >= 0) return null;
  if (/@everyone|@here|<@&\d+>/.test(t)) return null;
  // «INSCRIPCIONES ABIERTAS», «cerramos inscripciones»: la marca del organizador, no alguien anotándose
  if (/inscrip/i.test(t) && /abiert|cerrad|se abren|se cierran|abrimos|cerramos/i.test(t)) return null;
  const m = /([\u{1F1E6}-\u{1F1FF}])([\u{1F1E6}-\u{1F1FF}])/u.exec(t);
  let cc = m ? String.fromCharCode(m[1].codePointAt(0) - 0x1F1E6 + 97, m[2].codePointAt(0) - 0x1F1E6 + 97) : '';
  // y la bandera de un emoji del servidor, con el país en el NOMBRE (`Kravitz<a:COSTARICA:…>`, `_bandera()` de Python)
  if (!cc) {
    for (const x of t.matchAll(/<a?:(\w+):\d+>/g)) {
      const p = PAIS_EMOJI[x[1].normalize('NFKD').replace(/[^A-Za-z]/g, '').toUpperCase()];
      if (p) { cc = p; break; }
    }
  }
  const aka = t.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, ' ').replace(/<a?:\w+:\d+>/g, ' ').replace(/<@[&!]?\d+>/g, ' ')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/[*_`~|#>]/g, ' ').replace(/\s+/g, ' ').trim();
  // un nombre, no una frase (`parece_inscripcion()` de bot/inscripciones.py: hasta tres palabras)
  if (!aka || aka.length > 28 || aka.split(' ').length > 3) return null;
  return { aka, cc, b: !!cc };
}
const PAIS_EMOJI = { ARGENTINA: 'ar', CHILE: 'cl', COLOMBIA: 'co', MEXICO: 'mx', PERU: 'pe', VENEZUELA: 've', ESPANA: 'es',
  ECUADOR: 'ec', URUGUAY: 'uy', PARAGUAY: 'py', BOLIVIA: 'bo', COSTARICA: 'cr', GUATEMALA: 'gt', HONDURAS: 'hn',
  NICARAGUA: 'ni', PANAMA: 'pa', PUERTORICO: 'pr', DOMINICANA: 'do', REPUBLICADOMINICANA: 'do', ELSALVADOR: 'sv',
  CUBA: 'cu', USA: 'us', ESTADOSUNIDOS: 'us' };

/** El momento de un mensaje de Discord, de su id (los ids llevan la hora adentro). */
export function msDeId(id) {
  try { return Number(BigInt(String(id)) >> 22n) + 1420070400000; } catch (e) { return 0; }
}

/**
 * `{id del anuncio: [{n, aka, cc, b, autor}]}`. Cada inscripción es del evento de ese servidor que ya estaba anunciado
 * cuando se anotó y que arranca primero —uno que ya arrancó, hasta media hora después: alguien que entra justo—. Así se
 * separan dos eventos del mismo servidor el mismo día; si no hay ninguno, no es de nadie. La misma persona dos veces
 * (se volvió a anotar, o la anotó otro) va una vez, la primera.
 */
export function anotadosDe(eventos, inscritos) {
  const out = {};
  for (const x of inscritos || []) {
    // 🔑 una inscripción puede traer a varios: un equipo del MULTIVERSE (ver `personasDeInscripcion()`)
    const ps = personasDeInscripcion(x && x.texto);
    if (!ps) continue;
    const e = (eventos || []).filter((y) => y.sv === x.sv && y.pub <= x.pub && x.pub <= y.ini + 30 * MIN)
      .sort((a, b) => a.ini - b.ini)[0];
    if (!e) continue;
    const l = out[e.id] = out[e.id] || [];
    for (const p of ps) {
      const n = p.aka.normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
      if (!n || l.some((y) => y.n === n)) continue;
      // `msg`: de qué mensaje salió, para la cara de la cuenta (`anotados()` del objeto)
      l.push({ n, aka: p.aka, cc: p.cc, b: p.b, autor: String((x && x.autor_id) || ''), msg: String((x && x.pub) || '') });
    }
  }
  return out;
}

/** ¿Esa clave de la Liga es de ese nombre? `volk-co` es `volk`; `parkjisung` contiene `park`… desde 4 letras. */
export function claveDeNombre(n, k) {
  const kk = String(k || '').toLowerCase().replace(/-[a-z0-9]{1,3}$/, '').replace(/[^\p{L}\p{N}]/gu, '');
  if (!n || !kk || n.length < 2) return false;
  return n === kk || (n.length >= 4 && kk.length >= 4 && (kk.includes(n) || n.includes(kk)));
}

/**
 * `/avisos/*` del Worker. Lo llama el proxy de Pages (`/api/avisos/*`).
 *
 * ⚠️ UNA LISTA CERRADA DE RUTAS Y METODOS. El `POST /` del Worker son las
 * interacciones de Discord, con su firma; nada de acá puede caer ahí.
 */
export async function rutaAvisos(req, env, ruta) {
  const metodo = RUTAS[ruta];
  if (!metodo) return json({ error: 'no existe' }, 404);
  if (req.method !== metodo) return json({ error: 'método no permitido' }, 405);
  if (ruta === '/avisos/clave') {
    return env.VAPID_PUBLICA ? json({ clave: env.VAPID_PUBLICA }, 200, 3600)
      : json({ error: 'los avisos todavía no tienen clave' }, 503);
  }
  // 🖼️ el texto de un afiche, para el ciclo (ver `textoDeImagen()`). No pasa por el objeto: no guarda nada
  if (ruta === '/avisos/ocr') {
    const k = req.headers.get('x-lg-ciclo') || '';
    if (!env.DISCORD_TOKEN || k !== await claveCiclo(env.DISCORD_TOKEN)) return json({ error: 'no existe' }, 404);
    if (!env.AI) return json({ error: 'la IA todavía no está enchufada' }, 503);
    const buf = new Uint8Array(await req.arrayBuffer());
    if (buf.length > OCR_MAX) return json({ error: 'demasiado grande: mandala achicada' }, 413);
    if (!tipoImagen(buf)) return json({ error: 'no es una imagen' }, 400);
    try {
      const cual = new URL(req.url).searchParams.get('tipo');
      // 🛡️ y el filtro de los fondos, para probarlo con imágenes de verdad (`filtrarImagen()`)
      if (cual === 'filtro') {
        let bin = '';
        for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
        return json(await filtrarImagen(env, btoa(bin), tipoImagen(buf)));
      }
      return json(await textoDeImagen(env, buf, cual === 'llave' ? 'llave' : 'afiche'));
    } catch (e) {
      return json({ error: String((e && e.message) || e).slice(0, 200) }, 502);
    }
  }
  if (!env.AVISOS) return json({ error: 'los avisos todavía no están enchufados' }, 503);
  // 🔐 los roles de quien pide (Dlx es `owner`; los demás, los que Dlx le puso en el objeto) y si le alcanzan para `que`
  const rolesPanel = async (id) => {
    if (id === DUENO) return ['owner'];
    try {
      const r = await elObjeto(env).fetch('https://avisos/rol-de', { method: 'POST', body: JSON.stringify({ quien: id }),
        headers: { 'content-type': 'application/json' } });
      return ((await r.json()) || {}).roles || [];
    } catch (e) { return []; }
  };
  const puede = async (id, que) => puedeRol(await rolesPanel(id), que);
  // 🔒 EL DASHBOARD DEL DUEÑO (Dlx, 04/10/2026: «una página nueva creada sólo para el owner… la única manera de iniciar
  // sesión ahí es con mi cuenta»). Quién es lo dice Discord o la sesión —nunca la página—, y si no es Dlx no se
  // contesta nada: ni qué habría. El 403 queda en los registros
  // ⚙️ UN AJUSTE DEL DASHBOARD: la misma puerta que el Dashboard, y el valor se valida antes de llegar al objeto
  if (ruta === '/avisos/dueno/ajuste') {
    const crudo = await req.text();
    // 📏 16 KB y no 2: las promos a mano (30 links de hasta 300) y los beneficios de 60 servidores no entraban (25/10/2026)
    if (crudo.length > 16384) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token)))) {
      return json({ error: 'faltan datos' }, 400);
    }
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    if (!(await puede(q.id, 'ajustes'))) {
      console.warn('[seguridad] un ajuste del Dashboard lo pidió alguien que no puede');
      return json({ error: 'no' }, 403);
    }
    const v = ajusteValido(String(d.cual || ''), d.valor);
    if (v === undefined) return json({ error: 'valor' }, 400);
    return elObjeto(env).fetch('https://avisos/ajuste', {
      method: 'POST', body: JSON.stringify(Object.assign({ cual: d.cual, valor: v, por: q.id }, d.deshacer === true ? { deshacer: true } : {})), headers: { 'content-type': 'application/json' },
    });
  }
  // ▶️ CORRER EL CICLO AHORA: la misma puerta que el Dashboard (ver `cicloAMano()` del objeto)
  if (ruta === '/avisos/dueno/ciclo') {
    const crudo = await req.text();
    if (crudo.length > 1024) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token)))) {
      return json({ error: 'faltan datos' }, 400);
    }
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    if (!(await puede(q.id, 'ciclo'))) {
      console.warn('[seguridad] correr el ciclo lo pidió alguien que no puede');
      return json({ error: 'no' }, 403);
    }
    const r = await elObjeto(env).fetch('https://avisos/ciclo-mano', { method: 'POST', body: '{}',
      headers: { 'content-type': 'application/json' } });
    const v = await r.json().catch(() => ({}));
    return json(v, v.error ? (v.error === 'espera' ? 429 : 502) : 200);
  }
  // ⚙️ LOS AJUSTES, PARA EL CICLO (el multiplicador a mano): con la clave del ciclo, como `/avisos/inscritos`
  if (ruta === '/avisos/ajustes') {
    const k = req.headers.get('x-lg-ciclo') || '';
    if (!env.DISCORD_TOKEN || k !== await claveCiclo(env.DISCORD_TOKEN)) return json({ error: 'no existe' }, 404);
    return elObjeto(env).fetch('https://avisos/ajustes');
  }
  if (ruta === '/avisos/dueno') {
    const crudo = await req.text();
    if (crudo.length > 1024) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token)))) {
      return json({ error: 'faltan datos' }, 400);
    }
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    const rs = await rolesPanel(q.id);
    if (!puedeRol(rs, 'panel')) {
      console.warn('[seguridad] el Dashboard lo pidió alguien que no puede');
      return json({ error: 'no' }, 403);
    }
    // 🔐 con sus roles: el objeto le arma sólo lo que puede ver (ver `panelDueno()`). 💰 Y la billetera de la temporada
    // (desde cuándo y con cuánto arranca), para los números de los Puntos de Tienda (`economiaDueno()`)
    let pcfg = null;
    try { pcfg = JSON.parse((await env.KV.get('precios', { cacheTtl: 60 })) || 'null'); } catch (e) { pcfg = null; }
    const billetera = pcfg && Number.isInteger(pcfg.inicial) ? { desde: Date.parse(pcfg.desde || '') || 0, inicial: pcfg.inicial } : null;
    return elObjeto(env).fetch('https://avisos/dueno', { method: 'POST', body: JSON.stringify({ quien: q.id, roles: rs, billetera }),
      headers: { 'content-type': 'application/json' } });
  }
  // 🔴 LO QUE AVISÓ EL CANAL DE LOGS, EN EL DASHBOARD (Dlx, 17/10/2026: «en el canal de registros aparecen cosas que
  // están malas, en 🔴: ¿deberíamos arreglarlas, o aparecer en el dashboard quizás?»). Se le pregunta a Discord al
  // abrir el Dashboard —una vez, 60 mensajes— y se quedan los 🔴 y ⚠️ de los últimos días (`logsRojos()`). Sólo quien
  // puede los ajustes: el canal es del staff
  if (ruta === '/avisos/dueno-logs') {
    const crudo = await req.text();
    let d = null;
    try { d = crudo.length <= 1024 ? JSON.parse(crudo || '{}') : null; } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token)))) {
      return json({ error: 'faltan datos' }, 400);
    }
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    if (!puedeRol(await rolesPanel(q.id), 'ajustes')) return json({ error: 'no' }, 403);
    if (!env.DISCORD_TOKEN) return json({ error: 'sin token' }, 503);
    const r = await fetch(`https://discord.com/api/v10/channels/${CANAL_LOGS}/messages?limit=60`,
      { headers: { authorization: 'Bot ' + env.DISCORD_TOKEN } });
    if (!r.ok) return json({ error: 'discord', estado: r.status }, 502);
    return json({ t: Date.now(), canal: CANAL_LOGS, guild: GUILD_LOGS, xs: logsRojos(await r.json(), Date.now()) });
  }
  // 🙋 UN PEDIDO, Y LOS TUYOS: quién lo pide lo dice Discord (o la sesión). Para «perdí mi cuenta» se suman las pruebas que
  // ve el bot de la cuenta NUEVA en DRA —su apodo, si es Miembro y desde cuándo está—: es lo que Dlx miró con Lvel
  if (ruta === '/avisos/pedido' || ruta === '/avisos/mis-pedidos') {
    const crudo = await req.text();
    if (crudo.length > 2048) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token)))) {
      return json({ error: 'faltan datos' }, 400);
    }
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    if (ruta === '/avisos/mis-pedidos') {
      return elObjeto(env).fetch('https://avisos/mis-pedidos', { method: 'POST', body: JSON.stringify({ quien: q.id }),
        headers: { 'content-type': 'application/json' } });
    }
    const v = validarPedido(d);
    if (v.error) return json(v, 400);
    // el de país es SOBRE quien pide (y el video, si no dijo de qué perfil): su perfil sale de KV, para que el Dashboard
    // sepa de quién es y lleve a su perfil
    if (!v.k && (v.tipo === 'pais' || v.tipo === 'video')) {
      let de = '';
      try { de = (await env.KV.get('d:' + q.id)) || ''; } catch (e) { de = ''; }
      if (claveValida(de)) v.k = de;
    }
    const prueba = {};
    if (v.tipo === 'cuenta' && env.DISCORD_TOKEN) {
      try {
        const mm = JSON.parse((await env.KV.get('meta')) || 'null');
        const P = mm && mm.porton;
        const h = { headers: { authorization: 'Bot ' + env.DISCORD_TOKEN } };
        const [ru, rm] = await Promise.all([fetch(`https://discord.com/api/v10/users/${q.id}`, h),
          P && P.guild ? fetch(`https://discord.com/api/v10/guilds/${P.guild}/members/${q.id}`, h) : null]);
        if (ru && ru.ok) {
          const u = await ru.json();
          prueba.usuario = String(u.username || '').slice(0, 40);
          prueba.nombre = String(u.global_name || '').slice(0, 40);
          prueba.creada = new Date(creadaEn(q.id) || 0).toISOString().slice(0, 10);
        }
        if (rm && rm.ok) {
          const m = await rm.json();
          prueba.apodo_dra = String(m.nick || '').slice(0, 40);
          prueba.miembro = !!(P.rol && (m.roles || []).includes(P.rol));
          prueba.en_dra_desde = String(m.joined_at || '').slice(0, 10);
        } else if (rm) prueba.en_dra = false;
      } catch (e) { /* sin pruebas: lo mira Dlx igual */ }
    }
    return elObjeto(env).fetch('https://avisos/pedir', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.assign({ quien: q.id, prueba }, v)) });
  }
  // 🙋 RESOLVER UN PEDIDO (Dlx: «Vos o un Moderador»): sí o no, con una nota
  if (ruta === '/avisos/dueno-pedido') {
    const crudo = await req.text();
    let d = null;
    try { d = crudo.length <= 2048 ? JSON.parse(crudo || '{}') : null; } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || !Number.isInteger(d.id) || typeof d.si !== 'boolean'
        || (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token)))) return json({ error: 'faltan datos' }, 400);
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    if (!(await puede(q.id, 'reportes_cerrar'))) return json({ error: 'no' }, 403);
    return elObjeto(env).fetch('https://avisos/dueno-pedido', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: d.id, si: d.si, nota: String(d.nota || '').slice(0, 200), por: q.id }) });
  }
  // 🙋 PARA EL CICLO, CON SU CLAVE (traen Discord IDs): lo aprobado, cómo salió, y pasar lo de una cuenta a otra
  if (ruta === '/avisos/pedidos-ciclo' || ruta === '/avisos/pedidos-estados' || ruta === '/avisos/mudar-cuenta'
      || ruta === '/avisos/pedidos-prueba' || ruta === '/avisos/tiers-ciclo' || ruta === '/avisos/antiraid-dlx') {
    const k = req.headers.get('x-lg-ciclo') || '';
    if (!env.DISCORD_TOKEN || k !== await claveCiclo(env.DISCORD_TOKEN)) return json({ error: 'no existe' }, 404);
    if (ruta === '/avisos/pedidos-ciclo') return elObjeto(env).fetch('https://avisos/pedidos-ciclo');
    const crudo = await req.text();
    if (crudo.length > 20000) return json({ error: 'demasiado grande' }, 413);
    return elObjeto(env).fetch('https://avisos' + ruta.slice('/avisos'.length), { method: 'POST', body: crudo,
      headers: { 'content-type': 'application/json' } });
  }
  // 🧭 lo del tutorial: sólo el nombre de lo que pasó, de una lista cerrada (`TUTO_EV`)
  if (ruta === '/avisos/tutorial') {
    const crudo = await req.text();
    let d = null;
    try { d = crudo.length <= 200 ? JSON.parse(crudo) : null; } catch (e) { d = null; }
    const ev = d && typeof d.ev === 'string' ? d.ev : '';
    if (!TUTO_EV.has(ev)) return json({ error: 'faltan datos' }, 400);
    return elObjeto(env).fetch('https://avisos/tutorial', { method: 'POST', body: JSON.stringify({ ev }),
      headers: { 'content-type': 'application/json' } });
  }
  // 📊 qué sección se abrió: sólo el nombre, de una lista cerrada (`SECC_EV`)
  if (ruta === '/avisos/seccion') {
    const crudo = await req.text();
    let d = null;
    try { d = crudo.length <= 200 ? JSON.parse(crudo) : null; } catch (e) { d = null; }
    const ev = d && typeof d.ev === 'string' ? d.ev : '';
    if (!SECC_EV.has(ev)) return json({ error: 'faltan datos' }, 400);
    return elObjeto(env).fetch('https://avisos/seccion', { method: 'POST', body: JSON.stringify({ ev }),
      headers: { 'content-type': 'application/json' } });
  }
  // 👆 los toques de un rato de un navegador: `{c: {"sección:etiqueta": veces}}`, de a tandas. Sólo números
  if (ruta === '/avisos/clics') {
    const crudo = await req.text();
    let d = null;
    try { d = crudo.length <= 4000 ? JSON.parse(crudo) : null; } catch (e) { d = null; }
    const c = {};
    for (const [k, v] of Object.entries((d && d.c) || {}).slice(0, 40)) {
      const kk = claveClic(k);
      if (kk && Number.isInteger(v) && v >= 1 && v <= 200) c[kk] = v;
    }
    if (!Object.keys(c).length) return json({ error: 'faltan datos' }, 400);
    return elObjeto(env).fetch('https://avisos/clics', { method: 'POST', body: JSON.stringify({ c }),
      headers: { 'content-type': 'application/json' } });
  }
  // 🐞 un error de la página (19/10/2026): en qué parte, el mensaje y dónde del código; nunca quién
  if (ruta === '/avisos/error') {
    const crudo = await req.text();
    let d = null;
    try { d = crudo.length <= 1000 ? JSON.parse(crudo) : null; } catch (e) { d = null; }
    const e = errorValido(d);
    if (!e) return json({ error: 'faltan datos' }, 400);
    return elObjeto(env).fetch('https://avisos/error-pagina', { method: 'POST', body: JSON.stringify({ d: e.donde, m: e.msg, f: e.f, t: e.tipo }),
      headers: { 'content-type': 'application/json' } });
  }
  // 📊 una visita sin cuenta: no lleva nada de nadie, sólo suma (ver `visita()` del objeto)
  if (ruta === '/avisos/visita') return elObjeto(env).fetch('https://avisos/visita', { method: 'POST', body: '{}', 
    headers: { 'content-type': 'application/json' } });
  // 🔑 LO QUE SE ANOTÓ, PARA EL CICLO: trae Discord IDs, así que sin la clave
  // del ciclo contesta que no existe (ver `claveCiclo()`)
  if (ruta === '/avisos/inscritos') {
    const k = req.headers.get('x-lg-ciclo') || '';
    if (!env.DISCORD_TOKEN || k !== await claveCiclo(env.DISCORD_TOKEN)) return json({ error: 'no existe' }, 404);
    return elObjeto(env).fetch('https://avisos/inscritos');
  }
  // 🔑 VINCULAR UN DISPOSITIVO A UNA PERSONA: el Discord ID sale de Discord
  // —con el permiso que la página trae de entrar con Discord—, nunca de la
  // página. Así nadie puede anotarse los avisos de otro.
  if (ruta === '/avisos/vincular') {
    const crudo = await req.text();
    if (crudo.length > 4096) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo); } catch (e) { d = null; }
    const t = String((d && d.token) || '');
    if (!d || typeof d.endpoint !== 'string' || !/^[A-Za-z0-9._-]{10,300}$/.test(t)) {
      return json({ error: 'faltan datos' }, 400);
    }
    // por `discordDe()`: el permiso tiene que ser de esta app (ver su comentario)
    const q = await discordDe(t);
    const u = q.u || null;
    if (!u || !u.id) return json({ error: q.error === 'ocupado' ? 'discord_ocupado' : 'discord' }, q.error === 'ocupado' ? 503 : 401);
    return elObjeto(env).fetch('https://avisos/vincular', {
      method: 'POST', body: JSON.stringify({ endpoint: d.endpoint, quien: String(u.id) }),
      headers: { 'content-type': 'application/json' },
    });
  }
  // 🔑 UN VOTO: quién es lo dice Discord, qué vale lo dice el ciclo (KV)
  if (ruta === '/avisos/votar') {
    const crudo = await req.text();
    if (crudo.length > 1024) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo); } catch (e) { d = null; }
    const t = String((d && d.token) || '');
    // el permiso de Discord es optativo: sin él, vale la sesión (ver `quienPide()`)
    if (!d || typeof d.enc !== 'string' || typeof d.op !== 'string' || d.enc.length > 40 ||
        d.op.length > 80 || (t && !/^[A-Za-z0-9._-]{10,300}$/.test(t))) {
      return json({ error: 'faltan datos' }, 400);
    }
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    const id = q.id;
    let defs = null;
    try { defs = JSON.parse((await env.KV.get('encuestas', { cacheTtl: 60 })) || 'null'); } catch (e) { defs = null; }
    const v = validarVoto(defs, d, id, Date.now());
    if (v.error) return json(v, v.estado);
    return elObjeto(env).fetch('https://avisos/votar', {
      method: 'POST', body: JSON.stringify({ enc: v.enc, op: v.op, quien: id }),
      headers: { 'content-type': 'application/json' },
    });
  }
  // 🗳️ UN VOTO DE «¿QUIÉN GANA LA LIGA?»: quién es lo dice Discord (la sesión); qué vale, el ciclo (KV `ligas:votar`)
  if (ruta === '/avisos/liga-votar') {
    const crudo = await req.text();
    if (crudo.length > 1024) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo); } catch (e) { d = null; }
    const t = String((d && d.token) || '');
    if (!d || typeof d.liga !== 'string' || typeof d.op !== 'string' || d.liga.length > 40 ||
        d.op.length > 80 || (t && !/^[A-Za-z0-9._-]{10,300}$/.test(t))) {
      return json({ error: 'faltan datos' }, 400);
    }
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    let defs = null;
    try { defs = JSON.parse((await env.KV.get('ligas:votar', { cacheTtl: 60 })) || 'null'); } catch (e) { defs = null; }
    const v = validarVotoLiga(defs, d, q.id, Date.now());
    if (v.error) return json(v, v.estado);
    return elObjeto(env).fetch('https://avisos/liga-votar', {
      method: 'POST', body: JSON.stringify(Object.assign({ quien: q.id }, v)),
      headers: { 'content-type': 'application/json' },
    });
  }
  // 🔔 SEGUIR UNA LIGA, Y LAS QUE SEGUÍS: quién lo dice Discord (o la sesión), como votar
  if (ruta === '/avisos/liga-seguir' || ruta === '/avisos/mis-ligas') {
    const crudo = await req.text();
    if (crudo.length > 1024) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    const t = String((d && d.token) || '');
    if (!d || typeof d !== 'object' || (t && !/^[A-Za-z0-9._-]{10,300}$/.test(t))
        || (ruta === '/avisos/liga-seguir' && (!LIGA_ID.test(String(d.liga || '')) || typeof d.on !== 'boolean'))) {
      return json({ error: 'faltan datos' }, 400);
    }
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    return elObjeto(env).fetch('https://avisos' + ruta.slice('/avisos'.length), {
      method: 'POST', body: JSON.stringify({ quien: q.id, liga: d.liga, on: d.on }),
      headers: { 'content-type': 'application/json' },
    });
  }
  // 🔑 UN ERROR EN UNA LLAVE: quién lo dice Discord; qué, la persona
  if (ruta === '/avisos/reportar') {
    const crudo = await req.text();
    if (crudo.length > 2048) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo); } catch (e) { d = null; }
    if (!d || (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token)))) {
      return json({ error: 'faltan datos' }, 400);
    }
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    const v = validarReporte(d, q.id, Date.now());
    if (v.error) return json(v, v.estado);
    return elObjeto(env).fetch('https://avisos/reportar', {
      method: 'POST', body: JSON.stringify(Object.assign({ quien: q.id }, v)),
      headers: { 'content-type': 'application/json' },
    });
  }
  // 🔑 UN PRECIO, O LA BILLETERA: quién es lo dice Discord, qué vale lo dice
  // el ciclo (KV `precios`), y la plata la cuenta el objeto
  if (ruta === '/avisos/precio' || ruta === '/avisos/billetera') {
    const crudo = await req.text();
    if (crudo.length > 1024) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo); } catch (e) { d = null; }
    if (!d || (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token))) ||
        (ruta === '/avisos/precio' && (typeof d.cabeza !== 'string' || d.cabeza.length > 80))) {
      return json({ error: 'faltan datos' }, 400);
    }
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    const id = q.id;
    let cfg = null;
    try { cfg = JSON.parse((await env.KV.get('precios', { cacheTtl: 60 })) || 'null'); } catch (e) { cfg = null; }
    let cuerpo = null;
    if (ruta === '/avisos/billetera') {
      if (!cfg || !Number.isInteger(cfg.inicial)) return json({ error: 'todavia' }, 503);
      cuerpo = { quien: id, desde: Date.parse(cfg.desde || '') || 0, inicial: cfg.inicial };
    } else {
      const v = validarPrecio(cfg, d, id, Date.now());
      if (v.error) return json(v, v.estado);
      cuerpo = Object.assign({ quien: id }, v);
    }
    return elObjeto(env).fetch('https://avisos' + ruta.slice('/avisos'.length), {
      method: 'POST', body: JSON.stringify(cuerpo), headers: { 'content-type': 'application/json' },
    });
  }
  // 🔑 SEGUIR, Y A QUIÉN SEGUÍS: quién sigue lo dice Discord (o la sesión),
  // nunca la página; a quién, la página, con una clave de perfil válida
  // 👥 LAS CREWS (19/10/2026, bot/crews.js): una acción, o la tuya. Quién sos lo dice Discord o tu sesión, y de qué perfil,
  // `d:` —sólo verificados: crear, invitar y entrar son de Miembros de DRA (Dlx: «verificado y pagando Puntos de
  // Tienda»)—. Acá se valida la forma; las reglas (el rol, el lugar, la plata) las mira el objeto, que es uno solo
  if (ruta === '/avisos/crew' || ruta === '/avisos/crew-mia') {
    const crudo = await req.text();
    // con el logo (19/10/2026) un pedido trae la imagen en base64: hasta el tope del logo y un poco
    if (crudo.length > (ruta === '/avisos/crew' ? Math.ceil(CW.LOGO_TOPE * 4 / 3) + 4096 : 2048)) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token)))) {
      return json({ error: 'faltan datos' }, 400);
    }
    const v = ruta === '/avisos/crew' ? CW.validarCrew(d) : {};
    if (v.error) return json(v, 400);
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    let de = '';
    try { de = (await env.KV.get('d:' + q.id)) || ''; } catch (e) { de = ''; }
    // la billetera: con cuánto arrancó la temporada (crear cuesta Puntos de Tienda), como `/avisos/promo-extender`
    let cfg = null;
    try { cfg = JSON.parse((await env.KV.get('precios', { cacheTtl: 60 })) || 'null'); } catch (e) { cfg = null; }
    const base = { quien: q.id, de: claveValida(de) ? de : '' };
    if (cfg && Number.isInteger(cfg.inicial)) { base.inicial = cfg.inicial; base.desde = Date.parse(cfg.desde || '') || 0; }
    return elObjeto(env).fetch('https://avisos' + ruta.slice('/avisos'.length), {
      method: 'POST', body: JSON.stringify(Object.assign(v, base)), headers: { 'content-type': 'application/json' },
    });
  }
  // 👥 lo del dueño (y Admin) con las crews: el líder de las de antes, el nombre, cerrarla. La puerta del Dashboard
  if (ruta === '/avisos/dueno/crew') {
    const crudo = await req.text();
    if (crudo.length > 1024) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token))) ||
        !['lider', 'nombre', 'borrar', 'logo'].includes(d.que) || typeof d.crew !== 'string' || d.crew.length > 40 ||
        (d.si !== undefined && typeof d.si !== 'boolean') ||
        (d.a !== undefined && !claveValida(d.a)) || (d.nombre !== undefined && (typeof d.nombre !== 'string' || d.nombre.length > 40))) {
      return json({ error: 'faltan datos' }, 400);
    }
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    // 🖼️ el logo lo revisan los que revisan los fondos (Dlx: «vos y los del Dashboard»); lo demás, Ajustes
    if (!(await puede(q.id, d.que === 'logo' ? 'fondos' : 'ajustes'))) return json({ error: 'no' }, 403);
    return elObjeto(env).fetch('https://avisos/crew-dueno', {
      method: 'POST', body: JSON.stringify({ que: d.que, crew: d.crew, a: d.a, nombre: d.nombre, si: d.si,
        motivo: String(d.motivo || '').slice(0, 120), url: typeof d.url === 'string' ? d.url.slice(0, 300) : '', por: q.id }),
      headers: { 'content-type': 'application/json' },
    });
  }
  // 🌱 las 34 de antes, una vez: lo manda el ciclo, con su clave (`bot/crews_vivas.py --sembrar`); y 🪪 quiénes de las
  // crews no están verificados, cada corrida (`bot/crews_verificar.py`)
  if (ruta === '/avisos/crews-sembrar' || ruta === '/avisos/crews-verificar' || ruta === '/avisos/crews-tiers') {
    const k = req.headers.get('x-lg-ciclo') || '';
    if (!env.DISCORD_TOKEN || k !== await claveCiclo(env.DISCORD_TOKEN)) return json({ error: 'no existe' }, 404);
    const crudo = await req.text();
    if (crudo.length > 200000) return json({ error: 'demasiado grande' }, 413);
    return elObjeto(env).fetch('https://avisos/' + ruta.slice('/avisos/'.length), {
      method: 'POST', body: crudo, headers: { 'content-type': 'application/json' },
    });
  }
  if (ruta === '/avisos/seguir' || ruta === '/avisos/sigo') {
    const crudo = await req.text();
    if (crudo.length > 4096) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token)))) {
      return json({ error: 'faltan datos' }, 400);
    }
    let as = null;
    if (ruta === '/avisos/seguir') {
      as = Array.isArray(d.a) ? d.a : [d.a];
      if (!as.length || as.length > 60 || !as.every(claveValida) ||
          (d.si !== undefined && typeof d.si !== 'boolean')) return json({ error: 'clave' }, 400);
    }
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    // 🔑 TU PROPIO PERFIL, el de tu Discord (como `/card`): para no seguirte y
    // para que la lista de quién te sigue diga que sos vos
    let de = '';
    try { de = (await env.KV.get('d:' + q.id)) || ''; } catch (e) { de = ''; }
    // 🔒 PARA SEGUIR HAY QUE ESTAR VERIFICADO (Dlx, 21/10/2026: «para seguir o que te sigan necesitas estar 100 %
    // verificado en la página»): `d:` es de los verificados (`dn:` no abre la cuenta). Dejar de seguir, siempre
    if (ruta === '/avisos/seguir' && d.si !== false && !claveValida(de)) return json({ error: 'sin_verificar' }, 403);
    return elObjeto(env).fetch('https://avisos' + ruta.slice('/avisos'.length), {
      method: 'POST', body: JSON.stringify({ quien: q.id, de: claveValida(de) ? de : '', a: as, si: d.si !== false }),
      headers: { 'content-type': 'application/json' },
    });
  }
  // 📖 LAS HISTORIAS QUE VISTE, EN TU CUENTA (Dlx, 18/10/2026: «tengo mi cuenta en muchos dispositivos», y a «¿lo visto
  // sigue a tu cuenta?»: «yes»). Sin `ids` devuelve lo tuyo; con `ids`, lo suma. Sólo con «Entrar con Discord»
  // 📊 EL PANEL DE UN SOCIO: quién pide lo dice Discord; de qué servidor es dueño, el objeto (`panelSocio()`)
  if (ruta === '/avisos/panel-socio') {
    const crudo = await req.text();
    if (crudo.length > 2048) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token)))) return json({ error: 'faltan datos' }, 400);
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    return elObjeto(env).fetch('https://avisos/panel-socio', {
      method: 'POST', body: JSON.stringify({ quien: q.id }), headers: { 'content-type': 'application/json' },
    });
  }
  // ⚙️ LOS AJUSTES DEL BOT DESDE EL PANEL DEL SOCIO (19/10/2026): quién pide lo dice Discord; si es dueño y qué vale,
  // el objeto (`socioAjustes()`). El cuerpo: `{sv, cambio?: {cual, valor}}`; sin `cambio` sólo lee
  if (ruta === '/avisos/socio-ajustes') {
    const crudo = await req.text();
    if (crudo.length > 4096) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    const cambio = d && d.cambio && typeof d.cambio === 'object' ? d.cambio : null;
    const valorOk = (v) => typeof v === 'boolean' || v === null || (typeof v === 'string' && v.length <= 32)
      || (Array.isArray(v) && v.length <= 10 && v.every((x) => typeof x === 'string' && x.length <= 32));
    if (!d || typeof d !== 'object' || !/^[A-Z]{2,6}$/.test(String(d.sv || ''))
        || (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token)))
        || (d.cambio !== undefined && (!cambio || typeof cambio.cual !== 'string' || cambio.cual.length > 20 || !valorOk(cambio.valor)))) {
      return json({ error: 'faltan datos' }, 400);
    }
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    return elObjeto(env).fetch('https://avisos/socio-ajustes', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quien: q.id, sv: String(d.sv), cambio: cambio ? { cual: cambio.cual, valor: cambio.valor } : null }),
    });
  }
  if (ruta === '/avisos/historias') {
    const crudo = await req.text();
    if (crudo.length > 24576) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    const ids = d && Array.isArray(d.ids) ? d.ids : [];
    if (!d || typeof d !== 'object' || ids.length > HISTORIAS_LOTE ||
        !ids.every((x) => typeof x === 'string' && x.length > 0 && x.length <= 200) ||
        (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token)))) return json({ error: 'faltan datos' }, 400);
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    return elObjeto(env).fetch('https://avisos/historias', {
      method: 'POST', body: JSON.stringify({ quien: q.id, ids }), headers: { 'content-type': 'application/json' },
    });
  }
  // 🔑 «TU SERVIDOR». Dlx, 28/09/2026: «La idea es q la gente decida por su
  // cuenta», y dónde y cada cuánto, «1. A 2. A»: en Mi cuenta, uno por
  // temporada como la foto. Quién es lo dice Discord (o la sesión).
  if (ruta === '/avisos/mi-servidor') {
    const crudo = await req.text();
    if (crudo.length > 1024) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token))) ||
        (d.sv !== undefined && !/^([A-Z]{2,5})?$/.test(String(d.sv)))) return json({ error: 'faltan datos' }, 400);
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    let de = '';
    try { de = (await env.KV.get('d:' + q.id)) || ''; } catch (e) { de = ''; }
    // ⚠️ LA MISMA TEMPORADA Y LA MISMA VENTANA LIBRE QUE LA FOTO: los dos
    // bindings que `bot/desplegar.py` saca de `comun/temporada.py`
    // (`temporadaDe()` y `libreHasta()` en worker.js)
    return elObjeto(env).fetch('https://avisos/mi-servidor', {
      method: 'POST', body: JSON.stringify({ quien: q.id, de: claveValida(de) ? de : '',
        sv: d.sv === undefined ? undefined : String(d.sv), temporada: String((env && env.TEMPORADA) || 't1'),
        libre_hasta: Date.parse((env && env.FOTO_LIBRE_HASTA) || '') || 0 }),
      headers: { 'content-type': 'application/json' },
    });
  }
  // 🙈 «OCULTAR MI FOTO»: como «tu servidor», quién es lo dice Discord (o la sesión). Ver `miFoto()`
  if (ruta === '/avisos/mi-foto') {
    const crudo = await req.text();
    if (crudo.length > 1024) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token))) ||
        (d.ocultar !== undefined && typeof d.ocultar !== 'boolean')) return json({ error: 'faltan datos' }, 400);
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    return elObjeto(env).fetch('https://avisos/mi-foto', {
      method: 'POST', body: JSON.stringify({ quien: q.id, ocultar: d.ocultar }),
      headers: { 'content-type': 'application/json' },
    });
  }
  // 👏 FELICITAR: quién lo dice Discord (o la sesión); qué publicación, el muro que dejó el ciclo (`web:muro`), nunca
  // la página. ⚠️ Necesita su rama: lo que cae abajo llega al objeto sin preguntar quién es
  if (ruta === '/avisos/felicitar') {
    const crudo = await req.text();
    if (crudo.length > 1024) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || !/^[0-9a-f]{12}$/.test(String(d.id || '')) ||
        (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token)))) return json({ error: 'faltan datos' }, 400);
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    let items = [];
    try { items = (JSON.parse((await env.KV.get('web:muro', { cacheTtl: 60 })) || '{}').items) || []; } catch (e) { items = []; }
    // tus perfiles, verificado o no: a uno mismo no se lo felicita
    const mios = [];
    for (const p of ['d:', 'dn:']) {
      try {
        const k = await env.KV.get(p + q.id);
        if (claveValida(k)) mios.push(k);
      } catch (e) { /* sin KV, la publicación igual dice de quién es */ }
    }
    const v = validarAplauso(items, d, q.id, mios, Date.now());
    if (v.error) return json(v, v.estado);
    return elObjeto(env).fetch('https://avisos/aplaudir', {
      method: 'POST', body: JSON.stringify({ quien: q.id, pub: v }), headers: { 'content-type': 'application/json' },
    });
  }
  // 📣 ABRIR UNA PROMO: quién lo dice Discord (o la sesión); qué promo, el muro (`validarPromo()`). Paga el objeto
  if (ruta === '/avisos/promo-vio') {
    const crudo = await req.text();
    if (crudo.length > 1024) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || !/^[0-9a-f]{12}$/.test(String(d.id || '')) ||
        (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token)))) return json({ error: 'faltan datos' }, 400);
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    let items = [];
    try { items = (JSON.parse((await env.KV.get('web:muro', { cacheTtl: 60 })) || '{}').items) || []; } catch (e) { items = []; }
    const mios = [];
    for (const p of ['d:', 'dn:']) {
      try {
        const k = await env.KV.get(p + q.id);
        if (claveValida(k)) mios.push(k);
      } catch (e) { /* sin KV, la promo igual dice de quién es */ }
    }
    const v = validarPromo(items, d, q.id, mios, Date.now());
    if (v.error) return json(v, v.estado);
    return elObjeto(env).fetch('https://avisos/promo-vio', {
      method: 'POST', body: JSON.stringify({ quien: q.id, pid: v.pid }), headers: { 'content-type': 'application/json' },
    });
  }
  // 📣 UNA SEMANA MÁS DE TU PROMO: quién lo dice Discord (o la sesión); qué promo y si es tuya, el muro
  // (`validarExtender()`); la plata la cuenta el objeto, como el precio por cabeza
  if (ruta === '/avisos/promo-extender') {
    const crudo = await req.text();
    if (crudo.length > 1024) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || !/^[0-9a-f]{12}$/.test(String(d.id || '')) ||
        (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token)))) return json({ error: 'faltan datos' }, 400);
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    let cfg = null;
    try { cfg = JSON.parse((await env.KV.get('precios', { cacheTtl: 60 })) || 'null'); } catch (e) { cfg = null; }
    if (!cfg || !Number.isInteger(cfg.inicial)) return json({ error: 'todavia' }, 503);
    let items = [];
    try { items = (JSON.parse((await env.KV.get('web:muro', { cacheTtl: 60 })) || '{}').items) || []; } catch (e) { items = []; }
    const mios = [];
    for (const p of ['d:', 'dn:']) {
      try {
        const k = await env.KV.get(p + q.id);
        if (claveValida(k)) mios.push(k);
      } catch (e) { /* sin KV no se sabe de quién es: no se cobra */ }
    }
    const v = validarExtender(items, d, mios, Date.now());
    if (v.error) return json(v, v.estado);
    return elObjeto(env).fetch('https://avisos/promo-extender', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quien: q.id, pid: v.pid, base: v.base, desde: Date.parse(cfg.desde || '') || 0, inicial: cfg.inicial }),
    });
  }
  // 🔔 LA BANDEJA: lo tuyo, con tu sesión (o un permiso recién traído). ⚠️ La página nunca manda a Discord por esto:
  // sin sesión, el panel invita a entrar
  if (ruta === '/avisos/bandeja') {
    const crudo = await req.text();
    if (crudo.length > 1024) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token)))) {
      return json({ error: 'faltan datos' }, 400);
    }
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    return elObjeto(env).fetch('https://avisos/bandeja', {
      method: 'POST', body: JSON.stringify({ quien: q.id, visto: d.visto === true }), headers: { 'content-type': 'application/json' },
    });
  }
  // 🔥 TU RACHA Y TU NIVEL, con tu sesión. Pedirla ya cuenta el día: pasa por `quienPide()`, que lo anota
  // 🎁 EL PREMIO DE LA SEMANA, con tu sesión: verlo (`cobrar` falso) o cobrarlo. El `quien` lo pone la sesión
  if (ruta === '/avisos/semanal') {
    const crudo = await req.text();
    if (crudo.length > 1024) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token)))) {
      return json({ error: 'faltan datos' }, 400);
    }
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    return elObjeto(env).fetch('https://avisos/semanal', {
      method: 'POST', body: JSON.stringify({ quien: q.id, cobrar: d.cobrar === true }), headers: { 'content-type': 'application/json' },
    });
  }
  if (ruta === '/avisos/racha') {
    const crudo = await req.text();
    if (crudo.length > 1024) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token)))) {
      return json({ error: 'faltan datos' }, 400);
    }
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    const cobrar = d.cobrar === 'dia' || d.cobrar === 'bienvenida' ? d.cobrar : undefined;
    return elObjeto(env).fetch('https://avisos/racha', {
      method: 'POST', body: JSON.stringify({ quien: q.id, cobrar }), headers: { 'content-type': 'application/json' },
    });
  }
  // 🎟️ EL PASE: el tuyo (pedirlo ya revisa tus Tareas) y «miré una llave en vivo», con tu sesión. ⚠️ Nunca por el
  // reenvío de abajo: ese pasa el cuerpo tal cual, y acá el `quien` lo pone la sesión
  if (ruta === '/avisos/pase' || ruta === '/avisos/pase-vivo' || ruta === '/avisos/pase-avisos' || ruta === '/avisos/pase-color' ||
    ruta === '/avisos/sorteo' || ruta === '/avisos/sorteo-entrar' || ruta === '/avisos/marcos' || ruta === '/avisos/marco-elige'
    || ruta === '/avisos/tags-mios' || ruta === '/avisos/tag-elige') {
    const crudo = await req.text();
    if (crudo.length > 1024) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token)))) {
      return json({ error: 'faltan datos' }, 400);
    }
    const llave = String(d.llave || '');
    if (ruta === '/avisos/pase-vivo' && !/^[A-Za-z0-9:_-]{1,60}$/.test(llave)) return json({ error: 'falta la llave' }, 400);
    // 🎟️ el sorteo se puede mirar sin cuenta (entonces no dice si entraste)
    const q = await quienPide(req, env, d);
    if (!q.id && ruta !== '/avisos/sorteo') return json({ error: q.error }, q.estado);
    return elObjeto(env).fetch('https://avisos' + ruta.slice('/avisos'.length), {
      method: 'POST', body: JSON.stringify({ quien: q.id || '', llave, si: d.si, color: d.color, marco: d.marco, estilo: d.estilo,
        carta: d.carta, tag: d.tag }),
      headers: { 'content-type': 'application/json' },
    });
  }
  // 🎬 TUS BATALLAS EN VIDEO (Dlx, 12/10/2026: «las 2, pero asegurate que haya restricciones…»): pedir un link o un
  // canal, ver tus pedidos, quitar uno tuyo y reportar el de otro. ⚠️ SÓLO VERIFICADOS: tu perfil sale de `d:` (el
  // Miembro de DRA), nunca de la página. Lo que entra y lo que no lo decide el ciclo (`bot/videos_propios.py`)
  if (ruta === '/avisos/mis-videos' || ruta === '/avisos/video-reportar') {
    const crudo = await req.text();
    if (crudo.length > 2048) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token)))) {
      return json({ error: 'faltan datos' }, 400);
    }
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    let de = '';
    try { de = (await env.KV.get('d:' + q.id)) || ''; } catch (e) { de = ''; }
    if (!claveValida(de)) return json({ error: 'sin_verificar' }, 403);
    return elObjeto(env).fetch('https://avisos' + ruta.slice('/avisos'.length), {
      method: 'POST', body: JSON.stringify({ quien: q.id, de, accion: String(d.accion || '').slice(0, 10),
        url: String(d.url || '').slice(0, 300), vid: String(d.vid || '').slice(0, 20), clave: String(d.clave || '').slice(0, 80),
        // 🎬 «contanos cómo aparecés» (16/10/2026): el pedido y lo que contestó, cada cosa con tope
        id: Number.isInteger(d.id) ? d.id : 0, nombre: String(d.nombre || '').slice(0, 60),
        como: String(d.como || '').slice(0, 160), minuto: String(d.minuto || '').slice(0, 10) }),
      headers: { 'content-type': 'application/json' },
    });
  }
  // 📣 SEGUIR A UN ORGANIZADOR: quién sos lo dice Discord (o la sesión). Ver `seguirOrg()`
  if (ruta === '/avisos/seguir-org') {
    const crudo = await req.text();
    if (crudo.length > 1024) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token)))) {
      return json({ error: 'faltan datos' }, 400);
    }
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    return elObjeto(env).fetch('https://avisos/seguir-org', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quien: q.id, accion: String(d.accion || '').slice(0, 6), nombre: String(d.nombre || '').slice(0, 80),
        si: d.si !== false }),
    });
  }
  // 🏆 EL HINCHA DEL MES, PARA EL CICLO: con su clave (trae Discord IDs). Ver `hinchas()`
  if (ruta === '/avisos/hinchas') {
    const k = req.headers.get('x-lg-ciclo') || '';
    if (!env.DISCORD_TOKEN || k !== await claveCiclo(env.DISCORD_TOKEN)) return json({ error: 'no existe' }, 404);
    return elObjeto(env).fetch('https://avisos/hinchas');
  }
  // 📅 LO AGENDADO CON /agendar, PARA EL CICLO: con su clave (trae quién lo agendó)
  if (ruta === '/avisos/agenda-ciclo') {
    const k = req.headers.get('x-lg-ciclo') || '';
    if (!env.DISCORD_TOKEN || k !== await claveCiclo(env.DISCORD_TOKEN)) return json({ error: 'no existe' }, 404);
    return elObjeto(env).fetch('https://avisos/agenda-ciclo');
  }
  // 🎬 LOS PEDIDOS DE VIDEOS, PARA EL CICLO, Y LO QUE DECIDIÓ: con su clave (traen Discord IDs)
  if (ruta === '/avisos/videos-ciclo' || ruta === '/avisos/videos-estados') {
    const k = req.headers.get('x-lg-ciclo') || '';
    if (!env.DISCORD_TOKEN || k !== await claveCiclo(env.DISCORD_TOKEN)) return json({ error: 'no existe' }, 404);
    if (ruta === '/avisos/videos-ciclo') return elObjeto(env).fetch('https://avisos/videos-ciclo');
    const crudo = await req.text();
    if (crudo.length > 200000) return json({ error: 'demasiado grande' }, 413);
    return elObjeto(env).fetch('https://avisos/videos-estados', { method: 'POST', body: crudo,
      headers: { 'content-type': 'application/json' } });
  }
  // 🎬 APROBAR O NO UN VIDEO QUE QUEDÓ EN REVISIÓN: sólo Dlx, como los ajustes del Dashboard
  if (ruta === '/avisos/dueno/video') {
    const crudo = await req.text();
    if (crudo.length > 1024) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token))) ||
        !/^\d{1,12}$/.test(String(d.id || '')) || typeof d.si !== 'boolean') return json({ error: 'faltan datos' }, 400);
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    if (!(await puede(q.id, 'videos'))) {
      console.warn('[seguridad] aprobar un video lo pidió alguien que no puede');
      return json({ error: 'no' }, 403);
    }
    return elObjeto(env).fetch('https://avisos/dueno-video', {
      method: 'POST', body: JSON.stringify({ id: Number(d.id), si: d.si }), headers: { 'content-type': 'application/json' },
    });
  }
  // 📣 QUÉ HACER CON UN REPORTE DE UNA LLAVE: sólo Dlx, como los videos (13/10/2026). Ver `validarDecisionReporte()`
  if (ruta === '/avisos/dueno/reporte') {
    const crudo = await req.text();
    if (crudo.length > 2048) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token)))) {
      return json({ error: 'faltan datos' }, 400);
    }
    const v = validarDecisionReporte(d);
    if (v.error) return json(v, 400);
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    // 🔐 cerrarlo (Listo, Era una prueba) lo puede un Moderador; corregirlo, Asistente para arriba
    if (!(await puede(q.id, v.fix ? 'reportes' : 'reportes_cerrar'))) {
      console.warn('[seguridad] decidir un reporte lo pidió alguien que no puede');
      return json({ error: 'no' }, 403);
    }
    return elObjeto(env).fetch('https://avisos/dueno-reporte', {
      method: 'POST', body: JSON.stringify(Object.assign({}, v, { por: q.id })), headers: { 'content-type': 'application/json' },
    });
  }
  // ✅ DECIDIR: las preguntas que publica el ciclo y lo contestado, con su clave
  if (ruta === '/avisos/decidir-ciclo' || ruta === '/avisos/decidir-estados') {
    const k = req.headers.get('x-lg-ciclo') || '';
    if (!env.DISCORD_TOKEN || k !== await claveCiclo(env.DISCORD_TOKEN)) return json({ error: 'no existe' }, 404);
    if (ruta === '/avisos/decidir-ciclo') return elObjeto(env).fetch('https://avisos/decidir-ciclo');
    const crudo = await req.text();
    if (crudo.length > 400000) return json({ error: 'demasiado grande' }, 413);
    return elObjeto(env).fetch('https://avisos/decidir-estados', { method: 'POST', body: crudo,
      headers: { 'content-type': 'application/json' } });
  }
  // 🖼️ TU FONDO: subirlo, cambiar dónde se ve o quitarlo, y ver cómo está. Quién es lo dice la sesión
  if (ruta === '/avisos/fondo' || ruta === '/avisos/mi-fondo') {
    const crudo = await req.text();
    if (crudo.length > (ruta === '/avisos/fondo' ? 900000 : 1024)) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token)))
        || (d.img !== undefined && (typeof d.img !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(d.img)))) return json({ error: 'faltan datos' }, 400);
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    let de = '';
    try { de = (await env.KV.get('d:' + q.id)) || ''; } catch (e) { de = ''; }
    return elObjeto(env).fetch('https://avisos' + ruta.slice('/avisos'.length), {
      method: 'POST', body: JSON.stringify({ quien: q.id, de: claveValida(de) ? de : '', img: d.img, borrar: d.borrar === true,
        perfil: d.perfil, pagina: d.pagina }),
      headers: { 'content-type': 'application/json' },
    });
  }
  // 📸 TU FOTO DE TARJETA: subirla, volver a la de Discord y ver cómo está. Quién es lo dice la sesión, y de qué
  // perfil, KV (`d:`): sin perfil no hay tarjetas
  if (ruta === '/avisos/foto-carta' || ruta === '/avisos/mi-foto-carta') {
    const crudo = await req.text();
    if (crudo.length > (ruta === '/avisos/foto-carta' ? 750000 : 1024)) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    const lista = (x) => x === undefined || (Array.isArray(x) && x.length <= 4 && x.every((c) => CARTAS_FOTO.includes(c)));
    if (!d || typeof d !== 'object' || (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token)))
        || (d.img !== undefined && (typeof d.img !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(d.img)))
        || !lista(d.cartas) || !lista(d.borrar)) return json({ error: 'faltan datos' }, 400);
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    let de = '';
    try { de = (await env.KV.get('d:' + q.id)) || ''; } catch (e) { de = ''; }
    return elObjeto(env).fetch('https://avisos' + ruta.slice('/avisos'.length), {
      method: 'POST', body: JSON.stringify({ quien: q.id, de: claveValida(de) ? de : '', img: d.img, cartas: d.cartas,
        borrar: d.borrar }),
      headers: { 'content-type': 'application/json' },
    });
  }
  if (ruta === '/avisos/dueno/foto-carta') {
    const crudo = await req.text();
    if (crudo.length > 1024) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token)))
        || !/^\d{5,25}$/.test(String(d.quien || '')) || typeof d.si !== 'boolean') return json({ error: 'faltan datos' }, 400);
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    if (!(await puede(q.id, 'fondos'))) {
      console.warn('[seguridad] revisar una foto de tarjeta lo pidió alguien que no puede');
      return json({ error: 'no' }, 403);
    }
    return elObjeto(env).fetch('https://avisos/dueno-foto-carta', {
      method: 'POST', body: JSON.stringify({ quien: String(d.quien), si: d.si, motivo: String(d.motivo || '').slice(0, 120), por: q.id }),
      headers: { 'content-type': 'application/json' },
    });
  }
  // 🖼️ Y REVISARLO: sólo Dlx
  if (ruta === '/avisos/dueno/fondo') {
    const crudo = await req.text();
    if (crudo.length > 1024) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token)))
        || !/^\d{5,25}$/.test(String(d.quien || '')) || typeof d.si !== 'boolean') return json({ error: 'faltan datos' }, 400);
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    if (!(await puede(q.id, 'fondos'))) {
      console.warn('[seguridad] revisar un fondo lo pidió alguien que no puede');
      return json({ error: 'no' }, 403);
    }
    return elObjeto(env).fetch('https://avisos/dueno-fondo', {
      method: 'POST', body: JSON.stringify({ quien: String(d.quien), si: d.si, motivo: String(d.motivo || '').slice(0, 120), por: q.id }),
      headers: { 'content-type': 'application/json' },
    });
  }
  // 🏷️ LOS ROLES QUE SALEN SOLOS: del ciclo, con su clave
  if (ruta === '/avisos/roles-estados') {
    const k = req.headers.get('x-lg-ciclo') || '';
    if (!env.DISCORD_TOKEN || k !== await claveCiclo(env.DISCORD_TOKEN)) return json({ error: 'no existe' }, 404);
    const crudo = await req.text();
    if (crudo.length > 600000) return json({ error: 'demasiado grande' }, 413);
    return elObjeto(env).fetch('https://avisos/roles-estados', { method: 'POST', body: crudo,
      headers: { 'content-type': 'application/json' } });
  }
  // 🏷️ Y PONER O SACAR UNO: sólo Dlx
  if (ruta === '/avisos/dueno/rol') {
    const crudo = await req.text();
    if (crudo.length > 1024) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token)))) {
      return json({ error: 'faltan datos' }, 400);
    }
    const v = validarRol(d);
    if (v.error) return json(v, 400);
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    if (q.id !== DUENO) {
      console.warn('[seguridad] poner un rol lo pidió alguien que no es el dueño');
      return json({ error: 'no' }, 403);
    }
    return elObjeto(env).fetch('https://avisos/dueno-rol', {
      method: 'POST', body: JSON.stringify(v), headers: { 'content-type': 'application/json' },
    });
  }
  // ✅ Y CONTESTAR UNA: sólo Dlx, como los reportes
  if (ruta === '/avisos/vuelve-ciclo') {
    const k = req.headers.get('x-lg-ciclo') || '';
    if (!env.DISCORD_TOKEN || k !== await claveCiclo(env.DISCORD_TOKEN)) return json({ error: 'no existe' }, 404);
    return elObjeto(env).fetch('https://avisos/vuelve-ciclo');
  }
  // 🔁 la lista de primerizos y enfriados, del ciclo: con nombres, así que sólo con su clave y sólo al objeto
  if (ruta === '/avisos/primerizos-ciclo') {
    const k = req.headers.get('x-lg-ciclo') || '';
    if (!env.DISCORD_TOKEN || k !== await claveCiclo(env.DISCORD_TOKEN)) return json({ error: 'no existe' }, 404);
    const crudo = await req.text();
    if (crudo.length > 100000) return json({ error: 'demasiado grande' }, 413);
    return elObjeto(env).fetch('https://avisos/primerizos-ciclo', { method: 'POST', body: crudo, headers: { 'content-type': 'application/json' } });
  }
  // 🔁 avisarle a alguien de esa lista que vuelva: por su campana, con un texto fijo. Lo hace quien puede cerrar reportes
  if (ruta === '/avisos/dueno/vuelve') {
    const crudo = await req.text();
    if (crudo.length > 512) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || !/^[a-z0-9]{1,40}$/.test(String(d.k || '')) || !PLANTILLAS_VUELVE[d.que]) return json({ error: 'faltan datos' }, 400);
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    if (!(await puede(q.id, 'reportes_cerrar'))) return json({ error: 'no' }, 403);
    return elObjeto(env).fetch('https://avisos/dueno-vuelve', {
      method: 'POST', body: JSON.stringify({ k: String(d.k), que: String(d.que), por: q.id }), headers: { 'content-type': 'application/json' },
    });
  }
  // 🗂️ la ficha de alguien (cualquiera que abre el Dashboard) y las notas del staff (quien puede cerrar reportes)
  if (ruta === '/avisos/dueno/ficha' || ruta === '/avisos/dueno/nota') {
    const crudo = await req.text();
    if (crudo.length > 2048) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object') return json({ error: 'faltan datos' }, 400);
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    const roles = await rolesPanel(q.id);
    if (!puedeRol(roles, ruta === '/avisos/dueno/nota' ? 'reportes_cerrar' : 'panel')) return json({ error: 'no' }, 403);
    let cuerpo;
    if (ruta === '/avisos/dueno/nota') {
      const v = validarNota(d);
      if (v.error) return json(v, 400);
      cuerpo = Object.assign({}, v, { por: q.id, jefe: puedeRol(roles, 'ajustes') });
    } else {
      if (!/^[a-z0-9]{1,40}$/.test(String(d.k || ''))) return json({ error: 'falta quién' }, 400);
      let pcfg = null;
      try { pcfg = JSON.parse((await env.KV.get('precios', { cacheTtl: 60 })) || 'null'); } catch (e) { pcfg = null; }
      cuerpo = { k: String(d.k), quien: q.id,
        billetera: pcfg && Number.isInteger(pcfg.inicial) ? { desde: Date.parse(pcfg.desde || '') || 0, inicial: pcfg.inicial } : null };
    }
    return elObjeto(env).fetch('https://avisos' + ruta.replace('/avisos/dueno/', '/dueno-'), {
      method: 'POST', body: JSON.stringify(cuerpo), headers: { 'content-type': 'application/json' },
    });
  }
  if (ruta === '/avisos/dueno/viendo') {
    const crudo = await req.text();
    if (crudo.length > 512) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object') return json({ error: 'faltan datos' }, 400);
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    if (!(await puede(q.id, 'panel'))) return json({ error: 'no' }, 403);
    return elObjeto(env).fetch('https://avisos/dueno-viendo', {
      method: 'POST', body: JSON.stringify({ k: String(d.k || '').slice(0, 90), quien: q.id }), headers: { 'content-type': 'application/json' },
    });
  }
  if (ruta === '/avisos/dueno/decidir') {
    const crudo = await req.text();
    if (crudo.length > 2048) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token)))) {
      return json({ error: 'faltan datos' }, 400);
    }
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    if (!(await puede(q.id, 'decidir'))) {
      console.warn('[seguridad] contestar ✅ Decidir lo pidió alguien que no puede');
      return json({ error: 'no' }, 403);
    }
    return elObjeto(env).fetch('https://avisos/dueno-decidir', {
      method: 'POST', body: JSON.stringify({ id: d.id, r: d.r, nota: d.nota, borrar: d.borrar === true, deshacer: d.deshacer === true, por: q.id }),
      headers: { 'content-type': 'application/json' },
    });
  }
  // 📣 Y LO QUE EL CICLO APLICÓ DE CADA UNO: con su clave (el objeto le avisa a quien reportó)
  if (ruta === '/avisos/reportes-estados') {
    const k = req.headers.get('x-lg-ciclo') || '';
    if (!env.DISCORD_TOKEN || k !== await claveCiclo(env.DISCORD_TOKEN)) return json({ error: 'no existe' }, 404);
    const crudo = await req.text();
    if (crudo.length > 20000) return json({ error: 'demasiado grande' }, 413);
    return elObjeto(env).fetch('https://avisos/reportes-estados', { method: 'POST', body: crudo,
      headers: { 'content-type': 'application/json' } });
  }
  // 🧰 LA IMAGEN DEL KIT, DE LA TAREA `kit.yml` (`bot/kit.py`): con la clave del ciclo
  if (ruta === '/avisos/kit-listo') {
    const k = req.headers.get('x-lg-ciclo') || '';
    if (!env.DISCORD_TOKEN || k !== await claveCiclo(env.DISCORD_TOKEN)) return json({ error: 'no existe' }, 404);
    return elObjeto(env).fetch('https://avisos/kit-listo', {
      method: 'POST', body: await req.text(), headers: { 'content-type': 'application/json' },
    });
  }
  // 🖼️ LOS VS QUE ESPERAN SU IMAGEN, Y LA IMAGEN: para la tarea `kit.yml` (`bot/kit.py --tipo vs`), con la clave del ciclo
  if (ruta === '/avisos/vs-cola' || ruta === '/avisos/vs-listo') {
    const k = req.headers.get('x-lg-ciclo') || '';
    if (!env.DISCORD_TOKEN || k !== await claveCiclo(env.DISCORD_TOKEN)) return json({ error: 'no existe' }, 404);
    if (ruta === '/avisos/vs-cola') {
      const sv = String(new URL(req.url).searchParams.get('sv') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6);
      return elObjeto(env).fetch('https://avisos/vs-cola?sv=' + sv);
    }
    return elObjeto(env).fetch('https://avisos/vs-listo', {
      method: 'POST', body: await req.text(), headers: { 'content-type': 'application/json' },
    });
  }
  // 🏁 LAS FINALES QUE CONTESTÓ CADA ORGANIZADOR, PARA EL CICLO (`bot/finales.py`): con su clave
  if (ruta === '/avisos/finales') {
    const k = req.headers.get('x-lg-ciclo') || '';
    if (!env.DISCORD_TOKEN || k !== await claveCiclo(env.DISCORD_TOKEN)) return json({ error: 'no existe' }, 404);
    return elObjeto(env).fetch('https://avisos/finales');
  }
  // 💬 EL CHAT DE CADA SERVIDOR, PARA EL CICLO (`avisar.evento()`): con su clave, como lo del Pase
  if (ruta === '/avisos/chat-canales') {
    const k = req.headers.get('x-lg-ciclo') || '';
    if (!env.DISCORD_TOKEN || k !== await claveCiclo(env.DISCORD_TOKEN)) return json({ error: 'no existe' }, 404);
    return elObjeto(env).fetch('https://avisos/chat-canales');
  }
  // 🏆 EL CIERRE DEL BOT EN VIVO, PARA EL CICLO (`avisar.evento()`): con su clave. Ver `cierreVivo()`
  if (ruta === '/avisos/cierre-vivo') {
    const k = req.headers.get('x-lg-ciclo') || '';
    if (!env.DISCORD_TOKEN || k !== await claveCiclo(env.DISCORD_TOKEN)) return json({ error: 'no existe' }, 404);
    const crudo = await req.text();
    if (crudo.length > 4000) return json({ error: 'demasiado grande' }, 413);
    return elObjeto(env).fetch('https://avisos/cierre-vivo', {
      method: 'POST', body: crudo, headers: { 'content-type': 'application/json' },
    });
  }
  // 🎟️ QUIÉN TIENE NIVEL EN EL PASE, PARA EL CICLO: trae Discord IDs, así que sin su clave «no existe»
  if (ruta === '/avisos/pase-niveles') {
    const k = req.headers.get('x-lg-ciclo') || '';
    if (!env.DISCORD_TOKEN || k !== await claveCiclo(env.DISCORD_TOKEN)) return json({ error: 'no existe' }, 404);
    return elObjeto(env).fetch('https://avisos/pase-niveles');
  }
  // 🧠 LOS DATOS DE CADA PERSONA, DEL CICLO (`bot/subir_datos.py`) AL OBJETO, y de vuelta para sus auditorías: con su
  // clave. Son ~1.000 personas en un pedido (unos 400 KB), así que no entran por el reenvío de abajo
  if (ruta === '/avisos/personas-ciclo' || ruta === '/avisos/personas-leer') {
    const k = req.headers.get('x-lg-ciclo') || '';
    if (!env.DISCORD_TOKEN || k !== await claveCiclo(env.DISCORD_TOKEN)) return json({ error: 'no existe' }, 404);
    if (ruta === '/avisos/personas-leer') return elObjeto(env).fetch('https://avisos/personas-leer' + new URL(req.url).search);
    const crudo = await req.text();
    if (crudo.length > 4000000) return json({ error: 'demasiado grande' }, 413);
    return elObjeto(env).fetch('https://avisos/personas-ciclo', {
      method: 'POST', body: crudo, headers: { 'content-type': 'application/json' },
    });
  }
  // 🏷️ EL INVENTARIO DE TAGS, DEL CICLO (`bot/tags_inventario.py`): con su clave. Lo que hoy muestra la carta de cada uno,
  // sumado; de vuelta, lo que eligió cada uno
  if (ruta === '/avisos/tags-ciclo') {
    const k = req.headers.get('x-lg-ciclo') || '';
    if (!env.DISCORD_TOKEN || k !== await claveCiclo(env.DISCORD_TOKEN)) return json({ error: 'no existe' }, 404);
    const crudo = await req.text();
    if (crudo.length > 900000) return json({ error: 'demasiado grande' }, 413);
    return elObjeto(env).fetch('https://avisos/tags-ciclo', {
      method: 'POST', body: crudo, headers: { 'content-type': 'application/json' },
    });
  }
  // 🎟️ LO DEL PASE QUE SABE EL CICLO (`bot/pase.py`): con su clave, y tal cual al objeto, que lo valida. Trae la lista
  // de miembros: por eso no entra por el reenvío de abajo (4 KB) ni por KV (1.000 escrituras por día)
  if (ruta === '/avisos/pase-ciclo') {
    const k = req.headers.get('x-lg-ciclo') || '';
    if (!env.DISCORD_TOKEN || k !== await claveCiclo(env.DISCORD_TOKEN)) return json({ error: 'no existe' }, 404);
    const crudo = await req.text();
    if (crudo.length > 600000) return json({ error: 'demasiado grande' }, 413);
    return elObjeto(env).fetch('https://avisos/pase-ciclo', {
      method: 'POST', body: crudo, headers: { 'content-type': 'application/json' },
    });
  }
  const sub = ruta.slice('/avisos'.length);
  if (metodo === 'GET') return elObjeto(env).fetch('https://avisos' + sub);
  const cuerpo = await req.text();
  if (cuerpo.length > 4096) return json({ error: 'demasiado grande' }, 413);
  return elObjeto(env).fetch('https://avisos' + sub, {
    method: 'POST', body: cuerpo, headers: { 'content-type': 'application/json' },
  });
}

// ── los avisos de cada uno ─────────────────────────────────────────────
// 🔑 Dlx, 25/09/2026, a las ideas de Mi cuenta: «todas». La cuarta: que te
// llegue un aviso cuando te pasa algo a vos —subiste de rango, desbloqueaste
// una tarjeta—. Los arma el ciclo (`bot/avisos_personales.py`) y los deja en
// KV; el vigía los lee cada minuto y los manda a los dispositivos que esa
// persona vinculó.
//
// ⚠️ POR KV Y NO POR UNA RUTA: una ruta para que el ciclo le hable al Worker
// habría pedido un secreto compartido nuevo, y los tokens nuevos quedaron
// para el final (Dlx). El ciclo ya escribe KV con su llave.
export const COLA_PERSONAL = 'avisos:personales';

/** La cola que dejó el ciclo, con sólo lo que se puede mandar. */
export function colaPersonal(crudo, ahora) {
  let c = null;
  try { c = JSON.parse(crudo || 'null'); } catch (e) { c = null; }
  if (!Array.isArray(c)) return [];
  // ⚠️ LO DE MÁS DE UNA SEMANA NO SALE: la cola ya no se borra (ver
  // `personales()`) y `hechos` se olvida a los 30 días
  const desde = (ahora || Date.now()) - 7 * 24 * HORA;
  return c.filter((a) => a && typeof a.id === 'string' && /^[0-9]{5,25}$/.test(String(a.quien || '')) &&
    typeof a.titulo === 'string' && a.titulo && Date.parse(a.t || '') >= desde).slice(0, 200);
}

/** Cuántos avisos personales salen por minuto como mucho: el vigía comparte
 * el tope de 50 pedidos por invocación con la lectura de los canales. */
export const TOPE_PERSONALES = 15;

/** Lo que viaja al teléfono: lo lee `armar()` de `paginas/sw.js`. */
export function cuerpoPersonal(a) {
  const url = /^https:\/\/underlegends\.pages\.dev\//.test(String(a.url || '')) ? a.url : '/';
  return JSON.stringify({ v: 1, tipo: 'personal', id: String(a.id).slice(0, 40),
    t: String(a.titulo).slice(0, 120), b: String(a.cuerpo || '').slice(0, 240), url });
}

/** Lo que corre el cron de cada minuto. */
/**
 * Lo que se guarda de un mensaje descartado: su última edición.
 *
 * ⚠️ `{}` SI NUNCA SE EDITÓ, que es lo que se guardaba antes: así las
 * filas viejas no se vuelven a leer todas de golpe al desplegar.
 */
export function marcaDescarte(m) {
  const ed = m && m.edited_timestamp ? String(m.edited_timestamp) : '';
  return ed ? JSON.stringify({ ed }) : '{}';
}

/**
 * ¿Se vuelve a leer un mensaje que ya pasó por el vigía?
 *
 * 🔴 UN ANUNCIO QUE SE ARMA EN DOS PASOS NO SONABA NUNCA. Se publica
 * la imagen sola —o «📢 SE VIENE…»— y a los dos minutos se edita con el
 * horario y los cupos; el vigía ya lo había descartado y no lo miraba más
 * (auditoría del 25/09/2026). Ahora, si se editó después de descartarlo,
 * se lee de nuevo.
 *
 * ⚠️ SÓLO LO DESCARTADO AL LEERLO (`desde = hasta = 0`). Lo avisado, lo
 * que está en cola y lo vencido no se vuelven a mirar nunca: una edición
 * no puede hacer sonar dos veces el mismo evento.
 */
export function releer(fila, m) {
  if (!fila) return true;
  if (Number(fila.estado) !== 2 || Number(fila.hasta) !== 0) return false;
  return String(fila.cuerpo || '') !== marcaDescarte(m);
}

/**
 * La marca del disparador del ciclo (el cron de :22 y :52 del Worker).
 * `true` si quedó guardada.
 *
 * 🔑 EN EL OBJETO Y NO EN KV. Eran dos escrituras de KV por disparo
 * —`cron:arranco` y `cron:ultimo`—, ~70 por día de una cuota de 1.000
 * para toda la cuenta que se pasó tres días de siete (20, 22 y 24/09).
 * Es el mismo motivo por el que el vigía late acá: el objeto tiene cien
 * veces más cupo. Se leen en `/avisos/estado` → `disparador`.
 *
 * ⚠️ INTERNA: no está en `RUTAS`, así que desde afuera no se puede
 * escribir. Sólo la llama el `scheduled` del Worker.
 */
export async function marcarDisparo(env, cual, v) {
  if (!env.AVISOS) return false;
  try {
    const r = await elObjeto(env).fetch('https://avisos/disparo', {
      method: 'POST', body: JSON.stringify({ cual, v }),
      headers: { 'content-type': 'application/json' },
    });
    return r.ok;
  } catch (e) {
    return false;
  }
}

/**
 * Suelta los dispositivos vinculados a esa persona y borra sus votos. Lo usa
 * `/borrar-mis-datos`.
 *
 * ⚠️ SÓLO POR DENTRO: la ruta `/olvidar` del objeto NO está en `RUTAS`, así
 * que no se puede pedir desde afuera. Desde afuera cualquiera podría soltar
 * los avisos de otro con sólo saber su ID; acá el ID sale de la interacción
 * firmada por Discord.
 *
 * ⚠️ SE SUELTA EL VÍNCULO, NO LA SUSCRIPCIÓN: los avisos de eventos de ese
 * dispositivo los eligió el dispositivo, y se apagan desde la campana.
 */
export async function olvidarAvisos(env, quien, clave) {
  if (!env.AVISOS || !/^[0-9]{5,25}$/.test(String(quien || ''))) return null;
  try {
    const r = await elObjeto(env).fetch('https://avisos/olvidar', {
      method: 'POST', body: JSON.stringify({ quien: String(quien), clave: clave ? String(clave) : '' }),
      headers: { 'content-type': 'application/json' },
    });
    return r.ok ? (await r.json()).soltados : null;
  } catch (e) {
    return null;
  }
}

export async function vigilar(env, servidores, dueno, dormido) {
  if (!env.AVISOS) return;
  const o = elObjeto(env);
  const pedir = (ruta, cuerpo) => o.fetch('https://avisos' + ruta, {
    method: 'POST', body: JSON.stringify(cuerpo), headers: { 'content-type': 'application/json' } });
  // 🛡️ EL ANTI-RAID VA EN SU PROPIO PEDIDO, a la par del vigía (pasada del 19/10/2026). Adentro de la vuelta del vigía
  // compartía sus 50 pedidos a Discord por invocación —el vigía lee todos los canales de la Liga— y se perdía cada vez
  // que el vigía se salteaba (una vuelta colgada lo saltea 3 minutos). Así tiene su presupuesto y su candado. Y NO
  // DUERME (Dlx, 18/10/2026: «sí, sólo el anti-raid»): el raid a DDF fue a las 22:49 y pudo ser a las 4 AM
  await Promise.allSettled([
    pedir('/vigilar', { servidores, dueno: dueno || '', dormido: !!dormido }),
    pedir('/antiraid-vuelta', {}),
  ]);
}

// ═════════════════════════════════════════════════════════════════════
// EL OBJETO: suscripciones, lo avisado y el latido
// ═════════════════════════════════════════════════════════════════════
//
// ⚠️ UNO SOLO PARA TODA LA LIGA (`idFromName('liga')`). A este tamaño —el
// padrón entero son 870 personas— un objeto alcanza de sobra, y uno solo
// es lo que hace atómico el «¿ya avisé este mensaje?»: dos minutos que se
// pisan no pueden avisar dos veces.

export class Avisos {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    // 📏 CUÁNTO LEE CADA CONSULTA (05/10/2026). Las filas que lee el objeto pasaron de 97.000 por día a 1,9 millones en
    // una semana, contra un techo gratis de 5 millones (y las lecturas de KV, de 32.000 a 63.000 de 100.000). Antes de
    // arreglar se mide: cada consulta suma sus filas leídas bajo su propio texto —así dos pedidos que se cruzan no se
    // confunden—, cada lectura de KV bajo su clave (las de cada persona, juntas) y cada pedido bajo su ruta. Sólo
    // números, nunca de quién. Se guarda cada 10 minutos (`medidasGuardar()`) y se ve en `/avisos/estado`.
    // 🔴 `antiraid` (pasada del 19/10/2026): el anti-raid contaba sus avisos, lo de AUTOMÁTICO y sus errores con
    // `medir('antiraid', …)` desde el 18/10, y sin este balde no se guardaba nada: anduviera o no, se veía igual
    this.med = { filas: {}, kv: {}, pedidos: {}, antiraid: {} };
    const real = state.storage.sql;
    const filas = (cur, q) => {
      let n = 0;
      try { n = Number(cur.rowsRead) || 0; } catch (e) { n = 0; }
      if (n) this.medir('filas', String(q).replace(/\s+/g, ' ').trim().slice(0, 90), n);
    };
    this.sql = {
      exec: (q, ...ps) => {
        const cur = real.exec(q, ...ps);
        // lo que no devuelve filas ya se ejecutó entero; lo que sí, se cuenta al leerlo
        if (!/^\s*(SELECT|WITH)\b/i.test(String(q))) { filas(cur, q); return cur; }
        return new Proxy(cur, { get: (t, p) => {
          if (p === 'toArray') return () => { const r = t.toArray(); filas(t, q); return r; };
          const v = Reflect.get(t, p, t);
          return typeof v === 'function' ? v.bind(t) : v;
        } });
      },
    };
    if (env && env.KV) {
      const kv = env.KV;
      const medido = { get: (k, o) => { this.medir('kv', claveMedida(k), 1); return kv.get(k, o); },
        put: (...a) => kv.put(...a), delete: (...a) => kv.delete(...a), list: (...a) => kv.list(...a),
        getWithMetadata: (...a) => kv.getWithMetadata(...a) };
      this.env = new Proxy(env, { get: (t, p) => (p === 'KV' ? medido : t[p]) });
    }
    state.blockConcurrencyWhile(async () => {
      this.sql.exec(`
        CREATE TABLE IF NOT EXISTS subs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          endpoint TEXT NOT NULL UNIQUE,
          p256dh TEXT NOT NULL,
          auth TEXT NOT NULL,
          svs TEXT NOT NULL DEFAULT '',
          alta INTEGER NOT NULL,
          visto INTEGER NOT NULL,
          enviados INTEGER NOT NULL DEFAULT 0,
          fallos INTEGER NOT NULL DEFAULT 0,
          prueba INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS avisos (
          id TEXT PRIMARY KEY,
          sv TEXT NOT NULL DEFAULT '',
          cuerpo TEXT NOT NULL,
          desde INTEGER NOT NULL,
          hasta INTEGER NOT NULL,
          creado INTEGER NOT NULL,
          cursor INTEGER NOT NULL DEFAULT 0,
          estado INTEGER NOT NULL DEFAULT 0,
          enviados INTEGER NOT NULL DEFAULT 0,
          fallos INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS estado (k TEXT PRIMARY KEY, v TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS claves (
          clave TEXT PRIMARY KEY,
          id TEXT NOT NULL,
          t INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS repetidos (
          id TEXT PRIMARY KEY,
          de TEXT NOT NULL,
          canal TEXT NOT NULL,
          t INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS vivo (
          id TEXT PRIMARY KEY,
          canal TEXT NOT NULL,
          sv TEXT NOT NULL DEFAULT '',
          g TEXT NOT NULL DEFAULT '',
          autor TEXT NOT NULL DEFAULT '',
          pub INTEGER NOT NULL,
          ed INTEGER NOT NULL,
          texto TEXT NOT NULL,
          visto INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS vivo_borradas (
          id TEXT PRIMARY KEY,
          sv TEXT NOT NULL DEFAULT '',
          pub INTEGER NOT NULL,
          ed INTEGER NOT NULL,
          texto TEXT NOT NULL,
          t INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS veredictos (
          id TEXT PRIMARY KEY,
          canal TEXT NOT NULL,
          sv TEXT NOT NULL DEFAULT '',
          g TEXT NOT NULL DEFAULT '',
          autor TEXT NOT NULL DEFAULT '',
          pub INTEGER NOT NULL,
          ed INTEGER NOT NULL,
          texto TEXT NOT NULL
        );
        -- 🗳️ LOS VEREDICTOS, PARA SIEMPRE Y CON CADA VERSIÓN (Dlx, 26/10/2026: «Necesitamos guardar los veredictos de
        -- los jurados a partir de ahora»). «veredictos» se pisa al editarse y se borra a las 12 h; ésta no: cada texto
        -- distinto que se vio de un mensaje es una fila, así un veredicto editado o cambiado a «.» no se pierde
        CREATE TABLE IF NOT EXISTS veredictos_hist (
          id TEXT NOT NULL,
          canal TEXT NOT NULL,
          sv TEXT NOT NULL DEFAULT '',
          autor TEXT NOT NULL DEFAULT '',
          pub INTEGER NOT NULL,
          ed INTEGER NOT NULL,
          texto TEXT NOT NULL,
          visto INTEGER NOT NULL,
          UNIQUE (id, texto)
        );
        CREATE TABLE IF NOT EXISTS posts (
          id TEXT PRIMARY KEY,
          cuerpo TEXT NOT NULL,
          creado INTEGER NOT NULL,
          hecho INTEGER NOT NULL DEFAULT 0,
          intentos INTEGER NOT NULL DEFAULT 0,
          msg TEXT NOT NULL DEFAULT '',
          error TEXT NOT NULL DEFAULT ''
        );
      `);
      // 🔴 LA TABLA DE LOS DMs DE `/notify` SE BORRA: se sacaron el mismo día
      // que nacieron, con 0 anotados. Estado que ya no lee nadie es estado
      // que alguien va a creer que sirve. (La columna `cursor_dm` de `avisos`
      // queda donde ya existía: no la lee nada.)
      this.sql.exec('DROP TABLE IF EXISTS dms');
      // 🔑 LOS AVISOS DE CADA UNO (25/09/2026): de quién es cada dispositivo
      // —si lo vinculó entrando con Discord— y qué aviso personal ya salió.
      // `ADD COLUMN` falla si ya está: es la migración de una sola vez.
      try { this.sql.exec("ALTER TABLE subs ADD COLUMN quien TEXT NOT NULL DEFAULT ''"); } catch (e) { /* ya estaba */ }
      // ⚡ se busca por `quien` cada minuto (los avisos de cada uno, «te toca», la bandeja): sin índice era recorrer
      // todas las suscripciones cada vez (revisión del 04/10/2026)
      this.sql.exec('CREATE INDEX IF NOT EXISTS subs_quien ON subs (quien)');
      this.sql.exec('CREATE TABLE IF NOT EXISTS hechos (id TEXT PRIMARY KEY, t INTEGER NOT NULL)');
      // 🎤 EL BOT EN VIVO EN LOS CHATS (05/10/2026): qué dijo de cada llave en cada canal (`msg` vacío = salteado).
      // Ver `chatVivo()`
      // 🖼️ los vs que esperan su imagen (12/10/2026, «más visual… las tarjetas»): ver `vsEncolar()`
      this.sql.exec('CREATE TABLE IF NOT EXISTS vs_cola (id TEXT PRIMARY KEY, sv TEXT NOT NULL, canal TEXT NOT NULL, ' +
        "msg TEXT NOT NULL, datos TEXT NOT NULL, estado TEXT NOT NULL DEFAULT 'espera', t INTEGER NOT NULL)");
      this.sql.exec('CREATE TABLE IF NOT EXISTS chat_vivo (llave TEXT NOT NULL, canal TEXT NOT NULL, m TEXT NOT NULL, ' +
        "msg TEXT NOT NULL DEFAULT '', texto TEXT NOT NULL DEFAULT '', t INTEGER NOT NULL, PRIMARY KEY (llave, canal, m))");
      // 🔑 LAS ENCUESTAS (27/09/2026): un voto por Discord ID y por encuesta,
      // que se cambia hasta que cierra. Ver `validarVoto()` y `votar()`.
      this.sql.exec('CREATE TABLE IF NOT EXISTS votos (enc TEXT NOT NULL, quien TEXT NOT NULL, ' +
        'op TEXT NOT NULL, t INTEGER NOT NULL, PRIMARY KEY (enc, quien))');
      // 🗳️ «¿QUIÉN GANA LA LIGA?» (14/10/2026): un voto por Discord ID y por liga, que se cambia hasta que cierra.
      // `cierra`: hasta cuándo va esa liga (se corre con cada voto); se borra `LIGA_VOTOS_DIAS` después. Ver `ligaVotar()`
      this.sql.exec('CREATE TABLE IF NOT EXISTS liga_voto (liga TEXT NOT NULL, quien TEXT NOT NULL, op TEXT NOT NULL, ' +
        't INTEGER NOT NULL, cierra INTEGER NOT NULL, PRIMARY KEY (liga, quien))');
      // 🔑 EL PRECIO POR CABEZA (28/09/2026): lo que cada uno puso (`precios`)
      // y lo que cobró cazando (`tienda`). El saldo sale de las dos: ver
      // `saldo()`. Quién cazó lo resuelve el ciclo (`bot/precios.py`).
      this.sql.exec('CREATE TABLE IF NOT EXISTS precios (id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
        'quien TEXT NOT NULL, cabeza TEXT NOT NULL, monto INTEGER NOT NULL, t INTEGER NOT NULL, ' +
        "fin INTEGER NOT NULL, estado TEXT NOT NULL DEFAULT '', por TEXT NOT NULL DEFAULT '')");
      this.sql.exec('CREATE TABLE IF NOT EXISTS tienda (id TEXT PRIMARY KEY, ref INTEGER NOT NULL, ' +
        'quien TEXT NOT NULL, monto INTEGER NOT NULL, t INTEGER NOT NULL)');
      // 🔑 LAS SESIONES (28/09/2026): entrar con Discord una vez. Se guarda el
      // hash del número, no el número. Ver `sesionNueva()` y `sesion()`.
      this.sql.exec('CREATE TABLE IF NOT EXISTS sesiones (h TEXT PRIMARY KEY, quien TEXT NOT NULL, ' +
        't INTEGER NOT NULL, vence INTEGER NOT NULL)');
      // 📊 quién usó el bot o la página cada día, y las visitas sin cuenta (04/10/2026). Ver `anotarUso()`
      this.sql.exec('CREATE TABLE IF NOT EXISTS uso (dia TEXT NOT NULL, quien TEXT NOT NULL, por TEXT NOT NULL, ' +
        'PRIMARY KEY (dia, quien, por)) WITHOUT ROWID');
      this.sql.exec('CREATE TABLE IF NOT EXISTS visitas (dia TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0)');
      // 🧭 y el tutorial (12/10/2026): cuántos navegadores vieron, terminaron o saltearon cada cosa, por día. Sólo números
      this.sql.exec('CREATE TABLE IF NOT EXISTS tutorial (dia TEXT NOT NULL, ev TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, ' +
        'PRIMARY KEY (dia, ev)) WITHOUT ROWID');
      // 📊 y qué secciones se abren (12/10/2026): cuántos navegadores abrieron cada una, por día. Sólo números
      this.sql.exec('CREATE TABLE IF NOT EXISTS secciones (dia TEXT NOT NULL, s TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, ' +
        'PRIMARY KEY (dia, s)) WITHOUT ROWID');
      // 👆 y qué se toca en toda la página (16/10/2026): la sección y la etiqueta del botón, sumadas por día
      // 🐞 los errores de la página, por día y por error (19/10/2026, `errorPagina()`): nunca de quién
      this.sql.exec('CREATE TABLE IF NOT EXISTS errores_pag (dia TEXT NOT NULL, k TEXT NOT NULL, donde TEXT NOT NULL, ' +
        "msg TEXT NOT NULL, f TEXT NOT NULL DEFAULT '', tipo TEXT NOT NULL DEFAULT '', n INTEGER NOT NULL DEFAULT 0, " +
        'primero INTEGER NOT NULL, ultimo INTEGER NOT NULL, PRIMARY KEY (dia, k)) WITHOUT ROWID');
      // y cuáles ya se avisaron al canal de Logs (`erroresAvisar()`), para no repetirlos
      this.sql.exec('CREATE TABLE IF NOT EXISTS errores_avisados (k TEXT PRIMARY KEY, t INTEGER NOT NULL) WITHOUT ROWID');
      this.sql.exec('CREATE TABLE IF NOT EXISTS clics (dia TEXT NOT NULL, k TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, ' +
        'PRIMARY KEY (dia, k)) WITHOUT ROWID');
      // 🔥 LA RACHA DIARIA Y LOS NIVELES (04/10/2026): qué días contó cada uno (`activo`: el bot, la página con su
      // cuenta o un evento jugado; el día, nunca la hora) y, de los que jugaron, su perfil y cuántos eventos
      // (`jugo_temp`, por temporada, que manda el ciclo). Ver `diaActivo()`, `rachaDe()` y `bot/racha.py`
      this.sql.exec('CREATE TABLE IF NOT EXISTS activo (quien TEXT NOT NULL, dia TEXT NOT NULL, ' +
        'PRIMARY KEY (quien, dia)) WITHOUT ROWID');
      // ⚠️ POR TEMPORADA (`jugo_temp`), no una fila por persona: el ciclo manda los eventos de la temporada en curso,
      // y el nivel no se reinicia. `jugado` fue la primera versión (una hora de vida, el 04/10): se borra
      this.sql.exec('DROP TABLE IF EXISTS jugado');
      this.sql.exec('CREATE TABLE IF NOT EXISTS jugo_temp (quien TEXT NOT NULL, temp TEXT NOT NULL, k TEXT NOT NULL, ' +
        'eventos INTEGER NOT NULL, PRIMARY KEY (quien, temp)) WITHOUT ROWID');
      // 🔑 SEGUIR RAPEROS (28/09/2026): quién (Discord ID) sigue a qué perfil
      // (la clave de `#/r/`), desde cuándo, cuál es su propio perfil (`de`,
      // para no avisarle de sí mismo) y cuándo se creó su cuenta de Discord
      // (`creada`: las de menos de 30 días siguen, pero no cuentan). Ver `seguir()`.
      this.sql.exec('CREATE TABLE IF NOT EXISTS sigue (quien TEXT NOT NULL, a TEXT NOT NULL, ' +
        "t INTEGER NOT NULL, de TEXT NOT NULL DEFAULT '', creada INTEGER NOT NULL DEFAULT 0, " +
        'PRIMARY KEY (quien, a))');
      this.sql.exec('CREATE INDEX IF NOT EXISTS sigue_a ON sigue (a)');
      // 📖 LAS HISTORIAS QUE VIO CADA UNO (18/10/2026): el id de cada historia y cuándo, hasta `HISTORIAS_TOPE` por persona y
      // `HISTORIAS_DIAS` días. Ver `historiasVistas()`
      this.sql.exec('CREATE TABLE IF NOT EXISTS hvistas (quien TEXT NOT NULL, id TEXT NOT NULL, t INTEGER NOT NULL, PRIMARY KEY (quien, id))');
      // 🔔 LAS LIGAS QUE SIGUE CADA UNO (17/10/2026): `t` es desde cuándo, para no avisarle de lo de antes
      this.sql.exec('CREATE TABLE IF NOT EXISTS liga_sigue (quien TEXT NOT NULL, liga TEXT NOT NULL, t INTEGER NOT NULL, ' +
        'PRIMARY KEY (quien, liga))');
      this.sql.exec('CREATE INDEX IF NOT EXISTS liga_sigue_l ON liga_sigue (liga)');
      // 🎬 TUS BATALLAS EN VIDEO (12/10/2026): cada pedido y cómo terminó, los reportes («esto no es suyo»), lo que
      // cada uno quitó de su perfil y lo que Dlx aprobó o no. Ver `misVideos()`
      this.sql.exec('CREATE TABLE IF NOT EXISTS videos_pedidos (id INTEGER PRIMARY KEY AUTOINCREMENT, quien TEXT NOT NULL, ' +
        "clave TEXT NOT NULL, tipo TEXT NOT NULL, url TEXT NOT NULL, t INTEGER NOT NULL, estado TEXT NOT NULL DEFAULT 'espera', " +
        "motivo TEXT NOT NULL DEFAULT '')");
      this.sql.exec('CREATE INDEX IF NOT EXISTS videos_pedidos_q ON videos_pedidos (quien, t)');
      // 🎬 lo que contestó quien pidió un video sin su nombre en el título (16/10/2026, ver `misVideos()`)
      try { this.sql.exec("ALTER TABLE videos_pedidos ADD COLUMN resp TEXT NOT NULL DEFAULT ''"); } catch (e) { /* ya estaba */ }
      this.sql.exec('CREATE TABLE IF NOT EXISTS videos_reportes (vid TEXT NOT NULL, clave TEXT NOT NULL, quien TEXT NOT NULL, ' +
        't INTEGER NOT NULL, PRIMARY KEY (vid, quien))');
      this.sql.exec('CREATE TABLE IF NOT EXISTS videos_quitados (clave TEXT NOT NULL, vid TEXT NOT NULL, t INTEGER NOT NULL, ' +
        'PRIMARY KEY (clave, vid))');
      this.sql.exec('CREATE TABLE IF NOT EXISTS videos_decididos (id INTEGER PRIMARY KEY, si INTEGER NOT NULL, t INTEGER NOT NULL)');
      // 📣 SEGUIR A UN ORGANIZADOR (12/10/2026, Dlx «5. E»): a quién sigue cada uno, y la cola de avisos cuando anuncia.
      // Ver `seguirOrg()` y `avisarOrgs()`
      this.sql.exec('CREATE TABLE IF NOT EXISTS sigue_org (quien TEXT NOT NULL, org TEXT NOT NULL, nombre TEXT NOT NULL, ' +
        't INTEGER NOT NULL, PRIMARY KEY (quien, org))');
      this.sql.exec('CREATE INDEX IF NOT EXISTS sigue_org_o ON sigue_org (org)');
      this.sql.exec('CREATE TABLE IF NOT EXISTS org_cola (id INTEGER PRIMARY KEY AUTOINCREMENT, quien TEXT NOT NULL, ' +
        'clave TEXT NOT NULL, titulo TEXT NOT NULL, cuerpo TEXT NOT NULL, url TEXT NOT NULL, t INTEGER NOT NULL, ' +
        'hecho INTEGER NOT NULL DEFAULT 0)');
      // 📅 /agendar (12/10/2026): los eventos que agenda el staff de cada servidor. Ver `agendar()`
      this.sql.exec('CREATE TABLE IF NOT EXISTS agenda (id INTEGER PRIMARY KEY AUTOINCREMENT, sv TEXT NOT NULL, g TEXT NOT NULL, ' +
        "quien TEXT NOT NULL, nombre TEXT NOT NULL, ini INTEGER NOT NULL, formato TEXT NOT NULL DEFAULT '', t INTEGER NOT NULL, " +
        'borrado INTEGER NOT NULL DEFAULT 0)');
      // ⭐ «ALGUIEN TE SIGUE» (02/10/2026): qué seguimiento ya se avisó, y cuándo fue el último aviso de cada perfil.
      // ⚠️ LO QUE YA EXISTÍA NACE AVISADO (DEFAULT 1): si no, la primera vuelta le diría a cada uno «N personas nuevas
      // te siguen» por lo de siempre. `seguir()` anota 0. Ver `avisarSeguidores()`
      try { this.sql.exec('ALTER TABLE sigue ADD COLUMN avisado INTEGER NOT NULL DEFAULT 1'); } catch (e) { /* ya estaba */ }
      this.sql.exec('CREATE TABLE IF NOT EXISTS seguidores_av (a TEXT PRIMARY KEY, t INTEGER NOT NULL)');
      // 🔑 «TU SERVIDOR» (28/09/2026): el que cada uno elige en Mi cuenta, uno
      // por temporada. `fijo` dice si se eligió con el límite rigiendo: como
      // la foto, se cambia libre hasta el fin de `FOTO_LIBRE` (comun/temporada.py). Ver `miServidor()`.
      this.sql.exec('CREATE TABLE IF NOT EXISTS servidor (quien TEXT NOT NULL, temporada TEXT NOT NULL, ' +
        "sv TEXT NOT NULL, de TEXT NOT NULL DEFAULT '', t INTEGER NOT NULL, fijo INTEGER NOT NULL DEFAULT 0, " +
        'PRIMARY KEY (quien, temporada))');
      // 🔑 «OCULTAR MI FOTO» (Dlx, 02/10/2026: «1. A»): quién la ocultó. Ver `miFoto()`
      this.sql.exec('CREATE TABLE IF NOT EXISTS foto_oculta (quien TEXT PRIMARY KEY, t INTEGER NOT NULL)');
      // 🔑 LO QUE SE ANOTÓ EN LOS CANALES DE INSCRIPCIONES (29/09/2026): ver `inscripciones()`
      this.sql.exec('CREATE TABLE IF NOT EXISTS inscritos (id TEXT PRIMARY KEY, canal TEXT NOT NULL, ' +
        "nombre TEXT NOT NULL DEFAULT '', sv TEXT NOT NULL DEFAULT '', autor_id TEXT NOT NULL DEFAULT '', " +
        "autor TEXT NOT NULL DEFAULT '', pub INTEGER NOT NULL, ed INTEGER NOT NULL, texto TEXT NOT NULL DEFAULT '')");
      // 🕵️ QUIÉN ES CADA NOMBRE EN VIVO (02/10/2026): las menciones de cada llave, y de qué perfil es cada cuenta
      // (`d:`/`dn:` de KV, guardado unas horas para no pedirlo cada minuto). Ver `quienes()`
      try { this.sql.exec("ALTER TABLE vivo ADD COLUMN men TEXT NOT NULL DEFAULT ''"); } catch (e) { /* ya estaba */ }
      this.sql.exec("CREATE TABLE IF NOT EXISTS idk (id TEXT PRIMARY KEY, k TEXT NOT NULL DEFAULT '', t INTEGER NOT NULL)");
      // 🔑 UN ERROR EN UNA LLAVE (28/09/2026): ver `reportar()`
      this.sql.exec('CREATE TABLE IF NOT EXISTS reportes (id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
        "quien TEXT NOT NULL, llave TEXT NOT NULL, que TEXT NOT NULL, texto TEXT NOT NULL DEFAULT '', " +
        "batalla TEXT NOT NULL DEFAULT '', t INTEGER NOT NULL)");
      // 📣 y qué decidió Dlx de cada uno y qué hizo el ciclo (13/10/2026): ver `duenoReporte()` y `reportesEstados()`
      // 🔎 y `evid`: lo que encontró el bot de cada reporte (quién lo mandó, las inscripciones, la llamada), lo pone el
      // ciclo (`bot/reportes.py`, `evidencia()`) y se borra con el reporte
      // 🖼️ el fondo de cada uno (13/10/2026): el aprobado (`url`) y el que espera revisión (`pend`). Ver `fondo()`
      this.sql.exec("CREATE TABLE IF NOT EXISTS fondos (quien TEXT PRIMARY KEY, k TEXT NOT NULL DEFAULT '', estado TEXT NOT NULL, " +
        "url TEXT NOT NULL DEFAULT '', pend TEXT NOT NULL DEFAULT '', perfil INTEGER NOT NULL DEFAULT 1, pagina INTEGER NOT NULL DEFAULT 1, " +
        "motivo TEXT NOT NULL DEFAULT '', t INTEGER NOT NULL, subidas TEXT NOT NULL DEFAULT '')");
      // 📸 la foto propia de cada carta (13/10/2026): `estado` 'ok' si se ve la propia ('' o 'no': la de Discord); `pend`,
      // la que espera revisión, aparte —mientras tanto se sigue viendo la de antes—; `t`, cuándo se cambió, para la regla
      // de una por semana. Ver `fotoCarta()`
      this.sql.exec("CREATE TABLE IF NOT EXISTS fotos_carta (quien TEXT NOT NULL, carta TEXT NOT NULL, k TEXT NOT NULL DEFAULT '', " +
        "estado TEXT NOT NULL DEFAULT '', pend TEXT NOT NULL DEFAULT '', motivo TEXT NOT NULL DEFAULT '', t INTEGER NOT NULL DEFAULT 0, " +
        'PRIMARY KEY (quien, carta))');
      // 🏷️ los roles que pone o saca Dlx (13/10/2026): `si` 1 lo pone, 0 lo saca aunque salga solo. Ver `duenoRol()`
      this.sql.exec('CREATE TABLE IF NOT EXISTS roles_manual (quien TEXT NOT NULL, rol TEXT NOT NULL, si INTEGER NOT NULL, ' +
        't INTEGER NOT NULL, PRIMARY KEY (quien, rol))');
      // ✅ lo contestado de ✅ Decidir desde el Dashboard (13/10/2026): ver `duenoDecidir()`. Se borra cuando la pregunta
      // deja de estar abierta (`decidirEstados()`)
      this.sql.exec("CREATE TABLE IF NOT EXISTS decidir_resp (id TEXT PRIMARY KEY, r TEXT NOT NULL, nota TEXT NOT NULL DEFAULT '', " +
        't INTEGER NOT NULL)');
      // 🔐 y quién la contestó (13/10/2026: los permisos)
      try { this.sql.exec("ALTER TABLE decidir_resp ADD COLUMN por TEXT NOT NULL DEFAULT ''"); } catch (e) { /* ya estaba */ }
      // 🔎 por qué se cerró cada reporte (25/10/2026): aparte de `reportes`, que se borra a los días, para que el conteo de
      // «qué falla más» dure 120. Ver `causasDueno()`
      this.sql.exec('CREATE TABLE IF NOT EXISTS reportes_causas (id INTEGER PRIMARY KEY, causa TEXT NOT NULL, t INTEGER NOT NULL)');
      // 📊 y cuánto esperó cada uno desde que llegó hasta que se cerró (`dashMedResumen()`)
      try { this.sql.exec('ALTER TABLE reportes_causas ADD COLUMN espera INTEGER NOT NULL DEFAULT 0'); } catch (e) { /* ya estaba */ }
      // 👀 quién está mirando qué en Pendientes (25/10/2026): `k` es la clave del caso; dura 10 minutos. Ver `duenoViendo()`
      this.sql.exec('CREATE TABLE IF NOT EXISTS viendo (k TEXT PRIMARY KEY, por TEXT NOT NULL, quien TEXT NOT NULL, t INTEGER NOT NULL)');
      // 🔁 a quién se le avisó que vuelva, cuándo y quién (25/10/2026): uno por persona cada 7 días. Ver `avisoVuelve()`
      this.sql.exec('CREATE TABLE IF NOT EXISTS vuelve (k TEXT PRIMARY KEY, que TEXT NOT NULL, por TEXT NOT NULL, t INTEGER NOT NULL)');
      // 🧪 el grupo sin aviso: cuándo entró cada uno a la lista (para medir si volvió en 14 días). Ver `enControlVuelve()`
      this.sql.exec('CREATE TABLE IF NOT EXISTS vuelve_control (k TEXT PRIMARY KEY, t INTEGER NOT NULL)');
      // 📊 los números del propio Dashboard por día: casos que dos miraban a la vez, deshacer usados. Ver `dashMed()`
      this.sql.exec('CREATE TABLE IF NOT EXISTS dash_med (dia TEXT NOT NULL, k TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (dia, k))');
      // 🗂️ las notas del staff sobre una persona (25/10/2026): por su perfil (`k`), con etiqueta y, la sanción, con fecha
      // de fin. Quedan quién la escribió y cuándo. Ver `duenoNota()` y `duenoFicha()`
      this.sql.exec("CREATE TABLE IF NOT EXISTS notas (id INTEGER PRIMARY KEY AUTOINCREMENT, k TEXT NOT NULL, et TEXT NOT NULL, " +
        "texto TEXT NOT NULL, hasta INTEGER NOT NULL DEFAULT 0, por TEXT NOT NULL, por_id TEXT NOT NULL DEFAULT '', t INTEGER NOT NULL)");
      for (const c of ["estado TEXT NOT NULL DEFAULT ''", "fix TEXT NOT NULL DEFAULT ''",
        "resultado TEXT NOT NULL DEFAULT ''", 't_estado INTEGER NOT NULL DEFAULT 0', "evid TEXT NOT NULL DEFAULT ''",
        "por TEXT NOT NULL DEFAULT ''"]) {
        try { this.sql.exec('ALTER TABLE reportes ADD COLUMN ' + c); } catch (e) { /* ya estaba */ }
      }
      // 🔑 LOS EVENTOS CANCELADOS (01/10/2026): ver `cancelado()` y `cancelaciones()`
      // 📅 LOS EVENTOS DE DISCORD (19/10/2026, `eventosDiscord()`): cada anuncio de un servidor que lo tiene prendido,
      // con el evento que se le creó allá y en qué quedó (0 por crear · 1 creado · 2 en vivo · 3 terminado ·
      // 4 cancelado · 8 tarde · 9 no se pudo)
      this.sql.exec('CREATE TABLE IF NOT EXISTS ev_discord (id TEXT PRIMARY KEY, sv TEXT NOT NULL, g TEXT NOT NULL, ' +
        "nombre TEXT NOT NULL, url TEXT NOT NULL, ini INTEGER NOT NULL, fin INTEGER NOT NULL, ev TEXT NOT NULL DEFAULT '', " +
        "estado INTEGER NOT NULL DEFAULT 0, intentos INTEGER NOT NULL DEFAULT 0, error TEXT NOT NULL DEFAULT '', t INTEGER NOT NULL)");
      this.sql.exec('CREATE TABLE IF NOT EXISTS cancelados (id TEXT PRIMARY KEY, sv TEXT NOT NULL, ' +
        "cuerpo TEXT NOT NULL, t INTEGER NOT NULL, por TEXT NOT NULL DEFAULT '')");
      // 📢 LO QUE EL ORGANIZADOR AVISÓ DESPUÉS (07/10/2026): cancelado, en pausa o atrasado, y de qué anuncio. Ver
      // `estadoDeMensaje()` y `anotarEstado()`
      this.sql.exec('CREATE TABLE IF NOT EXISTS estados (id TEXT PRIMARY KEY, sv TEXT NOT NULL, tipo TEXT NOT NULL, ' +
        "nueva INTEGER NOT NULL DEFAULT 0, mas INTEGER NOT NULL DEFAULT 0, texto TEXT NOT NULL DEFAULT '', " +
        "pub INTEGER NOT NULL, evento TEXT NOT NULL DEFAULT '', t INTEGER NOT NULL)");
      // 🧩 las llaves que no se supieron leer y ya se avisaron (07/10/2026): ver `llaveRara()`
      this.sql.exec("CREATE TABLE IF NOT EXISTS llaves_raras (id TEXT PRIMARY KEY, sv TEXT NOT NULL DEFAULT '', t INTEGER NOT NULL)");
      // 🎲 LAS APUESTAS EN VIVO (07/10/2026, «A full»): cada una con su mensaje y su batalla (`apuestas`), y lo que puso
      // cada uno (`apostado`, uno por persona y apuesta, de un solo lado). La plata va y vuelve por `tienda` (`ap:`).
      // Ver `apostar()` y `apuestasRevisar()`
      this.sql.exec("CREATE TABLE IF NOT EXISTS apuestas (id TEXT PRIMARY KEY, canal TEXT NOT NULL, msg TEXT NOT NULL DEFAULT '', " +
        "sv TEXT NOT NULL DEFAULT '', llave TEXT NOT NULL, ronda TEXT NOT NULL, a TEXT NOT NULL, b TEXT NOT NULL, " +
        "texto TEXT NOT NULL DEFAULT '', abre INTEGER NOT NULL, cierra INTEGER NOT NULL, estado TEXT NOT NULL DEFAULT 'abierta', " +
        "ganador TEXT NOT NULL DEFAULT '')");
      this.sql.exec('CREATE TABLE IF NOT EXISTS apostado (ap TEXT NOT NULL, quien TEXT NOT NULL, lado TEXT NOT NULL, ' +
        'monto INTEGER NOT NULL, t INTEGER NOT NULL, PRIMARY KEY (ap, quien))');
      // 🗳️ «¿QUIÉN GANA?» (13/10/2026): cada cruce votado con su mensaje (`qg`) y un voto por persona (`qg_voto`), que se
      // puede cambiar mientras está abierto. Ver `qgVotar()` y `qgRevisar()`
      this.sql.exec("CREATE TABLE IF NOT EXISTS qg (id TEXT PRIMARY KEY, canal TEXT NOT NULL, msg TEXT NOT NULL, sv TEXT NOT NULL DEFAULT '', " +
        "llave TEXT NOT NULL, ronda TEXT NOT NULL, a TEXT NOT NULL, b TEXT NOT NULL, na INTEGER NOT NULL DEFAULT 0, " +
        "nb INTEGER NOT NULL DEFAULT 0, dicho TEXT NOT NULL DEFAULT '', abre INTEGER NOT NULL, estado TEXT NOT NULL DEFAULT 'abierta')");
      this.sql.exec('CREATE TABLE IF NOT EXISTS qg_voto (id TEXT NOT NULL, quien TEXT NOT NULL, lado TEXT NOT NULL, ' +
        't INTEGER NOT NULL, PRIMARY KEY (id, quien))');
      // 🧮 los lados de más de un «todos contra todos» (C, D, E) y sus votos, en JSON (19/10/2026)
      try { this.sql.exec("ALTER TABLE qg ADD COLUMN mas TEXT NOT NULL DEFAULT '[]'"); } catch (e) { /* ya estaba */ }
      try { this.sql.exec("ALTER TABLE qg ADD COLUMN nmas TEXT NOT NULL DEFAULT '[]'"); } catch (e) { /* ya estaba */ }
      // 🗳️ a quién votó el público en cada cruce cerrado (19/10/2026): `qg` se borra a la semana y el TAG 🗳️ FAVORITO
      // DEL PÚBLICO cuenta la temporada entera. Uno por cruce; ver `favoritoDe()` y `favoritos()`
      this.sql.exec('CREATE TABLE IF NOT EXISTS qg_fav (id TEXT PRIMARY KEY, n TEXT NOT NULL, temporada TEXT NOT NULL, t INTEGER NOT NULL)');
      // 👏 FELICITAR (02/10/2026): un aplauso por Discord ID y publicación (`aplausos`), y de cada publicación
      // felicitada lo que dice el aviso y hasta cuántos se avisó (`aplaudidas`). Ver `aplaudir()` y `avisarAplausos()`
      this.sql.exec('CREATE TABLE IF NOT EXISTS aplausos (id TEXT NOT NULL, quien TEXT NOT NULL, ' +
        't INTEGER NOT NULL, PRIMARY KEY (id, quien))');
      this.sql.exec('CREATE INDEX IF NOT EXISTS aplausos_quien ON aplausos (quien)');
      // 🔔 LA BANDEJA (02/10/2026): lo que se le avisó a cada uno, para el panel de la campana (Dlx: «que sea como un
      // panel de notificaciones recientes, quizás algo como Instagram»). Se anota aunque esa persona no tenga la
      // campana en ningún dispositivo: el panel se ve igual. El mismo aviso (`clave`) se pisa y vuelve a «nueva»:
      // «👏 12 te felicitaron» reemplaza a «👏 3». 30 días. Ver `aBandeja()` y `bandeja()`
      this.sql.exec('CREATE TABLE IF NOT EXISTS bandeja (quien TEXT NOT NULL, clave TEXT NOT NULL, t INTEGER NOT NULL, ' +
        "tipo TEXT NOT NULL DEFAULT '', titulo TEXT NOT NULL, cuerpo TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '', " +
        "cara TEXT NOT NULL DEFAULT '', visto INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (quien, clave))");
      this.sql.exec('CREATE TABLE IF NOT EXISTS aplaudidas (id TEXT PRIMARY KEY, tipo TEXT NOT NULL, ' +
        "quien TEXT NOT NULL DEFAULT '[]', ks TEXT NOT NULL DEFAULT '[]', motivo TEXT NOT NULL DEFAULT '', " +
        "t TEXT NOT NULL DEFAULT '', primero INTEGER NOT NULL, avisado INTEGER NOT NULL DEFAULT 0, " +
        't_avisado INTEGER NOT NULL DEFAULT 0)');
      // 🔢 cuántas veces cambió cada uno algo por día (ver `cuentaCambio()`): el tope de lo que escribe en KV
      this.sql.exec('CREATE TABLE IF NOT EXISTS cambios_dia (quien TEXT NOT NULL, que TEXT NOT NULL, dia TEXT NOT NULL, ' +
        'n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (quien, que, dia))');
      // 🤝 las postulaciones de /sumate (la página se fue el 13/10/2026: «descartado»): la tabla se queda hasta que
      // las que llegaron se borran solas a los 90 días
      this.sql.exec('CREATE TABLE IF NOT EXISTS postulaciones (id INTEGER PRIMARY KEY AUTOINCREMENT, quien TEXT NOT NULL, ' +
        "t INTEGER NOT NULL, datos TEXT NOT NULL, enviada INTEGER NOT NULL DEFAULT 0, error TEXT NOT NULL DEFAULT '')");
      // 🎟️ EL PASE DE RAPERO (05/10/2026): cada Tarea cumplida, por temporada y semana (`pase_hecho`: una cumplida no
      // se pierde, ni con una llave corregida ni cuando el aplauso se borra a los 21 días), y qué llave en vivo miró
      // cada uno (`pase_vivo`, 14 días). Ver `paseRevisar()` y `bot/pase.py`
      this.sql.exec('CREATE TABLE IF NOT EXISTS pase_hecho (quien TEXT NOT NULL, temp TEXT NOT NULL, sem TEXT NOT NULL, ' +
        'tarea TEXT NOT NULL, t INTEGER NOT NULL, PRIMARY KEY (quien, temp, sem, tarea))');
      this.sql.exec('CREATE TABLE IF NOT EXISTS pase_vivo (quien TEXT NOT NULL, llave TEXT NOT NULL, t INTEGER NOT NULL, ' +
        'PRIMARY KEY (quien, llave))');
      // 🎟️ EL PASE CON XP (06/10/2026: «como Brawl Stars»): lo que el Pase vio que hiciste (`pase_log`: cada
      // felicitación y cada llave en vivo, una vez cada una y por toda la temporada —los aplausos se borran a los 30
      // días y `pase_vivo` a los 14, y las Tareas de temporada piden la cuenta entera—) y cuándo llegó cada uno a los
      // niveles que se publican (`pase_hito`: Publicaciones y el Salón del Pase). Ver `paseCuenta()` y `paseRevisar()`
      this.sql.exec('CREATE TABLE IF NOT EXISTS pase_log (quien TEXT NOT NULL, temp TEXT NOT NULL, que TEXT NOT NULL, ' +
        'ref TEXT NOT NULL, t INTEGER NOT NULL, PRIMARY KEY (quien, temp, que, ref)) WITHOUT ROWID');
      this.sql.exec('CREATE TABLE IF NOT EXISTS pase_hito (quien TEXT NOT NULL, temp TEXT NOT NULL, ' +
        'nivel INTEGER NOT NULL, t INTEGER NOT NULL, PRIMARY KEY (quien, temp, nivel))');
      // 📊 EL TABLERO DEL PASE (25/10/2026, el informe «Pase de rapero enganche», cambio 1; Dlx: «dale»): una foto de
      // cuántos hay en cada nivel por semana, la primera vez que se mira esa semana. Para comparar antes y después de
      // tocar el Pase (la curva, la gracia…): sin la foto del antes no se puede decir si algo sirvió
      this.sql.exec('CREATE TABLE IF NOT EXISTS pase_foto (temp TEXT NOT NULL, sem TEXT NOT NULL, dist TEXT NOT NULL, ' +
        't INTEGER NOT NULL, PRIMARY KEY (temp, sem))');
      // 💎 EL PASE PREMIUM (Dlx, 25/10/2026): desde cuándo y hasta cuándo tuvo cada uno el rol de DRA que lo desbloquea
      // (`pase.ROL_PREMIUM`). El +20 % de XP vale para las Tareas cumplidas en ese rato: sacarle el rol no le baja el nivel
      this.sql.exec('CREATE TABLE IF NOT EXISTS pase_premium (quien TEXT NOT NULL, temp TEXT NOT NULL, desde INTEGER NOT NULL, ' +
        'hasta INTEGER, PRIMARY KEY (quien, temp))');
      // 🔔 los avisos del Pase (apagados de entrada: sólo quien los prende) y el color de nombre que eligió quien tiene el
      // premium (el nivel 7 de su fila)
      this.sql.exec('CREATE TABLE IF NOT EXISTS pase_aviso (quien TEXT PRIMARY KEY, si INTEGER NOT NULL, t INTEGER NOT NULL)');
      this.sql.exec('CREATE TABLE IF NOT EXISTS pase_color (quien TEXT PRIMARY KEY, color TEXT NOT NULL, t INTEGER NOT NULL)');
      // 🖼️ LOS MARCOS DE CARTA, EN EL INVENTARIO (Dlx, 25/10/2026: «se quedan permanentemente en el inventario de uno»):
      // `marco` es `<temporada>:<nivel>` (`t1:oro`). Se ganan con la fila premium y NO se pierden: ni al sacarle el rol ni
      // al cambiar la temporada. Y lo que eligió cada uno: qué marco lleva su carta y el estilo de la de Servidor
      this.sql.exec('CREATE TABLE IF NOT EXISTS marcos (quien TEXT NOT NULL, marco TEXT NOT NULL, t INTEGER NOT NULL, PRIMARY KEY (quien, marco))');
      this.sql.exec("CREATE TABLE IF NOT EXISTS marco_elige (quien TEXT PRIMARY KEY, marco TEXT NOT NULL DEFAULT '', " +
        "estilo TEXT NOT NULL DEFAULT 'camiseta', t INTEGER NOT NULL)");
      // 🏷️ EL TAG QUE CADA UNO ELIGE PARA CADA CARTA (Dlx, 25/10/2026: «que los tags de abajo sean personalizables en cada
      // tarjeta… desde el inventario»). `tag` es la clave del catálogo (`sheet/catalogo_tags.py`) o `pase:<título>`. El
      // inventario lo trae el ciclo (`/avisos/tags-ciclo`, en `estado` como `tags_ganados`)
      this.sql.exec('CREATE TABLE IF NOT EXISTS tag_elige (quien TEXT NOT NULL, carta TEXT NOT NULL, tag TEXT NOT NULL, ' +
        't INTEGER NOT NULL, PRIMARY KEY (quien, carta))');
      // 🎟️ EL SORTEO DEL PASE PREMIUM (Dlx, 25/10/2026: «algo interactivo en la página»): quién entró y con cuántos
      // boletos (1 + las semanas con las cinco semanales, hasta 3). Lo programa Dlx (`pase_sorteo` de los ajustes)
      this.sql.exec('CREATE TABLE IF NOT EXISTS sorteo_part (sorteo TEXT NOT NULL, quien TEXT NOT NULL, boletos INTEGER NOT NULL, ' +
        't INTEGER NOT NULL, PRIMARY KEY (sorteo, quien))');
      this.sql.exec('CREATE TABLE IF NOT EXISTS sorteo_res (sorteo TEXT PRIMARY KEY, ganador TEXT NOT NULL, semilla TEXT NOT NULL, ' +
        'n INTEGER NOT NULL, boletos INTEGER NOT NULL, rol INTEGER NOT NULL DEFAULT 0, t INTEGER NOT NULL)');
      // ⭐ LO QUE SUBE EL NIVEL ADEMÁS DE JUGAR (14/10/2026): cada cosa hecha, una vez cada una (`que` de `XP_FUENTES`,
      // `ref` qué fue). No se borra con el tiempo —los aplausos se van a los 30 días y la XP no tiene que bajar—: sólo
      // con «olvidarme». Ver `xpVio()` y `xpDe()`
      this.sql.exec('CREATE TABLE IF NOT EXISTS xp_log (quien TEXT NOT NULL, que TEXT NOT NULL, ref TEXT NOT NULL, ' +
        't INTEGER NOT NULL, PRIMARY KEY (quien, que, ref)) WITHOUT ROWID');
      // 🛡️ EL ANTI-RAID (18/10/2026): lo que eligió el dueño de cada servidor (`cfg`) y lo que la vuelta de cada minuto
      // recuerda (`est`: los miembros de los últimos minutos, hasta dónde leyó el registro de auditoría, los roles
      // peligrosos y qué ya avisó). Ver `antiraidVuelta()` y `bot/antiraid.js`
      this.sql.exec("CREATE TABLE IF NOT EXISTS antiraid (gid TEXT PRIMARY KEY, cfg TEXT NOT NULL, est TEXT NOT NULL DEFAULT '{}', " +
        't INTEGER NOT NULL)');
      // 📣 LAS PROMOS QUE ABRIÓ CADA UNO (16/10/2026): una vez por promo, para pagar `PROMO_PAGA` hasta `PROMO_TOPE_DIA`
      // por día (`dia`, en hora del este). Se borran a los `PROMO_DIAS` días (lo que pagó queda en la Tienda)
      // 🙋 LOS PEDIDOS DE LA GENTE (17/10/2026): `estado` '' espera, 'si'/'no' lo decidió `por`, 'hecho'/'no_pude' lo
      // aplicó el ciclo. `prueba`, en JSON: lo que vio el bot de la cuenta que pide. Se borran a los `PEDIDO_DIAS`
      this.sql.exec('CREATE TABLE IF NOT EXISTS pedidos (id INTEGER PRIMARY KEY AUTOINCREMENT, tipo TEXT NOT NULL, ' +
        "quien TEXT NOT NULL, k TEXT NOT NULL DEFAULT '', texto TEXT NOT NULL DEFAULT '', cc TEXT NOT NULL DEFAULT '', " +
        "vid TEXT NOT NULL DEFAULT '', prueba TEXT NOT NULL DEFAULT '', t INTEGER NOT NULL, estado TEXT NOT NULL DEFAULT '', " +
        "por TEXT NOT NULL DEFAULT '', resuelto INTEGER NOT NULL DEFAULT 0, nota TEXT NOT NULL DEFAULT '')");
      // 📣 LAS PROMOS ALARGADAS EN LA TIENDA (16/10/2026): hasta cuándo va cada una y quién pagó (lo pagado queda en
      // `tienda`). Se borran a los `PROMO_DIAS` días de vencidas
      this.sql.exec('CREATE TABLE IF NOT EXISTS promo_extra (pid TEXT PRIMARY KEY, quien TEXT NOT NULL, hasta INTEGER NOT NULL, ' +
        't INTEGER NOT NULL)');
      this.sql.exec('CREATE TABLE IF NOT EXISTS promo_visto (quien TEXT NOT NULL, pid TEXT NOT NULL, dia TEXT NOT NULL, ' +
        'pago INTEGER NOT NULL, t INTEGER NOT NULL, PRIMARY KEY (quien, pid)) WITHOUT ROWID');
      // 🧠 LOS DATOS DE CADA PERSONA PARA /card (`p:<clave>`), ACÁ DESDE EL 06/10/2026 Y NO EN KV. Eran casi todo
      // su cupo —unas 230 escrituras por corrida, porque los números del /versus se miden contra el pool y se mueven
      // con cada evento—, y KV da 1.000 por día: el 06/10 a las 7:57 PM iba en 909. Acá son filas, de 100.000 por día.
      // Las escribe el ciclo (`personasCiclo()`, desde `bot/subir_datos.py`) y las lee el Worker (`leerP()`)
      this.sql.exec('CREATE TABLE IF NOT EXISTS persona (k TEXT PRIMARY KEY, v TEXT NOT NULL, t INTEGER NOT NULL) WITHOUT ROWID');
      // 👥 LAS CREWS QUE ARMA LA GENTE (19/10/2026): sus tablas viven con su lógica, en bot/crews.js
      CW.crewTablas(this.sql);
      // 📏 LOS ÍNDICES QUE FALTABAN (05/10/2026), medidos con `medidas`: en una hora tranquila el objeto leía 61.000
      // filas, y el 57 % eran dos limpiezas que corren cada minuto —las inscripciones viejas y las marcas de «ya
      // avisado»— recorriendo la tabla entera para borrar casi nada. Con el índice, borrar lee sólo lo que borra.
      // Los otros son las consultas «de las últimas horas» que el vigía y la página hacen cada minuto
      for (const [nombre, tabla, col] of [['inscritos_pub', 'inscritos', 'pub'], ['hechos_t', 'hechos', 't'],
        ['avisos_creado', 'avisos', 'creado'], ['veredictos_pub', 'veredictos', 'pub'], ['posts_creado', 'posts', 'creado'],
        ['veredictos_hist_pub', 'veredictos_hist', 'pub'],
        ['bandeja_t', 'bandeja', 't'], ['vivo_ed', 'vivo', 'ed'], ['cancelados_t', 'cancelados', 't'],
        // 📏 y los de la revisión del 05/10/2026: los niveles del Pase de la temporada (`pases()`, `paseNiveles()`: cada
        // perfil los pedía recorriendo la tabla entera), la billetera de cada uno (`tienda` por `quien`) y el que más
        // leía después de los primeros índices, las inscripciones de un servidor desde una hora (`inscripciones()`)
        ['pase_hecho_temp', 'pase_hecho', 'temp, quien'], ['tienda_quien', 'tienda', 'quien'],
        ['pase_hito_temp', 'pase_hito', 'temp, nivel, t'],
        ['inscritos_sv_pub', 'inscritos', 'sv, pub'],
        // 📏 y los de la pasada del 19/10/2026: en 13 días el objeto leyó 1,46 millones de filas por día, y la que más
        // leía era el chat en vivo de un canal (234.000 por día recorriendo la tabla entera), después los votos y los
        // precios de cada uno (cuántos puso hoy): las tres, sin índice
        ['chat_vivo_canal', 'chat_vivo', 'canal, t'], ['votos_quien', 'votos', 'quien, t'], ['precios_quien', 'precios', 'quien, t'],
        // y las dos limpiezas por fecha que recorrían la tabla entera: lo visto de las historias y de las promos
        ['hvistas_t', 'hvistas', 't'], ['promo_visto_t', 'promo_visto', 't']]) {
        this.sql.exec(`CREATE INDEX IF NOT EXISTS ${nombre} ON ${tabla} (${col})`);
      }
    });
  }

  /** 📏 Suma `n` a `que` (`filas`, `kv` o `pedidos`) bajo `k`. Ver el constructor */
  medir(que, k, n) {
    const o = this.med[que];
    if (o && n) o[k] = (o[k] || 0) + n;
  }

  /**
   * 📏 Lo medido, a `estado` cada 10 minutos (una fila): se suma a lo guardado y se guardan los que más pesan. Con
   * `forzar`, ya. Lo llama el vigía al terminar cada vuelta.
   */
  medidasGuardar(ahora, forzar) {
    if (!forzar && this.medT && ahora - this.medT < 10 * MIN) return;
    this.medT = ahora;
    const g = this.medidasVer();
    this.med = { filas: {}, kv: {}, pedidos: {}, antiraid: {} };
    this.guardar('medidas', g);
  }

  /** 📏 Lo guardado más lo que todavía no se guardó: `{desde, t, filas, kv, pedidos, antiraid}`, cada uno de mayor a menor */
  medidasVer() {
    const ahora = Date.now();
    const g = this.leer('medidas') || {};
    const out = { desde: g.desde || ahora, t: ahora };
    for (const c of ['filas', 'kv', 'pedidos', 'antiraid']) {
      const suma = Object.assign({}, g[c] || {});
      for (const [k, n] of Object.entries(this.med[c] || {})) suma[k] = (suma[k] || 0) + n;
      out[c] = Object.fromEntries(Object.entries(suma).sort((a, b) => b[1] - a[1]).slice(0, c === 'filas' ? 80 : 60));
    }
    return out;
  }

  leer(k) {
    const r = this.sql.exec('SELECT v FROM estado WHERE k = ?', k).toArray()[0];
    if (!r) return null;
    try { return JSON.parse(r.v); } catch (e) { return null; }
  }

  guardar(k, v) {
    this.sql.exec('INSERT INTO estado (k, v) VALUES (?, ?) ' +
      'ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, JSON.stringify(v));
  }

  /**
   * 🏁 LO QUE EL LECTOR NO ENTENDIÓ DE UNA LLAVE (12/10/2026): el botón o el menú del organizador (`que === 'dud'` en
   * worker.js), una por pregunta: `<llave>:<n.º>`. Vale la primera respuesta; otra que llegue igual se contesta con lo
   * que ya estaba. Guarda las últimas 300; el ciclo las pasa a `datos/decisiones.json` y no las necesita más.
   */
  finalElegir(d) {
    const k = String(d.k || ''), nombre = String(d.nombre || '').slice(0, 100), quien = String(d.quien || '');
    const v = String(d.v || '');
    if (!/^\d{5,25}:\d{1,2}$/.test(k) || !/^[a-z]$/.test(v) || !nombre || !/^\d{5,25}$/.test(quien)) {
      return { error: 'datos' };
    }
    const f = this.leer('finales') || {};
    if (f[k]) return { ya: f[k].nombre, quien: f[k].quien };
    f[k] = { nombre, v, quien, t: Date.now() };
    const ks = Object.keys(f).sort((x, y) => f[x].t - f[y].t);
    for (const x of ks.slice(0, Math.max(0, ks.length - 300))) delete f[x];
    this.guardar('finales', f);
    return { ok: true };
  }

  // ── 🛡️ EL ANTI-RAID (18/10/2026) ─────────────────────────────────────────────────────────────────────────────────────
  // Lo elige el dueño de cada servidor con `/antiraid` (bot/antiraid.js); acá vive lo elegido y la vuelta de cada minuto.
  antiraidCfg(gid) {
    if (!/^\d{5,25}$/.test(String(gid || ''))) return { ...AR.AR_BASE };
    const f = this.sql.exec('SELECT cfg FROM antiraid WHERE gid = ?', String(gid)).toArray()[0];
    try { return { ...AR.AR_BASE, ...JSON.parse((f && f.cfg) || '{}') }; } catch (e) { return { ...AR.AR_BASE }; }
  }

  /** 🤝 Lo que Dlx prende desde acá, con la clave del ciclo (20/10/2026, DDF amenazado de raid): `{gid, ver}` sólo lo lee;
   *  `{gid, canal?}` prende la alarma de oleada, la vigilancia del staff y AUTOMÁTICO con `por: 'dlx'`. Sin un canal de
   *  avisos (el que tiene, o `canal`) no prende nada: AUTOMÁTICO actúa sobre avisos. */
  async antiraidDlx(d) {
    const gid = String((d && d.gid) || '');
    if (!/^\d{5,25}$/.test(gid)) return { error: 'datos' };
    const antes = this.antiraidCfg(gid);
    if (d.ver) return { cfg: antes };
    const canal = /^\d{5,25}$/.test(String(d.canal || '')) ? String(d.canal) : antes.canal;
    if (!canal) return { error: 'sin_canal', cfg: antes };
    if (canal !== antes.canal) {
      const r = await AR.mandar(this.env, canal, { content: '🛡️ Acá van a llegar los avisos del **anti-raid de la Liga Global**. ' +
        'Los botones de cada aviso los puede usar el dueño o un admin.' });
      if (!r.ok) return { error: 'canal', estado: r.status, cfg: antes };
    }
    return this.antiraidGuardar({ gid, cfg: { ...antes, canal, oleada: true, staff: true, auto: true, por: 'dlx' },
      solo: ['canal', 'oleada', 'staff', 'auto', 'por'] });
  }

  /** Guarda lo elegido, validado campo por campo: lo manda el Worker, pero el objeto no confía en nadie. */
  antiraidGuardar(d) {
    const gid = String((d && d.gid) || '');
    if (!/^\d{5,25}$/.test(gid) || !d.cfg || typeof d.cfg !== 'object') return { error: 'datos' };
    const c = d.cfg;
    const id = (x) => (/^\d{5,25}$/.test(String(x || '')) ? String(x) : '');
    const cerrado = c.cerrado && !Number.isNaN(Date.parse(c.cerrado.hasta || ''))
      ? { hasta: new Date(Date.parse(c.cerrado.hasta)).toISOString(), nivel: Math.max(0, Math.min(4, Number(c.cerrado.nivel) || 0)) } : null;
    const nuevo = {
      canal: id(c.canal), escudo: (Array.isArray(c.escudo) ? c.escudo : []).map(id).filter(Boolean).slice(0, 6),
      oleada: c.oleada === true, staff: c.staff === true, cerrado, auto: c.auto === true,
      // 🤝 quién prendió AUTOMÁTICO: 'dlx' o nadie en particular (el dueño). Ver `NOTA_DLX` en antiraid.js
      por: c.auto === true && c.por === 'dlx' ? 'dlx' : '',
    };
    // 🔴 CAMPO POR CAMPO (pasada del 19/10/2026): con `solo` se cambian ésos y el resto queda como está en la base (el panel
    // leía, cambiaba una cosa y guardaba todo: pisaba el cierre que AUTOMÁTICO hizo mientras tanto)
    const antes = this.antiraidCfg(gid);
    const solo = Array.isArray(d.solo) ? d.solo.filter((k) => ['canal', 'escudo', 'oleada', 'staff', 'cerrado', 'auto', 'por'].includes(k)) : null;
    const cfg = solo ? { ...antes, ...Object.fromEntries(solo.map((k) => [k, nuevo[k]])) } : nuevo;
    // 🕵️ la vigilancia que se vuelve a prender arranca de cero: `desde` le dice a la vuelta que el cursor del registro es de
    // antes (si no, leía lo que pasó mientras estaba apagada y avisaba —o actuaba— sobre eso)
    cfg.desde = cfg.staff && !antes.staff ? Date.now() : (Number(antes.desde) || 0);
    this.sql.exec("INSERT INTO antiraid (gid, cfg, est, t) VALUES (?, ?, '{}', ?) " +
      'ON CONFLICT(gid) DO UPDATE SET cfg = excluded.cfg, t = excluded.t', gid, JSON.stringify(cfg), Date.now());
    return { ok: true, cfg };
  }

  /**
   * La vuelta de cada minuto, servidor por servidor (uno roto no frena a los demás):
   *  · el cierre de pánico vencido se abre solo (Discord vuelve a abrir las invitaciones, pero la verificación no);
   *  · la OLEADA: cuántos miembros hay (`with_counts`) contra los de hace 2 a 4 minutos;
   *  · el STAFF: lo nuevo del registro de auditoría desde la última vuelta, más las expulsiones y borrados de los
   *    últimos minutos para contar «en masa» entre vueltas.
   * Cada aviso se manda una vez cada `REPETIR_MS` (por tipo, quién y a quién).
   */
  /** 🤖 Los roles que AUTOMÁTICO le sacó a alguien, para «Devolver los roles» (lo pide el Worker desde el botón). */
  antiraidDevolver(d) {
    const gid = String((d && d.gid) || ''), uid = String((d && d.uid) || '');
    if (!/^\d{5,25}$/.test(gid) || !/^\d{5,25}$/.test(uid)) return { error: 'datos' };
    const f = this.sql.exec('SELECT est FROM antiraid WHERE gid = ?', gid).toArray()[0];
    let est = {};
    try { est = JSON.parse((f && f.est) || '{}') || {}; } catch (e) { est = {}; }
    const x = (est.dev || {})[uid];
    return { roles: x && Array.isArray(x.roles) ? x.roles : null };
  }

  /** 🛡️ La vuelta de cada minuto, en su propio pedido (ver `vigilar()` de afuera), con su candado como el del vigía. */
  async antiraidRonda() {
    const ahora = Date.now();
    if (!this.env.DISCORD_TOKEN) return { ok: false };
    // con Discord diciendo 401 el vigía para una hora: el anti-raid también, que usa el mismo token
    const v = this.leer('vigia') || {};
    if (v.pausa && ahora < v.pausa) return { ok: false, pausa: true };
    if (this.arEn && ahora - this.arEn < 3 * MIN) { this.medir('antiraid', 'salteada', 1); return { ok: true, salteada: true }; }
    this.arEn = ahora;
    // (cuántas vueltas: sin esto, una ronda que dejó de llegar se ve igual que una sin nada que avisar)
    this.medir('antiraid', 'vueltas', 1);
    try {
      await this.antiraidVuelta(ahora);
      return { ok: true };
    } catch (e) {
      this.medir('antiraid', 'error', 1);
      return { ok: false };
    } finally {
      this.arEn = 0;
    }
  }

  async antiraidVuelta(ahora) {
    // 📏 hasta `TOPE_PEDIDOS` pedidos a Discord por vuelta: si corta, la próxima arranca por el servidor que quedó, así
    // ninguno se queda siempre atrás. Cada fila se lee recién antes de mirarla (la de arriba puede tardar)
    const gids = this.sql.exec('SELECT gid FROM antiraid ORDER BY gid').toArray().map((f) => String(f.gid));
    const i0 = Math.max(0, gids.indexOf(this.arSigue || ''));
    const n0 = AR.gasto.n;
    this.arSigue = '';
    for (const gid of [...gids.slice(i0), ...gids.slice(0, i0)]) {
      if (AR.gasto.n - n0 >= AR.TOPE_PEDIDOS) { this.arSigue = gid; this.medir('antiraid', 'tope', 1); break; }
      const f = this.sql.exec('SELECT gid, cfg, est FROM antiraid WHERE gid = ?', gid).toArray()[0];
      if (!f) continue;
      try { await this.antiraidUno(f, ahora); } catch (e) { this.medir('antiraid', 'error', 1); }
    }
  }

  async antiraidUno(f, ahora) {
    const env = this.env;
    const gid = String(f.gid);
    let cfg, est;
    try { cfg = { ...AR.AR_BASE, ...JSON.parse(f.cfg || '{}') }; } catch (e) { cfg = { ...AR.AR_BASE }; }
    try { est = JSON.parse(f.est || '{}') || {}; } catch (e) { est = {}; }
    if (!cfg.oleada && !cfg.staff && !cfg.cerrado) return;
    // 🚪 el bot ya no está en ese servidor (Discord dijo 404): una hora sin preguntar, en vez de 1.440 pedidos rechazados
    // por día (pasada del 19/10/2026)
    if (est.fuera && ahora < est.fuera) return;
    const afuera = () => est.fuera && ahora < est.fuera;
    const avisos = [];
    let usuarios = {};
    let cambioCfg = false;
    // ⏲️ el pánico vencido
    if (cfg.cerrado && Date.parse(cfg.cerrado.hasta || '') <= ahora && (!est.reab || ahora - est.reab >= 10 * MIN)) {
      const a = await AR.abrir(env, gid, cfg.cerrado.nivel);
      if (a.ok) {
        cfg.cerrado = null;
        cambioCfg = true;
        delete est.reab;
        if (cfg.canal) {
          await AR.mandar(env, cfg.canal, { content: '🛡️ Pasó el tiempo del cierre: el servidor volvió a abrirse (invitaciones, ' +
            'mensajes directos y verificación como estaban).' });
        }
      } else {
        // 🔴 SÓLO SI ABRIÓ (pasada del 19/10/2026): sin permiso, la verificación quedaba al máximo para siempre y la
        // configuración se olvidaba del nivel de antes. Se reintenta cada 10 minutos y se avisa una vez
        if (!est.reab && cfg.canal) {
          await AR.mandar(env, cfg.canal, { content: '⚠️ Pasó el tiempo del cierre y **no pude abrir el servidor**: el bot ' +
            'necesita **Gestionar servidor**. Lo sigo intentando cada 10 minutos (o ábranlo con `/antiraid`).' });
        }
        est.reab = ahora;
      }
    }
    // 🌊 la oleada
    if (cfg.oleada && cfg.canal) {
      const r = await AR.pedir(env, `/guilds/${gid}?with_counts=true`);
      if (r.status === 404) est.fuera = ahora + 60 * MIN;
      else if (r.ok) {
        const g = await r.json();
        const n = Number(g.approximate_member_count) || 0;
        if (n) est.m = [...(est.m || []).filter(([t]) => ahora - t <= 6 * 60 * 1000), [ahora, n]];
        const o = AR.oleada(est.m, ahora);
        if (o) avisos.push({ tipo: 'oleada', ...o });
      }
    }
    // 🕵️ el staff
    if (cfg.staff && cfg.canal && !afuera()) {
      if (!est.roles || ahora - (est.roles.t || 0) > 10 * 60 * 1000) {
        const r = await AR.pedir(env, `/guilds/${gid}/roles`);
        if (r.ok) {
          const roles = (await r.json()) || [];
          est.roles = { t: ahora, ids: roles.filter((x) => AR.tieneP(x.permissions, AR.PELIGROSOS)).map((x) => String(x.id)) };
        }
      }
      // la primera vuelta marca desde dónde: lo de antes de prenderlo no se avisa. 🔴 Y la primera DESPUÉS DE VOLVER A
      // PRENDERLA también (pasada del 19/10/2026): el cursor viejo traía lo que pasó mientras estaba apagada
      if (!est.ult || (Number(cfg.desde) || 0) !== (Number(est.desde) || 0)) {
        est.ult = AR.snowflakeDe(ahora);
        est.w = [];
        est.desde = Number(cfg.desde) || 0;
        delete est.aud;
      } else if (!est.aud || ahora >= (est.aud.hasta || 0)) {
        const r = await AR.pedir(env, `/guilds/${gid}/audit-logs?limit=100&after=${est.ult}`);
        if (r.ok) {
          delete est.aud;
          const j = await r.json();
          const nuevas = (j.audit_log_entries || []).filter((e) => e && e.id)
            .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
          for (const u of j.users || []) usuarios[String(u.id)] = { bot: !!u.bot, username: u.username || '', global_name: u.global_name || '' };
          const ventana = (est.w || []).filter((e) => ahora - AR.instante(e.id) <= AR.VENTANA_MS);
          const yo = this.yo || ((this.leer('canales') || {}).yo) || '';
          // 🔴 LO VIEJO (pasada del 19/10/2026): lo de hace más de dos ventanas llegó tarde —el registro estuvo cerrado un
          // rato—. Lo que sigue en pie (un rol, un permiso, un bot) se avisa igual pero sin AUTOMÁTICO; lo que se cuenta en
          // la ventana (expulsiones, borrados) ya no es «en masa»
          const viejas = nuevas.filter((e) => ahora - AR.instante(e.id) > 2 * AR.VENTANA_MS);
          const frescas = nuevas.filter((e) => ahora - AR.instante(e.id) <= 2 * AR.VENTANA_MS);
          const pel = new Set((est.roles || {}).ids || []);
          for (const r2 of AR.riesgos([...ventana, ...frescas], usuarios, pel, yo)) avisos.push(r2);
          for (const r2 of AR.riesgos(viejas, usuarios, pel, yo)) if (['rol', 'permiso', 'bot'].includes(r2.tipo)) avisos.push({ ...r2, viejo: true });
          // un rol creado o cambiado: la lista de los peligrosos se vuelve a pedir en la vuelta siguiente
          if (est.roles && nuevas.some((e) => e.action_type === 30 || e.action_type === 31)) est.roles.t = 0;
          est.w = [...ventana, ...frescas.filter((e) => [20, 22, 12, 32].includes(e.action_type))
            .map((e) => ({ id: e.id, user_id: e.user_id, action_type: e.action_type }))].slice(-300);
          if (nuevas.length) est.ult = nuevas[nuevas.length - 1].id;
          // los nombres de quien se nombra, para el próximo aviso que lo cuente entre vueltas
          est.u = { ...(est.u || {}), ...usuarios };
          const vivos = new Set(est.w.map((e) => String(e.user_id)));
          for (const k of Object.keys(est.u)) if (!vivos.has(k) && !usuarios[k]) delete est.u[k];
          usuarios = est.u;
        } else if (r.status === 404) est.fuera = ahora + 60 * MIN;
        else if (r.status === 403) {
          // 🔴 SIN EL REGISTRO, LA VIGILANCIA ESTÁ CIEGA (pasada del 19/10/2026): antes se anotaba en silencio y se volvía
          // a pedir cada minuto. Se avisa una vez por día y se reintenta cada 10 minutos
          const avisado = (est.aud && est.aud.avisado) || 0;
          if (ahora - avisado >= DIA_MS) {
            await AR.mandar(env, cfg.canal, { content: '⚠️ **La vigilancia del staff está ciega**: el bot perdió el permiso **Ver el ' +
              'registro de auditoría**. Hasta que se lo devuelvan no ve expulsiones, baneos ni roles peligrosos.' });
          }
          est.aud = { hasta: ahora + 10 * MIN, avisado: ahora - avisado >= DIA_MS ? ahora : avisado };
        }
      }
    }
    // 🤖 AUTOMÁTICO: los avisos que nadie respondió en `ESPERA_AUTO_MS`. «Respondió» = el aviso ya no tiene todos sus
    // botones (cada botón usado se va, y «Ya lo vimos» los saca todos).
    // 🔴 BORRADO NO ES RESPONDIDO (pasada del 19/10/2026): antes un 404 lo daba por contestado, así que borrar el aviso
    // —cualquiera con permiso de borrar mensajes, también quien está haciendo el raid— apagaba AUTOMÁTICO. Lo mismo un
    // aviso que no se pudo mandar (`sin:`): nadie lo pudo responder. Lo que hace va entonces en un mensaje nuevo
    est.dev = Object.fromEntries(Object.entries(est.dev || {}).filter(([, x]) => x && ahora - (x.t || 0) < AR.DEVOLVER_MS));
    let hechas = 0;
    for (const [mid, p] of Object.entries(est.pend || {})) {
      if (!cfg.auto || !cfg.canal || ahora - p.t > AR.AUTO_TOPE_MS) { delete est.pend[mid]; continue; }
      if (ahora - p.t < AR.ESPERA_AUTO_MS || hechas >= 3) continue;
      let m = null;
      if (!mid.startsWith('sin:')) {
        const rm = await AR.pedir(env, `/channels/${cfg.canal}/messages/${mid}`);
        if (rm.ok) m = await rm.json().catch(() => null);
        else if (rm.status !== 404) continue;
      }
      if (m && AR.botonesDe(m) < p.nb) { delete est.pend[mid]; continue; }
      delete est.pend[mid];
      hechas++;
      const x = await AR.actuar(env, gid, p.a);
      if (x.reintentar) { est.pend[mid] = p; continue; }
      // 🤝 si lo prendió Dlx, lo que hizo lo dice (sólo cuando actúa: Dlx, 20/10/2026)
      if (cfg.por === 'dlx' && x.linea) x.linea += '\n' + AR.NOTA_DLX;
      if (x.cerrado) {
        cfg.cerrado = { hasta: x.cerrado.hasta, nivel: (cfg.cerrado && cfg.cerrado.nivel) ?? x.cerrado.nivel };
        cambioCfg = true;
      }
      // 🔴 LOS ROLES GUARDADOS SE SUMAN (pasada del 19/10/2026): una segunda acción sobre la misma persona la encontraba
      // ya sin roles y guardaba «ninguno» encima de los que tenía
      if (x.dev) {
        const roles = [...new Set([...((est.dev[x.dev.uid] || {}).roles || []), ...x.dev.roles])];
        if (roles.length) est.dev[x.dev.uid] = { roles, t: ahora };
      }
      if (m) await AR.pedir(env, `/channels/${cfg.canal}/messages/${mid}`, { method: 'PATCH', body: JSON.stringify(AR.tras(m, p.a, x)) });
      else await AR.mandar(env, cfg.canal, AR.sinAviso(x));
      this.medir('antiraid', x.ok ? 'auto' : 'auto-no', 1);
    }
    // 📣 los avisos, una vez cada uno y hasta 6 por vuelta (cada uno es un pedido): lo que sobra espera al minuto siguiente
    est.av = Object.fromEntries(Object.entries(est.av || {}).filter(([, t]) => ahora - t < AR.REPETIR_MS));
    const cola = [...(est.cola || []), ...avisos];
    est.cola = [];
    let mandados = 0;
    for (const a of cola) {
      const k = AR.claveAviso(a);
      if (est.av[k]) continue;
      if (mandados >= 6) { if (est.cola.length < 30) est.cola.push(a); continue; }
      mandados++;
      const cuerpo = AR.aviso(gid, a, usuarios, cfg.auto);
      const r = await AR.mandar(env, cfg.canal, cuerpo);
      est.av[k] = ahora;
      this.medir('antiraid', a.tipo, 1);
      if (!r.ok) est.error = 'canal';
      // 🤖 con AUTOMÁTICO, queda esperando a ver si alguien lo responde. Una vez por persona y acción: dos avisos de la
      // misma cuenta no le sacan los roles dos veces
      const acc = cfg.auto ? AR.accionAuto(a, usuarios) : null;
      if (acc && !Object.values(est.pend || {}).some((q) => q.a && q.a.que === acc.que && (q.a.uid || '') === (acc.uid || ''))) {
        const j = r.ok ? await r.json().catch(() => ({})) : {};
        const mid = j && j.id ? String(j.id) : 'sin:' + ahora + ':' + k;
        est.pend = { ...(est.pend || {}), [mid]: { t: ahora, a: acc, nb: j && j.id ? AR.botonesDe(cuerpo) : 0 } };
      }
    }
    if (!est.cola.length) delete est.cola;
    // 🔴 LA CONFIGURACIÓN, RECIÉN LEÍDA (pasada del 19/10/2026): mientras esta vuelta esperaba a Discord el dueño pudo
    // cambiar algo en el panel, y escribir la `cfg` leída al principio lo deshacía. Sólo se toca el cierre
    if (cambioCfg) {
      const ya = this.antiraidCfg(gid);
      ya.cerrado = cfg.cerrado;
      this.sql.exec('UPDATE antiraid SET est = ?, cfg = ? WHERE gid = ?', JSON.stringify(est), JSON.stringify(ya), gid);
    } else this.sql.exec('UPDATE antiraid SET est = ? WHERE gid = ?', JSON.stringify(est), gid);
  }


  async fetch(req) {
    const ruta = new URL(req.url).pathname;
    this.medir('pedidos', ruta, 1);
    try {
      if (ruta === '/vigilar') return json(await this.vigilar(await req.json()));
      if (ruta === '/estado') return json(this.estado(), 200, 20);
      if (ruta === '/ajustes') return json(this.ajustes());
      if (ruta === '/ajuste') {
        const d = await req.json().catch(() => null);
        if (!d) return json({ error: 'no es JSON' }, 400);
        return json(this.ajuste(d));
      }
      if (ruta === '/vivo') {
        // el título de las borradas sale del lector de la página (ver `vivo()`)
        if (!globalThis.LlaveVivo) { try { await import('./llave_vivo.js'); } catch (e) { /* sin título */ } }
        // 📣 y el aviso de la página (el Dashboard): con lo en vivo, que la página ya pide, así no suma pedidos
        const r = this.vivo();
        const a = this.avisoWeb();
        if (a) r.aviso = a;
        return json(r, 200, 20);
      }
      if (ruta === '/encuestas') return json(this.encuestas(), 200, 20);
      if (ruta === '/ligas-votos') return json(this.ligasVotos(), 200, 20);
      if (ruta === '/precios') return json(this.precios(), 200, 20);
      if (ruta === '/seguidores') return json(this.seguidores(), 200, 60);
      if (ruta === '/servidores') return json(this.servidoresElegidos(), 200, 60);
      // 👥 todas las crews, sin ningún Discord ID: la página y el ciclo (`bot/crews_vivas.py`)
      if (ruta === '/crews') { const r = CW.crewsPublico(this); await this.vaciarBasuraCrews(); return json(r, 200, 60); }
      if (ruta === '/aplausos') return json(this.aplausosCuenta(), 200, 20);
      // 🗳️ cuántas veces el público votó a cada uno como ganador, en la temporada (el ciclo: `bot/hechos_vivo.py`)
      if (ruta === '/favoritos') return json(this.favoritos(), 200, 300);
      if (ruta === '/promos-extra') return json(this.promosExtra(), 200, 60);
      if (ruta === '/promos-vistas') return json(this.promosVistas(), 200, 60);
      if (ruta === '/niveles') return json(this.niveles(), 200, 300);
      if (ruta === '/pases') return json(this.pases(), 200, 300);
      if (ruta === '/roles') return json(this.roles(), 200, 300);
      if (ruta === '/fondos') return json(this.fondos(), 200, 300);
      if (ruta === '/pase-niveles') return json(this.paseNiveles());
      if (ruta === '/chat-canales') return json(await this.canalesChat());
      if (ruta === '/cierre-vivo') {
        const d = await req.json().catch(() => null);
        return d ? json(this.cierreVivo(d)) : json({ error: 'no es JSON' }, 400);
      }
      // 🧠 una persona, para el Worker (`leerP()`): el valor tal cual, o 404. No está en `RUTAS_AVISOS`: de afuera no
      // se llega, sólo por el binding
      if (ruta === '/persona') {
        const v = this.persona(new URL(req.url).searchParams.get('k') || '');
        return v === null ? new Response('', { status: 404 }) : new Response(v, { headers: { 'content-type': 'application/json' } });
      }
      // 🧠 varias, para el ciclo y sus auditorías (`bot/verificar.py`), con la clave del ciclo: `{k: v}`
      if (ruta === '/personas-leer') return json(this.personasLeer(new URL(req.url).searchParams.getAll('k')));
      if (ruta === '/inscritos') return json(this.inscritosLista(), 200, 0);
      // 🏁 quién ganó cada final que el ciclo preguntó (`bot/finales.py`), con la clave del ciclo
      if (ruta === '/finales') return json(this.leer('finales') || {}, 200, 0);
      if (ruta === '/vs-cola') return json(this.vsCola(new URL(req.url).searchParams.get('sv') || ''), 200, 0);
      // 🎬 los pedidos de videos, para el ciclo (`bot/videos_propios.py`), con su clave
      if (ruta === '/videos-ciclo') return json(this.videosCiclo(), 200, 0);
      if (ruta === '/decidir-ciclo') return json(this.decidirCiclo(), 200, 0);
      // 📅 lo agendado con /agendar, para el ciclo (`bot/agenda.py`), con su clave
      if (ruta === '/agenda-ciclo') return json(this.agendaCiclo(), 200, 0);
      if (ruta === '/hinchas') return json(this.hinchas(), 200, 0);
      if (ruta === '/pedidos-ciclo') return json(this.pedidosCiclo(), 200, 0);
      // 🧪 para el ciclo (`bot/primerizos.py`): a quién se avisó y quién quedó sin aviso (es un GET: va antes del cuerpo)
      if (ruta === '/vuelve-ciclo') return json(this.vuelveCiclo(), 200, 0);
      const d = await req.json().catch(() => null);
      if (!d) return json({ error: 'no es JSON' }, 400);
      if (ruta === '/final') return json(this.finalElegir(d));
      // 🧰 /afiche y /llave: el permiso para contestar, del Worker; y la imagen, de la tarea (ver `kitGuardar()`)
      if (ruta === '/kit') return json(this.kitGuardar(d));
      if (ruta === '/kit-listo') return json(await this.kitListo(d));
      if (ruta === '/vs-listo') return json(await this.vsListo(d));
      if (ruta === '/mis-videos') return this.misVideos(d);
      if (ruta === '/seguir-org') return json(this.seguirOrg(d));
      // 📅 /agendar: sólo el Worker llega acá (no está en `RUTAS_AVISOS`), ya con el staff comprobado
      if (ruta === '/agendar') return json(this.agendar(d));
      if (ruta === '/video-reportar') return this.videoReportar(d);
      if (ruta === '/videos-estados') return json(this.videosEstados(d));
      if (ruta === '/dueno-video') return json(this.duenoVideo(d));
      if (ruta === '/dueno-reporte') return json(await this.duenoReporte(d));
      if (ruta === '/dueno-viendo') return json(this.duenoViendo(d));
      if (ruta === '/dueno-vuelve') return json(this.avisoVuelve(d));
      if (ruta === '/dueno-ficha') return json(this.duenoFicha(d));
      if (ruta === '/dueno-nota') return json(this.duenoNota(d));
      // 🔁 la lista de primerizos y enfriados: sólo la guarda, tal cual, para el Dashboard (nunca sale a la página)
      if (ruta === '/primerizos-ciclo') {
        if (!d || !Array.isArray(d.una) || !Array.isArray(d.frio) || d.una.length > 600 || d.frio.length > 300) return json({ error: 'datos' }, 400);
        // 🧪 los del grupo sin aviso se anotan la primera vez que aparecen (desde ahí se mide si volvieron solos), y la
        // lista lleva cuáles son: la página no les ofrece «Avisarle»
        const ahora = Date.now();
        const ctl = [...d.una, ...d.frio].map((f) => String(f[f.length - 1] || '')).filter((k) => k && enControlVuelve(k));
        for (const k of ctl) this.sql.exec('INSERT OR IGNORE INTO vuelve_control (k, t) VALUES (?, ?)', k, ahora);
        this.sql.exec('DELETE FROM vuelve_control WHERE t < ?', ahora - 90 * DIA_MS);
        this.guardar('primerizos', Object.assign({}, d, { control: ctl }));
        return json({ ok: true });
      }
      if (ruta === '/decidir-estados') return json(this.decidirEstados(d));
      if (ruta === '/roles-estados') return json(this.rolesEstados(d));
      if (ruta === '/rol-de') return json({ roles: this.rolesPanelDe(String(d.quien || '')) });
      if (ruta === '/fondo') return json(await this.fondo(d));
      if (ruta === '/mi-fondo') return json(this.fondoDe(String(d.quien || '')));
      if (ruta === '/dueno-fondo') return json(await this.duenoFondo(d));
      if (ruta === '/foto-carta') return json(await this.fotoCarta(d));
      if (ruta === '/mi-foto-carta') return json(this.fotoCartaDe(String(d.quien || '')));
      if (ruta === '/dueno-foto-carta') return json(await this.duenoFotoCarta(d));
      if (ruta === '/dueno-rol') return json(this.duenoRol(d));
      if (ruta === '/dueno-decidir') return json(this.duenoDecidir(d));
      if (ruta === '/reportes-estados') return json(await this.reportesEstados(d));
      if (ruta === '/alta') return await this.alta(d);
      if (ruta === '/baja') return this.baja(d);
      if (ruta === '/probar') return this.probar(d);
      if (ruta === '/simular') return this.simular();
      if (ruta === '/vincular') return this.vincular(d);
      if (ruta === '/desvincular') return this.desvincular(d);
      if (ruta === '/olvidar') return await this.olvidar(d);
      if (ruta === '/reportar') return await this.reportar(d);
      if (ruta === '/votar') return this.votar(d);
      if (ruta === '/liga-votar') return json(this.ligaVotar(d));
      if (ruta === '/liga-seguir') return json(this.ligaSeguir(d));
      if (ruta === '/mis-ligas') return json(this.misLigas(d));
      if (ruta === '/seguir') return this.seguir(d);
      if (ruta === '/historias') return this.historiasVistas(d);
      if (ruta === '/sigo') return this.sigo(d);
      if (ruta === '/aplaudir') return this.aplaudir(d);
      if (ruta === '/promo-vio') return this.promoVio(d);
      if (ruta === '/promo-extender') return this.promoExtender(d);
      if (ruta === '/pedir') return this.pedir(d);
      if (ruta === '/mis-pedidos') return json(this.misPedidos(d));
      if (ruta === '/dueno-pedido') return json(this.duenoPedido(d));
      if (ruta === '/pedidos-estados') return json(this.pedidosEstados(d));
      if (ruta === '/mudar-cuenta') return json(await this.mudarCuenta(d));
      if (ruta === '/pedidos-prueba') return json(this.pedidosPrueba(d));
      // 🛡️ el anti-raid: lo lee y lo guarda el Worker (`/antiraid` y sus botones). No están en `RUTAS`: no se llega de afuera
      if (ruta === '/antiraid-leer') return json({ cfg: this.antiraidCfg(d && d.gid) });
      if (ruta === '/antiraid-guardar') return json(this.antiraidGuardar(d));
      if (ruta === '/antiraid-dlx') return json(await this.antiraidDlx(d));
      if (ruta === '/antiraid-devolver') return json(this.antiraidDevolver(d));
      if (ruta === '/antiraid-vuelta') return json(await this.antiraidRonda());
      // 🤝 el puntaje de los servidores: sólo lo guarda, tal cual, para el Dashboard (nunca sale a la página)
      if (ruta === '/tiers-ciclo') {
        if (!d || !Array.isArray(d.servidores) || d.servidores.length > 60) return json({ error: 'datos' }, 400);
        this.guardar('tiers', { t: String(d.t || ''), semanas: Number(d.semanas) || 4, servidores: d.servidores });
        return json({ ok: true });
      }
      if (ruta === '/bandeja') return this.bandeja(d);
      // 👥 las crews: quién actúa y de qué perfil lo dice el Worker (`/avisos/crew`, el bot), nunca la página
      if (ruta === '/crew') { const r = await this.crewConImagen(d); await this.vaciarBasuraCrews(); return json(r, r.estado || 200); }
      if (ruta === '/crew-mia') return json(CW.crewMia(this, d));
      if (ruta === '/crew-dueno') {
        const r = CW.crewDueno(this, d);
        if (r.viejos) await this.borrarLogosCrew(r.viejos);
        delete r.viejos;
        await this.vaciarBasuraCrews();
        return json(r, r.estado || 200);
      }
      if (ruta === '/crews-sembrar') { const r = CW.sembrar(this, d); return json(r, r.estado || 200); }
      if (ruta === '/crews-tiers') { const r = CW.crewTiersAvisar(this, d); return json(r, r.estado || 200); }
      if (ruta === '/crews-verificar') {
        const ahora = Date.now();
        const r = CW.crewVerificar(this, d, ahora);
        // a quién mencionar no vuelve al ciclo: son Discord IDs, y su log es público
        if (r.ok) r.anunciados = r.anunciar.length ? await this.anunciarSinVerificar(r.anunciar, ahora) : {};
        delete r.anunciar;
        await this.vaciarBasuraCrews();
        return json(r, r.estado || 200);
      }
      if (ruta === '/mi-servidor') return this.miServidor(d);
      if (ruta === '/mi-foto') return await this.miFoto(d);
      if (ruta.startsWith('/sesion/')) return await this.sesion(ruta, d);
      if (ruta === '/uso') return this.usoAnotar(d);
      if (ruta === '/semanal') {
        if (!/^[0-9]{5,25}$/.test(String(d.quien || ''))) return json({ error: 'falta quién' }, 400);
        return json(this.semanal(String(d.quien), d.cobrar === true));
      }
      // ⭐ algo que sube el nivel y pasó afuera del objeto (Mis redes, que vive en KV). Sólo lo llama el Worker
      if (ruta === '/xp-vio') {
        if (d.que !== 'redes') return json({ error: 'qué' }, 400);
        return json({ ok: true, nuevo: this.xpVio(String(d.quien || ''), 'redes', '1') });
      }
      if (ruta === '/racha') {
        if (!/^[0-9]{5,25}$/.test(String(d.quien || ''))) return json({ error: 'falta quién' }, 400);
        const q = String(d.quien);
        // 🔥 cobrar el de hoy, o 🌱 el paso de la bienvenida (13/10/2026)
        if (d.cobrar === 'bienvenida') {
          const b = await this.cobrarBienvenida(q);
          return json(Object.assign(this.rachaDe(q), { bienvenida: b && !b.error ? b : (b && b.error === 'no' ? null : b), cobrado: b && b.cobrado, error: b && b.error }));
        }
        const r = d.cobrar === 'dia' ? this.cobrarDia(q) : this.rachaDe(q);
        return json(Object.assign(r, { bienvenida: await this.bienvenidaDe(q) }));
      }
      // 🔗 lo del Pase para los roles vinculados (worker.js, `cuentaRol()`): sólo el nivel
      if (ruta === '/rol-datos') return json(this.rolDatos(d));
      if (ruta === '/pase') {
        if (!/^[0-9]{5,25}$/.test(String(d.quien || ''))) return json({ error: 'falta quién' }, 400);
        return json(this.paseDe(String(d.quien)));
      }
      if (ruta === '/pase-vivo') return json(this.paseVivo(d));
      if (ruta === '/pase-avisos') { const v = this.paseAvisoPoner(d); return json(v, v.error ? 400 : 200); }
      if (ruta === '/pase-color') { const v = this.paseColorPoner(d); return json(v, v.error ? 400 : 200); }
      if (ruta === '/sorteo') return json(this.sorteoDe(/^[0-9]{5,25}$/.test(String(d.quien || '')) ? String(d.quien) : ''));
      if (ruta === '/sorteo-entrar') { const v = this.sorteoEntrar(d); return json(v, v.error ? 400 : 200); }
      if (ruta === '/marcos') return json(this.marcosDe(String(d.quien || '')));
      if (ruta === '/marco-elige') { const v = this.marcoElige(d); return json(v, v.error ? 400 : 200); }
      if (ruta === '/tags-mios') return json(this.tagsMios(String(d.quien || '')));
      if (ruta === '/tag-elige') { const v = this.tagElige(d); return json(v, v.error ? 400 : 200); }
      if (ruta === '/tags-ciclo') { const v = this.tagsCiclo(d); return json(v, v.error ? 400 : 200); }
      // 🧠 lo que manda el ciclo: las personas de esta corrida (`bot/subir_datos.py`)
      if (ruta === '/personas-ciclo') {
        const v = this.personasCiclo(d);
        return json(v, v.error ? 400 : 200);
      }
      // ⚠️ lo que no se pudo tomar es un 400, no un 200 con `error`: el ciclo decía «✅ igual que antes» sobre un Pase
      // rechazado (revisión del 05/10/2026)
      if (ruta === '/pase-ciclo') {
        const v = this.paseCiclo(d);
        return json(v, v.error ? 400 : 200);
      }
      // 📏 las lecturas de KV que contó el Worker (`kvMedido()` en worker.js): sólo el Worker llega acá, no está en RUTAS
      if (ruta === '/medir') {
        for (const [k, n] of Object.entries((d && d.kv) || {})) {
          if (Number.isInteger(n) && n > 0) this.medir('kv', 'w ' + String(k).slice(0, 70), n);
        }
        return json({ ok: true });
      }
      if (ruta === '/visita') return this.visita();
      // 🔴 CON `d`, NO CON OTRO `req.json()` (12/10/2026): el cuerpo ya se leyó arriba, así que leerlo de nuevo daba
      // null y el tutorial contestó «faltan datos» a todo desde que salió (2.78). Las pruebas llamaban a `tutorial()`
      // directo y no pasaban por acá; ahora `avisos_prueba.mjs` entra por `fetch()`, como la página
      if (ruta === '/tutorial') return this.tutorial(d);
      if (ruta === '/seccion') return this.seccion(d);
      if (ruta === '/panel-socio') return this.panelSocio(d);
      if (ruta === '/socio-ajustes') return this.socioAjustes(d);
      if (ruta === '/clics') return this.clics(d);
      if (ruta === '/error-pagina') return this.errorPagina(d);
      if (ruta === '/dueno') {
        const p = this.panelDueno(d);
        // 🔐 Asistente y Moderador: sólo lo suyo, sin lo que cuesta (lo en vivo, GitHub, KV)
        if (p.limitado) return json(p);
        // 🎤 y en qué servidores lo prendió su admin (`cfg:<guild>` en KV, `/settings`): una lectura por servidor
        for (const g of p.chat.generales) {
          try {
            const c = JSON.parse((await this.env.KV.get('cfg:' + g.g, { cacheTtl: 60 })) || '{}') || {};
            if (c.vivo) p.chat.admin[g.sv] = String(c.vivo);
            if (NIVELES_CHAT[c.vivo_nivel]) p.chat.nivel[g.sv] = c.vivo_nivel;
          } catch (e) { /* sin KV, como si no */ }
        }
        // 🔴 lo que está en vivo y ▶️ las últimas corridas del ciclo: ver `vivoDueno()` y `corridasCiclo()`
        [p.vivo, p.corridas, p.github] = await Promise.all([this.vivoDueno(Date.now()).catch(() => []),
          this.corridasCiclo(), this.githubActions()]);
        return json(p);
      }
      if (ruta === '/ciclo-mano') return json(await this.cicloAMano(Date.now()));
      if (ruta === '/precio') return this.precio(d);
      // 🎲 una apuesta, desde el botón del chat (`worker.js`, firmado por Discord): ver `apostar()`
      if (ruta === '/apostar') return this.apostar(d);
      // 🗳️ un voto de «¿Quién gana?», desde el botón del chat: ver `qgVotar()`
      if (ruta === '/qg-votar') return json(this.qgVotar(d));
      if (ruta === '/billetera') {
        await this.resolverPrecios(Date.now());
        return this.billetera(d);
      }
      if (ruta === '/disparo') {
        if (d.cual !== 'arranco' && d.cual !== 'ultimo') return json({ error: 'no existe' }, 404);
        this.guardar('disparo_' + d.cual, d.v || {});
        return json({ ok: true });
      }
      return json({ error: 'no existe' }, 404);
    } catch (e) {
      this.guardar('ultimo_error', { t: Date.now(), ruta, error: String(e).slice(0, 200) });
      return json({ error: 'falló adentro' }, 500);
    }
  }

  // ── los canales ──────────────────────────────────────────────────────
  //
  // ⚠️ SE BUSCAN POR NOMBRE, COMO EN `anuncios.canales()`, y no se piden.
  // Una lista de IDs escrita a mano envejece sola: el día que un servidor
  // renombra o mueve su canal, el lector deja de leer y no falla.
  async descubrir(servidores, ahora) {
    const lista = [];
    const ver = [];
    const insc = [];
    const generales = [];
    let sinAcceso = 0;
    // 🔴 SÓLO LOS SERVIDORES DE LA LIGA. Dlx, 25/09/2026, después de una
    // alerta por un canal de TFC: «Olvida TFC, ya te dije que no está». La
    // lista es `confirmado` de `datos/servidores.json`, que viaja en `meta`
    // (`liga`); sin ella —una `meta` vieja— se escucha lo de siempre.
    // 🔑 Y LAS CATEGORÍAS QUE CADA SERVIDOR DECLARA AFUERA (`meta.fuera`): las
    // ligas regionales de FFS, que son jornadas de liga y no eventos (Dlx,
    // 28/09/2026: «más adelante, al ranking de ligas»).
    let fueraSv = {}, firma = '';
    try {
      const meta = JSON.parse((await this.env.KV.get('meta')) || '{}');
      firma = firmaLiga(meta);
      const liga = meta.liga || null;
      if (Array.isArray(liga) && liga.length) {
        servidores = (servidores || []).filter((s) => liga.indexOf(s.sv) >= 0);
      }
      fueraSv = (meta.fuera && typeof meta.fuera === 'object') ? meta.fuera : {};
    } catch (e) { /* sin meta, la lista entera */ }
    // 🔴 QUIÉN SOY, PARA NO LEERME. El bot publica en `eventos-hoy`, que es
    // también un canal que este vigía escucha: sin esto, su propia
    // re-publicación podría volver a entrar como anuncio nuevo.
    let yo = '';
    try {
      const r = await fetch(`${DC}/users/@me`, {
        headers: { Authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'User-Agent': UA },
      });
      if (r.status === 200) yo = (await r.json()).id || '';
    } catch (e) { yo = ''; }
    for (const s of servidores || []) {
      if (!s.guild) continue;
      const r = await fetch(`${DC}/guilds/${s.guild}/channels`, {
        headers: { Authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'User-Agent': UA },
      });
      if (r.status !== 200) { sinAcceso++; continue; }
      const cs = await r.json();
      // 🔴 NI LOS DE UNA CATEGORÍA DE STAFF (28/09/2026): FFS LEAGUE tiene
      // «𝔸ℕ𝕌ℕℂ𝕀𝕆𝕊» adentro de «𝒜𝒟𝑀𝐼𝒩𝐼𝒮𝒯𝑅𝒜𝒞𝐼𝒪𝒩», y un anuncio interno
      // sonaba en la campana de todos. Ver `categoriasStaff()`.
      const fuera = categoriasStaff(cs);
      for (const id of fueraSv[s.sv] || []) fuera.add(String(id));
      // el nombre de cada categoría, normalizado: ver `enTorneos` abajo
      const catNombre = new Map(cs.filter((c) => c && c.type === 4).map((c) => [String(c.id), String(c.name || '').normalize('NFKD')]));
      // 🎤 el chat general, para el bot en vivo cuando lo prende el Dashboard (ver `chatVivo()`)
      const gen = chatGeneralDe(cs, fuera);
      if (gen) generales.push({ sv: s.sv, g: s.guild, id: gen });
      for (const c of cs) {
        if (c.type !== 0 && c.type !== 5) continue;
        if (fuera.has(String(c.parent_id || ''))) continue;
        // 🔴 NORMALIZADO, O LAS LETRAS DECORADAS NO MATCHEAN. Urban Freestyle
        // (25/09/2026) llama a su canal «「🏆」𝙀𝙫𝙚𝙣𝙩𝙤𝙨»: son letras matemáticas
        // (U+1D400 y siguientes), no «Eventos», y /evento/ no las encuentra.
        // No falla: el servidor queda sin avisos y nadie se entera. NFKD las
        // vuelve letras comunes, como en `anuncios.py`.
        const n = (c.name || '').normalize('NFKD');
        // 🔑 los de veredictos, aparte: ver `veredictos()`
        if (PATRON_VEREDICTOS.test(n) && !NO_VEREDICTOS.test(n) && !/llave/i.test(n) && !STAFF.test(n)) {
          ver.push({ id: c.id, nombre: n, sv: s.sv, g: s.guild });
        }
        // 🔑 los de inscripciones, aparte: ver `inscripciones()`
        if (PATRON_INSC.test(n) && !STAFF.test(n)) insc.push({ id: c.id, nombre: n, sv: s.sv, g: s.guild, p: String(c.parent_id || '') });
        // los de staff también dicen «evento», y el bot los lee
        // 🆚 Y «ANUNCIOS» ADENTRO DE UNA CATEGORÍA DE TORNEOS (FVS, 12/10/2026): FVS anuncia en «「📢」Anuncios» de su
        // categoría «🏆〘Torneos〙🏆», y por el nombre del canal solo el vigía no la oía. Medido en los ocho servidores:
        // suma ese canal y ningún otro
        const enTorneos = /anuncio/i.test(n) && PATRON_VIGIA.test(catNombre.get(String(c.parent_id || '')) || '');
        if (STAFF.test(n) || PATRON_INSC.test(n) || (!PATRON_VIGIA.test(n) && !enTorneos)) continue;
        lista.push({ id: c.id, nombre: n, sv: s.sv, svn: s.nombre || s.sv, g: s.guild, p: String(c.parent_id || '') });
      }
    }
    const canales = { t: ahora, v: CANALES_V, yo, lista, veredictos: ver, inscripciones: insc, generales,
      sin_acceso: sinAcceso, firma };
    // ⚠️ UNA BUSQUEDA QUE NO ENCONTRO NADA NO PISA A UNA QUE SÍ. Si Discord
    // contestó mal a todo, quedarse sin canales es dejar de avisar callado.
    const antes = this.leer('canales');
    if (!lista.length && antes && antes.lista && antes.lista.length) {
      antes.t = ahora;
      antes.firma = firma;
      antes.fallo = 'la última búsqueda no encontró canales';
      this.guardar('canales', antes);
      return antes;
    }
    this.guardar('canales', canales);
    return canales;
  }

  // ── el latido ────────────────────────────────────────────────────────
  /**
   * 🔒 UNA VUELTA DEL VIGÍA POR VEZ, ENTERA (13/10/2026). El cron dispara cada minuto y una vuelta puede tardar más:
   * entonces dos vueltas viven a la vez adentro del objeto, y todo lo que anota «ya lo mandé» DESPUÉS de esperar a
   * Discord sale dos veces. Pasó dos veces el mismo día: «Erian pasa · Cuartos…» en el chat de FFA a las 2:02 AM (se
   * cerró sólo `chatVivo()`, ver `chatEn`) y «LA BELLA ARTE DE LA DESGRACIA VOL 5» en `eventos-hoy` a las 4:01 PM,
   * dos copias a 127 ms —`publicar()` toma la fila pendiente, espera el POST y recién ahí la marca—. Cerrar pieza por
   * pieza deja la próxima abierta: se cierra la vuelta. La que llega mientras otra trabaja se saltea (el minuto
   * siguiente lo hace), y si una quedó colgada, a los 3 minutos se suelta sola.
   */
  async vigilar(d) {
    const ahora = Date.now();
    if (this.vigiaEn && ahora - this.vigiaEn < 3 * MIN) {
      this.guardar('vigia_salteada', { t: ahora, desde: this.vigiaEn });
      return { ok: true, salteada: true };
    }
    this.vigiaEn = ahora;
    try {
      return await this.vueltaVigia(d);
    } finally {
      this.vigiaEn = 0;
    }
  }

  async vueltaVigia(d) {
    const ahora = Date.now();
    if (!this.env.DISCORD_TOKEN) {
      this.guardar('vigia', { t: ahora, error: 'el Worker no tiene DISCORD_TOKEN' });
      return { ok: false };
    }
    // 🔴 SI DISCORD DICE 401, SE PARA UNA HORA. Un token revocado haría
    // 4.320 pedidos rechazados por día, y Discord banea la IP por pedidos
    // inválidos — la IP de Cloudflare, compartida con el resto del bot.
    const previo = this.leer('vigia') || {};
    if (previo.pausa && ahora < previo.pausa) return { ok: false, pausa: true };
    // 🌙 DE MADRUGADA DUERME ENTERO (Dlx, 27/09/2026: las llaves en vivo, los
    // avisos y el cron, apagados de 3 a 11 AM ET; la hora la pone el Worker,
    // ver `MADRUGADA`). Ni anuncios, ni llaves, ni los avisos de cada uno.
    // Deja el latido con `dormido`: quieto a propósito no es caído, y así
    // `alertar.py` no avisa de nada.
    // ⚠️ NADA SE PIERDE: a las 11 relee los canales, y un anuncio de esas
    // horas se avisa si su evento todavía no empezó —`anotar()` descarta
    // lo que llega tarde—. Lo que ya estaba programado antes de las 3 (un
    // recordatorio) sale igual por su alarma.
    // 🛡️ (el anti-raid, que no duerme, ya no va acá: tiene su propio pedido, ver `vigilar()` de afuera)
    // 👆 los toques juntados en memoria, a la base: una vez por minuto, también de madrugada
    try { this.clicsVolcar(); } catch (e) { this.medir('filas', 'clics-error', 1); }
    try { this.errVolcar(); } catch (e) { this.medir('filas', 'errores-error', 1); }
    if (d && d.dormido) {
      this.guardar('vigia', { t: ahora, dormido: true, canales: previo.canales, limpio: previo.limpio });
      return { ok: true, dormido: true };
    }

    let canales = this.leer('canales');
    // 🔑 Y SI CAMBIÓ LA LISTA DE SERVIDORES DE LA LIGA (`meta.liga` y `meta.fuera`)
    // se vuelve a buscar en el momento. FFS entró el 29/09/2026 y, sin esto, la
    // campana lo encontraba recién en la búsqueda de las 6 h —de madrugada,
    // dormida: a las 11 AM—. `meta` ya se lee cada minuto (`llaves()`).
    let firma = '';
    try { firma = firmaLiga(JSON.parse((await this.env.KV.get('meta', { cacheTtl: 60 })) || '{}')); } catch (e) { firma = ''; }
    if (!canales || !canales.lista || !canales.lista.length ||
        canales.v !== CANALES_V || ahora - (canales.t || 0) > REDESCUBRIR ||
        (firma && canales.firma !== firma)) {
      canales = await this.descubrir(d && d.servidores, ahora);
    }
    // 🗺️ qué guild es cada servidor, para lo que llega por una ruta y no por el vigía (el panel del socio, 19/10/2026).
    // La lista viene cada minuto: se escribe sólo si cambió
    try {
      const gs = {};
      for (const s of (d && Array.isArray(d.servidores)) ? d.servidores : []) if (s && s.sv && s.guild) gs[String(s.sv)] = String(s.guild);
      if (Object.keys(gs).length && JSON.stringify(gs) !== JSON.stringify(this.leer('guilds') || {})) this.guardar('guilds', gs);
    } catch (e) { /* es un mapa de apoyo */ }
    this.yo = canales.yo || '';
    this.dueno = (d && d.dueno) || '';
    // guardado, para lo que llega por una ruta y no por el vigía (era la postulación de /sumate, que se fue el 13/10/2026)
    if (this.dueno && this.leer('dueno') !== this.dueno) this.guardar('dueno', this.dueno);
    let leidos = 0, nuevos = 0, pausa = 0;
    const errores = [];
    // ⚠️ LOS CANALES SE PIDEN A LA VEZ, NO UNO DETRAS DEL OTRO. La primera
    // corrida encontró 14 —la búsqueda por nombre es la misma de
    // `anuncios.canales()`, así que el vigía escucha lo mismo que el hub
    // muestra— y en fila eran ~2 s por minuto esperando a Discord. Cada
    // canal es otro bucket de su límite, así que no se pisan.
    const respuestas = await Promise.all((canales.lista || []).map(async (c) => {
      try {
        const r = await fetch(`${DC}/channels/${c.id}/messages?limit=10`, {
          headers: { Authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'User-Agent': UA },
        });
        return { c, estado: r.status, msgs: r.status === 200 ? await r.json() : null };
      } catch (e) {
        return { c, estado: 0, msgs: null };
      }
    }));
    // 🔴 UN 403 NO ES UNA FALLA DEL VIGÍA: es un canal que ese servidor no le
    // deja leer al bot. Con los nombres normalizados (25/09/2026) apareció
    // «🎉│EVENTOS» de TFC, que antes no se reconocía, y el vigía lo contaba
    // como error cada minuto: `ok` en falso y una alerta a Dlx por algo que
    // no se arregla acá. Se saca de la lista hasta el próximo redescubrimiento
    // y queda anotado en `sin_leer`, para que se vea cuál es.
    const sinLeer = [];
    for (const { c, estado, msgs } of respuestas) {
      if (estado === 401) { pausa = ahora + HORA; continue; }
      if (estado === 403) { sinLeer.push(c); continue; }
      if (!msgs) { errores.push(`${c.sv} ${c.nombre}: ${estado || 'sin red'}`); continue; }
      leidos += msgs.length;
      for (const m of msgs) if (this.anotar(m, c, ahora)) nuevos++;
    }
    if (pausa) errores.push('401: el token no sirve; se reintenta en una hora');
    if (sinLeer.length) {
      const fuera = sinLeer.map((c) => c.id);
      canales.lista = (canales.lista || []).filter((c) => fuera.indexOf(c.id) < 0);
      canales.sin_leer = (canales.sin_leer || []).concat(sinLeer.map((c) => `${c.sv} ${c.nombre}`))
        .filter((x, i, t) => t.indexOf(x) === i);
      this.guardar('canales', canales);
    }
    if (this.dmPrueba) {
      const p = this.dmPrueba;
      this.dmPrueba = null;
      await this.avisarDueno(p);
    }
    // la re-publicación en `eventos-hoy` va en el mismo minuto
    if (!pausa) await this.publicar(ahora);
    // 🔑 y las llaves que se están jugando. Nunca frena al vigía.
    if (!pausa) {
      try { await this.llaves(ahora); } catch (e) {
        this.guardar('vivo', { t: ahora, error: String(e).slice(0, 160) });
      }
      // 🔑 y los veredictos de lo que se está jugando. Nunca frena al vigía.
      try { await this.veredictos(ahora); } catch (e) {
        this.guardar('veredictos', { t: ahora, error: String(e).slice(0, 160) });
      }
      // 🔑 y quién se anota, mientras hay un evento. Nunca frena al vigía.
      try { await this.inscripciones(ahora); } catch (e) {
        this.guardar('inscritos', { t: ahora, error: String(e).slice(0, 160) });
      }
      // 🔑 y el evento que se canceló. Nunca frena al vigía: ver `cancelaciones()`
      try {
        if (await this.cancelaciones(ahora)) nuevos++;
      } catch (e) {
        this.guardar('cancelados', { t: ahora, error: String(e).slice(0, 160) });
      }
      // 📅 y los eventos de Discord: crearlos, ponerlos en vivo, terminarlos. Nunca frena al vigía: ver `eventosDiscord()`
      try { await this.eventosDiscord(ahora); } catch (e) { this.guardar('ev_discord', { t: ahora, error: String(e).slice(0, 160) }); }
      // 🐞 y un error nuevo de la página que se repite, una vez al canal de Logs. Nunca frena al vigía
      try { await this.erroresAvisar(ahora); } catch (e) { this.medir('filas', 'errores-logs-error', 1); }
      // 🎙️ y quién está en la llamada, minuto a minuto. Nunca frena al vigía: ver `llamada()`
      try { await this.llamada(ahora); } catch (e) {
        this.guardar('llamada', { ...(this.leer('llamada') || {}), error: String(e).slice(0, 160) });
      }
      // 🎤 y a quién le toca. Nunca frena al vigía: ver `turnos()`
      try { await this.turnos(ahora); } catch (e) {
        this.guardar('turnos', { t: ahora, error: String(e).slice(0, 160) });
      }
      // 🎤 y el bot en vivo, en el chat de cada servidor. Nunca frena al vigía: ver `chatVivo()`
      // 🔒 UNA VUELTA POR VEZ (13/10/2026: «Erian pasa · Cuartos…» salió dos veces a las 2:02 en FFA). Lo dicho se anota
      // después de mandarlo, y mientras se espera a Discord otra vuelta del vigía puede entrar al objeto y verlo
      // pendiente. Si la otra quedó colgada, a los 3 minutos se suelta sola
      if (!this.chatEn || ahora - this.chatEn > 3 * MIN) {
        this.chatEn = ahora;
        try { await this.chatVivo(ahora); } catch (e) {
          this.guardar('chat_vivo', { t: ahora, error: String(e).slice(0, 160) });
        } finally { this.chatEn = 0; }
      }
      // 🖼️ y las imágenes de los vs que esperan. Nunca frena al vigía: ver `vsDespachar()`
      try { await this.vsDespachar(ahora); } catch (e) {
        this.guardar('vs', { t: ahora, error: String(e).slice(0, 160) });
      }
      // 📝 y quiénes se anotan, antes de la llave («Con datos» y «A full»). Nunca frena al vigía: ver `inscriptosChat()`
      try { await this.inscriptosChat(ahora); } catch (e) {
        this.guardar('inscriptos_chat', { t: ahora, error: String(e).slice(0, 160) });
      }
      // 🕵️ y quién es cada nombre de las llaves en vivo. Nunca frena al vigía: ver `quienes()`
      try { await this.quienes(ahora); } catch (e) {
        this.guardar('quien', { ...(this.leer('quien') || {}), error: String(e).slice(0, 160) });
      }
      // 🙋 y quiénes se anotaron a cada evento, antes de la llave. Nunca frena al vigía: ver `anotados()`
      try { await this.anotados(ahora); } catch (e) {
        this.guardar('anotados', { ...(this.leer('anotados') || {}), error: String(e).slice(0, 160) });
      }
    }
    // lo avisado se guarda dos días: alcanza para no repetir y no crece
    if (!previo.limpio || ahora - previo.limpio > HORA) {
      this.sql.exec('DELETE FROM avisos WHERE creado < ?', ahora - 2 * 24 * HORA);
      this.sql.exec('DELETE FROM cancelados WHERE t < ?', ahora - 3 * 24 * HORA);
      this.sql.exec('DELETE FROM estados WHERE pub < ?', ahora - 3 * 24 * HORA);
      this.sql.exec('DELETE FROM llaves_raras WHERE t < ?', ahora - 3 * 24 * HORA);
      this.sql.exec('DELETE FROM claves WHERE t < ?', ahora - 2 * 24 * HORA);
      this.sql.exec('DELETE FROM repetidos WHERE t < ?', ahora - 2 * 24 * HORA);
      this.sql.exec('DELETE FROM posts WHERE creado < ?', ahora - 7 * 24 * HORA);
      // 🎟️ las llaves en vivo que miró cada uno: a esa altura la Tarea ya quedó anotada (`pase_hecho`)
      this.sql.exec('DELETE FROM pase_vivo WHERE t < ?', ahora - 14 * 24 * HORA);
      // 👏 los aplausos, con su publicación: para entonces ya salió del muro (21 días)
      const viejo = ahora - APLAUSOS_DIAS * DIA_MS;
      this.sql.exec('DELETE FROM aplausos WHERE t < ? OR id IN (SELECT id FROM aplaudidas WHERE primero < ?)', viejo, viejo);
      this.sql.exec('DELETE FROM aplaudidas WHERE primero < ?', viejo);
      // 🔔 y la bandeja de cada uno: 30 días
      this.sql.exec('DELETE FROM bandeja WHERE t < ?', viejo);
      // 📖 y las historias que vio cada uno: para entonces ya no está ninguna
      this.sql.exec('DELETE FROM hvistas WHERE t < ?', ahora - HISTORIAS_DIAS * DIA_MS);
      // 🤝 y las postulaciones de /sumate: 90 días
      this.sql.exec('DELETE FROM postulaciones WHERE t < ?', ahora - 90 * DIA_MS);
      // 📊 el uso: quién, `USO_DIAS` días; las visitas (sólo un número por día), 90
      this.sql.exec('DELETE FROM uso WHERE dia < ?', diaET(ahora - USO_DIAS * DIA_MS));
      this.sql.exec('DELETE FROM visitas WHERE dia < ?', diaET(ahora - 90 * DIA_MS));
      this.sql.exec('DELETE FROM tutorial WHERE dia < ?', diaET(ahora - 90 * DIA_MS));
      this.sql.exec('DELETE FROM secciones WHERE dia < ?', diaET(ahora - 90 * DIA_MS));
      this.sql.exec('DELETE FROM clics WHERE dia < ?', diaET(ahora - 90 * DIA_MS));
      // 🐞 los errores de la página: 30 días
      this.sql.exec('DELETE FROM errores_pag WHERE dia < ?', diaET(ahora - 30 * DIA_MS));
      this.sql.exec('DELETE FROM errores_avisados WHERE t < ?', ahora - 30 * DIA_MS);
      // 🔴 y los dispositivos que nunca recibieron nada y fallaron cinco veces (revisión del 03/10/2026): sólo 404 y
      // 410 borran al momento (ver `MUERTA`), así que uno inventado con un servicio que no resuelve quedaba para
      // siempre ocupando lugar en el tope y recibiendo cada evento. Uno de verdad recibe la de prueba al anotarse
      this.sql.exec('DELETE FROM subs WHERE enviados = 0 AND fallos >= 5 AND prueba = 0');
      // 🔢 y los contadores de cambios de días que ya pasaron
      this.sql.exec('DELETE FROM cambios_dia WHERE dia < ?', new Date(ahora - DIA_MS).toISOString().slice(0, 10));
      // 🎤 y lo que dijo el bot en vivo: dos días (de una llave sólo se habla mientras se mueve)
      this.sql.exec('DELETE FROM chat_vivo WHERE t < ?', ahora - 2 * DIA_MS);
      // 👥 y de las crews, lo vencido: invitaciones y pedidos de más de una semana, esperas cumplidas
      try { CW.crewLimpiar(this); } catch (e) { /* sigue */ }
      await this.vaciarBasuraCrews();
    }
    this.guardar('vigia', {
      t: ahora, canales: (canales.lista || []).length, leidos, nuevos, errores,
      pausa: pausa || undefined,
      limpio: (!previo.limpio || ahora - previo.limpio > HORA) ? ahora : previo.limpio,
    });
    if (nuevos) await this.despertar(ahora);
    // 🔑 los avisos de cada uno. Nunca frena al vigía: ver `personales()`
    try { await this.personales(ahora); } catch (e) {
      this.guardar('personales', { t: ahora, error: String(e).slice(0, 120) });
    }
    // 🔑 y lo que le pasó a quien seguís. Nunca frena al vigía: ver `seguidos()`
    try { await this.seguidos(ahora); } catch (e) {
      this.guardar('seguidos', { t: ahora, error: String(e).slice(0, 120) });
    }
    // 🔔 y lo nuevo de las ligas que sigue cada uno. Nunca frena al vigía: ver `ligasSeguidas()`
    try { await this.ligasSeguidas(ahora); } catch (e) {
      this.guardar('ligas_seguidas', { t: ahora, error: String(e).slice(0, 120) });
    }
    // 🙈 y la lista de fotos ocultas, si quedó pendiente (ver `espejarOcultas()`)
    if (this.leer('ocultas_pend')) {
      try { await this.espejarOcultas(); } catch (e) { /* la próxima vuelta */ }
    }
    // ⭐ y quién empezó a seguirte. Nunca frena al vigía: ver `avisarSeguidores()`
    try { await this.avisarSeguidores(ahora); } catch (e) {
      this.guardar('seguidores_nuevos', { t: ahora, error: String(e).slice(0, 120) });
    }
    // 👏 y cuántos te felicitaron. Nunca frena al vigía: ver `avisarAplausos()`
    try { await this.avisarAplausos(ahora); } catch (e) {
      this.guardar('aplausos', { t: ahora, error: String(e).slice(0, 120) });
    }
    // 🔥 y la racha que se corta hoy, a la noche. Nunca frena al vigía: ver `recordarRacha()`
    // 🎟️ el aviso semanal del Pase (sólo a quien lo prendió) y el sorteo del premium cuando llega su hora
    try { await this.avisarPase(ahora); } catch (e) { /* nunca frena al vigía */ }
    try { await this.sortear(ahora); } catch (e) { /* nunca frena al vigía */ }
    try { await this.sorteoRol(ahora); } catch (e) { /* nunca frena al vigía */ }
    try { await this.recordarRacha(ahora); } catch (e) {
      this.guardar('racha_aviso', { t: ahora, error: String(e).slice(0, 120) });
    }
    // 📣 y el organizador que seguís anunció. Nunca frena al vigía: ver `avisarOrgs()`
    try { await this.avisarOrgs(ahora); } catch (e) {
      this.guardar('orgs', { t: ahora, error: String(e).slice(0, 120) });
    }
    // 🔑 el precio por cabeza: lo que el ciclo resolvió (cazado o devuelto),
    // cada cinco minutos. Nunca frena al vigía: ver `resolverPrecios()`
    if (Math.floor(ahora / MIN) % 5 === 0) {
      try { await this.resolverPrecios(ahora); } catch (e) {
        this.guardar('precios_error', { t: ahora, error: String(e).slice(0, 120) });
      }
    }
    // 📏 y lo medido, cada 10 minutos (ver el constructor)
    try { this.medidasGuardar(ahora); } catch (e) { /* medir nunca frena al vigía */ }
    return { ok: !errores.length, leidos, nuevos, errores };
  }

  /** Las llaves que se están jugando: lee sus canales y guarda el texto. */
  async llaves(ahora) {
    let lista = [];
    try { lista = (JSON.parse((await this.env.KV.get('meta')) || '{}').llaves) || []; } catch (e) { lista = []; }
    if (!lista.length) return;
    const cal = new Set(this.sql.exec('SELECT DISTINCT canal FROM vivo WHERE ed > ?', ahora - 3 * HORA)
      .toArray().map((r) => r.canal));
    const min = Math.floor(ahora / MIN);
    const leer = lista.filter((c) => cal.has(c.id))
      .concat(lista.filter((c, i) => !cal.has(c.id) && (min + i) % 5 === 0)).slice(0, VIVO_TOPE);
    const rs = await Promise.all(leer.map(async (c) => {
      try {
        const r = await fetch(`${DC}/channels/${c.id}/messages?limit=${VIVO_LEE}`, {
          headers: { Authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'User-Agent': UA },
        });
        return { c, msgs: r.status === 200 ? await r.json() : null };
      } catch (e) {
        return { c, msgs: null };
      }
    }));
    let nuevas = 0;
    let borradas = 0;
    for (const { c, msgs } of rs) {
      // lo que se borró en Discord: ver `borradasDelCanal()`
      const guardadas = this.sql.exec('SELECT id FROM vivo WHERE canal = ?', c.id).toArray()
        .map((r) => r.id);
      for (const id of borradasDelCanal(guardadas, msgs, VIVO_LEE)) {
        // 🔴 Y SE ANOTA (03/10/2026, LA REDENCION de FFA): «pinchó» —se canceló a último momento— y el organizador borró
        // la llave pero no el anuncio, así que la página siguió diciendo EN VIVO hasta 90 min después de la hora. El
        // principio del texto alcanza: la página saca de ahí el título y lo cruza con el anuncio (`Liga.vivo()`)
        this.sql.exec('INSERT OR REPLACE INTO vivo_borradas (id, sv, pub, ed, texto, t) ' +
          'SELECT id, sv, pub, ed, substr(texto, 1, 600), ? FROM vivo WHERE id = ?', ahora, id);
        this.sql.exec('DELETE FROM vivo WHERE id = ?', id);
        borradas++;
      }
      for (const m of msgs || []) {
        const pub = Date.parse(String(m.timestamp || '').slice(0, 19) + 'Z');
        const ed = m.edited_timestamp ? Date.parse(String(m.edited_timestamp).slice(0, 19) + 'Z') : pub;
        if (Number.isNaN(pub) || ahora - Math.max(pub, ed || 0) > VIVO_HORAS * HORA) continue;
        const texto = conNombres(m).slice(0, 6000);
        // 🧩 y la llave que no se sabe leer, avisada una vez (`llaveRara()`). Nunca frena
        try { await this.llaveRara(m, c, texto, ahora); } catch (e) { /* sigue */ }
        if (!pareceLlave(texto)) {
          // 📢 el «se me fue la luz, seguimos mañana» también se escribe en el canal de llaves. Nunca frena
          try { this.anotarEstado(m, c, ahora); } catch (e) { /* sigue */ }
          continue;
        }
        const fila = this.sql.exec('SELECT ed, texto FROM vivo WHERE id = ?', m.id).toArray()[0];
        if (fila && fila.texto === texto) continue;
        // 🕵️ y de quién es cada mención: el texto ya la trae como `@apodo` (ver `quienes()`)
        const men = JSON.stringify(mencionesDe(m));
        this.sql.exec('INSERT INTO vivo (id, canal, sv, g, autor, pub, ed, texto, visto, men) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET ed = excluded.ed, ' +
          'texto = excluded.texto, visto = excluded.visto, men = excluded.men', m.id, c.id, c.sv || '', c.g || '',
        (m.author && m.author.id) || '', pub, Math.max(pub, ed || 0), texto, ahora, men);
        nuevas++;
      }
    }
    this.sql.exec('DELETE FROM vivo WHERE ed < ?', ahora - 12 * HORA);
    this.sql.exec('DELETE FROM vivo_borradas WHERE t < ?', ahora - 12 * HORA);
    this.guardar('vivo', { t: ahora, canales: leer.length, cambiaron: nuevas, borradas });
  }

  /**
   * 🎤 EL BOT EN VIVO, en el chat de cada servidor: ver `momentosChat()` y sus frenos. Habla donde el admin eligió el
   * canal con `/settings` (`cfg:<guild>` en KV, `vivo`), o en el chat general si Dlx lo prendió desde el Dashboard
   * (`en_vivo[SV] = true`); `en_vivo[SV] = false` lo apaga aunque el admin lo haya prendido. Devuelve los pedidos.
   */
  async chatVivo(ahora) {
    const aj = this.ajustes();
    const dash = (aj.en_vivo && typeof aj.en_vivo === 'object') ? aj.en_vivo : {};
    const dashNivel = (aj.en_vivo_nivel && typeof aj.en_vivo_nivel === 'object') ? aj.en_vivo_nivel : {};
    // 🎛️ lo del Dashboard: el horario de silencio, el ritmo y las apuestas (ver `apuestasCfg()`)
    const callado = enSilencio(aj, ahora), rit = ritmoCfg(aj), apc = apuestasCfg(aj);
    const filas = this.sql.exec('SELECT id, canal, sv, g, autor, pub, ed, texto FROM vivo WHERE ed > ?',
      ahora - 3 * HORA).toArray();
    // 🎲 sin llaves en juego, las apuestas que quedaron se revisan igual: así se devuelven
    if (!filas.length) {
      await this.apuestasRevisar(ahora, new Map());
      // 🗳️ y los votos que quedaron abiertos se cierran solos a los `QG_VENCE`
      try { await this.qgRevisar(ahora, new Map()); } catch (e) { this.guardar('qg', { t: ahora, error: String(e).slice(0, 160) }); }
      return 0;
    }
    if (!globalThis.LlaveVivo) await import('./llave_vivo.js');
    const LV = globalThis.LlaveVivo;
    if (!LV) return 0;
    const generales = (this.leer('canales') || {}).generales || [];
    const cfgs = new Map();
    let pedidos = 0, mandados = 0, editados = 0, lobby = null;
    const errores = [];
    // 🔑 el nombre del evento es el del ANUNCIO, no el título de la llave: la de la DESGRACIAS EN TOKYO VOL 23
    // (05/10/2026) decía «VOL 22» —el organizador copió la anterior— y el bot anunció «Arrancó … VOL 22». Lo junta
    // `LlaveVivo.deEvento()`, lo mismo que la página
    const bloques = LV.unirPartidas(filas);
    const llaves = new Map();
    for (const b of bloques) {
      try { const L = LV.aLlave(b); if (L) llaves.set(b.id, L); } catch (e) { /* una llave que no se lee no frena */ }
    }
    // 🔑 LA MISMA ASIGNACIÓN QUE LA PÁGINA Y EL CICLO (`LlaveVivo.asignar()`), sobre los anuncios de 36 horas, y EL
    // NOMBRE QUE YA SE LE DIO se queda (revisión del 05/10/2026): un evento anunciado la noche anterior salía de la
    // ventana a mitad de la llave, y el mensaje de las rondas se editaba a «… VOL 22», el título copiado
    let asig = null, cambio = false;
    const nombres = this.leer('nombres_vivo') || {};
    const nombreDe = (L) => {
      if (asig === null) {
        const anuncios = this.anunciosVistos(ahora, 36, 40).map((a) => ({ nombre: a.n, sv: a.sv, cuando: a.ini, link: a.url, mod: a.mod }));
        try { asig = LV.asignar(anuncios, [...llaves.values()]).deLlave; } catch (err) { asig = {}; }
      }
      const a = asig[L.id];
      if (a && a.nombre) {
        if (!nombres[L.id] || nombres[L.id].n !== a.nombre) { nombres[L.id] = { n: a.nombre, t: ahora }; cambio = true; }
        return a.nombre;
      }
      // ⚠️ «La llave» no es el nombre de un evento (la ACADEMIA, 09/10/2026: «Arrancó La llave»): sin anuncio, el servidor
      const n = (nombres[L.id] && nombres[L.id].n) || L.nombre;
      if (!n || /^(la\s+)?llave$/i.test(String(n).replace(/[\s_*~#]+/g, ' ').trim())) {
        const s = ((this.leer('canales') || {}).lista || []).find((x) => x.sv === L.sv);
        return 'el evento de ' + ((s && s.svn) || L.sv || 'la Liga');
      }
      return n;
    };
    for (const b of bloques) {
      // 🌙 en el horario de silencio no habla; las apuestas se siguen cerrando y pagando (abajo)
      if (pedidos >= CHAT_TOPE || callado) break;
      if (!b.g || dash[b.sv] === false) continue;
      if (!cfgs.has(b.g)) {
        // ⏱️ los ajustes de /settings, guardados 5 minutos en la memoria del objeto: eran una lectura de KV por minuto y
        // por servidor durante las tres horas de cada llave (revisión del 05/10/2026). Un cambio del admin tarda eso
        const m = (this.cfgChat = this.cfgChat || new Map()).get(b.g);
        let c = m && ahora - m.t < 5 * MIN ? m.c : null;
        if (!c) {
          try { c = JSON.parse((await this.env.KV.get('cfg:' + b.g, { cacheTtl: 60 })) || '{}') || {}; } catch (e) { c = {}; }
          this.cfgChat.set(b.g, { c, t: ahora });
        }
        cfgs.set(b.g, c);
      }
      const canal = String(cfgs.get(b.g).vivo || '')
        || (dash[b.sv] === true ? String((generales.find((x) => x.g === b.g) || {}).id || '') : '');
      if (!/^\d{5,25}$/.test(canal)) continue;
      // un canal donde Discord no lo deja escribir se vuelve a probar a la media hora, no cada minuto (ver `pausaChat()`)
      if (ahora < (this.leer('chat_pausa:' + canal) || 0)) continue;
      const L = llaves.get(b.id);
      if (!L) continue;
      const nivel = nivelChat(dashNivel[b.sv], cfgs.get(b.g).vivo_nivel);
      const entre = porBatalla(nivel) ? rit.batalla : rit.normal;
      const hechos = {};
      for (const r of this.sql.exec('SELECT m, msg, texto FROM chat_vivo WHERE llave = ? AND canal = ?', L.id, canal)
        .toArray()) hechos[r.m] = r;
      const ult = (this.sql.exec("SELECT MAX(t) AS t FROM chat_vivo WHERE canal = ? AND msg != ''", canal)
        .toArray()[0] || {}).t || 0;
      const fresca = ahora - (L.ed || 0) <= CHAT_FRESCA;
      const nombre = nombreDe(L);
      // 🔁 UNA LLAVE POR EVENTO EN EL CHAT (13/10/2026, Dlx: «se sigue repitiendo esto», con «🎤 Arrancó LA BELLA ARTE DE
      // LA DESGRACIA VOL 5 · 15 en la llave» a las 5:02 PM y otra vez «· 24 en la llave» a las 5:09: el organizador
      // publicó la llave corregida —faltaba gente— y para el chat era otra llave, con su propio «Arrancó»). Si otra llave
      // del mismo servidor va con EL MISMO ANUNCIO y se publicó después, ésta la reemplazó y ya no habla. ⚠️ Sólo con
      // anuncio: dos llaves sin anunciar del mismo servidor pueden ser dos eventos distintos
      const anL = (asig || {})[L.id];
      if (anL && [...llaves.values()].some((M) => {
        const anM = M.id !== L.id && (M.sv || '') === (L.sv || '') && (M.pub || 0) > (L.pub || 0) ? asig[M.id] : null;
        return !!anM && anM.nombre === anL.nombre && (anM.link || '') === (anL.link || '');
      })) continue;
      // la gente con su nombre de la Liga, y lo del cierre: la tabla y los perfiles (10 minutos en la memoria)
      const dc = await this.datosCruce(ahora);
      // 🕵️ QUIÉN ES CADA NOMBRE, PRIMERO POR LO QUE YA SABE LA PÁGINA (13/10/2026, Dlx con el vs de QCYO RAPEEN:
      // «el bot debería saber quiénes son esas personas… en el canal de inscripciones está todo»; Frifaier era Cronox,
      // que se anotó así). `quien` es la inscripción de cada cuenta, la llamada y las menciones de ese servidor, cada
      // minuto (`quienes()`); si no lo sabe, la tabla y los alias, como antes
      const qsv = ((this.leer('quien') || {}).svs || {})[L.sv || b.sv] || {};
      const buscar = (n) => {
        const q = qsv[normPagina(n)];
        return (q && (dc.tabla[q] || dc.perf[q]) ? q : '') || dc.buscar(n);
      };
      // 🙈 quién está en el servidor de ESTE chat, para mencionarlo (ver `genteChat()`): sus servidores, de `persona`
      const svChat = b.sv || L.sv || '';
      const enSv = (k) => {
        if (!k || !svChat) return false;
        try { return ((JSON.parse(this.persona('p:' + k) || '{}') || {}).svs || []).includes(svChat); } catch (e) { return false; }
      };
      const opc = { buscar, tabla: dc.tabla, perf: dc.perf, perfT: dc.perfT, cartaDe: dc.cartaDe,
        ids: await this.indiceNombres(ahora), enSv };
      let ms = momentosChat(L, nombre, [], nivel, opc);
      // los favoritos sólo si «Arrancó» sale ahora: el lobby pesa, no se lee cada minuto
      if (!hechos.llave && ms.length && (porBatalla(nivel) || ms[ms.length - 1].m === 'llave') && fresca
          && ahora - ult >= entre) {
        if (lobby === null) {
          try { lobby = JSON.parse((await this.env.KV.get('web:lobby')) || '{}') || {}; } catch (e) { lobby = {}; }
        }
        ms = momentosChat(L, nombre, favoritosDe(L, lobby.tabla || []), nivel, opc);
      }
      // 🏆 EL AVISO DEL CICLO, ANOTADO CON OTRO MENSAJE DE ESTA LLAVE (`campeonCerca()`): se lo queda ésta, así el cierre se
      // le suma en vez de salir aparte. Se pasa a su clave y se borra la del ciclo, para que no la tome otra llave
      if (!hechos.campeon && ms.some((x) => x.m === 'campeon')) {
        const idsL = [L.id].concat((L.links || []).map((l) => String(l).replace(/\/+$/, '').split('/').pop()));
        const c = campeonCerca(this.sql.exec("SELECT llave, msg, texto FROM chat_vivo WHERE canal = ? AND m = 'campeon' " +
          "AND msg != '' AND texto = ''", canal).toArray(), idsL);
        if (c) {
          this.sql.exec("DELETE FROM chat_vivo WHERE canal = ? AND m = 'campeon' AND msg = ? AND texto = ''", canal, c.msg);
          this.sql.exec("INSERT OR REPLACE INTO chat_vivo (llave, canal, m, msg, texto, t) VALUES (?, ?, 'campeon', ?, '', ?)",
            L.id, canal, String(c.msg), ahora);
          hechos.campeon = { m: 'campeon', msg: String(c.msg), texto: '' };
        }
      }
      // 🔁 LO QUE YA SE DIJO, CON OTRA CLAVE, TAMPOCO SE REPITE (13/10/2026): la clave de «pasa» lleva el lugar de la
      // batalla en la ronda y quién es, y si el organizador corre las batallas o un nombre se reconoce más tarde, cambia.
      // Una línea que ya está, igual, en un mensaje de esta llave queda dicha
      const dichos = Object.values(hechos).map((h) => h.texto || '').join('\n');
      for (const x of ms) {
        if (hechos[x.m] || !x.texto || x.texto.length < 12 || !dichos.includes(x.texto)) continue;
        this.sql.exec('INSERT OR IGNORE INTO chat_vivo (llave, canal, m, msg, texto, t) VALUES (?, ?, ?, ?, ?, ?)',
          L.id, canal, x.m, '', '', ahora);
        hechos[x.m] = { m: x.m, msg: '', texto: '' };
      }
      // 🔁 Y EL «ARRANCÓ» DE ESE EVENTO SE DICE UNA VEZ (13/10/2026, ver arriba). Si en este canal ya salió con la llave de
      // antes, ésta no manda otro: EDITA aquél con sus números —cuántos hay en la llave y los favoritos—. Un mensaje nuevo
      // volvía a sonar; una edición no. Por el nombre del evento en el texto, de las últimas 12 horas
      if (anL && !hechos.llave && ms.some((x) => x.m === 'llave')) {
        const plano = (t) => String(t || '').normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase();
        const nn = plano(nombre);
        const prev = nn ? this.sql.exec("SELECT llave, msg, texto FROM chat_vivo WHERE canal = ? AND m = 'llave' AND msg != '' " +
          'AND llave != ? AND t > ? ORDER BY t DESC', canal, L.id, ahora - 12 * HORA).toArray()
          .find((r) => plano(r.texto).includes(nn)) : null;
        if (prev) {
          // los favoritos de ESTA llave: el lobby se lee una vez por vuelta
          if (lobby === null) {
            try { lobby = JSON.parse((await this.env.KV.get('web:lobby')) || '{}') || {}; } catch (e) { lobby = {}; }
          }
          ms = momentosChat(L, nombre, favoritosDe(L, lobby.tabla || []), nivel, opc);
          const x = ms.find((y) => y.m === 'llave');
          let texto = prev.texto || '';
          // ⚠️ SÓLO SU RENGLÓN: en «Cada batalla» el mensaje del «Arrancó» puede llevar más cosas, y no se pisan
          const lineas = texto.split('\n');
          const i = lineas.findIndex((l) => l.startsWith('🎤 Arrancó'));
          const nuevo = x && x.texto && i >= 0 ? lineas.map((l, j) => (j === i ? x.texto.split('\n')[0] : l)).join('\n') : texto;
          if (nuevo !== texto && pedidos < CHAT_TOPE) {
            pedidos++;
            let r = null;
            try {
              r = await fetch(`${DC}/channels/${canal}/messages/${prev.msg}`, {
                method: 'PATCH',
                headers: { Authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'User-Agent': UA, 'content-type': 'application/json' },
                body: JSON.stringify({ content: nuevo.slice(0, 1900), allowed_mentions: { parse: [] } }),
              });
            } catch (e) { r = null; }
            if (r && r.ok) { texto = nuevo; editados++; }
          }
          this.sql.exec('INSERT OR REPLACE INTO chat_vivo (llave, canal, m, msg, texto, t) VALUES (?, ?, ?, ?, ?, ?)',
            L.id, canal, 'llave', prev.msg, texto, ahora);
          hechos.llave = { m: 'llave', msg: prev.msg, texto };
        }
      }
      // 🔁 una llave que ya venía hablando con las claves de antes no repite lo que ya dijo (ver `migrarHechos()`)
      for (const m of migrarHechos(hechos, ms, porBatalla(nivel) ? batallaChat(L) : null)) {
        this.sql.exec('INSERT OR IGNORE INTO chat_vivo (llave, canal, m, msg, texto, t) VALUES (?, ?, ?, ?, ?, ?)',
          L.id, canal, m, '', '', ahora);
        hechos[m] = { m, msg: '', texto: '' };
      }
      // 🔥🎲 «CON DATOS» Y «A FULL»: la batalla que VIENE (`batallaChat()`), con su título, su «¿sabías que…?» y —en «A
      // full»— la apuesta, que va con botones en el mismo mensaje. Sólo de dos lados, y una vez por batalla
      let apuesta = null, voto = null;
      if ((nivel === 'datos' || nivel === 'full') && fresca) {
        const bat = batallaChat(L);
        // 🧮 TODOS CONTRA TODOS (1v1v1, 1v1v1v1, o tres equipos): el cruce también sale, con un botón de voto por lado. Sin
        // apuestas (son de dos lados) ni el vs con tarjetas (es de dos). Dlx, 19/10/2026: «¿qué sucede cuando son 3
        // personas distintas batallando? ¿el bot hace 3 votaciones?». Una votación, con un botón para cada uno
        if (bat && bat.lados.length >= 3 && bat.lados.length <= LADOS_VOTO.length) {
          const clave = bat.r + ':' + bat.lados.map(claveTurno).sort().join('|');
          const mv = 'v:' + bat.r + ':' + bat.i;
          if (!hechos[mv]) {
            const gs = bat.lados.map((l) => genteChat(l, buscar, dc.tabla, opc.ids, opc.enSv));
            const equipos = gs.some((g) => g.length > 1);
            const x = infoCruce(bat.lados.slice(0, 2), buscar, dc.tabla, dc.perf);
            if (gs[0].length === 1) x.a.n = gs[0][0].n;
            if (gs[1].length === 1) x.b.n = gs[1][0].n;
            const dato = datoCurioso(x, L.id + clave, (y) => (y.f ? this.encima(y.f.n, ahora) : 0));
            const lineas = ['🔥 **' + (equipos ? bat.lados.length + ' EQUIPOS' : 'TODOS CONTRA TODOS') + '** · ' + bat.lados.length
              + (equipos ? ' equipos' : ' raperos') + ' en la misma batalla, y pasa uno'];
            lineas.push('⚔️ ' + bat.r + ': ' + gs.map((g) => '**' + nombresChat(g) + '**').join(' vs '));
            if (dato) lineas.push('💡 ' + escMd(dato));
            voto = { id: codigoDe(L.id + ':' + clave + ':qg').slice(0, 12), m: mv, ronda: bat.r, a: bat.lados[0], b: bat.lados[1],
              mas: bat.lados.slice(2) };
            lineas.push(lineaVoto(voto.a, voto.b, 0, 0, '', voto.mas, []));
            const titEv = escMd(String(nombre || L.nombre || 'el evento').replace(/^[\s_*~]+|[\s_*~]+$/g, ''));
            // 🧩 y el vs con todas las tarjetas, separadas por VS (`html_vs_grupos()` de bot/kit.py)
            const persona = (y) => personaVs(y, dc);
            const vs = { ev: String(nombre || L.nombre || '').replace(/[_*~`]+/g, '').trim(), ronda: bat.r,
              titulo: equipos ? bat.lados.length + ' EQUIPOS' : 'TODOS CONTRA TODOS', sub: '', grupos: gs.map((g) => g.map(persona)) };
            ms.push({ m: mv, cab: '⚔️ **' + titEv + '**', texto: lineas.join('\n'), vs });
          }
        }
        if (bat && bat.lados.length === 2) {
          const clave = bat.r + ':' + bat.lados.map(claveTurno).sort().join('|');
          // 🧩 la clave es la batalla, no sus nombres: un equipo que crece antes de jugar no la anuncia dos veces
          const mv = 'v:' + bat.r + ':' + bat.i;
          if (!hechos[mv]) {
            const x = infoCruce(bat.lados, buscar, dc.tabla, dc.perf);
            // 👥 la crew de cada uno (del objeto, con su tier del payload) y su puesto en su país: para los títulos y
            // los «¿sabías que…?» nuevos (19/10/2026, Dlx: «más cosas así… David vs Goliat está bien pero más cosas»)
            for (const y of [x.a, x.b]) {
              y.crew = this.crewChat(y.k, dc.tiers);
              const f = y.f;
              if (f && f.cc && f.pts) y.pp = 1 + Object.values(dc.tabla).filter((g) => g && g.cc === f.cc && (g.pts || 0) > f.pts).length;
            }
            const [ga, gb] = bat.lados.map((l) => genteChat(l, buscar, dc.tabla, opc.ids, opc.enSv));
            // el nombre de la Liga también en el título y el dato («MAKMAH le ganó la última vez» → Makmah)
            if (ga.length === 1) x.a.n = ga[0].n;
            if (gb.length === 1) x.b.n = gb[0].n;
            const tt = tituloCruce(x);
            const dato = datoCurioso(x, L.id + clave, (y) => (y.f ? this.encima(y.f.n, ahora) : 0));
            const lineas = [];
            if (tt) lineas.push('🔥 **' + tt.t + '**' + (tt.sub ? ' · ' + escMd(tt.sub) : ''));
            lineas.push('⚔️ ' + bat.r + ': **' + nombresChat(ga) + '** vs **' + nombresChat(gb) + '**');
            if (dato) lineas.push('💡 ' + escMd(dato));
            if (nivel === 'full' && hayApuestas(b.sv, nivel, apc, cfgs.get(b.g))) {
              apuesta = { id: codigoDe(L.id + ':' + clave).slice(0, 12), m: mv, ronda: bat.r, a: bat.lados[0], b: bat.lados[1] };
              lineas.push(lineaApuesta('abierta', apc));
            } else {
              // 🗳️ sin apuestas, «¿Quién gana?» votado por el público (ver `botonesVoto()`)
              voto = { id: codigoDe(L.id + ':' + clave + ':qg').slice(0, 12), m: mv, ronda: bat.r, a: bat.lados[0], b: bat.lados[1] };
              lineas.push(lineaVoto(voto.a, voto.b, 0, 0));
            }
            const titEv = escMd(String(nombre || L.nombre || 'el evento').replace(/^[\s_*~]+|[\s_*~]+$/g, ''));
            // 🖼️ EL VS CON LAS DOS TARJETAS (Dlx, 12/10/2026: «hacerlo más visual… las tarjetas», «B», «con datos y a
            // full»): sólo mano a mano. La imagen la dibuja `bot/kit.py` (`vsEncolar()`) y llega en un minuto: el mensaje
            // sale ya, con el texto, y la imagen se le agrega editándolo (una edición no le suena a nadie)
            // 🧩 CON EQUIPOS (2v2, 1v3, 8v1 del Multiverse) TAMBIÉN, con todas las tarjetas (19/10/2026, Dlx: «hacer algo
            // para que muestre sus tarjetas en estos formatos distintos»): `grupos`, que dibuja `html_vs_grupos()`
            const persona = (y) => personaVs(y, dc);
            const vsEq = ga.length > 1 || gb.length > 1 ? { ev: String(nombre || L.nombre || '').replace(/[_*~`]+/g, '').trim(),
              ronda: bat.r, titulo: tt ? tt.t : '', sub: tt ? tt.sub || '' : '', grupos: [ga.map(persona), gb.map(persona)] } : null;
            const vs = vsEq || (ga.length === 1 && gb.length === 1) ? vsEq || { ev: String(nombre || L.nombre || '').replace(/[_*~`]+/g, '').trim(),
              ronda: bat.r, titulo: tt ? tt.t : '', sub: tt ? tt.sub || '' : '',
              // 📊 el Score va también: la barra de quién gana de la imagen lo prefiere al OVR (`prob_vs()` de bot/kit.py)
              a: { n: ga[0].n, fl: ga[0].fl, k: ga[0].k, ovr: (dc.tabla[ga[0].k] || {}).ovr || 0, sc: (dc.tabla[ga[0].k] || {}).sc || 0, carta: ga[0].k ? dc.cartaDe(ga[0].k) : '' },
              b: { n: gb[0].n, fl: gb[0].fl, k: gb[0].k, ovr: (dc.tabla[gb[0].k] || {}).ovr || 0, sc: (dc.tabla[gb[0].k] || {}).sc || 0, carta: gb[0].k ? dc.cartaDe(gb[0].k) : '' } } : null;
            // 🧾 y lo de los costados de la imagen y el cara a cara (13/10/2026): la letra, los últimos 5 y la racha de cada
            // uno, y cuántas ganó cada uno contra el otro (`html_vs()` de bot/kit.py)
            if (vs && !vs.grupos) {
              const forma = (y) => (y.du || []).slice().sort((p, q) => Number(p[0]) - Number(q[0])).slice(-5).map((d) => (d[2] ? 'G' : 'P')).join('');
              for (const [l, y] of [[vs.a, x.a], [vs.b, x.b]]) {
                Object.assign(l, { rg: (y.f || {}).rg || '', forma: forma(y), racha: (y.rd && y.rd[0]) || 0 });
              }
              vs.h2h = [x.h2h.ga, x.h2h.gb];
            }
            ms.push(Object.assign({ m: mv, cab: '⚔️ **' + titEv + '**', texto: lineas.join('\n') }, vs ? { vs } : {}));
          }
        }
      }
      // 🎲 LA APUESTA SOLA, CON EL BOT EN UN NIVEL DE ABAJO Y LAS APUESTAS PRENDIDAS A MANO (13/10/2026, ver
      // `hayApuestas()`). En «Con datos» y «A full» va en el mensaje del cruce (arriba); acá no hay cruce, así que sale
      // un mensaje propio con la batalla que viene y sus botones. ⚠️ VA APARTE DEL PLAN DE LA CHARLA, a propósito: en
      // «normal» el plan manda sólo el último momento y como mucho uno cada 10 minutos, y la apuesta cierra a los 3 —
      // frenada, saldría con la batalla ya jugada—. Una por batalla (`v:<ronda>:<i>`, la misma clave del cruce)
      if (nivel !== 'datos' && nivel !== 'full' && fresca && pedidos < CHAT_TOPE && hayApuestas(b.sv, nivel, apc, cfgs.get(b.g))) {
        const bat = batallaChat(L);
        const mv = bat ? 'v:' + bat.r + ':' + bat.i : '';
        if (bat && bat.lados.length === 2 && !hechos[mv]) {
          const clave = bat.r + ':' + bat.lados.map(claveTurno).sort().join('|');
          const [ga, gb] = bat.lados.map((l) => genteChat(l, buscar, dc.tabla, opc.ids, opc.enSv));
          const titEv = escMd(String(nombre || L.nombre || 'el evento').replace(/^[\s_*~]+|[\s_*~]+$/g, ''));
          const texto = ['⚔️ **' + titEv + '**', '⚔️ ' + bat.r + ': **' + nombresChat(ga) + '** vs **' + nombresChat(gb) + '**',
            lineaApuesta('abierta', apc)].join('\n');
          const ap = { id: codigoDe(L.id + ':' + clave).slice(0, 12), ronda: bat.r, a: bat.lados[0], b: bat.lados[1] };
          pedidos++;
          let r = null;
          try {
            r = await fetch(`${DC}/channels/${canal}/messages`, {
              method: 'POST',
              headers: { Authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'User-Agent': UA, 'content-type': 'application/json' },
              body: JSON.stringify({ content: texto.slice(0, 1900), allowed_mentions: { parse: [] }, flags: 4,
                components: botonesApuesta(ap.id, ap.a, ap.b, false, apc.montos) }),
            });
          } catch (e) { r = null; }
          let id = '';
          if (r && r.ok) { try { id = String((await r.json()).id || ''); } catch (e) { id = ''; } }
          if (id) {
            // anotada antes que nada: así la vuelta siguiente no la manda otra vez
            this.sql.exec('INSERT OR REPLACE INTO chat_vivo (llave, canal, m, msg, texto, t) VALUES (?, ?, ?, ?, ?, ?)',
              L.id, canal, mv, id, texto, ahora);
            hechos[mv] = { m: mv, msg: id, texto };
            this.sql.exec('INSERT OR IGNORE INTO apuestas (id, canal, msg, sv, llave, ronda, a, b, texto, abre, cierra) ' +
              'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', ap.id, canal, id, b.sv || '', L.id, ap.ronda, ap.a, ap.b,
            texto.slice(0, 1900), ahora, ahora + apc.cierra);
            mandados++;
          } else {
            errores.push(b.sv + ' apuesta ' + (r ? r.status : 'red'));
          }
        }
      }
      // 🧹 MENOS DE GOLPE (Dlx, 12/10/2026, el General de Urban: «siento que eso es mucho spam… todo de golpe»):
      // en «Con datos» y «A full», (a) la final sale UNA vez —el cruce ya la anuncia con su título y su dato, y
      // «🔥 La final de…» la repetía en el mismo mensaje— y (b) el resultado de una batalla cuyo cruce ya salió se le
      // agrega a ESE mensaje, editándolo («✅ Pasan Guess y Nemi»): una edición no le suena a nadie y el chat no suma
      // otro mensaje por batalla
      if (nivel === 'datos' || nivel === 'full') {
        const finalV = ms.some((x) => /^v:final:/i.test(x.m)) || Object.keys(hechos).some((m) => /^v:final:/i.test(m));
        if (finalV && ms.some((x) => x.m === 'final') && !hechos.final) {
          this.sql.exec('INSERT OR IGNORE INTO chat_vivo (llave, canal, m, msg, texto, t) VALUES (?, ?, ?, ?, ?, ?)',
            L.id, canal, 'final', '', '', ahora);
          hechos.final = { m: 'final', msg: '', texto: '' };
        }
        const ediciones = new Map();
        for (const x of ms) {
          const v = x.bi && x.res && !hechos[x.m] ? hechos['v:' + x.bi] : null;
          if (!v || !v.msg) continue;
          const e = ediciones.get(v.msg) || { texto: v.texto || '', ms: [] };
          e.texto += '\n' + x.res;
          e.ms.push(x.m);
          for (const u of ms) if (u.de === x.m && !hechos[u.m]) e.ms.push(u.m);
          ediciones.set(v.msg, e);
        }
        for (const [msg, e] of ediciones) {
          if (pedidos >= CHAT_TOPE) break;
          pedidos++;
          let r = null;
          try {
            r = await fetch(`${DC}/channels/${canal}/messages/${msg}`, {
              method: 'PATCH',
              headers: { Authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'User-Agent': UA, 'content-type': 'application/json' },
              body: JSON.stringify({ content: e.texto.slice(0, 1900), allowed_mentions: { parse: [] } }),
            });
          } catch (err) { r = null; }
          if (!r || !r.ok) { errores.push(b.sv + ' ' + (r ? r.status : 'red')); continue; }
          editados++;
          this.sql.exec('UPDATE chat_vivo SET texto = ? WHERE canal = ? AND msg = ?', e.texto, canal, msg);
          // la apuesta de ese cruce reescribe su mensaje al cerrar: que lo haga sobre el texto con el resultado
          this.sql.exec('UPDATE apuestas SET texto = ? WHERE canal = ? AND msg = ?', e.texto.slice(0, 1900), canal, msg);
          for (const m of e.ms) {
            this.sql.exec('INSERT OR REPLACE INTO chat_vivo (llave, canal, m, msg, texto, t) VALUES (?, ?, ?, ?, ?, ?)',
              L.id, canal, m, msg, e.texto, ahora);
            hechos[m] = { m, msg, texto: e.texto };
          }
          for (const m of Object.keys(hechos)) if (hechos[m].msg === msg) hechos[m].texto = e.texto;
        }
      }
      for (const p of planChat(ms, hechos, ult, ahora, fresca, nivel, entre)) {
        if (p.tipo === 'saltar') {
          this.sql.exec('INSERT OR IGNORE INTO chat_vivo (llave, canal, m, msg, texto, t) VALUES (?, ?, ?, ?, ?, ?)',
            L.id, canal, p.m, '', '', ahora);
          continue;
        }
        if (pedidos >= CHAT_TOPE) break;
        pedidos++;
        // 🎲 la apuesta va en el mensaje que lleva su cruce, con sus botones
        const conAp = apuesta && p.tipo === 'mandar' && [].concat(p.m).includes(apuesta.m) ? apuesta : null;
        const conVoto = !conAp && voto && p.tipo === 'mandar' && [].concat(p.m).includes(voto.m) ? voto : null;
        // 🃏 y debajo, «Conseguí tu tarjeta» si alguno sale con la silueta. Sólo al mandar: una edición sin `components`
        // deja los botones que el mensaje ya tiene
        const filaT = p.tipo === 'mandar' ? filaTarjeta(p.vs) : [];
        let r = null;
        try {
          r = await fetch(`${DC}/channels/${canal}/messages` + (p.tipo === 'editar' ? '/' + p.msg : ''), {
            method: p.tipo === 'editar' ? 'PATCH' : 'POST',
            headers: { Authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'User-Agent': UA, 'content-type': 'application/json' },
            // 🛑 nunca menciona a nadie, y sin la vista previa del link. 🏆 Con imagen (la tarjeta del campeón) va como
            // adjunto del mensaje, y sin el freno de las vistas previas, que también la escondería: los links van entre <>
            // ⚠️ una EDICIÓN no manda `flags`: el mensaje se queda con las suyas (con `flags: 4` se escondía la imagen)
            body: JSON.stringify(Object.assign({ content: p.texto.slice(0, 1900), allowed_mentions: { parse: [] } },
              p.tipo === 'editar' ? {} : p.img ? { embeds: [{ image: { url: p.img }, color: 0xE41373 }] } : { flags: 4 },
              conAp || conVoto || filaT.length ? { components: (conAp ? botonesApuesta(conAp.id, conAp.a, conAp.b, false, apc.montos)
                : conVoto ? botonesVoto(conVoto.id, conVoto.a, conVoto.b, conVoto.mas || []) : []).concat(filaT) } : {})),
          });
        } catch (e) { r = null; }
        if (r && r.ok) {
          if (p.tipo === 'editar') {
            this.sql.exec('UPDATE chat_vivo SET texto = ? WHERE llave = ? AND canal = ? AND m = ?', p.texto, L.id, canal, p.m);
            editados++;
            continue;
          }
          let id = '';
          try { id = String((await r.json()).id || ''); } catch (e) { id = ''; }
          // en «cada batalla» un mensaje lleva varios momentos: cada uno queda anotado con ese mensaje
          for (const m of [].concat(p.m)) {
            this.sql.exec('INSERT OR REPLACE INTO chat_vivo (llave, canal, m, msg, texto, t) VALUES (?, ?, ?, ?, ?, ?)',
              L.id, canal, m, id, p.texto, ahora);
          }
          // 🖼️ el vs: a la cola de las imágenes, con el mensaje donde va (ver `vsEncolar()`)
          if (p.vs && id) {
            try { this.vsEncolar(Object.assign({}, p.vs, { sv: b.sv || '', canal, msg: id }), ahora); } catch (e) { /* sin imagen */ }
          }
          if (conVoto && id) {
            this.sql.exec('INSERT OR IGNORE INTO qg (id, canal, msg, sv, llave, ronda, a, b, dicho, abre, mas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              conVoto.id, canal, id, b.sv || '', L.id, conVoto.ronda, conVoto.a, conVoto.b,
              lineaVoto(conVoto.a, conVoto.b, 0, 0, '', conVoto.mas || [], []), ahora, JSON.stringify(conVoto.mas || []));
          }
          if (conAp && id) {
            this.sql.exec('INSERT OR IGNORE INTO apuestas (id, canal, msg, sv, llave, ronda, a, b, texto, abre, cierra) ' +
              'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', conAp.id, canal, id, b.sv || '', L.id, conAp.ronda, conAp.a, conAp.b,
            p.texto.slice(0, 1900), ahora, ahora + apc.cierra);
          }
          mandados++;
          break;
        }
        errores.push(b.sv + ' ' + (r ? r.status : 'red'));
        if (p.tipo === 'mandar') {
          let ra = 0;
          if (r && r.status === 429) { try { ra = Number((await r.json()).retry_after) || 0; } catch (e) { ra = 0; } }
          const espera = pausaChat(r ? r.status : 0, ra);
          if (espera) this.guardar('chat_pausa:' + canal, ahora + espera);
        }
        // un mensaje que ya no está (lo borraron): no se vuelve a editar
        else if (r && r.status === 404) {
          this.sql.exec("UPDATE chat_vivo SET msg = '' WHERE llave = ? AND canal = ? AND m = ?", L.id, canal, p.m);
        }
      }
    }
    if (pedidos) this.guardar('chat_vivo', { t: ahora, mandados, editados, errores: errores.slice(0, 5) });
    // 🎲 y las apuestas: cerrar, pagar o devolver (ver `apuestasRevisar()`)
    try { await this.apuestasRevisar(ahora, llaves); } catch (e) { this.guardar('apuestas', { t: ahora, error: String(e).slice(0, 160) }); }
    // 🗳️ y los votos de «¿Quién gana?»: cómo va y, con el resultado, si el público acertó (ver `qgRevisar()`)
    try { await this.qgRevisar(ahora, llaves); } catch (e) { this.guardar('qg', { t: ahora, error: String(e).slice(0, 160) }); }
    if (cambio) {
      for (const [k, v] of Object.entries(nombres)) if (ahora - (v.t || 0) > 12 * HORA) delete nombres[k];
      this.guardar('nombres_vivo', nombres);
    }
    return pedidos;
  }

  /** Los veredictos de los servidores con un evento en juego. Ver `PATRON_VEREDICTOS`. */
  async veredictos(ahora) {
    const lista = (this.leer('canales') || {}).veredictos || [];
    if (!lista.length) return;
    const vivos = svsEnVivo(this.sql.exec('SELECT cuerpo FROM avisos WHERE estado != 2 AND creado > ?',
      ahora - 2 * 24 * HORA).toArray().map((r) => r.cuerpo), ahora);
    // también el servidor que tiene una llave que se está tocando
    for (const r of this.sql.exec('SELECT DISTINCT sv FROM vivo WHERE ed > ?', ahora - 3 * HORA).toArray()) {
      if (r.sv) vivos.add(r.sv);
    }
    const calientes = new Set(this.sql.exec('SELECT DISTINCT canal FROM veredictos WHERE pub > ?',
      ahora - 30 * MIN).toArray().map((r) => r.canal));
    const leer = veredictosALeer(lista, vivos, calientes, Math.floor(ahora / MIN));
    let nuevos = 0;
    if (leer.length) {
      const rs = await Promise.all(leer.map(async (c) => {
        try {
          const r = await fetch(`${DC}/channels/${c.id}/messages?limit=25`, {
            headers: { Authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'User-Agent': UA },
          });
          return { c, msgs: r.status === 200 ? await r.json() : null };
        } catch (e) {
          return { c, msgs: null };
        }
      }));
      for (const { c, msgs } of rs) {
        for (const m of msgs || []) {
          const pub = Date.parse(String(m.timestamp || '').slice(0, 19) + 'Z');
          const ed = m.edited_timestamp ? Date.parse(String(m.edited_timestamp).slice(0, 19) + 'Z') : pub;
          if (Number.isNaN(pub) || ahora - pub > VIVO_HORAS * HORA) continue;
          const texto = conNombres(m).slice(0, 400);
          // 🗳️ cada versión, entera y para siempre (ver `veredictos_hist`)
          this.sql.exec('INSERT OR IGNORE INTO veredictos_hist (id, canal, sv, autor, pub, ed, texto, visto) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?)', m.id, c.id, c.sv || '', (m.author && m.author.id) || '', pub,
          Math.max(pub, ed || 0), conNombres(m).slice(0, 4000), ahora);
          const fila = this.sql.exec('SELECT texto FROM veredictos WHERE id = ?', m.id).toArray()[0];
          if (fila && fila.texto === texto) continue;
          this.sql.exec('INSERT INTO veredictos (id, canal, sv, g, autor, pub, ed, texto) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET ed = excluded.ed, ' +
            'texto = excluded.texto', m.id, c.id, c.sv || '', c.g || '',
          (m.author && m.author.id) || '', pub, Math.max(pub, ed || 0), texto);
          nuevos++;
        }
      }
    }
    this.sql.exec('DELETE FROM veredictos WHERE pub < ?', ahora - 12 * HORA);
    this.guardar('veredictos', { t: ahora, canales: leer.length, vivos: [...vivos], cambiaron: nuevos });
  }

  /**
   * Quién se anota: los canales de inscripciones de los servidores con un
   * evento anunciado o en juego, cada minuto. Ver `INSC_ANTES`.
   * ⚠️ SE GUARDA LO QUE DESPUÉS SE BORRA: esa es la gracia. Un mensaje editado
   * se actualiza; uno borrado se queda.
   */
  async inscripciones(ahora) {
    const lista = (this.leer('canales') || {}).inscripciones || [];
    if (!lista.length) return;
    const svs = svsInscribiendo(this.sql.exec('SELECT cuerpo FROM avisos WHERE estado != 2 AND creado > ?',
      ahora - 2 * 24 * HORA).toArray().map((r) => r.cuerpo), ahora);
    // también el servidor que tiene una llave que se está tocando
    for (const r of this.sql.exec('SELECT DISTINCT sv FROM vivo WHERE ed > ?', ahora - 3 * HORA).toArray()) {
      if (r.sv) svs.add(r.sv);
    }
    const leer = lista.filter((c) => svs.has(c.sv)).slice(0, INSC_TOPE);
    let nuevos = 0;
    if (leer.length) {
      const rs = await Promise.all(leer.map(async (c) => {
        try {
          const r = await fetch(`${DC}/channels/${c.id}/messages?limit=50`, {
            headers: { Authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'User-Agent': UA },
          });
          return { c, msgs: r.status === 200 ? await r.json() : null };
        } catch (e) {
          return { c, msgs: null };
        }
      }));
      for (const { c, msgs } of rs) {
        for (const m of msgs || []) {
          if (m.author && m.author.bot) continue;
          const pub = Date.parse(String(m.timestamp || '').slice(0, 19) + 'Z');
          const ed = m.edited_timestamp ? Date.parse(String(m.edited_timestamp).slice(0, 19) + 'Z') : pub;
          if (Number.isNaN(pub) || ahora - pub > INSC_GUARDA) continue;
          const texto = String(m.content || '').slice(0, 200);
          const fila = this.sql.exec('SELECT texto FROM inscritos WHERE id = ?', m.id).toArray()[0];
          if (fila && fila.texto === texto) continue;
          this.sql.exec('INSERT INTO inscritos (id, canal, nombre, sv, autor_id, autor, pub, ed, texto) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET ed = excluded.ed, ' +
            'texto = excluded.texto', m.id, c.id, c.nombre || '', c.sv || '',
          (m.author && m.author.id) || '', (m.author && m.author.username) || '', pub,
          Math.max(pub, ed || 0), texto);
          nuevos++;
        }
      }
    }
    this.sql.exec('DELETE FROM inscritos WHERE pub < ?', ahora - INSC_GUARDA);
    this.guardar('inscritos', { t: ahora, canales: leer.length, svs: [...svs], cambiaron: nuevos });
  }

  /** Para `/avisos/inscritos` (sólo el ciclo): lo que se anotó en los últimos días. */
  inscritosLista() {
    return { t: Date.now(), inscritos: this.sql.exec('SELECT id, canal, nombre, sv, autor_id, autor, pub, ed, ' +
      'texto FROM inscritos ORDER BY pub DESC LIMIT 2000').toArray() };
  }

  /** Los eventos que el vigía vio anunciar en el último día (ver `anuncios` en `vivo()`): para la página y para saber
   *  de qué anuncio es cada llave en vivo (`chatVivo()`). */
  /**
   * 📢 Un mensaje que no es un anuncio ni una llave y dice que el evento se canceló, se pausa o se atrasa
   * (`estadoDeMensaje()`), anotado con su evento: el que el mensaje nombra o, si no nombra a ninguno, el último que ese
   * servidor anunció ANTES del mensaje (36 h). El mismo texto no se vuelve a escribir: el canal de llaves se relee cada
   * minuto. Lo usan la página (`estados` de `vivo()`), `cancelaciones()` y el ciclo (`llaves_a_entrada.estados_vigia()`).
   */
  anotarEstado(m, c, ahora) {
    if (!m || !c || !c.sv || (this.yo && m.author && m.author.id === this.yo)) return false;
    const pub = Date.parse(String(m.timestamp || '').slice(0, 19) + 'Z');
    if (Number.isNaN(pub) || ahora - pub > 36 * HORA || !PISTA_ESTADO.test(String(m.content || ''))) return false;
    const e = estadoDeMensaje(m.content || '', pub);
    if (!e) return false;
    const texto = conNombres(m).slice(0, 300);
    const ya = this.sql.exec('SELECT texto FROM estados WHERE id = ?', m.id).toArray()[0];
    if (ya && ya.texto === texto) return false;
    const msDe = (id) => { try { return Number((BigInt(id) >> 22n) + 1420070400000n); } catch (err) { return 0; } };
    const plano = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const evs = this.anunciosVistos(ahora, 36, 40).filter((a) => a.sv === c.sv && /^\d+$/.test(a.id) && msDe(a.id) <= pub + MIN);
    const tp = ' ' + plano(m.content) + ' ';
    const ev = evs.find((a) => plano(a.n).length >= 4 && tp.includes(' ' + plano(a.n) + ' '))
      || evs.sort((x, y) => msDe(y.id) - msDe(x.id))[0] || null;
    this.sql.exec('INSERT OR REPLACE INTO estados (id, sv, tipo, nueva, mas, texto, pub, evento, t) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      m.id, c.sv, e.tipo, e.nueva || 0, e.mas || 0, texto, pub, ev ? ev.id : '', ahora);
    // 🔔 Y A QUIEN LE LLEGÓ EL AVISO DE ESE EVENTO, que se pausó o se atrasó (Dlx, 07/10/2026, las mejoras: «dale, haz
    // todo»). Como el «cancelado» de `cancelaciones()`: sólo a quien ya le había llegado (`hs`), con el mismo `tag` —en
    // el teléfono reemplaza al del evento— y una vez por evento y por tipo. El cancelado ya va por `cancelaciones()`
    if (ev && (e.tipo === 'pausado' || e.tipo === 'atrasado')) {
      const f = this.sql.exec('SELECT sv, cuerpo, estado, cursor FROM avisos WHERE id = ?', ev.id).toArray()[0];
      let cu = null;
      try { cu = f ? JSON.parse(f.cuerpo) : null; } catch (err) { cu = null; }
      if (f && cu && (f.estado === 1 || f.cursor)) {
        const nueva = e.nueva || (e.mas && cu.ini ? cu.ini + e.mas : 0);
        const x = { v: 1, tipo: 'estado', est: e.tipo, id: cu.id, t: cu.t, sv: cu.sv, svn: cu.svn, ini: cu.ini, nueva,
          url: HUB_EVENTOS, hs: f.cursor || 0 };
        this.sql.exec('INSERT OR IGNORE INTO avisos (id, sv, cuerpo, desde, hasta, creado) VALUES (?, ?, ?, ?, ?, ?)',
          'es:' + ev.id + ':' + e.tipo, f.sv, JSON.stringify(x), ahora, ahora + 2 * HORA, ahora);
      }
    }
    return true;
  }

  /**
   * 🧩 Una llave que el lector no sabe leer (`intentoDeLlave()` y menos de dos batallas con `LlaveVivo`), avisada UNA
   * vez al canal de Logs con su link. Cada versión de un mensaje se mira una sola vez —el canal se relee cada minuto— y
   * nunca frena al vigía.
   */
  async llaveRara(m, c, texto, ahora) {
    if (!m || !c || (this.yo && m.author && m.author.id === this.yo)) return false;
    const vistos = (this.rarasVistas = this.rarasVistas || new Map());
    const firma = String(m.edited_timestamp || m.timestamp || '') + ':' + texto.length;
    if (vistos.get(m.id) === firma) return false;
    if (vistos.size > 500) vistos.clear();
    vistos.set(m.id, firma);
    if (!intentoDeLlave(texto)) return false;
    if (this.sql.exec('SELECT 1 FROM llaves_raras WHERE id = ?', m.id).toArray().length) return false;
    if (!globalThis.LlaveVivo) await import('./llave_vivo.js');
    const LV = globalThis.LlaveVivo;
    let bats = 0;
    try { bats = LV.rondasDe(LV.traducir(LV.plano(texto))).reduce((n, R) => n + ((R && R[1]) || []).length, 0); } catch (e) { bats = 0; }
    if (bats >= 2) return false;
    this.sql.exec('INSERT OR IGNORE INTO llaves_raras (id, sv, t) VALUES (?, ?, ?)', m.id, c.sv || '', ahora);
    const link = `https://discord.com/channels/${c.g || '@me'}/${c.id}/${m.id}`;
    try {
      const r = await fetch(`${DC}/channels/${CANAL_LOGS}/messages`, {
        method: 'POST',
        headers: { Authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'User-Agent': UA, 'content-type': 'application/json' },
        body: JSON.stringify({
          content: `🧩 **No pude leer una llave de ${c.svn || c.sv || 'un servidor'}**: tiene rondas y nombres, pero no le ` +
            'saco ninguna batalla. Si es una llave de verdad, el bot no la ve en vivo ni la va a cargar: pasale el ' +
            `formato a Claude.\n<${link}>`,
          allowed_mentions: { parse: [] },
        }),
      });
      if (r.status !== 200) this.guardar('ultimo_error', { t: ahora, ruta: 'llave-rara', error: 'mensaje ' + r.status });
    } catch (e) {
      this.guardar('ultimo_error', { t: ahora, ruta: 'llave-rara', error: String(e).slice(0, 120) });
    }
    return true;
  }

  /**
   * 🔥 Lo que hace falta para el título y el dato de un cruce: la tabla del lobby por clave, los perfiles (los duelos de
   * cada uno) y `buscar(nombre de llave)` → clave, por la tabla y los alias. Diez minutos en la memoria del objeto: son
   * los dos JSON más grandes de KV y se piden sólo cuando hay un cruce que anunciar.
   */
  /** 👥 La crew de alguien para el chat en vivo: `{n, tier}` (su tier, del payload), o `null`. */
  crewChat(k, tiers) {
    if (!k) return null;
    try {
      const r = this.sql.exec('SELECT c.id, c.nombre FROM crew_miembros m JOIN crews c ON c.id = m.crew WHERE m.k = ?', k).toArray()[0];
      if (!r) return null;
      const t = tiers && tiers.crews && tiers.crews[r.id] && tiers.nombres ? tiers.nombres[tiers.crews[r.id][0]] : '';
      return { n: r.nombre, tier: t || '' };
    } catch (e) { return null; }
  }

  async datosCruce(ahora) {
    if (this.cruceMem && ahora - this.cruceMem.t < 10 * MIN) return this.cruceMem;
    let lobby = {}, perf = {}, perfT = 0;
    try { lobby = JSON.parse((await this.env.KV.get('web:lobby')) || '{}') || {}; } catch (e) { lobby = {}; }
    try {
      const pj = JSON.parse((await this.env.KV.get('web:perfiles')) || '{}') || {};
      perf = pj.p || {};
      perfT = Date.parse(String(pj.sello || '')) || 0;
    } catch (e) { perf = {}; }
    const tabla = {}, por = {};
    for (const f of lobby.tabla || []) {
      if (f && f.k) { tabla[f.k] = f; por[claveTurno(f.n)] = f.k; }
    }
    const alias = lobby.alias || {};
    const buscar = (n) => { const c = claveTurno(n); return por[c] || alias[c] || (perf[c] ? c : '') || ''; };
    // 🃏 la tarjeta de alguien para el chat: la de Temporada, o la que tenga (`Liga.cartaUrl()` de la página)
    const r2 = String(lobby.r2 || ''), cartas = lobby.cartas || [];
    const cartaDe = (k) => {
      const f = tabla[k];
      const cual = f && ['temporada', 'competitivo', 'servidor'].find((c) => (f.c || []).includes(c));
      if (!cual || !/^https:\/\//.test(r2)) return '';
      const i = cartas.indexOf(cual);
      const v = typeof f.cv === 'string' && i >= 0 ? f.cv.split('.')[i] : '';
      return r2 + '/' + encodeURIComponent(k) + '/' + cual + '.webp' + (v ? '?v=' + v : '');
    };
    // 🏆 los tiers de las crews (bot/crews_tiers.py, en el payload): para decir «la crew X, que está en Oro»
    this.cruceMem = { t: ahora, tabla, perf, perfT, buscar, cartaDe, tiers: lobby.crews_tiers || null };
    return this.cruceMem;
  }

  /**
   * 🎲 UNA APUESTA, desde el botón (`ap:<id>:<lado>:<monto>`, ver `worker.js`). Lo valida todo acá —el objeto es uno solo,
   * así que dos clics a la vez no gastan la misma plata—: que esté abierta, el monto (50 a 500 en total, de un solo lado),
   * el saldo y que no sea su propia batalla (`clave`, de su cuenta). Se anota en `apostado` y se descuenta en `tienda`.
   */
  /**
   * 🗳️ Un voto de «¿Quién gana?», desde el botón del chat (`worker.js`, firmado por Discord): uno por persona y cruce, que
   * se puede cambiar mientras esté abierto. Devuelve cómo va, para contestarle sólo a quien votó.
   */
  qgVotar(d, ahora = Date.now()) {
    const quien = String(d.quien || '');
    const q = this.sql.exec('SELECT * FROM qg WHERE id = ?', String(d.id || '')).toArray()[0];
    let mas = [];
    try { mas = JSON.parse((q && q.mas) || '[]') || []; } catch (e) { mas = []; }
    // 🧮 los lados de ESTE voto: dos, o los de un «todos contra todos»
    const lados = q ? [q.a, q.b].concat(mas) : [];
    const i = LADOS_VOTO.indexOf(String(d.lado || ''));
    const lado = i >= 0 && i < Math.max(2, lados.length) ? LADOS_VOTO[i] : '';
    if (!/^[0-9]{5,25}$/.test(quien) || !lado) return { error: 'datos' };
    if (!q) return { error: 'no existe' };
    if (q.estado !== 'abierta') return { error: 'cerrada' };
    const antes = this.sql.exec('SELECT lado FROM qg_voto WHERE id = ? AND quien = ?', q.id, quien).toArray()[0];
    this.sql.exec('INSERT OR REPLACE INTO qg_voto (id, quien, lado, t) VALUES (?, ?, ?, ?)', q.id, quien, lado, ahora);
    this.xpVio(quien, 'qg', q.id, ahora);
    const cuenta = {};
    for (const r of this.sql.exec('SELECT lado, COUNT(*) AS n FROM qg_voto WHERE id = ? GROUP BY lado', q.id).toArray()) cuenta[r.lado] = Number(r.n) || 0;
    const na = cuenta.A || 0, nb = cuenta.B || 0;
    const nmas = mas.map((_, j) => cuenta[LADOS_VOTO[j + 2]] || 0);
    this.sql.exec('UPDATE qg SET na = ?, nb = ?, nmas = ? WHERE id = ?', na, nb, JSON.stringify(nmas), q.id);
    const n = na + nb + nmas.reduce((x, y) => x + y, 0);
    const mio = [na, nb].concat(nmas)[i] || 0;
    return { ok: true, lado, nombre: sinBandera(lados[i] || ''), cambio: !!(antes && antes.lado !== lado), na, nb, nmas, n,
      pct: n ? Math.round((100 * mio) / n) : 0 };
  }

  /**
   * 🗳️ Los votos abiertos, cada minuto (después de la charla del bot en vivo): el renglón con cómo va, sólo si cambió; y
   * cuando la llave dice quién pasó —o a los `QG_VENCE`— el cierre, con si el público acertó y sin los botones. El texto
   * sale de `chat_vivo`, que es donde la charla anota lo que agrega al mensaje («✅ Pasan…»), y se guarda ahí: así
   * ninguna de las dos borra lo de la otra. Como mucho `QG_TOPE` ediciones por vuelta.
   */
  async qgRevisar(ahora, llaves) {
    const abiertos = this.sql.exec("SELECT * FROM qg WHERE estado = 'abierta' ORDER BY abre LIMIT 20").toArray();
    let n = 0;
    for (const q of abiertos) {
      if (n >= QG_TOPE) break;
      const L = llaves.get(q.llave);
      let mas = [], nmas = [];
      try { mas = JSON.parse(q.mas || '[]') || []; nmas = JSON.parse(q.nmas || '[]') || []; } catch (e) { mas = []; nmas = []; }
      let g = L ? ladoGanador(L, q.ronda, q.a, q.b, mas) : '';
      if (!g && ahora - q.abre > QG_VENCE) g = 'x';
      // 🗳️ al cerrarse, a quién votó el público (una vez por cruce: la clave es el id)
      if (g) {
        const fav = favoritoDe(q.a, q.b, q.na, q.nb, mas, nmas);
        if (fav) {
          this.sql.exec('INSERT OR IGNORE INTO qg_fav (id, n, temporada, t) VALUES (?, ?, ?, ?)', q.id, fav,
            String(this.env.TEMPORADA || 't1'), ahora);
        }
      }
      const linea = lineaVoto(q.a, q.b, q.na, q.nb, g, mas, nmas);
      if (!g && linea === q.dicho) continue;
      const h = this.sql.exec('SELECT texto FROM chat_vivo WHERE canal = ? AND msg = ? ORDER BY t DESC LIMIT 1', q.canal, q.msg).toArray()[0];
      // ⚠️ sin el texto del mensaje no se edita: se pisaría todo con el renglón solo
      if (!h || !h.texto) {
        if (g) this.sql.exec("UPDATE qg SET estado = 'cerrada' WHERE id = ?", q.id);
        continue;
      }
      const texto = conLineaVoto(h.texto, linea);
      n++;
      let r = null;
      try {
        r = await fetch(`${DC}/channels/${q.canal}/messages/${q.msg}`, {
          method: 'PATCH',
          headers: { Authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'User-Agent': UA, 'content-type': 'application/json' },
          body: JSON.stringify(Object.assign({ content: texto.slice(0, 1900), allowed_mentions: { parse: [] } },
            g ? { components: this.filaTarjetaDe(q.canal, q.msg) } : {})),
        });
      } catch (e) { r = null; }
      if (r && r.ok) {
        this.sql.exec('UPDATE chat_vivo SET texto = ? WHERE canal = ? AND msg = ?', texto, q.canal, q.msg);
        this.sql.exec('UPDATE qg SET dicho = ?, estado = ? WHERE id = ?', linea, g ? 'cerrada' : 'abierta', q.id);
      } else if (r && r.status === 404) {
        this.sql.exec("UPDATE qg SET estado = 'borrada' WHERE id = ?", q.id);
      }
    }
    this.sql.exec("DELETE FROM qg_voto WHERE id IN (SELECT id FROM qg WHERE estado != 'abierta' AND abre < ?)", ahora - 7 * DIA_MS);
    this.sql.exec("DELETE FROM qg WHERE estado != 'abierta' AND abre < ?", ahora - 7 * DIA_MS);
    return n;
  }

  apostar(d, ahora = Date.now()) {
    // `ahora` sólo lo pasan las pruebas
    const quien = String(d.quien || '');
    const lado = d.lado === 'A' || d.lado === 'B' ? d.lado : '';
    const m = Number(d.monto);
    const apc = apuestasCfg(this.ajustes());
    // ⚠️ también los montos de siempre: un mensaje de antes de cambiar el ajuste sigue con sus botones
    if (!/^[0-9]{5,25}$/.test(quien) || !lado || !(apc.montos.includes(m) || AP_MONTOS.includes(m))
        || !Number.isInteger(Number(d.inicial))) {
      return json({ error: 'datos' }, 400);
    }
    const ap = this.sql.exec('SELECT * FROM apuestas WHERE id = ?', String(d.ap || '')).toArray()[0];
    if (!ap) return json({ error: 'no existe' }, 404);
    if (ap.estado !== 'abierta' || ahora >= ap.cierra) return json({ error: 'cerrada' }, 409);
    const yo = claveTurno(d.clave || '');
    if (yo && [ap.a, ap.b].some((n) => String(n).split(/\s*[,+&]\s*/).some((x) => claveTurno(x) === yo))) {
      return json({ error: 'propia' }, 409);
    }
    const ya = this.sql.exec('SELECT lado, monto FROM apostado WHERE ap = ? AND quien = ?', ap.id, quien).toArray()[0];
    if (ya && ya.lado !== lado) return json({ error: 'otro lado', lado: ya.lado, nombre: sinBandera(ya.lado === 'A' ? ap.a : ap.b) }, 409);
    const antes = ya ? ya.monto : 0;
    if (antes + m > apc.tope) return json({ error: 'tope', queda: Math.max(0, apc.tope - antes), tope: apc.tope }, 409);
    const s = this.saldo(quien, Number(d.desde) || 0, Number(d.inicial));
    if (m > s) return json({ error: 'saldo', saldo: s }, 409);
    this.state.storage.transactionSync(() => {
      this.sql.exec('INSERT OR REPLACE INTO apostado (ap, quien, lado, monto, t) VALUES (?, ?, ?, ?, ?)', ap.id, quien, lado, antes + m, ahora);
      this.xpVio(quien, 'apuesta', ap.id, ahora);
      this.sql.exec('INSERT OR REPLACE INTO tienda (id, ref, quien, monto, t) VALUES (?, 0, ?, ?, ?)', 'ap:' + ap.id + ':' + quien,
        quien, -(antes + m), ahora);
    });
    const pozo = this.sql.exec('SELECT COALESCE(SUM(monto), 0) AS n, COUNT(*) AS c FROM apostado WHERE ap = ?', ap.id).toArray()[0];
    return json({ ok: true, lado, nombre: sinBandera(lado === 'A' ? ap.a : ap.b), monto: m, total: antes + m, saldo: s - m,
      pozo: pozo.n, cuantos: pozo.c, cierra: ap.cierra });
  }

  /**
   * 🎲 Las apuestas vivas, cada minuto: a los 3 minutos se cierran (botones grises, con el pozo); cuando la llave dice
   * quién ganó, se paga el pozo (`repartoPozo()`) y el mensaje lo dice; sin resultado en horas, se devuelve todo. Se edita
   * el MISMO mensaje: Discord no notifica una edición. `llaves` son las de `chatVivo()`, por id.
   */
  async apuestasRevisar(ahora, llaves) {
    const vivas = this.sql.exec("SELECT * FROM apuestas WHERE estado IN ('abierta', 'cerrada') ORDER BY abre LIMIT 20").toArray();
    let pedidos = 0;
    for (const ap of vivas) {
      if (pedidos >= 3) break;
      const L = llaves.get(ap.llave);
      const g = L ? ladoGanador(L, ap.ronda, ap.a, ap.b) : '';
      let estado = '', d = {};
      const vence = ahora - ap.abre > (L ? 8 : 6) * HORA;
      if (g || vence) {
        const filas = this.sql.exec('SELECT quien, lado, monto FROM apostado WHERE ap = ?', ap.id).toArray();
        const r = repartoPozo(filas.map((x) => [x.quien, x.lado, x.monto]), g);
        estado = r.devuelto ? 'devuelta' : 'pagada';
        this.state.storage.transactionSync(() => {
          for (const [q, m] of Object.entries(r.out)) {
            this.sql.exec('INSERT OR REPLACE INTO tienda (id, ref, quien, monto, t) VALUES (?, 0, ?, ?, ?)',
              'ap:' + ap.id + ':' + q + ':pago', q, m, ahora);
          }
          this.sql.exec('UPDATE apuestas SET estado = ?, ganador = ? WHERE id = ?', estado, g, ap.id);
        });
        d = { pozo: r.total, cuantos: Object.keys(r.out).length, ganador: sinBandera(g === 'A' ? ap.a : ap.b),
          porque: !g ? 'Sin resultado' : !filas.length ? 'Nadie apostó' : 'Nadie acertó' };
      } else if (ap.estado === 'abierta' && ahora >= ap.cierra) {
        this.sql.exec("UPDATE apuestas SET estado = 'cerrada' WHERE id = ?", ap.id);
        const s = this.sql.exec('SELECT COALESCE(SUM(monto), 0) AS n, COUNT(*) AS c FROM apostado WHERE ap = ?', ap.id).toArray()[0];
        estado = 'cerrada';
        d = { pozo: s.n, cuantos: s.c };
      }
      if (!estado || !ap.msg) continue;
      pedidos++;
      const texto = String(ap.texto || '').replace(/^🎲.*$/mu, lineaApuesta(estado, d));
      try {
        const r = await fetch(`${DC}/channels/${ap.canal}/messages/${ap.msg}`, {
          method: 'PATCH',
          headers: { Authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'User-Agent': UA, 'content-type': 'application/json' },
          body: JSON.stringify({ content: texto.slice(0, 1900), allowed_mentions: { parse: [] },
            components: (estado === 'cerrada' ? botonesApuesta(ap.id, ap.a, ap.b, true, apuestasCfg(this.ajustes()).montos) : [])
              .concat(this.filaTarjetaDe(ap.canal, ap.msg)) }),
        });
        if (r.ok) this.sql.exec('UPDATE apuestas SET texto = ? WHERE id = ?', texto, ap.id);
      } catch (e) { /* el estado ya quedó anotado: el mensaje se corrige solo la próxima vez que cambie */ }
    }
    return pedidos;
  }

  /**
   * 📝 QUIÉNES SE ANOTAN, mientras no hay llave (Dlx, 07/10/2026: «en cada batalla o incluso en fase de
   * inscripciones»). Sólo en «Con datos» y «A full», en el canal del bot en vivo de ese servidor: UN mensaje por evento,
   * desde tres anotados, que se edita a medida que se suman más —Discord no notifica una edición— y hasta media hora
   * después de la hora. Los anotados son los que ya cuenta la página (`anotados`): con su bandera o con un nombre que la
   * Liga conoce, no la charla del canal.
   */
  /**
   * 💬 EL CHAT DE CADA SERVIDOR, el mismo donde habla el bot en vivo (la regla de `chatVivo()`): `{SV: canal}`, sólo los
   * que lo tienen prendido. Lo pide el ciclo para el aviso de cada evento: Dlx, 07/10/2026, el aviso va al «chat del
   * servidor» y sale de LIGA GLOBAL, que está en «registros» («Sacarlo de ahí»). Un servidor sin el bot en vivo prendido
   * no está, y su aviso no se manda: se prende desde el Dashboard o con /settings.
   */
  /**
   * 🏆 EL CIERRE Y EL AVISO DEL CICLO, EN UN MENSAJE (ver `cierreDelCiclo()`). `d` = `{canal, ids, msg?}`, con `ids` los
   * mensajes de la llave (sus links, en `datos/llaves_links.json`; el primero es `L.id`). Sin `msg`: `{msg}` del cierre
   * que el bot en vivo ya mandó en ese canal, o `{}`, y el ciclo le agrega su embed editándolo. Con `msg`: el ciclo mandó
   * el suyo primero y queda anotado como el «campeon» de la llave, sin texto, para que el cierre se le sume.
   * ⚠️ `INSERT OR IGNORE`: si el bot en vivo ya decidió algo con el campeón (lo mandó o lo salteó), eso se queda.
   */
  cierreVivo(d) {
    const id = (x) => /^\d{1,25}$/.test(String(x || ''));
    const canal = String(d.canal || '');
    const ids = [].concat(d.ids || []).map(String).filter(id).slice(0, 10);
    if (!id(canal) || !ids.length) return { error: 'faltan el canal o la llave' };
    if (d.msg !== undefined) {
      if (!id(d.msg)) return { error: 'msg' };
      const ahora = Date.now();
      for (const l of ids) {
        this.sql.exec("INSERT OR IGNORE INTO chat_vivo (llave, canal, m, msg, texto, t) VALUES (?, ?, 'campeon', ?, '', ?)",
          l, canal, String(d.msg), ahora);
      }
      return { ok: true };
    }
    // 🏆 el del mismo mensaje, o el más cercano (`campeonCerca()`): cada lado puede anotar la llave con otro mensaje
    const r = campeonCerca(this.sql.exec("SELECT llave, msg, texto FROM chat_vivo WHERE canal = ? AND m = 'campeon' " +
      "AND msg != '' AND texto != ''", canal).toArray(), ids);
    return r ? { msg: String(r.msg) } : {};
  }

  async canalesChat() {
    const aj = this.ajustes();
    const dash = (aj.en_vivo && typeof aj.en_vivo === 'object') ? aj.en_vivo : {};
    const C = this.leer('canales') || {};
    const gen = new Map((C.generales || []).map((x) => [x.g, x.id]));
    // de qué guild es cada servidor: lo dicen todas las listas de canales que el vigía ya conoce
    const guild = new Map();
    for (const x of [].concat(C.generales || [], C.lista || [], C.inscripciones || [], C.veredictos || [])) {
      if (x && x.sv && x.g && !guild.has(x.sv)) guild.set(x.sv, x.g);
    }
    // 🎛️ EL AVISO POR SERVIDOR, DESDE EL DASHBOARD (Dlx, 07/10/2026: «Aviso de cada evento»): `no` lo apaga, `chat` lo
    // manda al chat de ese servidor aunque el bot en vivo esté apagado, y sin nada va donde habla el bot en vivo. El que
    // no tiene a dónde va a `resto` —el chat general de ESE servidor—, si Dlx eligió uno
    const av = (aj.aviso_evento && typeof aj.aviso_evento === 'object') ? aj.aviso_evento : {};
    const porSv = av.sv || {};
    const resto = av.resto && guild.has(av.resto) ? String(gen.get(guild.get(av.resto)) || '') : '';
    const out = {};
    for (const [sv, g] of guild) {
      let c = {};
      try { c = JSON.parse((await this.env.KV.get('cfg:' + g, { cacheTtl: 300 })) || '{}') || {}; } catch (e) { c = {}; }
      // ⚙️ y lo que eligió el dueño desde su panel (`aviso_evento` en `cfg:<guild>`, 19/10/2026), si Dlx no fijó nada
      const eleccion = porSv[sv] || ((c.aviso_evento === 'chat' || c.aviso_evento === 'no') ? c.aviso_evento : '');
      if (eleccion === 'no') continue;
      let canal = '';
      if (eleccion === 'chat') canal = String(c.vivo || '') || String(gen.get(g) || '');
      else if (dash[sv] !== false) canal = String(c.vivo || '') || (dash[sv] === true ? String(gen.get(g) || '') : '');
      if (!canal) canal = resto;
      if (/^\d{5,25}$/.test(canal)) out[sv] = canal;
    }
    return out;
  }

  async inscriptosChat(ahora) {
    const aj = this.ajustes();
    // 🌙 en el horario de silencio, tampoco
    if (enSilencio(aj, ahora)) return 0;
    const dash = (aj.en_vivo && typeof aj.en_vivo === 'object') ? aj.en_vivo : {};
    const dashNivel = (aj.en_vivo_nivel && typeof aj.en_vivo_nivel === 'object') ? aj.en_vivo_nivel : {};
    const anot = (this.leer('anotados') || {}).ev || {};
    const generales = (this.leer('canales') || {}).generales || [];
    let pedidos = 0;
    for (const a of this.anunciosVistos(ahora, 24, 40)) {
      if (pedidos >= 1) break;
      if (dash[a.sv] === false || (a.ini && ahora > a.ini + 30 * MIN)) continue;
      const lista = (anot[a.id] || []).filter((x) => x && x[0] && (x[3] || x[2])).map((x) => sinBandera(x[0]));
      if (lista.length < 3) continue;
      // con llave en juego del mismo servidor publicada después del anuncio, ya habla la llave
      const desde = Number((BigInt(a.id) >> 22n) + 1420070400000n);
      if (this.sql.exec('SELECT 1 FROM vivo WHERE sv = ? AND pub > ? LIMIT 1', a.sv, desde - HORA).toArray().length) continue;
      const g = (/\/channels\/(\d+)\//.exec(a.url || '') || [])[1] || '';
      if (!g) continue;
      const m0 = (this.cfgChat = this.cfgChat || new Map()).get(g);
      let c = m0 && ahora - m0.t < 5 * MIN ? m0.c : null;
      if (!c) {
        try { c = JSON.parse((await this.env.KV.get('cfg:' + g, { cacheTtl: 60 })) || '{}') || {}; } catch (e) { c = {}; }
        this.cfgChat.set(g, { c, t: ahora });
      }
      const nivel = nivelChat(dashNivel[a.sv], c.vivo_nivel);
      if (nivel !== 'datos' && nivel !== 'full') continue;
      const canal = String(c.vivo || '') || (dash[a.sv] === true ? String((generales.find((x) => x.g === g) || {}).id || '') : '');
      if (!/^\d{5,25}$/.test(canal) || ahora < (this.leer('chat_pausa:' + canal) || 0)) continue;
      const cupos = /^\s*\d+\s*$/.test(String(a.cup || '')) ? Number(a.cup) : 0;
      const texto = '📝 **' + escMd(a.n) + '** · ya se anotaron **' + lista.length + '**' + (cupos ? ' de ' + cupos : '') + ': '
        + lista.slice(0, 12).map(escMd).join(', ') + (lista.length > 12 ? ' y ' + (lista.length - 12) + ' más' : '')
        + (a.url ? '\n¿Te sumas? <' + a.url + '>' : '');
      const h = this.sql.exec("SELECT msg, texto, t FROM chat_vivo WHERE llave = ? AND canal = ? AND m = 'inscriptos'",
        'i:' + a.id, canal).toArray()[0];
      if (h && (h.texto === texto || !h.msg || ahora - h.t < CHAT_ENTRE_TODO)) continue;
      if (!h) {
        const ult = (this.sql.exec("SELECT MAX(t) AS t FROM chat_vivo WHERE canal = ? AND msg != ''", canal).toArray()[0] || {}).t || 0;
        if (ahora - ult < CHAT_ENTRE_TODO) continue;
      }
      pedidos++;
      let r = null;
      try {
        r = await fetch(`${DC}/channels/${canal}/messages` + (h ? '/' + h.msg : ''), {
          method: h ? 'PATCH' : 'POST',
          headers: { Authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'User-Agent': UA, 'content-type': 'application/json' },
          body: JSON.stringify({ content: texto.slice(0, 1900), allowed_mentions: { parse: [] }, flags: 4 }),
        });
      } catch (e) { r = null; }
      if (!r || !r.ok) {
        if (!h && r) this.guardar('chat_pausa:' + canal, ahora + pausaChat(r.status, 0));
        continue;
      }
      let id = h ? h.msg : '';
      if (!h) { try { id = String((await r.json()).id || ''); } catch (e) { id = ''; } }
      this.sql.exec('INSERT OR REPLACE INTO chat_vivo (llave, canal, m, msg, texto, t) VALUES (?, ?, ?, ?, ?, ?)',
        'i:' + a.id, canal, 'inscriptos', id, texto, ahora);
    }
    return pedidos;
  }

  anunciosVistos(ahora, horas = 24, tope = 12) {
    return this.sql.exec("SELECT id, cuerpo FROM avisos WHERE creado > ? AND estado != 2 AND instr(id, ':') = 0 " +
      'ORDER BY creado DESC LIMIT ?', ahora - horas * HORA, tope).toArray().map((r) => {
      let c = {};
      try { c = JSON.parse(r.cuerpo) || {}; } catch (e) { c = {}; }
      return c.tipo === 'evento' && c.sv !== SV_PRUEBA && c.t ? { id: r.id, sv: c.sv, n: c.t, ini: c.ini || null,
        mod: c.mod || '', cup: c.cup || '', pre: c.pre || '', url: c.url || '', cx: c.cx ? 1 : 0 } : null;
    }).filter(Boolean);
  }

  /** Para `/avisos/vivo`: el texto de las llaves de las últimas horas. */
  vivo() {
    const ahora = Date.now();
    const v = this.leer('vivo') || {};
    // 🌙 dormido no se lee nada: lo de antes de las 3 ya no se actualiza, y
    // mostrarlo «en vivo, se actualiza cada minuto» sería mentir
    if ((this.leer('vigia') || {}).dormido) return { t: v.t || 0, dormido: true, llaves: [], veredictos: [] };
    // 🔒 QUIÉN PUBLICÓ CADA LLAVE Y CADA VOTO SALE COMO UN CÓDIGO DEL DÍA, NO COMO SU DISCORD ID (revisión del
    // 04/10/2026). Esto es público y se guarda en el borde: la página sólo lo compara —junta los mensajes de un mismo
    // autor, cuenta un voto por persona— y para eso alcanza un código que no dice de quién es
    let sal = this.leer('sal_vivo');
    const hoy = Math.floor(ahora / (24 * HORA));
    if (!sal || sal.d !== hoy) { sal = { d: hoy, v: crypto.randomUUID() }; this.guardar('sal_vivo', sal); }
    const anon = (filas) => filas.map((r) => Object.assign({}, r, { autor: r.autor ? codigoDe(sal.v + r.autor) : '' }));
    const titulo = (t) => { try { return globalThis.LlaveVivo ? globalThis.LlaveVivo.titulo(t || '') : ''; } catch (e) { return ''; } };
    return { t: v.t || 0, llaves: anon(this.sql.exec('SELECT id, canal, sv, g, autor, pub, ed, texto ' +
      'FROM vivo WHERE ed > ? ORDER BY ed DESC LIMIT 12', ahora - VIVO_HORAS * HORA).toArray()),
    // 🔴 y las llaves que el organizador borró, con cuándo: un evento cuya llave se borró y no tiene otra deja de estar
    // «en vivo» (`Liga.vivo()`; LA REDENCION, 03/10/2026). Sólo el principio, que es donde está el título
    // 🔒 sólo el título: el texto de una llave borrada es lo que el organizador sacó, y no se vuelve a publicar
    borradas: this.sql.exec('SELECT id, sv, pub, ed, texto, t FROM vivo_borradas WHERE t > ? ORDER BY t DESC LIMIT 12',
      ahora - VIVO_HORAS * HORA).toArray().map((r) => ({ id: r.id, sv: r.sv, pub: r.pub, ed: r.ed, t: r.t, titulo: titulo(r.texto) })),
    // 🔑 los veredictos, para que la página arme las batallas de un 5 vidas
    veredictos: anon(this.sql.exec('SELECT id, canal, sv, g, autor, pub, ed, texto FROM veredictos ' +
      'WHERE pub > ? ORDER BY pub DESC LIMIT 400', ahora - VIVO_HORAS * HORA).toArray()),
    // 🕵️ y quién es cada nombre de esas llaves, por la inscripción, la llamada o la mención: ver `quienes()`
    quien: (this.leer('quien') || {}).svs || {},
    // 🔑 y lo que se canceló en el último día, para que la página lo diga (ver `cancelaciones()`)
    cancelados: this.sql.exec('SELECT id, sv, cuerpo, t, por FROM cancelados WHERE t > ? ORDER BY t DESC LIMIT 20',
      ahora - 24 * HORA).toArray().map((r) => {
      let c = {};
      try { c = JSON.parse(r.cuerpo) || {}; } catch (e) { c = {}; }
      return { id: r.id, sv: r.sv, n: c.t || '', ini: c.ini || null, t: r.t, por: r.por };
    }),
    // 📢 y lo que el organizador avisó después —cancelado, en pausa, atrasado—, con su anuncio (`evento`). Ver
    // `anotarEstado()`. El más nuevo primero
    estados: this.sql.exec('SELECT id, sv, tipo, nueva, mas, texto, pub, evento FROM estados WHERE pub > ? ' +
      'ORDER BY pub DESC LIMIT 20', ahora - 36 * HORA).toArray(),
    // 📣 Y LOS EVENTOS QUE EL VIGÍA YA VIO ANUNCIAR (03/10/2026, Dlx: «se ha anunciado el evento y no se ve en
    // inicio»). El payload los trae recién en la corrida siguiente del ciclo —hasta 30 min, y la mayoría de los
    // eventos se anuncian con 15 min o menos—: DESGRACIAS EN TOKYO VOL 21 se avisó al teléfono a las 3:59 PM y el
    // Inicio no lo tenía. La página los suma a «próximos» mientras el payload no los traiga (`Liga.proximos()`).
    // Sólo los de verdad: ni los descartados (estado 2), ni el recordatorio (`:antes`), ni pruebas ni cancelaciones
    anuncios: this.anunciosVistos(ahora),
    // 🙋 y quiénes se anotaron a cada uno, por el id del anuncio (ver `anotados()`)
    anotados: (this.leer('anotados') || {}).ev || {} };
  }

  /** De qué Discord ID es cada nombre (`turnos:nombres`, ver `bot/avisos_personales.py`), leído cada 10 minutos. */
  async indiceNombres(ahora) {
    if (!this.indiceTurnos || ahora - (this.indiceTurnosT || 0) > 10 * MIN) {
      try { this.indiceTurnos = JSON.parse((await this.env.KV.get('turnos:nombres')) || '{}') || {}; } catch (e) { this.indiceTurnos = {}; }
      this.indiceTurnosT = ahora;
    }
    return (this.indiceTurnos && this.indiceTurnos.n) || {};
  }

  /**
   * La cuenta de Discord de un perfil, o `''`. Primero lo que el objeto ya sabe de esa persona —sigue a alguien o
   * eligió servidor, y ahí quedó su perfil (`de`)—; si no, su nombre (`nombre`, o el de `p:<perfil>` de KV) por el
   * índice de «te toca», y sólo si esa cuenta es la de ese perfil: ante la duda, nadie.
   */
  async cuentaDe(a, ahora, idx, nombre) {
    const r = this.sql.exec('SELECT quien FROM sigue WHERE de = ? LIMIT 1', a).toArray()[0] ||
      this.sql.exec('SELECT quien FROM servidor WHERE de = ? LIMIT 1', a).toArray()[0];
    // ⚠️ con la misma prueba que el camino por nombre: una clave que cambió de dueño (`_choques()`, un perfil que se
    // fusionó) mandaba «te felicitaron» y «te siguen» al dueño de antes (revisión del 03/10/2026)
    if (r && /^[0-9]{5,25}$/.test(String(r.quien || '')) && await this.perfilDe(String(r.quien), ahora) === a) return String(r.quien);
    let n = nombre || '';
    if (!n) {
      try { n = String((JSON.parse(this.persona('p:' + a) || (await this.env.KV.get('p:' + a)) || '{}') || {}).n || ''); } catch (e) { n = ''; }
    }
    const did = n ? (idx || {})[claveTurno(n)] : '';
    return did && await this.perfilDe(String(did), ahora) === a ? String(did) : '';
  }

  /** El perfil de una cuenta (`d:`, y si no `dn:`), guardado 6 horas en `idk` como en `quienes()`; `''` si no tiene. */
  async perfilDe(id, ahora) {
    const fila = this.sql.exec('SELECT k, t FROM idk WHERE id = ?', id).toArray()[0];
    if (fila && ahora - fila.t < 6 * HORA) return fila.k;
    const k = (await this.env.KV.get('d:' + id)) || (await this.env.KV.get('dn:' + id)) || '';
    this.sql.exec('INSERT INTO idk (id, k, t) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET k = excluded.k, ' +
      't = excluded.t', id, k, ahora);
    return k;
  }

  /**
   * 🎤 «TE TOCA»: ver `turnosDe()`. Cada minuto, con las llaves que se tocaron en las últimas 3 horas. Devuelve cuántos
   * avisos salieron. ⚠️ El lector se carga recién acá (`import()`): las pruebas de Node importan este archivo sin él.
   */
  async turnos(ahora) {
    if (this.pausada()) return 0;  // 🔔 la campana pausada desde el Dashboard: esperan
    const filas = this.sql.exec('SELECT id, canal, sv, g, autor, pub, ed, texto FROM vivo WHERE ed > ?',
      ahora - 3 * HORA).toArray();
    if (!filas.length) return 0;
    if (!globalThis.LlaveVivo) await import('./llave_vivo.js');
    const LV = globalThis.LlaveVivo;
    if (!LV) return 0;
    const idx = await this.indiceNombres(ahora);
    const hecho = (id) => {
      const r = this.sql.exec('SELECT t FROM hechos WHERE id = ?', id).toArray()[0];
      return r ? r.t : null;
    };
    let llaves = 0;
    const cands = [];
    for (const b of LV.unirPartidas(filas)) {
      let L = null;
      try { L = LV.aLlave(b); } catch (e) { L = null; }
      if (!L) continue;
      llaves++;
      if (ahora - (L.ed || 0) > LLAVE_QUIETA) continue;
      for (const c of aLlamar(L, turnosDe(L), idx, hecho, ahora)) cands.push({ ...c, L, g: b.g });
    }
    // primero los de AHORA, y de ésos los que todavía no sonaron
    cands.sort((a, b) => (a.tipo === 'ahora' ? 0 : 1) - (b.tipo === 'ahora' ? 0 : 1) || a.n - b.n);
    let enviados = 0, pedidos = 0, sinVinculo = 0, enLlamada = 0;
    for (const c of cands) {
      const subs = this.sql.exec('SELECT id, endpoint, p256dh, auth FROM subs WHERE quien = ?', c.did).toArray();
      if (!subs.length) { sinVinculo++; continue; }
      // ⚠️ LA PERSONA ENTERA O NADA —la pregunta a Discord y sus envíos—: si no entra en el tope de este minuto, sale
      // en el siguiente (no se anota nada)
      if (pedidos + 1 + subs.length > TOPE_TURNOS) continue;
      pedidos++;
      // (b) ya está en la llamada: no se lo llama más por esta batalla
      if (await this.enLaLlamada(c.g, c.did) === true) {
        this.sql.exec('INSERT OR IGNORE INTO hechos (id, t) VALUES (?, ?)', c.base + ':voz', ahora);
        enLlamada++;
        continue;
      }
      this.sql.exec('INSERT OR IGNORE INTO hechos (id, t) VALUES (?, ?)', c.clave, ahora);
      pedidos += subs.length;
      const cuerpo = cuerpoTurno(c.L, c.bat, c.tipo, c.n);
      // ⚠️ con el mismo `topic`: si el teléfono estaba apagado, le llega sólo el último y no tres
      const estados = await Promise.all(subs.map((s) => empujar(s, cuerpo,
        { ttl: c.tipo === 'ahora' ? 3 * 60 : 10 * 60, topic: 'turno' + String(c.L.id).slice(-20) },
        this.env, new Map())));
      let llego = 0, red = false;
      estados.forEach((e, i) => {
        if (e >= 200 && e < 300) { enviados++; llego++; }
        else if (MUERTA(e)) this.sql.exec('DELETE FROM subs WHERE id = ?', subs[i].id);
        else if (e === 0 || e === 429 || e >= 500) red = true;
      });
      // 🔴 si no llegó a ninguno por la red o por quedarse sin pedidos en este minuto (`empujar()` da 0), la marca se
      // saca y vuelve a intentarse en la próxima vuelta: «Sos el próximo» va una sola vez, y se perdía (revisión del 03/10)
      if (!llego && red) this.sql.exec('DELETE FROM hechos WHERE id = ?', c.clave);
    }
    if (llaves) {
      this.guardar('turnos', { t: ahora, llaves, llamados: cands.length, enviados, en_llamada: enLlamada,
        sin_vinculo: sinVinculo, pedidos });
    }
    return enviados;
  }

  /**
   * 🕵️ QUIÉN ES CADA NOMBRE DE LAS LLAVES EN VIVO, cada minuto (02/10/2026): ver `indiceVivo()`. Lo lee la página en
   * `/avisos/vivo` (`quien`, `{SV: {nombre normalizado: perfil}}`) para la cara, el perfil y para unir las rondas de
   * quien cambia de nombre (`quienVivo()` de app.js).
   * ⚠️ SÓLO CON LLAVES EN VIVO, y cuesta poco: la llamada se lee de KV cada 5 minutos por servidor, y de qué perfil es
   * cada cuenta se guarda 6 horas (`idk`), con un tope de cuentas nuevas por minuto. Nunca frena al vigía.
   */
  async quienes(ahora) {
    const filas = this.sql.exec('SELECT id, canal, sv, g, autor, pub, ed, texto, men FROM vivo WHERE ed > ?',
      ahora - 3 * HORA).toArray();
    if (!filas.length) {
      if (Object.keys((this.leer('quien') || {}).svs || {}).length) this.guardar('quien', { t: ahora, svs: {} });
      return;
    }
    if (!globalThis.LlaveVivo) await import('./llave_vivo.js');
    const LV = globalThis.LlaveVivo;
    if (!LV) return;
    const porSv = {};
    for (const b of LV.unirPartidas(filas)) {
      let L = null;
      try { L = LV.aLlave(b); } catch (e) { L = null; }
      if (!L || !b.sv) continue;
      const s = porSv[b.sv] = porSv[b.sv] || { nombres: new Set(), men: {} };
      for (const R of L.rondas) for (const x of R.b) for (const lado of x[0]) {
        for (const n of String(lado).split(/\s*,\s*/)) if (n) s.nombres.add(n);
      }
    }
    for (const f of filas) {
      if (!f.sv || !porSv[f.sv] || !f.men) continue;
      try { Object.assign(porSv[f.sv].men, JSON.parse(f.men) || {}); } catch (e) { /* una fila rara no frena */ }
    }
    this.vozCache = this.vozCache || {};
    const out = {};
    let pedidos = 0, cuentas = 0;
    for (const [sv, s] of Object.entries(porSv)) {
      const insc = this.sql.exec('SELECT autor_id, texto FROM inscritos WHERE sv = ? AND pub > ?', sv,
        ahora - 36 * HORA).toArray();
      let vc = this.vozCache[sv];
      if (!vc || ahora - vc.t > 5 * MIN) {
        let g = {};
        try { g = ((JSON.parse((await this.env.KV.get('voz:' + sv)) || '{}') || {}).gente) || {}; } catch (e) { g = {}; }
        vc = this.vozCache[sv] = { t: ahora, gente: g };
      }
      // de la llamada, quien se vio en las últimas 6 horas
      const voz = {};
      for (const [id, e] of Object.entries(vc.gente || {})) {
        if (((e && e.t) || []).some((t) => ahora - t < 6 * HORA)) voz[id] = e;
      }
      const ids = quienesDe([...s.nombres], indiceVivo(insc, voz, s.men));
      const m = {};
      for (const [n, id] of Object.entries(ids)) {
        cuentas++;
        const fila = this.sql.exec('SELECT k, t FROM idk WHERE id = ?', id).toArray()[0];
        let k = fila && ahora - fila.t < 6 * HORA ? fila.k : null;
        if (k === null) {
          if (pedidos >= 30) continue;          // el resto, el minuto que viene
          pedidos++;
          try { k = (await this.env.KV.get('d:' + id)) || (await this.env.KV.get('dn:' + id)) || ''; } catch (e) { continue; }
          this.sql.exec('INSERT INTO idk (id, k, t) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET k = excluded.k, ' +
            't = excluded.t', id, k, ahora);
        }
        if (k) m[n] = k;
      }
      if (Object.keys(m).length) out[sv] = m;
    }
    this.sql.exec('DELETE FROM idk WHERE t < ?', ahora - 24 * HORA);
    this.guardar('quien', { t: ahora, svs: out, cuentas, pedidos });
  }

  /**
   * 🙋 Quiénes se anotaron a cada evento anunciado, para la página (`anotados` de `/avisos/vivo`). Ver `anotadosDe()`.
   * La cara: la de la cuenta que se anotó, si esa cuenta anotó UN solo nombre (quien anota a varios es del staff) y su
   * perfil se llama como lo que escribió —«Una inscripción no siempre es del autor»—. Si no, la página lo busca por el
   * nombre. Sin Discord IDs: viaja `[nombre, bandera, clave, con bandera]`.
   */
  async anotados(ahora) {
    // 🔴 EL ANUNCIO BORRADO Y VUELTO A PUBLICAR ES EL MISMO EVENTO (LA REDENCION, FFA, 03/10/2026: el de las 6:19 se
    // borró a las 6:26 y salió otro igual). Las inscripciones eran del primero, y al primero se lo da por cancelado: la
    // página mostraba el nuevo sin un solo anotado. El cancelado no es un evento, y su hora de publicación pasa al que lo
    // reemplaza —mismo servidor, mismo nombre, hasta 12 horas después—, así lo que se anotó antes vale para el nuevo
    const tit = (t) => String(t || '').normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    const cxs = this.sql.exec('SELECT id, sv, cuerpo FROM cancelados WHERE t > ?', ahora - 2 * 24 * HORA).toArray().map((r) => {
      let c = {};
      try { c = JSON.parse(r.cuerpo) || {}; } catch (e) { c = {}; }
      return { id: r.id, sv: r.sv, t: tit(c.t), pub: msDeId(r.id) };
    });
    const evs = this.sql.exec("SELECT id, cuerpo FROM avisos WHERE estado != 2 AND instr(id, ':') = 0 AND creado > ?",
      ahora - 2 * 24 * HORA).toArray().map((r) => {
      let c = {};
      try { c = JSON.parse(r.cuerpo) || {}; } catch (e) { c = {}; }
      if (!(c.tipo === 'evento' && c.ini != null && c.sv) || cxs.some((x) => x.id === r.id)) return null;
      const pub = msDeId(r.id);
      const antes = cxs.filter((x) => x.sv === c.sv && x.t && x.t === tit(c.t) && x.pub < pub && pub - x.pub < 12 * HORA);
      return { id: r.id, sv: c.sv, ini: c.ini, pub: Math.min(pub, ...antes.map((x) => x.pub)) };
    }).filter((e) => e && e.pub && e.ini - INSC_ANTES <= ahora && ahora <= e.ini + INSC_DESPUES);
    if (!evs.length) {
      if (Object.keys((this.leer('anotados') || {}).ev || {}).length) this.guardar('anotados', { t: ahora, ev: {} });
      return;
    }
    const svs = new Set(evs.map((e) => e.sv));
    const insc = this.sql.exec('SELECT autor_id, sv, pub, texto FROM inscritos WHERE pub > ? ORDER BY pub',
      Math.min(...evs.map((e) => e.pub)) - MIN).toArray().filter((x) => svs.has(x.sv));
    const por = anotadosDe(evs, insc);
    // ⚠️ LA CARA DE LA CUENTA, SÓLO A QUIEN SE ANOTÓ UNA VEZ: quien anota a otros en varios mensajes no le presta la
    // cara a nadie. Por MENSAJE y no por nombre desde los equipos (03/10/2026): «yinn+ji sung park» es un mensaje, y
    // la cara va sólo al nombre que coincide con la cuenta (`claveDeNombre()`)
    const nombres = {};
    for (const l of Object.values(por)) for (const y of l) if (/^\d+$/.test(y.autor)) (nombres[y.autor] = nombres[y.autor] || new Set()).add(y.msg);
    let pedidos = 0;
    const ev = {};
    for (const [id, l] of Object.entries(por)) {
      ev[id] = [];
      for (const y of l.slice(0, 48)) {
        let k = '';
        if (nombres[y.autor] && nombres[y.autor].size === 1) {
          const fila = this.sql.exec('SELECT k, t FROM idk WHERE id = ?', y.autor).toArray()[0];
          let kk = fila && ahora - fila.t < 6 * HORA ? fila.k : null;
          if (kk === null && pedidos < 15) {
            pedidos++;
            try {
              kk = (await this.env.KV.get('d:' + y.autor)) || (await this.env.KV.get('dn:' + y.autor)) || '';
              this.sql.exec('INSERT INTO idk (id, k, t) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET k = excluded.k, ' +
                't = excluded.t', y.autor, kk, ahora);
            } catch (e) { kk = null; }
          }
          if (kk && claveDeNombre(y.n, kk)) k = kk;
        }
        ev[id].push([y.aka, y.cc, k, y.b ? 1 : 0]);
      }
    }
    this.guardar('anotados', { t: ahora, ev, pedidos });
  }

  /**
   * ¿Está en un canal de voz de ese servidor? `true`, `false`, o `null` si no se pudo saber —y entonces se lo llama
   * igual: es peor no avisar que avisar de más—. Discord lo contesta solo (`GET /guilds/{g}/voice-states/{id}`): 200
   * con el canal, o 404 con el código 10065 si no está en ninguno. Medido el 01/10/2026 con FFA en vivo: los de la
   * llamada daban 200, el resto 10065.
   */
  async enLaLlamada(g, did) {
    if (!g || !did) return null;
    try {
      const r = await fetch(`${DC}/guilds/${g}/voice-states/${did}`, {
        headers: { Authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'User-Agent': UA },
      });
      const v = await r.json().catch(() => ({}));
      if (r.status === 200) return !!(v && v.channel_id);
      if (r.status === 404 && v && v.code === 10065) return false;
    } catch (e) { /* sin red: no se sabe */ }
    return null;
  }

  /**
   * 🎙️ QUIÉN ESTÁ EN LA LLAMADA, MINUTO A MINUTO (Dlx, 01/10/2026, respuesta 5: «cada minuto de hecho si es posible»).
   * Lo hace un trabajo de Actions —`.github/workflows/llamada.yml`, `bot/en_llamada.py --seguir`— que se conecta UNA vez
   * al Gateway mientras dure lo en vivo. Acá sólo se lo larga: con un servidor en vivo (un anuncio en su ventana, o una
   * llave tocada en las últimas 3 h), cada 10 minutos se le pregunta a GitHub si ese trabajo está andando o en cola, y si
   * no, se lo dispara. ⚠️ Cada 10 y no cada minuto: son dos pedidos a la API de GitHub, y el trabajo tarda un minuto en
   * arrancar.
   */
  async llamada(ahora) {
    if (!this.env.GH_TOKEN || !this.env.GH_REPO) return;
    const vivos = svsEnVivo(this.sql.exec('SELECT cuerpo FROM avisos WHERE estado != 2 AND creado > ?',
      ahora - 2 * 24 * HORA).toArray().map((r) => r.cuerpo), ahora);
    for (const r of this.sql.exec('SELECT DISTINCT sv FROM vivo WHERE ed > ?', ahora - 3 * HORA).toArray()) {
      if (r.sv) vivos.add(r.sv);
    }
    vivos.delete(SV_PRUEBA);
    if (!vivos.size) return;
    const prev = this.leer('llamada') || {};
    if (ahora - (prev.mirado || 0) < 10 * MIN) return;
    const gh = (ruta, opc) => this.gh(ruta, opc);
    let anda = false;
    for (const st of ['in_progress', 'queued']) {
      const r = await gh(`/actions/workflows/llamada.yml/runs?status=${st}&per_page=1`);
      if (r.status === 200 && ((await r.json()).total_count || 0) > 0) { anda = true; break; }
    }
    let disparo = prev.disparo || 0, estado = 0;
    if (!anda) {
      const r = await gh('/actions/workflows/llamada.yml/dispatches', { method: 'POST', body: JSON.stringify({ ref: 'main' }) });
      estado = r.status;
      if (estado === 204) disparo = ahora;
    }
    this.guardar('llamada', { mirado: ahora, anda, disparo, estado: estado || undefined, vivos: [...vivos] });
  }

  /**
   * 🔴 EL EVENTO QUE SE CANCELÓ: su anuncio se borró o se editó a «cancelado» (ver `cancelado()`). Cada 2 minutos se
   * le pregunta a Discord por cada anuncio avisado de los últimos dos días que todavía no empezó (o empezó hace menos de
   * media hora): son pocos, uno por evento. Al que se canceló, lo que no salió no sale —el aviso y su recordatorio— y a
   * quien ya le llegó, el de cancelado (`tipo: 'cancelado'`, ver `armar()` en `sw.js`). Devuelve si hubo alguno.
   */
  async cancelaciones(ahora) {
    if (Math.floor(ahora / MIN) % 2) return false;
    const filas = this.sql.exec("SELECT id, sv, cuerpo, estado, cursor, creado FROM avisos WHERE estado IN (0, 1, ?) " +
      "AND creado > ? AND instr(id, ':') = 0", NO_SALIO, ahora - 2 * 24 * HORA).toArray();
    let pedidos = 0, hubo = false;
    for (const f of filas) {
      let c = null;
      try { c = JSON.parse(f.cuerpo); } catch (e) { c = null; }
      if (!c || c.tipo !== 'evento' || !c.url) continue;
      if (c.ini != null && ahora > c.ini + 30 * MIN) continue;
      // ⚠️ y el que no tiene hora, mientras dura su aviso y media hora más: sin esto, la limpieza normal de un canal
      // hasta dos días después «cancelaba» un evento ya jugado (revisión del 04/10/2026)
      if (c.ini == null && ahora > (f.creado || 0) + EDAD_SIN_HORA + 30 * MIN) continue;
      if (this.sql.exec('SELECT 1 FROM cancelados WHERE id = ?', f.id).toArray().length) continue;
      const p = /\/channels\/\d+\/(\d+)\/(\d+)/.exec(c.url);
      if (!p) continue;
      // 📢 o el organizador lo dijo en un mensaje aparte (`anotarEstado()`): sin preguntarle nada a Discord
      let por = this.sql.exec("SELECT 1 FROM estados WHERE evento = ? AND tipo = 'cancelado'", f.id).toArray().length
        ? 'mensaje' : '';
      if (!por) {
        if (pedidos >= CANCELA_TOPE) continue;
        pedidos++;
        let estado = 0, m = null;
        try {
          const r = await fetch(`${DC}/channels/${p[1]}/messages/${p[2]}`, {
            headers: { Authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'User-Agent': UA },
          });
          estado = r.status;
          if (estado === 200) m = await r.json();
          // el 404 trae su código: 10008 es el mensaje borrado; 10003, el canal (ver `cancelado()`)
          else if (estado === 404) { try { m = { code: (await r.json()).code }; } catch (e) { m = null; } }
        } catch (e) { estado = 0; }
        por = cancelado(estado, m, c, f.creado);
      }
      if (!por) continue;
      // 🔴 BORRADO Y VUELTO A PUBLICAR NO ES CANCELADO (LA REDENCION, FFA, 03/10/2026, 6:26 PM: le llegó «cancelado» a
      // todos y el evento seguía). Si en el mismo canal hay una copia del anuncio (`repetidos`, ver `anotar()`) y sigue
      // ahí, el aviso pasa a mirar ese mensaje —si después se borra ése, ahí sí se cancela— y no se manda nada
      if (por === 'borrado') {
        const rep = this.sql.exec('SELECT id FROM repetidos WHERE de = ? AND canal = ? ORDER BY t DESC LIMIT 1',
          f.id, p[1]).toArray()[0];
        if (rep) {
          let vive = false;
          try {
            const r2 = await fetch(`${DC}/channels/${p[1]}/messages/${rep.id}`, {
              headers: { Authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'User-Agent': UA },
            });
            vive = r2.status === 200;
          } catch (e) { vive = false; }
          if (vive) {
            const mover = (cuerpo) => {
              try { const x = JSON.parse(cuerpo); x.url = String(x.url || '').replace(/\/\d+$/, '/' + rep.id); return JSON.stringify(x); } catch (e) { return cuerpo; }
            };
            const antes = this.sql.exec('SELECT cuerpo FROM avisos WHERE id = ?', f.id + ':antes').toArray()[0];
            this.state.storage.transactionSync(() => {
              this.sql.exec('UPDATE avisos SET cuerpo = ? WHERE id = ?', mover(f.cuerpo), f.id);
              if (antes) this.sql.exec('UPDATE avisos SET cuerpo = ? WHERE id = ?', mover(antes.cuerpo), f.id + ':antes');
              this.sql.exec('UPDATE claves SET id = ? WHERE id = ?', rep.id, f.id);
              this.sql.exec('DELETE FROM repetidos WHERE id = ?', rep.id);
            });
            continue;
          }
        }
      }
      hubo = true;
      this.state.storage.transactionSync(() => {
        this.sql.exec('INSERT OR IGNORE INTO cancelados (id, sv, cuerpo, t, por) VALUES (?, ?, ?, ?, ?)',
          f.id, f.sv, f.cuerpo, ahora, por);
        // lo que todavía no salió, no sale: el aviso del evento y su recordatorio
        this.sql.exec('UPDATE avisos SET estado = 2 WHERE (id = ? OR id = ?) AND estado IN (0, ?)', f.id, f.id + ':antes',
          NO_SALIO);
        // y si a alguien ya le llegó el del evento, el de cancelado (el mismo `tag` lo reemplaza en el teléfono)
        if (f.estado === 1 || f.cursor) {
          // `hs`: hasta qué suscripción le llegó el aviso. Sin eso, el «cancelado» le llegaba también a quien activó la
          // campana después y nunca supo del evento (revisión del 04/10/2026; ver `lote()`)
          const cx = { v: 1, tipo: 'cancelado', id: c.id, t: c.t, sv: c.sv, svn: c.svn, ini: c.ini, url: HUB_EVENTOS, por,
            hs: f.cursor || 0 };
          this.sql.exec('INSERT OR IGNORE INTO avisos (id, sv, cuerpo, desde, hasta, creado) VALUES (?, ?, ?, ?, ?, ?)',
            'cx:' + f.id, f.sv, JSON.stringify(cx), ahora, ahora + 2 * HORA, ahora);
        }
      });
      // 🔑 Y LA COPIA DE `eventos-hoy` (Dlx, 01/10/2026: «A», que el bot la edite): si todavía no salió, no sale; si
      // salió, dice «❌ CANCELADO». Una edición no le suena a nadie: Discord no notifica un PATCH
      const post = this.sql.exec('SELECT hecho, msg FROM posts WHERE id = ?', f.id).toArray()[0];
      if (post && post.hecho === 0) {
        this.sql.exec('UPDATE posts SET hecho = 2 WHERE id = ?', f.id);
      } else if (post && post.hecho === 1 && /^\d+$/.test(post.msg || '')) {
        let est = 0;
        try {
          const r = await fetch(`${DC}/channels/${CANAL_RED}/messages/${post.msg}`, {
            method: 'PATCH',
            headers: { Authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'User-Agent': UA, 'Content-Type': 'application/json' },
            body: JSON.stringify(mensajeRedCancelado(c, por)),
          });
          est = r.status;
        } catch (e) { est = 0; }
        this.sql.exec('UPDATE posts SET error = ? WHERE id = ?', 'cancelado: editado ' + est, f.id);
      }
    }
    if (pedidos || hubo) this.guardar('cancelados', { t: ahora, pedidos, hubo });
    return hubo;
  }

  /** ¿Hay que avisar este mensaje? Lo anota y dice si era nuevo. */
  anotar(m, c, ahora) {
    const publicado = Date.parse(String(m.timestamp || '').slice(0, 19) + 'Z');
    if (Number.isNaN(publicado) || ahora - publicado > EDAD_MAX) return false;
    // ⚠️ ANTES DE LEERLO, ¿YA ESTA? Cada minuto se vuelven a pedir los
    // mismos diez mensajes; parsear los diez es gastar CPU en nada.
    // 🔴 SALVO QUE SE HAYA EDITADO DESPUÉS DE DESCARTARLO. Ver `releer()`.
    const fila = this.sql.exec('SELECT estado, hasta, cuerpo FROM avisos WHERE id = ?',
      m.id).toArray()[0];
    // 📢 lo ya descartado también: el «seguimos mañana» puede ser de antes de que el vigía supiera leerlo (`anotarEstado()`
    // no escribe dos veces lo mismo, y `PISTA_ESTADO` corta el resto sin leerlo)
    if (fila && fila.estado === 2) { try { this.anotarEstado(m, c, ahora); } catch (e) { /* sigue */ } }
    if (!releer(fila, m)) return false;
    if (fila) this.sql.exec('DELETE FROM avisos WHERE id = ?', m.id);
    // lo que publicó el propio bot —la re-publicación de `eventos-hoy`— no
    // es un anuncio: es el eco de uno
    if (this.yo && m.author && m.author.id === this.yo) return false;
    // lo que no se avisa se anota igual —vacío y cerrado— para no volver
    // a leerlo en el minuto siguiente
    const descartar = () => {
      this.sql.exec('INSERT OR IGNORE INTO avisos (id, sv, cuerpo, desde, hasta, ' +
        'creado, estado) VALUES (?, ?, ?, ?, ?, ?, 2)', m.id, c.sv, marcaDescarte(m),
      0, 0, ahora);
      return false;
    };
    const a = parsearAnuncio(m);
    // 🧪 LA PRUEBA DE DLX, DESDE UN CANAL DE VERDAD. El 25/09/2026 escribió
    // «Probando…» en los eventos de FFA para ver si le llegaba el aviso, y
    // no le llegó nada — con razón: no es un anuncio, y lo que no tiene
    // forma de anuncio no le suena el teléfono a nadie. Pero la prueba que
    // quería hacer es justo la que faltaba: la cadena entera, desde el
    // mensaje en Discord hasta el teléfono.
    //
    // ⚠️ SÓLO SUYO Y SÓLO A QUIEN ELIGIÓ «PRUEBAS» (`SV_PRUEBA`): el filtro
    // de `lote()` no se lo manda a nadie más, y no va a `eventos-hoy`.
    if (!a && this.dueno && m.author && m.author.id === this.dueno) {
      const txt = String(m.content || '').trim().toLowerCase();
      if (txt.startsWith('prueba') || txt.startsWith('probando')) {
        descartar();
        return this.prueba(c, m, ahora);
      }
    }
    if (!a) {
      // 📢 y lo que el organizador avisa después del anuncio: cancelado, en pausa o atrasado. Nunca frena
      try { this.anotarEstado(m, c, ahora); } catch (e) { /* sigue */ }
      return descartar();
    }
    const ini = momentoMs(a.horario, m.timestamp, a.fecha || diaDelNombre(a.nombre));
    // 🔴 LA REGLA: tarde es peor que nunca
    if (ini != null ? ini < ahora - GRACIA : ahora - publicado > EDAD_SIN_HORA) {
      return descartar();
    }
    // 🔴 EL MISMO EVENTO EN DOS CANALES AVISA UNA VEZ. `eventos-hoy` de DRA
    // junta eventos de toda la comunidad: si alguien copia ahí el anuncio
    // de FFA, son dos mensajes distintos del mismo evento. Se reconoce por
    // el nombre y la hora de arranque —redondeada a 10 minutos, porque
    // «EN 15» publicado con un minuto de diferencia da un minuto distinto—.
    const clave = a.nombre.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '') + '|' +
      (ini != null ? Math.round(ini / (10 * MIN)) : '');
    const prev = this.sql.exec('SELECT id FROM claves WHERE clave = ? AND t > ?', clave,
      ahora - EDAD_MAX).toArray()[0];
    if (prev) {
      // 🔴 Y SE ANOTA DE QUIÉN ES COPIA (revisión del 04/10/2026): un anuncio borrado y vuelto a publicar igual —LA
      // REDENCION, FFA, 03/10/2026, 6:26 PM— cae acá por repetido, y sin saber que existía, `cancelaciones()` leía el
      // borrado como un evento cancelado y le mandaba «cancelado» a todos. Ver `cancelaciones()`
      if (prev.id !== m.id) {
        this.sql.exec('INSERT OR REPLACE INTO repetidos (id, de, canal, t) VALUES (?, ?, ?, ?)', m.id, prev.id, c.id, ahora);
      }
      return descartar();
    }
    this.sql.exec('INSERT OR REPLACE INTO claves (clave, id, t) VALUES (?, ?, ?)',
      clave, m.id, ahora);
    const cuerpo = {
      v: 1, tipo: 'evento', id: m.id, t: a.nombre, sv: c.sv, svn: c.svn, ini,
      mod: a.modalidad.slice(0, 60), cup: a.cupos.slice(0, 40),
      pre: a.premios.slice(0, 60),
      url: `https://discord.com/channels/${c.g}/${c.id}/${m.id}`,
      // el anuncio ya decía «cancelado» al avisarlo: esa palabra no lo cancela (ver `cancelado()`)
      cx: CANCELADO.test(String(m.content || '')) ? 1 : undefined,
    };
    const hasta = ini != null ? ini + GRACIA : publicado + EDAD_SIN_HORA;
    this.sql.exec('INSERT OR IGNORE INTO avisos (id, sv, cuerpo, desde, hasta, creado) ' +
      'VALUES (?, ?, ?, ?, ?, ?)', m.id, c.sv, JSON.stringify(cuerpo), ahora, hasta, ahora);
    // 📅 y a la cola de los eventos de Discord, si ese servidor lo tiene prendido (`eventosDiscord()`)
    try {
      if (ini != null && c.g && (this.ajustes().eventos_discord || {})[c.sv] === true) {
        this.sql.exec('INSERT OR IGNORE INTO ev_discord (id, sv, g, nombre, url, ini, fin, t) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          m.id, c.sv, String(c.g), a.nombre.slice(0, 100), cuerpo.url, ini, ini + EV_DC_DURA, ahora);
      }
    } catch (e) { /* sigue */ }
    // 📣 y a quienes siguen a su organizador —el «Organiza:» o, sin él, quien lo publicó—. Nunca frena
    try {
      const au = m.author || {};
      // 👥 a cada organizador de a uno (`organizadoresDe()`, 14/10/2026) y al texto de siempre; quien sigue a dos de
      // ellos recibe un solo aviso
      const ns = organizadoresDe(m);
      const base = a.organizador || (m.member && m.member.nick) || au.global_name || au.username || '';
      const ya = new Set();
      const claves = new Set();
      for (const n of [...ns, base]) {
        const k = claveOrg(n);
        if (!k || claves.has(k)) continue;
        claves.add(k);
        this.colaOrg(n, a.nombre, ini, cuerpo.url, c.svn || c.sv, m.id, ahora, ya);
      }
    } catch (e) { /* sigue */ }
    // y a la cola de `eventos-hoy`, salvo que el anuncio haya salido de ahí
    if (c.id !== CANAL_RED) {
      this.sql.exec('INSERT OR IGNORE INTO posts (id, cuerpo, creado) VALUES (?, ?, ?)',
        m.id, JSON.stringify(cuerpo), ahora);
    }
    // 🔑 Y SI FALTA MAS DE UNA HORA, UN RECORDATORIO. Snake Rap anuncia
    // con horas —«INICIO DEL TORNEO: <t:…>»— y el aviso de las 12 del
    // mediodía no sirve de nada a las 4:30 de la tarde.
    if (ini != null && ini - ahora > RECORDAR_SI_FALTA) {
      this.sql.exec('INSERT OR IGNORE INTO avisos (id, sv, cuerpo, desde, hasta, ' +
        'creado) VALUES (?, ?, ?, ?, ?, ?)', m.id + ':antes', c.sv,
      JSON.stringify({ ...cuerpo, tipo: 'antes' }), ini - ANTES, ini + GRACIA, ahora);
    }
    return true;
  }

  /**
   * 📅 LOS EVENTOS DE DISCORD (Dlx, 19/10/2026: «dale», a «cada anuncio como evento del servidor, con “Me interesa”»).
   * En los servidores que lo tienen prendido en el Dashboard (`eventos_discord`), cada anuncio con hora pasa a ser un
   * evento programado de ese servidor: sale arriba de la lista de canales, con «Me interesa», y Discord le avisa solo a
   * quien lo marcó. Esta vuelta lo crea, lo pone EN VIVO a la hora, lo termina `EV_DC_DURA` después, y sigue lo que el
   * organizador avisó: cancelado (`cancelados`) o atrasado (`estados`).
   * ⚠️ APAGADO SI NO SE ELIGE: se crea en el servidor de otro y se ve allá. Y el bot necesita «Crear eventos» o
   * «Gestionar eventos» ahí: sin eso, Discord dice 403 y queda anotado para el Dashboard, sin reintentar.
   * ⚠️ Hasta `EV_DC_POR_VUELTA` pedidos por minuto: el vigía comparte su presupuesto de pedidos con esto.
   */
  async eventosDiscord(ahora) {
    const on = this.ajustes().eventos_discord || {};
    if (!Object.values(on).some(Boolean) && !this.sql.exec('SELECT 1 AS x FROM ev_discord WHERE estado IN (1, 2) LIMIT 1').toArray().length) return;
    const dc = (ruta, op = {}) => fetch('https://discord.com/api/v10' + ruta, { ...op,
      headers: { authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'content-type': 'application/json',
        'x-audit-log-reason': encodeURIComponent('Liga Global · el evento de un anuncio') } });
    let pedidos = 0;
    const fin = (f, estado, error) => this.sql.exec('UPDATE ev_discord SET estado = ?, error = ? WHERE id = ?', estado, error || '', f.id);
    // 1 · lo cancelado o atrasado por el organizador, a lo que ya se creó
    for (const f of this.sql.exec('SELECT * FROM ev_discord WHERE estado = 1').toArray()) {
      if (pedidos >= EV_DC_POR_VUELTA) return;
      const cx = this.sql.exec("SELECT 1 AS x FROM cancelados WHERE id = ? UNION SELECT 1 FROM estados WHERE evento = ? AND tipo = 'cancelado'",
        f.id, f.id).toArray().length;
      const at = cx ? null : this.sql.exec("SELECT nueva, mas FROM estados WHERE evento = ? AND tipo = 'atrasado' ORDER BY pub DESC LIMIT 1", f.id).toArray()[0];
      const nueva = at ? (at.nueva || (at.mas ? f.ini + at.mas : 0)) : 0;
      if (cx) {
        pedidos++;
        const r = await dc(`/guilds/${f.g}/scheduled-events/${f.ev}`, { method: 'PATCH', body: JSON.stringify({ status: 4 }) });
        fin(f, 4, r.ok || r.status === 404 ? '' : 'cancelar ' + r.status);
      } else if (nueva && nueva > f.ini && nueva > ahora + MIN) {
        pedidos++;
        const r = await dc(`/guilds/${f.g}/scheduled-events/${f.ev}`, { method: 'PATCH', body: JSON.stringify({
          scheduled_start_time: new Date(nueva).toISOString(), scheduled_end_time: new Date(nueva + EV_DC_DURA).toISOString() }) });
        if (r.ok) this.sql.exec('UPDATE ev_discord SET ini = ?, fin = ? WHERE id = ?', nueva, nueva + EV_DC_DURA, f.id);
      }
    }
    // 2 · a la hora, EN VIVO; y `EV_DC_DURA` después, terminado
    for (const f of this.sql.exec('SELECT * FROM ev_discord WHERE (estado = 1 AND ini <= ?) OR (estado = 2 AND fin <= ?) ORDER BY ini',
      ahora, ahora).toArray()) {
      if (pedidos >= EV_DC_POR_VUELTA) return;
      pedidos++;
      const st = f.estado === 1 ? 2 : 3;
      const r = await dc(`/guilds/${f.g}/scheduled-events/${f.ev}`, { method: 'PATCH', body: JSON.stringify({ status: st }) });
      // (si ya no está —lo borró un admin— o Discord no deja ese paso, se da por cerrado: no se insiste)
      if (r.ok || r.status === 404 || r.status === 400) fin(f, r.ok ? st : 3, r.ok ? '' : 'estado ' + r.status);
    }
    // 3 · los nuevos (lo que ya empezó o está por empezar no se crea: Discord pide una hora futura)
    for (const f of this.sql.exec('SELECT * FROM ev_discord WHERE estado = 0 ORDER BY ini').toArray()) {
      if (on[f.sv] !== true) { this.sql.exec('DELETE FROM ev_discord WHERE id = ?', f.id); continue; }
      if (f.ini < ahora + 2 * MIN) { fin(f, 8, ''); continue; }
      if (pedidos >= EV_DC_POR_VUELTA) return;
      pedidos++;
      const r = await dc(`/guilds/${f.g}/scheduled-events`, { method: 'POST', body: JSON.stringify({
        name: f.nombre.slice(0, 100) || 'Evento', privacy_level: 2, entity_type: 3,
        entity_metadata: { location: 'Anuncio y llave: underlegends.pages.dev' },
        scheduled_start_time: new Date(f.ini).toISOString(), scheduled_end_time: new Date(f.fin).toISOString(),
        description: ('Evento de la Liga Global. El anuncio, con cómo inscribirse: ' + f.url).slice(0, 1000) }) });
      if (r.ok) {
        const j = await r.json().catch(() => ({}));
        this.sql.exec("UPDATE ev_discord SET ev = ?, estado = 1, error = '' WHERE id = ?", String(j.id || ''), f.id);
      } else if (r.status === 403 || r.status === 404 || r.status === 400) {
        fin(f, 9, r.status === 403 ? 'permiso' : 'discord ' + r.status);
      } else {
        // un 429 o un 5xx: se reintenta en la vuelta siguiente, hasta tres veces
        this.sql.exec('UPDATE ev_discord SET intentos = intentos + 1, estado = CASE WHEN intentos >= 2 THEN 9 ELSE 0 END, error = ? WHERE id = ?',
          'discord ' + r.status, f.id);
      }
    }
    this.sql.exec('DELETE FROM ev_discord WHERE t < ?', ahora - 30 * DIA_MS);
  }

  /** 📅 `{SV: {creados, error}}`: los eventos de Discord de los últimos 7 días, para el Dashboard. */
  eventosDiscordEstado(ahora) {
    const out = {};
    for (const f of this.sql.exec('SELECT sv, estado, error FROM ev_discord WHERE t > ? ORDER BY t', ahora - 7 * DIA_MS).toArray()) {
      const x = (out[f.sv] = out[f.sv] || { creados: 0, error: '' });
      if ([1, 2, 3, 4].includes(f.estado)) x.creados++;
      x.error = f.estado === 9 ? f.error : f.estado >= 1 && f.estado <= 4 ? '' : x.error;
    }
    return out;
  }

  /** 🧪 El aviso de una prueba de Dlx. Ver `anotar()`. */
  prueba(c, m, ahora) {
    const id = 'prueba:' + m.id;
    const cuerpo = {
      v: 1, tipo: 'evento', id, t: 'Prueba: leí tu mensaje', sv: SV_PRUEBA,
      svn: (c.svn || c.sv) + ' · ' + c.nombre, ini: null,
      mod: 'así te llega cada evento de verdad', cup: '', pre: '',
      url: `https://discord.com/channels/${c.g}/${c.id}/${m.id}`,
    };
    this.sql.exec('INSERT OR IGNORE INTO avisos (id, sv, cuerpo, desde, hasta, creado) ' +
      'VALUES (?, ?, ?, ?, ?, ?)', id, SV_PRUEBA, JSON.stringify(cuerpo), ahora,
    ahora + 15 * MIN, ahora);
    // 🔴 UNA PRUEBA QUE NO LLEGA TIENE QUE DECIR POR QUÉ. El 25/09/2026 Dlx
    // escribió «Probando…» dos veces y no le llegó nada, sin ninguna señal:
    // sus dispositivos se anotaron con «Todos», que a propósito NO incluye
    // las pruebas. Ahora el bot le contesta por DM qué leyó y a cuántos
    // dispositivos con 🧪 Pruebas lo mandó — y si son cero, cómo activarlo.
    const n = this.sql.exec('SELECT COUNT(*) AS n FROM subs WHERE instr(svs, ?) > 0',
      '|' + SV_PRUEBA + '|').toArray()[0].n;
    this.dmPrueba = { n, c, texto: String(m.content || '').trim().slice(0, 40), t: m.timestamp };
    return true;
  }

  /** El DM al dueño con el resultado de su prueba. Ver `prueba()`. */
  async avisarDueno(p) {
    if (!this.dueno || !this.env.DISCORD_TOKEN) return;
    const h = { Authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'User-Agent': UA,
      'content-type': 'application/json' };
    let hora = '';
    try {
      hora = new Date(Date.parse(p.t)).toLocaleTimeString('es-AR', {
        timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }) + ' ET';
    } catch (e) { hora = ''; }
    const donde = (p.c.svn || p.c.sv) + ' · ' + p.c.nombre;
    const texto = p.n
      ? `🧪 Leí tu «${p.texto}» en ${donde} (${hora}) y te la mandé a **${p.n} ` +
        `dispositivo${p.n === 1 ? '' : 's'}** con 🧪 Pruebas. Si en alguno no apareció, ` +
        'abre ahí <https://underlegends.pages.dev/freestyle-rap/avisos> y toca «Mandar una de ' +
        'prueba»: te dice si es el navegador o el sistema.'
      : `🧪 Leí tu «${p.texto}» en ${donde} (${hora}), pero **ningún dispositivo tiene ` +
        '🧪 Pruebas** marcado, así que no se la mandé a nadie. En cada dispositivo abre ' +
        '<https://underlegends.pages.dev/freestyle-rap/avisos>, toca «🧪 Pruebas» y vuelve a escribir ' +
        '«probando».';
    try {
      const r = await fetch(`${DC}/users/@me/channels`, { method: 'POST', headers: h,
        body: JSON.stringify({ recipient_id: this.dueno }) });
      if (r.status !== 200) {
        this.guardar('ultimo_error', { t: Date.now(), ruta: 'dm-prueba', error: 'canal ' + r.status });
        return;
      }
      const ch = await r.json();
      const r2 = await fetch(`${DC}/channels/${ch.id}/messages`, { method: 'POST', headers: h,
        body: JSON.stringify({ content: texto, allowed_mentions: { parse: [] } }) });
      if (r2.status !== 200) {
        this.guardar('ultimo_error', { t: Date.now(), ruta: 'dm-prueba', error: 'mensaje ' + r2.status });
      }
    } catch (e) {
      this.guardar('ultimo_error', { t: Date.now(), ruta: 'dm-prueba', error: String(e).slice(0, 200) });
    }
  }

  /**
   * Lo que falta publicar en `eventos-hoy`, de a cinco por minuto.
   *
   * ⚠️ TRES INTENTOS Y MEDIA HORA COMO MUCHO, y nunca con el evento
   * empezado: la misma regla que las notificaciones —tarde es peor que
   * nunca—. Si Discord dice que no, queda anotado en `estado` por qué.
   */
  async publicar(ahora) {
    const pend = this.sql.exec('SELECT id, cuerpo FROM posts WHERE hecho = 0 AND ' +
      'intentos < 3 AND creado > ? ORDER BY creado LIMIT 5', ahora - 30 * MIN).toArray();
    let meta = null;
    for (const p of pend) {
      let c = null;
      try { c = JSON.parse(p.cuerpo); } catch (e) { c = null; }
      if (!c || (c.ini && c.ini < ahora - GRACIA)) {
        this.sql.exec('UPDATE posts SET hecho = 2 WHERE id = ?', p.id);
        continue;
      }
      // «Inscribite ya»: ver `invitacionPara()`. La meta, una vez por vuelta y sólo si hay algo que publicar
      if (meta === null) {
        try { meta = JSON.parse((await this.env.KV.get('meta')) || '{}'); } catch (e) { meta = {}; }
      }
      c.ins = invitacionPara(c, this.leer('canales'), meta);
      let estado = 0, msg = '';
      try {
        const r = await fetch(`${DC}/channels/${CANAL_RED}/messages`, {
          method: 'POST',
          headers: {
            Authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'User-Agent': UA,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(mensajeRed(c)),
        });
        estado = r.status;
        if (estado === 200) msg = (await r.json()).id || '';
        else msg = (await r.text()).slice(0, 160);
      } catch (e) {
        msg = String(e).slice(0, 160);
      }
      if (estado === 200) {
        this.sql.exec('UPDATE posts SET hecho = 1, msg = ? WHERE id = ?', msg, p.id);
      } else {
        this.sql.exec('UPDATE posts SET intentos = intentos + 1, error = ? WHERE id = ?',
          `${estado} ${msg}`.slice(0, 200), p.id);
      }
    }
  }

  async despertar(ahora) {
    const r = this.sql.exec('SELECT MIN(desde) AS d FROM avisos WHERE estado = 0')
      .toArray()[0];
    if (!r || r.d == null) return;
    const cuando = Math.max(ahora, r.d);
    const hay = await this.state.storage.getAlarm();
    if (hay == null || hay > cuando) await this.state.storage.setAlarm(cuando);
  }

  // ── el envío ─────────────────────────────────────────────────────────
  //
  // ⚠️ POR ALARMAS Y NO EN EL MISMO PEDIDO. Cada alarma es una invocación
  // nueva, con sus propios 50 subpedidos: la alarma manda un lote y, si
  // quedan, se vuelve a poner. 1.000 suscripciones son 50 alarmas seguidas
  // de ~1 s. Y si una alarma revienta, Cloudflare la reintenta sola.
  async alarm() {
    const ahora = Date.now();
    const av = this.sql.exec('SELECT * FROM avisos WHERE estado = 0 AND desde <= ? ' +
      'ORDER BY desde LIMIT 1', ahora).toArray()[0];
    if (av) {
      try {
        await this.lote(av, ahora);
      } catch (e) {
        // 🔴 UN AVISO QUE REVIENTA SE CIERRA. Si quedara pendiente, la
        // alarma se volvería a poner al instante con el mismo aviso, y así
        // para siempre: un bucle que gasta los 100.000 pedidos del día.
        this.sql.exec('UPDATE avisos SET estado = 3 WHERE id = ?', av.id);
        this.guardar('ultimo_error', { t: ahora, ruta: 'alarm', id: av.id,
          error: String(e).slice(0, 200) });
      }
    }
    await this.despertar(Date.now());
  }

  async lote(av, ahora) {
    // 🔔 CON LA CAMPANA PAUSADA (el Dashboard), el aviso no sale: dejarlo pendiente haría que la alarma lo vuelva a
    // tomar al instante, para siempre. Uno de un evento que empieza en un rato ya no sirve después.
    // 🔴 Y QUEDA EN `NO_SALIO`, NO EN 2 (revisión del 05/10/2026). El 2 es «no es un evento» —un descarte, uno
    // cancelado— y lo filtran la página, los veredictos, las inscripciones, la llamada y las cancelaciones: con el 2,
    // pausar la campana sacaba ese evento del seguimiento en vivo para siempre, también después de reanudarla
    if (this.pausada()) {
      this.sql.exec('UPDATE avisos SET estado = ? WHERE id = ?', NO_SALIO, av.id);
      return;
    }
    // 🔴 VENCIDO NO SE MANDA. Si el Worker estuvo caído y el evento ya
    // empezó, el aviso no sale en vez de llegar tarde (y el evento sigue siendo un evento: `NO_SALIO`).
    if (ahora > av.hasta) {
      this.sql.exec('UPDATE avisos SET estado = ? WHERE id = ?', NO_SALIO, av.id);
      return;
    }
    // el «cancelado» —y el «en pausa» o «se atrasó» (`es:`, ver `anotarEstado()`)— sólo a quien le llegó el aviso del
    // evento (`hs`, ver `cancelaciones()`)
    let tope = Number.MAX_SAFE_INTEGER;
    if (/^(cx|es):/.test(String(av.id))) {
      try { const cc = JSON.parse(av.cuerpo); if (cc.hs != null) tope = Number(cc.hs) || 0; } catch (e) { /* sin tope */ }
    }
    const subs = this.sql.exec('SELECT id, endpoint, p256dh, auth FROM subs ' +
      // «todos» ('') recibe todo MENOS el servidor de prueba
      "WHERE id > ? AND id <= ? AND ((svs = '' AND ? != ?) OR instr(svs, ?) > 0) ORDER BY id LIMIT ?",
    av.cursor, tope, av.sv, SV_PRUEBA, '|' + av.sv + '|', LOTE).toArray();
    if (!subs.length) {
      this.sql.exec('UPDATE avisos SET estado = 1 WHERE id = ?', av.id);
      this.guardar('ultimo_aviso', { t: ahora, id: av.id, sv: av.sv,
        enviados: av.enviados, fallos: av.fallos });
      return;
    }
    // ⚠️ EL TTL ES LO QUE FALTA PARA QUE VENZA. Si el teléfono está
    // apagado y se prende con el evento terminado, el servicio de push lo
    // tira: la notificación no llega tarde, no llega.
    const ttl = Math.max(60, Math.min(Math.floor((av.hasta - ahora) / 1000), 12 * 3600));
    const opc = { ttl, topic: 'ev' + av.id.replace(/\D/g, '').slice(-20) };
    const jwts = new Map();
    const detalle = [];
    let estados = await Promise.all(
      subs.map((s) => empujar(s, av.cuerpo, opc, this.env, jwts, detalle)));
    // un reintento para lo que falló por el otro lado (0, 429, 5xx)
    const otra = estados.map((e, i) => (e === 0 || e === 429 || e >= 500 ? i : -1))
      .filter((i) => i >= 0);
    if (otra.length) {
      const re2 = await Promise.all(
        otra.map((i) => empujar(subs[i], av.cuerpo, opc, this.env, jwts, detalle)));
      estados = estados.slice();
      otra.forEach((i, j) => { estados[i] = re2[j]; });
    }
    let ok = 0, mal = 0;
    this.state.storage.transactionSync(() => {
      estados.forEach((e, i) => {
        const s = subs[i];
        if (e >= 200 && e < 300) {
          ok++;
          this.sql.exec('UPDATE subs SET enviados = enviados + 1 WHERE id = ?', s.id);
        } else if (MUERTA(e)) {
          mal++;
          this.sql.exec('DELETE FROM subs WHERE id = ?', s.id);
        } else {
          mal++;
          this.sql.exec('UPDATE subs SET fallos = fallos + 1 WHERE id = ?', s.id);
        }
      });
      this.sql.exec('UPDATE avisos SET cursor = ?, enviados = enviados + ?, ' +
        'fallos = fallos + ? WHERE id = ?', subs[subs.length - 1].id, ok, mal, av.id);
    });
    if (mal) {
      this.guardar('ultimo_fallo', { t: ahora, id: av.id,
        estados: estados.filter((e) => !(e >= 200 && e < 300)).slice(0, 10),
        detalle: detalle.slice(0, 6) });
    }
  }

  // ── la gente ─────────────────────────────────────────────────────────
  async alta(d) {
    const sub = d.sub || {};
    const mal = suscripcionValida(sub);
    if (mal) return json({ error: mal }, 400);
    // 🛡️ LA CLAVE TIENE QUE SER UN PUNTO DE LA CURVA (04/10/2026, la lista de seguridad). Con 65 bytes al azar pasaba
    // `suscripcionValida()`, el cifrado fallaba en cada aviso (−1, que no borra) y la fila quedaba para siempre
    try {
      await crypto.subtle.importKey('raw', b64u.dec(sub.keys.p256dh), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    } catch (e) { return json({ error: 'p256dh inválida' }, 400); }
    const svs = Array.isArray(d.svs)
      ? d.svs.map((x) => String(x).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6))
        .filter(Boolean).slice(0, 12)
      : null;
    const ahora = Date.now();
    const texto = svs && svs.length ? '|' + svs.join('|') + '|' : '';
    // 🔑 `anterior`: el navegador cambió la suscripción por su cuenta
    // (`pushsubscriptionchange`). Se reemplaza la fila vieja y se
    // conservan sus servidores elegidos.
    if (d.anterior && typeof d.anterior === 'string') {
      const vieja = this.sql.exec('SELECT id FROM subs WHERE endpoint = ?', d.anterior)
        .toArray()[0];
      if (vieja) {
        this.sql.exec('DELETE FROM subs WHERE endpoint = ? AND id != ?', sub.endpoint, vieja.id);
        this.sql.exec('UPDATE subs SET endpoint = ?, p256dh = ?, auth = ?, visto = ?' +
          (svs ? ', svs = ?' : '') + ' WHERE id = ?',
        ...[sub.endpoint, sub.keys.p256dh, sub.keys.auth, ahora]
          .concat(svs ? [texto] : [], [vieja.id]));
        return json({ ok: true, svs: this.svsDe(sub.endpoint) });
      }
    }
    const hay = this.sql.exec('SELECT svs FROM subs WHERE endpoint = ?', sub.endpoint)
      .toArray()[0];
    if (!hay) {
      const n = this.sql.exec('SELECT COUNT(*) AS n FROM subs').toArray()[0].n;
      if (n >= TOPE_SUBS) return json({ error: 'lleno' }, 503);
      // 🛡️ Y NO MÁS DE `ALTAS_HORA` DISPOSITIVOS NUEVOS POR HORA, entre todos (04/10/2026, la lista de seguridad).
      // `alta` no pide cuenta —la credencial es el dispositivo— y un script llenaba el tope de 20.000: la campana
      // quedaba «llena» para todos y cada anuncio eran miles de envíos. El objeto es uno solo, así que la cuenta en
      // memoria vale para todos; hoy se anotan un puñado por día
      this.altas = (this.altas || []).filter((t) => ahora - t < 3600000);
      if (this.altas.length >= ALTAS_HORA) {
        console.warn('[seguridad] más de ' + ALTAS_HORA + ' dispositivos nuevos en una hora: frenado');
        return json({ error: 'muchas altas' }, 429);
      }
      this.altas.push(ahora);
    }
    this.sql.exec('INSERT INTO subs (endpoint, p256dh, auth, svs, alta, visto) ' +
      'VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET ' +
      'p256dh = excluded.p256dh, auth = excluded.auth, visto = excluded.visto' +
      (svs ? ', svs = excluded.svs' : ''),
    sub.endpoint, sub.keys.p256dh, sub.keys.auth, texto, ahora, ahora);
    return json({ ok: true, svs: this.svsDe(sub.endpoint) });
  }

  /** Este dispositivo es de esta persona. Sólo lo llama `rutaAvisos`, con el ID de Discord. */
  vincular(d) {
    if (typeof d.endpoint !== 'string' || !/^[0-9]{5,25}$/.test(String(d.quien || ''))) {
      return json({ error: 'faltan datos' }, 400);
    }
    const r = this.sql.exec('UPDATE subs SET quien = ? WHERE endpoint = ?', String(d.quien), d.endpoint);
    if (!r.rowsWritten) return json({ error: 'esa suscripción no está anotada' }, 404);
    return json({ ok: true });
  }

  desvincular(d) {
    if (typeof d.endpoint !== 'string') return json({ error: 'falta el endpoint' }, 400);
    this.sql.exec("UPDATE subs SET quien = '' WHERE endpoint = ?", d.endpoint);
    return json({ ok: true });
  }

  /** Todos los dispositivos de esa persona, sueltos, y sus votos. Ver `olvidarAvisos()`. */
  // ── 🖼️ EL VS CON LAS DOS TARJETAS ──────────────────────────────────────
  // Dlx, 12/10/2026: «hacerlo más visual para mostrar las imágenes cuando sea un vs, o sea las tarjetas»; a las dos
  // formas, «B» (una imagen armada, con las dos tarjetas y el VS); y «salen en cada nivel con datos y a full». El Worker
  // no dibuja: el vs queda en `vs_cola`, el vigía prende la tarea `kit.yml` (tipo vs, uno por servidor cada `VS_ENTRE`),
  // `bot/kit.py` se lleva los de su servidor (`/avisos/vs-cola`), los dibuja y devuelve cada imagen (`vsListo()`), que se
  // le agrega al mensaje editándolo. Lo que no llegó en `VS_VENCE` ya no se dibuja: esa batalla ya se jugó.
  /** Un vs para dibujar: `{sv, canal, msg, ev, ronda, titulo, sub, a, b}`, cada lado `{n, fl, k, ovr, carta}`. */
  vsEncolar(d, ahora = Date.now()) {
    if (!/^\d{5,25}$/.test(String(d.canal || '')) || !/^\w{1,25}$/.test(String(d.msg || ''))) return { error: 'datos' };
    const id = [...crypto.getRandomValues(new Uint8Array(10))].map((x) => x.toString(16).padStart(2, '0')).join('');
    const lado = (y) => ({ n: String((y && y.n) || '').slice(0, 40), fl: String((y && y.fl) || '').slice(0, 8),
      k: String((y && y.k) || '').slice(0, 60), ovr: Number(y && y.ovr) || 0,
      // 📊🧾 lo de la barra y los costados (13/10/2026): el Score, la letra, los últimos 5 y la racha. ⚠️ Esta lista
      // decide qué llega a la imagen: lo que no esté acá se pierde callado (el Score se perdía así la primera vez)
      sc: Number(y && y.sc) || 0, rg: /^(S{1,3}|[A-E][+\-−]?)$/.test(String((y && y.rg) || '')) ? String(y.rg) : '',
      forma: String((y && y.forma) || '').replace(/[^GP]/g, '').slice(-5), racha: Math.max(0, Math.min(999, Number(y && y.racha) || 0)),
      carta: /^https:\/\/pub-[a-z0-9]+\.r2\.dev\//.test(String((y && y.carta) || '')) ? String(y.carta).slice(0, 300) : '' });
    const h2h = Array.isArray(d.h2h) && d.h2h.length === 2 ? d.h2h.map((x) => Math.max(0, Math.min(999, Number(x) || 0))) : null;
    // 🧩 los otros formatos (19/10/2026): hasta 5 lados y 10 personas, cada una como un lado de siempre
    let grupos = null;
    if (Array.isArray(d.grupos)) {
      let quedan = 10;
      grupos = d.grupos.slice(0, 5).map((g) => (Array.isArray(g) ? g : []).filter(Boolean).slice(0, Math.max(0, quedan)).map((y) => { quedan--; return lado(y); }))
        .filter((g) => g.length);
      if (grupos.length < 2) grupos = null;
    }
    const datos = Object.assign({ ev: String(d.ev || '').slice(0, 80), ronda: String(d.ronda || '').slice(0, 30),
      titulo: String(d.titulo || '').slice(0, 40), sub: String(d.sub || '').slice(0, 120) },
    grupos ? { grupos } : { a: lado(d.a), b: lado(d.b) }, h2h && !grupos ? { h2h } : {});
    this.sql.exec('INSERT INTO vs_cola (id, sv, canal, msg, datos, t) VALUES (?, ?, ?, ?, ?, ?)', id,
      String(d.sv || '').toUpperCase().slice(0, 6), String(d.canal), String(d.msg), JSON.stringify(datos), ahora);
    return { ok: true, id };
  }

  /** 🃏 La fila de «Conseguí tu tarjeta» de un mensaje ya mandado, para las ediciones que cambian sus botones: sale del
   * vs de ese mensaje en `vs_cola` (que dura un día; la apuesta y el voto cierran mucho antes). Sin vs, nada. */
  filaTarjetaDe(canal, msg) {
    try {
      const f = this.sql.exec('SELECT datos FROM vs_cola WHERE canal = ? AND msg = ? ORDER BY t DESC LIMIT 1',
        String(canal || ''), String(msg || '')).toArray()[0];
      return f ? filaTarjeta(JSON.parse(f.datos)) : [];
    } catch (e) { return []; }
  }

  /** Prende la tarea de los servidores con vs esperando, como mucho una vez cada `VS_ENTRE` por servidor. */
  async vsDespachar(ahora) {
    this.sql.exec("UPDATE vs_cola SET estado = 'vencido' WHERE estado IN ('espera', 'dibujando') AND t < ?", ahora - VS_VENCE);
    this.sql.exec('DELETE FROM vs_cola WHERE t < ?', ahora - DIA_MS);
    const svs = this.sql.exec("SELECT DISTINCT sv FROM vs_cola WHERE estado = 'espera'").toArray().map((r) => r.sv);
    if (!svs.length || !this.env.GH_TOKEN || !this.env.GH_REPO) return 0;
    const ult = this.leer('vs_desp') || {};
    let n = 0;
    for (const sv of svs) {
      if (!/^[A-Z]{2,5}$/.test(sv) || ahora - (ult[sv] || 0) < VS_ENTRE) continue;
      const id = [...crypto.getRandomValues(new Uint8Array(12))].map((x) => x.toString(16).padStart(2, '0')).join('');
      const r = await this.gh('/actions/workflows/kit.yml/dispatches', { method: 'POST',
        body: JSON.stringify({ ref: 'main', inputs: { tipo: 'vs', sv, id } }) });
      ult[sv] = ahora;
      if (r.status === 204) n++;
      else this.guardar('vs', { t: ahora, sv, estado: r.status });
    }
    this.guardar('vs_desp', ult);
    return n;
  }

  /** Para la tarea (`/avisos/vs-cola`, con la clave del ciclo): los vs de ese servidor que esperan, que pasan a «dibujando». */
  vsCola(sv, ahora = Date.now()) {
    const filas = this.sql.exec("SELECT id, datos FROM vs_cola WHERE sv = ? AND estado = 'espera' AND t > ? ORDER BY t LIMIT 12",
      String(sv || '').toUpperCase(), ahora - VS_VENCE).toArray();
    for (const f of filas) this.sql.exec("UPDATE vs_cola SET estado = 'dibujando' WHERE id = ?", f.id);
    return { vs: filas.map((f) => Object.assign({ id: f.id }, JSON.parse(f.datos))) };
  }

  /** La imagen de un vs ya dibujada (`/avisos/vs-listo`): se le agrega al mensaje, editándolo. Sólo una imagen nuestra. */
  async vsListo(d) {
    const f = this.sql.exec('SELECT * FROM vs_cola WHERE id = ?', String(d.id || '')).toArray()[0];
    if (!f) return { error: 'no existe' };
    const url = /^https:\/\/pub-[a-z0-9]+\.r2\.dev\/vs\/[\w.-]+\.(?:png|jpg)$/.test(String(d.url || '')) ? String(d.url) : null;
    if (!url || f.estado === 'vencido') {
      this.sql.exec("UPDATE vs_cola SET estado = 'error' WHERE id = ?", f.id);
      return { error: url ? 'vencido' : 'url' };
    }
    const api = `${DC}/channels/${f.canal}/messages/${f.msg}`;
    // 🖼️ como adjunto, que se ve más grande (ver `editarConAdjunto()`). Un adjunto se ve aunque el mensaje tenga el freno
    // de las vistas previas, así que no se le tocan las `flags`; si no se pudo, en el embed de antes
    let r = await editarConAdjunto(api, url, /\.png$/i.test(url) ? 'vs.png' : 'vs.jpg', {},
      { Authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'User-Agent': UA });
    if (!r || !r.ok) {
      r = await fetch(api, {
        method: 'PATCH',
        headers: { Authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'User-Agent': UA, 'content-type': 'application/json' },
        // `flags: 0` saca el freno de las vistas previas con el que salió el mensaje: si no, la imagen no se ve
        body: JSON.stringify({ embeds: [{ image: { url }, color: 0xE41373 }], flags: 0, allowed_mentions: { parse: [] } }),
      });
    }
    this.sql.exec('UPDATE vs_cola SET estado = ? WHERE id = ?', r.ok ? 'hecho' : 'error', f.id);
    return { ok: r.ok, estado: r.status };
  }

  // ── 📣 SEGUIR A UN ORGANIZADOR ───────────────────────────────────────
  // Dlx, 12/10/2026, «5. E»: casi todo se anuncia a último momento, así que el aviso tiene que llegar al anunciarse. La
  // campana ya avisa por servidor (`subs.svs`); esto es por PERSONA: «avisame cuando Kravitz organice algo».
  /** Seguir (`si`) o dejar de seguir a un organizador, o ver a quiénes seguís (`ver`). */
  seguirOrg(d) {
    const quien = String(d.quien || '');
    if (!/^[0-9]{5,25}$/.test(quien)) return { error: 'faltan datos' };
    const lista = () => this.sql.exec('SELECT org, nombre FROM sigue_org WHERE quien = ? ORDER BY t DESC', quien).toArray();
    if (d.accion === 'ver') return { ok: true, orgs: lista() };
    const nombre = String(d.nombre || '').replace(/^[@!\s]+/, '').trim().slice(0, 60);
    const org = claveOrg(nombre);
    if (!org) return { error: 'nombre' };
    if (d.si === false) this.sql.exec('DELETE FROM sigue_org WHERE quien = ? AND org = ?', quien, org);
    else {
      if (this.sql.exec('SELECT COUNT(*) AS n FROM sigue_org WHERE quien = ?', quien).toArray()[0].n >= 30) return { error: 'muchos' };
      this.sql.exec('INSERT OR REPLACE INTO sigue_org (quien, org, nombre, t) VALUES (?, ?, ?, ?)', quien, org, nombre, Date.now());
    }
    return { ok: true, orgs: lista() };
  }

  /** Un anuncio nuevo de `nombre` (el organizador): a la bandeja de quienes lo siguen, y a la cola del push. */
  colaOrg(nombre, evento, ini, url, svn, id, ahora, ya = null) {
    const org = claveOrg(nombre);
    if (!org) return 0;
    const qs = this.sql.exec('SELECT quien, nombre FROM sigue_org WHERE org = ? LIMIT 200', org).toArray();
    for (const q of qs) {
      // 👥 el mismo anuncio con varios organizadores: un aviso por persona, aunque siga a dos (`ya`)
      if (ya) {
        if (ya.has(q.quien)) continue;
        ya.add(q.quien);
      }
      const titulo = '📣 ' + q.nombre + ' organiza ' + String(evento || '').slice(0, 60);
      // ⚠️ sin la hora: el objeto no sabe en qué zona estás, y la página y Discord sí (el anuncio la muestra en la tuya)
      const cuerpo = String(svn || '') + ' · toca para ver el anuncio';
      this.aBandeja(q.quien, 'org:' + id, 'organiza', titulo, cuerpo, url, '', ahora);
      this.sql.exec('INSERT INTO org_cola (quien, clave, titulo, cuerpo, url, t) VALUES (?, ?, ?, ?, ?, ?)', q.quien,
        'org' + id, titulo, cuerpo, url, ahora);
    }
    return qs.length;
  }

  /** El push de la cola de organizadores: de a 30 por minuto, a los dispositivos vinculados de cada uno. */
  async avisarOrgs(ahora) {
    const filas = this.sql.exec('SELECT id, quien, clave, titulo, cuerpo, url FROM org_cola WHERE hecho = 0 ORDER BY id LIMIT 30')
      .toArray();
    let enviados = 0;
    for (const f of filas) {
      this.sql.exec('UPDATE org_cola SET hecho = 1 WHERE id = ?', f.id);
      const subs = this.sql.exec('SELECT id, endpoint, p256dh, auth FROM subs WHERE quien = ?', f.quien).toArray();
      if (!subs.length) continue;
      const c = cuerpoPersonal({ id: f.clave, titulo: f.titulo, cuerpo: f.cuerpo, url: f.url });
      const estados = await Promise.all(subs.map((s) => empujar(s, c, { ttl: 6 * 3600, topic: f.clave.slice(0, 32) }, this.env, new Map())));
      estados.forEach((e, i) => {
        if (e >= 200 && e < 300) enviados++;
        else if (MUERTA(e)) this.sql.exec('DELETE FROM subs WHERE id = ?', subs[i].id);
      });
    }
    this.sql.exec('DELETE FROM org_cola WHERE hecho = 1 AND t < ?', ahora - 2 * DIA_MS);
    if (filas.length) this.guardar('orgs', { t: ahora, filas: filas.length, enviados });
    return enviados;
  }

  // ── 📅 /agendar ──────────────────────────────────────────────────────
  /** Agendar (o `borrar`) un evento de un servidor: como mucho 20 por servidor, y lo pasado sale solo. */
  agendar(d) {
    const sv = String(d.sv || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6);
    const nombre = String(d.nombre || '').slice(0, 80);
    if (!sv || !nombre) return { error: 'faltan datos' };
    const ahora = Date.now();
    if (d.borrar) {
      const r = this.sql.exec('UPDATE agenda SET borrado = 1 WHERE sv = ? AND lower(nombre) = lower(?) AND borrado = 0 AND ini > ?',
        sv, nombre, ahora - 6 * HORA);
      return r.rowsWritten ? { ok: true } : { error: 'no_esta' };
    }
    if (!Number.isFinite(d.ini) || !/^[0-9]{5,25}$/.test(String(d.quien || ''))) return { error: 'faltan datos' };
    const hay = this.sql.exec('SELECT COUNT(*) AS n FROM agenda WHERE sv = ? AND borrado = 0 AND ini > ?', sv, ahora).toArray()[0].n;
    if (hay >= 20) return { error: 'muchos' };
    // el mismo nombre otra vez es corregirlo: se reemplaza el que estaba
    this.sql.exec('UPDATE agenda SET borrado = 1 WHERE sv = ? AND lower(nombre) = lower(?) AND borrado = 0', sv, nombre);
    this.sql.exec('INSERT INTO agenda (sv, g, quien, nombre, ini, formato, t) VALUES (?, ?, ?, ?, ?, ?, ?)', sv,
      String(d.g || ''), String(d.quien), nombre, Math.round(d.ini), String(d.formato || ''), ahora);
    this.sql.exec('DELETE FROM agenda WHERE ini < ?', ahora - 30 * DIA_MS);
    return { ok: true };
  }

  /** Para el ciclo: lo agendado de los últimos 30 días y lo que viene, sin lo borrado. */
  agendaCiclo() {
    return { agenda: this.sql.exec('SELECT id, sv, g, nombre, ini, formato, t, quien FROM agenda WHERE borrado = 0 AND ini > ? ' +
      'ORDER BY ini', Date.now() - 30 * DIA_MS).toArray() };
  }

  // ── 🎬 TUS BATALLAS EN VIDEO ──────────────────────────────────────────
  // Dlx, 12/10/2026: «las 2 [un link o un canal], pero asegurate que haya restricciones». Acá sólo se anota el pedido
  // y se lleva la cuenta; si el video entra, queda en revisión o no, lo decide el ciclo (`bot/videos_propios.py`).
  /** Pedir (`url` de un video o un canal de YouTube), ver tus pedidos (`ver`) o quitar uno de tu perfil (`quitar`). */
  misVideos(d) {
    const quien = String(d.quien || ''), de = String(d.de || '');
    if (!/^[0-9]{5,25}$/.test(quien) || !claveValida(de)) return json({ error: 'faltan datos' }, 400);
    const ahora = Date.now();
    const lista = () => this.sql.exec('SELECT id, tipo, url, t, estado, motivo FROM videos_pedidos WHERE quien = ? ' +
      'ORDER BY t DESC LIMIT 30', quien).toArray();
    if (d.accion === 'ver') return json({ ok: true, pedidos: lista() });
    // 🎬 «CONTANOS CÓMO APARECÉS» (Dlx, 16/10/2026, con Liberia —en las plazas es «SEBA»— y videos de equipos que no
    // dicen su nombre: «que la persona que suba obtenga preguntas en caso de que su aka no esté reconocido… ¿cómo
    // eres, cuándo apareces en el video, cómo luces, en qué minuto? para verificar que no estemos poniendo a alguien
    // que no es en tu perfil»). Sólo sobre un pedido SUYO que el ciclo dejó en `preguntar`; vuelve a la cola con lo
    // que contestó y el ciclo se lo pasa a Dlx (`bot/videos_propios.py`)
    if (d.accion === 'responder') {
      const nombre = String(d.nombre || '').trim(), como = String(d.como || '').trim(), minuto = String(d.minuto || '').trim();
      if (!Number.isInteger(d.id) || nombre.length < 2 || como.length < 4 || !/^(?:\d{1,2}:)?\d{1,2}:\d{2}$/.test(minuto)) {
        return json({ error: 'respuestas' }, 400);
      }
      const p = this.sql.exec("SELECT id FROM videos_pedidos WHERE id = ? AND quien = ? AND estado = 'preguntar'", d.id, quien)
        .toArray()[0];
      if (!p) return json({ error: 'pedido' }, 404);
      this.sql.exec("UPDATE videos_pedidos SET estado = 'espera', motivo = '', resp = ? WHERE id = ?",
        JSON.stringify({ nombre: nombre.slice(0, 60), como: como.slice(0, 160), minuto }), d.id);
      return json({ ok: true, pedidos: lista() });
    }
    if (d.accion === 'quitar') {
      if (!/^[\w-]{11}$/.test(String(d.vid || ''))) return json({ error: 'video' }, 400);
      this.sql.exec('INSERT OR REPLACE INTO videos_quitados (clave, vid, t) VALUES (?, ?, ?)', de, String(d.vid), ahora);
      return json({ ok: true });
    }
    if (d.accion !== 'pedir') return json({ error: 'acción' }, 400);
    // 🧹 los pedidos y los reportes duran 90 días (lo dice la privacidad)
    this.sql.exec('DELETE FROM videos_pedidos WHERE t < ?', ahora - 90 * DIA_MS);
    this.sql.exec('DELETE FROM videos_reportes WHERE t < ?', ahora - 90 * DIA_MS);
    const url = String(d.url || '').trim();
    const esVideo = /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/)|youtu\.be\/)[\w-]{11}/i.test(url);
    const esCanal = /^https?:\/\/(?:www\.|m\.)?youtube\.com\/(?:@[\w.-]+|channel\/UC[\w-]{22}|c\/[\w.-]+|user\/[\w.-]+)\/?(?:videos|streams|featured)?\/?(?:\?.*)?$/i.test(url);
    if (!esVideo && !esCanal) return json({ error: 'link' }, 400);
    // ⚠️ LOS TOPES, ACÁ: cinco pedidos por día y diez esperando a la vez, por persona
    const hoy = this.sql.exec('SELECT COUNT(*) AS n FROM videos_pedidos WHERE quien = ? AND t > ?', quien, ahora - DIA_MS)
      .toArray()[0].n;
    if (hoy >= 5) return json({ error: 'muchos' }, 429);
    const espera = this.sql.exec("SELECT COUNT(*) AS n FROM videos_pedidos WHERE quien = ? AND estado = 'espera'", quien)
      .toArray()[0].n;
    if (espera >= 10) return json({ error: 'espera' }, 429);
    if (this.sql.exec("SELECT 1 FROM videos_pedidos WHERE quien = ? AND url = ? AND estado != 'no'", quien, url).toArray().length) {
      return json({ error: 'ya' }, 409);
    }
    this.sql.exec('INSERT INTO videos_pedidos (quien, clave, tipo, url, t) VALUES (?, ?, ?, ?, ?)', quien, de,
      esVideo ? 'link' : 'canal', url, ahora);
    return json({ ok: true, pedidos: lista() });
  }

  /** «Esto no es suyo»: un reporte por persona y video. El tuyo no lo podés reportar. */
  videoReportar(d) {
    const quien = String(d.quien || ''), de = String(d.de || ''), clave = String(d.clave || ''), vid = String(d.vid || '');
    if (!/^[0-9]{5,25}$/.test(quien) || !claveValida(clave) || !/^[\w-]{11}$/.test(vid)) return json({ error: 'faltan datos' }, 400);
    if (clave === de) return json({ error: 'tuyo' }, 400);
    this.sql.exec('INSERT OR IGNORE INTO videos_reportes (vid, clave, quien, t) VALUES (?, ?, ?, ?)', vid, clave, quien, Date.now());
    return json({ ok: true });
  }

  /** Para el ciclo: los pedidos que esperan, los reportes por video, lo quitado y lo que Dlx decidió. */
  videosCiclo() {
    const reportes = {};
    for (const r of this.sql.exec('SELECT vid, COUNT(*) AS n FROM videos_reportes GROUP BY vid').toArray()) reportes[r.vid] = r.n;
    const decididos = {};
    for (const r of this.sql.exec('SELECT id, si FROM videos_decididos').toArray()) decididos[r.id] = r.si === 1;
    return {
      pedidos: this.sql.exec("SELECT id, clave, tipo, url, resp FROM videos_pedidos WHERE estado = 'espera' ORDER BY t LIMIT 60").toArray(),
      reportes, decididos,
      quitados: this.sql.exec('SELECT clave, vid FROM videos_quitados').toArray(),
    };
  }

  /** Lo que el ciclo decidió de cada pedido, y lo que queda para Dlx (`revisar`, para el Dashboard). */
  videosEstados(d) {
    let n = 0;
    for (const [id, x] of Object.entries((d && d.estados) || {})) {
      if (!/^\d{1,12}$/.test(id) || !Array.isArray(x)) continue;
      const est = ['ok', 'no', 'revisar', 'preguntar'].includes(x[0]) ? x[0] : 'no';
      this.sql.exec('UPDATE videos_pedidos SET estado = ?, motivo = ? WHERE id = ?', est, String(x[1] || '').slice(0, 120), Number(id));
      if (est !== 'revisar') this.sql.exec('DELETE FROM videos_decididos WHERE id = ?', Number(id));
      n++;
    }
    if (Array.isArray(d && d.revisar)) this.guardar('videos_revisar', d.revisar.slice(0, 40));
    return { ok: true, n };
  }

  /** Dlx aprueba o no un video en revisión: lo aplica el ciclo, y sale ya del Dashboard. */
  duenoVideo(d) {
    this.sql.exec('INSERT OR REPLACE INTO videos_decididos (id, si, t) VALUES (?, ?, ?)', Number(d.id), d.si ? 1 : 0, Date.now());
    this.guardar('videos_revisar', (this.leer('videos_revisar') || []).filter((x) => Number(x[0]) !== Number(d.id)));
    return { ok: true };
  }

  async olvidar(d) {
    if (!/^[0-9]{5,25}$/.test(String(d.quien || ''))) return json({ error: 'falta quién' }, 400);
    // 🧠 y sus datos de /card (`persona`), que viven acá desde el 06/10/2026: los busca por su clave, que manda el
    // Worker (`borrarMisDatos()`)
    if (d.clave && typeof d.clave === 'string') this.sql.exec('DELETE FROM persona WHERE k = ?', 'p:' + d.clave.slice(0, 100));
    // 👥 y su lugar en una crew, sus invitaciones y sus pedidos (19/10/2026). Si era el líder, la crew pasa al colíder
    // más viejo; si era el único, se cierra (`crewOlvidar()`)
    if (d.clave && typeof d.clave === 'string') { try { CW.crewOlvidar(this, d.clave.slice(0, 100)); } catch (e) { /* sigue con lo demás */ } }
    try { this.sql.exec("UPDATE crew_miembros SET quien = '' WHERE quien = ?", String(d.quien)); } catch (e) { /* sin crews */ }
    const r = this.sql.exec("UPDATE subs SET quien = '' WHERE quien = ?", String(d.quien));
    // 🔑 Y SUS VOTOS: van con su Discord ID, así que son un dato suyo. Lo que
    // ya se aplicó (un Elegido, un ×2) quedó en el ciclo y no cambia.
    const v = this.sql.exec('DELETE FROM votos WHERE quien = ?', String(d.quien));
    // 🗳️ y los de «¿quién gana la liga?» (14/10/2026): también llevan su Discord ID
    this.sql.exec('DELETE FROM liga_voto WHERE quien = ?', String(d.quien));
    // 🔑 Y SU BILLETERA: lo cobrado se borra; lo que puso queda SIN NOMBRE —si
    // se borrara, al que cazó ese precio se le irían sus puntos de Temporada
    const b = this.sql.exec('DELETE FROM tienda WHERE quien = ?', String(d.quien));
    this.sql.exec("UPDATE precios SET quien = 'borrado' WHERE quien = ?", String(d.quien));
    // y sus sesiones: en ningún dispositivo queda adentro
    this.sql.exec('DELETE FROM sesiones WHERE quien = ?', String(d.quien));
    // 🔑 Y A QUIÉN SEGUÍA, Y QUÉ SERVIDOR ELIGIÓ: también van con su Discord ID
    const s = this.sql.exec('DELETE FROM sigue WHERE quien = ?', String(d.quien));
    this.sql.exec('DELETE FROM liga_sigue WHERE quien = ?', String(d.quien));
    this.sql.exec('DELETE FROM servidor WHERE quien = ?', String(d.quien));
    // 🔥 y los días de su racha y lo que jugó: también van con su Discord ID
    this.sql.exec('DELETE FROM activo WHERE quien = ?', String(d.quien));
    this.sql.exec('DELETE FROM jugo_temp WHERE quien = ?', String(d.quien));
    // 🙈 y si había ocultado su foto: también es un dato suyo (y la lista del ciclo se rehace sin él)
    if (this.sql.exec('DELETE FROM foto_oculta WHERE quien = ?', String(d.quien)).rowsWritten) await this.espejarOcultas();
    // 🔑 Y SUS REPORTES, y la cola de KV sin ellos: van con su Discord ID
    const rp = this.sql.exec('DELETE FROM reportes WHERE quien = ?', String(d.quien));
    if (rp.rowsWritten) await this.colaReportes(Date.now());
    // 👏 y a quién felicitó: también va con su Discord ID
    const ap = this.sql.exec('DELETE FROM aplausos WHERE quien = ?', String(d.quien));
    // 📖 y qué historias vio
    this.sql.exec('DELETE FROM hvistas WHERE quien = ?', String(d.quien));
    // 🎟️ y su Pase: las Tareas que cumplió y las llaves en vivo que miró
    this.sql.exec('DELETE FROM pase_hecho WHERE quien = ?', String(d.quien));
    this.sql.exec('DELETE FROM pase_vivo WHERE quien = ?', String(d.quien));
    this.sql.exec('DELETE FROM pase_log WHERE quien = ?', String(d.quien));
    this.sql.exec('DELETE FROM pase_hito WHERE quien = ?', String(d.quien));
    // 💎🖼️ y lo del 25/10/2026: el premium, sus avisos, su color, sus marcos y lo del sorteo
    for (const t of ['pase_premium', 'pase_aviso', 'pase_color', 'marcos', 'marco_elige', 'sorteo_part', 'tag_elige']) {
      this.sql.exec('DELETE FROM ' + t + ' WHERE quien = ?', String(d.quien));
    }
    // ⭐ y lo que le sumaba nivel
    this.sql.exec('DELETE FROM xp_log WHERE quien = ?', String(d.quien));
    // 🙋 y sus pedidos
    this.sql.exec('DELETE FROM pedidos WHERE quien = ?', String(d.quien));
    // 📣 y las promos que abrió y las que alargó
    this.sql.exec('DELETE FROM promo_visto WHERE quien = ?', String(d.quien));
    this.sql.exec('DELETE FROM promo_extra WHERE quien = ?', String(d.quien));
    // 📊 y los días que usó el bot o la página (el Dashboard): guardaban su Discord ID 35 días (revisión del 05/10/2026)
    this.sql.exec('DELETE FROM uso WHERE quien = ?', String(d.quien));
    // 🔔 y su bandeja
    this.sql.exec('DELETE FROM bandeja WHERE quien = ?', String(d.quien));
    // 🖼️ y su fondo, con las imágenes (13/10/2026)
    for (const f of this.sql.exec('SELECT url, pend FROM fondos WHERE quien = ?', String(d.quien)).toArray()) {
      for (const u of [f.url, f.pend]) {
        const k = String(u || '').split('.r2.dev/')[1];
        if (k && k.startsWith('fondos/')) { try { await this.env.CARTAS.delete(k); } catch (e) { /* queda huérfano */ } }
      }
    }
    this.sql.exec('DELETE FROM fondos WHERE quien = ?', String(d.quien));
    // 📸 y sus fotos de tarjeta, con las imágenes (13/10/2026)
    for (const f of this.sql.exec('SELECT k, carta, pend FROM fotos_carta WHERE quien = ?', String(d.quien)).toArray()) {
      try { if (f.k) await this.env.CARTAS.delete(claveFoto(this.env, f.k, f.carta)); } catch (e) { /* queda huérfano */ }
      const kp = String(f.pend || '').split('.r2.dev/')[1];
      if (kp && kp.startsWith('pendientes/')) { try { await this.env.CARTAS.delete(kp); } catch (e) { /* queda huérfano */ } }
    }
    this.sql.exec('DELETE FROM fotos_carta WHERE quien = ?', String(d.quien));
    // 🤝 y sus postulaciones de /sumate, y cuántas veces cambió algo hoy
    this.sql.exec('DELETE FROM postulaciones WHERE quien = ?', String(d.quien));
    // 📣 a quién seguís como organizador, y sus avisos (12/10/2026)
    this.sql.exec('DELETE FROM sigue_org WHERE quien = ?', String(d.quien));
    this.sql.exec('DELETE FROM org_cola WHERE quien = ?', String(d.quien));
    // 🎬 tus pedidos de videos y tus reportes (12/10/2026)
    this.sql.exec('DELETE FROM videos_pedidos WHERE quien = ?', String(d.quien));
    this.sql.exec('DELETE FROM videos_reportes WHERE quien = ?', String(d.quien));
    // 📅 lo que agendó con /agendar queda (es el evento de su servidor), pero sin su ID
    this.sql.exec("UPDATE agenda SET quien = '' WHERE quien = ?", String(d.quien));
    this.sql.exec('DELETE FROM cambios_dia WHERE quien = ?', String(d.quien));
    // 🔴 Y LO QUE QUEDABA CON SU ID EN LAS TABLAS DE TRABAJO (revisión del 03/10/2026): de qué perfil es (`idk`), sus
    // inscripciones leídas de Discord (`inscritos`) y las marcas de «ya avisado» que llevan su ID —quién siguió a
    // quién, sus turnos— (`hechos`, 30 días). Los IDs son números de 17 a 20 cifras: el LIKE no agarra otro
    this.sql.exec('DELETE FROM idk WHERE id = ?', String(d.quien));
    this.sql.exec('DELETE FROM inscritos WHERE autor_id = ?', String(d.quien));
    this.sql.exec('DELETE FROM hechos WHERE id LIKE ? OR id LIKE ?', '%:' + String(d.quien), '%:' + String(d.quien) + ':%');
    return json({ ok: true, soltados: r.rowsWritten || 0, votos: v.rowsWritten || 0, tienda: b.rowsWritten || 0,
      sigue: s.rowsWritten || 0, reportes: rp.rowsWritten || 0, aplausos: ap.rowsWritten || 0 });
  }

  // ── un error en una llave ────────────────────────────────────────────
  /**
   * Guarda un reporte y deja los últimos en KV (`reportes`) para el ciclo.
   * ⚠️ Con tope por persona (`REPORTE_TOPE` en 24 h), y el mismo reporte dos
   * veces es uno: la página puede reintentar sin duplicar.
   */
  async reportar(d) {
    const quien = String(d.quien || '');
    if (!/^[0-9]{5,25}$/.test(quien) || typeof d.llave !== 'string' || typeof d.que !== 'string') {
      return json({ error: 'faltan datos' }, 400);
    }
    const ahora = Date.now();
    const texto = String(d.texto || '').slice(0, 300);
    const batalla = String(d.batalla || '').slice(0, 120);
    const igual = this.sql.exec('SELECT id FROM reportes WHERE quien = ? AND llave = ? AND que = ? ' +
      'AND texto = ? AND t > ?', quien, d.llave, d.que, texto, ahora - DIA_MS).toArray()[0];
    if (igual) return json({ ok: true, id: igual.id, repetido: true });
    const n = this.sql.exec('SELECT COUNT(*) AS n FROM reportes WHERE quien = ? AND t > ?',
      quien, ahora - DIA_MS).toArray()[0].n;
    if (n >= REPORTE_TOPE) return json({ error: 'tope' }, 429);
    this.sql.exec('INSERT INTO reportes (quien, llave, que, texto, batalla, t) VALUES (?, ?, ?, ?, ?, ?)',
      quien, d.llave, d.que, texto, batalla, ahora);
    const id = this.sql.exec('SELECT MAX(id) AS id FROM reportes').toArray()[0].id;
    await this.colaReportes(ahora);
    return json({ ok: true, id });
  }

  /** Los últimos reportes a KV (`reportes`), para `bot/reportes.py`. */
  async colaReportes(ahora) {
    // 🗑️ a los 14 días se va, con su evidencia (Dlx, 13/10/2026: «usualmente las quejas pasan dentro de 1-2 semanas,
    // luego de eso diría que se borren»; antes era un mes). Ver `REPORTE_VIDA_DIAS`
    this.sql.exec('DELETE FROM reportes WHERE t < ?', ahora - REPORTE_VIDA_DIAS * DIA_MS);
    // 📣 con lo que decidió Dlx (`estado`, `fix`): el ciclo aplica lo de `corregir` (13/10/2026)
    const cola = this.sql.exec('SELECT id, quien, llave, que, texto, batalla, t, estado, fix FROM reportes ' +
      'ORDER BY id DESC LIMIT ?', REPORTES_COLA).toArray().reverse();
    try {
      await this.env.KV.put('reportes', JSON.stringify(cola));
    } catch (e) {
      this.guardar('ultimo_error', { t: ahora, ruta: '/reportar', error: String(e).slice(0, 160) });
    }
  }

  /**
   * 📣 Dlx decide qué hacer con un reporte (13/10/2026, *«Sí, todas»*): `listo` y `prueba` lo cierran ya; `nombre` y
   * `ganador` quedan en `corregir` para el ciclo (`bot/reportes.py --corregir`), que lo aplica y avisa por
   * `reportesEstados()`. Se puede cambiar de idea mientras no esté aplicado. Devuelve la lista nueva del Dashboard.
   */
  async duenoReporte(d) {
    const ahora = Date.now();
    const r = this.sql.exec('SELECT id, estado FROM reportes WHERE id = ?', Number(d.id)).toArray()[0];
    if (!r) return { error: 'ya no está' };
    if (r.estado === 'aplicado') return { error: 'ya está aplicado' };
    const por = this.nombrePor(d.por);
    this.sql.exec('UPDATE reportes SET estado = ?, fix = ?, resultado = ?, t_estado = ?, por = ? WHERE id = ?',
      d.fix ? 'corregir' : String(d.accion), d.fix ? JSON.stringify(Object.assign({}, d.fix, { por })) : '', '', ahora, por, Number(d.id));
    if (d.causa) {
      const t0 = (this.sql.exec('SELECT t FROM reportes WHERE id = ?', Number(d.id)).toArray()[0] || {}).t || 0;
      this.sql.exec('INSERT OR REPLACE INTO reportes_causas (id, causa, t, espera) VALUES (?, ?, ?, ?)', Number(d.id), String(d.causa), ahora, t0 ? ahora - t0 : 0);
    }
    this.sql.exec('DELETE FROM reportes_causas WHERE t < ?', ahora - 120 * DIA_MS);
    await this.colaReportes(ahora);
    return { ok: true, reportes: this.reportesDueno(ahora), reportes_causas: this.causasDueno(ahora) };
  }

  /**
   * 🔁 AVISARLE A UNO QUE VUELVA (25/10/2026): a su campana, con un texto fijo (`PLANTILLAS_VUELVE`). Sólo a quien tiene
   * cuenta (se entera por la página); uno por persona cada 7 días y 40 por día entre todo el staff, para que la lista no
   * se vuelva una ametralladora. Queda quién lo mandó
   */
  avisoVuelve(d) {
    const ahora = Date.now();
    const k = String(d.k || ''), P = PLANTILLAS_VUELVE[d.que];
    if (!P || !/^[a-z0-9]{1,40}$/.test(k)) return { error: 'faltan datos' };
    const ids = this.sql.exec('SELECT id FROM idk WHERE k = ?', k).toArray().map((x) => x.id);
    if (!ids.length) return { error: 'sin_cuenta' };
    if (enControlVuelve(k)) return { error: 'control' };
    const ya = this.sql.exec('SELECT t FROM vuelve WHERE k = ?', k).toArray()[0];
    if (ya && ahora - ya.t < 7 * DIA_MS) return { error: 'reciente', t: ya.t };
    if ((this.sql.exec('SELECT COUNT(*) AS n FROM vuelve WHERE t > ?', ahora - DIA_MS).toArray()[0] || {}).n >= 40) return { error: 'tope' };
    for (const id of ids) this.aBandeja(id, 'vuelve:' + d.que, 'liga', P[0], P[1], P[2], '', ahora);
    this.sql.exec('INSERT OR REPLACE INTO vuelve (k, que, por, t) VALUES (?, ?, ?, ?)', k, String(d.que), this.nombrePor(d.por), ahora);
    this.sql.exec('DELETE FROM vuelve WHERE t < ?', ahora - 90 * DIA_MS);
    return { ok: true, avisados: this.vuelveDueno() };
  }

  /**
   * 💰 LOS PUNTOS DE TIENDA, PARA EL DASHBOARD (25/10/2026, el research: «la economía mínima»: las apuestas y lo que se
   * compra son lo más expuesto y no se veían). Sale de las dos tablas de la billetera —`tienda` (lo que entra y sale, con
   * el origen al principio del id: `ap:`, `rdia:`, `crew:`…) y `precios` (lo puesto en una cabeza)—, igual que `saldo()`:
   * · `dias`: los últimos 14 días en hora del este, `[día, entró, salió]`;
   * · `origen`: de esos 14 días, por origen, `{origen: [entró, salió]}`;
   * · `personas`, `mediana`, `total` y `top`: quién tiene cuánto (los 20 de arriba, por su perfil) y qué parte es de ellos;
   * · `raros`: quien sumó 5.000 o más en 24 h, para mirarlo (no es una acusación: puede ser un premio grande).
   * Lee filas, no escribe nada.
   */
  economiaDueno(ahora, desde, inicial) {
    if (!Number.isInteger(inicial)) return null;
    const dia = (t) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const d14 = Math.max(desde, ahora - 14 * DIA_MS);
    const dias = {}, origen = {};
    const anotar = (o, t, m) => {
      const d = dias[dia(t)] = dias[dia(t)] || [0, 0];
      const x = origen[o] = origen[o] || [0, 0];
      if (m >= 0) { d[0] += m; x[0] += m; } else { d[1] -= m; x[1] -= m; }
    };
    for (const f of this.sql.exec('SELECT id, monto, t FROM tienda WHERE t >= ?', d14).toArray()) anotar(String(f.id).split(':')[0], f.t, f.monto);
    for (const f of this.sql.exec("SELECT monto, t FROM precios WHERE t >= ? AND estado != 'devuelto'", d14).toArray()) anotar('precio', f.t, -f.monto);
    const saldo = new Map();
    for (const f of this.sql.exec('SELECT quien, SUM(monto) AS n FROM tienda WHERE t >= ? GROUP BY quien', desde).toArray()) saldo.set(f.quien, inicial + f.n);
    for (const f of this.sql.exec("SELECT quien, SUM(monto) AS n FROM precios WHERE t >= ? AND estado != 'devuelto' GROUP BY quien", desde).toArray()) {
      saldo.set(f.quien, (saldo.has(f.quien) ? saldo.get(f.quien) : inicial) - f.n);
    }
    const xs = [...saldo.entries()].sort((a, b) => b[1] - a[1]);
    const total = xs.reduce((t, x) => t + x[1], 0);
    const k = (id) => ((this.sql.exec('SELECT k FROM idk WHERE id = ?', id).toArray()[0] || {}).k || '');
    const top = xs.slice(0, 20).map(([id, n]) => [k(id), n]);
    const raros = this.sql.exec('SELECT quien, SUM(monto) AS n FROM tienda WHERE t > ? AND monto > 0 GROUP BY quien HAVING n >= 5000 ORDER BY n DESC LIMIT 10',
      ahora - DIA_MS).toArray().map((f) => [k(f.quien), f.n]);
    return { inicial, personas: xs.length, total, mediana: xs.length ? xs[Math.floor(xs.length / 2)][1] : 0,
      top, top_parte: total > 0 ? top.reduce((t, x) => t + Math.max(0, x[1]), 0) / total : 0,
      dias: Object.entries(dias).sort().map(([d, [e, sa]]) => [d, e, sa]), origen, raros };
  }

  /**
   * 🗂️ LA FICHA DE UNA PERSONA PARA EL STAFF (25/10/2026, el research del Dashboard: «junta en un lugar lo que hoy está en
   * varias áreas»). Lo que sabe el objeto de ese perfil: si tiene cuenta y desde cuándo, sus roles del Dashboard, sus
   * Puntos, los reportes y pedidos que mandó, si se le avisó que vuelva y las notas del staff. Lo público (sus eventos,
   * sus duelos, su puesto) lo pone la página, que ya lo tiene. Sin Discord IDs: la cuenta es «sí, desde tal día»
   */
  duenoFicha(d) {
    const ahora = Date.now();
    const k = String(d.k || '');
    const ids = this.sql.exec('SELECT id, t FROM idk WHERE k = ?', k).toArray();
    const lista = ids.map((x) => x.id);
    const enIds = (tabla, cols, extra) => (lista.length ? this.sql.exec('SELECT ' + cols + ' FROM ' + tabla + ' WHERE quien IN (' + lista.map(() => '?').join(',') + ')' + (extra || ''), ...lista).toArray() : []);
    const b = d.billetera;
    const saldo = b && lista.length ? lista.reduce((t, id) => t + this.saldo(id, Number(b.desde) || 0, 0), Number(b.inicial)) : null;
    const v = this.sql.exec('SELECT que, por, t FROM vuelve WHERE k = ?', k).toArray()[0] || null;
    return {
      k,
      cuenta: lista.length ? { desde: Math.min(...ids.map((x) => x.t || ahora)) } : null,
      roles: [...new Set(lista.flatMap((id) => this.rolesPanelDe(id)))],
      saldo,
      reportes: enIds('reportes', 'id, llave, que, estado, t', ' ORDER BY t DESC LIMIT 10'),
      pedidos: this.sql.exec("SELECT id, tipo, estado, t FROM pedidos WHERE k = ? ORDER BY t DESC LIMIT 10", k).toArray(),
      vuelve: v,
      notas: this.notasDe(k),
    };
  }

  /** 🗂️ Las sanciones que siguen en pie: con fecha de fin que no pasó, o sin fecha y de los últimos 30 días. `{k: hasta}`. */
  sancionesActivas(ahora) {
    return Object.fromEntries(this.sql.exec("SELECT k, MAX(hasta) AS h FROM notas WHERE et = 'sancion' AND (hasta > ? OR (hasta = 0 AND t > ?)) GROUP BY k",
      ahora, ahora - 30 * DIA_MS).toArray().map((f) => [f.k, f.h]));
  }

  /** 📊 Suma uno a un número del Dashboard en el día de hoy (hora del este). */
  dashMed(k, n) {
    const dia = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    this.sql.exec('INSERT INTO dash_med (dia, k, n) VALUES (?, ?, ?) ON CONFLICT(dia, k) DO UPDATE SET n = n + excluded.n', dia, k, n || 1);
  }

  /**
   * 📊 LOS NÚMEROS DEL PROPIO DASHBOARD (25/10/2026, el research: «para el Dashboard, medir la operación del dueño, no las
   * visitas»). Cuánto tarda en cerrarse un reporte y un pedido (la mitad y el peor 10 %, en 30 días), cuántas veces dos
   * del staff miraban el mismo caso y cuántos «Deshacer» se usaron (7 días). Sólo números
   */
  dashMedResumen(ahora) {
    const q = (xs) => {
      if (!xs.length) return null;
      const s = [...xs].sort((a, b) => a - b);
      return { n: s.length, mitad: s[Math.floor(s.length / 2)], p90: s[Math.min(s.length - 1, Math.floor(s.length * 0.9))] };
    };
    const rep = q(this.sql.exec('SELECT espera FROM reportes_causas WHERE t > ? AND espera > 0', ahora - 30 * DIA_MS).toArray().map((f) => f.espera));
    const ped = q(this.sql.exec("SELECT resuelto - t AS e FROM pedidos WHERE resuelto > ? AND estado != ''", ahora - 30 * DIA_MS).toArray().map((f) => f.e).filter((e) => e > 0));
    const desde = new Date(ahora - 7 * DIA_MS).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const c = Object.fromEntries(this.sql.exec('SELECT k, SUM(n) AS n FROM dash_med WHERE dia > ? GROUP BY k', desde).toArray().map((f) => [f.k, f.n]));
    this.sql.exec('DELETE FROM dash_med WHERE dia < ?', new Date(ahora - 120 * DIA_MS).toISOString().slice(0, 10));
    return { reportes: rep, pedidos: ped, doble: c.doble || 0, deshacer: c.deshacer || 0 };
  }

  notasDe(k) {
    return this.sql.exec('SELECT id, et, texto, hasta, por, t FROM notas WHERE k = ? ORDER BY t DESC LIMIT 50', k).toArray();
  }

  /**
   * 🗂️ Una nota del staff sobre alguien, o borrar una: la propia la borra quien la escribió; cualquiera, Dlx o un Admin
   * (`jefe`). Ya validada por `validarNota()`. Devuelve las notas de esa persona.
   */
  duenoNota(d) {
    const ahora = Date.now();
    if (d.borrar) {
      const n = this.sql.exec('SELECT k, por_id FROM notas WHERE id = ?', Number(d.borrar)).toArray()[0];
      if (!n) return { error: 'ya no está' };
      if (n.por_id !== String(d.por) && !d.jefe) return { error: 'no' };
      this.sql.exec('DELETE FROM notas WHERE id = ?', Number(d.borrar));
      return { ok: true, notas: this.notasDe(n.k) };
    }
    if ((this.sql.exec('SELECT COUNT(*) AS n FROM notas WHERE k = ?', d.k).toArray()[0] || {}).n >= 200) return { error: 'demasiadas' };
    this.sql.exec('INSERT INTO notas (k, et, texto, hasta, por, por_id, t) VALUES (?, ?, ?, ?, ?, ?, ?)', d.k, d.et, d.texto,
      d.dias ? ahora + d.dias * DIA_MS : 0, this.nombrePor(d.por), String(d.por), ahora);
    return { ok: true, notas: this.notasDe(d.k) };
  }

  /** 🧪 Para el ciclo: `{lista: [[clave, día del este, 'aviso' | 'control']]}`, los avisados y el grupo sin aviso. */
  vuelveCiclo() {
    const dia = (t) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    return { lista: [...this.sql.exec('SELECT k, t FROM vuelve').toArray().map((f) => [f.k, dia(f.t), 'aviso']),
      ...this.sql.exec('SELECT k, t FROM vuelve_control').toArray().map((f) => [f.k, dia(f.t), 'control'])] };
  }

  /** 🔁 A quién se le avisó que vuelva en los últimos 60 días: `{k: [t, qué, quién]}`. */
  vuelveDueno() {
    return Object.fromEntries(this.sql.exec('SELECT k, que, por, t FROM vuelve').toArray().map((f) => [f.k, [f.t, f.que, f.por]]));
  }

  /** 🔎 Por qué se cerraron los reportes: cuántos de cada causa en 7, 30 y 120 días (sin quién: sólo cuántos). */
  causasDueno(ahora) {
    return this.sql.exec('SELECT causa, SUM(t > ?) AS n7, SUM(t > ?) AS n30, COUNT(*) AS n120 FROM reportes_causas GROUP BY causa',
      ahora - 7 * DIA_MS, ahora - 30 * DIA_MS).toArray().map((f) => ({ causa: f.causa, n7: f.n7 || 0, n30: f.n30 || 0, n120: f.n120 || 0 }));
  }

  /**
   * 👀 «LO ESTOY VIENDO» (25/10/2026, el research: Battlefy y Help Scout). Quien abre un caso en Pendientes lo anota acá
   * (`k`, la clave del caso en la bandeja); los demás ven su nombre en la fila. Dura 10 minutos sin volver a anotarlo. Sin
   * `k` sólo lee. Devuelve los de los otros: el propio no hace falta verlo
   */
  duenoViendo(d) {
    const ahora = Date.now();
    const quien = String(d.quien || '');
    this.sql.exec('DELETE FROM viendo WHERE t < ?', ahora - 10 * 60000);
    const k = String(d.k || '');
    if (k && /^[a-z][0-9A-Za-z:_.-]{1,80}$/.test(k)) {
      // 📊 si otro ya lo tenía abierto (y no era yo un rato antes), cuenta como un caso mirado por dos
      const otro = this.sql.exec('SELECT quien FROM viendo WHERE k = ?', k).toArray()[0];
      if (otro && otro.quien !== quien) this.dashMed('doble', 1);
      this.sql.exec('DELETE FROM viendo WHERE quien = ?', quien);
      this.sql.exec('INSERT OR REPLACE INTO viendo (k, por, quien, t) VALUES (?, ?, ?, ?)', k, this.nombrePor(quien), quien, ahora);
    }
    return { viendo: this.sql.exec('SELECT k, por, t FROM viendo WHERE quien != ?', quien).toArray() };
  }

  /**
   * 📣 Lo que el ciclo hizo con cada corrección: `{estados: {id: ['aplicado' | 'no_pude', 'qué cambió']}}`. Lo
   * aplicado le llega a quien lo reportó a su campana (la bandeja de la página, nunca por DM).
   */
  async reportesEstados(d) {
    const ahora = Date.now();
    let n = 0;
    for (const [id, x] of Object.entries((d && d.estados) || {})) {
      if (!/^\d{1,12}$/.test(id) || !Array.isArray(x)) continue;
      const est = x[0] === 'aplicado' ? 'aplicado' : 'no_pude';
      const msg = String(x[1] || '').replace(/\s+/g, ' ').trim().slice(0, 200);
      const r = this.sql.exec('SELECT quien, llave, estado FROM reportes WHERE id = ?', Number(id)).toArray()[0];
      // abierto también: lo que Dlx decidió en el chat y se aplicó a mano (los de Agus, 13/10/2026)
      if (!r || (r.estado !== 'corregir' && r.estado !== '')) continue;
      this.sql.exec('UPDATE reportes SET estado = ?, resultado = ?, t_estado = ? WHERE id = ?', est, msg, ahora, Number(id));
      if (est === 'aplicado') {
        this.xpVio(r.quien, 'reporte', id, ahora);
        const num = /^\d+$/.test(r.llave) ? r.llave : '';
        const deLiga = String(r.llave).startsWith('liga:');
        this.aBandeja(r.quien, 'reporte:' + id, 'reporte', num ? '✅ Corregimos la llave #' + num : deLiga ? '✅ Corregimos la liga' : '✅ Corregimos la llave',
          (msg ? msg + '. ' : '') + 'Gracias por avisar.', num ? HUB + '/freestyle-rap/llave/' + num : HUB + HUB_EVENTOS, '', ahora);
      }
      n++;
    }
    // ✍️ lo que Dlx decidió EN EL CHAT (`{id: fix}`, lo carga Claude con la clave del ciclo): queda como si lo hubiera
    // elegido en el Dashboard y lo aplica el ciclo en su corrida siguiente. Sólo sobre un reporte abierto (13/10/2026)
    for (const [id, fix] of Object.entries((d && d.decididos) || {})) {
      if (!/^\d{1,12}$/.test(id) || !fix || typeof fix !== 'object') continue;
      const v = validarDecisionReporte(Object.assign({}, fix, { id: Number(id), accion: fix.tipo }));
      const r = this.sql.exec('SELECT estado FROM reportes WHERE id = ?', Number(id)).toArray()[0];
      if (v.error || !v.fix || !r || r.estado !== '') continue;
      this.sql.exec("UPDATE reportes SET estado = 'corregir', fix = ?, resultado = '', t_estado = ? WHERE id = ?",
        JSON.stringify(v.fix), ahora, Number(id));
      n++;
    }
    // 🔎 la evidencia de cada reporte abierto (`{id: {quien, lineas, sugerencia}}`), tal cual la arma el ciclo
    let e = 0;
    for (const [id, x] of Object.entries((d && d.evidencia) || {})) {
      if (!/^\d{1,12}$/.test(id) || !x || typeof x !== 'object') continue;
      const t = JSON.stringify(x);
      if (t.length > 4000) continue;
      e += this.sql.exec('UPDATE reportes SET evid = ? WHERE id = ? AND evid != ?', t, Number(id), t).rowsWritten || 0;
    }
    if (n) await this.colaReportes(ahora);
    return { ok: true, n, evidencia: e };
  }

  // ── 🖼️ tu fondo (13/10/2026) ──────────────────────────────────────────
  /** ¿Puede subir un fondo? El nivel `FONDO_NIVEL` del Pase; Dlx siempre (para probarlo). */
  puedeFondo(quien) {
    if (quien === DUENO) return { si: true, nivel: null, falta: FONDO_NIVEL };
    // 🖼️ DESDE EL 25/10/2026 (Dlx: «hazlo como te dije del pase premium… pero un nivel de experiencia en general en tu
    // perfil»): el NIVEL `FONDO_NIVEL` DE TU PERFIL (el general, no el del Pase), o el premium desde su nivel 5. Quien ya
    // tenía su fondo aprobado lo conserva
    const P = this.paseDatos();
    const nivel = this.rachaDe(quien).nivel.n;
    const pNivel = P.cfg ? this.paseNivel(quien, P.cfg) : 0;
    const prem = P.cfg && this.pasePremium(quien, P.cfg.temp) && pNivel >= (((P.cfg.premium || []).find((p) => p[2] === 'fondo') || [5])[0]);
    const tenia = !!this.sql.exec("SELECT 1 AS x FROM fondos WHERE quien = ? AND estado = 'ok' LIMIT 1", quien).toArray()[0];
    return { si: nivel >= FONDO_NIVEL || !!prem || tenia, nivel, falta: FONDO_NIVEL };
  }

  /** Cómo está el fondo de alguien, para su Mi cuenta. */
  fondoDe(quien) {
    if (!/^\d{5,25}$/.test(quien)) return { error: 'falta quién' };
    const r = this.sql.exec('SELECT estado, url, pend, perfil, pagina, motivo, t FROM fondos WHERE quien = ?', quien).toArray()[0];
    return { ok: true, puede: this.puedeFondo(quien), fondo: r ? { estado: r.estado, url: r.url, pend: r.pend, perfil: !!r.perfil,
      pagina: !!r.pagina, motivo: r.motivo, t: r.t } : null };
  }

  /** Subir (`img`, base64), cambiar dónde se ve (`perfil`, `pagina`) o quitarlo (`borrar`). Lo nuevo pasa por el filtro
   *  (`filtrarImagen()`): limpio se ve ya, con algo que no va no entra, y lo dudoso espera revisión. */
  async fondo(d) {
    this._fondos = null;
    const quien = String(d.quien || '');
    if (!/^\d{5,25}$/.test(quien)) return { error: 'falta quién' };
    const ahora = Date.now();
    const r = this.sql.exec('SELECT * FROM fondos WHERE quien = ?', quien).toArray()[0];
    const borrarR2 = async (u) => {
      const k = String(u || '').split('.r2.dev/')[1];
      if (k && k.startsWith('fondos/')) { try { await this.env.CARTAS.delete(k); } catch (e) { /* queda huérfano */ } }
    };
    if (d.borrar) {
      if (r) { await borrarR2(r.url); await borrarR2(r.pend); }
      this.sql.exec('DELETE FROM fondos WHERE quien = ?', quien);
      return this.fondoDe(quien);
    }
    const perfil = d.perfil === undefined ? (r ? r.perfil : 1) : (d.perfil ? 1 : 0);
    const pagina = d.pagina === undefined ? (r ? r.pagina : 1) : (d.pagina ? 1 : 0);
    if (d.img) {
      const p = this.puedeFondo(quien);
      if (!p.si) return { error: 'nivel', nivel: p.nivel, falta: FONDO_NIVEL };
      const hoy = new Date(ahora).toISOString().slice(0, 10);
      const subidas = String((r && r.subidas) || '').split(',').filter((x) => x === hoy);
      if (subidas.length >= FONDO_POR_DIA) return { error: 'tope' };
      let b = null;
      try { b = Uint8Array.from(atob(d.img), (c) => c.charCodeAt(0)); } catch (e) { b = null; }
      // por los primeros bytes, no por lo que dice el pedido (`tipoImagen()`, la misma de los afiches)
      const tipo = b ? tipoImagen(b) : '';
      if (!tipo) return { error: 'no es una imagen' };
      if (b.length > FONDO_TOPE) return { error: 'demasiado grande' };
      // 🛡️ con la ubicación o algún dato escondido, no (ver `tieneMetadatos()`)
      // 🧽 se le sacan (ver `limpiarMetadatos()`): el JPEG de Safari trae un Exif suyo, sin ubicación
      b = limpiarMetadatos(b);
      if (!b || tieneMetadatos(b)) return { error: 'metadatos' };
      // 🛡️ EL FILTRO, antes de guardar nada. Con tope propio: si no, alguien podría probar mil imágenes contra la IA
      // hasta que una pase (cuentan también las que no entran, que no suman a `subidas`)
      if (!this.cuentaCambio(quien, 'fondo_filtro', FONDO_POR_DIA * 2)) return { error: 'tope' };
      let filtro = { v: 'revisar', si: [], quizas: [], crudo: '', error: 'sin IA' };
      if (this.env.AI) {
        try { filtro = await filtrarImagen(this.env, d.img, tipo); } catch (e) {
          filtro = { v: 'revisar', si: [], quizas: [], crudo: '', error: String((e && e.message) || e).slice(0, 100) };
        }
      }
      this.anotarFiltro(quien, String(d.de || ''), filtro, ahora);
      if (filtro.v === 'no') {
        const cats = filtro.si.filter((k) => FILTRO_NO.includes(k));
        return { error: 'filtro', cats, texto: cats.map((k) => FILTRO_TEXTO[k]).join(', ') };
      }
      const azar = Array.from(crypto.getRandomValues(new Uint8Array(12)), (x) => x.toString(16).padStart(2, '0')).join('');
      const clave = 'fondos/' + azar + '.' + ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[tipo]);
      try {
        await this.env.CARTAS.put(clave, b, { httpMetadata: { contentType: tipo, cacheControl: 'public, max-age=31536000' } });
      } catch (e) {
        return { error: 'no pude guardarla' };
      }
      if (r && r.pend) await borrarR2(r.pend);
      const url = R2_PUB + '/' + clave;
      if (filtro.v === 'ok') {
        // ✅ limpio: se ve ya. El anterior se borra de R2
        if (r && r.url) await borrarR2(r.url);
        this.sql.exec('INSERT INTO fondos (quien, k, estado, url, pend, perfil, pagina, motivo, t, subidas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
          "ON CONFLICT(quien) DO UPDATE SET k = excluded.k, estado = 'ok', url = excluded.url, pend = '', perfil = excluded.perfil, " +
          "pagina = excluded.pagina, motivo = '', t = excluded.t, subidas = excluded.subidas",
        quien, String(d.de || ''), 'ok', url, '', perfil, pagina, '', ahora, subidas.concat([hoy]).join(','));
        return Object.assign(this.fondoDe(quien), { filtro: 'ok' });
      }
      this.sql.exec('INSERT INTO fondos (quien, k, estado, url, pend, perfil, pagina, motivo, t, subidas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
        "ON CONFLICT(quien) DO UPDATE SET k = excluded.k, estado = 'revisar', pend = excluded.pend, perfil = excluded.perfil, " +
        "pagina = excluded.pagina, motivo = '', t = excluded.t, subidas = excluded.subidas",
      quien, String(d.de || ''), 'revisar', '', url, perfil, pagina, '', ahora, subidas.concat([hoy]).join(','));
      return Object.assign(this.fondoDe(quien), { filtro: 'revisar' });
    }
    if (!r) return { error: 'todavía no subiste un fondo' };
    this.sql.exec('UPDATE fondos SET perfil = ?, pagina = ?, k = CASE WHEN ? != \'\' THEN ? ELSE k END WHERE quien = ?',
      perfil, pagina, String(d.de || ''), String(d.de || ''), quien);
    return this.fondoDe(quien);
  }

  /** 🛡️ Lo que decidió el filtro, para el Dashboard: los últimos 60, sin la imagen (sólo quién, cuándo y qué vio). */
  anotarFiltro(quien, k, filtro, t) {
    const h = [{ quien, k, t, v: filtro.v, si: filtro.si || [], quizas: filtro.quizas || [], error: filtro.error || '' }]
      .concat(this.leer('fondos_filtro') || []).slice(0, 60);
    this.guardar('fondos_filtro', h);
  }

  /** Los aprobados, para la página (público, por clave de perfil): `{t, f: {clave: [url, perfil, pagina]}}`. */
  fondos() {
    // 🛡️ un minuto de memoria, como `roles()`: se olvida al aprobar, quitar o cambiar uno
    if (this._fondos && Date.now() - this._fondos.t < 60000) return this._fondos;
    const f = {};
    for (const r of this.sql.exec("SELECT k, url, perfil, pagina FROM fondos WHERE url != '' AND k != ''").toArray()) {
      f[r.k] = [r.url, r.perfil ? 1 : 0, r.pagina ? 1 : 0];
    }
    this._fondos = { t: Date.now(), f };
    return this._fondos;
  }

  /** Dlx aprueba (`si`) o no un fondo que espera. A quien lo subió le llega a su campana. */
  async duenoFondo(d) {
    this._fondos = null;
    const r = this.sql.exec('SELECT * FROM fondos WHERE quien = ?', String(d.quien)).toArray()[0];
    const ahora = Date.now();
    // 🛡️ QUITAR UNO QUE YA SE VE: lo que el filtro aprobó y no tenía que pasar (`si: false` sobre uno sin pendiente)
    if (r && !r.pend && r.url && !d.si) {
      const k = String(r.url).split('.r2.dev/')[1];
      if (k && k.startsWith('fondos/')) { try { await this.env.CARTAS.delete(k); } catch (e) { /* queda huérfano */ } }
      this.sql.exec("UPDATE fondos SET url = '', estado = 'no', motivo = ? WHERE quien = ?", String(d.motivo || ''), r.quien);
      this.aBandeja(r.quien, 'fondo', 'fondo', '🖼️ Tu fondo se quitó', (d.motivo ? d.motivo + '. ' : '') +
        'Puedes subir otro desde Mi cuenta.', HUB + '/cuenta/fondo', '', ahora);
      return { ok: true, fondos: this.fondosDueno(), filtro: this.filtroDueno() };
    }
    if (!r || !r.pend) return { error: 'no hay nada para revisar' };
    const borrarR2 = async (u) => {
      const k = String(u || '').split('.r2.dev/')[1];
      if (k && k.startsWith('fondos/')) { try { await this.env.CARTAS.delete(k); } catch (e) { /* queda huérfano */ } }
    };
    if (d.si) {
      await borrarR2(r.url);
      this.sql.exec("UPDATE fondos SET url = pend, pend = '', estado = 'ok', motivo = '' WHERE quien = ?", r.quien);
      this.aBandeja(r.quien, 'fondo', 'fondo', '🖼️ Tu fondo ya se ve', 'Lo aprobamos: ya está ' +
        (r.perfil && r.pagina ? 'en tu perfil y de fondo de tu página' : r.perfil ? 'en tu perfil' : 'de fondo de tu página') + '.',
      HUB + '/cuenta/fondo', '', ahora);
    } else {
      await borrarR2(r.pend);
      this.sql.exec("UPDATE fondos SET pend = '', estado = CASE WHEN url != '' THEN 'ok' ELSE 'no' END, motivo = ? WHERE quien = ?",
        String(d.motivo || ''), r.quien);
      this.aBandeja(r.quien, 'fondo', 'fondo', '🖼️ Tu fondo no se aprobó', (d.motivo ? d.motivo + '. ' : '') +
        'Puedes subir otro desde Mi cuenta.', HUB + '/cuenta/fondo', '', ahora);
    }
    return { ok: true, fondos: this.fondosDueno(), filtro: this.filtroDueno() };
  }

  /** Para el Dashboard: los que esperan revisión. */
  fondosDueno() {
    return this.sql.exec("SELECT quien, k, pend, t FROM fondos WHERE pend != '' ORDER BY t").toArray()
      .map((r) => ({ quien: r.quien, k: r.k, pend: r.pend, t: r.t }));
  }

  // ── 📸 tu foto de tarjeta (13/10/2026) ──────────────────────────────
  /** ¿Puede ponerse una foto propia? El nivel `FOTO_CARTA_NIVEL` del Pase; Dlx siempre (para probarlo). */
  puedeFotoCarta(quien) {
    if (quien === DUENO) return { si: true, nivel: null, falta: FOTO_CARTA_NIVEL };
    const P = this.paseDatos();
    const nivel = P.cfg ? this.paseNivel(quien, P.cfg) : 0;
    return { si: nivel >= FOTO_CARTA_NIVEL, nivel, falta: FOTO_CARTA_NIVEL };
  }

  /** Cómo está cada carta de alguien, para su Mi cuenta: `{carta: {estado, url, pend, t, desde}}`. `desde`: cuándo se
   *  puede volver a cambiar (0 si ya). */
  fotoCartaDe(quien) {
    if (!/^\d{5,25}$/.test(quien)) return { error: 'falta quién' };
    const ahora = Date.now(), cartas = {};
    for (const r of this.sql.exec('SELECT * FROM fotos_carta WHERE quien = ?', quien).toArray()) {
      const desde = r.t && ahora - r.t < FOTO_CARTA_SEMANA ? r.t + FOTO_CARTA_SEMANA : 0;
      cartas[r.carta] = { estado: r.estado, url: r.estado === 'ok' && r.k ? R2_PUB + '/' + claveFoto(this.env, r.k, r.carta) : '',
        pend: r.pend, motivo: r.motivo, t: r.t, desde };
    }
    return { ok: true, puede: this.puedeFotoCarta(quien), cartas };
  }

  /**
   * Subir una foto (`img`, base64) para `cartas`, o volver a la de Discord en `borrar`. La nueva pasa por el filtro:
   * limpia se ve en la vuelta siguiente del ciclo; con algo que no va, no entra; dudosa espera revisión.
   * ⚠️ UNA POR SEMANA POR CARTA (Dlx: «Una por semana»): cuenta desde que se puso, también si después se volvió a la
   * de Discord —si no, poner y sacar sería cambiarla todos los días—. Lo que el filtro frena no cuenta para la semana,
   * pero sí para el tope del día. Si alguna carta elegida todavía no se puede, no se toca ninguna y se dice cuál.
   */
  async fotoCarta(d) {
    this._fondos = null;
    const quien = String(d.quien || ''), k = String(d.de || '');
    if (!/^\d{5,25}$/.test(quien)) return { error: 'falta quién' };
    if (!k) return { error: 'sin_perfil' };
    const ahora = Date.now();
    const filas = {};
    for (const r of this.sql.exec('SELECT * FROM fotos_carta WHERE quien = ?', quien).toArray()) filas[r.carta] = r;
    const borrarPend = async (u) => {
      const kp = String(u || '').split('.r2.dev/')[1];
      if (kp && kp.startsWith('pendientes/')) { try { await this.env.CARTAS.delete(kp); } catch (e) { /* queda huérfano */ } }
    };
    const fila = (carta, estado, pend, t) => this.sql.exec('INSERT INTO fotos_carta (quien, carta, k, estado, pend, motivo, t) ' +
      "VALUES (?, ?, ?, ?, ?, '', ?) ON CONFLICT(quien, carta) DO UPDATE SET k = excluded.k, estado = excluded.estado, " +
      "pend = excluded.pend, motivo = '', t = excluded.t", quien, carta, k, estado, pend, t);
    if (Array.isArray(d.borrar) && d.borrar.length) {
      for (const carta of d.borrar.filter((c) => CARTAS_FOTO.includes(c))) {
        const r = filas[carta];
        if (!r) continue;
        try { await this.env.CARTAS.delete(claveFoto(this.env, r.k || k, carta)); } catch (e) { /* queda huérfano */ }
        await borrarPend(r.pend);
        // ⚠️ `t` se queda: la semana sigue contando desde que se puso
        this.sql.exec("UPDATE fotos_carta SET estado = '', pend = '' WHERE quien = ? AND carta = ?", quien, carta);
      }
      return this.fotoCartaDe(quien);
    }
    if (!d.img) return { error: 'faltan datos' };
    const cartas = [...new Set((Array.isArray(d.cartas) ? d.cartas : []).filter((c) => CARTAS_FOTO.includes(c)))];
    if (!cartas.length) return { error: 'elige en qué tarjetas' };
    const p = this.puedeFotoCarta(quien);
    if (!p.si) return { error: 'nivel', nivel: p.nivel, falta: FOTO_CARTA_NIVEL };
    const trabadas = quien === DUENO ? [] : cartas.filter((c) => filas[c] && filas[c].t && ahora - filas[c].t < FOTO_CARTA_SEMANA);
    if (trabadas.length) {
      return { error: 'semana', cartas: trabadas, desde: Math.max(...trabadas.map((c) => filas[c].t + FOTO_CARTA_SEMANA)) };
    }
    let b = null;
    try { b = Uint8Array.from(atob(d.img), (c) => c.charCodeAt(0)); } catch (e) { b = null; }
    const tipo = b ? tipoImagen(b) : '';
    if (!tipo) return { error: 'no es una imagen' };
    if (b.length > FOTO_CARTA_TOPE) return { error: 'demasiado grande' };
    b = limpiarMetadatos(b);
    if (!b || tieneMetadatos(b)) return { error: 'metadatos' };
    if (!this.cuentaCambio(quien, 'foto_filtro', 10)) return { error: 'tope' };
    let filtro = { v: 'revisar', si: [], quizas: [], crudo: '', error: 'sin IA' };
    if (this.env.AI) {
      try { filtro = await filtrarImagen(this.env, d.img, tipo); } catch (e) {
        filtro = { v: 'revisar', si: [], quizas: [], crudo: '', error: String((e && e.message) || e).slice(0, 100) };
      }
    }
    this.anotarFiltro(quien, k, Object.assign({ tipo: 'foto' }, filtro), ahora);
    if (filtro.v === 'no') {
      const cats = filtro.si.filter((x) => FILTRO_NO.includes(x));
      return { error: 'filtro', cats, texto: cats.map((x) => FILTRO_TEXTO[x]).join(', ') };
    }
    const meta = { httpMetadata: { contentType: tipo, cacheControl: 'public, max-age=300' } };
    if (filtro.v === 'ok') {
      // ✅ limpia: una copia por carta, donde las lee el ciclo. Lo que esperaba revisión en esas cartas se descarta
      for (const carta of cartas) {
        try { await this.env.CARTAS.put(claveFoto(this.env, k, carta), b, meta); } catch (e) { return { error: 'no pude guardarla' }; }
        if (filas[carta]) await borrarPend(filas[carta].pend);
        fila(carta, 'ok', '', ahora);
      }
      return Object.assign(this.fotoCartaDe(quien), { filtro: 'ok' });
    }
    // 🤔 dudosa: queda afuera de la carpeta de las caras (si no, el espejo del ciclo la dibujaría) hasta que se apruebe,
    // y mientras tanto la carta sigue con la que tenía
    const azar = Array.from(crypto.getRandomValues(new Uint8Array(12)), (x) => x.toString(16).padStart(2, '0')).join('');
    const kp = 'pendientes/' + azar + '.' + ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[tipo]);
    try { await this.env.CARTAS.put(kp, b, meta); } catch (e) { return { error: 'no pude guardarla' }; }
    for (const carta of cartas) {
      if (filas[carta]) await borrarPend(filas[carta].pend);
      fila(carta, filas[carta] ? filas[carta].estado : '', R2_PUB + '/' + kp, ahora);
    }
    return Object.assign(this.fotoCartaDe(quien), { filtro: 'revisar' });
  }

  /** Dlx (o quien puede) aprueba (`si`) o no la foto que espera; sin nada esperando, `si: false` quita las que se ven. */
  async duenoFotoCarta(d) {
    this._fondos = null;
    const quien = String(d.quien || ''), ahora = Date.now();
    const filas = this.sql.exec('SELECT * FROM fotos_carta WHERE quien = ?', quien).toArray();
    const pend = filas.filter((r) => r.pend);
    const kp = pend.length ? String(pend[0].pend).split('.r2.dev/')[1] : '';
    if (pend.length && d.si) {
      let obj = null;
      try { obj = await this.env.CARTAS.get(kp); } catch (e) { obj = null; }
      if (!obj) return { error: 'no encontré la imagen' };
      const b = new Uint8Array(await obj.arrayBuffer());
      const tipo = tipoImagen(b) || 'image/webp';
      for (const r of pend) {
        await this.env.CARTAS.put(claveFoto(this.env, r.k, r.carta), b, { httpMetadata: { contentType: tipo, cacheControl: 'public, max-age=300' } });
        this.sql.exec("UPDATE fotos_carta SET estado = 'ok', pend = '', motivo = '' WHERE quien = ? AND carta = ?", quien, r.carta);
      }
      try { await this.env.CARTAS.delete(kp); } catch (e) { /* queda huérfano */ }
      this.aBandeja(quien, 'foto-carta', 'fondo', '📸 Tu foto de tarjeta, aprobada', 'Sale en tus tarjetas en la próxima vuelta del ciclo.',
        HUB + '/cuenta/perfil', '', ahora);
    } else if (pend.length) {
      try { await this.env.CARTAS.delete(kp); } catch (e) { /* queda huérfano */ }
      // ⚠️ `t` vuelve a 0: lo que no se aprobó no gasta la semana
      // (y la carta sigue con la que tenía: `estado` no se toca)
      for (const r of pend) {
        this.sql.exec("UPDATE fotos_carta SET pend = '', motivo = ?, t = 0 WHERE quien = ? AND carta = ?",
          String(d.motivo || ''), quien, r.carta);
      }
      this.aBandeja(quien, 'foto-carta', 'fondo', '📸 Tu foto de tarjeta no se aprobó', (d.motivo ? d.motivo + '. ' : '') +
        'Puedes subir otra desde Mi cuenta.', HUB + '/cuenta/perfil', '', ahora);
    } else if (!d.si) {
      const vivas = filas.filter((r) => r.estado === 'ok');
      if (!vivas.length) return { error: 'no hay nada para revisar' };
      for (const r of vivas) {
        try { await this.env.CARTAS.delete(claveFoto(this.env, r.k, r.carta)); } catch (e) { /* queda huérfano */ }
        this.sql.exec("UPDATE fotos_carta SET estado = 'no', motivo = ? WHERE quien = ? AND carta = ?", String(d.motivo || ''), quien, r.carta);
      }
      this.aBandeja(quien, 'foto-carta', 'fondo', '📸 Tu foto de tarjeta se quitó', (d.motivo ? d.motivo + '. ' : '') +
        'Tus tarjetas vuelven a la foto de Discord.', HUB + '/cuenta/perfil', '', ahora);
    } else {
      return { error: 'no hay nada para revisar' };
    }
    return { ok: true, fotos_carta: this.fotosCartaDueno(), filtro: this.filtroDueno() };
  }

  /** Para el Dashboard: las fotos de tarjeta que esperan revisión, una fila por persona con sus cartas. */
  fotosCartaDueno() {
    const por = {};
    for (const r of this.sql.exec("SELECT quien, k, carta, pend, t FROM fotos_carta WHERE pend != '' ORDER BY t")
      .toArray()) {
      if (!por[r.quien]) por[r.quien] = { quien: r.quien, k: r.k, pend: r.pend, t: r.t, cartas: [] };
      por[r.quien].cartas.push(r.carta);
    }
    return Object.values(por);
  }

  /** 🛡️ Para el Dashboard: los que el filtro dejó ver en los últimos `FILTRO_VISTA_DIAS` (con «Quitar») y cuántos
   *  aprobó, frenó y mandó a revisar. */
  filtroDueno() {
    const desde = Date.now() - FILTRO_VISTA_DIAS * 864e5;
    const vivos = this.sql.exec("SELECT quien, k, url, t FROM fondos WHERE url != '' AND pend = '' AND t > ? ORDER BY t DESC",
      desde).toArray().map((r) => ({ quien: r.quien, k: r.k, url: r.url, t: r.t }));
    // 📸 y las fotos de tarjeta, una fila por persona con sus cartas (13/10/2026)
    const fc = {};
    for (const r of this.sql.exec("SELECT quien, k, carta, t FROM fotos_carta WHERE estado = 'ok' AND t > ? ORDER BY t DESC",
      desde).toArray()) {
      if (!fc[r.quien]) fc[r.quien] = { tipo: 'foto', quien: r.quien, k: r.k, url: R2_PUB + '/' + claveFoto(this.env, r.k, r.carta), t: r.t, cartas: [] };
      fc[r.quien].cartas.push(r.carta);
    }
    vivos.push(...Object.values(fc));
    vivos.sort((a, b) => b.t - a.t);
    const h = (this.leer('fondos_filtro') || []).filter((x) => x.t > desde);
    const cuenta = { ok: 0, no: 0, revisar: 0 };
    for (const x of h) cuenta[x.v] = (cuenta[x.v] || 0) + 1;
    return { vivos, cuenta, frenados: h.filter((x) => x.v === 'no').slice(0, 10)
      .map((x) => ({ k: x.k, t: x.t, si: x.si })) };
  }

  // ── 🏷️ los roles de la página (13/10/2026) ──────────────────────────
  /** 🔐 Los roles de Dashboard de alguien: `['owner']` para Dlx; los que Dlx le puso (admin, asistente, moderador). */
  rolesPanelDe(quien) {
    if (quien === DUENO) return ['owner'];
    if (!/^\d{5,25}$/.test(quien)) return [];
    return this.sql.exec('SELECT rol FROM roles_manual WHERE quien = ? AND si = 1', quien).toArray()
      .map((r) => r.rol).filter((r) => ROLES_PANEL.includes(r));
  }

  /** 🔐 El nombre de quien hizo algo, para el historial: Dlx, o el de la Lista (del directorio de los roles). */
  nombrePor(id) {
    if (!id) return '';
    if (String(id) === DUENO) return 'Dlx';
    const p = ((this.leer('roles_dir') || {}).dir || []).find((x) => x.id === String(id));
    return p ? p.n : 'otra cuenta';
  }

  /** El directorio del ciclo (`bot/roles.py`): cada persona de la Lista con Discord, su clave, su nombre y sus roles solos. */
  rolesEstados(d) {
    const dir = (Array.isArray(d && d.dir) ? d.dir : []).slice(0, 5000).filter((x) => x && /^\d{5,25}$/.test(String(x.id))
      && typeof x.k === 'string' && x.k.length <= 60).map((x) => {
      const a = {};
      for (const [r, svs] of Object.entries(x.a || {})) {
        if (ORDEN_ROLES.includes(r)) a[r] = (Array.isArray(svs) ? svs : []).slice(0, 10).map((s) => String(s).slice(0, 8));
      }
      return { k: x.k, n: String(x.n || '').slice(0, 60), id: String(x.id), a };
    });
    this.guardar('roles_dir', { t: Date.now(), dir });
    this._roles = null;
    return { ok: true, n: dir.length };
  }

  /** `{id: {rol: 1|0}}`: lo que puso o sacó Dlx. */
  rolesManual() {
    const m = {};
    for (const r of this.sql.exec('SELECT quien, rol, si FROM roles_manual').toArray()) (m[r.quien] = m[r.quien] || {})[r.rol] = r.si;
    return m;
  }

  /** Los roles de una persona del directorio, con lo de Dlx encima: `[[rol, [servidores]], …]` en `ORDEN_ROLES`. */
  rolesDe(x, man) {
    const a = Object.assign({}, x.a || {});
    for (const [rol, si] of Object.entries(man[x.id] || {})) {
      if (si) a[rol] = a[rol] || [];
      else delete a[rol];
    }
    if (x.id === DUENO) a.owner = []; else delete a.owner;
    return ORDEN_ROLES.filter((r) => a[r]).map((r) => (a[r].length ? [r, a[r]] : [r]));
  }

  /** Para la página (público, por clave de perfil): `{t, r: {clave: [[rol, [servidores]]]}}`. 🛡️ Con un minuto de memoria
   *  (la pasada de seguridad, 13/10/2026): la página la pide con cinco minutos de borde, pero el Worker directo no tiene
   *  borde, y así alguien que la martille no hace trabajar al objeto en cada pedido. Se olvida al cambiar un rol */
  roles() {
    if (this._roles && Date.now() - this._roles.t < 60000) return this._roles;
    this._roles = this.rolesSinMemoria();
    return this._roles;
  }

  rolesSinMemoria() {
    const x = this.leer('roles_dir') || {};
    const man = this.rolesManual();
    const r = {};
    for (const p of x.dir || []) {
      const l = this.rolesDe(p, man);
      if (l.length) r[p.k] = l;
    }
    return { t: x.t || null, r };
  }

  /** Dlx pone (`si` true), saca (false) o vuelve a lo automático (null) un rol. Queda en el historial. */
  duenoRol(d) {
    const v = validarRol(d);
    if (v.error) return v;
    const ahora = Date.now();
    if (v.si === null) this.sql.exec('DELETE FROM roles_manual WHERE quien = ? AND rol = ?', v.id, v.rol);
    else {
      this.sql.exec('INSERT OR REPLACE INTO roles_manual (quien, rol, si, t) VALUES (?, ?, ?, ?)', v.id, v.rol, v.si ? 1 : 0, ahora);
    }
    const p = ((this.leer('roles_dir') || {}).dir || []).find((x) => x.id === v.id);
    this._roles = null;
    const h = [{ id: v.id, n: p ? p.n : '', rol: v.rol, si: v.si, t: ahora }].concat(this.leer('roles_hist') || []).slice(0, 40);
    this.guardar('roles_hist', h);
    return { ok: true, roles: this.rolesDueno() };
  }

  /** Para el Dashboard: el directorio (`[k, n, id, roles]`), lo puesto a mano y el historial. */
  rolesDueno() {
    const x = this.leer('roles_dir') || {};
    const man = this.rolesManual();
    return { t: x.t || null, dir: (x.dir || []).map((p) => [p.k, p.n, p.id, this.rolesDe(p, man), p.a]),
      manual: man, hist: this.leer('roles_hist') || [] };
  }

  // ── ✅ Decidir en el Dashboard (13/10/2026) ──────────────────────────
  /** Las preguntas abiertas que publica el ciclo (`decidir.para_web()`). Lo contestado de las que ya no están, se va. */
  decidirEstados(d) {
    const ps = (Array.isArray(d && d.preguntas) ? d.preguntas : []).slice(0, 150).filter((p) => p && typeof p.id === 'string'
      && p.id.length <= 60).map((p) => ({ id: p.id, tipo: String(p.tipo || '').slice(0, 40), sec: String(p.sec || '').slice(0, 120),
      que: String(p.que || '').slice(0, 400), pistas: String(p.pistas || '').slice(0, 900),
      opciones: (Array.isArray(p.opciones) ? p.opciones : []).slice(0, 14).map((x) => String(x).slice(0, 80)),
      link: /^https:\/\/discord\.com\//.test(String(p.link || '')) ? String(p.link) : '', libre: p.libre === true,
      // 🔎 para los filtros (13/10/2026): el grupo y la importancia (`decidir.GRUPO`, `decidir.IMPORTANCIA`). ⚠️ Esto se
      // los comía, así que el filtro de importancia nunca tenía con qué
      grupo: String(p.grupo || '').slice(0, 40), imp: ['alta', 'media', 'baja'].includes(p.imp) ? p.imp : '' }));
    this.guardar('decidir_preguntas', { t: Date.now(), preguntas: ps });
    // 🤖 LO QUE SE RESOLVIÓ SOLO (13/10/2026): lo que una regla del ciclo cerró o contestó, con su prueba. Lo manda el
    // ciclo entero (los últimos 14 días) cada vez: se reemplaza
    if (Array.isArray(d && d.solas)) {
      const solas = d.solas.slice(0, 300).filter((x) => x && typeof x.id === 'string' && x.id.length <= 60).map((x) => ({
        id: x.id, tipo: String(x.tipo || '').slice(0, 40), sec: String(x.sec || '').slice(0, 120), que: String(x.que || '').slice(0, 300),
        r: String(x.r || '').slice(0, 120), regla: String(x.regla || '').slice(0, 60), porque: String(x.porque || '').slice(0, 400),
        t: Number(x.t) || 0 }));
      this.guardar('decidir_solas', { t: Date.now(), solas });
    }
    const ids = new Set(ps.map((p) => p.id));
    let fuera = 0;
    for (const r of this.sql.exec('SELECT id FROM decidir_resp').toArray()) {
      if (!ids.has(r.id)) fuera += this.sql.exec('DELETE FROM decidir_resp WHERE id = ?', r.id).rowsWritten || 0;
    }
    return { ok: true, n: ps.length, fuera };
  }

  /** Para el ciclo: lo contestado en el Dashboard, `{respuestas: {id: {r, nota, t}}, deshacer: [ids]}`. */
  decidirCiclo() {
    const respuestas = {};
    for (const r of this.sql.exec('SELECT id, r, nota, t, por FROM decidir_resp').toArray()) respuestas[r.id] = { r: r.r, nota: r.nota, t: r.t, por: r.por };
    // 🤖 lo que Dlx deshizo de lo que una regla resolvió: la regla no se vuelve a aplicar y la pregunta vuelve
    return { respuestas, deshacer: (this.leer('decidir_deshacer') || []).map((x) => x.id) };
  }

  /** Dlx contesta (o se arrepiente: `borrar`). Lo aplica el ciclo en su próxima corrida. */
  duenoDecidir(d) {
    const ps = (this.leer('decidir_preguntas') || {}).preguntas || [];
    const v = validarRespuestaDecidir(d, ps, (this.leer('decidir_solas') || {}).solas || []);
    if (v.error) return v;
    if (v.deshacer) {
      // 🤖 queda anotado 30 días: lo lee el ciclo (`decidirCiclo()`) y no la vuelve a resolver
      const corte = Date.now() - 30 * 864e5;
      const des = (this.leer('decidir_deshacer') || []).filter((x) => x.t > corte && x.id !== v.id);
      des.push({ id: v.id, t: Date.now(), por: this.nombrePor(d.por) });
      this.guardar('decidir_deshacer', des.slice(-300));
    } else if (v.borrar) this.sql.exec('DELETE FROM decidir_resp WHERE id = ?', v.id);
    else {
      this.sql.exec('INSERT OR REPLACE INTO decidir_resp (id, r, nota, t, por) VALUES (?, ?, ?, ?, ?)', v.id, v.r, v.nota, Date.now(),
        this.nombrePor(d.por));
    }
    return { ok: true, decidir: this.decidirDueno() };
  }

  /** ✅ Decidir para el Dashboard: las preguntas, cuándo las publicó el ciclo y lo ya contestado. */
  decidirDueno() {
    const x = this.leer('decidir_preguntas') || {};
    const c = this.decidirCiclo();
    return { t: x.t || null, preguntas: x.preguntas || [], respuestas: c.respuestas,
      solas: (this.leer('decidir_solas') || {}).solas || [], deshacer: c.deshacer };
  }

  /** Los reportes para el Dashboard: los abiertos y los que esperan al ciclo, y lo decidido en los últimos 3 días. */
  reportesDueno(ahora) {
    return this.sql.exec('SELECT r.id, r.t, r.llave, r.que, r.texto, r.batalla, r.estado, r.fix, r.resultado, r.evid, r.por, i.k ' +
      "FROM reportes r LEFT JOIN idk i ON i.id = r.quien WHERE r.estado IN ('', 'corregir') OR r.t_estado > ? " +
      'ORDER BY r.t DESC LIMIT 30', ahora - 3 * DIA_MS).toArray().map((f) => {
      let fix = null, evid = null;
      try { fix = f.fix ? JSON.parse(f.fix) : null; } catch (e) { fix = null; }
      try { evid = f.evid ? JSON.parse(f.evid) : null; } catch (e) { evid = null; }
      return { id: f.id, t: f.t, llave: f.llave, que: f.que, texto: String(f.texto || '').slice(0, 300), batalla: f.batalla,
        de: f.k || '', estado: f.estado || '', fix, resultado: f.resultado || '', evid, por: f.por || '' };
    });
  }

  // ── «tu servidor» ────────────────────────────────────────────────────
  /**
   * Leer «tu servidor» (sin `sv`) o elegirlo. Sólo lo llama `rutaAvisos`,
   * con el ID que dijo Discord, tu perfil (`de`), la temporada y hasta cuándo
   * se cambia libre (`libre_hasta`, la misma ventana que la foto).
   *
   * ⚠️ UNO POR TEMPORADA, COMO LA FOTO. Mientras dura la ventana libre se
   * cambia cuantas veces se quiera y no gasta nada; pasada, el que se elige
   * queda (`fijo`) hasta la temporada que viene. Elegir el que ya tenés no
   * gasta. Sin elegir en esta temporada, se ve el de la anterior.
   */
  miServidor(d) {
    const quien = String(d.quien || ''), temp = String(d.temporada || '');
    if (!/^[0-9]{5,25}$/.test(quien) || !/^[a-z0-9]{1,10}$/.test(temp)) return json({ error: 'faltan datos' }, 400);
    const ahora = Date.now(), hasta = Number(d.libre_hasta) || 0, libre = ahora < hasta;
    const de = claveValida(d.de) ? d.de : '';
    let fila = this.sql.exec('SELECT sv, fijo FROM servidor WHERE quien = ? AND temporada = ?', quien, temp)
      .toArray()[0];
    if (d.sv !== undefined && d.sv !== null) {
      // 🔑 `''` ES «NINGUNO» (Dlx, 07/10/2026: «que al final te pregunte de qué servidor venís o a cuál querés
      // representar… todos los socios y la opción ninguno»). Queda anotado —ya contestó— y NO fija la temporada: quien
      // eligió ninguno puede elegir un servidor después, como si no hubiera elegido
      const sv = String(d.sv);
      if (sv && !/^[A-Z]{2,5}$/.test(sv)) return json({ error: 'servidor' }, 400);
      if (!fila || fila.sv !== sv) {
        if (fila && fila.fijo && !libre) return json({ error: 'ya', sv: fila.sv, fijo: true, libre: false }, 409);
        const fijo = libre || !sv ? 0 : 1;
        this.sql.exec('INSERT INTO servidor (quien, temporada, sv, de, t, fijo) VALUES (?, ?, ?, ?, ?, ?) ' +
          'ON CONFLICT(quien, temporada) DO UPDATE SET sv = excluded.sv, de = excluded.de, t = excluded.t, ' +
          'fijo = excluded.fijo', quien, temp, sv, de, ahora, fijo);
        fila = { sv, fijo };
      }
    } else if (fila && de) {
      // tu perfil puede haber cambiado (entraste con otro nombre): se corrige acá
      this.sql.exec('UPDATE servidor SET de = ? WHERE quien = ? AND temporada = ? AND de != ?', de, quien, temp, de);
    }
    const antes = fila ? null : this.sql.exec('SELECT sv FROM servidor WHERE quien = ? ORDER BY t DESC LIMIT 1',
      quien).toArray()[0];
    // `elegido`: contestó esta temporada (también «ninguno», que es `sv: ''`): la verificación ya no le pregunta
    return json({ ok: true, sv: fila ? fila.sv : antes ? antes.sv : '', elegido: !!fila, fijo: !!(fila && fila.fijo),
      libre, libre_hasta: hasta, puede: libre || !(fila && fila.fijo) });
  }

  /**
   * 🙈 «OCULTAR MI FOTO» (Dlx, 29/09/2026: «la foto queda como hoy, con ocultar mi foto en ajustes»; el 02/10: «1. A»).
   * Con `ocultar` (sí/no) la cambia; sin él, sólo dice cómo está. Quien la oculta sale con su inicial en la página y en
   * sus tarjetas: la página muestra las tarjetas, así que ocultarla sólo en los círculos no servía.
   * 🔑 EL CICLO SE ENTERA POR KV (`fotos:ocultas`, la lista de Discord IDs), que se escribe sólo cuando cambia: es lo
   * que lee `bot/fotos.py` (`ocultas()`) antes de sellar y dibujar. ⚠️ No va al repo ni al payload: quién ocultó su
   * foto es un dato de esa persona.
   */
  async miFoto(d) {
    const quien = String(d.quien || '');
    if (!/^[0-9]{5,25}$/.test(quien)) return json({ error: 'faltan datos' }, 400);
    if (typeof d.ocultar === 'boolean') {
      const antes = !!this.sql.exec('SELECT 1 FROM foto_oculta WHERE quien = ?', quien).toArray()[0];
      if (d.ocultar !== antes) {
        // 🔴 CON TOPE (revisión del 03/10/2026): cada cambio escribía la lista en KV, y quien prendía y apagaba mil
        // veces se gastaba las mil escrituras del día de TODA la cuenta —el ciclo, el payload— como el 24/09
        if (!this.cuentaCambio(quien, 'foto', 10)) return json({ error: 'espera' }, 429);
        if (d.ocultar) this.sql.exec('INSERT OR REPLACE INTO foto_oculta (quien, t) VALUES (?, ?)', quien, Date.now());
        else this.sql.exec('DELETE FROM foto_oculta WHERE quien = ?', quien);
        await this.espejarOcultas(false);
      }
    }
    const oculta = !!this.sql.exec('SELECT 1 FROM foto_oculta WHERE quien = ?', quien).toArray()[0];
    return json({ ok: true, oculta });
  }

  /** La lista para el ciclo, en KV. ⚠️ Como mucho cada 15 minutos (`ya` falso): si se escribió hace menos, queda
   *  pendiente y la escribe el vigía. El ciclo la lee cada media hora, así que 15 minutos no atrasan a nadie. */
  async espejarOcultas(ya = true) {
    const ahora = Date.now();
    if (!ya && ahora - (this.leer('ocultas_t') || 0) < 15 * MIN) { this.guardar('ocultas_pend', 1); return; }
    if (this.leer('ocultas_pend') && ahora - (this.leer('ocultas_t') || 0) < 15 * MIN) return;
    const ids = this.sql.exec('SELECT quien FROM foto_oculta ORDER BY quien').toArray().map((r) => r.quien);
    try {
      await this.env.KV.put('fotos:ocultas', JSON.stringify({ v: 1, ids }));
      this.guardar('ocultas_t', ahora);
      this.guardar('ocultas_pend', 0);
    } catch (e) { this.guardar('ocultas_pend', 1); }
  }

  /** ¿Puede cambiar `que` otra vez hoy? Cuenta el cambio si puede: `tope` por persona y por día (UTC). */
  cuentaCambio(quien, que, tope) {
    const dia = new Date().toISOString().slice(0, 10);
    const f = this.sql.exec('SELECT n FROM cambios_dia WHERE quien = ? AND que = ? AND dia = ?', quien, que, dia).toArray()[0];
    if (f && f.n >= tope) return false;
    this.sql.exec('INSERT INTO cambios_dia (quien, que, dia, n) VALUES (?, ?, ?, 1) ' +
      'ON CONFLICT(quien, que, dia) DO UPDATE SET n = n + 1', quien, que, dia);
    return true;
  }

  /** Lo público: el servidor que eligió cada perfil (sólo raperos) y cuántos eligieron cada uno. */
  servidoresElegidos() {
    const n = {}, cuantos = {};
    // el más nuevo de cada uno, de cualquier temporada
    for (const r of this.sql.exec('SELECT s.sv, s.de FROM servidor s WHERE s.t = ' +
      '(SELECT MAX(t) FROM servidor WHERE quien = s.quien)').toArray()) {
      // «ninguno» (`''`) no suma a ningún servidor, y en el perfil vuelve a «donde más jugó»
      if (r.sv) cuantos[r.sv] = (cuantos[r.sv] || 0) + 1;
      if (r.de) n[r.de] = r.sv;
    }
    return { t: Date.now(), n, cuantos };
  }

  // ── seguir raperos ───────────────────────────────────────────────────
  /** A quién sigue esa persona, lo más nuevo primero. */
  sigoDe(quien) {
    return this.sql.exec('SELECT a FROM sigue WHERE quien = ? ORDER BY t DESC', quien).toArray().map((r) => r.a);
  }

  /** Cuántos siguen a cada uno: sólo las cuentas de más de `EDAD_MIN_DIAS`. */
  cuantos(as, ahora) {
    const out = {};
    for (const a of as) {
      out[a] = this.sql.exec('SELECT COUNT(*) AS n FROM sigue WHERE a = ? AND creada > 0 AND creada < ?',
        a, ahora - EDAD_MIN_DIAS * DIA_MS).toArray()[0].n;
    }
    return out;
  }

  /**
   * Seguir (`si`) o dejar de seguir una o varias claves. Sólo lo llama
   * `rutaAvisos`, con el ID que dijo Discord y las claves ya validadas.
   * Devuelve a quién seguís ahora y cuántos siguen a esas claves.
   *
   * ⚠️ VARIAS DE UNA VEZ ES PARA LA PRIMERA VEZ: lo que ese dispositivo ya
   * seguía sin cuenta (`lg:sigo`) sube entero al entrar con Discord.
   */
  /**
   * 📖 Las historias que viste, en tu cuenta (Dlx, 18/10/2026: «yes»): suma `ids` (lo que viste en este dispositivo) y
   * devuelve las tuyas `[[id, t]]`, de la más nueva a la más vieja, para que cada dispositivo sume lo de los otros.
   */
  historiasVistas(d) {
    const quien = String(d.quien || '');
    if (!/^[0-9]{5,25}$/.test(quien)) return json({ error: 'faltan datos' }, 400);
    const ahora = Date.now();
    let ids = (Array.isArray(d.ids) ? d.ids : []).filter((x) => typeof x === 'string' && x && x.length <= 200).slice(0, HISTORIAS_LOTE);
    // 🔴 UN TOPE POR DÍA (pasada del 19/10/2026): el lote tiene tope, los pedidos no, y alguien que mandara ids inventados
    // en un bucle escribía filas sin fin. Nadie ve de verdad más de `HISTORIAS_DIA` historias distintas en un día
    if (ids.length) {
      const hoy = (this.sql.exec('SELECT COUNT(*) AS n FROM hvistas WHERE quien = ? AND t > ?', quien, ahora - DIA_MS).toArray()[0] || {}).n || 0;
      ids = ids.slice(0, Math.max(0, HISTORIAS_DIA - hoy));
    }
    for (const id of ids) this.sql.exec('INSERT OR IGNORE INTO hvistas (quien, id, t) VALUES (?, ?, ?)', quien, id, ahora);
    if (ids.length) {
      this.sql.exec('DELETE FROM hvistas WHERE quien = ? AND id NOT IN (SELECT id FROM hvistas WHERE quien = ? ORDER BY t DESC LIMIT ?)',
        quien, quien, HISTORIAS_TOPE);
    }
    const filas = this.sql.exec('SELECT id, t FROM hvistas WHERE quien = ? ORDER BY t DESC LIMIT ?', quien, HISTORIAS_TOPE).toArray();
    return json({ ok: true, vistas: filas.map((f) => [f.id, f.t]) });
  }

  seguir(d) {
    const quien = String(d.quien || '');
    const as = (Array.isArray(d.a) ? d.a : []).filter(claveValida).slice(0, 60);
    if (!/^[0-9]{5,25}$/.test(quien) || !as.length) return json({ error: 'faltan datos' }, 400);
    const ahora = Date.now(), de = claveValida(d.de) ? d.de : '';
    let tope = false;
    if (d.si === false) {
      for (const a of as) this.sql.exec('DELETE FROM sigue WHERE quien = ? AND a = ?', quien, a);
    } else {
      let lugar = SIGUE_TOPE - this.sql.exec('SELECT COUNT(*) AS n FROM sigue WHERE quien = ?', quien).toArray()[0].n;
      for (const a of as) {
        // a uno mismo no se lo sigue
        if (a === de || this.sql.exec('SELECT 1 AS x FROM sigue WHERE quien = ? AND a = ?', quien, a).toArray()[0]) continue;
        if (lugar <= 0) { tope = true; break; }
        // `avisado` 0: a quien seguís le llega «alguien te sigue» (ver `avisarSeguidores()`)
        this.sql.exec('INSERT INTO sigue (quien, a, t, de, creada, avisado) VALUES (?, ?, ?, ?, ?, 0)',
          quien, a, ahora, de, creadaEn(quien));
        this.xpVio(quien, 'sigue', a, ahora);
        lugar--;
      }
    }
    return json(Object.assign({ ok: !tope, sigo: this.sigoDe(quien), n: this.cuantos(as, ahora) },
      tope ? { error: 'tope', tope: SIGUE_TOPE } : {}), tope ? 409 : 200);
  }

  /**
   * A quién seguís y quién te sigue. Sólo lo llama `rutaAvisos`, con el ID de
   * Discord. `de` es tu perfil: de ahí sale quién te sigue.
   *
   * ⚠️ DE QUIÉN TE SIGUE SE DICEN SÓLO LOS PERFILES —los que son raperos de
   * la Liga—; los demás, cuántos. Un Discord ID no sale nunca.
   */
  sigo(d) {
    const quien = String(d.quien || '');
    if (!/^[0-9]{5,25}$/.test(quien)) return json({ error: 'faltan datos' }, 400);
    const de = claveValida(d.de) ? d.de : '';
    // tu perfil puede haber cambiado (entraste con otro nombre): se corrige acá
    if (de) this.sql.exec('UPDATE sigue SET de = ? WHERE quien = ? AND de != ?', de, quien, de);
    let meSiguen = null;
    if (de) {
      const fs = this.sql.exec('SELECT de FROM sigue WHERE a = ? ORDER BY t DESC', de).toArray();
      const perfiles = [...new Set(fs.map((r) => r.de).filter(Boolean))].slice(0, 60);
      meSiguen = { n: this.cuantos([de], Date.now())[de], todos: fs.length, perfiles };
    }
    return json({ ok: true, sigo: this.sigoDe(quien), yo: de, me_siguen: meSiguen });
  }

  /**
   * Lo público: cuántos siguen a cada perfil (sólo los que tienen alguno), y 👥 a cuántos sigue cada perfil (`s`, Dlx,
   * 21/10/2026, al remake del perfil: «seguidores y seguidos»). Sigue quien entró con Discord, y su perfil es `de`.
   */
  seguidores() {
    const ahora = Date.now(), n = {}, s = {};
    for (const r of this.sql.exec('SELECT a, COUNT(*) AS n FROM sigue WHERE creada > 0 AND creada < ? GROUP BY a',
      ahora - EDAD_MIN_DIAS * DIA_MS).toArray()) n[r.a] = r.n;
    for (const r of this.sql.exec("SELECT de, COUNT(*) AS n FROM sigue WHERE de != '' GROUP BY de").toArray()) s[r.de] = r.n;
    return { t: ahora, n, s };
  }

  /**
   * 🔑 LO QUE LE PASÓ A QUIEN SEGUÍS, AL CELULAR. Lee el muro que dejó el
   * ciclo (`web:muro`), y de cada publicación de las últimas `SIGUE_HORAS`
   * le avisa a quien sigue a esa persona desde ANTES de que pasara, en los
   * dispositivos que vinculó. Nunca por DM.
   *
   * ⚠️ EL MURO CAMBIA CUANDO CORRE EL CICLO, así que se lee cada cinco
   * minutos —o al minuto, si quedó algo por mandar—: son 288 lecturas de KV
   * por día y no 1.440. Y sin nadie que siga a nadie, ni eso.
   *
   * ⚠️ UNA VEZ POR PUBLICACIÓN Y PERSONA (`hechos`, 30 días): a quien sigue
   * a dos del mismo equipo campeón le llega uno.
   */
  async seguidos(ahora) {
    if (this.pausada()) return 0;  // 🔔 la campana pausada desde el Dashboard: esperan
    if (!this.sql.exec('SELECT 1 AS x FROM sigue LIMIT 1').toArray()[0]) return 0;
    const previo = this.leer('seguidos') || {};
    if (!previo.quedan && Math.floor(ahora / MIN) % 5 !== 0) return 0;
    let items = [];
    try { items = (JSON.parse((await this.env.KV.get('web:muro')) || '{}').items) || []; } catch (e) { items = []; }
    const cands = paraSeguidores(items, ahora);
    let pedidos = 0, enviados = 0, quedan = 0, sinVinculo = 0;
    for (const c of cands) {
      const fs = this.sql.exec('SELECT quien FROM sigue WHERE a = ? AND t <= ? AND de != ?', c.k, c.t, c.k).toArray();
      for (const f of fs) {
        const id = 'sg:' + c.pub + ':' + f.quien;
        if (this.sql.exec('SELECT id FROM hechos WHERE id = ?', id).toArray()[0]) continue;
        const subs = this.sql.exec('SELECT id, endpoint, p256dh, auth FROM subs WHERE quien = ?', f.quien).toArray();
        if (pedidos + subs.length > TOPE_SEGUIDOS && pedidos) { quedan++; continue; }
        this.sql.exec('INSERT OR IGNORE INTO hechos (id, t) VALUES (?, ?)', id, ahora);
        // 🔔 y a su bandeja, con la cara de quien ganó (ver `aBandeja()`)
        this.aBandeja(f.quien, 'sg:' + c.pub, 'seguido', c.titulo, c.cuerpo, c.url, c.k, c.t || ahora);
        if (!subs.length) { sinVinculo++; continue; }
        pedidos += subs.length;
        const cuerpo = cuerpoPersonal({ id: 'sg' + c.pub, titulo: c.titulo, cuerpo: c.cuerpo, url: c.url });
        const estados = await Promise.all(subs.map((s) => empujar(s, cuerpo,
          { ttl: 24 * 3600, topic: ('sg' + c.pub).slice(0, 32) }, this.env, new Map())));
        let llego = 0, reintentar = false;
        estados.forEach((e, i) => {
          if (e >= 200 && e < 300) { enviados++; llego++; }
          else if (MUERTA(e)) this.sql.exec('DELETE FROM subs WHERE id = ?', subs[i].id);
          else if (e === 0 || e === 429 || e >= 500) reintentar = true;
        });
        if (reintentar && !llego) this.sql.exec('DELETE FROM hechos WHERE id = ?', id);
      }
    }
    this.guardar('seguidos', { t: ahora, publicaciones: cands.length, enviados, sin_vinculo: sinVinculo, quedan });
    return enviados;
  }

  // ── 🔔 seguir una liga (Dlx, 17/10/2026: «Seguir la liga») ──────────────────────────────────────────────────────
  /** Seguir o dejar una liga: `{quien, liga, on}`. Devuelve las que sigue y cuántos siguen esa. */
  ligaSeguir(d) {
    const quien = String(d.quien || ''), liga = String(d.liga || '');
    if (!/^[0-9]{5,25}$/.test(quien) || !LIGA_ID.test(liga)) return { error: 'faltan datos' };
    if (d.on) {
      const n = this.sql.exec('SELECT COUNT(*) AS n FROM liga_sigue WHERE quien = ?', quien).toArray()[0].n;
      if (n >= LIGAS_SEGUIR_TOPE) return { error: 'tope' };
      this.sql.exec('INSERT OR IGNORE INTO liga_sigue (quien, liga, t) VALUES (?, ?, ?)', quien, liga, Date.now());
    } else {
      this.sql.exec('DELETE FROM liga_sigue WHERE quien = ? AND liga = ?', quien, liga);
    }
    return Object.assign(this.misLigas({ quien }), {
      n: this.sql.exec('SELECT COUNT(*) AS n FROM liga_sigue WHERE liga = ?', liga).toArray()[0].n });
  }

  /** Las ligas que sigue alguien, y si tiene un dispositivo vinculado (para decirle si le llega al celular). */
  misLigas(d) {
    const quien = String(d.quien || '');
    if (!/^[0-9]{5,25}$/.test(quien)) return { error: 'faltan datos' };
    return {
      ok: true, ligas: this.sql.exec('SELECT liga FROM liga_sigue WHERE quien = ? ORDER BY t', quien).toArray().map((r) => r.liga),
      celular: !!this.sql.exec('SELECT 1 AS x FROM subs WHERE quien = ? LIMIT 1', quien).toArray()[0],
    };
  }

  /**
   * 🔔 LO NUEVO DE LAS LIGAS QUE SEGUÍS: a la campana (la bandeja) y al celular si lo vinculó. Lo deja el ciclo en
   * `ligas:nov` (`bot/ligas.py`, `para_nov()`): un aviso por liga y por corrida con todos sus resultados nuevos, y uno
   * por fecha anunciada. Como `seguidos()`: cada cinco minutos (o al minuto si quedó algo), una vez por novedad y
   * persona (`hechos`), sólo a quien la seguía desde antes, y con tope por vuelta. Nunca por DM.
   */
  async ligasSeguidas(ahora) {
    if (this.pausada()) return 0;
    if (!this.sql.exec('SELECT 1 AS x FROM liga_sigue LIMIT 1').toArray()[0]) return 0;
    const previo = this.leer('ligas_seguidas') || {};
    if (!previo.quedan && Math.floor(ahora / MIN) % 5 !== 0) return 0;
    let items = [];
    try { items = (JSON.parse((await this.env.KV.get('ligas:nov')) || '{}').items) || []; } catch (e) { items = []; }
    let pedidos = 0, enviados = 0, quedan = 0, sinVinculo = 0, bandeja = 0;
    for (const it of items) {
      const t = Date.parse(it.t || '');
      if (!it.id || !LIGA_ID.test(String(it.liga || '')) || !(t > ahora - 48 * HORA)) continue;
      const fs = this.sql.exec('SELECT quien FROM liga_sigue WHERE liga = ? AND t <= ?', it.liga, t).toArray();
      for (const f of fs) {
        const id = 'lg:' + it.id + ':' + f.quien;
        if (this.sql.exec('SELECT id FROM hechos WHERE id = ?', id).toArray()[0]) continue;
        const subs = this.sql.exec('SELECT id, endpoint, p256dh, auth FROM subs WHERE quien = ?', f.quien).toArray();
        if (pedidos + subs.length > TOPE_LIGAS && pedidos) { quedan++; continue; }
        this.sql.exec('INSERT OR IGNORE INTO hechos (id, t) VALUES (?, ?)', id, ahora);
        this.aBandeja(f.quien, 'lg:' + it.id, 'liga', String(it.titulo || '').slice(0, 120), String(it.cuerpo || '').slice(0, 240),
          String(it.url || ''), '', t);
        bandeja++;
        if (!subs.length) { sinVinculo++; continue; }
        pedidos += subs.length;
        const cuerpo = cuerpoPersonal({ id: 'lg' + it.id, titulo: it.titulo, cuerpo: it.cuerpo, url: it.url });
        const estados = await Promise.all(subs.map((sx) => empujar(sx, cuerpo,
          { ttl: 24 * 3600, topic: ('lg' + it.id).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) }, this.env, new Map())));
        let llego = 0, reintentar = false;
        estados.forEach((e, i) => {
          if (e >= 200 && e < 300) { enviados++; llego++; }
          else if (MUERTA(e)) this.sql.exec('DELETE FROM subs WHERE id = ?', subs[i].id);
          else if (e === 0 || e === 429 || e >= 500) reintentar = true;
        });
        if (reintentar && !llego) this.sql.exec('DELETE FROM hechos WHERE id = ?', id);
      }
    }
    this.guardar('ligas_seguidas', { t: ahora, novedades: items.length, bandeja, enviados, sin_vinculo: sinVinculo, quedan });
    return bandeja;
  }

  /**
   * ⭐ ALGUIEN TE SIGUE, AL CELULAR: a quien siguen, en los dispositivos que vinculó, con su nombre si es uno solo y es
   * de la Liga (`avisoSeguidores()`). Cada cinco minutos —o al minuto si quedó algo—, después de `SEGUIDOR_ESPERA` y
   * como mucho uno por hora por persona: lo que llega en el medio sale junto. Nunca por DM.
   *
   * ⚠️ UNA VEZ POR PAR (`hechos`, 30 días): seguir, dejar y volver a seguir no suena de nuevo. Y las cuentas de menos
   * de 30 días siguen pero no cuentan (`cuantos()`): tampoco suenan.
   */
  async avisarSeguidores(ahora) {
    if (this.pausada()) return 0;  // 🔔 la campana pausada desde el Dashboard: esperan
    const previo = this.leer('seguidores_nuevos') || {};
    if (!previo.quedan && Math.floor(ahora / MIN) % 5 !== 0) return 0;
    const filas = this.sql.exec('SELECT a, quien, de, creada, t FROM sigue WHERE avisado = 0 AND t <= ?',
      ahora - SEGUIDOR_ESPERA).toArray();
    if (!filas.length) {
      if (previo.quedan) this.guardar('seguidores_nuevos', { ...previo, quedan: 0 });
      return 0;
    }
    const listo = (a, quien) => {
      this.sql.exec('UPDATE sigue SET avisado = 1 WHERE quien = ? AND a = ?', quien, a);
      this.sql.exec('INSERT OR IGNORE INTO hechos (id, t) VALUES (?, ?)', 'ns:' + a + ':' + quien, ahora);
    };
    const porA = new Map();
    for (const f of filas) {
      const ya = this.sql.exec('SELECT 1 AS x FROM hechos WHERE id = ?', 'ns:' + f.a + ':' + f.quien).toArray()[0];
      if (ya || !(f.creada > 0 && f.creada < ahora - EDAD_MIN_DIAS * DIA_MS)) { listo(f.a, f.quien); continue; }
      if (!porA.has(f.a)) porA.set(f.a, []);
      porA.get(f.a).push(f);
    }
    const idx = porA.size ? await this.indiceNombres(ahora) : {};
    let pedidos = 0, enviados = 0, quedan = 0, sinVinculo = 0, sinCuenta = 0;
    for (const [a, fs] of porA) {
      const ult = this.sql.exec('SELECT t FROM seguidores_av WHERE a = ?', a).toArray()[0];
      if (ult && ahora - ult.t < SEGUIDOR_ENTRE) continue;      // espera su hora: siguen anotados
      if (pedidos >= TOPE_NUEVOS_SEGUIDORES) { quedan++; continue; }
      const did = await this.cuentaDe(a, ahora, idx);
      const subs = did ? this.sql.exec('SELECT id, endpoint, p256dh, auth FROM subs WHERE quien = ?', did).toArray() : [];
      // ⚠️ se anota antes de mandar (dos minutos que se pisan no avisan dos veces); sin cuenta o sin dispositivo, también:
      // un aviso que no tiene adónde ir no se guarda para después
      for (const f of fs) listo(a, f.quien);
      if (!did) { sinCuenta++; continue; }
      let nombre = '';
      if (fs.length === 1 && claveValida(fs[0].de)) {
        try { nombre = String((JSON.parse(this.persona('p:' + fs[0].de) || (await this.env.KV.get('p:' + fs[0].de)) || '{}') || {}).n || '').slice(0, 40); } catch (e) { nombre = ''; }
      }
      const { titulo, cuerpo } = avisoSeguidores(fs.length, nombre);
      // 🔔 a su bandeja, tenga o no la campana; con la cara de quien te sigue si es uno de la Liga. ⚠️ La clave es la de
      // ESTE grupo de seguidores, no la hora: con `'ns:' + ahora` cada reintento dejaba otra fila igual (revisión del 03/10)
      const claveB = 'ns:' + huella(a + ':' + fs.map((f) => f.quien).sort().join(','));
      this.aBandeja(did, claveB, 'seguidor', titulo, cuerpo, HUB + '/cuenta/siguiendo', nombre ? fs[0].de : '', ahora);
      if (!subs.length) { sinVinculo++; continue; }
      const id = 'ns' + huella(a);
      const c = cuerpoPersonal({ id, titulo, cuerpo, url: HUB + '/cuenta/siguiendo' });
      this.sql.exec('INSERT INTO seguidores_av (a, t) VALUES (?, ?) ON CONFLICT(a) DO UPDATE SET t = excluded.t', a, ahora);
      pedidos += subs.length;
      const estados = await Promise.all(subs.map((s) => empujar(s, c, { ttl: 24 * 3600, topic: id.slice(0, 32) },
        this.env, new Map())));
      let llego = 0, reintentar = false;
      estados.forEach((e, i) => {
        if (e >= 200 && e < 300) { enviados++; llego++; }
        else if (MUERTA(e)) this.sql.exec('DELETE FROM subs WHERE id = ?', subs[i].id);
        else if (e === 0 || e === 429 || e >= 500) reintentar = true;
      });
      // si no llegó a ninguno por una falla de la red, vuelve a la fila para la próxima vuelta. ⚠️ Durante un día y no
      // más: un dispositivo que falla siempre (un DNS que no resuelve) reintentaba cada cinco minutos para siempre
      if (reintentar && !llego && fs.every((f) => ahora - (f.t || 0) < 24 * HORA)) {
        for (const f of fs) {
          this.sql.exec('UPDATE sigue SET avisado = 0 WHERE quien = ? AND a = ?', f.quien, a);
          this.sql.exec('DELETE FROM hechos WHERE id = ?', 'ns:' + a + ':' + f.quien);
        }
        this.sql.exec('DELETE FROM seguidores_av WHERE a = ?', a);
      }
    }
    this.guardar('seguidores_nuevos', { t: ahora, nuevos: filas.length, enviados, sin_vinculo: sinVinculo,
      sin_cuenta: sinCuenta, quedan });
    return enviados;
  }

  /** Para `estado()`, con try como `estadoPersonales()`. */
  estadoSeguidos() {
    try {
      const r = this.sql.exec('SELECT COUNT(*) AS n, COUNT(DISTINCT quien) AS p, COUNT(DISTINCT a) AS a FROM sigue')
        .toArray()[0];
      return { filas: r.n, siguen: r.p, seguidos: r.a, ultima: this.leer('seguidos'),
        nuevos: this.leer('seguidores_nuevos') };
    } catch (e) {
      return { error: String(e).slice(0, 80) };
    }
  }

  // ── 👏 felicitar ─────────────────────────────────────────────────────
  /**
   * Un aplauso. Sólo lo llama `rutaAvisos`, con el ID que dijo Discord y la
   * publicación ya buscada en el muro (`validarAplauso()`). Uno por persona:
   * el segundo toque no suma (`ya`). Devuelve cuántos lleva.
   */
  /**
   * 🏆 EL HINCHA DEL MES (Dlx, 16/10/2026, a «Y más»): quién más participó en la página cada mes —votar, felicitar, mirar
   * en vivo, abrir promos…—, con la misma XP del nivel (`XP_FUENTES` y sus topes, `xpDeFuentes()`), contada por mes en
   * hora del este. Los 30 primeros de este mes y del anterior: `{t, meses: {'2026-10': [[discord_id, xp], …]}}`. Sólo
   * para el ciclo (trae Discord IDs).
   */
  hinchas() {
    const ahora = Date.now();
    const por = {};
    for (const r of this.sql.exec('SELECT quien, que, t FROM xp_log WHERE t > ?', ahora - 65 * DIA_MS).toArray()) {
      const m = diaET(r.t).slice(0, 7);
      const q = ((por[m] = por[m] || {})[r.quien] = por[m][r.quien] || {});
      q[r.que] = (q[r.que] || 0) + 1;
    }
    const meses = {};
    for (const [m, qs] of Object.entries(por)) {
      meses[m] = Object.entries(qs).map(([q, c]) => [q, xpDeFuentes(c).xp]).filter((x) => x[1] > 0)
        .sort((a, b) => b[1] - a[1]).slice(0, 30);
    }
    return { t: ahora, meses };
  }

  // ── 🙋 los pedidos de la gente ───────────────────────────────────────────────────────────────────────────────
  /** Uno nuevo. ⚠️ Con tope (`PEDIDO_TOPE` sin resolver por persona) y el mismo pedido dos veces es uno. */
  pedir(d) {
    const quien = String(d.quien || '');
    const v = validarPedido(d);
    if (!/^[0-9]{5,25}$/.test(quien) || v.error) return json({ error: v.error || 'faltan datos' }, 400);
    const ahora = Date.now();
    this.sql.exec('DELETE FROM pedidos WHERE resuelto > 0 AND resuelto < ?', ahora - PEDIDO_DIAS * DIA_MS);
    const abiertos = this.sql.exec("SELECT id, tipo, k, vid FROM pedidos WHERE quien = ? AND estado IN ('', 'si')", quien).toArray();
    const igual = abiertos.find((x) => x.tipo === v.tipo && x.k === v.k && x.vid === v.vid);
    if (igual) return json({ ok: true, id: igual.id, ya: true });
    if (abiertos.length >= PEDIDO_TOPE) return json({ error: 'tope', tope: PEDIDO_TOPE }, 429);
    const prueba = d.prueba && typeof d.prueba === 'object' ? JSON.stringify(d.prueba).slice(0, 1500) : '';
    this.sql.exec('INSERT INTO pedidos (tipo, quien, k, texto, cc, vid, prueba, t) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      v.tipo, quien, v.k, v.texto, v.cc, v.vid, prueba, ahora);
    const id = this.sql.exec('SELECT last_insert_rowid() AS id').toArray()[0].id;
    return json({ ok: true, id });
  }

  /** Los de una persona, para Mi cuenta: sin pruebas ni quién lo resolvió. */
  misPedidos(d) {
    const quien = String(d.quien || '');
    if (!/^[0-9]{5,25}$/.test(quien)) return { error: 'faltan datos' };
    return { ok: true, pedidos: this.sql.exec('SELECT id, tipo, k, texto, cc, vid, t, estado, resuelto, nota FROM pedidos ' +
      'WHERE quien = ? ORDER BY id DESC LIMIT 10', quien).toArray() };
  }

  /** Para el Dashboard: los sin resolver primero, y lo de los últimos días. */
  pedidosDueno() {
    const ahora = Date.now();
    return this.sql.exec("SELECT id, tipo, quien, k, texto, cc, vid, prueba, t, estado, por, resuelto, nota FROM pedidos " +
      "WHERE estado IN ('', 'si') OR resuelto > ? ORDER BY (estado = '') DESC, id DESC LIMIT 40", ahora - 7 * DIA_MS)
      .toArray().map((x) => {
        let p = {};
        try { p = x.prueba ? JSON.parse(x.prueba) : {}; } catch (e) { p = {}; }
        return Object.assign({}, x, { prueba: p, por: x.por ? this.nombrePor(x.por) : '' });
      });
  }

  /** Sí o no. Los de identidad y de video, al aprobarlos ya quedan hechos (los resuelve Dlx a mano); los de cuenta y
   *  país esperan al ciclo, que los aplica (`bot/pedidos.py`). */
  duenoPedido(d) {
    const p = this.sql.exec('SELECT id, tipo, quien, k, vid, estado FROM pedidos WHERE id = ?', Number(d.id)).toArray()[0];
    if (!p) return { error: 'no existe' };
    if (p.estado !== '') return { error: 'ya', estado: p.estado };
    const manual = p.tipo === 'identidad' || p.tipo === 'video';
    const est = !d.si ? 'no' : manual ? 'hecho' : 'si';
    const ahora = Date.now();
    // 🎬 «UN VIDEO QUE NO ES MÍO», APROBADO, SE SACA DE VERDAD (17/10/2026): va a `videos_quitados`, la misma lista del
    // «Quitar» del perfil, y el ciclo lo saca también de las batallas de los socios (`subir_web`, con
    // `videos_propios.json`). Antes quedaba «hecho» sin que nada pasara
    if (est === 'hecho' && p.tipo === 'video' && claveValida(p.k) && /^[\w-]{11}$/.test(String(p.vid || ''))) {
      this.sql.exec('INSERT OR REPLACE INTO videos_quitados (clave, vid, t) VALUES (?, ?, ?)', p.k, p.vid, ahora);
    }
    this.sql.exec('UPDATE pedidos SET estado = ?, por = ?, resuelto = ?, nota = ? WHERE id = ?', est,
      String(d.por || ''), ahora, String(d.nota || '').slice(0, 200), p.id);
    if (est !== 'si') this.avisarPedido(p, est, String(d.nota || ''), ahora);
    return { ok: true, estado: est, pedidos: this.pedidosDueno() };
  }

  /** 🔔 A quien pidió, cuando se resuelve: a su campana (la bandeja), como los reportes y los fondos. Nunca por DM. */
  avisarPedido(p, est, nota, ahora) {
    const T = {
      cuenta: ['✅ Tu cuenta nueva ya es la de tu perfil', 'Pasó todo: tus tarjetas, tus Puntos de Tienda, tu Pase y a quién sigues.'],
      pais: ['✅ Tu país ya está corregido', 'Se ve en tu perfil y en tus tarjetas en la próxima actualización.'],
      identidad: ['✅ Arreglamos lo que pediste', 'Gracias por avisar.'],
      video: ['✅ Sacamos el video de tu perfil', 'Se va en la próxima actualización.'],
    };
    const [titulo, cuerpo] = est === 'hecho' ? (T[p.tipo] || T.identidad)
      : est === 'no_pude' ? ['⚠️ Tu pedido está aprobado, pero falta un paso', 'Lo termina Dlx a mano.']
        : ['Tu pedido no se aprobó', nota ? nota.slice(0, 160) : 'Si crees que es un error, escribile a un Moderador.'];
    this.aBandeja(p.quien, 'pedido:' + p.id, 'pedido', titulo, cuerpo, HUB + '/cuenta/algo-mal', '', ahora);
  }

  /** Para el ciclo: lo aprobado de cuenta y país, con quién lo pidió. */
  pedidosCiclo() {
    const sinVieja = this.sql.exec("SELECT id, quien, k, prueba FROM pedidos WHERE estado = '' AND tipo = 'cuenta'").toArray()
      .filter((x) => !String(x.prueba || '').includes('"vieja"')).map((x) => ({ id: x.id, quien: x.quien, k: x.k }));
    return { t: Date.now(), pedidos: this.sql.exec("SELECT id, tipo, quien, k, cc, texto FROM pedidos WHERE estado = 'si' " +
      "AND tipo IN ('cuenta', 'pais')").toArray(), sin_vieja: sinVieja };
  }

  /** Lo que hizo el ciclo: `{estados: {id: {ok, nota}}}`. */
  pedidosEstados(d) {
    let n = 0;
    const ahora = Date.now();
    for (const [id, x] of Object.entries((d && d.estados) || {})) {
      const est = x && x.ok ? 'hecho' : 'no_pude';
      const r = this.sql.exec("UPDATE pedidos SET estado = ?, nota = ? WHERE id = ? AND estado = 'si'", est,
        String((x && x.nota) || '').slice(0, 200), Number(id));
      if (r.rowsWritten) {
        const p = this.sql.exec('SELECT id, tipo, quien FROM pedidos WHERE id = ?', Number(id)).toArray()[0];
        if (p) this.avisarPedido(p, est, '', ahora);
      }
      n += r.rowsWritten || 0;
    }
    return { ok: true, n };
  }

  /**
   * 🔎 LA CUENTA VIEJA DE UN «PERDÍ MI CUENTA» (17/10/2026). La prueba que junta el Worker es de la cuenta NUEVA; la
   * vieja la conoce sólo el ciclo (la Lista), y es la mitad que más dice: si la vieja sigue en DRA, alguien puede estar
   * pidiendo un perfil ajeno. `{pruebas: {id: {...}}}` se guarda como `prueba.vieja`, sólo en los sin contestar.
   */
  pedidosPrueba(d) {
    let n = 0;
    for (const [id, x] of Object.entries((d && d.pruebas) || {})) {
      if (!/^\d{1,12}$/.test(id) || !x || typeof x !== 'object') continue;
      const p = this.sql.exec("SELECT prueba FROM pedidos WHERE id = ? AND tipo = 'cuenta' AND estado = ''", Number(id)).toArray()[0];
      if (!p) continue;
      let pr = {};
      try { pr = p.prueba ? JSON.parse(p.prueba) : {}; } catch (e) { pr = {}; }
      const v = {};
      for (const c of ['usuario', 'nombre', 'creada', 'apodo_dra', 'en_dra_desde', 'id']) {
        if (x[c] !== undefined) v[c] = String(x[c]).slice(0, 40);
      }
      for (const c of ['en_dra', 'miembro', 'sin_cuenta']) if (x[c] !== undefined) v[c] = !!x[c];
      pr.vieja = v;
      this.sql.exec('UPDATE pedidos SET prueba = ? WHERE id = ?', JSON.stringify(pr).slice(0, 2000), Number(id));
      n++;
    }
    return { ok: true, n };
  }

  /**
   * 🔁 PASAR TODO DE UNA CUENTA A OTRA (Dlx, 17/10/2026, «Todo»: perdió su cuenta de Discord y tiene una nueva). Las mismas
   * tablas que borra «olvidarme» (`olvidar()`), pero en vez de borrar se mudan: si la nueva ya tiene lo mismo (votó la
   * misma encuesta, sigue al mismo), queda lo de la nueva. Las sesiones de la vieja se cierran: ya no entra como él.
   * Lo llama el ciclo con su clave, después de pasar la fila de la Lista (`bot/pedidos.py`).
   */
  async mudarCuenta(d) {
    const viejo = String((d && d.viejo) || ''), nuevo = String((d && d.nuevo) || '');
    if (!/^[0-9]{5,25}$/.test(viejo) || !/^[0-9]{5,25}$/.test(nuevo) || viejo === nuevo) return { error: 'faltan datos' };
    const tablas = ['subs', 'votos', 'liga_voto', 'tienda', 'precios', 'sigue', 'servidor', 'activo', 'jugo_temp', 'foto_oculta',
      'reportes', 'aplausos', 'pase_hecho', 'pase_vivo', 'pase_log', 'pase_hito', 'xp_log', 'promo_visto', 'promo_extra',
      'uso', 'bandeja', 'fondos', 'fotos_carta', 'postulaciones', 'sigue_org', 'org_cola', 'videos_pedidos',
      'videos_reportes', 'agenda', 'cambios_dia', 'apostado', 'qg_voto', 'roles_manual', 'liga_sigue',
      // 💎🖼️ lo del 25/10/2026: el premium, sus avisos, su color, sus marcos y lo del sorteo
      'pase_premium', 'pase_aviso', 'pase_color', 'marcos', 'marco_elige', 'sorteo_part',
      // 🏷️ y el TAG que eligió para cada carta
      'tag_elige'];
    const movidas = {}, fallas = [];
    // 🔴 LAS CLAVES DE LA TIENDA LLEVAN EL ID ADENTRO (pasada del 19/10/2026): `rhito:<id>:…`, `racha:<id>:…`,
    // `rdia:<día>:<id>`, `bien:<id>:<paso>`, `pase:…:<id>:<nivel>`… Pasaba la fila a la cuenta nueva con la clave vieja,
    // y al mirar «¿ya cobró este hito?» con la clave nueva no la encontraba: pagaba los hitos de racha (y lo demás) dos
    // veces. Primero se cambia el ID en la clave; lo que choca con algo que la nueva ya tenía queda como estaba
    try {
      this.sql.exec("UPDATE OR IGNORE tienda SET id = replace(id, ':' || ?, ':' || ?) WHERE quien = ? AND instr(id, ':' || ?) > 0",
        viejo, nuevo, viejo, viejo);
    } catch (e) { fallas.push('tienda-claves'); }
    for (const t of tablas) {
      try {
        const r = this.sql.exec(`UPDATE OR IGNORE ${t} SET quien = ? WHERE quien = ?`, nuevo, viejo);
        this.sql.exec(`DELETE FROM ${t} WHERE quien = ?`, viejo);
        if (r.rowsWritten) movidas[t] = r.rowsWritten;
      } catch (e) { fallas.push(t); }
    }
    try { this.sql.exec('UPDATE OR IGNORE idk SET id = ? WHERE id = ?', nuevo, viejo); } catch (e) { fallas.push('idk'); }
    // 👥 las crews son de un PERFIL, no de una cuenta: sólo se anota el ID nuevo (no van en `tablas`, que borra lo viejo)
    try { CW.crewMudar(this, viejo, nuevo); } catch (e) { fallas.push('crews'); }
    try { this.sql.exec('UPDATE inscritos SET autor_id = ? WHERE autor_id = ?', nuevo, viejo); } catch (e) { fallas.push('inscritos'); }
    this.sql.exec('DELETE FROM sesiones WHERE quien = ?', viejo);
    if (movidas.foto_oculta) await this.espejarOcultas();
    if (movidas.reportes) await this.colaReportes(Date.now());
    return { ok: !fallas.length, movidas, fallas };
  }

  /** 📣 Una semana más de una promo suya: cobra `PROMO_SEMANA_PAGA` y suma `PROMO_SEMANA_MS` a lo que le quedaba. */
  promoExtender(d) {
    const quien = String(d.quien || ''), pid = String(d.pid || ''), ini = Number(d.inicial), base = Number(d.base);
    if (!/^[0-9]{5,25}$/.test(quien) || !pid || pid.length > 60 || !Number.isInteger(ini) || !(base > 0)) {
      return json({ error: 'faltan datos' }, 400);
    }
    const ahora = Date.now();
    // ⚠️ EL SALDO SE MIRA ACÁ, como en `precio()`: el objeto es uno solo y dos pedidos no gastan la misma plata
    const s = this.saldo(quien, Number(d.desde) || 0, ini);
    if (PROMO_SEMANA_PAGA > s) return json({ error: 'saldo', saldo: s, precio: PROMO_SEMANA_PAGA }, 409);
    const ya = this.sql.exec('SELECT hasta FROM promo_extra WHERE pid = ?', pid).toArray()[0];
    const hasta = Math.max(base, ya ? ya.hasta : 0, ahora) + PROMO_SEMANA_MS;
    this.state.storage.transactionSync(() => {
      this.sql.exec('INSERT OR REPLACE INTO promo_extra (pid, quien, hasta, t) VALUES (?, ?, ?, ?)', pid, quien, hasta, ahora);
      this.sql.exec('INSERT OR REPLACE INTO tienda (id, ref, quien, monto, t) VALUES (?, 0, ?, ?, ?)',
        'promox:' + quien + ':' + pid + ':' + ahora, quien, -PROMO_SEMANA_PAGA, ahora);
    });
    return json({ ok: true, hasta, saldo: s - PROMO_SEMANA_PAGA, precio: PROMO_SEMANA_PAGA });
  }

  /** Lo público, para el ciclo (`/avisos/promos-extra`): hasta cuándo va cada promo alargada. ⚠️ Nunca quién pagó. */
  promosExtra() {
    const ahora = Date.now();
    this.sql.exec('DELETE FROM promo_extra WHERE hasta < ?', ahora - PROMO_DIAS * DIA_MS);
    const out = {};
    for (const r of this.sql.exec('SELECT pid, hasta FROM promo_extra WHERE hasta > ?', ahora).toArray()) out[r.pid] = r.hasta;
    return { t: ahora, extra: out };
  }

  /** Lo público, para la Promo del mes (`/avisos/promos-vistas`): cuántos abrieron cada una. ⚠️ Nunca quién. */
  promosVistas() {
    const n = {};
    for (const r of this.sql.exec('SELECT pid, COUNT(*) AS c FROM promo_visto GROUP BY pid').toArray()) n[r.pid] = r.c;
    return { t: Date.now(), n };
  }

  promoVio(d) {
    const quien = String(d.quien || ''), pid = String(d.pid || '');
    if (!/^[0-9]{5,25}$/.test(quien) || !pid || pid.length > 60) return json({ error: 'faltan datos' }, 400);
    const ahora = Date.now(), dia = diaET(ahora);
    this.sql.exec('DELETE FROM promo_visto WHERE t < ?', ahora - PROMO_DIAS * DIA_MS);
    const ya = this.sql.exec('SELECT pago FROM promo_visto WHERE quien = ? AND pid = ?', quien, pid).toArray()[0];
    const hoy = () => this.sql.exec('SELECT COUNT(*) AS n FROM promo_visto WHERE quien = ? AND dia = ? AND pago > 0', quien, dia)
      .toArray()[0].n;
    if (ya) return json({ ok: true, nuevo: false, pago: 0, hoy: hoy(), tope: PROMO_TOPE_DIA });
    const paga = hoy() < PROMO_TOPE_DIA ? PROMO_PAGA : 0;
    this.sql.exec('INSERT OR IGNORE INTO promo_visto (quien, pid, dia, pago, t) VALUES (?, ?, ?, ?, ?)', quien, pid, dia, paga, ahora);
    if (paga) {
      this.sql.exec('INSERT OR REPLACE INTO tienda (id, ref, quien, monto, t) VALUES (?, 0, ?, ?, ?)',
        'promo:' + quien + ':' + pid, quien, paga, ahora);
    }
    // ⭐ y la XP: la del nivel (todos) y la del Pase (sus Tareas cuentan las promos abiertas)
    this.xpVio(quien, 'promo', pid, ahora);
    if (this.paseVio(quien, 'promo', pid, ahora)) this.paseRevisar(quien);
    return json({ ok: true, nuevo: true, pago: paga, hoy: hoy(), tope: PROMO_TOPE_DIA });
  }

  aplaudir(d) {
    const quien = String(d.quien || ''), p = d.pub || {};
    if (!/^[0-9]{5,25}$/.test(quien) || !/^[0-9a-f]{12}$/.test(String(p.id || '')) || !APLAUDIBLES[p.tipo]) {
      return json({ error: 'faltan datos' }, 400);
    }
    const ahora = Date.now();
    // lo que dice el aviso y a quién va: se pisa, así un nombre corregido en el muro llega al próximo aviso
    this.sql.exec('INSERT INTO aplaudidas (id, tipo, quien, ks, motivo, t, primero) VALUES (?, ?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT(id) DO UPDATE SET quien = excluded.quien, ks = excluded.ks, motivo = excluded.motivo',
    p.id, p.tipo, JSON.stringify(p.quien || []), JSON.stringify(p.ks || []), String(p.motivo || '').slice(0, 120),
    String(p.t || '').slice(0, 30), ahora);
    const r = this.sql.exec('INSERT OR IGNORE INTO aplausos (id, quien, t) VALUES (?, ?, ?)', p.id, quien, ahora);
    // 🎟️ y las Tareas del Pase de felicitar: queda anotado en `pase_log`, que dura toda la temporada
    if (r.rowsWritten) {
      this.paseVio(quien, 'fel', p.id, ahora);
      this.paseRevisar(quien);
      this.xpVio(quien, 'fel', p.id, ahora);
    }
    const n = this.sql.exec('SELECT COUNT(*) AS n FROM aplausos WHERE id = ?', p.id).toArray()[0].n;
    return json({ ok: true, id: p.id, n, ya: !r.rowsWritten, t: ahora });
  }

  /** Lo público, para `/avisos/aplausos`: cuántos lleva cada publicación. ⚠️ Nunca quién. */
  aplausosCuenta() {
    const n = {};
    for (const r of this.sql.exec('SELECT id, COUNT(*) AS n FROM aplausos GROUP BY id').toArray()) n[r.id] = r.n;
    return { t: Date.now(), n };
  }

  /**
   * 👏 CUÁNTOS TE FELICITARON, AL CELULAR: a quien es la publicación, en los
   * dispositivos que vinculó, con el mismo `tag` —el aviso nuevo reemplaza al
   * anterior— y sólo con el primero y en cada hito (`aplausoParaAvisar()`).
   * Cada cinco minutos, o al minuto si quedó algo. Nunca por DM.
   *
   * ⚠️ SE ANOTA ANTES DE MANDAR (dos minutos que se pisan no avisan dos veces),
   * y se vuelve atrás si no llegó a ninguno por una falla de la red.
   */
  async avisarAplausos(ahora) {
    if (this.pausada()) return 0;  // 🔔 la campana pausada desde el Dashboard: esperan
    const previo = this.leer('aplausos') || {};
    if (!previo.quedan && Math.floor(ahora / MIN) % 5 !== 0) return 0;
    const filas = this.sql.exec('SELECT p.id, p.quien, p.ks, p.motivo, p.t, p.primero, p.avisado, p.t_avisado, ' +
      '(SELECT COUNT(*) FROM aplausos a WHERE a.id = p.id) AS n FROM aplaudidas p').toArray();
    const cands = filas.filter((f) => aplausoParaAvisar(f, ahora));
    if (!cands.length) {
      if (previo.quedan) this.guardar('aplausos', { ...previo, quedan: 0 });
      return 0;
    }
    const idx = await this.indiceNombres(ahora);
    let pedidos = 0, enviados = 0, quedan = 0, sinVinculo = 0, sinCuenta = 0;
    for (const f of cands) {
      if (pedidos >= TOPE_APLAUSOS) { quedan++; continue; }
      let quien = [], ks = [];
      try { quien = JSON.parse(f.quien || '[]'); ks = JSON.parse(f.ks || '[]'); } catch (e) { quien = []; }
      // de quién es: la cuenta del perfil de la publicación (`cuentaDe()`), con el nombre que trae el muro
      const dids = [];
      for (let i = 0; i < quien.length; i++) {
        if (!claveValida(ks[i])) continue;
        const did = await this.cuentaDe(ks[i], ahora, idx, quien[i]);
        if (did && dids.indexOf(did) < 0) dids.push(did);
      }
      this.sql.exec('UPDATE aplaudidas SET avisado = ?, t_avisado = ? WHERE id = ?', f.n, ahora, f.id);
      if (!dids.length) { sinCuenta++; continue; }
      const { titulo, cuerpo } = avisoAplauso(f.n, f.motivo);
      // 🔔 a la bandeja de cada uno, tenga o no la campana: el mismo aviso se pisa con el número nuevo
      for (const did of dids) this.aBandeja(did, 'ap:' + f.id, 'aplauso', titulo, cuerpo, HUB + '/freestyle-rap/publicaciones', '', ahora);
      const c = cuerpoPersonal({ id: 'ap' + f.id, titulo, cuerpo, url: HUB + '/freestyle-rap/publicaciones' });
      let llego = 0, reintentar = false;
      for (const did of dids) {
        const subs = this.sql.exec('SELECT id, endpoint, p256dh, auth FROM subs WHERE quien = ?', did).toArray();
        if (!subs.length) { sinVinculo++; continue; }
        pedidos += subs.length;
        const estados = await Promise.all(subs.map((s) => empujar(s, c,
          { ttl: 24 * 3600, topic: ('ap' + f.id).slice(0, 32) }, this.env, new Map())));
        estados.forEach((e, i) => {
          if (e >= 200 && e < 300) { enviados++; llego++; }
          else if (MUERTA(e)) this.sql.exec('DELETE FROM subs WHERE id = ?', subs[i].id);
          else if (e === 0 || e === 429 || e >= 500) reintentar = true;
        });
      }
      if (reintentar && !llego) {
        this.sql.exec('UPDATE aplaudidas SET avisado = ?, t_avisado = ? WHERE id = ?', f.avisado, f.t_avisado, f.id);
      }
    }
    this.guardar('aplausos', { t: ahora, candidatas: cands.length, enviados, sin_vinculo: sinVinculo,
      sin_cuenta: sinCuenta, quedan });
    return enviados;
  }

  // ── 👥 el logo de una crew (19/10/2026) ──────────────────────────────
  /**
   * 👥 Una acción de crew. Crear y cambiar el logo traen una imagen (Dlx: «un logo que pase por el auto filtro que
   * tenemos»): ANTES se mira que la acción se pueda hacer —no se gasta la IA ni R2 en una crew que no se iba a crear—,
   * después el filtro de los fondos (`filtrarImagen()`), y recién ahí se guarda y se hace (bot/crews.js). Con algo que no
   * va, no entra; dudoso, entra a revisar (`logo_pend`) y la crew se crea igual.
   */
  async crewConImagen(d) {
    const a = String(d.accion || '');
    if (a !== 'crear' && a !== 'logo') return CW.crewAccion(this, d);
    const ch = a === 'crear' ? CW.chequeoCrear(this, d) : CW.chequeoLogo(this, d);
    if (ch.error) return ch;
    if (!d.img) return { error: 'logo', estado: 400 };
    const quien = String(d.quien || '');
    let b = null;
    try { b = Uint8Array.from(atob(d.img), (c) => c.charCodeAt(0)); } catch (e) { b = null; }
    // por los primeros bytes, no por lo que dice el pedido (`tipoImagen()`)
    const tipo = b ? tipoImagen(b) : '';
    if (!tipo) return { error: 'no es una imagen', estado: 400 };
    if (b.length > CW.LOGO_TOPE) return { error: 'demasiado grande', estado: 413 };
    b = limpiarMetadatos(b);
    if (!b || tieneMetadatos(b)) return { error: 'metadatos', estado: 400 };
    // 🛡️ con tope propio, como los fondos: si no, se podrían probar mil imágenes contra la IA hasta que una pase
    if (!this.cuentaCambio(quien, 'crew_logo_filtro', 8)) return { error: 'espera_dia', estado: 429 };
    let filtro = { v: 'revisar', si: [], quizas: [], crudo: '', error: 'sin IA' };
    if (this.env.AI) {
      try { filtro = await filtrarImagen(this.env, d.img, tipo); } catch (e) {
        filtro = { v: 'revisar', si: [], quizas: [], crudo: '', error: String((e && e.message) || e).slice(0, 100) };
      }
    }
    this.anotarFiltro(quien, String(d.de || ''), Object.assign({ tipo: 'crew' }, filtro), Date.now());
    if (filtro.v === 'no') {
      const cats = filtro.si.filter((x) => FILTRO_NO.includes(x));
      return { error: 'filtro', estado: 400, cats, texto: cats.map((x) => FILTRO_TEXTO[x]).join(', ') };
    }
    const azar = Array.from(crypto.getRandomValues(new Uint8Array(12)), (x) => x.toString(16).padStart(2, '0')).join('');
    const clave = CW.LOGO_CARPETA + azar + '.' + ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[tipo]);
    try {
      await this.env.CARTAS.put(clave, b, { httpMetadata: { contentType: tipo, cacheControl: 'public, max-age=31536000' } });
    } catch (e) {
      return { error: 'no pude guardarla', estado: 500 };
    }
    const url = R2_PUB + '/' + clave;
    const r = CW.crewAccion(this, Object.assign({}, d, { img: undefined, logo_url: url, logo_v: filtro.v === 'ok' ? 'ok' : 'revisar' }));
    if (r.error) { await this.borrarLogosCrew([url]); return r; }
    if (r.viejos) await this.borrarLogosCrew(r.viejos);
    delete r.viejos;
    return r;
  }

  /**
   * 🪪 Menciona en el chat general de su servidor más activo a los de las crews que no están verificados (Dlx,
   * 19/10/2026: «darles 7 días pero mencionarles en el sv más activo que están»), una sola vez por persona (`pend_av`).
   * El servidor lo elige el ciclo; si ese no tiene chat general encontrado o el Dashboard le apagó el bot en su chat
   * (`en_vivo` en `false`), va al de DRA, que es donde se verifica. En el horario de silencio espera a la corrida
   * siguiente, y sin ningún chat también. Devuelve `{sv: cuántos}`: ningún ID, el log del ciclo es público.
   */
  async anunciarSinVerificar(lista, ahora) {
    const aj = this.ajustes();
    if (enSilencio(aj, ahora)) return { silencio: lista.length };
    const dash = (aj.en_vivo && typeof aj.en_vivo === 'object') ? aj.en_vivo : {};
    const gen = new Map(((this.leer('canales') || {}).generales || []).map((x) => [x.sv, String(x.id || '')]));
    const hay = (sv) => !!sv && dash[sv] !== false && /^[0-9]{5,25}$/.test(gen.get(sv) || '');
    const grupos = new Map();
    let espera = 0;
    for (const p of lista) {
      const sv = hay(p.sv) ? p.sv : (hay('DRA') ? 'DRA' : '');
      if (!sv) { espera += 1; continue; }
      if (!grupos.has(sv)) grupos.set(sv, []);
      grupos.get(sv).push(p);
    }
    const out = espera ? { espera } : {};
    for (const [sv, ps] of grupos) {
      for (const m of textosSinVerificar(ps, HUB + '/cuenta/verificar')) {
        let r = null;
        try {
          r = await fetch(`${DC}/channels/${gen.get(sv)}/messages`, {
            method: 'POST',
            headers: { Authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'User-Agent': UA, 'content-type': 'application/json' },
            body: JSON.stringify({ content: m.texto, allowed_mentions: { parse: [], users: m.ids }, flags: 4 }),
          });
        } catch (e) { r = null; }
        // ⚠️ un 4xx (sin permiso en ese canal…) no se reintenta: sería el mismo error cada media hora
        if (r && (r.ok || (r.status >= 400 && r.status < 500 && r.status !== 429))) {
          CW.crewVerificarAnunciados(this, m.ks);
          if (r.ok) out[sv] = (out[sv] || 0) + m.ks.length;
          else out['fallo_' + r.status] = (out['fallo_' + r.status] || 0) + m.ks.length;
        }
      }
    }
    return out;
  }

  /** 🗳️ `{t, temporada, n: {nombre: veces}}`: a quién votó el público como ganador, en la temporada de ahora. Nombres, como
   *  los escribe la llave: la clave la pone el ciclo, que es quien resuelve los nombres. */
  favoritos() {
    const temporada = String(this.env.TEMPORADA || 't1');
    const n = {};
    for (const r of this.sql.exec('SELECT n, COUNT(*) AS c FROM qg_fav WHERE temporada = ? GROUP BY n', temporada).toArray()) {
      n[r.n] = Number(r.c) || 0;
    }
    return { t: Date.now(), temporada, n };
  }

  /**
   * 📊 EL PANEL DE UN SOCIO (Dlx, 19/10/2026: «un acceso especial tipo dashboard para los socios, o sea los owners de los
   * sv… para ver cómo sus servidores están mejorando, sus estadísticas», *«tier 1 y tier 2»*, y el dueño «automático y
   * lo corregís vos»). Los servidores de `quien`: los Tier 1 y 2 de los que es dueño en Discord (lo lee `bot/tiers.py`)
   * o que Dlx le asignó en el Dashboard (`socios_duenos`, que manda sobre lo de Discord). Dlx los ve todos. Lo de cada
   * uno: su puntaje y el de antes, sus cuatro partes, el panel que armó el ciclo y las visitas a su página de las
   * últimas 4 semanas (`secciones`, una por navegador y por día). ⚠️ Sin lo que es sólo de Dlx: ni la recomendación de
   * `bot/tiers.py` ni el Discord ID del dueño.
   */
  /** 📊 Cuántos dueños distintos abrieron su panel, los últimos 7 días (para Números del Dashboard). Nunca quién. */
  panelesVistos(ahora = Date.now()) {
    try {
      return Number((this.sql.exec('SELECT COUNT(DISTINCT quien) AS n FROM socio_vistas WHERE dia >= ? AND quien != ?',
        diaET(ahora - 6 * DIA_MS), DUENO).toArray()[0] || {}).n) || 0;
    } catch (e) { return 0; }
  }

  /** Los socios de los que `quien` es dueño (en Discord, o por `socios_duenos` del Dashboard, que manda); Dlx, todos.
   *  Los tres tiers desde el 20/10/2026 (nació para 1 y 2): Dlx, del dueño de FDS, Tier 3, «para que pueda ver su página
   *  y sus estadísticas». La misma puerta para el panel y para sus ajustes: `{esDlx, T, lista}`, cada uno con su `tier` ya
   *  resuelto */
  sociosDe(quien) {
    const T = this.leer('tiers') || {};
    const aj = this.ajustes();
    const mano = (aj.socios_duenos && typeof aj.socios_duenos === 'object') ? aj.socios_duenos : {};
    const tiers = (aj.tiers && typeof aj.tiers === 'object') ? aj.tiers : {};
    const esDlx = quien === DUENO;
    const de = (x) => (Array.isArray(mano[x.sv]) && mano[x.sv].length ? mano[x.sv] : (x.dueno ? [x.dueno] : []));
    const tierDe = (x) => tiers[x.sv] || x.tier || 1;
    // 🎛️ el panel es un beneficio (20/10/2026): lo que Dlx eligió recién manda sobre lo que trajo el ciclo
    const ben = (aj.beneficios && typeof aj.beneficios === 'object') ? aj.beneficios : {};
    const conPanel = (x) => ((ben[x.sv] || {}).panel ?? (x.ben || {}).panel) !== false;
    const lista = (T.servidores || []).filter((x) => [1, 2, 3].includes(tierDe(x)) && (esDlx || (conPanel(x) && de(x).includes(quien))))
      .map((x) => ({ ...x, tier: tierDe(x) }));
    return { esDlx, T, lista };
  }

  panelSocio(d) {
    const quien = String((d && d.quien) || '');
    const { esDlx, T, lista } = this.sociosDe(quien);
    const desde = diaET(Date.now() - 27 * DIA_MS);
    const servidores = lista.map((x) => ({
      sv: x.sv, nombre: x.nombre, tier: x.tier, puntos: x.puntos, antes: x.antes, compara: x.compara !== false,
      compara_desde: x.compara_desde || '', partes: x.partes, m: x.m, ultimo: x.ultimo,
      sin_jugar: x.sin_jugar, panel: x.panel || null,
      visitas: this.sql.exec('SELECT dia, n FROM secciones WHERE s = ? AND dia >= ? ORDER BY dia', 'sv-' + x.sv, desde).toArray()
        .map((r) => [r.dia, Number(r.n) || 0]),
    }));
    // 📊 para saber si lo usan: un día por dueño (sin Dlx). Se borra a los 30 días con lo demás del vigía
    if (servidores.length && !esDlx) {
      try {
        this.sql.exec('CREATE TABLE IF NOT EXISTS socio_vistas (dia TEXT NOT NULL, quien TEXT NOT NULL, PRIMARY KEY (dia, quien))');
        this.sql.exec('INSERT OR IGNORE INTO socio_vistas (dia, quien) VALUES (?, ?)', diaET(), quien);
        this.sql.exec('DELETE FROM socio_vistas WHERE dia < ?', diaET(Date.now() - 30 * DIA_MS));
      } catch (e) { /* es un conteo */ }
    }
    return json({ ok: true, t: T.t || '', semanas: T.semanas || 4, todos: esDlx, servidores });
  }

  /** 🗺️ El guild de un servidor: el mapa que deja el vigía (`guilds`), o el del chat general si todavía no lo dejó */
  guildDe(sv) {
    const g = (this.leer('guilds') || {})[sv];
    if (g) return String(g);
    const gen = ((this.leer('canales') || {}).generales || []).find((x) => x.sv === sv);
    return gen && gen.g ? String(gen.g) : '';
  }

  /** 📋 Los canales de texto de un servidor, para elegir en el panel: `[{id, n, cat}]` en el orden de Discord, hasta 200;
   *  `null` si Discord no contestó. En memoria 5 minutos: cambiar tres ajustes seguidos no son tres pedidos */
  async canalesDe(g) {
    const ahora = Date.now();
    if (!this._canalesSv) this._canalesSv = new Map();
    const c = this._canalesSv.get(g);
    if (c && ahora - c.t < 5 * MIN) return c.lista;
    try {
      const r = await fetch(`${DC}/guilds/${g}/channels`, {
        headers: { Authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'User-Agent': UA },
      });
      if (r.status !== 200) return null;
      const cs = await r.json();
      const cats = new Map((cs || []).filter((x) => x && x.type === 4).map((x) => [String(x.id), x]));
      const pos = (x) => { const p = cats.get(String(x.parent_id || '')); return [p ? Number(p.position) || 0 : -1, Number(x.position) || 0]; };
      const lista = (cs || []).filter((x) => x && x.type === 0)
        .sort((a, b) => { const [pa, qa] = pos(a), [pb, qb] = pos(b); return pa - pb || qa - qb; })
        .slice(0, 200)
        .map((x) => ({ id: String(x.id), n: String(x.name || '').slice(0, 60),
          cat: String((cats.get(String(x.parent_id || '')) || {}).name || '').slice(0, 40) }));
      this._canalesSv.set(g, { t: ahora, lista });
      return lista;
    } catch (e) { return null; }
  }

  /**
   * ⚙️ LOS AJUSTES DEL BOT, DESDE EL PANEL DEL SOCIO (Dlx, 19/10/2026: «que los socios puedan usar las opciones de
   * /settings en su propia página… que ellos tengan su página o su dashboard propio… para que ellos manejen esas cosas
   * mejor»). Lo mismo que `/settings` en Discord —el MISMO `cfg:<guild>` de KV, así lo último que se toque en cualquiera
   * de los dos es lo que vale— más «Eventos de Discord», que hasta hoy prendía sólo Dlx. La misma puerta que
   * `panelSocio()`: el dueño del servidor (Dlx, todos). Sin `cambio` sólo lee. Los canales para elegir salen de Discord
   * en el momento (`canalesDe()`), y un cambio vale sólo con un canal de ESE servidor (`socioAjusteValido()`).
   * ⚠️ Lo que Dlx fijó en el Dashboard para ese servidor —el bot en vivo, cuánto habla, las apuestas, el aviso de cada
   * evento— GANA POR ABAJO Y NO SE LE MUESTRA (Dlx, 19/10/2026: «lo mío manda, pero que no le aparezca eso a ellos,
   * sino que ellos lo pueden cambiar»): el dueño ve y cambia lo suyo, como con `/settings`, y el Dashboard decide.
   * 🕓 Qué cambió cada dueño queda en `socio_hist` (los 50 últimos), para mirarlo si algo se ve raro.
   */
  async socioAjustes(d) {
    const quien = String((d && d.quien) || '');
    const sv = String((d && d.sv) || '').toUpperCase();
    const x = this.sociosDe(quien).lista.find((s) => s.sv === sv);
    if (!x) return json({ error: 'no' }, 403);
    const g = this.guildDe(sv);
    if (!g) return json({ error: 'sin_guild' }, 404);
    const canales = await this.canalesDe(g);
    if (!canales) return json({ error: 'discord' }, 503);
    let cfg = { ...CFG_BASE };
    try { cfg = { ...CFG_BASE, ...(JSON.parse((await this.env.KV.get('cfg:' + g)) || '{}') || {}) }; } catch (e) { /* sin KV, lo de siempre */ }
    let aj = this.ajustes();
    if (d && d.cambio && typeof d.cambio === 'object') {
      const cual = String(d.cambio.cual || '');
      const v = socioAjusteValido(cual, d.cambio.valor, canales);
      if (v === undefined) return json({ error: 'valor' }, 400);
      // ⏱️ una escritura cada 2 s por servidor: KV tiene 1.000 escrituras por día para todo el bot
      if (!this._cfgT) this._cfgT = new Map();
      const ahora = Date.now();
      if (ahora - (this._cfgT.get(g) || 0) < 2000) return json({ error: 'espera' }, 429);
      this._cfgT.set(g, ahora);
      let antes;
      if (cual === 'eventos_discord') {
        const ev = { ...((aj.eventos_discord && typeof aj.eventos_discord === 'object') ? aj.eventos_discord : {}) };
        antes = ev[sv] === true;
        if (v) ev[sv] = true; else delete ev[sv];
        if (antes !== v) { this.ajuste({ cual: 'eventos_discord', valor: ev, por: quien }); aj = this.ajustes(); }
      } else {
        antes = cfg[cual];
        if (JSON.stringify(antes) !== JSON.stringify(v)) {
          cfg[cual] = v;
          try { await this.env.KV.put('cfg:' + g, JSON.stringify(cfg)); } catch (e) { return json({ error: 'kv' }, 503); }
        }
      }
      if (JSON.stringify(antes) !== JSON.stringify(v)) {
        const h = this.leer('socio_hist') || [];
        h.unshift({ t: ahora, sv, cual, antes: antes === undefined ? null : antes, despues: v, por: quien });
        this.guardar('socio_hist', h.slice(0, 50));
      }
    }
    const gen = ((this.leer('canales') || {}).generales || []).find((c) => c.sv === sv);
    return json({
      ok: true, sv,
      cfg: { nick: cfg.nick !== false, canales: Array.isArray(cfg.canales) ? cfg.canales.map(String) : [], avisos: String(cfg.avisos || ''),
        vivo: String(cfg.vivo || ''), vivo_nivel: NIVELES_CHAT[cfg.vivo_nivel] ? cfg.vivo_nivel : 'normal',
        apuestas: cfg.apuestas === true, ascenso: String(cfg.ascenso || ''),
        aviso_evento: (cfg.aviso_evento === 'chat' || cfg.aviso_evento === 'no') ? cfg.aviso_evento : '' },
      eventos_discord: ((aj.eventos_discord && typeof aj.eventos_discord === 'object') ? aj.eventos_discord : {})[sv] === true,
      canales, general: gen ? String(gen.id) : '',
      niveles: Object.entries(NIVELES_CHAT).map(([k, [n, q]]) => [k, n, q]),
    });
  }

  /** 🗑️ Los logos de las crews que se borraron (bot/crews.js `crewBasura()`), fuera de R2. Nunca frena nada. */
  async vaciarBasuraCrews() {
    try {
      const urls = CW.crewBasura(this);
      if (!urls.length) return;
      await this.borrarLogosCrew(urls);
      CW.crewBasuraLista(this, urls);
    } catch (e) { /* la próxima */ }
  }

  /** Borra de R2 logos de crews que ya no se usan. Sólo los de su carpeta: nunca una carta ni un fondo. */
  async borrarLogosCrew(urls) {
    for (const u of urls || []) {
      const k = String(u || '').split('.r2.dev/')[1];
      if (k && k.startsWith(CW.LOGO_CARPETA)) { try { await this.env.CARTAS.delete(k); } catch (e) { /* queda huérfano */ } }
    }
  }

  // ── 🔔 la bandeja: el panel de la campana ────────────────────────────
  /** Anota un aviso en la bandeja de esa persona. El mismo `clave` se pisa y vuelve a «nueva». */
  aBandeja(quien, clave, tipo, titulo, cuerpo, url, cara, t) {
    if (!/^[0-9]{5,25}$/.test(String(quien || '')) || !clave || !titulo) return;
    this.sql.exec('INSERT INTO bandeja (quien, clave, t, tipo, titulo, cuerpo, url, cara, visto) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0) ' +
      'ON CONFLICT(quien, clave) DO UPDATE SET t = excluded.t, titulo = excluded.titulo, cuerpo = excluded.cuerpo, ' +
      'url = excluded.url, cara = excluded.cara, visto = 0',
    String(quien), String(clave).slice(0, 80), Number(t) || Date.now(), String(tipo || '').slice(0, 20),
    String(titulo).slice(0, 120), String(cuerpo || '').slice(0, 240), String(url || '').slice(0, 200),
    claveValida(cara) ? cara : '');
  }

  /**
   * La bandeja de quien pide (`/avisos/bandeja`): lo de los últimos 30 días, lo más nuevo arriba, y cuántas sin ver.
   * Con `visto`, después de leerla queda vista (se abrió el panel): la respuesta todavía dice cuáles eran nuevas.
   */
  bandeja(d) {
    const quien = String(d.quien || '');
    if (!/^[0-9]{5,25}$/.test(quien)) return json({ error: 'faltan datos' }, 400);
    const items = this.sql.exec('SELECT clave, t, tipo, titulo, cuerpo, url, cara, visto FROM bandeja WHERE quien = ? ' +
      'ORDER BY t DESC LIMIT 40', quien).toArray();
    const nuevas = items.filter((x) => !x.visto).length;
    if (d.visto === true && nuevas) this.sql.exec('UPDATE bandeja SET visto = 1 WHERE quien = ? AND visto = 0', quien);
    return json({ ok: true, items, nuevas: d.visto === true ? 0 : nuevas, eran: nuevas });
  }

  /** Para `estado()`, con try como `estadoSeguidos()`. */
  estadoAplausos() {
    try {
      const r = this.sql.exec('SELECT COUNT(*) AS n, COUNT(DISTINCT quien) AS p, COUNT(DISTINCT id) AS a FROM aplausos')
        .toArray()[0];
      const b = this.sql.exec('SELECT COUNT(*) AS n, COUNT(DISTINCT quien) AS p FROM bandeja').toArray()[0];
      return { filas: r.n, felicitan: r.p, publicaciones: r.a, ultima: this.leer('aplausos'),
        bandeja: { filas: b.n, personas: b.p } };
    } catch (e) {
      return { error: String(e).slice(0, 80) };
    }
  }

  // ── las encuestas ────────────────────────────────────────────────────
  /** Un voto, nuevo o cambiado. Sólo lo llama `rutaAvisos`, ya validado y con el ID de Discord. */
  votar(d) {
    if (typeof d.enc !== 'string' || typeof d.op !== 'string' || !/^[0-9]{5,25}$/.test(String(d.quien || ''))) {
      return json({ error: 'faltan datos' }, 400);
    }
    const ahora = Date.now();
    this.sql.exec('INSERT INTO votos (enc, quien, op, t) VALUES (?, ?, ?, ?) ' +
      'ON CONFLICT(enc, quien) DO UPDATE SET op = excluded.op, t = excluded.t',
    d.enc.slice(0, 40), String(d.quien), d.op.slice(0, 80), ahora);
    this.xpVio(String(d.quien), 'voto', d.enc.slice(0, 40), ahora);
    // lo viejo se va: el ciclo lee el resultado cuando la encuesta cierra
    this.sql.exec('DELETE FROM votos WHERE t < ?', ahora - VOTOS_DIAS * DIA_MS);
    const cuenta = {};
    for (const r of this.sql.exec('SELECT op, COUNT(*) AS n FROM votos WHERE enc = ? GROUP BY op', d.enc)
      .toArray()) cuenta[r.op] = r.n;
    // `t`: la página compara contra la de `/avisos/encuestas`, que puede venir de la caché
    return json({ ok: true, enc: d.enc, op: d.op, cuenta, t: ahora });
  }

  /**
   * 🗳️ Un voto de «¿quién gana la liga?», nuevo o cambiado. Sólo lo llama `rutaAvisos`, ya validado
   * (`validarVotoLiga()`) y con el ID de Discord. Corre el cierre de cada liga abierta (`cierran`, de KV) y borra los
   * votos de las que cerraron hace más de `LIGA_VOTOS_DIAS`. Devuelve cómo va esa liga, para quien votó.
   */
  ligaVotar(d, ahora = Date.now()) {
    const quien = String(d.quien || '');
    const liga = String(d.liga || '');
    if (!/^[0-9]{5,25}$/.test(quien) || !/^[a-z0-9-]{2,40}$/.test(liga) || typeof d.op !== 'string' || !d.op ||
        !Number.isFinite(Number(d.cierra))) {
      return { error: 'datos' };
    }
    const antes = this.sql.exec('SELECT op FROM liga_voto WHERE liga = ? AND quien = ?', liga, quien).toArray()[0];
    this.sql.exec('INSERT INTO liga_voto (liga, quien, op, t, cierra) VALUES (?, ?, ?, ?, ?) ' +
      'ON CONFLICT(liga, quien) DO UPDATE SET op = excluded.op, t = excluded.t, cierra = excluded.cierra',
    liga, quien, d.op.slice(0, 80), ahora, Number(d.cierra));
    // una liga que sigue corre su cierre: sus votos viejos no se borran mientras se juega
    for (const [l, h] of Object.entries(d.cierran || {})) {
      if (/^[a-z0-9-]{2,40}$/.test(l) && Number.isFinite(Number(h))) {
        this.sql.exec('UPDATE liga_voto SET cierra = ? WHERE liga = ? AND cierra < ?', Number(h), l, Number(h));
      }
    }
    this.sql.exec('DELETE FROM liga_voto WHERE cierra < ?', ahora - LIGA_VOTOS_DIAS * DIA_MS);
    this.xpVio(quien, 'voto', 'liga:' + liga, ahora);
    const cuenta = {};
    for (const r of this.sql.exec('SELECT op, COUNT(*) AS n FROM liga_voto WHERE liga = ? GROUP BY op', liga).toArray()) {
      cuenta[r.op] = r.n;
    }
    // `t`: la página compara contra la de `/avisos/ligas-votos`, que puede venir de la caché del borde
    return { ok: true, liga, op: d.op, cambio: !!(antes && antes.op !== d.op), cuenta, t: ahora };
  }

  /** Para `/avisos/ligas-votos`: cuántos votos lleva cada uno en cada liga. ⚠️ Nunca quién. */
  ligasVotos() {
    const votos = {};
    for (const r of this.sql.exec('SELECT liga, op, COUNT(*) AS n FROM liga_voto GROUP BY liga, op').toArray()) {
      (votos[r.liga] = votos[r.liga] || {})[r.op] = r.n;
    }
    return { t: Date.now(), votos };
  }

  /** Para `/avisos/encuestas`: cuántos votos lleva cada opción. ⚠️ Nunca quién. */
  encuestas() {
    const votos = {};
    for (const r of this.sql.exec('SELECT enc, op, COUNT(*) AS n FROM votos GROUP BY enc, op').toArray()) {
      (votos[r.enc] = votos[r.enc] || {})[r.op] = r.n;
    }
    return { t: Date.now(), votos };
  }

  // ── las sesiones ─────────────────────────────────────────────────────
  /** `/sesion/nueva`, `/sesion/quien` y `/sesion/fin`. Sólo por dentro: no están en `RUTAS`. */
  async sesion(ruta, d) {
    const ahora = Date.now();
    const hash = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', utf8(s)))]
      .map((b) => b.toString(16).padStart(2, '0')).join('');
    if (ruta === '/sesion/nueva') {
      if (!/^[0-9]{5,25}$/.test(String(d.quien || ''))) return json({ error: 'faltan datos' }, 400);
      const ses = b64u.enc(crypto.getRandomValues(new Uint8Array(32)));
      const vence = ahora + SESION_DIAS * DIA_MS;
      this.sql.exec('DELETE FROM sesiones WHERE vence < ?', ahora);
      this.sql.exec('INSERT INTO sesiones (h, quien, t, vence) VALUES (?, ?, ?, ?)', await hash(ses),
        String(d.quien), ahora, vence);
      // 🛡️ COMO MUCHO DIEZ POR PERSONA (04/10/2026, la lista de seguridad): `/cuenta` en un bucle con un permiso bueno
      // llenaba la tabla. Diez son diez dispositivos; entrar en el undécimo cierra la más vieja
      this.sql.exec('DELETE FROM sesiones WHERE quien = ? AND h NOT IN ' +
        '(SELECT h FROM sesiones WHERE quien = ? ORDER BY t DESC LIMIT 10)', String(d.quien), String(d.quien));
      return json({ ses, vence });
    }
    if (!/^[A-Za-z0-9_-]{30,100}$/.test(String(d.ses || ''))) return json({ error: 'faltan datos' }, 400);
    const h = await hash(String(d.ses));
    if (ruta === '/sesion/quien') {
      const f = this.sql.exec('SELECT quien FROM sesiones WHERE h = ? AND vence > ?', h, ahora).toArray()[0];
      return f ? json({ quien: f.quien }) : json({ error: 'no' }, 404);
    }
    if (ruta === '/sesion/fin') {
      this.sql.exec('DELETE FROM sesiones WHERE h = ?', h);
      return json({ ok: true });
    }
    return json({ error: 'no existe' }, 404);
  }

  // ── el precio por cabeza ─────────────────────────────────────────────
  /**
   * Los Puntos de Tienda de alguien: lo de arranque + lo cobrado − lo puesto.
   * Lo devuelto (nadie lo cazó) no cuenta como puesto. `desde` es el
   * arranque de la temporada: lo de antes (la prueba) no cuenta.
   */
  saldo(quien, desde, inicial) {
    const puesto = this.sql.exec("SELECT COALESCE(SUM(monto), 0) AS n FROM precios WHERE quien = ? AND t >= ? " +
      "AND estado != 'devuelto'", quien, desde).toArray()[0].n;
    const cobrado = this.sql.exec('SELECT COALESCE(SUM(monto), 0) AS n FROM tienda WHERE quien = ? AND t >= ?',
      quien, desde).toArray()[0].n;
    return inicial + cobrado - puesto;
  }

  /** Lo activo sobre una cabeza: lo que todavía se puede cobrar. */
  encima(cabeza, ahora) {
    return this.sql.exec("SELECT COALESCE(SUM(monto), 0) AS n FROM precios WHERE cabeza = ? AND estado = '' " +
      'AND fin > ?', cabeza, ahora).toArray()[0].n;
  }

  /** Un precio. Sólo lo llama `rutaAvisos`, ya validado y con el ID de Discord. */
  precio(d) {
    const m = Number(d.monto), ini = Number(d.inicial), tope = Number(d.tope);
    if (!/^[0-9]{5,25}$/.test(String(d.quien || '')) || typeof d.cabeza !== 'string' || !Number.isInteger(m) ||
        m <= 0 || !Number.isInteger(ini) || !Number.isInteger(tope) || !(Number(d.fin) > 0)) {
      return json({ error: 'faltan datos' }, 400);
    }
    const ahora = Date.now();
    // ⚠️ EL SALDO Y EL TOPE SE MIRAN ACÁ Y NO EN EL WORKER: el objeto es uno
    // solo, así que dos precios a la vez no pueden gastar la misma plata
    const s = this.saldo(String(d.quien), Number(d.desde) || 0, ini);
    if (m > s) return json({ error: 'saldo', saldo: s }, 409);
    const ya = this.encima(d.cabeza, ahora);
    if (ya + m > tope) return json({ error: 'tope', queda: Math.max(0, tope - ya), total: ya }, 409);
    this.sql.exec('INSERT INTO precios (quien, cabeza, monto, t, fin) VALUES (?, ?, ?, ?, ?)',
      String(d.quien), d.cabeza.slice(0, 80), m, ahora, Number(d.fin));
    // 🎟️ y la Tarea del Pase de poner un precio; ⭐ y el nivel, una vez por cabeza
    this.paseRevisar(String(d.quien));
    this.xpVio(String(d.quien), 'precio', d.cabeza.slice(0, 80), ahora);
    return json({ ok: true, cabeza: d.cabeza, monto: m, saldo: s - m, total: ya + m, t: ahora });
  }

  /** Lo de una persona: su saldo, lo que cobró y sus precios de los últimos 30 días. */
  billetera(d) {
    if (!/^[0-9]{5,25}$/.test(String(d.quien || '')) || !Number.isInteger(Number(d.inicial))) {
      return json({ error: 'faltan datos' }, 400);
    }
    const quien = String(d.quien), desde = Number(d.desde) || 0;
    const cobrado = this.sql.exec('SELECT COALESCE(SUM(monto), 0) AS n FROM tienda WHERE quien = ? AND t >= ?',
      quien, desde).toArray()[0].n;
    const mios = this.sql.exec('SELECT id, cabeza, monto, t, fin, estado FROM precios WHERE quien = ? AND t >= ? ' +
      'ORDER BY t DESC LIMIT 30', quien, Math.max(desde, Date.now() - VOTOS_DIAS * DIA_MS)).toArray();
    return json({ ok: true, saldo: this.saldo(quien, desde, Number(d.inicial)), inicial: Number(d.inicial),
      cobrado, mios });
  }

  /** Para `/avisos/precios`: los de los últimos 30 días. ⚠️ Nunca quién los puso. */
  precios() {
    const ahora = Date.now();
    return { t: ahora, precios: this.sql.exec('SELECT id, cabeza, monto, t, fin, estado FROM precios ' +
      'WHERE t > ? ORDER BY id', ahora - VOTOS_DIAS * DIA_MS).toArray() };
  }

  /**
   * Lo que el ciclo resolvió (`bot/precios.py`, por KV): cazado —y a quién le
   * toca cuánto— o devuelto. Se aplica sólo si cambió (`v`).
   *
   * ⚠️ SE REEMPLAZA, NO SE SUMA: si una llave se corrige y el cazador es
   * otro, lo cobrado de ese precio se borra y se vuelve a anotar. Así lo
   * anotado es siempre lo último que dijo el ciclo, y nadie cobra dos veces.
   */
  /**
   * 🧰 EL PERMISO PARA EDITAR LA RESPUESTA DE /afiche O /llave (`bot/kit.py`). Lo manda el Worker y se queda acá: la
   * tarea que dibuja sólo conoce el id. Vence a los 20 minutos (el de Discord, a los 15), y uno por servidor cada 90 s,
   * para que nadie llene GitHub Actions de tareas.
   */
  kitGuardar(d) {
    const kits = this.leer('kits') || {};
    const ahora = Date.now();
    for (const [k, v] of Object.entries(kits)) if (ahora - (v.t || 0) > 20 * 60000) delete kits[k];
    if (!/^[a-f0-9]{16,40}$/.test(String(d.id || '')) || !/^[\w.-]{20,500}$/.test(String(d.token || '')) ||
      !/^\d{5,25}$/.test(String(d.app || ''))) return { error: 'datos' };
    const sv = String(d.sv || '').toUpperCase().slice(0, 6);
    if (Object.values(kits).some((v) => v.sv === sv && ahora - v.t < 90000)) return { error: 'espera' };
    kits[String(d.id)] = { token: String(d.token), app: String(d.app), sv, tipo: d.tipo === 'llave' ? 'llave' : 'afiche', t: ahora };
    this.guardar('kits', kits);
    return { ok: true };
  }

  /** 🧰 La imagen ya dibujada: edita la respuesta del organizador y se olvida del permiso. */
  async kitListo(d) {
    const kits = this.leer('kits') || {};
    const id = String(d.id || '');
    const k = kits[id];
    if (!k) return { error: 'no existe' };
    delete kits[id];
    this.guardar('kits', kits);
    // sólo una imagen nuestra, del bucket de las cartas
    const url = /^https:\/\/pub-[a-z0-9]+\.r2\.dev\/kit\/[\w.-]+\.png$/.test(String(d.url || '')) ? String(d.url) : null;
    const texto = String((url ? d.texto : d.error) || '').slice(0, 400) || (url ? '🧰' : 'No pude armarla esta vez.');
    const api = `https://discord.com/api/v10/webhooks/${k.app}/${k.token}/messages/@original`;
    // 🖼️ como adjunto, que se ve más grande (ver `editarConAdjunto()`); si no se pudo, en el embed de antes
    let r = url ? await editarConAdjunto(api, url, k.tipo === 'llave' ? 'llave.png' : 'afiche.png', { content: texto }) : null;
    if (!r || !r.ok) {
      r = await fetch(api, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: texto, embeds: url ? [{ image: { url }, color: 0xE41373 }] : [], allowed_mentions: { parse: [] } }),
      });
    }
    return { ok: r.ok, estado: r.status };
  }

  /**
   * 🏷️ Lo de un prefijo de la Tienda (`mw:`, `div:`…) igual a `mapa` `{id: [quien, monto, t]}`, tocando sólo lo que cambió
   * (pasada del 19/10/2026). Antes se borraba todo con un `LIKE` —que no usa el índice de la clave: recorre la tabla
   * entera— y se volvía a escribir todo en cada corrida aunque no hubiera cambiado nada: cada fila, dos escrituras. El
   * rango `[prefijo, prefijo siguiente)` sí usa el índice, y se escribe la diferencia. Devuelve cuántas filas cambió.
   */
  tiendaIgualar(prefijo, mapa, ahora) {
    const hasta = prefijo.slice(0, -1) + String.fromCharCode(prefijo.charCodeAt(prefijo.length - 1) + 1);
    const hay = new Map(this.sql.exec('SELECT id, quien, monto, t FROM tienda WHERE id >= ? AND id < ?', prefijo, hasta)
      .toArray().map((f) => [f.id, f]));
    const quiero = new Map();
    for (const [id, x] of Object.entries(mapa || {})) {
      if (!Array.isArray(x) || !/^[0-9]{5,25}$/.test(String(x[0])) || !Number.isInteger(x[1]) || x[1] <= 0) continue;
      const k = prefijo + String(id).slice(0, 160);
      const f = hay.get(k);
      // sin fecha, la de la fila que ya estaba (si no, «ahora» la reescribía en cada corrida)
      quiero.set(k, [String(x[0]), x[1], Number(x[2]) || (f ? f.t : ahora)]);
    }
    let n = 0;
    for (const id of hay.keys()) {
      if (!quiero.has(id)) { this.sql.exec('DELETE FROM tienda WHERE id = ?', id); n++; }
    }
    for (const [id, [quien, monto, t]] of quiero) {
      const f = hay.get(id);
      if (f && String(f.quien) === quien && f.monto === monto && f.t === t) continue;
      this.sql.exec('INSERT OR REPLACE INTO tienda (id, ref, quien, monto, t) VALUES (?, 0, ?, ?, ?)', id, quien, monto, t);
      n++;
    }
    return n;
  }

  async resolverPrecios(ahora) {
    const crudo = await this.env.KV.get('precios:resolucion');
    if (!crudo) return 0;
    let r = null;
    try { r = JSON.parse(crudo); } catch (e) { return 0; }
    if (!r || !r.r || r.v === this.leer('precios_v')) return 0;
    let cambios = 0;
    for (const [id, x] of Object.entries(r.r)) {
      const n = Number(id);
      const fila = this.sql.exec('SELECT estado, por FROM precios WHERE id = ?', n).toArray()[0];
      if (!fila || (x.e !== 'cazado' && x.e !== 'devuelto')) continue;
      const por = (Array.isArray(x.por) ? x.por : []).filter((p) => Array.isArray(p) &&
        /^[0-9]{5,25}$/.test(String(p[0])) && Number.isInteger(p[1]) && p[1] > 0);
      const txt = JSON.stringify(por);
      if (fila.estado === x.e && fila.por === txt) continue;
      this.sql.exec('UPDATE precios SET estado = ?, por = ? WHERE id = ?', x.e, txt, n);
      this.sql.exec('DELETE FROM tienda WHERE ref = ?', n);
      for (const [quien, monto] of por) {
        this.sql.exec('INSERT OR REPLACE INTO tienda (id, ref, quien, monto, t) VALUES (?, ?, ?, ?, ?)',
          'caza:' + n + ':' + quien, n, String(quien), monto, Number(x.t) || ahora);
      }
      cambios++;
    }
    // 🔑 EL MOST WANTED TAMBIÉN PAGA TIENDA (Dlx, 28/09/2026: «b»): el ciclo
    // manda todo lo de la temporada y se REEMPLAZA entero, así una llave
    // corregida no hace cobrar dos veces. `ref` 0: no es un precio.
    if (r.mw && typeof r.mw === 'object') {
      cambios += this.tiendaIgualar('mw:', r.mw, ahora);
    }
    // 🏟️ LAS SUBIDAS DE DIVISIÓN TAMBIÉN PAGAN TIENDA (`bot/divisiones.py`): enteras en cada corrida y se REEMPLAZAN,
    // como el MW, así una llave corregida no hace cobrar dos veces. `ref` 0: no es un precio
    if (r.div && typeof r.div === 'object') {
      cambios += this.tiendaIgualar('div:', r.div, ahora);
    }
    // 🎤 EL RETO DEL DEBUT TAMBIÉN PAGA TIENDA (`bot/debutantes.py`, Dlx 12/10/2026): entero y se REEMPLAZA, como las
    // divisiones
    if (r.deb && typeof r.deb === 'object') {
      cambios += this.tiendaIgualar('deb:', r.deb, ahora);
    }
    // ✍️ EL WRITING CHALLENGE DE FFA TAMBIÉN PAGA TIENDA (`bot/writing.py`, Dlx 14/10/2026): una clave por fecha y
    // persona (`<temporada>:f<N>:<discord>`), entero y se REEMPLAZA, como el debut: releer el canal no paga dos veces
    if (r.wr && typeof r.wr === 'object') {
      cambios += this.tiendaIgualar('wr:', r.wr, ahora);
    }
    // 🏆 LOS MES AWARDS TAMBIÉN PAGAN TIENDA (`bot/mes_awards.py`, Dlx 16/10/2026): una clave por mes, categoría y persona,
    // entero y se REEMPLAZA, como el Writing
    if (r.mes && typeof r.mes === 'object') {
      cambios += this.tiendaIgualar('mes:', r.mes, ahora);
    }
    // 🔥 LA RACHA: los números y quién jugó qué días (`bot/racha.py`). Lo de la temporada en curso llega ENTERO y se
    // reemplaza (sólo esa temporada); los días se suman, y uno que ya contó no se borra
    if (r.rcfg && typeof r.rcfg === 'object') this.guardar('racha_cfg', r.rcfg);
    if (r.jugo && typeof r.jugo === 'object') {
      const temp = String((r.rcfg && r.rcfg.temp) || 'prueba').slice(0, 20);
      this.sql.exec('DELETE FROM jugo_temp WHERE temp = ?', temp);
      for (const [quien, x] of Object.entries(r.jugo)) {
        if (!/^[0-9]{5,25}$/.test(quien) || !Array.isArray(x)) continue;
        const ev = Number.isInteger(x[1]) && x[1] > 0 ? x[1] : 0;
        this.sql.exec('INSERT OR REPLACE INTO jugo_temp (quien, temp, k, eventos) VALUES (?, ?, ?, ?)', quien, temp,
          String(x[0] || '').slice(0, 60), ev);
        for (const dia of Array.isArray(x[2]) ? x[2].slice(0, 400) : []) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(String(dia))) {
            this.sql.exec('INSERT OR IGNORE INTO activo (quien, dia) VALUES (?, ?)', quien, String(dia));
          }
        }
        this.premiarRacha(quien);
        // 🎟️ jugar también cuenta días para la Tarea del Pase
        this.paseRevisar(quien);
        cambios++;
      }
    }
    this.guardar('precios_v', r.v);
    this.guardar('precios_ultimo', { t: ahora, cambios });
    return cambios;
  }

  /**
   * La cola de avisos personales que dejó el ciclo en KV.
   *
   * ⚠️ CADA UNO SALE UNA VEZ: se anota en `hechos` ANTES de mandarlo, así
   * una cola que no se pudo borrar —o que el ciclo reescribió con lo viejo
   * adentro— no vuelve a sonar.
   *
   * ⚠️ SIN VÍNCULO NO HAY AVISO: la cola lleva el Discord ID y sólo le llega
   * a los dispositivos que esa persona vinculó. El resto se descarta.
   */
  async personales(ahora) {
    if (this.pausada()) return 0;  // 🔔 la campana pausada desde el Dashboard: esperan
    const crudo = await this.env.KV.get(COLA_PERSONAL);
    if (!crudo) return 0;
    const cola = colaPersonal(crudo, ahora);
    let enviados = 0, sinVinculo = 0, pedidos = 0, quedan = 0;
    // 🔔 lo que ya había salido antes de que existiera la bandeja entra UNA vez, ya visto: así el panel no nace vacío
    const rellenar = !this.leer('bandeja_relleno');
    for (const a of cola) {
      const id = 'yo:' + a.id;
      if (this.sql.exec('SELECT id FROM hechos WHERE id = ?', id).toArray()[0]) {
        if (rellenar && /^[0-9]{5,25}$/.test(String(a.quien))) {
          this.sql.exec('INSERT OR IGNORE INTO bandeja (quien, clave, t, tipo, titulo, cuerpo, url, visto) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
            String(a.quien), id, Date.parse(a.t || '') || ahora, 'personal', String(a.titulo).slice(0, 120),
            String(a.cuerpo || '').slice(0, 240), String(a.url || '').slice(0, 200));
        }
        continue;
      }
      const subs = this.sql.exec('SELECT id, endpoint, p256dh, auth FROM subs WHERE quien = ?',
        String(a.quien)).toArray();
      // 🔴 CON TOPE POR MINUTO: el vigía comparte con la lectura de los canales
      // el tope de pedidos de una invocación, y pasado ese tope `empujar()`
      // devuelve 0 sin mandar nada. Lo que no entra, sale al minuto siguiente.
      if (pedidos + subs.length > TOPE_PERSONALES && pedidos) { quedan++; continue; }
      // ⚠️ SE ANOTA ANTES DE MANDAR —así dos minutos que se pisan no lo mandan
      // dos veces— y se desanota si falló por el otro lado (0, 429, 5xx).
      this.sql.exec('INSERT OR IGNORE INTO hechos (id, t) VALUES (?, ?)', id, ahora);
      // 🔔 y a su bandeja, tenga o no la campana (ver `aBandeja()`)
      this.aBandeja(a.quien, id, 'personal', a.titulo, a.cuerpo, a.url, '', Date.parse(a.t || '') || ahora);
      if (!subs.length) { sinVinculo++; continue; }
      pedidos += subs.length;
      const cuerpo = cuerpoPersonal(a);
      const estados = await Promise.all(subs.map((s) => empujar(s, cuerpo,
        { ttl: 24 * 3600, topic: 'yo' + String(a.id).replace(/[^A-Za-z0-9]/g, '').slice(-20) },
        this.env, new Map())));
      let llego = 0, reintentar = false;
      estados.forEach((e, i) => {
        if (e >= 200 && e < 300) { enviados++; llego++; }
        else if (MUERTA(e)) this.sql.exec('DELETE FROM subs WHERE id = ?', subs[i].id);
        // sin red, frenado o caído del otro lado: vuelve a salir al minuto.
        // Un 400 o un 403 no: repetirlo daría lo mismo durante una semana.
        else if (e === 0 || e === 429 || e >= 500) reintentar = true;
      });
      if (reintentar && !llego) this.sql.exec('DELETE FROM hechos WHERE id = ?', id);
    }
    this.sql.exec('DELETE FROM hechos WHERE t < ?', ahora - 30 * 24 * HORA);
    if (rellenar) this.guardar('bandeja_relleno', { t: ahora });
    // 🔴 LA COLA YA NO SE BORRA: si el ciclo la reescribía entre la lectura y el
    // borrado, lo nuevo se perdía (revisión del 25/09/2026). `hechos` evita
    // repetir, y lo de más de una semana no sale (`colaPersonal()`).
    this.guardar('personales', { t: ahora, cola: cola.length, enviados, sin_vinculo: sinVinculo,
      quedan });
    return enviados;
  }

  /**
   * 🔥 «Tu racha se corta hoy» (ver `rachaEnPeligro()`): una vez por día, desde las `RACHA_AVISO_HORA` del este, y
   * SÓLO AL TELÉFONO de quien vinculó la campana. No va a la campanita de la página: si la abrís, ya entraste y la racha
   * está salvada. Con el mismo tope por minuto que los demás: lo que no entra sale al minuto siguiente, y `hechos` evita
   * repetir.
   */
  async recordarRacha(ahora) {
    if (this.pausada()) return 0;
    const hoy = diaET(ahora);
    if (horaET(ahora) < RACHA_AVISO_HORA || this.leer('racha_aviso_dia') === hoy) return 0;
    const c = this.rachaCfg();
    const desde = c.desde ? diaET(c.desde) : '';
    const hace3 = new Date((diaNum(hoy) - 3) * DIA_MS).toISOString().slice(0, 10);
    // los que tienen la campana vinculada y entraron hace poco, pero hoy no
    const cands = this.sql.exec('SELECT DISTINCT a.quien FROM activo a JOIN subs s ON s.quien = a.quien ' +
      'WHERE a.dia >= ? AND a.quien NOT IN (SELECT quien FROM activo WHERE dia = ?)', hace3, hoy).toArray().map((x) => x.quien);
    let enviados = 0, pedidos = 0, quedan = 0, avisados = 0;
    for (const quien of cands) {
      const dias = this.sql.exec('SELECT dia FROM activo WHERE quien = ? AND dia >= ? ORDER BY dia', quien, desde)
        .toArray().map((x) => x.dia);
      const r = rachaEnPeligro(dias, hoy);
      if (!r) continue;
      const id = 'racha-aviso:' + quien + ':' + hoy;
      if (this.sql.exec('SELECT id FROM hechos WHERE id = ?', id).toArray()[0]) continue;
      const subs = this.sql.exec('SELECT id, endpoint, p256dh, auth FROM subs WHERE quien = ?', quien).toArray();
      if (!subs.length) continue;
      if (pedidos + subs.length > TOPE_PERSONALES && pedidos) { quedan++; continue; }
      this.sql.exec('INSERT OR IGNORE INTO hechos (id, t) VALUES (?, ?)', id, ahora);
      pedidos += subs.length;
      avisados++;
      const cuerpo = cuerpoPersonal({ id: 'racha' + hoy.replace(/-/g, ''),
        titulo: '🔥 Tu racha de ' + r.actual + ' días se corta hoy', cuerpo: 'Entra a la página antes de la medianoche y la mantienes.',
        url: HUB + '/freestyle-rap' });
      const estados = await Promise.all(subs.map((x) => empujar(x, cuerpo, { ttl: 4 * 3600, topic: 'racha' }, this.env, new Map())));
      let llego = 0, reintentar = false;
      estados.forEach((e, i) => {
        if (e >= 200 && e < 300) { enviados++; llego++; }
        else if (MUERTA(e)) this.sql.exec('DELETE FROM subs WHERE id = ?', subs[i].id);
        else if (e === 0 || e === 429 || e >= 500) reintentar = true;
      });
      if (reintentar && !llego) this.sql.exec('DELETE FROM hechos WHERE id = ?', id);
    }
    // el día queda hecho cuando no quedó nadie esperando el tope
    if (!quedan) this.guardar('racha_aviso_dia', hoy);
    this.guardar('racha_aviso', { t: ahora, candidatos: cands.length, avisados, enviados, quedan });
    return enviados;
  }

  /** Para `estado()`. ⚠️ Con try: si esto fallara, `/avisos/estado` daría 500
   * y `bot/alertar.py` leería al vigía como caído. */
  estadoPersonales() {
    try {
      return {
        vinculados: this.sql.exec("SELECT COUNT(*) AS n FROM subs WHERE quien != ''").toArray()[0].n,
        ultima: this.leer('personales'),
      };
    } catch (e) {
      return { error: String(e).slice(0, 80) };
    }
  }

  svsDe(endpoint) {
    const r = this.sql.exec('SELECT svs FROM subs WHERE endpoint = ?', endpoint).toArray()[0];
    return r ? r.svs.split('|').filter(Boolean) : [];
  }

  baja(d) {
    if (typeof d.endpoint !== 'string') return json({ error: 'falta el endpoint' }, 400);
    this.sql.exec('DELETE FROM subs WHERE endpoint = ?', d.endpoint);
    return json({ ok: true });
  }

  async probar(d) {
    const s = typeof d.endpoint === 'string' && this.sql.exec(
      'SELECT id, endpoint, p256dh, auth, prueba FROM subs WHERE endpoint = ?', d.endpoint)
      .toArray()[0];
    if (!s) return json({ error: 'esa suscripción no está anotada' }, 404);
    const ahora = Date.now();
    // 🛡️ `prueba` SE ANOTA SÓLO SI LLEGÓ (04/10/2026, la lista de seguridad). Era la marca de «éste es de verdad» que
    // salva a un dispositivo de la poda de los que nunca recibieron nada (`fallos >= 5`), y se ponía antes de mandar:
    // uno inventado tocaba «Probar» y quedaba para siempre. Los 30 segundos entre pruebas, ahora en la memoria del objeto
    this.probados = this.probados || new Map();
    if (ahora - Math.max(s.prueba || 0, this.probados.get(s.id) || 0) < 30 * 1000) {
      return json({ error: 'espera unos segundos' }, 429);
    }
    if (this.probados.size > 2000) this.probados.clear();
    this.probados.set(s.id, ahora);
    const estado = await empujar(s, JSON.stringify({ v: 1, tipo: 'prueba', t: 'Avisos activados' }),
      { ttl: 300, urgencia: 'high' }, this.env, new Map());
    if (estado >= 200 && estado < 300) this.sql.exec('UPDATE subs SET prueba = ? WHERE id = ?', ahora, s.id);
    else if (MUERTA(estado)) this.sql.exec('DELETE FROM subs WHERE id = ?', s.id);
    else this.sql.exec('UPDATE subs SET fallos = fallos + 1 WHERE id = ?', s.id);
    return json({ ok: estado >= 200 && estado < 300, estado });
  }

  /**
   * Un anuncio de mentira del servidor de prueba, por el camino de verdad:
   * la cola, la alarma, el lote, el filtro, el TTL. `probar()` manda
   * directo y no pasa por nada de eso.
   *
   * ⚠️ UNO CADA CINCO MINUTOS COMO MUCHO, por el id. Cualquiera puede
   * llamarlo, pero sólo le llega a quien eligió `ZZZ` a mano, y no más
   * seguido que esto.
   */
  async simular() {
    const ahora = Date.now();
    const id = 'sim:' + Math.floor(ahora / CADA_SIMULACRO);
    const cuerpo = {
      v: 1, tipo: 'evento', id, t: 'PRUEBA DEL VIGIA', sv: SV_PRUEBA, svn: 'Prueba',
      ini: ahora + 15 * MIN, mod: '1vs1', cup: '16', pre: '', url: HUB + '/freestyle-rap/avisos',
    };
    const antes = this.sql.exec('SELECT 1 FROM avisos WHERE id = ?', id).toArray().length;
    if (antes) return json({ error: 'ya hubo uno en estos cinco minutos' }, 429);
    this.sql.exec('INSERT INTO avisos (id, sv, cuerpo, desde, hasta, creado) ' +
      'VALUES (?, ?, ?, ?, ?, ?)', id, SV_PRUEBA, JSON.stringify(cuerpo), ahora,
    ahora + 15 * MIN, ahora);
    await this.despertar(ahora);
    return json({ ok: true, id });
  }

  // ── lo que se puede preguntar desde afuera ───────────────────────────
  //
  // ⚠️ SIN UN SOLO ENDPOINT. Cuántos, cuándo y qué; nunca a quién.
  // ── 📊 el uso ────────────────────────────────────────────────────────
  usoAnotar(d) {
    if (!/^[0-9]{5,25}$/.test(String(d.quien || '')) || (d.por !== 'bot' && d.por !== 'web')) {
      return json({ error: 'faltan datos' }, 400);
    }
    // el día lo pone el objeto: uno que llega de otra zona o de otro reloj no inventa días
    this.sql.exec('INSERT OR IGNORE INTO uso (dia, quien, por) VALUES (?, ?, ?)', diaET(), String(d.quien), d.por);
    // 🔥 y el día cuenta para su racha
    this.diaActivo(String(d.quien), diaET());
    return json({ ok: true });
  }

  /** 🔥 Un día que contó para alguien. Si es nuevo, mira si su racha llegó a un premio */
  diaActivo(quien, dia) {
    if (this.sql.exec('INSERT OR IGNORE INTO activo (quien, dia) VALUES (?, ?)', quien, dia).rowsWritten) {
      this.premiarRacha(quien);
      // 🎟️ y las Tareas del Pase de entrar
      this.paseRevisar(quien);
    }
  }

  /** 🔥 Los números de la racha y los niveles: los de `bot/racha.py` si ya llegaron, y si no los de arranque */
  rachaCfg() {
    return Object.assign({}, RACHA_CFG, this.leer('racha_cfg') || {});
  }

  /**
   * 🔥 La racha y el nivel de alguien. Cuentan los días desde el arranque de la temporada (`desde`): lo de la
   * prueba no. `falta` es cuántos días más para el próximo premio.
   */
  /**
   * 🎁 EL PREMIO DE LA SEMANA (13/10/2026, Dlx a las ideas del research: «me gustan todas», y «lo de azar lo vamos a
   * incluir eventualmente»: por ahora SIN AZAR, se sabe cuánto antes de tocar). `montoSemanal()`: 50 Puntos de Tienda de
   * base y 50 por cada día que entraste la semana pasada —de lunes a domingo, en el este (`activo`)—, hasta 400. Se
   * cobra una vez por semana, cualquier día de lunes a domingo: la fila es `semana:<lunes>:<quien>`, así que tocar dos
   * veces no paga dos. Con `cobrar` falso sólo dice cuánto y si ya se cobró.
   */
  semanal(quien, cobrar, ahora = Date.now()) {
    const lun = lunesDe(diaET(ahora));
    const dias = this.sql.exec('SELECT COUNT(DISTINCT dia) AS n FROM activo WHERE quien = ? AND dia >= ? AND dia < ?',
      quien, masDias(lun, -7), lun).toArray()[0].n || 0;
    const monto = montoSemanal(dias);
    const id = 'semana:' + lun + ':' + quien;
    let ya = !!this.sql.exec('SELECT 1 AS x FROM tienda WHERE id = ?', id).toArray()[0];
    // 🔥 YA NO SE COBRA (13/10/2026, Dlx: «La racha lo reemplaza»): lo paga la racha, día por día (`RACHA_DIA`)
    if (cobrar && !ya && false) {
      this.sql.exec('INSERT OR IGNORE INTO tienda (id, ref, quien, monto, t) VALUES (?, 0, ?, ?, ?)', id, quien, monto, ahora);
      ya = true;
    }
    return { ok: true, monto, dias, cobrado: ya, semana: lun, proximo: masDias(lun, 7) };
  }

  rachaDe(quien) {
    const c = this.rachaCfg();
    const desde = c.desde ? diaET(c.desde) : '';
    const dias = this.sql.exec('SELECT dia FROM activo WHERE quien = ? AND dia >= ? ORDER BY dia', quien, desde)
      .toArray().map((x) => x.dia);
    const r = rachaDeDias(dias, diaET());
    // los eventos de todas las temporadas; los de la prueba, sólo mientras dura la prueba (`desde` en 0)
    const j = this.sql.exec("SELECT COALESCE(SUM(eventos), 0) AS n FROM jugo_temp WHERE quien = ? AND (temp != 'prueba' OR ? = 0)",
      quien, Number(c.desde) || 0).toArray()[0];
    const eventos = j ? j.n : 0;
    // 🔥 `semana`: los siete días de esta semana (lunes a domingo, en el este), entrados o no, para el Inicio (13/10/2026)
    const hoy = diaET(), lun = lunesDe(hoy), set = new Set(dias);
    const semana = [0, 1, 2, 3, 4, 5, 6].map((i) => { const d = masDias(lun, i); return [d, set.has(d) ? 1 : 0]; });
    // y lo que paga cada día (`RACHA_DIA`): [día, monto, cobrado, se puede cobrar ahora, es cofre]
    const entrados = semana.filter((x) => x[1]).length;
    const premios = semana.map(([d, si], i) => {
      const cofre = i === 6 && entrados >= COFRE_DIAS;
      const monto = i === 6 && !cofre ? RACHA_DIA[5] : RACHA_DIA[i];
      const cobrado = !!this.sql.exec('SELECT 1 AS x FROM tienda WHERE id = ?', 'rdia:' + d + ':' + quien).toArray()[0];
      return [d, monto, cobrado ? 1 : 0, d === hoy && si && !cobrado ? 1 : 0, cofre ? 1 : 0];
    });
    const sigHito = RACHA_HITOS.find(([n]) => n > r.actual) || null;
    // ⭐ y lo demás que suma (14/10/2026): `xp_de` es el desglose, para que la página diga de dónde sale cada punto
    const extra = this.xpDe(quien);
    const xp_de = Object.assign({ ev: [eventos, eventos * c.xp_ev], dia: [r.total, r.total * c.xp_dia] }, extra.de);
    // 📅 `dias`: los últimos 70 días que contaron, para el calendario de la racha en Tu cuenta (20/10/2026)
    return { racha: r, eventos, nivel: nivelDeXp(eventos * c.xp_ev + r.total * c.xp_dia + extra.xp, c.paso),
      cada: c.cada, premio: c.premio, falta: c.cada - (r.actual % c.cada), xp_ev: c.xp_ev, xp_dia: c.xp_dia, hoy, semana,
      premios, cofre_dias: COFRE_DIAS, hito: sigHito, xp_de, xp_fuentes: XP_FUENTES, dias: dias.slice(-70) };
  }

  /** ⭐ Anota algo que sube el nivel (`que` de `XP_FUENTES`), una vez por cosa. Devuelve si era nuevo */
  xpVio(quien, que, ref, t = Date.now()) {
    if (!/^[0-9]{5,25}$/.test(String(quien || '')) || !XP_FUENTES[que]) return false;
    return !!this.sql.exec('INSERT OR IGNORE INTO xp_log (quien, que, ref, t) VALUES (?, ?, ?, ?)', String(quien), que,
      String(ref).slice(0, 80), t).rowsWritten;
  }

  /**
   * ⭐ Lo que alguien sumó fuera de jugar y entrar: `{xp, de}` (`xpDeFuentes()`). Las Tareas del Pase salen de
   * `pase_hecho`, que no se borra; las de «una vez» se miran también en su tabla y quedan anotadas (así sacar el fondo
   * no baja el nivel). La primera vez trae lo hecho antes de que existiera (`xpHeredar()`)
   */
  xpDe(quien) {
    this.xpHeredar();
    const hay = (sql, ...a) => !!this.sql.exec(sql, ...a).toArray()[0];
    if (hay("SELECT 1 AS x FROM subs WHERE quien = ? LIMIT 1", quien)) this.xpVio(quien, 'campana', '1');
    if (hay("SELECT 1 AS x FROM fondos WHERE quien = ? AND estado = 'ok' AND url != '' LIMIT 1", quien)) this.xpVio(quien, 'fondo', '1');
    if (hay("SELECT 1 AS x FROM fotos_carta WHERE quien = ? AND estado = 'ok' LIMIT 1", quien)) this.xpVio(quien, 'foto', '1');
    const cuentas = {};
    for (const x of this.sql.exec('SELECT que, COUNT(*) AS n FROM xp_log WHERE quien = ? GROUP BY que', quien).toArray()) {
      cuentas[x.que] = x.n;
    }
    cuentas.tarea = this.sql.exec('SELECT COUNT(*) AS n FROM pase_hecho WHERE quien = ?', quien).toArray()[0].n || 0;
    return xpDeFuentes(cuentas);
  }

  /** ⭐ Lo hecho antes de `xp_log` (14/10/2026), una sola vez: lo que todavía está en cada tabla */
  xpHeredar() {
    if (this._xpHeredado || this.leer('xp_log:v1')) { this._xpHeredado = true; return; }
    const ahora = Date.now();
    const de = [
      ["SELECT quien, 'fel' AS que, id AS ref, t FROM aplausos"],
      ["SELECT quien, que, ref, t FROM pase_log WHERE que IN ('fel', 'vivo')"],
      ["SELECT quien, 'sigue' AS que, a AS ref, t FROM sigue"],
      ["SELECT quien, 'voto' AS que, enc AS ref, t FROM votos"],
      ["SELECT quien, 'qg' AS que, id AS ref, t FROM qg_voto"],
      ["SELECT quien, 'apuesta' AS que, ap AS ref, t FROM apostado"],
      ["SELECT quien, 'precio' AS que, cabeza AS ref, MIN(t) AS t FROM precios WHERE quien != 'borrado' GROUP BY quien, cabeza"],
      ["SELECT quien, 'reporte' AS que, CAST(id AS TEXT) AS ref, t FROM reportes WHERE estado = 'aplicado'"],
    ];
    for (const [sql] of de) {
      try {
        this.sql.exec('INSERT OR IGNORE INTO xp_log (quien, que, ref, t) SELECT quien, que, ref, t FROM (' + sql + ')');
      } catch (e) { console.warn('[xp] no pude heredar: ' + String(e).slice(0, 120)); }
    }
    this.guardar('xp_log:v1', ahora);
    this._xpHeredado = true;
  }

  /** 🔥 Cobrar el premio de hoy. Estar en la página ya es entrar: el día se anota primero */
  cobrarDia(quien) {
    const hoy = diaET();
    this.diaActivo(quien, hoy);
    const x = this.rachaDe(quien);
    const p = x.premios.find((y) => y[0] === hoy);
    if (!p || p[2]) return Object.assign(x, { error: p && p[2] ? 'ya' : 'no' });
    this.sql.exec('INSERT OR IGNORE INTO tienda (id, ref, quien, monto, t) VALUES (?, 0, ?, ?, ?)', 'rdia:' + hoy + ':' + quien, quien, p[1], Date.now());
    return Object.assign(this.rachaDe(quien), { cobrado: p[1] });
  }

  /**
   * 🌱 La bienvenida de alguien, o `null` si no es nuevo (su primer día fue hace `BIENVENIDA_DIAS` o más) o ya la
   * terminó. `{paso, pasos: [[monto, clave, texto, cobrado]], hecha, hoy}`: `paso` es el que sigue, `hecha` si ya hizo
   * lo que pide, `hoy` si ya cobró uno hoy (uno por día).
   */
  async bienvenidaDe(quien) {
    const hoy = diaET();
    const pri = (this.sql.exec('SELECT MIN(dia) AS d FROM activo WHERE quien = ?', quien).toArray()[0] || {}).d;
    if (!pri || pri < masDias(hoy, -(BIENVENIDA_DIAS - 1))) return null;
    const filas = this.sql.exec('SELECT id, t FROM tienda WHERE quien = ? AND id LIKE ?', quien, 'bien:' + quien + ':%').toArray();
    const n = filas.length;
    if (n >= BIENVENIDA.length) return null;
    const hoyYa = filas.some((f) => diaET(f.t) === hoy);
    const clave = BIENVENIDA[n][1];
    const hay = (sql, ...a) => !!this.sql.exec(sql, ...a).toArray()[0];
    let hecha = true;
    if (clave === 'seguir') hecha = hay('SELECT 1 AS x FROM sigue WHERE quien = ? LIMIT 1', quien);
    else if (clave === 'campana') hecha = hay('SELECT 1 AS x FROM subs WHERE quien = ? LIMIT 1', quien);
    // ⚠️ miraba `pase_vivo`, que ya nadie escribe: el paso no se podía cumplir. Ahora `xp_log`, que anota a todos
    else if (clave === 'llave') hecha = hay("SELECT 1 AS x FROM xp_log WHERE quien = ? AND que = 'vivo' LIMIT 1", quien);
    else if (clave === 'anotarse') hecha = hay('SELECT 1 AS x FROM inscritos WHERE autor_id = ? LIMIT 1', quien);
    else if (clave === 'verificar') {
      try { hecha = !!(await this.env.KV.get('d:' + quien)); } catch (e) { hecha = false; }
    }
    return { paso: n, pasos: BIENVENIDA.map(([m, k, t], i) => [m, k, t, i < n ? 1 : 0]), hecha, hoy: hoyYa };
  }

  /** 🌱 Cobrar el paso que sigue de la bienvenida: hecho lo que pide, y uno por día */
  async cobrarBienvenida(quien) {
    this.diaActivo(quien, diaET());
    const b = await this.bienvenidaDe(quien);
    if (!b) return { error: 'no' };
    if (b.hoy) return Object.assign(b, { error: 'manana' });
    if (!b.hecha) return Object.assign(b, { error: 'falta' });
    const [monto] = BIENVENIDA[b.paso];
    this.sql.exec('INSERT OR IGNORE INTO tienda (id, ref, quien, monto, t) VALUES (?, 0, ?, ?, ?)', 'bien:' + quien + ':' + (b.paso + 1), quien, monto, Date.now());
    return Object.assign((await this.bienvenidaDe(quien)) || { terminada: true }, { cobrado: monto });
  }

  /**
   * 🔥 Cada `cada` días seguidos, `premio` Puntos de Tienda (Dlx: «A»). Uno por escalón de la racha de ahora
   * (`racha:<quien>:<inicio>:<días>`), así que pedirlo dos veces no paga dos: una racha que se corta y vuelve
   * a arrancar tiene otro inicio y vuelve a pagar desde el primero.
   */
  premiarRacha(quien) {
    // 🔥 DESDE EL 13/10/2026 LA RACHA PAGA POR DÍA (`cobrarDia()`) Y POR HITO, no cada 7 días: ver `RACHA_DIA`
    return this.hitosRacha(quien);
  }

  /** 🔥 Los hitos de la racha de ahora (`RACHA_HITOS`), una vez por racha, con su aviso. */
  hitosRacha(quien) {
    const { racha } = this.rachaDe(quien);
    if (!racha.inicio) return;
    const ahora = Date.now();
    for (const [n, monto] of RACHA_HITOS) {
      if (racha.actual < n) continue;
      const id = 'rhito:' + quien + ':' + racha.inicio + ':' + n;
      if (this.sql.exec('INSERT OR IGNORE INTO tienda (id, ref, quien, monto, t) VALUES (?, 0, ?, ?, ?)', id, quien, monto, ahora).rowsWritten) {
        this.aBandeja(quien, id, 'racha', '🔥 ¡' + n + ' días seguidos!', '+' + monto + ' Puntos de Tienda. Sigue así.', HUB + '/', '', ahora);
      }
    }
  }

  // eslint-disable-next-line no-unused-vars
  premiarRachaViejo(quien) {
    const c = this.rachaCfg();
    const { racha } = this.rachaDe(quien);
    if (!racha.inicio || !(c.cada > 0) || !(c.premio > 0)) return;
    const ahora = Date.now();
    // 🔴 NUNCA MÁS ESCALONES QUE LOS QUE VALE LA RACHA DE AHORA (revisión del 05/10/2026). Un día que llega tarde —una
    // llave corregida que lo marca jugado— puede unir dos rachas ya cobradas: días 1–7 (cobrado) y 9–15 (cobrado) se
    // vuelven 1–15, y con la clave por inicio se cobraba también «1:14», tres premios por dos escalones. Se cuentan los
    // ya cobrados de cualquier racha que empezó adentro de ésta, y se paga sólo lo que falta
    const pref = 'racha:' + quien + ':';
    const cobrados = this.sql.exec('SELECT COUNT(*) AS n FROM tienda WHERE quien = ? AND id LIKE ? AND substr(id, ?, 10) >= ?',
      quien, pref + '%', pref.length + 1, racha.inicio).toArray()[0].n;
    let faltan = Math.floor(racha.actual / c.cada) - cobrados;
    for (let k = c.cada; k <= racha.actual && faltan > 0; k += c.cada) {
      faltan -= this.sql.exec('INSERT OR IGNORE INTO tienda (id, ref, quien, monto, t) VALUES (?, 0, ?, ?, ?)',
        pref + racha.inicio + ':' + k, quien, c.premio, ahora).rowsWritten || 0;
    }
  }

  /** 🔥 Para la página: `{k: [nivel, racha]}` de los que jugaron. La clave es la del perfil: nunca el Discord ID */
  niveles() {
    const out = {};
    // la clave de su perfil: la de la temporada más nueva en que jugó
    for (const { quien, k } of this.sql.exec('SELECT quien, k FROM jugo_temp j1 WHERE temp = ' +
      '(SELECT MAX(temp) FROM jugo_temp j2 WHERE j2.quien = j1.quien)').toArray()) {
      if (!k) continue;
      const x = this.rachaDe(quien);
      out[k] = [x.nivel.n, x.racha.actual];
    }
    return { t: Date.now(), n: out };
  }

  // ── 🧠 LOS DATOS DE CADA PERSONA PARA /card (06/10/2026) ─────────────────────────────────────────────────────────────
  // Eran claves `p:<clave>` de KV y se gastaban su cupo; ahora son filas de `persona`. El ciclo manda todas en cada
  // corrida y acá se escribe sólo lo que cambió; el Worker las lee de a una (`leerP()` en worker.js), y si el objeto
  // no contesta, de KV, donde quedan las de antes.

  /** El valor de una persona (`p:<clave>`), o `null` */
  persona(k) {
    if (!/^p:\S{1,100}$/.test(String(k || ''))) return null;
    const r = this.sql.exec('SELECT v FROM persona WHERE k = ?', String(k)).toArray()[0];
    return r ? r.v : null;
  }

  /** Varias a la vez, para el ciclo: `{k: v}` de las que están (hasta 200) */
  personasLeer(ks) {
    const out = {};
    for (const k of (Array.isArray(ks) ? ks : []).slice(0, 200)) {
      const v = this.persona(k);
      if (v !== null) out[k] = v;
    }
    return { t: Date.now(), personas: out };
  }

  /**
   * Lo que manda el ciclo: `{pares: [[k, v], …], completo}`. Escribe sólo lo que cambió (una fila igual no se toca),
   * y con `completo` borra a quien ya no está —salvo que falte más de la mitad: eso no es gente que se fue, es el
   * ciclo, el mismo freno que los niveles del Pase (`bot/pase.py`)—.
   */
  personasCiclo(d) {
    if (!d || typeof d !== 'object' || !Array.isArray(d.pares)) return { error: 'faltan datos' };
    const ahora = Date.now();
    const vienen = new Map();
    for (const x of d.pares) {
      if (!Array.isArray(x) || typeof x[0] !== 'string' || typeof x[1] !== 'string') continue;
      if (!/^p:\S{1,100}$/.test(x[0]) || x[1].length > 20000) continue;
      vienen.set(x[0], x[1]);
    }
    const hay = this.sql.exec('SELECT COUNT(*) AS n FROM persona').toArray()[0].n;
    if (d.completo && hay >= 20 && vienen.size < hay / 2) {
      return { error: 'freno', hay, vienen: vienen.size };
    }
    let escritas = 0, borradas = 0;
    for (const [k, v] of vienen) {
      escritas += this.sql.exec('INSERT INTO persona (k, v, t) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, ' +
        't = excluded.t WHERE persona.v <> excluded.v', k, v, ahora).rowsWritten || 0;
    }
    if (d.completo) {
      for (const { k } of this.sql.exec('SELECT k FROM persona').toArray()) {
        if (!vienen.has(k)) borradas += this.sql.exec('DELETE FROM persona WHERE k = ?', k).rowsWritten || 0;
      }
    }
    return { ok: true, escritas, borradas, total: vienen.size };
  }

  // ── 🎟️ EL PASE DE RAPERO (05/10/2026; con XP desde el 06/10) ───────────────────────────────────────────────────────
  // Dlx: «sólo para DRA», «con TAREAS», «como Brawl Stars»; el 06/10, al borrador de las dos filas, «1, sí». Las Tareas
  // dan XP y la XP sube de nivel: diarias (cambian a la medianoche del este), semanales (el lunes a las 11 AM ET) y de
  // temporada. Cada nivel paga Puntos de Tienda y algunos dan algo para tu perfil; después del último sigue la cola, y
  // quien lo completa entra al Salón del Pase. Las reglas y los números viven en `bot/pase.py` y llegan por
  // `/pase-ciclo`, con lo que sabe el ciclo: quiénes son miembros de DRA, y cuántos eventos jugó cada uno en DRA y cuántos
  // buscados cazó, semana por semana. Lo demás lo ve pasar el objeto: los días de la racha (`activo`), lo que felicitó y
  // las llaves en vivo que miró (`pase_log`) y los precios que puso (`precios`).

  /** Lo del ciclo, leído una vez por versión: `{v, cfg, sem, miembros, hechas}`. Sin nada del ciclo, `cfg` es `null` */
  paseDatos() {
    const v = this.leer('pase_v') || '';
    if (this._pase && this._pase.v === v) return this._pase;
    const d = (v && this.leer('pase')) || {};
    // ⚠️ un Pase guardado antes de la XP (sin `umbrales`) no se lee: hasta que el ciclo mande el nuevo, «arranca en un rato»
    const cfg = d.cfg && typeof d.cfg === 'object' && Array.isArray(d.cfg.umbrales) ? d.cfg : null;
    this._pase = { v, cfg, sem: Array.isArray(d.sem) ? d.sem : [],
      miembros: new Set(Array.isArray(d.miembros) ? d.miembros : []), hechas: d.hechas && typeof d.hechas === 'object' ? d.hechas : {} };
    if (cfg) {
      // la XP de cada Tarea, por id; y las de la semana de prueba que ya no existen, lo que valían (`legado`)
      cfg.xp = Object.assign({}, cfg.legado || {});
      for (const t of [].concat(cfg.diarias || [], cfg.semanales || [], cfg.temporada || [], cfg.bienvenida || [],
        cfg.especiales || [])) cfg.xp[t[0]] = t[5];
      // 👥 la meta de la crew paga como una Tarea más (`crew`)
      if (cfg.crew) cfg.xp.crew = cfg.crew[0];
      this.paseHeredar(cfg, this._pase.sem);
    }
    return this._pase;
  }

  /**
   * Lo que el Pase ya había visto antes de `pase_log` (06/10/2026): las felicitaciones y las llaves en vivo de la
   * temporada, una sola vez. Sin esto la semana de prueba perdía lo que ya llevaba
   */
  paseHeredar(cfg, sem) {
    const marca = 'pase_log:' + cfg.temp;
    if (this.leer(marca)) return;
    const desde = sem.length ? sem[0][1] : Date.now();
    this.sql.exec("INSERT OR IGNORE INTO pase_log (quien, temp, que, ref, t) SELECT quien, ?, 'fel', id, t FROM aplausos " +
      'WHERE t >= ?', cfg.temp, desde);
    this.sql.exec("INSERT OR IGNORE INTO pase_log (quien, temp, que, ref, t) SELECT quien, ?, 'vivo', llave, t FROM pase_vivo " +
      'WHERE t >= ?', cfg.temp, desde);
    this.guardar(marca, 1);
  }

  /** Anota algo que el Pase cuenta (`fel` o `vivo`), una vez por cosa. Sólo de los miembros de DRA */
  paseVio(quien, que, ref, t) {
    const P = this.paseDatos();
    if (!P.cfg || !P.miembros.has(quien)) return false;
    return !!this.sql.exec('INSERT OR IGNORE INTO pase_log (quien, temp, que, ref, t) VALUES (?, ?, ?, ?, ?)', quien,
      P.cfg.temp, que, String(ref).slice(0, 60), t).rowsWritten;
  }

  /**
   * Lo que manda el ciclo (`bot/pase.py`), validado y guardado sólo si cambió (`v`). Después revisa a los que jugaron
   * en DRA o cazaron: así suben de nivel aunque no abran la página.
   */
  paseCiclo(d) {
    if (!d || typeof d !== 'object' || typeof d.v !== 'string' || !d.cfg || typeof d.cfg !== 'object' ||
      !Array.isArray(d.sem) || !Array.isArray(d.miembros) || !d.hechas || typeof d.hechas !== 'object') {
      return { error: 'faltan datos' };
    }
    if (d.v === this.leer('pase_v')) return { ok: true, cambio: false };
    const fecha = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s));
    const id = (s) => /^[0-9]{5,25}$/.test(String(s));
    const entero = (x, a, b, def) => (Number.isInteger(x) && x >= a && x <= b ? x : def);
    const sem = d.sem.filter((s) => Array.isArray(s) && fecha(s[0]) && Number.isFinite(s[1]) && Number.isFinite(s[2]) &&
      s[1] < s[2]).slice(-60).map((s) => [String(s[0]), s[1], s[2]]);
    const hechas = {};
    for (const [q, x] of Object.entries(d.hechas)) {
      if (!id(q) || !x || typeof x !== 'object') continue;
      const y = {};
      for (const [s, v] of Object.entries(x)) {
        if (fecha(s) && Array.isArray(v)) y[s] = [entero(v[0], 0, 100, 0), entero(v[1], 0, 100, 0)];
      }
      hechas[q] = y;
    }
    const c = d.cfg;
    const tareas = (xs) => (Array.isArray(xs) ? xs : []).filter((t) => Array.isArray(t) &&
      /^[a-z0-9]{1,20}$/.test(String(t[0])) && PASE_MIDE.includes(t[3])).slice(0, 20)
      .map((t) => [String(t[0]), String(t[1] || '').slice(0, 80), String(t[2] || '').slice(0, 200), t[3],
        entero(t[4], 1, 1000, 1), entero(t[5], 0, 100000, 0)]);
    const niveles = entero(c.niveles, 1, 100, 30);
    const umbrales = (Array.isArray(c.umbrales) ? c.umbrales : []).filter((u) => Number.isInteger(u) && u > 0).slice(0, niveles);
    if (umbrales.length !== niveles || umbrales.some((u, i) => i && u <= umbrales[i - 1])) return { error: 'umbrales' };
    const legado = {};
    for (const [k, x] of Object.entries(c.legado && typeof c.legado === 'object' ? c.legado : {})) {
      if (/^[a-z0-9]{1,20}$/.test(k)) legado[k] = entero(x, 0, 100000, 0);
    }
    const cfg = {
      temp: String(c.temp || 'prueba').replace(/[^a-z0-9]/gi, '').slice(0, 20) || 'prueba',
      niveles, umbrales,
      cola: Array.isArray(c.cola) && Number.isInteger(c.cola[0]) && c.cola[0] > 0 ? [c.cola[0], entero(c.cola[1], 0, 100000, 0)] : null,
      diarias: tareas(c.diarias), por_dia: entero(c.por_dia, 1, 10, 2), semanales: tareas(c.semanales),
      temporada: tareas(c.temporada), legado,
      premios: (Array.isArray(c.premios) ? c.premios : []).filter((p) => Array.isArray(p) && Number.isInteger(p[0]))
        .map((p) => [p[0], entero(p[1], 0, 100000, 0), ['tarjeta', 'insignia', 'titulo', 'color'].includes(p[2]) ? p[2] : '',
          String(p[3] || '').slice(0, 40)]),
      publicar: (Array.isArray(c.publicar) ? c.publicar : []).filter((n) => Number.isInteger(n) && n >= 1 && n <= niveles)
        .slice(0, 10),
      // 🎟️ lo del 25/10/2026 (`bot/pase.py`): la bienvenida, las especiales (con su ventana), las semanas de XP doble, desde
      // qué semana hay gracia, la meta de la crew y la fila premium (lo que da: nunca puntos del ranking)
      bienvenida: tareas(c.bienvenida).slice(0, 5),
      especiales: (Array.isArray(c.especiales) ? c.especiales : []).filter((t) => Array.isArray(t) && Number.isFinite(t[6]) &&
        Number.isFinite(t[7]) && t[6] < t[7]).slice(0, 8).map((t) => tareas([t.slice(0, 6)])[0] && tareas([t.slice(0, 6)])[0].concat([t[6], t[7]]))
        .filter(Boolean),
      doble: (Array.isArray(c.doble) ? c.doble : []).filter((x) => Array.isArray(x) && Number.isFinite(x[0]) && Number.isFinite(x[1]) &&
        x[0] < x[1]).slice(0, 10).map((x) => [x[0], x[1], [2, 3].includes(x[2]) ? x[2] : 2]),
      gracia_desde: /^\d{4}-\d{2}-\d{2}$/.test(String(c.gracia_desde || '')) ? String(c.gracia_desde) : '',
      crew: Array.isArray(c.crew) && c.crew.every((x) => Number.isInteger(x) && x >= 0 && x <= 100000) && c.crew.length === 4 ? c.crew : null,
      boost: entero(c.boost, 0, 100, 0),
      rol_regalo: /^[0-9]{5,25}$/.test(String(c.rol_regalo || '')) ? String(c.rol_regalo) : '',
      premium: (Array.isArray(c.premium) ? c.premium : []).filter((p) => Array.isArray(p) && Number.isInteger(p[0]))
        .slice(0, niveles).map((p) => [p[0], entero(p[1], 0, 100000, 0),
          ['marco', 'reaccion', 'fondo', 'color', 'titulo', 'emblema', 'carta'].includes(p[2]) ? p[2] : '', String(p[3] || '').slice(0, 40)]),
    };
    // ⚠️ un id repetido entre las listas sumaría la XP de una Tarea en la otra: no se toma
    const ids = [].concat(cfg.diarias, cfg.semanales, cfg.temporada, cfg.bienvenida, cfg.especiales).map((t) => t[0]);
    if (new Set(ids).size !== ids.length || ids.includes('crew')) return { error: 'tareas repetidas' };
    // 💎 quién tiene el rol del premium ahora: el que llega, desde ahora; el que ya no está, hasta ahora (no se borra: su XP
    // de ese rato sigue valiendo lo que valió). ⚠️ Discord IDs: nunca en `cfg`, que es público
    const llegan = [];
    if (Array.isArray(d.premium)) {
      const ahoraP = Date.now();
      const hay = new Set(d.premium.map(String).filter(id));
      for (const q of hay) {
        const r0 = this.sql.exec('SELECT hasta FROM pase_premium WHERE quien = ? AND temp = ?', q, cfg.temp).toArray()[0];
        if (!r0) llegan.push(q);
        this.sql.exec('INSERT INTO pase_premium (quien, temp, desde, hasta) VALUES (?, ?, ?, NULL) ON CONFLICT(quien, temp) ' +
          'DO UPDATE SET hasta = NULL WHERE hasta IS NOT NULL', q, cfg.temp, ahoraP);
      }
      for (const r of this.sql.exec('SELECT quien FROM pase_premium WHERE temp = ? AND hasta IS NULL', cfg.temp).toArray()) {
        if (!hay.has(String(r.quien))) this.sql.exec('UPDATE pase_premium SET hasta = ? WHERE quien = ? AND temp = ?', ahoraP, r.quien, cfg.temp);
      }
    }
    this.guardar('pase', { cfg, sem, miembros: d.miembros.map(String).filter(id), hechas });
    this.guardar('pase_v', d.v);
    this._pase = null;
    let nuevas = 0;
    for (const q of Object.keys(hechas)) nuevas += this.paseRevisar(q);
    // 💎 quien recién desbloqueó el premium cobra ya lo de los niveles que pasó (sin esperar a su próxima Tarea), y se
    // entera por la campana
    for (const q of llegan) {
      if (!d.miembros.map(String).includes(q)) continue;
      const { nivel } = this.premiarPase(q);
      this.aBandeja(q, 'pase-premium:' + cfg.temp, 'pase', '💎 Desbloqueaste el Pase premium',
        (nivel ? 'Ya cobraste lo de tus ' + nivel + ' niveles de la fila premium. ' : '') + 'Desde ahora tus Tareas dan +' +
        (cfg.boost || 0) + ' % de XP.', HUB + '/freestyle-rap/pase', '', Date.now());
    }
    return { ok: true, cambio: true, niveles: nuevas };
  }

  /** ¿Es de esta temporada el día `AAAA-MM-DD`? (su mediodía cae entre el arranque y el final de las semanas) */
  paseDiaVale(dia, P) {
    if (!P.sem.length) return false;
    const m = Date.UTC(+dia.slice(0, 4), +dia.slice(5, 7) - 1, +dia.slice(8, 10), 16, 30);
    return m >= P.sem[0][1] && m < P.sem[P.sem.length - 1][2];
  }

  /**
   * Cuánto lleva alguien de algo que el Pase sabe contar (`PASE_MIDE`) en `[ini, fin)`. Los días son los de la racha:
   * un día cuenta en el período que contiene su mediodía, como en las semanas (que cambian a las 11 AM ET)
   */
  paseCuenta(quien, mide, ini, fin, P) {
    if (mide === 'activo') {
      const mediodia = (dia) => Date.UTC(+dia.slice(0, 4), +dia.slice(5, 7) - 1, +dia.slice(8, 10), 16, 30);
      return this.sql.exec('SELECT dia FROM activo WHERE quien = ? AND dia >= ? AND dia <= ?', quien, diaET(ini - DIA_MS),
        diaET(Math.min(fin, Date.now() + DIA_MS) + DIA_MS)).toArray().filter((x) => {
        const t = mediodia(x.dia);
        return t >= ini && t < fin;
      }).length;
    }
    if (mide === 'fel' || mide === 'vivo' || mide === 'promo') {
      return this.sql.exec('SELECT COUNT(*) AS n FROM pase_log WHERE quien = ? AND temp = ? AND que = ? AND t >= ? AND t < ?',
        quien, P.cfg.temp, mide, ini, fin).toArray()[0].n;
    }
    if (mide === 'precio') {
      return this.sql.exec('SELECT COUNT(*) AS n FROM precios WHERE quien = ? AND t >= ? AND t < ?', quien, ini, fin)
        .toArray()[0].n;
    }
    // 🏠 las que reemplazan a las de DRA (`pase.SIN_DRA`): votar en una encuesta, apostar en vivo y seguir raperos
    if (mide === 'voto' || mide === 'apuesta' || mide === 'sigue') {
      const tabla = { voto: 'votos', apuesta: 'apostado', sigue: 'sigue' }[mide];
      return this.sql.exec('SELECT COUNT(*) AS n FROM ' + tabla + ' WHERE quien = ? AND t >= ? AND t < ?', quien, ini, fin)
        .toArray()[0].n;
    }
    if (mide === 'dra' || mide === 'caza') {
      const h = P.hechas[quien] || {};
      let n = 0;
      for (const s of P.sem) if (s[1] >= ini && s[2] <= fin && h[s[0]]) n += h[s[0]][mide === 'dra' ? 0 : 1] || 0;
      return n;
    }
    return 0;
  }

  /** Lo anotado de alguien en un período (`sem`: el id de la semana, `d:<día>` o `temp`) */
  paseYa(quien, temp, sem) {
    return new Set(this.sql.exec('SELECT tarea FROM pase_hecho WHERE quien = ? AND temp = ? AND sem = ?', quien, temp, sem)
      .toArray().map((x) => x.tarea));
  }

  /**
   * Las Tareas de una lista en `[ini, fin)`: `[{id, t, d, lleva, meta, hecha, xp}]`. Una que ya se anotó (`ya`) queda
   * cumplida aunque su dato ya no esté: una llave se corrige. A quien no es miembro, sin progreso
   */
  paseLista(quien, lista, ini, fin, P, ya, miembro) {
    return (lista || []).map(([id, t, d, mide, meta, xp]) => {
      const lleva = miembro ? this.paseCuenta(quien, mide, ini, fin, P) : 0;
      const hecha = ya.has(id) || (miembro && lleva >= meta);
      return { id, t, d, lleva: hecha ? meta : Math.min(lleva, meta), meta, hecha, xp };
    });
  }

  /**
   * ×2 💎 Cuánto vale una Tarea anotada en `t`: lo de siempre, por 2 si cayó en una semana de XP doble (`cfg.doble`) y un
   * `cfg.boost`% más si en ese momento tenía el premium (`premium`: `[desde, hasta]` o `null`)
   */
  paseVale(cfg, base, t, premium) {
    let x = base;
    for (const d of cfg.doble || []) if (t >= d[0] && t < d[1]) { x *= d[2]; break; }
    if (premium && cfg.boost && t >= premium[0] && (premium[1] == null || t < premium[1])) x = x * (100 + cfg.boost) / 100;
    return Math.round(x);
  }

  /** 💎 `[desde, hasta]` del premium de alguien en la temporada, o `null` */
  pasePremium(quien, temp) {
    // 👑 el dueño de UL tiene todo desbloqueado (Dlx, 25/10/2026), desde siempre y sin vencer
    if (quien === DUENO) return [0, null];
    const r = this.sql.exec('SELECT desde, hasta FROM pase_premium WHERE quien = ? AND temp = ?', quien, temp).toArray()[0];
    return r ? [r.desde, r.hasta] : null;
  }

  /** La XP de alguien en el Pase de la temporada: lo que dan sus Tareas anotadas (con la XP doble y el premium) */
  paseXP(quien, cfg) {
    const pr = this.pasePremium(quien, cfg.temp);
    let xp = 0;
    for (const r of this.sql.exec('SELECT tarea, t FROM pase_hecho WHERE quien = ? AND temp = ?', quien, cfg.temp).toArray()) {
      xp += this.paseVale(cfg, cfg.xp[r.tarea] || 0, r.t, pr);
    }
    return xp;
  }

  /** `{quien: xp}` de todos los que tienen algo anotado en la temporada */
  paseXPs(cfg) {
    const prs = {};
    for (const r of this.sql.exec('SELECT quien, desde, hasta FROM pase_premium WHERE temp = ?', cfg.temp).toArray()) {
      prs[r.quien] = [r.desde, r.hasta];
    }
    const out = {};
    for (const r of this.sql.exec('SELECT quien, tarea, t FROM pase_hecho WHERE temp = ?', cfg.temp).toArray()) {
      out[r.quien] = (out[r.quien] || 0) + this.paseVale(cfg, cfg.xp[r.tarea] || 0, r.t, prs[r.quien] || null);
    }
    return out;
  }

  /**
   * 👥 LA META DE LA CREW de alguien en la semana `s` (`[id, ini, fin]`): `{crew, nombre, meta, hechas, mias, n}` o `null`
   * si no está en una crew con al menos otro del Pase. Cuentan las Tareas de los de la crew que son del Pase, sin la
   * de la meta misma
   */
  paseCrew(quien, s, P) {
    if (!P.cfg || !P.cfg.crew) return null;
    const m = this.sql.exec('SELECT crew FROM crew_miembros WHERE quien = ? AND pend = 0', quien).toArray()[0];
    if (!m) return null;
    const qs = this.sql.exec("SELECT quien FROM crew_miembros WHERE crew = ? AND pend = 0 AND quien != ''", m.crew).toArray()
      .map((r) => String(r.quien)).filter((q) => P.miembros.has(q));
    if (qs.length < 2) return null;
    const [xp, porCabeza, piso, techo] = P.cfg.crew;
    const meta = Math.max(piso, Math.min(techo, porCabeza * qs.length));
    let hechas = 0, mias = 0;
    for (const r of this.sql.exec("SELECT quien, COUNT(*) AS n FROM pase_hecho WHERE temp = ? AND t >= ? AND t < ? AND tarea != 'crew' " +
      'AND quien IN (' + qs.map(() => '?').join(',') + ') GROUP BY quien', P.cfg.temp, s[1], s[2], ...qs).toArray()) {
      hechas += r.n;
      if (String(r.quien) === quien) mias = r.n;
    }
    const c = this.sql.exec('SELECT nombre FROM crews WHERE id = ?', m.crew).toArray()[0];
    return { crew: m.crew, nombre: c ? c.nombre : '', meta, hechas, mias, n: qs.length, xp, miembros: qs };
  }

  /** El nivel de alguien en el Pase de la temporada */
  /** 🔗 El nivel del Pase de alguien, para los roles vinculados de Discord (0 si no es miembro o no hay Pase). */
  rolDatos(d) {
    const quien = String((d && d.quien) || '');
    if (!/^[0-9]{5,25}$/.test(quien)) return { error: 'datos' };
    const P = this.paseDatos();
    return { nivel: P.cfg && P.miembros.has(quien) ? this.paseNivel(quien, P.cfg) : 0 };
  }

  paseNivel(quien, cfg) {
    return nivelDeXP(cfg, this.paseXP(quien, cfg));
  }

  /**
   * Anota las Tareas cumplidas de un miembro —las diarias de hoy y de ayer, las de cada semana y las de temporada— y paga
   * lo nuevo. Devuelve cuántas Tareas nuevas. ⚠️ Sólo de los miembros de DRA: el Pase es de ellos (Dlx). Lo llaman el
   * día que cuenta (`diaActivo()`), el aplauso, la llave en vivo, el precio, lo que manda el ciclo y pedir tu Pase.
   */
  paseRevisar(quien) {
    const P = this.paseDatos();
    if (!P.cfg || !P.miembros.has(quien) || !P.sem.length) return 0;
    const cfg = P.cfg, ahora = Date.now();
    const xpAntes = this.paseXP(quien, cfg);
    const antes = nivelDeXP(cfg, xpAntes), colaAntes = paseCola(cfg, xpAntes);
    let nuevas = 0;
    const anotar = (sem, xs) => {
      for (const x of xs) {
        if (!x.hecha) continue;
        nuevas += this.sql.exec('INSERT OR IGNORE INTO pase_hecho (quien, temp, sem, tarea, t) VALUES (?, ?, ?, ?, ?)',
          quien, cfg.temp, sem, x.id, ahora).rowsWritten || 0;
      }
    };
    // las diarias de hoy, y las de ayer por si algo de ayer llegó después de la medianoche
    for (const dia of [diaET(ahora - DIA_MS), diaET(ahora)]) {
      if (!this.paseDiaVale(dia, P)) continue;
      const lista = paseDelDia(cfg, dia), ya = this.paseYa(quien, cfg.temp, 'd:' + dia);
      if (lista.every((t) => ya.has(t[0]))) continue;
      const [i, f] = rangoDiaET(dia);
      anotar('d:' + dia, this.paseLista(quien, lista, i, f, P, ya, true));
    }
    for (const s of P.sem) {
      if (s[1] > ahora) continue;
      const ya = this.paseYa(quien, cfg.temp, s[0]);
      if ((cfg.semanales || []).every((t) => ya.has(t[0]))) continue;
      // 🛟 LA SEMANA DE GRACIA (25/10/2026): la semana que acaba de terminar sigue abierta siete días más (desde
      // `gracia_desde`): lo que hagas esta semana también le cumple las que te faltaron. Paga en SU semana
      const fin = cfg.gracia_desde && s[0] >= cfg.gracia_desde && s[2] <= ahora && ahora < s[2] + 7 * DIA_MS ? s[2] + 7 * DIA_MS : s[2];
      anotar(s[0], this.paseLista(quien, cfg.semanales, s[1], fin, P, ya, true));
    }
    const yaT = this.paseYa(quien, cfg.temp, 'temp');
    if (!(cfg.temporada || []).every((t) => yaT.has(t[0]))) {
      anotar('temp', this.paseLista(quien, cfg.temporada, P.sem[0][1], SIEMPRE, P, yaT, true));
    }
    // 👋 la bienvenida: una sola vez, contando desde el arranque (quien ya lo hizo, la cobra al aparecer)
    const yaB = this.paseYa(quien, cfg.temp, 'bien');
    if ((cfg.bienvenida || []).length && !cfg.bienvenida.every((t) => yaB.has(t[0]))) {
      anotar('bien', this.paseLista(quien, cfg.bienvenida, P.sem[0][1], SIEMPRE, P, yaB, true));
    }
    // ⭐ las especiales: cada una sólo adentro de su ventana
    for (const e of cfg.especiales || []) {
      if (e[6] > ahora) continue;
      const yaE = this.paseYa(quien, cfg.temp, 'e:' + e[0]);
      if (yaE.has(e[0])) continue;
      anotar('e:' + e[0], this.paseLista(quien, [e.slice(0, 6)], e[6], e[7], P, yaE, true));
    }
    // 👥 la meta de la crew, de esta semana y de la que acaba de terminar: si la crew llegó, la cobra cada uno
    for (const s of P.sem.filter((x) => x[1] <= ahora).slice(-2)) {
      if (this.paseYa(quien, cfg.temp, s[0]).has('crew')) continue;
      const c = this.paseCrew(quien, s, P);
      if (c && c.hechas >= c.meta) anotar(s[0], [{ id: 'crew', hecha: true }]);
    }
    if (!nuevas) return 0;
    const { nivel, cola } = this.premiarPase(quien);
    // 🏛️ los niveles que se publican (y el último es el Salón del Pase): cuándo llegó a cada uno, una vez
    for (const h of cfg.publicar || []) {
      if (nivel >= h) {
        this.sql.exec('INSERT OR IGNORE INTO pase_hito (quien, temp, nivel, t) VALUES (?, ?, ?, ?)', quien, cfg.temp, h, ahora);
      }
    }
    // 🔔 y a su campana: uno solo por temporada, que se pisa («Nivel 7» reemplaza a «Nivel 6»). Sin push: es la bandeja
    const url = HUB + '/freestyle-rap/pase';
    if (nivel > antes) {
      const nuevos = (cfg.premios || []).filter((p) => p[0] > antes && p[0] <= nivel);
      const tienda = nuevos.reduce((a, p) => a + (p[1] || 0), 0);
      const extra = nuevos.map((p) => (p[2] === 'titulo' ? ' Ganaste el título «' + p[3] + '».'
        : p[2] === 'insignia' ? ' Ganaste la insignia ' + p[3] + '.' : p[2] === 'color' ? ' Tu nombre ya va en dorado.'
          : p[2] === 'tarjeta' ? ' Desbloqueaste tu tarjeta de ' + p[3] + ': sale en la próxima vuelta del ciclo.' : '')).join('');
      const salon = nivel >= cfg.niveles ? ' Completaste el Pase: ya estás en el Salón del Pase.' : '';
      this.aBandeja(quien, 'pase:' + cfg.temp, 'pase', '🎟️ Nivel ' + nivel + ' del Pase de rapero',
        (tienda ? '+' + tienda + ' Puntos de Tienda.' : '') + extra + salon, url, '', ahora);
    } else if (cola > colaAntes && cfg.cola) {
      this.aBandeja(quien, 'pase:' + cfg.temp, 'pase', '🎟️ Pase completo · +' + cola,
        '+' + (cola - colaAntes) * cfg.cola[1] + ' Puntos de Tienda por seguir sumando XP.', url, '', ahora);
    }
    return nuevas;
  }

  /** Paga cada nivel alcanzado una sola vez (`pase:<temporada>:<quien>:<nivel>`) y la cola (`…:c<paso>`) */
  premiarPase(quien) {
    const P = this.paseDatos();
    if (!P.cfg) return { nivel: 0, xp: 0, cola: 0 };
    const cfg = P.cfg, ahora = Date.now();
    const xp = this.paseXP(quien, cfg);
    const nivel = nivelDeXP(cfg, xp), cola = paseCola(cfg, xp);
    const pagar = (k, monto) => {
      if (monto > 0) {
        this.sql.exec('INSERT OR IGNORE INTO tienda (id, ref, quien, monto, t) VALUES (?, 0, ?, ?, ?)',
          'pase:' + cfg.temp + ':' + quien + ':' + k, quien, monto, ahora);
      }
    };
    for (let n = 1; n <= nivel; n++) {
      const p = (cfg.premios || [])[n - 1];
      if (p) pagar(n, p[1]);
    }
    for (let j = 1; j <= cola; j++) pagar('c' + j, cfg.cola[1]);
    // 💎 y la fila premium, si la tiene: al desbloquearla cobra de una vez lo de los niveles que ya pasó
    if (this.pasePremium(quien, cfg.temp)) {
      for (let n = 1; n <= nivel; n++) {
        const p = (cfg.premium || [])[n - 1];
        if (p) pagar('p' + n, p[1]);
        // 🖼️ el marco de ese nivel, al inventario, para siempre
        if (p && p[2] === 'marco' && MARCOS.includes(String(p[3]).toLowerCase())) {
          this.sql.exec('INSERT OR IGNORE INTO marcos (quien, marco, t) VALUES (?, ?, ?)', quien, cfg.temp + ':' + String(p[3]).toLowerCase(), Date.now());
        }
      }
    }
    return { nivel, xp, cola };
  }

  /** Lo que ganó alguien hasta su nivel: el último título, el color y las insignias (`[[nivel, valor], …]`) */
  pasePremios(cfg, nivel, quien) {
    // 👑 el dueño: lo que da cada nivel, como si los tuviera todos (el título, el color y el marco del más alto)
    if (quien === DUENO) nivel = Math.max(nivel, cfg.niveles || 30);
    const hasta = (cfg.premios || []).filter((p) => p[0] <= nivel);
    const ult = (tipo) => (hasta.filter((p) => p[2] === tipo).pop() || [])[3] || '';
    const out = { titulo: ult('titulo'), color: ult('color'), insignias: hasta.filter((p) => p[2] === 'insignia').map((p) => [p[0], p[3]]),
      premium: false, marco: '', emblema: false };
    // 💎 con el premium: su título (si llegó), el color que eligió (el nivel 7), el marco de su carta y el emblema
    if (quien && this.pasePremium(quien, cfg.temp)) {
      const ph = (cfg.premium || []).filter((p) => p[0] <= nivel);
      const pu = (tipo) => ph.filter((p) => p[2] === tipo).pop() || null;
      out.premium = true;
      if (pu('titulo')) out.titulo = pu('titulo')[3];
      if (pu('color')) {
        const c = this.sql.exec('SELECT color FROM pase_color WHERE quien = ?', quien).toArray()[0];
        if (c) out.color = c.color;
      }
      out.marco = pu('marco') ? pu('marco')[3] : '';
      out.emblema = !!pu('emblema');
    }
    return out;
  }

  /**
   * 🎟️ El Pase de alguien, para su página (`/avisos/pase`, con su sesión). Pedirlo ya revisa sus Tareas. A quien no es
   * miembro de DRA le muestra igual qué es y qué pide, sin progreso.
   */
  paseDe(quien) {
    const P = this.paseDatos();
    if (!P.cfg) return { listo: false };
    const cfg = P.cfg;
    const miembro = P.miembros.has(quien);
    if (miembro) this.paseRevisar(quien);
    const ahora = Date.now();
    const s = P.sem.filter((x) => x[1] <= ahora).slice(-1)[0] || null;
    const xp = miembro ? this.paseXP(quien, cfg) : 0;
    const nivel = nivelDeXP(cfg, xp);
    const ya = (sem) => (miembro ? this.paseYa(quien, cfg.temp, sem) : new Set());
    const dia = diaET(ahora);
    let hoy = null;
    if (this.paseDiaVale(dia, P)) {
      const [i, f] = rangoDiaET(dia);
      hoy = { dia, fin: f, tareas: this.paseLista(quien, paseDelDia(cfg, dia), i, f, P, ya('d:' + dia), miembro) };
    }
    const semana = s ? { id: s[0], fin: s[2], tareas: this.paseLista(quien, cfg.semanales, s[1], s[2], P, ya(s[0]), miembro) } : null;
    const temporada = P.sem.length ? this.paseLista(quien, cfg.temporada, P.sem[0][1], SIEMPRE, P, ya('temp'), miembro) : [];
    const cobrado = miembro ? this.sql.exec("SELECT COALESCE(SUM(monto), 0) AS n FROM tienda WHERE quien = ? AND id LIKE ?",
      quien, 'pase:' + cfg.temp + ':%').toArray()[0].n : 0;
    // la insignia del último nivel queda para siempre: las temporadas que completó
    const completos = this.sql.exec('SELECT temp FROM pase_hito WHERE quien = ? AND nivel >= ? ORDER BY temp', quien, cfg.niveles)
      .toArray().map((r) => r.temp);
    // 🏛️ y en qué puesto entró al Salón del Pase de esta temporada
    const mio = this.sql.exec('SELECT t FROM pase_hito WHERE quien = ? AND temp = ? AND nivel = ?', quien, cfg.temp, cfg.niveles)
      .toArray()[0];
    const salon = mio ? this.sql.exec('SELECT COUNT(*) AS n FROM pase_hito WHERE temp = ? AND nivel = ? AND t <= ?', cfg.temp,
      cfg.niveles, mio.t).toArray()[0].n : 0;
    const u = cfg.umbrales;
    return Object.assign({ listo: true, miembro, temp: cfg.temp, niveles: cfg.niveles, nivel, xp,
      desde: nivel ? u[nivel - 1] : 0, hasta: nivel < cfg.niveles ? u[nivel] : null, cola: paseCola(cfg, xp),
      cada: cfg.cola ? cfg.cola : null, cobrado, completos, salon, hoy, semana, temporada, premios: cfg.premios || [] },
    this.pasePremios(cfg, nivel, quien), this.paseExtras(quien, cfg, P, miembro, nivel, ya));
  }

  /**
   * 🎟️ Lo del 25/10/2026 para la página de cada uno: la semana de gracia, la bienvenida, las especiales, la crew, el
   * premium (si lo tiene y desde cuándo), sus avisos, las semanas de XP doble y la fila premium
   */
  paseExtras(quien, cfg, P, miembro, nivel, ya) {
    const ahora = Date.now();
    const out = { bienvenida: [], especiales: [], gracia: null, crew: null, doble: cfg.doble || [], boost: cfg.boost || 0,
      fila_premium: cfg.premium || [], premium: null, aviso: false, color_premium: '', colores: PASE_COLORES };
    try {
      if (P.sem.length) out.bienvenida = this.paseLista(quien, cfg.bienvenida || [], P.sem[0][1], SIEMPRE, P, ya('bien'), miembro);
      out.especiales = (cfg.especiales || []).map((e) => Object.assign(this.paseLista(quien, [e.slice(0, 6)], e[6], e[7], P,
        ya('e:' + e[0]), miembro && e[6] <= ahora)[0], { ini: e[6], fin: e[7] }));
      // 🛟 la semana que terminó, si todavía está en su semana de gracia y le falta alguna
      const prev = P.sem.filter((x) => x[2] <= ahora).slice(-1)[0];
      if (prev && cfg.gracia_desde && prev[0] >= cfg.gracia_desde && ahora < prev[2] + 7 * DIA_MS) {
        const ts = this.paseLista(quien, cfg.semanales, prev[1], prev[2] + 7 * DIA_MS, P, ya(prev[0]), miembro).filter((t) => !t.hecha);
        if (ts.length) out.gracia = { id: prev[0], fin: prev[2] + 7 * DIA_MS, tareas: ts };
      }
      const s = P.sem.filter((x) => x[1] <= ahora).slice(-1)[0];
      if (s && miembro) {
        const c = this.paseCrew(quien, s, P);
        if (c) out.crew = { nombre: c.nombre, meta: c.meta, hechas: c.hechas, mias: c.mias, n: c.n, xp: c.xp, fin: s[2],
          cobrada: ya(s[0]).has('crew') };
      }
      const pr = this.pasePremium(quien, cfg.temp);
      if (pr) out.premium = { desde: pr[0], hasta: pr[1] };
      out.aviso = !!(this.sql.exec('SELECT si FROM pase_aviso WHERE quien = ?', quien).toArray()[0] || {}).si;
      out.color_premium = (this.sql.exec('SELECT color FROM pase_color WHERE quien = ?', quien).toArray()[0] || {}).color || '';
    } catch (e) { /* lo nuevo no tapa el Pase */ }
    return out;
  }

  /** 🔔 Prender o apagar los avisos del Pase (`/avisos/pase-avisos`, con su sesión) */
  paseAvisoPoner(d) {
    const quien = String(d.quien || '');
    if (!/^[0-9]{5,25}$/.test(quien) || typeof d.si !== 'boolean') return { error: 'faltan datos' };
    this.sql.exec('INSERT INTO pase_aviso (quien, si, t) VALUES (?, ?, ?) ON CONFLICT(quien) DO UPDATE SET si = excluded.si, t = excluded.t',
      quien, d.si ? 1 : 0, Date.now());
    return { ok: true, si: d.si };
  }

  /** 🎨 El color de nombre de quien tiene el premium y llegó a su nivel 7 (`/avisos/pase-color`, con su sesión) */
  paseColorPoner(d) {
    const quien = String(d.quien || ''), color = String(d.color || '');
    if (!/^[0-9]{5,25}$/.test(quien) || !PASE_COLORES.includes(color)) return { error: 'faltan datos' };
    const P = this.paseDatos();
    if (!P.cfg || !this.pasePremium(quien, P.cfg.temp)) return { error: 'premium' };
    const n7 = ((P.cfg.premium || []).find((p) => p[2] === 'color') || [7])[0];
    if (quien !== DUENO && this.paseNivel(quien, P.cfg) < n7) return { error: 'nivel', falta: n7 };
    this.sql.exec('INSERT INTO pase_color (quien, color, t) VALUES (?, ?, ?) ON CONFLICT(quien) DO UPDATE SET color = excluded.color, t = excluded.t',
      quien, color, Date.now());
    return { ok: true, color };
  }

  /**
   * 🔔 EL AVISO SEMANAL DEL PASE (Dlx, 25/10/2026: el informe, cambio 9): el domingo desde `PASE_AVISO_HORA` del este,
   * una vez por semana y SÓLO a quien lo prendió (`pase_aviso`), qué le falta para el siguiente nivel y cuánto le dan las
   * semanales que todavía tiene. Al teléfono, con el mismo tope por minuto que los demás. Nunca por DM
   */
  async avisarPase(ahora) {
    if (this.pausada()) return 0;
    const P = this.paseDatos();
    if (!P.cfg || !P.sem.length) return 0;
    const dow = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(new Date(ahora));
    const s = P.sem.filter((x) => x[1] <= ahora).slice(-1)[0];
    if (dow !== 'Sun' || horaET(ahora) < PASE_AVISO_HORA || !s || this.leer('pase_aviso_sem') === s[0]) return 0;
    const cands = this.sql.exec('SELECT DISTINCT a.quien FROM pase_aviso a JOIN subs s ON s.quien = a.quien WHERE a.si = 1').toArray()
      .map((x) => String(x.quien)).filter((q) => P.miembros.has(q));
    let enviados = 0, pedidos = 0, quedan = 0;
    for (const quien of cands) {
      const id = 'pase-aviso:' + quien + ':' + s[0];
      if (this.sql.exec('SELECT id FROM hechos WHERE id = ?', id).toArray()[0]) continue;
      const xp = this.paseXP(quien, P.cfg), nivel = nivelDeXP(P.cfg, xp);
      if (nivel >= P.cfg.niveles) continue;
      const falta = P.cfg.umbrales[nivel] - xp;
      const pend = this.paseLista(quien, P.cfg.semanales, s[1], s[2], P, this.paseYa(quien, P.cfg.temp, s[0]), true).filter((t) => !t.hecha);
      const subs = this.sql.exec('SELECT id, endpoint, p256dh, auth FROM subs WHERE quien = ?', quien).toArray();
      if (!subs.length) continue;
      if (pedidos + subs.length > TOPE_PERSONALES && pedidos) { quedan++; continue; }
      this.sql.exec('INSERT OR IGNORE INTO hechos (id, t) VALUES (?, ?)', id, ahora);
      pedidos += subs.length;
      const cuerpo = cuerpoPersonal({ id: 'pase' + s[0].replace(/-/g, ''),
        titulo: '🎟️ Te faltan ' + falta.toLocaleString('es') + ' XP para el nivel ' + (nivel + 1),
        cuerpo: pend.length ? 'Te quedan ' + pend.length + ' semanales (+' + pend.reduce((a, t) => a + t.xp, 0).toLocaleString('es') +
          ' XP) hasta el lunes a las 11 AM.' : 'Ya cumpliste las semanales: las diarias de mañana te acercan.',
        url: HUB + '/freestyle-rap/pase' });
      const estados = await Promise.all(subs.map((x) => empujar(x, cuerpo, { ttl: 12 * 3600, topic: 'pase' }, this.env, new Map())));
      let llego = 0, reintentar = false;
      estados.forEach((e, i) => {
        if (e >= 200 && e < 300) { enviados++; llego++; }
        else if (MUERTA(e)) this.sql.exec('DELETE FROM subs WHERE id = ?', subs[i].id);
        else if (e === 0 || e === 429 || e >= 500) reintentar = true;
      });
      if (reintentar && !llego) this.sql.exec('DELETE FROM hechos WHERE id = ?', id);
    }
    if (!quedan) this.guardar('pase_aviso_sem', s[0]);
    return enviados;
  }

  /**
   * 🎟️ EL SORTEO DEL PASE PREMIUM (Dlx, 25/10/2026): el que programó Dlx (`pase_sorteo`: `{id, cierra, sorteo}`), quién
   * entró (cuántos, nunca quién, salvo el ganador) y el resultado. `quien`: si esa cuenta entró y con cuántos boletos
   */
  sorteoDe(quien) {
    const S = this.ajustes().pase_sorteo;
    if (!S) return { sorteo: null };
    const parts = this.sql.exec('SELECT COUNT(*) AS n, COALESCE(SUM(boletos), 0) AS b FROM sorteo_part WHERE sorteo = ?', S.id).toArray()[0];
    const r = this.sql.exec('SELECT ganador, semilla, n, boletos, rol, t FROM sorteo_res WHERE sorteo = ?', S.id).toArray()[0];
    const mio = quien ? this.sql.exec('SELECT boletos FROM sorteo_part WHERE sorteo = ? AND quien = ?', S.id, quien).toArray()[0] : null;
    const out = { sorteo: { id: S.id, cierra: Date.parse(S.cierra), cuando: Date.parse(S.sorteo), personas: parts.n, boletos: parts.b },
      mio: mio ? mio.boletos : 0 };
    if (r) {
      out.resultado = { k: this.claveDe(r.ganador), semilla: r.semilla, personas: r.n, boletos: r.boletos, t: r.t,
        yo: quien === r.ganador, rol: r.rol };
      // los nombres que pasan en la animación: los perfiles que entraron (sin cuentas ni IDs)
      out.nombres = this.sql.exec('SELECT quien FROM sorteo_part WHERE sorteo = ? ORDER BY t LIMIT 60', S.id).toArray()
        .map((x) => this.claveDe(x.quien)).filter(Boolean);
    }
    return out;
  }

  /** Entrar al sorteo (`/avisos/sorteo-entrar`, con su sesión): gratis, una vez; boletos = 1 + semanas con las 5 semanales, hasta 3 */
  sorteoEntrar(d) {
    const quien = String(d.quien || '');
    if (!/^[0-9]{5,25}$/.test(quien)) return { error: 'faltan datos' };
    const S = this.ajustes().pase_sorteo, ahora = Date.now();
    if (!S || ahora >= Date.parse(S.cierra)) return { error: 'cerrado' };
    const P = this.paseDatos();
    if (!P.cfg || !P.miembros.has(quien)) return { error: 'miembro' };
    const nSem = (P.cfg.semanales || []).length;
    let llenas = 0;
    for (const s of P.sem) {
      if (s[2] > ahora) continue;
      const ya = this.paseYa(quien, P.cfg.temp, s[0]);
      if (nSem && (P.cfg.semanales || []).every((t) => ya.has(t[0]))) llenas++;
    }
    const boletos = Math.min(3, 1 + llenas);
    this.sql.exec('INSERT INTO sorteo_part (sorteo, quien, boletos, t) VALUES (?, ?, ?, ?) ON CONFLICT(sorteo, quien) DO UPDATE SET ' +
      'boletos = excluded.boletos', S.id, quien, boletos, ahora);
    return Object.assign({ ok: true }, this.sorteoDe(quien));
  }

  /**
   * 🎲 Sortea cuando llega la hora (lo llama el vigía). Transparente: la semilla es el SHA-256 del id del sorteo y de la
   * lista de boletos en orden (`quien×boletos`), y el ganador es esa semilla módulo el total de boletos. Cualquiera con la
   * lista puede repetir la cuenta. Va al muro por el ciclo (`bot/muro.py` lee `/avisos/sorteo`)
   */
  async sortear(ahora) {
    const S = this.ajustes().pase_sorteo;
    if (!S || ahora < Date.parse(S.sorteo)) return null;
    if (this.sql.exec('SELECT 1 FROM sorteo_res WHERE sorteo = ?', S.id).toArray()[0]) return null;
    const ps = this.sql.exec('SELECT quien, boletos FROM sorteo_part WHERE sorteo = ? ORDER BY quien', S.id).toArray();
    if (!ps.length) return null;
    const lista = ps.map((p) => p.quien + 'x' + p.boletos).join(',');
    const dig = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(S.id + ':' + lista));
    const hex = [...new Uint8Array(dig)].map((b) => b.toString(16).padStart(2, '0')).join('');
    const total = ps.reduce((a, p) => a + p.boletos, 0);
    let i = Number(BigInt('0x' + hex) % BigInt(total)), ganador = ps[0].quien;
    for (const p of ps) { if (i < p.boletos) { ganador = p.quien; break; } i -= p.boletos; }
    this.sql.exec('INSERT OR IGNORE INTO sorteo_res (sorteo, ganador, semilla, n, boletos, t) VALUES (?, ?, ?, ?, ?, ?)',
      S.id, ganador, hex, ps.length, total, ahora);
    return ganador;
  }

  /**
   * 🎟️ EL ROL AL GANADOR, LO PONE EL BOT (Dlx, 25/10/2026: «¿tú le puedes dar el rol mejor?»). «Pase T» es el rol de
   * la suscripción del servidor y nadie puede ponerlo a mano: por eso existe `cfg.rol_regalo` («Pase Premium», de
   * `pase.ROL_REGALO`). `sorteo_res.rol`: 0 falta, 1 puesto, -1 no se puede (ya no está en DRA). Lo llama el vigía cada
   * minuto hasta que sale; con el rol, el ciclo siguiente le prende el premium (`verificados.guardar_premium()`)
   */
  async sorteoRol(ahora) {
    const P = this.paseDatos();
    const rol = P.cfg && /^[0-9]{5,25}$/.test(String(P.cfg.rol_regalo || '')) ? String(P.cfg.rol_regalo) : '';
    if (!rol || !this.env.DISCORD_TOKEN) return 0;
    let puestos = 0;
    for (const r of this.sql.exec('SELECT sorteo, ganador FROM sorteo_res WHERE rol = 0 ORDER BY t LIMIT 3').toArray()) {
      let st = 0;
      try {
        st = (await fetch(`${DC}/guilds/${GUILD_LOGS}/members/${r.ganador}/roles/${rol}`, { method: 'PUT',
          headers: { Authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'User-Agent': UA,
            'X-Audit-Log-Reason': encodeURIComponent('Ganó el sorteo del Pase premium (' + r.sorteo + ')') } })).status;
      } catch (e) { st = 0; }
      if (st === 204 || st === 200) {
        this.sql.exec('UPDATE sorteo_res SET rol = 1 WHERE sorteo = ?', r.sorteo);
        this.aBandeja(r.ganador, 'sorteo:' + r.sorteo, 'pase', '🎟️ Ganaste el sorteo del Pase premium',
          'Ya tienes el rol «Pase Premium» en DRA: en la próxima vuelta del ciclo se te desbloquea la fila premium.',
          HUB + '/freestyle-rap/pase', '', ahora);
        puestos++;
      } else if (st === 404) {
        // ya no está en DRA (o se borró la cuenta): no se reintenta, y el Dashboard lo dice
        this.sql.exec('UPDATE sorteo_res SET rol = -1 WHERE sorteo = ?', r.sorteo);
      }
    }
    return puestos;
  }

  /**
   * 🎟️ «Miré una llave en vivo» (`/avisos/pase-vivo`, con su sesión): la página lo manda después de un rato en la llave.
   * Cuenta si de verdad está en vivo esa llave, o un 5 vidas de las últimas horas. Sólo de los miembros.
   */
  paseVivo(d) {
    const quien = String(d.quien || ''), llave = String(d.llave || '');
    if (!/^[0-9]{5,25}$/.test(quien) || !/^[A-Za-z0-9:_-]{1,60}$/.test(llave)) return { error: 'faltan datos' };
    const desde = Date.now() - VIVO_HORAS * HORA;
    // 🔴 ESA llave, no cualquiera (revisión del 05/10/2026): con «algo en vivo» alcanzaba mandar cualquier id mientras
    // se jugaba cualquier evento y la Tarea se cumplía sin mirar nada. La de la página es la de `vivo` (su primer
    // mensaje) o `ver:<id>`, la de un 5 vidas de #veredictos (`LlaveVivo.veredictos()`)
    const hay = llave.startsWith('ver:')
      ? this.sql.exec('SELECT 1 FROM veredictos WHERE id = ? AND pub > ? LIMIT 1', llave.slice(4), desde).toArray().length
      : this.sql.exec('SELECT 1 FROM vivo WHERE id = ? AND ed > ? LIMIT 1', llave, desde).toArray().length;
    if (!hay) return { ok: true, cuenta: false };
    // ⭐ sube el nivel de cualquiera (14/10/2026); el Pase, sólo de los miembros
    const xp = this.xpVio(quien, 'vivo', llave);
    const P = this.paseDatos();
    if (!P.cfg || !P.miembros.has(quien)) return { ok: true, cuenta: false, xp };
    this.paseVio(quien, 'vivo', llave, Date.now());
    return { ok: true, cuenta: true, xp, nuevas: this.paseRevisar(quien) };
  }

  /** La clave del perfil de alguien: la de la temporada más nueva en que jugó, y si no, la de su cuenta (`idk`) */
  claveDe(quien) {
    const j = this.sql.exec('SELECT k FROM jugo_temp WHERE quien = ? ORDER BY temp DESC LIMIT 1', quien).toArray()[0];
    return (j && j.k) || ((this.sql.exec('SELECT k FROM idk WHERE id = ?', quien).toArray()[0] || {}).k) || '';
  }

  /**
   * 🎟️ Para el ciclo (`/avisos/pase-niveles`, con su clave): `{discord_id: nivel}` de los que tienen nivel 1 o más
   * en el Pase de la temporada, y quién llegó a los niveles que se publican (`hitos`: `[id, nivel, ms, clave]`). La
   * Temporada es la recompensa del nivel 1 (Dlx, 05/10/2026: «C», «nivel 1»): con esto el ciclo sabe a quién
   * dibujársela; y los hitos van a Publicaciones (`bot/muro.py`). Trae Discord IDs: nunca es público
   */
  paseNiveles() {
    const P = this.paseDatos();
    if (!P.cfg) return { t: Date.now(), temp: '', niveles: {}, hitos: [] };
    const out = {};
    for (const [q, xp] of Object.entries(this.paseXPs(P.cfg))) {
      const n = nivelDeXP(P.cfg, xp);
      if (n > 0) out[q] = n;
    }
    const hitos = this.sql.exec('SELECT quien, nivel, t FROM pase_hito WHERE temp = ? ORDER BY t', P.cfg.temp).toArray()
      .map((h) => [h.quien, h.nivel, h.t, this.claveDe(h.quien)]);
    // 🎟️ los sorteos del premium ya hechos, para Publicaciones (`bot/muro.py`): `[id, clave, ms, personas, boletos, semilla]`
    const sorteos = this.sql.exec('SELECT sorteo, ganador, t, n, boletos, semilla FROM sorteo_res ORDER BY t').toArray()
      .map((r) => [r.sorteo, this.claveDe(r.ganador), r.t, r.n, r.boletos, r.semilla]);
    return { t: Date.now(), temp: P.cfg.temp, niveles: out, hitos, sorteos };
  }

  /**
   * 🎟️ Para la página: `{clave: [nivel, título, color]}` de los perfiles con nivel, por clave y nunca por cuenta; lo
   * público del Pase (`cfg`: las Tareas y los premios), para quien no entró; y el Salón del Pase
   */
  pases() {
    const P = this.paseDatos();
    const out = {};
    if (!P.cfg) return { t: Date.now(), n: out };
    const c = P.cfg;
    const cfg = { temp: c.temp, niveles: c.niveles, umbrales: c.umbrales, cola: c.cola, diarias: c.diarias,
      por_dia: c.por_dia, semanales: c.semanales, temporada: c.temporada, premios: c.premios || [], publicar: c.publicar || [],
      bienvenida: c.bienvenida || [], especiales: c.especiales || [], doble: c.doble || [], boost: c.boost || 0, premium: c.premium || [] };
    for (const [quien, xp] of Object.entries(this.paseXPs(c))) {
      const nivel = nivelDeXP(c, xp);
      const k = nivel ? this.claveDe(quien) : '';
      if (!k) continue;
      const pr = this.pasePremios(c, nivel, quien);
      // 💎 el cuarto y el quinto: si tiene el premium (1) y el marco de su carta ('' sin)
      out[k] = pr.premium ? [nivel, pr.titulo, pr.color, 1, pr.marco, pr.emblema ? 1 : 0] : [nivel, pr.titulo, pr.color];
    }
    // 👑 el dueño sale aunque no juegue el Pase: con su nivel de verdad (0 si no tiene) y todo lo que se ve desbloqueado
    const kd = this.claveDe(DUENO) || DUENO_K;
    if (kd && !out[kd]) {
      const pr = this.pasePremios(c, 0, DUENO);
      out[kd] = [0, pr.titulo, pr.color, 1, pr.marco, pr.emblema ? 1 : 0];
    }
    // 🏛️ EL SALÓN DEL PASE (Dlx, 06/10/2026: «4. B»): los que lo completaron, temporada por temporada y en el orden en
    // que llegaron. Por clave de perfil, como todo lo de acá: quien no tiene perfil no sale
    const salon = {};
    for (const h of this.sql.exec('SELECT quien, temp, t FROM pase_hito WHERE nivel = ? ORDER BY temp, t', c.niveles).toArray()) {
      const k = this.claveDe(h.quien);
      if (k) (salon[h.temp] = salon[h.temp] || []).push([k, h.t]);
    }
    return { t: Date.now(), n: out, cfg, salon, m: this.marcosPublicos() };
  }

  /**
   * 🖼️ El marco que lleva la carta de cada perfil: `{clave: [marco, estilo, serie]}`. El elegido si todavía lo tiene; si
   * no eligió, el mejor que tiene. `serie`: en qué orden entró al premium (el talón de la Temporada: «N.º 012»). Por
   * clave, nunca por cuenta
   */
  marcosPublicos() {
    const out = {};
    try {
      const tiene = {};
      const primera = {};
      for (const r of this.sql.exec('SELECT quien, marco, t FROM marcos ORDER BY t').toArray()) {
        (tiene[r.quien] = tiene[r.quien] || []).push(r.marco);
        if (!(r.quien in primera)) primera[r.quien] = Object.keys(primera).length + 1;
      }
      // 👑 el dueño los tiene todos
      if (this.marcosDueno().length) tiene[DUENO] = [...new Set([...(tiene[DUENO] || []), ...this.marcosDueno()])];
      if (tiene[DUENO] && !(DUENO in primera)) primera[DUENO] = 0;
      const elige = {};
      for (const r of this.sql.exec('SELECT quien, marco, estilo FROM marco_elige').toArray()) elige[r.quien] = r;
      for (const [quien, xs] of Object.entries(tiene)) {
        const k = this.claveDe(quien) || (quien === DUENO ? DUENO_K : '');
        if (!k) continue;
        const e = elige[quien];
        if (e && e.marco === 'ninguno') continue;
        const marco = e && xs.includes(e.marco) ? e.marco : mejorMarco(xs);
        out[k] = [marco, e ? e.estilo : 'camiseta', primera[quien]];
      }
    } catch (err) { /* sin marcos: las cartas salen como siempre */ }
    return out;
  }

  /**
   * 🏷️ EL INVENTARIO DE TAGS, DEL CICLO (`/avisos/tags-ciclo`, con su clave): `{temp, ganados: {clave: {carta: {tag:
   * [texto, temporada, ms]}}}}` (sólo los que se guardan: ♾️ para siempre y 📅 de temporada, ver `bot/tags_inventario.py`).
   * Se guarda entero y se contesta con lo que eligió cada uno: `{elegidos: {clave: {carta: tag}}}`
   */
  tagsCiclo(d) {
    const g = d && d.ganados;
    if (!g || typeof g !== 'object' || Array.isArray(g) || !/^[a-z0-9]{1,12}$/.test(String(d.temp || ''))) return { error: 'faltan datos' };
    this.guardar('tags_ganados', { temp: String(d.temp), t: Date.now(), g });
    const elegidos = {};
    for (const r of this.sql.exec('SELECT quien, carta, tag FROM tag_elige').toArray()) {
      const k = this.claveDe(r.quien) || (r.quien === DUENO ? DUENO_K : '');
      if (k) (elegidos[k] = elegidos[k] || {})[r.carta] = r.tag;
    }
    return { ok: true, elegidos };
  }

  /** 🏷️ Los títulos del Pase que tiene alguien (✨ edición limitada): los de la fila gratis hasta su nivel y, con el
   *  premium, los de la premium. El dueño, todos */
  titulosDe(quien) {
    const P = this.paseDatos();
    if (!P.cfg) return [];
    const nivel = quien === DUENO ? P.cfg.niveles || 30 : P.miembros.has(quien) ? this.paseNivel(quien, P.cfg) : 0;
    const filas = [...(P.cfg.premios || [])];
    if (this.pasePremium(quien, P.cfg.temp)) filas.push(...(P.cfg.premium || []));
    return [...new Set(filas.filter((p) => p[2] === 'titulo' && p[0] <= nivel).map((p) => String(p[3])))];
  }

  /** 🏷️ Tus TAGs (`/avisos/tags-mios`, con tu sesión): lo que ganó tu carta, tus títulos del Pase y lo que elegiste */
  tagsMios(quien) {
    if (!/^[0-9]{5,25}$/.test(quien)) return { error: 'faltan datos' };
    const k = this.claveDe(quien) || (quien === DUENO ? DUENO_K : '');
    const G = this.leer('tags_ganados') || {};
    const elegidos = {};
    for (const r of this.sql.exec('SELECT carta, tag FROM tag_elige WHERE quien = ?', quien).toArray()) elegidos[r.carta] = r.tag;
    return { k, temp: G.temp || '', ganados: (k && G.g && G.g[k]) || {}, titulos: this.titulosDe(quien), elegidos, dueno: quien === DUENO };
  }

  /** 🏷️ Elegir el TAG de una carta (`/avisos/tag-elige`, con tu sesión): uno que tengas, un título tuyo o `auto` */
  tagElige(d) {
    const quien = String(d.quien || ''), carta = String(d.carta || ''), tag = String(d.tag || '');
    if (!/^[0-9]{5,25}$/.test(quien) || !TAG_CARTAS.includes(carta) || !tag || tag.length > 60) return { error: 'faltan datos' };
    if (tag === 'auto') {
      this.sql.exec('DELETE FROM tag_elige WHERE quien = ? AND carta = ?', quien, carta);
      return Object.assign({ ok: true }, this.tagsMios(quien));
    }
    if (tag.startsWith('pase:')) {
      if (!this.titulosDe(quien).includes(tag.slice(5))) return { error: 'no lo tienes' };
    } else if (quien !== DUENO) {
      const yo = this.tagsMios(quien);
      if (!((yo.ganados || {})[carta] || {})[tag]) return { error: 'no lo tienes' };
    }
    this.sql.exec('INSERT INTO tag_elige (quien, carta, tag, t) VALUES (?, ?, ?, ?) ON CONFLICT(quien, carta) DO UPDATE SET ' +
      'tag = excluded.tag, t = excluded.t', quien, carta, tag, Date.now());
    return Object.assign({ ok: true }, this.tagsMios(quien));
  }

  /** 👑 los marcos del dueño: los tres de la temporada que corre */
  marcosDueno() {
    const P = this.paseDatos();
    return P.cfg && P.cfg.temp ? MARCOS.map((m) => P.cfg.temp + ':' + m) : [];
  }

  /** 🖼️ Tus marcos (`/avisos/marcos`, con tu sesión): los que tienes, cuál elegiste y el estilo de la Servidor */
  marcosDe(quien) {
    const tienes = this.sql.exec('SELECT marco, t FROM marcos WHERE quien = ? ORDER BY t', quien).toArray().map((r) => [r.marco, r.t]);
    // 👑 el dueño: los tres de la temporada que corre, aunque no los haya cobrado
    if (quien === DUENO) for (const m of this.marcosDueno()) if (!tienes.some((x) => x[0] === m)) tienes.push([m, 0]);
    const e = this.sql.exec('SELECT marco, estilo FROM marco_elige WHERE quien = ?', quien).toArray()[0];
    return { tienes, elegido: e ? e.marco : '', estilo: e ? e.estilo : 'camiseta', estilos: MARCO_ESTILOS };
  }

  /** 🖼️ Elegir tu marco y el estilo de la Servidor (`/avisos/marco-elige`): sólo uno que tengas, o «ninguno» */
  marcoElige(d) {
    const quien = String(d.quien || '');
    const marco = String(d.marco || ''), estilo = String(d.estilo || 'camiseta');
    if (!/^[0-9]{5,25}$/.test(quien) || !MARCO_ESTILOS.includes(estilo)) return { error: 'faltan datos' };
    if (marco && marco !== 'ninguno' && !(quien === DUENO && this.marcosDueno().includes(marco))
      && !this.sql.exec('SELECT 1 FROM marcos WHERE quien = ? AND marco = ?', quien, marco).toArray()[0]) {
      return { error: 'no lo tienes' };
    }
    this.sql.exec('INSERT INTO marco_elige (quien, marco, estilo, t) VALUES (?, ?, ?, ?) ON CONFLICT(quien) DO UPDATE SET ' +
      'marco = excluded.marco, estilo = excluded.estilo, t = excluded.t', quien, marco, estilo, Date.now());
    return Object.assign({ ok: true }, this.marcosDe(quien));
  }

  /** Una visita sin cuenta: el navegador avisa una vez por día. ⚠️ Con tope: es un número que cualquiera puede
   *  empujar, y un script no tiene que poder llevarlo a cualquier lado */
  visita() {
    this.sql.exec('INSERT INTO visitas (dia, n) VALUES (?, 1) ON CONFLICT(dia) DO UPDATE SET n = n + 1 WHERE n < 20000',
      diaET());
    return json({ ok: true });
  }

  /** 🧭 Algo del tutorial, de un navegador (ver `TUTO_EV`). Con tope por día, como la visita */
  tutorial(d) {
    const ev = d && typeof d.ev === 'string' ? d.ev : '';
    if (!TUTO_EV.has(ev)) return json({ error: 'faltan datos' }, 400);
    this.sql.exec('INSERT INTO tutorial (dia, ev, n) VALUES (?, ?, 1) ON CONFLICT(dia, ev) DO UPDATE SET n = n + 1 ' +
      'WHERE n < 5000', diaET(), ev);
    return json({ ok: true });
  }

  /** 🧭 Lo del tutorial de las dos últimas semanas, sumado: `{ev: n}`, y desde qué día se cuenta */
  tutorialResumen() {
    const out = {};
    for (const f of this.sql.exec('SELECT ev, SUM(n) AS n FROM tutorial WHERE dia > ? GROUP BY ev',
      diaET(Date.now() - 14 * DIA_MS)).toArray()) out[f.ev] = f.n;
    return { n: out, desde: (this.sql.exec('SELECT MIN(dia) AS d FROM tutorial').toArray()[0] || {}).d || null };
  }

  /** 📊 Una sección abierta, de un navegador (ver `SECC_EV`). Con tope por día, como la visita */
  seccion(d) {
    const s = d && typeof d.ev === 'string' ? d.ev : '';
    // 📊 y la página de cada servidor (`sv-FFA`), para el panel de su dueño (19/10/2026): sólo los que mide el ciclo,
    // o cualquiera podría llenar la tabla de nombres inventados
    const deUnSv = /^sv-[A-Z]{2,6}$/.test(s) && ((this.leer('tiers') || {}).servidores || []).some((x) => 'sv-' + x.sv === s);
    if (!SECC_EV.has(s) && !deUnSv) return json({ error: 'faltan datos' }, 400);
    this.sql.exec('INSERT INTO secciones (dia, s, n) VALUES (?, ?, 1) ON CONFLICT(dia, s) DO UPDATE SET n = n + 1 ' +
      'WHERE n < 20000', diaET(), s);
    return json({ ok: true });
  }

  /** 👆 Los toques de un navegador (ver `claveClic()`): se suman por día; una etiqueta nueva entra sólo si el día
   *  todavía no tiene `CLICS_MAX_K` distintas */
  /**
   * 👆 Los toques de la página. 🔴 JUNTADOS EN MEMORIA Y A LA BASE UNA VEZ POR MINUTO (pasada del 19/10/2026): cada
   * página manda los suyos cada tanto, y cada pedido eran hasta 40 filas escritas y 41 leídas; ahora la misma tecla de
   * cien personas en un minuto es UNA escritura. Lo vuelca el vigía (`clicsVolcar()`, también de madrugada), y el
   * Dashboard antes de leer. ⚠️ Si el objeto se reinicia, se pierde el último minuto de toques: es un conteo, no plata.
   */
  clics(d) {
    const dia = diaET();
    const buf = (this.clicsBuf = this.clicsBuf || new Map());
    const hoy = buf.get(dia) || new Map();
    buf.set(dia, hoy);
    for (const [k, v] of Object.entries((d && d.c) || {}).slice(0, 40)) {
      const kk = claveClic(k);
      if (!kk || !Number.isInteger(v) || v < 1 || v > 200) continue;
      if (!hoy.has(kk) && hoy.size >= CLICS_MAX_K) continue;
      hoy.set(kk, (hoy.get(kk) || 0) + v);
    }
    return json({ ok: true });
  }

  /**
   * 🐞 Un error de la página (19/10/2026). Como los toques: se junta en memoria y va a la base una vez por minuto
   * (`errVolcar()`), así una página rota que abren cien personas es una escritura y no cien.
   */
  errorPagina(d) {
    const e = errorValido(d);
    if (!e) return json({ error: 'faltan datos' }, 400);
    const buf = (this.errBuf = this.errBuf || new Map());
    const k = (e.donde + '|' + e.msg).slice(0, 260);
    const x = buf.get(k);
    if (x) { x.n++; x.ultimo = Date.now(); if (!x.f && e.f) x.f = e.f; }
    else if (buf.size < 50) buf.set(k, { ...e, n: 1, primero: Date.now(), ultimo: Date.now() });
    return json({ ok: true });
  }

  errVolcar() {
    const buf = this.errBuf;
    if (!buf || !buf.size) return;
    this.errBuf = new Map();
    const dia = diaET();
    let distintas = (this.sql.exec('SELECT COUNT(*) AS n FROM errores_pag WHERE dia = ?', dia).toArray()[0] || {}).n || 0;
    for (const [k, x] of buf) {
      const ya = this.sql.exec('SELECT n FROM errores_pag WHERE dia = ? AND k = ?', dia, k).toArray()[0];
      if (!ya && distintas >= ERRORES_DIA) continue;
      if (!ya) distintas++;
      this.sql.exec('INSERT INTO errores_pag (dia, k, donde, msg, f, tipo, n, primero, ultimo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
        "ON CONFLICT(dia, k) DO UPDATE SET n = min(n + excluded.n, 1000000), ultimo = excluded.ultimo, " +
        "f = CASE WHEN excluded.f != '' THEN excluded.f ELSE f END", dia, k, x.donde, x.msg, x.f || '', x.tipo || '',
      Math.min(x.n, 1000000), x.primero, x.ultimo);
    }
  }

  /**
   * 🐞 UN ERROR NUEVO DE LA PÁGINA, AL CANAL DE LOGS (Dlx, 19/10/2026: «dale», a «un aviso a Logs la primera vez que
   * se repite un error»). Hasta ahí sólo se veían en el Dashboard, y había que acordarse de abrirlo. «Se repite»: dos
   * veces o más en 7 días —una sola puede ser un navegador raro o una extensión—. Cada error UNA vez cada 30 días
   * (`errores_avisados`), hasta dos por vuelta. Lo llama el vigía despierto: de madrugada no sale nada, y nunca por DM.
   */
  async erroresAvisar(ahora) {
    this.errVolcar();
    const filas = this.sql.exec('SELECT k, donde, msg, MAX(f) AS f, SUM(n) AS n FROM errores_pag WHERE dia > ? ' +
      'GROUP BY k HAVING SUM(n) >= 2 ORDER BY MAX(ultimo) DESC LIMIT 20', diaET(ahora - 7 * DIA_MS)).toArray();
    let mandados = 0;
    for (const e of filas) {
      if (mandados >= 2) break;
      if (this.sql.exec('SELECT 1 AS x FROM errores_avisados WHERE k = ?', e.k).toArray().length) continue;
      this.sql.exec('INSERT OR IGNORE INTO errores_avisados (k, t) VALUES (?, ?)', e.k, ahora);
      mandados++;
      const limpio = (s) => String(s || '').replace(/`/g, "'").slice(0, 200);
      try {
        const r = await fetch(`${DC}/channels/${CANAL_LOGS}/messages`, {
          method: 'POST',
          headers: { Authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'User-Agent': UA, 'content-type': 'application/json' },
          body: JSON.stringify({
            content: `🐞 **Un error nuevo en la página** (${e.n} veces) · en \`${limpio(e.donde)}\`:\n\`${limpio(e.msg)}\`` +
              (e.f ? `\n\`${limpio(e.f)}\`` : '') + '\nSe ve en el Dashboard → Sistema.',
            allowed_mentions: { parse: [] },
          }),
        });
        if (r.status !== 200) this.guardar('ultimo_error', { t: ahora, ruta: 'errores-logs', error: 'mensaje ' + r.status });
      } catch (err) {
        this.guardar('ultimo_error', { t: ahora, ruta: 'errores-logs', error: String(err).slice(0, 120) });
      }
    }
    return mandados;
  }

  /** 🐞 Los errores de los últimos 7 días, del último al primero: `[{donde, msg, f, tipo, n, primero, ultimo, dias}]`. */
  erroresResumen() {
    this.errVolcar();
    return this.sql.exec('SELECT k, donde, msg, MAX(f) AS f, MAX(tipo) AS tipo, SUM(n) AS n, MIN(primero) AS primero, ' +
      'MAX(ultimo) AS ultimo, COUNT(*) AS dias FROM errores_pag WHERE dia > ? GROUP BY k ORDER BY ultimo DESC LIMIT 30',
    diaET(Date.now() - 7 * DIA_MS)).toArray().map(({ k, ...x }) => x);
  }

  /** 👆 Los toques juntados, a la base (con el mismo tope de teclas distintas por día que antes). */
  clicsVolcar() {
    const buf = this.clicsBuf;
    if (!buf || !buf.size) return;
    this.clicsBuf = new Map();
    for (const [dia, hoy] of buf) {
      let distintas = (this.sql.exec('SELECT COUNT(*) AS n FROM clics WHERE dia = ?', dia).toArray()[0] || {}).n || 0;
      for (const [kk, v] of hoy) {
        const ya = this.sql.exec('SELECT n FROM clics WHERE dia = ? AND k = ?', dia, kk).toArray()[0];
        if (!ya && distintas >= CLICS_MAX_K) continue;
        if (!ya) distintas++;
        this.sql.exec('INSERT INTO clics (dia, k, n) VALUES (?, ?, ?) ON CONFLICT(dia, k) DO UPDATE SET n = n + excluded.n ' +
          'WHERE n < 1000000', dia, kk, Math.min(v, 1000000));
      }
    }
  }

  /** 👆 Lo más tocado de los últimos 7 días, con los 7 anteriores al lado: `{k: [estos7, anteriores7]}` (las 80 más) */
  clicsResumen() {
    this.clicsVolcar();
    const desde = (n) => diaET(Date.now() - n * DIA_MS);
    const out = {};
    for (const [i, a, b] of [[0, 7, 0], [1, 14, 7]]) {
      for (const f of this.sql.exec('SELECT k, SUM(n) AS n FROM clics WHERE dia > ? AND dia <= ? GROUP BY k',
        desde(a), desde(b)).toArray()) (out[f.k] = out[f.k] || [0, 0])[i] = f.n;
    }
    const top = Object.entries(out).sort((x, y) => y[1][0] - x[1][0] || y[1][1] - x[1][1]).slice(0, 80);
    return { n: Object.fromEntries(top), desde: (this.sql.exec('SELECT MIN(dia) AS d FROM clics').toArray()[0] || {}).d || null };
  }

  /** 📊 Las secciones de los últimos 7 días y de los 7 anteriores, sumadas: `{s: [estos7, anteriores7]}`, y desde
   *  cuándo se cuenta */
  seccionesResumen() {
    const desde = (n) => diaET(Date.now() - n * DIA_MS);
    const out = {};
    for (const [i, a, b] of [[0, 7, 0], [1, 14, 7]]) {
      for (const f of this.sql.exec('SELECT s, SUM(n) AS n FROM secciones WHERE dia > ? AND dia <= ? GROUP BY s',
        desde(a), desde(b)).toArray()) (out[f.s] = out[f.s] || [0, 0])[i] = f.n;
    }
    return { n: out, desde: (this.sql.exec('SELECT MIN(dia) AS d FROM secciones').toArray()[0] || {}).d || null };
  }

  /** Cuántas personas distintas en los últimos 7 días (y los 7 anteriores, para comparar), y las visitas por día */
  usoResumen() {
    const desde = (n) => diaET(Date.now() - n * DIA_MS);
    const contar = (a, b, por) => this.sql.exec('SELECT COUNT(DISTINCT quien) AS n FROM uso WHERE dia > ? AND dia <= ?' +
      (por ? ' AND por = ?' : ''), ...[desde(a), desde(b)].concat(por ? [por] : [])).toArray()[0].n;
    const vis = (a, b) => this.sql.exec('SELECT COALESCE(SUM(n), 0) AS n, COUNT(*) AS d FROM visitas WHERE dia > ? AND dia <= ?',
      desde(a), desde(b)).toArray()[0];
    const v7 = vis(7, 0), v14 = vis(14, 7);
    return {
      semana: { bot: contar(7, 0, 'bot'), web: contar(7, 0, 'web'), personas: contar(7, 0, ''),
        visitas_dia: v7.d ? Math.round(v7.n / v7.d) : 0, dias: v7.d },
      anterior: { bot: contar(14, 7, 'bot'), web: contar(14, 7, 'web'), personas: contar(14, 7, ''),
        visitas_dia: v14.d ? Math.round(v14.n / v14.d) : 0, dias: v14.d },
      // desde cuándo se cuenta: el primer día con algo anotado
      desde: (this.sql.exec('SELECT MIN(dia) AS d FROM uso').toArray()[0] || {}).d || null,
    };
  }

  /** 📊 El uso por semana —de lunes a domingo, en hora del este— para comparar semanas en el Dashboard (Dlx, 18/10/2026:
   *  «comparar actividad, gente… con otras semanas»): `[{lunes, personas, bot, web, visitas, dias, k}]`, de la más vieja
   *  a la de ahora. `k` es lo mismo en los primeros días de esa semana —tantos como lleva la de ahora—, para comparar
   *  «a igual día» una semana que va por la mitad. Las personas se guardan `USO_DIAS` días: de una semana más vieja que
   *  eso quedan sólo las visitas (`personas: null`) */
  usoSemanas(ahora = Date.now()) {
    const hoy = diaET(ahora);
    const d0 = Date.parse(hoy + 'T12:00:00Z');
    const dow = (new Date(d0).getUTCDay() + 6) % 7;            // 0 = lunes
    const lunes0 = d0 - dow * DIA_MS;
    const ymd = (t) => new Date(t).toISOString().slice(0, 10);
    const corte = diaET(ahora - USO_DIAS * DIA_MS);
    const cuenta = (a, b) => {
      const v = this.sql.exec('SELECT COALESCE(SUM(n), 0) AS n, COUNT(*) AS d FROM visitas WHERE dia >= ? AND dia < ?', a, b).toArray()[0];
      const c = (por) => this.sql.exec('SELECT COUNT(DISTINCT quien) AS n FROM uso WHERE dia >= ? AND dia < ?' + (por ? ' AND por = ?' : ''),
        ...[a, b].concat(por ? [por] : [])).toArray()[0].n;
      const entera = a >= corte;
      return { personas: entera ? c('') : null, bot: entera ? c('bot') : null, web: entera ? c('web') : null, visitas: v.n, dias: v.d };
    };
    const out = [];
    for (let i = 11; i >= 0; i--) {
      const ini = lunes0 - i * 7 * DIA_MS;
      const x = cuenta(ymd(ini), ymd(ini + 7 * DIA_MS));
      if (!x.dias && !x.personas) continue;
      out.push(Object.assign({ lunes: ymd(ini) }, x, { k: cuenta(ymd(ini), ymd(ini + (dow + 1) * DIA_MS)) }));
    }
    return out;
  }

  /** ⚙️ Los ajustes del dueño, como están (ver `ajusteValido()`) */
  ajustes() {
    return this.leer('ajustes_dueno') || {};
  }

  /** ⚙️ Uno, ya validado por la ruta. `null` lo saca */
  ajuste(d) {
    // 📊 un «Deshacer» del Dashboard (`dashMedResumen()`)
    if (d && d.deshacer === true) this.dashMed('deshacer', 1);
    const a = this.ajustes();
    // 🕓 EL HISTORIAL (13/10/2026, Dlx a las ideas del Dashboard: «me gustan todas»): qué había antes de cada cambio, así
    // «Deshacer» lo vuelve a poner por el MISMO camino validado (`/avisos/dueno/ajuste`). Los 30 últimos; lo que no
    // cambió nada no se anota
    const antes = Object.prototype.hasOwnProperty.call(a, d.cual) ? a[d.cual] : null;
    const despues = d.valor === null || d.valor === undefined ? null : d.valor;
    if (JSON.stringify(antes) !== JSON.stringify(despues)) {
      const h = this.leer('ajustes_hist') || [];
      h.unshift({ cual: d.cual, antes, despues, t: Date.now(), por: this.nombrePor(d.por) });
      this.guardar('ajustes_hist', h.slice(0, 30));
    }
    if (d.valor === null || d.valor === undefined) delete a[d.cual];
    else a[d.cual] = d.valor;
    a._t = Date.now();
    this.guardar('ajustes_dueno', a);
    // y el historial, así el Dashboard lo muestra al toque, sin volver a pedir todo
    return { ok: true, ajustes: a, hist: this.leer('ajustes_hist') || [] };
  }

  /** 📣 El aviso de la página, si sigue vigente: `{texto, hasta}` o `null` */
  avisoWeb() {
    const a = this.ajustes().aviso_web;
    return a && Date.parse(a.hasta) > Date.now() ? { texto: a.texto, hasta: a.hasta } : null;
  }

  /** 🔔 ¿La campana está pausada? (el ajuste del Dashboard) */
  pausada() {
    return !!this.ajustes().campana_pausada;
  }

  /** 🔒 Lo del Dashboard del dueño: el uso (la semana y día por día) y cómo anda todo. Sólo lo pide `/avisos/dueno`,
   *  que ya comprobó que es Dlx. Números, nunca quién.
   *  🔴 SE LLAMABA `dueno()` Y EL VIGÍA LO PISABA: `vigilar()` guarda en `this.dueno` el Discord ID de Dlx, así
   *  que desde la primera vuelta del vigía en esa instancia —cada minuto— el Dashboard daba «this.dueno is not a
   *  function». Lo mostró el estado del vigía el 04/10/2026; lo vigila `avisos_prueba.mjs` (ningún método pisado) */
  panelDueno(d) {
    const ahora = Date.now();
    // 🔐 QUIÉN LO PIDE Y QUÉ PUEDE (13/10/2026). Sin roles es Dlx (las pruebas y los llamados de siempre). Admin ve todo;
    // Asistente y Moderador, sólo sus partes
    const roles = d && Array.isArray(d.roles) ? d.roles : ['owner'];
    const permisos = Object.keys(PERMISOS).filter((k) => puedeRol(roles, k));
    if (!roles.includes('owner') && !roles.includes('admin')) {
      const ve = (k) => permisos.includes(k);
      return { limitado: true, permisos, mis_roles: roles, yo: this.nombrePor(d && d.quien),
        reportes: ve('reportes') || ve('reportes_cerrar') ? this.reportesDueno(ahora) : [],
        reportes_causas: ve('reportes') || ve('reportes_cerrar') ? this.causasDueno(ahora) : [],
        decidir: ve('decidir') ? this.decidirDueno() : {}, videos: ve('videos') ? (this.leer('videos_revisar') || []) : [],
        fondos: ve('fondos') ? this.fondosDueno() : [], filtro: ve('fondos') ? this.filtroDueno() : null,
        fotos_carta: ve('fondos') ? this.fotosCartaDueno() : [],
        crews_logos: ve('fondos') ? CW.crewLogosDueno(this) : null,
        pedidos: ve('reportes') || ve('reportes_cerrar') ? this.pedidosDueno() : [],
        sanciones: this.sancionesActivas(ahora) };
    }
    const dias = [];
    for (let i = 13; i >= 0; i--) {
      const dia = diaET(ahora - i * DIA_MS);
      const c = (por) => this.sql.exec('SELECT COUNT(*) AS n FROM uso WHERE dia = ? AND por = ?', dia, por).toArray()[0].n;
      const v = this.sql.exec('SELECT n FROM visitas WHERE dia = ?', dia).toArray()[0];
      dias.push({ dia, bot: c('bot'), web: c('web'), visitas: v ? v.n : 0 });
    }
    const e = this.estado();
    return {
      uso: this.usoResumen(),
      // 📊 por semana, para «Comparar semanas» (Números)
      uso_semanas: this.usoSemanas(ahora),
      // 🤝 cómo viene trabajando cada servidor, para «Los tiers» (`bot/tiers.py`)
      tiers: this.leer('tiers'),
      // 👥 los números de las crews (`crewNumeros()` de bot/crews.js) y cuántos dueños abrieron su panel de socio
      crews_num: Object.assign(CW.crewNumeros(this, ahora), { paneles: this.panelesVistos(ahora) }),
      tutorial: this.tutorialResumen(),
      secciones: this.seccionesResumen(),
      clics: this.clicsResumen(),
      // 🐞 lo que se rompió en la página, los últimos 7 días (Sistema)
      errores_pag: this.erroresResumen(),
      ajustes: this.ajustes(),
      // 🕓 los últimos cambios de ajustes, con lo que había antes (ver `ajuste()`)
      ajustes_hist: this.leer('ajustes_hist') || [],
      // 🎤 el bot en vivo: el chat general de cada servidor, lo que pasó la última vez, y (lo llena la ruta) dónde lo
      // prendió cada admin
      chat: { generales: ((this.leer('canales') || {}).generales || []).map((x) => ({ sv: x.sv, g: x.g })),
        ultimo: this.leer('chat_vivo'), admin: {}, nivel: {}, niveles: NIVELES_CHAT,
        // 📅 los eventos de Discord de cada servidor en los últimos 7 días: cuántos se crearon y el último error
        evd: this.eventosDiscordEstado(ahora),
        // 🎛️ lo de siempre, para que el Dashboard lo muestre sin escribir los números (ver `apuestasCfg()`)
        def: { apuestas: { montos: AP_MONTOS, minutos: AP_CIERRA / MIN, tope: AP_TOPE },
          ritmo: { normal: CHAT_ENTRE / MIN, batalla: CHAT_ENTRE_TODO / MIN } } },
      // 🤝 los errores reportados en las llaves (los 10 últimos), con la clave de la página de quien lo mandó si se la
      // conoce. Las postulaciones de /sumate se fueron con la página (13/10/2026)
      // 📣 con qué decidió Dlx y qué hizo el ciclo (13/10/2026): ver `reportesDueno()`
      reportes: this.reportesDueno(ahora),
      reportes_causas: this.causasDueno(ahora),
      // 🔁 quién jugó una sola vez y quién se enfrió (`bot/primerizos.py`), y a quién ya se le avisó
      primerizos: this.leer('primerizos'),
      // 🗂️ las sanciones activas (`{k: hasta}`, 0 sin fecha): la página las marca al lado del nombre
      sanciones: this.sancionesActivas(ahora),
      // 📊 los números del propio Dashboard
      dash_med: this.dashMedResumen(ahora),
      // 💰 los Puntos de Tienda: qué entra, qué sale y quién tiene cuánto (`economiaDueno()`)
      economia: d && d.billetera ? this.economiaDueno(ahora, Number(d.billetera.desde) || 0, Number(d.billetera.inicial)) : null,
      vuelve: this.vuelveDueno(),
      // ✅ las preguntas de ✅ Decidir y lo contestado desde el Dashboard (13/10/2026)
      decidir: this.decidirDueno(),
      // 🔐 qué puede quien lo pide (Admin: todo menos Roles)
      permisos, mis_roles: roles, yo: this.nombrePor(d && d.quien),
      // 🏷️ los roles: el directorio, lo puesto a mano y el historial (13/10/2026)
      roles: this.rolesDueno(),
      // 🖼️ los fondos que esperan revisión (13/10/2026), y lo que hizo el filtro
      fondos: this.fondosDueno(),
      filtro: this.filtroDueno(),
      // 📸 las fotos de tarjeta que esperan revisión (13/10/2026)
      fotos_carta: this.fotosCartaDueno(),
      // 👥 los logos de las crews: los que esperan y los que el filtro aprobó hace poco (19/10/2026)
      crews_logos: CW.crewLogosDueno(this),
      // 🙋 los pedidos de la gente (17/10/2026)
      pedidos: this.pedidosDueno(),
      dias,
      sesiones: this.sql.exec('SELECT COUNT(DISTINCT quien) AS n FROM sesiones WHERE vence > ?', ahora).toArray()[0].n,
      sistema: {
        ok: e.ok, vigia: (this.leer('vigia') || {}).t || null, suscripciones: e.suscripciones, ultimas_24h: e.ultimas_24h,
        ultimo: e.ultimo, disparador: e.disparador, ultimo_error: e.ultimo_error,
        // ▶️ la última vez que Dlx corrió el ciclo a mano (ver `cicloAMano()`)
        ciclo_mano: this.leer('ciclo_mano'),
      },
      pase: this.paseResumen(),
      // 🎬 los videos que no entraron solos: `[id, rapero, título, link, por qué]`, para aprobar o no
      videos: this.leer('videos_revisar') || [],
    };
  }

  /** Un pedido a la API de GitHub sobre el repo del ciclo, con el token del Worker. ⚠️ GitHub rechaza sin User-Agent,
   *  con un 403 que no dice que el problema es el encabezado (ver el disparador del ciclo, en worker.js). */
  gh(ruta, opc) {
    return fetch(`https://api.github.com/repos/${this.env.GH_REPO}${ruta}`, {
      // ⏱️ con tope: el Dashboard lo espera, y con GitHub caído un pedido sin tope colgaba el panel entero
      signal: AbortSignal.timeout(8000),
      ...(opc || {}),
      headers: {
        'User-Agent': 'liga-global-bot', 'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${this.env.GH_TOKEN}`, 'Content-Type': 'application/json',
      },
    });
  }

  /**
   * ▶️ LAS ÚLTIMAS CORRIDAS DEL CICLO, para el Dashboard (05/10/2026): en cola, corriendo o cómo terminó. Ese día una
   * corrida estuvo 20 minutos «en cola» en GitHub sin que nada lo dijera. Un pedido por vez que Dlx abre el Dashboard.
   */
  async corridasCiclo() {
    if (!this.env.GH_TOKEN || !this.env.GH_REPO) return [];
    try {
      const r = await this.gh('/actions/workflows/ciclo.yml/runs?per_page=4');
      if (r.status !== 200) return [];
      return ((await r.json()).workflow_runs || []).map((w) => ({ estado: w.status || '', fin: w.conclusion || '',
        creada: w.created_at || '', empezo: w.run_started_at || '', toco: w.updated_at || '', url: w.html_url || '' }));
    } catch (e) {
      return [];
    }
  }

  /**
   * ⚠️ SI A GITHUB ACTIONS LE PASA ALGO, el Dashboard lo dice (05/10/2026: dos corridas seguidas se cancelaron a los
   * 15 minutos sin arrancar, con un incidente abierto en githubstatus.com). `null` si anda bien o no se sabe.
   */
  async githubActions() {
    try {
      const r = await fetch('https://www.githubstatus.com/api/v2/summary.json', { headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(4000) });
      if (r.status !== 200) return null;
      const d = await r.json();
      const c = (d.components || []).find((x) => x.name === 'Actions');
      if (!c || c.status === 'operational') return null;
      const inc = (d.incidents || []).find((i) => /actions/i.test(String(i.name || ''))) || null;
      return { estado: c.status, incidente: inc ? String(inc.name || '').slice(0, 120) : '', desde: inc ? inc.created_at : null };
    } catch (e) {
      return null;
    }
  }

  /**
   * ▶️ CORRER EL CICLO AHORA, desde el Dashboard (05/10/2026, Dlx: «añade otras opciones al dashboard que tú veas»). Es
   * el mismo `workflow_dispatch` que larga el cron del Worker cada media hora. 🛑 Una vez cada 10 minutos: dos corridas
   * seguidas se encolan (GitHub las pone una detrás de otra) y la segunda no cambia nada.
   */
  async cicloAMano(ahora) {
    const ult = this.leer('ciclo_mano') || {};
    const falta = 10 * MIN - (ahora - (ult.t || 0));
    if (ult.ok && falta > 0) return { error: 'espera', minutos: Math.ceil(falta / MIN) };
    if (!this.env.GH_TOKEN || !this.env.GH_REPO) return { error: 'sin el token de GitHub en el Worker' };
    let estado = 0;
    try {
      const r = await this.gh('/actions/workflows/ciclo.yml/dispatches', { method: 'POST', body: JSON.stringify({ ref: 'main' }) });
      estado = r.status;
    } catch (e) { estado = 0; }
    const v = { t: ahora, ok: estado === 204, estado };
    this.guardar('ciclo_mano', v);
    return v.ok ? v : { error: 'GitHub contestó ' + (estado || 'nada'), estado };
  }

  /**
   * 🎟️ EL PASE, EN NÚMEROS, para el Dashboard: cuántos miembros pueden jugarlo, cuántos ya tienen nivel y en cuál está
   * cada uno, y qué Tareas se hicieron esta semana. Sólo números: nunca quién.
   */
  paseResumen() {
    const P = this.paseDatos();
    if (!P.cfg) return null;
    const ahora = Date.now();
    const niveles = this.paseNiveles().niveles;
    const dist = {};
    for (const n of Object.values(niveles)) dist[n] = (dist[n] || 0) + 1;
    const sem = P.sem.find((s) => s[1] <= ahora && ahora < s[2]) || null;
    const c = P.cfg;
    const nombre = Object.fromEntries([].concat(c.diarias || [], c.semanales || [], c.temporada || []).map((t) => [t[0], t[1]]));
    const cuenta = (s) => this.sql.exec('SELECT tarea, COUNT(*) AS n FROM pase_hecho WHERE temp = ? AND sem = ? ' +
      'GROUP BY tarea ORDER BY n DESC', c.temp, s).toArray().map((f) => [nombre[f.tarea] || f.tarea, f.n]);
    // 📊 el tablero (25/10/2026, ver `pase_foto`): la foto de esta semana, si todavía no estaba. ⚠️ Todo lo del tablero
    // va en su `try`: si algo falla, el resto del Dashboard sale igual (sin las tres piezas nuevas)
    let fotos = [], trabados = {}, conVivo = 0, sinNadie = 0;
    try {
      if (sem) {
        this.sql.exec('INSERT OR IGNORE INTO pase_foto (temp, sem, dist, t) VALUES (?, ?, ?, ?)', c.temp, sem[0],
          JSON.stringify(dist), ahora);
      }
      fotos = this.sql.exec('SELECT sem, dist FROM pase_foto WHERE temp = ? ORDER BY sem', c.temp).toArray()
        .map((f) => { let x = {}; try { x = JSON.parse(f.dist); } catch (e) { x = {}; } return [f.sem, x]; });
      // quién está trabado y dónde: por nivel, cuántos no cumplen una Tarea hace 7 días o más
      const ultima = Object.fromEntries(this.sql.exec('SELECT quien, MAX(t) AS t FROM pase_hecho WHERE temp = ? GROUP BY quien',
        c.temp).toArray().map((f) => [String(f.quien), f.t]));
      for (const [q, n] of Object.entries(niveles)) {
        const x = trabados[n] || (trabados[n] = [0, 0]);
        x[0]++;
        if (!ultima[q] || ahora - ultima[q] >= 7 * DIA_MS) x[1]++;
      }
      // los días que la diaria tocó «mirar una llave en vivo» y nadie miró ninguna: casi seguro, un día sin evento
      // (aproximado: el Pase no sabe del calendario, sabe quién miró)
      const vivoDias = new Set(this.sql.exec("SELECT t FROM pase_log WHERE temp = ? AND que = 'vivo'", c.temp).toArray()
        .map((f) => diaET(f.t)));
      const ini = P.sem.length ? P.sem[0][1] : ahora;
      for (let t = ini; t <= ahora; t += DIA_MS) {
        const dia = diaET(t);
        if (!paseDelDia(c, dia).some((x) => x[3] === 'vivo')) continue;
        conVivo++;
        if (!vivoDias.has(dia)) sinNadie++;
      }
    } catch (e) { /* sin el tablero: el resto del resumen igual */ }
    return { temp: c.temp, niveles: c.niveles, miembros: P.miembros.size, con_nivel: Object.keys(niveles).length,
      dist, semana: sem ? sem[0] : '', hasta: sem ? sem[2] : null, tareas: sem ? cuenta(sem[0]) : [],
      hoy: cuenta('d:' + diaET(ahora)), temporada: cuenta('temp'), fotos, trabados, vivo: [conVivo, sinNadie],
      salon: this.sql.exec('SELECT COUNT(*) AS n FROM pase_hito WHERE temp = ? AND nivel = ?', c.temp, c.niveles).toArray()[0].n };
  }

  /**
   * 🔴 LO QUE ESTÁ EN VIVO, MIRADO DESDE EL DASHBOARD (05/10/2026). La llave de la DESGRACIAS EN TOKYO VOL 23 decía
   * «VOL 22» y no aparecía en la página: esto dice, de cada llave que se está tocando, a qué anuncio se juntó y cómo
   * (por nombre, o huérfana: ver `LlaveVivo.deEvento()`), en qué ronda va y qué dijo el bot en el chat.
   */
  async vivoDueno(ahora) {
    const filas = this.sql.exec('SELECT id, canal, sv, g, autor, pub, ed, texto FROM vivo WHERE ed > ?',
      ahora - 3 * HORA).toArray();
    if (!filas.length) return [];
    if (!globalThis.LlaveVivo) await import('./llave_vivo.js');
    const LV = globalThis.LlaveVivo;
    if (!LV) return [];
    const ls = [];
    for (const b of LV.unirPartidas(filas)) {
      try { const L = LV.aLlave(b); if (L) ls.push(L); } catch (e) { /* una que no se lee no tapa a las demás */ }
    }
    const anuncios = this.anunciosVistos(ahora, 36, 40).map((a) => ({ nombre: a.n, sv: a.sv, cuando: a.ini, link: a.url, mod: a.mod }));
    let asig = {};
    try { asig = LV.asignar(anuncios, ls).deLlave; } catch (err) { asig = {}; }
    const nombres = this.leer('nombres_vivo') || {};
    return ls.map((L) => {
      // el de la asignación (por nombre, o huérfana si el nombre no le daba), y si no, el que el bot ya le había dado
      let e = asig[L.id] || null, como = '';
      try { if (e) como = LV.porNombre(e, [L]) === L ? 'nombre' : 'huerfana'; } catch (err) { como = ''; }
      if (!e && nombres[L.id]) { e = { nombre: nombres[L.id].n }; como = 'guardado'; }
      const chat = this.sql.exec("SELECT COUNT(DISTINCT msg) AS n, MAX(t) AS t FROM chat_vivo WHERE llave = ? AND msg != ''",
        L.id).toArray()[0] || {};
      return { sv: L.sv || '', titulo: L.nombre || '', anuncio: e ? e.nombre : '', como, ronda: L.enJuego || '',
        terminada: !!L.terminada, gente: L.participantes || 0, ed: L.ed || L.pub || 0, link: (L.links || [])[0] || '',
        chat: { mensajes: chat.n || 0, t: chat.t || null } };
    });
  }

  estado() {
    const ahora = Date.now();
    const v = this.leer('vigia') || {};
    const c = this.leer('canales') || {};
    // ⚠️ SIN LO DE PRUEBA: ni los dispositivos de `probar_avisos.py` ni
    // sus simulacros. La página muestra «último aviso» y «N dispositivos»,
    // y un «PRUEBA DEL VIGIA» ahí sería mentirle a quien mira.
    const n = this.sql.exec("SELECT COUNT(*) AS n FROM subs WHERE svs != ?",
      '|' + SV_PRUEBA + '|').toArray()[0].n;
    const dia = this.sql.exec("SELECT COUNT(*) AS n, COALESCE(SUM(enviados), 0) AS e " +
      "FROM avisos WHERE creado > ? AND cuerpo != '{}' AND sv != ?",
    ahora - 24 * HORA, SV_PRUEBA).toArray()[0];
    const ult = this.sql.exec("SELECT id, sv, cuerpo, creado, estado, enviados, fallos " +
      "FROM avisos WHERE cuerpo != '{}' AND sv != ? ORDER BY creado DESC LIMIT 1",
    SV_PRUEBA).toArray()[0];
    let tit = '';
    try { tit = ult ? JSON.parse(ult.cuerpo).t || '' : ''; } catch (e) { tit = ''; }
    // ⚠️ EL ULTIMO ERROR SE MUESTRA, no sólo se guarda. Un error que se
    // anota donde nadie lo puede leer es un error callado con más pasos.
    const err = this.leer('ultimo_error');
    const fallo = this.leer('ultimo_fallo');
    // 🔑 POR SERVICIO DE PUSH, SIN UN SOLO ENDPOINT: cuántos de Google
    // (Chrome, Edge, Samsung, Opera), de Mozilla, de Apple, de Windows.
    // Nació con Opera GX, que se anota y no recibe: así se ve por dónde
    // entró cada navegador sin saber de quién es.
    const servicios = {};
    for (const r of this.sql.exec('SELECT endpoint FROM subs WHERE svs != ?',
      '|' + SV_PRUEBA + '|').toArray()) {
      let h = 'otro';
      try { h = new URL(r.endpoint).hostname; } catch (e) { h = 'otro'; }
      const k = /googleapis/.test(h) ? 'google' : /mozilla/.test(h) ? 'mozilla'
        : /apple/.test(h) ? 'apple' : /windows/.test(h) ? 'windows' : 'otro';
      servicios[k] = (servicios[k] || 0) + 1;
    }
    const post = this.sql.exec('SELECT hecho, msg, error, creado FROM posts ' +
      'ORDER BY creado DESC LIMIT 1').toArray()[0];
    // 🔑 LAS PRUEBAS, APARTE: cuántos dispositivos las reciben y cómo salió la
    // última. Sin esto, una prueba que no llega no deja rastro (25/09/2026).
    const conPrueba = this.sql.exec('SELECT COUNT(*) AS n FROM subs WHERE instr(svs, ?) > 0',
      '|' + SV_PRUEBA + '|').toArray()[0].n;
    const up = this.sql.exec('SELECT creado, estado, enviados, fallos FROM avisos ' +
      'WHERE sv = ? ORDER BY creado DESC LIMIT 1', SV_PRUEBA).toArray()[0];
    return {
      servicios,
      pruebas: {
        dispositivos: conPrueba,
        ultima: up ? { t: new Date(up.creado).toISOString(), estado: up.estado,
          enviados: up.enviados, fallos: up.fallos } : null,
      },
      ultima_republicacion: post ? { t: new Date(post.creado).toISOString(),
        ok: post.hecho === 1, error: post.error || '' } : null,
      ultimo_error: err ? { t: new Date(err.t).toISOString(), ruta: err.ruta, error: err.error } : null,
      ultimo_fallo: fallo ? { t: new Date(fallo.t).toISOString(), estados: fallo.estados,
        detalle: fallo.detalle || [] } : null,
      ok: !!v.t && ahora - v.t < 5 * MIN && !(v.errores || []).length,
      // 🔔 en pausa desde el Dashboard: la página lo dice, o la gente creería que se rompió
      pausada: this.pausada(),
      cron: CRON_VIGIA,
      // 🔑 EL DISPARADOR DEL CICLO: cuándo arrancó y cómo le fue al último
      // intento. Lo lee `bot/alertar.py`. Ver `marcarDisparo()`.
      disparador: {
        arranco: this.leer('disparo_arranco'),
        ultimo: this.leer('disparo_ultimo'),
      },
      // 🔑 el último chequeo de eventos cancelados y el de la llamada minuto a minuto (01/10/2026): cuándo, cuántos
      // pedidos y si falló, por qué. Ver `cancelaciones()` y `llamada()`
      cancelados: this.leer('cancelados'),
      llamada: this.leer('llamada'),
      // 📏 cuánto lee cada consulta, cada clave de KV y cada ruta (05/10/2026): sólo números. Ver el constructor
      medidas: this.medidasVer(),
      // 🎤 y el último minuto de «te toca»: cuántas llaves en vivo, a cuántos había que llamar, cuántos avisos
      // salieron, cuántos ya estaban en la llamada y cuántos no tienen la campana vinculada. Ver `turnos()`
      turnos: this.leer('turnos'),
      vigia: {
        t: v.t ? new Date(v.t).toISOString() : null,
        hace_s: v.t ? Math.round((ahora - v.t) / 1000) : null,
        leidos: v.leidos || 0, errores: v.errores || [], error: v.error || '',
        pausa: v.pausa ? new Date(v.pausa).toISOString() : null,
        // 🌙 de 3 a 11 AM ET duerme a propósito: late, pero no lee
        dormido: !!v.dormido,
        canales: (c.lista || []).map((x) => ({ sv: x.sv, svn: x.svn, nombre: x.nombre })),
        // los que el servidor no le deja leer al bot: no son una falla
        sin_leer: c.sin_leer || [],
      },
      suscripciones: n,
      // 🔑 los avisos de cada uno: cuántos dispositivos están vinculados a
      // una persona y cómo salió la última cola
      personales: this.estadoPersonales(),
      // 🔑 seguir raperos: cuántas filas, cuántos siguen y cómo salió el último reparto
      seguidos: this.estadoSeguidos(),
      // 👏 felicitar: cuántos aplausos, de cuántas personas, y cómo salió el último aviso
      aplausos: this.estadoAplausos(),
      ultimas_24h: { avisos: dia.n, enviados: dia.e },
      ultimo: ult ? {
        t: new Date(ult.creado).toISOString(), sv: ult.sv, titulo: tit,
        enviados: ult.enviados, fallos: ult.fallos,
        estado: ['pendiente', 'enviado', 'vencido'][ult.estado] || '',
      } : null,
    };
  }
}
