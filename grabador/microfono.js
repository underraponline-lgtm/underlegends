// 🎙️ LA PRUEBA DE MICRO: ENTRAS A UN CANAL, ULAYA TE ESCUCHA Y TE DICE EN VOZ QUÉ HACER (21/11/2026).
//
// Dlx, 21/11/2026: *«un canal de voz que el bot te escuche en vivo y pruebe tu mic antes del evento, y el bot te diga
// en voz qué tienes que hacer específicamente»*; a cuándo, *«Armarla ya, bot después»*; la voz, Piper con voz de
// mujer (voz/hacer_voz.py).
//
// LO QUE PASA:
//   1. entras a un canal de `PRUEBA_MICRO` y el bot entra detrás
//   2. «Hola, soy ULAYA… cuando termine la cuenta entra un bit: rapea encima» + «Tres. Dos. Uno. ¡Tiempo!» (Dlx:
//      «el bot tendría que decir 3 2 1 como una batalla real») y entra el beat
//   3. te escucha hasta `VOZ_OBJETIVO_S` de voz (o `ESCUCHAR_MAX_S`); con menos de `VOZ_MIN_S`, «no te escuché»
//   4. te mide con lo mismo que el grabador (calidad.js) y te dice el problema más grave y cómo arreglarlo, o «perfecto»
//   5. «Así te escuchan los demás» y te pone `ECO_S` de tu propia voz, tal como llegó
//   6. lo mismo por escrito en el chat del canal, con tu mención, y sale
//
// ⚠️ UN BOT ESTÁ EN UNA SOLA LLAMADA POR SERVIDOR. Con el bot de siempre, la prueba no entra si está grabando en ese
// servidor (lo dice por escrito, una vez cada `OCUPADO_CADA`) y el grabador no entra mientras hay una prueba (index.js
// pregunta `activa()`): si no, Discord movería al bot de una llamada a la otra a mitad de una grabación. Con
// `PRUEBA_TOKEN` en Railway la hace un segundo bot, con su propio grupo de conexiones, y las dos cosas van juntas.
//
// ⚠️ NO SE GUARDA NADA: lo que dijiste vive en memoria lo que dura la prueba y el .ogg del eco se borra al terminar.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import {
  joinVoiceChannel, createAudioPlayer, createAudioResource, StreamType, AudioPlayerStatus, entersState,
  VoiceConnectionStatus, EndBehaviorType, NoSubscriberBehavior,
} from '@discordjs/voice';
import { PistaOpus, muestrasDe, HZ } from './ogg.js';
import { MedidorVoz, TEXTOS, VOZ_MIN_S } from './calidad.js';

const VOZ = path.join(path.dirname(fileURLToPath(import.meta.url)), 'voz');
export const VOZ_OBJETIVO_S = 8;      // con esto de voz ya alcanza para medir
export const ESCUCHAR_MAX_S = 20;     // si en este tiempo no juntó `VOZ_MIN_S`, «no te escuché»
export const ECO_S = 5;               // cuánto de tu voz te devuelve
const OCUPADO_CADA = 30 * 60000;      // el «estoy grabando» por escrito, como mucho una vez cada media hora por canal
//: las frases que tiene que haber en voz/ (las revisa prueba.js)
export const FRASES = ['hola', 'hola_beat', 'cuenta', 'noteoigo', 'bien', 'bajo', 'satura', 'corta', 'telefono', 'escucha',
  'otravez', 'deauno'];

