// 🎁 LOS BOTONES DEL BUZÓN QUE DAN ALGO (28/11/2026). Dlx: «El buzón debería tener botones que funcionen y que den algo.
// En tienda mostrar algunos objetos de la tienda en realidad y un botón con más… y reclama tu drop diario».
//
//   «🎁 Reclama tu drop diario» (`bzn:drop`)  reclama y abre los drops del día de quien toca, con las MISMAS reglas que la
//        página —uno por día (medianoche del este), sólo Miembros de DRA—, porque los pide al mismo lugar: el de la Tienda
//        (`tiendaAccion` 'drop' de bot/tienda.js) y el del Pase (`paseDiaAbrir()` de bot/avisos.js; el domingo, el Star si
//        abriste los seis de antes). Qué salió, con el GIF de su rareza, y «ya está en tu Inventario». Si ya los
//        reclamaste, cuándo sale el próximo (hora del este). `DROPS_DIA` dice cuáles: hoy los dos.
//   «🛍️ La vitrina de hoy» (`bzn:vit`)  cuatro piezas de verdad de la vitrina de hoy (`vitrinaDelDia()`), con su imagen
//        (bot/buzon_img.py), su nombre, su rareza y su precio, y «Ver más en la Tienda». Las tapadas por un regalo NO se
//        destapan acá: va su caja (abrirlas es de la página); las que ya destapaste se ven con tu oferta.
//   «🃏 Mi tarjeta» (`bzn:card`)  tu carta, la misma que `/card` (el Worker la arma: `tarjeta` en `H`).
//
// Todo de quien TOCÓ (Discord lo firma) y sólo para él (efímero): en un hilo privado también pueden tocar los moderadores,
// y cada uno se lleva lo suyo. El freno de clics (`frenado`) lo pone worker.js antes de llegar acá, y el objeto puede estar
// dormido: «un momento» primero y el mensaje después (`H.pensando`, el `pensandoYEditar()` del Worker).
// 🔴 NUNCA UN DM: la respuesta es la de la interacción (herramientas/sin_dm.py).
import * as V from './vista.js';
import * as BV from './buzon_vista.js';
import * as IMG from './buzon_img.js';

export const HUB = 'https://underlegends.pages.dev';
export const URL_TIENDA = HUB + '/freestyle-rap/tienda';
export const URL_DROPS = HUB + '/freestyle-rap/?drops=1';
export const URL_TARJETAS = HUB + '/freestyle-rap/tarjetas';
//: los drops del día que reclama el botón: el de la Tienda y el del Pase (los dos son uno por día y de los Miembros)
export const DROPS_DIA = ['tienda', 'pase'];
export const ACCIONES = ['drop', 'vit', 'card'];
export const VITRINA_N = 4;
//: lo que dice cada pieza de dónde va (como la Tienda: `RANURA` y `LUGARES_F` de web/src/tienda3.jsx)
export const LUGAR = { aro: 'Aro', deco: 'Decoración', nom: 'Nombre', carta: 'Efecto de carta', perfil: 'Perfil', serv: 'Nombre',
  fp: 'Fondo · Perfil', fv: 'Fondo · VS', fe: 'Fondo · Escenario', fd: 'Fondo · Discord', ff: 'Fondo · Ficha', fr: 'Fondo · Ranking' };

const QUIEN = /^[0-9]{5,25}$/;
const miles = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const alObjeto = (env, ruta, cuerpo) => env.AVISOS.get(env.AVISOS.idFromName('liga')).fetch('https://avisos/' + ruta, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo || {}),
}).then((r) => r.json()).catch(() => ({ error: 'red' }));
/** Su perfil de la Liga (`d:`), que la Tienda acepta como verificado (`verificado()` de bot/tienda.js) */
async function perfilDe(env, quien) {
  try { return (env.KV && (await env.KV.get('d:' + quien))) || ''; } catch (e) { return ''; }
}
const aviso = (txt, botones) => V.avisoMsg(txt, botones);
const FALLO = 'No pude: prueba de nuevo en un minuto.';

// ═══ 🎁 el drop del día ════════════════════════════════════════════════════════════════════════════════════════════
/** Lo que contestó el objeto, en una forma: `{fuente, nuevo, ya, error, r}`. Pura. */
export function leerDrop(fuente, r) {
  const x = r || {};
  if (fuente === 'tienda') {
    if (x.ok) return { fuente, nuevo: true, r: x };
    if (x.error === 'ya') return { fuente, ya: true };
    if (x.error === 'no_miembro' || x.error === 'verificate') return { fuente, error: 'verificate' };
    if (x.error === 'cerrada') return { fuente, error: 'cerrada' };
    return { fuente, error: 'fallo' };
  }
  if (x.ok) return x.ya ? { fuente, ya: true, r: x } : { fuente, nuevo: true, r: x };
  if (x.error === 'no_miembro') return { fuente, error: 'verificate' };
  if (x.error === 'sin_pase') return { fuente, error: 'cerrada' };
  return { fuente, error: 'fallo' };
}
const premio = (r) => (r.titulo ? 'el título **«' + r.titulo + '»**' + (r.puntos ? ' y **+' + miles(r.puntos) + '** Puntos de Tienda' : '')
  : '**+' + miles(r.puntos) + '** Puntos de Tienda');
