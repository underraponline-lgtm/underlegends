// 🔔 LA FRANJA DE LOS MES AWARDS EN EL INICIO (Dlx, 17/11/2026, a «¿dónde más se recuerda votar?»: «A»). Los 4 días de
// votación, arriba de los cuatro paneles, la misma franja blanca del Salón (`Franja` de mesvoto.jsx) con tu servidor
// —cuántas votaste, cuándo cierra y el Cajón de discos por votarlas todas— y el botón al Salón. Sin un servidor tuyo con
// votación (sin cuenta, o el tuyo no tiene MES AWARDS), dice en cuántos servidores se vota.
// 🏆 Y LA GALA DE LA TEMPORADA (17/11/2026): mientras se vota, su franja va primero —«La gala de la T1 · votaste n de 4» y
// el Flight case por las 4 principales— y la de tu servidor debajo, si también se vota (la gala y los de diciembre se
// votan los mismos días).
// ⚡ La carga `Lobby` con `lazy()` y sólo cuando hay una encuesta de servidor o de la gala abierta (`hayMesAbierto()`): el
// resto del mes el Inicio no baja ni este archivo ni `/api/salon`.
import { useSalon } from './mesawards.jsx';
import { COFRE, Franja, FranjaGala, cssVoto } from './mesvoto.jsx';
import { svElegido, useElegidos } from './elegidos.js';

export default function FranjaMesInicio({ liga, enc }) {
  cssVoto();
  const S = useSalon();
  const el = useElegidos();
  if (!S) return null;
  const g = S.gala;
  const gala = !!(g && g.votando && !g.cerrado && g.cats);
  const ab = S.abierto && S.abierto.votando ? S.abierto : null;
  const abiertos = ab ? Object.keys(ab.sv || {}) : [];
  if (!gala && !abiertos.length) return null;
  const yo = liga.yo;
  const p = yo ? svElegido(liga, el, yo.k) || yo.sv : '';
  const sv = p && abiertos.includes(p) ? p : '';
  return (
    <>
      {gala ? (
        <a className="sd-ini" href="#/salon" aria-label={'La gala de la ' + g.temp + ': ir a votar'}>
          <FranjaGala liga={liga} enc={enc} S={S} modo="vota" />
          <span className="sd-ini-ir">Votar →</span>
        </a>
      ) : null}
      {abiertos.length ? (
        <a className="sd-ini" href="#/salon" aria-label={'MES AWARDS de ' + ab.nombre + ': ir a votar'}>
          {sv ? <Franja liga={liga} enc={enc} S={S} sv={sv} modo="vota" /> : (
            <div className="sd-franja">
              <div className="sd-fr-tx"><b>Se votan los MES AWARDS de {ab.nombre}</b>
                <small>En {abiertos.length} {abiertos.length === 1 ? 'servidor' : 'servidores'} · votar las de tu servidor da un {COFRE}</small></div>
              <span className="sd-fr-sp" />
            </div>
          )}
          <span className="sd-ini-ir">Votar →</span>
        </a>
      ) : null}
    </>
  );
}
