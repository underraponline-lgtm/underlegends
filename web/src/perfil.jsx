// El perfil de cada rapero (`#/r/<clave>` y `#/r/<clave>/<pestaña>`). Dlx, 03/10/2026, al plan: «1. A» (pestañas:
// Resumen · Eventos · Duelos · Insignias, cada una con su link) · «2. A» (en Resumen: sus números, sus fortalezas —el
// radar que pidió el 27/09—, en cada ranking, lo que le falta y el precio por su cabeza) · «3. A» (el cara a cara y sus
// duelos, juntos: al tocar un rival, sus duelos con él). Para todos desde la 2.09 (Dlx: «1. A»), con «Comparar conmigo»
// («2. A»). El de app.js sigue escondido, de respaldo.
//
// ⚠️ LOS DATOS SON LOS DE LA PÁGINA DE HOY: la fila de la tabla (`liga.T[k]`) y `/api/perfiles` (`p[k]`: `ev` sus
// eventos, `du` sus duelos, `dm` las cinco dimensiones, `rd` la racha de duelos, `rk` su puesto en cada ranking, `req`
// lo que le falta, `ins` sus insignias, `mw` su cacería; `e` los eventos y `dmp` el promedio de la Liga). Las acciones
// —seguir, el precio por cabeza, el visor de cartas y de llaves— son las de app.js.
import { useEffect, useMemo, useRef, useState } from 'react';
import { MESES, diaISO, limpio, minutosDelDia, norm, num, siglaDe } from './liga.js';
import { Bandera, Cara, Compartir, DosToques, FaltaLista, Ico, Medalla, PUESTO_MEDALLA, QueEsBoton, silueta, QueEsTexto, Rango, accion, diaET, enlace, https, nombrePais, usePerfiles } from './piezas.jsx';
import { PanelEmblemas, PildoraEmblemas, emblemasDe } from './emblemas.jsx';
import { REDES } from './servidor.jsx';
import { useNiveles } from './racha.js';
import { usePaseDe } from './pase.js';
import { textoRol, useRoles } from './roles.js';
import { urlFondo, useFondos } from './fondos.js';
import { svElegido, useElegidos } from './elegidos.js';
import * as RQ from './requisitos.js';
import { Cartas, Pub, useAplausos } from './publicaciones.jsx';
import { Miniatura, abrirVideo } from './video.jsx';
import { crewDe, useCrews } from './crews.js';
import { CrewsParaVos, InvitarACrew, RolCrew } from './crewpanel.jsx';
import CSS_PAGINA from './css/perfil.css?inline';
import { usarCss } from './css.js';

// 🎨 su CSS, con su pedazo (web/src/css/perfil.css)
usarCss('perfil', CSS_PAGINA);

// 🔑 UNA SOLA PÁGINA (Dlx, 07/10/2026: *«me gustaría que todo esté en una página, no que esté dividido en varias»*).
// Las pestañas de antes siguen siendo links que circulan (`#/r/x/duelos`): ahora bajan hasta su sección
const SECCIONES = ['eventos', 'duelos', 'insignias', 'publicaciones'];
const DIAS = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];
const DIA1 = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const ORDEN = ['temporada', 'competitivo', 'servidor', 'pais'];
const NOMBRE = { temporada: 'Temporada', competitivo: 'Competitiva', servidor: 'Servidor', pais: 'País' };
// las listas largas del perfil (sus eventos, cara a cara): cuántas se ven antes de «Ver los N»
const VER_PRIMEROS = 8;
// quién está en «Comparar dos» de Tarjetas (la de Temporada, que es la que abre): con carta y con cara, como
// `conTarjeta()` de app.js. Sin esto, «Comparar conmigo» con alguien sin cara ponía en su lugar al #1 de la lista
const enComparar = (x) => !!x && (x.c || []).includes('temporada') && x.fo !== 0;
const MEDALLA = PUESTO_MEDALLA;
// en la zona de quien mira (Ajustes), no la del aparato (revisión del 04/10/2026)
const fecha = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const [, m, dd] = diaISO(d).split('-');
  return Number(dd) + ' ' + ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEPT', 'OCT', 'NOV', 'DIC'][Number(m) - 1];
};

// ── seguir: el de app.js (`alternarSigo()`: este navegador y, si entraste con Discord, tu cuenta). A quién seguís
// vuelve por `lg:sigo`, así que el botón cambia solo. Los seguidores (`pedirSeguidores()`, cinco minutos de memoria)
// se corrigen al toque con lo que acabás de hacer, para que seguir no deje el número igual ──
function useSeguidores(k) {
  const [n, setN] = useState(null);
  useEffect(() => {
    let vivo = true;
    setN(null);
    if (typeof window.pedirSeguidores === 'function') {
      Promise.resolve(window.pedirSeguidores()).then((s) => { if (vivo) setN((s || {})[k] || 0); }).catch(() => {});
    }
    return () => { vivo = false; };
  }, [k]);
  return n;
}
// ── el precio por su cabeza: el de la Tienda de app.js (`ponerPrecio()`), con su cuenta y sus errores; las
// cabezas van por NOMBRE. Sólo a quien juega la temporada y no es «fuera de concurso» (`puedeCabeza()`) ──
const sinEtiquetas = (h) => String(h || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
function usePrecios() {
  const [, setV] = useState(0);
  useEffect(() => {
    const f = () => setV((x) => x + 1);
    window.addEventListener('lg:precios', f);
    return () => window.removeEventListener('lg:precios', f);
  }, []);
}
function Precio({ liga, f, esYo, dc }) {
  usePrecios();
  const T = liga.d.tienda;
  if (!T || f.fc || !f.pos || typeof window.ponerPrecio !== 'function') return null;
  const v = (typeof window.valorCabezas === 'function' ? window.valorCabezas() : {})[f.n] || 0;
  const est = (window.PR_EST || {})[f.n] || {};
  const saldo = window.BILL && window.BILL.ok ? window.BILL.saldo : null;
  const queda = T.tope - v;
  const msg = est.va ? 'Poniendo ' + num(est.va) + '…'
    : est.ok ? '✓ Pusiste ' + num(est.ok) + '. Si nadie lo caza en la semana, vuelven a ti.'
      : est.error ? sinEtiquetas(typeof window.errorPrecio === 'function' ? window.errorPrecio(est) : 'No pude ponerlo.')
        : dc ? 'Elige cuánto ponerle.' : 'Para poner un precio entras con Discord: toca un monto.';
  return (
    <section className="sec pf-sec pf8-pr">
      <div className="sec-t"><h2>Precio por su cabeza</h2><a href="#/tienda">Cómo funciona <Ico n="flecha" t={16} /></a></div>
      <p className="pf-bajada">El primero que le gane en un evento de la Liga se lleva lo que vale, en Puntos de Tienda y en su Temporada.</p>
      <p className="pf-pr"><b>{limpio(f.n)}</b> vale <span className="pf-pr-v">{num(v)}</span>
        {v < T.tope ? <> · se le pueden poner {num(queda)} más</> : <> · ya vale lo máximo</>}</p>
      {esYo ? <p className="pf-bajada">Eres tú: no te puedes poner precio.</p> : (
        <>
          <div className="pf-pr-m">
            {[1, 2, 5, 10].map((x) => T.min * x).map((m) => (
              <DosToques key={m} className="btn borde2 chico" disabled={m > queda || (saldo != null && m > saldo) || !!est.va}
                confirmar={'¿' + num(m) + '? Toca de nuevo'} onClick={() => window.ponerPrecio(f.n, m)}>+{num(m)}</DosToques>
            ))}
          </div>
          <p className={'pf-pr-e' + (est.error ? ' mal' : '')} aria-live="polite">{msg}</p>
        </>
      )}
    </section>
  );
}

// 📅 DESDE CUÁNDO ESTÁ VERIFICADO (Dlx, 13/10/2026: «en mi perfil agrega la fecha en la cual se verificaron»): `vd` del
// perfil, 'AAAA-MM-DD' o 'pre' (ya lo estaba antes de la T1: no se sabe desde cuándo). Ver `verificados.desde()`
export function textoVerificado(vd) {
  if (vd === 'pre') return 'Verificado antes de la T1';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(vd || ''));
  if (!m) return '';
  return 'Verificado el ' + Number(m[3]) + ' de ' + MESES[Number(m[2]) - 1].slice(0, 3) + (m[1] !== '2026' ? ' de ' + m[1] : '');
}

// ── arriba: quién es, sus números y sus dos puertas ──
// 🎨 EL REMAKE DEL 21/10/2026 (la maqueta B, versiones 1 a 11, `scratchpad/maqueta_pf/gen_pf11.py`). Dlx eligió «portada
// y barra, B3» para la compu y la B para el celular, y la última versión se aplica ENTERA:
// · arriba su fondo (el del nivel 10 del Pase, «en mi perfil»; sin fondo, el color de su servidor) y la carta chica
//   apoyada en el borde; «Seguir» a la derecha, donde lo ponen X, Twitch y Discord;
// · su nombre, la crew en su pastilla (como la etiqueta de clan) y sus emblemas; el rol, el país, su nivel, su Pase y su
//   frase entre comillas;
// · los números en una barra: lo que es (OVR y rango, con el color del rango) separado de lo que hizo (puntos, eventos,
//   win), y en la compu sus seguidores como dos números más;
// · dos puertas, Tarjetas y Vitrina (la Vitrina, trofeos de eventos: «ahí ya veremos»);
// · Comparar, Compartir, Copiar el link, Invitar a mi crew y Reportar usuario, en «⋯» (Dlx: «comparar conmigo está bien
//   pero el perfil no es el lugar»).

