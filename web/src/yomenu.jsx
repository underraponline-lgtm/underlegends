// 👤 EL MENÚ DE TU CARA (26/10/2026, la puerta 1 del Inventario). Dlx: «tengo que irme a mi cuenta, luego en mi
// perfil…», y a la maqueta, «cinco puertas, 1, 3, 4 y 5». Tocar tu cara (arriba en la compu, «Tu cuenta» abajo en el
// celular) ya no lleva directo a Tu cuenta: abre este menú corto, con el Inventario primero y cuántas cosas nuevas
// tienes (se pregunta al abrirlo, no en cada página: ver inv_nuevos.js).
// Idea de 21st, sólo mirada: «User Profile Dropdown Menu» (shadcnspace) y «Profile Dropdown» (kokonutd).
import { useEffect, useRef, useState } from 'react';
import { pasePost } from './pase.js';
import { cuantosNuevos } from './inv_nuevos.js';

export function YoMenu({ k, nombre, cara, abajo = false, onCerrar }) {
  const [nuevos, setNuevos] = useState(0);
  const caja = useRef(null);
  useEffect(() => {
    let vivo = true;
    pasePost('tags-mios', {}).then((d) => { if (vivo && d && d._ok) setNuevos(cuantosNuevos(d)); });
    return () => { vivo = false; };
  }, []);
  // se cierra con Escape, tocando afuera o eligiendo algo
  useEffect(() => {
    const tecla = (e) => { if (e.key === 'Escape') onCerrar(); };
    const fuera = (e) => {
      const c = caja.current;
      if (c && !e.composedPath().includes(c)) onCerrar();
    };
    window.addEventListener('keydown', tecla);
    const t = setTimeout(() => window.addEventListener('pointerdown', fuera), 0);
    const p = caja.current && caja.current.querySelector('a');
    if (p) p.focus();
    return () => { window.removeEventListener('keydown', tecla); window.removeEventListener('pointerdown', fuera); clearTimeout(t); };
  }, [onCerrar]);
  const items = [
    ['#/inventario', '🎒', 'Inventario', nuevos ? nuevos + (nuevos === 1 ? ' nuevo' : ' nuevos') : 'tus TAGs, marcos y cartas'],
    [k ? '#/r/' + encodeURIComponent(k) : '#/cuenta/perfil', '👤', 'Mi perfil', 'lo que ven los demás'],
    ['#/cuenta', '⚙️', 'Tu cuenta', 'foto, redes, avisos y la app'],
    ['#/pase', '🎟️', 'Pase rapero', 'tu nivel y tus premios'],
  ];
  return (
    <div className={'yo-menu' + (abajo ? ' abajo' : '')} ref={caja} role="menu" aria-label="Lo tuyo">
      {nombre ? <div className="yo-menu-cab">{cara}<b>{nombre}</b></div> : null}
      {items.map(([h, ic, n, d], i) => (
        <a key={h} href={h} role="menuitem" className={i === 0 ? 'inv' : ''} onClick={onCerrar}>
          <span aria-hidden="true">{ic}</span><b>{n}</b><small className={i === 0 && nuevos ? 'nv' : ''}>{d}</small>
        </a>
      ))}
    </div>
  );
}
