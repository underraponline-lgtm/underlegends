/**
 * EL WORKER DE VERDAD, CONTRA LOS DATOS DE VERDAD, PARA LAS 138.
 *
 *   python bot/volcar_kv.py      (primero: baja KV a bot/_kv_volcado.json)
 *   node bot/simular.mjs
 *
 * ⚠️ POR QUÉ EXISTE. Había dos pruebas y entre las dos quedaba un hueco:
 *
 *   probar_local.mjs   corre el Worker de verdad  contra un KV de MENTIRA
 *   verificar.py       mira los servicios de verdad  pero NO corre el Worker
 *
 * O sea que nadie ejecutaba el código contra los datos. Y ahí viven los
 * errores que ninguna de las dos ve, todos del mismo tipo: **los que sólo
 * aparecen con la persona 87**.
 *
 *   · `norm()` está escrito DOS VECES —Python y JavaScript— y no hay manera
 *     de que una avise sobre la otra. Si difieren en un nombre con tilde, con
 *     ñ o con espacio, el Worker busca una clave que no existe y contesta «no
 *     tengo cartas» de alguien que sí está. Con tres nombres no se nota.
 *   · el `custom_id` tope 100 lleva el nombre adentro.
 *   · una URL que el Worker construye y en R2 no está = hueco silencioso.
 *
 * Acá se le pide al Worker TODO lo que una persona puede pedirle —las tres
 * formas de `/card`, los cuatro botones, los nueve servidores del menú— y se
 * comprueba cada URL contra el inventario de R2.
 *
 * ⚠️ NO PIDE LAS URL POR RED. Eso ya lo hace `bot/verificar.py`, que las baja
 * de verdad. Acá la pregunta es otra: **¿el Worker construye las que existen?**
 * Son dos preguntas distintas y cada una encuentra lo que la otra no.
 */
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = dirname(AQUI);

const { default: worker, SERVIDORES } = await import('./worker.js');

const hex = (b) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const par = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
const CLAVE = hex(await crypto.subtle.exportKey('raw', par.publicKey));

let volcado;
try {
  volcado = JSON.parse(readFileSync(join(AQUI, '_kv_volcado.json'), 'utf8'));
} catch {
  console.error('Falta bot/_kv_volcado.json. Corré antes:  python bot/volcar_kv.py');
  process.exit(1);
}
const inventario = JSON.parse(readFileSync(join(RAIZ, 'datos/cartas_r2.json'), 'utf8'));

const env = {
  DISCORD_PUBLIC_KEY: CLAVE,
  KV: { get: async (k) => (k in volcado ? volcado[k] : null) },
};
const ctx = { waitUntil: () => {} };
globalThis.fetch = async () => new Response('{}', { status: 200 });

// ⚠️ El reloj de mentira otra vez: el freno al spam cortaría a las cuatro
// peticiones y esto hace miles. Acá no se está probando el freno.
let RELOJ = Date.now();
Date.now = () => RELOJ;

const G_FFA = (SERVIDORES.find(s => s.sv === 'FFA') || {}).guild;

async function pedir(objeto) {
  RELOJ += 60000;
  const cuerpo = JSON.stringify(objeto);
  const ts = String(Math.floor(RELOJ / 1000));
  const sig = hex(await crypto.subtle.sign(
    'Ed25519', par.privateKey, new TextEncoder().encode(ts + cuerpo)));
  const r = await worker.fetch(new Request('https://x/', {
    method: 'POST',
    headers: { 'x-signature-ed25519': sig, 'x-signature-timestamp': ts },
    body: cuerpo,
  }), env, ctx);
  return JSON.parse(await r.text());
}

const R2 = 'https://pub-70d5821d06a8432c9cffd0c102195000.r2.dev';
const claveDe = (url) => String(url).replace(R2 + '/', '').replace(/\?.*$/, '')
  .replace(/\.(png|webp)$/, '');
const existe = (url) => {
  const k = claveDe(url);
  const i = k.indexOf('/');
  const quien = k.slice(0, i), carta = k.slice(i + 1);
  return !!(inventario[quien] && inventario[quien][carta]);
};
const media = (d) => {
  const g = (d?.components || []).find(x => x.type === 12);
  return g?.items?.[0]?.media?.url || null;
};
// ⚠️ SÓLO LOS DE CARTA, los que tienen `custom_id`. En la misma fila va la
// campana de avisos, que es un link al hub: no se «aprieta» contra el
// Worker, así que no hay nada que simular.
const botones = (d) => {
  const f = (d?.components || []).filter(x => x.type === 1)
    .find(f => f.components[0].type === 2);
  return f ? f.components.filter(b => b.custom_id) : [];
};

