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

/** La miniatura más grande que tenga el video: `hq720` (1280×720) y, si no existe, `hqdefault` (480×360). */
export function Miniatura({ vid, cls }) {
  return (
    <img className={cls} alt="" src={'https://i.ytimg.com/vi/' + vid + '/hq720.jpg'} loading="lazy" decoding="async"
      onError={(e) => {
        const im = e.currentTarget;
        if (!im.dataset.atras) { im.dataset.atras = '1'; im.src = 'https://i.ytimg.com/vi/' + vid + '/hqdefault.jpg'; }
      }} />
  );
}

/** Abre el reproductor desde cualquier lado: `abrirVideo({vid, tit, link})`. */
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
  if (!v || !v.vid) return null;
  const src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(v.vid) + '?autoplay=1&rel=0&playsinline=1';
  return (
    <div className="vid-fondo" role="dialog" aria-modal="true" aria-label={v.tit || 'Video'} onClick={(e) => { if (e.target === e.currentTarget) setV(null); }}>
      <div className="vid-caja">
        <div className="vid-cab">
          <b className="vid-t">{v.tit}</b>
          {v.link ? <a className="vid-yt" href={v.link} target="_blank" rel="noopener noreferrer">En YouTube ↗</a> : null}
          <button type="button" ref={cerrarB} className="vid-x" onClick={() => setV(null)} aria-label="Cerrar el video">✕</button>
        </div>
        <div className="vid-marco">
          <iframe src={src} title={v.tit || 'Video de YouTube'} allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        </div>
      </div>
    </div>
  );
}
