// 🎟️ LOS ÍCONOS DEL PASE (remake, 25/10/2026). Dlx, a la v2 estilo Brawl Pass: «muy infantil… con el estilo de las
// páginas del remake». Planos, de una tinta, en la grilla de 40, sin contornos gruesos ni brillos: la piel de Tarjetas
// y el Perfil. Los de la fila gratis en verde agua, blanco o dorado; los de la premium, en magenta. Lo usan la página
// del Pase y el pop-up de «¡Subiste!» (pase_pop.jsx), que se baja también con el Inicio: por eso viven aparte.
import { num } from './liga.js';

const MAG = '#E41373';
// el color de cada insignia, por su nombre (`bot/pase.py`: Pase Bronce, Plata y Oro)
const metal = (v) => (/oro/i.test(v) ? '#F5C542' : /plata/i.test(v) ? '#C9CDD4' : '#C98A4B');

const Svg = ({ t, children }) => <svg width={t} height={t} viewBox="0 0 40 40" aria-hidden="true">{children}</svg>;

function Monedas({ t }) {
  return <Svg t={t}><rect x="7" y="22" width="26" height="6" fill="#C99A1E" /><rect x="7" y="15" width="26" height="6" fill="#E7B622" /><rect x="7" y="8" width="26" height="6" fill="#F5C542" /></Svg>;
}
function CartaI({ c, t }) {
  return <Svg t={t}><rect x="10" y="4" width="20" height="32" fill="none" stroke={c} strokeWidth="3" /><rect x="14" y="8" width="12" height="11" fill={c} /><rect x="14" y="23" width="12" height="3" fill={c} /><rect x="14" y="29" width="8" height="2" fill={c} /></Svg>;
}
function Insignia({ c, t }) {
  return <Svg t={t}><path d="M20 3l14 8v18l-14 8-14-8V11z" fill={c} /><path d="M20 12l2.5 5.4 5.8.7-4.3 4 1.1 5.8L20 25l-5.1 2.9 1.1-5.8-4.3-4 5.8-.7z" fill="#030304" /></Svg>;
}
function TituloI({ c, t }) {
  return <Svg t={t}><rect x="3" y="12" width="34" height="16" fill="none" stroke={c} strokeWidth="3" /><rect x="9" y="18" width="22" height="4" fill={c} /></Svg>;
}
function Dorado({ t }) {
  return <Svg t={t}><text x="20" y="28" textAnchor="middle" fontFamily="Archivo, sans-serif" fontWeight="900" fontSize="20" fill="#F5C542">Aa</text></Svg>;
}
function Brilla({ t }) {
  return <Svg t={t}><rect x="9" y="7" width="18" height="28" fill="none" stroke="#29B298" strokeWidth="3" /><path d="M31 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#F5C542" /></Svg>;
}
function Prem({ tipo, t }) {
  if (tipo === 'marco') return <Svg t={t}><rect x="8" y="3" width="24" height="34" fill="none" stroke={MAG} strokeWidth="3" /><rect x="13" y="8" width="14" height="24" fill="none" stroke={MAG} strokeWidth="2" /></Svg>;
  if (tipo === 'reaccion') return <Svg t={t}><path d="M5 7h30v20H17l-8 7v-7H5z" fill="none" stroke={MAG} strokeWidth="3" /><path d="M20 12v10M15 17h10" stroke={MAG} strokeWidth="3" /></Svg>;
  if (tipo === 'fondo') return <Svg t={t}><rect x="4" y="8" width="32" height="24" fill="none" stroke={MAG} strokeWidth="3" /><path d="M8 28l9-10 6 6 4-4 6 8z" fill={MAG} /></Svg>;
  if (tipo === 'color') return <Svg t={t}><rect x="5" y="5" width="13" height="13" fill="#29B298" /><rect x="22" y="5" width="13" height="13" fill={MAG} /><rect x="5" y="22" width="13" height="13" fill="#F5C542" /><rect x="22" y="22" width="13" height="13" fill="#F6F6F6" /></Svg>;
  if (tipo === 'titulo') return <TituloI c={MAG} t={t} />;
  if (tipo === 'emblema') return <Svg t={t}><path d="M20 3l17 17-17 17L3 20z" fill={MAG} /><path d="M20 11l9 9-9 9-9-9z" fill="#030304" /></Svg>;
  if (tipo === 'carta') return <CartaI c={MAG} t={t} />;
  return <Monedas t={t} />;
}

/** El ícono de un premio `[nivel, tienda, tipo, valor]`, de la fila gratis o de la premium */
export function PaseIcono({ p, prem = false, t = 38 }) {
  const [, , tipo, valor] = p;
  if (prem) return <Prem tipo={tipo} t={t} />;
  if (tipo === 'tarjeta') return <CartaI c="#29B298" t={t} />;
  if (tipo === 'insignia') return <Insignia c={metal(valor)} t={t} />;
  if (tipo === 'titulo') return <TituloI c="#F6F6F6" t={t} />;
  if (tipo === 'color') return <Dorado t={t} />;
  if (tipo === 'llave') return <Brilla t={t} />;
  return <Monedas t={t} />;
}

const CORTO = { tarjeta: 'Tu carta', insignia: 'Insignia', titulo: 'Título', color: 'Dorado', llave: 'Brilla' };
const CORTO_P = { marco: 'Marco', reaccion: 'Reacción', fondo: 'Fondo', color: 'Color', titulo: 'Título', emblema: 'Emblema', carta: 'Carta' };

