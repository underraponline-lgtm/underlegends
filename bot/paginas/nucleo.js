/* ═════════════════════════════════════════════════════════════════════
   EL NÚCLEO: lo que quedó de app.js, que se fue el 27/10/2026 (la tanda 4
   del remake; Dlx: «Borra la tanda 4 entonces»). La página es React
   (`web/`, montada en `#inicio-nuevo`); esto es sólo la cañería que ella
   escucha:

   · EL ARRANQUE: baja el lobby UNA vez (`D`), vuelve de Discord, pide lo
     en vivo, los votos, los precios y a quién seguís, y refresca cada 5
     minutos (`refrescarDatos()` de datos.js).
   · LOS AVISOS DE REACT. `envolver()` de App.jsx reemplaza `pintaDatos`,
     `pintaVivo`, `pintaEncuestas`, `ir`, `pintaCuenta`, `pintaPopCuenta` y
     `pintaPrecios` por una versión que, además, avisa (`lg:datos`,
     `lg:vivo`…). Antes dibujaban las pantallas viejas; ahora no dibujan
     nada y existen para que el aviso salga. ⚠️ Por eso tienen que seguir
     llamándose así y ser `function` globales: renombrarlas deja a la
     página sorda sin fallar.
   · LOS AYUDANTES que cuenta.js, tienda.js, social.js y datos.js todavía
     usan: `porK`, `nombreSv`, `urlDe`, `ruta`…

   ⚠️ Y SIN DATOS NO SE QUEDA EN BLANCO: si `/api/lobby` no contesta, sale
   «No pude cargar los datos» con «Reintentar» (`__sinPagina()`, del script
   del principio de index.html). Es lo que mira herramientas/web_en_borde.py.

   ⚠️ Todo con `var` y `function`, nunca `let`/`const`: React lo lee de
   `window`.
   ═════════════════════════════════════════════════════════════════════ */
'use strict';

/* ── los ayudantes ─────────────────────────────────────────────────── */
var dd2 = function (n) { return (n < 10 ? '0' : '') + n; };
// el día de un instante en la zona de quien mira: 'AAAA-MM-DD' (lo usa web/src/liga.js)
function diaDe(d) {
  try {
    var o = { year: 'numeric', month: '2-digit', day: '2-digit' }, q = {};
    if (zona()) o.timeZone = zona();
    new Intl.DateTimeFormat('en-CA', o).formatToParts(new Date(d)).forEach(function (x) {
      q[x.type] = x.value;
    });
    return q.year + '-' + q.month + '-' + q.day;
  } catch (e) {
    var x = new Date(d);
    return x.getFullYear() + '-' + dd2(x.getMonth() + 1) + '-' + dd2(x.getDate());
  }
}
// «Menos animaciones» (Tu cuenta → La app): la clase la leen la pantalla de carga y web/src/anima.js
function aplicarCalma() {
  document.documentElement.classList.toggle('calma', !!AJ.calma);
}
/* La clave de `comun/claves.py`: NFD, minúsculas, sólo letras y números de
   cualquier alfabeto, sin banderas. */
var normK = function (s) {
  return String(s || '').normalize('NFD').toLowerCase()
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').replace(/[^\p{L}\p{N}-]/gu, '');
};
var porK = function (k) {
  var t = (D && D.tabla) || [];
  var f = t.filter(function (x) { return x.k === k; })[0];
  if (f) return f;
  // 🔴 LOS LINKS VIEJOS: hasta el 25/09/2026 la clave era el nombre en minúsculas (`mau kc`) y la de R2, `maukc`
  var n = normK(k);
  return n ? t.filter(function (x) { return normK(x.k) === n; })[0] : undefined;
};
function svDe(sv) {
  return ((D && D.svs) || []).filter(function (s) { return s.sv === sv; })[0] || {};
}
function nombreSv(sv) { return svDe(sv).nombre || sv || ''; }

