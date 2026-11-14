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

// 🔄 SE RECARGA SOLA AL VOLVER (Dlx, 14/11/2026, con la captura de su iPhone a las 8:40 PM del 13/11, que todavía
// tenía la tira de círculos verdes de antes de las 2:54 AM: «osea el mío sigue como outdated no?», y al arreglo:
// «Sí, hazlo»). Instalada en la pantalla de inicio, el iPhone deja la página abierta de fondo días enteros y nunca
// vuelve a bajar su código; el cuadro de abajo ofrecía «Recargar», y cerrarlo con la ✕ la dejaba en la vieja.
// Ahora, si estuviste afuera `AFUERA` o más y al volver hay una versión más nueva que la que se abrió, se recarga
// sola: no estabas mirando, así que no se corta nada. Mirando, nunca (queda el cuadro). Y nunca si hay algo escrito
// en un campo, que se perdería: ahí también queda el cuadro. Después de recargar sale «Nueva actualización · Ver qué
// cambió», porque la versión vista (`lg:cambios`) no se toca.
const AFUERA = 10 * 60 * 1000;
let oculta = 0;
function hayAlgoEscrito() {
  const raiz = (document.getElementById('inicio-nuevo') || {}).shadowRoot || document;
  return [...raiz.querySelectorAll('textarea, input:not([type]), input[type=text], input[type=search], input[type=url], [contenteditable=true]')]
    .some((e) => String(e.value || e.textContent || '').trim());
}

export function AvisoVersion({ pagina }) {
  const [c, setC] = useState(null);
  const [cerrado, setCerrado] = useState('');
  useEffect(() => {
    let vivo = true;
    const mirar = async (volviste) => {
      if (document.hidden) return;
      let u = null;
      try { u = await ultima(); } catch (e) { return; }
      if (!vivo || !u || !u.version) return;
      if (!alAbrir) alAbrir = u.version;
      if (volviste && nuevaQue(u.version, alAbrir) && !hayAlgoEscrito()) { location.reload(); return; }
      // primera vez en este navegador: nada es «nuevo»
      if (PRIMERA_VISITA && !leerVista()) { guardarVista(u.version); return; }
      setC(u);
    };
    mirar();
    const t = setInterval(() => mirar(false), CADA);
    const vis = () => {
      if (document.hidden) { oculta = Date.now(); return; }
      const largo = oculta && Date.now() - oculta >= AFUERA;
      oculta = 0;
      mirar(largo);
    };
    // el iPhone, al traer una app de fondo, a veces devuelve la página entera de su memoria (`persisted`) sin avisar
    // con visibilitychange: eso también es «volviste»
    const vuelta = (e) => { if (e.persisted) mirar(true); };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('pageshow', vuelta);
    return () => {
      vivo = false; clearInterval(t);
      document.removeEventListener('visibilitychange', vis); window.removeEventListener('pageshow', vuelta);
    };
  }, []);
  if (!c || pagina === 'cambios' || quiereTutorial()) return null;
  const visto = leerVista();
  if (cerrado === c.version || (visto && !nuevaQue(c.version, visto))) return null;
  const recargar = alAbrir && nuevaQue(c.version, alAbrir);
  const cerrar = () => { guardarVista(c.version); setCerrado(c.version); };
  // (sin las marcas: el changelog escribe **negrita** y `código`, que acá salían con sus asteriscos — 19/10/2026)
  const item = String((c.items || [])[0] || '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
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
