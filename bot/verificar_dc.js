// ✅ VERIFICARSE SIN SALIR DE DISCORD (28/11/2026): el mismo camino que el de YAGPDB en •「✅」verificate-aqui de DRA, con
// nuestro bot y por HTTP (el Worker: nada de esto vive en Railway).
//
// LO QUE HACE HOY YAGPDB (Dlx, 28/11/2026, sus comandos), Y ESTO LO REPITE PASO A PASO:
//   1. el menú de países (los 21 de `PAISES`, con su bandera)
//   2. un formulario «Verificación 🐉 Generación LG»: el AKA (2 a 9 letras) y, si es Estados Unidos, el estado.
//      Nombres de los dueños reservados (`RESERVADOS`), el AKA único entre los verificados, sin `CARACTERES_MALOS`.
//      Lo escrito se guarda 10 minutos (`BORRADOR_MS`)
//   3. «🎤 ¿Planeas competir…?»: Ya compito (activo) · Quiero empezar (nuevo) · Vengo por la comunidad (no)
//   4. «🔗 ¿Alguien te invitó?»: sí → a quién (ni uno mismo ni un bot) · no
//   5. «¿Así es como te verás?», con Confirmar y Cambiar (AKA, país, competencia, quién te invitó, volver)
//   6. al confirmar: fuera el 🆕 Invitado, el Miembro y el rol del país, el apodo «🐉 | AKA» (al dueño del servidor no:
//      Discord no deja), el AKA reservado, la historia (primera vez, temporada, competencia, quién invitó), la invitación
//      contada al que invitó —salvo que la persona ya se haya verificado hace menos de `REVINO_DIAS` días— con su aviso en
//      el hilo INVITADOS, el aviso «✅ Nuevo verificado en Liga Global» con `||LIGAID|aka|pais|id|competidor||` en el hilo
//      LIGA GLOBAL ID (el mismo formato, por si algo lo lee), y la bienvenida pública en el chat con «👋 Saludar»
//      (cualquiera menos el nuevo, hasta `SALUDOS_MAX` saludos por nuevo en `SALUDOS_DIAS` días).
// LO QUE SUMAMOS: el último mensaje dice qué se abre al verificarte y lleva al Evento de Nuevos y a la página; quien
// contesta «Quiero empezar» lee primero lo del Evento de Nuevos.
//
// 🔑 VERIFICADO SIGUE SIENDO SÓLO EL ROL MIEMBRO DE DRA (bot/verificados.py): esto pone los mismos roles que ponía YAGPDB,
// ni uno más. Lo único distinto: al cambiar de país se saca el rol del país viejo (YAGPDB dejaba los dos, y con dos países
// el portón no sabe cuál es el tuyo).
// ⚠️ LOS DATOS DE YAGPDB NO LOS PODEMOS LEER: los AKA reservados, la historia y las invitaciones son tablas nuestras del
// objeto (`verifTablas()`). Los AKA de quienes ya están se siembran de los apodos «X | AKA» de los Miembros de DRA
// (`herramientas/verificar_dc_panel.py --sembrar`).
// ⚠️ NADA DE ESTO TRABA CHATEAR NI JUGAR: sólo pone roles.
// ⚠️ El texto público va en «tú» (YAGPDB usaba «vos» en algunos lados).
import * as V from './vista.js';

export const GUILD_DRA = '841017460341604382';
export const ROL_MIEMBRO = '1101257512273055745';   // ◢◤🏴◥◣ Miembro (= `verificados.ROL_MIEMBRO`)
export const ROL_INVITADO = '1206980203352690749';  // ◢◤🆕◥◣ Invitado (= `rol_invitado` de DRA en datos/servidores.json)
//: el rol de Brasil existe en DRA pero no está en el menú (Dlx, 22/09: «Brasil no debería existir»); igual se saca al cambiar
export const ROL_BRASIL = '1509052769410220096';
//: los canales e hilos de DRA que usa YAGPDB (Dlx, 28/11/2026)
export const HILO_INVITES = '1528989133492719686';  // INVITADOS
export const HILO_VERIF = '1512342566488768542';    // LIGA GLOBAL ID
export const CANAL_BIENVENIDA = '882088482284122212'; // 💬˚┊conversacion
export const CANAL_NUEVOS = '1516285712805265519';  // ✦🐣・evento-nuevos
export const CANAL_EMPIEZA = '1498326090169712812'; // •「📮」empieza-aqui
export const PAGINA = 'https://underlegends.pages.dev/freestyle-rap';
//: la marca de la generación en el apodo, por temporada («🐉 | AKA»)
export const GEN = { t1: '🐉' };
export const BORRADOR_MS = 10 * 60 * 1000;
export const REVINO_DIAS = 60;
export const SALUDOS_MAX = 4;
export const SALUDOS_DIAS = 7;
export const AKA_MIN = 2;
export const AKA_MAX = 9;
export const CARACTERES_MALOS = '`@#$%^&*()=[]{}|;:",<>/?\\';
export const RESERVADOS = ['itsdlx', 'lil drako', 'bau'];
//: los GIF de freestyle del saludo. ⚠️ VACÍO A PROPÓSITO: los de YAGPDB no los podemos leer. Sin GIF, el saludo sale igual
export const GIFS_SALUDO = [];

/**
 * Los 21 países del menú de YAGPDB, en su orden: `[cc, clave de YAGPDB, nombre, rol de DRA]`. La clave es la que va en
 * `||LIGAID|…|pais|…||`; el rol, el mismo de `sheet/pais_por_rol.py` (lo comprueba la herramienta y la prueba).
 */
