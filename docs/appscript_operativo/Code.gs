// ═══════════════════════════════════════════════════════════════
// LIGA GLOBAL — Apps Script v1.2
// Sheet Operativo: 1DFar2NSlC9YvkMQ_uKzLmfOrmthJ1lp-l3exP0NFHm8
// v1.2: Procesar ahora escribe en los logs Resultados + 1v1 (idempotente)
// ═══════════════════════════════════════════════════════════════

// ═══ CONFIGURACIÓN ═══
const SHEET_NAMES = {
  entrada: 'Entrada',
  pendientes: 'Pendientes',
  raperos: 'Lista de Raperos',
  akas: 'AKAs',
  eventos: 'Eventos Procesados',
  anuncios: 'Anuncios',
  config: 'Config',
  log: 'Log',
  consola: 'Consola',
  resultados: 'Resultados',
  unovuno: '1v1'
};

const ENT_START_COL = 3;
const ENT_START_ROW = 2;
const EVT_START_COL = 1;
const EVT_START_ROW_EP = 6;
const LOG_DATA_ROW = 4; // Resultados + 1v1: headers fila 3, datos desde fila 4

// ═══════════════════════════════════════════════════════════════
// MENÚ PERSONALIZADO
// ═══════════════════════════════════════════════════════════════
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⚡ Liga Global')
    .addItem('✅ Verificar evento', 'verificarEvento')
    .addItem('🚀 Procesar evento', 'procesarEvento')
    .addItem('🧹 Limpiar entrada', 'limpiarEntrada')
    .addSeparator()
    .addItem('📊 Recalcular totales', 'recalcularTotales')
    .addItem('📋 Exportar a Público', 'syncPublico')
    .addToUi();
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function getUsuario() {
  const email = Session.getActiveUser().getEmail();
  const map = {
    'underlegendscontacto@gmail.com': 'Dlx',
    'underraponline@gmail.com': 'Dlx',
    'liga-global-bot@liga-global.iam.gserviceaccount.com': 'Sistema'
  };
  return map[email] || email;
}

function logAccion(origen, accion, detalle) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ws = ss.getSheetByName(SHEET_NAMES.log);
  const fecha = Utilities.formatDate(new Date(), 'America/Lima', 'dd/MM HH:mm');
  const usuario = getUsuario();
  ws.insertRowAfter(1);
  ws.getRange(2, 1, 1, 5).setValues([[fecha, origen, accion, detalle, usuario]]);
  ws.getRange(2, 1, 1, 5).setFontWeight('bold');
}

// ═══════════════════════════════════════════════════════════════
// LEER CONFIG
// ═══════════════════════════════════════════════════════════════

function leerTablaPuntos() {
  const ws = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.config);
  const tablas = {};
  tablas['16+'] = {};
  const data16 = ws.getRange('A7:B14').getValues();
  for (const row of data16) {
    if (row[0] && row[1]) tablas['16+'][normPos(row[0])] = Number(row[1]);
  }
  tablas['8-15'] = {};
  const data8 = ws.getRange('C7:D12').getValues();
  for (const row of data8) {
    if (row[0] && row[1]) tablas['8-15'][normPos(row[0])] = Number(row[1]);
  }
  tablas['4-7'] = {};
  const data4 = ws.getRange('A18:B23').getValues();
  for (const row of data4) {
    if (row[0] && row[1]) tablas['4-7'][normPos(row[0])] = Number(row[1]);
  }
  return tablas;
}

function normPos(pos) {
  return pos.toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function getEscala(participantes) {
  if (participantes >= 16) return '16+';
  if (participantes >= 8) return '8-15';
  if (participantes >= 4) return '4-7';
  return null;
}

function leerModificadores() {
  const ws = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.config);
  return {
    walkin: {
      0: parsePct(ws.getRange('G7').getValue()),
      1: parsePct(ws.getRange('G8').getValue()),
      2: parsePct(ws.getRange('G9').getValue()),
      3: 0
    },
    revivido: parsePct(ws.getRange('G12').getValue()),
    invitado: parsePct(ws.getRange('G14').getValue()),
  };
}