const DE = { tienda: ['🛍️', 'El de la Tienda', 'Tienda'], pase: ['🎟️', 'El del Pase', 'Pase'] };

/** El mensaje de lo que salió (efímero). `res`: `leerDrop()` de cada fuente. Pura. */
export function mensajeDrop(res, ahora = Date.now(), img = IMG) {
  const prox = BV.medianocheET(ahora);
  const cuando = '-# ⏰ Los próximos salen a las **12:00 AM ET** (' + BV.falta(prox - ahora) + ').';
  const nuevos = res.filter((x) => x.nuevo), ya = res.filter((x) => x.ya);
  const filas = [[V.enlace('Ver mis drops', URL_DROPS, '🐉'), V.enlace('Ir a la Tienda', URL_TIENDA, '🛍️')]];
  if (!nuevos.length && !ya.length) {
    if (res.some((x) => x.error === 'verificate')) {
      return V.mensaje({ efimero: true, dentro: [V.T('🔒 Los drops del día son de los **Miembros de DRA**: verifícate y vuelve a tocar el botón.')],
        filas: [[V.BOTON_VINCULAR]] });
    }
    if (res.every((x) => x.error === 'cerrada')) return aviso('El drop del día todavía no está: vuelve en un rato.');
    return aviso(FALLO);
  }
  const ban = BV.franja('drop', img);
  const linea = (x) => {
    const r = x.r || {};
    const nom = r.nombre || BV.RAREZAS[Number(r.rareza) || 0] || '';
    const que = r.star ? 'Star Dragon' : 'Drop';
    return DE[x.fuente][0] + ' **' + DE[x.fuente][2] + ' · ' + que + ' ' + nom + '** — te llevas ' + premio(r) + '.'
      + (!r.titulo && r.repe ? '\n-# Te tocó «' + String(r.repe).slice(0, 40) + '», que ya es tuyo: va en Puntos.' : '')
      + (r.sin_tope ? '\n-# Esta semana ya pasaste el tope: lo de arriba de 10.000 va a la mitad.' : '');
  };
  if (!nuevos.length) {
    // ya los reclamó: lo que le salió (el del Pase lo dice el objeto; el de la Tienda, no) y cuándo vuelve
    const dijo = ya.filter((x) => x.r && x.r.nombre);
    return V.mensaje({ efimero: true, color: V.COLOR.mag, filas,
      dentro: [ban ? V.galeria({ media: { url: ban }, description: 'Tu drop diario' }) : null,
        V.T('### ✅ Ya reclamaste tu drop de hoy'
          + (dijo.length ? '\n' + dijo.map((x) => DE[x.fuente][0] + ' ' + DE[x.fuente][1] + ': ' + x.r.nombre + ' · ' + premio(x.r)).join('\n') : '')
          + '\n' + cuando)] });
  }
  const mejor = nuevos.reduce((a, x) => (Number(x.r.rareza) > Number(a.r.rareza) ? x : a), nuevos[0]);
  const rz = Math.max(0, Math.min(4, Number(mejor.r.rareza) || 0));
  const anim = mejor.r.star ? 'star' : 'drop';
  const gif = mejor.r.titulo ? BV.gifDrop(anim, 'titulo', rz, mejor.r.titulo) : BV.gifDrop(anim, 'abre', rz);
  const notas = ya.map((x) => '-# ' + DE[x.fuente][1] + ' ya lo reclamaste hoy.')
    .concat(res.filter((x) => x.error === 'verificate').map((x) => '-# 🔒 ' + DE[x.fuente][1] + ' es de los Miembros de DRA.'));
  return V.mensaje({ efimero: true, color: BV.RAREZA_COLOR[rz], filas,
    dentro: [V.galeria({ media: { url: gif }, description: 'Drop abierto: ' + (BV.RAREZAS[rz] || '') }),
      V.T('### 🎁 ' + (nuevos.length === 1 ? 'Tu drop del día' : 'Tus ' + nuevos.length + ' drops del día') + '\n'
        + nuevos.map(linea).join('\n')),
      V.T('✅ **Ya está en tu Inventario.**' + (nuevos.some((x) => x.r.titulo) ? ' Los títulos van en Colección → Títulos.' : '')
        + '\n' + notas.concat([cuando]).join('\n'))] });
}

