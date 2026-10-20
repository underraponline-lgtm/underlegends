// 🖼️ La prueba del logo de una crew por el camino de verdad: `Avisos.crewConImagen()` (avisos.js) con un R2 y una IA de
// mentira, sobre SQLite de Node. Lo que mira: que lo que no se puede crear NO gasta la IA ni R2, que lo que el filtro
// frena no entra, que lo dudoso crea la crew con el logo esperando, y que lo reemplazado se borra de R2.
// node bot/crews_logo_prueba.mjs
import { Avisos } from './avisos.js';
import * as CW from './crews.js';

let mal = 0, bien = 0;
const ok = (c, t) => { if (c) bien += 1; else { mal += 1; console.log('  🔴 ' + t); } };

let DatabaseSync = null;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { DatabaseSync = null; }
if (!DatabaseSync) {
  console.log('  ⓘ sin node:sqlite (Node ' + process.version + '): el logo no se prueba sobre el objeto');
  process.exit(0);
}
const db = new DatabaseSync(':memory:');
const sql = {
  exec(q, ...ps) {
    const st = db.prepare(String(q).trim());
    if (/^\s*(SELECT|WITH|PRAGMA)/i.test(q)) { const rows = st.all(...ps); return { toArray: () => rows }; }
    st.run(...ps);
    return { toArray: () => [] };
  },
};
db.exec('CREATE TABLE tienda (id TEXT PRIMARY KEY, ref INTEGER NOT NULL, quien TEXT NOT NULL, monto INTEGER NOT NULL, t INTEGER NOT NULL)');
db.exec('CREATE TABLE servidor (quien TEXT, temporada TEXT, sv TEXT, de TEXT, t INTEGER, fijo INTEGER)');
db.exec('CREATE TABLE sigue (quien TEXT, a TEXT, t INTEGER, de TEXT)');
db.exec('CREATE TABLE persona (k TEXT PRIMARY KEY, v TEXT NOT NULL, t INTEGER NOT NULL)');
CW.crewTablas(sql);

let respuestaIA = 'SEXUAL=no GORE=no VIOLENCE=no HATE=no DRUGS=no PERSONAL=no';
const r2 = new Map(), ia = [], borrados = [];
const yo = {
  sql,
  state: { storage: { transactionSync: (f) => f() } },
  env: {
    AI: { run: async () => { ia.push(1); return { response: respuestaIA }; } },
    CARTAS: { put: async (k, b) => { r2.set(k, b); }, delete: async (k) => { borrados.push(k); r2.delete(k); } },
  },
  ajustes: () => ({}),
  cuentaCambio: () => true,
  aBandeja: () => {},
  anotarFiltro: () => {},
  saldo: (quien, desde, inicial) => inicial,
};
yo.crewConImagen = Avisos.prototype.crewConImagen.bind(yo);
yo.borrarLogosCrew = Avisos.prototype.borrarLogosCrew.bind(yo);

// un PNG de verdad (1×1), en base64: el tipo se mira por los bytes
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const base = (n, k, x) => Object.assign({ quien: String(7000000000 + n), de: k, inicial: 5000, desde: 0, accion: 'crear',
  sigla: 'TS', desc: 'Una crew de prueba, del barrio', entrada: 'pedido', img: PNG }, x);

const r1 = await yo.crewConImagen(base(1, 'ana', { nombre: 'Primera' }));
const pub = () => CW.crewsPublico(yo).crews;
ok(r1.ok && r1.logo === 'ok' && r2.size === 1 && [...r2.keys()][0].startsWith(CW.LOGO_CARPETA)
  && pub().find((c) => c.id === 'Primera').logo.includes('/' + CW.LOGO_CARPETA), 'limpio: se guarda en su carpeta y la crew lo muestra');
const iaAntes = ia.length;
ok((await yo.crewConImagen(base(2, 'bea', { nombre: 'PRIMERA' }))).error === 'nombre_usado' && ia.length === iaAntes && r2.size === 1,
  'si la crew no se puede crear, ni la IA ni R2 se tocan');
