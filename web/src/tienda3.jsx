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
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { num } from './liga.js';
import CSS_PAGINA from './css/tienda3.css?inline';
import { usarCss } from './css.js';
import { refrescarPases } from './pase.js';

usarCss('tienda3', CSS_PAGINA);

// las rarezas son las de los Dragón Drops (públicas): nombre y color
const RZ = [['Maqueta', '#9AA4B2'], ['Mixtape', '#29B298'], ['Vinilo', '#9B5CFF'], ['Disco de Oro', '#FF4F93'], ['Micrófono de Oro', '#F5C542'],
  ['Disco de Diamante', '#BFF4FF']];
const LUGARES_F = [['fp', 'Perfil'], ['fv', 'VS'], ['fe', 'Escenario'], ['fd', 'Discord'], ['ff', 'Ficha'], ['fr', 'Ranking']];
const LUGAR_DE = Object.fromEntries(LUGARES_F);
const RANURA = { aro: 'Aro', deco: 'Deco', nom: 'Nombre', carta: 'Carta', perfil: 'Perfil', serv: 'Nombre' };
const TABS = [['aro', 'Aros'], ['deco', 'Decoraciones'], ['nom', 'Nombre'], ['perfil', 'Perfil'], ['carta', 'Carta'], ['fondo', 'Fondos'], ['juego', 'Colecciones'], ['prem', 'Premium']];
const EXTRA = { nav: 'Navidad', num: 'Ediciones de 10', deseo: '♥ Tu lista' };
const DONDE = {
  aro: 'tu foto en toda la página: el ranking, los comentarios, Publicaciones, tu perfil, /card y tu mitad del VS en vivo',
  deco: 'tu foto en toda la página, encima de tu aro', nom: 'tu nombre en el ranking, tu perfil, tu ficha y los comentarios',
  carta: 'tus cartas en la página y en /card', perfil: 'tu perfil', serv: 'toda la Liga: tu nombre de ahora queda como alias',
  fp: 'la portada de tu perfil', fv: 'tu mitad del VS del Inicio', fe: 'el escenario de tu carta', fd: 'tu mitad del VS en vivo de Discord',
  ff: 'tu ficha', fr: 'tu fila en el ranking',
};
// ⏳ ABIERTA ANTES QUE LA TANDA 3 (17/11/2026, Dlx: «abrir ya, avisando»): lo que te pones se ve en la Tienda y todavía no
// en el resto de la página. Cuando la tanda 3 lo lleve a cada lugar, se borra esta línea y el «Se va a ver en» vuelve a «Se ve en»
// ✅ DESDE LA TANDA 3 se ve en toda la página (puesto.js). Lo que todavía falta es lo que se dibuja para Discord —/card y la
// imagen del VS en vivo, que se arman en GitHub—: eso lo dice cada pieza a la que le toca
const EN_DISCORD = { aro: 'En /card y en el VS de Discord, muy pronto.', deco: 'En /card y en el VS de Discord, muy pronto.',
  carta: 'En /card, muy pronto.', fd: 'Muy pronto: el VS de Discord se dibuja aparte.' };
const MENSAJES = ['Sin mensaje', '¡Felicitaciones!', 'Para tu próxima batalla', 'Te lo ganaste'];
const ERRORES = { pronto: 'Todavía no se vende: sale pronto.', saldo: 'No te alcanzan los Puntos.', ya_la_tienes: 'Ya la tienes.', premium: 'Es sólo para Premium.', no_esta: 'Ya no está en la vitrina.',
  fuera_de_fecha: 'Ya no se vende.', todavia_no: 'Todavía no está a la venta.', cerrada: 'La venta ya cerró.', agotada: 'Se agotaron.',
  no_jugaste: 'Es para quien jugó en la temporada.', usada: 'Ya te la pusiste: no se puede deshacer.', tarde: 'Pasaron las 24 horas.',
  ya_deshecha: 'Ya la deshiciste una vez.', no_se_puede: 'No se puede deshacer.', tope: 'Ya mandaste tus regalos de esta semana.',
  ya_lo_tiene: 'Ya lo tiene.', no_verificado: 'Esa persona no está verificada.', no_se_regala: 'No se regala.', verificate: 'Primero verifícate.',
  no_miembro: 'El drop del día es de los Miembros de DRA.', ya: 'Ya abriste el de hoy.', todavia: 'La billetera todavía no está lista: prueba en un rato.' };
const esFondo = (c) => ['fp', 'fv', 'fe', 'fd', 'ff', 'fr'].includes(c);
const seProbar = (p) => !!p && (['aro', 'deco', 'nom', 'carta'].includes(p.c) || esFondo(p.c));
// lo de tu perfil no se prueba en el escenario, pero se pone igual (sale en tu perfil)
const sePone = (p) => seProbar(p) || (!!p && p.c === 'perfil');
const tiene = (p, x) => !!p && (p.t || []).includes(x);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const enVentana = (w, t) => !!w && t >= w.desde && t < w.hasta;
const diaCorto = (t) => { const d = new Date(t); return d.toLocaleDateString('es', { day: 'numeric', month: 'numeric', timeZone: 'America/New_York' }); };

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
function sobreTi(X, S, st, id) {
  const p = S.cat.piezas[id];
  if (!p) return '';
  if (esFondo(p.c)) return `<div class="tz-yo-f">${enLugar(X, id)}</div>`;
  if (!['aro', 'deco', 'nom', 'carta'].includes(p.c)) return `<div class="tz-yo-f">${vista(X, id)}</div>`;
  const q = Object.assign({}, st.puesto, { [p.c]: id });
  return `<div class="tz-yo${p.c === 'carta' ? ' c' : ''}"><div class="tz-yo-a">${avatar(X, q.aro, q.deco)}<div class="tz-yo-n">${nombre(X, q.nom)}</div></div><div class="tz-yo-c">${carta(X, q.carta)}</div></div>`;
}