const fallos = [];
const anotar = (q, que) => { if (fallos.length < 40) fallos.push(`${q}: ${que}`); };

const gente = Object.keys(volcado).filter(k => k.startsWith('p:')).map(k => k.slice(2));
const ids = Object.keys(volcado).filter(k => k.startsWith('d:')).map(k => k.slice(2));
const meta = JSON.parse(volcado.meta || '{}');
const SVS = meta.svs || [];

console.log(`\nEL WORKER CONTRA LOS DATOS DE VERDAD`);
console.log(`  ${gente.length} personas · ${ids.length} Discord ID · servidores listos: ${SVS.join(' ')}\n`);

// ── 1. las tres maneras de pedir, para las 138 ────────────────────────────
let urls = 0, maxId = 0, maxIdQuien = '';
for (const q of gente) {
  const g = JSON.parse(volcado['p:' + q]);

  // ⚠️ POR NOMBRE: es lo único que ejerce el `norm()` de JavaScript contra el
  // de Python. El nombre va como lo escribe el Sheet —con tildes, con ñ, con
  // espacios— y tiene que caer en la misma clave.
  const porNombre = await pedir({
    type: 2, guild_id: G_FFA, member: { user: { id: '900000' } },
    data: { name: 'card', options: [{ name: 'nombre', value: g.n }] },
  });
  const u = media(porNombre.data);
  if (!u) {
    anotar(g.n, `por nombre no devolvió carta: ${(porNombre.data?.content || '').slice(0, 60)}`);
    continue;
  }
  if (claveDe(u).split('/')[0] !== q) anotar(g.n, `por nombre cayó en ${claveDe(u)}`);
  if (!existe(u)) anotar(g.n, `URL que no está en R2: ${claveDe(u)}`);
  urls++;

  // ── 2. los cuatro botones (los que el bot dibuja) ──────────────────────
  for (const b of botones(porNombre.data)) {
    if (b.custom_id.length > maxId) { maxId = b.custom_id.length; maxIdQuien = g.n; }
    const r = await pedir({
      type: 3, guild_id: G_FFA, member: { user: { id: '900000' } },
      data: { custom_id: b.custom_id },
    });
    const uu = media(r.data);
    if (!uu) { anotar(g.n, `el botón ${b.label} no devolvió carta`); continue; }
    if (!existe(uu)) anotar(g.n, `botón ${b.label} -> URL que no está: ${claveDe(uu)}`);
    urls++;
  }

  // ── 3. los nueve servidores del menú ────────────────────────────────────
  for (const s of SERVIDORES) {
    const r = await pedir({
      type: 3, guild_id: G_FFA, application_id: 'app', token: 'tok',
      member: { user: { id: '900000' } },
      data: { custom_id: `s:${q}::900000`, values: [s.sv] },
    });
    const uu = media(r.data);
    if (!uu) {
      // sólo puede pasar si ese servidor no está en `svs`
      if (SVS.includes(s.sv)) anotar(g.n, `el menú no dio carta de ${s.sv} estando lista`);
      continue;
    }
    if (!existe(uu)) anotar(g.n, `menú ${s.sv} -> URL que no está: ${claveDe(uu)}`);
    // ⚠️ LA CARTA PROPIA SE DECIDE CON `svp`, NO CON `sv`. Desde el 19/09
    // `sv` es donde ESTAS —lo dice Discord— y `svp` donde JUGASTE —el argmax
    // del Sheet—. Sólo en `svp` existe tu `pos_sv`, y por eso sólo ahí va
    // `servidor.webp`. Comparando contra `sv`, este chequeo decía que Bishop
    // «devolvió sv-dra» cuando eso es exactamente lo correcto.
    const propio = g.svp !== undefined ? g.svp : g.sv;
    if (!claveDe(uu).endsWith(s.sv === propio ? 'servidor' : 'sv-' + s.sv.toLowerCase())) {
      anotar(g.n, `menú ${s.sv} devolvió ${claveDe(uu)}`);
    }
    urls++;
  }
}

