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
import { Client, GatewayIntentBits, Events, PermissionFlagsBits } from 'discord.js';
import {
  joinVoiceChannel, EndBehaviorType, VoiceConnectionStatus, entersState, generateDependencyReport,
} from '@discordjs/voice';
import { PistaOpus } from './ogg.js';
import { mezclar, partir, duracion, sonoridad, ganancia, cortar } from './mezcla.js';
import { MedidorVoz, VENTANA_S, TEXTOS, NOMBRE_PROBLEMA } from './calidad.js';
import { PruebaMicro } from './microfono.js';
import { LlamadasVivo, claveCiclo } from './vivo.js';
import { Habla, ubicarTodas, mmss, nombreClip } from './batallas.js';

const lista = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
const num = (s, d) => (Number.isFinite(Number(s)) && String(s).trim() !== '' ? Number(s) : d);
const E = process.env;

//: FFA primero (Dlx, 21/11/2026); DRA cuando termine su remodelación, y los Tier 1 de a uno
export const GRABAR_EN = lista(E.GRABAR_EN || '1468472442925092958');
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
export const MAX_H = num(E.MAX_H, 6);
//: cuántos avisos de «se te escucha mal» como mucho por evento: con más, el chat de la llamada sería sólo eso
export const AVISOS_MAX = num(E.AVISOS_MAX, 12);
//: los canales de voz de la prueba de micro (vacío = apagada). Los crea cada servidor y se cargan en Railway
export const PRUEBA_MICRO = lista(E.PRUEBA_MICRO);
let prueba = null;
//: 🎙️👀 los micrófonos y el público de las llamadas en vivo (vivo.js). `VIVO=0` en Railway lo apaga
let llamadas = null;
//: una llave publicada hace más que esto ya no cuenta como «en juego» (lo mismo que `LLAVE_H` de en_llamada.py)
const LLAVE_H = 3;
const VIGIA = 'https://liga-global-bot.liga-global-ul.workers.dev';
//: otros grabadores con los que NO se entra (vacío: ver arriba). El de Drako es «Freestyle for All», 1557056218164629535
const OTROS = new Set(lista(E.NO_SI_ESTA));
const BASE = E.CARPETA || path.join(os.tmpdir(), 'grabaciones');

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
let vivo = { t: 0, g: new Set() };
async function llavesEnJuego() {
  if (Date.now() - vivo.t < 120000) return vivo.g;
  vivo.t = Date.now();
  try {
    const r = await fetch(VIGIA + '/avisos/vivo', { signal: AbortSignal.timeout(10000) });
    const d = r.ok ? await r.json() : {};
    const g = new Set();
    for (const ll of d.llaves || []) {
      const ed = ll.ed || ll.pub;
      if (ll.g && typeof ed === 'number' && Date.now() - ed <= LLAVE_H * 3600000) g.add(String(ll.g));
    }
    vivo.g = g;
  } catch (e) {
    anotar('⚠️ el vigía no contestó:', String(e.message || e).slice(0, 80));
  }
  return vivo.g;
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
    this.dir = path.join(BASE, `${guild.id}-${this.inicio.toISOString().replace(/[:.]/g, '-')}`);
    this.pistas = new Map();     // id -> PistaOpus
    this.subs = new Map();       // id -> AudioReceiveStream
    this.quien = new Map();      // id -> { nombre, bot }
    this.medidores = new Map();  // id -> MedidorVoz (sólo personas: la música de un bot no recibe avisos)
    this.habla = new Habla();     // ⚔️ cuándo habló cada uno (sólo personas): para ubicar cada batalla (batallas.js)
    this.avisos = 0;
    this.midiendo = false;
    this.vacia = null;           // desde cuándo hay menos de SALIR_CON
    this.cerrando = false;
  }

  ms() { return performance.now() - this.t0; }

  async empezar() {
    fs.mkdirSync(this.dir, { recursive: true });
    this.con = joinVoiceChannel({
      channelId: this.canal.id, guildId: this.guild.id, adapterCreator: this.guild.voiceAdapterCreator,
      selfDeaf: false, selfMute: true,
    });
    await entersState(this.con, VoiceConnectionStatus.Ready, 30000);
    this.t0 = performance.now();
    this.inicio = new Date();
    this.con.receiver.speaking.on('start', (id) => this.escuchar(id));
    this.reloj = setInterval(() => this.medirVoces().catch((e) => anotar('⚠️ medir:', String(e.message || e).slice(0, 100))),
      VENTANA_S * 1000);
    this.con.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([entersState(this.con, VoiceConnectionStatus.Signalling, 5000),
          entersState(this.con, VoiceConnectionStatus.Connecting, 5000)]);
      } catch (e) {
        this.terminar('me sacaron de la llamada');
      }
    });
    this.con.on('error', (e) => anotar('⚠️ la conexión de voz:', String(e.message || e).slice(0, 120)));
    anotar(`🔴 grabando en ${this.guild.name} / ${this.canal.name} (${this.motivo})`);
  }

  escuchar(id) {
    if (this.cerrando || this.subs.has(id)) return;
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
    const c = this.guild.channels.cache.get(this.canal.id);
    const n = c ? gente(c).n : 0;
    if (n < SALIR_CON) {
      this.vacia ??= Date.now();
      if (Date.now() - this.vacia >= ESPERA_SALIR) this.terminar('se vació la llamada');
    } else this.vacia = null;
    if (this.ms() >= MAX_H * 3600000) this.terminar(`llegó a ${MAX_H} h`);
  }

  async terminar(razon) {
    if (this.cerrando) return;
    this.cerrando = true;
    const fin = this.ms();
    anotar(`⏹️ termina (${razon}) a los ${largo(fin / 1000)}`);
    clearInterval(this.reloj);
    for (const st of this.subs.values()) st.destroy();
    try { this.con.destroy(); } catch (e) { /* ya estaba cerrada */ }
    const voces = [];
    for (const [id, p] of this.pistas) {
      p.silencioHasta(fin);
      p.cerrar();
      if (p.paquetes > 0) voces.push(id);
      else fs.rmSync(p.ruta, { force: true });
    }
    try {
      await this.entregar(voces, fin / 1000, razon);
    } catch (e) {
      anotar('❌ no pude entregar la grabación:', String(e.message || e).slice(0, 300));
    }
    grabando.delete(this.guild.id);
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

  async entregar(voces, seg, razon) {
    const canal = await this.client.channels.fetch(ENTREGA);
    const gente = voces.filter((id) => !this.quien.get(id)?.bot);
    const nombres = gente.map((id) => this.quien.get(id)?.nombre || id);
    const cab = `🎙️ **Grabación** · ${this.guild.name} · <#${this.canal.id}>\n`
      + `${horaET(this.inicio)} · ${largo(seg)} · ${gente.length} voces`
      + (voces.length > gente.length ? ' + la música' : '')
      + `\nEntró porque ${this.motivo}; salió porque ${razon}.`;
    if (!voces.length) {
      await canal.send({ content: cab + '\nNo habló nadie: no hay audio.', allowedMentions: { parse: [] } });
      return;
    }
    const t = performance.now();
    const mezcla = path.join(this.dir, 'mezcla.ogg');
    // cada voz al mismo volumen (mezcla.js): se mide de a una, y la música de los bots queda debajo
    const cada = [];
    for (const id of voces) {
      const musica = !!this.quien.get(id)?.bot;
      cada.push({ db: ganancia(await sonoridad(this.pistas.get(id).ruta), musica), musica });
    }
    await mezclar(voces.map((id) => this.pistas.get(id).ruta), mezcla, cada);
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
        // ⚔️ y cada batalla por separado, si se puede: nunca frena la entrega de la grabación entera
        try { await this.entregarBatallas(canal, mezcla, seg); } catch (e) {
          anotar('⚠️ no pude armar las batallas:', String(e.message || e).slice(0, 200));
        }
        fs.rmSync(this.dir, { recursive: true, force: true });
        return;
      } catch (e) {
        // 40005: el archivo es más grande de lo que acepta ese canal. Se parte más chico y se vuelve a mandar
        if (e?.code !== 40005 && e?.status !== 413) throw e;
        tope = Math.floor(tope / 2);
        anotar('↩️ Discord no aceptó ese tamaño; parto en pedazos de', (tope / 1e6).toFixed(1), 'MB');
        for (const f of fs.readdirSync(this.dir)) if (f.startsWith('mezcla_parte')) fs.rmSync(path.join(this.dir, f));
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
    const q = new URLSearchParams({ g: this.guild.id, desde: String(this.inicio.getTime()), hasta: String(Date.now()) });
    const r = await fetch(VIGIA + '/avisos/batallas?' + q, { headers: { 'x-lg-ciclo': claveCiclo(E.DISCORD_TOKEN) },
      signal: AbortSignal.timeout(20000) });
    const d = r.ok ? await r.json() : {};
    const total = (d.llaves || []).reduce((s, L) => s + (L.rondas || []).reduce((t, R) => t + (R.b || []).length, 0), 0);
    const bs = ubicarTodas(d.llaves, this.habla.t, seg);
    anotar(`⚔️ batallas: ${bs.length} ubicadas de ${total} en la llave`);
    if (!bs.length) return;
    const lineas = bs.map((b) => `\`${mmss(b.desde)}\` ${b.r} · ${b.nombres.join(' vs ')}`);
    let texto = `⚔️ **Las batallas**, en minutos desde que empezó la grabación (aprox.: salen de quién habló cuándo)`
      + ` · ${bs.length} de ${total}`;
    for (const l of lineas) { if ((texto + '\n' + l).length > 1900) { texto += '\n…'; break; } texto += '\n' + l; }
    const tope = topeDe(this.guild?.id === canal.guildId ? this.guild : canal.guild);
    const clips = [];
    for (const [i, b] of bs.entries()) {
      const ruta = path.join(this.dir, `batalla-${i}.ogg`);
      await cortar(mezcla, b.desde, b.hasta, ruta);
      clips.push({ attachment: ruta, name: nombreClip(b), peso: fs.statSync(ruta).size });
    }
    let lote = [], peso = 0, primero = true;
    const mandar = async () => {
      if (!lote.length && !primero) return;
      await canal.send({ content: primero ? texto : undefined, files: lote.map(({ attachment, name }) => ({ attachment, name })),
        allowedMentions: { parse: [] } });
      primero = false;
      lote = [];
      peso = 0;
    };
    for (const c of clips) {
      if (c.peso > tope) continue;
      if (lote.length >= 10 || peso + c.peso > tope) await mandar();
      lote.push(c);
      peso += c.peso;
    }
    await mandar();
  }
}

