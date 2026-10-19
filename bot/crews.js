// 👥 LAS CREWS QUE ARMA LA GENTE (Dlx, 19/10/2026: «el sistema de crews, crear crews e invitar gente a ser parte de tu
// crew. En la página principalmente, pero también en el bot», mirando cómo lo hace Nekotina —que NO invita: `!capply` y
// los oficiales aceptan—). Lo que contestó, con un toque:
//   · CREAR: verificado (Miembro de DRA) y pagando 2.500 Puntos de Tienda (el precio, en el Dashboard: `crew_precio`)
//   · 20 POR CREW como máximo
//   · CÓMO SE ENTRA lo elige el líder: abierta, con pedido o sólo por invitación
//   · EL RANKING DE CREWS: el modo lo elige Dlx en el Dashboard (`crews_ranking`: todos, los N mejores o los
//     representantes) y los representantes los elige el líder (o un colíder)
//   · JERARQUÍA: Líder · Colíder · Veterano · Miembro. Colíder: invita, acepta pedidos, saca a Veteranos y Miembros,
//     elige representantes. Veterano: invita. Miembro: nada. Sólo el Líder borra la crew o pasa el liderazgo
//   · LAS 34 CREWS DE HOY siguen con su gente (`sembrar()`, la primera vez): Dlx elige su líder; hasta entonces, el
//     primero de la lista
//   · 7 DÍAS entre salir de una crew y entrar a otra (cada cambio redibuja las cartas de toda la crew)
//   · «que cada crew tenga sus eventos exclusivos, beneficios, etc.»: para después, conversado aparte
// Y el mismo día, un rato después: «haz q las siglas sean obligatorias» y «cuando se cree una crew, tenga un periodo de
// 1 semana para invitar a 2 personas como mínimo. O por lo contrario la crew se eliminará en 1 semana, que esto sea
// notable por el líder»:
//   · LA SIGLA es obligatoria al crear (y al cambiar el nombre). Las 34 de la Liga, que nacieron sin, la ponen la
//     próxima vez que su líder toque el nombre
//   · LA PRIMERA SEMANA: una crew nueva tiene 7 días (`PRUEBA_MS`) para sumar 2 personas además del líder
//     (`PRUEBA_SUMAR`). Cuentan las que ENTRAN, no las invitaciones: invitar a dos que nunca contestan dejaría una crew
//     de uno. Llega a tres y queda para siempre (`vence = 0`); no llega y se borra sola (`crewVencer()`), su gente
//     queda libre sin esperar y los Puntos de crearla no vuelven. Al líder (y a los colíderes) le llega a la campana al
//     crearla, a los 2 días del final, el último día, cuando queda y cuando se borra; y la página se lo muestra
//     arriba de todo. Las 34 de la Liga no la tienen: no las creó nadie
// Y un rato más tarde: «que cuando se cree la crew se necesite un logo *que pase por el auto filtro que tenemos* y una
// descripción»:
//   · EL LOGO pasa por el filtro de los fondos (`filtrarImagen()` de avisos.js, en `crewConImagen()`): limpio se ve ya;
//     con algo que no va, no entra y la crew no se crea; dudoso, la crew se crea y el logo espera en el Dashboard (lo
//     revisan los que revisan los fondos). El líder lo cambia cuando quiera, con el mismo filtro
//   · LA DESCRIPCIÓN: de 10 a 160 caracteres, sin menciones ni links (`descCrew()`)
// Y esa tarde, armando la suya: «que a pesar de que estés en una crew, que puedas configurar en tu cuenta que puedas
// recibir invitaciones a unirte a otras crews estando en una crew… por default dejalo que sí»:
//   · A QUIEN YA ESTÁ EN UNA CREW SE LO PUEDE INVITAR, salvo que haya apagado «recibir invitaciones» (`crew_prefs`; sin
//     fila, sí). Si acepta, SE CAMBIA: sale de la suya y entra a la nueva, en un paso. Cuenta como salir: los 7 días
//     corren desde ahí, así que no se salta de crew en crew. Un Líder primero pasa el liderazgo, como para irse
// Y para la página de crews (*«que requisitos hay… mira como hacen los diferentes juegos para unirse a clubs»*): como
// los trofeos mínimos de un clan, el Líder pide una LETRA MÍNIMA y/o un MÍNIMO DE EVENTOS en la temporada (`req`). Se
// miran al pedir entrar o al unirse a una abierta —con la letra y los eventos que el ciclo deja en `persona`
// (`subir_datos.py`, los mismos de los roles vinculados)—, no al aceptar una invitación: ahí ya eligió el Líder
//
// 🔑 DE QUIÉN ES CADA COSA: un miembro es un PERFIL (`k`, la clave de la página: `oasis`, `volk-co`), no una cuenta de
// Discord. Quien actúa lo dice el Worker —`quien` (su Discord ID) y `de` (su perfil, de `d:<id>`: sólo verificados)—,
// nunca la página. Las 34 de hoy traen gente sin cuenta: entran por su clave, y su `quien` se anota cuando actúan.
// ⚠️ Todo vive en el objeto (SQLite) y NUNCA en KV por acción: KV tiene 1.000 escrituras por día para toda la cuenta.
// El ciclo baja `/avisos/crews` (público, sin IDs de Discord) y arma `datos/crews.json`, que siguen leyendo las cartas,
// la página y los MES AWARDS (`bot/crews_vivas.py`).

