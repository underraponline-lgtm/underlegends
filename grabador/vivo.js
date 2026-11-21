// 🎙️👀 LO QUE RAILWAY VE DE LAS LLAMADAS EN VIVO (21/11/2026). Este bot ya está conectado todo el día con los estados
// de voz de todos los servidores (`GuildVoiceStates`), así que manda dos cosas al objeto del Worker:
//
// 🎙️ LOS MICRÓFONOS (Dlx: «5. va», combinar): quién tiene el micrófono abierto y quién está en la llamada, de los
// servidores con una llave en juego. Es lo mismo que manda `bot/en_llamada.py --seguir` desde GitHub (`llamada.yml`), en
// el mismo formato y a la misma ruta (`/avisos/voz-vivo`, `vozVivo()` en bot/avisos.js): lo que llega último vale, así
// que si una de las dos conexiones se cae, la otra sigue. ⚠️ No reemplaza a la de GitHub: ésa también lee los veredictos
// al instante y guarda quién estuvo en la llamada (`voz:<SV>` en KV), y eso pide permisos que este bot no tiene.
//
// 👀 EL PÚBLICO (Dlx, «4. A… aunque pueden pasar muchas cosas en llamada, ten en cuenta eso, A»): cada minuto, a quién
// está en la llamada del evento sin ensordecer (silenciado sí vale) se le suma un minuto en esa llave; cada
// `PUBLICO_CADA_S` se manda la tanda (`/avisos/publico`, `publico()` en bot/avisos.js), y a los 20 minutos SUMADOS el
// objeto le da un Dragón Drop (uno por día) y le cuenta esa llave para las Tareas del Pase. «Muchas cosas en la llamada»:
// se corta, se cambia de canal, el bot se reinicia — por eso se suma y no se pide seguido, y por eso cada tanda tiene su
// id (un reintento no cuenta dos veces) y lo perdido en un reinicio es como mucho una tanda.
//
// 🔒 IDs de gente: al objeto y a ningún otro lado. El log dice cuántos, nunca quién.
import crypto from 'node:crypto';
import { Events } from 'discord.js';

export const VIGIA = 'https://liga-global-bot.liga-global-ul.workers.dev';
//: 🎙️ una llave publicada o editada hace más que esto ya no está en juego (lo mismo que `LLAVE_H` de en_llamada.py)
export const LLAVE_H = 3;
//: 👀 para el público, más corto: una llave sin tocar hace 45 minutos ya terminó, y lo que sigue en la llamada es charla
export const PUBLICO_LLAVE_MIN = 45;
//: cada cuánto se pregunta qué llaves hay en juego (`/avisos/vivo`, público y sin clave)
export const VIVO_CADA_S = 60;
//: 🎙️ cuánto se espera a que se calmen los cambios antes de mandar, y el latido aunque no cambie nada (el objeto los da
//: por caídos a los 2 min 30 s sin noticias: `VOZ_FRESCA`)
export const MIC_JUNTAR_MS = 1500;
export const MIC_LATIDO_S = 60;
//: 👀 cada cuánto se manda una tanda del público
export const PUBLICO_CADA_S = 300;

/** La clave del ciclo: `sha256('lg-ciclo:' + DISCORD_TOKEN)`, la misma de bot/clave_ciclo.py y `claveCiclo()` del Worker. */
export const claveCiclo = (token) => crypto.createHash('sha256').update('lg-ciclo:' + String(token || '')).digest('hex');

/** ¿Ese estado de voz tiene el micrófono abierto? Ni silenciado ni ensordecido (por sí o por el servidor), ni de público
 *  en un escenario: lo mismo que `mic_abierto()` de en_llamada.py. */
export const micAbierto = (e) => !(e.mute || e.selfMute || e.deaf || e.selfDeaf || e.suppress);

/** `{ab, en}` de un servidor, sin los bots y en orden: lo que espera `vozVivo()` (como `microfonos()` de en_llamada.py). */
export function microfonos(estados) {
  const gente = (estados || []).filter((e) => e && e.canal && !e.bot);
  return {
    ab: gente.filter(micAbierto).map((e) => String(e.id)).sort(),
    en: gente.map((e) => String(e.id)).sort(),
  };
}

