// 🎙️💎 LOS EVENTOS GRABADOS, CON EL PREMIUM (28/11/2026, el paso 7 del plan del sábado). Dlx, 27/11: «30 s gratis de cada
// ronda, tu propia batalla completa gratis, el evento entero para Premium (audio servido por el Worker, no link público)».
//
// QUIÉN OYE QUÉ (`acceso()`, la única regla; la página y Discord leen de acá):
//   · todos, sin cuenta        → el adelanto de 30 s de cada batalla (`previa`) y «Lo mejor de la noche» (`mejor`, ver CFG0)
//   · quien rapeó esa batalla  → esa batalla ENTERA, gratis (por su Discord ID: `ids`, de los `personas` de ULAYA)
//   · Premium                  → todas las batallas enteras + la grabación completa (las partes de Logs, con lo del medio)
//   Premium = el rol «Pase T» (1054496803548049463, pago) o «Pase Premium» (1563941336531607575, regalo) —`ROLES_PREMIUM`,
//   el mismo par de bot/pase.py—, que el ciclo vuelca a la tabla `pase_premium` del objeto, más quien lo usó del Inventario
//   (`premium_vale`, que también escribe `pase_premium`) y el dueño (`pasePremium()` ya le da [0, null]). Se pregunta con la
//   misma temporada con que se escribió (`paseDatos().cfg.temp`, ver `tempPase()` de bot/tienda.js: con la del catálogo
//   nadie era Premium).
//
// EL CAMINO:
//   ULAYA (Railway) graba y entrega la mezcla en Logs de DRA, como siempre: NO cambia nada en el grabador.
//   → el motor (GitHub Actions, `procesar.yml`) ya separa cada batalla en m4a sin los vacíos (`archivo_reels.audios()`);
//     con bot/grabados.py corta además el adelanto de 30 s (`-c copy`), sube todo a un lugar PRIVADO de R2 y registra el
//     evento acá (`POST /grabados/registrar`, con la clave del ciclo)
//   → el objeto guarda el índice: qué batallas, quién rapeó en cada una (IDs), dónde está cada archivo, hasta cuándo
//   → la página pide `GET /api/grabados?ll=<n>` con su sesión y recibe, por batalla, un link SELLADO a lo que puede oír
//   → `GET /api/grabados/a/<sello>` lo sirve el Worker desde R2 (o desde el adjunto de Logs), con Range, sin decodificar nada.
//
// 🔐 EL SELLO (`sellar()`/`abrir()`): AES-GCM con una clave derivada del token del bot (como `claveCiclo()`: no hay secreto
// nuevo). Adentro va la clave de R2 —o el link firmado de Discord— y el vencimiento (`SELLO_MIN`). Quien lo tiene no puede
// leer adónde apunta ni cambiarlo, y a las 2 h deja de andar: NUNCA sale un link público permanente. Rotar el token del
// bot sólo corta los sellos de esas 2 h.
//
// 🪣 DÓNDE VIVE EL AUDIO. Lo ideal es un bucket SIN acceso público (`GRABADOS`, ver `BUCKET_GRABADOS` en bot/desplegar.py).
// Mientras no exista, va al bucket de las cartas (`CARTAS`, que ES público por r2.dev) bajo `grab/<evento>-<32 hex al
// azar>/…`: la clave no se puede adivinar (128 bits), r2.dev no lista, y la clave nunca sale del Worker (va sellada). Es un
// candado de «link imposible de adivinar», no de permiso: si alguien la filtrara desde adentro, quedaría abierta hasta que
// venza. Por eso el bucket aparte es lo recomendado (`bk: 'g'`), y el código anda con los dos.
//
// 🧾 LA GRABACIÓN COMPLETA (con lo del medio) NO SE COPIA A R2: ULAYA ya la deja en Logs y Discord la conserva. Para
// Premium, el objeto le pide a Discord los adjuntos frescos (como el «Escuchar» del staff, `socioLlave()`), los guarda
// hasta que vencen (`grab_url`) y el Worker los reenvía con Range. Medido el 28/11: 27,5 MB por hora, ~150 MB por día:
// en R2 serían 4,5 GB al mes.
//
// 🙈 OLVIDARME (`olvidar()`): su ID sale del índice, sus batallas se RETIRAN (se borran de R2: tienen su voz) y de ese
// evento ya no se sirve la grabación completa. Lo que queda en Logs de DRA es del staff y no pasa por acá.
//
// ⚠️ 10 ms DE CPU: el Worker nunca decodifica ni recorta audio. Un pedido con Range es leer ese pedazo de R2 y pasarlo.

export const PREVIA_S = 30;
//: cuánto dura un sello (minutos): lo que tarda escuchar el evento entero con pausas, y no más
export const SELLO_MIN = 120;
export const ROLES_PREMIUM = ['1054496803548049463', '1563941336531607575'];
//: el foro «『🔴』eventos-grabados» de DRA (tipo 15): lo ven los dos roles del Pase y el staff. ⚠️ Desde el 28/11/2026 NO hay un
//: post por evento (Dlx: «no vamos a crear un post para cada uno… en uno alcanzaría todo»): un post por servidor, armado y
//: editado por bot/grabados_foro.py con lo que guarda acá `grab_hist` (ver `historia()`)
export const FORO = '1575848965503721523';
export const BASE_WEB = 'https://underlegends.pages.dev';
//: lo de entrada; Dlx lo cambia con `POST /grabados/config` (los días los decide él: ver el informe del 28/11)
export const CFG0 = Object.freeze({ dias_entera: 30, dias_previa: 90, dias_evento: 30, foro: false, mejor_libre: true });
export const MAX_CUERPO = 120000;
export const MAX_BATALLAS = 60;
export const MAX_PARTES = 12;
export const MAX_IDS = 8;

