// 🚪 EL RECIBIDOR, LA PARTE QUE ESCUCHA (28/11/2026). Dlx: en DRA la gente nueva pregunta «¿cómo me inscribo?» en el
// chat y nadie le contesta. Esto escucha el chat general y «💡 dudas» de DRA, y lo que parece la pregunta de alguien
// nuevo se lo manda al Worker (`/recibidor`, con la clave del ciclo, como la mención). El Worker decide (bot/recibidor.js:
// sin IA primero, y la IA sólo elige una etiqueta) y devuelve la respuesta FIJA y el aviso para •「🚪」recibidor, que
// esto publica: la respuesta, contestando al mensaje; el aviso, en el canal privado de los Recibidores.
//
// ⚠️ PIDE MESSAGE CONTENT (`GatewayIntentBits.MessageContent`), sólo con `RECIBIDOR` distinto de `0`: sin él Discord
// manda los mensajes vacíos, salvo los que mencionan al bot (ver mencion.js). La app ya lo tiene prendido en el portal
// (`bot/chats.py` lee los chats con él).
//
// LO QUE NI SE MIRA (barato, en este orden): otro servidor, otro canal, bots, webhooks y mensajes del sistema, vacío o de
// más de 300 letras, lo que no pasa el prefiltro, lo que menciona al bot (eso es de mencion.js), quien está en DRA hace
// 60 días o más, y los frenos: una consulta por persona cada 10 min, una respuesta por persona cada 24 h y por canal
// cada 90 s (el Worker además tiene los suyos, que sobreviven a un reinicio).
// ⚠️ ANTES DE CONTESTAR SE MIRAN LOS PERMISOS DEL CANAL (como mencion.js): cada 403 cuenta contra la IP de Railway.
// ⚠️ EN EL LOG, SÓLO NÚMEROS Y LA ETIQUETA: nunca el texto ni el nombre de nadie.

export const GUILD_DRA = '841017460341604382';
export const MAX_LARGO = 300;
export const NUEVO_DIAS = 60;
export const PERSONA_MS = 24 * 3600 * 1000;
export const CANAL_MS = 90 * 1000;
export const CONSULTA_MS = 10 * 60 * 1000;
const API = 'https://discord.com/api/v10';
// ver el canal, escribir y leer el historial (para responder a un mensaje); en el aviso alcanza con los dos primeros
const PERMISOS = [1n << 10n, 1n << 11n, 1n << 16n];
const PERMISOS_AVISO = [1n << 10n, 1n << 11n];

/** El nombre de un canal como se compara: NFKD, minúsculas, sólo letras y números (`•「🚪」recibidor` → `recibidor`) */
export const norma = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Los canales que importan, de la lista de canales del servidor (`[{id, name, type}]`): dónde se escucha (los que terminan
 * en `chatgeneral`, `conversacion` —el chat general de DRA se llama así— o en `dudas`), dónde se avisa (el que tiene `recibidor`) y los tres de los links de la respuesta.
 * Sólo de texto (0) o de anuncios (5).
 */
export function resolver(canales) {
  const r = { escucha: new Set(), aviso: '', eventos: '', nuevos: '', verificar: '' };
  let eventosHoy = '';
  for (const c of canales || []) {
    if (!c || (c.type !== 0 && c.type !== 5)) continue;
    const n = norma(c.name);
    if (n.endsWith('chatgeneral') || n.endsWith('conversacion') || n.endsWith('dudas')) r.escucha.add(String(c.id));
    if (!r.aviso && n.includes('recibidor')) r.aviso = String(c.id);
    if (!eventosHoy && n.endsWith('eventoshoy')) eventosHoy = String(c.id);
    if (!r.eventos && n.endsWith('eventos')) r.eventos = String(c.id);
    if (!r.nuevos && (n.endsWith('eventonuevos') || n.endsWith('eventosnuevos'))) r.nuevos = String(c.id);
    if (!r.verificar && n.endsWith('verificateaqui')) r.verificar = String(c.id);
  }
  if (eventosHoy) r.eventos = eventosHoy;
  return r;
}

// ⚠️ EL PREFILTRO ES EL DE bot/recibidor.js, COPIADO (el grabador se despliega sin bot/). `bot/recibidor_prueba.mjs`
// revienta si los dos contestan distinto. Si se toca uno, se toca el otro.
const sinTilde = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const TEMA = /inscri[bvp]|anot[aeo]|regist|rejist|particip|partisip|\bentr[aeo]|\bun[io]r|\bme uno\b|\bjug|\bjueg|compet|compit|event|ivent|torne|batall|bataya|\bliga\b|\bcart[ai]|tarjet|\bcard\b|verifi|berifi|\brol\b|miembro|\bnuev[oa]s?\b|primer|empez|empie|\bsum[oa]r?me\b|\bsumo\b/;
export const PREGUNTA = /[?¿]|\bc?omo\b|\bkomo\b|\bcmo\b|\bdonde\b|\bdnd\b|\bcuando\b|\bkuando\b|\bse puede\b|\bpuedo\b|\bsabe\b|\bquiero\b|\bkiero\b|\bhay\b|\bay\b|\bque es\b|\bque hora\b|\bhago\b|\bago\b|\binfo\b|\bayuda\b|\bnunca\b|\bsoy nuev|\bprimera vez\b|\bq hay\b|\bque hay\b|\bq hora\b|\bno me deja\b|\bque trata\b/;
export function prefiltro(texto) {
  const t = sinTilde(texto);
  if (!t.trim() || t.length > MAX_LARGO) return false;
  return TEMA.test(t) && PREGUNTA.test(t);
}

