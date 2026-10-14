// 🆕 «HAY UNA ACTUALIZACIÓN» (Dlx, 13/10/2026: «cada vez que haya una actualización en la página web me gustaría que
// aparezca un cuadrado diciendo que hay una nueva actualización»). Un cuadro chico abajo, una sola vez por versión:
//   · volviste y hay una versión que no viste → qué cambió, con «Ver qué cambió» (`#/cambios`) y cerrar;
//   · tenías la página abierta y se publicó otra → lo mismo, con «Recargar» para verla.
// La versión vista es la del changelog (`lg:cambios`, la misma que marca «Nuevo» en Mi cuenta y que guarda abrir
// `#/cambios`): cerrar el cuadro es haberla visto. ⚠️ A quien entra por primera vez no le sale —para él no hay nada
// «nuevo»—: se le anota la de hoy en silencio. Y no sale con el tutorial abierto ni estando en Novedades.
// `cambios.json` es un archivo estático de Pages: pedirlo no toca el Worker. Con la página a la vista, cada 10 minutos
import { useEffect, useState } from 'react';
import { nuevaQue } from './liga.js';
import { PRIMERA_VISITA, quiereTutorial } from './primera.js';

const CADA = 10 * 60 * 1000;
const leerVista = () => { try { return JSON.parse(localStorage.getItem('lg:cambios') || '""') || ''; } catch (e) { return ''; } };
const guardarVista = (v) => {
  try { localStorage.setItem('lg:cambios', JSON.stringify(v)); } catch (e) { /* sin guardar: igual se cierra */ }
  if (typeof window.CAMBIOS_VISTO === 'string') window.CAMBIOS_VISTO = v;
};
async function ultima() {
  const r = await fetch('/cambios.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error(String(r.status));
  const d = await r.json();
  return ((d && d.cambios) || [])[0] || null;
}
//: la versión con la que se abrió la página: si después aparece otra, hay que recargar para verla
let alAbrir = '';

export function AvisoVersion({ pagina }) {
  const [c, setC] = useState(null);
  const [cerrado, setCerrado] = useState('');
  useEffect(() => {
    let vivo = true;
    const mirar = async () => {
      if (document.hidden) return;
      let u = null;
      try { u = await ultima(); } catch (e) { return; }
      if (!vivo || !u || !u.version) return;
      if (!alAbrir) alAbrir = u.version;
      // primera vez en este navegador: nada es «nuevo»
      if (PRIMERA_VISITA && !leerVista()) { guardarVista(u.version); return; }
      setC(u);
    };
    mirar();
    const t = setInterval(mirar, CADA);
    const vis = () => { if (!document.hidden) mirar(); };
    document.addEventListener('visibilitychange', vis);
    return () => { vivo = false; clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, []);
  if (!c || pagina === 'cambios' || quiereTutorial()) return null;
  const visto = leerVista();
  if (cerrado === c.version || (visto && !nuevaQue(c.version, visto))) return null;
  const recargar = alAbrir && nuevaQue(c.version, alAbrir);
  const cerrar = () => { guardarVista(c.version); setCerrado(c.version); };
  const item = String((c.items || [])[0] || '');
  return (
    <aside className="aviso-version" role="status" aria-label="Hay una actualización de la página">
      <p className="av-et">🆕 Nueva actualización · v{c.version}</p>
      <p className="av-t">{c.titulo}</p>
      {item ? <p className="av-d">{item.length > 160 ? item.slice(0, 157) + '…' : item}</p> : null}
      <div className="av-btns">
        {recargar ? <button type="button" className="btn verde chico" onClick={() => { guardarVista(c.version); location.reload(); }}>Recargar para verla</button>
          : <a className="btn verde chico" href="#/cambios" onClick={cerrar}>Ver qué cambió</a>}
        <button type="button" className="av-x" aria-label="Cerrar el aviso de la actualización" onClick={cerrar}>✕</button>
      </div>
    </aside>
  );
}