function parsePct(val) {
  if (!val) return 0;
  return parseFloat(val.toString().replace('%', '')) / 100;
}

function leerMW() {
  const ws = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.config);
  const mw = [];
  const data = ws.getRange('J6:M10').getValues();
  for (const row of data) {
    if (row[0] && row[0].toString().trim()) {
      mw.push({
        nombre: row[0].toString().trim(),
        bounty: Number(row[1]) || 0,
        condicion: (row[2] || '').toString().trim(),
        estado: (row[3] || 'Activo').toString().trim()
      });
    }
  }
  return mw;
}

function leerAliases() {
  const ws = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.akas);
  const data = ws.getRange('A2:B100').getValues();
  const aliases = {};
  for (const row of data) {
    if (row[0] && row[1]) {
      aliases[row[0].toString().toLowerCase().trim()] = row[1].toString().trim();
    }
  }
  return aliases;
}

function leerRaperos() {
  const ws = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.raperos);
  const data = ws.getRange('A5:A500').getValues();
  const raperos = new Set();
  for (const row of data) {
    if (row[0] && row[0].toString().trim()) {
      const full = row[0].toString().trim();
      raperos.add(full);
      const parts = full.split(' ');
      if (parts.length > 1) {
        raperos.add(parts.slice(0, -1).join(' '));
      }
    }
  }
  return raperos;
}

function resolverNombre(nombre, aliases, raperos) {
  if (!nombre || !nombre.trim()) return { nombre: '', status: 'empty' };
  const n = nombre.trim();
  const nLower = n.toLowerCase();
  if (aliases[nLower]) return { nombre: aliases[nLower], status: 'alias' };
  if (raperos.has(n)) return { nombre: n, status: 'found' };
  for (const r of raperos) {
    if (r.startsWith(n + ' ')) return { nombre: r, status: 'found' };
  }
  for (const r of raperos) {
    if (r.toLowerCase().startsWith(nLower + ' ') || r.toLowerCase() === nLower) {
      return { nombre: r, status: 'found' };
    }
  }
  return { nombre: n, status: 'unknown' };
}

function parseEquipo(nombre) {
  if (!nombre) return [];
  return nombre.split(',').map(n => n.trim()).filter(n => n);
}

function esEquipo(ladoA) {
  return ladoA.includes(',');
}

// ═══════════════════════════════════════════════════════════════
// LEER ENTRADA
// ═══════════════════════════════════════════════════════════════

function leerEntrada() {
  const ws = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.entrada);
  const lastRow = ws.getLastRow();
  if (lastRow < ENT_START_ROW) return [];
  const data = ws.getRange(ENT_START_ROW, ENT_START_COL, lastRow - ENT_START_ROW + 1, 9).getValues();
  const batallas = [];
  for (const row of data) {
    if (!row[0] || !row[0].toString().trim()) continue;
    batallas.push({
      evento: row[0].toString().trim(),
      servidor: row[1].toString().trim(),
      fecha: row[2].toString().trim(),
      participantes: Number(row[3]) || 0,
      ronda: row[4].toString().trim(),
      ladoA: row[5].toString().trim(),
      ladoB: row[6].toString().trim(),
      ganador: row[7].toString().trim(),
      notas: row[8] ? row[8].toString().trim() : ''
    });
  }
  return batallas;
}

function agruparPorEvento(batallas) {
  const eventos = {};
  for (const b of batallas) {
    const key = `${b.evento}|${b.servidor}|${b.fecha}`;
    if (!eventos[key]) {
      eventos[key] = {
        evento: b.evento, servidor: b.servidor, fecha: b.fecha,
        participantes: b.participantes, batallas: []
      };
    }
    eventos[key].batallas.push(b);
  }
  return Object.values(eventos);
}

// ═══════════════════════════════════════════════════════════════
// CALCULAR POSICIONES Y PUNTOS
// ═══════════════════════════════════════════════════════════════

