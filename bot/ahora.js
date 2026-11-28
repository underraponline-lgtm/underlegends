// 🎧 «AHORA MISMO» (28/11/2026). Dlx, 27/11/2026 (la retención es el objetivo): en la página, las llamadas de voz que
// están pasando AHORA en todos los servidores socios —no sólo DRA—, sólo las de canales PÚBLICOS, con números y no con
// nombres (cuántos hay y cuántos con el micro abierto), que cada socio pueda apagarlo en su panel y un botón «Unirme».
//
// EL CAMINO:
//   grabador/ahora.js (Railway, ya conectado 24/7 con los estados de voz) arma la foto de cada servidor y la manda acá con
//   la clave del ciclo (`POST /ahora`, como `/mencion`), sólo cuando cambia, como mucho una vez por minuto, y un latido
//   cada 10 minutos aunque no cambie → el objeto la guarda (una fila por servidor, pisada) → la página la lee por
//   `GET /api/ahora` (bot/paginas/_worker.js, 30 s en el borde) → web/src/ahora_mismo.jsx.
//
// ⚠️ NUNCA LLEGA NADA DE NADIE. La foto trae el canal (id y nombre), cuántos están, cuántos con el micro abierto y desde
// cuándo. Ni un id ni un nombre de persona: `limpiar()` sólo copia esas cinco cosas, lo demás no se guarda aunque venga.
// ⚠️ SÓLO SOCIOS: un servidor que no está en el mapa de los socios (`guilds`, el que deja el vigía desde
// datos/servidores.json) no se guarda. Y la respuesta le dice al grabador cuáles son (`acepta`), así deja de mandar el resto.
// ⚠️ EL INTERRUPTOR DEL SOCIO: `ahora_mismo` en su `cfg:<guild>` (el mismo de /settings y del panel, como `leer_chat`).
// Prendido de entrada; apagado, ese servidor no aparece nunca. DRA siempre (es la casa de la Liga).
// ⚠️ SE VENCE SOLO: una fila sin latido en `CADUCA_MS` no se muestra (y se borra en el próximo envío). Si Railway se cae,
// la página deja de mostrar llamadas que quizá ya terminaron en vez de mostrarlas para siempre.

export const CADUCA_MS = 15 * 60000;
//: lo que el objeto acepta por envío (un grabador sano manda mucho menos)
export const MAX_SERVIDORES = 80;
export const MAX_CANALES = 12;
export const MAX_NOMBRE = 60;
//: cuántas filas le llegan a la página como mucho
export const MAX_PAGINA = 24;
//: el servidor de la Liga: aparece siempre, sin interruptor
export const SIEMPRE = 'DRA';
//: el envío más grande que el Worker deja pasar
export const MAX_CUERPO = 60000;

const SNOW = /^\d{15,22}$/;
const json = (x, st = 200, cache = 0) => new Response(JSON.stringify(x), { status: st, headers: {
  'content-type': 'application/json; charset=utf-8', 'cache-control': cache ? `public, max-age=${cache}` : 'no-store' } });

export function ahoraTablas(sql) {
  // una fila por servidor con llamadas, PISADA en cada envío: `v` es la lista de canales ya limpia, `t` el último envío
  // que la confirmó (el latido). Ni un dato de nadie
  sql.exec('CREATE TABLE IF NOT EXISTS ahora (g TEXT PRIMARY KEY, sv TEXT NOT NULL, v TEXT NOT NULL, t INTEGER NOT NULL) WITHOUT ROWID');
}

/** El nombre del canal, para mostrar: sin caracteres de control ni de dirección, sin espacios de más, hasta `MAX_NOMBRE`. */
export function nombreCanal(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').replace(/[\u0000-\u001F\u007F​-‏‪-‮⁦-⁩]/g, '')
    .replace(/ {2,}/g, ' ').trim().slice(0, MAX_NOMBRE);
}

/**
 * Los canales de un servidor tal como se guardan: `[{c, n, p, m, d}]` — el id del canal, su nombre, cuántas personas,
 * cuántas con el micro abierto y desde cuándo (ms). Lo que no valga se descarta; lo que sobre (cualquier otra clave, como
 * ids o nombres de gente) NO se copia. Ordenados por cuántos hay. `ahora` acota `d`: nada del futuro, nada de hace más de
 * una semana.
 */
export function limpiar(lista, ahora = Date.now()) {
  if (!Array.isArray(lista)) return [];
  const out = [];
  const vistos = new Set();
  for (const x of lista.slice(0, MAX_CANALES * 2)) {
    if (!x || typeof x !== 'object') continue;
    const c = String(x.c || '');
    if (!SNOW.test(c) || vistos.has(c)) continue;
    const p = Math.floor(Number(x.p));
    if (!Number.isFinite(p) || p < 1 || p > 10000) continue;
    let m = Math.floor(Number(x.m));
    if (!Number.isFinite(m) || m < 0) m = 0;
    if (m > p) m = p;
    let d = Math.floor(Number(x.d));
    if (!Number.isFinite(d) || d > ahora + 60000 || d < ahora - 7 * 86400000) d = ahora;
    const n = nombreCanal(x.n) || 'Llamada';
    vistos.add(c);
    out.push({ c, n, p, m, d: Math.min(d, ahora) });
  }
  return out.sort((a, b) => b.p - a.p || a.d - b.d).slice(0, MAX_CANALES);
}

/** guild -> sv de los socios, del mapa que deja el vigía (`guilds`: sv -> guild) */
export function socios(o) {
  const m = new Map();
  for (const [sv, g] of Object.entries((o.leer && o.leer('guilds')) || {})) if (SNOW.test(String(g))) m.set(String(g), String(sv));
  return m;
}

