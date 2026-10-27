/* ═════════════════════════════════════════════════════════════════════
   LOS DATOS: el lobby (`D`), lo en vivo (`VIVO`, `VIVO_L`, `VIVO_B`, el
   sondeo de `/api/avisos/vivo`, `llaveDeEvento`, `conVeredictos`), los
   perfiles, quién es quién (`kDe`, `normNombre`, `kVivo`), el muro, el
   changelog, las horas de ayuda y el refresco de cada 5 minutos. Salió de
   app.js el 13/10/2026 (la tanda 3 de sacarlo; Dlx, a las ideas: «me
   gustan todas»), cortado tal cual. Se carga DESPUÉS de comun, cuenta,
   tienda y social y ANTES de nucleo.js (lo que quedó de app.js, que se
   fue el 27/10/2026: la tanda 4).
   ⚠️ Llama a `pintaVivo`, `pintaMuro`, `puntoCambios`, `pintaDatos` y
   `nombreSv`, de nucleo.js: sólo cuando corre, y para entonces ya cargó.
   Por eso el ARRANQUE —`pinta()` y el primer `fetch('/api/lobby')`— vive
   al final de nucleo.js: acá podría contestar antes de que termine de bajar.
   (Las llaves viejas a pedido, `llaveVieja()`, se fueron con app.js: las
   pide la página de la llave, web/src/llave.jsx.)
   ⚠️ Y todo con `var` y `function`, nunca `let`/`const`: React reemplaza
   `window.pintaVivo` y compañía (`envolver()` de App.jsx), y lee `D`,
   `VIVO_L`, `PERF`, `CAMBIOS`, `llaveDeEvento`, `kVivo` y `perfiles` de
   `window`.
   ═════════════════════════════════════════════════════════════════════ */
'use strict';

/* ── de app.js: D, el lobby ── */
var D = null;

/* ── de app.js: lo en vivo: VIVO, VIVO_L, VIVO_B, pedirVivo y su sondeo, llaveDeEvento y conVeredictos ── */
/* ── las llaves en vivo ─────────────────────────────────────────────────
   🔑 Dlx, 27/09/2026: «llaves en vivo… como las notificaciones, que se
   chequean cada 1 minuto». El vigía del Worker guarda cada minuto el texto
   de las llaves que se juegan (`/api/avisos/vivo`); acá las lee `LlaveVivo`
   (bot/paginas/llave_vivo.js, atado al lector de Python por CI) y las dibuja
   el mismo panel que las oficiales.

   ⚠️ CUANDO EL CICLO PROCESA EL EVENTO, LA DE EN VIVO SE VA: su mensaje ya
   está en los links de una llave oficial, que trae los puntos.
   ⚠️ CADA MINUTO SÓLO SI HAY ALGO EN VIVO O UN EVENTO CERCA, y nunca con la
   pestaña escondida. Si no, cada cinco: así se entera cuando arranca una. */
var VIVO = { llaves: [] }, VIVO_L = {}, VIVO_B = [], VIVO_TIMER = null, VIVO_PEDIDO = 0;
function llavesHechas() {
  var s = {};
  Object.keys(D.llaves || {}).forEach(function (n) {
    ((D.llaves[n] || {}).links || []).forEach(function (u) { s[String(u).split('/').pop()] = 1; });
  });
  return s;
}
function pedirVivo() {
  if (!window.LlaveVivo) return;
  VIVO_PEDIDO = Date.now();
  fetch('/api/avisos/vivo', { headers: { accept: 'application/json' } })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) { VIVO = d || { llaves: [] }; pintaVivo(); })
    .catch(function () { /* sin red o sin vigía: queda lo que había */ })
    .then(programarVivo);
}
function programarVivo() {
  clearTimeout(VIVO_TIMER);
  var ahora = Date.now();
  var cerca = (D.calendario || []).some(function (c) {
    var t = Date.parse(c.t);
    return t > ahora - 5 * 3600000 && t < ahora + 15 * 60000;
  });
  VIVO_TIMER = setTimeout(function () {
    if (document.visibilityState === 'hidden') { programarVivo(); return; }
    pedirVivo();
  }, Object.keys(VIVO_L).length || cerca ? 60000 : 300000);
}
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible' && D && Date.now() - VIVO_PEDIDO > 55000) pedirVivo();
});
/* ¿Cuál de las llaves en vivo es la de este anuncio? Lo contesta `LlaveVivo.deEvento()` (llave_vivo.js), que es lo
   mismo que pregunta el bot en vivo: el mismo servidor, a horario, alguna palabra en común y sin números que choquen —y
   si no, la llave HUÉRFANA, con el título copiado de la edición anterior («VOL 22» en la llave de la VOL 23, FFA,
   05/10/2026)—. Para esa segunda pasada hacen falta todos los anuncios que se conocen y todas las llaves en vivo. */