// ── lo que se ve ──
function cambiado(st) {
  return ['aro', 'deco', 'nom', 'carta'].some((k) => st.puesto[k] !== st.mio.puesto[k]) || Object.keys(st.fondo).some((k) => st.fondo[k] !== st.mio.fondo[k]);
}
function loPuesto(S, st, tengo) {
  const ids = [...new Set([...Object.values(st.puesto), ...Object.values(st.fondo)].filter(Boolean))];
  const falta = ids.filter((id) => { const p = S.cat.piezas[id]; return p && !tengo.has(id) && !(tiene(p, 'prem') && !S.yo.prem) && !tiene(p, 'num'); });
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
  const p = S.cat.piezas[id];
  if (tengo.has(id)) return '<span class="tz-tag mio">Lo tienes</span>';
  if (S.cat.gratis[id]) return '<span class="tz-tag nav">Gratis en Navidad</span>';
  if (tiene(p, 'prem')) return '<span class="tz-tag prem">Sólo Premium</span>';
  if (tiene(p, 'num')) return '<span class="tz-tag num">Edición de 10</span>';
  if (tiene(p, 'nav')) return '<span class="tz-tag nav">Navidad · hasta el 1/1</span>';
  return '';
}
const corazon = (S, id) => { const en = S.yo.deseos.includes(id); return `<button class="tz-cor" data-deseo="${id}" aria-pressed="${en}" aria-label="${en ? 'Sacar de tu lista' : 'Agregar a tu lista'}">${en ? '♥' : '♡'}</button>`; };
const subDe = (S, id) => { const p = S.cat.piezas[id]; return (esFondo(p.c) ? 'Fondo · ' + LUGAR_DE[p.c] : RANURA[p.c] || '') + ' · ' + RZ[p.r][0]; };

function slides(S) {
  const c = S.cat, v = c.vitrina.ids;
  const solo = v.filter((id) => tiene(c.piezas[id], 'rot')), del = v.filter((id) => !tiene(c.piezas[id], 'rot'));
  const out = [...solo.map((id) => ({ id, t: 'solo' })), ...del.map((id) => ({ id, t: 'cat' }))];
  for (const id of Object.keys(c.gratis)) out.push({ id, t: 'nav' });
  for (const id of Object.keys(c.ediciones).slice(0, 1)) out.push({ id, t: 'num' });
  return out;
}
function cambiaTxt(S) { const h = S.cat.vitrina.hasta; return h ? 'Cambia el lunes ' + diaCorto(h) + ' · 11 AM' : 'Cambia los lunes · 11 AM'; }

