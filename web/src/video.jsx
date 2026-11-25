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
        {v.audio ? <div className="vid-audio"><audio src={v.audio} title={v.tit || 'Audio'} controls autoPlay /></div> : <div className="vid-marco">
          {v.mp4 ? <video src={v.mp4} poster={v.portada || undefined} title={v.tit || 'Video'} controls autoPlay playsInline />
            : <iframe src={src} title={v.tit || 'Video de YouTube'} allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />}
        </div>}
      </div>
    </div>
  );
}
