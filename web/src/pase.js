// 🎟️ EL PASE DE RAPERO (05/10/2026: Dlx, «sólo para DRA», «con TAREAS», «como Brawl Stars»; a la propuesta, «3. A»). La
// cuenta la hace el servidor (`paseDe()`, `paseVivo()` y `pases()` en bot/avisos.js; las reglas y los números, en
// bot/pase.py): acá sólo se pide y se muestra.
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
/**
 * Lo público del Pase, cinco minutos en memoria: `{n: {clave: [nivel, título, color]}, cfg: {temp, niveles, tareas,
 * premios}}`. Por clave de perfil, nunca por cuenta
 */
export function usePases() {
  const [n, setN] = useState(pases);
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

/** El nivel, el título y el color del Pase de un perfil, para su nombre; `null` si no tiene */
export function usePaseDe(k) {
  const pub = usePases();
  const x = pub && pub.n && pub.n[k];
  return x ? { nivel: x[0], titulo: x[1] || '', color: x[2] || '' } : null;
}

const vistas = new Set();
/**
 * «Miré una llave en vivo», una vez por llave y por visita. Lo llama la llave después de un rato abierta: tocarla y
 * volver no es mirarla. Si sumó una Tarea, se vuelve a pedir tu Pase.
 */
export function vioVivo(id) {
  const k = String(id || '');
  if (!/^[A-Za-z0-9:_-]{1,60}$/.test(k) || vistas.has(k)) return;
  vistas.add(k);
  fetch('/api/avisos/pase-vivo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ llave: k }) })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { if (d && d.nuevas) pedirPase(); })
    .catch(() => { vistas.delete(k); });
}

const TIPO = { insignia: 'Insignia', titulo: 'Título', color: 'Color de nombre' };

/** Lo que da un nivel, en palabras cortas: «+200» o «+500 · Insignia Pase Bronce» */
export function premioTexto(p, largo) {
  if (!p) return '';
  const extra = p[2] === 'color' ? 'tu nombre en dorado' : p[2] ? TIPO[p[2]] + ' ' + (p[2] === 'titulo' ? '«' + p[3] + '»' : p[3]) : '';
  if (!largo) return extra || '+' + num(p[1]);
  return '+' + num(p[1]) + ' Puntos de Tienda' + (extra ? ' y ' + (p[2] === 'color' ? extra : extra.charAt(0).toLowerCase() + extra.slice(1)) : '');
}

/** La próxima recompensa con algo más que Tienda, desde el nivel `n` */
export function proximoEspecial(premios, n) {
  return (premios || []).find((p) => p[0] > n && p[2]) || null;
}