// 🌐 las redes con su ícono de verdad, en blanco (Dlx, a la v6: «hacer los íconos más reales… en blanco o en colores del
// tema»). Una que no está acá sale con su nombre
const RED_SVG = {
  youtube: <><rect x="1.5" y="5" width="21" height="14" rx="4" fill="currentColor" /><polygon points="10,9 15.5,12 10,15" fill="#030304" /></>,
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5.2" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="17.3" cy="6.7" r="1.3" fill="currentColor" /></>,
  tiktok: <path d="M14 3v11a3.4 3.4 0 1 1-2.6-3.3V7.6A6.6 6.6 0 1 0 17.1 14V8.7a7 7 0 0 0 4 1.3V6.9A4.2 4.2 0 0 1 17 3Z" fill="currentColor" />,
  spotify: <><circle cx="12" cy="12" r="10" fill="currentColor" /><path d="M6.5 9.3c3.7-1.1 7.8-.8 11 1M7.2 12.5c3-.8 6.2-.5 8.8.9M7.9 15.5c2.3-.6 4.6-.4 6.6.7" fill="none" stroke="#030304" strokeWidth="1.7" strokeLinecap="round" /></>,
  x: <path d="M3.5 3h4.6l4.1 5.6L17 3h3.2l-6.5 7.5L21 21h-4.6l-4.5-6.1L6.6 21H3.4l7-8.1Z" fill="currentColor" />,
  twitch: <path d="M5 3h16v11l-5 5h-4l-3 3H7v-3H3V7l2-4Zm3 4v7M13 7v7" fill="none" stroke="currentColor" strokeWidth="2" />,
  kick: <path d="M4 3h5v5h2V6h2V4h6v5h-2v2h-2v2h2v2h2v5h-6v-2h-2v-2H9v5H4Z" fill="currentColor" />,
};
RED_SVG.twitter = RED_SVG.x;
function Redes({ redes, cls = '' }) {
  const rs = (redes || []).filter((r) => r && https(r[1]));
  if (!rs.length) return null;
  return (
    <span className={'pf8-redes ' + cls}>
      {rs.map((r) => (
        <a key={r[1]} href={https(r[1])} target="_blank" rel="noopener noreferrer" title={REDES[r[0]] || r[0]} aria-label={REDES[r[0]] || r[0]}>
          {RED_SVG[r[0]] ? <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">{RED_SVG[r[0]]}</svg> : <b>{REDES[r[0]] || r[0]}</b>}
        </a>
      ))}
    </span>
  );
}

// 👥 seguidores y 👤 a cuántos sigue (`s` de /avisos/seguidores, 21/10/2026). Desde 10.000 se abrevia como Instagram,
// cortando y sin redondear: 12.480 es «12,4 mil» (Dlx, a la v10: «¿y si alguien tiene 1000 seguidores? ejemplo drástico»)
const abreviar = (n) => (n >= 10000 ? (Math.floor(n / 100) / 10).toLocaleString('es', { maximumFractionDigits: 1 }) + ' mil' : num(n));
function useSiguiendo(k, seg) {
  return useMemo(() => (seg == null || typeof window.siguiendoDe !== 'function' ? null : window.siguiendoDe(k)), [k, seg]);
}

// 🔒 PARA SEGUIR HAY QUE ESTAR VERIFICADO, y para que te sigan también (Dlx, 21/10/2026: «para seguir o que te sigan
// necesitas estar 100 % verificado en la página», y «que le salga un pop up diciendo no estás verificado o el usuario no
// está verificado, dependiendo»). Verificado es tener tu clave de la Liga (`dc.rapero`, la de `d:`), como en Tu cuenta.
// Dejar de seguir se puede siempre
function AvisoVerificar({ cual, nombre, onCerrar }) {
  const t = cual === 'otro' ? [limpio(nombre) + ' no está verificado', 'Para que te puedan seguir hay que estar verificado en la Liga. Cuando se verifique, vas a poder seguirlo.']
    : cual === 'entrar' ? ['Entra para seguir', 'Para seguir a alguien tienes que entrar con Discord y estar verificado.']
      : ['No estás verificado', 'Para seguir a alguien tienes que estar verificado: es estar en Discord Rap Español, con tu país y el rol de Miembro.'];
  return (
    <div className="emb-velo" role="presentation" onClick={onCerrar}>
      <div className="pf8-aviso" role="alertdialog" aria-modal="true" aria-label={t[0]} onClick={(e) => e.stopPropagation()}>
        <span className="pf8-aviso-ic" aria-hidden="true"><Ico n="candado" t={26} /></span>
        <h3>{t[0]}</h3>
        <p>{t[1]}</p>
        <div className="pf8-aviso-b">
          {cual === 'entrar' ? <button type="button" className="btn verde chico" onClick={accion.entrar}>Entrar con Discord</button> : null}
          {cual === 'yo' ? <a className="btn verde chico" href="#/cuenta/verificar" onClick={onCerrar}>Verificarme</a> : null}
          <button type="button" className="btn borde chico" onClick={onCerrar}>{cual === 'otro' ? 'Entendido' : 'Ahora no'}</button>
        </div>
      </div>
    </div>
  );
}

// 🚩 REPORTAR USUARIO (Dlx, 21/10/2026: «que se pueda reportar… en los 3 puntos, o sea reportar usuario»): va a los
// reportes, como un error de una llave (`/avisos/reportar`, llave `perfil:<clave>`): al Dashboard y a ✅ Decidir
function ReportarUsuario({ k, nombre, dc, onCerrar }) {
  const [t, setT] = useState('');
  const [est, setEst] = useState('');
  const mandar = () => {
    if (!dc) { accion.entrar(); return; }
    if (t.trim().length < 3 || typeof window.conCuenta !== 'function') return;
    setEst('va');
    window.conCuenta('/api/avisos/reportar', { llave: 'perfil:' + k, que: 'perfil', texto: t.trim() }).then((j) => {
      if (!j) { setEst(''); return; }
      setEst(j.status === 200 ? 'ok' : j.error === 'nueva' ? 'Tu cuenta de Discord es muy nueva para reportar.'
        : j.error === 'tope' ? 'Ya mandaste varios reportes hoy: prueba mañana.' : 'No pude mandarlo. Prueba de nuevo en un rato.');
    }).catch(() => setEst('Sin conexión: prueba de nuevo.'));
  };
  return (
    <div className="emb-velo" role="presentation" onClick={onCerrar}>
      <div className="pf8-aviso pf8-rep" role="dialog" aria-modal="true" aria-label={'Reportar a ' + limpio(nombre)} onClick={(e) => e.stopPropagation()}>
        <h3>Reportar a {limpio(nombre)}</h3>
        {est === 'ok' ? <p>Gracias: lo vamos a mirar.</p> : <>
          <p>¿Qué está mal? Su frase, su foto, su nombre o algo que publicó.</p>
          <textarea value={t} maxLength={300} rows={3} onChange={(e) => setT(e.target.value)} placeholder="Cuéntanos qué viste" aria-label="Qué está mal" />
          {est && est !== 'va' ? <p className="pf8-mal">{est}</p> : null}
        </>}
        <div className="pf8-aviso-b">
          {est === 'ok' ? null : <button type="button" className="btn verde chico" disabled={est === 'va' || (dc && t.trim().length < 3)} onClick={mandar}>{dc ? 'Mandar el reporte' : 'Entrar con Discord'}</button>}
          <button type="button" className="btn borde chico" onClick={onCerrar}>{est === 'ok' ? 'Listo' : 'Cancelar'}</button>
        </div>
      </div>
    </div>
  );
}

// ⋯ EL MENÚ DE LA ESQUINA (Dlx, a la v10: «los 3 puntos de arriba a la derecha es un detallazo»). A un visitante:
// Compartir, Comparar conmigo, Copiar el link, Invitar a mi crew y Reportar usuario. En tu perfil, atajos a lo tuyo
function MenuMas({ liga, f, k, esYo, dc, onEmblemas, onReportar }) {
  const [ab, setAb] = useState(false);
  const [dijo, setDijo] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    if (!ab) return undefined;
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setAb(false); };
    const esc = (e) => { if (e.key === 'Escape') setAb(false); };
    document.addEventListener('pointerdown', fuera, true);
    window.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', fuera, true); window.removeEventListener('keydown', esc); };
  }, [ab]);
  const url = enlace('#/r/' + encodeURIComponent(k));
  const copiar = async () => {
    try { await navigator.clipboard.writeText(url); setDijo('Link copiado'); } catch (e) { setDijo('No pude copiarlo'); }
    setTimeout(() => { setDijo(''); setAb(false); }, 1400);
  };
  const comparar = !esYo && liga.yo && liga.yo.k !== f.k && enComparar(liga.yo) && enComparar(f);
  return (
    <div className="pf8-mas" ref={ref}>
      <button type="button" className="pf8-mas-b" aria-haspopup="menu" aria-expanded={ab} aria-label="Más opciones" onClick={() => setAb(!ab)}>⋯</button>
      {ab ? (
        <div className="pf8-menu" role="menu">
          {esYo ? <>
            <span className="pf8-menu-t">TU PERFIL</span>
            <button type="button" role="menuitem" onClick={() => { setAb(false); onEmblemas(); }}>◆ Ver mis emblemas</button>
            <a role="menuitem" href="#/cuenta/fondo">🖼 Cambiar mi fondo</a>
            <a role="menuitem" href="#/cuenta/perfil">＠ Mi foto y mis redes</a>
          </> : null}
          <Compartir cls="pf8-menu-i" url={url} texto={limpio(f.n) + ' en la Liga Global'} etiqueta={esYo ? 'Compartir mi perfil' : 'Compartir el perfil'} />
          {comparar ? <a role="menuitem" href={'#/tarjetas?a=' + encodeURIComponent(liga.yo.k) + '&b=' + encodeURIComponent(f.k)}>⇄ Comparar conmigo</a> : null}
          <button type="button" role="menuitem" onClick={copiar}>🔗 {dijo || 'Copiar el link'}</button>
          {!esYo ? <div className="pf8-menu-crew"><InvitarACrew k={k} nombre={f.n} /></div> : null}
          {!esYo ? <button type="button" role="menuitem" className="rojo" onClick={() => { setAb(false); onReportar(); }}>⚑ Reportar usuario<small>su frase, su foto, su nombre o lo que publicó</small></button> : null}
        </div>
      ) : null}
    </div>
  );
}

// 🏆 LA VITRINA, DIBUJADA (Dlx, a la v8: «la de vitrina podría ser mejor su imagen»): tres copas en un estante con su luz
function CopasVitrina() {
  const copa = (cx, s, g) => (
    <g transform={`translate(${cx} ${38 - 18.6 * s}) scale(${s})`} fill={`url(#${g})`}>
      <path d="M-7 0H7L6.2 6Q5 11.5 0 12Q-5 11.5-6.2 6Z" />
      <path d="M-6.6 1.5Q-11 1.5-10 5.5Q-9 8.5-5.6 8.6" fill="none" stroke={`url(#${g})`} strokeWidth="1.6" />
      <path d="M6.6 1.5Q11 1.5 10 5.5Q9 8.5 5.6 8.6" fill="none" stroke={`url(#${g})`} strokeWidth="1.6" />
      <rect x="-1.3" y="11.5" width="2.6" height="4.5" /><rect x="-5" y="15.6" width="10" height="3" rx=".8" />
    </g>
  );
  return (
    <svg viewBox="0 0 56 44" aria-hidden="true">
      <defs>
        <linearGradient id="pf8o" x1="0" x2="1"><stop offset="0" stopColor="#9A6B00" /><stop offset=".45" stopColor="#FFE38A" /><stop offset="1" stopColor="#C8920F" /></linearGradient>
        <linearGradient id="pf8p" x1="0" x2="1"><stop offset="0" stopColor="#6E747D" /><stop offset=".45" stopColor="#F4F6F8" /><stop offset="1" stopColor="#9AA0A8" /></linearGradient>
        <linearGradient id="pf8b" x1="0" x2="1"><stop offset="0" stopColor="#7A3A10" /><stop offset=".45" stopColor="#F2B27A" /><stop offset="1" stopColor="#B25E22" /></linearGradient>
        <radialGradient id="pf8l" cx=".5" cy="0" r="1"><stop offset="0" stopColor="#FFE9A8" stopOpacity=".42" /><stop offset=".7" stopColor="#FFE9A8" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="56" height="44" rx="4" fill="#121216" /><path d="M18 0H38L52 38H4Z" fill="url(#pf8l)" />
      {copa(14, 0.82, 'pf8p')}{copa(42, 0.78, 'pf8b')}{copa(28, 1.15, 'pf8o')}
      <rect x="3" y="38" width="50" height="3" rx="1" fill="#3A3A40" /><rect x="3" y="38" width="50" height=".8" fill="#5A5A62" />
    </svg>
  );
}

// 🚪 LAS DOS PUERTAS (Dlx, a la v4: «eso de las tarjetas ocupa bastante… podríamos hacer un espacio que diga ver
// tarjetas»): sus tarjetas (las suyas y las de servidor) en el visor, y la Vitrina, que llega después
function Puertas({ liga, f, k, cs, svc }) {
  const [pronto, setPronto] = useState(false);
  const total = cs.length + svc.length;
  const prev = cs.slice(0, 3);
  return (
    <div className="pf8-puertas">
      <button type="button" className="pf8-pu" onClick={() => accion.carta(k)} disabled={!cs.length} aria-label={'Ver las tarjetas de ' + limpio(f.n)}>
        <span className="pf8-pu-tj" aria-hidden="true">{prev.map((c) => <img key={c} alt="" src={liga.cartaUrl(k, c)} loading="lazy" />)}</span>
        <span className="pf8-pu-tx"><b>Tarjetas</b><small>{!total ? 'todavía ninguna' : total + (svc.length ? ' · las suyas y ' + svc.length + ' de servidor' : total === 1 ? ' tarjeta' : ' tarjetas')}</small></span>
        <em aria-hidden="true">›</em>
      </button>
      <button type="button" className="pf8-pu" aria-expanded={pronto} onClick={() => setPronto(!pronto)}>
        <span className="pf8-pu-vt" aria-hidden="true"><CopasVitrina /></span>
        <span className="pf8-pu-tx"><b>Vitrina</b><small>{pronto ? 'los trofeos de sus eventos · llega pronto' : (f.oro || 0) + ((f.oro || 0) === 1 ? ' trofeo' : ' trofeos') + ' · pronto'}</small></span>
        <em aria-hidden="true">›</em>
      </button>
    </div>
  );
}

// 🔢 LA LÍNEA DE NÚMEROS, la B (Dlx, a la v8: «se ve algo rara», y a la v10: «B3, pero centra más lo de 75k puntos»):
// lo que es —OVR y rango, con el borde del color de su rango— separado de lo que hizo, cada número centrado en su
// columna. «50,0» pasa a «50 %»
function NumerosB({ liga, f, q }) {
  const wr = f.wr ? String(Math.round(parseFloat(String(f.wr).replace(',', '.')) || 0)) + ' %' : '—';
  return (
    <div className="pf8-num">
      <div className="pf8-yo" style={{ '--rc': f.rg ? liga.colorRg(f.rg) : 'var(--esc-linea)' }}>
        <b>{f.ovr || '—'}</b><Rango liga={liga} rg={f.rg} /><small>OVR {q('ovr')}</small>
      </div>
      <div className="pf8-tres">
        <div><b className={num(f.pts || 0).length > 6 ? 'largo' : undefined}>{num(f.pts || 0)}</b><small>PUNTOS {q('puntos')}</small></div>
        <div><b>{f.ev || 0}</b><small>EVENTOS {q('eventos')}</small></div>
        <div title={f.wr ? undefined : 'El Win% aparece con 10 eventos'}><b>{wr}</b><small>WIN {q('win')}</small></div>
      </div>
    </div>
  );
}

