// 🛍️ LO QUE CADA UNO SE PUSO EN LA TIENDA, EN TODA LA PÁGINA (tanda 3, 17/11/2026; Dlx: «dale, sigue con la tanda 3»).
//
// Qué tiene puesto cada perfil viaja en `/avisos/pases` (`tp`: `{clave: {ranura: pieza}}`, por clave y nunca por
// cuenta; `ta`: la versión del arte), que cada página ya baja y que el borde guarda cinco minutos. Ponerse algo tira
// esa copia en el objeto (`RUTA_TABLAS`), y quien se lo puso la vuelve a pedir al toque (`refrescarPases()`).
//
// El ARTE no vive en el repo (las piezas son sorpresa hasta que salen): llega del objeto por `/avisos/tienda-uso`, la
// versión liviana —sin las vistas previas de la Tienda—, guardada en el borde y en este navegador por versión. Y SÓLO SE
// BAJA SI ALGUIEN A LA VISTA TIENE ALGO PUESTO: quien mira una página sin nada de la Tienda no paga nada.
//
// ⚠️ Viene como MOLDES de HTML (la CSP no deja ejecutar código que llegue del servidor), con sus clases con `ta-` y su
// CSS debajo de `.ta-raiz`: por eso cada capa lleva `ta-raiz`. Los huecos: __FOTO__, __CARTA__ y __N__.
import { createElement, useEffect, useState } from 'react';
import { usePases } from './pase.js';
import { usarCss } from './css.js';

const W = typeof window !== 'undefined' ? window : {};
const LS = 'lg:tienda-uso';
let ARTE = null, arteP = null;

// lo que la página necesita además del arte: dónde va cada capa. Viaja con el arte, así no pesa a quien no lo usa
const CSS_PAGINA = `
.con-tienda{overflow:visible!important}
.con-tienda>.ct-in{position:relative;display:block;width:100%;height:100%;border-radius:inherit}
.con-tienda>.ct-in>img{border-radius:inherit}
/* 🛡️ la cara llena su caja aunque su página no lo diga: con el aro, overflow:visible dejaba una foto sin regla a su
   tamaño real (25/11/2026, «Ahora y quién» del Dashboard). :where = sin peso: cualquier regla de la página le gana */
:where(.con-tienda>.ct-in)>img{width:100%;height:100%;object-fit:cover;display:block}
.ini>.ct-in{display:grid;place-items:center}
.cara-tienda{position:absolute;inset:-33.4%;pointer-events:none;z-index:1}
.app .con-aro.sp-prem-aro,.app .con-aro.sp-prem-aro-g,.app .con-aro.pc-oro{box-shadow:none}
.ta-raiz.nom-tienda{--tx:currentColor;display:inline}
.nom-tienda .ta-nom{font-family:inherit!important;font-size:inherit!important;font-weight:inherit!important;font-stretch:inherit!important;
  letter-spacing:inherit!important;line-height:inherit!important;vertical-align:baseline;max-width:100%}
/* en una fila angosta (el ranking, un nombre con su cara, la ficha) se corta con «…» como el nombre de siempre */
.rk-qa .nom-tienda .ta-nom,.qn .nom-tienda .ta-nom,.fh-t .nom-tienda .ta-nom{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom}
.ct-host{position:relative;display:block;width:fit-content;max-width:100%;line-height:0}
.ct-fx{position:absolute;inset:0;pointer-events:none;z-index:1}
.ct-fx>.ta-carta{width:100%;height:100%;aspect-ratio:auto}
.ct-fx.sin-img .ta-carta>img{opacity:0}
.vk-gira>.ct-host{height:100%;max-width:100%}
.vk-gira>.ct-host>img{height:100%}
.vk-esc>.fondo-tienda{opacity:.6}
.fondo-tienda{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0}
.fondo-tienda>.ta-fondo{position:absolute;inset:0}
.perfil-tienda{position:absolute;inset:0;pointer-events:none;z-index:3;overflow:hidden}
.rk-q:has(>.fondo-tienda){position:relative;isolation:isolate}
.pn-vs-f.izq>.fondo-tienda{-webkit-mask-image:linear-gradient(90deg,#000 35%,transparent 95%);mask-image:linear-gradient(90deg,#000 35%,transparent 95%)}
.pn-vs-f.der>.fondo-tienda{-webkit-mask-image:linear-gradient(270deg,#000 35%,transparent 95%);mask-image:linear-gradient(270deg,#000 35%,transparent 95%)}
.rk-q>.fondo-tienda{inset:-6px -8px;z-index:-1;border-radius:3px;-webkit-mask-image:linear-gradient(90deg,#000 45%,transparent 92%);mask-image:linear-gradient(90deg,#000 45%,transparent 92%)}
.rk-q:has(>.fondo-tienda) .rk-qa>a,.rk-q:has(>.fondo-tienda) .rk-qa>b,.rk-q:has(>.fondo-tienda) small{color:#F6F6F6}
`;