const SNOW = /^\d{15,22}$/;
const EV = /^[A-Za-z0-9._-]{1,100}$/;
//: sólo lo de `grab/`: un sello nunca puede abrir una carta, una foto ni nada más del bucket
export const CLAVE_R2 = /^grab\/[A-Za-z0-9._-]{1,140}\/[A-Za-z0-9._-]{1,80}\.(m4a|ogg|json)$/;
const TIPOS = { m4a: 'audio/mp4', ogg: 'audio/ogg', json: 'application/json; charset=utf-8' };
const CDN = /^https:\/\/cdn\.discordapp\.com\/attachments\/\d{15,22}\/\d{15,22}\/grabacion-[\w-]{1,80}\.ogg(\?[\w=&%.-]{0,400})?$/;
const UA = 'DiscordBot (https://underlegends.pages.dev, 1)';
const DIA = 86400000;

const json = (x, st = 200, cache = 'no-store') => new Response(JSON.stringify(x), { status: st, headers: {
  'content-type': 'application/json; charset=utf-8', 'cache-control': cache } });

// ── QUIÉN OYE QUÉ ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** 💎 ¿Es Premium ahora? `roles`: los de Discord si se saben (una interacción); `rango`: `[desde, hasta]` de `pase_premium`. */
export function premiumDe({ quien = '', roles = null, rango = null, ahora = Date.now() } = {}) {
  if (!quien) return false;
  if (Array.isArray(roles) && roles.some((r) => ROLES_PREMIUM.includes(String(r)))) return true;
  return !!(Array.isArray(rango) && ahora >= Number(rango[0] || 0) && (rango[1] == null || ahora < Number(rango[1])));
}

/**
 * La regla. `tipo`: 'previa' | 'entera' | 'evento' | 'mejor'. `b`: la batalla (`{ids, previa, entera, retirada}`), `ev`: el
 * evento (`{hasta_e, hasta_p, sin_partes, partes}`). Devuelve `{ok: true, por}` o `{ok: false, no}`, con `no` en
 * 'no_existe' · 'retirada' · 'vencido' · 'entrar' (sin sesión) · 'premium' (con sesión, sin Premium).
 */
export function acceso({ tipo, quien = '', premium = false, b = null, ev = null, ahora = Date.now(), cfg = CFG0 } = {}) {
  if (!ev) return { ok: false, no: 'no_existe' };
  const sinCuenta = { ok: false, no: quien ? 'premium' : 'entrar' };
  if (tipo === 'previa' || tipo === 'mejor') {
    if (tipo === 'previa' && (!b || b.retirada)) return { ok: false, no: b ? 'retirada' : 'no_existe' };
    if (tipo === 'previa' ? !b.previa : !ev.mejor) return { ok: false, no: 'no_existe' };
    if (ahora >= ev.hasta_p) return { ok: false, no: 'vencido' };
    if (tipo === 'mejor' && cfg.mejor_libre === false && !premium) return sinCuenta;
    return { ok: true, por: premium ? 'premium' : 'libre' };
  }
  if (tipo === 'entera') {
    if (!b) return { ok: false, no: 'no_existe' };
    if (b.retirada) return { ok: false, no: 'retirada' };
    if (!b.entera) return { ok: false, no: 'no_existe' };
    if (ahora >= ev.hasta_e) return { ok: false, no: 'vencido' };
    if (quien && (b.ids || []).includes(String(quien))) return { ok: true, por: 'tuya' };
    return premium ? { ok: true, por: 'premium' } : sinCuenta;
  }
  if (tipo === 'evento') {
    if (!ev.partes || ev.sin_partes) return { ok: false, no: ev.sin_partes ? 'retirada' : 'no_existe' };
    if (ahora >= ev.hasta_v) return { ok: false, no: 'vencido' };
    return premium ? { ok: true, por: 'premium' } : sinCuenta;
  }
  return { ok: false, no: 'no_existe' };
}

// ── RANGE ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** El encabezado Range: `null` (no vino), `'mal'` (se ignora y va entero) o `{offset, length?}` / `{suffix}`. Un solo tramo. */
export function rango(h) {
  if (h == null || h === '') return null;
  const m = /^bytes=(\d{0,15})-(\d{0,15})$/.exec(String(h).trim());
  if (!m || (m[1] === '' && m[2] === '')) return 'mal';
  if (m[1] === '') { const n = Number(m[2]); return n > 0 ? { suffix: n } : 'mal'; }
  const a = Number(m[1]);
  if (m[2] === '') return { offset: a };
  const z = Number(m[2]);
  return z < a ? 'mal' : { offset: a, length: z - a + 1 };
}

/** `[desde, hasta]` (inclusive) de un rango sobre `size` bytes; `null` si no se puede servir (416). Sin rango: entero. */
export function tramo(r, size) {
  if (!(size > 0)) return null;
  if (!r || r === 'mal') return [0, size - 1];
  if (r.suffix != null) return [Math.max(0, size - r.suffix), size - 1];
  if (r.offset >= size) return null;
  return [r.offset, r.length != null ? Math.min(size - 1, r.offset + r.length - 1) : size - 1];
}

// ── EL SELLO ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const enc = new TextEncoder();
const llaves = new Map();
async function llaveDe(secreto) {
  let k = llaves.get(secreto);
  if (!k) {
    const d = await crypto.subtle.digest('SHA-256', enc.encode('lg-grab:' + secreto));
    k = await crypto.subtle.importKey('raw', d, 'AES-GCM', false, ['encrypt', 'decrypt']);
    if (llaves.size > 4) llaves.clear();
    llaves.set(secreto, k);
  }
  return k;
}
const b64u = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

