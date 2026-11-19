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
//
// 🎤 DESDE LA 6.87 ESTE ARCHIVO SON LAS PIEZAS: la casilla, la búsqueda y el detalle. La pista la arma LA GIRA
// (pase_gira.jsx), de a diez niveles y entera en la compu; la que se deslizaba con los cincuenta se fue (Dlx: «En pc no se
// puede scrollear… hay cosas q no se pueden ver»)
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
export function Casilla({ p, n, pr, sig, ya, lock, sel, onSel }) {
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

// ── 📝 el detalle del nivel elegido, debajo de la pista ──
export function Detalle({ sel, libres, premDe, nivel, tiene }) {
  const g = libres[sel - 1] || [sel, 150, '', ''], pr = premDe[sel];
  return (
    <p className="p2-det" aria-live="polite">
      <b>Nivel {sel}</b>
      <span>Gratis: {g[2] ? premioLargo(g) : num(g[1] || 150) + ' Puntos de Tienda'}{pr ? <> · Premium: {pr[2] ? premioLargo(pr, true) : num(pr[1] || 150) + ' Puntos de Tienda'}{tiene ? '' : ' (con candado)'}</> : null}.</span>
      <em>{sel <= nivel ? 'Lo tienes' : sel === nivel + 1 ? 'Es el que sigue' : 'Te faltan ' + (sel - nivel) + ' niveles'}</em>
    </p>
  );
}
export const premiosDe = (prem) => { const m = {}; for (const p of prem) m[p[0]] = p; return m; };
