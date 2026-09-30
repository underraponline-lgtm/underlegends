// Las piezas chicas del Inicio: íconos, cartas, caras, rangos, banderas, secciones y las secciones con pestañas.
// Las clases son las del prototipo (docs/remake/reales.py): su CSS se genera de ahí (web/css_del_prototipo.py).
import { useEffect, useRef, useState } from 'react';
import { PAIS, limpio } from './liga.js';

const TRAZOS = {
  inicio: <path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />,
  eventos: <><rect x="3.5" y="5" width="17" height="15" rx="1" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  ranking: <path d="M5 20V10M12 20V4M19 20v-7" />,
  campana: <><path d="M6 16V11a6 6 0 1112 0v5l2 2H4z" /><path d="M10 20a2 2 0 004 0" /></>,
  buscar: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
  flecha: <path d="M5 12h14M13 6l6 6-6 6" />,
  publicaciones: <path d="M4 10v4h3l6 4V6L7 10zM17 9a4 4 0 010 6" />,
  yo: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  cerrar: <path d="M6 6l12 12M18 6L6 18" />,
};
export function Ico({ n, t = 20 }) {
  return (
    <svg className="ico" width={t} height={t} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{TRAZOS[n]}</svg>
  );
}
export function Chevron() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square"
      aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
  );
}

// ── lo que el Inicio le pide a la página de hoy (app.js): abrir la cuenta, una carta, una llave, votar ──
// ⚠️ CON setTimeout: app.js cierra sus ventanas con cualquier clic que llegue al documento, y el clic de acá llega
// (retargeteado al host del shadow root). Abriendo después, ese mismo clic no la cierra.
const luego = (f) => setTimeout(f, 0);
export const accion = {
  cuenta: () => luego(() => { const b = document.getElementById('bCuenta'); if (b) b.click(); }),
  ajustes: () => luego(() => { const b = document.getElementById('bAjustes2'); if (b) b.click(); }),
  carta: (k) => luego(() => { if (window.abrir) window.abrir(k); }),
  llave: (n) => luego(() => {
    if (window.abrirLlave && window.abrirLlave(n) !== false) return;
    if (window.llaveVieja) window.llaveVieja(n); else location.hash = '#/llave/' + n;
  }),
  perfil: (k) => { location.hash = '#/r/' + encodeURIComponent(k); },
  votar: (id, op) => { if (window.votar) window.votar(id, op); },
};

export function Bandera({ cc, cls = 'r-flag' }) {
  const [mal, setMal] = useState(false);
  if (!cc || mal) return null;
  return <img className={cls} alt="" src={'/banderas/g/' + cc + '.webp'} onError={() => setMal(true)} />;
}

export function Cara({ liga, k, nombre, cls = 'cara' }) {
  const [mal, setMal] = useState(false);
  const src = k ? liga.avUrl(k) : null;
  if (src && !mal) return <span className={cls}><img alt="" src={src} onError={() => setMal(true)} /></span>;
  return <span className={cls + ' ini'}>{(limpio(nombre).slice(0, 1) || '?').toUpperCase()}</span>;
}

export function SinCarta({ liga, k, nombre, cc, cls = 'ci' }) {
  return (
    <div className={cls + ' sincarta'}>
      <Cara liga={liga} k={k} nombre={nombre} cls="sc-cara" />
      <b>{limpio(nombre)}</b>
      <Bandera cc={cc} cls="sc-flag" />
      <small>SIN CARTA</small>
    </div>
  );
}

// una carta de verdad (de R2) o, si esa persona no la tiene, su cara con «SIN CARTA». Nunca una carta inventada.
export function Carta({ liga, k, cual = 'temporada', cls = 'ci', abre = true }) {
  const f = liga.T[k];
  const src = liga.cartaUrl(k, cual);
  if (!src) return <SinCarta liga={liga} k={k} nombre={f ? f.n : k} cc={f ? f.cc : ''} cls={cls} />;
  const img = <img className={cls} alt={'Carta ' + cual + ' de ' + f.n} src={src} loading="lazy" />;
  if (!abre) return img;
  return <button type="button" className="sin-boton" onClick={() => accion.carta(k)} aria-label={'Ver la carta de ' + f.n}>{img}</button>;
}

export function Rango({ liga, rg }) {
  if (!rg) return <span className="rg sinl" title="Sin letra: le faltan eventos">–</span>;
  return <span className="rg" style={{ background: liga.colorRg(rg) }}>{rg}</span>;
}

export const nombrePais = (cc) => PAIS[cc] || String(cc || '').toUpperCase();

// una sección con su título y el link de la derecha
export function Sec({ id, titulo, enlace, href, onEnlace, extra = '', children, ...resto }) {
  return (
    <section className={('sec ' + extra).trim()} id={id} {...resto}>
      <div className="sec-t">
        <h2>{titulo}</h2>
        {enlace ? (
          <a href={href || undefined} onClick={onEnlace} role={href ? undefined : 'button'} tabIndex={href ? undefined : 0}>
            {enlace} <Ico n="flecha" t={16} />
          </a>
        ) : null}
      </div>
      {children}
    </section>
  );
}

// una sección con pestañas y flechas (Dlx, 29/09: «Los que mandan» y el panel de abajo). En el celular, un paginador
// ‹ selector ›. Con `titulos`, el título de la sección es el de la pestaña que se ve.
export function Pest({ id, titulo, enlace, href, onEnlace, items, extra = '', titulos = false }) {
  const [i, setI] = useState(0);
  const x0 = useRef(null);
  const n = items.length;
  const ver = (k) => setI(((k % n) + n) % n);
  const tabs = useRef(null);
  useEffect(() => {
    const b = tabs.current && tabs.current.children[i];
    if (b && tabs.current.scrollTo) tabs.current.scrollTo({ left: Math.max(0, b.offsetLeft - 16), behavior: 'smooth' });
  }, [i]);
  if (!n) return null;
  return (
    <Sec id={id} titulo={titulos ? items[i].t : titulo} enlace={enlace} href={href} onEnlace={onEnlace} extra={'pest ' + extra}
      onPointerDown={(e) => { x0.current = e.target.closest('.rail, .pz-tabs, .mw-rail, select, input') ? null : e.clientX; }}
      onPointerUp={(e) => { if (x0.current !== null && Math.abs(e.clientX - x0.current) > 50) ver(i + (e.clientX < x0.current ? 1 : -1)); x0.current = null; }}>
      <div className="pz-cab">
        <nav className="pz-tabs" aria-label={titulo} ref={tabs}>
          {items.map((it, k) => (
            <button type="button" key={it.c} className={k === i ? 'on' : ''} aria-pressed={k === i} onClick={() => ver(k)}>{it.et}</button>
          ))}
        </nav>
        <select className="pz-sel" aria-label={titulo} value={i} onChange={(e) => ver(Number(e.target.value))}>
          {items.map((it, k) => <option key={it.c} value={k}>{it.et}</option>)}
        </select>
        <span className="pz-fl">
          <button type="button" className="pz-b izq" aria-label="Anterior" onClick={() => ver(i - 1)}><Ico n="flecha" t={18} /></button>
          <button type="button" className="pz-b der" aria-label="Siguiente" onClick={() => ver(i + 1)}><Ico n="flecha" t={18} /></button>
        </span>
      </div>
      {items.map((it, k) => <div key={it.c} className={'pz' + (k === i ? ' on' : '')} data-c={it.c}>{k === i ? it.cuerpo : null}</div>)}
    </Sec>
  );
}
