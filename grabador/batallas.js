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
 * Dónde está una batalla: `lados` es `[[ids], [ids], …]` y `habla` un `Map(id → tramos)`. `{desde, hasta}` en segundos
 * de la grabación, o `null` si no se puede saber.
 */
export function ubicar(lados, habla, durS, paso = PASO_S) {
  const n = Math.ceil(durS / paso);
  const conocidos = (lados || []).map((l) => (l || []).filter((id) => id && habla.has(id))).filter((l) => l.length);
  if (conocidos.length < 2 || n < 1) return null;
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
  const rapea = pref.map((p) => {
    const r = new Float64Array(n + 1);
    for (let k = 0; k < n; k++) r[k + 1] = r[k] + (p[Math.min(n, k + w)] - p[k] >= RAP_S ? 1 : 0);
    return r;
  });
  const v = Math.round(VECINDAD_S / paso);
  const activo = new Uint8Array(n);
  for (let k = 0; k < n; k++) {
    let tot = 0;
    for (const a of porLado) tot += a[k];
    if (tot < MIN_BALDE_S) continue;
    const lo = Math.max(0, k - v), hi = Math.min(n, k + v + 1);
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
  return { desde: Math.max(0, mejor.ini * paso - ANTES_S), hasta: Math.min(durS, (mejor.fin + 1) * paso + DESPUES_S) };
}

/**
 * Todas las batallas de las llaves (`/avisos/batallas`) que se pueden ubicar, en el orden en que se jugaron:
 * `[{llave, evento, r, nombres, gano, desde, hasta}]`.
 */
export function ubicarTodas(llaves, habla, durS) {
  const out = [];
  for (const L of llaves || []) {
    for (const R of L.rondas || []) {
      for (const b of R.b || []) {
        const lados = (b.lados || []).map((l) => (l || []).map((y) => String((y && y.id) || '')).filter(Boolean));
        const u = ubicar(lados, habla, durS);
        if (!u) continue;
        out.push({ llave: L.id, evento: L.nombre || '', r: R.r, gano: b.gano || '', desde: u.desde, hasta: u.hasta, ids: lados.flat(),
          nombres: (b.lados || []).map((l) => (l || []).map((y) => y.n).filter(Boolean).join(' + ')) });
      }
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
    corte = Math.max(b.desde, Math.min(corte, a.hasta));
    a.hasta = corte;
    b.desde = corte;
  }
  return out;
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