/** 🎁 Reclama y abre los drops del día de `quien` (los de `DROPS_DIA`), y el mensaje de lo que salió */
export async function reclamarDrop(env, quien, ahora = Date.now(), img = IMG) {
  if (!QUIEN.test(String(quien || ''))) return aviso('No pude saber quién eres: prueba de nuevo.');
  const de = DROPS_DIA.includes('tienda') ? await perfilDe(env, quien) : '';
  const res = [];
  // uno detrás del otro: el objeto atiende de a uno igual, y así el segundo ve lo que hizo el primero
  for (const f of DROPS_DIA) {
    const r = f === 'tienda' ? await alObjeto(env, 'tienda-accion', { accion: 'drop', quien, de })
      : await alObjeto(env, 'pase-dia', { quien });
    res.push(leerDrop(f, r));
  }
  return mensajeDrop(res, ahora, img);
}

// ═══ 🛍️ la vitrina de hoy ══════════════════════════════════════════════════════════════════════════════════════════
/** El precio de una pieza para quien mira, como `precioPieza()` de bot/tienda.js: gratis en su ventana, y con Premium su
 *  descuento (no en las ediciones). Pura. */
export function precio(cat, id, prem, ahora = Date.now()) {
  const p = cat.piezas[id];
  const g = (cat.gratis || {})[id];
  if (g && ahora >= g.desde && ahora < g.hasta) return 0;
  const base = (cat.precios || [])[p.r] || 0;
  return prem && !(p.t || []).includes('num') ? Math.round(base * ((cat.desc || {}).prem || 1)) : base;
}

/**
 * Lo que se muestra de la vitrina: `{piezas: [{id, i, n, lugar, rz, precio, oferta}], tapadas, img: [url…]}`. Las de un
 * regalo sin abrir NO (`regalos_dia`: las primeras `n` van tapadas), salvo que ya lo hayas abierto. Pura.
 */
export function vitrinaDe(S, ahora = Date.now(), img = IMG) {
  const cat = S.cat || {};
  const ids = ((cat.vitrina || {}).ids || []).filter((id) => (cat.piezas || {})[id]);
  const rg = (S.yo && S.yo.regalos_dia) || { n: Math.min(5, ids.length), ab: {} };
  const n = Number(rg.n) || 0, ab = rg.ab || {};
  const prem = !!(S.yo && S.yo.prem);
  const P = (img && img.PIEZAS) || {};
  const conImg = P.v && P.v === S.arte_v && P.base ? new Set(P.ids || []) : new Set();
  const piezas = [];
  let tapadas = 0;
  ids.forEach((id, i) => {
    if (i < n && !ab[i]) { tapadas += 1; return; }
    const p = cat.piezas[id];
    const of = ab[i] && ab[i].p === id ? ab[i] : null;
    piezas.push({ id, i, n: String(p.n || id), lugar: LUGAR[p.c] || '', rz: Number(p.r) || 0, precio: precio(cat, id, prem, ahora),
      oferta: of && of.k === 'pieza' && !of.usado ? { precio: Number(of.precio) || 0, desc: Number(of.desc) || 0 }
        : of && of.k === 'gratis' ? { gratis: true } : null,
      img: conImg.has(id) ? P.base + encodeURIComponent(id) + '.png' : '' });
  });
  return { piezas: piezas.slice(0, VITRINA_N), tapadas, total: ids.length };
}

/** El mensaje de la vitrina (efímero): la franja, una galería con cuatro piezas (y la caja de las tapadas si faltan), qué
 *  es cada una y cuánto cuesta, y «Ver más en la Tienda». Pura. */