function calcularPuntos(evento, tablas, mods, aliases, raperos) {
  const batallas = evento.batallas;
  const escala = getEscala(evento.participantes);
  if (!escala) return null;
  const puntos = tablas[escala];
  const resultados = {};

  function addPuntos(nombre, pts, posicion, notas) {
    const miembros = parseEquipo(nombre);
    if (miembros.length > 1) {
      const share = Math.floor(pts / miembros.length);
      for (const m of miembros) {
        const resuelto = resolverNombre(m, aliases, raperos).nombre;
        if (!resultados[resuelto]) resultados[resuelto] = { puntos: 0, posicion: '', notas: '' };
        resultados[resuelto].puntos += share;
        resultados[resuelto].posicion = posicion;
        if (notas) resultados[resuelto].notas += notas + ' ';
      }
    } else {
      const resuelto = resolverNombre(nombre, aliases, raperos).nombre;
      if (!resultados[resuelto]) resultados[resuelto] = { puntos: 0, posicion: '', notas: '' };
      resultados[resuelto].puntos += pts;
      resultados[resuelto].posicion = posicion;
      if (notas) resultados[resuelto].notas += notas + ' ';
    }
  }

  const final = batallas.find(b => normPos(b.ronda) === 'final');
  const tercerPuesto = batallas.find(b => normPos(b.ronda) === 'tercer puesto');
  const semis = batallas.filter(b => normPos(b.ronda) === 'semifinal');
  const cuartos = batallas.filter(b => normPos(b.ronda) === 'cuartos');
  const octavos = batallas.filter(b => normPos(b.ronda) === 'octavos');
  const r32 = batallas.filter(b => normPos(b.ronda) === 'r32');

  if (final) {
    addPuntos(final.ganador, puntos['campeon'] || 0, 'campeon', '');
    const sub = final.ladoA === final.ganador ? final.ladoB : final.ladoA;
    addPuntos(sub, puntos['subcampeon'] || 0, 'subcampeon', '');
  }

  if (tercerPuesto) {
    addPuntos(tercerPuesto.ganador, puntos['tercero'] || 0, 'tercero', '');
    const cuarto = tercerPuesto.ladoA === tercerPuesto.ganador ? tercerPuesto.ladoB : tercerPuesto.ladoA;
    addPuntos(cuarto, puntos['cuarto'] || 0, 'cuarto', '');
  } else if (semis.length >= 2) {
    const promedio = Math.floor(((puntos['tercero'] || 0) + (puntos['cuarto'] || 0)) / 2);
    for (const sf of semis) {
      const perdedor = sf.ladoA === sf.ganador ? sf.ladoB : sf.ladoA;
      addPuntos(perdedor, promedio, 'semifinal', '');
    }
  }

  for (const qf of cuartos) {
    const perdedor = qf.ladoA === qf.ganador ? qf.ladoB : qf.ladoA;
    const resuelto = resolverNombre(parseEquipo(perdedor)[0] || perdedor, aliases, raperos).nombre;
    if (!resultados[resuelto]) {
      addPuntos(perdedor, puntos['cuartos'] || 0, 'cuartos', '');
    }
  }

  for (const r16 of octavos) {
    const perdedor = r16.ladoA === r16.ganador ? r16.ladoB : r16.ladoA;
    const resuelto = resolverNombre(parseEquipo(perdedor)[0] || perdedor, aliases, raperos).nombre;
    if (!resultados[resuelto]) {
      addPuntos(perdedor, puntos['octavos'] || 0, 'octavos', '');
    }
  }

  for (const r of r32) {
    const perdedor = r.ladoA === r.ganador ? r.ladoB : r.ladoA;
    const resuelto = resolverNombre(parseEquipo(perdedor)[0] || perdedor, aliases, raperos).nombre;
    if (!resultados[resuelto]) {
      addPuntos(perdedor, puntos['r32'] || 0, 'r32', '');
    }
  }

  for (const b of batallas) {
    if (!b.notas) continue;
    const notasLower = b.notas.toLowerCase();
    if (notasLower.includes('revivido')) {
      const nombres = [b.ladoA, b.ladoB];
      for (const n of nombres) {
        const resuelto = resolverNombre(n, aliases, raperos).nombre;
        if (resultados[resuelto]) {
          resultados[resuelto].puntos = Math.floor(resultados[resuelto].puntos * mods.revivido);
          resultados[resuelto].notas += '(R) ';
        }
      }
    }
    if (notasLower.includes('walk-in')) {
      const match = notasLower.match(/walk-in\s+(\d+)/);
      if (match) {
        const rondas = Math.min(parseInt(match[1]), 3);
        const pct = mods.walkin[rondas] || 0;
        for (const n of [b.ladoA, b.ladoB]) {
          const resuelto = resolverNombre(n, aliases, raperos).nombre;
          if (resultados[resuelto]) {
            resultados[resuelto].puntos = Math.floor(resultados[resuelto].puntos * pct);
            resultados[resuelto].notas += `Walk-in ${rondas} `;
          }
        }
      }
    }
  }

  return resultados;
}

