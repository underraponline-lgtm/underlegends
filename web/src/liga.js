// La Liga, leída del payload público (`/api/lobby`, el mismo `D` de app.js) y del muro (`/api/muro`).
// Es la traducción de la clase `Liga` de docs/remake/reales.py, el prototipo que se miró con Dlx: si una regla cambia
// allá, cambia acá.
import { cartaPrincipalDe, versionRedibujo } from './pase.js';

// 🔒 el Discord ID del dueño de la Liga (público: es un ID). Sólo muestra el atajo al Dashboard; quién entra lo decide
// el servidor (`DUENO` de bot/avisos.js, el mismo número)
// 🗞️ las etiquetas de las historias del chat (bot/chats.py `ORDEN_QUE`; tanda 3, 21/11/2026)
const CHAT_ETQ = { reto: 'DESAFÍO', cara: 'CARA A CARA', retiro: '¿SE RETIRA?', regreso: 'VUELVE', elogio: 'EL CHAT SE RINDE',
  favorito: 'FAVORITO', polemica: 'POLÉMICA', raid: 'RAID', pico: 'EL CHAT', tema: 'EL CHAT' };

export const DUENO = '739338101603696681';

export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre',
  'octubre', 'noviembre', 'diciembre'];
export const PAIS = {
  ar: 'Argentina', co: 'Colombia', cl: 'Chile', ve: 'Venezuela', mx: 'México', pe: 'Perú', uy: 'Uruguay',
  ec: 'Ecuador', bo: 'Bolivia', py: 'Paraguay', us: 'Estados Unidos', es: 'España', do: 'Rep. Dominicana',
  pa: 'Panamá', pr: 'Puerto Rico', cr: 'Costa Rica', gt: 'Guatemala', hn: 'Honduras', sv: 'El Salvador',
  ni: 'Nicaragua', cu: 'Cuba', br: 'Brasil', ae: 'Emiratos', no: 'Noruega',
};

// sin emojis, banderas ni rellenos invisibles: «RIZAS 🇻🇪» -> «RIZAS» (con `u`, punto de código por punto de código: el
// selector de variante y el unidor sueltos se van a propósito). Y los DIBUJOS DE CAJA (U+2500 a U+259F: ┃ ┣ ━ ╎ ▀): ningún
// nombre los lleva, y una llave dibujada con ellos dejaba «┃ MAJIZTRAL ┣━━━━━━━━━━┫ ┃ MATS ┃» como campeón, sin dónde
// partirse y encimado con «Ver la llave» (FMS Ceuta, 16/11/2026)
// eslint-disable-next-line no-misleading-character-class
const FUERA =/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{20E3}\u{200D}\u{3164}\u{2800}\u{2070}-\u{209F}\u{B9}\u{B2}\u{B3}\u{E0020}-\u{E007F}\u{2500}-\u{259F}]/gu;
export function limpio(s) {
  return String(s || '').replace(FUERA, '').replace(/\s+/g, ' ').replace(/^[ ·•-]+|[ ·•-]+$/g, '');
}
// 🔤 EL NOMBRE CON LA INICIAL EN MAYÚSCULA (Dlx, 03/10/2026, con la llave de LA REDENCION: «que todo esté en
// minúsculas exceptuando por la inicial»). La llave trae cada nombre como lo escribió el organizador —«MAYEUTYK»,
// «yinn», «BLITZ (R)»— y en una columna se lee como un grito al lado de un susurro.
// ⚠️ SÓLO LO QUE VIENE TODO EN MAYÚSCULAS O TODO EN MINÚSCULAS: «PichulaMc» o «PolloSport» se escriben así a propósito.
// Y lo de una o dos letras va en mayúsculas: «OG», «NC», la «R» del revivido
export function capital(s) {
  const t = String(s || '');
  const letras = t.replace(/[^\p{L}]/gu, '');
  if (!letras || (letras !== letras.toUpperCase() && letras !== letras.toLowerCase())) return t;
  return t.replace(/[\p{L}\p{N}]+/gu, (w) => (w.length <= 2 ? w.toUpperCase()
    : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()));
}
// ✂️ `corte`: el largo al que el ciclo ya cortó ese texto (18/11/2026). La palabra corta del final se saca porque puede ser
// media palabra de un texto cortado; si el texto es más corto que el corte, vino entero y no se le come nada
export function recorte(s, n = 120, corte = 0) {
  const crudo = String(s || '').length;
  s = limpio(s).replace(/\*/g, '');
  if (s.length <= n && ((corte && crudo < corte) || !/\s\S{1,2}$/.test(s))) return s;
  const t = s.slice(0, n);
  const i = t.lastIndexOf(' ');
  return (i > 0 ? t.slice(0, i) : t).replace(/[ ,.;:]+$/, '') + '…';
}
// el resultado de una llave, en palabras: «R32» o «Cuartos» solos no dicen nada en grande. `corto` para una ficha
const RES = {
  'Campeón': ['CAMPEÓN', 'CAMPEÓN'], 'Subcampeón': ['SUBCAMPEÓN', 'SUBCAMPEÓN'], 'Tercero': ['TERCER PUESTO', '3.º'],
  'Cuarto': ['CUARTO PUESTO', '4.º'], 'Semifinal': ['SEMIFINALISTA', 'SEMIS'], 'Cuartos': ['LLEGASTE A CUARTOS', 'CUARTOS'],
  'Octavos': ['LLEGASTE A OCTAVOS', 'OCTAVOS'], 'R32': ['LLEGASTE A 16AVOS', '16AVOS'],
};
export function resultado(r, corto = false) {
  const x = RES[r];
  return x ? x[corto ? 1 : 0] : String(r || '').toUpperCase();
}
// 🏷️ LA LLAVE SIN NOMBRE (18/11/2026): el lector guarda «(sin titulo)», y crudo llegaba a Lo último, a la llave y a Eventos.
// `esSinTitulo()` lo reconoce; `nombreEv()` da el que se lee —«la llave #N» o «un evento»— (la convención de _worker.js)
export const esSinTitulo = (s) => /^\(?\s*sin\s+t[ií]tulo\s*\)?$/i.test(limpio(s));
export function nombreEv(ev, ll) {
  const s = limpio(ev);
  return !s || esSinTitulo(s) ? (ll ? 'la llave #' + ll : 'un evento') : s;
}
export const num = (n) => String(Math.trunc(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export const mult = (x) => '×' + String(x || 1).replace('.', ',');
// 🕐 una hora del este (0–23) en 12 h: «11 PM»
export const horaET = (h) => { const n = Number(h) || 0; return (n % 12 || 12) + (n < 12 ? ' AM' : ' PM'); };
// 🔤 y las letras que NFKD no desarma (ø, đ, ł, ß, æ, œ…): las mismas que `nombres.plegar()` del Python (18/10/2026,
// Dlx: «¿por qué no en general?»). Buscar «tokio» encuentra a «TøKīØ»
const PLEGAR = { ø: 'o', Ø: 'O', đ: 'd', Đ: 'D', ł: 'l', Ł: 'L', ß: 'ss', ẞ: 'SS', æ: 'ae', Æ: 'AE', œ: 'oe', Œ: 'OE', ı: 'i',
  þ: 'th', Þ: 'TH', ð: 'd', Ð: 'D', ħ: 'h', Ħ: 'H', ŧ: 't', Ŧ: 'T', ŀ: 'l', Ŀ: 'L', ĸ: 'k', ƒ: 'f' };
export const norm = (s) => String(s || '').replace(/[øØđĐłŁßẞæÆœŒıþÞðÐħĦŧŦŀĿĸƒ]/g, (c) => PLEGAR[c]).normalize('NFKD')
  .replace(/[̀-ͯ]/g, '').toLowerCase();

// las fechas del payload: con Z o sin zona (y entonces son UTC, como en el Python)
export function utc(s) {
  if (!s) return new Date(NaN);
  // 🔴 UNA FECHA YA ES UN INSTANTE: se devuelve tal cual. `dia()` le pasaba a `hora()` el `Date` ya convertido, y
  // `String(Date)` —«Thu Oct 01 2026 18:29:10 GMT-0400 (…)»— con una «Z» pegada se volvía a leer como UTC: toda hora
  // del Inicio salía corrida por el huso de quien mira. POESÍA CRUDA empezó a las 6:29 PM ET y decía «empezó 14:29»
  // (Dlx, 01/10/2026, en sus capturas)
  if (s instanceof Date) return s;
  // ⚠️ y un número son milisegundos: `cancelados[].ini` (del vigía) era una «Invalid Date» y el grupo «Cancelados»
  // de Eventos no salía nunca (revisión del 03/10/2026)
  if (typeof s === 'number') return new Date(s);
  const t = String(s);
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(t) ? t : t + 'Z');
}

// ── las horas: en la zona y el formato que la persona eligió en Ajustes (las funciones de app.js) ──
const W = typeof window !== 'undefined' ? window : {};
// 🔤 LA SIGLA QUE SE LEE (Dlx, 03/10/2026: «cambia… SNAKE RAP de SR a SNK queda mejor y de URBF a URB»). El código
// sigue siendo la clave de todo —colores, logos, cartas, el Sheet, los links que ya circulan—: sólo cambia lo que se
// lee. Sale del payload (`svs[].sigla`, de `datos/servidores.json`) y la llena cada `Liga` nueva
let SIGLAS = {};
export function siglaDe(sv) { return SIGLAS[sv] || sv || ''; }
// 🔑 los perfiles de una publicación del muro, SIEMPRE en lista. En los premios de la semana `ks` es un objeto
// —`{figura: clave, revelacion: clave, cazador: clave}`, ver bot/muro.py— y recorrerlo como lista tiraba el perfil de
// TODOS los servidores (`svDe()`) y las historias de tu país, tu crew y a quién seguís desde el 12/10/2026 a las
// 11 AM, cuando salieron los primeros premios. Lo de antes vivía sólo en publicaciones.jsx (13/10/2026)
export const ksDe = (it) => (Array.isArray(it && it.ks) ? it.ks : it && it.ks && typeof it.ks === 'object' ? Object.values(it.ks) : []);
// como `normNombre()` de app.js: la clave de `alias` en el payload (`respaldo._norm`)
export const normNombre = (s) => String(s || '').normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
// 🔑 LA CLAVE DE UN NOMBRE, como `comun/claves.py` (18/11/2026, la pasada de bugs de las páginas): sin banderas ni «❓»,
// NFD, minúsculas y lo alfanumérico de cualquier alfabeto. Probada contra las 856 claves de /api/perfiles: coincide en
// 841; las otras 15 son choques con sufijo (`volk-co`, `julix-x`), por eso quien la usa mira antes `alias`
const banderasTxt = (s) => (String(s || '').match(/[\u{1F1E6}-\u{1F1FF}]{2}/gu) || []).sort().join('');
export const claveDe = (n) => String(n || '').replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').replace(/❓/g, '').trim().toLowerCase()
  .normalize('NFD').replace(/[^\p{L}\p{N}]/gu, '') || 'sinnombre';
// «1.10» es más nueva que «1.9»: se comparan los números, no el texto (la regla de `nuevaQue()` de app.js)
export function nuevaQue(a, b) {
  const pa = String(a || '').split('.').map(Number);
  const pb = String(b || '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (isNaN(x) || isNaN(y)) return String(a) > String(b);
    if (x !== y) return x > y;
  }
  return false;
}
/**
 * 🖼️ LA DIRECCIÓN DEL LOGO DE UNA CREW, EN UN SOLO LUGAR (19/10/2026). El de una crew que subió su Líder viene de R2 con
 * la URL entera; los de antes, del repo (`logos/crews/X.webp`). Cuatro lugares la armaban a mano y dos le pegaban la
 * barra a la URL entera —`/https://…`, un 404—: el Inicio y las historias (lo encontró la revisión del 19/10).
 */
export function srcLogo(logo) {
  if (!logo) return '';
  return /^https:\/\//.test(logo) ? logo : '/' + String(logo).replace(/^\//, '');
}
export function hora(t) {
  const d = utc(t);
  if (W.fmtHora) return W.fmtHora(d);
  return d.toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' });
}
export function diaISO(d) {
  if (W.diaDe) return W.diaDe(d);
  const p = (x) => String(x).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function diasEntre(a, b) {
  return Math.round((Date.parse(diaISO(b)) - Date.parse(diaISO(a))) / 86400000);
}
function diaSemana(d) {
  const [y, m, dd] = diaISO(d).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, dd)).getUTCDay();
}
function diaMes(d) { return Number(diaISO(d).split('-')[2]); }
// 🕐 UNA HORA ESCRITA («AAAA-MM-DDTHH:mm», de un `<input type="datetime-local">`) LEÍDA EN LA ZONA DE AJUSTES (18/11/2026):
// `new Date(s)` la lee en la del dispositivo y después se mostraba en la elegida, corrida. Las dos vueltas de
// `utcDeZona()` de bot/worker.js. Sin zona elegida, o si no se puede leer, la del dispositivo
export function msDeLocal(s) {
  const z = (W.zona && W.zona()) || '';
  const pared = Date.parse(String(s || '') + 'Z');
  if (!z || isNaN(pared)) return new Date(s).getTime();
  try {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: z, hourCycle: 'h23', year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const enZona = (ms) => {
      const p = {};
      fmt.formatToParts(new Date(ms)).forEach((x) => { p[x.type] = x.value; });
      return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    };
    let t = pared - (enZona(pared) - pared);
    t -= enZona(t) - pared;
    return t;
  } catch (e) { return new Date(s).getTime(); }
}
// los minutos desde la medianoche, en la zona de quien mira (la de Ajustes si eligió una: `zona()` de app.js)
// ⚡ un formateador por zona y cada instante se recuerda (17/11/2026): era la segunda cosa que más tardaba al entrar a Eventos
let minFmt = null;
let minTz = null;
let minMemo = new Map();
export function minutosDelDia(t) {
  const d = utc(t);
  try {
    const z = (W.zona && W.zona()) || '';
    if (!minFmt || minTz !== z) {
      const o = { hour: 'numeric', minute: 'numeric', hourCycle: 'h23' };
      if (z) o.timeZone = z;
      minFmt = new Intl.DateTimeFormat('en-US', o);
      minTz = z;
      minMemo = new Map();
    }
    const k = +d;
    const c = minMemo.get(k);
    if (c !== undefined) return c;
    const p = {};
    minFmt.formatToParts(d).forEach((x) => { p[x.type] = x.value; });
    const n = (Number(p.hour) % 24) * 60 + Number(p.minute);
    if (!isNaN(n)) {
      if (minMemo.size > 20000) minMemo = new Map();
      minMemo.set(k, n);
      return n;
    }
  } catch (e) { /* la del dispositivo */ }
  return d.getHours() * 60 + d.getMinutes();
}
// 🔴 ANTES PASABA POR `fmtFecha()`, que es `toLocaleDateString`: con sólo la hora pedida, el navegador le agrega la
// fecha («1/10/2026, 20»), y sacarle lo que no es número daba 110202620. «Anoche» salía para todo lo de ayer —también
// lo de las 5 PM— y nunca para lo de esta madrugada (02/10/2026)
function horaNum(d) {
  return Math.floor(minutosDelDia(d) / 60);
}