// ── 4. el versus, que no dibuja cartas sino que dice quién gana ───────────
// ⚠️ ES OTRA PREGUNTA QUE LA DE ARRIBA. `/card` falla cuando una URL no
// existe; el versus no arma ninguna URL, así que ese chequeo no lo tocaría
// nunca. Lo que puede salir mal acá es otra cosa, y toda se ve bien en
// pantalla:
//
//   · el veredicto contradice a la tabla —marcador y ganador salieron de dos
//     cuentas distintas, que es el bug que ya tuvo esta función—
//   · se declara un ganador sin tener los números de uno de los dos
//   · el `custom_id` se pasa de 100: lleva DOS nombres en vez de uno, así que
//     el margen es la mitad del de `/card` y nadie lo había medido
//   · una categoría que no tienen los dos igual aparece como botón
let vs = 0, conTabla = 0, maxV = 0, maxVQuien = '';
const idDeClave = {};
for (const id of ids) idDeClave[volcado['d:' + id]] = id;
// ⚠️ SE ORDENA PARA QUE LOS QUE TIENEN NÚMEROS QUEDEN JUNTOS, y no es
// cosmética: los pares se arman entre vecinos, y con el orden alfabético casi
// ningún par tenía los dos lados con datos —138 de 469 los tienen—. Medido:
// de 1772 versus respondidos sólo 125 llegaban a tener veredicto que
// verificar, o sea que el 93 % de la corrida no probaba lo único que este
// comando hace. Con los que tienen datos juntos, casi todos los pares de ese
// tramo son verificables, y el par del borde sigue ejerciendo el camino de
// «no tengo números de uno de los dos».
const tieneVs = (q) => !!JSON.parse(volcado['p:' + q]).vs;
const conId = gente.filter(q => idDeClave[q])
  .sort((x, y) => (tieneVs(y) - tieneVs(x)) || (x < y ? -1 : 1));
