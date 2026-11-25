// Las piezas chicas del Inicio: íconos, cartas, caras, rangos, banderas, secciones y las secciones con pestañas.
// Las clases son las del prototipo (docs/remake/reales.py): su CSS se genera de ahí (web/css_del_prototipo.py).
import { Children, Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PAIS, capital, limpio, num } from './liga.js';
import * as RQ from './requisitos.js';
// 🖼️ el marco de carta del Pase premium, donde se vea tu carta (25/10/2026)
import { usePases } from './pase.js';
import { ConMarco } from './marcos.jsx';
import { ConEfecto, capaCara, nombreTienda, tieneAro, usePuesto } from './puesto.js';

const TRAZOS = {
  // 💬 el globo de los comentarios (13/11/2026, «Lo último»)
  globo: <path d="M4 5h16v11h-8l-5 4v-4H4z" />,
  inicio: <path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />,
  eventos: <><rect x="3.5" y="5" width="17" height="15" rx="1" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  ranking: <path d="M5 20V10M12 20V4M19 20v-7" />,
  campana: <><path d="M6 16V11a6 6 0 1112 0v5l2 2H4z" /><path d="M10 20a2 2 0 004 0" /></>,
  buscar: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
  flecha: <path d="M5 12h14M13 6l6 6-6 6" />,
  // ⬆️ hasta arriba de todo: la flecha contra una raya, no la flecha de «siguiente» girada (la de Subir, 17/11/2026)
  arriba: <path d="M5 4.5h14M12 20.5V9.5M6.5 15l5.5-5.5 5.5 5.5" />,
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
  novedades: <><path d="M5 3.5h10l4 4v13H5z" /><path d="M15 3.5v4h4M8.5 12h7M8.5 16h5" /></>,
  guia: <><path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5z" /><path d="M4 20.5A2.5 2.5 0 016.5 18H20v3H6.5" /></>,
  // 🏟️ Ligas (16/10/2026): una tabla con su encabezado, el puesto y el nombre
  ligas: <><rect x="3.5" y="4" width="17" height="16" rx="1" /><path d="M3.5 9h17M3.5 14h17M8.5 9v11" /></>,
  // 🏛️ el Salón de la fama (16/10/2026): un pedestal con su estrella
  salon: <><path d="M12 3.5l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6z" /><path d="M6 20.5h12M8 20.5v-3h8v3" /></>,
  // los que faltaban para la tira de abajo del celular (02/10/2026): el pase es una entrada, la tienda una bolsa
  pase: <><path d="M3 7h18v3.2a1.8 1.8 0 000 3.6V17H3v-3.2a1.8 1.8 0 000-3.6z" /><path d="M15 7.5v1.5M15 11.2v1.6M15 15v1.5" /></>,
  tienda: <><path d="M5 8.5h14l-1.2 12H6.2z" /><path d="M9 8.5V7a3 3 0 016 0v1.5" /></>,
  mundo: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.1 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.1-3.6-8.5s1.2-6.2 3.6-8.5z" /></>,
  // Socios, lo que era Mundo (03/10/2026): los servidores, uno arriba del otro
  socios: <><rect x="3.5" y="4" width="17" height="7" rx="1" /><rect x="3.5" y="13" width="17" height="7" rx="1" /><path d="M7 7.5h.01M7 16.5h.01M11 7.5h6M11 16.5h6" /></>,
  legal: <><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4M9 12h7M9 16h7" /></>,
  salir: <><path d="M14 4h5v16h-5" /><path d="M10 8l-4 4 4 4M6 12h10" /></>,
  engranaje: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></>,
  ok: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  // 🎁 el regalo de Invita y gana (17/11/2026): la caja, su tapa, la cinta y el moño, con el trazo cuadrado de los demás
  regalo: <><path d="M4.5 11.5h15V20h-15z" /><path d="M3 8h18v3.5H3z" /><path d="M12 8v12" /><path d="M12 8C10.5 4.5 6.5 4 7 6.5 7.4 8.3 10.5 8 12 8zM12 8c1.5-3.5 5.5-4 5-1.5C16.6 8.3 13.5 8 12 8z" /></>,
  falta: <path d="M7 7l10 10M17 7L7 17" />,
  espera: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  aviso: <><path d="M12 3.5l9.5 16.5h-19z" /><path d="M12 10v4.5M12 17.2v.3" /></>,
  // 🎨 LOS QUE REEMPLAZAN A LOS EMOJIS (Dlx, 13/10/2026, la lista de «sitio vibecodeado»: un emoji se ve distinto en
  // cada celular y dice «plantilla»). Mismo trazo que los de arriba
  copa: <path d="M7 4h10v5a5 5 0 01-10 0zM7 6H4v1.5A3 3 0 007 10.5M17 6h3v1.5a3 3 0 01-3 3M12 14v3.5M8 20.5h8M9.5 17.5h5" />,
  // ⚡ la XP (13/11/2026): el rayo, para el nivel de la cabecera
  xp: <path d="M13.5 2.5 5 13.5h6l-1.5 8 8.5-11h-6z" />,
  fuego: <path d="M12 3c.6 3 4.8 5.2 4.8 10.2A4.8 4.8 0 0112 18a4.8 4.8 0 01-4.8-4.8c0-2.6 1.4-4 2.4-5 .2 1.6.9 2.6 1.9 3.1C11.6 8.6 12 6 12 3z" />,
  // ⚡ Actividad: un pulso; 📈 Ascensos: una escalera que sube (13/11/2026, cada ranking con el suyo)
  pulso: <path d="M2 12h4.5l2.5-6.5 4.5 13 2.5-6.5H22" />,
  subir: <path d="M3 20h5v-5h5v-5h5V5h3M15 3.5h6v6" />,
  mira: <><circle cx="12" cy="12" r="7.5" /><circle cx="12" cy="12" r="2.5" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></>,
  micro: <><path d="M9 3h6v10H9z" /><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21M8 21h8" /></>,
  jurado: <path d="M12 4v16M7 20h10M4 7h16M6.5 7L4 13.5h5zM17.5 7L15 13.5h5z" />,
  // 🖼️ guardar una historia como imagen (18/10/2026)
  imagen: <><path d="M4 5h16v14H4z" /><path d="M4 16l5-5 4 4 3-3 4 4" /><circle cx="9" cy="9.5" r="1.5" /></>,
  auris: <><path d="M4 15v-3a8 8 0 0116 0v3" /><path d="M4 14h4v6H4zM16 14h4v6h-4z" /></>,
  // 🎧 el beat de las historias (21/11/2026): sonando y silenciado
  sonido: <><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" /></>,
  mudo: <><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M16 9.5l5 5M21 9.5l-5 5" /></>,
  premio: <><circle cx="12" cy="9" r="5" /><path d="M9 13.2L7.5 21l4.5-2.5 4.5 2.5-1.5-7.8" /></>,
  escudo: <path d="M12 3l8 3v6c0 4.6-3.3 7.9-8 9-4.7-1.1-8-4.4-8-9V6z" />,
  // ✎ el lápiz de Mods (21/11/2026, mods_herramientas.jsx)
  lapiz: <path d="M4 20l4.5-1L19.5 8 16 4.5 5 15.5zM13.5 7l3.5 3.5" />,
  replica: <path d="M4 8.5h13.5M14 5l3.5 3.5L14 12M20 15.5H6.5M10 12l-3.5 3.5L10 19" />,
  brote: <path d="M12 21v-9M12 12c0-4.2 3-6.5 7.5-6.5 0 4.2-3 6.5-7.5 6.5zM12 15c0-3.2-2.3-5-6-5 0 3.2 2.3 5 6 5z" />,
  cruce: <path d="M4 4l6.5 6.5M20 20l-6.5-6.5M20 4L4 20M4 4h4.5M4 4v4.5M20 20h-4.5M20 20v-4.5" />,
  // 🧭 los que faltaban en la tira del celular (12/11/2026, Dlx: «asegúrate que todo tenga su logotipo»): Competencias y
  // Crews salían sin ícono porque la tira busca uno por el nombre de la página. Competencias es un cuadro de llave; Crews,
  // tres personas
  competencias: <path d="M3 5h5v4H3zM3 15h5v4H3zM8 7h3v10H8M11 12h4M15 9.5h6v5h-6z" />,
  crews: <><circle cx="12" cy="7.5" r="3" /><circle cx="5.5" cy="10" r="2.3" /><circle cx="18.5" cy="10" r="2.3" /><path d="M6.5 20c.6-3.6 2.8-5.8 5.5-5.8s4.9 2.2 5.5 5.8M2 18.5c.4-2 1.6-3.4 3.3-3.8M22 18.5c-.4-2-1.6-3.4-3.3-3.8" /></>,
  // 👤 los del menú de tu cara (13/11/2026, Dlx: «crea tus propios iconos, no usemos emojis»): el Inventario es una
  // mochila, el Dashboard un tablero, el panel de un servidor sus barras adentro de una ventana y Soporte un salvavidas
  mochila: <><path d="M5.5 20.5V10.5a6.5 6.5 0 0113 0v10z" /><path d="M9.5 4.5V3h5v1.5M5.5 12h13M9 15h6v3.5H9z" /></>,
  tablero: <path d="M4 4h7v9H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 15h7v5H4z" />,
  servidor: <><rect x="3.5" y="4" width="17" height="16" rx="1" /><path d="M7.5 16.5v-3M11 16.5V9M14.5 16.5v-5M18 16.5v-7" /></>,
  soporte: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3.5" /><path d="M9.5 9.5L6 6M14.5 9.5L18 6M9.5 14.5L6 18M14.5 14.5L18 18" /></>,
  moneda: <><circle cx="12" cy="12" r="8.5" /><path d="M14.5 8.5h-3.2a1.8 1.8 0 000 3.6h1.4a1.8 1.8 0 010 3.6H9.5M12 6.5v2M12 15.7v1.8" /></>,
};
// ✏️ EL TRAZO ES NUESTRO, NO EL DE LUCIDE (13/10/2026): punta y esquina rectas, un poco más grueso. Redondeado y en 2
// era exactamente el de Lucide y Feather, la segunda señal de la lista de «sitio vibecodeado»; recto va con lo demás de la
// Liga —bordes de 2 px, sin radios, el Chevron— y con los afiches
export function Ico({ n, t = 20 }) {
  return (
    <svg className="ico" width={t} height={t} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25"
      strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">{TRAZOS[n]}</svg>
  );
}

