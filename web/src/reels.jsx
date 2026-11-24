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
  useEffect(() => { setI(0); setFin(false); setCargados(VER); }, [filtro]);
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
  const ir = (j) => { setFin(false); setI(Math.max(0, Math.min(lista.length - 1, j))); };
  const siguiente = () => { if (i + 1 >= lista.length) setFin(true); else ir(i + 1); };
  const conmuta = (xs, set, k, v) => { const nx = xs.includes(v) ? xs.filter((x) => x !== v) : [...xs, v]; set(nx); ls.set(k, nx); return nx; };
  const hayLiga = todos.some(deLaLiga);
  const filtros = FILTROS.filter(([k]) => (k !== 'liga' || hayLiga) && (k !== 'guardados' || guardo.length || filtro === 'guardados'));
  return {
    D, X: X && listoL ? X : null, mal, reintentar, lista, i, cur, fin, cargados, filtro, setFiltro, ir, siguiente, temp: String((liga && liga.temp) || '').toUpperCase(),
    liga, filtros, loSigo, seguir,
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

// ═══════════════════════════════ EL CELULAR (la E) ═══════════════════════════════
function ReelsCel({ F }) {
  const caja = useRef(null);
  const [medida, setMedida] = useState({ w: 390, h: 760, abajo: 64 });
  const [modo, setModo] = useState('menu');
  const [hoja, setHoja] = useState('');
  const [aviso, setAviso] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [largo, setLargo] = useState(false);
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
    setLargo(false);
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
  // el video en modo teatro: 9:16, entre las líneas (28 px) y los íconos (56 px), dejando lugar arriba y abajo
  const arriba = 52;
  const pie = 132;
  const hMax = Math.max(240, medida.h - arriba - pie);
  const wMax = Math.max(180, medida.w - 28 - 56);
  const vh = Math.min(hMax, (wMax * 16) / 9);
  const vw = (vh * 9) / 16;
  const vx = 28 + (wMax - vw) / 2;
  const filtroN = (FILTROS.find((f) => f[0] === F.filtro) || FILTROS[0])[1];
  const otroFiltro = () => {
    const fs = F.filtros;
    const j = fs.findIndex((f) => f[0] === F.filtro);
    F.setFiltro(fs[(j + 1) % fs.length][0]);
  };
  const batalla = batallaDe(r);
  const verBatalla = () => {
    pausarMenu();
    if (batalla) abrirVideo({ vid: batalla, tit: r.gente.map(nombre).join(' vs '), link: 'https://www.youtube.com/watch?v=' + batalla });
    else location.hash = perfilDe(r.gente[0]);
  };
  const lineas = Array.from({ length: Math.min(F.cargados, F.lista.length) }, (_, j) => j);
  const Lineas = (
    <nav className="rls-lineas" aria-label="Ir a otro reel">
      {lineas.map((j) => (
        <button key={j} type="button" aria-label={'Reel ' + (j + 1) + ': ' + F.lista[j].gente.map(nombre).join(' vs ')} aria-current={j === F.i && !F.fin ? 'true' : undefined}
          className={j === F.i && !F.fin ? 'on' : j < F.i ? 'visto' : ''} onClick={() => F.ir(j)}><i /></button>
      ))}
    </nav>
  );
  const nombres = r.gente.map(nombre).join(' vs ');
  return (
    <div className={'rls rls-cel ' + (modo === 'teatro' && !F.fin ? 'teatro' : 'menu')} ref={caja} style={{ bottom: medida.abajo }} {...toca}>
      {/* la luz del teatro: la misma miniatura, desenfocada, detrás de todo */}
      <Poster vid={r.vid} cls="rls-luz" />
      <div className={'rls-ytcaja' + (modo === 'teatro' && !F.fin ? '' : ' oculto')} style={{ left: vx, top: arriba, width: vw, height: vh }}>{yt.marco}</div>

      {F.fin ? (
        <div className="rls-fin">
          <span className="tag">REELS</span>
          <b>Viste todo lo nuevo</b>
          <p>Llegan más cada lunes. Mientras, mira quién está arriba o lo que viene en la Liga.</p>
          <a className="rls-bt prim" href="#/ranking/global">Ver el Ranking global</a>
          <a className="rls-bt" href="#/eventos">Los próximos eventos de la Liga</a>
          <button type="button" className="rls-bt sin" onClick={F.deNuevo}>Volver al primero</button>
        </div>
      ) : modo === 'teatro' ? (
        <>
          <div className="rls-cab">
            <button type="button" className="rls-filtro" onClick={otroFiltro}>{filtroN}<Ico n="abajo" t={18} /></button>
            {yt.mudo ? <button type="button" className="rls-sonido" onClick={() => yt.sonido(true)}><Ico n="mudo" t={18} />Toca para el sonido</button>
              : <button type="button" className="rls-ib" aria-label="Silenciar" onClick={() => yt.sonido(false)}><Ico n="sonido" /></button>}
          </div>
          {Lineas}
          <div className="rls-riel">
            <button type="button" className="rls-cara-b" aria-label={'La ficha de ' + nombres} onClick={() => { pausarMenu(); setHoja('ficha'); }}><Cara liga={F.liga} g={r.gente[0]} cls="rls-cara" /></button>
            <button type="button" className={'rls-ib' + (F.ardido ? ' ardido' : '')} aria-pressed={F.ardido} aria-label="Fuego" onClick={F.darFuego}><Ico n="fuego" lleno={F.ardido} t={28} /></button>
            <button type="button" className="rls-ib" aria-pressed={F.guardado} aria-label={F.guardado ? 'Quitar de guardados' : 'Guardar'} onClick={() => { if (F.guardar()) avisa('Guardado: lo encuentras en «Guardados»'); }}><Ico n="guardar" lleno={F.guardado} t={26} /></button>
            <button type="button" className="rls-ib" aria-label="Enviar" onClick={() => compartir(r, (c) => { setCopiado(c); if (c) avisa('Link copiado'); })}><Ico n="enviar" t={26} /></button>
            <button type="button" className="rls-ib" aria-label="Pausar y abrir el menú" onClick={pausarMenu}><Ico n="mas" t={24} /></button>
          </div>
          <div className="rls-pie-t" style={{ top: arriba + vh + 10 }}>
            <b>{nombres} <span>· {r.gente.map(puestoDe).join(' · ')}</span></b>
            {r.t ? <span className="rls-t2">{r.t}</span> : null}
            <span className="rls-canal">{r.canal}</span>
          </div>
        </>
      ) : (
        <>
          <Poster vid={r.vid} cls="rls-poster" alt={r.t || nombres} />
          <div className="rls-cab sobre">
            <button type="button" className="rls-filtro" onClick={otroFiltro}>{filtroN}<Ico n="abajo" t={18} /></button>
          </div>
          {Lineas}
          <button type="button" className="rls-play" aria-label={yt.activo ? 'Seguir viendo' : 'Ver el reel'} onClick={reproducir}><Ico n="play" t={40} /></button>
          <div className="rls-riel sobre">
            <button type="button" className={'rls-ib et' + (F.ardido ? ' ardido' : '')} aria-pressed={F.ardido} onClick={F.darFuego}><Ico n="fuego" lleno={F.ardido} t={30} />Fuego</button>
            {r.gente.length >= 2 ? <button type="button" className="rls-ib et" onClick={() => setHoja('voto')}><span className="rls-vs" aria-hidden="true">VS</span>¿Quién?</button> : null}
            <button type="button" className="rls-ib et" onClick={verBatalla}><Ico n="batalla" t={30} />{batalla ? 'Batalla' : 'Perfil'}</button>
            <button type="button" className="rls-ib et" onClick={() => compartir(r, (c) => { setCopiado(c); if (c) avisa('Link copiado'); })}><Ico n="enviar" t={28} />Enviar</button>
            <button type="button" className="rls-ib" aria-pressed={F.guardado} aria-label={F.guardado ? 'Quitar de guardados' : 'Guardar'} onClick={() => { if (F.guardar()) avisa('Guardado: lo encuentras en «Guardados»'); }}><Ico n="guardar" lleno={F.guardado} t={28} /></button>
            <button type="button" className="rls-ib" aria-label="Más opciones" onClick={() => { setCopiado(false); setHoja('mas'); }}><Ico n="mas" t={26} /></button>
          </div>
          <div className="rls-pie-m">
            <div className="rls-quien">
              <button type="button" className="rls-caras" aria-label={'La ficha de ' + nombres} onClick={() => setHoja('ficha')}>
                {r.gente.slice(0, 3).map((g) => <Cara liga={F.liga} key={g.k} g={g} cls="rls-cara" />)}
                <b>{nombres}</b>
              </button>
              <button type="button" className={'rls-perfil' + (F.loSigo(r.gente[0]) ? ' on' : '')} aria-pressed={F.loSigo(r.gente[0])}
                onClick={() => F.seguir(r.gente[0])}>{F.loSigo(r.gente[0]) ? 'Siguiendo' : 'Seguir'}</button>
            </div>
            <button type="button" className={'rls-t' + (largo ? ' largo' : '')} onClick={() => setLargo(!largo)}>
              {r.t || nombres} <span>· {r.gente.map(puestoDe).join(' · ')}</span>
            </button>
            <span className="rls-canal">{r.gente.map((g) => g.cc).filter(Boolean).slice(0, 2).map((cc, j) => <Bandera key={cc + j} cc={cc} cls="rls-flag" />)}{r.canal}{deLaLiga(r) ? <em>De la Liga</em> : dePlaza(r) ? <em>De las plazas</em> : null}</span>
          </div>
        </>
      )}

      {aviso && !hoja ? (
        <div className="rls-aviso" role="status"><span>{aviso.txt}</span>
          {aviso.deshacer ? <button type="button" onClick={() => { aviso.deshacer(); setAviso(null); }}>Deshacer</button> : null}</div>
      ) : null}

      {hoja ? (
        <div className="rls-velo" onClick={(e) => { if (e.target === e.currentTarget) setHoja(''); }}>
          <div className="rls-hoja" role="dialog" aria-label={hoja === 'ficha' ? 'La ficha' : hoja === 'voto' ? '¿Quién ganó?' : 'Más opciones'}>
            <span className="rls-asa" aria-hidden="true" />
            {hoja === 'voto' ? <Voto r={r} clase="cel" /> : hoja === 'ficha' ? (
              <>
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
function ReelsPc({ F }) {
  const [modo, setModo] = useState('menu');
  const [copiado, setCopiado] = useState(false);
  const [aviso, setAviso] = useState(null);
  const cambiando = useRef(false);
  const reloj = useRef(0);
  useEffect(() => () => clearTimeout(reloj.current), []);
  const yt = useReproductor({
    alTerminar: () => { cambiando.current = true; F.siguiente(); },
    alPausar: () => { if (!cambiando.current) setModo('menu'); },
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
  const r = F.cur;
  const fs = F.filtros;
  // 🎨 COMO LAS OTRAS PÁGINAS (8.12, Dlx: «acuérdate el estilo de la página tiene que ser como los otros»): la franja negra
  // con la etiqueta magenta (`.tag`), el título grande (`.hero-ev`) y su bajada (`.hero-p`), como Invita y gana
  const cab = (
    <div className="escena rls-esc">
      <div className="rls-esc-in">
        <div className="rls-esc-tx">
          <span className="tag">REELS{F.temp ? ' · ' + F.temp : ''}</span>
          <h1 className="hero-ev rls-h1">Los momentos de las batallas</h1>
          <p className="hero-p">Los shorts de las competencias, con quién es quién y su puesto en el Ranking global.</p>
        </div>
        <div className="rls-chips" role="group" aria-label="Qué ver">
          {fs.map(([k, n]) => <button key={k} type="button" aria-pressed={F.filtro === k} className={F.filtro === k ? 'on' : ''} onClick={() => F.setFiltro(k)}>{n}</button>)}
        </div>
      </div>
    </div>
  );
  if (!r) {
    return (
      <section className="rls-pc">{cab}
        <div className="rls-pc-in"><div className="rls-vacio"><b>{VACIO[F.filtro] || 'Todavía no hay reels'}</b><p>{VACIO_P[F.filtro] || 'Llegan más cada lunes.'}</p>
          <button type="button" className="rls-btc" onClick={() => F.setFiltro('todo')}>Ver Para ti</button></div></div>
      </section>
    );
  }
  const nombres = r.gente.map(nombre).join(' vs ');
  const batalla = batallaDe(r);
  const masReels = [1, 2, 3].map((j) => F.lista[F.i + j]).filter(Boolean);
  return (
    <section className="rls-pc">
      {cab}
      <div className="rls-pc-in">
      <div className="rls-pc-cuerpo">
        <div className="rls-pc-video">
          <div className={'rls-ytcaja' + (modo === 'teatro' && !F.fin ? '' : ' oculto')}>{yt.marco}</div>
          {F.fin ? (
            <div className="rls-fin">
              <span className="tag">REELS</span>
          <b>Viste todo lo nuevo</b>
              <p>Llegan más cada lunes. Mientras, mira quién está arriba o lo que viene en la Liga.</p>
              <a className="rls-bt prim" href="#/ranking/global">Ver el Ranking global</a>
              <a className="rls-bt" href="#/eventos">Los próximos eventos de la Liga</a>
              <button type="button" className="rls-bt sin" onClick={F.deNuevo}>Volver al primero</button>
            </div>
          ) : modo !== 'teatro' ? (
            <button type="button" className="rls-pc-poster" onClick={reproducir} aria-label={yt.activo ? 'Seguir viendo' : 'Ver el reel'}>
              <Poster vid={r.vid} cls="rls-poster" alt={r.t || nombres} />
              <span className="rls-play"><Ico n="play" t={44} /></span>
            </button>
          ) : null}
        </div>

        <aside className="rls-pc-panel">
          <div className="rls-pc-quien">
            <span className="rls-caras">{r.gente.slice(0, 3).map((g) => <Cara liga={F.liga} key={g.k} g={g} cls="rls-cara" />)}</span>
            <div>
              {r.gente.map((g) => (
                <span key={g.k} className="rls-pc-fila">
                  <a className="rls-pc-n" href={perfilDe(g)}><b>{nombre(g)}</b><Bandera cc={g.cc} cls="rls-flag" /><small>{puestoDe(g)}</small></a>
                  <button type="button" className={'rls-seguir' + (F.loSigo(g) ? ' on' : '')} aria-pressed={F.loSigo(g)} onClick={() => F.seguir(g)}>
                    {F.loSigo(g) ? 'Siguiendo' : 'Seguir'}</button>
                </span>
              ))}
            </div>
          </div>
          {r.t ? <p className="rls-pc-t">{r.t}</p> : null}
          <p className="rls-canal">{r.canal}{deLaLiga(r) ? <em>De la Liga</em> : dePlaza(r) ? <em>De las plazas</em> : null}</p>
          {r.gente.length >= 2 ? <Voto r={r} clase="pc" /> : null}
          <div className="rls-pc-acc">
            <button type="button" className={'rls-ib' + (F.ardido ? ' ardido' : '')} aria-pressed={F.ardido} aria-label="Fuego (tecla F)" onClick={F.darFuego}><Ico n="fuego" lleno={F.ardido} t={26} /></button>
            <button type="button" className="rls-ib" aria-pressed={F.guardado} aria-label={F.guardado ? 'Quitar de guardados' : 'Guardar'} onClick={() => { if (F.guardar()) avisa('Guardado: lo encuentras en «Guardados»'); }}><Ico n="guardar" lleno={F.guardado} t={24} /></button>
            {yt.mudo ? <button type="button" className="rls-btc rls-sonido-pc" onClick={() => yt.sonido(true)}><Ico n="mudo" t={20} />Activar el sonido</button>
              : <button type="button" className="rls-ib" aria-label="Silenciar (tecla M)" onClick={() => yt.sonido(false)}><Ico n="sonido" t={24} /></button>}
            <button type="button" className="rls-btc" onClick={() => {
              if (batalla) { if (yt.activo) yt.pausa(); abrirVideo({ vid: batalla, tit: nombres, link: 'https://www.youtube.com/watch?v=' + batalla }); } else location.hash = perfilDe(r.gente[0]);
            }}><Ico n="batalla" t={20} />{batalla ? 'Batalla completa' : 'Sus batallas'}</button>
          </div>
          <div className="rls-pc-acc">
            <button type="button" className={'rls-btc' + (copiado ? ' ok' : '')} onClick={async () => { try { await navigator.clipboard.writeText(linkDe(r.vid)); setCopiado(true); } catch (e) { /* sin portapapeles */ } }}>
              <Ico n={copiado ? 'listo' : 'copiar'} t={18} />{copiado ? 'Copiado' : 'Copiar link'}</button>
            <button type="button" className="rls-btc" onClick={() => {
              const canal = r.canal; const desde = F.i;
              F.menos(canal); F.siguiente();
              avisa('Vas a ver menos de ' + canal, () => { F.nomenos(canal); F.ir(desde); });
            }}><Ico n="no" t={18} />No me interesa</button>
            <a className="rls-btc" href={'https://www.youtube.com/shorts/' + r.vid} target="_blank" rel="noopener noreferrer"><Ico n="yt" t={18} />YouTube</a>
          </div>
          {masReels.length ? (
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
          ) : null}
        </aside>

        <div className="rls-pc-flechas">
          <button type="button" className="rls-ib caja" aria-label="Anterior (flecha arriba)" onClick={F.anterior}><Ico n="arriba" /></button>
          <button type="button" className="rls-ib caja prim" aria-label="Siguiente (flecha abajo)" onClick={F.siguiente}><Ico n="abajo" /></button>
          <span className="rls-teclas">↑ ↓ pasar<br />M sonido<br />F fuego</span>
        </div>
      </div>
      </div>
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