export const PAISES = [
  ['pe', 'peru', 'Perú', '843368716846759958'], ['co', 'colombia', 'Colombia', '843689607078215691'],
  ['ar', 'argentina', 'Argentina', '843368724793917451'], ['bo', 'bolivia', 'Bolivia', '843846193746018315'],
  ['ec', 'ecuador', 'Ecuador', '843689607703035956'], ['ve', 'venezuela', 'Venezuela', '843689608088125520'],
  ['es', 'españa', 'España', '843689606104481794'], ['cl', 'chile', 'Chile', '843689611791564812'],
  ['mx', 'mexico', 'México', '843689611615928330'], ['cr', 'costa rica', 'Costa Rica', '843846220135923732'],
  ['hn', 'honduras', 'Honduras', '843846196300349490'], ['gt', 'guatemala', 'Guatemala', '843846217510551622'],
  ['uy', 'uruguay', 'Uruguay', '843847085685342269'], ['ni', 'nicaragua', 'Nicaragua', '843846218563977277'],
  ['us', 'estados unidos', 'Estados Unidos', '843846195168018433'], ['sv', 'el salvador', 'El Salvador', '843847238740213760'],
  ['cu', 'cuba', 'Cuba', '843846221243744257'], ['pa', 'panama', 'Panamá', '843689610642718741'],
  ['pr', 'puerto rico', 'Puerto Rico', '847499144108441640'], ['py', 'paraguay', 'Paraguay', '843847088072556554'],
  ['do', 'rd', 'República Dominicana', '843846221181091870'],
];
const PAIS = Object.fromEntries(PAISES.map(([cc, k, n, rol]) => [cc, { cc, k, n, rol }]));
const ROLES_PAIS = new Set(PAISES.map((p) => p[3]).concat(ROL_BRASIL));
export const COMP = { activo: ['🔥', 'Ya compito'], nuevo: ['✊', 'Quiero empezar'], no: ['👀', 'Vengo por la comunidad'] };

const API = 'https://discord.com/api/v10';
const SNOW = /^[0-9]{15,25}$/;
const RAZON = encodeURIComponent('Liga Global: se verificó en #verificate-aqui');
const DIA_MS = 24 * 3600 * 1000;

export const bandera = (cc) => String.fromCodePoint(...[...String(cc || '').toUpperCase()].map((c) => 0x1F1E6 + c.charCodeAt(0) - 65));
const paisTxt = (cc) => (PAIS[cc] ? bandera(cc) + ' ' + PAIS[cc].n : '—');
const urlCanal = (c) => `https://discord.com/channels/${GUILD_DRA}/${c}`;
const genDe = (temp) => GEN[temp] || GEN.t1;

// ── el AKA ──────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Cómo se comparan dos AKA: sin mayúsculas, sin espacios de más, y la negrita matemática de Discord como letra común */
export const normAka = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();

/** `{aka}` o `{error: 'largo'|'caracteres'|'reservado'|'vacio'}`. Sin red: lo que se puede decir enseguida. */
export function validarAka(s) {
  const aka = String(s || '').replace(/\s+/g, ' ').trim();
  if (!aka) return { error: 'vacio' };
  const n = [...aka].length;
  if (n < AKA_MIN || n > AKA_MAX) return { error: 'largo' };
  if ([...aka].some((c) => CARACTERES_MALOS.includes(c))) return { error: 'caracteres' };
  if (RESERVADOS.includes(normAka(aka))) return { error: 'reservado' };
  return { aka };
}
export function validarEstado(s) {
  const e = String(s || '').replace(/\s+/g, ' ').trim();
  if ([...e].length < 2 || [...e].length > 30) return { error: 'estado' };
  if ([...e].some((c) => CARACTERES_MALOS.includes(c))) return { error: 'caracteres' };
  return { estado: e };
}
/** El AKA de un apodo de DRA: lo que va después de la última « | » («🐉 | Nyl», «#4 | CREW | Nyl»). Sin « | », nada */
export function akaDeApodo(nick) {
  const p = String(nick || '').split(' | ');
  if (p.length < 2) return '';
  const a = normAka(p[p.length - 1]);
  return a && [...a].length <= 32 ? a : '';
}

export const TXT = {
  vacio: 'Escribe tu AKA: es el nombre que vas a llevar en el servidor.',
  largo: `Tu AKA tiene que tener entre ${AKA_MIN} y ${AKA_MAX} letras.`,
  caracteres: 'Tu AKA no puede llevar ninguno de estos: ' + CARACTERES_MALOS.split('').join(' '),
  reservado: 'Ese nombre está reservado para los dueños del servidor: elige otro.',
  en_uso: 'Ese AKA ya está en uso: elige otro.',
  estado: 'Escribe el estado donde vives (entre 2 y 30 letras).',
  vencido: '⏳ Pasaron más de 10 minutos: vuelve a elegir tu país en el menú del panel.',
  incompleto: 'Te falta algún paso: vuelve a elegir tu país en el menú.',
  pendiente: 'Primero acepta las reglas de DRA (te aparecen al abrir el servidor) y después confirma de nuevo.',
  no_dra: 'No te encuentro en Discord Rap Español: entra al servidor y vuelve a probar.',
  permiso: 'No pude ponerte los roles: avísale a un admin para que lo revise.',
  discord: 'Discord no me contestó: prueba de nuevo en un minuto.',
  red: 'No pude guardarlo: prueba de nuevo en un minuto.',
  fuera: 'Este menú es de Discord Rap Español.',
  invito_yo: 'No puedes elegirte a ti mismo: elige a quien te invitó.',
  invito_bot: 'Un bot no invita a nadie: elige a la persona que te invitó.',
  boton: 'Ese botón ya no anda: vuelve a elegir tu país en el menú.',
  hola_yo: '👋 No puedes saludarte a ti mismo: ¡saluda a los que llegan después!',
  hola_tope: `👋 Ya lo saludaron ${SALUDOS_MAX} personas: ¡gracias igual!`,
  hola_ya: '👋 Ya lo saludaste.',
};

// ── los mensajes ────────────────────────────────────────────────────────────────────────────────────────────────────
//: dónde vive la imagen del panel: R2 público, carpeta `paneles/` (la sube `herramientas/verificar_dc_panel.py`)
export const R2_PANELES = 'https://pub-70d5821d06a8432c9cffd0c102195000.r2.dev/paneles/';
export const imgValida = (u) => typeof u === 'string' && u.startsWith(R2_PANELES) && /^[\w./-]+$/.test(u.slice(8)) && u.length < 200;