var ANUNCIOS_LL = { d: null, v: null, l: [] };
function anunciosLL() {
  // se arma una vez por payload y por vuelta del vigía: la página llama a esto en cada dibujo
  if (ANUNCIOS_LL.d === D && ANUNCIOS_LL.v === VIVO) return ANUNCIOS_LL.l;
  var out = [], visto = {};
  var sumar = function (n, sv, cuando, link, mod) {
    var k = link || (sv + '|' + n + '|' + cuando);
    if (!n || visto[k]) return;
    visto[k] = 1;
    out.push({ nombre: n, sv: sv || '', cuando: cuando, link: link || '', mod: mod || '' });
  };
  ((D && D.proximos) || []).forEach(function (x) { sumar(x.nombre, x.sv, x.cuando, x.link, x.modalidad); });
  ((D && D.calendario) || []).forEach(function (x) { sumar(x.n, x.sv, x.t, x.link, x.mod); });
  ((VIVO && VIVO.anuncios) || []).forEach(function (a) { sumar(a.n, a.sv, a.ini, a.url, a.mod); });
  ANUNCIOS_LL = { d: D, v: VIVO, l: out };
  return out;
}
// ⚠️ UN CONTEXTO POR PAYLOAD, POR VUELTA DEL VIGÍA Y POR LLAVES EN VIVO, y el mismo objeto mientras no cambien:
// `deEvento()` guarda la asignación entera por contexto (05/10/2026). Uno nuevo en cada pregunta la recalculaba entera
// cada vez —60 ms por dibujo con 20 eventos, medido—
var CTX_LL = { a: null, v: null, k: '', c: null };
function llaveDeEvento(e, ls) {
  if (!window.LlaveVivo || !LlaveVivo.deEvento) return null;
  var a = anunciosLL(), ids = Object.keys(VIVO_L), k = ids.join(',');
  if (!CTX_LL.c || CTX_LL.a !== a || CTX_LL.v !== VIVO_L || CTX_LL.k !== k) {
    CTX_LL = { a: a, v: VIVO_L, k: k, c: { anuncios: a, todas: ids.map(function (i) { return VIVO_L[i]; }) } };
  }
  return LlaveVivo.deEvento(e, ls, CTX_LL.c);
}
/* 🔑 LA LLAVE EN VIVO, CON LO QUE DICE #VEREDICTOS (02/10/2026). Dlx: «el orden verdadero de las llaves para ese evento
   estaba en el canal de veredictos» y «cuando hay eventos en vivo en X servidor, tienes que estar atento a los canales
   de eventos también». La llave del organizador trae la forma entera —lo que falta jugar también— y #votaciones lo que
   se jugó de verdad: cada batalla de veredictos se pone sobre la de la llave que más gente comparte en esa ronda (sus
   lados y su ganador), y la que no está en la llave se agrega. Mismo servidor, a horario y con la mayoría de la gente
   en común, como `escuchar.veredicto_de()`. Los puntos siguen saliendo del ciclo, que hace lo mismo con la llave
   entera (`llaves_a_entrada.llave_de_veredictos_para()`). */
