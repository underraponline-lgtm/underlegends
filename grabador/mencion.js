// 💬 EL BOT POR MENCIÓN (23/11/2026). Dlx: «haz que el comando funcione con @ulaya, así con mención».
//
//   @ULAYA card                tu carta (como /card)
//   @ULAYA card @alguien       la de esa persona
//   @ULAYA vs @alguien         tú contra esa persona (como /versus); `@ULAYA vs @a @b`, a contra b
//   @ULAYA vs @alguien país    con la carta elegida: servidor, temporada, competitiva o país
//   @ULAYA ayuda               qué se puede pedir
//
// ⚠️ SIN MESSAGE CONTENT, A PROPÓSITO. El cliente pide GuildMessages, que no es privilegiado: Discord manda todos los
// mensajes con el texto vacío, SALVO los que mencionan al bot. Así se escucha sólo lo que le escriben a ULAYA y la
// revisión de intents del 24/12 no cambia (el bot sigue sin comandos con prefijo). Lo que no menciona al bot se descarta
// acá, sin llamar a nadie.
//
// LA RESPUESTA LA ARMA EL WORKER (`rutaMencion()` en bot/worker.js), con el mismo `COMANDOS.card` / `COMANDOS.versus`:
// esto sólo lee qué se pidió, se lo manda con la clave del ciclo y publica lo que vuelve como respuesta al mensaje. Los
// botones de esa respuesta van al Worker como cualquier clic. Lo que en /card es efímero (un aviso, un error) en un canal
// no puede serlo: se publica y se borra a los `BORRAR_S` segundos.
//
// ⚠️ ANTES DE CONTESTAR SE MIRAN LOS PERMISOS DEL CANAL: un 403 tras otro suma a los 10.000 pedidos inválidos cada 10
// minutos que bloquean la IP de Railway. Y nada suena: `allowed_mentions` vacío, también para quien preguntó.

// los permisos que hacen falta para contestar: ver el canal, escribir y leer el historial (para responder a un mensaje).
// En bits, como los da Discord, para no importar discord.js acá (la prueba corre sin instalar nada)
const PERMISOS = [1n << 10n, 1n << 11n, 1n << 16n];

export const BORRAR_S = 20;
export const ENTRE_MS = 4000;        // una persona, una mención cada 4 s (el Worker además tiene el freno de /card)
const API = 'https://discord.com/api/v10';

const sinTilde = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const PALABRAS = {
  card: 'card', carta: 'card', tarjeta: 'card', cartas: 'card', tarjetas: 'card',
  vs: 'versus', versus: 'versus', contra: 'versus',
  ayuda: 'ayuda', help: 'ayuda', comandos: 'ayuda',
};
const CARTAS = { servidor: 'servidor', temporada: 'temporada', competitiva: 'competitivo', competitivo: 'competitivo', pais: 'pais' };

/**
 * Qué se pidió en un mensaje que menciona al bot. `bot` es su id y `rol` el de su rol (también vale mencionarlo): las
 * menciones de ellos se sacan, y las demás son la gente. `null` si no es un pedido (una mención en una charla).
 */