/** ¿Ese socio deja mostrar sus llamadas? `ahora_mismo` de su `cfg:<guild>` (prendido salvo `false`); DRA siempre. La copia
 *  en memoria es la misma de `cfgChat` del objeto (5 min), que `socioAjustes()` ya tira al cambiar un ajuste. */
export async function prendido(o, g, sv, ahora = Date.now()) {
  if (sv === SIEMPRE) return true;
  const memo = (o.cfgChat = o.cfgChat || new Map());
  const m0 = memo.get(g);
  let c = m0 && ahora - m0.t < 5 * 60000 ? m0.c : null;
  if (!c) {
    try { c = JSON.parse((await o.env.KV.get('cfg:' + g, { cacheTtl: 60 })) || '{}') || {}; } catch (e) { c = {}; }
    memo.set(g, { c, t: ahora });
  }
  return c.ahora_mismo !== false;
}

/**
 * 📥 Lo que manda el grabador: `{g: {<guild>: [{c, n, p, m, d}]}}`, la foto ENTERA (un servidor que no viene ya no tiene
 * llamadas). Pisa la fila de cada socio prendido con llamadas y borra las demás. Devuelve `acepta`: los guilds de los
 * socios, para que el grabador no mande los de otros servidores.
 */
export async function poner(o, d, ahora = Date.now()) {
  const g0 = d && d.g;
  if (!g0 || typeof g0 !== 'object' || Array.isArray(g0)) return { error: 'datos' };
  const S = socios(o);
  const quedan = new Set();
  let n = 0;
  for (const [g, lista] of Object.entries(g0).slice(0, MAX_SERVIDORES)) {
    const sv = S.get(String(g));
    if (!sv) continue;
    const canales = limpiar(lista, ahora);
    if (!canales.length || !(await prendido(o, String(g), sv, ahora))) continue;
    o.sql.exec('INSERT INTO ahora (g, sv, v, t) VALUES (?, ?, ?, ?) ON CONFLICT(g) DO UPDATE SET sv = excluded.sv, v = excluded.v, t = excluded.t',
      String(g), sv, JSON.stringify(canales), ahora);
    quedan.add(String(g));
    n += canales.length;
  }
  for (const f of o.sql.exec('SELECT g FROM ahora').toArray()) {
    if (!quedan.has(String(f.g))) o.sql.exec('DELETE FROM ahora WHERE g = ?', f.g);
  }
  return { ok: true, servidores: quedan.size, canales: n, acepta: [...S.keys()] };
}

/** 🙈 Un socio que lo apaga: su fila se va en el momento, sin esperar al próximo envío. */
export function borrar(o, g) {
  try { o.sql.exec('DELETE FROM ahora WHERE g = ?', String(g)); } catch (e) { /* la tabla todavía no existe */ }
}

/**
 * 📤 Lo que ve la página: `{t, ll: [{sv, g, c, n, p, m, d}]}`, las llamadas vivas de los socios (con latido en los
 * últimos `CADUCA_MS`), las más llenas primero. Un socio que dejó de serlo no aparece aunque su fila siga.
 */
export function leer(o, ahora = Date.now()) {
  const S = socios(o);
  const ll = [];
  for (const f of o.sql.exec('SELECT g, sv, v, t FROM ahora WHERE t > ?', ahora - CADUCA_MS).toArray()) {
    if (!S.has(String(f.g))) continue;
    let v = [];
    try { v = JSON.parse(f.v) || []; } catch (e) { v = []; }
    for (const x of v) ll.push({ sv: S.get(String(f.g)) || String(f.sv), g: String(f.g), c: x.c, n: x.n, p: x.p, m: x.m, d: x.d });
  }
  ll.sort((a, b) => b.p - a.p || a.d - b.d);
  return { t: ahora, ll: ll.slice(0, MAX_PAGINA) };
}

/** Las dos rutas del objeto: `/ahora-leer` (GET, la página) y `/ahora-poner` (POST, sólo desde el Worker con la clave). */
export async function rutaObjeto(o, req, ruta) {
  if (ruta === '/ahora-leer') return json(leer(o, Date.now()));
  const d = await req.json().catch(() => null);
  const r = await poner(o, d, Date.now());
  return json(r, r.error ? 400 : 200);
}

const alObjeto = (env, ruta, init) => env.AVISOS.get(env.AVISOS.idFromName('liga')).fetch('https://avisos/' + ruta, init);

/**
 * 🌐 `/ahora` del Worker. GET: público (lo pide el proxy de la página, que lo guarda 30 s en el borde). POST: sólo con la
 * clave del ciclo (`esCiclo`, la del grabador de Railway).
 */
export async function ruta(req, env, esCiclo) {
  if (!env.AVISOS) return json({ error: 'sin objeto' }, 503);
  if (req.method === 'GET') {
    try {
      const r = await alObjeto(env, 'ahora-leer', { method: 'GET' });
      return new Response(r.body, { status: r.status, headers: { 'content-type': 'application/json; charset=utf-8',
        'cache-control': r.status === 200 ? 'public, max-age=20' : 'no-store' } });
    } catch (e) { return json({ error: 'objeto' }, 502); }
  }
  if (req.method !== 'POST') return json({ error: 'método no permitido' }, 405);
  if (!esCiclo) return new Response('', { status: 403 });
  const crudo = await req.text();
  if (crudo.length > MAX_CUERPO) return json({ error: 'demasiado grande' }, 413);
  try {
    return await alObjeto(env, 'ahora-poner', { method: 'POST', body: crudo, headers: { 'content-type': 'application/json' } });
  } catch (e) { return json({ error: 'objeto' }, 502); }
}
