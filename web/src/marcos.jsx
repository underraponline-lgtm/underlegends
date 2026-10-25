// 🖼️ LOS MARCOS DE CARTA (25/10/2026). Dlx: «cada tarjeta es diferente… crear diferentes marcos para cada tarjeta», «el
// marco crece con el nivel» (la v5), «Corona en las cuatro», «Anillo + pieza principal» en chico, y de la Servidor, «Las 2.
// Una elige… se quedan permanentemente en el inventario de uno. Así la gente puede personalizar su tarjeta poco a poco».
// La maqueta cerrada es la v8 (artifact 2dYhZ4pYpq1doHNrahisJa).
//
// Cada carta tiene su marco, que sale de su mundo, y cada nivel le suma una pieza:
//   · Temporada (el boleto): canto + esquinas de visor → + el talón con tu número de serie → + la corona
//   · Competitiva (el rango): doble línea + un galón → + hombreras y dos galones → + la corona
//   · Servidor, a elegir: la CAMISETA (el puño del color del servidor → + el brazalete de capitán → + la corona) o la
//     CADENA (fina → gruesa → + la corona)
//   · País (la bandera): la cinta con tu bandera → + el estandarte con tu país → + la corona
// Todo sigue la forma de la carta con UN filtro SVG (`feMorphology`: veinte sombras colgaban el navegador), plano y de una
// tinta. El Oro brilla con una franja dura (no un degradé) y se queda quieto con «Menos animaciones» o el sistema en
// reducido. Chica (menos de 200 px de ancho): sólo el anillo y la pieza principal.
//
// ⚠️ LA CARTA NO CAMBIA: el marco es de la página. La de Discord sale igual que siempre.
import { Fragment, useId } from 'react';
import { PAIS } from './liga.js';

const METAL = { premium: '#E41373', plata: '#C9CDD4', oro: '#F5C542' };
const NEGRO = '#030304';
const CL = { temporada: 't', competitivo: 'c', servidor: 's', pais: 'p' };

