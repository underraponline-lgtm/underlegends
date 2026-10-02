// Las piezas chicas del Inicio: íconos, cartas, caras, rangos, banderas, secciones y las secciones con pestañas.
// Las clases son las del prototipo (docs/remake/reales.py): su CSS se genera de ahí (web/css_del_prototipo.py).
import { useEffect, useRef, useState } from 'react';
import { PAIS, limpio, num } from './liga.js';

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
  compartir: <><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" /></>,
  // los de Mi cuenta (01/10/2026)
  tarjetas: <><rect x="4" y="6.5" width="12" height="15" rx="1" /><path d="M8 3h12v15" /></>,
  perfil: <><rect x="3" y="5" width="18" height="14" rx="1" /><circle cx="9" cy="11" r="2.5" /><path d="M5.5 16.5c.8-1.7 2-2.5 3.5-2.5s2.7.8 3.5 2.5M14 10h4M14 13h4" /></>,
  seguir: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5M16 4.5a3.5 3.5 0 010 7M18 14.8c1.8.9 3 2.7 3.5 5.2" /></>,
  candado: <><rect x="5" y="10.5" width="14" height="10" rx="1" /><path d="M8 10.5V7a4 4 0 018 0v3.5" /></>,
  tema: <><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5v17a8.5 8.5 0 000-17z" fill="currentColor" /></>,
  reloj: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  calma: <><circle cx="12" cy="4.5" r="1.8" /><path d="M5 8.5l7 1.5 7-1.5M12 10v4.5l-3 6M12 14.5l3 6" /></>,
  instalar: <><rect x="6.5" y="2.5" width="11" height="19" rx="1.5" /><path d="M12 7v7M9 11.5l3 3 3-3M10.5 18.5h3" /></>,
  novedades: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
  guia: <><path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5z" /><path d="M4 20.5A2.5 2.5 0 016.5 18H20v3H6.5" /></>,
  // los que faltaban para la tira de abajo del celular (02/10/2026): el pase es una entrada, la tienda una bolsa
  pase: <><path d="M3 7h18v3.2a1.8 1.8 0 000 3.6V17H3v-3.2a1.8 1.8 0 000-3.6z" /><path d="M15 7.5v1.5M15 11.2v1.6M15 15v1.5" /></>,
  tienda: <><path d="M5 8.5h14l-1.2 12H6.2z" /><path d="M9 8.5V7a3 3 0 016 0v1.5" /></>,
  mundo: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.1 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.1-3.6-8.5s1.2-6.2 3.6-8.5z" /></>,
  legal: <><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4M9 12h7M9 16h7" /></>,
  salir: <><path d="M14 4h5v16h-5" /><path d="M10 8l-4 4 4 4M6 12h10" /></>,
  engranaje: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></>,
  ok: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  falta: <path d="M7 7l10 10M17 7L7 17" />,
  espera: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  aviso: <><path d="M12 3.5l9.5 16.5h-19z" /><path d="M12 10v4.5M12 17.2v.3" /></>,
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
  // Mi cuenta (desde el 02/10/2026 es una página: el botón de app.js lleva a `#/cuenta`, y abre su ventana sólo si
  // el Inicio nuevo no se montó)
  cuenta: () => luego(() => { const b = document.getElementById('bCuenta'); if (b) b.click(); }),
  // lo que pasa por Discord: entrar, la foto y las redes (`urlLogin()` de app.js; al volver, a `#/cuenta`)
  entrar: () => { if (window.urlLogin) location.href = window.urlLogin(); },
  foto: () => { if (window.urlLogin) location.href = window.urlLogin('f'); },
  redes: () => { if (window.urlLogin) location.href = window.urlLogin(true); },
  salir: () => luego(() => { if (window.cuentaSalir) window.cuentaSalir(); }),
  ajustes: () => luego(() => { const b = document.getElementById('bAjustes2'); if (b) b.click(); }),
  carta: (k) => luego(() => { if (window.abrir) window.abrir(k); }),
  llave: (n) => luego(() => {
    if (window.abrirLlave && window.abrirLlave(n) !== false) return;
    if (window.llaveVieja) window.llaveVieja(n); else location.hash = '#/llave/' + n;
  }),
  perfil: (k) => { location.hash = '#/r/' + encodeURIComponent(k); },
  votar: (id, op) => { if (window.votar) window.votar(id, op); },
  // bajar hasta una sección del Inicio: viven en el shadow root, así que `#id` en la dirección no llega
  ir: (id) => {
    const h = document.getElementById('inicio-nuevo');
    const el = h && h.shadowRoot && h.shadowRoot.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
};

// la dirección de algo de la página, para compartirla (sirve también en las direcciones de prueba de Pages):
// «#/r/hassan» -> «https://…/freestyle-rap/r/hassan», con `urlLG()` del script del principio (web/montar.py)
export const enlace = (ruta) => location.origin + (window.urlLG ? window.urlLG(ruta) : '/' + ruta);

