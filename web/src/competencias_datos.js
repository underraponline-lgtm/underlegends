// 🏆 LAS COMPETENCIAS DE LA SEMANA (26/10/2026): la Copa por grupos, la Liga de 10 y la Rapid del día, que arma
// `bot/competencias.py` y sube `bot/subir_web.py` aparte del lobby (`/api/competencias`, la KV `web:competencias`). Las
// piden la página de Competencias y la tira del Inicio: un solo pedido por minuto, compartido
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

/** El nombre de una clave: la tabla de la Liga, si no, el que trae la competencia */
export function nombreDe(liga, C, k) {
  const f = liga && liga.T && liga.T[k];
  return (f && f.n) || (C && C.n && C.n[k]) || k;
}

/** «19 al 26 de octubre», en la hora del este */
export function semanaTxt(C) {
  const f = (iso, mes) => new Date(iso).toLocaleDateString('es', { timeZone: 'America/New_York', day: 'numeric', ...(mes ? { month: 'long' } : {}) });
  try { return f(C.ini, false) + ' al ' + f(C.fin, true); } catch (e) { return ''; }
}

/** Dónde estás tú: `{copa: {g, pos, n, falta}, liga: {pos, rival, p}, rapid: bool}`, o null */
export function dondeEstoy(C, k) {
  if (!C || !k) return null;
  const out = {};
  for (const g of C.copa || []) {
    const i = g.t.findIndex((x) => x[0] === k);
    if (i >= 0) {
      out.copa = { g, pos: i + 1, n: g.t.length, falta: g.p.filter((m) => (m[0] === k || m[1] === k) && !m[2]).length };
      break;
    }
  }
  const lt = (C.liga && C.liga.t) || [];
  const li = lt.findIndex((x) => x[0] === k);
  if (li >= 0) {
    const j = (C.liga.j || [])[(C.liga.j || []).length - 1];
    const m = j && j.p.find((x) => x[0] === k || x[1] === k);
    out.liga = { pos: li + 1, rival: m ? (m[0] === k ? m[1] : m[0]) : '', p: m ? (m[0] === k ? m[4] : 1 - m[4]) : 0, g: m ? m[2] : '' };
  }
  out.rapid = !!(C.rapid && (C.rapid.r || []).some((r) => r.p.some((m) => m[0] === k || m[1] === k)));
  return out.copa || out.liga || out.rapid ? out : null;
}
