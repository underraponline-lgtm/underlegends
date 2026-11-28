// 🎫 La prueba de los botones del Pase en Discord (bot/pase_dc.js, 28/11/2026): «Mi Pase», «Mis Tareas» y «El track».
//
//   · sin verificar, con el objeto caído y con el Pase que todavía no arrancó: un aviso corto, nunca un Pase vacío;
//   · gratis y Premium (y el Premium vencido, que ya no lo es), en el nivel 0, a mitad y en el 50;
//   · sin Tareas (sin diarias hoy, sin semanales, sin las de temporada) y con todas hechas;
//   · que cada mensaje entre en los topes de Discord (40 componentes, 4.000 letras, un custom_id de 100) y sea efímero;
//   · que cada imagen que pide exista (bot/paginas/discord/pase/) y que el panel del canal pida los mismos botones;
//   · y DE PUNTA A PUNTA sobre el objeto de verdad (SQLite de Node) con la configuración de bot/pase.py: lo que devuelve
//     `paseDe()` es lo que estos mensajes saben leer.
//
//     node bot/pase_dc_prueba.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as PD from './pase_dc.js';
import * as V from './vista.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.join(AQUI, '..');
let fallas = 0, bien = 0;
const ok = (c, t, extra) => {
  if (c) bien += 1;
  else { fallas += 1; console.log('  🔴 ' + t + (extra !== undefined ? '\n     ' + String(extra).slice(0, 600) : '')); }
};
const texto = (m) => V.textoV2(m);
const entra = (m) => { const r = V.medir(m); return r.problemas.length === 0 ? '' : r.problemas.join(', '); };
const efimero = (m) => (m.flags & V.V2) && (m.flags & V.EFIMERO);

// ── la configuración de verdad, de bot/pase.py (la misma que manda el ciclo) ──────────────────────────────────────────
function cfgPython() {
  const cod = "import sys, json; sys.path[:0] = ['bot', '.', 'sheet']; import pase; print(json.dumps(pase.config('t1')))";
  for (const py of ['python3', 'python']) {
    const r = spawnSync(py, ['-c', cod], { cwd: BASE, encoding: 'utf-8' });
    if (r.status === 0 && r.stdout) { try { return JSON.parse(r.stdout); } catch (e) { /* el que sigue */ } }
  }
  return null;
}
const CFG = cfgPython();
ok(!!CFG && CFG.premios.length === CFG.niveles && CFG.premium.length === CFG.niveles, 'la configuración de bot/pase.py se lee');
if (!CFG) { console.log('\n  🔴 sin Python no hay con qué probar'); process.exit(1); }

const AHORA = Date.UTC(2026, 10, 28, 19, 0); // sábado 28/11/2026, 2 PM ET
const T = (id, t, lleva, meta, hecha, xp = 150, d = 'Cómo se cumple.') => ({ id, t, d, lleva, meta, hecha, xp });
/** Un Pase como el de `paseDe()`, en el nivel `nivel` (la XP justo en el medio del tramo) */
function pase(nivel, o = {}) {
  const u = CFG.umbrales, n = CFG.niveles;
  const desde = nivel ? u[nivel - 1] : 0, hasta = nivel < n ? u[nivel] : null;
  const xp = hasta == null ? u[n - 1] + 2500 : Math.round((desde + hasta) / 2);
  return Object.assign({ listo: true, miembro: true, temp: 't1', niveles: n, nivel, xp, desde, hasta, cola: 0, cada: CFG.cola,
    cobrado: nivel * 150, completos: [], salon: nivel >= n ? 7 : 0, premios: CFG.premios, fila_premium: CFG.premium, premium: null,
    boost: CFG.boost, doble: [],
    hoy: { dia: '2026-11-28', fin: AHORA + 3600000 * 10, tareas: [T('entrar', 'Entra hoy', 1, 1, true), T('vivo1', 'Mira una llave en vivo', 0, 1, false)] },
    semana: { id: '2026-11-23', fin: AHORA + 2 * 86400000, tareas: [T('dias', 'Entra 3 días', 2, 3, false, 500), T('dra', 'Juega un evento en DRA', 1, 1, true, 500)] },
    temporada: [T('fel10', 'Felicita a 10 personas', 4, 10, false, 1500), T('dra3', 'Juega 3 eventos en DRA', 3, 3, true, 2000)],
    bienvenida: [], especiales: [], gracia: null }, o);
}