function conVeredictos(L, lvs) {
  var n = function (s) { return LlaveVivo.norm(String(s || '').replace(/\s*[(（][^()（）]*[)）]?\s*$/u, '')); };
  var gente = function (lados) {
    var out = [];
    lados.forEach(function (x) { String(x).split(/\s*,\s*/).forEach(function (p) { if (n(p)) out.push(n(p)); }); });
    return out;
  };
  var deL = {};
  L.rondas.forEach(function (R) { R.b.forEach(function (b) { gente(b[0]).forEach(function (k) { deL[k] = 1; }); }); });
  var desde = (L.pub || 0) - 3 * 3600000, hasta = (L.ed || L.pub || 0) + 6 * 3600000;
  var V = (lvs || []).filter(function (v) {
    if ((v.sv || '') !== (L.sv || '') || v.pub < desde || v.pub > hasta) return false;
    var deV = {};
    v.batallas.forEach(function (b) { gente(b[1]).forEach(function (k) { deV[k] = 1; }); });
    var a = Object.keys(deL), c = Object.keys(deV);
    return a.length && c.length && a.filter(function (k) { return deV[k]; }).length >= 0.6 * a.length &&
      c.filter(function (k) { return deL[k]; }).length >= 0.6 * c.length;
  });
  if (V.length !== 1) return false;
  var ETQ = { 'FILTROS': 'Filtros', 'CLASIFICATORIAS': 'Clasificatorias', 'PRELIMINARES': 'Preliminares',
    'DIECISEISAVOS': 'Dieciseisavos', 'OCTAVOS': 'Octavos', 'CUARTOS': 'Cuartos', 'SEMIFINALES': 'Semifinales',
    'TERCER LUGAR': 'Tercer puesto', 'FINAL': 'Final' };
  // cada uno por su persona —«Park-Ji Sung» es Oasis— o por su nombre (ver `quienVivo()`)
  var q = quienVivo(L.sv);
  var personas = function (lados) {
    var out = [];
    lados.forEach(function (x) {
      String(x).split(/\s*,\s*/).forEach(function (p) { if (n(p)) out.push((q(p)[0] ? 'k:' + q(p)[0] : 'n:' + n(p))); });
    });
    return out;
  };
  var orden = ['FILTROS', 'CLASIFICATORIAS', 'PRELIMINARES', 'DIECISEISAVOS', 'OCTAVOS', 'CUARTOS', 'SEMIFINALES',
    'TERCER LUGAR', 'FINAL'];
  var ultimaV = Math.max.apply(null, V[0].batallas.map(function (b) { return orden.indexOf(b[0]); }));
  var porRonda = {};
  V[0].batallas.forEach(function (bv) { (porRonda[bv[0]] = porRonda[bv[0]] || []).push(bv); });
  Object.keys(porRonda).forEach(function (rv) {
    var r = ETQ[rv] || rv;
    var R = L.rondas.filter(function (x) { return x.r === r; })[0];
    if (!R) { R = { r: r, b: [] }; L.rondas.push(R); }
    // de a pares, primero los que más gente comparten: en una ronda cada uno pelea una vez (salvo el revivido), así
    // que una persona en común ya dice que es la misma batalla
    var pares = [];
    porRonda[rv].forEach(function (bv, iv) {
      var pv = personas(bv[1]);
      R.b.forEach(function (b, il) {
        var k = personas(b[0]).filter(function (x) { return pv.indexOf(x) >= 0; }).length;
        if (k) pares.push([k, iv, il]);
      });
    });
    pares.sort(function (a, b) { return b[0] - a[0] || a[1] - b[1] || a[2] - b[2]; });
    var deV = {}, deL = {};
    pares.forEach(function (p) { if (!(p[1] in deV) && !(p[2] in deL)) { deV[p[1]] = p[2]; deL[p[2]] = p[1]; } });
    var nuevas = R.b.slice();
    porRonda[rv].forEach(function (bv, iv) {
      // la nota es la de `aLlave()`: «pasan N» si pasan varios, y nada si no
      var nuevo = [bv[1].slice(), bv[2] || '', (bv[4] || []).length > 1 ? 'pasan ' + bv[4].length : '', []];
      if (iv in deV) nuevas[deV[iv]] = nuevo; else nuevas.push(nuevo);
    });
    // si en veredictos ya se juega una ronda posterior, lo de la llave que no aparece en esta ronda no se jugó
    if (orden.indexOf(rv) < ultimaV) nuevas = nuevas.filter(function (b, i) { return i >= R.b.length || i in deL; });
    R.b = nuevas;
  });
  // una ronda que sólo estaba en veredictos va en su lugar, no al final
  var pos = function (r) { var k = Object.keys(ETQ).filter(function (x) { return ETQ[x] === r; })[0]; return k ? orden.indexOf(k) : -1; };
  L.rondas.sort(function (a, b) { return pos(a.r) - pos(b.r); });
  L.rondas.forEach(function (R) { R.b.forEach(function (b) { b[3] = []; }); });
  LlaveVivo.enlazar(L.rondas);
  // y lo que `aLlave()` dice de la llave entera, otra vez: si terminó y qué ronda se está jugando
  var F = L.rondas.filter(function (x) { return x.r === 'Final'; })[0];
  L.terminada = !!(F && F.b.length === 1 && F.b[0][1]);
  // como en `aLlave()`: la última ronda con una batalla sin ganador, y si no hay, la última
  L.enJuego = L.rondas.length ? L.rondas[L.rondas.length - 1].r : L.enJuego;
  for (var i = L.rondas.length - 1; i >= 0; i--) {
    if (L.rondas[i].r !== 'Tercer puesto' && L.rondas[i].b.some(function (x) { return !x[1]; })) { L.enJuego = L.rondas[i].r; break; }
  }
  L.conVeredictos = true;
  return true;
}

