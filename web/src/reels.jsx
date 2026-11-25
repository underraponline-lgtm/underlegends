// 🎬 REELS (24/11/2026). Dlx: «¿y si creamos una opción de reels? Ahí al costado de rankings… que al inicio cargue por
// default unos 5 y que si se sigue se abran 3 más». De las maquetas eligió la E en el celular y la D en la compu: «E celular
// y D computadora», y a la E le sumó «que aún así estén algunos íconos al costado, que haya ese efecto de teatro de YouTube».
//
// 🔑 NADA NUESTRO ENCIMA DEL REPRODUCTOR DE YOUTUBE. Lo piden sus reglas (Required Minimum Functionality: ningún botón,
// texto ni capa delante de ninguna parte del reproductor). Por eso el celular tiene dos estados:
//   · CORRIENDO (modo teatro): el video un poco más chico, la luz de sus colores alrededor y lo nuestro AFUERA del video
//     (las líneas a la izquierda, unos íconos a la derecha, los nombres abajo).
//   · EN PAUSA = EL MENÚ: tocar el video lo pausa (lo hace YouTube y nos avisa); ahí el reproductor se ESCONDE y en su lugar
//     va la miniatura a pantalla completa, con todo el menú encima. ▶ lo vuelve a mostrar donde quedó.
// Nunca hay un elemento nuestro sobre el reproductor a la vista.
//
// 🔑 UN SOLO REPRODUCTOR PARA TODO EL FEED, Y ARRANCA SOLO (8.11, Dlx: «necesito que los 5 reels primero ya estén
// cargados, o sea si uno abre la página de reels, ésta se abre automáticamente»). Al abrir Reels el reproductor se crea
// enseguida y el primero corre SIN SONIDO: los navegadores no dejan que un video suene solo, y mudo sí (en el iPhone,
// además, `playsinline`). Arriba queda «Toca para el sonido». Es la excepción a «nada de YouTube antes de tocar ▶» de
// video.jsx: acá abrir la página ES pedir el video. Para pasar de reel se le manda `loadVideoById`. Se habla con él por postMessage
// (`enablejsapi=1`), sin el script de la API: la CSP no deja cargar scripts de youtube.com.
//
// 🔑 EL ORDEN SIN RECOMENDADOR (el research del 24/11): nunca dos seguidos del mismo canal ni de la misma persona, uno de
// cada cuatro de las plazas, lo ya visto al final y menos del canal que marcaste «No me interesa». Se ven 5 y, cuando te
// acercas al final, se suman 3 (las líneas de la izquierda).
//
// ⚠️ VER REELS NO DA NADA: ni Puntos de Tienda ni misiones (Developer Policies de YouTube, III.F.3.c). El Fuego y Guardar
// viven en este navegador.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Bandera, Cara as CaraLiga, nombrePais } from './piezas.jsx';
import { aQuienSigo } from './liga.js';
import { abrirVideo } from './video.jsx';
import { GRUPO, nombre, preparar, useGlobal } from './global.jsx';
import CSS from './css/reels.css?inline';
import { usarCss } from './css.js';

usarCss('reels', CSS);

const ORIGEN_YT = 'https://www.youtube-nocookie.com';
const VER = 5;
const MAS = 3;
const ls = {
  json(k, d) { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin guardar: vale para esta visita */ } },
};
const L_VISTOS = 'lg:reels-vistos';
const L_MENOS = 'lg:reels-menos';
const L_GUARDO = 'lg:reels-guardados';
const L_FUEGO = 'lg:reels-fuego';
// ⭐ a quién sigues del Ranking global (los Pro no tienen perfil en la Liga: se siguen en este navegador). Los de la Liga se
// siguen con el «Seguir» de siempre (`alternarSigo()` de social.js: el navegador y, si entraste, tu cuenta)
const L_SIGO_G = 'lg:reels-sigo';
const limpio2 = (s) => String(s || '').replace(/[^\p{L}\p{N}\s]/gu, '').trim();
const inicial = (g) => ([...limpio2(g.n)][0] || '?').toUpperCase();
const puestoDe = (g) => (g.liga ? 'Liga' + (g.sv ? ' · ' + g.sv : '') : (g.pos ? '#' + g.pos + ' ' : '') + (GRUPO[g.esc] || ''));
// adónde lleva su nombre: su perfil de la Liga o su ficha del Ranking global
const perfilDe = (g) => (g.liga ? '#/r/' + g.lk : '#/global/' + g.k);
// la clave con la que se lo sigue en la Liga (los de la Liga, y los del global que también juegan acá: `hk`)
const claveLiga = (g) => (g.liga ? g.lk : g.hk || '');
// quién es, para juntar sus reels (los de la Liga y los del global tienen claves de lugares distintos)
const idDe = (g) => (g.liga ? 'l:' + g.lk : g.k);
const linkDe = (vid) => 'https://underlegends.pages.dev/freestyle-rap/reels/' + vid;

/** todos los shorts, uno por video, con todos los que nombra: los del Ranking global (`/global.json`) y los de los canales de
 *  los socios (`/liga_shorts.json`, bot/liga_shorts.py: la mejora 3, «que la gente se vea entre los pros») */
function armar(X, D, L) {
  const cs = (D && D.cs) || [];
  const m = new Map();
  if (L && Array.isArray(L.g)) {
    const csl = L.cs || [];
    const porL = new Map(L.g.map((g) => [g.k, { k: 'liga:' + g.k, lk: g.k, n: g.n, cc: g.cc || '', sv: g.sv || '', esc: 'liga', liga: true, pos: 0 }]));
    for (const g of L.g) {
      for (const s of g.vs || []) {
        if (m.has(s[0])) continue;
        const ks = [g.k, ...(s[2] || [])].filter((k, j, a) => porL.has(k) && a.indexOf(k) === j);
        m.set(s[0], { vid: s[0], canal: csl[s[1]] || '', t: s[3] || '', ks: ks.map((k) => 'liga:' + k), gente0: ks.map((k) => porL.get(k)), orden: m.size, deLiga: true });
      }
    }
  }
  for (const g of X.G) {
    for (const s of g.vs || []) {
      let r = m.get(s[0]);
      if (!r) { r = { vid: s[0], canal: cs[s[1]] || '', t: s[3] || '', ks: [], orden: m.size }; m.set(s[0], r); }
      if (r.deLiga) continue;
      for (const k of [g.k, ...(s[2] || [])]) if (k && !r.ks.includes(k) && X.porK.has(k)) r.ks.push(k);
    }
  }
  const xs = [...m.values()].map((r) => ({ ...r, gente: r.gente0 || r.ks.map((k) => X.porK.get(k)).filter(Boolean) })).filter((r) => r.gente.length);
  // 🔁 POR RONDAS: uno de cada persona y después el segundo de cada una. En el orden de la tabla, los de Mecha salían uno
  // de cada dos (medido: 3 de los primeros 5)
  const vueltas = new Map();
  for (const r of xs) {
    const k = r.gente[0].k;
    const n = vueltas.get(k) || 0;
    vueltas.set(k, n + 1);
    r.ronda = n;
  }
  xs.sort((a, b) => a.ronda - b.ronda || a.orden - b.orden);
  xs.forEach((r, j) => { r.orden = j; });
  return xs;
}
const deLaLiga = (r) => r.gente.some((g) => g.liga);
const dePlaza = (r) => r.gente.some((g) => g.esc !== 'pro');

/** el feed en orden: lo no visto primero, sin repetir canal ni persona seguidos, y uno de cada cuatro de las plazas */
function ordenar(xs, vistos, menos, notas) {
  const v = new Set(vistos);
  const mn = new Set(menos);
  const peso = (r) => (v.has(r.vid) ? 2 : 0) + (mn.has(r.canal) ? 1 : 0);
  // 📊 la nota de cada reel, de lo que mira la gente en la página (`/api/avisos/reels-stats`, los últimos 7 días): los que se
  // ven enteros suben y los que se pasan en los primeros 3 segundos bajan, DENTRO de su ronda (no le gana a la variedad).
  // Con menos de 5 vistas no hay nota: no se sabe
  const nota = (r) => { const x = notas && notas[r.vid]; return x && x[0] >= 5 ? (x[3] - x[2]) / x[0] : 0; };
  const resto = xs.slice().sort((a, b) => peso(a) - peso(b) || a.ronda - b.ronda || nota(b) - nota(a) || a.orden - b.orden);
  const out = [];
  while (resto.length) {
    const ant = out[out.length - 1];
    const quiere = (out.length + 1) % 4 === 0;
    const choca = (r) => ant && (r.canal === ant.canal || r.ks.some((k) => ant.ks.includes(k)));
    const nivel = peso(resto[0]);
    let j = quiere ? resto.findIndex((r) => peso(r) === nivel && dePlaza(r) && !choca(r)) : -1;
    if (j < 0) j = resto.findIndex((r) => !choca(r));
    if (j < 0) j = 0;
    out.push(resto.splice(j, 1)[0]);
  }
  return out;
}

