// 🛍️ LA TIENDA NUEVA (etapa 4, tanda 2; 17/11/2026). Es la maqueta que Dlx eligió —la 1, «La vitrina al frente», v3.2—
// aplicada entera, forma y orden (ver `remake-por-paginas`: «una maqueta elegida se aplica ENTERA»):
//   · ARRIBA, LA VITRINA como el «Se busca» del Inicio: la pieza de la semana PUESTA EN TI («Así te queda»), con sus fichas
//     abajo, que corren de derecha a izquierda con una luz del color de la rareza dando la vuelta a cada cuadrado
//   · EL PROBADOR: tu escenario fijo a la izquierda (en el celular, una franja arriba) y las ranuras y piezas a la derecha.
//     Tocar una pieza te la pone; «Ver» abre su ficha (comprar, regalar, tu lista). «Probando | Lo tuyo» para comparar
//   · «MÁS CON TUS PUNTOS» en una tira (lo que ya se pagaba: precio por cabeza, promo, crew) y el DRAGÓN DROP DEL DÍA abajo
// 🔒 APAGADA: la monta tienda2.jsx sólo si el objeto dice que está abierta o que quien mira es el dueño (el ensayo).
// 🎨 EL ARTE NO VIVE EN EL REPO (las piezas son sorpresa): llega del objeto como MOLDES de HTML con tres huecos —__FOTO__,
// __CARTA__ y __N__— que se llenan acá; su CSS va debajo de `.ta-raiz` y sus clases llevan `ta-` (ver bot/tienda.js).
// ⚠️ Lo que se ve se arma como texto (como la maqueta) y los toques se atajan en el contenedor: así la página es la maqueta
// tal cual, y cada pieza del arte, un molde. La plata la decide el objeto: acá sólo se muestra lo que él dijo.
import { RZ } from './tienda_rz.js';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DUENO, hora, num } from './liga.js';
import { useModsEstado } from './mods.js';
import CSS_PAGINA from './css/tienda3.css?inline';
import { usarCss } from './css.js';
import { refrescarPases, usePases } from './pase.js';
import { abrirConEscenario, dropQuietoSvg, pedirDrops } from './drops.jsx';
import { useIndice } from './indice.js';
import { sonar } from './sonidos.js';

usarCss('tienda3', CSS_PAGINA);

// las rarezas son las de los Dragón Drops (públicas): nombre y color. Viven en tienda_rz.js: también las usa el cuadro de
// la Tienda del panel del Inicio (17/11/2026)
const LUGARES_F = [['fp', 'Perfil'], ['fv', 'VS'], ['fe', 'Escenario'], ['fd', 'Discord'], ['ff', 'Ficha'], ['fr', 'Ranking']];
const LUGAR_DE = Object.fromEntries(LUGARES_F);
const RANURA = { aro: 'Aro', deco: 'Deco', nom: 'Nombre', carta: 'Carta', perfil: 'Perfil', serv: 'Nombre' };
const TABS = [['aro', 'Aros'], ['deco', 'Decoraciones'], ['nom', 'Nombre'], ['perfil', 'Perfil'], ['carta', 'Carta'], ['fondo', 'Fondos'], ['juego', 'Colecciones'], ['prem', 'Premium']];
// las categorías del índice de arriba: las pestañas del cajón con su nombre corto
const CATS = [['aro', 'Aros'], ['deco', 'Decos'], ['nom', 'Nombres'], ['carta', 'Cartas'], ['perfil', 'Perfil'], ['fondo', 'Fondos'], ['juego', 'Colecciones'], ['prem', 'Premium']];
const EXTRA = { nav: 'Navidad', num: 'Ediciones de 10', deseo: '♥ Tu lista' };
const DONDE = {
  aro: 'tu foto en toda la página: el ranking, los comentarios, Publicaciones, tu perfil y tu ficha',
  deco: 'tu foto en toda la página, encima de tu aro', nom: 'tu nombre en el ranking, tu perfil, tu ficha y los comentarios',
  carta: 'tus cartas en la página y en /card', perfil: 'tu perfil', serv: 'toda la Liga: tu nombre de ahora queda como alias',
  fp: 'la portada de tu perfil', fv: 'tu mitad del VS del Inicio', fe: 'el escenario de tu carta', fd: 'tu mitad del VS en vivo de Discord',
  ff: 'tu ficha', fr: 'tu fila en el ranking',
};
// ⏳ ABIERTA ANTES QUE LA TANDA 3 (17/11/2026, Dlx: «abrir ya, avisando»): lo que te pones se ve en la Tienda y todavía no
// en el resto de la página. Cuando la tanda 3 lo lleve a cada lugar, se borra esta línea y el «Se va a ver en» vuelve a «Se ve en»
// ✅ DESDE LA TANDA 3 se ve en toda la página (puesto.js) y desde la 3b en Discord: el efecto de carta en /card (la foto
// la rehace `bot/con_marco.py`, con el freno del marco) y el fondo de Discord y el efecto en el VS en vivo (`bot/kit.py`)
const EN_DISCORD = { carta: 'En /card se ve unos minutos después de ponértela.' };
const MENSAJES = ['Sin mensaje', '¡Felicitaciones!', 'Para tu próxima batalla', 'Te lo ganaste'];
const ERRORES = { incluida: 'Esta versión viene gratis con su pieza: no se compra sola.', no_la_tienes: 'Todavía no la tienes.', regalo: 'Ese artículo ya no está: recarga la Tienda.', vencido: 'Esa oferta era de ayer: hoy tienes artículos nuevos.', modo: 'En esta vista de Mods no se compra ni se guarda nada: apágala en la franja de arriba o en la página Mods.', pronto: 'Todavía no se vende: sale pronto.', saldo: 'No te alcanzan los Puntos.', ya_la_tienes: 'Ya la tienes.', premium: 'Es sólo para Premium.', no_esta: 'Ya no está en la vitrina.',
  fuera_de_fecha: 'Ya no se vende.', todavia_no: 'Todavía no está a la venta.', cerrada: 'La venta ya cerró.', agotada: 'Se agotaron.',
  no_jugaste: 'Es para quien jugó en la temporada.', usada: 'Ya te la pusiste: no se puede deshacer.', tarde: 'Pasaron las 24 horas.',
  ya_deshecha: 'Ya la deshiciste una vez.', no_se_puede: 'No se puede deshacer.', tope: 'Ya mandaste tus regalos de esta semana.',
  ya_lo_tiene: 'Ya lo tiene.', no_verificado: 'Esa persona no está verificada.', no_se_regala: 'No se regala.', verificate: 'Primero verifícate.',
  no_miembro: 'El drop del día es de los Miembros de DRA.', ya: 'Ya abriste el de hoy.', todavia: 'La billetera todavía no está lista: prueba en un rato.',
  // (18/11/2026) los dos que la hoja de error (`errorPop`) mostraba como código: «No se pudo: lista_llena»
  lista_llena: 'Tu lista está llena: saca alguna para sumar otra.', red: 'No hay conexión: prueba de nuevo.' };
const esFondo = (c) => ['fp', 'fv', 'fe', 'fd', 'ff', 'fr'].includes(c);
const seProbar = (p) => !!p && (['aro', 'deco', 'nom', 'carta'].includes(p.c) || esFondo(p.c));
// lo de tu perfil no se prueba en el escenario, pero se pone igual (sale en tu perfil)
const sePone = (p) => seProbar(p) || (!!p && p.c === 'perfil');
const tiene = (p, x) => !!p && (p.t || []).includes(x);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const enVentana = (w, t) => !!w && t >= w.desde && t < w.hasta;
// 🎄 LO DE NAVIDAD Y LO GRATIS, FUERA DE SU VENTANA (18/11/2026): el objeto contesta `fuera_de_fecha` (`vendible()` de
// bot/tienda.js) y la página lo ofrecía igual —«Reclamar gratis», «Comprar» y «Comprar todo» fallaban con «Ya no se
// vende.» un mes antes de Navidad—. La misma regla que el objeto: devuelve la ventana que lo frena, o null
function fueraNav(c, id, t) {
  const p = c.piezas[id];
  if (!p) return null;
  if (c.gratis[id] && !enVentana(c.gratis[id], t)) return c.gratis[id];
  if (tiene(p, 'nav') && c.navidad && !enVentana(c.navidad, t)) return c.navidad;
  return null;
}
// 🕐 la fecha en la zona de Ajustes (`fmtFecha()` de comun.js, 18/11/2026): estaba clavada en hora del este y a quien
// eligió otra zona le corría el día. Sin comun.js, la del dispositivo
const diaCorto = (t) => (window.fmtFecha ? window.fmtFecha(t, { day: 'numeric', month: 'numeric' }) : new Date(t).toLocaleDateString('es', { day: 'numeric', month: 'numeric' }));

// ── los precios: los mismos números que cobra el objeto (bot/tienda.js), sólo para mostrar ──
function precioIt(S, id) {
  const c = S.cat, p = c.piezas[id];
  if (!p) return 0;
  if (enVentana(c.gratis[id], Date.now())) return 0;
  const base = c.precios[p.r];
  return S.yo && S.yo.prem && !tiene(p, 'num') ? Math.round(base * c.desc.prem) : base;
}
function precioCol(S, col, set) {
  const c = S.cat, j = c.colecciones[col];
  const falta = j.piezas.filter((x) => !set.has(x));
  const suma = falta.reduce((a, x) => a + c.precios[c.piezas[x].r], 0);
  const d = S.yo && S.yo.prem ? c.desc.col_prem : c.desc.col;
  return { falta, suma, todas: j.piezas.reduce((a, x) => a + c.precios[c.piezas[x].r], 0), desc: d, p: Math.round(suma * d / 100) * 100 };
}
const pct = (d) => Math.round((1 - d) * 100) + ' %';

// ── el arte: los moldes con tu foto, tu carta y tu nombre ──
// las imágenes del molde llevan su respaldo (`data-ini`): una cara o una carta que no carga pasa a la inicial o a la muestra
function moldeX(X, h) {
  if (!h) return '';
  return h.split('src="__FOTO__"').join('src="__FOTO__" data-ini="' + X.ini + '"').split('src="__CARTA__"').join('src="__CARTA__" data-ini="' + X.cartaIni + '"')
    .split('__FOTO__').join(X.foto).split('__CARTA__').join(X.carta).split('__N__').join(X.n);
}
const envolver = (X, h) => `<span class="ta-raiz tz-w" style="--carta:url('${X.carta}');--dragon:url('/ul-blanco.png')">${h}</span>`;
// 🙂 SIN FOTO, LA INICIAL: como en el resto de la página (Dlx: «la web con la inicial»). Quien no tiene cara en la tabla,
// o tiene un link de Discord que ya murió (cambió la foto), se probaba los aros sobre un ícono de imagen rota. La cara
// que falla se anota y no se vuelve a pedir en cada repintado
const FOTO_MUERTA = new Set();
// y sin carta (sin cuenta, o todavía no tienes la de Temporada), una de muestra: la silueta de la carta y «Tu carta». Sin
// comillas simples adentro, porque va en un `url('…')` del estilo
const CARTA_MUESTRA = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 438"><rect x="3" y="3" width="294" height="432" rx="10" fill="#17191E" stroke="#3A3D45" stroke-width="6"/><rect x="24" y="24" width="252" height="250" rx="6" fill="#22252B"/><circle cx="150" cy="128" r="46" fill="#2E3138"/><path d="M78 274c8-50 40-78 72-78s64 28 72 78z" fill="#2E3138"/><text x="150" y="338" text-anchor="middle" font-family="Archivo,Arial,sans-serif" font-weight="900" font-size="34" fill="#F6F6F6">TU CARTA</text><rect x="70" y="368" width="160" height="10" rx="5" fill="#2E3138"/><rect x="95" y="392" width="110" height="10" rx="5" fill="#2E3138"/></svg>');
function inicialSvg(n) {
  const ch = ([...String(n || '').replace(/[^\p{L}\p{N}]/gu, '')][0] || '?').toUpperCase();
  return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#2A2A33"/><text x="50" y="50" dy=".35em" text-anchor="middle" font-family="Archivo,Arial,sans-serif" font-weight="900" font-size="50" fill="#F6F6F6">${ch}</text></svg>`);
}
function avatar(X, aro, deco) {
  const a = aro && X.p[aro], d = deco && X.p[deco];
  return envolver(X, `<div class="ta-av"><img class="ta-av-foto" alt="" src="${X.foto}" data-ini="${X.ini}"><div class="ta-av-capa">${a ? moldeX(X, a.aro) : ''}</div><div class="ta-av-capa">${d ? moldeX(X, d.deco) : ''}</div></div>`);
}
function nombre(X, id) {
  const a = id && X.p[id];
  if (!a) return envolver(X, `<span class="ta-nom" data-t="${X.n}">${X.n}</span>`);
  if (a.letras) return envolver(X, `<span class="ta-nom ta-${id.toLowerCase()}" data-t="${X.n}">${[...X.crudo].map((ch, i) => `<span class="ta-l" style="animation-delay:${(i * 0.13).toFixed(1)}s">${esc(ch)}</span>`).join('')}</span>`);
  return envolver(X, moldeX(X, a.nom));
}
function carta(X, id) { const a = id && X.p[id]; return envolver(X, a && a.carta ? moldeX(X, a.carta) : `<div class="ta-carta"><img alt="" src="${X.carta}" data-ini="${X.cartaIni}"></div>`); }
const vista = (X, id) => envolver(X, moldeX(X, (X.p[id] || {}).v));
const arteFondo = (X, id) => envolver(X, moldeX(X, (X.p[id] || {}).fondo));
const enLugar = (X, id) => envolver(X, moldeX(X, (X.p[id] || {}).lugar));

