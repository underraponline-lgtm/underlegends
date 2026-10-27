// 👤 La prueba de la tanda 2 del perfil (27/10/2026) sobre el objeto de verdad (SQLite de Node): la frase (qué vale, el
// tope por día, quitarla desde el Dashboard), los emblemas elegidos, el rol de DRA del directorio, las felicitaciones que
// recibió (también las que ya se borraron) y Voz del pueblo, y «Lo último» con lo que hizo en la página: sólo cuántos,
// nunca a quién ni qué. node bot/perfil_prueba.mjs
import * as A from './avisos.js';

let fallas = 0, bien = 0;
const ok = (c, t, extra) => {
  if (c) bien += 1;
  else { fallas += 1; console.log('  🔴 ' + t + (extra !== undefined ? '\n     ' + extra : '')); }
};

// ── lo puro ──
ok(A.fraseValida('  El que no   arriesga no gana ') === 'El que no arriesga no gana', 'la frase se limpia de espacios');
ok(A.fraseValida('') === '' && A.fraseValida(null) === '', 'vacía es «quitarla»');
ok(A.fraseValida('x'.repeat(A.FRASE_MAX + 1)) === null && A.fraseValida('x'.repeat(A.FRASE_MAX)) !== null, 'hasta FRASE_MAX caracteres');
ok(A.fraseValida('sígueme en www.algo.com') === null && A.fraseValida('entra a discord.gg/abc') === null
  && A.fraseValida('hola @everyone') === null && A.fraseValida('<b>hola</b>') === null, 'sin links, menciones ni etiquetas');
ok(JSON.stringify(A.emblemasValidos(['racha', 'pase', 'racha'])) === '["racha","pase"]', 'emblemas: sin repetidos');
ok(A.emblemasValidos(['a', 'b', 'c', 'd', 'e', 'f', 'g']) === null || A.emblemasValidos(['aa', 'bb', 'cc', 'dd', 'ee', 'ff']).length === A.EMBLEMAS_MAX,
  'emblemas: como mucho EMBLEMAS_MAX');
ok(A.emblemasValidos(['<x>']) === null && A.emblemasValidos('racha') === null, 'emblemas: sólo ids');

let DatabaseSync = null;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { DatabaseSync = null; }
if (!DatabaseSync) {
  console.log('  ⓘ sin node:sqlite (Node ' + process.version + '): el perfil no se prueba sobre el objeto');
  console.log(fallas ? '\n  🔴 ' + fallas + ' mal' : '\n  ✅ ' + bien + ' bien');
  process.exit(fallas ? 1 : 0);
}
const db = new DatabaseSync(':memory:');
const sql = {
  exec(q, ...ps) {
    const t = String(q).trim();
    if (!ps.length && /;\s*\S/.test(t)) { db.exec(t); return { toArray: () => [], rowsWritten: 0 }; }
    const st = db.prepare(t);
    if (/^\s*(SELECT|WITH|PRAGMA)/i.test(t)) { const rows = st.all(...ps); return { toArray: () => rows, rowsWritten: 0 }; }
    const r = st.run(...ps);
    return { toArray: () => [], rowsWritten: Number(r.changes) };
  },
};
const o = new A.Avisos({ storage: { sql, setAlarm() {}, getAlarm() { return null; } }, blockConcurrencyWhile: async (f) => f() },
  { KV: { get: async () => null } });
await new Promise((r) => setTimeout(r, 5));

const ANA = '111111111111111111', BEA = '222222222222222222', CAMI = '333333333333333333';
const ahora = Date.now(), DIA = 864e5;
sql.exec("INSERT INTO jugo_temp (quien, temp, k, eventos) VALUES (?, 't1', 'ana', 3)", ANA);
sql.exec("INSERT INTO idk (id, k, t) VALUES (?, 'bea', ?)", BEA, ahora);

// ── la frase y los emblemas ──
let r = o.perfilMio({ quien: ANA, de: 'ana', frase: '  Nunca me rindo  ' });
ok(r.ok && r.frase === 'Nunca me rindo', 'guardar la frase', JSON.stringify(r));
ok(o.perfilMio({ quien: ANA, de: 'ana', frase: 'mira https://x.com' }).error === 'frase', 'una frase con link no se guarda');
ok(o.perfilMio({ quien: ANA, de: 'ana' }).frase === 'Nunca me rindo', 'sin cambios, sólo la lee');
r = o.perfilMio({ quien: ANA, de: 'ana', emb: ['racha', 'pase'] });
ok(r.ok && r.frase === 'Nunca me rindo' && JSON.stringify(r.emb) === '["racha","pase"]', 'los emblemas no pisan la frase');
for (let i = 0; i < 10; i++) o.perfilMio({ quien: BEA, de: 'bea', frase: 'frase número ' + i });
ok(o.perfilMio({ quien: BEA, de: 'bea', frase: 'una más' }).error === 'tope', 'la frase cambia como mucho 10 veces por día');
ok(o.perfilMio({ quien: 'x', de: 'ana', frase: 'hola' }).error && o.perfilMio({ quien: ANA, de: 'NO VALE!', frase: 'hola' }).error,
  'sin cuenta o sin perfil válido, nada');

