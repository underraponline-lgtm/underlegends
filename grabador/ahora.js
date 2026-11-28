// 🎧 «AHORA MISMO» (28/11/2026). Dlx, 27/11/2026: en la página, las llamadas de voz que están pasando ahora en todos los
// servidores socios, sólo de canales PÚBLICOS y con números, no con nombres. Este bot ya está conectado todo el día con
// los estados de voz de cada servidor (`GuildVoiceStates`), así que la foto sale de lo que ya tiene en memoria: no le
// pregunta nada a Discord.
//
// Lo que manda (`POST /ahora` al Worker, con la clave del ciclo; lo guarda bot/ahora.js):
//   {g: {<guild>: [{c: canal, n: nombre del canal, p: personas, m: con el micro abierto, d: desde cuándo (ms)}]}}
//
// ⚠️ NUNCA UN ID NI UN NOMBRE DE PERSONA. Sólo se cuentan: el objeto que sale de `llamadasDe()` no tiene de dónde sacarlos.
// ⚠️ PÚBLICO = @everyone puede VER el canal y CONECTARSE (`permissionsFor(guild.roles.everyone)`). Un canal de staff, uno
// de un rol o uno cerrado no sale nunca, aunque esté lleno. Tampoco la llamada AFK ni las de menos de `MIN_GENTE`.
// ⚠️ SÓLO CUANDO CAMBIA, como mucho una vez por `ENTRE_S`, y un latido cada `LATIDO_S` aunque no cambie (el objeto da por
// vencido lo que no tiene latido en 15 min: si esto se cae, la página no muestra llamadas viejas). Sin ninguna llamada no
// hay latido: no hay nada que vencer.
// ⚠️ CHICO A PROPÓSITO (Railway Hobby): una vuelta cada `VUELTA_S` sobre lo que ya está en memoria, un Map de «desde
// cuándo» por canal y nada más. Sin escuchar eventos: la vuelta alcanza para «como mucho una vez por minuto».
// `AHORA=0` en Railway lo apaga.

//: los permisos que hacen público un canal de voz, en bits como los da Discord (VIEW_CHANNEL y CONNECT), para no importar
//: discord.js acá: la prueba corre sin instalar nada
export const VER = 1n << 10n;
export const CONECTAR = 1n << 20n;
//: canales de voz y escenarios
const TIPOS_VOZ = new Set([2, 13]);
export const MIN_GENTE = 2;
export const ENTRE_S = 60;
export const LATIDO_S = 600;
export const VUELTA_S = 15;
export const MAX_CANALES = 10;

/** ¿@everyone puede ver el canal y conectarse? `perm` es lo que da `permissionsFor()` (algo con `has`), o un bigint. */
export function esPublico(perm) {
  if (perm == null) return false;
  if (typeof perm === 'bigint') return (perm & VER) === VER && (perm & CONECTAR) === CONECTAR;
  try { return !!(perm.has && perm.has(VER) && perm.has(CONECTAR)); } catch (e) { return false; }
}

/** ¿Ese estado de voz tiene el micrófono abierto? Ni silenciado ni ensordecido (por sí o por el servidor), ni de público en
 *  un escenario: lo mismo que `micAbierto()` de vivo.js */
export const micAbierto = (e) => !(e.mute || e.selfMute || e.deaf || e.selfDeaf || e.suppress);

/**
 * Las llamadas de un servidor, de su foto plana (`plano()`): `{afk, canales: {id: {n, publico}}, estados: [{canal, bot,
 * mute, selfMute, deaf, selfDeaf, suppress}]}`. `desde` es el Map de «desde cuándo» de cada canal (`g:c` -> ms), que se
 * actualiza acá. Devuelve `[{c, n, p, m, d}]`, las más llenas primero.
 */
export function llamadasDe(gid, foto, desde, ahora, min = MIN_GENTE) {
  const cuenta = new Map();
  for (const e of (foto && foto.estados) || []) {
    if (!e || !e.canal || e.bot || e.canal === foto.afk) continue;
    const ch = foto.canales[e.canal];
    if (!ch || !ch.publico) continue;
    const x = cuenta.get(e.canal) || { p: 0, m: 0 };
    x.p += 1;
    if (micAbierto(e)) x.m += 1;
    cuenta.set(e.canal, x);
  }
  const out = [];
  for (const [c, x] of cuenta) {
    if (x.p < min) continue;
    const k = gid + ':' + c;
    if (!desde.has(k)) desde.set(k, ahora);
    out.push({ c: String(c), n: String(foto.canales[c].n || ''), p: x.p, m: x.m, d: desde.get(k) });
  }
  // lo que dejó de ser una llamada pierde su «desde»: si vuelve, vuelve de cero
  for (const k of [...desde.keys()]) {
    if (k.startsWith(gid + ':') && !out.some((o) => gid + ':' + o.c === k)) desde.delete(k);
  }
  return out.sort((a, b) => b.p - a.p || a.d - b.d).slice(0, MAX_CANALES);
}

