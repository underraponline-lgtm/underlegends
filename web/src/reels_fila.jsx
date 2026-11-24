// 🎬 «REELS DE LA SEMANA» EN EL INICIO (24/11/2026, la mejora 4 de Reels; Dlx: «Todas»). Una fila de miniaturas paradas, sumada
// entre el lobby y «Lo que pasó» sin sacar nada (la regla del Inicio: sumar, no reemplazar). Lee `/reels_vista.json`
// (~24 KB, lo arma bot/global_ranking.py): los primeros doce en el orden del feed, y cada uno abre Reels en ese
// (`#/reels/<id>`). No baja nada de YouTube salvo las miniaturas.
import { useEffect, useState } from 'react';
import CSS from './css/reels_fila.css?inline';
import { usarCss } from './css.js';

usarCss('reels_fila', CSS);

let pedido = null;
function bajar() {
  if (!pedido) {
    pedido = fetch('/reels_vista.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  }
  return pedido;
}

export function ReelsFila() {
  const [V, setV] = useState(null);
  useEffect(() => {
    let vivo = true;
    bajar().then((d) => { if (vivo) setV(d); });
    return () => { vivo = false; };
  }, []);
  const xs = ((V && V.o) || []).map((v) => [v, (V.r || {})[v] || []]).filter((x) => x[1].length);
  // sin dato no hay pieza
  if (xs.length < 4) return null;
  return (
    <section id="reels" className="rlf" aria-label="Reels de la semana">
      <div className="sec-t"><h2>Reels de la semana</h2><a href="#/reels">Ver todos</a></div>
      <div className="rlf-rail">
        {xs.map(([v, [t, canal, quien]]) => (
          <a key={v} className="rlf-r" href={'#/reels/' + v} aria-label={(quien || 'Reel') + (t ? ': ' + t : '')}>
            <span className="rlf-img">
              <img alt="" loading="lazy" decoding="async" src={'https://i.ytimg.com/vi/' + v + '/oar2.jpg'}
                onError={(e) => { if (!e.currentTarget.dataset.atras) { e.currentTarget.dataset.atras = '1'; e.currentTarget.src = 'https://i.ytimg.com/vi/' + v + '/hqdefault.jpg'; } }} />
              <i aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></i>
            </span>
            <b>{quien}</b>
            <small>{canal}</small>
          </a>
        ))}
      </div>
    </section>
  );
}
