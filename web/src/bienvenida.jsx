// 🎮 LA PANTALLA DE BIENVENIDA (Dlx, 19/10/2026: «mejorar esa transición como una página de un juego nuevo online…
// te sale iniciar sesión, comienza a ser parte de la Liga Global y te abre la página, el home con el tutorial», y a las
// preguntas: «primera vez, en el Inicio», «verificarse ahí mismo», y que el botón de no ahora se llame distinto —«en
// otro momento»—, «como una pantalla de bienvenida»).
//
//   1 · LA PORTADA: quién es la Liga en una pantalla —el título, tres números de verdad y las cartas de los primeros del
//       ranking—, con «Unirme a la Liga» (UN viaje a Discord: entra con tu cuenta Y te mete en DRA, el permiso `d` de
//       siempre) y «En otro momento», que la cierra y deja el recorrido de siempre.
//   2 · «COMENZÁ A SER PARTE»: al volver de Discord, la misma verificación de Mi cuenta (`Verificar` de cuenta.jsx: las
//       reglas de DRA, el país, el rol de Miembro). Con eso, «Empezar» abre el Inicio con el recorrido.
//
// ⚠️ Sale UNA vez, a quien llega por primera vez al Inicio sin cuenta (`quiereBienvenida()` de primera.js); quien entra
// por un link (una llave, un perfil) va directo a eso, como siempre. Lo que pasa se cuenta (`contar()`, Dashboard).
// ⚠️ Sin degradés, sin blur y con radios chicos (las reglas del remake); con «Menos animaciones», quieta.
import { Suspense, lazy, useEffect, useState } from 'react';
import { Ico } from './piezas.jsx';
import { num } from './liga.js';
import { contar, pedirRecorrido, tutoPoner } from './primera.js';
import ESTILO from './bienvenida.css?inline';

const W = typeof window !== 'undefined' ? window : {};
const Verificar = lazy(() => import('./cuenta.jsx').then((m) => ({ default: m.Verificar })));
const PASO = 'lg:bienv';

function useVerif() {
  const [v, setV] = useState(() => W.VERIF || null);
  useEffect(() => {
    const f = () => setV(W.VERIF ? Object.assign({}, W.VERIF) : null);
    W.addEventListener('lg:verif', f);
    return () => W.removeEventListener('lg:verif', f);
  }, []);
  return v;
}