// el color del servidor para la franja: los del payload son oscuros a propósito (fondos), y contra el negro no se ven.
// Se aclara hasta que se lea, sin cambiarle el tono
function vivo(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return '#8B3DFF';
  let [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (lum < 0.32) {
    const k = Math.min(0.7, (0.32 - lum) / 0.32 + 0.15);
    const mx = Math.max(r, g, b) || 1;
    [r, g, b] = [r, g, b].map((x) => Math.round(x / mx * 255 * (0.55 + k * 0.45)));
  }
  return '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('');
}

const svg64 = (s) => 'data:image/svg+xml;base64,' + btoa(s);
// ⛓️ LA CADENA, ESLABÓN POR ESLABÓN SOBRE EL CONTORNO DE LA CARTA (Dlx, 25/10/2026: «esta última foto de la cadena se ve
// rara… fíjate bien»). Antes era una trama de anillos pegada con `feTile` a la franja del filtro: la trama no sabe
// hacia dónde va el borde, así que los anillos salían cortados al azar y se leía como una malla, no como una cadena.
// Ahora es un trazo que RECORRE la silueta de la Servidor (el pico de comun/siluetas.py, corrido hacia afuera), con dos
// guiones alternados: el eslabón de frente (un óvalo con su agujero) y el de canto (una barrita), como se dibuja una
// cadena. La imagen de R2 mide 300 × 459.75 en esas unidades y la carta empieza 54.75 más abajo (el escudo sobresale
// arriba): medido sobre las cartas de Kravitz, Oasis, Makmah y Erian, iguales las cuatro
const PICO = [[129.2, 0], [170.8, 0], [296.7, 30.4], [300, 356.5], [292, 365.4], [281.5, 369.4], [150, 405],
  [18.5, 369.4], [8, 365.4], [0, 356.5], [3.3, 30.4]];
const PICO_Y = 54.75, PICO_H = 459.75;
// 🛡️ el escudo del servidor, que sobresale arriba: la cadena llega hasta él y no lo cruza (Dlx, 25/10/2026: «la cadena
// está encima del logo del servidor»). Medido igual que el pico: centro (150, 60.4), radio 37.6 con su borde
const ESCUDO = [150, 60.4, 37.6];
// el contorno corrido `d` hacia afuera: cada lado se desplaza por su normal y los vértices son los cruces (el pico es
// convexo, así que alcanza)
function afuera(pts, d) {
  const n = pts.length;
  const lados = pts.map((a, i) => {
    const b = pts[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    return [[a[0] + (dy / L) * d, a[1] - (dx / L) * d], [dx, dy]];
  });
  return lados.map((l, i) => {
    const [p, r] = lados[(i + n - 1) % n], [q, t] = l;
    const den = r[0] * t[1] - r[1] * t[0];
    if (Math.abs(den) < 1e-9) return q;
    const k = ((q[0] - p[0]) * t[1] - (q[1] - p[1]) * t[0]) / den;
    return [p[0] + r[0] * k, p[1] + r[1] * k];
  });
}
const CADENA_D = {};
const cadenaD = (d) => (CADENA_D[d] = CADENA_D[d] || 'M' + afuera(PICO, d).map(([x, y]) => x.toFixed(2) + ',' + (y + PICO_Y).toFixed(2)).join(' L') + ' Z');
function Cadena({ c, grueso, id }) {
  // en unidades de la carta de 300: el eslabón de frente mide `L` de largo y `A` de ancho; el de canto, `A2` de grosor
  const L = grueso ? 13 : 9, A = grueso ? 7 : 5, A2 = grueso ? 2.6 : 2, hueco = grueso ? 2.6 : 1.8;
  const paso = L + A; // un eslabón de frente + uno de canto
  const d = cadenaD(5.6 + A / 2);
  const g = { d, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  // con la punta redonda, el guion de largo `L - A` termina midiendo `L`
  const frente = (L - A) + ' ' + (paso - L + A);
  const canto = (A + 4) + ' ' + (L - 4);
  return (
    <svg className="mk-cad" viewBox={'0 0 300 ' + PICO_H} preserveAspectRatio="none" aria-hidden="true">
      <mask id={id} maskUnits="userSpaceOnUse" x="-30" y="-30" width="360" height={PICO_H + 60}>
        <rect x="-30" y="-30" width="360" height={PICO_H + 60} fill="#fff" />
        <circle cx={ESCUDO[0]} cy={ESCUDO[1]} r={ESCUDO[2] + 2.5} fill="#000" />
      </mask>
      <g mask={'url(#' + id + ')'}>
      <path {...g} stroke={NEGRO} strokeWidth={A2 + 2} strokeDasharray={canto} strokeDashoffset={-(L - 2)} />
      <path {...g} stroke={c} strokeWidth={A2} strokeDasharray={canto} strokeDashoffset={-(L - 2)} />
      <path {...g} stroke={NEGRO} strokeWidth={A + 1.6} strokeDasharray={frente} />
      <path {...g} stroke={c} strokeWidth={A} strokeDasharray={frente} />
      <path {...g} stroke={NEGRO} strokeWidth={hueco} strokeDasharray={frente} />
      </g>
    </svg>
  );
}

/** Las capas del contorno, de afuera hacia adentro: `[radio, relleno]`. La línea negra de adentro separa el metal de la carta */
function capas(cl, tier, estilo, sv, cc) {
  const m = METAL[tier];
  if (cl === 't') return [[5.5, m], [3.5, NEGRO]];
  if (cl === 'c') return [[10, m], [8.5, NEGRO], [6, m], [3.5, NEGRO]];
  if (cl === 'p') return [[13, m], [11, cc ? ['bandera', cc] : m], [3.5, NEGRO]];
  // la cadena se dibuja aparte (`Cadena`): el filtro pone sólo la línea negra que la separa de la carta
  if (estilo === 'cadena') return [[3.5, NEGRO]];
  // la camiseta: el nivel 1, la franja del servidor con un hilo de metal; Plata y Oro, metal · servidor · metal
  return tier === 'premium' ? [[9.5, m], [8, sv], [3.5, NEGRO]] : [[12, m], [9, sv], [6, m], [3.5, NEGRO]];
}

function Filtro({ id, lista, escala }) {
  return (
    <filter id={id} x="-16%" y="-16%" width="132%" height="132%" colorInterpolationFilters="sRGB">
      {lista.map(([r, rel], i) => {
        const rr = Math.max(1, Math.round(r * escala * 10) / 10);
        let relleno;
        if (Array.isArray(rel) && rel[0] === 'bandera') relleno = <feImage href={'/banderas/' + rel[1] + '.png'} preserveAspectRatio="none" result={'f' + i} />;
        else if (Array.isArray(rel)) relleno = <><feImage href={svg64(rel[3])} x="0" y="0" width={rel[1]} height={rel[2]} result={'t' + i} /><feTile in={'t' + i} result={'f' + i} /></>;
        else relleno = <feFlood floodColor={rel} result={'f' + i} />;
        // ⚠️ SIN <g>: adentro de un <filter> sólo valen primitivas, y un <g> anula el filtro entero (pasó: salía la corona
        // y no el contorno)
        return (
          <Fragment key={i}>
            <feMorphology in="SourceAlpha" operator="dilate" radius={rr} result={'d' + i} />
            {relleno}
            <feComposite in={'f' + i} in2={'d' + i} operator="in" result={'c' + i} />
          </Fragment>
        );
      })}
      <feMerge>{lista.map((_, i) => <feMergeNode key={i} in={'c' + i} />)}<feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
  );
}

// 🌟 el anillo de afuera, en blanco: lo que recorre la franja de brillo del Oro
function FiltroBrillo({ id, a, b, escala }) {
  return (
    <filter id={id} x="-16%" y="-16%" width="132%" height="132%">
      <feMorphology in="SourceAlpha" operator="dilate" radius={Math.max(1, a * escala)} result="a" />
      <feMorphology in="SourceAlpha" operator="dilate" radius={Math.max(1, b * escala)} result="b" />
      <feComposite in="a" in2="b" operator="out" result="r" />
      <feFlood floodColor="#FFFFFF" /><feComposite in2="r" operator="in" />
    </filter>
  );
}

// ── las piezas (planas, una tinta, línea negra; en em: la carta mide 20 em) ──
const Svg = ({ cls, vb, children }) => <svg className={'mk-p ' + cls} viewBox={vb} aria-hidden="true">{children}</svg>;
function Galones({ n, c }) {
  return (
    <Svg cls="mk-gal" vb={'0 0 28 ' + (16 + 7 * (n - 1))}>
      {Array.from({ length: n }, (_, i) => <path key={i} d={'M2 ' + (14 + 7 * i) + ' L14 ' + (6 + 7 * i) + ' L26 ' + (14 + 7 * i)} fill="none" stroke={c} strokeWidth="3.6" strokeLinecap="square" />)}
    </Svg>
  );
}
function Corona({ c }) {
  return (
    <Svg cls="mk-cor" vb="0 0 60 34">
      <path d="M4 30 L8 8 L20 20 L30 2 L40 20 L52 8 L56 30 Z" fill={c} stroke={NEGRO} strokeWidth="2" strokeLinejoin="miter" />
      <rect x="4" y="27" width="52" height="5" fill={NEGRO} /><path d="M30 12 L34 18 L30 24 L26 18 Z" fill={NEGRO} />
      <circle cx="8" cy="8" r="2.6" fill={NEGRO} /><circle cx="52" cy="8" r="2.6" fill={NEGRO} />
    </Svg>
  );
}
function Hombrera({ c, lado }) {
  return (
    <Svg cls={'mk-hom ' + lado} vb="0 0 32 58">
      <path d="M30 40 L2 18 L12 34 Z M30 46 L0 34 L12 44 Z M30 52 L4 50 L14 54 Z M30 34 L8 4 L14 24 Z" fill={c} stroke={NEGRO} strokeWidth="1.6" strokeLinejoin="miter" />
    </Svg>
  );
}
function Talon({ c, n }) {
  return (
    <>
      <Svg cls="mk-tal" vb="0 0 34 200">
        <rect x="0" y="0" width="34" height="200" fill="#101012" stroke={c} strokeWidth="3" />
        <line x1="2" y1="0" x2="2" y2="200" stroke={c} strokeWidth="2" strokeDasharray="3 5" />
      </Svg>
      <span className="mk-tal-t">T1 · N.º {String(n || 0).padStart(3, '0')}</span>
    </>
  );
}
function Estandarte({ c, nombre }) {
  const largo = Math.min(150, 14 * nombre.length);
  return (
    <Svg cls="mk-est" vb="0 0 200 40">
      <path d="M2 6 L22 6 L22 34 L2 34 L10 20 Z M198 6 L178 6 L178 34 L198 34 L190 20 Z" fill={c} stroke={NEGRO} strokeWidth="2" />
      <rect x="20" y="2" width="160" height="34" fill={NEGRO} stroke={c} strokeWidth="3" />
      <text x="100" y="25.5" textAnchor="middle" fontFamily="Archivo, sans-serif" fontWeight="900" fontSize="15" letterSpacing="2"
        textLength={largo} lengthAdjust="spacingAndGlyphs" fill={c}>{nombre}</text>
    </Svg>
  );
}
function Brazalete({ c }) {
  return (
    <Svg cls="mk-bra" vb="0 0 80 40">
      <path d="M2 8 L26 4 L26 36 L2 32 Z" fill="#1A1A1E" stroke={c} strokeOpacity=".6" strokeWidth="2" />
      <path d="M26 4 L78 2 L78 38 L26 36 Z" fill={c} stroke={NEGRO} strokeWidth="2" />
      <text x="52" y="29" textAnchor="middle" fontFamily="Archivo, sans-serif" fontWeight="900" fontSize="24" fill={NEGRO}>C</text>
    </Svg>
  );
}
function Destellos() {
  return [0, 1, 2].map((i) => (
    <Svg key={i} cls={'mk-des d' + i} vb="0 0 20 20"><path d="M10 0 L12.5 7.5 L20 10 L12.5 12.5 L10 20 L7.5 12.5 L0 10 L7.5 7.5 Z" fill="#FFF7D1" /></Svg>
  ));
}

const ANILLO = { t: [5.5, 3.5], c: [10, 8.5], p: [13, 11], 's-camiseta': [12, 9], 's-cadena': [9, 3.5] };

/**
 * Le pone a `img` (la carta ya armada) el marco `m` (`[marco, estilo, serie]` de `/avisos/pases`, ver
 * `marcosPublicos()` en bot/avisos.js). `ancho`: cuánto mide en pantalla (px CSS); decide chica o completa
 */
export function ConMarco({ m, cual, ancho, svColor, cc, children, src }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const cl = CL[cual];
  const tier = m && String(m[0] || '').split(':')[1];
  if (!cl || !METAL[tier] || !(ancho > 0)) return children;
  const estilo = m[1] === 'cadena' ? 'cadena' : 'camiseta';
  const chica = ancho < 200;
  // 🔎 muy chica (la mini del álbum, una lista): sólo el contorno, las piezas no se leen y ensucian
  const mini = ancho < 130;
  const escala = Math.max(0.35, Math.min(1.3, ancho / 200));
  const c = METAL[tier];
  const plata = tier !== 'premium', oro = tier === 'oro';
  // ⛓️ en la mini no se dibujan eslabones (serían de 4 px): un canto de metal, como las otras
  const lista = cl === 's' && estilo === 'cadena' && mini ? [[6, c], [3.5, NEGRO]] : capas(cl, tier, estilo, vivo(svColor || '#8B3DFF'), cc);
  const anillo = ANILLO[cl === 's' ? 's-' + estilo : cl];
  const fid = 'mk' + uid, bid = 'mkb' + uid;
  const piezas = [];
  if (mini) return (
    <span className={'mk mk-' + cl + ' mk-' + tier + ' chica mini'} style={{ '--mk-c': c, fontSize: (ancho / 20) + 'px' }}>
      <svg className="mk-defs" width="0" height="0" aria-hidden="true"><defs><Filtro id={fid} lista={lista} escala={escala} /></defs></svg>
      <span className="mk-img" style={{ filter: 'url(#' + fid + ')' }}>{children}</span>
    </span>
  );
  if (cl === 't' && !chica) piezas.push(<i key="a" className="mk-esq a" />, <i key="b" className="mk-esq b" />, <i key="c" className="mk-esq c" />, <i key="d" className="mk-esq d" />);
  if (cl === 't' && plata && !chica) piezas.push(<Talon key="tal" c={c} n={m[2]} />);
  if (cl === 'c' && !oro) piezas.push(<Galones key="gal" n={plata ? 2 : 1} c={c} />);
  if (cl === 'c' && plata && !chica) piezas.push(<Hombrera key="hi" c={c} lado="iz" />, <Hombrera key="hd" c={c} lado="de" />);
  if (cl === 'p' && plata && !chica && cc) piezas.push(<Estandarte key="est" c={c} nombre={String(PAIS[cc] || cc).toUpperCase()} />);
  if (cl === 's' && estilo === 'camiseta' && plata && !chica) piezas.push(<Brazalete key="bra" c={c} />);
  if (oro) piezas.push(<Corona key="cor" c={c} />);
  return (
    <span className={'mk mk-' + cl + ' mk-' + tier + (chica ? ' chica' : '')} style={{ '--mk-c': c, fontSize: (ancho / 20) + 'px' }}>
      <svg className="mk-defs" width="0" height="0" aria-hidden="true">
        <defs>
          <Filtro id={fid} lista={lista} escala={escala} />
          {oro && !chica ? <FiltroBrillo id={bid} a={anillo[0]} b={anillo[1]} escala={escala} /> : null}
        </defs>
      </svg>
      <span className="mk-img" style={{ filter: 'url(#' + fid + ')' }}>{children}</span>
      {cl === 's' && estilo === 'cadena' ? <Cadena c={c} grueso={plata} id={'mkc' + uid} /> : null}
      {oro && !chica && src ? <img className="mk-bri" src={src} alt="" style={{ filter: 'url(#' + bid + ')' }} /> : null}
      {piezas}
      {oro && !chica ? <Destellos /> : null}
    </span>
  );
}

/** Cómo se llama un marco: «Oro · T1» */
export const nombreMarco = (id) => {
  const [t, n] = String(id || '').split(':');
  return ({ premium: 'Premium', plata: 'Plata', oro: 'Oro' }[n] || n) + ' · ' + String(t || '').toUpperCase();
};
export { METAL as MARCO_METAL };
