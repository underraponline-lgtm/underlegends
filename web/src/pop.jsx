// 🪟 LA CABECERA DE LOS POP-UPS DEL PANEL (12/11/2026, Dlx: «haz que los pop ups tengan un mejor diseño»). Una sola para
// los cuatro (Estadísticas, Misiones y Most Wanted, Tus próximas batallas, Dragón Drops): el ícono con el color de cada
// uno (`--pc` en el `dialog`), el título, una línea de qué es y el botón de cerrar. Vive aparte para que panel.jsx y
// drops.jsx la usen sin importarse entre ellos
import { Ico } from './piezas.jsx';

export function PopCab({ ico, t, sub, cerrar }) {
  return (
    <div className="pn-pop-cab pop-cab">
      <span className="pop-ic" aria-hidden="true"><Ico n={ico} t={20} /></span>
      <span className="pop-tt"><b>{t}</b>{sub ? <small>{sub}</small> : null}</span>
      <button type="button" className="pop-x" aria-label="Cerrar" onClick={cerrar}><Ico n="cerrar" t={18} /></button>
    </div>
  );
}
