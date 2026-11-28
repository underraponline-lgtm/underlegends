// 🎁 DOS REGALOS DEL PASE PREMIUM (28/11/2026). Dlx: «Un free trial que necesitas verificarte con la cuenta de Discord
// primero, pero sin embargo, puedes tener 1 temporada gratis de pase premium si participas en eventos nuevos». Y la
// duración de la prueba, el mismo día: 14 días.
//
// 1. 🎁 LA PRUEBA (`reclamar()`): PRUEBA_DIAS días de Premium, UNA vez por cuenta de Discord, para siempre.
//    · Sólo VERIFICADOS: Miembro de DRA (`paseDatos().miembros`, la lista del ciclo: la misma que abre el Pase y el drop
//      del día). Sin verificarse, la respuesta dice que primero se verifique (`#/cuenta/verificar` o #verificate-aqui).
//    · Una por cuenta: la marca es `premium_prueba` (una fila por Discord ID). Se muda con la cuenta (`mudarCuenta()`, por
//      `TABLAS_QUIEN`) y «olvidarme» la borra (`olvidar()`).
//    · NO SE DA a quien ya tiene el Premium de la temporada, ni a quien ya lo tuvo esta temporada y se le cerró (una fila de
//      `pase_premium` con su `hasta`): el Premium de cada uno es UN rango `[desde, hasta]` por temporada (`pasePremium()`),
//      y meter la prueba ahí le pisaría ese rango y la XP que ganó con él.
//    · CÓMO VIVE: es una fila más de `pase_premium`, con `hasta` = el vencimiento. Todo lo que ya preguntaba por el rango
//      con la hora —la Tienda (`esPremium()`), los grabados (`premiumDe()`), el +XP (`paseVale()`), los vales— la respeta
//      sin tocarse. Lo que preguntaba sólo «¿hay fila?» (los premios de la fila premium, los títulos, las reacciones, el
//      color, el fondo propio) pregunta ahora `sigue()`: una prueba vencida NO sigue (un rol que se fue, como hasta hoy, sí).
//    · Lo cobrado de la fila premium durante la prueba (Puntos de Tienda, marcos) se queda: es la regla de siempre del
//      rol que se va (`premiarPase()`: «para siempre»).
//    · Avisos a la campana: al reclamarla, «🎁 Tienes 14 días de Pase Premium», y un día antes de que termine
//      (`revisar()`, una vez por hora desde el vigía). Nunca por DM.
//
// 2. 🐣 UNA TEMPORADA ENTERA POR JUGAR UN EVENTO DE NUEVOS (`nuevosCiclo()`). Los eventos los marca Dlx en el Dashboard
//    (ajuste `eventos_nuevos`, `{clave: 1}` por número o `a:<id del anuncio>`, como los de estilo; `{clave: 0}` saca uno
//    que se detectó solo) y el ciclo los detecta por su anuncio (bot/premium_nuevos.py). Con los resultados, el ciclo
//    manda en el Pase (`nuevos_prem`) quién JUGÓ uno, con su Discord ID del padrón, y acá se le da UNA vez por temporada
//    (el vale `nuevos:<temp>:<id>` es la marca), por el mismo camino que el premio del recibidor (`premiar()` de
//    bot/recibidor.js): el vale va como usado por esa cuenta y la cuenta del rol no se lo cierra. Si ya tenía el Premium
//    de la temporada, el vale queda SIN usar en su Inventario, para la temporada que elija (como el recibidor). Si lo que
//    tenía era la prueba, la prueba pasa a ser la temporada entera.

export const PRUEBA_DIAS = 14;
export const PAGINA = 'https://underlegends.pages.dev';
export const URL_PASE = PAGINA + '/freestyle-rap/pase/premium';
export const URL_VERIFICAR = '#/cuenta/verificar';
export const CANAL_VERIFICAR = '#verificate-aqui';
/** las tablas con `quien`: se mudan con la cuenta (`mudarCuenta()`) y se borran con «olvidarme» (`olvidar()`) */
export const TABLAS_QUIEN = ['premium_prueba'];
const DIA = 24 * 3600 * 1000;
const SNOW = /^[0-9]{5,25}$/;
const fila = (o, q, ...p) => o.sql.exec(q, ...p).toArray()[0] || null;
const fechaET = (t) => new Intl.DateTimeFormat('es', { timeZone: 'America/New_York', day: 'numeric', month: 'long' }).format(new Date(t));