// ═══════════════════════════════════════════════════════════════
// VERIFICAR EVENTO
// ═══════════════════════════════════════════════════════════════

function verificarEvento() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert('✅ Verificar evento',
    '¿Verificar los nombres pegados en Entrada?',
    ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;

  const batallas = leerEntrada();
  if (batallas.length === 0) {
    ui.alert('⚠️ No hay datos en Entrada.\nPega la tabla de batallas primero.');
    return;
  }

  const aliases = leerAliases();
  const raperos = leerRaperos();

  let desconocidos = 0;
  let aliasResueltos = 0;
  let encontrados = 0;
  const problemas = [];
  const nombresVistos = new Set();

  for (let i = 0; i < batallas.length; i++) {
    const b = batallas[i];
    const rowNum = i + ENT_START_ROW;
    for (const campo of ['ladoA', 'ladoB', 'ganador']) {
      const nombres = parseEquipo(b[campo]);
      for (const nombre of nombres) {
        if (!nombre || nombresVistos.has(nombre.toLowerCase())) continue;
        nombresVistos.add(nombre.toLowerCase());
        const result = resolverNombre(nombre, aliases, raperos);
        if (result.status === 'unknown') {
          desconocidos++;
          problemas.push({ fila: rowNum, nombre: nombre, evento: b.evento });
        } else if (result.status === 'alias') {
          aliasResueltos++;
        } else {
          encontrados++;
        }
      }
    }
    if (b.ganador && !b.ganador.includes(b.ladoA.split(',')[0]) &&
        !b.ladoA.includes(b.ganador.split(',')[0]) &&
        !b.ganador.includes(b.ladoB.split(',')[0]) &&
        !b.ladoB.includes(b.ganador.split(',')[0])) {
      problemas.push({ fila: rowNum, nombre: `Ganador "${b.ganador}" no coincide con Lado A/B`, evento: b.evento });
    }
  }

  const eventos = agruparPorEvento(batallas);
  for (const ev of eventos) {
    if (ev.participantes < 4) {
      problemas.push({ fila: 0, nombre: `${ev.evento}: menos de 4 participantes`, evento: ev.evento });
    }
  }

  if (desconocidos > 0) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const wsPend = ss.getSheetByName(SHEET_NAMES.pendientes);
    let pendNum = wsPend.getLastRow();
    for (const p of problemas) {
      if (p.nombre && !p.nombre.includes('menos de') && !p.nombre.includes('Ganador')) {
        pendNum++;
        let posible = '';
        for (const r of raperos) {
          if (r.toLowerCase().includes(p.nombre.toLowerCase().substring(0, 3))) {
            posible = '¿' + r + '?';
            break;
          }
        }
        wsPend.insertRowAfter(1);
        wsPend.getRange(2, 1, 1, 8).setValues([[pendNum, 'Nombre desconocido', p.evento, p.nombre + ' en batalla', posible, 'Pendiente', '', '']]);
        wsPend.getRange(2, 1, 1, 8).setFontWeight('bold');
      }
    }
  }

  let msg = '📊 Verificación completada\n\n';
  msg += 'Eventos: ' + eventos.length + '\n';
  msg += 'Batallas: ' + batallas.length + '\n';
  msg += 'Nombres encontrados: ' + encontrados + '\n';
  msg += 'Aliases resueltos: ' + aliasResueltos + '\n';
  msg += 'Desconocidos: ' + desconocidos + '\n';
  if (problemas.length > 0) {
    msg += '\n⚠️ Problemas (' + problemas.length + '):\n';
    for (let i = 0; i < Math.min(problemas.length, 10); i++) {
      msg += '• ' + problemas[i].nombre + '\n';
    }
    if (problemas.length > 10) msg += '... y ' + (problemas.length - 10) + ' más\n';
    msg += '\nDesconocidos enviados a Pendientes.';
  } else {
    msg += '\n✅ Todo listo para procesar.';
  }

  SpreadsheetApp.getUi().alert(msg);
  logAccion('Apps Script', 'Verificación', eventos.length + ' eventos, ' + desconocidos + ' desconocidos');
}

