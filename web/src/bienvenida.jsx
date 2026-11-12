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
//   📖 DESDE EL 12/11/2026 EL PASO 1 ES PAGINADO (`Paso1`, abajo): seis páginas como las de una app en la tienda y la
//       barra del botón fija. La cinta de abajo se fue: la barra ocupa ese lugar y dos cosas moviéndose ahí competían.
//
// ⚠️ Sale UNA vez, a quien llega por primera vez al Inicio sin cuenta (`quiereBienvenida()` de primera.js); quien entra
// por un link (una llave, un perfil) va directo a eso, como siempre. Lo que pasa se cuenta (`contar()`, Dashboard).
// ⚠️ Sin degradés, sin blur y con radios chicos (las reglas del remake); con «Menos animaciones», quieta.
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Ico } from './piezas.jsx';
import { limpio, num, srcLogo, utc } from './liga.js';
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

// ── EL PASO 1, PAGINADO (Dlx, 12/11/2026: «que sea un sistema de paginación, o sea que se pueda ir a la derecha para ver
// más cosas, pero que siempre aparezca la opción de UNIRME CON DISCORD o en otro momento, y asegúrate que explique todo
// lo que ofrecemos, como las páginas en App Store de la app… y que todo esté bien posicionado»). Seis páginas que se
// deslizan de costado (`scroll-snap`, sin librería) y una barra de abajo que no se mueve: los puntos con el nombre de cada
// página, las flechas y el botón. Cada página dice UNA cosa que trae la Liga y la muestra con lo de verdad —las cartas del
// #1, el calendario, la tabla, las crews—: «sin dato no hay pieza», así que una que no tiene con qué se arma con palabras.
const PAGINAS = [['liga', 'La Liga'], ['cartas', 'Tu carta'], ['eventos', 'Eventos'], ['ranking', 'Ranking'], ['pase', 'Pase y Tienda'], ['gente', 'Comunidad']];
const TIPOS = [['servidor', 'Servidor', 'Al verificarte'], ['temporada', 'Temporada', 'Nivel 1 del Pase'],
  ['competitivo', 'Competitiva', 'Con 10 eventos'], ['pais', 'País', '3 cruces de tu país y 3 de afuera']];

// 🎬 LAS ENTRADAS (12/11/2026, Dlx: «que esté bonito todo y con buenas animaciones de transición»): cada pieza lleva `bv-e`
// y su lugar en la fila (`--i`, en ella misma: nunca un transform desde una variable del padre), y entra cuando su página
// se ve por primera vez (`vista`). La portada ya trae las suyas (el sello, el título, el abanico): sus piezas entran detrás
const e = (i, cls) => ({ className: (cls ? cls + ' ' : '') + 'bv-e', style: { '--i': i } });

function Pagina({ id, i, vista, sello, titulo, texto, puntos, extra, visual, primera, tit }) {
  const o = primera ? 8 : 0;
  return (
    <section className={'bv-pag bv-pag-' + id + (vista ? ' vista' : '')} aria-roledescription="página" aria-label={sello}>
      <div className="bv-pag-tx">
        {primera ? <span className="bv-sello">{sello}</span> : <span {...e(0, 'bv-kick')}>{sello}</span>}
        {primera ? <h1 className="bv-t" id="bv-t" tabIndex={-1} ref={tit}>{titulo}</h1> : <h2 {...e(1, 'bv-h')}>{titulo}</h2>}
        <p {...e(o + 2, 'bv-p')}>{texto}</p>
        {extra ? <div {...e(o + 3)}>{extra}</div> : null}
        {puntos ? <ul className="bv-puntos">{puntos.map(([ico, t], k) => <li key={t} {...e(o + 3 + k)}><Ico n={ico} t={18} /><span>{t}</span></li>)}</ul> : null}
      </div>
      {/* el número grande de atrás va más lento que todo al deslizar: es lo que da la profundidad */}
      <div className="bv-pag-vis"><span className="bv-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>{visual}</div>
    </section>
  );
}

