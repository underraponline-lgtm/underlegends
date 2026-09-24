/**
 * Liga Global — Mi Perfil Web App
 * Code.gs — Server-side logic
 *
 * v3 (22 julio 2026) — CAMBIOS:
 *  - TEMPORADA: se lee de la pestaña «Consola» del Operativo (la escribe sync.py).
 *    Antes el sidebar tenía las fechas quemadas y quedaba desactualizado solo.
 *    🔴 NO se calcula por fecha. Dlx anuncia cada temporada a mano con -startseason.
 *
 * v2 (31 mayo 2026):
 *  - Racha ahora es "actual/máxima" (col M). Se exponen AMBOS valores.
 *  - Racha del Competitivo usa la racha MÁXIMA de la temporada (no la actual).
 *  - Puntos MW para excluir de eficiencia: se leen de la tabla MW del LOBBY
 *    (la hoja "Ranking MW" fue eliminada).
 *  - Targets MW: estado (activo/cazado/sobrevivió) derivado del Lobby.
 *
 * SETUP:
 * 1. Público Sheet → Extensions → Apps Script → pegar en Code.gs
 * 2. Crear Index.html con el HTML
 * 3. Deploy → Web app (Execute as: Me / Access: Anyone)
 * 4. Tras actualizar el ranking: correr refreshCache()
 */

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Mi Perfil — Liga Global')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getWebAppUrl() {
  return ScriptApp.getService().getUrl();
}

/* ════════════════════════════════════════════════════════════════════
   🔴 LA CACHE MIRA LOS DATOS Y NO VE EL CODIGO — y acá se arregla.

   `getAllData()` guarda seis horas. Eso está bien para un ranking y
   está MAL para un arreglo al código: el 23/09/2026 el bloque del
   Competitivo leía las columnas por letra fija y la vitrina había
   ganado `Rango` en D, así que la página mostraba **los eventos como
   Score y el Score como Confianza** para todo el mundo. Publicar la
   versión corregida no cambiaba nada: la cache seguía sirviendo el JSON
   calculado por el código viejo, sin fecha de vencimiento a la vista y
   sin un error que mirar.

   Es la misma forma que `CLAUDE.md` documenta para las cartas —*«una
   cache que mira los datos no ve el código»*— y la misma solución:
   **el sello lleva la huella del código.** `CACHE_V` la reescribe
   `sheet/webapp_subir.py` en cada subida, así que la clave cambia sola
   y lo cacheado por la versión anterior deja de encontrarse.

   ⚠️ NO SE BORRA LO VIEJO, SE DEJA DE PEDIR. Borrar pediría saber
   cuántos trozos tenía la versión anterior, que es justo lo que no se
   sabe; con la clave nueva, lo viejo vence solo en seis horas.

   ⚠️ Y `refreshCache()` SIGUE EXISTIENDO, porque contesta otra
   pregunta: los **datos** cambiaron y el código no.
   ════════════════════════════════════════════════════════════════════ */
const CACHE_V = '8c10b3c9de';   // lo reescribe sheet/webapp_subir.py

function getAllData() {
  const cache = CacheService.getScriptCache();
  const K = 'allData_' + CACHE_V;
  const cached = cache.get(K);
  if (cached) {
    try { return JSON.parse(cached); } catch(e) {}
  }
  const chunksStr = cache.get(K + '_chunks');
  if (chunksStr) {
    try {
      const chunks = parseInt(chunksStr);
      let json = '';
      for (let i = 0; i < chunks; i++) {
        const chunk = cache.get(K + '_' + i);
        if (!chunk) break;
        json += chunk;
      }
      if (json) return JSON.parse(json);
    } catch(e) {}
  }
  const result = buildAllData();
  try {
    const json = JSON.stringify(result);
    if (json.length < 100000) {
      cache.put(K, json, 21600);
    } else {
      const chunkSize = 90000;
      const chunks = Math.ceil(json.length / chunkSize);
      const keys = {};
      for (let i = 0; i < chunks; i++) {
        keys[K + '_' + i] = json.substr(i * chunkSize, chunkSize);
      }
      keys[K + '_chunks'] = String(chunks);
      cache.putAll(keys, 21600);
    }
  } catch(e) {}
  return result;
}