function hero(X, S, st, tengo) {
  const L = slides(S);
  if (!L.length) return '';
  const s = L[Math.min(st.slide, L.length - 1)], it = S.cat.piezas[s.id];
  const ed = S.cat.ediciones[s.id];
  const eti = s.t === 'solo' ? 'Sólo en la vitrina' : s.t === 'cat' ? 'En la vitrina' : s.t === 'nav' ? 'Navidad · gratis para todos' : 'Edición de 10';
  const baja = s.t === 'solo' ? 'No está en el catálogo. Vuelve al menos cada 2 meses.' : s.t === 'cat' ? 'También está siempre en el catálogo.'
    : s.t === 'nav' ? 'Para todos los que entren hasta el 1/1.' : 'Una por persona, para quien jugó en la temporada. La #1 es del campeón.';
  const mio = tengo.has(s.id), enLista = S.yo.deseos.includes(s.id);
  const cor = `<button class="tz-b tz-cor-b" data-deseo="${s.id}" aria-pressed="${enLista}" aria-label="${enLista ? 'Sacar de tu lista' : 'A tu lista'}">${enLista ? '♥' : '♡'}</button>`;
  let bot;
  if (s.t === 'nav') bot = (mio ? '<span class="tz-hecho">✓ Ya es tuyo</span>' : `<button class="tz-b blanco" data-reclamar="${s.id}">Reclamar gratis</button>`) + '<button class="tz-b" data-tab="nav">Ver Navidad</button>';
  else if (s.t === 'num') bot = `<button class="tz-b blanco" data-deseo="${s.id}">${enLista ? '♥ Te avisamos ese día' : '♡ Avísame'}</button><button class="tz-b" data-tab="num">Ver las ediciones</button>`;
  else bot = (mio ? '<span class="tz-hecho">✓ Ya es tuyo</span>' : `<button class="tz-b blanco" data-comprar="${s.id}">Comprar · ${num(precioIt(S, s.id))}</button>`) + (seProbar(it) ? `<button class="tz-b" data-probar-ir="${s.id}">Probártelo</button>` : '') + (mio ? '' : cor);
  const chips = L.map((x, i) => {
    const y = S.cat.piezas[x.id];
    const sub = x.t === 'nav' ? 'Navidad · gratis' : x.t === 'num' ? 'Edición de 10 · ' + diaCorto((S.cat.ediciones[x.id] || {}).venta || Date.now()) : (RANURA[y.c] || LUGAR_DE[y.c] || '') + ' · ' + (tengo.has(x.id) ? 'tuyo' : num(precioIt(S, x.id)));
    return `<button class="tz-hc${i === st.slide ? ' on' : ''}" data-slide="${i}" style="--r:${RZ[y.r][1]};--i:${i}"><svg class="tz-hc-luz" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect x="1" y="1" width="98" height="98" pathLength="100" vector-effect="non-scaling-stroke"/></svg><span class="tz-hc-v">${esFondo(y.c) ? arteFondo(X, x.id) : vista(X, x.id)}</span><span class="tz-hc-t"><b>${esc(y.n)}</b><small>${sub}</small></span></button>`;
  }).join('');
  const precio = s.t === 'nav' || mio ? '' : `<p class="tz-precio"><b>${num(precioIt(S, s.id))}</b> <small>Puntos de Tienda${s.t === 'num' && ed ? ' · a la venta el ' + diaCorto(ed.venta) : S.yo.prem ? ' · con tu Premium' : tiene(it, 'num') ? '' : ' · Premium ' + num(Math.round(S.cat.precios[it.r] * S.cat.desc.prem))}</small></p>`;
  return `<section data-tuto="tz-vitrina" class="tz-hero" aria-label="La vitrina de esta semana">
    <div class="tz-hero-in">
      <div class="tz-hero-tx">
        <div class="tz-hero-et"><span class="tz-etq">La vitrina · ${esc(String(S.cat.temp || '').toUpperCase())}</span><span class="tz-cambia">${cambiaTxt(S)}</span></div>
        <h2>${esc(it.n)}</h2>
        <p class="tz-rz" style="--r:${RZ[it.r][1]}"><i></i>${subDe(S, s.id)} · <span>${eti}</span></p>
        <p class="tz-hero-p">${esc(it.d)} ${baja}</p>${precio}
        <div class="tz-bots">${bot}</div>
      </div>
      <div class="tz-hero-vis" style="--r:${RZ[it.r][1]}"><span class="tz-sobre">Así te queda</span>${sobreTi(X, S, st, s.id)}</div>
    </div>
    <button class="tz-fl izq" data-slide="${(st.slide + L.length - 1) % L.length}" aria-label="Anterior">‹</button>
    <button class="tz-fl der" data-slide="${(st.slide + 1) % L.length}" aria-label="Siguiente">›</button>
    <div class="tz-hcs-c"><div class="tz-hcs" aria-label="Las piezas de la vitrina"><div class="tz-hcs-pista"><div class="tz-hcs-mitad">${chips}</div><div class="tz-hcs-mitad" aria-hidden="true" inert>${chips}</div></div></div><button class="tz-hcs-fl" data-slide="${(st.slide + 1) % L.length}" aria-label="Siguiente pieza">›</button></div>
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
  return `<div class="tz-probando"><div class="tz-pr-h"><b>Probando</b><span>${r.n ? 'Total ' + num(r.total) + (S.anon ? '' : ' · tienes ' + num(S.yo.saldo)) : 'todo tuyo'}</span></div>
    ${filas ? `<ul>${filas}</ul>` : ''}
    <div class="tz-pr-b">${cambiado(st) ? '<button class="tz-b l" data-acc="volver">Volver a lo mío</button>' : ''}${r.n ? (alc ? `<button class="tz-b negro" data-abre="__puesto">Comprar todo · ${num(r.total)}</button>` : `<button class="tz-b l falta" data-abre="__puesto">Te faltan ${num(r.total - S.yo.saldo)}</button>`) : ''}</div></div>`;
}
function tile(X, S, st, tengo, id) {
  const p = S.cat.piezas[id], mio = tengo.has(id), puede = seProbar(p);
  if (!p) return '';
  const on = Object.values(st.puesto).includes(id) || Object.values(st.fondo).includes(id);
  const prob = on && !mio;
  const eti = prob ? '<span class="tz-et prob">Probando</span>' : mio ? '<span class="tz-et mio">Tuyo</span>' : tiene(p, 'num') ? '<span class="tz-et num">Edición de 10</span>' : tiene(p, 'prem') ? '<span class="tz-et prem">Sólo Premium</span>' : '';
  const pr = precioIt(S, id), base = S.cat.precios[p.r];
  const precio = mio ? '<span class="tz-ok">✓ Tuyo</span>' : tiene(p, 'pronto') ? 'Pronto' : !pr ? 'Gratis' : S.yo.prem && pr !== base ? `<s>${num(base)}</s> ${num(pr)}` : num(pr);
  return `<article class="tz-q${prob ? ' prob' : ''}${on && mio ? ' on' : ''}" style="--r:${RZ[p.r][1]}" title="${esc(p.n)} · ${RZ[p.r][0]}">
    <button class="tz-q-v" ${puede ? `data-prueba="${id}" aria-pressed="${on}" aria-label="Probarte ${esc(p.n)}"` : `data-abre="${id}" aria-label="Ver ${esc(p.n)}"`}>${esFondo(p.c) ? arteFondo(X, id) : vista(X, id)}${eti}</button>
    ${mio || !pr ? '' : corazon(S, id)}
    <div class="tz-q-i"><i aria-label="${RZ[p.r][0]}"></i><b>${esc(p.n)}</b><span class="tz-q-p">${precio}</span><button class="tz-q-ver" data-abre="${id}">Ver</button></div></article>`;
}
function coleccionT(X, S, tengo, cid) {
  const j = S.cat.colecciones[cid], r = precioCol(S, cid, tengo), ya = j.piezas.length - r.falta.length;
  return `<article class="tz-q tz-jg" style="--r:#29B298"><button class="tz-q-v" data-abre="${cid}" aria-label="Ver la colección ${esc(j.n)}"><span class="tz-jg-m">${j.piezas.map((id) => `<span class="tz-j${tengo.has(id) ? ' mio' : ''}">${arteFondo(X, id)}</span>`).join('')}</span></button>
    <div class="tz-q-i"><i></i><b>«${esc(j.n)}» <small>${ya === j.piezas.length ? 'Completa · premio tuyo' : ya + ' de ' + j.piezas.length + ' · premio al completarla'}</small></b><span class="tz-colbar mini" style="--p:${Math.round(ya / j.piezas.length * 100)}%"><i></i></span><span class="tz-q-p">${r.falta.length ? num(r.p) : '<span class="tz-ok">✓ Tuya</span>'}</span><button class="tz-q-ver" data-abre="${cid}">Ver</button></div></article>`;
}
function piezas(X, S, st, tengo) {
  const c = S.cat, t = st.tab, especial = (p) => tiene(p, 'nav') || tiene(p, 'num');
  const grilla = (ids) => `<div class="tz-grid">${ids.map((id) => tile(X, S, st, tengo, id)).join('') || '<p class="tz-vacio">Todavía no hay piezas acá.</p>'}</div>`;
  const de = (f) => Object.keys(c.piezas).filter((id) => f(c.piezas[id], id));
  const vende = (p, id) => !tiene(p, 'col') && (!tiene(p, 'rot') || c.vitrina.ids.includes(id));
  if (t === 'juego') return `<p class="tz-sub"><b>Seis fondos que combinan, uno por lugar</b> · completa una y te llevas su insignia y una pieza exclusiva</p><div class="tz-grid jg">${Object.keys(c.colecciones).map((cid) => coleccionT(X, S, tengo, cid)).join('')}</div>`;
  if (t === 'prem') return `<div class="tz-aviso prem"><b>Premium</b><span>${S.yo.prem ? 'Con tu Premium tienes descuento en todo y en las colecciones, y estas piezas, que son sólo para Premium.' : 'Estas piezas son sólo para quien tiene Premium, que además tiene descuento en todo y en las colecciones.'} Lo que compres sigue siendo tuyo aunque se te venza.</span></div>${grilla(de((p) => tiene(p, 'prem')))}`;
  if (t === 'nav') return `<div class="tz-aviso nav"><b>Navidad</b><span>Lo gratis es para todos los que entren hasta el 1/1. Lo demás se vende hasta esa fecha, y lo que compres es tuyo para siempre.</span></div>${grilla([...Object.keys(c.gratis), ...de((p, id) => tiene(p, 'nav') && !c.gratis[id])])}`;
  if (t === 'num') {
    const ids = Object.keys(c.ediciones), e = c.ediciones[ids[0]] || {};
    return `<div class="tz-boleto"><div><b>Ediciones de 10${e.nombre ? ' · ' + esc(e.nombre) : ''}</b><span>${e.venta ? 'A la venta el ' + diaCorto(e.venta) + '. ' : ''}Una por persona, para quien jugó en la temporada. No se reeditan nunca.</span></div><span class="tz-talon">#1<small>del campeón</small></span></div>${grilla(ids)}`;
  }
  if (t === 'deseo') return `<div class="tz-aviso"><b>Tu lista · ${S.yo.deseos.length}</b><span>La campana te avisa cuando algo de acá entra en la vitrina, baja de precio o sale a la venta.</span><button class="tz-sw" role="switch" aria-checked="${S.yo.deseo_publico}" data-publico>${S.yo.deseo_publico ? 'Se ve en tu perfil' : 'Sólo la ves tú'}</button></div>${grilla(S.yo.deseos)}`;
  if (t === 'fondo') return grilla(de((p, id) => p.c === st.lugar && vende(p, id) && !especial(p)));
  const ids = de((p, id) => p.c === t && vende(p, id) && !especial(p) && !tiene(p, 'prem'));
  if (t === 'nom') ids.push(...de((p) => p.c === 'serv'));
  return grilla(ids);
}
function tabs(S, st) {
  const base = TABS.slice();
  if (EXTRA[st.tab] && !base.some(([k]) => k === st.tab)) base.push([st.tab, EXTRA[st.tab]]);
  return `<nav class="tz-tabs" aria-label="Ranuras">${base.map(([k, n]) => `<button data-tab="${k}" aria-pressed="${st.tab === k}">${n}</button>`).join('')}</nav>`;
}
const pildora = (S, st) => S.anon ? '<span class="tz-bill-c"><button class="tz-bill" data-acc="entrar"><b>Entrar</b><small>con Discord para comprar</small></button></span>' : `<span class="tz-bill-c"><button class="tz-lista" data-tab="deseo" aria-pressed="${st.tab === 'deseo'}" aria-label="Tu lista, ${S.yo.deseos.length} piezas">♥ ${S.yo.deseos.length}</button><button class="tz-bill" data-abre="__bill"><b>${num(S.yo.saldo || 0)}</b><small>Puntos de Tienda${S.yo.prem ? ' · Premium' : ''}</small></button></span>`;
function regalosRecibidos(X, S) {
  if (!S.yo.regalos.length) return '';
  return `<section class="tz-sec tz-recibidos">${S.yo.regalos.map((r) => `<div class="tz-regalo"><span class="tz-regalo-v">${r.piezas[0] && S.cat.piezas[r.piezas[0]] ? (esFondo(S.cat.piezas[r.piezas[0]].c) ? arteFondo(X, r.piezas[0]) : vista(X, r.piezas[0])) : ''}</span>
    <span><b>${r.de ? esc(r.de) + ' te regaló ' : 'Te regalaron '}${r.que.startsWith('col:') ? 'la colección «' + esc((S.cat.colecciones[r.que.slice(4)] || {}).n || '') + '»' : esc((S.cat.piezas[r.piezas[0]] || {}).n || '')}</b>${r.msg ? '<small>«' + esc(r.msg) + '»</small>' : ''}<small>Tienes hasta el ${diaCorto(r.fin)} para contestar.</small></span>
    <span class="tz-regalo-b"><button class="tz-b negro" data-regalo="${r.id}" data-si="1">Aceptar</button><button class="tz-b l" data-regalo="${r.id}" data-si="0">Rechazar</button></span></div>`).join('')}</section>`;
}
function dropDia(st) {
  const r = st.drop;
  return `<section class="tz-sec tz-sec-drop"><div class="tz-drop${r ? ' abierto' : ''}">
    <span class="tz-drop-v" aria-hidden="true"></span>
    <div class="tz-drop-t"><span class="tz-cambia">Gratis · uno por día</span><b>Tu Dragón Drop del día</b>
      <span>${r ? 'Ya lo abriste: el próximo, mañana desde la medianoche (hora del este).' : 'Se renueva todos los días a la medianoche (hora del este). Sale con las mismas chances que los Dragón Drops.'}</span></div>
    ${r ? '<button class="tz-b" data-abre="__drop">Ver lo que salió</button>' : '<button class="tz-b blanco" data-drop>Abrir</button>'}
  </div></section>`;
}
function barraCelu(S, st, tengo) {
  const r = loPuesto(S, st, tengo);
  if (!r.n && !cambiado(st)) return '';
  return `<div class="tz-barra" data-pie-fijo><span>Probando <b>${r.n}</b>${r.n ? ' · <b>' + num(r.total) + '</b>' : ''}</span>
    <button class="tz-b" data-cmp="${st.comparar ? 0 : 1}">${st.comparar ? 'Probando' : 'Lo tuyo'}</button>${r.n ? (S.yo.saldo >= r.total ? '<button class="tz-b blanco" data-abre="__puesto">Comprar</button>' : '<button class="tz-b" data-abre="__puesto">Ver total</button>') : ''}</div>`;
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
function regaloHTML(X, S, st, liga, id) {
  const col = S.cat.colecciones[id];
  if (!S.yo.regalos_quedan) return `<p class="tz-conf falta">Ya mandaste tus regalos de esta semana. Se renuevan el lunes a las 11 AM.</p><button class="tz-b" data-acc="ver">Volver</button>`;
  if (!st.para) {
    const q = (st.busca || '').trim().toLowerCase();
    const filas = q.length < 2 ? [] : (liga.d.tabla || []).filter((r) => r.k !== st.k && String(r.n || '').toLowerCase().includes(q)).slice(0, 6);
    return `<p class="tz-conf">¿A quién? Le llega a su campana con tu nombre y lo acepta o lo rechaza. Te quedan <b>${S.yo.regalos_quedan}</b> esta semana.</p>
      <input class="tz-busca" data-busca type="search" placeholder="Busca su nombre" value="${esc(st.busca || '')}" aria-label="Buscar a quién regalar">
      <div class="tz-gente">${filas.map((r) => `<button class="tz-per" data-elige="${esc(r.k)}"><span class="tz-per-c">${esc(String(r.n || '?')[0])}</span>${esc(r.n)}</button>`).join('') || (q.length >= 2 ? '<p class="tz-nota">Nadie con ese nombre.</p>' : '')}</div>
      <button class="tz-b" data-acc="ver">Volver</button>`;
  }
  const quien = (liga.T && liga.T[st.para]) || { n: st.para };
  return `<p class="tz-conf">Regalar <b>${col ? 'la colección «' + esc(col.n) + '»' : esc(S.cat.piezas[id].n)}</b> a <b>${esc(quien.n)}</b>.${col ? ' Pagas sólo lo que le falta.' : ''}</p>
    <div class="tz-msgs" role="radiogroup" aria-label="Mensaje">${MENSAJES.map((m, i) => `<button role="radio" aria-checked="${st.msg === i}" data-msg="${i}">${m}</button>`).join('')}</div>
    <p class="tz-nota tz-ancho">Tiene 14 días para aceptarlo. Si lo rechaza o no contesta, te vuelven los Puntos.</p>
    <div class="tz-dos"><button class="tz-b" data-acc="regalar">Cancelar</button><button class="tz-b prim" data-acc="confirmar-regalo">Regalar</button></div>`;
}
function fichaPieza(X, S, st, tengo, liga, id) {
  const p = S.cat.piezas[id], mio = tengo.has(id), pr = precioIt(S, id), base = S.cat.precios[p.r];
  const premSolo = tiene(p, 'prem') && !S.yo.prem, nr = noRegalo(S, id), enLista = S.yo.deseos.includes(id);
  const ed = S.cat.ediciones[id], inv = S.yo.inv.find((x) => x.p === id);
  const cor = mio ? '' : `<button class="tz-b tz-corb" data-acc="deseo" aria-pressed="${enLista}">${enLista ? '♥ En tu lista' : '♡ A tu lista'}</button>`;
  const paso = st.paso || 'ver';
  let acc = '';
  if (st.error) acc += `<p class="tz-conf falta">${esc(ERRORES[st.error] || 'No se pudo: ' + st.error)}</p>`;
  if (paso === 'ver') {
    if (mio) acc += `<div class="tz-tuyo">✓ Lo tienes${S.yo.numeros[id] ? ' · el tuyo es el #' + S.yo.numeros[id] + ' de ' + (ed ? ed.copias : 10) : ''}</div>${sePone(p) ? '<button class="tz-b prim" data-acc="poner">Usar ahora</button>' : ''}${inv && inv.deshacer ? '<button class="tz-b" data-acc="deshacer">Deshacer</button>' : ''}`;
    else if (tiene(p, 'pronto')) acc += `<p class="tz-fecha tz-ancho">Sale pronto</p><p class="tz-nota tz-ancho">Todavía no se vende: falta terminar lo que hace. Ponla en tu lista y la campana te avisa.</p>${cor}`;
    else if (tiene(p, 'num')) {
      const abre = ed && Date.now() >= ed.venta;
      acc += abre ? `<button class="tz-b prim" data-acc="comprar">Comprar por ${num(pr)}</button><button class="tz-b" data-acc="probar">Probar</button>`
        : `<p class="tz-fecha tz-ancho">A la venta el ${ed ? diaCorto(ed.venta) : ''}</p><button class="tz-b prim" data-acc="deseo">${enLista ? '♥ Te avisamos ese día' : '♡ Avísame'}</button><button class="tz-b" data-acc="probar">Probar</button>`;
      acc += '<p class="tz-nota tz-ancho">Una por persona, para quien jugó en la temporada.</p>';
    } else if (premSolo) acc += `<p class="tz-nota tz-ancho">Sólo Premium. Si la compras con Premium, es tuya aunque después se te venza.</p>${seProbar(p) ? '<button class="tz-b" data-acc="probar">Probar</button>' : ''}${cor}`;
    else if (!pr) acc += `${seProbar(p) ? '<button class="tz-b" data-acc="probar">Probar</button>' : ''}<button class="tz-b prim" data-acc="confirmar">Reclamar gratis</button>`;
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
  const precio = !pr ? '<b>Gratis</b> <small>para todos, hasta el 1/1</small>'
    : S.yo.prem && pr !== base ? `<span class="tz-tachado">${num(base)}</span> <b>${num(pr)}</b> <small>PdT con tu Premium</small>`
    : `<b>${num(pr)}</b> <small>PdT</small>${tiene(p, 'num') ? ' <span class="tz-pgris">sin descuento Premium</span>' : ` <span class="tz-pgris">Premium: ${num(Math.round(base * S.cat.desc.prem))}</span>`}`;
  const duenos = ed && paso === 'ver' ? (() => {
    const d = Object.fromEntries((ed.duenos || []).map(([n, k]) => [n, k]));
    const f = [`<li class="c"><b>#1</b><span>${d[1] ? esc((liga.T[d[1]] || {}).n || d[1]) : 'Reservada para el campeón'}</span></li>`];
    for (let i = 2; i <= ed.copias; i++) f.push(`<li><b>#${i}</b><span>${d[i] ? esc((liga.T[d[i]] || {}).n || d[i]) : 'libre'}</span></li>`);
    return `<div class="tz-duenos"><b>Quién tiene cada número</b><ol>${f.join('')}</ol><p class="tz-nota">Si no se venden todas, la edición se cierra con las vendidas y no se reedita nunca.</p></div>`;
  })() : '';
  return `<div class="tz-ficha" role="dialog" aria-label="${esc(p.n)}">${popCab(esc(p.n), subDe(S, id), RZ[p.r][1])}
    <div class="tz-f-vis">${vistaGrande(X, S, id)}</div>
    <div class="tz-f-inf">${unaEtiqueta(S, tengo, id) ? `<div class="tz-fila">${unaEtiqueta(S, tengo, id)}</div>` : ''}
      <p>${esc(p.d)}</p><p class="tz-donde"><b>Se ve en:</b> ${DONDE[p.c] || ''}.${EN_DISCORD[p.c] ? ' ' + EN_DISCORD[p.c] : ''}</p>
      ${paso === 'ver' && !mio ? `<div class="tz-f-precio">${precio}</div>` : ''}
      <div class="tz-acc">${acc}</div>${duenos}</div></div>`;
}
function fichaCol(X, S, st, tengo, liga, cid) {
  const j = S.cat.colecciones[cid], r = precioCol(S, cid, tengo), ya = j.piezas.length - r.falta.length;
  const paso = st.paso || 'ver';
  let acc = st.error ? `<p class="tz-conf falta">${esc(ERRORES[st.error] || 'No se pudo: ' + st.error)}</p>` : '';
  if (paso === 'ver') acc += `${r.falta.length ? `<button class="tz-b prim" data-acc="comprar">Comprar las ${r.falta.length} que faltan por ${num(r.p)}</button>` : '<div class="tz-tuyo">✓ Colección completa: su insignia y su pieza exclusiva ya son tuyas</div>'}<button class="tz-b tz-reg" data-acc="regalar">Regalar</button><p class="tz-nota tz-ancho">Si la regalas, pagas sólo lo que le falta a esa persona.</p>`;
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
  if (paso === 'hecho') acc += `<div class="tz-tuyo">✓ Es todo tuyo</div><p class="tz-nota">Ya está en tu Inventario y puesto.</p><button class="tz-b" data-acc="cerrar">Seguir mirando</button>`;
  else if (!r.n) acc += `<div class="tz-tuyo">✓ Todo lo puesto es tuyo</div><button class="tz-b" data-acc="cerrar">Seguir mirando</button>`;
  else acc += S.yo.saldo >= r.total ? `<p class="tz-saldo">Tu saldo: <b>${num(S.yo.saldo)}</b> → <b>${num(S.yo.saldo - r.total)}</b></p><p class="tz-nota tz-ancho">Te lo pones al comprar, así que la compra es definitiva.</p><div class="tz-dos"><button class="tz-b" data-acc="cerrar">Cancelar</button><button class="tz-b prim" data-acc="confirmar-puesto"${st.va ? ' disabled' : ''}>${st.va ? 'Comprando…' : 'Comprar por ' + num(r.total)}</button></div>`
    : `<p class="tz-conf falta">Todo junto son ${num(r.total)} y tienes ${num(S.yo.saldo)}: te faltan <b>${num(r.total - S.yo.saldo)}</b>. Compra sólo lo que alcanza con «Sólo esto», o saca alguna pieza.</p><button class="tz-b" data-acc="cerrar">Volver al probador</button>`;
  const filas = paso === 'hecho' ? '' : r.juegos.map((g) => `<li><span class="tz-lp-v">${arteFondo(X, g.j.piezas[0])}</span><span>Colección «${esc(g.j.n)}» <small>las ${g.n} que faltan</small></span><b>${num(g.p)}</b></li>`).join('')
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
  ['La vitrina', 'cambia los lunes a las 11 AM. Lo que sólo pasa por ella vuelve al menos cada 2 meses.'],
  ['Ediciones de 10.', 'Una por persona, para quien jugó esa temporada. La #1 es del campeón. Si no se venden todas, la edición se cierra con las vendidas. No se reeditan nunca.'],
  ['Premium.', 'Un descuento en las piezas y otro en las colecciones (no se suman). Lo sólo-Premium que compraste sigue siendo tuyo si se te vence.'],
];
const reglasPop = () => `<div class="tz-ficha" role="dialog" aria-label="Cómo funciona la Tienda">${popCab('Cómo funciona la Tienda', 'Ocho reglas, cortas')}<div class="tz-f-inf tz-reglas"><ol>${REGLAS.map(([t, d]) => `<li><details><summary>${t}</summary><p>${d}</p></details></li>`).join('')}</ol></div></div>`;
const billPop = (S) => `<div class="tz-ficha" role="dialog" aria-label="Tu billetera">${popCab('Tu billetera', 'Puntos de Tienda', '#29B298')}<div class="tz-f-inf"><p class="tz-bill-g"><b>${num(S.yo.saldo || 0)}</b> Puntos de Tienda${S.yo.prem ? ' · con Premium' : ''}</p><p class="tz-nota">Se ganan jugando, entrando cada día, con tus Tareas del Pase, cazando y con los Dragón Drops.</p></div></div>`;
const dropPop = (st) => { const r = st.drop || {}; const c = RZ[r.rareza || 0] || RZ[0]; return `<div class="tz-ficha" role="dialog" aria-label="Tu Dragón Drop">${popCab('Tu Dragón Drop del día', 'Salió ' + (r.nombre || c[0]), c[1])}<div class="tz-f-inf"><div class="tz-drop-sale" style="--r:${c[1]}"><span class="tz-drop-v" aria-hidden="true"></span><b>${r.titulo ? 'Título «' + esc(r.titulo) + '»' : ''}${r.titulo && r.puntos ? ' + ' : ''}${r.puntos ? num(r.puntos) + ' Puntos' : ''}</b></div><p class="tz-nota">El próximo, mañana desde la medianoche (hora del este).</p><button class="tz-b prim" data-acc="cerrar">Listo</button></div></div>`; };

// ── el arte: se pide una vez por versión y queda en el navegador ──
function leerArte() { try { return JSON.parse(sessionStorage.getItem('lg:tienda-arte') || 'null'); } catch (e) { return null; } }
function useArte(v, anon) {
  const [A, setA] = useState(() => { const c = leerArte(); return c && c.v === v ? c : null; });
  useEffect(() => {
    if (!v) return;
    const c = leerArte();
    if (c && c.v === v) { usarCss('tienda-arte-' + v, c.css); setA(c); return; }
    const pide = anon || typeof window.conCuenta !== 'function'
      ? fetch('/api/avisos/tienda-arte', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"anon":1}' }).then((r) => r.json())
      : window.conCuenta('/api/avisos/tienda-arte', { v: '' });
    pide.then((j) => {
      if (j && j.ok && j.p) {
        try { sessionStorage.setItem('lg:tienda-arte', JSON.stringify({ v: j.v, css: j.css, p: j.p })); } catch (e) { /* igual */ }
        usarCss('tienda-arte-' + j.v, j.css);
        setA({ v: j.v, css: j.css, p: j.p });
      }
    }).catch(() => {});
  }, [v]);
  return A;
}

const CLAVES = { aro: 'aro', deco: 'deco', nom: 'nom', carta: 'carta' };
function desdeServidor(S) {
  const puesto = { aro: null, deco: null, nom: null, carta: null }, fondo = { fp: null, fv: null, fe: null, fd: null, ff: null, fr: null };
  for (const [r, p] of Object.entries(S.yo.puesto || {})) { if (r in CLAVES) puesto[r] = p; else if (r in fondo) fondo[r] = p; }
  return { puesto, fondo };
}

export default function TiendaNueva({ liga, dc, S, recargar, partes }) {
  const k = (dc && dc.clave) || '';
  const A = useArte(S.arte_v, !!S.anon);
  const [, repintar] = useState(0);
  const pinta = () => repintar((x) => x + 1);
  const st = useRef(null);
  if (!st.current) {
    const m = desdeServidor(S);
    st.current = { k, tab: 'aro', slide: 0, comparar: false, lugar: 'fp', abierta: null, paso: null, msg: 0, ponerAl: false, error: '', va: false,
      busca: '', para: '', res: null, drop: null, mas: '', puesto: Object.assign({}, m.puesto), fondo: Object.assign({}, m.fondo), mio: m };
  }
  const E = st.current;
  // lo tuyo cambia cuando el objeto contesta: lo puesto del servidor manda sobre «lo tuyo»
  useEffect(() => { const m = desdeServidor(S); E.mio = m; }, [S]);
  const tengo = new Set(S.yo.inv.map((x) => x.p));
  const pedir = useCallback((d) => window.conCuenta('/api/avisos/tienda-accion', d), []);

  async function accion(d, despues) {
    E.va = true; E.error = ''; pinta();
    let j = null;
    try { j = await pedir(d); } catch (e) { j = { error: 'red' }; }
    E.va = false;
    if (!j || !j.ok) { E.error = (j && j.error) || 'error'; pinta(); return null; }
    E.res = j;
    if (despues) despues(j);
    // 🛍️ lo que te pusiste se ve en toda la página (tanda 3): `/pases` lo trae, y se pide de nuevo ya mismo
    if (d.accion === 'poner' || d.accion === 'comprar-puesto' || (d.accion === 'comprar' && d.poner)) refrescarPases();
    await recargar();
    pinta();
    return j;
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
    const t = e.target.closest('[data-abre],[data-acc],[data-tab],[data-lugar],[data-prueba],[data-saca],[data-elige],[data-msg],[data-deseo],[data-publico],[data-slide],[data-comprar],[data-reclamar],[data-probar-ir],[data-cmp],[data-drop],[data-regalo],[data-mas]');
    if (!t || t.disabled) return;
    const d = t.dataset;
    // sin cuenta se mira y se prueba todo; lo que mueve Puntos o guarda algo tuyo pasa por Discord (y vuelve a la Tienda)
    const pideCuenta = d.acc === 'entrar' || (S.anon && (d.deseo || d.publico !== undefined || d.regalo || d.drop !== undefined || d.comprar ||
      d.reclamar || d.abre === '__bill' || ['comprar', 'regalar', 'poner', 'deseo', 'deshacer', 'confirmar', 'confirmar-puesto', 'confirmar-regalo'].includes(d.acc)));
    if (pideCuenta) { if (window.urlLogin) location.href = window.urlLogin('t'); return; }
    if (d.deseo) { const si = !S.yo.deseos.includes(d.deseo); accion({ accion: 'deseo', pieza: d.deseo, si }); return; }
    if (d.publico !== undefined) { accion({ accion: 'deseo-publico', si: !S.yo.deseo_publico }); return; }
    if (d.regalo) { accion({ accion: 'regalo', id: d.regalo, si: d.si === '1' }); return; }
    if (d.drop !== undefined) { accion({ accion: 'drop' }, (j) => { E.drop = j; E.abierta = '__drop'; }); return; }
    if (d.mas !== undefined) { E.mas = E.mas === d.mas ? '' : d.mas; pinta(); return; }
    if (d.abre) { Object.assign(E, { abierta: d.abre, paso: null, msg: 0, error: '', busca: '', para: '', res: null }); }
    else if (d.comprar) Object.assign(E, { abierta: d.comprar, paso: 'comprar', error: '', res: null });
    else if (d.reclamar) { E.abierta = d.reclamar; accion({ accion: 'comprar', pieza: d.reclamar }, () => { E.paso = 'hecho'; }); return; }
    else if (d.probarIr) { const p = S.cat.piezas[d.probarIr]; E.tab = tabDe(p); probar(d.probarIr); E.comparar = false; irAlProbador(); }
    else if (d.slide !== undefined) E.slide = +d.slide;
    else if (d.cmp !== undefined) E.comparar = d.cmp === '1';
    else if (d.acc) {
      const a = d.acc, id = E.abierta, col = S.cat.colecciones[id];
      if (a === 'cerrar') Object.assign(E, { abierta: null, paso: null, error: '' });
      else if (a === 'ver' || a === 'comprar') Object.assign(E, { paso: a, error: '' });
      else if (a === 'regalar') Object.assign(E, { paso: 'regalar', para: '', busca: '', error: '' });
      else if (a === 'volver') { E.puesto = Object.assign({}, E.mio.puesto); E.fondo = Object.assign({}, E.mio.fondo); E.comparar = false; }
      else if (a === 'probar') { const p = S.cat.piezas[id]; probar(id); E.tab = tabDe(p); E.comparar = false; E.abierta = window.innerWidth < 900 ? '__prob' : null; E.paso = null; irAlProbador(); }
      else if (a === 'poner') { const p = S.cat.piezas[id]; accion({ accion: 'poner', ranura: p.c, pieza: id }, () => { probar(id, true); Object.assign(E, { abierta: null, paso: null }); }); return; }
      else if (a === 'deseo') { accion({ accion: 'deseo', pieza: id, si: !S.yo.deseos.includes(id) }); return; }
      else if (a === 'deshacer') { accion({ accion: 'deshacer', pieza: id }, () => { E.paso = 'deshecho'; }); return; }
      else if (a === 'confirmar') {
        if (col) accion({ accion: 'comprar-col', col: id }, () => { E.paso = 'hecho'; });
        else accion({ accion: 'comprar', pieza: id, poner: !!E.ponerAl }, () => { E.paso = 'hecho'; if (E.ponerAl) probar(id, true); });
        return;
      } else if (a === 'confirmar-puesto') {
        const r = loPuesto(S, E, tengo);
        accion({ accion: 'comprar-puesto', piezas: r.falta }, () => { E.paso = 'hecho'; E.mio = { puesto: Object.assign({}, E.puesto), fondo: Object.assign({}, E.fondo) }; });
        return;
      } else if (a === 'confirmar-regalo') {
        accion(Object.assign({ accion: 'regalar', para: E.para, msg: E.msg }, col ? { col: id } : { pieza: id }), () => { E.paso = 'regalado'; });
        return;
      }
    }
    else if (d.tab) { E.tab = d.tab; if (t.closest('.tz-hero')) irAlProbador(); }
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
    const f = (e) => { if (e.key === 'Escape' && E.abierta) { Object.assign(E, { abierta: null, paso: null }); pinta(); } };
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

  if (!A) return <section className="sec"><div className="sec-t"><h2>Tienda</h2></div><p className="pronto-p">Cargando la Tienda…</p></section>;
  const fila = (liga.T && liga.T[k]) || (liga.X && liga.X[k]) || {};
  const crudo = String(fila.n || (dc && (dc.rapero || dc.n)) || 'Tú');
  // la cara: la de la tabla, la de tu cuenta de Discord, la de quien jugó y no está en la tabla; si no hay, la inicial
  const cara = liga.avUrl(k, 1024) || (dc && dc.av ? 'https://cdn.discordapp.com/avatars/' + dc.av + '.webp?size=1024' : null) || (liga.avNombre ? liga.avNombre(crudo, 1024) : null);
  const ini = inicialSvg(crudo);
  const X = { p: A.p, foto: esc(cara && !FOTO_MUERTA.has(cara) ? cara : ini), ini: esc(ini), carta: esc((k && liga.cartaUrl(k, 'temporada')) || CARTA_MUESTRA), cartaIni: esc(CARTA_MUESTRA), n: esc(crudo), crudo };
  let hoja = '';
  if (E.abierta) {
    const id = E.abierta;
    hoja = id === '__puesto' ? fichaPuesto(X, S, E, tengo) : id === '__reglas' ? reglasPop() : id === '__bill' ? billPop(S) : id === '__drop' ? dropPop(E)
      : id === '__prob' ? `<div class="tz-ficha" role="dialog" aria-label="El probador">${popCab('El probador', 'Lo que te estás probando', '#E41373')}<div class="tz-f-inf">${escenario(X, S, E)}${probando(S, E, tengo)}</div></div>`
      : S.cat.colecciones[id] ? fichaCol(X, S, E, tengo, liga, id) : S.cat.piezas[id] ? fichaPieza(X, S, E, tengo, liga, id) : '';
  }
  const arriba = `${S.ensayo ? '<p class="tz-ensayo">Ensayo: la Tienda está cerrada y sólo la ves tú. Lo que compres es de verdad.</p>' : ''}${regalosRecibidos(X, S)}${hero(X, S, E, tengo)}
    <section class="tz-sec" id="tz-prob" data-tuto="tz-probador"><div class="tz-sec-t"><h2>El probador</h2>${pildora(S, E)}</div>
      <div class="tz-prob"><div class="tz-col-esc">${escenario(X, S, E)}${probando(S, E, tengo)}</div><div class="tz-col-cat">${tabs(S, E)}${piezas(X, S, E, tengo)}</div></div></section>
    <section class="tz-sec tz-sec-mas" data-tuto="tz-mas"><div class="tz-tira"><span class="tz-tira-et">Más con tus Puntos</span>
      <button data-mas="cabezas" aria-pressed="${E.mas === 'cabezas'}">Precio por cabeza ›</button><button data-mas="promo" aria-pressed="${E.mas === 'promo'}">Tu promo ›</button><a href="#/crews">Tu crew ›</a><button data-mas="ropa" aria-pressed="${E.mas === 'ropa'}">Ropa de UL · pronto</button>
      <button class="tz-tira-r" data-abre="__reglas">¿Cómo funciona la Tienda?</button></div></section>`;
  const abajo = `${dropDia(E)}${barraCelu(S, E, tengo)}`;
  return (
    <div className="tz" ref={raiz}>
      <div onClick={clic} onInput={cambio} onChange={cambio} dangerouslySetInnerHTML={{ __html: arriba }} />
      {E.mas && partes && partes[E.mas] ? <div className="tz-mas-vista">{partes[E.mas]}</div> : null}
      <div onClick={clic} dangerouslySetInnerHTML={{ __html: abajo }} />
      {hoja ? <div className="tz-capa" onClick={clic} onInput={cambio} onChange={cambio} dangerouslySetInnerHTML={{ __html: `<div class="tz-velo" data-acc="cerrar"></div><div class="tz-hoja">${hoja}</div>` }} /> : null}
    </div>
  );
}