export function regalosTablas(sql) {
  sql.exec('CREATE TABLE IF NOT EXISTS premium_prueba (quien TEXT PRIMARY KEY, temp TEXT NOT NULL, desde INTEGER NOT NULL, ' +
    'hasta INTEGER NOT NULL, aviso INTEGER NOT NULL DEFAULT 0)');
  sql.exec('CREATE INDEX IF NOT EXISTS premium_prueba_aviso ON premium_prueba (aviso, hasta)');
}

const tempDe = (o) => { try { const P = o.paseDatos(); return P && P.cfg && P.cfg.temp ? String(P.cfg.temp) : ''; } catch (e) { return ''; } };
const prueba = (o, quien) => fila(o, 'SELECT temp, desde, hasta, aviso FROM premium_prueba WHERE quien = ?', String(quien));

/** ¿El rango `pr` de `pasePremium()` es el de la prueba de esa persona en esa temporada? */
export function esPrueba(o, quien, temp, pr) {
  if (!pr || pr[1] == null) return false;
  const p = prueba(o, quien);
  return !!(p && p.temp === temp && Number(p.hasta) === Number(pr[1]));
}

/**
 * 💎 ¿SIGUE siendo Premium para lo que se cobra o se muestra en la temporada? Lo de siempre —hay una fila— salvo la
 * prueba vencida. (Un rol que se fue sigue como hasta hoy: eso no lo cambia esto.)
 */
export function sigue(o, quien, temp, ahora = Date.now()) {
  const pr = o.pasePremium(String(quien), temp);
  if (!pr) return false;
  if (pr[1] == null || pr[1] > ahora) return true;
  return !esPrueba(o, quien, temp, pr);
}

/** 💎 ¿Tiene el Premium de la TEMPORADA (no la prueba)? Para guardar un vale en vez de usarlo */
export function deTemporada(o, quien, temp, ahora = Date.now()) {
  const pr = o.pasePremium(String(quien), temp);
  if (!pr) return false;
  if (pr[1] == null) return true;
  return pr[1] > ahora && !esPrueba(o, quien, temp, pr);
}

/**
 * Lo que ve la página del Premium de alguien (`paseDe().premium`): `{desde, hasta}` como siempre, y con la prueba activa,
 * `hasta: null` (la página lee «tiene» con `hasta == null`) y `prueba: <cuándo termina>`.
 */
export function paraPagina(o, quien, temp, pr, ahora = Date.now()) {
  if (!pr) return null;
  if (esPrueba(o, quien, temp, pr) && pr[1] > ahora) return { desde: pr[0], hasta: null, prueba: pr[1] };
  return { desde: pr[0], hasta: pr[1] };
}

/**
 * 🎁 ¿Puede reclamar la prueba? `{dias, puede, por?, hasta?, activa?}`. `por`: 'cuenta' (sin Discord) · 'sin_temporada'
 * (el Pase todavía no llegó) · 'verificar' · 'usada' · 'ya_premium' · 'ya_tuviste' (tuvo el Premium esta temporada).
 */
export function estado(o, quien, ahora = Date.now(), dueno = '') {
  const out = { dias: PRUEBA_DIAS, puede: false };
  quien = String(quien || '');
  if (!SNOW.test(quien)) return Object.assign(out, { por: 'cuenta' });
  const p = prueba(o, quien);
  if (p) return Object.assign(out, { por: 'usada', hasta: Number(p.hasta), activa: Number(p.hasta) > ahora });
  const temp = tempDe(o);
  if (!temp) return Object.assign(out, { por: 'sin_temporada' });
  if (quien === dueno) return Object.assign(out, { por: 'ya_premium' });
  let miembro = false;
  try { miembro = o.paseDatos().miembros.has(quien); } catch (e) { miembro = false; }
  if (!miembro) return Object.assign(out, { por: 'verificar', verificar: URL_VERIFICAR, canal: CANAL_VERIFICAR });
  const pr = o.pasePremium(quien, temp);
  if (pr && (pr[1] == null || pr[1] > ahora)) return Object.assign(out, { por: 'ya_premium' });
  if (pr) return Object.assign(out, { por: 'ya_tuviste' });
  return Object.assign(out, { puede: true });
}