/** Un sello para `x` (`{b, k, s, ct}` de R2 o `{u, s, ct}` de Discord), que vence en `min` minutos. */
export async function sellar(x, secreto, ahora = Date.now(), min = SELLO_MIN) {
  if (!secreto) throw new Error('sin secreto');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await llaveDe(secreto),
    enc.encode(JSON.stringify(Object.assign({}, x, { x: ahora + min * 60000 })))));
  const t = new Uint8Array(12 + c.length);
  t.set(iv);
  t.set(c, 12);
  return b64u(t);
}

/** Lo que dice un sello, o `null` si no es nuestro, lo tocaron o venció. */
export async function abrir(t, secreto, ahora = Date.now()) {
  if (!secreto || !/^[A-Za-z0-9_-]{40,1400}$/.test(String(t || ''))) return null;
  try {
    const b = deB64u(String(t));
    const p = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12) }, await llaveDe(secreto), b.slice(12));
    const x = JSON.parse(new TextDecoder().decode(p));
    return x && typeof x === 'object' && Number(x.x) > ahora ? x : null;
  } catch (e) {
    return null;
  }
}

// ── LO QUE MANDA EL MOTOR ─────────────────────────────────────────────────────────────────────────────────────────────
const txt = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001F\u007F​-‏‪-‮⁦-⁩]/g, '')
  .replace(/\s+/g, ' ').trim().slice(0, n);
function archivo(a) {
  if (!a || typeof a !== 'object' || !CLAVE_R2.test(String(a.k || ''))) return null;
  const s = Math.floor(Number(a.s));
  if (!(s > 0 && s < 300e6)) return null;
  const d = Number(a.dur);
  return Object.assign({ k: String(a.k), s }, Number.isFinite(d) && d > 0 ? { dur: Math.round(d) } : {});
}

/**
 * 🧹 El registro de un evento, como se guarda: `{ev, ll, sv, g, nombre, dia, ini, bk, partes, mejor, batallas}` o
 * `{error}`. Lo que no vale se cae (una batalla sin archivos, un ID que no es un ID); lo que sobra no se copia.
 */
export function limpiarRegistro(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return { error: 'datos' };
  const ev = String(d.ev || '');
  if (!EV.test(ev)) return { error: 'ev' };
  const ll = String(d.ll == null ? '' : d.ll);
  if (!/^\d{1,9}$/.test(ll)) return { error: 'll' };
  const bk = d.bk === 'g' ? 'g' : 'c';
  let partes = null;
  const P = d.partes;
  if (P && typeof P === 'object' && SNOW.test(String(P.c || '')) && Array.isArray(P.m)) {
    const m = [...new Set(P.m.map(String).filter((x) => SNOW.test(x)))].slice(0, MAX_PARTES);
    if (m.length) partes = { c: String(P.c), m, dur: Math.max(0, Math.round(Number(P.dur) || 0)) };
  }
  const batallas = [];
  const vistas = new Set();
  for (const b of (Array.isArray(d.batallas) ? d.batallas : []).slice(0, MAX_BATALLAS)) {
    if (!b || typeof b !== 'object') continue;
    const k = Math.floor(Number(b.k));
    if (!(k >= 1 && k <= 999) || vistas.has(k)) continue;
    const entera = archivo(b.entera), previa = archivo(b.previa);
    if (!entera && !previa) continue;
    vistas.add(k);
    const ids = [...new Set((Array.isArray(b.ids) ? b.ids : []).map(String).filter((x) => SNOW.test(x)))].slice(0, MAX_IDS);
    const desde = Number(b.desde);
    batallas.push({ k, r: txt(b.r, 40), nombres: (Array.isArray(b.nombres) ? b.nombres : []).slice(0, 6).map((x) => txt(x, 60)).filter(Boolean),
      ids, dur: Math.max(0, Math.round(Number(b.dur) || 0)), desde: Number.isFinite(desde) && desde >= 0 ? Math.round(desde * 10) / 10 : null,
      entera, previa, det: archivo(b.det), detp: archivo(b.detp) });
  }
  if (!batallas.length && !partes) return { error: 'vacio' };
  const ini = Number(d.ini);
  return { ev, ll, bk, sv: txt(d.sv, 12).toUpperCase(), g: SNOW.test(String(d.g || '')) ? String(d.g) : '',
    nombre: txt(d.nombre, 90), dia: /^\d{4}-\d{2}-\d{2}$/.test(String(d.dia || '')) ? String(d.dia) : '',
    ini: Number.isFinite(ini) && ini > 1.7e12 && ini < 4e12 ? Math.round(ini) : 0,
    // ✨ lo mejor de la noche y sus partes (`mejor_det`: de qué batalla sale cada pedazo, para «Entera ›»)
    partes, mejor: archivo(d.mejor) ? Object.assign(archivo(d.mejor), archivo(d.mejor_det) ? { det: archivo(d.mejor_det) } : {}) : null,
    batallas: batallas.sort((a, b) => a.k - b.k) };
}

/** La configuración: lo de entrada con lo que Dlx cambió encima (`grabados_cfg`, ver `rutaObjeto()`). */
export function cfgDe(o) {
  let c = null;
  try { c = o.leer ? o.leer('grabados_cfg') : null; } catch (e) { c = null; }
  return Object.assign({}, CFG0, c && typeof c === 'object' ? c : {});
}
export function cfgValida(d) {
  if (!d || typeof d !== 'object') return null;
  const out = {};
  for (const k of ['dias_entera', 'dias_previa', 'dias_evento']) {
    if (d[k] == null) continue;
    const n = Math.floor(Number(d[k]));
    if (!(n >= 1 && n <= 365)) return null;
    out[k] = n;
  }
  for (const k of ['foro', 'mejor_libre']) if (d[k] != null) { if (typeof d[k] !== 'boolean') return null; out[k] = d[k]; }
  if ((out.dias_previa || 0) && (out.dias_entera || 0) && out.dias_previa < out.dias_entera) return null;
  return Object.keys(out).length ? out : null;
}

