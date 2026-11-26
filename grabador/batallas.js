// ⚔️ CADA BATALLA EN LA GRABACIÓN (21/11/2026; Dlx, a «un clip por batalla, al perfil de cada MC y al organizador»:
// «dale»). El grabador sabe CUÁNDO habló cada cuenta —Discord sólo manda audio de quien está hablando, así que los
// paquetes mismos son el reloj (`Habla`)—, y el Worker sabe QUIÉN peleó con quién (`/avisos/batallas`,
// `batallasGrabacion()` en bot/avisos.js: las llaves de ese servidor con la cuenta de cada lado). Juntos, cada batalla
// es el tramo de la grabación donde los de ESA batalla se turnan para hablar (`ubicar()`).
//
// ⚠️ ES UNA APROXIMACIÓN, Y LA ENTREGA LO DICE. Un micrófono con ruido manda paquetes aunque nadie hable, y dos MCs
// charlando antes de pelear se parecen a una batalla corta. Por eso cada lado tiene que RAPEAR cerca —`RAP_S` de habla en
// `RAP_VENTANA_S` seguidos, en ±`VECINDAD_S`: el ruido de un micrófono abierto no llega, una charla casi nunca—, el tramo
// tiene que durar (`MIN_LARGO_S`) y se le deja aire antes y después. La vecindad es de un turno largo (75 s): con menos, el
// primer turno de la batalla quedaba afuera, porque el que abre rapea un minuto antes de que el otro hable.
//
// ⚠️ UN MC QUE PELEA DOS SEGUIDAS (gana y sigue) estira las dos: su último turno de una está cerca del primero de la
// otra. Cuando dos tramos se pisan, el corte va donde habló por última vez el rival de la primera (antes de que hable el
// de la segunda): ahí terminó esa batalla. Si no se puede saber, a la mitad de lo que se pisan (`ubicarTodas()`).
//
// ⚠️ UN LADO SIN CUENTA CONOCIDA no se puede ubicar por su voz: con dos lados conocidos alcanza (en un todos contra
// todos de tres, el tercero cae adentro igual); con uno solo, esa batalla no sale.
export const PASO_S = 5;
export const VECINDAD_S = 75;
export const RAP_VENTANA_S = 20;
export const RAP_S = 12;
// 🔁 EL 4x4 (25/11/2026, WOF: «0 de 10»). Con turnos de 10 s que se alternan, ningún lado junta `RAP_S` en `RAP_VENTANA_S`
// (10 de 20, siempre): la batalla de CrisZJ y Masino —2 min 20 s de turnos limpios— no se veía. Un turno así es habla casi
// sin cortes: `DENSO_S` de habla en `TURNO_DENSO` baldes seguidos (8 s de 10) también es rapear. Una charla corta de a
// ratos; un turno, no. ⚠️ Sumados y no «4 en cada uno»: un turno de 9 s cae partido entre dos baldes como 5,0 + 3,5
export const TURNO_DENSO = 2;
export const DENSO_S = 8;
/** `a` (habla por balde): ¿rapea en la ventana que arranca en el balde `k` y termina antes de `hi`? */
function rapeaDesde(a, k, w, hi) {
  const fin = Math.min(hi, k + w);
  let s = 0, denso = false;
  for (let j = k; j < fin; j++) {
    s += a[j];
    if (j + TURNO_DENSO <= fin) {
      let d = 0;
      for (let x = j; x < j + TURNO_DENSO; x++) d += a[x];
      if (d >= DENSO_S) denso = true;
    }
  }
  return s >= RAP_S || denso;
}
export const MIN_BALDE_S = 2;
export const JUNTAR_S = 40;
export const MIN_LARGO_S = 60;
export const ANTES_S = 5;
export const DESPUES_S = 10;
//: un paquete de Opus son 20 ms; un hueco de más de esto entre paquetes de la misma cuenta corta el tramo
const HUECO_MS = 300;

/** Cuándo habló cada cuenta, de los paquetes que llegan: `[desde_ms, hasta_ms]` por cuenta. */
export class Habla {
  constructor() { this.t = new Map(); }

  agregar(id, ms) {
    let l = this.t.get(id);
    if (!l) this.t.set(id, (l = []));
    const u = l[l.length - 1];
    if (u && ms - u[1] <= HUECO_MS) u[1] = ms + 20;
    else l.push([ms, ms + 20]);
  }

  /** Los segundos que habló cada cuenta, para el log. */
  segundos() {
    const out = {};
    for (const [id, l] of this.t) out[id] = Math.round(l.reduce((s, [a, b]) => s + b - a, 0) / 1000);
    return out;
  }
}