// ── lo que se ve ──
function cambiado(st) {
  return ['aro', 'deco', 'nom', 'carta'].some((k) => st.puesto[k] !== st.mio.puesto[k]) || Object.keys(st.fondo).some((k) => st.fondo[k] !== st.mio.fondo[k]);
}
function loPuesto(S, st, tengo) {
  const ids = [...new Set([...Object.values(st.puesto), ...Object.values(st.fondo)].filter(Boolean))];
  // (18/11/2026) sin lo que todavía no se vende (Navidad antes de su ventana, «pronto»): el objeto rechazaba la compra
  // entera, también lo que sí se vendía
  const ahora = Date.now();
  const falta = ids.filter((id) => { const p = S.cat.piezas[id]; return p && !tengo.has(id) && !(tiene(p, 'prem') && !S.yo.prem) && !tiene(p, 'num') && !tiene(p, 'pronto') && !fueraNav(S.cat, id, ahora); });
  let sueltas = falta.slice(), total = 0;
  const juegos = [];
  for (const [cid, j] of Object.entries(S.cat.colecciones)) {
    if (!j.piezas.every((x) => tengo.has(x) || ids.includes(x)) || !j.piezas.some((x) => sueltas.includes(x))) continue;
    const r = precioCol(S, cid, tengo);
    total += r.p; juegos.push({ id: cid, j, p: r.p, n: r.falta.length });
    sueltas = sueltas.filter((x) => !j.piezas.includes(x));
  }
  total += sueltas.reduce((a, id) => a + precioIt(S, id), 0);
  return { ids, falta, sueltas, juegos, total, n: sueltas.length + juegos.reduce((a, g) => a + g.n, 0) };
}
function unaEtiqueta(S, tengo, id) {
  const p = S.cat.piezas[id], g = S.cat.gratis[id], ahora = Date.now();
  if (tengo.has(id)) return '<span class="tz-tag mio">Lo tienes</span>';
  // (18/11/2026) «Gratis en Navidad» sólo dentro de su ventana; antes, desde cuándo (fuera de ella no se reclama)
  if (g && enVentana(g, ahora)) return '<span class="tz-tag nav">Gratis en Navidad</span>';
  if (g && ahora < g.desde) return `<span class="tz-tag nav">Navidad · desde el ${diaCorto(g.desde)}</span>`;
  if (tiene(p, 'prem')) return '<span class="tz-tag prem">Sólo Premium</span>';
  if (tiene(p, 'num')) return '<span class="tz-tag num">Edición de 10</span>';
  if (tiene(p, 'nav')) return S.cat.navidad && ahora < S.cat.navidad.desde ? `<span class="tz-tag nav">Navidad · desde el ${diaCorto(S.cat.navidad.desde)}</span>` : '<span class="tz-tag nav">Navidad · hasta el 1/1</span>';
  return '';
}
const corazon = (S, id) => { const en = S.yo.deseos.includes(id); return `<button class="tz-cor" data-deseo="${id}" aria-pressed="${en}" aria-label="${en ? 'Sacar de tu lista' : 'Agregar a tu lista'}">${en ? '♥' : '♡'}</button>`; };
const subDe = (S, id) => { const p = S.cat.piezas[id]; return (esFondo(p.c) ? 'Fondo · ' + LUGAR_DE[p.c] : RANURA[p.c] || '') + ' · ' + RZ[p.r][0]; };

function slides(S) {
  const c = S.cat, v = c.vitrina.ids;
  const solo = v.filter((id) => tiene(c.piezas[id], 'rot')), del = v.filter((id) => !tiene(c.piezas[id], 'rot'));
  const out = [...solo.map((id) => ({ id, t: 'solo' })), ...del.map((id) => ({ id, t: 'cat' }))];
  // (18/11/2026) lo gratis entra a la vitrina sólo dentro de su ventana: antes ofrecía «Reclamar gratis» y fallaba
  for (const id of Object.keys(c.gratis)) if (enVentana(c.gratis[id], Date.now())) out.push({ id, t: 'nav' });
  for (const id of Object.keys(c.ediciones).slice(0, 1)) out.push({ id, t: 'num' });
  return out;
}
// 🕐 la hora del cambio en la zona de Ajustes (18/11/2026): «11 AM» escrito a mano es la del este, sin decirlo
function cambiaTxt(S) { const h = S.cat.vitrina.hasta; return h ? 'Cambia el lunes ' + diaCorto(h) + ' · ' + hora(h) : 'Cambia los lunes · 11 AM (hora del este)'; }

// 💿 LA VITRINA, «LA DISQUERA» (21/11/2026). Dlx eligió la A de la maqueta privada, «con algo de B»: la pelea, sin voto.
// Las rarezas de la Tienda ya se llaman como discos (Maqueta, Mixtape, Vinilo, Disco de Oro…): cada pieza es un disco en
// su funda, con la rareza y el precio en la etiqueta redonda; tocas una funda y el disco SALE GIRANDO con la pieza PUESTA
// EN TI en el centro. Abajo, el cajón con todas las fundas (en la compu, en filas: nada de costado; en el celular se
// desliza). Y debajo, la PELEA de la vitrina (`peleaVitrina()` de bot/tienda.js): las dos piezas más fuertes de lo que
// sólo pasa por ella, cara a cara, con sus ♡ y compras de verdad; vuelve en la próxima vitrina la que junte más.
// ⚠️ El HTML se rehace entero en cada cambio, así que «sale el disco» no es una transición: la clase `sale` la pone
// `useLayoutEffect` sólo cuando cambió la funda elegida (si no, cada ♡ o cada pedido de 15 s volvía a sacar el disco)
const SURCOS = (() => {
  let s = '<circle cx="50" cy="50" r="50" fill="#050506"/>';
  for (let r = 49; r > 16; r -= 2.2) s += `<circle cx="50" cy="50" r="${r.toFixed(1)}" fill="none" stroke="${r > 47 ? '#2A2A30' : '#141418'}" stroke-width="${r > 47 ? 2 : 0.9}"/>`;
  return `<svg class="dq-surcos" viewBox="0 0 100 100" aria-hidden="true">${s}<path d="M50 4 A46 46 0 0 1 86 22" stroke="#3A3A42" stroke-width="1.2" fill="none"/></svg>`;
})();
// en la etiqueta del disco: la pieza puesta en ti (el aro y la deco en tu cara, tu nombre escrito, tu carta); un fondo, el suyo
function enEtiqueta(X, S, id) {
  const p = S.cat.piezas[id];
  if (p.c === 'aro') return avatar(X, id, null);
  if (p.c === 'deco') return avatar(X, null, id);
  if (p.c === 'nom') return nombre(X, id);
  if (p.c === 'carta') return carta(X, id);
  return esFondo(p.c) ? arteFondo(X, id) : vista(X, id);
}
// 👥 quién la lleva puesta: lo público del Pase (`tp`), con su cara si la página ya la muestra; si nadie, se dice así
// 🔇 `callar`: en la pelea, si no la lleva nadie en ninguna de las dos esquinas, nada (22/11/2026, la revisión visual G5#20):
// la misma línea salía tres veces en la misma pantalla (la vitrina y las dos esquinas)
function llevanHtml(liga, llevan, id, callar) {
  const ks = (llevan && llevan[id]) || [];
  if (!ks.length) return callar ? '' : '<p class="dq-llevan"><span>Nadie la lleva todavía · <b>sé el primero</b></span></p>';
  const caras = ks.slice(0, 4).map((k) => { const u = liga.avUrl ? liga.avUrl(k, 64) : ''; return u ? `<img alt="" src="${esc(u)}" data-ini="${esc(inicialSvg(k))}">` : `<img alt="" src="${esc(inicialSvg(k))}">`; }).join('');
  return `<p class="dq-llevan"><span class="dq-caras">${caras}</span><span><b>${num(ks.length)}</b> ${ks.length === 1 ? 'la lleva' : 'la llevan'}</span></p>`;
}
// ⚔️ la pelea de la vitrina se sacó de la página el 25/11/2026 (8.42), Dlx: «o culta los corazones y la cantidad de
// compras. La pelea de la vitrina quita eso». El objeto la sigue calculando (`peleaVitrina()`) para elegir qué vuelve

// 🎁 LOS REGALOS DE LA VITRINA (25/11/2026). Dlx: «haz q las piezas de las vitrinas estén como tapados por regalos y al
// hacer click se desbloquea ofertas de diferentes cosas… pueden ser gratis pero la probabilidad es baja, así como lo hace
// brawl stars»; y «asegúrate q tenga una animación chila». Cada pieza de la vitrina llega envuelta; abrirla es gratis y lo
// que sale lo decide el objeto (`tiradaRegalo()` de bot/tienda.js) y lo guarda: volver a entrar no vuelve a tirar. Como
// el Night Market de VALORANT y el «Tap to Reveal» de Brawl Stars: se tiembla un momento, se abre, y sale con su color.
// ⚠️ El HTML se rehace entero en cada pedido, así que la animación no puede ser una transición: cada capa lleva
// `animation-delay: calc(var(--t0) + …)` y `--t0` es lo que ya pasó desde que se abrió (negativo). Si la página se
// repinta en el medio, sigue desde donde iba en vez de volver a empezar
const RG_CINTA = ['#E41373', '#F2C14E', '#36C5F0', '#8BE04E', '#B57BFF', '#FF7A3D', '#29B298', '#F6F6F6'];
const RG_COLOR = { gratis: '#FFD34D', drop: '#FF5A36', pdt: '#36E0C8' };
// las chispas: ángulo, distancia y tamaño fijos (no `Math.random`: el HTML tiene que salir igual en cada repintada)
const RG_CHISPAS = Array.from({ length: 18 }, (_, n) => [Math.round(n * 20 + (n % 3) * 7), 90 + ((n * 37) % 80), 5 + (n % 4) * 2]);
function regalosHoy(S, st) {
  const v = S.cat.vitrina.ids || [];
  const R = S.yo && S.yo.regalos_dia;
  const loc = (st.rgLocal && R && st.rgLocal[R.dia]) || {};
  return { n: R ? R.n : Math.min(8, v.length), ab: Object.assign({}, R ? R.ab : {}, loc), dia: R ? R.dia : '', v };
}
/** El regalo de un lugar de la slides: su número en la vitrina y lo que salió (`of`, null si sigue cerrado). Lo demás no lleva */
function rgDe(S, st, x) {
  if (x.t !== 'solo' && x.t !== 'cat') return null;
  const G = regalosHoy(S, st), i = G.v.indexOf(x.id);
  if (i < 0 || i >= G.n) return null;
  return { i, of: G.ab[i] || null, n: G.n, dia: G.dia };
}
const rgCinta = (i) => RG_CINTA[i % RG_CINTA.length];
const rgColor = (S, of) => RG_COLOR[of.k] || (S.cat.piezas[of.p] ? RZ[S.cat.piezas[of.p].r][1] : '#F6F6F6');
const rgEtq = (of) => (of.k === 'gratis' ? 'Gratis' : of.k === 'drop' ? 'Drop' : of.k === 'pdt' ? '+' + num(of.n) : '−' + of.desc + ' %');
const cajaRg = (i, cls) => `<span class="rg-caja${cls ? ' ' + cls : ''}" style="--cin:${rgCinta(i)};--rg-d:${(i * 0.9).toFixed(1)}s" aria-hidden="true"><i class="rg-cu"></i><i class="rg-ta"></i><i class="rg-mo"></i></span>`;
/** La estrella de la etiqueta (la del sello que queda y la grande que salta al abrir) */
const rgSello = (S, of, cls) => `<span class="rg-sello rg-${of.k}${cls ? ' ' + cls : ''}" style="--rgc:${rgColor(S, of)}"><span>${of.k === 'pdt' ? '<b>+' + num(of.n) + '</b>Puntos' : of.k === 'drop' ? 'Dragón<b>Drop</b>' : of.k === 'gratis' ? '<b>¡Gratis!</b>' : '<b>−' + of.desc + '%</b>Tu precio'}</span></span>`;
/** Lo que sale de la caja al abrirla: flash, rayos, la tapa que vuela, las chispas y la etiqueta grande */
function rgFx(S, st, i, of) {
  const ya = Math.max(0, Date.now() - st.rgRecien.t);
  return `<span class="rg-fx" style="--t0:-${ya}ms;--rgc:${rgColor(S, of)}" aria-hidden="true"><i class="rg-rayos"></i><i class="rg-rayos dos"></i><i class="rg-flash"></i>
    <span class="rg-chispas">${RG_CHISPAS.map(([a, d, w]) => `<i style="--a:${a}deg;--d:${d};--w:${w}px"></i>`).join('')}</span>
    <span class="rg-vuela">${cajaRg(i)}</span>${rgSello(S, of, 'grande')}</span>`;
}
/** Lo que salió, al lado de la pieza: la otra pieza con su precio, los Puntos, el Drop o la gratis */
function rgCarta(X, S, st, tengo, rg) {
  const of = rg.of, P = of.p && S.cat.piezas[of.p];
  const v = P ? `<span class="rg-of-v">${esFondo(P.c) ? arteFondo(X, of.p) : vista(X, of.p)}</span>` : `<span class="rg-of-v rg-of-ico">${of.k === 'drop' ? '🐉' : '✦'}</span>`;
  let txt, bot = '';
  if (of.k === 'pdt') txt = `<b>+${num(of.n)} Puntos de Tienda</b><span>Ya están en tu billetera.</span>`;
  else if (of.k === 'drop') txt = '<b>Un Dragón Drop</b><span>Ábrelo en el <a href="#/pase">Pase</a>, con tus Dragón Drops.</span>';
  else if (of.k === 'gratis') { txt = `<b>${esc(P.n)}, gratis</b><span>Ya es tuya: está en tu inventario.</span>`; if (seProbar(P)) bot = `<button class="tz-b" data-probar-ir="${of.p}">Probártela</button>`; }
  else {
    txt = `<b>${esc(P.n)}</b><span><s>${num(of.base)}</s> <em>${num(of.precio)}</em> · sólo hoy</span>`;
    bot = of.usado || tengo.has(of.p) ? '<span class="tz-hecho">✓ Tuya</span>' : rgBoton(S, st, rg);
  }
  return `<div class="rg-of${st.rgRecien && st.rgRecien.i === rg.i ? ' rg-entra' : ''}" style="--rgc:${rgColor(S, of)}${st.rgRecien && st.rgRecien.i === rg.i ? ';--t0:-' + Math.max(0, Date.now() - st.rgRecien.t) + 'ms' : ''}">${v}<span class="rg-of-t"><small>Tu oferta · ${rgEtq(of)}</small>${txt}</span>${bot}</div>`;
}
// comprar la oferta, en dos toques (el primero muestra el precio y el saldo; como «Comprar» de la ficha)
function rgBoton(S, st, rg) {
  const of = rg.of;
  if (st.rgConfirma !== rg.i) return `<button class="tz-b blanco" data-rg-comprar="${rg.i}">Comprar · ${num(of.precio)}</button>`;
  if (!S.anon && S.yo.saldo < of.precio) return `<span class="rg-falta">Te faltan <b>${num(of.precio - S.yo.saldo)}</b></span><button class="tz-b" data-rg-no>Cancelar</button>`;
  return `<button class="tz-b" data-rg-no>Cancelar</button><button class="tz-b prim" data-rg-si="${rg.i}"${st.va ? ' disabled' : ''}>${st.va ? 'Comprando…' : 'Sí, por ' + num(of.precio)}</button>`;
}