ok((await yo.crewConImagen(base(3, 'cid', { nombre: 'Sin logo', img: undefined }))).error === 'logo', 'sin logo, no');
ok((await yo.crewConImagen(base(3, 'cid', { nombre: 'No imagen', img: 'aG9sYQ==' }))).error === 'no es una imagen', 'lo que no es una imagen, no');
respuestaIA = 'SEXUAL=yes GORE=no VIOLENCE=no HATE=no DRUGS=no PERSONAL=no';
const r3 = await yo.crewConImagen(base(3, 'cid', { nombre: 'Frenada' }));
ok(r3.error === 'filtro' && /sexual/.test(r3.texto) && r2.size === 1 && !pub().some((c) => c.id === 'Frenada'),
  'lo que el filtro frena no entra, y la crew no se crea');
respuestaIA = 'SEXUAL=no GORE=maybe VIOLENCE=no HATE=no DRUGS=no PERSONAL=no';
const r4 = await yo.crewConImagen(base(4, 'dan', { nombre: 'Dudosa' }));
ok(r4.ok && r4.logo === 'revisar' && pub().find((c) => c.id === 'Dudosa').logo === '' && CW.crewLogosDueno(yo).pend.length === 1,
  'lo dudoso: la crew se crea y el logo espera revisión');
respuestaIA = 'SEXUAL=no GORE=no VIOLENCE=no HATE=no DRUGS=no PERSONAL=no';
const viejo = pub().find((c) => c.id === 'Primera').logo.split('.r2.dev/')[1];
// 💰 cambiar el logo cuesta (`precio_logo`), así que lleva el saldo como `crear`: sin `inicial` contesta «todavía»
const r5 = await yo.crewConImagen({ quien: String(7000000001), de: 'ana', accion: 'logo', img: PNG, inicial: 5000, desde: 0 });
ok(r5.ok && borrados.includes(viejo) && !r2.has(viejo) && r2.size === 2 && r5.viejos === undefined,
  'cambiar el logo borra el viejo de R2 (y no le devuelve URLs a la página)');
ok((await yo.crewConImagen({ quien: String(7000000009), de: 'zoe', accion: 'logo', img: PNG })).error === 'sin_crew', 'sin crew, no hay logo que cambiar');
const r6 = CW.crewDueno(yo, { que: 'logo', crew: 'Dudosa', si: false, url: CW.crewLogosDueno(yo).pend[0].url });
await yo.borrarLogosCrew(r6.viejos);
ok(r6.ok && r2.size === 1 && CW.crewLogosDueno(yo).pend.length === 0, 'el dueño descarta el dudoso y se borra de R2');
// 🧽 el JPEG que arma Safari trae un Exif suyo: antes frenaba la crew con «trae datos escondidos»; ahora se le saca
const exif = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0, 16]), Buffer.from('JFIF\0'), Buffer.alloc(9),
  Buffer.from([0xFF, 0xE1, 0, 20]), Buffer.from('Exif\0\0'), Buffer.alloc(12),
  Buffer.from([0xFF, 0xDB, 0, 4, 0, 0, 0xFF, 0xDA, 0, 2, 1, 2, 3, 0xFF, 0xD9])]);
const rs = await yo.crewConImagen(base(5, 'eva', { nombre: 'Safari', img: exif.toString('base64') }));
const guardada = [...r2.entries()].find(([k]) => k.endsWith('.jpg'));
ok(rs.ok && guardada && !Buffer.from(guardada[1]).includes(Buffer.from('Exif')) && guardada[1][0] === 0xFF && guardada[1][1] === 0xD8,
  'un JPEG de iPhone con Exif crea la crew, y se guarda sin el Exif');
await yo.borrarLogosCrew(['https://pub-x.r2.dev/fondos/abc.webp', 'https://pub-x.r2.dev/oasis/temporada.webp']);
ok(!borrados.some((k) => k.startsWith('fondos/') || k.startsWith('oasis/')), 'borrar logos nunca toca un fondo ni una carta');

console.log(mal ? `\n  🔴 ${mal} mal, ${bien} bien` : `  ✅ logo de crews: ${bien} bien`);
if (mal) process.exit(1);
