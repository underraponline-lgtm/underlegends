// 🎟️ LA PISTA DOBLE (15/11/2026). Dlx, al escenario de la 5.42: «para el track del pase necesitaríamos un segundo track
// para el premium también, así como lo teníamos antes», «más animaciones, más como esencia», y a la maqueta (vuelta 4 del
// lienzo del Pase), «Sí, constrúyela». Reemplaza al escenario (pase_escenario.jsx):
//   · DOS FILAS, como el Brawl Pass: Gratis arriba, Premium abajo y la barra de XP en el medio, con un rombo por nivel
//     y tu cara donde vas. Se desliza de costado con los 50 niveles; al abrir, centra el que sigue
//   · del escenario se queda EL FOCO: el que sigue lleva una franja dorada, chispas y «Faltan N XP»
//   · sin Premium la fila de abajo se ve entera, gris y con candado (que tiembla al pasar); con Premium, los premios
//     grandes llevan un reflejo que los cruza
//   · los premios son las pegatinas de pase_objetos.jsx: se mueven el que sigue y, siempre, el drop, la caja y el brillo
//   · la búsqueda de arriba («busca un premio») lleva la pista al primer nivel que lo da
import { useEffect, useRef, useState } from 'react';
import { num } from './liga.js';
import { premioCorto, premioLargo } from './pase_iconos.jsx';
import { Objeto, SIEMPRE_ANIMA, objetoDe } from './pase_objetos.jsx';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const CAND = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="1" /><path d="M8 10.5V7a4 4 0 018 0v3.5" /></svg>;

/** El primer nivel cuyo premio (gratis o premium) dice `q`, o el número si `q` lo es */
export function nivelQueDa(q, libres, prem) {
  const t = norm(q).trim();
  if (!t) return 0;
  // 🔢 «nivel 25» también, que es el ejemplo del propio buscador (18/11/2026): sólo se leía el número suelto, y «nivel 25»
  // se buscaba como texto en los premios, que nunca dicen «nivel»: la pista no se movía
  const m = /^(?:nivel|niv|n)?\s*(\d+)$/.exec(t);
  if (m) return Math.max(1, Math.min(libres.length || 50, Number(m[1])));
  const dice = (p, pr) => norm(premioLargo(p, pr) + ' ' + premioCorto(p, pr) + ' ' + objetoDe(p)).includes(t);
  const g = libres.find((p) => p[2] && dice(p)), pp = prem.find((p) => p[2] && dice(p, true));
  if (g && pp) return Math.min(g[0], pp[0]);
  return (g || pp || [0])[0] || (/punto|tienda/.test(t) ? 2 : 0);
}

/** Una casilla: la pegatina, qué es y, si ya la tienes, su ✓ */
function Casilla({ p, n, pr, sig, ya, lock, sel, onSel }) {
  const k = objetoDe(p);
  const hito = !!p[2];
  const an = !lock && (sig || SIEMPRE_ANIMA.has(k));
  return (
    <button type="button" className={'p2-t' + (pr ? ' pr' : '') + (hito ? ' hito' : '') + (pr && hito && !lock ? ' p2-brilla' : '') + (sel ? ' sel' : '')}
      onClick={onSel} aria-label={'Nivel ' + n + (pr ? ', premium' : ', gratis') + ': ' + (p[2] ? premioLargo(p, pr) : num(p[1] || 150) + ' Puntos de Tienda') + (ya ? ', lo tienes' : lock ? ', con candado' : '')}>
      {pr ? <><i className="p2-ce a" /><i className="p2-ce b" /></> : null}
      {sig && !lock ? <><i className="pe-ch" /><i className="pe-ch b" /></> : null}
      <span className="p2-obj">
        <Objeto p={p} t={hito ? 58 : 38} an={an} gris={lock} />
        {lock ? <span className="p2-cand">{CAND}</span> : null}
      </span>
      <b>{p[2] ? premioCorto(p, pr) : '+' + num(p[1] || 150)}</b>
      <small>{!p[2] ? 'Puntos de Tienda' : p[2] === 'titulo' ? '«' + p[3] + '»' : ['insignia', 'marco', 'emblema', 'reaccion'].includes(p[2]) && p[3] ? p[3] : '+' + num(p[1] || 150)}</small>
      {ya ? <span className="p2-ok" aria-hidden="true">✓</span> : null}
    </button>
  );
}