/**
 * 🎤 El panel del canal, público, en V2. Un solo mensaje: la herramienta lo edita si ya está. `img`: el banner de Dlx
 * (bot/paneles_img/verificate.png, 16:9) arriba de todo, como galería: un banner se lee mejor que una miniatura
 */
export function panelMsg(img = '') {
  return V.mensaje({ color: V.COLOR.mag, efimero: false, dentro: [
    imgValida(img) ? V.galeria(img) : null,
    V.T('## 🎤 Entrada al Flow 🔥'),
    V.T('¡Te damos la bienvenida a **Under Legends**! Para entrar a este reino de rimas y beats, verifícate: elige tu país '
      + 'en el menú de abajo y sigue los pasos. Es un minuto.'),
    V.T('-# ¿Tu país no está en la lista? Avísale a un admin.'),
  ], filas: [[menuPaises('vdc:pais', '🌎 Elige tu país')]] });
}
export const menuPaises = (id, ph) => ({ type: 3, custom_id: id, placeholder: ph, min_values: 1, max_values: 1,
  options: PAISES.map(([cc, , n]) => ({ label: n, value: cc, emoji: { name: bandera(cc) } })) });

/** 📝 El formulario (tipo 9, sale enseguida). `edicion`: el AKA puede ir vacío (= no cambiarlo) */
export function modal(cc, edicion = false) {
  const filas = [{ type: 1, components: [{ type: 4, custom_id: 'aka', style: 1, label: '¿Cuál será tu AKA?',
    placeholder: edicion ? 'Déjalo vacío para no cambiarlo' : 'Tu nombre de batalla o apodo en el servidor',
    min_length: edicion ? 0 : AKA_MIN, max_length: AKA_MAX, required: !edicion }] }];
  if (cc === 'us') {
    filas.push({ type: 1, components: [{ type: 4, custom_id: 'estado', style: 1, label: '¿En qué estado vives?',
      placeholder: 'Por ejemplo: Texas', min_length: 2, max_length: 30, required: true }] });
  }
  return { type: 9, data: { custom_id: 'vdc:m:' + (cc || '-') + (edicion ? ':e' : ''), title: 'Verificación 🐉 Generación LG',
    components: filas } };
}
const efimero = (dentro, filas, color = V.COLOR.mag) => V.mensaje({ color, efimero: true, dentro, filas });
const b = (label, id, emoji, style = 2) => V.boton(label, id, style, emoji ? { emoji: { name: emoji } } : undefined);

export function pasoCompetir(edicion = false, error = '') {
  const s = edicion ? ':e' : '';
  return efimero([V.T('### 🎤 ¿Planeas competir en nuestras competencias?'),
    V.T('Organizamos batallas y torneos todas las semanas, y quien compite entra al ranking de competidores.'
      + (error ? '\n-# ' + error : ''))],
  [Object.keys(COMP).map((k) => b(COMP[k][1], 'vdc:c:' + k + s, COMP[k][0]))]);
}
export const pasoInvito = () => efimero([V.T('### 🔗 ¿Alguien te invitó al servidor?'),
  V.T('Si alguien te trajo, dinos quién: le sumamos la invitación.')],
[[b('Sí, alguien me invitó', 'vdc:i:si', '✅'), b('No, llegué por mi cuenta', 'vdc:i:no', '🤷')]]);
export const pasoQuien = (error = '') => efimero([V.T('### 🔗 ¿Quién te invitó?'),
  V.T('Búscalo por su nombre en el menú.' + (error ? '\n-# ' + error : ''))],
[[{ type: 5, custom_id: 'vdc:iu', placeholder: 'Busca a quien te invitó', min_values: 1, max_values: 1 }],
  [b('Mejor no', 'vdc:i:no', '🤷')]]);
export const paisEditar = () => efimero([V.T('### 🌎 ¿De qué país eres?')],
  [[menuPaises('vdc:p2', 'Elige tu país')], [b('Volver', 'vdc:pv', '↩️')]]);
export const menuCambiar = () => efimero([V.T('### ✏️ ¿Qué quieres cambiar?')],
  [[b('AKA', 'vdc:ea', '✏️'), b('País', 'vdc:ep', '🌎'), b('Competencia', 'vdc:er', '🎤'), b('Quién te invitó', 'vdc:ei', '🔗'),
    b('Volver', 'vdc:pv', '↩️')]]);

/** 👀 «¿Así es como te verás?»: el borrador `x` = `{aka, cc, estado, comp, inv}` */
export function vista(x, temp = 't1', error = '') {
  const l = ['**Apodo:** ' + genDe(temp) + ' | ' + x.aka, '**País:** ' + paisTxt(x.cc)];
  if (x.cc === 'us' && x.estado) l.push('**Estado:** ' + x.estado);
  l.push('**Competencia:** ' + (COMP[x.comp] ? COMP[x.comp].join(' ') : '—'), '**Te invitó:** ' + (x.inv ? '<@' + x.inv + '>' : 'nadie'));
  return efimero([V.T('### 👀 ¿Así es como te verás?'), V.T(l.join('\n') + (error ? '\n-# ' + error : ''))],
    [[b('Confirmar', 'vdc:ok', '✅', 3), b('Cambiar', 'vdc:ed', '✏️')]]);
}

