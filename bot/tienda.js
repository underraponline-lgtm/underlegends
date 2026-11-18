// 🛍️ LA TIENDA DE LA LIGA GLOBAL (Dlx, 17/11/2026: «la segunda actualización más grande de la Liga Global… que subamos
// esto de golpe… hasta que todo esté listo»). El motor: comprar, deshacer, ponerse, regalar, la lista de deseos, las
// colecciones con su premio, las ediciones de 10 y el drop del día. Vive en el objeto, como las crews (bot/crews.js).
//
// 🔒 APAGADA HASTA EL LANZAMIENTO. Abre cuando el catálogo cargado dice `abierta: true`; mientras tanto sólo el dueño
// la ve (el ensayo). EL CATÁLOGO NO VIVE EN EL REPO (es público y las piezas y sus precios son una sorpresa): lo carga
// `bot/tienda_subir.py` con la clave del ciclo desde un archivo que está afuera, y el objeto lo guarda (`tienda_cat`).
// Acá sólo están las reglas, que Dlx decidió el 17/11/2026 (los precios, los descuentos y los topes los trae el catálogo):
//   · LO QUE COMPRAS ES TUYO PARA SIEMPRE, y no cambia sin ti
//   · NADA DE LO QUE COMPRAS ES AL AZAR. El drop del día es aparte, gratis y no se compra (`drop`)
//   · LOS PRECIOS NUNCA SUBEN; si uno baja, quien compró esa pieza hace poco (`baja_dias`) recibe la diferencia
//   · DESHACER: por un rato (`deshacer_h`), si no te la pusiste, una vez por pieza; una colección comprada junta se
//     deshace entera
//   · REGALOS: unos pocos por semana (`regalos_semana`), a verificados, si jugaste un evento en la temporada; quien
//     recibe acepta o rechaza, y sin respuesta a tiempo (`regalo_dias`) vuelven los Puntos. Una colección regalada cobra lo que le falta a quien la recibe. No se
//     regalan las ediciones de 10, lo sólo-Premium, el cambio de nombre ni lo gratis
//   · PREMIUM: un descuento en las piezas y otro en las colecciones (no se suman); lo sólo-Premium que compraste queda
//     tuyo
//   · COLECCIONES: cobran con descuento lo que te falta; completarla (de a una o junta) da su premio
//   · EDICIONES NUMERADAS: una por persona, para quien jugó esa temporada; la #1 es del campeón; si no se venden todas, la
//     edición se cierra con las vendidas, y no se reedita nunca
//   · LA VITRINA: lo que sólo pasa por ella se vende mientras está ahí
//   · TU LISTA: privada, con la opción de mostrarla en tu perfil; avisa cuando entra en la vitrina o baja de precio
//
// 🔑 Quién actúa lo dice el Worker (`quien`, su Discord ID; `de`, su perfil verificado), nunca la página. La plata es la
// misma billetera de Puntos de Tienda (tabla `tienda` del objeto): cada movimiento lleva el ID adentro (`mudarCuenta()`).

export const MENSAJES = ['', '¡Felicitaciones!', 'Para tu próxima batalla', 'Te lo ganaste'];
export const CATEGORIAS = ['aro', 'deco', 'nom', 'carta', 'perfil', 'serv', 'fp', 'fv', 'fe', 'fd', 'ff', 'fr'];
/** dónde se pone cada cosa: las cuatro de tu cara y tu carta, y los seis lugares del fondo */
// `perfil` (stickers, entradas, pancartas) faltaba: se compraba y no se podía poner (tanda 3, 17/11/2026)
export const RANURAS = ['aro', 'deco', 'nom', 'carta', 'perfil', 'fp', 'fv', 'fe', 'fd', 'ff', 'fr'];
// `pronto`: se ve en la Tienda y no se vende todavía (lo que necesita algo que no está hecho: el cambio de nombre, la
// pancarta con tu texto). Se saca la marca del catálogo privado el día que funcione
export const MARCAS = ['prem', 'num', 'nav', 'rot', 'col', 'gratis', 'pronto'];
/** las tablas con `quien`: se mudan con la cuenta (`mudarCuenta()`) y se borran con «olvidarme» */
export const TABLAS_QUIEN = ['tienda_inv', 'tienda_deshecha', 'tienda_deseo', 'tienda_pref', 'tienda_puesto', 'tienda_col', 'tienda_num'];
const DIA_MS = 24 * 3600 * 1000;
const ID = /^[A-Z]{1,3}[0-9]{1,3}$/;
const QUIEN = /^[0-9]{5,25}$/;

const mal = (error, estado = 400, extra = {}) => Object.assign({ error, estado }, extra);
const filas = (o, sql, ...a) => o.sql.exec(sql, ...a).toArray();
const fila = (o, sql, ...a) => filas(o, sql, ...a)[0];
const num = (n) => Number(n).toLocaleString('es-AR');