const leerLS = () => { try { return JSON.parse(W.localStorage.getItem(LS) || 'null'); } catch (e) { return null; } };
function aplicar(a) {
  ARTE = a;
  usarCss('tienda-uso-' + a.v, a.css + CSS_PAGINA);
  try { W.dispatchEvent(new Event('lg:tienda-uso')); } catch (e) { /* nada */ }
}
/** Baja el arte de la versión `v` (una vez; del navegador si ya lo tiene). Si el borde da una vieja, una vez `?r=` */
export function pedirArte(v) {
  if (!v) return Promise.resolve(null);
  if (ARTE && ARTE.v === v) return Promise.resolve(ARTE);
  const c = leerLS();
  if (c && c.v === v && c.p) { aplicar(c); return Promise.resolve(c); }
  if (arteP) return arteP;
  const bajar = (fresco) => fetch('/api/avisos/tienda-uso' + (fresco ? '?r=' + Date.now() : '')).then((r) => (r.ok ? r.json() : null));
  arteP = bajar(false).then((j) => (j && j.ok && j.v !== v ? bajar(true) : j)).then((j) => {
    arteP = null;
    if (j && j.ok && j.p) {
      const a = { v: j.v, css: j.css || '', p: j.p };
      try { W.localStorage.setItem(LS, JSON.stringify(a)); } catch (e) { /* sin lugar: igual se usa */ }
      aplicar(a);
    }
    return ARTE;
  }).catch(() => { arteP = null; return null; });
  return arteP;
}
function useArte(v) {
  const [a, setA] = useState(() => (v && ARTE ? ARTE : null));
  useEffect(() => {
    if (!v) return undefined;
    const f = () => setA(ARTE);
    W.addEventListener('lg:tienda-uso', f);
    pedirArte(v).then(f);
    return () => W.removeEventListener('lg:tienda-uso', f);
  }, [v]);
  return v ? a : null;
}