/** ✅ El último mensaje: qué se abre al verificarte, y a dónde ir. `r` = `{aka, comp, ya, madrugada}` */
export function finalMsg(r) {
  const x = r || {};
  const arriba = x.ya ? '## ✅ Listo: tus datos quedaron al día' : '## ✅ ¡Verificación completada!';
  const l = [x.ya ? 'Ya estabas verificado, **' + x.aka + '**.' : '¡Bienvenido a **Under Legends**, **' + x.aka + '**!'];
  if (x.comp === 'nuevo') l.push('', '🐣 **¿Recién empiezas?** Anótate en el **Evento de Nuevos**: es sólo para los que empiezan, '
    + 'y te avisamos cuando estemos todos.');
  if (!x.ya) {
    l.push('', '**Lo que se abre al verificarte:**',
      '🃏 Tu tarjeta de **Servidor**: ' + (x.madrugada ? 'sale a las 11:22 AM (hora del este), cuando el bot vuelve a correr.'
        : 'sale en unos minutos.') + ' Pídela con `/card`.',
      '🎟️ El **Pase de rapero**: su nivel 1 te da la tarjeta de **Temporada**.',
      '🐉 Los **drops** del día, en la página.',
      '👥 Las **crews**: crea la tuya o únete a una.');
  }
  return efimero([V.T(arriba), V.T(l.join('\n'))],
    [[V.enlace('Evento de Nuevos', urlCanal(CANAL_NUEVOS), '🐣'), V.enlace('La página', PAGINA, '🌐')]], V.COLOR.verde);
}

/** 👋 La bienvenida pública del chat (suena sólo el nuevo) */
export function bienvenidaMsg(id, n, inv) {
  return V.mensaje({ color: V.COLOR.mag, efimero: false, menciones: { users: [id] },
    arriba: [V.T('👋 <@' + id + '> Eres el **#' + n + '**' + (inv ? '\n-# Invitado por <@' + inv + '> 🔗' : ''))],
    dentro: [V.T('### ¡Bienvenido a la comunidad!'),
      V.T('Aquí se rapea, se compite y se arma la Liga Global. Mira los eventos de hoy, salúdanos en el chat y, si es tu '
        + 'primera vez, anótate en el Evento de Nuevos.')],
    filas: [[V.enlace('¿Eres nuevo y no sabes qué hacer? Clic aquí', urlCanal(CANAL_EMPIEZA), '✅'), b('Saludar', 'vdc:hola:' + id, '👋')]] });
}
/** 👋 «@a le da la bienvenida a @b», con un GIF si hay, y el botón otra vez (suena sólo el nuevo) */
export function saludoMsg(de, a, gif = '') {
  return V.mensaje({ efimero: false, menciones: { users: [a] }, arriba: [V.T('👋 <@' + de + '> le da la bienvenida a <@' + a + '>')],
    dentro: [gif ? V.galeria(gif) : V.T('-# ¡Salúdalo tú también!')], filas: [[b('Saludar', 'vdc:hola:' + a, '👋')]] });
}
/** Los avisos de los hilos: el mismo formato que YAGPDB (contenido + embed), sin que suene nadie */
export const logVerifMsg = (x, id) => ({ content: '||LIGAID|' + x.aka + '|' + (PAIS[x.cc] ? PAIS[x.cc].k : '') + '|' + id + '|' + x.comp + '||',
  embeds: [{ title: '✅ Nuevo verificado en Liga Global', description: '**' + x.aka + '** se acaba de verificar.', color: V.COLOR.verde }],
  allowed_mentions: { parse: [] } });
export const logInviteMsg = (inv, id, c) => ({ embeds: [{ title: '🔗 Nueva invitación', color: V.COLOR.mag,
  description: '<@' + inv + '> invitó a <@' + id + '>' + (c ? '\n-# Lleva ' + c.temp + ' esta temporada · ' + c.total + ' en total' : '') }],
allowed_mentions: { parse: [] } });

// ── el objeto (`o` = el Durable Object: `o.sql`, `o.env`) ───────────────────────────────────────────────────────────
export function verifTablas(sql) {
  // lo que escribió cada uno mientras se verifica: dura 10 minutos desde el último paso
  sql.exec('CREATE TABLE IF NOT EXISTS vdc_borr (quien TEXT PRIMARY KEY, b TEXT NOT NULL, t INTEGER NOT NULL) WITHOUT ROWID');
  // los AKA tomados (`aka` ya normalizado), de quién son y de dónde salieron: «vdc» (se verificó acá) o «dra» (sembrado)
  sql.exec("CREATE TABLE IF NOT EXISTS vdc_aka (aka TEXT PRIMARY KEY, quien TEXT NOT NULL, t INTEGER NOT NULL, de TEXT NOT NULL DEFAULT 'vdc') WITHOUT ROWID");
  sql.exec('CREATE INDEX IF NOT EXISTS vdc_aka_quien ON vdc_aka (quien)');
  // la historia: la primera vez, la última, y lo que contestó
  sql.exec("CREATE TABLE IF NOT EXISTS vdc_hist (quien TEXT PRIMARY KEY, aka TEXT NOT NULL, cc TEXT NOT NULL, estado TEXT NOT NULL DEFAULT '', " +
    "comp TEXT NOT NULL, inv TEXT NOT NULL DEFAULT '', primera INTEGER NOT NULL, ultima INTEGER NOT NULL, temp TEXT NOT NULL) WITHOUT ROWID");
  // las invitaciones contadas: una por invitado y temporada
  sql.exec('CREATE TABLE IF NOT EXISTS vdc_inv (inv TEXT NOT NULL, quien TEXT NOT NULL, temp TEXT NOT NULL, t INTEGER NOT NULL, ' +
    'PRIMARY KEY (inv, quien, temp)) WITHOUT ROWID');
  // los saludos a cada nuevo (`a`), para el tope
  sql.exec('CREATE TABLE IF NOT EXISTS vdc_hola (a TEXT NOT NULL, de TEXT NOT NULL, t INTEGER NOT NULL, PRIMARY KEY (a, de)) WITHOUT ROWID');
}

const uno = (o, q, ...p) => o.sql.exec(q, ...p).toArray()[0] || null;
const tempDe = (o) => String((o && o.env && o.env.TEMPORADA) || 't1');
function leerBorr(o, quien, ahora) {
  const f = uno(o, 'SELECT b, t FROM vdc_borr WHERE quien = ?', quien);
  if (!f || ahora - Number(f.t) > BORRADOR_MS) return null;
  try { return JSON.parse(f.b); } catch (e) { return null; }
}
const ajeno = (o, aka, quien) => { const f = uno(o, 'SELECT quien FROM vdc_aka WHERE aka = ?', normAka(aka)); return !!(f && f.quien !== quien); };