/** Un freno por clave, en memoria (se pierde con un reinicio: el del Worker no). Con tope, para no crecer sin fin. */
export class Freno {
  constructor(ms, tope = 5000) { this.ms = ms; this.tope = tope; this.m = new Map(); }
  puede(k, ahora = Date.now()) { const t = this.m.get(k); return t === undefined || ahora - t >= this.ms; }
  marcar(k, ahora = Date.now()) {
    this.m.delete(k);
    this.m.set(k, ahora);
    if (this.m.size > this.tope) this.m.delete(this.m.keys().next().value);
  }
}

/** ¿Alguien nuevo? En DRA hace menos de `NUEVO_DIAS` días. Sin la fecha (un miembro que no vino), no. */
export const esNuevo = (unido, ahora = Date.now()) => Number.isFinite(unido) && unido > 0 && ahora - unido < NUEVO_DIAS * 24 * 3600 * 1000;

/** Lo que se publica como respuesta: suena sólo a quien preguntó (es SU respuesta) y nada más */
export function cuerpoRespuesta(msg, aQue) {
  const m = Object.assign({}, msg || {});
  m.flags = (Number(m.flags) || 0) & 32768;
  delete m.tts;
  m.allowed_mentions = { parse: [], replied_user: true };
  m.message_reference = { message_id: aQue, fail_if_not_exists: false };
  return m;
}
/** Lo que se publica en el canal de los recibidores: no suena nadie */
export function cuerpoAviso(msg) {
  const m = Object.assign({}, msg || {});
  m.flags = (Number(m.flags) || 0) & 32768;
  delete m.tts;
  m.allowed_mentions = { parse: [] };
  return m;
}

export class Recibidor {
  constructor({ client, token, vigia, clave, anotar }) {
    Object.assign(this, { client, token, vigia, clave, anotar: anotar || (() => {}) });
    this.c = resolver([]);
    this.consulta = new Freno(CONSULTA_MS);
    this.persona = new Freno(PERSONA_MS);
    this.canal = new Freno(CANAL_MS);
    this.cuenta = { consultas: 0, respuestas: 0, avisos: 0 };
  }

  /** Vuelve a buscar los canales de DRA (al arrancar y cada vez que se crea, cambia o borra un canal) */
  canales() {
    const g = this.client.guilds && this.client.guilds.cache && this.client.guilds.cache.get(GUILD_DRA);
    if (!g) { this.c = resolver([]); return this.c; }
    this.c = resolver([...g.channels.cache.values()].map((x) => ({ id: x.id, name: x.name, type: x.type })));
    return this.c;
  }

  /** Un mensaje del Gateway. Nunca tira: lo que falla queda anotado, sin el texto */
  async recibir(m) {
    try {
      if (!m || !m.guild || m.guild.id !== GUILD_DRA || !m.channel || !this.c.escucha.has(m.channel.id)) return;
      if (!m.author || m.author.bot || m.webhookId || m.system) return;
      const texto = String(m.content || '');
      if (!texto.trim() || texto.length > MAX_LARGO || !prefiltro(texto)) return;
      const yo = this.client.user && this.client.user.id;
      if (yo && m.mentions && m.mentions.users && m.mentions.users.has(yo)) return;
      const ahora = Date.now();
      const unido = m.member && m.member.joinedTimestamp;
      if (!esNuevo(unido, ahora)) return;
      const quien = m.author.id;
      if (!this.consulta.puede(quien, ahora) || !this.persona.puede(quien, ahora) || !this.canal.puede(m.channel.id, ahora)) return;
      const me = m.guild.members.me;
      const perm = me && m.channel.permissionsFor ? m.channel.permissionsFor(me) : null;
      if (!perm || !perm.has(PERMISOS)) return;
      this.consulta.marcar(quien, ahora);
      this.cuenta.consultas++;
      const r = await fetch(this.vigia + '/recibidor', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-lg-ciclo': this.clave },
        body: JSON.stringify({ texto, g: m.guild.id, canal: m.channel.id, autor: quien, msg: m.id, unido,
          links: { eventos: this.c.eventos, nuevos: this.c.nuevos, verificar: this.c.verificar } }),
        signal: AbortSignal.timeout(15000),
      });
      const d = r.ok ? await r.json().catch(() => null) : null;
      if (!d || !d.ok) { this.anotar('⚠️ recibidor: el Worker no contestó', r.status); return; }
      if (!d.responder) return;
      this.persona.marcar(quien, ahora);
      this.canal.marcar(m.channel.id, ahora);
      const ok = await this.publicar(m.channel.id, cuerpoRespuesta(d.responder, m.id));
      if (ok) this.cuenta.respuestas++;
      let avisado = false;
      if (d.aviso && this.c.aviso) {
        const ca = m.guild.channels.cache.get(this.c.aviso);
        const pa = ca && ca.permissionsFor && me ? ca.permissionsFor(me) : null;
        if (pa && pa.has(PERMISOS_AVISO)) avisado = await this.publicar(this.c.aviso, cuerpoAviso(d.aviso));
        if (avisado) this.cuenta.avisos++;
      }
      this.anotar(`🚪 recibidor: contesté una pregunta (${String(d.etiqueta || '?').slice(0, 20)})${avisado ? ' y avisé a los recibidores' : ''}`
        + ` · van ${this.cuenta.respuestas} desde que arranqué`);
    } catch (e) {
      this.anotar('⚠️ recibidor:', String((e && e.message) || e).slice(0, 120));
    }
  }

  async publicar(canal, cuerpo) {
    const r = await fetch(`${API}/channels/${canal}/messages`, {
      method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bot ' + this.token },
      body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) { this.anotar('⚠️ recibidor: Discord no dejó publicar', r.status); return false; }
    return true;
  }
}