/** 🎁 Reclamar la prueba (`/avisos/premium-prueba` con `si`, con tu sesión). Devuelve el estado nuevo, con `ok`. */
export function reclamar(o, quien, ahora = Date.now(), dueno = '') {
  const e = estado(o, quien, ahora, dueno);
  if (!e.puede) return Object.assign({ error: e.por }, e);
  const temp = tempDe(o), hasta = ahora + PRUEBA_DIAS * DIA;
  // ⚠️ el orden importa: `premium_prueba` primero (es la marca de «una vez»); si `pase_premium` choca (no debería: se
  // miró arriba), la prueba queda gastada y sin efecto, nunca dos veces
  const r = o.sql.exec('INSERT OR IGNORE INTO premium_prueba (quien, temp, desde, hasta, aviso) VALUES (?, ?, ?, ?, 0)',
    String(quien), temp, ahora, hasta);
  if (!r.rowsWritten) return Object.assign({ error: 'usada' }, estado(o, quien, ahora, dueno));
  o.sql.exec('INSERT OR IGNORE INTO pase_premium (quien, temp, desde, hasta) VALUES (?, ?, ?, ?)', String(quien), temp, ahora, hasta);
  let nivel = 0;
  try { nivel = (o.premiarPase(String(quien)) || {}).nivel || 0; } catch (er) { /* lo cobra con su próxima Tarea */ }
  o.aBandeja(String(quien), 'prueba-premium', 'pase', '🎁 Tienes ' + PRUEBA_DIAS + ' días de Pase Premium',
    'Hasta el ' + fechaET(hasta) + '. ' + (nivel ? 'Ya cobraste lo de tus ' + nivel + ' niveles de la fila premium. ' : '') +
    'Tus Tareas dan más XP mientras dure.', URL_PASE, '', ahora);
  return Object.assign({ ok: true, nivel }, estado(o, quien, ahora, dueno));
}

/** ⏰ Una vez por hora (el vigía): el aviso de «termina mañana», una vez por prueba. Devuelve cuántos avisó. */
export function revisar(o, ahora = Date.now()) {
  let n = 0;
  for (const p of o.sql.exec('SELECT quien, temp, hasta FROM premium_prueba WHERE aviso = 0 AND hasta > ? AND hasta <= ?',
    ahora, ahora + DIA).toArray()) {
    o.sql.exec('UPDATE premium_prueba SET aviso = 1 WHERE quien = ?', p.quien);
    // si en el medio pasó a ser Premium de la temporada (un vale, el rol, un evento de nuevos), no hay nada que avisar
    const pr = o.pasePremium(String(p.quien), String(p.temp));
    if (!pr || pr[1] == null || Number(pr[1]) !== Number(p.hasta)) continue;
    o.aBandeja(String(p.quien), 'prueba-premium-fin', 'pase', '⏰ Tu prueba del Pase Premium termina mañana',
      'Dura hasta el ' + fechaET(p.hasta) + '. Lo que ya cobraste de la fila premium es tuyo para siempre.', URL_PASE, '', ahora);
    n++;
  }
  return n;
}

/**
 * 🐣 El Premium de la temporada para los que jugaron un evento de nuevos: `lista` es `[{q, ll}]` del ciclo
 * (bot/premium_nuevos.py). Una vez por cuenta y temporada (`nuevos:<temp>:<id>`). Devuelve cuántos lo recibieron ahora.
 */