function Cabeza({ liga, f, k, p, dc, esYo, onEmblemas, ems, numeros }) {
  const si = (liga.sigue || []).includes(k);
  const n0 = useSeguidores(k);
  const [si0, setSi0] = useState(si);
  useEffect(() => { setSi0((liga.sigue || []).includes(k)); }, [k]); // eslint-disable-line react-hooks/exhaustive-deps
  const segs = n0 == null ? null : Math.max(0, n0 + (si ? 1 : 0) - (si0 ? 1 : 0));
  const sigue = useSiguiendo(k, n0);
  const cs = ORDEN.filter((c) => (f.c || []).includes(c));
  const propio = String(f.sv || '').toLowerCase();
  const svc = ((p && p.svc) || []).filter((x) => x !== propio);
  // 🏠 de dónde es, sólo si lo eligió (Dlx, 12/10/2026): el color de arriba, sin fondo propio
  const svE = svElegido(liga, useElegidos(), k);
  const sv = svE && liga.svs[svE];
  const crew = liga.crewDe(f);
  useCrews();
  const cv = crewDe(k);
  const nvs = useNiveles();
  const nv = nvs && nvs[k];
  const pa = usePaseDe(k);
  const rls = (useRoles() || {})[k] || [];
  const fo = (useFondos() || {})[k];
  const fondoPf = fo && fo[1] ? urlFondo(fo[0]) : '';
  const [qe, setQe] = useState('');
  const [aviso, setAviso] = useState('');
  const [rep, setRep] = useState(false);
  useEffect(() => { setQe(''); setAviso(''); setRep(false); }, [k]);
  const q = (id) => <QueEsBoton k={id} abierto={qe === id} onToggle={() => setQe(qe === id ? '' : id)} />;
  // 🏷️ el rol: el primero de los suyos (el que pone Dlx antes que los de Discord). El de DRA (Freestyler, Rapero…), cuando viaje
  const rol = rls.length ? textoRol(rls[0]) : '';
  // 👥 la crew en su pastilla: la sigla siempre, el nombre se corta (Dlx, a la v8: «¿o el nombre de la crew es muy largo?»)
  const cn = cv ? cv.c.nombre : crew ? crew.crew : f.crew || '';
  const csig = (cv && cv.c.sigla) || cn.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 4).toUpperCase();
  const chref = cv ? '#/crew/' + encodeURIComponent(cv.c.id) : crew ? '#/crew/' + encodeURIComponent(crew.clave || crew.crew) : '';
  const seguir = () => {
    if (!si) {
      if (!dc) { setAviso('entrar'); return; }
      if (!dc.rapero) { setAviso('yo'); return; }
      if (f.nv) { setAviso('otro'); return; }
    }
    window.alternarSigo(k);
  };
  const frase = p && p.fr ? <q className="pf8-frase">{p.fr}</q> : null;
  return (
    <>
    <div className={'escena pf8' + (fondoPf ? ' con-fondo' : '')} style={{ '--mo-c': (sv && sv.color) || '#E41373', '--mo-o': 0.85, '--mo-c2': '#29B298', ...silueta(sv && svE, sv && sv.color), ...(fondoPf ? { '--pf-fondo': fondoPf } : {}) }}>
      <div className="pf8-cover" />
      <MenuMas liga={liga} f={f} k={k} esYo={esYo} dc={dc} onEmblemas={() => onEmblemas('')} onReportar={() => setRep(true)} />
      <section className="pf8-cab">
        {/* 👤 SU FOTO, EN UN CÍRCULO, en vez de la carta (Dlx, 21/10/2026: «en vez de la tarjeta que sea la foto elegida en
            mi perfil… en un círculo»): la de /foto, o la inicial si no tiene. Las cartas siguen en la puerta de Tarjetas */}
        <div className="pf8-carta"><Cara liga={liga} k={k} nombre={f.n} cls="cara pf8-cara" /></div>
        <div className="pf8-tx">
          <span className="tag">{f.solo ? 'EN LA LIGA' : f.pos ? '#' + f.pos + ' DE LA TEMPORADA' : 'FUERA DE CONCURSO'} · {liga.temp}</span>
          <div className="pf8-nom">
            <h1 className="hero-ev largo" style={pa && pa.color ? { color: pa.color } : undefined}>{limpio(f.n)}</h1>
            {cn || ems.length ? (
              <div className="pf8-pills">
                {cn ? (chref ? <a className="pf8-crew" href={chref} title={limpio(cn)}><b>{csig || '?'}</b><span>{limpio(cn)}</span>{cv && cv.rol !== 'miembro' ? <RolCrew rol={cv.rol} /> : null}</a>
                  : <span className="pf8-crew" title={limpio(cn)}><b>{csig || '?'}</b><span>{limpio(cn)}</span></span>) : null}
                <PildoraEmblemas xs={ems} onAbrir={onEmblemas} />
              </div>
            ) : null}
          </div>
          <p className="pf8-segs">
            {rol ? <span>{rol}</span> : null}
            {f.cc ? <a href={'#/pais/' + f.cc}><Bandera cc={f.cc} cls="pf-flag" />{nombrePais(f.cc)}</a> : null}
            {svE ? <a href={'#/sv/' + siglaDe(svE)} title="Eligió este servidor"><img alt="" src={liga.logo(svE)} />{siglaDe(svE)}</a> : null}
            {nv ? <span title="Sube jugando, entrando cada día y con lo que hace en la Liga">Nivel {nv[0]}</span> : null}
            {pa ? <a href="#/pase" title="Su nivel en el Pase de rapero de la temporada">Pase {pa.nivel}</a> : null}
            {frase}
          </p>
          {f.nv ? <p className="pf-nv"><b>Sin verificar.</b> {RQ.sinVerificar(f.nv, esYo)}{esYo ? <> <a href="#/cuenta/verificar">Verificarme</a></> : null}</p> : null}
        </div>
        <div className="pf8-acc">
          {esYo ? <a className="btn borde pf8-seguir" href="#/cuenta/perfil">Editar mi perfil</a>
            : typeof window.alternarSigo === 'function' ? (
              <button type="button" className={'btn pf8-seguir ' + (si ? 'borde on' : 'verde')} aria-pressed={si} onClick={seguir}>
                {si ? 'Siguiendo' : 'Seguir'}</button>
            ) : null}
          <Redes redes={p && p.redes} cls="pc" />
        </div>
        <div className="pf8-bar">
          {numeros ? <NumerosB liga={liga} f={f} q={q} /> : null}
          <div className="pf8-soc">
            <div><b>{segs == null ? '—' : abreviar(segs)}</b><small>{segs === 1 ? 'seguidor' : 'seguidores'}</small></div>
            <div><b>{sigue == null ? '—' : abreviar(sigue)}</b><small>siguiendo</small></div>
            <Redes redes={p && p.redes} cls="tel" />
          </div>
          <Puertas liga={liga} f={f} k={k} cs={cs} svc={svc} />
        </div>
        <QueEsTexto k={qe} />
      </section>
    </div>
    {/* (afuera de la escena, que corta lo que se le sale) */}
    {aviso ? <AvisoVerificar cual={aviso} nombre={f.n} onCerrar={() => setAviso('')} /> : null}
    {rep ? <ReportarUsuario k={k} nombre={f.n} dc={dc} onCerrar={() => setRep(false)} /> : null}
    </>
  );
}

// ── Resumen ──
// 👀 DE UN VISTAZO (Dlx, a la v2: «De un vistazo está incompleto, le falta detalle»): seis números, cada uno con una línea
// que dice qué significa. Los duelos, en negro, con la tira de los últimos. `ev` y `du` vienen del más nuevo al más viejo
const SEMIS_O_MAS = ['Campeón', 'Subcampeón', 'Tercero', 'Cuarto', 'Semifinal'];
function DeUnVistazo({ f, p }) {
  const ev = (p && p.ev) || [];
  const du = (p && p.du) || [];
  const g = du.filter((d) => d[2]).length;
  const rd = (p && p.rd) || null;
  const rch = Array.isArray(f.rch) ? f.rch : null;
  const pod = (f.oro || 0) + (f.seg || 0) + (f.ter || 0);
  const semisMas = ev.filter((x) => SEMIS_O_MAS.includes(x[1])).length;
  const ult = du[0];
  // quién le cortó la racha de duelos: la última que perdió
  const corto = rd && !rd[0] ? du.find((d) => !d[2]) : null;
  const tira = du.slice(0, 16).reverse();
  return (
    <section className="sec pf-sec pf8-vz">
      <div className="sec-t"><h2>De un vistazo</h2></div>
      <div className="pf8-bento">
        <div><small>PODIOS</small>
          <b className="pf-med"><span title="Campeón"><Medalla p={1} />{f.oro || 0}</span><span title="Subcampeón"><Medalla p={2} />{f.seg || 0}</span><span title="Tercero"><Medalla p={3} />{f.ter || 0}</span></b>
          <em>{pod ? 'en ' + pod + ' de sus ' + ev.length + ' eventos' + (f.oro ? ' · campeón ' + (f.oro === 1 ? 'una vez' : f.oro + ' veces') : '') : 'todavía sin podio'}</em></div>
        <div><small>QUEDÓ EN SEMIS</small><b>{f.sem || 0}</b>
          <em>{ev.length ? semisMas + ' de ' + ev.length + ' terminó en semis o más' : 'sin eventos todavía'}</em></div>
        <div className="negro"><small>DUELOS GANADOS</small><b>{g}<span>/{du.length}</span></b>
          {tira.length ? <span className="pf8-wl" aria-label={'Sus últimos duelos: ' + tira.map((d) => (d[2] ? 'ganó' : 'perdió')).join(', ')}>
            {tira.map((d, i) => <i key={i} className={d[2] ? 'g' : 'p'} />)}</span> : null}
          <em>{du.length ? Math.round((100 * g) / du.length) + ' % ganados · el último lo ' + (ult && ult[2] ? 'ganó' : 'perdió') : 'cuentan los 1vs1 de las llaves'}</em></div>
        <div className="negro"><small>RACHA DE DUELOS</small><b>{rd ? rd[0] : 0}{rd ? <span> · máx {rd[1]}</span> : null}</b>
          <em>{corto ? 'ganados seguidos: la cortó ' + limpio(corto[1]) : rd && rd[0] ? 'ganados seguidos, y sigue' : 'ganados seguidos'}</em></div>
        <div><small>RACHA DE EVENTOS</small><b>{rch ? rch[0] : 0}{rch ? <span>{rch[0] && rch[0] >= rch[1] ? ' · y sigue' : ' · máx ' + rch[1]}</span> : null}</b>
          <em>eventos seguidos en semifinal o más{rch && rch[0] && rch[0] >= rch[1] ? ': es su mejor racha' : ''}</em></div>
        <div><small>MISIONES</small><b>+{num(f.mis || 0)}</b><em>lo que le sumaron sus misiones esta temporada</em></div>
      </div>
    </section>
  );
}

