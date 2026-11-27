// 🎙️ EL GRABADOR DE LOS EVENTOS (21/11/2026). Corre en Railway, aparte del Worker.
//
// Dlx, 21/11/2026: hoy graba el bot de Drako (FFA), y la gente creía que era del nuestro — *«that is his bot, not
// mine. That's the difference»*. Esta es la primera tanda: grabar y entregar. Los clips por batalla, los shorts con
// las cartas y lo de cada rapero en su perfil vienen después, sobre lo que esto deje.
//
//     node index.js              graba (lo que corre en Railway)
//     node index.js --revisar    se conecta, dice qué ve y si entraría a alguna llamada, y sale (no entra a ninguna)
//     node prueba.js             el self-check, sin red
//
// CÓMO DECIDE ENTRAR (como el de Drako: nadie tiene que tocar nada):
//   · en un servidor de `GRABAR_EN`, la llamada con más gente (sin contar bots ni el canal AFK), y SÓLO entre las
//     de competencia de ese servidor (`CANALES_DE`): un chat o un cypher lleno no es un evento, y no se graba
//   · entra si hay `MIN_SIN` personas, o `MIN_VIVO` si el vigía tiene una llave de ese servidor en juego
//     (`/avisos/vivo`, público: se le pregunta sólo cuando una llamada ya pasó `MIN_VIVO`, y cada 2 min como mucho)
//   · la condición tiene que durar `ESPERA_ENTRAR` (una llamada que se llena y se vacía no es un evento)
//   · ⚠️ ENTRA AUNQUE ESTÉ EL DE DRAKO. Iba a no entrar donde ya hubiera otro grabador, y en FFA —el primer servidor,
//     Dlx 21/11: «not DRA first but FFA bc DRA is still going under remake»— el de Drako está en todas las llamadas
//     de competencia: no habría grabado nunca. `OTROS` (env `NO_SI_ESTA`) queda para el día que haga falta
// Y SALE cuando quedan menos de `SALIR_CON` personas durante `ESPERA_SALIR`, a las `MAX_H` horas, o si lo sacan.
//
// 🩺 PERO SÍ LE AVISA A QUIEN SE ESCUCHA MAL (Dlx, 21/11/2026: «que el bot te avise en vivo que no se te escucha tan
// bien», en el chat de la llamada): cada `VENTANA_S` mide cada voz (calidad.js) y, si el mismo problema —se corta,
// satura, bajito, calidad de teléfono— dura 20 s, se lo dice UNA vez en el evento, con cómo arreglarlo. Como mucho
// `AVISOS_MAX` por evento. Y al entregar, cada voz va al mismo volumen y la entrega trae cómo se escuchó cada uno.
//
// 🎙️ Y LA PRUEBA DE MICRO (microfono.js): en los canales de `PRUEBA_MICRO`, ULAYA te escucha y te dice en voz qué
// hacer. Con `PRUEBA_TOKEN` la hace un segundo bot; sin él, éste, cuando no está grabando en ese servidor.
//
// ⚠️ NO AVISA QUE GRABA, A PROPÓSITO. La primera versión mandaba «🔴 Grabando esta llamada… toca ❌ si no quieres
// que se guarde tu voz», y Dlx, 21/11/2026, en la primera prueba: *«elimina eso… es muy troll… La gente que está en
// la Liga Global acepta términos de que los eventos pueden ser grabados incluso cuando uno entra al servidor»*. Que
// está grabando se ve igual: el bot aparece adentro de la llamada.
//
// ENTREGA el audio mezclado en `ENTREGA` (por ahora el canal de Logs de DRA), partido si no entra en un mensaje.
// ⚠️ NUNCA POR DM: el bot sólo le escribe por privado a Dlx. Al organizador le llega por un canal o por el panel
// del socio, cuando eso exista.
//
// ⚠️ UN SOLO PROCESO Y SIN BUCLES DE REINICIO. Cada arranque es un IDENTIFY, Discord da 1.000 por día y al pasarlos
// resetea el token del bot — el mismo del Worker y del ciclo. Por eso nada de lo que pasa adentro tumba el proceso
// (todo va con try/catch y `unhandledRejection` sólo anota) y Railway reintenta 5 veces como mucho (railway.json).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { Client, GatewayIntentBits, Events, PermissionFlagsBits, Options } from 'discord.js';
import {
  joinVoiceChannel, EndBehaviorType, VoiceConnectionStatus, entersState, generateDependencyReport,
} from '@discordjs/voice';
import { PistaOpus } from './ogg.js';
import { mezclar, partir, duracion, sonoridad, ganancia, cortar } from './mezcla.js';
import { MedidorVoz, VENTANA_S, TEXTOS, NOMBRE_PROBLEMA } from './calidad.js';
import { PruebaMicro } from './microfono.js';
import { LlamadasVivo, claveCiclo } from './vivo.js';
import { VIGIA_CAIDO_MIN, ANUNCIO_HORAS, FOTO_S, caidoDesde, anunciosDeAhora, largoRecuperada, decidirFin, CAMPEON } from './reserva.js';
import { Habla, ubicarTodas, guion, resumenGuion, nombreClip, lineaBatalla, MIN_CLIP_S, completarIds, sinUbicar } from './batallas.js';
import { Menciones } from './mencion.js';
import { Fallas, motivoDe, textoFalla } from './entrada.js';

const lista = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
const num = (s, d) => (Number.isFinite(Number(s)) && String(s).trim() !== '' ? Number(s) : d);
const E = process.env;