/* ════════════════════════════════════════════════════════════════════
   LOS PROXIMOS EVENTOS, PARA LA CUENTA ATRAS DE UN SEGUNDO.

   🔴 SIN CACHE, A PROPOSITO. `getAllData()` cachea 6 horas, que está
   bien para un ranking y está MAL para esto: un evento anunciado
   «en 30 minutos» no puede tardar seis horas en aparecer. Es barato —
   tres celdas— así que se lee cada vez.

   🔴 SE DEVUELVE EPOCH, NO LA HORA PARTIDA EN NUMEROS. La cuenta atrás
   corre en el navegador del que mira, y su huso **no es** el de la
   planilla: armar la fecha con `new Date(a,m,d,...)` del lado del
   cliente la interpretaría en el huso del visitante y el contador
   erraría por horas — bien formado y equivocado. Lo que viaja es un
   instante absoluto.

   🔴 Y EL HUSO SE PIDE, NO SE ASUME — ESTE SCRIPT NO ESTA EN EL MISMO
   QUE LA PLANILLA. La primera versión hacía `new Date(a,m,d,...)` acá
   "porque Apps Script corre en el huso de la hoja". **Es falso**:
   `appsscript.json` dice `America/New_York` y la planilla está en
   `America/Los_Angeles`, tres horas de diferencia. Probado con un
   evento a 42 minutos: la página mostró **«EN VIVO»**, porque
   interpretar una hora de LA como si fuera de NY la manda 3 h al
   pasado.

   ⚠️ Es exactamente el error contra el que avisa el párrafo de arriba,
   una capa más adentro — y no lo encontró leer el código, lo encontró
   poner un evento futuro y mirar la página. `Utilities.parseDate` con
   `getSpreadsheetTimeZone()` no depende del huso de ninguno de los dos.

   ⚠️ SALE DE LA FORMULA DE `Lobby!E5:E7` y no de su resultado. El
   resultado es «⏳ 0h 28m» —ya redondeado a minutos— y lo que hace
   falta es el instante. La fórmula la genera `sheet/lobby.py`
   (`_formula_cuenta`), que la escribe cada hora con esta forma exacta.
   ════════════════════════════════════════════════════════════════════ */
function getProximos() {
  try {
    const ss = SpreadsheetApp.openById('1sDo89FTvnI6FOtz6KSK0jAtDBtJHsB7N54wNLLae62U');
    const lb = ss.getSheetByName('Lobby');
    if (!lb) return [];
    const f = lb.getRange('E5:E7').getFormulas();
    const b = lb.getRange('B5:B7').getValues();
    const tz = ss.getSpreadsheetTimeZone();
    const dd = function (n) { return (n.length < 2 ? '0' : '') + n; };
    const out = [];
    for (let i = 0; i < 3; i++) {
      const formula = String((f[i] && f[i][0]) || '');
      const m = formula.match(/DATE\((\d+),(\d+),(\d+)\)\+TIME\((\d+),(\d+),(\d+)\)/);
      if (!m) continue;
      const t = Utilities.parseDate(
        m[1] + '-' + dd(m[2]) + '-' + dd(m[3]) + ' ' +
        dd(m[4]) + ':' + dd(m[5]) + ':' + dd(m[6]),
        tz, 'yyyy-MM-dd HH:mm:ss');
      // ⚠️ SE MANDAN TAMBIEN LOS PASADOS: quien decide si todavía vale
      // es el cliente, que tiene el reloj corriendo. Filtrar acá dejaría
      // un evento «en vivo» colgado hasta la próxima carga de la página.
      const txt = String((b[i] && b[i][0]) || '').trim();
      if (!txt) continue;
      out.push({ nombre: txt.split('—')[0].trim(), epoch: t.getTime() });
    }
    return out;
  } catch (e) {
    return [];
  }
}

function refreshCache() {
  // ⚠️ SE BORRA LA CLAVE DE **ESTA** VERSION, no `'allData'` a secas.
  // Esas tres líneas borraban las claves de antes de que existiera
  // `CACHE_V`, o sea nada: `refreshCache()` devolvía «Cache refreshed»
  // y la página seguía igual. Un botón que no hace nada y dice que sí.
  const cache = CacheService.getScriptCache();
  const K = 'allData_' + CACHE_V;
  cache.remove(K);
  for (let i = 0; i < 20; i++) cache.remove(K + '_' + i);
  cache.remove(K + '_chunks');
  getAllData();
  return 'Cache refreshed (' + CACHE_V + ')';
}

