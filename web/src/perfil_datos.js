// 🧮 LO QUE EL PERFIL CALCULA DE SUS DATOS, SIN DIBUJAR NADA (20/11/2026, la tanda 2 de los comandos del bot).
// Vivía adentro de perfil_v10.jsx; salió acá para que la imagen de `/perfil` y `/vitrina` (og_img.jsx) lo use TAL CUAL sin
// bajar la página entera del perfil. Es la regla de «un default que no es la decisión»: el récord, la forma, la mejor
// noche y el ELO de la imagen salen de la misma cuenta que los de la página, y si uno cambia, cambian los dos.
import { diaISO, limpio } from './liga.js';

export const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const fecha = (t) => {
  if (!t) return 'sin fecha';
  const [, m, d] = diaISO(new Date(t)).split('-');
  return Number(d) + ' ' + MES[Number(m) - 1];
};
export const sinB = (s) => limpio(String(s || '').replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '')).trim();
export const ini = (n) => (String(n || '').replace(/[^\p{L}\p{N}]/gu, '').charAt(0) || '?').toUpperCase();
export const PU = { Campeón: ['CAMPEÓN', 'c', 7], Subcampeón: ['FINAL', 's', 6], Tercero: ['PODIO', 't', 5], Cuarto: ['SEMIS', 't', 4],
  Semifinal: ['SEMIS', 't', 4], Cuartos: ['CUARTOS', '', 3], Octavos: ['OCTAVOS', '', 2] };
export const pu = (p) => PU[p] || [String(p || '').toUpperCase(), '', 1];
export const CORTO = { Campeón: 'C', Subcampeón: 'F', Tercero: 'SF', Cuarto: 'SF', Semifinal: 'SF', Cuartos: '4°', Octavos: '8°' };
export const sinTit = (e) => /^\(?\s*sin t[ií]tulo\s*\)?$/i.test(String(e.nom || '').trim());
export const nomEv = (e) => (sinTit(e) ? e.sv + ' · ' + fecha(e.t) : e.nom);

/** Los datos del perfil, de una vez: sus eventos (`evs`, y los que tienen fecha en orden, `enT`), sus duelos, sus rivales,
 *  el récord, la mejor noche, los títulos, el de al lado en la tabla y su mejor victoria. `e` es el mapa de eventos de
 *  /api/perfiles. Es lo que era `useV10()` de perfil_v10.jsx, sin el `useMemo` */
