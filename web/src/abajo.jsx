// Lo de abajo del Inicio: Se busca, el Merchandising, el pie, la barra de abajo del celular, el menú ☰ y el visor de
// historias. Nació de docs/remake/reales.py y del prototipo (prototipo.js). El 30/09/2026 se fueron de acá la Tienda
// y los servidores (Dlx: «la TIENDA no debería estar ahí, debería estar merchandising» y «los servidores de la liga
// estando abajo es algo tonto porque ya están arriba»), y El Elegido se mudó a Encuestas.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { limpio, nuevaQue, num } from './liga.js';
import { Cara, Chevron, Compartir, Ico, Poster, Sec, accion, enlace, subirSiEsta } from './piezas.jsx';
import { Buscar, CaraDc, CaraH, MENU, QUE_ES } from './arriba.jsx';


// ── Se busca ──────────────────────────────────────────────────────────────────────────────────────


export function SeBusca({ liga, aca }) {
  const mw = liga.d.mw || {};
  const tira = useRef(null);
  if (!(mw.b || []).length) return null;
  const diario = mw.tipo === 'dia';
  const correr = (d) => { if (tira.current) tira.current.scrollBy({ left: d * tira.current.clientWidth * 0.8, behavior: 'smooth' }); };
  return (
    <Sec id="sebusca" titulo="Se busca" bajada="Los buscados del Most Wanted: si le ganás a uno en un evento, te llevás su recompensa." enlace={aca ? undefined : 'Most Wanted'} href={aca ? undefined : '#/ranking/mw'} extra="negra">
      <div className="mw-cab"><span>{mw.b.length} buscados {diario ? 'hoy' : 'esta semana'} · vencen {liga.dia(mw.fin)}</span>
        <span className="mw-fl"><button type="button" className="mw-b" aria-label="Anteriores" onClick={() => correr(-1)}>←</button>
          <button type="button" className="mw-b" aria-label="Siguientes" onClick={() => correr(1)}>→</button></span></div>
      <div className="mw-rail" ref={tira}>
        {mw.b.map((b) => <Poster key={b.k} liga={liga} b={b} />)}
        {(mw.ant || []).length ? <div className="mw-div"><span>{diario ? 'AYER' : 'LA SEMANA PASADA'}</span></div> : null}
        {(mw.ant || []).map((b) => <Poster key={'a' + b.k} liga={liga} b={b} />)}
        {(mw.caz || []).length ? (
          <article className="poster cazadores"><span className="p-t">CAZADORES</span>
            <ol>{mw.caz.slice(0, 5).map((c) => <li key={c.k}><Cara liga={liga} k={c.k} nombre={c.n} cls="mono-c" /><b>{limpio(c.n)}</b><em>{num(c.pts)}</em></li>)}</ol>
            <small>lo cobrado en la temporada</small></article>
        ) : null}
      </div>
      <p className="p-nota">Quien le gane, cobra en su Temporada y el 10 % en Puntos de Tienda.</p>
    </Sec>
  );
}

// ── el Merchandising: donde estaba la Tienda (Dlx, 30/09/2026), y con EJEMPLOS desde el 04/10/2026 (Dlx: «en
// mercancía creá ejemplos de lo que sería nuestra mercancía… con nosotros y nuestros socios… no venderemos nada
// todavía, pero sería un ejemplo»). Todo dice que es un ejemplo y que no está a la venta: no hay precio ni botón.
// 🧵 MÁS REALISTA DESDE EL 13/10/2026 (Dlx: «¿podés hacer que el merchandising tenga un estilo más realista?»). Eran
// siluetas planas, como pedía el remake (sin degradés ni sombras); eso es para la INTERFAZ, y una prenda sin volumen
// no se lee como ropa. Así que adentro del dibujo —y sólo ahí— hay luz y sombra: volumen a los costados, pliegues
// suaves, la trama de la tela por encima del estampado (así el logo parece impreso y no pegado), costuras, el cuello
// acanalado, la capucha y sus cordones, el bolsillo canguro, los gajos y el bordado de la gorra, y la sombra en el
// piso. Sigue siendo SVG: el color y el logo de cada socio salen del lobby, sin fotos ni archivos nuevos.
const oscuro = (hex) => {
  const h = String(hex || '#000').replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0);
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
};

