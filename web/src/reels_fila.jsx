// 🎬 «REELS DE LA SEMANA» EN EL INICIO (24/11/2026, la mejora 4 de Reels; Dlx: «Todas»). Una fila de miniaturas paradas, sumada
// entre el lobby y «Lo que pasó» sin sacar nada (la regla del Inicio: sumar, no reemplazar). Lee `/reels_vista.json`
// (~24 KB, lo arma bot/global_ranking.py): los primeros doce en el orden del feed, y cada uno abre Reels en ese
// (`#/reels/<id>`). No baja nada de YouTube salvo las miniaturas.
import { useEffect, useState } from 'react';
import CSS from './css/reels_fila.css?inline';
import { usarCss } from './css.js';

usarCss('reels_fila', CSS);

// 🏆 Y EL SHORT DE LA SEMANA, PRIMERO (25/11/2026, Dlx: «all of them»): el de la Liga que más gente miró hasta el final
// (`reels/semana.json`, lo elige el robot: privado/motor/senales.py `publicar_semana()`). Sin él, la fila de siempre
const SEMANA = 'https://pub-70d5821d06a8432c9cffd0c102195000.r2.dev/reels/semana.json';
let pedidoS = null;
const bajarSemana = () => (pedidoS = pedidoS || fetch(SEMANA, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
  .then((s) => (s && s.rid && (s.hasta || '') > new Date().toISOString().slice(0, 16) ? s : null)));
const RON = { octavos: 'Octavos', cuartos: 'Cuartos', semifinales: 'Semifinal', final: 'Final' };

let pedido = null;
function bajar() {
  if (!pedido) {
    pedido = fetch('/reels_vista.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  }
  return pedido;
}

export function ReelsFila() {
  const [V, setV] = useState(null);
  const [S, setS] = useState(null);
  useEffect(() => {
    let vivo = true;
    bajar().then((d) => { if (vivo) setV(d); });
    bajarSemana().then((s) => { if (vivo) setS(s); });
    return () => { vivo = false; };
  }, []);
  const xs = ((V && V.o) || []).map((v) => [v, (V.r || {})[v] || []]).filter((x) => x[1].length);
  // sin dato no hay pieza
  if (xs.length < 4) return null;
  return (
    <section id="reels" className="rlf" aria-label="Videos de la semana">
      <div className="sec-t"><h2>Videos de la semana</h2><a href="#/videos">Ver todos</a></div>
      <div className="rlf-rail">
        {S ? (
          <a className="rlf-r rlf-top" href={'#/videos/' + S.rid} aria-label={'El short de la semana: ' + (S.nombres || []).join(' vs ')}>
            <span className="rlf-img">
              {S.portada ? <img alt="" loading="lazy" decoding="async" src={S.portada} /> : null}
              <em className="rlf-sello">Short de la semana</em>
              <i aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></i>
            </span>
            <b>{(S.nombres || []).join(' vs ')}</b>
            <small>{S.por === 'vistas' && S.fin ? Math.round(S.fin * 100) + ' % lo vio entero' : [RON[String(S.ronda || '').toLowerCase()] || S.ronda, S.evento].filter(Boolean).join(' · ')}</small>
          </a>
        ) : null}
        {xs.map(([v, [t, canal, quien]]) => (
          <a key={v} className="rlf-r" href={'#/videos/' + v} aria-label={(quien || 'Reel') + (t ? ': ' + t : '')}>
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
