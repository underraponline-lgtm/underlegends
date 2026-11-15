// 🎟️ LA PISTA COMO ESCENARIO DE PREMIOS (15/11/2026). Dlx, a las tres formas de la maqueta: «Escenario, pero intenta
// mejorarlo un poco más, quizás los iconos, y también que algunos sean animados, ¿y cómo se vería el premium?», y a la v2,
// «Sí, todo». Reemplaza a la pista grande de la 4.05 (pase_pista.jsx).
//   · lo que sigue va al medio, grande y arriba de una tarima dorada, con tres chispas; lo ganado se aleja a la izquierda
//   · tres vistas: Gratis (el premio premium del nivel, chico en su pestaña), Premium (las fichas en su material, con
//     candado si no lo tienes) y Las dos (cada ficha con su «piso» premium)
//   · los premios son objetos (pase_objetos.jsx); se mueven lo que sigue y, siempre, el drop, la caja y el brillo
//   · la búsqueda de arriba («busca un premio») lleva el escenario al primer nivel que lo da
import { useEffect, useMemo, useState } from 'react';
import { num } from './liga.js';
import { premioCorto, premioLargo } from './pase_iconos.jsx';
import { Objeto, SIEMPRE_ANIMA, objetoDe } from './pase_objetos.jsx';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const CAND = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="1" /><path d="M8 10.5V7a4 4 0 018 0v3.5" /></svg>;

/** El primer nivel cuyo premio (gratis o premium) dice `q`, o el número si `q` lo es */
export function nivelQueDa(q, libres, prem) {
  const t = norm(q).trim();
  if (!t) return 0;
  if (/^\d+$/.test(t)) return Math.max(1, Math.min(libres.length, Number(t)));
  const dice = (p, pr) => norm(premioLargo(p, pr) + ' ' + premioCorto(p, pr) + ' ' + objetoDe(p)).includes(t);
  const g = libres.find((p) => p[2] && dice(p)), pp = prem.find((p) => p[2] && dice(p, true));
  if (g && pp) return Math.min(g[0], pp[0]);
  return (g || pp || [0])[0] || (/punto|tienda/.test(t) ? 2 : 0);
}

export function Escenario({ libres, prem, nivel, tiene, falta, compu, q }) {
  const N = libres.length || 50;
  const [c, setC] = useState(() => Math.max(1, Math.min(N, (nivel || 0) + 1)));
  const [fila, setFila] = useState('dos');
  useEffect(() => { setC(Math.max(1, Math.min(N, (nivel || 0) + 1))); }, [nivel, N]);
  useEffect(() => { const n = nivelQueDa(q, libres, prem); if (n) setC(n); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  const premDe = useMemo(() => { const m = {}; for (const p of prem) m[p[0]] = p; return m; }, [prem]);
  const lado = compu ? 3 : 1;
  const desde = Math.max(1, Math.min(c - lado, N - 2 * lado)), hasta = Math.min(N, desde + 2 * lado);
  const vista = fila === 'premium' ? 'premium' : fila;
  const ir = (n) => setC(Math.max(1, Math.min(N, n)));
  const fichas = [];
  for (let n = desde; n <= hasta; n++) {
    const d = Math.abs(n - c), g = libres[n - 1] || [n, 150, '', ''], pr = premDe[n] || null;
    const esPr = vista === 'premium' && pr;
    const p = esPr ? pr : g;
    const lock = !!(esPr && !tiene);
    const ya = n <= nivel && !lock;
    const k = objetoDe(p);
    const an = !lock && (d === 0 || SIEMPRE_ANIMA.has(k));
    const t = [compu ? 124 : 104, 82, 64, 52][Math.min(d, 3)];
    fichas.push(
      <button key={n} type="button" className={'pe-f d' + Math.min(d, 3) + (esPr ? ' pr' : '') + (ya ? ' ya' : '') + (d === 0 ? ' centro' : '')}
        onClick={() => ir(n)} aria-label={'Nivel ' + n + ': ' + premioLargo(p, !!esPr) + (ya ? ', lo tienes' : '')} aria-current={d === 0 ? 'true' : undefined}>
        <span className="pe-n">{n}</span>
        {esPr ? <><i className="pe-esq a" /><i className="pe-esq b" /><i className="pe-esq c" /><i className="pe-esq e" /></> : null}
        {vista === 'gratis' && pr && pr[2] ? <span className="pe-tab"><Objeto p={pr} t={24} gris={!tiene} /><i>PREMIUM</i></span> : null}
        <span className="pe-obj">
          {d === 0 && !lock ? <><i className="pe-ch" /><i className="pe-ch b" /><i className="pe-ch c" /></> : null}
          <Objeto p={p} t={t} an={an} gris={lock} />
          {lock ? <span className="pe-cand">{CAND}</span> : null}
        </span>
        <b>{p[2] ? premioCorto(p, !!esPr) : '+' + num(p[1] || 150)}</b>
        <small>{p[2] ? premioLargo(p, !!esPr) : 'Puntos de Tienda'}</small>
        {vista === 'dos' && pr && d < 3 ? (
          <span className="pe-piso"><Objeto p={pr} t={30} gris={!tiene} /><b>{pr[2] ? premioCorto(pr, true) : '+' + num(pr[1] || 150)}</b></span>
        ) : null}
        {ya ? <span className="pe-ok">Lo tienes</span> : null}
        {n === nivel + 1 && falta ? <span className="pe-ok sig">Faltan {num(falta)} XP</span> : null}
      </button>,
    );
  }
  const g = libres[c - 1] || [c, 150, '', ''], pr = premDe[c];
  return (
    <section className="pe" data-tuto="ps-pista" id="ps-premios" aria-label="Los niveles del Pase">
      <div className="pe-cab">
        <h2>Los {N} niveles</h2>
        <span className="pe-seg" role="group" aria-label="Qué fila ver">
          {[['dos', 'Las dos'], ['gratis', 'Gratis'], ['premium', 'Premium']].map(([k, t]) => (
            <button key={k} type="button" className={fila === k ? 'on' : ''} aria-pressed={fila === k} onClick={() => setFila(k)}>{t}</button>
          ))}
        </span>
        <span className="pe-flechas">
          <button type="button" onClick={() => ir(c - 1)} disabled={c <= 1} aria-label="Nivel anterior">‹</button>
          <button type="button" onClick={() => ir(c + 1)} disabled={c >= N} aria-label="Nivel siguiente">›</button>
        </span>
      </div>
      <div className="pe-esc" onKeyDown={(e) => { if (e.key === 'ArrowLeft') ir(c - 1); if (e.key === 'ArrowRight') ir(c + 1); }}>
        <span className="pe-tarima" aria-hidden="true" />
        {fichas}
      </div>
      <p className="pe-det" aria-live="polite">
        <b>Nivel {c}</b>
        <span>Gratis: {g[2] ? premioLargo(g) : num(g[1] || 150) + ' Puntos de Tienda'}{pr ? <> · Premium: {pr[2] ? premioLargo(pr, true) : num(pr[1] || 150) + ' Puntos de Tienda'}{tiene ? '' : ' (con candado)'}</> : null}.</span>
        <em>{c <= nivel ? 'Lo tienes' : c === nivel + 1 ? 'Es el que sigue' : 'Te faltan ' + (c - nivel) + ' niveles'}</em>
      </p>
    </section>
  );
}