// la luz, la trama y el desenfoque de los pliegues: uno por dibujo (los `id` no se pueden repetir en la página)
function Luz({ id, osc }) {
  // en una prenda oscura la sombra casi no se ve: manda la luz. En una clara, al revés
  const s = osc ? 0.42 : 0.24, l = osc ? 0.13 : 0.1;
  return (
    <defs>
      <linearGradient id={id + 'h'} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#000" stopOpacity={s} />
        <stop offset=".2" stopColor="#000" stopOpacity={s * 0.3} />
        <stop offset=".42" stopColor="#fff" stopOpacity={l} />
        <stop offset=".62" stopColor="#fff" stopOpacity="0" />
        <stop offset=".82" stopColor="#000" stopOpacity={s * 0.35} />
        <stop offset="1" stopColor="#000" stopOpacity={s * 1.1} />
      </linearGradient>
      <linearGradient id={id + 'v'} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity={l * 0.8} />
        <stop offset=".45" stopColor="#fff" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity={s * 0.55} />
      </linearGradient>
      <filter id={id + 't'} x="0" y="0" width="100%" height="100%">
        {/* ⚠️ apenas: con el doble se veía como lija en los colores claros (medido en la captura del 13/10/2026) */}
        <feTurbulence type="fractalNoise" baseFrequency="2.4" numOctaves="2" seed="7" />
        <feColorMatrix type="matrix" values={'0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.4 ' + (osc ? 0.3 : 0.24)} />
        <feComposite in2="SourceGraphic" operator="in" />
      </filter>
      <filter id={id + 'b'} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6" /></filter>
      {/* el estampado, redondo: los logos de Discord son cuadrados con fondo y pegados así parecían un papel */}
      <clipPath id={id + 'r'}><circle cx="100" cy="75" r="23" /></clipPath>
      <clipPath id={id + 'q'}><circle cx="100" cy="93" r="19" /></clipPath>
      <clipPath id={id + 'g'}><circle cx="99" cy="93" r="18" /></clipPath>
      <filter id={id + 'p'} x="-30%" y="-200%" width="160%" height="500%"><feGaussianBlur stdDeviation="3.2" /></filter>
    </defs>
  );
}

// lo que va arriba de la tela y del estampado, en este orden: trama, volumen y luz
function Encima({ id, d }) {
  return (
    <>
      <path d={d} fill="#000" filter={'url(#' + id + 't)'} />
      <path d={d} fill={'url(#' + id + 'h)'} />
      <path d={d} fill={'url(#' + id + 'v)'} />
    </>
  );
}

const REMERA = 'M84 26 Q100 38 116 26 L140 33 Q157 41 171 62 L156 85 L140 76 Q137 130 141 184 Q100 189 59 184 Q63 130 60 76 L44 85 L29 62 Q43 41 60 33 Z';
const BUZO = 'M78 34 Q100 46 122 34 L142 40 Q161 50 172 86 L167 150 L147 150 L144 98 Q142 140 145 181 Q100 187 55 181 Q58 140 56 98 L53 150 L33 150 L28 86 Q39 50 58 40 Z';