/** Lo que tiene puesto el perfil `k` y el arte para dibujarlo: `{t: {ranura: pieza}, A}`, o `null` */
export function usePuesto(k) {
  const pub = usePases();
  const t = k && pub && pub.tp ? pub.tp[k] || null : null;
  const A = useArte(t ? pub.ta : '');
  return t && A ? { t, A } : null;
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const llenar = (h, x) => String(h || '').split('__FOTO__').join(esc(x.foto || '')).split('__CARTA__').join(esc(x.carta || '')).split('__N__').join(esc(x.n || ''));
const molde = (P, ranura, campo) => { const id = P && P.t[ranura]; const a = id && P.A.p[id]; return a && a[campo] ? a[campo] : ''; };
// `--dragon`: el logo que usan algunos moldes (stickers, el sobre); `--carta`: la imagen de la carta, para los efectos que
// se recortan con su forma (como `envolver()` de tienda3.jsx)
const sinComillas = (u) => String(u || '').replace(/['"()\\]/g, '');
const capa = (cls, html, extra, carta) => createElement('span', Object.assign({ className: 'ta-raiz ' + cls, 'aria-hidden': 'true',
  style: Object.assign({ '--dragon': "url('/ul-blanco.png')" }, carta ? { '--carta': "url('" + sinComillas(carta) + "')" } : {}),
  dangerouslySetInnerHTML: { __html: html } }, extra || {}));

/** 👤 el aro y la decoración alrededor de una cara (lo usa `Cara`): `null` si no tiene */
export function capaCara(P) {
  const aro = molde(P, 'aro', 'aro'), deco = molde(P, 'deco', 'deco');
  if (!aro && !deco) return null;
  return capa('cara-tienda', (aro ? '<span class="ta-av-capa">' + aro + '</span>' : '') + (deco ? '<span class="ta-av-capa">' + deco + '</span>' : ''));
}
export const tieneAro = (P) => !!molde(P, 'aro', 'aro');

/** ✍️ el nombre con su efecto, o `null` si no tiene uno puesto */
export function nombreTienda(P, n) {
  const id = P && P.t.nom, a = id && P.A.p[id];
  if (!a || !a.nom) return null;
  const html = a.letras
    ? '<span class="ta-nom ta-' + esc(id.toLowerCase()) + '" data-t="' + esc(n) + '">' + [...String(n)].map((ch, i) => '<span class="ta-l" style="animation-delay:' + (i * 0.13).toFixed(1) + 's">' + esc(ch) + '</span>').join('') + '</span>'
    : llenar(a.nom, { n });
  return capa('nom-tienda', html, { 'aria-hidden': undefined, title: n });
}

// 🃏 CADA EFECTO ES DE UNA SOLA CARTA (28/11/2026, Dlx: «1. dale 2. dale 3. dale»): la Temporada lleva el suyo en `carta`
// (donde ya estaba todo lo puesto) y las otras tres, en su ranura. La misma tabla que `RANURA_FX` de bot/tienda.js
export const RANURA_FX = { temporada: 'carta', competitivo: 'carta-comp', servidor: 'carta-sv', pais: 'carta-pais' };
export const CARTA_FX_N = { temporada: 'Temporada', competitivo: 'Competitiva', servidor: 'Servidor', pais: 'País' };
/** La ranura de una pieza: la de su carta si es un efecto (sin decirlo, Temporada), si no su categoría */
export const ranuraDe = (p) => (!p ? '' : p.c === 'carta' ? RANURA_FX[p.carta] || RANURA_FX.temporada : p.c);
/** De qué carta es un efecto (`temporada` si el catálogo no lo dice) */
export const cartaDeFx = (p) => (p && RANURA_FX[p.carta] ? p.carta : 'temporada');
/** «Para tu Temporada» · «Para tu Competitiva»… */
export const paraTu = (p) => 'Para tu ' + CARTA_FX_N[cartaDeFx(p)];
// la carta de una imagen, por su dirección (`<clave>/<carta>.webp`, `.chica.webp`, la foto con marco `-m.webp`, la de
// Servidor de otro socio `sv-<x>.webp`); '' si no es ninguna de las cuatro (una de liga, la muestra de la Tienda)
const CUAL_SRC = /\/(temporada|competitivo|servidor|pais|sv-[a-z0-9]+)(?:-m)?(?:\.chica)?\.(?:webp|png)/;
export function cualDe(src) {
  const m = CUAL_SRC.exec(String(src || ''));
  return !m ? '' : m[1].slice(0, 3) === 'sv-' ? 'servidor' : m[1];
}

/** 🃏 el efecto de carta encima de la imagen de una carta (`hijo`); sin efecto, `hijo` tal cual */
// `sinImg`: encima de algo que ya es la carta (la armable, en su iframe), sólo el efecto: la imagen del molde no se ve
// `host`: atributos para el contenedor (su clase y, p. ej., `data-o`), cuando el lugar ubica la carta por ellos
// `cual`: qué carta es; sin decirlo, se saca de `src`. Lleva el efecto de ESA carta, o ninguno
export function ConEfecto({ P, src, cual, sinImg, host, children }) {
  const c = cual || cualDe(src);
  const h = c ? molde(P, RANURA_FX[c], 'carta') : '';
  if (!h || !src) return children;
  const hp = Object.assign({}, host || {}, { className: 'ct-host' + (host && host.className ? ' ' + host.className : '') });
  return createElement('span', hp, children, capa('ct-fx' + (sinImg ? ' sin-img' : ''), llenar(h, { carta: src }), null, src));
}

/**
 * 🃏 UNA <img> DE CARTA SUELTA CON EL EFECTO DE QUIEN ES (25/11/2026, Dlx: «the effects should appear wherever they show
 * the cards»). El Inicio, la carta junto a tu puesto y las tarjetitas del perfil dibujaban la imagen sola y el efecto no
 * salía. Sin efecto puesto, la MISMA <img> de antes (nada cambia para los demás); con efecto, la clase y los `data-*` que
 * la ubican pasan al contenedor, y la imagen lo llena: el CSS de esos lugares los toma con `>:is(img,.ct-host)`.
 */
export function CartaFx({ k, src, cual, className, data, ...img }) {
  const P = usePuesto(k);
  const d = data || {};
  const c = cual || cualDe(src);
  if (!src || !c || !molde(P, RANURA_FX[c], 'carta')) return createElement('img', Object.assign({ alt: '', src, className }, d, img));
  return createElement(ConEfecto, { P, src, cual: c, host: Object.assign({ className }, d) }, createElement('img', Object.assign({ alt: '', src }, img)));
}

/** 🖼️ el fondo de la Tienda para un lugar (`perfil` · `vs` · `esc` · `ficha` · `fila`), como capa: `null` si no tiene */
const RANURA_LUGAR = { perfil: 'fp', vs: 'fv', esc: 'fe', ficha: 'ff', fila: 'fr' };
export function fondoTienda(P, lugar) {
  const h = molde(P, RANURA_LUGAR[lugar], 'fondo');
  return h ? capa('fondo-tienda', h) : null;
}
export const tieneFondo = (P, lugar) => !!molde(P, RANURA_LUGAR[lugar], 'fondo');

/** 🎭 lo de tu perfil (stickers, la entrada, la pancarta), encima de la portada: `null` si no tiene */
export function capaPerfil(P, foto, n) {
  const h = molde(P, 'perfil', 'capa');
  return h ? capa('perfil-tienda', llenar(h, { foto, n })) : null;
}

// ── las mismas piezas como componentes, para los lugares que dibujan en una función sin estado ──
/** El nombre de `k` con su efecto de la Tienda, o el nombre tal cual */
export function NombreT({ k, n }) { return nombreTienda(usePuesto(k), n) || n; }
/** El fondo de la Tienda de `k` para `lugar`, como capa detrás (el contenedor tiene que estar posicionado), o nada */
export function FondoT({ k, lugar }) { return fondoTienda(usePuesto(k), lugar); }
/** Lo del perfil de `k` (stickers, entrada, pancarta) encima de su portada, o nada */
export function CapaPerfilT({ k, foto, n }) { return capaPerfil(usePuesto(k), foto, n); }
