// 🖤 EL FONDO PROPIO DETRÁS DE UNA FILA DE GENTE (25/11/2026, Dlx: «que por default sea el negro y que sólo los que tengan
// algo», y a dónde más ponerlo: «Todas»). La misma regla que la fila del Ranking (`fondoPropio()` de fondos.js): lo que esa
// persona eligió a propósito en Tus fondos → «Tu ficha» (su bandera o su servidor) o su imagen; si no tiene nada suyo, no
// se dibuja nada y la fila queda como siempre. Va DENTRO de la fila, como primer hijo: la fila se vuelve su caja sola
// (`.fp-capa` en vivo.css, con `:where(:has(>.fp-capa))`, sin peso: la posición que ya tenga la fila manda)
import { fondoPropio, useFondos } from './fondos.js';

export function FondoPropio({ liga, k }) {
  const fondos = useFondos();
  if (!k || !liga) return null;
  const f = (liga.T && liga.T[k]) || (liga.X && liga.X[k]) || {};
  const bg = fondoPropio((fondos || {})[k], 'fila', { cc: f.cc, sv: f.sv });
  return bg ? <span className="fp-capa" style={{ backgroundImage: bg }} aria-hidden="true" /> : null;
}