function hero(X, S, st, tengo, liga, llevan) {
  const L = slides(S);
  if (!L.length) return '';
  const s = L[Math.min(st.slide, L.length - 1)], it = S.cat.piezas[s.id];
  const ed = S.cat.ediciones[s.id];
  const eti = s.t === 'solo' ? 'Sólo en la vitrina' : s.t === 'cat' ? 'En la vitrina' : s.t === 'nav' ? 'Navidad · gratis para todos' : 'Edición de 10';
  const baja = s.t === 'solo' ? 'No está en el catálogo. Vuelve al menos cada 2 meses.' : s.t === 'cat' ? 'También está siempre en el catálogo.'
    : s.t === 'nav' ? 'Para todos los que entren hasta el 1/1.' : 'Una por persona, para quien jugó en la temporada. La #1 es del campeón.';
  const mio = tengo.has(s.id), enLista = S.yo.deseos.includes(s.id);
  const rg = rgDe(S, st, s);
  const ofMia = rg && rg.of && rg.of.k === 'pieza' && rg.of.p === s.id && !rg.of.usado && !mio ? rg.of : null;
  let bot;
  if (s.t === 'nav') bot = (mio ? '<span class="tz-hecho">✓ Ya es tuyo</span>' : `<button class="tz-b blanco" data-reclamar="${s.id}">Reclamar gratis</button>`) + '<button class="tz-b" data-tab="nav">Ver Navidad</button>';
  else if (s.t === 'num') {
    // 🎟️ (18/11/2026) como su ficha: ya tuya, a la venta o todavía no. Decía «♡ Avísame» también el día de la venta (sin
    // «Comprar») y a quien ya tenía la suya; y con la venta cerrada no hay de qué avisar
    const ahora = Date.now(), cerro = !!(ed && ed.cierra && ahora >= ed.cierra), abre = !!ed && ahora >= ed.venta && !cerro;
    bot = (mio ? '<span class="tz-hecho">✓ Ya es tuyo</span>' : abre ? `<button class="tz-b blanco" data-comprar="${s.id}">Comprar · ${num(precioIt(S, s.id))}</button>`
      : cerro ? '' : `<button class="tz-b blanco" data-deseo="${s.id}">${enLista ? '♥ Te avisamos ese día' : '♡ Avísame'}</button>`) + '<button class="tz-b" data-tab="num">Ver las ediciones</button>';
  }
  else bot = (mio ? '<span class="tz-hecho">✓ Ya es tuyo</span>' : ofMia ? rgBoton(S, st, rg) : `<button class="tz-b blanco" data-comprar="${s.id}">Comprar · ${num(precioIt(S, s.id))}</button>`) + (seProbar(it) && !(ofMia && st.rgConfirma === rg.i) ? `<button class="tz-b" data-probar-ir="${s.id}">Probártelo</button>` : '');
  // el cajón: todas las fundas de la vitrina, paradas
  // 🏷️ (21/11/2026, la revisión visual G5#19) el tipo antes del precio: había dos «Ecualizador» y dos «Dragón» sin decir
  // cuál era el aro y cuál la carta. Y un nombre se muestra escrito como «Tú»: el arte de muestra de algunos trae un nombre
  // de ejemplo («DLX») que en la funda chica no entraba
  const muestra = Object.assign({}, X, { n: 'Tú', crudo: 'Tú' });
  const fundas = L.map((x, i) => {
    const y = S.cat.piezas[x.id];
    const g = rgDe(S, st, x);
    // 🎁 cerrada: la caja, sin decir qué hay (un toque la abre); abierta: la pieza con la etiqueta de lo que salió
    if (g && !g.of) {
      const abre = st.rgAbriendo && st.rgAbriendo.i === g.i;
      return `<button class="dq-fu rg-fu" data-slide="${i}" data-rg-abrir="${g.i}" aria-pressed="${i === st.slide}" style="--r:${rgCinta(g.i)}" aria-label="Artículo ${g.i + 1} de ${g.n}, tapado: ${S.anon ? 'entra para destaparlo' : 'tócalo para destaparlo'}"><span class="dq-fu-v">${cajaRg(g.i, abre ? 'agita' : '')}</span><span class="dq-fu-t">Artículo ${g.i + 1}</span><span class="dq-fu-s">${abre ? 'Destapando…' : S.anon ? 'Entra y destápalo' : 'Toca y destápalo'}</span></button>`;
    }
    const tipo = esFondo(y.c) ? 'Fondo' : RANURA[y.c] || '';
    const ofM = g && g.of && g.of.k === 'pieza' && g.of.p === x.id && !g.of.usado && !tengo.has(x.id);
    const sub = (tipo ? tipo + ' · ' : '') + (x.t === 'nav' ? 'Gratis' : x.t === 'num' ? 'Ed. de 10' : tengo.has(x.id) ? 'Tuyo' : ofM ? '<em>' + num(g.of.precio) + '</em>' : num(precioIt(S, x.id)));
    const arte = esFondo(y.c) ? arteFondo(X, x.id) : y.c === 'nom' ? nombre(muestra, x.id) : vista(X, x.id);
    const nuevo = g && st.rgRecien && st.rgRecien.i === g.i;
    const etq = g && g.of ? `<span class="rg-badge rg-${g.of.k}${g.of.usado && g.of.k === 'pieza' ? ' usado' : ''}" style="--rgc:${rgColor(S, g.of)}">${g.of.usado && g.of.k === 'pieza' ? '✓' : rgEtq(g.of)}</span>` : '';
    return `<button class="dq-fu${nuevo ? ' rg-nuevo' : ''}" data-slide="${i}" aria-pressed="${i === st.slide}" style="--r:${RZ[y.r][1]}${nuevo ? ';--t0:-' + Math.max(0, Date.now() - st.rgRecien.t) + 'ms' : ''}" aria-label="${esc(y.n)}, ${esc(tipo)}, ${RZ[y.r][0]}${g && g.of ? ', tu oferta: ' + esc(rgEtq(g.of)) : ''}"><span class="dq-fu-v">${arte}${etq}</span><span class="dq-fu-t">${esc(y.n)}</span><span class="dq-fu-s">${sub}</span></button>`;
  }).join('');
  // (18/11/2026) «a la venta el …» sólo antes de la venta; una edición de 10 no lleva descuento Premium
  const precio = s.t === 'nav' || mio ? '' : ofMia ? `<p class="tz-precio rg-precio"><s>${num(precioIt(S, s.id))}</s> <b>${num(ofMia.precio)}</b> <small>Tu oferta · −${ofMia.desc} % · sólo hoy</small></p>` : `<p class="tz-precio"><b>${num(precioIt(S, s.id))}</b> <small>Puntos de Tienda${s.t === 'num' ? (ed && Date.now() < ed.venta ? ' · a la venta el ' + diaCorto(ed.venta) : '') : S.yo.prem ? ' · con tu Premium' : tiene(it, 'num') ? '' : ' · Premium ' + num(Math.round(S.cat.precios[it.r] * S.cat.desc.prem))}</small></p>`;
  // la etiqueta redonda de la funda: la rareza y el precio, como el sticker de un disco
  const sticker = `<span class="dq-st"><span>${RZ[it.r][0]}<b>${s.t === 'nav' ? 'Gratis' : mio ? 'Tuyo' : num(ofMia ? ofMia.precio : precioIt(S, s.id))}</b></span></span>`;
  const bill = S.anon ? '' : `<button class="dq-bill" data-abre="__bill">Tienes <b>${S.modo === 'dinero' ? '∞' : num(S.yo.saldo || 0)}</b></button>`;
  const cajon = `<div class="dq-cajon"><div class="dq-cajon-f" role="group" aria-label="Las piezas de la vitrina">${fundas}</div></div>`;
  const cab = `<div class="dq-cab"><span class="tz-etq">La vitrina · ${esc(String(S.cat.temp || '').toUpperCase())}</span><span class="tz-cambia">${cambiaTxt(S)}</span>${bill}</div>`;
  if (rg && !rg.of) {
    const abre = st.rgAbriendo && st.rgAbriendo.i === rg.i;
    return `<section class="tz-hero dq rg-hero" id="tz-vitrina" aria-label="La vitrina" style="--r:${rgCinta(rg.i)}">${cab}
    <div class="dq-main">
      <div class="dq-vis rg-vis" data-slide-id="rg:${rg.i}"><button class="rg-grande${abre ? ' abriendo' : ''}" data-rg-abrir="${rg.i}" aria-label="Destapar el artículo ${rg.i + 1}"${abre ? ' disabled' : ''}><i class="rg-luz"></i>${cajaRg(rg.i, abre ? 'agita' : '')}</button></div>
      <div class="dq-info" data-tuto="tz-vitrina">
        <p class="tz-rz"><i></i>Artículo ${rg.i + 1} de ${rg.n} · <span>Se renuevan a la medianoche (hora del este)</span></p>
        <h2>Un artículo tapado</h2>
        <p class="tz-hero-p">Las primeras piezas de la vitrina llegan tapadas. Destápala y sale algo sólo para ti y sólo por hoy: la pieza con descuento, Puntos de Tienda, un Dragón Drop o, con suerte, la pieza gratis.</p>
        <p class="rg-chances"><span><b>2 %</b> gratis</span><span><b>4 %</b> Dragón Drop<small> (Miembros de DRA)</small></span><span><b>6 %</b> Puntos</span><span><b>88 %</b> de 10 a 50 % menos</span></p>
        <div class="tz-bots"><button class="tz-b blanco" data-rg-abrir="${rg.i}"${abre ? ' disabled' : ''}>${abre ? 'Destapando…' : S.anon ? 'Entra para destaparlo' : 'Destapar'}</button></div>
      </div>
    </div>
    ${cajon}
  </section>`;
  }
  const recien = rg && rg.of && st.rgRecien && st.rgRecien.i === rg.i;
  return `<section class="tz-hero dq" id="tz-vitrina" aria-label="La vitrina" style="--r:${RZ[it.r][1]}">
    ${cab}
    <div class="dq-main">
      <div class="dq-vis${recien ? ' rg-revela rg-k-' + rg.of.k : ''}" data-slide-id="${esc(s.id)}"${recien ? ` style="--t0:-${Math.max(0, Date.now() - st.rgRecien.t)}ms"` : ''}>
        <div class="dq-disco">${SURCOS}<div class="dq-etq"><div class="dq-etq-in">${enEtiqueta(X, S, s.id)}</div></div></div>
        <div class="dq-funda"><div class="dq-arte">${esFondo(it.c) ? arteFondo(X, s.id) : vista(X, s.id)}</div><div class="dq-pie"><b>${esc(it.n)}</b><small>${esc(subDe(S, s.id))}</small></div>${sticker}</div>
        ${rg && rg.of ? rgSello(S, rg.of, 'queda') : ''}${recien ? rgFx(S, st, rg.i, rg.of) : ''}
      </div>
      <div class="dq-info" data-tuto="tz-vitrina">
        <p class="tz-rz"><i></i>${subDe(S, s.id)} · <span>${eti}</span></p>
        <h2>${esc(it.n)}</h2>
        <p class="tz-hero-p">${esc(it.d)} ${baja}</p>${precio}
        ${rg && rg.of && !(rg.of.k === 'pieza' && rg.of.p === s.id) ? rgCarta(X, S, st, tengo, rg) : ''}
        <div class="tz-bots">${bot}</div>
        ${s.t === 'nav' || s.t === 'num' ? '' : llevanHtml(liga, llevan, s.id)}
      </div>
    </div>
    ${cajon}
  </section>`;
}