function Prenda({ tipo, color, logo, texto }) {
  const id = 'pr' + useId().replace(/[^a-z0-9]/gi, '');
  const osc = oscuro(color);
  const tinta = osc ? '#FFFFFF' : '#141414';
  const linea = osc ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.28)';
  const costura = osc ? 'rgba(255,255,255,.3)' : 'rgba(0,0,0,.32)';
  const piso = <ellipse cx="100" cy="190" rx="64" ry="5" fill="#000" opacity=".22" filter={'url(#' + id + 'p)'} />;
  const pliegue = (d, k) => <path key={k} d={d} fill="none" stroke="#000" strokeOpacity={osc ? 0.5 : 0.2} strokeWidth="3" strokeLinecap="round" filter={'url(#' + id + 'b)'} />;
  const brillo = (d, k) => <path key={k} d={d} fill="none" stroke="#fff" strokeOpacity={osc ? 0.12 : 0.35} strokeWidth="2" strokeLinecap="round" filter={'url(#' + id + 'b)'} />;
  if (tipo === 'gorra') {
    const COPA = 'M42 121 Q40 66 97 56 Q152 57 158 117 Q100 110 42 121 Z';
    return (
      <svg viewBox="0 0 200 200" role="img" aria-hidden="true">
        <Luz id={id} osc={osc} />
        <ellipse cx="112" cy="156" rx="78" ry="6" fill="#000" opacity=".22" filter={'url(#' + id + 'p)'} />
        <path d={COPA} fill={color} stroke={linea} strokeWidth="1.2" />
        {/* el bordado: el logo con su relieve, apenas corrido */}
        <circle cx="99.8" cy="94.2" r="19" fill="#000" opacity=".3" filter={'url(#' + id + 'b)'} />
        <image href={logo} x="81" y="75" width="36" height="36" preserveAspectRatio="xMidYMid slice" clipPath={'url(#' + id + 'g)'} />
        <circle cx="99" cy="93" r="16.6" fill="none" stroke={osc ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.4)'} strokeWidth=".9" strokeDasharray="1.6 1.2" />
        <Encima id={id} d={COPA} />
        {/* los gajos, el botón y los ojalitos */}
        <path d="M97 57 Q102 88 100 113 M73 63 Q64 90 67 116 M124 62 Q134 88 133 112" fill="none" stroke={costura} strokeWidth="1" strokeDasharray="2 1.6" />
        <circle cx="97" cy="57" r="5" fill={color} stroke={linea} strokeWidth="1" />
        <circle cx="97" cy="57" r="5" fill="#000" opacity=".18" />
        <circle cx="60" cy="84" r="1.6" fill="#000" opacity=".35" /><circle cx="138" cy="82" r="1.6" fill="#000" opacity=".35" />
        {/* la visera: arriba con luz, abajo en sombra */}
        <path d="M38 119 Q100 109 160 116 Q189 122 194 139 Q150 149 96 145 Q52 141 38 119 Z" fill={color} stroke={linea} strokeWidth="1.2" />
        <path d="M38 119 Q100 109 160 116 Q189 122 194 139 Q150 149 96 145 Q52 141 38 119 Z" fill={'url(#' + id + 'v)'} />
        <path d="M44 126 Q100 141 192 139 Q150 149 96 145 Q55 141 44 126 Z" fill="#000" opacity=".28" />
        <path d="M46 121 Q100 113 158 119 Q182 124 188 135" fill="none" stroke={costura} strokeWidth="1" strokeDasharray="2 1.6" />
        <path d="M52 124 Q100 117 156 123 Q178 127 183 136" fill="none" stroke={costura} strokeWidth="1" strokeDasharray="2 1.6" />
      </svg>
    );
  }
  if (tipo === 'buzo') {
    return (
      <svg viewBox="0 0 200 200" role="img" aria-hidden="true">
        <Luz id={id} osc={osc} />
        {piso}
        {/* la capucha, detrás del cuello, y lo de adentro en sombra */}
        <path d="M70 41 Q64 9 100 7 Q136 9 130 41 Q118 32 100 32 Q82 32 70 41 Z" fill={color} stroke={linea} strokeWidth="1.2" />
        <path d="M70 41 Q64 9 100 7 Q136 9 130 41 Q118 32 100 32 Q82 32 70 41 Z" fill="#000" opacity=".22" />
        <path d={BUZO} fill={color} stroke={linea} strokeWidth="1.2" strokeLinejoin="round" />
        <image href={logo} x="81" y="74" width="38" height="38" preserveAspectRatio="xMidYMid slice" clipPath={'url(#' + id + 'q)'} />
        {texto ? <text x="100" y="125" textAnchor="middle" fill={tinta} style={{ font: '900 9px Archivo, sans-serif', letterSpacing: '.05em' }}>{texto}</text> : null}
        <Encima id={id} d={BUZO} />
        <path d="M80 40 Q82 19 100 18 Q118 19 120 40 Q110 49 100 49 Q90 49 80 40 Z" fill="#000" opacity=".5" />
        {/* el bolsillo canguro, con su costura y su borde en sombra */}
        <path d="M70 138 L130 138 L138 170 L62 170 Z" fill="#000" opacity=".08" stroke={linea} strokeWidth="1" />
        <path d="M73 141 L127 141 L134 167 L66 167 Z" fill="none" stroke={costura} strokeWidth=".9" strokeDasharray="2 1.6" />
        <path d="M70 138 L62 170" fill="none" stroke="#000" strokeOpacity=".3" strokeWidth="2" filter={'url(#' + id + 'b)'} />
        <path d="M130 138 L138 170" fill="none" stroke="#000" strokeOpacity=".3" strokeWidth="2" filter={'url(#' + id + 'b)'} />
        {/* puños y cintura acanalados */}
        {[34, 36.5, 39, 41.5, 44, 46.5, 49, 51.5].map((x) => <line key={'a' + x} x1={x} y1="140" x2={x - 0.4} y2="150" stroke="#000" strokeOpacity=".16" strokeWidth=".8" />)}
        {[148.5, 151, 153.5, 156, 158.5, 161, 163.5, 166].map((x) => <line key={'b' + x} x1={x} y1="140" x2={x + 0.4} y2="150" stroke="#000" strokeOpacity=".16" strokeWidth=".8" />)}
        <path d="M33 140 L53 140 M147 140 L167 140 M56 172 Q100 177 144 172" fill="none" stroke={costura} strokeWidth=".9" strokeDasharray="2 1.6" />
        {Array.from({ length: 30 }, (_, i) => 57 + i * 2.95).map((x) => <line key={'c' + x} x1={x} y1="173" x2={x} y2="183" stroke="#000" strokeOpacity=".14" strokeWidth=".8" />)}
        {/* los cordones con sus puntas */}
        <path d="M92 48 Q90 58 91 68" fill="none" stroke="#EDEDED" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M108 48 Q110 58 109 70" fill="none" stroke="#EDEDED" strokeWidth="2.2" strokeLinecap="round" />
        <rect x="89.6" y="66" width="2.8" height="6" rx="1" fill="#9A9A96" /><rect x="107.6" y="68" width="2.8" height="6" rx="1" fill="#9A9A96" />
        {[pliegue('M60 104 Q66 124 62 150', 1), pliegue('M140 104 Q134 124 138 150', 2), pliegue('M44 96 Q40 118 42 138', 3), pliegue('M156 96 Q160 118 158 138', 4)]}
        {[brillo('M84 52 Q92 60 90 72', 5), brillo('M47 92 Q45 112 47 130', 6)]}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 200 200" role="img" aria-hidden="true">
      <Luz id={id} osc={osc} />
      {piso}
      <path d={REMERA} fill={color} stroke={linea} strokeWidth="1.2" strokeLinejoin="round" />
      <image href={logo} x="77" y="52" width="46" height="46" preserveAspectRatio="xMidYMid slice" clipPath={'url(#' + id + 'r)'} />
      {texto ? <text x="100" y="114" textAnchor="middle" fill={tinta} style={{ font: '900 10px Archivo, sans-serif', letterSpacing: '.08em' }}>{texto}</text> : null}
      <Encima id={id} d={REMERA} />
      {/* el cuello acanalado, y adentro la espalda en sombra */}
      <path d="M86 27 Q100 21 114 27 Q100 36 86 27 Z" fill="#000" opacity=".45" />
      <path d="M82 25 Q100 42 118 25 L114 27 Q100 37 86 27 Z" fill={color} stroke={linea} strokeWidth="1" />
      <path d="M82 25 Q100 42 118 25 L114 27 Q100 37 86 27 Z" fill="#000" opacity=".14" />
      {/* las costuras: mangas, hombros y ruedo */}
      <path d="M32 65 L46 82 M168 65 L154 82 M61 179 Q100 183 139 179 M60 34 Q63 52 60 74 M140 34 Q137 52 140 74" fill="none" stroke={costura} strokeWidth=".9" strokeDasharray="2 1.6" />
      {[pliegue('M64 80 Q76 96 72 118', 1), pliegue('M136 80 Q124 96 128 118', 2), pliegue('M82 150 Q90 168 86 182', 3), pliegue('M118 152 Q111 168 115 182', 4)]}
      {[brillo('M70 104 Q78 128 74 160', 5), brillo('M120 60 Q132 70 130 86', 6)]}
    </svg>
  );
}