export function tiendaTablas(sql) {
  // lo que tiene cada uno: de dónde vino, cuánto pagó (para deshacer y para la diferencia), si ya se lo puso y si vino
  // en una compra junta (`grupo`: la colección se deshace entera)
  sql.exec('CREATE TABLE IF NOT EXISTS tienda_inv (quien TEXT NOT NULL, pieza TEXT NOT NULL, origen TEXT NOT NULL, ' +
    "pagado INTEGER NOT NULL DEFAULT 0, t INTEGER NOT NULL, usada INTEGER NOT NULL DEFAULT 0, grupo TEXT NOT NULL DEFAULT '', " +
    'PRIMARY KEY (quien, pieza)) WITHOUT ROWID');
  // lo que ya se deshizo una vez: la segunda compra es definitiva
  sql.exec('CREATE TABLE IF NOT EXISTS tienda_deshecha (quien TEXT NOT NULL, pieza TEXT NOT NULL, t INTEGER NOT NULL, ' +
    'PRIMARY KEY (quien, pieza)) WITHOUT ROWID');
  sql.exec('CREATE TABLE IF NOT EXISTS tienda_puesto (quien TEXT NOT NULL, ranura TEXT NOT NULL, pieza TEXT NOT NULL, ' +
    't INTEGER NOT NULL, PRIMARY KEY (quien, ranura)) WITHOUT ROWID');
  sql.exec('CREATE TABLE IF NOT EXISTS tienda_deseo (quien TEXT NOT NULL, pieza TEXT NOT NULL, t INTEGER NOT NULL, ' +
    'PRIMARY KEY (quien, pieza)) WITHOUT ROWID');
  sql.exec('CREATE TABLE IF NOT EXISTS tienda_pref (quien TEXT PRIMARY KEY, deseo_publico INTEGER NOT NULL DEFAULT 0)');
  // los regalos: quién, a quién (su Discord ID y su perfil), qué piezas, cuánto se pagó, y cómo quedó
  sql.exec('CREATE TABLE IF NOT EXISTS tienda_regalo (id TEXT PRIMARY KEY, de TEXT NOT NULL, para TEXT NOT NULL, ' +
    "para_k TEXT NOT NULL, que TEXT NOT NULL, piezas TEXT NOT NULL, pagado INTEGER NOT NULL, msg INTEGER NOT NULL DEFAULT 0, " +
    "t INTEGER NOT NULL, fin INTEGER NOT NULL, estado TEXT NOT NULL DEFAULT 'pendiente', t_estado INTEGER NOT NULL DEFAULT 0)");
  sql.exec('CREATE INDEX IF NOT EXISTS tienda_regalo_de ON tienda_regalo (de, t)');
  sql.exec('CREATE INDEX IF NOT EXISTS tienda_regalo_para ON tienda_regalo (para, estado)');
  // las ediciones de 10: qué número tiene cada uno (la #1 es del campeón)
  sql.exec('CREATE TABLE IF NOT EXISTS tienda_num (pieza TEXT NOT NULL, numero INTEGER NOT NULL, quien TEXT NOT NULL, ' +
    't INTEGER NOT NULL, PRIMARY KEY (pieza, numero))');
  sql.exec('CREATE UNIQUE INDEX IF NOT EXISTS tienda_num_quien ON tienda_num (pieza, quien)');
  // las colecciones que completó cada uno (el premio se da una vez)
  sql.exec('CREATE TABLE IF NOT EXISTS tienda_col (quien TEXT NOT NULL, col TEXT NOT NULL, t INTEGER NOT NULL, ' +
    'PRIMARY KEY (quien, col)) WITHOUT ROWID');
}

// ── EL CATÁLOGO ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** El catálogo que se puede guardar, limpio, o `{error}`. Todo lo que el objeto cobra sale de acá, nunca de la página. */
export function catalogoValido(c) {
  if (!c || typeof c !== 'object') return mal('catalogo');
  const precios = c.precios;
  if (!Array.isArray(precios) || precios.length !== 6 || !precios.every((p) => Number.isInteger(p) && p > 0 && p <= 1e6)) return mal('precios');
  if (!c.piezas || typeof c.piezas !== 'object') return mal('piezas');
  const piezas = {};
  for (const [id, p] of Object.entries(c.piezas)) {
    if (!ID.test(id) || !p || !CATEGORIAS.includes(p.c) || !Number.isInteger(p.r) || p.r < 0 || p.r > 5) return mal('pieza', 400, { id });
    const t = Array.isArray(p.t) ? p.t.filter((x) => MARCAS.includes(x)) : [];
    piezas[id] = { c: p.c, r: p.r, t, n: String(p.n || id).slice(0, 40), d: String(p.d || '').slice(0, 200) };
  }
  const ids = (a) => Array.isArray(a) && a.every((x) => piezas[x]);
  const v = c.vitrina || {};
  if (!ids(v.ids) || v.ids.length > 12) return mal('vitrina');
  const colecciones = {};
  for (const [id, j] of Object.entries(c.colecciones || {})) {
    if (!ID.test(id) || !j || !ids(j.piezas) || j.piezas.length < 2 || j.piezas.length > 12) return mal('coleccion', 400, { id });
    if (j.premio && (!piezas[j.premio] || !piezas[j.premio].t.includes('col'))) return mal('premio', 400, { id });
    colecciones[id] = { n: String(j.n || id).slice(0, 40), d: String(j.d || '').slice(0, 200), piezas: j.piezas.slice(), premio: j.premio || '' };
  }
  const ediciones = {};
  for (const [id, e] of Object.entries(c.ediciones || {})) {
    if (!piezas[id] || !piezas[id].t.includes('num') || !Number.isInteger(e.copias) || e.copias < 2 || e.copias > 100) return mal('edicion', 400, { id });
    ediciones[id] = { venta: Number(e.venta) || 0, cierra: Number(e.cierra) || 0, copias: e.copias, nombre: String(e.nombre || '').slice(0, 60) };
  }
  const gratis = {};
  for (const [id, g] of Object.entries(c.gratis || {})) {
    if (!piezas[id]) return mal('gratis', 400, { id });
    gratis[id] = { desde: Number(g.desde) || 0, hasta: Number(g.hasta) || 0 };
  }
  const ventana = (w) => (w && typeof w === 'object' ? { desde: Number(w.desde) || 0, hasta: Number(w.hasta) || 0 } : null);
  const d = c.desc || {};
  const frac = (x, def) => (typeof x === 'number' && x > 0 && x <= 1 ? x : def);
  return {
    v: Number(c.v) || 1, abierta: c.abierta === true, temp: String(c.temp || '').slice(0, 10), precios: precios.slice(), piezas,
    vitrina: { ids: v.ids.slice(), hasta: Number(v.hasta) || 0 }, colecciones, ediciones, gratis, navidad: ventana(c.navidad),
    desc: { prem: frac(d.prem, 1), col: frac(d.col, 1), col_prem: frac(d.col_prem, 1) },
    regalos_semana: Number.isInteger(c.regalos_semana) ? c.regalos_semana : 0,
    regalo_dias: Number.isInteger(c.regalo_dias) ? c.regalo_dias : 14,
    deshacer_h: Number.isInteger(c.deshacer_h) ? c.deshacer_h : 24,
    baja_dias: Number.isInteger(c.baja_dias) ? c.baja_dias : 14,
  };
}
export const catalogo = (o) => o.leer('tienda_cat') || null;

