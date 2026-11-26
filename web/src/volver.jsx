// ← VOLVER A LA PÁGINA ANTERIOR (25/11/2026). Dlx: «me he dado cuenta que quizás necesitamos un botón de regresar para la
// anterior tab… o sea la anterior página que visitamos». En el celular instalado (o con la barra del navegador escondida)
// no hay «Atrás» a mano. Dice A DÓNDE vuelve («‹ Ranking»), y sólo si en esta pestaña hubo una página antes: el primero que
// entra por un link no ve un botón que lo sacaría de la Liga.
// La pila vive en `sessionStorage` (`lg:pila`, una por pestaña) y el toque es `history.back()`: lo mismo que el «Atrás» del
// navegador, así que el historial y la dirección quedan iguales. Volver a la anterior (por este botón o por el navegador)
// saca la última de la pila en vez de sumar una.
// 🧭 DENTRO DE LA TIRA DE PESTAÑAS DE LA PÁGINA (25/11/2026, Dlx con la captura del Ranking: «se ve feo el botón, ¿puedes
// integrarlo que esté al costado de la temporada a la izquierda?»). Era su propia fila arriba de la página, y en el Ranking
// quedaba en una franja clara sobre la tira negra. Ahora busca la primera tira de pestañas de la página (`BARRAS`, cerca de
// arriba) y se mete al principio, con los colores y la letra de esa tira. Sin tira, la fila de antes
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

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

// las tiras de pestañas donde se mete: la del Ranking, el índice de la Tienda y cualquier `role="tablist"`
const BARRAS = '.rk-subs-in, .tz-ix ol, [role="tablist"]';
const CERCA = 420; // px desde el principio del contenido: una tira más abajo es de una sección, no de la página
const raizDe = () => { const h = document.getElementById('inicio-nuevo'); return h && h.shadowRoot; };

export default function Volver({ hash }) {
  const [, setN] = useState(0);
  const [lugar, setLugar] = useState(null);
  // la fila de respaldo espera un poco: la página tarda en dibujar su tira, y si la fila sale y después se va, la página salta
  const [espera, setEspera] = useState(true);
  useEffect(() => { setEspera(true); const t = setTimeout(() => setEspera(false), 1200); return () => clearTimeout(t); }, [hash]);
  // la pila se anota en App (una vez por cambio de dirección); esto sólo vuelve a mirar
  useEffect(() => { setN((n) => n + 1); }, [hash]);
  const p = leer();
  const antes = p.length > 1 ? p[p.length - 2] : '';
  // dentro de la misma página (de una pestaña del Ranking a otra) no hace falta: la página ya tiene sus pestañas
  const mostrar = !!antes && parteDe(antes) !== parteDe(hash) && parteDe(hash) !== 'bienvenida';

  // 🧭 buscar la tira y meter adentro un lugar para el botón; si la página la vuelve a dibujar, se busca de nuevo
  useEffect(() => {
    const raiz = raizDe();
    if (!mostrar || !raiz || typeof MutationObserver === 'undefined') { setLugar(null); return undefined; }
    let span = null, pedido = 0;
    const poner = () => {
      pedido = 0;
      if (span && span.isConnected) return;
      const ancla = raiz.getElementById('contenido');
      const top0 = ancla ? ancla.getBoundingClientRect().top : 0;
      const barra = [...raiz.querySelectorAll(BARRAS)].find((b) => {
        const r = b.getBoundingClientRect();
        return r.height > 0 && r.top - top0 < CERCA && !b.closest('[role="dialog"], .tz-hoja, .volver');
      });
      if (!barra) { span = null; setLugar(null); return; }
      span = document.createElement('span');
      span.className = 'volver-en';
      barra.insertBefore(span, barra.firstChild);
      setLugar(span);
    };
    const pedir = () => { if (!pedido) pedido = requestAnimationFrame(poner); };
    poner();
    const mo = new MutationObserver(pedir);
    mo.observe(raiz, { childList: true, subtree: true });
    return () => { mo.disconnect(); if (pedido) cancelAnimationFrame(pedido); if (span && span.parentNode) span.parentNode.removeChild(span); };
  }, [hash, mostrar]);

  if (!mostrar) return null;
  const ir = () => { try { history.back(); } catch (e) { location.hash = antes; } };
  const flecha = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>;
  if (lugar && lugar.isConnected) {
    return createPortal(
      // en la tira, sólo la flecha (el nombre va en la etiqueta y el globito): con el nombre, la última pestaña bajaba de línea
      <button type="button" className="volver-t" onClick={ir} aria-label={'Volver a ' + nombreDe(antes)} title={'Volver a ' + nombreDe(antes)}>{flecha}</button>,
      lugar,
    );
  }
  if (espera) return null;
  return (
    <nav className="volver" aria-label="Volver">
      <button type="button" className="volver-b" onClick={ir}>{flecha}<span>{nombreDe(antes)}</span></button>
    </nav>
  );
}