// la plancha de stickers: troquelados, con su borde blanco, su sombra y un brillo, cada uno un poco girado
function Stickers({ logos }) {
  const id = 'st' + useId().replace(/[^a-z0-9]/gi, '');
  const pos = [[64, 62, -8], [136, 64, 6], [100, 102, -3], [62, 140, 7], [138, 138, -6]];
  return (
    <svg viewBox="0 0 200 200" role="img" aria-hidden="true">
      <defs>
        {pos.map(([x, y], i) => <clipPath key={i} id={id + 'c' + i}><circle cx={x} cy={y} r="25" /></clipPath>)}
        <filter id={id + 's'} x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.8" floodOpacity=".3" /></filter>
        <linearGradient id={id + 'g'} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".55" />
          <stop offset=".45" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="20" y="22" width="160" height="160" rx="3" fill="#FAFAF8" filter={'url(#' + id + 's)'} />
      <rect x="26" y="28" width="148" height="148" rx="2" fill="none" stroke="rgba(0,0,0,.12)" strokeWidth=".8" strokeDasharray="3 2" />
      {pos.map(([x, y, r], i) => (logos[i] ? (
        <g key={i} transform={'rotate(' + r + ' ' + x + ' ' + y + ')'}>
          <circle cx={x} cy={y} r="29" fill="#FFFFFF" filter={'url(#' + id + 's)'} />
          <image href={logos[i]} x={x - 25} y={y - 25} width="50" height="50" clipPath={'url(#' + id + 'c' + i + ')'} preserveAspectRatio="xMidYMid slice" />
          <circle cx={x} cy={y} r="29" fill={'url(#' + id + 'g)'} />
        </g>
      ) : null))}
    </svg>
  );
}

