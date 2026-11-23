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
  const rapea = pref.map((p) => {
    const r = new Float64Array(n + 1);
    for (let k = 0; k < n; k++) r[k + 1] = r[k] + (k >= kLo && k < kHi && p[Math.min(kHi, k + w)] - p[k] >= RAP_S ? 1 : 0);
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
  const l = `\`${mmss(b.desde)}\` ${b.r} · ${(b.nombres || []).join(' vs ')}`;
  if (b.corta) return l + ` · _sin audio: quedó de ${Math.max(0, Math.round(b.hasta - b.desde))} s_`;
  return b.sinAudio ? l + ` · _sin audio: ${b.sinAudio}_` : l;
}

/**
 * Todas las batallas de las llaves (`/avisos/batallas`) que se pueden ubicar, en el orden en que se jugaron:
 * `[{llave, evento, r, nombres, gano, desde, hasta}]`.
 */
export function ubicarTodas(llaves, habla, durS) {
  const out = [];
  for (const L of llaves || []) {
    const rk = ordenRondas(L.rondas);
    const deLlave = [];
    (L.rondas || []).forEach((R, i) => {
      for (const b of R.b || []) {
        const lados = (b.lados || []).map((l) => (l || []).map((y) => String((y && y.id) || '')).filter(Boolean));
        deLlave.push({ R, b, rk: rk[i], lados, ids: lados.flat(), u: ubicar(lados, habla, durS), lim: { desde: 0, hasta: durS } });
      }
    });
    ordenarRondas(deLlave, habla, durS);
    for (const { R, b, lados, ids, u } of deLlave) {
      if (!u) continue;
      out.push({ llave: L.id, evento: L.nombre || '', r: R.r, gano: b.gano || '', desde: u.desde, hasta: u.hasta, ids,
        lados, nombres: (b.lados || []).map((l) => (l || []).map((y) => y.n).filter(Boolean).join(' + ')) });
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
  return {
    v: 1, dur: decima(hasta - desde),
    lados: lados.map((ids, k) => ({ n: (b.nombres || [])[k] || '', ids })),
    voz: voz.map((tr) => tr.map(([a, z]) => [decima(a), decima(z)])),
    turnos: turnos.map((t) => ({ lado: t.lado, i: decima(t.i), f: decima(t.f) })),
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
