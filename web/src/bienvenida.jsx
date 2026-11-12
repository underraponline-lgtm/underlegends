// 🎮 LA PANTALLA DE BIENVENIDA (Dlx, 19/10/2026: «mejorar esa transición como una página de un juego nuevo online…
// te sale iniciar sesión, comienza a ser parte de la Liga Global y te abre la página, el home con el tutorial», y a las
// preguntas: «primera vez, en el Inicio», «verificarse ahí mismo», y que el botón de no ahora se llame distinto —«en
// otro momento»—, «como una pantalla de bienvenida»).
//
//   1 · LA PORTADA: quién es la Liga en una pantalla —el título, tres números de verdad y las cartas de los primeros del
//       ranking—, con «Unirme a la Liga» (UN viaje a Discord: entra con tu cuenta Y te mete en DRA, el permiso `d` de
//       siempre) y «En otro momento», que la cierra y deja el recorrido de siempre.
//   2 · «COMENZÁ A SER PARTE»: al volver de Discord, la misma verificación de Mi cuenta (`Verificar` de cuenta.jsx: las
//       reglas de DRA, el país, el rol de Miembro). Con eso, «Empezar» abre el Inicio con el recorrido.
//
//   📖 DESDE EL 12/11/2026 EL PASO 1 ES PAGINADO (`Paso1`, abajo): seis páginas como las de una app en la tienda y la
//       barra del botón fija. La cinta de abajo se fue: la barra ocupa ese lugar y dos cosas moviéndose ahí competían.
//
// ⚠️ Sale UNA vez, a quien llega por primera vez al Inicio sin cuenta (`quiereBienvenida()` de primera.js); quien entra
// por un link (una llave, un perfil) va directo a eso, como siempre. Lo que pasa se cuenta (`contar()`, Dashboard).
// ⚠️ Sin degradés, sin blur y con radios chicos (las reglas del remake); con «Menos animaciones», quieta.
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Ico } from './piezas.jsx';
import { limpio, num, srcLogo, utc } from './liga.js';
import { contar, pedirRecorrido, tutoPoner } from './primera.js';
import { pedirLigas } from './ligas_datos.js';
import { VV, baseVideo, elegirHd, quieto } from './fondovideo.jsx';
import ESTILO from './bienvenida.css?inline';

const W = typeof window !== 'undefined' ? window : {};
const Verificar = lazy(() => import('./cuenta.jsx').then((m) => ({ default: m.Verificar })));
const PASO = 'lg:bienv';

function useVerif() {
  const [v, setV] = useState(() => W.VERIF || null);
  useEffect(() => {
    const f = () => setV(W.VERIF ? Object.assign({}, W.VERIF) : null);
    W.addEventListener('lg:verif', f);
    return () => W.removeEventListener('lg:verif', f);
  }, []);
  return v;
}

// 🎮 el logo de Discord, en el botón: que el salto a Discord no sorprenda (Simple Icons, CC0)
const DISCORD = 'M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z';

// ── EL PASO 1, PAGINADO (Dlx, 12/11/2026: «que sea un sistema de paginación, o sea que se pueda ir a la derecha para ver
// más cosas, pero que siempre aparezca la opción de UNIRME CON DISCORD o en otro momento, y asegúrate que explique todo
// lo que ofrecemos, como las páginas en App Store de la app… y que todo esté bien posicionado»). Seis páginas que se
// deslizan de costado (`scroll-snap`, sin librería) y una barra de abajo que no se mueve: los puntos con el nombre de cada
// página, las flechas y el botón. Cada página dice UNA cosa que trae la Liga y la muestra con lo de verdad —las cartas del
// #1, el calendario, la tabla, las crews—: «sin dato no hay pieza», así que una que no tiene con qué se arma con palabras.
const PAGINAS = [['liga', 'La Liga'], ['cartas', 'Tu carta'], ['eventos', 'Eventos'], ['ranking', 'Ranking'], ['pase', 'Pase y Tienda'], ['gente', 'Comunidad']];
const TIPOS = [['servidor', 'Servidor', 'Al verificarte'], ['temporada', 'Temporada', 'Nivel 1 del Pase'],
  ['competitivo', 'Competitiva', 'Con 10 eventos'], ['pais', 'País', '3 cruces de tu país y 3 de afuera']];

// 🎬 LAS ENTRADAS (12/11/2026, Dlx: «que esté bonito todo y con buenas animaciones de transición»): cada pieza lleva `bv-e`
// y su lugar en la fila (`--i`, en ella misma: nunca un transform desde una variable del padre), y entra cuando su página
// se ve por primera vez (`vista`). La portada ya trae las suyas (el sello, el título, las cartas): sus piezas entran detrás
const e = (i, cls) => ({ className: (cls ? cls + ' ' : '') + 'bv-e', style: { '--i': i } });