function escenario(X, S, st) {
  const ver = st.comparar ? st.mio : { puesto: st.puesto, fondo: st.fondo };
  const enFondo = st.tab === 'fondo';
  const fid = ver.fondo[st.lugar];
  const cuerpo = enFondo
    ? `<div class="tz-esc-f">${fid ? enLugar(X, fid) : `<span class="tz-sinf"><span>El de siempre en <b>${LUGAR_DE[st.lugar]}</b></span></span>`}</div>`
    : `<div class="tz-esc-yo"><div class="tz-esc-av">${avatar(X, ver.puesto.aro, ver.puesto.deco)}<div class="tz-yo-n">${nombre(X, ver.puesto.nom)}</div></div><div class="tz-esc-c">${carta(X, ver.puesto.carta)}</div></div>`;
  const cmp = cambiado(st) ? `<div class="tz-cmp" role="group" aria-label="Comparar"><button data-cmp="0" aria-pressed="${!st.comparar}">Probando</button><button data-cmp="1" aria-pressed="${st.comparar}">Lo tuyo</button></div>` : '';
  const lug = enFondo ? `<div class="tz-lug" role="tablist" aria-label="Lugar del fondo">${LUGARES_F.map(([k, n]) => `<button role="tab" aria-selected="${st.lugar === k}" data-lugar="${k}">${n}</button>`).join('')}</div>` : '';
  return `<div class="tz-esc">${lug}${cuerpo}${cmp}</div>`;
}
function probando(S, st, tengo) {
  const r = loPuesto(S, st, tengo);
  if (!r.n && !cambiado(st)) return '<p class="tz-pista">Toca cualquier pieza y se te pone al instante. «Ver» abre su ficha.</p>';
  const filas = r.juegos.map((g) => `<li><span>Colección «${esc(g.j.n)}» <small>completa</small></span><b>${num(g.p)}</b><button class="tz-solo" data-abre="${g.id}">Ver</button><span></span></li>`).join('')
    + r.sueltas.map((id) => `<li><span>${esc(S.cat.piezas[id].n)} <small>${RANURA[S.cat.piezas[id].c] || LUGAR_DE[S.cat.piezas[id].c] || ''}</small></span><b>${num(precioIt(S, id))}</b><button class="tz-solo" data-comprar="${id}">${S.yo.saldo >= precioIt(S, id) ? 'Sólo esto' : 'Ver'}</button><button class="tz-x2" data-saca="${id}" aria-label="Sacar ${esc(S.cat.piezas[id].n)}">×</button></li>`).join('');
  const alc = S.yo.saldo >= r.total;
  // 🔑 sin cuenta no te faltan Puntos, te falta entrar (18/11/2026): con el saldo 0 de quien no entró decía «Te faltan …»
  return `<div class="tz-probando"><div class="tz-pr-h"><b>Probando</b><span>${r.n ? 'Total ' + num(r.total) + (S.anon ? '' : ' · tienes ' + num(S.yo.saldo)) : 'todo tuyo'}</span></div>
    ${filas ? `<ul>${filas}</ul>` : ''}
    <div class="tz-pr-b">${cambiado(st) ? '<button class="tz-b l" data-acc="volver">Volver a lo mío</button>' : ''}${r.n ? (S.anon ? `<button class="tz-b negro" data-acc="entrar">Entrar para comprarlo · ${num(r.total)}</button>` : alc ? `<button class="tz-b negro" data-abre="__puesto">Comprar todo · ${num(r.total)}</button>` : `<button class="tz-b l falta" data-abre="__puesto">Te faltan ${num(r.total - S.yo.saldo)}</button>`) : ''}</div></div>`;
}
function tile(X, S, st, tengo, id) {
  const p = S.cat.piezas[id], mio = tengo.has(id), puede = seProbar(p);
  if (!p) return '';
  const on = Object.values(st.puesto).includes(id) || Object.values(st.fondo).includes(id);
  const prob = on && !mio;
  const eti = prob ? '<span class="tz-et prob">Probando</span>' : mio ? '<span class="tz-et mio">Tuyo</span>' : tiene(p, 'num') ? '<span class="tz-et num">Edición de 10</span>' : tiene(p, 'prem') ? '<span class="tz-et prem">Sólo Premium</span>' : '';
  const pr = precioIt(S, id), base = S.cat.precios[p.r];
  // (18/11/2026) lo gratis antes de su ventana dice «Gratis», como su ficha: la grilla de Navidad lo daba a precio entero
  const gl = S.cat.gratis[id] && Date.now() < S.cat.gratis[id].desde;
  const precio = mio ? '<span class="tz-ok">✓ Tuyo</span>' : tiene(p, 'pronto') ? 'Pronto' : !pr || gl ? 'Gratis' : S.yo.prem && pr !== base ? `<s>${num(base)}</s> ${num(pr)}` : num(pr);
  return `<article class="tz-q${prob ? ' prob' : ''}${on && mio ? ' on' : ''}" style="--r:${RZ[p.r][1]}" title="${esc(p.n)} · ${RZ[p.r][0]}">
    <button class="tz-q-v" ${puede ? `data-prueba="${id}" aria-pressed="${on}" aria-label="Probarte ${esc(p.n)}"` : `data-abre="${id}" aria-label="Ver ${esc(p.n)}"`}>${esFondo(p.c) ? arteFondo(X, id) : vista(X, id)}${eti}</button>
    ${mio || !pr ? '' : corazon(S, id)}
    <div class="tz-q-i"><i aria-label="${RZ[p.r][0]}"></i><b>${esGrupo(S, id) ? esc(nombreGrupo(S, id)) + ' <small>· ' + variantesDe(S, id).length + (cabezaDe(S, id) === 'A10' ? ' países' : cabezaDe(S, id) === 'A11' ? ' servidores' : ' versiones') + '</small>' : esc(p.n)}</b><span class="tz-q-p">${precio}</span><button class="tz-q-ver" data-abre="${id}">Ver</button></div></article>`;
}
function coleccionT(X, S, tengo, cid) {
  const j = S.cat.colecciones[cid], r = precioCol(S, cid, tengo), ya = j.piezas.length - r.falta.length;
  return `<article class="tz-q tz-jg" style="--r:#29B298"><button class="tz-q-v" data-abre="${cid}" aria-label="Ver la colección ${esc(j.n)}"><span class="tz-jg-m">${j.piezas.map((id) => `<span class="tz-j${tengo.has(id) ? ' mio' : ''}">${arteFondo(X, id)}</span>`).join('')}</span></button>
    <div class="tz-q-i"><i></i><b>«${esc(j.n)}» <small>${ya === j.piezas.length ? 'Completa · premio tuyo' : ya + ' de ' + j.piezas.length + ' · premio al completarla'}</small></b><span class="tz-colbar mini" style="--p:${Math.round(ya / j.piezas.length * 100)}%"><i></i></span><span class="tz-q-p">${r.falta.length ? num(r.p) : '<span class="tz-ok">✓ Tuya</span>'}</span><button class="tz-q-ver" data-abre="${cid}">Ver</button></div></article>`;
}
// 🔎 LOS FILTROS DEL CAJÓN (25/11/2026, Dlx: «en la tienda quizás poner filtros»): cuáles (todas, las que te faltan, las
// tuyas) y en qué orden (por rareza, que es como venían; la más barata o la más cara primero). Sólo en las ranuras: en
// Colecciones, Premium, Navidad, las ediciones y tu lista el orden ya dice algo
// 🌎🏟️ LAS VARIANTES (25/11/2026, Dlx: «eso de país y servidores que se pueda comprar de todos los países y de todos los
// servidores»). Cada bandera y cada socio es una pieza (`AP…`, `AS…`) con `g`: de cuál es variante (A10 País, A11 Servidor).
// En el cajón va UNA ficha por grupo (la cabeza, con cuántas hay); adentro, un selector con todas. Hasta el 25/11 «País»
// dibujaba la bandera de Estados Unidos para todos y «Servidor» la de FFA: eran el arte de muestra
const cabezaDe = (S, id) => { const p = S.cat.piezas[id]; return (p && p.g && S.cat.piezas[p.g]) ? p.g : id; };
const variantesDe = (S, id) => { const g = cabezaDe(S, id); return [g, ...Object.keys(S.cat.piezas).filter((x) => S.cat.piezas[x].g === g)]; };
const esGrupo = (S, id) => variantesDe(S, id).length > 1;
const nombreVar = (S, id) => { const n = S.cat.piezas[id].n || ''; const i = n.indexOf(' · '); return i > 0 ? n.slice(i + 3) : 'Original'; };
const nombreGrupo = (S, id) => { const n = S.cat.piezas[cabezaDe(S, id)].n || ''; const i = n.indexOf(' · '); return i > 0 ? n.slice(0, i) : n; };
function selectorVar(X, S, tengo, id) {
  const ids = variantesDe(S, id);
  if (ids.length < 2) return '';
  const g = cabezaDe(S, id), quien = g === 'A10' ? 'país' : g === 'A11' ? 'servidor' : 'versión';
  return `<div class="tz-var"><b>Elige tu ${quien} · ${ids.length}</b><div class="tz-var-l" role="group" aria-label="Las variantes">${ids.map((v) =>
    `<button data-abre="${v}" aria-pressed="${v === id}" title="${esc(nombreVar(S, v))}"><span class="tz-var-v">${S.cat.piezas[v].c === 'aro' ? avatar(X, v, null) : vista(X, v)}</span><span class="tz-var-n">${esc(nombreVar(S, v))}${tengo.has(v) ? ' ✓' : ''}</span></button>`).join('')}</div></div>`;
}
const FILTROS = [['todas', 'Todas'], ['faltan', 'Te faltan'], ['tuyas', 'Tuyas']];
const ORDENES = [['rareza', 'Rareza'], ['barato', 'Más baratas'], ['caro', 'Más caras']];
function filtrar(S, st, tengo, ids) {
  const f = st.filtro || 'todas', o = st.orden || 'rareza';
  const tieneAlgo = (id) => variantesDe(S, id).some((v) => tengo.has(v));
  const todas = (id) => variantesDe(S, id).every((v) => tengo.has(v));
  let out = ids.filter((id) => !S.cat.piezas[id].g).filter((id) => (f === 'faltan' ? !todas(id) : f === 'tuyas' ? tieneAlgo(id) : true));
  if (o !== 'rareza') out = out.slice().sort((a, b) => (precioIt(S, a) - precioIt(S, b)) * (o === 'caro' ? -1 : 1));
  return out;
}
const barraFiltros = (st) => `<div class="tz-filtros" role="group" aria-label="Filtrar las piezas"><span class="tz-filtros-g">${FILTROS.map(([k, n]) => `<button data-filtro="${k}" aria-pressed="${(st.filtro || 'todas') === k}">${n}</button>`).join('')}</span><span class="tz-filtros-g">${ORDENES.map(([k, n]) => `<button data-orden="${k}" aria-pressed="${(st.orden || 'rareza') === k}">${n}</button>`).join('')}</span></div>`;
function piezas(X, S, st, tengo) {
  const c = S.cat, t = st.tab, especial = (p) => tiene(p, 'nav') || tiene(p, 'num');
  const vacio = (st.filtro || 'todas') === 'todas' ? 'Todavía no hay piezas acá.' : st.filtro === 'tuyas' ? 'Todavía no tienes ninguna de acá.' : 'Ya las tienes todas.';
  const grilla = (ids) => `<div class="tz-grid">${ids.map((id) => tile(X, S, st, tengo, id)).join('') || '<p class="tz-vacio">' + vacio + '</p>'}</div>`;
  const conFiltros = (ids) => barraFiltros(st) + grilla(filtrar(S, st, tengo, ids));
  const de = (f) => Object.keys(c.piezas).filter((id) => f(c.piezas[id], id));
  const vende = (p, id) => !tiene(p, 'col') && (!tiene(p, 'rot') || c.vitrina.ids.includes(id));
  // (18/11/2026) `tz-cols` y no `jg`: `.jg` es la página de Estilo de juego (inventario.css) y le cambiaba el gap
  if (t === 'juego') return `<p class="tz-sub"><b>Seis fondos que combinan, uno por lugar</b> · completa una y te llevas su insignia y una pieza exclusiva</p><div class="tz-grid tz-cols">${Object.keys(c.colecciones).map((cid) => coleccionT(X, S, tengo, cid)).join('')}</div>`;
  if (t === 'prem') return `<div class="tz-aviso prem"><b>Premium</b><span>${S.yo.prem ? 'Con tu Premium tienes descuento en todo y en las colecciones, y estas piezas, que son sólo para Premium.' : 'Estas piezas son sólo para quien tiene Premium, que además tiene descuento en todo y en las colecciones.'} Lo que compres sigue siendo tuyo aunque se te venza.</span></div>${grilla(de((p) => tiene(p, 'prem')))}`;
  // (18/11/2026) antes de su ventana, desde cuándo: se veía como si ya se pudiera reclamar y comprar
  const abreNav = c.navidad && Date.now() < c.navidad.desde ? 'Abre el ' + diaCorto(c.navidad.desde) + '. ' : '';
  if (t === 'nav') return `<div class="tz-aviso nav"><b>Navidad</b><span>${abreNav}Lo gratis es para todos los que entren hasta el 1/1. Lo demás se vende hasta esa fecha, y lo que compres es tuyo para siempre.</span></div>${grilla([...Object.keys(c.gratis), ...de((p, id) => tiene(p, 'nav') && !c.gratis[id])])}`;
  if (t === 'num') {
    const ids = Object.keys(c.ediciones), e = c.ediciones[ids[0]] || {};
    return `<div class="tz-boleto"><div><b>Ediciones de 10${e.nombre ? ' · ' + esc(e.nombre) : ''}</b><span>${e.venta ? 'A la venta el ' + diaCorto(e.venta) + '. ' : ''}Una por persona, para quien jugó en la temporada. No se reeditan nunca.</span></div><span class="tz-talon">#1<small>del campeón</small></span></div>${grilla(ids)}`;
  }
  if (t === 'deseo') return `<div class="tz-aviso"><b>Tu lista · ${S.yo.deseos.length}</b><span>La campana te avisa cuando algo de acá entra en la vitrina, baja de precio o sale a la venta.</span><button class="tz-sw" role="switch" aria-checked="${S.yo.deseo_publico}" data-publico>${S.yo.deseo_publico ? 'Se ve en tu perfil' : 'Sólo la ves tú'}</button></div>${grilla(S.yo.deseos)}`;
  if (t === 'fondo') return conFiltros(de((p, id) => p.c === st.lugar && vende(p, id) && !especial(p)));
  const ids = de((p, id) => p.c === t && vende(p, id) && !especial(p) && !tiene(p, 'prem'));
  if (t === 'nom') ids.push(...de((p) => p.c === 'serv'));
  return conFiltros(ids);
}
function tabs(S, st) {
  const base = TABS.slice();
  if (EXTRA[st.tab] && !base.some(([k]) => k === st.tab)) base.push([st.tab, EXTRA[st.tab]]);
  return `<nav class="tz-tabs" aria-label="Ranuras">${base.map(([k, n]) => `<button data-tab="${k}" aria-pressed="${st.tab === k}">${n}</button>`).join('')}</nav>`;
}
const pildora = (S, st) => S.anon ? '<span class="tz-bill-c"><button class="tz-bill" data-acc="entrar"><b>Entrar</b><small>con Discord para comprar</small></button></span>' : `<span class="tz-bill-c"><button class="tz-lista" data-tab="deseo" aria-pressed="${st.tab === 'deseo'}" aria-label="Tu lista, ${S.yo.deseos.length} piezas">♥ ${S.yo.deseos.length}</button><button class="tz-bill" data-abre="__bill"><b>${S.modo === 'dinero' ? '∞' : num(S.yo.saldo || 0)}</b><small>${S.modo === 'dinero' ? 'Puntos de prueba' : 'Puntos de Tienda'}${S.yo.prem ? ' · Premium' : ''}</small></button></span>`;
// 🎁 quien te lo mandó, por su nombre (18/11/2026): el objeto manda su clave («praiseriza») y salía tal cual. `dn` es el
// nombre, si un día lo manda el objeto
function regalosRecibidos(X, S, liga) {
  if (!S.yo.regalos.length) return '';
  return `<section class="tz-sec tz-recibidos">${S.yo.regalos.map((r) => `<div class="tz-regalo"><span class="tz-regalo-v">${r.piezas[0] && S.cat.piezas[r.piezas[0]] ? (esFondo(S.cat.piezas[r.piezas[0]].c) ? arteFondo(X, r.piezas[0]) : vista(X, r.piezas[0])) : ''}</span>
    <span><b>${r.de ? esc(liga.nombreDe(r.de, r.dn)) + ' te regaló ' : 'Te regalaron '}${r.que.startsWith('col:') ? 'la colección «' + esc((S.cat.colecciones[r.que.slice(4)] || {}).n || '') + '»' : esc((S.cat.piezas[r.piezas[0]] || {}).n || '')}</b>${r.msg ? '<small>«' + esc(r.msg) + '»</small>' : ''}<small>Tienes hasta el ${diaCorto(r.fin)} para contestar.</small></span>
    <span class="tz-regalo-b"><button class="tz-b negro" data-regalo="${r.id}" data-si="1">Aceptar</button><button class="tz-b l" data-regalo="${r.id}" data-si="0">Rechazar</button></span></div>`).join('')}</section>`;
}
function dropDia(st, svg) {
  // `{ya: true}` (18/11/2026): el objeto dijo que el de hoy ya se abrió —al volver a la Tienda `drop` arranca vacío y
  // ofrecía «Abrir» otra vez—, pero no qué salió: sin «Ver lo que salió»
  const r = st.drop;
  return `<section class="tz-sec tz-sec-drop" id="tz-drop"><div class="tz-drop${r ? ' abierto' : ''}">
    <span class="tz-drop-real${r ? ' gris' : ' an'}" aria-hidden="true">${svg || ''}</span>
    <div class="tz-drop-t"><span class="tz-cambia">Gratis · uno por día</span><b>Tu Dragón Drop del día</b>
      <span>${r ? 'Ya lo abriste: el próximo, mañana desde la medianoche (hora del este).' : 'Se renueva todos los días a la medianoche (hora del este). Sale con las mismas chances que los Dragón Drops.'}</span></div>
    ${r ? '' : '<button class="tz-b blanco" data-drop>Abrir</button>'}
  </div></section>`;
}
function barraCelu(S, st, tengo) {
  const r = loPuesto(S, st, tengo);
  if (!r.n && !cambiado(st)) return '';
  // sin cuenta, a entrar (18/11/2026): «Ver total» abría la hoja con «tienes 0: te faltan…», como el probador
  return `<div class="tz-barra" data-pie-fijo><span>Probando <b>${r.n}</b>${r.n ? ' · <b>' + num(r.total) + '</b>' : ''}</span>
    <button class="tz-b" data-cmp="${st.comparar ? 0 : 1}">${st.comparar ? 'Probando' : 'Lo tuyo'}</button>${r.n ? (S.anon ? '<button class="tz-b blanco" data-acc="entrar">Entrar para comprar</button>' : S.yo.saldo >= r.total ? '<button class="tz-b blanco" data-abre="__puesto">Comprar</button>' : '<button class="tz-b" data-abre="__puesto">Ver total</button>') : ''}</div>`;
}