// ── 🚦 LOS LÍMITES (Dlx, 21/11/2026: «tenemos que añadir pruebas para evitar que la gente abuse o cooldowns») ──
// Por persona: `POR_PERSONA_HORA` pruebas por hora y `ENTRE_PRUEBAS_S` entre una y otra; por servidor,
// `POR_SERVIDOR_HORA`. Pasado el límite el bot NO entra a la llamada: lo dice por escrito UNA vez por bloqueo, así
// entrar y salir no sirve para llenar el chat. Cuenta al entrar el bot, también si te vas a la mitad. Todo se cambia
// en Railway sin tocar código (`PRUEBAS_POR_HORA`, `PRUEBAS_ENTRE_S`, `PRUEBAS_SERVIDOR_HORA`). Vive en memoria: un
// reinicio lo vacía, y eso está bien (un reinicio es raro y nadie lo provoca).
const n = (v, d) => (Number.isFinite(Number(v)) && String(v ?? '').trim() !== '' ? Number(v) : d);
export const POR_PERSONA_HORA = n(process.env.PRUEBAS_POR_HORA, 3);
export const ENTRE_PRUEBAS_S = n(process.env.PRUEBAS_ENTRE_S, 60);
export const POR_SERVIDOR_HORA = n(process.env.PRUEBAS_SERVIDOR_HORA, 40);
const HORA = 3600000;

/** ¿Puede probar ahora? `null` si sí; si no, `{ por: 'seguido'|'persona'|'servidor', en: ms hasta que pueda }`. */
export function limite(mios = [], delServidor = [], ahora = Date.now()) {
  const m = mios.filter((t) => ahora - t < HORA);
  if (m.length && ahora - Math.max(...m) < ENTRE_PRUEBAS_S * 1000) {
    return { por: 'seguido', en: ENTRE_PRUEBAS_S * 1000 - (ahora - Math.max(...m)) };
  }
  if (m.length >= POR_PERSONA_HORA) return { por: 'persona', en: HORA - (ahora - Math.min(...m)) };
  const s = delServidor.filter((t) => ahora - t < HORA);
  if (s.length >= POR_SERVIDOR_HORA) return { por: 'servidor', en: HORA - (ahora - Math.min(...s)) };
  return null;
}

/** Lo que dice el bot cuando alguien llegó al límite. */
export function textoLimite(lim, id) {
  const min = Math.max(1, Math.ceil(lim.en / 60000));
  if (lim.por === 'seguido') return `🎙️ <@${id}> espera un minuto entre una prueba y otra.`;
  if (lim.por === 'persona') return `🎙️ <@${id}> ya probaste tu micro ${POR_PERSONA_HORA} veces en la última hora. `
    + `Vuelve a probar en ${min} min.`;
  return `🎙️ Hubo muchas pruebas de micro en este servidor en la última hora. Vuelve a probar en ${min} min.`;
}

// ── 🎵 EL BEAT (Dlx, 21/11/2026: «para hacerlo más real, que ULAYA reproduzca un beat para que el MC pruebe»).
// Sólo de los beatmakers de `datos/beatmakers.json` (los que dieron permiso) o de beats «Free»/«Uso libre». Cada uno
// es un recorte hecho por `voz/hacer_beat.py`, y se acredita en el mensaje del final. Sin beats, la prueba es la de
// antes («habla o rapea», con la cuenta suelta).
//
// 🥊 LA CUENTA VA ADENTRO DEL BEAT (Dlx, 21/11/2026: *«ULAYA tiene que decir 3 2 1 dentro del beat… cuando la 4.ª barra
// va a acabar»*). Cada recorte son 4 barras de beat con «¡Tres! ¡Dos! ¡Uno! ¡Tiempo!» en los 4 golpes de la 4.ª, y el
// MC entra en el 1 siguiente: `entra_s`. Se empieza a escuchar ahí, no antes: lo que alguien diga durante la intro no
// es su rapeo. Un beat sin `entra_s` (de antes de esto) no se usa.
export function beats() {
  try {
    const l = JSON.parse(fs.readFileSync(path.join(VOZ, 'beats', 'beats.json'), 'utf8')).beats || [];
    return l.filter((b) => b && b.archivo && typeof b.entra_s === 'number' && fs.existsSync(path.join(VOZ, 'beats', b.archivo)));
  } catch (e) {
    return [];
  }
}