// ── EL OBJETO ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export function grabadosTablas(sql) {
  // un evento grabado: dónde está todo y hasta cuándo. `partes` y `mejor`, JSON. ⚠️ Ni un nombre de quien no rapeó
  sql.exec("CREATE TABLE IF NOT EXISTS grab_ev (ev TEXT PRIMARY KEY, ll TEXT NOT NULL, sv TEXT NOT NULL DEFAULT '', g TEXT NOT NULL DEFAULT '', " +
    "nombre TEXT NOT NULL DEFAULT '', dia TEXT NOT NULL DEFAULT '', ini INTEGER NOT NULL DEFAULT 0, bk TEXT NOT NULL DEFAULT 'c', " +
    "partes TEXT NOT NULL DEFAULT '', mejor TEXT NOT NULL DEFAULT '', t INTEGER NOT NULL, hasta_e INTEGER NOT NULL, hasta_p INTEGER NOT NULL, " +
    "hasta_v INTEGER NOT NULL, sin_partes INTEGER NOT NULL DEFAULT 0, foro TEXT NOT NULL DEFAULT '') WITHOUT ROWID");
  sql.exec('CREATE INDEX IF NOT EXISTS grab_ev_ll ON grab_ev (ll)');
  // cada batalla: quién rapeó (`ids`, «,id,id,» para buscar con LIKE al olvidar) y sus cuatro archivos (JSON `{k, s}`)
  sql.exec("CREATE TABLE IF NOT EXISTS grab_b (ev TEXT NOT NULL, k INTEGER NOT NULL, r TEXT NOT NULL DEFAULT '', nombres TEXT NOT NULL DEFAULT '[]', " +
    "ids TEXT NOT NULL DEFAULT ',', dur INTEGER NOT NULL DEFAULT 0, desde REAL, entera TEXT NOT NULL DEFAULT '', previa TEXT NOT NULL DEFAULT '', " +
    "det TEXT NOT NULL DEFAULT '', detp TEXT NOT NULL DEFAULT '', retirada INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (ev, k)) WITHOUT ROWID");
  // los links firmados de los adjuntos de Logs, hasta que Discord los vence (`ex=`): un pedido a Discord por parte y por día
  sql.exec('CREATE TABLE IF NOT EXISTS grab_url (m TEXT PRIMARY KEY, v TEXT NOT NULL, vence INTEGER NOT NULL) WITHOUT ROWID');
  // 📚 LA HISTORIA DE LO GRABADO, PARA EL FORO (28/11/2026): una fila por evento que NO se poda con los audios —el foro lista
  // todos los meses, y el video de YouTube queda aunque el audio de R2 venza—. Sin nada de nadie: evento, servidor, día,
  // cuántas batallas y el id del video (`yt`, lo manda el motor después de subirlo: `youtube()`)
  sql.exec("CREATE TABLE IF NOT EXISTS grab_hist (ev TEXT PRIMARY KEY, ll TEXT NOT NULL, sv TEXT NOT NULL DEFAULT '', nombre TEXT NOT NULL DEFAULT '', " +
    "dia TEXT NOT NULL DEFAULT '', ini INTEGER NOT NULL DEFAULT 0, n INTEGER NOT NULL DEFAULT 0, yt TEXT NOT NULL DEFAULT '', t INTEGER NOT NULL) WITHOUT ROWID");
  // 🔴 un post del foro por servidor: el hilo, los mensajes en que se partió (el primero tiene el id del hilo) y la huella de
  // lo publicado, para editar sólo lo que cambió. Lo escribe bot/grabados_foro.py por `/grabados/foro-guardar`
  sql.exec("CREATE TABLE IF NOT EXISTS grab_foro (sv TEXT PRIMARY KEY, hilo TEXT NOT NULL DEFAULT '', mensajes TEXT NOT NULL DEFAULT '[]', " +
    "huella TEXT NOT NULL DEFAULT '', t INTEGER NOT NULL) WITHOUT ROWID");
}

const jp = (s, d) => { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } };
const filaEv = (f) => f && Object.assign({}, f, { partes: jp(f.partes, null), mejor: jp(f.mejor, null), sin_partes: !!f.sin_partes });
const filaB = (f) => Object.assign({}, f, { nombres: jp(f.nombres, []), ids: String(f.ids || '').split(',').filter(Boolean),
  entera: jp(f.entera, null), previa: jp(f.previa, null), det: jp(f.det, null), detp: jp(f.detp, null), retirada: !!f.retirada });
const bucketDe = (env, bk) => (bk === 'g' ? env.GRABADOS : env.CARTAS) || null;

