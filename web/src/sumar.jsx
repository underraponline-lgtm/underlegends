// Lo que la Liga hace por cada servidor: las tarjetas de «Sumá tu servidor» (Socios) y de /sumate, cada una con su
// ejemplo. Dlx, 03/10/2026: «que cuando se clickee en una de estas cajas te muestre como una imagen de lo que se refiere
// como ejemplo… para añadir más detalle… creo que es importante». 🔍 PREVIEW: el ejemplo sólo con `lg:prev-sum`.
//
// ⚠️ CADA UNA ES ALGO QUE YA ANDA (Dlx: «explicá más features que hacemos»): si alguna se apaga, se saca de acá. Las
// imágenes son capturas de la página de verdad (`bot/paginas/ejemplos/`; ⚠️ no en `sumate/`, que le haría sombra a
// la ruta `/sumate`).
import { useEffect, useRef, useState } from 'react';
import { Ico } from './piezas.jsx';

// el perfil de Dlx en Discord (itsdlx): abre su perfil para escribirle
export const DLX = 'https://discord.com/users/739338101603696681';

export const QUE_GANA = [
  { ic: 'ranking', t: 'La tabla de toda la Liga', tx: 'Cada evento suyo cuenta para los mismos rankings que los demás servidores: Temporada, Competitivo, Duelos, Podios y Rachas.',
    ej: 'tabla', mas: 'Cada evento que organiza tu servidor suma a la misma tabla que los de los demás: la Temporada con los puntos de cada puesto, el Competitivo desde los 10 eventos, y los rankings de Duelos, Podios y Rachas. Tu gente compite con toda la Liga sin salir de tu servidor.', ir: '#/ranking' },
  { ic: 'tarjetas', t: 'La carta de Servidor', tx: 'Su gente tiene su carta con el escudo y el color del servidor desde su primer evento.',
    ej: 'carta', mas: 'Cada rapero que juega en tu servidor tiene su carta de Servidor, con el escudo y el color de tu servidor, su número y su puesto. Sale sola desde su primer evento, se ve en su perfil y la comparte donde quiera.', ir: '#/tarjetas' },
  { ic: 'eventos', t: 'La llave, en vivo', tx: 'El cuadro se arma solo mientras se juega, y a quien tiene la campana le avisa cuando le toca pelear.',
    ej: 'llave', mas: 'Mientras se juega, el bot lee la llave de tu canal y la página la arma cruce por cruce, con la cara de cada uno. A quien tiene la campana le avisa cuando le toca pelear, y al terminar queda con su campeón.', ir: '#/eventos' },
  { ic: 'campana', t: 'Avisos al minuto', tx: 'Cuando anuncia un evento le llega al celular a quien activó la campana, y queda en el calendario de la Liga.',
    ej: 'aviso', mas: 'Cuando tu servidor anuncia un evento, al minuto le llega al celular a quien activó la campana y sale en el canal de eventos de la Liga, con el botón para inscribirse en tu servidor. Y queda en el calendario de la Liga, que se suma a Google, Apple y Outlook.', ir: '#/eventos' },
  { ic: 'aviso', t: 'Most Wanted', tx: 'Buscados con recompensa: el primero que le gana a uno en un evento de la Liga lo caza y cobra.',
    ej: 'mw', mas: 'Cada semana hay buscados con su recompensa. El primero que le gana a uno en un evento de la Liga lo caza y cobra: un motivo más para jugar en los eventos de tu servidor.', ir: '#/' },
  { ic: 'novedades', t: 'Multiplicador cada lunes', tx: 'Cada semana sale con su multiplicador, de ×0,5 a ×5, y la gente vota qué servidor se lleva un ×2.',
    ej: 'mult', mas: 'Cada lunes cada servidor sale con su multiplicador, de ×0,5 a ×5: los puntos de sus eventos de esa semana valen eso. Y durante la semana la gente vota qué servidor se lleva un ×2 la siguiente.', ir: '#/' },
  { ic: 'socios', t: 'Guerra de servidores', tx: 'Cada semana se enfrenta con otro: gana el que más puntos hace por persona y la semana siguiente lleva ×1,5.',
    ej: 'guerra', mas: 'Cada semana los servidores se enfrentan de a dos. Gana el que más puntos hace por persona en sus eventos, así que no gana el más grande sino el que más juega, y la semana siguiente lleva ×1,5.', ir: '#/' },
  { ic: 'compartir', t: 'Sus posts, en nuestras redes', tx: 'Compartimos sus posts en las redes de Under Legends y en la Liga Global, y sus anuncios y campeones salen en Publicaciones y en las historias.',
    ej: 'redes', mas: 'Compartimos los posts de tu servidor en las redes de Under Legends y en la Liga Global. Sus anuncios y sus campeones salen en Publicaciones y en las historias de la página, que es lo primero que ve quien entra.', ir: '#/publicaciones' },
  { ic: 'perfil', t: 'Su página en la Liga', tx: 'Con su gente, sus eventos, su semana y sus redes, y su invitación para que la gente llegue a su servidor.',
    ej: 'pagina', mas: 'Tu servidor tiene su página en la Liga: su gente, sus próximos eventos y sus llaves, su semana, sus redes y su invitación, para que quien lo descubre en la Liga llegue a tu Discord.', ir: '#/socios' },
];