/**
 * 📝 Un paso: `{quien, nuevo?, aka?, cc?, estado?, comp?, inv?}`. `nuevo` (el formulario del panel) arranca de cero; los
 * demás pasos necesitan un borrador de menos de 10 minutos. `{ok, b}` o `{error}`.
 */
export function borrador(o, d, ahora = Date.now()) {
  const quien = String((d && d.quien) || '');
  if (!SNOW.test(quien)) return { error: 'datos' };
  o.sql.exec('DELETE FROM vdc_borr WHERE t < ?', ahora - BORRADOR_MS);
  let x = d.nuevo ? {} : leerBorr(o, quien, ahora);
  if (!x) return { error: 'vencido' };
  if (d.aka !== undefined && d.aka !== '') {
    const v = validarAka(d.aka);
    if (v.error) return { error: v.error };
    if (ajeno(o, v.aka, quien)) return { error: 'en_uso' };
    x.aka = v.aka;
  }
  if (d.cc !== undefined) {
    if (!PAIS[d.cc]) return { error: 'datos' };
    x.cc = d.cc;
    if (d.cc !== 'us') delete x.estado;
  }
  if (d.estado !== undefined) {
    const e = validarEstado(d.estado);
    if (e.error) return { error: e.error };
    x.estado = e.estado;
  }
  if (d.comp !== undefined) { if (!COMP[d.comp]) return { error: 'datos' }; x.comp = d.comp; }
  if (d.inv !== undefined) {
    if (d.inv && (!SNOW.test(String(d.inv)) || String(d.inv) === quien)) return { error: 'datos' };
    x.inv = String(d.inv || '');
  }
  if (!x.aka || !x.cc) return { error: 'incompleto' };
  if (x.cc === 'us' && !x.estado) return { error: 'estado' };
  o.sql.exec('INSERT OR REPLACE INTO vdc_borr (quien, b, t) VALUES (?, ?, ?)', quien, JSON.stringify(x), ahora);
  return { ok: true, b: x };
}

/** 🔒 Antes de tocar Discord: el borrador completo, y el AKA queda a su nombre (el de antes, si tenía otro, se libera) */
export function reservar(o, d, ahora = Date.now()) {
  const quien = String((d && d.quien) || '');
  if (!SNOW.test(quien)) return { error: 'datos' };
  const x = leerBorr(o, quien, ahora);
  if (!x) return { error: 'vencido' };
  if (!x.aka || !x.cc || !COMP[x.comp] || x.inv === undefined) return { error: 'incompleto' };
  const k = normAka(x.aka);
  if (ajeno(o, k, quien)) return { error: 'en_uso' };
  o.sql.exec('DELETE FROM vdc_aka WHERE quien = ? AND aka != ?', quien, k);
  o.sql.exec("INSERT OR REPLACE INTO vdc_aka (aka, quien, t, de) VALUES (?, ?, ?, 'vdc')", k, quien, ahora);
  return { ok: true, b: x, temp: tempDe(o) };
}

/**
 * ✅ Después de que Discord dijo que sí: la historia y la invitación. `{quien, ya}` (`ya` = ya era Miembro antes).
 * La invitación cuenta si entra recién (no era Miembro), tiene a quién, y no se había verificado hace menos de 60 días.
 * `{ok, entra, credito: {temp, total} | null}`.
 */