/** 📥 Guarda (o reemplaza) un evento. Conserva el post del foro si ya había. Devuelve `{ok, ev, batallas}` o `{error}`. */
export function registrar(o, d, ahora = Date.now()) {
  const R = limpiarRegistro(d);
  if (R.error) return R;
  const c = cfgDe(o);
  const antes = o.sql.exec('SELECT foro FROM grab_ev WHERE ev = ?', R.ev).toArray()[0];
  o.sql.exec('DELETE FROM grab_b WHERE ev = ?', R.ev);
  o.sql.exec('INSERT OR REPLACE INTO grab_ev (ev, ll, sv, g, nombre, dia, ini, bk, partes, mejor, t, hasta_e, hasta_p, hasta_v, sin_partes, foro) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)', R.ev, R.ll, R.sv, R.g, R.nombre, R.dia, R.ini, R.bk,
  R.partes ? JSON.stringify(R.partes) : '', R.mejor ? JSON.stringify(R.mejor) : '', ahora,
  ahora + c.dias_entera * DIA, ahora + Math.max(c.dias_previa, c.dias_entera) * DIA, ahora + c.dias_evento * DIA, (antes && antes.foro) || '');
  const J = (x) => (x ? JSON.stringify(x) : '');
  for (const b of R.batallas) {
    o.sql.exec('INSERT INTO grab_b (ev, k, r, nombres, ids, dur, desde, entera, previa, det, detp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      R.ev, b.k, b.r, JSON.stringify(b.nombres), ',' + b.ids.join(',') + (b.ids.length ? ',' : ''), b.dur, b.desde,
      J(b.entera), J(b.previa), J(b.det), J(b.detp));
  }
  o.sql.exec('INSERT INTO grab_hist (ev, ll, sv, nombre, dia, ini, n, t) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(ev) DO UPDATE SET ' +
    'll = excluded.ll, sv = excluded.sv, nombre = excluded.nombre, dia = excluded.dia, ini = excluded.ini, n = excluded.n, t = excluded.t',
  R.ev, R.ll, R.sv, R.nombre, R.dia, R.ini, R.batallas.length, ahora);
  return { ok: true, ev: R.ev, ll: R.ll, batallas: R.batallas.length, partes: R.partes ? R.partes.m.length : 0 };
}

export const YT = /^[A-Za-z0-9_-]{11}$/;
/** 📺 El video de YouTube del evento entero (`{ev | ll, yt}`, del motor después de subirlo o del pase a «no listado»). */
export function youtube(o, d) {
  const yt = String((d && d.yt) || '');
  if (!YT.test(yt)) return { error: 'yt' };
  const ev = String((d && d.ev) || ''), ll = String((d && d.ll) || '');
  if (EV.test(ev)) return { ok: true, n: o.sql.exec('UPDATE grab_hist SET yt = ? WHERE ev = ?', yt, ev).rowsWritten || 0 };
  if (/^\d{1,9}$/.test(ll)) return { ok: true, n: o.sql.exec('UPDATE grab_hist SET yt = ? WHERE ll = ?', yt, ll).rowsWritten || 0 };
  return { error: 'ev' };
}

/** 📚 Lo que necesita bot/grabados_foro.py: la config, todos los eventos grabados y los posts ya publicados. */
export function historia(o) {
  return { ok: true, cfg: cfgDe(o),
    eventos: o.sql.exec('SELECT ev, ll, sv, nombre, dia, ini, n, yt FROM grab_hist ORDER BY dia DESC, ini DESC').toArray(),
    posts: o.sql.exec('SELECT sv, hilo, mensajes, huella FROM grab_foro').toArray().map((f) => Object.assign({}, f, { mensajes: jp(f.mensajes, []) })) };
}

/** 🔴 Guarda el estado de un post del foro (`{sv, hilo, mensajes, huella}`). `sv` es la sigla, o `_guia` (el fijado). */
export function foroGuardar(o, d, ahora = Date.now()) {
  const sv = String((d && d.sv) || '');
  if (!/^(_guia|[A-Z0-9]{1,12})$/.test(sv) || !SNOW.test(String(d.hilo || ''))) return { error: 'datos' };
  const ms = (Array.isArray(d.mensajes) ? d.mensajes : []).map(String).filter((x) => SNOW.test(x)).slice(0, 20);
  o.sql.exec('INSERT OR REPLACE INTO grab_foro (sv, hilo, mensajes, huella, t) VALUES (?, ?, ?, ?, ?)', sv, String(d.hilo), JSON.stringify(ms),
    String(d.huella || '').slice(0, 80), ahora);
  return { ok: true };
}

/** 💎 Premium de `quien` según el objeto: la tabla `pase_premium` en la temporada del Pase (el dueño, siempre). */
export function premiumObjeto(o, quien, ahora = Date.now(), roles = null) {
  if (!SNOW.test(String(quien || ''))) return false;
  let rango = null;
  try {
    const P = o.paseDatos ? o.paseDatos() : null;
    const temp = P && P.cfg && P.cfg.temp ? String(P.cfg.temp) : '';
    rango = o.pasePremium ? o.pasePremium(String(quien), temp) : null;
  } catch (e) { rango = null; }
  return premiumDe({ quien: String(quien), roles, rango, ahora });
}

/** El vencimiento de un link firmado de Discord (`ex=<hex segundos>`), con margen; sin `ex`, 12 h. */
export function venceLink(u, ahora = Date.now()) {
  const m = /[?&]ex=([0-9a-f]{6,12})(?:&|$)/i.exec(String(u || ''));
  const t = m ? parseInt(m[1], 16) * 1000 : ahora + 12 * 3600000;
  return t - 15 * 60000;
}

/** Los adjuntos `grabacion-*.ogg` de los mensajes de Logs, con su link fresco (guardado hasta que Discord lo vence). */
export async function partesDe(o, P, ahora = Date.now(), pedir = fetch) {
  const out = [];
  if (!P || !Array.isArray(P.m) || !o.env || !o.env.DISCORD_TOKEN) return out;
  for (const m of P.m.slice(0, MAX_PARTES)) {
    const f = o.sql.exec('SELECT v, vence FROM grab_url WHERE m = ?', String(m)).toArray()[0];
    let v = f && f.vence > ahora + SELLO_MIN * 60000 ? jp(f.v, null) : null;
    if (!v) {
      try {
        const r = await pedir('https://discord.com/api/v10/channels/' + P.c + '/messages/' + m,
          { headers: { Authorization: 'Bot ' + o.env.DISCORD_TOKEN, 'User-Agent': UA } });
        if (!r.ok) continue;
        const j = await r.json();
        v = (j.attachments || []).filter((a) => CDN.test(String(a.url || '')))
          .map((a) => ({ u: String(a.url), n: String(a.filename || ''), s: Number(a.size) || 0 }));
        const vence = v.reduce((t, a) => Math.min(t, venceLink(a.u, ahora)), ahora + 12 * 3600000);
        o.sql.exec('INSERT OR REPLACE INTO grab_url (m, v, vence) VALUES (?, ?, ?)', String(m), JSON.stringify(v), vence);
      } catch (e) { continue; }
    }
    for (const a of v || []) out.push(a);
  }
  return out;
}