/** El precio de una pieza para alguien (con su Premium o sin él). Las ediciones de 10 no tienen descuento. */
export function precioPieza(cat, id, prem, ahora = Date.now()) {
  const p = cat.piezas[id];
  if (!p) return null;
  const g = cat.gratis[id];
  if (g && ahora >= g.desde && ahora < g.hasta) return 0;
  const base = cat.precios[p.r];
  return prem && !p.t.includes('num') ? Math.round(base * cat.desc.prem) : base;
}
/** Lo que cuesta completar una colección para quien ya tiene `tiene` (un Set): lo que falta, con su descuento. */
export function precioColeccion(cat, col, tiene, prem) {
  const j = cat.colecciones[col];
  if (!j) return null;
  const falta = j.piezas.filter((x) => !tiene.has(x));
  const suma = falta.reduce((a, x) => a + cat.precios[cat.piezas[x].r], 0);
  return { falta, suma, precio: Math.round(suma * (prem ? cat.desc.col_prem : cat.desc.col) / 100) * 100 };
}
/** ¿Se puede comprar ahora? `''` o el porqué. Lo de rotación sólo en la vitrina; Navidad en su ventana; lo del premio
 *  de una colección nunca; las ediciones, en su venta. */
export function vendible(cat, id, ahora = Date.now()) {
  const p = cat.piezas[id];
  if (!p) return 'no_existe';
  if (p.t.includes('pronto')) return 'pronto';
  if (p.t.includes('col')) return 'premio';
  if (p.t.includes('rot') && !cat.vitrina.ids.includes(id)) return 'no_esta';
  if (p.t.includes('nav') && cat.navidad && !(ahora >= cat.navidad.desde && ahora < cat.navidad.hasta)) return 'fuera_de_fecha';
  if (p.t.includes('gratis') || cat.gratis[id]) {
    const g = cat.gratis[id];
    if (g && !(ahora >= g.desde && ahora < g.hasta)) return 'fuera_de_fecha';
  }
  if (p.t.includes('num')) {
    const e = cat.ediciones[id];
    if (!e) return 'no_esta';
    if (ahora < e.venta) return 'todavia_no';
    if (e.cierra && ahora >= e.cierra) return 'cerrada';
  }
  return '';
}
const noSeRegala = (cat, id) => {
  const p = cat.piezas[id];
  return !p || p.c === 'serv' || p.t.some((x) => ['num', 'prem', 'col', 'gratis'].includes(x)) || !!cat.gratis[id];
};

// ── LO DE CADA UNO ──────────────────────────────────────────────────────────────────────────────────────────────────
const tieneSet = (o, quien) => new Set(filas(o, 'SELECT pieza FROM tienda_inv WHERE quien = ?', quien).map((r) => r.pieza));
function esPremium(o, quien, cat, ahora) {
  if (!cat.temp) return false;
  const r = o.pasePremium(quien, cat.temp);
  return !!(r && ahora >= r[0] && (r[1] == null || ahora < r[1]));
}
function jugo(o, quien, cat) {
  try { return !!fila(o, 'SELECT 1 AS x FROM jugo_temp WHERE quien = ? AND temp = ? AND eventos > 0', quien, cat.temp); } catch (e) { return false; }
}
function saldoDe(o, d) {
  const ini = Number(d.inicial);
  if (!Number.isInteger(ini)) return null;
  return o.saldo(String(d.quien), Number(d.desde) || 0, ini);
}
/** 💸 un movimiento de la billetera. `id` lleva el Discord ID adentro (lo cambia `mudarCuenta()`) */
const mover = (o, id, quien, monto, ahora) => {
  if (monto) o.sql.exec('INSERT OR REPLACE INTO tienda (id, ref, quien, monto, t) VALUES (?, 0, ?, ?, ?)', id, quien, monto, ahora);
};
const dar = (o, quien, pieza, origen, pagado, ahora, grupo = '') =>
  o.sql.exec('INSERT OR IGNORE INTO tienda_inv (quien, pieza, origen, pagado, t, grupo) VALUES (?, ?, ?, ?, ?, ?)', quien, pieza, origen, pagado, ahora, grupo);

/** Las colecciones que `quien` acaba de completar: se anotan una vez, con su premio y su aviso */
function revisarColecciones(o, quien, cat, ahora) {
  const tiene = tieneSet(o, quien), hechas = [];
  for (const [id, j] of Object.entries(cat.colecciones)) {
    if (!j.piezas.every((x) => tiene.has(x))) continue;
    if (fila(o, 'SELECT 1 AS x FROM tienda_col WHERE quien = ? AND col = ?', quien, id)) continue;
    o.sql.exec('INSERT INTO tienda_col (quien, col, t) VALUES (?, ?, ?)', quien, id, ahora);
    if (j.premio) dar(o, quien, j.premio, 'coleccion', 0, ahora);
    o.aBandeja(quien, 'tcol:' + id, 'tienda', '🏅 Completaste «' + j.n + '»', 'Te llevas su insignia para tu perfil y su pieza exclusiva, que no se vende.', '#/tienda', '', ahora);
    hechas.push(id);
  }
  return hechas;
}

/** Los regalos que pasaron sus días sin respuesta: vuelven los Puntos a quien los mandó. Pocos por vez. */
export function vencerRegalos(o, ahora = Date.now()) {
  const vencidos = filas(o, "SELECT * FROM tienda_regalo WHERE estado = 'pendiente' AND fin <= ? LIMIT 50", ahora);
  for (const r of vencidos) {
    o.state.storage.transactionSync(() => {
      o.sql.exec("UPDATE tienda_regalo SET estado = 'vencido', t_estado = ? WHERE id = ?", ahora, r.id);
      mover(o, 'tregalo-vuelve:' + r.de + ':' + r.id, r.de, r.pagado, ahora);
    });
    o.aBandeja(r.de, 'tregalo-r:' + r.id, 'tienda', 'Tu regalo volvió', 'No lo aceptaron a tiempo: te volvieron ' + num(r.pagado) + ' Puntos.', '#/tienda', '', ahora);
  }
  return vencidos.length;
}