/**
 * 👀 Las llamadas del evento en un servidor: las de competencia si se conocen (`fijos`, `CANALES_DE` del grabador); si
 * no, la que tiene más gente (sin bots y sin la de AFK). Un `Set` de ids de canal; vacío si no hay nadie.
 */
export function llamadasDelEvento(estados, fijos, afk) {
  if (fijos && fijos.length) return new Set(fijos.map(String));
  const n = new Map();
  for (const e of estados || []) {
    if (!e || !e.canal || e.bot || e.canal === afk) continue;
    n.set(e.canal, (n.get(e.canal) || 0) + 1);
  }
  let mejor = null;
  for (const [c, k] of n) if (!mejor || k > mejor[1]) mejor = [c, k];
  return new Set(mejor ? [mejor[0]] : []);
}

/** 👀 Quiénes cuentan este minuto: en una llamada del evento, sin ser bot y sin ensordecer (silenciado sí vale). */
export function oyentes(estados, llamadas) {
  return (estados || []).filter((e) => e && e.canal && llamadas.has(String(e.canal)) && !e.bot && !e.deaf && !e.selfDeaf)
    .map((e) => String(e.id)).sort();
}

/**
 * `{g: {sv, llave, ed}}` de los servidores con una llave en juego, de lo que contesta `/avisos/vivo`: la más reciente de
 * cada servidor, si se publicó o se editó hace menos de `horas`.
 */
export function enJuego(llaves, ahora, horas) {
  const out = {};
  for (const ll of llaves || []) {
    const ed = Number(ll && (ll.ed || ll.pub));
    const g = String((ll && ll.g) || '');
    if (!/^\d{5,25}$/.test(g) || !/^\d{5,25}$/.test(String(ll.id || '')) || !ed || ahora - ed > horas * 3600000) continue;
    if (!out[g] || ed > out[g].ed) out[g] = { sv: String(ll.sv || ''), llave: String(ll.id), ed };
  }
  return out;
}

/** El estado de voz de discord.js, a lo que usan las funciones de arriba. */
const plano = (vs) => ({
  id: vs.id, canal: vs.channelId, bot: !!(vs.member && vs.member.user && vs.member.user.bot),
  mute: !!vs.serverMute, selfMute: !!vs.selfMute, deaf: !!vs.serverDeaf, selfDeaf: !!vs.selfDeaf, suppress: !!vs.suppress,
});

export class LlamadasVivo {
  /**
   * @param {object} o
   * @param {import('discord.js').Client} o.client
   * @param {string} o.token            el DISCORD_TOKEN, para la clave del ciclo
   * @param {(gid: string) => string[]|null} o.canalesDe   las llamadas de competencia conocidas de un servidor
   * @param {Function} o.anotar         el log
   */
  constructor({ client, token, canalesDe = () => null, anotar = console.log, fetch: f = globalThis.fetch }) {
    Object.assign(this, { client, canalesDe, anotar, fetch: f });
    this.clave = claveCiclo(token);
    this.vivos = {};          // g -> {sv, llave, ed}, con LLAVE_H
    this.vivoT = 0;
    this.micUlt = '';         // la última foto mandada (JSON), para no repetir
    this.micT = 0;
    this.micTimer = null;
    this.tandas = new Map();  // `${g}:${llave}` -> {g, llave, desde, min: Map(id -> minutos)}
    this.envios = { mic: 0, publico: 0, fallas: 0 };
  }

  arrancar() {
    this.client.on(Events.VoiceStateUpdate, (a, b) => {
      const g = String((b && b.guild && b.guild.id) || (a && a.guild && a.guild.id) || '');
      if (this.vivos[g]) this.micPronto();
    });
    const vuelta = () => this.minuto().catch((e) => this.anotar('⚠️ vivo:', String(e.message || e).slice(0, 150)));
    setInterval(vuelta, 60000);
    vuelta();
  }

  async pedir(ruta, cuerpo) {
    const r = await this.fetch(VIGIA + ruta, cuerpo === undefined ? { signal: AbortSignal.timeout(10000) } : {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { 'content-type': 'application/json', 'x-lg-ciclo': this.clave }, body: JSON.stringify(cuerpo),
    });
    if (!r.ok) throw new Error(ruta + ' ' + r.status);
    return r.json();
  }