export class PruebaMicro {
  /**
   * @param {object} o
   * @param {import('discord.js').Client} o.client  el bot que hace la prueba
   * @param {string[]} o.canales                    los canales de voz de prueba
   * @param {string} o.grupo                        el grupo de conexiones de @discordjs/voice ('default' si es el bot de siempre)
   * @param {(gid: string) => boolean} o.ocupado    si ese bot está grabando en ese servidor
   * @param {Function} o.anotar                     el log
   */
  constructor({ client, canales, grupo = 'default', ocupado = () => false, anotar = console.log }) {
    Object.assign(this, { client, canales: new Set(canales), grupo, ocupado, anotar });
    this.sesiones = new Map();      // guild -> { canal, persona }
    this.avisoOcupado = new Map();  // canal -> cuándo
    this.usos = new Map();          // persona -> [cuándo probó]
    this.usosSv = new Map();        // guild -> [cuándo]
    this.avisoLimite = new Map();   // persona -> hasta cuándo no se le vuelve a decir que llegó al límite
  }

  /** ¿Hay una prueba en curso en ese servidor? (el grabador no entra mientras tanto) */
  activa(gid) { return this.sesiones.has(gid); }

  /** Lo llama `VoiceStateUpdate`. */
  async cambio(antes, ahora) {
    const canal = ahora.channel;
    if (!canal || !this.canales.has(canal.id) || ahora.member?.user?.bot || antes.channelId === canal.id) return;
    const gid = canal.guild.id;
    if (this.ocupado(gid)) {
      if (Date.now() - (this.avisoOcupado.get(canal.id) || 0) > OCUPADO_CADA) {
        this.avisoOcupado.set(canal.id, Date.now());
        await canal.send({ content: '🎙️ Ahora estoy grabando la competencia de este servidor. Prueba tu micro antes del '
          + 'próximo evento.', allowedMentions: { parse: [] } }).catch(() => {});
      }
      return;
    }
    if (this.sesiones.has(gid)) return;           // ya hay una: la de quien llegó primero
    const t = Date.now();
    const lim = limite(this.usos.get(ahora.id), this.usosSv.get(gid), t);
    if (lim) {
      if (t >= (this.avisoLimite.get(ahora.id) || 0)) {
        this.avisoLimite.set(ahora.id, t + lim.en);
        this.anotar(`🚦 prueba de micro: límite (${lim.por})`);
        await canal.send({ content: textoLimite(lim, ahora.id), allowedMentions: { users: [ahora.id] } }).catch(() => {});
      }
      return;
    }
    const recorta = (l) => (l || []).filter((x) => t - x < HORA).concat(t);
    this.usos.set(ahora.id, recorta(this.usos.get(ahora.id)));
    this.usosSv.set(gid, recorta(this.usosSv.get(gid)));
    this.sesiones.set(gid, { canal: canal.id, persona: ahora.id });
    try {
      await this.probar(canal, ahora.member);
    } catch (e) {
      this.anotar('⚠️ prueba de micro:', String(e.message || e).slice(0, 150));
    } finally {
      this.sesiones.delete(gid);
    }
  }