/* ── de app.js: los perfiles: PERF y perfiles() ── */
var PERF = null, PERF_PIDIENDO = null;
function perfiles() {
  if (PERF) return Promise.resolve(PERF);
  if (!PERF_PIDIENDO) {
    PERF_PIDIENDO = fetch('/api/perfiles', { headers: { accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { PERF = d || {}; return PERF; })
      .catch(function () { PERF_PIDIENDO = null; return null; });
  }
  return PERF_PIDIENDO;
}

/* ── de app.js: quién es quién: normNombre, kDe, quienVivo, kVivo ── */
/* 🔑 LA CLAVE DE ALGUIEN POR SU NOMBRE EN UNA LLAVE: tal cual, o sin la
   bandera —la llave escribe «Mau Kc 🇨🇴» y el ranking «Mau Kc»—; y si el
   nombre es de dos (Volk 🇲🇽 y volk 🇨🇴), decide la bandera. Es la regla de
   `de()` en subir_web.py. Un solo lugar para la llave, los duelos y el cara
   a cara: el perfil sólo probaba el nombre exacto y sus rivales con bandera
   salían sin link. */
var K_DE = null, K_DE_T = null;
function banderasDe(x) {
  var out = [], par = '';
  Array.from(String(x || '')).forEach(function (ch) {
    var c = ch.codePointAt(0);
    if (c >= 0x1F1E6 && c <= 0x1F1FF) {
      par += String.fromCharCode(c - 0x1F1E6 + 97);
      if (par.length === 2) { out.push(par); par = ''; }
    }
  });
  return out;
}
/* el nombre como lo compara el servidor (`_norm()` de comun/respaldo.py):
   NFKD, minúsculas y sólo letras y números. Sin esto «ANTORCHA OLIMPICA»
   de una llave no era «ANTORCHA OLÍMPICA» del ranking. */
function normNombre(s) {
  return String(s || '').normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}
function kDe(n) {
  // ⚠️ se rehace si llegó otro lobby: la tabla es otra
  if (!K_DE || K_DE_T !== D.tabla) {
    K_DE = { k: {}, kn: {} };
    K_DE_T = D.tabla;
    (D.tabla || []).forEach(function (f) {
      K_DE.k[f.n] = f.k;
      var q = normNombre(f.n);
      (K_DE.kn[q] = K_DE.kn[q] || []).push(f);
    });
  }
  if (K_DE.k[n]) return K_DE.k[n];
  var c = K_DE.kn[normNombre(n)] || [];
  if (c.length === 1) return c[0].k;
  // 🔑 Y POR SU ALIAS, si el nombre no es de nadie (`alias` del lobby: la
  // hoja AKAs). Dlx, 29/09/2026, con la VOL 16 en juego: «¿por qué en la
  // llave sigue diciendo PARK JI SUNG? Debería mostrarse el aka principal,
  // que es Oasis». El ciclo ya lo resolvía; la llave en vivo la arma la
  // página, y acá sólo había nombres de la tabla: MAKMA (Makmah) y PRR
  // (Hassan) tampoco abrían su perfil.
  // 🕵️ y, si tampoco es un alias, lo que el vigía reconoció en vivo: la inscripción de su cuenta, la llamada o la
  // mención (02/10/2026). Ver `kVivo()`
  if (!c.length) return (D.alias && D.alias[normNombre(n)]) || kVivo(n) || '';
  var ccs = banderasDe(n);
  var m = c.filter(function (f) { return ccs.indexOf(String(f.cc || '').toLowerCase()) >= 0; });
  return m.length === 1 ? m[0].k : '';
}

/* 🔑 QUIÉN ES CADA NOMBRE DE UNA LLAVE EN VIVO (02/10/2026), para `LlaveVivo.aLlave()`: la clave de su perfil por la
   tabla y los alias del ciclo (`kDe()`), o por lo que el vigía reconoció en vivo —la inscripción de su cuenta, la
   llamada, la mención— (`VIVO.quien`, por servidor). Así quien juega octavos como «Park-Ji Sung» y cuartos como
   «Oasis» es uno solo, y el cuadro lo une. Dlx: «esto es lo más difícil de este sistema, reconocer a las personas». */
function quienVivo(sv) {
  var vivo = (VIVO && VIVO.quien && VIVO.quien[sv]) || {};
  return function (n) {
    var k = kDe(n) || vivo[normVivo(n)] || '';
    return k ? [k] : [];
  };
}
/* el nombre como lo guarda el vigía (`normPagina()` de bot/avisos.js): sin la historia `(…)` del final */
function normVivo(n) { return normNombre(String(n || '').replace(/\s*[(（][^()（）]*[)）]?\s*$/u, '')); }
/* 🕵️ el perfil que el vigía reconoció en vivo para un nombre (`VIVO.quien`), si es uno solo en todos los servidores */
function kVivo(n) {
  var q = (VIVO && VIVO.quien) || {}, k = normVivo(n), hay = {};
  Object.keys(q).forEach(function (sv) { if (q[sv] && q[sv][k]) hay[q[sv][k]] = 1; });
  var ks = Object.keys(hay);
  return ks.length === 1 ? ks[0] : '';
}

/* ── de app.js: el muro: MURO y pedirMuro ── */
/* ── Publicaciones: el muro de la Liga ─────────────────────────────────
   🔑 Dlx, 28/09/2026, a «¿qué va en Publicaciones?»: «sí un muro automático,
   pero anuncios de todos los servidores también». Lo arma el ciclo
   (`bot/muro.py`) con lo que ya calcula —campeones, rangos, tarjetas, cazas,
   precios, premios— y los anuncios; la página lo pide al abrir la vista
   (`/api/muro`), así no viaja en cada visita. Contado por la Liga, en
   tercera persona: nunca «en nombre de» nadie. */
var MURO = null, MURO_FIL = '', MURO_VER = 20;
var MURO_ANUNCIO = { anuncio: 1, liga: 1 };
function pedirMuro() {
  fetch('/api/muro', { headers: { accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) { MURO = d && Array.isArray(d.items) ? d.items : (MURO || []); pintaMuro(); })
    .catch(function () { MURO = MURO || []; pintaMuro(); });
}

/* ── de app.js: el changelog: CAMBIOS, CAMBIOS_VISTO, cargarCambios, nuevaQue ── */
/* ── el changelog ─────────────────────────────────────────────────────
   🔑 Dlx, 25/09/2026: «abajo de ajustes agrega un changelog… eso de
   novedades que vamos llenando, pero sin información sensitiva». Es un
   archivo estático (`cambios.json`): no pasa por el Worker ni gasta KV.

   ⚠️ EL PUNTO DE «NUEVO» ES DE ESTE DISPOSITIVO: se guarda el último día
   visto, y lo que es de después se marca. */
var CAMBIOS = null;
var CAMBIOS_VISTO = leerLS('lg:cambios', '');
function cargarCambios(listo) {
  if (CAMBIOS) { if (listo) listo(); return; }
  fetch('cambios.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) { CAMBIOS = (d && d.cambios) || []; puntoCambios(); if (listo) listo(); })
    .catch(function () {
      var c = $('#cambios');
      if (c && listo) c.innerHTML = '<p class="nota">No pude cargar el changelog. Prueba recargar.</p>';
    });
}
// 🔑 «LO NUEVO» ES LA VERSIÓN, NO EL DÍA: hay días con varias. Dlx, 25/09/2026:
// «cada cambio grande o pequeño se aumentará un .01».
function versionDe(x) { return x ? String(x.version || x.dia || '') : ''; }
function nuevaQue(a, b) {
  var pa = String(a || '').split('.').map(Number), pb = String(b || '').split('.').map(Number);
  for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
    var x = pa[i] || 0, y = pb[i] || 0;
    if (isNaN(x) || isNaN(y)) return String(a) > String(b);
    if (x !== y) return x > y;
  }
  return false;
}

/* ── de app.js: las horas: edadMin y cuandoSe ── */
/* los minutos desde ese instante (NaN si no se puede leer); misma lectura que `cuandoSe()` */
function edadMin(iso) {
  var s = String(iso || '').replace(' ', 'T');
  if (s && !/(Z|[+-]\d\d:?\d\d)$/.test(s)) s += 'Z';
  return (Date.now() - Date.parse(s)) / 60000;
}
function cuandoSe(iso) {
  // 🔴 LA HORA VIENE EN UTC SIN ZONA, y `Date.parse` sin zona la toma como
  // hora LOCAL: en el este, «Lo que pasó» decía «recién» de algo de hace
  // cuatro horas. Encontrado por la auditoría del 25/09/2026. `pintaRelojes`
  // ya le agregaba la Z.
  var s = String(iso || '').replace(' ', 'T');
  if (s && !/(Z|[+-]\d\d:?\d\d)$/.test(s)) s += 'Z';
  var t = Date.parse(s);
  if (isNaN(t)) return '';
  var m = Math.round((Date.now() - t) / 60000);
  if (m < 2) return 'recién';
  if (m < 60) return 'hace ' + m + ' min';
  var h = Math.round(m / 60);
  var dias = Math.round(h / 24);
  return h < 24 ? 'hace ' + h + ' h' : 'hace ' + dias + (dias === 1 ? ' día' : ' días');
}

/* ── de app.js: el refresco de cada 5 minutos: refrescarDatos ── */
/* 🔑 LOS DATOS SE REFRESCAN SOLOS CON LA PÁGINA ABIERTA: cada 5 minutos
   mientras se ve, y al volver a la pestaña. Dlx, 27/09/2026: «sigo viendo
   los 10 MW de hoy» — eran 3 desde hacía un rato, pero la página pedía los
   datos una sola vez, al abrirse, y el ciclo los cambia cada media hora.
   ⚠️ SÓLO SI CAMBIÓ EL `sello`, y sin `ir()`: eso cierra la llave o el menú
   que la persona tenga abiertos. Se redibujan las secciones y listo. */
var DATOS_PEDIDOS = Date.now();
function refrescarDatos() {
  if (document.visibilityState === 'hidden' || !D) return;
  DATOS_PEDIDOS = Date.now();
  // los votos y los precios cambian a cada rato, no con el ciclo: se piden siempre
  try { pedirEncuestas(); } catch (e) { console.error('[pedirEncuestas]', e); }
  try { pedirPrecios(); } catch (e) { console.error('[pedirPrecios]', e); }
  if (MURO !== null) pedirMuro();
  fetch('/api/lobby', { headers: { accept: 'application/json' } })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) {
      if (!d || !d.tabla || d.sello === D.sello) return;
      D = d;
      pintaDatos();
    })
    .catch(function () { /* la próxima vez */ });
}
