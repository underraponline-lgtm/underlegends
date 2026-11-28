// 📬 EL BUZÓN EN HILOS PRIVADOS DE DRA (28/11/2026, paso 9 del plan del sábado). La idea es de Dlx: lo de cada uno —un
// drop para abrir, su tarjeta, su rango, «te retaron»…— llega también a Discord, SIN DM.
//
// LO DECIDIDO, Y POR QUÉ ASÍ:
//   · 🔴 NUNCA POR DM (herramientas/sin_dm.py lo vigila en CI): un HILO PRIVADO (tipo 12, `invitable: false`) en
//     #conversacion de DRA (`CANAL`), donde sólo está esa persona —y los moderadores, que ven todos los hilos—.
//   · UNA SOLA CAMPANA: el buzón NO tiene avisos propios. Lee la `bandeja` del objeto —la misma de la campana de la
//     página (`aBandeja()` / `bandeja()` de bot/avisos.js)—, así un aviso existe una vez y se ve en los dos lados:
//       - lo que ya se vio en la página (`visto = 1`) no sale en Discord;
//       - lo que salió en Discord no vuelve a salir (`buzon_enviado`, con la hora de cada aviso)… salvo que la campana
//         lo vuelva a marcar como NUEVO: `aBandeja()` pisa la misma clave para el paso siguiente (el Nivel 7 del Pase
//         es la fila del Nivel 6), y lo que la página muestra como nuevo el hilo también, en el próximo de las 24 h;
//       - «✔️ Ya lo vi» en el hilo lo marca visto también en la página.
//   · A LO SUMO UN HILO NUEVO POR PERSONA CADA 24 H (`PERSONA_MS`): todo lo que espera va junto, en un solo mensaje.
//   · EL HILO SE BORRA A LAS 48 H (`VIDA_MS`): Discord los deja de mostrar archivados, pero quedan; borrados, no se
//     apilan (hay un tope de 1.000 hilos activos por servidor).
//   · «🔕 No me avises más» en el hilo (`bzn:no`) y en la página (Ajustes → Avisos, por `/avisos/bandeja` con `buzon`):
//     la tabla `buzon_no`, del objeto. Se vuelve con «🔔 Volver a avisarme» (`bzn:si`) o desde la página.
//   · SÓLO MIEMBROS DE DRA CON DISCORD VINCULADO: la bandeja ya es por Discord ID, y se cruza con los miembros que el
//     ciclo le pasa al Pase (`paseDatos().miembros`). Sin esa lista, nadie (no se adivina).
//   · LO CORRE EL CICLO, NO EL VIGÍA (`bot/buzon.py`, paso 2b4b3): el vigía comparte 50 subpedidos por minuto con la
//     lectura de los canales y un hilo cuesta tres pedidos a Discord. Acá sólo se elige y se anota; los pedidos a
//     Discord los hace el ciclo, con su freno de 429. Una ronda por hora (`RONDA_MS`) aunque el ciclo corra cada media,
//     a lo sumo `TOPE_RONDA` hilos por ronda y nunca de noche (`HORAS`, hora del este; el ciclo de madrugada no corre).
//   · 🐉 LOS DROPS SIN ABRIR: no había aviso de la página para eso (sólo el bot después de un comando, `dropsAviso()`),
//     así que el buzón lo agrega A LA BANDEJA (una vez por semana, `bz-drops:<semana>`) y desde ahí sale en los dos
//     lados como cualquier otro: la regla de la campana única.
//
// ⏸️ PARA TODOS, APAGADO HASTA EL OK DE DLX (`ENCENDIDO`).
// 🧪 LA PRUEBA DE HOY (Dlx, 28/11/2026: «solo conmigo por hoy día y por horas, y simulemos como si fuese activo»):
// `PRUEBA` lo prende SÓLO para Dlx hasta las 11:59 PM ET del 28/11 y después se apaga solo, sin desplegar nada. Mientras
// dura no mira el horario (es una prueba: tiene que poder verse a cualquier hora). Para ver cada clase de aviso como le
// llegaría a cualquiera: `python bot/buzon.py --simular` (`simular()`), y `--limpiar-simulacion` para sacarlos.
// ⚠️ Respeta «olvidarme» (`olvidar()`) y `mudarCuenta()` (`mudar()`).
import * as V from './vista.js';
import { GUILD_DRA, CANAL_BIENVENIDA } from './verificar_dc.js';