//: FFA primero (Dlx, 21/11/2026); DRA cuando termine su remodelación, y los Tier 1 de a uno
export const GRABAR_EN = lista(E.GRABAR_EN || '1468472442925092958');
//: 🌎 TODOS LOS SERVIDORES DE LA LIGA (Dlx, 22/11/2026: «quiero que pruebes en todos los servidores ok? de la liga global,
//: tier 3, tier 2 y tier 1»): además de `GRABAR_EN`, cualquier servidor donde esté el bot y que tenga una llave en juego
//: (`/avisos/vivo`: el vigía sólo lee servidores de la Liga, así que es la lista de socios sin escribirla en ningún lado).
//: ⚠️ En éstos SÓLO con llave: sin ella, una llamada con mucha gente en un servidor socio es charla, no un evento (el piso
//: de `MIN_SIN` sin llave queda para los de `GRABAR_EN`). `GRABAR_TODOS=0` en Railway vuelve a sólo `GRABAR_EN`
export const GRABAR_TODOS = E.GRABAR_TODOS !== '0';
/** Los servidores que se miran en esta vuelta: los de `GRABAR_EN` y, con `GRABAR_TODOS`, los que tienen una llave en juego. */
async function servidoresAMirar() {
  if (!GRABAR_TODOS) return GRABAR_EN;
  return [...new Set([...GRABAR_EN, ...(await llavesEnJuego()), ...(await anunciados()).keys()])];
}
//: 📣 EL ORGANIZADOR EN LA LLAMADA (Dlx, 22/11/2026: «ulaya will join their events channel when an event is announced
//: and the organizer joins, based on how ulaya already joins to ffa events»): en cualquier servidor de la Liga, con un
//: evento anunciado que arranca ahora (`/avisos/anunciados-ciclo`: de 30 min antes de su hora a 4 h después), entra a la
//: llamada donde está QUIEN LO ANUNCIÓ, en cuanto hay `MIN_ORG` personas. Con menos, entraría y saldría (`SALIR_CON`)
export const MIN_ORG = Math.max(2, num(E.MIN_ORG, 2));
//: 🔴 UNA LLAVE SIN TOCAR HACE 45 MIN YA NO HACE ENTRAR (22/11/2026, 2:47 AM): la de Cypherhood se tocó por última vez
//: a las 12:15 AM y a las 2:40 ULAYA estaba grabando el cypher de después en «ReyDeLaPista» — Dlx: «not an event but it
//: is like a cypher». `LLAVE_H` (3 h) sigue valiendo para los micrófonos; para ENTRAR, la llave tiene que estar viva
export const LLAVE_ENTRAR_MIN = num(E.LLAVE_ENTRAR_MIN, 45);
//: 🏁 CUÁNDO TERMINÓ EL EVENTO (Dlx, 22/11/2026: «asegúrate que el bot sepa qué es un evento, cuándo unirse, cuándo
//: grabar, qué grabar, cuándo salirse y asegurarse la calidad»). Hasta acá salía sólo cuando la llamada se vaciaba, y
//: después de un evento la gente se queda: el cypher de Cypherhood. Ahora, una vez que vio el evento (una llave viva o un
//: anuncio de ahora), sale cuando su llave lleva `LLAVE_SALIR_MIN` sin tocarse y no hay otro anuncio en curso, y lo
//: entregado corta `COLA_EVENTO_MIN` después de la última edición de la llave: lo de después es charla
export const LLAVE_SALIR_MIN = num(E.LLAVE_SALIR_MIN, 40);
export const COLA_EVENTO_MIN = num(E.COLA_EVENTO_MIN, 10);
//: sin llave, quien entró por un anuncio sale a las `SIN_LLAVE_H` horas: un evento de verdad publica su llave
export const SIN_LLAVE_H = num(E.SIN_LLAVE_H, 3);
//: ↪️ si el evento se muda de canal (ReyDeLaPista 1 → 2), la grabación lo sigue, hasta `MUDANZAS_MAX` veces
export const MUDANZAS_MAX = num(E.MUDANZAS_MAX, 6);
//: 🧮 cuántas grabaciones a la vez como mucho (cada una mide sus voces con ffmpeg cada 10 s y mezcla al final)
export const MAX_A_LA_VEZ = num(E.MAX_A_LA_VEZ, 4);
//: ✂️ lo que dura menos que esto no se entrega (sólo se anota): una llamada que se llenó un minuto no es un evento
export const MIN_ENTREGA_S = num(E.MIN_ENTREGA_S, 180);
//: en qué llamadas de cada servidor se graba (las de competencia). `CANALES` en Railway las cambia para todos
export const CANALES_DE = {
  '1468472442925092958': ['1519182186702438450', '1550950039159963648', '1550950286615519343'],  // FFA: competencia, competencia², Escenario
};
const CANALES = lista(E.CANALES);
const canalesDe = (gid) => (CANALES.length ? CANALES : CANALES_DE[gid] || null);
//: a dónde va el audio: el canal de Logs de DRA («LIGA GLOBAL», el mismo que `CANAL_LOGS` de avisos.js)
export const ENTREGA = E.ENTREGA || '1504110449535483924';
export const MIN_VIVO = num(E.MIN_VIVO, 3);
export const MIN_SIN = num(E.MIN_SIN, 8);
export const ESPERA_ENTRAR = num(E.ESPERA_ENTRAR_S, 60) * 1000;
export const SALIR_CON = num(E.SALIR_CON, 2);
export const ESPERA_SALIR = num(E.ESPERA_SALIR_S, 300) * 1000;
//: ⏸️ SI LA SACAN, PAUSA EN VEZ DE TERMINAR (25/11/2026, Dlx a «si la sacan y vuelve al mismo evento, juntar todo en una sola
//: entrega»: «sí, hazlo»). Del 21 al 24/11, 4 grabaciones terminaron en «me sacaron de la llamada» y LKR del 22/11 salió en 3
//: pedazos: cada vuelta era una grabación nueva, con sus batallas partidas entre dos entregas. Ahora, con el evento en
//: juego, la grabación se PAUSA: las pistas quedan abiertas y el reloj se congela (`ms()` descuenta lo de afuera, así que al
//: volver sigue sin hueco). Vuelve cuando hay una llamada del evento (como para entrar, después de `ESPERA_VOLVER`); si
//: pasan `PAUSA_MAX_MIN` afuera, el evento termina o la sacan `PAUSAS_MAX` veces, se entrega lo que hay, como antes
export const PAUSA_MAX_MIN = num(E.PAUSA_MAX_MIN, 20);
export const PAUSAS_MAX = num(E.PAUSAS_MAX, 3);
export const ESPERA_VOLVER = num(E.ESPERA_VOLVER_S, 60) * 1000;
export const MAX_H = num(E.MAX_H, 6);
//: los segundos que se dejan después de que se vació la llamada (la espera de `ESPERA_SALIR` no va al archivo)
export const COLA_S = num(E.COLA_S, 15);
//: cuántos avisos de «se te escucha mal» como mucho por evento: con más, el chat de la llamada sería sólo eso
export const AVISOS_MAX = num(E.AVISOS_MAX, 12);
//: los canales de voz de la prueba de micro (vacío = apagada). Los crea cada servidor y se cargan en Railway
export const PRUEBA_MICRO = lista(E.PRUEBA_MICRO);
let prueba = null;
//: 🎙️👀 los micrófonos y el público de las llamadas en vivo (vivo.js). `VIVO=0` en Railway lo apaga
let llamadas = null;
//: una llave publicada hace más que esto ya no cuenta como «en juego» (lo mismo que `LLAVE_H` de en_llamada.py)
const LLAVE_H = 3;
//: 🔴 EL APODO MIENTRAS GRABA (ponerApodo). Dlx, 25/11/2026: *«en vez q diga grabando simplemente pon el emoji rojo al
//: costado de Ulaya asi: Emoji / la linea vertical ULAYA»*. Antes era «🔴 GRABANDO · ULAYA», que en FRZ quedó colgado
//: (aislada no se lo pudo sacar): `APODOS_VIEJOS` hace que se lo reconozca igual y se lo saque
//: 🔴 Y CON SU APODO DE ESE SERVIDOR (Dlx, 26/11/2026: «el emoji rojo, la barra y el apodo; en los tier 1 es el nombre del
//: sv, en los demás está bien como ULAYA»): el bot de la Liga ES ULAYA, y en un Tier 1 se llama «FFA Bot» (el perfil del
//: bot, `perfilBotQuiere()` de bot/avisos.js). Al grabar va «🔴 | FFA Bot»; sin apodo, «🔴 | ULAYA»
const PREFIJO_GRABANDO = '🔴 | ';
const APODO_GRABANDO = PREFIJO_GRABANDO + 'ULAYA';
const APODOS_VIEJOS = ['🔴 GRABANDO · ULAYA'];
export const esApodoGrabando = (nick) => [PREFIJO_GRABANDO, ...APODOS_VIEJOS].some((a) => String(nick || '').startsWith(a));
/** El apodo mientras graba, con el que tenía (`antes`; `null` = sin apodo). Discord corta los apodos en 32 */
export const apodoGrabando = (antes) => {
  const base = String(antes || '').trim();
  return base && !esApodoGrabando(base) ? (PREFIJO_GRABANDO + base).slice(0, 32) : APODO_GRABANDO;
};
const VIGIA = 'https://liga-global-bot.liga-global-ul.workers.dev';
//: otros grabadores con los que NO se entra (vacío: ver arriba). El de Drako es «Freestyle for All», 1557056218164629535
const OTROS = new Set(lista(E.NO_SI_ESTA));
const BASE = E.CARPETA || path.join(os.tmpdir(), 'grabaciones');
//: 💽 EL DISCO PROPIO SE LLENÓ (25/11/2026, 7:44 PM ET: «ENOSPC: no space left on device» al entrar a WOF). El volumen de
//: Railway del plan de prueba es chico, y la grabación de FFA de esa tarde lo llenó y además no pudo mezclarse ahí: quedó
//: trabada ocupando todo. Ahora (1) se graba en el volumen sólo si le quedan `LIBRE_MIN` bytes; si no, en el disco del
//: contenedor (grabado igual, pero sin sobrevivir a un reinicio); (2) la mezcla y los cortes van SIEMPRE al disco del
//: contenedor (`trabajo`); y (3) al arrancar se limpia lo que no se pudo entregar
export const LIBRE_MIN = num(E.LIBRE_MIN, 400e6);
const TEMPORAL = path.join(os.tmpdir(), 'grabaciones');
function libreEn(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); const s = fs.statfsSync(dir); return Number(s.bavail) * Number(s.bsize); } catch (e) { return 0; }
}
let avisoDisco = 0;
/** La carpeta donde arranca una grabación: la propia si tiene lugar, si no la temporal (y lo dice en el log, una vez por hora). */
function carpetaParaGrabar() {
  if (!E.CARPETA) return BASE;
  const libre = libreEn(BASE);
  if (libre >= LIBRE_MIN) return BASE;
  if (Date.now() - avisoDisco > 3600000) {
    anotar(`💽 al disco propio le quedan ${(libre / 1e6).toFixed(0)} MB: grabo en el del contenedor (no sobrevive a un reinicio)`);
    avisoDisco = Date.now();
  }
  return TEMPORAL;
}
//: 💾 cuántas veces se intenta entregar una recuperada antes de dejarla (una que rompe siempre no traba cada arranque)
export const RECUPERAR_MAX = 2;

//: el log va en hora del este, como todo el proyecto (Railway muestra su propia hora al costado, en la del navegador)
const RELOJ = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const anotar = (...x) => console.log(RELOJ.format(new Date()) + ' ET', ...x);

