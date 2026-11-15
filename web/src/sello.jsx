// 💎 EL SELLO PREMIUM: al lado del nombre, para que cualquiera vea quién tiene el Pase de rapero premium (Dlx lo aprobó).
// Sale de lo público del Pase (`usePases()`): `pub.n[k]` = `[nivel, título, color, premium?, marco, emblema]`, así que no
// pide nada nuevo. El cuarto es 1 con el premium y el quinto el marco de su carta (`t1:oro`).
//
// ⚠️ NO IMPORTA marcos.jsx a propósito: ese archivo dibuja los marcos de las cartas y pesa; acá sólo hace falta el nombre
// del nivel. Y la temporada va escrita «T1»: `cfg.temp` es «prueba», el nombre interno, y no se muestra.
import { useEffect, useRef, useState } from 'react';
import { usePases } from './pase.js';

export const TX_PREMIUM = 'Tiene el Pase de rapero premium de la T1';

const MARCO = { premium: 'Premium', plata: 'Plata', oro: 'Oro' };

/** ¿Tiene el premium ese perfil? (`false` mientras no llegaron los datos) */
export function esPremium(pub, k) {
  const x = k && pub && pub.n && pub.n[k];
  return !!(x && x[3]);
}

/** El nivel del marco de su carta en palabras («Oro»), o '' */
export function marcoPremium(pub, k) {
  const x = k && pub && pub.n && pub.n[k];
  const m = String((x && x[4]) || '');
  return MARCO[m.slice(m.indexOf(':') + 1)] || '';
}

/** Cuánto suma el premium a la XP, en %, de la configuración pública del Pase */
export function boostPremium(pub) {
  return (pub && pub.cfg && pub.cfg.boost) || 20;
}

/** ¿Tiene el premium? Un `usePases()` por llamada: en las listas se pide una vez arriba y se usa `esPremium()` */
export function usePremium(k) {
  return esPremium(usePases(), k);
}

/** El rombo: magenta con borde dorado y un brillo arriba a la izquierda. Sin degradés */
export function SelloPremium({ t = 16, cls = '' }) {
  return (
    <svg className={'sp-prem' + (cls ? ' ' + cls : '')} width={t} height={t} viewBox="0 0 24 24" role="img" aria-label={TX_PREMIUM}>
      <title>{TX_PREMIUM}</title>
      <polygon points="12,1.5 22.5,12 12,22.5 1.5,12" fill="#E41373" stroke="#F5C542" strokeWidth={t >= 14 ? 2 : 1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <polygon points="12,5 12,8.2 8.2,12 5,12" fill="#FF8FC2" />
    </svg>
  );
}

/**
 * El sello que se toca: abre un globo que explica qué es y lleva al Pase. Para el perfil, donde hay lugar. Va adentro de
 * un `.sp-prem-w` (el nombre y el sello juntos), que es donde se ancla el globo
 */
export function SelloPremiumBoton({ t = 22, boost = 20 }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef(null);
  const boton = useRef(null);
  // se cierra tocando afuera (adentro del shadow root: por `composedPath`, como el menú de arriba) y con Escape
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { const p = e.composedPath ? e.composedPath() : []; if (caja.current && !p.includes(caja.current)) setAbierto(false); };
    const tecla = (e) => { if (e.key === 'Escape') { setAbierto(false); if (boton.current) boton.current.focus(); } };
    const cambio = () => setAbierto(false);
    document.addEventListener('pointerdown', fuera, true);
    window.addEventListener('keydown', tecla);
    window.addEventListener('lg:dir', cambio);
    return () => { document.removeEventListener('pointerdown', fuera, true); window.removeEventListener('keydown', tecla); window.removeEventListener('lg:dir', cambio); };
  }, [abierto]);
  return (
    // ⚠️ la caja NO se posiciona: el globo se ancla en el `.sp-prem-w` que envuelve nombre y sello, que arranca donde
    // arranca el nombre. Anclado al sello, en el celular se salía por la izquierda con un nombre corto
    <span className="sp-prem-caja" ref={caja}>
      <button type="button" ref={boton} className="sp-prem-btn" aria-expanded={abierto} aria-label={TX_PREMIUM} onClick={() => setAbierto((v) => !v)}>
        <SelloPremium t={t} />
      </button>
      {abierto ? (
        <span className="sp-prem-pop" role="dialog" aria-label="Pase de rapero premium">
          <span>Tiene el <b>Pase de rapero premium</b> de la T1: marcos de carta, color de nombre y +{boost} % de XP.</span>
          <a href="#/pase" onClick={() => setAbierto(false)}>Cómo se consigue</a>
        </span>
      ) : null}
    </span>
  );
}