// 🎨 LA SILUETA DEL SERVIDOR ATRÁS DE LOS TÍTULOS (Dlx, 13/10/2026, a las maquetas: «hacé lo que consideres mejor»;
// la D). Es la misma máscara de los rombos de las cartas (comun/logos_sv/, copiada en webp a bot/paginas/logos_sv/), en el
// color del servidor. Donde no hay servidor, la cinta de las esquinas (vivo.css). Con un color claro va más tenue: blanca
// a .55 competía con el texto blanco
const SILUETAS = new Set(['acad', 'ddf', 'dra', 'efa', 'ffa', 'ffs', 'frz', 'ftn', 'fvs', 'sr', 'tfc', 'twr', 'urbf']);
export function silueta(sv, col) {
  const k = String(sv || '').toLowerCase();
  if (!SILUETAS.has(k)) return {};
  const x = /^#?([0-9a-f]{6})$/i.exec(col || '');
  const n = x ? parseInt(x[1], 16) : 0;
  const luz = (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return { '--mo-sil': 'url("/logos_sv/sv_' + k + '.webp")', '--mo-so': luz > 0.6 ? 0.22 : luz > 0.4 ? 0.38 : 0.55 };
}

// 🥇 LAS MEDALLAS, COMO EN LAS CARTAS: el punto de oro, plata o bronce de las cartas (`.lv-oro` y compañía) en vez de
// 🥇🥈🥉, que en cada celular se dibujan distinto. El puesto va escrito al lado: el punto no es lo único que lo dice
export const PUESTO_MEDALLA = { Campeón: 1, Subcampeón: 2, Tercero: 3, Cuarto: 4 };
export function Medalla({ p }) {
  return p ? <i className={'med m' + p} aria-hidden="true" /> : null;
}
export function Chevron() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square"
      aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
  );
}

