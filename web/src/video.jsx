// ── El video de YouTube, en la página. Dlx, 01/10/2026: «lo del video se ve algo raro» (la miniatura de 320×180
// estirada al ancho del escenario) y «deja que se vea el video en la página misma, así se soluciona el problema».
//
// 🔑 SE TOCA ▶ Y SE MIRA ACÁ, en una ventana encima de la página. El escenario sigue mostrando la miniatura —ahora la
// grande, 1280×720— y el reproductor se abre aparte: adentro del carrusel quedaba sonando cuando el escenario pasaba
// solo al momento siguiente, cada 15 segundos.
//
// ⚠️ NADA DE YOUTUBE ANTES DE TOCAR PLAY, salvo la miniatura: el reproductor (youtube-nocookie.com) se carga recién
// con el toque. Lo dice la privacidad. Y se cierra con la X, con Escape o tocando afuera: al cerrarse, deja de sonar.
import { useEffect, useRef, useState } from 'react';

/** La miniatura más grande que tenga el video: `hq720` (1280×720) y, si no existe, `hqdefault` (480×360).
 *
 * ⚠️ CUANDO NO EXISTE, YOUTUBE NO DA UN ERROR: contesta 404 CON UNA IMAGEN, el cuadrito gris de 120×90 con «…», y
 * Chrome la dibuja como si nada (dispara `load`, no `error`). Pasó el 12/10/2026 en el perfil de Makmah: su primer
 * video salía gris. Por eso también se cambia cuando lo que cargó mide 120 de ancho. */
// 🧠 los videos que ya sabemos que no tienen `hq720` (revisión 21/11: el 404 quedaba en la consola en cada visita a Socios,
// con los Shorts y los videos viejos). Se recuerdan en este navegador y la próxima vez se pide `hqdefault` de una.
// Sólo una comodidad: si el almacenamiento no anda, se vuelve a probar como antes
const CHICOS = 'lg:yt-chico';
const chicos = () => { try { return JSON.parse(localStorage.getItem(CHICOS) || '[]') || []; } catch (e) { return []; } };
const anotarChico = (vid) => {
  try { const xs = chicos().filter((x) => x !== vid); xs.push(vid); localStorage.setItem(CHICOS, JSON.stringify(xs.slice(-200))); } catch (e) { /* sin almacenamiento */ }
};
export function Miniatura({ vid, cls }) {
  const chico = chicos().includes(vid);
  const atras = (im) => {
    if (!im.dataset.atras) { im.dataset.atras = '1'; anotarChico(vid); im.src = 'https://i.ytimg.com/vi/' + vid + '/hqdefault.jpg'; }
  };
  return (
    <img className={cls} alt="" src={'https://i.ytimg.com/vi/' + vid + (chico ? '/hqdefault.jpg' : '/hq720.jpg')} loading="lazy" decoding="async" data-atras={chico ? '1' : undefined}
      onLoad={(e) => { if (e.currentTarget.naturalWidth <= 120) atras(e.currentTarget); }}
      onError={(e) => atras(e.currentTarget)} />
  );
}

/** Abre el reproductor desde cualquier lado: `abrirVideo({vid, tit, link, vertical})`. `vertical` (o un link de `/shorts/`)
 *  lo abre parado, 9:16 (24/11/2026, Dlx: «que se adapte y se ponga vertical en vez de quedarse cuadrado»).
 *  🎬 Y `abrirVideo({mp4, portada, tit})`: un short nuestro de R2 (los de la Liga, `web/src/archivo_ul.js`), con el
 *  reproductor del navegador y parado. Nada de YouTube en ese caso.
 *  🎧 Y `abrirVideo({audio, tit})`: una batalla entera en audio (la llave), en una caja baja */
export function abrirVideo(v) {
  window.dispatchEvent(new CustomEvent('lg:video', { detail: v }));
}

// ── 🎧 UNA BATALLA ENTERA EN AUDIO, SOBRE SU ESCENARIO (25/11/2026, Dlx: «all of them» y, al verla: «el VS de nuestros fondos,
// dependiendo del servidor… los timestamps de cada ronda en vez de cada turno… lo de las letras abajo quítalo y agrega la
// opción para quitar subtítulos, prendida por defecto» y «que la tarjeta reaccione, así como planeábamos para los shorts,
// cuando uno hable»). `det` es el json del robot (`archivo_reels.detalle()`): {turnos: [[t, nombre]], letra: [[t, texto]],
// calor: [0–9 cada 5 s]}. Sin él, sólo el reproductor
const mmss = (t) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
const nrm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