export function listo(o, d, ahora = Date.now()) {
  const quien = String((d && d.quien) || '');
  if (!SNOW.test(quien)) return { error: 'datos' };
  const x = leerBorr(o, quien, ahora);
  if (!x) return { error: 'vencido' };
  const temp = tempDe(o);
  const antes = uno(o, 'SELECT primera, ultima FROM vdc_hist WHERE quien = ?', quien);
  const entra = !d.ya;
  o.sql.exec('INSERT OR REPLACE INTO vdc_hist (quien, aka, cc, estado, comp, inv, primera, ultima, temp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    quien, x.aka, x.cc, x.estado || '', x.comp, x.inv || '', antes ? Number(antes.primera) : ahora, ahora, temp);
  let credito = null;
  const revino = antes && ahora - Number(antes.ultima) < REVINO_DIAS * DIA_MS;
  if (entra && x.inv && !revino) {
    const r = o.sql.exec('INSERT OR IGNORE INTO vdc_inv (inv, quien, temp, t) VALUES (?, ?, ?, ?)', x.inv, quien, temp, ahora);
    if (r.rowsWritten) {
      const c = (q, ...p) => Number((uno(o, q, ...p) || {}).n) || 0;
      credito = { temp: c('SELECT COUNT(*) AS n FROM vdc_inv WHERE inv = ? AND temp = ?', x.inv, temp),
        total: c('SELECT COUNT(DISTINCT quien) AS n FROM vdc_inv WHERE inv = ?', x.inv) };
    }
  }
  o.sql.exec('DELETE FROM vdc_borr WHERE quien = ?', quien);
  return { ok: true, entra, credito, b: x };
}

/** 👋 Un saludo `{de, a}`: `{ok}` o `{error: 'hola_yo'|'hola_tope'|'hola_ya'}` */
export function saludo(o, d, ahora = Date.now()) {
  const de = String((d && d.de) || ''), a = String((d && d.a) || '');
  if (!SNOW.test(de) || !SNOW.test(a)) return { error: 'datos' };
  if (de === a) return { error: 'hola_yo' };
  o.sql.exec('DELETE FROM vdc_hola WHERE t < ?', ahora - SALUDOS_DIAS * DIA_MS);
  if (uno(o, 'SELECT 1 AS x FROM vdc_hola WHERE a = ? AND de = ?', a, de)) return { error: 'hola_ya' };
  const n = Number((uno(o, 'SELECT COUNT(*) AS n FROM vdc_hola WHERE a = ?', a) || {}).n) || 0;
  if (n >= SALUDOS_MAX) return { error: 'hola_tope' };
  o.sql.exec('INSERT INTO vdc_hola (a, de, t) VALUES (?, ?, ?)', a, de, ahora);
  return { ok: true, n: n + 1 };
}

/** 🌱 Los AKA de quienes ya están (`{akas: [[aka, quien], …]}`, de la herramienta): no pisa ninguno que ya esté */
export function sembrar(o, d, ahora = Date.now()) {
  const l = Array.isArray(d && d.akas) ? d.akas.slice(0, 6000) : [];
  let n = 0;
  for (const [aka, quien] of l) {
    const k = normAka(aka);
    if (!k || [...k].length > 32 || !SNOW.test(String(quien))) continue;
    n += o.sql.exec("INSERT OR IGNORE INTO vdc_aka (aka, quien, t, de) VALUES (?, ?, ?, 'dra')", k, String(quien), ahora).rowsWritten || 0;
  }
  const total = Number((uno(o, 'SELECT COUNT(*) AS n FROM vdc_aka') || {}).n) || 0;
  return { ok: true, nuevos: n, total };
}

/** 🗑️ «Olvidarme»: todo lo suyo (desde `olvidar()` del objeto) */
export function olvidar(o, quien) {
  for (const t of ['vdc_borr', 'vdc_hist', 'vdc_aka']) o.sql.exec(`DELETE FROM ${t} WHERE quien = ?`, quien);
  o.sql.exec('DELETE FROM vdc_inv WHERE quien = ? OR inv = ?', quien, quien);
  o.sql.exec('DELETE FROM vdc_hola WHERE a = ? OR de = ?', quien, quien);
}

/** La entrada del objeto: `/vdc-<que>` */
export function objeto(o, que, d, ahora = Date.now()) {
  if (que === 'borrador') return borrador(o, d, ahora);
  if (que === 'reservar') return reservar(o, d, ahora);
  if (que === 'listo') return listo(o, d, ahora);
  if (que === 'saludo') return saludo(o, d, ahora);
  if (que === 'sembrar') return sembrar(o, d, ahora);
  return { error: 'no existe' };
}

// ── el Worker ───────────────────────────────────────────────────────────────────────────────────────────────────────
const idDe = (i) => (i.member && i.member.user && i.member.user.id) || (i.user && i.user.id) || '';
const responder = (tipo, data) => new Response(JSON.stringify(data === undefined ? { type: tipo } : { type: tipo, data }),
  { headers: { 'content-type': 'application/json' } });
const luego = (ctx, p) => { if (ctx && ctx.waitUntil) ctx.waitUntil(p); else p.catch(() => {}); };
const alObj = (env, que, d) => env.AVISOS.get(env.AVISOS.idFromName('liga')).fetch('https://avisos/vdc-' + que, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(d || {}),
}).then((r) => r.json()).catch(() => ({ error: 'red' }));
const bot = (env, extra) => Object.assign({ Authorization: 'Bot ' + env.DISCORD_TOKEN, 'X-Audit-Log-Reason': RAZON,
  'User-Agent': 'DiscordBot (https://underlegends.pages.dev, 1)' }, extra || {});
const editarOriginal = (i, data) => fetch(`${API}/webhooks/${i.application_id}/${i.token}/messages/@original`, {
  method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }).catch(() => null);
const avisoTxt = (e) => V.avisoMsg(TXT[e] || TXT.red);
/** ¿El mensaje del botón es efímero? (sólo esos se editan: el panel público no se toca nunca) */
const enEfimero = (i) => !!(i.message && (Number(i.message.flags) & 64));

/** Lo escrito en el formulario: `{aka, estado}` */
export function leerModal(i) {
  const out = {};
  for (const f of (i.data && i.data.components) || []) {
    for (const c of f.components || (f.component ? [f.component] : [])) if (c && c.custom_id) out[c.custom_id] = String(c.value || '');
  }
  return out;
}

/**
 * Lo que hace cada paso. Contesta YA (Discord corta a los 3 s y el objeto puede estar dormido) y edita después:
 *   · en un mensaje efímero, «ya va» (tipo 6) y se edita ese mismo mensaje
 *   · desde el panel público, un mensaje efímero nuevo (`pensando()`)
 */
function trabajo(i, ctx, h, fn) {
  if (enEfimero(i)) {
    luego(ctx, (async () => { let m; try { m = await fn(); } catch (e) { m = avisoTxt('red'); } await editarOriginal(i, m); })());
    return responder(6);
  }
  return h.pensandoYEditar(i, ctx, fn);
}
/** El borrador con un cambio, y lo que se muestra después: `siguiente(b)` */
const paso = (env, yo, cambio, siguiente) => async () => {
  const r = await alObj(env, 'borrador', Object.assign({ quien: yo }, cambio));
  if (!r.ok) return r.error === 'en_uso' || r.error === 'reservado' ? efimero([V.T('### ✏️ ' + TXT[r.error])], [[b('Cambiar mi AKA', 'vdc:ea', '✏️')]]) : avisoTxt(r.error);
  return siguiente(r.b);
};

/**
 * 🔘 Un clic (menú, botón o usuario elegido) con `vdc:…`. `h`: lo del Worker que hace falta (frenado, espera, aviso,
 * pensandoYEditar, anotar, enMadrugada, luego, ctx). Ver el encabezado.
 */