// ── compartir: el menú de compartir del teléfono (WhatsApp, Discord…) o, en la computadora, el link copiado.
// Dlx, 30/09/2026: «me gustan todas» (la D: compartir tu carta o una llave). Cada carta que circula trae gente.
export function Compartir({ url, texto, titulo = 'Liga Global', cls = 'btn borde', etiqueta = 'Compartir' }) {
  const [dijo, setDijo] = useState('');
  const avisar = (t) => { setDijo(t); setTimeout(() => setDijo(''), 2500); };
  const dar = async () => {
    const tactil = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    if (navigator.share && tactil) {
      try { await navigator.share({ title: titulo, text: texto, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText((texto ? texto + ' ' : '') + url); avisar('Link copiado'); } catch (e) { avisar('No pude copiarlo'); }
  };
  return (
    <button type="button" className={cls + ' compartir'} onClick={dar} aria-live="polite">
      <Ico n="compartir" t={18} /><span>{dijo || etiqueta}</span>
    </button>
  );
}

export function Bandera({ cc, cls = 'r-flag' }) {
  const [mal, setMal] = useState(null);
  if (!cc || mal === cc) return null;
  return <img className={cls} alt="" src={'/banderas/g/' + cc + '.webp'} onError={() => setMal(cc)} />;
}

// ⚠️ lo que falló se recuerda POR DIRECCIÓN, no como un sí/no: el mismo lugar de una lista pasa a mostrar a otra
// persona y, con un sí/no, heredaba la inicial aunque su foto anduviera (revisión del 01/10/2026)
export function Cara({ liga, k, nombre, cls = 'cara', lazy = false }) {
  const [mal, setMal] = useState(null);
  // la de la tabla; si no está (corta en 200), la que viene aparte por nombre (`avNombre()`)
  const src = (k && liga.avUrl(k)) || (liga.avNombre ? liga.avNombre(nombre) : null);
  // `lazy` en las listas largas (el Ranking: 200 caras): sin eso el navegador pedía las 200 al abrir
  if (src && mal !== src) return <span className={cls}><img alt="" src={src} loading={lazy ? 'lazy' : undefined} decoding={lazy ? 'async' : undefined} onError={() => setMal(src)} /></span>;
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
  const [fallo, setFallo] = useState({ src: null, n: 0 });
  const f = liga.T[k];
  const src0 = liga.cartaUrl(k, cual);
  // las fallas cuentan para ESA dirección: una carta nueva (otra `?v=`) se vuelve a intentar
  const fallas = fallo.src === src0 ? fallo.n : 0;
  if (!src0 || fallas > 1) return <SinCarta liga={liga} k={k} nombre={f ? f.n : k} cc={f ? f.cc : ''} cls={cls} />;
  // 🔴 una carta que no carga (R2 corta a veces) mostraba el ícono de imagen rota: se reintenta una vez y, si
  // vuelve a fallar, la cara con «SIN CARTA» (revisión del 30/09/2026)
  const src = fallas ? src0 + (src0.indexOf('?') < 0 ? '?' : '&') + 'r=1' : src0;
  const img = <img className={cls} alt={'Carta ' + cual + ' de ' + f.n} src={src} loading="lazy"
    onError={() => setTimeout(() => setFallo((x) => ({ src: src0, n: (x.src === src0 ? x.n : 0) + 1 })), fallas ? 0 : 1200)} />;
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
          <a href={href || undefined} onClick={onEnlace} role={href ? undefined : 'button'} tabIndex={href ? undefined : 0}
            onKeyDown={href ? undefined : (e) => { if ((e.key === 'Enter' || e.key === ' ') && onEnlace) { e.preventDefault(); onEnlace(e); } }}>
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
  const [i0, setI] = useState(0);
  const x0 = useRef(null);
  const n = items.length;
  // 🔴 si los datos cambian y la pestaña que mirabas desaparece (una categoría que queda vacía), `items[i]` no
  // existía y la sección entera se apagaba (revisión del 30/09/2026)
  const i = Math.max(0, Math.min(i0, n - 1));
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

// ── el afiche de Se busca ──────────────────────────────────────────────────────────────────────────────────────
export function Poster({ liga, b }) {
  let pie = b.m || '';
  let sello = null;
  let cls = '';
  if (b.e === 'cazado') {
    const por = ((b.c || {}).por || []).map((p) => p.n).join(' y ');
    sello = <span className="p-sello">CAZADO</span>; cls = 'hecho'; pie = 'por ' + por + ' · cobró ' + num(b.v);
  } else if (b.e === 'escondio') {
    sello = <span className="p-sello gris">SE ESCONDIÓ</span>; cls = 'hecho'; pie = 'no jugó: nadie cobró';
  }
  return (
    <a className={'poster ' + cls} href={'#/r/' + encodeURIComponent(b.k)}>
      <span className="p-t">SE BUSCA</span>
      <span className="p-fw"><Cara liga={liga} k={b.k} nombre={b.n} cls="p-foto" />{sello}</span>
      <b>{limpio(b.n)}</b><span className="p-cat">{String(b.cn || '').toUpperCase()}</span>
      <span className="p-precio">{num(b.v)} PTS</span><small>{pie}</small>
    </a>
  );
}