// ═══════════════════════════════════════════════════════════════
// PROCESAR EVENTO
// ═══════════════════════════════════════════════════════════════

function procesarEvento() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const batallas = leerEntrada();
  if (batallas.length === 0) {
    ui.alert('⚠️ No hay datos en Entrada.');
    return;
  }

  const resp = ui.alert('🚀 Procesar evento',
    'Se encontraron ' + batallas.length + ' batallas. ¿Procesar?',
    ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;

  const aliases = leerAliases();
  const raperos = leerRaperos();
  const tablas = leerTablaPuntos();
  const mods = leerModificadores();
  const mwActivos = leerMW();

  const eventos = agruparPorEvento(batallas);
  const wsConfig = ss.getSheetByName(SHEET_NAMES.config);
  const wsEventos = ss.getSheetByName(SHEET_NAMES.eventos);

  let ultimoEvento = parseInt(wsConfig.getRange('B27').getValue().toString().replace('#', '')) || 123;

  let eventosOk = 0;
  let eventosNo = 0;

  for (const evento of eventos) {
    ultimoEvento++;
    const escala = getEscala(evento.participantes);

    if (!escala) {
      const lastRow = wsEventos.getLastRow() + 1;
      wsEventos.getRange(lastRow, EVT_START_COL, 1, 11).setValues([[
        ultimoEvento, evento.evento, evento.servidor, evento.fecha,
        evento.participantes, '', '❌', 'Menos de 4 participantes', '', '', ''
      ]]);
      eventosNo++;
      logAccion('Apps Script', 'Evento descartado', '#' + ultimoEvento + ' ' + evento.evento);
      continue;
    }

    const resultados = calcularPuntos(evento, tablas, mods, aliases, raperos);
    if (!resultados) {
      eventosNo++;
      continue;
    }

    let mwCazado = '';
    let mwCazador = '';
    let mwBounty = 0;

    for (const mw of mwActivos) {
      if (mw.estado !== 'Activo') continue;
      const mwNombreBase = mw.nombre.split(' ')[0];
      for (const b of evento.batallas) {
        if (normPos(b.ronda) !== 'final' && normPos(b.ronda) !== 'semifinal' &&
            normPos(b.ronda) !== 'cuartos' && normPos(b.ronda) !== 'octavos') continue;
        const ganador = resolverNombre(b.ganador, aliases, raperos).nombre;
        const ladoA = resolverNombre(b.ladoA, aliases, raperos).nombre;
        const ladoB = resolverNombre(b.ladoB, aliases, raperos).nombre;
        const perdedor = ladoA === ganador ? ladoB : ladoA;
        if (perdedor.includes(mwNombreBase)) {
          let ok = true;
          if (mw.condicion === 'Solo en TWR' && evento.servidor !== 'TWR') ok = false;
          if (mw.condicion === 'Fuera de TWR' && evento.servidor === 'TWR') ok = false;
          if (mw.condicion === 'Solo (no equipo)' && esEquipo(b.ladoA)) ok = false;
          if (mw.condicion.includes('Solo en TFC o FRZ') &&
              evento.servidor !== 'TFC' && evento.servidor !== 'FRZ') ok = false;
          if (ok) {
            mwCazado = mw.nombre;
            mwCazador = ganador;
            mwBounty = mw.bounty;
            if (resultados[ganador]) {
              resultados[ganador].puntos += mw.bounty;
            }
            break;
          }
        }
      }
      if (mwCazado) break;
    }

    const lastRow = wsEventos.getLastRow() + 1;
    wsEventos.getRange(lastRow, EVT_START_COL, 1, 11).setValues([[
      ultimoEvento, evento.evento, evento.servidor, evento.fecha,
      evento.participantes, escala, '✅', '', mwCazado, mwCazador, mwBounty || ''
    ]]);

    // Escribir resultados y 1v1 en los logs (idempotente)
    escribirLogs(evento, ultimoEvento, resultados, escala, mwCazador, mwBounty, aliases, raperos);

    eventosOk++;
    logAccion('Apps Script', 'Evento procesado',
      '#' + ultimoEvento + ' ' + evento.evento + ' (' + evento.servidor + ', ' + evento.participantes + ' part.)');

    if (mwCazado) {
      logAccion('Apps Script', 'MW cazado',
        mwCazado + ' cazado por ' + mwCazador + ' (+' + mwBounty + ' pts)');
    }
  }

  wsConfig.getRange('B27').setValue('#' + ultimoEvento);
  wsConfig.getRange('B28').setValue('#' + (ultimoEvento + 1));

  limpiarEntrada(true);

  ui.alert('✅ Procesado: ' + eventosOk + ' evento(s) OK, ' + eventosNo + ' descartado(s).\nÚltimo evento: #' + ultimoEvento);
}