// ── las hojas (la ficha, comprar lo puesto, la billetera, las reglas, el drop) ──
const popCab = (t, sub, pc) => `<div class="tz-pop-cab" style="--pc:${pc || '#F6F6F6'}"><span class="tz-pop-ico" aria-hidden="true"></span><div><b>${t}</b><small>${sub || ''}</small></div><button class="tz-x" data-acc="cerrar" aria-label="Cerrar">×</button></div>`;
function vistaGrande(X, S, id) {
  const p = S.cat.piezas[id];
  if (p.c === 'aro') return `<div class="tz-vg-av">${avatar(X, id, null)}</div>`;
  if (p.c === 'deco') return `<div class="tz-vg-av">${avatar(X, null, id)}</div>`;
  if (p.c === 'nom') return `<div class="tz-vg-nom">${nombre(X, id)}</div>`;
  if (p.c === 'carta') return `<div class="tz-vg-carta">${carta(X, id)}</div>`;
  return `<div class="tz-vg-caja">${vista(X, id)}</div>`;
}
const noRegalo = (S, id) => { const p = S.cat.piezas[id]; return p.c === 'serv' ? 'el cambio de nombre es sólo para ti' : S.cat.gratis[id] ? 'es gratis para todos' : tiene(p, 'num') ? 'las ediciones de 10 no se regalan' : tiene(p, 'prem') ? 'las piezas Premium no se regalan' : ''; };
function lineas(S, id) {
  const p = S.cat.piezas[id], base = S.cat.precios[p.r], pr = precioIt(S, id);
  return `<ul class="tz-lineas"><li><span>${esc(p.n)}</span><b>${num(base)}</b></li>${pr !== base ? `<li><span>${pr ? 'Premium' : 'Gratis'}</span><b>−${num(base - pr)}</b></li>` : ''}<li class="tot"><span>Total</span><b>${num(pr)}</b></li></ul><p class="tz-saldo">Tu saldo: <b>${num(S.yo.saldo)}</b> → <b>${num(S.yo.saldo - pr)}</b></p>`;
}
// 🎁 A QUIÉN SE LE PUEDE REGALAR (18/11/2026): la búsqueda miraba sólo las 200 filas de la tabla, y a nadie de fuera se
// le podía regalar. Se suman los de fuera que ya viajan (`Fx`, los perfiles abiertos `X`) y los de /api/perfiles si ya
// se bajaron (`window.PERF`: no se piden acá, son 159 KB). Si es o no verificado lo sigue diciendo el objeto
function genteRegalo(liga) {
  const m = new Map();
  const suma = (k, n) => { if (k && n && !m.has(k)) m.set(k, { k, n }); };
  (liga.d.tabla || []).forEach((r) => suma(r.k, r.n));
  Object.values(liga.X || {}).forEach((r) => suma(r && r.k, r && r.n));
  const P = window.PERF && window.PERF.p;
  if (P) Object.entries(P).forEach(([k, p]) => { if (p && p.f) suma(k, p.f.n); });
  Object.values(liga.Fx || {}).forEach((r) => suma(r && r.k, r && r.n));
  return [...m.values()];
}
function regaloHTML(X, S, st, liga, id) {
  const col = S.cat.colecciones[id];
  if (!S.yo.regalos_quedan) return `<p class="tz-conf falta">Ya mandaste tus regalos de esta semana. Se renuevan el lunes a las 11 AM (hora del este).</p><button class="tz-b" data-acc="ver">Volver</button>`;
  if (!st.para) {
    const q = (st.busca || '').trim().toLowerCase();
    const filas = q.length < 2 ? [] : genteRegalo(liga).filter((r) => r.k !== st.k && String(r.n || '').toLowerCase().includes(q)).slice(0, 6);
    return `<p class="tz-conf">¿A quién? Le llega a su campana con tu nombre y lo acepta o lo rechaza. Te quedan <b>${S.yo.regalos_quedan}</b> esta semana.</p>
      <input class="tz-busca" data-busca type="search" placeholder="Busca su nombre" value="${esc(st.busca || '')}" aria-label="Buscar a quién regalar">
      <div class="tz-gente">${filas.map((r) => `<button class="tz-per" data-elige="${esc(r.k)}"><span class="tz-per-c">${esc(String(r.n || '?')[0])}</span>${esc(r.n)}</button>`).join('') || (q.length >= 2 ? '<p class="tz-nota">Nadie con ese nombre.</p>' : '')}</div>
      <button class="tz-b" data-acc="ver">Volver</button>`;
  }
  // el nombre de quien está fuera de la tabla también (18/11/2026): salía su clave
  const quien = liga.nombreDe(st.para);
  // ✋ el botón se apaga mientras va el pedido (18/11/2026), como los de comprar: un doble toque mandaba (y cobraba) dos regalos
  return `<p class="tz-conf">Regalar <b>${col ? 'la colección «' + esc(col.n) + '»' : esc(S.cat.piezas[id].n)}</b> a <b>${esc(quien)}</b>.${col ? ' Pagas sólo lo que le falta.' : ''}</p>
    <div class="tz-msgs" role="radiogroup" aria-label="Mensaje">${MENSAJES.map((m, i) => `<button role="radio" aria-checked="${st.msg === i}" data-msg="${i}">${m}</button>`).join('')}</div>
    <p class="tz-nota tz-ancho">Tiene 14 días para aceptarlo. Si lo rechaza o no contesta, te vuelven los Puntos.</p>
    <div class="tz-dos"><button class="tz-b" data-acc="regalar">Cancelar</button><button class="tz-b prim" data-acc="confirmar-regalo"${st.va ? ' disabled' : ''}>${st.va ? 'Regalando…' : 'Regalar'}</button></div>`;
}
function fichaPieza(X, S, st, tengo, liga, id) {
  const p = S.cat.piezas[id], mio = tengo.has(id), pr = precioIt(S, id), base = S.cat.precios[p.r];
  const premSolo = tiene(p, 'prem') && !S.yo.prem, nr = noRegalo(S, id), enLista = S.yo.deseos.includes(id);
  const ed = S.cat.ediciones[id], inv = S.yo.inv.find((x) => x.p === id), fn = fueraNav(S.cat, id, Date.now());
  const gratisLuego = !!(fn && S.cat.gratis[id] && Date.now() < fn.desde);
  const cor = mio ? '' : `<button class="tz-b tz-corb" data-acc="deseo" aria-pressed="${enLista}">${enLista ? '♥ En tu lista' : '♡ A tu lista'}</button>`;
  const paso = st.paso || 'ver';
  let acc = '';
  if (st.error) acc += `<p class="tz-conf falta">${esc(ERRORES[st.error] || 'No se pudo: ' + st.error)}</p>`;
  if (paso === 'ver') {
    if (mio) acc += `<div class="tz-tuyo">✓ Lo tienes${S.yo.numeros[id] ? ' · el tuyo es el #' + S.yo.numeros[id] + ' de ' + (ed ? ed.copias : 10) : ''}</div>${sePone(p) ? '<button class="tz-b prim" data-acc="poner">Usar ahora</button>' : ''}${inv && inv.deshacer ? '<button class="tz-b" data-acc="deshacer">Deshacer</button>' : ''}`;
    // 👑 una versión incluida (25/11/2026): viene gratis con su pieza; sola no se compra
    else if (tiene(p, 'inc')) acc += `<p class="tz-nota tz-ancho">Viene <b>gratis</b> con <b>${esc((S.cat.piezas[p.g] || {}).n || '')}</b>: quien la tiene, tiene todas sus versiones.</p><button class="tz-b prim" data-abre="${p.g}">Ver ${esc((S.cat.piezas[p.g] || {}).n || '')}</button><button class="tz-b" data-acc="probar">Probar</button>`;
    else if (tiene(p, 'pronto')) acc += `<p class="tz-fecha tz-ancho">Sale pronto</p><p class="tz-nota tz-ancho">Todavía no se vende: falta terminar lo que hace. Ponla en tu lista y la campana te avisa.</p>${cor}`;
    else if (tiene(p, 'num')) {
      const abre = ed && Date.now() >= ed.venta;
      acc += abre ? `<button class="tz-b prim" data-acc="comprar">Comprar por ${num(pr)}</button><button class="tz-b" data-acc="probar">Probar</button>`
        : `<p class="tz-fecha tz-ancho">A la venta el ${ed ? diaCorto(ed.venta) : ''}</p><button class="tz-b prim" data-acc="deseo">${enLista ? '♥ Te avisamos ese día' : '♡ Avísame'}</button><button class="tz-b" data-acc="probar">Probar</button>`;
      acc += '<p class="tz-nota tz-ancho">Una por persona, para quien jugó en la temporada.</p>';
    } else if (fn) {
      // 🎄 fuera de su ventana no se ofrece comprar ni reclamar (18/11/2026): el objeto contestaba «Ya no se vende.»
      acc += `<p class="tz-fecha tz-ancho">${Date.now() < fn.desde ? (S.cat.gratis[id] ? 'Se reclama' : 'A la venta') + ' desde el ' + diaCorto(fn.desde) : 'Ya no se vende'}</p>${seProbar(p) ? '<button class="tz-b" data-acc="probar">Probar</button>' : ''}${cor}`;
    } else if (premSolo) acc += `<p class="tz-nota tz-ancho">Sólo Premium. Si la compras con Premium, es tuya aunque después se te venza.</p>${seProbar(p) ? '<button class="tz-b" data-acc="probar">Probar</button>' : ''}${cor}`;
    else if (!pr) acc += `${seProbar(p) ? '<button class="tz-b" data-acc="probar">Probar</button>' : ''}<button class="tz-b prim" data-acc="confirmar"${st.va ? ' disabled' : ''}>${st.va ? 'Reclamando…' : 'Reclamar gratis'}</button>`;
    else acc += `${seProbar(p) ? '<button class="tz-b" data-acc="probar">Probar</button>' : ''}<button class="tz-b prim" data-acc="comprar">Comprar por ${num(pr)}</button><button class="tz-b tz-reg" data-acc="regalar" ${nr ? 'disabled' : ''}>Regalar</button>${cor}${nr ? `<p class="tz-nota tz-ancho">No se regala: ${nr}.</p>` : ''}${enLista ? '<p class="tz-nota tz-ancho">♥ Te avisa la campana cuando entre en la vitrina o baje de precio.</p>' : ''}`;
  } else if (paso === 'comprar') {
    acc += S.yo.saldo >= pr ? `<div class="tz-conf caja">${lineas(S, id)}${seProbar(p) && !tiene(p, 'num') ? `<label class="tz-check"><input type="checkbox" data-poneral ${st.ponerAl ? 'checked' : ''}> Ponérmela al comprar</label>` : ''}<p class="tz-nota">${tiene(p, 'num') ? 'Las ediciones de 10 no se deshacen.' : 'Si te la pones, ya no se puede deshacer.'}</p></div>
      <div class="tz-dos"><button class="tz-b" data-acc="ver">Cancelar</button><button class="tz-b prim" data-acc="confirmar"${st.va ? ' disabled' : ''}>${st.va ? 'Comprando…' : 'Comprar por ' + num(pr)}</button></div>`
      : `<p class="tz-conf falta">Te faltan <b>${num(pr - S.yo.saldo)}</b> Puntos (tienes ${num(S.yo.saldo)}). Se ganan jugando, entrando cada día y con tus Tareas.</p><button class="tz-b" data-acc="ver">Volver</button>`;
  } else if (paso === 'regalar') acc += regaloHTML(X, S, st, liga, id);
  else if (paso === 'hecho') {
    const r = st.res || {};
    acc += `${(r.colecciones || []).length ? `<div class="tz-logro">¡Completaste la colección «${esc((S.cat.colecciones[r.colecciones[0]] || {}).n || '')}»! Te llevas su insignia y su pieza exclusiva.</div>` : ''}<div class="tz-tuyo">✓ ${r.numero ? 'Es tuya: la #' + r.numero : pr ? 'Ya es tuya' : 'Reclamada: es tuya'}</div>
      <p class="tz-nota tz-ancho">${inv && inv.deshacer ? 'Está en tu Inventario. Mientras no te la pongas, la puedes deshacer durante 24 horas (una vez por pieza).' : 'Está en tu Inventario.'}</p>
      ${sePone(p) && !(inv && inv.usada) ? '<button class="tz-b prim" data-acc="poner">Usar ahora</button>' : ''}<button class="tz-b" data-acc="cerrar">Seguir mirando</button>${inv && inv.deshacer ? '<button class="tz-b" data-acc="deshacer">Deshacer</button>' : ''}`;
  } else if (paso === 'deshecho') acc += `<div class="tz-tuyo">Deshecho: te volvieron ${num((st.res || {}).vuelve || 0)} Puntos</div><p class="tz-nota tz-ancho">Si la vuelves a comprar, esa compra ya no se puede deshacer.</p><button class="tz-b" data-acc="cerrar">Seguir mirando</button>`;
  else if (paso === 'regalado') acc += `<div class="tz-tuyo">Enviado</div><p class="tz-nota tz-ancho">Le llegó a su campana${st.msg ? ', con «' + MENSAJES[st.msg] + '»' : ''}. Si no lo acepta en 14 días, te vuelven los Puntos.</p><button class="tz-b" data-acc="cerrar">Seguir mirando</button>`;
  // (18/11/2026) lo gratis antes de su ventana sigue siendo gratis: no su precio entero
  const precio = !pr || gratisLuego ? `<b>Gratis</b> <small>para todos, ${gratisLuego ? 'desde el ' + diaCorto(fn.desde) : 'hasta el 1/1'}</small>`
    : S.yo.prem && pr !== base ? `<span class="tz-tachado">${num(base)}</span> <b>${num(pr)}</b> <small>PdT con tu Premium</small>`
    : `<b>${num(pr)}</b> <small>PdT</small>${tiene(p, 'num') ? ' <span class="tz-pgris">sin descuento Premium</span>' : ` <span class="tz-pgris">Premium: ${num(Math.round(base * S.cat.desc.prem))}</span>`}`;
  const duenos = ed && paso === 'ver' ? (() => {
    const d = Object.fromEntries((ed.duenos || []).map(([n, k]) => [n, k]));
    // el nombre también de quien está fuera de la tabla (18/11/2026): salía su clave
    const f = [`<li class="c"><b>#1</b><span>${d[1] ? esc(liga.nombreDe(d[1])) : 'Reservada para el campeón'}</span></li>`];
    for (let i = 2; i <= ed.copias; i++) f.push(`<li><b>#${i}</b><span>${d[i] ? esc(liga.nombreDe(d[i])) : 'libre'}</span></li>`);
    return `<div class="tz-duenos"><b>Quién tiene cada número</b><ol>${f.join('')}</ol><p class="tz-nota">Si no se venden todas, la edición se cierra con las vendidas y no se reedita nunca.</p></div>`;
  })() : '';
  return `<div class="tz-ficha" role="dialog" aria-label="${esc(p.n)}">${popCab(esc(p.n), subDe(S, id), RZ[p.r][1])}
    <div class="tz-f-vis">${vistaGrande(X, S, id)}</div>
    <div class="tz-f-inf">${selectorVar(X, S, tengo, id)}${unaEtiqueta(S, tengo, id) ? `<div class="tz-fila">${unaEtiqueta(S, tengo, id)}</div>` : ''}
      <p>${esc(p.d)}</p><p class="tz-donde"><b>Se ve en:</b> ${DONDE[p.c] || ''}.${EN_DISCORD[p.c] ? ' ' + EN_DISCORD[p.c] : ''}</p>
      ${paso === 'ver' && !mio ? `<div class="tz-f-precio">${precio}</div>` : ''}
      <div class="tz-acc">${acc}</div>${duenos}</div></div>`;
}
function fichaCol(X, S, st, tengo, liga, cid) {
  const j = S.cat.colecciones[cid], r = precioCol(S, cid, tengo), ya = j.piezas.length - r.falta.length;
  const paso = st.paso || 'ver';
  let acc = st.error ? `<p class="tz-conf falta">${esc(ERRORES[st.error] || 'No se pudo: ' + st.error)}</p>` : '';
  // (18/11/2026) con una sola pieza decía «Comprar las 1 que faltan»
  if (paso === 'ver') acc += `${r.falta.length ? `<button class="tz-b prim" data-acc="comprar">Comprar ${r.falta.length === 1 ? 'la que falta' : 'las ' + r.falta.length + ' que faltan'} por ${num(r.p)}</button>` : '<div class="tz-tuyo">✓ Colección completa: su insignia y su pieza exclusiva ya son tuyas</div>'}<button class="tz-b tz-reg" data-acc="regalar">Regalar</button><p class="tz-nota tz-ancho">Si la regalas, pagas sólo lo que le falta a esa persona.</p>`;
  else if (paso === 'comprar') acc += S.yo.saldo >= r.p ? `<p class="tz-saldo">Tu saldo: <b>${num(S.yo.saldo)}</b> → <b>${num(S.yo.saldo - r.p)}</b></p><p class="tz-nota tz-ancho">Si la deshaces, se deshace entera.</p><div class="tz-dos"><button class="tz-b" data-acc="ver">Cancelar</button><button class="tz-b prim" data-acc="confirmar"${st.va ? ' disabled' : ''}>${st.va ? 'Comprando…' : 'Comprar por ' + num(r.p)}</button></div>`
    : `<p class="tz-conf falta">Te faltan <b>${num(r.p - S.yo.saldo)}</b> Puntos (tienes ${num(S.yo.saldo)}).</p><button class="tz-b" data-acc="ver">Volver</button>`;
  else if (paso === 'regalar') acc += regaloHTML(X, S, st, liga, cid);
  else if (paso === 'regalado') acc += `<div class="tz-tuyo">Enviado</div><p class="tz-nota tz-ancho">Le llegó a su campana. Si no la acepta en 14 días, te vuelven los Puntos.</p><button class="tz-b" data-acc="cerrar">Seguir mirando</button>`;
  else if (paso === 'hecho') acc += `<div class="tz-tuyo">✓ ¡Completaste la colección «${esc(j.n)}»!</div><p class="tz-nota tz-ancho">Te llevas su insignia para tu perfil y su pieza exclusiva, que no se vende.</p><button class="tz-b" data-acc="cerrar">Seguir mirando</button>`;
  const minis = j.piezas.map((id) => `<div class="tz-j-mini${tengo.has(id) ? ' mio' : ''}"><div class="tz-j">${arteFondo(X, id)}</div><span>${LUGAR_DE[S.cat.piezas[id].c]} · ${tengo.has(id) ? '✓ lo tienes' : num(S.cat.precios[S.cat.piezas[id].r])}</span></div>`).join('');
  return `<div class="tz-ficha" role="dialog" aria-label="Colección ${esc(j.n)}">${popCab('Colección «' + esc(j.n) + '»', ya + ' de ' + j.piezas.length + ' · al completarla, premio', '#29B298')}
    <div class="tz-f-inf"><p>${esc(j.d)} Las piezas combinan entre sí, y cada una también se vende sola; la colección cobra sólo las que te faltan. <b>Si la completas</b> (de a una o todas juntas) te llevas su insignia y una pieza exclusiva que no se vende.</p>
      <span class="tz-colbar" style="--p:${Math.round(ya / j.piezas.length * 100)}%"><i></i></span>
      <div class="tz-j-grilla">${minis}</div>
      <p class="tz-cuenta">${j.piezas.length} piezas · ${num(r.todas)} −${pct(r.desc)} = <b>${num(Math.round(r.todas * r.desc / 100) * 100)}</b>${ya ? ` · ya tienes ${ya} → pagas <b>${num(r.p)}</b>` : ''}</p>
      <div class="tz-acc">${acc}</div></div></div>`;
}
function fichaPuesto(X, S, st, tengo) {
  const r = loPuesto(S, st, tengo);
  const paso = st.paso || 'ver';
  let acc = st.error ? `<p class="tz-conf falta">${esc(ERRORES[st.error] || 'No se pudo: ' + st.error)}</p>` : '';
  // (18/11/2026) si algo de lo que ya era tuyo no se pudo poner (el error de arriba), lo comprado sí quedó puesto
  if (paso === 'hecho') acc += `<div class="tz-tuyo">✓ Es todo tuyo</div><p class="tz-nota">${st.error ? 'Lo que compraste ya está en tu Inventario y puesto.' : 'Ya está en tu Inventario y puesto.'}</p><button class="tz-b" data-acc="cerrar">Seguir mirando</button>`;
  else if (!r.n) acc += `<div class="tz-tuyo">✓ Todo lo puesto es tuyo</div><button class="tz-b" data-acc="cerrar">Seguir mirando</button>`;
  else acc += S.yo.saldo >= r.total ? `<p class="tz-saldo">Tu saldo: <b>${num(S.yo.saldo)}</b> → <b>${num(S.yo.saldo - r.total)}</b></p><p class="tz-nota tz-ancho">Te lo pones al comprar, así que la compra es definitiva.</p><div class="tz-dos"><button class="tz-b" data-acc="cerrar">Cancelar</button><button class="tz-b prim" data-acc="confirmar-puesto"${st.va ? ' disabled' : ''}>${st.va ? 'Comprando…' : 'Comprar por ' + num(r.total)}</button></div>`
    : `<p class="tz-conf falta">Todo junto son ${num(r.total)} y tienes ${num(S.yo.saldo)}: te faltan <b>${num(r.total - S.yo.saldo)}</b>. Compra sólo lo que alcanza con «Sólo esto», o saca alguna pieza.</p><button class="tz-b" data-acc="cerrar">Volver al probador</button>`;
  // (18/11/2026) con una sola pieza de la colección decía «las 1 que faltan»
  const filas = paso === 'hecho' ? '' : r.juegos.map((g) => `<li><span class="tz-lp-v">${arteFondo(X, g.j.piezas[0])}</span><span>Colección «${esc(g.j.n)}» <small>${g.n === 1 ? 'la que falta' : 'las ' + g.n + ' que faltan'}</small></span><b>${num(g.p)}</b></li>`).join('')
    + r.sueltas.map((id) => `<li><span class="tz-lp-v">${esFondo(S.cat.piezas[id].c) ? arteFondo(X, id) : vista(X, id)}</span><span>${esc(S.cat.piezas[id].n)} <small>${RANURA[S.cat.piezas[id].c] || LUGAR_DE[S.cat.piezas[id].c] || ''}</small></span><b>${num(precioIt(S, id))}</b></li>`).join('')
    + (r.n ? `<li class="tot"><span></span><span>Total</span><b>${num(r.total)}</b></li>` : '');
  return `<div class="tz-ficha" role="dialog" aria-label="Comprar lo que te pruebas">${popCab('Comprar lo que te pruebas', r.n ? r.n + ' cosa' + (r.n > 1 ? 's' : '') + ' de una vez' : '')}
    <div class="tz-f-inf"><ul class="tz-lp">${filas}</ul><div class="tz-acc">${acc}</div></div></div>`;
}
const REGLAS = [
  ['Es tuyo para siempre, y no cambia sin ti.', 'Si mejoramos el dibujo de algo que tienes, te llega la versión nueva sin pagar.'],
  ['Los precios nunca suben.', 'Si uno baja, quien lo compró hace poco recibe la diferencia.'],
  ['Nada de lo que compras es al azar.', 'Ves exactamente lo que compras. El drop del día es aparte y gratis.'],
  ['Deshacer.', '24 horas, si no te la pusiste, una vez por pieza. Una colección comprada junta se deshace entera.'],
  ['Regalos.', 'Unos pocos por semana, a verificados y si jugaste un evento esta temporada. Quien lo recibe lo acepta o lo rechaza; si no contesta en 14 días, te vuelven los Puntos. No se regalan las ediciones de 10, las piezas Premium ni el cambio de nombre.'],
  // «(hora del este)» (18/11/2026): sin instante a mano, la hora fija se dice de qué zona es
  ['La vitrina', 'cambia los lunes a las 11 AM (hora del este). Lo que sólo pasa por ella vuelve al menos cada 2 meses.'],
  ['Ediciones de 10.', 'Una por persona, para quien jugó esa temporada. La #1 es del campeón. Si no se venden todas, la edición se cierra con las vendidas. No se reeditan nunca.'],
  ['Premium.', 'Un descuento en las piezas y otro en las colecciones (no se suman). Lo sólo-Premium que compraste sigue siendo tuyo si se te vence.'],
];
const reglasPop = () => `<div class="tz-ficha" role="dialog" aria-label="Cómo funciona la Tienda">${popCab('Cómo funciona la Tienda', 'Ocho reglas, cortas')}<div class="tz-f-inf tz-reglas"><ol>${REGLAS.map(([t, d]) => `<li><details><summary>${t}</summary><p>${d}</p></details></li>`).join('')}</ol></div></div>`;
// 🧪 lo que se tocó en una vista de MODS (no hay ficha abierta donde decirlo)
const modoPop = (S) => `<div class="tz-ficha" role="dialog" aria-label="Vista de Mods">${popCab(S.modo === 'prueba' ? 'Modo prueba' : S.modo === 'dinero' ? 'Dinero de prueba' : 'Como un usuario', 'Mods', '#E8B923')}<div class="tz-f-inf"><p>${ERRORES.modo}</p><button class="tz-b" data-acc="cerrar">Entendido</button></div></div>`;
// ⚠️ EL ERROR DE UN TOQUE SIN FICHA ABIERTA (18/11/2026): el drop del día, el ♡ de la grilla, «Tu lista» o aceptar un
// regalo guardaban el error y sólo las fichas lo dibujan, así que el toque no hacía nada visible («Ya abriste el de
// hoy.», «El drop del día es de los Miembros de DRA.» y «Primero verifícate.» no salían nunca)
const ERR_DE = { 'regalo-abrir': 'Tu artículo de la vitrina', 'regalo-comprar': 'Tu artículo de la vitrina', drop: 'Tu Dragón Drop del día', deseo: 'Tu lista', 'deseo-publico': 'Tu lista', regalo: 'Un regalo' };
const errorPop = (st) => `<div class="tz-ficha" role="dialog" aria-label="No se pudo">${popCab('No se pudo', ERR_DE[st.errDe] || '', '#E8B923')}<div class="tz-f-inf"><p>${esc(ERRORES[st.error] || 'No se pudo: ' + st.error)}</p><button class="tz-b" data-acc="cerrar">Entendido</button></div></div>`;
const billPop = (S) => `<div class="tz-ficha" role="dialog" aria-label="Tu billetera">${popCab('Tu billetera', 'Puntos de Tienda', '#29B298')}<div class="tz-f-inf"><p class="tz-bill-g"><b>${num(S.yo.saldo || 0)}</b> Puntos de Tienda${S.yo.prem ? ' · con Premium' : ''}</p><p class="tz-nota">Se ganan jugando, entrando cada día, con tus Tareas del Pase, cazando y con los Dragón Drops.</p></div></div>`;
const dropPop = (st) => { const r = st.drop || {}; const c = RZ[r.rareza || 0] || RZ[0]; return `<div class="tz-ficha" role="dialog" aria-label="Tu Dragón Drop">${popCab('Tu Dragón Drop del día', 'Salió ' + (r.nombre || c[0]), c[1])}<div class="tz-f-inf"><div class="tz-drop-sale" style="--r:${c[1]}"><span class="tz-drop-v" aria-hidden="true"></span><b>${r.titulo ? 'Título «' + esc(r.titulo) + '»' : ''}${r.titulo && r.puntos ? ' + ' : ''}${r.puntos ? num(r.puntos) + ' Puntos' : ''}</b></div><p class="tz-nota">El próximo, mañana desde la medianoche (hora del este).</p><button class="tz-b prim" data-acc="cerrar">Listo</button></div></div>`; };