export const CREW_MAX = 20;
export const ROLES = ['lider', 'colider', 'veterano', 'miembro'];
export const ROL_NOMBRE = { lider: 'Líder', colider: 'Colíder', veterano: 'Veterano', miembro: 'Miembro' };
export const ENTRADAS = ['abierta', 'pedido', 'invitacion'];
export const PRECIO_CREW = 2500;
export const RANKING_MODOS = ['todos', 'mejores', 'reps'];
export const RANKING_N = 5;
const DIA = 86400000;
export const ESPERA_MS = 7 * DIA;
// una invitación o un pedido vencen a la semana: sin esto, una invitación de hace un mes te mete en una crew que cambió
export const VENCE_MS = 7 * DIA;
// cuántas invitaciones manda una persona por día (los raids de invitaciones de los clanes: el research)
export const INV_DIA = 15;
// cambiar el nombre: una vez cada 30 días, para que una crew no esconda su historia
export const NOMBRE_MS = 30 * DIA;
// la primera semana de una crew nueva: sumar 2 personas además del líder, o se borra (Dlx, 19/10/2026)
export const PRUEBA_MS = 7 * DIA;
export const PRUEBA_SUMAR = 2;
// el logo: la página lo manda de 512×512 en webp; esto es lo más que se acepta
export const LOGO_TOPE = 300 * 1024;
// dónde viven los logos en R2. Con prefijo propio: la carpeta de una carta es el nombre de la persona
export const LOGO_CARPETA = 'logos-crews/';
// el orden de las letras, para comparar «B o más». ⚠️ SÓLO EL ORDEN: los umbrales viven en comun/rangos.py y la letra de
// cada uno la calcula el ciclo (está en `persona`); escribirlos acá sería el sexto lugar donde vive el rango
export const ORDEN_RG = ['E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
export const REQ_EV_MAX = 100;

// ── lo puro: se prueba solo (`bot/crews_prueba.mjs`) ─────────────────────────────────────────────────────────────

/** La forma con que se comparan dos nombres: sin tildes, sin mayúsculas, sólo letras y números de cualquier alfabeto. */
export function normCrew(s) {
  return String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

/** Un nombre de crew válido, limpio, o `null`. 3 a 24 caracteres; letras, números, espacios y `.-_'`; sin markdown,
 *  sin @ (una mención en un mensaje del bot), sin espacios de más. Al menos dos letras o números de verdad. */
export function nombreCrew(s) {
  const t = String(s || '').normalize('NFC').replace(/\s+/g, ' ').trim();
  if (t.length < 3 || t.length > 24) return null;
  if (!/^[\p{L}\p{N} ._'-]+$/u.test(t)) return null;
  if (normCrew(t).length < 2) return null;
  return t;
}

/** La sigla: 2 a 4 letras o números, en mayúsculas; `null` si no vale. Vacía, `''` —o `null` si es `obligatoria`, como
 *  al crear desde el 19/10/2026: sólo las 34 de la Liga pueden seguir sin— */
export function siglaCrew(s, obligatoria = false) {
  if (s === undefined || s === null || String(s).trim() === '') return obligatoria ? null : '';
  const t = String(s).normalize('NFC').trim().toUpperCase();
  return /^[\p{L}\p{N}]{2,4}$/u.test(t) ? t : null;
}

/** La descripción: 10 a 160 caracteres en una línea, sin `<>`, sin menciones (@) y sin links —la descripción de una crew
 *  no es un aviso ni una invitación a otro servidor—. `null` si no vale. */
export function descCrew(s) {
  const t = String(s || '').normalize('NFC').replace(/\s+/g, ' ').trim();
  if (t.length < 10 || t.length > 160) return null;
  if (/[<>@]/.test(t) || /(https?:|www\.|discord\.gg|\.(com|gg|net|org|ly|io)\b)/i.test(t)) return null;
  return t;
}

/**
 * ¿Puede `rol` hacer `que` sobre alguien con rol `sobre`? El reparto de Dlx: el Colíder casi todo, el Veterano invita,
 * el Miembro nada; sólo el Líder borra la crew, pasa el liderazgo, cambia cómo se entra y el nombre.
 */
export function puede(rol, que, sobre = '') {
  if (rol === 'lider') {
    if (que === 'sacar' || que === 'rol') return sobre !== 'lider';
    return ['invitar', 'decidir', 'reps', 'entrada', 'nombre', 'lider', 'borrar'].includes(que);
  }
  if (rol === 'colider') {
    if (que === 'sacar') return sobre === 'veterano' || sobre === 'miembro';
    // sube o baja entre Miembro y Veterano; nadie lo hace Colíder más que el Líder
    if (que === 'rol') return sobre === 'veterano' || sobre === 'miembro';
    return ['invitar', 'decidir', 'reps'].includes(que);
  }
  if (rol === 'veterano') return que === 'invitar';
  return false;
}

// la clave de un perfil: la misma regla que `claveValida()` de avisos.js
const claveOk = (k) => typeof k === 'string' && k.length >= 1 && k.length <= 60 && /^[\p{L}\p{N}][\p{L}\p{N}-]*$/u.test(k);
export const ACCIONES = ['crear', 'responder', 'pedir', 'cancelar_pedido', 'invitar', 'desinvitar', 'decidir', 'salir', 'sacar',
  'rol', 'lider', 'reps', 'entrada', 'nombre', 'borrar', 'logo', 'desc', 'pref_inv', 'req'];

/**
 * La forma de un pedido de la página o del bot, antes de llegar al objeto: sólo los campos de cada acción y con su
 * tipo, o `{error}`. Las reglas (el rol, el lugar, la plata) las mira `crewAccion()`; esto frena lo que no es nada.
 * ⚠️ `quien` y `de` NO se copian: los pone el Worker.
 */
export function validarCrew(d) {
  if (!d || typeof d !== 'object') return { error: 'datos' };
  const accion = String(d.accion || '');
  if (!ACCIONES.includes(accion)) return { error: 'accion' };
  const out = { accion };
  const corto = (x, n) => typeof x === 'string' && x.length > 0 && x.length <= n;
  if (d.crew !== undefined) { if (!corto(d.crew, 40)) return { error: 'crew' }; out.crew = d.crew; }
  if (d.a !== undefined) { if (!claveOk(d.a)) return { error: 'a' }; out.a = d.a; }
  if (d.si !== undefined) { if (typeof d.si !== 'boolean') return { error: 'si' }; out.si = d.si; }
  if (d.rol !== undefined) { if (!ROLES.includes(d.rol)) return { error: 'rol' }; out.rol = d.rol; }
  if (d.entrada !== undefined) { if (!ENTRADAS.includes(d.entrada)) return { error: 'entrada' }; out.entrada = d.entrada; }
  if (d.nombre !== undefined) { if (!corto(d.nombre, 40)) return { error: 'nombre' }; out.nombre = d.nombre; }
  if (d.sigla !== undefined) { if (typeof d.sigla !== 'string' || d.sigla.length > 8) return { error: 'sigla' }; out.sigla = d.sigla; }
  if (d.desc !== undefined) { if (typeof d.desc !== 'string' || d.desc.length > 400) return { error: 'desc' }; out.desc = d.desc; }
  if (d.req !== undefined) { const r = reqValido(d.req); if (!r) return { error: 'req' }; out.req = r; }
  // el logo, en base64; lo mira el objeto (el tipo por los bytes, el tope, los metadatos y el filtro). ⚠️ `logo_url` y
  // `logo_v` NO se copian: los pone el objeto después del filtro
  if (d.img !== undefined) {
    if (typeof d.img !== 'string' || d.img.length > Math.ceil(LOGO_TOPE * 4 / 3) + 8 || !/^[A-Za-z0-9+/=]+$/.test(d.img)) return { error: 'img' };
    out.img = d.img;
  }
  if (d.reps !== undefined) {
    if (!Array.isArray(d.reps) || d.reps.length > CREW_MAX || !d.reps.every(claveOk)) return { error: 'reps' };
    out.reps = d.reps;
  }
  return out;
}

/** Los requisitos de una crew: `{rg, ev}` limpios (`rg` una letra o `''`, `ev` 0 a 100), o `null` si no valen. Pura. */
export function reqValido(r) {
  if (!r || typeof r !== 'object') return null;
  const rg = r.rg ? String(r.rg).toUpperCase() : '';
  const ev = r.ev === undefined || r.ev === null || r.ev === '' ? 0 : Number(r.ev);
  if (rg && !ORDEN_RG.includes(rg)) return null;
  if (!Number.isInteger(ev) || ev < 0 || ev > REQ_EV_MAX) return null;
  return { rg, ev };
}

/** ¿Cumple `p` (`{rg, ev}` de `persona`) los requisitos `req`? Lo que le falta, en palabras, o `[]`. Pura. */
export function faltaReq(req, p) {
  const r = reqValido(req) || { rg: '', ev: 0 };
  const falta = [];
  if (r.rg && ORDEN_RG.indexOf(String((p && p.rg) || '')) < ORDEN_RG.indexOf(r.rg)) falta.push('letra ' + r.rg + ' o más');
  if (r.ev && (Number((p && p.ev) || 0) || 0) < r.ev) falta.push(r.ev + (r.ev === 1 ? ' evento' : ' eventos') + ' en la temporada');
  return falta;
}

/** El ajuste del Dashboard para el ranking: `{modo, n}` válido o `undefined`. */
export function rankingValido(v) {
  if (v === null) return null;
  if (!v || typeof v !== 'object' || !RANKING_MODOS.includes(v.modo)) return undefined;
  const n = v.n === undefined ? RANKING_N : Number(v.n);
  if (!Number.isInteger(n) || n < 1 || n > CREW_MAX) return undefined;
  return { modo: v.modo, n };
}

/** El precio del Dashboard: un entero de 0 a 50.000, o `undefined`. */
export function precioValido(v) {
  if (v === null) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 50000 ? n : undefined;
}

/**
 * Los puntos de una crew según el modo: `pts` es `{clave: puntos}` de su gente. `todos` suma a todos; `mejores`, los
 * `n` que más tienen; `reps`, los representantes que eligió el líder —y si no eligió ninguno, como `mejores`—.
 * ⚠️ Esto mismo vive en Python (`crews_vivas.puntos()`), atado por la prueba de los dos lados.
 */
export function puntosCrew(pts, modo, n, reps) {
  const vals = Object.values(pts || {}).map((x) => Number(x) || 0);
  if (modo === 'todos') return vals.reduce((a, b) => a + b, 0);
  if (modo === 'reps' && Array.isArray(reps) && reps.length) {
    return reps.slice(0, n).reduce((a, k) => a + (Number((pts || {})[k]) || 0), 0);
  }
  return vals.sort((a, b) => b - a).slice(0, n).reduce((a, b) => a + b, 0);
}

// ── el objeto: `o` es el Durable Object (su `sql`, `ajustes()`, `saldo()`, `aBandeja()`, `cuentaCambio()`) ─────────

export function crewTablas(sql) {
  sql.exec('CREATE TABLE IF NOT EXISTS crews (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, norm TEXT NOT NULL, ' +
    "sigla TEXT NOT NULL DEFAULT '', entrada TEXT NOT NULL DEFAULT 'pedido', reps TEXT NOT NULL DEFAULT '[]', " +
    "oficial INTEGER NOT NULL DEFAULT 0, creada INTEGER NOT NULL, por TEXT NOT NULL DEFAULT '', nombre_t INTEGER NOT NULL DEFAULT 0, " +
    't INTEGER NOT NULL)');
  sql.exec('CREATE UNIQUE INDEX IF NOT EXISTS crews_norm ON crews (norm)');
  // la primera semana (19/10/2026): `vence` es cuándo se borra si no suma a su gente (0 = ya quedó, o es de la Liga) y
  // `vence_aviso`, qué recordatorio ya le llegó al líder (1 al crearla, 2 a dos días, 3 el último), para no repetirlo
  // cada hora. `ADD COLUMN` falla si ya está: es la migración de una sola vez
  try { sql.exec('ALTER TABLE crews ADD COLUMN vence INTEGER NOT NULL DEFAULT 0'); } catch (e) { /* ya estaba */ }
  try { sql.exec('ALTER TABLE crews ADD COLUMN vence_aviso INTEGER NOT NULL DEFAULT 0'); } catch (e) { /* ya estaba */ }
  // el logo (el que se ve y el que espera revisión, con cuándo se subió) y la descripción (19/10/2026)
  for (const col of ["logo TEXT NOT NULL DEFAULT ''", "logo_pend TEXT NOT NULL DEFAULT ''", 'logo_t INTEGER NOT NULL DEFAULT 0',
    "descr TEXT NOT NULL DEFAULT ''", 'logo_pend_t INTEGER NOT NULL DEFAULT 0']) {
    try { sql.exec('ALTER TABLE crews ADD COLUMN ' + col); } catch (e) { /* ya estaba */ }
  }
  // 🗑️ los logos de R2 que ya no usa nadie, hasta que algo que puede esperar los borre (`crewBasura()`): borrar una
  // crew es sincrónico —la semana que venció la borra `crewVencer()` en medio de una lectura— y R2 no
  sql.exec('CREATE TABLE IF NOT EXISTS crew_basura (url TEXT PRIMARY KEY, t INTEGER NOT NULL)');
  // 📨 si quien ya está en una crew recibe invitaciones de otras (sin fila: sí, Dlx: «por default dejalo que sí»)
  sql.exec('CREATE TABLE IF NOT EXISTS crew_prefs (k TEXT PRIMARY KEY, inv INTEGER NOT NULL DEFAULT 1)');
  // 🎯 los requisitos para entrar (`{rg, ev}`), los elige el Líder
  try { sql.exec("ALTER TABLE crews ADD COLUMN req TEXT NOT NULL DEFAULT '{}'"); } catch (e) { /* ya estaba */ }
  sql.exec('CREATE TABLE IF NOT EXISTS crew_miembros (k TEXT PRIMARY KEY, crew TEXT NOT NULL, rol TEXT NOT NULL, ' +
    "quien TEXT NOT NULL DEFAULT '', desde INTEGER NOT NULL)");
  sql.exec('CREATE INDEX IF NOT EXISTS crew_miembros_crew ON crew_miembros (crew)');
  sql.exec('CREATE TABLE IF NOT EXISTS crew_inv (crew TEXT NOT NULL, k TEXT NOT NULL, de TEXT NOT NULL, t INTEGER NOT NULL, ' +
    'PRIMARY KEY (crew, k))');
  sql.exec('CREATE TABLE IF NOT EXISTS crew_ped (crew TEXT NOT NULL, k TEXT NOT NULL, quien TEXT NOT NULL, t INTEGER NOT NULL, ' +
    'PRIMARY KEY (crew, k))');
  sql.exec('CREATE TABLE IF NOT EXISTS crew_salidas (k TEXT PRIMARY KEY, t INTEGER NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS crew_log (id INTEGER PRIMARY KEY AUTOINCREMENT, crew TEXT NOT NULL, t INTEGER NOT NULL, ' +
    "que TEXT NOT NULL, k TEXT NOT NULL DEFAULT '', por TEXT NOT NULL DEFAULT '')");
}

const fila = (o, q, ...a) => o.sql.exec(q, ...a).toArray()[0] || null;
const filas = (o, q, ...a) => o.sql.exec(q, ...a).toArray();
const crewDe = (o, id) => fila(o, 'SELECT * FROM crews WHERE id = ?', id);
const miembroDe = (o, k) => fila(o, 'SELECT * FROM crew_miembros WHERE k = ?', k);
const cuantos = (o, id) => fila(o, 'SELECT COUNT(*) AS n FROM crew_miembros WHERE crew = ?', id).n;
const anotar = (o, crew, que, k, por) => o.sql.exec('INSERT INTO crew_log (crew, t, que, k, por) VALUES (?, ?, ?, ?, ?)',
  crew, Date.now(), que, k || '', por || '');
const mal = (error, estado = 400, extra = {}) => Object.assign({ error, estado }, extra);

/** El precio y el ranking de hoy (el Dashboard, o lo de siempre). */
export function crewConfig(o) {
  const a = o.ajustes();
  const p = precioValido(a.crew_precio);
  const r = rankingValido(a.crews_ranking);
  return { precio: p === undefined || p === null ? PRECIO_CREW : p, ranking: r || { modo: 'todos', n: RANKING_N } };
}

/** ¿Le falta esperar para entrar a otra crew? Los ms que faltan, o 0. */
function espera(o, k, ahora) {
  const s = fila(o, 'SELECT t FROM crew_salidas WHERE k = ?', k);
  return s ? Math.max(0, s.t + ESPERA_MS - ahora) : 0;
}

/** El Discord ID de un perfil, si alguna vez actuó en la página (para su campana); `''` si no se sabe. */
function idDe(o, k) {
  const m = fila(o, "SELECT quien FROM crew_miembros WHERE k = ? AND quien != ''", k);
  if (m) return m.quien;
  for (const q of ['SELECT quien FROM servidor WHERE de = ? ORDER BY t DESC LIMIT 1',
    'SELECT quien FROM sigue WHERE de = ? ORDER BY t DESC LIMIT 1']) {
    try { const f = fila(o, q, k); if (f && f.quien) return f.quien; } catch (e) { /* tabla sin esa columna */ }
  }
  return '';
}

/** Lo que el ciclo sabe de un perfil (tabla `persona`, `subir_datos.py`): su letra y sus eventos, para los requisitos. */
function personaDe(o, k) {
  try {
    const f = fila(o, 'SELECT v FROM persona WHERE k = ?', 'p:' + k);
    return f ? (JSON.parse(f.v) || {}) : {};
  } catch (e) { return {}; }
}
const reqDe = (c) => { try { return reqValido(JSON.parse((c && c.req) || '{}')) || { rg: '', ev: 0 }; } catch (e) { return { rg: '', ev: 0 }; } };

/** Cómo se llama un perfil, para los avisos: el nombre de su `/card` (tabla `persona`), o la clave. */
function nombreDe(o, k) {
  try {
    const f = fila(o, 'SELECT v FROM persona WHERE k = ?', 'p:' + k);
    const n = f ? (JSON.parse(f.v) || {}).n : '';
    if (n) return String(n).slice(0, 40);
  } catch (e) { /* sin nombre: la clave */ }
  return k;
}

/** A la campana de alguien (si se sabe su cuenta): una invitación, un pedido aceptado… */
function avisar(o, k, clave, titulo, cuerpo, url) {
  const q = idDe(o, k);
  if (q) o.aBandeja(q, clave, 'crew', titulo, cuerpo, url, '', Date.now());
}

/** Los que mandan en una crew (Líder y Colíderes), para avisarles de un pedido. */
const mandan = (o, id) => filas(o, "SELECT k FROM crew_miembros WHERE crew = ? AND rol IN ('lider','colider')", id).map((r) => r.k);

/** ¿Recibe invitaciones de otras crews quien ya está en una? Sin preferencia anotada, sí. */
function recibe(o, k) {
  const f = fila(o, 'SELECT inv FROM crew_prefs WHERE k = ?', k);
  return !f || !!f.inv;
}

/** Entra `k` a la crew `c` como Miembro, si hay lugar y no está en otra ni esperando. `cambio`: viene de otra crew por una
 *  invitación (`cambiarse()`), y la espera que acaba de empezar es por ESTE cambio: no lo frena. */
function entrar(o, c, k, quien, por, ahora, cambio = false) {
  if (miembroDe(o, k)) return mal('ya_en_crew', 409);
  const e = cambio ? 0 : espera(o, k, ahora);
  if (e) return mal('espera', 409, { faltan_ms: e });
  if (cuantos(o, c.id) >= CREW_MAX) return mal('llena', 409, { max: CREW_MAX });
  o.state.storage.transactionSync(() => {
    o.sql.exec('INSERT INTO crew_miembros (k, crew, rol, quien, desde) VALUES (?, ?, ?, ?, ?)', k, c.id, 'miembro', quien || '', ahora);
    o.sql.exec('DELETE FROM crew_inv WHERE k = ?', k);
    o.sql.exec('DELETE FROM crew_ped WHERE k = ?', k);
    o.sql.exec('UPDATE crews SET t = ? WHERE id = ?', ahora, c.id);
    anotar(o, c.id, 'entro', k, por);
  });
  for (const m of mandan(o, c.id)) if (m !== k) avisar(o, m, 'crew-entro:' + c.id + ':' + k, nombreDe(o, k) + ' entró a ' + c.nombre, 'Ya es parte de la crew.', '#/crew/' + encodeURIComponent(c.id));
  // ¿era su primera semana y ya llegó? queda para siempre
  if (c.vence && cuantos(o, c.id) >= 1 + PRUEBA_SUMAR) {
    o.sql.exec('UPDATE crews SET vence = 0, vence_aviso = 0 WHERE id = ?', c.id);
    anotar(o, c.id, 'quedo', k, por);
    for (const m of mandan(o, c.id)) {
      avisar(o, m, 'crew-prueba:' + c.id, '🎉 ' + c.nombre + ' queda', 'Ya son ' + (1 + PRUEBA_SUMAR) + ': la crew no se borra.', '#/crew/' + encodeURIComponent(c.id));
    }
  }
  return { ok: true, crew: c.id };
}

/**
 * ⏳ LA PRIMERA SEMANA, EN EL TIEMPO: la que venció sin su gente se borra, y al líder (y a los colíderes) le llega el
 * recordatorio a dos días y el último día —una vez cada uno: `vence_aviso`—. La llama el vigía cada hora y, por las
 * dudas, todo lo que lee o toca una crew: el vigía duerme de 3 a 11 de la mañana, y una crew vencida no se muestra.
 */
export function crewVencer(o, ahora = Date.now()) {
  let borradas = 0;
  for (const c of filas(o, 'SELECT * FROM crews WHERE vence > 0')) {
    const n = cuantos(o, c.id);
    if (n >= 1 + PRUEBA_SUMAR) { o.sql.exec('UPDATE crews SET vence = 0, vence_aviso = 0 WHERE id = ?', c.id); continue; }
    if (c.vence <= ahora) {
      borrar(o, c, 'semana', ahora, [c.nombre + ' se borró',
        'No sumó ' + PRUEBA_SUMAR + ' personas en su primera semana. Podés armar otra o entrar a una.']);
      borradas += 1;
      continue;
    }
    const resta = c.vence - ahora;
    const nivel = resta <= DIA ? 3 : resta <= 2 * DIA ? 2 : 0;
    if (nivel > (c.vence_aviso || 0)) {
      const falta = 1 + PRUEBA_SUMAR - n;
      o.sql.exec('UPDATE crews SET vence_aviso = ? WHERE id = ?', nivel, c.id);
      for (const m of mandan(o, c.id)) {
        avisar(o, m, 'crew-prueba:' + c.id, (nivel === 3 ? '⏳ Último día para ' : '⏳ Quedan 2 días para ') + c.nombre,
          'Le falta' + (falta === 1 ? ' 1 persona' : 'n ' + falta + ' personas') + ' o la crew se borra. Invitá desde la página de la crew.',
          '#/crew/' + encodeURIComponent(c.id));
      }
    }
  }
  return borradas;
}

/** Lo de un perfil: su crew con todo (y lo que ve quien manda), sus invitaciones, si espera y cuánto cuesta crear. */
export function crewMia(o, d) {
  const ahora = Date.now();
  const k = String(d.de || '');
  const cfg = crewConfig(o);
  const out = { ok: true, de: k, precio: cfg.precio, max: CREW_MAX, espera_ms: k ? espera(o, k, ahora) : 0, crew: null, inv: [], ped: [],
    prueba: { dias: PRUEBA_MS / DIA, sumar: PRUEBA_SUMAR } };
  if (!k) return out;
  crewVencer(o, ahora);
  const m = miembroDe(o, k);
  if (m && d.quien && m.quien !== d.quien) o.sql.exec('UPDATE crew_miembros SET quien = ? WHERE k = ?', String(d.quien), k);
  if (m) {
    const cm = crewDe(o, m.crew);
    out.crew = crewPublica(o, cm);
    out.rol = m.rol;
    if (m.rol === 'lider') out.logo_pend = !!(cm && cm.logo_pend);
    if (m.rol === 'lider' || m.rol === 'colider') {
      out.pedidos = filas(o, 'SELECT k, t FROM crew_ped WHERE crew = ? AND t > ? ORDER BY t', m.crew, ahora - VENCE_MS);
      out.invitados = filas(o, 'SELECT k, de, t FROM crew_inv WHERE crew = ? AND t > ? ORDER BY t', m.crew, ahora - VENCE_MS);
    }
  }
  out.recibe = recibe(o, k);
  out.inv = filas(o, 'SELECT i.crew, i.de, i.t, c.nombre FROM crew_inv i JOIN crews c ON c.id = i.crew WHERE i.k = ? AND i.t > ? ' +
    'ORDER BY i.t DESC', k, ahora - VENCE_MS);
  out.ped = filas(o, 'SELECT p.crew, p.t, c.nombre FROM crew_ped p JOIN crews c ON c.id = p.crew WHERE p.k = ? AND p.t > ?',
    k, ahora - VENCE_MS);
  if (d.inicial !== undefined) out.saldo = o.saldo(String(d.quien || ''), Number(d.desde) || 0, Number(d.inicial));
  return out;
}

/** Una crew para afuera: sin ningún Discord ID. */
export function crewPublica(o, c) {
  if (!c) return null;
  const gente = filas(o, 'SELECT k, rol, desde FROM crew_miembros WHERE crew = ? ORDER BY desde', c.id)
    .sort((a, b) => ROLES.indexOf(a.rol) - ROLES.indexOf(b.rol) || a.desde - b.desde);
  let reps = [];
  try { reps = JSON.parse(c.reps || '[]'); } catch (e) { reps = []; }
  return { id: c.id, nombre: c.nombre, sigla: c.sigla, entrada: c.entrada, oficial: !!c.oficial, creada: c.creada,
    reps: reps.filter((k) => gente.some((g) => g.k === k)), gente: gente.map((g) => [g.k, g.rol, g.desde]),
    vence: c.vence || 0, logo: c.logo || '', desc: c.descr || '', req: reqDe(c) };
}

/** Todas, para `/avisos/crews` (público, 60 s): lo lee la página y el ciclo. */
export function crewsPublico(o) {
  const cfg = crewConfig(o);
  crewVencer(o);
  const crews = filas(o, 'SELECT * FROM crews ORDER BY creada').map((c) => crewPublica(o, c));
  return { t: Date.now(), max: CREW_MAX, precio: cfg.precio, ranking: cfg.ranking,
    prueba: { dias: PRUEBA_MS / DIA, sumar: PRUEBA_SUMAR }, crews };
}

/**
 * 👥 Una acción. `d` lo arma el Worker: `accion`, `quien` y `de` (verificado), más lo de cada una. Devuelve
 * `{ok…}` o `{error, estado}`. ⚠️ El saldo y el lugar se miran ACÁ: el objeto es uno solo, y dos pedidos a la vez no
 * gastan la misma plata ni meten al 21.
 */
export function crewAccion(o, d) {
  const quien = String(d.quien || ''), k = String(d.de || '');
  const ahora = Date.now();
  if (!/^[0-9]{5,25}$/.test(quien)) return mal('faltan datos');
  if (!k) return mal('verificate', 403);
  crewVencer(o, ahora);
  const yo = miembroDe(o, k);
  const c = yo ? crewDe(o, yo.crew) : null;
  const a = String(d.accion || '');

  if (a === 'crear') {
    const ch = chequeoCrear(o, d);
    if (ch.error) return ch;
    const { nombre, sigla, entrada, precio, s, descr } = ch;
    if (!d.logo_url) return mal('logo');
    if (!o.cuentaCambio(quien, 'crew-crear', 3)) return mal('espera_dia', 429);
    const vence = ahora + PRUEBA_MS;
    const ok = d.logo_v === 'ok';
    o.state.storage.transactionSync(() => {
      o.sql.exec('INSERT INTO crews (id, nombre, norm, sigla, entrada, reps, oficial, creada, por, nombre_t, t, vence, vence_aviso, ' +
        "logo, logo_pend, logo_t, logo_pend_t, descr) VALUES (?, ?, ?, ?, ?, '[]', 0, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)", nombre, nombre,
      normCrew(nombre), sigla, entrada, ahora, quien, ahora, ahora, vence, ok ? d.logo_url : '', ok ? '' : d.logo_url, ok ? ahora : 0,
      ok ? 0 : ahora, descr);
      o.sql.exec('INSERT INTO crew_miembros (k, crew, rol, quien, desde) VALUES (?, ?, ?, ?, ?)', k, nombre, 'lider', quien, ahora);
      o.sql.exec('DELETE FROM crew_inv WHERE k = ?', k);
      o.sql.exec('DELETE FROM crew_ped WHERE k = ?', k);
      if (precio) {
        o.sql.exec('INSERT OR REPLACE INTO tienda (id, ref, quien, monto, t) VALUES (?, 0, ?, ?, ?)',
          'crew:' + quien + ':' + ahora, quien, -precio, ahora);
      }
      anotar(o, nombre, 'creada', k, k);
    });
    o.aBandeja(quien, 'crew-prueba:' + nombre, 'crew', '⏳ ' + nombre + ': tenés una semana',
      'Sumá ' + PRUEBA_SUMAR + ' personas a la crew en 7 días o se borra.', '#/crew/' + encodeURIComponent(nombre), '', ahora);
    return { ok: true, crew: nombre, saldo: s - precio, precio, vence, logo: ok ? 'ok' : 'revisar' };
  }

  // ── lo que se hace desde afuera de una crew ──
  if (a === 'responder') {
    const id = String(d.crew || '');
    const inv = fila(o, 'SELECT * FROM crew_inv WHERE crew = ? AND k = ?', id, k);
    if (!inv || inv.t < ahora - VENCE_MS) return mal('sin_invitacion', 404);
    if (d.si !== true) {
      o.sql.exec('DELETE FROM crew_inv WHERE crew = ? AND k = ?', id, k);
      return { ok: true, no: true };
    }
    const cc = crewDe(o, id);
    if (!cc) return mal('no_existe', 404);
    if (yo) return cambiarse(o, yo, cc, k, quien, inv.de, ahora);
    return entrar(o, cc, k, quien, inv.de, ahora);
  }
  if (a === 'pedir') {
    const cc = crewDe(o, String(d.crew || ''));
    if (!cc) return mal('no_existe', 404);
    if (yo) return mal('ya_en_crew', 409);
    if (cc.entrada === 'invitacion') return mal('solo_invitacion', 409);
    // ¿ya lo invitaron? entonces entra
    const inv = fila(o, 'SELECT de FROM crew_inv WHERE crew = ? AND k = ? AND t > ?', cc.id, k, ahora - VENCE_MS);
    // 🎯 los requisitos: al pedir y al unirse a una abierta; con invitación no (ya eligió el Líder)
    if (!inv) {
      const falta = faltaReq(reqDe(cc), personaDe(o, k));
      if (falta.length) return mal('requisitos', 409, { falta });
    }
    if (cc.entrada === 'abierta' || inv) return entrar(o, cc, k, quien, inv ? inv.de : k, ahora);
    const e = espera(o, k, ahora);
    if (e) return mal('espera', 409, { faltan_ms: e });
    if (cuantos(o, cc.id) >= CREW_MAX) return mal('llena', 409, { max: CREW_MAX });
    if (!o.cuentaCambio(quien, 'crew-pedir', 10)) return mal('espera_dia', 429);
    o.sql.exec('INSERT OR REPLACE INTO crew_ped (crew, k, quien, t) VALUES (?, ?, ?, ?)', cc.id, k, quien, ahora);
    for (const m of mandan(o, cc.id)) avisar(o, m, 'crew-ped:' + cc.id + ':' + k, nombreDe(o, k) + ' pidió entrar a ' + cc.nombre, 'Aceptalo o no desde la página de la crew.', '#/crew/' + encodeURIComponent(cc.id));
    return { ok: true, pedido: true };
  }
  if (a === 'cancelar_pedido') {
    o.sql.exec('DELETE FROM crew_ped WHERE crew = ? AND k = ?', String(d.crew || ''), k);
    return { ok: true };
  }
  if (a === 'pref_inv') {
    // 📨 recibir (o no) invitaciones de otras crews mientras estás en una
    o.sql.exec('INSERT OR REPLACE INTO crew_prefs (k, inv) VALUES (?, ?)', k, d.si === false ? 0 : 1);
    return { ok: true, recibe: d.si !== false };
  }

  // ── lo que se hace desde adentro ──
  if (!yo || !c) return mal('sin_crew', 409);
  const rol = yo.rol;
  if (yo.quien !== quien) o.sql.exec('UPDATE crew_miembros SET quien = ? WHERE k = ?', quien, k);

  if (a === 'invitar') {
    if (!puede(rol, 'invitar')) return mal('rol', 403);
    const a2 = String(d.a || '');
    if (!a2 || a2 === k) return mal('a quién');
    // 📨 a quien ya está en OTRA crew también se lo invita, si recibe invitaciones (Dlx, 19/10/2026)
    const suyo = miembroDe(o, a2);
    if (suyo && suyo.crew === c.id) return mal('ya_en_crew', 409);
    if (suyo && !recibe(o, a2)) return mal('no_recibe', 409);
    if (cuantos(o, c.id) >= CREW_MAX) return mal('llena', 409, { max: CREW_MAX });
    if (fila(o, 'SELECT 1 AS x FROM crew_inv WHERE crew = ? AND k = ? AND t > ?', c.id, a2, ahora - VENCE_MS)) return { ok: true, ya: true };
    if (!o.cuentaCambio(quien, 'crew-inv', INV_DIA)) return mal('espera_dia', 429);
    // ¿ya había pedido entrar? entonces entra
    if (fila(o, 'SELECT 1 AS x FROM crew_ped WHERE crew = ? AND k = ? AND t > ?', c.id, a2, ahora - VENCE_MS)) {
      return entrar(o, c, a2, '', k, ahora);
    }
    o.sql.exec('INSERT OR REPLACE INTO crew_inv (crew, k, de, t) VALUES (?, ?, ?, ?)', c.id, a2, k, ahora);
    anotar(o, c.id, 'invito', a2, k);
    avisar(o, a2, 'crew-inv:' + c.id, 'Te invitaron a ' + c.nombre, suyo ? 'Si aceptás, dejás tu crew de ahora. Tenés una semana para decidir.'
      : 'Aceptá o no desde tu cuenta: tenés una semana.', '#/cuenta/crew');
    return { ok: true, invitado: a2 };
  }
  if (a === 'desinvitar') {
    if (!puede(rol, 'invitar')) return mal('rol', 403);
    o.sql.exec('DELETE FROM crew_inv WHERE crew = ? AND k = ?', c.id, String(d.a || ''));
    return { ok: true };
  }
  if (a === 'decidir') {
    if (!puede(rol, 'decidir')) return mal('rol', 403);
    const a2 = String(d.a || '');
    const p = fila(o, 'SELECT * FROM crew_ped WHERE crew = ? AND k = ?', c.id, a2);
    if (!p || p.t < ahora - VENCE_MS) return mal('sin_pedido', 404);
    if (d.si !== true) {
      o.sql.exec('DELETE FROM crew_ped WHERE crew = ? AND k = ?', c.id, a2);
      return { ok: true, no: true };
    }
    const r = entrar(o, c, a2, p.quien, k, ahora);
    if (r.ok) avisar(o, a2, 'crew-si:' + c.id, 'Entraste a ' + c.nombre, 'Aceptaron tu pedido.', '#/crew/' + encodeURIComponent(c.id));
    return r;
  }
  if (a === 'salir') {
    if (rol === 'lider') {
      // el líder no se va dejando la crew sin cabeza: o pasa el liderazgo, o es el último y la crew se cierra
      if (cuantos(o, c.id) > 1) return mal('lider_pasa_primero', 409);
      return borrar(o, c, k, ahora);
    }
    o.state.storage.transactionSync(() => {
      o.sql.exec('DELETE FROM crew_miembros WHERE k = ?', k);
      o.sql.exec('INSERT OR REPLACE INTO crew_salidas (k, t) VALUES (?, ?)', k, ahora);
      o.sql.exec('UPDATE crews SET t = ? WHERE id = ?', ahora, c.id);
      sacarDeReps(o, c, k);
      anotar(o, c.id, 'salio', k, k);
    });
    return { ok: true, espera_ms: ESPERA_MS };
  }
  if (a === 'sacar') {
    const a2 = String(d.a || '');
    const el = miembroDe(o, a2);
    if (!el || el.crew !== c.id || a2 === k) return mal('no_esta', 404);
    if (!puede(rol, 'sacar', el.rol)) return mal('rol', 403);
    o.state.storage.transactionSync(() => {
      o.sql.exec('DELETE FROM crew_miembros WHERE k = ?', a2);
      // 🔑 también espera: si no, «sacame y metete en otra» saltea los 7 días
      o.sql.exec('INSERT OR REPLACE INTO crew_salidas (k, t) VALUES (?, ?)', a2, ahora);
      o.sql.exec('UPDATE crews SET t = ? WHERE id = ?', ahora, c.id);
      sacarDeReps(o, c, a2);
      anotar(o, c.id, 'sacado', a2, k);
    });
    avisar(o, a2, 'crew-fuera:' + c.id, 'Ya no estás en ' + c.nombre, 'Te sacaron de la crew. Podés entrar a otra en 7 días.', '#/cuenta/crew');
    return { ok: true };
  }
  if (a === 'rol') {
    const a2 = String(d.a || ''), nuevo = String(d.rol || '');
    const el = miembroDe(o, a2);
    if (!el || el.crew !== c.id || a2 === k) return mal('no_esta', 404);
    if (!['colider', 'veterano', 'miembro'].includes(nuevo)) return mal('rol');
    if (!puede(rol, 'rol', el.rol) || (rol === 'colider' && nuevo === 'colider')) return mal('rol', 403);
    o.sql.exec('UPDATE crew_miembros SET rol = ? WHERE k = ?', nuevo, a2);
    anotar(o, c.id, 'rol:' + nuevo, a2, k);
    avisar(o, a2, 'crew-rol:' + c.id, 'Ahora sos ' + ROL_NOMBRE[nuevo] + ' de ' + c.nombre, '', '#/crew/' + encodeURIComponent(c.id));
    return { ok: true };
  }
  if (a === 'lider') {
    if (!puede(rol, 'lider')) return mal('rol', 403);
    const a2 = String(d.a || '');
    const el = miembroDe(o, a2);
    if (!el || el.crew !== c.id || a2 === k) return mal('no_esta', 404);
    o.state.storage.transactionSync(() => {
      o.sql.exec("UPDATE crew_miembros SET rol = 'lider' WHERE k = ?", a2);
      o.sql.exec("UPDATE crew_miembros SET rol = 'colider' WHERE k = ?", k);
      anotar(o, c.id, 'lider', a2, k);
    });
    avisar(o, a2, 'crew-lider:' + c.id, 'Ahora sos el Líder de ' + c.nombre, '', '#/crew/' + encodeURIComponent(c.id));
    return { ok: true };
  }
  if (a === 'reps') {
    if (!puede(rol, 'reps')) return mal('rol', 403);
    const { ranking } = crewConfig(o);
    const lista = Array.isArray(d.reps) ? [...new Set(d.reps.map(String))] : null;
    if (!lista || lista.length > ranking.n) return mal('reps', 400, { max: ranking.n });
    const gente = new Set(filas(o, 'SELECT k FROM crew_miembros WHERE crew = ?', c.id).map((r) => r.k));
    if (!lista.every((x) => gente.has(x))) return mal('reps');
    o.sql.exec('UPDATE crews SET reps = ?, t = ? WHERE id = ?', JSON.stringify(lista), ahora, c.id);
    anotar(o, c.id, 'reps', lista.join(','), k);
    return { ok: true, reps: lista };
  }
  if (a === 'entrada') {
    if (!puede(rol, 'entrada') || !ENTRADAS.includes(d.entrada)) return mal('rol', 403);
    o.sql.exec('UPDATE crews SET entrada = ?, t = ? WHERE id = ?', d.entrada, ahora, c.id);
    return { ok: true };
  }
  if (a === 'nombre') {
    if (!puede(rol, 'nombre')) return mal('rol', 403);
    const nombre = nombreCrew(d.nombre);
    if (!nombre) return mal('nombre');
    const sigla = siglaCrew(d.sigla === undefined ? c.sigla : d.sigla, true);
    if (sigla === null) return mal('sigla');
    if (nombre !== c.nombre) {
      if (c.nombre_t && ahora - c.nombre_t < NOMBRE_MS) return mal('nombre_espera', 409, { faltan_ms: c.nombre_t + NOMBRE_MS - ahora });
      if (fila(o, 'SELECT id FROM crews WHERE norm = ? AND id != ?', normCrew(nombre), c.id)) return mal('nombre_usado', 409);
    }
    o.sql.exec('UPDATE crews SET nombre = ?, norm = ?, sigla = ?, nombre_t = ?, t = ? WHERE id = ?', nombre, normCrew(nombre), sigla,
      nombre !== c.nombre ? ahora : c.nombre_t, ahora, c.id);
    anotar(o, c.id, 'nombre', nombre, k);
    return { ok: true };
  }
  if (a === 'logo') {
    if (!puede(rol, 'nombre')) return mal('rol', 403);
    if (!d.logo_url) return mal('logo');
    // lo que se reemplaza se borra de R2 (lo hace `crewConImagen()`, que es la que puede esperar)
    const viejos = [];
    if (d.logo_v === 'ok') {
      if (c.logo) viejos.push(c.logo);
      if (c.logo_pend) viejos.push(c.logo_pend);
      o.sql.exec("UPDATE crews SET logo = ?, logo_pend = '', logo_t = ?, logo_pend_t = 0, t = ? WHERE id = ?", d.logo_url, ahora, ahora, c.id);
    } else {
      if (c.logo_pend) viejos.push(c.logo_pend);
      // ⚠️ `logo_pend_t` y no `logo_t`: tocar `logo_t` ponía el logo VIEJO en «lo que aprobó el filtro» del Dashboard,
      // al lado del nuevo, y su «Quitar» descartaba el nuevo (la revisión del 19/10/2026)
      o.sql.exec('UPDATE crews SET logo_pend = ?, logo_pend_t = ?, t = ? WHERE id = ?', d.logo_url, ahora, ahora, c.id);
    }
    anotar(o, c.id, 'logo', d.logo_v === 'ok' ? 'ok' : 'revisar', k);
    return { ok: true, viejos, logo: d.logo_v === 'ok' ? 'ok' : 'revisar' };
  }
  if (a === 'req') {
    if (!puede(rol, 'entrada')) return mal('rol', 403);
    const r = reqValido(d.req);
    if (!r) return mal('req');
    o.sql.exec('UPDATE crews SET req = ?, t = ? WHERE id = ?', JSON.stringify(r), ahora, c.id);
    anotar(o, c.id, 'req', JSON.stringify(r), k);
    return { ok: true, req: r };
  }
  if (a === 'desc') {
    if (!puede(rol, 'nombre')) return mal('rol', 403);
    const descr = descCrew(d.desc);
    if (!descr) return mal('desc');
    o.sql.exec('UPDATE crews SET descr = ?, t = ? WHERE id = ?', descr, ahora, c.id);
    anotar(o, c.id, 'desc', '', k);
    return { ok: true };
  }
  if (a === 'borrar') {
    if (!puede(rol, 'borrar')) return mal('rol', 403);
    return borrar(o, c, k, ahora);
  }
  return mal('accion');
}

/**
 * Lo que tiene que estar bien para crear una crew, sin escribir nada: lo mira `crewAccion()` y, antes, `crewConImagen()`
 * —para no pasar un logo por la IA ni guardarlo en R2 si igual la crew no se iba a crear—. `{ok, …lo limpio}` o `{error}`.
 */
export function chequeoCrear(o, d) {
  const quien = String(d.quien || ''), k = String(d.de || '');
  const ahora = Date.now();
  if (!/^[0-9]{5,25}$/.test(quien)) return mal('faltan datos');
  if (!k) return mal('verificate', 403);
  if (miembroDe(o, k)) return mal('ya_en_crew', 409);
  const e = espera(o, k, ahora);
  if (e) return mal('espera', 409, { faltan_ms: e });
  const nombre = nombreCrew(d.nombre);
  if (!nombre) return mal('nombre');
  const sigla = siglaCrew(d.sigla, true);
  if (sigla === null) return mal('sigla');
  const descr = descCrew(d.desc);
  if (!descr) return mal('desc');
  if (fila(o, 'SELECT id FROM crews WHERE norm = ? OR id = ?', normCrew(nombre), nombre)) return mal('nombre_usado', 409);
  const { precio } = crewConfig(o);
  const ini = Number(d.inicial);
  if (!Number.isInteger(ini)) return mal('todavia', 503);
  const s = o.saldo(quien, Number(d.desde) || 0, ini);
  if (precio > s) return mal('saldo', 409, { saldo: s, precio });
  return { ok: true, nombre, sigla, descr, precio, s, entrada: ENTRADAS.includes(d.entrada) ? d.entrada : 'pedido' };
}

/** Lo mismo para cambiar el logo: estar en una crew y ser su Líder. */
export function chequeoLogo(o, d) {
  const m = d.de ? miembroDe(o, String(d.de)) : null;
  if (!m) return mal('sin_crew', 409);
  return puede(m.rol, 'nombre') ? { ok: true } : mal('rol', 403);
}

/**
 * 📨 CAMBIARSE DE CREW POR UNA INVITACIÓN: sale de la suya y entra a la nueva. Todo lo que puede fallar se mira ANTES de
 * sacarlo de la suya —si no, una crew llena lo dejaría sin ninguna—. Cuenta como salir: los 7 días corren desde ahora.
 */
function cambiarse(o, yo, cc, k, quien, por, ahora) {
  if (yo.crew === cc.id) return mal('ya_en_crew', 409);
  if (yo.rol === 'lider') return mal('lider_pasa_primero', 409);
  const e = espera(o, k, ahora);
  if (e) return mal('espera', 409, { faltan_ms: e });
  if (cuantos(o, cc.id) >= CREW_MAX) return mal('llena', 409, { max: CREW_MAX });
  const vieja = crewDe(o, yo.crew);
  o.state.storage.transactionSync(() => {
    o.sql.exec('DELETE FROM crew_miembros WHERE k = ?', k);
    o.sql.exec('INSERT OR REPLACE INTO crew_salidas (k, t) VALUES (?, ?)', k, ahora);
    if (vieja) {
      o.sql.exec('UPDATE crews SET t = ? WHERE id = ?', ahora, vieja.id);
      sacarDeReps(o, vieja, k);
      anotar(o, vieja.id, 'se_cambio', k, cc.id);
    }
  });
  if (vieja) {
    for (const m of mandan(o, vieja.id)) {
      avisar(o, m, 'crew-sefue:' + vieja.id + ':' + k, nombreDe(o, k) + ' se fue a ' + cc.nombre, 'Dejó ' + vieja.nombre + ' por una invitación.',
        '#/crew/' + encodeURIComponent(vieja.id));
    }
  }
  return Object.assign(entrar(o, cc, k, quien, por, ahora, true), { dejo: vieja ? vieja.nombre : '' });
}

function sacarDeReps(o, c, k) {
  let reps = [];
  try { reps = JSON.parse(c.reps || '[]'); } catch (e) { reps = []; }
  if (reps.includes(k)) o.sql.exec('UPDATE crews SET reps = ? WHERE id = ?', JSON.stringify(reps.filter((x) => x !== k)), c.id);
}

/** Cerrar una crew: la gente queda libre (sin espera: no eligieron irse). `aviso`: `[título, cuerpo]` para todos —la
 *  de la primera semana lo trae, porque al líder también le llega—; sin él, a todos menos a quien la cerró. */
function borrar(o, c, por, ahora, aviso = null) {
  // 🔑 las cuentas ANTES de borrar: `idDe()` las busca en `crew_miembros`, y después del DELETE ya no están —hasta el
  // 19/10/2026 el «se cerró» le llegaba sólo a quien la página conocía por otro lado—
  const gente = filas(o, 'SELECT k FROM crew_miembros WHERE crew = ?', c.id).map((r) => [r.k, idDe(o, r.k)]);
  o.state.storage.transactionSync(() => {
    // 🗑️ sus logos, a la basura: si no, quedaban en R2 para siempre, públicos —también uno que nadie revisó—
    tirar(o, [c.logo, c.logo_pend]);
    o.sql.exec('DELETE FROM crew_miembros WHERE crew = ?', c.id);
    o.sql.exec('DELETE FROM crew_inv WHERE crew = ?', c.id);
    o.sql.exec('DELETE FROM crew_ped WHERE crew = ?', c.id);
    o.sql.exec('DELETE FROM crews WHERE id = ?', c.id);
    anotar(o, c.id, 'cerrada', '', por);
  });
  for (const [g, q] of gente) {
    if (!q || (!aviso && g === por)) continue;
    if (aviso) o.aBandeja(q, 'crew-prueba:' + c.id, 'crew', aviso[0], aviso[1], '#/cuenta/crew', '', ahora);
    else o.aBandeja(q, 'crew-cerrada:' + c.id, 'crew', c.nombre + ' se cerró', 'Podés entrar a otra crew cuando quieras.', '#/cuenta/crew', '', ahora);
  }
  return { ok: true, cerrada: true };
}

/**
 * 🔒 Lo del dueño (Dlx, desde el Dashboard): elegir el líder de una crew —lo que pidió para las 34 de hoy—, cambiarle
 * el nombre o cerrarla. Sin los límites de la gente (ni los 30 días del nombre ni el rol).
 */
export function crewDueno(o, d) {
  const c = crewDe(o, String(d.crew || ''));
  if (!c) return mal('no_existe', 404);
  const ahora = Date.now();
  if (d.que === 'lider') {
    const el = miembroDe(o, String(d.a || ''));
    if (!el || el.crew !== c.id) return mal('no_esta', 404);
    o.state.storage.transactionSync(() => {
      o.sql.exec("UPDATE crew_miembros SET rol = 'colider' WHERE crew = ? AND rol = 'lider'", c.id);
      o.sql.exec("UPDATE crew_miembros SET rol = 'lider' WHERE k = ?", el.k);
      anotar(o, c.id, 'lider', el.k, 'dueño');
    });
    return { ok: true };
  }
  if (d.que === 'nombre') {
    const nombre = nombreCrew(d.nombre);
    if (!nombre) return mal('nombre');
    if (fila(o, 'SELECT id FROM crews WHERE norm = ? AND id != ?', normCrew(nombre), c.id)) return mal('nombre_usado', 409);
    o.sql.exec('UPDATE crews SET nombre = ?, norm = ?, t = ? WHERE id = ?', nombre, normCrew(nombre), ahora, c.id);
    anotar(o, c.id, 'nombre', nombre, 'dueño');
    return { ok: true };
  }
  if (d.que === 'borrar') return borrar(o, c, 'dueño', ahora);
  if (d.que === 'logo') {
    // 🛡️ como los fondos, pero SOBRE EL LOGO QUE SE VIO (`d.url`): aprobar o descartar el que espera, o quitar el que se
    // ve. Si mientras se miraba el Líder subió otro, no se aprueba algo que nadie vio ni se descarta lo que no se eligió
    // (la revisión del 19/10/2026): contesta `cambio` y el Dashboard pide recargar. A su Líder le llega a la campana
    const lid = fila(o, "SELECT k FROM crew_miembros WHERE crew = ? AND rol = 'lider'", c.id);
    const url = '#/crew/' + encodeURIComponent(c.id);
    const motivo = String(d.motivo || '').slice(0, 120);
    const u = String(d.url || '');
    const esPend = !!c.logo_pend && u === c.logo_pend, esVisto = !!c.logo && u === c.logo;
    if (d.si) {
      if (!esPend) return mal('cambio', 409);
      // aprobado por una persona: no va a «lo que aprobó el filtro» (`logo_t` en 0)
      o.sql.exec("UPDATE crews SET logo = logo_pend, logo_pend = '', logo_t = 0, logo_pend_t = 0, t = ? WHERE id = ?", ahora, c.id);
      anotar(o, c.id, 'logo_si', '', 'dueño');
      if (lid) avisar(o, lid.k, 'crew-logo:' + c.id, '🖼️ El logo de ' + c.nombre + ' ya se ve', 'Lo aprobamos.', url);
      return { ok: true, viejos: c.logo ? [c.logo] : [] };
    }
    if (!esPend && !esVisto) return mal('cambio', 409);
    o.sql.exec(esPend ? "UPDATE crews SET logo_pend = '', logo_pend_t = 0, t = ? WHERE id = ?" : "UPDATE crews SET logo = '', logo_t = 0, t = ? WHERE id = ?",
      ahora, c.id);
    anotar(o, c.id, esPend ? 'logo_no' : 'logo_quitado', motivo, 'dueño');
    if (lid) {
      avisar(o, lid.k, 'crew-logo:' + c.id, '🖼️ El logo de ' + c.nombre + (esPend ? ' no se aprobó' : ' se quitó'),
        (motivo ? motivo + '. ' : '') + 'Subí otro desde la página de la crew.', url);
    }
    return { ok: true, viejos: [u] };
  }
  return mal('que');
}

/** Para el Dashboard: los logos que esperan revisión y los que el filtro aprobó en los últimos 3 días (con «Quitar»). */
export function crewLogosDueno(o) {
  const desde = Date.now() - 3 * DIA;
  return {
    pend: filas(o, "SELECT id, nombre, logo_pend AS url, logo_pend_t AS t FROM crews WHERE logo_pend != '' ORDER BY logo_pend_t"),
    vistos: filas(o, "SELECT id, nombre, logo AS url, logo_t AS t FROM crews WHERE logo != '' AND logo_t > ? ORDER BY logo_t DESC", desde),
  };
}

/**
 * 🌱 LAS 34 DE HOY, UNA VEZ (lo manda el ciclo con su clave: `crews_vivas.py --sembrar`). Cada una con su gente, por
 * su clave; el líder, el primero de la lista hasta que Dlx elija. Sólo agrega: una crew que ya existe no se toca, y
 * alguien que ya está en otra no se mueve. Marcadas como oficiales (las armó la Liga).
 */
export function sembrar(o, d) {
  if (!d || !Array.isArray(d.crews) || d.crews.length > 200) return mal('datos');
  const ahora = Date.now();
  let nuevas = 0, gente = 0;
  for (const x of d.crews) {
    const id = String((x && x.id) || '');
    const nombre = nombreCrew((x && x.nombre) || id) || id;
    if (!id || id.length > 40 || !Array.isArray(x.gente) || crewDe(o, id)) continue;
    if (fila(o, 'SELECT id FROM crews WHERE norm = ?', normCrew(nombre))) continue;
    const ks = x.gente.map(String).filter((k) => k && k.length <= 60 && !miembroDe(o, k)).slice(0, CREW_MAX);
    if (!ks.length) continue;
    o.state.storage.transactionSync(() => {
      o.sql.exec('INSERT INTO crews (id, nombre, norm, sigla, entrada, reps, oficial, creada, por, nombre_t, t) ' +
        "VALUES (?, ?, ?, ?, 'pedido', '[]', 1, ?, 'liga', 0, ?)", id, nombre, normCrew(nombre), siglaCrew(x.sigla) || '', ahora, ahora);
      ks.forEach((k, i) => {
        o.sql.exec('INSERT INTO crew_miembros (k, crew, rol, quien, desde) VALUES (?, ?, ?, ?, ?)', k, id, i ? 'miembro' : 'lider', '', ahora);
      });
      anotar(o, id, 'sembrada', '', 'liga');
    });
    nuevas += 1;
    gente += ks.length;
  }
  return { ok: true, nuevas, gente };
}

/** 🗑️ Anotar logos que ya no se usan (vacíos afuera). Los borra de R2 quien puede esperar: `crewBasura()`. */
function tirar(o, urls) {
  for (const u of urls || []) if (u) o.sql.exec('INSERT OR IGNORE INTO crew_basura (url, t) VALUES (?, ?)', u, Date.now());
}

/** Los logos para borrar de R2 (hasta `n`), y `crewBasuraLista()` para darlos por borrados. Los llama el objeto
 *  (`vaciarBasuraCrews()` de avisos.js) después de cada acción y en el vigía. */
export function crewBasura(o, n = 50) {
  return filas(o, 'SELECT url FROM crew_basura ORDER BY t LIMIT ?', n).map((r) => r.url);
}
export function crewBasuraLista(o, urls) {
  for (const u of urls || []) o.sql.exec('DELETE FROM crew_basura WHERE url = ?', u);
}

/** 🧹 Lo vencido: invitaciones y pedidos de más de una semana, y esperas cumplidas. Lo llama el vigía. */
export function crewLimpiar(o) {
  const ahora = Date.now();
  crewVencer(o, ahora);
  o.sql.exec('DELETE FROM crew_inv WHERE t < ?', ahora - VENCE_MS);
  o.sql.exec('DELETE FROM crew_ped WHERE t < ?', ahora - VENCE_MS);
  o.sql.exec('DELETE FROM crew_salidas WHERE t < ?', ahora - ESPERA_MS);
  o.sql.exec('DELETE FROM crew_log WHERE t < ?', ahora - 120 * DIA);
}

/** Para `olvidar()` y `mudarCuenta()`: un perfil fuera de todo lo de crews (no la crew en sí). */
export function crewOlvidar(o, k) {
  if (!k) return;
  const m = miembroDe(o, k);
  if (m && m.rol === 'lider') {
    // la crew no queda sin cabeza: el colíder más viejo, o el más viejo de todos
    const sig = fila(o, "SELECT k FROM crew_miembros WHERE crew = ? AND k != ? ORDER BY CASE rol WHEN 'colider' THEN 0 " +
      "WHEN 'veterano' THEN 1 ELSE 2 END, desde LIMIT 1", m.crew, k);
    if (sig) o.sql.exec("UPDATE crew_miembros SET rol = 'lider' WHERE k = ?", sig.k);
    else {
      const c = crewDe(o, m.crew);
      if (c) tirar(o, [c.logo, c.logo_pend]);
      o.sql.exec('DELETE FROM crews WHERE id = ?', m.crew);
      o.sql.exec('DELETE FROM crew_inv WHERE crew = ?', m.crew);
    }
  }
  o.sql.exec('DELETE FROM crew_miembros WHERE k = ?', k);
  o.sql.exec('DELETE FROM crew_inv WHERE k = ? OR de = ?', k, k);
  o.sql.exec('DELETE FROM crew_ped WHERE k = ?', k);
  o.sql.exec('DELETE FROM crew_salidas WHERE k = ?', k);
  o.sql.exec('DELETE FROM crew_prefs WHERE k = ?', k);
}

/** Para `mudarCuenta()`: la cuenta nueva es otra persona en Discord, pero el perfil es el mismo: se anota el ID nuevo. */
export function crewMudar(o, viejo, nuevo) {
  o.sql.exec('UPDATE crew_miembros SET quien = ? WHERE quien = ?', nuevo, viejo);
  o.sql.exec('UPDATE crew_ped SET quien = ? WHERE quien = ?', nuevo, viejo);
}
