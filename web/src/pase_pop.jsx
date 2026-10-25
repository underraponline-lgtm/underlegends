// 🎉 «¡SUBISTE!» (Dlx, 25/10/2026: «podría ser como un pop up incluso en la página principal en vez de notificación con
// una animación»). Al volver después de subir de nivel —en el Pase o en el Inicio— sale una vez con lo que ganaste
// desde la última vez que lo viste: el nivel de antes y el de ahora, y los premios entran de a uno. Con «Menos
// animaciones» (`.app.calma`) o el sistema en reducido, aparece quieto.
//
// ⚠️ LO QUE YA VISTE SE GUARDA EN EL NAVEGADOR (`lg:pase-visto`: temporada y nivel). La primera vez sólo se anota: decir
// «subiste del 0 al 6» a quien ya iba en el 6 sería mentir. Y nunca otra notificación: la campana ya tiene la suya.
import { useEffect, useState } from 'react';
import { num } from './liga.js';
import { PaseIcono, premioCorto } from './pase_iconos.jsx';

const leer = () => { try { return JSON.parse(localStorage.getItem('lg:pase-visto') || 'null'); } catch (e) { return null; } };
const guardar = (v) => { try { localStorage.setItem('lg:pase-visto', JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };

/** Lo ganado entre el nivel `de` (sin contar) y `a`: los premios con algo y la suma de los Puntos de Tienda */
export function ganado(P, de, a) {
  const libres = (P.premios || []).filter((p) => p[0] > de && p[0] <= a);
  const prem = P.premium ? (P.fila_premium || []).filter((p) => p[0] > de && p[0] <= a) : [];
  const tienda = libres.reduce((s, p) => s + (p[1] || 0), 0) + prem.reduce((s, p) => s + (p[1] || 0), 0);
  const cosas = libres.filter((p) => p[2]).map((p) => ({ p, prem: false }))
    .concat(prem.filter((p) => p[2]).map((p) => ({ p, prem: true })));
  return { tienda, cosas };
}

export function PopPase({ P, onVer }) {
  const [abierto, setAbierto] = useState(null);
  useEffect(() => {
    if (!P || !P.listo || !P.miembro) return;
    const v = leer();
    if (!v || v.temp !== P.temp) { guardar({ temp: P.temp, n: P.nivel }); return; }
    if (P.nivel > v.n) setAbierto({ de: v.n, a: P.nivel });
    else if (P.nivel < v.n) guardar({ temp: P.temp, n: P.nivel });
  }, [P && P.temp, P && P.nivel, P && P.miembro]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!abierto) return null;
  const cerrar = () => { guardar({ temp: P.temp, n: abierto.a }); setAbierto(null); };
  const g = ganado(P, abierto.de, abierto.a);
  const mas = abierto.a - abierto.de;
  const lista = g.cosas.slice(0, 4);
  return (
    <div className="ps-velo" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) cerrar(); }}>
      <div className="ps-pop" role="dialog" aria-modal="true" aria-labelledby="ps-pop-t">
        <span className="ps-pop-tag">PASE DE RAPERO</span>
        <b className="ps-pop-n" aria-hidden="true"><i>{abierto.de}</i>→<i>{abierto.a}</i></b>
        <h2 id="ps-pop-t">¡Subiste al nivel {abierto.a}!</h2>
        <p>{mas === 1 ? 'Desde la última vez que entraste: un nivel más.' : 'Desde la última vez que entraste: ' + mas + ' niveles más.'}</p>
        <ol className="ps-pop-l">
          {lista.map(({ p, prem }, i) => (
            <li key={(prem ? 'p' : 'g') + p[0]} style={{ '--d': (0.35 + 0.2 * i) + 's' }} className={prem ? 'prem' : ''}>
              <PaseIcono p={p} prem={prem} t={34} />
              <b>{premioCorto(p, prem, true)}</b><small>{prem ? 'PREMIUM · ' : ''}nivel {p[0]}</small>
            </li>
          ))}
          {g.tienda ? (
            <li style={{ '--d': (0.35 + 0.2 * lista.length) + 's' }}>
              <PaseIcono p={[0, g.tienda, '', '']} t={34} />
              <b>+{num(g.tienda)} Puntos de Tienda</b><small>{mas === 1 ? 'nivel ' + abierto.a : 'niveles ' + (abierto.de + 1) + ' al ' + abierto.a}</small>
            </li>
          ) : null}
        </ol>
        {onVer ? <button type="button" className="btn verde ps-ancho" onClick={() => { cerrar(); onVer(); }}>Ver mi Pase</button>
          : <a className="btn verde ps-ancho" href="#/pase" onClick={cerrar}>Ver mi Pase</a>}
        <button type="button" className="ps-pop-x" onClick={cerrar}>Cerrar</button>
      </div>
    </div>
  );
}