// ═══════════════════════════════════════════════════════════════
// ESCRIBIR LOGS — Resultados + 1v1 (idempotente)
// ═══════════════════════════════════════════════════════════════

/**
 * Construye un mapa nombre→"🏳️ País" desde Lista de Raperos.
 */
function construirMapaPais() {
  const ws = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.raperos);
  const data = ws.getRange('A10:B500').getValues();
  const mapa = {};
  const reEmoji = /([\u{1F1E6}-\u{1F1FF}]{2}|\u{2753})\s*$/u;
  for (const row of data) {
    const full = (row[0] || '').toString().trim();
    const pais = (row[1] || '').toString().trim();
    if (!full) continue;
    const match = full.match(reEmoji);
    const bandera = match ? match[1].trim() : '';
    const valor = (bandera && pais) ? (bandera + ' ' + pais) : (bandera || pais || '');
    mapa[full] = valor;
    const sinBandera = full.replace(reEmoji, '').trim();
    if (sinBandera && !(sinBandera in mapa)) mapa[sinBandera] = valor;
  }
  return mapa;
}

/**
 * Borra filas de un log cuyo Evento# (col A) == num. Reescribe sobrevivientes.
 */
function borrarFilasPorNum_(ws, num, primeraFilaDatos) {
  const lastRow = ws.getLastRow();
  if (lastRow < primeraFilaDatos) return 0;
  const numRows = lastRow - primeraFilaDatos + 1;
  const maxCol = ws.getLastColumn();
  const data = ws.getRange(primeraFilaDatos, 1, numRows, maxCol).getValues();
  const sobreviven = [];
  let borradas = 0;
  for (const row of data) {
    if (String(row[0]).trim() === String(num).trim()) {
      borradas++;
    } else if (row.some(c => c !== '' && c !== null)) {
      sobreviven.push(row);
    }
  }
  if (borradas === 0) return 0;
  ws.getRange(primeraFilaDatos, 1, numRows, maxCol).clearContent();
  if (sobreviven.length > 0) {
    ws.getRange(primeraFilaDatos, 1, sobreviven.length, maxCol).setValues(sobreviven);
  }
  return borradas;
}

/**
 * Escribe los resultados de un evento en Resultados + 1v1.
 * Idempotente: si el evento ya existe (mismo nombre+servidor+fecha en
 * Eventos Procesados), borra sus filas viejas en los logs antes de escribir.
 */