// ── el arte: se pide una vez por versión y queda en el navegador ──
function leerArte() { try { return JSON.parse(sessionStorage.getItem('lg:tienda-arte') || 'null'); } catch (e) { return null; } }
// 🔁 SI EL PEDIDO FALLA, SE REINTENTA (18/11/2026): se pedía una sola vez por versión, y un corte de red, un 5xx o un
// `ok:false` dejaban la página en «Cargando la Tienda…» para siempre (el sondeo de 15 s trae la misma `arte_v` y no lo
// vuelve a pedir). Tres reintentos espaciados —4, 8 y 12 s: son ~300 KB cada uno— y después «No pude cargar la Tienda»
// con «Reintentar». Devuelve [el arte, si falló, reintentar]
function useArte(v, anon) {
  const [A, setA] = useState(() => { const c = leerArte(); return c && c.v === v ? c : null; });
  const [intento, setIntento] = useState(0);
  const [fallo, setFallo] = useState(false);
  useEffect(() => {
    if (!v) return undefined;
    const c = leerArte();
    if (c && c.v === v) { usarCss('tienda-arte-' + v, c.css); setA(c); return undefined; }
    let vivo = true, otra = null;
    const mal = () => {
      if (!vivo) return;
      if (intento < 3) otra = setTimeout(() => setIntento((n) => n + 1), 4000 * (intento + 1));
      else setFallo(true);
    };
    const pide = anon || typeof window.conCuenta !== 'function'
      ? fetch('/api/avisos/tienda-arte', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"anon":1}' }).then((r) => r.json())
      : window.conCuenta('/api/avisos/tienda-arte', { v: '' });
    pide.then((j) => {
      if (!vivo) return;
      if (j && j.ok && j.p) {
        try { sessionStorage.setItem('lg:tienda-arte', JSON.stringify({ v: j.v, css: j.css, p: j.p })); } catch (e) { /* igual */ }
        usarCss('tienda-arte-' + j.v, j.css);
        setFallo(false);
        setA({ v: j.v, css: j.css, p: j.p });
      } else mal();
    }).catch(mal);
    return () => { vivo = false; clearTimeout(otra); };
  }, [v, intento]);
  const reintentar = useCallback(() => { setFallo(false); setIntento(0); }, []);
  return [A, fallo, reintentar];
}

