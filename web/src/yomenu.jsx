// 👤 EL MENÚ DE TU CARA (26/10/2026, la puerta 1 del Inventario). Dlx: «tengo que irme a mi cuenta, luego en mi
// perfil…», y a la maqueta, «cinco puertas, 1, 3, 4 y 5». Tocar tu cara (arriba en la compu, «Tu cuenta» abajo en el
// celular) ya no lleva directo a Tu cuenta: abre este menú corto, con el Inventario primero y cuántas cosas nuevas
// tienes (se pregunta al abrirlo, no en cada página: ver inv_nuevos.js).
// Idea de 21st, sólo mirada: «User Profile Dropdown Menu» (shadcnspace) y «Profile Dropdown» (kokonutd).
//
// 🔔 CON EL ESTILO DE LA CAMPANA (Dlx, 13/11/2026: «remakea este apartado como lo está notificaciones con ese mismo
// estilo», y «añade la opción de soporte»): las mismas piezas `.nt-*` del panel de notificaciones —el título en Anton,
// los rótulos de sección, cada fila con su ícono en un círculo, el punto magenta de lo nuevo—, así los dos paneles de la
// cabecera se ven como uno. Soporte lleva a «Algo está mal» de Tu cuenta, que ya es el formulario de los pedidos.
import { useEffect, useRef, useState } from 'react';
import { pasePost } from './pase.js';
import { cuantosNuevos } from './inv_nuevos.js';
import { Ico } from './piezas.jsx';

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
  const secciones = [
    ['Lo tuyo', [
      ['#/inventario', '🎒', 'Inventario', nuevos ? nuevos + (nuevos === 1 ? ' cosa nueva' : ' cosas nuevas') : 'tus TAGs, marcos y cartas', nuevos > 0],
      [k ? '#/r/' + encodeURIComponent(k) : '#/cuenta/perfil', '👤', 'Mi perfil', 'lo que ven los demás'],
      ['#/pase', '🎟️', 'Pase rapero', 'tu nivel y tus premios'],
      // 🛍️ la Tienda vive acá desde que salió del menú de arriba (Dlx, 12/11/2026: «Tienda me gusta en tu cuenta… ahí nos
      // ahorramos un espacio»): es donde se gastan tus Puntos
      ['#/tienda', '🛍️', 'Tienda', 'tus Puntos y el precio por cabeza'],
    ]],
    ['Cuenta y ayuda', [
      ['#/cuenta', '⚙️', 'Tu cuenta', 'foto, redes, avisos y la app'],
      ['#/cuenta/algo-mal', '🛟', 'Soporte', 'perdí mi cuenta, mi país, algo está mal'],
    ]],
  ];
  return (
    <div className={'yo-menu' + (abajo ? ' abajo' : '')} ref={caja} role="menu" aria-label="Lo tuyo">
      <div className="nt-h">
        {cara ? <span className="yo-menu-cara" aria-hidden="true">{cara}</span> : null}
        <h2>{nombre || 'Lo tuyo'}</h2>
        <button type="button" className="nt-ib" aria-label="Cerrar" onClick={onCerrar}><Ico n="cerrar" t={16} /></button>
      </div>
      <div className="nt-cuerpo">
        {secciones.map(([t, xs]) => (
          <div key={t}>
            <p className="nt-s">{t}</p>
            <ul>{xs.map(([h, ic, n, d, nuevo]) => (
              <li key={h}>
                <a href={h} role="menuitem" className={'nt-f' + (nuevo ? ' nueva' : '')} onClick={onCerrar}>
                  <span className="nt-cara"><span className="nt-c nt-ico" aria-hidden="true">{ic}</span></span>
                  <span className="nt-t"><b>{n}</b><small className={nuevo ? 'nv' : ''}>{d}</small></span>
                  <span className="nt-hora" aria-hidden="true">›</span>
                </a>
              </li>
            ))}</ul>
          </div>
        ))}
      </div>
    </div>
  );
}