function escribirLogs(evento, numEv, resultados, escala, mwCazadorName, mwBounty, aliases, raperos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsRes = ss.getSheetByName(SHEET_NAMES.resultados);
  const wsUno = ss.getSheetByName(SHEET_NAMES.unovuno);

  // --- Idempotencia: buscar # viejo de este evento y borrar sus filas ---
  const wsEv = ss.getSheetByName(SHEET_NAMES.eventos);
  const evLast = wsEv.getLastRow();
  if (evLast >= EVT_START_ROW_EP) {
    const evData = wsEv.getRange(EVT_START_ROW_EP, 1, evLast - EVT_START_ROW_EP + 1, 4).getValues();
    for (const r of evData) {
      const num = r[0];
      const nom = (r[1] || '').toString().trim();
      const sv = (r[2] || '').toString().trim();
      const fe = (r[3] || '').toString().trim();
      if (nom === evento.evento && sv === evento.servidor && fe === evento.fecha &&
          String(num).trim() !== String(numEv).trim()) {
        borrarFilasPorNum_(wsRes, num, LOG_DATA_ROW);
        borrarFilasPorNum_(wsUno, num, LOG_DATA_ROW);
      }
    }
  }

  const mapaPais = construirMapaPais();

  // --- Escribir Resultados ---
  const filasRes = [];
  for (const nombre in resultados) {
    if (!nombre) continue;
    const d = resultados[nombre];
    const mwPts = (nombre === mwCazadorName) ? (mwBounty || 0) : 0;
    const puntos = d.puntos || 0;
    const sinMW = puntos - mwPts;
    const pais = mapaPais[nombre] || '';
    filasRes.push([numEv, evento.fecha, evento.servidor, escala, nombre, pais,
                   d.posicion || '', puntos, mwPts || '', sinMW, (d.notas || '').trim()]);
  }
  if (filasRes.length > 0) {
    const start = Math.max(wsRes.getLastRow() + 1, LOG_DATA_ROW);
    wsRes.getRange(start, 1, filasRes.length, 11).setValues(filasRes);
  }

  // --- Escribir 1v1 (solo batallas 1v1 limpias) ---
  const filasUno = [];
  for (const b of evento.batallas) {
    if (b.ladoA.includes(',') || b.ladoB.includes(',')) continue;
    if ((b.notas || '').toLowerCase().includes('triple')) continue;
    if (!b.ladoA || !b.ladoB) continue;
    const A = resolverNombre(b.ladoA, aliases, raperos).nombre;
    const B = resolverNombre(b.ladoB, aliases, raperos).nombre;
    const G = resolverNombre(b.ganador, aliases, raperos).nombre;
    const P = (G === A) ? B : A;
    filasUno.push([numEv, evento.fecha, evento.servidor, b.ronda, A, B, G, P, (b.notas || '').trim()]);
  }
  if (filasUno.length > 0) {
    const start = Math.max(wsUno.getLastRow() + 1, LOG_DATA_ROW);
    wsUno.getRange(start, 1, filasUno.length, 9).setValues(filasUno);
  }

  logAccion('Apps Script', 'Logs escritos',
    '#' + numEv + ' ' + evento.evento + ' → ' + filasRes.length + ' resultados, ' + filasUno.length + ' 1v1');
}

// ═══════════════════════════════════════════════════════════════
// LIMPIAR ENTRADA
// ═══════════════════════════════════════════════════════════════

function limpiarEntrada(skipConfirm) {
  if (!skipConfirm) {
    const ui = SpreadsheetApp.getUi();
    const resp = ui.alert('🧹 Limpiar entrada',
      '¿Borrar todos los datos pegados en Entrada?',
      ui.ButtonSet.YES_NO);
    if (resp !== ui.Button.YES) return;
  }
  const ws = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.entrada);
  const lastRow = ws.getLastRow();
  if (lastRow >= ENT_START_ROW) {
    ws.getRange(ENT_START_ROW, ENT_START_COL, lastRow - ENT_START_ROW + 1, 9).clearContent();
  }
  logAccion('Apps Script', 'Entrada limpiada', 'Datos borrados');
}

// ═══════════════════════════════════════════════════════════════
// EXPIRAR ANUNCIOS
// ═══════════════════════════════════════════════════════════════

