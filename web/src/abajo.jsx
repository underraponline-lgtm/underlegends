// Lo de abajo del Inicio: Se busca, el Merchandising, el pie, la barra de abajo del celular, el menú ☰ y el visor de
// historias. Nació de docs/remake/reales.py y del prototipo (prototipo.js). El 30/09/2026 se fueron de acá la Tienda
// y los servidores (Dlx: «la TIENDA no debería estar ahí, debería estar merchandising» y «los servidores de la liga
// estando abajo es algo tonto porque ya están arriba»), y El Elegido se mudó a Encuestas.
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ksDe, limpio, nuevaQue, num, quienMira, siglaDe, utc } from './liga.js';
import { Alguien, Cara, Chevron, Compartir, Ico, Poster, Sec, accion, enlace, https, promoAbierta, subirSiEsta } from './piezas.jsx';
import { RED_NOMBRE, RED_SVG } from './redes_ico.jsx';
import { Buscar, CaraDc, CaraH, CrewCirculo, GRUPOS, Orbe, QUE_ES, escenaDe, llaveEnVivo, momentosLlave, pubNuevas } from './arriba.jsx';
import { abrirVideo } from './video.jsx';
import { YoMenu } from './yomenu.jsx';
import { usePresencia } from './anima.js';
import { useRacha } from './racha.js';
import { abrirPrimero, useDrops } from './drops.jsx';
import { createPortal } from 'react-dom';
import { algoTapa, capaFija, seVe } from './tapa.js';
import { miReaccion, reaccionesDe, useAplausos } from './aplausos.js';
import { comentar, delHilo, useComentarios } from './comentarios.jsx';
import { ComentariosFlotantes } from './flotantes.jsx';
import { Carita, LU_REAC } from './medio.jsx';
import { usePase } from './pase.js';
import { nombreSv } from './temas.js';


// ── Se busca ──────────────────────────────────────────────────────────────────────────────────────