// ── 🚧 los estados que no son un Pase ─────────────────────────────────────────────────────────────────────────────
for (const [p, que, dice] of [[{ error: 'red' }, 'el objeto caído', 'No pude'], [null, 'sin respuesta', 'No pude'],
  [{ listo: false }, 'el Pase que todavía no arrancó', 'arranca en un rato'],
  [pase(3, { miembro: false }), 'sin verificar', 'Miembros de DRA']]) {
  for (const acc of ['pase', 'tareas', 'track']) {
    const m = PD.vista(acc, p, AHORA);
    ok(efimero(m) && texto(m).includes(dice) && !entra(m), `${acc}, ${que}: un aviso corto y sólo para quien toca («${dice}»)`, texto(m));
  }
}
const sinVerif = PD.vista('pase', pase(3, { miembro: false }), AHORA);
ok(texto(sinVerif).includes('<#' + PD.CANAL_VERIFICAR + '>') && V.piezas(sinVerif, 2).some((b) => b.url === PD.URL_VERIFICAR),
  'sin verificar: menciona #verificate-aqui y trae el botón para ir');
ok(!/\b(tenés|podés|querés|verificate|anotate|elegí|vos)\b/i.test(Object.values(PD.TXT).join(' ')), 'en tú, no en vos');

// ── 🎫 «Mi Pase» ──────────────────────────────────────────────────────────────────────────────────────────────────
for (const n of [0, 1, 7, 29, 49, 50]) {
  for (const [prem, nom] of [[null, 'gratis'], [{ desde: 0, hasta: null }, 'Premium'], [{ desde: 0, hasta: AHORA - 1000 }, 'Premium vencido']]) {
    const p = pase(n, { premium: prem });
    for (const acc of ['pase', 'tareas', 'track']) {
      const m = PD.vista(acc, p, AHORA);
      ok(efimero(m) && !entra(m), `${acc} en el nivel ${n}, ${nom}: entra en los topes de Discord`, entra(m));
      const fila = m.components[m.components.length - 1];
      ok(fila.type === 1 && fila.components.length === 4 && fila.components[3].style === 5
        && fila.components.find((b) => b.custom_id === 'pse:' + acc).disabled,
      `${acc} en el nivel ${n}: las otras dos vistas, la que ves apagada y el link a la página último`);
    }
  }
}
let m = PD.mensajePase(pase(7), AHORA);
const g7 = PD.progreso(pase(7));
ok(texto(m).includes('Nivel 7 de 50') && texto(m).includes('para el nivel 8') && texto(m).includes(`${g7.lleva.toLocaleString('es-AR')} / ${g7.tramo.toLocaleString('es-AR')} XP`),
  'Mi Pase: el nivel, y la barra con la XP del tramo al siguiente', texto(m));
ok(['Nivel 8', 'Nivel 9', 'Nivel 10'].every((x) => texto(m).includes(x)) && !texto(m).includes('Nivel 11'), 'Mi Pase: los 3 premios que vienen');
ok(texto(m).includes('🆓') && texto(m).includes('💎') && texto(m).includes('🔒') && texto(m).includes('Pase gratis'),
  'gratis: las dos filas, la Premium con candado');
const premM = PD.mensajePase(pase(7, { premium: { desde: 0, hasta: null } }), AHORA);
ok(texto(premM).includes('Pase Premium') && !texto(premM).includes('🔒') && texto(premM).includes('+20 %'), 'Premium: sin candado y con su +20 %');
ok(texto(PD.mensajePase(pase(7, { premium: { desde: 0, hasta: AHORA - 1 } }), AHORA)).includes('Pase gratis'), 'el Premium vencido ya no cuenta');
ok(texto(PD.mensajePase(pase(7, { premium: { desde: 0, hasta: null, prueba: AHORA + 86400000 } }), AHORA)).includes('de prueba'),
  'la prueba del Premium se dice');
const minis = V.piezas(m, 11).map((x) => x.media.url);
ok(minis.length === 3 && minis.every((u) => u.startsWith(V.PAGINAS + '/discord/pase/')), 'cada premio que viene, con su imagen', minis.join(' '));
ok(texto(PD.mensajePase(pase(0), AHORA)).includes('Nivel 0 de 50') && texto(PD.mensajePase(pase(0), AHORA)).includes('Tu carta de Temporada'),
  'nivel 0: el que viene es el 1, con tu carta de Temporada');