export class Liga {
  constructor(D, muro, ahora, yo, sigue, yoFila) {
    this.d = D;
    this.muro = (muro && muro.items) || [];
    // 📌 la fijada arriba con Mods (20/11/2026, `bot/muro.py`): el `id` de una del muro, o nada
    this.muroFijo = String((muro && muro.fijo) || '');
    // ⏳ el muro llega después del lobby: «no hay nada» y «todavía no llegó» son cosas distintas
    this.muroListo = !!muro;
    this.ahora = ahora || new Date();
    this.T = {};
    // 🃏 los que no están en la tabla y se abrieron (su perfil): ver `fuera()`
    this.X = {};
    this.N = {};
    this.E = {};
    this.dobles = new Set();
    (D.tabla || []).forEach((r) => {
      const n = limpio(r.n).toLowerCase();
      if (this.N[n]) this.dobles.add(n);
      this.T[r.k] = r; this.N[n] = r; this.E[limpio(r.n)] = r;
    });
    // 🧑 las caras de quienes jugaron y quedan fuera de la tabla (`avs` del payload, ver `subir_web.py`): por nombre
    this.A = {};
    (D.avs || []).forEach(([n, av]) => { if (n && av) this.A[limpio(n).toLowerCase()] = av; });
    // 👥 y las de quienes organizan sin estar en la tabla (`orgp`, 14/10/2026): ver `orgsDe()`
    Object.values(D.orgp || {}).forEach(([n, av]) => { if (n && av) this.A[limpio(n).toLowerCase()] = av; });
    // 🧑 LOS DE FUERA DE LA TABLA, POR CLAVE (18/11/2026, la pasada de bugs: ~25 lugares trataban a quien está fuera de
    // las 200 como si no existiera, o lo nombraban con su clave cruda). Filas LIGERAS —`{k, n, av, c: [], parcial: 1}`,
    // la misma forma que `quien()` ya devolvía para `orgp`— con lo que ya viaja: `avs` (281 que jugaron) y `orgp`.
    // La clave sale del nombre (`alias` primero); un nombre repetido o que ya es de alguien de la tabla no entra: mejor
    // sin fila que con la de otro. La fila ENTERA, si se bajaron los perfiles: `persona()`
    this.Fx = {};
    this.FxN = {};
    const malos = new Set();
    const sumaFx = (k, n, av) => {
      if (!k || !n || this.T[k]) return;
      const nn = limpio(n).toLowerCase();
      if (this.N[nn] || malos.has(nn)) return;
      if (this.FxN[nn] && this.FxN[nn].k !== k) { malos.add(nn); delete this.Fx[this.FxN[nn].k]; delete this.FxN[nn]; return; }
      if (this.Fx[k]) {
        // 🏳️ la misma clave con OTRA bandera escrita (`Volk 🇲🇽` / `volk 🇨🇴`, revisión del 18/11/2026) son dos personas
        const b1 = banderasTxt(this.Fx[k].n), b2 = banderasTxt(n);
        if (b1 && b2 && b1 !== b2) { malos.add(nn); delete this.FxN[nn]; delete this.Fx[k]; return; }
        if (!this.Fx[k].av && av) this.Fx[k].av = av;
        return;
      }
      this.Fx[k] = { k, n, av: av || '', c: [], parcial: 1 };
      this.FxN[nn] = this.Fx[k];
    };
    Object.entries(D.orgp || {}).forEach(([k, p]) => { if (Array.isArray(p)) sumaFx(k, p[0], p[1]); });
    (D.avs || []).forEach(([n, av]) => { if (n) sumaFx((D.alias || {})[normNombre(n)] || claveDe(n), n, av); });
    // los de un perfil abierto (`fuera()`), por nombre: para `quien()`
    this.XN = {};
    this.svs = {};
    (D.svs || []).forEach((s) => { this.svs[s.sv] = s; });
    SIGLAS = {};
    (D.svs || []).forEach((s) => { if (s.sigla && s.sigla !== s.sv) SIGLAS[s.sv] = s.sigla; });
    this.rg = {};
    (D.rangos || []).forEach((r) => { this.rg[r.r] = r.color; });
    // 🙋 TU FILA AUNQUE NO ESTÉS ENTRE LOS 200 (12/11/2026: Dlx es #228 y el panel le decía «juega tu primer evento» y el
    // inventario «sin carta» con cuatro cartas arriba). La trae `App.jsx` de tu perfil (`p[k].f`) y entra como las
    // que se abren desde un perfil (`fuera()`): así `cartaDe()` y todo lo que lee `liga.yo` la encuentran
    if (yoFila && yoFila.k === yo) this.fuera(yoFila);
    this.yo = yo ? (this.T[yo] || this.X[yo] || null) : null;
    // la temporada sale del payload: «T1» escrito a mano quedaría viejo el día que arranque la T2
    this.temp = String(D.temporada || 'T1').toUpperCase();
    this.tempLarga = 'TEMPORADA ' + this.temp.replace(/^T/, '');
    // ⚠️ `sigue` se queda filtrado por la tabla A PROPÓSITO: hay lectores que hacen `liga.T[k].n` sin guarda (el Inicio).
    // Para contar, tildar o el botón «Seguir», `sigueTodos` y `sigo(k)`: la lista entera, también los de fuera (18/11/2026)
    this.sigue = (sigue || []).filter((k) => this.T[k]);
    this.sigueTodos = (sigue || []).filter(Boolean);
  }

  // ── QUIÉN ES UNA CLAVE, AUNQUE NO ESTÉ EN LA TABLA (18/11/2026, la pasada de bugs de las páginas) ──
  // 🧑 la fila ENTERA: la de la tabla, la de un perfil abierto o la de /api/perfiles si ya se bajó (`window.PERF`,
  // datos.js). Sin caché a propósito: los perfiles llegan después, y lo que pregunte otra vez los encuentra. ⚠️ Puede
  // ser la del staff que no compite (`solo`, sin números pero con sus cartas): para contar, la tabla
  persona(k) {
    if (!k) return null;
    const p = W.PERF && W.PERF.p && W.PERF.p[k];
    return this.T[k] || this.X[k] || (p && p.f ? Object.assign({ k }, p.f) : null);
  }
  // y si no, la fila ligera de los que viajan fuera de la tabla (`Fx`: nombre y cara). Para nombrar, no para contar
  quienK(k) { return k ? this.persona(k) || this.Fx[k] || null : null; }
  // el nombre que se lee de una clave: el oficial si se sabe; si no, el que vino (`n0`); la clave, sólo al final
  nombreDe(k, n0) { const f = this.quienK(k); return limpio((f && f.n) || n0 || k || ''); }
  // ¿hay alguien con esa clave? (para «Ver su perfil»: los 656 de fuera de la tabla también tienen el suyo)
  existe(k) { return !!this.quienK(k); }
  // ¿la sigues? Con la lista entera, no la filtrada por la tabla
  sigo(k) { return !!k && this.sigueTodos.includes(k); }
  // 🔢 el «de N» de la Temporada: los que tienen número, aunque la tabla traiga 200 filas (`n_oficiales`, 258 hoy)
  nOficiales() { return Number(this.d.n_oficiales) || this.oficiales().length; }