// ── el ciclo ──────────────────────────────────────────────────────────────
const grabando = new Map();   // guild -> Grabacion
const pendiente = new Map();  // guild -> { canal, desde }
const avisadoSinPermiso = new Set();

async function vuelta(client) {
  for (const gid of GRABAR_EN) {
    const guild = client.guilds.cache.get(gid);
    if (!guild) continue;
    const g = grabando.get(gid);
    if (g) { g.revisar(); continue; }
    // con el mismo bot haciendo una prueba de micro ahí, entrar a grabar lo sacaría de esa llamada: se espera
    if (prueba && prueba.client === client && prueba.activa(gid)) continue;
    const c = candidata(guild);
    // el piso es el más bajo de los dos: con MIN_SIN=1 (la prueba de una persona) el de MIN_VIVO lo dejaba afuera
    if (!c || c.n < Math.min(MIN_VIVO, MIN_SIN) || c.otro) { pendiente.delete(gid); continue; }
    const enJuego = c.n >= MIN_SIN ? false : (await llavesEnJuego()).has(gid);
    if (c.n < MIN_SIN && !enJuego) { pendiente.delete(gid); continue; }
    const p = pendiente.get(gid);
    if (!p || p.canal !== c.canal.id) { pendiente.set(gid, { canal: c.canal.id, desde: Date.now() }); continue; }
    if (Date.now() - p.desde < ESPERA_ENTRAR) continue;
    const yo = guild.members.me;
    const puede = yo && c.canal.permissionsFor(yo)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]);
    if (!puede) {
      if (!avisadoSinPermiso.has(c.canal.id)) anotar(`⚠️ sin permiso para entrar a ${guild.name} / ${c.canal.name}`);
      avisadoSinPermiso.add(c.canal.id);
      continue;
    }
    pendiente.delete(gid);
    const motivo = enJuego ? `había ${c.n} personas y una llave de ${guild.name} en juego` : `había ${c.n} personas`;
    const nueva = new Grabacion(client, guild, c.canal, motivo);
    grabando.set(gid, nueva);
    try {
      await nueva.empezar();
    } catch (e) {
      anotar('❌ no pude entrar a la llamada:', String(e.message || e).slice(0, 200));
      try { nueva.con?.destroy(); } catch (x) { /* nada */ }
      grabando.delete(gid);
    }
  }
}