/** `/avisos/tienda`: el catálogo (sin precios inventados: los del objeto) y lo tuyo. Cerrada, sólo el dueño la ve. */
export function tiendaMia(o, d, H) {
  const ahora = Date.now();
  const cat = catalogo(o);
  const quien = String(d.quien || '');
  const dueno = quien === H.DUENO;
  if (!cat || (!cat.abierta && !dueno)) return { ok: true, abierta: false };
  vencerRegalos(o, ahora);
  const out = { ok: true, abierta: cat.abierta, ensayo: !cat.abierta && dueno, cat: publico(o, cat), ahora, arte_v: o.leer('tienda_arte_v') || '' };
  if (!QUIEN.test(quien)) return out;
  const prem = esPremium(o, quien, cat, ahora);
  const inv = filas(o, 'SELECT pieza, origen, pagado, t, usada, grupo FROM tienda_inv WHERE quien = ? ORDER BY t', quien);
  const desh = new Set(filas(o, 'SELECT pieza FROM tienda_deshecha WHERE quien = ?', quien).map((r) => r.pieza));
  const tiene = new Set(inv.map((r) => r.pieza));
  const cols = {};
  for (const [id, j] of Object.entries(cat.colecciones)) {
    const r = precioColeccion(cat, id, tiene, prem);
    cols[id] = { tiene: j.piezas.length - r.falta.length, precio: r.precio, completa: !!fila(o, 'SELECT 1 AS x FROM tienda_col WHERE quien = ? AND col = ?', quien, id) };
  }
  const semana = H.rangoDiaET(H.semanaDeDia(H.diaET(ahora))[0])[0];
  const enviados = Number((fila(o, 'SELECT COUNT(*) AS n FROM tienda_regalo WHERE de = ? AND t >= ?', quien, semana) || {}).n) || 0;
  const pref = fila(o, 'SELECT deseo_publico FROM tienda_pref WHERE quien = ?', quien);
  out.yo = {
    saldo: saldoDe(o, d), prem, jugo: jugo(o, quien, cat), verificado: !!d.de,
    inv: inv.map((r) => ({ p: r.pieza, o: r.origen, pagado: r.pagado, t: r.t, usada: !!r.usada,
      deshacer: r.origen === 'compra' && !r.usada && !desh.has(r.pieza) && r.pagado > 0 && ahora - r.t < cat.deshacer_h * 3600000 })),
    puesto: Object.fromEntries(filas(o, 'SELECT ranura, pieza FROM tienda_puesto WHERE quien = ?', quien).map((r) => [r.ranura, r.pieza])),
    deseos: filas(o, 'SELECT pieza FROM tienda_deseo WHERE quien = ? ORDER BY t', quien).map((r) => r.pieza),
    deseo_publico: !!(pref && pref.deseo_publico),
    colecciones: cols,
    numeros: Object.fromEntries(filas(o, 'SELECT pieza, numero FROM tienda_num WHERE quien = ?', quien).map((r) => [r.pieza, r.numero])),
    regalos_quedan: Math.max(0, cat.regalos_semana - enviados),
    regalos: filas(o, "SELECT id, de, que, piezas, msg, t, fin FROM tienda_regalo WHERE para = ? AND estado = 'pendiente' ORDER BY t", quien)
      .map((r) => ({ id: r.id, que: r.que, piezas: JSON.parse(r.piezas), msg: MENSAJES[r.msg] || '', t: r.t, fin: r.fin, de: o.claveDe(r.de) || '' })),
  };
  return out;
}
/** Lo del catálogo que ve la página: las piezas, los precios, la vitrina, las colecciones y las ediciones con sus dueños */
function publico(o, cat) {
  const ediciones = {};
  for (const [id, e] of Object.entries(cat.ediciones)) {
    const ds = filas(o, 'SELECT numero, quien FROM tienda_num WHERE pieza = ? ORDER BY numero', id)
      .map((r) => [r.numero, o.claveDe(r.quien) || '']);
    ediciones[id] = Object.assign({}, e, { duenos: ds });
  }
  return { temp: cat.temp, precios: cat.precios, piezas: cat.piezas, vitrina: cat.vitrina, colecciones: cat.colecciones, ediciones,
    gratis: cat.gratis, navidad: cat.navidad, desc: cat.desc, regalos_semana: cat.regalos_semana, deshacer_h: cat.deshacer_h };
}