  // ── rutas de imágenes (todas públicas: R2, el CDN de Discord y la propia página) ──
  // 🃏 `chica`: la de 300 px de ancho (19/10/2026, `CHICA_ANCHO` de bot/subir_cartas.py), para donde se dibuja en chico
  // —las llaves—; ~22 KB en vez de ~150. Puede no existir todavía: quien la usa vuelve a la grande si no carga
  // 🃏 quien no está en la tabla (no jugó, o quedó más allá del corte) y tiene cartas: su perfil lo anota acá para
  // que sus cartas se vean (26/10/2026, Dlx: «aún no tengo mis tarjetas»)
  fuera(f) {
    if (!(f && f.k && !this.T[f.k] && Array.isArray(f.c))) return;
    this.X[f.k] = f;
    // por nombre también, para `quien()`; y lo que `quien()` ya contestó sin esta fila se vuelve a preguntar
    const nn = limpio(f.n).toLowerCase();
    if (nn && !this.N[nn]) this.XN[nn] = f;
    this.qM = null;
  }
  cartaUrl(k, cual, chica = false) {
    const f = this.persona(k);
    if (!f || !(f.c || []).includes(cual)) return null;
    const i = (this.d.cartas || []).indexOf(cual);
    const v = typeof f.cv === 'string' && i >= 0 ? f.cv.split('.')[i] : '';
    // ⚡ con la versión de su redibujo a pedido, si la hay: la imagen nueva y no la del caché
    const vr = versionRedibujo(k);
    const q = [v ? 'v=' + v : '', vr ? 'r=' + vr : ''].filter(Boolean).join('&');
    return this.d.r2 + '/' + k + '/' + cual + (chica ? '.chica' : '') + '.webp' + (q ? '?' + q : '');
  }
  // 🃏 QUÉ CARTA REPRESENTA A CADA UNO, SEGÚN DÓNDE (Dlx, 18/10/2026: «según dónde»). En algo de un servidor —su llave,
  // su página, sus eventos— la de Servidor, si es la de ESE servidor; en lo competitivo (`comp`), la Competitiva; en lo
  // demás, la de Temporada. Si no tiene la que toca, la de Temporada; si tampoco, la que tenga; sin ninguna, `null`
  // 🃏 Y DESDE EL 26/10/2026 (Dlx: «me gustan tus otras ideas»): en lo de un país (`pais`, su página), la de País; y donde
  // ninguna toca, la CARTA PRINCIPAL que eligió (`cartaPrincipal()` del objeto), antes que la Temporada
  cartaDe(k, donde = {}) {
    const f = this.persona(k);
    const c = (f && f.c) || [];
    if (!c.length) return null;
    if (donde.sv && c.includes('servidor') && String(f.sv || '').toUpperCase() === String(donde.sv).toUpperCase()) return 'servidor';
    if (donde.comp && c.includes('competitivo')) return 'competitivo';
    if (donde.pais && c.includes('pais') && String(f.cc || '').toLowerCase() === String(donde.pais).toLowerCase()) return 'pais';
    const cp = cartaPrincipalDe(k);
    if (cp && c.includes(cp)) return cp;
    return c.includes('temporada') ? 'temporada' : c[0];
  }
  // ✨ ¿su carta brilla en las llaves? (el nivel 8 del Pase: `brillan` del payload)
  brilla(k) { return !!k && (this.d.brillan || []).includes(k); }
  // ¿la imagen de esa carta es de antes de los números de ahora? Lo mide el ciclo (`_versiones()` de subir_web.py,
  // `vj`); es el `vieja()` de app.js. Dlx, 01/10/2026: Makmah #3 en su carta y cuarto en Los que mandan — la carta se
  // estaba redibujando y no lo decía
  cartaVieja(k, cual) {
    const f = this.persona(k);
    const i = (this.d.cartas || []).indexOf(cual);
    return !!(f && i >= 0 && typeof f.vj === 'string' && f.vj.indexOf(String(i)) >= 0);
  }
  // a 256: las caras de las listas y las historias se dibujan a ~100 px, el doble en una pantalla de celular. 🔎 `t`: más
  // grande donde la cara se dibuja grande (el perfil, ~240 px; Dlx, 12/11/2026: «que todo esté siempre en HD»). El CDN
  // de Discord devuelve lo que la persona subió, nunca más: pedir 1024 no agranda nada, sólo deja de achicar
  avUrl(k, t = 256) {
    const f = this.quienK(k);
    return f && f.av ? 'https://cdn.discordapp.com/avatars/' + f.av + '.webp?size=' + t : null;
  }
  // la cara de alguien que jugó y no está en la tabla (corta en 200): la piden `Cara` y `CaraH` cuando no hay clave
  avNombre(nombre, t = 256) {
    const av = nombre ? this.A[limpio(nombre).toLowerCase()] : null;
    return av ? 'https://cdn.discordapp.com/avatars/' + av + '.webp?size=' + t : null;
  }
  // el logo de HOY de cada servidor: el payload trae el ícono actual de Discord (`svs[].logo`, ver `subir_web.py`) y
  // el guardado sólo de respaldo. Dlx, 30/09/2026: «usa los LOGOS actuales de cada servidor». El Inicio usaba
  // siempre el archivo guardado, y el de URBF (y la cobra de SR) ya no eran los de hoy
  // 🔴 EN MÁXIMA CALIDAD. Dlx, 01/10/2026: «que las imágenes o logotipos en todos los lugares estén en máxima
  // calidad». El ícono llegaba pedido a 128 px y el escenario lo dibuja a ~330: se veía borroso. Se pide a 512 en todos
  // lados —una sola imagen por servidor, que el navegador reusa— y a 1024 donde se dibuja grande (`grande`). El CDN de
  // Discord devuelve lo que se subió, nunca más: pedir de más no agranda nada, sólo deja de achicar
  sigla(sv) { return siglaDe(sv); }
  // y al revés, para la dirección: `/sv/SNK` y `/sv/SR` abren lo mismo
  codigo(x) {
    const X = String(x || '').toUpperCase();
    if (this.svs[X]) return X;
    const s = Object.values(this.svs).find((o) => String(o.sigla || '').toUpperCase() === X);
    return s ? s.sv : X;
  }
  logo(sv, grande = false) {
    if (!sv) return '';
    const s = this.svs && this.svs[sv];
    if (s && s.logo) {
      if (!/^https?:/.test(s.logo)) return '/' + String(s.logo).replace(/^\//, '');
      return /cdn\.discordapp\.com/.test(s.logo) ? s.logo.replace(/([?&]size=)\d+/, '$1' + (grande ? 1024 : 512)) : s.logo;
    }
    return '/logos/' + String(sv).toLowerCase() + '.webp';
  }
  colorRg(rg) { return this.rg[rg] || '#A5A5A0'; }

  // ── utilidades de datos ──
  // 🔴 DOS PERSONAS, UN NOMBRE: «Volk» 🇲🇽 y «volk» 🇨🇴, «DXG» y «dxg», «Kenny» y «KENNY» y dos «Last» (medido el
  // 01/10/2026). Las llaves traen sólo el nombre, y comparado sin mayúsculas cada uno veía en «Tus eventos» y en «Tu
  // último evento» los del otro. Cuando el nombre se repite, vale sólo el exacto —como en el perfil de app.js—; si no,
  // sin mayúsculas, como siempre. Los dos «Last» se escriben igual y siguen sin poder separarse
  fila(nombre) {
    const a = limpio(nombre);
    const n = a.toLowerCase();
    const f = (this.dobles.has(n) ? this.E[a] : this.N[n]) || null;
    if (f || this.dobles.has(n)) return f;
    // 🕵️ si el nombre no es de nadie de la tabla: su alias (la hoja AKAs, `alias` del payload) o lo que el vigía
    // reconoció en vivo —la inscripción de su cuenta, la llamada o la mención— (02/10/2026). Es lo mismo que `kDe()` de
    // app.js: una llave en vivo con «Park-Ji Sung» muestra a Oasis
    const k = (this.d.alias || {})[normNombre(nombre)] || (W.kVivo ? W.kVivo(nombre) : '');
    return (k && this.T[k]) || null;
  }
  // 👥 LOS ORGANIZADORES DE UN EVENTO, DE A UNO Y CON SU PERFIL (Dlx, 14/10/2026: «asegurate que los organizadores
  // tengan su foto y perfil»): `[{n, f}]`, con `f` la fila de su perfil o `null`. `inf.os` los trae partidos
  // («FLENNZS + LEWITO + AX» son tres, `subir_web._os()`); `d.orgs`, el perfil de cada uno —por su cuenta cuando el
  // anuncio la dice—. Sin perfil queda el nombre, en texto
  orgsDe(inf) {
    const i = inf || {};
    const ns = (i.os && i.os.length ? i.os : i.org ? [i.org] : []).filter(Boolean);
    // sin fila en la tabla (staff que no compite, o fuera de las 200): su perfil y su nombre de la Lista (`orgp`)
    return ns.map((n) => {
      const k = (this.d.orgs || {})[n];
      const p = k && (this.d.orgp || {})[k];
      return { n, f: this.T[k] || this.fila(n) || (p ? { k, n: p[0] } : null) };
    });
  }
  // 🪪 QUIÉN ES UN NOMBRE COMO LO ESCRIBIÓ EL ORGANIZADOR (Dlx, 17/11/2026: «si alguien escribe velatzzzz, debería
  // mostrarse con su aka oficial, Velatz… y hazlo más bonito con su foto y su cuenta»; «dale, hazlo en todas partes»).
  // La fila de su perfil: por la clave si se sabe (`k`, la de la tabla, la de un perfil abierto o la de un organizador),
  // si no por el nombre —tal cual, su alias, lo que el vigía reconoció en vivo, en otro orden o sin el «(R)» del
  // revivido—. Sin nadie, `null`: el nombre queda como lo escribieron.
  // ⚡ UNA VEZ POR NOMBRE: una llave repite cada nombre en cada ronda y el perfil, «Tu semana» y los duelos recorren todas
  // las llaves (`esDe()`). Se vuelve a calcular si llega otro `VIVO` (lo que el vigía reconoció cambia con él)
  quien(nombre, k) {
    if (k) {
      const f = this.T[k] || this.X[k];
      if (f) return f;
      const p = (this.d.orgp || {})[k];
      if (p && p[0]) return { k, n: p[0] };
      if (this.Fx[k]) return this.Fx[k];
    }
    const s = String(nombre || '');
    if (!s) return null;
    const V = W.VIVO;
    if (!this.qM || this.qV !== V) { this.qM = new Map(); this.qV = V; }
    let f = this.qM.get(s);
    if (f !== undefined) return f;
    f = this.fila(s) || this.filaEnOtroOrden(s);
    if (!f) {
      const sin = s.replace(/\s*[(（][^()（）]*[)）]?\s*$/u, '');
      if (sin && sin !== s) f = this.fila(sin);
    }
    // 🧑 y si no es de nadie de la tabla: alguien de fuera con ese nombre exacto —un perfil abierto o los que viajan
    // fuera (`Fx`)— (18/11/2026: en una llave, quien estaba más allá del puesto 200 no tenía su camino ni su perfil)
    if (!f) {
      const nn = limpio(s).toLowerCase();
      f = this.XN[nn] || this.FxN[nn] || null;
    }
    f = f || null;
    if (this.qM.size > 20000) this.qM = new Map();
    this.qM.set(s, f);
    return f;
  }
  // el nombre que se lee: el oficial si se sabe quién es; si no, como lo escribieron. Un equipo («A & B») de a uno
  aka(nombre, k) {
    const f = this.quien(nombre, k);
    if (f) return limpio(f.n);
    const s = String(nombre || '');
    return / & /.test(s) ? s.split(/\s+&\s+/).map((x) => this.aka(x)).filter(Boolean).join(' & ') : limpio(s);
  }
  // lo de una llave en vivo, donde un equipo viene con comas («A, B»): «A y B», cada uno con su nombre oficial
  akaVivo(x) {
    return String(x || '').split(/\s*,\s*/).map((y) => this.aka(y)).filter(Boolean).join(' y ');
  }
  // 🔑 y para contar —su perfil, «Tu semana», sus duelos—, también lo que se escribió con su alias: «velats» es Velatz
  // 🧑 también para quien está fuera de la tabla (18/11/2026): su perfil abierto, su fila de /api/perfiles o la ligera de
  // `Fx`. Antes cortaba en `T[k]`, y a esa gente no le salían «Tu semana», sus cruces ni sus duelos. ⚠️ Sin estar en la
  // tabla, un nombre que SÍ es de alguien de la tabla es de ése y no de `k` (dos «julix»: `julix` y `julix-x`)
  esDe(nombre, k) {
    const f = this.T[k] || this.X[k] || (k && this.Fx[k]) || (k ? this.persona(k) : null);
    if (!f) return false;
    const a = limpio(nombre);
    if (!this.T[k]) { const o = this.fila(a); if (o && o.k !== k) return false; }
    const b = limpio(f.n);
    if (this.dobles.has(b.toLowerCase()) ? a === b : a.toLowerCase() === b.toLowerCase()) return true;
    const q = this.quien(nombre);
    return !!q && q.k === k;
  }
  oficiales() { return (this.d.tabla || []).filter((f) => f.pos).sort((a, b) => a.pos - b.pos); }
  // una fecha que falta no se escribe: decía «el undefined»
  cuando(t) {
    const b = utc(t);
    if (isNaN(b)) return '';
    const seg = (this.ahora - b) / 1000;
    if (seg < 0) return this.dia(t);
    if (seg < 3600) return 'hace ' + Math.max(1, Math.floor(seg / 60)) + ' min';
    const dias = diasEntre(b, this.ahora);
    if (dias === 0) return horaNum(b) < 6 ? 'anoche' : 'hace ' + Math.floor(seg / 3600) + ' h';
    if (dias === 1) return horaNum(b) >= 20 ? 'anoche' : 'ayer';
    if (dias < 7) return 'el ' + DIAS[diaSemana(b)];
    // 📅 de una semana para atrás, la fecha: un video de mayo decía «el martes» (revisión del 04/11/2026)
    const [a, m, d] = diaISO(b).split('-').map(Number);
    return 'el ' + d + ' de ' + MESES[m - 1] + (a !== Number(diaISO(this.ahora).split('-')[0]) ? ' de ' + a : '');
  }
  dia(t) {
    const b = utc(t);
    if (isNaN(b)) return '';
    const dias = diasEntre(this.ahora, b);
    if (dias === 0) return 'hoy ' + hora(b);
    if (dias === 1) return 'mañana ' + hora(b);
    return DIAS[diaSemana(b)] + ' ' + diaMes(b) + ' · ' + hora(b);
  }
  // el día (AAAA-MM-DD) de un instante en la zona de quien mira: para agrupar por día
  diaClave(t) {
    const b = utc(t);
    return isNaN(b) ? '' : diaISO(b);
  }
  // «hoy», «ayer» o «martes 29 de septiembre», en la zona de quien mira
  fechaLarga(t) {
    const b = utc(t);
    if (isNaN(b)) return '';
    const d = diasEntre(b, this.ahora);
    if (d === 0) return 'hoy';
    if (d === 1) return 'ayer';
    const m = Number(diaISO(b).split('-')[1]);
    return DIAS[diaSemana(b)] + ' ' + diaMes(b) + ' de ' + MESES[m - 1];
  }
  // ⏱ nunca negativo: con una hora vieja (un evento atrasado leído con su hora de antes) decía «-1 H -10 MIN»
  falta(t) {
    const seg = Math.max(0, Math.floor((utc(t) - this.ahora) / 1000) || 0);
    const h = Math.floor(seg / 3600);
    const m = Math.floor((seg % 3600) / 60);
    return h ? h + ' H ' + m + ' MIN' : Math.max(1, m) + ' MIN';
  }
  // 🔴 EN VIVO MIENTRAS SU LLAVE SE JUEGA, NO SÓLO 90 MINUTOS. Dlx, 01/10/2026 a las 8 PM: «no veo el evento de URBF
  // que está en vivo, desapareció». POESÍA CRUDA empezó a las 6:29 PM y a las 7:59 salió del escenario con los
  // Cuartos a medio jugar: `vivo_min` es lo que dura una llave CUANDO NO HAY LLAVE A LA VISTA. Con su llave en vivo
  // (`VIVO_L` de app.js: tocada en las últimas 3 h y sin campeón) sigue, hasta 8 h; y si ya salió de `proximos`, se
  // la busca en el calendario. ⚠️ Sin llave, los 90 minutos de siempre (Dlx, 24/09: lo pasado mostrado como en vivo).
  // 🔴 LOS EVENTOS CANCELADOS (01/10/2026, Dlx: «B»): el vigía ve que el anuncio se borró —o se editó a «cancelado»— y
  // lo dice en `/api/avisos/vivo` (`window.VIVO.cancelados` de app.js, el último día). El payload lo saca recién en la
  // corrida siguiente del ciclo (hasta 30 min), y mientras tanto el evento seguía «en vivo» o «próximo»
  cancelados() {
    const cs = (typeof window !== 'undefined' && window.VIVO && window.VIVO.cancelados) || [];
    return Array.isArray(cs) ? cs : [];
  }
  // 🙋 QUIÉNES SE ANOTARON A UN EVENTO, antes de que haya llave (03/10/2026, Dlx: «Me gusta tu A»). Los junta el vigía
  // de los canales de inscripción (`anotados` de `/api/avisos/vivo`, por el id del anuncio: `[nombre, bandera, clave,
  // con bandera]`) y acá va la otra mitad de la regla del ciclo (`es_inscripcion()`): cuenta si trae su bandera o si
  // la Liga ya conoce ese nombre. «yo», «ya oe», «vamos juntos» —la charla del canal— no
  anotados(e) {
    const m = /\/(\d{15,22})\/?$/.exec(String((e && e.link) || ''));
    const V = typeof window !== 'undefined' ? window.VIVO : null;
    const l = (m && V && V.anotados && V.anotados[m[1]]) || [];
    return l.map(([aka, cc, k, b]) => ({ aka: limpio(aka), cc, b: !!b,
      f: (k && this.T[k]) || this.fila(aka) || this.filaEnOtroOrden(aka) || null }))
      .filter((x) => x.aka && (x.b || x.f || this.A[x.aka.toLowerCase()]));
  }
  // «ji sung park» es «Park Ji Sung» (LA REDENCION, FFA, 03/10/2026: «yinn+ji sung park»): un nombre de dos o tres
  // palabras, en otro orden. Seis pruebas como mucho, contra la tabla y los alias, como `fila()`
  filaEnOtroOrden(nombre) {
    const w = limpio(nombre).split(/\s+/).filter(Boolean);
    if (w.length < 2 || w.length > 3) return null;
    const ps = w.length === 2 ? [[w[1], w[0]]]
      : [[w[0], w[2], w[1]], [w[1], w[0], w[2]], [w[1], w[2], w[0]], [w[2], w[0], w[1]], [w[2], w[1], w[0]]];
    for (const p of ps) {
      const f = this.fila(p.join(' '));
      if (f) return f;
    }
    return null;
  }
  esCancelado(e) {
    const m = /\/(\d{15,22})\/?$/.exec(String((e && e.link) || ''));
    return !!m && (this.cancelados().some((c) => String(c.id) === m[1]) || (this.estado(e) || {}).tipo === 'cancelado');
  }
  // 📢 LO QUE EL ORGANIZADOR AVISÓ DESPUÉS DEL ANUNCIO (07/10/2026, Dlx: «asegurate de q el bot pueda entender cuando
  // pasa estas situaciones… el evento se canceló o se va a atrasar»). GALLOS DEL UNDER AMATEUR I (Snake Rap) se cortó en
  // cuartos —«se me fue la luz, podemos reanudar con la compe mañana»— y seguía «EN VIVO». El vigía lee esos mensajes
  // (`estados` de `/api/avisos/vivo`, con el id de su anuncio: ver `anotarEstado()` de bot/avisos.js) y el más nuevo
  // manda. ⚠️ La pausa y el atraso se terminan solos cuando su llave vuelve a moverse: al otro día la llave avanza
  estado(e) {
    const m = /\/(\d{15,22})\/?$/.exec(String((e && e.link) || ''));
    const V = typeof window !== 'undefined' ? window.VIVO : null;
    const st = m && V && Array.isArray(V.estados) ? V.estados.find((x) => String(x.evento) === m[1]) : null;
    if (!st || st.tipo === 'cancelado') return st || null;
    const ev = { cuando: e.cuando || e.t, sv: e.sv, nombre: e.nombre || e.n, link: e.link };
    try {
      const todas = Object.values(window.VIVO_L || {});
      const L = todas.length && window.llaveDeEvento ? window.llaveDeEvento(ev, todas) : null;
      if (L && (L.ed || L.pub || 0) > st.pub + 2 * 60000) return null;
    } catch (err) { /* sigue */ }
    // y la pausa no es para siempre: a los dos días, sin que la llave se mueva, ya no dice nada
    return this.ahora - st.pub > 48 * 3600000 ? null : st;
  }
  enPausa(e) { return (this.estado(e) || {}).tipo === 'pausado'; }
  // la hora que vale: la nueva si el organizador la dijo (`nueva`) o lo que se corre (`mas`) sobre la anunciada
  cuandoDe(e) {
    const st = this.estado(e);
    const base = e.cuando || e.t;
    if (!st || st.tipo !== 'atrasado') return base;
    if (st.nueva) return new Date(st.nueva).toISOString();
    return st.mas ? new Date(utc(base).getTime() + st.mas).toISOString() : base;
  }
  // lo que dice la tarjeta: «sigue mañana», «se atrasó · ahora 21:30», «se atrasó»
  estadoTexto(st, e) {
    if (!st) return '';
    if (st.tipo === 'cancelado') return 'el organizador avisó que se cancela';
    if (st.tipo === 'pausado') return st.nueva ? 'sigue ' + this.dia(new Date(st.nueva)) : 'sigue otro día · lo avisó el organizador';
    const n = this.cuandoDe(e);
    return n !== (e.cuando || e.t) ? 'se atrasó · ahora ' + hora(n) : 'se atrasó · todavía sin hora nueva';
  }
  // los que están en pausa ahora, para Fechas: `[{ e, st }]`
  pausados() {
    const evs = this.proximos().concat((this.d.calendario || []).filter((c) => !c.ll)
      .map((c) => ({ nombre: c.n, sv: c.sv, cuando: c.t, link: c.link })));
    const vistos = new Set();
    return evs.map((e) => ({ e, st: this.estado(e) })).filter(({ e, st }) => {
      if (!st || st.tipo !== 'pausado' || vistos.has(e.link)) return false;
      vistos.add(e.link);
      return true;
    });
  }
  // 🔴 UN ANUNCIO BORRADO Y VUELTO A PUBLICAR NO ES UN EVENTO CANCELADO (LA REDENCION, FFA, 03/10/2026: borrado a las
  // 6:26 PM y publicado otra vez). El vigía anota el borrado, y Fechas y Eventos decían «CANCELADO» al lado del mismo
  // evento en vivo. Se muestra como cancelado lo que no tiene OTRO anuncio, sin cancelar, del mismo servidor, con el mismo
  // nombre y a menos de 12 h —la misma ventana con la que el vigía le pasa los anotados al anuncio nuevo—: un «1VS1» de
  // otro día no salva a éste. ⚠️ `cancelados()` sigue entero: esconder el anuncio borrado (`esCancelado()`) vale igual
  cancelacionesVisibles() {
    const cs = this.cancelados();
    const idDe = (u) => { const m = /\/(\d{15,22})\/?$/.exec(String(u || '')); return m ? m[1] : ''; };
    const V = typeof window !== 'undefined' ? window.VIVO : null;
    const otros = this.proximos().map((p) => [p.sv, p.nombre, idDe(p.link), utc(p.cuando).getTime()])
      .concat((this.d.calendario || []).map((c) => [c.sv, c.n, idDe(c.link), utc(c.t).getTime()]))
      .concat(((V && V.anuncios) || []).map((a) => [a.sv, a.n, String(a.id || ''), a.ini ? new Date(a.ini).getTime() : NaN]));
    const nom = (s) => limpio(s).toLowerCase();
    // sin la hora de alguno de los dos, que el otro se haya publicado DESPUÉS (los ids de Discord crecen con el tiempo)
    const despues = (a, b) => (a.length !== b.length ? a.length > b.length : a > b);
    return cs.filter((c) => {
      const ini = c.ini ? new Date(c.ini).getTime() : NaN;
      return !otros.some(([sv, n, id, t]) => sv === c.sv && nom(n) === nom(c.n) && id && id !== String(c.id)
        && !cs.some((d) => String(d.id) === id)
        && (Number.isFinite(t) && Number.isFinite(ini) ? Math.abs(t - ini) <= 12 * 3600000 : despues(id, String(c.id))));
    });
  }
  // 📣 «PRÓXIMOS» = LO DEL PAYLOAD + LO QUE EL VIGÍA YA VIO ANUNCIAR (03/10/2026, Dlx: «se ha anunciado el evento y no se
  // ve en inicio»). El payload trae un anuncio recién en la corrida siguiente del ciclo —hasta 30 min— y el vigía lo ve
  // al minuto: es el mismo que hace sonar la campana (`anuncios` en `vivo()` de bot/avisos.js, `window.VIVO` de app.js).
  // Con el formato del payload y `vigia: 1`; cuando el ciclo lo trae, se queda el del payload (el mismo mensaje).
  // ⚠️ Se arma una vez por cada `window.VIVO`: el Inicio compara eventos por identidad (`liga.vivo().includes(e)`)
  proximos() {
    const V = typeof window !== 'undefined' ? window.VIVO : null;
    if (this.proxCache && this.proxV === V) return this.proxCache;
    const base = this.d.proximos || [];
    const idDe = (u) => { const m = /\/(\d{15,22})\/?$/.exec(String(u || '')); return m ? m[1] : ''; };
    const ya = new Set();
    base.concat(this.d.calendario || []).forEach((x) => { const id = idDe(x.link); if (id) ya.add(id); });
    // 🔴 y un anuncio BORRADO no tapa al que lo reemplaza (LA REDENCION, FFA, 03/10/2026: borrado a las 6:26 y vuelto a
    // publicar). El payload traía el borrado, que se esconde por cancelado, y el nuevo se descartaba por llamarse igual:
    // el evento en vivo desaparecía del Inicio
    const extra = ((V && V.anuncios) || []).filter((a) => a && a.ini && a.n && !ya.has(String(a.id)) &&
      !base.some((p) => p.sv === a.sv && limpio(p.nombre).toLowerCase() === limpio(a.n).toLowerCase() && !this.esCancelado(p)))
      .map((a) => ({ nombre: a.n, sv: a.sv, cuando: new Date(a.ini).toISOString(), cupos: a.cup || '', link: a.url || '',
        modalidad: a.mod || '', premios: a.pre || '', vigia: 1 }));
    this.proxV = V;
    this.proxCache = this.sinRepetir(extra.length ? base.concat(extra) : base, idDe);
    return this.proxCache;
  }
  // 🔁 UN EVENTO ANUNCIADO DOS VECES ES UNO (Dlx, 12/11/2026, con una captura del Inicio: tres círculos «EN VIVO» de FDS
  // con el mismo «RAP SIN G…»: «arreglemos ese tipo de errores»). FDS publicó «RAP SIN GROSERIAS» en dos mensajes con 37
  // segundos de diferencia, y cada anuncio era un evento: en vivo, en «Hoy», en las historias y en el escenario. Mismo
  // servidor, mismo nombre y a menos de 2 h es el mismo evento —la regla que ya usa el cruce de las llaves
  // (`MISMO_EVENTO_H` de bot/subir_web.py)—. Se queda el que no está cancelado y, entre los vivos, el anuncio más
  // nuevo (el número del mensaje de Discord crece con el tiempo): si el organizador lo corrigió, vale lo corregido
  sinRepetir(evs, idDe) {
    const H2 = 2 * 3600000;
    const grupos = [];
    evs.forEach((e) => {
      const n = limpio(e.nombre).toLowerCase();
      const g = grupos.find((x) => x.sv === e.sv && x.n === n && Math.abs(utc(x.e.cuando) - utc(e.cuando)) < H2);
      if (!g) { grupos.push({ sv: e.sv, n, e }); return; }
      const cancA = this.esCancelado(g.e), cancB = this.esCancelado(e);
      const masNuevo = (idDe(e.link) || '').padStart(22, '0') > (idDe(g.e.link) || '').padStart(22, '0');
      if ((cancA && !cancB) || (cancA === cancB && masNuevo)) g.e = e;
    });
    return grupos.length === evs.length ? evs : grupos.map((g) => g.e);
  }
  vivo() {
    const m = this.d.vivo_min || 90;
    const todas = typeof window !== 'undefined' ? Object.values(window.VIVO_L || {}) : [];
    const ls = todas.filter((L) => !L.terminada);
    const sigue = (e) => {
      if (!ls.length || !window.llaveDeEvento) return false;
      try { return !!window.llaveDeEvento(e, ls); } catch (err) { return false; }
    };
    // 🔴 SIN LLAVE PORQUE LA BORRARON NO ES «EN VIVO» (LA REDENCION, FFA, 03/10/2026: se canceló a último momento —
    // Dlx: «pinchó»— y el organizador borró la llave pero dejó el anuncio; la página siguió diciendo EN VIVO hasta 90
    // min después de la hora). El vigía anota las llaves borradas (`borradas` de `/api/avisos/vivo`, `VIVO_B` de
    // app.js): si la de este evento se borró hace 5 min o más y no hay otra, deja de estar en vivo. Los 5 min son para
    // el que la borra y la vuelve a publicar corregida
    // ⏰ con la hora nueva si el organizador avisó que se atrasa (`cuandoDe()`): hasta entonces no está en vivo
    const desde = (e) => (this.ahora - utc(this.cuandoDe(e))) / 1000;
    // 🔴 Y LO QUE YA TERMINÓ NO ES «EN VIVO» aunque estemos dentro de los 90 minutos (revisión del 04/10/2026): un 1v1
    // de ocho que arranca 20:00 y termina 20:50 salía a la vez «● EN VIVO» y «TERMINÓ · Campeón» en Fechas, y «se juega
    // ahora» en el escenario, hasta las 21:30. Terminó = su llave en vivo tiene campeón y no hay otra sin terminar, o el
    // ciclo ya procesó su llave (`ll` del calendario)
    const termino = (e) => this.termino(e, todas, ls);
    const out = this.proximos().filter((e) => {
      const s = desde(e);
      // ⏸ y lo que está en pausa —«seguimos mañana»— tampoco: va aparte (`pausados()`)
      // 🔑 sin una hora que se pueda leer (`sin_hora`: va con la de publicación), en vivo sólo si su llave se está jugando:
      // por la hora salía «EN VIVO» desde que se anunciaba (18/11/2026; lo que hacía `empezo()` de app.js)
      return !this.esCancelado(e) && !this.enPausa(e) && s >= 0 && (!e.sin_hora || sigue(e)) && (s <= m * 60 || (s <= 8 * 3600 && sigue(e))) && !this.llaveBorrada(e) && !termino(e);
    });
    (this.d.calendario || []).forEach((c) => {
      const e = { nombre: c.n, sv: c.sv, cuando: c.t, link: c.link };
      const s = desde(e);
      if (s > m * 60 && s <= 8 * 3600 && !this.esCancelado(e) && !this.enPausa(e) && !out.some((x) => x.sv === e.sv && limpio(x.nombre) === limpio(e.nombre)) && sigue(e)) out.push(e);
    });
    return out;
  }
  // 🔑 LO QUE TERMINÓ Y EL CICLO TODAVÍA NO PROCESÓ (Dlx, 03/10/2026, 9:45 PM: «el evento no aparece aquí… el de la
  // nave»). La NAVE DE EXTERMINACIÓN terminó a las 9:30 y el ciclo procesa a las :22 y :52 —o más tarde, si duda—: en
  // el medio no estaba en vivo, no venía y no tenía llave procesada, así que no salía en ningún lado. Son las llaves en
  // vivo ya terminadas (`VIVO_L` de app.js: las procesadas ya no están, ver `llavesHechas()`), de las últimas 8 h, con
  // su evento anunciado si lo hay y el campeón de la final. `[{ L, e, camp }]`
  // ⚖️ EL ANUNCIO DE UNA LLAVE EN VIVO, para decir quién organiza y quiénes son el jurado, el host y el DJ (Dlx,
  // 08/10/2026). La procesada lo trae en su ficha (`L.info`); la en vivo todavía no tiene número, así que se busca
  // como en `recienTerminadas()`: el evento de `proximos()` o del calendario que `llaveDeEvento()` le asigna
  anuncioDeLlave(L) {
    if (!L || typeof window === 'undefined' || !window.llaveDeEvento) return null;
    const evs = this.proximos().concat((this.d.calendario || []).filter((c) => !c.ll)
      .map((c) => ({ nombre: c.n, sv: c.sv, cuando: c.t, link: c.link, org: c.org, st: c.st, aut: c.aut })));
    // 🧩 TODOS LOS QUE LE TOCAN, JUNTOS (19/11/2026, Dlx: «el staff del evento» no salía en la CHOP COMPE CHILL en vivo):
    // el mismo evento está en `proximos()` —sin staff— y en el calendario —con su jurado y quién lo publicó—, y ganaba el
    // primero. Lo que uno no trae lo pone el otro
    const xs = evs.filter((x) => { try { return !!window.llaveDeEvento(x, [L]); } catch (err) { return false; } });
    if (!xs.length) return null;
    const out = {};
    xs.forEach((x) => Object.entries(x).forEach(([k, v]) => {
      const vacio = v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
      if (!vacio && (out[k] == null || out[k] === '')) out[k] = v;
    }));
    return out;
  }
  recienTerminadas() {
    const ls = typeof window !== 'undefined' ? Object.values(window.VIVO_L || {}).filter((L) => L && L.terminada && !L.veredictos) : [];
    if (!ls.length) return [];
    const evs = this.proximos().concat((this.d.calendario || []).map((c) => ({ nombre: c.n, sv: c.sv, cuando: c.t, link: c.link })));
    const de = (L) => evs.find((x) => { try { return !!(window.llaveDeEvento && window.llaveDeEvento(x, [L])); } catch (err) { return false; } }) || null;
    // ⚠️ y la que ya tiene su llave procesada, no: `llavesHechas()` la saca por el link del mensaje, y si el ciclo la
    // leyó de otro lado (otro mensaje, #veredictos) el link no coincide. La RED BULL NACIONAL salía dos veces en Fechas
    const hechas = this.llaves().filter((ll) => this.ahora - utc(this.fechaLlave(ll)) < 24 * 3600000)
      .map((ll) => ({ nombre: ll.nombre, sv: ll.sv, cuando: this.fechaLlave(ll) }));
    const procesada = (L) => hechas.some((x) => { try { return !!(window.llaveDeEvento && window.llaveDeEvento(x, [L])); } catch (err) { return false; } });
    return ls.filter((L) => this.ahora - (L.ed || L.pub || 0) < 8 * 3600000 && !procesada(L)).map((L) => {
      const R = (L.rondas || [])[(L.rondas || []).length - 1];
      // 🪪 `campN`: los nombres como vienen, para la cara y el perfil de cada uno; `camp`, el texto con los oficiales
      const campN = R && R.b && R.b.length === 1 ? String(R.b[0][1] || '').split(/\s*,\s*/).filter((x) => limpio(x)) : [];
      return { L, e: de(L), campN, camp: campN.map((x) => this.aka(x)).join(' y ') };
    });
  }
  // 🔴 SE BORRÓ SU LLAVE Y NO HUBO OTRA: EL EVENTO SE CANCELÓ (LA REDENCION, FFA, 03/10/2026, Dlx: «pinchó» y «la
  // redención debería decir cancelado también»; decía «SIN LLAVE»). El vigía lo ve al minuto (`VIVO_B`, las últimas
  // 6 h) y el ciclo lo guarda (`can` del calendario, de `datos/cancelados.json`, ver `_cancelados()` de
  // bot/subir_web.py). Los 5 min son para el que la borra y la vuelve a publicar corregida
  llaveBorrada(e) {
    const bs = typeof window !== 'undefined' && Array.isArray(window.VIVO_B) ? window.VIVO_B : [];
    if (!bs.length || !window.llaveDeEvento) return false;
    try {
      const b = window.llaveDeEvento(e, bs);
      return !!b && this.ahora - b.borrada >= 5 * 60000 && !window.llaveDeEvento(e, Object.values(window.VIVO_L || {}))
        && !window.llaveDeEvento(e, this.llavesDelVigia());
    } catch (err) { return false; }
  }
  // ⚠️ Y CONTRA TODAS LAS LLAVES QUE VIO EL VIGÍA (6 h), no sólo las en vivo de `VIVO_L` (3 h): una llave borrada y
  // vuelta a publicar al empezar, jugada hasta las 21:10 y sin procesar a las 00:10, pasaba a «CANCELADO» (revisión del
  // 04/10/2026). Con su título, una vez por cada `window.VIVO`
  llavesDelVigia() {
    const V = typeof window !== 'undefined' ? window.VIVO : null;
    if (this.vigiaV === V && this.vigiaL) return this.vigiaL;
    const LV = typeof window !== 'undefined' ? window.LlaveVivo : null;
    this.vigiaV = V;
    this.vigiaL = ((V && V.llaves) || []).map((m) => {
      let n = '';
      try { n = LV ? LV.titulo(m.texto || '') : ''; } catch (err) { n = ''; }
      return n ? { sv: m.sv || '', nombre: n, pub: m.pub, ed: m.ed } : null;
    }).filter(Boolean);
    return this.vigiaL;
  }
  // ⚠️ una del calendario con su llave procesada nunca: lo que se jugó, se jugó
  canceladoCal(c) {
    return !!c && !c.ll && (!!c.can || this.llaveBorrada({ cuando: c.t, sv: c.sv, nombre: c.n })
      || (this.estado({ link: c.link, t: c.t, sv: c.sv, n: c.n }) || {}).tipo === 'cancelado');
  }
  // en orden de hora: lo que suma el vigía va al final de la lista y puede ser lo primero que se juega
  // ⏰ y con la hora nueva del que se atrasó; lo que está en pausa, no (`pausados()`)
  // 🔑 lo anunciado sin hora que se pueda leer (`sin_hora`) viene aunque su «hora» —la de publicación— ya pasó, y va al
  // final: no se sabe cuándo es. Quien lo dibuja dice «anunciado …» en vez de una cuenta atrás (18/11/2026)
  // 🏁 si un evento ya terminó (la regla de `vivo()`, 04/10/2026): su llave en vivo tiene campeón y no hay otra sin
  // terminar, o el ciclo ya procesó su llave (`ll` del calendario). `todas` y `ls` son las llaves en vivo, si ya se tienen
  termino(e, todas, ls) {
    if (!todas) todas = typeof window !== 'undefined' ? Object.values(window.VIVO_L || {}) : [];
    if (!ls) ls = todas.filter((L) => !L.terminada);
    if (todas.length && typeof window !== 'undefined' && window.llaveDeEvento) {
      try {
        const L = window.llaveDeEvento(e, todas);
        if (L && L.terminada && !window.llaveDeEvento(e, ls)) return true;
      } catch (err) { /* sigue */ }
    }
    return (this.d.calendario || []).some((c) => c.ll && ((e.link && c.link === e.link)
      || (c.sv === e.sv && limpio(c.n) === limpio(e.nombre) && Math.abs(utc(c.t) - utc(e.cuando)) < 6 * 3600000)));
  }
  luego() {
    const ps = this.proximos();
    const vivos = ps.some((e) => e.sin_hora) ? new Set(this.vivo()) : null;
    // ⚠️ un sin_hora es «próximo» mientras no esté en vivo, NI TERMINADO NI CON LA LLAVE BORRADA (revisión del 18/11/2026):
    // `vivo()` lo deja afuera por las tres cosas, y salía a la vez «TERMINÓ · Campeón» y «anunciado hace 2 h» en Fechas
    return ps.filter((e) => (e.sin_hora ? !vivos.has(e) && !this.termino(e) && !this.llaveBorrada(e) : utc(this.cuandoDe(e)) > this.ahora)
      && !this.esCancelado(e) && !this.enPausa(e))
      .sort((a, b) => (a.sin_hora ? 1 : 0) - (b.sin_hora ? 1 : 0) || utc(this.cuandoDe(a)) - utc(this.cuandoDe(b)));
  }
  llaves() { return Object.values(this.d.llaves || {}).sort((a, b) => Number(b.n) - Number(a.n)); }
  // 🔑 por FECHA, la más nueva primero: el número es el orden en que el ciclo las cargó, y se procesan desordenadas (lo
  // que ya hacía Fechas). «La última llave» y «el último campeón» salían de otro día (revisión del 04/10/2026)
  llavesPorFecha() {
    // sin fecha (ni calendario ni `dia`: `fechaLlave()` da ''), al final y en orden: NaN dejaba el orden indefinido
    const ms = (ll) => { const x = +utc(this.fechaLlave(ll)); return Number.isFinite(x) ? x : -Infinity; };
    return this.llaves().slice().sort((a, b) => ms(b) - ms(a) || Number(b.n) - Number(a.n));
  }
  // 🏷️ el nombre que se lee de una llave (18/11/2026): el suyo; si es «(sin titulo)», el del calendario para ese número;
  // si tampoco, «Sin título»
  nombreLlave(ll) {
    if (!ll) return '';
    if (!esSinTitulo(ll.nombre) && limpio(ll.nombre)) return limpio(ll.nombre);
    const c = (this.d.calendario || []).find((x) => String(x.ll) === String(ll.n));
    return c && !esSinTitulo(c.n) && limpio(c.n) ? limpio(c.n) : 'Sin título';
  }
  // 🪪 con su nombre oficial (17/11/2026): la llave trae el que escribió el organizador, y quien lo busque en la tabla lo
  // encuentra igual (`fila()` con el oficial es el exacto)
  campeon(ll) {
    const t = ll.tabla || [];
    const g = t.filter((x) => x[1] === 'Campeón').map((x) => this.aka(x[0], x[3]));
    // 🏆 SÓLO QUIEN GANÓ LA FINAL (16/11/2026): sin fila «Campeón» la llave no terminó o se cargó a medias, y tomar la primera
    // fila daba campeón a quien perdió la semi («Primera corona para Player» en L VS MOSQUI). Sin campeón, ninguno
    return g;
  }
  fechaLlave(ll) {
    const c = (this.d.calendario || []).find((e) => e.ll === ll.n || String(e.ll) === String(ll.n));
    // ⚠️ sin fila en el calendario ni `dia` (18/11/2026) daba 'undefinedT23:00:00Z' → NaN, y el orden de
    // `llavesPorFecha()` quedaba indefinido: sin fecha, al final
    return c ? c.t : ll.dia ? ll.dia + 'T23:00:00Z' : '';
  }
  multSv(sv) { return ((this.d.mult || {}).sv || {})[sv]; }
  // 📅 EL MULTIPLICADOR DE LA SEMANA EN QUE SE JUGÓ (Dlx, 14/10/2026: «¿en ese momento era ×3 o esta semana? haz que se
  // entienda»): `{x, esta}` con el de ese servidor en la semana de `t` y si es la de ahora, o `null` si esa semana no se
  // sabe (una que todavía no se sorteó). `x` 1 = sin multiplicador
  multEn(sv, t) {
    const M = this.d.mult || {};
    const ms = utc(t);
    if (!ms || !sv) return null;
    if (M.ini && M.fin && ms >= utc(M.ini) && ms < utc(M.fin)) return { x: (M.sv || {})[sv] || 1, esta: true };
    const h = (M.hist || []).find(([a, b]) => ms >= utc(a) && ms < utc(b));
    return h ? { x: (h[2] || {})[sv] || 1, esta: false } : null;
  }
  dorado() {
    const g = (this.d.mult || {}).dorado;
    if (!g) return null;
    const desde = utc(g.desde);
    const cand = (this.d.calendario || []).filter((e) => e.sv === g.sv && utc(e.t) >= desde)
      .sort((a, b) => utc(a.t) - utc(b.t));
    return cand[0] || null;
  }
  // 🔑 EL DORADO QUE TODAVÍA NO TERMINÓ: hasta 5 h después de empezar. Dlx, 01/10/2026, con «DORADO ×3 · RAP
  // EXHIBITION 2/8 · se jugó el martes» en la Tira: «si ya se jugó, que desaparezca». La insignia de su fecha sigue.
  doradoVigente() {
    const g = this.dorado();
    // 🔴 `utc(g.t) + 5 * 3600000` pegaba un número a un texto de fecha y la comparación daba siempre falso: el «DORADO
    // ×3» no salía nunca en la Tira ni en la semana de su servidor (revisión del 03/10/2026)
    return g && utc(g.t).getTime() + 5 * 3600000 > this.ahora.getTime() ? g : null;
  }
  esDorado(nombre, sv) {
    const g = this.dorado();
    return !!(g && g.sv === sv && limpio(g.n) === limpio(nombre));
  }
  // 📅 la más nueva primero POR FECHA (18/11/2026): por número, «Tu último evento» salía de otro día (las llaves se
  // procesan desordenadas: ver `llavesPorFecha()`)
  semanaDe(k) {
    const out = [];
    this.llavesPorFecha().forEach((ll) => (ll.tabla || []).forEach((f) => {
      // la clave, si la llave la trae (el ciclo la pone cuando el nombre se repite: dos «SOL»); si no, el nombre
      if (f[3] ? f[3] === k : this.esDe(f[0], k)) out.push([ll, f[1], f[2]]);
    }));
    return out;
  }
  buscado(k) { return ((this.d.mw || {}).b || []).find((b) => b.k === k) || null; }
  // la crew de alguien (la de su fila), con su gente
  crewDe(f) {
    if (!f) return null;
    // 🆕 ENTRAR A UNA CREW, AL INSTANTE (13/11/2026, Dlx: «Sí, claro» a las cuatro cosas al instante): si la lista en vivo
    // dice que esta persona está en una crew, ésa es la suya aunque la fila del ciclo todavía no lo sepa. Con la fila del
    // payload si la crew ya está ahí (sus puntos y su tier), con el nombre y el logo de ahora; si es nueva, en cero
    const V0 = typeof window !== 'undefined' ? window.CREWS_VIVAS : null;
    if (f.k && V0 && Array.isArray(V0.crews)) {
      const viva = V0.crews.find((y) => Array.isArray(y.gente) && y.gente.some((g) => g && g[0] === f.k));
      if (viva) {
        const n0 = limpio(viva.nombre).toLowerCase();
        const fila = (this.d.crews || []).find((y) => y.clave === viva.id || limpio(y.crew).toLowerCase() === n0);
        if (fila) return Object.assign({}, fila, { crew: viva.nombre, logo: viva.logo || fila.logo });
        return { crew: viva.nombre, clave: viva.id, logo: viva.logo || '', n: viva.gente.length, pts: 0, rk: 0, tier: 0, mejor: '',
          gente: viva.gente.map((g) => (g && g[0] && this.existe(g[0]) ? this.nombreDe(g[0]) : '')).filter(Boolean) };
      }
    }
    if (!f.crew) return null;
    // 🔴 POR LA CLAVE PRIMERO (19/10/2026): la fila trae la CLAVE de la crew («KS») y `crew` es el nombre que se ve
    // («Knowledge Sombrío»): comparando con el nombre, los seis de KS de la T1 no tenían crew en su perfil, ni la
    // historia «TU CREW», ni el link en el visor
    const c = limpio(f.crew).toLowerCase();
    const cs = this.d.crews || [];
    const x = cs.find((y) => y.clave === f.crew) || cs.find((y) => limpio(y.crew).toLowerCase() === c) || null;
    // 🗑️ AL INSTANTE (13/11/2026, Dlx: «yo eliminé la crew ULEYES pero sigue saliendo que estoy ahí… asegúrate que
    // algunos cambios sean inmediatos, no todos pero este sí»): la fila sale del ciclo, que pasa cada media hora. Si la
    // página ya tiene la lista en vivo (`window.CREWS_VIVAS`, de crews.js), una crew que ya no existe, o de la que esta
    // persona ya no es parte, deja de contar. Sumarse sigue esperando al ciclo: ahí los puntos y el tier salen de él
    const V = typeof window !== 'undefined' ? window.CREWS_VIVAS : null;
    if (x && V && Array.isArray(V.crews)) {
      const nx = limpio(x.crew).toLowerCase();
      const viva = V.crews.find((y) => y.id === x.clave || y.id === x.crew || limpio(y.nombre).toLowerCase() === nx);
      if (!viva) return null;
      if (f.k && Array.isArray(viva.gente) && !viva.gente.some((g) => g && g[0] === f.k)) return null;
    }
    return x;
  }
  // un país: su puesto en la Liga y su gente, en el orden del ranking
  paisDe(cc) {
    if (!cc) return null;
    const ps = (this.d.paises || []).filter((p) => p.n);
    const i = ps.findIndex((p) => p.cc === cc);
    const gente = this.oficiales().filter((f) => f.cc === cc);
    if (i < 0 && !gente.length) return null;
    return { cc, pos: i >= 0 ? i + 1 : null, pts: i >= 0 ? ps[i].pts : 0, n: i >= 0 ? ps[i].n : gente.length, gente };
  }
  // una encuesta abierta (`elegido` o `x2`), o nada
  encuesta(tipo) {
    return (this.d.enc || []).find((e) => e.tipo === tipo && utc(e.hasta) > this.ahora && (e.op || []).length) || null;
  }
  desdeLunes() {
    const m = this.d.mult || {};
    return m.ini ? utc(m.ini) : new Date(this.ahora - 7 * 86400000);
  }
  muroLimpio() {
    // sin la carta Competitiva que llega con la primera letra: va adentro de la noticia de la letra
    return this.muro.filter((o) => !(o.tipo === 'tarjeta' && this.muro.some((p) =>
      p.tipo === 'rango' && JSON.stringify(p.ks) === JSON.stringify(o.ks) && p.t === o.t)));
  }
  svDe(it) {
    if (it.sv) return it.sv;
    for (const k of ksDe(it)) if (this.T[k]) return this.T[k].sv;
    return '';
  }
  // las caras de la fila de arriba: gente con algo nuevo (carta, letra, título, caza)
  novedadesGente() {
    const vistos = new Set();
    const out = [];
    const yo = this.yo ? this.yo.k : '';
    this.muro.forEach((it) => {
      const et = { tarjeta: 'carta nueva', campeon: 'campeón', caza: 'cazó', rango: 'rango ' + (it.rg || '') }[it.tipo];
      if (!et) return;
      (it.quien || []).forEach((q, i) => {
        const k = (it.ks || [])[i];
        if (!k || vistos.has(k) || k === yo) return;
        vistos.add(k);
        out.push([k, this.aka(q, k), et]);
      });
    });
    return out;
  }
  // una novedad del muro, para «Lo último»: [categoría, título, visual, cuándo, destino]
  // 🪪 con los nombres oficiales y la clave de cada uno aunque el muro no la traiga (17/11/2026): el muro escribe el nombre
  // de la llave, y sin clave no había cara ni perfil
  itemMuro(it) {
    const ks0 = ksDe(it);
    const fs = (it.quien || []).map((n, i) => this.quien(n, ks0[i]));
    const q = (it.quien || []).map((n, i) => (fs[i] ? limpio(fs[i].n) : limpio(n)));
    // (tantas como traiga el muro: una carta nueva puede venir con su clave y sin nombre)
    const ks = Array.from({ length: Math.max(ks0.length, q.length) }, (_, i) => ks0[i] || (fs[i] && fs[i].k) || '');
    const c = this.cuando(it.t);
    if (it.tipo === 'tarjeta') {
      const nombre = { pais: 'de País', temporada: 'de Temporada', servidor: 'de Servidor', competitivo: 'Competitiva' }[it.carta];
      return ['CARTA NUEVA', q[0] + ' ya tiene su carta ' + nombre, ['carta', ks[0], it.carta], c, { carta: ks[0], cual: it.carta }];
    }
    if (it.tipo === 'rango') {
      const f = ks.length ? this.T[ks[0]] : null;
      const vis = f && (f.c || []).includes('competitivo') ? ['carta', ks[0], 'competitivo'] : ['rango', it.rg];
      return ['RANGO', (it.primero ? q[0] + ' consigue su primera letra: ' : q[0] + ' pasa a rango ') + it.rg, vis, c, { perfil: ks[0] }];
    }
    // 🏟️ lo que pasa en las ligas (16/10/2026): a su liga
    if (it.tipo === 'ligahito') {
      const que = it.que === 'campeon' ? ' es el campeón de ' : it.que === 'invicto' ? ' lleva ' + (it.pg || 5) + ' ganadas sin perder en '
        : ' tomó la punta de ';
      return [(it.que === 'campeon' ? 'CAMPEÓN DE LIGA · ' : 'LIGA · ') + siglaDe(it.sv), q[0] + que + limpio(it.ln),
        ['cara', ks[0] || '', q[0]], c, { ruta: '#/ligas/' + encodeURIComponent(it.liga || '') }];
    }
    if (it.tipo === 'campeon') {
      return ['CAMPEÓN · ' + siglaDe(it.sv), q.join(' y ') + (q.length > 1 ? ' se quedan con ' : ' se queda con ') + nombreEv(it.ev, it.ll),
        ['cara', ks[0] || '', q[0]], c, { llave: it.ll }];
    }
    if (it.tipo === 'caza') {
      return ['SE BUSCA · CAZA', q[0] + ' cazó a ' + this.aka(it.a) + ' (' + it.cat + ') y cobra ' + num(it.pts),
        ['cara', ks[0] || '', q[0]], c, { ancla: 'sebusca' }];
    }
    if (it.tipo === 'anuncio') {
      return ['EVENTO · ' + siglaDe(it.sv), siglaDe(it.sv) + ' anunció ' + limpio(it.ev), ['sv', it.sv], c, { ruta: '#/eventos' }];
    }
    if (it.tipo === 'liga') return ['LA LIGA', limpio(it.tit), ['ul'], c, { link: it.link }];
    // 🖼️ el flyer de una liga de los servidores (bot/muro.py `flyers()`, Dlx 14/10/2026: «Flyers en Publicaciones e
    // Historias»): la imagen y a la liga
    if (it.tipo === 'flyer') {
      return ['LIGA · ' + siglaDe(it.sv), limpio(it.ln) + (it.tit ? ': ' + limpio(it.tit) : ''), ['img', it.img], c,
        { ruta: '#/ligas/' + encodeURIComponent(it.liga || '') }];
    }
    // 🔄 lo que publican solos la gente y los servidores (bot/muro_solos.py, 15/11/2026). Acá en tercera persona: Lo último
    // no lleva la firma arriba, como Publicaciones. El lunes y el cierre de cada servidor no: son trece a la vez
    const perfil = { perfil: ks[0] };
    if (it.tipo === 'podio') return ['PRIMER PODIO · ' + siglaDe(it.sv), q[0] + ' salió ' + String(it.puesto || '').toLowerCase() + ' en ' + nombreEv(it.ev, it.ll), ['cara', ks[0] || '', q[0]], c, it.ll ? { llave: it.ll } : perfil];
    if (it.tipo === 'top10') return ['TOP 10', q[0] + ' entró al top 10 del Ranking ' + (it.rk === 'competitivo' ? 'Competitivo' : 'Temporada') + ' (#' + it.pos + ')', ['cara', ks[0] || '', q[0]], c, perfil];
    if (it.tipo === 'subio') return ['SUBE EN EL RANKING', q[0] + ' subió ' + ((it.de || 0) - (it.a || 0)) + ' puestos en la semana', ['cara', ks[0] || '', q[0]], c, perfil];
    if (it.tipo === 'racha') return ['RACHA', q[0] + ' lleva ' + it.racha + ' eventos seguidos', ['cara', ks[0] || '', q[0]], c, perfil];
    if (it.tipo === 'crewunion' || it.tipo === 'crewnueva') {
      return ['CREWS', q[0] + (it.tipo === 'crewnueva' ? ' creó la crew ' : ' se unió a la crew ') + limpio(it.nombre), ['cara', ks[0] || '', q[0]], c,
        { ruta: '#/crew/' + encodeURIComponent(it.crew || '') }];
    }
    if (it.tipo === 'svtop') return ['NUEVO #1 · ' + siglaDe(it.sv), q[0] + ' es el nuevo #1 de ' + siglaDe(it.sv), ['cara', ks[0] || '', q[0]], c, perfil];
    if (it.tipo === 'svrecord') return ['RÉCORD · ' + siglaDe(it.sv), siglaDe(it.sv) + ': ' + it.part + ' raperos en ' + nombreEv(it.ev, it.ll) + ', su récord', ['sv', it.sv], c, it.ll ? { llave: it.ll } : { ruta: '#/eventos' }];
    if (it.tipo === 'svchat') {
      const ct = this.chatTexto(it);
      return ct ? [this.chatEtq(it) + ' · ' + siglaDe(it.sv), ct.tit, ['sv', it.sv], c, { ruta: '#/sv/' + encodeURIComponent(siglaDe(it.sv)) }] : null;
    }
    if (it.tipo === 'svmeta') return ['META CUMPLIDA · ' + siglaDe(it.sv), siglaDe(it.sv) + ' cumplió su meta de la semana', ['sv', it.sv], c, { ruta: '#/sv/' + encodeURIComponent(siglaDe(it.sv)) }];
    return null;
  }
  // 💬 EL DÍA FUERTE DE UN CHAT GENERAL (`svchat`, bot/chats.py `momentos()`, 17/11/2026: Dlx, «si pasan cosas
  // dramáticas ponerlas en las historias»): `{tit, nombres, ev}`, contado por la Liga o, con `nos`, por el servidor
  // (Publicaciones). `null` si no hay qué decir: el nombre del día de alguien que no está en la temporada.
  // ⚠️ Una polémica no trae nombres ni evento (el muro no los manda): nunca se dice de quién ni de qué
  // 🗞️ TANDA 3 (21/11/2026, Dlx: «más directo… algo dramático como noticias sin ser noticias»): las historias con nombre
  // (`que`: reto, cara, retiro, regreso, elogio, favorito; `ks` las claves) se escriben como titulares, y `sub` dice de
  // dónde salió. Sin los nombres (alguien que no está en la temporada), no hay historia
  chatTexto(it, nos) {
    const sv = siglaDe(it.sv);
    const de = (ks) => (ks || []).map((k) => this.quienK(k)).filter(Boolean).map((f) => limpio(f.n));
    const q = de(it.hablan);
    const nombres = q.length > 1 ? q.slice(0, -1).join(', ') + ' y ' + q[q.length - 1] : q[0] || '';
    const en = nos ? 'en nuestro chat' : 'en el chat de ' + sv;
    const ev = it.que !== 'polemica' && it.ev ? limpio(it.ev) : '';
    const p = de(it.ks);
    // 🗨️ LA FRASE QUE ARMÓ LA HISTORIA (tanda 4, 21/11/2026; Dlx: «citarlo público»), con quien la escribió: el nombre de
    // su perfil si es de la Lista, el de Discord si no. El raid no lleva (el spam no se cita)
    const qc = it.cita && it.cita.k ? this.quienK(it.cita.k) : null;
    const cita = it.cita && it.cita.txt && it.que !== 'raid' ? { txt: String(it.cita.txt), n: limpio((qc && qc.n) || it.cita.n || '') } : null;
    const dos = ['reto', 'cara'].includes(it.que);
    if (CHAT_ETQ[it.que] && !['polemica', 'raid', 'pico', 'tema'].includes(it.que)) {
      if (p.length < (dos ? 2 : 1)) return null;
      const T = {
        reto: it.mutuo ? [p[0] + ' y ' + p[1] + ' se tienen ganas', 'Los dos se pidieron batalla ' + en]
          : [p[0] + ' le pide batalla a ' + p[1], 'Lo pidió ' + en],
        cara: [p[0] + ' y ' + p[1] + ', cara a cara', 'No pararon de contestarse ' + en],
        retiro: ['¿Se retira ' + p[0] + '?', 'Lo dijo ' + en],
        regreso: [p[0] + ' anunció que vuelve', 'Lo dijo ' + en],
        elogio: [(nos ? 'Nuestro chat se rinde ante ' : 'El chat de ' + sv + ' se rinde ante ') + p[0], (it.n || 'Muchas') + ' personas lo felicitaron'],
        favorito: [(nos ? 'Nuestro chat ya tiene favorito: ' : 'En ' + sv + ' ya tienen favorito: ') + p[0], (it.n || 'Muchos') + ' lo dan como ganador'],
      }[it.que];
      return { tit: T[0], sub: T[1], nombres: p.join(' y '), ev, ks: it.ks || [], cita };
    }
    // 🚨 el raid (tanda 4): cuántos mensajes de spam y de cuántas cuentas, sin nombres
    if (it.que === 'raid') {
      return { tit: nos ? 'Nos quisieron raidear el chat' : 'Raid en el chat de ' + sv,
        sub: num(it.n) + ' mensajes de spam' + (it.cuentas > 1 ? ' de ' + num(it.cuentas) + ' cuentas' : ''), nombres: '', ev: '', ks: [], cita: null };
    }
    // 🔥 la polémica, con quién acusó y a quién (tanda 4; Dlx: «sí debería, esto es muy importante, para el show»)
    if (it.que === 'polemica') {
      const ante = nos ? 'Se armó en nuestro chat' : 'Se armó en el chat de ' + sv;
      const tit = p.length > 1 ? ante + ': ' + p[0] + ' contra ' + p[1] : p.length ? ante + ', y ' + p[0] + ' está en el medio'
        : nos ? 'Se armó la polémica en nuestro chat' : ante;
      return { tit, sub: 'Hubo acusaciones ' + en, nombres: p.join(' y '), ev: '', ks: (it.ks || []).filter((k) => this.quienK(k)), cita };
    }
    let tit;
    if (it.que === 'tema') {
      if (!nombres) return null;
      tit = (nos ? 'En nuestro chat todos hablan de ' : 'Todo ' + sv + ' habla de ') + nombres;
    } else tit = (nos ? 'Nuestro chat explotó' : 'Explotó el chat de ' + sv) + (it.x >= 2 ? ': ' + String(it.x).replace('.', ',') + ' veces un día normal' : '');
    return { tit, sub: '', nombres, ev, ks: [], cita };
  }
  // la etiqueta de cada historia del chat
  chatEtq(it) { return CHAT_ETQ[it.que] || 'EL CHAT'; }
  // 🏟️ LAS LIGAS DE LOS SERVIDORES (`ligas` del payload, bot/ligas.py `para_web()`)
  ligas() { return ((this.d.ligas || {}).ligas) || []; }
  // 🗓️ LA FECHA DE HOY DE CADA LIGA (Dlx, 14/10/2026: «Ligas en el Inicio»: la fecha de hoy, como un evento más). Hoy
  // es lo que la liga ANUNCIÓ para hoy (`prox`) o una jornada con veredictos de hoy (se está jugando). `[{L, j, t, n,
  // juega}]`: `t` el instante si lo dijo, `n` cuántas batallas de esa jornada ya tienen veredicto, `juega` si hay de hoy
  // `f0` es el resumen de su última fecha (`ligas.separar()`: las fechas enteras no viajan en el lobby)
  fechasHoy() {
    const hoy = this.diaClave(this.ahora);
    const out = [];
    this.ligas().forEach((L) => {
      const p = L.prox;
      const pHoy = !!(p && (p.t ? this.diaClave(p.t) === hoy : p.d === hoy));
      const f = L.f0;
      const fHoy = !!(f && f.t && this.diaClave(f.t) === hoy);
      if (!pHoy && !fHoy) return;
      const j = (pHoy && p.j) || (fHoy && f.j) || null;
      out.push({ L, j, t: pHoy && p.t ? p.t : '', n: fHoy ? f.n || 0 : 0, juega: fHoy, link: pHoy ? p.link || '' : '' });
    });
    return out;
  }
  // lo último sin repetir: la primera de cada clase, y después el resto
  variados(n) {
    const muro = this.muroLimpio().filter((it) => it.tipo !== 'anuncio');
    const items = [];
    muro.forEach((it) => { const x = this.itemMuro(it); if (x) items.push([it, x]); });
    const vistos = new Set();
    const primero = [];
    items.forEach(([it, x]) => { if (!vistos.has(it.tipo)) { vistos.add(it.tipo); primero.push(x); } });
    const resto = items.filter(([, x]) => !primero.includes(x)).map(([, x]) => x);
    return primero.concat(resto).slice(0, n);
  }
  // los duelos que ganó y jugó alguien desde una fecha
  duelosDe(k, desde) {
    let g = 0;
    let j = 0;
    Object.values(this.d.llaves || {}).forEach((ll) => {
      if (utc(this.fechaLlave(ll)) < desde) return;
      (ll.rondas || []).forEach((r) => (r.b || []).forEach((b) => {
        const lados = (b[0] || []).map((x) => (typeof x === 'string' ? x : x.join(' & ')));
        if (lados.length === 2 && lados.some((x) => this.esDe(x, k))) {
          j += 1;
          if (this.esDe(typeof b[1] === 'string' ? b[1] : (b[1] || []).join(' & '), k)) g += 1;
        }
      }));
    });
    return [g, j];
  }
  // ⚔️ TUS CRUCES 1v1 (12/11/2026, Dlx: «cuántas victorias, derrotas y el rival más fuerte enfrentado»): desde una fecha
  // o en una sola llave. `{g, p, fuerte}`; el más fuerte es el mejor ubicado en la Temporada de los que tienen fila
  crucesDe(k, { desde = null, ll = null } = {}) {
    let g = 0;
    let p = 0;
    let fuerte = null;
    const lista = ll ? [ll] : Object.values(this.d.llaves || {}).filter((x) => !desde || utc(this.fechaLlave(x)) >= desde);
    lista.forEach((x) => (x.rondas || []).forEach((r) => (r.b || []).forEach((b) => {
      const lados = (b[0] || []).map((y) => (typeof y === 'string' ? y : y.join(' & ')));
      if (lados.length !== 2) return;
      const i = lados.findIndex((y) => this.esDe(y, k));
      if (i < 0) return;
      const gan = typeof b[1] === 'string' ? b[1] : (b[1] || []).join(' & ');
      if (!gan) return;
      if (this.esDe(gan, k)) g += 1; else p += 1;
      const f = this.fila(lados[1 - i]);
      if (f && f.k !== k && f.pos && (!fuerte || f.pos < fuerte.pos)) fuerte = { k: f.k, n: limpio(f.n), pos: f.pos, gane: this.esDe(gan, k) };
    })));
    return { g, p, fuerte };
  }
}

// ── quién mira: lo que dejó «Entrar con Discord» (`lg:dc`) o el «quién soy» elegido a mano (`lg:yo`) ──
function leer(k) {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; }
}
// 🛠️ «VER COMO: SIN CUENTA» DE MODS (20/11/2026, mods_pag.jsx): la página se dibuja como la ve quien no entró. Sólo lo que
// se dibuja: los pedidos siguen yendo con tu cuenta. Se lee directo de la pestaña (`lg:mods`) y no de mods.js, que ya
// importa de acá
function sinCuentaMods() {
  try { return (window.__mods || JSON.parse(sessionStorage.getItem('lg:mods') || '{}') || {}).vista === 'sincuenta'; } catch (e) { return false; }
}
export function quienMira() {
  if (sinCuentaMods()) return { k: null, dc: null };
  const dc = leer('lg:dc');
  if (dc && dc.clave) return { k: dc.clave, dc };
  const yo = leer('lg:yo');
  return { k: typeof yo === 'string' ? yo : null, dc };
}
export function aQuienSigo() {
  const s = leer('lg:sigo');
  if (Array.isArray(s)) return s;
  if (s && typeof s === 'object') return Object.keys(s);
  return [];
}