/** Lo que da un premio: corto («Insignia») o largo («Insignia Pase Bronce»). Sin nada más que Tienda, «+150» */
export function premioCorto(p, prem = false, largo = false) {
  const [, tienda, tipo, valor] = p;
  if (!tipo) return '+' + num(tienda);
  if (!largo) return (prem ? CORTO_P : CORTO)[tipo] || '+' + num(tienda);
  return premioLargo(p, prem);
}

/** El premio en una frase: «Tu nombre en dorado», «Marco de carta Oro» */
export function premioLargo(p, prem = false) {
  const [, tienda, tipo, valor] = p;
  if (prem) {
    if (tipo === 'marco') return valor === 'Premium' ? 'Marco de carta «Premium»' : 'Marco de carta ' + String(valor || '').toLowerCase();
    if (tipo === 'reaccion') return 'Reacción ' + valor + ' en Publicaciones';
    if (tipo === 'fondo') return valor === 'pagina' ? 'Fondo para tu página' : 'Fondo para tu perfil';
    if (tipo === 'color') return 'Tu nombre del color que elijas';
    if (tipo === 'titulo') return 'Título «' + valor + '»';
    if (tipo === 'emblema') return 'Emblema ' + valor;
    if (tipo === 'carta') return 'Tu carta, edición premium';
    return '+' + num(tienda) + ' Puntos de Tienda';
  }
  if (tipo === 'tarjeta') return 'Tu carta de ' + valor;
  if (tipo === 'insignia') return 'Insignia ' + valor;
  if (tipo === 'titulo') return 'Título «' + valor + '»';
  if (tipo === 'color') return 'Tu nombre en dorado';
  if (tipo === 'llave') return 'Tu carta brilla en las llaves';
  return '+' + num(tienda) + ' Puntos de Tienda';
}

//: 💎 lo de la fila premium que ya funciona; lo demás dice «pronto» (Dlx lo sabe: se arma después)
export const PREMIUM_VIVO = new Set(['fondo', 'color', 'titulo']);

// ── el ícono de cada Tarea, por lo que mide (`MIDE` de bot/pase.py) ──
const T = {
  activo: <><rect x="6" y="9" width="28" height="25" fill="none" stroke="currentColor" strokeWidth="3" /><rect x="6" y="9" width="28" height="7" fill="currentColor" /><rect x="12" y="4" width="3" height="8" fill="currentColor" /><rect x="25" y="4" width="3" height="8" fill="currentColor" /></>,
  vivo: <><circle cx="20" cy="20" r="7" fill={MAG} /><circle cx="20" cy="20" r="14" fill="none" stroke={MAG} strokeWidth="3" /></>,
  sigue: <path d="M20 4l4.8 10 11 1.5-8 7.6 2 10.9L20 28.8 10.2 34l2-10.9-8-7.6 11-1.5z" fill="none" stroke="currentColor" strokeWidth="3" />,
  fel: <path d="M9 22l8-14 4 2-4 9h14l-3 13H12z" fill="none" stroke="currentColor" strokeWidth="3" />,
  voto: <><rect x="7" y="18" width="26" height="16" fill="none" stroke="currentColor" strokeWidth="3" /><path d="M14 18l6-12 6 3-5 9" fill="none" stroke="currentColor" strokeWidth="3" /></>,
  precio: <><circle cx="20" cy="20" r="14" fill="none" stroke="currentColor" strokeWidth="3" /><text x="20" y="26" textAnchor="middle" fontFamily="Archivo, sans-serif" fontWeight="900" fontSize="16" fill="currentColor">$</text></>,
  apuesta: <><rect x="6" y="6" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="3" /><circle cx="14" cy="14" r="3" fill="currentColor" /><circle cx="26" cy="26" r="3" fill="currentColor" /><circle cx="20" cy="20" r="3" fill="currentColor" /></>,
  caza: <><circle cx="20" cy="20" r="14" fill="none" stroke="currentColor" strokeWidth="3" /><circle cx="20" cy="20" r="6" fill="none" stroke="currentColor" strokeWidth="3" /><path d="M20 2v8M20 30v8M2 20h8M30 20h8" stroke="currentColor" strokeWidth="3" /></>,
  promo: <><path d="M5 16h7l14-9v26L12 24H5z" fill="none" stroke="currentColor" strokeWidth="3" /><path d="M31 14v12" stroke="currentColor" strokeWidth="3" /></>,
  dra: <><rect x="14" y="4" width="12" height="20" fill="none" stroke="currentColor" strokeWidth="3" /><path d="M9 18a11 11 0 0022 0M20 29v7M13 36h14" fill="none" stroke="currentColor" strokeWidth="3" /></>,
  crew: <><circle cx="13" cy="14" r="5" fill="none" stroke="currentColor" strokeWidth="3" /><circle cx="27" cy="14" r="5" fill="none" stroke="currentColor" strokeWidth="3" /><path d="M4 34c1-7 5-10 9-10s8 3 9 10M18 34c1-7 5-10 9-10s8 3 9 10" fill="none" stroke="currentColor" strokeWidth="3" /></>,
};
export function TareaIcono({ mide, t = 26 }) {
  return <Svg t={t}>{T[mide] || T.activo}</Svg>;
}
