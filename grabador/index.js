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
// AVISA AL ENTRAR, en el chat de esa llamada, y quien toca ❌ en ese aviso no se graba: su pista se borra entera y se
// deja de escuchar. Si saca la ❌, se lo vuelve a grabar desde ese momento.
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
import { mezclar, partir, duracion } from './mezcla.js';

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
//: una llave publicada hace más que esto ya no cuenta como «en juego» (lo mismo que `LLAVE_H` de en_llamada.py)
const LLAVE_H = 3;
const VIGIA = 'https://liga-global-bot.liga-global-ul.workers.dev';
//: otros grabadores con los que NO se entra (vacío: ver arriba). El de Drako es «Freestyle for All», 1557056218164629535
const OTROS = new Set(lista(E.NO_SI_ESTA));
const BASE = E.CARPETA || path.join(os.tmpdir(), 'grabaciones');
const NO = '❌';

const anotar = (...x) => console.log(new Date().toISOString().slice(11, 19), ...x);

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
    this.fuera = new Set();      // quienes tocaron ❌
    this.vacia = null;           // desde cuándo hay menos de SALIR_CON
    this.cerrando = false;
    this.aviso = null;
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
    this.con.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([entersState(this.con, VoiceConnectionStatus.Signalling, 5000),
          entersState(this.con, VoiceConnectionStatus.Connecting, 5000)]);
      } catch (e) {
        this.terminar('me sacaron de la llamada');
      }
    });
    this.con.on('error', (e) => anotar('⚠️ la conexión de voz:', String(e.message || e).slice(0, 120)));
    try {
      this.aviso = await this.canal.send({
        content: '🔴 **Grabando esta llamada.** Under Legends graba el audio de este evento —cada voz por separado— '
          + 'para el resumen y los clips. Si no quieres que se guarde tu voz, toca ' + NO + ' acá abajo: tu pista se '
          + 'borra y no se te graba más.',
        allowedMentions: { parse: [] },
      });
      await this.aviso.react(NO);
    } catch (e) {
      anotar('⚠️ no pude avisar en el chat de la llamada:', String(e.message || e).slice(0, 120));
    }
    anotar(`🔴 grabando en ${this.guild.name} / ${this.canal.name} (${this.motivo})`);
  }

  escuchar(id) {
    if (this.cerrando || this.subs.has(id) || this.fuera.has(id)) return;
    const m = this.guild.members.cache.get(id);
    if (!this.quien.has(id)) this.quien.set(id, { nombre: m?.displayName || m?.user?.username || id, bot: !!m?.user?.bot });
    let pista = this.pistas.get(id);
    if (!pista) {
      pista = new PistaOpus(path.join(this.dir, id + '.ogg'));
      this.pistas.set(id, pista);
    }
    const st = this.con.receiver.subscribe(id, { end: { behavior: EndBehaviorType.Manual } });
    this.subs.set(id, st);
    st.on('data', (p) => {
      if (!this.cerrando && !this.fuera.has(id)) pista.agregar(p, this.ms());
    });
    // un error de descifrado corta el flujo: se suelta y el próximo «empezó a hablar» lo vuelve a abrir
    st.once('error', (e) => { anotar('⚠️ una voz se cortó:', String(e.message || e).slice(0, 100)); this.subs.delete(id); });
    st.once('close', () => { if (this.subs.get(id) === st) this.subs.delete(id); });
  }

  /** ❌: se borra su pista y no se lo escucha más. */
  sacar(id) {
    this.fuera.add(id);
    this.subs.get(id)?.destroy();
    this.subs.delete(id);
    const p = this.pistas.get(id);
    if (p) {
      p.cerrar();
      fs.rmSync(p.ruta, { force: true });
      this.pistas.delete(id);
    }
    anotar('🙅 alguien pidió no grabarse');
  }

  /** Sacó la ❌: se lo graba de nuevo desde ahora (su pista arranca con silencio hasta este momento). */
  volver(id) {
    this.fuera.delete(id);
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
    try {
      await this.aviso?.edit({
        content: `⏹️ **Grabación terminada** · ${largo(fin / 1000)} · ${voces.filter((id) => !this.quien.get(id)?.bot).length} voces.`,
      });
    } catch (e) { /* el aviso se borró */ }
    grabando.delete(this.guild.id);
  }

  async entregar(voces, seg, razon) {
    const canal = await this.client.channels.fetch(ENTREGA);
    const gente = voces.filter((id) => !this.quien.get(id)?.bot);
    const nombres = gente.map((id) => this.quien.get(id)?.nombre || id);
    const cab = `🎙️ **Grabación** · ${this.guild.name} · <#${this.canal.id}>\n`
      + `${horaET(this.inicio)} · ${largo(seg)} · ${gente.length} voces`
      + (voces.length > gente.length ? ' + la música' : '')
      + (this.fuera.size ? ` · ${this.fuera.size} pidieron no grabarse` : '')
      + `\nEntró porque ${this.motivo}; salió porque ${razon}.`;
    if (!voces.length) {
      await canal.send({ content: cab + '\nNo habló nadie: no hay audio.', allowedMentions: { parse: [] } });
      return;
    }
    const t = performance.now();
    const mezcla = path.join(this.dir, 'mezcla.ogg');
    await mezclar(voces.map((id) => this.pistas.get(id).ruta), mezcla);
    const mb = fs.statSync(mezcla).size / 1e6;
    anotar(`🎚️ mezcla: ${voces.length} pistas, ${mb.toFixed(1)} MB, ${((performance.now() - t) / 1000).toFixed(0)} s`);
    let tope = topeDe(this.guild?.id === canal.guildId ? this.guild : canal.guild);
    for (let intento = 0; intento < 3; intento++) {
      const partes = await partir(mezcla, tope);
      try {
        for (let i = 0; i < partes.length; i++) {
          const nombre = `grabacion-${this.inicio.toISOString().slice(0, 10)}${partes.length > 1 ? '-parte' + (i + 1) : ''}.ogg`;
          await canal.send({
            content: i === 0
              ? cab + `\n${nombres.slice(0, 40).join(', ')}${nombres.length > 40 ? '…' : ''}`
                + (partes.length > 1 ? `\nParte 1 de ${partes.length} (${largo(duracion(partes[0]))})` : '')
              : `Parte ${i + 1} de ${partes.length}`,
            files: [{ attachment: partes[i], name: nombre }],
            allowedMentions: { parse: [] },
          });
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
    const c = candidata(guild);
    if (!c || c.n < MIN_VIVO || c.otro) { pendiente.delete(gid); continue; }
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
  await Promise.allSettled([...grabando.values()].map((g) => g.terminar('se reinició el grabador')));
  process.exit(0);
});

if (!E.DISCORD_TOKEN) {
  console.log('❌ falta DISCORD_TOKEN (en Railway: Variables)');
  process.exit(1);
}
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessageReactions],
});
client.once(Events.ClientReady, async () => {
  anotar(`✅ conectado como ${client.user.tag} · graba en ${GRABAR_EN.length} servidor(es) · entrega en ${ENTREGA}`);
  if (process.argv.includes('--revisar')) return revisarYSalir(client);
  setInterval(() => vuelta(client).catch((e) => anotar('⚠️ vuelta:', String(e.message || e).slice(0, 150))), 20000);
  setInterval(medir, 300000);
  medir();
});
client.on(Events.MessageReactionAdd, (r, u) => {
  if (u.bot || r.emoji.name !== NO) return;
  for (const g of grabando.values()) if (g.aviso?.id === r.message.id) g.sacar(u.id);
});
client.on(Events.MessageReactionRemove, (r, u) => {
  if (u.bot || r.emoji.name !== NO) return;
  for (const g of grabando.values()) if (g.aviso?.id === r.message.id) g.volver(u.id);
});
client.on('error', (e) => anotar('⚠️ discord:', String(e.message || e).slice(0, 150)));
client.login(E.DISCORD_TOKEN);