/**
 * 📋 Lo que ve quien mira la llave `ll`: el evento más nuevo grabado de esa llave y, por batalla, lo que puede oír, con
 * la CLAVE adentro (el Worker la sella antes de contestar: ver `ruta()`). Sin grabación: `{ok, hay: false}`.
 */
export async function lista(o, d, ahora = Date.now(), pedir = fetch) {
  const ll = String((d && d.ll) || '');
  if (!/^\d{1,9}$/.test(ll)) return { error: 'datos' };
  const quien = SNOW.test(String((d && d.quien) || '')) ? String(d.quien) : '';
  const fs = o.sql.exec('SELECT * FROM grab_ev WHERE ll = ? AND hasta_p > ? ORDER BY t DESC LIMIT 1', ll, ahora).toArray();
  if (!fs.length) return { ok: true, hay: false, yo: quien ? 'libre' : 'anon' };
  const E = filaEv(fs[0]);
  const cfg = cfgDe(o);
  const premium = premiumObjeto(o, quien, ahora, Array.isArray(d.roles) ? d.roles : null);
  const yo = !quien ? 'anon' : premium ? 'premium' : 'libre';
  const bs = o.sql.exec('SELECT * FROM grab_b WHERE ev = ? ORDER BY k', E.ev).toArray().map(filaB);
  const batallas = [];
  for (const b of bs) {
    const x = { k: b.k, r: b.r, nombres: b.nombres, dur: b.dur, tuya: !!quien && b.ids.includes(quien) };
    const en = acceso({ tipo: 'entera', quien, premium, b, ev: E, ahora, cfg });
    const pr = acceso({ tipo: 'previa', quien, premium, b, ev: E, ahora, cfg });
    if (en.ok) Object.assign(x, { nivel: 'entera', por: en.por, a: b.entera, d: b.det });
    else if (pr.ok) Object.assign(x, { nivel: 'previa', por: 'libre', no: en.no, a: b.previa, d: b.detp, durp: (b.previa && b.previa.dur) || PREVIA_S });
    else Object.assign(x, { nivel: 'cerrada', no: b.retirada ? 'retirada' : en.no });
    batallas.push(x);
  }
  const ac = acceso({ tipo: 'evento', quien, premium, ev: E, ahora, cfg });
  const partes = ac.ok ? await partesDe(o, E.partes, ahora, pedir) : [];
  const mj = acceso({ tipo: 'mejor', quien, premium, ev: E, ahora, cfg });
  return { ok: true, hay: true, yo, bk: E.bk,
    ev: { ev: E.ev, ll: E.ll, nombre: E.nombre, dia: E.dia, sv: E.sv, hasta_e: E.hasta_e, hasta_p: E.hasta_p },
    batallas, evento: E.partes && !E.sin_partes ? { n: E.partes.m.length, dur: E.partes.dur, ok: ac.ok, no: ac.no || '' } : null,
    partes, mejor: mj.ok ? E.mejor : null };
}

/** 🗑️ Borra de R2 (sin esperar a nadie: si falla, queda huérfano y lo levanta `podar()` del motor). */
async function borrarR2(o, bk, ks) {
  const B = bucketDe(o.env || {}, bk);
  const ls = ks.filter((k) => CLAVE_R2.test(String(k || '')));
  if (!B || !ls.length) return 0;
  try { await B.delete(ls); return ls.length; } catch (e) { return 0; }
}
const clavesDe = (b, que = ['entera', 'previa', 'det', 'detp']) => que.map((q) => b[q] && b[q].k).filter(Boolean);

/** ⏳ Lo vencido, fuera: lo entero a los `dias_entera`, el adelanto y el evento a los `dias_previa`. */
export async function podar(o, ahora = Date.now()) {
  let n = 0;
  for (const f of o.sql.exec('SELECT * FROM grab_ev WHERE hasta_e <= ?', ahora).toArray()) {
    const E = filaEv(f);
    const bs = o.sql.exec("SELECT * FROM grab_b WHERE ev = ? AND (entera != '' OR det != '')", E.ev).toArray().map(filaB);
    n += await borrarR2(o, E.bk, bs.flatMap((b) => clavesDe(b, ['entera', 'det'])));
    o.sql.exec("UPDATE grab_b SET entera = '', det = '' WHERE ev = ?", E.ev);
    if (f.hasta_p <= ahora) {
      const ps = o.sql.exec('SELECT * FROM grab_b WHERE ev = ?', E.ev).toArray().map(filaB);
      n += await borrarR2(o, E.bk, ps.flatMap((b) => clavesDe(b, ['previa', 'detp'])).concat(E.mejor ? [E.mejor.k, E.mejor.det && E.mejor.det.k] : []));
      o.sql.exec('DELETE FROM grab_b WHERE ev = ?', E.ev);
      o.sql.exec('DELETE FROM grab_ev WHERE ev = ?', E.ev);
    }
  }
  o.sql.exec('DELETE FROM grab_url WHERE vence <= ?', ahora);
  return n;
}

/** 🙈 «Olvidarme»: su ID sale del índice, sus batallas se retiran y se borran de R2, y de ese evento no se sirve la
 *  grabación completa. Devuelve cuántas batallas retiró. */