const CLAVES = { aro: 'aro', deco: 'deco', nom: 'nom', carta: 'carta' };
function desdeServidor(S) {
  const puesto = { aro: null, deco: null, nom: null, carta: null }, fondo = { fp: null, fv: null, fe: null, fd: null, ff: null, fr: null };
  for (const [r, p] of Object.entries(S.yo.puesto || {})) { if (r in CLAVES) puesto[r] = p; else if (r in fondo) fondo[r] = p; }
  return { puesto, fondo };
}

// 🧪 LAS DOS VISTAS DEL MENÚ DE MODS, SÓLO PARA EL DUEÑO (17/11/2026): «Tener todo (prueba)» —todas las piezas como tuyas,
// con Premium y las ediciones— y «Ver como un usuario» —sin tu Premium ni el ensayo—. No tocan nada del objeto: sólo cambian
// lo que la página cree que tienes, y `accion()` no manda nada mientras estén prendidas (ponerte algo en la prueba, sí, acá)
// 💸 Y «DINERO DE PRUEBA» (20/11/2026, la página Mods): Puntos que no se terminan. Lo que compras se suma acá, en lo que la
// página cree que tienes (`yo.inv`), para que te lo pongas y lo veas puesto; al objeto no sale nada
const DINERO_PRUEBA = 99999999;
function verComo(S, prueba, usuario, dinero) {
  if (!prueba && !usuario && !dinero) return S;
  const yo = Object.assign({}, S.yo);
  if (prueba) {
    yo.inv = Object.keys(S.cat.piezas).map((p) => ({ p, o: 'prueba', pagado: 0, t: 0, usada: false, deshacer: false }));
    yo.prem = true;
    yo.numeros = Object.fromEntries(Object.keys(S.cat.ediciones || {}).map((id) => [id, 1]));
  }
  if (usuario) yo.prem = false;
  if (dinero && !prueba) { yo.saldo = DINERO_PRUEBA; yo.inv = (yo.inv || []).slice(); }
  return Object.assign({}, S, { yo, ensayo: false, modo: prueba ? 'prueba' : dinero ? 'dinero' : 'usuario' });
}

