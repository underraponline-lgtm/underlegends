// El Inicio nuevo se monta en `#inicio-nuevo` (bot/paginas/index.html), adentro de un shadow root: así el CSS de la
// página de hoy (estilo.css) y el del Inicio no se pisan. Las fuentes van en el documento (fuentes.css): un
// @font-face adentro de un shadow root no se registra.
import { createRoot } from 'react-dom/client';
import App, { Respaldo } from './App.jsx';
import './fuentes.css';
import estilo from './estilo.css?inline';
import vivo from './vivo.css?inline';
import { cssBase } from './css.js';

const host = document.getElementById('inicio-nuevo');
if (host && !host.shadowRoot) {
  const sombra = host.attachShadow({ mode: 'open' });
  // el CSS de todos, primero; el de cada página entra después, al bajarse (`usarCss`)
  cssBase(sombra, estilo + '\n' + vivo);
  const raiz = document.createElement('div');
  sombra.appendChild(raiz);
  createRoot(raiz).render(<Respaldo><App /></Respaldo>);
}
