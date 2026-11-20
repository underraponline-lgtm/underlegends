// 🆕 «HAY UNA ACTUALIZACIÓN» (Dlx, 13/10/2026: «cada vez que haya una actualización en la página web me gustaría que
// aparezca un cuadrado diciendo que hay una nueva actualización»). Un cuadro chico abajo, una sola vez por versión:
//   · volviste y hay una versión que no viste → qué cambió, con «Ver qué cambió» (`#/cambios`) y cerrar;
//   · tenías la página abierta y se publicó otra → lo mismo, con «Recargar» para verla.
// La versión vista es la del changelog (`lg:cambios`, la misma que marca «Nuevo» en Mi cuenta y que guarda abrir
// `#/cambios`): cerrar el cuadro es haberla visto. ⚠️ A quien entra por primera vez no le sale —para él no hay nada
// «nuevo»—: se le anota la de hoy en silencio. Y no sale con el tutorial abierto ni estando en Novedades.
// `cambios.json` es un archivo estático de Pages: pedirlo no toca el Worker. Con la página a la vista, cada 10 minutos
//
// 🎬 EL TRÁILER (20/11/2026, Dlx eligió la B de la maqueta privada del aviso: «el B pero que sea directo en lo que es
// también», y «que recargue bien la página»). En la compu, un fotograma en formato cine —el mismo fondo de la pantalla
// de carga que ya bajó (`__lgFondo`), con sus franjas negras y la versión como código de tiempo, 00:07:17—, una marca por
// cada cambio y el cambio de ahora debajo. En el celular, una isla de un renglón y medio: no tapa más que el cuadro de
// antes. Y DIRECTO: dice «Versión nueva de la página» y qué cambió, con «Recargar para verla»; nada de «presenta».
// «Recargar» agranda el fotograma hasta llenar la pantalla y recarga ENTERA (ver `recargarVersion()`); la pantalla de
// carga sigue el mismo cuadro, con la misma foto, y al 100 las franjas se abren sobre la página nueva (web/montar.py)
import { useEffect, useRef, useState } from 'react';
import { nuevaQue } from './liga.js';
import { PRIMERA_VISITA, quiereTutorial } from './primera.js';