// ── lo público ──
let ex = o.perfilExtra('ana');
ok(ex.fr === 'Nunca me rindo' && JSON.stringify(ex.em) === '["racha","pase"]', 'la frase y los emblemas, por la clave', JSON.stringify(ex));
ok(!JSON.stringify(ex).includes(ANA), 'lo público nunca lleva el Discord ID');
ok(o.perfilExtra('NO VALE!').error, 'una clave que no vale no se contesta');

// 🏷️ el rol de DRA, del directorio del ciclo (sólo los de ROLES_DRA)
o.rolesEstados({ dir: [{ k: 'ana', n: 'Ana', id: ANA, a: { competidor: [] }, dra: 'Freestyler' },
  { k: 'bea', n: 'Bea', id: BEA, a: {}, dra: 'Rey del universo' }] });
ok(o.perfilExtra('ana').dra === 'Freestyler' && o.perfilExtra('bea').dra === '', 'el rol de DRA, y nada que no sea uno de DRA');

// 🖱️ lo que hizo en la página: sólo cuántos
sql.exec("INSERT INTO aplaudidas (id, tipo, quien, ks, motivo, t, primero) VALUES ('aaaaaaaaaaaa', 'campeon', '[]', '[\"bea\"]', '', '', ?)", ahora);
sql.exec("INSERT INTO aplaudidas (id, tipo, quien, ks, motivo, t, primero) VALUES ('bbbbbbbbbbbb', 'campeon', '[]', '[\"bea\",\"cami\"]', '', '', ?)", ahora);
sql.exec("INSERT INTO aplausos (id, quien, t) VALUES ('aaaaaaaaaaaa', ?, ?)", ANA, ahora - 1000);
sql.exec("INSERT INTO aplausos (id, quien, t) VALUES ('bbbbbbbbbbbb', ?, ?)", ANA, ahora - 2000);
sql.exec("INSERT INTO aplausos (id, quien, t) VALUES ('bbbbbbbbbbbb', ?, ?)", CAMI, ahora - 3000);
sql.exec("INSERT INTO sigue (quien, a, t) VALUES (?, 'bea', ?)", ANA, ahora - 5000);
sql.exec("INSERT INTO sigue (quien, a, t) VALUES (?, 'cami', ?)", ANA, ahora - 20 * DIA);
sql.exec("INSERT INTO votos (enc, quien, op, t) VALUES ('mes:2026-10:mc', ?, 'bea', ?)", ANA, ahora - 6000);
sql.exec("INSERT INTO votos (enc, quien, op, t) VALUES ('mes:2026-10:batalla', ?, 'bea', ?)", ANA, ahora - 6000);
sql.exec("INSERT INTO votos (enc, quien, op, t) VALUES ('mes:2026-09:mc', ?, 'bea', ?)", ANA, ahora - 40 * DIA);
o._pex = null;
ex = o.perfilExtra('ana');
const act = Object.fromEntries(ex.act.map((a) => [a[0], a]));
ok(act.fel && act.fel[1] === 2 && act.sigue && act.sigue[1] === 1 && act.mes && act.mes[1] === 1 && !act.enc,
  'lo de la página: 2 felicitaciones, 1 seguido en 14 días (el viejo no), los MES AWARDS una vez por mes', JSON.stringify(ex.act));
ok(ex.act[0][0] === 'fel', 'del más nuevo al más viejo');
ok(!/bea|cami|aaaaaaaaaaaa|mc"/.test(JSON.stringify(ex.act)), 'nunca a quién ni qué');
ok(ex.voz === 2, 'Voz del pueblo: los meses distintos en que votó en los MES AWARDS', ex.voz);

// 👏 las que recibió: también las que ya se borraron
ok(o.perfilExtra('bea').apl === 3 && o.perfilExtra('cami').apl === 2, 'las felicitaciones que recibió cada uno', o.perfilExtra('bea').apl);
o.guardarAplausosRec();
sql.exec('DELETE FROM aplausos');
sql.exec('DELETE FROM aplaudidas');
o._pex = null;
ok(o.perfilExtra('bea').apl === 3, 'y siguen ahí después de que el muro las borra (aplausos_rec)', o.perfilExtra('bea').apl);
sql.exec("INSERT INTO aplaudidas (id, tipo, quien, ks, motivo, t, primero) VALUES ('aaaaaaaaaaaa', 'campeon', '[]', '[\"bea\"]', '', '', ?)", ahora);
sql.exec("INSERT INTO aplausos (id, quien, t) VALUES ('aaaaaaaaaaaa', ?, ?)", BEA, ahora);
sql.exec("INSERT INTO aplausos (id, quien, t) VALUES ('aaaaaaaaaaaa', ?, ?)", CAMI, ahora);
o._pex = null;
ok(o.perfilExtra('bea').apl === 4, 'una publicación guardada que suma más ahora cuenta la mayor, sin repetir', o.perfilExtra('bea').apl);

// 🚩 quitar la frase desde el Dashboard
r = o.duenoFrase({ k: 'ana', por: '9' });
ok(r.ok && r.quitadas >= 1 && o.perfilExtra('ana').fr === '' && JSON.stringify(o.perfilExtra('ana').em) === '["racha","pase"]',
  'el Dashboard quita la frase y deja los emblemas', JSON.stringify(r));

console.log(fallas ? '\n  🔴 ' + fallas + ' mal, ' + bien + ' bien' : '\n  ✅ el perfil, tanda 2: ' + bien + ' bien');
process.exit(fallas ? 1 : 0);