/** «9:05 PM ET» — todas las horas en hora del este. */
export function horaET(d) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })
    .format(d) + ' ET';
}
/** «1 h 14 min», «8 min». */
export function largo(seg) {
  const m = Math.round(seg / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}
/** Hasta dónde puede subir un archivo el bot en ese servidor (con margen). Si Discord dice que no, se parte más. */
export function topeDe(guild) {
  return ({ 2: 48, 3: 95 }[guild?.premiumTier] || 9.5) * 1e6;
}

// ── el vigía: ¿hay una llave de este servidor en juego? ───────────────────
// 🛟 EL PLAN B SI EL VIGÍA NO CONTESTA (25/11/2026, Dlx: «me gustan todos»). El 24/11 de 3 a 7 PM ET el objeto se pasó de su
// cupo de filas y no contestaba: ULAYA no supo que UFL BATTLES V3 (UFLUC) estaba en juego y no entró. Desde que no contesta
// hace `VIGIA_CAIDO_MIN`: los anuncios se calculan acá con su hora (`anun.ev`, guardados de la última vez que contestó, que
// pide las próximas `ANUNCIO_HORAS`), una llave vista en las últimas `LLAVE_H` cuenta como en juego, y una grabación no se
// corta por «terminó el evento» (no hay con qué saberlo: termina cuando se vacía la llamada)
const vigia = { ok: Date.now(), avisado: false };
const vigiaCaido = (ahora = Date.now()) => caidoDesde(vigia.ok, ahora, VIGIA_CAIDO_MIN);
function vigiaContesto() {
  if (vigia.avisado) anotar('🛟 el vigía volvió a contestar');
  vigia.ok = Date.now();
  vigia.avisado = false;
}
function vigiaNoContesto() {
  if (vigiaCaido() && !vigia.avisado) {
    anotar(`🛟 el vigía no contesta hace más de ${VIGIA_CAIDO_MIN} min: sigo con lo último que vi (plan B)`);
    vigia.avisado = true;
  }
}
let vivo = { t: 0, g: new Set(), viva: new Set(), ed: new Map(), aviso: new Map(), cerrada: new Map() };
async function llavesEnJuego(paraEntrar = false) {
  if (Date.now() - vivo.t >= 120000) {
    vivo.t = Date.now();
    try {
      const r = await fetch(VIGIA + '/avisos/vivo', { signal: AbortSignal.timeout(10000) });
      const d = r.ok ? await r.json() : {};
      const g = new Set(), viva = new Set(), ultima = new Map();
      for (const ll of d.llaves || []) {
        const ed = ll.ed || ll.pub;
        if (!ll.g || typeof ed !== 'number') continue;
        ultima.set(String(ll.g), Math.max(ultima.get(String(ll.g)) || 0, ed));
        if (Date.now() - ed <= LLAVE_H * 3600000) g.add(String(ll.g));
        if (Date.now() - ed <= LLAVE_ENTRAR_MIN * 60000) viva.add(String(ll.g));
      }
      if (!r.ok) throw new Error('contestó ' + r.status);
      // ✂️⏸️ lo último que avisó el organizador de cada servidor (`estados`, por sigla: se pasa a guild con las llaves) y si
      // la llave más nueva de cada servidor ya tiene campeón (ver `decidirFin()` en reserva.js)
      const svG = new Map();
      const ult = new Map();
      for (const ll of d.llaves || []) {
        if (ll.sv && ll.g) svG.set(String(ll.sv), String(ll.g));
        const ed = ll.ed || ll.pub;
        if (ll.g && (!ult.has(String(ll.g)) || ed > ult.get(String(ll.g)).ed)) ult.set(String(ll.g), { ed, texto: String(ll.texto || '') });
      }
      const aviso = new Map();
      for (const e of d.estados || []) {
        const gg = svG.get(String(e.sv || ''));
        if (!gg || !e.tipo) continue;
        if (!aviso.has(gg) || Number(e.pub) > aviso.get(gg).pub) aviso.set(gg, { tipo: String(e.tipo), pub: Number(e.pub) || 0, nueva: Number(e.nueva) || 0 });
      }
      vivo.aviso = aviso;
      vivo.cerrada = new Map([...ult].map(([gg, x]) => [gg, CAMPEON.test(x.texto)]));
      vivo.g = g;
      vivo.viva = viva;
      vivo.ed = ultima;
      vigiaContesto();
    } catch (e) {
      anotar('⚠️ el vigía no contestó:', String(e.message || e).slice(0, 80));
      vigiaNoContesto();
    }
  }
  // 🛟 sin vigía no se ve si una llave se sigue editando: la que se vio en las últimas `LLAVE_H` cuenta como en juego
  return paraEntrar && !vigiaCaido() ? vivo.viva : vivo.g;
}

// ── 📣 los eventos anunciados que arrancan ahora, y quién los anunció ─────
let anun = { t: 0, g: new Map(), ev: [] };
/** `Map(guild -> Set(autores))` de `/avisos/anunciados-ciclo` (con la clave del ciclo), cada 2 min como mucho. */
async function anunciados() {
  if (!GRABAR_TODOS || Date.now() - anun.t < 120000) return anun.g;
  anun.t = Date.now();
  try {
    const r = await fetch(VIGIA + '/avisos/anunciados-ciclo?horas=' + ANUNCIO_HORAS, { headers: { 'x-lg-ciclo': claveCiclo(E.DISCORD_TOKEN) },
      signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error('contestó ' + r.status);
    const d = await r.json();
    anun.ev = Array.isArray(d.ev) ? d.ev : [];
    vigiaContesto();
  } catch (e) {
    anotar('⚠️ los anunciados no contestaron:', String(e.message || e).slice(0, 80));
    vigiaNoContesto();
  }
  // 🛟 la ventana se calcula acá con la hora de cada anuncio: así lo guardado sirve también si el vigía se cae
  anun.g = organizadores(anunciosDeAhora(anun.ev));
  return anun.g;
}

/** `[[guild, ini, autor]]` -> `Map(guild -> Set(autores))`, sin filas rotas. */
export function organizadores(ev) {
  const m = new Map();
  for (const f of ev || []) {
    if (!Array.isArray(f) || !/^\d{5,25}$/.test(String(f[0])) || !/^\d{5,25}$/.test(String(f[2]))) continue;
    if (!m.has(String(f[0]))) m.set(String(f[0]), new Set());
    m.get(String(f[0])).add(String(f[2]));
  }
  return m;
}

/** La llamada donde está alguien de `autores` (sin la de AFK y, si se conocen, sólo las de competencia), o `null`. */
function conOrganizador(guild, autores) {
  if (!autores || !autores.size) return null;
  const solo = canalesDe(guild.id);
  for (const c of guild.channels.cache.values()) {
    if (!c.isVoiceBased() || c.id === guild.afkChannelId || (solo && !solo.includes(c.id))) continue;
    if ([...c.members.keys()].some((id) => autores.has(String(id)))) return { canal: c, ...gente(c), org: true };
  }
  return null;
}

/** La gente de una llamada (sin bots), y si hay otro grabador adentro. */
function gente(canal) {
  const m = [...canal.members.values()];
  return {
    n: m.filter((x) => !x.user.bot).length,
    otro: m.some((x) => x.user.bot && OTROS.has(x.id)),
  };
}

/** La llamada candidata de un servidor: la que tiene más gente. */
function candidata(guild) {
  let mejor = null;
  const solo = canalesDe(guild.id);
  for (const c of guild.channels.cache.values()) {
    if (!c.isVoiceBased() || c.id === guild.afkChannelId || (solo && !solo.includes(c.id))) continue;
    const g = gente(c);
    if (!mejor || g.n > mejor.n) mejor = { canal: c, ...g };
  }
  return mejor;
}

// ── una grabación ─────────────────────────────────────────────────────────
class Grabacion {
  constructor(client, guild, canal, motivo) {
    this.client = client;
    this.guild = guild;
    this.canal = canal;
    this.motivo = motivo;
    this.inicio = new Date();
    this.dir = path.join(carpetaParaGrabar(), `${guild.id}-${this.inicio.toISOString().replace(/[:.]/g, '-')}`);
    this.trabajo = null;         // 💽 la mezcla y los cortes, en el disco del contenedor (ver `LIBRE_MIN`)
    this.pistas = new Map();     // id -> PistaOpus
    this.subs = new Map();       // id -> AudioReceiveStream
    this.quien = new Map();      // id -> { nombre, bot }
    this.medidores = new Map();  // id -> MedidorVoz (sólo personas: la música de un bot no recibe avisos)
    this.habla = new Habla();     // ⚔️ cuándo habló cada uno (sólo personas): para ubicar cada batalla (batallas.js)
    this.avisos = 0;
    this.midiendo = false;
    this.vacia = null;           // desde cuándo hay menos de SALIR_CON
    this.cerrando = false;
    this.eventoVisto = false;    // 🏁 si ya vio el evento (una llave viva o un anuncio de ahora)
    this.llaveVista = false;     // si vio una llave de este servidor tocada después de entrar
    this.sinEvento = null;       // desde cuándo no hay evento
    this.mudanzas = 0;
    this.pausa = null;           // ⏸️ afuera: { t (performance.now), d (Date.now), ms (lo grabado), razon }
    this.afuera = 0;             // ⏸️ los ms que estuvo afuera, que `ms()` descuenta
    this.pausas = 0;
    this.volviendo = false;
    this.finReloj = null;        // 💾 en una recuperada: el instante (reloj) en que terminó lo grabado
  }

  /**
   * 💾 LO QUE HACE FALTA PARA ENTREGARLA DESPUÉS, EN SU CARPETA (25/11/2026, Dlx: «me gustan todos»). Un reinicio de Railway
   * —un push a `grabador/`, una caída— perdía la grabación entera: al apagarse da 180 s y mezclar 2 h lleva ~20 min. Ahora,
   * cada `FOTO_S` y al apagarse, `estado.json` guarda quién habló cuándo y desde dónde; las pistas ya se escriben a disco
   * a medida que llegan. Al volver a arrancar, `recuperar()` entrega lo que quedó. ⚠️ Para sobrevivir a un redeploy la
   * carpeta (`CARPETA`) tiene que estar en un VOLUMEN de Railway: sin eso el disco se va con el contenedor
   */
  foto(extra = {}) {
    try {
      fs.writeFileSync(path.join(this.dir, 'estado.json'), JSON.stringify({ v: 1, g: this.guild.id, canal: this.canal.id,
        motivo: this.motivo, inicio: this.inicio.toISOString(), seg: this.ms() / 1000, afuera: this.afuera, pausas: this.pausas,
        quien: Object.fromEntries(this.quien), voces: [...this.pistas.keys()], habla: Object.fromEntries(this.habla.t), ...extra }));
    } catch (e) { /* una foto menos */ }
  }

  /** 💽 Borra la carpeta de la grabación y la de trabajo (después de entregar) */
  limpiar() {
    for (const d of [this.dir, this.trabajo]) if (d) fs.rmSync(d, { recursive: true, force: true });
  }

  /** 💾 Railway la apaga: cierra las pistas y deja `estado.json` para el próximo arranque, sin mezclar (no le da el tiempo). */
  dejarParaDespues() {
    // 🧯 SE APAGÓ MEZCLANDO (26/11/2026: «Nocturna Style» de DDS, 25/11). Terminó a las 12:19 AM, la entrega tarda ~20 min y
    // a las 12:31 un push a grabador/ reinició Railway: `terminar()` ya había puesto `cerrando`, esto salía sin dejar nada y
    // la grabación se perdió. Ahora queda la foto con hasta dónde entregar, y `recuperar()` la entrega al volver
    if (this.cerrando) {
      if (this.t0 !== undefined && !this.entregada && this.hastaS > 0 && this.dir && fs.existsSync(this.dir)) {
        this.foto({ cortada: true, seg: this.hastaS });
        anotar(`💾 ${this.guild.name}: me apagaron mezclando: ${largo(this.hastaS)} para entregar al volver a arrancar`);
      }
      return;
    }
    this.cerrando = true;
    clearInterval(this.reloj);
    clearInterval(this.fotos);
    for (const st of this.subs.values()) st.destroy();
    try { this.con?.destroy(); } catch (e) { /* ya estaba cerrada */ }
    const fin = this.ms();
    for (const p of this.pistas.values()) { p.silencioHasta(fin); p.cerrar(); }
    this.foto({ cortada: true, seg: fin / 1000 });
    anotar(`💾 ${this.guild.name}: ${largo(fin / 1000)} guardados para entregar al volver a arrancar`);
    return this.ponerApodo(false);
  }

  /** 🏁 ¿Sigue el evento en este servidor? Con lo que el vigía y los anuncios dijeron en la última vuelta. */
  eventoSigue() {
    // 🛟 sin vigía no hay con qué saber que terminó: sigue, y termina cuando se vacía la llamada
    if (vigiaCaido()) { this.eventoVisto = true; return true; }
    const g = this.guild.id;
    const ed = vivo.ed.get(g) || 0;
    if (ed >= this.inicio.getTime() - LLAVE_ENTRAR_MIN * 60000) this.llaveVista = true;
    const llaveViva = ed && Date.now() - ed <= LLAVE_SALIR_MIN * 60000;
    // un anuncio de ahora sostiene la grabación mientras no haya llave (el organizador arranca antes de publicarla)
    const anuncio = anun.g.has(g) && !this.llaveVista && this.ms() < SIN_LLAVE_H * 3600000;
    const sigue = !!(llaveViva || anuncio);
    if (sigue) this.eventoVisto = true;
    return sigue;
  }

  /** ↪️ Si la llamada se vació pero el evento sigue en otra del mismo servidor, la grabación se muda ahí. */
  mudarse() {
    if (this.mudanzas >= MUDANZAS_MAX) return false;
    const org = conOrganizador(this.guild, anun.g.get(this.guild.id));
    const c = org && org.n >= MIN_ORG ? org : candidata(this.guild);
    if (!c || c.otro || c.canal.id === this.canal.id || c.n < Math.max(MIN_ORG, MIN_VIVO)) return false;
    try {
      this.con.rejoin({ channelId: c.canal.id, selfDeaf: false, selfMute: true });
    } catch (e) {
      anotar('⚠️ no pude mudarme de canal:', String(e.message || e).slice(0, 100));
      return false;
    }
    anotar(`↪️ el evento se mudó: ${this.canal.name} → ${c.canal.name} (${c.n} personas)`);
    this.canal = c.canal;
    this.mudanzas++;
    this.vacia = null;
    return true;
  }

  /** Los ms grabados. 0 mientras entra: `t0` se pone recién con la conexión lista (antes daba NaN: «0 pistas, NaN min»). */
  ms() {
    if (this.t0 === undefined) return 0;
    if (this.pausa) return this.pausa.ms;
    return performance.now() - this.t0 - this.afuera;
  }
  /** Un instante de reloj (`Date.now()`) en ms de la grabación: sin lo que estuvo afuera antes de ese instante. */
  enGrabacion(ts) { return Math.max(0, ts - this.inicio.getTime() - this.afuera); }

  /**
   * 🔴 EL APODO MIENTRAS GRABA, COMO CRAIG (Dlx, 23/11/2026: «cuando se una que se ponga como Craig… que su apodo se cambie a
   * Grabando Ulaya»). Al entrar, «🔴 | ULAYA» (era «🔴 GRABANDO · ULAYA» hasta el 25/11); al salir, el apodo que tenía antes. Sin permiso de cambiar su apodo
   * en ese servidor, graba igual y lo anota UNA vez: el apodo es un aviso, no una condición (Craig sí se niega a grabar).
   */
  async ponerApodo(grabando) {
    try {
      const me = this.guild.members.me ?? await this.guild.members.fetchMe();
      if (grabando) {
        // un «🔴 | …» que quedó colgado de otra vez no es el de antes: sin él vuelve al de siempre
        this.apodoAntes = me.nickname && !esApodoGrabando(me.nickname) ? me.nickname : (this.apodoAntes ?? null);
        const quiero = apodoGrabando(this.apodoAntes);
        if (me.nickname !== quiero) await me.setNickname(quiero, 'grabando el evento');
      } else if (esApodoGrabando(me.nickname)) {
        await me.setNickname(this.apodoAntes && !esApodoGrabando(this.apodoAntes) ? this.apodoAntes : null, 'terminó la grabación');
      }
    } catch (e) {
      if (!this.avisoApodo) anotar(`⚠️ apodo en ${this.guild.name}: ${String(e.message || e).slice(0, 80)}`);
      this.avisoApodo = true;
      // 🔴 aislada (timeout) no se puede cambiar el apodo, y quedaba «GRABANDO» colgado (FRZ, 24/11): `vuelta()` reintenta
      if (!grabando) apodosColgados.add(this.guild.id);
    }
  }

  async empezar() {
    fs.mkdirSync(this.dir, { recursive: true });
    await this.conectar();
    this.t0 = performance.now();
    this.inicio = new Date();
    this.foto();
    this.fotos = setInterval(() => this.foto(), FOTO_S * 1000);
    anotar(`🔴 grabando en ${this.guild.name} / ${this.canal.name} (${this.motivo})`);
  }

  /** Entra a `this.canal` y engancha lo que escucha. La usan `empezar()` y `reanudar()`. */
  async conectar() {
    const con = joinVoiceChannel({
      channelId: this.canal.id, guildId: this.guild.id, adapterCreator: this.guild.voiceAdapterCreator,
      selfDeaf: false, selfMute: true,
    });
    this.con = con;
    await entersState(con, VoiceConnectionStatus.Ready, 30000);
    await this.ponerApodo(true);
    con.receiver.speaking.on('start', (id) => this.escuchar(id));
    clearInterval(this.reloj);
    this.reloj = setInterval(() => this.medirVoces().catch((e) => anotar('⚠️ medir:', String(e.message || e).slice(0, 100))),
      VENTANA_S * 1000);
    con.on(VoiceConnectionStatus.Disconnected, async () => {
      if (this.con !== con || this.pausa) return;   // una conexión vieja (de antes de una pausa) ya no manda
      try {
        await Promise.race([entersState(con, VoiceConnectionStatus.Signalling, 5000),
          entersState(con, VoiceConnectionStatus.Connecting, 5000)]);
      } catch (e) {
        // 🔇 ¿la aislaron? Un timeout la saca de la llamada y no la deja volver: se dice en Logs, con hasta cuándo
        const ais = await aisladaHasta(this.guild);
        if (ais) reportarFalla(this.client, this.guild, this.canal, gente(this.canal).n, this.motivo, 'me aislaron', ais);
        if (ais) this.terminar('me aislaron (timeout) en ese servidor');
        else if (this.puedePausar()) this.pausar('me sacaron de la llamada');
        else this.terminar('me sacaron de la llamada');
      }
    });
    con.on('error', (e) => anotar('⚠️ la conexión de voz:', String(e.message || e).slice(0, 120)));
  }

  /** ✂️ lo que avisó el organizador desde que empezó esta grabación (con 30 min de margen), o null */
  avisoOrg() {
    const a = vivo.aviso && vivo.aviso.get(this.guild.id);
    return a && a.pub >= this.inicio.getTime() - 30 * 60000 ? a : null;
  }

  /** ⏸️ ¿Se pausa en vez de terminar? Con el evento en juego (o en un servidor que se graba por gente) y sin pasar el tope. */
  puedePausar() {
    return !this.cerrando && this.pausas < PAUSAS_MAX && this.t0 !== undefined
      && (this.eventoSigue() || GRABAR_EN.includes(this.guild.id));
  }

  /** ⏸️ La sacaron: suelta la llamada, deja las pistas abiertas y congela el reloj (ver `PAUSA_MAX_MIN`). */
  pausar(razon, { hasta = 0, retoma = false } = {}) {
    if (this.pausa || this.cerrando) return;
    this.pausa = { t: performance.now(), d: Date.now(), ms: this.ms(), razon, hasta, retoma };
    this.pausas++;
    clearInterval(this.reloj);
    for (const st of this.subs.values()) st.destroy();
    this.subs.clear();
    try { this.con.destroy(); } catch (e) { /* ya estaba cerrada */ }
    this.ponerApodo(false);
    this.razonesPausa = (this.razonesPausa || []).concat([razon]);
    anotar(`⏸️ ${this.guild.name}: ${razon} a los ${largo(this.pausa.ms / 1000)}; espera ${largo(((hasta || Date.now() + PAUSA_MAX_MIN * 60000) - Date.now()) / 1000)} para volver`);
  }

  /** ⏸️→🔴 Vuelve a una llamada del evento y sigue en la MISMA grabación: lo de afuera no queda en el audio. */
  async reanudar(canal) {
    if (!this.pausa || this.volviendo) return;
    this.volviendo = true;
    const antes = this.canal;
    this.canal = canal;
    try {
      await this.conectar();
      this.afuera += performance.now() - this.pausa.t;
      anotar(`↩️ ${this.guild.name}: volvió a ${canal.name} después de ${largo((Date.now() - this.pausa.d) / 1000)} afuera; sigue la misma grabación`);
      this.pausa = null;
      this.vacia = null;
      this.volvio = Date.now();
    } catch (e) {
      try { this.con?.destroy(); } catch (x) { /* nada */ }
      this.canal = antes;
      anotar(`⚠️ ${this.guild.name}: no pude volver (${String(e.message || e).slice(0, 100)}); sigue en pausa`);
    } finally {
      this.volviendo = false;
    }
  }

  /** ⏸️ Cada vuelta, en pausa: ¿vuelve, sigue esperando o se entrega? */
  revisarPausa() {
    const fuera = Date.now() - this.pausa.d;
    const av = this.avisoOrg();
    if (av && av.tipo === 'cancelado' && av.pub >= this.pausa.d - 60000) { this.terminar('el organizador avisó que se canceló'); return; }
    const tope = this.pausa.hasta || this.pausa.d + PAUSA_MAX_MIN * 60000;
    if (Date.now() >= tope) { this.terminar(this.pausa.razon + ` y no se retomó en ${largo((tope - this.pausa.d) / 1000)}`); return; }
    if (this.pausa.retoma) {
      // ✂️ esperando que se retome: vuelve sólo si la llave se movió después de salir
      if ((vivo.ed.get(this.guild.id) || 0) <= this.pausa.d) return;
    } else if (!(av && av.tipo === 'pausado')) {
      const sigue = this.eventoSigue() || GRABAR_EN.includes(this.guild.id);
      if (!sigue) { this.terminar(this.pausa.razon + ' y el evento terminó'); return; }
    }
    if (fuera < ESPERA_VOLVER || this.volviendo) return;
    const yo = this.guild.members.me;
    if (yo?.communicationDisabledUntilTimestamp > Date.now()) { this.terminar('me aislaron (timeout) en ese servidor'); return; }
    const org = conOrganizador(this.guild, anun.g.get(this.guild.id));
    const c = org && org.n >= MIN_ORG && !org.otro ? org : candidata(this.guild);
    if (!c || c.otro || c.n < Math.min(MIN_VIVO, MIN_SIN, MIN_ORG)) return;
    if (!(yo && c.canal.permissionsFor(yo)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]))) return;
    this.reanudar(c.canal);
  }

  escuchar(id) {
    // (sin reloj todavía —entrando— no se escucha: el próximo «empezó a hablar» lo abre, ya con su tiempo de verdad)
    if (this.cerrando || this.pausa || this.t0 === undefined || this.subs.has(id)) return;
    const m = this.guild.members.cache.get(id);
    if (!this.quien.has(id)) this.quien.set(id, { nombre: m?.displayName || m?.user?.username || id, bot: !!m?.user?.bot });
    let pista = this.pistas.get(id);
    if (!pista) {
      pista = new PistaOpus(path.join(this.dir, id + '.ogg'));
      this.pistas.set(id, pista);
    }
    if (!this.quien.get(id).bot && !this.medidores.has(id)) this.medidores.set(id, new MedidorVoz(id));
    const medidor = this.medidores.get(id);
    const st = this.con.receiver.subscribe(id, { end: { behavior: EndBehaviorType.Manual } });
    this.subs.set(id, st);
    st.on('data', (p) => {
      if (this.cerrando) return;
      const ms = this.ms();
      pista.agregar(p, ms);
      medidor?.agregar(p, ms);
      if (medidor) this.habla.agregar(id, ms);
    });
    // un error de descifrado corta el flujo: se suelta y el próximo «empezó a hablar» lo vuelve a abrir
    st.once('error', (e) => { anotar('⚠️ una voz se cortó:', String(e.message || e).slice(0, 100)); this.subs.delete(id); });
    st.once('close', () => { if (this.subs.get(id) === st) this.subs.delete(id); });
  }

  /** Cada `VENTANA_S`: cómo se escucha cada uno, y el aviso a quien se escucha mal hace 20 s. De a uno: es ffmpeg. */
  async medirVoces() {
    if (this.cerrando || this.midiendo) return;
    this.midiendo = true;
    try {
      for (const [id, m] of this.medidores) {
        if (this.cerrando) break;
        const r = await m.ventana(this.dir);
        if (!r.avisar) continue;
        anotar(`🩺 a alguien ${NOMBRE_PROBLEMA[r.problema]} (aviso ${this.avisos + 1})`);
        if (this.avisos >= AVISOS_MAX) continue;
        this.avisos++;
        try {
          await this.canal.send({ content: TEXTOS[r.problema](id), allowedMentions: { users: [id] } });
        } catch (e) {
          anotar('⚠️ no pude avisar en el chat de la llamada:', String(e.message || e).slice(0, 100));
        }
      }
    } finally {
      this.midiendo = false;
    }
  }

  /** Cada vuelta: ¿sigue habiendo gente? */
  revisar() {
    if (this.cerrando) return;
    if (this.pausa) { this.revisarPausa(); return; }
    const c = this.guild.channels.cache.get(this.canal.id);
    const n = c ? gente(c).n : 0;
    const sigue = this.eventoSigue();
    // ↪️ se vació, pero el evento sigue: ¿se mudó de canal?
    if (n < SALIR_CON && (sigue || !this.eventoVisto) && this.mudarse()) return;
    if (n < SALIR_CON) this.vacia ??= Date.now();
    else this.vacia = null;
    // 🏁 ya vio el evento y el evento terminó: sale aunque la llamada siga llena (lo de después es charla o un cypher)
    if (this.eventoVisto && !sigue) this.sinEvento ??= Date.now();
    else this.sinEvento = null;
    if (this.ms() >= MAX_H * 3600000) { this.terminar(`llegó a ${MAX_H} h`); return; }
    // ✂️⏸️ qué hacer: lo decide `decidirFin()` (reserva.js) con lo que avisó el organizador y si la llave tiene campeón
    const d = decidirFin({
      vacia: !!this.vacia && Date.now() - this.vacia >= ESPERA_SALIR,
      quieta: !!this.sinEvento && Date.now() - this.sinEvento >= ESPERA_SALIR,
      aviso: this.avisoOrg(), cerrada: !!(vivo.cerrada && vivo.cerrada.get(this.guild.id)), llaveVista: this.llaveVista,
    });
    if (d.que === 'terminar') this.terminar(d.razon);
    else if (d.que === 'pausar') {
      if (this.pausas >= PAUSAS_MAX + 2) this.terminar(d.razon);
      else this.pausar(d.razon, { hasta: d.hasta, retoma: d.retoma });
    }
  }

  async terminar(razon) {
    if (this.cerrando) return;
    this.cerrando = true;
    // 🚪 NUNCA TERMINÓ DE ENTRAR: no hay nada que entregar. Antes mandaba igual «NaN min · 0 voces» a Logs (FRZ, 24/11
    // 11:17 PM ET: Railway la apagó mientras probaba entrar) y el `grabando` de ese servidor lo cerraba el catch de `entrar()`
    if (this.t0 === undefined) {
      anotar(`⏹️ ${this.guild.name}: ${razon} antes de terminar de entrar, no hay nada que entregar`);
      try { this.con?.destroy(); } catch (e) { /* ya estaba cerrada */ }
      if (grabando.get(this.guild.id) === this) grabando.delete(this.guild.id);
      fs.rmSync(this.dir, { recursive: true, force: true });
      return;
    }
    const fin = this.ms();
    anotar(`⏹️ termina (${razon}) a los ${largo(fin / 1000)}`);
    clearInterval(this.reloj);
    clearInterval(this.fotos);
    for (const st of this.subs.values()) st.destroy();
    try { this.con.destroy(); } catch (e) { /* ya estaba cerrada */ }
    this.ponerApodo(false);
    const voces = [];
    for (const [id, p] of this.pistas) {
      p.silencioHasta(fin);
      p.cerrar();
      if (p.paquetes > 0) voces.push(id);
      else fs.rmSync(p.ruta, { force: true });
    }
    try {
      // ✂️ SIN LA ESPERA DEL FINAL (21/11/2026): para saber que la llamada se vació, el grabador espera `ESPERA_SALIR` (5 min)
      // con menos de `SALIR_CON`, y esos minutos quedaban en el archivo: la grabación de DESGRACIAS EN TOKYO VOL 32 terminaba
      // con 4 min 43 s de silencio. Se entrega hasta que se vació, con `COLA_S` de aire
      let hasta = razon === 'se vació la llamada' && this.vacia
        ? Math.min(fin, this.enGrabacion(this.vacia) + COLA_S * 1000) : fin;
      // 🏁 y si terminó el evento, hasta `COLA_EVENTO_MIN` después de la última edición de su llave
      const ed = vivo.ed.get(this.guild.id) || 0;
      // (una edición de antes de la última vuelta no recorta: descontarle lo de afuera cortaría audio de verdad)
      if (razon === 'terminó el evento' && this.llaveVista && ed > this.inicio.getTime() && ed >= (this.volvio || 0)) {
        hasta = Math.min(hasta, this.enGrabacion(ed) + COLA_EVENTO_MIN * 60000);
      }
      // ✂️ lo muy corto no es un evento: se anota y no se entrega
      if (hasta / 1000 < MIN_ENTREGA_S) {
        anotar(`✂️ ${this.guild.name}: ${largo(hasta / 1000)} no es un evento, no se entrega`);
        grabando.delete(this.guild.id);
        fs.rmSync(this.dir, { recursive: true, force: true });
        return;
      }
      // 🧯 hasta dónde se entrega, por si Railway la apaga mezclando (`dejarParaDespues()`)
      this.hastaS = hasta / 1000;
      await this.entregar(voces, hasta / 1000, razon);
      this.entregada = true;
    } catch (e) {
      anotar('❌ no pude entregar la grabación:', String(e.message || e).slice(0, 300));
    }
    grabando.delete(this.guild.id);
  }

  /** ⏳ Las batallas que no salieron: lo dice en Logs y vuelve a probar a los `esperas` minutos (sigue después de
   * terminar la grabación: la carpeta se borra al final). Si se reinicia el servicio en el medio, se pierde: queda habla.json */
  reintentarBatallas(canal, mezcla, seg, motivo, esperas) {
    const quedan = [...esperas];
    canal.send({ content: `⚔️ No pude separar las batallas de esta grabación: ${motivo}.`
      + (quedan.length ? ` Vuelvo a probar en ${quedan[0]} min.` : ''), allowedMentions: { parse: [] } }).catch(() => {});
    if (!quedan.length) { this.limpiar(); return; }
    setTimeout(async () => {
      let res = null;
      try { res = await this.entregarBatallas(canal, mezcla, seg); } catch (e) {
        res = { ubicadas: 0, motivo: String(e.message || e).slice(0, 120) };
      }
      if (res && res.ubicadas) {
        anotar(`⚔️ al reintentar: ${res.ubicadas} batallas`);
        this.limpiar();
      } else this.reintentarBatallas(canal, mezcla, seg, res?.motivo || 'sin motivo', quedan.slice(1));
    }, quedan[0] * 60000).unref?.();
  }

  /** 🩺 Cómo se escuchó cada uno: el conteo por color y, de los que no dieron 🟢, quién y por qué. */
  informe(gente) {
    const filas = gente.map((id) => ({ id, r: this.medidores.get(id)?.resumen() })).filter((x) => x.r && x.r.color !== '⚪');
    if (!filas.length) return '';
    const n = (c) => filas.filter((x) => x.r.color === c).length;
    // en qué parte de lo que habló (`resumen().parte`), y el número de todo el evento entre paréntesis
    const por = (r) => `${{ corta: 'se corta', satura: 'satura', bajo: 'bajito', telefono: 'calidad de teléfono' }[r.peor]}`
      + ` en el ${Math.round((r.parte || 0) * 100)} % de lo que habló (` + ({
      corta: `${Math.round(r.perdida * 100)} % perdido en total`,
      satura: `${r.db?.toFixed(0)} dB de promedio`,
      bajo: `${r.db?.toFixed(0)} dB de promedio`,
      telefono: `${Math.round(r.angosta * 100)} % en banda angosta`,
    })[r.peor] + ')';
    const malos = filas.filter((x) => x.r.peor).sort((a, b) => (a.r.color === '🔴' ? -1 : 1) - (b.r.color === '🔴' ? -1 : 1));
    return `🩺 Cómo se escuchó: 🟢 ${n('🟢')} · 🟡 ${n('🟡')} · 🔴 ${n('🔴')}`
      + malos.slice(0, 12).map((x) => `\n${x.r.color} ${this.quien.get(x.id)?.nombre || x.id} — ${por(x.r)}`).join('')
      + (malos.length > 12 ? `\n… y ${malos.length - 12} más` : '');
  }

  /** `seg`: hasta dónde va la grabación (puede ser menos de lo grabado: ver la espera del final en `terminar()`). */
  async entregar(voces, seg, razon) {
    const canal = await this.client.channels.fetch(ENTREGA);
    const gente = voces.filter((id) => !this.quien.get(id)?.bot);
    const nombres = gente.map((id) => this.quien.get(id)?.nombre || id);
    const cab = `🎙️ **Grabación** · ${this.guild.name} · <#${this.canal.id}>\n`
      + `${horaET(this.inicio)} · ${largo(seg)} · ${gente.length} voces`
      + (voces.length > gente.length ? ' + la música' : '')
      + `\nEntró porque ${this.motivo}; salió porque ${razon}.`
      + (this.pausas && this.afuera > 0 ? `\n↩️ Se cortó ${this.pausas === 1 ? '1 vez' : this.pausas + ' veces'} y siguió`
        + ` (${[...new Set(this.razonesPausa || ['me sacaron de la llamada'])].join('; ')}): va todo junto, sin los ${largo(this.afuera / 1000)} del medio.` : '');
    if (!voces.length) {
      await canal.send({ content: cab + '\nNo habló nadie: no hay audio.', allowedMentions: { parse: [] } });
      return;
    }
    const t = performance.now();
    this.trabajo = this.trabajo || fs.mkdtempSync(path.join(os.tmpdir(), 'ulaya-'));
    const mezcla = path.join(this.trabajo, 'mezcla.ogg');
    // cada voz al mismo volumen (mezcla.js): se mide de a una, y la música de los bots queda debajo
    const cada = [];
    for (const id of voces) {
      const musica = !!this.quien.get(id)?.bot;
      cada.push({ db: ganancia(await sonoridad(this.pistas.get(id).ruta), musica), musica });
    }
    await mezclar(voces.map((id) => this.pistas.get(id).ruta), mezcla, cada);
    // ✂️ lo grabado después de `seg` (la espera del final) no va
    if (duracion(mezcla) > seg + 2) {
      const corta = path.join(this.trabajo, 'mezcla_corta.ogg');
      await cortar(mezcla, 0, seg, corta);
      fs.renameSync(corta, mezcla);
    }
    const mb = fs.statSync(mezcla).size / 1e6;
    anotar(`🎚️ mezcla: ${voces.length} pistas, ${mb.toFixed(1)} MB, ${((performance.now() - t) / 1000).toFixed(0)} s`
      + ` · ganancias ${cada.map((c) => (c.db > 0 ? '+' : '') + c.db).join(' ')}`);
    const informe = this.informe(gente);
    let tope = topeDe(this.guild?.id === canal.guildId ? this.guild : canal.guild);
    for (let intento = 0; intento < 3; intento++) {
      const partes = await partir(mezcla, tope);
      try {
        for (let i = 0; i < partes.length; i++) {
          const nombre = `grabacion-${this.inicio.toISOString().slice(0, 10)}${partes.length > 1 ? '-parte' + (i + 1) : ''}.ogg`;
          await canal.send({
            content: i === 0
              ? (cab + `\n${nombres.slice(0, 40).join(', ')}${nombres.length > 40 ? '…' : ''}`
                + (informe ? '\n' + informe : '')
                + (partes.length > 1 ? `\nParte 1 de ${partes.length} (${largo(duracion(partes[0]))})` : '')).slice(0, 1990)
              : `Parte ${i + 1} de ${partes.length}`,
            files: [{ attachment: partes[i], name: nombre }],
            allowedMentions: { parse: [] },
          });
        }
        // 🗣️ QUIÉN HABLÓ CUÁNDO, SIEMPRE (24/11/2026): sin esto, si las batallas no salen acá nadie las puede separar
        // después (vive sólo en la memoria de esta grabación). Son IDs y milisegundos desde el inicio, sin audio
        try {
          const hj = path.join(this.trabajo, 'habla.json');
          fs.writeFileSync(hj, JSON.stringify({ v: 1, servidor: this.guild?.id || '', inicio: this.inicio.toISOString(),
            seg: Math.round(seg), habla: Object.fromEntries(this.habla.t) }));
          await canal.send({ files: [{ attachment: hj, name: 'habla.json' }], allowedMentions: { parse: [] } });
        } catch (e) { anotar('⚠️ habla.json:', String(e.message || e).slice(0, 120)); }
        // ⚔️ y cada batalla por separado, si se puede: nunca frena la entrega de la grabación entera
        let res = null;
        try { res = await this.entregarBatallas(canal, mezcla, seg); } catch (e) {
          anotar('⚠️ no pude armar las batallas:', String(e.message || e).slice(0, 200));
          res = { ubicadas: 0, motivo: String(e.message || e).slice(0, 120) };
        }
        if (res && !res.ubicadas) {
          // la llave puede terminar de cargarse después de que se vació la llamada: se vuelve a probar dos veces
          this.reintentarBatallas(canal, mezcla, seg, res.motivo, [15, 30]);
          return;
        }
        this.limpiar();
        return;
      } catch (e) {
        // 40005: el archivo es más grande de lo que acepta ese canal. Se parte más chico y se vuelve a mandar
        if (e?.code !== 40005 && e?.status !== 413) throw e;
        tope = Math.floor(tope / 2);
        anotar('↩️ Discord no aceptó ese tamaño; parto en pedazos de', (tope / 1e6).toFixed(1), 'MB');
        for (const f of fs.readdirSync(this.trabajo)) if (f.startsWith('mezcla_parte')) fs.rmSync(path.join(this.trabajo, f));
      }
    }
    throw new Error('Discord no aceptó ni partido en cuatro');
  }

  /**
   * ⚔️ UN AUDIO POR BATALLA (batallas.js). Le pide al Worker las batallas de las llaves de este servidor que se tocaron
   * mientras grababa (con la cuenta de cada lado), las ubica por cuándo habló cada uno, y manda la lista con los minutos
   * y un audio de cada una, en mensajes de hasta 10 archivos.
   */
  async entregarBatallas(canal, mezcla, seg) {
    const q = new URLSearchParams({ g: this.guild.id, desde: String(this.inicio.getTime()), hasta: String(this.finReloj || Date.now()) });
    const r = await fetch(VIGIA + '/avisos/batallas?' + q, { headers: { 'x-lg-ciclo': claveCiclo(E.DISCORD_TOKEN) },
      signal: AbortSignal.timeout(20000) });
    const d = r.ok ? await r.json() : {};
    const total = (d.llaves || []).reduce((s, L) => s + (L.rondas || []).reduce((t, R) => t + (R.b || []).length, 0), 0);
    // 🔎 el lado que la llave no supo de quién era, buscado entre quienes hablaron en ESTA llamada (batallas.js `completarIds()`)
    const voces = new Map();
    for (const id of this.habla.t.keys()) {
      const m = this.guild?.members?.cache?.get(id);
      voces.set(id, [m?.displayName, m?.nickname, m?.user?.globalName, m?.user?.username].filter(Boolean));
    }
    const completos = completarIds(d.llaves, voces);
    if (completos.length) anotar(`🔎 de la llamada: ${completos.map(([n]) => n).join(', ')}`);
    // ⚓ las anclas del evento (`ancla` de cada batalla, ms de reloj) pasadas a segundos de esta grabación (sin lo de afuera)
    const bs = ubicarTodas(d.llaves, this.habla.t, seg, (ts) => this.enGrabacion(ts) / 1000);
    // 🔁 el suplente, con el nombre que tenía en la llamada
    for (const b of bs) {
      if (!b.suplente) continue;
      const n = (voces.get(b.suplente.id) || [])[0] || 'alguien de la llamada';
      const p = (b.personas[b.suplente.lado] || [])[0];
      if (p) p.n = n;
      b.nota = `entró ${n} por ${b.nombres[b.suplente.lado] || 'el de la llave'}`;
    }
    const faltan = sinUbicar(d.llaves, bs, this.habla.t);
    anotar(`⚔️ batallas: ${bs.length} ubicadas de ${total} en la llave`);
    // 🔇 SE CALLABA (24/11/2026, DESGRACIAS EN TOKYO VOL 35: 1 h 44 entregada sin batallas y sin decir por qué; el armador
    // de shorts se quedó esperando). Ahora devuelve cuántas y por qué no, y `entregar()` lo dice en Logs y reintenta
    if (!bs.length) return { ubicadas: 0, total, motivo: !r.ok ? `el Worker contestó ${r.status}` : !total ? 'no hay llave tocada mientras grababa' : `0 de ${total} batallas de la llave ubicadas por quién habló` };
    // 🎭 quién es quién en cada una (el foco del short): por ahora al log, para comprobarlo en un evento de verdad
    for (const b of bs) {
      try { b.guion = guion(b, this.habla.t); anotar(`🎭 ${b.nombres.join(' vs ')}: ${resumenGuion(b.guion)}`); } catch (e) {
        anotar('⚠️ guion:', String(e.message || e).slice(0, 100));
      }
    }
    const tope = topeDe(this.guild?.id === canal.guildId ? this.guild : canal.guild);
    const clips = [];
    for (const [i, b] of bs.entries()) {
      if (b.corta) continue;
      const ruta = path.join(this.trabajo || this.dir, `batalla-${i}.ogg`);
      await cortar(mezcla, b.desde, b.hasta, ruta);
      // ✂️ el archivo también se mide: un corte sin volver a codificar puede salir más corto que el tramo
      if (duracion(ruta) < MIN_CLIP_S) { b.corta = true; continue; }
      const pesa = fs.statSync(ruta).size;
      // 📦 y uno que no entra en un mensaje tampoco se manda: se saltaba callado (FFA, 23/11 2:24 AM: 5 en la lista, 3 audios)
      if (pesa > tope) { b.sinAudio = `pesa ${(pesa / 1e6).toFixed(1)} MB y el canal acepta ${(tope / 1e6).toFixed(0)}`; continue; }
      clips.push({ attachment: ruta, name: nombreClip(b), peso: pesa });
    }
    const sinAudio = bs.filter((b) => b.corta || b.sinAudio).length;
    if (sinAudio) anotar(`✂️ ${sinAudio} batallas sin audio (muy cortas o muy pesadas)`);
    let texto = `⚔️ **Las batallas**, en minutos desde que empezó la grabación (aprox.: salen de quién habló cuándo)`
      + ` · ${bs.length} de ${total}` + (sinAudio ? ` · ${sinAudio} sin audio` : '');
    for (const l of bs.map(lineaBatalla)) { if ((texto + '\n' + l).length > 1900) { texto += '\n…'; break; } texto += '\n' + l; }
    // ❔ LAS QUE NO SALIERON Y POR QUÉ (25/11/2026): del 22 al 24/11 faltó una de cada tres y la entrega no decía cuáles, así
    // que no se podía saber qué arreglar. Van también en batallas.json (`sin_ubicar`)
    for (const f of faltan) {
      const l = `❔ ${f.r} · ${f.nombres.join(' vs ')} — ${f.por}`;
      if ((texto + '\n' + l).length > 1950) { texto += '\n…'; break; }
      texto += '\n' + l;
    }
    // 🎭 EL GUION DE CADA BATALLA, ADJUNTO (Dlx, 23/11/2026: «haz eso y mejóralo»): quién rapea cuándo —y en un 2vs2, cuál de la
    // pareja—, el público y el presentador, en segundos desde el principio de SU clip. Lo lee el armador de shorts en GitHub
    // Actions: sin esto no sabe qué carta hacer brillar ni dónde cambia de rival la letra. Va en el primer mensaje, con la lista
    const guiones = path.join(this.trabajo || this.dir, 'batallas.json');
    fs.writeFileSync(guiones, JSON.stringify({
      v: 1, servidor: this.guild?.id || '', inicio: this.inicio.toISOString(),
      batallas: bs.map((b) => ({ clip: (b.corta || b.sinAudio) ? null : nombreClip(b), r: b.r, llave: b.llave, evento: b.evento,
        nombres: b.nombres, gano: b.gano, desde: Math.round(b.desde * 10) / 10, hasta: Math.round(b.hasta * 10) / 10, guion: b.guion || null,
        personas: b.personas, ...(b.nota ? { nota: b.nota } : {}), ...(b.anclada ? { anclada: true } : {}) })),
      sin_ubicar: faltan, de_la_llamada: completos.length,
    }));
    let lote = [], peso = 0, primero = true;
    const mandar = async () => {
      if (!lote.length && !primero) return;
      const files = lote.map(({ attachment, name }) => ({ attachment, name }));
      if (primero) files.unshift({ attachment: guiones, name: 'batallas.json' });
      await canal.send({ content: primero ? texto : undefined, files, allowedMentions: { parse: [] } });
      primero = false;
      lote = [];
      peso = 0;
    };
    for (const c of clips) {
      // el primer mensaje lleva además el guion: 9 clips, no 10
      if (lote.length >= (primero ? 9 : 10) || peso + c.peso > tope - (primero ? fs.statSync(guiones).size : 0)) await mandar();
      lote.push(c);
      peso += c.peso;
    }
    await mandar();
    return { ubicadas: bs.length, total };
  }
}

// ── el ciclo ──────────────────────────────────────────────────────────────
const grabando = new Map();   // guild -> Grabacion
const pendiente = new Map();  // guild -> { canal, desde }
const avisadoSinPermiso = new Set();

async function vuelta(client) {
  // los que ya se están grabando siguen en la lista aunque su llave deje de estar «en juego» (si no, nadie los cierra)
  limpiarApodos(client);
  for (const gid of new Set([...(await servidoresAMirar()), ...grabando.keys()])) {
    const guild = client.guilds.cache.get(gid);
    if (!guild) continue;
    const g = grabando.get(gid);
    // la que todavía está entrando (`entrar()` no se espera) no se revisa: mudarla o cerrarla a medio conectar la rompe
    if (g) { if (g.t0 !== undefined) g.revisar(); continue; }
    // con el mismo bot haciendo una prueba de micro ahí, entrar a grabar lo sacaría de esa llamada: se espera
    if (prueba && prueba.client === client && prueba.activa(gid)) continue;
    // 📣 con un evento anunciado ahora, la llamada donde está quien lo anunció manda sobre la que tiene más gente
    const org = GRABAR_TODOS ? conOrganizador(guild, (await anunciados()).get(gid)) : null;
    const c = org && org.n >= MIN_ORG && !org.otro ? org : candidata(guild);
    // el piso es el más bajo de los dos: con MIN_SIN=1 (la prueba de una persona) el de MIN_VIVO lo dejaba afuera
    if (!c || c.n < Math.min(MIN_VIVO, MIN_SIN, MIN_ORG) || c.otro) { pendiente.delete(gid); continue; }
    // 🌎 fuera de `GRABAR_EN`, sólo con una llave viva o con el organizador de un evento anunciado (ver `GRABAR_TODOS`)
    // se entra POR GENTE (sólo los de `GRABAR_EN`, con `MIN_SIN`), POR ORGANIZADOR (`MIN_ORG`) o POR LLAVE viva (`MIN_VIVO`)
    const porGente = GRABAR_EN.includes(gid) && c.n >= MIN_SIN;
    const porOrg = !porGente && !!c.org;
    const enJuego = !porGente && !porOrg && c.n >= MIN_VIVO && (await llavesEnJuego(true)).has(gid);
    if (!porGente && !porOrg && !enJuego) { pendiente.delete(gid); continue; }
    const p = pendiente.get(gid);
    if (!p || p.canal !== c.canal.id) { pendiente.set(gid, { canal: c.canal.id, desde: Date.now() }); continue; }
    if (Date.now() - p.desde < ESPERA_ENTRAR) continue;
    if (grabando.size >= MAX_A_LA_VEZ) {
      if (!p.lleno) anotar(`🧮 ${guild.name}: ya hay ${grabando.size} grabaciones (el tope es ${MAX_A_LA_VEZ}), espera`);
      p.lleno = true;
      continue;
    }
    // 🚪 después de una falla al entrar, espera (`REINTENTO_MIN` de entrada.js; aislada, hasta que se le termine)
    if (!fallas.puede(gid)) continue;
    const motivo = porOrg ? `había ${c.n} personas con quien anunció el evento de ${guild.name}`
      : enJuego ? `había ${c.n} personas y una llave de ${guild.name} en juego` : `había ${c.n} personas`;
    const yo = guild.members.me;
    // 🔇 AISLADA (timeout): no hay nada que probar hasta que se le termine. Se dice en Logs, una vez por evento
    const ais = yo?.communicationDisabledUntilTimestamp > Date.now() ? yo.communicationDisabledUntilTimestamp : null;
    if (ais) { reportarFalla(client, guild, c.canal, c.n, motivo, 'aislada', ais); continue; }
    const puede = yo && c.canal.permissionsFor(yo)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]);
    if (!puede) {
      if (!avisadoSinPermiso.has(c.canal.id)) anotar(`⚠️ sin permiso para entrar a ${guild.name} / ${c.canal.name}`);
      avisadoSinPermiso.add(c.canal.id);
      reportarFalla(client, guild, c.canal, c.n, motivo, `no tiene permiso de ver o entrar a <#${c.canal.id}>`);
      continue;
    }
    pendiente.delete(gid);
    const nueva = new Grabacion(client, guild, c.canal, motivo);
    grabando.set(gid, nueva);
    // 🚪 SIN `await`: entrar puede tardar los 30 s de `entersState` y, esperándolo, la vuelta frenaba a los demás servidores
    entrar(client, nueva, c.n);
  }
}

