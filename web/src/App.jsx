// El Inicio nuevo (Dlx, 29/09/2026: «1. B. 2. B»): reemplaza al de hoy y convive con el resto de la página, que
// sigue siendo app.js. Lo que sabe hacer la página de hoy —la cuenta, los visores de cartas y llaves, votar— se le
// pide a ella (ver `accion` en piezas.jsx); lo que el Inicio muestra lo lee de sus mismos datos.
import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Liga, aQuienSigo, quienMira } from './liga.js';
import { Cabecera, Hero, Historias, Instalar, IrA, Tira, gruposHistorias } from './arriba.jsx';
import { Fechas, LaLiga, LosQueMandan, Noticias, Panel } from './medio.jsx';
import { Menu, Merch, Pie, SeBusca, Tabbar, Visor } from './abajo.jsx';
import { Encuestas } from './encuestas.jsx';
import { PerfilSv } from './servidor.jsx';
import { Cambios } from './cambios.jsx';
import { Cuenta, PaginaVerificar } from './cuenta.jsx';

// ── el puente con app.js: cada vez que pinta, avisa ──────────────────────────────────────────────
// ⚠️ Las funciones de app.js son globales (script clásico, sin módulo), y adentro se llaman por su nombre: si se
// cambia `window.pintaDatos`, las llamadas de app.js pasan por el cambio. Se envuelven una sola vez.
function envolver(nombre, evento) {
  const f = window[nombre];
  if (typeof f !== 'function' || f.__inicio) return;
  const g = function () {
    const r = f.apply(this, arguments);
    try { window.dispatchEvent(new CustomEvent(evento)); } catch (e) { /* nada */ }
    return r;
  };
  g.__inicio = true;
  window[nombre] = g;
}
envolver('pintaDatos', 'lg:datos');
envolver('pintaEncuestas', 'lg:enc');
envolver('pintaVivo', 'lg:vivo');
envolver('ir', 'lg:ruta');
// 🔴 ENTRAR CON DISCORD TERMINA SOLO: `volverDeDiscord()` guarda la cuenta cuando vuelve un fetch y llama a
// `pintaCuenta()`, sin `ir()` ni datos nuevos. Sin esto el Inicio seguía mostrando «Entrar» (30/09/2026, revisión).
// Y a quién seguís lo guarda siempre `guardarSigo()`.
envolver('pintaCuenta', 'lg:cuenta');
envolver('guardarSigo', 'lg:sigo');

// ── el changelog: qué versión habías visto ANTES de abrirlo. app.js la da por vista apenas dibuja el suyo, que sigue
// dibujándose escondido, y lo hace antes que esto. Si la página se abrió en `#/cambios`, ya pasó antes de que cargara
// este módulo: por eso el script del principio de index.html la guarda (`__cambiosVisto`, ver web/montar.py). Si se
// llega navegando, se toma justo antes de que app.js vuelva a pintar el suyo
let cambiosAntes = (() => {
  if (typeof window.__cambiosVisto === 'string') return window.__cambiosVisto;
  try { return JSON.parse(localStorage.getItem('lg:cambios')) || ''; } catch (e) { return ''; }
})();
(function () {
  const f = window.pintaCambios;
  if (typeof f !== 'function' || f.__inicio) return;
  const g = function () {
    if (typeof window.CAMBIOS_VISTO === 'string') cambiosAntes = window.CAMBIOS_VISTO;
    return f.apply(this, arguments);
  };
  g.__inicio = true;
  window.pintaCambios = g;
})();

// las vistas de la página de hoy que ya dibuja el Inicio nuevo: la vieja sigue escondida, de respaldo. La misma lista
// que `PROPIAS` de web/montar.py (el script del principio de index.html)
const PROPIAS = { cambios: 1 };

