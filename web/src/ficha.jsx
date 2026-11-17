// 🪪 TU FICHA AL PASAR EL MOUSE (17/11/2026, la tanda 2 del remake de Tu cuenta). Dlx, de los lugares nuevos para los
// fondos: «me gusta el #1, #4» (el #4 era ésta). En la compu, al dejar el mouse sobre la cara de alguien en cualquier
// página sale una ficha chica con su fondo (lo que eligió en Tus fondos → «Tu ficha»), su cara, su nombre, su puesto y su
// servidor. Tocar sigue haciendo lo de siempre (abrir su carta): la ficha no se toca, sólo se mira.
//   · la cara avisa quién es con `data-fk` (`Cara` de piezas.jsx): un solo oyente para toda la página, no uno por cara
//   · sólo con mouse de verdad (`hover: hover` y `pointer: fine`): en el celular no hay «pasar por encima»
//   · tarda 450 ms en salir, para que cruzar una tabla con el mouse no la haga parpadear
import { useEffect, useRef, useState } from 'react';
import { limpio, num } from './liga.js';
import { Bandera, Cara, nombrePais } from './piezas.jsx';
import { fondoEn, useFondos } from './fondos.js';

const ESPERA = 450, ANCHO = 280;

export function FichaHover({ liga }) {
  const ref = useRef(null);
  const [v, setV] = useState(null);
  const fondos = useFondos();
  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return undefined;
    const raiz = el.getRootNode();
    let reloj = 0, actual = null;
    const cerrar = () => { clearTimeout(reloj); actual = null; setV(null); };
    const sobre = (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      const c = e.target && e.target.closest ? e.target.closest('[data-fk]') : null;
      if (!c || c === actual || c.closest('.fh, .vk')) return;
      clearTimeout(reloj);
      actual = c;
      reloj = setTimeout(() => {
        if (actual !== c || !c.isConnected) return;
        const r = c.getBoundingClientRect();
        const abajo = r.bottom + 190 < window.innerHeight;
        setV({ k: c.getAttribute('data-fk'), x: Math.max(8, Math.min(window.innerWidth - ANCHO - 8, r.left + r.width / 2 - ANCHO / 2)),
          y: abajo ? r.bottom + 8 : Math.max(8, r.top - 8), abajo });
      }, ESPERA);
    };
    const fuera = (e) => {
      if (!actual) return;
      const a = e.relatedTarget;
      if (a && actual.contains(a)) return;
      if (e.target && e.target.closest && e.target.closest('[data-fk]') === actual) cerrar();
    };
    raiz.addEventListener('pointerover', sobre);
    raiz.addEventListener('pointerout', fuera);
    window.addEventListener('scroll', cerrar, { passive: true, capture: true });
    window.addEventListener('pointerdown', cerrar, true);
    return () => {
      clearTimeout(reloj);
      raiz.removeEventListener('pointerover', sobre);
      raiz.removeEventListener('pointerout', fuera);
      window.removeEventListener('scroll', cerrar, { capture: true });
      window.removeEventListener('pointerdown', cerrar, true);
    };
  }, []);
  const f = v && liga ? (liga.T[v.k] || (liga.X && liga.X[v.k]) || null) : null;
  if (!f) return <span ref={ref} hidden />;
  const bg = fondoEn((fondos || {})[v.k], 'ficha', { cc: f.cc, sv: f.sv });
  const sv = f.sv && liga.svs && liga.svs[f.sv];
  const rgc = /^#[0-9a-f]{3,8}$/i.test(f.rgc || '') ? f.rgc : '';
  return (
    <>
      <span ref={ref} hidden />
      <div className={'fh' + (v.abajo ? '' : ' arriba')} role="tooltip" style={{ left: v.x + 'px', top: v.y + 'px', width: ANCHO + 'px' }}>
        <div className={'fh-f' + (bg ? '' : ' liso')} style={bg ? { backgroundImage: bg } : undefined} />
        <div className="fh-b">
          <Cara liga={liga} k={f.k} nombre={f.n} cls="fh-cara" />
          <div className="fh-t">
            <b>{limpio(f.n)}{f.cc ? <Bandera cc={f.cc} cls="fh-flag" /> : null}</b>
            <small>{[f.pos ? '#' + f.pos + ' de la Temporada' : 'Sin puesto todavía', f.ovr ? 'OVR ' + f.ovr : ''].filter(Boolean).join(' · ')}</small>
            <span className="fh-chips">
              {f.rg ? <i className="fh-rg" style={rgc ? { background: rgc } : undefined}>{f.rg}</i> : <i className="fh-rg sin">Sin rango</i>}
              {sv ? <i className="fh-sv">{limpio(sv.nombre || f.sv)}</i> : null}
              {f.cc ? <i className="fh-sv">{nombrePais(f.cc)}</i> : null}
              {f.ev ? <i className="fh-sv">{num(f.ev)} {f.ev === 1 ? 'evento' : 'eventos'}</i> : null}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
