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
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Ico } from './piezas.jsx';
import { limpio, num } from './liga.js';
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

// 🎮 el logo de Discord, en el botón: que el salto a Discord no sorprenda (Simple Icons, CC0)
const DISCORD = 'M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z';

export default function Bienvenida({ liga, dc }) {
  const [paso, setPaso] = useState(() => { try { return W.sessionStorage.getItem(PASO) === 'paso2' ? 2 : 1; } catch (e) { return 1; } });
  const [sale, setSale] = useState(false);
  const [cerrada, setCerrada] = useState(false);
  const tit = useRef(null);
  const cerrarRef = useRef(() => {});
  const v = useVerif();
  useEffect(() => { contar(paso === 2 ? 'bienv_paso2' : 'bienv'); }, [paso]);
  // mientras está abierta, la página de atrás no se mueve
  useEffect(() => {
    if (cerrada) return undefined;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => { document.documentElement.style.overflow = prev; };
  }, [cerrada]);
  // ♿ una ventana de verdad: el foco arranca en el título (no en el botón: un Enter sin querer no te manda a Discord) y
  // Escape es «En otro momento»
  useEffect(() => {
    if (cerrada) return undefined;
    try { if (tit.current) tit.current.focus({ preventScroll: true }); } catch (e) { /* sin foco */ }
    const tecla = (e) => { if (e.key === 'Escape') { e.preventDefault(); cerrarRef.current('luego'); } };
    W.addEventListener('keydown', tecla);
    return () => W.removeEventListener('keydown', tecla);
  }, [cerrada, paso]);
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

  cerrarRef.current = cerrar;
  const listo = !!((dc && dc.rapero) || (v && (v.listo || v.completo)));
  const top = liga.oficiales().filter((f) => f.k && liga.cartaDe(f.k)).slice(0, 3);
  // el primero al medio, adelante
  const cartas = top.length === 3 ? [top[1], top[0], top[2]] : top;
  // 🛡️ LA PRUEBA ANTES DEL PEDIDO (el research del 19/10/2026: «un link que promete un premio y pide iniciar sesión» es
  // el perfil exacto de la estafa contra la que Discord previene). Antes del botón: los servidores de verdad, con su
  // escudo, y la gente que ya está; y al lado del botón, en palabras, lo que Discord va a pedir
  const svs = (liga.d.svs || []).map((s) => (typeof s === 'string' ? s : s && s.sv)).filter(Boolean);
  const nombreSv = (s) => ((liga.svs || {})[s] || {}).nombre || s;
  // lo último que pasó, de verdad (el muro): el último campeón al pie del abanico y una cinta que corre abajo
  let ult = null;
  let cinta = [];
  try {
    const camp = liga.muroLimpio().find((it) => it.tipo === 'campeon');
    ult = camp ? liga.itemMuro(camp) : null;
    cinta = liga.variados(8).map((x) => x[0] + ' · ' + x[1]);
  } catch (e) { /* sin muro todavía: sin dato no hay pieza */ }

  return (
    <div className={'bv' + (sale ? ' sale' : '')} role="dialog" aria-modal="true" aria-labelledby="bv-t">
      <style>{ESTILO}</style>
      <i className="bv-tape a" aria-hidden="true" /><i className="bv-tape b" aria-hidden="true" />
      {paso === 1 ? (
        <>
          <div className="bv-c bv-p1">
            <div className="bv-der">
              {cartas.length ? (
                <div className="bv-cartas" aria-hidden="true">{cartas.map((f, i) => (
                  // (la chica o la grande según la pantalla: en un celular de pantalla densa la chica se vería blanda acá)
                  <img key={f.k} className={'bv-carta c' + i + (cartas.length === 3 && i === 1 ? ' uno' : '')} alt=""
                    src={liga.cartaUrl(f.k, liga.cartaDe(f.k))}
                    srcSet={liga.cartaUrl(f.k, liga.cartaDe(f.k), true) + ' 300w, ' + liga.cartaUrl(f.k, liga.cartaDe(f.k)) + ' 900w'}
                    sizes="(max-width: 899px) 132px, 230px"
                    onError={(e) => { const g = liga.cartaUrl(f.k, liga.cartaDe(f.k)); if (e.currentTarget.currentSrc !== g) { e.currentTarget.srcset = ''; e.currentTarget.src = g; } }} />
                ))}</div>
              ) : null}
              {/* (el abanico es decoración para un lector de pantalla: lo dice esta línea) */}
              <p className="bv-top">{cartas.length === 3 ? <>Los tres primeros de la temporada: <b>{limpio(top[0].n)}</b>, {limpio(top[1].n)} y {limpio(top[2].n)}</> : null}</p>
              {ult ? <p className="bv-ult"><Ico n="copa" t={16} /><span>{ult[1]}</span><small>{ult[3]}</small></p> : null}
            </div>
            <div className="bv-izq">
              <span className="bv-sello">TEMPORADA {String(liga.temp || '').replace(/^T/i, '')} · EN JUEGO</span>
              <h1 className="bv-t" id="bv-t" tabIndex={-1} ref={tit}><span>LIGA GLOBAL</span><span>DE FREESTYLE</span></h1>
              <p className="bv-p">El ranking de los servidores de freestyle de Discord. Juega en el tuyo, subí en la tabla y gana tu carta.</p>
              {svs.length ? (
                <div className="bv-svs">
                  <span className="bv-svs-l">{svs.slice(0, 9).map((s) => <img key={s} alt={nombreSv(s)} title={nombreSv(s)} src={liga.logo(s)} />)}</span>
                  <small>{liga.d.gente ? <><b>{num(liga.d.gente)}</b> en el ranking · </> : null}<b>{svs.length}</b> servidores · <b>{num(liga.d.eventos || 0)}</b> eventos</small>
                </div>
              ) : null}
              <div className="bv-premio">
                <span className="bv-sil" aria-hidden="true">?</span>
                <p><b>Tu carta de Servidor</b>Cuando terminas de unirte se dibuja con tu foto y tu bandera. La de Temporada, con tu primera Tarea del Pase.</p>
              </div>
              <div className="bv-acc">
                <button type="button" className="bv-si" onClick={unirme}>
                  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d={DISCORD} /></svg>Unirme con Discord</button>
                <small className="bv-nota">Te sumamos al server de Discord Rap Español. Sólo vemos tu nombre y tu foto: nunca te pedimos contraseña.</small>
                <button type="button" className="bv-luego" onClick={() => cerrar('luego')}>En otro momento</button>
              </div>
            </div>
          </div>
          {cinta.length > 2 ? (
            <div className="bv-cinta" aria-hidden="true">
              {/* dos veces seguidas: la segunda entra justo cuando se va la primera */}
              <div className="bv-mq">{cinta.concat(cinta).map((t, i) => <span key={i}>{t}</span>)}</div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="bv-c bv-p2">
          <span className="bv-sello">{listo ? 'YA ESTÁS ADENTRO' : 'UN PASO MÁS'}</span>
          <h1 className="bv-t chico" id="bv-t" tabIndex={-1} ref={tit}><span>{listo ? 'BIENVENIDO A LA' : 'COMIENZA A SER PARTE DE LA'}</span><span>LIGA GLOBAL</span></h1>
          {listo ? <p className="bv-p">Ya eres parte. Ahora te mostramos dónde está cada cosa: los eventos, el ranking, tu tarjeta y el Pase.</p>
            : <div className="bv-ver"><Suspense fallback={<p className="bv-p">Mirando tu cuenta…</p>}><Verificar liga={liga} dc={dc} /></Suspense></div>}
          <button type="button" className={listo ? 'bv-si' : 'bv-luego'} onClick={() => cerrar(listo ? 'listo' : 'luego')}>
            {listo ? <>Empezar<Ico n="flecha" t={22} /></> : 'Seguir después'}</button>
        </div>
      )}
    </div>
  );
}

// para que App.jsx la baje sólo cuando hace falta
export { PASO };