// ═══ ✏️ LO QUE SE PRENDE Y LOS NÚMEROS ═════════════════════════════════════════════════════════════════════════════
export const ENCENDIDO = false;
//: con algo adentro (y `ENCENDIDO`), el buzón sólo le escribe a esas cuentas
export const SOLO = [];
//: ⚠️ el ID de Dlx escrito y no importado: avisos.js importa este archivo, y al revés sería un ciclo de imports
//: (la prueba comprueba que es el mismo `DUENO`)
export const DLX = '739338101603696681';
//: 🧪 la prueba: sólo `solo`, hasta `hasta` (11:59:59 PM ET del 28/11/2026, que es hora estándar: UTC−5)
export const PRUEBA = { solo: [DLX], hasta: Date.parse('2026-11-29T04:59:59Z') };
/** Cómo está ahora: `{encendido, solo, prueba}`. La prueba sólo vale mientras `ENCENDIDO` sea `false` */
export function estado(ahora = Date.now()) {
  if (ENCENDIDO) return { encendido: true, solo: SOLO, prueba: false };
  const p = ahora < PRUEBA.hasta && PRUEBA.solo.length > 0;
  return { encendido: p, solo: p ? PRUEBA.solo : [], prueba: p, hasta: PRUEBA.hasta };
}
export const GUILD = GUILD_DRA;
export const CANAL = CANAL_BIENVENIDA;          // 💬˚┊conversacion
export const PERSONA_MS = 24 * 3600 * 1000;      // un hilo nuevo por persona cada 24 h
export const VIDA_MS = 48 * 3600 * 1000;         // y se borra a las 48 h
export const VENTANA_MS = 48 * 3600 * 1000;      // un aviso de la campana de más de 48 h ya no va a Discord
export const RONDA_MS = 55 * 60 * 1000;          // una ronda por hora (el ciclo corre cada media)
export const TOPE_RONDA = 10;                    // hilos nuevos por ronda, para todos
export const TOPE_BORRAR = 25;                   // hilos viejos que se borran por ronda
export const VIVOS_MAX = 300;                    // hilos vivos a la vez (Discord: 1.000 activos por servidor)
export const ITEMS_MAX = 6;                      // avisos por mensaje (el resto: «y N más en la página»)
export const HORAS = [12, 22];                   // de 12 PM a 10 PM, hora del este
export const DROPS_RECORDAR = true;              // 🐉 los drops sin abrir, una vez por semana, a la bandeja
export const NO_PASA = ['aplauso', 'comentario', 'seguidor', 'seguido', 'organiza', 'servidor', 'flojo', 'socio', 'consejo',
  'liga', 'nuevo'];
//: qué avisos de la campana van a Discord y con qué botón. Lo que no está acá, sólo en la página (los aplausos, quién
//: te sigue, los anuncios de los servidores que sigues: no son «para ti», son ruido en un hilo)
export const TIPOS = {
  personal: ['Ver en la página', '🃏'],
  drops: ['Abrir tus drops', '🐉'],
  pase: ['Tu Pase', '🎟️'],
  tienda: ['La Tienda', '🛍️'],
  libre: ['Tu batalla libre', '⚔️'],
  suplente: ['El evento', '📅'],
  calificar: ['Calificar', '⭐'],
  reporte: ['Ver la llave', '🛠️'],
  fondo: ['Tus fondos', '🖼️'],
  pedido: ['Tu pedido', '🙋'],
  ref: ['Invita y gana', '🎁'],
  crew: ['Tu crew', '👥'],
  racha: ['Tu racha', '🔥'],
  tuvideo: ['Tu video', '🎬'],
};
export const HUB = 'https://underlegends.pages.dev';
export const URL_EVENTOS = HUB + '/freestyle-rap/eventos';
export const URL_DROPS = HUB + '/freestyle-rap/?drops=1';   // el mismo de «Ver mis drops» del bot
export const URL_AJUSTES = HUB + '/cuenta/avisos';
export const RAZON = 'Liga Global: buzón';

export const TXT = {
  hola: (id) => '### 📬 <@' + id + '>, esto es para ti',
  pie: '-# Este hilo es privado: sólo lo ves tú (y los moderadores). Se borra solo en 48 h. Lo mismo está en la campana '
    + 'de la página.',
  mas: (n) => '…y ' + n + (n === 1 ? ' aviso más' : ' avisos más') + ' en la campana de la página.',
  visto: '✔️ Listo: lo marcamos como visto también en la página.',
  no: '🔕 Listo: no te abrimos más hilos. Lo tuyo sigue en la campana de la página.',
  si: '🔔 Listo: te volvemos a avisar acá.',
  ajeno: 'Este hilo es de otra persona.',
  fallo: 'No pude anotarlo: prueba de nuevo en un minuto.',
  drops: (n) => n === 1 ? '🐉 Tienes 1 Dragón Drop sin abrir' : '🐉 Tienes ' + n + ' Dragón Drops sin abrir',
  drops_cuerpo: 'Ábrelos en tu Inventario: cada uno trae Puntos de Tienda o un premio.',
};