// ── 💾 lo que quedó de antes de un reinicio ───────────────────────────────
//: 💽 una carpeta de más de esto se borra al arrancar, entregada o no (nunca una que se está grabando)
export const VIEJA_DIAS = 7;

async function recuperar(client) {
  if (!fs.existsSync(BASE)) return;
  for (const d of fs.readdirSync(BASE)) {
    const dir = path.join(BASE, d), ej = path.join(dir, 'estado.json');
    if ([...grabando.values()].some((g) => g.dir === dir)) continue;
    // 💽 lo trabado no ocupa el disco para siempre: más de `VIEJA_DIAS`, sin estado.json pasado un día, o ya intentado
    // `RECUPERAR_MAX` veces sin poder entregarlo
    let edad = 0;
    try { edad = Date.now() - fs.statSync(dir).mtimeMs; } catch (x) { continue; }
    let e = null;
    try { e = JSON.parse(fs.readFileSync(ej, 'utf8')); } catch (x) { e = null; }
    if (edad > VIEJA_DIAS * 86400000 || (!e && edad > 86400000) || (e && (e.intentos || 0) >= RECUPERAR_MAX)) {
      anotar(`💽 borro ${d}: ${!e ? 'sin estado' : (e.intentos || 0) >= RECUPERAR_MAX ? 'no se pudo entregar' : 'vieja'}`);
      fs.rmSync(dir, { recursive: true, force: true });
      continue;
    }
    if (!e) continue;
    e.intentos = (e.intentos || 0) + 1;
    fs.writeFileSync(ej, JSON.stringify(e));
    const guild = client.guilds.cache.get(String(e.g));
    if (!guild) continue;
    const canal = guild.channels.cache.get(String(e.canal)) || { id: String(e.canal), name: '?' };
    const r = new Grabacion(client, guild, canal, e.motivo || 'había un evento');
    r.dir = dir;
    r.inicio = new Date(e.inicio);
    r.afuera = Number(e.afuera) || 0;
    r.pausas = Number(e.pausas) || 0;
    r.cerrando = true;
    r.quien = new Map(Object.entries(e.quien || {}));
    for (const [id, l] of Object.entries(e.habla || {})) r.habla.t.set(id, l);
    for (const id of e.voces || []) {
      const ruta = path.join(dir, id + '.ogg');
      if (fs.existsSync(ruta) && fs.statSync(ruta).size > 0) r.pistas.set(id, { ruta });
    }
    const voces = [...r.pistas.keys()];
    const seg = largoRecuperada(e, voces.map((id) => duracion(r.pistas.get(id).ruta)));
    r.finReloj = r.inicio.getTime() + seg * 1000 + r.afuera;
    if (seg < MIN_ENTREGA_S) { fs.rmSync(dir, { recursive: true, force: true }); continue; }
    anotar(`💾 ${guild.name}: entrego lo que quedó de antes del reinicio (${largo(seg)})`);
    try {
      await r.entregar(voces, seg, (e.cortada ? 'se reinició el grabador' : 'se cayó el grabador') + ' (lo grabado hasta ahí, entregado al volver)');
    } catch (x) {
      anotar('❌ no pude entregar la recuperada:', String(x.message || x).slice(0, 200));
    }
  }
}