m = PD.mensajePase(pase(50), AHORA);
ok(texto(m).includes('Completaste el Pase') && texto(m).includes('#7') && !texto(m).includes('Lo que viene') && texto(m).includes('300 Puntos'),
  'nivel 50: completo, el puesto del Salón y la cola, sin premios que vengan', texto(m));
ok(texto(PD.mensajePase(pase(49), AHORA)).includes('Nivel 50') && !texto(PD.mensajePase(pase(49), AHORA)).includes('Nivel 51'),
  'nivel 49: sólo el 50 viene, no se inventan niveles');

// ── 🎯 «Mis Tareas» ───────────────────────────────────────────────────────────────────────────────────────────────
m = PD.mensajeTareas(pase(7), AHORA);
ok(texto(m).includes('~~Entra hoy~~') && texto(m).includes('**Mira una llave en vivo**') && texto(m).includes('2/3')
  && texto(m).includes('<t:') && texto(m).includes('1 de 2 hechas') && texto(m).includes('4/10'),
'Mis Tareas: hechas tachadas, las que faltan con cuánto llevas, cuándo cambian y las de temporada', texto(m));
m = PD.mensajeTareas(pase(7, { hoy: null, semana: null, temporada: [] }), AHORA);
ok(!entra(m) && texto(m).includes('Hoy no hay diarias') && texto(m).includes('arrancan el lunes'), 'sin Tareas: lo dice, no queda vacío', texto(m));
m = PD.mensajeTareas(pase(7, { temporada: [T('a', 'A', 1, 1, true), T('b', 'B', 2, 2, true)] }), AHORA);
ok(texto(m).includes('Hiciste todas las de la temporada'), 'todas las de temporada hechas: lo dice');
m = PD.mensajeTareas(pase(7, { bienvenida: [T('bfel', 'Felicita a alguien', 0, 1, false, 200)],
  especiales: [Object.assign(T('hw', 'Halloween', 0, 2, false, 1000), { ini: AHORA - 1000, fin: AHORA + 3600000 })],
  gracia: { id: 'x', fin: AHORA + 86400000, tareas: [T('fel', 'Felicita a 3', 1, 3, false, 500)] }, doble: [[AHORA - 1, AHORA + 1000, 2]] }), AHORA);
ok(['Para empezar', 'Especiales', 'La semana pasada', '×2'].every((x) => texto(m).includes(x)), 'la bienvenida, la especial, la gracia y la XP doble');
// 📏 el peor caso: muchas Tareas con explicaciones largas → sin las explicaciones, y entra
const larga = 'x'.repeat(400);
const muchas = Array.from({ length: 12 }, (_, k) => T('t' + k, 'Tarea número ' + k, 0, 3, false, 500, larga));
m = PD.mensajeTareas(pase(7, { hoy: { fin: AHORA + 1, tareas: muchas.slice(0, 3) }, semana: { fin: AHORA + 1, tareas: muchas.slice(3, 9) },
  temporada: muchas, bienvenida: muchas.slice(0, 3) }), AHORA);
ok(!entra(m) && !texto(m).includes(larga), 'el peor caso de Tareas: sin las explicaciones, y entra en las 4.000 letras', entra(m));
ok(texto(m).includes('más en la página'), 'de temporada se ven 5 y el resto se cuenta');

// ── 🗺️ «El track» ────────────────────────────────────────────────────────────────────────────────────────────────
ok(PD.ventana(0, 50).join() === '1,2,3,4,5,6,7' && PD.ventana(7, 50).join() === '5,6,7,8,9,10,11' && PD.ventana(50, 50).join() === '44,45,46,47,48,49,50',
  'la ventana: 7 niveles, dos antes del tuyo, sin pasarse de 1 ni de 50');
ok(PD.tiraTrack(0, 50) === '▱'.repeat(25) && PD.tiraTrack(50, 50) === '▰'.repeat(25) && PD.tiraTrack(7, 50) === '▰▰▰◆' + '▱'.repeat(21),
  'la tira de los 50: vacía, llena y con tu casilla marcada', PD.tiraTrack(7, 50));