// 🔎 EL LADO SIN CUENTA, BUSCADO ENTRE QUIENES HABLARON (25/11/2026, Dlx: «que el bot grabe bien cuando deba y con calidad
// para que luego lo demás salga con calidad»). Del 22 al 24/11 se ubicaron 75 de 108 batallas (69 %): un lado cuyo nombre de
// la llave no se encontró entre la gente de la Liga llega sin cuenta (`id: ''`), y con un solo lado conocido la batalla no
// sale —ni su audio, ni su short—. Pero el grabador sabe quién estuvo EN LA LLAMADA, con sus nombres de Discord: buscar ahí
// es buscar entre 20 personas y no entre 800. Se da por esa cuenta sólo si UNA de las que hablaron coincide (dos dudosas:
// ninguna) y no es ya alguien más de esa llave con otro nombre
const PEQUENAS = { 'ᴀ': 'a', 'ʙ': 'b', 'ᴄ': 'c', 'ᴅ': 'd', 'ᴇ': 'e', 'ꜰ': 'f', 'ɢ': 'g', 'ʜ': 'h', 'ɪ': 'i', 'ᴊ': 'j', 'ᴋ': 'k',
  'ʟ': 'l', 'ᴍ': 'm', 'ɴ': 'n', 'ᴏ': 'o', 'ᴘ': 'p', 'ǫ': 'q', 'ʀ': 'r', 'ꜱ': 's', 'ᴛ': 't', 'ᴜ': 'u', 'ᴠ': 'v', 'ᴡ': 'w', 'ʏ': 'y', 'ᴢ': 'z' };

/** Un nombre de la llave o de Discord, comparable: sin el puesto de adelante («#81 | Gus»), sin letras de adorno
 *  (𝗕𝗢𝗟𝗗, ᴠᴇʀꜱᴀʟɪᴛᴀꜱ), tildes, banderas ni signos */