  async probar(canal, miembro) {
    const humanos = () => [...canal.members.values()].filter((m) => !m.user.bot);
    const sigue = () => canal.members.has(miembro.id);
    const con = joinVoiceChannel({
      channelId: canal.id, guildId: canal.guild.id, adapterCreator: canal.guild.voiceAdapterCreator,
      selfDeaf: false, selfMute: false, group: this.grupo,
    });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'micro-'));
    try {
      await entersState(con, VoiceConnectionStatus.Ready, 20000);
      const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
      con.subscribe(player);
      const decir = async (archivo) => {
        player.play(createAudioResource(fs.createReadStream(archivo), { inputType: StreamType.OggOpus }));
        await entersState(player, AudioPlayerStatus.Playing, 5000);
        await entersState(player, AudioPlayerStatus.Idle, 30000);
      };
      const frase = (k) => decir(path.join(VOZ, k + '.ogg'));
      this.anotar(`🎙️ prueba de micro en ${canal.guild.name} / ${canal.name}`);

      if (humanos().length > 1) { await frase('deauno'); return; }
      const lista = beats();
      const beat = lista.length ? lista[Math.floor(Math.random() * lista.length)] : null;
      const credito = beat ? `\n🎵 Beat: «${beat.titulo}» de **${beat.beatmaker}**` : '';
      await frase(beat ? 'hola_beat' : 'hola');
      if (!sigue()) return;
      if (beat) {
        // el beat trae la cuenta adentro: se espera hasta el 1 donde entra el MC (250 ms antes, por si arranca justo)
        player.play(createAudioResource(fs.createReadStream(path.join(VOZ, 'beats', beat.archivo)), { inputType: StreamType.OggOpus }));
        await entersState(player, AudioPlayerStatus.Playing, 5000).catch(() => {});
        const arranco = performance.now();
        while (performance.now() - arranco < beat.entra_s * 1000 - 250) {
          if (!sigue()) { player.stop(true); return; }
          await new Promise((r) => setTimeout(r, 200));
        }
      } else {
        await frase('cuenta');
      }

      // ── escuchar (con el beat sonando, si hay) ──
      const paquetes = [];
      const t0 = performance.now();
      let voz = 0;
      const st = con.receiver.subscribe(miembro.id, { end: { behavior: EndBehaviorType.Manual } });
      await new Promise((listo) => {
        const fin = () => { clearInterval(reloj); st.destroy(); listo(); };
        st.on('data', (p) => {
          paquetes.push({ p: Buffer.from(p), ms: performance.now() - t0 });
          voz += muestrasDe(p) / HZ;
          if (voz >= VOZ_OBJETIVO_S) fin();
        });
        st.once('error', fin);
        const reloj = setInterval(() => {
          if (!sigue() || performance.now() - t0 > ESCUCHAR_MAX_S * 1000) fin();
        }, 250);
      });
      if (beat) {
        player.stop(true);
        await entersState(player, AudioPlayerStatus.Idle, 3000).catch(() => {});
      }
      if (!sigue()) return;
      if (voz < VOZ_MIN_S) {
        await frase('noteoigo');
        await this.escribir(canal, `🎙️ <@${miembro.id}> no te escuché: revisa que tu micrófono no esté silenciado y que `
          + 'en Ajustes de usuario → Voz y video esté elegido el correcto.' + credito, miembro.id);
        return;
      }

      // ── medir: lo mismo que mide el grabador ──
      const m = new MedidorVoz(miembro.id);
      paquetes.forEach(({ p, ms }) => m.agregar(p, ms));
      const r = await m.ventana(dir);
      const problema = r.problema;
      this.anotar(`🎙️ prueba de micro: ${problema || 'bien'}`
        + (r.medida ? ` (${r.medida.db?.toFixed(1)} dB · ${(r.medida.perdida * 100).toFixed(1)} % perdido)` : ''));
      await frase(problema || 'bien');
      if (!sigue()) return;

      // ── el eco: los últimos segundos de tu voz, tal como llegaron ──
      const eco = path.join(dir, 'eco.ogg');
      const pista = new PistaOpus(eco);
      let n = 0;
      const desde = Math.max(0, paquetes.length - Math.round(ECO_S * 50));
      paquetes.slice(desde).forEach(({ p }) => pista.agregar(p, (n++) * 20));
      pista.cerrar();
      await frase('escucha');
      await decir(eco);
      await frase('otravez');
      await this.escribir(canal, (problema ? TEXTOS[problema](miembro.id)
        : `🎙️ <@${miembro.id}> se te escucha **perfecto**. Estás listo para competir.`) + credito, miembro.id);
    } finally {
      try { con.destroy(); } catch (e) { /* ya estaba */ }
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  async escribir(canal, texto, id) {
    await canal.send({ content: texto, allowedMentions: { users: [id] } })
      .catch((e) => this.anotar('⚠️ no pude escribir en la prueba de micro:', String(e.message || e).slice(0, 100)));
  }
}