export function SeBusca({ liga, aca }) {
  const mw = liga.d.mw || {};
  const tira = useRef(null);
  if (!(mw.b || []).length) return null;
  const diario = mw.tipo === 'dia';
  const correr = (d) => { if (tira.current) tira.current.scrollBy({ left: d * tira.current.clientWidth * 0.8, behavior: 'smooth' }); };
  return (
    <Sec id="sebusca" titulo="Se busca" bajada="Los buscados del Most Wanted: si le ganas a uno en un evento, te llevas su recompensa." enlace={aca ? undefined : 'Most Wanted'} href={aca ? undefined : '#/ranking/mw'} extra="negra">
      <div className="mw-cab"><span>{mw.b.length} buscados {diario ? 'hoy' : 'esta semana'} · vencen {liga.dia(mw.fin)}</span>
        <span className="mw-fl"><button type="button" className="mw-b" aria-label="Anteriores" onClick={() => correr(-1)}>←</button>
          <button type="button" className="mw-b" aria-label="Siguientes" onClick={() => correr(1)}>→</button></span></div>
      <div className="mw-rail" ref={tira}>
        {/* 🔑 un buscado puede venir sin clave (`k: ''`, quien no está en `gente`: Refran, jazi…): por su nombre, o tres
            hermanos compartían la key 'a' (18/11/2026) */}
        {mw.b.map((b) => <Poster key={b.k || 'n:' + b.n} liga={liga} b={b} />)}
        {(mw.ant || []).length ? <div className="mw-div"><span>{diario ? 'AYER' : 'LA SEMANA PASADA'}</span></div> : null}
        {(mw.ant || []).map((b) => <Poster key={'a' + (b.k || 'n:' + b.n)} liga={liga} b={b} />)}
        {(mw.caz || []).length ? (
          <article className="poster cazadores"><span className="p-t">CAZADORES</span>
            <ol>{mw.caz.slice(0, 5).map((c) => <li key={c.k}><Cara liga={liga} k={c.k} nombre={c.n} cls="mono-c" /><b><Alguien liga={liga} nombre={c.n} k={c.k} cara={false} /></b><em>{num(c.pts)}</em></li>)}</ol>
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

export function Prenda({ tipo, color, logo, texto }) {
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
export function Stickers({ logos }) {
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

// 🛍️ CORTO, Y DE LA TIENDA (18/11/2026, Dlx: «necesito que merchandising sea algo corto de la tienda»). Era la remera
// grande con los colores de cada socio (la opción A del 13/11): ocupaba una pantalla entera para algo que todavía no se
// vende, y la Tienda ya abrió. Ahora es una franja: lo que sí se consigue con los Puntos de Tienda, la ropa en chico con
// «pronto» y el botón a la Tienda. La ropa sigue siendo la misma (`Prenda`, `Stickers`); el catálogo NO se pide acá:
// sería un pedido al objeto por cada visita al Inicio
export function Merch({ liga }) {
  const svs = liga ? Object.values(liga.svs || {}).filter((s) => s.color && s.sv && s.logo) : [];
  const ropa = [
    { k: 'remera', n: 'Remera UL', dib: <Prenda tipo="remera" color="#141414" logo="/ul.png" /> },
    { k: 'buzo', n: 'Buzo Liga Global', dib: <Prenda tipo="buzo" color="#E41373" logo="/ul.png" texto="LIGA GLOBAL" /> },
    { k: 'gorra', n: 'Gorra UL', dib: <Prenda tipo="gorra" color="#F2F2F2" logo="/ul.png" /> },
    svs.length ? { k: 'stickers', n: 'Stickers', dib: <Stickers logos={['/ul.png', ...svs.map((s) => liga.logo(s.sv))]} /> } : null,
  ].filter(Boolean);
  return (
    <Sec id="merch" titulo="La Tienda" extra="negra mqb">
      <div className="mqb-g">
        <div className="mqb-t">
          <p className="mqb-p">Marcos, efectos, fondos y TAGs para tu perfil y tus tarjetas, con tus <b>Puntos de Tienda</b>.</p>
          <p className="mqb-pronto"><span className="tag-pronto">PRONTO</span><span>La ropa de Under Legends y de sus socios.</span></p>
          <a className="btn mqb-b" href="#/tienda">Ir a la Tienda <Ico n="flecha" t={16} /></a>
        </div>
        <ul className="mqb-ropa" aria-label="La ropa, pronto">
          {ropa.map((c) => <li key={c.k}><div className="mqb-img">{c.dib}</div><span>{c.n}</span></li>)}
        </ul>
      </div>
    </Sec>
  );
}

// ── el pie ────────────────────────────────────────────────────────────────────────────────────────
// sin «10.143 personas en 5 servidores · 346 verificados»: es lo mismo que La Liga en números, justo arriba (Dlx,
// 01/10/2026: «hay info que se repite»)
// 🧱 REHECHO EL 13/11/2026 (Dlx, a la maqueta de tres: «La C diría pero menos cosas… es muy grande esa parte de abajo y
// asegúrate que todo tenga su ícono de verdad… de las redes sociales»): UNA fila con la marca, los links y las redes de
// Under Legends con su ícono (`RED_SVG`), y la temporada como el borde de arriba del pie —se llena con los días— y en la
// línea de la marca («Temporada 1 · día 53 de 101»). Sin las columnas ni los números grandes de la maqueta, y del mismo
// alto que el de antes: medido, una franja aparte lo subía de 94 a 139 px a 1333 de ancho
const DIA_MS = 864e5;
const fechaLocal = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? new Date(+m[1], m[2] - 1, +m[3]) : null; };
function diaDeTemporada(fase, ahora = new Date()) {
  const a = fechaLocal(fase && fase.arranca), b = fechaLocal(fase && fase.termina);
  if (!a || !b || b < a) return null;
  const total = Math.round((b - a) / DIA_MS) + 1;
  const dia = Math.floor((ahora - a) / DIA_MS) + 1;
  if (dia < 1 || dia > total) return null;
  return { dia, total, fin: b };
}
const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function Pie({ liga }) {
  const T = diaDeTemporada(liga.d && liga.d.fase);
  const redes = ((liga.d && liga.d.redes) || []).filter((r) => r && RED_SVG[r[0]] && https(r[1]));
  return (
    <footer className="pie negra pie2">
      {T ? <span className="pie2-reg" aria-hidden="true"><i style={{ width: (100 * T.dia / T.total).toFixed(1) + '%' }} /></span> : null}
      <div className="pie2-fila">
        {/* 🗓️ desde cuándo existe (Dlx, 07/10/2026: «cuándo fue creado el proyecto… el mes, el día y el año»): el primer
            commit del proyecto, «Estado inicial: generadores andando en Windows», 29/07/2026 a las 2:04 AM ET */}
        <div className="pie-marca"><img alt="" src="/ul.png" /><span>UNDER LEGENDS
          <small title={'Creado el 29 de julio de 2026' + (T ? ' · la temporada cierra el ' + T.fin.getDate() + ' ' + MES_CORTO[T.fin.getMonth()] : '')}>
            {T ? liga.tempLarga.toLowerCase().replace(/^t/, 'T') + ' · día ' + T.dia + ' de ' + T.total : 'Creado el 29 de julio de 2026'}</small></span></div>
        <nav><a href="#/guia">Guía</a><a href="#/publicaciones">Publicaciones</a><a href="#/tienda">Tienda</a><a href="#/socios">Socios</a>
          <a href="#/cambios">Cambios</a><a href="/privacidad.html">Privacidad</a><a href="/terminos.html">Términos</a></nav>
        {redes.length ? (
          <span className="pie2-redes">{redes.map(([r, u]) => (
            <a key={u} href={https(u)} target="_blank" rel="noopener noreferrer" title={RED_NOMBRE[r] || r} aria-label={RED_NOMBRE[r] || r}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">{RED_SVG[r]}</svg></a>))}</span>
        ) : null}
      </div>
    </footer>
  );
}

// ── ⬆️ LA FLECHA PARA SUBIR (Dlx, 13/10/2026: «poner la flecha negra abajo a la derecha, en la esquina inferior
// derecha, que te lleve hacia arriba de todo»). Aparece cuando ya bajaste más de una pantalla y media; en el celular va
// arriba de la barra de abajo. No en el Inicio: ahí la barra «IR A» ya trae su «volver arriba»
//
// 🔁 REHECHA (Dlx, 17/11/2026: «quiero que remakees esta flecha»). Era un cuadro negro con borde blanco, la sombra verde
// corrida y la flecha de «siguiente» girada. Ahora tiene la cara de los botones de la cabecera (el negro de `.btn-ico`,
// 4 px de radio), su propio ícono —la flecha contra una raya: hasta arriba de todo— y el borde le dice cuánto bajaste:
// la raya verde lo recorre de 0 a 100 % de la página. El borde se dibuja en SVG con `pathLength=100`, y el avance se
// escribe en el elemento (no en el estado) una vez por cuadro: bajar no vuelve a dibujar React
//
// 🧱 Y SE CORRE ARRIBA DE LO QUE ESTÉ PEGADO ABAJO. Medido al rehacerla: en el Ranking, «Tu lugar» va pegado abajo con un
// z-index más alto y la tapaba —en el celular entera, en la compu a medias—, y no se podía tocar. No era la única: la barra
// de la llave, el Guardar del Inventario y del perfil, y el aviso del panel del socio también se pegan abajo. En vez de
// correr cada una, la flecha mira cuál de esas está en su columna y sube lo justo para quedar 10 px arriba (`--subir-sube`)
const PIES = '.rk-lugar, .lk-barra, .ves-guardar, .iv9-guardar, .sp-toast-z, [data-pie-fijo]';
export function Subir() {
  const [ver, setVer] = useState(false);
  const yo = useRef(null);
  const va = useRef(null);
  useEffect(() => {
    let cuadro = 0;
    let quieto = 0;
    // cuánto tiene que subir para no quedar debajo de lo pegado abajo: sus medidas de base (`bottom`, `right`, ancho y
    // alto del estilo, que no cambian con lo que ya subió) contra cada barra visible que cae en su columna
    const sube = () => {
      const b = yo.current;
      if (!b) return 0;
      const cs = getComputedStyle(b);
      const H = window.innerHeight, W = window.innerWidth;
      const der = W - parseFloat(cs.right), izq = der - parseFloat(cs.width);
      const piso = H - parseFloat(cs.bottom), techo = piso - parseFloat(cs.height);
      let s = 0;
      const raiz = b.getRootNode();
      for (const el of raiz.querySelectorAll ? raiz.querySelectorAll(PIES) : []) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || r.top >= H || r.bottom <= 0 || r.left >= der || r.right <= izq) continue;
        if (r.top < piso + 10 && r.bottom > techo) s = Math.max(s, piso - r.top + 10);
      }
      return Math.round(s);
    };
    const mirar = () => {
      cuadro = 0;
      const d = document.documentElement;
      const alto = Math.max(1, d.scrollHeight - window.innerHeight);
      const p = Math.min(1, Math.max(0, (window.scrollY || d.scrollTop) / alto));
      if (va.current) va.current.style.strokeDashoffset = String(100 - p * 100);
      if (yo.current) yo.current.style.setProperty('--subir-sube', sube() + 'px');
      // ⬆️ apenas bajaste una pantalla y media no: a 0,6 de pantalla (Dlx, 18/10/2026: «que aparezca más antes»)
      setVer(window.scrollY > window.innerHeight * 0.6);
    };
    // las barras de abajo se esconden y aparecen con una transición: se vuelve a mirar cuando el scroll se queda quieto
    const pedir = () => {
      if (!cuadro) cuadro = requestAnimationFrame(mirar);
      clearTimeout(quieto);
      quieto = setTimeout(() => { if (!cuadro) cuadro = requestAnimationFrame(mirar); }, 320);
    };
    window.addEventListener('scroll', pedir, { passive: true });
    window.addEventListener('resize', pedir);
    mirar();
    return () => {
      window.removeEventListener('scroll', pedir);
      window.removeEventListener('resize', pedir);
      if (cuadro) cancelAnimationFrame(cuadro);
      clearTimeout(quieto);
    };
  }, []);
  const subir = () => {
    let quieto = false;
    try { quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { quieto = false; }
    window.scrollTo({ top: 0, behavior: quieto ? 'auto' : 'smooth' });
  };
  return (
    <button type="button" ref={yo} className={'subir' + (ver ? ' ver' : '')} aria-label="Volver arriba de todo" title="Volver arriba"
      tabIndex={ver ? 0 : -1} aria-hidden={!ver} onClick={subir}>
      <svg className="subir-aro" viewBox="0 0 64 64" preserveAspectRatio="none" aria-hidden="true">
        <rect className="pista" x="1" y="1" width="62" height="62" rx="4" />
        <rect className="va" ref={va} x="1" y="1" width="62" height="62" rx="4" pathLength="100" />
      </svg>
      <Ico n="arriba" t={26} />
    </button>
  );
}

// ── la barra de abajo del celular y el menú ☰ ─────────────────────────────────────────────────────
//
// 🎮 «EL LOBBY» (19/11/2026, Dlx a la maqueta de la barra, con seis opciones y 22 patrones de juegos, apps y webs: «Haz el
// E»). Cinco lugares fijos como el lobby de un juego —Inicio, Ranking, EN JUEGO, Pase y Tú— en vez de la tira de doce que
// se deslizaba (28/09 y 02/10): de doce se veían cuatro y media y las otras siete había que buscarlas. Lo que no está en la
// barra vive en el ☰, en cuadrados con su imagen (`Menu`, abajo). Sin líneas ni flechas, como siempre (03/10 y 17/10)
// ↔️ Y DESDE LA 6.79 LA TIRA VUELVE con estos cinco al principio: ver «LA TIRA VUELVE» más abajo
//
// 🔴 EL DEL CENTRO NO ES UNA SECCIÓN: DICE LO QUE TE TOCA. Como el botón Batalla de Clash of Clans, que cambia de dibujo
// según lo que pasa: TE TOCA (tu batalla en tu llave en vivo) › VIVO (algo se juega ahora) › EN 40 MIN › HOY (lo próximo
// de hoy) › EVENTOS. Cambia de texto, nunca de lugar ni de tamaño. Tocarlo abre lo que dice; mantenerlo apretado abre
// Calendario · Competencias · Ligas encima de la barra
const EV_PAGS = ['eventos', 'competencias', 'ligas', 'avisos'];
const sinBand = (s) => String(s || '').replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').trim();

// tu batalla en una llave en vivo, con la misma lectura que el botón grande del lobby (`tuMomento()` de lobby.jsx): «ahora»
// y «sigue» sólo si la llave se juega en orden (`momentosLlave()`)
function meToca(liga, L) {
  const yo = liga.yo;
  if (!yo || !L) return null;
  const mio = (lado) => String(lado || '').split(/\s*[,+&]\s*/).some((n) => {
    const f = liga.quien(sinBand(n));
    return !!(f && f.k === yo.k);
  });
  let m = null;
  try { m = momentosLlave(L); } catch (e) { m = null; }
  if (m && m.ahora && m.ahora.lados.some(mio)) return { l1: 'TE TOCA', l2: String(m.ahora.r || 'tu batalla') };
  if (m && m.sigue && m.sigue.lados.some(mio)) return { l1: 'PRÓXIMO', l2: 'te toca después' };
  return null;
}

export function enJuego(liga) {
  const vivos = liga.vivo();
  const VL = typeof window !== 'undefined' ? window.VIVO_L : null;
  const yo = liga.yo;
  if (yo) {
    for (const e of vivos) {
      if (!liga.anotados(e).some((x) => x.f && x.f.k === yo.k)) continue;
      const L = llaveEnVivo(e, VL);
      const t = meToca(liga, L);
      if (t) return { tipo: 'toca', l1: t.l1, l2: t.l2, cara: true, llave: L ? L.id : '', aria: t.l1 + ' en ' + limpio(e.nombre) };
    }
  }
  if (vivos.length) {
    const e = vivos[0];
    const L = vivos.length === 1 ? llaveEnVivo(e, VL) : null;
    return { tipo: 'vivo', l1: vivos.length > 1 ? 'VIVO ×' + vivos.length : 'VIVO', l2: vivos.length > 1 ? 'en ' + vivos.length + ' servidores' : limpio(e.nombre),
      logo: liga.logo(e.sv), llave: L ? L.id : '', aria: 'En vivo: ' + vivos.map((x) => limpio(x.nombre)).join(', ') };
  }
  const p = liga.luego().find((x) => !x.sin_hora);
  if (p) {
    const cu = liga.cuandoDe(p);
    const ms = utc(cu) - liga.ahora;
    const d = liga.dia(cu);
    if (ms > 0 && ms < 3 * 3600000) {
      const min = Math.max(1, Math.round(ms / 60000));
      return { tipo: 'pronto', l1: min < 60 ? 'EN ' + min + ' MIN' : 'EN ' + Math.round(min / 60) + ' H', l2: siglaDe(p.sv) + ' · ' + limpio(p.nombre),
        nombre: limpio(p.nombre), logo: liga.logo(p.sv), aria: 'Empieza en ' + liga.falta(cu).toLowerCase() + ': ' + limpio(p.nombre) };
    }
    if (/^hoy /.test(d)) {
      return { tipo: 'hoy', l1: 'HOY', l2: d.replace(/^hoy /, '') + ' · ' + siglaDe(p.sv), nombre: limpio(p.nombre), logo: liga.logo(p.sv), aria: 'Hoy ' + d.replace(/^hoy /, '') + ': ' + limpio(p.nombre) };
    }
  }
  const fh = liga.fechasHoy ? liga.fechasHoy() : [];
  if (fh.length && fh[0].L) {
    const L = fh[0].L;
    return { tipo: 'hoy', l1: 'HOY', l2: 'Liga · ' + siglaDe(L.sv), nombre: limpio(L.n), logo: liga.logo(L.sv), href: '#/ligas/' + encodeURIComponent(L.id), aria: 'Hoy juega ' + limpio(L.n) };
  }
  return { tipo: 'nada', l1: 'EVENTOS', l2: '', aria: 'Eventos' };
}

// 📈 «+2» EN RANKING SI SUBISTE DESDE LA ÚLTIMA VEZ QUE LO MIRASTE (Duolingo, «te pasaron», en la E). Tu puesto de la
// Temporada contra el que tenías cuando abriste el Ranking; se guarda en tu navegador (`lg:rk-pos`) al entrar. Si bajaste,
// nada: la barra no te reta
function useSubiste(liga, pagina) {
  const yo = liga && liga.yo;
  const fila = yo ? (liga.d.tabla || []).find((t) => t.k === yo.k) : null;
  const pos = fila && fila.pos ? fila.pos : 0;
  const k = yo ? yo.k : '';
  let antes = null;
  try { antes = JSON.parse(localStorage.getItem('lg:rk-pos') || 'null'); } catch (e) { antes = null; }
  const visto = antes && antes.k === k ? antes.pos : 0;
  useEffect(() => {
    if (!pos || !k) return;
    // la primera vez, o al mirar el Ranking: ése pasa a ser tu puesto de referencia
    if (pagina === 'ranking' || !visto) {
      try { localStorage.setItem('lg:rk-pos', JSON.stringify({ k, pos })); } catch (e) { /* sin guardar: no hay «+» */ }
    }
  }, [pos, k, pagina, visto]);
  return pos && visto > pos && pagina !== 'ranking' ? visto - pos : 0;
}

// ✋ mantener apretado (medio segundo): abre lo de adentro sin que el toque cuente como toque. `onIni`/`onFin` avisan
// cuándo empieza y termina el apretón (la cara de Tú se va llenando mientras)
function useMantener(alMantener, ms = 450, { onIni, onFin, activo = true } = {}) {
  const t = useRef(0);
  const hecho = useRef(false);
  useEffect(() => () => clearTimeout(t.current), []);
  const fin = () => { clearTimeout(t.current); if (onFin) onFin(); };
  if (!activo) return {};
  return {
    onPointerDown: () => {
      hecho.current = false; clearTimeout(t.current);
      if (onIni) onIni();
      t.current = setTimeout(() => { hecho.current = true; if (onFin) onFin(); alMantener(); }, ms);
    },
    onPointerUp: fin, onPointerLeave: fin, onPointerCancel: fin,
    onContextMenu: (e) => e.preventDefault(),
    onClickCapture: (e) => { if (hecho.current) { e.preventDefault(); e.stopPropagation(); hecho.current = false; } },
  };
}

// 📅 «EVENTOS», COMO EN LA COMPU (6.82, Dlx: «quizás podamos hacer la réplica de lo que está en PC pero acá… si presiono
// eventos me salen 3 opciones», y «efectos, como en vivo, opciones para ver más»). Tocar EN JUEGO abre el mismo panel que
// «Eventos ▾» de la cabecera —el título, cuántas secciones y cada una con su ícono en un círculo y lo que es (`GRUPOS` de
// arriba.jsx: un solo lugar para las dos)— y, arriba, lo que pasa ahora: te toca, lo que se juega en vivo con el punto que
// late (el de «EN VIVO AHORA» del Inicio, `.vivo-late`) y la llave a un toque, o lo próximo de hoy. Encima del botón (`x`,
// su centro en la pantalla), sin salirse de los costados
const grupoDe = (n) => (GRUPOS.find((g) => g[0] === n) || [])[2] || [];
const EV_GRUPO = grupoDe('Eventos');
const RK_GRUPO = grupoDe('Ranking');

// 🧩 EL PANEL DE UN GRUPO, encima de su botón (`x`, su centro en la pantalla) y sin salirse de los costados: el de Eventos
// y el de Ranking son el mismo, con el estilo de «Eventos ▾» y «Ranking ▾» de la compu. Se cierra tocando afuera (no en
// su botón, que lo alterna), con Escape y al cambiar de página. `dos`: las secciones en dos columnas, sólo el nombre
// ♿ Es un panel que se abre y se cierra (su botón lleva `aria-expanded` y `aria-controls`), no un `role="menu"`: un menú
// promete flechas y foco adentro. Con el teclado el foco entra a la primera fila y, al cerrarse, vuelve a su botón.
// 🔄 Y sigue a su botón: al girar el teléfono se vuelve a ubicar (con el ancho de antes quedaba medio afuera)
function Hoja({ id, titulo, cuantas, ahora, items, dos, sale, x, boton, onCerrar }) {
  const yo = useRef(null);
  const [, setGiro] = useState(0);
  useEffect(() => {
    const volver = () => { const b = boton && boton.current; if (b) b.focus(); };
    const fuera = (e) => {
      const p = e.composedPath ? e.composedPath() : [];
      if (yo.current && !p.includes(yo.current) && !(boton && boton.current && p.includes(boton.current))) onCerrar();
    };
    const esc = (e) => { if (e.key === 'Escape') { onCerrar(); volver(); } };
    const giro = () => setGiro((n) => n + 1);
    // al próximo cuadro: el mismo toque que la abrió no la cierra
    const t = setTimeout(() => { window.addEventListener('pointerdown', fuera, true); }, 0);
    window.addEventListener('keydown', esc);
    window.addEventListener('lg:dir', onCerrar);
    window.addEventListener('resize', giro);
    return () => {
      clearTimeout(t); window.removeEventListener('pointerdown', fuera, true); window.removeEventListener('keydown', esc);
      window.removeEventListener('lg:dir', onCerrar); window.removeEventListener('resize', giro);
    };
  }, [onCerrar, boton]);
  // con el teclado, el foco entra a la primera fila (con el dedo no: una fila con foco parece elegida)
  useEffect(() => {
    const b = boton && boton.current;
    let tecla = false;
    try { tecla = !!(b && b.matches(':focus-visible')); } catch (e) { tecla = false; }
    const a = tecla && yo.current ? yo.current.querySelector('a') : null;
    if (a) a.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // al irse, si el foco estaba adentro, vuelve al botón (si no, cae al <body>)
  useEffect(() => {
    if (!sale || !yo.current) return;
    const r = yo.current.getRootNode();
    const act = r && r.activeElement;
    if (act && yo.current.contains(act) && boton && boton.current) boton.current.focus();
  }, [sale, boton]);
  const W = window.innerWidth || 390;
  const ancho = Math.min(360, W - 16);
  const b = boton && boton.current ? boton.current.getBoundingClientRect() : null;
  const cx = b && b.width ? b.left + b.width / 2 : x || W / 2;
  const left = Math.round(Math.min(Math.max(8, cx - ancho / 2), W - ancho - 8));
  return (
    <div className={'tb-ev' + (dos ? ' dos' : '') + (sale ? ' sale' : '')} ref={yo} id={id} role="group" aria-label={titulo} style={{ left, width: ancho }}>
      <p className="tb-ev-h"><b>{titulo}</b><small>{cuantas}</small></p>
      {ahora && ahora.length ? <div className="tb-ev-ahora">{ahora}</div> : null}
      <div className="tb-ev-items">{items}</div>
    </div>
  );
}

// 📊 «RANKING», COMO EN LA COMPU (6.88, Dlx: «debería aparecer todas las opciones de ranking ahí igual como lo hace la
// PC»): tocar Ranking abre las doce tablas de «Ranking ▾» (`GRUPOS` de arriba.jsx), en dos columnas con su ícono, y
// marca la que estás mirando. Arriba, con cuenta y en la tabla, tu lugar en la Temporada y lo que subiste desde la última
// vez que la miraste
function rutaRanking() {
  const r = String((typeof window !== 'undefined' && window.rutaLG ? window.rutaLG() : '') || '').replace(/^#?\/?/, '');
  const p = r.split(/[/?]/);
  if (p[0] === 'duelos') return '#/ranking/duelos';
  return p[0] === 'ranking' ? '#/ranking/' + (p[1] || 'temporada') : '';
}
function HojaRanking({ liga, cara, sube, sale, x, boton, onCerrar }) {
  const yo = liga && liga.yo;
  const fila = yo ? ((liga.d && liga.d.tabla) || []).find((t) => t.k === yo.k) : null;
  const actual = rutaRanking();
  const ahora = fila && fila.pos ? [
    <a key="yo" className="tb-ev-ya" href="#/ranking/temporada" onClick={(e) => { subirSiEsta('#/ranking/temporada')(e); onCerrar(); }}>
      <span className="tb-ev-ya-c">{cara}</span>
      <span className="tb-ev-ya-t"><i>Tu lugar · Temporada</i><b>{'#' + fila.pos + (fila.ovr ? ' · ' + fila.ovr + ' de OVR' : '')}</b></span>
      <em className={sube ? 'sube' : ''}>{sube ? '+' + sube : 'Ver'}</em></a>] : null;
  const items = RK_GRUPO.map(([n, h, , k]) => (
    <a key={h} href={h} className={h === actual ? 'on' : ''} aria-current={h === actual ? 'page' : undefined}
      onClick={(e) => { subirSiEsta(h)(e); onCerrar(); }}>
      <span className="tb-ev-ico"><Ico n={k} t={16} /></span><span className="tb-ev-ya-t"><b>{n}</b></span>
    </a>
  ));
  return <Hoja id="tb-hoja-rk" titulo="Ranking" cuantas={RK_GRUPO.length + ' tablas'} ahora={ahora} items={items} dos sale={sale} x={x} boton={boton} onCerrar={onCerrar} />;
}

function HojaEventos({ liga, j, cara, pagina, sale, onCerrar, x, boton }) {
  const VL = typeof window !== 'undefined' ? window.VIVO_L : null;
  const vivos = liga.vivo().slice(0, 2);
  const hoyLiga = (liga.fechasHoy ? liga.fechasHoy() : []).length;
  const llave = (id) => (e) => { onCerrar(); if (id) { e.preventDefault(); accion.llave('v:' + id); } };
  // lo de ahora: te toca, lo que se juega (hasta dos) o lo próximo de hoy
  const ahora = [];
  if (j.tipo === 'toca') {
    ahora.push(
      <a key="toca" className="tb-ev-ya toca" href="#/eventos" onClick={llave(j.llave)}>
        <span className="tb-ev-ya-c">{cara}</span><span className="tb-ev-ya-t"><i className="vivo-late">{j.l1}</i><b>{j.l2}</b></span><em>{j.llave ? 'Tu llave' : 'Ver'}</em></a>);
  }
  vivos.forEach((e, i) => {
    const L = llaveEnVivo(e, VL);
    ahora.push(
      <a key={'v' + i} className="tb-ev-ya vivo" href="#/eventos" onClick={llave(L ? L.id : '')}>
        <img alt="" src={liga.logo(e.sv)} /><span className="tb-ev-ya-t"><i className="vivo-late">{'En vivo · ' + siglaDe(e.sv)}</i><b>{limpio(e.nombre)}</b></span>
        <em>{L ? 'La llave' : 'Ver'}</em></a>);
  });
  if (!vivos.length && j.tipo !== 'toca' && (j.tipo === 'pronto' || j.tipo === 'hoy') && j.nombre) {
    ahora.push(
      <a key="prox" className="tb-ev-ya" href={j.href || '#/eventos'} onClick={onCerrar}>
        {j.logo ? <img alt="" src={j.logo} /> : <span className="tb-ev-ico"><Ico n="eventos" t={18} /></span>}
        <span className="tb-ev-ya-t"><i>{j.tipo === 'pronto' ? j.l1 : 'Hoy · ' + (j.l2 || '')}</i><b>{j.nombre}</b></span><em>Ver</em></a>);
  }
  const items = EV_GRUPO.map(([n, h, d, k]) => (
    <a key={h} href={h} className={pagina && h === '#/' + pagina ? 'on' : ''} aria-current={pagina && h === '#/' + pagina ? 'page' : undefined} onClick={(e) => { subirSiEsta(h)(e); onCerrar(); }}>
      <span className="tb-ev-ico"><Ico n={k} t={18} /></span><span className="tb-ev-ya-t"><b>{n}</b><small>{d}</small></span>
      {k === 'ligas' && hoyLiga ? <em>Hoy se juega</em> : null}
    </a>
  ));
  return <Hoja id="tb-hoja-ev" titulo="Eventos" cuantas={EV_GRUPO.length + ' secciones'} ahora={ahora} items={items} sale={sale} x={x} boton={boton} onCerrar={onCerrar} />;
}

// 🧭 LA TIRA VUELVE, CON EL LOBBY ADENTRO (19/11/2026, Dlx a la 6.78: «so it can scroll to the right still but keeping the
// 3 lines above… combining some features of F»), Y SIMÉTRICA (el mismo día: «quisiera simetría la verdad lo máximo
// posible… no pasa nada si lo otro no se oculta… que si deslizas haya más opciones»). La primera pantalla es la de la
// 6.78 tal cual —Inicio, Ranking, EN JUEGO al centro, Pase y Tú, del mismo ancho, sin nada cortado— y deslizando aparecen
// las demás. El ☰ de cuadrados queda igual (`Menu`, abajo).
//
// 🌱 Y CRECE CONTIGO, COMO EN LA F (6.80, Dlx: «que vaya creciendo mediante q tu tmb parecido a la opción F»). Quien no
// entró ve cinco quietas (Inicio, Ranking, EN JUEGO, la Guía y «Entrar»: la queja de «es mucho» es de los nuevos, y el Pase
// pide cuenta). Con cuenta, lo de después de la primera pantalla llega con tu NIVEL (el general, el de entrar y jugar: el
// mismo que desbloquea los colores de los servidores en 2, 3 y 5, ver temas.js), como los modos de un juego que se abren con
// tu rango: `NIVEL_SECC`. Cada vez que se suma algo, un globo lo dice y lleva «NUEVO» hasta que lo abres (dos semanas como
// mucho). En tu navegador la barra nunca se achica (`lg:barra-max`), aunque una temporada nueva te baje el nivel. Todo
// sigue en el ☰: crecer es lo que está a mano, no lo que existe
const TIRA = [['inicio', 'Inicio', '#/'], ['ranking', 'Ranking', '#/ranking'], null, ['pase', 'Pase', '#/pase'],
  ['publicaciones', 'Publicaciones', '#/publicaciones'], ['competencias', 'Competencias', '#/competencias'], ['ligas', 'Ligas', '#/ligas'],
  ['crews', 'Crews', '#/crews'], ['tarjetas', 'Tarjetas', '#/tarjetas'], ['salon', 'Salón', '#/salon'], ['socios', 'Socios', '#/socios'],
  ['guia', 'Guía', '#/guia']];
const NOVATO = [TIRA[0], TIRA[1], null, TIRA[11]];
export const NIVEL_SECC = { publicaciones: 1, guia: 1, competencias: 2, ligas: 2, crews: 3, tarjetas: 3, salon: 5, socios: 5 };
const NOMBRE_SECC = Object.fromEntries(TIRA.filter(Boolean).map(([k, n]) => [k, n]));
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin guardar: vale para esta visita */ } },
  json(k, d) { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } },
};
const unir = (xs) => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1]);

// 🎟️ tu Pase, sólo si ya llegó (lo pide el Inicio o la página del Pase): pedirlo acá sería un pedido más en cada página, y
// pedirlo ya revisa tus Tareas en el servidor (pase.js)
function usePaseSiHay(activo) {
  const [P, setP] = useState(() => (typeof window !== 'undefined' ? window.PASE : null));
  useEffect(() => {
    if (!activo) return undefined;
    const f = () => setP(window.PASE);
    window.addEventListener('lg:pase', f);
    f();
    return () => window.removeEventListener('lg:pase', f);
  }, [activo]);
  return activo ? P : null;
}

export function Tabbar({ liga, dc, pagina = '' }) {
  const yo = liga && liga.yo;
  const [yoM, setYoM] = useState(false);
  const [verYo, saleYo] = usePresencia(yoM, 120);
  const [jm, setJm] = useState(false);
  const [verJ, saleJ] = usePresencia(jm, 160);
  const [jx, setJx] = useState(0);
  const cara = yo ? <Cara liga={liga} k={yo.k} nombre={yo.n} cls="tb-cara" /> : (dc ? <CaraDc dc={dc} cls="tb-cara" /> : null);
  const novato = !cara;
  const sube = useSubiste(liga, pagina);
  const j = enJuego(liga);
  const enEv = EV_PAGS.includes(pagina);
  const btnJ = useRef(null);
  const cerrarJ = useCallback(() => setJm(false), []);
  // 📊 y Ranking abre el suyo, con las doce tablas (6.88): uno abierto cierra el otro
  const [rm, setRm] = useState(false);
  const [verR, saleR] = usePresencia(rm, 160);
  const [rx, setRx] = useState(0);
  const btnR = useRef(null);
  const cerrarR = useCallback(() => setRm(false), []);
  const btnYo = useRef(null);
  const nav = useRef(null);
  const centro = (b) => { const r = b.current ? b.current.getBoundingClientRect() : null; return r ? r.left + r.width / 2 : 0; };
  // tocarlo abre (y cierra) el panel de Eventos, como «Eventos ▾» en la compu: lo de ahora arriba y las tres secciones
  const tocar = (e) => {
    e.preventDefault();
    setYoM(false); setRm(false);
    setJx(centro(btnJ));
    setJm((v) => !v);
  };
  const tocarR = (e) => {
    e.preventDefault();
    setYoM(false); setJm(false);
    setRx(centro(btnR));
    setRm((v) => !v);
  };
  const nv = liga ? pubNuevas(liga, pagina) : 0;

  // ⭐ TU NIVEL Y LO QUE TRAE: el general (`useRacha`, que la cabecera ya pide: no suma un pedido), el máximo que viste en
  // este navegador, y las secciones que te tocan con él. Mientras tu nivel no llegó, lo de la última vez (o el 1)
  const R = useRacha(!novato);
  const nivelYa = R && R.nivel && R.nivel.n ? R.nivel.n : 0;
  const maxVisto = +ls.get('lg:barra-max') || 0;
  const nivel = Math.max(nivelYa, maxVisto, 1);
  const lista = novato ? NOVATO : TIRA.filter((x) => !x || !NIVEL_SECC[x[0]] || nivel >= NIVEL_SECC[x[0]]);
  const claves = lista.filter(Boolean).map((x) => x[0]);

  // 🆕 LO QUE SE SUMA: lo que hoy está en la barra y la vez anterior no (`lg:barra`), con su fecha (`lg:barra-nuevas`).
  // La primera vez en este navegador no se festeja nada: para quien ya usaba la página, nada es nuevo. Se anota recién
  // cuando tu nivel llegó (si no, la barra de nivel 1 «sumaría» lo tuyo de siempre al llegar el nivel)
  const [nuevas, setNuevas] = useState(() => { const n = ls.json('lg:barra-nuevas', {}); return n && typeof n === 'object' && !Array.isArray(n) ? n : {}; });
  const [aviso, setAviso] = useState(() => (ls.get('lg:tira-ok') ? null : { desliza: true }));
  const firma = claves.join(',');
  useEffect(() => {
    if (!novato && !nivelYa) return;
    if (!novato && nivel > maxVisto) ls.set('lg:barra-max', String(nivel));
    const antes = ls.json('lg:barra', null);
    ls.set('lg:barra', JSON.stringify(claves));
    if (!Array.isArray(antes)) return;
    const suma = claves.filter((k) => !antes.includes(k));
    if (!suma.length) return;
    const n = Object.assign({}, nuevas);
    suma.forEach((k) => { n[k] = Date.now(); });
    setNuevas(n);
    ls.set('lg:barra-nuevas', JSON.stringify(n));
    const deLaTira = suma.filter((k) => NIVEL_SECC[k]);
    if (deLaTira.length) setAviso({ suma: deLaTira.map((k) => NOMBRE_SECC[k]), nivel: novato ? 0 : nivel, cuenta: antes.length <= NOVATO.length - 1 });
  }, [firma, nivelYa, novato]); // eslint-disable-line react-hooks/exhaustive-deps
  // las secciones que abriste (`lg:barra-vistas`): ésas ya no son nuevas.
  // 🔴 HASTA LA 6.88 ERA `lg:secc`, Y ESA CLAVE YA ERA DE OTRO (Dlx: «después de presionar ranking, desaparece la línea de
  // abajo»): App.jsx cuenta ahí, desde la 2.83, las secciones que abre cada navegador por día, como `{dia, s: […]}`. Al abrir
  // Ranking escribía su objeto, `vistas.includes` reventaba y la barra entera se apagaba (`Aislada`) hasta recargar; y cada
  // una pisaba lo de la otra, así que una sección se contaba más de una vez por día. Antes de sumar una clave `lg:`, buscarla
  // en web/src. Y lo que se lee del navegador se revisa: puede ser de otra versión o de otro
  const [vistas, setVistas] = useState(() => { const v = ls.json('lg:barra-vistas', []); return Array.isArray(v) ? v : []; });
  useEffect(() => {
    if (!pagina || vistas.includes(pagina)) return;
    const v = vistas.concat(pagina);
    setVistas(v);
    ls.set('lg:barra-vistas', JSON.stringify(v));
  }, [pagina]); // eslint-disable-line react-hooks/exhaustive-deps
  const nuevo = (k) => !novato && nuevas[k] && Date.now() - nuevas[k] < 14 * 86400000 && !vistas.includes(k);

  // 🎟️ EL PUNTO DEL PASE: subiste de nivel en el Pase desde la última vez que lo abriste (los premios llegan solos; esto
  // dice que hay algo nuevo que ver). La primera vez se anota sin punto.
  // 🔴 En `lg:barra-pase` y no en `lg:pase-visto` (6.88): ésa es del «¡Subiste!» del Pase (pase_pop.jsx, `{temp, n}`), y las
  // dos se pisaban: el número de acá le borraba lo visto y el pop-up no salía nunca
  // Y CON SU TEMPORADA, como el «¡Subiste!» (`{temp, n}`): el Pase vuelve a cero con cada una, y con un número suelto el 40
  // de la T1 dejaba sin punto toda la T2 hasta pasar el 40. Se anota también el 0 y cuando bajaste (otra cuenta, otra
  // temporada); lo de antes de la 6.88 (un número) se toma como «sin ver» y se vuelve a anotar
  const P = usePaseSiHay(!novato);
  const paseOk = !!(P && P.listo && P.miembro !== false && P.temp);
  const nivelPase = paseOk && P.nivel ? P.nivel : 0;
  const tempPase = paseOk ? String(P.temp) : '';
  const vp = ls.json('lg:barra-pase', null);
  const paseVisto = vp && typeof vp === 'object' && vp.temp === tempPase && typeof vp.n === 'number' ? vp.n : null;
  useEffect(() => {
    if (!paseOk) return;
    if (pagina === 'pase' || paseVisto == null || nivelPase < paseVisto) ls.set('lg:barra-pase', JSON.stringify({ temp: tempPase, n: nivelPase }));
  }, [nivelPase, tempPase, pagina]); // eslint-disable-line react-hooks/exhaustive-deps
  const puntoPase = !!nivelPase && paseVisto != null && nivelPase > paseVisto && pagina !== 'pase';

  // 🐉 EL DRAGÓN DROP EN TU CARA (la E): con uno para abrir, la cara lleva un punto y late tres veces; mantenerla apretada la
  // va llenando de abajo hacia arriba y, al medio segundo, lo abre ahí mismo (`abrirPrimero()` de drops.jsx). Tocarla sigue
  // abriendo lo tuyo. Los que se ganan compitiendo, sin ser Miembro de DRA, no cuentan: no se pueden abrir
  const D = useDrops(novato ? null : dc);
  const drops = D ? (D.cerrados || []).filter((x) => !(D.miembro === false && /merito/.test(String((x && x.origen) || '')))).length : 0;
  const [llena, setLlena] = useState(false);
  const mantenerYo = useMantener(() => { setYoM(false); setJm(false); setRm(false); abrirPrimero(btnYo.current); }, 450,
    { activo: drops > 0, onIni: () => setLlena(true), onFin: () => setLlena(false) });
  const [late, setLate] = useState(false);
  const dropsAntes = useRef(0);
  useEffect(() => {
    if (drops > 0 && dropsAntes.current === 0) { setLate(true); const t = setTimeout(() => setLate(false), 1400); dropsAntes.current = drops; return () => clearTimeout(t); }
    dropsAntes.current = drops;
    return undefined;
  }, [drops]);

  // 📏 SIMÉTRICA: una unidad (`--u`) = el ancho de la barra entre 5,6 —cuatro casillas, Tú y EN JUEGO de 1,6 (un poco más
  // que el 1,45 de la 6.78, para que «EN 40 MIN» y «TE TOCA» entren a 360)—, así la primera pantalla llena justo hasta Tú y
  // EN JUEGO cae en el centro exacto. Las de después miden lo mismo o lo que pida su nombre. Se mide la barra y no `100vw`,
  // que en una ventana con barra de desplazamiento la corre unos píxeles
  const tira = useRef(null);
  const porCodigo = useRef(0);
  useLayoutEffect(() => {
    const b = nav.current;
    if (!b) return undefined;
    const medir = () => { const w = b.getBoundingClientRect().width; if (w) b.style.setProperty('--u', (w / 5.6).toFixed(3) + 'px'); };
    medir();
    let ro = null;
    try { ro = new ResizeObserver(medir); ro.observe(b); } catch (e) { window.addEventListener('resize', medir); }
    return () => { if (ro) ro.disconnect(); else window.removeEventListener('resize', medir); };
  }, []);
  // 👉 la que se ve, siempre entera: al cambiar de página la tira se corre hasta ella (sin animar si apagaste las animaciones)
  useEffect(() => {
    const t = tira.current;
    const a = t && t.querySelector('a.on');
    if (!a || novato) return;
    const r = a.getBoundingClientRect(), q = t.getBoundingClientRect();
    if (r.left >= q.left && r.right <= q.right) return;
    let quieto = false;
    try { quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { quieto = false; }
    // lo corre la página, no tu dedo: no cuenta como «ya aprendiste a deslizarla» (se comía el globo de lo que se sumó)
    porCodigo.current = Date.now() + (quieto ? 150 : 900);
    t.scrollTo({ left: Math.max(0, a.offsetLeft - (t.clientWidth - a.offsetWidth) / 2), behavior: quieto ? 'auto' : 'smooth' });
  }, [pagina, novato]);

  // 💬 EL GLOBO: lo que se sumó a tu barra («Nivel 3: se sumaron Crews y Tarjetas»), o «Desliza la barra» a quien nunca la
  // deslizó. Sale cuando nada lo tapa y la barra se ve (`algoTapa()` de tapa.js), con la tira asomándose sola, y se va a los
  // 6 s vistos o al deslizarla (`lg:tira-ok`). Sin flecha ni línea (Dlx, 17/10). Si no hay nada que deslizar, no sale
  const asomando = useRef(false);
  const aprendio = () => { setAviso(null); ls.set('lg:tira-ok', '1'); };
  const hayMas = lista.length > 4;
  const mirar = () => {
    const t = tira.current;
    if (t && !asomando.current && Date.now() > porCodigo.current && t.scrollLeft > 24 && aviso) aprendio();
  };
  const asomar = () => {
    let quieto = false;
    try { quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { quieto = false; }
    const t = tira.current;
    if (quieto || !t || t.scrollLeft > 0) return;
    asomando.current = true;
    // hasta la primera que se sumó, si hay una; si no, un poco
    const nueva = t.querySelector('.tb-nuevo');
    const hasta = nueva ? nueva.parentElement.offsetLeft + nueva.parentElement.offsetWidth - t.clientWidth : 140;
    setTimeout(() => { if (tira.current) tira.current.scrollTo({ left: Math.max(60, Math.min(hasta, tira.current.scrollWidth - tira.current.clientWidth)), behavior: 'smooth' }); }, 400);
    setTimeout(() => { if (tira.current) tira.current.scrollTo({ left: 0, behavior: 'smooth' }); }, 1700);
    setTimeout(() => { asomando.current = false; }, 2600);
  };
  const [globo, setGlobo] = useState(null);
  useEffect(() => {
    if (novato || !aviso || !hayMas || (window.innerWidth || 0) >= 900) return undefined;
    const V = { libre: 0, visto: 0, ult: 0, on: false, asomo: false };
    const iv = setInterval(() => {
      const tb = nav.current;
      if (!tb) return;
      const t = Date.now();
      const H = window.innerHeight || 0;
      const b = tb.getBoundingClientRect();
      const g = V.on ? capaFija(tb).querySelector('.tb-globo') : null;
      const libre = document.visibilityState !== 'hidden' && b.height > 0 && b.top < H && b.bottom > H * 0.5
        // y no mientras hay un panel de la barra abierto (Eventos, Ranking o lo tuyo): se pondría encima de sus filas de abajo
        && !algoTapa(tb, ['.nvt', '.tb-ev', '.yo-menu']) && !(g && !seVe(g));
      if (!libre) {
        V.libre = 0; V.ult = 0;
        if (V.on) { V.on = false; setGlobo(null); }
        return;
      }
      if (!V.on) {
        if (!V.libre) V.libre = t;
        if (t - V.libre < 2000) return;
        V.on = true; V.ult = t;
        setGlobo({ abajo: Math.round(H - b.top + 10), capa: capaFija(tb) });
        if (!V.asomo) { V.asomo = true; asomar(); }
        return;
      }
      V.visto += t - (V.ult || t); V.ult = t;
      setGlobo((x) => (x && x.abajo === Math.round(H - b.top + 10) ? x : { abajo: Math.round(H - b.top + 10), capa: capaFija(tb) }));
      if (V.visto >= 6000) aprendio();
    }, 250);
    return () => clearInterval(iv);
  }, [aviso, novato, hayMas]); // eslint-disable-line react-hooks/exhaustive-deps
  const textoGlobo = !aviso ? '' : aviso.suma
    // cada pedazo, una frase entera: la página en inglés (`/en`) traduce por texto, y «verl» + «as» no lo encuentra
    ? <>{aviso.nivel && !aviso.cuenta ? <b>{'Nivel ' + aviso.nivel + ':'}</b> : null}
      {(aviso.nivel && !aviso.cuenta ? ' ' : '') + (aviso.suma.length === 1 ? (aviso.nivel && !aviso.cuenta ? 'se sumó' : 'Se sumó') : (aviso.nivel && !aviso.cuenta ? 'se sumaron' : 'Se sumaron')) + ' '}
      <b>{unir(aviso.suma)}</b>{aviso.suma.length === 1 ? ' a tu barra. Deslízala para verla' : ' a tu barra. Deslízala para verlas'}</>
    : 'Desliza la barra de costado: hay más secciones';

  const casilla = (x) => {
    if (!x) {
      const href = j.href || '#/eventos';
      const cls = 'tb-jg ' + j.tipo + (enEv && (j.tipo === 'nada' || j.tipo === 'hoy' || j.tipo === 'pronto') ? ' on' : '') + (jm ? ' abierto' : '');
      return (
        <a key="jg" ref={btnJ} href={href} className={cls} data-tuto="menu-eventos" aria-label={j.aria + '. Abre Calendario, Competencias y Ligas'}
          aria-controls="tb-hoja-ev" aria-expanded={jm} onClick={tocar}>
          {/* en reposo, como las demás casillas (ícono y nombre) sobre su bloque: «📅 EVENTOS» con la pista abajo no entraba y
              se metía encima de Pase (medido a 360 y 390) */}
          {j.tipo === 'nada' ? <><Ico n="eventos" t={22} /><span>Eventos</span></> : <>
            <span className={'l1' + (j.tipo === 'vivo' || j.tipo === 'toca' ? ' vivo-late' : '')}>{j.cara && cara ? cara : j.logo && j.tipo === 'hoy' ? <img alt="" src={j.logo} /> : null}{j.l1}</span>
            <span className="l2">{j.l2}</span></>}
        </a>
      );
    }
    const [k, n, r] = x;
    const on = k === 'inicio' ? !pagina : pagina === k;
    // Ranking no lleva directo: abre sus doce tablas, como «Ranking ▾» en la compu
    const rk = k === 'ranking';
    return (
      <a key={k} href={r} data-tuto={'menu-' + k} onClick={rk ? tocarR : subirSiEsta(r)} ref={rk ? btnR : undefined}
        className={(on ? 'on' : '') + (rk && rm ? ' abierto' : '')} aria-controls={rk ? 'tb-hoja-rk' : undefined} aria-expanded={rk ? rm : undefined}
        aria-label={k === 'pase' && puntoPase ? 'Pase: subiste al nivel ' + nivelPase : undefined}>
        <Ico n={k} t={22} /><span>{n}</span>
        {k === 'ranking' && sube ? <i className="tb-sube" aria-label={'Subiste ' + sube + (sube === 1 ? ' puesto' : ' puestos')}>+{sube}</i> : null}
        {k === 'pase' && puntoPase ? <i className="tb-pv" aria-hidden="true" /> : null}
        {k === 'publicaciones' && nv ? <i className="tb-nuevas" aria-label={nv + ' nuevas'}>{nv}</i>
          : nuevo(k) ? <i className="tb-nuevo" aria-label="Nueva en tu barra">NUEVO</i> : null}
      </a>
    );
  };
  return (
    <nav className={'tabbar e' + (novato ? ' novato' : '')} aria-label="Secciones" ref={nav}>
      {!novato && aviso && hayMas && globo ? createPortal(
        <div className="tb-globo e" role="note" style={{ bottom: globo.abajo }}>
          <span>{textoGlobo}</span>
          <button type="button" aria-label="Entendido" onClick={aprendio}>✕</button>
        </div>, globo.capa) : null}
      <div className="tb-tira" ref={tira} onScroll={mirar}>{lista.map(casilla)}</div>
      {/* 👤 con tu cuenta, abre el menú de lo tuyo (yomenu.jsx: el Inventario primero); sin cuenta, Entrar */}
      {cara ? (
        <button type="button" ref={btnYo} className={'tb-yo' + (pagina === 'cuenta' || pagina === 'inventario' ? ' on' : '') + (drops ? ' con-drop' : '') + (llena ? ' llena' : '') + (late ? ' late' : '')}
          data-tuto="cuenta" aria-haspopup="menu" aria-expanded={yoM}
          aria-label={'Lo tuyo: inventario, perfil y cuenta' + (drops ? '. Tienes ' + (drops === 1 ? 'un Dragón Drop' : drops + ' Dragón Drops') + ' para abrir: mantén apretado para abrirlo' : '')}
          onClick={() => { setJm(false); setRm(false); setYoM((v) => !v); }} {...mantenerYo}>
          <span className="tb-yo-c">{cara}{drops ? <i className="tb-pv" aria-hidden="true" /> : null}</span><span>Tú</span></button>
      ) : (
        <a href="#/cuenta" className={'tb-yo' + (pagina === 'cuenta' ? ' on' : '')} data-tuto="cuenta" aria-label="Entrar con Discord"><Ico n="yo" t={22} /><span>Entrar</span></a>
      )}
      {verJ ? <HojaEventos liga={liga} j={j} cara={cara} pagina={pagina} sale={saleJ} x={jx} boton={btnJ} onCerrar={cerrarJ} /> : null}
      {verR ? <HojaRanking liga={liga} cara={cara} sube={sube} sale={saleR} x={rx} boton={btnR} onCerrar={cerrarR} /> : null}
      {verYo ? <YoMenu k={yo ? yo.k : (dc && dc.clave) || ''} dc={dc} nombre={limpio(yo ? yo.n : (dc ? dc.n : ''))} cara={cara} abajo sale={saleYo} onCerrar={() => setYoM(false)} /> : null}
    </nav>
  );
}

// 🧱 EL ☰ EN CUADRADOS CON SU IMAGEN (19/11/2026, Dlx: «cuando se presiona las 3 líneas… que muestre los cuadrados de la
// barra B… pero en vez q sea así plano que tengan como una imagen ahí, como lo es Roblox»). Cada sección que no está en la
// barra, con la ilustración de su vista previa (`herramientas/banner_paginas.py --mini` → `/og/mini/<página>.webp`), su
// nombre y para qué sirve. Arriba de la imagen, lo del momento: lo nuevo y lo que se juega, en magenta. Ranking y Pase sólo
// donde no hay barra (de 900 px para arriba, `.en-barra`). El panel es oscuro en los dos temas, como la campana y tu menú
const TEJAS = [
  ['La temporada', [['#/publicaciones', 'Publicaciones'], ['#/eventos', 'Eventos'], ['#/competencias', 'Competencias'], ['#/ligas', 'Ligas'],
    ['#/ranking', 'Ranking', 1], ['#/pase', 'Pase rapero', 1]]],
  ['Comunidad', [['#/crews', 'Crews'], ['#/tarjetas', 'Tarjetas'], ['#/salon', 'Salón de la fama'], ['#/socios', 'Socios']]],
  ['Lo tuyo', [['#/tienda', 'Tienda'], ['#/invitar', 'Invita y gana'], ['#/guia', 'Guía']]],
];

export function Menu({ liga, abierto, onCerrar, tema, onTema, temaSv, pagina = '' }) {
  // ⚠️ el foco entra al abrirlo y vuelve al ☰ al cerrarlo: con el teclado se quedaba atrás, en la página tapada
  // (revisión del 03/10/2026). Aparte del efecto del Escape: `onCerrar` cambia en cada vuelta de App
  const cerrarB = useRef(null);
  // 🚪 al cerrarlo, la caja vuelve a su costado en vez de desaparecer (ver `usePresencia` de anima.js)
  const [ver, despide] = usePresencia(abierto, 200);
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
  if (!ver) return null;
  // el changelog, con su «NUEVO» si hay una versión que no viste (lo que app.js ya cargó para el punto del menú). Cada
  // línea, una frase entera en un solo texto: `/en` traduce por texto, y partida en tres no la encontraba
  const C = window.CAMBIOS;
  const ult = Array.isArray(C) && C[0] ? C[0].version : '';
  const nuevo = !!ult && nuevaQue(ult, window.CAMBIOS_VISTO);
  const cambios = (
    <div className="x-fila"><span>Changelog<small>{'Lo nuevo de la página' + (ult ? ', hasta la v' + ult : '') + '.'}</small></span>
      <a className="btn negro chico" href="#/cambios" onClick={onCerrar}>{nuevo ? <em className="x-nuevo">NUEVO</em> : null}Ver</a></div>
  );
  // lo del momento de cada cuadrado: sin dato no hay etiqueta
  const nv = liga ? pubNuevas(liga, pagina) : 0;
  const vivos = liga ? liga.vivo().length : 0;
  const hoyLiga = liga && liga.fechasHoy ? liga.fechasHoy().length : 0;
  const tag = (r) => {
    if (r === '#/publicaciones' && nv) return <em className="x-teja-tag mg">{nv === 1 ? '1 NUEVA' : nv + ' NUEVAS'}</em>;
    if (r === '#/eventos' && vivos) return <em className="x-teja-tag mg">EN VIVO</em>;
    if (r === '#/ligas' && hoyLiga) return <em className="x-teja-tag">HOY SE JUEGA</em>;
    return null;
  };
  return (
    <div className={'x-menu tejas' + (despide ? ' sale' : '')} onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="x-caja" role="dialog" aria-modal="true" aria-label="Menú">
        <div className="x-caja-cab"><b>MENÚ</b><button className="btn-ico x-cerrar" type="button" aria-label="Cerrar el menú" onClick={onCerrar} ref={cerrarB}><Ico n="cerrar" t={22} /></button></div>
        {/* en el celular el buscador no entra arriba: vive acá */}
        {liga ? <div className="x-busca"><Buscar liga={liga} onIr={onCerrar} /></div> : null}
        {TEJAS.map(([g, xs]) => (
          <section key={g} className="x-grupo" aria-label={g}>
            <span className="x-aj-t">{g.toUpperCase()}</span>
            <div className="x-tejas">
              {xs.map(([r, n, enBarra]) => {
                const k = r.slice(2);
                return (
                  <a key={r} href={r} className={'x-teja' + (enBarra ? ' en-barra' : '') + (pagina === k ? ' on' : '')} aria-current={pagina === k ? 'page' : undefined} onClick={onCerrar}>
                    <span className="x-teja-img"><img alt="" src={'/og/mini/' + k + '.webp'} width="480" height="270" loading="lazy" />{tag(r)}</span>
                    <b>{n}</b>{QUE_ES[r] ? <small>{QUE_ES[r]}</small> : null}
                  </a>
                );
              })}
            </div>
          </section>
        ))}
        <div className="x-aj">
          <span className="x-aj-t">AJUSTES</span>
          <div className="x-fila"><span>Tema</span>
            <div className="x-seg" role="group" aria-label="Tema">
              <button type="button" aria-pressed={tema === 'clara'} onClick={() => onTema('clara')}>Clara</button>
              <button type="button" aria-pressed={tema === 'noche'} onClick={() => onTema('noche')}>Noche</button>
            </div></div>
          {/* 🎨 y los de los servidores (13/10/2026): están en Apariencia, con la vista previa de cada uno. Por su nombre
              (`nombreSv()`, como Apariencia), no por el código: decía «Ahora: SR.» y «Ahora: ACAD.» (18/11/2026) */}
          <div className="x-fila"><span>Colores de un servidor<small>{(temaSv ? 'Ahora: ' + nombreSv(temaSv) + '. ' : '') + 'Encima de Clara o de Noche, los colores de un servidor de la Liga.'}</small></span>
            <a className="btn negro chico" href="#/cuenta/apariencia" onClick={onCerrar}>Elegir</a></div>
          <div className="x-fila"><span>Hora, zona y más<small>El formato de la hora, tu zona y menos animaciones.</small></span>
            <a className="btn negro chico" href="#/cuenta/hora" onClick={onCerrar}>Abrir</a></div>
          {cambios}
          <div className="x-fila"><span>Tu cuenta<small>Entrar con Discord, tu foto, tu crew, tus avisos y la app.</small></span>
            <button type="button" className="btn negro chico" onClick={() => { onCerrar(); accion.cuenta(); }}>Abrir</button></div>
        </div>
      </div>
    </div>
  );
}

// 💬 RESPONDER Y REACCIONAR DESDE LA HISTORIA (Dlx, 14/11/2026, a la maqueta de las historias: «Todas tal cual»). Como
// Instagram: la barra de «Responde a…» abajo —el comentario va a la publicación, el mismo de Publicaciones— y la carita,
// que abre tus reacciones (las del Pase; las que te faltan, apagadas). Arriba, lo que ya tiene. Mientras escribes o eliges,
// el reloj de la historia espera (`onFoco`). Sólo en las historias que son una publicación del muro (`s.pub`)
function HvSocial({ liga, it, A, P, onFoco, onIr }) {
  const [abierto, setAbierto] = useState(false);
  const [tx, setTx] = useState('');
  const [msg, setMsg] = useState('');
  const [va, setVa] = useState(false);
  const escribe = useRef(false);
  useEffect(() => { onFoco(abierto || escribe.current); }, [abierto, onFoco]);
  const id = it.id;
  const reac = reaccionesDe(A, id);
  const mia = miReaccion(A, id);
  const yo = liga.yo;
  const propio = !!(yo && ksDe(it).includes(yo.k));
  const puede = LU_REAC.has(it.tipo) && !propio;
  const mias = (P && Array.isArray(P.reacciones) && P.reacciones.length) ? P.reacciones : ['👏'];
  const todas = [['👏', 0]];
  ((P && P.fila_premium) || []).forEach((x) => { if (x[2] === 'reaccion' && !todas.some((y) => y[0] === x[3])) todas.push([x[3], x[0]]); });
  const { dc } = quienMira();
  const verificado = !!(dc && dc.clave);
  const nc = delHilo(it, Date.now()).length;
  const quien = limpio((it.quien || [])[0] || '');
  const err = A.err[id];
  const errTx = err ? (err.error === 'reaccion' ? 'Esa reacción es del Pase premium' : window.errorAplauso ? window.errorAplauso(err) : '') : '';
  const reaccionar = (e) => { if (window.felicitar) window.felicitar(id, e); setAbierto(false); };
  const enviar = async (e) => {
    e.preventDefault();
    if (!tx.trim() || va) return;
    setVa(true);
    setMsg('');
    try {
      const r = await comentar(it, tx);
      if (r.ok) { setTx(''); setMsg('Comentario enviado'); } else if (r.msg) setMsg(r.msg);
    } finally { setVa(false); }
  };
  const foco = (x) => { escribe.current = x; onFoco(x || abierto); };
  const parar = (e) => e.stopPropagation();
  return (
    <div className="hv-soc" onPointerDown={parar} onPointerUp={parar} onClick={parar}>
      {reac.length || nc ? (
        <div className="hv-soc-r">
          {reac.slice(0, 4).map(([e, n]) => <span key={e} className={mia === e ? 'on' : ''}>{e} {num(n)}</span>)}
          {nc ? <button type="button" className="hv-soc-cm" onClick={() => onIr({ ruta: '#/publicaciones/' + encodeURIComponent(id) })}>💬 {num(nc)}{nc === 1 ? ' comentario' : ' comentarios'}</button> : null}
        </div>
      ) : null}
      {abierto ? (
        <div className="hv-picker" role="dialog" aria-label="Reaccionar">
          {todas.map(([e, nv]) => {
            const tiene = mias.includes(e);
            return (
              <button key={e} type="button" className={(mia === e ? 'on' : '') + (tiene ? '' : ' bloq')} disabled={!tiene || mia === e || !!A.va[id]}
                onClick={() => reaccionar(e)} aria-label={tiene ? 'Reaccionar con ' + e : e + ': Pase premium, nivel ' + nv}
                title={tiene ? '' : 'Pase premium, nivel ' + nv}><span aria-hidden="true">{e}</span></button>
            );
          })}
        </div>
      ) : null}
      <form className="hv-resp" onSubmit={enviar}>
        {verificado ? (
          <input type="text" maxLength={200} value={tx} onChange={(e) => setTx(e.target.value)} onFocus={() => foco(true)} onBlur={() => foco(false)}
            placeholder={quien ? 'Responde a ' + quien + '…' : 'Responde…'} aria-label="Responder con un comentario" />
        ) : <button type="button" className="hv-resp-in" onClick={() => onIr({ ruta: '#/cuenta' })}>Verifícate para responder</button>}
        {puede ? (
          <button type="button" className={'hv-car' + (abierto ? ' on' : '')} aria-expanded={abierto} aria-label={mia ? 'Cambiar tu reacción' : 'Reaccionar'}
            onClick={() => setAbierto((v) => !v)}><Carita t={26} /></button>
        ) : null}
        {verificado ? (
          <button type="submit" className="hv-env" disabled={!tx.trim() || va} aria-label="Mandar el comentario">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" /></svg>
          </button>
        ) : null}
      </form>
      {msg || errTx ? <small className="hv-soc-msg" role="status">{msg || errTx}</small> : null}
    </div>
  );
}

// ── el visor de historias, como las de Instagram ──────────────────────────────────────────────────
export function Visor({ liga, grupos, abierto, onCerrar, onVisto, vistos = {}, raiz, desde = '' }) {
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
  // 🔗 abierta por su link (`?h=<id>`, ver App.jsx): arranca en esa historia; si no, en la primera que no viste
  const desdeR = useRef(desde);
  const inicio = (g) => {
    if (!g) return 0;
    const j = desdeR.current ? g.slides.findIndex((s) => s.id === desdeR.current) : -1;
    if (j >= 0) return j;
    const k = g.slides.findIndex((s) => !vistos[s.id]);
    return k < 0 ? 0 : k;
  };
  // la lista de cada círculo se fija al abrirlo: marcar como vista la que estás mirando no la saca de abajo del dedo
  const [abre, setAbre] = useState(() => ({ gid: (grupos[abierto] || {}).id, ids: lista(grupos[abierto]) }));
  const [si, setSi] = useState(() => inicio(grupos[abierto]));
  const pausa = useRef(false);
  // escribiendo una respuesta o eligiendo una reacción: el reloj espera (como mantener apretado)
  const foco = useRef(false);
  const onFoco = useMemo(() => (x) => { foco.current = !!x; }, []);
  const cerrarB = useRef(null);
  // ⚡ la barra de la historia que corre se mueve DIRECTO, sin pasar por React: antes el reloj hacía `setAvance` en
  // cada cuadro y el visor entero se redibujaba 60 veces por segundo (revisión del 18/10/2026)
  const barra = useRef(null);
  const barras = useRef(null);
  // 🖼️ el reloj espera a que la imagen de la historia cargue (hasta 2,5 s): con 3G, la historia se iba sin verse
  const cargando = useRef(false);
  const cuerpoR = useRef(null);
  // ✋ el gesto: dónde y cuándo empezó, y si el click que viene detrás se ignora (mantener o deslizar no es tocar)
  const gesto = useRef(null);
  const tragar = useRef(false);
  const a = (i) => { setAbre({ gid: grupos[i].id, ids: lista(grupos[i]) }); setSi(inicio(grupos[i])); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (grupos[abierto]) a(abierto); }, [abierto]);
  // el link vale una vez: después, cada círculo abre donde corresponde (este efecto corre DESPUÉS del de arriba)
  useEffect(() => { desdeR.current = ''; }, []);
  // ⬅️ EL «ATRÁS» DEL CELULAR CIERRA EL VISOR, como Instagram (Dlx, 18/10/2026, a las ideas de historias: «todas»). Al
  // abrir se suma un paso al historial —la misma dirección— y «Atrás» lo saca. Si se cierra de otra forma (la X, deslizar,
  // terminar), el paso se saca acá. ⚠️ Yendo a otro lado desde una historia (`ir`) el paso se queda y se le borra la
  // marca: un `history.back()` en ese momento haría que app.js vuelva a enrutar y cerraría lo que se acaba de abrir
  const cerrarR = useRef(onCerrar);
  cerrarR.current = onCerrar;
  const paso = useRef(false);
  useEffect(() => {
    try { history.pushState(Object.assign({}, history.state || {}, { lgHv: 1 }), ''); paso.current = true; } catch (e) { paso.current = false; }
    const pop = () => { if (paso.current) { paso.current = false; cerrarR.current(); } };
    window.addEventListener('popstate', pop);
    return () => {
      window.removeEventListener('popstate', pop);
      if (paso.current && history.state && history.state.lgHv) {
        paso.current = false;
        try { history.back(); } catch (e) { /* queda un paso de más: «Atrás» vuelve a la misma página */ }
      }
    };
  }, []);
  const soltarPaso = () => {
    if (!paso.current) return;
    paso.current = false;
    try { const st = Object.assign({}, history.state || {}); delete st.lgHv; history.replaceState(st, ''); } catch (e) { /* sin historial */ }
  };
  // 👏 los aplausos (Felicitar, como en Publicaciones) y la imagen para historias
  const A = useAplausos();
  // tus reacciones (las del Pase) y los comentarios, para la barra de abajo
  const P = usePase(typeof window !== 'undefined' && !!window.DC);
  useComentarios();
  const [img, setImg] = useState('');
  const gid = abre.gid;
  const gi = grupos.findIndex((x) => x.id === gid);
  const g = gi >= 0 ? grupos[gi] : null;
  // las historias de la lista que siguen existiendo (los datos se rehacen cada minuto: una pudo irse)
  const ids = g ? abre.ids.filter((id) => g.slides.some((s) => s.id === id)) : [];
  const hay = !!g && ids.length > 0;
  const idAct = ids[Math.min(si, ids.length - 1)];
  // si un refresco dejó la historia de más allá del final (se fue una), vuelve a la última que queda
  useEffect(() => { if (ids.length && si > ids.length - 1) setSi(ids.length - 1); }, [ids.length, si]);
  // 🔒 la página de atrás no se mueve mientras mirás (como el visor de tarjetas)
  useEffect(() => {
    const b = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = b; };
  }, []);
  // vista apenas se muestra
  useEffect(() => { if (idAct) onVisto(idAct); }, [idAct, onVisto]);
  // si su grupo desaparece (el evento en vivo terminó), el visor se cierra en vez de quedar abierto y vacío
  useEffect(() => { if (!hay) onCerrar(); }, [hay, onCerrar]);
  // el foco entra al visor: con el teclado, Escape y las flechas ya andaban, pero el Tab seguía en la página de atrás
  useEffect(() => { if (cerrarB.current) cerrarB.current.focus({ preventScroll: true }); }, []);
  const siguiente = () => {
    if (!g) return;
    if (si < ids.length - 1) { setSi(si + 1); return; }
    // el próximo círculo con algo sin ver; si no queda ninguno, se cierra
    const j = grupos.findIndex((x, k) => k > gi && pend(x).length);
    if (j >= 0) a(j); else onCerrar();
  };
  const anterior = () => {
    if (!g) return;
    if (si > 0) setSi(si - 1); else if (gi > 0) a(gi - 1);
  };
  // ↔️ deslizar: al círculo siguiente o al anterior, como Instagram
  const saltar = (paso) => {
    if (paso > 0) { const j = grupos.findIndex((x, k) => k > gi && x.slides.length); if (j >= 0) a(j); else onCerrar(); }
    else if (gi > 0) a(gi - 1);
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
    // las barras de esta historia en adelante, vacías: al volver con «anterior», la que dejaste quedaba a medio llenar
    if (barras.current) barras.current.querySelectorAll('b').forEach((x, n) => { if (n >= si) x.style.width = '0'; });
    // 🖼️ ¿hay imágenes sin cargar en la historia? El reloj espera, hasta 2,5 s
    cargando.current = false;
    const imgs = cuerpoR.current ? [...cuerpoR.current.querySelectorAll('img')].filter((im) => !im.complete) : [];
    let espera = 0;
    if (imgs.length) {
      cargando.current = true;
      let faltan = imgs.length;
      const listo = () => { faltan -= 1; if (faltan <= 0) cargando.current = false; };
      imgs.forEach((im) => { im.addEventListener('load', listo, { once: true }); im.addEventListener('error', listo, { once: true }); });
      espera = setTimeout(() => { cargando.current = false; }, 2500);
    }
    // ⏱️ CUÁNTO DURA, SEGÚN LO QUE MUESTRA (Dlx, 18/10/2026, a las ideas de historias: «todas»): una carta sola, poco;
    // una lista, más. Se cuenta lo que hay para leer —letras y renglones— y queda entre 4,5 y 12 segundos
    let dur = 5000;
    if (cuerpoR.current) {
      const letras = (cuerpoR.current.textContent || '').length;
      const filas = cuerpoR.current.querySelectorAll('li').length;
      dur = Math.max(4500, Math.min(12000, 3500 + letras * 30 + filas * 400));
    }
    // 🔥 las fuertes (el doble campeón, la caza, la letra alta) se quedan 12 s, como en el escenario
    const sAct = g.slides.find((x) => x.id === ids[Math.min(si, ids.length - 1)]);
    if (sAct && sAct.lento) dur = Math.max(dur, 12000);
    foco.current = false;
    const tick = (t) => {
      // ⏱️ con tope: al volver de otra pestaña o de la pantalla bloqueada, `t - antes` eran minutos y la historia se
      // salteaba de golpe. Y con la pestaña oculta, quieta
      if (!pausa.current && !foco.current && !cargando.current && !document.hidden) acum += Math.min(100, t - antes);
      antes = t;
      if (barra.current) barra.current.style.width = Math.min(100, (acum / dur) * 100) + '%';
      if (acum >= dur) { sig.current(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); clearTimeout(espera); };
  }, [gid, si, hay]);
  useEffect(() => {
    if (!hay) return undefined;
    // (escribiendo una respuesta, las flechas mueven el cursor y Escape sale de la caja: no pasan de historia)
    const k = (e) => {
      const t = e.composedPath ? e.composedPath()[0] : e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) { if (e.key === 'Escape') t.blur(); return; }
      if (e.key === 'Escape') onCerrar(); if (e.key === 'ArrowRight') sig.current(); if (e.key === 'ArrowLeft') ant.current();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [hay, onCerrar]);
  const ir = useMemo(() => (d) => {
    if (!d) return;
    soltarPaso();
    onCerrar();
    // 📣 abrir una promo desde su historia también paga (ver `promoAbierta()`)
    if (d.promo) promoAbierta(d.promo);
    if (d.carta) accion.carta(d.carta, d.cual);
    else if (d.perfil) accion.perfil(d.perfil);
    else if (d.llave) accion.llave(d.llave);
    else if (d.ruta) location.hash = d.ruta;
    else if (d.video) abrirVideo(d.video);
    else if (d.link) window.open(d.link, '_blank', 'noopener');
    else if (d.ancla) accion.ir(d.ancla);
  }, [onCerrar, raiz]);
  // 💬 CUÁNTOS COMENTARIOS FLOTANTES ENTRAN EN ESTA HISTORIA (17/11/2026): el cuerpo les reserva el lugar abajo y el
  // contenido se vuelve a centrar más arriba, así no lo tapan. Dos si entran, si no uno, si no ninguno (medido: con dos
  // fijos pisaban la carta o el flyer en 26 de 59 historias a 390 px). Cada burbuja son 46 px + 6 de aire, y 16 más
  // entre el contenido y la de arriba. Con un ResizeObserver: la carta y el flyer terminan de bajar después
  const [filasF, setFilasF] = useState(2);
  useLayoutEffect(() => {
    const cu = cuerpoR.current;
    const st = cu && cu.querySelector('.st');
    if (!st) return undefined;
    const medir = () => setFilasF(Math.max(0, Math.min(2, Math.floor((cu.clientHeight - st.offsetHeight - 22) / 52))));
    medir();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(medir);
    ro.observe(st);
    ro.observe(cu);
    return () => ro.disconnect();
  }, [idAct, hay]);
  if (!hay) return null;
  const s = g.slides.find((x) => x.id === idAct) || g.slides[0];
  // ⏭️ la que sigue —en este círculo o la primera sin ver del próximo—, escondida: sus imágenes bajan antes de llegar
  const proxima = (() => {
    const k = ids.indexOf(idAct);
    if (k >= 0 && k < ids.length - 1) return g.slides.find((x) => x.id === ids[k + 1]);
    const j = grupos.findIndex((x, n) => n > gi && pend(x).length);
    return j >= 0 ? grupos[j].slides.find((x) => !vistos[x.id]) : null;
  })();
  // ✋ tocar, mantener o deslizar: mantener pausa (y al soltar no pasa de historia); deslizar abajo cierra y al costado
  // cambia de círculo
  // (cada toque arranca de cero: mantener apretado «Felicitar» dejaba marcado que el próximo toque no pasara de historia)
  const empieza = (e) => { tragar.current = false; pausa.current = true; gesto.current = { x: e.clientX, y: e.clientY, t: performance.now() }; };
  const suelta = (e) => {
    pausa.current = false;
    const g0 = gesto.current;
    gesto.current = null;
    if (!g0) return;
    const dx = e.clientX - g0.x, dy = e.clientY - g0.y;
    if (dy > 90 && dy > Math.abs(dx)) { tragar.current = true; onCerrar(); return; }
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy)) { tragar.current = true; saltar(dx < 0 ? 1 : -1); return; }
    if (performance.now() - g0.t > 280) tragar.current = true;
  };
  const corta = () => { pausa.current = false; gesto.current = null; };
  const zona = (f) => () => { if (tragar.current) { tragar.current = false; return; } f(); };
  // 🔗 CADA HISTORIA TIENE SU LINK (Dlx, 18/10/2026, a las ideas: «todas»): abre la página en esa misma historia
  // (`?h=<id>`, App.jsx). Si ya no está —las historias se van con los días—, abre el Inicio
  const compartir = enlace('#/?h=' + encodeURIComponent(s.id));
  // 📸 y como imagen, para Instagram o WhatsApp, con el link en el texto (historia.js, que baja recién al tocar)
  const imagen = async () => {
    pausa.current = true;
    try {
      const H = await import('./historia.js');
      await H.armarYCompartir(() => H.imagenHistoria(liga, cuerpoR.current, s), 'liga-global-historia.png',
        'En la Liga Global: ' + compartir, setImg, 'historia');
    } catch (e) { setImg('error'); } finally { pausa.current = false; }
  };
  // 👏 reaccionar (le llega a la persona, como Felicitar en Publicaciones: `window.felicitar`) y responder, en la barra de abajo
  const soc = s.pub && s.pub.id ? <HvSocial key={s.id} liga={liga} it={s.pub} A={A} P={P} onFoco={onFoco} onIr={ir} /> : null;
  // 💬 los comentarios de su publicación, flotando arriba de la barra como en un vivo (17/11/2026): más seguido que en el
  // Inicio, porque una historia dura segundos, y los que entran sin tapar el contenido (`filasF`, arriba)
  const hiloS = s.pub && s.pub.id ? delHilo(s.pub, Date.now()) : [];
  const flot = hiloS.length >= 2 && filasF > 0 ? <ComentariosFlotantes key={'cf' + s.id} liga={liga} it={s.pub} hilo={hiloS} cls="cfl-hist" cada={1700} max={filasF}
    onAbrir={() => ir({ ruta: '#/publicaciones/' + encodeURIComponent(s.pub.id) })} /> : null;
  // 🌆 la escena de fondo: la de su servidor (`esc`, dos en el clásico); sin una, la del círculo
  const escs = [...new Set((Array.isArray(s.esc) ? s.esc : [s.esc || g.sv || 'dra']).map(escenaDe).filter(Boolean))];
  const ctaB = s.cta && s.ir && Object.values(s.ir).some(Boolean) ? <button type="button" className="btn verde hv-cta" onClick={() => ir(s.ir)}>{s.cta}</button> : null;
  const perfil = g.tipo === 'gente' ? '#/r/' + encodeURIComponent(g.k)
    : g.tipo === 'pais' ? '#/pais/' + g.cc
      : g.tipo === 'crew' ? '#/crew/' + encodeURIComponent(g.crew.clave || g.crew.crew)
        : g.tipo === 'sv' ? '#/sv/' + encodeURIComponent(g.nom) : g.tipo === 'liga' ? '#/ranking'
          : g.tipo === 'yo' ? '#/r/' + encodeURIComponent(g.k)
            // 🎬 las promos viven en Publicaciones (18/11/2026): caían en el '#/eventos' de abajo, que es del círculo En vivo
            : g.tipo === 'promos' ? '#/publicaciones' : '#/eventos';
  const circuloDe = (x) => (x.tipo === 'gente' || x.tipo === 'yo' ? <CaraH liga={liga} k={x.k} nombre={x.nom} cc={x.cc} />
    : x.tipo === 'liga' ? <span className="h-c"><img alt="" src="/ul.png" /></span>
    : x.tipo === 'promos' ? <span className="h-c"><Orbe /></span>
    : x.tipo === 'pais' ? <span className="h-c bandera"><img alt="" src={'/banderas/g/' + x.cc + '.webp'} /></span>
      : x.tipo === 'crew' ? <CrewCirculo c={x.crew} />
        : <span className="h-c"><img alt="" src={x.logo} /></span>);
  const circulo = circuloDe(g);
  // 🖥️ EN LA COMPU, LOS CÍRCULOS DE AL LADO A LOS COSTADOS (como Instagram en escritorio): chicos y apagados, con su
  // escena; tocar uno salta a ese círculo. En el celular no se dibujan (vivo.css)
  const vecinos = (d) => { const xs = []; for (let j = gi + d; j >= 0 && j < grupos.length && xs.length < 2; j += d) if (grupos[j].slides.length) xs.push(j); return xs; };
  const mini = (j, lejos) => {
    const x = grupos[j];
    const s0 = x.slides.find((y) => !vistos[y.id]) || x.slides[0];
    const u = escenaDe(Array.isArray(s0.esc) ? s0.esc[0] : s0.esc || x.sv || 'dra');
    return (
      <button key={x.id} type="button" className={'hv-mini' + (lejos ? ' lejos' : '')} onClick={() => a(j)} aria-label={'Ver las historias de ' + x.nombre}>
        {u ? <i className="hv-mini-f" style={{ backgroundImage: 'url(' + u + ')' }} aria-hidden="true" /> : null}
        <span className="hv-mini-c">{circuloDe(x)}<b>{x.nombre}</b><small>{s0.cuando || ''}</small></span>
      </button>
    );
  };
  const izq = vecinos(-1).reverse();
  const der = vecinos(1);
  return (
    <div className="hv-ov" onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="hv-box" role="dialog" aria-modal="true" aria-label="Historias"
        onPointerDown={empieza} onPointerUp={suelta} onPointerCancel={corta} onPointerLeave={corta}>
        {escs.length ? <div className={'hv-fondo' + (escs.length > 1 ? ' dos' : '')} key={'f' + s.id} aria-hidden="true">{escs.map((u) => <i key={u} style={{ backgroundImage: 'url(' + u + ')' }} />)}</div> : null}
        <div className="hv-velo" aria-hidden="true" />
        <div className="hv-bars" ref={barras}>{ids.map((id, i) => <i key={id} className={i < si ? 'hecho' : ''}><b ref={i === si ? barra : null} style={{ width: 0 }} /></i>)}</div>
        <div className="hv-cab">
          {/* 🔴 soltar el paso del historial ANTES de cerrar (pasada del 19/10/2026): si no, el `history.back()` del cierre
              deshacía la navegación al perfil y quedabas en el Inicio */}
          <a className="hv-quien" href={perfil} onClick={() => { soltarPaso(); onCerrar(); }} aria-label={'Ir al perfil de ' + g.nombre}>{circulo}<span><b>{g.nombre}</b><small>{s.cuando || ''}</small></span></a>
          <Compartir cls="hv-comp" url={compartir} texto={'En la Liga Global: ' + g.nombre} etiqueta="" />
          <button type="button" className={'hv-comp hv-img' + (img ? ' ' + img : '')} aria-label="Guardar como imagen para tus historias"
            title="Como imagen, para tus historias" disabled={img === 'armando'} onClick={imagen}><Ico n="imagen" t={22} /></button>
          <button type="button" className="hv-x" aria-label="Cerrar las historias" onClick={onCerrar} ref={cerrarB}><Ico n="cerrar" t={22} /></button></div>
        <div className="hv-cuerpo" ref={cuerpoR} style={flot ? { paddingBottom: 16 + filasF * 52 - 6 } : undefined}><div className="st" key={s.id}><span className={'st-tag' + (s.tono ? ' ' + s.tono : '')}>{s.tag}</span>{s.cuerpo}</div></div>
        {proxima ? <div className="hv-sig" aria-hidden="true" ref={(el) => { if (el) el.setAttribute('inert', ''); }}>
          <div className="st"><span className={'st-tag' + (proxima.tono ? ' ' + proxima.tono : '')}>{proxima.tag}</span>{proxima.cuerpo}</div></div> : null}
        {img === 'armando' || img === 'bajada' || img === 'error' ? <p className="hv-est" role="status">{img === 'armando' ? 'Armando la imagen…'
          : img === 'bajada' ? 'Imagen guardada' : 'No pude armar la imagen'}</p> : null}
        {ctaB || soc ? <div className="hv-pie">{flot}{ctaB}{soc}</div> : null}
        <button type="button" className="hv-zona izq" aria-label="Anterior" onClick={zona(anterior)} />
        <button type="button" className="hv-zona der" aria-label="Siguiente" onClick={zona(siguiente)} />
      </div>
      {izq.length ? <div className="hv-lado izq">{izq.map((j, i) => mini(j, izq.length > 1 && i === 0))}</div> : null}
      {der.length ? <div className="hv-lado der">{der.map((j, i) => mini(j, i === 1))}</div> : null}
      <button type="button" className="hv-fl izq" aria-label="Historia anterior" onClick={anterior}><Chevron /></button>
      <button type="button" className="hv-fl der" aria-label="Historia siguiente" onClick={siguiente}><Chevron /></button>
    </div>
  );
}