// ── lo que la página le pide a la cañería (cuenta.js, social.js): abrir la cuenta, una carta, una llave, votar ──
const luego = (f) => setTimeout(f, 0);
// 🎞️ EL ÚLTIMO TOQUE, para que la ventana de una tarjeta (visor.jsx) haga salir la carta de donde la tocaste. Con
// `composedPath()`: la página vive en un shadow root, y en `window` el `target` es el host y no lo que se tocó
if (typeof window !== 'undefined' && !window.__lgToqueOk) {
  window.__lgToqueOk = true;
  window.addEventListener('pointerdown', (e) => { const p = e.composedPath ? e.composedPath() : []; window.__lgToque = { el: p[0] || e.target, t: Date.now() }; }, { capture: true, passive: true });
}

export const accion = {
  // Tu cuenta es una página (desde el 02/10/2026; hasta la tanda 4 se llegaba tocando el botón escondido de app.js)
  cuenta: () => { location.hash = '#/cuenta'; },
  // lo que pasa por Discord: entrar, la foto y las redes (`urlLogin()` de cuenta.js; al volver, a `#/cuenta`)
  entrar: () => { if (window.urlLogin) location.href = window.urlLogin(); },
  foto: () => { if (window.urlLogin) location.href = window.urlLogin('f'); },
  redes: () => { if (window.urlLogin) location.href = window.urlLogin(true); },
  salir: () => luego(() => { if (window.cuentaSalir) window.cuentaSalir(); }),
  // los ajustes son una sección de Tu cuenta (la hora, la zona, «menos animaciones»)
  ajustes: () => { location.hash = '#/cuenta/hora'; },
  // la tarjeta, en la ventana nueva (`visor.jsx`, 2.10): la abre App.jsx con `lg:carta`
  // con `cual`, abre en esa carta (la historia de una carta nueva de País abría la de Temporada, revisión del 04/10/2026)
  carta: (k, cual) => { window.dispatchEvent(new CustomEvent('lg:carta', { detail: cual ? k + '|' + cual : k })); },
  // la llave nueva es una página (2.10): se va a su dirección, y el «atrás» vuelve
  llave: (n) => { location.hash = '#/llave/' + encodeURIComponent(n); },
  perfil: (k) => { location.hash = '#/r/' + encodeURIComponent(k); },
  votar: (id, op) => { if (window.votar) window.votar(id, op); },
  // bajar hasta una sección del Inicio: viven en el shadow root, así que `#id` en la dirección no llega. Y las que se
  // mudaron del Inicio al hacerlo lobby (13/10/2026) van a su página nueva
  ir: (id) => {
    const h = document.getElementById('inicio-nuevo');
    const el = h && h.shadowRoot && h.shadowRoot.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else if (MUDADAS[id]) location.hash = MUDADAS[id];
  },
};

// 🚪 las secciones que se fueron del Inicio (13/10/2026) y dónde viven ahora
// 🗓️ `semana` no se mudó (18/11/2026): la Tira vive en el Inicio, pero el botón de la historia de cada servidor la pide
// con `{ ancla: 'semana' }` cuando no hay anuncio «Lunes de la Liga», y fuera del Inicio (#/sv/X) no hacía nada
const MUDADAS = { sebusca: '#/ranking/mw', panel: '#/ranking/misiones', encuestas: '#/publicaciones', merch: '#/tienda',
  numeros: '#/socios', semana: '#/' };

// la dirección de algo de la página, para compartirla (sirve también en las direcciones de prueba de Pages):
// «#/r/hassan» -> «https://…/freestyle-rap/r/hassan», con `urlLG()` del script del principio (web/montar.py)
// el estado de la campana de campana.js (`window.Campana`), que avisa con `lg:campana`: lo usan Eventos y Publicaciones
export function useCampana() {
  const leer = () => (window.Campana ? window.Campana.estado() : null);
  const [e, setE] = useState(leer);
  useEffect(() => {
    const f = () => setE(leer());
    window.addEventListener('lg:campana', f);
    const t = setTimeout(f, 600);
    return () => { window.removeEventListener('lg:campana', f); clearTimeout(t); };
  }, []);
  return e;
}

export const enlace = (ruta) => location.origin + (window.urlLG ? window.urlLG(ruta) : '/' + ruta);