export function nuevosCiclo(o, lista, ahora = Date.now(), dueno = '') {
  const temp = tempDe(o);
  if (!temp || !Array.isArray(lista)) return 0;
  let n = 0;
  for (const x of lista.slice(0, 500)) {
    const q = String((x && x.q) || ''), ll = String((x && x.ll) || '');
    if (!SNOW.test(q) || q === dueno || !/^[0-9]{1,6}$/.test(ll)) continue;
    if (dar(o, q, temp, ll, ahora)) n++;
  }
  return n;
}

function dar(o, quien, temp, ll, ahora) {
  const origen = 'nuevos:' + temp + ':' + quien;
  if (fila(o, 'SELECT 1 AS x FROM premium_vale WHERE origen = ?', origen)) return false;
  const k = (o.claveDe && o.claveDe(quien)) || '';
  const motivo = 'Jugaste un evento de nuevos (#' + ll + ')';
  const titulo = '🐣 Jugaste tu primer evento: el Pase Premium de esta temporada es tuyo';
  if (deTemporada(o, quien, temp, ahora) && k) {
    o.sql.exec('INSERT OR IGNORE INTO premium_vale (origen, k, motivo, dado) VALUES (?, ?, ?, ?)', origen, k, motivo, ahora);
    o.aBandeja(quien, 'nuevos-prem:' + temp, 'pase', '🐣 Jugaste un evento de nuevos: ganaste un Pase Premium',
      'Ya tenías el Pase Premium: te guardamos uno en tu Inventario para la temporada que elijas.', PAGINA + '/freestyle-rap/inventario', '', ahora);
    return true;
  }
  o.sql.exec('INSERT OR IGNORE INTO premium_vale (origen, k, motivo, dado, usado_temp, usado_por, usado_t) VALUES (?, ?, ?, ?, ?, ?, ?)',
    origen, k, motivo, ahora, temp, quien, ahora);
  if (!deTemporada(o, quien, temp, ahora)) {
    // sin fila: desde ahora. Con la prueba (activa o vencida) o un rango cerrado: se abre de nuevo, sin vencimiento
    o.sql.exec('INSERT INTO pase_premium (quien, temp, desde, hasta) VALUES (?, ?, ?, NULL) ON CONFLICT(quien, temp) ' +
      'DO UPDATE SET hasta = NULL', quien, temp, ahora);
    try { o.premiarPase(quien); } catch (e) { /* lo cobra con su próxima Tarea */ }
  }
  o.aBandeja(quien, 'nuevos-prem:' + temp, 'pase', titulo, 'Desde ahora tus Tareas dan más XP y cobras la fila premium.', URL_PASE, '', ahora);
  return true;
}

/** 🐣 El ajuste `eventos_nuevos` del Dashboard: `{clave: 1 | 0}` (1 = es de nuevos, 0 = no lo es aunque se detecte solo) */
export function ajusteNuevos(valor) {
  if (valor === null) return null;
  if (!valor || typeof valor !== 'object' || Array.isArray(valor) || Object.keys(valor).length > 300) return undefined;
  const out = {};
  for (const [k, v] of Object.entries(valor)) {
    if (!/^(a:[0-9]{15,22}|[0-9]{1,6})$/.test(k) || ![0, 1].includes(v)) return undefined;
    out[k] = v;
  }
  return out;
}

/** «olvidarme»: la prueba se va (si vuelve, la cuenta empieza de cero, como todo lo demás) */
export function olvidar(o, quien) {
  o.sql.exec('DELETE FROM premium_prueba WHERE quien = ?', String(quien));
}

/** La ruta del objeto (`/premium-prueba`, con la sesión): con `si`, reclamar; sin nada, el estado */
export function ruta(o, d, ahora = Date.now(), dueno = '') {
  const quien = String((d && d.quien) || '');
  if (!SNOW.test(quien)) return { error: 'cuenta', dias: PRUEBA_DIAS, puede: false, por: 'cuenta' };
  return d.si === true ? reclamar(o, quien, ahora, dueno) : estado(o, quien, ahora, dueno);
}
