// 💬 LOS COMENTARIOS FLOTANDO (Dlx, 17/11/2026: «que en algunas publicaciones o incluso esos pantallazos de inicio
// aparezcan algunos comentarios flotando, lo mismo para historias… que haya incluso respuestas a comentarios o
// respuestas de respuestas»). Como en un vivo: van entrando de a uno desde abajo, empujan a los de arriba y el más viejo
// se va. Tres a la vista; en las historias, dos (`max`): con tres tapaban el pie de la carta en el celular. Sólo en publicaciones con 2 o más comentarios («algunas»). La respuesta va corrida un escalón y dice a quién
// contesta («↪ a Fulano»); la respuesta de una respuesta, dos.
// ⚠️ El simulado lleva SIEMPRE su etiqueta: lo decide el permiso en el ciclo (bot/comentarios_sim.py), nunca acá.
// ⚠️ Se mueven sólo con transform y opacity (los mueve la placa de video), se frenan fuera de la pantalla o con la
// pestaña escondida, y con «Menos animaciones» quedan quietos: los últimos tres. Tocar uno abre la publicación.
import { useEffect, useMemo, useRef, useState } from 'react';
import { limpio } from './liga.js';
import { PJ } from './comentarios.jsx';
import { Cara } from './piezas.jsx';
import { usePases } from './pase.js';
import { esPremium } from './sello.jsx';
import { useCalma } from './anima.js';

// `max`: cuántos se ven a la vez · `inicio`: cuántos entran ya a la vista (de entrada, todos: si no, el lugar arrancaba
// vacío)
export function ComentariosFlotantes({ liga, it, hilo, cls = '', onAbrir, cada = 2800, max = 3, inicio = max - 1 }) {
  const pub = usePases();
  const raiz = useRef(null);
  const n = hilo.length;
  // a quién contesta cada uno y en qué escalón va (0 · respuesta 1 · respuesta de respuesta 2)
  const info = useMemo(() => {
    const por = {};
    hilo.forEach((c) => { por[c.id] = c; });
    const esc = (c, v) => (!c || !c.resp || !por[c.resp] || v > 4 ? 0 : 1 + esc(por[c.resp], v + 1));
    const prof = {};
    hilo.forEach((c) => { prof[c.id] = Math.min(2, esc(c, 0)); });
    return { por, prof };
  }, [hilo]);
  // «Menos animaciones» (se sigue en vivo: cambiarlo en Ajustes los frena ya) o el «reducir movimiento» del sistema
  const calma = useCalma();
  const quieto = calma || (typeof window !== 'undefined' && !!window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [ve, setVe] = useState(false);
  const [i, setI] = useState(Math.min(inicio, Math.max(0, n - 1)));
  useEffect(() => {
    const el = raiz.current;
    if (!el) return undefined;
    if (!('IntersectionObserver' in window)) { setVe(true); return undefined; }
    const io = new IntersectionObserver(([e]) => setVe(e.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (quieto || !ve || n < 2) return undefined;
    const t = setInterval(() => { if (!document.hidden) setI((x) => x + 1); }, cada);
    return () => clearInterval(t);
  }, [quieto, ve, n, cada]);
  if (n < 2) return null;
  // los que se ven: el más nuevo abajo (posición 0) y los de arriba; el que pasa a la posición 3 se está yendo. Cada
  // vuelta tiene su propia llave, así el que reaparece entra de nuevo
  const filas = [];
  if (quieto) hilo.slice(-max).forEach((c, j, xs) => filas.push({ c, llave: c.id, pos: xs.length - 1 - j }));
  else for (let s = Math.max(0, i - max); s <= i; s++) filas.push({ c: hilo[s % n], llave: 'v' + s, pos: i - s });
  const abrir = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onAbrir) onAbrir();
    else if (it && it.id) location.hash = '#/publicaciones/' + encodeURIComponent(it.id);
  };
  return (
    <div className={'cfl ' + cls} ref={raiz} style={{ '--filas': Math.min(n, max) }} aria-label={n + ' comentarios'}>
      {filas.map(({ c, llave, pos }) => {
        const pj = c.et === 'l' ? PJ[c.k] || ['LG', '#E41373'] : null;
        const prof = info.prof[c.id] || 0;
        const a = c.resp && info.por[c.resp];
        return (
          <button key={llave} type="button" className={'cfl-b' + (pos >= max ? ' sale' : '') + (prof ? ' resp' : '')}
            style={{ '--pos': Math.min(pos, max), '--prof': prof }} onClick={abrir} tabIndex={pos >= max ? -1 : 0}
            aria-label={limpio(c.n) + (c.et === 's' ? ' (simulado)' : c.et === 'l' ? ' (Liga)' : '') + (a ? ', responde a ' + limpio(a.n) : '') + ': ' + c.tx}>
            {pj ? <span className="cfl-cara pj" style={{ background: pj[1] }}>{pj[0]}</span>
              : <Cara liga={liga} k={c.k} nombre={c.n} cls={'cfl-cara' + (esPremium(pub, c.k) ? ' sp-prem-aro' : '')} lazy />}
            <span className="cfl-x">
              <span className="cfl-q"><b>{limpio(c.n)}</b>{c.et === 's' ? <i>simulado</i> : c.et === 'l' ? <i className="liga">Liga</i> : null}{a ? <small>↪ a {limpio(a.n)}</small> : null}</span>
              <span className="cfl-t">{c.tx}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