export function mensajeVitrina(S, ahora = Date.now(), img = IMG) {
  if (!S || !S.ok) return aviso(FALLO);
  if (!S.abierta && !S.ensayo) return aviso('La Tienda todavía no abrió.');
  const v = vitrinaDe(S, ahora, img);
  const filas = [[V.enlace('Ver más en la Tienda', URL_TIENDA, '🛍️')]];
  if (!v.total) return aviso('La vitrina de hoy todavía no está: vuelve en un rato.', filas[0]);
  const ban = BV.franja('vitrina', img);
  const tapa = ((img && img.CUADROS) || {}).tapado || '';
  const fotos = v.piezas.filter((x) => x.img).map((x) => ({ media: { url: x.img },
    description: (x.n + ' · ' + (x.lugar ? x.lugar + ' · ' : '') + (BV.RAREZAS[x.rz] || '')).slice(0, 200) }));
  // la caja de las tapadas completa la galería, sólo si hay piezas con imagen (cuatro cajas solas no muestran nada)
  for (let k = fotos.length, f = fotos.length; f && k < VITRINA_N && k < f + v.tapadas && tapa; k++) {
    fotos.push({ media: { url: tapa }, description: 'Un artículo tapado: destápalo en la página' });
  }
  const linea = (x) => '**' + x.n + '** · ' + (x.lugar ? x.lugar + ' · ' : '') + (BV.RAREZAS[x.rz] || '') + ' — '
    + (x.oferta && x.oferta.gratis ? '✓ te salió gratis'
      : x.oferta ? '~~' + miles(x.precio) + '~~ **' + miles(x.oferta.precio) + '** PdT · tu oferta −' + x.oferta.desc + ' %'
        : x.precio ? '**' + miles(x.precio) + '** PdT' : '**Gratis**');
  const prox = BV.medianocheET(ahora);
  return V.mensaje({ efimero: true, color: V.COLOR.mag, filas,
    dentro: [ban ? V.galeria({ media: { url: ban }, description: 'La vitrina de hoy' }) : null,
      V.T('### 🛍️ La vitrina de hoy'),
      fotos.length ? V.galeria(...fotos) : null,
      v.piezas.length ? V.T(v.piezas.map(linea).join('\n')) : null,
      v.tapadas ? V.T('🎁 **' + (v.tapadas === 1 ? '1 artículo tapado' : v.tapadas + ' artículos tapados') + '**: destápalos gratis en la '
        + 'página. Puede salir la pieza con descuento, Puntos de Tienda, un Drop o la pieza gratis.') : null,
      V.T('-# ' + v.total + ' piezas hoy · la vitrina cambia a las 12:00 AM ET (' + BV.falta(prox - ahora) + ')')] });
}

export async function vitrina(env, quien, ahora = Date.now(), img = IMG) {
  const de = await perfilDe(env, quien);
  return mensajeVitrina(await alObjeto(env, 'tienda', { quien: String(quien || ''), de }), ahora, img);
}

// ═══ 🃏 mi tarjeta ═════════════════════════════════════════════════════════════════════════════════════════════════
/** Tu carta como la de `/card` (`H.tarjeta(id)` del Worker: sus componentes, o `null` sin carta), sólo para ti */
export async function tarjeta(H, quien) {
  if (!H || typeof H.tarjeta !== 'function') return aviso(FALLO);
  let comps = null;
  try { comps = await H.tarjeta(String(quien || '')); } catch (e) { return aviso(FALLO); }
  if (!comps || !comps.length) {
    return V.mensaje({ efimero: true, dentro: [V.T('🃏 Todavía no tienes tarjeta. Se consiguen en dos pasos: verifícate en DRA (sale la '
      + 'de **Servidor**) y llega al nivel 1 del Pase (sale la de **Temporada**).')],
    filas: [[V.BOTON_VINCULAR, V.enlace('Ver las tarjetas', URL_TARJETAS, '🃏')]] });
  }
  return { flags: V.V2 | V.EFIMERO, components: comps, allowed_mentions: { parse: [] } };
}

// ═══ el Worker ═════════════════════════════════════════════════════════════════════════════════════════════════════
/** El trabajo de cada botón: una promesa del mensaje a mostrar. `H`: lo del Worker (`tarjeta`). */
export function trabajo(accion, i, env, H, ahora) {
  const quien = String((i.member && i.member.user && i.member.user.id) || (i.user && i.user.id) || '');
  if (accion === 'drop') return reclamarDrop(env, quien, ahora);
  if (accion === 'vit') return vitrina(env, quien, ahora);
  if (accion === 'card') return tarjeta(H, quien);
  return Promise.resolve(aviso('Ese botón ya no anda.'));
}

/**
 * `bzn:drop` · `bzn:vit` · `bzn:card`. Con `H.pensando` (el `pensandoYEditar()` del Worker): «un momento» ya y el mensaje
 * cuando el objeto conteste. Sin él (las pruebas): «ya va» (tipo 6) y el mensaje aparte, por el webhook de la interacción.
 */
export function botonWorker(i, env, ctx, H = {}) {
  const accion = String(((i.data && i.data.custom_id) || '').split(':')[1] || '');
  const t = () => trabajo(accion, i, env, H, Date.now()).catch(() => aviso(FALLO));
  if (H && typeof H.pensando === 'function') return H.pensando(t);
  const seguir = (async () => {
    const data = await t();
    await fetch(`https://discord.com/api/v10/webhooks/${i.application_id}/${i.token}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data),
    }).catch(() => {});
  })();
  if (ctx && ctx.waitUntil) ctx.waitUntil(seguir); else seguir.catch(() => {});
  return new Response(JSON.stringify({ type: 6 }), { headers: { 'content-type': 'application/json' } });
}