/** El servidor de discord.js, a lo que usa `llamadasDe()`: sólo los canales donde hay alguien, y sin nada de nadie. */
export function plano(guild) {
  const estados = [];
  const canales = {};
  const todos = guild.roles && guild.roles.everyone;
  for (const vs of guild.voiceStates.cache.values()) {
    if (!vs.channelId) continue;
    estados.push({ canal: vs.channelId, bot: !!(vs.member && vs.member.user && vs.member.user.bot),
      mute: !!vs.serverMute, selfMute: !!vs.selfMute, deaf: !!vs.serverDeaf, selfDeaf: !!vs.selfDeaf, suppress: !!vs.suppress });
    if (canales[vs.channelId]) continue;
    const ch = guild.channels.cache.get(vs.channelId);
    let publico = false;
    try { publico = !!(ch && TIPOS_VOZ.has(ch.type) && todos && esPublico(ch.permissionsFor(todos))); } catch (e) { publico = false; }
    canales[vs.channelId] = { n: ch ? ch.name : '', publico };
  }
  return { afk: guild.afkChannelId || null, canales, estados };
}

export class AhoraMismo {
  /**
   * @param {object} o
   * @param {import('discord.js').Client} o.client
   * @param {string} o.vigia   el Worker
   * @param {string} o.clave   la clave del ciclo
   */
  constructor({ client, vigia, clave, anotar = () => {}, fetch: f = globalThis.fetch, min = MIN_GENTE }) {
    Object.assign(this, { client, vigia, clave, anotar, fetch: f, min });
    this.desde = new Map();
    this.acepta = null;     // los guilds de los socios, de la última respuesta (null: todavía no se sabe, se miran todos)
    this.ult = '';          // la última foto que llegó
    this.tEnvio = 0;        // el último intento (llegó o no)
    this.envios = { ok: 0, fallas: 0 };
  }

  arrancar() {
    const vuelta = () => this.tic().catch((e) => this.anotar('⚠️ ahora mismo:', String((e && e.message) || e).slice(0, 120)));
    setInterval(vuelta, VUELTA_S * 1000).unref?.();
    vuelta();
  }

  /** `{guild: [llamadas]}`, sólo los servidores con alguna */
  foto(ahora = Date.now()) {
    const out = {};
    for (const [gid, guild] of this.client.guilds.cache) {
      if (this.acepta && !this.acepta.has(String(gid))) continue;
      let ll = [];
      try { ll = llamadasDe(String(gid), plano(guild), this.desde, ahora, this.min); } catch (e) { ll = []; }
      if (ll.length) out[String(gid)] = ll;
    }
    // los servidores de los que se fue el bot: su «desde» no sirve más
    for (const k of [...this.desde.keys()]) if (!out[k.split(':')[0]]) this.desde.delete(k);
    return out;
  }

  /** Una vuelta: manda si cambió (y pasó `ENTRE_S` del último intento) o si toca el latido. */
  async tic(ahora = Date.now()) {
    const foto = this.foto(ahora);
    const j = JSON.stringify(foto);
    const hay = Object.keys(foto).length > 0;
    const desdeUlt = ahora - this.tEnvio;
    const cambio = j !== this.ult;
    if (cambio ? desdeUlt < ENTRE_S * 1000 : (!hay || desdeUlt < LATIDO_S * 1000)) return false;
    this.tEnvio = ahora;
    try {
      const r = await this.fetch(this.vigia + '/ahora', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-lg-ciclo': this.clave },
        body: JSON.stringify({ g: foto }), signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw new Error('contestó ' + r.status);
      const d = await r.json().catch(() => null);
      if (d && Array.isArray(d.acepta) && d.acepta.length) this.acepta = new Set(d.acepta.map(String));
      this.ult = j;
      this.envios.ok++;
      return true;
    } catch (e) {
      // la foto queda sin «llegó»: se reintenta en `ENTRE_S`, no en cada vuelta
      this.envios.fallas++;
      if (this.envios.fallas % 10 === 1) this.anotar('⚠️ ahora mismo: el Worker no lo tomó', String((e && e.message) || e).slice(0, 100));
      return false;
    }
  }
}