export async function olvidar(o, quien) {
  const q = String(quien || '');
  if (!SNOW.test(q)) return 0;
  const fs = o.sql.exec('SELECT x.*, e.bk AS bk FROM grab_b x JOIN grab_ev e ON e.ev = x.ev WHERE x.ids LIKE ?', '%,' + q + ',%').toArray();
  for (const f of fs) {
    const b = filaB(f);
    await borrarR2(o, f.bk, clavesDe(b));
    o.sql.exec("UPDATE grab_b SET ids = REPLACE(ids, ?, ','), retirada = 1, entera = '', previa = '', det = '', detp = '' WHERE ev = ? AND k = ?",
      ',' + q + ',', b.ev, b.k);
    o.sql.exec('UPDATE grab_ev SET sin_partes = 1 WHERE ev = ?', b.ev);
  }
  return fs.length;
}

/** 🔀 La cuenta que se muda: «su batalla» la sigue. */
export function mudar(o, viejo, nuevo) {
  const v = String(viejo || ''), n = String(nuevo || '');
  if (!SNOW.test(v) || !SNOW.test(n) || v === n) return 0;
  return o.sql.exec('UPDATE grab_b SET ids = REPLACE(ids, ?, ?) WHERE ids LIKE ?', ',' + v + ',', ',' + n + ',', '%,' + v + ',%').rowsWritten || 0;
}

/** Las rutas del objeto (sólo desde el Worker): `/grabados-lista`, `-registrar`, `-config`, `-podar`, `-youtube`,
 *  `-foro-datos` y `-foro-guardar`. */
export async function rutaObjeto(o, req, ruta) {
  const d = await req.json().catch(() => null);
  const ahora = Date.now();
  if (ruta === '/grabados-lista') { const r = await lista(o, d || {}, ahora); return json(r, r.error ? 400 : 200); }
  if (ruta === '/grabados-registrar') {
    const r = registrar(o, d, ahora);
    if (r.error) return json(r, 400);
    r.podados = await podar(o, ahora);
    return json(r);
  }
  if (ruta === '/grabados-config') {
    if (d && Object.keys(d).length) {
      const c = cfgValida(d);
      if (!c) return json({ error: 'datos' }, 400);
      o.guardar('grabados_cfg', Object.assign({}, cfgDe(o), c));
    }
    return json({ ok: true, cfg: cfgDe(o) });
  }
  if (ruta === '/grabados-youtube') { const r = youtube(o, d); return json(r, r.error ? 400 : 200); }
  if (ruta === '/grabados-foro-datos') return json(historia(o));
  if (ruta === '/grabados-foro-guardar') { const r = foroGuardar(o, d, ahora); return json(r, r.error ? 400 : 200); }
  if (ruta === '/grabados-podar') return json({ ok: true, borrados: await podar(o, ahora) });
  return json({ error: 'ruta' }, 404);
}

// ── EL WORKER ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const alObjeto = (env, ruta, cuerpo) => env.AVISOS.get(env.AVISOS.idFromName('liga')).fetch('https://avisos/' + ruta,
  { method: 'POST', body: JSON.stringify(cuerpo || {}), headers: { 'content-type': 'application/json' } });
//: dónde se sirve el audio, visto desde la página (bot/paginas/_worker.js reenvía `/api/grabados/a/*` acá)
export const RUTA_AUDIO = '/api/grabados/a/';

/** Cambia cada `{k, s}` (o `{u, s}`) de la lista por su link sellado. Lo de adentro nunca sale. */
export async function sellarLista(L, secreto, ahora = Date.now()) {
  const sello = async (a, bk) => {
    if (!a) return '';
    const ext = a.k ? a.k.split('.').pop() : 'ogg';
    const x = a.k ? { b: bk, k: a.k, s: a.s, ct: TIPOS[ext] || 'audio/mp4' } : { u: a.u, s: a.s, ct: 'audio/ogg' };
    return RUTA_AUDIO + await sellar(x, secreto, ahora);
  };
  const out = Object.assign({}, L);
  delete out.bk;
  out.batallas = await Promise.all((L.batallas || []).map(async (b) => {
    const y = Object.assign({}, b);
    y.url = await sello(b.a, L.bk);
    y.det = await sello(b.d, L.bk);
    delete y.a; delete y.d;
    return y;
  }));
  out.partes = await Promise.all((L.partes || []).map(async (p, i) => ({ n: i + 1, mb: Math.round((p.s || 0) / 1e5) / 10, url: await sello(p) })));
  out.mejor = L.mejor ? { url: await sello(L.mejor, L.bk), det: await sello(L.mejor.det, L.bk), dur: L.mejor.dur || 0 } : null;
  return out;
}

/**
 * 🛠️ El link sellado de un adjunto `grabacion-*.ogg` de Logs, para «Escuchar la grabación completa (staff)» de la llave
 * (`socioLlave()` en bot/avisos.js). Hasta el 28/11/2026 la página recibía el link de cdn.discordapp.com y el `<audio>` no
 * sonaba: `media-src` de la página sólo deja lo de su origen. Pasa por el mismo camino que el Premium. `''` si no es uno.
 */
export async function linkAdjunto(u, size, secreto, ahora = Date.now()) {
  if (!secreto || !CDN.test(String(u || ''))) return '';
  return RUTA_AUDIO + await sellar({ u: String(u), s: Number(size) || 0, ct: 'audio/ogg' }, secreto, ahora);
}

const SEGURO = { 'x-content-type-options': 'nosniff', 'content-disposition': 'inline', 'cross-origin-resource-policy': 'same-site' };

