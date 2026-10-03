// La Liga, leída del payload público (`/api/lobby`, el mismo `D` de app.js) y del muro (`/api/muro`).
// Es la traducción de la clase `Liga` de docs/remake/reales.py, el prototipo que se miró con Dlx: si una regla cambia
// allá, cambia acá.

export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre',
  'octubre', 'noviembre', 'diciembre'];
export const PAIS = {
  ar: 'Argentina', co: 'Colombia', cl: 'Chile', ve: 'Venezuela', mx: 'México', pe: 'Perú', uy: 'Uruguay',
  ec: 'Ecuador', bo: 'Bolivia', py: 'Paraguay', us: 'Estados Unidos', es: 'España', do: 'Rep. Dominicana',
  pa: 'Panamá', pr: 'Puerto Rico', cr: 'Costa Rica', gt: 'Guatemala', hn: 'Honduras', sv: 'El Salvador',
  ni: 'Nicaragua', cu: 'Cuba', br: 'Brasil', ae: 'Emiratos', no: 'Noruega',
};

// sin emojis, banderas ni rellenos invisibles: «RIZAS 🇻🇪» -> «RIZAS»
const FUERA = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{20E3}\u{200D}\u{3164}\u{2800}\u{2070}-\u{209F}\u{B9}\u{B2}\u{B3}\u{E0020}-\u{E007F}]/gu;
export function limpio(s) {
  return String(s || '').replace(FUERA, '').replace(/\s+/g, ' ').replace(/^[ ·-]+|[ ·-]+$/g, '');
}
export function recorte(s, n = 120) {
  s = limpio(s).replace(/\*/g, '');
  if (s.length <= n && !/\s\S{1,2}$/.test(s)) return s;
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
export const num = (n) => String(Math.trunc(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export const mult = (x) => '×' + String(x || 1).replace('.', ',');
export const norm = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

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
// como `normNombre()` de app.js: la clave de `alias` en el payload (`respaldo._norm`)
const normNombre = (s) => String(s || '').normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
export function hora(t) {
  const d = utc(t);
  if (W.fmtHora) return W.fmtHora(d);
  return d.toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' });
}
function diaISO(d) {
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
// los minutos desde la medianoche, en la zona de quien mira (la de Ajustes si eligió una: `zona()` de app.js)
export function minutosDelDia(t) {
  const d = utc(t);
  try {
    const o = { hour: 'numeric', minute: 'numeric', hourCycle: 'h23' };
    const z = W.zona && W.zona();
    if (z) o.timeZone = z;
    const p = {};
    new Intl.DateTimeFormat('en-US', o).formatToParts(d).forEach((x) => { p[x.type] = x.value; });
    const n = (Number(p.hour) % 24) * 60 + Number(p.minute);
    if (!isNaN(n)) return n;
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
  constructor(D, muro, ahora, yo, sigue) {
    this.d = D;
    this.muro = (muro && muro.items) || [];
    this.ahora = ahora || new Date();
    this.T = {};
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
    this.svs = {};
    (D.svs || []).forEach((s) => { this.svs[s.sv] = s; });
    this.rg = {};
    (D.rangos || []).forEach((r) => { this.rg[r.r] = r.color; });
    this.yo = yo && this.T[yo] ? this.T[yo] : null;
    // la temporada sale del payload: «T1» escrito a mano quedaría viejo el día que arranque la T2
    this.temp = String(D.temporada || 'T1').toUpperCase();
    this.tempLarga = 'TEMPORADA ' + this.temp.replace(/^T/, '');
    this.sigue = (sigue || []).filter((k) => this.T[k]);
  }

  // ── rutas de imágenes (todas públicas: R2, el CDN de Discord y la propia página) ──
  cartaUrl(k, cual) {
    const f = this.T[k];
    if (!f || !(f.c || []).includes(cual)) return null;
    const i = (this.d.cartas || []).indexOf(cual);
    const v = typeof f.cv === 'string' && i >= 0 ? f.cv.split('.')[i] : '';
    return this.d.r2 + '/' + k + '/' + cual + '.webp' + (v ? '?v=' + v : '');
  }
  // ¿la imagen de esa carta es de antes de los números de ahora? Lo mide el ciclo (`_versiones()` de subir_web.py,
  // `vj`); es el `vieja()` de app.js. Dlx, 01/10/2026: Makmah #3 en su carta y cuarto en Los que mandan — la carta se
  // estaba redibujando y no lo decía
  cartaVieja(k, cual) {
    const f = this.T[k];
    const i = (this.d.cartas || []).indexOf(cual);
    return !!(f && i >= 0 && typeof f.vj === 'string' && f.vj.indexOf(String(i)) >= 0);
  }
  avUrl(k) {
    const f = this.T[k];
    // a 256: las caras de las historias y del perfil se dibujan a ~100 px, el doble en una pantalla de celular
    return f && f.av ? 'https://cdn.discordapp.com/avatars/' + f.av + '.webp?size=256' : null;
  }
  // la cara de alguien que jugó y no está en la tabla (corta en 200): la piden `Cara` y `CaraH` cuando no hay clave
  avNombre(nombre) {
    const av = nombre ? this.A[limpio(nombre).toLowerCase()] : null;
    return av ? 'https://cdn.discordapp.com/avatars/' + av + '.webp?size=256' : null;
  }
  // el logo de HOY de cada servidor: el payload trae el ícono actual de Discord (`svs[].logo`, ver `subir_web.py`) y
  // el guardado sólo de respaldo. Dlx, 30/09/2026: «usa los LOGOS actuales de cada servidor». El Inicio usaba
  // siempre el archivo guardado, y el de URBF (y la cobra de SR) ya no eran los de hoy
  // 🔴 EN MÁXIMA CALIDAD. Dlx, 01/10/2026: «que las imágenes o logotipos en todos los lugares estén en máxima
  // calidad». El ícono llegaba pedido a 128 px y el escenario lo dibuja a ~330: se veía borroso. Se pide a 512 en todos
  // lados —una sola imagen por servidor, que el navegador reusa— y a 1024 donde se dibuja grande (`grande`). El CDN de
  // Discord devuelve lo que se subió, nunca más: pedir de más no agranda nada, sólo deja de achicar
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
  esDe(nombre, k) {
    const f = this.T[k];
    if (!f) return false;
    const a = limpio(nombre);
    const b = limpio(f.n);
    return this.dobles.has(b.toLowerCase()) ? a === b : a.toLowerCase() === b.toLowerCase();
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
    return 'el ' + DIAS[diaSemana(b)];
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
  falta(t) {
    const seg = Math.floor((utc(t) - this.ahora) / 1000);
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
  esCancelado(e) {
    const m = /\/(\d{15,22})\/?$/.exec(String((e && e.link) || ''));
    return !!m && this.cancelados().some((c) => String(c.id) === m[1]);
  }
  vivo() {
    const m = this.d.vivo_min || 90;
    const ls = typeof window !== 'undefined' ? Object.values(window.VIVO_L || {}).filter((L) => !L.terminada) : [];
    const sigue = (e) => {
      if (!ls.length || !window.llaveDeEvento) return false;
      try { return !!window.llaveDeEvento(e, ls); } catch (err) { return false; }
    };
    const desde = (e) => (this.ahora - utc(e.cuando)) / 1000;
    const out = (this.d.proximos || []).filter((e) => {
      const s = desde(e);
      return !this.esCancelado(e) && s >= 0 && (s <= m * 60 || (s <= 8 * 3600 && sigue(e)));
    });
    (this.d.calendario || []).forEach((c) => {
      const e = { nombre: c.n, sv: c.sv, cuando: c.t, link: c.link };
      const s = desde(e);
      if (s > m * 60 && s <= 8 * 3600 && !this.esCancelado(e) && !out.some((x) => x.sv === e.sv && limpio(x.nombre) === limpio(e.nombre)) && sigue(e)) out.push(e);
    });
    return out;
  }
  luego() { return (this.d.proximos || []).filter((e) => utc(e.cuando) > this.ahora && !this.esCancelado(e)); }
  llaves() { return Object.values(this.d.llaves || {}).sort((a, b) => Number(b.n) - Number(a.n)); }
  campeon(ll) {
    const t = ll.tabla || [];
    const g = t.filter((x) => x[1] === 'Campeón').map((x) => limpio(x[0]));
    return g.length ? g : (t.length ? [limpio(t[0][0])] : []);
  }
  fechaLlave(ll) {
    const c = (this.d.calendario || []).find((e) => e.ll === ll.n || String(e.ll) === String(ll.n));
    return c ? c.t : ll.dia + 'T23:00:00Z';
  }
  multSv(sv) { return ((this.d.mult || {}).sv || {})[sv]; }
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
  semanaDe(k) {
    const out = [];
    this.llaves().forEach((ll) => (ll.tabla || []).forEach((f) => {
      // la clave, si la llave la trae (el ciclo la pone cuando el nombre se repite: dos «SOL»); si no, el nombre
      if (f[3] ? f[3] === k : this.esDe(f[0], k)) out.push([ll, f[1], f[2]]);
    }));
    return out;
  }
  buscado(k) { return ((this.d.mw || {}).b || []).find((b) => b.k === k) || null; }
  // la crew de alguien (la de su fila), con su gente
  crewDe(f) {
    if (!f || !f.crew) return null;
    const c = limpio(f.crew).toLowerCase();
    return (this.d.crews || []).find((x) => limpio(x.crew).toLowerCase() === c) || null;
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
    for (const k of it.ks || []) if (this.T[k]) return this.T[k].sv;
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
        out.push([k, limpio(q), et]);
      });
    });
    return out;
  }
  // una novedad del muro, para «Lo último»: [categoría, título, visual, cuándo, destino]
  itemMuro(it) {
    const q = (it.quien || []).map(limpio);
    const ks = it.ks || [];
    const c = this.cuando(it.t);
    if (it.tipo === 'tarjeta') {
      const nombre = { pais: 'de País', temporada: 'de Temporada', servidor: 'de Servidor', competitivo: 'Competitiva' }[it.carta];
      return ['CARTA NUEVA', q[0] + ' ya tiene su carta ' + nombre, ['carta', ks[0], it.carta], c, { carta: ks[0] }];
    }
    if (it.tipo === 'rango') {
      const f = ks.length ? this.T[ks[0]] : null;
      const vis = f && (f.c || []).includes('competitivo') ? ['carta', ks[0], 'competitivo'] : ['rango', it.rg];
      return ['RANGO', (it.primero ? q[0] + ' consigue su primera letra: ' : q[0] + ' pasa a rango ') + it.rg, vis, c, { perfil: ks[0] }];
    }
    if (it.tipo === 'campeon') {
      return ['CAMPEÓN · ' + it.sv, q.join(' y ') + (q.length > 1 ? ' se quedan con ' : ' se queda con ') + limpio(it.ev),
        ['cara', ks[0] || '', q[0]], c, { llave: it.ll }];
    }
    if (it.tipo === 'caza') {
      return ['SE BUSCA · CAZA', q[0] + ' cazó a ' + it.a + ' (' + it.cat + ') y cobra ' + num(it.pts),
        ['cara', ks[0] || '', q[0]], c, { ancla: 'sebusca' }];
    }
    if (it.tipo === 'anuncio') {
      return ['EVENTO · ' + it.sv, it.sv + ' anunció ' + limpio(it.ev), ['sv', it.sv], c, { ruta: '#/eventos' }];
    }
    if (it.tipo === 'liga') return ['LA LIGA', limpio(it.tit), ['ul'], c, { link: it.link }];
    return null;
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
}

// ── quién mira: lo que dejó «Entrar con Discord» (`lg:dc`) o el «quién soy» elegido a mano (`lg:yo`) ──
function leer(k) {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; }
}
export function quienMira() {
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