export function Merch({ liga }) {
  // los socios: los servidores de la Liga que vienen en el lobby, con su color y su logo
  const svs = liga ? Object.values(liga.svs || {}).filter((s) => s.color && s.sv) : [];
  const socios = svs.filter((s) => s.logo).slice(0, 4);
  const items = [
    ['remera', 'Remera Under Legends', 'Negra, con el logo al pecho', <Prenda tipo="remera" color="#141414" logo="/ul.png" />],
    ['buzo', 'Buzo Liga Global', 'Magenta, con el logo y «LIGA GLOBAL»', <Prenda tipo="buzo" color="#E41373" logo="/ul.png" texto="LIGA GLOBAL" />],
    ['gorra', 'Gorra UL', 'Blanca, con el logo bordado', <Prenda tipo="gorra" color="#F2F2F2" logo="/ul.png" />],
    ...socios.map((s) => ['sv-' + s.sv, 'Remera ' + (s.sigla || s.sv), s.nombre + ', socio de la Liga',
      <Prenda tipo="remera" color={s.color} logo={liga.logo(s.sv)} texto={String(s.sigla || s.sv).toUpperCase()} />]),
    ...(svs.length ? [['stickers', 'Stickers de la Liga', 'Los logos de los socios',
      <Stickers logos={['/ul.png', ...svs.filter((s) => s.logo).map((s) => liga.logo(s.sv))]} />]] : []),
  ];
  return (
    <Sec id="merch" titulo="Merchandising">
      {/* el texto en UN span: la nota es flex, y cada pedazo suelto quedaba como un ítem con su hueco («nada : cuando») */}
      <p className="mq-nota"><span className="tag-pronto">EJEMPLOS</span><span>Así podría ser la ropa de Under Legends y de sus socios. <b>Todavía no se vende nada</b>: cuando salga, la ves acá primero.</span></p>
      <div className="mq-rail">
        {items.map(([k, n, d, dibujo]) => (
          <article className="mq" key={k}>
            <div className="mq-img">{dibujo}</div>
            <b>{n}</b>
            <small>{d}</small>
            <span className="mq-ej">EJEMPLO · NO ESTÁ A LA VENTA</span>
          </article>
        ))}
      </div>
    </Sec>
  );
}

// ── el pie ────────────────────────────────────────────────────────────────────────────────────────
// sin «10.143 personas en 5 servidores · 346 verificados»: es lo mismo que La Liga en números, justo arriba (Dlx,
// 01/10/2026: «hay info que se repite»)
export function Pie({ liga }) {
  return (
    <footer className="pie negra">
      <div className="pie-marca"><img alt="" src="/ul.png" /><span>UNDER LEGENDS<small>LIGA GLOBAL · {liga.tempLarga}</small></span></div>
      <nav><a href="#/guia">Guía</a><a href="#/publicaciones">Publicaciones</a><a href="#/tienda">Tienda</a><a href="#/socios">Socios</a>
        <a href="#/cambios">Cambios</a><a href="/privacidad.html">Privacidad</a><a href="/terminos.html">Términos</a></nav>
      {/* 🗓️ desde cuándo existe (Dlx, 07/10/2026: «cuándo fue creado el proyecto… el mes, el día y el año»): el primer
          commit del proyecto, «Estado inicial: generadores andando en Windows», 29/07/2026 a las 2:04 AM ET */}
      <small>Los datos se actualizan solos cada media hora.<br />Creado el 29 de julio de 2026.</small>
    </footer>
  );
}