// 📅 EL DÍA DEL EVENTO Y NO EL DE CUANDO SE PROCESÓ (revisión 22/11/2026). En `/api/perfiles`, `x[2]` es la hora en que se
// cargó el resultado (la #435 dice «2026-10-09T04:01:38Z», pasada la medianoche) y `x[4]` el día del evento en hora del
// este («08/10»): con `x[2]`, el perfil de Dlx decía «Debutó 9 oct» y el Inicio, de la llave, «jue 8 oct». Al mediodía
// UTC, para que el día no cambie en ninguna zona de la Liga
const diaEv = (x) => {
  const t = x[2] ? Date.parse(x[2]) : 0;
  const m = /^(\d{1,2})\/(\d{1,2})$/.exec(String(x[4] || ''));
  if (!t || !m) return t;
  const pr = new Date(t);
  // un evento de diciembre cargado en enero es del año anterior
  const y = pr.getUTCFullYear() - (Number(m[2]) > pr.getUTCMonth() + 1 ? 1 : 0);
  return Date.UTC(y, Number(m[2]) - 1, Number(m[1]), 12);
};
export function datosV10(liga, k, f, p, e) {
  const E = e || {};
  const evs = ((p && p.ev) || []).map(([n, puesto, pts]) => {
    const x = E[n] || E[String(n)] || [];
    return { n, pu: puesto, pts: pts || 0, nom: limpio(x[0] || 'Evento ' + n), sv: x[1] || '', t: diaEv(x), gente: x[3] || 0 };
  });
  const enT = evs.filter((x) => x.t).sort((a, b) => a.t - b.t);
  const du = (p && p.du) || [];
  const porEv = {};
  du.forEach(([n, r, w]) => { const x = porEv[n] || (porEv[n] = { gano: [], cayo: '' }); if (w) x.gano.push(r); else x.cayo = r; });
  const riv = new Map();
  du.forEach(([n, r, w]) => {
    const q = liga.quien(r);
    const id = q ? q.k : 'n:' + sinB(r).toLowerCase();
    if (!riv.has(id)) riv.set(id, { id, k: q ? q.k : '', n: q ? q.n : r, g: 0, p: 0, ult: 0 });
    const x = riv.get(id);
    if (w) x.g += 1; else x.p += 1;
    const ev = E[n] || E[String(n)];
    if (ev && ev[2]) x.ult = Math.max(x.ult, diaEv(ev));
  });
  const rivs = [...riv.values()].sort((a, b) => (b.g + b.p) - (a.g + a.p) || b.ult - a.ult);
  const g = du.filter((d) => d[2]).length;
  const mejor = enT.slice().sort((a, b) => pu(b.pu)[2] - pu(a.pu)[2] || b.pts - a.pts || b.gente - a.gente)[0] || null;
  const cuenta = (x) => evs.filter((y) => y.pu === x).length;
  // el de al lado en la tabla: el de adelante, o —si es el #1— el que lo persigue
  const filas = Object.values(liga.T || {}).filter((x) => x && x.pos);
  const pos = Number(f && f.pos) || 0;
  const ad = pos > 1 ? filas.find((x) => Number(x.pos) === pos - 1) : null;
  const at = pos ? filas.find((x) => Number(x.pos) === pos + 1) : null;
  const cercano = ad ? { f: ad, arriba: true } : at ? { f: at, arriba: false } : null;
  // su mejor victoria: el de mejor puesto de la Temporada al que le ganó un duelo
  let mejorVic = null;
  du.forEach(([n, r, w]) => {
    if (!w) return;
    const q = liga.quien(r);
    if (!q || !q.pos || q.k === k) return;
    if (!mejorVic || Number(q.pos) < Number(mejorVic.f.pos)) mejorVic = { f: q, n };
  });
  if (mejorVic) { const x = E[mejorVic.n] || E[String(mejorVic.n)] || []; mejorVic.ev = limpio(x[0] || ''); mejorVic.sv = x[1] || ''; }
  return { evs, enT, du, porEv, rivs, g, perd: du.length - g, mejor, oro: cuenta('Campeón'), seg: cuenta('Subcampeón'), ter: cuenta('Tercero'), cercano, mejorVic };
}

// 💎 SU ELO Y SU PIEDRA (la tabla de divisiones del lobby, como la lee divisiones.jsx: `[nombre, ELO, batallas, …]`)
export function eloDe(liga, k) {
  const V = liga.d && liga.d.div;
  if (!V || V.m !== 'elo' || !Array.isArray(V.d)) return null;
  const SUBS = ['I', 'II', 'III'];
  for (let di = 0; di < V.d.length; di++) {
    for (const g of V.d[di] || []) {
      for (let i = 0; i < (g || []).length; i++) {
        const r = g[i];
        const q = r && liga.quien(r[0]);
        if (!q || q.k !== k) continue;
        const t = V.t || [];
        // 🪨 desde la T2 cada piedra mide distinto (`a`, ver divisiones.jsx); en la T1, todas de 50
        const an = (x) => (Array.isArray(V.a) && V.a.length ? V.a[Math.min(x, V.a.length - 1)] : 50);
        const piso = di < t.length ? t[di] : (t[t.length - 1] || 0) - an(t.length);
        const s = Math.max(0, Math.min(2, Math.floor((r[1] - piso) / (an(di) / 3))));
        const prox = s < 2 ? [(V.n || [])[di] + ' ' + SUBS[s + 1], piso + Math.ceil(((s + 1) * an(di)) / 3)] : di > 0 ? [(V.n || [])[di - 1] + ' I', t[di - 1]] : null;
        return { elo: r[1], bat: r[2], piedra: (V.n || [])[di] || '', sub: SUBS[s], c: (V.c || [])[di] || '#8A8F98', pos: i + 1, tot: g.length, prox, prov: r[2] < (V.pv == null ? 5 : V.pv), raw: r[0], et: !!V.et };
      }
    }
  }
  return null;
}