const SNOW = /^[0-9]{5,25}$/;
const DIA_MS = 24 * 3600 * 1000;
const fila = (o, q, ...p) => o.sql.exec(q, ...p).toArray()[0] || null;
const filas = (o, q, ...p) => o.sql.exec(q, ...p).toArray();
/** La hora del este, de 0 a 23 */
export const horaET = (ahora = Date.now()) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', hour: '2-digit',
  hourCycle: 'h23' }).format(new Date(ahora)));
export const enHorario = (ahora = Date.now()) => { const h = horaET(ahora); return h >= HORAS[0] && h < HORAS[1]; };
/** La semana (lunes) en hora del este, para el recordatorio de los drops */
export function semanaET(ahora = Date.now()) {
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(ahora));
  const t = Date.parse(d + 'T00:00:00Z');
  const dow = (new Date(t).getUTCDay() + 6) % 7;
  return new Date(t - dow * DIA_MS).toISOString().slice(0, 10);
}
const absoluta = (u) => {
  const s = String(u || '');
  if (/^https:\/\//.test(s)) return s;
  if (s.startsWith('/')) return HUB + s;
  // los links viejos `#/tienda`: la página los lleva a su lugar (`limpiar()` del script del principio)
  if (s.startsWith('#/')) return HUB + '/' + s;
  return '';
};

// ═══ las tablas ════════════════════════════════════════════════════════════════════════════════════════════════════
export function buzonTablas(sql) {
  // cada hilo que se abrió: de quién, cuándo, qué avisos llevaba (las claves de la bandeja, para «Ya lo vi») y si ya se
  // borró. `hilo` vacío = reservado y todavía sin confirmar por el ciclo
  sql.exec('CREATE TABLE IF NOT EXISTS buzon_hilo (rid TEXT PRIMARY KEY, quien TEXT NOT NULL, hilo TEXT NOT NULL DEFAULT \'\', ' +
    "t INTEGER NOT NULL, claves TEXT NOT NULL DEFAULT '[]', borrado INTEGER NOT NULL DEFAULT 0) WITHOUT ROWID");
  sql.exec('CREATE INDEX IF NOT EXISTS buzon_hilo_quien ON buzon_hilo (quien, t)');
  sql.exec('CREATE INDEX IF NOT EXISTS buzon_hilo_vivo ON buzon_hilo (borrado, t)');
  sql.exec('CREATE INDEX IF NOT EXISTS buzon_hilo_hilo ON buzon_hilo (hilo)');
  // qué avisos de la bandeja ya salieron en Discord: no vuelven a salir
  sql.exec('CREATE TABLE IF NOT EXISTS buzon_enviado (quien TEXT NOT NULL, clave TEXT NOT NULL, t INTEGER NOT NULL, ' +
    'PRIMARY KEY (quien, clave)) WITHOUT ROWID');
  sql.exec('CREATE INDEX IF NOT EXISTS buzon_enviado_t ON buzon_enviado (t)');
  // 🔕 quien no quiere hilos
  sql.exec('CREATE TABLE IF NOT EXISTS buzon_no (quien TEXT PRIMARY KEY, t INTEGER NOT NULL) WITHOUT ROWID');
}

// ═══ el mensaje ════════════════════════════════════════════════════════════════════════════════════════════════════
/** Los botones de link de los avisos, sin repetir el mismo link, más «Próximos eventos»: hasta 5 en una fila */
export function botonesDe(items) {
  const out = [], vistos = new Set();
  for (const it of items) {
    const [txt, emoji] = TIPOS[it.tipo] || TIPOS.personal;
    const url = absoluta(it.url) || (it.tipo === 'drops' ? URL_DROPS : '');
    if (!url || vistos.has(url)) continue;
    vistos.add(url);
    out.push(V.enlace(txt, url, emoji));
    if (out.length >= 4) break;
  }
  if (!vistos.has(URL_EVENTOS)) out.push(V.enlace('Próximos eventos', URL_EVENTOS, '📅'));
  return out.slice(0, 5);
}

/** El mensaje del hilo: los avisos de la campana juntos, los links, «Ya lo vi» y «No me avises más». Sólo suena él */
export function mensajeHilo(quien, items) {
  const ls = items.slice(0, ITEMS_MAX).map((it) => '**' + String(it.titulo).slice(0, 120) + '**' +
    (it.cuerpo ? '\n' + String(it.cuerpo).slice(0, 240) : ''));
  const dentro = [V.T(TXT.hola(quien)), V.sep(), V.T(ls.join('\n\n').slice(0, 3000))];
  if (items.length > ITEMS_MAX) dentro.push(V.T(TXT.mas(items.length - ITEMS_MAX)));
  dentro.push(V.T(TXT.pie));
  return {
    flags: V.V2,
    components: [V.caja(V.COLOR.mag, dentro), V.fila(botonesDe(items)),
      V.fila(V.boton('Ya lo vi', 'bzn:visto', 3, { emoji: { name: '✔️' } }),
        V.boton('No me avises más', 'bzn:no', 2, { emoji: { name: '🔕' } }))],
    allowed_mentions: { users: [String(quien)] },
  };
}
/** El nombre del hilo: sin nombre ni ID (se ve en la lista de hilos de los moderadores) */
export const nombreHilo = (ahora = Date.now()) => '📬 Tus avisos · ' + new Intl.DateTimeFormat('es', { timeZone: 'America/New_York',
  day: 'numeric', month: 'short' }).format(new Date(ahora));

// ═══ la ronda (el ciclo: `/avisos/buzon` con su clave) ═══════════════════════════════════════════════════════════
const miembrosDe = (o) => { try { return o.paseDatos().miembros; } catch (e) { return new Set(); } };
const noQuiere = (o, quien) => !!fila(o, 'SELECT 1 AS x FROM buzon_no WHERE quien = ?', quien);

/**
 * 🐉 Los drops sin abrir, a la bandeja: una vez por semana por persona, a los miembros que no apagaron el buzón y tienen
 * alguno cerrado de hace más de un día. Va a la campana de la página también: es un aviso como cualquier otro.
 */
export function recordarDrops(o, ahora, miembros, solo = SOLO) {
  if (!DROPS_RECORDAR || !miembros.size) return 0;
  const sem = semanaET(ahora);
  const clave = 'bz-drops:' + sem;
  let n = 0;
  for (const r of filas(o, 'SELECT quien, COUNT(*) AS n FROM drops WHERE abierto = 0 AND t < ? GROUP BY quien', ahora - DIA_MS)) {
    const q = String(r.quien);
    if (!miembros.has(q) || (solo.length && !solo.includes(q)) || noQuiere(o, q)) continue;
    if (fila(o, 'SELECT 1 AS x FROM bandeja WHERE quien = ? AND clave = ?', q, clave)) continue;
    o.aBandeja(q, clave, 'drops', TXT.drops(Number(r.n)), TXT.drops_cuerpo, URL_DROPS, '', ahora);
    n++;
  }
  return n;
}

/**
 * 📬 Qué hacer en esta ronda: `{encendido, abrir: [{rid, quien, nombre, msg}], borrar: [{rid, hilo}], canal, guild,
 * razon}`. Lo que se abre queda RESERVADO acá (la fila del hilo sin hilo y sus avisos como enviados) antes de que el
 * ciclo lo pida a Discord: si el ciclo se corta a la mitad, no sale dos veces (se pierde el hilo, no la campana). El
 * ciclo confirma con `hecho()`; lo que falló se suelta y entra en la ronda siguiente.
 * Con `simular`, dice lo mismo sin anotar nada. `encendido`, `solo` y `prueba` salen de `estado()`; la prueba lo pasa.
 * 🔁 UN AVISO QUE LA CAMPANA VOLVIÓ A MARCAR COMO NUEVO SALE OTRA VEZ: `aBandeja()` pisa la misma clave y la vuelve a
 * «nueva» (el Nivel 7 del Pase es la misma fila que el Nivel 6, `pase:<temp>`), y lo que la página muestra como nuevo
 * el hilo también. Lo que no cambió no se repite (`buzon_enviado` guarda la hora de cada aviso que salió).
 */
export function ronda(o, ahora = Date.now(), op = {}) {
  const est = estado(ahora);
  const { simular = false, forzar = false, encendido = est.encendido, solo = est.solo, prueba = est.prueba } = op;
  const base = { encendido, prueba, canal: CANAL, guild: GUILD, razon: RAZON, abrir: [], borrar: [] };
  if (!encendido) return base;
  const previa = o.leer('buzon_ronda') || {};
  if (!forzar && !simular && previa.t && ahora - previa.t < RONDA_MS) return Object.assign(base, { espera: true });
  // lo viejo: hilos de más de 48 h (confirmados) se borran; reservas sin confirmar de más de 2 h se sueltan
  base.borrar = filas(o, "SELECT rid, hilo FROM buzon_hilo WHERE borrado = 0 AND hilo != '' AND t < ? ORDER BY t LIMIT ?",
    ahora - VIDA_MS, TOPE_BORRAR);
  if (!simular) {
    o.sql.exec("DELETE FROM buzon_hilo WHERE hilo = '' AND t < ?", ahora - 2 * 3600 * 1000);
    o.sql.exec('DELETE FROM buzon_hilo WHERE borrado = 1 AND t < ?', ahora - 30 * DIA_MS);
    o.sql.exec('DELETE FROM buzon_enviado WHERE t < ?', ahora - 30 * DIA_MS);
  }
  // 🧪 en la prueba no se mira el horario: tiene que poder verse a cualquier hora
  if (!prueba && !forzar && !enHorario(ahora)) return Object.assign(base, { fuera_de_hora: true });
  const miembros = miembrosDe(o);
  if (!miembros.size) return Object.assign(base, { sin_miembros: true });
  if (!simular) recordarDrops(o, ahora, miembros, solo);
  const vivos = Number((fila(o, 'SELECT COUNT(*) AS n FROM buzon_hilo WHERE borrado = 0') || {}).n) || 0;
  const cupo = Math.max(0, Math.min(TOPE_RONDA, VIVOS_MAX - vivos));
  // los avisos sin ver de la campana, de las últimas 48 h, de los tipos que van, que no salieron todavía
  const tipos = Object.keys(TIPOS);
  const cand = filas(o, 'SELECT b.quien, b.clave, b.t, b.tipo, b.titulo, b.cuerpo, b.url FROM bandeja b ' +
    'WHERE b.visto = 0 AND b.t > ? AND b.tipo IN (' + tipos.map(() => '?').join(',') + ') ' +
    'AND NOT EXISTS (SELECT 1 FROM buzon_enviado e WHERE e.quien = b.quien AND e.clave = b.clave AND e.t >= b.t) ORDER BY b.t',
  ahora - VENTANA_MS, ...tipos);
  const por = new Map();
  for (const c of cand) {
    const q = String(c.quien);
    if (!por.has(q)) por.set(q, []);
    por.get(q).push(c);
  }
  const abrir = [], en24 = [];
  for (const [q, items] of por) {
    if (abrir.length >= cupo) break;
    if (!miembros.has(q) || (solo.length && !solo.includes(q)) || noQuiere(o, q)) continue;
    const ult = fila(o, 'SELECT MAX(t) AS t FROM buzon_hilo WHERE quien = ?', q);
    if (ult && ult.t && ahora - Number(ult.t) < PERSONA_MS) {
      // la regla de las 24 h: lo suyo espera y va todo junto en el próximo hilo
      if (en24.length < 20) en24.push({ n: items.length, libre: Number(ult.t) + PERSONA_MS });
      continue;
    }
    // lo más nuevo arriba en el mensaje
    const lista = items.slice().sort((a, b) => b.t - a.t);
    // 🧪 un hilo con avisos simulados lleva `sim:` en su rid: `limpiarSimulacion()` lo encuentra y lo borra
    const rid = (lista.some((x) => String(x.clave).startsWith(SIM)) ? SIM : '') + q + ':' + ahora;
    if (!simular) {
      o.sql.exec('INSERT OR REPLACE INTO buzon_hilo (rid, quien, hilo, t, claves, borrado) VALUES (?, ?, \'\', ?, ?, 0)',
        rid, q, ahora, JSON.stringify(lista.map((x) => x.clave)));
      for (const x of lista) o.sql.exec('INSERT OR REPLACE INTO buzon_enviado (quien, clave, t) VALUES (?, ?, ?)', q, x.clave, Number(x.t));
    }
    abrir.push({ rid, quien: q, nombre: nombreHilo(ahora), msg: mensajeHilo(q, lista), n: lista.length });
  }
  if (!simular) o.guardar('buzon_ronda', { t: ahora, abrir: abrir.length, borrar: base.borrar.length, vivos });
  return Object.assign(base, { abrir, vivos, cupo, esperan: por.size, en24 });
}

/**
 * ✅ Lo que hizo el ciclo: `{abiertos: [{rid, hilo}], fallidos: [rid], borrados: [rid]}`. Un fallido suelta su reserva
 * (la fila y sus avisos como enviados): vuelve en la ronda siguiente.
 */
export function hecho(o, d, ahora = Date.now()) {
  let a = 0, f = 0, b = 0;
  for (const x of (d && d.abiertos) || []) {
    if (!x || !SNOW.test(String(x.hilo || ''))) continue;
    a += o.sql.exec("UPDATE buzon_hilo SET hilo = ? WHERE rid = ? AND hilo = ''", String(x.hilo), String(x.rid || '')).rowsWritten || 0;
  }
  for (const rid of (d && d.fallidos) || []) {
    const h = fila(o, "SELECT quien, claves FROM buzon_hilo WHERE rid = ? AND hilo = ''", String(rid));
    if (!h) continue;
    let ks = [];
    try { ks = JSON.parse(h.claves) || []; } catch (e) { ks = []; }
    for (const k of ks) o.sql.exec('DELETE FROM buzon_enviado WHERE quien = ? AND clave = ?', h.quien, String(k));
    o.sql.exec('DELETE FROM buzon_hilo WHERE rid = ?', String(rid));
    f++;
  }
  for (const rid of (d && d.borrados) || []) {
    b += o.sql.exec('UPDATE buzon_hilo SET borrado = 1 WHERE rid = ?', String(rid)).rowsWritten || 0;
  }
  return { ok: true, abiertos: a, fallidos: f, borrados: b, t: ahora };
}

// ═══ los botones del hilo y el interruptor de la página ════════════════════════════════════════════════════════════
/** `bzn:visto` · `bzn:no` · `bzn:si`, tocado en el hilo `hilo` por `quien`. El hilo tiene que ser suyo */
export function boton(o, d, ahora = Date.now()) {
  const quien = String((d && d.quien) || ''), hilo = String((d && d.hilo) || ''), accion = String((d && d.accion) || '');
  if (!SNOW.test(quien) || !SNOW.test(hilo)) return { error: 'faltan datos' };
  const h = fila(o, 'SELECT quien, claves FROM buzon_hilo WHERE hilo = ?', hilo);
  if (!h) return { error: 'vencido' };
  if (String(h.quien) !== quien) return { error: 'ajeno' };
  if (accion === 'visto') {
    let ks = [];
    try { ks = JSON.parse(h.claves) || []; } catch (e) { ks = []; }
    for (const k of ks) o.sql.exec('UPDATE bandeja SET visto = 1 WHERE quien = ? AND clave = ?', quien, String(k));
    return { ok: true, accion, n: ks.length };
  }
  if (accion === 'no' || accion === 'si') return Object.assign(pagina(o, quien, accion === 'si', ahora), { accion });
  return { error: 'faltan datos' };
}

/** El interruptor de la página (`/avisos/bandeja` con `buzon: true | false | 'ver'`): `{buzon: {si, encendido}}` */
export function pagina(o, quien, valor, ahora = Date.now()) {
  if (!SNOW.test(String(quien || ''))) return { error: 'faltan datos' };
  if (valor === false) o.sql.exec('INSERT OR REPLACE INTO buzon_no (quien, t) VALUES (?, ?)', String(quien), ahora);
  else if (valor === true) o.sql.exec('DELETE FROM buzon_no WHERE quien = ?', String(quien));
  // `encendido`: para ESTA persona (en la prueba, sólo para Dlx)
  const est = estado(ahora);
  const para = est.encendido && (!est.solo.length || est.solo.includes(String(quien)));
  return { ok: true, buzon: { si: !noQuiere(o, String(quien)), encendido: para } };
}

// ═══ 🧪 la simulación (Dlx, 28/11/2026: «simulemos como si fuese activo, o sea cada acción que activaría este sistema») ═
//: el prefijo de todo lo simulado: las claves de la bandeja, lo enviado y el rid de su hilo
export const SIM = 'sim:';
export const SIM_TANDA = 5;
/**
 * Un aviso de cada clase que el buzón lleva a Discord, con el texto de verdad de cada uno (copiado de donde nace: el
 * ciclo para la tarjeta y el rango, `paseNivel` para el Pase, `crews.js`, la Tienda…). `[clave, tipo, título, cuerpo,
 * url]`. Sólo existen en la bandeja (clave `sim:…`): no dan XP, ni drops, ni puntos, y no cuentan para nada.
 */
export const SIMULACION = [
  ['tarjeta', 'personal', '🃏 Desbloqueaste tu tarjeta Servidor', 'Pídela con /card en Discord o mírala en la página.', '/freestyle-rap/tarjetas'],
  ['rango', 'personal', '📈 Subiste a rango A', 'Tu letra nueva ya está en tus tarjetas y en el ranking.', '/freestyle-rap/ranking/competitivo'],
  ['drops', 'drops', TXT.drops(3), TXT.drops_cuerpo, URL_DROPS],
  ['pase', 'pase', '🎟️ Nivel 12 del Pase de rapero', '+150 Puntos de Tienda.', '/freestyle-rap/pase'],
  ['libre', 'libre', '⚔️ Te retaron a una batalla libre', 'Míralo en tu Inicio: cuando la jueguen, cada uno dice quién ganó.', '/freestyle-rap/'],
  ['suplente', 'suplente', '🪑 Entraste a DESGRACIAS EN TOKYO VOL 30',
    'Se liberó un cupo y pasaste de suplente a titular · toca para ver el anuncio', '/freestyle-rap/eventos'],
  ['calificar', 'calificar', '⭐ ¿Qué tal estuvo DESGRACIAS EN TOKYO VOL 29?', 'Califícalo de 1 a 5 y te llevas un Drop. Tienes 3 días.',
    '/freestyle-rap/eventos'],
  ['reporte', 'reporte', '✅ Corregimos la llave #512', 'Gracias por avisar: ya está como lo reportaste.', '/freestyle-rap/eventos'],
  ['tuvideo', 'tuvideo', '🎬 Tu batalla en DESGRACIAS EN TOKYO VOL 29 ya tiene video', 'Mírala y compártela.', '/freestyle-rap/reels'],
  ['tienda', 'tienda', '🏅 Completaste «Colección Dragón»', 'Te llevas su insignia para tu perfil y su pieza exclusiva, que no se vende.', '#/tienda'],
  ['racha', 'racha', '🔥 ¡7 días seguidos!', '+300 Puntos de Tienda. Sigue así.', '/'],
  ['crew', 'crew', '🎉 Nació Dragones', 'Invita a tu gente desde la página de la crew: ahí tienes sugeridos y un link para compartir.', '#/crews'],
  ['ref', 'ref', '🎁 Bienvenida por invitación', '+500 Puntos de Tienda por entrar a la Liga con un link de invitación.', '/freestyle-rap/tienda'],
  ['fondo', 'fondo', '🖼️ Tu fondo ya se ve', 'Lo aprobamos: ya está en tu perfil.', '/cuenta/fondo'],
  ['pedido', 'pedido', '🙋 Arreglamos lo que pediste', 'Tu país ya está bien en tu perfil y en tus tarjetas.', '/cuenta/algo-mal'],
];

/**
 * 🧪 Mete en la bandeja de `quien` un aviso de cada clase (o de las de `tipos`), un minuto entre uno y otro, como si
 * acabaran de pasar. SÓLO A LAS CUENTAS DE LA PRUEBA (`estado().solo`, o Dlx): a nadie más. Vuelve a «nuevo» si ya
 * estaba, así se puede repetir. `{ok, n, claves}`.
 */
export function simular(o, d, ahora = Date.now()) {
  const quien = String((d && d.quien) || DLX);
  const est = estado(ahora);
  if (quien !== DLX && !est.solo.includes(quien)) return { error: 'solo_prueba' };
  // con el buzón apagado (terminó la prueba), simular sólo dejaría avisos sueltos en la campana
  if (!est.encendido) return { error: 'apagado' };
  const tipos = Array.isArray(d && d.tipos) && d.tipos.length ? d.tipos.map(String) : null;
  // `tanda` 1, 2 o 3: de a cinco, así cada hilo los muestra enteros (un hilo trae hasta `ITEMS_MAX`)
  const n = Number(d && d.tanda) || 0;
  const base = n >= 1 ? SIMULACION.slice((n - 1) * SIM_TANDA, n * SIM_TANDA) : SIMULACION;
  const lista = base.filter(([k, t]) => !tipos || tipos.includes(k) || tipos.includes(t));
  lista.forEach(([k, tipo, titulo, cuerpo, url], i) => o.aBandeja(quien, SIM + k, tipo, titulo, cuerpo, url, '', ahora - (lista.length - i) * 60000));
  return { ok: true, n: lista.length, claves: lista.map((x) => SIM + x[0]), quien };
}

/**
 * 🧹 Saca todo lo simulado: los avisos `sim:` de la bandeja, lo enviado, sus hilos (devuelve los que hay que borrar de
 * Discord: `borrar: [{rid, hilo}]`) y su «No me avises más», si lo tocó en la prueba. Así el reloj de las 24 h vuelve a
 * cero para la próxima. `{ok, avisos, borrar}`.
 */
export function limpiarSimulacion(o, d, ahora = Date.now()) {
  const quien = String((d && d.quien) || DLX);
  const est = estado(ahora);
  if (quien !== DLX && !est.solo.includes(quien)) return { error: 'solo_prueba' };
  const avisos = o.sql.exec("DELETE FROM bandeja WHERE quien = ? AND clave LIKE 'sim:%'", quien).rowsWritten || 0;
  o.sql.exec("DELETE FROM buzon_enviado WHERE quien = ? AND clave LIKE 'sim:%'", quien);
  const hilos = filas(o, "SELECT rid, hilo FROM buzon_hilo WHERE quien = ? AND rid LIKE 'sim:%'", quien);
  o.sql.exec("DELETE FROM buzon_hilo WHERE quien = ? AND rid LIKE 'sim:%'", quien);
  o.sql.exec('DELETE FROM buzon_no WHERE quien = ?', quien);
  return { ok: true, avisos, borrar: hilos.filter((h) => SNOW.test(String(h.hilo || ''))), razon: RAZON };
}

/** Lo que entra por `/buzon` del objeto: `{fase: 'ronda' | 'hecho' | 'boton' | 'simular' | 'limpiar', …}` */
export function objeto(o, d, ahora = Date.now()) {
  const fase = String((d && d.fase) || '');
  if (fase === 'ronda') return ronda(o, ahora, { simular: !!d.simular, forzar: !!d.forzar });
  if (fase === 'hecho') return hecho(o, d, ahora);
  if (fase === 'boton') return boton(o, d, ahora);
  if (fase === 'simular') return simular(o, d, ahora);
  if (fase === 'limpiar') return limpiarSimulacion(o, d, ahora);
  return { error: 'fase' };
}

// ═══ «olvidarme» y mudar la cuenta ═════════════════════════════════════════════════════════════════════════════════
/** 🗑️ Lo suyo se va; sus hilos vivos quedan sin su ID y vencidos, así la ronda siguiente los borra de Discord */
export function olvidar(o, quien) {
  quien = String(quien || '');
  if (!SNOW.test(quien)) return;
  o.sql.exec('DELETE FROM buzon_enviado WHERE quien = ?', quien);
  o.sql.exec('DELETE FROM buzon_no WHERE quien = ?', quien);
  o.sql.exec("DELETE FROM buzon_hilo WHERE quien = ? AND (hilo = '' OR borrado = 1)", quien);
  o.sql.exec("UPDATE buzon_hilo SET quien = 'borrado', claves = '[]', t = 0 WHERE quien = ?", quien);
}

/** 🔀 Para `mudarCuenta()`: lo de la vieja pasa a la nueva (si choca, queda lo de la nueva) */
export function mudar(o, viejo, nuevo) {
  viejo = String(viejo || ''); nuevo = String(nuevo || '');
  if (!SNOW.test(viejo) || !SNOW.test(nuevo) || viejo === nuevo) return;
  for (const t of ['buzon_enviado', 'buzon_no']) {
    o.sql.exec(`UPDATE OR IGNORE ${t} SET quien = ? WHERE quien = ?`, nuevo, viejo);
    o.sql.exec(`DELETE FROM ${t} WHERE quien = ?`, viejo);
  }
  o.sql.exec('UPDATE buzon_hilo SET quien = ? WHERE quien = ?', nuevo, viejo);
}

// ═══ el Worker ═════════════════════════════════════════════════════════════════════════════════════════════════════
const alObjeto = (env, cuerpo) => env.AVISOS.get(env.AVISOS.idFromName('liga')).fetch('https://avisos/buzon', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo || {}),
}).then((r) => r.json()).catch(() => ({ error: 'red' }));
const responder = (tipo, data) => new Response(JSON.stringify(data === undefined ? { type: tipo } : { type: tipo, data }),
  { headers: { 'content-type': 'application/json' } });