export function componente(i, env, ctx, h) {
  const yo = idDe(i);
  const [, que, x, y] = String((i.data && i.data.custom_id) || '').split(':');
  if (que === 'hola') return saludar(i, env, ctx, h, x);
  const esperar = h.frenado(yo, 'click');
  if (esperar) return h.espera(esperar);
  if (!SNOW.test(yo)) return h.aviso('No pude saber quién eres: prueba de nuevo.');
  if (i.guild_id !== GUILD_DRA) return h.aviso(TXT.fuera);
  const val = String(((i.data && i.data.values) || [])[0] || '');
  const temp = (env && env.TEMPORADA) || 't1';
  const aVista = (bb) => vista(bb, temp);
  switch (que) {
    case 'pais': // el panel: el formulario, enseguida
      return PAIS[val] ? responder(9, modal(val).data) : h.aviso(TXT.boton);
    case 'p2': // cambiar el país: Estados Unidos pide el estado (otro formulario); los demás, directo a la vista
      if (!PAIS[val]) return h.aviso(TXT.boton);
      if (val === 'us') return responder(9, modal('us', true).data);
      return trabajo(i, ctx, h, paso(env, yo, { cc: val }, aVista));
    case 'c': // la competencia: en la primera vuelta sigue la invitación; cambiándola, la vista
      if (!COMP[x]) return h.aviso(TXT.boton);
      return trabajo(i, ctx, h, paso(env, yo, { comp: x }, y === 'e' ? aVista : () => pasoInvito()));
    case 'i':
      if (x === 'si') return trabajo(i, ctx, h, async () => pasoQuien());
      if (x === 'no') return trabajo(i, ctx, h, paso(env, yo, { inv: '' }, aVista));
      return h.aviso(TXT.boton);
    case 'iu': { // a quién eligió: ni uno mismo ni un bot
      const u = ((i.data && i.data.resolved && i.data.resolved.users) || {})[val] || {};
      if (!SNOW.test(val)) return h.aviso(TXT.boton);
      if (val === yo) return trabajo(i, ctx, h, async () => pasoQuien(TXT.invito_yo));
      if (u.bot) return trabajo(i, ctx, h, async () => pasoQuien(TXT.invito_bot));
      return trabajo(i, ctx, h, paso(env, yo, { inv: val }, aVista));
    }
    case 'pv': return trabajo(i, ctx, h, paso(env, yo, {}, aVista));
    case 'ed': return trabajo(i, ctx, h, async () => menuCambiar());
    case 'ea': return responder(9, modal('-', true).data);
    case 'ep': return trabajo(i, ctx, h, async () => paisEditar());
    case 'er': return trabajo(i, ctx, h, async () => pasoCompetir(true));
    case 'ei': return trabajo(i, ctx, h, async () => pasoInvito());
    case 'ok': return trabajo(i, ctx, h, () => confirmar(i, env, ctx, h, yo));
    default: return h.aviso(TXT.boton);
  }
}

/** 📝 El formulario enviado: `vdc:m:<cc|->[:e]`. Lo que no pide red se contesta enseguida */
export function formulario(i, env, ctx, h) {
  const yo = idDe(i);
  const esperar = h.frenado(yo, 'click');
  if (esperar) return h.espera(esperar);
  if (!SNOW.test(yo)) return h.aviso('No pude saber quién eres: prueba de nuevo.');
  if (i.guild_id !== GUILD_DRA) return h.aviso(TXT.fuera);
  const [, , cc, e] = String((i.data && i.data.custom_id) || '').split(':');
  const edicion = e === 'e';
  if (cc !== '-' && !PAIS[cc]) return h.aviso(TXT.boton);
  const f = leerModal(i);
  const cambio = {};
  if (f.aka || !edicion) {
    const v = validarAka(f.aka);
    if (v.error) return h.aviso(TXT[v.error]);
    cambio.aka = v.aka;
  }
  if (cc !== '-') cambio.cc = cc;
  if (cc === 'us') {
    const s = validarEstado(f.estado);
    if (s.error) return h.aviso(TXT[s.error]);
    cambio.estado = s.estado;
  }
  if (!edicion) cambio.nuevo = true;
  const temp = (env && env.TEMPORADA) || 't1';
  return trabajo(i, ctx, h, paso(env, yo, cambio, edicion ? (bb) => vista(bb, temp) : () => pasoCompetir()));
}

/**
 * ✅ Confirmar: el AKA queda reservado, Discord pone los roles y el apodo, y recién entonces la historia, la invitación,
 * los avisos y la bienvenida. Devuelve el mensaje efímero final.
 */
export async function confirmar(i, env, ctx, h, yo) {
  if (!env.DISCORD_TOKEN) return avisoTxt('discord');
  const rs = await alObj(env, 'reservar', { quien: yo });
  if (!rs.ok) return rs.error === 'en_uso' ? efimero([V.T('### ✏️ ' + TXT.en_uso)], [[b('Cambiar mi AKA', 'vdc:ea', '✏️')]]) : avisoTxt(rs.error);
  const x = rs.b, temp = rs.temp || 't1';
  const base = `${API}/guilds/${GUILD_DRA}/members/${yo}`;
  let m = null, g = {};
  try {
    const [rm, rg] = await Promise.all([fetch(base, { headers: bot(env) }),
      fetch(`${API}/guilds/${GUILD_DRA}?with_counts=true`, { headers: bot(env) })]);
    if (rm.status === 404) return avisoTxt('no_dra');
    if (!rm.ok) return avisoTxt('discord');
    m = await rm.json();
    if (rg.ok) g = await rg.json();
  } catch (e) { return avisoTxt('discord'); }
  if (m.pending === true) return avisoTxt('pendiente');
  const roles = new Set(m.roles || []);
  const ya = roles.has(ROL_MIEMBRO);
  const rolPais = PAIS[x.cc].rol;
  const r = await rolesDe(env, base, roles, rolPais);
  if (r) return avisoTxt(r);
  // 🏷️ el apodo: al dueño del servidor Discord no deja ponérselo, así que ni se intenta. Si falla, la verificación vale igual
  if (String(g.owner_id || '') !== yo) {
    try {
      await fetch(base, { method: 'PATCH', headers: bot(env, { 'content-type': 'application/json' }),
        body: JSON.stringify({ nick: (genDe(temp) + ' | ' + x.aka).slice(0, 32) }) });
    } catch (e) { /* queda el apodo de antes */ }
  }
  const fin = await alObj(env, 'listo', { quien: yo, ya });
  const avisos = [];
  const post = (canal, cuerpo) => fetch(`${API}/channels/${canal}/messages`, { method: 'POST',
    headers: bot(env, { 'content-type': 'application/json' }), body: JSON.stringify(cuerpo) }).catch(() => null);
  if (fin && fin.ok && fin.entra) {
    const n = Number(g.approximate_member_count) || 0;
    avisos.push(post(HILO_VERIF, logVerifMsg(x, yo)), post(CANAL_BIENVENIDA, bienvenidaMsg(yo, n || '?', x.inv)));
    if (fin.credito && x.inv) avisos.push(post(HILO_INVITES, logInviteMsg(x.inv, yo, fin.credito)));
  }
  await Promise.all(avisos);
  // 🗂️ como la página (`cuentaVerificar()`): se anota para que la vuelta del ciclo lo encuentre, y esa vuelta, ya
  const u = m.user || {};
  if (h.anotar) h.anotar(yo, m.nick || '', u.username || '', u.global_name || '');
  const madrugada = !!(h.enMadrugada && h.enMadrugada(new Date(Date.now())));
  if (!ya && !madrugada && env.AVISOS) {
    luego(ctx, env.AVISOS.get(env.AVISOS.idFromName('liga')).fetch('https://avisos/ciclo-verificar', { method: 'POST', body: '{}' })
      .then((q) => q.json()).catch(() => null));
  }
  return finalMsg({ aka: x.aka, comp: x.comp, ya, madrugada });
}

