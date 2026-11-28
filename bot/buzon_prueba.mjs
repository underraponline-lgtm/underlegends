// 📬🎨🎁 La prueba del buzón rehecho (28/11/2026): cómo se ve el mensaje del hilo (bot/buzon_vista.js) y los tres botones
// que dan algo (bot/buzon_botones.js), sin red ni Discord. La corre también bot/conectar_dra_prueba.mjs (la de CI).
//
//     node bot/buzon_prueba.mjs
//
// · el mensaje entra en Discord en el peor caso: ≤ 40 componentes, ≤ 4.000 letras, galerías ≤ 10, ≤ 5 filas, un solo azul;
// · cada aviso con su imagen (tu carta, el Drop, el cuadrito de su clase) y SIN imagen si no está en R2 (nunca una rota);
// · «Reclama tu drop diario»: los dos nuevos, ya reclamados (y cuándo vuelven, en ET), sin verificar, mitad y mitad;
// · «La vitrina de hoy»: cuatro piezas de verdad sin destapar las tapadas, con y sin las imágenes de esa versión, vacía,
//   cerrada;
// · «Mi tarjeta»: con carta (efímera), sin carta, sin el Worker;
// · el Worker: «un momento» con `pensando`, y sin él, «ya va» y la respuesta por el webhook: nunca un DM.
import * as V from './vista.js';
import * as BV from './buzon_vista.js';
import * as BB from './buzon_botones.js';
import * as BZ from './buzon.js';