const CADA = 10 * 60 * 1000;
//: cada cuánto pasa al cambio siguiente, y cuánto espera la recarga a que se vuelvan a pedir los archivos
const PASO = 3400;
const ESPERA = 2500;
const leerVista = () => { try { return JSON.parse(localStorage.getItem('lg:cambios') || '""') || ''; } catch (e) { return ''; } };
const guardarVista = (v) => {
  try { localStorage.setItem('lg:cambios', JSON.stringify(v)); } catch (e) { /* sin guardar: igual se cierra */ }
  if (typeof window.CAMBIOS_VISTO === 'string') window.CAMBIOS_VISTO = v;
};
// la última versión y la de antes (la de antes, para que el código de tiempo gire de una a otra)
async function ultima() {
  const r = await fetch('/cambios.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error(String(r.status));
  const d = await r.json();
  const cs = (d && d.cambios) || [];
  return cs[0] ? { ...cs[0], antes: (cs[1] && cs[1].version) || '' } : null;
}
//: la versión con la que se abrió la página: si después aparece otra, hay que recargar para verla
let alAbrir = '';

// (sin las marcas: el changelog escribe **negrita** y `código`, que acá salían con sus asteriscos — 19/10/2026)
const limpio = (s) => String(s || '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').trim();
const corto = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s);
const calma = () => {
  try { return document.documentElement.classList.contains('calma') || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
};
// el fondo de la pantalla de carga que ya bajó esta visita (`__lgFondo`, web/montar.py): el fotograma no baja nada nuevo
const fondo = () => (typeof window.__lgFondo === 'string' ? window.__lgFondo : '');
const nomFondo = () => { const m = /\/carga\/[^/]+\/([\w-]+)-(?:pc|cel|tab|hd)\.webp/.exec(fondo()); return m ? m[1] : ''; };
// «7.17» → «00:07:17»: la versión como código de tiempo de la película
const dos = (n) => String(n || 0).padStart(2, '0');
const tiempo = (v) => { const [a, b] = String(v || '').split('.'); return [dos(a), dos(b)]; };

// 🎬 RECARGAR UNA VERSIÓN NUEVA ES UNA CARGA ENTERA (20/11/2026, Dlx: «cada vez que le doy a recargar página no se
// recarga al 100%», y con el tráiler, «que recargue bien la página»). Tres cosas, para que nada viejo se cuele:
//   1. `lg:estreno` le avisa a la pantalla de carga (web/montar.py) que ésta va completa —los 4 s, de 0 a 100, con la
//      foto de este aviso y el título de la versión— y al lobby que salga sin la caché del navegador;
//   2. mientras el fotograma se agranda, el HTML, el código y la hoja de estilos se vuelven a pedir con
//      `cache: 'reload'`, que salta la caché Y la reescribe: la recarga encuentra lo nuevo aunque el navegador sea uno
//      que guarda en memoria (el iPhone con la página en la pantalla de inicio). Como mucho `ESPERA` ms;
//   3. no es `reload()` sino otra dirección (`?_v=<versión>`), que el primer script de la página saca de la barra.
function recargarVersion(u) {
  try {
    sessionStorage.setItem('lg:estreno', JSON.stringify({ v: u.version, t: limpio(u.titulo),
      i: (u.items || []).slice(0, 3).map((x) => corto(limpio(x).split(':')[0], 60)), f: nomFondo() }));
  } catch (e) { /* igual recarga */ }
  const pide = ['/inicio/inicio.js', '/inicio/inicio.css', '/cambios.json', location.pathname]
    .map((x) => fetch(x, { cache: 'reload', credentials: 'same-origin' }).catch(() => null));
  const ir = () => {
    try {
      const url = new URL(location.href);
      url.searchParams.set('_v', u.version);
      location.replace(url.toString());
    } catch (e) { location.reload(); }
  };
  return Promise.race([Promise.all(pide), new Promise((r) => setTimeout(r, ESPERA))]).then(ir, ir);
}

// 🔄 SE RECARGA SOLA AL VOLVER (Dlx, 14/11/2026, con la captura de su iPhone a las 8:40 PM del 13/11, que todavía
// tenía la tira de círculos verdes de antes de las 2:54 AM: «osea el mío sigue como outdated no?», y al arreglo:
// «Sí, hazlo»). Instalada en la pantalla de inicio, el iPhone deja la página abierta de fondo días enteros y nunca
// vuelve a bajar su código; el cuadro de abajo ofrecía «Recargar», y cerrarlo con la ✕ la dejaba en la vieja.
// Ahora, si estuviste afuera `AFUERA` o más y al volver hay una versión más nueva que la que se abrió, se recarga
// sola: no estabas mirando, así que no se corta nada. Mirando, nunca (queda el cuadro). Y nunca si hay algo escrito
// en un campo, que se perdería: ahí también queda el cuadro. Después de recargar sale «Nueva actualización · Ver qué
// cambió», porque la versión vista (`lg:cambios`) no se toca.
const AFUERA = 10 * 60 * 1000;
let oculta = 0;
function hayAlgoEscrito() {
  const raiz = (document.getElementById('inicio-nuevo') || {}).shadowRoot || document;
  return [...raiz.querySelectorAll('textarea, input:not([type]), input[type=text], input[type=search], input[type=url], [contenteditable=true]')]
    .some((e) => String(e.value || e.textContent || '').trim());
}

// 🎞️ EL ESTRENO: el fotograma crece desde el aviso hasta llenar la pantalla, con la misma foto, las franjas, «Versión
// nueva» y el título, igual que la pantalla de carga que viene después. Va en la raíz de la página y no adentro de
// `.app`: la página va con `zoom` desde 1440 px y lo fijo de adentro se agrandaría con ella
function estreno(desde, u) {
  const raiz = desde.getRootNode();
  const r = desde.getBoundingClientRect();
  const W = innerWidth, H = innerHeight;
  const e = document.createElement('div');
  e.className = 'avv-est';
  e.setAttribute('aria-hidden', 'true');
  e.style.setProperty('--ci', `${Math.max(0, r.top)}px ${Math.max(0, W - r.right)}px ${Math.max(0, H - r.bottom)}px ${Math.max(0, r.left)}px`);
  const f = fondo();
  e.innerHTML = '<i class="avv-est-foto"></i><i class="avv-fr ar"></i><i class="avv-fr ab"></i>' +
    '<div class="avv-est-txt"><span class="avv-est-sello"></span><b></b></div>' +
    '<div class="avv-est-pie"><span>Recargando la página</span><i></i></div>';
  if (f) e.querySelector('.avv-est-foto').style.backgroundImage = `url("${f}")`;
  e.querySelector('.avv-est-sello').textContent = 'Versión nueva · v' + u.version;
  e.querySelector('b').textContent = limpio(u.titulo);
  raiz.appendChild(e);
}

export function AvisoVersion({ pagina }) {
  const [c, setC] = useState(null);
  const [cerrado, setCerrado] = useState('');
  const [k, setK] = useState(0);
  const [va, setVa] = useState(false);
  const caja = useRef(null);
  useEffect(() => {
    let vivo = true;
    const mirar = async (volviste) => {
      if (document.hidden) return;
      let u = null;
      try { u = await ultima(); } catch (e) { return; }
      if (!vivo || !u || !u.version) return;
      if (!alAbrir) alAbrir = u.version;
      if (volviste && nuevaQue(u.version, alAbrir) && !hayAlgoEscrito()) { recargarVersion(u); return; }
      // primera vez en este navegador: nada es «nuevo»
      if (PRIMERA_VISITA && !leerVista()) { guardarVista(u.version); return; }
      setC(u);
    };
    mirar();
    const t = setInterval(() => mirar(false), CADA);
    const vis = () => {
      if (document.hidden) { oculta = Date.now(); return; }
      const largo = oculta && Date.now() - oculta >= AFUERA;
      oculta = 0;
      mirar(largo);
    };
    // el iPhone, al traer una app de fondo, a veces devuelve la página entera de su memoria (`persisted`) sin avisar
    // con visibilitychange: eso también es «volviste»
    const vuelta = (e) => { if (e.persisted) mirar(true); };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('pageshow', vuelta);
    return () => {
      vivo = false; clearInterval(t);
      document.removeEventListener('visibilitychange', vis); window.removeEventListener('pageshow', vuelta);
    };
  }, []);
  const items = c ? (c.items || []).map(limpio).filter(Boolean).slice(0, 5) : [];
  // el cambio de ahora: uno cada `PASO` ms, con su marca llenándose en la línea de tiempo
  useEffect(() => {
    if (items.length < 2) return undefined;
    const t = setInterval(() => setK((x) => (x + 1) % items.length), PASO);
    return () => clearInterval(t);
  }, [c && c.version, items.length]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!c || pagina === 'cambios' || quiereTutorial()) return null;
  const visto = leerVista();
  if (cerrado === c.version || (visto && !nuevaQue(c.version, visto))) return null;
  const recargar = alAbrir && nuevaQue(c.version, alAbrir);
  const cerrar = () => { guardarVista(c.version); setCerrado(c.version); };
  const verla = () => {
    if (va) return;
    setVa(true);
    guardarVista(c.version);
    // el fotograma crece desde el aviso entero (en el celular, la isla)
    if (caja.current && !calma()) estreno(caja.current, c);
    recargarVersion(c);
  };
  const [tm, ts] = tiempo(c.version);
  const [am, as] = tiempo(c.antes);
  const gira = am === tm && as !== ts && !calma();
  const f = fondo();
  const titulo = limpio(c.titulo);
  const play = <svg viewBox="0 0 10 12" aria-hidden="true"><path d="M0 0l10 6-10 6z" fill="currentColor" /></svg>;
  return (
    <aside className={'aviso-version avv' + (va ? ' va' : '')} role="status" ref={caja}
      aria-label={recargar ? 'Hay una versión nueva de la página' : 'La página se actualizó'}>
      <div className="avv-cuadro" style={f ? { backgroundImage: `url("${f}")` } : undefined} aria-hidden="true">
        <i className="avv-fr ar" /><i className="avv-fr ab" />
        <span className="avv-chip">{recargar ? 'Versión nueva' : 'Ya la tienes'}</span>
        <span className="avv-tc"><i /><span className="avv-tcn">00:{tm}:{gira
          ? <span className="avv-rollo"><span>{as}<br />{ts}</span></span> : ts}</span></span>
      </div>
      <div className="avv-cuerpo">
        {/* directo (Dlx: «que sea directo en lo que es»): qué es, y en el celular lo justo para una línea */}
        <p className="avv-pre">{recargar ? <>Versión nueva<em> de la página</em></> : <>Se actualizó<em> la página</em></>}<span> · v{c.version}</span></p>
        <p className="avv-t"><span>{titulo}</span></p>
        {items.length > 1 ? <div className="avv-linea" aria-hidden="true">
          {items.map((x, i) => <i key={i + '-' + (i === k ? k : 'q')} className={i < k ? 'hecha' : i === k ? 'ahora' : ''} style={{ '--paso': PASO + 'ms' }} />)}
        </div> : null}
        {items.length ? <p className="avv-d" key={k}>{corto(items[k] || items[0], 150)}</p> : null}
        <div className="avv-btns">
          {recargar
            ? <button type="button" className="avv-play" onClick={verla} aria-label="Recargar la página para ver la versión nueva">
              <i>{play}</i><span>Recargar para verla</span></button>
            : <a className="avv-play" href="#/cambios" onClick={cerrar}><i>{play}</i><span>Ver qué cambió</span></a>}
          <button type="button" className="avv-x" aria-label="Cerrar el aviso de la versión nueva" onClick={cerrar}>
            <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="2" fill="none" /></svg>
            <span>Después</span></button>
        </div>
      </div>
    </aside>
  );
}