export default function Bienvenida({ liga, dc }) {
  const [paso, setPaso] = useState(() => { try { return W.sessionStorage.getItem(PASO) === 'paso2' ? 2 : 1; } catch (e) { return 1; } });
  const [sale, setSale] = useState(false);
  const [cerrada, setCerrada] = useState(false);
  const v = useVerif();
  useEffect(() => { contar(paso === 2 ? 'bienv_paso2' : 'bienv'); }, [paso]);
  // mientras está abierta, la página de atrás no se mueve
  useEffect(() => {
    if (cerrada) return undefined;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => { document.documentElement.style.overflow = prev; };
  }, [cerrada]);
  if (cerrada) return null;

  const cerrar = (como) => {
    tutoPoner({ bienv: como });
    try { W.sessionStorage.removeItem(PASO); } catch (e) { /* nada */ }
    contar(como === 'listo' ? 'bienv_listo' : 'bienv_luego');
    setSale(true);
    setTimeout(() => {
      setCerrada(true);
      // desde el paso 2 se vuelve al Inicio y arranca el recorrido (desde el 1 ya está ahí y arranca solo)
      if (paso === 2) {
        try { W.location.hash = '#/'; } catch (e) { /* queda */ }
        setTimeout(pedirRecorrido, 400);
      }
    }, 380);
  };
  const unirme = () => {
    contar('bienv_unirse');
    try { W.sessionStorage.setItem(PASO, 'paso2'); } catch (e) { /* sin sesión: igual se verifica en Mi cuenta */ }
    tutoPoner({ bienv: 'unirse' });
    if (W.urlLogin) W.location.href = W.urlLogin('d');
  };

  const listo = !!((dc && dc.rapero) || (v && (v.listo || v.completo)));
  const top = liga.oficiales().filter((f) => f.k && liga.cartaDe(f.k)).slice(0, 3);
  // el primero al medio, adelante
  const cartas = top.length === 3 ? [top[1], top[0], top[2]] : top;

  return (
    <div className={'bv' + (sale ? ' sale' : '')} role="dialog" aria-modal="true" aria-label="Bienvenida a la Liga Global">
      <style>{ESTILO}</style>
      <i className="bv-capa m" aria-hidden="true" /><i className="bv-capa v" aria-hidden="true" />
      {paso === 1 ? (
        <div className="bv-c">
          {cartas.length ? (
            <div className="bv-cartas" aria-hidden="true">{cartas.map((f, i) => (
              // (la chica o la grande según la pantalla: en un celular de pantalla densa la chica se vería blanda acá)
              <img key={f.k} className={'bv-carta c' + i + (cartas.length === 3 && i === 1 ? ' uno' : '')} alt=""
                src={liga.cartaUrl(f.k, liga.cartaDe(f.k))}
                srcSet={liga.cartaUrl(f.k, liga.cartaDe(f.k), true) + ' 300w, ' + liga.cartaUrl(f.k, liga.cartaDe(f.k)) + ' 900w'}
                sizes="(max-width: 440px) 132px, 158px"
                onError={(e) => { const g = liga.cartaUrl(f.k, liga.cartaDe(f.k)); if (e.currentTarget.currentSrc !== g) { e.currentTarget.srcset = ''; e.currentTarget.src = g; } }} />
            ))}</div>
          ) : null}
          <span className="bv-k">TEMPORADA {String(liga.temp || '').replace(/^T/i, '')} · EN JUEGO</span>
          <h1 className="bv-t"><span>LIGA GLOBAL</span><span>DE FREESTYLE</span></h1>
          <p className="bv-p">Un solo ranking para los servidores de freestyle de Discord. Jugá en cualquiera, subí en la tabla y ganá tu carta.</p>
          <ul className="bv-n" aria-label="La Liga hoy">
            {/* (los que jugaron: el recorrido cuenta la gente de los servidores, que es otro número) */}
            {liga.d.gente ? <li><b>{num(liga.d.gente)}</b><span>en el ranking</span></li> : null}
            {liga.d.eventos ? <li><b>{num(liga.d.eventos)}</b><span>eventos</span></li> : null}
            {(liga.d.svs || []).length ? <li><b>{(liga.d.svs || []).length}</b><span>servidores</span></li> : null}
          </ul>
          <button type="button" className="bv-si" onClick={unirme}><Ico n="entrar" t={22} />Unirme a la Liga</button>
          <small className="bv-nota">Con tu cuenta de Discord: te sumamos a Discord Rap Español en un toque.</small>
          <button type="button" className="bv-luego" onClick={() => cerrar('luego')}>En otro momento</button>
        </div>
      ) : (
        <div className="bv-c bv-p2">
          <span className="bv-k">{listo ? 'YA ESTÁS ADENTRO' : 'UN PASO MÁS'}</span>
          <h1 className="bv-t chico"><span>{listo ? 'BIENVENIDO A LA' : 'COMENZÁ A SER PARTE DE LA'}</span><span>LIGA GLOBAL</span></h1>
          {listo ? <p className="bv-p">Ya sos parte. Ahora te mostramos dónde está cada cosa: los eventos, el ranking, tu tarjeta y el Pase.</p>
            : <div className="bv-ver"><Suspense fallback={<p className="bv-p">Mirando tu cuenta…</p>}><Verificar liga={liga} dc={dc} /></Suspense></div>}
          <button type="button" className={listo ? 'bv-si' : 'bv-luego'} onClick={() => cerrar(listo ? 'listo' : 'luego')}>
            {listo ? <><Ico n="ir" t={22} />Empezar</> : 'Seguir después'}</button>
        </div>
      )}
    </div>
  );
}

// para que App.jsx la baje sólo cuando hace falta
export { PASO };