export async function probar(ok) {
  const Q = '739338101603696681';
  const IMG = {
    FRANJAS: { avisos: 'https://x.r2.dev/paneles/buzon-franja-avisos-1.png', drop: 'https://x.r2.dev/paneles/d.png', vitrina: 'https://x.r2.dev/paneles/v.png' },
    CUADROS: Object.fromEntries(['personal', 'pase', 'tienda', 'libre', 'suplente', 'calificar', 'reporte', 'fondo', 'pedido', 'ref',
      'crew', 'racha', 'tuvideo', 'tapado'].map((k) => [k, 'https://x.r2.dev/paneles/buzon-cuadro-' + k + '.png'])),
    PIEZAS: { v: 'arte1', base: 'https://x.r2.dev/tienda/piezas/arte1/', ids: ['D8', 'AP2', 'C13', 'FF5', 'P5', 'C8', 'AP16', 'FR1'] },
  };
  const VACIO = { FRANJAS: {}, CUADROS: {}, PIEZAS: { v: '', base: '', ids: [] } };
  const T0 = Date.UTC(2026, 10, 28, 20, 5);   // 3:05 PM ET del 28/11
  const filasDe = (m) => (m.components || []).filter((c) => c.type === 1);
  const urls = (m) => JSON.stringify(m).match(/https:\/\/[^"]+/g) || [];

  // ── 1. el mensaje del hilo ────────────────────────────────────────────────────────────────────────────────────────
  const items = BZ.SIMULACION.map(([k, tipo, titulo, cuerpo, url], i) => ({ clave: 'sim:' + k, tipo, titulo, cuerpo, url, t: T0 - i * 60000 }));
  const ctx = { clave: 'dlx', cs: ['servidor', 'temporada'], ahora: T0, links: BZ.botonesDe(items).slice(0, 4) };
  const m = BV.mensajeHilo(Q, items, ctx, IMG);
  const md = V.medir(m);
  ok(!md.problemas.length && md.componentes <= 40 && md.letras <= 4000, 'el hilo entra en Discord con los 15 avisos (' + md.componentes + ' componentes, ' + md.letras + ' letras)', md.problemas.join(' · '));
  ok(filasDe(m).length <= 5 && V.piezas(m, 12).every((g) => g.items.length >= 1 && g.items.length <= 10), '≤ 5 filas y cada galería con 1 a 10');
  ok(md.azules === 1 && V.piezas(m, 2).find((b) => b.style === 1).custom_id === 'bzn:drop', 'un solo azul: «Reclama tu drop diario»');
  const ids = V.piezas(m, 2).map((b) => b.custom_id).filter(Boolean);
  ok(['bzn:drop', 'bzn:vit', 'bzn:card', 'bzn:visto', 'bzn:no'].every((x) => ids.includes(x)), 'los tres que dan algo, «Ya lo vi» y «No me avises más»');
  ok(V.piezas(m, 12)[0].items[0].media.url === IMG.FRANJAS.avisos, 'arriba de todo, la franja de DRA');
  const minis = V.piezas(m, 11).map((x) => x.media.url);
  ok(minis.length === Math.min(items.length, BV.ITEMS_MAX) && minis.length >= 4, 'cada aviso que se muestra lleva su imagen al costado (' + minis.length + ')');
  ok(minis[0] === 'https://pub-70d5821d06a8432c9cffd0c102195000.r2.dev/dlx/servidor.webp?v=20261128', 'el de tu tarjeta Servidor: TU carta de Servidor, con el día ET de sello', minis[0]);
  ok(minis[2] === BV.gifDrop('drop', 'entra', 0), 'el de los drops: el Drop de verdad');
  ok(minis[3] === IMG.CUADROS.pase, 'el del Pase: su cuadrito de DRA');
  const tx = V.textoV2(m);
  ok(tx.includes('<@' + Q + '>') && tx.includes('15 avisos nuevos') && tx.includes('28/11 · 3:05 PM ET') && tx.includes('avisos más'),
    'la mención, cuántos, la hora del este de cada uno y lo que no entra queda «en la campana»');
  ok(!/\d{1,2}:\d{2} (AM|PM)(?! ET)/.test(tx), 'toda hora dice ET');
  // sin las imágenes en R2: ninguna pieza rota, nada vacío
  const m0 = BV.mensajeHilo(Q, items, { ahora: T0, links: ctx.links }, VACIO);
  ok(!V.medir(m0).problemas.length && !V.piezas(m0, 12).length && V.piezas(m0, 11).length === 1 && urls(m0).every((u) => u.length > 12),
    'sin bot/buzon_img.js publicado: sin franja ni cuadritos (sólo el Drop, que ya existe), nada roto');
  // el peor caso: títulos y cuerpos larguísimos
  const largos = Array.from({ length: 6 }, (_, i) => ({ tipo: 'personal', titulo: 'W'.repeat(400), cuerpo: 'x'.repeat(5000), t: T0, url: '/x' + i }));
  const ml = BV.mensajeHilo(Q, largos, { clave: 'k', ahora: T0, links: BZ.botonesDe(largos).slice(0, 4) }, IMG);
  ok(!V.medir(ml).problemas.length, 'el peor caso de texto también entra', V.medir(ml).problemas.join());
  // y por buzon.js (la ronda)
  const mb = BZ.mensajeHilo(Q, items, { clave: 'dlx', cs: ['competitivo'], ahora: T0 });
  ok(!V.medir(mb).problemas.length && V.piezas(mb, 2).some((b) => b.custom_id === 'bzn:card'), 'buzon.mensajeHilo() usa el mensaje nuevo');
  ok(BV.cartaDeAviso({ titulo: '📈 Subiste a rango A' }, ['servidor', 'competitivo']) === 'competitivo'
    && BV.cartaDeAviso({ titulo: 'Desbloqueaste tu tarjeta Temporada' }, ['temporada']) === 'temporada'
    && BV.cartaDeAviso({ titulo: 'x' }, []) === '', 'qué carta va al lado: la que nombra, la del rango, o ninguna si no tiene');

  // ── 2. las horas ──────────────────────────────────────────────────────────────────────────────────────────────────
  ok(BV.medianocheET(T0) === Date.UTC(2026, 10, 29, 5) && BV.medianocheET(Date.UTC(2026, 6, 10, 15)) === Date.UTC(2026, 6, 11, 4),
    'la próxima medianoche del este, con y sin horario de verano');
  ok(BV.falta(3 * 3600000 + 20 * 60000) === 'en 3 h 20 min' && BV.falta(45 * 60000) === 'en 45 min', '«en 3 h 20 min»');
  try {
    const W = await import('./worker.js');
    ok(['abre', 'entra', 'titulo'].every((e) => W.gifDrop('drop', e, 3, 'Garra Dorada') === BV.gifDrop('drop', e, 3, 'Garra Dorada')),
      'el GIF del Drop sale de la misma regla que /drops (gifDrop de worker.js)');
  } catch (e) { ok(false, 'no pude importar worker.js', String(e).slice(0, 200)); }

  // ── 3. «Reclama tu drop diario» ───────────────────────────────────────────────────────────────────────────────────
  const envCon = (rutas) => {
    const pedidos = [];
    return { pedidos, KV: { get: async (k) => (k === 'd:' + Q ? 'dlx' : null) },
      AVISOS: { idFromName: () => 'x', get: () => ({ fetch: async (u, op) => {
        const r = String(u).split('/').pop(), b = JSON.parse(op.body);
        pedidos.push([r, b]);
        return new Response(JSON.stringify(typeof rutas[r] === 'function' ? rutas[r](b) : rutas[r] || { error: 'x' }));
      } }) } };
  };
  const abierto = (rz, extra) => Object.assign({ ok: true, id: 1, tipo: 'drop', rareza: rz, nombre: BV.RAREZAS[rz], puntos: 1500, titulo: '' }, extra);
  let env = envCon({ 'tienda-accion': abierto(1), 'pase-dia': abierto(3, { star: false, dia: {} }) });
  let r = await BB.reclamarDrop(env, Q, T0, IMG);
  let t = V.textoV2(r);
  ok(env.pedidos[0][0] === 'tienda-accion' && env.pedidos[0][1].accion === 'drop' && env.pedidos[0][1].de === 'dlx' && env.pedidos[1][0] === 'pase-dia',
    'pide el drop del día de la Tienda (con su perfil) y el del Pase: las reglas son las de la página');
  ok(t.includes('Tus 2 drops del día') && t.includes('Disco de Oro') && t.includes('Ya está en tu Inventario') && t.includes('12:00 AM ET** (en 8 h 55 min)'),
    'los dos nuevos: qué salió, «ya está en tu Inventario» y cuándo salen los próximos (ET)', t);
  ok(V.piezas(r, 12)[0].items[0].media.url === BV.gifDrop('drop', 'abre', 3) && (r.flags & V.EFIMERO) && !V.medir(r).problemas.length,
    'con el GIF de la mejor rareza, efímero y entra');
  env = envCon({ 'tienda-accion': { error: 'ya', estado: 409 }, 'pase-dia': abierto(2, { ya: true }) });
  t = V.textoV2(await BB.reclamarDrop(env, Q, T0, IMG));
  ok(t.includes('Ya reclamaste tu drop de hoy') && t.includes('Vinilo') && t.includes('12:00 AM ET'), 'ya reclamados: lo que salió y cuándo vuelve', t);
  env = envCon({ 'tienda-accion': { error: 'verificate' }, 'pase-dia': { error: 'no_miembro' } });
  r = await BB.reclamarDrop(env, Q, T0, IMG);
  ok(V.textoV2(r).includes('Miembros de DRA') && V.piezas(r, 2).some((b) => b.url === V.URL_VINCULAR) && (r.flags & V.EFIMERO),
    'sin verificar: no se reclama nada y lleva el botón para vincularte');
  env = envCon({ 'tienda-accion': { error: 'ya' }, 'pase-dia': abierto(0, { star: true, titulo: 'Lengua de Fuego', puntos: 0 }) });
  r = await BB.reclamarDrop(env, Q, T0, IMG);
  t = V.textoV2(r);
  ok(t.includes('Star Dragon') && t.includes('Lengua de Fuego') && t.includes('El de la Tienda ya lo reclamaste hoy')
    && V.piezas(r, 12)[0].items[0].media.url === BV.gifDrop('star', 'titulo', 0, 'Lengua de Fuego'), 'uno nuevo (el Star del domingo, con título) y el otro ya: los dos se dicen');
  r = await BB.reclamarDrop(envCon({}), Q, T0, IMG);
  ok(V.textoV2(r).includes('prueba de nuevo'), 'el objeto no contesta: «prueba de nuevo»');

  // ── 4. «La vitrina de hoy» ────────────────────────────────────────────────────────────────────────────────────────
  const cat = { precios: [1500, 4000, 10000, 25000, 60000, 100000], desc: { prem: 0.8 }, gratis: {},
    vitrina: { ids: ['D8', 'AP2', 'C13', 'FF5', 'P5', 'C8', 'AP16', 'FR1'] },
    piezas: { D8: { c: 'deco', r: 1, t: [], n: 'Bandana' }, AP2: { c: 'aro', r: 1, t: [], n: 'País · Chile' }, C13: { c: 'carta', r: 2, t: [], n: 'Aerosol' },
      FF5: { c: 'ff', r: 2, t: [], n: 'Holográfico' }, P5: { c: 'perfil', r: 4, t: [], n: 'Entrada «Reflector»' }, C8: { c: 'carta', r: 4, t: [], n: 'Borde de fuego' },
      AP16: { c: 'aro', r: 1, t: [], n: 'País · Honduras' }, FR1: { c: 'fr', r: 3, t: [], n: 'Oro' } } };
  const S = { ok: true, abierta: true, cat, arte_v: 'arte1', yo: { prem: false, regalos_dia: { n: 5, ab: { 1: { k: 'pieza', p: 'AP2', desc: 20, precio: 3200 } } } } };
  const vv = BB.vitrinaDe(S, T0, IMG);
  ok(vv.piezas.map((x) => x.id).join() === 'AP2,C8,AP16,FR1' && vv.tapadas === 4, 'cuatro piezas de verdad: las que no tapa un regalo y la que ya destapaste; las tapadas no se destapan acá');
  let mv = BB.mensajeVitrina(S, T0, IMG);
  const gal = V.piezas(mv, 12);
  ok(gal.length === 2 && gal[0].items[0].media.url === IMG.FRANJAS.vitrina && gal[1].items.length === 4
    && gal[1].items[0].media.url === 'https://x.r2.dev/tienda/piezas/arte1/AP2.png', 'la franja y una galería con sus cuatro imágenes');
  t = V.textoV2(mv);
  ok(t.includes('~~4.000~~ **3.200** PdT · tu oferta −20 %') && t.includes('**Borde de fuego** · Efecto de carta · Micrófono de Oro — **60.000** PdT')
    && t.includes('4 artículos tapados') && t.includes('12:00 AM ET'), 'nombre, lugar, rareza y precio (con tu oferta), las tapadas y cuándo cambia', t);
  ok(V.piezas(mv, 2).some((b) => b.url === BB.URL_TIENDA && /Ver más/.test(b.label)) && (mv.flags & V.EFIMERO) && !V.medir(mv).problemas.length,
    '«Ver más en la Tienda», efímero, y entra');
  mv = BB.mensajeVitrina(Object.assign({}, S, { arte_v: 'otro' }), T0, IMG);
  ok(V.piezas(mv, 12).length === 1 && !V.medir(mv).problemas.length && V.textoV2(mv).includes('Aerosol') === false && V.textoV2(mv).includes('Borde de fuego'),
    'si el arte cambió de versión y no se dibujó: sin imágenes de piezas (nunca una rota), con la lista igual');
  ok(BB.vitrinaDe(Object.assign({}, S, { yo: { prem: true, regalos_dia: { n: 0, ab: {} } } }), T0, IMG).piezas[1].precio === 3200, 'con Premium, su descuento');
  ok(V.textoV2(BB.mensajeVitrina({ ok: true, abierta: true, cat: Object.assign({}, cat, { vitrina: { ids: [] } }) }, T0, IMG)).includes('todavía no está'),
    'la vitrina vacía: lo dice, con el link a la Tienda');
  ok(V.textoV2(BB.mensajeVitrina({ ok: true, abierta: false }, T0, IMG)).includes('todavía no abrió'), 'la Tienda cerrada: lo dice');
  env = envCon({ tienda: S });
  mv = await BB.vitrina(env, Q, T0, IMG);
  ok(env.pedidos[0][0] === 'tienda' && env.pedidos[0][1].quien === Q && V.textoV2(mv).includes('La vitrina de hoy'), 'por el objeto: la Tienda de quien tocó');

  // ── 5. «Mi tarjeta» ───────────────────────────────────────────────────────────────────────────────────────────────
  const comps = [{ type: 12, items: [{ media: { url: 'https://x/dlx/servidor.webp' } }] }];
  r = await BB.tarjeta({ tarjeta: async () => comps }, Q);
  ok(r.components === comps && (r.flags & V.EFIMERO) && (r.flags & V.V2), 'con carta: la de /card, sólo para ti');
  r = await BB.tarjeta({ tarjeta: async () => null }, Q);
  ok(V.textoV2(r).includes('Todavía no tienes tarjeta') && V.piezas(r, 2).some((b) => b.url === V.URL_VINCULAR), 'sin carta: los dos pasos y el botón para vincularte');
  ok(V.textoV2(await BB.tarjeta({}, Q)).includes('prueba de nuevo'), 'sin el Worker: «prueba de nuevo»');

  // ── 6. el Worker ──────────────────────────────────────────────────────────────────────────────────────────────────
  const i = (id) => ({ application_id: 'app', token: 'tok', channel_id: '900000000000000001', member: { user: { id: Q } }, data: { custom_id: id } });
  let pensado = null;
  const resp = BZ.botonWorker(i('bzn:card'), envCon({}), null, { pensando: (tr) => { pensado = tr; return new Response('{"type":4}'); },
    tarjeta: async () => comps });
  ok(pensado && (await resp.json()).type === 4 && (await pensado()).components === comps, 'por buzon.botonWorker(): «un momento» primero y la carta después');
  const fetchReal = globalThis.fetch;
  const pedidos = [];
  globalThis.fetch = async (u, op) => { pedidos.push([String(u), op && op.method, op && op.body]); return new Response('{}'); };
  const espera = [];
  const r6 = BZ.botonWorker(i('bzn:drop'), envCon({ 'tienda-accion': abierto(1), 'pase-dia': abierto(0) }), { waitUntil: (p) => espera.push(p) });
  await Promise.all(espera);
  globalThis.fetch = fetchReal;
  ok((await r6.json()).type === 6 && pedidos.length === 1 && pedidos[0][0].endsWith('/webhooks/app/tok') && JSON.parse(pedidos[0][2]).flags & V.EFIMERO,
    'sin `pensando`: «ya va» y el drop por el webhook de la interacción, efímero');
  ok(!pedidos.some(([u]) => u.includes('users/@me')), 'nunca abre un DM');
}

// suelta
if (import.meta.url === 'file://' + process.argv[1].replace(/\\/g, '/') || import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  let bien = 0, mal = 0;
  await probar((c, t, x) => { if (c) bien += 1; else { mal += 1; console.log('  🔴 ' + t + (x !== undefined ? '\n     ' + x : '')); } });
  console.log(`\n  buzon_prueba: ${bien} bien${mal ? `, 🔴 ${mal} mal` : ''}\n`);
  process.exit(mal ? 1 : 0);
}