export function prevSum() {
  try { return !!localStorage.getItem('lg:prev-sum'); } catch (e) { return false; }
}

// el ejemplo de una caja: la imagen, lo que es en detalle y adónde verlo. Con ← → se pasa a la de al lado
function Ejemplo({ i, onCerrar, onIr }) {
  const q = QUE_GANA[i];
  const caja = useRef(null);
  useEffect(() => {
    const k = (e) => {
      if (e.key === 'Escape') onCerrar();
      else if (e.key === 'ArrowRight') onIr(1);
      else if (e.key === 'ArrowLeft') onIr(-1);
    };
    window.addEventListener('keydown', k);
    const html = document.documentElement;
    const antes = html.style.overflow;
    html.style.overflow = 'hidden';
    if (caja.current) caja.current.focus();
    return () => { window.removeEventListener('keydown', k); html.style.overflow = antes; };
  }, [onCerrar, onIr]);
  return (
    <div className="ej-fondo" onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="ej" role="dialog" aria-modal="true" aria-label={q.t} tabIndex={-1} ref={caja}>
        <header className="ej-cab">
          <Ico n={q.ic} t={22} />
          <b>{q.t}</b>
          <span className="ej-n">{i + 1} / {QUE_GANA.length}</span>
          <button type="button" className="btn-ico" aria-label="Cerrar" onClick={onCerrar}><Ico n="cerrar" t={20} /></button>
        </header>
        <figure className="ej-fig">
          <img alt={'Ejemplo: ' + q.t} src={'/ejemplos/ej-' + q.ej + '.webp'} />
          <figcaption>EJEMPLO DE LA LIGA DE HOY</figcaption>
        </figure>
        <p className="ej-tx">{q.mas}</p>
        <footer className="ej-pie">
          <button type="button" className="btn borde2 chico" onClick={() => onIr(-1)} aria-label="La anterior">←</button>
          <a className="btn negro chico" href={q.ir} onClick={onCerrar}>Verlo en la página</a>
          <button type="button" className="btn borde2 chico" onClick={() => onIr(1)} aria-label="La siguiente">→</button>
        </footer>
      </div>
    </div>
  );
}

// las nueve cajas; con `ejemplos`, cada una se toca y muestra su ejemplo
export function QueGana({ ejemplos }) {
  const [i, setI] = useState(null);
  const n = QUE_GANA.length;
  const cerrar = () => setI(null);
  const ir = (d) => setI((x) => (x === null ? x : (x + d + n) % n));
  return (
    <>
      <ul className={'soc-feats' + (ejemplos ? ' con-ej' : '')}>
        {QUE_GANA.map((q, k) => (
          <li key={q.t}>
            {ejemplos ? (
              <button type="button" className="soc-feat-b" onClick={() => setI(k)} aria-haspopup="dialog">
                <Ico n={q.ic} t={24} /><b>{q.t}</b><span>{q.tx}</span><em>VER UN EJEMPLO →</em>
              </button>
            ) : <><Ico n={q.ic} t={24} /><b>{q.t}</b><span>{q.tx}</span></>}
          </li>
        ))}
      </ul>
      {i !== null ? <Ejemplo i={i} onCerrar={cerrar} onIr={ir} /> : null}
    </>
  );
}

// lo que hace el bot en un servidor socio, y lo que no (para el miedo a un «bot de raid»: ver docs de Socios)
export function BotHace() {
  return (
    <div className="soc-bloque">
      <h3>Qué hace el bot en tu servidor</h3>
      <ul>
        <li><b>Lee los anuncios y las llaves</b>, para cargar cada evento solo.</li>
        <li><b>Crea las invitaciones de la Liga</b>, para que la gente llegue a tu servidor y a tus inscripciones.</li>
        <li><b>No toca los mensajes de nadie</b> y no le manda mensajes privados a nadie de tu servidor.</li>
      </ul>
    </div>
  );
}