// ── ⬆️ LA FLECHA PARA SUBIR (Dlx, 13/10/2026: «poner la flecha negra abajo a la derecha, en la esquina inferior
// derecha, que te lleve hacia arriba de todo»). Aparece cuando ya bajaste más de una pantalla y media; en el celular va
// arriba de la barra de abajo. No en el Inicio: ahí la barra «IR A» ya trae su «volver arriba»
export function Subir() {
  const [ver, setVer] = useState(false);
  useEffect(() => {
    const mirar = () => setVer(window.scrollY > window.innerHeight * 1.5);
    window.addEventListener('scroll', mirar, { passive: true });
    mirar();
    return () => window.removeEventListener('scroll', mirar);
  }, []);
  const subir = () => {
    let quieto = false;
    try { quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { quieto = false; }
    window.scrollTo({ top: 0, behavior: quieto ? 'auto' : 'smooth' });
  };
  return (
    <button type="button" className={'subir' + (ver ? ' ver' : '')} aria-label="Volver arriba de todo" title="Volver arriba"
      tabIndex={ver ? 0 : -1} aria-hidden={!ver} onClick={subir}><Ico n="flecha" t={22} /></button>
  );
}

// ── la barra de abajo del celular y el menú ☰ ─────────────────────────────────────────────────────
export function Tabbar({ liga, dc, pagina = '' }) {
  // 🔑 UNA TIRA QUE SE DESLIZA, con todas las secciones como en la compu. Dlx, 28/09/2026: «en el PC será normal pero
  // en celular haz que se deslice para ver más opciones», y el 02/10, al ver cinco fijas: «pensé que habíamos acordado
  // que lo de abajo sería en una tira como está en el ordenador». Las mismas de `MENU` (la cabecera de la compu): una
  // sección nueva entra en las dos. Y tu cuenta, «Yo», fija a la derecha y fuera de la tira (02/10: «el engranaje en
  // vez de la cuenta»), como el «Tú» de Discord
  const yo = liga && liga.yo;
  const cara = yo ? <Cara liga={liga} k={yo.k} nombre={yo.n} cls="tb-cara" /> : (dc ? <CaraDc dc={dc} cls="tb-cara" /> : null);
  return (
    <nav className="tabbar" aria-label="Secciones">
      <div className="tb-tira">
        {MENU.map(([n, r]) => {
          const k = r.replace(/^#\/?/, '') || 'inicio';
          // la de la página que se ve: el Inicio sin ruta, y las que dibuja el Inicio nuevo por su nombre (el Ranking)
          return <a key={k} href={r} onClick={subirSiEsta(r)} className={(k === 'inicio' ? !pagina : pagina === k) ? 'on' : ''}><Ico n={k} t={22} /><span>{n}</span></a>;
        })}
      </div>
      <a href="#/cuenta" className={'tb-yo' + (pagina === 'cuenta' ? ' on' : '')} aria-label="Mi cuenta">{cara || <Ico n="yo" t={22} />}<span>Yo</span></a>
    </nav>
  );
}

export function Menu({ liga, abierto, onCerrar, tema, onTema, temaSv }) {
  // ⚠️ el foco entra al abrirlo y vuelve al ☰ al cerrarlo: con el teclado se quedaba atrás, en la página tapada
  // (revisión del 03/10/2026). Aparte del efecto del Escape: `onCerrar` cambia en cada vuelta de App
  const cerrarB = useRef(null);
  useEffect(() => {
    if (!abierto) return undefined;
    const t = setTimeout(() => { if (cerrarB.current) cerrarB.current.focus(); }, 0);
    return () => {
      clearTimeout(t);
      const h = document.getElementById('inicio-nuevo');
      const b = h && h.shadowRoot ? h.shadowRoot.querySelector('.hamb') : null;
      if (b) b.focus();
    };
  }, [abierto]);
  useEffect(() => {
    if (!abierto) return undefined;
    const k = (e) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [abierto, onCerrar]);
  if (!abierto) return null;
  // el changelog, con su «NUEVO» si hay una versión que no viste (lo que app.js ya cargó para el punto del menú)
  const C = window.CAMBIOS;
  const ult = Array.isArray(C) && C[0] ? C[0].version : '';
  const nuevo = !!ult && nuevaQue(ult, window.CAMBIOS_VISTO);
  const cambios = (
    <div className="x-fila"><span>Changelog<small>Lo nuevo de la página{ult ? ', hasta la v' + ult : ''}.</small></span>
      <a className="btn negro chico" href="#/cambios" onClick={onCerrar}>{nuevo ? <em className="x-nuevo">NUEVO</em> : null}Ver</a></div>
  );
  return (
    <div className="x-menu" onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="x-caja" role="dialog" aria-modal="true" aria-label="Menú">
        <div className="x-caja-cab"><b>MENÚ</b><button className="btn-ico x-cerrar" type="button" aria-label="Cerrar el menú" onClick={onCerrar} ref={cerrarB}><Ico n="cerrar" t={22} /></button></div>
        {/* en el celular el buscador no entra arriba: vive acá */}
        {liga ? <div className="x-busca"><Buscar liga={liga} onIr={onCerrar} /></div> : null}
        <nav className="x-lista" aria-label="Secciones">{MENU.slice(1).map(([n, r]) => (
          <a key={n} href={r} onClick={onCerrar}><span>{n}{QUE_ES[r] ? <small>{QUE_ES[r]}</small> : null}</span><Ico n="flecha" t={20} /></a>))}</nav>
        <div className="x-aj">
          <span className="x-aj-t">AJUSTES</span>
          <div className="x-fila"><span>Tema</span>
            <div className="x-seg" role="group" aria-label="Tema">
              <button type="button" aria-pressed={tema === 'clara'} onClick={() => onTema('clara')}>Clara</button>
              <button type="button" aria-pressed={tema === 'noche'} onClick={() => onTema('noche')}>Noche</button>
            </div></div>
          {/* 🎨 y los de los servidores (13/10/2026): están en Apariencia, con la vista previa de cada uno */}
          <div className="x-fila"><span>Colores de un servidor<small>{temaSv ? 'Ahora: ' + temaSv + '. ' : ''}Encima de Clara o de Noche, los colores de un servidor de la Liga.</small></span>
            <a className="btn negro chico" href="#/ajustes/apariencia" onClick={onCerrar}>Elegir</a></div>
          <div className="x-fila"><span>Hora, zona y más<small>El formato de la hora, tu zona y menos animaciones.</small></span>
            <a className="btn negro chico" href="#/ajustes/hora" onClick={onCerrar}>Abrir</a></div>
          {cambios}
          <div className="x-fila"><span>Mi cuenta<small>Entrar con Discord, tu foto, tus redes y tus avisos.</small></span>
            <button type="button" className="btn negro chico" onClick={() => { onCerrar(); accion.cuenta(); }}>Abrir</button></div>
        </div>
      </div>
    </div>
  );
}

// ── el visor de historias, como las de Instagram ──────────────────────────────────────────────────
export function Visor({ liga, grupos, abierto, onCerrar, onVisto, vistos = {}, raiz }) {
  // 🔴 el grupo abierto se sigue por su ID, no por su lugar en la fila: los datos se rehacen cada minuto y, si
  // empezaba un evento en vivo con el visor abierto, su círculo entraba primero y corría a todos un lugar (saltabas a
  // otra historia a mitad). Y el reloj de cada historia volvía a cero en cada refresco (revisión del 01/10/2026)
  // 🔴 LO VISTO SE CUENTA HISTORIA POR HISTORIA, Y SE SALTEA. Dlx, 02/10/2026: «aún sigo viendo las historias que ya
  // he visto… no skipea las que ya vi y no me muestra lo más reciente PRIMERO». Antes se guardaba UNA marca por
  // círculo (la hora de lo último visto): con algo nuevo, el círculo entero volvía a verde y abría donde caía. Ahora
  // cada historia tiene su `id` (ver `gruposHistorias`) y al abrir se arranca en la primera que no viste; si ya viste
  // todas, desde la primera. Al terminar, el siguiente círculo con algo sin ver.
  // 🔁 Y DESDE EL 04/10/2026, COMO INSTAGRAM (Dlx: «el orden… está invertido, fijate cómo lo hace Instagram»): el
  // círculo trae TODAS sus historias, de la más vieja a la más nueva, con las barritas de las ya vistas llenas, y abre
  // en la primera que no viste. Lo visto no se vuelve a pasar solo, pero se puede volver con «anterior»
  const pend = (g) => g.slides.filter((s) => !vistos[s.id]).map((s) => s.id);
  const lista = (g) => (g ? g.slides.map((s) => s.id) : []);
  const inicio = (g) => { if (!g) return 0; const k = g.slides.findIndex((s) => !vistos[s.id]); return k < 0 ? 0 : k; };
  // la lista de cada círculo se fija al abrirlo: marcar como vista la que estás mirando no la saca de abajo del dedo
  const [abre, setAbre] = useState(() => ({ gid: (grupos[abierto] || {}).id, ids: lista(grupos[abierto]) }));
  const [si, setSi] = useState(() => inicio(grupos[abierto]));
  const [avance, setAvance] = useState(0);
  const pausa = useRef(false);
  const cerrarB = useRef(null);
  const DUR = 5000;
  const a = (i) => { setAbre({ gid: grupos[i].id, ids: lista(grupos[i]) }); setSi(inicio(grupos[i])); setAvance(0); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (grupos[abierto]) a(abierto); }, [abierto]);
  const gid = abre.gid;
  const gi = grupos.findIndex((x) => x.id === gid);
  const g = gi >= 0 ? grupos[gi] : null;
  // las historias de la lista que siguen existiendo (los datos se rehacen cada minuto: una pudo irse)
  const ids = g ? abre.ids.filter((id) => g.slides.some((s) => s.id === id)) : [];
  const hay = !!g && ids.length > 0;
  const idAct = ids[Math.min(si, ids.length - 1)];
  // vista apenas se muestra
  useEffect(() => { if (idAct) onVisto(idAct); }, [idAct, onVisto]);
  // si su grupo desaparece (el evento en vivo terminó), el visor se cierra en vez de quedar abierto y vacío
  useEffect(() => { if (!hay) onCerrar(); }, [hay, onCerrar]);
  // el foco entra al visor: con el teclado, Escape y las flechas ya andaban, pero el Tab seguía en la página de atrás
  useEffect(() => { if (cerrarB.current) cerrarB.current.focus({ preventScroll: true }); }, []);
  const siguiente = () => {
    if (!g) return;
    if (si < ids.length - 1) { setSi(si + 1); setAvance(0); return; }
    // el próximo círculo con algo sin ver; si no queda ninguno, se cierra
    const j = grupos.findIndex((x, k) => k > gi && pend(x).length);
    if (j >= 0) a(j); else onCerrar();
  };
  const anterior = () => {
    if (!g) return;
    if (si > 0) { setSi(si - 1); setAvance(0); } else if (gi > 0) a(gi - 1);
  };
  // el reloj de cada historia: un solo requestAnimationFrame por historia, y la que sigue la pide la última versión
  // de `siguiente` (un ref), no la de cuando arrancó el reloj
  const sig = useRef(siguiente);
  const ant = useRef(anterior);
  sig.current = siguiente;
  ant.current = anterior;
  useEffect(() => {
    if (!g) return undefined;
    let raf = 0; let antes = performance.now(); let acum = 0;
    const tick = (t) => {
      if (!pausa.current) acum += t - antes;
      antes = t;
      setAvance(acum);
      if (acum >= DUR) { sig.current(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [gid, si, hay]);
  useEffect(() => {
    if (!hay) return undefined;
    const k = (e) => { if (e.key === 'Escape') onCerrar(); if (e.key === 'ArrowRight') sig.current(); if (e.key === 'ArrowLeft') ant.current(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [hay, onCerrar]);
  const ir = useMemo(() => (d) => {
    if (!d) return;
    onCerrar();
    if (d.carta) accion.carta(d.carta, d.cual);
    else if (d.perfil) accion.perfil(d.perfil);
    else if (d.llave) accion.llave(d.llave);
    else if (d.ruta) location.hash = d.ruta;
    else if (d.link) window.open(d.link, '_blank', 'noopener');
    else if (d.ancla) accion.ir(d.ancla);
  }, [onCerrar, raiz]);
  if (!hay) return null;
  const s = g.slides.find((x) => x.id === idAct) || g.slides[0];
  // lo que se comparte de una historia: la carta (la imagen), la llave o el perfil al que lleva
  const d = s.ir || {};
  const compartir = d.carta ? liga.cartaUrl(d.carta, d.cual || 'temporada') || enlace('#/r/' + encodeURIComponent(d.carta))
    : d.llave ? enlace('#/llave/' + d.llave) : d.perfil ? enlace('#/r/' + encodeURIComponent(d.perfil)) : null;
  const perfil = g.tipo === 'gente' ? '#/r/' + encodeURIComponent(g.k)
    : g.tipo === 'pais' ? '#/pais/' + g.cc
      : g.tipo === 'crew' ? '#/crew/' + encodeURIComponent(g.crew.clave || g.crew.crew)
        : g.tipo === 'sv' ? '#/sv/' + encodeURIComponent(g.nom) : g.tipo === 'liga' ? '#/ranking' : '#/eventos';
  const circulo = g.tipo === 'gente' ? <CaraH liga={liga} k={g.k} nombre={g.nom} cc={g.cc} />
    : g.tipo === 'liga' ? <span className="h-c"><img alt="" src="/ul.png" /></span>
    : g.tipo === 'pais' ? <span className="h-c bandera"><img alt="" src={'/banderas/g/' + g.cc + '.webp'} /></span>
      : g.tipo === 'crew' ? (g.crew.logo ? <span className="h-c"><img alt="" src={'/' + g.crew.logo} /></span> : <span className="h-c mono">{g.nom.slice(0, 2).toUpperCase()}</span>)
        : <span className="h-c"><img alt="" src={g.logo} /></span>;
  return (
    <div className="hv-ov" onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="hv-box" role="dialog" aria-modal="true" aria-label="Historias"
        onPointerDown={() => { pausa.current = true; }} onPointerUp={() => { pausa.current = false; }} onPointerLeave={() => { pausa.current = false; }}>
        <div className="hv-bars">{ids.map((id, i) => <i key={id} className={i < si ? 'hecho' : ''}><b style={{ width: (i === si ? Math.min(100, avance / DUR * 100) : 0) + '%' }} /></i>)}</div>
        <div className="hv-cab">
          <a className="hv-quien" href={perfil} onClick={onCerrar} aria-label={'Ir al perfil de ' + g.nombre}>{circulo}<span><b>{g.nombre}</b><small>{s.cuando || ''}</small></span></a>
          {compartir ? <Compartir cls="hv-comp" url={compartir} texto={'En la Liga Global: ' + g.nombre} etiqueta="" /> : null}
          <button type="button" className="hv-x" aria-label="Cerrar las historias" onClick={onCerrar} ref={cerrarB}><Ico n="cerrar" t={22} /></button></div>
        <div className="hv-cuerpo"><div className="st"><span className="st-tag">{s.tag}</span>{s.cuerpo}</div></div>
        {s.cta && s.ir && Object.values(s.ir).some(Boolean) ? <button type="button" className="btn verde hv-cta" onClick={() => ir(s.ir)}>{s.cta}</button> : null}
        <button type="button" className="hv-zona izq" aria-label="Anterior" onClick={anterior} />
        <button type="button" className="hv-zona der" aria-label="Siguiente" onClick={siguiente} />
      </div>
      <button type="button" className="hv-fl izq" aria-label="Historia anterior" onClick={anterior}><Chevron /></button>
      <button type="button" className="hv-fl der" aria-label="Historia siguiente" onClick={siguiente}><Chevron /></button>
    </div>
  );
}