// ── lo que se mide: cuánto gasta, para el precio de Railway ──────────────
let cpuAntes = process.cpuUsage(), tAntes = performance.now();
function medir() {
  const cpu = process.cpuUsage(cpuAntes), dt = performance.now() - tAntes;
  cpuAntes = process.cpuUsage(); tAntes = performance.now();
  const pct = ((cpu.user + cpu.system) / 1000 / dt) * 100;
  const g = [...grabando.values()].map((x) => `${x.guild.name}: ${x.pistas.size} pistas, ${largo(x.ms() / 1000)}`);
  anotar(`📊 ${(process.memoryUsage().rss / 1e6).toFixed(0)} MB · CPU ${pct.toFixed(1)} %`
    + (g.length ? ' · grabando ' + g.join('; ') : ''));
}

// ── arranque ──────────────────────────────────────────────────────────────
async function revisarYSalir(client) {
  console.log(generateDependencyReport());
  const llaves = await llavesEnJuego();
  for (const gid of GRABAR_EN) {
    const guild = client.guilds.cache.get(gid);
    if (!guild) { console.log(`❌ ${gid}: el bot no está en ese servidor`); continue; }
    console.log(`\n${guild.name} (tope de archivo ${topeDe(guild) / 1e6} MB, llave en juego: ${llaves.has(gid) ? 'sí' : 'no'})`);
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
    const entra = c && !c.otro && (c.n >= MIN_SIN || (c.n >= MIN_VIVO && llaves.has(gid)));
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
  await Promise.allSettled([...grabando.values()].map((g) => g.terminar('se reinició el grabador')));
  process.exit(0);
});

if (!E.DISCORD_TOKEN) {
  console.log('❌ falta DISCORD_TOKEN (en Railway: Variables)');
  process.exit(1);
}
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});
client.once(Events.ClientReady, async () => {
  anotar(`✅ conectado como ${client.user.tag} · graba en ${GRABAR_EN.length} servidor(es) · entrega en ${ENTREGA}`);
  if (process.argv.includes('--revisar')) return revisarYSalir(client);
  setInterval(() => vuelta(client).catch((e) => anotar('⚠️ vuelta:', String(e.message || e).slice(0, 150))), 20000);
  arrancarPrueba(client);
  if (E.VIVO !== '0') {
    llamadas = new LlamadasVivo({ client, token: E.DISCORD_TOKEN, canalesDe: (gid) => CANALES_DE[gid] || null, anotar });
    llamadas.arrancar();
    anotar('🎙️👀 micrófonos y público de las llamadas en vivo: prendido');
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