/** la miniatura parada (oar2, 1080×1920); si no existe, la ancha */
function Poster({ vid, cls, alt = '' }) {
  return (
    <img className={cls} alt={alt} src={'https://i.ytimg.com/vi/' + vid + '/oar2.jpg'} decoding="async"
      onLoad={(e) => { if (e.currentTarget.naturalWidth <= 120 && !e.currentTarget.dataset.atras) { e.currentTarget.dataset.atras = '1'; e.currentTarget.src = 'https://i.ytimg.com/vi/' + vid + '/hqdefault.jpg'; } }}
      onError={(e) => { if (!e.currentTarget.dataset.atras) { e.currentTarget.dataset.atras = '1'; e.currentTarget.src = 'https://i.ytimg.com/vi/' + vid + '/hqdefault.jpg'; } }} />
  );
}
function Cara({ g, cls, liga }) {
  const [mal, setMal] = useState('');
  // los de la Liga, con su cara de la Liga (`Cara` de piezas.jsx: su foto o su inicial)
  if (g.liga && liga) return <span className={cls + ' lg'}><CaraLiga liga={liga} k={g.lk} nombre={g.n} cls="rls-cara-lg" /></span>;
  const src = [g.ft, g.fr].find((u) => u && u !== mal) || '';
  if (src) return <img className={cls} alt="" src={src} onError={() => setMal(src)} />;
  return <span className={cls + ' ini'}>{inicial(g)}</span>;
}

// ── los íconos, en trazo ──
const I = {
  fuego: <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 2 3 3 3 0-3-1-5 0-8z" />,
  guardar: <path d="M6 3h12v18l-6-4-6 4z" />,
  enviar: <path d="M22 3 11 14M22 3l-7 19-4-8-8-4z" />,
  batalla: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="m10 9 5 3-5 3z" /></>,
  mas: <><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></>,
  play: <path d="M8 5v14l11-7z" />,
  arriba: <path d="m18 15-6-6-6 6" />,
  abajo: <path d="m6 9 6 6 6-6" />,
  sonido: <><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" /></>,
  mudo: <><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M23 9l-6 6M17 9l6 6" /></>,
  copiar: <path d="M9 9h11v11H9zM5 15V4h11" />,
  listo: <path d="M5 12l5 5 9-10" />,
  no: <><circle cx="12" cy="12" r="9" /><path d="m6 6 12 12" /></>,
  yt: <><rect x="2" y="5" width="20" height="14" rx="3" /><path d="m10 9 5 3-5 3z" /></>,
  persona: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  x: <path d="M6 6l12 12M18 6 6 18" />,
};
function Ico({ n, lleno = false, t = 24 }) {
  const relleno = lleno || n === 'mas' || n === 'play';
  return (
    <svg width={t} height={t} viewBox="0 0 24 24" fill={relleno ? 'currentColor' : 'none'} stroke={n === 'mas' || n === 'play' ? 'none' : 'currentColor'}
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[n]}</svg>
  );
}

// ── lo que se mira (la mejora 5): cuántos segundos de cada reel, si se pasó en los primeros 3 y si llegó al final. Se junta en
// el navegador y sale de a tandas (cada 20 s y al irse), como los toques (`contarClic` de App.jsx): un reel no es un pedido.
// Son números de esta página, no de YouTube, y no dan nada a nadie ──
const MIRA = {};
let miraReloj = 0;
function soltarMira() {
  const ks = Object.keys(MIRA);
  if (!ks.length) return;
  const v = {};
  for (const k of ks.slice(0, 30)) { v[k] = MIRA[k]; delete MIRA[k]; }
  const cuerpo = JSON.stringify({ v });
  try {
    if (navigator.sendBeacon && navigator.sendBeacon('/api/avisos/reels-vistos', new Blob([cuerpo], { type: 'application/json' }))) return;
  } catch (e) { /* y por fetch */ }
  fetch('/api/avisos/reels-vistos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: cuerpo, keepalive: true }).catch(() => {});
}
function anotarMira(vid, seg, fin) {
  if (!vid) return;
  const x = MIRA[vid] || [0, 0, 0];
  x[0] = Math.min(600, x[0] + Math.round(seg));
  x[1] = !fin && seg < 3 ? 1 : x[1];
  x[2] = fin ? 1 : x[2];
  MIRA[vid] = x;
  clearTimeout(miraReloj);
  miraReloj = setTimeout(soltarMira, 20000);
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', soltarMira);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') soltarMira(); });
}

