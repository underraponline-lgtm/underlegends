// 🏆 LAS COMPETENCIAS (26/10/2026): las ligas por niveles con la Élite en paralelo, la Copa por grupos, las Rapid de la
// semana, los mini eventos que rotan, el equipo de la semana y la ficha de cada jurado. Las arma `bot/competencias.py` y
// las sube `bot/subir_web.py` aparte del lobby (`/api/competencias`, la KV `web:competencias`). Las piden la página de
// Competencias, la sección del Inicio y la ficha de jurado del perfil: un solo pedido por minuto, compartido.
// Cada cruce es `[a, b, ganador, cómo ('real'|'sim'|'pend'), prob de a, extra]`: `extra` es el evento si fue real o el
// jurado sorteado si fue simulado (`[[jurado, 'a'|'b']]`).
import { useEffect, useState } from 'react';

let pedido = null, cuando = 0, dato = null;
export function pedirCompetencias() {
  if (pedido && Date.now() - cuando < 60000) return pedido;
  cuando = Date.now();
  pedido = fetch('/api/competencias', { headers: { accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((x) => { if (!x) pedido = null; else dato = x; return x; });
  return pedido;
}

export function useCompetencias() {
  const [c, setC] = useState(dato);
  useEffect(() => { let vivo = true; pedirCompetencias().then((x) => { if (vivo && x) setC(x); }); return () => { vivo = false; }; }, []);
  return c;
}

export const DIVISIONES = ['Primera', 'Segunda', 'Tercera', 'Cuarta', 'Quinta', 'Sexta'];
export const NIVELES = [['oro', 'Oro', '#F5C542'], ['plata', 'Plata', '#C9CDD4'], ['bronce', 'Bronce', '#C77B4A'], ['ascenso', 'Ascenso', '#E2E2DE']];
export const NIVEL = Object.fromEntries(NIVELES.map(([id, n, c]) => [id, { n, c }]));

/** El nombre de una clave: la tabla de la Liga, si no, el que trae la competencia */
export function nombreDe(liga, C, k) {
  const f = liga && ((liga.T && liga.T[k]) || (liga.X && liga.X[k]));
  return (f && f.n) || (C && C.n && C.n[k]) || k;
}

/** El nombre de una liga: «Plata 2», o «Oro» si es la única de su nivel */
export function nombreLiga(C, g) {
  if (!g) return '';
  if (g.id === 'elite') return 'Élite';
  const n = ((C.ligas && C.ligas.g) || []).filter((x) => x.nv === g.nv).length;
  return (NIVEL[g.nv] || {}).n + (n > 1 ? ' ' + g.id.split('-')[1] : '');
}

/** Las ligas como una sola lista, la Élite primero (con `id: 'elite'`) */
export function todasLasLigas(C) {
  const L = (C && C.ligas) || {};
  return (L.e ? [{ id: 'elite', nv: 'elite', t: L.e.t, j: L.e.j }] : []).concat(L.g || []);
}

/** Las últimas `n` de `k` en una liga: `['G'|'P', …]`, de la más vieja a la más nueva */
export function ultimas(g, k, n = 5) {
  const out = [];
  for (const j of g.j || []) for (const m of j.p) if ((m[0] === k || m[1] === k) && m[2]) out.push(m[2] === k ? 'G' : 'P');
  return out.slice(-n);
}

/** El cruce de `k` en la jornada `n` de una liga: `{m, rival, p}` o null */
export function cruceDe(g, n, k) {
  const j = (g.j || []).find((x) => x.n === n);
  const m = j && j.p.find((x) => x[0] === k || x[1] === k);
  if (!m) return null;
  return { m, rival: m[0] === k ? m[1] : m[0], p: m[0] === k ? m[4] : 1 - m[4] };
}

/** «hasta el miércoles» / «en 8 h» hasta un instante */
export function faltaTxt(iso, ahora = Date.now()) {
  const ms = new Date(iso).getTime() - ahora;
  if (!(ms > 0)) return 'cerrado';
  const h = Math.floor(ms / 3600000);
  if (h < 1) return Math.max(1, Math.round(ms / 60000)) + ' min';
  if (h < 48) return h + ' h ' + String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
  return Math.round(h / 24) + ' días';
}

/** «19 al 26 de octubre», en la hora del este */
export function semanaTxt(C) {
  const f = (iso, mes) => new Date(iso).toLocaleDateString('es', { timeZone: 'America/New_York', day: 'numeric', ...(mes ? { month: 'long' } : {}) });
  try { return f(C.ini, false) + ' al ' + f(C.fin, true); } catch (e) { return ''; }
}

/**
 * Dónde estás tú: `{liga: {g, pos, n, cruce}, elite: {…}, copa: {g, pos, n, falta}, rapid: {r, ronda, fuera, campeon}, prox}`
 * o null. `prox` es tu próximo cruce por jugar (el de la liga primero), para el panel de arriba.
 */
export function dondeEstoy(C, k) {
  if (!C || !k) return null;
  const out = {};
  const L = C.ligas || {};
  for (const g of todasLasLigas(C)) {
    const i = (g.t || []).findIndex((x) => x[0] === k);
    if (i < 0) continue;
    out[g.id === 'elite' ? 'elite' : 'liga'] = { g, pos: i + 1, n: g.t.length, cruce: cruceDe(g, L.jornada, k) };
  }
  for (const g of C.copa || []) {
    const i = g.t.findIndex((x) => x[0] === k);
    if (i >= 0) {
      out.copa = { g, pos: i + 1, n: g.t.length, falta: g.p.filter((m) => (m[0] === k || m[1] === k) && !m[2]).length };
      break;
    }
  }
  for (const r of C.rapid || []) {
    if (!(r.r[0] || { p: [] }).p.some((m) => m[0] === k || m[1] === k)) continue;
    let ronda = null, fuera = false;
    for (const rd of r.r) {
      const m = rd.p.find((x) => x[0] === k || x[1] === k);
      if (!m) { fuera = true; break; }
      if (m[2] && m[2] !== k) { fuera = true; ronda = rd; break; }
      ronda = rd;
      if (!m[2]) break;
    }
    out.rapid = { r, ronda, fuera, campeon: r.campeon === k };
    break;
  }
  const pend = [];
  if (out.liga && out.liga.cruce && !out.liga.cruce.m[2]) pend.push(['Liga ' + nombreLiga(C, out.liga.g) + ' · jornada ' + L.jornada, out.liga.cruce]);
  if (out.elite && out.elite.cruce && !out.elite.cruce.m[2]) pend.push(['Élite · jornada ' + L.jornada, out.elite.cruce]);
  if (out.copa) {
    const m = out.copa.g.p.find((x) => (x[0] === k || x[1] === k) && !x[2]);
    if (m) pend.push(['Copa · grupo ' + out.copa.g.id, { m, rival: m[0] === k ? m[1] : m[0], p: m[0] === k ? m[4] : 1 - m[4] }]);
  }
  if (out.rapid && out.rapid.ronda && !out.rapid.fuera) {
    const m = out.rapid.ronda.p.find((x) => (x[0] === k || x[1] === k) && !x[2] && x[0] && x[1]);
    if (m) pend.push(['Rapid · ' + out.rapid.ronda.r, { m, rival: m[0] === k ? m[1] : m[0], p: m[0] === k ? m[4] : 1 - m[4] }]);
  }
  out.prox = pend[0] || null;
  return out.liga || out.elite || out.copa || out.rapid ? out : null;
}