const CAT = { temporada: 't', competitivo: 'c', pais: 'p', servidor: 's' };
for (let n = 0; n < conId.length; n++) {
  const a = conId[n], b = conId[(n + 1) % conId.length];
  if (a === b) continue;
  const ga = JSON.parse(volcado['p:' + a]), gb = JSON.parse(volcado['p:' + b]);
  for (const c of Object.keys(CAT)) {
    const r = await pedir({
      type: 2, guild_id: G_FFA, member: { user: { id: idDeClave[a] } },
      data: {
        name: 'versus',
        options: [{ name: 'rival', value: idDeClave[b] },
                  { name: 'carta', value: c }],
      },
    });
    const txt = r.data?.content || '';
    if (!txt) { anotar(`${ga.n} vs ${gb.n}`, `${c}: respuesta sin texto`); continue; }
    vs++;
    for (const bt of (r.data?.components || [])[0]?.components || []) {
      if (bt.custom_id.length > maxV) { maxV = bt.custom_id.length; maxVQuien = `${ga.n} vs ${gb.n}`; }
      // un botón que ofrece una categoría que no tienen los dos
      const cat = bt.custom_id.split(':')[2];
      const real = (g, k) => (g.cs || []).indexOf(k) >= 0;
      if (!real(ga, cat) || !real(gb, cat)) {
        anotar(`${ga.n} vs ${gb.n}`, `ofrece ${cat} y no la tienen los dos`);
      }
    }
    // 🔴 TENER EL NÚMERO NO ES TENER LA CARTA, y confundirlo hacía que
    // esta prueba pidiera un veredicto que el Worker tiene razón en no
    // dar. Desde el 21/09 `cs` sale del REQUISITO: Walker tiene Score
    // (40.5) y **no** tiene Competitiva, porque le faltan eventos para
    // los 10. El Worker no le ofrece ese versus —`tieneReal()` es
    // «está en cs y no bloqueada»— y eso es lo correcto: el Score bajo
    // 10 eventos va multiplicado por una Confianza de 0.80, así que
    // compararlo es justo lo que el requisito dice que no se haga.
    //
    // ⚠️ La prueba pedía el veredicto igual y lo reportaba como
    // «dice undefined». Encodeaba el mundo de antes del requisito: el
    // Worker cambió, la prueba no, y el que estaba mal era el test.
    const desbloq = (g, k) => (g.cs || []).indexOf(k) >= 0;
    if (!desbloq(ga, c) || !desbloq(gb, c)) {
      if (txt.includes('Gana **')) {
        anotar(`${ga.n} vs ${gb.n}`,
               `${c}: declaró ganador y uno de los dos la tiene bloqueada`);
      }
      continue;
    }
    const va = (ga.vs || {})[CAT[c]], vb = (gb.vs || {})[CAT[c]];
    if (!va || !vb) {
      // sin números, NO puede declarar ganador
      if (txt.includes('Gana **')) {
        anotar(`${ga.n} vs ${gb.n}`, `${c}: declaró ganador sin números de uno`);
      }
      continue;
    }
    conTabla++;
    // ⚠️ EL VEREDICTO SE RECALCULA ACÁ DESDE LOS DATOS y se compara con el
    // que el Worker escribió. Es lo único que agarra que la tabla y el
    // ganador salgan de dos cuentas distintas — el bug que esta función ya
    // tuvo, cuando la fila «Puesto» comparaba 1/18 contra 14/79 y el
    // veredicto usaba el percentil. Los dos decían lo mismo por casualidad.
    const cab = { temporada: ['ovr', 1], competitivo: ['sc', 1],
                  pais: ['ovr', 1], servidor: ['arc', 1] }[c];
    const num = (x) => {
      if (x === null || x === undefined || x === '') return null;
      const v = parseFloat(String(x).split('/')[0]);
      return Number.isFinite(v) ? v : null;
    };
    const xa = num(va[cab[0]]), xb = num(vb[cab[0]]);
    if (xa === null || xb === null) continue;
    const esperado = xa === xb ? null : (xa > xb ? ga.n : gb.n);
    const dice = (txt.match(/Gana \*\*(.+?)\*\*/) || [])[1];
    const empata = txt.includes('Empatan');
    if (esperado === null && !empata) {
      anotar(`${ga.n} vs ${gb.n}`, `${c}: son iguales (${xa}) y no dice empate`);
    } else if (esperado !== null) {
      // el nombre en el mensaje va recortado a 11, así que se compara el prefijo
      const corto = esperado.length > 11 ? esperado.slice(0, 10) : esperado;
      if (!dice || !(dice === corto || dice.startsWith(corto.slice(0, 10)))) {
        anotar(`${ga.n} vs ${gb.n}`, `${c}: dice «${dice}» y los datos dan «${esperado}» (${xa} vs ${xb})`);
      }
    }
  }
}
// ── 5. el índice de Discord ID ────────────────────────────────────────────
let porId = 0;
for (const id of ids) {
  const r = await pedir({
    type: 2, guild_id: G_FFA, member: { user: { id } },
    data: { name: 'card' },
  });
  const u = media(r.data);
  if (!u) { anotar(`ID ${id}`, `no devolvió carta: ${(r.data?.content || '').slice(0, 50)}`); continue; }
  if (claveDe(u).split('/')[0] !== volcado['d:' + id]) {
    anotar(`ID ${id}`, `cayó en ${claveDe(u)} y el índice dice ${volcado['d:' + id]}`);
  }
  porId++;
}

console.log(`  ${urls} URL construidas por el Worker, todas contra el inventario`);
console.log(`  ${vs} versus respondidos · ${conTabla} con tabla y veredicto verificado`);
console.log(`  ${porId} de ${ids.length} Discord ID resuelven a su persona`);
console.log(`  custom_id más largo: ${maxId} de 100  (${maxIdQuien})`);
// ⚠️ EL DEL VERSUS SE MIDE APARTE PORQUE LLEVA DOS NOMBRES. El de `/card` es
// `c:<quien>:<carta>:<dueño>`; éste es `v:<a>:<carta>:<dueño>:<b>`, o sea el
// mismo tope de 100 con un nombre más adentro. Si algún día el margen se
// achica, se achica acá primero y el otro número no lo diría.
console.log(`  custom_id del versus: ${maxV} de 100  (${maxVQuien})`);
console.log('');
if (fallos.length) {
  console.log(`  ${fallos.length} PROBLEMA(S):`);
  for (const f of fallos) console.log('    ' + f);
  console.log('');
  process.exit(1);
}
console.log('  TODO BIEN: el Worker no construye ni una URL que no exista.\n');