/* ── la ruta ──────────────────────────────────────────────────────────
   La dirección es de verdad (`/freestyle-rap/ranking`) y el código habla en
   `#/ranking`: el script del principio de index.html traduce (`rutaLG()`,
   `urlLG()`). ⚠️ Con `<base href="/">` un `replaceState(null, '', '#/x')`
   deja la dirección en `/#/x`: para escribir una ruta, `urlDe()`. */
function ruta() {
  return (window.rutaLG ? window.rutaLG() : (location.hash || '#/').replace(/^#\/?/, '')).split('?')[0];
}
function urlDe(r) {
  return window.urlLG ? window.urlLG(r) : '#/' + String(r || '').replace(/^#?\/?/, '');
}
// ¿manda la página nueva? Siempre, desde la tanda 4 (cuenta.js lo pregunta en `nuevaCuenta()`)
function mandaLoNuevo() { return true; }

/* ── lo que React envuelve: cada uno avisa al correr (ver arriba) ───── */
function pintaCuenta() {}
function pintaPopCuenta() {}
function pintaPrecios() {}
function pintaEncuestas() {}
function pintaDatos() {
  [pintaCuenta, pintaEncuestas, pintaPrecios, aplicarCalma].forEach(function (f) {
    try { f(); } catch (e) { console.error('[' + f.name + ']', e); }
  });
}
// 🔑 cada cambio de dirección: lo que la página nueva necesita que se pida (el changelog, la billetera)
function ir() {
  var r = ruta().split('/')[0];
  if (r === 'cambios') cargarCambios(pintaCambios);
  if (r === 'tienda' && D && !BILL) pedirBilletera(false);
}
/* 📡 LO EN VIVO: `VIVO` (lo que guardó el vigía) -> `VIVO_L` (las llaves que se juegan, por id) y `VIVO_B` (las que el
   organizador borró). Lo dibuja el Inicio nuevo (`Liga.vivo()`); acá sólo se arma. */
function pintaVivo() {
  if (!window.LlaveVivo || !D) return;
  var ya = llavesHechas(), ahora = Date.now();
  var bloques = LlaveVivo.unirPartidas((VIVO.llaves || []).filter(function (m) { return !ya[m.id]; }));
  VIVO_L = {};
  // 🔴 LAS LLAVES QUE EL ORGANIZADOR BORRÓ (LA REDENCION, FFA, 03/10/2026): el título, la hora y cuándo se borró, para
  // que el Inicio deje de mostrar «en vivo» a un evento que se quedó sin llave. Sólo las que tienen título
  VIVO_B = (VIVO.borradas || []).map(function (m) {
    var n = '';
    try { n = m.titulo || LlaveVivo.titulo(m.texto || ''); } catch (e) { n = ''; }
    return n ? { id: m.id, sv: m.sv || '', nombre: n, pub: m.pub, ed: m.ed, borrada: m.t } : null;
  }).filter(Boolean);
  var ls = bloques.map(function (b) {
    try { return LlaveVivo.aLlave(b, quienVivo(b.sv)); } catch (e) { console.error('[llave en vivo]', e); return null; }
  }).filter(function (L) {
    // en vivo = la tocaron en las últimas tres horas
    return L && L.rondas.length && ahora - (L.ed || L.pub || 0) < 3 * 3600000;
  });
  // ⚖️ y lo que se jugó de verdad, de #veredictos / #votaciones: ver `conVeredictos()`
  var lvs = [];
  try { lvs = LlaveVivo.llavesDeVeredictos ? LlaveVivo.llavesDeVeredictos(VIVO.veredictos || []) : []; } catch (e) {
    console.error('[llaves de veredictos]', e);
  }
  if (lvs.length) ls.forEach(function (L) { try { conVeredictos(L, lvs); } catch (e) { console.error('[con veredictos]', e); } });
  // 🔑 Y LOS 5 VIDAS DE LOS VEREDICTOS (`LlaveVivo.veredictos()`): sin llave, con el nombre de su anuncio
  var ver = [];
  try { ver = LlaveVivo.veredictos ? LlaveVivo.veredictos(VIVO.veredictos || []) : []; } catch (e) {
    console.error('[veredictos en vivo]', e);
  }
  ver.filter(function (L) { return ahora - (L.ed || L.pub || 0) < 3 * 3600000; }).forEach(function (L) {
    var e = (D.proximos || []).concat(D.calendario || []).filter(function (x) {
      return llaveDeEvento({ cuando: x.cuando || x.t, sv: x.sv, nombre: x.nombre || x.n }, [L]);
    })[0];
    L.nombre = e ? (e.nombre || e.n) : '5 vidas · ' + nombreSv(L.sv);
    ls.push(L);
  });
  // 🔴 EL MISMO EVENTO, UNA VEZ (DESGRACIAS EN TOKYO VOL 15, 28/09/2026: sorteado dos veces): mismo servidor y mismo
  // nombre en estas tres horas es el mismo evento, y queda la más nueva (como `sin_sorteos_viejos()` del ciclo)
  var visto = {};
  ls = ls.slice().sort(function (a, b) { return (b.pub || 0) - (a.pub || 0); }).filter(function (L) {
    var k = LlaveVivo.norm(L.nombre || '');
    if (!k || L.veredictos || L.nombre === 'La llave') return true;
    k = (L.sv || '') + '|' + k;
    if (visto[k]) return false;
    visto[k] = 1;
    return true;
  }).sort(function (a, b) { return ls.indexOf(a) - ls.indexOf(b); });
  ls.forEach(function (L) { VIVO_L[L.id] = L; });
}
/* el changelog: abrirlo lo da por visto (App.jsx toma la versión de antes, envolviendo esto) */
function pintaCambios() {
  if (!CAMBIOS || !CAMBIOS.length) return;
  CAMBIOS_VISTO = versionDe(CAMBIOS[0]);
  guardarLS('lg:cambios', CAMBIOS_VISTO);
}

/* ── lo que las pantallas viejas dibujaban y cuenta.js y datos.js todavía llaman: ya no hay qué dibujar ── */
function puntoCambios() {}
function pintaMuro() {}
function pintaPaneles() {}
function pintaPopAjustes() {}
// la página nueva lo llama al cambiar la zona (web/src/cuenta.jsx); las horas las redibuja ella con `lg:ajustes`
function repintarHoras() {}

/* ── el arranque ───────────────────────────────────────────────────── */
function pinta() {
  try { cargarCambios(null); } catch (e) { /* sin changelog, la página sigue */ }
  try { volverDeDiscord(); } catch (e) { console.error('[volverDeDiscord]', e); }
  pintaDatos();
  ir();
  try { pintaVivo(); } catch (e) { console.error('[pintaVivo]', e); }
  try { pedirVivo(); } catch (e) { console.error('[pedirVivo]', e); }
  try { pedirEncuestas(); } catch (e) { console.error('[pedirEncuestas]', e); }
  try { pedirPrecios(); } catch (e) { console.error('[pedirPrecios]', e); }
  // ★ con Discord, a quién seguís sale del servidor (quien vuelve de Discord lo pide al terminar de entrar)
  if (DC && !DC_VUELTA) {
    try { pedirSigo(); } catch (e) { console.error('[pedirSigo]', e); }
  }
  setInterval(refrescarDatos, 5 * 60000);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && Date.now() - DATOS_PEDIDOS > 60000) refrescarDatos();
  });
}
// `lg:dir`: uno por cambio de dirección (el script del principio de index.html)
window.addEventListener('lg:dir', function () { ir(); });
try { aplicarCalma(); } catch (e) { /* nada */ }

fetch('/api/lobby', { headers: { accept: 'application/json' } })
  .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(function (d) { D = d; pinta(); })
  .catch(function (e) {
    // 🔴 QUE FALLE SE VE, y no como una página vacía: lo dice y deja reintentar
    console.error('[lobby]', e);
    window.__sinDatos = true;
    if (window.__sinPagina) window.__sinPagina('El servidor contestó ' + (e && e.message ? e.message : 'con un error') + '.');
  });