m = PD.mensajeTrack(pase(7), AHORA);
ok(texto(m).includes('📍 **7 · estás acá**') && texto(m).includes('✅ 5') && texto(m).includes('⏭️ 8') && texto(m).includes('⬜ 11'),
  'el track: los de antes hechos, el tuyo marcado y los que vienen', texto(m));
const gal = V.piezas(m, 12).filter((x) => !String(x.items[0].media.url).includes('portada'));
ok(gal.length === 1 && gal[0].items.length >= 1 && gal[0].items.every((x) => x.media.url.includes('/discord/pase/') && x.description.startsWith('Nivel ')),
  'los grandes que vienen, en una galería con su imagen y su nivel');
ok(texto(PD.mensajeTrack(pase(0), AHORA)).includes('Nivel 0 · estás acá'), 'nivel 0: arrancas acá');
ok(texto(PD.mensajeTrack(pase(50), AHORA)).includes('¡completo!') && texto(PD.mensajeTrack(pase(50), AHORA)).includes('📍 **50'),
  'nivel 50: completo y marcado en el 50');

// ── 🖼️ las imágenes y la portada existen ─────────────────────────────────────────────────────────────────────────
const claves = new Set([].concat(CFG.premios, CFG.premium).map(PD.claveImg));
ok([...claves].every((k) => PD.CLAVES_IMG.includes(k)), 'cada premio del Pase tiene una clave de imagen conocida', [...claves].join());
const faltan = PD.CLAVES_IMG.filter((k) => !fs.existsSync(path.join(AQUI, 'paginas', 'discord', 'pase', k + '.png')));
ok(!faltan.length, 'cada imagen está en bot/paginas/discord/pase/ (herramientas/pase_premios_png.py)', faltan.join());
ok(V.FAMILIAS.pase && fs.existsSync(path.join(AQUI, 'paginas', 'discord', 'portada-pase.png')), 'la portada del Pase está');
ok(PD.claveImg([1, 150, 'tarjeta', 'Temporada']) === 'carta' && PD.claveImg([15, 150, 'insignia', 'Pase Plata']) === 'insignia-plata'
  && PD.claveImg([20, 150, 'emblema', 'Pase premium']) === 'insignia-premium' && PD.claveImg([2, 150, '', '']) === 'pdt',
'la imagen de cada premio: como `objetoDe()` de la página');
ok(PD.premioTexto([10, 150, 'titulo', 'De la casa']).includes('fondo de tu crew') && PD.premioTexto([3, 150, 'reaccion', '🔥'], true) === 'Reacción 🔥 en Publicaciones',
  'los textos de los premios, como `premioLargo()` de la página');

// ── 🔌 el botón en el Worker ─────────────────────────────────────────────────────────────────────────────────────
const llam = [];
const ayuda = (p) => ({
  aviso: (t) => { llam.push('aviso'); return { aviso: t }; },
  alObjeto: async (env, ruta, cuerpo) => { llam.push(ruta + ':' + cuerpo.quien); return p; },
  pensandoYEditar: (i, ctx, t, fam) => { llam.push('pensando:' + fam); return { t }; },
  actualizarLuego: (i, ctx, t, fam) => { llam.push('actualizar:' + fam); return { t }; },
  esEfimero: (i) => !!(i.message && (i.message.flags & V.EFIMERO)),
  idDe: (i) => (i.member && i.member.user && i.member.user.id) || '',
});
const yo = { member: { user: { id: '739338101603696681' } } };
let r = PD.boton(Object.assign({ data: { custom_id: 'pse:track' }, message: { flags: 0 } }, yo), {}, {}, ayuda(pase(7)));
const hecho = await r.t();
ok(llam.join() === 'pensando:pase,pase:739338101603696681' && texto(hecho).includes('El track'),
  'desde el panel: «un momento» y un mensaje nuevo sólo para quien toca, con SU Pase', llam.join());
llam.length = 0;
r = PD.boton(Object.assign({ data: { custom_id: 'pse:tareas' }, message: { flags: V.V2 | V.EFIMERO } }, yo), {}, {}, ayuda(pase(7)));
ok(llam.join() === 'actualizar:pase' && texto(await r.t()).includes('Tus Tareas'), 'desde un mensaje de estos (efímero): cambia ese mismo');
llam.length = 0;
PD.boton(Object.assign({ data: { custom_id: 'pse:otra' } }, yo), {}, {}, ayuda(pase(7)));
PD.boton({ data: { custom_id: 'pse:pase' } }, {}, {}, ayuda(pase(7)));
ok(llam.join() === 'aviso,aviso', 'un botón que no existe o sin saber quién es: un aviso, sin preguntarle al objeto');

