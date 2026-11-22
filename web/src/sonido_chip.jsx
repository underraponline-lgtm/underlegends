// 🔊 LAS PUBLICACIONES CON SONIDO, COMO INSTAGRAM (22/11/2026). Dlx: «B, que suenen en sus promos y tmb en otras historias
// o publicaciones así como instagram que algunas tienen sonido».
//
// Una pastilla «♫» en las publicaciones que tienen sonido:
//   · una PROMO con su recorte en R2 (`'p:<video>'`, la tanda 5 de beats.js) suena con su propia canción, y la pastilla
//     dice cuál es y de quién antes de tocarla
//   · un LOGRO suena con un beat de su estilo (`beatDe()` de arriba.jsx, el mismo de las historias: el campeón boom bap,
//     la caza drill, el rango trap)
// ⚠️ NUNCA SUENA SOLA: se toca la pastilla. Una página que suena sin pedirlo es lo primero que alguien silencia, y en el
// iPhone el audio sólo se prende adentro de un toque. Una sola a la vez: tocar otra, volver a tocarla o abrir las
// historias la apaga (`alDueno()` de beats.js)
import { useEffect, useState } from 'react';
import * as BEAT from './beats.js';

export function SonidoChip({ id, estilo, cls = '' }) {
  const [quien, setQuien] = useState(BEAT.duenoActual());
  const [pista, setPista] = useState(null);
  const [, setX] = useState(0);
  useEffect(() => BEAT.alDueno(setQuien), []);
  useEffect(() => BEAT.alCambiar(setPista), []);
  useEffect(() => { BEAT.cargarExtras(); return BEAT.alExtras(() => setX((n) => n + 1)); }, []);
  if (!id || !estilo) return null;
  const promoId = String(estilo).startsWith('p:') ? estilo.slice(2) : '';
  if (promoId && !BEAT.hayPista(promoId)) return null;
  const on = quien === id;
  const ficha = promoId ? BEAT.pistaDe(promoId) : null;
  const txt = on && pista ? pista.t + ' · ' + pista.b : ficha ? ficha.t + ' · ' + ficha.b : 'Escuchar el beat';
  const toca = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (on) BEAT.callarPublicacion();
    else BEAT.sonarPublicacion(id, estilo);
  };
  return (
    <button type="button" className={'son-chip' + (on ? ' on' : '') + (cls ? ' ' + cls : '')} aria-pressed={on} onClick={toca}
      aria-label={(on ? 'Parar: ' : 'Escuchar: ') + txt} title={on ? 'Parar el sonido' : 'Escuchar'}>
      <span className="son-ico" aria-hidden="true">{on ? <i className="hv-eq"><b /><b /><b /></i> : '♫'}</span>
      <span className="son-tx">{txt}</span>
    </button>
  );
}

/** Al irse de la página: si sonaba una publicación, se calla */
export function useCallarAlSalir() {
  useEffect(() => () => BEAT.callarPublicacion(), []);
}