function expirarAnuncios() {
  const ws = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.anuncios);
  const hoy = new Date();
  const lastRow = ws.getLastRow();
  if (lastRow < 2) return;
  const data = ws.getRange(2, 1, lastRow - 1, 8).getValues();
  let eliminados = 0;
  for (let i = data.length - 1; i >= 0; i--) {
    const fechaExpira = data[i][6];
    const estado = data[i][7];
    let borrar = false;
    if (estado === 'Expirado') borrar = true;
    if (estado === 'Activo' && fechaExpira) {
      let fechaObj;
      if (fechaExpira instanceof Date) {
        fechaObj = fechaExpira;
      } else {
        const parts = fechaExpira.toString().split('/');
        if (parts.length >= 2) {
          fechaObj = new Date(2026, parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
      }
      if (fechaObj && fechaObj < hoy) borrar = true;
    }
    if (borrar) {
      ws.deleteRow(i + 2);
      eliminados++;
    }
  }
  if (eliminados > 0) {
    logAccion('Sistema', 'Anuncios limpiados', eliminados + ' anuncio(s) expirados eliminados');
  }
}

// ═══════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════

function recalcularTotales() {
  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert('✅ Totales recalculados.');
}

function syncPublico() {
  SpreadsheetApp.getUi().alert('⚠️ Sync a Público pendiente.\nSe implementa cuando el Sheet Público esté construido.');
  logAccion('Apps Script', 'Sync Público', 'Pendiente');
}

// ═══════════════════════════════════════════════════════════════
// TRIGGERS
// ═══════════════════════════════════════════════════════════════

function triggerDiario() {
  expirarAnuncios();
  logAccion('Sistema', 'Trigger diario', 'Ejecutado');
  const ws = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.consola);
  ws.getRange('B12').setValue(Utilities.formatDate(new Date(), 'America/Lima', 'dd/MM/yyyy HH:mm'));
}

function triggerSemanalPublico() {
  syncPublico();
  const ws = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.consola);
  ws.getRange('B12').setValue(Utilities.formatDate(new Date(), 'America/Lima', 'dd/MM/yyyy HH:mm'));
}

// ═══════════════════════════════════════════════════════════════
// onEdit — BUSCADOR DINÁMICO
// ═══════════════════════════════════════════════════════════════

function onEdit(e) {
  if (!e) return;
  const sheet = e.source.getActiveSheet();
  const cell = e.range;
  const sheetName = sheet.getName();

  if (sheetName === 'Lista de Raperos' && cell.getRow() === 1 && cell.getColumn() === 2) {
    const busqueda = cell.getValue().toString().trim();
    if (busqueda === '') {
      sheet.hideRows(3, 6);
    } else {
      const resultados = sheet.getRange('A3:A7').getValues();
      let count = 0;
      for (let i = 0; i < resultados.length; i++) {
        if (resultados[i][0] && resultados[i][0].toString().trim() !== '') {
          count++;
        }
      }
      if (count === 0) {
        sheet.hideRows(3, 6);
      } else {
        sheet.showRows(3, 6);
        if (count < 5) {
          sheet.hideRows(3 + count, 5 - count);
        }
      }
    }
  }

  if (sheetName === 'Eventos Procesados' && cell.getColumn() === 3 && (cell.getRow() === 2 || cell.getRow() === 3)) {
    filtrarEventos_(sheet);
  }
}

function filtrarEventos_(sheet) {
  const filtroServidor = sheet.getRange('C2').getValue().toString().trim();
  const filtroStatus = sheet.getRange('C3').getValue().toString().trim();
  const lastRow = sheet.getLastRow();
  if (lastRow < 6) return;
  const dataRows = lastRow - 5;
  const servidores = sheet.getRange(6, 3, dataRows, 1).getValues();
  const statuses = sheet.getRange(6, 7, dataRows, 1).getValues();
  sheet.showRows(6, dataRows);
  for (let i = 0; i < servidores.length; i++) {
    const srv = servidores[i][0].toString().trim();
    const st = statuses[i][0].toString().trim();
    const row = i + 6;
    if (!srv && !st) continue;
    let hide = false;
    if (filtroServidor !== 'Todos' && srv !== filtroServidor) hide = true;
    if (filtroStatus !== 'Todos' && st !== filtroStatus) hide = true;
    if (hide) {
      sheet.hideRows(row);
    }
  }
}