  async alDia(ahora) {
    if (ahora - this.vivoT < VIVO_CADA_S * 1000 - 2000) return;
    this.vivoT = ahora;
    const d = await this.pedir('/avisos/vivo');
    this.vivos = enJuego(d.llaves, ahora, LLAVE_H);
    this.publicoVivos = enJuego(d.llaves, ahora, PUBLICO_LLAVE_MIN / 60);
  }

  estados(gid) {
    const guild = this.client.guilds.cache.get(gid);
    return guild ? [...guild.voiceStates.cache.values()].map(plano) : [];
  }

  /** 🎙️ La foto de los micrófonos de los servidores en juego: `{g: {sv, ab, en}}`. */
  fotoMic() {
    const out = {};
    for (const [g, v] of Object.entries(this.vivos)) {
      if (!this.client.guilds.cache.has(g)) continue;
      out[g] = Object.assign(microfonos(this.estados(g)), { sv: v.sv });
    }
    return out;
  }

  micPronto() {
    if (this.micTimer) return;
    this.micTimer = setTimeout(() => { this.micTimer = null; this.mandarMic(false).catch(() => {}); }, MIC_JUNTAR_MS);
  }

  async mandarMic(latido) {
    const foto = this.fotoMic();
    if (!Object.keys(foto).length) return;
    const j = JSON.stringify(foto);
    if (!latido && j === this.micUlt) return;
    if (latido && j === this.micUlt && Date.now() - this.micT < MIC_LATIDO_S * 1000 - 2000) return;
    try {
      await this.pedir('/avisos/voz-vivo', { g: foto });
      this.micUlt = j;
      this.micT = Date.now();
      this.envios.mic++;
    } catch (e) {
      this.envios.fallas++;
    }
  }

  /** Cada minuto: qué está en juego, el latido de los micrófonos, el minuto del público y, si toca, su tanda. */
  async minuto(ahora = Date.now()) {
    try { await this.alDia(ahora); } catch (e) { this.anotar('⚠️ el vigía no contestó (vivo):', String(e.message || e).slice(0, 80)); }
    await this.mandarMic(true);
    for (const [g, v] of Object.entries(this.publicoVivos || {})) {
      const guild = this.client.guilds.cache.get(g);
      if (!guild) continue;
      const est = this.estados(g);
      const quienes = oyentes(est, llamadasDelEvento(est, this.canalesDe(g), guild.afkChannelId));
      if (!quienes.length) continue;
      const k = g + ':' + v.llave;
      if (!this.tandas.has(k)) this.tandas.set(k, { g, sv: v.sv, llave: v.llave, desde: ahora, min: new Map() });
      const t = this.tandas.get(k);
      for (const id of quienes) t.min.set(id, (t.min.get(id) || 0) + 1);
    }
    await this.mandarPublico(ahora, false);
  }

  /** 👀 Las tandas de `PUBLICO_CADA_S` o más (o todas, con `todo`: al apagarse). Una que no sale queda para la próxima,
   *  con el mismo id: si sí había llegado, el objeto no la cuenta dos veces. */
  async mandarPublico(ahora = Date.now(), todo = false) {
    for (const [k, t] of [...this.tandas]) {
      if (!t.min.size || (!todo && ahora - t.desde < PUBLICO_CADA_S * 1000)) continue;
      const cuerpo = { g: t.g, sv: t.sv, llave: t.llave, tanda: `${t.llave}:${t.g}:${t.desde}`, min: Object.fromEntries(t.min) };
      try {
        const r = await this.pedir('/avisos/publico', cuerpo);
        this.tandas.delete(k);
        this.envios.publico++;
        // 🔒 cuántos, nunca quién
        this.anotar(`👀 público ${t.sv || t.g}: ${t.min.size} en la llamada${r && r.premiados ? ` · ${r.premiados} llegaron a los 20 min` : ''}`);
      } catch (e) {
        this.envios.fallas++;
        this.anotar('⚠️ no pude mandar el público:', String(e.message || e).slice(0, 100));
      }
    }
  }
}
