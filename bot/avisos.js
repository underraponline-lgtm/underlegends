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

export const CRON_VIGIA = '* * * * *';

const HUB = 'https://underlegends.pages.dev';
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
export const PATRON_VIGIA = /evento|competenc/i;
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
const CANALES_V = 10;

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
 */
export async function claveCiclo(token) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('lg-ciclo:' + String(token || '')));
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

/** El aviso: «¡Te toca!» (y «¡Te están llamando!» las veces siguientes) o «Sos el próximo», con la batalla y adónde
 *  ir (la llave, en Discord). */
export function cuerpoTurno(L, bat, tipo, n = 1) {
  const vs = bat.lados.join(' vs ');
  const evento = String((L && L.nombre) || 'la llave').slice(0, 60);
  return {
    v: 1, tipo: 'turno', id: (L && L.id) || '',
    t: (tipo !== 'ahora' ? '⏳ Sos el próximo · ' : n > 1 ? '🎤 ¡Te están llamando! · ' : '🎤 ¡Te toca! · ') + evento,
    b: tipo === 'ahora'
      ? `${vs} (${bat.r}). Entrá a la llamada: si no llegás, el organizador te reemplaza.`
      : `Después de la batalla que se está jugando: ${vs} (${bat.r}). Andá entrando a la llamada.`,
    url: ((L && L.links) || [])[0] || HUB + '/freestyle-rap/',
  };
}

/** La copia de `eventos-hoy` de un evento que se canceló (Dlx, 01/10/2026: «A», que la edite). Ver `mensajeRed()`. */
export function mensajeRedCancelado(c, por) {
  const seg = c.ini ? Math.floor(c.ini / 1000) : 0;
  const lineas = [`**${c.svn || c.sv}** · ${c.sv}`];
  if (seg) lineas.push(`~~Era <t:${seg}:t>~~`);
  lineas.push(por === 'editado' ? 'El servidor lo marcó como cancelado.' : 'El servidor borró el anuncio: el evento no se hace.');
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
        ...(por === 'editado' && c.url ? [{ type: 2, style: 5, label: 'Ir al anuncio', url: c.url }] : []),
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
export const STAFF = /staff|moderat|admin/i;

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
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ0-9]/.test(s)) return '';
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
  for (const l of limpio(texto).split(LINEAS)) {
    if (campoDe(l)) continue;
    if (ES_CAMPO.test(sinMd(l))) continue;
    const t = titulo(l);
    if (t) return t;
  }
  return '';
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