/** Los roles: el del país (y fuera los de otro país), el Miembro, fuera el Invitado. Devuelve el error o '' */
async function rolesDe(env, base, roles, rolPais) {
  const pedir = async (metodo, rol) => {
    try { const q = await fetch(base + '/roles/' + rol, { method: metodo, headers: bot(env) }); return q.status; } catch (e) { return -1; }
  };
  // 403: el rol del bot quedó por debajo de alguno de estos, o le sacaron «Gestionar roles»
  const mal = (st) => (st === 403 ? 'permiso' : 'discord');
  // primero lo que se pone: si algo falla a la mitad, nadie queda sin país
  for (const rol of [rolPais, ROL_MIEMBRO]) {
    if (roles.has(rol)) continue;
    const st = await pedir('PUT', rol);
    if (st !== 204) return mal(st);
  }
  for (const rol of [...roles].filter((x) => x !== rolPais && ROLES_PAIS.has(x)).concat(roles.has(ROL_INVITADO) ? [ROL_INVITADO] : [])) {
    const st = await pedir('DELETE', rol);
    if (st !== 204 && st !== 404) return mal(st);
  }
  return '';
}

/** 👋 «Saludar» (`vdc:hola:<nuevo>`), en la bienvenida pública: cualquiera menos el nuevo, hasta 4 en 7 días */
function saludar(i, env, ctx, h, a) {
  const de = idDe(i);
  const esperar = h.frenado(de, 'click');
  if (esperar) return h.espera(esperar);
  if (!SNOW.test(de) || !SNOW.test(String(a || ''))) return h.aviso(TXT.boton);
  if (de === a) return h.aviso(TXT.hola_yo);
  luego(ctx, (async () => {
    const r = await alObj(env, 'saludo', { de, a });
    if (r && r.ok && env.DISCORD_TOKEN) {
      const gif = GIFS_SALUDO.length ? GIFS_SALUDO[Math.floor(Math.random() * GIFS_SALUDO.length)] : '';
      await fetch(`${API}/channels/${i.channel_id}/messages`, { method: 'POST', headers: bot(env, { 'content-type': 'application/json' }),
        body: JSON.stringify(saludoMsg(de, a, gif)) }).catch(() => null);
      return;
    }
    await fetch(`${API}/webhooks/${i.application_id}/${i.token}`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(V.avisoMsg(TXT[r && r.error] || TXT.red)) }).catch(() => null);
  })());
  return responder(6);
}

/**
 * 📌 `/verificar-dc` (con la clave del ciclo, de `herramientas/verificar_dc_panel.py`):
 *   · `{accion: 'panel', canal, msg?, img?}`: con `msg` se EDITA ese mensaje; si no existe o no hay `msg`, se publica
 *     uno. `img`, el banner ya subido a R2 (`R2_PANELES`)
 *   · `{accion: 'sembrar', akas}`: los AKA de quienes ya están, al objeto
 * ⚠️ Sólo en un canal de DRA: se le pregunta a Discord de qué servidor es antes de escribir nada.
 */
export async function ruta(req, env) {
  const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'content-type': 'application/json; charset=utf-8' } });
  let d = null;
  try { d = await req.json(); } catch (e) { d = null; }
  if (!d || !env.DISCORD_TOKEN) return json({ error: 'datos' }, 400);
  if (d.accion === 'sembrar') return json(await alObj(env, 'sembrar', { akas: d.akas }));
  if (d.accion !== 'panel' || !SNOW.test(String(d.canal || '')) || (d.msg && !SNOW.test(String(d.msg)))) return json({ error: 'datos' }, 400);
  const c = await fetch(`${API}/channels/${d.canal}`, { headers: bot(env) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!c || c.guild_id !== GUILD_DRA) return json({ error: 'canal' }, 400);
  if (d.img && !imgValida(d.img)) return json({ error: 'img' }, 400);
  const cuerpo = JSON.stringify(panelMsg(d.img || ''));
  const h = bot(env, { 'content-type': 'application/json' });
  if (d.msg) {
    const r = await fetch(`${API}/channels/${d.canal}/messages/${d.msg}`, { method: 'PATCH', headers: h, body: cuerpo }).catch(() => null);
    if (r && r.status === 200) return json({ ok: true, msg: String(d.msg), editado: true });
    if (!r || r.status !== 404) return json({ error: 'discord', estado: r ? r.status : 0 }, 502);
  }
  const r = await fetch(`${API}/channels/${d.canal}/messages`, { method: 'POST', headers: h, body: cuerpo }).catch(() => null);
  const j = r && r.ok ? await r.json().catch(() => ({})) : {};
  if (!j.id) return json({ error: 'discord', estado: r ? r.status : 0 }, 502);
  return json({ ok: true, msg: String(j.id), nuevo: true });
}