// `miembro`: sin ser de DRA (o sin cuenta) no hay «TÚ» ni «Ir a mi nivel»: caía en el nivel 1 (revisión del 16/11)
export function PistaDoble({ libres, prem, nivel, tiene, falta, frac, q, miembro = true }) {
  const N = libres.length || 50;
  const sigN = Math.min(N, (nivel || 0) + 1);
  const [sel, setSel] = useState(sigN);
  const caja = useRef(null);
  const premDe = {};
  for (const p of prem) premDe[p[0]] = p;
  // ⬅️➡️ llevar un nivel a la vista (al medio)
  const centrar = (n, suave) => {
    const c = caja.current;
    if (!c) return;
    const col = c.querySelector('[data-n="' + n + '"]');
    if (!col) return;
    const x = col.offsetLeft - (c.clientWidth - col.offsetWidth) / 2;
    try { c.scrollTo({ left: Math.max(0, x), behavior: suave ? 'smooth' : 'auto' }); } catch (e) { c.scrollLeft = Math.max(0, x); }
  };
  useEffect(() => { setSel(sigN); const t = setTimeout(() => centrar(sigN, false), 60); return () => clearTimeout(t); }, [sigN]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const n = nivelQueDa(q, libres, prem);
    if (n) { setSel(n); centrar(n, true); }
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  const mover = (d) => {
    const c = caja.current;
    if (!c) return;
    try { c.scrollBy({ left: d * Math.max(240, c.clientWidth * 0.6), behavior: 'smooth' }); } catch (e) { c.scrollLeft += d * 300; }
  };
  const elegir = (n) => { const m = Math.max(1, Math.min(N, n)); setSel(m); centrar(m, true); };
  const cols = [];
  for (let n = 1; n <= N; n++) {
    const g = libres[n - 1] || [n, 150, '', ''];
    const pr = premDe[n] || [n, 150, '', ''];
    const ya = n <= nivel;
    const sig = miembro && n === nivel + 1 && n <= N;
    const relleno = ya ? 100 : sig ? Math.round(100 * Math.max(0, Math.min(1, frac || 0))) : 0;
    // 🏷️ `p2-sig` y no `sig` (18/11/2026): `.sig` es una regla global de estilo.css (`margin:14px 0 0`, otra letra y
    // otro color), y bajaba 14 px la columna del que sigue y 28 su rombo. Sus reglas, en css/pase.css como `.p2-sig`
    cols.push(
      <div key={n} className={'p2-col' + (sig ? ' p2-sig' : '') + (n === sel ? ' es' : '')} data-n={n}>
        {sig && falta > 0 ? <span className="p2-falta">Faltan {num(falta)} XP</span> : null}
        <Casilla p={g} n={n} sig={sig} ya={ya} sel={n === sel} onSel={() => setSel(n)} />
        <span className="p2-riel" aria-hidden="true">
          <i className="p2-base" /><i className="p2-lleno" style={{ width: relleno + '%' }} />
          <b className={'p2-nodo' + (ya ? ' ya' : sig ? ' p2-sig' : '')}><i>{n}</i></b>
          {sig ? <span className="p2-tu" style={{ left: Math.max(8, Math.min(92, relleno)) + '%' }}><b>TÚ</b></span> : null}
        </span>
        <Casilla p={pr} n={n} pr sig={sig} ya={ya && tiene} lock={!tiene} sel={n === sel} onSel={() => setSel(n)} />
      </div>,
    );
  }
  const g = libres[sel - 1] || [sel, 150, '', ''], pr = premDe[sel];
  return (
    <section className="p2-pista" data-tuto="ps-pista" id="ps-premios" aria-label="Los niveles del Pase">
      <div className="p2-cab">
        <h2>Los {N} niveles</h2>
        <small>Gratis arriba, Premium abajo</small>
        <span className="p2-flechas">
          {miembro && nivel < N ? <button type="button" className="p2-mio" onClick={() => elegir(sigN)}>Ir a mi nivel</button> : null}
          <button type="button" onClick={() => mover(-1)} aria-label="Niveles anteriores">‹</button>
          <button type="button" onClick={() => mover(1)} aria-label="Niveles siguientes">›</button>
        </span>
      </div>
      <div className="p2-cuerpo">
        <div className="p2-labs" aria-hidden="true">
          <span className="p2-lab g"><b>Gratis</b><small>Los de DRA</small></span>
          <span className="p2-lab x"><b>XP</b></span>
          <span className="p2-lab p"><b>Premium</b><small>{tiene ? '+20 % de XP' : 'Con candado'}</small></span>
        </div>
        <div className="p2-caja" ref={caja} tabIndex={0} aria-label="Desliza para ver los niveles"
          onKeyDown={(e) => { if (e.key === 'ArrowLeft') { e.preventDefault(); elegir(sel - 1); } if (e.key === 'ArrowRight') { e.preventDefault(); elegir(sel + 1); } }}>
          <div className="p2-fila">{cols}</div>
        </div>
      </div>
      <p className="p2-det" aria-live="polite">
        <b>Nivel {sel}</b>
        <span>Gratis: {g[2] ? premioLargo(g) : num(g[1] || 150) + ' Puntos de Tienda'}{pr ? <> · Premium: {pr[2] ? premioLargo(pr, true) : num(pr[1] || 150) + ' Puntos de Tienda'}{tiene ? '' : ' (con candado)'}</> : null}.</span>
        <em>{sel <= nivel ? 'Lo tienes' : sel === nivel + 1 ? 'Es el que sigue' : 'Te faltan ' + (sel - nivel) + ' niveles'}</em>
      </p>
    </section>
  );
}