// ── 🚪 cuando no puede entrar (entrada.js) ────────────────────────────────
const fallas = new Fallas();
const apodosColgados = new Set();   // servidores donde quedó «🔴 GRABANDO» y no se lo pudo sacar (ver `ponerApodo`)
let apodosT = 0;

async function entrar(client, nueva, n) {
  const gid = nueva.guild.id;
  try {
    await nueva.empezar();
    alPanel({ g: gid, tipo: 'ok' });
    const f = fallas.entro(gid);
    if (f?.aviso) {
      editarAviso(client, f, textoFalla({ servidor: nueva.guild.name, canal: nueva.canal.id, porque: nueva.motivo, f,
        horaET, entro: Date.now() }));
    }
  } catch (e) {
    try { nueva.con?.destroy(); } catch (x) { /* nada */ }
    if (grabando.get(gid) === nueva) grabando.delete(gid);
    if (nueva.cerrando) return;     // la cerró el apagado mientras entraba: no es una falla para avisar
    const ais = await aisladaHasta(nueva.guild);
    const f = await reportarFalla(client, nueva.guild, nueva.canal, n, nueva.motivo, String(e.message || e), ais);
    anotar(`❌ no pude entrar a la llamada de ${nueva.guild.name} (intento ${f?.n ?? '?'}):`, String(e.message || e).slice(0, 200)
      + (ais ? ` · está aislada hasta las ${horaET(new Date(ais))}` : ''));
  }
}

