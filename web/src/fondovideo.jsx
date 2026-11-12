// 🎬 EL FONDO DE VIDEO DE LA LIGA: el montaje en blanco y negro de los nuestros batallando (12/11/2026). Nació en la
// bienvenida (bienvenida.jsx) y desde el mismo día va también en la franja de arriba de Socios y del Salón de la Fama
// (Dlx, a las ideas de dónde más ponerlo: «me gustan todas… sí, las dos»).
//
// ⚠️ UN SOLO LUGAR para lo que decide qué video se ve: la carpeta de la temporada (`VIDEO`), la versión (`VV`), cuándo
// va el de 854 × 480 (`elegirHd`) y cuándo no va ninguno (`quieto`). La bienvenida los importa de acá: si cada página
// tuviera su copia, al rearmar el video una seguiría mostrando el viejo.
// ⚠️ El video lo arma y lo sube `herramientas/bienvenida_video.py` y vive en R2 (son caras de gente real: no al repo).
// ⚠️ SÓLO CORRE MIENTRAS SE VE: una franja de arriba que quedó atrás al bajar por la página se pausa (no gasta batería
// ni procesador en algo que nadie mira), y vuelve al subir.
import { useEffect, useRef, useState } from 'react';
import CSS from './css/fondovideo.css?inline';
import { usarCss } from './css.js';

usarCss('fondovideo', CSS);

const W = typeof window !== 'undefined' ? window : {};
export const VIDEO = 't1';
// la versión del video: se sube con el mismo nombre, así que se cambia acá cada vez que se rearma, o el navegador y el
// borde de R2 siguen sirviendo el de antes. 2 = el del 12/11 con el segundo tramo de Sombra y los oscuros más claros.
// 3 = el del 12/11 a la tarde: cámara lenta sin cuadros inventados (no deforma) y el grande en 960 × 540 en vez de 720p
// 4 = con el tramo de Sol de verdad (el de antes era otra persona: el título decía «SOL») y el grande en 854 × 480
// 5 = la cámara lenta con RIFE ×2: fluida y sin deformar (herramientas/bienvenida_video.py)
// 6 = Liberia también por RIFE: su video dice 60 cuadros y trae 30 repetidos («muy laggeado»)
export const VV = '?v=6';
export const baseVideo = (liga) => liga.d.r2 + '/bienvenida/' + VIDEO + '/';
// con «Menos animaciones», movimiento reducido o ahorro de datos: un cuadro quieto en vez del video
export const quieto = () => (W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches) || !!document.querySelector('.calma')
  || !!(W.navigator && W.navigator.connection && W.navigator.connection.saveData);
// el de 854 × 480 donde la pantalla tiene los píxeles para verlo (Dlx: «el video no está en HD», y después «un intermedio
// entre 720p y 480»: el de 720p, para pesar lo mismo, iba tan comprimido que no se notaba): se mide en píxeles de
// verdad, así un teléfono de 390 con densidad 3 (1.170) también lo recibe; el de 640, para pantallas de verdad chicas
export const elegirHd = () => (W.innerWidth || 0) * (W.devicePixelRatio || 1) >= 900;

// `lento`: la velocidad (el Salón va al 75 %: se lee como un recuerdo y no como acción). `cls`: el tono de cada página
export default function FondoVideo({ liga, lento = 1, cls = '' }) {
  const [sinVideo] = useState(quieto);
  const [hd] = useState(elegirHd);
  const ref = useRef(null);
  const base = baseVideo(liga);
  useEffect(() => {
    const v = ref.current;
    if (!v) return undefined;
    // `muted` como propiedad y antes de play(): React no lo pone como atributo y sin eso el navegador no lo arranca solo
    v.muted = true;
    v.defaultPlaybackRate = lento;
    v.playbackRate = lento;
    const jugar = () => { v.playbackRate = lento; const p = v.play(); if (p && p.catch) p.catch(() => { /* queda el póster */ }); };
    if (!('IntersectionObserver' in W)) { jugar(); return undefined; }
    const io = new W.IntersectionObserver(([x]) => { if (x && x.isIntersecting) jugar(); else v.pause(); }, { threshold: 0.05 });
    io.observe(v);
    return () => io.disconnect();
  }, [lento]);
  return (
    <div className={'fv' + (cls ? ' ' + cls : '')} aria-hidden="true">
      {sinVideo ? <img alt="" src={base + 'poster.jpg' + VV} />
        : <video ref={ref} src={base + (hd ? 'montaje-480.mp4' : 'montaje.mp4') + VV} poster={base + 'poster.jpg' + VV} muted loop playsInline preload="auto" />}
      <i className="fv-vineta" />
      <svg className="fv-grano"><filter id="fv-gr"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" /></filter><rect width="100%" height="100%" filter="url(#fv-gr)" /></svg>
    </div>
  );
}