// ⚡ LO ÚLTIMO (Dlx, a la v1: «algo negro entre De un vistazo y Publicaciones… las 2 o 3 cosas recientes que hizo»):
// sus tres eventos más nuevos, dichos como lo que hizo —campeón de, llegó a la final de, le ganó a—, con lo que sumó y su
// llave. ⚠️ Dlx, a la v10, «sí cuenta» lo que hace en la página (felicitar, seguir, votar): eso entra cuando viaje
function cuandoFue(iso) {
  const d = haceDias(iso);
  return d === 'hoy' ? 'HOY' : d === 'ayer' ? 'ANOCHE' : fecha(iso);
}
function LoUltimo({ liga, p, e }) {
  const ev = ((p && p.ev) || []).slice(0, 3);
  const du = (p && p.du) || [];
  if (!ev.length) return null;
  return (
    <section className="sec pf-sec negra pf8-ult">
      <div className="sec-t"><h2>Lo último</h2><span className="tj-n">lo que hizo</span></div>
      <ol className="pf8-ult-l">
        {ev.map(([n, puesto, pts]) => {
          const x = (e || {})[n] || (e || {})[String(n)] || [];
          const nom = limpio(x[0] || 'Evento ' + n);
          const ds = du.filter((d) => d[0] === n);
          const gano = ds.filter((d) => d[2]).map((d) => limpio(d[1]));
          const perdio = ds.find((d) => !d[2]);
          const lista = (xs) => (xs.length > 1 ? xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1] : xs[0]);
          const que = puesto === 'Campeón' ? <>Campeón de <b>{nom}</b></>
            : puesto === 'Subcampeón' && perdio ? <>Llegó a la final de <b>{nom}</b> y la perdió con {limpio(perdio[1])}</>
              : gano.length ? <>En <b>{nom}</b> le ganó a {lista(gano.slice(0, 3))}{perdio ? ' y lo sacó ' + limpio(perdio[1]) : ''}</>
                : <>{puesto} en <b>{nom}</b></>;
          return (
            <li key={n}>
              <time>{x[2] ? cuandoFue(x[2]) : x[4] || ''}</time>
              <span className="pf8-ult-ic" aria-hidden="true">{MEDALLA[puesto] ? <Medalla p={MEDALLA[puesto]} /> : <Ico n="cruce" t={20} />}</span>
              <span className="pf8-ult-tx"><span>{que}</span>
                <small>{x[1] ? siglaDe(x[1]) : ''}{x[3] ? ' · ' + x[3] + ' raperos' : ''}{puesto !== 'Campeón' && puesto !== 'Subcampeón' && (gano.length || perdio) ? ' · ' + puesto : ''}</small></span>
              <strong>+{num(pts)}</strong>
              <button type="button" className="pf8-ult-ll" onClick={() => accion.llave(String(n))}>Ver la llave</button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// 🔎 SUS DATOS (Dlx, 07/10/2026: *«qué días usualmente participa, su win rate en réplicas… HACE MEJOR EQUIPO con X
// persona… su verdugo es… y su hijo es…»*, y después: *«en sus datos, sé más detallista»*). Todo sale de lo que el perfil
// ya trae —sus eventos (`ev`, con `e`: nombre, servidor, instante), sus duelos (`du`), el compañero y las réplicas que
// arma el ciclo (`eq`, `rp`)—, y las horas en la zona de quien mira. Sin dato no hay renglón; sin ninguno, no hay sección
const PUESTOS = ['Campeón', 'Subcampeón', 'Tercero', 'Cuarto', 'Semifinal', 'Cuartos', 'Octavos', 'R32', 'Dieciseisavos'];
const FRANJA = [[6, 'de madrugada'], [12, 'a la mañana'], [19, 'a la tarde'], [24, 'a la noche']];
const DIA_MS = 864e5;
function franjaDe(iso) {
  const h = minutosDelDia(iso) / 60;
  return (FRANJA.find(([hasta]) => h < hasta) || FRANJA[3])[1];
}
function haceDias(iso) {
  const n = Math.round((new Date(diaISO(new Date()) + 'T12:00:00Z') - new Date(diaISO(new Date(iso)) + 'T12:00:00Z')) / DIA_MS);
  return n <= 0 ? 'hoy' : n === 1 ? 'ayer' : 'hace ' + n + ' días';
}
function Datos({ liga, p, e, f }) {
  const filas = [];
  const ev = (p && p.ev) || [];
  const de = (n) => (e || {})[n] || [];
  const conFecha = ev.filter(([n]) => de(n)[2] && !isNaN(new Date(de(n)[2])));
  // 📅 los días, y a qué hora (la franja que junta más de la mitad)
  if (ev.length >= 3) {
    const c = [0, 0, 0, 0, 0, 0, 0];
    conFecha.forEach(([n]) => { c[new Date(diaISO(new Date(de(n)[2])) + 'T12:00:00Z').getUTCDay()] += 1; });
    const tope = Math.max(2, Math.ceil(ev.length * 0.25));
    const dias = c.map((v, i) => [v, i]).filter(([v]) => v >= tope).sort((a, b) => b[0] - a[0]).slice(0, 2);
    const fr = {};
    conFecha.forEach(([n]) => { const f = franjaDe(de(n)[2]); fr[f] = (fr[f] || 0) + 1; });
    const [franja, nf] = Object.entries(fr).sort((a, b) => b[1] - a[1])[0] || [];
    const aHora = franja && nf * 2 > conFecha.length ? franja : '';
    if (dias.length) {
      filas.push(['eventos', 'Suele jugar', 'los ' + dias.map(([, i]) => DIAS[i]).join(' y los ') + (aHora ? ', ' + aHora : ''),
        dias.map(([v, i]) => v + ' ' + (v === 1 ? 'evento' : 'eventos') + ' un ' + DIA1[i]).join(' · ')
        + (aHora ? ' · ' + nf + ' de ' + conFecha.length + ' ' + aHora + ' (tu hora)' : '')]);
    } else if (aHora && conFecha.length >= 3) {
      filas.push(['reloj', 'Suele jugar', aHora, nf + ' de ' + conFecha.length + ' eventos, en tu hora']);
    }
  }
  // 🏟️ dónde juega más
  if (ev.length >= 2) {
    const sv = {};
    ev.forEach(([n]) => { const s = de(n)[1]; if (s) sv[s] = (sv[s] || 0) + 1; });
    const [s, k] = Object.entries(sv).sort((a, b) => b[1] - a[1])[0] || [];
    const otros = Object.keys(sv).length - 1;
    if (s) {
      filas.push(['socios', 'Juega más en', liga.svs[s] ? (liga.svs[s].nombre || siglaDe(s)) : siglaDe(s),
        k + ' de ' + ev.length + ' eventos' + (otros > 0 ? ' · también en ' + otros + (otros === 1 ? ' servidor más' : ' servidores más') : '')]);
    }
  }
  // 🏆 su mejor resultado, con el evento y la fecha (y cuántas veces más)
  const conPuesto = ev.filter(([, pu]) => PUESTOS.indexOf(pu) >= 0);
  if (conPuesto.length) {
    const mejor = Math.min(...conPuesto.map(([, pu]) => PUESTOS.indexOf(pu)));
    const esos = conPuesto.filter(([, pu]) => PUESTOS.indexOf(pu) === mejor);
    const [n] = esos[0];
    const x = de(n);
    filas.push([MEDALLA[PUESTOS[mejor]] || 'premio', 'Su mejor resultado', PUESTOS[mejor],
      limpio(x[0] || 'Evento ' + n) + (x[2] ? ' · ' + fecha(x[2]).toLowerCase() : '')
      + (esos.length > 1 ? ' · y ' + (esos.length - 1) + (esos.length === 2 ? ' vez más' : ' veces más') : '')]);
  }
  // 🏁 sus finales, 🏟️ su evento más grande y 🔥 su mejor racha (Dlx, a la v1: «ser más específicos con los datos»)
  const fin = ev.filter(([, pu]) => pu === 'Campeón' || pu === 'Subcampeón');
  if (fin.length) {
    const gan = fin.filter(([, pu]) => pu === 'Campeón').length;
    filas.push(['copa', 'Finales', gan + ' de ' + fin.length + (fin.length === 1 ? ' ganada' : ' ganadas'),
      'llegó a la final en ' + fin.length + ' de sus ' + ev.length + ' eventos']);
  }
  const grande = ev.filter(([n]) => de(n)[3]).sort((a, b) => de(b[0])[3] - de(a[0])[3])[0];
  if (grande && ev.length >= 2) {
    filas.push(['mundo', 'Su evento más grande', limpio(de(grande[0])[0] || 'Evento ' + grande[0]),
      de(grande[0])[3] + ' raperos · ' + (grande[1] === 'Campeón' ? 'lo ganó' : String(grande[1]).toLowerCase())]);
  }
  if (f && Array.isArray(f.rch) && f.rch[1] >= 2) filas.push(['fuego', 'Su mejor racha', f.rch[1] + ' seguidos', 'en semifinal o más']);
  // 📈 cuánto hace por evento
  if (ev.length >= 2) {
    const tot = ev.reduce((s, x) => s + (Number(x[2]) || 0), 0);
    const top = Math.max(...ev.map((x) => Number(x[2]) || 0));
    filas.push(['ranking', 'Por evento', num(Math.round(tot / ev.length)) + ' puntos', 'el que más le dio: ' + num(top)]);
  }
  const du = (p && p.du) || [];
  if (du.length) {
    const por = new Map();
    du.forEach((d) => {
      const r = liga.fila(d[1]);
      const id = r ? r.k : 'n:' + limpio(d[1]).toLowerCase();
      if (!por.has(id)) por.set(id, { k: r ? r.k : '', n: r ? r.n : d[1], g: 0, p: 0, evs: new Set() });
      const x = por.get(id);
      x[d[2] ? 'g' : 'p'] += 1;
      x.evs.add(d[0]);
    });
    const rs = [...por.values()];
    // 🔥 SU CLÁSICO, con la regla de la Liga (la Guía: «cuando dos se cruzan en su tercer evento o más, es un
    // Clásico»): tres eventos distintos, no tres batallas. Dlx, 07/10/2026: «y su clásico de cada uno, añadir eso»
    const clasicos = rs.filter((r) => r.evs.size >= 3).sort((a, b) => b.evs.size - a.evs.size || (b.g + b.p) - (a.g + a.p));
    if (clasicos.length) {
      const c = clasicos[0];
      filas.push(['cruce', 'Su clásico', c, c.evs.size + ' eventos cruzados · ' + c.g + '–' + c.p + ' en duelos'
        + (clasicos.length > 1 ? ' · y ' + (clasicos.length - 1) + (clasicos.length === 2 ? ' clásico más' : ' clásicos más') : '')]);
    }
    // 🔑 MÁS FORMAL (Dlx, 07/10/2026: «¿puedes hacer que sea más formal lo de verdugo e hijo?»): decía «su verdugo» y
    // «su hijo»; la cuenta es la misma —desde dos, y más ganadas que perdidas (o al revés)—
    const dificil = rs.filter((r) => r.p >= 2 && r.p > r.g).sort((a, b) => b.p - a.p || a.g - b.g)[0];
    const vencio = rs.filter((r) => r.g >= 2 && r.g > r.p).sort((a, b) => b.g - a.g || a.p - b.p)[0];
    if (dificil) filas.push(['escudo', 'Su rival más difícil', dificil, 'le ganó ' + dificil.p + ' de ' + (dificil.g + dificil.p) + ' duelos']);
    if (vencio) filas.push(['mira', 'El rival que más venció', vencio, 'le ganó ' + vencio.g + ' de ' + (vencio.g + vencio.p) + ' duelos']);
  }
  if (p && p.eq) {
    const r = liga.T[p.eq[0]];
    filas.push(['seguir', 'Hace mejor equipo con', { k: r ? r.k : '', n: r ? r.n : p.eq[1] }, 'ganaron ' + p.eq[2] + ' de ' + p.eq[3] + ' juntos']);
  }
  if (p && p.rp && p.rp[1]) filas.push(['replica', 'En réplicas', 'ganó ' + p.rp[0] + ' de ' + p.rp[1], 'las votadas en un canal que lee el bot']);
  // 🌱 cuándo debutó, y 🕒 su último evento
  if (conFecha.length) {
    const orden = conFecha.slice().sort((a, b) => new Date(de(a[0])[2]) - new Date(de(b[0])[2]));
    const [n0] = orden[0];
    const [n1] = orden[orden.length - 1];
    filas.push(['brote', 'Debutó', fecha(de(n0)[2]).toLowerCase(), limpio(de(n0)[0] || 'Evento ' + n0)]);
    if (orden.length > 1) filas.push(['reloj', 'Su último evento', haceDias(de(n1)[2]), limpio(de(n1)[0] || 'Evento ' + n1)]);
  }
  if (p && textoVerificado(p.vd)) filas.push(['ok', 'Verificado', p.vd === 'pre' ? 'antes de la T1' : textoVerificado(p.vd).replace(/^Verificado /, ''), 'es Miembro de Discord Rap Español']);
  if (!filas.length) return null;
  return (
    <>
      <ul className="pf-datos pf8-datos">
        {filas.map(([ic, et, v, sub]) => (
          <li key={et}>
            {/* el ícono: el nombre de uno de `Ico`, o el puesto (1 a 3) para la medalla */}
            <span className="pf-dt-ic" aria-hidden="true">{typeof ic === 'number' ? <Medalla p={ic} /> : <Ico n={ic} t={24} />}</span>
            <small>{et}</small>
            {typeof v === 'object' ? (
              v.k ? <a className="pf-dt-q" href={'#/r/' + encodeURIComponent(v.k)}><Cara liga={liga} k={v.k} nombre={v.n} cls="cara pf-dt-cara" lazy />{limpio(v.n)}</a>
                : <b className="pf-dt-q">{limpio(v.n)}</b>
            ) : <b>{v}</b>}
            <em>{sub}</em>
          </li>
        ))}
      </ul>
    </>
  );
}

// 🗂️ SUS DATOS, TODO JUNTO (Dlx, a la v1: «poner ligas en la sección de datos… y ser más específicos»): sus ligas, sus
// datos, en cada ranking y lo que le falta, en una sola sección blanca. Cada parte se apaga sola si no tiene con qué
function SusDatos({ liga, f, k, p, e, esYo }) {
  return (
    <section className="sec pf-sec pf8-sd">
      <div className="sec-t"><h2>{esYo ? 'Tus datos' : 'Sus datos'}</h2></div>
      <SusLigas liga={liga} k={k} esYo={esYo} p={p} dentro />
      <Datos liga={liga} p={p} e={e} f={f} />
      <EnCadaRanking liga={liga} f={f} p={p} dentro />
      <LoQueFalta f={f} p={p} esYo={esYo} dentro />
    </section>
  );
}

// el radar de las cinco dimensiones del Score, contra el promedio de la Liga (Dlx, 27/09/2026: «en mi perfil de la hoja
// había un gráfico donde comparaba las estadísticas del competitivo y te mostraba cuál era más fuerte y menos»)
// `oculto`: la vista previa de la bloqueada — la forma es de ejemplo y en vez de los números va «?»
function Radar({ dims, val, prom, oculto }) {
  const cx = 150;
  const cy = 132;
  const R = 96;
  const ang = (i) => -Math.PI / 2 + (2 * Math.PI * i) / dims.length;
  const pt = (i, v) => [cx + Math.cos(ang(i)) * R * v / 100, cy + Math.sin(ang(i)) * R * v / 100];
  const poly = (vs) => vs.map((v, i) => pt(i, Math.max(3, Math.min(100, v || 0))).map((x) => x.toFixed(1)).join(',')).join(' ');
  return (
    <svg className="pf-radar" viewBox="0 0 300 270" role="img"
      aria-label={oculto ? 'Vista previa de sus fortalezas: se desbloquean con la tarjeta Competitiva'
        : 'Sus fortalezas: ' + dims.map((d, i) => d[1] + ' ' + (val[i] || 0)).join(', ')}>
      {[25, 50, 75, 100].map((r) => <polygon key={r} className="pf-r-red" points={poly(dims.map(() => r))} />)}
      {dims.map((d, i) => { const [x, y] = pt(i, 100); return <line key={d[1]} className="pf-r-eje" x1={cx} y1={cy} x2={x} y2={y} />; })}
      {prom ? <polygon className="pf-r-liga" points={poly(prom)} /> : null}
      <polygon className={'pf-r-yo' + (oculto ? ' fantasma' : '')} points={poly(val)} />
      {dims.map((d, i) => {
        const [x, y] = pt(i, 122);
        return <text key={d[1]} className="pf-r-et" x={x} y={y + 5} textAnchor={Math.abs(x - cx) < 8 ? 'middle' : x > cx ? 'start' : 'end'}>{d[0]} {oculto ? '?' : val[i] || 0}</text>;
      })}
    </svg>
  );
}

// 🔒 LA VISTA PREVIA DE LA BLOQUEADA. Dlx, 07/10/2026: *«muéstrales una preview de lo que sería, desbloqueás esto al
// tener 10 eventos»*. El radar va con una forma de EJEMPLO —sus números no se muestran hasta que tenga la carta—, con
// qué mide cada una y cuánto le falta, dicho como `requisitos.js`. Quien ya tiene los eventos y no la carta es porque no
// está verificado (`nv`)
const EJEMPLO = [72, 48, 34, 62, 55];
function FortalezasBloq({ dims, f, pide, esYo }) {
  const ev = f.ev || 0;
  const pct = Math.max(0, Math.min(100, Math.round((100 * ev) / pide)));
  const llego = ev >= pide;
  return (
    <section className="sec pf-sec pf8-fz">
      <div className="sec-t"><h2>Sus fortalezas</h2><span className="pf-bloq"><Ico n="candado" t={14} />Bloqueada</span></div>
      <div className="pf-fz">
        <div className="pf-fz-prev">
          <Radar dims={dims} val={EJEMPLO} oculto />
          <span className="pf-fz-cand" aria-hidden="true"><Ico n="candado" t={24} /></span>
        </div>
        <div className="pf-fz-tx">
          <p className="pf-fz-q"><b>Se desbloquea con la tarjeta Competitiva</b>
            {esYo ? 'En qué eres más fuerte y qué te toca trabajar' : 'En qué es más fuerte y qué le toca trabajar'}: las cinco
            cosas que mide el Score, contra el promedio de la Liga.</p>
          <ul className="tj-falta pf-fz-meta">
            <li className={llego ? 'ok' : ''}><span>{Math.min(ev, pide)}/{pide} eventos</span><i><u style={{ width: pct + '%' }} /></i></li>
          </ul>
          <p className="pf-bajada pf-fz-falta">{llego
            ? (esYo ? 'Ya tienes los ' : 'Ya tiene los ') + pide + ' eventos. ' + (f.nv ? (esYo ? 'Sólo te falta verificarte (arriba dice cómo).' : 'Sólo le falta verificarse.') : 'La tarjeta sale en la próxima vuelta del bot.')
            : RQ.falta('EVENTOS', ev, pide, esYo)}</p>
          <ul className="pf-dims pf-dims-bloq">
            {dims.map((d) => (
              <li key={d[1]}><span><b>{d[0]} {d[1]}</b><small>{d[2]} · {d[3]} %</small></span><i /><em>?</em></li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Fortalezas({ liga, f, p, dmp, esYo }) {
  const dims = ((liga.d.guia || {}).score || []);
  const val = (p && p.dm) || null;
  if (!dims.length || !f.ev) return null;
  const q = (liga.d.requisitos || []).find((r) => r.id === 'competitivo') || {};
  const pide = parseInt(((q.pide || [])[0] || '10'), 10) || 10;
  // 🔑 SÓLO CON LA COMPETITIVA DESBLOQUEADA. Dlx, 07/10/2026: *«para q te muestre sus fortalezas necesita tener
  // desbloqueada la tarjeta competitiva»*. Las cinco son las del Score, que es lo que esa carta mide; antes, alguien
  // con 1 evento ya tenía radar. Sin la carta, la vista previa. La misma regla en `pintaJuego()` de app.js
  if (!(f.c || []).includes('competitivo')) return <FortalezasBloq dims={dims} f={f} pide={pide} esYo={esYo} />;
  if (!val) return null;
  const mx = val.indexOf(Math.max(...val));
  const mn = val.indexOf(Math.min(...val));
  return (
    <section className="sec pf-sec pf8-fz">
      <div className="sec-t"><h2>Sus fortalezas</h2></div>
      <div className="pf-fz">
        <Radar dims={dims} val={val} prom={dmp} />
        <div className="pf-fz-tx">
          <div className="pf-fz-dos">
            <p><small>SU FUERTE</small><b>{dims[mx][0]} {dims[mx][1]}</b></p>
            {mn !== mx ? <p><small>A TRABAJAR</small><b>{dims[mn][0]} {dims[mn][1]}</b></p> : null}
          </div>
          <ul className="pf-dims">
            {dims.map((d, i) => (
              <li key={d[1]}>
                <span><b>{d[0]} {d[1]}</b><small>{d[2]} · {d[3]} %</small></span>
                <i><u style={{ width: Math.max(2, Math.min(100, val[i] || 0)) + '%' }} />{dmp ? <s style={{ left: Math.min(100, dmp[i] || 0) + '%' }} title={'La Liga: ' + dmp[i]} /> : null}</i>
                <em>{val[i] || 0}</em>
              </li>
            ))}
          </ul>
          {dmp ? <p className="pf-ley"><i className="yo" /> {limpio(f.n)} <i className="liga" /> el promedio de la Liga</p> : null}
          {(f.ev || 0) < pide ? <p className="pf-bajada">Provisorio: con pocos eventos cambia mucho. Cuenta para el rango desde los {pide} eventos (lleva {f.ev || 0}).</p> : null}
        </div>
      </div>
    </section>
  );
}

// ── 🎯 SU PRÓXIMA META (Dlx, 13/10/2026, «dale haz todo», del research de los lobbies: «la próxima meta tiene que verse
// y estar cerca»). A quién pasa y cuánto le falta en la Temporada, y el torneo de cierre (los 16 primeros con número).
// En el perfil no estaba: «En cada ranking» dice el puesto, no la distancia. Con la misma medida que el Ranking (OVR;
// `Cerca` de ranking.jsx). Fuera de concurso no tiene puesto, así que no hay meta
const D_OVR = (d) => (d === 1 ? '1 de OVR' : num(Math.round(d * 10) / 10) + ' de OVR');
function ProximaMeta({ liga, f, esYo }) {
  if (f.fc || !f.pos) return null;
  const of = liga.oficiales();
  const i = of.findIndex((x) => x.k === f.k);
  if (i < 0) return null;
  const ovr = (x) => Number(x && x.ovr) || 0;
  const arriba = i > 0 ? of[i - 1] : null;
  const abajo = of[i + 1] || null;
  const corte = f.pos > 16 && of.length >= 16 ? of[15] : null;
  const n = (x) => limpio(x.n);
  let t;
  if (!arriba) t = (esYo ? 'Eres el #1 de la Temporada' : 'Es el #1 de la Temporada')
    + (abajo && ovr(f) > ovr(abajo) ? ' · ' + (esYo ? 'le sacas ' : 'le saca ') + D_OVR(ovr(f) - ovr(abajo)) + ' a ' + n(abajo) : '');
  else if (ovr(arriba) > ovr(f)) t = (esYo ? 'Te faltan ' : 'Le faltan ') + D_OVR(ovr(arriba) - ovr(f)) + ' para pasar a ' + n(arriba)
    + ' y subir al #' + arriba.pos;
  else t = (esYo ? 'Estás pegado a ' : 'Está pegado a ') + n(arriba) + ', el #' + arriba.pos + ': el próximo evento los separa';
  const sub = corte ? (ovr(corte) > ovr(f) ? 'Y ' + D_OVR(ovr(corte) - ovr(f)) + ' para entrar a los 16 de la Clausura' : '')
    : (esYo ? 'Si la temporada terminara hoy, juegas la Clausura' : 'Si la temporada terminara hoy, juega la Clausura');
  // la barra: de quien tiene abajo a quien tiene arriba, dónde está él (la v2 de la maqueta)
  const base = abajo ? ovr(abajo) : 0;
  const pct = arriba && ovr(arriba) > base ? Math.max(4, Math.min(100, Math.round((100 * (ovr(f) - base)) / (ovr(arriba) - base)))) : 100;
  return (
    <section className="sec pf-sec negra pf-meta-sec pf8-meta">
      <a className="pf-meta" href="#/ranking/temporada">
        <span className="pf-meta-et">{esYo ? 'TU PRÓXIMA META' : 'SU PRÓXIMA META'} · #{f.pos} DE LA TEMPORADA</span>
        <b>{t}</b>
        {arriba ? <span className="pf8-meta-bar"><u style={{ width: pct + '%' }} /><i>#{f.pos}</i><i>#{arriba.pos}</i></span> : null}
        {sub ? <small>{sub}</small> : null}
      </a>
    </section>
  );
}

function EnCadaRanking({ liga, f, p, dentro }) {
  const rk = (p && p.rk) || {};
  const filas = [];
  const total = liga.oficiales().length;
  filas.push(['Temporada', f.pos ? '#' + f.pos + ' de ' + total : 'Fuera de concurso', '#/ranking/temporada']);
  if (rk.du) filas.push(['Duelos', '#' + rk.du[0] + ' de ' + rk.du[1], '#/ranking/duelos']);
  if (rk.pod) filas.push(['Podios', '#' + rk.pod[0] + ' de ' + rk.pod[1], '#/ranking/podios']);
  if (rk.pa && f.cc) filas.push([<><Bandera cc={f.cc} cls="pf-flag" />{nombrePais(f.cc)}</>, '#' + rk.pa[0] + ' de ' + rk.pa[1], '#/pais/' + f.cc]);
  const crew = liga.crewDe(f);
  if (rk.cr && rk.cr[0] && rk.cr[1]) filas.push([limpio(rk.cr[0]), '#' + rk.cr[1] + ' de ' + rk.cr[2], crew ? '#/crew/' + encodeURIComponent(crew.clave || crew.crew) : '#/ranking/crews']);
  const lista = <ul className="pf-rk">{filas.map((x, i) => <li key={i}><a href={x[2]}><span>{x[0]}</span><b>{x[1]}</b></a></li>)}</ul>;
  if (dentro) return <><h3 className="pf8-h3">En cada ranking</h3>{lista}</>;
  return (
    <section className="sec pf-sec">
      <div className="sec-t"><h2>En cada ranking</h2></div>
      {lista}
    </section>
  );
}

function LoQueFalta({ f, p, esYo, dentro }) {
  const pa = usePaseDe(f.k);
  const nivel = (pa && pa.nivel) || 0;
  const req = (p && p.req) || {};
  // 🔑 LO DESBLOQUEADO SE VA (Dlx, 07/10/2026: *«que cuando una tarjeta sea desbloqueada eso desaparezca del perfil»*):
  // quedan sólo las que le faltan; sin ninguna, no hay sección
  const listaDe = (c) => {
    const q = req[c] || [];
    const cumple = c === 'temporada' ? nivel >= 1 : q.every((x) => x[0] >= x[1]);
    return (f.c || []).includes(c) || (cumple && !f.nv);
  };
  const cs = ['temporada', 'competitivo', 'pais'].filter((c) => (req[c] || (f.c || []).includes(c)) && !listaDe(c));
  if (!cs.length) return null;
  const cont = (
    <>
      {dentro ? <h3 className="pf8-h3">{esYo ? 'Lo que te falta' : 'Lo que le falta'}</h3> : <div className="sec-t"><h2>{esYo ? 'Lo que te falta' : 'Lo que le falta'}</h2></div>}
      <ul className="pf-falta">
        {cs.map((c) => {
          const q = req[c] || [];
          // 🔑 LAS REGLAS DEL 05/10/2026 (2.41): la Temporada sale con el nivel 1 del Pase, no con su requisito de antes,
          // y sin verificarse no hay ninguna (lo de `Tuya` en tarjetas.jsx). Decía «salvo la de Temporada, que no lo pide»
          const cumple = c === 'temporada' ? nivel >= 1 : q.every((x) => x[0] >= x[1]);
          const listo = false;
          const espera = cumple;
          return (
            <li key={c}>
              <h3>{NOMBRE[c]}<span>{espera ? 'Falta verificarse' : 'Bloqueada'}</span></h3>
              {/* el porqué entero va una sola vez, arriba (`pf-nv`): acá repetirlo en cada tarjeta era la misma frase tres veces */}
              {espera ? <p>{esYo ? 'Ya cumples lo que pide: sólo te falta verificarte (arriba dice cómo).' : 'Ya cumple lo que pide: sólo le falta verificarse.'}</p> : null}
              {!listo && !espera && c === 'temporada' ? <p>{RQ.pase(esYo)}</p> : null}
              {!listo && !espera && c !== 'temporada' ? <FaltaLista q={q} tu={esYo} /> : null}
            </li>
          );
        })}
      </ul>
    </>
  );
  return dentro ? cont : <section className="sec pf-sec">{cont}</section>;
}

// ── Eventos: todos los que jugó en la temporada, con su puesto, sus puntos y la llave ──
// 📈 LAS DOS JUNTAS (Dlx, a la v10: «E1 y E2 me gustan ambas… me gusta la gráfica del E1»): arriba la temporada en una
// tira —cada palito es un evento en su fecha, el color dice cómo le fue y la altura cuánto sumó— y debajo los filtros y la
// lista por mes, cada uno con su medalla y sus puntos. Reemplaza al mapa de días (Dlx: «lo de eventos participados de
// abajo a la izquierda puede ser mejor»). El buscador se queda (Dlx, 07/10/2026: «con la opción de buscar evento»)
const PUESTO_ORDEN = ['Campeón', 'Subcampeón', 'Tercero', 'Cuarto', 'Semifinal', 'Cuartos', 'Octavos', 'R32', 'Dieciseisavos'];
const ordenPuesto = (x) => (PUESTO_ORDEN.indexOf(x) < 0 ? 99 : PUESTO_ORDEN.indexOf(x));
const COLOR_PUESTO = { Campeón: '#E7B622', Subcampeón: '#A9AEB6', Tercero: '#D9782F', Cuarto: '#D9782F', Semifinal: '#D9782F', Cuartos: '#4FA89A', Octavos: '#9DD3C9' };
const colorPuesto = (x) => COLOR_PUESTO[x] || '#C9C9C4';
const MEDALLA_TX = { Campeón: '1º', Subcampeón: '2º', Tercero: '3º', Cuarto: '4º', Semifinal: 'SEMI', Cuartos: 'CUAR', Octavos: 'OCT' };
const PODIO = ['Campeón', 'Subcampeón', 'Tercero'];
const MES_LARGO = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
const MES_CORTO = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const diaN = (iso) => Date.parse(iso + 'T12:00:00Z');

function TiraTemporada({ liga, ev, e }) {
  const fase = liga.d.fase || {};
  const hoy = diaET();
  const ini = fase.arranca || hoy;
  // lo jugado y diez días más: el resto de la temporada sería un hueco (la v10)
  const fin = new Date(Math.min(diaN(fase.termina || hoy), diaN(hoy) + 10 * DIA_MS)).toISOString().slice(0, 10);
  const W = 860, base = 118, x0 = 10, x1 = W - 10;
  const x = (d) => x0 + ((diaN(d) - diaN(ini)) / Math.max(DIA_MS, diaN(fin) - diaN(ini))) * (x1 - x0);
  const pts = ev.map((r) => Number(r[2]) || 0);
  const mx = Math.max(1, ...pts);
  const pila = {};
  const palos = ev.slice().reverse().map(([n, puesto, p]) => {
    const it = (e || {})[n] || (e || {})[String(n)] || [];
    if (!it[2]) return null;
    const d = diaET(Date.parse(it[2]));
    const i = pila[d] || 0;
    pila[d] = i + 1;
    const h = 14 + ((Number(p) || 0) / mx) * 84;
    return <rect key={n} x={x(d) - 3 + i * 7} y={base - h} width="6" height={h} rx="1.5" fill={colorPuesto(puesto)}><title>{limpio(it[0] || '') + ' · ' + puesto + ' · +' + num(p)}</title></rect>;
  });
  const marcas = [];
  for (let t = diaN(ini); t <= diaN(fin); t += DIA_MS) {
    const d = new Date(t).toISOString().slice(0, 10);
    if (d === ini || d.endsWith('-01') || d.endsWith('-15')) marcas.push(d);
  }
  const quedan = fase.termina ? Math.max(0, Math.round((diaN(fase.termina) - diaN(hoy)) / DIA_MS)) : 0;
  return (
    <svg className="pf8-tira" viewBox={`0 -8 ${W} 152`} role="img" aria-label={'Sus ' + ev.length + ' eventos de la ' + liga.temp + ', por fecha'}>
      <rect x={x(hoy)} y="10" width={Math.max(0, x1 - x(hoy))} height={base - 10} className="pf8-tira-fut" />
      {marcas.map((d, i) => (
        <g key={d}><line x1={x(d)} x2={x(d)} y1="10" y2={base} className="pf8-tira-l" />
          {i === 0 || x(d) - x(marcas[i - 1]) > 70
            ? <text x={x(d) + 4} y={base + 18}>{d === ini ? Number(d.slice(8)) + ' ' + MES_CORTO[Number(d.slice(5, 7)) - 1] + ' · ARRANCA LA ' + liga.temp : d.endsWith('-01') ? MES_CORTO[Number(d.slice(5, 7)) - 1] : '15 ' + MES_CORTO[Number(d.slice(5, 7)) - 1]}</text> : null}
        </g>
      ))}
      {quedan ? <text x={x1} y={base + 18} textAnchor="end">QUEDAN {quedan} DÍAS DE LA {liga.temp} →</text> : null}
      {palos}
      <line x1={x0} x2={x1} y1={base} y2={base} className="pf8-tira-base" />
      <line x1={x(hoy)} x2={x(hoy)} y1="6" y2={base} className="pf8-tira-hoy" />
      <text x={x(hoy)} y="2" textAnchor="middle" className="pf8-tira-hoyt">HOY</text>
    </svg>
  );
}

function Eventos({ liga, p, e, n = 5 }) {
  const ev = (p && p.ev) || [];
  const [q, setQ] = useState('');
  const [fil, setFil] = useState('');
  const [todos, setTodos] = useState(false);
  if (!ev.length) return <section className="sec pf-sec"><p className="rk-vacio">Todavía no jugó ningún evento en la {liga.temp}.</p></section>;
  const de = (x) => (e || {})[x] || (e || {})[String(x)] || [];
  const tot = ev.reduce((s, r) => s + (Number(r[2]) || 0), 0);
  const mx = Math.max(1, ...ev.map((r) => Number(r[2]) || 0));
  const cuenta = (f) => ev.filter(f).length;
  const svs = {};
  ev.forEach(([x]) => { const s = de(x)[1]; if (s) svs[s] = (svs[s] || 0) + 1; });
  const pasa = ([x, pu]) => !fil || (fil === 'Campeón' ? pu === 'Campeón' : fil === 'podio' ? PODIO.includes(pu) : de(x)[1] === fil);
  const nq = norm(q);
  const vis0 = ev.filter((r) => pasa(r) && (!nq || norm(de(r[0])[0] || '').includes(nq)));
  // los primeros y el resto a un toque; con un filtro o una búsqueda, todos los que cumplen
  const corta = !todos && !q && !fil && vis0.length > n;
  const vis = corta ? vis0.slice(0, n) : vis0;
  let mes = '';
  const chip = (id, txt, c, img) => (
    <button type="button" key={id || 'todos'} className={fil === id ? 'on' : ''} aria-pressed={fil === id} onClick={() => setFil(fil === id ? '' : id)}>
      {img ? <img alt="" src={img} /> : null}{txt} <small>{c}</small></button>
  );
  return (
    <section className="sec pf-sec pf8-ev">
      <div className="sec-t"><h2>Sus eventos</h2><span className="tj-n">{vis0.length === ev.length ? ev.length + ' en la ' + liga.temp + ' · +' + num(tot) + ' pts' : vis0.length + ' de ' + ev.length}</span></div>
      <TiraTemporada liga={liga} ev={ev} e={e} />
      <div className="pf8-ley">
        {PUESTO_ORDEN.slice(0, 7).filter((x) => x !== 'Tercero' && x !== 'Cuarto').map((x) => <span key={x}><i style={{ background: colorPuesto(x) }} />{x}</span>)}
        <span>la altura = los puntos que sumó</span>
      </div>
      <div className="pf8-ev-fil">
        <div className="pf8-chips" role="group" aria-label="Filtrar sus eventos">
          {chip('', 'Todos', ev.length)}
          {cuenta((r) => r[1] === 'Campeón') ? chip('Campeón', 'Campeón', cuenta((r) => r[1] === 'Campeón')) : null}
          {cuenta((r) => PODIO.includes(r[1])) ? chip('podio', 'Podio', cuenta((r) => PODIO.includes(r[1]))) : null}
          {Object.keys(svs).length > 1 ? Object.entries(svs).sort((a, b) => b[1] - a[1]).map(([s, c]) => chip(s, siglaDe(s), c, liga.logo(s))) : null}
        </div>
        {ev.length > 5 ? (
          <label className="rk-buscar"><Ico n="buscar" t={18} />
            <input type="search" value={q} onChange={(x) => setQ(x.target.value)} placeholder="Buscar evento" aria-label="Buscar evento" enterKeyHint="search" />
          </label>
        ) : null}
      </div>
      {!vis.length ? <p className="rk-vacio">Ningún evento con ese filtro.</p> : null}
      <ol className="pf8-evl">
        {vis.map(([x, puesto, pts]) => {
          const it = de(x);
          const m = it[2] ? MES_LARGO[Number(diaET(Date.parse(it[2])).slice(5, 7)) - 1] : '';
          const titulo = m && m !== mes ? (mes = m) : '';
          return (
            <li key={x}>
              {titulo ? <span className="pf8-mes">{titulo}</span> : null}
              <button type="button" className="pf8-evb" onClick={() => accion.llave(String(x))} aria-label={'Ver la llave de ' + limpio(it[0] || 'Evento ' + x)}>
                <span className={'pf8-med' + (ordenPuesto(puesto) <= 4 ? '' : ' gris')} style={{ '--c': colorPuesto(puesto) }}>{MEDALLA_TX[puesto] || String(puesto).slice(0, 4).toUpperCase()}</span>
                <span className="pf8-evt"><b>{limpio(it[0] || 'Evento ' + x)}</b>
                  <small>{it[2] ? fecha(it[2]) : it[4] || ''}{it[1] ? <> · <img alt="" src={liga.logo(it[1])} />{siglaDe(it[1])}</> : null}{it[3] ? ' · ' + it[3] + ' raperos' : ''}</small></span>
                <span className="pf8-evp"><u><i style={{ width: Math.max(3, (100 * (Number(pts) || 0)) / mx) + '%' }} /></u><small>{puesto}</small></span>
                <strong>+{num(pts)}</strong>
              </button>
            </li>
          );
        })}
      </ol>
      {corta || (todos && !q && !fil && vis0.length > n) ? (
        <button type="button" className="btn borde chico pf-ver-mas" aria-expanded={todos} onClick={() => setTodos(!todos)}>
          {todos ? 'Ver menos' : 'Ver los ' + vis0.length}</button>
      ) : null}
    </section>
  );
}

// ── 🎬 Sus batallas en video: las de los canales de YouTube de los socios donde aparece (`bot/videos.py`). Dlx,
// 12/10/2026: «mejor sería que tú pudieses detectarlos tú mismo desde las cuentas y redes sociales de nuestros socios».
// Sin videos, no se dibuja. Se toca y se mira acá (`abrirVideo()`): nada de YouTube antes del toque, salvo la miniatura.
// Va debajo de Sus números y en NEGRO: entre dos blancas (Sus números y Datos), así sigue la regla de intercalar
const SV_CANAL = { DRA: 'Under Legends', SR: 'Snake Rap', FFS: 'Freestyle Future Series', FFA: 'Free for All', FVS: 'Freestyle Versus' };
// 🎬 Y LAS QUE SUMÓ ÉL (12/10/2026, `vp`: `bot/videos_propios.py`), aparte: «De plazas y otras ligas». Cualquiera
// verificado puede decir «esto no es suyo» (con dos reportes se oculta), y él puede quitar las suyas
function VideoPropio({ v: [vid, tit, cn], k, esYo, dc }) {
  const [hecho, setHecho] = useState('');
  const mandar = async (ruta, cuerpo, ok) => {
    try {
      const r = await fetch(ruta, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
      const j = await r.json().catch(() => ({}));
      setHecho(r.ok ? ok : j.error === 'sin_verificar' ? 'Sólo los verificados pueden reportar.' : 'No se pudo.');
    } catch (e) { setHecho('No se pudo.'); }
  };
  return (
    <li>
      <button type="button" className="pf-vid-b" onClick={() => abrirVideo({ vid, tit, link: 'https://www.youtube.com/watch?v=' + vid })}>
        <span className="pf-vid-m"><Miniatura vid={vid} cls="pf-vid-img" /><i aria-hidden="true">▶</i></span>
        <b>{tit}</b>
        <small>{cn}</small>
      </button>
      {hecho ? <small className="pf-vid-r">{hecho}</small> : dc ? (esYo
        ? <button type="button" className="pf-vid-r" onClick={() => mandar('/api/avisos/mis-videos', { accion: 'quitar', vid }, 'Lo quitaste: sale en la próxima actualización.')}>Quitar</button>
        : <button type="button" className="pf-vid-r" onClick={() => mandar('/api/avisos/video-reportar', { clave: k, vid }, 'Gracias: lo vamos a mirar.')}>Esto no es suyo</button>) : null}
    </li>
  );
}

// 🎛️ CON MUCHOS, UN FILTRO (Dlx, al remake del perfil: «filtrar batallas de videos, porque Makma tiene más de 10»): de
// los canales de la Liga o de plazas y otras ligas. Con pocos no hace falta
const VIDEOS_FILTRO = 4;
// y los primeros cuatro, el resto a un toque: con los de Makmah el bloque medía 2.531 px en la compu (21/10/2026)
const VIDEOS_VER = 4;
function Videos({ liga, p, k, esYo, dc }) {
  const [fil, setFil] = useState('');
  const [todos, setTodos] = useState(false);
  const vs0 = (p && p.vid) || [];
  const vp0 = (p && p.vp) || [];
  if (!vs0.length && !vp0.length) return null;
  const con = vs0.length && vp0.length && vs0.length + vp0.length > VIDEOS_FILTRO;
  const vs1 = fil === 'otras' ? [] : vs0;
  const vp1 = fil === 'liga' ? [] : vp0;
  const hay = vs1.length + vp1.length;
  const vs = todos ? vs1 : vs1.slice(0, VIDEOS_VER);
  const vp = todos ? vp1 : vp1.slice(0, Math.max(0, VIDEOS_VER - vs.length));
  return (
    <section className="sec pf-sec pf8-vid">
      <div className="sec-t"><h2>Sus batallas en video</h2><span className="tj-n">{vs0.length + vp0.length === 1 ? 'una' : vs0.length + vp0.length}</span></div>
      {con ? (
        <div className="pf8-chips" role="group" aria-label="Filtrar sus videos">
          {[['', 'Todos', vs0.length + vp0.length], ['liga', 'De la Liga', vs0.length], ['otras', 'Plazas y otras ligas', vp0.length]].map(([id, t, c]) => (
            <button key={id || 'todos'} type="button" className={fil === id ? 'on' : ''} aria-pressed={fil === id} onClick={() => setFil(id)}>{t} <small>{c}</small></button>
          ))}
        </div>
      ) : null}
      {vs.length ? <p className="pf-bajada">De los canales de YouTube de los servidores de la Liga. Toca una para verla acá.</p> : null}
      {vs.length ? <ul className="pf-vid">
        {vs.map(([vid, tit, sv]) => (
          <li key={vid}>
            <button type="button" className="pf-vid-b" onClick={() => abrirVideo({ vid, tit, link: 'https://www.youtube.com/watch?v=' + vid })}>
              <span className="pf-vid-m"><Miniatura vid={vid} cls="pf-vid-img" /><i aria-hidden="true">▶</i></span>
              <b>{tit}</b>
              <small>{SV_CANAL[sv] || siglaDe(sv)}</small>
            </button>
          </li>
        ))}
      </ul> : null}
      {vp.length ? (
        <>
          <h3 className="pf-vid-t">De plazas y otras ligas</h3>
          <p className="pf-bajada">Las sumó {esYo ? 'tú' : 'él'}: entran solas si el título es una batalla con su nombre.{esYo ? ' Las tuyas se suman en Mi cuenta → Mi perfil.' : ''}</p>
          <ul className="pf-vid">{vp.map((v) => <VideoPropio key={v[0]} v={v} k={k} esYo={esYo} dc={dc} />)}</ul>
        </>
      ) : null}
      {hay > VIDEOS_VER ? (
        <button type="button" className="btn borde chico pf-ver-mas" aria-expanded={todos} onClick={() => setTodos(!todos)}>
          {todos ? 'Ver menos' : 'Ver los ' + hay + ' videos'}</button>
      ) : null}
    </section>
  );
}

// ── Duelos: el cara a cara con cada rival; al tocar uno, sus duelos con él (Dlx: «3. A») ──
function Duelos({ liga, p, e }) {
  const du = (p && p.du) || [];
  const rivales = useMemo(() => {
    const por = new Map();
    du.forEach((d) => {
      const r = liga.fila(d[1]);
      const id = r ? r.k : 'n:' + limpio(d[1]).toLowerCase();
      if (!por.has(id)) por.set(id, { id, k: r ? r.k : '', n: r ? r.n : d[1], g: 0, p: 0, ds: [] });
      const x = por.get(id);
      x[d[2] ? 'g' : 'p'] += 1;
      x.ds.push(d);
    });
    return [...por.values()].sort((a, b) => (b.g + b.p) - (a.g + a.p) || (b.g - b.p) - (a.g - a.p));
  }, [du, liga]);
  const [abierto, setAbierto] = useState(null);
  const [todos, setTodos] = useState(false);
  if (!du.length) return <section className="sec pf-sec"><p className="rk-vacio">Todavía no tiene duelos en la {liga.temp}: cuentan los 1vs1 de las llaves.</p></section>;
  // (los 8 con quien más se cruzó y el resto a un toque, 19/10/2026: con 26 rivales eran 17 pantallas de perfil en el
  // teléfono; el abierto se muestra aunque esté más abajo)
  const vis = todos ? rivales : rivales.filter((r, i) => i < VER_PRIMEROS || r.id === abierto);
  const g = du.filter((d) => d[2]).length;
  const rd = (p && p.rd) || null;
  return (
    <section className="sec pf-sec negra">
      <div className="sec-t"><h2>Cara a cara</h2><span className="tj-n">{g} ganados de {du.length}{rd ? ' · racha ' + rd[0] + ' (máx ' + rd[1] + ')' : ''}</span></div>
      {/* 🟩🟥 sus últimos duelos, del más viejo al más nuevo (la v2 de la maqueta) */}
      <span className="pf8-wl grande" aria-label={'Sus últimos duelos: ' + du.slice(0, 24).reverse().map((d) => (d[2] ? 'ganó' : 'perdió')).join(', ')}>
        {du.slice(0, 24).reverse().map((d, i) => <i key={i} className={d[2] ? 'g' : 'p'} />)}</span>
      <p className="pf-bajada">Contra cada rival: cuántas veces se cruzaron y cómo le fue. Toca uno para ver sus duelos.</p>
      <ul className="pf-cc">
        {vis.map((r) => {
          const t = r.g + r.p;
          const on = abierto === r.id;
          return (
            <li key={r.id} className={on ? 'on' : ''}>
              <button type="button" className="pf-cc-b" aria-expanded={on} onClick={() => setAbierto(on ? null : r.id)}>
                <Cara liga={liga} k={r.k} nombre={r.n} cls="cara pf-cc-cara" lazy />
                <b>{limpio(r.n)}</b>
                <span className={'pf-cc-res' + (r.g > r.p ? ' gana' : r.p > r.g ? ' pierde' : '')}>{r.g}–{r.p}</span>
                <small>{t === 1 ? 'una vez' : t + ' veces'}</small>
              </button>
              {on ? (
                <ol className="pf-cc-ds">
                  {r.ds.map((d, i) => {
                    const x = (e || {})[d[0]] || [];
                    return (
                      <li key={i}>
                        <span className={d[2] ? 'pf-gano' : 'pf-perdio'}>{d[2] ? 'GANÓ' : 'PERDIÓ'}</span>
                        <button type="button" className="pf-lnk" onClick={() => accion.llave(String(d[0]))}>{limpio(x[0] || 'Evento ' + d[0])}</button>
                        <small>{x[2] ? fecha(x[2]) : ''}</small>
                      </li>
                    );
                  })}
                  {r.k ? <li className="pf-cc-ver"><a className="pf-lnk" href={'#/r/' + encodeURIComponent(r.k)}>Ver el perfil de {limpio(r.n)}</a></li> : null}
                </ol>
              ) : null}
            </li>
          );
        })}
      </ul>
      {rivales.length > VER_PRIMEROS ? (
        <button type="button" className="btn borde chico pf-ver-mas" aria-expanded={todos} onClick={() => setTodos(!todos)}>
          {todos ? 'Ver menos' : 'Ver los ' + rivales.length + ' rivales'}</button>
      ) : null}
    </section>
  );
}

// ── Insignias y su cacería ──
// 🏟️ SUS LIGAS (ForceGP, 14/10/2026, por Dlx: «no sale mis partes»): las ligas de los servidores donde juega, con su
// puesto y su récord. Sale de lo que ya viaja en el lobby (`ligas`, con el perfil de cada nombre en `ks`): sirve también
// para el staff que no juega eventos y sí ligas
export function SusLigas({ liga, k, esYo, p, dentro }) {
  const ls = ((liga.d.ligas || {}).ligas) || [];
  const mias = [];
  for (const L of ls) {
    const i = (L.tabla || []).findIndex(([raw]) => ((L.ks || {})[raw] || (liga.fila(raw) || {}).k) === k);
    if (i >= 0) mias.push([L, i, L.tabla[i]]);
  }
  // 📈 y dónde está en el ascenso de algún servidor (17/10/2026): `[sv, liga, puesto, pts, a cuánto, id, ¿sube?]`
  const asc = p && p.asc;
  if (!mias.length && !asc) return null;
  // 🗂️ adentro de «Sus datos» (21/10/2026): la misma lista, con su título chico
  const cont = (
    <>
      {dentro ? <h3 className="pf8-h3">{esYo ? 'Tus ligas' : 'Sus ligas'} <a href="#/ligas">Ligas <Ico n="flecha" t={14} /></a></h3>
        : <div className="sec-t"><h2>{esYo ? 'Tus ligas' : 'Sus ligas'}</h2><a href="#/ligas">Ligas <Ico n="flecha" t={16} /></a></div>}
      <ul className="pf-lg">{mias.map(([L, i, [, pj, pg, pts]]) => (
        <li key={L.id}>
          <b><a href={'#/ligas/' + encodeURIComponent(L.id)}>{L.n}</a></b><small>{siglaDe(L.sv)}</small>
          <span className="pf-lg-p">{i + 1}º de {L.tabla.length}</span>
          <span>{pg} de {pj} {pj === 1 ? 'ganada' : 'ganadas'} · <b>{pts}</b> pts</span>
        </li>
      ))}
      {asc ? (
        <li key="asc" className="pf-lg-asc">
          <b><a href={'#/ligas/' + encodeURIComponent(asc[5])}>Ascenso a la {asc[1]}</a></b><small>{siglaDe(asc[0])}</small>
          <span className="pf-lg-p">{asc[2]}º</span>
          <span>{asc[6] ? 'hoy sube' : asc[4] ? 'a ' + num(asc[4]) + ' pts de subir' : 'empatado con el último que sube'} · <b>{num(asc[3])}</b> pts</span>
        </li>
      ) : null}</ul>
      {mias.length ? <p className="pronto-p">Las batallas de liga suman a {esYo ? 'tus' : 'sus'} duelos (el Ranking Duelos y el Win%); al Score, no.</p> : null}
    </>
  );
  return dentro ? cont : <section className="sec pf-sec pf-ligas">{cont}</section>;
}

// 📰 SUS PUBLICACIONES (Dlx, 13/10/2026: «pon ahí las publicaciones de cada uno que el bot publica también en alguna
// parte, no todas claramente pero con la opción de ver todas»): las de toda la temporada (`mu`, `muro.de_cada_uno()`),
// las tres más nuevas y «Ver todas». Las mismas piezas que Publicaciones, con 👏 Felicitar
function SusPublicaciones({ liga, p, esYo }) {
  const [todas, setTodas] = useState(false);
  const A = useAplausos();
  // 📣 las promos van en su propia sección (`SusPromos`)
  const xs = ((p && p.mu) || []).filter((it) => it.tipo !== 'promo');
  if (!xs.length) return null;
  const ver = todas ? xs : xs.slice(0, 3);
  return (
    <section className="sec pf-sec pf-pubs">
      <div className="sec-t"><h2>{esYo ? 'Tus publicaciones' : 'Sus publicaciones'}</h2><span className="tj-n">{xs.length}</span></div>
      <div className="pub-dia">{ver.map((it) => (it.tipo === 'tarjeta'
        ? <Cartas key={it.id} liga={liga} xs={[it]} /> : <Pub key={it.id} liga={liga} it={it} A={A} />))}</div>
      {xs.length > 3 ? (
        <button type="button" className="btn borde2 chico pf-pubs-mas" aria-expanded={todas} onClick={() => setTodas(!todas)}>
          {todas ? 'Ver menos' : 'Ver todas (' + xs.length + ')'}</button>
      ) : null}
    </section>
  );
}

// 📣 SUS PROMOS (Dlx, 16/10/2026: «en el perfil de cada uno»): lo que compartió en el canal de promoción de los
// servidores (bot/promos.py), música y video, las más nuevas primero. Sin ninguna, no se dibuja
function SusPromos({ liga, p, esYo }) {
  const A = useAplausos();
  const xs = ((p && p.mu) || []).filter((it) => it.tipo === 'promo' && it.o !== 'liga');
  if (!xs.length) return null;
  return (
    <section className="sec pf-sec pf-pubs">
      <div className="sec-t"><h2>{esYo ? 'Tus promos' : 'Sus promos'}</h2><a href="#/publicaciones">Promos <Ico n="flecha" t={16} /></a></div>
      <div className="pub-dia">{xs.map((it) => <Pub key={it.id} liga={liga} it={it} A={A} />)}</div>
    </section>
  );
}

// 🏅 LOGROS (las insignias de la Liga), EN NEGRO, y al lado 🎒 INVENTARIO (Dlx, a la v11: «pon al costado de Logros
// Inventario: esto será para otra cosa»): una pestaña más del mismo bloque, vacía hasta que tenga qué guardar
function Logros({ liga, p, esYo }) {
  const [faltan, setFaltan] = useState(false);
  const [pest, setPest] = useState('logros');
  const cat = liga.d.insignias || [];
  const tiene = new Map(((p && p.ins) || []).map((x) => [x[0], x[1]]));
  if (!cat.length) return null;
  // 🏅 LAS QUE TIENE, A LA VISTA; LAS QUE FALTAN, A UN TOQUE (19/10/2026): eran 49 en grilla —38 bloqueadas— y lo más
  // largo del perfil era lo que NO tenía (~1.700 px en la compu, ~3.500 en el teléfono). No se saca ninguna
  const fila = ([id, ic, n, desc]) => {
    const t = tiene.get(id);
    return (
      <li key={id} className={t ? 'si' : ''}>
        <span className="pf-ins-ic" aria-hidden="true">{ic}</span>
        <b>{n}</b>
        <small>{t ? 'desde el ' + fecha(t).toLowerCase() : desc}</small>
      </li>
    );
  };
  const si = cat.filter((x) => tiene.has(x[0]));
  const no = cat.filter((x) => !tiene.has(x[0]));
  return (
    <section className="sec pf-sec negra pf8-logros">
      <div className="pf8-pest" role="tablist" aria-label="Logros e inventario">
        <button type="button" role="tab" aria-selected={pest === 'logros'} className={pest === 'logros' ? 'on' : ''} onClick={() => setPest('logros')}>
          Logros <small>{tiene.size} de {cat.length}</small></button>
        <button type="button" role="tab" aria-selected={pest === 'inv'} className={pest === 'inv' ? 'on' : ''} onClick={() => setPest('inv')}>
          Inventario <small>pronto</small></button>
      </div>
      {pest === 'inv' ? (
        <div className="pf8-inv"><span aria-hidden="true">🎒</span><b>{esYo ? 'Tu inventario' : 'Su inventario'}</b>
          <p>Acá se van a guardar las cosas que {esYo ? 'consigas' : 'consiga'} en Under Legends. Llega pronto.</p></div>
      ) : <>
        {si.length ? <ul className="pf-ins">{si.map(fila)}</ul> : <p className="pf-ins-nada">Todavía ninguna.</p>}
        {no.length ? (
          <>
            <button type="button" className="btn borde chico pf-ins-mas" aria-expanded={faltan} onClick={() => setFaltan(!faltan)}>
              {faltan ? 'Esconder las que faltan' : 'Ver las ' + no.length + ' que faltan'}</button>
            {faltan ? <ul className="pf-ins pf-ins-no">{no.map(fila)}</ul> : null}
          </>
        ) : null}
      </>}
    </section>
  );
}

// 🎯 SU CACERÍA (Most Wanted), en negro; en la compu va al costado, junto al precio por su cabeza (las dos son del Most
// Wanted: Dlx, a la v11, «se ha abierto una grieta a la derecha abajo»)
function Caceria({ p }) {
  const mw = (p && p.mw) || {};
  return (
    <section className="sec pf-sec negra pf8-caza">
      <div className="sec-t"><h2>Su cacería</h2><a href="#/ranking/mw">Most Wanted <Ico n="flecha" t={16} /></a></div>
      <dl className="pf-tiles pf-caza">
        <div><dd>{(mw.caz || []).length}</dd><dt>CAZÓ</dt></div>
        <div><dd>{(mw.czd || []).length}</dd><dt>LO CAZARON</dt></div>
        <div><dd>{mw.sob || 0}</dd><dt>SOBREVIVIÓ</dt></div>
        <div><dd>{mw.esc || 0}</dd><dt>SE ESCONDIÓ</dt></div>
      </dl>
      {(mw.czd || []).length || (mw.caz || []).length ? (
        <ul className="pf-czd">
          {/* 🔴 `caz` es [período, buscado, categoría, evento, cobró] y NO el orden de `czd` [período, categoría, evento,
              [cazadores]]: copiado de la línea de abajo, decía «Cazó a P» —la primera letra del evento— (19/10/2026) */}
          {(mw.caz || []).map((x, i) => <li key={'a' + i}><b>Cazó a {limpio(x[1] || '')}</b><small>{limpio(x[2] || '')} · {limpio(x[3] || '')}</small></li>)}
          {(mw.czd || []).map((x, i) => <li key={'b' + i}><b>Lo cazó {limpio((x[3] || [])[0] || '')}</b><small>{x[1]} · {limpio(x[2] || '')}</small></li>)}
        </ul>
      ) : null}
    </section>
  );
}

// tu fila cuando entraste con Discord y no estás en la tabla (corta en 200): lo de tu cuenta, como `filaCuenta()` de app.js
function filaDeCuenta(dc, k) {
  if (!dc || dc.clave !== k) return null;
  return { k, n: dc.rapero || dc.n, cc: dc.cc, sv: dc.sv, pos: null, ovr: null, pts: 0, ev: dc.ev || 0, wr: '', c: dc.cs || [], fuera: true };
}

// 🧭 EL ÍNDICE DE ARRIBA (la maqueta B): baja hasta cada parte. Una parte que no se dibujó no tiene botón
const INDICE = [['videos', 'Videos'], ['ultimo', 'Lo último'], ['datos', 'Datos'], ['duelos', 'Duelos'], ['insignias', 'Logros'], ['eventos', 'Eventos']];
function Indice({ raiz }) {
  const [hay, setHay] = useState('');
  useEffect(() => {
    const r = setTimeout(() => {
      const el = raiz.current;
      if (!el) return;
      const xs = INDICE.filter(([id]) => { const x = el.querySelector('#pf-' + id); return x && x.firstElementChild; }).map(([id]) => id).join(',');
      setHay((h) => (h === xs ? h : xs));
    }, 80);
    return () => clearTimeout(r);
  });
  const ir = (id) => {
    const el = raiz.current && raiz.current.querySelector(id ? '#pf-' + id : '.pf8');
    if (el) window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 64), behavior: 'smooth' });
  };
  const ids = hay ? hay.split(',') : [];
  if (!ids.length) return null;
  return (
    <nav className="pf8-ind" aria-label="Partes del perfil">
      <button type="button" className="on" onClick={() => ir('')}>Resumen</button>
      {INDICE.filter(([id]) => ids.includes(id)).map(([id, n]) => <button key={id} type="button" onClick={() => ir(id)}>{n}</button>)}
    </nav>
  );
}

// 🔰 sus emblemas, de lo que la página ya tiene (emblemas.jsx)
function useEmblemas(f, k, p, e) {
  const nvs = useNiveles();
  const pa = usePaseDe(k);
  const rls = (useRoles() || {})[k] || [];
  const seg = useSeguidores(k);
  useCrews();
  const cv = crewDe(k);
  if (!f) return [];
  const ev = (p && p.ev) || [];
  const ts = ev.map(([n]) => Date.parse(((e || {})[n] || (e || {})[String(n)] || [])[2] || '')).filter((x) => !isNaN(x));
  const dias = ts.length ? Math.max(0, Math.floor((Date.now() - Math.min(...ts)) / DIA_MS)) : null;
  const propio = String(f.sv || '').toLowerCase();
  const cartas = ORDEN.filter((c) => (f.c || []).includes(c)).length + ((p && p.svc) || []).filter((x) => x !== propio).length;
  const promos = ((p && p.mu) || []).filter((it) => it.tipo === 'promo').length;
  return emblemasDe({
    dias, vd: p && p.vd, pase: pa ? pa.nivel : null, racha: nvs && nvs[k] ? nvs[k][1] : null, seg,
    crewRol: cv && cv.rol, cartas, promos, roles: rls.map((x) => x[0]),
  });
}

export function Perfil({ liga, dc, k: k0, tab }) {
  let k = k0;
  try { k = decodeURIComponent(k0); } catch (e) { /* tal cual */ }
  // un link viejo con otra forma de la clave (mayúsculas): el de la tabla, como `porK()` de app.js
  if (!liga.T[k]) { const kk = Object.keys(liga.T).find((x) => x.toLowerCase() === String(k).toLowerCase()); if (kk) k = kk; }
  const P = usePerfiles();
  // 👤 y quien no entra en la tabla del lobby (corta en 200): su fila viaja en su perfil, y el staff que no compite trae
  // una mínima (`f.solo`). Dlx, 13/10/2026: «Todos los que jugaron y los del staff». Ver `_perfiles_extra()` en subir_web.py
  const f = liga.T[k] || (P && P.p && P.p[k] && P.p[k].f) || filaDeCuenta(dc, k);
  const esYo = !!((dc && dc.clave === k) || (liga.yo && liga.yo.k === k));
  const p = (P && P.p && P.p[k]) || null;
  const t = SECCIONES.includes(tab) ? tab : '';
  const ems = useEmblemas(f, k, p, P && P.e);
  const [emb, setEmb] = useState(null);
  useEffect(() => { setEmb(null); }, [k]);
  useEffect(() => { window.scrollTo(0, 0); }, [k]);
  useEffect(() => {
    if (!f) return undefined;
    const poner = () => { document.title = limpio(f.n) + ' · Liga Global de Freestyle'; };
    poner();
    const r = setTimeout(poner, 0);
    return () => clearTimeout(r);
  }, [f]);
  // un link de los de antes (`#/r/x/duelos`): baja hasta esa sección cuando ya está dibujada.
  // ⚠️ ANTES del `return` de «no está»: un hook después de un return condicional cambia la cuenta de hooks si la persona
  // aparece o desaparece de la tabla con la página abierta, y React tira la página entera
  const abajo = useRef(null);
  useEffect(() => {
    if (!t || !P) return undefined;
    const r = setTimeout(() => {
      const el = abajo.current && abajo.current.parentNode && abajo.current.parentNode.querySelector('#pf-' + t);
      if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 64);
    }, 60);
    return () => clearTimeout(r);
  }, [t, k, !!P]); // eslint-disable-line react-hooks/exhaustive-deps
  // 📏 LAS DOS COLUMNAS DE LA COMPU TERMINAN JUNTAS (Dlx, a la v11: «se ha abierto una grieta a la derecha abajo»): la lista
  // de sus eventos crece o se achica hasta que la columna ancha llegue a donde termina la de al lado, a cualquier ancho
  // —lo que se aprendió en Eventos (3.93): una cantidad fija medida a 1333 px volvía a dejar el hueco en un iPad—
  const raiz = useRef(null);
  const [nEv, setNEv] = useState({ k: '', n: 5 });
  const [medida, setMedida] = useState(0);
  const n = nEv.k === k ? nEv.n : 5;
  // y si con todos sus eventos el costado sigue más largo, «Sus fortalezas» pasa a la ancha (una vez por perfil: así no
  // salta de un lado al otro)
  const [fzM, setFzM] = useState('');
  const fzAncha = fzM === k;
  useEffect(() => {
    const el = raiz.current;
    if (!el || typeof ResizeObserver !== 'function') return undefined;
    const ro = new ResizeObserver(() => setMedida((x) => x + 1));
    el.querySelectorAll('.pf8-main, .pf8-lat').forEach((x) => ro.observe(x));
    return () => ro.disconnect();
  }, [k, !!P]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = raiz.current;
    if (!el || !window.matchMedia || !window.matchMedia('(min-width: 900px)').matches) return;
    const main = el.querySelector('.pf8-main');
    const lat = el.querySelector('.pf8-lat');
    const fila = el.querySelector('.pf8-evl > li');
    const total = ((p && p.ev) || []).length;
    if (!main || !lat || !fila || !total) return;
    const alto = Math.max(40, fila.getBoundingClientRect().height + 8);
    const dif = lat.getBoundingClientRect().bottom - main.getBoundingClientRect().bottom;
    if (dif > alto && n < total) setNEv({ k, n: Math.min(total, n + Math.floor(dif / alto)) });
    else if (dif > alto * 3 && !fzAncha) setFzM(k);
    else if (dif < -alto && n > 3) setNEv({ k, n: Math.max(3, n - Math.floor(-dif / alto)) });
  }, [medida, n, k, p, fzAncha]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!f) {
    // sin la tabla no se sabe todavía: puede venir en los perfiles, que bajan después
    if (!P) return <div className="cargando">Cargando…</div>;
    return (
      <section className="sec pf-sec">
        <div className="sec-t"><h2>Todavía no jugó esta temporada</h2></div>
        <p className="pronto-p">Búscalo en el <a className="te-link" href="#/ranking">Ranking</a>.</p>
      </section>
    );
  }
  const panel = emb != null && ems.length ? <PanelEmblemas xs={ems} sel0={emb} nombre={limpio(f.n)} esYo={esYo} onCerrar={() => setEmb(null)} /> : null;
  // 🏷️ el staff que no compite: quién es y su rol, sin números ni tarjetas
  if (f.solo) {
    return (
      <>
        <Cabeza liga={liga} f={f} k={k} p={p} dc={dc} esYo={esYo} ems={ems} onEmblemas={(x) => setEmb(x || '')} numeros={false} />
        <section className="sec pf-sec"><p className="pronto-p">{esYo ? 'No jugaste eventos esta temporada: estás en la Liga por tu rol.' : 'No jugó eventos esta temporada: está en la Liga por su rol.'}</p></section>
        <SusLigas liga={liga} k={k} esYo={esYo} p={p} />
        {panel}
      </>
    );
  }
  // 🎨 BLANCO Y NEGRO, INTERCALADOS (Dlx, 07/10/2026, y la maqueta B del 21/10): en el teléfono una columna, en este
  // orden —videos, la meta, de un vistazo, lo último, publicaciones, fortalezas, cara a cara, sus datos, logros, cacería,
  // precio y eventos—; en la compu, la columna ancha y la del costado, que terminan juntas. El orden del teléfono lo da
  // `order` (las dos columnas son `display: contents` ahí)
  return (
    <div className="pf8-pag" ref={raiz}>
      <Cabeza liga={liga} f={f} k={k} p={p} dc={dc} esYo={esYo} ems={ems} onEmblemas={(x) => setEmb(x || '')} numeros />
      <div ref={abajo} />
      {P ? <Indice raiz={raiz} /> : null}
      {/* 🤝 en tu perfil y sin crew: las que te aceptan, debajo de la cabecera (sale sola sólo si estás verificado y sin
          crew: ver `CrewsParaVos` de crewpanel.jsx) */}
      {esYo && !crewDe(k) ? <CrewsParaVos liga={liga} seccion="sec pf-sec" /> : null}
      {f.fuera ? <section className="sec pf-sec"><p className="pronto-p">Tu historial todavía no está en la página: aparece cuando entras entre los 200 de la tabla.</p></section> : null}
      {!P ? <div className="cargando">Cargando…</div> : (
        <div className="pf8-cuerpo">
          <div className="pf8-main">
            <div id="pf-videos" className="o1"><Videos liga={liga} p={p} k={k} esYo={esYo} dc={dc} /></div>
            <div id="pf-ultimo" className="o4"><LoUltimo liga={liga} p={p} e={P.e} /></div>
            <div id="pf-publicaciones" className="o5"><SusPublicaciones liga={liga} p={p} esYo={esYo} /><SusPromos liga={liga} p={p} esYo={esYo} /></div>
            <div id="pf-duelos" className="o7"><Duelos liga={liga} p={p} e={P.e} /></div>
            {fzAncha ? <div className="o6"><Fortalezas liga={liga} f={f} p={p} dmp={P.dmp} esYo={esYo} /></div> : null}
            <div id="pf-insignias" className="o9"><Logros liga={liga} p={p} esYo={esYo} /></div>
            <div id="pf-eventos" className="o12"><Eventos liga={liga} p={p} e={P.e} n={n} /></div>
          </div>
          <aside className="pf8-lat">
            <div className="o2"><ProximaMeta liga={liga} f={f} esYo={esYo} /></div>
            <div className="o3"><DeUnVistazo f={f} p={p} /></div>
            {fzAncha ? null : <div className="o6"><Fortalezas liga={liga} f={f} p={p} dmp={P.dmp} esYo={esYo} /></div>}
            <div id="pf-datos" className="o8"><SusDatos liga={liga} f={f} k={k} p={p} e={P.e} esYo={esYo} /></div>
            <div className="o10"><Caceria p={p} /></div>
            <div className="o11"><Precio liga={liga} f={f} esYo={esYo} dc={dc} /></div>
          </aside>
        </div>
      )}
      {panel}
    </div>
  );
}