// ── LAS ACCIONES ────────────────────────────────────────────────────────────────────────────────────────────────────
/** `/avisos/tienda-accion`: comprar, deshacer, ponerse, regalar, responder un regalo, la lista y el drop del día. */
export function tiendaAccion(o, d, H) {
  const ahora = Date.now();
  const quien = String(d.quien || ''), k = String(d.de || '');
  if (!QUIEN.test(quien)) return mal('faltan datos');
  const cat = catalogo(o);
  const dueno = quien === H.DUENO;
  if (!cat || (!cat.abierta && !dueno)) return mal('cerrada', 404);
  if (!k && !dueno) return mal('verificate', 403);
  vencerRegalos(o, ahora);
  const a = String(d.accion || '');
  const prem = esPremium(o, quien, cat, ahora);
  const tiene = tieneSet(o, quien);

  if (a === 'comprar' || a === 'comprar-col' || a === 'comprar-puesto') {
    // qué se compra y cuánto cuesta, todo calculado acá
    let lineas = [];   // [pieza, precio, grupo]
    if (a === 'comprar') {
      const id = String(d.pieza || '');
      const no = vendible(cat, id, ahora);
      if (no) return mal(no);
      if (tiene.has(id)) return mal('ya_la_tienes');
      const p = cat.piezas[id];
      if (p.t.includes('prem') && !prem) return mal('premium', 403);
      if (p.t.includes('num')) return comprarNumerada(o, d, cat, id, ahora, H);
      lineas = [[id, precioPieza(cat, id, prem, ahora), '']];
    } else if (a === 'comprar-col') {
      const id = String(d.col || '');
      const r = precioColeccion(cat, id, tiene, prem);
      if (!r) return mal('no_existe');
      if (!r.falta.length) return mal('ya_la_tienes');
      for (const x of r.falta) { const no = vendible(cat, x, ahora); if (no) return mal(no, 400, { pieza: x }); }
      lineas = repartir(cat, r.falta, r.precio, 'tcol:' + id + ':' + ahora);
    } else {
      // lo que te estás probando: si completa una colección, esa parte se cobra como colección
      const ids = Array.isArray(d.piezas) ? [...new Set(d.piezas.map(String))].slice(0, 12) : [];
      if (!ids.length) return mal('faltan datos');
      for (const x of ids) {
        const no = vendible(cat, x, ahora);
        if (no) return mal(no, 400, { pieza: x });
        if (tiene.has(x)) return mal('ya_la_tienes', 400, { pieza: x });
        if (cat.piezas[x].t.includes('num')) return mal('numerada', 400, { pieza: x });
        if (cat.piezas[x].t.includes('prem') && !prem) return mal('premium', 403, { pieza: x });
      }
      let sueltas = ids.slice();
      for (const [cid, j] of Object.entries(cat.colecciones)) {
        if (!j.piezas.every((x) => tiene.has(x) || ids.includes(x)) || !j.piezas.some((x) => sueltas.includes(x))) continue;
        const r = precioColeccion(cat, cid, tiene, prem);
        lineas.push(...repartir(cat, r.falta, r.precio, 'tcol:' + cid + ':' + ahora));
        sueltas = sueltas.filter((x) => !j.piezas.includes(x));
      }
      for (const x of sueltas) lineas.push([x, precioPieza(cat, x, prem, ahora), '']);
    }
    const total = lineas.reduce((s, l) => s + l[1], 0);
    const saldo = saldoDe(o, d);
    if (saldo === null) return mal('todavia', 503);
    if (total > saldo) return mal('saldo', 409, { saldo, precio: total });
    const poner = a === 'comprar-puesto' || d.poner === true;
    let hechas = [];
    o.state.storage.transactionSync(() => {
      for (const [x, pr, g] of lineas) {
        dar(o, quien, x, 'compra', pr, ahora, g);
        mover(o, 'tcompra:' + quien + ':' + x + ':' + ahora, quien, -pr, ahora);
        o.sql.exec('DELETE FROM tienda_deseo WHERE quien = ? AND pieza = ?', quien, x);
        if (poner) ponerUna(o, quien, cat, x, ahora);
      }
      hechas = revisarColecciones(o, quien, cat, ahora);
    });
    return { ok: true, piezas: lineas.map((l) => l[0]), total, saldo: saldo - total, colecciones: hechas };
  }

  if (a === 'deshacer') {
    const id = String(d.pieza || '');
    const r = fila(o, 'SELECT * FROM tienda_inv WHERE quien = ? AND pieza = ?', quien, id);
    if (!r || r.origen !== 'compra' || r.pagado <= 0) return mal('no_se_puede');
    // una colección comprada junta se deshace entera, y sólo si no te pusiste ninguna de sus piezas
    const grupo = r.grupo ? filas(o, 'SELECT * FROM tienda_inv WHERE quien = ? AND grupo = ?', quien, r.grupo) : [r];
    for (const g of grupo) {
      if (g.usada) return mal('usada');
      if (ahora - g.t >= cat.deshacer_h * 3600000) return mal('tarde');
      if (fila(o, 'SELECT 1 AS x FROM tienda_deshecha WHERE quien = ? AND pieza = ?', quien, g.pieza)) return mal('ya_deshecha');
    }
    const vuelve = grupo.reduce((s, g) => s + g.pagado, 0);
    o.state.storage.transactionSync(() => {
      for (const g of grupo) {
        o.sql.exec('DELETE FROM tienda_inv WHERE quien = ? AND pieza = ?', quien, g.pieza);
        o.sql.exec('INSERT OR REPLACE INTO tienda_deshecha (quien, pieza, t) VALUES (?, ?, ?)', quien, g.pieza, ahora);
        o.sql.exec('DELETE FROM tienda_puesto WHERE quien = ? AND pieza = ?', quien, g.pieza);
      }
      mover(o, 'tdeshacer:' + quien + ':' + (r.grupo || id) + ':' + ahora, quien, vuelve, ahora);
      // si esa compra completó una colección, el premio se va con ella (todavía no se pudo usar)
      for (const [cid, j] of Object.entries(cat.colecciones)) {
        if (!grupo.some((g) => j.piezas.includes(g.pieza))) continue;
        if (!fila(o, 'SELECT 1 AS x FROM tienda_col WHERE quien = ? AND col = ?', quien, cid)) continue;
        o.sql.exec('DELETE FROM tienda_col WHERE quien = ? AND col = ?', quien, cid);
        if (j.premio) {
          o.sql.exec("DELETE FROM tienda_inv WHERE quien = ? AND pieza = ? AND origen = 'coleccion'", quien, j.premio);
          o.sql.exec('DELETE FROM tienda_puesto WHERE quien = ? AND pieza = ?', quien, j.premio);
        }
      }
    });
    return { ok: true, vuelve, piezas: grupo.map((g) => g.pieza) };
  }

  if (a === 'poner') {
    const ranura = String(d.ranura || ''), id = d.pieza == null ? '' : String(d.pieza);
    if (!RANURAS.includes(ranura)) return mal('ranura');
    if (!id) { o.sql.exec('DELETE FROM tienda_puesto WHERE quien = ? AND ranura = ?', quien, ranura); return { ok: true }; }
    if (!tiene.has(id)) return mal('no_la_tienes');
    if (cat.piezas[id].c !== ranura) return mal('ranura');
    o.state.storage.transactionSync(() => ponerUna(o, quien, cat, id, ahora));
    return { ok: true };
  }

  if (a === 'regalar') return regalar(o, d, cat, prem, ahora, H);
  if (a === 'regalo') return responderRegalo(o, d, cat, ahora);

  if (a === 'deseo') {
    const id = String(d.pieza || '');
    if (!cat.piezas[id]) return mal('no_existe');
    if (d.si === false) o.sql.exec('DELETE FROM tienda_deseo WHERE quien = ? AND pieza = ?', quien, id);
    else {
      const n = Number((fila(o, 'SELECT COUNT(*) AS n FROM tienda_deseo WHERE quien = ?', quien) || {}).n) || 0;
      if (n >= 60) return mal('lista_llena');
      o.sql.exec('INSERT OR IGNORE INTO tienda_deseo (quien, pieza, t) VALUES (?, ?, ?)', quien, id, ahora);
    }
    return { ok: true };
  }
  if (a === 'deseo-publico') {
    o.sql.exec('INSERT OR REPLACE INTO tienda_pref (quien, deseo_publico) VALUES (?, ?)', quien, d.si ? 1 : 0);
    return { ok: true };
  }

  // 🐉 el drop del día: gratis, uno por día (a la medianoche, hora del este), con las chances de los Dragón Drops. Como
  // el del Pase, para los Miembros de DRA. No se compra: la Tienda sigue sin azar en lo que vende
  if (a === 'drop') {
    const P = o.paseDatos();
    if (!P.miembros.has(quien) && !dueno) return mal('no_miembro', 403);
    const origen = 'tdia:' + H.diaET(ahora);
    const ya = fila(o, 'SELECT id, abierto FROM drops WHERE quien = ? AND origen = ?', quien, origen);
    if (ya && ya.abierto) return mal('ya', 409);
    if (!ya) o.dropDar(quien, origen, 0);
    const f = fila(o, 'SELECT id FROM drops WHERE quien = ? AND origen = ?', quien, origen);
    if (!f) return mal('no_existe');
    const r = o.dropAbrir(quien, f.id);
    return r.error ? mal(r.error) : Object.assign({ ok: true }, r);
  }

  // 🏆 la #1 de una edición, para el campeón: la da el dueño
  if (a === 'num-campeon') {
    if (!dueno) return mal('no', 403);
    const id = String(d.pieza || ''), para = String(d.para || '');
    if (!cat.ediciones[id] || !QUIEN.test(para)) return mal('faltan datos');
    if (fila(o, 'SELECT 1 AS x FROM tienda_num WHERE pieza = ? AND numero = 1', id)) return mal('ya');
    o.state.storage.transactionSync(() => {
      o.sql.exec('INSERT INTO tienda_num (pieza, numero, quien, t) VALUES (?, 1, ?, ?)', id, para, ahora);
      dar(o, para, id, 'campeon', 0, ahora);
    });
    o.aBandeja(para, 'tnum:' + id, 'tienda', '🏆 La #1 es tuya', 'Por campeón: la #1 de la edición de 10 ya está en tu Inventario.', '#/tienda', '', ahora);
    return { ok: true };
  }
  return mal('accion');
}