function buildAllData() {
  const ss = SpreadsheetApp.openById('1sDo89FTvnI6FOtz6KSK0jAtDBtJHsB7N54wNLLae62U');
  const op = SpreadsheetApp.openById('1DFar2NSlC9YvkMQ_uKzLmfOrmthJ1lp-l3exP0NFHm8');

  const rt = ss.getSheetByName('Ranking Temporada');
  const rtData = rt.getDataRange().getValues();

  let headerIdx = -1;
  for (let i = 0; i < Math.min(30, rtData.length); i++) {
    if (rtData[i][0] === '#') { headerIdx = i; break; }
  }
  if (headerIdx === -1) return { error: 'Header row not found' };

  const headers = rtData[headerIdx];
  const col = {};
  const colMap = {
    '#': 'pos', 'Rapero': 'name', 'Sv': 'sv', 'Puntos': 'pts', 'Ev': 'ev',
    '\ud83e\udd47': 'gold', '\ud83e\udd48': 'silver', '\ud83e\udd49': 'bronze', '\ud83c\udf96\ufe0f': 'fourth',
    '\ud83c\udfaf': 'cazas', '\ud83d\udc80': 'cazado', '\ud83d\udee1\ufe0f': 'shields', '\ud83d\udd25': 'streak',
    'Win%': 'wr', '\u2705': 'verified', '\u00daltimo Resultado': 'last',
    '4\ufe0f\u20e3': 'semis', '8\ufe0f\u20e3': 'quarters', '\u2795': 'early',
    'Rango': 'rank',
    // 🔴 FFA Y EFA FALTABAN, Y LA T1 ENTERA ES DE FFA. La vitrina
    // ganó esas dos columnas el 22/09/2026 —eran siete servidores y
    // son nueve— y acá quedaron sin leer: la página mostraba a todo el
    // mundo con 0 eventos en todos los servidores, porque los únicos
    // eventos que hay son de FFA. No fallaba: sumaba cero.
    'TWR': 'twr', 'TFC': 'tfc', 'SR': 'sr', 'FTN': 'ftn',
    'URBF': 'urbf', 'FRZ': 'frz', 'DRA': 'dra',
    'FFA': 'ffa', 'EFA': 'efa'
  };
  headers.forEach((h, i) => { if (colMap[h]) col[colMap[h]] = i; });

  // ── Parse MW points-to-exclude + target status from the LOBBY MW table ──
  const mwInfo = readMWFromLobby(ss);   // { ptsMap:{hunter:pts}, targets:[...] }
  const mwPtsMap = mwInfo.ptsMap;

  const rappers = [];
  for (let i = headerIdx + 1; i < rtData.length; i++) {
    const row = rtData[i];
    if (!row[col.pos] && row[col.pos] !== 0) continue;

    const pts = parseNum(row[col.pts]);
    const ev = parseNum(row[col.ev]);
    const gold = parseNum(row[col.gold]);
    const silver = parseNum(row[col.silver]);
    const bronze = parseNum(row[col.bronze]);
    const fourth = parseNum(row[col.fourth]);
    const cazas = parseNum(row[col.cazas]);
    const cazado = parseNum(row[col.cazado]);
    const shields = parseNum(row[col.shields]);

    // ── RACHA "actual/máxima" ──
    const streakRaw = String(row[col.streak] || '').trim();
    let streakActual = 0, streakMax = 0;
    if (streakRaw.indexOf('/') !== -1) {
      const parts = streakRaw.split('/');
      streakActual = parseNum(parts[0]);
      streakMax = parseNum(parts[1]);
    } else {
      // formato viejo (un solo número) → ambos iguales
      streakActual = parseNum(streakRaw);
      streakMax = streakActual;
    }

    const semis = parseNum(row[col.semis]);
    const quarters = parseNum(row[col.quarters]);
    const early = parseNum(row[col.early]);
    const wrStr = String(row[col.wr] || '0');
    let wr = parseFloat(wrStr.replace('%', '')) || 0;
    if (wrStr.indexOf('%') === -1 && wr > 0 && wr <= 1) wr = Math.round(wr * 1000) / 10;

    const wrWeighted = ev > 0 ? Math.round(
      (gold * 1.00 + silver * 0.85 + bronze * 0.65 + fourth * 0.50 +
       semis * 0.30 + quarters * 0.12 + early * 0.05) / ev * 1000
    ) / 10 : 0;

    // ⚠️ LOS NUEVE, y el orden es el de `SERVIDORES` en
    // `sheet/rankings.py`. Si acá faltara uno, «Trotamundos —compite en
    // 5 servers—» no podría contarlo nunca.
    const servers = {
      FFA: parseNum(row[col.ffa]), EFA: parseNum(row[col.efa]),
      TWR: parseNum(row[col.twr]), TFC: parseNum(row[col.tfc]),
      SR: parseNum(row[col.sr]), FTN: parseNum(row[col.ftn]),
      URBF: parseNum(row[col.urbf]), FRZ: parseNum(row[col.frz]),
      DRA: parseNum(row[col.dra])
    };

    const nameStr = String(row[col.name] || '');
    let flag = '\u2753';
    let cleanName = nameStr;
    const len = nameStr.length;
    if (len >= 4) {
      const cp1 = nameStr.codePointAt(len - 4);
      const cp2 = nameStr.codePointAt(len - 2);
      if (cp1 >= 0x1F1E6 && cp1 <= 0x1F1FF && cp2 >= 0x1F1E6 && cp2 <= 0x1F1FF) {
        flag = String.fromCodePoint(cp1, cp2);
        cleanName = nameStr.slice(0, len - 4).trim();
      }
    }
    if (nameStr.endsWith(' \u2753') || nameStr.endsWith('\u2753')) {
      flag = '\u2753';
      cleanName = nameStr.replace(/\s*\u2753$/, '').trim();
    }

    let countryCode = '';
    if (flag !== '\u2753' && flag.length >= 2) {
      const c1 = flag.codePointAt(0);
      const c2 = flag.codePointAt(2);
      if (c1 >= 0x1F1E6 && c1 <= 0x1F1FF && c2 >= 0x1F1E6 && c2 <= 0x1F1FF) {
        countryCode = String.fromCharCode(c1 - 0x1F1E6 + 65) + String.fromCharCode(c2 - 0x1F1E6 + 65);
      }
    }

    const rapper = {
      pos: parseNum(row[col.pos]),
      fullName: nameStr,
      name: cleanName,
      flag: flag,
      countryCode: countryCode,
      sv: String(row[col.sv] || ''),
      pts: pts, ev: ev, gold: gold, silver: silver, bronze: bronze, fourth: fourth,
      cazas: cazas, cazado: cazado, shields: shields,
      streak: streakMax,            // compat: el HTML viejo usa "streak" como máx
      streakActual: streakActual,   // NUEVO
      streakMax: streakMax,         // NUEVO
      wr: wr, wrWeighted: wrWeighted,
      verified: String(row[col.verified] || ''),
      last: String(row[col.last] || ''),
      semis: semis, quarters: quarters, early: early,
      rank: String(row[col.rank] || ''),
      servers: servers,
      totalMedals: gold + silver + bronze,
      finals: gold + silver,
      efficiency: ev > 0 ? Math.round(pts / ev) : 0,
      podiumRate: ev > 0 ? Math.round((gold + silver + bronze) / ev * 100) : 0,
      finalsRate: ev > 0 ? Math.round((gold + silver) / ev * 100) : 0,
      champRate: ev > 0 ? Math.round(gold / ev * 100) : 0,
      qfPlus: ev > 0 ? Math.round((semis + gold + silver + bronze + fourth) / ev * 100) : 0,
      activeServers: Object.values(servers).filter(v => v > 0).length,
      mwBalance: cazas - cazado,
      percentile: 0,
    };
    rappers.push(rapper);
  }

  const totalRappers = rappers.length;
  rappers.forEach(r => { r.percentile = Math.ceil(r.pos / totalRappers * 100); });

  // ── COMPETITIVO (leído de la pestaña "Ranking Competitivo" ya calculada) ──
  //
  // ⚠️ EL REQUISITO ES 10 EVENTOS, NO 8. Dlx, 23/09/2026: «el ranking
  // competitivo no aparece nadie hasta q tenga 10 eventos». Vive en
  // comun/requisitos.py del lado de Python; acá hay que mantenerlo a
  // mano porque Apps Script no puede leer ese archivo.
  const eligible = rappers.filter(r => r.ev >= 10);
  const compSheet = ss.getSheetByName('Ranking Competitivo');
  if (compSheet) {
    const compData = compSheet.getDataRange().getValues();
    let cHdr = -1;
    for (let i = 0; i < Math.min(20, compData.length); i++) {
      if (String(compData[i][0]).trim() === '#') { cHdr = i; break; }
    }
    const compMap = {};
    if (cHdr !== -1) {
      // 🔴 LAS COLUMNAS SE BUSCAN POR NOMBRE, NO SE CLAVAN POR LETRA.
      // Esto decía «A=# B=Rapero C=Sv D=Ev E=Score …» y la vitrina ganó
      // la columna `Rango` en D el 23/09/2026: TODO quedó corrido un
      // lugar. La página mostraba los eventos como Score, el Score como
      // Confianza y la Confianza como Eficiencia — cinco números mal
      // para las 45 personas, sin un solo error en el log. Es la misma
      // regla que la fila de cabecera ya tenía («se busca, no se clava»)
      // aplicada al otro eje.
      //
      // Y se busca por PALABRA: los títulos llevan emoji («⚡ Eficiencia»)
      // y el emoji es decoración que puede cambiar sin avisar.
      const palabra = h => String(h || '').replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ#%]/g, '')
                                          .toLowerCase();
      const cc = {};
      const quiero = {
        '#': 'pos', 'rapero': 'name', 'score': 'score', 'confianza': 'conf',
        'eficiencia': 'efi', 'consistencia': 'con', 'dominancia': 'dom',
        'racha': 'rch', 'techo': 'rch', 'diversidad': 'div'
      };
      compData[cHdr].forEach((h, i) => {
        const k = quiero[palabra(h)];
        if (k && cc[k] === undefined) cc[k] = i;
      });
      const num = (row, k) => (cc[k] === undefined ? 0 : parseNum(row[cc[k]]));
      for (let i = cHdr + 1; i < compData.length; i++) {
        const row = compData[i];
        const name = String(row[cc.name === undefined ? 1 : cc.name] || '').trim();
        if (!name || row[0] === '' || row[0] === null) continue;
        compMap[name] = {
          comp_pos: num(row, 'pos'),
          comp_score: num(row, 'score'),
          comp_confidence: num(row, 'conf'),
          comp_dims: {
            efficiency:  num(row, 'efi'),
            consistency: num(row, 'con'),
            dominance:   num(row, 'dom'),
            ceiling:     num(row, 'rch'),
            diversity:   num(row, 'div')
          }
        };
      }
    }
    rappers.forEach(r => {
      const c = compMap[r.fullName];
      if (c) {
        r.comp_pos = c.comp_pos;
        r.comp_score = c.comp_score;
        r.comp_confidence = c.comp_confidence;
        r.comp_raw = c.comp_confidence > 0 ? Math.round((c.comp_score / c.comp_confidence) * 10) / 10 : c.comp_score;
        r.comp_dims = c.comp_dims;
        r.comp_eligible = true;
      } else {
        r.comp_eligible = false;
      }
    });
  }

  // ── PODIOS ──
  const pod = ss.getSheetByName('Ranking Podios');
  if (pod) {
    const podData = pod.getDataRange().getValues();
    const podMap = {};
    let podHeader = -1;
    for (let i = 0; i < Math.min(30, podData.length); i++) {
      if (podData[i][0] === '#') { podHeader = i; break; }
    }
    if (podHeader >= 0) {
      for (let i = podHeader + 1; i < podData.length; i++) {
        const name = String(podData[i][1] || '');
        if (name && podData[i][0]) {
          podMap[name] = { podPos: parseNum(podData[i][0]), podPts: parseNum(podData[i][5]) };
        }
      }
    }
    rappers.forEach(r => {
      const p = podMap[r.fullName];
      if (p) { r.podPos = p.podPos; r.podPts = p.podPts; }
    });
  }

// ── AVATARS + VERIFICADO (Operativo → Lista de Raperos) ──
  try {
    const lista = op.getSheetByName('Lista de Raperos');
    if (lista) {
      const listaData = lista.getDataRange().getValues();
      const avatarMap = {};
      const verMap = {};
      for (let i = 0; i < listaData.length; i++) {
        const name = String(listaData[i][0] || '').trim();   // col A (con bandera)
        if (!name || name === 'Rapero' || name.indexOf('Mostrando') === 0) continue;
        const avatar = String(listaData[i][5] || '').trim(); // col F = Avatar
        const ver    = String(listaData[i][3] || '').trim(); // col D = Verificado
        if (avatar && avatar.indexOf('http') === 0) avatarMap[name] = avatar;
        if (ver) verMap[name] = ver;
      }
      rappers.forEach(r => {
        const av = avatarMap[r.fullName]; if (av) r.avatar = av;
        const v = verMap[r.fullName];
        if (v !== undefined) r.verified = (v === '✅' || v === 'S\u00ed' || v === 'Si') ? 'S\u00ed' : 'No';
      });
    }
  } catch (e) {}

  // ── SERVER / COUNTRY RANKS ──
  const serverGroups = {};
  rappers.forEach(r => { if (!serverGroups[r.sv]) serverGroups[r.sv] = []; serverGroups[r.sv].push(r); });
  Object.values(serverGroups).forEach(group => {
    group.sort((a, b) => b.pts - a.pts);
    group.forEach((r, i) => { r.serverRank = i + 1; });
    group.forEach(r => { r.serverTotal = group.length; });
  });
  const countryGroups = {};
  rappers.forEach(r => { if (!countryGroups[r.flag]) countryGroups[r.flag] = []; countryGroups[r.flag].push(r); });
  Object.values(countryGroups).forEach(group => {
    group.sort((a, b) => b.pts - a.pts);
    group.forEach((r, i) => { r.countryRank = i + 1; });
    group.forEach(r => { r.countryTotal = group.length; });
  });

  // ── LABELS ──
  rappers.forEach(r => {
    r.labels = [];
    const totalServerEvs = Object.values(r.servers).reduce((a, b) => a + b, 0);
    const maxServerEvs = Math.max(...Object.values(r.servers));
    if (totalServerEvs > 0 && maxServerEvs / totalServerEvs >= 0.80) r.labels.push('\ud83c\udfaf Especialista');
    else if (r.activeServers >= 3) r.labels.push('\ud83c\udf10 All-rounder');
    if (r.cazas > 0 && r.cazas > r.cazado) r.labels.push('\ud83c\udff9 Cazador');
    if (r.cazado > 0 && r.cazado > r.cazas) r.labels.push('\ud83c\udfaf Presa');
    if (r.shields > 0 && r.cazado === 0) r.labels.push('\ud83d\udee1\ufe0f Invicto MW');
    if (r.wr >= 50 && r.ev >= 5) r.labels.push('\ud83d\udcc8 Consistente');
    if (r.streakMax >= 5 && r.wr < 40) r.labels.push('\u26a1 Streaky');
    if (r.ev >= 20) r.labels.push('\ud83c\udf96\ufe0f Veterano');
    else if (r.ev <= 5 && r.ev >= 1) r.labels.push('\ud83c\udd95 Rookie');
    if (r.finalsRate >= 50 && r.ev >= 5) r.labels.push('\ud83d\udc51 Finalista');
    if (r.champRate >= 30 && r.ev >= 5) r.labels.push('\ud83c\udfc6 Dominante');
    if (r.ev === 1 && r.gold >= 1) r.labels.push('\ud83d\udca5 Mejor debut');
    if (r.ev >= 10) r.labels.push('\ud83d\udd1f Doble d\u00edgito');
    if (r.pts >= 100000) r.labels.push('\ud83d\udcaf Centenario');
    if (r.activeServers >= 5) r.labels.push('\ud83c\udf0d Trotamundos');
    if (r.streakMax >= 3) r.labels.push('\ud83d\udd25 Back to back');
    if (r.wr >= 80 && r.ev >= 8) r.labels.push('\ud83d\udcaa Imbatible');
    if (r.cazas >= 3) r.labels.push('\ud83d\udc80 Cazarrecompensas');
    if (r.gold >= 5) r.labels.push('\u2b50 Pentacampe\u00f3n');
    if (r.gold >= 10) r.labels.push('\ud83d\udc51 Dinast\u00eda');
    if (r.ev >= 10 && r.gold === 0 && r.silver === 0 && r.bronze === 0) r.labels.push('\ud83d\ude24 Guerrero sin podio');
    if (r.podiumRate >= 80 && r.ev >= 5) r.labels.push('\ud83c\udfaa Showman');
  });

  // ── AVERAGES ──
  const withEvents = rappers.filter(r => r.ev > 0);
  const avgPts = withEvents.length ? Math.round(withEvents.reduce((s, r) => s + r.pts, 0) / withEvents.length) : 0;
  const avgEv = withEvents.length ? Math.round(withEvents.reduce((s, r) => s + r.ev, 0) / withEvents.length * 10) / 10 : 0;
  const avgWR = withEvents.length ? Math.round(withEvents.reduce((s, r) => s + r.wr, 0) / withEvents.length * 10) / 10 : 0;
  const avgWRW = withEvents.length ? Math.round(withEvents.reduce((s, r) => s + r.wrWeighted, 0) / withEvents.length * 10) / 10 : 0;
  const avgEff = withEvents.length ? Math.round(withEvents.reduce((s, r) => s + r.efficiency, 0) / withEvents.length) : 0;
  const avgMedals = withEvents.length ? Math.round(withEvents.reduce((s, r) => s + r.totalMedals, 0) / withEvents.length * 10) / 10 : 0;

  // ── MW TARGETS (estado leído del Lobby) ──
  const mwTargets = mwInfo.targets;
  rappers.forEach(r => {
    const target = mwTargets.find(t => r.name === t.name && (r.flag === t.flag || r.flag === '\u2753'));
    if (target) {
      r.isMWTarget = target.active;     // solo "activo" si sigue sin resolver
      r.mwBounty = target.bounty;
      r.mwCondition = target.condition;
      r.mwStatus = target.status;       // texto: cazado/sobrevivió/activo
    }
  });

  // ── CONTEO DE EVENTOS (Operativo) ──
  let totalEventos = 0;
  try {
    const evSheet = op.getSheetByName('Eventos Procesados');
    if (evSheet) {
      const evData = evSheet.getDataRange().getValues();
      let evHeader = -1;
      for (let i = 0; i < Math.min(15, evData.length); i++) {
        if (String(evData[i][0]).trim() === '#' && String(evData[i][1]).trim() === 'Evento') { evHeader = i; break; }
      }
      if (evHeader !== -1) {
        for (let i = evHeader + 1; i < evData.length; i++) {
          const num = String(evData[i][0] || '').trim();
          if (num !== '' && !isNaN(parseInt(num, 10))) totalEventos++;
        }
      }
    }
  } catch (e) { totalEventos = 0; }

  return {
    rappers: rappers,
    total: totalRappers,
    totalEventos: totalEventos,
    temporada: readTemporada(op),        // ⬅️ NUEVO (v3)
    compEligible: eligible.length,
    averages: { pts: avgPts, ev: avgEv, wr: avgWR, wrw: avgWRW, eff: avgEff, medals: avgMedals },
    mwTargets: mwTargets
  };
}