/** Hasta cuándo está aislada (timeout) en ese servidor, preguntándole a Discord y no a la memoria; o `null`. */
async function aisladaHasta(guild) {
  try {
    const me = await guild.members.fetchMe({ force: true });
    const t = me.communicationDisabledUntilTimestamp;
    return t && t > Date.now() ? t : null;
  } catch (e) {
    return null;
  }
}

/** Anota la falla y la dice en Logs de DRA: un mensaje por evento, que se edita con cada intento. Devuelve la fila. */
/**
 * 🏟️ AL PANEL DEL SOCIO (25/11/2026, Dlx: «me gustan todos»): aislada o sin permiso, también se le dice al servidor —en su
 * panel de la página y a la campana de su equipo, nunca por DM— con qué tocar para arreglarlo (`grabadorFalla()` de
 * bot/avisos.js). Hasta acá iba sólo a Logs de DRA, y FRZ la tuvo aislada dos eventos sin enterarse. Al entrar bien se borra
 */
function alPanel(cuerpo) {
  fetch(VIGIA + '/avisos/grabador-falla', { method: 'POST', signal: AbortSignal.timeout(10000),
    headers: { 'content-type': 'application/json', 'x-lg-ciclo': claveCiclo(E.DISCORD_TOKEN) }, body: JSON.stringify(cuerpo) })
    .catch((e) => anotar('⚠️ al panel del socio:', String(e.message || e).slice(0, 80)));
}