// ── el reproductor: uno solo, por postMessage ──
function useReproductor({ alTerminar, alPausar, alCorrer }) {
  const marco = useRef(null);
  const listo = useRef(false);
  const cola = useRef([]);
  const [vid, setVid] = useState('');
  const [mudo, setMudo] = useState(false);
  const [nacioMudo, setNacioMudo] = useState(false);
  const cb = useRef({ alTerminar, alPausar, alCorrer });
  cb.current = { alTerminar, alPausar, alCorrer };
  // 📊 el reel que está puesto, desde cuándo corre y cuánto lleva
  const mira = useRef({ vid: '', desde: 0, seg: 0, fin: false });
  const cerrarMira = () => {
    const m = mira.current;
    if (!m.vid) return;
    const seg = m.seg + (m.desde ? (Date.now() - m.desde) / 1000 : 0);
    if (seg > 0 || m.fin) anotarMira(m.vid, seg, m.fin);
    mira.current = { vid: '', desde: 0, seg: 0, fin: false };
  };
  useEffect(() => () => cerrarMira(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const manda = (func, args = []) => {
    const w = marco.current && marco.current.contentWindow;
    if (!w || !listo.current) { cola.current.push([func, args]); return; }
    w.postMessage(JSON.stringify({ event: 'command', func, args, id: 'rls', channel: 'widget' }), ORIGEN_YT);
  };
  useEffect(() => {
    const oye = (e) => {
      if (e.origin !== ORIGEN_YT || !marco.current || e.source !== marco.current.contentWindow) return;
      let d = null;
      try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch (x) { return; }
      if (!d) return;
      if (d.event === 'onReady' || d.event === 'initialDelivery') {
        listo.current = true;
        const xs = cola.current.splice(0);
        for (const [f, a] of xs) manda(f, a);
      }
      const st = d.event === 'onStateChange' ? d.info : (d.event === 'infoDelivery' && d.info && typeof d.info.playerState === 'number' ? d.info.playerState : null);
      const m = mira.current;
      if (st === 1 && !m.desde) m.desde = Date.now();
      if ((st === 0 || st === 2) && m.desde) { m.seg += (Date.now() - m.desde) / 1000; m.desde = 0; }
      if (st === 0) m.fin = true;
      if (st === 0) cb.current.alTerminar();
      else if (st === 2) cb.current.alPausar();
      else if (st === 1) cb.current.alCorrer();
      if (d.info && typeof d.info.muted === 'boolean') setMudo(d.info.muted);
    };
    window.addEventListener('message', oye);
    return () => window.removeEventListener('message', oye);
  }, []);
  const alCargar = () => {
    const w = marco.current && marco.current.contentWindow;
    if (w) w.postMessage(JSON.stringify({ event: 'listening', id: 'rls', channel: 'widget' }), ORIGEN_YT);
  };
  const src = vid ? ORIGEN_YT + '/embed/' + encodeURIComponent(vid) + '?enablejsapi=1&autoplay=1&playsinline=1&rel=0&modestbranding=1' +
    (nacioMudo ? '&mute=1' : '') + '&origin=' + encodeURIComponent(location.origin) : '';
  return {
    activo: !!vid, mudo,
    marco: vid ? <iframe ref={marco} className="rls-yt" src={src} title="Reproductor de YouTube" onLoad={alCargar}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen /> : null,
    // la primera vez crea el reproductor (`solo`: sin que nadie tocara nada, así que mudo); después se le cambia el video
    poner: (v, solo = false) => {
      cerrarMira();
      mira.current = { vid: v, desde: 0, seg: 0, fin: false };
      if (!vid) { if (solo) { setNacioMudo(true); setMudo(true); } setVid(v); } else manda('loadVideoById', [v]);
    },
    play: () => manda('playVideo'), pausa: () => manda('pauseVideo'),
    sonido: (on) => { manda(on ? 'unMute' : 'mute'); setMudo(!on); },
  };
}

// ── el estado del feed, para los dos ──
let pedidoL = null;
const bajarLiga = () => (pedidoL = pedidoL || fetch('/liga_shorts.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null));
let pedidoN = null;
const bajarNotas = () => (pedidoN = pedidoN || fetch('/api/avisos/reels-stats').then((r) => (r.ok ? r.json() : null)).then((j) => (j && j.v) || null).catch(() => null));

function useFeed(liga, inicio) {
  const [D, mal, reintentar] = useGlobal();
  const [L, setL] = useState(null);
  const [notas, setNotas] = useState(null);
  const [listoL, setListoL] = useState(false);
  useEffect(() => {
    let vivo = true;
    bajarLiga().then((d) => { if (vivo) { setL(d); setListoL(true); } });
    bajarNotas().then((n) => { if (vivo) setNotas(n); });
    return () => { vivo = false; };
  }, []);
  const X = useMemo(() => (D ? preparar(D, liga) : null), [D, liga]);
  // se espera a la Liga (es un archivo chico): si llegara después, el feed se reordenaría mientras lo miras
  const todos = useMemo(() => (X && listoL ? armar(X, D, L) : []), [X, D, L, listoL]);
  // ⭐ a quién sigues: los de la Liga (`lg:sigo`, el de siempre) y los del global (en este navegador)
  const [sigo, setSigo] = useState(() => aQuienSigo());
  const [sigoG, setSigoG] = useState(() => ls.json(L_SIGO_G, []));
  useEffect(() => {
    const f = () => setSigo(aQuienSigo());
    window.addEventListener('lg:sigo', f);
    return () => window.removeEventListener('lg:sigo', f);
  }, []);
  const loSigo = (g) => { const kl = claveLiga(g); return kl ? sigo.includes(kl) : sigoG.includes(g.k); };
  const seguir = (g) => {
    const kl = claveLiga(g);
    if (kl && typeof window.alternarSigo === 'function') { window.alternarSigo(kl); setTimeout(() => setSigo(aQuienSigo()), 50); return; }
    const nx = sigoG.includes(g.k) ? sigoG.filter((x) => x !== g.k) : [...sigoG, g.k].slice(-200);
    setSigoG(nx);
    ls.set(L_SIGO_G, nx);
  };
  const [filtro, setFiltro] = useState('todo');
  const [menos, setMenos] = useState(() => ls.json(L_MENOS, []));
  const [guardo, setGuardo] = useState(() => ls.json(L_GUARDO, []));
  const [fuego, setFuego] = useState(() => ls.json(L_FUEGO, []));
  // los vistos se leen una vez: si no, el feed se reordenaría mientras lo miras
  const vistos0 = useRef(ls.json(L_VISTOS, []));
  const claveG = filtro === 'guardados' ? guardo.join(',') : filtro === 'siguiendo' ? sigo.join(',') + '|' + sigoG.join(',') : '';
  const lista = useMemo(() => {
    const base = filtro === 'pro' ? todos.filter((r) => !dePlaza(r)) : filtro === 'plaza' ? todos.filter((r) => dePlaza(r) && !deLaLiga(r))
      : filtro === 'liga' ? todos.filter(deLaLiga)
      : filtro === 'siguiendo' ? todos.filter((r) => r.gente.some(loSigo))
      : filtro === 'guardados' ? todos.filter((r) => guardo.includes(r.vid)) : todos;
    const o = ordenar(base, vistos0.current, menos, notas);
    // un link a un reel (`#/reels/<id>`) empieza por ese
    const j = inicio ? o.findIndex((r) => r.vid === inicio) : -1;
    if (j > 0) o.unshift(o.splice(j, 1)[0]);
    return o;
    // `menos` cambia el orden sólo al cambiar de filtro: marcar «no me interesa» no te mueve el reel que estás viendo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todos, filtro, inicio, claveG, notas ? 1 : 0]);
  const [i, setI] = useState(0);
  const [cargados, setCargados] = useState(VER);
  const [fin, setFin] = useState(false);
  // 👤 a quién se pidió desde la columna de la izquierda cuando el filtro de ahora no lo tenía (ver `irA`)
  const pend = useRef(null);
  useEffect(() => {
    const id = pend.current;
    pend.current = null;
    const j = id ? lista.findIndex((r) => r.gente.some((g) => idDe(g) === id)) : -1;
    setI(Math.max(0, j)); setFin(false); setCargados(VER);
  }, [filtro]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (i >= cargados - 2 && cargados < lista.length) setCargados((c) => Math.min(lista.length, c + MAS));
  }, [i, cargados, lista.length]);
  const cur = lista[Math.min(i, Math.max(0, lista.length - 1))] || null;
  // 🖼️ las miniaturas de los que siguen (hasta 5 adelante), bajadas antes de llegar: pasar de reel no espera la imagen
  useEffect(() => {
    for (const r of lista.slice(i, i + VER)) {
      const im = new Image();
      im.decoding = 'async';
      im.src = 'https://i.ytimg.com/vi/' + r.vid + '/oar2.jpg';
    }
  }, [lista, i]);
  useEffect(() => {
    if (!cur) return;
    const xs = ls.json(L_VISTOS, []).filter((v) => v !== cur.vid);
    xs.push(cur.vid);
    ls.set(L_VISTOS, xs.slice(-600));
  }, [cur]);
  // ↕ hacia dónde se pasó (1 = el siguiente, −1 = el anterior): las animaciones entran desde ese lado (8.16)
  const [dir, setDir] = useState(1);
  const ir = (j) => { const k = Math.max(0, Math.min(lista.length - 1, j)); setDir(k >= i ? 1 : -1); setFin(false); setI(k); };
  const siguiente = () => { if (i + 1 >= lista.length) setFin(true); else ir(i + 1); };
  // 👤 su próximo reel (el de la columna de la izquierda en la compu, como los canales de Twitch): el siguiente en la lista
  // de ahora; si ya pasaron todos, el primero; si este filtro no lo tiene, «Para ti», que tiene a todos
  const irA = (g) => {
    const id = idDe(g);
    const tiene = (r) => r.gente.some((x) => idDe(x) === id);
    let j = lista.findIndex((r, k) => k > i && tiene(r));
    if (j < 0) j = lista.findIndex(tiene);
    if (j >= 0) { ir(j); return; }
    if (filtro === 'todo') return;
    pend.current = id;
    setFiltro('todo');
  };
  const conmuta = (xs, set, k, v) => { const nx = xs.includes(v) ? xs.filter((x) => x !== v) : [...xs, v]; set(nx); ls.set(k, nx); return nx; };
  const hayLiga = todos.some(deLaLiga);
  const filtros = FILTROS.filter(([k]) => (k !== 'liga' || hayLiga) && (k !== 'guardados' || guardo.length || filtro === 'guardados'));
  return {
    D, X: X && listoL ? X : null, mal, reintentar, lista, i, cur, fin, cargados, filtro, setFiltro, ir, siguiente, temp: String((liga && liga.temp) || '').toUpperCase(),
    liga, filtros, loSigo, seguir, todos, irA, dir,
    anterior: () => (fin ? setFin(false) : ir(i - 1)),
    deNuevo: () => ir(0),
    guardado: !!(cur && guardo.includes(cur.vid)), hayGuardados: guardo.length > 0,
    guardar: () => cur && conmuta(guardo, setGuardo, L_GUARDO, cur.vid).includes(cur.vid),
    ardido: !!(cur && fuego.includes(cur.vid)),
    darFuego: () => cur && conmuta(fuego, setFuego, L_FUEGO, cur.vid),
    menos: (canal) => { const nx = [...menos.filter((x) => x !== canal), canal]; setMenos(nx); ls.set(L_MENOS, nx); },
    nomenos: (canal) => { const nx = menos.filter((x) => x !== canal); setMenos(nx); ls.set(L_MENOS, nx); },
  };
}

/** la batalla entera de este short, si alguno de los dos la tiene en sus videos (`g.v`: [id, ev, rival, ganó, vertical]) */
function batallaDe(r) {
  if (!r || r.gente.length < 2) return null;
  const [a, b] = r.gente;
  const nb = limpio2(b.n).toLowerCase();
  const v = (a.v || []).find((x) => !x[4] && limpio2(x[2]).toLowerCase() === nb);
  return v ? v[0] : null;
}

/** el voto de una batalla: quién ganó. Hace falta entrar con Discord (uno por cuenta). El resultado se ve recién con 20
 *  votos (Dlx, en las maquetas: «el resultado se muestra cuando haya 20 votos»), y nunca quién votó */
function Voto({ r, clase = '' }) {
  const [V, setV] = useState(null);
  const [mio, setMio] = useState('');
  const [msg, setMsg] = useState('');
  const vid = r.vid;
  useEffect(() => {
    let vivo = true;
    setV(null); setMio(''); setMsg('');
    fetch('/api/avisos/reels-votos?v=' + encodeURIComponent(vid)).then((x) => (x.ok ? x.json() : null)).then((j) => { if (vivo && j) setV(j); }).catch(() => {});
    return () => { vivo = false; };
  }, [vid]);
  const votar = async (k) => {
    if (typeof window.conCuenta !== 'function') return;
    setMsg('');
    const j = await window.conCuenta('/api/avisos/reels-voto', { v: vid, k: mio === k ? '' : k });
    if (!j) return;
    if (j.status === 401) { setMsg('cuenta'); return; }
    if (!j.ok) { setMsg('mal'); return; }
    setMio(j.mio || '');
    setV({ n: j.n, r: j.r });
  };
  const n = (V && V.n) || 0;
  const res = V && V.r;
  return (
    <div className={'rls-voto ' + clase}>
      <b className="rls-voto-t">¿Quién ganó?</b>
      <div className="rls-voto-bs">
        {r.gente.slice(0, 2).map((g) => {
          const pct = res && n ? Math.round(((res[g.k] || 0) * 100) / n) : null;
          return (
            <button key={g.k} type="button" aria-pressed={mio === g.k} className={mio === g.k ? 'on' : ''} onClick={() => votar(g.k)}>
              <span>{nombre(g)}</span>{pct != null ? <em>{pct} %</em> : null}
              {pct != null ? <i style={{ width: pct + '%' }} aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
      <small>{msg === 'cuenta' ? <>Para votar, <a href="#/cuenta">entra con Discord</a>.</> : msg === 'mal' ? 'No pude guardar tu voto. Prueba de nuevo.'
        : res ? n + ' votos' : n >= 1 ? 'El resultado se ve con 20 votos: van ' + n + '.' : 'El resultado se ve con 20 votos.'}</small>
    </div>
  );
}

// lo que dice cada filtro cuando no tiene nada
const VACIO = { siguiendo: 'Todavía no sigues a nadie con reels', guardados: 'Todavía no guardaste ningún reel', liga: 'Todavía no hay reels de la Liga' };
const VACIO_P = {
  siguiendo: 'Toca la cara de alguien en un reel y «Seguir»: sus reels salen acá.',
  guardados: 'Toca el marcador en un reel y lo encuentras acá.',
  liga: 'Salen de los canales de YouTube de los servidores socios.',
};
const FILTROS = [['todo', 'Para ti'], ['siguiendo', 'Siguiendo'], ['liga', 'La Liga'], ['pro', 'Pros'], ['plaza', 'Plazas'], ['guardados', 'Guardados']];

async function compartir(r, setCopiado) {
  const url = linkDe(r.vid);
  try {
    if (navigator.share) { await navigator.share({ title: r.t || 'Reels', url }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); setCopiado(true); } catch (e) { /* sin portapapeles */ }
}

// ═══════════════════════════════ LA GEOMETRÍA Y EL MOVIMIENTO (8.16) ═══════════════════════════════
// Dlx, 25/11/2026: «la ventana del short lo más vertical y grande posible, en todos los dispositivos… que todo esté quieto en
// un solo lugar, y si puedes animaciones y simetría». Medido antes: el video ocupaba el 51–53 % del celular y el 43 % de la
// tablet, corrido a la izquierda (28 px de un lado y 56 del otro) y con la ficha lejos de sus bordes.

/** la compu: el aire arriba y abajo del escenario, el de los costados, y el alto mínimo del video (por debajo, se baja con
 *  la página) */
const PC_AIRE = 16;
const PC_LADO = 24;
const PC_MIN = 400;
/** las columnas de la grilla de la compu: las angostas (progreso y flechas), el hueco entre columnas y los anchos de afuera */
// ⚠️ `minLado` 300 y no 240: con 240 el panel no tenía lugar para las dos caras y los dos nombres (tablet acostada, 1024 px:
// «GAZIR» salía «G…» y el «Seguir» se montaba encima)
const PC_COL = { fina: 44, hueco: 16, minLado: 300, maxLado: 560, minPanel: 300, maxPanel: 460 };

/**
 * ⚖️ LAS COLUMNAS DE LA COMPU SALEN DEL ANCHO QUE HAY (8.17, Dlx: «en mi PC es grande y hay gran espacio vacío… en la
 * tableta la tabla de la izquierda desaparece cuando hay espacio»). Antes eran 320 px fijos y la gente se escondía por un
 * corte fijo (1240 px) aunque entrara. Ahora: si a los dos lados del video entran al menos `minLado`, va la gente y las dos de
 * afuera crecen parejas hasta `maxLado` (el video sigue exactamente en el medio); si no, progreso · video · flechas · panel,
 * con el panel llenando lo que queda. Si ni el panel mínimo entra, el video se achica para que entre (nunca se sale de lado).
 * `ancho` en px de adentro del zoom de la página
 */
export function columnas(ancho, alto) {
  const C = PC_COL;
  const vw = (a) => Math.round((a * 9) / 16) + 4;
  const lado = Math.floor((ancho - (2 * C.fina + vw(alto) + 4 * C.hueco)) / 2);
  if (lado >= C.minLado) {
    const l = Math.min(lado, C.maxLado);
    return { alto, gente: true, cols: l + 'px ' + C.fina + 'px auto ' + C.fina + 'px ' + l + 'px' };
  }
  let a = alto;
  const sobra = (x) => ancho - (2 * C.fina + vw(x) + 3 * C.hueco);
  if (sobra(a) < C.minPanel) a = Math.max(300, Math.floor(((ancho - 2 * C.fina - 3 * C.hueco - C.minPanel - 4) * 16) / 9));
  const panel = Math.max(C.minPanel, Math.min(C.maxPanel, sobra(a)));
  return { alto: a, gente: false, cols: C.fina + 'px auto ' + C.fina + 'px ' + panel + 'px' };
}

/** las medidas fijas del celular: la barra de arriba, el progreso, la ficha, la fila o la columna de acciones */
const CEL = { arriba: 48, prog: 14, ficha: 66, fila: 62, col: 58, gap: 8, borde: 8 };

/**
 * 📐 Dónde va el video en el celular: dos maneras de acomodar las cinco acciones y se queda la que deja el video MÁS GRANDE.
 * AL COSTADO (una columna a la derecha del video) gana en pantallas anchas o cortas —tablet, 360×640—; ABAJO (una fila del
 * ancho del video) en las largas y angostas, que son casi todos los celulares: a 390×844 el video pasa de 306 a ~330 de ancho.
 * Centrado siempre que haya lugar: con la columna, si no entra a los dos lados, se centra en lo que queda a su izquierda.
 */
export function geometria(W, H) {
  const top = CEL.arriba + CEL.prog;
  const alto = H - top - CEL.gap - CEL.ficha - CEL.borde;
  const ancho = (hMax, wMax) => Math.max(150, Math.min(wMax, (hMax * 9) / 16));
  const lado = ancho(alto, W - 2 * CEL.borde - CEL.col - CEL.gap);
  const abajo = ancho(alto - CEL.fila, W - 2 * CEL.borde);
  const modo = abajo >= lado ? 'abajo' : 'lado';
  const vw = Math.floor(modo === 'abajo' ? abajo : lado);
  const vh = Math.floor((vw * 16) / 9);
  const lateral = CEL.col + CEL.gap;
  let vx = Math.round((W - vw) / 2);
  if (modo === 'lado' && vx < lateral + CEL.borde) vx = Math.max(CEL.borde, Math.round((W - lateral - vw) / 2));
  const fichaY = top + vh + CEL.gap;
  return { modo, vx, vy: top, vw, vh, fichaY, filaY: fichaY + CEL.ficha, colX: vx + vw + CEL.gap };
}

/**
 * ↕ La entrada al pasar de reel: desde el lado al que se fue (el siguiente sube, el anterior baja), sólo `transform` y
 * `opacity`, 280 ms con una salida fuerte (Emil: lo que entra, ease-out). Por la API de animaciones y no por una clase: se
 * puede interrumpir si pasas rápido, y no hace falta volver a montar el reproductor. Con «reducir movimiento», sólo se funde
 */
function useEntrada(ref, k, dir, px) {
  const antes = useRef(k);
  useEffect(() => {
    if (antes.current === k) return;
    antes.current = k;
    const el = ref.current;
    if (!el || !el.animate) return;
    const quieto = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const desde = quieto ? { opacity: 0.5 } : { opacity: 0.25, transform: 'translateY(' + dir * px + 'px)' };
    const hasta = quieto ? { opacity: 1 } : { opacity: 1, transform: 'translateY(0)' };
    el.animate([desde, hasta], { duration: quieto ? 140 : 280, easing: 'cubic-bezier(.23,1,.32,1)' });
  }, [k]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ═══════════════════════════════ EL CELULAR (la E) ═══════════════════════════════
function ReelsCel({ F }) {
  const caja = useRef(null);
  const [medida, setMedida] = useState({ w: 390, h: 760, abajo: 64 });
  const [modo, setModo] = useState('menu');
  const [hoja, setHoja] = useState('');
  const [aviso, setAviso] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const cambiando = useRef(false);
  const reloj = useRef(0);
  useEffect(() => () => clearTimeout(reloj.current), []);
  const yt = useReproductor({
    alTerminar: () => { cambiando.current = true; F.siguiente(); },
    alPausar: () => { if (!cambiando.current) setModo('menu'); },
    alCorrer: () => { cambiando.current = false; setModo('teatro'); },
  });
  // la barra de abajo de la página queda a la vista: el escenario termina donde ella empieza
  useLayoutEffect(() => {
    const mide = () => {
      const el = caja.current;
      if (!el) return;
      const raiz = el.getRootNode();
      const tb = raiz && raiz.querySelector ? raiz.querySelector('.tabbar') : null;
      const abajo = tb ? tb.getBoundingClientRect().height : 0;
      setMedida({ w: window.innerWidth, h: window.innerHeight - abajo, abajo });
    };
    mide();
    window.addEventListener('resize', mide);
    return () => window.removeEventListener('resize', mide);
  }, []);
  // sin el scroll de la página detrás
  useEffect(() => {
    const html = document.documentElement;
    const antes = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => { html.style.overflow = antes; };
  }, []);
  // al cambiar de reel con el reproductor creado, se carga ahí mismo
  const ultimo = useRef('');
  useEffect(() => {
    if (!F.cur || !yt.activo || F.cur.vid === ultimo.current) return;
    ultimo.current = F.cur.vid;
    cambiando.current = true;
    yt.poner(F.cur.vid);
    setModo('teatro');
    setCopiado(false);
  }, [F.cur, yt.activo]); // eslint-disable-line react-hooks/exhaustive-deps
  // ▶ solo al abrir la página (una vez): el primero corre mudo
  const arranco = useRef(false);
  useEffect(() => {
    if (arranco.current || !F.cur || yt.activo) return;
    arranco.current = true;
    ultimo.current = F.cur.vid;
    yt.poner(F.cur.vid, true);
    setModo('teatro');
  }, [F.cur]); // eslint-disable-line react-hooks/exhaustive-deps
  const reproducir = () => {
    if (!F.cur) return;
    setHoja('');
    if (!yt.activo) { ultimo.current = F.cur.vid; yt.poner(F.cur.vid); } else yt.play();
    setModo('teatro');
  };
  const pausarMenu = () => { if (yt.activo) yt.pausa(); setModo('menu'); };
  // deslizar con el dedo: sobre todo lo nuestro (el reproductor se queda con sus toques)
  const t0 = useRef(null);
  const toca = {
    onTouchStart: (e) => { const p = e.touches[0]; t0.current = { x: p.clientX, y: p.clientY, t: Date.now() }; },
    onTouchEnd: (e) => {
      const a = t0.current; t0.current = null;
      if (!a || hoja) return;
      const p = e.changedTouches[0];
      const dy = p.clientY - a.y; const dx = p.clientX - a.x;
      const rapido = Math.abs(dy) / Math.max(1, Date.now() - a.t) > 0.5;
      if (Math.abs(dy) > Math.abs(dx) && (Math.abs(dy) > 60 || (rapido && Math.abs(dy) > 24))) { if (dy < 0) F.siguiente(); else F.anterior(); }
    },
  };
  const avisa = (txt, deshacer) => { setAviso({ txt, deshacer }); clearTimeout(reloj.current); reloj.current = setTimeout(() => setAviso(null), 5000); };
  // ↕ al pasar de reel, el video y su ficha entran desde el lado al que se fue (ver `useEntrada`)
  const cajaVideo = useRef(null);
  const fichaRef = useRef(null);
  const vidAhora = F.cur ? F.cur.vid : '';
  useEntrada(cajaVideo, vidAhora, F.dir, 28);
  useEntrada(fichaRef, vidAhora, F.dir, 10);
  // Esc cierra la hoja abierta
  useEffect(() => {
    if (!hoja) return undefined;
    const k = (e) => { if (e.key === 'Escape') setHoja(''); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [hoja]);
  const r = F.cur;
  if (!r) {
    return (
      <div className="rls rls-cel menu" ref={caja} style={{ bottom: medida.abajo }}>
        <div className="rls-fin">
          <span className="tag">REELS</span>
          <b>{VACIO[F.filtro] || 'Todavía no hay reels'}</b>
          <p>{VACIO_P[F.filtro] || 'Llegan más cada lunes.'}</p>
          <button type="button" className="rls-bt prim" onClick={() => F.setFiltro('todo')}>Ver Para ti</button>
        </div>
      </div>
    );
  }
  // 📐 EL VIDEO LO MÁS GRANDE QUE ENTRE (8.16, ver `geometria()`): el mismo rectángulo para el reproductor y para su póster,
  // así que pausar no mueve nada; lo demás se alinea a sus bordes
  const G = geometria(medida.w, medida.h);
  const filtroN = (FILTROS.find((f) => f[0] === F.filtro) || FILTROS[0])[1];
  const batalla = batallaDe(r);
  const verBatalla = () => {
    pausarMenu();
    setHoja('');
    if (batalla) abrirVideo({ vid: batalla, tit: r.gente.map(nombre).join(' vs '), link: 'https://www.youtube.com/watch?v=' + batalla });
    else location.hash = perfilDe(r.gente[0]);
  };
  const nombres = r.gente.map(nombre).join(' vs ');
  const enviar = () => compartir(r, (c) => { setCopiado(c); if (c) avisa('Link copiado'); });
  const corriendo = modo === 'teatro' && !F.fin;
  const rect = { left: G.vx, top: G.vy, width: G.vw, height: G.vh };
  // el progreso: un segmento por reel cargado, del ancho del video (como las historias); el blanco es el que ves
  const lineas = Array.from({ length: Math.min(F.cargados, F.lista.length) }, (_, j) => j);
  // las acciones, iguales corriendo y en pausa: al costado o en una fila, según `G.modo`. AL COSTADO la columna es del alto
  // del video y las reparte de borde a borde (8.17, Dlx al verlo en su celular: «lo veo algo vacío»: los cinco quedaban
  // abajo y arriba sobraba una franja del alto del video). Ahí suma las dos que en la fila viven en «Más» —¿Quién ganó? y
  // la batalla—, si entran
  const extras = G.modo === 'lado' && G.vh >= 7 * 62;
  const Acciones = (
    <div className={'rls-acc ' + G.modo} style={G.modo === 'abajo' ? { left: G.vx, top: G.filaY, width: G.vw } : { left: G.colX, top: G.vy, height: G.vh }}>
      <button type="button" className="rls-ac" aria-label={'La ficha de ' + nombres} onClick={() => { pausarMenu(); setHoja('ficha'); }}>
        <Cara liga={F.liga} g={r.gente[0]} cls="rls-cara" /><span>Ficha</span></button>
      <button type="button" className={'rls-ac' + (F.ardido ? ' ardido' : '')} aria-pressed={F.ardido} onClick={F.darFuego}>
        <Ico n="fuego" lleno={F.ardido} t={26} /><span>Fuego</span></button>
      {extras && r.gente.length >= 2 ? (
        <button type="button" className="rls-ac" onClick={() => { pausarMenu(); setHoja('voto'); }}><span className="rls-vs" aria-hidden="true">VS</span><span>¿Quién?</span></button>
      ) : null}
      {extras ? <button type="button" className="rls-ac" onClick={verBatalla}><Ico n="batalla" t={24} /><span>{batalla ? 'Batalla' : 'Perfil'}</span></button> : null}
      <button type="button" className="rls-ac" aria-pressed={F.guardado} onClick={() => { if (F.guardar()) avisa('Guardado: lo encuentras en «Guardados»'); }}>
        <Ico n="guardar" lleno={F.guardado} t={24} /><span>{F.guardado ? 'Guardado' : 'Guardar'}</span></button>
      <button type="button" className="rls-ac" onClick={enviar}><Ico n="enviar" t={24} /><span>Enviar</span></button>
      <button type="button" className="rls-ac" onClick={() => { pausarMenu(); setCopiado(false); setHoja('mas'); }}><Ico n="mas" t={24} /><span>Más</span></button>
    </div>
  );
  return (
    <div className={'rls rls-cel ' + (corriendo ? 'teatro' : 'menu')} ref={caja} style={{ bottom: medida.abajo }} {...toca}>
      {/* la luz del teatro: la misma miniatura, desenfocada, detrás de todo; entra fundiéndose con cada reel */}
      <Poster key={r.vid} vid={r.vid} cls="rls-luz" />
      <p className="rls-sr" aria-live="polite">{F.fin ? 'Viste todo lo nuevo' : 'Reel ' + (F.i + 1) + ' de ' + F.lista.length + ': ' + nombres}</p>

      {F.fin ? (
        <div className="rls-fin">
          <span className="tag">REELS</span>
          <b>Viste todo lo nuevo</b>
          <p>Llegan más cada lunes. Mientras, mira quién está arriba o lo que viene en la Liga.</p>
          <a className="rls-bt prim" href="#/ranking/global">Ver el Ranking global</a>
          <a className="rls-bt" href="#/eventos">Los próximos eventos de la Liga</a>
          <button type="button" className="rls-bt sin" onClick={F.deNuevo}>Volver al primero</button>
        </div>
      ) : (
        <>
          <div className="rls-cab" style={{ left: G.vx, right: medida.w - G.vx - G.vw }}>
            <button type="button" className="rls-filtro" aria-haspopup="dialog" onClick={() => { pausarMenu(); setHoja('filtros'); }}>{filtroN}<Ico n="abajo" t={18} /></button>
            {yt.mudo ? <button type="button" className="rls-sonido" onClick={() => yt.sonido(true)}><Ico n="mudo" t={18} />Toca para el sonido</button>
              : <button type="button" className="rls-ib" aria-label="Silenciar" onClick={() => yt.sonido(false)}><Ico n="sonido" /></button>}
          </div>
          <nav className="rls-prog" aria-label="Ir a otro reel" style={{ left: G.vx, width: G.vw, top: CEL.arriba }}>
            {lineas.map((j) => (
              <button key={j} type="button" aria-label={'Reel ' + (j + 1) + ': ' + F.lista[j].gente.map(nombre).join(' vs ')} aria-current={j === F.i ? 'true' : undefined}
                className={j === F.i ? 'on' : j < F.i ? 'visto' : ''} onClick={() => F.ir(j)}><i /></button>
            ))}
          </nav>
          <div className="rls-vid" ref={cajaVideo} style={rect}>
            <div className={'rls-ytcaja' + (corriendo ? '' : ' oculto')}>{yt.marco}</div>
            {corriendo ? null : (
              <button type="button" className="rls-vid-poster" onClick={reproducir} aria-label={yt.activo ? 'Seguir viendo' : 'Ver el reel'}>
                <Poster vid={r.vid} cls="rls-poster" alt={r.t || nombres} />
                <span className="rls-play"><Ico n="play" t={40} /></span>
              </button>
            )}
          </div>
          <div className="rls-ficha" ref={fichaRef} style={{ left: G.vx, top: G.fichaY, width: G.modo === 'lado' ? G.vw + CEL.gap + CEL.col : G.vw }}>
            <div className="rls-ficha-1">
              <button type="button" className="rls-ficha-n" onClick={() => { pausarMenu(); setHoja('ficha'); }}>
                <b>{nombres}</b><span>{r.gente.map(puestoDe).join(' · ')}</span></button>
              <button type="button" className={'rls-perfil' + (F.loSigo(r.gente[0]) ? ' on' : '')} aria-pressed={F.loSigo(r.gente[0])}
                onClick={() => F.seguir(r.gente[0])}>{F.loSigo(r.gente[0]) ? 'Siguiendo' : 'Seguir'}</button>
            </div>
            <span className="rls-t2">{r.t || nombres}</span>
            <span className="rls-canal">{r.gente.map((g) => g.cc).filter(Boolean).slice(0, 2).map((cc, j) => <Bandera key={cc + j} cc={cc} cls="rls-flag" />)}{r.canal}{deLaLiga(r) ? <em>De la Liga</em> : dePlaza(r) ? <em>De las plazas</em> : null}</span>
          </div>
          {Acciones}
          {G.modo === 'lado' && G.vx >= CEL.col + CEL.gap + CEL.borde ? (
            <CarasGente F={F} cuantas={Math.floor(G.vh / 66)} style={{ left: G.vx - CEL.gap - CEL.col, top: G.vy, height: G.vh }} />
          ) : null}
        </>
      )}

      {aviso && !hoja ? (
        <div className="rls-aviso" role="status"><span>{aviso.txt}</span>
          {aviso.deshacer ? <button type="button" onClick={() => { aviso.deshacer(); setAviso(null); }}>Deshacer</button> : null}</div>
      ) : null}

      {hoja ? (
        <div className="rls-velo" onClick={(e) => { if (e.target === e.currentTarget) setHoja(''); }}>
          <div className="rls-hoja" role="dialog" aria-modal="true"
            aria-label={hoja === 'ficha' ? 'La ficha' : hoja === 'voto' ? '¿Quién ganó?' : hoja === 'filtros' ? 'Qué ver' : 'Más opciones'}>
            <span className="rls-asa" aria-hidden="true" />
            {hoja === 'voto' ? <Voto r={r} clase="cel" /> : hoja === 'filtros' ? (
              <>
                <b className="rls-hoja-t">Qué ver</b>
                {F.filtros.map(([k, n]) => (
                  <button key={k} type="button" className={'rls-op' + (F.filtro === k ? ' ok' : '')} aria-pressed={F.filtro === k}
                    onClick={() => { F.setFiltro(k); setHoja(''); }}>{F.filtro === k ? <Ico n="listo" t={20} /> : <span className="rls-op-h" />}{n}</button>
                ))}
              </>
            ) : hoja === 'ficha' ? (
              <>
                {r.t ? <p className="rls-hoja-p">{r.t}</p> : null}
                {r.gente.map((g) => (
                  <div key={g.k} className="rls-fila-c">
                    <a className="rls-fila" href={perfilDe(g)}>
                      <Cara liga={F.liga} g={g} cls="rls-cara g" />
                      <span><b>{nombre(g)} <Bandera cc={g.cc} cls="rls-flag" /></b>
                        <small>{[g.cc ? nombrePais(g.cc) : '', puestoDe(g) + (g.pos ? ' del Ranking global' : '')].filter(Boolean).join(' · ')}</small></span>
                    </a>
                    <button type="button" className={'rls-seguir' + (F.loSigo(g) ? ' on' : '')} aria-pressed={F.loSigo(g)} onClick={() => F.seguir(g)}>
                      {F.loSigo(g) ? 'Siguiendo' : 'Seguir'}</button>
                  </div>
                ))}
                <a className="rls-bt prim" href={perfilDe(r.gente[0])}>Ver su perfil entero</a>
              </>
            ) : (
              <>
                {r.gente.length >= 2 ? <button type="button" className="rls-op" onClick={() => setHoja('voto')}><span className="rls-vs" aria-hidden="true">VS</span>¿Quién ganó? Vota</button> : null}
                <button type="button" className="rls-op" onClick={verBatalla}><Ico n="batalla" t={20} />{batalla ? 'Ver la batalla completa' : 'Sus batallas'}</button>
                <button type="button" className={'rls-op' + (copiado ? ' ok' : '')} onClick={async () => { try { await navigator.clipboard.writeText(linkDe(r.vid)); setCopiado(true); } catch (e) { /* sin portapapeles */ } }}>
                  <Ico n={copiado ? 'listo' : 'copiar'} t={20} />{copiado ? 'Copiado' : 'Copiar el link'}</button>
                <button type="button" className="rls-op" onClick={() => {
                  const canal = r.canal; const desde = F.i;
                  F.menos(canal); setHoja(''); F.siguiente();
                  avisa('Vas a ver menos de ' + canal, () => { F.nomenos(canal); F.ir(desde); });
                }}><Ico n="no" t={20} />No me interesa: menos de {r.canal}</button>
                <a className="rls-op" href="#/ranking/global"><Ico n="persona" t={20} />Ver dónde están en el Ranking global</a>
                <a className="rls-op" href={'https://www.youtube.com/shorts/' + r.vid} target="_blank" rel="noopener noreferrer"><Ico n="yt" t={20} />Verlo en YouTube</a>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ═══════════════════════════════ LA COMPU (la D) ═══════════════════════════════
/**
 * 👤 LA COLUMNA DE LA GENTE (8.14, como los canales de Twitch): a quién sigues y a quién recomendamos, cada uno con cuántos
 * reels tiene. Tocar a alguien lleva a su próximo reel (`F.irA`). Recomendados: los que más reels tienen y no sigues, y a
 * igual cantidad el mejor del Ranking global. El que está en el reel de ahora queda marcado
 */
/** 👤 quién tiene reels, con cuántos: los que sigues (`sigo`) y los recomendados (`rec`: los que más tienen y no sigues, y a
 *  igual cantidad el mejor del Ranking global). Para la columna de la compu y la de caras del celular */
function useGente(F, nSigo = 12, nRec = 8) {
  const gente = useMemo(() => {
    const m = new Map();
    for (const r of F.todos) {
      for (const g of r.gente) {
        const id = idDe(g);
        const x = m.get(id) || { g, n: 0 };
        x.n++;
        m.set(id, x);
      }
    }
    return [...m.values()];
  }, [F.todos]);
  const sigo = gente.filter((x) => F.loSigo(x.g)).sort((a, b) => b.n - a.n).slice(0, nSigo);
  const rec = gente.filter((x) => !F.loSigo(x.g))
    .sort((a, b) => b.n - a.n || (a.g.pos || 9999) - (b.g.pos || 9999)).slice(0, nRec);
  const ahora = new Set(F.cur ? F.cur.gente.map(idDe) : []);
  return { sigo, rec, ahora };
}

/**
 * 👤 LA GENTE EN CARAS (8.17), a la izquierda del video en el celular y la tablet cuando sobra lugar a ese lado (tablet
 * parada: 155 px vacíos). Es la columna de Twitch cerrada: sólo caras con el nombre corto, primero a quien sigues; en espejo
 * con la de acciones de la derecha, del mismo ancho y del alto del video. Tocar una cara lleva a su próximo reel
 */
function CarasGente({ F, style, cuantas }) {
  const { sigo, rec, ahora } = useGente(F, cuantas, cuantas);
  const xs = [...sigo.map((x) => [x, true]), ...rec.map((x) => [x, false])].slice(0, cuantas);
  if (!xs.length) return null;
  return (
    <nav className="rls-caras-cel" style={style} aria-label="Gente con reels">
      {xs.map(([x, sigue]) => (
        <button key={idDe(x.g)} type="button" className={'rls-ac' + (ahora.has(idDe(x.g)) ? ' on' : '') + (sigue ? ' sigue' : '')}
          aria-current={ahora.has(idDe(x.g)) || undefined} aria-label={nombre(x.g) + (sigue ? ', la sigues' : '') + ', ' + x.n + ' reels'}
          onClick={() => F.irA(x.g)}>
          <Cara liga={F.liga} g={x.g} cls="rls-cara" /><span>{nombre(x.g)}</span>
        </button>
      ))}
    </nav>
  );
}

function RielGente({ F, alto = 560 }) {
  // tantas como entren en el alto (cada fila ~50 px, más los dos títulos): a 2560 px sobraba media columna vacía
  const caben = Math.max(8, Math.floor((alto - 150) / 50));
  const { sigo, rec, ahora } = useGente(F, Math.min(12, caben), caben);
  const fila = (x) => (
    <li key={idDe(x.g)}>
      <button type="button" className={'rls-rl-f' + (ahora.has(idDe(x.g)) ? ' on' : '')} aria-current={ahora.has(idDe(x.g)) || undefined}
        aria-label={nombre(x.g) + ', ' + x.n + (x.n === 1 ? ' reel' : ' reels')} onClick={() => F.irA(x.g)}>
        <Cara liga={F.liga} g={x.g} cls="rls-cara rls-rl-c" />
        <span><b>{nombre(x.g)}</b><small>{puestoDe(x.g)}</small></span>
        <em>{x.n}</em>
      </button>
    </li>
  );
  return (
    <nav className="rls-rl" aria-label="Gente con reels">
      <div className="sec-t"><h2>Siguiendo</h2></div>
      {sigo.length ? <ul>{sigo.map(fila)}</ul> : <p>Toca «Seguir» en un reel y esa persona sale acá.</p>}
      {rec.length ? <><div className="sec-t"><h2>Recomendados</h2></div><ul>{rec.map(fila)}</ul></> : null}
    </nav>
  );
}

function ReelsPc({ F }) {
  const [modo, setModo] = useState('menu');
  const [copiado, setCopiado] = useState(false);
  const [aviso, setAviso] = useState(null);
  const cambiando = useRef(false);
  const reloj = useRef(0);
  useEffect(() => () => clearTimeout(reloj.current), []);
  // ▶ EN LA COMPU EL REPRODUCTOR NO SE ESCONDE AL PAUSAR (8.14, Dlx: «¿no se puede autoreproducir para así evitamos dar click
  // en el medio?»). Esconderlo es cosa del celular, donde el menú va ENCIMA del video; acá todo lo nuestro está al costado,
  // así que una pausa deja el de YouTube a la vista con su propio ▶, y pasar de reel lo arranca solo. La miniatura queda
  // sólo para el instante antes de que el reproductor exista
  const yt = useReproductor({
    alTerminar: () => { cambiando.current = true; F.siguiente(); },
    alPausar: () => {},
    alCorrer: () => { cambiando.current = false; setModo('teatro'); },
  });
  const ultimo = useRef('');
  useEffect(() => {
    if (!F.cur || !yt.activo || F.cur.vid === ultimo.current) return;
    ultimo.current = F.cur.vid;
    cambiando.current = true;
    yt.poner(F.cur.vid);
    setModo('teatro');
    setCopiado(false);
  }, [F.cur, yt.activo]); // eslint-disable-line react-hooks/exhaustive-deps
  const arranco = useRef(false);
  useEffect(() => {
    if (arranco.current || !F.cur || yt.activo) return;
    arranco.current = true;
    ultimo.current = F.cur.vid;
    yt.poner(F.cur.vid, true);
    setModo('teatro');
  }, [F.cur]); // eslint-disable-line react-hooks/exhaustive-deps
  const reproducir = () => {
    if (!F.cur) return;
    if (!yt.activo) { ultimo.current = F.cur.vid; yt.poner(F.cur.vid); } else yt.play();
    setModo('teatro');
  };
  // ↑ ↓ para pasar, M para el sonido, F para el fuego (no mientras escribes)
  const teclas = useRef(null);
  teclas.current = (e) => {
    const t = e.composedPath ? e.composedPath()[0] : e.target;
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '')) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); F.siguiente(); } else if (e.key === 'ArrowUp') { e.preventDefault(); F.anterior(); } else if (e.key === 'm' || e.key === 'M') yt.sonido(yt.mudo);
    else if (e.key === 'f' || e.key === 'F') F.darFuego();
  };
  useEffect(() => {
    const k = (e) => teclas.current(e);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  const avisa = (txt, deshacer) => { setAviso({ txt, deshacer }); clearTimeout(reloj.current); reloj.current = setTimeout(() => setAviso(null), 5000); };
  // 📐 EL ALTO DEL VIDEO SE MIDE, NO SE ADIVINA (8.16). Medido antes: con los avisos de arriba el video arrancaba en y≈430–510
  // y salía cortado abajo en los cuatro tamaños de compu (`100vh/z − 380` no los contaba). Ahora: desde donde empieza el
  // escenario hasta el borde de abajo de la pantalla, en px de adentro del zoom de la página (`.app{zoom}`), y se vuelve a
  // medir cuando algo de arriba cambia de alto: cerrar un aviso agranda el video. ⚠️ No se desplaza la página sola para
  // ganar lugar: la primera versión lo hacía y, con el margen de desplazamiento de la página, el video quedaba cortado igual
  // (y moverle la página a alguien no es «quieto»)
  const teatro = useRef(null);
  const [medida, setMedida] = useState({ alto: 560, cols: '', gente: true });
  useLayoutEffect(() => {
    const el = teatro.current;
    if (!el) return undefined;
    const app = el.closest ? el.closest('.app') : null;
    const mide = () => {
      const z = (app && parseFloat(getComputedStyle(app).zoom)) || 1;
      const caja = el.getBoundingClientRect();
      const top = caja.top + window.scrollY;
      const libre = (window.innerHeight - top) / z - 2 * PC_AIRE;
      const x = columnas(caja.width / z - 2 * PC_LADO, Math.round(Math.max(PC_MIN, Math.min(libre, 1100))));
      setMedida((m) => (m.alto === x.alto && m.cols === x.cols ? m : x));
    };
    mide();
    const ro = typeof ResizeObserver !== 'undefined' && app ? new ResizeObserver(mide) : null;
    if (ro) ro.observe(app);
    window.addEventListener('resize', mide);
    // y una mirada por segundo: cerrar un aviso de arriba no siempre le cambia el tamaño a `.app` (medido a 1920: el video se
    // quedaba con 176 px libres abajo). Sólo lee una posición; si no cambió, React no vuelve a dibujar nada
    const reloj = setInterval(mide, 1000);
    return () => { if (ro) ro.disconnect(); window.removeEventListener('resize', mide); clearInterval(reloj); };
  }, []);
  // ↕ al pasar de reel, el video y el contenido del panel entran desde el lado al que se fue; las cajas no se mueven
  const cajaVideo = useRef(null);
  const panelIn = useRef(null);
  const vidAhora = F.cur ? F.cur.vid : '';
  useEntrada(cajaVideo, vidAhora, F.dir, 22);
  useEntrada(panelIn, vidAhora, F.dir, 12);
  const r = F.cur;
  const fs = F.filtros;
  // 🎨 LA FRANJA, EN UNA SOLA FILA (8.16): la etiqueta y el título a la izquierda, los filtros a la derecha. Con el título de
  // 42 px, su bajada y las pestañas abajo se comía ~270 px del primer pliegue, que ahora son del video
  const cab = (
    <div className="escena rls-esc">
      <div className="rls-esc-in">
        <div className="rls-esc-tx">
          <span className="tag">REELS{F.temp ? ' · ' + F.temp : ''}</span>
          <h1 className="hero-ev rls-h1">Los momentos de las batallas</h1>
        </div>
        <div className="rls-chips" role="group" aria-label="Qué ver">
          {fs.map(([k, n]) => <button key={k} type="button" aria-pressed={F.filtro === k} className={F.filtro === k ? 'on' : ''} onClick={() => F.setFiltro(k)}>{n}</button>)}
        </div>
      </div>
    </div>
  );
  const estilo = { '--rls-alto': medida.alto + 'px' };
  const grilla = medida.cols ? { gridTemplateColumns: medida.cols } : undefined;
  if (!r) {
    return (
      <section className="rls-pc">{cab}
        <div className="rls-pc-teatro" ref={teatro} style={estilo}>
          <div className="rls-pc-in"><div className="rls-pc-cuerpo vacio">
            {medida.gente ? <RielGente F={F} alto={medida.alto} /> : null}
            <div className="rls-vacio"><b>{VACIO[F.filtro] || 'Todavía no hay reels'}</b><p>{VACIO_P[F.filtro] || 'Llegan más cada lunes.'}</p>
              <button type="button" className="rls-btc" onClick={() => F.setFiltro('todo')}>Ver Para ti</button></div>
          </div></div>
        </div>
      </section>
    );
  }
  const nombres = r.gente.map(nombre).join(' vs ');
  const batalla = batallaDe(r);
  const masReels = [1, 2, 3].map((j) => F.lista[F.i + j]).filter(Boolean);
  // el progreso, en vertical al lado del video (espejo de las flechas): hasta 9 segmentos alrededor del que ves
  const nCarg = Math.min(F.cargados, F.lista.length);
  const desde = Math.max(0, Math.min(F.i - 4, nCarg - 9));
  const lineas = Array.from({ length: Math.min(9, nCarg) }, (_, j) => desde + j).filter((j) => j < nCarg);
  // 🎭 EL ESCENARIO (8.14) y LA SIMETRÍA (8.16): gente · progreso · video · flechas · panel, con las dos columnas de afuera
  // del mismo ancho y las dos de adentro también, así el video queda exactamente en el medio. Las cinco del mismo alto que el
  // video, y adentro del panel cada cosa tiene su lugar fijo: pasar de reel no mueve ninguna caja
  return (
    <section className="rls-pc">
      {cab}
      <div className="rls-pc-teatro" ref={teatro} style={estilo}>
        <div className="rls-pc-luz" aria-hidden="true"><Poster key={r.vid} vid={r.vid} cls="rls-luz" /></div>
        <div className="rls-pc-in">
          <div className="rls-pc-cuerpo" style={grilla}>
            {medida.gente ? <RielGente F={F} alto={medida.alto} /> : null}
            <nav className="rls-pc-prog" aria-label="Ir a otro reel">
              {lineas.map((j) => (
                <button key={j} type="button" aria-label={'Reel ' + (j + 1) + ': ' + F.lista[j].gente.map(nombre).join(' vs ')}
                  aria-current={j === F.i && !F.fin ? 'true' : undefined} className={j === F.i && !F.fin ? 'on' : j < F.i ? 'visto' : ''}
                  onClick={() => F.ir(j)}><i /></button>
              ))}
            </nav>
            <div className="rls-pc-video" ref={cajaVideo}>
              <div className={'rls-ytcaja' + ((modo === 'teatro' || yt.activo) && !F.fin ? '' : ' oculto')}>{yt.marco}</div>
              {F.fin ? (
                <div className="rls-fin">
                  <span className="tag">REELS</span>
                  <b>Viste todo lo nuevo</b>
                  <p>Llegan más cada lunes. Mientras, mira quién está arriba o lo que viene en la Liga.</p>
                  <a className="rls-bt prim" href="#/ranking/global">Ver el Ranking global</a>
                  <a className="rls-bt" href="#/eventos">Los próximos eventos de la Liga</a>
                  <button type="button" className="rls-bt sin" onClick={F.deNuevo}>Volver al primero</button>
                </div>
              ) : modo !== 'teatro' && !yt.activo ? (
                <button type="button" className="rls-pc-poster" onClick={reproducir} aria-label="Ver el reel">
                  <Poster vid={r.vid} cls="rls-poster" alt={r.t || nombres} />
                  <span className="rls-play"><Ico n="play" t={44} /></span>
                </button>
              ) : null}
            </div>
            <div className="rls-pc-flechas">
              <button type="button" className="rls-ib caja" aria-label="Anterior (flecha arriba)" onClick={F.anterior}><Ico n="arriba" /></button>
              <button type="button" className="rls-ib caja prim" aria-label="Siguiente (flecha abajo)" onClick={F.siguiente}><Ico n="abajo" /></button>
            </div>
            <aside className="rls-pc-panel" aria-label="Este reel">
              <div className="rls-pc-panel-in" ref={panelIn}>
                <div className="rls-pc-quien">
                  <span className="rls-caras">{r.gente.slice(0, 3).map((g) => <Cara liga={F.liga} key={g.k} g={g} cls="rls-cara" />)}</span>
                  <div>
                    {r.gente.slice(0, 2).map((g) => (
                      <span key={g.k} className="rls-pc-fila">
                        <a className="rls-pc-n" href={perfilDe(g)}><b>{nombre(g)}</b><Bandera cc={g.cc} cls="rls-flag" /><small>{puestoDe(g)}</small></a>
                        <button type="button" className={'rls-seguir' + (F.loSigo(g) ? ' on' : '')} aria-pressed={F.loSigo(g)} onClick={() => F.seguir(g)}>
                          {F.loSigo(g) ? 'Siguiendo' : 'Seguir'}</button>
                      </span>
                    ))}
                  </div>
                </div>
                <p className="rls-pc-t">{r.t || nombres}</p>
                <p className="rls-canal">{r.canal}{deLaLiga(r) ? <em>De la Liga</em> : dePlaza(r) ? <em>De las plazas</em> : null}</p>
                <div className="rls-pc-acc">
                  <button type="button" className={'rls-ac' + (F.ardido ? ' ardido' : '')} aria-pressed={F.ardido} title="Tecla F" onClick={F.darFuego}>
                    <Ico n="fuego" lleno={F.ardido} t={24} /><span>Fuego</span></button>
                  <button type="button" className="rls-ac" aria-pressed={F.guardado} onClick={() => { if (F.guardar()) avisa('Guardado: lo encuentras en «Guardados»'); }}>
                    <Ico n="guardar" lleno={F.guardado} t={22} /><span>{F.guardado ? 'Guardado' : 'Guardar'}</span></button>
                  <button type="button" className={'rls-ac' + (yt.mudo ? ' sonar' : '')} title="Tecla M" onClick={() => yt.sonido(yt.mudo)}>
                    <Ico n={yt.mudo ? 'mudo' : 'sonido'} t={22} /><span>{yt.mudo ? 'Sonido' : 'Silenciar'}</span></button>
                  <button type="button" className={'rls-ac' + (copiado ? ' ok' : '')} onClick={async () => { try { await navigator.clipboard.writeText(linkDe(r.vid)); setCopiado(true); } catch (e) { /* sin portapapeles */ } }}>
                    <Ico n={copiado ? 'listo' : 'copiar'} t={20} /><span>{copiado ? 'Copiado' : 'Link'}</span></button>
                </div>
                <div className="rls-pc-acc2">
                  <button type="button" className="rls-btc" onClick={() => {
                    if (batalla) { if (yt.activo) yt.pausa(); abrirVideo({ vid: batalla, tit: nombres, link: 'https://www.youtube.com/watch?v=' + batalla }); } else location.hash = perfilDe(r.gente[0]);
                  }}><Ico n="batalla" t={18} />{batalla ? 'Batalla' : 'Batallas'}</button>
                  <a className="rls-btc" href={'https://www.youtube.com/shorts/' + r.vid} target="_blank" rel="noopener noreferrer"><Ico n="yt" t={18} />YouTube</a>
                  <button type="button" className="rls-btc" onClick={() => {
                    const canal = r.canal; const desdeI = F.i;
                    F.menos(canal); F.siguiente();
                    avisa('Vas a ver menos de ' + canal, () => { F.nomenos(canal); F.ir(desdeI); });
                  }}><Ico n="no" t={18} />Menos</button>
                </div>
                {r.gente.length >= 2 ? <Voto r={r} clase="pc" /> : null}
                <div className="rls-pc-mas">
                  <div className="sec-t"><h2>Lo que sigue</h2></div>
                  <div>
                    {masReels.map((x, j) => (
                      <button key={x.vid} type="button" onClick={() => F.ir(F.i + j + 1)} aria-label={x.gente.map(nombre).join(' vs ')}>
                        <Poster vid={x.vid} cls="rls-mini" /><span>{x.gente.map(nombre).join(' vs ')}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <p className="rls-atajos" aria-hidden="true"><kbd><Ico n="arriba" t={14} /></kbd><kbd><Ico n="abajo" t={14} /></kbd> pasar <kbd>M</kbd> sonido <kbd>F</kbd> fuego</p>
              </div>
            </aside>
          </div>
        </div>
      </div>
      <p className="rls-sr" aria-live="polite">{F.fin ? 'Viste todo lo nuevo' : 'Reel ' + (F.i + 1) + ' de ' + F.lista.length + ': ' + nombres}</p>
      {aviso ? (
        <div className="rls-aviso pc" role="status"><span>{aviso.txt}</span>
          {aviso.deshacer ? <button type="button" onClick={() => { aviso.deshacer(); setAviso(null); }}>Deshacer</button> : null}</div>
      ) : null}
    </section>
  );
}

function useCompu() {
  const q = '(min-width: 900px)';
  const [pc, setPc] = useState(() => !!(window.matchMedia && window.matchMedia(q).matches));
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const m = window.matchMedia(q);
    const f = () => setPc(m.matches);
    m.addEventListener ? m.addEventListener('change', f) : m.addListener(f);
    return () => (m.removeEventListener ? m.removeEventListener('change', f) : m.removeListener(f));
  }, []);
  return pc;
}

export function Reels({ liga, inicio = '' }) {
  const F = useFeed(liga, inicio);
  const pc = useCompu();
  if (F.mal) return <section className="rls-pc"><p className="rls-nada">No pude bajar los reels. <button type="button" className="rls-btc" onClick={F.reintentar}>Reintentar</button></p></section>;
  if (!F.X) return <section className="rls-pc"><p className="rls-nada">Cargando los reels…</p></section>;
  return pc ? <ReelsPc F={F} /> : <ReelsCel F={F} />;
}