// ═══ TEMPORADA ACTIVA — se lee de la Consola del Operativo (v3) ═══
// La escribe sync.py (modo backfill) cuando detecta un ||SEASON|...|| en el canal-log.
// Col A = etiqueta · Col B = valor.   Ej:  "Temporada" | "T1 · 🎤"
// Si la fila no existe o está vacía → devuelve '' y el sidebar dice "sin temporada".
// 🔴 NO calcular la temporada por fecha. Dlx la anuncia a mano con -startseason.
function readTemporada(op) {
  try {
    const con = op.getSheetByName('Consola');
    if (!con) return '';
    const data = con.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0] || '').trim().toLowerCase() === 'temporada') {
        return String(data[i][1] || '').trim();
      }
    }
  } catch (e) {}
  return '';
}

// ═══ LEE LA TABLA MW DEL LOBBY ═══
// ═══ LEE LA TABLA MW DEL LOBBY (formato empaquetado S4-5+) ═══
// Devuelve { ptsMap:{hunter:ptsExcluir}, targets:[{name,flag,bounty,condition,status,active}] }
function readMWFromLobby(ss) {
  const out = { ptsMap: {}, targets: [] };
  try {
    const lob = ss.getSheetByName('Lobby');
    if (!lob) return out;
    const data = lob.getDataRange().getValues();

    // 1) localizar el bloque: fila en col B que contenga "MOST WANTED"
    let start = -1;
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][1] || '').toUpperCase().indexOf('MOST WANTED') !== -1) { start = i; break; }
    }
    if (start === -1) return out;

    // 2) recorrer las filas del bloque hasta el historial (línea "S1:"/"S4-5:") 
    for (let i = start + 1; i < Math.min(start + 9, data.length); i++) {
      const line = String(data[i][1] || '').trim();
      if (!line) continue;
      if (/^S\d/.test(line) && line.indexOf('\u2190') === -1) break; // historial → fin

      // — Sobrevivientes: "🛡️ SOBREVIVIERON (4): Sombra 🇵🇷 +7.5K · Rodas 🇵🇷 +4K · ..."
      if (line.toUpperCase().indexOf('SOBREVIV') !== -1) {
        const body = line.indexOf(':') !== -1 ? line.slice(line.indexOf(':') + 1) : line;
        body.split('\u00B7').forEach(seg => {              // separa por "·"
          seg = seg.trim();
          const m = seg.match(/^(.+?)\s*\+([\d.]+)\s*K/i);
          if (m) {
            const nm = mwStripFlag(m[1]);
            const pts = Math.round(parseFloat(m[2]) * 1000);
            if (nm) {
              out.ptsMap[nm] = (out.ptsMap[nm] || 0) + pts;
              out.targets.push({ name: nm, flag: mwGetFlag(m[1]), bounty: pts * 2,
                                 condition: '', status: '🛡️ Sobrevivió', active: false });
            }
          }
        });
        continue;
      }

      // — Cazados: "💀 Juanpa 18K ← Bloody+Colesito · Abyssus 15K ← Deuxs · ..."
      if (line.indexOf('\u2190') !== -1) {                 // contiene "←"
        line.split('\u00B7').forEach(seg => {              // separa por "·"
          seg = seg.trim();
          const arrow = seg.indexOf('\u2190');
          if (arrow === -1) return;
          const left = seg.slice(0, arrow).replace(/^[^A-Za-z0-9]*/, '').trim(); // "Juanpa 18K"
          const huntersRaw = seg.slice(arrow + 1).trim();                        // "Bloody+Colesito"
          const lm = left.match(/^(.+?)\s+([\d.]+)\s*K$/i);
          if (!lm) return;
          const tName = mwStripFlag(lm[1]);
          const bounty = Math.round(parseFloat(lm[2]) * 1000);
          if (tName) out.targets.push({ name: tName, flag: mwGetFlag(lm[1]), bounty: bounty,
                                        condition: '', status: '💀 Cazado', active: false });
          const hunters = huntersRaw.split('+').map(s => mwStripFlag(s)).filter(Boolean);
          if (hunters.length) {
            const share = Math.floor(bounty / hunters.length);
            hunters.forEach(h => { out.ptsMap[h] = (out.ptsMap[h] || 0) + share; });
          }
        });
      }
    }
  } catch (e) {}
  return out;
}

