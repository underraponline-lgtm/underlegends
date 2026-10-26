// 🎟️ EL PASE DE RAPERO (05/10/2026: Dlx, «sólo para DRA», «con TAREAS», «como Brawl Stars»; a la propuesta, «3. A»; con
// XP desde el 06/10). La cuenta la hace el servidor (`paseDe()`, `paseVivo()` y `pases()` en bot/avisos.js; las reglas y
// los números, en bot/pase.py): acá sólo se pide y se muestra.
//
// ⚠️ PEDIR TU PASE YA REVISA TUS TAREAS: va con tu sesión y el objeto anota lo que cumpliste. Por eso la página del
// Pase lo vuelve a pedir al abrirse, y el resto usa lo que ya llegó.
import { useEffect, useState } from 'react';
import { num } from './liga.js';

const W = typeof window !== 'undefined' ? window : {};

let pidiendo = null;
/** Tu Pase (`W.PASE`), o `null` si no entraste. Avisa `lg:pase` cuando llega */
export function pedirPase() {
  if (pidiendo) return pidiendo;
  pidiendo = fetch('/api/avisos/pase', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    // ⚠️ un 401 es la sesión vencida, no un error del Pase: la página pide entrar de nuevo en vez de «probá en un rato»
    .then((r) => (r.ok ? r.json() : r.status === 401 ? { sinSesion: true } : null))
    .catch(() => null)
    .then((d) => {
      W.PASE = d && (typeof d.listo === 'boolean' || d.sinSesion) ? d : null;
      pidiendo = null;
      try { W.dispatchEvent(new Event('lg:pase')); } catch (e) { /* sin aviso */ }
      return W.PASE;
    });
  return pidiendo;
}

/**
 * Tu Pase, si `activo` (entraste con Discord): `undefined` mientras llega, `null` si no se pudo. Con `fresco`, lo vuelve
 * a pedir al montarse (la página del Pase)
 */
export function usePase(activo, fresco) {
  const [d, setD] = useState(() => W.PASE);
  useEffect(() => {
    if (!activo) return undefined;
    const f = () => setD(W.PASE);
    const otra = () => { pedirPase(); };
    W.addEventListener('lg:pase', f);
    W.addEventListener('lg:cuenta', otra);
    if (fresco || W.PASE === undefined) pedirPase(); else f();
    return () => { W.removeEventListener('lg:pase', f); W.removeEventListener('lg:cuenta', otra); };
  }, [activo, fresco]);
  return activo ? d : null;
}

let pases = null, pasesT = 0, pasesP = null;
/** 🃏 la carta principal que eligió ese perfil, si ya llegaron los datos del Pase (`cp`), o '' */
export function cartaPrincipalDe(k) { return (pases && pases.cp && pases.cp[k]) || ''; }
/** ⚡ cuándo se redibujó a pedido (`vr`), para la URL de sus cartas, o 0 */
export function versionRedibujo(k) { return (pases && pases.vr && pases.vr[k]) || 0; }
/**
 * Lo público del Pase, cinco minutos en memoria: `{n: {clave: [nivel, título, color]}, cfg: {temp, niveles, umbrales,
 * cola, diarias, por_dia, semanales, temporada, premios}, salon: {temporada: [[clave, ms], …]}}`. Por clave de perfil,
 * nunca por cuenta
 */
export function usePases() {
  const [n, setN] = useState(pases);
  // 🖼️ cuando alguien cambia su marco, la página lo vuelve a pedir y avisa (`refrescarPases()`)
  useEffect(() => {
    const f = () => setN(pases);
    W.addEventListener('lg:pases', f);
    return () => W.removeEventListener('lg:pases', f);
  }, []);
  useEffect(() => {
    if (pases && Date.now() - pasesT < 300000) return undefined;
    let vivo = true;
    pasesP = pasesP || fetch('/api/avisos/pases').then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((d) => { pasesP = null; if (d && d.n) { pases = d; pasesT = Date.now(); } return pases; });
    pasesP.then((x) => { if (vivo) setN(x); });
    return () => { vivo = false; };
  }, []);
  return n;
}

/** Vuelve a pedir lo público del Pase ya mismo (después de elegir un marco) y avisa `lg:pases` */
export function refrescarPases() {
  pasesT = 0;
  // 🔴 SIN LA COPIA DE 5 MINUTOS (26/10/2026): `/avisos/pases` sale con caché de 300 s, así que después de guardar un marco
  // esto traía la lista vieja y la carta «se revertía» aunque el cambio estaba guardado (Dlx: «me mostró el preview, lo
  // cambié pero no cambió en la página… dijo que los cambios fueron guardados»)
  return fetch('/api/avisos/pases?r=' + Date.now(), { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    .then((d) => { if (d && d.n) { pases = d; pasesT = Date.now(); } try { W.dispatchEvent(new Event('lg:pases')); } catch (e) { /* nada */ } return pases; });
}

/** El nivel, el título y el color del Pase de un perfil, para su nombre; `null` si no tiene */
export function usePaseDe(k) {
  const pub = usePases();
  const x = pub && pub.n && pub.n[k];
  // 💎 desde el 25/10/2026, si tiene el premium: el cuarto (1) y el marco de su carta, el quinto
  return x ? { nivel: x[0], titulo: x[1] || '', color: x[2] || '', premium: !!x[3], marco: x[4] || '' } : null;
}

/** POST a una ruta del Pase con tu sesión: lo que contesta, o `null` */
export function pasePost(ruta, cuerpo) {
  return fetch('/api/avisos/' + ruta, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo || {}) })
    .then((r) => r.json().catch(() => null).then((d) => (d ? Object.assign({ _ok: r.ok }, d) : null)))
    .catch(() => null);
}

/**
 * ×2 💎 Por cuánto se multiplica lo que cumplas ahora: la semana de XP doble (`doble`) y el +`boost`% del premium.
 * `{x, doble}`: `doble` es la ventana activa (`[ini, fin, m]`) o `null`
 */
export function multAhora(P, ahora = Date.now()) {
  if (!P) return { x: 1, doble: null };
  const d = (P.doble || []).find((w) => ahora >= w[0] && ahora < w[1]) || null;
  const pr = P.premium && (P.premium.hasta == null || ahora < P.premium.hasta) ? 1 + (P.boost || 0) / 100 : 1;
  return { x: (d ? d[2] : 1) * pr, doble: d };
}

const vistas = new Set();
/**
 * «Miré una llave en vivo», una vez por llave y por visita. Lo llama la llave después de un rato abierta: tocarla y
 * volver no es mirarla. Si sumó una Tarea, se vuelve a pedir tu Pase.
 */
// 🎟️ devuelve lo que contestó el servidor (`{cuenta, nuevas}`) para que la llave diga si contó (Dlx, 07/10/2026: «ya lo
// hice pero no recibo nada»): sin eso, mirar una llave terminada y una que se juega se veían igual
export function vioVivo(id) {
  const k = String(id || '');
  if (!/^[A-Za-z0-9:_-]{1,60}$/.test(k) || vistas.has(k)) return Promise.resolve(null);
  vistas.add(k);
  return fetch('/api/avisos/pase-vivo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ llave: k }) })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { if (d && d.nuevas) pedirPase(); return d; })
    .catch(() => { vistas.delete(k); return null; });
}

/** La Tarea de mirar una llave en vivo que todavía no cumpliste (de hoy o de la semana), o `null`. Sólo con tu Pase ya
 * traído: no lo pide */
export function vivoPendiente() {
  const P = W.PASE;
  if (!P || !P.miembro) return null;
  const xs = [].concat((P.hoy && P.hoy.tareas) || [], (P.semana && P.semana.tareas) || []);
  return xs.find((t) => /^vivo/.test(String(t.id || '')) && !t.hecha) || null;
}

const TIPO = { tarjeta: 'Tu tarjeta de', insignia: 'Insignia', titulo: 'Título', color: 'Color de nombre', llave: '' };

/** Lo que da un nivel, en palabras cortas: «+200» o «+500 · Insignia Pase Bronce» */
export function premioTexto(p, largo) {
  if (!p) return '';
  const extra = p[2] === 'color' ? 'tu nombre en dorado' : p[2] === 'llave' ? 'tu carta brilla en las llaves'
    : p[2] ? TIPO[p[2]] + ' ' + (p[2] === 'titulo' ? '«' + p[3] + '»' : p[3]) : '';
  if (!largo) return extra || '+' + num(p[1]);
  return '+' + num(p[1]) + ' Puntos de Tienda' + (extra ? ' y ' + (p[2] === 'color' || p[2] === 'llave' ? extra : extra.charAt(0).toLowerCase() + extra.slice(1)) : '');
}

/**
 * Cuánto llevás del nivel que estás haciendo: `{lleva, de, falta}` en XP, o `null` si ya completaste el Pase (o no
 * llegó la cuenta)
 */
export function avance(P) {
  if (!P || P.hasta == null || !(P.hasta > (P.desde || 0))) return null;
  const de = P.hasta - (P.desde || 0);
  const lleva = Math.max(0, Math.min(de, (P.xp || 0) - (P.desde || 0)));
  return { lleva, de, falta: de - lleva };
}

/** La próxima recompensa con algo más que Tienda, desde el nivel `n` */
export function proximoEspecial(premios, n) {
  return (premios || []).find((p) => p[0] > n && p[2]) || null;
}