// 🌆 EL FONDO DEL VS DE CADA SERVIDOR, como el VS del bot (`_fondo_vs()` de bot/kit.py): el que subió el servidor (una url),
// el aprobado que eligió en su panel (`repo:vs:<x>` / `repo:ev:<x>`) o el suyo. Los grandes viven en /vsfondos/hd/
// (herramientas/vsfondos_hd.py); `/api/avisos/vs-fondos` se pide una vez por visita
let pedidoVs = null;
const bajarVs = () => (pedidoVs = pedidoVs || fetch('/api/avisos/vs-fondos').then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
function useFondoVs(sv) {
  const [m, setM] = useState(null);
  useEffect(() => {
    let vivo = true;
    if (sv) bajarVs().then((x) => { if (vivo) setM(x || {}); });
    return () => { vivo = false; };
  }, [sv]);
  if (!sv) return '';
  const u = (m || {})[String(sv).toUpperCase()] || '';
  if (/^repo:(vs|ev):[a-z0-9-]+$/.test(u)) { const [, c, x] = u.split(':'); return '/vsfondos/hd/' + c + '-' + x + '.webp'; }
  if (/^https:\/\//.test(u)) return u;
  return '/vsfondos/hd/vs-' + String(sv).toLowerCase() + '.webp';
}

// 🔊 LA TARJETA DE QUIEN RAPEA REACCIONA A SU VOZ: el volumen del audio (un analizador del navegador) va a `--vol` (0–1) del
// escenario en cada cuadro, sin pasar por React; el CSS lo usa sólo en el lado encendido. Necesita el audio con CORS (R2 lo
// da a la página: `crossOrigin`). Si el navegador no deja, la tarjeta queda quieta y el audio suena igual
function useVolumen(au, esc) {
  const r = useRef(null);
  const arrancar = () => {
    const a = au.current;
    if (!a || r.current === false) return;
    try {
      if (!r.current) {
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) { r.current = false; return; }
        const ctx = new C();
        const src = ctx.createMediaElementSource(a);
        const an = ctx.createAnalyser();
        an.fftSize = 512;
        src.connect(an); an.connect(ctx.destination);
        r.current = { ctx, an, buf: new Uint8Array(an.fftSize), v: 0, raf: 0 };
      }
      const x = r.current;
      if (x.ctx.state === 'suspended') x.ctx.resume().catch(() => {});
      cancelAnimationFrame(x.raf);
      const paso = () => {
        x.an.getByteTimeDomainData(x.buf);
        let s = 0;
        for (let i = 0; i < x.buf.length; i++) { const d = (x.buf[i] - 128) / 128; s += d * d; }
        const rms = Math.min(1, Math.sqrt(s / x.buf.length) * 4);
        x.v = rms > x.v ? rms : x.v * 0.86 + rms * 0.14;
        if (esc.current) esc.current.style.setProperty('--vol', x.v.toFixed(3));
        x.raf = requestAnimationFrame(paso);
      };
      x.raf = requestAnimationFrame(paso);
    } catch (e) { r.current = false; }
  };
  const parar = () => { const x = r.current; if (x) { cancelAnimationFrame(x.raf); x.v = 0; } if (esc.current) esc.current.style.setProperty('--vol', '0'); };
  useEffect(() => () => { const x = r.current; if (x) { cancelAnimationFrame(x.raf); x.ctx.close().catch(() => {}); } }, []);
  return { arrancar, parar };
}

// 💬 los subtítulos, prendidos por defecto y recordados en este navegador
const L_SUBS = 'lg:subtitulos';
const subsGuardados = () => { try { return localStorage.getItem(L_SUBS) !== '0'; } catch (e) { return true; } };

// 🎤 EL ESCENARIO: lo dibuja la página en vivo sobre el audio (no hay video guardado). Las dos tarjetas frente a frente
// (`v.lados`, `[{n, cara}]` de quien abre: la llave), el que rapea encendido según los turnos y su tarjeta latiendo con su voz,
// el fondo del VS de su servidor y el renglón que suena como subtítulo
function Escenario({ v, D, t, cur, subs, setSubs, escRef, encima = null }) {
  const fondo = useFondoVs(v.sv);
  const lados = (v.lados || []).slice(0, 2);
  if (lados.length < 2) return null;
  let quien = '';
  for (const [s, n] of (D && D.turnos) || []) if (s <= t + 0.2) quien = nrm(n);
  const on = (l) => !!quien && nrm(l.n) === quien;
  const linea = subs && cur >= 0 ? D.letra[cur][1] : '';
  const hayLetra = !!(D && (D.letra || []).length);
  return (
    <div ref={escRef} className={'vau-esc' + (quien ? ' turnos' : '') + (fondo ? ' con-fondo' : '')}
      style={fondo ? { backgroundImage: 'linear-gradient(rgba(5,5,6,.45), rgba(5,5,6,.65)), url("' + fondo + '")' } : undefined}>
      {lados.map((l, i) => (
        <div key={i} className={'vau-lado' + (i ? ' der' : '') + (on(l) ? ' on' : '')}>
          <span className="vau-carta">{l.cara}</span><b>{l.n}</b>{on(l) ? <small>al micrófono</small> : null}
        </div>
      ))}
      <span className="vau-vs" aria-hidden="true">VS</span>
      {linea ? <p className="vau-linea" aria-live="off">{linea}</p> : null}
      {hayLetra ? (
        <button type="button" className={'vau-cc' + (subs ? ' on' : '')} aria-pressed={subs} onClick={() => setSubs(!subs)}
          title={subs ? 'Quitar los subtítulos (son automáticos: pueden tener errores)' : 'Poner los subtítulos'}>CC</button>
      ) : null}
      {encima}
    </div>
  );
}

// 🥊 LAS RONDAS: una ronda es una vuelta entera (el que abrió y la respuesta del otro), así que empieza cada vez que vuelve a
// hablar quien abrió la batalla. Antes eran los turnos de cada uno, uno por uno (Dlx: «los timestamps de cada ronda en vez de
// cada turno del rival»)
function rondasDe(turnos) {
  const xs = turnos || [];
  if (!xs.length) return [];
  const primero = nrm(xs[0][1]);
  const out = [];
  for (const [s, n] of xs) if (nrm(n) === primero) out.push(s);
  return out;
}

/** `alTerminar` y `auto` (25/11/2026): el evento entero de la llave (`EventoCompleto` de llave.jsx) la reusa batalla tras
 *  batalla; en la ventana, suena sola al abrirse como siempre. `v.sv` es el servidor (su fondo del VS)
 *  🔗 `desde` (25/11/2026, Dlx: «Todas», el #7 «compartir este momento»): arranca en ese segundo. Un link que abre otro
 *  navegador no tiene un toque de quien mira, así que el navegador puede no dejarlo sonar solo: entonces un ▶ grande sobre
 *  el escenario, «Escuchar desde 1:23», en vez de un reproductor quieto que no dice nada. `auRef` deja leer el segundo que
 *  suena (para el link) y `encima` es lo que se dibuja sobre el escenario (el resultado al terminar, el #6) */
export function AudioBatalla({ v, alTerminar = null, auto = true, alEmpezar = null, desde = null, auRef = null, encima = null }) {
  const au = useRef(null);
  const [bloq, setBloq] = useState(false);
  useEffect(() => { if (auRef) auRef.current = au.current; });
  const conDesde = desde != null && desde >= 0;
  const alCargar = () => {
    const a = au.current;
    if (!a || !conDesde) return;
    if (desde > 0 && (!a.duration || desde < a.duration)) a.currentTime = desde;
    if (auto) a.play().catch(() => setBloq(true));
  };
  const esc = useRef(null);
  const [D, setD] = useState(null);
  const [t, setT] = useState(0);
  const [subs, setSubs0] = useState(subsGuardados);
  const setSubs = (x) => { setSubs0(x); try { localStorage.setItem(L_SUBS, x ? '1' : '0'); } catch (e) { /* sin almacenamiento */ } };
  const vol = useVolumen(au, esc);
  useEffect(() => {
    let vivo = true;
    if (v.det) fetch(v.det).then((r) => (r.ok ? r.json() : null)).then((j) => { if (vivo) setD(j); }).catch(() => {});
    return () => { vivo = false; };
  }, [v.det]);
  const ir = (s) => { const a = au.current; if (a) { a.currentTime = s; a.play().catch(() => {}); } };
  const letra = (D && D.letra) || [];
  let cur = -1;
  for (let i = 0; i < letra.length && letra[i][0] <= t + 0.2; i++) cur = i;
  const calor = (D && D.calor) || [];
  const rondas = rondasDe(D && D.turnos);
  const rondaAhora = rondas.filter((s) => s <= t + 0.2).length - 1;
  const play = bloq ? (
    <button type="button" className="vau-play" onClick={() => { const a = au.current; if (a) a.play().catch(() => {}); }}>
      <span aria-hidden="true">▶</span>{'Escuchar desde '}{mmss(desde || 0)}
    </button>
  ) : null;
  const sobre = play || encima ? <>{encima}{play}</> : null;
  const conEsc = (v.lados || []).length >= 2;
  return (
    <div className="vid-audio">
      <Escenario v={v} D={D} t={t} cur={cur} subs={subs} setSubs={setSubs} escRef={esc} encima={sobre} />
      {!conEsc && sobre ? <div className="vau-sobre">{sobre}</div> : null}
      <audio ref={au} src={v.audio} title={v.tit || 'Audio'} controls autoPlay={auto && !conDesde} crossOrigin="anonymous"
        onLoadedMetadata={alCargar}
        onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
        onPlay={() => { setBloq(false); vol.arrancar(); if (alEmpezar) alEmpezar(); }} onPause={vol.parar}
        onEnded={() => { vol.parar(); if (alTerminar) alTerminar(); }} />
      {calor.length > 2 ? (
        <div className="vau-calor" role="group" aria-label="Dónde reaccionó la llamada: toca para ir ahí">
          {calor.map((c, i) => <button key={i} type="button" style={{ height: 4 + c * 3 }} className={t >= i * 5 && t < i * 5 + 5 ? 'on' : ''}
            aria-label={'Ir a ' + mmss(i * 5)} onClick={() => ir(i * 5)} />)}
        </div>
      ) : null}
      {rondas.length > 1 ? (
        <div className="vau-turnos" role="group" aria-label="Las rondas">
          {rondas.map((s, i) => <button key={i} type="button" className={i === rondaAhora ? 'on' : ''} aria-current={i === rondaAhora ? 'true' : undefined}
            onClick={() => ir(s)}><b>Ronda {i + 1}</b> {mmss(s)}</button>)}
        </div>
      ) : null}
    </div>
  );
}

export function VentanaVideo() {
  const [v, setV] = useState(null);
  const cerrarB = useRef(null);
  useEffect(() => {
    const abrir = (e) => setV(e.detail || null);
    window.addEventListener('lg:video', abrir);
    return () => window.removeEventListener('lg:video', abrir);
  }, []);
  useEffect(() => {
    if (!v) return undefined;
    // el escenario no pasa solo mientras se mira (ver `Hero`)
    window.dispatchEvent(new CustomEvent('lg:video-abierto', { detail: true }));
    if (cerrarB.current) cerrarB.current.focus({ preventScroll: true });
    const k = (e) => { if (e.key === 'Escape') setV(null); };
    window.addEventListener('keydown', k);
    return () => {
      window.removeEventListener('keydown', k);
      window.dispatchEvent(new CustomEvent('lg:video-abierto', { detail: false }));
    };
  }, [v]);
  if (!v || (!v.vid && !v.mp4 && !v.audio)) return null;
  const src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(v.vid) + '?autoplay=1&rel=0&playsinline=1';
  // 📱 un short se ve parado: la caja toma el ancho que le deja el alto de la pantalla, en 9:16
  const vert = !!(v.mp4 || v.vertical || /\/shorts\//.test(String(v.link || '')));
  return (
    <div className="vid-fondo" role="dialog" aria-modal="true" aria-label={v.tit || 'Video'} onClick={(e) => { if (e.target === e.currentTarget) setV(null); }}>
      <div className={'vid-caja' + (vert ? ' vert' : '')}>
        <div className="vid-cab">
          <b className="vid-t">{v.tit}</b>
          {v.link ? <a className="vid-yt" href={v.link} target="_blank" rel="noopener noreferrer">En YouTube ↗</a> : null}
          <button type="button" ref={cerrarB} className="vid-x" onClick={() => setV(null)} aria-label="Cerrar el video">✕</button>
        </div>
        {v.audio ? <AudioBatalla v={v} /> : <div className="vid-marco">
          {v.mp4 ? <video src={v.mp4} poster={v.portada || undefined} title={v.tit || 'Video'} controls autoPlay playsInline />
            : <iframe src={src} title={v.tit || 'Video de YouTube'} allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />}
        </div>}
      </div>
    </div>
  );
}