/** Reparte el precio de una compra junta entre sus piezas (para deshacer y para la diferencia), sumando justo. */
function repartir(cat, piezas, precio, grupo) {
  const base = piezas.map((x) => cat.precios[cat.piezas[x].r]);
  const suma = base.reduce((a, b) => a + b, 0) || 1;
  const out = piezas.map((x, i) => [x, Math.floor(precio * base[i] / suma), grupo]);
  out[0][1] += precio - out.reduce((a, l) => a + l[1], 0);
  return out;
}
/** Ponerse una pieza: queda en su ranura y ya no se puede deshacer («usar» es ponérsela, aunque sea sólo en la página) */
function ponerUna(o, quien, cat, id, ahora) {
  const c = cat.piezas[id].c;
  if (!RANURAS.includes(c)) return;
  o.sql.exec('INSERT OR REPLACE INTO tienda_puesto (quien, ranura, pieza, t) VALUES (?, ?, ?, ?)', quien, c, id, ahora);
  o.sql.exec('UPDATE tienda_inv SET usada = 1 WHERE quien = ? AND pieza = ?', quien, id);
}

/** Las ediciones de 10: una por persona, para quien jugó en la temporada; el número más bajo libre (la #1 es del campeón) */
function comprarNumerada(o, d, cat, id, ahora, H) {
  const quien = String(d.quien);
  const e = cat.ediciones[id];
  if (!jugo(o, quien, cat) && quien !== H.DUENO) return mal('no_jugaste', 403);
  if (fila(o, 'SELECT 1 AS x FROM tienda_num WHERE pieza = ? AND quien = ?', id, quien)) return mal('ya_la_tienes');
  const usados = new Set(filas(o, 'SELECT numero FROM tienda_num WHERE pieza = ?', id).map((r) => r.numero));
  let n = 0;
  for (let i = 2; i <= e.copias; i++) if (!usados.has(i)) { n = i; break; }
  if (!n) return mal('agotada', 409);
  const precio = precioPieza(cat, id, false, ahora);
  const saldo = saldoDe(o, d);
  if (saldo === null) return mal('todavia', 503);
  if (precio > saldo) return mal('saldo', 409, { saldo, precio });
  o.state.storage.transactionSync(() => {
    o.sql.exec('INSERT INTO tienda_num (pieza, numero, quien, t) VALUES (?, ?, ?, ?)', id, n, quien, ahora);
    // las numeradas no se deshacen: con deshacer, alguien podría guardarse una copia 24 horas sin decidirse
    dar(o, quien, id, 'numerada', precio, ahora);
    mover(o, 'tcompra:' + quien + ':' + id + ':' + ahora, quien, -precio, ahora);
    o.sql.exec('DELETE FROM tienda_deseo WHERE quien = ? AND pieza = ?', quien, id);
  });
  return { ok: true, piezas: [id], numero: n, total: precio, saldo: saldo - precio };
}

