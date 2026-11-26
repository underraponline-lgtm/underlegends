// 🔁 SEPARAR LAS BATALLAS DESPUÉS (25/11/2026, Dlx: «haz todas»). Si ULAYA no pudo separar las batallas en el momento —la
// llave no estaba tocada todavía, o no las ubicó (DESGRACIAS EN TOKYO VOL 35, 24/11)—, deja `habla.json` (quién habló
// cuándo, sin audio). Con eso y la llave de AHORA esto hace lo mismo que `entregarBatallas()` de index.js, pero sin estar
// grabando: `ubicarTodas()` y `guion()` de batallas.js, las mismas, así que lo que sale es idéntico a una entrega normal.
//
// Uso: LG_CICLO=<clave del ciclo> node bot/rearmar_batallas.mjs <habla.json> > batallas.json
// Escribe por la salida el mismo JSON que ULAYA adjunta como batallas.json; los cortes del audio los hace quien lo llama.
// (vive en bot/ y no en grabador/ a propósito: un push a grabador/ reinicia ULAYA en Railway y corta la grabación)
import fs from 'node:fs';
import { ubicarTodas, guion, nombreClip, MIN_CLIP_S, completarIds } from '../grabador/batallas.js';
// batallas.js no importa nada de afuera: esto corre en un runner sin `npm install`. La clave del ciclo la pasa quien llama
// (LG_CICLO, de bot/clave_ciclo.py): vivo.js la sabe armar pero importa discord.js

const VIGIA = 'https://liga-global-bot.liga-global-ul.workers.dev';

const h = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const inicio = new Date(h.inicio).getTime();
const seg = Number(h.seg) || 0;
const habla = new Map(Object.entries(h.habla || {}));
const q = new URLSearchParams({ g: h.servidor, desde: String(inicio), hasta: String(inicio + seg * 1000 + 3600000) });
const r = await fetch(VIGIA + '/avisos/batallas?' + q, { headers: { 'x-lg-ciclo': process.env.LG_CICLO || '' },
  signal: AbortSignal.timeout(30000) });
const d = r.ok ? await r.json() : {};
// ⚓ IGUAL QUE ULAYA (26/11/2026): con las anclas y los nombres completados. Sin ellas esto separaba distinto que la
// entrega —en WOF del 25/11 rearmó «semifinales-mats-vs-tmax-turbo-pn» de la PRIMERA grabación, cuando esa semifinal se
// jugó en la segunda—. Las anclas son ms de reloj y el segundo de la grabación es la resta. ⚠️ Si a ULAYA la sacaron de
// la llamada, `habla.json` no dice cuánto estuvo afuera: el ancla cae hasta esos minutos más tarde (las ventanas tienen
// 10 min de margen antes y 2,5 después, así que casi siempre alcanza)
completarIds(d.llaves, new Map());
const bs = ubicarTodas(d.llaves, habla, seg, (ts) => (ts - inicio) / 1000);
for (const b of bs) {
  try { b.guion = guion(b, habla); } catch (e) { b.guion = null; }
}
process.stdout.write(JSON.stringify({
  v: 1, servidor: h.servidor, inicio: h.inicio, rearmado: true,
  batallas: bs.map((b) => ({ clip: b.corta ? null : nombreClip(b), r: b.r, llave: b.llave, evento: b.evento, nombres: b.nombres,
    gano: b.gano, desde: Math.round(b.desde * 10) / 10, hasta: Math.round(b.hasta * 10) / 10, guion: b.guion || null })),
}));
process.stderr.write(`⚔️ ${bs.length} batallas ubicadas (${bs.filter((b) => !b.corta).length} de ${MIN_CLIP_S} s o más)\n`);