// ── 🔗 lo que tiene que coincidir con el resto del repo ──────────────────────────────────────────────────────────
const pan = fs.readFileSync(path.join(AQUI, 'paneles_dra.py'), 'utf-8');
const accPy = ((/^ACCIONES = \(([^)]*)\)/m.exec(pan) || [])[1] || '').match(/'([^']+)'/g) || [];
ok(PD.ACCIONES.every((a) => accPy.includes(`'${a}'`)), 'el cartel del Pase pide los mismos botones que se contestan acá (ACCIONES)', accPy.join());
const w = fs.readFileSync(path.join(AQUI, 'worker.js'), 'utf-8');
ok(/import \* as PD from '\.\/pase_dc\.js'/.test(w) && /que === 'pse'[\s\S]{0,200}frenado\(idDe\(i\), 'click'\)[\s\S]{0,200}PD\.boton\(/.test(w),
  'el Worker importa bot/pase_dc.js y lo llama con el freno de clics');
ok(/'pase_dc\.js'/.test(fs.readFileSync(path.join(AQUI, 'desplegar.py'), 'utf-8')), 'bot/desplegar.py sube pase_dc.js con el Worker');

// ── 🧪 DE PUNTA A PUNTA, sobre el objeto de verdad ────────────────────────────────────────────────────────────────
let DatabaseSync = null;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { DatabaseSync = null; }
if (!DatabaseSync) console.log('  ⓘ sin node:sqlite (Node ' + process.version + '): no se prueba sobre el objeto');
else {
  const A = await import('./avisos.js');
  const db = new DatabaseSync(':memory:');
  const sql = {
    exec(q, ...ps) {
      const t = String(q).trim();
      if (!ps.length && /;\s*\S/.test(t)) { db.exec(t); return { toArray: () => [], rowsWritten: 0 }; }
      const st = db.prepare(t);
      if (/^\s*(SELECT|WITH|PRAGMA)/i.test(t)) { const rows = st.all(...ps); return { toArray: () => rows, rowsWritten: 0 }; }
      const res = st.run(...ps);
      return { toArray: () => [], rowsWritten: Number(res.changes) };
    },
  };
  const relojReal = Date.now;
  Date.now = () => AHORA;
  try {
    const o = new A.Avisos({ storage: { sql, setAlarm() {}, getAlarm() { return null; } }, blockConcurrencyWhile: async (f) => f() },
      { KV: { get: async () => null } });
    await new Promise((res) => setTimeout(res, 5));
    const ANA = '111111111111111111', NADIE = '999999999999999999';
    const i1 = Date.UTC(2026, 10, 23, 16, 0);
    const res = o.paseCiclo({ v: 'v1', cfg: Object.assign({}, CFG, { temp: 't1' }), sem: [['2026-11-23', i1, i1 + 7 * 86400000]],
      miembros: [ANA], hechas: {} });
    ok(res && res.ok, 'el objeto toma la configuración de bot/pase.py', JSON.stringify(res));
    const pa = o.paseDe(ANA), pn = o.paseDe(NADIE);
    for (const acc of ['pase', 'tareas', 'track']) {
      const mm = PD.vista(acc, pa, AHORA);
      ok(efimero(mm) && !entra(mm) && !texto(mm).includes('undefined') && !texto(mm).includes('NaN'),
        `${acc} con el Pase de verdad de un miembro: se lee entero y entra`, texto(mm));
      ok(texto(PD.vista(acc, pn, AHORA)).includes('Miembros de DRA'), `${acc} de alguien que no es miembro: a verificarse`);
    }
    ok(texto(PD.mensajePase(pa, AHORA)).includes('Nivel 0 de 50') && texto(PD.mensajeTareas(pa, AHORA)).includes('Esta semana'),
      'el miembro nuevo: nivel 0 y sus Tareas de esta semana');
  } finally { Date.now = relojReal; }
}

console.log(`\n  pase_dc_prueba: ${bien} bien${fallas ? ', 🔴 ' + fallas + ' mal' : ''}\n`);
process.exit(fallas ? 1 : 0);