const RG_TIEMBLA = 850, RG_DURA = 2700;
export default function TiendaNueva({ liga, dc, S: S0, recargar, partes }) {
  const M = useModsEstado();
  const yoDueno = !!dc && String(dc.id) === DUENO;
  const S = useMemo(() => verComo(S0, yoDueno && !!M.prueba, yoDueno && !!M.usuario && !M.prueba && !M.dinero, yoDueno && !!M.dinero),
    [S0, yoDueno, M.prueba, M.usuario, M.dinero]);
  const k = (dc && dc.clave) || '';
  const [A, falloArte, reintentarArte] = useArte(S.arte_v, !!S.anon);
  const [, repintar] = useState(0);
  const pinta = () => repintar((x) => x + 1);
  const st = useRef(null);
  if (!st.current) {
    const m = desdeServidor(S);
    // `drop_hoy` (18/11/2026): si el objeto un día manda que el de hoy ya se abrió (y qué salió), se sabe desde el arranque
    st.current = { k, tab: 'aro', slide: 0, comparar: false, lugar: 'fp', abierta: null, paso: null, msg: 0, ponerAl: false, error: '', va: false,
      busca: '', para: '', res: null, drop: (S.yo && S.yo.drop_hoy) || null, mas: '', puesto: Object.assign({}, m.puesto), fondo: Object.assign({}, m.fondo), mio: m };
  }
  const E = st.current;
  // lo tuyo cambia cuando el objeto contesta: lo puesto del servidor manda sobre «lo tuyo»
  useEffect(() => { const m = desdeServidor(S); E.mio = m; }, [S]);
  const tengo = new Set(S.yo.inv.map((x) => x.p));
  // 👥 quién lleva cada pieza (lo público del Pase, `tp`): «Lo llevan» de la vitrina y de la pelea
  const pub = usePases();
  const llevan = useMemo(() => {
    const m = {};
    for (const [kk, t] of Object.entries((pub && pub.tp) || {})) for (const id of new Set(Object.values(t || {}))) (m[id] = m[id] || []).push(kk);
    return m;
  }, [pub]);
  const pedir = useCallback((d) => window.conCuenta('/api/avisos/tienda-accion', d), []);
  const ix = useIndice(['tz-vitrina', 'tz-prob', 'tz-x-cabezas', 'tz-x-promo', 'tz-x-crew', 'tz-x-ropa', 'tz-drop'], 70);
  // el Dragón Drop de verdad, quieto (el mismo dibujo del escenario de los drops)
  const [dropSvg, setDropSvg] = useState('');
  useEffect(() => { let vivo = true; dropQuietoSvg('drop', 0).then((x) => { if (vivo) setDropSvg(x || ''); }).catch(() => {}); return () => { vivo = false; }; }, []);

  async function accion(d, despues) {
    // 🧪 en una vista de MODS no sale nada al objeto: en la prueba, ponerse algo es local (para verlo puesto)
    if (S.modo) {
      // 💸 con el dinero de prueba, comprar es sumarlo a lo que la página cree que tienes (y nada sale al objeto)
      if (S.modo === 'dinero' && /^comprar/.test(d.accion)) {
        const ids = d.accion === 'comprar-col' ? ((S.cat.colecciones[d.col] || {}).piezas || []) : d.piezas || [d.pieza];
        const ya = new Set(S.yo.inv.map((x) => x.p));
        for (const p of ids) if (p && !ya.has(p)) S.yo.inv.push({ p, o: 'prueba', pagado: 0, t: Date.now(), usada: false, deshacer: false });
        if (d.poner && d.pieza && S.cat.piezas[d.pieza]) { const pz = S.cat.piezas[d.pieza]; if (esFondo(pz.c)) E.mio.fondo[pz.c] = d.pieza; else if (pz.c in E.mio.puesto) E.mio.puesto[pz.c] = d.pieza; }
        if (despues) await despues({ ok: true });
        pinta();
        return { ok: true };
      }
      const p = d.accion === 'poner' && (S.modo === 'prueba' || S.modo === 'dinero') ? S.cat.piezas[d.pieza] : null;
      if (p) {
        if (esFondo(p.c)) E.mio.fondo[p.c] = d.pieza; else if (p.c in E.mio.puesto) E.mio.puesto[p.c] = d.pieza;
        if (despues) despues({ ok: true });
        pinta();
        return { ok: true };
      }
      Object.assign(E, { error: 'modo', abierta: E.abierta || '__modo', paso: E.abierta ? E.paso : null }); pinta();
      return null;
    }
    E.va = true; E.error = ''; pinta();
    let j = null;
    try { j = await pedir(d); } catch (e) { j = { error: 'red' }; }
    E.va = false;
    if (!j || !j.ok) {
      E.error = (j && j.error) || 'error';
      if (/^(comprar|regalo-)/.test(d.accion)) sonar('error');
      // 🐉 el de hoy ya estaba abierto (18/11/2026): al volver a la Tienda `drop` arranca vacío y se ofrecía «Abrir» otra vez
      if (d.accion === 'drop' && E.error === 'ya') E.drop = { ya: true };
      // ⚠️ sin ficha abierta, el error abre su hoja (18/11/2026): si no, el toque no hacía nada visible (ver `errorPop`)
      if (!E.abierta) { E.abierta = '__error'; E.errDe = d.accion; }
      // 💰 si el objeto dice que no alcanza, el saldo que se veía estaba viejo: se trae el de verdad (17/11/2026)
      if (E.error === 'saldo') await recargar();
      pinta(); return null;
    }
    E.res = j;
    // 🔊 lo que se pagó suena a caja registradora; lo que se puso o se guardó, a «listo»
    // (sólo lo importante, Dlx: «muy pocos, los importantes»: comprar; ponerse algo o la lista ya no suenan)
    if (/^(comprar|regalo-comprar)/.test(d.accion)) sonar('compra');
    // se espera (18/11/2026): el de «Comprar todo» pone lo que ya era tuyo antes de recargar
    if (despues) await despues(j);
    // 🛍️ lo que te pusiste se ve en toda la página (tanda 3): `/pases` lo trae, y se pide de nuevo ya mismo
    if (d.accion === 'poner' || d.accion === 'comprar-puesto' || (d.accion === 'comprar' && d.poner)) refrescarPases();
    await recargar();
    pinta();
    return j;
  }
  // 🎁 abrir: la caja tiembla al menos `RG_TIEMBLA` ms (aunque el objeto conteste antes: si no, no se ve), y al llegar
  // lo que salió se guarda acá mismo (`rgLocal`) para no esperar a la recarga, que trae lo mismo
  function abrirRegalo(i) {
    if (E.rgAbriendo || E.va) return;
    E.rgAbriendo = { i, t: Date.now() }; E.rgConfirma = null; pinta();
    // 🔊 la caja suena mientras tiembla, y al abrirse, el pop y lo que salió
    sonar('sacude');
    const sacude = setInterval(() => sonar('sacude'), 380);
    if (window.innerWidth < 900) { const v = raiz.current && raiz.current.querySelector('.dq-vis'); if (v && v.getBoundingClientRect().top < 60) v.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    const tiembla = new Promise((r) => setTimeout(r, RG_TIEMBLA));
    accion({ accion: 'regalo-abrir', i }, async (j) => {
      await tiembla;
      clearInterval(sacude);
      if (!j.ya) { sonar('pop'); setTimeout(() => sonar('premio', j.oferta.k), 260); }
      const dia = (S.yo.regalos_dia || {}).dia || '';
      E.rgLocal = E.rgLocal || {};
      (E.rgLocal[dia] = E.rgLocal[dia] || {})[i] = j.oferta;
      E.rgAbriendo = null;
      const t = Date.now();
      E.rgRecien = j.ya ? null : { i, t, k: j.oferta.k };
      if (!j.ya && navigator.vibrate) { try { navigator.vibrate(j.oferta.k === 'gratis' ? [40, 60, 90] : 25); } catch (e) { /* sin vibrar */ } }
      pinta();
      if (E.rgRecien) setTimeout(() => { if (E.rgRecien && E.rgRecien.t === t) { E.rgRecien = null; pinta(); } }, RG_DURA);
    }).then((r) => { clearInterval(sacude); if (!r && E.rgAbriendo) { E.rgAbriendo = null; pinta(); } });
  }
  // 🐉 el drop del día se cobra y se abre en el mismo pedido (`drop` contesta como `drop-abrir`), y el escenario de
  // siempre anima hasta lo que salió. Dlx, 25/11/2026: «que sea el estilo de los drops que siempre tenemos y con sus
  // animaciones, no un huevo así de gallina». Se monta en la raíz de la Tienda (el botón ya no existe después de pintar)
  function abrirDropDia() {
    if (E.va) return;
    accion({ accion: 'drop' }, (j) => {
      E.drop = j;
      const item = { id: 'tdia', tipo: 'drop', min: 0, origen: 'tdia' };
      abrirConEscenario(raiz.current, item, () => Promise.resolve(j), () => { try { pedirDrops(); } catch (e) { /* se pone al día sola */ } })
        .catch(() => { E.abierta = '__drop'; pinta(); });
    });
  }
  function comprarRegalo(i) {
    const dia = (S.yo.regalos_dia || {}).dia || '';
    accion({ accion: 'regalo-comprar', i, dia, poner: false }, () => {
      const of = regalosHoy(S, E).ab[i];
      if (of) { E.rgLocal = E.rgLocal || {}; (E.rgLocal[dia] = E.rgLocal[dia] || {})[i] = Object.assign({}, of, { usado: true }); }
      E.rgConfirma = null;
    });
  }
  function probar(id, fijo) {
    const p = S.cat.piezas[id];
    if (!p) return;
    if (esFondo(p.c)) { E.fondo[p.c] = !fijo && E.fondo[p.c] === id ? E.mio.fondo[p.c] : id; E.lugar = p.c; return; }
    if (p.c in E.puesto) E.puesto[p.c] = !fijo && E.puesto[p.c] === id ? E.mio.puesto[p.c] : id;
  }
  const irAlProbador = () => setTimeout(() => {
    const h = document.getElementById('inicio-nuevo'); const el = h && h.shadowRoot && h.shadowRoot.getElementById('tz-prob');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 0);
  const tabDe = (p) => (esFondo(p.c) ? 'fondo' : p.c === 'serv' ? 'nom' : p.c);

  function clic(e) {
    const t = e.target.closest('[data-rg-abrir],[data-rg-comprar],[data-rg-si],[data-rg-no],[data-filtro],[data-orden],[data-abre],[data-acc],[data-tab],[data-lugar],[data-prueba],[data-saca],[data-elige],[data-msg],[data-deseo],[data-publico],[data-slide],[data-comprar],[data-reclamar],[data-probar-ir],[data-cmp],[data-drop],[data-regalo],[data-mas]');
    if (!t || t.disabled) return;
    const d = t.dataset;
    // sin cuenta se mira y se prueba todo; lo que mueve Puntos o guarda algo tuyo pasa por Discord (y vuelve a la Tienda)
    // (18/11/2026) también «Comprar todo» (`__puesto`): sin cuenta abría la hoja con «tienes 0: te faltan…»
    const pideCuenta = d.acc === 'entrar' || (S.anon && (d.deseo || d.publico !== undefined || d.regalo || d.drop !== undefined || d.comprar || d.rgAbrir !== undefined || d.rgComprar !== undefined ||
      d.reclamar || d.abre === '__bill' || d.abre === '__puesto' || ['comprar', 'regalar', 'poner', 'deseo', 'deshacer', 'confirmar', 'confirmar-puesto', 'confirmar-regalo'].includes(d.acc)));
    if (pideCuenta) { if (window.urlLogin) location.href = window.urlLogin('t'); return; }
    if (d.deseo) { const si = !S.yo.deseos.includes(d.deseo); accion({ accion: 'deseo', pieza: d.deseo, si }); return; }
    if (d.publico !== undefined) { accion({ accion: 'deseo-publico', si: !S.yo.deseo_publico }); return; }
    if (d.regalo) { accion({ accion: 'regalo', id: d.regalo, si: d.si === '1' }); return; }
    if (d.drop !== undefined) { abrirDropDia(); return; }
    if (d.filtro) { E.filtro = d.filtro; pinta(); return; }
    if (d.orden) { E.orden = d.orden; pinta(); return; }
    if (d.rgAbrir !== undefined) { if (d.slide !== undefined) E.slide = +d.slide; abrirRegalo(+d.rgAbrir); return; }
    if (d.rgComprar !== undefined) { E.rgConfirma = +d.rgComprar; pinta(); return; }
    if (d.rgNo !== undefined) { E.rgConfirma = null; pinta(); return; }
    if (d.rgSi !== undefined) { comprarRegalo(+d.rgSi); return; }
    if (d.mas !== undefined) { E.mas = E.mas === d.mas ? '' : d.mas; pinta(); return; }
    // ☑️ «Ponérmela al comprar» se desmarca en cada ficha nueva y al cerrar (18/11/2026): quedaba marcada para la compra
    // siguiente, también en piezas donde la casilla no se ve (te las ponía sin pedirlo y perdías el Deshacer)
    if (d.abre) { Object.assign(E, { abierta: d.abre, paso: null, msg: 0, error: '', busca: '', para: '', res: null, ponerAl: false }); }
    else if (d.comprar) Object.assign(E, { abierta: d.comprar, paso: 'comprar', error: '', res: null, ponerAl: false });
    else if (d.reclamar) { E.abierta = d.reclamar; accion({ accion: 'comprar', pieza: d.reclamar }, () => { E.paso = 'hecho'; }); return; }
    else if (d.probarIr) { const p = S.cat.piezas[d.probarIr]; E.tab = tabDe(p); probar(d.probarIr); E.comparar = false; irAlProbador(); }
    else if (d.slide !== undefined) E.slide = +d.slide;
    else if (d.cmp !== undefined) E.comparar = d.cmp === '1';
    else if (d.acc) {
      const a = d.acc, id = E.abierta, col = S.cat.colecciones[id];
      if (a === 'cerrar') Object.assign(E, { abierta: null, paso: null, error: '', ponerAl: false });
      else if (a === 'ver' || a === 'comprar') Object.assign(E, { paso: a, error: '' });
      else if (a === 'regalar') Object.assign(E, { paso: 'regalar', para: '', busca: '', error: '' });
      else if (a === 'volver') { E.puesto = Object.assign({}, E.mio.puesto); E.fondo = Object.assign({}, E.mio.fondo); E.comparar = false; }
      else if (a === 'probar') { const p = S.cat.piezas[id]; probar(id); E.tab = tabDe(p); E.comparar = false; E.abierta = window.innerWidth < 900 ? '__prob' : null; E.paso = null; irAlProbador(); }
      else if (a === 'poner') { const p = S.cat.piezas[id]; accion({ accion: 'poner', ranura: p.c, pieza: id }, () => { probar(id, true); Object.assign(E, { abierta: null, paso: null }); }); return; }
      else if (a === 'deseo') { accion({ accion: 'deseo', pieza: id, si: !S.yo.deseos.includes(id) }); return; }
      else if (a === 'deshacer') { accion({ accion: 'deshacer', pieza: id }, () => { E.paso = 'deshecho'; }); return; }
      else if (a === 'confirmar') {
        // ✋ un segundo toque mientras va el pedido no manda otro (18/11/2026)
        if (E.va) return;
        if (col) accion({ accion: 'comprar-col', col: id }, () => { E.paso = 'hecho'; });
        else {
          // «poner» sólo si la casilla se vio (18/11/2026): no se dibuja en lo de Perfil, lo gratis ni las ediciones
          const pz = S.cat.piezas[id], pon = !!E.ponerAl && seProbar(pz) && !tiene(pz, 'num');
          accion({ accion: 'comprar', pieza: id, poner: pon }, () => { E.paso = 'hecho'; if (pon) probar(id, true); });
        }
        return;
      } else if (a === 'confirmar-puesto') {
        const r = loPuesto(S, E, tengo);
        // 🧥 LO QUE YA ERA TUYO Y TE ESTABAS PROBANDO TAMBIÉN SE PONE (18/11/2026): `comprar-puesto` sólo pone lo que compra,
        // y la hoja decía «Ya está en tu Inventario y puesto» con tu aro sin ponerse (volvía «Probando | Lo tuyo»)
        const tuyos = [...Object.keys(E.puesto).map((ra) => [ra, E.puesto[ra], E.mio.puesto[ra]]), ...Object.keys(E.fondo).map((ra) => [ra, E.fondo[ra], E.mio.fondo[ra]])]
          .filter(([, x, m]) => x && x !== m && tengo.has(x));
        accion({ accion: 'comprar-puesto', piezas: r.falta }, async () => {
          const mio = { puesto: Object.assign({}, E.puesto), fondo: Object.assign({}, E.fondo) };
          E.va = true;
          for (const [ra, x] of tuyos) {
            let j = null;
            // con una vista de Mods prendida, ponerse lo tuyo también es local (nada sale al objeto)
            try { j = S.modo ? { ok: true } : await pedir({ accion: 'poner', ranura: ra, pieza: x }); } catch (e) { j = null; }
            // lo que no se pudo poner queda como estaba (y el error sale en la hoja)
            if (!(j && j.ok)) { E.error = (j && j.error) || 'error'; if (ra in mio.puesto) mio.puesto[ra] = E.mio.puesto[ra]; else mio.fondo[ra] = E.mio.fondo[ra]; }
          }
          E.va = false;
          E.paso = 'hecho'; E.mio = mio;
        });
        return;
      } else if (a === 'confirmar-regalo') {
        if (E.va) return;
        accion(Object.assign({ accion: 'regalar', para: E.para, msg: E.msg }, col ? { col: id } : { pieza: id }), () => { E.paso = 'regalado'; });
        return;
      }
    }
    else if (d.tab) { E.tab = d.tab; if (t.closest('.dq')) irAlProbador(); }
    else if (d.lugar) E.lugar = d.lugar;
    else if (d.prueba) { probar(d.prueba); E.comparar = false; }
    else if (d.saca) { for (const x of Object.keys(E.puesto)) if (E.puesto[x] === d.saca) E.puesto[x] = E.mio.puesto[x]; for (const x of Object.keys(E.fondo)) if (E.fondo[x] === d.saca) E.fondo[x] = E.mio.fondo[x]; }
    else if (d.msg !== undefined) E.msg = +d.msg;
    else if (d.elige) E.para = d.elige;
    pinta();
  }
  function cambio(e) {
    if (e.target.matches('[data-poneral]')) { E.ponerAl = e.target.checked; return; }
    if (e.target.matches('[data-busca]')) {
      E.busca = e.target.value; pinta();
      setTimeout(() => { const h = document.getElementById('inicio-nuevo'); const i = h && h.shadowRoot && h.shadowRoot.querySelector('[data-busca]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 0);
    }
  }
  useEffect(() => {
    const f = (e) => { if (e.key === 'Escape' && E.abierta) { Object.assign(E, { abierta: null, paso: null, ponerAl: false }); pinta(); } };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []);
  // una cara que no carga pasa a la inicial (el `error` de una imagen no sube: se escucha en la captura). Antes de que el
  // navegador pinte (useLayoutEffect), y mirando las que ya fallaron: un 404 rápido llegaba antes que el useEffect
  const raiz = useRef(null);
  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el) return undefined;
    const cambia = (t) => {
      if (!t || t.tagName !== 'IMG' || !t.dataset || !t.dataset.ini || (t.getAttribute('src') || '').startsWith('data:')) return;
      FOTO_MUERTA.add(t.getAttribute('src'));
      t.setAttribute('src', t.dataset.ini);
    };
    const f = (e) => cambia(e.target);
    el.addEventListener('error', f, true);
    el.querySelectorAll('img[data-ini]').forEach((i) => { if (i.complete && !i.naturalWidth) cambia(i); });
    return () => el.removeEventListener('error', f, true);
  });

  // 💿 el disco sale de la funda sólo cuando cambió la funda elegida (el HTML se rehace entero en cada cambio)
  const fundaVista = useRef(null);
  useLayoutEffect(() => {
    const v = raiz.current && raiz.current.querySelector('.dq-vis');
    if (!v || fundaVista.current === v.dataset.slideId) return;
    fundaVista.current = v.dataset.slideId;
    v.classList.add('sale');
  });

  // sin arte después de los reintentos, se dice y se deja reintentar (18/11/2026): quedaba «Cargando…» para siempre
  if (!A) return <section className="sec tn-sec tn-espera" aria-live="polite"><div className="sec-t"><h2>Tienda</h2></div>{falloArte
    ? <p className="pronto-p">No pude cargar la Tienda.{' '}<button type="button" className="btn borde2 chico" onClick={reintentarArte}>Reintentar</button></p>
    : <p className="pronto-p">Cargando la Tienda…</p>}</section>;
  const fila = (liga.T && liga.T[k]) || (liga.X && liga.X[k]) || {};
  const crudo = String(fila.n || (dc && (dc.rapero || dc.n)) || 'Tú');
  // la cara: la de la tabla, la de tu cuenta de Discord, la de quien jugó y no está en la tabla; si no hay, la inicial
  const cara = liga.avUrl(k, 1024) || (dc && dc.av ? 'https://cdn.discordapp.com/avatars/' + dc.av + '.webp?size=1024' : null) || (liga.avNombre ? liga.avNombre(crudo, 1024) : null);
  const ini = inicialSvg(crudo);
  const X = { p: A.p, foto: esc(cara && !FOTO_MUERTA.has(cara) ? cara : ini), ini: esc(ini), carta: esc((k && liga.cartaUrl(k, 'temporada')) || CARTA_MUESTRA), cartaIni: esc(CARTA_MUESTRA), n: esc(crudo), crudo };
  let hoja = '';
  if (E.abierta) {
    const id = E.abierta;
    hoja = id === '__modo' ? modoPop(S) : id === '__error' ? errorPop(E) : id === '__puesto' ? fichaPuesto(X, S, E, tengo) : id === '__reglas' ? reglasPop() : id === '__bill' ? billPop(S) : id === '__drop' ? dropPop(E)
      : id === '__prob' ? `<div class="tz-ficha" role="dialog" aria-label="El probador">${popCab('El probador', 'Lo que te estás probando', '#E41373')}<div class="tz-f-inf">${escenario(X, S, E)}${probando(S, E, tengo)}</div></div>`
      : S.cat.colecciones[id] ? fichaCol(X, S, E, tengo, liga, id) : S.cat.piezas[id] ? fichaPieza(X, S, E, tengo, liga, id) : '';
  }
  const arriba = `${S.modo ? '<p class="tz-ensayo">' + (S.modo === 'prueba' ? 'Modo prueba (Mods): tienes todo de mentira. Te lo puedes poner para verlo; no se compra ni se guarda nada.' : S.modo === 'dinero' ? 'Dinero de prueba (Mods): Puntos que no se terminan. Lo que compras es de mentira: lo ves puesto mientras esté prendido, y no se guarda nada.' : 'Viendo la Tienda como un usuario (Mods): sin tu Premium y sin el ensayo. En esta vista no se compra nada.') + '</p>' : ''}${S.ensayo ? '<p class="tz-ensayo">Ensayo: la Tienda está cerrada y sólo la ves tú. Lo que compres es de verdad.</p>' : ''}${regalosRecibidos(X, S, liga)}${hero(X, S, E, tengo, liga, llevan)}
    <section class="tz-sec" id="tz-prob" data-tuto="tz-probador"><div class="tz-sec-t"><h2>El probador</h2>${pildora(S, E)}</div>
      <div class="tz-prob"><div class="tz-col-esc">${escenario(X, S, E)}${probando(S, E, tengo)}</div><div class="tz-col-cat" data-tuto="tz-piezas">${tabs(S, E)}${piezas(X, S, E, tengo)}</div></div></section>`;
  const drop = dropDia(E, dropSvg);
  const barra = barraCelu(S, E, tengo);
  // 🧭 EL ÍNDICE DE LA TIENDA (25/11/2026, Dlx: «expande la tienda con esas cosas que ocultaste, precio por cabeza, tu promo,
  // tu crew, ropa UL, al último, pero que puedas ir por categorías así como el Inicio»): el índice pegado de las páginas
  // largas (`useIndice`, indice.js). Las ranuras son chips que abren su pestaña del cajón; lo demás baja a su sección
  const chips = [['tz-vitrina', 'Vitrina'], ...CATS.map(([k, n]) => ['tz-prob', n, k]),
    ...(partes ? [['tz-x-cabezas', 'Precio por cabeza'], ['tz-x-promo', 'Tu promo'], ['tz-x-crew', 'Tu crew'], ['tz-x-ropa', 'Ropa UL']] : []),
    ['tz-drop', 'Drop del día']]
    .filter(([id]) => ix.hay.includes(id));
  const indice = chips.length > 2 ? (
    <nav className="tz-ix" aria-label="Qué hay en la Tienda">
      <ol ref={ix.tira}>{chips.map(([id, t, tab]) => {
        const on = ix.act === id && (!tab || E.tab === tab);
        return <li key={id + (tab || '')}><button type="button" className={on ? 'on' : ''} aria-current={on ? 'true' : undefined}
          onClick={() => { if (tab) { E.tab = tab; if (tab === 'fondo' && !E.lugar) E.lugar = 'fp'; E.comparar = false; pinta(); } ix.ir(id); }}>{t}</button></li>;
      })}
      <li><button type="button" className="tz-ix-r" onClick={() => { E.abierta = '__reglas'; pinta(); }}>¿Cómo funciona?</button></li></ol>
    </nav>
  ) : null;
  return (
    <div className="tz" ref={raiz}>
      {indice}
      <div onClick={clic} onInput={cambio} onChange={cambio} dangerouslySetInnerHTML={{ __html: arriba }} />
      {partes ? (
        <div className="tz-mas" data-tuto="tz-mas">
          <div id="tz-x-cabezas">{partes.cabezas}</div>
          <div id="tz-x-promo">{partes.promo}</div>
          <section className="sec tn-sec tz-crew" id="tz-x-crew" aria-labelledby="tz-crew-t">
            <div className="sec-t"><h2 id="tz-crew-t">Tu crew</h2></div>
            <p className="tz-crew-p">Arma la tuya con tus Puntos de Tienda (2.500): su nombre, su sigla, su logo y hasta 20 personas. Sube de tier con lo que juegan sus miembros.</p>
            <a className="tz-b blanco tz-crew-b" href="#/crews">Ir a Crews</a>
          </section>
          <div id="tz-x-ropa">{partes.ropa}</div>
        </div>
      ) : null}
      {/* 🐉 el Dragón Drop del día, ABAJO DE TODO (26/11/2026, Dlx: «asegúrate de poner el drop diario de la tienda abajo de
          todo»): iba entre el probador y Precio por cabeza */}
      <div onClick={clic} dangerouslySetInnerHTML={{ __html: drop }} />
      <div onClick={clic} dangerouslySetInnerHTML={{ __html: barra }} />
      {hoja ? <div className="tz-capa" onClick={clic} onInput={cambio} onChange={cambio} dangerouslySetInnerHTML={{ __html: `<div class="tz-velo" data-acc="cerrar"></div><div class="tz-hoja">${hoja}</div>` }} /> : null}
    </div>
  );
}
