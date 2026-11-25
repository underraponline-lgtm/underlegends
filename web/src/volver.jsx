// ← VOLVER A LA PÁGINA ANTERIOR (25/11/2026). Dlx: «me he dado cuenta que quizás necesitamos un botón de regresar para la
// anterior tab… o sea la anterior página que visitamos». En el celular instalado (o con la barra del navegador escondida)
// no hay «Atrás» a mano. Arriba a la izquierda del contenido, diciendo A DÓNDE vuelve («← Ranking»), y sólo si en esta
// pestaña hubo una página antes: el primero que entra por un link no ve un botón que lo sacaría de la Liga.
// La pila vive en `sessionStorage` (`lg:pila`, una por pestaña) y el toque es `history.back()`: lo mismo que el «Atrás» del
// navegador, así que el historial y la dirección quedan iguales. Volver a la anterior (por este botón o por el navegador)
// saca la última de la pila en vez de sumar una.
import { useEffect, useState } from 'react';

const LLAVE = 'lg:pila';
const leer = () => { try { const p = JSON.parse(sessionStorage.getItem(LLAVE) || '[]'); return Array.isArray(p) ? p : []; } catch (e) { return []; } };
const guardar = (p) => { try { sessionStorage.setItem(LLAVE, JSON.stringify(p.slice(-40))); } catch (e) { /* sin pila: sin botón */ } };

// qué página es cada dirección: la primera parte, sin la pestaña de adentro (#/ranking/duelos es «Ranking»)
const NOMBRES = { '': 'Inicio', ranking: 'Ranking', videos: 'Videos', reels: 'Videos', eventos: 'Eventos', avisos: 'Eventos', pase: 'Pase rapero',
  publicaciones: 'Publicaciones', competencias: 'Competencias', ligas: 'Ligas', liga: 'la liga', crews: 'Crews', crew: 'la crew',
  tarjetas: 'Tarjetas', salon: 'Salón de la fama', socios: 'Socios', mundo: 'Socios', guia: 'Guía', tienda: 'Tienda', invitar: 'Invita y gana',
  cuenta: 'Tu cuenta', cambios: 'Cambios', r: 'el perfil', sv: 'el servidor', global: 'el Ranking global', competencia: 'la competencia',
  duelos: 'Ranking', vs: 'VS', llave: 'la llave', mods: 'Mods', dashboard: 'el Dashboard' };
const parteDe = (h) => String(h || '').replace(/^#\/?/, '').split(/[/?]/)[0] || '';
export const nombreDe = (h) => NOMBRES[parteDe(h)] || 'la página anterior';

/** Anota la dirección nueva: si es la anterior, se volvió (sale la última); si es otra, se suma */
export function notarRuta(h) {
  if (!h || /^#(access_token|error)=/.test(h)) return;
  const p = leer();
  if (p[p.length - 1] === h) return;
  if (p.length > 1 && p[p.length - 2] === h) p.pop();
  else p.push(h);
  guardar(p);
}

export default function Volver({ hash }) {
  const [, setN] = useState(0);
  // la pila se anota en App (una vez por cambio de dirección); esto sólo vuelve a mirar
  useEffect(() => { setN((n) => n + 1); }, [hash]);
  const p = leer();
  const antes = p.length > 1 ? p[p.length - 2] : '';
  // dentro de la misma página (de una pestaña del Ranking a otra) no hace falta: la página ya tiene sus pestañas
  if (!antes || parteDe(antes) === parteDe(hash) || parteDe(hash) === 'bienvenida') return null;
  return (
    <nav className="volver" aria-label="Volver">
      <button type="button" className="volver-b" onClick={() => { try { history.back(); } catch (e) { location.hash = antes; } }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        <span>{nombreDe(antes)}</span>
      </button>
    </nav>
  );
}