/** Regalar una pieza o una colección (lo que le falta a quien la recibe). Le llega a la campana; la acepta o la rechaza. */
function regalar(o, d, cat, prem, ahora, H) {
  const quien = String(d.quien);
  const para_k = String(d.para || '');
  if (!H.claveValida(para_k) || para_k === String(d.de || '')) return mal('para');
  const quienes = o.quienesDeClave(para_k);
  if (!quienes.length) return mal('no_verificado', 400);
  if (quienes.includes(quien)) return mal('para');
  if (!jugo(o, quien, cat) && quien !== H.DUENO) return mal('no_jugaste', 403);
  const semana = H.rangoDiaET(H.semanaDeDia(H.diaET(ahora))[0])[0];
  const enviados = Number((fila(o, 'SELECT COUNT(*) AS n FROM tienda_regalo WHERE de = ? AND t >= ?', quien, semana) || {}).n) || 0;
  if (enviados >= cat.regalos_semana) return mal('tope', 429, { tope: cat.regalos_semana });
  const suyo = new Set();
  for (const q of quienes) for (const x of tieneSet(o, q)) suyo.add(x);
  let piezas, precio, que;
  if (d.col) {
    que = 'col:' + String(d.col);
    const r = precioColeccion(cat, String(d.col), suyo, prem);
    if (!r) return mal('no_existe');
    if (!r.falta.length) return mal('ya_lo_tiene');
    for (const x of r.falta) { const no = vendible(cat, x, ahora) || (noSeRegala(cat, x) ? 'no_se_regala' : ''); if (no) return mal(no, 400, { pieza: x }); }
    piezas = r.falta; precio = r.precio;
  } else {
    const id = String(d.pieza || '');
    que = id;
    const no = vendible(cat, id, ahora);
    if (no) return mal(no);
    if (noSeRegala(cat, id)) return mal('no_se_regala');
    if (suyo.has(id)) return mal('ya_lo_tiene');
    piezas = [id]; precio = precioPieza(cat, id, prem, ahora);
  }
  const saldo = saldoDe(o, d);
  if (saldo === null) return mal('todavia', 503);
  if (precio > saldo) return mal('saldo', 409, { saldo, precio });
  const msg = Number.isInteger(d.msg) && d.msg >= 0 && d.msg < MENSAJES.length ? d.msg : 0;
  const id = 'r' + ahora.toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  const para = quienes[0];
  o.state.storage.transactionSync(() => {
    o.sql.exec('INSERT INTO tienda_regalo (id, de, para, para_k, que, piezas, pagado, msg, t, fin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, quien, para, para_k, que, JSON.stringify(piezas), precio, msg, ahora, ahora + cat.regalo_dias * DIA_MS);
    mover(o, 'tregalo:' + quien + ':' + id, quien, -precio, ahora);
  });
  const de = o.claveDe(quien) || 'Alguien';
  o.aBandeja(para, 'tregalo:' + id, 'tienda', '🎁 ' + de + ' te mandó un regalo', (MENSAJES[msg] ? '«' + MENSAJES[msg] + '» · ' : '') +
    'Acéptalo o recházalo en la Tienda: tienes ' + cat.regalo_dias + ' días.', '#/tienda', '', ahora);
  return { ok: true, id, total: precio, saldo: saldo - precio, quedan: cat.regalos_semana - enviados - 1 };
}
function responderRegalo(o, d, cat, ahora) {
  const quien = String(d.quien);
  const r = fila(o, "SELECT * FROM tienda_regalo WHERE id = ? AND estado = 'pendiente'", String(d.id || ''));
  if (!r || r.para !== quien) return mal('no_existe', 404);
  const piezas = JSON.parse(r.piezas);
  if (d.si) {
    // lo que ya tenía cuando lo acepta (lo compró en el medio) le vuelve a quien regaló, en proporción
    const tiene = tieneSet(o, quien);
    const base = piezas.map((x) => cat.precios[(cat.piezas[x] || { r: 0 }).r]);
    const suma = base.reduce((a, b) => a + b, 0) || 1;
    const vuelve = Math.round(piezas.reduce((s, x, i) => s + (tiene.has(x) ? r.pagado * base[i] / suma : 0), 0));
    let hechas = [];
    o.state.storage.transactionSync(() => {
      o.sql.exec("UPDATE tienda_regalo SET estado = 'aceptado', t_estado = ? WHERE id = ?", ahora, r.id);
      for (const x of piezas) dar(o, quien, x, 'regalo', 0, ahora);
      if (vuelve) mover(o, 'tregalo-vuelve:' + r.de + ':' + r.id, r.de, vuelve, ahora);
      hechas = revisarColecciones(o, quien, cat, ahora);
    });
    o.aBandeja(r.de, 'tregalo-r:' + r.id, 'tienda', '🎁 Aceptaron tu regalo', (o.claveDe(quien) || 'Lo') + ' ya lo tiene en su Inventario.', '#/tienda', '', ahora);
    return { ok: true, piezas, colecciones: hechas };
  }
  o.state.storage.transactionSync(() => {
    o.sql.exec("UPDATE tienda_regalo SET estado = 'rechazado', t_estado = ? WHERE id = ?", ahora, r.id);
    mover(o, 'tregalo-vuelve:' + r.de + ':' + r.id, r.de, r.pagado, ahora);
  });
  o.aBandeja(r.de, 'tregalo-r:' + r.id, 'tienda', 'Tu regalo volvió', 'No lo aceptaron: te volvieron ' + num(r.pagado) + ' Puntos.', '#/tienda', '', ahora);
  return { ok: true };
}

// ── CARGAR EL CATÁLOGO (la clave del ciclo, desde `bot/tienda_subir.py`) ─────────────────────────────────────────────
/**
 * Guarda el catálogo nuevo. Los precios nunca suben: si una pieza baja, quien la compró en los últimos `baja_dias` días
 * recibe la diferencia (en proporción a lo que pagó). Y la lista de deseos avisa lo que entra en la vitrina o baja.
 */
export function catalogoGuardar(o, d) {
  const nuevo = catalogoValido(d && d.catalogo);
  if (nuevo.error) return nuevo;
  const viejo = catalogo(o);
  const ahora = Date.now();
  const sube = [], baja = [];
  if (viejo) {
    for (const [id, p] of Object.entries(nuevo.piezas)) {
      const pv = viejo.piezas[id];
      if (!pv) continue;
      const a = viejo.precios[pv.r], b = nuevo.precios[p.r];
      if (b > a) sube.push(id); else if (b < a) baja.push([id, a, b]);
    }
    if (sube.length && !d.forzar) return mal('sube', 409, { piezas: sube });
  }
  o.guardar('tienda_cat', nuevo);
  let devueltos = 0, avisos = 0;
  for (const [id, a, b] of baja) {
    const compras = filas(o, "SELECT quien, pagado, t FROM tienda_inv WHERE pieza = ? AND origen = 'compra' AND t >= ? AND pagado > 0",
      id, ahora - nuevo.baja_dias * DIA_MS);
    for (const c of compras) {
      const dif = Math.round(c.pagado * (a - b) / a);
      if (!dif) continue;
      mover(o, 'tbaja:' + c.quien + ':' + id + ':' + ahora, c.quien, dif, ahora);
      o.aBandeja(c.quien, 'tbaja:' + id, 'tienda', 'Bajó de precio algo que compraste', 'Te devolvimos ' + num(dif) + ' Puntos.', '#/tienda', '', ahora);
      devueltos++;
    }
  }
  // la lista de deseos: lo que entra en la vitrina y lo que baja, una vez por pieza y por semana de vitrina
  const entra = viejo ? nuevo.vitrina.ids.filter((x) => !viejo.vitrina.ids.includes(x)) : nuevo.vitrina.ids;
  // y lo que salía «pronto» y ya se vende (la ficha promete que la campana avisa)
  const sale = viejo ? Object.keys(nuevo.piezas).filter((x) => viejo.piezas[x] && viejo.piezas[x].t.includes('pronto') && !nuevo.piezas[x].t.includes('pronto')) : [];
  const avisar = [...new Set([...entra, ...baja.map((x) => x[0]), ...sale])];
  if (nuevo.abierta && avisar.length) {
    for (const r of filas(o, 'SELECT quien, pieza FROM tienda_deseo WHERE pieza IN (' + avisar.map(() => '?').join(',') + ') LIMIT 2000', ...avisar)) {
      const enVit = entra.includes(r.pieza), yaSale = sale.includes(r.pieza);
      o.aBandeja(r.quien, 'tdeseo:' + r.pieza + ':' + (yaSale ? 'sale' : nuevo.vitrina.hasta), 'tienda',
        yaSale ? '♥ Algo de tu lista ya se vende' : enVit ? '♥ Algo de tu lista está en la vitrina' : '♥ Algo de tu lista bajó de precio',
        yaSale ? 'Ya está a la venta en la Tienda.' : enVit ? 'Pasa por la Tienda antes de que cambie el lunes.' : 'Mira el precio nuevo en la Tienda.', '#/tienda', '', ahora);
      avisos++;
    }
  }
  return { ok: true, piezas: Object.keys(nuevo.piezas).length, abierta: nuevo.abierta, devueltos, avisos };
}

// ── EL ARTE (lo que se ve de cada pieza) ────────────────────────────────────────────────────────────────────────────
// Tampoco vive en el repo: son MOLDES de HTML ya dibujados (los arma el archivo privado), con tres huecos que la página
// llena —__FOTO__, __CARTA__ y __N__— porque la página no puede ejecutar código que llegue del servidor (CSP
// `script-src 'self'`). Sus clases llevan `ta-` y su CSS va debajo de `.ta-raiz`: no choca con las de la página.
/** Guarda el arte (`bot/tienda_subir.py --arte`, con la clave del ciclo). La versión va aparte: se mira en cada pedido. */
export function arteGuardar(o, d) {
  const a = d && d.arte;
  if (!a || typeof a !== 'object' || typeof a.css !== 'string' || !a.p || typeof a.p !== 'object' || !/^[0-9a-f]{6,40}$/.test(String(a.v || ''))) return mal('arte');
  for (const [id, x] of Object.entries(a.p)) if (!ID.test(id) || !x || typeof x.v !== 'string') return mal('arte', 400, { id });
  o.guardar('tienda_arte', { v: a.v, css: a.css, p: a.p });
  o.guardar('tienda_arte_v', a.v);
  o.guardar('tienda_uso', arteLiviano(a));
  return { ok: true, v: a.v, piezas: Object.keys(a.p).length };
}
// 👀 LO QUE SE PONE, EN TODA LA PÁGINA (tanda 3, 17/11/2026): cada página dibuja el aro, el nombre, la carta, la capa del
// perfil y los fondos de quien los tiene puestos, así que necesita el arte —pero no las vistas previas de la Tienda (`v`,
// `lugar`), que son casi todo el peso—. Se arma una vez al guardar y sale por `/avisos/tienda-uso`, guardada en el borde
const USO = ['aro', 'deco', 'nom', 'letras', 'carta', 'capa', 'fondo'];
function arteLiviano(a) {
  const p = {};
  for (const [id, x] of Object.entries(a.p || {})) {
    const y = {};
    for (const c of USO) if (x[c]) y[c] = x[c];
    if (Object.keys(y).length) p[id] = y;
  }
  return { v: a.v, css: a.css, p };
}
/** El arte liviano, abierta la Tienda: para cualquiera (es lo que ya se ve en ella) */
export function arteUso(o) {
  const cat = catalogo(o);
  if (!cat || !cat.abierta) return mal('cerrada', 404);
  let u = o.leer('tienda_uso');
  if (!u) { const a = o.leer('tienda_arte'); if (!a) return mal('sin_arte', 404); u = arteLiviano(a); o.guardar('tienda_uso', u); }
  return Object.assign({ ok: true }, u);
}
/**
 * Qué tiene puesto cada perfil: `{clave: {ranura: pieza}}`, para `/avisos/pases`. Por clave, NUNCA por cuenta (quien no
 * tiene perfil no sale). Sólo con la Tienda abierta, y sólo lo que sigue en el catálogo
 */
export function puestosPublicos(o) {
  const cat = catalogo(o);
  if (!cat || !cat.abierta) return {};
  const out = {};
  for (const r of filas(o, 'SELECT quien, ranura, pieza FROM tienda_puesto')) {
    if (!cat.piezas[r.pieza]) continue;
    const k = o.claveDe(r.quien);
    if (k) (out[k] = out[k] || {})[r.ranura] = r.pieza;
  }
  return out;
}
/** El arte para la página: abierta, a cualquiera; cerrada, sólo al dueño. Si ya tiene esa versión, no se manda de nuevo. */
export function arteMio(o, d, H) {
  const cat = catalogo(o);
  if (!cat || (!cat.abierta && String(d.quien || '') !== H.DUENO)) return mal('cerrada', 404);
  const v = o.leer('tienda_arte_v');
  if (!v) return mal('sin_arte', 404);
  if (d.v && d.v === v) return { ok: true, v, igual: true };
  return Object.assign({ ok: true }, o.leer('tienda_arte'));
}

// ── MUDARSE Y OLVIDARSE ─────────────────────────────────────────────────────────────────────────────────────────────
/** Lo de la Tienda que no tiene `quien` (los regalos), a la cuenta nueva. Lo demás se muda en la lista de `mudarCuenta()`. */
export function tiendaMudar(o, viejo, nuevo) {
  o.sql.exec('UPDATE tienda_regalo SET de = ? WHERE de = ?', nuevo, viejo);
  o.sql.exec('UPDATE tienda_regalo SET para = ? WHERE para = ?', nuevo, viejo);
}
/** «Olvidarme»: lo suyo de la Tienda. Las ediciones que tenía vuelven a quedar libres (su número no se reasigna). */
export function tiendaOlvidar(o, quien) {
  for (const t of TABLAS_QUIEN) { try { o.sql.exec(`DELETE FROM ${t} WHERE quien = ?`, quien); } catch (e) { /* sigue */ } }
  try { o.sql.exec('DELETE FROM tienda_regalo WHERE de = ? OR para = ?', quien, quien); } catch (e) { /* sigue */ }
}