// — quita banderas (indicadores regionales) y ❓ de un nombre
function mwStripFlag(s) {
  if (!s) return '';
  let out = '';
  for (let i = 0; i < s.length; ) {
    const cp = s.codePointAt(i); const sz = cp > 0xFFFF ? 2 : 1;
    if ((cp >= 0x1F1E6 && cp <= 0x1F1FF) || cp === 0x2753) { i += sz; continue; }
    out += String.fromCodePoint(cp); i += sz;
  }
  return out.trim();
}

// — extrae la bandera de un nombre (o ❓ si no tiene)
function mwGetFlag(s) {
  if (!s) return '❓';
  for (let i = 0; i < s.length; ) {
    const cp = s.codePointAt(i); const sz = cp > 0xFFFF ? 2 : 1;
    if (cp >= 0x1F1E6 && cp <= 0x1F1FF) {
      const cp2 = s.codePointAt(i + sz);
      if (cp2 >= 0x1F1E6 && cp2 <= 0x1F1FF) return String.fromCodePoint(cp, cp2);
    }
    i += sz;
  }
  return '❓';
}

// ═══ HELPERS ═══
function parseNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  const s = String(v).replace(/,/g, '').replace('%', '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function computeEntropy(servers) {
  const vals = Object.values(servers).filter(v => v > 0);
  if (vals.length <= 1) return 0;
  const total = vals.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const probs = vals.map(v => v / total);
  const entropy = -probs.reduce((s, p) => s + (p > 0 ? p * Math.log2(p) : 0), 0);
  const TOTAL_SERVERS = 7;
  const maxEntropy = Math.log2(TOTAL_SERVERS);
  return maxEntropy > 0 ? entropy / maxEntropy : 0;
}