/** 🔊 Sirve un sello: el pedazo pedido de R2 (Range) o del adjunto de Discord. Nunca decodifica nada. */
export async function servir(req, env, sello, ahora = Date.now(), pedir = fetch) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('', { status: 405 });
  const x = await abrir(sello, env.DISCORD_TOKEN, ahora);
  if (!x) return new Response('vencido', { status: 410, headers: { 'cache-control': 'no-store' } });
  const r = rango(req.headers.get('range'));
  const cab = Object.assign({ 'content-type': x.ct || 'audio/mp4', 'accept-ranges': 'bytes', 'cache-control': 'private, max-age=600' }, SEGURO);
  if (x.u) {
    if (!CDN.test(String(x.u))) return new Response('', { status: 400 });
    const hs = { 'User-Agent': UA };
    if (r && r !== 'mal') hs.range = req.headers.get('range');
    const z = await pedir(x.u, { method: req.method, headers: hs });
    if (z.status === 416) return new Response('', { status: 416, headers: cab });
    if (!z.ok) return new Response('', { status: 502, headers: { 'cache-control': 'no-store' } });
    for (const k of ['content-length', 'content-range']) { const v = z.headers.get(k); if (v) cab[k] = v; }
    return new Response(req.method === 'HEAD' ? null : z.body, { status: z.status === 206 ? 206 : 200, headers: cab });
  }
  const B = bucketDe(env, x.b);
  if (!B || !CLAVE_R2.test(String(x.k || ''))) return new Response('', { status: 404 });
  const t = tramo(r, Number(x.s) || 0);
  if (!t) return new Response('', { status: 416, headers: Object.assign(cab, { 'content-range': 'bytes */' + (Number(x.s) || 0) }) });
  const parcial = !!(r && r !== 'mal');
  if (req.method === 'HEAD') {
    const h = await B.head(x.k);
    if (!h) return new Response('', { status: 404 });
    cab['content-length'] = String(parcial ? t[1] - t[0] + 1 : h.size);
    if (parcial) cab['content-range'] = 'bytes ' + t[0] + '-' + t[1] + '/' + h.size;
    return new Response(null, { status: parcial ? 206 : 200, headers: cab });
  }
  // el rango se le pide a R2 tal cual vino (el sufijo también): el tamaño del sello es para el 416, el de verdad lo dice R2
  let obj = null;
  try {
    obj = await B.get(x.k, parcial ? { range: r.suffix != null ? { suffix: r.suffix } : { offset: r.offset, ...(r.length != null ? { length: r.length } : {}) } } : undefined);
  } catch (e) {
    return new Response('', { status: 416, headers: Object.assign(cab, { 'content-range': 'bytes */' + (Number(x.s) || 0) }) });
  }
  if (!obj) return new Response('', { status: 404, headers: { 'cache-control': 'no-store' } });
  const size = Number(obj.size) || Number(x.s);
  const rr = obj.range || null;
  const o0 = rr && rr.offset != null ? rr.offset : rr && rr.suffix != null ? Math.max(0, size - rr.suffix) : t[0];
  const largo = rr && rr.length != null ? rr.length : rr && rr.suffix != null ? Math.min(rr.suffix, size) : (parcial ? t[1] - t[0] + 1 : size);
  cab['content-length'] = String(largo);
  if (parcial) cab['content-range'] = 'bytes ' + o0 + '-' + (o0 + largo - 1) + '/' + size;
  return new Response(obj.body, { status: parcial ? 206 : 200, headers: cab });
}

/**
 * 🌐 `/grabados…` del Worker. `GET /grabados?ll=<n>`: la lista sellada, con la sesión de quien mira (`sesionDe`, de
 * bot/avisos.js: se pasa para no importarlo en círculo). `GET|HEAD /grabados/a/<sello>`: el audio. Y con la clave del ciclo
 * (el motor, el foro o Dlx): `POST /grabados/registrar`, `/grabados/config`, `/grabados/podar`, `/grabados/youtube`,
 * `/grabados/foro-datos` y `/grabados/foro-guardar`.
 */
export async function ruta(req, env, ctx, esCiclo, sesionDe) {
  const u = new URL(req.url);
  const p = u.pathname;
  if (p.startsWith('/grabados/a/')) return servir(req, env, p.slice('/grabados/a/'.length));
  if (!env.AVISOS) return json({ error: 'sin objeto' }, 503);
  if (p === '/grabados') {
    if (req.method !== 'GET') return json({ error: 'método' }, 405);
    if (!env.DISCORD_TOKEN) return json({ error: 'sin token' }, 503);
    const ll = u.searchParams.get('ll') || '';
    if (!/^\d{1,9}$/.test(ll)) return json({ error: 'datos' }, 400);
    const quien = sesionDe ? await sesionDe(env, req) : '';
    let L;
    try { L = await (await alObjeto(env, 'grabados-lista', { ll, quien })).json(); } catch (e) { return json({ error: 'objeto' }, 502); }
    if (!L || L.error) return json(L || { error: 'objeto' }, 400);
    return json(L.hay ? await sellarLista(L, env.DISCORD_TOKEN) : L);
  }
  const acciones = { '/grabados/registrar': 'grabados-registrar', '/grabados/config': 'grabados-config', '/grabados/podar': 'grabados-podar',
    '/grabados/youtube': 'grabados-youtube', '/grabados/foro-datos': 'grabados-foro-datos', '/grabados/foro-guardar': 'grabados-foro-guardar' };
  if (acciones[p]) {
    if (req.method !== 'POST') return json({ error: 'método' }, 405);
    if (!esCiclo) return new Response('', { status: 403 });
    const crudo = await req.text();
    if (crudo.length > MAX_CUERPO) return json({ error: 'demasiado grande' }, 413);
    try {
      const r = await env.AVISOS.get(env.AVISOS.idFromName('liga')).fetch('https://avisos/' + acciones[p],
        { method: 'POST', body: crudo || '{}', headers: { 'content-type': 'application/json' } });
      return new Response(r.body, { status: r.status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
    } catch (e) { return json({ error: 'objeto' }, 502); }
  }
  return json({ error: 'ruta' }, 404);
}