export function normVoz(s) {
  let x = String(s || '');
  if (x.includes('|')) x = x.split('|').filter((p) => p.trim()).pop() || '';
  return [...x.normalize('NFKD')].map((ch) => PEQUENAS[ch] || ch).join('').toLowerCase()
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

const parecido = (a, b) => {
  if (!a || !b) return false;
  if (a === b) return true;
  const [c, l] = a.length <= b.length ? [a, b] : [b, a];
  return c.length >= 4 && c.length / l.length >= 0.5 && l.includes(c);
};

// 🔤 LA MISMA PERSONA, ESCRITA DE DOS MANERAS EN LA MISMA LLAVE (25/11/2026, WOF: «0 de 10»). En octavos «Masino» (con
// cuenta) y en cuartos «Massino» (sin cuenta): el organizador escribe el nombre a mano en cada ronda. Un lado sin cuenta
// toma la de otro nombre de ESA llave que es casi igual —igual sin letras repetidas, o una letra de diferencia con 5 o
// más—, si hay uno solo así y no está ya en esa batalla
const sinRepetir = (s) => s.replace(/(.)\1+/g, '$1');
function unaLetra(a, b) {
  if (Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 5) return false;
  let i = 0, j = 0, dif = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++dif > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return dif + (a.length - i) + (b.length - j) <= 1;
}
const casiIgual = (a, b) => a.length >= 3 && b.length >= 3 && (sinRepetir(a) === sinRepetir(b) || unaLetra(a, b));

/** Completa los `id` vacíos con el de un nombre casi igual de la misma llave (ver arriba). Devuelve `[[nombre, id]]`. */
export function completarDeLlave(llaves) {
  const hechos = [];
  for (const L of llaves || []) {
    const conId = new Map();   // nombre normalizado → id (sólo si ese nombre tiene un solo id en la llave)
    for (const R of L.rondas || []) for (const b of R.b || []) for (const l of b.lados || []) for (const y of l || []) {
      if (!y || !y.id) continue;
      const n = normVoz(y.n);
      if (n) conId.set(n, conId.has(n) && conId.get(n) !== String(y.id) ? null : String(y.id));
    }
    for (const R of L.rondas || []) for (const b of R.b || []) {
      const enEsta = new Set((b.lados || []).flat().filter((y) => y && y.id).map((y) => String(y.id)));
      for (const l of b.lados || []) for (const y of l || []) {
        if (!y || y.id) continue;
        const n = normVoz(y.n);
        const ids = [...new Set([...conId].filter(([m, id]) => id && m !== n && casiIgual(n, m)).map(([, id]) => id))];
        if (ids.length !== 1 || enEsta.has(ids[0])) continue;
        y.id = ids[0];
        enEsta.add(y.id);
        hechos.push([y.n, y.id]);
      }
    }
  }
  return hechos;
}

/** Completa los `id` vacíos de los lados de `llaves` con las cuentas de `voces` (`Map(id → [nombres])`, de quienes
 *  hablaron). Cambia `llaves` y devuelve `[[nombre de la llave, id]]` de lo que completó. */
export function completarIds(llaves, voces) {
  const hechos = completarDeLlave(llaves);
  if (!voces || !voces.size) return hechos;
  const de = [...voces].map(([id, ns]) => [String(id), [...new Set((ns || []).map(normVoz).filter(Boolean))]]);
  for (const L of llaves || []) {
    // quién es quién ya en esta llave: una cuenta que la llave ya le dio a OTRO nombre no se reusa
    const usada = new Map();
    for (const R of L.rondas || []) for (const b of R.b || []) for (const l of b.lados || []) for (const y of l || []) {
      if (y && y.id) usada.set(String(y.id), normVoz(y.n));
    }
    for (const R of L.rondas || []) for (const b of R.b || []) {
      const enEsta = new Set((b.lados || []).flat().filter((y) => y && y.id).map((y) => String(y.id)));
      for (const l of b.lados || []) for (const y of l || []) {
        if (!y || y.id) continue;
        const n = normVoz(y.n);
        if (n.length < 2) continue;
        const ok = de.filter(([id, ns]) => !enEsta.has(id) && (!usada.has(id) || usada.get(id) === n) && ns.some((x) => parecido(n, x)));
        if (ok.length !== 1) continue;
        y.id = ok[0][0];
        enEsta.add(y.id);
        usada.set(y.id, n);
        hechos.push([y.n, y.id]);
      }
    }
  }
  return hechos;
}

/** Las batallas de `llaves` que `ubicarTodas()` no ubicó, con por qué: `[{r, nombres, por}]` */
export function sinUbicar(llaves, ubicadas, habla) {
  const ya = new Set((ubicadas || []).map((b) => b.llave + '|' + b.r + '|' + b.nombres.join(' vs ')));
  const out = [];
  for (const L of llaves || []) for (const R of L.rondas || []) for (const b of R.b || []) {
    const nombres = (b.lados || []).map((l) => (l || []).map((y) => y.n).filter(Boolean).join(' + '));
    if (ya.has(L.id + '|' + R.r + '|' + nombres.join(' vs '))) continue;
    const sinCuenta = (b.lados || []).flat().filter((y) => y && !y.id).map((y) => y.n);
    const callados = (b.lados || []).flat().filter((y) => y && y.id && !habla.has(String(y.id))).map((y) => y.n);
    const por = sinCuenta.length ? 'no encontré en la llamada a ' + sinCuenta.join(', ')
      : callados.length ? 'no habló en la grabación: ' + callados.join(', ')
        : 'no se los escuchó rapear turnándose (o se pisa con otra)';
    out.push({ r: R.r, nombres, por });
  }
  return out;
}

/** Los segundos de habla de unos tramos (ms), repartidos en baldes de `paso` segundos. */
export function porBalde(tramos, n, paso = PASO_S) {
  const a = new Float64Array(n);
  for (const [d, h] of tramos || []) {
    let x = d / 1000;
    const fin = Math.min(h / 1000, n * paso);
    while (x < fin) {
      const k = Math.floor(x / paso);
      const borde = Math.min(fin, (k + 1) * paso);
      a[k] += borde - x;
      x = borde;
    }
  }
  return a;
}

/**
 * Dónde está una batalla: `lados` es `[[ids], [ids], …]` y `habla` un `Map(id → tramos)`. `{desde, hasta, s}` en
 * segundos de la grabación (`s`: cuánto habló su gente ahí), o `null` si no se puede saber. `lim` (`{desde, hasta}`,
 * segundos) la busca sólo adentro de esa ventana: lo de afuera no cuenta ni como habla ni como «rapeó cerca».
 */
export function ubicar(lados, habla, durS, paso = PASO_S, lim = null) {
  const n = Math.ceil(durS / paso);
  const conocidos = (lados || []).map((l) => (l || []).filter((id) => id && habla.has(id))).filter((l) => l.length);
  if (conocidos.length < 2 || n < 1) return null;
  const kLo = lim ? Math.max(0, Math.ceil((lim.desde || 0) / paso)) : 0;
  const kHi = lim ? Math.min(n, Math.floor((lim.hasta ?? durS) / paso)) : n;
  if (kHi - kLo < 1) return null;
  const porLado = conocidos.map((l) => {
    const a = new Float64Array(n);
    for (const id of l) porBalde(habla.get(id), n, paso).forEach((v, k) => { a[k] += v; });
    return a;
  });
  const pref = porLado.map((a) => {
    const p = new Float64Array(n + 1);
    for (let k = 0; k < n; k++) p[k + 1] = p[k] + a[k];
    return p;
  });
  // ¿rapea en el balde k? `RAP_S` de habla en los `RAP_VENTANA_S` que arrancan ahí; y su suma acumulada, para preguntar
  // «¿rapeó en algún momento de esta vecindad?» sin recorrerla
  const w = Math.max(1, Math.round(RAP_VENTANA_S / paso));
  const rapea = porLado.map((a) => {
    const r = new Float64Array(n + 1);
    for (let k = 0; k < n; k++) r[k + 1] = r[k] + (k >= kLo && k < kHi && rapeaDesde(a, k, w, kHi) ? 1 : 0);
    return r;
  });
  const v = Math.round(VECINDAD_S / paso);
  const activo = new Uint8Array(n);
  for (let k = kLo; k < kHi; k++) {
    let tot = 0;
    for (const a of porLado) tot += a[k];
    if (tot < MIN_BALDE_S) continue;
    const lo = Math.max(kLo, k - v), hi = Math.min(kHi, k + v + 1);
    if (rapea.filter((r) => r[hi] - r[lo] > 0).length >= 2) activo[k] = 1;
  }
  // los tramos activos, juntando huecos cortos; gana el que más se habló
  const j = Math.round(JUNTAR_S / paso);
  let mejor = null, ini = -1, fin = -1;
  const cerrar = () => {
    if (ini < 0) return;
    let s = 0;
    for (const p of pref) s += p[fin + 1] - p[ini];
    if ((fin - ini + 1) * paso >= MIN_LARGO_S && (!mejor || s > mejor.s)) mejor = { ini, fin, s };
  };
  for (let k = 0; k < n; k++) {
    if (!activo[k]) continue;
    if (ini >= 0 && k - fin - 1 <= j) fin = k;
    else { cerrar(); ini = k; fin = k; }
  }
  cerrar();
  if (!mejor) return null;
  return { desde: Math.max(0, mejor.ini * paso - ANTES_S), hasta: Math.min(durS, (mejor.fin + 1) * paso + DESPUES_S),
    s: Math.round(mejor.s * 10) / 10 };
}

// ⚓ LAS ANCLAS DEL EVENTO (25/11/2026, Dlx: «basado en lo que están hablando en la llamada y quiénes, o puedes ver el canal
// de veredictos o resultados, llaves, etc.»). El bot en vivo publica el cruce de cada batalla cuando le toca (`v:<ronda>:<n>`
// de `chat_vivo`) y quién pasó cuando el organizador lo marca en la llave (`b:<ronda>:<n>:…`). El Worker los manda como
// `ancla: {ini, fin}` (ms de reloj) y cada batalla se busca SÓLO adentro de esa ventana: no se puede marcar un ganador
// antes de que termine la batalla (`fin` + lo que tarda el bot), y el cruce sale cerca de que arranque (con margen: a veces
// el organizador marca tarde la anterior). Sin anclas, como siempre: por quién habló cuándo en toda la grabación
export const ANCLA_ANTES_S = 600;
export const ANCLA_DESPUES_S = 150;
//: sin el cruce, la batalla se busca desde esto antes de que se publicara quién pasó
export const ANCLA_SOLO_FIN_S = 1500;

/** La ventana (segundos de la grabación) de una batalla con `ancla`; `aSeg(ms de reloj)` da su segundo en la grabación.
 *  `null` si no hay ancla o la ventana queda más corta que una batalla. */
export function ventanaAncla(ancla, aSeg, durS) {
  if (!ancla || typeof aSeg !== 'function') return null;
  const ini = Number(ancla.ini) || 0, fin = Number(ancla.fin) || 0;
  if (!ini && !fin) return null;
  const desde = Math.max(0, ini ? aSeg(ini) - ANCLA_ANTES_S : aSeg(fin) - ANCLA_SOLO_FIN_S);
  const hasta = Math.min(durS, fin ? aSeg(fin) + ANCLA_DESPUES_S : aSeg(ini) + ANCLA_SOLO_FIN_S);
  return hasta - desde >= MIN_LARGO_S ? { desde, hasta } : null;
}

// 🔁 EL SUPLENTE (25/11/2026, Dlx: «tener cuidado… hay usualmente muchos suplentes que al final reemplazan a los que ya
// estaban en la llave»). La llave dice Bea, pero rapeó Juan: Bea no rapea ahí y la batalla no se encontraba. Adentro de su
// ventana de anclas, si un lado no rapeó ahí y alguien que NO está en esa batalla rapea turnándose con el otro lado, es
// el suplente. Sin ventana no se busca (en toda la noche, cualquiera que rapee con Ana sería «su rival»), y nunca quien
// habla en la mayoría de las batallas del evento: el presentador o un jurado (`fijos`). Y sólo si hay UNO claro
const segEn = (tramos, lim) => (tramos || []).reduce((s, [d, h]) => s + Math.max(0, Math.min(h / 1000, lim.hasta) - Math.max(d / 1000, lim.desde)), 0);
/** ¿Rapea adentro de `lim`? `RAP_S` de habla en alguna ventana de `RAP_VENTANA_S`, o un turno denso (`rapeaDesde()`). */
function rapeaEn(tramos, lim) {
  const n = Math.ceil(lim.hasta / PASO_S);
  const a = porBalde(tramos, n);
  const w = Math.max(1, Math.round(RAP_VENTANA_S / PASO_S));
  for (let k = Math.floor(lim.desde / PASO_S); k + w <= n; k++) if (rapeaDesde(a, k, w, n)) return true;
  return false;
}

// 🎤 EL PRESENTADOR, EN UN EVENTO CORTO (25/11/2026, WOF: 28 min). Las ventanas de las anclas duran de 10 a 25 min, así que
// en una grabación corta cubren casi toda la grabación y TODOS hablaban en el 60 % de ellas: los diez quedaban «fijos» y
// nunca había suplente. Ahora cuentan sólo las ventanas de menos de la mitad de la grabación, y además es fijo quien habla
// en casi todos los minutos de la grabación (`FIJO_MINUTOS`, con 10 min o más): un MC pelea un rato; el presentador, todo
export const FIJO_MINUTOS = 0.7;

/** Quién habla en la mayoría (60 %) de las ventanas con ancla —con 3 o más, de las cortas— o en casi todos los minutos de
 *  la grabación (`durS`): el presentador, los jurados. */
export function fijosDe(ventanas, habla, durS = 0) {
  const out = new Set();
  const cortas = (ventanas || []).filter((v) => !durS || v.hasta - v.desde <= durS / 2);
  if (cortas.length >= 3) {
    for (const [id, tr] of habla) {
      const en = cortas.filter((lim) => segEn(tr, lim) >= 5).length;
      if (en / cortas.length >= 0.6) out.add(id);
    }
  }
  const mins = Math.floor((durS || 0) / 60);
  if (mins >= 10) {
    for (const [id, tr] of habla) {
      let en = 0;
      for (let m = 0; m < mins; m++) if (segEn(tr, { desde: m * 60, hasta: m * 60 + 60 }) >= 5) en++;
      if (en / mins >= FIJO_MINUTOS) out.add(id);
    }
  }
  return out;
}

/** `{lado, id}` del suplente de una batalla (ver arriba), o `null`. `lados` son ids (`''` sin cuenta). */
export function suplente(lados, habla, lim, fijos = new Set()) {
  if (!lim || (lados || []).length < 2) return null;
  // ⚠️ «no rapeó ACÁ», no «no habló nunca»: el suplente suele reemplazar a alguien que ya estaba en la llave y rapeó antes
  const callados = lados.map((l, i) => ((l || []).some((id) => id && habla.has(id) && rapeaEn(habla.get(id), lim)) ? -1 : i))
    .filter((i) => i >= 0);
  if (callados.length !== 1) return null;
  const deEsta = new Set(lados.flat().filter(Boolean));
  const lado = callados[0];
  // con él tiene que armarse la batalla de verdad (turnándose con el otro lado), y gana el que más se turnó —no el que
  // más habló: el presentador habla mucho y entre turnos, pero no pelea—
  const cand = [];
  for (const [id, tr] of habla) {
    if (deEsta.has(id) || fijos.has(id)) continue;
    if (segEn(tr, lim) < 2 * RAP_S || !rapeaEn(tr, lim)) continue;
    const u = ubicar(lados.map((l, i) => (i === lado ? [id] : l)), habla, lim.hasta + 1, PASO_S, lim);
    if (u) cand.push([id, u.s]);
  }
  cand.sort((a, b) => b[1] - a[1]);
  if (!cand.length || (cand[1] && cand[1][1] * 1.5 > cand[0][1])) return null;
  return { lado, id: cand[0][0] };
}

// 🪜 LAS RONDAS VAN EN ORDEN (23/11/2026). En la grabación de FFA del 21/11 (9:47 PM ET) salieron «Octavos · Thaniel vs LRS
// vs Colesito» DESPUÉS de «Cuartos · INHUMAN + Agente sombra vs Colesito + LRS», y dos clips vacíos. `ubicar()` busca cada
// batalla por separado donde rapea su gente, y LRS y Colesito, rivales en octavos y compañeros en cuartos, rapean en las
// dos: si en cuartos rapearon más, los octavos «se encontraban» ahí. Por eso, dentro de una llave, quien pelea una ronda
// más tarde tiene que arrancarla al menos `MIN_LARGO_S` después de la anterior. Cuando dos se contradicen se prueban los
// dos arreglos —la de antes, buscada antes de que arranque la de después; o la de después, buscada después de que
// arrancó la de antes— y gana el que deja más habla de su gente adentro de las dos (`ordenarRondas()`).
const RONDA_NOMBRE = [[/32|treinta/, 0], [/16|dieciseis/, 1], [/octav/, 2], [/cuart/, 3], [/semi/, 4], [/final|tercer|3er/, 5]];

/** El orden de las rondas de una llave: por su nombre si se reconocen todas, si no por cómo vienen en la llave. */
export function ordenRondas(rondas) {
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const porNombre = (rondas || []).map((R) => { const x = RONDA_NOMBRE.find(([re]) => re.test(norm(R.r))); return x ? x[1] : null; });
  return porNombre.every((x) => x !== null) ? porNombre : (rondas || []).map((_, i) => i);
}

/** Corrige `u` de las batallas de una llave (`[{rk, lados, ids, u, lim}]`) para que nadie pelee una ronda antes que la anterior. */
function ordenarRondas(bs, habla, durS) {
  for (let vuelta = 0; vuelta < 30; vuelta++) {
    let cambio = false;
    for (const e of bs) {
      for (const l of bs) {
        if (!e.u || !l.u || l.rk <= e.rk || !l.ids.some((x) => e.ids.includes(x))) continue;
        if (e.u.desde + MIN_LARGO_S <= l.u.desde) continue;
        const lim1 = { desde: e.lim.desde, hasta: Math.min(e.lim.hasta, l.u.desde) };
        const lim2 = { desde: Math.max(l.lim.desde, e.u.desde + MIN_LARGO_S + ANTES_S), hasta: l.lim.hasta };
        const u1 = ubicar(e.lados, habla, durS, PASO_S, lim1);
        const u2 = ubicar(l.lados, habla, durS, PASO_S, lim2);
        if ((u1 ? u1.s : 0) + l.u.s >= e.u.s + (u2 ? u2.s : 0)) { e.u = u1; e.lim = lim1; } else { l.u = u2; l.lim = lim2; }
        cambio = true;
      }
    }
    if (!cambio) break;
  }
}

// ✂️ UN CLIP DE MENOS DE `MIN_CLIP_S` NO SE ENTREGA (23/11/2026): en FFA salieron dos de 0,0 MB. Cuando tres tramos se
// pisaban, el segundo corte de `ubicarTodas()` podía dejar el principio de una batalla después de su final, y `cortar()`
// sacaba un archivo de 1 s. La batalla sigue en la lista, con «sin audio», para que se vea que estaba.
export const MIN_CLIP_S = 20;

/** La línea de la lista de la entrega: «`12:31` Cuartos · Ana vs Bea», y si no lleva audio, por qué. */
export function lineaBatalla(b) {
  // 🔁 con suplente, quién entró por quién (`b.nota`, lo pone index.js con el nombre de la llamada)
  const l = `\`${mmss(b.desde)}\` ${b.r} · ${(b.nombres || []).join(' vs ')}` + (b.nota ? ` · _${b.nota}_` : '');
  if (b.corta) return l + ` · _sin audio: quedó de ${Math.max(0, Math.round(b.hasta - b.desde))} s_`;
  return b.sinAudio ? l + ` · _sin audio: ${b.sinAudio}_` : l;
}

/**
 * Todas las batallas de las llaves (`/avisos/batallas`) que se pueden ubicar, en el orden en que se jugaron:
 * `[{llave, evento, r, nombres, gano, desde, hasta}]`.
 */
export function ubicarTodas(llaves, habla, durS, aSeg = null) {
  const out = [];
  // ⚓ las ventanas de todas las batallas con ancla, para saber quién habla en casi todas (el presentador, los jurados)
  const ventanas = [];
  for (const L of llaves || []) for (const R of L.rondas || []) for (const b of R.b || []) {
    const v = ventanaAncla(b.ancla, aSeg, durS);
    if (v) ventanas.push(v);
  }
  const fijos = fijosDe(ventanas, habla, durS);
  // 🔤 UN LADO SIN CUENTA que el suplente resolvió en una batalla con ancla (Mayeuti, 25/11 en WOF: su nombre de Discord no
  // se parece al de la llave). No se sabe si es esa persona con otra cuenta o un suplente —se sigue diciendo «entró X por
  // Mayeuti»—, pero sí que en ESA llave el nombre «Mayeuti» rapea con esa voz: va también a sus otras batallas, así sale
  // la que no tiene ancla (sus octavos)
  const porVoz = [], deNombre = new Map();
  for (const L of llaves || []) {
    const dado = new Map();
    for (const R of L.rondas || []) for (const b of R.b || []) {
      const v = ventanaAncla(b.ancla, aSeg, durS);
      const ls = (b.lados || []).map((l) => (l || []).map((y) => String((y && y.id) || '')));
      const sup = v ? suplente(ls, habla, v, fijos) : null;
      const lado = sup && (b.lados || [])[sup.lado];
      if (!lado || lado.length !== 1 || lado[0].id) continue;
      const n = normVoz(lado[0].n);
      if (n.length < 2) continue;
      dado.set(n, dado.has(n) && dado.get(n) !== sup.id ? null : sup.id);
    }
    for (const [n, id] of dado) if (id) { deNombre.set(L.id + '|' + n, id); porVoz.push([n, id]); }
  }
  /** El suplente de una batalla por su nombre sin cuenta ya resuelto en la llave (ver arriba), o `null`. */
  const porNombre = (L, b) => {
    const enEsta = new Set((b.lados || []).flat().filter((y) => y && y.id).map((y) => String(y.id)));
    for (const [i, l] of (b.lados || []).entries()) {
      if ((l || []).length !== 1 || l[0].id) continue;
      const id = deNombre.get(L.id + '|' + normVoz(l[0].n));
      if (id && !enEsta.has(id)) return { lado: i, id };
    }
    return null;
  };
  for (const L of llaves || []) {
    const rk = ordenRondas(L.rondas);
    const deLlave = [];
    (L.rondas || []).forEach((R, i) => {
      for (const b of R.b || []) {
        const lados = (b.lados || []).map((l) => (l || []).map((y) => String((y && y.id) || '')).filter(Boolean));
        const v = ventanaAncla(b.ancla, aSeg, durS);
        // 🔁 un lado que no habló, con ancla: ¿rapeó un suplente en su lugar?
        const sup = (v ? suplente((b.lados || []).map((l) => (l || []).map((y) => String((y && y.id) || ''))), habla, v, fijos) : null)
          || porNombre(L, b);
        if (sup) lados[sup.lado] = [sup.id];
        const lim = v || { desde: 0, hasta: durS };
        deLlave.push({ R, b, rk: rk[i], lados, ids: lados.flat(), sup, u: ubicar(lados, habla, durS, PASO_S, v), lim });
      }
    });
    ordenarRondas(deLlave, habla, durS);
    for (const { R, b, lados, ids, u, sup } of deLlave) {
      if (!u) continue;
      const personas = (b.lados || []).map((l) => (l || []).filter((y) => y && y.id).map((y) => ({ n: y.n || '', id: String(y.id) })));
      // 🔁 quien rapeó de verdad: el suplente en lugar del de la llave (su nombre lo pone index.js, que conoce la llamada)
      if (sup) personas[sup.lado] = [{ n: '', id: sup.id, suplente: true }];
      out.push({ llave: L.id, evento: L.nombre || '', r: R.r, gano: b.gano || '', desde: u.desde, hasta: u.hasta, ids,
        lados, nombres: (b.lados || []).map((l) => (l || []).map((y) => y.n).filter(Boolean).join(' + ')),
        // 👥 el nombre de cada uno por separado: en un 2vs2 el short tiene que saber CUÁL de la pareja rapea
        personas, ...(sup ? { suplente: sup } : {}), ...(b.ancla ? { anclada: !!ventanaAncla(b.ancla, aSeg, durS) } : {}) });
    }
  }
  out.sort((a, b) => a.desde - b.desde);
  // dos que se pisan (un MC que pelea dos seguidas): el corte, donde habló por última vez el rival de la primera
  const tramos = (ids) => ids.flatMap((id) => habla.get(id) || []).map(([d, h]) => [d / 1000, h / 1000]);
  for (let i = 1; i < out.length; i++) {
    const a = out[i - 1], b = out[i];
    if (b.desde >= a.hasta) continue;
    const soloA = a.ids.filter((x) => !b.ids.includes(x)), soloB = b.ids.filter((x) => !a.ids.includes(x));
    const iniB = tramos(soloB).filter(([d]) => d >= b.desde).reduce((m, [d]) => Math.min(m, d), b.hasta);
    const finA = tramos(soloA).filter(([d]) => d < iniB).reduce((m, [, h]) => Math.max(m, h), -1);
    let corte = finA >= 0 ? finA + 2 : (b.desde + Math.min(a.hasta, b.hasta)) / 2;
    corte = Math.max(a.desde, b.desde, Math.min(corte, a.hasta));
    a.hasta = corte;
    b.desde = corte;
  }
  for (const b of out) {
    b.hasta = Math.max(b.hasta, b.desde);
    b.corta = b.hasta - b.desde < MIN_CLIP_S;
  }
  out.porVoz = porVoz;
  return out;
}

// 🎭 EL GUION DE UNA BATALLA (22/11/2026; Dlx, viendo el short de siluetas: «hay que detectar quiénes realmente se están
// enfrentando y están rapeando, para que el bot sepa quién es quién… cuándo mover las siluetas o si es el público»).
// Una vez ubicada la batalla, cada voz de la llamada es una de tres cosas:
//   · un TURNO: uno de los MCs de esa batalla rapeando seguido (`TURNO_MIN_S` o más, con huecos de respirar de hasta
//     `TURNO_HUECO_S`). Es el foco: su silueta se mueve y su carta brilla;
//   · el RIVAL que contesta, se ríe o dice «uff» en el turno del otro: está en `voz` pero no es turno, así que no le roba
//     el foco al que rapea;
//   · alguien que NO pelea: si son ráfagas cortas (`REACCION_MAX_S` o menos) es el PÚBLICO reaccionando, y las ráfagas a
//     menos de `REACCION_JUNTAR_S` de la primera son una sola reacción, con cuántas personas fueron; si habla largo es el
//     presentador (`otros`), que no mueve a nadie.
// Todo en segundos desde el principio del clip de la batalla, con una décima.
export const TURNO_HUECO_S = 2.5;
export const TURNO_MIN_S = 6;
export const TURNO_LLENO = 0.4;
export const REACCION_MAX_S = 4;
export const REACCION_JUNTAR_S = 1.5;

const decima = (x) => Math.round(x * 10) / 10;

/** Los tramos `[ms, ms]` dentro de [desde, hasta] (segundos), pasados a segundos desde `desde`. */
function recortar(tramos, desde, hasta) {
  return (tramos || []).map(([a, b]) => [Math.max(a / 1000, desde), Math.min(b / 1000, hasta)])
    .filter(([a, b]) => b > a).map(([a, b]) => [a - desde, b - desde]);
}

/** Junta los tramos que están a `hueco` segundos o menos. Cada uno lleva cuánto tiene de voz de verdad (`[a, b, voz]`). */
function unir(tramos, hueco) {
  const out = [];
  for (const [a, b] of [...tramos].sort((x, y) => x[0] - y[0])) {
    const u = out[out.length - 1];
    if (u && a - u[1] <= hueco) { u[1] = Math.max(u[1], b); u[2] += b - a; } else out.push([a, b, b - a]);
  }
  return out;
}

/**
 * Quién es quién en una batalla de `ubicarTodas()`: `{dur, lados: [{n, ids}], voz, turnos: [{lado, i, f}],
 * publico: [{t, n}], otros}`. `habla` es el `Map(id → tramos)` de toda la grabación (sólo personas: los bots no entran).
 */
export function guion(b, habla) {
  const desde = b.desde, hasta = b.hasta;
  const lados = (b.lados || []).map((l) => (l || []).map(String));
  const enBatalla = new Set(lados.flat());
  const voz = lados.map((ids) => unir(ids.flatMap((id) => recortar(habla.get(id), desde, hasta)), 0.3).map(([a, z]) => [a, z]));
  // los turnos de cada lado, y si dos se pisan (uno arranca antes de que el otro termine), el foco pasa al que arranca
  let turnos = [];
  voz.forEach((tr, lado) => {
    for (const [a, z, v] of unir(tr, TURNO_HUECO_S)) if (z - a >= TURNO_MIN_S && v / (z - a) >= TURNO_LLENO) turnos.push({ lado, i: a, f: z });
  });
  turnos.sort((x, y) => x.i - y.i);
  for (let k = 1; k < turnos.length; k++) if (turnos[k].i < turnos[k - 1].f) turnos[k - 1].f = turnos[k].i;
  turnos = turnos.filter((t) => t.f - t.i >= 1);
  // los que no pelean: ráfagas cortas = público; largo = presentador
  const rafagas = [];
  const otros = [];
  for (const [id, tr] of habla) {
    if (enBatalla.has(String(id))) continue;
    for (const [a, z] of unir(recortar(tr, desde, hasta), 1.0)) {
      if (z - a <= REACCION_MAX_S) rafagas.push([a, id]);
      else otros.push([a, z]);
    }
  }
  rafagas.sort((x, y) => x[0] - y[0]);
  const publico = [];
  for (const [t, id] of rafagas) {
    const u = publico[publico.length - 1];
    if (u && t - u.t <= REACCION_JUNTAR_S) u.quien.add(id); else publico.push({ t, quien: new Set([id]) });
  }
  // 👥 en un equipo, cada uno por separado: su voz, y en cada turno quién de la pareja habló más (el que brilla en el short)
  const vozDe = (id) => unir(recortar(habla.get(id), desde, hasta), 0.3).map(([a, z]) => [a, z]);
  const personas = lados.map((ids, k) => ids.map((id) => ({
    id, n: (((b.personas || [])[k] || []).find((p) => p.id === id) || {}).n || '', voz: vozDe(id) })));
  const cubre = (tr, a, z) => tr.reduce((s, [x, y]) => s + Math.max(0, Math.min(y, z) - Math.max(x, a)), 0);
  return {
    v: 2, dur: decima(hasta - desde),
    lados: lados.map((ids, k) => ({ n: (b.nombres || [])[k] || '', ids })),
    personas: personas.map((ps) => ps.map((p) => ({ id: p.id, n: p.n, voz: p.voz.map(([a, z]) => [decima(a), decima(z)]) }))),
    voz: voz.map((tr) => tr.map(([a, z]) => [decima(a), decima(z)])),
    turnos: turnos.map((t) => {
      const ps = personas[t.lado] || [];
      let quien = 0, mejor = -1;
      ps.forEach((p, j) => { const c = cubre(p.voz, t.i, t.f); if (c > mejor) { mejor = c; quien = j; } });
      return { lado: t.lado, quien, i: decima(t.i), f: decima(t.f) };
    }),
    publico: publico.map((p) => ({ t: decima(p.t), n: p.quien.size })),
    otros: otros.sort((x, y) => x[0] - y[0]).map(([a, z]) => [decima(a), decima(z)]),
  };
}

/** Una línea para el log: quién tuvo cuántos turnos, cuántas reacciones y cuánto habló el presentador. */
export function resumenGuion(g) {
  const t = g.lados.map((l, k) => `${l.n || '?'} ${g.turnos.filter((x) => x.lado === k).length}`).join(' · ');
  const pres = Math.round(g.otros.reduce((s, [a, z]) => s + z - a, 0));
  return `turnos ${t} · ${g.publico.length} reacciones del público` + (pres ? ` · presentador ${pres} s` : '');
}

/** «1:02:05» o «12:31». */
export function mmss(s) {
  const t = Math.max(0, Math.round(s));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), x = t % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(x).padStart(2, '0');
}

/** El nombre del archivo de un clip: «cuartos-ana-vs-bea.ogg», sin tildes ni símbolos. */
export function nombreClip(b) {
  const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return (slug(b.r) + '-' + (b.nombres || []).map(slug).filter(Boolean).join('-vs-')).slice(0, 90).replace(/-+$/, '') + '.ogg';
}