async function reportarFalla(client, guild, canal, n, porque, error, aislada = null) {
  const gid = guild.id;
  // la misma falla repetida dentro de la espera (aislada, sin permiso) no cuenta como otro intento
  if (!fallas.puede(gid)) return fallas.m.get(gid);
  // (después del freno: una vez por intento, no en cada vuelta)
  if (aislada) alPanel({ g: gid, tipo: 'aislada', hasta: Number(aislada) });
  else if (/^no tiene permiso/.test(String(error || ''))) alPanel({ g: gid, tipo: 'permiso', canal: String(canal.id), n: String(canal.name || '') });
  const f = fallas.fallo(gid, motivoDe(error, aislada, horaET), Date.now(), aislada);
  const texto = textoFalla({ servidor: guild.name, canal: canal.id, porque, f, horaET, sacada: error === 'me aislaron' });
  await editarAviso(client, f, texto);
  return f;
}

async function editarAviso(client, f, texto) {
  try {
    const logs = await client.channels.fetch(ENTREGA);
    if (f.aviso) {
      try { await logs.messages.edit(f.aviso, { content: texto, allowedMentions: { parse: [] } }); return; } catch (e) {
        /* lo borraron: va uno nuevo */
      }
    }
    const m = await logs.send({ content: texto, allowedMentions: { parse: [] } });
    f.aviso = m.id;
  } catch (e) {
    anotar('⚠️ no pude avisar en Logs que no entré:', String(e.message || e).slice(0, 100));
  }
}

