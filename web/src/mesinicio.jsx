// 🔔 LA FRANJA DE LOS MES AWARDS EN EL INICIO (Dlx, 17/11/2026, a «¿dónde más se recuerda votar?»: «A»). Los 4 días de
// votación, arriba de los cuatro paneles, la misma franja blanca del Salón (`Franja` de mesvoto.jsx) con tu servidor
// —cuántas votaste, cuándo cierra y el Cajón de discos por votarlas todas— y el botón al Salón. Sin un servidor tuyo con
// votación (sin cuenta, o el tuyo no tiene MES AWARDS), dice en cuántos servidores se vota.
// ⚡ La carga `Lobby` con `lazy()` y sólo cuando hay una encuesta de servidor abierta (`hayMesAbierto()`): el resto del mes
// el Inicio no baja ni este archivo ni `/api/salon`.
import { useSalon } from './mesawards.jsx';
import { COFRE, Franja, cssVoto } from './mesvoto.jsx';
import { svElegido, useElegidos } from './elegidos.js';

export default function FranjaMesInicio({ liga, enc }) {
  cssVoto();
  const S = useSalon();
  const el = useElegidos();
  const ab = S && S.abierto;
  if (!ab || !ab.votando) return null;
  const abiertos = Object.keys(ab.sv || {});
  if (!abiertos.length) return null;
  const yo = liga.yo;
  const p = yo ? svElegido(liga, el, yo.k) || yo.sv : '';
  const sv = p && abiertos.includes(p) ? p : '';
  return (
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
  );
}