/**
 * El botón `bzn:<accion>` de un hilo del buzón. El objeto puede estar dormido y Discord corta a los 3 s: «ya va» sin
 * mensaje nuevo (tipo 6, como «Lo recibo yo» del recibidor) y después la respuesta aparte, que ve sólo quien tocó. Con
 * «No me avises más», el botón para volver y el link a los ajustes de la página.
 */
export function botonWorker(i, env, ctx) {
  const id = (i.member && i.member.user && i.member.user.id) || (i.user && i.user.id) || '';
  const accion = String(((i.data && i.data.custom_id) || '').split(':')[1] || '');
  const hilo = String(i.channel_id || '');
  const seguir = (async () => {
    const j = await alObjeto(env, { fase: 'boton', accion, quien: id, hilo });
    const txt = j && j.ok ? TXT[accion] || TXT.fallo : (j && TXT[j.error]) || TXT.fallo;
    const botones = j && j.ok && accion === 'no' ? [V.boton('Volver a avisarme', 'bzn:si', 2, { emoji: { name: '🔔' } }),
      V.enlace('Ajustes de la página', URL_AJUSTES, '⚙️')] : [];
    await fetch(`https://discord.com/api/v10/webhooks/${i.application_id}/${i.token}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(V.avisoMsg(txt, botones)),
    }).catch(() => {});
  })();
  if (ctx && ctx.waitUntil) ctx.waitUntil(seguir); else seguir.catch(() => {});
  return responder(6);
}