const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
function diaDe(texto) {
  const t = sinTildes(texto);
  for (let i = 0; i < DIAS_JS.length; i++) {
    if (new RegExp('\\b' + DIAS_JS[i] + '\\b').test(t)) return i;
  }
  return null;
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
  if (!b || !hm) return null;
  const cc = String.fromCharCode(b[1].codePointAt(0) - 0x1F1E6 + 65, b[2].codePointAt(0) - 0x1F1E6 + 65);
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
  // 🔑 un error en una llave (Dlx, 28/09/2026: «ok»): ver `validarReporte()` y `reportar()`
  '/avisos/reportar': 'POST',
  // 🔑 el precio por cabeza: ver `validarPrecio()`, `precio()` y `billetera()`
  '/avisos/precios': 'GET', '/avisos/precio': 'POST', '/avisos/billetera': 'POST',
  // 🔑 seguir raperos: ver `seguir()`, `sigo()`, `seguidores()` y `seguidos()`
  '/avisos/seguir': 'POST', '/avisos/sigo': 'POST', '/avisos/seguidores': 'GET',
  // 🔑 «tu servidor»: elegirlo en Mi cuenta, y cuál eligió cada perfil. Ver `miServidor()`
  '/avisos/mi-servidor': 'POST', '/avisos/servidores': 'GET',
  // 📊 una visita sin cuenta, una vez por día y por navegador (04/10/2026). Ver `visita()` del objeto
  '/avisos/visita': 'POST',
  // 🔒 el Dashboard del dueño (04/10/2026): ver `/avisos/dueno` en `rutaAvisos()`
  '/avisos/dueno': 'POST',
  // ⚙️ un ajuste del Dashboard (sólo Dlx) y los ajustes para el ciclo (con su clave)
  '/avisos/dueno/ajuste': 'POST', '/avisos/ajustes': 'GET',
  // 🙈 «ocultar mi foto»: en Mi cuenta → Privacidad. Ver `miFoto()`
  '/avisos/mi-foto': 'POST',
  // 👏 felicitar un logro de Publicaciones, y cuántos lleva cada uno: ver `validarAplauso()` y `aplaudir()`
  '/avisos/felicitar': 'POST', '/avisos/aplausos': 'GET',
  // 🔔 el panel de la campana: lo que se te avisó, con tu sesión. Ver `bandeja()`
  '/avisos/bandeja': 'POST',
  // 🤝 la postulación de /sumate, con tu sesión, al DM de Dlx. Ver `validarPostulacion()` y `postular()`
  '/avisos/sumate': 'POST',
  // 🔑 las inscripciones que guardó el vigía, para el ciclo: con `claveCiclo()`
  '/avisos/inscritos': 'GET',
};

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
  return { titulo: t.slice(0, 120), cuerpo: 'Tocá para ver quién te sigue.' };
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
      out.push({ pub, k, t, titulo, cuerpo: `Seguís a ${n} en la Liga · tocá para ver su perfil`.slice(0, 240),
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
export const APLAUDIBLES = { campeon: 1, rango: 1, caza: 1, sobrevivio: 1 };
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
        : x.tipo === 'sobrevivio' ? 'sobrevivir al Most Wanted' : '';
  return t.slice(0, 100);
}

/**
 * ¿Vale este aplauso? `{id, tipo, quien, ks, motivo, t}` —lo que el objeto
 * guarda de la publicación— si vale; `{error, estado}` si no. `items` es el
 * muro de KV, `id` el Discord ID que dijo Discord y `mios` sus perfiles (`d:`
 * y `dn:`). Pura, sin red: la prueba `bot/probar_local.mjs`.
 */
// ═════════════════════════════════════════════════════════════════════
// LA POSTULACIÓN DE /sumate
// ═════════════════════════════════════════════════════════════════════
//
// 🔑 Dlx, 03/10/2026, a «¿qué le pedís a un servidor?»: «hacer 1 evento a la semana como mínimo… y entre otras cosas
// que se discutirá conmigo… o incluso para hacerlo sencillo podríamos crear un ticket donde te envía el formulario a ti
// y me lo envías a mí por Discord». Un formulario en /sumate que le llega a Dlx por DM —el único DM que hace el bot es a
// él: `herramientas/sin_dm.py`—, con la sesión de Discord de quien la manda: así sabe quién escribió y le contesta.
//
// ⚠️ UNA POR PERSONA CADA 24 HORAS, y se guarda 90 días (`postulaciones`; `/borrar-mis-datos` la borra).
export const TIPOS_POSTULACION = { servidor: 'Servidor de freestyle', comunidad: 'Comunidad o creador',
  marca: 'Marca o patrocinador', otro: 'Otra cosa' };
const texto1 = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
export function validarPostulacion(d) {
  if (!d || typeof d !== 'object') return { error: 'faltan', que: 'Faltan los datos.' };
  const tipo = TIPOS_POSTULACION[d.tipo] ? d.tipo : '';
  if (!tipo) return { error: 'faltan', que: 'Elegí qué sos.' };
  const nombre = texto1(d.nombre, 80);
  if (nombre.length < 2) return { error: 'faltan', que: 'Falta el nombre.' };
  let link = texto1(d.link, 200);
  if (link && !/^https?:\/\/[^\s<>]+$/i.test(link)) return { error: 'faltan', que: 'El link tiene que empezar con https://' };
  const n = (v, max) => {
    const x = parseInt(String(v == null ? '' : v).replace(/[^\d]/g, ''), 10);
    return Number.isFinite(x) && x >= 0 ? Math.min(x, max) : null;
  };
  // el mensaje conserva sus saltos de línea (hasta 1000 caracteres), sin el resto de los caracteres de control
  const mensaje = String(d.mensaje == null ? '' : d.mensaje).replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 1000);
  return { tipo, nombre, link, miembros: n(d.miembros, 10000000), eventos: tipo === 'servidor' ? n(d.eventos, 50) : null, mensaje };
}
/** El DM a Dlx con una postulación. Sin menciones que suenen (`allowed_mentions` vacío en el envío). */
export function mensajePostulacion(p, quien, nombreDc) {
  // ⚠️ lo que escribió otro va sin Markdown: un «[link](…)» en el nombre se vería como otro link (revisión del 03/10/2026)
  const sinMd = (t) => String(t || '').replace(/([\\`*_~|[\]()<>#])/g, '\\$1');
  const cita = (t) => sinMd(t).split('\n').map((l) => '> ' + l).join('\n');
  const l = [`🤝 **Postulación desde /sumate** · ${TIPOS_POSTULACION[p.tipo] || p.tipo}`, `**Nombre:** ${sinMd(p.nombre)}`];
  if (p.link) l.push(`**Link:** <${p.link}>`);
  const nums = [p.miembros != null ? `**Son:** ${p.miembros.toLocaleString('es-AR')}` : '',
    p.eventos != null ? `**Eventos por semana:** ${p.eventos}` : ''].filter(Boolean);
  if (nums.length) l.push(nums.join(' · '));
  l.push(`**Quién:** <@${quien}>${nombreDc ? ' · su perfil: ' + nombreDc : ''}`);
  if (p.mensaje) l.push(cita(p.mensaje));
  return l.join('\n').slice(0, 1900);
}

export function validarAplauso(items, d, id, mios, ahora) {
  const x = (Array.isArray(items) ? items : []).find((it) => it && it.id === (d && d.id));
  if (!x) return { error: 'no_existe', estado: 404 };
  if (!APLAUDIBLES[x.tipo]) return { error: 'no_se_felicita', estado: 400 };
  const creada = creadaEn(id);
  if (!creada || ahora - creada < EDAD_MIN_DIAS * DIA_MS) {
    return { error: 'nueva', estado: 403, desde: new Date(creada + EDAD_MIN_DIAS * DIA_MS).toISOString() };
  }
  const ks = Array.isArray(x.ks) ? x.ks.map((k) => (claveValida(k) ? k : '')) : [];
  if ((mios || []).some((k) => k && ks.indexOf(k) >= 0)) return { error: 'vos', estado: 403 };
  return { id: x.id, tipo: x.tipo, quien: (x.quien || []).slice(0, 8).map((n) => String(n).slice(0, 60)),
    ks: ks.slice(0, 8), motivo: motivoAplauso(x), t: String(x.t || '').slice(0, 30) };
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
    cuerpo: (motivo ? `Por ${motivo}. ` : '') + 'Tocá para verlo en Publicaciones.',
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
  if (e.tipo === 'elegido' && ((defs.yo || {})[id] || '') === d.op) return { error: 'vos', estado: 403 };
  return { enc: e.id, op: d.op };
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
};
//: cuántos reportes puede mandar una persona en 24 h
export const REPORTE_TOPE = 5;
//: cuántos viajan en la cola de KV para el ciclo
const REPORTES_COLA = 50;

/**
 * ¿Vale este reporte? `{llave, que, texto, batalla}` si vale, `{error, estado}`
 * si no. `llave` es el número del evento, o `v:<mensaje>` para una llave en
 * vivo que todavía no tiene número. Pura, sin red: `bot/probar_local.mjs`.
 */
export function validarReporte(d, id, ahora) {
  const llave = String((d && d.llave) || '');
  if (!/^(\d{1,6}|v:\d{15,22})$/.test(llave)) return { error: 'llave', estado: 400 };
  const que = String((d && d.que) || '');
  if (!Object.prototype.hasOwnProperty.call(QUE_REPORTE, que)) return { error: 'que', estado: 400 };
  const texto = String((d && d.texto) || '').replace(/\s+/g, ' ').trim();
  if (texto.length > 300) return { error: 'largo', estado: 413 };
  // «otra cosa» sin decir qué no se puede revisar
  if (que === 'otro' && texto.length < 3) return { error: 'texto', estado: 400 };
  const batalla = String((d && d.batalla) || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const creada = creadaEn(id);
  if (!creada || ahora - creada < EDAD_MIN_DIAS * DIA_MS) {
    return { error: 'nueva', estado: 403, desde: new Date(creada + EDAD_MIN_DIAS * DIA_MS).toISOString() };
  }
  return { llave, que, texto, batalla };
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
  if (((cfg.yo || {})[id] || '') === d.cabeza) return { error: 'vos', estado: 403 };
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
// ⚙️ LOS AJUSTES DEL DASHBOARD (Dlx, 04/10/2026: «todo y muchas más cosas»): lo que sólo cambia el dueño. Viven en el
// objeto (`ajustes()`), los escribe `/avisos/dueno/ajuste` (sólo Dlx) y los leen el vigía, el ciclo (`/avisos/ajustes`,
// con su clave) y la página (sólo el aviso, adentro de `/avisos/vivo`)
//   campana_pausada   bool: no sale ningún aviso (los de eventos de ese rato se descartan; los personales esperan)
//   multiplicadores   {semana, sv: {SV: factor}}: los de la semana a mano, encima del sorteo (los aplica el ciclo)
//   aviso_web         {texto, hasta}: un aviso arriba de la página, para todos, hasta esa hora. Viaja con `/vivo`,
//                     que la página ya pide al abrir y cada pocos minutos: no suma ningún pedido
//   en_vivo           {SV: bool}: el bot en el chat de cada servidor durante un evento (llega con esa función)
export const FACTORES = [0.5, 1, 1.5, 2, 3, 5];
export function ajusteValido(cual, valor) {
  if (cual === 'campana_pausada') return typeof valor === 'boolean' ? valor : undefined;
  if (cual === 'multiplicadores') {
    if (valor === null) return null;
    if (!valor || typeof valor !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(String(valor.semana || ''))) return undefined;
    const sv = {};
    for (const [k, f] of Object.entries(valor.sv || {})) {
      // los de `FACTORES` y también el que ya tenía la semana (×2,25 con la guerra): de ×0,5 a ×5, hasta 3 decimales
      const x = Number(f);
      if (!/^[A-Z]{2,5}$/.test(k) || !(x >= 0.5 && x <= 5) || Math.abs(Math.round(x * 1000) - x * 1000) > 1e-6) return undefined;
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
    if (!valor || typeof valor !== 'object') return undefined;
    const out = {};
    for (const [k, v] of Object.entries(valor)) {
      if (!/^[A-Z]{2,5}$/.test(k) || typeof v !== 'boolean') return undefined;
      out[k] = v;
    }
    return out;
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
async function quienPide(req, env, d) {
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
  const s = String(texto || '').normalize('NFKD');
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
  return /(filtros?|clasificatoria|octavos|cuartos|semi|final)/i.test(s) &&
    (s.match(/🆚|\bvs\b|<a?:\w*vs\w*:\d+>|⌝|\]|」|〉/gi) || []).length >= 2;
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
  if (!env.AVISOS) return json({ error: 'los avisos todavía no están enchufados' }, 503);
  // 🔒 EL DASHBOARD DEL DUEÑO (Dlx, 04/10/2026: «una página nueva creada sólo para el owner… la única manera de iniciar
  // sesión ahí es con mi cuenta»). Quién es lo dice Discord o la sesión —nunca la página—, y si no es Dlx no se
  // contesta nada: ni qué habría. El 403 queda en los registros
  // ⚙️ UN AJUSTE DEL DASHBOARD: la misma puerta que el Dashboard, y el valor se valida antes de llegar al objeto
  if (ruta === '/avisos/dueno/ajuste') {
    const crudo = await req.text();
    if (crudo.length > 2048) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || (d.token && !/^[A-Za-z0-9._-]{10,300}$/.test(String(d.token)))) {
      return json({ error: 'faltan datos' }, 400);
    }
    const q = await quienPide(req, env, d);
    if (!q.id) return json({ error: q.error }, q.estado);
    if (q.id !== DUENO) {
      console.warn('[seguridad] un ajuste del Dashboard lo pidió alguien que no es el dueño');
      return json({ error: 'no' }, 403);
    }
    const v = ajusteValido(String(d.cual || ''), d.valor);
    if (v === undefined) return json({ error: 'valor' }, 400);
    return elObjeto(env).fetch('https://avisos/ajuste', {
      method: 'POST', body: JSON.stringify({ cual: d.cual, valor: v }), headers: { 'content-type': 'application/json' },
    });
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
    if (q.id !== DUENO) {
      console.warn('[seguridad] el Dashboard lo pidió alguien que no es el dueño');
      return json({ error: 'no' }, 403);
    }
    return elObjeto(env).fetch('https://avisos/dueno', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } });
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
    return elObjeto(env).fetch('https://avisos' + ruta.slice('/avisos'.length), {
      method: 'POST', body: JSON.stringify({ quien: q.id, de: claveValida(de) ? de : '', a: as, si: d.si !== false }),
      headers: { 'content-type': 'application/json' },
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
        (d.sv !== undefined && !/^[A-Z]{2,5}$/.test(String(d.sv)))) return json({ error: 'faltan datos' }, 400);
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
  // 🤝 LA POSTULACIÓN DE /sumate: validada acá, con quién la manda (su sesión), y al objeto, que se la manda a Dlx
  if (ruta === '/avisos/sumate') {
    const crudo = await req.text();
    if (crudo.length > 4096) return json({ error: 'demasiado grande' }, 413);
    let d = null;
    try { d = JSON.parse(crudo || '{}'); } catch (e) { d = null; }
    const v = validarPostulacion(d);
    if (v.error) return json(v, 400);
    const q = await quienPide(req, env, d || {});
    if (!q.id) return json({ error: q.error }, q.estado);
    // ⚠️ es el único camino de un desconocido al DM de Dlx: con la misma antigüedad que votar o felicitar, o una
    // cuenta recién hecha por persona y por día era un DM más (revisión del 03/10/2026)
    const creada = creadaEn(q.id);
    if (!creada || Date.now() - creada < EDAD_MIN_DIAS * DIA_MS) return json({ error: 'nueva' }, 403);
    return elObjeto(env).fetch('https://avisos/sumate', {
      method: 'POST', body: JSON.stringify({ quien: q.id, p: v }), headers: { 'content-type': 'application/json' },
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
export async function olvidarAvisos(env, quien) {
  if (!env.AVISOS || !/^[0-9]{5,25}$/.test(String(quien || ''))) return null;
  try {
    const r = await elObjeto(env).fetch('https://avisos/olvidar', {
      method: 'POST', body: JSON.stringify({ quien: String(quien) }),
      headers: { 'content-type': 'application/json' },
    });
    return r.ok ? (await r.json()).soltados : null;
  } catch (e) {
    return null;
  }
}

export async function vigilar(env, servidores, dueno, dormido) {
  if (!env.AVISOS) return;
  await elObjeto(env).fetch('https://avisos/vigilar', {
    method: 'POST', body: JSON.stringify({ servidores, dueno: dueno || '', dormido: !!dormido }),
    headers: { 'content-type': 'application/json' },
  });
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
    this.sql = state.storage.sql;
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
      // 🔑 LAS ENCUESTAS (27/09/2026): un voto por Discord ID y por encuesta,
      // que se cambia hasta que cierra. Ver `validarVoto()` y `votar()`.
      this.sql.exec('CREATE TABLE IF NOT EXISTS votos (enc TEXT NOT NULL, quien TEXT NOT NULL, ' +
        'op TEXT NOT NULL, t INTEGER NOT NULL, PRIMARY KEY (enc, quien))');
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
      // 🔑 SEGUIR RAPEROS (28/09/2026): quién (Discord ID) sigue a qué perfil
      // (la clave de `#/r/`), desde cuándo, cuál es su propio perfil (`de`,
      // para no avisarle de sí mismo) y cuándo se creó su cuenta de Discord
      // (`creada`: las de menos de 30 días siguen, pero no cuentan). Ver `seguir()`.
      this.sql.exec('CREATE TABLE IF NOT EXISTS sigue (quien TEXT NOT NULL, a TEXT NOT NULL, ' +
        "t INTEGER NOT NULL, de TEXT NOT NULL DEFAULT '', creada INTEGER NOT NULL DEFAULT 0, " +
        'PRIMARY KEY (quien, a))');
      this.sql.exec('CREATE INDEX IF NOT EXISTS sigue_a ON sigue (a)');
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
      // 🔑 LOS EVENTOS CANCELADOS (01/10/2026): ver `cancelado()` y `cancelaciones()`
      this.sql.exec('CREATE TABLE IF NOT EXISTS cancelados (id TEXT PRIMARY KEY, sv TEXT NOT NULL, ' +
        "cuerpo TEXT NOT NULL, t INTEGER NOT NULL, por TEXT NOT NULL DEFAULT '')");
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
      // 🤝 las postulaciones de /sumate: 90 días (ver `postular()`)
      this.sql.exec('CREATE TABLE IF NOT EXISTS postulaciones (id INTEGER PRIMARY KEY AUTOINCREMENT, quien TEXT NOT NULL, ' +
        "t INTEGER NOT NULL, datos TEXT NOT NULL, enviada INTEGER NOT NULL DEFAULT 0, error TEXT NOT NULL DEFAULT '')");
    });
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

  async fetch(req) {
    const ruta = new URL(req.url).pathname;
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
      if (ruta === '/precios') return json(this.precios(), 200, 20);
      if (ruta === '/seguidores') return json(this.seguidores(), 200, 60);
      if (ruta === '/servidores') return json(this.servidoresElegidos(), 200, 60);
      if (ruta === '/aplausos') return json(this.aplausosCuenta(), 200, 20);
      if (ruta === '/inscritos') return json(this.inscritosLista(), 200, 0);
      const d = await req.json().catch(() => null);
      if (!d) return json({ error: 'no es JSON' }, 400);
      if (ruta === '/alta') return await this.alta(d);
      if (ruta === '/baja') return this.baja(d);
      if (ruta === '/probar') return this.probar(d);
      if (ruta === '/simular') return this.simular();
      if (ruta === '/vincular') return this.vincular(d);
      if (ruta === '/desvincular') return this.desvincular(d);
      if (ruta === '/olvidar') return await this.olvidar(d);
      if (ruta === '/reportar') return await this.reportar(d);
      if (ruta === '/votar') return this.votar(d);
      if (ruta === '/seguir') return this.seguir(d);
      if (ruta === '/sigo') return this.sigo(d);
      if (ruta === '/aplaudir') return this.aplaudir(d);
      if (ruta === '/bandeja') return this.bandeja(d);
      if (ruta === '/sumate') return await this.postular(d);
      if (ruta === '/mi-servidor') return this.miServidor(d);
      if (ruta === '/mi-foto') return await this.miFoto(d);
      if (ruta.startsWith('/sesion/')) return await this.sesion(ruta, d);
      if (ruta === '/uso') return this.usoAnotar(d);
      if (ruta === '/visita') return this.visita();
      if (ruta === '/dueno') return json(this.dueno());
      if (ruta === '/precio') return this.precio(d);
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
        if (STAFF.test(n) || PATRON_INSC.test(n) || !PATRON_VIGIA.test(n)) continue;
        lista.push({ id: c.id, nombre: n, sv: s.sv, svn: s.nombre || s.sv, g: s.guild, p: String(c.parent_id || '') });
      }
    }
    const canales = { t: ahora, v: CANALES_V, yo, lista, veredictos: ver, inscripciones: insc,
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
  async vigilar(d) {
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
    this.yo = canales.yo || '';
    this.dueno = (d && d.dueno) || '';
    // guardado, para lo que llega por una ruta y no por el vigía (la postulación de /sumate): ver `postular()`
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
      // 🎙️ y quién está en la llamada, minuto a minuto. Nunca frena al vigía: ver `llamada()`
      try { await this.llamada(ahora); } catch (e) {
        this.guardar('llamada', { ...(this.leer('llamada') || {}), error: String(e).slice(0, 160) });
      }
      // 🎤 y a quién le toca. Nunca frena al vigía: ver `turnos()`
      try { await this.turnos(ahora); } catch (e) {
        this.guardar('turnos', { t: ahora, error: String(e).slice(0, 160) });
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
      this.sql.exec('DELETE FROM claves WHERE t < ?', ahora - 2 * 24 * HORA);
      this.sql.exec('DELETE FROM repetidos WHERE t < ?', ahora - 2 * 24 * HORA);
      this.sql.exec('DELETE FROM posts WHERE creado < ?', ahora - 7 * 24 * HORA);
      // 👏 los aplausos, con su publicación: para entonces ya salió del muro (21 días)
      const viejo = ahora - APLAUSOS_DIAS * DIA_MS;
      this.sql.exec('DELETE FROM aplausos WHERE t < ? OR id IN (SELECT id FROM aplaudidas WHERE primero < ?)', viejo, viejo);
      this.sql.exec('DELETE FROM aplaudidas WHERE primero < ?', viejo);
      // 🔔 y la bandeja de cada uno: 30 días
      this.sql.exec('DELETE FROM bandeja WHERE t < ?', viejo);
      // 🤝 y las postulaciones de /sumate: 90 días
      this.sql.exec('DELETE FROM postulaciones WHERE t < ?', ahora - 90 * DIA_MS);
      // 📊 el uso: quién, `USO_DIAS` días; las visitas (sólo un número por día), 90
      this.sql.exec('DELETE FROM uso WHERE dia < ?', diaET(ahora - USO_DIAS * DIA_MS));
      this.sql.exec('DELETE FROM visitas WHERE dia < ?', diaET(ahora - 90 * DIA_MS));
      // 🔴 y los dispositivos que nunca recibieron nada y fallaron cinco veces (revisión del 03/10/2026): sólo 404 y
      // 410 borran al momento (ver `MUERTA`), así que uno inventado con un servicio que no resuelve quedaba para
      // siempre ocupando lugar en el tope y recibiendo cada evento. Uno de verdad recibe la de prueba al anotarse
      this.sql.exec('DELETE FROM subs WHERE enviados = 0 AND fallos >= 5 AND prueba = 0');
      // 🔢 y los contadores de cambios de días que ya pasaron
      this.sql.exec('DELETE FROM cambios_dia WHERE dia < ?', new Date(ahora - DIA_MS).toISOString().slice(0, 10));
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
    // 🔑 el precio por cabeza: lo que el ciclo resolvió (cazado o devuelto),
    // cada cinco minutos. Nunca frena al vigía: ver `resolverPrecios()`
    if (Math.floor(ahora / MIN) % 5 === 0) {
      try { await this.resolverPrecios(ahora); } catch (e) {
        this.guardar('precios_error', { t: ahora, error: String(e).slice(0, 120) });
      }
    }
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
        if (!pareceLlave(texto)) continue;
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
    // 📣 Y LOS EVENTOS QUE EL VIGÍA YA VIO ANUNCIAR (03/10/2026, Dlx: «se ha anunciado el evento y no se ve en
    // inicio»). El payload los trae recién en la corrida siguiente del ciclo —hasta 30 min, y la mayoría de los
    // eventos se anuncian con 15 min o menos—: DESGRACIAS EN TOKYO VOL 21 se avisó al teléfono a las 3:59 PM y el
    // Inicio no lo tenía. La página los suma a «próximos» mientras el payload no los traiga (`Liga.proximos()`).
    // Sólo los de verdad: ni los descartados (estado 2), ni el recordatorio (`:antes`), ni pruebas ni cancelaciones
    anuncios: this.sql.exec("SELECT id, cuerpo FROM avisos WHERE creado > ? AND estado != 2 AND instr(id, ':') = 0 " +
      'ORDER BY creado DESC LIMIT 12', ahora - 24 * HORA).toArray().map((r) => {
      let c = {};
      try { c = JSON.parse(r.cuerpo) || {}; } catch (e) { c = {}; }
      return c.tipo === 'evento' && c.sv !== SV_PRUEBA && c.t ? { id: r.id, sv: c.sv, n: c.t, ini: c.ini || null,
        mod: c.mod || '', cup: c.cup || '', pre: c.pre || '', url: c.url || '', cx: c.cx ? 1 : 0 } : null;
    }).filter(Boolean),
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
      try { n = String((JSON.parse((await this.env.KV.get('p:' + a)) || '{}') || {}).n || ''); } catch (e) { n = ''; }
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
    const gh = (ruta, opc) => fetch(`https://api.github.com/repos/${this.env.GH_REPO}${ruta}`, {
      ...(opc || {}),
      headers: {
        // ⚠️ GitHub rechaza sin User-Agent (ver el disparador del ciclo, en worker.js)
        'User-Agent': 'liga-global-bot', 'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${this.env.GH_TOKEN}`, 'Content-Type': 'application/json',
      },
    });
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
    const filas = this.sql.exec("SELECT id, sv, cuerpo, estado, cursor, creado FROM avisos WHERE estado IN (0, 1) " +
      "AND creado > ? AND instr(id, ':') = 0", ahora - 2 * 24 * HORA).toArray();
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
      if (!p || pedidos >= CANCELA_TOPE) continue;
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
      const por = cancelado(estado, m, c, f.creado);
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
        this.sql.exec('UPDATE avisos SET estado = 2 WHERE (id = ? OR id = ?) AND estado = 0', f.id, f.id + ':antes');
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
    if (!a) return descartar();
    const ini = momentoMs(a.horario, m.timestamp, a.fecha);
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
        'abrí ahí <https://underlegends.pages.dev/freestyle-rap/avisos> y tocá «Mandar una de ' +
        'prueba»: te dice si es el navegador o el sistema.'
      : `🧪 Leí tu «${p.texto}» en ${donde} (${hora}), pero **ningún dispositivo tiene ` +
        '🧪 Pruebas** marcado, así que no se la mandé a nadie. En cada dispositivo abrí ' +
        '<https://underlegends.pages.dev/freestyle-rap/avisos>, tocá «🧪 Pruebas» y volvé a escribir ' +
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
    // 🔔 CON LA CAMPANA PAUSADA (el Dashboard), el aviso se descarta: dejarlo pendiente haría que la alarma lo vuelva a
    // tomar al instante, para siempre. Uno de un evento que empieza en un rato ya no sirve después
    if (this.pausada()) {
      this.sql.exec('UPDATE avisos SET estado = 2 WHERE id = ?', av.id);
      return;
    }
    // 🔴 VENCIDO NO SE MANDA. Si el Worker estuvo caído y el evento ya
    // empezó, el aviso se descarta en vez de llegar tarde.
    if (ahora > av.hasta) {
      this.sql.exec('UPDATE avisos SET estado = 2 WHERE id = ?', av.id);
      return;
    }
    // el «cancelado» sólo a quien le llegó el aviso del evento (`hs`, ver `cancelaciones()`)
    let tope = Number.MAX_SAFE_INTEGER;
    if (String(av.id).startsWith('cx:')) {
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
  /** 🤝 La postulación de /sumate: una por persona cada 24 horas, guardada 90 días y al DM de Dlx. Ver `validarPostulacion()`. */
  async postular(d) {
    const quien = String((d && d.quien) || '');
    if (!/^[0-9]{5,25}$/.test(quien) || !d.p) return json({ error: 'faltan' }, 400);
    const ahora = Date.now();
    // 🔴 SÓLO CUENTAN LAS QUE LLEGARON (revisión del 03/10/2026): si el DM fallaba, la que no llegó trababa el reintento
    // 24 horas y la página decía «Dlx la tiene»
    // ⚠️ Y LAS QUE ESTÁN SALIENDO: el objeto atiende otros pedidos mientras espera a Discord, así que N pedidos juntos
    // pasaban los dos topes y le llegaban N DMs a Dlx (revisión del 04/10/2026). Una en curso (sin error todavía, de
    // hace menos de dos minutos) cuenta como mandada
    const cuenta = "(enviada = 1 OR (enviada = 0 AND error = '' AND t > " + (ahora - 2 * MIN) + '))';
    if (this.sql.exec('SELECT 1 FROM postulaciones WHERE quien = ? AND t > ? AND ' + cuenta, quien, ahora - 24 * HORA).toArray().length) {
      return json({ error: 'ya' }, 429);
    }
    // y un tope para todos: veinte DMs por día a Dlx como mucho (un día así es raro; lo demás, por @itsdlx)
    if (this.sql.exec('SELECT COUNT(*) AS n FROM postulaciones WHERE t > ? AND ' + cuenta, ahora - 24 * HORA).toArray()[0].n >= 20) {
      return json({ error: 'muchas' }, 429);
    }
    const id = this.sql.exec('INSERT INTO postulaciones (quien, t, datos) VALUES (?, ?, ?) RETURNING id',
      quien, ahora, JSON.stringify(d.p)).toArray()[0].id;
    // el nombre de Discord de quien la manda, si ya entró alguna vez (lo guarda `idk`): para que Dlx lo reconozca
    let nombreDc = '';
    try { nombreDc = ((this.sql.exec('SELECT k FROM idk WHERE id = ?', quien).toArray()[0] || {}).k) || ''; } catch (e) { nombreDc = ''; }
    this.dueno = this.dueno || this.leer('dueno') || '';
    let error = '';
    if (!this.dueno || !this.env.DISCORD_TOKEN) error = 'sin dueño';
    else {
      const h = { Authorization: 'Bot ' + this.env.DISCORD_TOKEN, 'User-Agent': UA, 'content-type': 'application/json' };
      try {
        const r = await fetch(`${DC}/users/@me/channels`, { method: 'POST', headers: h,
          body: JSON.stringify({ recipient_id: this.dueno }) });
        if (r.status !== 200) error = 'canal ' + r.status;
        else {
          const ch = await r.json();
          const r2 = await fetch(`${DC}/channels/${ch.id}/messages`, { method: 'POST', headers: h,
            body: JSON.stringify({ content: mensajePostulacion(d.p, quien, nombreDc), allowed_mentions: { parse: [] } }) });
          if (r2.status !== 200) error = 'mensaje ' + r2.status;
        }
      } catch (e) { error = String(e).slice(0, 120); }
    }
    this.sql.exec('UPDATE postulaciones SET enviada = ?, error = ? WHERE id = ?', error ? 0 : 1, error, id);
    if (error) {
      this.guardar('ultimo_error', { t: ahora, ruta: 'sumate', error });
      return json({ error: 'no_llego' }, 502);
    }
    return json({ ok: true });
  }

  async olvidar(d) {
    if (!/^[0-9]{5,25}$/.test(String(d.quien || ''))) return json({ error: 'falta quién' }, 400);
    const r = this.sql.exec("UPDATE subs SET quien = '' WHERE quien = ?", String(d.quien));
    // 🔑 Y SUS VOTOS: van con su Discord ID, así que son un dato suyo. Lo que
    // ya se aplicó (un Elegido, un ×2) quedó en el ciclo y no cambia.
    const v = this.sql.exec('DELETE FROM votos WHERE quien = ?', String(d.quien));
    // 🔑 Y SU BILLETERA: lo cobrado se borra; lo que puso queda SIN NOMBRE —si
    // se borrara, al que cazó ese precio se le irían sus puntos de Temporada
    const b = this.sql.exec('DELETE FROM tienda WHERE quien = ?', String(d.quien));
    this.sql.exec("UPDATE precios SET quien = 'borrado' WHERE quien = ?", String(d.quien));
    // y sus sesiones: en ningún dispositivo queda adentro
    this.sql.exec('DELETE FROM sesiones WHERE quien = ?', String(d.quien));
    // 🔑 Y A QUIÉN SEGUÍA, Y QUÉ SERVIDOR ELIGIÓ: también van con su Discord ID
    const s = this.sql.exec('DELETE FROM sigue WHERE quien = ?', String(d.quien));
    this.sql.exec('DELETE FROM servidor WHERE quien = ?', String(d.quien));
    // 🙈 y si había ocultado su foto: también es un dato suyo (y la lista del ciclo se rehace sin él)
    if (this.sql.exec('DELETE FROM foto_oculta WHERE quien = ?', String(d.quien)).rowsWritten) await this.espejarOcultas();
    // 🔑 Y SUS REPORTES, y la cola de KV sin ellos: van con su Discord ID
    const rp = this.sql.exec('DELETE FROM reportes WHERE quien = ?', String(d.quien));
    if (rp.rowsWritten) await this.colaReportes(Date.now());
    // 👏 y a quién felicitó: también va con su Discord ID
    const ap = this.sql.exec('DELETE FROM aplausos WHERE quien = ?', String(d.quien));
    // 🔔 y su bandeja
    this.sql.exec('DELETE FROM bandeja WHERE quien = ?', String(d.quien));
    // 🤝 y sus postulaciones de /sumate, y cuántas veces cambió algo hoy
    this.sql.exec('DELETE FROM postulaciones WHERE quien = ?', String(d.quien));
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
    // lo de más de un mes se va: el ciclo ya lo pasó a ✅ Decidir
    this.sql.exec('DELETE FROM reportes WHERE t < ?', ahora - 30 * DIA_MS);
    const cola = this.sql.exec('SELECT id, quien, llave, que, texto, batalla, t FROM reportes ' +
      'ORDER BY id DESC LIMIT ?', REPORTES_COLA).toArray().reverse();
    try {
      await this.env.KV.put('reportes', JSON.stringify(cola));
    } catch (e) {
      this.guardar('ultimo_error', { t: ahora, ruta: '/reportar', error: String(e).slice(0, 160) });
    }
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
      const sv = String(d.sv);
      if (!/^[A-Z]{2,5}$/.test(sv)) return json({ error: 'servidor' }, 400);
      if (!fila || fila.sv !== sv) {
        if (fila && fila.fijo && !libre) return json({ error: 'ya', sv: fila.sv, fijo: true, libre: false }, 409);
        this.sql.exec('INSERT INTO servidor (quien, temporada, sv, de, t, fijo) VALUES (?, ?, ?, ?, ?, ?) ' +
          'ON CONFLICT(quien, temporada) DO UPDATE SET sv = excluded.sv, de = excluded.de, t = excluded.t, ' +
          'fijo = excluded.fijo', quien, temp, sv, de, ahora, libre ? 0 : 1);
        fila = { sv, fijo: libre ? 0 : 1 };
      }
    } else if (fila && de) {
      // tu perfil puede haber cambiado (entraste con otro nombre): se corrige acá
      this.sql.exec('UPDATE servidor SET de = ? WHERE quien = ? AND temporada = ? AND de != ?', de, quien, temp, de);
    }
    const antes = fila ? null : this.sql.exec('SELECT sv FROM servidor WHERE quien = ? ORDER BY t DESC LIMIT 1',
      quien).toArray()[0];
    return json({ ok: true, sv: fila ? fila.sv : antes ? antes.sv : '', fijo: !!(fila && fila.fijo), libre,
      libre_hasta: hasta, puede: libre || !(fila && fila.fijo) });
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
      cuantos[r.sv] = (cuantos[r.sv] || 0) + 1;
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

  /** Lo público: cuántos siguen a cada perfil (sólo los que tienen alguno). */
  seguidores() {
    const ahora = Date.now(), n = {};
    for (const r of this.sql.exec('SELECT a, COUNT(*) AS n FROM sigue WHERE creada > 0 AND creada < ? GROUP BY a',
      ahora - EDAD_MIN_DIAS * DIA_MS).toArray()) n[r.a] = r.n;
    return { t: ahora, n };
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
        try { nombre = String((JSON.parse((await this.env.KV.get('p:' + fs[0].de)) || '{}') || {}).n || '').slice(0, 40); } catch (e) { nombre = ''; }
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
    // lo viejo se va: el ciclo lee el resultado cuando la encuesta cierra
    this.sql.exec('DELETE FROM votos WHERE t < ?', ahora - VOTOS_DIAS * DIA_MS);
    const cuenta = {};
    for (const r of this.sql.exec('SELECT op, COUNT(*) AS n FROM votos WHERE enc = ? GROUP BY op', d.enc)
      .toArray()) cuenta[r.op] = r.n;
    // `t`: la página compara contra la de `/avisos/encuestas`, que puede venir de la caché
    return json({ ok: true, enc: d.enc, op: d.op, cuenta, t: ahora });
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
      this.sql.exec("DELETE FROM tienda WHERE id LIKE 'mw:%'");
      for (const [id, x] of Object.entries(r.mw)) {
        if (!Array.isArray(x) || !/^[0-9]{5,25}$/.test(String(x[0])) || !Number.isInteger(x[1]) || x[1] <= 0) continue;
        this.sql.exec('INSERT OR REPLACE INTO tienda (id, ref, quien, monto, t) VALUES (?, 0, ?, ?, ?)',
          'mw:' + String(id).slice(0, 160), String(x[0]), x[1], Number(x[2]) || ahora);
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
      return json({ error: 'esperá unos segundos' }, 429);
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
    return json({ ok: true });
  }

  /** Una visita sin cuenta: el navegador avisa una vez por día. ⚠️ Con tope: es un número que cualquiera puede
   *  empujar, y un script no tiene que poder llevarlo a cualquier lado */
  visita() {
    this.sql.exec('INSERT INTO visitas (dia, n) VALUES (?, 1) ON CONFLICT(dia) DO UPDATE SET n = n + 1 WHERE n < 20000',
      diaET());
    return json({ ok: true });
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

  /** ⚙️ Los ajustes del dueño, como están (ver `ajusteValido()`) */
  ajustes() {
    return this.leer('ajustes_dueno') || {};
  }

  /** ⚙️ Uno, ya validado por la ruta. `null` lo saca */
  ajuste(d) {
    const a = this.ajustes();
    if (d.valor === null || d.valor === undefined) delete a[d.cual];
    else a[d.cual] = d.valor;
    a._t = Date.now();
    this.guardar('ajustes_dueno', a);
    return { ok: true, ajustes: a };
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
   *  que ya comprobó que es Dlx. Números, nunca quién */
  dueno() {
    const ahora = Date.now();
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
      ajustes: this.ajustes(),
      // 🤝 y lo que te llega por DM, junto: las postulaciones de /sumate y los errores reportados en las llaves (los 10
      // últimos de cada uno), con la clave de la página de quien lo mandó si se la conoce
      postulaciones: this.sql.exec('SELECT p.t, p.datos, p.enviada, p.error, i.k FROM postulaciones p ' +
        'LEFT JOIN idk i ON i.id = p.quien ORDER BY p.t DESC LIMIT 10').toArray().map((f) => {
        let p = {};
        try { p = JSON.parse(f.datos) || {}; } catch (e) { p = {}; }
        return { t: f.t, tipo: p.tipo || '', nombre: p.nombre || '', link: p.link || '', miembros: p.miembros,
          eventos: p.eventos, mensaje: String(p.mensaje || '').slice(0, 400), llego: f.enviada === 1, error: f.error || '',
          de: f.k || '' };
      }),
      reportes: this.sql.exec('SELECT r.t, r.llave, r.que, r.texto, r.batalla, i.k FROM reportes r ' +
        'LEFT JOIN idk i ON i.id = r.quien ORDER BY r.t DESC LIMIT 10').toArray()
        .map((f) => ({ t: f.t, llave: f.llave, que: f.que, texto: String(f.texto || '').slice(0, 300), batalla: f.batalla, de: f.k || '' })),
      dias,
      sesiones: this.sql.exec('SELECT COUNT(DISTINCT quien) AS n FROM sesiones WHERE vence > ?', ahora).toArray()[0].n,
      sistema: {
        ok: e.ok, vigia: (this.leer('vigia') || {}).t || null, suscripciones: e.suscripciones, ultimas_24h: e.ultimas_24h,
        ultimo: e.ultimo, disparador: e.disparador, ultimo_error: e.ultimo_error,
      },
    };
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