/** 🔴 El apodo «GRABANDO» que quedó colgado (aislada no se lo pudo sacar): cada 10 min, donde no está grabando. */
function limpiarApodos(client) {
  if (!apodosColgados.size || Date.now() - apodosT < 600000) return;
  apodosT = Date.now();
  for (const gid of [...apodosColgados]) {
    if (grabando.has(gid)) continue;
    const me = client.guilds.cache.get(gid)?.members.me;
    if (!me || !esApodoGrabando(me.nickname)) { apodosColgados.delete(gid); continue; }
    me.setNickname(null, 'terminó la grabación').then(() => apodosColgados.delete(gid)).catch(() => {});
  }
}

// ── lo que se mide: cuánto gasta, para el precio de Railway ──────────────
let cpuAntes = process.cpuUsage(), tAntes = performance.now();
function medir() {
  const cpu = process.cpuUsage(cpuAntes), dt = performance.now() - tAntes;
  cpuAntes = process.cpuUsage(); tAntes = performance.now();
  const pct = ((cpu.user + cpu.system) / 1000 / dt) * 100;
  const g = [...grabando.values()].map((x) => (x.t0 === undefined ? `${x.guild.name}: entrando…`
    : `${x.guild.name}: ${x.pistas.size} pistas, ${largo(x.ms() / 1000)}`));
  anotar(`📊 ${(process.memoryUsage().rss / 1e6).toFixed(0)} MB · CPU ${pct.toFixed(1)} %`
    + (g.length ? ' · grabando ' + g.join('; ') : ''));
}

// ── arranque ──────────────────────────────────────────────────────────────
async function revisarYSalir(client) {
  console.log(generateDependencyReport());
  const llaves = await llavesEnJuego();
  // 🌎 con `GRABAR_TODOS`, todos los servidores donde está el bot: para ver los permisos de cada uno antes de que juegue
  const todos = GRABAR_TODOS ? [...new Set([...GRABAR_EN, ...client.guilds.cache.keys()])] : GRABAR_EN;
  for (const gid of todos) {
    const guild = client.guilds.cache.get(gid);
    if (!guild) { console.log(`❌ ${gid}: el bot no está en ese servidor`); continue; }
    console.log(`\n${guild.name} (tope de archivo ${topeDe(guild) / 1e6} MB, llave en juego: ${llaves.has(gid) ? 'sí' : 'no'})`);
    const ais = guild.members.me?.communicationDisabledUntilTimestamp;
    if (ais > Date.now()) console.log(`  🔇 AISLADA (timeout) hasta las ${horaET(new Date(ais))}: no puede entrar a ninguna llamada`);
    const solo = canalesDe(gid);
    for (const c of guild.channels.cache.values()) {
      if (!c.isVoiceBased()) continue;
      const g = gente(c);
      if (solo && !solo.includes(c.id)) { console.log(`  ${String(g.n).padStart(3)} · ${c.name} (no es de competencia: no se graba)`); continue; }
      const yo = guild.members.me;
      const puede = c.permissionsFor(yo)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]);
      console.log(`  ${String(g.n).padStart(3)} · ${c.name}${c.id === guild.afkChannelId ? ' (AFK)' : ''}`
        + `${g.otro ? ' · ya hay otro grabador' : ''}${puede ? '' : ' · ⚠️ sin permiso para entrar'}`);
    }
    const c = candidata(guild);
    const entra = c && !c.otro && ((GRABAR_EN.includes(gid) && c.n >= MIN_SIN) || (c.n >= MIN_VIVO && llaves.has(gid)));
    console.log(`  → ${entra ? `entraría a ${c.canal.name} en ${ESPERA_ENTRAR / 1000} s` : 'no entraría a ninguna'}`);
  }
  for (const id of PRUEBA_MICRO) {
    const c = await client.channels.fetch(id).catch(() => null);
    const yo = c?.guild?.members.me;
    const puede = c && c.permissionsFor(yo)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak]);
    console.log(`prueba de micro: ${c ? `${c.guild.name} / ${c.name}` : '❌ no veo el canal ' + id}`
      + (c && !puede ? ' · ⚠️ sin permiso para entrar o hablar' : '')
      + ` · la hace ${E.PRUEBA_TOKEN ? 'el segundo bot' : 'este bot (cuando no graba ahí)'}`);
  }
  let ok = false;
  try { await client.channels.fetch(ENTREGA); ok = true; } catch (e) { /* abajo */ }
  console.log(`\nentrega: ${ok ? 'el canal existe y el bot lo ve' : '❌ el bot no ve el canal ' + ENTREGA}`);
  client.destroy();
  process.exit(0);
}

process.on('unhandledRejection', (e) => anotar('⚠️ sin atrapar:', String(e?.message || e).slice(0, 200)));
process.on('uncaughtException', (e) => anotar('⚠️ sin atrapar:', String(e?.message || e).slice(0, 200)));
process.on('SIGTERM', async () => {
  anotar('🛑 Railway me apaga: cierro lo que haya');
  // 👀 la tanda del público que estaba juntando, antes de irse (si no, se pierden esos minutos)
  if (llamadas) await llamadas.mandarPublico(Date.now(), true).catch(() => {});
  // 💾 con una carpeta propia (`CARPETA`, un volumen de Railway) se deja para el próximo arranque: mezclar no entra en los
  // 180 s que da Railway. Sin ella se intenta como siempre (una grabación corta sí llega)
  await Promise.allSettled([...grabando.values()].map((g) => (E.CARPETA && g.t0 !== undefined
    ? g.dejarParaDespues() : g.terminar('se reinició el grabador'))));
  process.exit(0);
});

if (!E.DISCORD_TOKEN) {
  console.log('❌ falta DISCORD_TOKEN (en Railway: Variables)');
  process.exit(1);
}
// 💬 GuildMessages (no privilegiado) para `@ULAYA card` (mencion.js): sin Message Content, sólo llega el texto de lo que
// menciona al bot. Los mensajes NO se guardan en memoria (MessageManager: 0): no hacen falta y crecerían sin parar
const MENCION = E.MENCION !== '0';
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates].concat(MENCION ? [GatewayIntentBits.GuildMessages] : []),
  makeCache: Options.cacheWithLimits({ ...Options.DefaultMakeCacheSettings, MessageManager: 0 }),
});
client.once(Events.ClientReady, async () => {
  anotar(`✅ conectado como ${client.user.tag} · graba en ${GRABAR_TODOS ? 'todos los servidores con una llave en juego (y '
    + GRABAR_EN.length + ' fijo/s)' : GRABAR_EN.length + ' servidor(es)'} · entrega en ${ENTREGA}`);
  if (process.argv.includes('--revisar')) return revisarYSalir(client);
  // 💾 lo que quedó de antes de un reinicio, a Logs (sin esperar: no frena el arranque)
  recuperar(client).catch((e) => anotar('⚠️ recuperar:', String(e.message || e).slice(0, 150)));
  // 🔴 un reinicio en medio de una grabación deja el apodo «GRABANDO» colgado: al arrancar no graba nada, así que se limpia
  for (const g of client.guilds.cache.values()) {
    const me = g.members.me;
    if (me && esApodoGrabando(me.nickname)) {
      me.setNickname(null, 'reinicio: no está grabando').catch(() => { apodosColgados.add(g.id); });
    }
  }
  setInterval(() => vuelta(client).catch((e) => anotar('⚠️ vuelta:', String(e.message || e).slice(0, 150))), 20000);
  arrancarPrueba(client);
  if (E.VIVO !== '0') {
    llamadas = new LlamadasVivo({ client, token: E.DISCORD_TOKEN, canalesDe: (gid) => CANALES_DE[gid] || null, anotar });
    llamadas.arrancar();
    anotar('🎙️👀 micrófonos y público de las llamadas en vivo: prendido');
  }
  if (MENCION) {
    const menciones = new Menciones({ client, token: E.DISCORD_TOKEN, vigia: VIGIA, clave: claveCiclo(E.DISCORD_TOKEN), anotar });
    client.on(Events.MessageCreate, (m) => { menciones.recibir(m); });
    anotar('💬 @ULAYA card / vs: prendido (MENCION=0 lo apaga)');
  }
  setInterval(medir, 300000);
  medir();
});
client.on('error', (e) => anotar('⚠️ discord:', String(e.message || e).slice(0, 150)));

/** La prueba de micro: con el segundo bot si hay `PRUEBA_TOKEN`, si no con éste. */
function arrancarPrueba(principal) {
  if (!PRUEBA_MICRO.length) return;
  const con = (cli, grupo, ocupado) => {
    prueba = new PruebaMicro({ client: cli, canales: PRUEBA_MICRO, grupo, ocupado, anotar });
    cli.on(Events.VoiceStateUpdate, (a, b) => { prueba.cambio(a, b); });
    anotar(`🎙️ prueba de micro en ${PRUEBA_MICRO.length} canal(es), con ${cli.user.tag}`);
  };
  if (!E.PRUEBA_TOKEN) return con(principal, 'default', (gid) => grabando.has(gid));
  const otro = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
  otro.once(Events.ClientReady, () => con(otro, 'prueba', () => false));
  otro.on('error', (e) => anotar('⚠️ discord (prueba):', String(e.message || e).slice(0, 150)));
  otro.login(E.PRUEBA_TOKEN).catch((e) => anotar('❌ el segundo bot no entró:', String(e.message || e).slice(0, 150)));
}
client.login(E.DISCORD_TOKEN);