// 🎬 EL FONDO DE VIDEO (Dlx, 12/11/2026: «un video en blanco y negro de fondo… gente rapeando en cámara lenta que
// cambien»). 19 tramos de los nuestros en batallas en cámara, en loop y sin sonido: 50 s, 1,7 MB. Lo arma y lo sube
// `herramientas/bienvenida_video.py`, y vive en R2 y NO en el repo (son caras de gente real). Los créditos de los canales
// viajan con el video (`creditos.json`).
// ⚠️ Con «Menos animaciones», movimiento reducido o ahorro de datos, un cuadro quieto del mismo montaje.
// ⚠️ Qué video (la carpeta, la versión `VV`, cuándo va el HD y cuándo ninguno) sale de fondovideo.jsx, que lo comparten
// Socios y el Salón: un solo lugar, o al rearmar el video una página seguiría mostrando el viejo
function Fondo({ base }) {
  const [sinVideo] = useState(quieto);
  // 🖥️ EL DE 1280 × 720 DONDE LA PANTALLA TIENE LOS PÍXELES PARA VERLO (Dlx: «el video no está en HD»: el de 640 se veía
  // a píxeles en 1454 px; y después, «haz lo mismo en la versión del teléfono»). Se mide en píxeles de verdad, no de CSS:
  // un teléfono de 390 con densidad 3 tiene 1.170, y ahí el de 640 también se veía blando. El de 640 queda para pantallas
  // de verdad chicas; con ahorro de datos no va ninguno (el cuadro quieto). Se elige una vez, al abrir
  const [hd] = useState(elegirHd);
  // `muted` como propiedad Y antes de play(): React no lo pone como atributo y sin eso el navegador no lo arranca solo
  const arrancar = (v) => { if (v) { v.muted = true; const p = v.play(); if (p && p.catch) p.catch(() => { /* queda el póster */ }); } };
  return (
    <div className="bv-fondo" aria-hidden="true">
      {sinVideo ? <img alt="" src={base + 'poster.jpg' + VV} />
        : <video ref={arrancar} src={base + (hd ? 'montaje-hd.mp4' : 'montaje.mp4') + VV} poster={base + 'poster.jpg' + VV} autoPlay muted loop playsInline preload="auto" />}
      <i className="bv-vineta" />
      <svg className="bv-grano"><filter id="bv-gr"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" /></filter><rect width="100%" height="100%" filter="url(#bv-gr)" /></svg>
    </div>
  );
}

// 🔤 el título letra por letra (cada una cae con su demora); los espacios no son letras
// (el espacio es un espacio de verdad, no una caja: así mide lo mismo que el relleno de video, que va encima letra con letra)
const letras = (txt, d0) => [...txt].map((ch, i) => (ch === ' ' ? ' '
  : <span key={i} className="bv-l" style={{ '--d': d0 + i * 45 + 'ms' }}>{ch}</span>));

// 🔢 un número que cuenta desde cero una vez, al entrar (quieto: el número de una)
function useCuenta(meta, demora = 1200, dura = 1300) {
  const [n, setN] = useState(() => (quieto() ? meta : 0));
  useEffect(() => {
    if (quieto() || !meta) { setN(meta); return undefined; }
    let raf = 0;
    const t0 = performance.now() + demora;
    const paso = (t) => {
      const p = Math.max(0, Math.min(1, (t - t0) / dura));
      setN(Math.round(meta * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [meta]);
  return n;
}

// 🃏 LA CARTA QUE SE TURNA (Dlx, 12/11/2026: «variar e intercalar con la tarjeta del ranking competitivo o de liga»): la
// de Temporada del #1, la Competitiva del #1 del competitivo y la de liga del líder con más OVR. Cada 6 s gira a la
// siguiente; con transiciones y no con keyframes, así un cambio a mitad de giro sale del punto en que estaba
// (la caja de las cartas tiene alto fijo y las cartas van abajo de todo: la leyenda va FUERA de la caja, debajo; adentro
// quedaba arriba, detrás de la carta)
// 🃏 Y LAS DE ATRÁS SON DEL MISMO RANKING (Dlx, 12/11/2026: «cuando se cambia de ranking de tarjeta, las 2 de atrás, o
// sea el 2.º y el 3.º, no cambian, se quedan en temporada»): cada carta trae su #2 y su #3 (`atras`), y cambian con ella
function Rota({ cartas }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (cartas.length < 2 || quieto()) return undefined;
    const t = setInterval(() => setI((x) => (x + 1) % cartas.length), 6000);
    return () => clearInterval(t);
  }, [cartas.length]);
  const on = Math.min(i, cartas.length - 1);
  return (
    <>
      <div className="bv-cartas">
        {[0, 1].map((j) => (
          <span key={j} className={'bv-atras a' + j} aria-hidden="true"><span className="bv-atras-f">{cartas.map((c, k) => (c.atras && c.atras[j]
            ? <img key={c.id} alt="" src={c.atras[j]} className={c.forma + (k === on ? ' on' : '')} /> : null))}</span></span>
        ))}
        <div className="bv-rota">{cartas.map((c, k) => (
          <span key={c.id} className={'bv-rota-c ' + c.forma + (k === on ? ' on' : k < on ? ' fue' : '')}><img alt={c.alt} src={c.src} /></span>
        ))}</div>
      </div>
      <p className="bv-rota-pie" key={on}><b>{cartas[on].que}</b> · {cartas[on].quien}</p>
    </>
  );
}

function Pagina({ id, vista, sello, titulo, etiqueta, texto, puntos, extra, visual, primera, tit }) {
  const o = primera ? 8 : 0;
  return (
    <section className={'bv-pag bv-pag-' + id + (vista ? ' vista' : '')} aria-roledescription="página" aria-label={sello}>
      <div className="bv-pag-tx">
        {primera ? <span className="bv-sello">{sello}</span> : <span {...e(0, 'bv-kick')}>{sello}</span>}
        {primera ? <h1 className="bv-t" id="bv-t" tabIndex={-1} ref={tit} aria-label={etiqueta}>{titulo}</h1> : <h2 {...e(1, 'bv-h')}>{titulo}</h2>}
        <p {...e(o + 2, 'bv-p')}>{texto}</p>
        {extra ? <div {...e(o + 3)}>{extra}</div> : null}
        {puntos ? <ul className="bv-puntos">{puntos.map(([ico, t], k) => <li key={t} {...e(o + 3 + k)}><Ico n={ico} t={18} /><span>{t}</span></li>)}</ul> : null}
      </div>
      {/* (el número grande de atrás —«01»…— se fue el 12/11/2026, Dlx: «quita ese 01 de arriba»: con el video detrás
          era una cosa más compitiendo) */}
      <div className="bv-pag-vis">{visual}</div>
    </section>
  );
}

function Paso1({ liga, unirme, cerrar, tit }) {
  const [pag, setPag] = useState(0);
  const [vistas, setVistas] = useState(() => new Set([0]));
  const pista = useRef(null);
  useEffect(() => { setVistas((v) => (v.has(pag) ? v : new Set([...v, pag]))); }, [pag]);
  // la página que se ve sale del scroll (deslizar con el dedo también cuenta), no de un estado aparte que se desfasa.
  // 🎬 Y EL PARALAJE, ATADO AL DEDO: en la misma vuelta de cuadro, cada página sabe a qué distancia está del centro (`d`,
  // de -1 a 1) y sus tres capas se corren distinto —el texto casi con la página, la imagen más lenta y un poco más chica,
  // el número de atrás más lento todavía—. Es transform y opacidad puestos en cada pieza: no hay layout ni pintura, y
  // como sale del scroll se frena, vuelve y sigue al dedo sin que haya una animación que interrumpir
  useEffect(() => {
    const el = pista.current;
    if (!el) return undefined;
    let t = 0;
    const mover = () => {
      const w = Math.max(1, el.clientWidth), x = el.scrollLeft;
      setPag(Math.round(x / w));
      const quieto = (W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches) || !!document.querySelector('.calma');
      Array.prototype.forEach.call(el.children, (pg, i) => {
        const tx = pg.firstElementChild, vis = pg.lastElementChild;
        if (!tx || !vis) return;
        const d = Math.max(-1, Math.min(1, (i * w - x) / w)), a = Math.abs(d);
        if (quieto || a < 0.001) {
          tx.style.transform = vis.style.transform = tx.style.opacity = vis.style.opacity = '';
          return;
        }
        tx.style.transform = 'translate3d(' + (-d * 36).toFixed(1) + 'px,0,0)';
        tx.style.opacity = (1 - a * 0.45).toFixed(3);
        vis.style.transform = 'translate3d(' + (-d * 120).toFixed(1) + 'px,0,0) scale(' + (1 - a * 0.06).toFixed(3) + ')';
        vis.style.opacity = (1 - a * 0.65).toFixed(3);
      });
    };
    const ver = () => { cancelAnimationFrame(t); t = requestAnimationFrame(mover); };
    el.addEventListener('scroll', ver, { passive: true });
    W.addEventListener('resize', ver);
    ver();
    return () => { el.removeEventListener('scroll', ver); W.removeEventListener('resize', ver); cancelAnimationFrame(t); };
  }, []);
  const ir = (i) => {
    const el = pista.current;
    const n = Math.max(0, Math.min(PAGINAS.length - 1, i));
    if (!el) return;
    const quieta = (W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches) || document.querySelector('.calma');
    el.scrollTo({ left: n * el.clientWidth, behavior: quieta ? 'auto' : 'smooth' });
  };
  // ← → también con el teclado (Escape ya es «En otro momento»)
  useEffect(() => {
    const tecla = (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); ir(pag + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); ir(pag - 1); }
    };
    W.addEventListener('keydown', tecla);
    return () => W.removeEventListener('keydown', tecla);
  });
  // ⏩ PASA SOLA A LA DERECHA CADA 10 s (Dlx, 12/11/2026: «que se mueva solo para la derecha… cada 10 s ponle»), con una
  // barrita celeste que se llena debajo de la página en la que estás. Llega a la última y se queda.
  // ♿ En cuanto la persona toca algo —desliza, una flecha, un punto, el teclado— deja de moverse sola: ya maneja ella, y
  // un carrusel que sigue avanzando debajo del dedo es justo lo que no tiene que pasar. Quieta, nunca arranca
  const [auto, setAuto] = useState(() => !quieto());
  useEffect(() => {
    if (!auto) return undefined;
    const para = () => setAuto(false);
    const ev = ['pointerdown', 'wheel', 'keydown', 'touchstart'];
    ev.forEach((x) => W.addEventListener(x, para, { passive: true }));
    return () => ev.forEach((x) => W.removeEventListener(x, para));
  }, [auto]);
  useEffect(() => {
    if (!auto || pag >= PAGINAS.length - 1) return undefined;
    const t = setTimeout(() => ir(pag + 1), 10000);
    return () => clearTimeout(t);
  }, [auto, pag]);

  const top = liga.oficiales().filter((f) => f.k && liga.cartaDe(f.k)).slice(0, 3);
  const svs = (liga.d.svs || []).map((s) => (typeof s === 'string' ? s : s && s.sv)).filter(Boolean);
  // 👥 los miembros de los servidores de la Liga, sumados (Dlx: «la cantidad de usuarios totales… para sorprender»).
  // Es una suma de membresías: quien está en dos servidores cuenta dos veces, y por eso dice «miembros» y no «personas»
  const miembros = (liga.d.svs || []).reduce((s, x) => s + ((x && x.miembros) || 0), 0);
  const nMiembros = useCuenta(miembros);
  const base = baseVideo(liga);
  const [lider, setLider] = useState(null);
  useEffect(() => {
    let vivo = true;
    // 🏟️ el líder de liga con más OVR: del mismo pedido que ya hace el Inicio (`pedirLigas`), no de uno nuevo
    pedirLigas(liga.d.sello).then((x) => {
      if (!vivo || !x || !x.cartas) return;
      let m = null;
      Object.entries(x.cartas).forEach(([k, l]) => (l || []).forEach((c) => { if (c[3] === 1 && k !== 'dlx' && (!m || c[2] > m[2][2])) m = [k, c[0], c]; }));
      if (!m) return;
      const L = (((x.lobby || {}).ligas) || []).find((y) => y.id === m[1]);
      const f = liga.T[m[0]];
      const atras = [2, 3].map((pu) => {
        const e = Object.entries(x.cartas).find(([k, l]) => k !== 'dlx' && (l || []).some((c) => c[0] === m[1] && c[3] === pu));
        if (!e) return null;
        const c = e[1].find((y) => y[0] === m[1] && y[3] === pu);
        return liga.d.r2 + '/' + encodeURIComponent(e[0]) + '/liga-' + m[1] + '.webp?v=' + c[1];
      });
      setLider({ k: m[0], lid: m[1], v: m[2][1], n: f ? f.n : m[0], liga: L ? L.n : '', atras });
    }).catch(() => { /* sin la de liga, se turnan dos */ });
    return () => { vivo = false; };
  }, []);
  // las que se turnan: la de Temporada del #1, la Competitiva del #1 del competitivo y la de liga del líder. «Sin dato no
  // hay pieza»: la que no existe no entra
  const comps = liga.oficiales().filter((f) => f.k && f.rg && !f.fc && (f.c || []).includes('competitivo')).sort((a, b) => (b.sc || 0) - (a.sc || 0));
  const comp = comps[0];
  const temp = (f) => (f ? liga.cartaUrl(f.k, liga.cartaDe(f.k)) : null);
  const rota = [
    top[0] && { id: 't', forma: 'rect', src: liga.cartaUrl(top[0].k, liga.cartaDe(top[0].k)), alt: 'Carta de ' + limpio(top[0].n) + ', #1 de la temporada', que: '#1 de la temporada', quien: limpio(top[0].n),
      atras: [temp(top[1]), temp(top[2])] },
    comp && { id: 'c', forma: 'escudo', src: liga.cartaUrl(comp.k, 'competitivo'), alt: 'Carta Competitiva de ' + limpio(comp.n) + ', #1 del competitivo', que: '#1 del competitivo', quien: limpio(comp.n),
      atras: comps.slice(1, 3).map((f) => liga.cartaUrl(f.k, 'competitivo')) },
    lider && { id: 'l', forma: 'afiche', src: liga.d.r2 + '/' + encodeURIComponent(lider.k) + '/liga-' + lider.lid + '.webp?v=' + lider.v,
      alt: 'Carta de liga de ' + limpio(lider.n), que: lider.liga ? '#1 de ' + lider.liga : '#1 de su liga', quien: limpio(lider.n), atras: lider.atras },
  ].filter((c) => c && c.src);
  const nombreSv = (s) => ((liga.svs || {})[s] || {}).nombre || s;
  const carta = (k, cual, cls) => (
    <img className={cls} alt="" src={liga.cartaUrl(k, cual)}
      srcSet={liga.cartaUrl(k, cual, true) + ' 300w, ' + liga.cartaUrl(k, cual) + ' 900w'} sizes="(max-width: 899px) 120px, 220px"
      onError={(e) => { const g = liga.cartaUrl(k, cual); if (e.currentTarget.currentSrc !== g) { e.currentTarget.srcset = ''; e.currentTarget.src = g; } }} />
  );
  let ult = null;
  try { const c = liga.muroLimpio().find((it) => it.tipo === 'campeon'); ult = c ? liga.itemMuro(c) : null; } catch (e) { ult = null; }
  // 🃏 las cuatro cartas, de quien tenga más (el primero que tenga las cuatro, si hay)
  const ofi = liga.oficiales();
  const conTodas = ofi.find((f) => f.k && TIPOS.every(([t]) => (f.c || []).includes(t))) || ofi.find((f) => f.k && (f.c || []).length);
  // 📅 lo que viene en el calendario; si no hay nada por venir, lo último que se jugó
  const ahora = liga.ahora || Date.now();
  // (sin nombre de verdad no va: una fila «(sin título)» no le dice nada a quien llega)
  const cal = (liga.d.calendario || []).filter((e) => e && e.t && e.n && !/^\(?sin t[ií]tulo\)?$/i.test(String(e.n).trim()));
  const vienen = cal.filter((e) => utc(e.t) > ahora).sort((a, b) => utc(a.t) - utc(b.t));
  const evs = (vienen.length ? vienen : cal.filter((e) => e.jugado).sort((a, b) => utc(b.t) - utc(a.t))).slice(0, 4);
  const enVivo = (() => { try { return liga.vivo().length; } catch (e) { return 0; } })();
  const rangos = liga.d.rangos || [];
  const tienda = liga.d.tienda || {};
  const crews = (liga.d.crews || []).slice(0, 3);
  const com = liga.d.comunidad || {};
  const ligas = (() => { try { return liga.ligas(); } catch (e) { return []; } })();

  const visuales = {
    liga: (
      <div className="bv-v-liga">
        {/* el #2 y el #3, apagados y flotando detrás; adelante, la que se turna */}
        {rota.length ? <Rota cartas={rota} /> : null}
        <p className="bv-top">{top.length === 3 ? <>Los tres primeros de la temporada: <b>{limpio(top[0].n)}</b>, {limpio(top[1].n)} y {limpio(top[2].n)}</> : null}</p>
        {ult ? <p {...e(10, 'bv-ult')}><Ico n="copa" t={16} /><span>{ult[1]}</span><small>{ult[3]}</small></p> : null}
      </div>
    ),
    cartas: conTodas ? (
      <div className="bv-v-cartas">
        <ol>{TIPOS.map(([t, n, como], k) => (
          <li key={t} {...e(2 + k, 'bv-ec')}>
            {(conTodas.c || []).includes(t) ? carta(conTodas.k, t, 'bv-c4') : <span className="bv-sil grande" aria-hidden="true">?</span>}
            <b>{n}</b><small>{como}</small>
          </li>
        ))}</ol>
        <p {...e(7, 'bv-pie')}>Las cartas de {limpio(conTodas.n)}, #{conTodas.pos} de la temporada</p>
      </div>
    ) : null,
    eventos: evs.length ? (
      <div {...e(1, 'bv-v-lista')}>
        <p className="bv-v-t">{vienen.length ? 'Lo que viene' : 'Lo último que se jugó'}{enVivo ? <em>● {enVivo} en vivo ahora</em> : null}</p>
        <ul>{evs.map((ev, k) => (
          <li key={ev.t + ev.n} {...e(3 + k)}><img alt="" src={liga.logo(ev.sv)} /><span><b>{limpio(ev.n)}</b><small>{nombreSv(ev.sv)}</small></span>
            <time>{vienen.length ? liga.dia(ev.t) : liga.cuando(ev.t)}</time></li>
        ))}</ul>
      </div>
    ) : null,
    ranking: ofi.length ? (
      <div {...e(1, 'bv-v-lista')}>
        <p className="bv-v-t">La tabla de hoy</p>
        <ol className="bv-tabla">{ofi.slice(0, 5).map((f, k) => (
          <li key={f.k || f.n} {...e(3 + k)}><span className="bv-pos">{f.pos}</span><b>{limpio(f.n)}</b>
            {f.rg ? <i className="bv-rg" style={{ '--c': f.rgc || liga.colorRg(f.rg) }}>{f.rg}</i> : null}<span className="bv-pts">{num(f.pts || 0)}</span></li>
        ))}</ol>
        {rangos.length ? <p {...e(8, 'bv-rangos')} aria-label="Los rangos, de arriba a abajo">{rangos.map((r) => <i key={r.r} style={{ '--c': r.color }}>{r.r}</i>)}</p> : null}
      </div>
    ) : null,
    pase: (
      <div className="bv-v-pase">
        <ol className="bv-niveles">{[[1, 'Tu carta de Temporada'], [8, 'Tu carta brilla en las llaves'], [30, 'El Salón del Pase']].map(([n, t], k) => (
          <li key={n} {...e(2 + k)}><b>{n}</b><span>{t}</span></li>
        ))}</ol>
        {tienda.inicial ? <p {...e(5, 'bv-moneda')}><Ico n="moneda" t={22} /><span><b>{num(tienda.inicial)}</b> Puntos de Tienda para empezar</span></p> : null}
      </div>
    ),
    gente: (
      <div {...e(1, 'bv-v-lista')}>
        {crews.length ? <><p className="bv-v-t">Las crews de arriba</p>
          <ol className="bv-crews">{crews.map((c, i) => (
            <li key={c.clave || c.crew} {...e(3 + i)}><span className="bv-pos">{i + 1}</span>{c.logo ? <img alt="" src={srcLogo(c.logo)} /> : <i className="bv-sinlogo" aria-hidden="true" />}
              <span><b>{limpio(c.crew)}</b><small>{c.n} raperos</small></span><span className="bv-pts">{num(c.pts || 0)}</span></li>
          ))}</ol></> : null}
        <p {...e(7, 'bv-cifras')}>{com.personas ? <span><b>{num(com.personas)}</b> personas en los servidores</span> : null}
          {ligas.length ? <span><b>{ligas.length}</b> ligas de los servidores</span> : null}</p>
      </div>
    ),
  };

  const paginas = [
    // 🔤 «LIGA GLOBAL» cae letra por letra y después se llena con cuadros del mismo montaje (Dlx: «ese estilo para la
    // letra de la Liga Global está buenísimo»); lo lee una sola vez quien usa lector (`aria-label`)
    { id: 'liga', sello: 'TEMPORADA ' + String(liga.temp || '').replace(/^T/i, '') + ' · EN JUEGO',
      etiqueta: 'Liga Global de Freestyle',
      titulo: <>
        <span className="bv-t1"><span className="bv-t-bl">{letras('LIGA GLOBAL', 100)}</span>
          {[1, 2, 3].map((q) => <span key={q} className={'bv-t-rel r' + q} style={{ '--q': 'url(' + base + 'quieto' + q + '.jpg' + VV + ')' }}>LIGA GLOBAL</span>)}</span>
        <span className="bv-t2">{letras('DE FREESTYLE', 620)}</span></>,
      texto: 'El ranking de los servidores de freestyle de Discord. Juega en el tuyo, sube en la tabla y gana tu carta.',
      extra: svs.length ? (
        <div className="bv-cifras-p">
          {miembros ? <p className="bv-miembros"><b>{num(nMiembros)}</b><small>miembros en<br />los {svs.length} servidores</small></p> : null}
          <div className="bv-svs">
            {liga.d.gente ? <span><b>{num(liga.d.gente)}</b><small>en el ranking</small></span> : null}
            <span><b>{svs.length}</b><small>socios</small></span>
            <span><b>{num(liga.d.eventos || 0)}</b><small>eventos</small></span>
          </div>
        </div>
      ) : null },
    { id: 'cartas', sello: 'TU CARTA', titulo: 'Cuatro cartas, una por lo que haces',
      texto: 'Se dibujan con tu foto y tu bandera, y se ponen al día solas cada vez que juegas.',
      puntos: [['tarjetas', 'La de Servidor sale apenas te verificas'], ['pase', 'La de Temporada, con el nivel 1 del Pase'], ['ranking', 'La Competitiva y la de País, jugando']] },
    { id: 'eventos', sello: 'EVENTOS', titulo: 'Todos los eventos, en un solo calendario',
      texto: 'Los de todos los servidores de la Liga, con su hora en la tuya. Y mientras se juegan, la llave en vivo.',
      puntos: [['campana', 'La campana te avisa cuando anuncian uno'], ['micro', 'El bot cuenta cada batalla en el chat de su servidor'], ['moneda', 'Votas y apuestas quién gana cada cruce']] },
    { id: 'ranking', sello: 'RANKING', titulo: 'Cada batalla suma',
      texto: 'Tus puntos de todos los servidores, en una sola tabla. Ocho rangos, de SSS a E.',
      puntos: [['ranking', 'Temporada, Competitivo, Duelos, Países y Crews'], ['copa', 'Los mejores clasifican al cierre de la temporada'], ['perfil', 'Tu perfil con tus números y tus rivales']] },
    { id: 'pase', sello: 'PASE Y TIENDA', titulo: 'Tareas, niveles y premios',
      texto: 'El Pase de rapero tiene 30 niveles por temporada: subes con las Tareas del día, de la semana y de la temporada.',
      puntos: [['pase', 'Cada nivel trae un premio para tu perfil'], ['tienda', 'Puntos de Tienda para apostar y cazar cabezas'], ['fuego', 'Tu racha de días y tu nivel en la Liga']] },
    { id: 'gente', sello: 'COMUNIDAD', titulo: 'Tu crew, tus ligas, tu gente',
      texto: 'Arma tu crew o súmate a una, sigue las ligas de cada servidor y a los raperos que te gustan.',
      puntos: [['socios', 'Crews con sus propios tiers'], ['ligas', 'Las ligas de los servidores, fecha a fecha'], ['seguir', 'Sigue a quien quieras y entérate cuando gana']] },
  ];
  const ultima = pag >= PAGINAS.length - 1;

  return (
    <>
      <Fondo base={base} />
      {/* 🏷️ la marca, como en las cartas: el UL y la temporada, en blanco (Dlx: «el típico UL blanco y el T1 blanco») */}
      <div className="bv-arriba">
        <span className="bv-marca"><img alt="Under Legends" src="/ul-blanco.png" width="160" height="130" /><i aria-hidden="true" /><b>{String(liga.temp || 'T1').toUpperCase()}</b></span>
        {/* (los canales de los clips iban acá a la derecha: Dlx, 12/11/2026, «quita esas letras de arriba a la derecha».
            Siguen escritos en `creditos.json` y en `herramientas/bienvenida_video.py`) */}
      </div>
      <div className="bv-pista" ref={pista} tabIndex={-1}>
        {paginas.map((p, i) => (
          <Pagina key={p.id} {...p} vista={vistas.has(i)} primera={i === 0} tit={tit} visual={visuales[p.id]} />
        ))}
      </div>
      {/* 🔒 LA BARRA DE ABAJO NO SE MUEVE: Dlx, «que siempre aparezca la opción de UNIRME CON DISCORD o en otro momento».
          🎬 Y DESDE EL 12/11/2026 VA SIN BARRA (Dlx eligió la A de https://claude.ai/artifact/AgSZ13KSdtpdE8J9gQyC3Y: «se ve
          horrible la verdad»): sin fondo, sin la línea rosada y sin flechas, los puntos a la izquierda y el botón a la derecha,
          sobre el video. Se pasa de página deslizando, tocando un punto o con ← → (lo mismo que pidió para la barra del
          teléfono: «no me gustaría que tenga esa línea ni la flecha, se ve feo») */}
      <div className="bv-barra">
        <nav className="bv-nav" aria-label="Páginas de la bienvenida">
          <ol className="bv-puntos-nav">{PAGINAS.map(([id, n], i) => (
            <li key={id}><button type="button" className={i === pag ? 'on' : ''} aria-current={i === pag ? 'step' : undefined} onClick={() => ir(i)}>
              <i aria-hidden="true" /><span>{n}{auto && i === pag && !ultima ? <em className="bv-avance" key={pag} aria-hidden="true" /> : null}</span></button></li>
          ))}</ol>
        </nav>
        <div className="bv-acc">
          <button type="button" className="bv-si" onClick={unirme}>
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d={DISCORD} /></svg>Unirme con Discord</button>
          <div className="bv-acc-2">
            <button type="button" className="bv-luego" onClick={() => cerrar('luego')}>En otro momento</button>
            {/* (la nota «Te sumamos a Discord Rap Español… nunca tu contraseña» se fue el 12/11/2026, Dlx: «está de más… e
                incluso puede asustar a la gente». Lo que pide el permiso lo dice Discord en su propia pantalla) */}
          </div>
        </div>
      </div>
    </>
  );
}

export default function Bienvenida({ liga, dc }) {
  const [paso, setPaso] = useState(() => { try { return W.sessionStorage.getItem(PASO) === 'paso2' ? 2 : 1; } catch (e) { return 1; } });
  const [sale, setSale] = useState(false);
  const [cerrada, setCerrada] = useState(false);
  const tit = useRef(null);
  const cerrarRef = useRef(() => {});
  const v = useVerif();
  useEffect(() => { contar(paso === 2 ? 'bienv_paso2' : 'bienv'); }, [paso]);
  // mientras está abierta, la página de atrás no se mueve
  useEffect(() => {
    if (cerrada) return undefined;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => { document.documentElement.style.overflow = prev; };
  }, [cerrada]);
  // ♿ una ventana de verdad: el foco arranca en el título (no en el botón: un Enter sin querer no te manda a Discord) y
  // Escape es «En otro momento»
  useEffect(() => {
    if (cerrada) return undefined;
    try { if (tit.current) tit.current.focus({ preventScroll: true }); } catch (e) { /* sin foco */ }
    const tecla = (e) => { if (e.key === 'Escape') { e.preventDefault(); cerrarRef.current('luego'); } };
    W.addEventListener('keydown', tecla);
    return () => W.removeEventListener('keydown', tecla);
  }, [cerrada, paso]);
  if (cerrada) return null;

  const cerrar = (como) => {
    tutoPoner({ bienv: como });
    try { W.sessionStorage.removeItem(PASO); } catch (e) { /* nada */ }
    contar(como === 'listo' ? 'bienv_listo' : 'bienv_luego');
    setSale(true);
    setTimeout(() => {
      setCerrada(true);
      // desde el paso 2 se vuelve al Inicio y arranca el recorrido (desde el 1 ya está ahí y arranca solo)
      if (paso === 2) {
        try { W.location.hash = '#/'; } catch (e) { /* queda */ }
        setTimeout(pedirRecorrido, 400);
      }
    }, 380);
  };
  const unirme = () => {
    contar('bienv_unirse');
    try { W.sessionStorage.setItem(PASO, 'paso2'); } catch (e) { /* sin sesión: igual se verifica en Mi cuenta */ }
    tutoPoner({ bienv: 'unirse' });
    if (W.urlLogin) W.location.href = W.urlLogin('d');
  };

  cerrarRef.current = cerrar;
  const listo = !!((dc && dc.rapero) || (v && (v.listo || v.completo)));

  return (
    <div className={'bv' + (sale ? ' sale' : '')} role="dialog" aria-modal="true" aria-labelledby="bv-t">
      <style>{ESTILO}</style>
      {paso === 1 ? (
        <Paso1 liga={liga} unirme={unirme} cerrar={cerrar} tit={tit} />
      ) : (
        <div className="bv-c bv-p2">
          <span className="bv-sello">{listo ? 'YA ESTÁS ADENTRO' : 'UN PASO MÁS'}</span>
          <h1 className="bv-t chico" id="bv-t" tabIndex={-1} ref={tit}><span>{listo ? 'BIENVENIDO A LA' : 'COMIENZA A SER PARTE DE LA'}</span><span>LIGA GLOBAL</span></h1>
          {listo ? <p className="bv-p">Ya eres parte. Ahora te mostramos dónde está cada cosa: los eventos, el ranking, tu tarjeta y el Pase.</p>
            : <div className="bv-ver"><Suspense fallback={<p className="bv-p">Mirando tu cuenta…</p>}><Verificar liga={liga} dc={dc} /></Suspense></div>}
          <button type="button" className={listo ? 'bv-si' : 'bv-luego'} onClick={() => cerrar(listo ? 'listo' : 'luego')}>
            {listo ? <>Empezar<Ico n="flecha" t={22} /></> : 'Seguir después'}</button>
        </div>
      )}
    </div>
  );
}

// para que App.jsx la baje sólo cuando hace falta
export { PASO };