export function leerMencion(texto, bot, rol) {
  let t = String(texto || '');
  const deBot = new RegExp('<@!?' + bot + '>|' + (rol ? '<@&' + rol + '>' : '(?!)'), 'g');
  if (!deBot.test(t)) return null;
  t = t.replace(deBot, ' ');
  const gente = [...t.matchAll(/<@!?(\d{15,22})>/g)].map((m) => m[1]).filter((x) => x !== bot);
  const palabras = sinTilde(t.replace(/<[@#][!&]?\d+>/g, ' ')).split(/[^a-z0-9]+/).filter(Boolean);
  const cmd = palabras.length ? PALABRAS[palabras[0]] : null;
  if (!cmd) return null;
  if (cmd === 'ayuda') return { cmd };
  if (cmd === 'card') return gente[0] ? { cmd, quien: gente[0] } : { cmd };
  if (!gente[0]) return { cmd: 'falta_rival' };
  const carta = palabras.slice(1).map((p) => CARTAS[p]).find(Boolean);
  return Object.assign({ cmd, rival: gente[0] }, gente[1] ? { contra: gente[1] } : {}, carta ? { carta } : {});
}

export const AYUDA = '**Me puedes pedir:**\n· `@ULAYA card`: tu carta (o `@ULAYA card @alguien`)\n· `@ULAYA vs @alguien`: un versus (puedes sumar ' +
  '`servidor`, `temporada`, `competitiva` o `país`)\n-# También con `/card` y `/versus`.';

/** Lo que se publica: lo del Worker como respuesta al mensaje, sin el flag de efímero y sin que suene nadie */
export function cuerpo(msg, aQue) {
  const m = Object.assign({}, msg || {});
  m.flags = (Number(m.flags) || 0) & 32768;
  delete m.tts;
  m.allowed_mentions = { parse: [], replied_user: false };
  m.message_reference = { message_id: aQue, fail_if_not_exists: false };
  return m;
}

const aviso = (txt) => ({ flags: 32768, components: [{ type: 17, components: [{ type: 10, content: txt }] }] });

export class Menciones {
  constructor({ client, token, vigia, clave, anotar }) {
    Object.assign(this, { client, token, vigia, clave, anotar: anotar || (() => {}) });
    this.ultima = new Map();
  }

  /** Un mensaje del Gateway. Nunca tira: todo lo que falla queda anotado */
  async recibir(m) {
    try {
      if (!m || !m.guild || !m.author || m.author.bot || m.webhookId) return;
      const yo = this.client.user && this.client.user.id;
      if (!yo) return;
      const rol = m.guild.roles.botRoleFor ? m.guild.roles.botRoleFor(yo) : null;
      if (!m.mentions.users.has(yo) && !(rol && m.mentions.roles.has(rol.id))) return;
      const p = leerMencion(m.content, yo, rol && rol.id);
      if (!p) return;
      const yoMiembro = m.guild.members.me;
      const perm = yoMiembro && m.channel && m.channel.permissionsFor ? m.channel.permissionsFor(yoMiembro) : null;
      if (!perm || !perm.has(PERMISOS)) return;
      const ahora = Date.now();
      if (ahora - (this.ultima.get(m.author.id) || 0) < ENTRE_MS) return;
      this.ultima.set(m.author.id, ahora);
      if (this.ultima.size > 5000) this.ultima.delete(this.ultima.keys().next().value);
      if (p.cmd === 'ayuda') return this.publicar(m, aviso(AYUDA), true);
      if (p.cmd === 'falta_rival') return this.publicar(m, aviso('¿Contra quién? Menciónalo: `@ULAYA vs @alguien`.'), true);
      const otros = [p.quien, p.rival, p.contra].filter(Boolean).map((id) => {
        const u = m.mentions.users.get(id);
        const mm = m.mentions.members && m.mentions.members.get(id);
        return u ? { id, username: u.username, global_name: u.globalName, avatar: u.avatar, nick: mm ? mm.nickname : null } : null;
      }).filter(Boolean);
      const mem = m.member;
      const r = await fetch(this.vigia + '/mencion', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-lg-ciclo': this.clave },
        body: JSON.stringify(Object.assign({}, p, { g: m.guild.id, c: m.channel.id, m: m.id,
          u: { id: m.author.id, username: m.author.username, global_name: m.author.globalName, avatar: m.author.avatar, nick: mem ? mem.nickname : null },
          roles: mem ? [...mem.roles.cache.keys()] : [], otros })),
        signal: AbortSignal.timeout(10000),
      });
      const d = r.ok ? await r.json() : null;
      if (!d || !d.ok || d.apagado || !d.msg) {
        if (!d || !d.ok) this.anotar('⚠️ mención: el Worker no contestó', r.status);
        return;
      }
      return this.publicar(m, d.msg, !!d.efimero);
    } catch (e) {
      this.anotar('⚠️ mención:', String((e && e.message) || e).slice(0, 150));
    }
  }

  async publicar(m, msg, efimero) {
    const r = await fetch(`${API}/channels/${m.channel.id}/messages`, {
      method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bot ' + this.token },
      body: JSON.stringify(cuerpo(msg, m.id)), signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) { this.anotar('⚠️ mención: Discord no dejó publicar', r.status, (await r.text().catch(() => '')).slice(0, 150)); return; }
    if (!efimero) return;
    const j = await r.json().catch(() => null);
    if (!j || !j.id) return;
    setTimeout(() => {
      fetch(`${API}/channels/${m.channel.id}/messages/${j.id}`, { method: 'DELETE', headers: { Authorization: 'Bot ' + this.token } }).catch(() => {});
    }, BORRAR_S * 1000).unref?.();
  }
}