// el historial de cada uno (`/api/perfiles`: sus eventos, sus duelos, lo que le falta, sus insignias), una vez: lo pide
// y lo guarda app.js (`perfiles()`). Lo usan Tarjetas y el perfil
// 📅 LOS DÍAS COMO GRILLA (Dlx, 19/10/2026, «me gustan todas», a «Habit Tracker Calendar» y «Activity Heatmap» de
// 21st): la racha en Tu cuenta es un calendario (filas = semanas, L a D, hoy al final) y los días que jugó alguien, en
// su perfil, un mapa de calor (columnas = semanas, como GitHub). Las dos usan esto. Los días son los del este, como los
// cuenta el servidor (`diaET()` en bot/avisos.js): un día que contó ahí tiene que caer en la misma casilla acá
export function diaET(t = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
}
export function masDias(dia, n) {
  const d = new Date(String(dia) + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function lunesDe(dia) {
  const d = new Date(String(dia) + 'T12:00:00Z');
  return masDias(dia, -((d.getUTCDay() + 6) % 7));
}
/** Las semanas enteras (lunes a domingo) que van de `desde` a `hasta`, como `[[iso×7], …]` */
export function semanasEntre(desde, hasta) {
  const out = [];
  for (let lun = lunesDe(desde); lun <= hasta; lun = masDias(lun, 7)) out.push([0, 1, 2, 3, 4, 5, 6].map((i) => masDias(lun, i)));
  return out;
}
const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const diaCorto = (iso) => Number(iso.slice(8, 10)) + ' ' + MES_CORTO[Number(iso.slice(5, 7)) - 1];
/**
 * La grilla. `semanas` de `semanasEntre()`; `marca(iso)` devuelve `{cls, t}` (clase y título) o nada; `hoy` lleva su
 * aro; lo que viene después de hoy queda apagado. `vertical`: filas = semanas (calendario); si no, columnas = semanas
 * (mapa de calor). `meses`: el nombre del mes cuando cambia, en el calendario
 */
export function GrillaDias({ semanas, marca, hoy, vertical = true, etiqueta }) {
  const L = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const celda = (iso) => {
    const m = iso <= hoy ? marca(iso) : null;
    const t = (m && m.t ? m.t + ' · ' : '') + diaCorto(iso) + (iso === hoy ? ' · hoy' : '');
    return <i key={iso} className={'gd-c' + (m && m.cls ? ' ' + m.cls : '') + (iso === hoy ? ' hoy' : '') + (iso > hoy ? ' fut' : '')} title={t} aria-label={t} role="img" />;
  };
  if (vertical) {
    return (
      <div className={'gd gd-v'} role="group" aria-label={etiqueta}>
        <div className="gd-l">{L.map((x, i) => <span key={i}>{x}</span>)}</div>
        {semanas.map((s) => <div className="gd-f" key={s[0]}><span className="gd-m">{s.some((d) => d.slice(8, 10) === '01' || d === semanas[0][0]) ? MES_CORTO[Number(s[6].slice(5, 7)) - 1] : ''}</span>{s.map(celda)}</div>)}
      </div>
    );
  }
  return (
    <div className="gd gd-h" role="group" aria-label={etiqueta}>
      <div className="gd-l">{L.map((x, i) => <span key={i}>{i % 2 === 0 ? x : ''}</span>)}</div>
      {semanas.map((s) => <div className="gd-col" key={s[0]} title={'Semana del ' + diaCorto(s[0])}>{s.map(celda)}</div>)}
    </div>
  );
}

export function usePerfiles() {
  // ⚡ con lo que ya se bajó (revisión del 18/11/2026): App vuelve a montar el perfil y el servidor por clave, y sin esto
  // cada cambio de persona o de servidor pasaba un cuadro por «Cargando…» con /api/perfiles ya en memoria
  const [p, setP] = useState(() => (typeof window !== 'undefined' && window.PERF && window.PERF.p ? window.PERF : null));
  useEffect(() => {
    if (typeof window.perfiles !== 'function') return undefined;
    // 🔁 SI FALLA, `false` Y OTRA VEZ (18/11/2026): pedía una sola vez y, si /api/perfiles fallaba (`perfiles()` de datos.js
    // da null), quedaba en null para siempre: el perfil del servidor en «Cargando…» hasta recargar. `false` es «falló»
    // (entidad2.jsx dibuja la rama sin bandas; `!P` lo trata igual que null) y se reintenta hasta 5 veces, más al volver
    // la red. `perfiles()` comparte un solo pedido en vuelo, así que varias instancias no lo multiplican
    let vivo = true, t = null, n = 0, listo = false, va = false;
    const pedir = () => {
      if (va) return;
      va = true;
      Promise.resolve(window.perfiles()).catch(() => null).then((d) => {
        va = false;
        if (!vivo) return;
        if (d) { listo = true; setP(d); return; }
        setP((x) => x || false);
        if (n < 5) { n += 1; t = setTimeout(pedir, 3000 * n); }
      });
    };
    pedir();
    const on = () => { if (vivo && !listo && n && !va) { clearTimeout(t); pedir(); } };
    window.addEventListener('online', on);
    // 🔁 Y A PEDIDO (21/11/2026, revisión de robustez): el «Reintentar» de quien muestra el `false` (el perfil) avisa
    // `reintentarPerfiles()`. Vuelve a «cargando» (`null`) mientras se pide —así se ve que hizo algo— y arranca de cero
    // la cuenta de reintentos solos. Si ya hay uno en vuelo no sale otro: contesta ése
    const otra = () => {
      if (!vivo || listo) return;
      clearTimeout(t);
      n = 0;
      setP((x) => (x === false ? null : x));
      pedir();
    };
    window.addEventListener('lg:perfiles-otra', otra);
    return () => {
      vivo = false; clearTimeout(t);
      window.removeEventListener('online', on); window.removeEventListener('lg:perfiles-otra', otra);
    };
  }, []);
  return p;
}
/** 🔁 que cada `usePerfiles()` que quedó en `false` (falló) vuelva a pedir /api/perfiles: el «Reintentar» del perfil */
export function reintentarPerfiles() {
  try { window.dispatchEvent(new Event('lg:perfiles-otra')); } catch (e) { /* nada */ }
}

// ── adónde lleva un evento en Discord. Dlx, 03/10/2026: «en vez de que sea el link del mensaje del anuncio, que sea el
// link de invitación al canal… el de inscripciones mejor… porque la gente no puede entrar de esa forma», y en la página
// también («2. A»): antes de empezar, «Inscribite ya» —la invitación al canal de inscripciones de ese evento, `ins`, de
// bot/subir_web.py—; en vivo, o sin ella, «Entrar al servidor». El link al mensaje, sólo sin ninguna invitación ──
// 🛡️ SÓLO `https:` (04/10/2026, la lista de seguridad de Dlx): React escapa el texto pero no frena un `javascript:` en
// un `href`. Hoy los links los arma el servidor con `https://` fijo; esto es por si un día no
export const https = (u) => (/^https:\/\//i.test(String(u || '')) ? String(u) : '');

// ── tocar la pestaña de la página en la que ya estás sube al principio (04/10/2026, de la lista de Dlx: «^ top button»).
// Sin botón nuevo, como Instagram: al fondo de las 200 filas del Ranking, un toque en «Ranking» y arriba. Si estás más
// adentro (un ranking puntual, un perfil), el link lleva a la página como siempre
export function subirSiEsta(r) {
  return (e) => {
    const u = window.urlLG ? window.urlLG(r) : r;
    if (u !== location.pathname + location.search || location.hash) return;
    e.preventDefault();
    const calma = document.documentElement.classList.contains('calma') ||
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    window.scrollTo({ top: 0, behavior: calma ? 'auto' : 'smooth' });
  };
}

// 🛡️ LO QUE GASTA O BORRA, CON UN SEGUNDO TOQUE (04/10/2026, la lista de seguridad de Dlx: «confirmation modals»).
// Sin ventana encima —la página ya tiene bastante—: el mismo botón dice `confirmar` durante 4 segundos, y recién el
// segundo toque hace. Es lo que ya hacen la foto y el servidor de la temporada
export function DosToques({ children, confirmar, onClick, className, disabled }) {
  const [pide, setPide] = useState(false);
  useEffect(() => {
    if (!pide) return undefined;
    const t = setTimeout(() => setPide(false), 4000);
    return () => clearTimeout(t);
  }, [pide]);
  return (
    <button type="button" className={(className || '') + (pide ? ' pide' : '')} disabled={disabled} aria-live="polite"
      onClick={() => { if (!pide) { setPide(true); return; } setPide(false); onClick(); }}>{pide ? confirmar : children}</button>
  );
}

export function aDiscord(liga, e, vivo) {
  if (!e) return null;
  const inv = https((((liga && liga.svs) || {})[e.sv] || {}).invita);
  if (!vivo && https(e.ins)) return { url: https(e.ins), txt: 'Inscríbete ya' };
  if (inv) return { url: inv, txt: 'Entrar al servidor' };
  return https(e.link) ? { url: https(e.link), txt: vivo ? 'Mirar en Discord' : 'Ver en Discord' } : null;
}

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
    <button type="button" className={cls + ' compartir' + (dijo ? ' dijo' : '')} onClick={dar} aria-live="polite" aria-label={etiqueta ? undefined : 'Compartir'}>
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
// `sinFoto`: la imagen para quien no tiene foto (la silueta del Ranking global, sin_foto.js); sin eso, la inicial como siempre
export function Cara({ liga, k, nombre, cls = 'cara', lazy = false, grande = false, sinFoto = '' }) {
  const [mal, setMal] = useState(null);
  // 🛍️ el aro y la decoración que se puso en la Tienda (tanda 3, puesto.js): una capa más grande que la cara, encima
  const P = usePuesto(k);
  const capaT = capaCara(P);
  // la de la tabla; si no está (corta en 200), la que viene aparte por nombre (`avNombre()`). `grande`: donde se dibuja
  // a más de ~130 px, la más grande que tenga Discord
  const t = grande ? 1024 : 256;
  const src = (k && liga.avUrl(k, t)) || (liga.avNombre ? liga.avNombre(nombre, t) : null);
  // `lazy` en las listas largas (el Ranking: 200 caras): sin eso el navegador pedía las 200 al abrir
  // 🪪 `data-fk`: quién es, para la ficha al pasar el mouse (ficha.jsx). Un solo oyente para toda la página
  // `con-aro`: el aro de la Tienda reemplaza al dorado del premium (no van dos anillos)
  const cl = capaT ? cls + ' con-tienda' + (tieneAro(P) ? ' con-aro' : '') : cls;
  const envuelve = (x) => (capaT ? <span className="ct-in">{x}{capaT}</span> : x);
  if (src && mal !== src) return <span className={cl} data-fk={k || undefined}>{envuelve(<img alt="" src={src} loading={lazy ? 'lazy' : undefined} decoding={lazy ? 'async' : undefined} onError={() => setMal(src)} />)}</span>;
  if (sinFoto) return <span className={cl + ' sil'} data-fk={k || undefined}>{envuelve(<img alt="" src={sinFoto} loading={lazy ? 'lazy' : undefined} decoding="async" />)}</span>;
  return <span className={cl + ' ini'} data-fk={k || undefined}>{envuelve((limpio(nombre).slice(0, 1) || '?').toUpperCase())}</span>;
}

// 🪪 UN NOMBRE CON SU CARA Y SU PERFIL (Dlx, 17/11/2026: «hay lugares donde aparecen nombres como ellos lo escriben, si
// alguien escribe velatzzzz, debería mostrarse con su aka oficial, Velatz… y hazlo más bonito con su foto y su cuenta»;
// «dale, hazlo en todas partes»). `nombre` es el que vino —de una llave, del muro, de lo en vivo— y `k` la clave si se
// sabe: dibuja la cara, el nombre oficial y el link a su perfil (`liga.quien()`). Sin nadie detrás, el nombre como lo
// escribieron, sin link (con la cara sólo si es de quien jugó y quedó fuera de la tabla, `avNombre()`).
// `chip`: con borde, para una fila de nombres. `cara={false}`: sólo el nombre, donde no entra. `link={false}`: adentro de
// algo que ya se toca —un link adentro de otro link o de un botón no vale, y el click lo ataja el script del principio:
// frenarlo rompería la navegación—. `cap`: el que no se reconoce va con la inicial en mayúscula, como en la llave.
// El texto solo (un título, un `aria-label`, lo que se comparte) es `liga.aka(nombre, k)`
export function Alguien({ liga, nombre, k, cara = true, link = true, chip = false, cap = false, cls = '' }) {
  const s = String(nombre || '');
  const f = liga ? liga.quien(s, k) : null;
  // 🛍️ el efecto de nombre de la Tienda (tanda 3): sólo con su nombre oficial, el de alguien que la Liga conoce
  const P = usePuesto(f ? f.k : '');
  // un equipo («A & B», y en una llave en vivo «A, B»), de a uno: cada cual con su cara y su perfil
  // (y «A | B», como escriben algunas llaves de equipos)
  const eq = f ? '' : / & /.test(s) ? ' & ' : /[,|]/.test(s) ? ' y ' : '';
  if (eq) {
    const ps = s.split(eq === ' & ' ? /\s+&\s+/ : /\s*[,|]\s*/).filter((x) => limpio(x));
    if (ps.length > 1) {
      return <>{ps.map((x, i) => <Fragment key={i}>{i ? eq : null}
        <Alguien liga={liga} nombre={x} cara={cara} link={link} chip={chip} cap={cap} cls={cls} /></Fragment>)}</>;
    }
  }
  const n = f ? limpio(f.n) : cap ? capital(limpio(s)) : limpio(s);
  if (!n) return null;
  const conCara = cara && !!(f || (liga && liga.avNombre && liga.avNombre(s)));
  const cz = conCara ? <Cara liga={liga} k={f ? f.k : ''} nombre={f ? f.n : s} cls="cara qn-c" /> : null;
  // 🔗 LA CARA VA PEGADA A LA PRIMERA PALABRA (`qn-u`, sin corte): en el celular «…participaciones.(cara)» quedaba al final
  // de un renglón y «BTRX» en el siguiente (medido a 390 px; el unidor de palabras U+2060 no frena el corte después de
  // una imagen). En la ficha no hace falta: es una fila flexible
  const m = cz && !chip ? /^(\S+)([\s\S]*)$/.exec(n) : null;
  const nt = f ? nombreTienda(P, n) : null;
  const cuerpo = nt ? <>{cz}<bdi className="qn-n">{nt}</bdi></>
    : m ? <bdi className="qn-n"><bdi className="qn-u">{cz}{m[1]}</bdi>{m[2]}</bdi> : <>{cz}<bdi className="qn-n">{n}</bdi></>;
  const clase = 'qn' + (chip ? ' qn-chip' : '') + (conCara ? ' qn-con' : '') + (f ? '' : ' qn-sin') + (cls ? ' ' + cls : '');
  // `bdi` y no `span`: aísla un nombre escrito de derecha a izquierda, y las reglas de cada lugar que pintan sus `span`
  // («.evs-c span», «.st-gente span»…) no le caen encima
  if (f && f.k && link) return <a className={clase} href={'#/r/' + encodeURIComponent(f.k)}>{cuerpo}</a>;
  return <bdi className={clase}>{cuerpo}</bdi>;
}
// varios, con «y» antes del último: «Velatz, Oasis y Konan» (`sep` entre los demás)
export function Algunos({ liga, nombres, ks = [], y = ' y ', sep = ', ', ...resto }) {
  const xs = (nombres || []).map((x, i) => [x, ks[i]]).filter(([x, kk]) => limpio(x) || kk);
  return <>{xs.map(([x, kk], i) => <Fragment key={i}>{i ? (i === xs.length - 1 ? y : sep) : null}
    <Alguien liga={liga} nombre={x} k={kk} {...resto} /></Fragment>)}</>;
}

// 📐 `cual`: la caja punteada mide lo que mediría esa carta (revisión 22/11/2026, G5#10): con la proporción de la Temporada,
// en Costa Rica «SIN CARTA» quedaba 35 px más alta que las cartas de País de al lado
export function SinCarta({ liga, k, nombre, cc, cls = 'ci', cual = '' }) {
  const n = limpio(nombre);
  // 🔤 LA PALABRA MÁS LARGA, PORQUE UNA SOLA NO SE PARTE (16/11/2026): «LEANDROKATANA» medía 164 px en una carta de 132 y
  // la sacaba de la pantalla en Competencias. Va en `--n` y `sc-largo`; cada página decide si la usa (hoy, competencias.css)
  const w = Math.max(0, ...n.split(/\s+/).map((x) => x.length));
  return (
    <div className={cls + ' sincarta' + (cual ? ' sc-' + cual : '')}>
      <Cara liga={liga} k={k} nombre={nombre} cls="sc-cara" />
      <b className={w >= 9 ? 'sc-largo' : undefined} style={w >= 9 ? { '--n': w } : undefined}>{n}</b>
      <Bandera cc={cc} cls="sc-flag" />
      <small>SIN CARTA</small>
    </div>
  );
}

// una carta de verdad (de R2) o, si esa persona no la tiene, su cara con «SIN CARTA». Nunca una carta inventada.
// `nombre`: el que va en «SIN CARTA» cuando la persona no está en la tabla (si no, sale la clave: «leandrokatana»)
export function Carta({ liga, k, cual = 'temporada', cls = 'ci', abre = true, marco, nombre }) {
  const [fallo, setFallo] = useState({ src: null, n: 0 });
  const pub = usePases();
  // 🛍️ el efecto de carta de la Tienda (tanda 3): una capa encima de la imagen, adentro del marco del Pase si lo tiene
  const P = usePuesto(k);
  // el ancho en que se dibuja, en píxeles de pantalla: 0 todavía no se midió, -1 no se pudo (va la grande)
  const [ancho, setAncho] = useState(0);
  const ref = useRef(null);
  // 🔴 TAMBIÉN QUIEN NO ESTÁ EN LA TABLA (`liga.X`, 26/10/2026): `cartaUrl()` ya lo encontraba ahí, y con la imagen y
  // sin la fila, `f.n` rompía la página entera (el Inventario de Dlx: «dice que no pudo cargar la página»)
  // 👥 y quien está fuera de las 200 filas con su fila entera (`persona()`: la tabla, un perfil abierto o /api/perfiles,
  // 18/11/2026): `cartaUrl()` ya lo veía ahí y esto no, así que salía «<clave> · SIN CARTA» con la carta subida
  const f = (liga.persona ? liga.persona(k) : liga.T[k] || (liga.X && liga.X[k])) || null;
  const src0 = f ? liga.cartaUrl(k, cual) : null;
  // las fallas cuentan para ESA dirección: una carta nueva (otra `?v=`) se vuelve a intentar
  const fallas = fallo.src === src0 ? fallo.n : 0;
  // 🃏 LA CHICA DONDE SE DIBUJA EN CHICO (Dlx, 19/10/2026: «dale»). Se mide ANTES de pintar (el img todavía sin `src`
  // ocupa el ancho que le da su CSS) y se elige: la de 300 px (~22 KB) si alcanza para ese ancho por la densidad de la
  // pantalla, si no la grande (~150). Sin ancho propio —un img sin `src` mide 0— va la grande, como siempre.
  // 🔴 NO `sizes="auto"`: el navegador le pone `contain: size` con 300×150 de tamaño propio (la regla es del estándar y
  // con !important: no se puede pisar), y toda carta de alto automático salía de 150 px, aplastada o recortada. Pasó
  // en producción unas horas del 19/10/2026 (Dlx: «mirá cómo quedó esta parte»: Lo último y Los que mandan)
  useLayoutEffect(() => {
    if (ancho || !ref.current) return;
    const w = ref.current.getBoundingClientRect().width;
    setAncho(w > 0 ? w * Math.max(1, window.devicePixelRatio || 1) : -1);
  }, [ancho, src0]);
  if (!src0 || fallas > 1) return <SinCarta liga={liga} k={k} nombre={f ? f.n : (liga.nombreDe ? liga.nombreDe(k, nombre) : nombre || k)} cc={f ? f.cc : ''} cls={cls} cual={cual} />;
  // 🔴 una carta que no carga (R2 corta a veces) mostraba el ícono de imagen rota: se reintenta una vez y, si
  // vuelve a fallar, la cara con «SIN CARTA» (revisión del 30/09/2026). Si falla la chica, entra la grande
  const grande = fallas ? src0 + (src0.indexOf('?') < 0 ? '?' : '&') + 'r=1' : src0;
  const chica = fallas ? null : liga.cartaUrl(k, cual, true);
  const src = !ancho ? undefined : chica && ancho > 0 && ancho <= 300 ? chica : grande;
  // (sin `src`, el alt vacío: si no, el navegador dibuja el texto y lo que se mide es el texto)
  const img0 = <img ref={ref} className={cls} alt={src ? 'Carta ' + cual + ' de ' + f.n : ''} src={src} loading="lazy"
    onError={() => setTimeout(() => setFallo((x) => ({ src: src0, n: (x.src === src0 ? x.n : 0) + 1 })), fallas ? 0 : 1200)} />;
  // 🖼️ su marco, si lo tiene (sólo con el ancho ya medido: chica o completa sale de eso)
  // `marco`: el que se está probando en el Inventario (`[marco, estilo, serie]`, o `null` sin marco); si no, el que tiene puesto
  const mk = marco !== undefined ? marco : pub && pub.m && pub.m[k];
  const css = ancho > 0 ? ancho / Math.max(1, window.devicePixelRatio || 1) : 0;
  const svc = f.sv && liga.svs && liga.svs[f.sv] ? liga.svs[f.sv].color : '';
  const conFx = src ? <ConEfecto P={P} src={src}>{img0}</ConEfecto> : img0;
  const img = mk && css ? <ConMarco m={mk} cual={cual} ancho={css} svColor={svc} cc={f.cc} src={src}>{conFx}</ConMarco> : conFx;
  if (!abre) return img;
  // 🃏 con `cual`: abre en ESA carta y no en la principal (Dlx, 17/11/2026: «si selecciono una tarjeta diferente, que lo
  // primero que me muestre sea esa misma que presioné»)
  return <button type="button" className="sin-boton" onClick={() => accion.carta(k, cual)} aria-label={'Ver la carta de ' + f.n}>{img}</button>;
}

export function Rango({ liga, rg }) {
  if (!rg) return <span className="rg sinl" title="Sin letra: le faltan eventos">–</span>;
  return <span className="rg" style={{ background: liga.colorRg(rg) }}>{rg}</span>;
}

export const nombrePais = (cc) => PAIS[cc] || String(cc || '').toUpperCase();

// 🙋 LOS ANOTADOS DE UN EVENTO, ANTES DE LA LLAVE (03/10/2026, Dlx: «Me gusta tu A»): «12 anotados» con las caras y, al
// tocar, quiénes. Va en la tarjeta del evento —el Próximo del Inicio y Eventos— hasta que aparece la llave, que lo
// reemplaza. Sin anotados, no se dibuja (`liga.anotados()`)
// ➕ «+N MÁS» EN UNA FILA DE FICHAS (Dlx, 19/10/2026, «me gustan todas», a «Chip Group» de 21st): una fila de filtros
// que se envuelve en tres renglones en el celular muestra los primeros `max` y un «+N más» que abre el resto. Si el
// elegido (`className` con `on`) quedó escondido, se abre solo: nunca un filtro activo invisible
export function ConMas({ max = 4, children }) {
  const [abierto, setAbierto] = useState(false);
  const todos = Children.toArray(children).filter(Boolean);
  const activoEscondido = todos.slice(max).some((c) => c && c.props && /\bon\b/.test(String(c.props.className || '')));
  if (todos.length <= max + 1 || abierto || activoEscondido) return <>{todos}</>;
  return (
    <>
      {todos.slice(0, max)}
      <button type="button" className="mas-b" onClick={() => setAbierto(true)} aria-label={'Ver ' + (todos.length - max) + ' filtros más'}>
        +{todos.length - max} más</button>
    </>
  );
}

// 🫙 UN VACÍO CON QUÉ HACER (Dlx, 19/10/2026, «me gustan todas», a «Empty» de 21st): en vez de una línea gris, qué pasó y
// uno o dos botones para salir de ahí. `acciones`: `[[texto, href o función, clase?]]`
export function Vacio({ titulo, texto, acciones = [] }) {
  return (
    <div className="vacio-c" role="status">
      {titulo ? <b>{titulo}</b> : null}
      {texto ? <p>{texto}</p> : null}
      {acciones.length ? (
        <div className="vacio-acc">{acciones.map(([t, a, cls]) => (typeof a === 'function'
          ? <button key={t} type="button" className={'btn chico ' + (cls || 'verde')} onClick={a}>{t}</button>
          : <a key={t} className={'btn chico ' + (cls || 'verde')} href={a}>{t}</a>))}</div>
      ) : null}
    </div>
  );
}

export function Anotados({ liga, e }) {
  const [ver, setVer] = useState(false);
  const l = liga.anotados(e);
  if (!l.length) return null;
  const cara = (x, i, cls) => <Cara key={i} liga={liga} k={x.f ? x.f.k : ''} nombre={x.f ? x.f.n : x.aka} cls={cls} />;
  return (
    <div className={'an' + (ver ? ' abierto' : '')}>
      <button type="button" className="an-b" aria-expanded={ver} onClick={() => setVer(!ver)}>
        <span className="an-caras" aria-hidden="true">{l.slice(0, 5).map((x, i) => cara(x, i, 'an-cara'))}</span>
        <b>{l.length} {l.length === 1 ? 'anotado' : 'anotados'}</b>
        <small>{ver ? 'cerrar' : 'ver quiénes'}</small>
      </button>
      {ver ? (
        <ul className="an-l">
          {l.map((x, i) => {
            const cc = x.f ? x.f.cc : (PAIS[x.cc] ? x.cc : '');
            const dentro = <>{cara(x, i, 'an-cara')}<span>{x.f ? limpio(x.f.n) : x.aka}</span>{cc ? <Bandera cc={cc} cls="an-flag" /> : null}</>;
            return <li key={i}>{x.f ? <a href={'#/r/' + encodeURIComponent(x.f.k)}>{dentro}</a> : <span className="an-n">{dentro}</span>}</li>;
          })}
        </ul>
      ) : null}
    </div>
  );
}

// ── ❔ «¿QUÉ ES?» A UN TOQUE (Dlx, 12/10/2026, el research «página sencilla»: «hacé todo menos los dos puntos que
// chocan»). Cinco sistemas de números son más de lo que alguien nuevo retiene a la vez: al lado de cada uno, un «?» que
// abre UNA línea donde está el número, y otro toque la cierra. Nunca un tercer nivel. Los textos son los de la Guía
export const QUE_ES_NUM = {
  ovr: 'OVR: el número de la temporada, de 40 a 99. Ordena el ranking y es el que lleva la tarjeta de Temporada.',
  rango: 'Rango: la letra, de E a SSS. Sale del Score del Competitivo y aparece con 10 eventos en la temporada.',
  puntos: 'Puntos: los de la temporada. Cada evento suma según el puesto y cuánta gente jugó.',
  eventos: 'Eventos: los de la Liga que jugó en la temporada, ganara o perdiera.',
  win: 'Win%: duelos ganados sobre duelos jugados. Aparece con 10 eventos.',
};
/** El «?» de un número. `abierto` y `onToggle` los maneja quien muestra el texto (`QueEsTexto`), una vez por bloque. */
export function QueEsBoton({ k, abierto, onToggle }) {
  if (!QUE_ES_NUM[k]) return null;
  return (
    <button type="button" className={'qe-b' + (abierto ? ' on' : '')} aria-expanded={!!abierto}
      aria-label={abierto ? 'Cerrar la explicación' : '¿Qué es?'} onClick={onToggle}>?</button>
  );
}
/** La línea del número abierto, o nada. */
export function QueEsTexto({ k }) {
  return k && QUE_ES_NUM[k] ? <p className="qe-t" role="note">{QUE_ES_NUM[k]}</p> : null;
}

// una sección con su título y el link de la derecha
// 🗣️ `bajada`: una línea en palabras comunes debajo del título, para los nombres propios de la Liga («Se busca», «Los que
// mandan»). Dlx, 12/10/2026, el research «página sencilla»: quien llega no sabe qué hay detrás de un nombre inventado
export function Sec({ id, titulo, bajada, enlace, href, onEnlace, extra = '', children, ...resto }) {
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
      {bajada ? <p className="sec-baj">{bajada}</p> : null}
      {children}
    </section>
  );
}

// una sección con pestañas y flechas (Dlx, 29/09: «Los que mandan» y el panel de abajo). En el celular, un paginador
// ‹ selector ›. Con `titulos`, el título de la sección es el de la pestaña que se ve.
export function Pest({ id, titulo, bajada, enlace, href, onEnlace, items, extra = '', titulos = false }) {
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
    <Sec id={id} titulo={titulos ? items[i].t : titulo} bajada={bajada} enlace={enlace} href={href} onEnlace={onEnlace} extra={'pest ' + extra}
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
    const por = ((b.c || {}).por || []).map((p) => liga.aka(p.n, p.k)).join(' y ');
    sello = <span className="p-sello">CAZADO</span>; cls = 'hecho'; pie = 'por ' + por + ' · cobró ' + num(b.v);
  } else if (b.e === 'escondio') {
    sello = <span className="p-sello gris">SE ESCONDIÓ</span>; cls = 'hecho'; pie = 'no jugó: nadie cobró';
  }
  // 18/11/2026: sin clave (el nombre no está en `gente`: 4 de 30 afiches hoy), sin link, como `Alguien`. Antes iba a
  // «#/r/», que cae al Inicio a media página y con el título de la pestaña anterior
  const Tag = b.k ? 'a' : 'div';
  return (
    <Tag className={'poster ' + cls} href={b.k ? '#/r/' + encodeURIComponent(b.k) : undefined}>
      <span className="p-t">SE BUSCA</span>
      <span className="p-fw"><Cara liga={liga} k={b.k} nombre={b.n} cls="p-foto" />{sello}</span>
      <b>{limpio(b.n)}</b><span className="p-cat">{String(b.cn || '').toUpperCase()}</span>
      <span className="p-precio">{num(b.v)} PTS</span><small>{pie}</small>
    </Tag>
  );
}

// ✍️ LO QUE FALTA PARA UNA TARJETA: cada condición con su barra y, si falta, qué es y cómo se consigue, dicho para alguien
// nuevo (`requisitos.js`; Dlx, 07/10/2026: «sé más descriptivo»). La usan el perfil y «Las tuyas» de Tarjetas.
// `q`: `[[lleva, pide, ETIQUETA], …]` de `req` (/api/perfiles); `tu`: si es la persona que mira
export function FaltaLista({ q, tu }) {
  return (
    <ul className="tj-falta">
      {q.map((x) => {
        const pct = Math.max(0, Math.min(100, Math.round((100 * x[0]) / (x[1] || 1))));
        const fr = RQ.falta(x[2], x[0], x[1], tu);
        return (
          <li key={x[2]} className={x[0] >= x[1] ? 'ok' : ''}>
            <span>{Math.min(x[0], x[1])}/{x[1]} {String(x[2]).toLowerCase()}</span>
            <i><u style={{ width: pct + '%' }} /></i>
            {fr ? <em>{fr}</em> : null}
          </li>
        );
      })}
    </ul>
  );
}

// ── 📣 ABRIR UNA PROMO PAGA (Dlx, 16/10/2026: «detectá cuando da click en ir al enlace de la promo», 50 Puntos de Tienda
// y XP del Pase, hasta 3 por día). Se avisa al abrir el video o el link —desde Publicaciones, un perfil, un servidor o las
// historias—; quién lo dice la sesión de Discord y qué promo, el muro (`validarPromo()` en bot/avisos.js). Sin cuenta no
// pasa nada: `conCuenta` sin modo nunca saca de la página ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function promoAbierta(id) {
  if (!id || !window.conCuenta || !window.DC) return;
  window.conCuenta('/api/avisos/promo-vio', { id }).then((j) => {
    if (j && j.ok && j.nuevo) window.dispatchEvent(new CustomEvent('lg:promo', { detail: j }));
  }).catch(() => { /* sin premio esta vez: la promo igual se abre */ });
}
// el aviso de lo que pagó, unos segundos abajo de todo
export function AvisoPromo() {
  const [x, setX] = useState(null);
  useEffect(() => {
    const f = (e) => setX(e.detail || null);
    window.addEventListener('lg:promo', f);
    return () => window.removeEventListener('lg:promo', f);
  }, []);
  useEffect(() => {
    if (!x) return undefined;
    const t = setTimeout(() => setX(null), 4500);
    return () => clearTimeout(t);
  }, [x]);
  if (!x) return null;
  const quedan = Math.max(0, (x.tope || 3) - (x.hoy || 0));
  return (
    <div className="promo-pago" role="status">
      {x.pago ? <><b>+{x.pago} Puntos de Tienda</b> por abrir una promo{quedan ? ' · ' + quedan + ' más hoy' : ' · listo por hoy'}</>
        : <>Ya abriste {x.tope || 3} promos hoy: mañana vuelven a pagar</>}
    </div>
  );
}