function Paso1({ liga, unirme, cerrar, tit }) {
  const [pag, setPag] = useState(0);
  const [vistas, setVistas] = useState(() => new Set([0]));
  const pista = useRef(null);
  useEffect(() => { setVistas((v) => (v.has(pag) ? v : new Set([...v, pag]))); }, [pag]);
  // la página que se ve sale del scroll (deslizar con el dedo también cuenta), no de un estado aparte que se desfasa.
  // 🎬 Y EL PARALAJE, ATADO AL DEDO: en la misma vuelta de cuadro, cada página sabe a qué distancia está del centro (`d`,
  // de -1 a 1) y sus tres capas se corren distinto —el texto casi con la página, la imagen más lenta y un poco más chica,
  // el número de atrás más lento todavía—. Es transform y opacidad puestos en cada pieza: no hay layout ni pintura, y
  // como sale del scroll se frena, vuelve y sigue al dedo sin que haya una animación que interrumpir
  useEffect(() => {
    const el = pista.current;
    if (!el) return undefined;
    let t = 0;
    const mover = () => {
      const w = Math.max(1, el.clientWidth), x = el.scrollLeft;
      setPag(Math.round(x / w));
      const quieto = (W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches) || !!document.querySelector('.calma');
      Array.prototype.forEach.call(el.children, (pg, i) => {
        const tx = pg.firstElementChild, vis = pg.lastElementChild, num = vis && vis.firstElementChild;
        if (!tx || !vis || !num) return;
        const d = Math.max(-1, Math.min(1, (i * w - x) / w)), a = Math.abs(d);
        if (quieto || a < 0.001) {
          tx.style.transform = vis.style.transform = num.style.transform = tx.style.opacity = vis.style.opacity = '';
          return;
        }
        tx.style.transform = 'translate3d(' + (-d * 36).toFixed(1) + 'px,0,0)';
        tx.style.opacity = (1 - a * 0.45).toFixed(3);
        vis.style.transform = 'translate3d(' + (-d * 120).toFixed(1) + 'px,0,0) scale(' + (1 - a * 0.06).toFixed(3) + ')';
        vis.style.opacity = (1 - a * 0.65).toFixed(3);
        num.style.transform = 'translate3d(' + (-d * 240).toFixed(1) + 'px,0,0)';
      });
    };
    const ver = () => { cancelAnimationFrame(t); t = requestAnimationFrame(mover); };
    el.addEventListener('scroll', ver, { passive: true });
    W.addEventListener('resize', ver);
    ver();
    return () => { el.removeEventListener('scroll', ver); W.removeEventListener('resize', ver); cancelAnimationFrame(t); };
  }, []);
  const ir = (i) => {
    const el = pista.current;
    const n = Math.max(0, Math.min(PAGINAS.length - 1, i));
    if (!el) return;
    const quieta = (W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches) || document.querySelector('.calma');
    el.scrollTo({ left: n * el.clientWidth, behavior: quieta ? 'auto' : 'smooth' });
  };
  // ← → también con el teclado (Escape ya es «En otro momento»)
  useEffect(() => {
    const tecla = (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); ir(pag + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); ir(pag - 1); }
    };
    W.addEventListener('keydown', tecla);
    return () => W.removeEventListener('keydown', tecla);
  });

  const top = liga.oficiales().filter((f) => f.k && liga.cartaDe(f.k)).slice(0, 3);
  const abanico = top.length === 3 ? [top[1], top[0], top[2]] : top;
  const svs = (liga.d.svs || []).map((s) => (typeof s === 'string' ? s : s && s.sv)).filter(Boolean);
  const nombreSv = (s) => ((liga.svs || {})[s] || {}).nombre || s;
  const carta = (k, cual, cls) => (
    <img className={cls} alt="" src={liga.cartaUrl(k, cual)}
      srcSet={liga.cartaUrl(k, cual, true) + ' 300w, ' + liga.cartaUrl(k, cual) + ' 900w'} sizes="(max-width: 899px) 120px, 220px"
      onError={(e) => { const g = liga.cartaUrl(k, cual); if (e.currentTarget.currentSrc !== g) { e.currentTarget.srcset = ''; e.currentTarget.src = g; } }} />
  );
  let ult = null;
  try { const c = liga.muroLimpio().find((it) => it.tipo === 'campeon'); ult = c ? liga.itemMuro(c) : null; } catch (e) { ult = null; }
  // 🃏 las cuatro cartas, de quien tenga más (el primero que tenga las cuatro, si hay)
  const ofi = liga.oficiales();
  const conTodas = ofi.find((f) => f.k && TIPOS.every(([t]) => (f.c || []).includes(t))) || ofi.find((f) => f.k && (f.c || []).length);
  // 📅 lo que viene en el calendario; si no hay nada por venir, lo último que se jugó
  const ahora = liga.ahora || Date.now();
  // (sin nombre de verdad no va: una fila «(sin título)» no le dice nada a quien llega)
  const cal = (liga.d.calendario || []).filter((e) => e && e.t && e.n && !/^\(?sin t[ií]tulo\)?$/i.test(String(e.n).trim()));
  const vienen = cal.filter((e) => utc(e.t) > ahora).sort((a, b) => utc(a.t) - utc(b.t));
  const evs = (vienen.length ? vienen : cal.filter((e) => e.jugado).sort((a, b) => utc(b.t) - utc(a.t))).slice(0, 4);
  const enVivo = (() => { try { return liga.vivo().length; } catch (e) { return 0; } })();
  const rangos = liga.d.rangos || [];
  const tienda = liga.d.tienda || {};
  const crews = (liga.d.crews || []).slice(0, 3);
  const com = liga.d.comunidad || {};
  const ligas = (() => { try { return liga.ligas(); } catch (e) { return []; } })();

  const visuales = {
    liga: (
      <div className="bv-v-liga">
        {abanico.length ? <div className="bv-cartas" aria-hidden="true">{abanico.map((f, i) => (
          <span key={f.k} className={'bv-carta c' + i + (abanico.length === 3 && i === 1 ? ' uno' : '')}>{carta(f.k, liga.cartaDe(f.k), '')}</span>
        ))}</div> : null}
        <p className="bv-top">{abanico.length === 3 ? <>Los tres primeros de la temporada: <b>{limpio(top[0].n)}</b>, {limpio(top[1].n)} y {limpio(top[2].n)}</> : null}</p>
        {ult ? <p {...e(10, 'bv-ult')}><Ico n="copa" t={16} /><span>{ult[1]}</span><small>{ult[3]}</small></p> : null}
      </div>
    ),
    cartas: conTodas ? (
      <div className="bv-v-cartas">
        <ol>{TIPOS.map(([t, n, como], k) => (
          <li key={t} {...e(2 + k, 'bv-ec')}>
            {(conTodas.c || []).includes(t) ? carta(conTodas.k, t, 'bv-c4') : <span className="bv-sil grande" aria-hidden="true">?</span>}
            <b>{n}</b><small>{como}</small>
          </li>
        ))}</ol>
        <p {...e(7, 'bv-pie')}>Las cartas de {limpio(conTodas.n)}, #{conTodas.pos} de la temporada</p>
      </div>
    ) : null,
    eventos: evs.length ? (
      <div {...e(1, 'bv-v-lista')}>
        <p className="bv-v-t">{vienen.length ? 'Lo que viene' : 'Lo último que se jugó'}{enVivo ? <em>● {enVivo} en vivo ahora</em> : null}</p>
        <ul>{evs.map((ev, k) => (
          <li key={ev.t + ev.n} {...e(3 + k)}><img alt="" src={liga.logo(ev.sv)} /><span><b>{limpio(ev.n)}</b><small>{nombreSv(ev.sv)}</small></span>
            <time>{vienen.length ? liga.dia(ev.t) : liga.cuando(ev.t)}</time></li>
        ))}</ul>
      </div>
    ) : null,
    ranking: ofi.length ? (
      <div {...e(1, 'bv-v-lista')}>
        <p className="bv-v-t">La tabla de hoy</p>
        <ol className="bv-tabla">{ofi.slice(0, 5).map((f, k) => (
          <li key={f.k || f.n} {...e(3 + k)}><span className="bv-pos">{f.pos}</span><b>{limpio(f.n)}</b>
            {f.rg ? <i className="bv-rg" style={{ '--c': f.rgc || liga.colorRg(f.rg) }}>{f.rg}</i> : null}<span className="bv-pts">{num(f.pts || 0)}</span></li>
        ))}</ol>
        {rangos.length ? <p {...e(8, 'bv-rangos')} aria-label="Los rangos, de arriba a abajo">{rangos.map((r) => <i key={r.r} style={{ '--c': r.color }}>{r.r}</i>)}</p> : null}
      </div>
    ) : null,
    pase: (
      <div className="bv-v-pase">
        <ol className="bv-niveles">{[[1, 'Tu carta de Temporada'], [8, 'Tu carta brilla en las llaves'], [30, 'El Salón del Pase']].map(([n, t], k) => (
          <li key={n} {...e(2 + k)}><b>{n}</b><span>{t}</span></li>
        ))}</ol>
        {tienda.inicial ? <p {...e(5, 'bv-moneda')}><Ico n="moneda" t={22} /><span><b>{num(tienda.inicial)}</b> Puntos de Tienda para empezar</span></p> : null}
      </div>
    ),
    gente: (
      <div {...e(1, 'bv-v-lista')}>
        {crews.length ? <><p className="bv-v-t">Las crews de arriba</p>
          <ol className="bv-crews">{crews.map((c, i) => (
            <li key={c.clave || c.crew} {...e(3 + i)}><span className="bv-pos">{i + 1}</span>{c.logo ? <img alt="" src={srcLogo(c.logo)} /> : <i className="bv-sinlogo" aria-hidden="true" />}
              <span><b>{limpio(c.crew)}</b><small>{c.n} raperos</small></span><span className="bv-pts">{num(c.pts || 0)}</span></li>
          ))}</ol></> : null}
        <p {...e(7, 'bv-cifras')}>{com.personas ? <span><b>{num(com.personas)}</b> personas en los servidores</span> : null}
          {ligas.length ? <span><b>{ligas.length}</b> ligas de los servidores</span> : null}</p>
      </div>
    ),
  };

  const paginas = [
    { id: 'liga', sello: 'TEMPORADA ' + String(liga.temp || '').replace(/^T/i, '') + ' · EN JUEGO', titulo: <><span>LIGA GLOBAL</span><span>DE FREESTYLE</span></>,
      texto: 'El ranking de los servidores de freestyle de Discord. Juega en el tuyo, sube en la tabla y gana tu carta.',
      extra: svs.length ? (
        <div className="bv-svs">
          <span className="bv-svs-l">{svs.slice(0, 9).map((s) => <img key={s} alt={nombreSv(s)} title={nombreSv(s)} src={liga.logo(s)} />)}</span>
          <small>{liga.d.gente ? <><b>{num(liga.d.gente)}</b> en el ranking · </> : null}<b>{svs.length}</b> servidores · <b>{num(liga.d.eventos || 0)}</b> eventos</small>
        </div>
      ) : null },
    { id: 'cartas', sello: 'TU CARTA', titulo: 'Cuatro cartas, una por lo que haces',
      texto: 'Se dibujan con tu foto y tu bandera, y se ponen al día solas cada vez que juegas.',
      puntos: [['tarjetas', 'La de Servidor sale apenas te verificas'], ['pase', 'La de Temporada, con el nivel 1 del Pase'], ['ranking', 'La Competitiva y la de País, jugando']] },
    { id: 'eventos', sello: 'EVENTOS', titulo: 'Todos los eventos, en un solo calendario',
      texto: 'Los de todos los servidores de la Liga, con su hora en la tuya. Y mientras se juegan, la llave en vivo.',
      puntos: [['campana', 'La campana te avisa cuando anuncian uno'], ['micro', 'El bot cuenta cada batalla en el chat de su servidor'], ['moneda', 'Votas y apuestas quién gana cada cruce']] },
    { id: 'ranking', sello: 'RANKING', titulo: 'Cada batalla suma',
      texto: 'Tus puntos de todos los servidores, en una sola tabla. Ocho rangos, de SSS a E.',
      puntos: [['ranking', 'Temporada, Competitivo, Duelos, Países y Crews'], ['copa', 'Los mejores clasifican al cierre de la temporada'], ['perfil', 'Tu perfil con tus números y tus rivales']] },
    { id: 'pase', sello: 'PASE Y TIENDA', titulo: 'Tareas, niveles y premios',
      texto: 'El Pase de rapero tiene 30 niveles por temporada: subes con las Tareas del día, de la semana y de la temporada.',
      puntos: [['pase', 'Cada nivel trae un premio para tu perfil'], ['tienda', 'Puntos de Tienda para apostar y cazar cabezas'], ['fuego', 'Tu racha de días y tu nivel en la Liga']] },
    { id: 'gente', sello: 'COMUNIDAD', titulo: 'Tu crew, tus ligas, tu gente',
      texto: 'Arma tu crew o súmate a una, sigue las ligas de cada servidor y a los raperos que te gustan.',
      puntos: [['socios', 'Crews con sus propios tiers'], ['ligas', 'Las ligas de los servidores, fecha a fecha'], ['seguir', 'Sigue a quien quieras y entérate cuando gana']] },
  ];
  const ultima = pag >= PAGINAS.length - 1;

  return (
    <>
      <div className="bv-pista" ref={pista} tabIndex={-1}>
        {paginas.map((p, i) => (
          <Pagina key={p.id} {...p} i={i} vista={vistas.has(i)} primera={i === 0} tit={tit} visual={visuales[p.id]} />
        ))}
      </div>
      {/* 🔒 LA BARRA DE ABAJO NO SE MUEVE: Dlx, «que siempre aparezca la opción de UNIRME CON DISCORD o en otro momento» */}
      <div className="bv-barra">
        <nav className="bv-nav" aria-label="Páginas de la bienvenida">
          <button type="button" className="bv-fl izq" aria-label="Página anterior" disabled={pag === 0} onClick={() => ir(pag - 1)}><Ico n="flecha" t={20} /></button>
          <ol className="bv-puntos-nav">{PAGINAS.map(([id, n], i) => (
            <li key={id}><button type="button" className={i === pag ? 'on' : ''} aria-current={i === pag ? 'step' : undefined} onClick={() => ir(i)}>
              <i aria-hidden="true" /><span>{n}</span></button></li>
          ))}</ol>
          <button type="button" className={'bv-fl der' + (pag === 0 ? ' llama' : '')} aria-label="Página siguiente" disabled={ultima} onClick={() => ir(pag + 1)}><Ico n="flecha" t={20} /></button>
        </nav>
        <div className="bv-acc">
          <button type="button" className="bv-si" onClick={unirme}>
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d={DISCORD} /></svg>Unirme con Discord</button>
          <div className="bv-acc-2">
            <button type="button" className="bv-luego" onClick={() => cerrar('luego')}>En otro momento</button>
            <small className="bv-nota">Te sumamos a Discord Rap Español. Sólo vemos tu nombre y tu foto, nunca tu contraseña.</small>
          </div>
        </div>
      </div>
    </>
  );
}

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

  return (
    <div className={'bv' + (sale ? ' sale' : '')} role="dialog" aria-modal="true" aria-labelledby="bv-t">
      <style>{ESTILO}</style>
      <i className="bv-tape a" aria-hidden="true" /><i className="bv-tape b" aria-hidden="true" />
      {paso === 1 ? (
        <Paso1 liga={liga} unirme={unirme} cerrar={cerrar} tit={tit} />
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