// ── ¿la ruta es el Inicio? La misma regla que `ir()` de app.js: vacío, `#/` o algo que no es una vista ──
function esInicio() {
  const h = location.hash || '';
  if (/^#(access_token|error)=/.test(h)) return true;
  const r = h.replace(/^#\/?/, '').split('?')[0];
  const p = r.split('/')[0];
  if (!p) return true;
  if (PROPIAS[p]) return true;
  const alias = { avisos: 1, duelos: 1, llave: 1 };
  if (alias[p]) return false;
  return !document.querySelector('section.vista[data-vista="' + p.replace(/"/g, '') + '"]');
}
function marcarRuta() {
  document.documentElement.classList.toggle('ini-nuevo', esInicio() && !window.__inicioSinDatos);
}

// 🔴 CADA SECCIÓN, AISLADA — la regla de `pintaDatos()` de app.js: una que falla (un dato con otra forma) queda
// sin dibujar y el resto del Inicio sale igual. El error queda en la consola con el nombre de la sección.
class Aislada extends Component {
  constructor(p) { super(p); this.state = { roto: false }; }
  static getDerivedStateFromError() { return { roto: true }; }
  componentDidCatch(e) { console.error('[inicio:' + this.props.n + ']', e); }
  render() { return this.state.roto ? null : this.props.children; }
}

// si el Inicio entero no puede dibujarse, se vuelve al de la página de hoy, que sigue en el DOM
export class Respaldo extends Component {
  constructor(p) { super(p); this.state = { roto: false }; }
  static getDerivedStateFromError() { return { roto: true }; }
  componentDidCatch(e) {
    console.error('[inicio]', e);
    window.__inicioSinDatos = true;
    document.documentElement.classList.remove('ini-nuevo');
  }
  render() { return this.state.roto ? null : this.props.children; }
}

// ¿app.js ya dijo que no pudo cargar? Escribe su aviso en la primera vista (el Inicio de hoy)
function fallaronLosDatos() {
  const v = document.querySelector('main .vista');
  return !!(v && /No pude cargar los datos/.test(v.textContent || ''));
}

function leerTema() {
  try { return localStorage.getItem('lg:tema') === 'noche' ? 'noche' : 'clara'; } catch (e) { return 'clara'; }
}

// lo que las votaciones necesitan de app.js: los votos, el mío y el estado (guardando, error)
function estadoEnc() {
  const w = window;
  const mio = w.ENC_MIO || {};
  const est = w.ENC_EST || {};
  const cuenta = (id) => (w.cuentaEnc ? w.cuentaEnc(id) : (w.ENC_V || {})[id] || {});
  const pie = (E, nombre) => {
    const e = est[E.id] || {};
    if (e.va) return 'Guardando tu voto…';
    if (e.error) return w.errorEnc ? w.errorEnc(e).replace(/<[^>]+>/g, '') : 'No pude guardar tu voto.';
    if (mio[E.id] && E.op.includes(mio[E.id])) return 'Votaste por ' + nombre(mio[E.id]) + '. Lo podés cambiar hasta que cierre.';
    return (w.DC ? 'Tocá una opción para votar.' : 'Para votar entrás con Discord: tocá una opción.') + ' Nadie ve a quién votaste.';
  };
  const yoDiscord = w.DC && w.DC.clave ? w.DC.clave : null;
  return { mio, est, cuenta, pie, yoDiscord };
}

export default function App() {
  const [D, setD] = useState(() => window.D || null);
  const [muro, setMuro] = useState(null);
  const [vivoL, setVivoL] = useState(() => window.VIVO_L || null);
  const [enc, setEnc] = useState(estadoEnc);
  const [ahora, setAhora] = useState(() => new Date());
  const [tema, setTema] = useState(leerTema);
  const [menu, setMenu] = useState(false);
  const [historia, setHistoria] = useState(null);
  // las historias vistas quedan vistas aunque recargues (Dlx, 30/09: «me gustan todas», la C): {id: firma}. Si llega
  // algo más nuevo, la firma cambia y el círculo vuelve a verde
  const [vistos, setVistos] = useState(() => { try { return JSON.parse(localStorage.getItem('lg:historias')) || {}; } catch (e) { return {}; } });
  const [yo, setYo] = useState(quienMira);
  const [hash, setHash] = useState(() => location.hash);
  const [sigoV, setSigoV] = useState(0);
  const raiz = useRef(null);

  useEffect(() => {
    const datos = () => { setD(window.D || null); setAhora(new Date()); setYo(quienMira()); setEnc(estadoEnc()); marcarRuta(); };
    const votos = () => setEnc(estadoEnc());
    const vivo = () => setVivoL(Object.assign({}, window.VIVO_L || {}));
    const ruta = () => { marcarRuta(); setYo(quienMira()); setHash(location.hash); };
    const cuenta = () => setYo(quienMira());
    const sigo = () => setSigoV((v) => v + 1);
    // cambiar la hora, la zona o el formato en Ajustes: todo lo que tiene horas se vuelve a dibujar
    const ajustes = () => setAhora(new Date());
    window.addEventListener('lg:ajustes', ajustes);
    window.addEventListener('lg:cuenta', cuenta);
    window.addEventListener('lg:sigo', sigo);
    window.addEventListener('lg:datos', datos);
    window.addEventListener('lg:enc', votos);
    window.addEventListener('lg:vivo', vivo);
    window.addEventListener('lg:ruta', ruta);
    window.addEventListener('hashchange', ruta);
    window.addEventListener('storage', ruta);
    // 🔴 Y LA DIRECCIÓN TAMBIÉN: quien vuelve de Discord vuelve a `/#access_token=…` y app.js la cambia con
    // replaceState (sin hashchange) al destino —`#/cuenta/verificar`—. Si eso pasó entre el primer dibujo y este
    // efecto, el Inicio se quedaba en la dirección vieja (01/10/2026, al probar «Cancelar» en Discord)
    ruta();
    // ⚠️ app.js pudo pintar ENTRE que este módulo envolvió sus funciones y este efecto: el aviso salió sin nadie
    // escuchando. Se lee una vez lo que haya.
    if (window.D) datos();
    if (window.VIVO_L) vivo();
    // si los datos no llegan, se vuelve a la página de hoy: su error («No pude cargar los datos») es el que se ve
    const t0 = Date.now();
    const plazo = setInterval(() => {
      if (window.D) { clearInterval(plazo); return; }
      if (fallaronLosDatos() || Date.now() - t0 > 15000) {
        clearInterval(plazo); window.__inicioSinDatos = true; marcarRuta();
      }
    }, 400);
    const reloj = setInterval(() => setAhora(new Date()), 60000);
    return () => {
      window.removeEventListener('lg:datos', datos); window.removeEventListener('lg:enc', votos);
      window.removeEventListener('lg:vivo', vivo); window.removeEventListener('lg:ruta', ruta);
      window.removeEventListener('hashchange', ruta); window.removeEventListener('storage', ruta);
      window.removeEventListener('lg:cuenta', cuenta); window.removeEventListener('lg:sigo', sigo);
      window.removeEventListener('lg:ajustes', ajustes);
      clearInterval(plazo); clearInterval(reloj);
    };
  }, []);

  // el muro (Lo último y las historias): lo pide el Inicio, cada 5 minutos con la pestaña a la vista
  useEffect(() => {
    let vivo = true;
    const pedir = () => fetch('/api/muro', { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null)).then((m) => { if (vivo && m) setMuro(m); }).catch(() => {});
    pedir();
    const t = setInterval(() => { if (document.visibilityState === 'visible') pedir(); }, 300000);
    return () => { vivo = false; clearInterval(t); };
  }, []);

  const elegirTema = useCallback((t) => { setTema(t); try { localStorage.setItem('lg:tema', t); } catch (e) { /* igual */ } }, []);
  useEffect(() => { document.documentElement.classList.toggle('ini-noche', tema === 'noche'); }, [tema]);
  const cerrarHistoria = useCallback(() => setHistoria(null), []);
  const visto = useCallback((id, firma) => setVistos((v) => {
    if (v[id] === firma) return v;
    const n = Object.assign({}, v, { [id]: firma });
    try { localStorage.setItem('lg:historias', JSON.stringify(n)); } catch (e) { /* sin guardar */ }
    return n;
  }), []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const liga = useMemo(() => (D ? new Liga(D, muro, ahora, yo.k, aQuienSigo()) : null), [D, muro, ahora, yo, sigoV]);
  // el perfil de un servidor (#/sv/<SIGLA>): app.js no conoce la ruta y la deja en el Inicio, y acá se dibuja el perfil
  const mSv = /^#\/sv\/([^/?#]+)/i.exec(hash || '');
  let sv = null;
  // ⚠️ con try: un `%` suelto en la dirección tiraba URIError y el Inicio entero se caía al de respaldo
  if (mSv) { try { sv = decodeURIComponent(mSv[1]).toUpperCase(); } catch (e) { sv = mSv[1].toUpperCase(); } }
  useEffect(() => { if (sv) window.scrollTo(0, 0); }, [sv]);
  // qué página: '' es el Inicio; `cambios` (01/10/2026) la primera que el Inicio nuevo le sacó a la de hoy
  const partes = (hash || '').replace(/^#\/?/, '').split('?')[0].split('/');
  const pagina = /^(access_token|error)=/.test(partes[0] || '') ? '' : (partes[0] || '');
  // ⚠️ fuera de las secciones aisladas: si armar las historias fallaba, se caía el Inicio entero al de respaldo
  const grupos = useMemo(() => {
    if (!liga) return [];
    try { return gruposHistorias(liga); } catch (e) { console.error('[inicio] las historias:', e); return []; }
  }, [liga]);

  if (!liga) return <div className={'app ' + tema}><div className="barra-ul" /><div className="cargando">Cargando la Liga…</div></div>;
  return (
    <div className={'app ' + tema} ref={raiz}>
      <div className="barra-ul" />
      <Aislada n="Cabecera"><Cabecera liga={liga} dc={yo.dc} pagina={pagina} onMenu={() => setMenu(true)} /></Aislada>
      {sv ? <Aislada n="PerfilSv"><PerfilSv liga={liga} sv={sv} /></Aislada>
        : pagina === 'cambios' ? <Aislada n="Cambios"><Cambios liga={liga} ver={partes[1] || null} antes={cambiosAntes} /></Aislada>
        // verificarse desde la página (01/10/2026): de Mi cuenta, sólo esta parte está en línea
        : pagina === 'cuenta' && partes[1] === 'verificar' ? <Aislada n="Verificar"><PaginaVerificar liga={liga} dc={yo.dc} /></Aislada>
        : pagina === 'ajustes' ? <Aislada n="Ajustes"><Cuenta cual="ajustes" liga={liga} dc={yo.dc} parte={partes[1] || null} tema={tema} onTema={elegirTema} /></Aislada> : <>
        <Aislada n="Historias"><Historias liga={liga} grupos={grupos} vistos={vistos} onAbrir={setHistoria} /></Aislada>
        <Aislada n="Hero"><Hero liga={liga} vivoL={vivoL}><Aislada n="Tira"><Tira liga={liga} /></Aislada></Hero></Aislada>
        <Aislada n="IrA"><IrA raiz={raiz} /></Aislada>
        <Aislada n="Instalar"><Instalar /></Aislada>
        <Aislada n="Fechas"><Fechas liga={liga} /></Aislada>
        <Aislada n="Noticias"><Noticias liga={liga} raiz={raiz} /></Aislada>
        <Aislada n="LosQueMandan"><LosQueMandan liga={liga} dc={yo.dc} /></Aislada>
        <Aislada n="Panel"><Panel liga={liga} /></Aislada>
        <Aislada n="Encuestas"><Encuestas liga={liga} enc={enc} dc={yo.dc} /></Aislada>
        <Aislada n="SeBusca"><SeBusca liga={liga} /></Aislada>
        <Aislada n="Merch"><Merch /></Aislada>
        <Aislada n="LaLiga"><LaLiga liga={liga} /></Aislada>
      </>}
      <Aislada n="Pie"><Pie liga={liga} /></Aislada>
      <Aislada n="Tabbar"><Tabbar liga={liga} dc={yo.dc} pagina={pagina} /></Aislada>
      <Aislada n="Menu"><Menu liga={liga} abierto={menu} onCerrar={() => setMenu(false)} tema={tema} onTema={elegirTema} /></Aislada>
      {historia !== null ? <Aislada n="Visor"><Visor liga={liga} grupos={grupos} abierto={historia} onCerrar={cerrarHistoria} onVisto={visto} raiz={raiz} /></Aislada> : null}
    </div>
  );
}
